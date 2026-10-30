import * as THREE from 'three';

// Low internal resolution + nearest upscale (the canvas is CSS-scaled with image-rendering: pixelated),
// then one post pass: subtle posterize with ordered dither, grain, vignette, sRGB out.
// UI stays full resolution because it's HTML on top.

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevels;
uniform float uGrain;
uniform float uVignette;
uniform float uExposure;
uniform vec3 uTint;
uniform float uFlash;     // red alarm flash 0..1
uniform float uStatic;    // signal interference 0..1
uniform float uFade;      // 0 = black, 1 = visible
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
  return 0.0;
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 uv = vUv;
  vec2 px = floor(uv * uRes);
  if (uStatic > 0.0) {
    float line = floor(uv.y * uRes.y);
    uv.x += (hash(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.04 * uStatic;
  }
  vec3 c = texture2D(tColor, uv).rgb * uExposure;
  c *= uTint;
  // soft knee so bright lamps don't clip flat
  c = c / (1.0 + max(c - 0.8, 0.0) * 0.8);
  vec3 s = toSRGB(c);
  float lv = uLevels;
  s = floor(s * lv + 0.5 + bayer4(px) * 0.9) / lv;
  float g = hash(px + fract(uTime) * 91.7) - 0.5;
  s += g * uGrain;
  vec2 d = vUv - 0.5;
  s *= 1.0 - dot(d, d) * uVignette;
  s = mix(s, s * vec3(1.25, 0.55, 0.5) + vec3(0.12, 0.0, 0.0), uFlash);
  if (uStatic > 0.0) s = mix(s, vec3(hash(px + uTime)), uStatic * 0.65);
  gl_FragColor = vec4(s * uFade, 1.0);
}
`;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.autoClear = true;
    this.targetHeight = 360;
    this.rt = null;
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tColor: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uLevels: { value: 28 }, uGrain: { value: 0.035 }, uVignette: { value: 1.1 }, uExposure: { value: 1 },
        uTint: { value: new THREE.Vector3(1, 1, 1) }, uFlash: { value: 0 }, uStatic: { value: 0 }, uFade: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.postScene.add(new THREE.Mesh(tri, this.post));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setTargetHeight(h) {
    if (Math.abs(h - this.targetHeight) < 1) return;
    this.targetHeight = h;
    this.resize();
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const scale = Math.max(1, H / this.targetHeight);
    const w = Math.max(2, Math.round(W / scale)), h = Math.max(2, Math.round(H / scale));
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    if (this.rt) this.rt.dispose();
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
    this.post.uniforms.tColor.value = this.rt.texture;
    this.post.uniforms.uRes.value.set(w, h);
    for (const cb of this.onResize || []) cb(w, h);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    this.post.uniforms.uTime.value = time;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }
}
