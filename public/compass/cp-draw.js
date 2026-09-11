/* /compass — drawing primitives shared by the plates.
 *
 * The furniture (frames, rules, guide lines) is drawn with a small deterministic pen wobble.
 * Data marks are drawn exactly: no jitter, no smoothing, no nudging. Keep it that way — if you
 * need a wobble, it belongs in penLine/penRect, never in a data path.
 */
'use strict';

const INK = {};
function readInks() {
  const cs = getComputedStyle(document.documentElement);
  ['paper', 'paper-deep', 'ink', 'ink-2', 'ink-3', 'rule', 'rule-2', 'select', 't0', 't1', 't2', 't3', 't4', 't5', 't6']
    .forEach((k) => { INK[k] = cs.getPropertyValue('--' + k).trim(); });
  INK.serif = cs.getPropertyValue('--serif').trim();
  INK.sans = cs.getPropertyValue('--sans').trim();
}

function rgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* Size a canvas to its parent at devicePixelRatio (capped at 2) and work in CSS pixels.
 * A plate that cannot be read below a certain width declares data-minw; on a narrower screen it
 * keeps that width and its holder scrolls sideways, rather than being squeezed illegible. */
function setup(cv) {
  const avail = cv.parentElement.clientWidth, minW = +(cv.dataset.minw || 0);
  const W = Math.max(280, avail, minW);
  const H = Math.round(W * parseFloat(cv.dataset.aspect || '0.6'));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
  cv.style.width = W > avail ? W + 'px' : '';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  return { ctx, W, H };
}

const font = {
  serif: (px, italic) => `${italic ? 'italic ' : ''}${px}px ${INK.serif}`,
  sans: (px) => `${px}px ${INK.sans}`,
};

/* A line drawn as a pen would draw it. Furniture only. */
function penLine(ctx, x1, y1, x2, y2, seed = 1, color = INK.ink, width = 0.8) {
  const L = Math.hypot(x2 - x1, y2 - y1), N = Math.max(2, Math.round(L / 6));
  const nx = -(y2 - y1) / (L || 1), ny = (x2 - x1) / (L || 1);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = 0.35 * Math.sin(3.1 * t * Math.PI + seed) + 0.22 * Math.sin(7.3 * t * Math.PI + seed * 2.3);
    const x = x1 + (x2 - x1) * t + nx * w, y = y1 + (y2 - y1) * t + ny * w;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function penRect(ctx, x, y, w, h, seed = 1, color = INK.rule, width = 0.8) {
  penLine(ctx, x, y, x + w, y, seed, color, width);
  penLine(ctx, x + w, y, x + w, y + h, seed + 1, color, width);
  penLine(ctx, x + w, y + h, x, y + h, seed + 2, color, width);
  penLine(ctx, x, y + h, x, y, seed + 3, color, width);
}

/* Text. `back` paints a paper rectangle behind the words so they read over marks. */
function text(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.font = o.font || font.serif(13);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.spacing !== undefined && 'letterSpacing' in ctx) ctx.letterSpacing = o.spacing + 'px';
  if (o.back) {
    const m = ctx.measureText(s), w = m.width, a = o.align || 'left';
    const x0 = a === 'center' ? x - w / 2 : a === 'right' ? x - w : x;
    const hgt = parseFloat(ctx.font) || 12;
    const top = o.base === 'middle' ? y - hgt / 2 : o.base === 'top' ? y : y - hgt * 0.85;
    ctx.fillStyle = rgba(INK.paper, 0.9); ctx.fillRect(x0 - 3, top - 1, w + 6, hgt + 3);
  }
  ctx.fillStyle = o.color || INK.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* Machine furniture: small, wide-tracked, uppercase sans. */
function caps(ctx, s, x, y, o = {}) {
  text(ctx, String(s).toUpperCase(), x, y, { font: font.sans(o.size || 9.5), color: o.color || INK['ink-3'], spacing: o.spacing ?? 1.6, ...o });
}

const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const logs = (d0, d1, r0, r1) => (v) => r0 + ((Math.log10(v) - Math.log10(d0)) / (Math.log10(d1) - Math.log10(d0))) * (r1 - r0);
const nf = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => (x === null || x === undefined ? '–' : Number(x).toFixed(2));
const f3 = (x) => (x === null || x === undefined ? '–' : Number(x).toFixed(3));

/* A labelled horizontal axis with ticks (values, positions via scale). */
function axisX(ctx, sx, y, ticks, o = {}) {
  const [a, b] = o.range || [sx(ticks[0]), sx(ticks[ticks.length - 1])];
  penLine(ctx, a, y, b, y, o.seed || 3, INK['ink-3'], 0.7);
  ticks.forEach((t) => {
    const x = sx(t);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 4); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.7; ctx.stroke();
    caps(ctx, o.fmt ? o.fmt(t) : t, x, y + 15, { align: 'center', spacing: 0.6, size: 9 });
  });
  if (o.label) text(ctx, o.label, (a + b) / 2, y + 32, { font: font.serif(12.5, true), color: INK['ink-2'], align: 'center' });
}

function axisY(ctx, sy, x, ticks, o = {}) {
  const [a, b] = o.range || [sy(ticks[0]), sy(ticks[ticks.length - 1])];
  penLine(ctx, x, a, x, b, o.seed || 5, INK['ink-3'], 0.7);
  ticks.forEach((t) => {
    const y = sy(t);
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.7; ctx.stroke();
    caps(ctx, o.fmt ? o.fmt(t) : t, x - 7, y + 3, { align: 'right', spacing: 0.4, size: 9 });
  });
  if (o.label) {
    ctx.save(); ctx.translate(x - (o.labelGap || 38), (a + b) / 2); ctx.rotate(-Math.PI / 2);
    text(ctx, o.label, 0, 0, { font: font.serif(12.5, true), color: INK['ink-2'], align: 'center' });
    ctx.restore();
  }
}

/* A guide line: faint, dashed, furniture. */
function guide(ctx, x1, y1, x2, y2, color = INK.rule) {
  ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = color; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

function dot(ctx, x, y, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.1; ctx.stroke(); }
}

/* A polyline through data points (exact, not smoothed). */
function path(ctx, xs, ys, color, width = 1.3, dash) {
  ctx.save(); if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i])));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
}
