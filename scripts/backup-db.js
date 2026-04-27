#!/usr/bin/env node
/**
 * Backup de Turso/libSQL → archivo SQL.
 * Uso: node scripts/backup-db.js > backup-2026-04-27.sql
 * O con env file: node --env-file=.env scripts/backup-db.js
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function backup() {
  const out = [];
  const ts = new Date().toISOString();

  out.push(`-- DobleYo Café — Backup ${ts}`);
  out.push(`-- Base de datos: ${process.env.TURSO_DATABASE_URL}`);
  out.push('PRAGMA foreign_keys = OFF;');
  out.push('BEGIN TRANSACTION;');
  out.push('');

  // Obtener todas las tablas (excluye tablas internas de SQLite)
  const { rows: tables } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  for (const { name } of tables) {
    // DDL de la tabla
    const { rows: ddl } = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
      [name]
    );
    if (ddl[0]?.sql) {
      out.push(`-- Tabla: ${name}`);
      out.push(`DROP TABLE IF EXISTS ${name};`);
      out.push(ddl[0].sql + ';');
    }

    // Datos
    const { rows } = await client.execute(`SELECT * FROM ${name}`);
    if (rows.length === 0) { out.push(''); continue; }

    const cols = Object.keys(rows[0]);
    for (const row of rows) {
      const vals = cols.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number' || typeof v === 'bigint') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      out.push(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    out.push('');
  }

  out.push('COMMIT;');
  out.push('PRAGMA foreign_keys = ON;');

  process.stdout.write(out.join('\n') + '\n');
  process.stderr.write(`✅ Backup completado: ${tables.length} tablas\n`);
}

backup().catch(e => { process.stderr.write(`❌ Error: ${e.message}\n`); process.exit(1); });
