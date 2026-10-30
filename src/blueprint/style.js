// Cyanotype drafting kit. Sheets are drawn in millimetres on an A1 sheet (841 x 594) so they can be
// re-rendered crisply at any zoom. All "random" wear is seeded so re-renders match.

import { Rng } from '../../shared/rng.js';

export const SHEET_W = 841, SHEET_H = 594;
export let INK = 'rgba(228,240,255,0.94)';
export let INK2 = 'rgba(205,226,250,0.62)';
export let INK3 = 'rgba(190,215,245,0.28)';
export let RED = 'rgba(255,92,72,0.9)';
export let STAMP = 'rgba(236,84,64,0.78)';
export let THEME = 'cyan';
export let FILL = '#0f3a70';
export let TINT = 'rgba(30,90,160,0.22)';
export let HOT = '#ffd9cf';
// 'print' = dark lines on white paper (ink-saving printouts)
export function setTheme(t) {
  THEME = t;
  if (t === 'print') { FILL = '#ffffff'; TINT = 'rgba(20,40,80,0.05)'; HOT = 'rgba(200,30,20,0.9)'; INK = 'rgba(15,30,60,0.95)'; INK2 = 'rgba(20,40,80,0.7)'; INK3 = 'rgba(20,40,80,0.3)'; RED = 'rgba(200,30,20,0.9)'; STAMP = 'rgba(200,40,30,0.75)'; }
  else { FILL = '#0f3a70'; TINT = 'rgba(30,90,160,0.22)'; HOT = '#ffd9cf'; INK = 'rgba(228,240,255,0.94)'; INK2 = 'rgba(205,226,250,0.62)'; INK3 = 'rgba(190,215,245,0.28)'; RED = 'rgba(255,92,72,0.9)'; STAMP = 'rgba(236,84,64,0.78)'; }
}
export const FONT = '"Helvetica Neue", "Arial Narrow", Arial, sans-serif';
export const MONO = '"Courier New", "Menlo", monospace';
export const HAND = '"Marker Felt", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';

export function paper(ctx, rng) {
  if (THEME === 'print') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SHEET_W, SHEET_H);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(12, 12, SHEET_W - 24, SHEET_H - 24);
    ctx.lineWidth = 0.4; ctx.strokeRect(16, 16, SHEET_W - 32, SHEET_H - 32);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, SHEET_W, SHEET_H);
  g.addColorStop(0, '#164985'); g.addColorStop(0.55, '#123f78'); g.addColorStop(1, '#0e3466');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  // mottling
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rng.chance(0.5) ? '255,255,255' : '0,10,30'},${rng.float(0.01, 0.035)})`;
    ctx.beginPath();
    ctx.ellipse(rng.float(0, SHEET_W), rng.float(0, SHEET_H), rng.float(10, 60), rng.float(8, 40), rng.float(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  // grid
  ctx.lineWidth = 0.15;
  ctx.strokeStyle = 'rgba(200,225,255,0.07)';
  ctx.beginPath();
  for (let x = 20; x <= SHEET_W - 20; x += 5) { ctx.moveTo(x, 20); ctx.lineTo(x, SHEET_H - 20); }
  for (let y = 20; y <= SHEET_H - 20; y += 5) { ctx.moveTo(20, y); ctx.lineTo(SHEET_W - 20, y); }
  ctx.stroke();
  ctx.lineWidth = 0.3;
  ctx.strokeStyle = 'rgba(200,225,255,0.11)';
  ctx.beginPath();
  for (let x = 20; x <= SHEET_W - 20; x += 25) { ctx.moveTo(x, 20); ctx.lineTo(x, SHEET_H - 20); }
  for (let y = 20; y <= SHEET_H - 20; y += 25) { ctx.moveTo(20, y); ctx.lineTo(SHEET_W - 20, y); }
  ctx.stroke();
  // frame with zone marks
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.strokeRect(12, 12, SHEET_W - 24, SHEET_H - 24);
  ctx.lineWidth = 0.4; ctx.strokeRect(16, 16, SHEET_W - 32, SHEET_H - 32);
  ctx.font = `5px ${FONT}`; ctx.fillStyle = INK2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { const x = 16 + ((SHEET_W - 32) * (i + 0.5)) / 8; ctx.fillText(String(i + 1), x, 14); ctx.fillText(String(i + 1), x, SHEET_H - 14); }
  for (let i = 0; i < 6; i++) { const y = 16 + ((SHEET_H - 32) * (i + 0.5)) / 6; ctx.fillText('ABCDEF'[i], 14, y); ctx.fillText('ABCDEF'[i], SHEET_W - 14, y); }
}

export function wear(ctx, rng) {
  if (THEME === 'print') return;
  // fold creases (sheet folded in 4 x 2)
  for (let i = 1; i < 4; i++) {
    const x = (SHEET_W * i) / 4 + rng.float(-3, 3);
    const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,8,25,0.18)'); g.addColorStop(0.55, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 6, 0, 12, SHEET_H);
  }
  const y = SHEET_H / 2 + rng.float(-3, 3);
  const gy = ctx.createLinearGradient(0, y - 6, 0, y + 6);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.45, 'rgba(0,8,25,0.18)'); gy.addColorStop(0.55, 'rgba(255,255,255,0.07)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy; ctx.fillRect(0, y - 6, SHEET_W, 12);
  // coffee rings
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    const cx = rng.float(80, SHEET_W - 80), cy = rng.float(80, SHEET_H - 80), r = rng.float(22, 34);
    ctx.strokeStyle = 'rgba(70,40,10,0.22)'; ctx.lineWidth = rng.float(1.5, 3);
    ctx.beginPath(); ctx.arc(cx, cy, r, rng.float(0, 1), rng.float(4.5, 6.2)); ctx.stroke();
    ctx.fillStyle = 'rgba(70,40,10,0.06)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 1, r * 0.95, 0, 7); ctx.fill();
  }
  // edge darkening + torn corner
  const v = ctx.createRadialGradient(SHEET_W / 2, SHEET_H / 2, SHEET_H * 0.4, SHEET_W / 2, SHEET_H / 2, SHEET_W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,5,20,0.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, SHEET_W, SHEET_H);
}

export function titleBlock(ctx, { sheet, title, sub, rev = 'C', date = '1984-02-17', scale = 'AS NOTED' }) {
  const x = SHEET_W - 16 - 230, y = SHEET_H - 16 - 62, w = 230, h = 62;
  ctx.fillStyle = FILL; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 0.4;
  line(ctx, x, y + 14, x + w, y + 14); line(ctx, x, y + 40, x + w, y + 40); line(ctx, x + 170, y + 14, x + 170, y + h); line(ctx, x + 110, y + 40, x + 110, y + h);
  label(ctx, 'KESTREL-9 RESEARCH ANNEX · SECTOR B · AS-BUILT RECORD SET', x + 4, y + 8, 4.2, { color: INK2 });
  label(ctx, title, x + 4, y + 24, 8.5, { weight: 700 });
  label(ctx, sub || '', x + 4, y + 34, 4.6, { color: INK2 });
  label(ctx, 'SHEET', x + 174, y + 20, 3.8, { color: INK2 });
  label(ctx, sheet, x + 200, y + 31, 13, { weight: 700, align: 'center' });
  label(ctx, `DRN R.HALVORSEN  CHK M.K.  ${date}`, x + 4, y + 48, 3.8, { color: INK2 });
  label(ctx, `SCALE ${scale}`, x + 4, y + 56, 3.8, { color: INK2 });
  label(ctx, 'REV', x + 114, y + 48, 3.8, { color: INK2 });
  label(ctx, rev, x + 140, y + 55, 10, { weight: 700, align: 'center' });
  label(ctx, 'SECRET', x + 200, y + 52, 6, { weight: 700, align: 'center', color: STAMP });
}

export function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

export function label(ctx, text, x, y, size, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 400} ${size}px ${opts.font || FONT}`;
  ctx.fillStyle = opts.color || INK;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); ctx.fillText(text, 0, 0); }
  else ctx.fillText(text, x, y);
  ctx.restore();
}

export function hand(ctx, text, x, y, size, opts = {}) {
  const lines = String(text).split('\n');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.rot ?? -0.03);
  ctx.font = `${size}px ${HAND}`;
  ctx.fillStyle = opts.color || RED;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 0, i * size * 1.2));
  ctx.restore();
}

export function stamp(ctx, text, x, y, size, rot = -0.15, rng, color = STAMP) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `900 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size * 0.09;
  ctx.strokeRect(-w / 2 - size * 0.35, -size * 0.75, w + size * 0.7, size * 1.5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.04);
  // distress
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(rng.float(-w / 2 - size, w / 2 + size), rng.float(-size, size), rng.float(0.3, 1.5), rng.float(0.3, 1.5)); }
  ctx.restore();
}

export function arrowHead(ctx, x, y, ang, s = 2.4) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.35) * s, y - Math.sin(ang - 0.35) * s);
  ctx.lineTo(x - Math.cos(ang + 0.35) * s, y - Math.sin(ang + 0.35) * s);
  ctx.closePath(); ctx.fill();
}

export function dim(ctx, x1, y1, x2, y2, text, off = 6) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off;
  ctx.save();
  ctx.strokeStyle = INK2; ctx.fillStyle = INK2; ctx.lineWidth = 0.25;
  line(ctx, x1, y1, x1 + nx * 1.2, y1 + ny * 1.2); line(ctx, x2, y2, x2 + nx * 1.2, y2 + ny * 1.2);
  line(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny);
  arrowHead(ctx, x1 + nx, y1 + ny, ang + Math.PI, 1.8); arrowHead(ctx, x2 + nx, y2 + ny, ang, 1.8);
  label(ctx, text, (x1 + x2) / 2 + nx * 1.6, (y1 + y2) / 2 + ny * 1.6, 3.2, { align: 'center', color: INK2, rot: Math.abs(ang) > 1.2 ? ang : 0 });
  ctx.restore();
}

export function hatchRect(ctx, x, y, w, h, gap = 1.6) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = INK3; ctx.lineWidth = 0.3;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += gap) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, w, h);
}

export function cloud(ctx, x, y, w, h, color = RED) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 0.7;
  const r = 4;
  ctx.beginPath();
  for (let i = 0; i < w; i += r * 1.6) ctx.arc(x + i + r * 0.8, y, r, Math.PI, 0);
  for (let i = 0; i < h; i += r * 1.6) ctx.arc(x + w, y + i + r * 0.8, r, -Math.PI / 2, Math.PI / 2);
  for (let i = w; i > 0; i -= r * 1.6) ctx.arc(x + i - r * 0.8, y + h, r, 0, Math.PI);
  for (let i = h; i > 0; i -= r * 1.6) ctx.arc(x, y + i - r * 0.8, r, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
}

export function triangleTag(ctx, x, y, t, color = RED) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); ctx.stroke();
  label(ctx, t, x, y + 0.6, 3.4, { align: 'center', color, weight: 700 });
  ctx.restore();
}

export function callout(ctx, x, y, r, top, bottom) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  line(ctx, x - r, y, x + r, y);
  label(ctx, top, x, y - r * 0.42, r * 0.7, { align: 'center', weight: 700 });
  label(ctx, bottom, x, y + r * 0.45, r * 0.5, { align: 'center', color: INK2 });
  ctx.restore();
}

export function northArrow(ctx, x, y, s = 12) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x + s * 0.3, y + s * 0.5); ctx.lineTo(x, y + s * 0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x - s * 0.3, y + s * 0.5); ctx.lineTo(x, y + s * 0.2); ctx.closePath(); ctx.stroke();
  label(ctx, 'N', x, y - s - 4, 5, { align: 'center', weight: 700 });
  ctx.restore();
}

export function scaleBar(ctx, x, y, mmPerM, meters = 10) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 0.4;
  for (let i = 0; i < meters; i++) {
    const x0 = x + i * mmPerM;
    if (i % 2 === 0) ctx.fillRect(x0, y, mmPerM, 2); else ctx.strokeRect(x0, y, mmPerM, 2);
  }
  label(ctx, '0', x, y + 6, 3, { align: 'center' });
  label(ctx, `${meters} m`, x + meters * mmPerM, y + 6, 3, { align: 'center' });
  ctx.restore();
}

export function table(ctx, x, y, cols, rows, opts = {}) {
  // cols: [{w, title}], rows: array of arrays of (string | fn(ctx, cx, cy, w, h))
  const rh = opts.rowH || 9, hh = opts.headH || 10;
  const W = cols.reduce((a, c) => a + c.w, 0);
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, W, hh + rh * rows.length);
  ctx.lineWidth = 0.3;
  let cx = x;
  cols.forEach((c, i) => {
    if (i) line(ctx, cx, y, cx, y + hh + rh * rows.length);
    label(ctx, c.title, cx + c.w / 2, y + hh / 2, opts.headSize || 3.6, { align: 'center', weight: 700 });
    cx += c.w;
  });
  line(ctx, x, y + hh, x + W, y + hh);
  rows.forEach((r, ri) => {
    const yy = y + hh + ri * rh;
    if (ri) { ctx.strokeStyle = INK3; line(ctx, x, yy, x + W, yy); ctx.strokeStyle = INK; }
    let xx = x;
    r.forEach((cell, ci) => {
      const w = cols[ci].w;
      if (typeof cell === 'function') cell(ctx, xx + w / 2, yy + rh / 2, w, rh);
      else label(ctx, String(cell), xx + w / 2, yy + rh / 2, opts.size || 4.2, { align: 'center', font: opts.font || FONT, weight: opts.weight || 400, color: opts.color });
      xx += w;
    });
  });
  ctx.restore();
  return { w: W, h: hh + rh * rows.length };
}

export const seeded = (sheet, seed) => new Rng(`${seed}|bp|${sheet}`);
