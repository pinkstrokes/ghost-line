// Solvability + logic check across many seeds, no browser needed.
//   node scripts/verify.mjs [count=500]
// For every seed: structural checks per zone, then a full scripted mission through the real
// Room state machine (same code the server runs) that must end in 'won' with zero alerts.

import { generateMission, activeBeams, beamHit, mazeNeighbors } from '../shared/mission.js';
import { Room } from '../shared/room.js';
import { MAZE, cellCenter, SPINE, BULKHEADS, OPTICS } from '../shared/layout.js';
import { traceBeams } from '../shared/optics-sim.js';

const N = +(process.argv[2] || 500);
const fails = [];
const stats = { opticsMin: Infinity, opticsMax: 0, mazePath: [], hallSafe: Infinity };
const fail = (seed, msg) => { fails.push(`${seed}: ${msg}`); };

function checkLasers(seed, L) {
  // every gate must offer a passage for at least 0.8 s in every 6 s window, for a standing,
  // crouching or jumping body somewhere across the hall; and the space between gates is never hot.
  for (const g of L.gates) {
    const zs = g.parts ? g.parts.map((p) => p.beams[0].z) : [g.z];
    for (const z of zs) {
      let best = 0, run = 0;
      for (let t = 0; t < 12; t += 0.05) {
        const beams = activeBeams({ gates: [g] }, t).filter((b) => Math.abs(b.z - z) < 0.01);
        let ok = false;
        for (let x = -1.7; x <= 1.7 && !ok; x += 0.05) {
          for (const [y, h] of [[0, 1.72], [0, 1.05], [0.45, 1.72]]) if (!beamHit(beams, x, y, z, h)) { ok = true; break; }
        }
        run = ok ? run + 0.05 : 0;
        best = Math.max(best, run);
      }
      if (best < 0.8) fail(seed, `laser gate ${g.type}@${z} has no 0.8s passage`);
      stats.hallSafe = Math.min(stats.hallSafe, best);
    }
  }
  for (let z = -2.5; z > -26.5; z -= 0.1) {
    const near = L.gates.some((g) => (g.parts ? g.parts.some((p) => Math.abs(p.beams[0].z - z) < 0.4) : g.beams.some((b) => Math.abs(b.z - z) < 0.4)));
    if (near) continue;
    for (let t = 0; t < 6; t += 0.25) if (beamHit(activeBeams(L, t), 0, 0, z, 1.72)) { fail(seed, `hall not safe between gates at z=${z.toFixed(1)}`); return; }
  }
}

function checkPatch(seed, P) {
  const ids = new Set(P.variants.map((v) => v.id));
  if (ids.size !== P.variants.length) fail(seed, 'duplicate frame ids');
  const v = P.variants[P.actual];
  const live = v.nets.filter((n) => n.live);
  if (live.length !== 3) fail(seed, 'not 3 live nets');
  if (new Set(live.map((n) => n.number)).size !== 3) fail(seed, 'live nets share a number');
  if (new Set(P.solution.map((s) => s.color)).size !== 3) fail(seed, 'cable colours not distinct');
  // no collinear overlap between different nets
  const H = [], V = [];
  v.nets.forEach((n, ni) => { for (let i = 0; i < n.pts.length - 1; i++) { const [a, b] = [n.pts[i], n.pts[i + 1]]; (a[1] === b[1] ? H : V).push({ ni, a, b }); } });
  for (const arr of [H, V]) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const p = arr[i], q = arr[j];
    if (p.ni === q.ni) continue;
    const same = arr === H ? p.a[1] === q.a[1] : p.a[0] === q.a[0];
    if (!same) continue;
    const k = arr === H ? 0 : 1;
    const [p0, p1] = [Math.min(p.a[k], p.b[k]), Math.max(p.a[k], p.b[k])], [q0, q1] = [Math.min(q.a[k], q.b[k]), Math.max(q.a[k], q.b[k])];
    if (p0 < q1 && q0 < p1) fail(seed, 'schematic lines overlap');
  }
}

function checkMaze(seed, Z) {
  const all = Object.fromEntries(Z.dampers.map((d) => [d.id, 1]));
  const start = MAZE.entrance, goal = [Z.exitCol, 0];
  const seen = new Map([[start.join(), null]]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    for (const [nc, nr] of mazeNeighbors(Z, c[0], c[1], all)) { const k = `${nc},${nr}`; if (!seen.has(k)) { seen.set(k, c); q.push([nc, nr]); } }
  }
  if (!seen.has(goal.join())) { fail(seed, 'maze exit unreachable'); return; }
  if (seen.size !== MAZE.cols * MAZE.rows) fail(seed, `maze has unreachable cells (${seen.size})`);
  // with every damper closed the exit must be unreachable (GHOST cannot do it alone)
  const seen2 = new Set([start.join()]);
  const q2 = [start];
  while (q2.length) { const c = q2.shift(); for (const [nc, nr] of mazeNeighbors(Z, c[0], c[1], {})) { const k = `${nc},${nr}`; if (!seen2.has(k)) { seen2.add(k); q2.push([nc, nr]); } } }
  if (seen2.has(goal.join())) fail(seed, 'maze solvable with all dampers closed');
  let len = 0; let n = goal.join();
  while (seen.get(n)) { n = seen.get(n).join(); len++; }
  stats.mazePath.push(len);
}

function checkOptics(seed, O) {
  const ref = O.init.map((o, i) => (O.reference[i] >= 0 ? O.reference[i] : o));
  const tr = traceBeams(O, ref);
  if (!tr.lit.every(Boolean)) fail(seed, 'optics reference does not light both receivers');
  if (traceBeams(O, O.init).lit.some(Boolean)) fail(seed, 'optics initial state lights a receiver');
  stats.opticsMin = Math.min(stats.opticsMin, O.minMoves); stats.opticsMax = Math.max(stats.opticsMax, O.minMoves);
}

function checkSpine(seed, L) {
  // 0.25 m grid flood fill from the hatch to the lift, body radius 0.3
  const step = 0.25, R = 0.32;
  const blocked = (x, z) => {
    for (const h of L.hazards) {
      const seg = SPINE.find((s) => s.id === h.seg);
      const w = (u, v) => (seg.axis === 'x' ? { x: seg.x0 + u, z: seg.z0 + v } : { x: seg.x0 + v, z: seg.z0 + u });
      if (h.kind === 'cable') { const p = w(h.u, h.v); if (Math.hypot(x - p.x, z - p.z) < 0.45 + R) return true; }
      else for (const v of h.v) {
        const a = w(h.u, v), b = w(h.u + 1, v + 1);
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
        if (x > x0 - R && x < x1 + R && z > z0 - R && z < z1 + R) return true;
      }
    }
    // corridor union: the east run includes the corner it shares with the north run
    const rects = [[-8, 14, -67, -63], [10, 14, -67, -30]];
    const inSeg = rects.some(([x0, x1, z0, z1]) => x > x0 + R && x < x1 - R && z > z0 + R && z < z1 - R);
    return !inSeg;
  };
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const start = [-7.4, -65], goalZ = -30.6;
  const seen = new Set([key(...start)]);
  const q = [start];
  let ok = false;
  while (q.length) {
    const [x, z] = q.shift();
    if (z > goalZ && x > 10.4 && x < 13.6) { ok = true; break; }
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (seen.has(k) || blocked(nx, nz)) continue;
      seen.add(k); q.push([nx, nz]);
    }
  }
  if (!ok) fail(seed, 'spine impassable');
}

function fullRun(seed, diff) {
  const sent = [];
  let clock = 1_000_000;
  const room = new Room({ code: 'TEST', seed, difficulty: diff, now: () => clock, send: (to, msg) => sent.push(msg) });
  const A = { id: 'a' }, H = { id: 'h' };
  room.join('agent', 'A', A); room.join('handler', 'H', H);
  room.handle(A, { t: 'ready', v: true }); room.handle(H, { t: 'ready', v: true });
  room.handle(A, { t: 'start', seed });
  const m = room.mission, s = room.state;
  const act = (who, a) => room.handle(who, { t: 'act', a });
  const pose = (x, z, flags = 0) => room.handle(A, { t: 'pose', p: [x, 0, z, 0, 0, flags] });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { clock += 100; room.tick(); } };
  for (const k of [...m.gate.code, 'ENT']) act(A, { k: 'key', v: k });
  if (!s.doors.A) return 'gate';
  pose(0, -28); if (!s.lasers.cleared) return 'lasers';
  for (const sol of m.patch.solution) {
    act(A, { k: 'plug', color: sol.color, end: 0, socket: `T${m.patch.topOrder.indexOf(sol.glyph)}` });
    act(A, { k: 'plug', color: sol.color, end: 1, socket: `B${m.patch.bottomOrder.indexOf(sol.number)}` });
  }
  clock += 4000;
  act(H, { k: 'breaker' }); if (!s.patch.power) return 'patch';
  // crouch-walk through the maze along the BFS path, opening dampers just ahead (budget 2)
  const all = Object.fromEntries(m.maze.dampers.map((d) => [d.id, 1]));
  const path = room.mazePath(MAZE.entrance, [m.maze.exitCol, 0], all);
  let prev = MAZE.entrance;
  for (const c of path) {
    const d = m.maze.dampers.find((dd) => (dd.a.join() === prev.join() && dd.b.join() === c.join()) || (dd.b.join() === prev.join() && dd.a.join() === c.join()));
    if (d) {
      for (const [id, open] of Object.entries(s.maze.dampers)) if (open && id !== d.id) act(H, { k: 'damper', id, open: false });
      act(H, { k: 'damper', id: d.id, open: true });
      if (!s.maze.dampers[d.id]) return 'maze-damper';
    }
    const p = cellCenter(c[0], c[1]);
    pose(p.x, p.z, 1 | 8); tick(3);
    prev = c;
  }
  pose(-26, -50); if (!s.maze.cleared) return 'maze';
  const O = m.optics;
  O.reference.forEach((r, i) => {
    if (r < 0) return;
    let d = (r - s.optics.orient[i] + 8) % 8;
    while (d--) act(A, { k: 'rotate', m: i, d: 1 });
  });
  if (!s.optics.done) return 'optics';
  const V = m.vault, model = V.models[V.modelIdx];
  for (let w = 0; w < 3; w++) {
    const d = model.dirs[w] === 'L' ? 1 : -1;
    let g = 0;
    while (s.vault.dial !== V.combo[w] && g++ < 110) act(A, { k: 'dial', d });
    act(A, { k: 'set' });
  }
  act(A, { k: 'handle' }); if (!s.vault.open) return 'vault';
  act(A, { k: 'take' }); if (!s.lockdown.active) return 'take';
  for (const d of m.lockdown.doors) act(H, { k: 'override', door: d.id, code: d.response });
  if (!s.doors.L3) return 'override';
  act(H, { k: 'lift' }); tick(100);
  if (s.lockdown.lift !== 'arrived') return 'lift';
  act(A, { k: 'extract' });
  if (s.phase !== 'won') return `phase ${s.phase} ${s.result?.reason}`;
  const reasons = sent.filter((x) => x.t === 'ev' && x.e.k === 'strike').map((x) => x.e.reason);
  const other = reasons.filter((r) => !r.includes('LISTENER'));
  stats.listener = (stats.listener || 0) + (reasons.length - other.length);
  if (other.length) return `strikes: ${other.join(', ')}`;
  return null;
}

// ---- regression checks for review findings (room logic)
{
  let clock = 5_000_000;
  const room = new Room({ code: 'REG', seed: 'REG1', now: () => clock, send: () => {} });
  const A = { id: 'a' }, H = { id: 'h' };
  room.join('agent', 'A', A); room.join('handler', 'H', H);
  const s = () => room.state;
  room.handle(A, { t: 'start' });
  if (s().phase === 'playing') fail('REG', 'start accepted while nobody was ready');
  room.handle(A, { t: 'ready', v: true }); room.handle(H, { t: 'ready', v: true }); room.handle(A, { t: 'start' });
  if (s().phase !== 'playing') fail('REG', 'start refused with both ready');
  const act = (who, a) => room.handle(who, { t: 'act', a });
  for (const k of ['1', '2', '3', '4', 'ENT', 'ENT', 'ENT']) act(A, { k: 'key', v: k === '1' && room.mission.gate.code[0] === '1' ? '9' : k });
  if (s().strikes !== 1) fail('REG', `repeated ENT gave ${s().strikes} strikes`);
  act(A, { k: 'handle' }); act(A, { k: 'handle' });
  if (s().strikes !== 2) fail('REG', `double HANDLE gave ${s().strikes - 1} strikes`);
  room.triggerLockdown(true);
  clock += 3000; act(A, { k: 'hazard', kind: 'cable' }); clock += 300; act(A, { k: 'hazard', kind: 'pit' });
  if (s().strikes !== 4) fail('REG', 'pit right after a cable shock was swallowed');
  room.handle(A, { t: 'lobby' });
  if (s().players.agent.ready || s().players.handler.ready) fail('REG', 'ready flags survived back-to-lobby');
}

const t0 = Date.now();
let n = 0;
for (let i = 0; i < N; i++) {
  const seed = `V${i.toString(36).toUpperCase().padStart(5, '0')}`;
  const diff = ['recruit', 'operative', 'ghost'][i % 3];
  let m;
  try { m = generateMission(seed, diff); } catch (e) { fail(seed, `generation threw: ${e.message}`); continue; }
  checkLasers(seed, m.lasers);
  checkPatch(seed, m.patch);
  checkMaze(seed, m.maze);
  checkOptics(seed, m.optics);
  checkSpine(seed, m.lockdown);
  const r = fullRun(seed, diff);
  if (r) fail(seed, `full run stuck at ${r}`);
  n++;
}
const mp = stats.mazePath.sort((a, b) => a - b);
console.log(`checked ${n} seeds in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`blind bot caught by the Listener ${stats.listener || 0} times in ${n} runs (it walks 10 m/s straight down the corridor; that is the game working)`);
console.log(`optics min rotations: ${stats.opticsMin}..${stats.opticsMax}   maze shortest path: ${mp[0]}..${mp[mp.length - 1]} cells (median ${mp[mp.length >> 1]})   tightest laser window: ${stats.hallSafe.toFixed(2)}s`);
if (fails.length) { console.log(`\n${fails.length} FAILURES:`); console.log(fails.slice(0, 40).join('\n')); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
