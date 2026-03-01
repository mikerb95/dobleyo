#!/usr/bin/env node
/**
 * Script de migración: convierte placeholders MySQL (?) a PostgreSQL ($n)
 * dentro de template literals que contienen SQL.
 *
 * Uso: node server/migrations/convert-pg-placeholders.js <archivo.js>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = process.argv[2];
if (!filePath) {
    console.error('Uso: node convert-pg-placeholders.js <archivo.js>');
    process.exit(1);
}

const absPath = resolve(filePath);
let content = readFileSync(absPath, 'utf8');
let changeCount = 0;

/**
 * Reemplaza `?` por `$n` dentro de cada template literal del archivo.
 * Solo afecta template literals cuyo contenido contiene palabras clave SQL.
 */
const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|SET|VALUES|GROUP BY|ORDER BY|UNION|HAVING|LIMIT|OFFSET|INTO|WITH)\b/i;

// Reemplaza template literals completos
content = content.replace(/`([^`]*)`/g, (match, inner) => {
    // Solo procesar strings que parecen SQL
    if (!SQL_KEYWORDS.test(inner)) return match;

    let counter = 0;
    const converted = inner.replace(/\?/g, () => {
        counter++;
        return `$${counter}`;
    });

    if (counter > 0) changeCount += counter;
    return `\`${converted}\``;
});

// También manejar strings normales con comillas simples que contengan SQL (poco común pero posible)
content = content.replace(/'([^']*SELECT[^']*)'/gi, (match, inner) => {
    let counter = 0;
    const converted = inner.replace(/\?/g, () => `$${++counter}`);
    if (counter > 0) changeCount += counter;
    return `'${converted}'`;
});

writeFileSync(absPath, content, 'utf8');
console.log(`✅ ${filePath}: ${changeCount} placeholders convertidos de ? a $n`);
