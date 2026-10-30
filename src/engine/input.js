// Keyboard / mouse state with pointer lock. One instance shared by whichever view is active.

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, x: 0, y: 0, buttons: 0, wheel: 0, clicked: false, rclicked: false, down: false };
    this.locked = false;
    this.enabled = true;
    this.textCapture = null; // fn(e) -> true if consumed (terminal typing)
    this.dragLook = true; // without pointer lock, drag with the mouse to look
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (this.textCapture && this.textCapture(e)) { e.preventDefault(); return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'].includes(e.code)) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ['KeyW', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      else if (this.mouse.down && this.dragLook) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; this.mouse.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY); }
    });
    el.addEventListener('mousedown', (e) => {
      this.mouse.buttons = e.buttons;
      this.mouse.down = true;
      if (e.button === 0) this.mouse.clicked = true;
      if (e.button === 2) this.mouse.rclicked = true;
      this.mouse.dragStart = { x: e.clientX, y: e.clientY };
      this.mouse.dragDist = 0;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons = e.buttons; this.mouse.down = e.buttons !== 0; this.mouse.released = true;
      if (e.button === 0 && (this.mouse.dragDist || 0) < 6) this.mouse.tapped = true;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }
  // look deltas: pointer-locked movement, or drag while unlocked (fallback for browsers/webviews without lock)
  get lookActive() { return this.locked || (this.dragLook && this.mouse.down); }
  lock() {
    if (this.locked) return;
    try { const p = this.el.requestPointerLock({ unadjustedMovement: false }); if (p && p.catch) p.catch(() => {}); } catch { /* ignored */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.clicked = false; this.mouse.rclicked = false; this.mouse.released = false; this.mouse.tapped = false;
  }
}
