import { chromium } from 'playwright';
const base = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
// seed cart so the full layout (Ir a pagar) renders
await p.addInitScript(() => {
  localStorage.setItem('dy_cart', JSON.stringify([{ id:'1', name:'Café Test', price:45000, qty:2, image:'' }]));
});
await p.goto(base + '/cart', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/cart-full.png', fullPage: true });
// computed styles of the checkout + primary buttons
const data = await p.evaluate(() => {
  const out = {};
  for (const sel of ['#checkoutBtn', '.btn-primary', '#cmbCheckoutBtn']) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = 'NOT FOUND'; continue; }
    const cs = getComputedStyle(el);
    const textEl = el.querySelector('span') || el;
    out[sel] = { color: cs.color, bg: cs.backgroundColor, textColor: getComputedStyle(textEl).color };
  }
  out['--coffee'] = getComputedStyle(document.documentElement).getPropertyValue('--coffee');
  return out;
});
console.log(JSON.stringify(data, null, 2));
// now empty cart
await p.evaluate(() => localStorage.removeItem('dy_cart'));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/cart-empty.png' });
await b.close();
