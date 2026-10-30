// Mission generation. Everything about a run (codes, wiring, maze, optics, vault, lockdown)
// is derived from (seed, difficulty) so the server, GHOST and LINE all build the same facility
// and the blueprint printed for LINE matches what GHOST finds.

import { Rng } from './rng.js';
import { GLYPH_COUNT } from './glyphs.js';
import { DIFFICULTY, MAZE, WALL, OPTICS, SPINE, BULKHEADS } from './layout.js';
import { enumerateLeaves, leafLights, minMoves, traceBeams } from './optics-sim.js';

export const LAMP_COLORS = ['RED', 'AMBER', 'GREEN', 'BLUE'];
export const CABLE_COLORS = ['RED', 'GREEN', 'WHITE'];
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ---------------------------------------------------------------- Z1 gate
function genGate(r) {
  const plate = r.sample(range(GLYPH_COUNT), 3);
  const lamp = r.int(0, 3);
  const serialNum = r.int(1000, 9999);
  const table = range(GLYPH_COUNT).map(() => range(4).map(() => r.int(0, 9)));
  const voidTable = range(GLYPH_COUNT).map(() => range(4).map(() => r.int(0, 9)));
  const rowOrder = r.shuffle(range(GLYPH_COUNT));
  const colOrder = r.shuffle(range(4));
  const d = plate.map((g) => table[g][lamp]);
  const odd = serialNum % 2 === 1;
  const check = odd ? (d[0] * d[2] + d[1]) % 10 : (d[0] + d[1] + d[2]) % 10;
  return { plate, lamp, serial: `KX-${serialNum}`, odd, table, voidTable, rowOrder, colOrder, digits: d, check, code: d.join('') + check };
}

// ---------------------------------------------------------------- Z2 lasers
// Beam: {kind:'v', x, z} vertical floor-to-ceiling; {kind:'h', y, z} horizontal across the hall;
// {kind:'s', z, amp, period, phase} sweeping vertical. A gate may blink: {on, off, phase}.
function wall(z, gapLane) {
  // beams 0.4 m apart: closer than a body width (2 x 0.24 m), so there is no slipping between them.
  // The gap lane drops the beams strictly inside that lane.
  const beams = [];
  const lo = -2 + gapLane, hi = -1 + gapLane;
  for (let m = 0; m < 10; m++) {
    const x = -1.8 + 0.4 * m;
    if (gapLane >= 0 && x > lo + 1e-6 && x < hi - 1e-6) continue;
    beams.push({ kind: 'v', x, z });
  }
  return beams;
}

function genLasers(r, diff) {
  const B = diff.blink;
  const front = r.shuffle(['wall', 'low', 'wallHigh']);
  const back = r.shuffle(['blink', 'sweep', 'double', 'stagger']);
  const frontZ = [-5.5, -8.5, -11.0];
  const backZ = [-15.5, -18.5, -21.5, -24.5];
  const gates = [];
  const mk = (type, z) => {
    const g = { type, z, beams: [] };
    const lane = r.int(0, 3);
    if (type === 'wall') g.beams = wall(z, lane), g.gap = lane;
    if (type === 'wallHigh') {
      g.beams = [...wall(z, lane), { kind: 'h', y: 1.18, z }, { kind: 'h', y: 1.62, z }, { kind: 'h', y: 2.2, z }];
      g.gap = lane;
    }
    if (type === 'low') g.beams = [{ kind: 'h', y: 0.26, z }, { kind: 'h', y: 2.75, z }]; // jump apex puts the head at ~2.47 m
    if (type === 'blink') {
      g.beams = wall(z, -1);
      g.blink = { on: 2.6 * B, off: 1.7 * B, phase: r.float(0, 4) };
    }
    if (type === 'sweep') {
      const period = 4.6 / B;
      g.beams = [{ kind: 's', z, amp: 1.72, period, phase: r.float(0, period) }, { kind: 'h', y: 2.3, z }];
    }
    if (type === 'double') {
      const a = r.int(0, 3);
      let b = r.int(0, 3);
      while (Math.abs(a - b) < 2) b = r.int(0, 3);
      g.beams = [...wall(z + 0.6, a), ...wall(z - 0.6, b)];
      g.gap = a; g.gap2 = b;
    }
    if (type === 'stagger') {
      // two blinking walls in anti-phase: wait between them
      const on = 2.2 * B, off = 1.6 * B, phase = r.float(0, 3);
      g.parts = [
        { beams: wall(z + 0.9, -1), blink: { on, off, phase } },
        { beams: wall(z - 0.9, -1), blink: { on, off, phase: phase + (on + off) / 2 } },
      ];
    }
    return g;
  };
  front.forEach((t, i) => gates.push(mk(t, frontZ[i])));
  back.forEach((t, i) => gates.push(mk(t, backZ[i])));
  return { gates };
}

// Beam state at time t (seconds). Returns flat list of active beams with resolved x for sweeps.
export function activeBeams(lasers, t) {
  const out = [];
  const blinkOn = (b) => {
    const p = b.on + b.off;
    const ph = (((t + b.phase) % p) + p) % p;
    return ph < b.on;
  };
  const push = (beams) => {
    for (const b of beams) {
      if (b.kind === 's') out.push({ kind: 'v', x: b.amp * Math.sin((2 * Math.PI * (t + b.phase)) / b.period), z: b.z, sweep: true });
      else out.push(b);
    }
  };
  for (const g of lasers.gates) {
    if (g.parts) { for (const p of g.parts) if (blinkOn(p.blink)) push(p.beams); continue; }
    if (g.blink && !blinkOn(g.blink)) continue;
    push(g.beams);
  }
  return out;
}

// Body: feet (x, y, z), height h, radius rad.
export function beamHit(beams, x, y, z, h, rad = 0.24) {
  for (const b of beams) {
    if (Math.abs(z - b.z) > rad) continue;
    if (b.kind === 'v') {
      if (Math.hypot(x - b.x, z - b.z) < rad) return b;
    } else if (b.kind === 'h') {
      if (b.y > y && b.y < y + h) return b;
    }
  }
  return null;
}

// ---------------------------------------------------------------- Z3 patch frame
const CONFUSE = { B: '8', 8: 'B', 1: 'I', I: '1', 0: 'O', O: '0', 5: 'S', S: '5', 7: '1', 4: 'A' };
function frameIds(r) {
  const digits = range(4).map(() => r.int(0, 9));
  const letter = r.pick(['B', 'S', 'O', 'I', 'A']);
  const base = `PF-${digits.join('')}-${letter}`;
  const ids = new Set([base]);
  let guard = 0;
  while (ids.size < 6 && guard++ < 200) {
    const chars = base.split('');
    const t = r.int(0, 2);
    if (t === 0) { // swap two adjacent digits
      const p = 3 + r.int(0, 2);
      [chars[p], chars[p + 1]] = [chars[p + 1], chars[p]];
    } else if (t === 1) { // confusable substitution
      const cand = range(chars.length).filter((i) => i > 2 && CONFUSE[chars[i]] !== undefined);
      if (!cand.length) continue;
      const p = r.pick(cand);
      chars[p] = CONFUSE[chars[p]];
    } else { // change one digit by one
      const p = 3 + r.int(0, 3);
      chars[p] = String((Number(chars[p]) + (r.chance(0.5) ? 1 : 9)) % 10);
    }
    ids.add(chars.join(''));
  }
  return { ids: r.shuffle([...ids]), base };
}

function genSchematic(r, glyphs) {
  const W = 28;
  const leftOrder = r.shuffle(glyphs); // glyph shown at left row k (y = 1 + 2k)
  const rightOrder = r.shuffle([1, 2, 3, 4, 5, 6]); // number at right row k (y = 2 + 2k)
  const yL = (k) => 1 + 2 * k, yR = (k) => 2 + 2 * k;
  const tracks = r.shuffle(range(13).map((t) => t + 0.5)).slice(0, 6);
  const chans = r.shuffle(range(25).map((c) => c + 2)).slice(0, 12);
  const liveNets = r.sample(range(6), 3);
  const liveTargets = r.sample(range(6), 3);
  const unusedTargets = range(6).filter((k) => !liveTargets.includes(k));
  const deadKinds = r.shuffle(['NC', 'GND', 'FUSE']);
  const styles = r.shuffle(['solid', 'dash', 'dot']);
  const legend = {}; // style -> cable color
  r.shuffle(CABLE_COLORS).forEach((c, i) => (legend[styles[i]] = c));
  const nets = [];
  let dead = 0;
  for (let k = 0; k < 6; k++) {
    const xa = Math.min(chans[2 * k], chans[2 * k + 1]);
    const xb = Math.max(chans[2 * k], chans[2 * k + 1]);
    const ys = yL(k), ym = tracks[k];
    const net = { glyph: leftOrder[k], row: k, pts: [], comps: [], style: null, live: false, end: null, number: null, stubs: [] };
    const li = liveNets.indexOf(k);
    if (li >= 0) {
      const tk = liveTargets[li];
      net.live = true;
      net.style = styles[li];
      net.number = rightOrder[tk];
      net.end = 'T';
      net.pts = [[0, ys], [xa, ys], [xa, ym], [xb, ym], [xb, yR(tk)], [W, yR(tk)]];
    } else {
      const kind = deadKinds[dead++];
      net.style = r.pick(['solid', 'dash', 'dot']);
      net.end = kind;
      if (kind === 'FUSE') {
        const tk = r.pick(unusedTargets);
        net.pts = [[0, ys], [xa, ys], [xa, ym], [xb, ym], [xb, yR(tk)], [W, yR(tk)]];
      } else if (kind === 'GND') {
        net.pts = [[0, ys], [xa, ys], [xa, ym], [xb, ym], [xb, ym + (ym > 6 ? -0.7 : 0.7)]];
      } else {
        net.pts = [[0, ys], [xa, ys], [xa, ym], [xb, ym]];
      }
    }
    // components on horizontal segments long enough to carry one
    for (let s = 0; s < net.pts.length - 1; s++) {
      const [x1, y1] = net.pts[s], [x2, y2] = net.pts[s + 1];
      if (y1 !== y2 || Math.abs(x2 - x1) < 4) continue;
      if (r.chance(0.55)) net.comps.push({ seg: s, t: r.float(0.3, 0.7), type: r.pick(['R', 'R', 'L', 'F']) });
    }
    if (net.end === 'FUSE') {
      const hs = range(net.pts.length - 1).filter((s) => net.pts[s][1] === net.pts[s + 1][1] && Math.abs(net.pts[s + 1][0] - net.pts[s][0]) >= 3);
      const s = r.pick(hs);
      net.comps = net.comps.filter((c) => c.seg !== s);
      net.comps.push({ seg: s, t: 0.5, type: 'X' });
    }
    // decoy T-branches that end open
    if (r.chance(0.5) && xb - xa > 3) {
      const xs = r.int(Math.ceil(xa) + 1, Math.floor(xb) - 1) + 0.5;
      net.stubs.push({ x: xs, y: ym, y2: ym + (r.chance(0.5) ? 0.38 : -0.38) });
    }
    nets.push(net);
  }
  return { W, H: 13, leftOrder, rightOrder, nets, legend, styles };
}

function genPatch(r) {
  const glyphs = r.sample(range(GLYPH_COUNT), 6);
  const { ids } = frameIds(r);
  const variants = ids.map((id) => ({ id, ...genSchematic(r, glyphs) }));
  const actual = r.int(0, variants.length - 1);
  const v = variants[actual];
  const solution = v.nets.filter((n) => n.live).map((n) => ({ glyph: n.glyph, number: n.number, color: v.legend[n.style] }));
  return {
    frameId: v.id,
    actual,
    variants,
    topOrder: r.shuffle(glyphs), // physical socket order, left to right
    bottomOrder: r.shuffle([1, 2, 3, 4, 5, 6]),
    solution,
  };
}

// ---------------------------------------------------------------- Z4 maze
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const STEP = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export function mazeOpen(maze, c, r, dir, dampersOpen) {
  if ((maze.walls[r][c] & WALL[dir]) !== 0) return false;
  const d = maze.damperAt[`${c},${r},${dir}`];
  if (d && !(dampersOpen && dampersOpen[d])) return false;
  return true;
}

export function mazeNeighbors(maze, c, r, dampersOpen) {
  const out = [];
  for (const dir of ['N', 'E', 'S', 'W']) {
    const [dc, dr] = STEP[dir];
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= MAZE.cols || nr >= MAZE.rows) continue;
    if (mazeOpen(maze, c, r, dir, dampersOpen)) out.push([nc, nr, dir]);
  }
  return out;
}

function genMaze(r) {
  const { cols, rows } = MAZE;
  const walls = range(rows).map(() => range(cols).map(() => 15));
  const open = (c, rr, dir) => {
    const [dc, dr] = STEP[dir];
    walls[rr][c] &= ~WALL[dir];
    walls[rr + dr][c + dc] &= ~WALL[OPP[dir]];
  };
  for (let b = 0; b < 4; b++) {
    const c0 = 2 * b;
    const seen = new Set();
    const stack = [[c0 + r.int(0, 1), r.int(0, rows - 1)]];
    seen.add(stack[0].join());
    while (stack.length) {
      const [c, rr] = stack[stack.length - 1];
      const opts = ['N', 'E', 'S', 'W'].filter((dir) => {
        const [dc, dr] = STEP[dir];
        const nc = c + dc, nr = rr + dr;
        return nc >= c0 && nc <= c0 + 1 && nr >= 0 && nr < rows && !seen.has(`${nc},${nr}`);
      });
      if (!opts.length) { stack.pop(); continue; }
      const dir = r.pick(opts);
      open(c, rr, dir);
      const [dc, dr] = STEP[dir];
      seen.add(`${c + dc},${rr + dr}`);
      stack.push([c + dc, rr + dr]);
    }
    // one extra loop per band
    for (let tries = 0; tries < 10; tries++) {
      const rr = r.int(0, rows - 2);
      const c = c0 + r.int(0, 1);
      if (walls[rr][c] & WALL.S) { open(c, rr, 'S'); break; }
    }
  }
  const ids = r.shuffle(['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
  const dampers = [];
  const damperAt = {};
  let n = 0;
  for (let b = 0; b < 3; b++) {
    const [r1, r2] = r.sample(range(rows), 2);
    for (const rr of [r1, r2]) {
      const c = 2 * b + 1;
      open(c, rr, 'E');
      const id = ids[n++];
      dampers.push({ id, a: [c, rr], b: [c + 1, rr] });
      damperAt[`${c},${rr},E`] = id;
      damperAt[`${c + 1},${rr},W`] = id;
    }
  }
  const [ec, er] = MAZE.entrance;
  walls[er][ec] &= ~WALL.E;
  const exitCol = r.int(0, 1);
  walls[0][exitCol] &= ~WALL.N;
  // stencilled junction codes on ~45% of cells
  const letters = 'ABCDEFGHJKLMNPRTUVWXZ';
  const codes = {};
  const used = new Set();
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    if (!r.chance(0.45)) continue;
    let code;
    do code = `${r.pick(letters.split(''))}-${String(r.int(10, 99))}`; while (used.has(code));
    used.add(code);
    codes[`${c},${rr}`] = code;
  }
  codes[`${ec},${er}`] = codes[`${ec},${er}`] || 'C-00';
  const sensorCells = r.sample(range(cols * rows), 24);
  const sensorIds = r.shuffle(range(24).map((i) => `S-${String(i + 1).padStart(2, '0')}`));
  const sensors = {};
  sensorCells.forEach((idx, i) => (sensors[`${idx % cols},${Math.floor(idx / cols)}`] = sensorIds[i]));
  // lair: dead end in the middle bands
  const deadEnds = [];
  for (let rr = 0; rr < rows; rr++) for (let c = 2; c <= 5; c++) {
    const w = walls[rr][c];
    const openings = 4 - [1, 2, 4, 8].filter((bit) => w & bit).length;
    if (openings === 1) deadEnds.push([c, rr]);
  }
  const lair = deadEnds.length ? r.pick(deadEnds) : [r.int(2, 5), r.int(0, rows - 1)];
  return { walls, dampers, damperAt, exitCol, codes, sensors, lair, budget: 2 };
}

// ---------------------------------------------------------------- Z5 optics
function genOptics(r) {
  const N = OPTICS.n;
  for (let attempt = 0; attempt < 400; attempt++) {
    const emitterJ = r.int(2, 9);
    const taken = new Set();
    const mirrors = [];
    const firstI = r.int(2, 7);
    mirrors.push({ i: firstI, j: emitterJ });
    taken.add(`${firstI},${emitterJ}`);
    while (mirrors.length < 6) {
      const i = r.int(1, N - 2), j = r.int(1, N - 2);
      if (taken.has(`${i},${j}`) || (j === emitterJ && i < firstI)) continue;
      taken.add(`${i},${j}`);
      mirrors.push({ i, j });
    }
    const splitter = r.int(1, 5);
    mirrors.forEach((m, idx) => (m.type = idx === splitter ? 'S' : 'M'));
    const obstacles = [];
    while (obstacles.length < 5) {
      const i = r.int(0, N - 1), j = r.int(0, N - 1);
      if (taken.has(`${i},${j}`) || (j === emitterJ && i <= firstI)) continue;
      taken.add(`${i},${j}`);
      obstacles.push([i, j]);
    }
    const base = { emitterJ, mirrors, obstacles, receivers: [] };
    const leaves = enumerateLeaves(base, 30000);
    const good = leaves.filter((lf) => {
      const nExit = lf.exits.find((e) => e.side === 'N' && e.k === 2 && e.idx >= 1 && e.idx <= N - 2);
      const eExit = lf.exits.find((e) => e.side === 'E' && e.k === 0 && e.idx >= 1 && e.idx <= N - 2);
      const used = [...lf.assign].filter((a) => a >= 0).length;
      return nExit && eExit && used >= 4 && lf.assign[splitter] >= 0;
    });
    if (!good.length) continue;
    const pickLeaf = r.pick(good);
    const receivers = [
      { side: 'N', idx: pickLeaf.exits.find((e) => e.side === 'N' && e.k === 2).idx },
      { side: 'E', idx: pickLeaf.exits.find((e) => e.side === 'E' && e.k === 0).idx },
    ];
    const layout = { ...base, receivers };
    const solutions = leaves.filter((lf) => leafLights(lf, receivers));
    const fewest = Math.min(...solutions.map((s) => [...s.assign].filter((a) => a >= 0).length));
    if (fewest < 3) continue;
    for (let t = 0; t < 40; t++) {
      const init = mirrors.map(() => r.int(0, 7));
      const tr = traceBeams(layout, init);
      if (tr.lit.some(Boolean)) continue;
      const mm = minMoves(solutions, init);
      if (mm < 6) continue;
      const letters = r.shuffle(['A', 'B', 'C', 'D', 'E', 'F']);
      mirrors.forEach((m, idx) => (m.letter = letters[idx]));
      const ref = solutions.reduce((best, s) => {
        let c = 0;
        for (let m = 0; m < s.assign.length; m++) if (s.assign[m] >= 0) c += Math.min(Math.abs(s.assign[m] - init[m]) % 8, 8 - (Math.abs(s.assign[m] - init[m]) % 8));
        return c < best.c ? { c, s } : best;
      }, { c: Infinity, s: null });
      return { ...layout, init, minMoves: mm, solutionCount: solutions.length, reference: [...ref.s.assign], attempts: attempt + 1 };
    }
  }
  throw new Error('optics generation failed');
}

// ---------------------------------------------------------------- Z6 vault
export const VAULT_MODELS = ['KESTREL MK-II', 'KESTREL MK-III', 'KRAUSE 9/T', 'TALLIS 40', 'OSTROV-3', 'VANTAGE 70'];
export const SIG_TYPES = ['alpha', 'beta', 'gamma'];
const cdist100 = (a, b) => { const d = Math.abs(a - b) % 100; return Math.min(d, 100 - d); };

function genVault(r) {
  const models = VAULT_MODELS.map((name) => {
    let dirs;
    do dirs = range(3).map(() => (r.chance(0.5) ? 'L' : 'R')); while (dirs.every((d) => d === dirs[0]));
    return { name, dirs, trueSig: r.pick(SIG_TYPES), plate: `${r.pick(['S', 'N', 'T'])}${r.int(100, 999)}` };
  });
  const modelIdx = r.int(0, models.length - 1);
  const model = models[modelIdx];
  const combo = [];
  while (combo.length < 3) {
    const n = r.int(0, 99);
    if (combo.every((c) => cdist100(c, n) >= 10)) combo.push(n);
  }
  const decoys = combo.map((g) => {
    const out = [];
    while (out.length < 2) {
      const n = r.int(0, 99);
      if (cdist100(n, g) >= 4 && out.every((o) => cdist100(o, n) >= 4) && !combo.includes(n)) out.push(n);
    }
    return out;
  });
  const others = SIG_TYPES.filter((s) => s !== model.trueSig);
  const decoySigs = decoys.map(() => r.shuffle(others));
  return { models, modelIdx, model: model.name, serial: `${model.plate}-${r.int(10000, 99999)}`, combo, decoys, decoySigs, start: r.int(0, 99) };
}

// ---------------------------------------------------------------- Z7 lockdown
function genLockdown(r) {
  const outer = r.shuffle(range(GLYPH_COUNT));
  const inner = r.shuffle([...range(10), ...range(6).map(() => r.int(0, 9))]);
  const keyGlyphs = r.sample(range(GLYPH_COUNT), 3);
  const doors = ['L1', 'L2', 'L3'].map((id, n) => {
    const challenge = r.sample(range(GLYPH_COUNT), 4);
    const kPos = outer.indexOf(keyGlyphs[n]);
    const response = challenge.map((g) => inner[(((outer.indexOf(g) - kPos) % 16) + 16) % 16]).join('');
    return { id, key: keyGlyphs[n], challenge, response };
  });
  // hazards in the smoke, per spine segment on a 1m grid (u along, v across 0..3)
  const hazards = [];
  for (const seg of SPINE) {
    const len = seg.axis === 'x' ? seg.x1 - seg.x0 : seg.z1 - seg.z0;
    const blocked = new Set();
    const bulk = Object.values(BULKHEADS).map((b) => (seg.axis === 'x' ? (Math.abs(b.z - (seg.z0 + seg.z1) / 2) < 3 ? b.x - seg.x0 : null) : Math.abs(b.x - (seg.x0 + seg.x1) / 2) < 3 ? b.z - seg.z0 : null)).filter((u) => u !== null);
    const nearBulk = (u) => bulk.some((b) => Math.abs(b - u) < 2.5) || u < 2.5 || u > len - 2.5;
    for (let u = 3; u < len - 3; u += r.int(3, 5)) {
      if (nearBulk(u)) continue;
      const kind = r.pick(['pit', 'pit', 'cable', 'debris']);
      if (kind === 'pit') {
        const v0 = r.int(0, 2);
        const w = r.int(1, 2);
        const cells = range(w).map((k) => v0 + k).filter((v) => v <= 3);
        if (cells.length >= 4) cells.pop();
        hazards.push({ seg: seg.id, kind, u, v: cells, len: r.int(1, 2) });
        cells.forEach((v) => blocked.add(`${u},${v}`));
      } else if (kind === 'cable') {
        hazards.push({ seg: seg.id, kind, u: u + 0.5, v: r.int(0, 3) + 0.5 });
      } else {
        const v0 = r.chance(0.5) ? 0 : 2;
        hazards.push({ seg: seg.id, kind, u, v: [v0, v0 + 1] });
      }
    }
  }
  return { outer, inner, keyGlyphs, doors, hazards };
}

export function generateMission(seed, difficultyKey = 'operative') {
  const diff = DIFFICULTY[difficultyKey] || DIFFICULTY.operative;
  const root = new Rng(`${seed}|${diff.key}`);
  return {
    seed,
    difficulty: diff.key,
    diff,
    site: 'KESTREL-9',
    gate: genGate(root.fork('gate')),
    lasers: genLasers(root.fork('lasers'), diff),
    patch: genPatch(root.fork('patch')),
    maze: genMaze(root.fork('maze')),
    optics: genOptics(root.fork('optics')),
    vault: genVault(root.fork('vault')),
    lockdown: genLockdown(root.fork('lockdown')),
  };
}
