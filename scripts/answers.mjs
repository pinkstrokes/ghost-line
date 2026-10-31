// Walkthrough / answer key for one mission (for playtesting as GHOST without a LINE).
//   node scripts/answers.mjs SEED [recruit|operative|ghost]
import { generateMission, mazeNeighbors, LAMP_COLORS } from '../shared/mission.js';
import { MAZE } from '../shared/layout.js';

const [seed, diff = 'operative'] = process.argv.slice(2);
if (!seed) { console.log('usage: node scripts/answers.mjs SEED [difficulty]'); process.exit(1); }
const m = generateMission(seed.toUpperCase(), diff);
const LANE = 'ABCD';
const row = (z) => String(Math.min(12, Math.max(1, Math.ceil(-z / 2)))).padStart(2, '0');

console.log(`\n=== ${m.seed} · ${diff.toUpperCase()} ===`);

const G = m.gate;
console.log(`\nZ1 GATE   code ${G.code}   (lamp ${LAMP_COLORS[G.lamp]}, serial ${G.serial} → ${G.odd ? 'odd' : 'even'}, digits ${G.digits.join(' ')} + check ${G.check})`);

console.log('\nZ2 LASERS (lanes A–D left→right looking in; row numbers on the walls)');
for (const g of m.lasers.gates) {
  const at = `row ~${row(g.z)}`;
  if (g.type === 'wall') console.log(`  ${at}: wall — walk through lane ${LANE[g.gap]}`);
  if (g.type === 'wallHigh') console.log(`  ${at}: wall + chest beams — CROUCH through lane ${LANE[g.gap]}`);
  if (g.type === 'low') console.log(`  ${at}: ankle beam — JUMP (don't crouch)`);
  if (g.type === 'blink') console.log(`  ${at}: full wall that blinks (on ${g.blink.on.toFixed(1)}s / off ${g.blink.off.toFixed(1)}s) — wait close, go the moment it goes off`);
  if (g.type === 'sweep') console.log(`  ${at}: one beam sweeping left↔right (${g.beams[0].period.toFixed(1)}s) — cross right behind it as it passes`);
  if (g.type === 'double') console.log(`  ${at}: two walls 1.2 m apart — lane ${LANE[g.gap]} first, then shift to lane ${LANE[g.gap2]}`);
  if (g.type === 'stagger') console.log(`  ${at}: two blinking walls in turn — pass the first when it's off, wait in the middle, then the second`);
}

const P = m.patch;
console.log(`\nZ3 PATCH  (frame ${P.frameId}) — top socket counted from the left, bottom socket by its number`);
for (const s of P.solution) console.log(`  ${s.color.padEnd(5)}: top socket #${P.topOrder.indexOf(s.glyph) + 1}  →  bottom socket "${s.number}"`);
console.log('  then in LINE\'s terminal (T): BREAKER');

const M = m.maze;
const all = Object.fromEntries(M.dampers.map((d) => [d.id, 1]));
const bfs = (from, to) => {
  const k = (c) => c.join(), prev = new Map([[k(from), null]]), q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur[0] === to[0] && cur[1] === to[1]) { const p = []; let n = cur; while (n) { p.unshift([n[0], n[1]]); n = prev.get(`${n[0]},${n[1]}`); } return p; }
    for (const [c, r, dir] of mazeNeighbors(M, cur[0], cur[1], all)) if (!prev.has(`${c},${r}`)) { prev.set(`${c},${r}`, [cur[0], cur[1], dir]); q.push([c, r]); }
  }
};
const path = bfs(MAZE.entrance, [M.exitCol, 0]);
console.log(`\nZ4 UNDERCROFT (${path.length - 1} cells; crouch the whole way, LINE types the damper commands in the terminal)`);
const DIRS = ['N', 'E', 'S', 'W'];
let heading = 'W', steps = 0;
const flush = () => { if (steps) console.log(`  forward ${steps} cell${steps > 1 ? 's' : ''}`); steps = 0; };
const opened = [];
for (let i = 1; i < path.length; i++) {
  const [pc, pr] = path[i - 1], [c, r] = path[i];
  const dir = c > pc ? 'E' : c < pc ? 'W' : r > pr ? 'S' : 'N';
  if (dir !== heading) {
    flush();
    const turn = (DIRS.indexOf(dir) - DIRS.indexOf(heading) + 4) % 4;
    const code = M.codes[`${pc},${pr}`];
    console.log(`  ${turn === 1 ? 'turn RIGHT' : turn === 3 ? 'turn LEFT' : 'turn around'}${code ? `  (junction ${code})` : ''}`);
    heading = dir;
  }
  const d = M.damperAt[`${pc},${pr},${dir}`];
  if (d) {
    flush();
    while (opened.length >= M.budget) console.log(`  [LINE] CLOSE ${opened.shift()}`);
    console.log(`  [LINE] OPEN ${d}   (shutter ahead)`);
    opened.push(d);
  }
  steps++;
}
flush();
{ const t = (DIRS.indexOf('N') - DIRS.indexOf(heading) + 4) % 4; console.log(`  ${t === 0 ? 'straight on' : t === 1 ? 'turn RIGHT' : t === 3 ? 'turn LEFT' : 'turn around'} through the exit into the optics lab`); }

const O = m.optics;
console.log(`\nZ5 OPTICS  (live receivers: N${O.receivers.find((r) => r.side === 'N').idx + 1} and E${O.receivers.find((r) => r.side === 'E').idx + 1})`);
O.mirrors.forEach((mi, i) => {
  const r = O.reference[i];
  if (r < 0) return console.log(`  mirror ${mi.letter}: leave it`);
  const q = (r - O.init[i] + 8) % 8, e = (8 - q) % 8;
  console.log(`  mirror ${mi.letter}: ${q === 0 ? 'already right' : q <= e ? `Q × ${q}` : `E × ${e}`}`);
});

const V = m.vault, md = V.models[V.modelIdx];
console.log(`\nZ6 VAULT  model ${md.name} (plate ${V.serial}), dial starts at ${V.start}`);
md.dirs.forEach((d, w) => console.log(`  wheel ${w + 1}: ${d === 'L' ? 'A / LEFT (numbers rise)' : 'D / RIGHT (numbers fall)'} to ${V.combo[w]}, then SPACE (SET)   [decoy drags at ${V.decoys[w].join(', ')}]`));
console.log('  then H (handle), walk in, E to take the core → LOCKDOWN');

const L = m.lockdown;
console.log('\nZ7 ESCAPE  (LINE types these in the terminal OVERRIDE program)');
for (const d of L.doors) console.log(`  ${d.id} ${d.response}`);
console.log('  after L3: LIFT  (9 s), then walk into the lift car');
const where = (h) => h.seg === 'e1'
  ? `east run, ${(h.u).toFixed(0)} m from the hatch, ${(Array.isArray(h.v) ? h.v[0] : h.v) < 2 ? 'LEFT' : 'RIGHT'} side`
  : `south run, ${(h.u + 2).toFixed(0)} m past the corner, ${(Array.isArray(h.v) ? h.v[0] : h.v) < 2 ? 'RIGHT' : 'LEFT'} side`;
for (const h of L.hazards.filter((h) => h.kind !== 'debris')) console.log(`  ${h.kind === 'pit' ? 'PIT  ' : 'CABLE'}: ${where(h)}`);
console.log('  bulkheads: L1 east run ~11 m, L2 south run ~15 m past the corner, L3 ~27 m past the corner');
console.log('  ~45 s after the lockdown (75 on RECRUIT) the Listener follows you out — keep moving, don\'t sprint\n');
