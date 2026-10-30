// Export blueprint sheets (or crops) as PNGs for review.
//   node scripts/sheets.mjs SEED outdir [sheetIndex x0 y0 x1 y1 (mm)]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [seed, outDir, idx, x0, y0, x1, y1] = process.argv.slice(2);
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = path.join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://localhost:5233/blueprint.html?seed=${seed}`);
await page.waitForFunction(() => document.querySelectorAll('canvas.sheet').length === 7, null, { timeout: 30000 });
fs.mkdirSync(outDir, { recursive: true });
const shots = await page.evaluate(({ idx, crop }) => {
  const cs = [...document.querySelectorAll('canvas.sheet')];
  const list = idx != null ? [cs[idx]] : cs;
  return list.map((c, i) => {
    if (!crop) {
      const t = document.createElement('canvas'); t.width = 1800; t.height = Math.round(1800 * c.height / c.width);
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      return t.toDataURL('image/png');
    }
    const px = c.width / 841;
    const [a, b, d, e] = crop.map((v) => v * px);
    const t = document.createElement('canvas'); t.width = d - a; t.height = e - b;
    t.getContext('2d').drawImage(c, a, b, d - a, e - b, 0, 0, d - a, e - b);
    return t.toDataURL('image/png');
  });
}, { idx: idx != null ? +idx : null, crop: x0 != null ? [+x0, +y0, +x1, +y1] : null });
shots.forEach((d, i) => fs.writeFileSync(path.join(outDir, `sheet-${idx ?? i}${x0 != null ? `-crop` : ''}.png`), Buffer.from(d.split(',')[1], 'base64')));
console.log('wrote', shots.length);
await browser.close();
