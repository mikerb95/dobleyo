import { chromium, devices } from '@playwright/test';
const OUT = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/31bc8869-4781-4da4-9401-db83b0abc1b8/scratchpad';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });   // 390x844
const p = await ctx.newPage();
await p.goto('http://localhost:4321/trazabilidad?lote=LOTE-HUI-2026-01', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.evaluate(() => document.getElementById('langSuggest')?.remove());
await p.waitForTimeout(300);

// Tarjeta del caficultor sola
await p.locator('#resFarmerCard').screenshot({ path: `${OUT}/qr-farmer-390.png` });

// Contexto: hero + caficultor (lo que se ve al llegar por QR y bajar un poco)
await p.locator('#resFarmerCard').scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/qr-viewport-390.png` });

// Página completa del resultado
await p.screenshot({ path: `${OUT}/qr-full-390.png`, fullPage: true });

const bx = await p.locator('#resFarmerCard').boundingBox();
console.log('ancho tarjeta:', bx.width, '| alto:', Math.round(bx.height));
await b.close();
