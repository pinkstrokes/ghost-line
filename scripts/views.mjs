// Staged screenshots of both roles in practice zones (visual QA).
//   node scripts/views.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5233';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'ghostline-views');
fs.mkdirSync(OUT, { recursive: true });
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = path.join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: exe });
const A = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const B = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await A.goto(`${BASE}/?host=agent&name=GHOST`);
await A.waitForFunction(() => __gl.code);
const code = await A.evaluate(() => __gl.code);
await B.goto(`${BASE}/?room=${code}&role=handler&name=LINE`);
await B.waitForFunction(() => __gl.state?.players?.agent);

async function scene(name, zone, agentFn, handlerFn, wait = 3500) {
  await A.evaluate(() => __gl.net.send({ t: 'lobby' }));
  await sleep(400);
  await A.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await B.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await sleep(200);
  await A.evaluate((z) => __gl.net.send({ t: 'start', practice: z }), zone);
  await A.waitForFunction(() => __gl.game && __gl.state.phase === 'playing');
  await B.waitForFunction(() => __gl.game && __gl.state.phase === 'playing');
  await sleep(4500); // intro card
  await A.evaluate(agentFn);
  await B.evaluate(handlerFn);
  await sleep(wait);
  await A.screenshot({ path: path.join(OUT, `${name}-ghost.png`) });
  await B.screenshot({ path: path.join(OUT, `${name}-line.png`) });
  console.log('shot', name);
}

await scene('hall', 'lasers',
  () => { const v = __gl.game.view; v.pos.set(-0.5, 0, -6.6); v.yaw = 0; v.pitch = 0; v.crouching = false; },
  () => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 2; v.cctv.cams[2].ir = false; v.cctv.cams[1].ir = true; v.slots = [1, 0, 3, 4]; }, 300); });
await B.evaluate(() => { __gl.game.view.cctv.cams[2].ir = true; });
await sleep(1500);
await B.screenshot({ path: path.join(OUT, 'hall-line-ir.png') });
await scene('spine', 'escape',
  () => { const v = __gl.game.view; v.pos.set(1.2, 0, -64.2); v.yaw = -Math.PI / 2 - 0.5; v.pitch = 0; },
  () => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 7; v.cctv.cams[7].ir = true; v.cctv.cams[8].ir = true; v.slots = [8, 9, 6, 0]; }, 300); });
await scene('maze', 'maze',
  () => { const v = __gl.game.view; v.pos.set(-10.5, 0, -33); v.yaw = Math.PI / 2; v.pitch = 0; },
  () => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 4; v.cctv.cams[4].ir = false; }, 300); });
if (errs.length) console.log('errors:', errs.slice(0, 5));
await browser.close();
