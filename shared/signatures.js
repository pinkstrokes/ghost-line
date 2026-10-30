// Contact-microphone signatures. The vault scope (LINE's terminal) and Fig. V-2 on the
// blueprint are both drawn from these functions, so what LINE studies is what LINE will see.

const bump = (t, c, w, a) => { const x = (t - c) / w; return a * Math.exp(-x * x) * Math.cos(x * 2.2); };
const ring = (t, start, a) => (t > start && t < start + 0.35 ? Math.sin((t - start) * 90) * a * 0.35 * Math.exp(-(t - start) * 12) : 0);
// deterministic pseudo-noise so the printed figure is stable
const pn = (t) => { const x = Math.sin(t * 12345.678) * 43758.5453; return (x - Math.floor(x)) - 0.5; };

export const SIG = {
  tick: (t) => (t < 0.03 ? Math.sin(t * 600) * (1 - t / 0.03) * 0.18 : 0),
  alpha: (t) => bump(t, 0.05, 0.02, 0.55) + bump(t, 0.13, 0.025, 0.95) + ring(t, 0.16, 0.5),
  beta: (t) => bump(t, 0.05, 0.025, 0.95) + bump(t, 0.13, 0.02, 0.55) + ring(t, 0.16, 0.45),
  gamma: (t) => bump(t, 0.05, 0.018, 0.6) + bump(t, 0.12, 0.018, 0.62) + bump(t, 0.19, 0.018, 0.6),
  pickup: (t) => (t < 0.9 ? Math.sin(t * 55) * Math.sin((t / 0.9) * Math.PI) * 0.5 : 0),
  slip: (t) => (t < 0.05 ? -0.95 * (1 - t / 0.05) : t < 0.45 ? pn(t) * 1.4 * (1 - (t - 0.05) / 0.4) : 0),
};
export const SIG_NAMES = { alpha: 'α', beta: 'β', gamma: 'γ', pickup: 'δ', slip: 'ε' };
