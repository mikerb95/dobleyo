// Valores compartidos por la configuración de Playwright del asistente, la
// preparación de la base y las pruebas.

import { join } from 'path';

export const DB_E2E = join(process.cwd(), 'tests/e2e/.tmp/asistente.db');
export const JWT_E2E = 'secreto-solo-para-playwright-del-asistente-0123456789';
export const API_PORT = 4107;
export const WEB_PORT = 4337;
