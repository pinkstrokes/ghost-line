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
      <div id="clickToPlay">点击画面锁定鼠标 · 或按住拖动来看</div>
      <div id="keys"></div>
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
  setInspect(hint, on) {
    const el = this.$('inspect-hint');
    el.textContent = hint ? `${hint}   ·   [E]/[ESC] BACK` : '';
    el.style.display = on ? 'block' : 'none';
    this.crosshair(!on);
    if (!on) this.cursor('default');
  }
  cursor(c) { if (this.lastCursor !== c) { document.body.style.cursor = c; this.lastCursor = c; } }
  radio(state) {
    const el = this.$('radio');
    el.className = state;
    el.querySelector('.lbl').textContent = state === 'tx' ? 'TX  ·  TALKING' : state === 'rx' ? 'RX  ·  INCOMING' : state === 'off' ? 'RADIO OFF' : 'RADIO  [V / OPTION]';
  }
  keys(text) { const el = this.$('keys'); el.innerHTML = text; el.classList.toggle('on', !!text); }
  paused(v) { this.$('clickToPlay').style.display = v ? 'block' : 'none'; }
}
