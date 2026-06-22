"""
Semilla de datos de demanda para demostración / evaluación SENA.
Inserta 20 registros realistas en demand_records vía Turso HTTP API.

Uso:
  python3 seed_demand.py
"""

import os
import json
import urllib.request

TURSO_DATABASE_URL = os.environ.get(
    "TURSO_DATABASE_URL",
    "libsql://dobleyo-mikerb95.aws-us-east-1.turso.io",
)
TURSO_AUTH_TOKEN = os.environ.get(
    "TURSO_AUTH_TOKEN",
    "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcyOTAwNDcsImlkIjoiMDE5ZGNlYmQtY2UwMS03YTJmLWFmNzMtYzkyZmNiNTQyODNiIiwicmlkIjoiZmI2MmZhMGQtZTg3MS00YmMxLWExMGUtOGUyODYyZjM0ZTM4In0.VPqkA7UMse6vIEsFir9QfFAD7xbfVoIcRTfqagZ1Ph7AwSeFyEjkV1WF5iXDyFTezCGfEeMlfJ5f8nhoIQtdDw",
)

ENDPOINT = TURSO_DATABASE_URL.replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"

RECORDS = [
    # Café grano — semanas 21 a 26
    ("cafe-grano", "Huila Caturra 500g",   "2026-W21", 38,  "units", "Temporada alta cosecha Huila"),
    ("cafe-grano", "Huila Caturra 500g",   "2026-W22", 44,  "units", None),
    ("cafe-grano", "Huila Caturra 500g",   "2026-W23", 51,  "units", "Pico de demanda ferias"),
    ("cafe-grano", "Huila Caturra 500g",   "2026-W24", 47,  "units", None),
    ("cafe-grano", "Huila Caturra 500g",   "2026-W25", 53,  "units", "Pedido corporativo incluido"),
    ("cafe-grano", "Huila Caturra 500g",   "2026-W26", 49,  "units", None),
    # Café molido
    ("cafe-molido", "Nariño Castillo 250g","2026-W21", 22,  "units", None),
    ("cafe-molido", "Nariño Castillo 250g","2026-W22", 25,  "units", None),
    ("cafe-molido", "Nariño Castillo 250g","2026-W23", 30,  "units", "Promoción redes sociales"),
    ("cafe-molido", "Nariño Castillo 250g","2026-W24", 28,  "units", None),
    ("cafe-molido", "Nariño Castillo 250g","2026-W25", 33,  "units", None),
    ("cafe-molido", "Nariño Castillo 250g","2026-W26", 31,  "units", None),
    # Accesorios
    ("accesorios", "Prensa francesa 350ml","2026-W22", 8,   "units", "Lanzamiento producto"),
    ("accesorios", "Prensa francesa 350ml","2026-W24", 11,  "units", None),
    ("accesorios", "Prensa francesa 350ml","2026-W26", 9,   "units", None),
    ("accesorios", "Molino manual Hario",  "2026-W23", 5,   "units", None),
    ("accesorios", "Molino manual Hario",  "2026-W25", 7,   "units", None),
    # Exportación B2B USA
    ("exportacion-b2b", "Green Bean Huila 1kg","2026-W21", 120, "kg", "Cliente NYC — primer pedido"),
    ("exportacion-b2b", "Green Bean Huila 1kg","2026-W23", 150, "kg", "Reorden confirmada"),
    ("exportacion-b2b", "Green Bean Huila 1kg","2026-W25", 175, "kg", "Expansión a Boston"),
]


def _to_arg(v):
    if v is None:
        return {"type": "null"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


def turso_exec(statements):
    reqs = [
        {"type": "execute", "stmt": {"sql": sql, "args": [_to_arg(a) for a in args]}}
        for sql, args in statements
    ]
    reqs.append({"type": "close"})
    body = json.dumps({"requests": reqs}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + TURSO_AUTH_TOKEN)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    print("1. Creando tabla si no existe…")
    turso_exec([(
        """CREATE TABLE IF NOT EXISTS demand_records (
             id           INTEGER PRIMARY KEY AUTOINCREMENT,
             category     TEXT NOT NULL,
             product_key  TEXT,
             period       TEXT,
             demand_value REAL NOT NULL,
             unit         TEXT NOT NULL DEFAULT 'units',
             notes        TEXT,
             created_at   TEXT NOT NULL DEFAULT (datetime('now')),
             updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
           )""", []
    )])
    print("   OK")

    print("2. Verificando registros existentes…")
    res = turso_exec([("SELECT COUNT(*) as c FROM demand_records", [])])
    count = int((res["results"][0]["response"]["result"]["rows"][0][0]["value"]))
    print(f"   Registros actuales: {count}")

    if count >= 20:
        print("   Ya hay datos suficientes. No se insertará nada.")
        return

    print("3. Insertando 20 registros de demostración…")
    stmts = [
        (
            "INSERT INTO demand_records (category, product_key, period, demand_value, unit, notes) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [cat, prod, period, val, unit, notes],
        )
        for cat, prod, period, val, unit, notes in RECORDS
    ]
    turso_exec(stmts)

    print("4. Verificando…")
    res = turso_exec([("SELECT COUNT(*) as c FROM demand_records", [])])
    total = int((res["results"][0]["response"]["result"]["rows"][0][0]["value"]))
    print(f"   Total ahora: {total} registros")
    print("\nListo. Descargue el Excel desde /admin/demanda → 'Exportar Excel'.")


if __name__ == "__main__":
    main()
