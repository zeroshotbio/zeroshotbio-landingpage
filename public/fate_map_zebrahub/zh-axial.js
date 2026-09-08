/* /fate_map_zebrahub — Plate III, the axial progenitor spending itself.
 *
 * The paper's subject is the pool of pluripotent axial progenitors that feeds
 * both the posterior spinal cord and the trunk muscle, and what happens to it
 * over five days. This plate shows that pool being consumed.
 *
 * WHAT THE CATEGORIES ARE. Every cell is scored for the paper's own marker
 * genes — sox2 / sox3 / sox19a on the neural side, tbxta / tbx16 / msgn1 on the
 * mesodermal — normalised to counts-per-10k and log1p'd, then called present
 * above a stated threshold. A cell carrying BOTH sets is the bipotent-like
 * state. That is OUR definition drawn with the authors' markers, not the
 * authors' annotation: the released object carries no NMP label at all.
 *
 * WHAT IT IS NOT. It is not RNA velocity, and it draws no arrows. The authors'
 * velocity work reads loom files the public release does not contain, so the
 * direction of travel is not ours to assert. What can be shown honestly is the
 * composition: the share of each stage's cells that still carries both
 * programmes, which falls from about 3.4% to about 0.1%.
 */
'use strict';

const ax = { cv: null, ctx: null, hold: null, W: 0, H: 0, raf: 0, hover: -1, rows: [] };
const AX_M = { l: 62, r: 232, t: 44, b: 54 };   // r fits the reading set beside the curve

function axInit(cv, hold) { ax.cv = cv; ax.hold = hold; axResize(); }

function axResize() {
  ax.W = ax.hold.clientWidth;
  ax.H = Math.max(360, Math.min(470, ax.W * 0.44));
  ax.hold.style.height = ax.H + 'px';
  const r = zhSizeCanvas(ax.cv, ax.W, ax.H);
  ax.ctx = r.ctx;
  axDraw();
}

function axDraw() {
  if (ax.raf) return;
  ax.raf = requestAnimationFrame(() => { ax.raf = 0; axPaint(); });
}

function axPaint() {
  const ctx = ax.ctx, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink2 = css.getPropertyValue('--ink-2').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const sel = css.getPropertyValue('--select').trim();
  const paper = css.getPropertyValue('--paper').trim();
  ctx.clearRect(0, 0, ax.W, ax.H);

  const stages = ZH.embryos;
  const n = stages.length;
  const plotW = ax.W - AX_M.l - AX_M.r;
  const plotH = ax.H - AX_M.t - AX_M.b;
  const X = (i) => AX_M.l + (i / (n - 1)) * plotW;

  // per-stage share of cells carrying both programmes
  const both = stages.map(s => {
    const a = s.embryos.reduce((acc, e) => acc + e.axial[3], 0);
    const t = s.embryos.reduce((acc, e) => acc + e.n, 0);
    return { frac: a / t, n: a, tot: t };
  });
  const maxF = Math.max(...both.map(b => b.frac));
  const Y = (f) => AX_M.t + (1 - f / maxF) * plotH;

  // grid
  ctx.strokeStyle = rule2; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (let k = 0; k <= 4; k++) { const y = AX_M.t + (k / 4) * plotH; ctx.moveTo(AX_M.l, y); ctx.lineTo(AX_M.l + plotW, y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ink3; ctx.font = '500 9.5px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let k = 0; k <= 4; k++)
    ctx.fillText(((1 - k / 4) * maxF * 100).toFixed(1) + '%', AX_M.l - 7, AX_M.t + (k / 4) * plotH);

  // the curve, as a filled current running down and out
  ctx.beginPath();
  ctx.moveTo(X(0), AX_M.t + plotH);
  both.forEach((b, i) => ctx.lineTo(X(i), Y(b.frac)));
  ctx.lineTo(X(n - 1), AX_M.t + plotH);
  ctx.closePath();
  ctx.fillStyle = ink; ctx.globalAlpha = 0.13; ctx.fill(); ctx.globalAlpha = 1;

  ctx.beginPath();
  both.forEach((b, i) => i ? ctx.lineTo(X(i), Y(b.frac)) : ctx.moveTo(X(i), Y(b.frac)));
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.stroke();

  ax.rows = [];
  both.forEach((b, i) => {
    const x = X(i), y = Y(b.frac);
    ctx.beginPath(); ctx.arc(x, y, ax.hover === i ? 5 : 3, 0, 7);
    ctx.fillStyle = ax.hover === i ? sel : ink; ctx.fill();
    ax.rows.push({ i, x, y });
    ctx.save();
    ctx.translate(x, ax.H - AX_M.b + 10); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = ink3; ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(stages[i].timepoint, 0, 0);
    ctx.restore();
    if (ax.hover === i) {
      const lab = `${(b.frac * 100).toFixed(2)}%  ·  ${b.n.toLocaleString()} of ${b.tot.toLocaleString()}`;
      ctx.font = '600 10.5px ui-sans-serif,system-ui,sans-serif';
      const w = ctx.measureText(lab).width;
      ctx.fillStyle = paper; ctx.fillRect(x - w / 2 - 5, y - 22, w + 10, 15);
      ctx.fillStyle = sel; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lab, x, y - 14);
    }
  });

  // the reading, set beside the curve rather than under it
  const tx = AX_M.l + plotW + 20;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = ink2; ctx.font = 'italic 13px Georgia,serif';
  const lines = [
    'Cells carrying BOTH the',
    'neural and the mesodermal',
    'programme, as a share of',
    'their stage.',
    '',
    `${(both[0].frac * 100).toFixed(1)}% at ${stages[0].timepoint}`,
    `${(both[both.length - 1].frac * 100).toFixed(2)}% at ${stages[stages.length - 1].timepoint}`,
    '',
    'The pool is spent, not lost:',
    'its cells become the two',
    'things it was holding open.',
  ];
  lines.forEach((s, i) => {
    ctx.fillStyle = (i === 5 || i === 6) ? ink : ink2;
    ctx.font = (i === 5 || i === 6) ? '600 13px ui-sans-serif,system-ui,sans-serif'
                                     : 'italic 13px Georgia,serif';
    ctx.fillText(s, tx, AX_M.t + i * 18);
  });

  ctx.fillStyle = ink3; ctx.font = 'italic 11px Georgia,serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('marker-defined, not an author annotation — see the notes', AX_M.l, ax.H - 6);
}

function axPick(px, py) {
  let best = -1, bd = 22 * 22;
  for (const r of ax.rows) {
    const d = (r.x - px) ** 2 + (r.y - py) ** 2;
    if (d < bd) { bd = d; best = r.i; }
  }
  return best;
}
