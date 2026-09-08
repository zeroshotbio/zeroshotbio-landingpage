/* /fate_map_zebrahub — Plate II, four embryos of one age.
 *
 * This is the plate only Zebrahub can carry. Because the embryos were
 * dissociated one at a time instead of pooled, every cell still knows which
 * animal it came from, and four animals were taken at each of ten stages. So a
 * question that is normally unanswerable — how alike are two fish of the same
 * age? — becomes a column chart.
 *
 * Each column is one embryo, stacked by anatomy class as a SHARE of that
 * animal's cells rather than a count, because the four differ several-fold in
 * how many cells they yielded and a raw stack would show dissociation, not
 * biology. Beneath each stage sits the mean pairwise Jensen-Shannon divergence
 * between its four composition vectors: how far apart, in bits, four animals of
 * the same age are.
 *
 * What this is NOT: the authors' inter-embryo divergence analysis, which works
 * on gene expression and needs their DE pipeline. This is composition only, and
 * the caption says so.
 */
'use strict';

const emb = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, raf: 0,
  hover: null, cols: [],
};

const EM_M = { l: 54, r: 24, t: 46, b: 86 };

function embInit(cv, hold) { emb.cv = cv; emb.hold = hold; embResize(); }

function embResize() {
  emb.W = emb.hold.clientWidth;
  emb.H = Math.max(420, Math.min(560, emb.W * 0.36));
  emb.hold.style.height = emb.H + 'px';
  const r = zhSizeCanvas(emb.cv, emb.W, emb.H);
  emb.ctx = r.ctx;
  embDraw();
}

function embDraw() {
  if (emb.raf) return;
  emb.raf = requestAnimationFrame(() => { emb.raf = 0; embPaint(); });
}

function embPaint() {
  const ctx = emb.ctx, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const rule = css.getPropertyValue('--rule').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const sel = css.getPropertyValue('--select').trim();
  const paper = css.getPropertyValue('--paper').trim();
  ctx.clearRect(0, 0, emb.W, emb.H);

  const stages = ZH.embryos, nS = stages.length;
  const plotW = emb.W - EM_M.l - EM_M.r;
  const plotH = emb.H - EM_M.t - EM_M.b;
  const gW = plotW / nS;
  const barW = Math.min(16, (gW - 14) / 4);
  const iso = state.iso;
  emb.cols = [];

  // y axis: share of the animal's cells
  ctx.strokeStyle = rule2; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (let f = 0; f <= 1.0001; f += 0.25) {
    const y = EM_M.t + (1 - f) * plotH;
    ctx.moveTo(EM_M.l, y); ctx.lineTo(emb.W - EM_M.r, y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ink3; ctx.font = '500 9.5px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let f = 0; f <= 1.0001; f += 0.25)
    ctx.fillText(Math.round(f * 100) + '%', EM_M.l - 7, EM_M.t + (1 - f) * plotH);

  stages.forEach((s, si) => {
    const gx = EM_M.l + si * gW;
    s.embryos.forEach((e, ei) => {
      const total = e.comp.reduce((a, b) => a + b, 0) || 1;
      const x = gx + (gW - 4 * barW - 3 * 4) / 2 + ei * (barW + 4);
      let acc = 0;
      for (let c = 0; c < e.comp.length; c++) {
        const frac = e.comp[c] / total;
        if (frac <= 0) continue;
        const y0 = EM_M.t + (1 - acc) * plotH;
        const y1 = EM_M.t + (1 - acc - frac) * plotH;
        const on = !iso.size || iso.has(c);
        if (on && iso.size) {
          ctx.fillStyle = css.getPropertyValue('--t' + ([...iso].indexOf(c) % 7)).trim();
          ctx.globalAlpha = 0.85;
        } else {
          ctx.fillStyle = ink;
          // one ink, banded by depth so ten classes read as strata not colours
          ctx.globalAlpha = iso.size ? 0.07 : (0.13 + 0.055 * (c % 5));
        }
        ctx.fillRect(x, y1, barW, y0 - y1);
        if (y0 - y1 > 2.5) {         // separate the strata without using colour
          ctx.globalAlpha = 1; ctx.fillStyle = paper;
          ctx.fillRect(x, y1, barW, 0.6);
        }
        acc += frac;
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = (emb.hover && emb.hover.s === si && emb.hover.e === ei) ? sel : rule2;
      ctx.lineWidth = (emb.hover && emb.hover.s === si && emb.hover.e === ei) ? 1.6 : 0.7;
      ctx.strokeRect(x - 0.5, EM_M.t - 0.5, barW + 1, plotH + 1);
      emb.cols.push({ s: si, e: ei, x, w: barW });
    });

    // stage label and the divergence beneath it
    ctx.fillStyle = ink3; ctx.textAlign = 'center';
    ctx.font = '600 10px ui-sans-serif,system-ui,sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(s.timepoint, gx + gW / 2, EM_M.t + plotH + 8);
    ctx.font = 'italic 10.5px Georgia,serif';
    ctx.fillText(s.jsd_mean.toFixed(3), gx + gW / 2, EM_M.t + plotH + 24);
    // a small bar for the divergence, on a shared scale
    const maxJ = Math.max(...stages.map(q => q.jsd_mean));
    const bh = (s.jsd_mean / maxJ) * 26;
    ctx.fillStyle = ink; ctx.globalAlpha = 0.5;
    ctx.fillRect(gx + gW / 2 - 11, EM_M.t + plotH + 40 + (26 - bh), 22, bh);
    ctx.globalAlpha = 1;
    if (si) {
      ctx.strokeStyle = rule2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx, EM_M.t - 10); ctx.lineTo(gx, EM_M.t + plotH + 4); ctx.stroke();
    }
  });

  ctx.fillStyle = ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'italic 11px Georgia,serif';
  ctx.fillText('composition of each animal', EM_M.l, EM_M.t - 14);
  ctx.textAlign = 'right';
  ctx.fillText('below: mean divergence between the four, in bits', emb.W - EM_M.r, EM_M.t - 14);
}

function embPick(px, py) {
  for (const c of emb.cols)
    if (px >= c.x - 3 && px <= c.x + c.w + 3 && py >= EM_M.t - 4 &&
        py <= emb.H - EM_M.b + 4) return c;
  return null;
}
