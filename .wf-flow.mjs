import { chromium } from 'playwright';
const SP = process.env.SP;
const base = 'http://localhost:4330';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-CO' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await ctx.request.post(base + '/api/auth/login', { data: { email: 'mike.flujo@local.test', password: 'Prueba-Flujo-2026' } });
await page.goto(base + '/admin/produccion', { waitUntil: 'networkidle' });

// 1) Recibir de la maquila el lote atrasado (Nariño)
await page.getByRole('button', { name: 'Registrar recepción', exact: true }).first().click();
await page.fill('#rr-kg', '93');
await page.waitForTimeout(300);
await page.screenshot({ path: SP + '/flow-1-receive.png' });
await page.getByText('Medio', { exact: true }).click();
await page.locator('label:has-text("ROASTED-B-01")').click();
await page.getByRole('button', { name: 'Registrar recepción', exact: true }).last().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: SP + '/flow-2-done.png' });

// 2) Desde el cierre, seguir con el siguiente paso sugerido
const next = page.locator('[class*="nextCard"] button');
console.log('siguiente sugerido:', await next.count() ? await next.innerText() : '(ninguno)');
console.log(errors.join('\n') || 'sin errores');
await browser.close();
