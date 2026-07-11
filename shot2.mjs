import { chromium } from 'playwright';

const browser = await chromium.launch();
const pages = [
  { url: 'http://localhost:4321/', name: 'home-desktop', width: 1440, height: 1200 },
  { url: 'http://localhost:4321/tienda', name: 'tienda-desktop', width: 1440, height: 1200 },
  { url: 'http://localhost:4321/terminos', name: 'terminos-desktop', width: 1440, height: 1200 },
];

for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(p.url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/ae6ed510-dca4-46d0-80d8-d24097e041fb/scratchpad/${p.name}.png` });
  if (errors.length) console.log(p.name, 'ERRORS:', errors);
  await page.close();
}
await browser.close();
console.log('done');
