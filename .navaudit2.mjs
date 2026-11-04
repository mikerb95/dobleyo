import { chromium } from 'playwright';
const OUT = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/2ce90b4a-7981-43b5-9c1c-44f9b0696bb0/scratchpad/shots';
const browser = await chromium.launch();
async function shot(name, w, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, javaScriptEnabled: opts.js !== false });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dy-lang-dismissed','1'); localStorage.setItem('dy-cookie-consent','1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4400' + (opts.path || '/'), { waitUntil: 'load' });
  await p.waitForTimeout(500);
  if (opts.scroll) { await p.mouse.wheel(0, opts.scroll); await p.waitForTimeout(600); }
  if (opts.menu) { await p.click('#menuBtn'); await p.waitForTimeout(500); }
  if (opts.eval) console.log(name, JSON.stringify(await p.evaluate(opts.eval)));
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: w, height: opts.h || 240 } });
  await ctx.close();
}
const probe = () => { const q = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  return { topbar: q('#topbar'), header: q('.site-header'), lang: q('.site-header .actions .lang-toggle'), search: q('#searchBtn'), user: q('#userNavBtn'), menu: q('.mobile-menu'), main: getComputedStyle(document.querySelector('main')).paddingTop, actions: q('.site-header .actions') }; };
await shot('nojs-375', 375, { js: false, eval: probe });
await shot('nojs-1280', 1280, { js: false, eval: probe });
await shot('scroll-375', 375, { scroll: 1200, eval: probe });
await shot('menu-375', 375, { menu: true, h: 500, eval: probe });
for (const w of [1025, 1100, 1180]) await shot('w-' + w, w, { eval: probe, h: 150 });
await shot('tienda-scroll-768', 768, { path: '/tienda', scroll: 500, eval: probe, h: 260 });
await browser.close();
