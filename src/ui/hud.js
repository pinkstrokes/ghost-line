// Full-resolution HTML overlay on top of the pixelated canvas.

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="prompt"></div>
      <div id="objective"></div>
      <div id="toasts"></div>
      <div id="inspect-hint"></div>
      <div id="radio"><span class="dot"></span><span class="lbl">RADIO</span></div>
      <div id="clickToPlay">CLICK TO CAPTURE THE MOUSE · OR CLICK-AND-DRAG TO LOOK</div>
      <div id="keys"></div>
      <div id="scare"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><rect width="100" height="100" fill="#050303"/><ellipse cx="50" cy="52" rx="27" ry="40" fill="#b9bcae"/><ellipse cx="50" cy="66" rx="20" ry="22" fill="#a4a797"/><ellipse cx="40" cy="44" rx="6" ry="3.2" fill="#0a0505"/><ellipse cx="60" cy="44" rx="6" ry="3.2" fill="#0a0505"/><rect x="34" y="72" width="32" height="3" rx="1.5" fill="#0a0505"/></svg></div>
    `;
    this.$ = (id) => root.querySelector('#' + id);
    this.objTimer = 0;
  }
  show(v) { this.root.style.display = v ? 'block' : 'none'; }
  prompt(t) { const el = this.$('prompt'); if (el.textContent !== t) el.textContent = t; }
  crosshair(v) { this.$('crosshair').style.display = v ? 'block' : 'none'; }
  objective(text) {
    const el = this.$('objective');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this.objTimer);
    this.objTimer = setTimeout(() => el.classList.remove('on'), 9000);
  }
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.$('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4600);
  }
  setInspect(hint, on, back = '[E]/[ESC] BACK') {
    const el = this.$('inspect-hint');
    el.textContent = hint ? `${hint}   ·   ${back}` : '';
    el.style.display = on ? 'block' : 'none';
    document.body.classList.toggle('inspecting', !!on);
    if (on) this.keys('');
    this.crosshair(!on);
    if (!on) this.cursor('default');
  }
  cursor(c) { if (this.lastCursor !== c) { document.body.style.cursor = c; this.lastCursor = c; } }
  radio(state) {
    if (state === undefined) state = this.lastRadio || '';
    this.lastRadio = state;
    const el = this.$('radio');
    el.className = state;
    el.querySelector('.lbl').textContent = state === 'tx' ? 'TX  ·  TALKING' : state === 'rx' ? 'RX  ·  INCOMING' : state === 'off' ? 'RADIO OFF' : (this.openMic ? 'RADIO  ·  OPEN MIC' : `RADIO  [${this.pttLabel || 'V'}]`);
  }
  scare() {
    const el = this.$('scare');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this.scareTimer);
    this.scareTimer = setTimeout(() => el.classList.remove('on'), 520);
  }
  keys(text) { const el = this.$('keys'); el.innerHTML = text; el.classList.toggle('on', !!text); }
  paused(v) { this.$('clickToPlay').style.display = v ? 'block' : 'none'; }
}
