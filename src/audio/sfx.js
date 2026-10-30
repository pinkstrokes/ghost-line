// Every sound in the game is synthesized here with WebAudio. No audio files.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.9, sfx: 0.8, voice: 1.0, amb: 0.7 };
    this.listener = null;
    this.ambs = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.vol.amb; this.ambBus.connect(this.master);
    this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = this.vol.voice; this.voiceBus.connect(this.master);
    // shared noise buffers
    const len = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.listener = ctx.listener;
    return ctx;
  }

  setVolume(k, v) {
    this.vol[k] = v;
    const bus = { master: this.master, sfx: this.sfxBus, amb: this.ambBus, voice: this.voiceBus }[k];
    if (bus) bus.gain.value = v;
  }

  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }

  out(pos, refDistance = 2) {
    if (!pos) return this.sfxBus;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = refDistance; p.rolloffFactor = 1.3; p.maxDistance = 60;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y ?? 1.2, pos.z);
    p.connect(this.sfxBus);
    return p;
  }

  env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }

  tone(freq, dur, { type = 'square', vol = 0.15, at = 0, pos, slide, attack = 0.005 } = {}) {
    if (!this.init()) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(this.out(pos));
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, at = 0, pos, filter = 'bandpass', freq = 1200, q = 1, slide, attack = 0.005, buffer, refDistance } = {}) {
    if (!this.init()) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = buffer === 'brown' ? this.brown : this.white;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(this.out(pos, refDistance));
    s.start(t, Math.random()); s.stop(t + dur + attack + 0.05);
  }

  // ---- named effects
  beep(f = 880, d = 0.07) { this.tone(f, d, { type: 'square', vol: 0.06 }); }
  click(vol = 0.08) { this.noise(0.02, { vol, freq: 3200, q: 2 }); }
  keyClack() { this.noise(0.03, { vol: 0.06, freq: 2400 + Math.random() * 800, q: 3 }); this.tone(180, 0.03, { type: 'sine', vol: 0.03 }); }
  granted() { this.tone(660, 0.12, { type: 'square', vol: 0.06 }); this.tone(990, 0.2, { type: 'square', vol: 0.06, at: 0.12 }); }
  denied() { this.tone(160, 0.45, { type: 'sawtooth', vol: 0.1 }); this.tone(150, 0.45, { type: 'square', vol: 0.05 }); }
  door(pos, mode = 'lift') {
    this.noise(1.1, { vol: 0.25, pos, freq: 900, q: 0.6, slide: 300, attack: 0.05 });
    this.tone(60, 0.5, { type: 'sine', vol: 0.3, pos, at: mode === 'lift' ? 0.9 : 0.6 });
    this.noise(0.15, { vol: 0.3, pos, freq: 200, q: 0.8, at: mode === 'lift' ? 0.9 : 0.6 });
  }
  footstep(pos, loud = 1, surface = 'concrete') {
    const f = surface === 'metal' ? 1800 : surface === 'gravel' ? 2600 : 700;
    this.noise(0.07, { vol: 0.07 * loud, pos, freq: f * (0.8 + Math.random() * 0.4), q: 1.2, refDistance: 1 });
    this.tone(70 + Math.random() * 20, 0.06, { type: 'sine', vol: 0.05 * loud, pos });
  }
  alarm(dur = 2.4) {
    if (!this.init()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 520;
    lfo.frequency.value = 2.2; lg.gain.value = 180;
    lfo.connect(lg).connect(o.frequency);
    this.env(g, t, 0.02, 0.09, dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  strike() { this.alarm(1.8); this.tone(90, 0.6, { type: 'square', vol: 0.12 }); }
  spark(pos) {
    for (let i = 0; i < 9; i++) this.noise(0.03 + Math.random() * 0.05, { vol: 0.25, pos, freq: 3000 + Math.random() * 4000, q: 0.7, at: i * 0.04 * Math.random() * 3 });
    this.tone(120, 0.25, { type: 'sawtooth', vol: 0.08, pos });
  }
  hum(pos) { this.tone(50, 1.2, { type: 'sawtooth', vol: 0.05, pos, attack: 0.3 }); this.tone(100, 1.2, { type: 'sine', vol: 0.05, pos, attack: 0.3 }); }
  powerOn(pos) {
    this.tone(40, 2.5, { type: 'sawtooth', vol: 0.12, slide: 120, attack: 0.4, pos });
    for (let i = 0; i < 4; i++) this.noise(0.08, { vol: 0.2, freq: 400, q: 1, at: 0.6 + i * 0.35, pos });
  }
  clunk(pos) { this.noise(0.12, { vol: 0.25, freq: 300, q: 1.5, pos }); this.tone(85, 0.18, { type: 'sine', vol: 0.18, pos }); }
  tick(pos) { this.noise(0.015, { vol: 0.12, freq: 4200, q: 4, pos }); }
  ratchet(pos) { this.noise(0.05, { vol: 0.15, freq: 1500, q: 2, pos }); this.tone(220, 0.05, { type: 'square', vol: 0.03, pos }); }
  plug(pos) { this.noise(0.05, { vol: 0.2, freq: 1100, q: 3, pos }); this.tone(140, 0.08, { type: 'square', vol: 0.05, pos }); }
  squelch(open = true) {
    this.noise(open ? 0.09 : 0.14, { vol: 0.12, freq: 2200, q: 0.5, slide: open ? 3500 : 900 });
    this.tone(open ? 1300 : 900, 0.04, { type: 'square', vol: 0.03, at: open ? 0 : 0.08 });
  }
  thud(pos) { this.tone(55, 0.35, { type: 'sine', vol: 0.35, pos, slide: 35 }); this.noise(0.2, { vol: 0.2, freq: 150, q: 0.7, pos }); }
  bang(pos) { this.tone(70, 0.4, { type: 'square', vol: 0.18, pos, slide: 40 }); this.noise(0.3, { vol: 0.35, freq: 500, q: 0.6, pos, refDistance: 4 }); }
  groan(pos) {
    if (!this.init()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    const base = 70 + Math.random() * 30;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.7, t + 1.4);
    o2.frequency.setValueAtTime(base * 1.51, t); o2.frequency.linearRampToValueAtTime(base * 1.1, t + 1.4);
    f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 3;
    this.env(g, t, 0.25, 0.22, 1.3);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.out(pos, 3));
    o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
  }
  clicks(pos) { for (let i = 0; i < 6; i++) this.noise(0.012, { vol: 0.3, freq: 2500 + Math.random() * 1500, q: 6, pos, at: i * (0.05 + Math.random() * 0.05), refDistance: 2.5 }); }
  creatureStep(pos, fast) { this.noise(0.05, { vol: fast ? 0.2 : 0.1, freq: 400, q: 1.5, pos, refDistance: 2.5 }); }
  lockdown() { for (let i = 0; i < 3; i++) this.tone(330, 0.5, { type: 'square', vol: 0.08, at: i * 0.7 }); }
  static(dur = 0.4, vol = 0.1) { this.noise(dur, { vol, freq: 3000, q: 0.3 }); }

  // ---- loops
  ambience(name, on, opts = {}) {
    if (!this.init()) return;
    const ctx = this.ctx;
    if (!on) {
      const a = this.ambs[name];
      if (a) { a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }), 2000); delete this.ambs[name]; }
      return;
    }
    if (this.ambs[name]) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.ambBus);
    const nodes = [];
    const noise = (buf, type, freq, q, vol) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = vol;
      s.connect(f).connect(gg).connect(g); s.start(0, Math.random() * 1.5); nodes.push(s);
      return { s, f, gg };
    };
    const osc = (type, freq, vol) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const gg = ctx.createGain(); gg.gain.value = vol;
      o.connect(gg).connect(g); o.start(); nodes.push(o);
      return o;
    };
    if (name === 'facility') {
      noise(this.brown, 'lowpass', 180, 0.7, 0.5);
      osc('sine', 50, 0.035); osc('sine', 100, 0.015);
    } else if (name === 'outdoor') {
      const w = noise(this.white, 'bandpass', 500, 0.4, 0.07);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = 250;
      lfo.connect(lg).connect(w.f.frequency); lfo.start(); nodes.push(lfo);
      noise(this.white, 'highpass', 5000, 0.3, 0.012);
    } else if (name === 'van') {
      noise(this.white, 'bandpass', 2500, 0.3, 0.035); // rain on the roof
      noise(this.brown, 'lowpass', 300, 0.6, 0.18);
      osc('sine', 60, 0.012); osc('square', 15734 / 128, 0.002);
    } else if (name === 'smoke') {
      noise(this.white, 'bandpass', 900, 0.4, 0.06);
      noise(this.brown, 'lowpass', 120, 0.5, 0.6);
    } else if (name === 'klaxon') {
      const o = osc('sawtooth', 420, 0.03);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.8;
      const lg = ctx.createGain(); lg.gain.value = 120;
      lfo.connect(lg).connect(o.frequency); lfo.start(); nodes.push(lfo);
    }
    g.gain.setTargetAtTime(opts.vol ?? 1, ctx.currentTime, 0.8);
    this.ambs[name] = { g, nodes };
  }

  ambVolume(name, v) { const a = this.ambs[name]; if (a && this.ctx) a.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); }
}

export const sfx = new Sfx();
