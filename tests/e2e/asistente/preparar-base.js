// Prepara la base SQLite de Playwright: todas las migraciones y el escenario
// de las pruebas del asistente (pedidos, fincas, productos). Lo corre el
// comando del servidor de la API antes de arrancarlo, para que la API nunca
// abra una base a medio crear.

import { rmSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createClient } from '@libsql/client';
import { DB_E2E } from './entorno.js';
import { migrarBaseTemporal, sembrar } from '../../../server/services/asistente/__tests__/escenario.js';

mkdirSync(dirname(DB_E2E), { recursive: true });
rmSync(DB_E2E, { force: true });
migrarBaseTemporal(DB_E2E);
const db = createClient({ url: `file:${DB_E2E}` });
await sembrar((sql, args = []) => db.execute({ sql, args }));
db.close();
console.log(`[e2e] Base del asistente lista en ${DB_E2E}`);
