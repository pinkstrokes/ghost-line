import * as THREE from 'three';
import { Builder, PAL, MAT, makeMatrix, stencilText } from '../engine/kit.js';
import { CCTV, MONITOR_SHADER } from './cctv.js';
import { Terminal } from './terminal.js';
import { BlueprintView } from './blueprint-view.js';
import { CAMERAS, ZONE_ORDER } from '../../shared/layout.js';
import { drawGlyph } from '../../shared/glyphs.js';
import { sfx } from '../audio/sfx.js';
import { fmtTime, OBJECTIVES } from '../ui/text.js';

// LINE's seat in the surveillance van. Seated first person: look around, click a station to
// lean in. Everything LINE knows comes from these props.

const SEAT = new THREE.Vector3(0, 1.17, 0.28);
const RELEVANT = {
  gate: ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'],
  lasers: ['CAM-03', 'CAM-02', 'CAM-01', 'CAM-04'],
  patch: ['CAM-04', 'CAM-02', 'CAM-05', 'CAM-03'],
  maze: ['CAM-05', 'CAM-04', 'CAM-06', 'CAM-07'],
  optics: ['CAM-06', 'CAM-05', 'CAM-07', 'CAM-04'],
  vault: ['CAM-07', 'CAM-06', 'CAM-08', 'CAM-09'],
  escape: ['CAM-08', 'CAM-09', 'CAM-10', 'CAM-07'],
};

export class HandlerView {
  constructor({ engine, world, input, net, hud, settings, voice }) {
    this.engine = engine; this.world = world; this.input = input; this.net = net; this.hud = hud; this.settings = settings; this.voice = voice;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.03, 40);
    this.yaw = 0; this.pitch = -0.12;
    this.focus = null; this.tween = null;
    this.hitboxes = [];
    this.poses = [];
    this.flashT = 0;
    this.wantsCursor = false;
    world.act = (a) => net.send({ t: 'act', a });
    this.cctv = new CCTV(engine, world);
    this.mainIdx = 0;
    this.slots = RELEVANT.gate.map((id) => CAMERAS.findIndex((c) => c.id === id));
    this.pinned = false;
    this.terminal = new Terminal({ net, world, sfx });
    this.blueprint = new BlueprintView({ mission: world.mission, input, sfx, onClose: () => this.closeBlueprint() });
    this.buildVan();
    this.unsub = [
      net.on('pose', (m) => this.poses.push({ t: performance.now(), p: m.p })),
      net.on('ev', (m) => this.onEvent(m.e)),
    ];
    sfx.ambience('van', true);
    this.lastObjective = null;
    this.keyHelp = '<kbd>M</kbd> monitors <kbd>T</kbd> terminal <kbd>Tab</kbd> blueprints<br>click a station to lean in · <kbd>Right-click</kbd>/<kbd>Esc</kbd> sit back<br>hold <kbd>V</kbd> / <kbd>Option</kbd> to talk · <kbd>F1</kbd> show again';
    hud.keys(this.keyHelp);
    this.keysT = 60;
  }

  // ------------------------------------------------------------------ scene
  buildVan() {
    const S = this.scene;
    const fake = { addCollider() {}, lightAnchors: [], atlas: null };
    const B = new Builder(fake, 'van');
    const X0 = -1.9, X1 = 1.9, Z0 = -0.95, Z1 = 0.95, H = 1.85;
    // shell
    B.slab(X0, -0.05, Z0, X1, 0, Z1, 0x2b2927, { grad: 0 });
    for (let x = X0 + 0.1; x < X1; x += 0.12) B.box(x, 0.004, 0, 0.04, 0.008, Z1 - Z0 - 0.1, 0x242220, { grad: 0, jitter: 0 });
    B.slab(X0, H, Z0, X1, H + 0.05, Z1, 0x6a665e, { grad: 0 });
    B.slab(X0, 0, Z0 - 0.05, X1, H, Z0, PAL.panel, { grad: 0.3 });
    B.slab(X0, 0, Z1, X1, H, Z1 + 0.05, PAL.panel, { grad: 0.3 });
    B.slab(X0 - 0.05, 0, Z0, X0, H, Z1, 0x55514a, { grad: 0.3 });
    B.slab(X1, 0, Z0, X1 + 0.05, H, Z1, 0x55514a, { grad: 0.3 });
    for (let x = X0 + 0.5; x < X1; x += 0.75) {
      B.box(x, H / 2, Z1 - 0.02, 0.06, H, 0.04, 0x4c4842, { grad: 0.2 });
      B.box(x, H - 0.03, 0, 0.06, 0.05, Z1 - Z0, 0x4c4842, { grad: 0 });
    }
    // windows: cab partition (front, -x), rear doors (+x), sliding door (+z)
    this.windows = [];
    const rainMat = this.rainMaterial();
    const win = (w, h, m) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat); mesh.applyMatrix4(m); S.add(mesh); this.windows.push(mesh); };
    win(0.7, 0.4, makeMatrix(X0 + 0.01, 1.35, 0.15, Math.PI / 2));
    win(0.32, 0.36, makeMatrix(X1 - 0.01, 1.4, -0.45, -Math.PI / 2));
    win(0.32, 0.36, makeMatrix(X1 - 0.01, 1.4, 0.45, -Math.PI / 2));
    win(0.6, 0.35, makeMatrix(0.6, 1.4, Z1 - 0.01, Math.PI));
    B.box(X1 - 0.02, H / 2, 0, 0.02, H, 0.02, 0x2a2824);
    // desk
    const DY = 0.74;
    B.box(0, DY - 0.02, -0.66, 3.3, 0.04, 0.58, PAL.desk, { grad: 0, jitter: 0.02 });
    B.box(0, DY - 0.06, -0.38, 3.3, 0.04, 0.02, 0x3d3225, { grad: 0 });
    for (const x of [-1.55, 1.55]) B.box(x, DY / 2, -0.66, 0.04, DY, 0.5, PAL.metalDark);
    // riser + rack
    B.box(0, 0.79, -0.78, 1.7, 0.06, 0.32, PAL.metalDark, { grad: 0 });
    // chair (seen when looking down) and legs
    B.box(0, 0.5, 0.42, 0.52, 0.08, 0.5, 0x1e1e1e, { bevel: 0.03 });
    B.box(0, 0.9, 0.7, 0.5, 0.6, 0.08, 0x1e1e1e, { bevel: 0.03, rx: -0.1 });
    for (const sx of [-1, 1]) {
      B.box(sx * 0.11, 0.56, 0.12, 0.15, 0.13, 0.5, 0x2e3d55, { bevel: 0.03 });
      B.box(sx * 0.11, 0.3, -0.12, 0.13, 0.5, 0.13, 0x2e3d55, { bevel: 0.03 });
      B.box(sx * 0.11, 0.04, -0.17, 0.13, 0.08, 0.26, 0xd8d6cc, { bevel: 0.02 });
      B.box(sx * 0.3, 0.68, 0.38, 0.06, 0.05, 0.35, 0x1a1a1a);
    }
    // clutter
    B.cyl(-0.68, DY + 0.05, -0.47, 0.04, 0.1, 0xd8d0b8, { sides: 8 }); // mug
    B.cyl(-0.68, DY + 0.096, -0.47, 0.035, 0.005, 0x3a2414, { sides: 8 });
    B.cyl(0.62, DY + 0.06, -0.45, 0.033, 0.12, 0x2a7a3a, { sides: 8 }); // can
    B.box(1.45, DY + 0.03, -0.5, 0.16, 0.05, 0.1, 0x222222, { ry: 0.3 }); // cassette recorder
    B.box(-1.6, 0.25, 0.55, 0.3, 0.5, 0.3, 0x6b2b24); // first aid/extinguisher box
    B.cyl(1.72, 0.32, 0.72, 0.08, 0.64, 0xb02a20, { sides: 8 });
    B.box(1.2, DY + 0.01, -0.85, 0.3, 0.01, 0.2, PAL.paper, { ry: 0.2, grad: 0 });
    B.box(0.85, DY + 0.005, -0.42, 0.16, 0.008, 0.12, 0xe9d48a, { ry: -0.3, grad: 0 });
    // cable bundles along the ceiling
    for (let i = 0; i < 4; i++) B.pipe(X0, H - 0.08 - i * 0.025, Z0 + 0.08 + i * 0.03, X1, Z0 + 0.08 + i * 0.03, 0.012, [0x222222, 0x5a1a1a, 0x1a2a5a, 0x2a2a2a][i], { sides: 4 });
    // dome light
    B.box(0.2, H - 0.02, 0.1, 0.3, 0.03, 0.15, 0xfff2d0, { glow: true });
    // desk lamp
    B.cyl(-1.3, DY + 0.01, -0.8, 0.07, 0.02, 0x2a2a2a);
    B.cyl(-1.3, DY + 0.2, -0.8, 0.008, 0.4, 0x2a2a2a, { rx: 0.2 });
    B.box(-1.25, DY + 0.38, -0.68, 0.1, 0.06, 0.12, 0x2a2a2a, { rx: 0.7 });
    B.box(-1.25, DY + 0.35, -0.65, 0.07, 0.01, 0.07, 0xffe0a0, { glow: true, rx: 0.7 });
    // corkboard on the front partition
    B.box(X0 + 0.02, 1.25, -0.45, 0.02, 0.6, 0.75, 0x9a7a52, { grad: 0.1 });
    const meshes = B.finish(S);
    meshes.forEach((m) => m && (m.castShadow = false));
    this.buildCorkboard(X0 + 0.035, 1.25, -0.45);
    // lights
    S.add(new THREE.AmbientLight(0x2a2622, 0.6));
    this.lamp = new THREE.PointLight(0xffc27a, 2.2, 3.5, 1.5);
    this.lamp.position.set(-1.15, DY + 0.32, -0.6);
    this.dome = new THREE.PointLight(0xffe8c0, 0.35, 4, 1.4);
    this.dome.position.set(0.2, H - 0.15, 0.1);
    this.monGlow = new THREE.PointLight(0x8fd0b0, 0.5, 2.6, 1.3);
    this.monGlow.position.set(0, 1.05, -0.35);
    this.alertLight = new THREE.PointLight(0xff2010, 0, 5, 1.2);
    this.alertLight.position.set(0, 1.6, -0.5);
    this.carLight = new THREE.PointLight(0xfff0d0, 0, 4, 1.2);
    S.add(this.lamp, this.dome, this.monGlow, this.alertLight, this.carLight);

    this.buildMonitors();
    this.buildTerminal(1.12, 1.0, -0.66);
    this.buildClock();
    this.buildCipher(-0.38, DY + 0.006, -0.5);
    this.buildRadio(-1.52, 1.18, -0.68);
    this.buildBlueprintProp(-0.98, DY + 0.004, -0.62);
  }

  rainMaterial() {
    return (this.rainMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCar: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uCar; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        void main() {
          vec2 uv = vUv;
          vec3 col = mix(vec3(0.02, 0.03, 0.05), vec3(0.05, 0.06, 0.09), uv.y);
          // street light bokeh
          col += vec3(1.0, 0.6, 0.25) * 0.25 * smoothstep(0.25, 0.0, length((uv - vec2(0.7, 0.55)) * vec2(1.0, 1.4)));
          col += vec3(1.0, 0.95, 0.85) * uCar * smoothstep(0.6, 0.0, length(uv - vec2(0.3 + uCar * 0.3, 0.45)));
          // drops
          vec2 g = uv * vec2(18.0, 10.0);
          vec2 id = floor(g); vec2 f = fract(g);
          float r = h(id);
          float y = fract(r * 7.0 - uTime * (0.15 + r * 0.25));
          float d = length((f - vec2(0.5 + (r - 0.5) * 0.6, y)) * vec2(1.0, 0.6));
          col += vec3(0.25, 0.3, 0.35) * smoothstep(0.12, 0.02, d) * step(0.55, r);
          float streak = smoothstep(0.04, 0.0, abs(f.x - 0.5 - (r - 0.5) * 0.6)) * step(y, f.y) * step(0.8, r) * 0.25;
          col += vec3(0.15, 0.18, 0.2) * streak;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
  }

  buildCorkboard(x, y, z) {
    const cv = Object.assign(document.createElement('canvas'), { width: 512, height: 420 });
    const c = cv.getContext('2d');
    c.fillStyle = '#9a7a52'; c.fillRect(0, 0, 512, 420);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 30},20,0.35)`; c.fillRect(Math.random() * 512, Math.random() * 420, 2, 2); }
    const pol = (px, py, rot, label, draw) => {
      c.save(); c.translate(px, py); c.rotate(rot);
      c.fillStyle = '#eee8d8'; c.fillRect(-62, -70, 124, 140);
      c.fillStyle = '#1a1d1f'; c.fillRect(-54, -62, 108, 100);
      draw(c);
      c.fillStyle = '#333'; c.font = '16px "Marker Felt", "Comic Sans MS", cursive'; c.textAlign = 'center'; c.fillText(label, 0, 60);
      c.restore();
      c.fillStyle = '#c0281e'; c.beginPath(); c.arc(px, py - 64, 6, 0, 7); c.fill();
    };
    pol(90, 100, -0.08, 'SERVICE DOOR', (c) => { c.fillStyle = '#3c4044'; c.fillRect(-40, -30, 80, 60); c.fillStyle = '#6a6c66'; c.fillRect(-12, -10, 24, 40); });
    pol(240, 90, 0.06, 'KESTREL-9', (c) => { c.fillStyle = '#2c3034'; c.fillRect(-54, -10, 108, 48); c.fillStyle = '#566'; c.fillRect(-40, -40, 30, 30); });
    pol(400, 110, -0.04, 'VAULT??', (c) => { c.strokeStyle = '#8a8c88'; c.lineWidth = 6; c.beginPath(); c.arc(0, -12, 30, 0, 7); c.stroke(); });
    c.strokeStyle = '#c0281e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(90, 36); c.lineTo(240, 26); c.lineTo(400, 46); c.stroke();
    c.fillStyle = '#f1e27a'; c.fillRect(60, 250, 170, 120);
    c.fillStyle = '#222'; c.font = '19px "Marker Felt", "Comic Sans MS", cursive';
    ['REMEMBER:', 'cams are IR on', 'the hall + spine', 'press I !!', "don't trust old rev"].forEach((t, i) => c.fillText(t, 72, 280 + i * 22));
    c.fillStyle = '#e8e2d0'; c.fillRect(270, 240, 200, 150);
    c.fillStyle = '#222'; c.font = '700 17px "Courier New", monospace';
    ['PAYMENT ON DELIVERY', 'ARCHIVE CORE ONLY', 'NO NAMES', 'EXTRACT BY LIFT', '— K.'].forEach((t, i) => c.fillText(t, 282, 270 + i * 24));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.position.set(x, y, z); m.rotation.y = Math.PI / 2;
    this.scene.add(m);
  }

  screen(w, h, uniforms) {
    const mat = new THREE.ShaderMaterial({ ...MONITOR_SHADER, uniforms });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  crtBody(x, y, z, w, h, d, ry = 0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xb4ad96, flatShading: true, roughness: 0.8 }));
    body.position.z = -d / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.7, d * 0.5), body.material);
    back.position.z = -d - d * 0.2;
    g.add(body, back);
    g.position.set(x, y, z); g.rotation.y = ry;
    this.scene.add(g);
    return g;
  }

  buildMonitors() {
    this.monitors = [];
    const mk = (x, y, z, w, h, slot, size) => {
      this.crtBody(x, y, z, w + 0.08, h + 0.09, size);
      const overlay = Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
      const otex = new THREE.CanvasTexture(overlay);
      const rt = this.cctv.makeTarget(slot === 'main' ? 320 : 200, slot === 'main' ? 240 : 150);
      const uniforms = { tFeed: { value: rt.texture }, tOver: { value: otex }, uTime: { value: 0 }, uIR: { value: 0 }, uSignal: { value: 1 }, uBright: { value: 1.0 }, uSeed: { value: Math.random() }, uGlitch: { value: 0 } };
      const scr = this.screen(w, h, uniforms);
      scr.position.set(x, y, z + 0.002);
      this.scene.add(scr);
      const mon = { slot, mesh: scr, rt, uniforms, overlay, otex, lastOver: '' };
      scr.userData.monitor = mon;
      this.monitors.push(mon);
      return mon;
    };
    mk(0, 1.07, -0.5, 0.5, 0.375, 'main', 0.42);
    mk(-0.53, 0.97, -0.58, 0.28, 0.21, 0, 0.3);
    mk(-0.53, 1.27, -0.6, 0.28, 0.21, 1, 0.3);
    mk(0.53, 0.97, -0.58, 0.28, 0.21, 2, 0.3);
    mk(0.53, 1.27, -0.6, 0.28, 0.21, 3, 0.3);
    // camera selector panel on the desk
    const cv = Object.assign(document.createElement('canvas'), { width: 512, height: 128 });
    this.selCv = cv;
    this.selTex = new THREE.CanvasTexture(cv);
    this.selTex.colorSpace = THREE.SRGBColorSpace;
    const sel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshStandardMaterial({ map: this.selTex, roughness: 0.7, emissive: 0xffffff, emissiveMap: this.selTex, emissiveIntensity: 0.25 }));
    sel.position.set(0, 0.745, -0.43); sel.rotation.x = -Math.PI / 2 + 0.25;
    this.scene.add(sel);
    this.selMesh = sel;
    this.addHit('monitors', 'CCTV MONITORS', new THREE.Vector3(0, 1.1, -0.6), [1.5, 0.7, 0.3]);
    this.addHit('monitors', 'CCTV MONITORS', new THREE.Vector3(0, 0.76, -0.45), [0.55, 0.08, 0.2]);
  }

  buildTerminal(x, y, z) {
    const ry = -0.42;
    this.crtBody(x, y, z, 0.48, 0.38, 0.4, ry);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.ShaderMaterial({
      uniforms: { tMap: { value: this.terminal.tex }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap; uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5; vec2 uv = 0.5 + c * (1.0 + dot(c,c) * 0.12);
          vec3 col = texture2D(tMap, uv).rgb;
          col += texture2D(tMap, uv + vec2(0.0015, 0.0)).rgb * 0.25;
          col *= 0.85 + 0.15 * sin(uv.y * 768.0 * 3.14159 * 0.5);
          col *= smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x) * smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
          gl_FragColor = vec4(col * 1.25, 1.0);
        }`,
    }));
    scr.position.set(x, y, z + 0.003);
    scr.rotation.y = ry;
    this.scene.add(scr);
    this.termScreen = scr;
    // keyboard
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.15), new THREE.MeshStandardMaterial({ color: 0xa9a28c, flatShading: true }));
    kb.position.set(x - 0.16, 0.755, z + 0.25); kb.rotation.y = ry;
    this.scene.add(kb);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 12; k++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.026), new THREE.MeshStandardMaterial({ color: 0x6f6a5c }));
      key.position.set(-0.165 + k * 0.03, 0.017, -0.05 + r * 0.032);
      kb.add(key);
    }
    this.addHit('terminal', 'BMS TERMINAL', new THREE.Vector3(x - 0.05, 0.95, z + 0.05), [0.6, 0.55, 0.45], ry);
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    this.termFocus = { pos: new THREE.Vector3(x, y, z).addScaledVector(n, 0.42), look: new THREE.Vector3(x, y, z) };
  }

  buildClock() {
    const cv = Object.assign(document.createElement('canvas'), { width: 512, height: 128 });
    this.clockCv = cv;
    this.clockTex = new THREE.CanvasTexture(cv);
    this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.13, 0.08), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }));
    body.position.set(0, 1.42, -0.74);
    this.scene.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.12), new THREE.MeshBasicMaterial({ map: this.clockTex }));
    face.position.set(0, 1.42, -0.698);
    this.scene.add(face);
  }

  drawClock(s, now) {
    const c = this.clockCv.getContext('2d');
    c.fillStyle = '#0a0302'; c.fillRect(0, 0, 512, 128);
    let remain = s ? (s.phase === 'playing' ? s.limit - (now - s.startAt) : s.limit) : 0;
    const lock = s?.lockdown?.active;
    if (lock) remain = s.escapeEnd - now;
    c.font = '700 84px "Courier New", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#2a0805'; c.fillText('88:88', 14, 68);
    c.fillStyle = lock ? ((now / 300) % 2 < 1 ? '#ff3020' : '#8a1a10') : '#ff4a2a';
    c.fillText(s?.practice && !lock ? '--:--' : fmtTime(remain), 14, 68);
    const max = s?.maxStrikes || 5, n = s?.strikes || 0;
    const w = Math.min(36, 230 / max);
    for (let i = 0; i < max; i++) {
      c.fillStyle = i < n ? '#ff2a16' : '#2a0a08';
      c.beginPath(); c.arc(300 + i * w + w / 2, 64, w * 0.36, 0, 7); c.fill();
    }
    c.fillStyle = '#7a2a20'; c.font = '700 18px "Courier New", monospace';
    c.fillText(lock ? 'PURGE' : 'ALERT', 300, 112);
    this.clockTex.needsUpdate = true;
  }

  buildCipher(x, y, z) {
    const L = this.world.mission.lockdown;
    const R = 0.15, r = 0.092;
    const outer = Object.assign(document.createElement('canvas'), { width: 768, height: 768 });
    {
      const c = outer.getContext('2d');
      c.translate(384, 384);
      c.fillStyle = '#d8cfb4'; c.beginPath(); c.arc(0, 0, 380, 0, 7); c.fill();
      c.strokeStyle = '#2b2a26'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 372, 0, 7); c.stroke();
      c.beginPath(); c.arc(0, 0, 238, 0, 7); c.stroke();
      for (let k = 0; k < 16; k++) {
        const a = -Math.PI / 2 + ((k + 0.5) * Math.PI * 2) / 16;
        c.beginPath(); c.moveTo(Math.cos(a) * 238, Math.sin(a) * 238); c.lineTo(Math.cos(a) * 372, Math.sin(a) * 372); c.stroke();
        const ac = -Math.PI / 2 + (k * Math.PI * 2) / 16;
        c.save(); c.translate(Math.cos(ac) * 305, Math.sin(ac) * 305); c.rotate(ac + Math.PI / 2);
        drawGlyph(c, L.outer[k], -40, -40, 80, { color: '#1c1b18', lineWidth: 8 });
        c.restore();
      }
      c.fillStyle = '#6a2018'; c.font = '700 22px "Courier New", monospace'; c.textAlign = 'center';
      c.fillText('KESTREL-9  ·  OVERRIDE ROTOR  ·  FORM 7/L', 0, 360 - 380 + 380 - 2);
    }
    const inner = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
    {
      const c = inner.getContext('2d');
      c.translate(256, 256);
      c.fillStyle = '#efe7cf'; c.beginPath(); c.arc(0, 0, 252, 0, 7); c.fill();
      c.strokeStyle = '#2b2a26'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 248, 0, 7); c.stroke();
      for (let k = 0; k < 16; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 16;
        c.save(); c.translate(Math.cos(a) * 205, Math.sin(a) * 205); c.rotate(a + Math.PI / 2);
        c.fillStyle = '#1c1b18'; c.font = '700 56px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(L.inner[k]), 0, 0);
        c.restore();
      }
      // index mark
      c.fillStyle = '#c0281e';
      c.beginPath(); c.moveTo(0, -250); c.lineTo(16, -228); c.lineTo(0, -206 + 40); c.lineTo(-16, -228); c.closePath();
      c.save(); c.translate(0, 0); c.restore();
      c.beginPath(); c.moveTo(0, -252); c.lineTo(14, -236); c.lineTo(0, -220); c.lineTo(-14, -236); c.fill();
      c.fillStyle = '#c0281e'; c.font = '700 26px "Courier New", monospace'; c.textAlign = 'center';
      c.fillText('◆ SET TO KEY', 0, -110);
      c.fillStyle = '#5a5548'; c.font = '700 20px "Courier New", monospace';
      c.fillText('READ DIGIT', 0, 40); c.fillText('UNDER EACH', 0, 66); c.fillText('CHALLENGE GLYPH', 0, 92);
      c.fillStyle = '#2b2a26'; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill();
    }
    const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const om = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: mk(outer), roughness: 1 }));
    om.rotation.x = -Math.PI / 2; om.position.set(x, y, z);
    const im = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: mk(inner), roughness: 1 }));
    im.rotation.x = -Math.PI / 2; im.position.set(x, y + 0.002, z);
    this.scene.add(om, im);
    this.cipher = { inner: im, steps: 0, target: 0, pos: new THREE.Vector3(x, y, z) };
    this.addHit('cipher', 'OVERRIDE ROTOR', new THREE.Vector3(x, y + 0.02, z), [0.32, 0.06, 0.32]);
  }

  buildRadio(x, y, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0x4a5040, flatShading: true }));
    g.add(body);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a3a36 }));
    shelf.position.y = -0.09;
    g.add(shelf);
    this.txLamp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0x300804 }));
    this.txLamp.position.set(0.1, 0.04, 0.112);
    this.rxLamp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0x082008 }));
    this.rxLamp.position.set(0.1, 0.0, 0.112);
    const vu = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xe8d9a8 }));
    vu.position.set(-0.04, 0.02, 0.111);
    this.needle = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.05, 0.001), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    this.needle.geometry.translate(0, 0.025, 0);
    this.needle.position.set(-0.04, -0.005, 0.113);
    for (const kx of [-0.12, 0.05]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      k.rotation.x = Math.PI / 2; k.position.set(kx, -0.045, 0.115);
      g.add(k);
    }
    const mic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    mic.position.set(0.19, -0.02, 0.06); mic.rotation.z = 0.2;
    g.add(this.txLamp, this.rxLamp, vu, this.needle, mic);
    g.position.set(x, y, z); g.rotation.y = 0.5;
    this.scene.add(g);
    this.addHit('radio', 'RADIO  (HOLD V TO TALK)', new THREE.Vector3(x, y, z), [0.36, 0.2, 0.26]);
  }

  buildBlueprintProp(x, y, z) {
    const tex = new THREE.CanvasTexture(this.blueprint.thumbnail());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.54), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = 0.08;
    m.position.set(x, y, z);
    this.scene.add(m);
    for (const [px, pz] of [[-0.34, -0.22], [0.33, 0.21]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      w.position.set(x + px, y + 0.015, z + pz);
      this.scene.add(w);
    }
    this.addHit('blueprint', 'BLUEPRINTS  [TAB]', new THREE.Vector3(x, y + 0.02, z), [0.8, 0.06, 0.56]);
  }

  addHit(id, label, pos, size, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(pos); m.rotation.y = ry;
    m.userData.station = { id, label };
    this.scene.add(m);
    this.hitboxes.push(m);
  }

  // ------------------------------------------------------------------ focus
  focusPose(id) {
    if (id === 'monitors') return { pos: new THREE.Vector3(0, 1.08, 0.12), look: new THREE.Vector3(0, 1.08, -0.55), fov: 62, h: Math.max(this.settings.pixel, 540) };
    if (id === 'terminal') return { pos: this.termFocus.pos, look: this.termFocus.look, fov: 50, h: Math.max(this.settings.pixel, 720) };
    if (id === 'cipher') return { pos: this.cipher.pos.clone().add(new THREE.Vector3(0, 0.55, 0.03)), look: this.cipher.pos, fov: 46, h: Math.max(this.settings.pixel, 720) };
    return null;
  }

  setFocus(id) {
    this.hud.paused(false);
    if (id === 'blueprint') { this.focus = 'blueprint'; this.input.unlock(); this.blueprint.open(); this.hud.crosshair(false); this.wantsCursor = true; return; }
    if (id === 'radio') { this.hud.toast(this.settings.ptt === 'open' ? 'Open mic is on' : 'Hold V to talk', ''); return; }
    const p = this.focusPose(id);
    if (!p) return;
    this.focus = id;
    this.wantsCursor = true;
    this.tween = { t: 0, fromPos: this.cam.position.clone(), fromQ: this.cam.quaternion.clone(), toPos: p.pos.clone(), toQ: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p.pos, p.look, new THREE.Vector3(0, 1, 0))), fromFov: this.cam.fov, toFov: p.fov };
    this.engine.setTargetHeight(p.h);
    this.input.unlock();
    this.hud.crosshair(false);
    this.hud.prompt('');
    const hints = {
      monitors: '1–0 CAMERA · I IR · DRAG/ARROWS AIM · WHEEL ZOOM · CLICK SIDE SCREEN TO SWAP · P PIN',
      terminal: 'TYPE COMMANDS · ENTER RUNS · F1-F6, [ ] OR CLICK A TAB TO SWITCH',
      cipher: 'DRAG OR ← → TO TURN THE INNER DISC',
    };
    this.hud.setInspect(hints[id], true, 'RIGHT-CLICK / [ESC] SIT BACK');
    if (id === 'terminal') {
      const cap = (e) => {
        if (e.type !== 'keydown') return false;
        if (e.code === 'Escape') { this.unfocus(); return true; }
        if (e.code === 'Tab') { this.openBlueprint(); return true; }
        if (e.code === 'KeyV' && this.voice && this.settings.ptt === 'hold' && this.terminal.input === '' && false) return false;
        return this.terminal.key(e);
      };
      cap.active = true;
      this.input.textCapture = cap;
    }
  }

  // Blueprints open over whatever station LINE is at and close back to it. Switching never
  // re-locks the pointer in between (a lock request lands after the unlock and traps the mouse).
  openBlueprint() {
    if (this.focus === 'blueprint') return;
    this.bpReturn = this.focus;
    if (this.focus) this.unfocus(false);
    this.setFocus('blueprint');
  }
  closeBlueprint() {
    const back = this.bpReturn;
    this.bpReturn = null;
    this.unfocus(!back);
    if (back) this.setFocus(back);
  }

  unfocus(relock = true) {
    if (this.focus === 'blueprint') this.blueprint.close();
    this.input.textCapture = null;
    this.focus = null;
    this.wantsCursor = false;
    if (!relock) { this.hud.setInspect('', false); return; }
    this.tween = { t: 0, fromPos: this.cam.position.clone(), fromQ: this.cam.quaternion.clone(), toPos: SEAT.clone(), toQ: null, fromFov: this.cam.fov, toFov: this.settings.fov };
    this.engine.setTargetHeight(this.settings.pixel);
    this.hud.setInspect('', false);
    this.hud.crosshair(true);
    this.input.lock();
  }

  // ------------------------------------------------------------------ events
  onEvent(e) {
    if (e.k === 'gateWarn') this.hud.toast('GHOST: CODE INVALID — the next wrong code trips the alarm', 'bad');
    if (e.k === 'strike') {
      this.flashT = 1;
      sfx.strike();
      this.hud.toast(`ALERT ${e.n} — ${e.reason}`, 'bad');
      for (const m of this.monitors) m.glitch = 0.8;
      this.world.avatar.alarm = 2;
      // cut the main monitor to the nearest camera on that zone for a few seconds, so LINE sees it happen
      const p = this.pose();
      const cams = CAMERAS.map((c, i) => ({ c, i })).filter(({ c }) => c.zone === e.zone);
      if (cams.length && p) {
        cams.sort((a, b) => Math.hypot(a.c.pos[0] - p[0], a.c.pos[2] - p[2]) - Math.hypot(b.c.pos[0] - p[0], b.c.pos[2] - p[2]));
        const idx = cams[0].i;
        if (idx !== this.mainIdx) { this.cut = { prev: this.cut?.prev ?? this.mainIdx, idx, t: 3.5 }; this.mainIdx = idx; sfx.static(0.15, 0.04); }
      }
    }
    if (e.k === 'sfx' && e.name === 'caught') { sfx.static(0.7, 0.16); for (const m of this.monitors) m.glitch = 1; }
    if (e.k === 'stalker') { sfx.static(0.3, 0.06); this.hud.toast('THERMAL: COLD SHAPE BEHIND GHOST — IT HEARS THE RADIO', 'bad'); }
    if (e.k === 'lockdown') { sfx.lockdown(); this.hud.toast('LOCKDOWN — open OVERRIDE in the terminal', 'bad'); this.flashT = 1; }
    if (e.k === 'sfx' && e.name === 'granted') sfx.granted();
    if (e.k === 'spark') this.world.onSpark?.();
    if (e.k === 'sfx' && ['optics', 'power'].includes(e.name)) sfx.chime();
    if (e.k === 'sfx' && e.name === 'liftArrive') sfx.ding();
    if (e.k === 'deny') {/* terminal reports it */}
    if (e.k === 'win' || e.k === 'lose') sfx.ambience('van', false);
  }

  pose() {
    // interpolate GHOST's pose 100 ms in the past
    const now = performance.now() - 110;
    const P = this.poses;
    while (P.length > 2 && P[1].t <= now) P.shift();
    if (!P.length) return null;
    if (P.length === 1 || now <= P[0].t) return P[0].p;
    const a = P[0], b = P[1];
    const k = Math.min(1, (now - a.t) / Math.max(1, b.t - a.t));
    const lerpAng = (x, y) => { let d = y - x; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return x + d * k; };
    return [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k, lerpAng(a.p[3], b.p[3]), a.p[4] + (b.p[4] - a.p[4]) * k, b.p[5]];
  }

  // ------------------------------------------------------------------ update
  update(dt, t) {
    const I = this.input, s = this.world.state, now = this.net.serverNow();
    if (this.keysT > 0 && (this.keysT -= dt) <= 0) this.hud.keys('');
    if (I.hit('F1') && this.focus !== 'terminal') { const o = OBJECTIVES[this.world.state?.objective]; if (o) this.hud.objective(o.handler); this.keysT = 20; this.hud.keys(this.keyHelp); }
    if (s && this.lastObjective !== s.objective && s.phase === 'playing') {
      this.lastObjective = s.objective;
      const o = OBJECTIVES[s.objective];
      if (o) this.hud.objective(o.handler);
      if (!this.pinned) this.slots = (RELEVANT[s.objective] || RELEVANT.gate).map((id) => CAMERAS.findIndex((c) => c.id === id));
      const rel = RELEVANT[s.objective];
      if (rel && !this.pinned) this.mainIdx = CAMERAS.findIndex((c) => c.id === rel[0]);
    }
    if (this.cut && (this.cut.t -= dt) <= 0) {
      if (this.mainIdx === this.cut.idx) this.mainIdx = this.cut.prev;
      this.cut = null;
    }
    // GHOST avatar + flashlight in the facility
    const p = this.pose();
    this.world.avatar.talk = this.voice ? Math.min(1, this.voice.inLevel * 6) : 0;
    this.world.avatar.update(dt, t, p);
    const F = this.world.flash;
    if (p) {
      const yaw = p[3], pitch = p[4];
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      const hand = this.world.avatar.torch.getWorldPosition(new THREE.Vector3());
      F.position.copy(hand).addScaledVector(dir, 0.2);
      F.target.position.copy(F.position).addScaledVector(dir, 6);
      F.target.updateMatrixWorld();
      F.intensity = p[5] & 2 ? 20 : 0;
    } else F.intensity = 0;

    // look / focus / tweens
    if (!this.focus && I.lookActive) {
      const sens = 0.0022 * this.settings.sens;
      this.yaw = Math.max(-1.75, Math.min(1.75, this.yaw - I.mouse.dx * sens));
      this.pitch = Math.max(-1.0, Math.min(0.7, this.pitch - I.mouse.dy * sens * (this.settings.invert ? -1 : 1)));
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / 0.32);
      const k = tw.t * tw.t * (3 - 2 * tw.t);
      const toQ = tw.toQ || new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      this.cam.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.cam.quaternion.slerpQuaternions(tw.fromQ, toQ, k);
      this.cam.fov = tw.fromFov + (tw.toFov - tw.fromFov) * k;
      if (tw.t >= 1) this.tween = null;
    } else if (!this.focus) {
      this.cam.position.copy(SEAT);
      this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.cam.fov = this.settings.fov;
    }
    this.cam.aspect = this.engine.width / this.engine.height;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();

    // quick keys
    if (this.focus !== 'terminal') {
      if (I.hit('Tab')) { if (this.focus === 'blueprint') this.closeBlueprint(); else this.openBlueprint(); }
      if (!this.focus && I.hit('KeyM')) this.setFocus('monitors');
      if (!this.focus && I.hit('KeyT')) this.setFocus('terminal');
    }
    if (this.focus && this.focus !== 'blueprint' && this.focus !== 'terminal' && (I.hit('Escape') || I.mouse.rclicked)) this.unfocus();
    else if (this.focus === 'terminal' && I.mouse.rclicked) this.unfocus();

    if (!this.focus) this.updateSeat();
    else if (this.focus === 'monitors') this.updateMonitors(dt);
    else if (this.focus === 'terminal') this.updateTerminalClicks();
    else if (this.focus === 'cipher') this.updateCipher(dt);
    else if (this.focus === 'blueprint') this.blueprint.update(dt);
    this.terminal.focused = this.focus === 'terminal';
    this.terminal.update(dt);
    if (((t * 8) | 0) !== this.clockTick) { this.clockTick = (t * 8) | 0; this.drawClock(s, now); this.drawSelector(); }
    // cipher easing
    const ci = this.cipher;
    ci.inner.rotation.z += (-ci.steps * (Math.PI * 2) / 16 - ci.inner.rotation.z) * Math.min(1, dt * 14);
    // radio
    const tx = this.voice?.tx, rx = this.voice && (this.voice.remoteTx || this.voice.inLevel > 0.02);
    this.txLamp.material.color.setHex(tx ? 0xff3020 : 0x300804);
    this.rxLamp.material.color.setHex(rx ? 0x40ff60 : 0x082008);
    const lvl = Math.min(1, ((tx ? this.voice.level : this.voice?.inLevel) || 0) * 8);
    this.needle.rotation.z = 0.7 - lvl * 1.4;
    // ambience
    this.rainMat.uniforms.uTime.value = t;
    this.carT = (this.carT ?? 6) - dt;
    if (this.carT < 0) { this.carT = 14 + Math.random() * 20; this.carSweep = 0; }
    if (this.carSweep != null) {
      this.carSweep += dt / 2.2;
      const k = this.carSweep;
      this.carLight.intensity = Math.sin(Math.min(1, k) * Math.PI) * 1.5;
      this.carLight.position.set(2.2, 1.2, -1.5 + k * 3);
      this.rainMat.uniforms.uCar.value = Math.sin(Math.min(1, k) * Math.PI);
      if (k >= 1) { this.carSweep = null; this.carLight.intensity = 0; this.rainMat.uniforms.uCar.value = 0; }
    }
    this.flashT = Math.max(0, this.flashT - dt * 0.9);
    const lock = s?.lockdown?.active;
    this.alertLight.intensity = this.flashT * 3 + (lock ? (Math.sin(t * 6) * 0.5 + 0.5) * 0.9 : 0);
    const P = this.engine.post.uniforms;
    P.uFade.value = 1; P.uStatic.value = 0;
    P.uFlash.value = this.flashT * 0.35;
  }

  updateSeat() {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), this.cam);
    rc.far = 2.2;
    const hit = rc.intersectObjects(this.hitboxes, false)[0];
    const st = hit?.object.userData.station;
    this.hud.prompt(st ? `[CLICK] ${st.label}` : '');
    const I = this.input;
    if (st && (I.locked ? I.mouse.clicked : I.mouse.tapped)) this.setFocus(st.id);
  }

  updateMonitors(dt) {
    const I = this.input;
    const main = this.cctv.cams[this.mainIdx];
    for (let k = 0; k < 10; k++) {
      if (I.hit(`Digit${(k + 1) % 10}`) || I.hit(`Numpad${(k + 1) % 10}`)) { this.mainIdx = k; this.cut = null; sfx.click(0.1); sfx.static(0.15, 0.04); }
    }
    if (I.hit('KeyI')) {
      if (main.def.ir) { main.ir = !main.ir; sfx.click(0.12); } else this.hud.toast(`${main.def.id} has no infra-red`, '');
    }
    if (I.hit('KeyP')) { this.pinned = !this.pinned; this.hud.toast(this.pinned ? 'Side screens pinned' : 'Side screens follow the objective', ''); }
    const pan = (I.down('ArrowLeft') ? 1 : 0) - (I.down('ArrowRight') ? 1 : 0);
    const tilt = (I.down('ArrowUp') ? 1 : 0) - (I.down('ArrowDown') ? 1 : 0);
    let z = 1;
    if (I.mouse.wheel) z = I.mouse.wheel < 0 ? 1.12 : 1 / 1.12;
    const ndc = new THREE.Vector2((I.mouse.x / innerWidth) * 2 - 1, -(I.mouse.y / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.cam);
    const hit = rc.intersectObjects(this.monitors.map((m) => m.mesh), false)[0];
    const mon = hit?.object.userData.monitor;
    let dPan = pan * dt * 0.8, dTilt = tilt * dt * 0.6;
    if (I.mouse.down && mon?.slot === 'main' && !I.mouse.clicked) { dPan += I.mouse.dx * 0.003; dTilt += I.mouse.dy * 0.003; }
    if ((dPan || dTilt || z !== 1) && !this.cctv.ptz(main, dPan, dTilt, z) && (pan || tilt || I.mouse.wheel)) {
      if (!this.ptzWarned) { this.hud.toast(`${main.def.id} is a fixed camera — zoom only`, ''); this.ptzWarned = true; }
    }
    this.hud.cursor(mon && mon.slot !== 'main' ? 'pointer' : mon ? 'grab' : 'default');
    if (I.mouse.clicked && mon && mon.slot !== 'main') {
      const prev = this.mainIdx;
      this.mainIdx = this.slots[mon.slot];
      this.slots[mon.slot] = prev;
      this.cut = null;
      sfx.click(0.1);
    }
  }

  updateTerminalClicks() {
    const I = this.input;
    if (!I.mouse.clicked) return;
    const ndc = new THREE.Vector2((I.mouse.x / innerWidth) * 2 - 1, -(I.mouse.y / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.cam);
    const hit = rc.intersectObject(this.termScreen, false)[0];
    if (hit) this.terminal.click(hit.uv.x, hit.uv.y);
  }

  updateCipher(dt) {
    const I = this.input, ci = this.cipher;
    if (I.hit('ArrowRight') || I.hit('KeyD')) { ci.steps = (ci.steps + 1) % 16; sfx.ratchet(); }
    if (I.hit('ArrowLeft') || I.hit('KeyA')) { ci.steps = (ci.steps + 15) % 16; sfx.ratchet(); }
    if (I.mouse.down) {
      ci.drag = (ci.drag || 0) + I.mouse.dx;
      while (ci.drag > 18) { ci.drag -= 18; ci.steps = (ci.steps + 1) % 16; sfx.ratchet(); }
      while (ci.drag < -18) { ci.drag += 18; ci.steps = (ci.steps + 15) % 16; sfx.ratchet(); }
    } else ci.drag = 0;
    if (Math.abs(ci.inner.rotation.z + ci.steps * (Math.PI * 2) / 16) > Math.PI) ci.inner.rotation.z = -ci.steps * (Math.PI * 2) / 16;
  }

  drawSelector() {
    const c = this.selCv.getContext('2d');
    c.fillStyle = '#2c2d2b'; c.fillRect(0, 0, 512, 128);
    CAMERAS.forEach((cam, i) => {
      const x = 8 + i * 50;
      const on = i === this.mainIdx;
      c.fillStyle = on ? '#f2c230' : '#151515'; c.fillRect(x, 14, 44, 44);
      c.fillStyle = on ? '#111' : '#bbb'; c.font = '700 22px "Courier New", monospace'; c.textAlign = 'center';
      c.fillText(String((i + 1) % 10), x + 22, 44);
      c.fillStyle = cam.ir ? (this.cctv.cams[i].ir ? '#ff5a3a' : '#5a2a20') : '#2c2d2b';
      c.fillRect(x + 14, 66, 16, 8);
    });
    c.fillStyle = '#999'; c.font = '700 18px "Courier New", monospace'; c.textAlign = 'left';
    c.fillText('CAMERA SELECT          ■ = IR', 10, 110);
    this.selTex.needsUpdate = true;
  }

  drawOverlay(mon, c, now) {
    const s = this.world.state;
    const ir = c.ir && c.def.ir;
    const date = new Date(Date.UTC(1987, 9, 30, 2, 0, 0) + (s?.startAt ? now - s.startAt : 0));
    const ts = date.toISOString().slice(0, 19).replace('T', ' ');
    const key = `${c.def.id}|${ir}|${ts}|${c.zoom.toFixed(1)}`;
    if (key === mon.lastOver) return;
    mon.lastOver = key;
    const g = mon.overlay.getContext('2d');
    g.clearRect(0, 0, 320, 240);
    g.font = '700 15px "Courier New", monospace';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.textAlign = 'left';
    g.fillText(c.def.id, 12, 22);
    g.font = '700 11px "Courier New", monospace';
    g.fillText(c.def.label, 12, 37);
    g.textAlign = 'right';
    g.fillText(ts, 308, 228);
    if (ir) { g.fillStyle = 'rgba(255,90,60,0.95)'; g.font = '700 15px "Courier New", monospace'; g.fillText('IR', 308, 22); }
    else if (c.def.ir) { g.fillStyle = 'rgba(255,255,255,0.4)'; g.font = '700 11px "Courier New", monospace'; g.fillText('IR READY', 308, 22); }
    if (c.zoom > 1.01) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'left'; g.fillText(`x${c.zoom.toFixed(1)}`, 12, 228); }
    g.fillStyle = 'rgba(255,40,30,0.9)'; g.beginPath(); g.arc(mon.slot === 'main' ? 290 : 296, 44, 5, 0, 7); g.fill();
    mon.otex.needsUpdate = true;
  }

  render(t) {
    const now = this.net.serverNow();
    // feeds: main every frame, one small monitor per frame round-robin
    this.rr = ((this.rr ?? -1) + 1) % 4;
    for (const mon of this.monitors) {
      const idx = mon.slot === 'main' ? this.mainIdx : this.slots[mon.slot];
      const c = this.cctv.cams[idx];
      if (!c) continue;
      if (mon.slot === 'main' || mon.slot === this.rr) this.cctv.render(c, mon.rt);
      mon.uniforms.uTime.value = t;
      mon.uniforms.uIR.value = c.ir && c.def.ir ? 1 : 0;
      mon.glitch = Math.max(0, (mon.glitch || 0) - 0.02);
      mon.uniforms.uGlitch.value = mon.glitch;
      mon.uniforms.uSignal.value = mon.glitch > 0.5 ? 0.3 : 1;
      this.drawOverlay(mon, c, now);
    }
    this.engine.render(this.scene, this.cam, t);
  }

  dispose() {
    this.unsub.forEach((u) => u());
    this.blueprint.close();
    for (const m of this.monitors) { m.rt.dispose(); m.otex.dispose(); }
    const seen = new Set();
    this.scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const mm of mats) { if (seen.has(mm)) continue; seen.add(mm); mm.map?.dispose(); mm.dispose(); }
    });
    this.terminal.dispose();
    this.blueprint.dispose();
    this.input.textCapture = null;
    sfx.ambience('van', false);
  }
}

export { ZONE_ORDER, stencilText, MAT };
