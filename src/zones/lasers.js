import * as THREE from 'three';
import { Builder, PAL, stencilText } from '../engine/kit.js';
import { room, fixture, emergencyLamp, drawSign, drawStencil, cameraProp, pipeRun, cableTray, debris, papers } from '../facility/props.js';
import { HALL, HALL_CHECKPOINT, CAMERAS } from '../../shared/layout.js';
import { activeBeams, beamHit } from '../../shared/mission.js';
import { IR_BEAM_CYL_MAT, LASER_LINE_MAT, LASER_UNIFORMS } from '../facility/world.js';

// Laser hall. Beams live on the IR layer only: GHOST never sees them, LINE sees them on the IR cameras.

export function buildLasers(world) {
  const L = world.mission.lasers;
  const B = new Builder(world, 'lasers');
  const { x0, x1 } = HALL;
  const h = 3.2;
  room(B, { x0, x1, z0: -27, z1: -0.4, h, skip: ['S'], openings: [{ side: 'N', at: 0, w: 1.8, h: 2.5 }], lower: 0x3f4648, upper: 0x6f716b, floor: 0x2f3233, ceil: 0x3f413e, band: 1.0 });
  // floor tiles + lane lines + row lines
  for (let z = -0.9; z > -27; z -= 1) for (let x = -1.5; x <= 1.5; x += 1) {
    if (((x + 1.5) + Math.round(-z)) % 2) B.box(x, 0.003, z - 0.5, 0.98, 0.006, 0.98, 0x2a2d2e, { grad: 0, jitter: 0.05 });
  }
  for (const lx of [-1, 0, 1]) B.box(lx, 0.008, -14, 0.03, 0.01, 25.6, 0xbfbcae, { grad: 0, jitter: 0 });
  for (let k = 0; k <= 12; k++) B.box(0, 0.009, HALL.zStart - 2 * k, 3.96, 0.01, 0.035, 0x9c9a8e, { grad: 0, jitter: 0 });
  // start line
  B.box(0, 0.01, -2.0, 3.96, 0.012, 0.12, 0xd8d6cc, { grad: 0, jitter: 0 });
  HALL.lanes.forEach((ln, i) => {
    B.floorDecal(-1.5 + i, -1.3, 0, 0.7, 0.7, 128, 128, drawStencil(ln, '#d8d6cc', 0.85, { wear: 0.4 }));
    B.floorDecal(-1.5 + i, -25.9, Math.PI, 0.7, 0.7, 128, 128, drawStencil(ln, '#d8d6cc', 0.85, { wear: 0.4 }));
  });
  // checkpoint box
  const cz = HALL_CHECKPOINT.z;
  B.floorDecal(0, cz, 0, 3.8, 1.2, 512, 160, (c, w, hh) => {
    c.strokeStyle = '#d8d6cc'; c.lineWidth = 10; c.setLineDash([28, 18]); c.strokeRect(8, 8, w - 16, hh - 16);
    stencilText(c, 'SAFE', w / 2, hh / 2, hh * 0.55, '#d8d6cc', { wear: 0.5, spacing: 20 });
  });
  // row numbers on both walls (both faces readable from the cameras)
  for (let k = 1; k <= 12; k++) {
    const zc = HALL.zStart - 2 * k + 1;
    const txt = String(k).padStart(2, '0');
    B.decal(x0 + 0.012, 2.15, zc, Math.PI / 2, 0.9, 0.7, 160, 128, drawStencil(txt, '#d8d2bc', 0.9, { wear: 0.4 }));
    B.decal(x1 - 0.012, 2.15, zc, -Math.PI / 2, 0.9, 0.7, 160, 128, drawStencil(txt, '#d8d2bc', 0.9, { wear: 0.4 }));
  }
  // emitter ports everywhere so the real ones can't be told apart
  for (let z = -3; z >= -26.5; z -= 0.5) {
    for (const y of [0.26, 0.7, 1.18, 1.62, 2.2, 2.45]) {
      if (y > 2 && Math.abs(((-z - 3) % 2) - 1) < 0.5) continue; // leave room for the row numbers
      B.box(x0 + 0.02, y, z, 0.05, 0.05, 0.05, 0x141516, { grad: 0, jitter: 0 });
      B.box(x1 - 0.02, y, z, 0.05, 0.05, 0.05, 0x141516, { grad: 0, jitter: 0 });
    }
  }
  for (let z = -3.5; z >= -26; z -= 0.75) for (let m = 0; m < 8; m++) {
    const x = -1.75 + 0.5 * m;
    B.box(x, h - 0.01, z, 0.06, 0.02, 0.06, 0x141516, { grad: 0, jitter: 0 });
    B.box(x, 0.004, z, 0.05, 0.008, 0.05, 0x141516, { grad: 0, jitter: 0 });
  }
  // ceiling pipes, tray, fixtures
  pipeRun(B, x0 + 0.25, h - 0.25, -0.6, x0 + 0.25, -26.8, { r: 0.08 });
  pipeRun(B, x1 - 0.25, h - 0.3, -0.6, x1 - 0.25, -26.8, { r: 0.06, color: PAL.pipeRed });
  cableTray(B, 1.55, h - 0.12, -0.6, 1.55, -26.8);
  const fz = [-2.5, -6.5, -10.5, -14.5, -18.5, -22.5, -25.8];
  fz.forEach((z, i) => fixture(B, i % 2 ? 1.25 : -1.25, h - 0.02, z, { dead: i === 3, flicker: i === 1 || i === 5 ? 0.6 : 0, intensity: 1.6, distance: 7.5, room: 'lasers' }));
  emergencyLamp(B, x0 + 0.08, 2.6, -13, Math.PI / 2, { room: 'lasers', intensity: 0.5 });
  // control box at the start: hint that a grid is armed
  B.box(x1 - 0.1, 1.45, -1.4, 0.16, 0.5, 0.4, 0x8e8c80, { bevel: 0.02 });
  B.decal(x1 - 0.185, 1.55, -1.4, -Math.PI / 2, 0.34, 0.16, 256, 120, drawSign(['IR GRID', 'ARMED'], { bg: '#2a2a2a', fg: '#ff6b4a', border: false }));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xff2a18 }));
  led.position.set(x1 - 0.19, 1.32, -1.4);
  world.scene.add(led);
  B.decal(x0 + 0.012, 1.7, -1.8, Math.PI / 2, 1.1, 0.8, 300, 220, drawSign(['WARNING', 'INFRA-RED', 'SECURITY GRID'], { stripe: '#b02a20' }));
  B.decal(x0 + 0.012, 1.6, -26.2, Math.PI / 2, 0.9, 0.45, 260, 130, drawSign(['SUBSTATION', '→'], { bg: '#38506a', fg: '#e2dccb' }));
  debris(B, -1.6, -9, 4, 0.5); papers(B, 1.2, -19.5, 5, 0.9); debris(B, 1.7, -23.6, 3, 0.3);
  for (const cam of CAMERAS.filter((c) => c.zone === 'lasers')) cameraProp(B, cam.pos, cam.look, { ceil: 3.2 });
  B.finish(world.scene);

  // ---- IR overlay: lane/row lines and row numbers drawn on the IR layer, so LINE can reference them
  const irMat = new THREE.MeshBasicMaterial({ color: 0x8a8a8a, fog: false });
  const irBox = (x, y, z, w, hh, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), irMat); m.position.set(x, y, z); m.layers.set(2); world.scene.add(m); };
  for (const lx of [-1, 0, 1]) irBox(lx, 0.012, -14.5, 0.03, 0.01, 23.6);
  for (let k = 0; k <= 12; k++) irBox(0, 0.013, HALL.zStart - 2 * k, 3.96, 0.01, 0.04);
  const irText = (txt, x, y, z, ry, w, hh, rx = 0) => {
    const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 96 });
    const c = cv.getContext('2d');
    c.fillStyle = '#9a9a9a'; c.font = '900 76px "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, 64, 52);
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.layers.set(2);
    world.scene.add(m);
  };
  for (let k = 1; k <= 12; k++) {
    const zc = HALL.zStart - 2 * k + 1, txt = String(k).padStart(2, '0');
    irText(txt, x0 + 0.02, 2.15, zc, Math.PI / 2, 0.8, 0.6);
    irText(txt, x1 - 0.02, 2.15, zc, -Math.PI / 2, 0.8, 0.6);
  }
  HALL.lanes.forEach((ln, i) => { irText(ln, -1.5 + i, 0.02, -1.3, 0, 0.6, 0.45, -Math.PI / 2); irText(ln, -1.5 + i, 0.02, -25.9, Math.PI, 0.6, 0.45, -Math.PI / 2); });

  // ---- IR beams: one LineSegments buffer rewritten every frame (1px wide at any distance,
  // so even the 200x150 CCTV feed shows them) plus thin cylinders for close range.
  const MAXB = 80;
  const pos = new Float32Array(MAXB * 6);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(lg, LASER_LINE_MAT);
  lines.frustumCulled = false;
  lines.layers.set(2);
  world.scene.add(lines);
  const cylGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1, true);
  const cylMat = IR_BEAM_CYL_MAT;
  const cyls = Array.from({ length: MAXB }, () => {
    const c = new THREE.Mesh(cylGeo, cylMat);
    c.layers.set(2);
    c.visible = false;
    world.scene.add(c);
    return c;
  });
  const setBeams = (beams) => {
    let n = 0;
    for (const b of beams) {
      if (n >= MAXB) break;
      const c = cyls[n];
      c.visible = true;
      if (b.kind === 'v') {
        pos.set([b.x, 0, b.z, b.x, h, b.z], n * 6);
        c.position.set(b.x, h / 2, b.z); c.scale.set(1, h, 1); c.rotation.set(0, 0, 0);
      } else {
        pos.set([x0, b.y, b.z, x1, b.y, b.z], n * 6);
        c.position.set(0, b.y, b.z); c.scale.set(1, x1 - x0, 1); c.rotation.set(0, 0, Math.PI / 2);
      }
      n++;
    }
    for (let i = n; i < MAXB; i++) { cyls[i].visible = false; pos.fill(0, i * 6, i * 6 + 6); }
    lg.attributes.position.needsUpdate = true;
    lg.setDrawRange(0, n * 2);
  };

  let cpSent = false, lastTrip = 0;
  return {
    update(dt, t, s) {
      const st = world.serverTime() / 1000;
      led.visible = (st * 2) % 1 < 0.5;
      // the grid is live (and visible on IR) until GHOST is through, so LINE can study it early
      const armed = s && s.phase === 'playing' && !s.lasers.cleared;
      const beams = armed || !s || s.phase !== 'playing' ? activeBeams(L, st) : [];
      setBeams(beams);
      // GHOST's IR torch lights the gate just ahead (outside the hall: treat GHOST as at the door)
      const gp = world.avatar?.group?.visible ? world.avatar.group.position : world.agentBody;
      LASER_UNIFORMS.uG.value.set(gp?.x ?? 0, 0, Math.min(gp?.z ?? 0, -0.5));
      // GHOST side trip detection
      const body = world.agentBody;
      if (!body || !armed) return;
      if (body.z < -0.5 && body.z > -26.8) {
        const hit = beamHit(beams, body.x, body.y, body.z, body.h);
        if (hit && performance.now() - lastTrip > 3000 && !body.teleporting) {
          lastTrip = performance.now();
          world.act({ k: 'trip' });
          world.onLocalAlarm?.('LASER GRID BROKEN');
        }
      }
      if (!cpSent && !s.lasers.checkpoint && body.z < HALL_CHECKPOINT.zFrom && body.z > HALL_CHECKPOINT.zTo) {
        cpSent = true;
        world.act({ k: 'checkpoint' });
      }
    },
  };
}
