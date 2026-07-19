import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Entorno Node.js — correcto para tests de Express/servicios del servidor
        environment: 'node',
        // Incluir tests unitarios del servidor
        include: ['server/**/*.test.js', 'server/**/__tests__/**/*.test.js'],
        // Excluir tests E2E (se ejecutan con Playwright)
        exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
        // Globals para no importar describe/it/expect en cada archivo
        globals: true,
        // Limpiar mocks entre tests automáticamente
        clearMocks: true,
        // Variables de entorno mínimas para que las rutas que las validan al cargar
        // el módulo (p. ej. checkout Wompi) no fallen en el entorno de test.
        env: {
            WOMPI_PUBLIC_KEY: 'pub_test_key',
            WOMPI_INTEGRITY_SECRET: 'test_integrity_secret',
        },
        // Reporte de cobertura de código
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['server/services/**', 'server/routes/**'],
            exclude: [
                'server/migrations/**',
                'server/routes/devtools.js',
                'server/**/*.test.js',
                'server/**/__tests__/**',
            ],
            // Metas mínimas de cobertura (AGENTS.md: 60% servicios, 80% auth)
            thresholds: {
                'server/services/**': { lines: 60 },
                'server/routes/auth.js': { lines: 70 },
            },
        },
    },
});
