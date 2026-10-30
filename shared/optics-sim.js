// Discrete beam simulation for the optics lab. Mirrors sit on lattice points and have 8
// orientations (22.5 deg steps). Reflection in 45-degree direction units is k' = (m - k) mod 8.

import { DIRS, OPTICS } from './layout.js';

const N = OPTICS.n;
export const reflectDir = (k, m) => (((m - k) % 8) + 8) % 8;
const key = (i, j) => i * 32 + j;

function mirrorOut(type, k, o) {
  const r = reflectDir(k, o);
  if (type === 'S') return r === k ? [k] : [k, r];
  return r === k ? [] : [r];
}

function exitOf(i, j, k) {
  const outI = i < 0 || i >= N, outJ = j < 0 || j >= N;
  if (outI && outJ) return { side: 'C', idx: -1, k };
  if (i < 0) return { side: 'W', idx: j, k };
  if (i >= N) return { side: 'E', idx: j, k };
  if (j < 0) return { side: 'N', idx: i, k };
  return { side: 'S', idx: i, k };
}

function buildIndex(layout) {
  const mirrorAt = new Map();
  layout.mirrors.forEach((m, idx) => mirrorAt.set(key(m.i, m.j), idx));
  const obst = new Set(layout.obstacles.map(([i, j]) => key(i, j)));
  return { mirrorAt, obst };
}

// Full trace for rendering and win checks. Returns polyline segments in lattice coordinates
// (start point may be i = -1 for the emitter), the exits, and which receivers are lit.
export function traceBeams(layout, orient) {
  const { mirrorAt, obst } = buildIndex(layout);
  const segs = [], exits = [];
  const visited = new Set();
  const queue = [[-1, layout.emitterJ, 0]];
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const [si, sj, k] = queue.pop();
    let i = si, j = sj;
    for (;;) {
      const ni = i + DIRS[k][0], nj = j + DIRS[k][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) {
        segs.push([si, sj, i, j, k, true]); // true = runs on to the wall
        exits.push(exitOf(ni, nj, k));
        break;
      }
      i = ni; j = nj;
      if (obst.has(key(i, j))) { segs.push([si, sj, i, j, k, false, 'block']); break; }
      const mi = mirrorAt.get(key(i, j));
      if (mi !== undefined) {
        segs.push([si, sj, i, j, k, false]);
        const vk = key(i, j) * 8 + k;
        if (visited.has(vk)) break;
        visited.add(vk);
        for (const d of mirrorOut(layout.mirrors[mi].type, k, orient[mi])) queue.push([i, j, d]);
        break;
      }
    }
  }
  const lit = layout.receivers.map((rc) => exits.some((e) => e.side === rc.side && e.idx === rc.idx && e.k === (rc.side === 'N' ? 2 : 0)));
  return { segs, exits, lit };
}

// Beam-following search: only mirrors the beam actually reaches get an orientation.
// Each leaf is { assign: Int8Array (-1 = untouched), exits }.
export function enumerateLeaves(layout, cap = 20000) {
  const { mirrorAt, obst } = buildIndex(layout);
  const leaves = [];
  const M = layout.mirrors.length;
  function run(assign, queue, visited, exits) {
    if (leaves.length >= cap) return;
    while (queue.length) {
      const b = queue.pop();
      if (b.at !== undefined) {
        const mi = b.at;
        if (assign[mi] < 0) {
          for (let o = 0; o < 8; o++) {
            const a2 = assign.slice();
            a2[mi] = o;
            run(a2, [...queue, b], new Set(visited), exits.slice());
          }
          return;
        }
        for (const d of mirrorOut(layout.mirrors[mi].type, b.k, assign[mi])) queue.push({ i: b.i, j: b.j, k: d });
        continue;
      }
      let i = b.i, j = b.j;
      const k = b.k;
      for (;;) {
        const ni = i + DIRS[k][0], nj = j + DIRS[k][1];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) { exits.push(exitOf(ni, nj, k)); break; }
        i = ni; j = nj;
        if (obst.has(key(i, j))) break;
        const mi = mirrorAt.get(key(i, j));
        if (mi !== undefined) {
          const vk = key(i, j) * 8 + k;
          if (!visited.has(vk)) { visited.add(vk); queue.push({ at: mi, i, j, k }); }
          break;
        }
      }
    }
    leaves.push({ assign, exits });
  }
  run(new Int8Array(M).fill(-1), [{ i: -1, j: layout.emitterJ, k: 0 }], new Set(), []);
  return leaves;
}

export const circDist = (a, b) => { const d = Math.abs(a - b) % 8; return Math.min(d, 8 - d); };

export function leafLights(leaf, receivers) {
  return receivers.every((rc) => leaf.exits.some((e) => e.side === rc.side && e.idx === rc.idx && e.k === (rc.side === 'N' ? 2 : 0)));
}

export function minMoves(solutions, init) {
  let best = Infinity;
  for (const s of solutions) {
    let c = 0;
    for (let m = 0; m < s.assign.length; m++) if (s.assign[m] >= 0) c += circDist(s.assign[m], init[m]);
    if (c < best) best = c;
  }
  return best;
}
