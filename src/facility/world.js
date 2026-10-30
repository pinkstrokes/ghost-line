import * as THREE from 'three';
import { DecalAtlas, PAL } from '../engine/kit.js';
import { LightPool } from '../engine/lights.js';
import { updateDoor } from './props.js';
import { zoneOf } from '../../shared/layout.js';
import { Avatar } from './avatar.js';
import { buildGate } from '../zones/gate.js';
import { buildLasers } from '../zones/lasers.js';
import { buildPatch } from '../zones/patch.js';
import { buildMaze } from '../zones/maze.js';
import { buildOptics } from '../zones/optics.js';
import { buildVault } from '../zones/vault.js';
import { buildEscape } from '../zones/escape.js';

export const LAYER = { WORLD: 0, AVATAR: 1, IR: 2, FP: 3, SMOKE: 4, HIT: 5, HOT: 6, CONE: 7, COLDMARK: 8 };

// IR beams fade with distance from the viewing camera, so near gates pop and far ones recede
export const IR_BEAM_MAT = new THREE.ShaderMaterial({
  vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying float vD; void main(){ float b = clamp(1.35 - vD / 16.0, 0.28, 1.0); gl_FragColor = vec4(vec3(b), 1.0); }',
});

const ROOM_LIGHTS = {
  gate: ['gate'], lasers: ['lasers'], patch: ['patch'], maze: ['maze'], optics: ['optics'], vault: ['vault'], escape: ['escape'],
};

// The whole facility, built once from the mission. Both clients build it: GHOST walks it,
// LINE renders it through the CCTV cameras.
export class FacilityWorld {
  constructor(mission, { role }) {
    this.mission = mission;
    this.role = role;
    this.scene = new THREE.Scene();
    this.scene.matrixWorldAutoUpdate = true;
    this.colliders = [];
    this.grid = new Map();
    this.lightAnchors = [];
    this.interactables = [];
    this.doors = {};
    this.zones = [];
    this.atlas = new DecalAtlas(2048);
    this.state = null;
    this.serverTime = () => Date.now();
    this.act = () => {};
    this.sfx = null;

    this.irGroup = new THREE.Group();
    this.scene.add(this.irGroup);
    this.hitGroup = new THREE.Group();
    this.scene.add(this.hitGroup);

    this.hemi = new THREE.HemisphereLight(0x6c7a90, 0x1a1712, 0.18);
    this.scene.add(this.hemi);
    this.lights = new LightPool(this.scene, 7);

    this.flash = new THREE.SpotLight(0xfff0d0, 0, 24, 0.48, 0.5, 1.4);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.bias = -0.0009;
    this.flash.shadow.camera.near = 0.15;
    this.flash.shadow.camera.far = 24;
    this.scene.add(this.flash, this.flash.target);
    this.flashOn = true;

    this.fog = new THREE.FogExp2(0x06080a, 0.06);
    this.scene.fog = this.fog;
    this.buildSky();

    this.zones.push(buildGate(this), buildLasers(this), buildPatch(this), buildMaze(this), buildOptics(this), buildVault(this), buildEscape(this));
    for (const m of this.atlas.build()) this.scene.add(m);

    this.avatar = new Avatar();
    this.scene.add(this.avatar.group);
    this.avatar.setLayer(LAYER.AVATAR);
    this.avatar.cone.layers.set(LAYER.CONE);
  }

  buildSky() {
    const g = new THREE.SphereGeometry(200, 16, 10);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0x02040a), mid = new THREE.Color(0x0c1626), low = new THREE.Color(0x1a2433);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 200;
      if (t > 0.15) c.copy(mid).lerp(top, Math.min(1, (t - 0.15) / 0.6)); else c.copy(low).lerp(mid, Math.max(0, (t + 0.1) / 0.25));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.position.set(0, 0, 10);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    // stars + moon
    const sp = [];
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2;
      sp.push(Math.cos(a) * Math.cos(e) * 190, Math.sin(e) * 190, Math.sin(a) * Math.cos(e) * 190 + 10);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8a96aa, size: 1.2, sizeAttenuation: false, fog: false }));
    this.scene.add(this.stars);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 10), new THREE.MeshBasicMaterial({ color: 0xd8dcc8, fog: false }));
    moon.position.set(-60, 70, 150);
    moon.lookAt(0, 0, 0);
    this.scene.add(moon);
    this.moon = moon;
  }

  // ---------------------------------------------------------------- collision
  addCollider(x0, x1, z0, z1, y0 = 0, y1 = 3, id = null) {
    const c = { x0, x1, z0, z1, y0, y1, id, disabled: false };
    this.colliders.push(c);
    const C = 4;
    for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++)
      for (let gz = Math.floor(z0 / C); gz <= Math.floor(z1 / C); gz++) {
        const k = gx * 100000 + gz;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(c);
      }
    return c;
  }

  // Resolve a circle (x, z, r) for a body spanning [y, y + h]. Returns {x, z}.
  collide(x, z, r, y, h) {
    const C = 4;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const seen = new Set();
      for (let gx = Math.floor((x - r) / C); gx <= Math.floor((x + r) / C); gx++)
        for (let gz = Math.floor((z - r) / C); gz <= Math.floor((z + r) / C); gz++) {
          const list = this.grid.get(gx * 100000 + gz);
          if (!list) continue;
          for (const c of list) {
            if (seen.has(c) || c.disabled) continue;
            seen.add(c);
            if (c.y1 <= y + 0.05 || c.y0 >= y + h) continue;
            const px = Math.max(c.x0, Math.min(x, c.x1)), pz = Math.max(c.z0, Math.min(z, c.z1));
            const dx = x - px, dz = z - pz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              x = px + (dx / d) * r; z = pz + (dz / d) * r;
            } else {
              // centre inside the box: push out along the shallowest axis
              const opts = [[c.x0 - r - x, 0], [c.x1 + r - x, 0], [0, c.z0 - r - z], [0, c.z1 + r - z]];
              opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
              x += opts[0][0]; z += opts[0][1];
            }
            moved = true;
          }
        }
      if (!moved) break;
    }
    return { x, z };
  }

  addInteractable(it) {
    if (!it.hit) {
      const s = it.size || [0.6, 0.6, 0.6];
      it.hit = new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshBasicMaterial({ visible: false }));
      it.hit.position.copy(it.pos);
      if (it.ry) it.hit.rotation.y = it.ry;
    }
    it.hit.layers.set(LAYER.HIT);
    it.hit.userData.interactable = it;
    this.hitGroup.add(it.hit);
    this.interactables.push(it);
    return it;
  }

  // Inspect-mode click targets
  makeButton(mesh, data) {
    mesh.userData.button = data;
    mesh.layers.enable(LAYER.HIT);
    return mesh;
  }

  // ---------------------------------------------------------------- per frame
  setState(s) { this.state = s; }

  update(dt, t) {
    const s = this.state;
    if (s) for (const [id, d] of Object.entries(this.doors)) {
      const want = s.doors[id] ?? 0;
      d.target = d.override ?? (want ? 1 : 0);
      if (updateDoor(d, dt) && this.sfx && Math.abs(d.open - d.target) > 0.02 && !d.moving) {
        d.moving = true;
        this.sfx.door(d.group.position, d.mode);
      }
      if (Math.abs(d.open - d.target) < 0.01) d.moving = false;
    }
    for (const z of this.zones) z.update && z.update(dt, t, s);
  }

  // Place pooled lights and pick fog for a camera about to render.
  prepare(camera, opts = {}) {
    const p = camera.getWorldPosition(_p);
    const room = zoneOf(p.x, p.z);
    this.lights.assign(this.lightAnchors, p, ROOM_LIGHTS[room] || [room], this.t || 0, opts.lightBudget);
    const outdoor = room === 'gate' && p.z > -0.5;
    this.sky.visible = outdoor; this.stars.visible = outdoor; this.moon.visible = outdoor;
    this.scene.background = outdoor ? null : _black;
    const smoke = this.state?.lockdown?.active && room === 'escape';
    if (opts.noFog) { this.scene.fog = null; }
    else {
      this.scene.fog = this.fog;
      if (outdoor) { this.fog.color.setHex(0x111a28); this.fog.density = 0.035; }
      else if (smoke) { this.fog.color.setHex(0x2a2522); this.fog.density = opts.smokeDensity ?? 0.62; }
      else if (room === 'maze') { this.fog.color.setHex(0x030404); this.fog.density = 0.11; }
      else { this.fog.color.setHex(0x050607); this.fog.density = 0.055; }
    }
    this.hemi.intensity = (outdoor ? 0.55 : room === 'maze' ? 0.035 : 0.12) * (opts.gain ?? 1);
    this.hemi.color.setHex(outdoor ? 0x5a6a8a : 0x6c7a90);
    return room;
  }
}

const _p = new THREE.Vector3();
const _black = new THREE.Color(0x000000);
export { PAL };
