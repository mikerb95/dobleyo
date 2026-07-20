/**
 * Aplica db/schema.sql — la fuente de verdad del modelo de datos.
 *
 * Debe ejecutarse ANTES que cualquier otra migración: las migraciones son
 * incrementales (ALTER TABLE sobre users, products, lots, sales_tracking…) y
 * en una base nueva fallan en cascada si el esquema base no existe todavía.
 *
 * Es idempotente: schema.sql usa CREATE TABLE/INDEX IF NOT EXISTS, así que
 * re-ejecutarlo sobre una base ya poblada no cambia nada.
 */
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import libsqlClient from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function applyBaseSchema() {
  const schemaPath = join(__dirname, '../../db/schema.sql');
  const sql = await readFile(schemaPath, 'utf8');

  await libsqlClient.executeMultiple(sql);

  const { rows } = await libsqlClient.execute(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'"
  );
  console.log(`[Migration] db/schema.sql aplicado — ${rows[0].n} tablas presentes.`);
}
