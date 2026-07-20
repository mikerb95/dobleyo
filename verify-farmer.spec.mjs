import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4321';
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// ── Caso 1: lote CON finca publicada (deep-link ?lote=) ──────────────
await page.goto(`${BASE}/trazabilidad?lote=LOTE-HUI-2026-01`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const card = page.locator('#resFarmerCard');
console.log('--- CASO 1: finca publicada (deep-link QR) ---');
console.log('tarjeta visible:', await card.isVisible());
console.log('nombre caficultor:', await page.locator('.trace-farmer-name').textContent().catch(() => null));
console.log('lugar:', await page.locator('.trace-farmer-place').textContent().catch(() => null));
const intro = await page.locator('.trace-farmer-intro').textContent().catch(() => null);
console.log('intro:', intro?.slice(0, 90) + '...');
const href = await page.locator('#resFarmerBody a.btn').getAttribute('href').catch(() => null);
console.log('href enlace:', href);
console.log('texto enlace:', await page.locator('#resFarmerBody a.btn').textContent().catch(() => null));
const img = page.locator('.trace-farmer-photo');
console.log('foto presente:', await img.count() > 0, '| alt:', await img.getAttribute('alt').catch(() => null));
console.log('foto cargó (naturalWidth>0):', await img.evaluate(el => el.naturalWidth > 0).catch(() => 'n/a'));
// posición: foto a la izquierda del texto en desktop
const bxImg = await img.boundingBox().catch(() => null);
const bxInfo = await page.locator('.trace-farmer-info').boundingBox().catch(() => null);
console.log('desktop layout foto-izquierda:', bxImg && bxInfo ? bxImg.x < bxInfo.x && Math.abs(bxImg.y - bxInfo.y) < 60 : 'n/a');
// orden en el DOM: tarjeta entre hero y timeline
console.log('orden DOM (hero < caficultor < timeline):', await page.evaluate(() => {
  const hero = document.querySelector('.trace-hero-card');
  const farmer = document.querySelector('#resFarmerCard');
  const tl = document.querySelector('#resTimeline');
  const pos = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  return !!(pos(hero, farmer) && pos(farmer, tl));
}));

// ── Responsive 480 y 768 ─────────────────────────────────────────────
for (const w of [480, 768]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(400);
  const i = await page.locator('.trace-farmer-photo').boundingBox();
  const t = await page.locator('.trace-farmer-info').boundingBox();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`@${w}px → apilado(foto encima):`, i && t ? i.y + i.height <= t.y + 5 : 'n/a',
    '| ancho foto:', i?.width, '| overflow horizontal:', overflow);
}

// ── Caso 2: lote SIN finca publicada ─────────────────────────────────
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/trazabilidad?lote=COL-CAU-1750-BOB-HUM-E807`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('\n--- CASO 2: sin finca publicada ---');
console.log('tarjeta oculta:', !(await page.locator('#resFarmerCard').isVisible()));
console.log('resto del resultado sigue:', await page.locator('#resTimeline .trace-timeline-item').count(), 'etapas en timeline');
console.log('nombre del lote:', await page.locator('#resName').textContent());

// ── Caso 3: búsqueda manual encadenada (con finca → sin finca) ───────
await page.fill('#lotInput', 'LOTE-NAR-2026-01').catch(() => {});
await page.locator('#lotInput').press('Enter').catch(() => {});
await page.waitForTimeout(2500);
console.log('\n--- CASO 3: búsqueda manual tras un lote sin finca ---');
console.log('tarjeta reaparece:', await page.locator('#resFarmerCard').isVisible());
console.log('caficultor:', await page.locator('.trace-farmer-name').textContent().catch(() => null));
console.log('href:', await page.locator('#resFarmerBody a.btn').getAttribute('href').catch(() => null));

// ── Caso 4: navegar al enlace de la finca ────────────────────────────
await page.evaluate(() => document.getElementById('langSuggest')?.remove());
await page.locator('#resFarmerBody a.btn').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
console.log('\n--- CASO 4: navegación a /finca/[slug] ---');
console.log('URL:', page.url());
console.log('título h1:', await page.locator('h1').first().textContent().catch(() => null));

console.log('\n=== ERRORES DE CONSOLA ===');
console.log(errors.length ? errors.join('\n') : '(ninguno)');

await browser.close();
