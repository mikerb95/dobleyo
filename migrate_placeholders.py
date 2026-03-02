#!/usr/bin/env python3
"""
Convierte placeholders MySQL-style `?` a PostgreSQL-style `$1, $2, ...`
en archivos .js que contienen llamadas a query() / db.query().

Uso: python3 migrate_placeholders.py [archivo1.js] [archivo2.js] ...
     python3 migrate_placeholders.py --all   # todos los archivos conocidos
"""

import re
import sys
import os

def convert_query_string(sql: str) -> str:
    """
    Dado un string SQL con `?` placeholders, los reemplaza por $1, $2, etc.
    Respeta el quote char original (no lo modifica).
    """
    counter = [0]
    def replacer(m):
        counter[0] += 1
        return f'${counter[0]}'
    return re.sub(r'\?', replacer, sql)


def convert_file(filepath: str) -> tuple[int, str]:
    """
    Lee el archivo, busca todas las llamadas query(`...`) / db.query('...')
    y convierte los ? a $n dentro de cada string SQL (primer argumento).
    Retorna (num_replacements, new_content).
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    total_replacements = 0

    # Regex que captura el string SQL completo como primer argumento de query(
    # Soporta: query('...'), query("..."), query(`...`)
    # El string puede ser multi-línea si es template literal.
    #
    # Patrón: busca query( seguido (opcionalmente) de espacios/newlines, luego
    # un string delimitado por ', " o `.
    #
    # Captura: group(1) = todo lo que está dentro de la cita (sin las citas)
    #          group(0) = match completo incluyendo query(' y el argumento
    
    def replace_query(m):
        nonlocal total_replacements
        prefix = m.group(1)   # 'query(' o 'db.query(' con espacios opcionales
        quote  = m.group(2)   # ', " o `
        sql    = m.group(3)   # contenido del SQL
        
        count_before = sql.count('?')
        converted = convert_query_string(sql)
        total_replacements += count_before
        
        return f'{prefix}{quote}{converted}{quote}'

    # Pattern explicado:
    # ((?:\w+\.)?query\s*\(\s*)   → captura el nombre de la función incluyendo paréntesis
    # ([`'"])                      → captura el tipo de quote
    # (.*?)                        → captura el contenido (non-greedy)
    # \2                           → cierra con el mismo quote
    # (?=\s*[,)])                  → lookahead: seguido de coma o paréntesis cierre
    
    pattern = re.compile(
        r"""((?:\w+\.)?query\s*\(\s*)([`'"])(.*?)\2(?=\s*[,)])""",
        re.DOTALL
    )
    
    new_content = pattern.sub(replace_query, content)
    return total_replacements, new_content


FILES = [
    'server/routes/audit.js',
    'server/routes/auth.js',
    'server/routes/caficultor.js',
    'server/routes/coffee.js',
    'server/routes/emails.js',
    'server/routes/farms.js',
    'server/routes/finance.js',
    'server/routes/inventory.js',
    'server/routes/labels.js',
    'server/routes/lots.js',
    'server/routes/orders.js',
    'server/routes/production/batches.js',
    'server/routes/production/orders.js',
    'server/routes/production/quality.js',
    'server/routes/setup.js',
    'server/routes/stock.js',
    'server/routes/users.js',
    'server/services/audit.js',
    'server/services/mercadolibre.js',
    'server/migrations/split_name_fields.js',
]


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    
    if '--all' in sys.argv:
        targets = [os.path.join(base, f) for f in FILES]
    else:
        targets = sys.argv[1:]
    
    if not targets:
        print("Uso: python3 migrate_placeholders.py --all  o  python3 migrate_placeholders.py archivo.js ...")
        sys.exit(1)
    
    for path in targets:
        if not os.path.exists(path):
            print(f'  SKIP (no existe): {path}')
            continue
        
        n, new_content = convert_file(path)
        if n == 0:
            print(f'  OK (sin cambios): {path}')
            continue
        
        # Backup
        with open(path + '.bak2', 'w', encoding='utf-8') as f:
            with open(path, 'r', encoding='utf-8') as orig:
                f.write(orig.read())
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f'  ✓ {n} reemplazos: {path}')

if __name__ == '__main__':
    main()
