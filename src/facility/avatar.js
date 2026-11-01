import * as THREE from 'three';
import { PAL } from '../engine/kit.js';

// GHOST as LINE sees it on CCTV: a bean with no neck, stubby mitten arms, chunky boots,
// a radio backpack with a whip antenna, and a face atlas whose mouth follows voice volume.

function faceAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  const cells = ['neutral', 'blink', 'half', 'open', 'scared', 'happy', 'squint', 'ragdoll'];
  cells.forEach((name, i) => {
    const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
    c.save();
    c.translate(x + 64, y + 64);
    c.fillStyle = '#e9c9a5';
    c.beginPath(); c.ellipse(0, 0, 58, 50, 0, 0, 7); c.fill();
    c.fillStyle = '#111';
    const eye = (ex) => {
      if (name === 'blink' || name === 'squint') { c.fillRect(ex - 11, -10, 22, 5); return; }
      if (name === 'ragdoll') { c.lineWidth = 6; c.strokeStyle = '#111'; c.beginPath(); c.moveTo(ex - 9, -18); c.lineTo(ex + 9, -2); c.moveTo(ex + 9, -18); c.lineTo(ex - 9, -2); c.stroke(); return; }
      const r = name === 'scared' ? 14 : 11;
      c.beginPath(); c.ellipse(ex, -10, r * 0.8, r, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 3, -14, r * 0.3, 0, 7); c.fill(); c.fillStyle = '#111';
    };
    eye(-20); eye(20);
    c.fillStyle = '#5a1a14';
    if (name === 'open' || name === 'scared') { c.beginPath(); c.ellipse(0, 22, name === 'scared' ? 10 : 12, name === 'scared' ? 13 : 10, 0, 0, 7); c.fill(); }
    else if (name === 'half') { c.beginPath(); c.ellipse(0, 22, 11, 5, 0, 0, 7); c.fill(); }
    else if (name === 'happy') { c.lineWidth = 5; c.strokeStyle = '#5a1a14'; c.beginPath(); c.arc(0, 14, 12, 0.3, Math.PI - 0.3); c.stroke(); }
    else { c.fillRect(-8, 20, 16, 4); }
    c.restore();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.25, 0.5);
  return { tex, cells };
}

export class Avatar {
  constructor() {
    const g = (this.group = new THREE.Group());
    this.root = new THREE.Group();
    g.add(this.root);
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 });
    const suit = mat(PAL.orange), dark = mat(PAL.glove), pack = mat(PAL.olive), boot = mat(0x2b2622);
    // bean body via lathe
    const prof = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = t * 1.58;
      const r = 0.36 * Math.sin(Math.PI * (0.08 + t * 0.86)) ** 0.55 + 0.02;
      prof.push(new THREE.Vector2(r, y));
    }
    const bodyGeo = new THREE.LatheGeometry(prof, 8);
    this.body = new THREE.Mesh(bodyGeo, suit);
    this.body.position.y = 0.16;
    this.root.add(this.body);
    const outline = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide }));
    outline.scale.set(1.07, 1.03, 1.07);
    outline.position.y = -0.02;
    this.body.add(outline);
    // belt
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.08, 8), dark);
    belt.position.y = 0.55;
    this.body.add(belt);
    // face
    const fa = faceAtlas();
    this.face = fa;
    this.faceMat = new THREE.MeshBasicMaterial({ map: fa.tex, transparent: true, alphaTest: 0.5 });
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), this.faceMat);
    faceMesh.position.set(0, 1.12, 0.33);
    faceMesh.rotation.x = -0.12;
    this.body.add(faceMesh);
    this.setFace('neutral');
    // backpack + antenna
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), pack);
    bp.position.set(0, 0.85, -0.33);
    this.body.add(bp);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.7, 4), dark);
    ant.position.set(0.14, 1.38, -0.36);
    ant.rotation.z = -0.08;
    this.body.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    tip.position.set(0.17, 1.73, -0.36);
    this.body.add(tip);
    this.antennaTip = tip;
    // arms
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.32, 3, 6);
    const handGeo = new THREE.SphereGeometry(0.09, 6, 5);
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.36, 1.02, 0);
      const arm = new THREE.Mesh(armGeo, suit);
      arm.position.y = -0.2;
      pivot.add(arm);
      const hand = new THREE.Mesh(handGeo, dark);
      hand.position.y = -0.43;
      hand.scale.set(1, 1.1, 0.85);
      pivot.add(hand);
      this.body.add(pivot);
      return pivot;
    });
    // flashlight in the right mitten
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.26, 6), mat(0x2d2d2d));
    torch.rotation.x = Math.PI / 2;
    torch.position.set(0, -0.45, 0.12);
    this.arms[1].add(torch);
    this.torch = torch;
    // visible light cone for CCTV
    const coneGeo = new THREE.ConeGeometry(1.1, 4.2, 10, 1, true);
    coneGeo.translate(0, -2.1, 0); // apex at the hand, opening along the arm (-y), which points where GHOST looks
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
    this.cone.position.set(0, -0.5, 0.12);
    this.arms[1].add(this.cone);
    // the torch's IR illuminator: a faint cone on the IR layer so LINE can see GHOST's heading in IR mode
    this.coneIR = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.coneIR.position.copy(this.cone.position);
    this.arms[1].add(this.coneIR);
    // legs/boots
    this.legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.15, 0.32, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 6), suit);
      leg.position.y = -0.08;
      pivot.add(leg);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), boot);
      b.position.set(0, -0.24, 0.04);
      pivot.add(b);
      this.root.add(pivot);
      return pivot;
    });
    this.phase = 0;
    this.crouchT = 0;
    this.last = new THREE.Vector3();
    this.speed = 0;
    this.talk = 0;
    this.blinkAt = 2;
    this.alarm = 0;
    this.pitch = 0;
    this.visible = true;
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.cone.castShadow = false;
    outline.castShadow = false;
  }

  setLayer(l) { this.group.traverse((o) => o.layers.set(l)); }

  setFace(name) {
    const i = this.face.cells.indexOf(name);
    if (i < 0 || i === this.faceIdx) return;
    this.faceIdx = i;
    this.face.tex.offset.set((i % 4) * 0.25, Math.floor(i / 4) === 0 ? 0.5 : 0);
  }

  // pose from the network: x,y,z, yaw, pitch, flags (1 crouch, 2 flashlight, 4 sprint, 8 moving)
  update(dt, t, pose) {
    if (!pose) { this.group.visible = false; return; }
    this.group.visible = true;
    const [x, y, z, yaw, pitch, flags] = pose;
    const g = this.group;
    const dx = x - g.position.x, dz = z - g.position.z;
    const sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
    this.speed += (Math.min(sp, 6) - this.speed) * Math.min(1, dt * 8);
    g.position.set(x, y, z);
    // the model is built facing +z, GHOST's view faces -z at yaw 0: turn it round
    let dy = yaw + Math.PI - g.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    g.rotation.y += dy * Math.min(1, dt * 12);
    const crouch = flags & 1 ? 1 : 0;
    // knocked down (strike): topple sideways where the cameras can see it
    this.downK = (this.downK || 0) + ((flags & 128 ? 1 : 0) - (this.downK || 0)) * Math.min(1, dt * (flags & 128 ? 5 : 12));
    this.root.rotation.z = this.downK * 1.45;
    this.crouchT += (crouch - this.crouchT) * Math.min(1, dt * 10);
    this.phase += dt * this.speed * 3.2;
    const sw = Math.sin(this.phase) * Math.min(1, this.speed / 2.5);
    this.root.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * Math.min(1, this.speed / 2) - this.crouchT * 0.42;
    this.root.scale.y = 1 - this.crouchT * 0.18;
    this.legs[0].rotation.x = sw * 0.7; this.legs[1].rotation.x = -sw * 0.7;
    this.arms[0].rotation.x = -sw * 0.6;
    this.arms[1].rotation.x = -Math.PI / 2 + 0.25 - pitch * 0.9;
    this.arms[0].rotation.z = -0.15; this.arms[1].rotation.z = 0.12;
    this.body.rotation.x = this.crouchT * 0.25 + (flags & 4 ? 0.12 : 0);
    this.cone.visible = !!(flags & 2);
    this.coneIR.visible = !!(flags & 2);
    // face
    this.blinkAt -= dt;
    let face = 'neutral';
    if (this.alarm > 0 || this.downK > 0.3) { face = 'scared'; this.alarm -= dt; }
    if (this.talk > 0.22) face = 'open'; else if (this.talk > 0.08) face = 'half';
    if (this.blinkAt < 0) { face = 'blink'; if (this.blinkAt < -0.12) this.blinkAt = 2 + Math.random() * 3; }
    this.setFace(face);
    this.antennaTip.material.color.setHex(this.talk > 0.08 ? 0x40ff60 : (t * 2) % 1 < 0.5 ? 0xff3020 : 0x300804);
  }
}
