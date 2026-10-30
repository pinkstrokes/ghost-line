import * as THREE from 'three';

// Fixed pool of point lights moved onto the nearest anchors before each render.
// Changing the number of lights would recompile every shader, moving them is free.

export class LightPool {
  constructor(scene, n = 6) {
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
  }

  static flicker(a, t) {
    if (!a.flicker) return 1;
    const s = a.seed ?? (a.seed = Math.random() * 100);
    const n = Math.sin(t * 2.3 + s) * Math.sin(t * 5.7 + s * 1.7) * Math.sin(t * 0.9 + s * 0.3);
    if (n > 1 - a.flicker * 0.6) return Math.random() < 0.5 ? 0.05 : 0.6;
    return 0.92 + Math.sin(t * 60 + s) * 0.04;
  }

  assign(anchors, pos, rooms, t, budget = this.lights.length) {
    const cand = [];
    for (const a of anchors) {
      if (!a.on || !rooms.includes(a.room)) continue;
      const d = (a.x - pos.x) ** 2 + (a.y - pos.y) ** 2 * 0.3 + (a.z - pos.z) ** 2;
      if (d > (a.distance + 14) ** 2) continue;
      cand.push([d / (a.intensity + 0.1), a]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const a = i < budget ? cand[i]?.[1] : null;
      if (!a) { l.intensity = 0; l.visible = false; continue; }
      l.visible = true;
      l.position.set(a.x, a.y, a.z);
      l.color.set(a.color);
      l.distance = a.distance;
      l.decay = a.decay;
      l.intensity = a.intensity * LightPool.flicker(a, t) * (a.mult ?? 1);
    }
  }
}
