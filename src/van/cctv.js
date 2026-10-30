import * as THREE from 'three';
import { CAMERAS } from '../../shared/layout.js';
import { LAYER } from '../facility/world.js';

// Tapped CCTV feeds. Each camera renders the facility into a small target; the van's monitors
// display them through a CRT shader. IR mode = three passes: cold scene (override material, no fog,
// so it sees through smoke), hot pass (GHOST's body and anything on the HOT layer), then the IR layer
// (laser grid, optics beam) on top.

const COLD = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec3 vN; varying float vD;
    void main() {
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vD = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vN; varying float vD;
    void main() {
      float up = vN.y * 0.5 + 0.5;
      float side = abs(vN.x) * 0.35 + abs(vN.z) * 0.55;
      float g = 0.06 + up * 0.11 + side * 0.07;
      g *= 1.0 - clamp(vD / 40.0, 0.0, 0.6);
      gl_FragColor = vec4(vec3(g), 1.0);
    }`,
});
const HOT = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = clamp(dot(normalize(vN), vV), 0.0, 1.0);
      gl_FragColor = vec4(vec3(0.55 + 0.45 * f), 1.0);
    }`,
});

const VOID = new THREE.MeshBasicMaterial({ color: 0x000000 });

export const MONITOR_SHADER = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tFeed; uniform sampler2D tOver;
    uniform float uTime, uIR, uSignal, uBright, uSeed, uGlitch;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      uv = 0.5 + c * (1.0 + dot(c, c) * 0.16);
      float roll = fract(uTime * 0.11 + uSeed);
      float band = smoothstep(0.0, 0.06, abs(uv.y - roll));
      uv.x += (1.0 - band) * 0.006 * sin(uTime * 40.0);
      uv.x += (hash(vec2(floor(uv.y * 120.0), floor(uTime * 24.0))) - 0.5) * 0.03 * uGlitch;
      vec3 col = texture2D(tFeed, uv).rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 img;
      if (uIR > 0.5) {
        l = pow(clamp(l * 1.15, 0.0, 1.0), 0.85);
        img = mix(vec3(0.02, 0.03, 0.05), vec3(1.0, 0.98, 0.92), l);
      } else {
        l = pow(clamp(l * 3.2, 0.0, 1.0), 0.7);
        img = mix(vec3(0.015, 0.03, 0.025), vec3(0.72, 0.86, 0.78), l);
      }
      float n = hash(uv * vec2(320.0, 240.0) + floor(uTime * 30.0));
      img += (n - 0.5) * (uIR > 0.5 ? 0.04 : 0.06);
      img *= mix(0.82, 1.0, band);
      vec4 o = texture2D(tOver, vUv);
      img = mix(img, o.rgb, o.a);
      float edge = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
      img *= edge;
      vec3 noSig = vec3(hash(floor(vUv * vec2(160.0, 120.0)) + floor(uTime * 20.0))) * 0.5;
      img = mix(noSig, img, uSignal);
      gl_FragColor = vec4(img * uBright, 1.0);
    }`,
};

function camDir(c) {
  const d = new THREE.Vector3(c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]).normalize();
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) };
}

export class CCTV {
  constructor(engine, world) {
    this.engine = engine; this.world = world;
    this.cams = CAMERAS.map((def, i) => {
      const cam = new THREE.PerspectiveCamera(def.fov || 62, 4 / 3, 0.08, 70);
      // render from just in front of the lens of the physical camera prop
      const fwd = new THREE.Vector3(def.look[0] - def.pos[0], def.look[1] - def.pos[1], def.look[2] - def.pos[2]).normalize();
      cam.position.set(...def.pos).addScaledVector(fwd, 0.3);
      const { yaw, pitch } = camDir(def);
      return { def, idx: i, cam, yaw0: yaw, pitch0: pitch, pan: 0, tilt: 0, zoom: 1, ir: false, lastRender: 0 };
    });
    this.irOn = new Set();
  }

  makeTarget(w, h) {
    return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  }

  aim(c) {
    const cam = c.cam;
    cam.rotation.set(c.pitch0 + c.tilt, c.yaw0 + c.pan, c.def.roll || 0, 'YXZ');
    cam.fov = (c.def.fov || 62) / c.zoom;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  ptz(c, dPan, dTilt, dZoom) {
    if (!c.def.ptz) return false;
    c.pan = Math.max(-0.9, Math.min(0.9, c.pan + dPan));
    c.tilt = Math.max(-0.5, Math.min(0.45, c.tilt + dTilt));
    c.zoom = Math.max(1, Math.min(2.6, c.zoom * dZoom));
    return true;
  }

  render(c, target) {
    const r = this.engine.renderer, w = this.world, cam = c.cam;
    this.aim(c);
    const ir = c.ir && c.def.ir;
    r.setRenderTarget(target);
    if (!ir) {
      cam.layers.set(LAYER.WORLD); cam.layers.enable(LAYER.AVATAR); cam.layers.enable(LAYER.SMOKE); cam.layers.enable(LAYER.CONE);
      w.prepare(cam, { lightBudget: 5, smokeDensity: 0.62, gain: c.def.zone === 'maze' ? 9 : 4 });
      r.render(w.scene, cam);
    } else {
      w.prepare(cam, { noFog: true, lightBudget: 0 });
      // a Color background forces a clear on every render(), so clear by hand and keep it null
      const bg = w.scene.background;
      w.scene.background = null;
      const sky = w.sky.visible;
      w.sky.visible = false; w.stars.visible = false; w.moon.visible = false;
      r.getClearColor(_prevClear);
      const prevAlpha = r.getClearAlpha();
      r.setClearColor(_irBg, 1);
      r.clear(true, true, false);
      r.autoClear = false;
      cam.layers.set(LAYER.WORLD);
      w.scene.overrideMaterial = COLD;
      r.render(w.scene, cam);
      cam.layers.set(LAYER.AVATAR); cam.layers.enable(LAYER.HOT);
      w.scene.overrideMaterial = HOT;
      r.render(w.scene, cam);
      cam.layers.set(LAYER.COLDMARK);
      w.scene.overrideMaterial = VOID;
      r.render(w.scene, cam);
      w.scene.overrideMaterial = null;
      cam.layers.set(LAYER.IR);
      r.render(w.scene, cam);
      r.autoClear = true;
      r.setClearColor(_prevClear, prevAlpha);
      w.scene.background = bg;
      w.sky.visible = sky;
    }
    r.setRenderTarget(null);
  }
}

const _irBg = new THREE.Color(0x020203);
const _prevClear = new THREE.Color();
