// Visual QA for the design-review changes (booth SOP, optics lamps, patch lamps, spine Listener, knockdown).
//   node scripts/qa-new.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'ghostline-qa');
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
const shot = async (p, n) => { await p.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };

async function start(zone) {
  await A.evaluate(() => __gl.net.send({ t: 'lobby' }));
  await sleep(400);
  await A.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await B.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await sleep(200);
  await A.evaluate((z) => __gl.net.send({ t: 'start', practice: z }), zone);
  await A.waitForFunction(() => __gl.game && __gl.state.phase === 'playing');
  await B.waitForFunction(() => __gl.game && __gl.state.phase === 'playing');
  await sleep(4500);
}
const inspectByLabel = (lbl) => A.evaluate((lbl) => {
  const v = __gl.game.view, w = __gl.game.world;
  const it = w.hitGroup.children.map((h) => h.userData.interactable).find((i) => i && (typeof i.label === 'function' ? i.label() : i.label) === lbl);
  v.enterInspect(it);
}, lbl);

// 1. guard booth SOP
await start('gate');
await A.evaluate(() => { const v = __gl.game.view; v.pos.set(-8.05, 0, 7.6); v.yaw = 0; v.pitch = -0.05; });
await sleep(1500); await shot(A, '01-booth');
await inspectByLabel('READ NOTICE'); await sleep(1500); await shot(A, '01-booth-sop');

// 2. optics: GHOST sees blinking lamps + port numbers; LINE IR ceiling cam
await start('optics');
const rc = await A.evaluate(() => __gl.mission.optics.receivers);
console.log('receivers', JSON.stringify(rc));
await A.evaluate((rc) => {
  const v = __gl.game.view; const r = rc.find((x) => x.side === 'N');
  v.pos.set(-32 + r.idx + 0.5, 0, -61.6); v.yaw = 0; v.pitch = -0.25; v.flashOn = true;
}, rc);
await B.evaluate(() => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 5; v.cctv.cams[5].ir = true; }, 300); });
await sleep(2200); await shot(A, '02-optics-ghost'); await shot(B, '02-optics-line-ir');

// 3. patch: one right cable, breaker trips, continuity lamps
await start('patch');
const P = await A.evaluate(() => __gl.mission.patch);
const sol = P.solution[0];
await A.evaluate(({ sol, P }) => {
  __gl.game.world.act({ k: 'plug', color: sol.color, end: 0, socket: `T${P.topOrder.indexOf(sol.glyph)}` });
  __gl.game.world.act({ k: 'plug', color: sol.color, end: 1, socket: `B${P.bottomOrder.indexOf(sol.number)}` });
}, { sol, P });
await sleep(3200);
await B.evaluate(() => __gl.game.world.act({ k: 'breaker' }));
await sleep(1500);
await inspectByLabel(await A.evaluate(() => { const w = __gl.game.world; const it = w.hitGroup.children.map((h) => h.userData.interactable).find((i) => i && i.zone === 'patch' && i.inspect); return typeof it.label === 'function' ? it.label() : it.label; }));
await sleep(1800); await shot(A, '03-patch-lamps');

// 4. knockdown seen from the van (laser trip)
await start('lasers');
await B.evaluate(() => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 2; v.cctv.cams[2].ir = true; }, 300); });
await sleep(1200);
const beam = await A.evaluate(() => { const g = __gl.mission.lasers.gates.find((g) => g.type === 'wall'); return g.beams[0]; });
await A.evaluate((b) => { const v = __gl.game.view; v.pos.set(b.x, 0, b.z + 0.8); v.yaw = 0; }, beam);
await sleep(600);
await A.evaluate((b) => { const v = __gl.game.view; v.pos.set(b.x, 0, b.z); }, beam);
await sleep(800); await shot(A, '04-knock-ghost'); await shot(B, '04-knock-line');

// 5. the spine Listener (appears 45 s into the lockdown)
await start('escape');
await A.evaluate(() => { const v = __gl.game.view; v.pos.set(1.6, 0, -65); v.yaw = Math.PI / 2; v.pitch = 0; });
await B.evaluate(() => { const v = __gl.game.view; v.setFocus('monitors'); v.pinned = true; setTimeout(() => { v.mainIdx = 7; v.cctv.cams[7].ir = true; }, 300); });
await A.waitForFunction(() => __gl.state.lockdown.stalker, null, { timeout: 70000 });
// LINE talks loudly on the radio: the Listener comes
await A.evaluate(() => { const v = __gl.game.view; v.voice = { inLevel: 0.3, level: 0, tx: false }; });
await sleep(6000); await shot(B, '05-stalker-line-thermal'); await shot(A, '05-stalker-ghost');
console.log('stalker', JSON.stringify(await A.evaluate(() => __gl.state.lockdown.stalker)), 'strikes', await A.evaluate(() => __gl.state.strikes));
await sleep(6000); await shot(A, '05-stalker-ghost-later'); await shot(B, '05-stalker-line-later');
console.log('strikes', await A.evaluate(() => __gl.state.strikes));
if (errs.length) console.log('errors:', errs.slice(0, 5));
await browser.close();
