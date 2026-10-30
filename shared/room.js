// Authoritative game room. Runs inside the Node server, or inside the browser for local/solo play.
// Holds the discrete puzzle state, alert level, timers and the Listener simulation; GHOST's client
// is authoritative only for its own movement (pose messages).

import { generateMission, activeBeams, mazeNeighbors } from './mission.js';
import { MAZE, cellCenter, cellAt, zoneOf, OPTICS, BULKHEADS, ZONE_ORDER } from './layout.js';
import { traceBeams } from './optics-sim.js';
import { randomSeed } from './rng.js';

export const ROLES = ['agent', 'handler'];

const freshZones = (m) => ({
  doors: { A: 0, C: 0, E: 0, V: 0, H: 0, L1: 0, L2: 0, L3: 0, LIFT: 0 },
  gate: { entry: '', status: 'idle', at: 0 },
  lasers: { checkpoint: 0, cleared: 0 },
  patch: { plugs: {}, power: 0, fault: -1, at: 0 },
  maze: {
    dampers: Object.fromEntries(m.maze.dampers.map((d) => [d.id, 0])),
    creature: { ...cellCenter(...m.maze.lair), yaw: 0, mode: 'idle' },
    sensors: {},
    cleared: 0,
  },
  optics: { orient: m.optics.init.slice(), lit: [0, 0], done: 0 },
  vault: { dial: m.vault.start, stage: 0, open: 0, taken: 0 },
  lockdown: { active: 0, lift: 'idle', liftAt: 0, checkpoint: 'H' },
});

export class Room {
  constructor({ code, send, now = () => Date.now(), seed, difficulty = 'operative' }) {
    this.code = code;
    this.send = send; // (target: 'all'|'agent'|'handler', msg)
    this.now = now;
    this.players = { agent: null, handler: null };
    this.pose = null;
    this.lastHazard = 0;
    this.lastTrip = 0;
    this.setup(seed || randomSeed(), difficulty);
    this.state.phase = 'lobby';
  }

  setup(seed, difficulty) {
    this.mission = generateMission(seed, difficulty);
    const keepPlayers = this.state?.players;
    this.state = {
      code: this.code,
      phase: 'lobby',
      seed,
      difficulty,
      startAt: 0,
      limit: this.mission.diff.time * 1000,
      escapeEnd: 0,
      strikes: 0,
      maxStrikes: this.mission.diff.strikes,
      practice: null,
      players: keepPlayers || { agent: null, handler: null },
      objective: 'gate',
      result: null,
      ...freshZones(this.mission),
    };
    this.creatureAI = { path: [], last: null, heardAt: 0, idleUntil: this.now() + 4000, prev: null };
  }

  // ---------------------------------------------------------------- players
  join(role, name, conn) {
    if (!ROLES.includes(role)) return false;
    if (this.players[role] && this.players[role] !== conn) return false;
    this.players[role] = conn;
    this.state.players[role] = { name: (name || role).slice(0, 18), connected: true, ready: false };
    this.broadcast();
    return true;
  }
  leave(conn) {
    for (const r of ROLES) if (this.players[r] === conn) {
      this.players[r] = null;
      if (this.state.players[r]) this.state.players[r].connected = false;
    }
    this.broadcast();
  }
  roleOf(conn) { return ROLES.find((r) => this.players[r] === conn) || null; }
  empty() { return !this.players.agent && !this.players.handler; }

  // ---------------------------------------------------------------- outbound
  snapshot() { return { t: 'state', s: this.state, now: this.now() }; }
  broadcast() { this.dirty = true; }
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.send('all', this.snapshot());
  }
  event(e, target = 'all') { this.send(target, { t: 'ev', e, now: this.now() }); }

  // ---------------------------------------------------------------- lifecycle
  start({ seed, difficulty, practice } = {}) {
    this.setup(seed || this.state.seed, difficulty || this.state.difficulty);
    const s = this.state;
    s.phase = 'playing';
    s.startAt = this.now();
    s.practice = practice || null;
    if (practice && practice !== 'gate') this.skipTo(practice);
    this.pose = null;
    this.broadcast();
    this.event({ k: 'start', practice: s.practice });
  }

  skipTo(zone) {
    const s = this.state;
    const idx = ZONE_ORDER.indexOf(zone);
    if (idx > 0) s.doors.A = 1;
    if (idx > 1) s.lasers.cleared = 1;
    if (idx > 2) { s.patch.power = 1; s.doors.C = 1; }
    if (idx > 3) s.maze.cleared = 1;
    if (idx > 4) { s.optics.done = 1; s.doors.E = 1; s.optics.lit = [1, 1]; }
    if (idx > 5) this.triggerLockdown(true);
    s.objective = zone;
  }

  end(win, reason) {
    const s = this.state;
    if (s.phase !== 'playing') return;
    s.phase = win ? 'won' : 'lost';
    s.result = { win, reason, elapsed: this.now() - s.startAt, strikes: s.strikes, practice: s.practice };
    this.broadcast();
    this.event({ k: win ? 'win' : 'lose', reason });
  }

  strike(reason, extra = {}) {
    const s = this.state;
    if (s.phase !== 'playing') return;
    s.strikes++;
    this.broadcast();
    this.event({ k: 'strike', reason, n: s.strikes, ...extra });
    if (s.strikes >= s.maxStrikes) this.end(false, 'ALERT LEVEL CRITICAL — FACILITY LOCKED DOWN');
  }

  teleport(x, z, yaw) { this.event({ k: 'teleport', x, z, yaw }, 'agent'); }

  // ---------------------------------------------------------------- messages
  handle(conn, msg) {
    const role = this.roleOf(conn);
    if (!role) return;
    const s = this.state;
    switch (msg.t) {
      case 'ready':
        if (s.players[role]) s.players[role].ready = !!msg.v;
        this.broadcast();
        return;
      case 'settings':
        if (s.phase !== 'lobby') return;
        if (msg.difficulty) this.setup(s.seed, msg.difficulty);
        this.broadcast();
        return;
      case 'start':
        if (s.phase === 'playing') return;
        this.start({ difficulty: msg.difficulty || s.difficulty, practice: msg.practice, seed: msg.seed || (s.phase === 'lobby' ? s.seed : randomSeed()) });
        return;
      case 'lobby':
        this.setup(randomSeed(), s.difficulty);
        this.broadcast();
        return;
      case 'pose':
        if (role === 'agent') this.onPose(msg.p);
        this.send('handler', msg);
        return;
      case 'rtc':
        this.send(role === 'agent' ? 'handler' : 'agent', msg);
        return;
      case 'act':
        if (s.phase !== 'playing') return;
        this.act(role, msg.a || {});
        return;
      case 'ping':
        this.send(role, { t: 'pong', c: msg.c, s: this.now() });
        return;
    }
  }

  onPose(p) {
    if (!Array.isArray(p)) return;
    const [x, y, z, yaw, pitch, flags] = p;
    this.pose = { x, y, z, yaw, flags, at: this.now() };
    const s = this.state;
    if (s.phase !== 'playing') return;
    if (!s.lasers.cleared && s.doors.A && z < -27.2) { s.lasers.cleared = 1; this.advance(); }
    if (!s.maze.cleared && s.patch.power && zoneOf(x, z) === 'optics') { s.maze.cleared = 1; this.advance(); }
  }

  advance() {
    const s = this.state;
    const done = {
      gate: s.doors.A, lasers: s.lasers.cleared, patch: s.patch.power, maze: s.maze.cleared,
      optics: s.optics.done, vault: s.vault.taken, escape: 0,
    };
    s.objective = ZONE_ORDER.find((z) => !done[z]) || 'escape';
    this.broadcast();
  }

  act(role, a) {
    const s = this.state, m = this.mission, now = this.now();
    const A = role === 'agent', H = role === 'handler';
    switch (a.k) {
      // ---- Z1 gate keypad (GHOST)
      case 'key': {
        if (!A || s.doors.A) return;
        const g = s.gate;
        if (a.v === 'CLR') g.entry = '';
        else if (a.v === 'ENT') {
          if (g.entry === m.gate.code) {
            s.doors.A = 1; g.status = 'ok';
            this.event({ k: 'sfx', name: 'granted', at: 'gate' });
            this.advance();
          } else {
            g.status = 'denied'; g.entry = '';
            this.strike('ACCESS DENIED', { zone: 'gate' });
          }
          g.at = now;
        } else if (/^[0-9]$/.test(a.v) && g.entry.length < 4) { g.entry += a.v; g.status = 'idle'; }
        this.broadcast();
        return;
      }
      // ---- Z2 lasers (GHOST reports trips; it knows its exact body)
      case 'trip': {
        if (!A || now - this.lastTrip < 2500) return;
        this.lastTrip = now;
        this.strike('LASER GRID BROKEN', { zone: 'lasers' });
        const z = s.lasers.checkpoint ? -12.9 : -1.6;
        this.teleport(0, z, 0);
        return;
      }
      case 'checkpoint': {
        if (!A) return;
        if (!s.lasers.checkpoint) { s.lasers.checkpoint = 1; this.broadcast(); }
        return;
      }
      // ---- Z3 patch frame
      case 'plug': {
        if (!A || s.patch.power) return;
        const key = `${a.color}${a.end}`;
        if (!['RED', 'GREEN', 'WHITE'].includes(a.color) || ![0, 1].includes(a.end)) return;
        if (a.socket != null) {
          if (!/^[TB][0-5]$/.test(a.socket)) return;
          if (Object.entries(s.patch.plugs).some(([k, v]) => v === a.socket && k !== key)) return;
          s.patch.plugs[key] = a.socket;
        } else delete s.patch.plugs[key];
        this.broadcast();
        return;
      }
      case 'breaker': {
        if (!H || s.patch.power || now - s.patch.at < 3000) return;
        s.patch.at = now;
        const P = m.patch;
        let ok = 0;
        for (const sol of P.solution) {
          const t = `T${P.topOrder.indexOf(sol.glyph)}`, b = `B${P.bottomOrder.indexOf(sol.number)}`;
          const e0 = s.patch.plugs[`${sol.color}0`], e1 = s.patch.plugs[`${sol.color}1`];
          if ((e0 === t && e1 === b) || (e0 === b && e1 === t)) ok++;
        }
        if (ok === 3) {
          s.patch.power = 1; s.patch.fault = 0; s.doors.C = 1;
          this.event({ k: 'sfx', name: 'power', at: 'patch' });
          this.advance();
        } else {
          s.patch.fault = 3 - ok;
          this.event({ k: 'spark', at: 'patch' });
          this.strike('BREAKER TRIPPED — PATCH FAULT', { zone: 'patch' });
        }
        this.broadcast();
        return;
      }
      // ---- Z4 dampers (LINE)
      case 'damper': {
        if (!H) return;
        const d = s.maze.dampers;
        if (!(a.id in d)) return;
        if (a.open) {
          const openCount = Object.values(d).filter(Boolean).length;
          if (!d[a.id] && openCount >= m.maze.budget) {
            this.event({ k: 'deny', what: 'damper', id: a.id }, 'handler');
            return;
          }
          d[a.id] = 1;
        } else d[a.id] = 0;
        this.event({ k: 'sfx', name: 'damper', id: a.id });
        this.broadcast();
        return;
      }
      // ---- Z5 optics (GHOST rotates)
      case 'rotate': {
        if (!A || s.optics.done) return;
        const i = a.m | 0;
        if (i < 0 || i >= m.optics.mirrors.length) return;
        s.optics.orient[i] = (s.optics.orient[i] + (a.d > 0 ? 1 : 7)) % 8;
        const tr = traceBeams(m.optics, s.optics.orient);
        s.optics.lit = tr.lit.map((v) => (v ? 1 : 0));
        if (tr.lit.every(Boolean)) {
          s.optics.done = 1; s.doors.E = 1;
          this.event({ k: 'sfx', name: 'optics', at: 'optics' });
          this.advance();
        }
        this.broadcast();
        return;
      }
      // ---- Z6 vault (GHOST dials, LINE reads the scope)
      case 'dial': {
        if (!A || s.vault.open) return;
        const v = s.vault, V = m.vault;
        const d = a.d > 0 ? 1 : -1;
        v.dial = (v.dial + d + 100) % 100;
        let sig = 'tick';
        if (v.stage < 3) {
          const req = V.models[V.modelIdx].dirs[v.stage] === 'L' ? 1 : -1;
          if (d === req) {
            if (v.dial === V.combo[v.stage]) sig = V.models[V.modelIdx].trueSig;
            else {
              const di = V.decoys[v.stage].indexOf(v.dial);
              if (di >= 0) sig = V.decoySigs[v.stage][di];
            }
          }
        }
        this.event({ k: 'acoustic', sig }, 'handler');
        this.event({ k: 'dial' }, 'agent');
        this.broadcast();
        return;
      }
      case 'set': {
        if (!A || s.vault.open) return;
        const v = s.vault;
        if (v.stage >= 3) return;
        if (v.dial === m.vault.combo[v.stage]) { v.stage++; this.event({ k: 'acoustic', sig: 'pickup' }, 'handler'); }
        else { v.stage = 0; this.event({ k: 'acoustic', sig: 'slip' }, 'handler'); }
        this.event({ k: 'sfx', name: 'clunk' });
        this.broadcast();
        return;
      }
      case 'handle': {
        if (!A || s.vault.open) return;
        if (s.vault.stage >= 3) {
          s.vault.open = 1; s.doors.V = 1;
          this.event({ k: 'sfx', name: 'vault', at: 'vault' });
        } else this.strike('VAULT TAMPER ALARM', { zone: 'vault' });
        this.broadcast();
        return;
      }
      case 'take': {
        if (!A || !s.vault.open || s.vault.taken) return;
        this.triggerLockdown(false);
        return;
      }
      // ---- Z7 lockdown
      case 'override': {
        if (!H || !s.lockdown.active) return;
        const door = m.lockdown.doors.find((d) => d.id === a.door);
        if (!door || s.doors[door.id]) return;
        if (String(a.code) === door.response) {
          s.doors[door.id] = 1;
          s.lockdown.checkpoint = door.id;
          this.event({ k: 'sfx', name: 'override', id: door.id });
        } else this.strike(`OVERRIDE ${door.id} REJECTED`, { zone: 'escape' });
        this.broadcast();
        return;
      }
      case 'lift': {
        if (!H || !s.doors.L3 || s.lockdown.lift !== 'idle') return;
        s.lockdown.lift = 'called';
        s.lockdown.liftAt = now + 9000;
        this.event({ k: 'sfx', name: 'lift' });
        this.broadcast();
        return;
      }
      case 'hazard': {
        if (!A || now - this.lastHazard < 2500) return;
        this.lastHazard = now;
        if (a.kind === 'pit') {
          this.strike('GHOST FELL — SPINE COLLAPSE', { zone: 'escape' });
          const cp = s.lockdown.checkpoint;
          const p = cp === 'H' ? { x: -7, z: -65, yaw: -Math.PI / 2 } : cp === 'L1' ? { x: 4.5, z: -65, yaw: -Math.PI / 2 } : cp === 'L2' ? { x: 12, z: -48.5, yaw: Math.PI } : { x: 12, z: -36.5, yaw: Math.PI };
          this.teleport(p.x, p.z, p.yaw);
        } else if (a.kind === 'cable') this.strike('ELECTROCUTION — LIVE CABLE', { zone: 'escape' });
        return;
      }
      case 'extract': {
        if (!A || s.lockdown.lift !== 'arrived') return;
        this.end(true, 'EXTRACTION COMPLETE');
        return;
      }
    }
  }

  triggerLockdown(practice) {
    const s = this.state;
    s.vault.open = 1; s.vault.taken = 1; s.vault.stage = 3;
    s.doors.V = 0; s.doors.E = 0; s.doors.H = 1;
    s.lockdown.active = 1;
    s.escapeEnd = this.now() + this.mission.diff.escape * 1000;
    if (!practice) this.event({ k: 'lockdown' });
    this.advance();
    this.broadcast();
  }

  // ---------------------------------------------------------------- simulation (10 Hz)
  tick() {
    const s = this.state, now = this.now();
    if (s.phase === 'playing') {
      if (!s.practice && now - s.startAt > s.limit) this.end(false, 'MISSION CLOCK EXPIRED');
      if (s.lockdown.active && now > s.escapeEnd) this.end(false, 'TRAPPED IN LOCKDOWN');
      if (s.lockdown.lift === 'called' && now >= s.lockdown.liftAt) {
        s.lockdown.lift = 'arrived'; s.doors.LIFT = 1;
        this.event({ k: 'sfx', name: 'liftArrive' });
        this.broadcast();
      }
      if (s.patch.power && !s.maze.cleared) this.tickCreature(0.1);
    }
    this.flush();
  }

  tickCreature(dt) {
    const s = this.state, m = this.mission, now = this.now();
    const c = s.maze.creature, ai = this.creatureAI;
    const speedMul = m.diff.creature;
    const dampers = s.maze.dampers;
    const ccell = cellAt(c.x, c.z) || m.maze.lair;
    const pose = this.pose && now - this.pose.at < 1500 ? this.pose : null;
    const acell = pose ? cellAt(pose.x, pose.z) : null;

    // sensors
    const trip = (cell) => {
      const id = m.maze.sensors[cell.join()];
      if (id) s.maze.sensors[id] = now;
    };
    if (c.mode !== 'idle') trip(ccell);
    if (acell && pose && pose.flags & 8) trip(acell);

    if (now < ai.idleUntil) { c.mode = 'idle'; this.broadcast(); return; }

    // hearing (path distance through open passages)
    let heard = false;
    if (acell && pose) {
      const flags = pose.flags;
      const moving = flags & 8, sprint = flags & 4, crouch = flags & 1;
      const radius = sprint ? 14 : moving && !crouch ? 6.5 : 0;
      const direct = Math.hypot(pose.x - c.x, pose.z - c.z);
      const path = this.mazePath(ccell, acell, dampers);
      const pd = path ? path.length * MAZE.cell : Infinity;
      if ((radius > 0 && pd <= radius + MAZE.cell * 0.5) || direct < 1.7) {
        heard = true;
        ai.heardAt = now;
        ai.target = acell;
      }
      if (path && direct < 1.05 && pd <= MAZE.cell) {
        this.strike('THE LISTENER GOT GHOST', { zone: 'maze' });
        const e = cellCenter(...MAZE.entrance);
        this.teleport(e.x + 0.6, e.z, -Math.PI / 2);
        const l = cellCenter(...m.maze.lair);
        c.x = l.x; c.z = l.z; c.mode = 'idle';
        ai.idleUntil = now + 9000; ai.path = []; ai.target = null;
        this.event({ k: 'sfx', name: 'caught' });
        this.broadcast();
        return;
      }
    }
    const hunting = ai.target && now - ai.heardAt < 5000;
    c.mode = hunting ? 'hunt' : 'wander';
    const speed = (hunting ? 3.0 : 1.05) * speedMul;

    let goal;
    if (hunting && acell && acell[0] === ccell[0] && acell[1] === ccell[1] && pose) {
      goal = { x: pose.x, z: pose.z };
    } else {
      if (hunting) ai.path = this.mazePath(ccell, ai.target, dampers) || [];
      if (!ai.path.length) {
        const nb = mazeNeighbors(m.maze, ccell[0], ccell[1], dampers).filter(([nc, nr]) => !(ai.prev && ai.prev[0] === nc && ai.prev[1] === nr));
        const all = nb.length ? nb : mazeNeighbors(m.maze, ccell[0], ccell[1], dampers);
        if (all.length) {
          const [nc, nr] = all[Math.floor(Math.random() * all.length)];
          ai.path = [[nc, nr]];
        }
      }
      const next = ai.path[0];
      if (next && !this.passable(ccell, next, dampers)) ai.path = [];
      goal = next ? cellCenter(next[0], next[1]) : cellCenter(ccell[0], ccell[1]);
    }
    const dx = goal.x - c.x, dz = goal.z - c.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const step = Math.min(dist, speed * dt);
      c.x += (dx / dist) * step;
      c.z += (dz / dist) * step;
      c.yaw = Math.atan2(-dx, -dz);
    } else if (ai.path.length) {
      ai.prev = ccell;
      ai.path.shift();
      if (!hunting && Math.random() < 0.18) ai.idleUntil = now + 1500 + Math.random() * 2500;
    }
    this.broadcast();
  }

  passable(a, b, dampers) {
    const dir = b[0] > a[0] ? 'E' : b[0] < a[0] ? 'W' : b[1] > a[1] ? 'S' : 'N';
    return mazeNeighbors(this.mission.maze, a[0], a[1], dampers).some(([c, r, d]) => d === dir && c === b[0] && r === b[1]);
  }

  mazePath(from, to, dampers) {
    if (!from || !to) return null;
    const k = (c) => c.join();
    const prev = new Map([[k(from), null]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur[0] === to[0] && cur[1] === to[1]) {
        const path = [];
        let n = cur;
        while (n && k(n) !== k(from)) { path.unshift(n); n = prev.get(k(n)); }
        return path;
      }
      for (const [nc, nr] of mazeNeighbors(this.mission.maze, cur[0], cur[1], dampers)) {
        const nk = `${nc},${nr}`;
        if (!prev.has(nk)) { prev.set(nk, cur); q.push([nc, nr]); }
      }
    }
    return null;
  }
}

export { OPTICS, BULKHEADS, activeBeams };
