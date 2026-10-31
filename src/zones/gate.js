import * as THREE from 'three';
import { Builder, PAL, stencilText, makeMatrix } from '../engine/kit.js';
import { crate, barrel, desk, chair, crt, papers, debris, drawSign, makeDoor, cameraProp, fixture } from '../facility/props.js';
import { drawGlyph } from '../../shared/glyphs.js';
import { CAMERAS } from '../../shared/layout.js';
import { LAMP_COLORS } from '../../shared/mission.js';

const LAMP_HEX = { RED: 0xff2a1e, AMBER: 0xffa316, GREEN: 0x2dff6a, BLUE: 0x3a8cff };

function chainLink(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#8c9294';
  ctx.lineWidth = 2;
  const s = 16;
  for (let i = -h; i < w + h; i += s) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
  }
}

export function buildGate(world) {
  const m = world.mission.gate;
  const B = new Builder(world, 'gate');
  // ground
  B.slab(-40, -0.3, 0, 40, 0, 70, 0x26292a, { grad: 0, jitter: 0 });
  B.slab(-6, -0.28, 0, 6, 0.02, 5, 0x3a3c3a, { grad: 0, jitter: 0.02 });
  for (let i = 0; i < 14; i++) B.box((Math.random() - 0.5) * 24, 0.004, 3 + Math.random() * 16, 1 + Math.random() * 2, 0.01, 0.6 + Math.random() * 1.5, 0x1d2021, { ry: Math.random() * 3, grad: 0, jitter: 0.1 });
  // facade (bunker face with service door)
  const fh = 7.5;
  B.slab(-16, 0, -0.4, -0.8, fh, 0, PAL.concrete, { collide: true, grad: 0.25 });
  B.slab(0.8, 0, -0.4, 16, fh, 0, PAL.concrete, { collide: true, grad: 0.25 });
  B.slab(-0.8, 2.4, -0.4, 0.8, fh, 0, PAL.concrete, { grad: 0.25 });
  for (let x = -15; x <= 15; x += 2.5) if (Math.abs(x) > 2.5) B.box(x, fh / 2, 0.02, 0.06, fh, 0.05, PAL.concreteDark, { grad: 0 });
  B.slab(-16, fh, -0.4, 16, fh + 0.4, 0.4, PAL.concreteDark);
  B.slab(-16, 0, -30, -15.6, fh, -0.4, PAL.concrete, { collide: true });
  B.slab(15.6, 0, -30, 16, fh, -0.4, PAL.concrete, { collide: true });
  // canopy over the door
  B.slab(-2.6, 3.05, 0, 2.6, 3.3, 1.7, PAL.concreteDark);
  B.box(-2.4, 1.55, 1.55, 0.18, 3.1, 0.18, PAL.metalDark, { collide: true }).box(2.4, 1.55, 1.55, 0.18, 3.1, 0.18, PAL.metalDark, { collide: true });
  fixture(B, 0, 3.04, 1.0, { along: 'x', len: 0.9, color: 0xd0e8ff, intensity: 1.4, distance: 6, flicker: 0.5, room: 'gate' });
  // hazard frame around the door
  B.decal(0, 2.62, 0.012, 0, 2.2, 0.3, 512, 64, (c, w, h) => {
    c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1b1b';
    for (let i = -h; i < w + h; i += 40) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + 20, h); c.lineTo(i + 20 + h, 0); c.lineTo(i + h, 0); c.fill(); }
  });
  B.decal(0, 5.6, 0.015, 0, 6.5, 1.3, 1024, 200, (c, w, h) => {
    stencilText(c, 'KESTREL-9', w / 2, h * 0.42, h * 0.62, '#b8b19a', { wear: 0.9, spacing: 18 });
    stencilText(c, 'RESEARCH ANNEX  ·  SECTOR B', w / 2, h * 0.86, h * 0.17, '#9c9684', { wear: 0.6, spacing: 6 });
  });
  B.decal(-3.4, 1.9, 0.012, 0, 1.3, 0.9, 260, 180, drawSign(['DANGER', 'AUTHORISED', 'PERSONNEL ONLY'], { stripe: '#b02a20', bg: '#d6cfb5' }));
  B.decal(4.2, 2.1, 0.012, 0, 1.0, 0.7, 240, 168, drawSign(['SERVICE', 'ENTRY', 'UNIT 7C'], { bg: '#38506a', fg: '#e2dccb', border: true }));
  B.decal(-8, 2.6, 0.012, 0, 2.4, 0.6, 400, 100, drawSign(['NO VEHICLES BEYOND THIS POINT']));
  // service door A
  makeDoor(world, B, { id: 'A', x: 0, z: -0.2, axis: 'x', w: 1.6, h: 2.4, mode: 'slide', color: 0x56636c, label: '7C' });

  // ---- keypad panel (agent inspects it)
  const kp = new THREE.Group();
  kp.position.set(1.4, 1.3, 0.0);
  world.scene.add(kp);
  B.box(1.4, 1.3, 0.05, 0.42, 0.62, 0.1, 0x8e8c80, { bevel: 0.02, grad: 0.1 });
  B.box(1.4, 1.3, 0.02, 0.48, 0.68, 0.04, PAL.yellow, { grad: 0 });
  B.box(1.4, 0.75, 0.03, 0.05, 0.5, 0.05, PAL.metalDark); // conduit
  const front = 0.101;
  // plate with glyphs
  const plate = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 512, height: 200 }));
  {
    const c = plate.image.getContext('2d');
    const gr = c.createLinearGradient(0, 0, 512, 200);
    gr.addColorStop(0, '#b9b8ae'); gr.addColorStop(0.5, '#d9d7cc'); gr.addColorStop(1, '#9e9c92');
    c.fillStyle = gr; c.fillRect(0, 0, 512, 200);
    c.strokeStyle = '#555'; c.lineWidth = 6; c.strokeRect(6, 6, 500, 188);
    c.fillStyle = '#333'; c.font = '700 26px "Courier New", monospace'; c.textAlign = 'center';
    c.fillText('ACCESS PLATE', 256, 38);
    m.plate.forEach((g, i) => {
      c.save();
      c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowOffsetY = 2;
      drawGlyph(c, g, 50 + i * 150, 52, 120, { color: '#1c1c1c', lineWidth: 11 });
      c.restore();
    });
    for (const [x, y] of [[20, 20], [492, 20], [20, 180], [492, 180]]) { c.fillStyle = '#777'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
  }
  plate.colorSpace = THREE.SRGBColorSpace;
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.133), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5, metalness: 0.3 }));
  plateMesh.position.set(0, 0.215, front);
  kp.add(plateMesh);
  // status lamp + serial
  const lampMat = new THREE.MeshBasicMaterial({ color: LAMP_HEX[LAMP_COLORS[m.lamp]] });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), lampMat);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(-0.14, 0.1, front + 0.012);
  kp.add(lamp);
  B.light(1.26, 1.4, 0.25, LAMP_HEX[LAMP_COLORS[m.lamp]], 0.25, 1.6, { room: 'gate' });
  const lbl = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 256, height: 64 }));
  {
    const c = lbl.image.getContext('2d');
    c.fillStyle = '#e8e2cc'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#222'; c.font = '700 30px "Courier New", monospace'; c.textBaseline = 'middle';
    c.fillText(m.serial, 14, 34);
  }
  lbl.colorSpace = THREE.SRGBColorSpace;
  const serial = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.8 }));
  serial.position.set(0.06, 0.1, front);
  kp.add(serial);
  // display
  const dispCv = Object.assign(document.createElement('canvas'), { width: 256, height: 64 });
  const disp = new THREE.CanvasTexture(dispCv);
  disp.colorSpace = THREE.SRGBColorSpace;
  const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshBasicMaterial({ map: disp }));
  dispMesh.position.set(0, 0.035, front);
  kp.add(dispMesh);
  // keys
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'ENT'];
  const keyCv = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
  {
    const c = keyCv.getContext('2d');
    keys.forEach((k, i) => {
      const x = (i % 3) * 170, y = Math.floor(i / 3) * 128;
      c.fillStyle = k === 'ENT' ? '#3d6b45' : k === 'CLR' ? '#7a3a30' : '#3c3f42';
      c.fillRect(x + 4, y + 4, 162, 120);
      c.fillStyle = '#eee'; c.font = `700 ${k.length > 1 ? 48 : 72}px "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(k, x + 85, y + 66);
    });
  }
  const keyTex = new THREE.CanvasTexture(keyCv);
  keyTex.colorSpace = THREE.SRGBColorSpace;
  const keyMat = new THREE.MeshStandardMaterial({ map: keyTex, roughness: 0.6 });
  const buttons = [];
  keys.forEach((k, i) => {
    const g = new THREE.BoxGeometry(0.075, 0.052, 0.02);
    // map front face UVs to the key cell
    const uv = g.attributes.uv;
    const cx = (i % 3) * 170, cy = Math.floor(i / 3) * 128;
    for (let v = 16; v < 20; v++) { // +z face is group 4 (verts 16..19)
      const u0 = uv.getX(v), v0 = uv.getY(v);
      uv.setXY(v, (cx + 4 + u0 * 162) / 512, 1 - (cy + 4 + (1 - v0) * 120) / 512);
    }
    const mesh = new THREE.Mesh(g, [keyMat, keyMat, keyMat, keyMat, keyMat, keyMat].map((mm, fi) => (fi === 4 ? keyMat : new THREE.MeshStandardMaterial({ color: 0x2a2c2e }))));
    mesh.position.set(-0.085 + (i % 3) * 0.085, -0.04 - Math.floor(i / 3) * 0.062, front + 0.01);
    mesh.userData.base = mesh.position.z;
    kp.add(mesh);
    world.makeButton(mesh, { key: k });
    buttons.push(mesh);
  });

  const drawDisplay = (s, t) => {
    const c = dispCv.getContext('2d');
    c.fillStyle = '#0c1a10'; c.fillRect(0, 0, 256, 64);
    c.font = '700 44px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const g = s?.gate;
    const since = g ? world.serverTime() - g.at : 1e9;
    let txt = (g?.entry || '').padEnd(4, '_').split('').join(' '), col = '#7dff9a';
    if (s?.doors?.A) { txt = 'OPEN'; col = '#7dff9a'; }
    else if (g?.status === 'denied' && since < 1800) { txt = (t * 4) % 1 < 0.5 ? 'DENIED' : ''; col = '#ff5a40'; }
    else if (g?.status === 'warn' && since < 3000) { txt = (t * 3) % 1 < 0.6 ? 'INVALID' : '1 LEFT'; col = '#ffb030'; }
    c.fillStyle = col; c.fillText(txt, 128, 34);
  };
  drawDisplay(null, 0);

  world.addInteractable({
    pos: new THREE.Vector3(1.4, 1.3, 0.12), size: [0.5, 0.7, 0.3], zone: 'gate',
    label: () => 'INSPECT KEYPAD',
    enabled: () => !world.state?.doors?.A,
    inspect: {
      camPos: new THREE.Vector3(1.4, 1.3, 0.86), lookAt: new THREE.Vector3(1.4, 1.3, 0.0), fov: 48,
      buttons,
      hint: 'CLICK KEYS  ·  0-9  ·  ENTER = ENT  ·  BACKSPACE = CLR',
      onButton: (b) => { world.act({ k: 'key', v: b.userData.button.key }); press(b); },
      onKey: (code) => {
        const map = { Enter: 'ENT', NumpadEnter: 'ENT', Backspace: 'CLR', Delete: 'CLR' };
        let v = map[code];
        if (!v && /^(Digit|Numpad)[0-9]$/.test(code)) v = code.slice(-1);
        if (!v) return false;
        world.act({ k: 'key', v });
        const b = buttons.find((x) => x.userData.button.key === v);
        if (b) press(b);
        return true;
      },
    },
  });
  const press = (b) => { b.position.z = b.userData.base - 0.008; b.userData.t = 0.12; world.sfx?.beep(880 + Math.random() * 40, 0.06); };

  // ---- yard dressing
  // fence
  const fence = (x0, z0, x1, z1, gap) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const n = Math.ceil(len / 2.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.cyl(x0 + (x1 - x0) * t, 1.3, z0 + (z1 - z0) * t, 0.05, 2.6, PAL.metalDark, { sides: 6 });
    }
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const mx = x0 + (x1 - x0) * (t0 + t1) / 2, mz = z0 + (z1 - z0) * (t0 + t1) / 2;
      if (gap && Math.hypot(mx - gap[0], mz - gap[1]) < 1.3) {
        // cut flap
        world.atlas.add({ px: 256, py: 256, draw: chainLink, worldW: len / n * 0.9, worldH: 1.2, matrix: makeMatrix(mx + 0.3, 1.9, mz + 0.5, ry + 0.7, 0, 0.1) });
        continue;
      }
      for (const off of [0.01, -0.01]) world.atlas.add({ px: 256, py: 256, draw: chainLink, worldW: len / n, worldH: 2.4, matrix: makeMatrix(mx, 1.25, mz + off, ry + (off > 0 ? 0 : Math.PI)) });
    }
    B.pipe(x0, 2.55, z0, x1, z1, 0.03, PAL.metalDark);
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    if (gap) {
      const gt = (gap[0] - x0) * ux + (gap[1] - z0) * uz;
      const a0 = 0, a1 = gt - 1.0, b0 = gt + 1.0, b1 = len;
      world.addCollider(Math.min(x0 + ux * a0, x0 + ux * a1) - 0.08, Math.max(x0 + ux * a0, x0 + ux * a1) + 0.08, Math.min(z0 + uz * a0, z0 + uz * a1) - 0.08, Math.max(z0 + uz * a0, z0 + uz * a1) + 0.08, 0, 2.6);
      world.addCollider(Math.min(x0 + ux * b0, x0 + ux * b1) - 0.08, Math.max(x0 + ux * b0, x0 + ux * b1) + 0.08, Math.min(z0 + uz * b0, z0 + uz * b1) - 0.08, Math.max(z0 + uz * b0, z0 + uz * b1) + 0.08, 0, 2.6);
    } else world.addCollider(Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08, 0, 2.6);
  };
  fence(-14, 0.2, -14, 20);
  fence(14, 0.2, 14, 20);
  fence(-14, 20, 14, 20, [3.5, 20]);
  // guard booth
  B.slab(-9.4, 0, 6, -6.6, 2.6, 6.15, PAL.wallCream, { collide: true });
  B.slab(-9.4, 0, 8.65, -6.6, 1.0, 8.8, PAL.wallCream, { collide: true });
  B.slab(-9.4, 2.0, 8.65, -6.6, 2.6, 8.8, PAL.wallCream);
  B.slab(-9.4, 0, 6.15, -9.25, 2.6, 8.65, PAL.wallCream, { collide: true });
  B.slab(-6.75, 0, 6.15, -6.6, 2.6, 7.4, PAL.wallCream, { collide: true });
  B.slab(-6.75, 2.2, 7.4, -6.6, 2.6, 8.65, PAL.wallCream);
  B.slab(-9.5, 2.6, 5.9, -6.5, 2.75, 8.9, PAL.metalDark);
  B.box(-8.0, 1.5, 8.72, 2.6, 0.04, 0.04, PAL.metalDark).box(-8, 1.5, 8.72, 0.04, 1.0, 0.04, PAL.metalDark);
  desk(B, -8, 8.1, Math.PI, { w: 1.6, d: 0.6 });
  crt(B, -8.3, 0.77, 8.1, Math.PI, { on: true, screen: 0x1a4a2a });
  B.light(-8.3, 1.2, 8.4, 0x3aff7a, 0.35, 2.5, { room: 'gate', flicker: 0.4 });
  chair(B, -7.8, 7.3, 0, true);
  papers(B, -8, 7, 8, 1.2);
  B.slab(-6.62, 0, 7.42, -6.0, 2.15, 7.47, 0x6b7066, { ry: 0 });
  // SOP 7C-4 pinned inside the booth: the check-digit procedure lives here, not on LINE's blueprint
  B.decal(-8.05, 1.55, 6.165, 0, 0.72, 0.52, 720, 520, drawSop);
  // floodlight
  B.cyl(9, 3, 9, 0.1, 6, PAL.metalDark, { sides: 6, collide: true });
  B.box(8.8, 6.0, 8.6, 0.7, 0.45, 0.35, PAL.metalDark, { rx: 0.5, bevel: 0.04 });
  B.box(8.8, 5.85, 8.4, 0.6, 0.35, 0.05, 0xffd29a, { rx: 0.5, glow: true });
  B.light(8.5, 5.4, 7.6, PAL.sodium, 9, 22, { room: 'gate', flicker: 0.35, decay: 1.2 });
  // wrecked truck
  const tx = 6.5, tz = 15;
  B.box(tx, 1.15, tz, 2.2, 1.4, 4.4, PAL.rust, { bevel: 0.08, collide: true, ry: 0.25 });
  B.box(tx - 0.3, 1.95, tz - 2.6, 2.1, 1.5, 1.6, 0x4e5a52, { bevel: 0.1, collide: true, ry: 0.25 });
  B.box(tx - 0.33, 2.25, tz - 3.35, 1.8, 0.6, 0.05, 0x1a2228, { ry: 0.25 });
  for (const [ox, oz] of [[-1.1, -2.4], [1.1, -2.0], [-1.1, 1.2], [1.1, 1.6]]) B.cyl(tx + ox, 0.42, tz + oz, 0.42, 0.3, PAL.rubber, { rz: Math.PI / 2, ry: 0.25, sides: 8 });
  // barrels, crates, pallets, cones
  barrel(B, -4.2, 1.6); barrel(B, -4.9, 2.1, { color: 0x3f5c3a }); barrel(B, -4.4, 2.8, { tipped: true, ry: 0.6 });
  crate(B, 4.6, 1.8, 1.0); crate(B, 5.5, 1.6, 0.8, { ry: 0.4 }); crate(B, 4.9, 1.9, 0.6, { y: 1.0, ry: 0.2, collide: false });
  for (let i = 0; i < 3; i++) B.box(-10.5, 0.07 + i * 0.15, 13, 1.2, 0.12, 1.0, PAL.wood, { ry: 0.1 * i, collide: i === 0 });
  for (const [cx, cz] of [[-2.5, 6], [2.8, 7.2], [-1, 9.5]]) B.cyl(cx, 0.3, cz, 0.06, 0.6, PAL.orange, { r2: 0.02, sides: 8 }).box(cx, 0.02, cz, 0.36, 0.04, 0.36, PAL.orange);
  debris(B, 1.5, 4.5, 6); debris(B, -6, 3, 5);
  // sign on the ground
  B.box(-3, 0.5, 12, 1.8, 1.0, 0.06, 0xb9b29a, { rx: -1.35, ry: 0.3 });
  // treeline outside the fence
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 1.2 - 0.1;
    const r = 24 + Math.random() * 26;
    const x = Math.cos(a) * r * 1.2, z = 6 + Math.sin(a) * r;
    if (z < 22 && Math.abs(x) < 16) continue;
    const h = 5 + Math.random() * 6;
    B.cyl(x, h / 2 + 0.6, z, 1.4 + Math.random(), h, 0x152019, { r2: 0, sides: 6, grad: 0.5 });
    B.cyl(x, 0.5, z, 0.18, 1.2, 0x231b14, { sides: 5 });
  }
  cameraProp(B, CAMERAS[0].pos, CAMERAS[0].look);
  B.finish(world.scene);
  world.addInteractable({
    pos: new THREE.Vector3(-8.05, 1.55, 6.3), size: [0.8, 0.6, 0.3], zone: 'gate',
    label: () => 'READ NOTICE',
    inspect: { camPos: new THREE.Vector3(-8.05, 1.55, 6.95), lookAt: new THREE.Vector3(-8.05, 1.55, 6.16), fov: 46, res: 2.4, buttons: [], hint: 'SOP 7C-4' },
  });

  return {
    update(dt, t, s) {
      drawDisplay(s, t);
      disp.needsUpdate = true;
      for (const b of buttons) if (b.userData.t > 0) { b.userData.t -= dt; if (b.userData.t <= 0) b.position.z = b.userData.base; }
    },
  };
}

// SOP 7C-4: a laminated procedure sheet, slightly faded, drawn as a small flowchart
function drawSop(c, w, h) {
  c.fillStyle = '#e4ddc6'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2b3a55'; c.fillRect(0, 0, w, 62);
  c.fillStyle = '#efe8d2'; c.font = '900 30px "Arial Black", sans-serif'; c.textBaseline = 'middle';
  c.fillText('SOP 7C-4', 22, 31);
  c.font = '700 20px Arial, sans-serif'; c.fillText('SERVICE ENTRY — CHECK DIGIT', 230, 32);
  c.fillStyle = '#1c1c1c'; c.strokeStyle = '#1c1c1c'; c.lineWidth = 3;
  const t = (s, x, y, size = 21, wgt = 700, al = 'left') => { c.font = `${wgt} ${size}px Arial, sans-serif`; c.textAlign = al; c.fillText(s, x, y); c.textAlign = 'left'; };
  t('D1 D2 D3 = THE FIRST THREE DIGITS (FROM CONTROL, TABLE 7C-1)', 22, 92, 19, 700);
  // flow
  c.strokeRect(210, 116, 300, 50); t('LAST DIGIT OF THE PLATE', 360, 133, 19, 700, 'center'); t('SERIAL (KX-####) ODD?', 360, 153, 19, 700, 'center');
  c.beginPath(); c.moveTo(210, 141); c.lineTo(110, 141); c.lineTo(110, 200); c.moveTo(510, 141); c.lineTo(610, 141); c.lineTo(610, 200); c.stroke();
  const head = (x, y) => { c.beginPath(); c.moveTo(x - 9, y - 14); c.lineTo(x + 9, y - 14); c.lineTo(x, y); c.fill(); };
  head(110, 204); head(610, 204);
  t('YES', 122, 178, 20, 900); t('NO', 622, 178, 20, 900);
  c.strokeRect(22, 208, 300, 76); t('C = (D1 × D3 + D2)', 172, 236, 24, 900, 'center'); t('MOD 10', 172, 266, 22, 900, 'center');
  c.strokeRect(398, 208, 300, 76); t('C = (D1 + D2 + D3)', 548, 236, 24, 900, 'center'); t('MOD 10', 548, 266, 22, 900, 'center');
  c.beginPath(); c.moveTo(172, 284); c.lineTo(172, 318); c.lineTo(548, 318); c.lineTo(548, 284); c.moveTo(360, 318); c.lineTo(360, 342); c.stroke(); head(360, 350);
  c.strokeRect(150, 352, 420, 56); t('KEY IN  D1 D2 D3 C  →  ENT', 360, 380, 25, 900, 'center');
  t('MOD 10 = THE LAST DIGIT OF THE ANSWER.   E.G. 4 × 2 + 7 = 15 → 5', 22, 436, 18, 400);
  t('A WRONG CODE RAISES THE ALARM.', 22, 462, 18, 700);
  c.save(); c.translate(470, 486); c.rotate(-0.06); c.fillStyle = '#1d3f9a'; c.font = 'italic 700 22px "Comic Sans MS", "Bradley Hand", cursive'; c.fillText('do the maths twice', 0, 0); c.restore();
  // fade and pin
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(120,100,60,0)'); g.addColorStop(1, 'rgba(120,100,60,0.18)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#b02a20'; c.beginPath(); c.arc(w / 2, 12, 8, 0, 7); c.fill();
}
