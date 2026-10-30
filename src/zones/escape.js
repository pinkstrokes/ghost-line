import * as THREE from 'three';
import { Builder, PAL, stencilText } from '../engine/kit.js';
import { room, makeDoor, drawSign, emergencyLamp, cameraProp, debris, shelf, crate, barrel } from '../facility/props.js';
import { SPINE, BULKHEADS, ZONES, CAMERAS } from '../../shared/layout.js';
import { drawGlyph } from '../../shared/glyphs.js';

// Service spine, only reachable after the core is taken. Fire suppression fills it with smoke:
// GHOST sees about a metre, the thermal cameras see everything. Pits, live cables, three
// challenge/response bulkheads, then the freight lift.

const H = 3;

function cellToWorld(seg, u, v) {
  if (seg.axis === 'x') return { x: seg.x0 + u, z: seg.z0 + v };
  return { x: seg.x0 + v, z: seg.z0 + u };
}

export function buildEscape(world) {
  const L = world.mission.lockdown;
  const B = new Builder(world, 'escape');
  const pits = [], cables = [];
  const hazByCell = new Map();
  for (const h of L.hazards) {
    const seg = SPINE.find((s) => s.id === h.seg);
    if (h.kind === 'pit') for (const v of h.v) hazByCell.set(`${h.seg}:${h.u}:${v}`, 'pit');
  }
  // floors tile by tile so pits are real holes
  for (const seg of SPINE) {
    const len = seg.axis === 'x' ? seg.x1 - seg.x0 : seg.z1 - seg.z0;
    for (let u = 0; u < len; u++) for (let v = 0; v < 4; v++) {
      const p = cellToWorld(seg, u, v);
      const pit = hazByCell.get(`${seg.id}:${u}:${v}`);
      if (pit) {
        pits.push({ x0: p.x, x1: p.x + 1, z0: p.z, z1: p.z + 1 });
        B.slab(p.x, -3.2, p.z, p.x + 1, -3.0, p.z + 1, 0x0a0a0a, { grad: 0 });
        // broken edge lips
        B.box(p.x + 0.5, -0.12, p.z + 0.5, 1.0, 0.04, 1.0, 0x151515, { grad: 0, jitter: 0 });
        continue;
      }
      B.slab(p.x, -0.25, p.z, p.x + 1, 0, p.z + 1, (u + v) % 2 ? 0x3a3a38 : 0x363634, { grad: 0, jitter: 0.03 });
    }
  }
  // pit shafts (dark walls so the hole reads as deep)
  for (const p of pits) {
    B.slab(p.x0, -3, p.z0, p.x1, -0.12, p.z0 + 0.02, 0x101010, { grad: 0.5 });
    B.slab(p.x0, -3, p.z1 - 0.02, p.x1, -0.12, p.z1, 0x101010, { grad: 0.5 });
    B.slab(p.x0, -3, p.z0, p.x0 + 0.02, -0.12, p.z1, 0x101010, { grad: 0.5 });
    B.slab(p.x1 - 0.02, -3, p.z0, p.x1, -0.12, p.z1, 0x101010, { grad: 0.5 });
  }
  // thermal-only markers: pits read as black voids and tile seams as a grid (layer 8, IR pass)
  const markGeo = [];
  const markMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const p of pits) { const g = new THREE.BoxGeometry(1, 0.02, 1); g.translate(p.x0 + 0.5, -0.03, p.z0 + 0.5); markGeo.push(g); }
  for (const seg of SPINE) {
    const len = seg.axis === 'x' ? seg.x1 - seg.x0 : seg.z1 - seg.z0;
    for (let u = 1; u < len; u++) { const g = seg.axis === 'x' ? new THREE.BoxGeometry(0.04, 0.01, 4) : new THREE.BoxGeometry(4, 0.01, 0.04); const p = cellToWorld(seg, u, 2); g.translate(seg.axis === 'x' ? p.x : p.x, 0.006, seg.axis === 'x' ? p.z : p.z); markGeo.push(g); }
    for (let v = 1; v < 4; v++) { const g = seg.axis === 'x' ? new THREE.BoxGeometry(len, 0.01, 0.04) : new THREE.BoxGeometry(0.04, 0.01, len); const p = cellToWorld(seg, len / 2, v); g.translate(p.x, 0.006, p.z); markGeo.push(g); }
  }
  for (const g of markGeo) { const mm = new THREE.Mesh(g, markMat); mm.layers.set(8); world.scene.add(mm); }
  const e1 = ZONES.escape1, e2 = ZONES.escape2, lift = ZONES.lift;
  room(B, { ...e1, h: H, noFloor: true, skip: ['E'], openings: [{ side: 'W', at: -65, w: 1.6, h: 2.4 }, { side: 'S', at: 12, w: 4, h: H }], lower: 0x3c3a36, upper: 0x55524a, band: 1.0 });
  B.slab(e1.x1, 0, e1.z1, e1.x1 + 0.3, H, e1.z0 - 0.3, 0x3c3a36, { collide: true });
  room(B, { x0: e2.x0, x1: e2.x1, z0: e1.z1, z1: e2.z1, h: H, noFloor: true, skip: ['N', 'S'], lower: 0x3c3a36, upper: 0x55524a, band: 1.0 });
  room(B, { ...lift, h: lift.h, openings: [{ side: 'N', at: 12, w: 4, h: 3 }, { side: 'S', at: 12, w: 2.4, h: 2.6 }], lower: 0x45484a, upper: 0x5b5e5c, band: 1.0 });
  // emergency floor strips
  for (const seg of SPINE) {
    const len = seg.axis === 'x' ? seg.x1 - seg.x0 : seg.z1 - seg.z0;
    for (let u = 0.5; u < len; u += 2) for (const v of [0.08, 3.92]) {
      const p = cellToWorld(seg, u, v);
      if (hazByCell.get(`${seg.id}:${Math.floor(u)}:${v < 1 ? 0 : 3}`)) continue;
      B.box(p.x, 0.01, p.z, seg.axis === 'x' ? 0.4 : 0.05, 0.015, seg.axis === 'x' ? 0.05 : 0.4, 0xff3a20, { glow: true, grad: 0 });
    }
  }
  // debris + cables + clutter from the hazard plan
  for (const h of L.hazards) {
    const seg = SPINE.find((s) => s.id === h.seg);
    if (h.kind === 'debris') {
      const a = cellToWorld(seg, h.u, h.v[0]), b = cellToWorld(seg, h.u + 1, h.v[1] + 1);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const w = Math.abs(b.x - a.x), d = Math.abs(b.z - a.z);
      B.box(cx, 0.55, cz, w * 0.95, 1.1, d * 0.95, 0x4d4a44, { bevel: 0.05, collide: true, ry: 0.05 });
      debris(B, cx, cz, 5, 1.2);
    }
    if (h.kind === 'cable') {
      const p = cellToWorld(seg, h.u, h.v);
      cables.push({ x: p.x, z: p.z });
    }
  }
  shelf(B, -4.5, -66.6, 0, { w: 2.2 });
  barrel(B, 12.8, -60.3); crate(B, 13.4, -44.2, 0.8);
  // signage
  B.decal(-7.98, 2.0, -64.0, Math.PI / 2, 1.0, 0.5, 260, 130, drawSign(['SERVICE', 'SPINE'], { bg: '#38506a', fg: '#e2dccb' }));
  B.decal(12, 2.6, -24.32, Math.PI, 2.0, 0.6, 400, 120, drawSign(['FREIGHT LIFT · L-2'], { bg: '#38506a', fg: '#e2dccb' }));
  // red beacons (only on during lockdown)
  const beacons = [];
  [[-4, -63.3], [6, -66.7], [12, -60], [12, -45], [12, -33]].forEach(([x, z]) => {
    emergencyLamp(B, x, 2.6, z, 0, { room: 'escape', intensity: 1.4, distance: 8, flicker: 0.3 });
    beacons.push(world.lightAnchors[world.lightAnchors.length - 1]);
  });
  beacons.forEach((b) => (b.on = false));
  for (const cam of CAMERAS.filter((c) => c.zone === 'escape')) cameraProp(B, cam.pos, cam.look);
  B.finish(world.scene);

  // hatch from the vault + lockdown bulkheads + lift
  const S = new Builder(world, 'escape');
  makeDoor(world, S, { id: 'H', x: -8.0, z: -65, axis: 'z', w: 1.6, h: 2.4, mode: 'lift', color: 0x6e3a30, label: 'H' });
  const bulk = {};
  for (const [id, b] of Object.entries(BULKHEADS)) {
    const along = b.axis === 'x' ? 'z' : 'x';
    bulk[id] = makeDoor(world, S, { id, x: b.x, z: b.z, axis: along, w: 4, h: 2.8, mode: 'lift', color: 0x7a3a2e, label: id, depth: 0.25 });
  }
  makeDoor(world, S, { id: 'LIFT', x: 12, z: -23.85, axis: 'x', w: 2.4, h: 2.6, mode: 'slide', color: 0x5a6066, stripes: false, label: 'L-2' });
  // lift car beyond the door
  S.slab(10.6, -0.2, -23.7, 13.4, 0, -21.6, 0x4a4c4e, { grad: 0 });
  S.slab(10.6, 2.8, -23.7, 13.4, 3.0, -21.6, 0x4a4c4e, { grad: 0 });
  S.slab(10.4, 0, -23.7, 10.6, 2.8, -21.6, 0x606466, { collide: true });
  S.slab(13.4, 0, -23.7, 13.6, 2.8, -21.6, 0x606466, { collide: true });
  S.slab(10.4, 0, -21.6, 13.6, 2.8, -21.4, 0x606466, { collide: true });
  S.finish(world.scene);
  const carLight = { x: 12, y: 2.5, z: -22.6, color: 0xfff2d8, intensity: 0, distance: 5, room: 'escape', on: true, decay: 1.4 };
  world.lightAnchors.push(carLight);

  // challenge displays next to each bulkhead (glyphs glow; readable only up close in the smoke)
  const displays = {};
  for (const d of L.doors) {
    const b = BULKHEADS[d.id];
    const cv = Object.assign(document.createElement('canvas'), { width: 512, height: 256 });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), mat);
    // mount on the wall beside the door, facing the approach
    if (b.axis === 'x') { m.position.set(b.x - 0.4, 1.6, -63.05); m.rotation.y = Math.PI; }
    else { m.position.set(10.05, 1.6, b.z - 0.6); m.rotation.y = Math.PI / 2; }
    world.scene.add(m);
    const hotPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hotPlate.position.copy(m.position); hotPlate.rotation.copy(m.rotation); hotPlate.layers.set(6);
    world.scene.add(hotPlate);
    displays[d.id] = { cv, tex, d, drawn: '' };
  }
  const drawDisplay = (disp, open, t) => {
    const key = `${open}|${open ? 0 : Math.floor(t * 2) % 2}`;
    if (disp.drawn === key) return;
    disp.drawn = key;
    const c = disp.cv.getContext('2d');
    c.fillStyle = '#0b0302'; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = open ? '#3aff70' : '#ff4a2a'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 244);
    c.fillStyle = open ? '#3aff70' : '#ff6a4a'; c.font = '700 30px "Courier New", monospace'; c.textAlign = 'center';
    c.fillText(open ? `${disp.d.id} · OVERRIDE ACCEPTED` : `${disp.d.id} · OVERRIDE REQUIRED`, 256, 44);
    if (!open) disp.d.challenge.forEach((g, i) => {
      c.fillStyle = '#2a0a06'; c.fillRect(32 + i * 118, 72, 100, 120);
      drawGlyph(c, g, 40 + i * 118, 86, 84, { color: '#ffb08a', lineWidth: 9 });
    });
    else { c.font = '900 90px "Arial Black", sans-serif'; c.fillText('OPEN', 256, 170); }
    if (!open) { c.font = '700 22px "Courier New", monospace'; c.fillStyle = '#a84a30'; c.fillText('READ LEFT → RIGHT · CHALLENGE / RESPONSE', 256, 232); }
    disp.tex.needsUpdate = true;
  };

  // hanging live cables with sparks (hot on thermal)
  const cableMeshes = cables.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    wire.position.y = H - 1.0;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    tip.position.y = H - 2.0;
    const hot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hot.position.y = H - 1.0; hot.layers.set(6);
    g.add(wire, tip, hot);
    world.scene.add(g);
    const light = { x: c.x, y: 1.1, z: c.z, color: 0x9fd0ff, intensity: 0, distance: 3.5, room: 'escape', on: true, decay: 1.5 };
    world.lightAnchors.push(light);
    return { ...c, g, tip, light, t: Math.random() * 2 };
  });

  // smoke particles (agent + normal CCTV only)
  const N = 260;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const seg = SPINE[i % 2];
    sp.set([seg.x0 + Math.random() * (seg.x1 - seg.x0), Math.random() * H, seg.z0 + Math.random() * (seg.z1 - seg.z0)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const puff = document.createElement('canvas');
  puff.width = puff.height = 64;
  {
    const c = puff.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }
  const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8a8278, map: new THREE.CanvasTexture(puff), size: 1.6, transparent: true, opacity: 0.22, depthWrite: false, fog: true }));
  smoke.layers.set(4); smoke.visible = false; smoke.frustumCulled = false;
  world.scene.add(smoke);

  let lastHaz = 0;
  return {
    update(dt, t, s) {
      const lock = !!s?.lockdown?.active;
      beacons.forEach((b) => (b.on = lock));
      smoke.visible = lock;
      if (lock) {
        for (let i = 0; i < N; i++) { sp[i * 3 + 1] += dt * 0.08; if (sp[i * 3 + 1] > H) sp[i * 3 + 1] = 0; sp[i * 3] += Math.sin(t + i) * dt * 0.05; }
        sg.attributes.position.needsUpdate = true;
      }
      for (const d of L.doors) drawDisplay(displays[d.id], !!s?.doors?.[d.id], t);
      carLight.intensity = s?.lockdown?.lift === 'arrived' ? 2 : s?.lockdown?.lift === 'called' ? 0.6 + Math.sin(t * 8) * 0.4 : 0;
      for (const c of cableMeshes) {
        c.t -= dt;
        const spark = lock && c.t < 0.08;
        if (c.t < 0) c.t = 0.6 + Math.random() * 1.6;
        c.tip.material.color.setHex(spark ? 0xffffff : 0x6a5a40);
        c.light.intensity = spark ? 2.5 : 0;
        c.g.rotation.z = Math.sin(t * 1.3 + c.x) * 0.06;
        c.g.rotation.x = Math.cos(t * 1.1 + c.z) * 0.06;
        if (spark && world.agentBody && Math.hypot(world.agentBody.x - c.x, world.agentBody.z - c.z) < 6 && Math.random() < 0.3) world.sfx?.spark({ x: c.x, y: 1, z: c.z });
      }
      // GHOST-side hazard checks
      const b = world.agentBody;
      if (!b || !lock || b.teleporting || s.phase !== 'playing') return;
      const now = performance.now();
      if (now - lastHaz < 2600) return;
      for (const p of pits) {
        if (b.x > p.x0 + 0.18 && b.x < p.x1 - 0.18 && b.z > p.z0 + 0.18 && b.z < p.z1 - 0.18 && b.y < 0.05) {
          lastHaz = now;
          world.act({ k: 'hazard', kind: 'pit' });
          world.onFall?.();
          return;
        }
      }
      for (const c of cableMeshes) {
        if (Math.hypot(b.x - c.x, b.z - c.z) < 0.42 && b.y + b.h > 1.0) {
          lastHaz = now;
          world.act({ k: 'hazard', kind: 'cable' });
          world.sfx?.spark({ x: c.x, y: 1.2, z: c.z });
          world.onShock?.(c);
          return;
        }
      }
      // reached the lift car
      if (s.lockdown.lift === 'arrived' && b.x > 10.7 && b.x < 13.3 && b.z > -23.4 && b.z < -21.8) {
        lastHaz = now;
        world.act({ k: 'extract' });
      }
    },
  };
}
