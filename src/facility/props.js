import * as THREE from 'three';
import { PAL, stencilText, makeMatrix, bevelBoxGeometry } from '../engine/kit.js';

// Room shell, doors and set dressing. Everything flat-coloured and chunky.

const T = 0.3; // wall thickness

// openings: [{ side:'N'|'S'|'E'|'W', at, w, h }]
export function room(B, r) {
  const { x0, x1, z0, z1, h } = r;
  const floor = r.floor ?? PAL.floor, ceil = r.ceil ?? PAL.ceiling;
  const lower = r.lower ?? PAL.wallGreen, upper = r.upper ?? PAL.wallCream;
  const band = r.band ?? 1.25;
  if (!r.noFloor) B.slab(x0 - T, -0.25, z0 - T, x1 + T, 0, z1 + T, floor, { grad: 0, jitter: 0.02 });
  if (!r.noCeil) B.slab(x0 - T, h, z0 - T, x1 + T, h + 0.25, z1 + T, ceil, { grad: 0, jitter: 0.02 });
  const sides = {
    N: { a0: x0 - T, a1: x1 + T, fixed: [z0 - T, z0], axis: 'x' },
    S: { a0: x0 - T, a1: x1 + T, fixed: [z1, z1 + T], axis: 'x' },
    W: { a0: z0, a1: z1, fixed: [x0 - T, x0], axis: 'z' },
    E: { a0: z0, a1: z1, fixed: [x1, x1 + T], axis: 'z' },
  };
  for (const [side, s] of Object.entries(sides)) {
    if (r.skip && r.skip.includes(side)) continue;
    const ops = (r.openings || []).filter((o) => o.side === side).sort((a, b) => a.at - b.at);
    let cur = s.a0;
    const seg = (a, b, y0, y1, collide) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      const p = s.axis === 'x' ? [a, y0, s.fixed[0], b, y1, s.fixed[1]] : [s.fixed[0], y0, a, s.fixed[1], y1, b];
      const yb = Math.min(Math.max(band, y0), y1);
      if (yb > y0) B.slab(p[0], y0, p[2], p[3], yb, p[5], lower, { collide, grad: 0.35 });
      if (y1 > yb) B.slab(p[0], yb, p[2], p[3], y1, p[5], upper, { collide, grad: 0.15 });
      if (r.trim !== false && yb > y0 && y1 > yb) {
        const q = s.axis === 'x'
          ? [a, yb - 0.04, s.fixed[0] + (side === 'N' ? 0.02 : -0.02), b, yb + 0.04, s.fixed[1] + (side === 'N' ? 0.02 : -0.02)]
          : [s.fixed[0] + (side === 'W' ? 0.02 : -0.02), yb - 0.04, a, s.fixed[1] + (side === 'W' ? 0.02 : -0.02), yb + 0.04, b];
        B.slab(q[0], q[1], q[2], q[3], q[4], q[5], PAL.metalDark, { grad: 0 });
      }
    };
    for (const o of ops) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      seg(cur, a, 0, h, true);
      seg(a, b, o.h, h, true); // lintel
      cur = b;
    }
    seg(cur, s.a1, 0, h, true);
  }
  // skirting shadow line
  return B;
}

// Fluorescent fixture hanging from the ceiling, with a light anchor.
export function fixture(B, x, y, z, opts = {}) {
  const len = opts.len ?? 1.3, along = opts.along ?? 'z';
  const w = along === 'x' ? len : 0.26, d = along === 'x' ? 0.26 : len;
  B.box(x, y - 0.05, z, w, 0.08, d, PAL.metal, { grad: 0 });
  const dead = opts.dead;
  B.box(x, y - 0.11, z, w * 0.86, 0.04, d * 0.86, dead ? 0x55574f : opts.color ?? 0xe8f4ff, { glow: !dead, grad: 0 });
  if (!dead) B.light(x, y - 0.35, z, opts.color ?? 0xcfe6ff, opts.intensity ?? 2.2, opts.distance ?? 9, { flicker: opts.flicker || 0, room: opts.room, id: opts.id });
  // chains
  B.box(x, y + 0.1, z - d / 3, 0.02, 0.2, 0.02, PAL.metalDark).box(x, y + 0.1, z + d / 3, 0.02, 0.2, 0.02, PAL.metalDark);
}

export function emergencyLamp(B, x, y, z, ry = 0, opts = {}) {
  B.box(x, y, z, 0.22, 0.14, 0.12, PAL.metalDark, { ry, grad: 0 });
  const ox = Math.sin(ry) * 0.07, oz = Math.cos(ry) * 0.07;
  B.box(x + ox, y, z + oz, 0.16, 0.09, 0.05, opts.color ?? 0xff2a1a, { ry, glow: true, grad: 0 });
  B.light(x + ox * 4, y, z + oz * 4, opts.color ?? 0xff3020, opts.intensity ?? 0.9, opts.distance ?? 5, { room: opts.room, flicker: opts.flicker || 0, id: opts.id });
}

export function crate(B, x, z, s = 0.9, opts = {}) {
  const y = (opts.y ?? 0) + s / 2;
  B.box(x, y, z, s, s, s, opts.color ?? PAL.wood, { bevel: 0.04, ry: opts.ry || 0, collide: opts.collide ?? true });
  B.box(x, y, z, s * 1.02, s * 0.14, s * 1.02, PAL.woodDark, { ry: opts.ry || 0 });
}

export function barrel(B, x, z, opts = {}) {
  const c = opts.color ?? PAL.rust;
  if (opts.tipped) {
    B.cyl(x, 0.3, z, 0.3, 0.88, c, { rz: Math.PI / 2, ry: opts.ry || 0, sides: 8 });
    B.world.addCollider(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 0, 0.6);
    return;
  }
  B.cyl(x, 0.44, z, 0.3, 0.88, c, { sides: 8, collide: true });
  B.cyl(x, 0.3, z, 0.31, 0.05, PAL.metalDark, { sides: 8 }).cyl(x, 0.62, z, 0.31, 0.05, PAL.metalDark, { sides: 8 });
}

export function desk(B, x, z, ry = 0, opts = {}) {
  const w = opts.w ?? 1.4, d = opts.d ?? 0.7;
  const c = Math.cos(ry), s = Math.sin(ry);
  const loc = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  B.box(x, 0.74, z, w, 0.05, d, opts.color ?? PAL.metal, { ry, collide: true, grad: 0 });
  for (const [lx, lz] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) {
    const [px, pz] = loc(lx, lz);
    B.box(px, 0.36, pz, 0.05, 0.72, 0.05, PAL.metalDark, { ry });
  }
  const [dx, dz] = loc(w / 2 - 0.25, 0);
  B.box(dx, 0.45, dz, 0.4, 0.5, d - 0.08, PAL.steel, { ry });
}

export function chair(B, x, z, ry = 0, tipped = false) {
  if (tipped) {
    B.box(x, 0.25, z, 0.45, 0.05, 0.45, PAL.olive, { ry, rz: 1.3 });
    B.box(x + 0.2, 0.2, z, 0.05, 0.42, 0.45, PAL.olive, { ry, rz: 0.2 });
    return;
  }
  B.box(x, 0.45, z, 0.45, 0.06, 0.45, PAL.olive, { ry, bevel: 0.02 });
  const bx = x - Math.sin(ry) * 0.2, bz = z - Math.cos(ry) * 0.2;
  B.box(bx, 0.75, bz, 0.45, 0.5, 0.05, PAL.olive, { ry, bevel: 0.02 });
  B.cyl(x, 0.22, z, 0.03, 0.44, PAL.metalDark, { sides: 6 });
  B.box(x, 0.03, z, 0.5, 0.04, 0.08, PAL.metalDark, { ry }).box(x, 0.03, z, 0.08, 0.04, 0.5, PAL.metalDark, { ry });
}

// Old CRT monitor; screen glow optional.
export function crt(B, x, y, z, ry = 0, opts = {}) {
  B.box(x, y + 0.17, z, 0.4, 0.34, 0.38, opts.color ?? 0xb9b29a, { ry, bevel: 0.03 });
  const fx = Math.sin(ry) * 0.195, fz = Math.cos(ry) * 0.195;
  B.box(x + fx, y + 0.18, z + fz, 0.3, 0.22, 0.01, opts.on ? opts.screen ?? 0x2a6a3a : 0x1d2320, { ry, glow: !!opts.on, grad: 0 });
  B.box(x, y + 0.01, z, 0.26, 0.03, 0.22, PAL.metalDark, { ry });
}

export function pipeRun(B, x0, y, z0, x1, z1, opts = {}) {
  const r = opts.r ?? 0.07, c = opts.color ?? PAL.pipe;
  B.pipe(x0, y, z0, x1, z1, r, c);
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 2.5);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    B.box(x0 + (x1 - x0) * t, y + r + 0.08, z0 + (z1 - z0) * t, 0.04, 0.2, 0.04, PAL.metalDark);
  }
}

export function cableTray(B, x0, y, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(cx, y, cz, 0.4, 0.03, len, PAL.metalDark, { ry, grad: 0 });
  B.box(cx, y + 0.05, cz, 0.3, 0.06, len, PAL.cable, { ry, grad: 0 });
}

// Wall-mounted CCTV camera prop (the GHOST can see these and wave at LINE).
export function cameraProp(B, pos, look) {
  const [x, y, z] = pos;
  const dx = look[0] - x, dz = look[2] - z;
  const ry = Math.atan2(dx, dz);
  const pitch = Math.atan2(look[1] - y, Math.hypot(dx, dz));
  const back = 0.18;
  B.box(x - Math.sin(ry) * back, y + 0.12, z - Math.cos(ry) * back, 0.06, 0.24, 0.06, PAL.metalDark, { ry });
  B.box(x, y, z, 0.16, 0.15, 0.34, 0xc7c3b4, { ry, rx: -pitch, bevel: 0.03 });
  B.box(x + Math.sin(ry) * 0.18, y + Math.sin(pitch) * 0.18, z + Math.cos(ry) * 0.18, 0.1, 0.1, 0.03, PAL.black, { ry, rx: -pitch });
  B.box(x + Math.sin(ry) * 0.12 + Math.cos(ry) * 0.05, y + 0.06, z + Math.cos(ry) * 0.12 - Math.sin(ry) * 0.05, 0.025, 0.025, 0.025, 0xff2020, { glow: true, ry });
}

export function papers(B, x, z, n = 6, spread = 1.2) {
  for (let i = 0; i < n; i++) {
    B.box(x + (Math.random() - 0.5) * spread, 0.006 + i * 0.001, z + (Math.random() - 0.5) * spread, 0.21, 0.004, 0.29, PAL.paper, { ry: Math.random() * 6, grad: 0, jitter: 0.15 });
  }
}

export function debris(B, x, z, n = 5, spread = 0.8) {
  for (let i = 0; i < n; i++) {
    const s = 0.08 + Math.random() * 0.22;
    B.box(x + (Math.random() - 0.5) * spread, s / 3, z + (Math.random() - 0.5) * spread, s, s * 0.6, s * 0.9, Math.random() < 0.5 ? PAL.concrete : PAL.concreteDark, { ry: Math.random() * 6, rx: Math.random(), bevel: s * 0.2 });
  }
}

export function shelf(B, x, z, ry = 0, opts = {}) {
  const w = opts.w ?? 1.8, d = 0.5, h = opts.h ?? 2;
  B.box(x, h / 2, z, w, h, d, PAL.metalDark, { ry, collide: opts.collide ?? true, grad: 0.2 }); // body (approximate solid)
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = 0; k < 4; k++) {
    const y = 0.3 + k * (h - 0.3) / 3.2;
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.35) continue;
      const lx = -w / 2 + 0.3 + i * (w - 0.6) / 2;
      const bw = 0.3 + Math.random() * 0.2;
      B.box(x + lx * c + 0.27 * s, y + 0.15, z - lx * s + 0.27 * c, bw, 0.28, 0.12, Math.random() < 0.5 ? 0x8b7d5c : 0x6f6a5b, { ry: ry + (Math.random() - 0.5) * 0.2 });
    }
  }
}

// Sign decal drawers ----------------------------------------------------------
export function drawSign(lines, { bg = '#c9c1a6', fg = '#1c1c1c', stripe = null, border = true, sizes } = {}) {
  return (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (stripe) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, h * 0.22); ctx.clip();
      for (let i = -h; i < w + h; i += h * 0.22) {
        ctx.fillStyle = stripe; ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + h * 0.11, 0); ctx.lineTo(i + h * 0.33, h * 0.22); ctx.lineTo(i + h * 0.22, h * 0.22); ctx.fill();
      }
      ctx.restore();
    }
    if (border) { ctx.strokeStyle = fg; ctx.lineWidth = h * 0.04; ctx.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08); }
    const top = stripe ? h * 0.26 : 0;
    const n = lines.length;
    lines.forEach((t, i) => {
      const sz = sizes?.[i] ?? (h - top) / (n + 0.9) * 0.78;
      stencilText(ctx, t, w / 2, top + (h - top) * ((i + 0.75) / (n + 0.5)), sz, fg, { wear: 0.25 });
    });
    // grime
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#3a3324'; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * h * 0.3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
}

export function drawStencil(text, color = '#cfc8b0', size = 0.8, opts = {}) {
  return (ctx, w, h) => stencilText(ctx, text, w / 2, h / 2, h * size, color, { wear: opts.wear ?? 0.6, spacing: opts.spacing, font: opts.font });
}

// Sliding/lifting bulkhead ---------------------------------------------------
// Returns a door controller; geometry is its own mesh so it can move.
export function makeDoor(world, B, { id, x, z, axis, w = 1.6, h = 2.4, mode = 'lift', color = PAL.steel, stripes = true, label, depth = 0.18, frame = true }) {
  const group = new THREE.Group();
  const panel = new THREE.Group();
  group.add(panel);
  const g = new THREE.BoxGeometry(axis === 'x' ? w : depth, h, axis === 'x' ? depth : w);
  const mats = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.15 });
  const body = new THREE.Mesh(g, mats);
  body.castShadow = body.receiveShadow = true;
  body.position.y = h / 2;
  panel.add(body);
  if (stripes) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#f2c230'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#1b1b1b';
    for (let i = -64; i < 256 + 64; i += 32) { c.beginPath(); c.moveTo(i, 64); c.lineTo(i + 16, 64); c.lineTo(i + 48, 0); c.lineTo(i + 32, 0); c.fill(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    for (const sgn of [1, -1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, 0.28), sm);
      s.position.y = 0.22;
      if (axis === 'x') { s.position.z = sgn * (depth / 2 + 0.004); s.rotation.y = sgn > 0 ? 0 : Math.PI; }
      else { s.position.x = sgn * (depth / 2 + 0.004); s.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2; }
      panel.add(s);
    }
  }
  if (label) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d');
    stencilText(c, label, 128, 64, 70, '#d8d2bc', { wear: 0.5 });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.9 });
    for (const sgn of [1, -1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.6, 1.0), 0.5), lm);
      s.position.y = h * 0.62;
      if (axis === 'x') { s.position.z = sgn * (depth / 2 + 0.006); s.rotation.y = sgn > 0 ? 0 : Math.PI; }
      else { s.position.x = sgn * (depth / 2 + 0.006); s.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2; }
      panel.add(s);
    }
  }
  group.position.set(x, 0, z);
  world.scene.add(group);
  if (frame) {
    const fw = 0.16;
    if (axis === 'x') {
      B.box(x - w / 2 - fw / 2, h / 2 + 0.05, z, fw, h + 0.1, depth + 0.2, PAL.metalDark, { grad: 0.1 });
      B.box(x + w / 2 + fw / 2, h / 2 + 0.05, z, fw, h + 0.1, depth + 0.2, PAL.metalDark, { grad: 0.1 });
      B.box(x, h + 0.13, z, w + fw * 2, 0.16, depth + 0.2, PAL.metalDark, { grad: 0.1 });
    } else {
      B.box(x, h / 2 + 0.05, z - w / 2 - fw / 2, depth + 0.2, h + 0.1, fw, PAL.metalDark, { grad: 0.1 });
      B.box(x, h / 2 + 0.05, z + w / 2 + fw / 2, depth + 0.2, h + 0.1, fw, PAL.metalDark, { grad: 0.1 });
      B.box(x, h + 0.13, z, depth + 0.2, 0.16, w + fw * 2, PAL.metalDark, { grad: 0.1 });
    }
  }
  const col = axis === 'x'
    ? world.addCollider(x - w / 2, x + w / 2, z - depth / 2 - 0.05, z + depth / 2 + 0.05, 0, h, id)
    : world.addCollider(x - depth / 2 - 0.05, x + depth / 2 + 0.05, z - w / 2, z + w / 2, 0, h, id);
  const door = { id, group, panel, open: 0, target: 0, mode, w, h, axis, col, speed: mode === 'lift' ? 0.9 : 1.2, onMove: null };
  world.doors[id] = door;
  return door;
}

export function updateDoor(door, dt) {
  const before = door.open;
  const d = door.target - door.open;
  if (Math.abs(d) < 1e-3) { door.open = door.target; }
  else door.open += Math.sign(d) * Math.min(Math.abs(d), dt * door.speed);
  const o = door.open * door.open * (3 - 2 * door.open);
  if (door.mode === 'lift') door.panel.position.y = o * (door.h - 0.25);
  else if (door.axis === 'x') door.panel.position.x = -o * (door.w - 0.12);
  else door.panel.position.z = -o * (door.w - 0.12);
  door.col.disabled = door.open > 0.82;
  if (before !== door.open && door.onMove) door.onMove(door.open, before);
  return before !== door.open;
}

export { bevelBoxGeometry, makeMatrix };
