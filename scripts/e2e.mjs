// Two-browser end-to-end run: GHOST and LINE join one room over the real websocket server and
// solve every zone using only actions a player could send. Screenshots land in OUT.
//   node scripts/e2e.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5233';
const OUT = process.argv[3] || path.join(os.tmpdir(), 'ghostline-e2e');
fs.mkdirSync(OUT, { recursive: true });
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const dir = fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = path.join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
const A = await ctxA.newPage(), Bp = await ctxB.newPage();
const errors = [];
for (const [n, p] of [['GHOST', A], ['LINE', Bp]]) {
  p.on('pageerror', (e) => errors.push(`${n} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${n} console: ${m.text()}`); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (t) => console.log(`\n▶ ${t}`);
const state = (p) => p.evaluate(() => __gl.state && { phase: __gl.state.phase, objective: __gl.state.objective, strikes: __gl.state.strikes, doors: __gl.state.doors });
const act = (p, a) => p.evaluate((a) => __gl.net.send({ t: 'act', a }), a);
const shot = async (p, name) => { await p.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log(`  📷 ${name}.png`); };
async function waitFor(p, fn, arg, label, ms = 15000) {
  const t0 = Date.now();
  for (;;) {
    if (await p.evaluate(fn, arg)) return true;
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${label}`);
    await sleep(150);
  }
}
const tp = (p, x, z, yaw = 0, pitch = 0) => p.evaluate(([x, z, yaw, pitch]) => { const v = __gl.game.view; v.pos.set(x, 0, z); v.vel.set(0, 0, 0); v.yaw = yaw; v.pitch = pitch; }, [x, z, yaw, pitch]);

try {
  step('GHOST hosts, LINE joins');
  await A.goto(`${BASE}/?host=agent&name=GHOST`);
  await waitFor(A, () => !!(__gl.code && __gl.state), null, 'room created');
  const code = await A.evaluate(() => __gl.code);
  console.log('  room', code);
  await Bp.goto(`${BASE}/?room=${code}&role=handler&name=LINE`);
  await waitFor(Bp, () => __gl.role === 'handler' && __gl.state?.players?.agent?.connected, null, 'LINE joined');
  await shot(A, '00-lobby');
  await A.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await Bp.evaluate(() => __gl.net.send({ t: 'ready', v: true }));
  await sleep(300);
  await A.evaluate(() => __gl.net.send({ t: 'start' }));
  await waitFor(A, () => __gl.game && __gl.state.phase === 'playing', null, 'GHOST in game');
  await waitFor(Bp, () => __gl.game && __gl.state.phase === 'playing', null, 'LINE in game');
  const m = await A.evaluate(() => {
    const m = __gl.mission;
    return { gate: m.gate.code, patch: m.patch, optics: { init: m.optics.init, ref: m.optics.reference }, vault: m.vault, lock: m.lockdown.doors, maze: m.maze.dampers };
  });
  const mB = await Bp.evaluate(() => __gl.mission.gate.code);
  console.log(`  seeds agree: ${m.gate === mB}  (code ${m.gate})`);
  await sleep(1500);

  step('Z1 gatehouse: one wrong code, then the right one');
  await tp(A, 1.4, 1.6, 0, -0.1);
  for (const k of ['0', '0', '0', '0', 'ENT']) await act(A, { k: 'key', v: k });
  await sleep(400);
  console.log('  after wrong code', await state(A));
  for (const k of [...m.gate, 'ENT']) await act(A, { k: 'key', v: k });
  await waitFor(A, () => __gl.state.doors.A === 1, null, 'door A open');
  await sleep(1500);
  await shot(Bp, '01-line-cam01');
  await shot(A, '01-ghost-door');

  step('Z2 laser hall: trip a beam on purpose, then walk out');
  await tp(A, 0, -1.5, 0, 0);
  await Bp.evaluate(() => { const v = __gl.game.view; v.setFocus('monitors'); v.mainIdx = 2; v.cctv.cams[2].ir = true; v.cctv.cams[1].ir = true; });
  await sleep(1500);
  await shot(Bp, '02-line-ir-hall');
  await shot(A, '02-ghost-hall');
  const before = (await state(A)).strikes;
  const beam = await A.evaluate(() => { const g = __gl.mission.lasers.gates.find((g) => g.type === 'wall'); return g.beams[0]; });
  await tp(A, beam.x, beam.z, 0, 0);
  await waitFor(A, (n) => __gl.state.strikes > n, before, 'laser strike');
  await sleep(900);
  console.log('  after trip', await state(A));
  await tp(A, 0, -28.5, 0, 0);
  await waitFor(A, () => __gl.state.objective === 'patch', null, 'objective -> patch');

  step('Z3 substation: wrong breaker attempt, then the right patch');
  await Bp.evaluate(() => __gl.game.view.unfocus());
  await act(Bp, { k: 'breaker' });
  await sleep(3200);
  const P = m.patch;
  for (const sol of P.solution) {
    const t = `T${P.topOrder.indexOf(sol.glyph)}`, b = `B${P.bottomOrder.indexOf(sol.number)}`;
    await act(A, { k: 'plug', color: sol.color, end: 0, socket: t });
    await act(A, { k: 'plug', color: sol.color, end: 1, socket: b });
  }
  await tp(A, 4.6, -33, -Math.PI / 2, 0);
  await sleep(600);
  await A.evaluate(() => { const v = __gl.game.view; v.enterInspect(__gl.game.world.interactables.find((i) => i.zone === 'patch')); });
  await sleep(2500);
  await shot(A, '03-ghost-patched');
  await act(Bp, { k: 'breaker' });
  await waitFor(A, () => __gl.state.patch.power === 1, null, 'power on');
  await A.evaluate(() => __gl.game.view.exitInspect());
  console.log('  after power', await state(A));
  await Bp.evaluate(() => { const v = __gl.game.view; v.setFocus('terminal'); v.terminal.prog = 'power'; });
  await sleep(1500);
  await shot(Bp, '03-line-terminal');

  step('Z4 undercroft: dampers (budget 2) + walk through');
  const ids = m.maze.map((d) => d.id);
  await act(Bp, { k: 'damper', id: ids[0], open: true });
  await act(Bp, { k: 'damper', id: ids[1], open: true });
  await act(Bp, { k: 'damper', id: ids[2], open: true }); // denied: over budget
  await sleep(500);
  const open = await Bp.evaluate(() => Object.values(__gl.state.maze.dampers).filter(Boolean).length);
  console.log(`  dampers open after 3 requests: ${open} (budget 2)`);
  await tp(A, -10.5, -33, Math.PI / 2, 0);
  await sleep(2000);
  await Bp.evaluate(() => { const v = __gl.game.view; v.terminal.prog = 'sensors'; });
  await sleep(1200);
  await shot(Bp, '04-line-sensors');
  await shot(A, '04-ghost-tunnel');
  await tp(A, -26, -50, 0, 0);
  await waitFor(A, () => __gl.state.objective === 'optics', null, 'objective -> optics');

  step('Z5 optics: rotate mirrors to the reference solution');
  await Bp.evaluate(() => { const v = __gl.game.view; v.unfocus(); setTimeout(() => { v.setFocus('monitors'); v.mainIdx = 5; v.cctv.cams[5].ir = true; }, 400); });
  await sleep(1800);
  await shot(Bp, '05-line-optics-before');
  const { init, ref } = m.optics;
  for (let i = 0; i < ref.length; i++) {
    if (ref[i] < 0) continue;
    let d = (ref[i] - init[i] + 8) % 8;
    const dir = d <= 4 ? 1 : -1;
    const n = d <= 4 ? d : 8 - d;
    for (let k = 0; k < n; k++) await act(A, { k: 'rotate', m: i, d: dir });
  }
  await waitFor(A, () => __gl.state.optics.done === 1, null, 'optics solved');
  await sleep(1500);
  await shot(Bp, '05-line-optics-solved');

  step('Z6 vault: dial each wheel past its gate in the right direction, SET, handle, take');
  await tp(A, -11, -59.6, 0, 0);
  await Bp.evaluate(() => { const v = __gl.game.view; v.unfocus(); setTimeout(() => { v.setFocus('terminal'); v.terminal.prog = 'acoustic'; }, 400); });
  await sleep(1000);
  const V = m.vault;
  const model = V.models[V.modelIdx];
  let dial = V.start;
  // tamper first (strike), then do it properly
  await act(A, { k: 'handle' });
  await sleep(400);
  for (let w = 0; w < 3; w++) {
    const d = model.dirs[w] === 'L' ? 1 : -1;
    let guard = 0;
    // overshoot by one then come back so the scope shows the gate passing
    while (dial !== V.combo[w] && guard++ < 120) { await act(A, { k: 'dial', d }); dial = (dial + d + 100) % 100; }
    if (w === 1) { await sleep(300); await shot(Bp, '06-line-scope'); }
    await act(A, { k: 'set' });
    await sleep(120);
  }
  await act(A, { k: 'handle' });
  await waitFor(A, () => __gl.state.vault.open === 1, null, 'vault open');
  await sleep(2500);
  await shot(A, '06-ghost-vault-open');
  await tp(A, -11, -64.3, Math.PI, -0.3);
  await act(A, { k: 'take' });
  await waitFor(A, () => __gl.state.lockdown.active === 1, null, 'lockdown');
  console.log('  lockdown', await state(A));

  step('Z7 lockdown: three overrides, lift, extract');
  await tp(A, -6.5, -65, -Math.PI / 2, 0);
  await sleep(1500);
  await shot(A, '07-ghost-smoke');
  await Bp.evaluate(() => { const v = __gl.game.view; v.unfocus(); setTimeout(() => { v.setFocus('monitors'); v.mainIdx = 7; v.cctv.cams[7].ir = true; }, 400); });
  await sleep(1800);
  await shot(Bp, '07-line-thermal');
  for (const d of m.lock) await act(Bp, { k: 'override', door: d.id, code: d.response });
  await waitFor(A, () => __gl.state.doors.L3 === 1, null, 'L3 open');
  await act(Bp, { k: 'lift' });
  await waitFor(A, () => __gl.state.lockdown.lift === 'arrived', null, 'lift arrived', 15000);
  await tp(A, 12, -22.6, 0, 0);
  await waitFor(A, () => __gl.state.phase === 'won', null, 'won');
  await sleep(800);
  const fin = await state(A);
  console.log('  final', fin, await A.evaluate(() => __gl.state.result));
  await shot(A, '08-ghost-end');
  await shot(Bp, '08-line-end');
  console.log(`\n✔ E2E PASSED (${fin.strikes} strikes)`);
} catch (e) {
  console.log(`\n✘ E2E FAILED: ${e.message}`);
  console.log('  GHOST', await state(A).catch(() => null));
  await shot(A, 'fail-ghost').catch(() => {});
  await shot(Bp, 'fail-line').catch(() => {});
  process.exitCode = 1;
}
if (errors.length) console.log('\nerrors:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
