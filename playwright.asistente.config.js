// Playwright del asistente del panel: "usuario robot" que abre el panel en un
// navegador real, pregunta, aprueba y revisa la base. Cuesta US$0: usa el
// MODELO SIMULADO (ASISTENTE_MODELO_FALSO=1) y una base SQLite temporal, nunca
// Turso, Resend ni MercadoLibre de verdad.
//
//   npm run test:e2e:asistente

import { defineConfig, devices } from '@playwright/test';
import { DB_E2E, JWT_E2E, API_PORT, WEB_PORT } from './tests/e2e/asistente/entorno.js';

// Todo lo que pueda salir hacia fuera, apagado. dotenv no pisa variables ya definidas.
const entorno = {
  NODE_ENV: 'development',
  TURSO_DATABASE_URL: `file:${DB_E2E}`,
  TURSO_AUTH_TOKEN: '',
  DATABASE_URL: '',
  ASISTENTE_MODELO_FALSO: '1',
  ANTHROPIC_API_KEY: '',
  JWT_SECRET: JWT_E2E,
  JWT_REFRESH_SECRET: `${JWT_E2E}-refresh`,
  RESEND_API_KEY: '',
  ML_ACCESS_TOKEN: '',
  NTFY_URL: '',
  NTFY_TOPIC: '',
};

export default defineConfig({
  testDir: './tests/e2e/asistente',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tests/e2e/asistente/preparar-base.js && node server/index.js',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...entorno, START_SERVER: 'true', PORT: String(API_PORT) },
    },
    {
      // Astro detecta al agente de IA y fuerza el modo en segundo plano: se quitan esas variables.
      command: `env -u CLAUDECODE -u AI_AGENT -u CLAUDE_CODE_ENTRYPOINT npx astro dev --port ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...entorno, API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
