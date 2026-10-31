import * as THREE from 'three';
import { Builder, PAL, stencilText } from '../engine/kit.js';
import { room, fixture, emergencyLamp, drawSign, desk, chair, crt, papers, debris, cableTray, pipeRun, cameraProp, makeDoor, shelf } from '../facility/props.js';
import { drawGlyph } from '../../shared/glyphs.js';
import { CAMERAS } from '../../shared/layout.js';

// Substation 2: dead power, a patch frame with six glyph sockets, six numbered sockets and three
// jumper cables. GHOST plugs, LINE traces the right drawing on E-1 and closes the breaker remotely.

const COLORS = ['RED', 'GREEN', 'WHITE'];
const HEX = { RED: 0xc8281e, GREEN: 0x2f9a44, WHITE: 0xe6e2d6 };
const FX = 6.2; // frame face x
const ZC = -33; // frame centre z

const sockPos = (id) => {
  const k = +id[1];
  const y = id[0] === 'T' ? 1.62 : 1.02;
  return new THREE.Vector3(FX - 0.02, y, ZC - 0.78 + k * 0.312);
};
const hookPos = (ci, end) => new THREE.Vector3(FX - 0.06, 0.66, ZC - 0.7 + (ci * 2 + end) * 0.28);

export function buildPatch(world) {
  const P = world.mission.patch;
  const B = new Builder(world, 'patch');
  const h = 4.2;
  room(B, { x0: -7, x1: 7, z0: -39, z1: -27, h, openings: [{ side: 'S', at: 0, w: 1.8, h: 2.5 }, { side: 'W', at: -33, w: 1.6, h: 2.4 }], lower: 0x4a4f4a, upper: 0x7c7a6c, floor: 0x343633, ceil: 0x414340, band: 1.4 });
  // passage to the undercroft
  room(B, { x0: -9.05, x1: -7.3, z0: -33.8, z1: -32.2, h: 2.5, skip: ['W', 'E'], lower: 0x3a3c3a, upper: 0x4a4b47, floor: 0x2c2e2c, band: 1.0 });
  makeDoor(world, B, { id: 'C', x: -7.15, z: -33, axis: 'z', w: 1.6, h: 2.4, mode: 'lift', color: 0x5d6a50, label: 'C' });
  // transformers along the north wall
  for (const x of [-4.5, -1.5, 1.5]) {
    B.box(x, 1.2, -37.6, 2.2, 2.4, 1.6, 0x56605a, { bevel: 0.05, collide: true });
    for (let k = -4; k <= 4; k++) B.box(x + k * 0.22, 1.1, -36.75, 0.06, 1.8, 0.14, 0x464e49);
    B.cyl(x - 0.6, 2.65, -37.6, 0.12, 0.5, 0x8a7a5a, { sides: 8 }).cyl(x, 2.65, -37.6, 0.12, 0.5, 0x8a7a5a, { sides: 8 }).cyl(x + 0.6, 2.65, -37.6, 0.12, 0.5, 0x8a7a5a, { sides: 8 });
    B.decal(x, 1.6, -36.79, 0, 0.9, 0.6, 240, 160, drawSign(['DANGER', '11 kV'], { stripe: '#b02a20', bg: '#d6cfb5' }));
  }
  cableTray(B, -6.5, 3.6, -36.5, 6.5, -36.5);
  cableTray(B, 6.6, 3.6, -38.5, 6.6, -27.5);
  pipeRun(B, -6.7, 3.8, -27.5, -6.7, -38.5, { r: 0.1 });
  // control desk
  desk(B, -4.2, -29.2, Math.PI, { w: 2.2, d: 0.8 });
  crt(B, -4.8, 0.77, -29.3, Math.PI, {});
  crt(B, -3.7, 0.77, -29.3, Math.PI, {});
  chair(B, -4.3, -30.1, 0.4);
  papers(B, -3.4, -30.6, 7, 1.4);
  shelf(B, 4.8, -28.0, Math.PI, { w: 2.0 });
  debris(B, 2, -31, 6, 1.2);
  B.box(-1.2, 0.05, -31.5, 2.2, 0.02, 1.4, 0x1f2a2c, { grad: 0 }); // puddle
  // lockers
  for (let i = 0; i < 4; i++) B.box(-6.65, 0.95, -35.5 + i * 0.62, 0.5, 1.9, 0.58, i % 2 ? 0x5a6a72 : 0x52626a, { bevel: 0.02, collide: true });
  B.decal(-6.99 + 0.01, 1.7, -31.0, Math.PI / 2, 1.2, 0.5, 300, 120, drawSign(['UNDERCROFT', '← BULKHEAD C'], { bg: '#38506a', fg: '#e2dccb' }));
  B.decal(6.99 - 0.01, 2.6, -30.0, -Math.PI / 2, 1.0, 0.6, 260, 150, drawSign(['PATCH FRAME', 'AUTHORISED', 'ELECTRICIANS'], { stripe: '#e0a020' }));
  // lights: emergency until power returns
  emergencyLamp(B, 0, 3.4, -38.8, 0, { room: 'patch', intensity: 1.2, distance: 9, id: 'patch-em1' });
  emergencyLamp(B, -6.8, 2.6, -30, Math.PI / 2, { room: 'patch', intensity: 0.8, distance: 7, id: 'patch-em2' });
  const mains = [];
  [[-3.5, -30], [3.5, -30], [-3.5, -35.5], [3.5, -35.5], [0, -33]].forEach(([x, z], i) => {
    fixture(B, x, h - 0.02, z, { along: 'x', color: 0xe6f2ff, intensity: 2.4, distance: 11, room: 'patch', id: `patch-main-${i}`, flicker: i === 2 ? 0.4 : 0 });
  });
  for (const a of world.lightAnchors) if (a.id?.startsWith('patch-main')) { a.on = false; mains.push(a); }

  // ---- the patch frame cabinet
  B.box(6.6, 1.15, ZC, 0.8, 2.3, 2.5, 0x6e7468, { bevel: 0.03, collide: true });
  B.box(6.6, 2.32, ZC, 0.86, 0.06, 2.56, 0x4e534a);
  B.box(FX - 0.01, 2.27, ZC, 0.03, 0.05, 2.5, PAL.yellow, { grad: 0 }).box(FX - 0.01, 0.06, ZC, 0.03, 0.05, 2.5, PAL.yellow, { grad: 0 });
  // breaker lever housing
  B.box(FX - 0.06, 1.95, ZC + 1.05, 0.1, 0.32, 0.18, 0x3a3d38);
  // face artwork (static): grid, labels, ID plate
  B.decal(FX - 0.005, 1.32, ZC, -Math.PI / 2, 2.3, 1.6, 1024, 712, (c, w, hh) => {
    c.fillStyle = '#8a8f82'; c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#4b4f46'; c.lineWidth = 4; c.strokeRect(10, 10, w - 20, hh - 20);
    // ID plate
    c.fillStyle = '#d9d4c0'; c.fillRect(40, 30, 420, 92);
    c.strokeStyle = '#333'; c.lineWidth = 3; c.strokeRect(40, 30, 420, 92);
    c.fillStyle = '#222'; c.font = '700 22px "Courier New", monospace'; c.textAlign = 'left';
    c.fillText('PATCH FRAME · SUBSTATION 2', 56, 60);
    c.font = '700 46px "Courier New", monospace';
    c.fillText(P.frameId, 56, 108);
    c.fillStyle = '#222'; c.font = '700 20px "Courier New", monospace';
    c.fillText('SOURCE BUS', 520, 112);
    c.fillText('LOAD BUS', 520, 408);
    c.fillText('JUMPERS', 40, 640);
    // glyph labels above top sockets
    const sx = (k) => w / 2 + (k - 2.5) * (0.312 / 2.3) * w;
    P.topOrder.forEach((g, k) => {
      c.fillStyle = '#e8e2cc'; c.fillRect(sx(k) - 44, 132, 88, 88);
      c.strokeStyle = '#333'; c.lineWidth = 2; c.strokeRect(sx(k) - 44, 132, 88, 88);
      drawGlyph(c, g, sx(k) - 34, 142, 68, { color: '#1a1a1a', lineWidth: 7 });
    });
    P.bottomOrder.forEach((n, k) => {
      c.fillStyle = '#e8e2cc'; c.fillRect(sx(k) - 34, 520, 68, 62);
      c.strokeStyle = '#333'; c.strokeRect(sx(k) - 34, 520, 68, 62);
      c.fillStyle = '#1a1a1a'; c.font = '900 50px "Arial Black", sans-serif'; c.textAlign = 'center';
      c.fillText(String(n), sx(k), 570);
    });
    c.textAlign = 'left';
    // rivets + scratches
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(40,40,30,0.25)'; c.fillRect(Math.random() * w, Math.random() * hh, Math.random() * 40, 1.5); }
    for (const [x, y] of [[22, 22], [w - 22, 22], [22, hh - 22], [w - 22, hh - 22]]) { c.fillStyle = '#555'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
  });
  cameraProp(B, CAMERAS[3].pos, CAMERAS[3].look);
  for (const cam of CAMERAS.filter((c) => c.id === 'CAM-05')) cameraProp(B, cam.pos, cam.look);
  B.finish(world.scene);

  // ---- dynamic: sockets, plugs, cables, meters, lever
  const group = new THREE.Group();
  world.scene.add(group);
  const sockMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.4, metalness: 0.4 });
  const buttons = [];
  const sockets = {};
  for (const row of ['T', 'B']) for (let k = 0; k < 6; k++) {
    const id = `${row}${k}`;
    const p = sockPos(id);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 10), ringMat);
    ring.position.copy(p); ring.rotation.y = Math.PI / 2;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), sockMat);
    hole.position.copy(p).add(new THREE.Vector3(-0.005, 0, 0)); hole.rotation.y = -Math.PI / 2;
    group.add(ring, hole);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.13), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(p);
    group.add(hit);
    world.makeButton(hit, { kind: 'socket', id });
    buttons.push(hit);
    sockets[id] = { ring };
  }
  const hookMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.4 });
  const hooks = [];
  COLORS.forEach((col, ci) => [0, 1].forEach((end) => {
    const p = hookPos(ci, end);
    const hk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), hookMat);
    hk.position.copy(p).add(new THREE.Vector3(-0.02, 0.06, 0));
    group.add(hk);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(p);
    group.add(hit);
    world.makeButton(hit, { kind: 'hook', color: col, end });
    buttons.push(hit);
    hooks.push(hit);
  }));
  // plugs
  const tagTex = (txt, col) => {
    const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 32 });
    const c = cv.getContext('2d');
    c.fillStyle = '#e8e2cc'; c.fillRect(0, 0, 64, 32);
    c.fillStyle = col; c.font = '900 22px "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, 32, 17);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const plugs = {};
  COLORS.forEach((col) => [0, 1].forEach((end) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 8), new THREE.MeshStandardMaterial({ color: HEX[col], roughness: 0.5, flatShading: true }));
    body.rotation.z = Math.PI / 2;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), ringMat);
    pin.rotation.z = Math.PI / 2; pin.position.x = 0.08;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: tagTex({ RED: 'RD', GREEN: 'GN', WHITE: 'WH' }[col], col === 'WHITE' ? '#555' : `#${HEX[col].toString(16).padStart(6, '0')}`) }));
    tag.position.set(-0.01, 0.0, 0); tag.rotation.y = -Math.PI / 2; tag.position.x = -0.062;
    g.add(body, pin, tag);
    group.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
    g.add(hit);
    world.makeButton(hit, { kind: 'plug', color: col, end });
    buttons.push(hit);
    plugs[`${col}${end}`] = { g, body, target: new THREE.Vector3(), pos: new THREE.Vector3(), col, end };
  }));
  const cables = {};
  COLORS.forEach((col) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: HEX[col], roughness: 0.7, flatShading: true }));
    group.add(m);
    cables[col] = m;
  });
  const curve = (a, b) => {
    const mid = a.clone().lerp(b, 0.5);
    const d = a.distanceTo(b);
    mid.y -= 0.12 + d * 0.35;
    mid.x -= 0.18 + d * 0.15;
    const ax = a.clone().add(new THREE.Vector3(-0.1, -0.02, 0));
    const bx = b.clone().add(new THREE.Vector3(-0.1, -0.02, 0));
    return new THREE.CatmullRomCurve3([a, ax, mid, bx, b]);
  };
  // meters + lever + status lamps
  const meters = [];
  for (let i = 0; i < 3; i++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 }));
    face.position.set(FX - 0.012, 1.98, ZC + 0.05 + i * 0.25); face.rotation.y = -Math.PI / 2;
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.07, 0.006), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    needle.geometry.translate(0, 0.035, 0);
    needle.position.set(FX - 0.02, 1.95, ZC + 0.05 + i * 0.25);
    group.add(face, needle);
    meters.push(needle);
  }
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), new THREE.MeshStandardMaterial({ color: 0xb02a20 }));
  lever.geometry.translate(0, 0.12, 0);
  lever.position.set(FX - 0.12, 1.95, ZC + 1.05);
  group.add(lever);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x401010 }));
  lamp.position.set(FX - 0.02, 2.16, ZC + 1.05);
  group.add(lamp);
  // sparks
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(60 * 3), sparkVel = new Float32Array(60 * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffd27a, size: 3, sizeAttenuation: false }));
  sparks.visible = false; sparks.frustumCulled = false;
  world.scene.add(sparks);
  let sparkT = 0;
  const sparkLight = { x: FX - 0.3, y: 1.4, z: ZC, color: 0xffc070, intensity: 0, distance: 5, room: 'patch', on: true, decay: 1.5, mult: 1 };
  world.lightAnchors.push(sparkLight);

  let held = null;
  const placeOf = (key, s) => {
    const sock = s?.patch?.plugs?.[key];
    if (sock) return sockPos(sock).add(new THREE.Vector3(-0.07, 0, 0));
    const ci = COLORS.indexOf(key.slice(0, -1)), end = +key.slice(-1);
    return hookPos(ci, end).add(new THREE.Vector3(-0.04, -0.02, 0));
  };
  let lastPlugs = '';
  let cursorPoint = null;

  world.addInteractable({
    pos: new THREE.Vector3(FX - 0.2, 1.3, ZC), size: [0.5, 2.2, 2.4], zone: 'patch',
    label: () => (world.state?.patch?.power ? 'PATCH FRAME (ONLINE)' : 'INSPECT PATCH FRAME'),
    inspect: {
      camPos: new THREE.Vector3(FX - 1.6, 1.3, ZC), lookAt: new THREE.Vector3(FX, 1.24, ZC), fov: 60,
      buttons,
      hint: 'CLICK A PLUG TO PICK IT UP · CLICK A SOCKET TO PLUG IN · CLICK A HOOK TO HANG IT BACK',
      onExit: () => { held = null; },
      onHover: (btn, hit) => { cursorPoint = hit ? hit.point.clone() : null; },
      onButton: (btn) => {
        const s = world.state;
        if (s?.patch?.power) return;
        const d = btn.userData.button;
        if (d.kind === 'plug') { held = `${d.color}${d.end}`; world.sfx?.click(0.1); return; }
        if (d.kind === 'socket') {
          const occupant = Object.entries(s.patch.plugs).find(([, v]) => v === d.id)?.[0];
          if (held) {
            if (occupant && occupant !== held) return;
            world.act({ k: 'plug', color: held.slice(0, -1), end: +held.slice(-1), socket: d.id });
            world.sfx?.plug(sockPos(d.id));
            held = null;
          } else if (occupant) { held = occupant; world.sfx?.click(0.1); }
          return;
        }
        if (d.kind === 'hook' && held) {
          world.act({ k: 'plug', color: held.slice(0, -1), end: +held.slice(-1), socket: null });
          world.sfx?.click(0.08);
          held = null;
        }
      },
    },
  });

  world.net?.on?.('ev', () => {});
  const onSpark = () => {
    sparkT = 1.2;
    sparks.visible = true;
    for (let i = 0; i < 60; i++) {
      sparkPos.set([FX - 0.1, 1.3 + Math.random() * 0.4, ZC + (Math.random() - 0.5) * 1.6], i * 3);
      sparkVel.set([-Math.random() * 2.5, Math.random() * 2.5, (Math.random() - 0.5) * 2], i * 3);
    }
    world.sfx?.spark({ x: FX, y: 1.4, z: ZC });
  };
  world.onSpark = onSpark;

  let powerT = 0;
  return {
    update(dt, t, s) {
      const st = s?.patch;
      const key = JSON.stringify(st?.plugs || {}) + (held || '');
      // plug targets
      let moving = false;
      for (const [k, p] of Object.entries(plugs)) {
        let target = placeOf(k, s);
        if (held === k && cursorPoint) target = cursorPoint.clone().add(new THREE.Vector3(-0.12, 0, 0));
        else if (held === k) target = target.clone().add(new THREE.Vector3(-0.15, 0.05, 0));
        if (p.pos.distanceToSquared(target) > 1e-6) moving = true;
        p.pos.lerp(target, Math.min(1, dt * 14));
        p.g.position.copy(p.pos);
        p.g.rotation.y = 0;
        p.body.material.emissive = new THREE.Color(held === k ? 0x553311 : 0x000000);
      }
      if (key !== lastPlugs || held || moving) {
        lastPlugs = key;
        for (const col of COLORS) {
          const a = plugs[`${col}0`].pos.clone().add(new THREE.Vector3(-0.07, 0, 0));
          const b = plugs[`${col}1`].pos.clone().add(new THREE.Vector3(-0.07, 0, 0));
          const g = new THREE.TubeGeometry(curve(a, b), 24, 0.012, 5, false);
          cables[col].geometry.dispose();
          cables[col].geometry = g;
        }
      }
      // power
      const on = !!st?.power;
      powerT = on ? Math.min(1, powerT + dt * 0.6) : 0;
      mains.forEach((a, i) => { a.on = on && powerT > 0.15 + i * 0.12; });
      meters.forEach((n, i) => { n.rotation.x = on ? -0.9 + powerT * 1.4 + Math.sin(t * 3 + i) * 0.03 : -0.9; });
      lever.rotation.x = on ? -2.6 : 0;
      lamp.material.color.setHex(on ? 0x40ff70 : st && st.fault > 0 && (t * 2) % 1 < 0.5 ? 0xff3020 : 0x401010);
      // sparks
      if (sparkT > 0) {
        sparkT -= dt;
        for (let i = 0; i < 60; i++) {
          sparkVel[i * 3 + 1] -= 9 * dt;
          sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkLight.intensity = Math.random() * 3 * Math.max(0, sparkT);
        if (sparkT <= 0) { sparks.visible = false; sparkLight.intensity = 0; }
      }
    },
  };
}
