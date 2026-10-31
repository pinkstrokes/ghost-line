import * as THREE from 'three';
import { Builder, PAL, stencilText } from '../engine/kit.js';
import { room, fixture, emergencyLamp, drawSign, cameraProp, crate, papers, debris } from '../facility/props.js';
import { ZONES, CAMERAS } from '../../shared/layout.js';

// Secure store. A round vault door with a 0-99 dial: GHOST turns and reads numbers, LINE watches
// the contact-mic scope for the true gate signature. Behind it: the ARCHIVE CORE.

const DX = -11, DZ = -62, DY = 1.35, R = 1.25;

function dialTexture() {
  const cv = Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 });
  const c = cv.getContext('2d');
  c.translate(512, 512);
  const g = c.createRadialGradient(0, 0, 100, 0, 0, 512);
  g.addColorStop(0, '#2a2a28'); g.addColorStop(0.7, '#1c1c1a'); g.addColorStop(1, '#0e0e0d');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 510, 0, 7); c.fill();
  c.strokeStyle = '#8a8676'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 500, 0, 7); c.stroke();
  for (let n = 0; n < 100; n++) {
    const a = -Math.PI / 2 + (n / 100) * Math.PI * 2;
    const r0 = n % 10 === 0 ? 392 : n % 5 === 0 ? 412 : 444;
    c.strokeStyle = '#e8e2cc'; c.lineWidth = n % 5 === 0 ? 8 : 4;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * 492, Math.sin(a) * 492); c.stroke();
    if (n % 5) continue;
    c.save(); c.translate(Math.cos(a) * 340, Math.sin(a) * 340); c.rotate(a + Math.PI / 2);
    c.fillStyle = n % 10 === 0 ? '#ffffff' : '#cfc8b2';
    c.font = `900 ${n % 10 === 0 ? 64 : 48}px "Arial Black", "Helvetica Neue", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n), 0, 0);
    c.restore();
  }
  c.fillStyle = '#3a3a36'; c.beginPath(); c.arc(0, 0, 250, 0, 7); c.fill();
  c.strokeStyle = '#141412'; c.lineWidth = 10;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 200, Math.sin(a) * 200); c.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildVault(world) {
  const V = world.mission.vault;
  const A = ZONES.vault, VR = ZONES.vaultRoom;
  const B = new Builder(world, 'vault');
  room(B, { x0: A.x0, x1: A.x1, z0: A.z0, z1: A.z1, h: A.h, openings: [{ side: 'W', at: -56, w: 1.6, h: 2.6 }, { side: 'N', at: DX, w: 2.6, h: 2.7 }], lower: 0x50504a, upper: 0x8a8576, floor: 0x3a3936, ceil: 0x464542, band: 1.2 });
  room(B, { x0: VR.x0, x1: VR.x1, z0: VR.z0, z1: VR.z1, h: VR.h, skip: ['S'], openings: [{ side: 'E', at: -65, w: 1.6, h: 2.4 }], lower: 0x5a5a54, upper: 0x6e6c64, floor: 0x2e2e2c, ceil: 0x3a3a38, band: 3.4 });
  // massive door ring set into the wall
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    B.box(DX + Math.cos(a) * 1.5, DY + Math.sin(a) * 1.5, DZ + 0.12, 0.85, 0.5, 0.36, 0x6a6a62, { rz: a + Math.PI / 2, grad: 0.1 });
  }
  B.slab(DX - 1.9, 0, DZ - 0.3, DX - 1.3, 3.0, DZ + 0.3, 0x5a5a52, { collide: true });
  B.slab(DX + 1.3, 0, DZ - 0.3, DX + 1.9, 3.0, DZ + 0.3, 0x5a5a52, { collide: true });
  // floor plate in front of the door
  B.box(DX, 0.01, DZ + 1.3, 3.4, 0.02, 2.2, 0x4a4a44, { grad: 0 });
  B.floorDecal(DX, DZ + 2.0, 0, 3.0, 0.5, 512, 80, (c, w, h) => {
    c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1b1b';
    for (let i = -h; i < w + h; i += 40) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + 20, h); c.lineTo(i + 20 + h, 0); c.lineTo(i + h, 0); c.fill(); }
  });
  // antechamber dressing
  B.box(-6.6, 1.0, -55, 0.6, 2.0, 2.4, 0x5d6258, { bevel: 0.03, collide: true });
  B.decal(-6.29, 1.5, -55, -Math.PI / 2, 1.6, 0.9, 400, 220, drawSign(['SECURE STORE', 'TWO-PERSON RULE', 'NO EXCEPTIONS'], { stripe: '#b02a20' }));
  crate(B, -14.8, -51.2, 1.0); crate(B, -13.7, -51.0, 0.7, { ry: 0.5 }); debris(B, -8, -52, 5);
  papers(B, -12.5, -57, 6, 1.4);
  [[-11, -53], [-11, -59]].forEach(([x, z], i) => fixture(B, x, A.h - 0.02, z, { along: 'x', len: 1.4, intensity: 2.0, distance: 9, room: 'vault', flicker: i ? 0.5 : 0 }));
  emergencyLamp(B, -15.9, 3.0, -52, Math.PI / 2, { room: 'vault', intensity: 0.6 });
  // vault room: deposit boxes on three walls
  for (let y = 0.4; y < 3.1; y += 0.42) {
    for (let x = VR.x0 + 0.35; x < VR.x1 - 0.2; x += 0.5) B.box(x, y, VR.z0 + 0.16, 0.46, 0.38, 0.3, 0x8c8a7e, { bevel: 0.015, grad: 0.1 }).box(x, y, VR.z0 + 0.32, 0.12, 0.04, 0.03, 0x3a3a36);
    for (let z = VR.z0 + 0.6; z < VR.z1 - 0.3; z += 0.5) B.box(VR.x0 + 0.16, y, z, 0.3, 0.38, 0.46, 0x8c8a7e, { bevel: 0.015, grad: 0.1 });
  }
  world.addCollider(VR.x0, VR.x1, VR.z0, VR.z0 + 0.32, 0, 3.4);
  world.addCollider(VR.x0, VR.x0 + 0.32, VR.z0, VR.z1, 0, 3.4);
  // core pedestal
  B.cyl(-11, 0.5, -65.2, 0.4, 1.0, 0x5a5a54, { sides: 8, collide: true });
  B.box(-11, 1.02, -65.2, 0.9, 0.04, 0.9, PAL.metalDark);
  fixture(B, -11, VR.h - 0.02, -65.2, { along: 'z', len: 1.0, intensity: 1.2, distance: 6, room: 'vault' });
  cameraProp(B, CAMERAS[6].pos, CAMERAS[6].look, { ceil: 4 });
  B.decal(-8.02, 2.6, -65, -Math.PI / 2, 1.2, 0.5, 300, 120, drawSign(['EMERGENCY', 'HATCH H'], { stripe: '#b02a20' }));
  // model plate on the door frame (upper left)
  B.decal(DX - 1.6, 2.7, DZ + 0.31, 0, 0.62, 0.3, 300, 145, (c, w, h) => {
    c.fillStyle = '#c9c3ad'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#333'; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = '#1c1c1c'; c.textAlign = 'center';
    c.font = '700 18px "Courier New", monospace'; c.fillText('MODEL', w / 2, 34);
    c.font = `900 ${V.model.length > 11 ? 30 : 36}px "Arial Black", sans-serif`; c.fillText(V.model, w / 2, 78);
    c.font = '700 18px "Courier New", monospace'; c.fillText(`SER ${V.serial}`, w / 2, 118);
  });
  B.finish(world.scene);

  // ---- swing door
  const pivot = new THREE.Group();
  pivot.position.set(DX - R - 0.02, 0, DZ + 0.05);
  world.scene.add(pivot);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8e8c84, flatShading: true, roughness: 0.45, metalness: 0.55 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x55544e, flatShading: true, roughness: 0.5, metalness: 0.5 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.5, 20), steel);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(R, DY, -0.05);
  pivot.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.05, 6, 20), darkSteel);
  ring.position.set(R, DY, 0.21);
  pivot.add(ring);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), darkSteel);
    bolt.position.set(R + Math.cos(a) * R * 0.99, DY + Math.sin(a) * R * 0.99, -0.05);
    bolt.rotation.z = a + Math.PI / 2;
    pivot.add(bolt);
  }
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), darkSteel);
  hinge.position.set(0, DY, 0.1);
  pivot.add(hinge);
  // dial
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.32, 48), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.5, metalness: 0.3 }));
  dial.position.set(R - 0.2, DY + 0.05, 0.21);
  pivot.add(dial);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.09, 12), darkSteel);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(R - 0.2, DY + 0.05, 0.25);
  pivot.add(knob);
  const index = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 3), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  index.rotation.z = Math.PI;
  index.position.set(R - 0.2, DY + 0.05 + 0.345, 0.215);
  index.scale.set(1.2, 1.2, 1.2);
  pivot.add(index);
  // mechanical readout window just under the index (exact number, so the call-outs stay clean)
  const roCv = Object.assign(document.createElement('canvas'), { width: 128, height: 64 });
  const roTex = new THREE.CanvasTexture(roCv); roTex.colorSpace = THREE.SRGBColorSpace;
  const readout = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.065), new THREE.MeshBasicMaterial({ map: roTex }));
  readout.position.set(R - 0.2, DY + 0.05 + 0.43, 0.215);
  pivot.add(readout);
  const roFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.085, 0.01), darkSteel);
  roFrame.position.set(R - 0.2, DY + 0.05 + 0.43, 0.208);
  pivot.add(roFrame);
  let roShown = -1;
  const drawReadout = (n) => {
    if (n === roShown) return;
    roShown = n;
    const c = roCv.getContext('2d');
    c.fillStyle = '#e9e2c8'; c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#111'; c.font = '900 50px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n).padStart(2, '0'), 64, 35);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 128, 10); c.fillRect(0, 54, 128, 10);
    roTex.needsUpdate = true;
  };
  drawReadout(V.start);
  // handle wheel
  const handle = new THREE.Group();
  handle.position.set(R + 0.62, DY - 0.1, 0.24);
  for (let k = 0; k < 3; k++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), darkSteel);
    spoke.rotation.z = -(k / 3) * Math.PI * 2;
    spoke.position.set(Math.sin((k / 3) * Math.PI * 2) * 0.21, Math.cos((k / 3) * Math.PI * 2) * 0.21, 0);
    handle.add(spoke);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), steel);
    ball.position.set(Math.sin((k / 3) * Math.PI * 2) * 0.42, Math.cos((k / 3) * Math.PI * 2) * 0.42, 0);
    handle.add(ball);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), darkSteel);
  hub.rotation.x = Math.PI / 2;
  handle.add(hub);
  pivot.add(handle);
  pivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // control buttons for inspect mode (small labelled tabs on the door around the dial)
  const tab = (txt, x, y, w = 0.16) => {
    const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 96 });
    const c = cv.getContext('2d');
    c.fillStyle = '#2c2c2a'; c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#f2c230'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88);
    c.fillStyle = '#f2c230'; c.font = '900 46px "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, 128, 50);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.375, 0.02), [darkSteel, darkSteel, darkSteel, darkSteel, new THREE.MeshBasicMaterial({ map: tx }), darkSteel]);
    m.position.set(x, y, 0.215);
    pivot.add(m);
    return m;
  };
  const bL = tab('◄ L', R - 0.66, DY + 0.05), bR = tab('R ►', R + 0.26, DY + 0.05), bSet = tab('SET', R - 0.2, DY - 0.4, 0.2);
  world.makeButton(bL, { act: 'L' }); world.makeButton(bR, { act: 'R' }); world.makeButton(bSet, { act: 'SET' });
  const handleHit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  handleHit.position.copy(handle.position);
  pivot.add(handleHit);
  world.makeButton(handleHit, { act: 'HANDLE' });
  const doorCol = world.addCollider(DX - R - 0.1, DX + R + 0.1, DZ - 0.3, DZ + 0.3, 0, 2.7);
  const openCol = world.addCollider(DX - R - 0.25, DX - R + 0.25, DZ, DZ + 2.6, 0, 2.7);
  openCol.disabled = true;

  // ---- core
  const core = new THREE.Group();
  core.position.set(-11, 1.04, -65.2);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 10), new THREE.MeshBasicMaterial({ color: 0xf2c230 }));
  can.position.y = 0.3;
  const caps = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), darkSteel);
  caps.position.y = 0.52;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x9fc4cc, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false }));
  glass.position.y = 0.36;
  core.add(can, caps, glass);
  world.scene.add(core);
  const coreHot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.44, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  coreHot.layers.set(6); coreHot.position.set(-11, 1.34, -65.2);
  world.scene.add(coreHot);
  const coreLight = { x: -11, y: 1.6, z: -65.2, color: 0xffc040, intensity: 1.4, distance: 5, room: 'vault', on: true, decay: 1.4 };
  world.lightAnchors.push(coreLight);

  let held = { dir: 0, t: 0 };
  const turn = (d) => { world.act({ k: 'dial', d }); };
  world.addInteractable({
    pos: new THREE.Vector3(DX, DY, DZ + 0.4), size: [2.6, 2.6, 0.6], zone: 'vault',
    label: () => 'INSPECT VAULT DOOR',
    enabled: () => !world.state?.vault?.open,
    inspect: {
      camPos: new THREE.Vector3(DX - 0.02, DY + 0.12, DZ + 1.5), lookAt: new THREE.Vector3(DX - 0.02, DY + 0.08, DZ), fov: 50, res: 2.4,
      buttons: [bL, bR, bSet, handleHit],
      hint: 'A/← LEFT (NUMBERS RISE) · D/→ RIGHT (NUMBERS FALL) · HOLD TO SPIN, SHIFT = FASTER · THE DIAL DRAGS NEAR A GATE · SPACE = SET · H = PULL HANDLE',
      onButton: (b) => {
        const a = b.userData.button.act;
        if (a === 'L') turn(1); if (a === 'R') turn(-1);
        if (a === 'SET') world.act({ k: 'set' });
        if (a === 'HANDLE') world.act({ k: 'handle' });
      },
      onKey: (code) => {
        if (code === 'Space' || code === 'Enter') { world.act({ k: 'set' }); return true; }
        if (code === 'KeyH') { world.act({ k: 'handle' }); return true; }
        if (code === 'KeyA' || code === 'ArrowLeft') { turn(1); held = { dir: 1, t: -0.35 }; return true; }
        if (code === 'KeyD' || code === 'ArrowRight') { turn(-1); held = { dir: -1, t: -0.35 }; return true; }
        return false;
      },
      onHold: (I, dt) => {
        const dir = (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0) - (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0);
        if (!dir || dir !== held.dir) { held = { dir: 0, t: 0 }; return; }
        held.t += dt;
        // the dial bites near a gate: holding slows right down so GHOST can stop on it and call the numbers
        const dragging = performance.now() - (world.vaultDragAt || 0) < 500;
        const rate = dragging ? 0.5 : I.down('ShiftLeft') ? 0.05 : 0.11;
        while (held.t > rate) { held.t -= rate; turn(dir); }
      },
    },
  });
  world.addInteractable({
    pos: new THREE.Vector3(-11, 1.35, -65.2), size: [0.7, 0.8, 0.7], zone: 'vault',
    label: () => 'TAKE ARCHIVE CORE',
    enabled: () => !!world.state?.vault?.open && !world.state?.vault?.taken,
    use: () => world.act({ k: 'take' }),
  });

  let open = 0, dialAngle = 0, lastV = 0;
  return {
    update(dt, t, s) {
      const want = s?.doors?.V ? 1 : 0;
      const prev = open;
      open += Math.sign(want - open) * Math.min(Math.abs(want - open), dt * 0.35);
      if ((prev === 0 && open > 0) || (prev === 1 && open < 1)) world.sfx?.door(new THREE.Vector3(DX, DY, DZ), 'lift');
      const o = open * open * (3 - 2 * open);
      pivot.rotation.y = -o * 1.85;
      doorCol.disabled = open > 0.6;
      openCol.disabled = open < 0.6;
      // dial follows state
      const target = ((s?.vault?.dial ?? V.start) / 100) * Math.PI * 2;
      let d = target - dialAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      dialAngle += d * Math.min(1, dt * 18);
      dial.rotation.z = dialAngle;
      drawReadout(s?.vault?.dial ?? V.start);
      knob.rotation.y = dialAngle;
      handle.rotation.z = s?.vault?.open ? Math.min(handle.rotation.z + dt * 2, 1.2) : 0;
      const taken = s?.vault?.taken;
      core.visible = !taken;
      coreHot.visible = !taken;
      coreLight.intensity = taken ? 0 : 1.2 + Math.sin(t * 2) * 0.2;
      can.material.color.setHex(0xf2c230);
      if (taken !== lastV && taken) world.sfx?.thud(new THREE.Vector3(DX, DY, DZ));
      lastV = taken;
    },
  };
}
