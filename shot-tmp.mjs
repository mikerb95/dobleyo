import { chromium, devices } from '@playwright/test';
const OUT = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/31bc8869-4781-4da4-9401-db83b0abc1b8/scratchpad';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/trazabilidad?lote=LOTE-HUI-2026-01', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
// Ocultar overlays ajenos a la feature (sin interactuar con el consentimiento)
await p.evaluate(() => {
  document.getElementById('langSuggest')?.remove();
  document.querySelectorAll('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="whatsapp" i],[id*="whatsapp" i]')
    .forEach(el => el.remove());
});
await p.waitForTimeout(400);
await p.locator('#resFarmerCard').screenshot({ path: `${OUT}/qr-farmer-390.png` });
await p.locator('#resFarmerCard').scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/qr-viewport-390.png` });
console.log('ok');
await b.close();
