import { chromium } from 'playwright';

const browser = await chromium.launch();
const pages = [
  { url: 'http://localhost:4321/envios-devoluciones', name: 'es-desktop', width: 1440, height: 1400 },
  { url: 'http://localhost:4321/envios-devoluciones', name: 'es-mobile', width: 390, height: 1800 },
  { url: 'http://localhost:4321/en/shipping', name: 'en-desktop', width: 1440, height: 1400 },
];

for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height } });
  await page.goto(p.url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/ae6ed510-dca4-46d0-80d8-d24097e041fb/scratchpad/${p.name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log('done');
