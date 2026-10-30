import * as THREE from 'three';
import { Builder, PAL } from '../engine/kit.js';
import { makeDoor, drawStencil, drawSign, emergencyLamp, debris, pipeRun, barrel, crate } from '../facility/props.js';
import { MAZE, WALL, cellCenter, CAMERAS } from '../../shared/layout.js';

// The undercroft: an unlit tunnel grid. Junction codes are stencilled on walls, dampers are
// motorised shutters, and the Listener walks the open passages.

const H = 2.5, T = 0.3;

function listenerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, flatShading: true, roughness: 0.9 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0505 });
  const prof = [];
  for (let i = 0; i <= 9; i++) { const t = i / 9; prof.push(new THREE.Vector2(0.05 + 0.2 * Math.sin(Math.PI * (0.1 + t * 0.85)) ** 0.7, t * 1.6)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 7), skin);
  body.position.y = 0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), skin);
  head.scale.set(1, 1.35, 1.1);
  head.position.y = 2.25;
  g.add(head);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.05), dark);
  mouth.position.set(0, 2.18, 0.19);
  g.add(mouth);
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.1, 0.62, 0);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.62, 5), skin); l.position.y = -0.31; p.add(l);
    g.add(p); return p;
  });
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.22, 1.85, 0);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 1.25, 5), skin); a.position.y = -0.62; p.add(a);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.04), skin); hand.position.y = -1.3; p.add(hand);
    g.add(p); return p;
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { g, head, legs, arms, mouth, body };
}

export function buildMaze(world) {
  const Z = world.mission.maze;
  const B = new Builder(world, 'maze');
  const { cols, rows, cell, x0, z0 } = MAZE;
  const X = (c) => x0 + c * cell, Zc = (r) => z0 + r * cell;
  // floor + ceiling
  B.slab(x0 - T, -0.25, z0 - T, x0 + cols * cell + T, 0, z0 + rows * cell + T, 0x262826, { grad: 0, jitter: 0.02 });
  B.slab(x0 - T, H, z0 - T, x0 + cols * cell + T, H + 0.25, z0 + rows * cell + T, 0x2e302d, { grad: 0, jitter: 0.02 });
  // grating stripes
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const { x, z } = cellCenter(c, r);
    for (let k = -3; k <= 3; k++) B.box(x + k * 0.3, 0.004, z, 0.05, 0.008, 2.6, 0x1c1d1c, { grad: 0, jitter: 0 });
  }
  const wallCol = (c, r) => ((c * 7 + r * 3) % 3 === 0 ? 0x434740 : (c + r) % 2 ? 0x3c403a : 0x3f433e);
  const seg = (ax, az, bx, bz, col) => {
    if (ax === bx) B.slab(ax - T / 2, 0, Math.min(az, bz) - T / 2, ax + T / 2, H, Math.max(az, bz) + T / 2, col, { collide: true, grad: 0.4 });
    else B.slab(Math.min(ax, bx) - T / 2, 0, az - T / 2, Math.max(ax, bx) + T / 2, H, az + T / 2, col, { collide: true, grad: 0.4 });
  };
  const [ec, er] = MAZE.entrance;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const w = Z.walls[r][c];
    if (w & WALL.N) seg(X(c), Zc(r), X(c + 1), Zc(r), wallCol(c, r));
    else if (r === 0) {
      // exit gap on the north edge: walls either side of a 1.8 m opening
      const mx = X(c) + cell / 2;
      seg(X(c), Zc(r), mx - 0.9, Zc(r), wallCol(c, r));
      seg(mx + 0.9, Zc(r), X(c + 1), Zc(r), wallCol(c, r));
      B.slab(mx - 0.9, 2.3, Zc(r) - T / 2, mx + 0.9, H, Zc(r) + T / 2, wallCol(c, r));
    }
    if (w & WALL.W) seg(X(c), Zc(r), X(c), Zc(r + 1), wallCol(c, r));
    if (r === rows - 1 && w & WALL.S) seg(X(c), Zc(r + 1), X(c + 1), Zc(r + 1), wallCol(c, r));
    if (c === cols - 1) {
      if (w & WALL.E) seg(X(c + 1), Zc(r), X(c + 1), Zc(r + 1), wallCol(c, r));
      else {
        // entrance gap matching the 1.6 m passage from bulkhead C
        seg(X(c + 1), Zc(r), X(c + 1), -33.8, wallCol(c, r));
        seg(X(c + 1), -32.2, X(c + 1), Zc(r + 1), wallCol(c, r));
      }
    }
    // corner posts
    B.box(X(c), H / 2, Zc(r), 0.36, H, 0.36, 0x353833, { grad: 0.3 });
  }
  // exit passage to the optics lab
  const exX = X(Z.exitCol) + cell / 2;
  B.slab(exX - 1.2, 0, -48.5, exX - 0.9, H, -46.5, 0x3a3d38, { collide: true });
  B.slab(exX + 0.9, 0, -48.5, exX + 1.2, H, -46.5, 0x3a3d38, { collide: true });
  B.slab(exX - 1.2, -0.25, -48.6, exX + 1.2, 0, -46.4, 0x262826, { grad: 0 });
  B.slab(exX - 1.2, H, -48.6, exX + 1.2, H + 0.25, -46.4, 0x2e302d, { grad: 0 });
  emergencyLamp(B, exX + 0.85, 2.1, -47.2, -Math.PI / 2, { room: 'maze', intensity: 0.7, distance: 5 });
  emergencyLamp(B, X(cols) - 0.2, 2.1, -33.9, -Math.PI / 2, { room: 'maze', intensity: 0.5, distance: 4 });

  // tunnel dressing: pipes along every N wall, junk
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const w = Z.walls[r][c];
    const cc = cellCenter(c, r);
    if (w & WALL.N) pipeRun(B, X(c) + 0.2, 2.15, Zc(r) + 0.28, X(c + 1) - 0.2, Zc(r) + 0.28, { r: 0.06, color: (c + r) % 3 ? PAL.pipe : PAL.pipeRed });
    if (w & WALL.W && (c + r) % 2) pipeRun(B, X(c) + 0.28, 0.35, Zc(r) + 0.2, X(c) + 0.28, Zc(r + 1) - 0.2, { r: 0.08 });
    const k = (c * 13 + r * 7) % 9;
    if (k === 0) barrel(B, cc.x + 0.9, cc.z + 0.9, { color: 0x3f4a38 });
    if (k === 3) crate(B, cc.x - 0.9, cc.z + 0.9, 0.7);
    if (k === 5) debris(B, cc.x, cc.z + 0.5, 4, 1.2);
    if (k === 7) B.box(cc.x + 0.4, 0.006, cc.z - 0.3, 1.2, 0.01, 0.8, 0x18201f, { grad: 0, jitter: 0 });
  }
  // stencilled junction codes (one wall per coded cell)
  for (const [key, code] of Object.entries(Z.codes)) {
    const [c, r] = key.split(',').map(Number);
    const w = Z.walls[r][c];
    const cc = cellCenter(c, r);
    const off = cell / 2 - T / 2 - 0.012;
    let p;
    if (w & WALL.N) p = [cc.x, cc.z - off, 0];
    else if (w & WALL.E) p = [cc.x + off, cc.z, -Math.PI / 2];
    else if (w & WALL.W) p = [cc.x - off, cc.z, Math.PI / 2];
    else if (w & WALL.S) p = [cc.x, cc.z + off, Math.PI];
    else continue;
    B.decal(p[0], 1.55, p[1], p[2], 1.1, 0.5, 256, 116, drawStencil(code, '#d9d3bd', 0.82, { wear: 0.7 }));
  }
  // PIR sensors on the ceiling
  const pirLeds = [];
  for (const [key, id] of Object.entries(Z.sensors)) {
    const [c, r] = key.split(',').map(Number);
    const cc = cellCenter(c, r);
    B.box(cc.x - 1.1, H - 0.08, cc.z + 1.1, 0.14, 0.1, 0.14, 0xb8b2a0, { grad: 0 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0x200404 }));
    led.position.set(cc.x - 1.1, H - 0.14, cc.z + 1.1);
    world.scene.add(led);
    pirLeds.push({ id, led });
  }
  for (const cam of CAMERAS.filter((c) => c.zone === 'maze')) { /* camera prop is mounted on the substation side */ }
  B.finish(world.scene);

  // ---- dampers: shutters across the band passages
  const dampers = Z.dampers.map((d) => {
    const x = X(d.a[0] + 1);
    const z = cellCenter(d.a[0], d.a[1]).z;
    // frame walls narrow the passage to 1.6 m
    const F = new Builder(world, 'maze');
    F.slab(x - 0.2, 0, z - 1.5, x + 0.2, H, z - 0.8, 0x4a4d46, { collide: true });
    F.slab(x - 0.2, 0, z + 0.8, x + 0.2, H, z + 1.5, 0x4a4d46, { collide: true });
    F.slab(x - 0.2, 2.2, z - 0.8, x + 0.2, H, z + 0.8, 0x4a4d46);
    F.finish(world.scene);
    const door = makeDoor(world, F, { id: d.id, x, z, axis: 'z', w: 1.6, h: 2.2, mode: 'lift', color: 0x6a6d62, stripes: true, label: d.id, frame: false, depth: 0.12 });
    door.speed = 0.6;
    // status lamps either side
    const lamps = [-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0x300606 }));
      m.position.set(x + s * 0.22, 2.0, z - 0.86);
      world.scene.add(m);
      return m;
    });
    // slats
    for (let k = 0; k < 7; k++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 1.58), new THREE.MeshStandardMaterial({ color: 0x55584f, flatShading: true }));
      slat.position.set(0, 0.5 + k * 0.24, 0);
      door.panel.add(slat);
    }
    return { ...d, door, lamps, x, z };
  });

  // ---- the Listener
  const L = listenerMesh();
  world.scene.add(L.g);
  const lp = new THREE.Vector3(), lv = { yaw: 0, phase: 0, clickT: 2, groanT: 5, stepT: 0, mode: 'idle' };
  let first = true;

  return {
    dampers,
    update(dt, t, s) {
      if (!s) return;
      const D = s.maze?.dampers || {};
      for (const d of dampers) {
        d.door.override = D[d.id] ? 1 : 0;
        const col = D[d.id] ? 0x30ff60 : 0xff2a10;
        d.lamps.forEach((m) => m.material.color.setHex(s.patch?.power ? col : 0x200404));
      }
      const now = world.serverTime();
      for (const p of pirLeds) {
        const at = s.maze?.sensors?.[p.id];
        p.led.material.color.setHex(at && now - at < 900 ? 0xff2010 : 0x200404);
      }
      // creature
      const c = s.maze?.creature;
      const active = s.patch?.power && !s.maze?.cleared && c;
      L.g.visible = !!active;
      if (!active) return;
      const target = new THREE.Vector3(c.x, 0, c.z);
      if (first) { lp.copy(target); first = false; }
      const prev = lp.clone();
      lp.lerp(target, Math.min(1, dt * 8));
      const sp = prev.distanceTo(lp) / Math.max(dt, 1e-3);
      L.g.position.copy(lp);
      let dy = c.yaw - lv.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      lv.yaw += dy * Math.min(1, dt * 6);
      L.g.rotation.y = lv.yaw;
      lv.phase += dt * (1.5 + sp * 3);
      const sw = Math.sin(lv.phase) * Math.min(1, sp);
      L.legs[0].rotation.x = sw * 0.6; L.legs[1].rotation.x = -sw * 0.6;
      L.arms[0].rotation.x = -sw * 0.25 + 0.05; L.arms[1].rotation.x = sw * 0.25 + 0.05;
      L.arms[0].rotation.z = -0.08; L.arms[1].rotation.z = 0.08;
      const hunt = c.mode === 'hunt';
      L.body.rotation.x = hunt ? 0.35 : 0.1;
      L.head.rotation.z = Math.sin(t * 7) * (hunt ? 0.25 : 0.08) + (Math.sin(t * 1.3) > 0.97 ? 0.6 : 0);
      L.head.position.z = hunt ? 0.35 : 0.1;
      L.mouth.scale.x = hunt ? 1.4 : 1;
      // sounds (positional)
      const pos = { x: lp.x, y: 2, z: lp.z };
      lv.clickT -= dt; lv.groanT -= dt; lv.stepT -= dt * (0.6 + sp);
      if (lv.clickT < 0) { lv.clickT = hunt ? 0.6 + Math.random() * 0.5 : 2 + Math.random() * 3; world.sfx?.clicks(pos); }
      if (lv.groanT < 0) { lv.groanT = hunt ? 2.5 + Math.random() * 2 : 7 + Math.random() * 7; world.sfx?.groan(pos); }
      if (sp > 0.3 && lv.stepT < 0) { lv.stepT = 0.5; world.sfx?.creatureStep(pos, hunt); }
      if (lv.mode !== c.mode && c.mode === 'hunt') world.sfx?.groan(pos);
      lv.mode = c.mode;
      // flashlight flicker when it's near GHOST
      const body = world.agentBody;
      if (body) {
        const d = Math.hypot(body.x - lp.x, body.z - lp.z);
        world.flashFlicker = d < 7 ? (7 - d) / 7 : 0;
      }
    },
  };
}
