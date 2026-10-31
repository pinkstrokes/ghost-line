import { Engine } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { WsNet, LocalNet } from './net/net.js';
import { Voice } from './net/voice.js';
Voice.loadConfig();
import { Hud } from './ui/hud.js';
import { sfx } from './audio/sfx.js';
import { generateMission } from '../shared/mission.js';
import { DIFFICULTY } from '../shared/layout.js';
import { fmtTime, ZONE_TITLES } from './ui/text.js';
import { TitleScene } from './ui/title-scene.js';

const $overlay = document.getElementById('overlay');
const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);

const SETTINGS_KEY = 'ghostline.settings';
const settings = Object.assign(
  { name: '', sens: 1, invert: false, fov: 72, pixel: 360, master: 0.9, voice: 1, ptt: 'hold', difficulty: 'operative' },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })(),
);
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ } };

const engine = new Engine(canvas);
engine.setTargetHeight(settings.pixel);
const input = new Input(canvas);
const hud = new Hud(document.getElementById('hud'));

// browsers only start audio after a user gesture (matters after an auto-rejoin on refresh)
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => sfx.init(), { passive: true });

const app = { net: null, role: null, code: null, state: null, game: null, voice: null, mission: null, missionKey: null };
window.__gl = app;

let titleScene = null;
const backdrop = () => { if (app.game) return; if (!titleScene) titleScene = new TitleScene(engine); titleScene.start(); };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const html = (s) => { $overlay.innerHTML = s; };
const on = (sel, ev, fn) => { const el = $overlay.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };

// ---------------------------------------------------------------- title
function titleScreen(err = '') {
  teardownGame();
  backdrop();
  html(`<div class="screen side"><div class="card">
    <h1 class="title">GHOST<br><span>LINE</span></h1>
    <p class="subtitle">Two-player voice co-op infiltration · one goes in, one watches from the van</p>
    <div class="col">
      <label>CALLSIGN</label>
      <input id="name" maxlength="16" placeholder="NAME" value="${esc(settings.name)}" />
      <button class="primary big" id="host">HOST OPERATION <small>open a room, give your partner the code</small></button>
      <div class="row"><input id="code" maxlength="4" placeholder="CODE" style="width:140px;text-transform:uppercase" />
      <button id="join" style="flex:1">JOIN</button></div>
      <button class="big" id="solo">SOLO WALKTHROUGH <small>look around alone — the other seat stays empty</small></button>
      <div class="row"><button id="howto" style="flex:1">HOW TO PLAY</button><button id="settings" style="flex:1">SETTINGS</button><button id="print" style="flex:1">PRINT BLUEPRINTS</button></div>
      <div class="err">${esc(err)}</div>
    </div></div></div>`);
  const name = () => { settings.name = $overlay.querySelector('#name').value.trim().toUpperCase().slice(0, 16) || 'ANON'; saveSettings(); return settings.name; };
  on('#host', 'click', () => connect({ t: 'create', name: name(), difficulty: settings.difficulty }));
  on('#join', 'click', () => {
    const code = $overlay.querySelector('#code').value.trim().toUpperCase();
    if (code.length !== 4) return titleScreen('An operation code is 4 letters.');
    connect({ t: 'join', code, name: name() });
  });
  on('#code', 'keydown', (e) => e.key === 'Enter' && $overlay.querySelector('#join').click());
  on('#solo', 'click', () => soloScreen(name()));
  on('#howto', 'click', () => howToScreen(() => titleScreen()));
  on('#settings', 'click', () => settingsScreen(() => titleScreen()));
  on('#print', 'click', () => window.open('/blueprint.html', '_blank'));
}

function soloScreen(name) {
  html(`<div class="screen"><div class="card">
    <h2 class="title" style="font-size:44px">SOLO</h2>
    <p class="hint">Solo is for learning the controls and the spaces. The mission itself needs two people: alone you are missing half the information and half the controls.</p>
    <div class="col" style="margin-top:16px">
      <button class="big primary" id="agent">PLAY AS GHOST <small>go into the facility</small></button>
      <button class="big" id="handler">PLAY AS LINE <small>sit in the van</small></button>
      <label style="margin-top:8px">START AT</label>
      <select id="zone"><option value="">FULL MISSION</option>${Object.entries(ZONE_TITLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <button id="back">BACK</button>
    </div></div></div>`);
  const go = (role) => {
    const practice = $overlay.querySelector('#zone').value || null;
    const net = new LocalNet({ difficulty: settings.difficulty, role, name });
    attachNet(net);
    setTimeout(() => net.send({ t: 'start', practice }), 30);
  };
  on('#agent', 'click', () => go('agent'));
  on('#handler', 'click', () => go('handler'));
  on('#back', 'click', () => titleScreen());
}

function howToScreen(back) {
  app.sub = true;
  html(`<div class="screen"><div class="card howto">
    <h2 class="title" style="font-size:40px">HOW TO PLAY</h2>
    <p>One of you is <b style="color:var(--ghost)">GHOST</b>, sneaking through the abandoned KESTREL-9 facility in first person. The other is <b style="color:var(--handler)">LINE</b>, sitting in a surveillance van two kilometres away with the original blueprints, tapped CCTV cameras and a terminal patched into the building's control system.</p>
    <p>GHOST sees every detail of every lock but has no idea how to open it. LINE knows how, and sees what GHOST can't — infra-red lasers, beams, thermal images, motion sensors — but can't touch anything. <b>Every room needs both of you talking.</b></p>
    <h4>TALKING</h4>
    <p>Hold <kbd>V</kbd> to key the radio (LINE can also hold <kbd>Option</kbd>/<kbd>Alt</kbd>, which works while typing in the terminal). Open mic is in Settings. Sitting in the same room or using Discord works just as well.</p>
    <h4>GHOST</h4>
    <p><kbd>WASD</kbd> move · <kbd>Mouse</kbd> look · <kbd>Shift</kbd> run (loud) · <kbd>C</kbd> crouch (silent) · <kbd>Space</kbd> jump · <kbd>F</kbd> torch · <kbd>E</kbd> inspect / use (mirrors: <kbd>E</kbd> clockwise, <kbd>Q</kbd> anticlockwise) · <kbd>Tab</kbd> check watch (time, alerts, objective) · <kbd>F1</kbd> key help</p>
    <h4>LINE</h4>
    <p><kbd>Mouse</kbd> look around the van, click a station to lean in, <kbd>Right-click</kbd>/<kbd>Esc</kbd> sit back. Shortcuts: <kbd>M</kbd> monitors · <kbd>T</kbd> terminal · <kbd>Tab</kbd> blueprints.<br>
    Monitors: <kbd>1</kbd>–<kbd>0</kbd> pick a camera, <kbd>I</kbd> infra-red / thermal, <kbd>Arrows</kbd> or drag to pan/tilt, <kbd>Wheel</kbd> zoom.<br>
    Blueprints: drag to pan, wheel to zoom, <kbd>Shift</kbd>+drag draws in red pencil, <kbd>X</kbd> clears this sheet, <kbd>1</kbd>–<kbd>7</kbd> change sheet.<br>
    Terminal: just type (<kbd>HELP</kbd> lists commands), <kbd>F1</kbd>–<kbd>F6</kbd> or <kbd>[</kbd> <kbd>]</kbd> switch programs. Override rotor: drag or <kbd>←</kbd><kbd>→</kbd> to turn the inner disc.</p>
    <p class="hint">If the mouse can't be captured (some embedded browsers), click-and-drag to look. Refreshing the page puts you back in your seat.</p>
    <h4>MISTAKES</h4>
    <p>Every mistake — a wrong code, a broken beam, getting caught — raises the alert level by one. Reach the limit and the facility locks down. Run out of time and it's over too.</p>
    <button id="back" style="margin-top:16px">BACK</button>
  </div></div>`);
  on('#back', 'click', () => { app.sub = false; back(); });
}

function settingsScreen(back) {
  const prevDiff = settings.difficulty;
  app.sub = true;
  html(`<div class="screen"><div class="card">
    <h2 class="title" style="font-size:40px">SETTINGS</h2>
    <div class="col" style="margin-top:14px">
      <label>MOUSE SENSITIVITY <span id="sv">${settings.sens.toFixed(2)}</span></label><input type="range" id="sens" min="0.2" max="3" step="0.05" value="${settings.sens}">
      <label><input type="checkbox" id="invert" ${settings.invert ? 'checked' : ''}> INVERT Y</label>
      <label>FIELD OF VIEW <span id="fv">${settings.fov}</span></label><input type="range" id="fov" min="60" max="95" step="1" value="${settings.fov}">
      <label>PIXEL SIZE</label>
      <select id="pixel"><option value="270">CHUNKY</option><option value="360">NORMAL</option><option value="480">FINE</option><option value="720">HD</option></select>
      <label>MASTER VOLUME</label><input type="range" id="master" min="0" max="1" step="0.05" value="${settings.master}">
      <label>RADIO VOLUME</label><input type="range" id="voice" min="0" max="2" step="0.05" value="${settings.voice}">
      <label>RADIO MODE</label>
      <select id="ptt"><option value="hold">Push to talk (hold V)</option><option value="open">Open mic</option><option value="off">No in-game voice (Discord / same room)</option></select>
      <label>DIFFICULTY</label>
      <select id="diff">${Object.values(DIFFICULTY).map((d) => `<option value="${d.key}">${d.label} — ${d.time / 60} min · ${d.strikes} alerts</option>`).join('')}</select>
      <button id="back">SAVE &amp; BACK</button>
    </div></div></div>`);
  $overlay.querySelector('#pixel').value = String(settings.pixel);
  $overlay.querySelector('#ptt').value = settings.ptt;
  $overlay.querySelector('#diff').value = settings.difficulty;
  on('#sens', 'input', (e) => { settings.sens = +e.target.value; $overlay.querySelector('#sv').textContent = settings.sens.toFixed(2); });
  on('#fov', 'input', (e) => { settings.fov = +e.target.value; $overlay.querySelector('#fv').textContent = settings.fov; });
  on('#back', 'click', () => {
    settings.invert = $overlay.querySelector('#invert').checked;
    settings.pixel = +$overlay.querySelector('#pixel').value;
    settings.master = +$overlay.querySelector('#master').value;
    settings.voice = +$overlay.querySelector('#voice').value;
    settings.ptt = $overlay.querySelector('#ptt').value;
    settings.difficulty = $overlay.querySelector('#diff').value;
    saveSettings();
    engine.setTargetHeight(settings.pixel);
    sfx.setVolume('master', settings.master);
    sfx.setVolume('voice', settings.voice);
    app.voice?.setMode(settings.ptt);
    if (app.net && app.state?.phase === 'lobby' && settings.difficulty !== prevDiff) app.net.send({ t: 'settings', difficulty: settings.difficulty });
    app.sub = false;
    back();
  });
}

// ---------------------------------------------------------------- connection
async function connect(msg) {
  sfx.init();
  html(`<div class="screen"><div class="card"><p class="subtitle">CONNECTING…</p></div></div>`);
  const net = new WsNet();
  try {
    await net.connect(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  } catch {
    return titleScreen('Cannot reach the server. Start it with npm start and open the address it prints.');
  }
  attachNet(net);
  net.send(msg);
}

function attachNet(net) {
  if (app.net && app.net !== net) app.net.close();
  // the radio belongs to one connection: rebuild it for the new one
  if (app.voice) { app.voice.dispose(); app.voice = null; }
  app.net = net;
  sfx.init();
  net.on('error', (m) => { forgetSession(); titleScreen(m.m); });
  net.on('closed', () => { if (app.net === net) titleScreen('Connection lost.'); });
  net.on('joined', (m) => {
    app.role = m.role; app.code = m.code; app.resumePose = m.pose || null;
    if (!(net instanceof LocalNet)) try { sessionStorage.setItem('ghostline.session', JSON.stringify({ code: m.code, role: m.role })); } catch { /* */ }
    if (app.state) render();
  });
  net.on('state', (m) => {
    const prev = app.state;
    app.state = m.s;
    if (prev && m.s.phase === 'playing' && app.game) {
      const other = app.role === 'agent' ? 'handler' : 'agent';
      const was = prev.players[other]?.connected, now = m.s.players[other]?.connected;
      if (was && !now) hud.toast(`${other === 'agent' ? 'GHOST' : 'LINE'} DROPPED — waiting for them to rejoin with the same code`, 'bad');
      if (!was && now && prev.players[other]) hud.toast(`${other === 'agent' ? 'GHOST' : 'LINE'} IS BACK ON THE LINE`, 'good');
    }
    if (app.game) app.game.world.setState(m.s);
    const changed = !prev || prev.phase !== m.s.phase || prev.seed !== m.s.seed || prev.difficulty !== m.s.difficulty;
    // lobby updates re-render the lobby, but not while this player is reading Settings / How to play
    if (changed || (m.s.phase === 'lobby' && !app.sub)) render();
  });

}

function render() {
  const s = app.state;
  if (!s || !app.role) return;
  if (s.phase === 'lobby') { app.startToken = (app.startToken || 0) + 1; app.missionKey = null; teardownGame(); lobbyScreen(); return; }
  if (s.phase === 'playing') {
    const key = `${s.seed}|${s.difficulty}|${s.startAt}|${app.role}`;
    if (app.missionKey !== key) startGame(key);
    return;
  }
  if (s.phase === 'won' || s.phase === 'lost') { app.startToken = (app.startToken || 0) + 1; app.missionKey = null; endScreen(); }
}

// ---------------------------------------------------------------- lobby
function lobbyScreen() {
  backdrop();
  const s = app.state, me = app.role;
  const seat = (role, title, sub, cls) => {
    const p = s.players[role];
    return `<div class="seat ${cls} ${me === role ? 'me' : ''}">
      <div class="ready ${p?.ready ? 'on' : ''}">${p ? (p.ready ? 'READY' : p.connected ? 'NOT READY' : 'OFFLINE') : 'EMPTY'}</div>
      <h3>${title}</h3><p>${sub}</p>
      <div class="who">${p ? esc(p.name) + (me === role ? '  (YOU)' : '') : '<span class="small">waiting for partner…</span>'}</div></div>`;
  };
  const both = s.players.agent?.connected && s.players.handler?.connected;
  const lan = location.hostname === 'localhost' ? 'A second window on this machine works. From another computer on your network, use the https address the server printed.' : `Your partner opens ${esc(location.origin)} and enters this code.`;
  html(`<div class="screen"><div class="card">
    <div class="row" style="justify-content:space-between"><div><label>OPERATION CODE</label><div class="code">${esc(app.code)}</div></div>
    <div class="col" style="align-items:flex-end"><span class="tag">${DIFFICULTY[s.difficulty]?.label}</span><span class="small">${DIFFICULTY[s.difficulty]?.time / 60} MIN · ${s.maxStrikes} ALERTS</span></div></div>
    <p class="hint">${lan}</p>
    <p class="hint">MISSION SEED <b style="color:var(--ink);letter-spacing:3px">${esc(s.seed)}</b> · LINE can <a href="/blueprint.html?seed=${encodeURIComponent(s.seed)}&diff=${s.difficulty}" target="_blank" style="color:var(--accent)">print this mission's blueprints</a> (changing difficulty changes them)</p>
    <div class="seats">
      ${seat('agent', 'GHOST', 'Infiltrator. Goes inside in first person. Sees every detail, knows none of the answers.', 'ghost')}
      ${seat('handler', 'LINE', 'Handler. Sits in the van with blueprints, cameras and a terminal. Knows the answers, can\'t move.', 'line')}
    </div>
    <div class="row">
      <button id="swap">SWAP SEATS</button>
      <select id="diff">${Object.values(DIFFICULTY).map((d) => `<option value="${d.key}">${d.label}</option>`).join('')}</select>
      <select id="practice"><option value="">FULL MISSION</option>${Object.entries(ZONE_TITLES).map(([k, v]) => `<option value="${k}">PRACTICE ${v}</option>`).join('')}</select>
    </div>
    <div class="row" style="margin-top:14px">
      <button id="radio">RADIO CHECK</button><div class="meter"><i id="lvl"></i></div><span class="small" id="radioState"></span>
    </div>
    <div class="row" style="margin-top:18px">
      <button id="ready" class="${s.players[me]?.ready ? '' : 'primary'}" style="flex:1">${s.players[me]?.ready ? 'NOT READY' : 'READY'}</button>
      <button id="start" class="primary" style="flex:1" ${both && s.players.agent.ready && s.players.handler.ready ? '' : 'disabled'}>START OPERATION</button>
    </div>
    <div class="row" style="margin-top:10px"><button id="howto" style="flex:1">HOW TO PLAY</button><button id="settings" style="flex:1">SETTINGS</button><button id="leave" style="flex:1">LEAVE</button></div>
  </div></div>`);
  $overlay.querySelector('#diff').value = s.difficulty;
  if (app.lastPractice) $overlay.querySelector('#practice').value = app.lastPractice;
  on('#practice', 'change', (e) => (app.lastPractice = e.target.value));
  on('#diff', 'change', (e) => { settings.difficulty = e.target.value; saveSettings(); app.net.send({ t: 'settings', difficulty: e.target.value }); });
  on('#swap', 'click', () => app.net.send({ t: 'swap', name: settings.name }));
  on('#ready', 'click', () => app.net.send({ t: 'ready', v: !s.players[me]?.ready }));
  on('#start', 'click', () => app.net.send({ t: 'start', difficulty: s.difficulty, practice: $overlay.querySelector('#practice').value || null }));
  on('#leave', 'click', () => { forgetSession(); app.net.close(); app.net = null; app.state = null; titleScreen(); });
  on('#howto', 'click', () => howToScreen(lobbyScreen));
  on('#settings', 'click', () => settingsScreen(lobbyScreen));
  on('#radio', 'click', async () => {
    ensureVoice();
    const ok = await app.voice.enable();
    $overlay.querySelector('#radioState').textContent = ok ? (app.voice.connected ? 'Link up · hold V to talk' : 'Mic ready · waiting for partner') : 'No microphone access (Discord works too)';
  });
  if (app.voice) {
    app.voice.onLevel = (v) => { const el = document.getElementById('lvl'); if (el) el.style.width = `${Math.min(100, v * 300)}%`; };
  }
}

function ensureVoice() {
  if (!app.voice) {
    app.voice = new Voice({ net: app.net, role: app.role, sfx, hud, mode: settings.ptt, getState: () => app.state });
    if (app.net instanceof LocalNet) app.voice.local = true;
  }
  app.voice.role = app.role;
  return app.voice;
}

// ---------------------------------------------------------------- game
let raf = 0;
async function startGame(key) {
  // one build at a time: a newer call (or a teardown) invalidates older ones mid-await
  const token = (app.startToken = (app.startToken || 0) + 1);
  app.missionKey = key;
  teardownGame();
  titleScene?.stop();
  engine.setTargetHeight(settings.pixel);
  html(`<div class="screen"><div class="card"><p class="subtitle">BUILDING ${esc(app.state.seed)}…</p></div></div>`);
  await new Promise((r) => setTimeout(r, 30));
  if (token !== app.startToken) return;
  const s = app.state;
  const mission = generateMission(s.seed, s.difficulty);
  app.mission = mission;
  const { FacilityWorld } = await import('./facility/world.js');
  if (token !== app.startToken) return;
  const world = new FacilityWorld(mission, { role: app.role });
  world.serverTime = () => app.net.serverNow();
  world.sfx = sfx;
  world.setState(s);
  ensureVoice();
  const mod = app.role === 'agent' ? await import('./facility/agent.js') : await import('./van/handler.js');
  if (token !== app.startToken) return;
  const view = app.role === 'agent'
    ? new mod.AgentView({ engine, world, input, net: app.net, hud, settings })
    : new mod.HandlerView({ engine, world, input, net: app.net, hud, settings, voice: app.voice });
  app.game = { world, view };
  app.voice.attach(view);
  html('');
  const intro = document.createElement('div');
  intro.className = 'intro';
  intro.innerHTML = app.role === 'agent'
    ? `<div><small>KESTREL-9 · SECTOR B · 02:00</small><h2>GHOST</h2><p>LINE is watching from the van. Hold V to talk.</p></div>`
    : `<div><small>SURVEILLANCE VAN · 2 KM OUT · 02:00</small><h2>LINE</h2><p>GHOST is inside the fence. Hold V to talk.</p></div>`;
  document.body.appendChild(intro);
  setTimeout(() => intro.classList.add('out'), 2600);
  setTimeout(() => intro.remove(), 4200);
  hud.show(true);
  hud.crosshair(true);
  hud.radio(settings.ptt === 'off' ? 'off' : '');
  input.onLockChange = (locked) => { hud.paused(!locked && !view.inspect && !view.focus && app.state?.phase === 'playing' && !view.wantsCursor && !$overlay.innerHTML); };
  canvas.onclick = () => { if (!view.inspect && !view.wantsCursor) input.lock(); };
  input.lock();
  setTimeout(() => { if (app.game?.view === view) hud.paused(!input.locked && !view.inspect && !view.wantsCursor && !view.focus); }, 4300);
  if (settings.ptt !== 'off') app.voice.enable();
  let last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    world.t = t;
    engine.renderer.shadowMap.needsUpdate = true;
    view.update(dt, t);
    world.update(dt, t);
    app.voice?.update(dt, input);
    view.render(t);
    input.endFrame();
  };
  raf = requestAnimationFrame(loop);
}

function teardownGame() {
  if (!app.game) return;
  cancelAnimationFrame(raf);
  app.game.view.dispose?.();
  app.game.world.dispose?.();
  app.game = null;
  hud.show(false);
  input.unlock();
  document.body.style.cursor = 'default';
  for (const k of Object.keys(sfx.ambs)) sfx.ambience(k, false);
}

function rank(s, r) {
  if (!r.win) return null;
  const left = 1 - r.elapsed / s.limit;
  const pts = (s.maxStrikes - r.strikes) / s.maxStrikes * 2 + left * 2;
  return pts > 3.3 ? 'S' : pts > 2.6 ? 'A' : pts > 1.8 ? 'B' : 'C';
}

function endScreen() {
  const s = app.state, r = s.result || {};
  teardownGame();
  backdrop();
  const rk = rank(s, r);
  let prev = 0;
  const rows = Object.entries(ZONE_TITLES).map(([k, v]) => {
    const t = s.splits?.[k];
    if (t == null) return `<div class="split ${k === r.reached ? 'here' : 'none'}"><span>${v}</span><b>${k === r.reached && !r.win ? '✕' : '—'}</b></div>`;
    const d = t - prev; prev = t;
    return `<div class="split"><span>${v}</span><b>${fmtTime(d)}</b></div>`;
  }).join('');
  html(`<div class="screen"><div class="card">
    <h2 class="result ${r.win ? 'win' : 'lose'}">${r.win ? 'EXTRACTED' : 'COMPROMISED'}</h2>
    <p class="subtitle">${esc(r.reason || '')}</p>
    ${rk ? `<div class="rank">${rk}</div>` : ''}
    <div class="splits">${rows}</div>
    <div class="stats">
      <div><span class="small">TIME</span><b>${fmtTime(r.elapsed || 0)}</b></div>
      <div><span class="small">ALERTS</span><b>${r.strikes ?? 0} / ${s.maxStrikes}</b></div>
      <div><span class="small">SEED</span><b>${esc(s.seed)}</b></div>
    </div>
    <div class="row"><button class="primary" id="again" style="flex:1">NEW MISSION</button><button id="leave" style="flex:1">LEAVE</button></div>
  </div></div>`);
  on('#again', 'click', () => app.net.send({ t: 'lobby' }));
  on('#leave', 'click', () => { forgetSession(); app.net.close(); app.net = null; app.state = null; titleScreen(); });
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && app.game && !input.locked && !app.game.view.inspect && !app.game.view.focus && app.state?.phase === 'playing') pauseMenu();
});

function pauseMenu() {
  if ($overlay.innerHTML) return;
  html(`<div class="screen"><div class="card">
    <h2 class="title" style="font-size:40px">PAUSED</h2><p class="hint">The game doesn't actually pause — the clock keeps running.</p>
    <div class="col"><button class="primary" id="resume">RESUME</button><button id="settings">SETTINGS</button><button id="howto">HOW TO PLAY</button><button id="abort">ABORT MISSION (BACK TO LOBBY)</button></div>
  </div></div>`);
  on('#resume', 'click', () => { html(''); input.lock(); });
  const back = () => { html(''); pauseMenu(); };
  on('#settings', 'click', () => settingsScreen(back));
  on('#howto', 'click', () => howToScreen(back));
  const abort = on('#abort', 'click', () => {
    if (!abort.dataset.armed) { abort.dataset.armed = '1'; abort.textContent = 'CLICK AGAIN TO CONFIRM — SENDS YOU BOTH TO THE LOBBY'; return; }
    html(''); app.net.send({ t: 'lobby' });
  });
}

function forgetSession() { try { sessionStorage.removeItem('ghostline.session'); } catch { /* */ } }

// ---------------------------------------------------------------- dev shortcuts
// ?solo=agent|handler&zone=lasers   jump straight into a local session
if (params.get('solo')) {
  settings.name = settings.name || 'DEV';
  const role = params.get('solo') === 'handler' ? 'handler' : 'agent';
  const net = new LocalNet({ difficulty: params.get('diff') || settings.difficulty, role, name: settings.name });
  attachNet(net);
  setTimeout(() => net.send({ t: 'start', practice: params.get('zone') || null, seed: params.get('seed') || undefined }), 30);
} else if (params.get('room')) {
  connect({ t: 'join', code: params.get('room'), name: params.get('name') || 'DEV', role: params.get('role') });
} else if (params.get('host')) {
  connect({ t: 'create', name: params.get('name') || 'DEV', role: params.get('host'), difficulty: settings.difficulty });
} else {
  // a refresh mid-mission rejoins the same seat
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('ghostline.session') || 'null'); } catch { /* */ }
  if (saved?.code) connect({ t: 'join', code: saved.code, role: saved.role, name: settings.name || 'ANON' }).then(() => {});
  else titleScreen();
}
