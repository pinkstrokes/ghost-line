// Walkie-talkie voice over WebRTC. Signalling rides our own websocket; no STUN/TURN,
// so it works on a LAN or between two windows on one machine. Incoming audio goes through
// a band-pass + soft clip "radio" chain with a hiss bed and squelch clicks.

export class Voice {
  constructor({ net, role, sfx, hud, mode = 'hold' }) {
    this.net = net; this.role = role; this.sfx = sfx; this.hud = hud;
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

  onState(s) {
    const other = this.role === 'agent' ? s.players.handler : s.players.agent;
    const present = other && other.connected;
    if (!present && this.pc) this.closePeer();
    if (present && !this.pc && !this.local && this.mode !== 'off') this.ensurePeer();
  }

  ensurePeer() {
    if (this.pc || this.local) return;
    const pc = (this.pc = new RTCPeerConnection({ iceServers: [] }));
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.sender = tr.sender;
    if (this.track) this.sender.replaceTrack(this.track);
    pc.onicecandidate = (e) => { if (e.candidate) this.net.send({ t: 'rtc', d: { type: 'ice', c: e.candidate } }); };
    pc.ontrack = (e) => this.playRemote(e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      this.connected = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed') { this.closePeer(); setTimeout(() => this.ensurePeer(), 1500); }
    };
    if (this.role === 'agent') this.makeOffer();
    else this.net.send({ t: 'rtc', d: { type: 'hello' } });
  }

  async makeOffer() {
    const pc = this.pc;
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.net.send({ t: 'rtc', d: { type: 'offer', sdp: pc.localDescription } });
  }

  closePeer() {
    try { this.pc?.close(); } catch { /* */ }
    this.pc = null; this.sender = null; this.connected = false;
  }

  async onSignal(d) {
    if (!d || this.local || this.mode === 'off') return;
    if (d.type === 'hello') {
      if (this.role === 'agent') { this.closePeer(); this.ensurePeer(); }
      return;
    }
    if (d.type === 'ptt') { this.remoteTx = !!d.on; this.sfx.squelch(d.on); return; }
    if (!this.pc) this.ensurePeer();
    const pc = this.pc;
    try {
      if (d.type === 'offer') {
        if (pc.signalingState !== 'stable') { this.closePeer(); this.ensurePeer(); }
        await this.pc.setRemoteDescription(d.sdp);
        const ans = await this.pc.createAnswer();
        await this.pc.setLocalDescription(ans);
        this.net.send({ t: 'rtc', d: { type: 'answer', sdp: this.pc.localDescription } });
      } else if (d.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(d.sdp);
      } else if (d.type === 'ice') {
        await pc.addIceCandidate(d.c).catch(() => {});
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
    if (this.mode === 'hold' && this.track) {
      const want = input.down('KeyV') && !(input.textCapture && input.textCapture.active);
      this.setTx(want);
    }
    const lv = this.track && this.track.enabled ? this.rms(this.micAn) : 0;
    this.level += (lv - this.level) * Math.min(1, dt * 15);
    const il = this.rms(this.inAn);
    this.inLevel += (il - this.inLevel) * Math.min(1, dt * 18);
    if (this.hiss && this.sfx.ctx) this.hiss.gain.setTargetAtTime(this.remoteTx || this.mode === 'open' ? 0.018 : 0, this.sfx.ctx.currentTime, 0.05);
    if (this.onLevel) this.onLevel(this.level || this.rms(this.micAn));
    if (this.hud) {
      const st = this.mode === 'off' ? 'off' : this.tx ? 'tx' : (this.remoteTx || this.inLevel > 0.02) ? 'rx' : '';
      if (st !== this.lastHud) { this.hud.radio(st); this.lastHud = st; }
    }
  }

  dispose() { this.unsub(); this.unsub2(); this.closePeer(); this.stream?.getTracks().forEach((t) => t.stop()); }
}
