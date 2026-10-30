// Walkie-talkie voice over WebRTC. Signalling rides our own websocket; no STUN/TURN,
// so it works on a LAN or between two windows on one machine. Incoming audio goes through
// a band-pass + soft clip "radio" chain with a hiss bed and squelch clicks.

export class Voice {
  constructor({ net, role, sfx, hud, mode = 'hold', getState }) {
    this.net = net; this.role = role; this.sfx = sfx; this.hud = hud;
    this.getState = getState;
    this.mode = mode;
    this.stream = null; this.track = null;
    this.pc = null; this.sender = null;
    this.connected = false;
    this.tx = false; this.remoteTx = false;
    this.level = 0; this.inLevel = 0;
    this.onLevel = null;
    this.view = null;
    this.unsub = net.on('rtc', (m) => this.onSignal(m.d));
    this.unsub2 = net.on('state', (m) => this.onState(m.s));
  }

  setMode(m) {
    this.mode = m;
    if (m === 'off') this.setTx(false);
    if (m === 'open' && this.track) this.setTx(true);
  }

  attach(view) { this.view = view; }

  async enable() {
    if (this.local || this.mode === 'off') return false;
    this.sfx.init();
    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch {
        this.hud?.toast('没有麦克风权限 — 可以用 Discord 或面对面说话', 'bad');
        return false;
      }
      this.track = this.stream.getAudioTracks()[0];
      this.track.enabled = this.mode === 'open';
      const ctx = this.sfx.ctx;
      const src = ctx.createMediaStreamSource(this.stream);
      this.micAn = ctx.createAnalyser();
      this.micAn.fftSize = 512;
      src.connect(this.micAn);
      if (this.sender) await this.sender.replaceTrack(this.track);
    }
    this.ensurePeer();
    return true;
  }

  // Test hook: a synthetic tone instead of the microphone (headless browsers can't open a mic).
  async enableFake() {
    const ctx = this.sfx.init();
    const osc = ctx.createOscillator(); osc.frequency.value = 440;
    const g = ctx.createGain(); g.gain.value = 0.4;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(g).connect(dest); osc.start();
    this.stream = dest.stream;
    this.track = this.stream.getAudioTracks()[0];
    this.track.enabled = this.mode === 'open';
    this.micAn = ctx.createAnalyser(); this.micAn.fftSize = 512;
    g.connect(this.micAn);
    if (this.sender) await this.sender.replaceTrack(this.track);
    this.ensurePeer();
    return true;
  }

  // Signalling: GHOST always offers, LINE always answers. Every offer carries a session id;
  // LINE rebuilds its peer only for a new id and asks for an offer (hello) at most every 4 s.
  onState(s) {
    this.lastState = s;
    if (this.local || this.mode === 'off') return;
    const other = this.role === 'agent' ? s.players.handler : s.players.agent;
    const present = other && other.connected;
    if (!present) { if (this.pc) this.closePeer(); return; }
    if (this.role === 'agent' && !this.pc) this.offer();
    if (this.role === 'handler' && !this.pc) this.hello();
  }

  ensurePeer() {
    if (this.local || this.mode === 'off') return;
    if (this.role === 'agent') { if (!this.pc) this.offer(); }
    else if (!this.pc) this.hello();
  }

  hello() {
    const now = performance.now();
    if (now - (this.lastHello || -1e9) < 2500) return;
    (this.dbg ||= []).push(`${Math.round(now)} hello`);
    this.lastHello = now;
    this.net.send({ t: 'rtc', d: { type: 'hello' } });
  }

  // called once a second from update(): retry until the link is up
  watchdog() {
    const s = this.getState?.() || this.lastState;
    if (!s || this.local || this.mode === 'off') return;
    const other = this.role === 'agent' ? s.players.handler : s.players.agent;
    if (!other?.connected || this.connected) return;
    // Negotiation can legitimately take many seconds (first audio-device init on some machines),
    // so only restart a handshake that has clearly stalled.
    const age = performance.now() - (this.pcAt || 0);
    const dead = this.pc && ['failed', 'closed'].includes(this.pc.connectionState);
    if (this.role === 'agent') { if (!this.pc || dead || age > 30000) this.offer(); }
    else if (!this.pc || dead || age > 32000) this.hello();
  }

  makePeer(sid) {
    this.closePeer();
    const pc = (this.pc = new RTCPeerConnection({ iceServers: [] }));
    this.pcAt = performance.now();
    this.sid = sid;
    pc.onicecandidate = (e) => { if (e.candidate) this.net.send({ t: 'rtc', d: { type: 'ice', sid, c: e.candidate } }); };
    pc.ontrack = (e) => this.playRemote(e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      (this.dbg ||= []).push(`${Math.round(performance.now())} state ${pc.connectionState} ice=${pc.iceConnectionState}`);
      this.connected = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer();
        setTimeout(() => this.ensurePeer(), 2000);
      }
    };
    return pc;
  }

  async offer() {
    (this.dbg ||= []).push(`${Math.round(performance.now())} offer`);
    const sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const pc = this.makePeer(sid);
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.sender = tr.sender;
    if (this.track) await this.sender.replaceTrack(this.track);
    const off = await pc.createOffer();
    if (this.pc !== pc) return;
    await pc.setLocalDescription(off);
    this.net.send({ t: 'rtc', d: { type: 'offer', sid, sdp: pc.localDescription } });
  }

  closePeer() {
    const pc = this.pc;
    this.pc = null; this.sender = null; this.connected = false;
    try { pc?.close(); } catch { /* */ }
  }

  async onSignal(d) {
    if (!d || this.local || this.mode === 'off') return;
    (this.dbg ||= []).push(`${Math.round(performance.now())} in ${d.type} ${d.sid || ''} pc=${!!this.pc} sid=${this.sid || ''}`);
    if (d.type === 'ptt') { this.remoteTx = !!d.on; this.sfx.squelch(d.on); return; }
    try {
      if (d.type === 'hello' && this.role === 'agent') {
        // LINE (re)joined or lost its peer: offer again unless a fresh offer is already in flight
        if (!this.connected && (!this.pc || performance.now() - this.pcAt > 3000)) await this.offer();
        return;
      }
      if (d.type === 'offer' && this.role === 'handler') {
        const pc = this.makePeer(d.sid);
        await pc.setRemoteDescription(d.sdp);
        const tr = pc.getTransceivers()[0];
        if (tr) { tr.direction = 'sendrecv'; this.sender = tr.sender; if (this.track) await this.sender.replaceTrack(this.track); }
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        this.net.send({ t: 'rtc', d: { type: 'answer', sid: d.sid, sdp: pc.localDescription } });
        for (const c of this.pendingIce?.[d.sid] || []) await pc.addIceCandidate(c).catch(() => {});
        return;
      }
      if (d.type === 'answer' && this.role === 'agent' && d.sid === this.sid && this.pc?.signalingState === 'have-local-offer') {
        await this.pc.setRemoteDescription(d.sdp);
        return;
      }
      if (d.type === 'ice') {
        if (this.pc && d.sid === this.sid && this.pc.remoteDescription) await this.pc.addIceCandidate(d.c).catch(() => {});
        else ((this.pendingIce ||= {})[d.sid] ||= []).push(d.c);
      }
    } catch (e) { console.warn('rtc', e); }
  }

  playRemote(stream) {
    const ctx = this.sfx.ctx || this.sfx.init();
    // Chrome only pulls remote WebRTC audio into WebAudio if a media element is consuming it.
    if (!this.audioEl) { this.audioEl = new Audio(); this.audioEl.muted = true; }
    this.audioEl.srcObject = stream;
    this.audioEl.play().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 340;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3100;
    const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 1700; peak.gain.value = 6;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 3.2) * 0.9; }
    shaper.curve = curve;
    const g = ctx.createGain(); g.gain.value = 1.6;
    this.inAn = ctx.createAnalyser(); this.inAn.fftSize = 512;
    src.connect(this.inAn);
    src.connect(hp).connect(lp).connect(peak).connect(shaper).connect(g).connect(this.sfx.voiceBus);
    // hiss bed while the other side holds the button
    const n = ctx.createBufferSource(); n.buffer = this.sfx.white; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 0.4;
    this.hiss = ctx.createGain(); this.hiss.gain.value = 0;
    n.connect(nf).connect(this.hiss).connect(this.sfx.voiceBus);
    n.start();
  }

  setTx(on) {
    if (this.tx === on) return;
    this.tx = on;
    if (this.track) this.track.enabled = on;
    if (this.mode === 'hold') {
      this.sfx.squelch(on);
      this.net.send({ t: 'rtc', d: { type: 'ptt', on } });
    }
  }

  rms(an) {
    if (!an) return 0;
    const buf = (this._buf ||= new Float32Array(512));
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  update(dt, input) {
    this.wdT = (this.wdT || 0) + dt;
    if (this.wdT > 1) { this.wdT = 0; this.watchdog(); }
    if (this.mode === 'hold' && this.track) {
      // V, or Option/Alt (which still works while LINE is typing in the terminal)
      const want = (input.down('KeyV') && !(input.textCapture && input.textCapture.active)) || input.down('AltLeft') || input.down('AltRight');
      this.setTx(want);
    }
    const lv = this.track && this.track.enabled ? this.rms(this.micAn) : 0;
    this.level += (lv - this.level) * Math.min(1, dt * 15);
    const il = this.rms(this.inAn);
    this.inLevel += (il - this.inLevel) * Math.min(1, dt * 18);
    // if the AudioContext isn't running (autoplay policy, device hiccup) fall back to plain playback
    if (this.audioEl) {
      const plain = !this.sfx.ctx || this.sfx.ctx.state !== 'running';
      if (this.audioEl.muted === plain) { this.audioEl.muted = !plain; this.audioEl.volume = Math.min(1, this.sfx.vol.voice * this.sfx.vol.master); if (plain) this.audioEl.play().catch(() => {}); }
    }
    if (this.hiss && this.sfx.ctx) this.hiss.gain.setTargetAtTime(this.remoteTx || this.mode === 'open' ? 0.018 : 0, this.sfx.ctx.currentTime, 0.05);
    if (this.onLevel) this.onLevel(this.level || this.rms(this.micAn));
    if (this.hud) {
      const st = this.mode === 'off' ? 'off' : this.tx ? 'tx' : (this.remoteTx || this.inLevel > 0.02) ? 'rx' : '';
      if (st !== this.lastHud) { this.hud.radio(st); this.lastHud = st; }
    }
  }

  dispose() { this.unsub(); this.unsub2(); this.closePeer(); this.stream?.getTracks().forEach((t) => t.stop()); }
}
