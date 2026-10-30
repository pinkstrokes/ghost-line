import * as THREE from 'three';
import { Builder, PAL } from '../engine/kit.js';

// Menu backdrop: the van parked on a wet road at night, KESTREL-9 on the hill behind it.

export class TitleScene {
  constructor(engine) {
    this.engine = engine;
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color(0x05080d);
    S.fog = new THREE.FogExp2(0x0b111a, 0.035);
    this.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    const fake = { addCollider() {}, lightAnchors: [] };
    const B = new Builder(fake, 'title');
    // road + sidewalk
    B.slab(-60, -0.1, -4, 60, 0, 5, 0x18191b, { grad: 0, jitter: 0 });
    for (let x = -60; x < 60; x += 6) B.box(x, 0.003, 0.4, 2.6, 0.005, 0.14, 0x8a8470, { grad: 0, jitter: 0.1 });
    B.slab(-60, -0.1, 5, 60, 0.15, 8, 0x3a3b38, { grad: 0, jitter: 0.02 });
    B.slab(-60, -0.2, -40, 60, -0.05, -4, 0x10140f, { grad: 0, jitter: 0 });
    // van (body, cab, windows, wheels, roof gear)
    const vx = 0, vz = 2.4;
    B.box(vx + 0.6, 1.35, vz, 4.0, 2.1, 2.0, 0xc9c6bb, { bevel: 0.12 });
    B.box(vx - 2.0, 1.05, vz, 1.4, 1.5, 1.96, 0xc9c6bb, { bevel: 0.15 });
    B.box(vx - 2.35, 1.45, vz, 0.7, 0.55, 1.9, 0x1a2028, { bevel: 0.05 });
    B.box(vx + 0.6, 0.95, vz - 1.005, 3.9, 0.28, 0.02, 0x2d5a7a, { grad: 0 });
    B.box(vx + 0.6, 0.62, vz - 1.005, 3.9, 0.08, 0.02, 0x2d5a7a, { grad: 0 });
    B.box(vx + 0.6, 0.95, vz + 1.005, 3.9, 0.28, 0.02, 0x2d5a7a, { grad: 0 });
    B.box(vx + 0.6, 0.62, vz + 1.005, 3.9, 0.08, 0.02, 0x2d5a7a, { grad: 0 });
    B.box(vx + 1.4, 1.75, vz + 1.005, 0.9, 0.35, 0.02, 0xffc27a, { glow: true, grad: 0 });
    B.box(vx + 2.62, 1.6, vz - 0.45, 0.03, 0.4, 0.6, 0xffc27a, { glow: true, grad: 0 });
    B.box(vx + 2.62, 1.6, vz + 0.45, 0.03, 0.4, 0.6, 0x1a2028, { grad: 0 });
    for (const [wx, wz] of [[-1.9, -0.98], [1.7, -0.98], [-1.9, 0.98], [1.7, 0.98]]) B.cyl(vx + wx, 0.38, vz + wz, 0.38, 0.28, 0x151515, { rx: Math.PI / 2, sides: 10 });
    B.box(vx + 1.6, 2.5, vz, 0.8, 0.06, 0.6, 0x7a7a72);
    B.cyl(vx + 1.6, 2.75, vz, 0.32, 0.06, 0xd8d6cc, { rx: -0.9, sides: 10 });
    B.cyl(vx - 0.2, 3.0, vz + 0.6, 0.012, 1.2, 0x222222, { sides: 4 });
    B.box(vx - 2.72, 0.75, vz - 0.65, 0.04, 0.12, 0.25, 0xfff0d0, { glow: true });
    B.box(vx - 2.72, 0.75, vz + 0.65, 0.04, 0.12, 0.25, 0xfff0d0, { glow: true });
    // streetlamp
    B.cyl(-6, 3.2, 6, 0.08, 6.4, PAL.metalDark, { sides: 6 });
    B.box(-5.3, 6.35, 6, 1.5, 0.08, 0.1, PAL.metalDark);
    B.box(-4.65, 6.25, 6, 0.5, 0.12, 0.3, 0xffb060, { glow: true });
    // hill + facility silhouette with beacon
    for (let i = 0; i < 9; i++) B.cyl(-40 + i * 10, 2, -55 - (i % 3) * 4, 16, 6, 0x0b0f0c, { r2: 6, sides: 6, grad: 0.3 });
    B.box(8, 6, -58, 26, 8, 10, 0x121518, { grad: 0.2 });
    B.box(-6, 8, -60, 8, 12, 8, 0x14171a, { grad: 0.2 });
    B.box(18, 10, -62, 3, 12, 3, 0x14171a);
    B.cyl(18, 16.4, -62, 0.05, 1, 0x333333);
    for (let i = 0; i < 40; i++) { const x = -50 + Math.random() * 100, z = -12 - Math.random() * 30, h = 5 + Math.random() * 6; B.cyl(x, h / 2, z, 1.4, h, 0x0e1610, { r2: 0, sides: 6, grad: 0.5 }); }
    // fence along the far verge
    for (let x = -40; x <= 40; x += 2.5) B.cyl(x, 1.1, -6, 0.04, 2.2, 0x3b4045, { sides: 5 });
    B.pipe(-40, 2.15, -6, 40, -6, 0.025, 0x3b4045);
    const meshes = B.finish(S);
    meshes.forEach((m) => m && (m.castShadow = false, m.receiveShadow = false));
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2010, fog: false }));
    this.beacon.position.set(18, 17, -62);
    S.add(this.beacon);
    // lights
    S.add(new THREE.HemisphereLight(0x5a6a8a, 0x0a0806, 1.1));
    const lamp = new THREE.PointLight(0xffa860, 30, 26, 1.3);
    lamp.position.set(-4.6, 6.0, 6);
    const inside = new THREE.PointLight(0xffc27a, 1.5, 4, 1.5);
    inside.position.set(vx + 2.9, 1.6, vz - 0.45);
    const moon = new THREE.DirectionalLight(0x8090b0, 0.9);
    moon.position.set(-20, 30, 20);
    S.add(lamp, inside, moon);
    this.lamp = lamp;
    // rain
    const N = 1400;
    this.rain = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.resetDrop(i, true);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rain, 3));
    this.rainGeo = rg;
    const rl = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x7f8fa8, transparent: true, opacity: 0.45 }));
    rl.frustumCulled = false;
    S.add(rl);
    this.t = 0;
    this.running = false;
  }

  resetDrop(i, any) {
    const x = (Math.random() - 0.5) * 40, z = (Math.random() - 0.5) * 30 + 2, y = any ? Math.random() * 14 : 14;
    this.rain.set([x, y, z, x + 0.03, y + 0.45, z], i * 6);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.engine.setTargetHeight(300);
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.t += dt;
      const r = this.rain;
      for (let i = 0; i < r.length / 6; i++) {
        const d = dt * 13;
        r[i * 6 + 1] -= d; r[i * 6 + 4] -= d;
        if (r[i * 6 + 1] < 0) this.resetDrop(i, false);
      }
      this.rainGeo.attributes.position.needsUpdate = true;
      this.beacon.visible = (this.t * 0.8) % 1 < 0.5;
      this.lamp.intensity = 30 * (Math.sin(this.t * 37) > 0.97 ? 0.4 : 1);
      const a = -0.35 + Math.sin(this.t * 0.06) * 0.18;
      this.cam.position.set(-2 + Math.sin(a) * 14, 1.6 + Math.sin(this.t * 0.11) * 0.2, 2.4 + Math.cos(a) * 14);
      this.cam.lookAt(-4.2, 2.3, 0);
      this.cam.aspect = this.engine.width / this.engine.height;
      this.cam.updateProjectionMatrix();
      const P = this.engine.post.uniforms;
      P.uFade.value = 1; P.uFlash.value = 0; P.uStatic.value = 0;
      this.engine.render(this.scene, this.cam, this.t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}
