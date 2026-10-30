// The 16 "unnameable" glyphs. Players have to invent their own names for them over voice.
// Same stroke data feeds the 3D panel textures and the blueprint, so they always match.
// Coordinates are in a unit box, y down. A few pairs are deliberately confusable
// (1/2 dot side, 5/6 comb up or down, 3/9 slant direction).

const P = Math.PI;

export const GLYPHS = [
  // 0 fork
  [{ l: [0.5, 0.88, 0.5, 0.42] }, { p: [0.24, 0.14, 0.24, 0.42, 0.76, 0.42, 0.76, 0.14] }, { l: [0.5, 0.42, 0.5, 0.2] }],
  // 1 ring, dot left
  [{ c: [0.5, 0.5, 0.33] }, { d: [0.33, 0.5] }],
  // 2 ring, dot right
  [{ c: [0.5, 0.5, 0.33] }, { d: [0.67, 0.5] }],
  // 3 ladder, rung rising to the right
  [{ l: [0.28, 0.14, 0.28, 0.86] }, { l: [0.72, 0.14, 0.72, 0.86] }, { l: [0.28, 0.66, 0.72, 0.34] }],
  // 4 hourglass
  [{ p: [0.24, 0.14, 0.76, 0.14, 0.24, 0.86, 0.76, 0.86, 0.24, 0.14] }],
  // 5 comb, teeth down
  [{ l: [0.14, 0.28, 0.86, 0.28] }, { l: [0.24, 0.28, 0.24, 0.76] }, { l: [0.5, 0.28, 0.5, 0.76] }, { l: [0.76, 0.28, 0.76, 0.76] }],
  // 6 comb, teeth up
  [{ l: [0.14, 0.72, 0.86, 0.72] }, { l: [0.24, 0.72, 0.24, 0.24] }, { l: [0.5, 0.72, 0.5, 0.24] }, { l: [0.76, 0.72, 0.76, 0.24] }],
  // 7 hook with arrowhead
  [{ a: [0.46, 0.56, 0.26, 0, P] }, { l: [0.72, 0.56, 0.72, 0.14] }, { p: [0.58, 0.28, 0.72, 0.12, 0.86, 0.28] }],
  // 8 diamond with bar
  [{ p: [0.5, 0.12, 0.86, 0.5, 0.5, 0.88, 0.14, 0.5, 0.5, 0.12] }, { l: [0.06, 0.5, 0.94, 0.5] }],
  // 9 ladder, rung falling to the right
  [{ l: [0.28, 0.14, 0.28, 0.86] }, { l: [0.72, 0.14, 0.72, 0.86] }, { l: [0.28, 0.34, 0.72, 0.66] }],
  // 10 bolt
  [{ p: [0.62, 0.1, 0.34, 0.52, 0.66, 0.48, 0.38, 0.9] }],
  // 11 rainbow over dot
  [{ a: [0.5, 0.62, 0.36, P, 2 * P] }, { a: [0.5, 0.62, 0.2, P, 2 * P] }, { d: [0.5, 0.82] }],
  // 12 key
  [{ c: [0.28, 0.5, 0.15] }, { l: [0.43, 0.5, 0.9, 0.5] }, { l: [0.7, 0.5, 0.7, 0.68] }, { l: [0.84, 0.5, 0.84, 0.64] }],
  // 13 wave over line
  [{ p: [0.1, 0.44, 0.22, 0.3, 0.36, 0.44, 0.5, 0.58, 0.64, 0.44, 0.78, 0.3, 0.9, 0.44] }, { l: [0.12, 0.76, 0.88, 0.76] }],
  // 14 five-armed asterisk
  [{ l: [0.5, 0.5, 0.5, 0.12] }, { l: [0.5, 0.5, 0.86, 0.38] }, { l: [0.5, 0.5, 0.72, 0.84] }, { l: [0.5, 0.5, 0.28, 0.84] }, { l: [0.5, 0.5, 0.14, 0.38] }],
  // 15 gate with dot
  [{ p: [0.24, 0.86, 0.24, 0.22, 0.76, 0.22, 0.76, 0.86] }, { d: [0.5, 0.6] }],
];

export const GLYPH_COUNT = GLYPHS.length;

// Draw glyph `id` into a canvas 2D context, filling the box (x, y, size).
export function drawGlyph(ctx, id, x, y, size, opts = {}) {
  const g = GLYPHS[id];
  const lw = opts.lineWidth ?? size * 0.085;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (opts.color) { ctx.strokeStyle = opts.color; ctx.fillStyle = opts.color; }
  const S = (v) => v * size;
  for (const s of g) {
    ctx.beginPath();
    if (s.l) {
      ctx.moveTo(S(s.l[0]), S(s.l[1]));
      ctx.lineTo(S(s.l[2]), S(s.l[3]));
      ctx.stroke();
    } else if (s.p) {
      ctx.moveTo(S(s.p[0]), S(s.p[1]));
      for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(S(s.p[i]), S(s.p[i + 1]));
      ctx.stroke();
    } else if (s.c) {
      ctx.arc(S(s.c[0]), S(s.c[1]), S(s.c[2]), 0, P * 2);
      ctx.stroke();
    } else if (s.a) {
      ctx.arc(S(s.a[0]), S(s.a[1]), S(s.a[2]), s.a[3], s.a[4]);
      ctx.stroke();
    } else if (s.d) {
      ctx.arc(S(s.d[0]), S(s.d[1]), lw * 0.95, 0, P * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
