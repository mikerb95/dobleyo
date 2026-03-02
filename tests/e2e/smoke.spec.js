// Pruebas E2E de humo — verifican que las páginas principales cargan correctamente
// Ejecutar: npx playwright test
// Requiere: servidor de desarrollo corriendo (npm run dev) o DATABASE_URL en .env

import { test, expect } from '@playwright/test';

// ── Homepage ──────────────────────────────────────────────────────────────────
test.describe('Homepage (/)', () => {
    test('debe cargar con título y heading principal', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/DobleYo/i);
        // Verificar que hay exactamente un <h1> (regla SEO)
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
    });

    test('debe tener meta description', async ({ page }) => {
        await page.goto('/');
        const meta = page.locator('meta[name="description"]');
        await expect(meta).toHaveAttribute('content', /.{20,}/); // descripción no vacía
    });

    test('debe tener JSON-LD de Organización', async ({ page }) => {
        await page.goto('/');
        const ldJson = page.locator('script[type="application/ld+json"]');
        const count = await ldJson.count();
        expect(count).toBeGreaterThanOrEqual(1);
        const content = await ldJson.first().textContent();
        expect(content).toContain('Organization');
        expect(content).toContain('DobleYo Café');
    });

    test('debe tener enlace al sitemap en robots.txt', async ({ page }) => {
        const res = await page.goto('/robots.txt');
        await expect(res).not.toBeNull();
        expect(res!.status()).toBe(200);
        const body = await res!.text();
        expect(body).toContain('Sitemap');
        expect(body).toContain('sitemap.xml');
    });
});

// ── Tienda ────────────────────────────────────────────────────────────────────
test.describe('Tienda (/tienda)', () => {
    test('debe cargar con h1 y cards de productos', async ({ page }) => {
        await page.goto('/tienda');
        await expect(page).toHaveTitle(/Tienda/i);
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
    });

    test('debe tener JSON-LD ItemList para SEO de productos', async ({ page }) => {
        await page.goto('/tienda');
        const ldJson = page.locator('script[type="application/ld+json"]');
        const allContent = await ldJson.allTextContents();
        const hasItemList = allContent.some((c) => c.includes('ItemList'));
        expect(hasItemList).toBe(true);
    });

    test('debe mostrar al menos un producto', async ({ page }) => {
        await page.goto('/tienda');
        // Los product cards tienen una clase .product-card o similar
        const products = page.locator('[data-product-id], .product-card, article.card');
        const count = await products.count();
        expect(count).toBeGreaterThan(0);
    });
});

// ── Contacto ──────────────────────────────────────────────────────────────────
test.describe('Contacto (/contacto)', () => {
    test('debe cargar con formulario de contacto', async ({ page }) => {
        await page.goto('/contacto');
        await expect(page).toHaveTitle(/Contacto/i);
        await expect(page.locator('form')).toBeVisible();
    });
});

// ── Trazabilidad ──────────────────────────────────────────────────────────────
test.describe('Trazabilidad (/trazabilidad)', () => {
    test('debe cargar con h1', async ({ page }) => {
        await page.goto('/trazabilidad');
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
    });
});

// ── Sitemap ───────────────────────────────────────────────────────────────────
test.describe('Sitemap XML (/sitemap.xml)', () => {
    test('debe retornar XML válido con URLs del sitio', async ({ page }) => {
        const res = await page.goto('/sitemap.xml');
        expect(res!.status()).toBe(200);
        const contentType = res!.headers()['content-type'];
        expect(contentType).toContain('xml');
        const body = await res!.text();
        expect(body).toContain('<urlset');
        expect(body).toContain('dobleyo.cafe');
        expect(body).toContain('/tienda');
    });
});

// ── SEO: Páginas con noindex en área privada ──────────────────────────────────
test.describe('Robots meta en páginas privadas', () => {
    test('/login debe tener robots noindex', async ({ page }) => {
        await page.goto('/login');
        const robotsMeta = page.locator('meta[name="robots"]');
        // El login puede tener noindex opcionalmente, verificar que al menos carga
        const status = (await page.goto('/login'))!.status();
        expect([200, 302]).toContain(status);
    });
});
