// ESLint flat config — compatible con ESM y Node.js 20+
// Docs: https://eslint.org/docs/latest/use/configure/configuration-files-new

import js from '@eslint/js';
import globals from 'globals';

export default [
    // Configuración base recomendada de ESLint
    js.configs.recommended,

    // ── Ignores globales ──────────────────────────────────────────────────────
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '.vercel/**',
            '.astro/**',
            'public/assets/js/admin.js', // Legado — refactorizar en fase futura
        ],
    },

    // ── Configuración base: código de servidor/Node (ESM) ─────────────────────
    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],

        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
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
            'no-empty': ['error', { allowEmptyCatch: true }],

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

    // ── Scripts del navegador (vanilla JS) y código cliente ───────────────────
    {
        files: ['public/assets/js/**/*.js', 'src/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },

    // ── Archivos de configuración CommonJS (Metro / Babel de la app móvil) ─────
    // Estas herramientas requieren CommonJS; no aplica la regla ESM-only.
    {
        files: ['apps/mobile/**/*.config.js', '**/babel.config.js', '**/metro.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-restricted-globals': 'off',
        },
    },

    // ── Reglas relajadas para archivos de test ────────────────────────────────
    {
        files: ['**/__tests__/**/*.js', '**/*.test.js', 'tests/**/*.js'],
        rules: {
            'no-unused-vars': 'warn',
        },
    },
];
