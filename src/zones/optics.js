import * as THREE from 'three';
import { Builder, PAL, stencilText } from '../engine/kit.js';
import { room, fixture, emergencyLamp, drawSign, makeDoor, cameraProp, desk, crt, papers, chair, shelf } from '../facility/props.js';
import { OPTICS, latticePos, ZONES, MAZE, CAMERAS } from '../../shared/layout.js';
import { traceBeams } from '../../shared/optics-sim.js';

// Optics lab: six pedestals on a 1 m lattice. The beam is infra-red (IR layer only).
// Every wall port looks the same to GHOST; LINE sees which ones are live on CAM-06 IR.

const BEAM_Y = 1.2;

export function buildOptics(world) {
  const O = world.mission.optics;
  const Zr = ZONES.optics;
  const B = new Builder(world, 'optics');
  const exitX = MAZE.x0 + world.mission.maze.exitCol * MAZE.cell + MAZE.cell / 2;
  room(B, { x0: Zr.x0, x1: Zr.x1, z0: Zr.z0, z1: Zr.z1, h: Zr.h, openings: [{ side: 'S', at: exitX, w: 1.8, h: 2.3 }, { side: 'E', at: -56, w: 1.6, h: 2.4 }], lower: 0x4f5b60, upper: 0x8a8c84, floor: 0x2d3133, ceil: 0x3e4140, band: 1.6 });
  // floor grid
  for (let i = 0; i <= OPTICS.n; i++) {
    B.box(OPTICS.x0 + i, 0.006, OPTICS.z0 + OPTICS.n / 2, 0.025, 0.01, OPTICS.n, 0x444a4c, { grad: 0, jitter: 0 });
    B.box(OPTICS.x0 + OPTICS.n / 2, 0.006, OPTICS.z0 + i, OPTICS.n, 0.01, 0.025, 0x444a4c, { grad: 0, jitter: 0 });
  }
  for (let i = 0; i < OPTICS.n; i++) for (let j = 0; j < OPTICS.n; j++) {
    const p = latticePos(i, j);
    B.box(p.x, 0.008, p.z, 0.12, 0.01, 0.02, 0x5a6164, { grad: 0, jitter: 0 }).box(p.x, 0.008, p.z, 0.02, 0.01, 0.12, 0x5a6164, { grad: 0, jitter: 0 });
  }
  // wall ports at beam height on W, N, E walls — identical, the live ones are hidden among them
  const portMat = 0x15181a;
  for (let j = 0; j < OPTICS.n; j++) {
    const { z } = latticePos(0, j);
    B.box(Zr.x0 + 0.06, BEAM_Y, z, 0.12, 0.16, 0.16, 0x6a6e6a, { grad: 0 }).box(Zr.x0 + 0.125, BEAM_Y, z, 0.01, 0.07, 0.07, portMat, { grad: 0 });
    B.box(Zr.x1 - 0.06, BEAM_Y, z, 0.12, 0.16, 0.16, 0x6a6e6a, { grad: 0 }).box(Zr.x1 - 0.125, BEAM_Y, z, 0.01, 0.07, 0.07, portMat, { grad: 0 });
  }
  for (let i = 0; i < OPTICS.n; i++) {
    const { x } = latticePos(i, 0);
    B.box(x, BEAM_Y, Zr.z0 + 0.06, 0.16, 0.16, 0.12, 0x6a6e6a, { grad: 0 }).box(x, BEAM_Y, Zr.z0 + 0.125, 0.07, 0.07, 0.01, portMat, { grad: 0 });
  }
  // obstacles: pillars
  for (const [i, j] of O.obstacles) {
    const p = latticePos(i, j);
    B.box(p.x, Zr.h / 2, p.z, 0.8, Zr.h, 0.8, 0x5c605c, { collide: true, grad: 0.3 });
    B.box(p.x, 0.5, p.z, 0.84, 0.06, 0.84, PAL.yellow, { grad: 0 });
  }
  // lab dressing along the walls (outside the lattice)
  desk(B, -21.0, -63.0, 0, { w: 1.8, d: 0.7 });
  crt(B, -21.5, 0.77, -63.1, 0, { on: true, screen: 0x1a3a5a });
  papers(B, -20.5, -62.4, 5, 0.8);
  chair(B, -21.0, -62.2, Math.PI + 0.3);
  shelf(B, -33.6, -50.5, Math.PI / 2, { w: 2.2 });
  B.decal(Zr.x0 + 0.012, 3.2, -51, Math.PI / 2, 2.2, 1.0, 512, 230, drawSign(['OPTICS LAB 3', 'CLASS 4 INFRA-RED', 'EYEWEAR REQUIRED'], { stripe: '#b02a20' }));
  B.decal(Zr.x1 - 0.012, 3.0, -56, -Math.PI / 2, 1.4, 0.6, 320, 140, drawSign(['SECURE STORE', '→ DOOR E'], { bg: '#38506a', fg: '#e2dccb' }));
  [[-30, -60], [-22, -60], [-30, -52], [-22, -52], [-26, -56]].forEach(([x, z], i) => fixture(B, x, Zr.h - 0.02, z, { along: 'x', len: 1.6, color: 0xd6e6ff, intensity: 2.6, distance: 11, room: 'optics', flicker: i === 1 ? 0.5 : 0, dead: i === 3 }));
  emergencyLamp(B, Zr.x1 - 0.1, 3.0, -54.5, -Math.PI / 2, { room: 'optics' });
  cameraProp(B, CAMERAS[5].pos.map((v, k) => (k === 1 ? v + 0.05 : v)), CAMERAS[5].look);
  makeDoor(world, B, { id: 'E', x: Zr.x1 + 0.15, z: -56, axis: 'z', w: 1.6, h: 2.4, mode: 'lift', color: 0x5a6670, label: 'E' });
  // passage to the vault antechamber
  room(B, { x0: Zr.x1 + 0.3, x1: -16.0, z0: -56.8, z1: -55.2, h: 2.6, skip: ['W', 'E'], lower: 0x3a3c3a, upper: 0x4a4b47, band: 1.0 });
  B.finish(world.scene);

  // ---- pedestals
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x6d7378, flatShading: true, roughness: 0.6, metalness: 0.2 });
  const mirMat = new THREE.MeshStandardMaterial({ color: 0xbcd4dc, roughness: 0.15, metalness: 0.85, flatShading: true, emissive: 0x0c1418 });
  const peds = O.mirrors.map((m, idx) => {
    const p = latticePos(m.i, m.j);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.9, 8), pedMat);
    base.position.y = 0.45;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), new THREE.MeshStandardMaterial({ color: PAL.yellow, flatShading: true }));
    collar.position.y = 0.94;
    const head = new THREE.Group();
    head.position.y = 0.98;
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.03), mirMat);
    mirror.position.y = BEAM_Y - 0.98;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.46, 0.02), pedMat);
    frame.position.set(0, BEAM_Y - 0.98, -0.025);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), pedMat);
    post.position.y = 0.05;
    head.add(mirror, frame, post);
    // engraved plaque with the letter (small: readable by GHOST, not by the ceiling camera)
    const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 64 });
    const c = cv.getContext('2d');
    c.fillStyle = '#d8d2bc'; c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#1a1a1a'; c.font = '900 44px "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(m.letter, 64, 34);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const plaqueMat = new THREE.MeshStandardMaterial({ map: tex });
    for (let k = 0; k < 4; k++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), plaqueMat);
      const a = (k * Math.PI) / 2;
      pl.position.set(Math.sin(a) * 0.272, 0.62, Math.cos(a) * 0.272);
      pl.rotation.y = a;
      pl.rotation.x = -0.13;
      g.add(pl);
    }
    g.add(base, collar, head);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.scene.add(g);
    world.addCollider(p.x - 0.32, p.x + 0.32, p.z - 0.32, p.z + 0.32, 0, 1.4);
    const ped = { idx, m, head, g, cur: (O.init[idx] * Math.PI) / 8 };
    head.rotation.y = ped.cur;
    world.addInteractable({
      pos: new THREE.Vector3(p.x, 1.1, p.z), size: [0.75, 1.0, 0.75], zone: 'optics',
      label: () => `MIRROR ${m.letter}   [E] ⟳ 顺时针   [Q] ⟲ 逆时针`,
      enabled: () => !world.state?.optics?.done,
      use: () => { world.act({ k: 'rotate', m: idx, d: -1 }); world.sfx?.ratchet(g.position); },
      alt: () => { world.act({ k: 'rotate', m: idx, d: 1 }); world.sfx?.ratchet(g.position); },
    });
    return ped;
  });

  // receiver lamps (only light up when solved, so GHOST gets no partial feedback)
  const recLamps = O.receivers.map((rc) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x101010 }));
    if (rc.side === 'N') { const p = latticePos(rc.idx, 0); m.position.set(p.x, BEAM_Y + 0.14, Zr.z0 + 0.13); }
    else { const p = latticePos(0, rc.idx); m.position.set(Zr.x1 - 0.13, BEAM_Y + 0.14, p.z); }
    world.scene.add(m);
    return m;
  });
  // hot spots for IR: emitter + receivers glow on the HOT layer
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hot = (x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), hotMat); m.position.set(x, y, z); m.layers.set(6); world.scene.add(m); return m; };
  const ej = latticePos(0, O.emitterJ);
  hot(Zr.x0 + 0.1, BEAM_Y, ej.z);
  const recHot = O.receivers.map((rc) => (rc.side === 'N' ? hot(latticePos(rc.idx, 0).x, BEAM_Y, Zr.z0 + 0.1) : hot(Zr.x1 - 0.1, BEAM_Y, latticePos(0, rc.idx).z)));

  // ---- beam (IR layer)
  const MAX = 64;
  const pos = new Float32Array(MAX * 6);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, fog: false }));
  lines.layers.set(2); lines.frustumCulled = false;
  world.scene.add(lines);
  // thicker quads so the beam reads on the ceiling camera
  const quadGeo = new THREE.PlaneGeometry(1, 0.07);
  quadGeo.rotateX(-Math.PI / 2);
  const quadMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
  const quads = Array.from({ length: MAX }, () => { const q = new THREE.Mesh(quadGeo, quadMat); q.layers.set(2); q.visible = false; world.scene.add(q); return q; });

  const toWorld = (i, j) => {
    if (i < 0) return new THREE.Vector3(Zr.x0 + 0.13, BEAM_Y, latticePos(0, j).z);
    const p = latticePos(i, j);
    return new THREE.Vector3(p.x, BEAM_Y, p.z);
  };
  const DIRV = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  const runToWall = (p, k) => {
    const [dx, dz] = DIRV[k];
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (Zr.x1 - 0.13 - p.x) / dx); if (dx < 0) t = Math.min(t, (Zr.x0 + 0.13 - p.x) / dx);
    if (dz > 0) t = Math.min(t, (Zr.z1 - 0.13 - p.z) / dz); if (dz < 0) t = Math.min(t, (Zr.z0 + 0.13 - p.z) / dz);
    return new THREE.Vector3(p.x + dx * t, BEAM_Y, p.z + dz * t);
  };
  let lastKey = '';
  const setBeam = (orient) => {
    const key = orient.join(',');
    if (key === lastKey) return;
    lastKey = key;
    const tr = traceBeams(O, orient);
    let n = 0;
    for (const sgm of tr.segs) {
      if (n >= MAX) break;
      const [i0, j0, i1, j1, k, wall] = sgm;
      const a = toWorld(i0, j0);
      const b = wall ? runToWall(toWorld(i1, j1), k) : toWorld(i1, j1);
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6);
      const q = quads[n];
      q.visible = true;
      q.position.copy(a).lerp(b, 0.5);
      q.scale.set(a.distanceTo(b), 1, 1);
      q.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x), 0);
      n++;
    }
    for (let i = n; i < MAX; i++) { quads[i].visible = false; pos.fill(0, i * 6, i * 6 + 6); }
    lg.attributes.position.needsUpdate = true;
    lg.setDrawRange(0, n * 2);
    tr.lit.forEach((l, i) => (recHot[i].scale.setScalar(l ? 2.2 : 1)));
  };
  setBeam(O.init);

  return {
    peds,
    update(dt, t, s) {
      const orient = s?.optics?.orient || O.init;
      peds.forEach((p, i) => {
        const target = (orient[i] * Math.PI) / 8;
        let d = target - p.cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.cur += d * Math.min(1, dt * 10);
        p.head.rotation.y = p.cur;
      });
      setBeam(orient);
      const done = s?.optics?.done;
      recLamps.forEach((m) => m.material.color.setHex(done ? 0x40ff70 : 0x101010));
    },
  };
}
