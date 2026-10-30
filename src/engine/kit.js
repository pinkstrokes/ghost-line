import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

// Flat-colour kit: every static piece carries vertex colours (dark at the bottom, light at the top)
// and gets merged into one mesh per material, so a whole zone is a handful of draw calls.

export const PAL = {
  concrete: 0x6a6c68, concreteDark: 0x484a48, floor: 0x3e403e, ceiling: 0x4f514e, grime: 0x353733,
  wallGreen: 0x4c5d4b, wallCream: 0xa9a28a, tile: 0x7f857c, tileDark: 0x5d625a,
  metal: 0x7b8186, metalDark: 0x3b4045, steel: 0x5b6872, rust: 0x74462f, pipe: 0x4c5a54, pipeRed: 0x6e2b25,
  yellow: 0xf2c230, black: 0x1b1b1b, red: 0xc22b22, white: 0xd8d6cc, wood: 0x76573a, woodDark: 0x4d3825,
  cable: 0x262624, rubber: 0x2a2a2a, glass: 0x8fb3b8, green: 0x2f8f4a, blue: 0x2d5f9a, amber: 0xe08a1e,
  orange: 0xff6a1f, olive: 0x5b6a3c, glove: 0x3b3b3b, skin: 0xe9c9a5, sodium: 0xffa040,
  carpet: 0x3a3532, panel: 0x5d5850, desk: 0x6b5a45, foam: 0x262626, paper: 0xd9d2bf,
};

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function prep(geo, color, grad, jitter) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const span = Math.max(1e-4, max.y - min.y);
  const cols = new Float32Array(pos.count * 3);
  _c.set(color);
  const jr = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / span;
    const f = (1 - grad + grad * t) * jr;
    cols[i * 3] = _c.r * f; cols[i * 3 + 1] = _c.g * f; cols[i * 3 + 2] = _c.b * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export function bevelBoxGeometry(w, h, d, r) {
  const a = w / 2, b = h / 2, c = d / 2;
  r = Math.min(r, a * 0.9, b * 0.9, c * 0.9);
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * a, sy * (b - r), sz * (c - r)));
    pts.push(new THREE.Vector3(sx * (a - r), sy * b, sz * (c - r)));
    pts.push(new THREE.Vector3(sx * (a - r), sy * (b - r), sz * c));
  }
  return new ConvexGeometry(pts);
}

export class Batch {
  constructor(material) { this.material = material; this.geos = []; }
  add(geo, matrix, color, grad = 0.28, jitter = 0.06) {
    const g = prep(geo, color, grad, jitter);
    g.applyMatrix4(matrix);
    this.geos.push(g);
    return g;
  }
  build(name) {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.name = name || 'batch';
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    return mesh;
  }
}

export function makeMatrix(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}

// Shared materials
export const MAT = {
  lit: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0.0 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }),
  glowNoFog: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
};

// ---------------------------------------------------------------- decal atlas
export class DecalAtlas {
  constructor(size = 2048) {
    this.size = size;
    this.pages = [];
    this.newPage();
  }
  newPage() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.size;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const page = {
      canvas, ctx, tex, x: 0, y: 0, rowH: 0,
      lit: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.92, depthWrite: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      glow: new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      litGeos: [], glowGeos: [],
    };
    this.pages.push(page);
    return page;
  }
  alloc(w, h) {
    const pad = 6;
    let p = this.pages[this.pages.length - 1];
    if (p.x + w + pad > this.size) { p.x = 0; p.y += p.rowH + pad; p.rowH = 0; }
    if (p.y + h + pad > this.size) p = this.newPage();
    const r = { page: p, x: p.x, y: p.y, w, h };
    p.x += w + pad;
    p.rowH = Math.max(p.rowH, h);
    return r;
  }
  // draw(ctx, w, h) paints into a w x h pixel box. Quad is worldW x worldH meters.
  add({ px = 256, py = 128, draw, worldW, worldH, matrix, glow = false }) {
    const r = this.alloc(px, py);
    const { ctx } = r.page;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.beginPath(); ctx.rect(0, 0, px, py); ctx.clip();
    draw(ctx, px, py);
    ctx.restore();
    const g = new THREE.PlaneGeometry(worldW, worldH);
    const uv = g.attributes.uv;
    const S = this.size;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (r.x + u * px) / S, 1 - (r.y + (1 - v) * py) / S);
    }
    g.applyMatrix4(matrix);
    (glow ? r.page.glowGeos : r.page.litGeos).push(g);
    return r;
  }
  build() {
    const meshes = [];
    for (const p of this.pages) {
      p.tex.needsUpdate = true;
      if (p.litGeos.length) {
        const m = new THREE.Mesh(mergeGeometries(p.litGeos, false), p.lit);
        m.matrixAutoUpdate = false; m.receiveShadow = true; m.name = 'decals';
        meshes.push(m);
      }
      if (p.glowGeos.length) {
        const m = new THREE.Mesh(mergeGeometries(p.glowGeos, false), p.glow);
        m.matrixAutoUpdate = false; m.name = 'decals-glow';
        meshes.push(m);
      }
      p.litGeos = []; p.glowGeos = [];
    }
    return meshes;
  }
}

// ---------------------------------------------------------------- builder
// One Builder per zone: static lit batch, glow batch, decals, plus colliders and light anchors.
export class Builder {
  constructor(world, zone) {
    this.world = world;
    this.zone = zone;
    this.lit = new Batch(MAT.lit);
    this.glow = new Batch(MAT.glow);
  }
  // Axis box by center; ry rotation in radians. opts: bevel, grad, collide, glow
  box(x, y, z, w, h, d, color, opts = {}) {
    const geo = opts.bevel ? bevelBoxGeometry(w, h, d, opts.bevel) : new THREE.BoxGeometry(w, h, d);
    const m = makeMatrix(x, y, z, opts.ry || 0, opts.rx || 0, opts.rz || 0);
    (opts.glow ? this.glow : this.lit).add(geo, m, color, opts.grad ?? 0.28, opts.jitter ?? 0.06);
    if (opts.collide) {
      const ry = opts.ry || 0;
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      this.world.addCollider(x - hw, x + hw, z - hd, z + hd, y - h / 2, y + h / 2, opts.collide === true ? null : opts.collide);
    }
    return this;
  }
  // box by min/max corners (handy for walls)
  slab(x0, y0, z0, x1, y1, z1, color, opts = {}) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, opts);
  }
  cyl(x, y, z, r, h, color, opts = {}) {
    const geo = new THREE.CylinderGeometry(opts.r2 ?? r, r, h, opts.sides || 8, 1, false);
    const m = makeMatrix(x, y, z, opts.ry || 0, opts.rx || 0, opts.rz || 0);
    (opts.glow ? this.glow : this.lit).add(geo, m, color, opts.grad ?? 0.2, opts.jitter ?? 0.05);
    if (opts.collide) this.world.addCollider(x - r, x + r, z - r, z + r, y - h / 2, y + h / 2);
    return this;
  }
  // horizontal pipe between two points (same y), any direction in xz
  pipe(x0, y, z0, x1, z1, r, color, opts = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    return this.cyl((x0 + x1) / 2, y, (z0 + z1) / 2, r, len, color, { ...opts, rx: Math.PI / 2, ry: ang, sides: opts.sides || 6 });
  }
  geo(geometry, matrix, color, opts = {}) {
    (opts.glow ? this.glow : this.lit).add(geometry, matrix, color, opts.grad ?? 0.25, opts.jitter ?? 0.05);
    return this;
  }
  // decal on a vertical surface facing direction ry (0 = facing +z)
  decal(x, y, z, ry, worldW, worldH, px, py, draw, glow = false) {
    return this.world.atlas.add({ px, py, draw, worldW, worldH, matrix: makeMatrix(x, y, z, ry), glow });
  }
  floorDecal(x, z, ry, worldW, worldH, px, py, draw, y = 0.012) {
    return this.world.atlas.add({ px, py, draw, worldW, worldH, matrix: makeMatrix(x, y, z, ry, -Math.PI / 2) });
  }
  light(x, y, z, color, intensity, distance, opts = {}) {
    this.world.lightAnchors.push({ x, y, z, color, intensity, distance, room: opts.room || this.zone, flicker: opts.flicker || 0, id: opts.id, on: opts.on ?? true, decay: opts.decay ?? 1.6 });
    return this;
  }
  finish(parent) {
    const a = this.lit.build(`${this.zone}-lit`);
    const b = this.glow.build(`${this.zone}-glow`);
    if (a) parent.add(a);
    if (b) { b.castShadow = false; b.receiveShadow = false; parent.add(b); }
    return [a, b];
  }
}

// canvas text helpers for decals
export function stencilText(ctx, text, x, y, size, color = '#d8d2bc', opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 900} ${size}px ${opts.font || '"Arial Black", "Helvetica Neue", Impact, sans-serif'}`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (opts.spacing) ctx.letterSpacing = `${opts.spacing}px`;
  ctx.fillText(text, x, y);
  // weathering: knock speckles out of the paint
  if (opts.wear !== 0) {
    ctx.globalCompositeOperation = 'destination-out';
    const n = Math.floor((opts.wear ?? 0.5) * text.length * 40);
    for (let i = 0; i < n; i++) {
      const rx = x + (Math.random() - 0.5) * size * text.length * 0.75, ry = y + (Math.random() - 0.5) * size;
      ctx.fillRect(rx, ry, Math.random() * size * 0.08 + 1, Math.random() * size * 0.08 + 1);
    }
  }
  ctx.restore();
}
