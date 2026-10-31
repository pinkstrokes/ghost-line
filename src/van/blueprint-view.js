import { SHEETS, SHEET_W, SHEET_H } from '../blueprint/sheets.js';

// Full-resolution blueprint viewer for LINE. Pan (drag), zoom (wheel), red pencil (Shift+drag),
// sheet tabs (1-7). While moving it shows a cached raster; when the view settles it re-draws the
// visible part as vectors so text stays sharp at any zoom.

const BASE_PX = 2400;

export class BlueprintView {
  constructor({ mission, input, sfx, onClose }) {
    this.mission = mission; this.input = input; this.sfx = sfx; this.onClose = onClose;
    this.layer = document.getElementById('blueprint-layer');
    this.cache = new Map();
    this.strokes = SHEETS.map(() => []);
    this.sheet = 0;
    this.view = null;
    this.isOpen = false;
    this.pencil = false;
  }

  base(i) {
    if (this.cache.has(i)) return this.cache.get(i);
    const c = document.createElement('canvas');
    c.width = BASE_PX; c.height = Math.round((BASE_PX * SHEET_H) / SHEET_W);
    const ctx = c.getContext('2d');
    ctx.scale(BASE_PX / SHEET_W, BASE_PX / SHEET_W);
    SHEETS[i].draw(ctx, this.mission);
    this.cache.set(i, c);
    return c;
  }

  thumbnail() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round((1024 * SHEET_H) / SHEET_W);
    const ctx = c.getContext('2d');
    ctx.scale(1024 / SHEET_W, 1024 / SHEET_W);
    SHEETS[1].draw(ctx, this.mission);
    return c;
  }

  build() {
    if (this.canvas) return;
    this.layer.innerHTML = `<canvas></canvas>
      <div class="bp-tabs">${SHEETS.map((s, i) => `<button data-i="${i}">${i + 1} · ${s.id} ${s.name}</button>`).join('')}</div>
      <div class="bp-tools"><button data-t="pencil">✎ PENCIL (Shift)</button><button data-t="undo">UNDO (Z)</button><button data-t="clear">CLEAR SHEET (X)</button><button data-t="fit">FIT (F)</button><button data-t="close">CLOSE (Tab/Esc)</button>
      <span class="small">drag to pan · wheel to zoom</span></div>`;
    this.canvas = this.layer.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.layer.querySelectorAll('.bp-tabs button').forEach((b) => b.addEventListener('click', () => this.select(+b.dataset.i)));
    this.layer.querySelector('[data-t=pencil]').addEventListener('click', () => { this.pencil = !this.pencil; this.refreshTools(); });
    this.layer.querySelector('[data-t=undo]').addEventListener('click', () => this.undo());
    this.layer.querySelector('[data-t=clear]').addEventListener('click', () => this.clear());
    this.layer.querySelector('[data-t=fit]').addEventListener('click', () => this.fit());
    this.layer.querySelector('[data-t=close]').addEventListener('click', () => this.onClose());
    const cv = this.canvas;
    cv.addEventListener('mousedown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, draw: e.shiftKey || this.pencil || e.button === 2 };
      if (this.drag.draw) { this.cur = { pts: [this.toSheet(e.clientX, e.clientY)], w: 0.55 }; this.strokes[this.sheet].push(this.cur); }
      e.preventDefault();
    });
    this.onMove = (e) => {
      if (!this.drag || !this.isOpen) return;
      if (this.drag.draw) {
        const p = this.toSheet(e.clientX, e.clientY), last = this.cur.pts[this.cur.pts.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.35) this.cur.pts.push(p);
      } else {
        this.view.ox += e.clientX - this.drag.x; this.view.oy += e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      }
      this.touch();
    };
    this.onUp = () => { if (this.drag?.draw) this.sfx?.click(0.03); this.drag = null; this.cur = null; };
    this.onResize = () => { if (this.isOpen) { this.sizeCanvas(); this.touch(); } };
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    window.addEventListener('resize', this.onResize);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      const v = this.view;
      const ns = Math.max(v.fit * 0.6, Math.min(v.fit * 9, v.scale * k));
      const f = ns / v.scale;
      v.ox = e.clientX - (e.clientX - v.ox) * f; v.oy = e.clientY - (e.clientY - v.oy) * f;
      v.scale = ns;
      this.touch();
    }, { passive: false });
  }

  dispose() {
    this.close();
    if (this.onMove) { window.removeEventListener('mousemove', this.onMove); window.removeEventListener('mouseup', this.onUp); window.removeEventListener('resize', this.onResize); }
    this.cache.clear();
    this.detail = null;
    if (this.layer) this.layer.innerHTML = '';
    this.canvas = null;
  }

  sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr;
  }

  refreshTools() {
    this.layer.querySelectorAll('.bp-tabs button').forEach((b) => b.classList.toggle('on', +b.dataset.i === this.sheet));
    this.layer.querySelector('[data-t=pencil]').classList.toggle('on', this.pencil);
  }

  open() {
    this.build();
    this.isOpen = true;
    this.layer.classList.add('on');
    this.sizeCanvas();
    if (!this.view) this.fit();
    this.refreshTools();
    this.touch();
    this.sfx?.noise(0.25, { vol: 0.08, freq: 2500, q: 0.4 });
  }
  close() { this.isOpen = false; this.layer?.classList.remove('on'); }

  fit() {
    const s = Math.min((innerWidth - 40) / SHEET_W, (innerHeight - 120) / SHEET_H);
    this.view = { scale: s, fit: s, ox: (innerWidth - SHEET_W * s) / 2, oy: 60 + (innerHeight - 120 - SHEET_H * s) / 2 };
    this.touch();
  }
  select(i) { if (i === this.sheet) return; this.sheet = i; this.refreshTools(); this.touch(); this.sfx?.noise(0.2, { vol: 0.07, freq: 2200, q: 0.4 }); }
  undo() { this.strokes[this.sheet].pop(); this.touch(); }
  clear() { this.strokes[this.sheet] = []; this.touch(); }
  toSheet(x, y) { return [(x - this.view.ox) / this.view.scale, (y - this.view.oy) / this.view.scale]; }
  touch() { this.dirty = true; this.lastMove = performance.now(); this.detail = null; }

  update() {
    if (!this.isOpen) return;
    const I = this.input;
    for (let i = 0; i < SHEETS.length; i++) if (I.hit(`Digit${i + 1}`)) this.select(i);
    if (I.hit('KeyX')) this.clear();
    if (I.hit('KeyZ')) this.undo();
    if (I.hit('KeyF')) this.fit();
    if (I.hit('KeyP')) { this.pencil = !this.pencil; this.refreshTools(); }
    if (I.hit('Escape')) { this.onClose(); return; }
    const settled = performance.now() - this.lastMove > 140;
    if (settled && !this.detail && !this.drag && this.view.scale * this.dpr > (BASE_PX / SHEET_W) * 1.05) { this.renderDetail(); this.dirty = true; }
    if (this.dirty) { this.draw(); this.dirty = false; }
  }

  renderDetail() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    const v = this.view, d = this.dpr;
    ctx.setTransform(v.scale * d, 0, 0, v.scale * d, v.ox * d, v.oy * d);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, SHEET_W, SHEET_H); ctx.clip();
    SHEETS[this.sheet].draw(ctx, this.mission);
    ctx.restore();
    this.detail = { c, sheet: this.sheet };
  }

  draw() {
    const ctx = this.ctx, v = this.view, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // paper shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect((v.ox + 8) * d, (v.oy + 10) * d, SHEET_W * v.scale * d, SHEET_H * v.scale * d);
    if (this.detail && this.detail.sheet === this.sheet) ctx.drawImage(this.detail.c, 0, 0);
    else {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.base(this.sheet), v.ox * d, v.oy * d, SHEET_W * v.scale * d, SHEET_H * v.scale * d);
    }
    // annotations
    ctx.setTransform(v.scale * d, 0, 0, v.scale * d, v.ox * d, v.oy * d);
    ctx.strokeStyle = 'rgba(255,60,40,0.92)';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of this.strokes[this.sheet]) {
      ctx.lineWidth = s.w;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.01, s.pts[0][1]);
      ctx.stroke();
    }
  }
}
