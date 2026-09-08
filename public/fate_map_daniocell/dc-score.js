/* /fate_map_daniocell — Plate II, the score.
 *
 * One rule per transcriptional state, laid on a developmental time axis. This
 * plate carries TWO different measurements and the whole point is that they are
 * not the same thing:
 *
 *   LENGTH of the rule  = the OBSERVED extent. Between the 2nd and 98th
 *       percentile of the stages at which cells of this state were actually
 *       collected, with hairline whiskers to the first and last. It is a fact
 *       about the sampling.
 *
 *   WEIGHT of the ink   = the AUTHORS' PERSISTENCE measure — the median, over
 *       the state's cells, of the mean absolute stage difference between a cell
 *       and its neighbours within a fixed distance in gene-expression space.
 *       It is a fact about transcriptional similarity, computed WITHIN tissue
 *       subsets, and it is emphatically not a lifetime.
 *
 * A state can be seen across sixty hours and still be "short-term" if the cells
 * seen at 20 hpf and at 80 hpf do not look alike; that mismatch is the most
 * interesting thing on the plate and it is only visible because the two
 * measures are drawn separately. Never collapse them into one bar.
 *
 * Cycling is the third channel and it is deliberately quiet: a hollow tick for
 * states whose cells are mostly cycling, nothing for the rest.
 */
'use strict';

const score = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, dpr: 1,
  order: 'tissue',      // 'tissue' | 'onset' | 'dur'
  rows: [],             // {cl, y} in draw order, plus tissue band headers
  hover: -1, raf: 0,
};

const SC_M = { l: 132, r: 34, t: 38, b: 34 };
const ROW_H = 3.0;
const BAND_GAP = 15;

function scoreInit(cv, hold) {
  score.cv = cv; score.hold = hold; score.ctx = cv.getContext('2d');
  scoreLayout();
}

function scoreLayout() {
  const cls = DC.clusters.map((c, i) => ({ ...c, ix: i }));
  const rows = [];
  if (score.order === 'tissue') {
    const byT = new Map();
    for (const c of cls) {
      if (!byT.has(c.tissue)) byT.set(c.tissue, []);
      byT.get(c.tissue).push(c);
    }
    // tissues in the atlas's own order, each block sorted by first appearance
    for (const t of DC.meta.tissues.map(x => x.key)) {
      const g = byT.get(t);
      if (!g) continue;
      g.sort((a, b) => a.span_lo - b.span_lo || a.span_hi - b.span_hi);
      rows.push({ band: t, n: g.length });
      for (const c of g) rows.push({ cl: c });
    }
  } else if (score.order === 'onset') {
    cls.sort((a, b) => a.span_lo - b.span_lo || a.span_hi - b.span_hi);
    for (const c of cls) rows.push({ cl: c });
  } else {
    cls.sort((a, b) => (b.persistence_median ?? -1) - (a.persistence_median ?? -1));
    for (const c of cls) rows.push({ cl: c });
  }
  let y = SC_M.t;
  for (const r of rows) {
    if (r.band) { y += BAND_GAP; r.y = y; y += 4; }
    else { r.y = y; y += ROW_H; }
  }
  score.rows = rows;
  score.contentH = y + SC_M.b;
  scoreResize();
}

function scoreResize() {
  score.dpr = Math.min(window.devicePixelRatio || 1, 2);
  score.W = score.hold.clientWidth;
  score.H = score.contentH;
  score.hold.style.height = score.H + 'px';
  score.cv.width = Math.round(score.W * score.dpr);
  score.cv.height = Math.round(score.H * score.dpr);
  score.cv.style.height = score.H + 'px';
  score.ctx.setTransform(score.dpr, 0, 0, score.dpr, 0, 0);
  scoreDraw();
}

const HPF0 = 0, HPF1 = 122;
const scX = (h) => SC_M.l + (h - HPF0) / (HPF1 - HPF0) * (score.W - SC_M.l - SC_M.r);

function scoreDraw() {
  if (score.raf) return;
  score.raf = requestAnimationFrame(() => { score.raf = 0; scorePaint(); });
}

function scorePaint() {
  const ctx = score.ctx, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const rule = css.getPropertyValue('--rule').trim();
  const sel = css.getPropertyValue('--select').trim();
  const paper = css.getPropertyValue('--paper').trim();
  ctx.clearRect(0, 0, score.W, score.H);

  // time grid
  ctx.strokeStyle = rule2; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (let h = 0; h <= 120; h += 12) { const x = scX(h); ctx.moveTo(x, SC_M.t - 8); ctx.lineTo(x, score.H - SC_M.b + 4); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ink3; ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (let h = 0; h <= 120; h += 12) ctx.fillText(h + (h === 120 ? ' hpf' : ''), scX(h), SC_M.t - 12);

  const iso = state.iso;
  for (const r of score.rows) {
    if (r.band) {
      ctx.fillStyle = ink3;
      ctx.font = '600 9.5px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.letterSpacing = '0.16em';
      ctx.fillText(r.band.toUpperCase(), 6, r.y);
      ctx.restore();
      ctx.strokeStyle = rule2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(SC_M.l, r.y + 0.5); ctx.lineTo(score.W - SC_M.r, r.y + 0.5); ctx.stroke();
      continue;
    }
    const c = r.cl, y = r.y + ROW_H / 2;
    const on = !iso.size || iso.has(DC.tissueIx[c.tissue]);
    const pm = c.persistence_median ?? 0;
    // ink weight carries persistence; the long-term states are the dark ones
    const a = on ? Math.min(0.92, 0.14 + (pm / 60) * 0.85) : 0.05;
    const lt = pm >= DC.meta.long_term_hours;

    // whiskers: the extreme stages this state was seen at
    ctx.strokeStyle = ink; ctx.globalAlpha = a * 0.35; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(scX(c.span_first), y); ctx.lineTo(scX(c.span_last), y); ctx.stroke();

    // the rule itself: the 2-98% observed extent
    ctx.strokeStyle = (score.hover === c.ix) ? sel : ink;
    ctx.globalAlpha = (score.hover === c.ix) ? 1 : a;
    ctx.lineWidth = lt ? 2.2 : 1.4;
    ctx.beginPath(); ctx.moveTo(scX(c.span_lo), y); ctx.lineTo(scX(c.span_hi), y); ctx.stroke();

    // cycling: a hollow tick at the median, and only when it is the majority
    if (c.cycling_frac > 0.5) {
      ctx.globalAlpha = a; ctx.strokeStyle = ink; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(scX(c.span_median), y, 1.7, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // the long-term threshold, named
  ctx.fillStyle = ink3; ctx.font = 'italic 11px Georgia,serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const note = `heavier rules are the states the authors call long-term — ` +
    `${DC.meta.long_term_hours} hours or more`;
  ctx.fillText(note, SC_M.l, score.H - SC_M.b + 10);

  // hovered state, written out
  if (score.hover >= 0) {
    const c = DC.clusters[score.hover];
    const r = score.rows.find(q => q.cl && q.cl.ix === score.hover);
    if (r) {
      const label = `${c.id} · ${c.identity || 'unannotated'}`;
      ctx.font = '600 10.5px ui-sans-serif,system-ui,sans-serif';
      const w = ctx.measureText(label).width;
      ctx.fillStyle = paper; ctx.fillRect(SC_M.l - w - 12, r.y - 6, w + 8, 13);
      ctx.fillStyle = sel; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label, SC_M.l - 6, r.y + 1);
    }
  }
}

function scorePick(px, py) {
  let best = -1, bd = 6;
  for (const r of score.rows) {
    if (!r.cl) continue;
    const d = Math.abs(r.y + ROW_H / 2 - py);
    if (d < bd && px > SC_M.l - 40 && px < score.W - SC_M.r + 10) { bd = d; best = r.cl.ix; }
  }
  return best;
}
