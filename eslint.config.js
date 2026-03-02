// ESLint flat config — compatible con ESM y Node.js 20+
// Docs: https://eslint.org/docs/latest/use/configure/configuration-files-new

import js from '@eslint/js';

export default [
  // Configuración base recomendada de ESLint
  js.configs.recommended,

  {
    // Aplicar a todo el código JavaScript del proyecto (no node_modules ni dist)
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ignores: [
      'node_modules/**',
      'dist/**',
      '.vercel/**',
      'public/assets/js/admin.js', // Legado — refactorizar en fase futura
    ],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Globals de Node.js
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        // Globals de Vitest (cuando globals: true en vitest.config.js)
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },

    rules: {
      // ── Posibles errores ──────────────────────────────────────────────────
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off', // Permitir console en servidor Express

      // ── Estilo de código ──────────────────────────────────────────────────
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['warn', 'multi-line'],

      // ── ESM / módulos ─────────────────────────────────────────────────────
      // (No se permite require() — el proyecto usa ESM exclusivamente)
      'no-restricted-globals': [
        'error',
        { name: 'require', message: 'Usa import/export (ESM). No usar require().' },
        { name: 'module', message: 'Usa export. No usar module.exports.' },
      ],
    },
  },

  // Reglas relajadas para archivos de test
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', 'tests/**/*.js'],
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
