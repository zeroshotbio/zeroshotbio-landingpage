/* /fate_map_daniocell — Plate IV, one inferred trajectory.
 *
 * INFERRED is the operative word and it belongs in every sentence about this
 * plate. URD reconstructs an ordering from expression alone. No cell in it was
 * watched turning into another; the pseudotime axis is a statistical
 * arrangement of a snapshot population, not elapsed time, and the branch is a
 * claim about transcriptional structure rather than about parentage.
 *
 * The intestinal smooth muscle sheet is genuinely branched, and the branching
 * is encoded in a way that is easy to miss: the pseudotime header is NOT
 * monotonic, and where it falls back is where one run ends and the next
 * begins — a 37-point shared trunk, then two 16- and 15-point branches that
 * both restart at ~0.57. The build script reads those runs rather than
 * assuming them, and names the two branches from the paper's own markers
 * (il13ra2 for the putative longitudinal layer; fsta / kcnk18 / foxf2a for the
 * circular one) because THE SHEET'S NAME HAS THEM THE OTHER WAY ROUND.
 *
 * Genes are ordered by where they peak, which is what turns a heatmap into a
 * cascade: the diagonal is the point.
 */
'use strict';

const casc = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, dpr: 1,
  which: 'ismc', hover: -1, raf: 0, layout: null,
};

const CX_M = { l: 96, r: 22, t: 44, b: 30 };

function cascInit(cv, hold) {
  casc.cv = cv; casc.hold = hold; casc.ctx = cv.getContext('2d');
  cascLayout();
}

function cascLayout() {
  const d = DC.cascades[casc.which];
  const nG = d.genes.length;
  // one row per gene; thin when there are many, never below a hairline
  const rowH = nG > 600 ? 0.62 : 4.6;
  casc.rowH = rowH;
  // order genes by the pseudotime column where they peak — the cascade
  casc.order = d.genes.map((g, i) => i).sort((a, b) => d.peak[a] - d.peak[b] || a - b);
  casc.contentH = CX_M.t + nG * rowH + CX_M.b;
  cascResize();
}

function cascResize() {
  casc.dpr = Math.min(window.devicePixelRatio || 1, 2);
  casc.W = casc.hold.clientWidth;
  casc.H = Math.max(320, casc.contentH);
  casc.hold.style.height = casc.H + 'px';
  casc.cv.width = Math.round(casc.W * casc.dpr);
  casc.cv.height = Math.round(casc.H * casc.dpr);
  casc.cv.style.height = casc.H + 'px';
  casc.ctx.setTransform(casc.dpr, 0, 0, casc.dpr, 0, 0);
  cascDraw();
}

function cascDraw() {
  if (casc.raf) return;
  casc.raf = requestAnimationFrame(() => { casc.raf = 0; cascPaint(); });
}

function cascPaint() {
  const ctx = casc.ctx, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const rule = css.getPropertyValue('--rule').trim();
  const sel = css.getPropertyValue('--select').trim();
  const paper = css.getPropertyValue('--paper').trim();
  const d = DC.cascades[casc.which];
  ctx.clearRect(0, 0, casc.W, casc.H);

  const segs = d.segments, nSeg = segs.length;
  const plotW = casc.W - CX_M.l - CX_M.r;
  const gap = nSeg > 1 ? 26 : 0;
  const totalPts = d.pseudotime.length;
  const colW = (plotW - gap * (nSeg - 1)) / totalPts;

  // where each column sits, accounting for the gaps between runs
  const colX = new Float64Array(totalPts);
  let x = CX_M.l;
  segs.forEach(([a, b], si) => {
    for (let i = a; i < b; i++) { colX[i] = x; x += colW; }
    if (si < nSeg - 1) x += gap;
  });

  // the matrix, one ink: darkness is scaled expression along the trajectory
  const rows = casc.order;
  for (let r = 0; r < rows.length; r++) {
    const gi = rows[r], y = CX_M.t + r * casc.rowH;
    const vals = d.values[gi];
    for (let c = 0; c < totalPts; c++) {
      // gamma: these values are row-scaled to 0-1, so most sit mid-range and
      // a linear ramp greys the whole plate. Lifting the exponent makes the
      // peak of each gene — which is what the ordering is about — legible.
      const v = Math.pow(vals[c] / 255, 2.1);
      if (v <= 0.02) continue;
      ctx.globalAlpha = Math.min(1, v);
      ctx.fillStyle = ink;
      ctx.fillRect(colX[c], y, Math.max(colW, 0.7), Math.max(casc.rowH, 0.7));
    }
  }
  ctx.globalAlpha = 1;

  // branch headers
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  segs.forEach(([a, b], si) => {
    const x0 = colX[a], x1 = colX[b - 1] + colW;
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, CX_M.t - 9); ctx.lineTo(x1, CX_M.t - 9); ctx.stroke();
    const lab = (d.branch_labels && d.branch_labels[si]) || `run ${si + 1}`;
    ctx.font = 'italic 12px Georgia,serif'; ctx.fillStyle = ink3;
    ctx.fillText(lab, (x0 + x1) / 2, CX_M.t - 26);
    ctx.font = '500 9.5px ui-sans-serif,system-ui,sans-serif';
    ctx.fillText(`${d.pseudotime[a].toFixed(2)} to ${d.pseudotime[b - 1].toFixed(2)}`,
                 (x0 + x1) / 2, CX_M.t - 13);
  });

  // axis caption
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = ink3;
  ctx.font = 'italic 11px Georgia,serif';
  ctx.fillText('URD pseudotime — an inferred ordering, not elapsed time',
               CX_M.l, casc.H - CX_M.b + 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${d.genes.length} genes, ordered by where they peak`,
               casc.W - CX_M.r, casc.H - CX_M.b + 10);

  // gene labels: all of them when the rows are tall enough, else the hovered one
  if (casc.rowH >= 9) {
    ctx.font = '500 9px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let r = 0; r < rows.length; r++) {
      ctx.fillStyle = (casc.hover === r) ? sel : ink3;
      ctx.fillText(d.genes[rows[r]], CX_M.l - 6, CX_M.t + r * casc.rowH + casc.rowH / 2);
    }
  } else if (casc.hover >= 0) {
    const r = casc.hover, g = d.genes[rows[r]];
    const y = CX_M.t + r * casc.rowH + casc.rowH / 2;
    ctx.strokeStyle = sel; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(CX_M.l, y); ctx.lineTo(casc.W - CX_M.r, y); ctx.stroke();
    ctx.font = '600 10.5px ui-sans-serif,system-ui,sans-serif';
    const w = ctx.measureText(g).width;
    ctx.fillStyle = paper; ctx.fillRect(CX_M.l - w - 12, y - 7, w + 9, 14);
    ctx.fillStyle = sel; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(g, CX_M.l - 6, y);
  }
}

function cascPick(px, py) {
  if (px < CX_M.l - 10 || px > casc.W - CX_M.r) return -1;
  const r = Math.floor((py - CX_M.t) / casc.rowH);
  return (r >= 0 && r < casc.order.length) ? r : -1;
}
