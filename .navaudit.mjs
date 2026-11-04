import { chromium } from 'playwright';
const OUT = '/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/2ce90b4a-7981-43b5-9c1c-44f9b0696bb0/scratchpad/shots';
const widths = [320, 375, 414, 768, 900, 1024, 1025, 1280, 1440];
const pages = (process.argv[2] || '/,/tienda,/en').split(',');
const browser = await chromium.launch();
for (const path of pages) for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const p = await ctx.newPage();
  // Medir antes de que corra JS (primer paint) y después
  await p.goto('http://localhost:4400' + path, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) }; };
    const main = document.querySelector('main'); const first = main?.firstElementChild;
    const cs = getComputedStyle(document.documentElement);
    const nav = document.querySelector('.site-header .nav');
    const navOverflow = nav ? nav.scrollWidth > nav.clientWidth : null;
    const hc = document.querySelector('.site-header .container');
    return {
      topbar: r('#topbar'), header: r('.site-header'), cont: hc && { sw: hc.scrollWidth, cw: hc.clientWidth },
      nav: r('.site-header .nav'), navOverflow, actions: r('.site-header .actions'), brand: r('.site-header .brand'),
      mainPadTop: main && getComputedStyle(main).paddingTop, firstChild: first && r('main > *:first-child'),
      vars: ['--header-top','--header-height','--page-offset-top'].map(v => document.documentElement.style.getPropertyValue(v)),
      docW: document.documentElement.scrollWidth,
    };
  });
  console.log(path, w, JSON.stringify(m));
  await p.screenshot({ path: `${OUT}/${path.replace(/\//g,'_')||'home'}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 260 } });
  await ctx.close();
}
await browser.close();
