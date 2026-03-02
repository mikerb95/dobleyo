// Playwright E2E test configuration
// Docs: https://playwright.dev/docs/test-configuration

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directorio con los tests E2E
  testDir: './tests/e2e',

  // Timeout por test: 30 segundos
  timeout: 30_000,

  // Retries en CI para evitar fallos por flakiness
  retries: process.env.CI ? 2 : 0,

  // Workers: paralelo en CI, secuencial en local
  workers: process.env.CI ? 1 : undefined,

  // Reporter: HTML para uso local, lista para CI
  reporter: process.env.CI ? 'list' : [['html', { open: 'never' }]],

  use: {
    // URL base del servidor de desarrollo de Astro
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321',
    // Snapshot en fallos para debugging
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  // Proyectos (navegadores): solo Chromium para CI (más rápido)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox y Safari se pueden habilitar en local con: npx playwright test --project=firefox
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'safari',  use: { ...devices['Desktop Safari']  } },
  ],

  // Iniciar el servidor de desarrollo antes de los tests E2E
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
