import { chromium } from 'playwright';
const SP = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/2cc3b95f-6590-42a9-9a87-ce49999c4502/scratchpad';
const base = 'http://localhost:4330';
const [,, mode = 'board', width = '1440', height = '1000', extra = ''] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +width, height: +height }, locale: 'es-CO' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const login = await ctx.request.post(base + '/api/auth/login', { data: { email: 'mike.flujo@local.test', password: 'Prueba-Flujo-2026' } });
console.log('login', login.status());
const url = mode === 'lot' ? base + '/admin/produccion?lote=' + extra : base + '/admin/produccion';
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
if (mode === 'sheet') {
  await page.getByRole('button', { name: extra, exact: true }).first().click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: SP + '/shot-' + mode + '-' + width + '.png', fullPage: mode !== 'sheet' });
console.log(errors.join('\n') || 'sin errores');
await browser.close();
