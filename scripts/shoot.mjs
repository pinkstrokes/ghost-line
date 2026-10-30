// Headless screenshot helper for visual QA.
//   node scripts/shoot.mjs '<url>' out.png [width] [height] [waitMs] ['js to eval after load'] ['js before shot']
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, out, w = '1600', h = '1000', wait = '2500', js1 = '', js2 = ''] = process.argv.slice(2);
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = path.join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js1) { const r = await page.evaluate(js1); if (r !== undefined) console.log("js1:", typeof r === "string" ? r : JSON.stringify(r)); await page.waitForTimeout(+(process.env.WAIT2 || 3500)); }
if (js2) { const r = await page.evaluate(js2); if (r !== undefined) console.log('js2:', typeof r === 'string' ? r : JSON.stringify(r)); await page.waitForTimeout(400); }
await page.screenshot({ path: out });
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await browser.close();
