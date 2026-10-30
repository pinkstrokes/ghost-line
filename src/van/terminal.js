import * as THREE from 'three';
import { fmtTime, OBJECTIVES } from '../ui/text.js';
import { CAMERAS } from '../../shared/layout.js';
import { SIG } from '../../shared/signatures.js';

// The van's BMS terminal: a green phosphor command line with six program views.
// It is LINE's only way to touch the facility (breaker, dampers, overrides, lift).

const W = 1024, H = 768;
const PROGRAMS = [
  { id: 'sys', key: 'F1', name: 'SYS' },
  { id: 'power', key: 'F2', name: 'POWER' },
  { id: 'vent', key: 'F3', name: 'VENT' },
  { id: 'sensors', key: 'F4', name: 'SENSORS' },
  { id: 'acoustic', key: 'F5', name: 'ACOUSTIC' },
  { id: 'override', key: 'F6', name: 'OVERRIDE' },
];
const G = '#7dff9a', GD = '#2f7a43', GDD = '#123a1f', BAD = '#ff6a50', AMB = '#ffd166';

export class Terminal {
  constructor({ net, world, sfx }) {
    this.net = net; this.world = world; this.sfx = sfx;
    this.canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.prog = 'sys';
    this.input = '';
    this.log = [];
    this.out = [];
    this.scope = new Float32Array(700);
    this.scopeEvents = [];
    this.scopeAcc = 0;
    this.blink = 0;
    this.dirty = true;
    this.lastState = null;
    this.say('KESTREL-9 BUILDING MANAGEMENT SYSTEM  rev 4.1 (1986)');
    this.say('LINK VIA MAINTENANCE MODEM ... OK');
    this.say("TYPE 'HELP' FOR COMMANDS.");
    net.on('ev', (m) => this.onEvent(m.e, m.now));
  }

  say(text, color = G) { this.out.push({ text, color }); if (this.out.length > 40) this.out.shift(); this.dirty = true; }
  addLog(text, color = G) {
    const s = this.world.state;
    const t = s && s.startAt ? fmtTime(this.net.serverNow() - s.startAt) : '--:--';
    this.log.push({ text: `${t}  ${text}`, color });
    if (this.log.length > 60) this.log.shift();
    this.dirty = true;
  }

  onEvent(e) {
    if (e.k === 'strike') this.addLog(`ALERT ${e.n} — ${e.reason}`, BAD);
    if (e.k === 'acoustic') this.scopeEvents.push({ sig: e.sig, t: performance.now() / 1000, amp: 0.85 + Math.random() * 0.3 });
    if (e.k === 'deny' && e.what === 'damper') { this.say(`DAMPER ${e.id}: INSUFFICIENT POWER — CLOSE ANOTHER DAMPER FIRST`, BAD); this.sfx.denied(); }
    if (e.k === 'sfx' && e.name === 'granted') this.addLog('SERVICE ENTRY 7C — ACCESS GRANTED');
    if (e.k === 'sfx' && e.name === 'power') { this.addLog('SUBSTATION BREAKER CLOSED — POWER RESTORED'); this.say('BREAKER ENGAGED. LOAD NOMINAL. BULKHEAD C RELEASED.'); }
    if (e.k === 'spark') { this.addLog('BREAKER TRIP — PATCH FAULT', BAD); }
    if (e.k === 'sfx' && e.name === 'optics') this.addLog('OPTICS RECEIVERS R1+R2 LOCKED — DOOR E RELEASED');
    if (e.k === 'sfx' && e.name === 'vault') this.addLog('VAULT BOLTWORK RETRACTED');
    if (e.k === 'lockdown') { this.addLog('*** LOCKDOWN PROTOCOL ENGAGED ***', BAD); this.prog = 'override'; this.say('LOCKDOWN. SPINE BULKHEADS SEALED. FIRE SUPPRESSION ACTIVE.', BAD); }
    if (e.k === 'sfx' && e.name === 'override') { this.addLog(`BULKHEAD ${e.id} OVERRIDE ACCEPTED`); this.say(`${e.id}: OVERRIDE ACCEPTED. BULKHEAD OPENING.`); }
    if (e.k === 'sfx' && e.name === 'liftArrive') this.addLog('FREIGHT LIFT AT LEVEL -2. DOORS OPEN.');
    this.dirty = true;
  }

  key(e) {
    const s = this.world.state;
    const k = e.key;
    if (e.altKey || e.metaKey || e.ctrlKey) return false; // Alt = push-to-talk, leave shortcuts alone
    if (/^F[1-6]$/.test(e.code)) { this.prog = PROGRAMS[+e.code.slice(1) - 1].id; this.sfx.keyClack(); this.dirty = true; return true; }
    if (k === '[' || k === ']') {
      const i = PROGRAMS.findIndex((p) => p.id === this.prog);
      this.prog = PROGRAMS[(i + (k === ']' ? 1 : 5)) % 6].id;
      this.sfx.keyClack(); this.dirty = true; return true;
    }
    if (k === 'Enter') { this.run(this.input.trim()); this.input = ''; this.sfx.keyClack(); this.dirty = true; return true; }
    if (k === 'Backspace') { this.input = this.input.slice(0, -1); this.sfx.keyClack(); this.dirty = true; return true; }
    if (this.prog === 'vent' && this.input === '' && /^[1-6]$/.test(k)) {
      const id = `D${k}`;
      const open = s?.maze?.dampers?.[id];
      this.damper(id, !open);
      this.sfx.keyClack();
      return true;
    }
    if (k.length === 1 && /[\x20-\x7e]/.test(k) && this.input.length < 32) { this.input += k.toUpperCase(); this.sfx.keyClack(); this.dirty = true; return true; }
    return false;
  }

  click(u, v) {
    // tabs along the top
    const x = u * W, y = (1 - v) * H;
    if (y > 44 && y < 84) {
      const i = Math.floor((x - 20) / 164);
      if (i >= 0 && i < 6) { this.prog = PROGRAMS[i].id; this.sfx.keyClack(); this.dirty = true; return true; }
    }
    return false;
  }

  act(a) { this.net.send({ t: 'act', a }); }

  damper(id, open) {
    const s = this.world.state;
    if (!s?.patch?.power) { this.say('VENT CONTROL OFFLINE — NO POWER', BAD); this.sfx.denied(); return; }
    this.act({ k: 'damper', id, open });
    this.say(`DAMPER ${id} → ${open ? 'OPEN' : 'CLOSE'}`);
  }

  run(cmd) {
    if (!cmd) return;
    this.say(`LINE> ${cmd}`, GD);
    const s = this.world.state;
    const [c0, c1, c2] = cmd.split(/\s+/);
    const prog = PROGRAMS.find((p) => p.name === c0 || p.id.toUpperCase() === c0);
    if (prog) { this.prog = prog.id; return; }
    if (c0 === 'HELP' || c0 === '?') {
      ['VIEWS:  SYS POWER VENT SENSORS ACOUSTIC OVERRIDE   (F1-F6, [ ], OR CLICK TABS)',
        'BREAKER            ENGAGE SUBSTATION BREAKER',
        'OPEN D3 / CLOSE D3 SET A VENT DAMPER  (IN VENT VIEW: KEYS 1-6 TOGGLE)',
        'L1 1234            SEND OVERRIDE CODE TO BULKHEAD L1',
        'LIFT               CALL FREIGHT LIFT',
        'CLEAR              CLEAR SCREEN'].forEach((l) => this.say(l));
      return;
    }
    if (c0 === 'CLEAR' || c0 === 'CLS') { this.out = []; return; }
    if (c0 === 'BREAKER' || c0 === 'ENGAGE') {
      if (s?.patch?.power) { this.say('BREAKER ALREADY CLOSED.'); return; }
      this.say('ENGAGING BREAKER ...', AMB);
      this.act({ k: 'breaker' });
      this.prog = 'power';
      return;
    }
    if ((c0 === 'OPEN' || c0 === 'CLOSE') && /^D[1-6]$/.test(c1 || '')) { this.damper(c1, c0 === 'OPEN'); return; }
    if (/^D[1-6]$/.test(c0)) { this.damper(c0, !s?.maze?.dampers?.[c0]); return; }
    if (/^L[1-3]$/.test(c0)) {
      if (!s?.lockdown?.active) { this.say('NO LOCKDOWN IN EFFECT — BULKHEADS NOT ARMED', BAD); return; }
      if (!/^\d{4}$/.test(c1 || '')) { this.say(`USAGE: ${c0} ####`, BAD); return; }
      this.say(`${c0}: TRANSMITTING ${c1} ...`, AMB);
      this.act({ k: 'override', door: c0, code: c1 });
      return;
    }
    if (c0 === 'OVERRIDE' && /^L[1-3]$/.test(c1 || '')) return this.run(`${c1} ${c2 || ''}`);
    if (c0 === 'LIFT') {
      if (!s?.doors?.L3) { this.say('LIFT CALL INHIBITED UNTIL BULKHEAD L3 IS OPEN', BAD); return; }
      this.act({ k: 'lift' });
      this.say('FREIGHT LIFT CALLED. ETA 9 SEC.', AMB);
      return;
    }
    this.say(`UNKNOWN COMMAND: ${c0}  (TRY HELP)`, BAD);
  }

  // ------------------------------------------------------------------ drawing
  update(dt) {
    this.blink += dt;
    // scope runs at 100 columns/s
    this.scopeAcc += dt * 100;
    const now = performance.now() / 1000;
    while (this.scopeAcc >= 1) {
      this.scopeAcc -= 1;
      this.scope.copyWithin(0, 1);
      let v = (Math.random() - 0.5) * 0.05 + Math.sin(now * 9) * 0.01;
      for (const ev of this.scopeEvents) {
        const tau = now - ev.t;
        if (tau >= 0 && tau < 1.2) v += SIG[ev.sig] ? SIG[ev.sig](tau) * ev.amp : 0;
      }
      this.scope[this.scope.length - 1] = v;
    }
    this.scopeEvents = this.scopeEvents.filter((e) => now - e.t < 1.3);
    const s = this.world.state;
    if (s !== this.lastState) { this.lastState = s; this.dirty = true; }
    if (this.prog === 'acoustic' || this.prog === 'sensors' || this.prog === 'sys' || this.prog === 'override') this.dirty = true;
    if (this.dirty) { this.draw(); this.dirty = false; this.tex.needsUpdate = true; }
  }

  text(t, x, y, color = G, size = 22, align = 'left') {
    const c = this.ctx;
    c.font = `700 ${size}px "Menlo", "Consolas", "Courier New", monospace`;
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(t, x, y);
  }

  draw() {
    const c = this.ctx, s = this.world.state, now = this.net.serverNow();
    c.fillStyle = '#041008'; c.fillRect(0, 0, W, H);
    // header
    c.fillStyle = GDD; c.fillRect(0, 0, W, 40);
    this.text('KESTREL-9 BMS · NODE 04', 20, 28, G, 22);
    const remain = s ? (s.phase === 'playing' ? s.limit - (now - s.startAt) : s.limit) : 0;
    this.text(s?.practice ? 'PRACTICE' : `T-${fmtTime(remain)}`, W - 20, 28, remain < 120000 && !s?.practice ? BAD : G, 22, 'right');
    if (s) {
      const n = s.strikes, max = s.maxStrikes;
      for (let i = 0; i < max; i++) { c.fillStyle = i < n ? BAD : GDD; c.fillRect(470 + i * 26, 12, 20, 16); }
    }
    // tabs
    PROGRAMS.forEach((p, i) => {
      const x = 20 + i * 164;
      const on = p.id === this.prog;
      c.fillStyle = on ? G : GDD; c.fillRect(x, 48, 156, 32);
      this.text(`${p.key} ${p.name}`, x + 78, 72, on ? '#041008' : G, 20, 'center');
    });
    c.strokeStyle = GD; c.lineWidth = 2; c.strokeRect(12, 92, W - 24, H - 196);
    const y0 = 124;
    c.save();
    c.beginPath(); c.rect(12, 92, W - 24, H - 196); c.clip();
    this[`draw_${this.prog}`](s, now, y0);
    c.restore();
    // output scrollback + command line
    const lines = this.out.slice(-3);
    lines.forEach((l, i) => this.text(l.text.slice(0, 84), 20, H - 84 + i * 20, l.color, 17));
    const cursor = this.blink % 1 < 0.5 ? '█' : ' ';
    c.fillStyle = GDD; c.fillRect(0, H - 14 - 26, W, 34);
    this.text(`LINE> ${this.input}${cursor}`, 20, H - 16, G, 24);
  }

  draw_sys(s, now, y) {
    if (!s) return;
    const obj = OBJECTIVES[s.objective];
    this.text(`OBJECTIVE: ${obj?.short || '-'}`, 32, y, AMB, 24);
    this.text(`ALERT LEVEL ${s.strikes}/${s.maxStrikes}`, 32, y + 34, s.strikes ? BAD : G, 20);
    this.text('CAMERAS (KEYS 1-0 ON MONITOR DESK):', 32, y + 76, GD, 18);
    CAMERAS.forEach((cam, i) => {
      this.text(`${String((i + 1) % 10)}  ${cam.id}  ${cam.label}${cam.ir ? '  [IR]' : ''}${cam.ptz ? '  [PTZ]' : ''}`, 44, y + 104 + i * 24, G, 17);
    });
    this.text('EVENT LOG', 600, y + 76, GD, 18);
    this.log.slice(-12).forEach((l, i) => this.text(l.text.slice(0, 34), 600, y + 104 + i * 24, l.color, 16));
  }

  draw_power(s, now, y) {
    const p = s?.patch;
    this.text('SUBSTATION 2 — PATCH FRAME BREAKER', 32, y, AMB, 24);
    this.text('FRAME ID:  READ FROM PLATE ON SITE (NOT REPORTED OVER LINK)', 32, y + 44, GD, 18);
    const on = p?.power;
    this.text(`BREAKER:   ${on ? 'CLOSED — ONLINE' : 'OPEN'}`, 32, y + 90, on ? G : AMB, 28);
    if (!on) {
      this.text("TYPE 'BREAKER' + ENTER TO ENGAGE.", 32, y + 140, G, 20);
      this.text('A WRONG PATCH TRIPS THE BREAKER (ALARM) AND REPORTS', 32, y + 170, GD, 18);
      this.text('HOW MANY OF THE 3 CIRCUITS FAULTED.', 32, y + 194, GD, 18);
      if (p && p.fault > 0) this.text(`LAST ATTEMPT: ${p.fault} OF 3 CIRCUITS FAULTED`, 32, y + 250, BAD, 24);
      const plugs = p ? Object.keys(p.plugs).length : 0;
      this.text(`FRAME CONTINUITY: ${plugs} / 6 PLUGS SEATED`, 32, y + 300, plugs === 6 ? G : AMB, 20);
    } else this.text('BULKHEAD C RELEASED. UNDERCROFT VENTILATION ON MAINS.', 32, y + 140, G, 20);
  }

  draw_vent(s, now, y) {
    const m = this.world.mission.maze;
    const d = s?.maze?.dampers || {};
    const open = Object.values(d).filter(Boolean).length;
    this.text('UNDERCROFT VENTILATION — MOTORISED DAMPERS', 32, y, AMB, 24);
    if (!s?.patch?.power) { this.text('NO POWER — RESTORE SUBSTATION FIRST', 32, y + 60, BAD, 24); return; }
    this.text(`POWER BUDGET: ${open} / ${m.budget} OPEN`, 32, y + 44, open >= m.budget ? AMB : G, 22);
    ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].forEach((id, i) => {
      const o = d[id];
      const yy = y + 100 + i * 52;
      this.ctx.fillStyle = o ? G : GDD; this.ctx.fillRect(40, yy - 28, 36, 36);
      this.text(`${i + 1}`, 58, yy - 2, o ? '#041008' : G, 24, 'center');
      this.text(`${id}`, 100, yy, G, 28);
      this.text(o ? 'OPEN' : 'CLOSED', 200, yy, o ? G : GD, 28);
    });
    this.text('KEY 1-6 TOGGLES A DAMPER.  OPEN D3 / CLOSE D3 ALSO WORK.', 32, y + 430, GD, 18);
    this.text('DAMPER LOCATIONS: SEE DRAWING M-1.', 32, y + 456, GD, 18);
  }

  draw_sensors(s, now, y) {
    this.text('UNDERCROFT — PASSIVE MOTION SENSORS', 32, y, AMB, 24);
    if (!s?.patch?.power) { this.text('NO POWER — SENSOR BUS DOWN', 32, y + 60, BAD, 24); return; }
    const list = Object.entries(s.maze.sensors || {}).map(([id, t]) => [id, (now - t) / 1000]).filter(([, a]) => a < 12).sort((a, b) => a[1] - b[1]);
    this.text(list.filter(([, a]) => a < 1.5).length ? `ACTIVE CONTACTS: ${list.filter(([, a]) => a < 1.5).length}` : 'NO ACTIVE CONTACTS', 32, y + 44, G, 22);
    list.slice(0, 10).forEach(([id, age], i) => {
      const yy = y + 100 + i * 40;
      const fresh = Math.max(0, 1 - age / 6);
      this.ctx.fillStyle = `rgba(125,255,154,${0.15 + fresh * 0.85})`;
      this.ctx.fillRect(170, yy - 22, 340 * fresh + 4, 26);
      this.text(id, 40, yy, age < 1.5 ? G : GD, 26);
      this.text(age < 1.5 ? 'MOTION' : `${age.toFixed(0)}s AGO`, 540, yy, age < 1.5 ? AMB : GD, 20);
    });
    this.text('SENSOR POSITIONS: SEE DRAWING M-1. CANNOT TELL WHO IS WHO.', 32, y + 520, GD, 18);
  }

  draw_acoustic(s, now, y) {
    const c = this.ctx;
    this.text('VAULT DOOR — CONTACT MICROPHONE  (GAIN 40dB)', 32, y, AMB, 24);
    const x0 = 32, w = W - 64, top = y + 30, h = 400, mid = top + h / 2;
    c.strokeStyle = GDD; c.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(x0 + (w * i) / 10, top); c.lineTo(x0 + (w * i) / 10, top + h); c.stroke(); }
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(x0, top + (h * i) / 8); c.lineTo(x0 + w, top + (h * i) / 8); c.stroke(); }
    c.strokeStyle = G; c.lineWidth = 3;
    c.beginPath();
    const n = this.scope.length;
    for (let i = 0; i < n; i++) {
      const px = x0 + (i / (n - 1)) * w, py = mid - this.scope[i] * h * 0.45;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    this.text('-7s', x0, top + h + 22, GD, 16);
    this.text('NOW', x0 + w, top + h + 22, GD, 16, 'right');
    const v = s?.vault;
    this.text(v?.open ? 'BOLTWORK RETRACTED' : 'LISTENING …  SIGNATURE KEY: DRAWING V-1', 32, top + h + 56, v?.open ? G : GD, 18);
  }

  draw_override(s, now, y) {
    this.text('SERVICE SPINE — LOCKDOWN BULKHEADS', 32, y, AMB, 24);
    if (!s?.lockdown?.active) { this.text('NO LOCKDOWN IN EFFECT.', 32, y + 60, GD, 24); this.text('(BULKHEADS ARM WHEN THE VAULT IS BREACHED)', 32, y + 92, GD, 18); return; }
    const left = s.escapeEnd - now;
    this.text(`SUPPRESSION PURGE IN ${fmtTime(left)}`, 32, y + 44, (now / 400) % 2 < 1 ? BAD : '#7a2a20', 28);
    ['L1', 'L2', 'L3'].forEach((id, i) => {
      const o = s.doors[id];
      this.text(`${id}`, 40, y + 120 + i * 56, G, 32);
      this.text(o ? 'OPEN' : 'SEALED — AWAITING 4-DIGIT RESPONSE', 120, y + 120 + i * 56, o ? G : AMB, 24);
    });
    this.text('TYPE:  L1 ####   (CHALLENGE IS SHOWN ON THE BULKHEAD ITSELF)', 32, y + 310, G, 18);
    const lift = s.lockdown.lift;
    const liftTxt = lift === 'idle' ? (s.doors.L3 ? "IDLE — TYPE 'LIFT'" : 'INHIBITED') : lift === 'called' ? `ARRIVING ${Math.max(0, (s.lockdown.liftAt - now) / 1000).toFixed(0)}s` : 'AT LEVEL — DOORS OPEN';
    this.text(`FREIGHT LIFT: ${liftTxt}`, 32, y + 370, lift === 'arrived' ? G : AMB, 24);
  }
}
