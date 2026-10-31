import { generateMission } from '../../shared/mission.js';
import { SHEETS, SHEET_W, SHEET_H } from './sheets.js';
import { setTheme } from './style.js';

// Printable record set: /blueprint.html?seed=XXXXXX&diff=operative[&ink=save]
// The seed is shown in the lobby/loading screen, so LINE can print the exact set for this run.

const q = new URLSearchParams(location.search);
const seed = q.get('seed');
const diff = q.get('diff') || 'operative';
document.title = `KESTREL-9 RECORD SET ${seed || ''}`;
document.body.style.cssText = 'margin:0;background:#1b1d20;color:#ddd;font:14px Menlo,monospace';

const style = document.createElement('style');
style.textContent = `
  @page { size: A4 landscape; margin: 6mm; }
  .bar { padding: 14px 18px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:#111; position:sticky; top:0; z-index:2 }
  .bar input, .bar select, .bar button { font: inherit; padding: 6px 10px; background:#222; color:#eee; border:1px solid #555 }
  .sheet { display:block; width: min(100%, 1400px); margin: 16px auto; box-shadow: 0 10px 30px #000; }
  @media print { .bar { display:none } body { background:#fff } .sheet { width:100%; margin:0; box-shadow:none; page-break-after: always; } }
`;
document.head.appendChild(style);

const bar = document.createElement('div');
bar.className = 'bar';
bar.innerHTML = `<b>KESTREL-9 RECORD SET</b>
  <label>SEED <input id="seed" value="${seed || ''}" placeholder="from the lobby" style="width:110px;text-transform:uppercase"></label>
  <label>DIFFICULTY <select id="diff"><option value="recruit">RECRUIT</option><option value="operative">OPERATIVE</option><option value="ghost">GHOST</option></select></label>
  <label><input type="checkbox" id="ink" ${q.get('ink') ? 'checked' : ''}> Ink saver (white paper)</label>
  <button id="go">GENERATE</button><button id="print">PRINT</button>
  <span style="color:#888">The seed is shown in the lobby and on the end screen. Blueprints change with every seed — an old printout won't match a new mission.</span>`;
document.body.appendChild(bar);
bar.querySelector('#diff').value = diff;
bar.querySelector('#go').onclick = () => {
  const s = bar.querySelector('#seed').value.trim().toUpperCase();
  location.search = `?seed=${encodeURIComponent(s)}&diff=${bar.querySelector('#diff').value}${bar.querySelector('#ink').checked ? '&ink=save' : ''}`;
};
bar.querySelector('#print').onclick = () => window.print();

if (seed) {
  if (q.get('ink')) setTheme('print');
  const m = generateMission(seed.toUpperCase(), diff);
  const PX = 4; // px per mm
  for (const sh of SHEETS) {
    const c = document.createElement('canvas');
    c.width = SHEET_W * PX; c.height = SHEET_H * PX;
    c.className = 'sheet';
    const ctx = c.getContext('2d');
    ctx.scale(PX, PX);
    sh.draw(ctx, m);
    document.body.appendChild(c);
  }
}
