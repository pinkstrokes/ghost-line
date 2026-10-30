import { Room } from '../../shared/room.js';

// Thin message bus with server-clock estimation. Same interface for the WebSocket
// connection and for a Room running inside this tab (solo / practice).

class Bus {
  constructor() { this.handlers = {}; this.offset = 0; this.bestRtt = Infinity; }
  on(t, fn) { (this.handlers[t] ||= []).push(fn); return () => (this.handlers[t] = this.handlers[t].filter((f) => f !== fn)); }
  emit(msg) { for (const fn of this.handlers[msg.t] || []) fn(msg); for (const fn of this.handlers['*'] || []) fn(msg); }
  serverNow() { return Date.now() + this.offset; }
  noteServerTime(s, rtt) {
    if (rtt <= this.bestRtt * 1.5 || !isFinite(this.bestRtt)) {
      this.bestRtt = Math.min(this.bestRtt, rtt);
      const est = s + rtt / 2 - Date.now();
      this.offset = isFinite(this.offsetSet) ? this.offset * 0.7 + est * 0.3 : est;
      this.offsetSet = 1;
    }
  }
}

export class WsNet extends Bus {
  connect(url) {
    return new Promise((resolve, reject) => {
      const ws = (this.ws = new WebSocket(url));
      ws.onopen = () => {
        this.pinger = setInterval(() => this.send({ t: 'ping', c: Date.now() }), 2000);
        this.send({ t: 'ping', c: Date.now() });
        resolve();
      };
      ws.onerror = () => reject(new Error('CONNECTION FAILED'));
      ws.onclose = () => { clearInterval(this.pinger); this.emit({ t: 'closed' }); };
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.t === 'pong') this.noteServerTime(msg.s, Date.now() - msg.c);
        else if (msg.t === 'state' && msg.now && !isFinite(this.bestRtt)) this.offset = msg.now - Date.now();
        this.emit(msg);
      };
    });
  }
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  close() { this.ws?.close(); }
}

// In-tab room. `extra` connections let the debug API act as the missing partner.
export class LocalNet extends Bus {
  constructor({ difficulty, role, name }) {
    super();
    this.offset = 0;
    this.conns = { agent: { id: 'agent' }, handler: { id: 'handler' } };
    this.role = role;
    this.room = new Room({
      code: 'SOLO',
      difficulty,
      send: (target, msg) => {
        if (target === 'all' || target === this.role) queueMicrotask(() => this.emit(JSON.parse(JSON.stringify(msg))));
      },
    });
    this.room.join(role, name, this.conns[role]);
    this.timer = setInterval(() => this.room.tick(), 100);
    queueMicrotask(() => {
      this.emit({ t: 'joined', code: 'SOLO', role });
      this.emit(this.room.snapshot());
    });
  }
  send(msg) {
    if (msg.t === 'ping') return;
    this.room.handle(this.conns[this.role], msg);
    this.room.flush();
  }
  // act as the absent partner (debug / solo helpers)
  partner(msg) {
    const other = this.role === 'agent' ? 'handler' : 'agent';
    if (!this.room.players[other]) this.room.join(other, 'PARTNER', this.conns[other]);
    this.room.handle(this.conns[other], msg);
    this.room.flush();
  }
  close() { clearInterval(this.timer); }
}
