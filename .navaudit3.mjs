import { chromium } from 'playwright';
const OUT = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/2ce90b4a-7981-43b5-9c1c-44f9b0696bb0/scratchpad/shots';
const browser = await chromium.launch();
const probe = () => { const q = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const msg = [...document.querySelectorAll('.topbar__msg')].find(e => e.offsetParent);
  return { tb: q('#topbar'), hd: q('.site-header'), brand: q('.site-header .brand'), nav: q('.site-header .nav'), act: q('.site-header .actions'), mainTop: getComputedStyle(document.querySelector('main')).paddingTop, trunc: msg ? msg.scrollWidth > msg.clientWidth : null, docW: document.documentElement.scrollWidth }; };
for (const js of [false, true]) for (const path of ['/', '/en', '/tienda']) for (const w of [320, 375, 768, 1024, 1025, 1100, 1280, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, javaScriptEnabled: js });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dy-lang-dismissed','1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4400' + path, { waitUntil: 'load' }); await p.waitForTimeout(300);
  const m = await p.evaluate(probe);
  const ok = m.tb[3] === m.hd[1] && parseInt(m.mainTop) >= m.hd[3] && m.docW === w;
  console.log(js ? 'js  ' : 'nojs', path.padEnd(7), String(w).padEnd(5), ok ? 'OK ' : 'BAD', JSON.stringify(m));
  if (path === '/' && [320, 375, 1025, 1280].includes(w)) await p.screenshot({ path: `${OUT}/after-${js?'js':'nojs'}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 170 } });
  await ctx.close();
}
// Cierre + navegación
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('dy-lang-dismissed','1'); } catch {} });
const p = await ctx.newPage();
await p.goto('http://localhost:4400/', { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.click('#topbarClose'); await p.waitForTimeout(500);
console.log('closed', JSON.stringify(await p.evaluate(probe)));
await p.click('.site-header .brand'); 
await p.goto('http://localhost:4400/tienda', { waitUntil: 'load' }); await p.waitForTimeout(400);
console.log('closed+nav', JSON.stringify(await p.evaluate(probe)));
await p.screenshot({ path: `${OUT}/after-closed-375.png`, clip: { x: 0, y: 0, width: 375, height: 170 } });
await browser.close();
