import { Engine } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { WsNet, LocalNet } from './net/net.js';
import { Voice } from './net/voice.js';
import { Hud } from './ui/hud.js';
import { sfx } from './audio/sfx.js';
import { generateMission } from '../shared/mission.js';
import { DIFFICULTY } from '../shared/layout.js';
import { fmtTime, ZONE_TITLES } from './ui/text.js';

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

const app = { net: null, role: null, code: null, state: null, game: null, voice: null, mission: null, missionKey: null };
window.__gl = app;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const html = (s) => { $overlay.innerHTML = s; };
const on = (sel, ev, fn) => { const el = $overlay.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };

// ---------------------------------------------------------------- title
function titleScreen(err = '') {
  teardownGame();
  html(`<div class="screen"><div class="card">
    <h1 class="title">GHOST<br><span>LINE</span></h1>
    <p class="subtitle">两人语音合作潜入 · 一个人进去，一个人在车里看着</p>
    <div class="col">
      <label>代号 CALLSIGN</label>
      <input id="name" maxlength="16" placeholder="NAME" value="${esc(settings.name)}" />
      <button class="primary big" id="host">建立行动 HOST <small>开房间，把代码告诉搭档</small></button>
      <div class="row"><input id="code" maxlength="4" placeholder="CODE" style="width:140px;text-transform:uppercase" />
      <button id="join" style="flex:1">加入行动 JOIN</button></div>
      <button class="big" id="solo">单人熟悉 SOLO <small>一个人进去看看（另一个角色空着）</small></button>
      <div class="row"><button id="howto" style="flex:1">玩法 HOW TO PLAY</button><button id="settings" style="flex:1">设置 SETTINGS</button><button id="print" style="flex:1">打印蓝图</button></div>
      <div class="err">${esc(err)}</div>
    </div></div></div>`);
  const name = () => { settings.name = $overlay.querySelector('#name').value.trim().toUpperCase().slice(0, 16) || 'ANON'; saveSettings(); return settings.name; };
  on('#host', 'click', () => connect({ t: 'create', name: name(), difficulty: settings.difficulty }));
  on('#join', 'click', () => {
    const code = $overlay.querySelector('#code').value.trim().toUpperCase();
    if (code.length !== 4) return titleScreen('行动代码是 4 个字母');
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
    <p class="hint">单人模式只用来熟悉场景和操作：任务需要两个人才能完成（一个人看不到另一半信息，也做不了另一半操作）。</p>
    <div class="col" style="margin-top:16px">
      <button class="big primary" id="agent">我是 GHOST <small>进入设施</small></button>
      <button class="big" id="handler">我是 LINE <small>坐在面包车里</small></button>
      <label style="margin-top:8px">从哪里开始</label>
      <select id="zone"><option value="">完整任务</option>${Object.entries(ZONE_TITLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <button id="back">返回</button>
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
  html(`<div class="screen"><div class="card howto">
    <h2 class="title" style="font-size:40px">HOW TO PLAY</h2>
    <p>一个人当 <b style="color:var(--ghost)">GHOST</b>：第一人称潜入废弃设施 KESTREL-9。另一个人当 <b style="color:var(--handler)">LINE</b>：坐在两公里外的监控面包车里，有设施的原始蓝图、偷接的监控摄像头和一台接进楼控系统的终端。</p>
    <p>GHOST 看得到机关的细节但不知道怎么解；LINE 知道怎么解、看得到 GHOST 看不到的东西（红外激光、光束、热成像、传感器），但动不了。<b>每一关都必须说话才能过。</b></p>
    <h4>说话</h4>
    <p>按住 <kbd>V</kbd> 用对讲机说话（设置里可以改成常开麦）。坐在同一个房间也行，开 Discord 也行。</p>
    <h4>GHOST</h4>
    <p><kbd>WASD</kbd> 移动 <kbd>鼠标</kbd> 看 <kbd>Shift</kbd> 跑（有声音） <kbd>C</kbd> 蹲（没声音） <kbd>空格</kbd> 跳 <kbd>F</kbd> 手电 <kbd>E</kbd> 查看/交互 <kbd>Tab</kbd> 抬手看表（时间、警报、目标）</p>
    <h4>LINE</h4>
    <p><kbd>鼠标</kbd> 在车里转头，点击设备凑近操作，<kbd>右键</kbd>/<kbd>Esc</kbd> 退回座位。<br>
    监视器：<kbd>1</kbd>–<kbd>0</kbd> 选摄像头，<kbd>I</kbd> 红外/热成像，<kbd>方向键</kbd>/拖动 云台，<kbd>滚轮</kbd> 变焦。<br>
    蓝图：拖动平移、滚轮缩放、<kbd>Shift</kbd>+拖动 用红笔画、<kbd>X</kbd> 擦掉这一页的笔迹、<kbd>1</kbd>–<kbd>7</kbd> 翻页。<br>
    终端：直接打字，<kbd>F1</kbd>–<kbd>F6</kbd> 切程序。密码转盘：拖动内圈。</p>
    <h4>犯错</h4>
    <p>每次犯错（输错码、碰激光、被怪物抓到……）警报 +1。警报满了任务失败。时间到了也失败。</p>
    <button id="back" style="margin-top:16px">返回</button>
  </div></div>`);
  on('#back', 'click', back);
}

function settingsScreen(back) {
  html(`<div class="screen"><div class="card">
    <h2 class="title" style="font-size:40px">SETTINGS</h2>
    <div class="col" style="margin-top:14px">
      <label>鼠标灵敏度 <span id="sv">${settings.sens.toFixed(2)}</span></label><input type="range" id="sens" min="0.2" max="3" step="0.05" value="${settings.sens}">
      <label><input type="checkbox" id="invert" ${settings.invert ? 'checked' : ''}> 反转 Y 轴</label>
      <label>视野 FOV <span id="fv">${settings.fov}</span></label><input type="range" id="fov" min="60" max="95" step="1" value="${settings.fov}">
      <label>像素感</label>
      <select id="pixel"><option value="270">粗 CHUNKY</option><option value="360">标准 NORMAL</option><option value="480">细 FINE</option><option value="720">高清 HD</option></select>
      <label>总音量</label><input type="range" id="master" min="0" max="1" step="0.05" value="${settings.master}">
      <label>对讲音量</label><input type="range" id="voice" min="0" max="2" step="0.05" value="${settings.voice}">
      <label>对讲方式</label>
      <select id="ptt"><option value="hold">按住 V 说话</option><option value="open">常开麦</option><option value="off">不用游戏内语音（Discord / 同一个房间）</option></select>
      <label>难度（房主设置）</label>
      <select id="diff">${Object.values(DIFFICULTY).map((d) => `<option value="${d.key}">${d.label} — ${d.time / 60} 分钟 · ${d.strikes} 次警报</option>`).join('')}</select>
      <button id="back">保存并返回</button>
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
    if (app.net && app.state?.phase === 'lobby') app.net.send({ t: 'settings', difficulty: settings.difficulty });
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
    return titleScreen('连不上服务器。用 npm start 启动后打开它给的地址。');
  }
  attachNet(net);
  net.send(msg);
}

function attachNet(net) {
  if (app.net && app.net !== net) app.net.close();
  app.net = net;
  sfx.init();
  net.on('error', (m) => titleScreen(m.m));
  net.on('closed', () => { if (app.net === net) titleScreen('连接断开了'); });
  net.on('joined', (m) => { app.role = m.role; app.code = m.code; if (app.state) render(); });
  net.on('state', (m) => {
    const prev = app.state;
    app.state = m.s;
    if (app.game) app.game.world.setState(m.s);
    if (!prev || prev.phase !== m.s.phase || prev.seed !== m.s.seed || prev.difficulty !== m.s.difficulty || m.s.phase === 'lobby') render();
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
  const s = app.state, me = app.role;
  const seat = (role, title, sub, cls) => {
    const p = s.players[role];
    return `<div class="seat ${cls} ${me === role ? 'me' : ''}">
      <div class="ready ${p?.ready ? 'on' : ''}">${p ? (p.ready ? 'READY' : p.connected ? 'NOT READY' : 'OFFLINE') : 'EMPTY'}</div>
      <h3>${title}</h3><p>${sub}</p>
      <div class="who">${p ? esc(p.name) + (me === role ? '  (你)' : '') : '<span class="small">等待搭档…</span>'}</div></div>`;
  };
  const both = s.players.agent?.connected && s.players.handler?.connected;
  const lan = location.hostname === 'localhost' ? '同一台电脑开第二个窗口也行；局域网另一台电脑用服务器启动时打印的 https 地址。' : `搭档打开 ${esc(location.origin)} 输入代码。`;
  html(`<div class="screen"><div class="card">
    <div class="row" style="justify-content:space-between"><div><label>行动代码 OPERATION CODE</label><div class="code">${esc(app.code)}</div></div>
    <div class="col" style="align-items:flex-end"><span class="tag">${DIFFICULTY[s.difficulty]?.label}</span><span class="small">${DIFFICULTY[s.difficulty]?.time / 60} MIN · ${s.maxStrikes} ALERTS</span></div></div>
    <p class="hint">${lan}</p>
    <p class="hint">任务种子 SEED <b style="color:var(--ink);letter-spacing:3px">${esc(s.seed)}</b> · LINE 想要纸质蓝图可以 <a href="/blueprint.html?seed=${encodeURIComponent(s.seed)}&diff=${s.difficulty}" target="_blank" style="color:var(--accent)">打印这一局的蓝图</a>（改难度会换种子内容）</p>
    <div class="seats">
      ${seat('agent', 'GHOST', '潜入者。第一人称进设施，看得到机关细节，但不知道怎么解。', 'ghost')}
      ${seat('handler', 'LINE', '接线员。坐在面包车里：蓝图、监控、终端。知道怎么解，但动不了。', 'line')}
    </div>
    <div class="row">
      <button id="swap">换位置 SWAP</button>
      <select id="diff">${Object.values(DIFFICULTY).map((d) => `<option value="${d.key}">${d.label}</option>`).join('')}</select>
      <select id="practice"><option value="">完整任务 FULL MISSION</option>${Object.entries(ZONE_TITLES).map(([k, v]) => `<option value="${k}">练习 ${v}</option>`).join('')}</select>
    </div>
    <div class="row" style="margin-top:14px">
      <button id="radio">无线电测试 RADIO CHECK</button><div class="meter"><i id="lvl"></i></div><span class="small" id="radioState"></span>
    </div>
    <div class="row" style="margin-top:18px">
      <button id="ready" class="${s.players[me]?.ready ? '' : 'primary'}" style="flex:1">${s.players[me]?.ready ? '取消准备' : '准备 READY'}</button>
      <button id="start" class="primary" style="flex:1" ${both && s.players.agent.ready && s.players.handler.ready ? '' : 'disabled'}>开始行动 START</button>
    </div>
    <div class="row" style="margin-top:10px"><button id="howto" style="flex:1">玩法</button><button id="settings" style="flex:1">设置</button><button id="leave" style="flex:1">离开</button></div>
  </div></div>`);
  $overlay.querySelector('#diff').value = s.difficulty;
  if (app.lastPractice) $overlay.querySelector('#practice').value = app.lastPractice;
  on('#practice', 'change', (e) => (app.lastPractice = e.target.value));
  on('#diff', 'change', (e) => { settings.difficulty = e.target.value; saveSettings(); app.net.send({ t: 'settings', difficulty: e.target.value }); });
  on('#swap', 'click', () => app.net.send({ t: 'swap', name: settings.name }));
  on('#ready', 'click', () => app.net.send({ t: 'ready', v: !s.players[me]?.ready }));
  on('#start', 'click', () => app.net.send({ t: 'start', difficulty: s.difficulty, practice: $overlay.querySelector('#practice').value || null }));
  on('#leave', 'click', () => { app.net.close(); app.net = null; app.state = null; titleScreen(); });
  on('#howto', 'click', () => howToScreen(lobbyScreen));
  on('#settings', 'click', () => settingsScreen(lobbyScreen));
  on('#radio', 'click', async () => {
    ensureVoice();
    const ok = await app.voice.enable();
    $overlay.querySelector('#radioState').textContent = ok ? (app.voice.connected ? '已接通 · 按住 V 说话' : '麦克风就绪 · 等搭档') : '没有麦克风权限（可以用 Discord）';
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
    ? `<div><small>KESTREL-9 · SECTOR B · 02:00</small><h2>GHOST</h2><p>LINE 在车里看着你。说话按住 V。</p></div>`
    : `<div><small>SURVEILLANCE VAN · 2 KM OUT · 02:00</small><h2>LINE</h2><p>GHOST 已经到了围栏里面。说话按住 V。</p></div>`;
  document.body.appendChild(intro);
  setTimeout(() => intro.classList.add('out'), 2600);
  setTimeout(() => intro.remove(), 4200);
  hud.show(true);
  hud.crosshair(true);
  hud.radio(settings.ptt === 'off' ? 'off' : '');
  input.onLockChange = (locked) => { hud.paused(!locked && !view.inspect && !view.focus && app.state?.phase === 'playing' && !view.wantsCursor); };
  canvas.onclick = () => { if (!view.inspect && !view.wantsCursor) input.lock(); };
  input.lock();
  setTimeout(() => hud.paused(!input.locked && !view.inspect && !view.wantsCursor), 4300);
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
    <div class="row"><button class="primary" id="again" style="flex:1">再来一次 NEW MISSION</button><button id="leave" style="flex:1">离开</button></div>
  </div></div>`);
  on('#again', 'click', () => app.net.send({ t: 'lobby' }));
  on('#leave', 'click', () => { app.net.close(); app.net = null; app.state = null; titleScreen(); });
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && app.game && !input.locked && !app.game.view.inspect && !app.game.view.focus && app.state?.phase === 'playing') pauseMenu();
});

function pauseMenu() {
  if ($overlay.innerHTML) return;
  html(`<div class="screen"><div class="card">
    <h2 class="title" style="font-size:40px">PAUSED</h2><p class="hint">游戏不会真的暂停——计时还在走。</p>
    <div class="col"><button class="primary" id="resume">继续</button><button id="settings">设置</button><button id="howto">玩法</button><button id="abort">放弃任务（回到大厅）</button></div>
  </div></div>`);
  on('#resume', 'click', () => { html(''); input.lock(); });
  on('#settings', 'click', () => settingsScreen(pauseMenu));
  on('#howto', 'click', () => howToScreen(pauseMenu));
  on('#abort', 'click', () => { html(''); app.net.send({ t: 'lobby' }); });
}

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
} else titleScreen();
