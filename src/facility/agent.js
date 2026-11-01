import * as THREE from 'three';
import { LAYER } from './world.js';
import { PAL } from '../engine/kit.js';
import { AGENT_SPAWN, zoneOf, ZONES, practiceSpawn } from '../../shared/layout.js';
import { sfx } from '../audio/sfx.js';
import { fmtTime, OBJECTIVES, parDelta, fmtDelta } from '../ui/text.js';

const EYE = 1.62, EYE_CROUCH = 1.0, H_STAND = 1.72, H_CROUCH = 1.05, R = 0.27;

const DOWN_T = 1.3; // seconds GHOST lies on the floor after a strike before fading back

export class AgentView {
  constructor({ engine, world, input, net, hud, settings, voice }) {
    this.engine = engine; this.world = world; this.input = input; this.net = net; this.hud = hud; this.settings = settings; this.voice = voice;
    this.radioHold = 0; this.txHold = 0;
    this.cam = new THREE.PerspectiveCamera(72, 1, 0.05, 220);
    this.cam.layers.set(LAYER.WORLD); this.cam.layers.enable(LAYER.FP); this.cam.layers.enable(LAYER.SMOKE);
    world.scene.add(this.cam);
    const rp = window.__gl?.resumePose;
    const sp = rp ? { x: rp.x, z: rp.z, yaw: rp.yaw } : world.state?.practice ? practiceSpawn(world.state.practice, world.mission) : AGENT_SPAWN;
    if (window.__gl) window.__gl.resumePose = null;
    this.pos = new THREE.Vector3(sp.x, 0, sp.z);
    this.vel = new THREE.Vector3();
    this.yaw = sp.yaw; this.pitch = 0;
    this.crouch = 0; this.crouching = false; this.vy = 0; this.grounded = true;
    this.flashOn = true; this.bob = 0; this.stepAcc = 0;
    this.inspect = null; this.tween = null;
    this.fade = 1; this.fadeTarget = 1;
    this.flashT = 0; this.shake = 0;
    this.poseAcc = 0;
    this.watchUp = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(LAYER.HIT);
    world.agentBody = { x: this.pos.x, y: 0, z: this.pos.z, h: H_STAND, teleporting: false };
    world.act = (a) => net.send({ t: 'act', a });
    world.onLocalAlarm = () => { this.flashT = 1; this.shake = 0.4; };
    world.onFall = () => { this.vy = -6; this.fadeTarget = 0; this.shake = 1; this.fallT = 3; sfx.thud(this.pos); };
    world.onShock = (c) => {
      this.shake = 0.8; this.flashT = 0.6;
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / d) * 5; this.vel.z += (dz / d) * 5;
    };
    this.buildHands();
    this.unsub = [
      net.on('ev', (m) => this.onEvent(m.e)),
    ];
    this.lastObjective = null;
    hud.keys('<kbd>WASD</kbd> move <kbd>Shift</kbd> run <kbd>C</kbd> crouch <kbd>Space</kbd> jump<br><kbd>E</kbd> inspect / use <kbd>F</kbd> torch <kbd>Tab</kbd> watch<br>hold <kbd>V</kbd> to talk');
    this.keysT = 45;
  }

  buildHands() {
    const g = (this.hands = new THREE.Group());
    // unlit so the torch right next to them doesn't blow them out
    const mat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.42) });
    const sleeve = mat(PAL.orange), glove = mat(PAL.glove);
    // right: torch hand
    const right = (this.right = new THREE.Group());
    const rs = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 7), sleeve);
    rs.rotation.x = Math.PI / 2 - 0.2; rs.position.set(0, -0.02, 0.12);
    const rh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), glove);
    rh.scale.set(1, 0.9, 1.25); rh.position.set(0, 0.0, -0.06);
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.24, 7), mat(0x2b2b2b));
    torch.rotation.x = Math.PI / 2; torch.position.set(0, 0.03, -0.13);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 8), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
    lens.position.set(0, 0.03, -0.252);
    lens.rotation.y = Math.PI;
    this.lens = lens;
    right.add(rs, rh, torch, lens);
    right.position.set(0.25, -0.24, -0.42);
    // left: watch hand
    const left = (this.left = new THREE.Group());
    const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.36, 7), sleeve);
    ls.rotation.x = Math.PI / 2; ls.position.set(0, 0, 0.14);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), glove);
    lh.scale.set(1.1, 0.8, 1.2); lh.position.set(0, 0, -0.07);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 8), mat(0x1c1c1c));
    strap.rotation.x = Math.PI / 2; strap.position.set(0, 0, 0.03);
    this.watchCv = Object.assign(document.createElement('canvas'), { width: 256, height: 160 });
    this.watchTex = new THREE.CanvasTexture(this.watchCv);
    this.watchTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.081), new THREE.MeshBasicMaterial({ map: this.watchTex }));
    face.position.set(0, 0.072, 0.03); face.rotation.x = -Math.PI / 2;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.095), mat(0x3a3a3a));
    bezel.position.set(0, 0.06, 0.03);
    left.add(ls, lh, strap, bezel, face);
    left.position.set(-0.3, -0.34, -0.42);
    g.add(right, left);
    g.traverse((o) => { o.layers.set(LAYER.FP); if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.cam.add(g);
  }

  drawWatch(s, now) {
    let remain = s ? (s.phase === 'playing' ? s.limit - (now - s.startAt) : s.limit) : 0;
    if (s?.lockdown?.active) remain = Math.min(remain, s.escapeEnd - now);
    if (s?.practice) remain = s.lockdown?.active ? s.escapeEnd - now : 0;
    // only repaint (and re-upload the texture) when something on the face actually changes
    const pdk = parDelta(s, now);
    const key = `${Math.floor(remain / 1000)}|${s?.strikes}|${s?.maxStrikes}|${s?.objective}|${pdk == null ? '' : Math.floor(pdk / 1000)}|${s?.lockdown?.active ? Math.floor(now / 400) % 2 : ''}|${s?.practice}`;
    if (key === this.watchKey) return;
    this.watchKey = key;
    const c = this.watchCv.getContext('2d');
    c.fillStyle = '#0d150f'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#9dff9a'; c.font = '700 54px "Courier New", monospace'; c.textAlign = 'center';
    c.fillStyle = s?.lockdown?.active ? ((now / 400) % 2 < 1 ? '#ff6a50' : '#7a2a20') : '#9dff9a';
    c.fillText(s?.practice && !s.lockdown?.active ? '--:--' : fmtTime(remain), 128, 64);
    const max = s?.maxStrikes || 5, n = s?.strikes || 0;
    const w = Math.min(34, 200 / max);
    for (let i = 0; i < max; i++) {
      c.fillStyle = i < n ? '#ff5a3a' : '#20321f';
      c.fillRect(128 - (max * w) / 2 + i * w + 3, 82, w - 6, 16);
    }
    c.fillStyle = '#6fb36d'; c.font = '700 20px "Courier New", monospace';
    c.fillText(OBJECTIVES[s?.objective]?.short || '', 128, 120);
    const pd = parDelta(s, now);
    if (pd != null) { c.fillStyle = pd > 0 ? '#ff7a5a' : '#6fb36d'; c.font = '700 17px "Courier New", monospace'; c.fillText(`PAR ${fmtDelta(pd)}`, 128, 144); }
    this.watchTex.needsUpdate = true;
  }

  onEvent(e) {
    if (e.k === 'teleport') {
      // knocked back by a strike (laser, pit, the Listener): go down where LINE can watch it, then fade
      const knocked = performance.now() - (this.strikeAt || 0) < 400;
      if (knocked) { this.downT = DOWN_T; this.downDir = Math.random() < 0.5 ? -1 : 1; setTimeout(() => (this.fadeTarget = 0), (DOWN_T - 0.45) * 1000); }
      else this.fadeTarget = 0;
      this.world.agentBody.teleporting = true;
      setTimeout(() => {
        this.pos.set(e.x, 0, e.z);
        this.vel.set(0, 0, 0);
        if (e.yaw != null) { this.yaw = e.yaw; this.pitch = 0; }
        this.fadeTarget = 1;
        this.downT = 0;
        setTimeout(() => (this.world.agentBody.teleporting = false), 1200);
      }, knocked ? DOWN_T * 1000 : 420);
      if (this.inspect) this.exitInspect();
    }
    if (e.k === 'gateWarn') { sfx.denied(); this.hud.toast('CODE INVALID — ONE MORE WRONG CODE TRIPS THE ALARM', 'bad'); }
    if (e.k === 'strike') { this.strikeAt = performance.now(); this.flashT = 1; this.shake = 0.5; sfx.strike(); this.hud.toast(`ALERT ${e.n} — ${e.reason}`, 'bad'); }
    if (e.k === 'spark') { if (this.world.onSpark) this.world.onSpark(); else sfx.spark({ x: 6.6, y: 1.4, z: -33 }); }
    if (e.k === 'sfx' && e.name === 'granted') sfx.granted();
    if (e.k === 'sfx' && e.name === 'power') sfx.powerOn({ x: 0, y: 2, z: -33 });
    if (e.k === 'sfx' && e.name === 'clunk') sfx.clunk(this.pos);
    if (e.k === 'sfx' && e.name === 'caught') { sfx.groan(this.pos); sfx.static(0.5, 0.18); this.shake = 1; this.scareT = 0.6; this.hud.scare(); }
    if (e.k === 'stalker') this.hud.toast('SOMETHING FOLLOWED YOU OUT OF THE UNDERCROFT', 'bad');
    if (e.k === 'dial') {
      sfx.tick(this.pos);
      if (e.drag) { sfx.ratchet(this.pos); this.shake = Math.max(this.shake, 0.12); this.world.vaultDragAt = performance.now(); }
    }
    if (e.k === 'sfx' && e.name === 'optics') sfx.chime();
    if (e.k === 'sfx' && e.name === 'vault') sfx.bolts({ x: -11, y: 1.4, z: -62 });
    if (e.k === 'sfx' && e.name === 'override') { sfx.granted(); this.hud.toast(`${e.id} OPEN`, 'good'); }
    if (e.k === 'sfx' && e.name === 'lift') sfx.motor({ x: 12, y: 1.5, z: -22 }, 9);
    if (e.k === 'sfx' && e.name === 'liftArrive') { sfx.ding(); this.hud.toast('LIFT ARRIVED — GET IN', 'good'); }
    if (e.k === 'lockdown') { sfx.lockdown(); this.flashT = 1; this.hud.toast('LOCKDOWN — GET OUT', 'bad'); }
  }

  enterInspect(it) {
    const insp = it.inspect;
    this.inspect = { it, insp };
    this.tween = { t: 0, fromPos: this.cam.position.clone(), fromQ: this.cam.quaternion.clone(), toPos: insp.camPos.clone(), toQ: new THREE.Quaternion() };
    const m = new THREE.Matrix4().lookAt(insp.camPos, insp.lookAt, new THREE.Vector3(0, 1, 0));
    this.tween.toQ.setFromRotationMatrix(m);
    this.input.unlock();
    this.hud.prompt('');
    this.hud.paused(false);
    this.hud.setInspect(insp.hint || '', true);
    this.engine.setTargetHeight(this.settings.pixel * (insp.res || 1.7));
    insp.onEnter && insp.onEnter();
  }

  exitInspect() {
    if (!this.inspect) return;
    this.inspect.insp.onExit && this.inspect.insp.onExit();
    this.inspect = null;
    this.tween = null;
    this.hud.setInspect('', false);
    this.engine.setTargetHeight(this.settings.pixel);
    this.input.lock();
  }

  update(dt, t) {
    const I = this.input, s = this.world.state, now = this.net.serverNow();
    const playing = s?.phase === 'playing';
    if (this.keysT > 0 && (this.keysT -= dt) <= 0) this.hud.keys('');
    if (I.hit('F1')) { this.keysT = 20; this.hud.keys('<kbd>WASD</kbd> move <kbd>Shift</kbd> run <kbd>C</kbd> crouch <kbd>Space</kbd> jump<br><kbd>E</kbd> inspect / use <kbd>Q</kbd> turn mirror back <kbd>F</kbd> torch <kbd>Tab</kbd> watch<br>hold <kbd>V</kbd> to talk'); }
    if (this.lastObjective !== s?.objective && playing) {
      this.lastObjective = s.objective;
      const o = OBJECTIVES[s.objective];
      if (o) this.hud.objective(o.agent);
    }
    // ---- look
    if (!this.inspect && I.lookActive) {
      const sens = 0.0022 * this.settings.sens;
      this.yaw -= I.mouse.dx * sens;
      this.pitch -= I.mouse.dy * sens * (this.settings.invert ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    // ---- movement
    const canMove = !this.inspect && playing && !this.world.agentBody.teleporting;
    const fwd = (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0);
    const str = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0);
    const wantCrouch = I.down('KeyC'); // not Ctrl: Ctrl+W would close the tab
    if (wantCrouch) this.crouching = true;
    else if (this.crouching) {
      // stand only if there's headroom
      this.crouching = false;
    }
    const sprint = (I.down('ShiftLeft') || I.down('ShiftRight')) && !this.crouching && fwd > 0;
    const speed = this.crouching ? 1.35 : sprint ? 4.3 : 2.6;
    const dir = new THREE.Vector3(str, 0, -fwd);
    if (dir.lengthSq() > 0) dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const target = canMove ? dir.multiplyScalar(speed) : new THREE.Vector3();
    const accel = this.grounded ? 14 : 3;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);
    if (canMove && this.grounded && I.hit('Space') && !this.crouching) { this.vy = 4.4; this.grounded = false; }
    this.vy -= 13 * dt;
    let y = this.pos.y + this.vy * dt;
    if (y <= 0) { if (!this.grounded && this.vy < -3) sfx.footstep(this.pos, 1.2); y = 0; this.vy = 0; this.grounded = true; }
    this.pos.y = y;
    const h = this.crouching ? H_CROUCH : H_STAND;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const res = this.world.collide(nx, nz, R, this.pos.y, h);
    this.pos.x = res.x; this.pos.z = res.z;
    this.crouch += ((this.crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    // footsteps / bob
    if (this.grounded && hs > 0.4) {
      this.bob += dt * hs * 2.4;
      this.stepAcc += hs * dt;
      const stride = this.crouching ? 0.55 : sprint ? 1.0 : 0.8;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        const z = zoneOf(this.pos.x, this.pos.z);
        sfx.footstep({ x: this.pos.x, y: 0.1, z: this.pos.z }, this.crouching ? 0.3 : sprint ? 1.4 : 0.8, z === 'gate' ? 'gravel' : z === 'maze' ? 'metal' : 'concrete');
      }
    }
    // body for trip checks
    const B = this.world.agentBody;
    B.x = this.pos.x; B.y = this.pos.y; B.z = this.pos.z; B.h = h;
    B.crouch = this.crouching; B.sprint = sprint && hs > 3; B.moving = hs > 0.3;
    // ---- toggles
    if (!this.inspect && I.hit('KeyF')) { this.flashOn = !this.flashOn; sfx.click(0.1); }
    this.watchUp += ((I.down('Tab') && !this.inspect ? 1 : 0) - this.watchUp) * Math.min(1, dt * 10);
    // ---- camera
    const eye = EYE + (EYE_CROUCH - EYE) * this.crouch;
    const bobY = Math.sin(this.bob * 2) * 0.035 * Math.min(1, hs / 2.6);
    const bobX = Math.cos(this.bob) * 0.025 * Math.min(1, hs / 2.6);
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.06;
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + dt / 0.35);
      const k = this.tween.t * this.tween.t * (3 - 2 * this.tween.t);
      this.cam.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k);
      this.cam.quaternion.slerpQuaternions(this.tween.fromQ, this.tween.toQ, k);
      this.cam.fov = 72 + ((this.inspect?.insp.fov ?? 55) - 72) * k;
    } else {
      this.cam.position.set(this.pos.x + bobX * Math.cos(this.yaw) + (Math.random() - 0.5) * sh, this.pos.y + eye + bobY + (Math.random() - 0.5) * sh, this.pos.z - bobX * Math.sin(this.yaw));
      this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.cam.fov = this.settings.fov;
    }
    if (this.downT > 0) {
      // crumple: drop to the floor and roll onto one side
      this.downT = Math.max(0, this.downT - dt);
      const k = Math.min(1, (1 - this.downT / DOWN_T) * 2.2), e = k * k * (3 - 2 * k);
      this.cam.position.y = Math.max(0.28, this.cam.position.y - e * 1.25);
      this.cam.rotation.z += this.downDir * e * 1.15;
      this.cam.rotation.x -= e * 0.35;
    }
    this.cam.aspect = this.engine.width / this.engine.height;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    // hands
    this.hands.visible = !this.inspect;
    this.right.position.set(0.25 + bobX * 0.5, -0.24 + bobY * 0.6 - this.watchUp * 0.08, -0.42);
    this.left.position.set(-0.3 + this.watchUp * 0.18, -0.34 + this.watchUp * 0.24 + bobY * 0.5, -0.42 + this.watchUp * 0.1);
    this.left.rotation.set(this.watchUp * 0.9, this.watchUp * 0.25, this.watchUp * -0.5);
    this.drawWatch(s, now);
    // flashlight
    const F = this.world.flash;
    const fl = (this.inspect ? new THREE.Vector3(0.05, 0.05, 0.1) : new THREE.Vector3(0.18, -0.12, -0.25)).applyQuaternion(this.cam.quaternion).add(this.cam.position);
    F.position.copy(fl);
    const fdir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion);
    F.target.position.copy(this.cam.position).addScaledVector(fdir, 8);
    F.target.updateMatrixWorld();
    const smoke = s?.lockdown?.active && zoneOf(this.pos.x, this.pos.z) === 'escape';
    const flick = this.world.flashFlicker > 0 && Math.random() < this.world.flashFlicker * 0.25 ? 0.15 : 1;
    F.intensity = (this.flashOn ? (this.inspect ? 5 : smoke ? 7 : 22) : this.inspect ? 2.5 : 0) * flick;
    F.angle = this.inspect ? 0.95 : smoke ? 0.6 : 0.48;
    this.lens.material.color.setHex(this.flashOn ? 0xfff6dc : 0x333333);
    // ---- interaction
    if (this.inspect) this.updateInspect(dt);
    else this.updateInteract();
    // radio noise: LINE's voice comes out of GHOST's walkie speaker, and GHOST talking is noise too.
    // Held briefly so gaps between words still count (the Listener hears speech, not syllables).
    const v = this.voice;
    this.radioHold = v && v.inLevel > 0.06 ? 0.6 : Math.max(0, this.radioHold - dt);
    this.txHold = v && v.tx && v.level > 0.05 ? 0.6 : Math.max(0, this.txHold - dt);
    // pose
    this.poseAcc += dt;
    if (this.poseAcc > 0.05) {
      this.poseAcc = 0;
      const flags = (this.crouching ? 1 : 0) | (this.flashOn ? 2 : 0) | (B.sprint ? 4 : 0) | (B.moving ? 8 : 0) | (this.grounded ? 0 : 16)
        | (this.radioHold > 0 ? 32 : 0) | (this.txHold > 0 ? 64 : 0) | (this.downT > 0 ? 128 : 0);
      const r3 = (v) => Math.round(v * 1000) / 1000;
      this.net.send({ t: 'pose', p: [r3(this.pos.x), r3(this.pos.y), r3(this.pos.z), r3(this.yaw), r3(this.pitch), flags] });
    }
    // local avatar (casts the shadow you'd expect, and keeps the world consistent)
    this.world.avatar.update(dt, t, [this.pos.x, this.pos.y, this.pos.z, this.yaw, this.pitch, (this.crouching ? 1 : 0) | (this.downT > 0 ? 128 : 0)]);
    // audio listener
    sfx.setListener(this.cam.position, fdir);
    const zone = zoneOf(this.pos.x, this.pos.z);
    sfx.ambience('outdoor', zone === 'gate');
    sfx.ambience('facility', zone !== 'gate');
    sfx.ambience('smoke', !!smoke);
    sfx.ambience('klaxon', !!s?.lockdown?.active && playing);
    // fade / flash (a fall fades out; if no teleport comes back, fade in anyway)
    if (this.fallT > 0 && (this.fallT -= dt) <= 0 && this.fadeTarget === 0) this.fadeTarget = 1;
    this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * 8);
    this.flashT = Math.max(0, this.flashT - dt * 1.4);
    const P = this.engine.post.uniforms;
    P.uFade.value = this.fade;
    P.uFlash.value = this.flashT * 0.8 + (s?.lockdown?.active ? (Math.sin(t * 5) * 0.5 + 0.5) * 0.18 : 0);
    this.scareT = Math.max(0, (this.scareT || 0) - dt);
    P.uStatic.value = this.scareT;
  }

  updateInteract() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.cam);
    this.raycaster.far = 2.3;
    const hits = this.raycaster.intersectObjects(this.world.hitGroup.children, false);
    let it = null;
    for (const h of hits) {
      const cand = h.object.userData.interactable;
      if (cand && (!cand.enabled || cand.enabled())) { it = cand; break; }
    }
    this.focus = it;
    const lbl = it ? (typeof it.label === 'function' ? it.label() : it.label) : '';
    this.hud.prompt(it ? (it.rawPrompt ? lbl : `[E] ${lbl}`) : '');
    if (it && this.input.hit('KeyE')) {
      if (it.inspect) this.enterInspect(it);
      else if (it.use) it.use();
    }
    if (it && it.alt && this.input.hit('KeyQ')) it.alt();
  }

  updateInspect(dt) {
    const I = this.input, insp = this.inspect.insp;
    if (I.hit('KeyE') || I.hit('Escape') || I.mouse.rclicked) { this.exitInspect(); return; }
    for (const code of I.pressed) if (insp.onKey && insp.onKey(code)) I.pressed.delete(code);
    if (insp.onHold) insp.onHold(I, dt);
    const ndc = new THREE.Vector2((I.mouse.x / window.innerWidth) * 2 - 1, -(I.mouse.y / window.innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.layers.set(LAYER.HIT);
    rc.setFromCamera(ndc, this.cam);
    const hit = rc.intersectObjects(insp.buttons || [], false)[0];
    const btn = hit?.object;
    this.hud.cursor(btn ? 'pointer' : 'default');
    if (insp.onHover) insp.onHover(btn, hit);
    if (I.mouse.clicked && btn && insp.onButton) insp.onButton(btn, hit);
  }

  render(t) {
    this.world.prepare(this.cam);
    this.engine.render(this.world.scene, this.cam, t);
  }

  dispose() { this.unsub.forEach((u) => u()); this.watchTex.dispose(); }
}

export { ZONES };
