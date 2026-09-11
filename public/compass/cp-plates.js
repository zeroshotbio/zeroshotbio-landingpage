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
    { key: 'shared', name: 'shared part', note: `strength β = ${f2(e.beta)}` },
    { key: 'residual', name: 'its own part', note: 'the rest' },
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
  caps(ctx, `${nf(G)} genes, in the order of ${P.line}'s typical response`, (L + W - R) / 2, yb + 18, { align: 'center' });
  const ng = W < 800 ? 2 : 5;
  text(ctx, 'a typical knockdown raises: ' + P.genes_in_order.slice(0, ng).join(', '), L, yb, { font: font.serif(11.5, true), color: INK['ink-2'] });
  text(ctx, P.genes_in_order.slice(-ng).reverse().join(', ') + ' : a typical knockdown lowers', W - R, yb, { font: font.serif(11.5, true), color: INK['ink-2'], align: 'right' });
  caps(ctx, `${e.symbol} knockdown · ${P.line}`, L, 16, { color: INK.select, size: 10 });
  caps(ctx, `${Math.round(e.frac_shared * 100)}% of its squared size is shared`, W - R, 16, { align: 'right', size: 10 });
}

function drawVector(cv, st) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p1, ex = P.exemplars;
  const ox = 28, oy = H - 44, maxN = Math.max(...ex.map((e) => e.norm)), s = (W - ox - 40) / maxN;
  penLine(ctx, ox, oy, W - 12, oy, 7, INK['ink-2'], 1);
  text(ctx, 'the typical response', W - 12, oy + 18, { font: font.serif(12, true), color: INK['ink-2'], align: 'right' });
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
  caps(ctx, 'bigger response →', 0, 0, { align: 'center', size: 8.5 }); ctx.restore();
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
    caps(ctx, 'like the average →', x0 + cw / 2, H - 12, { align: 'center', size: 8, spacing: 0.6 });
  });
}

function drawLedger(cv) {
  const M = CP.meta, R = M.reproduction, Pp = M.paper;
  const blocks = [
    { title: "do six lines rank knockdowns alike? (Kendall's W)", rows: [] },
    { title: 'do two lines agree on β? (Table 13)', rows: [] },
    { title: 'predicting a hidden line (Tables 2, 9)', rows: [] },
    { title: 'CompassX: right overall shape? (Table 3)', rows: [] },
    { title: 'CompassX: right knockdown? (PDS gain)', rows: [] },
    { title: 'guess-the-average: shape (our discrepancy)', rows: [], warn: true },
  ];
  ['1000', '2000', '5000'].forEach((pn) => ['likeness', 'size', 'position'].forEach((q, i) =>
    blocks[0].rows.push({ l: `${q} · ${nf(+pn)}`, p: Pp.W[pn][i], o: R.W.paper_anchor[pn].W[i] })));
  Object.entries(Pp.beta_pairs).forEach(([k, v]) => blocks[1].rows.push({ l: k.replace('_', ' / '), p: v, o: R.beta_pairs[k].r }));
  ['K562', 'RPE1', 'HepG2', 'Jurkat'].forEach((l) => blocks[2].rows.push({ l: `β, ${l}`, p: Pp.transfer_beta[l], o: R.transfer.ensembl[l].beta }));
  blocks[2].rows.push({ l: 'β, X-Atlas pair', p: Pp.transfer_beta['X-Atlas'], o: R.transfer.ensembl.HCT116.beta });
  ['K562', 'RPE1', 'HepG2', 'Jurkat'].forEach((l) => blocks[2].rows.push({ l: `own part, ${l}`, p: Pp.transfer_g[l], o: R.transfer.ensembl[l].g }));
  blocks[2].rows.push({ l: 'own part, X-Atlas pair', p: Pp.transfer_g['X-Atlas'], o: R.transfer.ensembl.HCT116.g });
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
  axisX(ctx, sx, Bt, [10, 25, 50, 100, 130], { label: 'knockdowns measured in the new line', range: [L, W - R] });
  axisY(ctx, sy, L, [0.2, 0.24, 0.28, 0.32], { label: 'prediction accuracy', fmt: f2, range: [Bt, T] });
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
  caps(ctx, 'raised by a typical knockdown', L, 14, { size: 9 });
  caps(ctx, 'lowered by a typical knockdown', W - R, 14, { size: 9, align: 'right' });
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
  const vmax = Math.max(...S.flatMap((s) => LINES.map((l) => Math.abs(s[l]))));   // area ∝ |score|
  LINES.forEach((l, j) => caps(ctx, l, L + cw * (j + 0.5), 16, { align: 'center', size: 8.5, spacing: 0.6 }));
  S.forEach((s, i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, s.signature.replace('Hallmark ', ''), L - 10, y + 4, { font: font.serif(11.5), color: INK['ink-2'], align: 'right' });
    penLine(ctx, L, y, W - R, y, 90 + i, rgba(INK.rule, 0.35), 0.5);
    LINES.forEach((l, j) => {
      const v = s[l], r = Math.max(1, rh * 0.46 * Math.sqrt(Math.abs(v) / vmax)), x = L + cw * (j + 0.5);
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
  caps(ctx, 'map of own parts (t-SNE) · near means similar; nothing else', ox, H - 6, { size: 8.5 });
}

function drawReliability(cv) {
  const { ctx, W, H } = setup(cv);
  const D = CP.meta.decomposition.per_line, L = 78, R = 44, T = 34, rh = (H - T - 64) / LINES.length;
  const sx = lin(0, 1, L, W - R);
  const keys = [['split_cos_u', 'typical response', INK.ink, 3.2], ['split_beta_r', 'strength β', INK['ink-2'], 2.6], ['split_residual_r', 'own part', INK.t3, 3.0]];
  keys.forEach(([, n, col], i) => { dot(ctx, L + i * 130, 14, 3, col); text(ctx, n, L + i * 130 + 8, 18, { font: font.serif(12, true), color: col }); });
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
    ['MegaFin, per cell type', Math.round(M.fin.hvg.megafin.per_context_median.n_perturbations)], ['ChemFish, per tissue', Math.round(E.chemfish.n_perturbations)],
    ['MiniFin, drugs', Z.MiniFin.perturbations]];
  const L = 156, R = 60, T = 26, rh = (H - T - 30) / rows.length, pitch = (W - L - R) / rows[0][1];
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
  caps(ctx, 'visible from', L + 30 * pitch - 22, H - 8, { align: 'right', size: 8.5, color: INK.select });
}

function drawStrength(cv) {
  const { ctx, W, H } = setup(cv);
  const P = CP.plates.p5, ed = P.ratio_edges, L = 20, R = 16, T = 18, B = H - 42;
  const sx = lin(ed[0], ed[ed.length - 1], L, W - R);
  const sets = [['crispr', 'CRISPRi knockdowns', INK.ink], ['tahoe', 'Tahoe drug-doses', INK.ink], ['chemfish', 'ChemFish drug conditions', INK.ink],
    ['megafin', 'MegaFin drug wells', INK.t6], ['megafin_wells', 'MegaFin, against the noise between wells', INK.t6]];
  const rh = (B - T) / sets.length;
  sets.forEach(([k, name, col], i) => {
    const d = P[k], tot = d.counts.reduce((a, b) => a + b, 0), mxv = Math.max(...d.counts) / tot, y0 = T + rh * (i + 1) - 4;
    ctx.beginPath(); ctx.moveTo(sx(ed[0]), y0);
    d.counts.forEach((c, j) => { const h = (c / tot / mxv) * (rh - 16); ctx.lineTo(sx(ed[j]), y0 - h); ctx.lineTo(sx(ed[j + 1]), y0 - h); });
    ctx.lineTo(sx(ed[ed.length - 1]), y0); ctx.closePath();
    ctx.fillStyle = rgba(col, 0.16); ctx.fill(); ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 0.8; ctx.stroke();
    text(ctx, name, W - R, y0 - rh + 26, { font: font.serif(12, true), align: 'right' });
    text(ctx, `median ${f2(d.median)}×  ·  ${Math.round(d.above_2x * 100)}% above 2×`, W - R, y0 - rh + 40, { font: font.serif(11), color: INK['ink-2'], align: 'right' });
  });
  const x2 = sx(Math.log10(2)); guide(ctx, x2, T, x2, B, INK.select);
  caps(ctx, '2× noise', x2 + 4, T + 8, { size: 8.5, color: INK.select });
  axisX(ctx, sx, B + 4, [-0.5, 0, 0.5, 1, 1.5, 2], { fmt: (v) => (Math.pow(10, v) < 10 ? Math.pow(10, v).toFixed(1) : Math.round(Math.pow(10, v))) + '×', label: 'response size ÷ difference between two halves of the controls', range: [L, W - R] });
}

function drawDepth(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, E = M.external, C = M.comparison;
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const col = 'COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)';
  const umis = [['CRISPRi', num(C['UMIs per cell (median, protein-coding)'][col])], ['Tahoe', num(C['UMIs per cell (median, protein-coding)']['Tahoe-100M'])],
    ['ChemFish', num(C['UMIs per cell (median, protein-coding)']['ChemFish 2026_09'])], ['MegaFin', M.zeroshot.MegaFin.median_umis]];
  // the same medians the comparison table prints
  const CC = C['cells per perturbation x context (median)'];
  const cells = [['CRISPRi', num(CC[col])], ['Tahoe', num(CC['Tahoe-100M'])], ['ChemFish', num(CC['ChemFish 2026_09'])],
    ['MegaFin', Math.round(M.fin.hvg.megafin.per_context_median.median_cells)]];
  const L = Math.min(150, W * 0.12), R = 30, sx = logs(20, 30000, L, W - R);
  [[umis, 'molecules per cell', H * 0.28], [cells, 'cells per perturbation, per context', H * 0.60]].forEach(([rows, lab, y]) => {
    caps(ctx, lab, L, y - 48, { size: 9 });
    penLine(ctx, L, y, W - R, y, 130 + y, INK.rule, 0.7);
    // labels alternate below / above by rank; a label too close to the last one on its side steps further out
    const order = rows.map((r) => r[1]).sort((a, b) => a - b), last = { up: -1e9, down: -1e9 };
    rows.slice().sort((a, b) => a[1] - b[1]).forEach(([n, v]) => {
      const i = rows.findIndex((r) => r[0] === n), x = sx(v), side = order.indexOf(v) % 2 ? 'down' : 'up';
      const far = x - last[side] < 80; last[side] = x;
      dot(ctx, x, y, 4, i === 0 ? INK.ink : INK['ink-3']);
      text(ctx, `${n} ${nf(v)}`, x, y + (side === 'down' ? (far ? 36 : 22) : (far ? -24 : -10)), { font: font.serif(12, true), align: 'center', color: i === 0 ? INK.ink : INK['ink-2'] });
    });
  });
  axisX(ctx, sx, H - 34, [30, 100, 300, 1000, 3000, 10000, 30000], { fmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), range: [L, W - R] });
}

function drawLanes(cv) {
  // A sketch: the arrangement is the claim, not the dot counts. The CRISPRi control share is K562's real share;
  // the plates show where the no-drug wells sit (Tahoe as deposited, MegaFin plate 1 from its sample names).
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, np = 4, pw = (W - 10 * (np + 1)) / np, top = 34, X = (i) => 10 + i * (pw + 10);
  const note = (x, y, lines) => lines.forEach((s, k) => text(ctx, s, x + pw / 2, y + k * 14, { font: font.serif(10.5, true), color: INK['ink-2'], align: 'center' }));
  [['CRISPRi', 'controls in the same lanes'], ['Tahoe', 'controls in own wells'], ['ChemFish', 'controls in own embryos'], ['MegaFin', 'controls in own wells']]
    .forEach(([a, b], i) => { caps(ctx, a, X(i) + pw / 2, 14, { align: 'center', size: 9.5, color: INK.ink });
      text(ctx, b, X(i) + pw / 2, 28, { font: font.serif(10.5, true), color: INK['ink-2'], align: 'center' }); });
  const frac = M.data.controls.K562 / M.data.cells.K562;
  { const x = X(0), y = top + 14, w = pw, h = H - top - 44; penRect(ctx, x, y, w, h, 150, INK.rule, 0.8);
    let k = 0; for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++) {
      const cx = x + 9 + c * ((w - 18) / 8), cy = y + 10 + r * ((h - 20) / 11), isC = ((k * 0.6180339) % 1) < frac; k++;
      dot(ctx, cx, cy, 2.2, isC ? INK.t3 : rgba(INK.ink, 0.55)); } }
  const plate = (x, ctrl, never, lines) => {
    const cell = Math.min((pw - 4) / 12, (H - top - 110) / 8), y = top + 22, x0 = x + (pw - 12 * cell) / 2;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const id = 'ABCDEFGH'[r] + (c + 1), cx = x0 + c * cell + cell / 2, cy = y + r * cell + cell / 2;
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38, 0, 6.283);
      if (never.has(id)) { ctx.fillStyle = INK.paper; ctx.fill(); ctx.strokeStyle = INK.t3; ctx.lineWidth = 1.4; ctx.stroke(); continue; }
      ctx.fillStyle = ctrl.has(id) ? INK.t3 : rgba(INK.ink, 0.12); ctx.fill(); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.6; ctx.stroke();
    }
    note(x, y + 8 * cell + 18, lines);
  };
  plate(X(1), new Set(['D1', 'G12']), new Set(), ['two DMSO wells a plate;', 'all 50 lines share', 'every well']);
  { const x = X(2), y = top + 26;
    for (let k = 0; k < 10; k++) { const cx = x + 14 + (k % 5) * ((pw - 28) / 4), cy = y + 16 + Math.floor(k / 5) * 44, isC = k >= 7;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.min(11, pw / 14), 16, 0.4, 0, 6.283); ctx.strokeStyle = INK['ink-3']; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = isC ? INK.t3 : rgba(INK.ink, 0.14); ctx.fill(); }
    note(x, y + 112, ['vehicle embryos are', 'separate animals;', 'tissues of one embryo', 'share it']); }
  plate(X(3), new Set(['A1', 'B1']), new Set(['G3', 'H3']), ['one DMSO well per dose', 'and two never-dosed wells', 'a plate; cell types', 'share every well']);
  dot(ctx, 16, H - 12, 3, INK.t3); text(ctx, 'control', 24, H - 8, { font: font.serif(11, true), color: INK['ink-2'] });
  ctx.beginPath(); ctx.arc(84, H - 12, 3.2, 0, 6.283); ctx.strokeStyle = INK.t3; ctx.lineWidth = 1.3; ctx.stroke();
  text(ctx, 'no-drug well, never dosed', 92, H - 8, { font: font.serif(11, true), color: INK['ink-2'] });
  caps(ctx, 'sketch', W - 8, H - 8, { align: 'right', size: 8.5 });
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
  text(ctx, 'knockdowns used', 0, 0, { font: font.serif(12.5, true), color: INK['ink-2'], align: 'center' }); ctx.restore();
  text(ctx, 'red outline: agreement of 0.5 or more', W - R, H - 6, { font: font.serif(11, true), color: INK.select, align: 'right' });
}

function drawDepthSweep(cv) {
  const { ctx, W, H } = setup(cv);
  const D = CP.meta.stress.depth, C = CP.meta.comparison, L = 50, R = 16, T = 18, B = H - 50;
  const sx = logs(20000, 250, L, W - R), sy = lin(0, 1, B, T);
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  [['Tahoe', num(C['UMIs per cell (median, protein-coding)']['Tahoe-100M'])], ['ChemFish', num(C['UMIs per cell (median, protein-coding)']['ChemFish 2026_09'])]]
    .concat([['MegaFin', CP.meta.zeroshot.MegaFin.median_umis]])
    .forEach(([n, v], i) => { const x = sx(v); guide(ctx, x, T, x, B); caps(ctx, `${n} depth`, x, T + 8 + (n === 'MegaFin' ? 12 : 0), { align: 'center', size: 8.5 }); });
  axisX(ctx, sx, B, [10000, 3000, 1000, 300], { fmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), label: 'molecules kept per cell (median)', range: [L, W - R] });
  axisY(ctx, sy, L, [0, 0.25, 0.5, 0.75, 1], { fmt: f2, range: [B, T] });
  [['cons_RN', 'lines agree on β (Replogle/Nadig)', INK.ink, null], ['cons_XA', 'lines agree on β (X-Atlas)', INK.ink, [4, 3]],
    ['beta_rel', 'β, measured twice', INK['ink-3'], [1, 3]], ['split_cos', 'typical response, measured twice', INK.t3, null]].forEach(([k, lab, col, dash]) => {
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
    const q = pts[m ? 4 : 5]; text(ctx, `lines agree on β, ${lab}`, sx(q[0]) + 6, sy(q[1]) + (m ? 18 : -10), { font: font.serif(11, true), back: true });
  });
  text(ctx, 'faint: does each line’s typical response still point the same way?', L + 6, B - 8, { font: font.serif(10.5, true), color: INK.t3 });
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
    text(ctx, `lines agree on β: ${f2(CC[s][0])} / ${f2(CC[s][1])}`, L - 10, y + 17, { font: font.serif(10.5), align: 'right', color: INK['ink-3'] });
  });
  axisX(ctx, sx, H - 36, [0, 0.25, 0.5, 0.75, 1], { label: 'match to the typical response from pooled controls (1 = same)', range: [L, W - R] });
}

/* ======================= PLATE VII — Tahoe, and the three datasets ======================= */

function drawTahoe(cv) {
  const { ctx, W, H } = setup(cv);
  const E = CP.meta.external.tahoe, w = E.dmso_well, t = E.dose_tiers;
  const L = 180, R = 40, T = 22;
  const bars = [['one well split in two (noise)', w.median_norm_sampling_noise, INK['ink-3']],
    ['no-drug well vs no-drug well', w.median_norm_well_diff, INK.select], ['a typical drug', w.median_drug_effect_norm, INK.ink]];
  const sx = lin(0, 2.5, L, W - R);
  caps(ctx, 'how big the difference is', L, T, { size: 9 });
  bars.forEach(([n, v, col], i) => { const y = T + 18 + i * 26;
    text(ctx, n, L - 10, y + 10, { font: font.serif(12, true), align: 'right' });
    ctx.fillStyle = rgba(col, 0.75); ctx.fillRect(L, y, sx(v) - L, 14); text(ctx, f2(v), sx(v) + 6, y + 11, { font: font.serif(11.5) }); });
  const y2 = T + 18 + 3 * 26 + 30;
  caps(ctx, 'does it look the same in all 50 lines?', L, y2, { size: 9 });
  const sx2 = lin(0, 0.5, L, W - R);
  [['the no-drug difference', w.mean_crossline_r_of_well_diff, INK.select], ['a real drug’s effect', w.mean_crossline_r_of_same_drug_effect, INK.ink]].forEach(([n, v, col], i) => {
    const y = y2 + 18 + i * 26; text(ctx, n, L - 10, y + 10, { font: font.serif(12, true), align: 'right' });
    ctx.fillStyle = rgba(col, 0.75); ctx.fillRect(L, y, sx2(v) - L, 14); text(ctx, 'r = ' + f2(v), sx2(v) + 6, y + 11, { font: font.serif(11.5) }); });
  const y3 = y2 + 18 + 2 * 26 + 30;
  caps(ctx, 'pull on the typical response (median β), by dose', L, y3, { size: 9 });
  const sx3 = lin(0, 1.3, L, W - R);
  ['lowest dose', 'middle dose', 'highest dose'].forEach((n, i) => { const v = t[String(i + 1)], y = y3 + 18 + i * 22;
    text(ctx, n, L - 10, y + 9, { font: font.serif(12, true), align: 'right' });
    dot(ctx, sx3(v), y + 5, 4, INK.ink); penLine(ctx, L, y + 5, sx3(v), y + 5, 200 + i, INK['ink-3'], 0.6); text(ctx, f2(v), sx3(v) + 8, y + 9, { font: font.serif(11.5) }); });
}

function drawThree(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, D = M.decomposition.per_line, E = M.external;
  const vals = (k) => LINES.map((l) => D[l][k]);
  const tW = E.tahoe.checks, cW = E.chemfish.checks, FM = M.fin.hvg.megafin, FP = FM.per_context_median;
  const rows = [
    ['share that is the shared part', vals('energy'), E.tahoe.energy, E.chemfish.energy, FP.energy_on_axis],
    ['typical response, measured twice', vals('split_cos_u'), E.tahoe.split_cos_u, E.chemfish.split_cos_u, FP.split_cos_uA_uB],
    ['β, measured twice', vals('split_beta_r'), E.tahoe.split_beta_r, E.chemfish.split_beta_r, FP.split_beta_r],
    ['own part, measured twice', vals('split_residual_r'), E.tahoe.split_residual_r, E.chemfish.split_residual_r, FP.split_residual_r_median],
    ['agree on which are strong', [(6 * M.reproduction.kendall_W_beta_all6 - 1) / 5], tW.mean_pairwise_spearman_from_W, cW.mean_pairwise_spearman_from_W, FM.conservation_pooled_ref.mean_pairwise_spearman_from_W],
  ];
  const L = Math.min(190, W * 0.45), R = 20, T = 34, rh = (H - T - 40) / rows.length, sx = lin(0, 1, L, W - R);
  let lx = 8;
  [['CRISPRi (bar spans six lines)', INK.ink], ['Tahoe', INK.t4], ['ChemFish', INK.t1], ['MegaFin (Plate VIII)', INK.t6]].forEach(([n, col]) => {
    dot(ctx, lx, 12, 3.2, col); text(ctx, n, lx + 8, 16, { font: font.serif(11.5, true), color: col });
    ctx.font = font.serif(11.5, true); lx += ctx.measureText(n).width + 26; });
  rows.forEach(([name, cr, ta, ch, mf], i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, name, L - 10, y + 4, { font: font.serif(12, true), align: 'right' });
    penLine(ctx, L, y, W - R, y, 220 + i, rgba(INK.rule, 0.6), 0.5);
    const lo = Math.min(...cr), hi = Math.max(...cr);
    ctx.beginPath(); ctx.moveTo(sx(lo), y); ctx.lineTo(sx(hi), y); ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.4; ctx.stroke();
    cr.forEach((v) => dot(ctx, sx(v), y, 2.2, INK.ink));
    dot(ctx, sx(ta), y - 8, 3.6, INK.t4); dot(ctx, sx(ch), y + 8, 3.6, INK.t1); dot(ctx, sx(mf), y + 16, 3.6, INK.t6);
  });
  axisX(ctx, sx, H - 24, [0, 0.25, 0.5, 0.75, 1], { range: [L, W - R] });
}

/* ======================= PLATE VIII — the test, run on our own screens ======================= */

const pct = (v) => Math.round(v * 100) + '%';

function drawFinWells(cv) {
  const { ctx, W } = setup(cv);
  const F = CP.meta.fin.hvg.megafin, nd = F.nodrug_within_plate, L = Math.min(178, W * 0.44), R = 44;
  const groups = [
    { title: 'how big the difference is', max: Math.max(nd.median_norm_diff, F.median_drug_effect_norm) * 1.12, fmt: f2, bars: [
      ['sampling alone would give', nd.median_expected_sampling, INK['ink-3']],
      ['no-drug well vs no-drug well', nd.median_norm_diff, INK.select],
      ['a typical drug vs the controls', F.median_drug_effect_norm, INK.ink]] },
    { title: 'pull on the typical response', max: 1.12, fmt: pct, bars: [
      ['the no-drug difference', nd.median_abs_beta_well_over_median_drug_beta, INK.select],
      ['Tahoe’s no-drug difference', CP.meta.external.tahoe.dmso_well.median_abs_beta_well_over_median_drug_beta, INK['ink-3']]] },
    { title: 'alike across cell types?', max: 1, fmt: (v) => 'r = ' + f2(v), bars: [
      ['the no-drug difference', F.crosscluster_r_of_nodrug_difference_mean, INK.select],
      ['a drug’s effect', F.crosscluster_r_of_drug_effect_mean, INK.ink]] },
  ];
  let y = 16;
  groups.forEach((g) => {
    caps(ctx, g.title, L, y, { size: 8.5 }); y += 10;
    const sx = lin(0, g.max, L, W - R);
    g.bars.forEach(([n, v, col]) => {
      text(ctx, n, L - 8, y + 10, { font: font.serif(11.5, true), align: 'right' });
      ctx.fillStyle = rgba(col, 0.75); ctx.fillRect(L, y, Math.max(1, sx(v) - L), 13);
      text(ctx, g.fmt(v), sx(v) + 5, y + 10, { font: font.serif(11) });
      y += 21;
    });
    y += 16;
  });
}

function drawFinDose(cv) {
  const { ctx, W, H } = setup(cv);
  const M = CP.meta, L = Math.min(178, W * 0.44), R = 48, T = 34;
  const rows = [['Tahoe (three doses)', M.external.tahoe.checks.frac_rho_positive, INK['ink-3']],
    ['MegaFin', M.fin.hvg.megafin.dose.frac_beta5_gt_beta1, INK.t6], ['MegaFin, second gene panel', M.fin.expressed.megafin.dose.frac_beta5_gt_beta1, INK.t6]];
  const sx = lin(0, 1, L, W - R), B = H - 40;
  caps(ctx, 'share of drug × context pairs where the higher', 8, 12, { size: 8.5 });
  caps(ctx, 'dose pulls harder on the typical response', 8, 24, { size: 8.5 });
  rows.forEach(([n, v, col], i) => {
    const y = T + 16 + i * 34;
    text(ctx, n, L - 8, y + 10, { font: font.serif(11.5, true), align: 'right' });
    ctx.fillStyle = rgba(col, 0.8); ctx.fillRect(L, y, sx(v) - L, 14);
    text(ctx, pct(v), sx(v) + 5, y + 11, { font: font.serif(11.5) });
  });
  const x5 = sx(0.5); guide(ctx, x5, T + 6, x5, B, INK.select);
  text(ctx, 'a coin toss', x5 + 4, B - 6, { font: font.serif(11, true), color: INK.select });
  text(ctx, 'a real dose response sits well to the right', W - R, B + 34, { font: font.serif(11, true), color: INK['ink-2'], align: 'right' });
  axisX(ctx, sx, B, [0, 0.25, 0.5, 0.75, 1], { fmt: pct, range: [L, W - R] });
}

function drawFinRep(cv) {
  const { ctx, W, H } = setup(cv);
  const F = CP.meta.fin, L = 46, R = 18, T = 30, B = H - 50;
  const sx = logs(1, 24, L + 10, W - R), sy = lin(0, 1, B, T);
  caps(ctx, 'share of drug × cell-type effects that clear', L, 12, { size: 8.5 });
  caps(ctx, 'twice the well-to-well noise', L, 24, { size: 8.5 });
  axisX(ctx, sx, B, [1, 2, 4, 8, 12, 24], { label: 'wells per drug (with at least 4 no-drug wells)', range: [L, W - R] });
  axisY(ctx, sy, L, [0, 0.25, 0.5, 0.75, 1], { fmt: pct, range: [B, T] });
  guide(ctx, L, sy(0.5), W - R, sy(0.5));
  [['hvg', [], 'headline gene panel'], ['expressed', [4, 3], 'second gene panel']].forEach(([p, dash, lab], m) => {
    const pr = F[p].replication.projection, xs = pr.map((r) => sx(r.wells_per_drug)), ys = pr.map((r) => sy(r.frac_over_2x_noise));
    path(ctx, xs, ys, INK.ink, 1.5, dash.length ? dash : null); xs.forEach((x, i) => dot(ctx, x, ys[i], 2.3, INK.ink));
    text(ctx, lab, xs.at(-1) - 2, ys.at(-1) + (m ? -9 : 16), { font: font.serif(11, true), align: 'right', back: true });
  });
  const x1 = sx(1), y1 = sy(F.hvg.replication.projection[0].frac_over_2x_noise);
  dot(ctx, x1, y1, 5.5, null, INK.select);
  text(ctx, 'MegaFin today', x1 + 9, y1 + 4, { font: font.serif(11.5, true), color: INK.select, back: true });
}

/* ======================= PLATE IX — clearing the bar ======================= */

const DS_ORDER = ['CRISPRi', 'Tahoe', 'ChemFish', 'MegaFin', 'MiniFin'];
const dsInk = () => ({ CRISPRi: INK.ink, Tahoe: INK.t4, ChemFish: INK.t1, MegaFin: INK.t6, MiniFin: INK.t2 });

/* The four requirements that have a number, each with its bar (from this page's own tests) and each dataset's value.
   "The noise it has to beat": halves of the controls where controls share the screen (CRISPRi, ChemFish's embryos),
   two no-drug wells where every context shares a well (Tahoe, MegaFin), MiniFin's measured noise between wells. */
function gauges() {
  const M = CP.meta, E = M.external, Z = M.zeroshot, C = M.comparison, F = M.fin, mf = F.hvg.megafin, mn = F.hvg.minifin, w = E.tahoe.dmso_well;
  const num = (s) => parseFloat(String(s).replace(/,/g, '')), CR = 'COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)';
  const CC = C['cells per perturbation x context (median)'], UM = C['UMIs per cell (median, protein-coding)'];
  const whole = (v) => nf(Math.round(v));
  return [
    { key: 'perts', title: 'perturbations per cell line, tissue or cell type', bar: 30, lo: 1, hi: 6000, fmt: whole,
      why: 'a typical response appears from about 30 (Plate V)',
      v: { CRISPRi: M.anchor.ensembl, Tahoe: E.tahoe.n_perturbations, ChemFish: E.chemfish.n_perturbations, MegaFin: mf.per_context_median.n_perturbations, MiniFin: Z.MiniFin.perturbations } },
    { key: 'cells', title: 'cells per perturbation, in each cell line, tissue or cell type', bar: 25, lo: 5, hi: 5000, fmt: whole,
      why: 'the lines still agree from about 25 (Plate VI)',
      v: { CRISPRi: num(CC[CR]), Tahoe: num(CC['Tahoe-100M']), ChemFish: num(CC['ChemFish 2026_09']), MegaFin: F.cells_pair_median.MegaFin, MiniFin: F.cells_pair_median.MiniFin } },
    { key: 'depth', title: 'molecules read per cell', bar: 1000, lo: 200, hi: 30000, fmt: whole,
      why: 'thinning costs little above about 1,000 (Plate VI)',
      v: { CRISPRi: num(UM[CR]), Tahoe: num(UM['Tahoe-100M']), ChemFish: num(UM['ChemFish 2026_09']), MegaFin: Z.MegaFin.median_umis, MiniFin: Z.MiniFin.median_umis } },
    { key: 'ratio', title: 'a typical response ÷ the noise it has to beat', bar: 2, lo: 0.5, hi: 12, fmt: (v) => v.toFixed(1) + '×',
      why: 'a response should be at least twice the noise',
      v: { CRISPRi: CP.plates.p5.crispr.median, Tahoe: w.median_drug_effect_norm / w.median_norm_well_diff, ChemFish: CP.plates.p5.chemfish.median,
           MegaFin: mf.median_drug_effect_norm / mf.nodrug_within_plate.median_norm_diff, MiniFin: mn.Sorafenib.median_single_well_over_null } },
  ];
}

function drawBar(cv) {
  // height follows the content: each gauge needs about 120 px whatever the width; narrow, the bar's note drops a line
  const Wp = Math.max(280, cv.parentElement.clientWidth, +(cv.dataset.minw || 0)), narrow = Wp < 900;
  cv.dataset.aspect = String(Math.max(0.4, (4 * (narrow ? 132 : 118) + 34) / Wp));
  const { ctx, W, H } = setup(cv);
  const G = gauges(), col = dsInk(), L = 22, R = 22, gh = (H - 34) / G.length;
  G.forEach((g, k) => {
    const y0 = 4 + k * gh, yl = y0 + gh * (narrow ? 0.66 : 0.6), sx = logs(g.lo, g.hi, L, W - R), xb = sx(g.bar);
    text(ctx, g.title, L, y0 + 16, { font: font.serif(13.5, true) });
    if (narrow) text(ctx, `the bar: ${g.fmt(g.bar)} — ${g.why}`, L, y0 + 31, { font: font.serif(11, true), color: INK.select });
    else text(ctx, `the bar: ${g.fmt(g.bar)} — ${g.why}`, W - R, y0 + 16, { font: font.serif(11, true), color: INK.select, align: 'right' });
    ctx.fillStyle = rgba(INK.ink, 0.045); ctx.fillRect(xb, yl - 14, W - R - xb, 28);
    penLine(ctx, L, yl, W - R, yl, 300 + k, INK['ink-3'], 0.8);
    ctx.beginPath(); ctx.moveTo(xb, yl - 16); ctx.lineTo(xb, yl + 16); ctx.strokeStyle = INK.select; ctx.lineWidth = 2.2; ctx.stroke();
    const pts = DS_ORDER.map((d) => ({ d, v: g.v[d], x: sx(Math.max(g.lo, Math.min(g.hi, g.v[d]))) })).sort((a, b) => a.x - b.x);
    const last = { up: -1e9, down: -1e9 };
    pts.forEach((p, i) => {
      const side = i % 2 ? 'down' : 'up', far = p.x - last[side] < 90, clears = p.v >= g.bar;
      last[side] = p.x;
      dot(ctx, p.x, yl, 5.5, clears ? col[p.d] : INK.paper, col[p.d]);
      const yy = side === 'up' ? yl - (far ? 30 : 13) : yl + (far ? 38 : 23);
      text(ctx, `${p.d} ${g.fmt(p.v)}`, p.x, yy, { font: font.serif(12, !clears), color: col[p.d], align: 'center', back: true });
    });
  });
}

function drawScore(cv) {
  const { ctx, W, H } = setup(cv);
  const G = gauges(), col = dsInk();
  const heads = [['many', 'perturbations'], ['enough cells', 'per cell type'], ['enough', 'sequencing'], ['beats the', 'noise'],
    ['controls mixed', 'in with the rest'], ['each perturbation', 'repeated'], ['passes the', 'artefact checks']];
  const fixed = { CRISPRi: ['y', 'y', 'y'], Tahoe: ['n', 'n', 'n'], ChemFish: ['n', 'p', '-'], MegaFin: ['n', 'n', 'n'], MiniFin: ['n', 'y', '-'] };
  const verdict = { CRISPRi: ['yes', 'the paper’s result, reproduced'], Tahoe: ['it looks like it', 'but it is the wells'],
    ChemFish: ['no', 'too few drugs, too weak'], MegaFin: ['it looks like it', 'but not yet: no repeats'], MiniFin: ['no', 'three drugs, but it measures the noise'] };
  const L = 96, T = 54, vw = Math.min(250, W * 0.24), cw = (W - L - vw - 16) / heads.length, rh = (H - T - 34) / DS_ORDER.length, vx = L + heads.length * cw + 16;
  heads.forEach(([a, b], j) => { const x = L + cw * (j + 0.5);
    caps(ctx, a, x, T - 28, { align: 'center', size: 8.5, spacing: 0.6 }); caps(ctx, b, x, T - 15, { align: 'center', size: 8.5, spacing: 0.6 }); });
  caps(ctx, 'a COMPASS result', vx, T - 28, { size: 8.5, spacing: 0.6, color: INK.ink }); caps(ctx, 'you can trust?', vx, T - 15, { size: 8.5, spacing: 0.6, color: INK.ink });
  penLine(ctx, 8, T - 6, W - 8, T - 6, 399, INK.ink, 0.8);
  DS_ORDER.forEach((d, i) => {
    const y = T + rh * (i + 0.5), r = Math.min(9, rh * 0.24);
    penLine(ctx, 8, T + rh * (i + 1), W - 8, T + rh * (i + 1), 400 + i, rgba(INK.rule, 0.6), 0.5);
    text(ctx, d, L - 14, y + 5, { font: font.serif(15, true), color: col[d], align: 'right' });
    G.map((g) => (g.v[d] >= g.bar ? 'y' : 'n')).concat(fixed[d]).forEach((m, j) => {
      const x = L + cw * (j + 0.5);
      if (m === '-') { text(ctx, '–', x, y + 5, { font: font.serif(16), color: INK['ink-3'], align: 'center' }); return; }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = m === 'y' ? INK.ink : INK.paper; ctx.fill();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.3; ctx.stroke();
      if (m === 'p') { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = INK.ink; ctx.fill(); }
    });
    const [v, why] = verdict[d];
    text(ctx, v, vx, y, { font: v === 'yes' ? `600 14px ${INK.serif}` : font.serif(14, true), color: v === 'yes' ? INK.ink : INK['ink-2'] });
    text(ctx, why, vx, y + 16, { font: font.serif(11.5, true), color: INK['ink-3'] });
  });
  const ly = H - 12; let lx = L;
  [['y', 'clears the bar'], ['p', 'partly'], ['n', 'falls short'], ['-', 'cannot be tested']].forEach(([m, lab]) => {
    if (m === '-') text(ctx, '–', lx, ly + 4, { font: font.serif(15), color: INK['ink-3'], align: 'center' });
    else { ctx.beginPath(); ctx.arc(lx, ly, 5, 0, 6.283); ctx.fillStyle = m === 'y' ? INK.ink : INK.paper; ctx.fill(); ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.1; ctx.stroke();
      if (m === 'p') { ctx.beginPath(); ctx.moveTo(lx, ly - 5); ctx.arc(lx, ly, 5, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = INK.ink; ctx.fill(); } }
    text(ctx, lab, lx + 10, ly + 4, { font: font.serif(11.5, true), color: INK['ink-2'] });
    ctx.font = font.serif(11.5, true); lx += ctx.measureText(lab).width + 36;
  });
}

/* The next MegaFin on MegaFin's own budget: 192 wells, 16 of them no-drug and 8 for two reference drugs. */
const NEXT = { wells: 192, nodrug: 16, ref: 8, ks: [1, 2, 3, 4, 6, 8], pick: 4 };
function nextDrugs(k) { return Math.floor((NEXT.wells - NEXT.nodrug - NEXT.ref) / (2 * k)); }

function drawTrade(cv) {
  const { ctx, W, H } = setup(cv);
  const F = CP.meta.fin, ks = NEXT.ks, L = 56, R = 14, T = 20, mid = H * 0.44, B = H - 44, cw = (W - L - R) / ks.length;
  const at = (s, k) => s.replication.projection.find((r) => r.wells_per_drug === k).frac_over_2x_noise;
  const j4 = ks.indexOf(NEXT.pick);
  ctx.fillStyle = rgba(INK.select, 0.06); ctx.fillRect(L + cw * j4 + 2, T - 6, cw - 4, B - T + 10);
  caps(ctx, 'drug-doses that fit', L, T + 4, { size: 8.5 });
  const sy1 = lin(0, 180, mid - 6, T + 20);
  ks.forEach((k, j) => {
    const v = 2 * nextDrugs(k), x = L + cw * j + cw * 0.22, w = cw * 0.56, ok = v >= 30;
    ctx.fillStyle = rgba(INK.ink, ok ? 0.55 : 0.2); ctx.fillRect(x, sy1(v), w, mid - 6 - sy1(v));
    text(ctx, nf(v), x + w / 2, sy1(v) - 4, { font: font.serif(11.5), align: 'center' });
  });
  const y30 = sy1(30); guide(ctx, L, y30, W - R, y30, INK.select);
  text(ctx, 'needed: 30', W - R, y30 - 4, { font: font.serif(11, true), color: INK.select, align: 'right' });
  caps(ctx, 'drug × cell-type effects clearing twice the noise', L, mid + 18, { size: 8.5 });
  const sy2 = lin(0, 0.6, B, mid + 32);
  axisY(ctx, sy2, L, [0, 0.2, 0.4, 0.6], { fmt: pct, range: [B, mid + 32] });
  [['hvg', null, 'headline gene panel'], ['expressed', [4, 3], 'second gene panel']].forEach(([p, dash, lab], m) => {
    const xs = ks.map((k, j) => L + cw * (j + 0.5)), ys = ks.map((k) => sy2(at(F[p], k)));
    path(ctx, xs, ys, INK.ink, 1.5, dash); xs.forEach((x, i) => dot(ctx, x, ys[i], 2.4, INK.ink));
    text(ctx, lab, xs.at(-1), ys.at(-1) + (m ? -9 : 16), { font: font.serif(10.5, true), align: 'right', back: true });
  });
  ks.forEach((k, j) => caps(ctx, String(k), L + cw * (j + 0.5), B + 15, { align: 'center', size: 9 }));
  text(ctx, 'wells per drug-dose', (L + W - R) / 2, B + 32, { font: font.serif(12, true), color: INK['ink-2'], align: 'center' });
  text(ctx, 'MegaFin today', L + cw * 0.5, sy2(at(F.hvg, 1)) - 10, { font: font.serif(11, true), color: INK.select, align: 'left', back: true });
  text(ctx, 'the proposal', L + cw * (j4 + 0.5), T + 8, { font: font.serif(11.5, true), color: INK.select, align: 'center' });
}

function seeded(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function layoutAsRun() {
  const role = {};
  for (const r of 'ABCDEFGH') for (let c = 1; c <= 12; c++) role[r + c] = { t: 'drug', dose: 'ACEG'.includes(r) ? 5 : 1 };
  role.A1 = role.B1 = { t: 'nodrug' }; role.G3 = role.H3 = { t: 'never' };
  role.A2 = { t: 'ref', dose: 5 }; role.B2 = { t: 'ref', dose: 1 };
  return role;
}
function layoutNext() {
  const rnd = seeded(20260911), role = {}, all = [];
  for (const r of 'ABCDEFGH') for (let c = 1; c <= 12; c++) all.push(r + c);
  ['A1', 'H12', 'B6', 'G7', 'C11', 'F2', 'D4', 'E9'].forEach((w) => { role[w] = { t: 'nodrug' }; });   // one per row, each in its own column
  [['A8', 5], ['H3', 1], ['D10', 5], ['E5', 1]].forEach(([w, dose]) => { role[w] = { t: 'ref', dose }; });
  const free = all.filter((w) => !role[w]);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  let k = 0;
  for (let d = 0; d < nextDrugs(NEXT.pick); d++) for (const dose of [5, 1]) for (let rep = 0; rep < NEXT.pick / 2; rep++) role[free[k++]] = { t: 'drug', drug: d, dose };
  return role;
}

function drawNext(cv) {
  const { ctx, W, H } = setup(cv);
  const pw = (W - 30) / 2, cell = Math.min(pw / 12.4, (H - 130) / 8);
  const plates = [['MegaFin plate 1, as run', layoutAsRun(), ['92 drug wells, one per drug-dose;', '2 DMSO wells, 2 never dosed']],
    ['the next one: plate 1 of 2, a proposal', layoutNext(), [`${nextDrugs(NEXT.pick)} drugs × 2 doses × 2 wells here, 2 more on plate 2;`, '8 no-drug wells, 2 reference drugs']]];
  plates.forEach(([title, role, lines], p) => {
    const px = 10 + p * (pw + 10), x0 = px + (pw - 12 * cell) / 2, y0 = 34;
    text(ctx, title, px + pw / 2, 16, { font: font.serif(12.5, true), align: 'center' });
    'ABCDEFGH'.split('').forEach((r, i) => {
      for (let c = 1; c <= 12; c++) {
        const w = role[r + c], cx = x0 + (c - 1) * cell + cell / 2, cy = y0 + i * cell + cell / 2;
        ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4, 0, 6.283);
        if (w.t === 'never') { ctx.fillStyle = INK.paper; ctx.fill(); ctx.strokeStyle = INK.t3; ctx.lineWidth = 1.5; ctx.stroke(); continue; }
        ctx.fillStyle = w.t === 'nodrug' ? INK.t3 : w.t === 'ref' ? INK.t1 : w.drug === 0 ? INK.select : rgba(INK.ink, w.dose === 5 ? 0.6 : 0.22);
        ctx.fill();
      }
    });
    lines.forEach((s, k) => text(ctx, s, px + pw / 2, y0 + 8 * cell + 20 + k * 15, { font: font.serif(11, true), color: INK['ink-2'], align: 'center' }));
  });
  const items = [[rgba(INK.ink, 0.6), 'drug, 5 µM'], [rgba(INK.ink, 0.22), 'drug, 1 µM'], [INK.t3, 'no drug'], [null, 'never dosed'],
    [INK.t1, 'reference drug (MegaFin: Sorafenib)'], [INK.select, 'one drug’s four wells on this plate']];
  let lx = 16, ly = H - 30;
  items.forEach(([c, lab]) => {
    ctx.font = font.serif(11, true); const w = ctx.measureText(lab).width + 34;
    if (lx + w > W - 8) { lx = 16; ly += 17; }
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, 6.283);
    if (c) { ctx.fillStyle = c; ctx.fill(); } else { ctx.strokeStyle = INK.t3; ctx.lineWidth = 1.4; ctx.stroke(); }
    text(ctx, lab, lx + 10, ly + 4, { font: font.serif(11, true), color: INK['ink-2'] });
    lx += w;
  });
}
