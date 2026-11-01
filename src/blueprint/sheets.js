// The KESTREL-9 record set: seven A1 sheets, all generated from the mission.
// Each sheet is a draw(ctx) in millimetres; BlueprintView and the print page decide the scale.

import { drawGlyph } from '../../shared/glyphs.js';
import { ZONES, MAZE, WALL, OPTICS, CAMERAS, HALL, BULKHEADS, DIRS } from '../../shared/layout.js';
import { LAMP_COLORS } from '../../shared/mission.js';
import { SIG, SIG_NAMES } from '../../shared/signatures.js';
import {
  SHEET_W, SHEET_H, INK, INK2, INK3, RED, STAMP, FILL, TINT, HOT, FONT, MONO, paper, wear, titleBlock, line, label, hand, stamp,
  arrowHead, dim, hatchRect, cloud, triangleTag, callout, northArrow, scaleBar, table, seeded,
} from './style.js';

const glyphCell = (g, size = 7) => (ctx, cx, cy) => drawGlyph(ctx, g, cx - size / 2, cy - size / 2, size, { color: INK, lineWidth: size * 0.1 });

// ------------------------------------------------------------------ 00 cover
function cover(ctx, m) {
  const rng = seeded('00', m.seed);
  paper(ctx, rng);
  label(ctx, 'KESTREL-9', 40, 70, 64, { weight: 900 });
  label(ctx, 'RESEARCH ANNEX  ·  SECTOR B', 42, 112, 15, { weight: 700, color: INK2 });
  label(ctx, 'AS-BUILT RECORD DRAWINGS  —  VOLUME II  (CONTROL, SERVICES, SECURE STORE)', 42, 130, 7, { color: INK2 });
  // isometric massing sketch
  ctx.save();
  ctx.translate(200, 300);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  const iso = (x, y, z) => [(x - z) * 0.866 * 2.2, (x + z) * 0.5 * 2.2 - y * 2.2];
  const block = (x, z, w, d, h) => {
    const p = [[x, 0, z], [x + w, 0, z], [x + w, 0, z + d], [x, 0, z + d]].map(([a, b, c]) => iso(a, b, c));
    const q = [[x, h, z], [x + w, h, z], [x + w, h, z + d], [x, h, z + d]].map(([a, b, c]) => iso(a, b, c));
    ctx.fillStyle = TINT;
    ctx.beginPath(); q.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) line(ctx, p[i][0], p[i][1], q[i][0], q[i][1]);
    ctx.beginPath(); [p[1], p[2], p[3]].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke();
  };
  block(0, 0, 8, 30, 6); block(10, 4, 14, 12, 8); block(-26, 16, 24, 20, 3); block(-28, 38, 16, 16, 10); block(-12, 40, 10, 14, 7); block(14, 30, 6, 36, 5);
  ctx.restore();
  label(ctx, 'MASSING — NOT TO SCALE', 120, 395, 4, { color: INK2 });
  // index
  const idx = [
    ['00', 'COVER · INDEX · GENERAL NOTES', 'C', '1'],
    ['A-1', 'SITE & GROUND FLOOR PLAN · CCTV SCHEDULE', 'C', '2'],
    ['A-2', 'ACCESS CONTROL · CODE TABLES · OVERRIDE ROTOR', 'B', '3'],
    ['E-1', 'SUBSTATION 2 · PATCH FRAME WIRING', 'C', '4'],
    ['M-1', 'UNDERCROFT · VENT DAMPERS · SENSORS', 'C', '5'],
    ['O-1', 'OPTICS LAB · BENCH LAYOUT', 'B', '6'],
    ['V-1', 'SECURE STORE · VAULT DOOR SERVICE', 'D', '7'],
  ];
  label(ctx, 'DRAWING INDEX', 470, 170, 7, { weight: 700 });
  table(ctx, 470, 178, [{ w: 26, title: 'SHEET' }, { w: 210, title: 'TITLE' }, { w: 18, title: 'REV' }, { w: 22, title: 'KEY' }], idx, { rowH: 11, size: 4.4 });
  // general notes
  label(ctx, 'GENERAL NOTES', 470, 280, 7, { weight: 700 });
  const notes = [
    '1. ALL DIMENSIONS IN METRES UNLESS NOTED. NORTH IS UP ON ALL PLANS.',
    '2. REVISION CLOUDS MARK CHANGES. A SUPERSEDED TABLE IS VOID EVEN IF NOT REMOVED.',
    '3. SYMBOL CHARACTERS (GLYPHS) ARE THE ANNEX MAINTENANCE ALPHABET. THEY HAVE NO NAMES.',
    '4. CCTV: CAMERAS MARKED [IR] RESOLVE THE INFRA-RED SECURITY GRID AND OPTICS BEAMS.',
    '5. THERMAL / IR IMAGERY IS NOT AFFECTED BY THE SPINE FIRE-SUPPRESSION SMOKE.',
    '6. BMS NODE 04 CONTROLS: SUBSTATION BREAKER, UNDERCROFT DAMPERS, SPINE BULKHEADS, LIFT.',
    '7. FIELD STAFF CANNOT SEE IR. REMOTE OPERATOR CANNOT TOUCH HARDWARE. WORK TOGETHER.',
  ];
  notes.forEach((n, i) => label(ctx, n, 470, 292 + i * 9.5, 4.1, { color: INK2 }));
  // old handler's pencil notes
  hand(ctx, 'whoever reads this next —\nmake GHOST read everything TWICE.\nthe plates lie if you rush.', 60, 440, 9, { rot: -0.05 });
  hand(ctx, 'the hall cams see the lasers.\npress I on the monitor desk', 300, 470, 8, { rot: 0.03 });
  hand(ctx, 'the thing downstairs is blind.\nkeep them quiet. crouch = silent', 520, 380, 8, { rot: -0.04 });
  ctx.strokeStyle = RED; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.ellipse(568, 222, 30, 6, 0, 0, 7); ctx.stroke();
  hand(ctx, 'ask GHOST for the\nframe no.!  →', 380, 214, 7, { rot: -0.05 });
  stamp(ctx, 'SECRET', 690, 70, 22, -0.12, rng);
  stamp(ctx, 'FILE COPY — DO NOT REMOVE', 340, 540, 9, 0.05, rng);
  titleBlock(ctx, { sheet: '00', title: 'COVER · INDEX', sub: 'GENERAL NOTES', rev: 'C' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ A-1 site plan
function site(ctx, m) {
  const rng = seeded('A1', m.seed);
  paper(ctx, rng);
  const s = 5.2; // mm per metre
  const ox = 60 + 35 * s, oy = 40 + 69 * s;
  const P = (x, z) => [ox + x * s, oy + z * s];
  const rect = (r, name, opts = {}) => {
    const [x0, y0] = P(r.x0, r.z0), [x1, y1] = P(r.x1, r.z1);
    ctx.fillStyle = TINT; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 0.3; ctx.strokeRect(x0 - 1.4, y0 - 1.4, x1 - x0 + 2.8, y1 - y0 + 2.8);
    if (name) label(ctx, name, (x0 + x1) / 2 + (opts.dx || 0), (y0 + y1) / 2 + (opts.dy || 0), opts.size || 4.2, { align: 'center', weight: 700, rot: opts.rot });
  };
  // yard
  ctx.setLineDash([2, 1.5]); ctx.strokeStyle = INK2; ctx.lineWidth = 0.4;
  const [fx0, fy0] = P(-14, 0.2), [fx1, fy1] = P(14, 20);
  ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.setLineDash([]);
  label(ctx, 'SECURE YARD (FENCE)', (fx0 + fx1) / 2, fy1 - 8, 4, { align: 'center', color: INK2 });
  rect({ x0: -9.4, x1: -6.6, z0: 6, z1: 8.8 }, 'GUARD', { size: 3 });
  const [fcx0, fcy0] = P(-16, -0.4), [fcx1] = P(16, 0);
  ctx.fillStyle = INK3; ctx.fillRect(fcx0, fcy0, fcx1 - fcx0, 0.4 * s);
  rect(ZONES.lasers, 'HALL 2', { rot: -Math.PI / 2, size: 4 });
  // hall rows/lanes
  ctx.strokeStyle = INK3; ctx.lineWidth = 0.25;
  for (let k = 0; k <= 12; k++) { const [a, b] = P(-2, HALL.zStart - 2 * k), [c] = P(2, 0); line(ctx, a, b, c, b); }
  for (const lx of [-1, 0, 1]) { const [a, b] = P(lx, -2), [, d] = P(lx, -27); line(ctx, a, b, a, d); }
  label(ctx, 'A B C D', P(0, -1.2)[0], P(0, -1.2)[1], 2.6, { align: 'center', color: INK2 });
  rect(ZONES.patch, 'SUBSTATION 2', { dy: 6 });
  label(ctx, '(SEE E-1)', P(0, -33)[0], P(0, -33)[1] + 12, 3.4, { align: 'center', color: INK2 });
  rect(ZONES.maze, 'UNDERCROFT', {});
  label(ctx, '(SEE M-1)', P(-21, -37.5)[0], P(-21, -37.5)[1] + 7, 3.4, { align: 'center', color: INK2 });
  rect({ x0: -9, x1: -7, z0: -33.8, z1: -32.2 });
  rect(ZONES.optics, 'OPTICS LAB', {});
  label(ctx, '(SEE O-1)', P(-26, -56)[0], P(-26, -56)[1] + 7, 3.4, { align: 'center', color: INK2 });
  rect({ x0: -18, x1: -16, z0: -56.8, z1: -55.2 });
  rect(ZONES.vault, 'ANTECHAMBER', { dy: 8, size: 3.6 });
  rect(ZONES.vaultRoom, 'VAULT', { size: 3.6 });
  label(ctx, '(SEE V-1)', P(-11, -65)[0], P(-11, -65)[1] + 6, 3, { align: 'center', color: INK2 });
  rect(ZONES.escape1, 'SERVICE SPINE', { size: 3.6, dx: -20 });
  rect(ZONES.escape2, '', {});
  label(ctx, 'SERVICE SPINE', P(12, -46)[0], P(12, -46)[1], 3.6, { align: 'center', weight: 700, rot: -Math.PI / 2 });
  rect(ZONES.lift, 'FREIGHT LIFT', { size: 3.4 });
  // doors
  const door = (id, x, z, note) => {
    const [a, b] = P(x, z);
    ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(a, b, 3.4, 0, 7); ctx.fill(); ctx.stroke();
    label(ctx, id, a, b + 0.2, id.length > 2 ? 2.2 : 3, { align: 'center', weight: 700 });
    if (note) label(ctx, note, a + 5, b, 2.8, { color: INK2 });
  };
  door('A', 0, -0.2, 'KEYPAD 7C');
  door('C', -7, -33, '');
  door('E', -18, -56, '');
  door('V', -11, -62, '');
  door('H', -8, -65, '');
  for (const [id, b] of Object.entries(BULKHEADS)) door(id, b.x, b.z, '');
  door('LIFT', 12, -24.2, '');
  // cameras
  for (const cam of CAMERAS) {
    const [a, b] = P(cam.pos[0], cam.pos[2]);
    const dx = cam.look[0] - cam.pos[0], dz = cam.look[2] - cam.pos[2];
    const ang = Math.atan2(dz, dx);
    const fov = 0.55, L = Math.min(40, Math.hypot(dx, dz) * s * 0.7 + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = INK2; ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.arc(a, b, L, ang - fov, ang + fov); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.save(); ctx.translate(a, b); ctx.rotate(ang); ctx.fillRect(-2.2, -1.4, 4.4, 2.8); ctx.restore();
    label(ctx, cam.id.replace('CAM-', 'C'), a + 3, b - 4, 3.2, { weight: 700, color: cam.ir ? HOT : INK });
  }
  northArrow(ctx, 60, 520);
  scaleBar(ctx, 85, 528, s, 10);
  // schedules
  const camRows = CAMERAS.map((c, i) => [String((i + 1) % 10), c.id, c.label, c.ir ? 'IR' : '—', c.ptz ? 'PTZ' : 'FIXED']);
  label(ctx, 'CCTV SCHEDULE', 420, 40, 6, { weight: 700 });
  table(ctx, 420, 46, [{ w: 14, title: 'KEY' }, { w: 26, title: 'CAMERA' }, { w: 120, title: 'LOCATION' }, { w: 16, title: 'IR' }, { w: 22, title: 'MOUNT' }], camRows, { rowH: 8.5, size: 3.6 });
  label(ctx, 'DOOR SCHEDULE', 420, 160, 6, { weight: 700 });
  const doorRows = [
    ['A', 'SLIDING, SERVICE ENTRY 7C', 'KEYPAD — TABLE 7C-1 (A-2)'],
    ['C', 'BULKHEAD, UNDERCROFT', 'INTERLOCKED TO SUBSTATION BREAKER (E-1)'],
    ['E', 'BULKHEAD, OPTICS → STORE', 'OPTICS RECEIVERS R1 + R2 (O-1)'],
    ['V', 'VAULT DOOR', 'COMBINATION, 3 WHEELS (V-1)'],
    ['H', 'EMERGENCY HATCH', 'OPENS ON LOCKDOWN ONLY'],
    ['L1–L3', 'LOCKDOWN BULKHEADS', 'CHALLENGE / RESPONSE — ROTOR (A-2)'],
    ['LIFT', 'FREIGHT LIFT', 'BMS CALL AFTER L3'],
  ];
  table(ctx, 420, 166, [{ w: 18, title: 'DOOR' }, { w: 80, title: 'TYPE' }, { w: 120, title: 'RELEASE' }], doorRows, { rowH: 8.5, size: 3.4 });
  hand(ctx, 'hall rows start at the door:\n01 nearest, 12 at the far end.\nlanes A–D left to right\nlooking IN from the door', 440, 270, 7.5, { rot: -0.03 });
  hand(ctx, 'the gate in front of GHOST lights up\n(their torch has IR). C02 looks back\nat the door: left/right FLIPPED!', 600, 330, 7, { rot: 0.04 });
  hand(ctx, 'spine = smoke.\nonly the IR cams\nsee through it', 450, 400, 7.5, { rot: 0.02 });
  hand(ctx, 'if the undercroft thing\nfollows them out — it shows\nBLACK on thermal (cold). it\nhears the radio. go QUIET.', 590, 405, 7, { rot: -0.03 });
  titleBlock(ctx, { sheet: 'A-1', title: 'SITE & GROUND FLOOR PLAN', sub: 'CCTV + DOOR SCHEDULES', rev: 'C' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ A-2 access control
function access(ctx, m) {
  const rng = seeded('A2', m.seed);
  paper(ctx, rng);
  const G = m.gate;
  const cols = [{ w: 18, title: 'GLYPH' }, ...G.colOrder.map((c) => ({ w: 20, title: LAMP_COLORS[c] }))];
  const rowsFor = (tbl) => G.rowOrder.map((g) => [glyphCell(g, 6.4), ...G.colOrder.map((c) => String(tbl[g][c]))]);
  // REV A (void) — placed first, where the eye lands
  label(ctx, 'TABLE 7C-1  SERVICE ENTRY CODES  (REV A)', 34, 28, 5.2, { weight: 700 });
  const t1 = table(ctx, 34, 44, cols, rowsFor(G.voidTable), { rowH: 10.5, size: 5.4, font: MONO, weight: 700 });
  ctx.strokeStyle = STAMP; ctx.lineWidth = 1.2;
  line(ctx, 34, 44, 34 + t1.w, 44 + t1.h); line(ctx, 34 + t1.w, 44, 34, 44 + t1.h);
  stamp(ctx, 'VOID', 34 + t1.w / 2, 44 + t1.h / 2, 18, -0.4, rng);
  hand(ctx, 'OLD — dont use!!', 40, 44 + t1.h + 10, 8);
  // REV B
  const bx = 180;
  label(ctx, 'TABLE 7C-1  SERVICE ENTRY CODES  (REV B — CURRENT)', bx, 28, 5.2, { weight: 700 });
  const t2 = table(ctx, bx, 44, cols, rowsFor(G.table), { rowH: 10.5, size: 5.4, font: MONO, weight: 700 });
  cloud(ctx, bx - 5, 39, t2.w + 10, t2.h + 10);
  triangleTag(ctx, bx + t2.w + 12, 36, 'B');
  label(ctx, 'COLUMN = COLOUR OF THE STATUS LAMP BESIDE THE ACCESS PLATE.', bx, 44 + t2.h + 14, 3.6, { color: INK2 });
  label(ctx, 'D1, D2, D3 = DIGITS FOR THE PLATE GLYPHS, READ LEFT → RIGHT.', bx, 44 + t2.h + 20, 3.6, { color: INK2 });
  // the check digit procedure is posted in the guard booth (GHOST's side), not printed here
  const fx = 370, fy = 40;
  label(ctx, 'FIG. A-2.1  CHECK DIGIT  (4TH DIGIT OF THE CODE)', fx, fy - 4, 5.2, { weight: 700 });
  ctx.strokeStyle = INK2; ctx.lineWidth = 0.5; ctx.setLineDash([2, 1.5]); ctx.strokeRect(fx, fy + 4, 240, 60); ctx.setLineDash([]);
  label(ctx, 'SUPERSEDED — SEE SOP 7C-4', fx + 120, fy + 24, 6, { align: 'center', weight: 700 });
  label(ctx, '(POSTED INSIDE THE GUARD BOOTH, YARD WEST)', fx + 120, fy + 34, 3.8, { align: 'center', color: INK2 });
  label(ctx, 'CODE = D1 D2 D3 + CHECK DIGIT, THEN ENT.', fx + 120, fy + 44, 3.8, { align: 'center', color: INK2 });
  stamp(ctx, 'REMOVED', fx + 200, fy + 52, 9, -0.25, rng);
  hand(ctx, 'GHOST has to do the 4th\ndigit off the booth sheet.\ngive them D1 D2 D3 slowly', fx + 20, fy + 92, 7.5, { rot: 0.03 });
  // override rotor key schedule
  const ry = 300;
  label(ctx, 'LOCKDOWN OVERRIDE  —  ROTOR FORM 7/L  KEY SCHEDULE', 370, ry, 5.2, { weight: 700 });
  const keyRows = m.lockdown.doors.map((d) => [d.id, glyphCell(d.key, 7), 'SET ◆ UNDER THIS GLYPH']);
  table(ctx, 370, ry + 6, [{ w: 24, title: 'BULKHEAD' }, { w: 26, title: 'KEY' }, { w: 70, title: '' }], keyRows, { rowH: 12, size: 4 });
  const steps = [
    '1. GHOST READS THE 4 CHALLENGE GLYPHS ON THE BULKHEAD PANEL, LEFT → RIGHT.',
    '2. TURN THE INNER DISC UNTIL ◆ SITS UNDER THAT BULKHEAD\'S KEY GLYPH.',
    '3. FOR EACH CHALLENGE GLYPH, READ THE DIGIT ON THE INNER DISC DIRECTLY UNDER IT.',
    '4. BMS TERMINAL:  L1 ####   (WRONG RESPONSE = ALARM)',
  ];
  steps.forEach((t, i) => label(ctx, t, 370, ry + 66 + i * 7, 3.6, { color: INK2 }));
  hand(ctx, 'the cardboard wheel\nis on the desk. dont lose it', 380, ry + 104, 7);
  // printed rotor (for paper play)
  const rcx = 680, rcy = 420, R1 = 92, R2 = 62, R3 = 42;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(rcx, rcy, R1, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(rcx, rcy, R2, 0, 7); ctx.stroke();
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) * Math.PI * 2) / 16;
    line(ctx, rcx + Math.cos(a) * R2, rcy + Math.sin(a) * R2, rcx + Math.cos(a) * R1, rcy + Math.sin(a) * R1);
    const ac = -Math.PI / 2 + (k * Math.PI * 2) / 16;
    ctx.save(); ctx.translate(rcx + Math.cos(ac) * (R2 + R1) / 2, rcy + Math.sin(ac) * (R2 + R1) / 2); ctx.rotate(ac + Math.PI / 2);
    drawGlyph(ctx, m.lockdown.outer[k], -9, -9, 18, { color: INK, lineWidth: 1.6 });
    ctx.restore();
  }
  label(ctx, 'OUTER RING (FIXED)', rcx, rcy - R1 - 6, 3.6, { align: 'center', color: INK2 });
  const ix = 520, iy = 440;
  ctx.setLineDash([1.5, 1.2]); ctx.beginPath(); ctx.arc(ix, iy, R3 + 8, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, '✂ CUT OUT, PIN AT CENTRE (PAPER COPIES)', ix, iy + R3 + 16, 3.4, { align: 'center', color: INK2 });
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 16;
    label(ctx, String(m.lockdown.inner[k]), ix + Math.cos(a) * R3, iy + Math.sin(a) * R3, 6, { align: 'center', weight: 700, font: MONO, rot: a + Math.PI / 2 });
  }
  ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(ix, iy - R3 - 6); ctx.lineTo(ix + 3, iy - R3 - 2); ctx.lineTo(ix, iy - R3 + 2); ctx.lineTo(ix - 3, iy - R3 - 2); ctx.fill();
  label(ctx, 'INNER DISC', ix, iy, 4, { align: 'center', weight: 700 });
  hand(ctx, 'the INNER ring turns.\nthe outer one stays put.', 40, 470, 8);
  hand(ctx, 'little lamp colour → column.\nif GHOST cant tell, ask\n"warm or cold?"', 40, 520, 7.5, { rot: 0.02 });
  titleBlock(ctx, { sheet: 'A-2', title: 'ACCESS CONTROL', sub: 'CODE TABLES · OVERRIDE ROTOR', rev: 'B' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ E-1 patch frames
function schematic(ctx, v, x, y, w, h, isFirst) {
  const ux = (w - 40) / v.W, uy = (h - 34) / v.H;
  const X = (gx) => x + 22 + gx * ux, Y = (gy) => y + 26 + gy * uy;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = FILL; ctx.fillRect(x + 4, y + 4, 60, 12);
  ctx.strokeRect(x + 4, y + 4, 60, 12);
  label(ctx, `FRAME  ${v.id}`, x + 34, y + 10.5, 5.2, { align: 'center', weight: 700, font: MONO });
  label(ctx, 'SOURCE BUS (TOP ROW)', x + 22, y + 21, 3, { color: INK2 });
  label(ctx, 'LOAD BUS (BOTTOM ROW)', x + w - 18, y + 21, 3, { color: INK2, align: 'right' });
  // collect segments for crossing detection
  const segs = [];
  v.nets.forEach((n, ni) => { for (let i = 0; i < n.pts.length - 1; i++) segs.push({ ni, a: n.pts[i], b: n.pts[i + 1] }); n.stubs.forEach((st) => segs.push({ ni, a: [st.x, st.y], b: [st.x, st.y2] })); });
  const dash = { solid: [], dash: [3.2, 1.8], dot: [0.3, 1.5] };
  v.nets.forEach((n, ni) => {
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.75; ctx.lineCap = 'round';
    ctx.setLineDash(dash[n.style]);
    for (let i = 0; i < n.pts.length - 1; i++) {
      const [x1, y1] = n.pts[i], [x2, y2] = n.pts[i + 1];
      const comp = n.comps.find((c) => c.seg === i);
      if (y1 === y2) {
        // horizontal: hop over other nets' verticals
        const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
        const hops = segs.filter((sg) => sg.ni !== ni && sg.a[0] === sg.b[0] && sg.a[0] > lo + 0.05 && sg.a[0] < hi - 0.05 && Math.min(sg.a[1], sg.b[1]) < y1 && Math.max(sg.a[1], sg.b[1]) > y1).map((sg) => sg.a[0]).sort((a, b) => a - b);
        const cpos = comp ? lo + (hi - lo) * comp.t : null;
        ctx.beginPath(); ctx.moveTo(X(lo), Y(y1));
        let cur = lo;
        const events = [...hops.map((hx) => ({ x: hx, k: 'hop' })), ...(comp ? [{ x: cpos, k: 'comp' }] : [])].sort((a, b) => a.x - b.x);
        for (const ev of events) {
          if (ev.k === 'hop') {
            const r = 1.5;
            ctx.lineTo(X(ev.x) - r, Y(y1));
            ctx.arc(X(ev.x), Y(y1), r, Math.PI, 0, false);
          } else {
            const half = 4.5;
            ctx.lineTo(X(ev.x) - half, Y(y1));
            ctx.stroke();
            drawComponent(ctx, comp.type, X(ev.x), Y(y1), half);
            ctx.setLineDash(dash[n.style]);
            ctx.beginPath(); ctx.moveTo(X(ev.x) + half, Y(y1));
          }
          cur = ev.x;
        }
        ctx.lineTo(X(hi), Y(y1));
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
      }
    }
    // corners get a tiny round so they don't read as junctions
    ctx.setLineDash([]);
    // stubs
    for (const st of n.stubs) {
      ctx.setLineDash(dash[n.style]);
      ctx.beginPath(); ctx.moveTo(X(st.x), Y(st.y)); ctx.lineTo(X(st.x), Y(st.y2)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(st.x), Y(st.y), 1.1, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(X(st.x), Y(st.y2) + (st.y2 > st.y ? 1.2 : -1.2), 1.2, 0, 7); ctx.stroke();
    }
    // ends
    const end = n.pts[n.pts.length - 1];
    if (n.end === 'NC') {
      ctx.beginPath(); ctx.arc(X(end[0]) + 1.4, Y(end[1]), 1.4, 0, 7); ctx.stroke();
      label(ctx, 'NC', X(end[0]) + 4, Y(end[1]) - 2.5, 2.8, { color: INK2 });
    } else if (n.end === 'GND') {
      const gx = X(end[0]), gy = Y(end[1]);
      const dir = end[1] > n.pts[n.pts.length - 2][1] ? 1 : -1;
      for (let k = 0; k < 3; k++) line(ctx, gx - 3 + k, gy + dir * k * 1.2, gx + 3 - k, gy + dir * k * 1.2);
    }
    ctx.restore();
  });
  // terminals
  v.leftOrder.forEach((g, k) => {
    const yy = Y(1 + 2 * k);
    ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(x + 12, yy, 6, 0, 7); ctx.fill(); ctx.stroke();
    drawGlyph(ctx, g, x + 7.5, yy - 4.5, 9, { color: INK, lineWidth: 0.9 });
    line(ctx, x + 18, yy, X(0), yy);
  });
  v.rightOrder.forEach((num, k) => {
    const yy = Y(2 + 2 * k);
    ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    ctx.fillRect(x + w - 16, yy - 4.5, 10, 9); ctx.strokeRect(x + w - 16, yy - 4.5, 10, 9);
    label(ctx, String(num), x + w - 11, yy + 0.3, 5.4, { align: 'center', weight: 700, font: MONO });
    line(ctx, X(v.W), yy, x + w - 16, yy);
  });
}

function drawComponent(ctx, type, cx, cy, half) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  if (type === 'R') {
    ctx.beginPath(); ctx.moveTo(cx - half, cy);
    for (let i = 0; i < 6; i++) ctx.lineTo(cx - half + ((i + 0.5) * 2 * half) / 6, cy + (i % 2 ? 1.6 : -1.6));
    ctx.lineTo(cx + half, cy); ctx.stroke();
  } else if (type === 'L') {
    ctx.beginPath(); ctx.moveTo(cx - half, cy);
    for (let i = 0; i < 4; i++) ctx.arc(cx - half + (i + 0.5) * (half / 2), cy, half / 4, Math.PI, 0, false);
    ctx.stroke();
  } else if (type === 'F' || type === 'X') {
    ctx.strokeRect(cx - half * 0.8, cy - 1.6, half * 1.6, 3.2);
    line(ctx, cx - half, cy, cx + half, cy);
    if (type === 'X') {
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.stroke();
      line(ctx, cx - 2.1, cy - 2.1, cx + 2.1, cy + 2.1); line(ctx, cx + 2.1, cy - 2.1, cx - 2.1, cy + 2.1);
    }
  }
  ctx.restore();
}

function patch(ctx, m) {
  const rng = seeded('E1', m.seed);
  paper(ctx, rng);
  const P = m.patch;
  // legend strip
  label(ctx, 'SUBSTATION 2 — PATCH FRAME WIRING SCHEDULE (ALL FRAMES OF THIS TYPE)', 30, 30, 6, { weight: 700 });
  const lg = P.variants[0].legend;
  const dash = { solid: [], dash: [3.2, 1.8], dot: [0.3, 1.5] };
  let lx = 30;
  label(ctx, 'JUMPER CABLE BY LINE STYLE:', lx, 42, 3.8, { color: INK2 });
  lx += 64;
  for (const st of ['solid', 'dash', 'dot']) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.lineCap = 'round'; ctx.setLineDash(dash[st]); line(ctx, lx, 42, lx + 18, 42); ctx.restore();
    label(ctx, `= ${lg[st]}`, lx + 21, 42, 3.8, { weight: 700 });
    lx += 46;
  }
  const sym = [
    ['●', 'JOINT (CONNECTED)'], ['⌒', 'HOP — NOT CONNECTED'], ['⊗', 'BLOWN FUSE — CIRCUIT DEAD'],
    ['NC', 'OPEN END — DEAD'], ['⏚', 'EARTH — DEAD'], ['∿ ▭', 'R / L / FUSE — PASS THROUGH'],
  ];
  sym.forEach(([s, t], i) => { label(ctx, s, 30 + i * 132, 52, 4, { weight: 700 }); label(ctx, t, 40 + i * 132, 52, 3.4, { color: INK2 }); });
  label(ctx, 'A LIVE CIRCUIT RUNS FROM A SOURCE GLYPH TO A LOAD NUMBER. EXACTLY 3 ARE LIVE PER FRAME. PATCH EACH LIVE CIRCUIT WITH ITS CABLE.', 30, 60, 3.6, { color: INK2 });
  const W = 260, H = 222;
  P.variants.forEach((v, i) => schematic(ctx, v, 24 + (i % 3) * (W + 10), 68 + Math.floor(i / 3) * (H + 8), W, H, i === 0));
  hand(ctx, 'hops are NOT joints. trace slowly.\nthe numbers on the frame are jumbled —\nGHOST finds the number, not the position', 40, 545, 7.5, { rot: -0.02 });
  hand(ctx, 'B/8, 1/I, O/0, S/5, 4/A all look alike on those plates. make GHOST spell it.', 250, 560, 7, { rot: 0.02 });
  titleBlock(ctx, { sheet: 'E-1', title: 'PATCH FRAME WIRING', sub: 'SUBSTATION 2 · FRAMES PF SERIES', rev: 'C' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ M-1 undercroft
function undercroft(ctx, m) {
  const rng = seeded('M1', m.seed);
  paper(ctx, rng);
  const Z = m.maze;
  const cs = 56, ox = 50, oy = 74;
  const cx = (c) => ox + c * cs, cy = (r) => oy + r * cs;
  label(ctx, 'UNDERCROFT — SERVICE TUNNELS, VENT DAMPERS, MOTION SENSORS', 30, 30, 6, { weight: 700 });
  label(ctx, 'PLAN  1:60  (ONE CELL = 3 m)', 30, 40, 3.8, { color: INK2 });
  // grid refs
  for (let c = 0; c < MAZE.cols; c++) label(ctx, String(c + 1), cx(c) + cs / 2, oy - 8, 5, { align: 'center', color: INK2 });
  for (let r = 0; r < MAZE.rows; r++) label(ctx, 'ABCDEF'[r], ox - 9, cy(r) + cs / 2, 5, { align: 'center', color: INK2 });
  // floor
  ctx.fillStyle = TINT; ctx.fillRect(ox, oy, cs * MAZE.cols, cs * MAZE.rows);
  // walls
  const t = 3;
  const wallH = (x0, x1, y) => hatchRect(ctx, x0 - t / 2, y - t / 2, x1 - x0 + t, t, 1.2);
  const wallV = (x, y0, y1) => hatchRect(ctx, x - t / 2, y0 - t / 2, t, y1 - y0 + t, 1.2);
  for (let r = 0; r < MAZE.rows; r++) for (let c = 0; c < MAZE.cols; c++) {
    const w = Z.walls[r][c];
    if (w & WALL.N) wallH(cx(c), cx(c + 1), cy(r));
    if (w & WALL.W) wallV(cx(c), cy(r), cy(r + 1));
    if (r === MAZE.rows - 1 && w & WALL.S) wallH(cx(c), cx(c + 1), cy(r + 1));
    if (c === MAZE.cols - 1 && w & WALL.E) wallV(cx(c + 1), cy(r), cy(r + 1));
  }
  // codes + sensors
  for (const [k, code] of Object.entries(Z.codes)) {
    const [c, r] = k.split(',').map(Number);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.4;
    ctx.strokeRect(cx(c) + cs / 2 - 11, cy(r) + cs / 2 - 5, 22, 10);
    label(ctx, code, cx(c) + cs / 2, cy(r) + cs / 2 + 0.3, 5, { align: 'center', weight: 700, font: MONO });
  }
  for (const [k, id] of Object.entries(Z.sensors)) {
    const [c, r] = k.split(',').map(Number);
    const sx = cx(c) + 10, sy = cy(r) + cs - 10;
    ctx.strokeStyle = INK2; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, 5, -0.8, 0.8); ctx.stroke();
    label(ctx, id, sx + 8, sy, 3.6, { color: INK2, font: MONO });
  }
  // dampers
  for (const d of Z.dampers) {
    const [c, r] = d.a;
    const x = cx(c + 1), y0 = cy(r) + 6, y1 = cy(r + 1) - 6;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2.2, y0, 4.4, y1 - y0);
    ctx.strokeStyle = FILL; ctx.lineWidth = 0.5;
    for (let yy = y0 + 3; yy < y1; yy += 3) line(ctx, x - 2.2, yy, x + 2.2, yy - 1.5);
    ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    ctx.fillRect(x - 7, cy(r) - 2 + 8, 14, 9); ctx.strokeRect(x - 7, cy(r) - 2 + 8, 14, 9);
    label(ctx, d.id, x, cy(r) + 10.6, 5, { align: 'center', weight: 700, font: MONO });
  }
  // entrance / exit
  const [ec, er] = MAZE.entrance;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
  line(ctx, cx(ec + 1) + 30, cy(er) + cs / 2, cx(ec + 1) + 4, cy(er) + cs / 2);
  arrowHead(ctx, cx(ec + 1) + 4, cy(er) + cs / 2, Math.PI, 3.5);
  label(ctx, 'IN — BULKHEAD C', cx(ec + 1) + 8, cy(er) + cs / 2 - 6, 4, { weight: 700 });
  label(ctx, '(FROM SUBSTATION)', cx(ec + 1) + 8, cy(er) + cs / 2 + 7, 3.4, { color: INK2 });
  line(ctx, cx(Z.exitCol) + cs / 2, cy(0) - 4, cx(Z.exitCol) + cs / 2, cy(0) - 26);
  arrowHead(ctx, cx(Z.exitCol) + cs / 2, cy(0) - 26, -Math.PI / 2, 3.5);
  label(ctx, 'OUT — TO OPTICS LAB', cx(Z.exitCol) + cs / 2 + 4, cy(0) - 22, 4, { weight: 700 });
  // notes
  const nx = 530;
  label(ctx, 'NOTES', nx, 80, 6, { weight: 700 });
  [
    '1. DAMPERS D1–D6 ARE MOTORISED SHUTTERS IN THE TUNNEL.',
    '   CONTROL: BMS NODE 04 · VENT.',
    '2. SUBSTATION 2 CAN DRIVE ONLY 2 DAMPERS OPEN AT ONCE.',
    '   CLOSE ONE BEFORE OPENING A THIRD.',
    '3. BOXED CODES ARE STENCILLED ON THE TUNNEL WALL',
    '   AT THAT JUNCTION (NOT EVERY JUNCTION HAS ONE).',
    '4. PIR SENSORS S-xx REPORT MOTION ONLY — NOT IDENTITY.',
    '5. NO LIGHTING IN SERVICE. CARRY A TORCH.',
  ].forEach((n, i) => label(ctx, n, nx, 92 + i * 8, 3.7, { color: INK2 }));
  hand(ctx, 'it hears running from far off,\nwalking, even creeping up close.\nAND IT HEARS THE RADIO. whisper.', nx, 180, 7.5);
  hand(ctx, 'shut a damper on it —\nit cant open them', nx, 212, 7.5, { rot: 0.03 });
  const [lc, lr] = Z.lair;
  hand(ctx, '?', cx(lc) + cs / 2 + 12, cy(lr) + 14, 14, { rot: 0.2 });
  hand(ctx, 'every time I ask "where are you"\nGHOST tells me a code. find the box.', nx, 260, 7, { rot: -0.02 });
  northArrow(ctx, nx + 20, 470);
  scaleBar(ctx, nx + 50, 474, cs / 3, 9);
  titleBlock(ctx, { sheet: 'M-1', title: 'UNDERCROFT', sub: 'TUNNELS · DAMPERS · SENSORS', rev: 'C' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ O-1 optics
function optics(ctx, m) {
  const rng = seeded('O1', m.seed);
  paper(ctx, rng);
  const O = m.optics, Z = ZONES.optics;
  const s = 20.5, ox = 78, oy = 62;
  const X = (x) => ox + (x - Z.x0) * s, Y = (z) => oy + (z - Z.z0) * s;
  const LX = (i) => X(OPTICS.x0 + i + 0.5), LY = (j) => Y(OPTICS.z0 + j + 0.5);
  label(ctx, 'OPTICS LAB — BENCH LAYOUT  (PLAN, NORTH UP)', 30, 30, 6, { weight: 700 });
  label(ctx, '1 GRID STEP = 1 m', 30, 40, 3.8, { color: INK2 });
  ctx.fillStyle = TINT; ctx.fillRect(X(Z.x0), Y(Z.z0), (Z.x1 - Z.x0) * s, (Z.z1 - Z.z0) * s);
  hatchRect(ctx, X(Z.x0) - 4, Y(Z.z0) - 4, (Z.x1 - Z.x0) * s + 8, 4, 1.2);
  hatchRect(ctx, X(Z.x0) - 4, Y(Z.z1), (Z.x1 - Z.x0) * s + 8, 4, 1.2);
  hatchRect(ctx, X(Z.x0) - 4, Y(Z.z0), 4, (Z.z1 - Z.z0) * s, 1.2);
  hatchRect(ctx, X(Z.x1), Y(Z.z0), 4, (Z.z1 - Z.z0) * s, 1.2);
  // lattice dots + labels
  ctx.fillStyle = INK3;
  for (let i = 0; i < OPTICS.n; i++) for (let j = 0; j < OPTICS.n; j++) { ctx.beginPath(); ctx.arc(LX(i), LY(j), 0.6, 0, 7); ctx.fill(); }
  for (let i = 0; i < OPTICS.n; i++) label(ctx, String(i + 1), LX(i), Y(Z.z1) + 10, 3, { align: 'center', color: INK2 });
  // wall ports (dummies + real)
  ctx.strokeStyle = INK2; ctx.lineWidth = 0.4;
  for (let j = 0; j < OPTICS.n; j++) line(ctx, X(Z.x0) - 4, LY(j), X(Z.x0), LY(j));
  for (let i = 0; i < OPTICS.n; i++) line(ctx, LX(i), Y(Z.z0) - 4, LX(i), Y(Z.z0));
  for (let j = 0; j < OPTICS.n; j++) line(ctx, X(Z.x1), LY(j), X(Z.x1) + 4, LY(j));
  const tag = (x, y, t, sub, align = 'left') => { ctx.fillStyle = FILL; label(ctx, t, x, y, 4.6, { weight: 700, align }); if (sub) label(ctx, sub, x, y + 6, 3.2, { color: INK2, align }); };
  // emitter
  ctx.fillStyle = HOT; ctx.fillRect(X(Z.x0) - 5, LY(O.emitterJ) - 2.5, 5, 5);
  ctx.strokeStyle = HOT; ctx.setLineDash([1.5, 1.5]); line(ctx, X(Z.x0), LY(O.emitterJ), X(Z.x0) + 30, LY(O.emitterJ)); ctx.setLineDash([]);
  ctx.fillStyle = HOT; arrowHead(ctx, X(Z.x0) + 30, LY(O.emitterJ), 0, 3);
  tag(X(Z.x0) - 16, LY(O.emitterJ) - 8, 'TX EMITTER', 'IR 940 nm — INVISIBLE', 'right');
  // port numbers (stencilled on site above each port)
  for (let i = 0; i < OPTICS.n; i++) label(ctx, `N${i + 1}`, LX(i), Y(Z.z0) - 6, 2.6, { align: 'center', color: INK2 });
  for (let j = 0; j < OPTICS.n; j++) { label(ctx, `W${j + 1}`, X(Z.x0) - 6, LY(j) + 1, 2.6, { align: 'right', color: INK2 }); label(ctx, `E${j + 1}`, X(Z.x1) + 6, LY(j) + 1, 2.6, { color: INK2 }); }
  // receivers: which wall is recorded, which port isn't (re-fitted; GHOST has to find the live ones)
  tag(X((Z.x0 + Z.x1) / 2), Y(Z.z0) - 20, 'R1 RECEIVER — NORTH WALL, PORT ??', 'ACCEPTS BEAM TRAVELLING NORTH · STANDBY LAMP: 1 BLINK', 'center');
  tag(X(Z.x1) + 20, LY(3) - 2, 'R2 RECEIVER', 'EAST WALL, PORT ??', 'left');
  label(ctx, 'BEAM TRAVELLING EAST', X(Z.x1) + 20, LY(3) + 10, 3.2, { color: INK2 });
  label(ctx, 'STANDBY LAMP: 2 BLINKS', X(Z.x1) + 20, LY(3) + 16, 3.2, { color: INK2 });
  // obstacles
  for (const [i, j] of O.obstacles) hatchRect(ctx, LX(i) - 0.4 * s, LY(j) - 0.4 * s, 0.8 * s, 0.8 * s, 1.4);
  // pedestals
  O.mirrors.forEach((mi) => {
    const px = LX(mi.i), py = LY(mi.j);
    ctx.fillStyle = FILL; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(px, py, 0.42 * s, 0, 7); ctx.fill(); ctx.stroke();
    label(ctx, mi.letter, px, py + 0.3, 7.5, { align: 'center', weight: 900 });
    if (mi.type === 'S') label(ctx, 'SPLITTER', px, py + 0.42 * s + 4, 3, { align: 'center', color: HOT, weight: 700 });
  });
  // doors
  const exitX = MAZE.x0 + m.maze.exitCol * MAZE.cell + MAZE.cell / 2;
  label(ctx, '▲ FROM UNDERCROFT', X(exitX), Y(Z.z1) + 18, 3.6, { align: 'center', weight: 700 });
  label(ctx, 'DOOR E →', X(Z.x1) + 20, Y(-56), 4, { weight: 700 });
  label(ctx, '(OPENS WHEN R1 + R2 BOTH LIT)', X(Z.x1) + 20, Y(-56) + 6, 3.2, { color: INK2 });
  // CAM-06 note
  const cam = CAMERAS.find((c) => c.id === 'CAM-06');
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(X(cam.pos[0]), Y(cam.pos[2]), 4, 0, 7); ctx.stroke();
  label(ctx, 'C06 = CEILING CAMERA (○), LOOKING DOWN', X(Z.x0), Y(Z.z1) + 30, 3.4, { weight: 700 });
  // right column: orientation legend + notes
  const rx = 500;
  label(ctx, 'MIRROR MOUNTS', rx, 70, 6, { weight: 700 });
  const lcx = rx + 60, lcy = 130, lr = 34;
  ctx.strokeStyle = INK2; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(lcx, lcy, lr, 0, 7); ctx.stroke();
  for (let o = 0; o < 8; o++) {
    const a = (o * Math.PI) / 8;
    ctx.strokeStyle = o === 0 ? INK : INK3; ctx.lineWidth = o === 0 ? 1.4 : 0.6;
    line(ctx, lcx - Math.cos(a) * lr, lcy + Math.sin(a) * lr, lcx + Math.cos(a) * lr, lcy - Math.sin(a) * lr);
  }
  label(ctx, '8 DETENTS, 22.5° EACH', lcx, lcy + lr + 8, 3.6, { align: 'center', color: INK2 });
  label(ctx, 'ON SITE:  [E] TURNS ONE DETENT CLOCKWISE (SEEN FROM ABOVE)', rx, lcy + lr + 20, 3.6, { color: INK2 });
  label(ctx, '          [Q] TURNS ONE DETENT ANTICLOCKWISE', rx, lcy + lr + 27, 3.6, { color: INK2 });
  label(ctx, 'NOTES', rx, 230, 6, { weight: 700 });
  [
    '1. FIVE FRONT-SURFACE MIRRORS + ONE HALF-SILVERED SPLITTER.',
    '   THE SPLITTER PASSES HALF THE BEAM AND REFLECTS HALF.',
    '2. THE BEAM IS INFRA-RED: VISIBLE ONLY ON C06 IN IR MODE.',
    '3. PILLARS (HATCHED) STOP THE BEAM.',
    '4. ALL WALL PORTS LOOK ALIKE ON C06. LIVE RECEIVERS SHOW AN AMBER STANDBY',
    '   LAMP UNDER THE PORT (HOODED: NOT VISIBLE FROM THE CEILING).',
    '5. DOOR E RELEASES WHEN R1 AND R2 ARE LIT AT THE SAME TIME.',
  ].forEach((n, i) => label(ctx, n, rx, 242 + i * 8, 3.7, { color: INK2 }));
  hand(ctx, 'C06 is mounted crooked —\nfind the emitter on screen first,\nthen turn the plan to match', rx, 320, 7.5);
  hand(ctx, 'GHOST cant see the beam.\nwe cant see the lamps.\nask which ports blink, then\n"turn B two clicks right"', rx, 370, 7.5, { rot: 0.03 });
  northArrow(ctx, rx + 20, 440);
  titleBlock(ctx, { sheet: 'O-1', title: 'OPTICS LAB', sub: 'BENCH LAYOUT · BEAM PATH HARDWARE', rev: 'B' });
  wear(ctx, rng);
}

// ------------------------------------------------------------------ V-1 vault
function vault(ctx, m) {
  const rng = seeded('V1', m.seed);
  paper(ctx, rng);
  const V = m.vault;
  label(ctx, 'SECURE STORE — VAULT DOOR SERVICE EXTRACT', 30, 30, 6, { weight: 700 });
  label(ctx, 'TABLE V-1  MANUFACTURER SCHEDULE (MODEL PLATE IS ON THE DOOR, UPPER LEFT)', 30, 46, 4.6, { weight: 700 });
  const rows = V.models.map((md) => [md.name, ...md.dirs, SIG_NAMES[md.trueSig]]);
  table(ctx, 30, 52, [{ w: 64, title: 'MODEL' }, { w: 26, title: 'WHEEL 1' }, { w: 26, title: 'WHEEL 2' }, { w: 26, title: 'WHEEL 3' }, { w: 40, title: 'TRUE GATE' }], rows, { rowH: 11, size: 5, weight: 700 });
  label(ctx, 'L = TURN LEFT / ANTICLOCKWISE — NUMBERS RISE.   R = TURN RIGHT / CLOCKWISE — NUMBERS FALL.', 30, 140, 3.8, { color: INK2 });
  // dial diagram
  const dx = 330, dy = 96, R = 40;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(dx, dy, R, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(dx, dy, R * 0.55, 0, 7); ctx.stroke();
  for (let n = 0; n < 100; n += 2) {
    const a = -Math.PI / 2 + (n / 100) * Math.PI * 2;
    const r0 = n % 10 === 0 ? R * 0.78 : R * 0.86;
    line(ctx, dx + Math.cos(a) * r0, dy + Math.sin(a) * r0, dx + Math.cos(a) * R * 0.95, dy + Math.sin(a) * R * 0.95);
    if (n % 10 === 0) label(ctx, String(n), dx + Math.cos(a) * R * 0.66, dy + Math.sin(a) * R * 0.66, 3.4, { align: 'center' });
  }
  ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(dx, dy - R - 1); ctx.lineTo(dx - 3, dy - R - 7); ctx.lineTo(dx + 3, dy - R - 7); ctx.fill();
  label(ctx, 'INDEX', dx, dy - R - 11, 3.4, { align: 'center', color: INK2 });
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(dx, dy, R + 9, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  arrowHead(ctx, dx + Math.cos(Math.PI * 1.15) * (R + 9), dy + Math.sin(Math.PI * 1.15) * (R + 9), Math.PI * 1.15 - Math.PI / 2, 3);
  label(ctx, 'L', dx - R - 14, dy - 22, 6, { weight: 700 });
  ctx.beginPath(); ctx.arc(dx, dy, R + 9, Math.PI * 1.55, Math.PI * 1.85); ctx.stroke();
  arrowHead(ctx, dx + Math.cos(Math.PI * 1.85) * (R + 9), dy + Math.sin(Math.PI * 1.85) * (R + 9), Math.PI * 1.85 + Math.PI / 2, 3);
  label(ctx, 'R', dx + R + 11, dy - 22, 6, { weight: 700 });
  // signatures
  label(ctx, 'FIG. V-2  CONTACT MICROPHONE SIGNATURES  (BMS · ACOUSTIC)', 30, 160, 4.8, { weight: 700 });
  const sigs = [['alpha', 'GATE TYPE α'], ['beta', 'GATE TYPE β'], ['gamma', 'GATE TYPE γ'], ['pickup', 'δ  WHEEL CAPTURED'], ['slip', m.diff?.key === 'ghost' ? 'ε  WHEEL SLIPPED — ALL WHEELS RESET' : 'ε  WHEEL SLIPPED — RE-DIAL THIS WHEEL']];
  sigs.forEach(([k, name], i) => {
    const x = 30 + (i % 3) * 200, y = 172 + Math.floor(i / 3) * 92, w = 180, h = 70;
    ctx.fillStyle = 'rgba(5,25,15,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK2; ctx.lineWidth = 0.4; ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(160,255,190,0.15)';
    for (let g = 1; g < 6; g++) line(ctx, x + (w * g) / 6, y, x + (w * g) / 6, y + h);
    line(ctx, x, y + h / 2, x + w, y + h / 2);
    ctx.strokeStyle = 'rgba(160,255,190,0.95)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    const span = k === 'pickup' ? 1.0 : 0.6;
    for (let p = 0; p <= 200; p++) {
      const t = (p / 200) * span - 0.02;
      const v = (SIG[k](Math.max(0, t)) || 0) + Math.sin(p * 1.7) * 0.012;
      const px = x + (p / 200) * w, py = y + h / 2 - v * h * 0.45;
      if (p) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    label(ctx, name, x + 4, y + h + 7, 4, { weight: 700 });
  });
  label(ctx, 'ONLY THE GATE TYPE LISTED FOR YOUR MODEL IS THE TRUE GATE. THE OTHER TWO TYPES ARE FENCE BOUNCES (DECOYS).', 30, 362, 3.8, { color: INK2 });
  label(ctx, 'A TRUE GATE ONLY SPEAKS WHEN THE DIAL IS TURNED IN THAT WHEEL\'S DIRECTION.', 30, 370, 3.8, { color: INK2 });
  // procedure
  label(ctx, 'DIALLING PROCEDURE', 30, 392, 6, { weight: 700 });
  [
    '1. READ THE MODEL PLATE. FIND THE MODEL IN TABLE V-1.',
    '2. WHEEL 1: SPIN THE DIAL IN WHEEL 1\'S DIRECTION UNTIL THE OPERATOR FEELS IT DRAG. EVERY GATE DRAGS — TRUE OR FALSE.',
    '3. THE BMS STAMPS EACH GATE SIGNATURE WITH THE DIAL NUMBER. THE ONE SHAPED LIKE YOUR MODEL\'S TRUE GATE IS IT: DIAL BACK TO IT, [SET].',
    m.diff?.key === 'ghost' ? '4. δ = CAPTURED, CONTINUE WITH THE NEXT WHEEL.   ε = SLIPPED, START AGAIN FROM WHEEL 1.'
      : '4. δ = CAPTURED, CONTINUE WITH THE NEXT WHEEL.   ε = SLIPPED, FIND THIS WHEEL\'S GATE AGAIN.',
    '5. AFTER THREE CAPTURES PULL THE HANDLE.  PULLING EARLY SOUNDS THE TAMPER ALARM.',
  ].forEach((n, i) => label(ctx, n, 30, 404 + i * 8.5, 4, { color: INK2 }));
  hand(ctx, 'which peak is TALLER —\nfirst or second? thats the\nwhole trick with α and β', 640, 190, 8);
  hand(ctx, 'GHOST feels every drag the same.\nonly we can see which is real.', 430, 470, 7.5, { rot: 0.02 });
  hand(ctx, 'each wheel has 3 drags, 1 real.\nthe scope prints the number\nunder every gate it hears', 640, 270, 7.5, { rot: -0.04 });
  stamp(ctx, 'RESTRICTED', 700, 80, 14, 0.18, rng);
  titleBlock(ctx, { sheet: 'V-1', title: 'VAULT DOOR SERVICE', sub: 'MODELS · SIGNATURES · PROCEDURE', rev: 'D' });
  wear(ctx, rng);
}

export const SHEETS = [
  { id: '00', name: 'COVER', draw: cover },
  { id: 'A-1', name: 'SITE', draw: site },
  { id: 'A-2', name: 'ACCESS', draw: access },
  { id: 'E-1', name: 'PATCH FRAME', draw: patch },
  { id: 'M-1', name: 'UNDERCROFT', draw: undercroft },
  { id: 'O-1', name: 'OPTICS', draw: optics },
  { id: 'V-1', name: 'VAULT', draw: vault },
];
export { SHEET_W, SHEET_H };
