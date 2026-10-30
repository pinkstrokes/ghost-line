// GHOST LINE server: static files + WebSocket rooms. No external services.
//   http://localhost:8080        (this machine)
//   https://<lan-ip>:8443        (other machines on the LAN; self-signed cert, needed for the microphone)

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room, ROLES } from '../shared/room.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const DEV = process.argv.includes('--dev');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// ICE servers for voice. LAN needs none; across the internet set TURN_URLS + TURN_SECRET
// (coturn `use-auth-secret`), and each client gets short-lived credentials.
function iceConfig() {
  const urls = (process.env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!urls.length || !process.env.TURN_SECRET) return { iceServers: [] };
  const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:ghostline`;
  const credential = crypto.createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
  return { iceServers: [{ urls, username, credential }] };
}

function serveStatic(req, res) {
  if (req.url === '/config') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(iceConfig())); return; }
  if (DEV) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('GHOST LINE dev server: open the Vite URL instead.'); return; }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (!fs.existsSync(DIST)) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('Run `npm run build` first (or `npm start`).'); return; }
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': p.startsWith('/assets/') ? 'max-age=31536000' : 'no-cache' });
    res.end(data);
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

function ensureCert() {
  const dir = path.join(ROOT, '.certs');
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  if (fs.existsSync(key) && fs.existsSync(cert)) return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  try {
    fs.mkdirSync(dir, { recursive: true });
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanAddresses().map((a) => `IP:${a}`)].join(',');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '825', '-subj', '/CN=ghost-line.local', '-addext', `subjectAltName=${san}`], { stdio: 'ignore' });
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  } catch (e) {
    console.warn('[ghost-line] could not create a self-signed certificate (openssl missing?) — LAN voice needs https.');
    return null;
  }
}

// ---------------------------------------------------------------- rooms
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

function makeRoom(difficulty) {
  const code = newCode();
  const entry = { conns: new Set(), lastActive: Date.now() };
  entry.room = new Room({
    code,
    difficulty,
    send: (target, msg) => {
      const data = JSON.stringify(msg);
      for (const c of entry.conns) {
        if (c.readyState !== 1) continue;
        if (target === 'all' || entry.room.roleOf(c) === target) c.send(data);
      }
    },
  });
  rooms.set(code, entry);
  return entry;
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  // heartbeat: a socket that stops answering pings is dropped so its seat frees up
  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* */ }
    }
  }, 8000);
  wss.on('close', () => clearInterval(beat));
  wss.on('connection', (ws) => {
    let entry = null;
    ws.isAlive = true;
    ws.lastSeen = Date.now();
    ws.on('pong', () => { ws.isAlive = true; });
    const reply = (msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
    ws.on('message', (buf) => {
      let msg;
      ws.lastSeen = Date.now();
      try { msg = JSON.parse(buf); } catch { return; }
      if (msg.t === 'create' || msg.t === 'join') {
        if (entry) { entry.room.leave(ws); entry.conns.delete(ws); }
        const target = msg.t === 'create' ? makeRoom(msg.difficulty) : rooms.get(String(msg.code || '').toUpperCase());
        if (!target) { reply({ t: 'error', m: 'NO SUCH OPERATION CODE' }); return; }
        let role = ROLES.includes(msg.role) ? msg.role : null;
        // rejoining your own seat: evict a connection that has gone quiet (clients ping every 2 s)
        const holder = role && target.room.players[role];
        if (holder && holder !== ws && Date.now() - (holder.lastSeen || 0) > 6000) {
          target.room.leave(holder); target.conns.delete(holder);
          try { holder.terminate(); } catch { /* */ }
        }
        const free = ROLES.filter((r) => !target.room.players[r]);
        if (!role || target.room.players[role]) role = free[0] || null;
        if (!role) { reply({ t: 'error', m: 'BOTH SEATS ARE TAKEN' }); return; }
        entry = target;
        entry.conns.add(ws);
        entry.room.join(role, msg.name, ws);
        reply({ t: 'joined', code: entry.room.code, role, pose: role === 'agent' && entry.room.state.phase === 'playing' ? entry.room.pose : null });
        reply(entry.room.snapshot());
        entry.room.flush();
        return;
      }
      if (msg.t === 'swap' && entry) {
        const r = entry.room;
        const mine = r.roleOf(ws), other = mine === 'agent' ? 'handler' : 'agent';
        if (r.state.phase === 'playing') return;
        if (r.players[other]) {
          const otherConn = r.players[other];
          const myInfo = r.state.players[mine], otherInfo = r.state.players[other];
          r.players[mine] = otherConn; r.players[other] = ws;
          r.state.players[mine] = otherInfo; r.state.players[other] = myInfo;
          if (otherConn && otherConn.readyState === 1) otherConn.send(JSON.stringify({ t: 'joined', code: r.code, role: mine }));
        } else {
          r.players[mine] = null; r.state.players[mine] = null;
          r.players[other] = ws; r.state.players[other] = { name: msg.name || other, connected: true, ready: false };
        }
        reply({ t: 'joined', code: r.code, role: r.roleOf(ws) });
        r.broadcast(); r.flush();
        return;
      }
      if (!entry) return;
      entry.lastActive = Date.now();
      entry.room.handle(ws, msg);
      if (msg.t !== 'pose' && msg.t !== 'rtc' && msg.t !== 'ping') entry.room.flush();
    });
    ws.on('close', () => {
      if (!entry) return;
      entry.room.leave(ws);
      entry.conns.delete(ws);
      entry.room.flush();
    });
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [code, e] of rooms) {
    e.room.tick();
    if (e.room.empty() && now - e.lastActive > 15 * 60 * 1000) rooms.delete(code);
  }
}, 100);

const httpServer = http.createServer(serveStatic);
attach(httpServer);
httpServer.listen(PORT, () => {
  console.log(`\n  GHOST LINE ${DEV ? '(dev websocket)' : ''}`);
  console.log(`  this machine:  http://localhost:${PORT}`);
});

const cert = ensureCert();
if (cert && !DEV) {
  const httpsServer = https.createServer(cert, serveStatic);
  attach(httpsServer);
  httpsServer.listen(HTTPS_PORT, () => {
    for (const a of lanAddresses()) console.log(`  LAN partner:   https://${a}:${HTTPS_PORT}   (accept the certificate warning once)`);
    console.log('');
  });
}
