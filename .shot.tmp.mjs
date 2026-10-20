import { chromium } from 'playwright';
const S = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/brave.com/brave/brave' });
async function run(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => { localStorage.setItem('dy_cookie_consent', 'all'); localStorage.setItem('dy-lang-pref', 'es'); });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const top = await page.evaluate(() => document.querySelector('#viaje').getBoundingClientRect().top + scrollY);
  for (const [i, off] of steps.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), top + off);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${S}/${name}-${i}.png` });
  }
  await ctx.close();
}
await run('desk', { width: 1440, height: 900 }, [-150, 500, 1150, 1800, 2500]);
await run('mob', { width: 390, height: 844 }, [-80, 700, 1400]);
await browser.close();
