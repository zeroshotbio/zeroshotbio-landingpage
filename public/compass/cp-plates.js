/* /compass — the seven plates.
 *
 * One ink for every data mark; hand-tinted washes only where a category has to be told apart,
 * each also named in writing; madder (INK.select) only for the thing the reader chose.
 * Panels that are meant to be compared share one scale, and a smaller thing is drawn smaller.
 */
'use strict';

/* ======================= PLATE I — response = shared + residual ======================= */

function drawDecomp(cv, st) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p1, e = P.exemplars[st.ex], G = P.n_genes;
  const L = W < 600 ? 96 : 146, R = 18, T = 34, gap = 30, rowH = (H - T - 70 - 2 * gap) / 3;
  const sx = (i) => L + (i / (G - 1)) * (W - L - R);
  // ONE vertical scale for all three rows: the response, its shared part and its residual are
  // parts of the same vector and must be read against each other.
  let mx = 0; e.z.forEach((v) => { mx = Math.max(mx, Math.abs(v)); });
  const rows = [
    { key: 'z', name: 'the response', note: 'measured' },
    { key: 'shared', name: 'shared part', note: `β = ${f2(e.beta)} along the axis` },
    { key: 'residual', name: 'its own part', note: 'orthogonal to the axis' },
  ];
  rows.forEach((r, k) => {
    const y0 = T + k * (rowH + gap) + rowH / 2, sy = (v) => y0 - (v / mx) * (rowH / 2);
    penLine(ctx, L, y0, W - R, y0, 11 + k, INK.rule, 0.7);
    const vals = e[r.key];
    if (r.key === 'shared') {                       // monotone by construction: draw as a wash with an ink edge
      ctx.beginPath(); ctx.moveTo(sx(0), y0);
      vals.forEach((v, i) => ctx.lineTo(sx(i), sy(v)));
      ctx.lineTo(sx(G - 1), y0); ctx.closePath();
      ctx.fillStyle = rgba(INK.t1, 0.30); ctx.fill();
      path(ctx, vals.map((_, i) => sx(i)), vals.map(sy), INK.ink, 1.0);
    } else {                                        // hairlines, one path in one ink
      ctx.beginPath();
      vals.forEach((v, i) => { const x = sx(i); ctx.moveTo(x, y0); ctx.lineTo(x, sy(v)); });
      ctx.strokeStyle = rgba(INK.ink, r.key === 'z' ? 0.55 : 0.42); ctx.lineWidth = 0.55; ctx.stroke();
    }
    text(ctx, r.name, L - 12, y0 - 4, { font: font.serif(13.5, true), align: 'right' });
    text(ctx, r.note, L - 12, y0 + 12, { font: font.serif(11), color: INK['ink-3'], align: 'right' });
    if (k < 2) text(ctx, k === 0 ? '=' : '+', L - 40, T + (k + 1) * (rowH + gap) - gap / 2 + 7, { font: font.serif(22), color: INK['ink-2'], align: 'center' });
  });
  const yb = T + 3 * rowH + 2 * gap + 16;
  caps(ctx, `${nf(G)} genes, ordered by the shared axis of ${P.line}`, (L + W - R) / 2, yb + 18, { align: 'center' });
  const ng = W < 800 ? 2 : 5;
  text(ctx, 'up along the axis: ' + P.genes_in_order.slice(0, ng).join(', '), L, yb, { font: font.serif(11.5, true), color: INK['ink-2'] });
  text(ctx, P.genes_in_order.slice(-ng).reverse().join(', ') + ' : down along the axis', W - R, yb, { font: font.serif(11.5, true), color: INK['ink-2'], align: 'right' });
  caps(ctx, `${e.symbol} knockdown · ${P.line}`, L, 16, { color: INK.select, size: 10 });
  caps(ctx, `${Math.round(e.frac_shared * 100)}% of its squared size is shared`, W - R, 16, { align: 'right', size: 10 });
}

function drawVector(cv, st) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p1, ex = P.exemplars;
  const ox = 28, oy = H - 44, maxN = Math.max(...ex.map((e) => e.norm)), s = (W - ox - 40) / maxN;
  penLine(ctx, ox, oy, W - 12, oy, 7, INK['ink-2'], 1);
  text(ctx, 'the shared axis u', W - 12, oy + 18, { font: font.serif(12, true), color: INK['ink-2'], align: 'right' });
  ex.forEach((e, k) => {
    const th = Math.acos(Math.max(-1, Math.min(1, e.cos))), len = e.norm * s;
    const x = ox + len * Math.cos(th), y = oy - len * Math.sin(th);
    const chosen = k === st.ex, col = chosen ? INK.select : rgba(INK.ink, 0.34);
    if (chosen) {
      guide(ctx, x, y, x, oy, INK.select);                          // the residual: perpendicular to u
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, oy); ctx.strokeStyle = rgba(INK.t1, 0.9); ctx.lineWidth = 3.2; ctx.stroke();
      text(ctx, 'β', (ox + x) / 2, oy - 6, { font: font.serif(14, true), color: INK.ink, align: 'center' });
      text(ctx, 'r', x + 7, (y + oy) / 2, { font: font.serif(14, true), color: INK.select });
    }
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.strokeStyle = col; ctx.lineWidth = chosen ? 1.8 : 1.1; ctx.stroke();
    dot(ctx, x, y, chosen ? 3.2 : 2.4, col);
    text(ctx, e.symbol, x + 6, y - 5, { font: font.serif(12.5, true), color: chosen ? INK.select : INK['ink-2'] });
  });
  caps(ctx, 'angle and length are the real ones', ox, 16, { size: 9 });
}

/* ======================= PLATE II — the reproduction ======================= */

function drawContinuum(cv) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p2, M = CP.meta, pad = 18, lm = 20, cols = 6, cw = (W - lm - pad * (cols - 1)) / cols;
  // one scale for all six panels
  let mMax = 0; LINES.forEach((l) => P[l].m.forEach((v) => { mMax = Math.max(mMax, v); }));
  const ax = [-0.5, 1.0];
  ctx.save(); ctx.translate(9, H / 2); ctx.rotate(-Math.PI / 2);
  caps(ctx, 'magnitude ‖w‖ →', 0, 0, { align: 'center', size: 8.5 }); ctx.restore();
  LINES.forEach((l, c) => {
    const x0 = lm + c * (cw + pad), top = 26, bot = H - 30;
    const sx = lin(ax[0], ax[1], x0 + 6, x0 + cw - 4), sy = lin(0, mMax, bot, top + 8);
    penRect(ctx, x0, top, cw, bot - top, 20 + c, INK['rule-2'], 0.7);
    const d = P[l];
    ctx.fillStyle = rgba(INK.ink, 0.30);
    for (let i = 0; i < d.m.length; i++) { ctx.beginPath(); ctx.arc(sx(d.a[i]), sy(d.m[i]), 1.25, 0, 6.283); ctx.fill(); }
    caps(ctx, l, x0 + 2, 14, { size: 10, color: INK.ink });
    const rho = M.reproduction.spearman_m_a[l], pr = M.paper.spearman_m_a[l];
    text(ctx, `ρ = ${f2(rho)}` + (pr !== undefined ? `  (paper ${f2(pr)})` : ''), x0 + cw, 14, { font: font.serif(11.5, true), align: 'right', color: INK['ink-2'] });
    caps(ctx, 'alignment →', x0 + cw / 2, H - 12, { align: 'center', size: 8.5 });
  });
}

function drawLedger(cv) {
  const M = CP.meta, R = M.reproduction, Pp = M.paper;
  const blocks = [
    { title: "Kendall's W across six lines", rows: [] },
    { title: 'β agreement between lines (Table 13)', rows: [] },
    { title: 'held-out transfer (Tables 2, 9)', rows: [] },
    { title: 'CompassX accuracy (Table 3)', rows: [] },
    { title: 'CompassX discrimination, PDS gain', rows: [] },
    { title: 'training-mean accuracy (the discrepancy)', rows: [], warn: true },
  ];
  ['1000', '2000', '5000'].forEach((pn) => ['alignment', 'magnitude', 'position s'].forEach((q, i) =>
    blocks[0].rows.push({ l: `${q} · ${nf(+pn)}`, p: Pp.W[pn][i], o: R.W.paper_anchor[pn].W[i] })));
  Object.entries(Pp.beta_pairs).forEach(([k, v]) => blocks[1].rows.push({ l: k.replace('_', ' / '), p: v, o: R.beta_pairs[k].r }));
  ['K562', 'RPE1', 'HepG2', 'Jurkat'].forEach((l) => blocks[2].rows.push({ l: `β, ${l}`, p: Pp.transfer_beta[l], o: R.transfer.ensembl[l].beta }));
  blocks[2].rows.push({ l: 'β, X-Atlas pair', p: Pp.transfer_beta['X-Atlas'], o: R.transfer.ensembl.HCT116.beta });
  ['K562', 'RPE1', 'HepG2', 'Jurkat'].forEach((l) => blocks[2].rows.push({ l: `residual, ${l}`, p: Pp.transfer_g[l], o: R.transfer.ensembl[l].g }));
  blocks[2].rows.push({ l: 'residual, X-Atlas pair', p: Pp.transfer_g['X-Atlas'], o: R.transfer.ensembl.HCT116.g });
  LINES.forEach((l, i) => {
    blocks[3].rows.push({ l, p: Pp.table3.CompassX[0][i], o: R.bench.CompassX.pearson[i] });
    blocks[4].rows.push({ l, p: Pp.table3.CompassX[1][i], o: R.bench.CompassX.pds[i] });
    blocks[5].rows.push({ l, p: Pp.table3['training mean'][0][i], o: R.bench['training mean'].pearson[i] });
  });
  // Height follows the content: three columns when there is room, one when there is not.
  const Wp = Math.max(280, cv.parentElement.clientWidth), cols = Wp >= 900 ? 3 : 1;
  const rowH = 17.5, headH = 40, gapB = 22, heights = Array(cols).fill(0);
  blocks.forEach((b, bi) => { heights[bi % cols] += headH + b.rows.length * rowH + gapB; });
  cv.dataset.aspect = String((Math.max(...heights) + 8) / Wp);
  const { ctx, W } = setup(cv);
  const cw = W / cols, ys = Array(cols).fill(0);
  blocks.forEach((b, bi) => {
    const c = bi % cols, xL = c * cw + 4, lw = 140, tx0 = xL + lw, tx1 = c * cw + cw - 46;
    let y = ys[c] + 14;
    caps(ctx, b.title, xL, y, { size: 9, color: b.warn ? INK.select : INK['ink-3'] });
    const sx = lin(0, 1, tx0, tx1);
    y += 17;
    [0, 0.5, 1].forEach((t) => caps(ctx, t, sx(t), y, { align: 'center', size: 7.5, spacing: 0.3 }));
    y += 5;
    penLine(ctx, tx0, y, tx1, y, 40 + bi, INK['rule-2'], 0.6);
    y += 4;
    b.rows.forEach((r) => {
      y += rowH;
      text(ctx, r.l, tx0 - 8, y + 3, { font: font.serif(11.5), color: INK['ink-2'], align: 'right' });
      penLine(ctx, tx0, y, tx1, y, 60 + y, rgba(INK.rule, 0.6), 0.5);
      const xp = sx(r.p), xo = sx(r.o);
      ctx.beginPath(); ctx.moveTo(xp, y); ctx.lineTo(xo, y); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 1; ctx.stroke();
      dot(ctx, xp, y, 4.2, null, INK['ink-2']);
      dot(ctx, xo, y, 2.6, INK.ink);
      text(ctx, f2(r.o), tx1 + 8, y + 4, { font: font.serif(11.5), color: INK.ink });
    });
    ys[c] = y + gapB;
  });
}

function drawBudget(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, B = M.reproduction.budget, P = M.paper.budget;
  const L = 64, R = 18, T = 20, Bt = H - 44;
  const sx = logs(8, 160, L, W - R), sy = lin(0.2, 0.34, Bt, T);
  axisX(ctx, sx, Bt, [10, 25, 50, 100, 130], { label: 'perturbations profiled in the target line', range: [L, W - R] });
  axisY(ctx, sy, L, [0.2, 0.24, 0.28, 0.32], { label: 'de-biased Pearson', fmt: f2, range: [Bt, T] });
  [['training mean', INK['ink-3'], [4, 3]], ['source average', INK['ink-3'], [1, 3]], ['CompassX', INK.ink, null]].forEach(([m, col, dash]) => {
    const d = B[m]; path(ctx, d.n.map(sx), d.pearson.map(sy), col, m === 'CompassX' ? 1.6 : 1.1, dash);
    d.n.forEach((n, i) => dot(ctx, sx(n), sy(d.pearson[i]), m === 'CompassX' ? 2.6 : 1.8, col));
    const i = 2, off = { CompassX: -9, 'training mean': 16, 'source average': -7 }[m];
    text(ctx, m, sx(d.n[i]), sy(d.pearson[i]) + off, { font: font.serif(11.5, true), color: col, align: 'center', back: true });
  });
  P.n.forEach((n, i) => dot(ctx, sx(n), sy(P.pearson[i]), 4.4, null, INK['ink-2']));
  text(ctx, 'paper', sx(P.n[0]) + 7, sy(P.pearson[0]) + 4, { font: font.serif(11, true), color: INK['ink-2'] });
}

/* ======================= PLATE III — the shared direction ======================= */

function drawSpectrum(cv, st) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p3, progs = P.programs.map((p) => p.name);
  const L = 92, R = 16, T = 26, rowGap = 12, rowH = (H - T - 30 - rowGap * 5) / 6;
  const silH = rowH * 0.52, rugH = rowH - silH - 14, sub = rugH / progs.length;
  const sx = (q) => L + q * (W - L - R);
  caps(ctx, 'shared direction positive', L, 14, { size: 9 });
  caps(ctx, 'shared direction negative', W - R, 14, { size: 9, align: 'right' });
  LINES.forEach((l, k) => {
    const d = P.lines[l], y0 = T + k * (rowH + rowGap), mid = y0 + silH / 2 + 2;
    // silhouette of the sorted direction (exact quantiles, one ink)
    // the same ×2.5 in every line, so the body of the distribution is legible; the extreme tips clip
    const n = d.silhouette.length, yv = (v) => mid - Math.max(-1, Math.min(1, v * 2.5)) * (silH / 2);
    ctx.beginPath(); ctx.moveTo(sx(0), mid);
    d.silhouette.forEach((v, i) => ctx.lineTo(sx(i / (n - 1)), yv(v)));
    ctx.lineTo(sx(1), mid); ctx.closePath(); ctx.fillStyle = rgba(INK.ink, 0.10); ctx.fill();
    path(ctx, d.silhouette.map((_, i) => sx(i / (n - 1))), d.silhouette.map(yv), rgba(INK.ink, 0.8), 0.8);
    penLine(ctx, L, mid, W - R, mid, 70 + k, INK['rule-2'], 0.5);
    text(ctx, l, L - 12, mid + 4, { font: font.serif(14.5, true), align: 'right' });
    caps(ctx, `${nf(d.n_genes)} genes`, L - 12, mid + 17, { align: 'right', size: 8 });
    text(ctx, d.top_up.slice(0, 4).join(' · '), sx(0.005), y0 + 4, { font: font.serif(10.5, true), color: INK['ink-2'] });
    text(ctx, d.top_down.slice(0, 4).join(' · '), sx(0.995), y0 + silH + 2, { font: font.serif(10.5, true), color: INK['ink-2'], align: 'right' });
    // rug: one thin sub-row per program; isolated programs in their wash, the rest ghosted
    const ry = y0 + silH + 8;
    progs.forEach((p, j) => {
      const on = !st.progIso.size || st.progIso.has(j), yy = ry + j * sub;
      ctx.beginPath();
      d.programs[p].forEach((q) => { const x = sx(q); ctx.moveTo(x, yy); ctx.lineTo(x, yy + sub - 0.6); });
      ctx.strokeStyle = on ? rgba(INK['t' + j], st.progIso.size ? 0.9 : 0.55) : rgba(INK.ink, 0.07);
      ctx.lineWidth = 0.7; ctx.stroke();
      if (on && st.progIso.size) {
        const r = d.programs[p], med = r[Math.floor(r.length / 2)];
        dot(ctx, sx(med), yy + sub / 2, 2.4, INK['t' + j]);
      }
    });
  });
}

function drawSignatures(cv) {
  const { ctx, W, H } = setup(cv);
  const S = CP.plates.p3.signatures.slice().sort((a, b) =>
    LINES.reduce((s, l) => s + a[l], 0) - LINES.reduce((s, l) => s + b[l], 0));
  const L = Math.min(250, W * 0.46), R = 8, T = 30, rh = (H - T - 8) / S.length, cw = (W - L - R) / LINES.length;
  LINES.forEach((l, j) => caps(ctx, l, L + cw * (j + 0.5), 16, { align: 'center', size: 8.5, spacing: 0.6 }));
  S.forEach((s, i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, s.signature.replace('Hallmark ', ''), L - 10, y + 4, { font: font.serif(11.5), color: INK['ink-2'], align: 'right' });
    penLine(ctx, L, y, W - R, y, 90 + i, rgba(INK.rule, 0.35), 0.5);
    LINES.forEach((l, j) => {
      const v = s[l], r = Math.min(rh * 0.46, 1.5 + Math.abs(v) * 2.4), x = L + cw * (j + 0.5);
      dot(ctx, x, y, r, v >= 0 ? rgba(INK.t1, 0.85) : rgba(INK.t4, 0.85));
    });
  });
}

/* ======================= PLATE IV — residual programs ======================= */

function shortTerm(s) {
  return String(s || '').replace(/\s*\((GO:\d+|q=[^)]*)\)/g, '').replace(/\s*R-HSA-\d+/g, '').trim();
}

function drawResidual(cv, st) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p4, pad = 26, side = Math.min(W, H) - 2 * pad;
  const ox = (W - side) / 2, oy = pad;
  const sx = (v) => ox + v * side, sy = (v) => oy + (1 - v) * side;
  st.p4geom = { sx, sy };
  ctx.fillStyle = rgba(INK.ink, st.cluster >= 0 ? 0.13 : 0.34);
  for (let i = 0; i < P.x.length; i++) {
    if (P.label[i] === st.cluster) continue;
    ctx.beginPath(); ctx.arc(sx(P.x[i]), sy(P.y[i]), 1.5, 0, 6.283); ctx.fill();
  }
  if (st.cluster >= 0) {
    ctx.fillStyle = rgba(INK.select, 0.85);
    for (let i = 0; i < P.x.length; i++) {
      if (P.label[i] !== st.cluster) continue;
      ctx.beginPath(); ctx.arc(sx(P.x[i]), sy(P.y[i]), 2.1, 0, 6.283); ctx.fill();
    }
  }
  // cluster labels at their median position; search, then give up on collision
  const placed = [];
  ctx.font = font.serif(11, true);
  P.clusters.forEach((c) => {
    if (!c.members_sig) return;
    const xs = [], ys = [];
    P.label.forEach((lab, i) => { if (lab === c.id) { xs.push(P.x[i]); ys.push(P.y[i]); } });
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const s = shortTerm(c.members).toLowerCase().slice(0, 30), w = ctx.measureText(s).width;
    const bx = sx(xs[xs.length >> 1]), by = sy(ys[ys.length >> 1]);
    for (const [dx, dy] of [[0, 0], [0, -14], [0, 14], [22, 0], [-22, 0], [0, -26], [0, 26]]) {
      const box = [bx + dx - w / 2 - 3, by + dy - 10, w + 6, 14];
      if (box[0] < 2 || box[0] + box[2] > W - 2) continue;
      if (placed.some((p) => !(box[0] + box[2] < p[0] || p[0] + p[2] < box[0] || box[1] + box[3] < p[1] || p[1] + p[3] < box[1]))) continue;
      placed.push(box);
      text(ctx, s, bx + dx, by + dy, { font: font.serif(11, true), align: 'center', back: true, color: c.id === st.cluster ? INK.select : INK['ink-2'] });
      break;
    }
  });
  caps(ctx, 't-SNE of residual directions · a layout, not a measurement', ox, H - 6, { size: 8.5 });
}

function drawReliability(cv) {
  const { ctx, W, H } = setup(cv);
  const D = CP.meta.decomposition.per_line, L = 78, R = 44, T = 34, rh = (H - T - 64) / LINES.length;
  const sx = lin(0, 1, L, W - R);
  const keys = [['split_cos_u', 'axis', INK.ink, 3.2], ['split_beta_r', 'β', INK['ink-2'], 2.6], ['split_residual_r', 'residual', INK.t3, 3.0]];
  keys.forEach(([, n, col], i) => { dot(ctx, L + i * 110, 14, 3, col); text(ctx, n, L + i * 110 + 8, 18, { font: font.serif(12, true), color: col }); });
  LINES.forEach((l, i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, l, L - 10, y + 4, { font: font.serif(12.5, true), align: 'right' });
    penLine(ctx, L, y, W - R, y, 110 + i, rgba(INK.rule, 0.6), 0.5);
    keys.forEach(([k, , col, r]) => dot(ctx, sx(D[l][k]), y, r, col));
  });
  axisX(ctx, sx, H - 42, [0, 0.25, 0.5, 0.75, 1], { range: [L, W - R], label: 'agreement between two independent halves of the data' });
}

/* ======================= PLATE V — why it can be seen ======================= */

function drawCount(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, E = M.external, Z = M.zeroshot;
  const rows = [['CRISPRi, per line', M.anchor.ensembl], ['Tahoe, per line', Math.round(E.tahoe.n_perturbations)],
    ['MegaFin (design)', Z.MegaFin.perturbations], ['ChemFish, per tissue', Math.round(E.chemfish.n_perturbations)], ['MiniFin (design)', Z.MiniFin.perturbations]];
  const L = 130, R = 60, T = 26, rh = (H - T - 30) / rows.length, pitch = (W - L - R) / rows[0][1];
  // one pitch for every row: a smaller screen is a shorter row, never a stretched one
  rows.forEach(([name, n], i) => {
    const y = T + rh * i + 6;
    text(ctx, name, L - 10, y + rh * 0.42, { font: font.serif(12.5, true), align: 'right' });
    ctx.beginPath();
    for (let k = 0; k < n; k++) { const x = L + k * pitch; ctx.moveTo(x, y); ctx.lineTo(x, y + rh * 0.62); }
    ctx.strokeStyle = rgba(INK.ink, 0.5); ctx.lineWidth = 0.5; ctx.stroke();
    text(ctx, nf(n), L + n * pitch + 6, y + rh * 0.42, { font: font.serif(12.5), color: INK.ink });
  });
  [30, 100].forEach((t) => {
    const x = L + t * pitch; guide(ctx, x, T - 6, x, H - 22, INK.select);
    caps(ctx, String(t), t === 30 ? x - 3 : x + 3, H - 8, { align: t === 30 ? 'right' : 'left', size: 8.5, spacing: 0.4, color: INK.select });
  });
  caps(ctx, 'axis visible from', L + 30 * pitch - 22, H - 8, { align: 'right', size: 8.5, color: INK.select });
}

function drawStrength(cv) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p5, ed = P.ratio_edges, L = 20, R = 16, T = 18, B = H - 42;
  const sx = lin(ed[0], ed[ed.length - 1], L, W - R);
  const sets = [['crispr', 'CRISPRi knockdowns'], ['tahoe', 'Tahoe drug-doses'], ['chemfish', 'ChemFish drug conditions']];
  const rh = (B - T) / 3;
  sets.forEach(([k, name], i) => {
    const d = P[k], tot = d.counts.reduce((a, b) => a + b, 0), mxv = Math.max(...d.counts) / tot, y0 = T + rh * (i + 1) - 4;
    ctx.beginPath(); ctx.moveTo(sx(ed[0]), y0);
    d.counts.forEach((c, j) => { const h = (c / tot / mxv) * (rh - 16); ctx.lineTo(sx(ed[j]), y0 - h); ctx.lineTo(sx(ed[j + 1]), y0 - h); });
    ctx.lineTo(sx(ed[ed.length - 1]), y0); ctx.closePath();
    ctx.fillStyle = rgba(INK.ink, 0.16); ctx.fill(); ctx.strokeStyle = rgba(INK.ink, 0.75); ctx.lineWidth = 0.8; ctx.stroke();
    text(ctx, name, W - R, y0 - rh + 26, { font: font.serif(12, true), align: 'right' });
    text(ctx, `median ${f2(d.median)}×  ·  ${Math.round(d.above_2x * 100)}% above 2×`, W - R, y0 - rh + 40, { font: font.serif(11), color: INK['ink-2'], align: 'right' });
  });
  const x2 = sx(Math.log10(2)); guide(ctx, x2, T, x2, B, INK.select);
  caps(ctx, '2× noise', x2 + 4, T + 8, { size: 8.5, color: INK.select });
  axisX(ctx, sx, B + 4, [-0.5, 0, 0.5, 1, 1.5, 2], { fmt: (v) => (Math.pow(10, v) < 10 ? Math.pow(10, v).toFixed(1) : Math.round(Math.pow(10, v))) + '×', label: 'effect size over control-vs-control noise (log)', range: [L, W - R] });
}

function drawDepth(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, E = M.external, C = M.comparison;
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const col = 'COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)';
  const umis = [['CRISPRi', num(C['UMIs per cell (median, protein-coding)'][col])], ['Tahoe', num(C['UMIs per cell (median, protein-coding)']['Tahoe-100M'])],
    ['ChemFish', num(C['UMIs per cell (median, protein-coding)']['ChemFish 2026_09'])]];
  // the same medians the comparison table prints
  const CC = C['cells per perturbation x context (median)'];
  const cells = [['CRISPRi', num(CC[col])], ['Tahoe', num(CC['Tahoe-100M'])], ['ChemFish', num(CC['ChemFish 2026_09'])]];
  const L = Math.min(150, W * 0.12), R = 30, sx = logs(20, 30000, L, W - R);
  [[umis, 'molecules per cell', H * 0.28], [cells, 'cells per perturbation, per context', H * 0.60]].forEach(([rows, lab, y]) => {
    caps(ctx, lab, L, y - 34, { size: 9 });
    penLine(ctx, L, y, W - R, y, 130 + y, INK.rule, 0.7);
    const order = rows.map((r) => r[1]).sort((a, b) => a - b);
    rows.forEach(([n, v], i) => {
      const x = sx(v); dot(ctx, x, y, 4, i === 0 ? INK.ink : INK['ink-3']);
      text(ctx, `${n} ${nf(v)}`, x, y + (order.indexOf(v) % 2 ? 22 : -10), { font: font.serif(12, true), align: 'center', color: i === 0 ? INK.ink : INK['ink-2'] });
    });
  });
  axisX(ctx, sx, H - 34, [30, 100, 300, 1000, 3000, 10000, 30000], { fmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), range: [L, W - R] });
}

function drawLanes(cv) {
  // A schematic: the arrangement is the claim, not the dot counts. Proportions are real where stated.
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, pw = (W - 40) / 3, top = 34;
  const panes = ['CRISPRi: controls in the same lanes', 'Tahoe: controls in their own wells', 'ChemFish: controls in their own embryos'];
  panes.forEach((t, i) => { const x = 10 + i * (pw + 10); caps(ctx, t.split(':')[0], x + pw / 2, 14, { align: 'center', size: 9.5, color: INK.ink });
    text(ctx, t.split(':')[1].trim(), x + pw / 2, 28, { font: font.serif(11.5, true), color: INK['ink-2'], align: 'center' }); });
  const frac = M.data.controls.K562 / M.data.cells.K562;
  // CRISPRi lane: one box, cells interleaved, control share = the real K562 share
  { const x = 10, y = top + 14, w = pw, h = H - top - 40; penRect(ctx, x, y, w, h, 150, INK.rule, 0.8);
    let k = 0; for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) {
      const cx = x + 10 + c * ((w - 20) / 13), cy = y + 10 + r * ((h - 20) / 11), isC = ((k * 0.6180339) % 1) < frac; k++;
      dot(ctx, cx, cy, 2.4, isC ? INK.t3 : rgba(INK.ink, 0.55)); } }
  // Tahoe plate: 8 x 12 wells, 2 DMSO wells per plate (as deposited), every well holding all 50 lines
  { const x = 20 + pw, y = top + 22, w = pw, cell = Math.min((w - 16) / 12, (H - top - 60) / 8);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const isC = (r === 3 && c === 0) || (r === 6 && c === 11), cx = x + 8 + c * cell + cell / 2, cy = y + r * cell + cell / 2;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38, 0, 6.283); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.7; ctx.stroke();
      if (isC) { ctx.fillStyle = INK.t3; ctx.fill(); } else { ctx.fillStyle = rgba(INK.ink, 0.12); ctx.fill(); } }
    text(ctx, 'two DMSO wells on each plate;', x + w / 2, y + 8 * cell + 18, { font: font.serif(11, true), color: INK['ink-2'], align: 'center' });
    text(ctx, 'all 50 lines share every well', x + w / 2, y + 8 * cell + 34, { font: font.serif(11, true), color: INK['ink-2'], align: 'center' }); }
  // ChemFish: treated embryos and separate vehicle embryos
  { const x = 30 + 2 * pw, y = top + 26, w = pw;
    for (let k = 0; k < 10; k++) { const cx = x + 18 + (k % 5) * ((w - 36) / 4), cy = y + 16 + Math.floor(k / 5) * 44, isC = k >= 7;
      ctx.beginPath(); ctx.ellipse(cx, cy, 12, 17, 0.4, 0, 6.283); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = isC ? INK.t3 : rgba(INK.ink, 0.14); ctx.fill(); }
    text(ctx, 'vehicle embryos are separate animals', x + w / 2, y + 116, { font: font.serif(11, true), color: INK['ink-2'], align: 'center' });
    text(ctx, 'tissues of one embryo share it', x + w / 2, y + 132, { font: font.serif(11, true), color: INK['ink-2'], align: 'center' }); }
  dot(ctx, 16, H - 12, 3, INK.t3); text(ctx, 'control', 24, H - 8, { font: font.serif(11, true), color: INK['ink-2'] });
  caps(ctx, 'schematic', W - 8, H - 8, { align: 'right', size: 8.5 });
}

/* ======================= PLATE VI — thresholds ======================= */

function drawPhase(cv) {
  const { ctx, W, H } = setup(cv);
  const Ph = CP.meta.stress.phase, L = 70, R = 14, T = 16, B = H - 58;
  const nr = Ph.n.length, nc = Ph.k.length, cw = (W - L - R) / nc, rh = (B - T) / nr;
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    const v = Ph.cons_RN[nr - 1 - i][j], x = L + j * cw, y = T + i * rh;
    ctx.fillStyle = rgba(INK.ink, Math.max(0, v) * 1.25); ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
    text(ctx, f2(v), x + cw / 2, y + rh / 2 + 4, { font: font.serif(11.5), align: 'center', color: v > 0.38 ? INK.paper : INK.ink });
  }
  // outline the region where agreement reaches 0.5
  ctx.save(); ctx.strokeStyle = INK.select; ctx.lineWidth = 1.4;
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    if (Ph.cons_RN[nr - 1 - i][j] < 0.5) continue;
    const x = L + j * cw, y = T + i * rh, on = (ii, jj) => ii >= 0 && ii < nr && jj >= 0 && jj < nc && Ph.cons_RN[nr - 1 - ii][jj] >= 0.5;
    ctx.beginPath();
    if (!on(i - 1, j)) { ctx.moveTo(x, y); ctx.lineTo(x + cw, y); }
    if (!on(i + 1, j)) { ctx.moveTo(x, y + rh); ctx.lineTo(x + cw, y + rh); }
    if (!on(i, j - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + rh); }
    if (!on(i, j + 1)) { ctx.moveTo(x + cw, y); ctx.lineTo(x + cw, y + rh); }
    ctx.stroke();
  }
  ctx.restore();
  Ph.k.forEach((k, j) => caps(ctx, k, L + j * cw + cw / 2, B + 14, { align: 'center', size: 9 }));
  [...Ph.n].reverse().forEach((n, i) => caps(ctx, nf(n), L - 8, T + i * rh + rh / 2 + 3, { align: 'right', size: 9 }));
  text(ctx, 'cells per perturbation, at most', (L + W - R) / 2, B + 32, { font: font.serif(12.5, true), color: INK['ink-2'], align: 'center' });
  ctx.save(); ctx.translate(16, (T + B) / 2); ctx.rotate(-Math.PI / 2);
  text(ctx, 'perturbations', 0, 0, { font: font.serif(12.5, true), color: INK['ink-2'], align: 'center' }); ctx.restore();
  text(ctx, 'madder edge: agreement of 0.5 or more', W - R, H - 6, { font: font.serif(11, true), color: INK.select, align: 'right' });
}

function drawDepthSweep(cv) {
  const { ctx, W, H } = setup(cv);
  const D = CP.meta.stress.depth, C = CP.meta.comparison, L = 50, R = 16, T = 18, B = H - 50;
  const sx = logs(20000, 250, L, W - R), sy = lin(0, 1, B, T);
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  [['Tahoe', num(C['UMIs per cell (median, protein-coding)']['Tahoe-100M'])], ['ChemFish', num(C['UMIs per cell (median, protein-coding)']['ChemFish 2026_09'])]]
    .forEach(([n, v]) => { const x = sx(v); guide(ctx, x, T, x, B); caps(ctx, `${n} depth`, x, T + 8, { align: 'center', size: 8.5 }); });
  axisX(ctx, sx, B, [10000, 3000, 1000, 300], { fmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), label: 'molecules per cell after thinning (median)', range: [L, W - R] });
  axisY(ctx, sy, L, [0, 0.25, 0.5, 0.75, 1], { fmt: f2, range: [B, T] });
  [['cons_RN', 'β agreement, Replogle/Nadig', INK.ink, null], ['cons_XA', 'β agreement, X-Atlas pair', INK.ink, [4, 3]],
    ['beta_rel', 'β split-half reliability', INK['ink-3'], [1, 3]], ['split_cos', 'axis split-half cosine', INK.t3, null]].forEach(([k, lab, col, dash]) => {
    const xs = D.library.map(sx), ys = D[k].map(sy); path(ctx, xs, ys, col, 1.4, dash); xs.forEach((x, i) => dot(ctx, x, ys[i], 2.2, col));
    text(ctx, lab, xs[xs.length - 1] - 4, ys[ys.length - 1] + (k === 'cons_XA' ? 16 : -8), { font: font.serif(11, true), color: col, align: 'right', back: true });
  });
}

function drawRemove(cv) {
  const { ctx, W, H } = setup(cv);
  const S = CP.meta.stress, ref = CP.meta.stress.controls_cons['stratified pool (reference)'];
  const L = 50, R = 16, T = 18, B = H - 50, sx = lin(0, 75, L, W - R), sy = lin(-0.6, 1, B, T);
  axisX(ctx, sx, B, [0, 10, 25, 50, 75], { fmt: (v) => v + '%', label: 'strongest-loading perturbations removed', range: [L, W - R] });
  axisY(ctx, sy, L, [-0.5, 0, 0.5, 1], { fmt: (v) => v.toFixed(1), range: [B, T] });
  guide(ctx, L, sy(0), W - R, sy(0));
  LINES.forEach((l) => { const d = S.remove_top_cos[l]; path(ctx, [sx(0), ...d.map((p) => sx(p[0]))], [sy(1), ...d.map((p) => sy(p[1]))], rgba(INK.t3, 0.55), 0.9); });
  [[1, 'Replogle/Nadig', null], [2, 'X-Atlas pair', [4, 3]]].forEach(([ix, lab, dash], m) => {
    const pts = [[0, ref[m]], ...S.remove_top_cons.map((r) => [parseFloat(r[0]), r[ix]])];
    path(ctx, pts.map((p) => sx(p[0])), pts.map((p) => sy(p[1])), INK.ink, 1.6, dash);
    pts.forEach((p) => dot(ctx, sx(p[0]), sy(p[1]), 2.3, INK.ink));
    const q = pts[m ? 4 : 5]; text(ctx, `β agreement, ${lab}`, sx(q[0]) + 6, sy(q[1]) + (m ? 18 : -10), { font: font.serif(11, true), back: true });
  });
  text(ctx, 'faint: each line’s axis vs its full-data axis (cosine)', L + 6, B - 8, { font: font.serif(10.5, true), color: INK.t3 });
}

function drawControls(cv) {
  const { ctx, W, H } = setup(cv);
  const C = CP.meta.stress.controls_cos, CC = CP.meta.stress.controls_cons;
  const sets = ['stratified pool (reference)', 'random 10k', 'all controls', 'single largest batch'];
  const L = 170, R = 26, T = 26, rh = (H - T - 56) / sets.length, sx = lin(0, 1, L, W - R);
  sets.forEach((s, i) => {
    const y = T + rh * (i + 0.5), bad = s.startsWith('single');
    text(ctx, s, L - 10, y + 4, { font: font.serif(12, true), align: 'right', color: bad ? INK.select : INK.ink });
    penLine(ctx, L, y, W - R, y, 170 + i, rgba(INK.rule, 0.6), 0.5);
    LINES.forEach((l) => dot(ctx, sx(Math.max(0, C[l][s])), y, 2.8, bad ? INK.select : rgba(INK.ink, 0.75)));
    text(ctx, `β agreement ${f2(CC[s][0])} / ${f2(CC[s][1])}`, L - 10, y + 17, { font: font.serif(10.5), align: 'right', color: INK['ink-3'] });
  });
  axisX(ctx, sx, H - 36, [0, 0.25, 0.5, 0.75, 1], { label: 'cosine of each line’s axis with the reference axis', range: [L, W - R] });
}

/* ======================= PLATE VII — Tahoe, and the three datasets ======================= */

function drawTahoe(cv) {
  const { ctx, W, H } = setup(cv);
  const E = CP.meta.external.tahoe, w = E.dmso_well, t = E.dose_tiers;
  const L = 180, R = 40, T = 22;
  const bars = [['sampling noise, one well split', w.median_norm_sampling_noise, INK['ink-3']],
    ['DMSO well minus DMSO well', w.median_norm_well_diff, INK.select], ['median drug effect', w.median_drug_effect_norm, INK.ink]];
  const sx = lin(0, 2.5, L, W - R);
  caps(ctx, 'size of the difference, ‖·‖', L, T, { size: 9 });
  bars.forEach(([n, v, col], i) => { const y = T + 18 + i * 26;
    text(ctx, n, L - 10, y + 10, { font: font.serif(12, true), align: 'right' });
    ctx.fillStyle = rgba(col, 0.75); ctx.fillRect(L, y, sx(v) - L, 14); text(ctx, f2(v), sx(v) + 6, y + 11, { font: font.serif(11.5) }); });
  const y2 = T + 18 + 3 * 26 + 30;
  caps(ctx, 'agreement across the 50 pooled lines', L, y2, { size: 9 });
  const sx2 = lin(0, 0.5, L, W - R);
  [['the DMSO well difference', w.mean_crossline_r_of_well_diff, INK.select], ['the same drug’s effect', w.mean_crossline_r_of_same_drug_effect, INK.ink]].forEach(([n, v, col], i) => {
    const y = y2 + 18 + i * 26; text(ctx, n, L - 10, y + 10, { font: font.serif(12, true), align: 'right' });
    ctx.fillStyle = rgba(col, 0.75); ctx.fillRect(L, y, sx2(v) - L, 14); text(ctx, 'r = ' + f2(v), sx2(v) + 6, y + 11, { font: font.serif(11.5) }); });
  const y3 = y2 + 18 + 2 * 26 + 30;
  caps(ctx, 'median β by dose tier (lowest to highest)', L, y3, { size: 9 });
  const sx3 = lin(0, 1.3, L, W - R);
  ['lowest', 'middle', 'highest'].forEach((n, i) => { const v = t[String(i + 1)], y = y3 + 18 + i * 22;
    text(ctx, n, L - 10, y + 9, { font: font.serif(12, true), align: 'right' });
    dot(ctx, sx3(v), y + 5, 4, INK.ink); penLine(ctx, L, y + 5, sx3(v), y + 5, 200 + i, INK['ink-3'], 0.6); text(ctx, f2(v), sx3(v) + 8, y + 9, { font: font.serif(11.5) }); });
}

function drawThree(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, D = M.decomposition.per_line, E = M.external;
  const vals = (k) => LINES.map((l) => D[l][k]);
  const tW = E.tahoe.checks, cW = E.chemfish.checks;
  const rows = [
    ['share of response on the axis', vals('energy'), E.tahoe.energy, E.chemfish.energy],
    ['axis split-half cosine', vals('split_cos_u'), E.tahoe.split_cos_u, E.chemfish.split_cos_u],
    ['β split-half reliability', vals('split_beta_r'), E.tahoe.split_beta_r, E.chemfish.split_beta_r],
    ['residual split-half reliability', vals('split_residual_r'), E.tahoe.split_residual_r, E.chemfish.split_residual_r],
    ['β agreement across contexts', [(6 * M.reproduction.kendall_W_beta_all6 - 1) / 5], tW.mean_pairwise_spearman_from_W, cW.mean_pairwise_spearman_from_W],
  ];
  const L = Math.min(190, W * 0.45), R = 20, T = 34, rh = (H - T - 40) / rows.length, sx = lin(0, 1, L, W - R);
  let lx = 8;
  [['CRISPRi (range over six lines)', INK.ink], ['Tahoe', INK.t4], ['ChemFish', INK.t1]].forEach(([n, col]) => {
    dot(ctx, lx, 12, 3.2, col); text(ctx, n, lx + 8, 16, { font: font.serif(11.5, true), color: col });
    ctx.font = font.serif(11.5, true); lx += ctx.measureText(n).width + 34; });
  rows.forEach(([name, cr, ta, ch], i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, name, L - 10, y + 4, { font: font.serif(12, true), align: 'right' });
    penLine(ctx, L, y, W - R, y, 220 + i, rgba(INK.rule, 0.6), 0.5);
    const lo = Math.min(...cr), hi = Math.max(...cr);
    ctx.beginPath(); ctx.moveTo(sx(lo), y); ctx.lineTo(sx(hi), y); ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.4; ctx.stroke();
    cr.forEach((v) => dot(ctx, sx(v), y, 2.2, INK.ink));
    dot(ctx, sx(ta), y - 7, 3.6, INK.t4); dot(ctx, sx(ch), y + 7, 3.6, INK.t1);
  });
  axisX(ctx, sx, H - 24, [0, 0.25, 0.5, 0.75, 1], { range: [L, W - R] });
}
