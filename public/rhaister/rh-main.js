/* /rhaister — the beginning of an analysis.
 *
 * Every number printed here is read from meta.json: the authors' reported values (with where they are
 * reported), the shapes of the screens and the plan. Plate I is a sketch built so that its combination
 * is exact; it is an illustration of the method, not data, and it says so on the plate.
 */
'use strict';

const RH = { meta: null };
const $ = (id) => document.getElementById(id);

async function load() {
  const r = await fetch('/rhaister/meta.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`could not fetch meta.json (${r.status})`);
  RH.meta = await r.json();
}

/* ---------------- the sketch: a made-up screen in which the target IS a weighted sum of the panel ---------------- */
const SK = (() => {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const G = 8, C = 5, P = 8, panel = [0, 1, 2, 3], target = 5, w = [0.6, 0.35, -0.4, 0.15];
  const base = Array.from({ length: P }, () => Array.from({ length: G }, () => rnd() * 2 - 1));
  const shift = Array.from({ length: C + 1 }, () => Array.from({ length: G }, () => (rnd() * 2 - 1) * 0.5));
  const gain = Array.from({ length: C + 1 }, () => 0.7 + rnd() * 0.6);
  const raw = (c, p) => base[p].map((v, g) => gain[c] * v + shift[c][g] * (p % 3 === 0 ? 0.8 : 0.4));
  const y = (c, p) => (p === target ? raw(c, 0).map((_, g) => panel.reduce((a, q, k) => a + w[k] * raw(c, q)[g], 0)) : raw(c, p));
  let vmax = 0;
  for (let c = 0; c <= C; c++) for (let p = 0; p < P; p++) y(c, p).forEach((v) => { vmax = Math.max(vmax, Math.abs(v)); });
  return { G, C, P, panel, target, w, y, vmax, letters: ['A', 'B', 'C', 'D', 'E', 'p*', 'G', 'H'] };
})();

function glyph(ctx, x, y, w, h, vec, col) {
  const mid = y + h / 2, bw = w / vec.length;
  ctx.beginPath(); ctx.moveTo(x, mid); ctx.lineTo(x + w, mid); ctx.strokeStyle = rgba(INK.ink, 0.22); ctx.lineWidth = 0.6; ctx.stroke();
  vec.forEach((v, g) => {
    const bh = (v / SK.vmax) * (h / 2 - 1);
    ctx.fillStyle = col; ctx.fillRect(x + g * bw + bw * 0.16, bh >= 0 ? mid - bh : mid, bw * 0.68, Math.abs(bh));
  });
}

function arrow(ctx, x1, y1, x2, y2, col = INK['ink-3']) {
  penLine(ctx, x1, y1, x2, y2, 17, col, 1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(a - 0.4), y2 - 8 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 8 * Math.cos(a + 0.4), y2 - 8 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

/* ---------------- Plate I — observed, combined, predicted ---------------- */
function drawIdea(cv) {
  const { ctx, W, H } = setup(cv);
  const S = SK, rows = S.C + 1, top = 70;
  const x1 = 96, w1 = W * 0.34, x2 = x1 + w1 + 56, w2 = W * 0.2, x3 = x2 + w2 + 56, w3 = W - x3 - 16;
  // two-line stage heads, so they never run into each other at the narrowest width
  const heads = [[x1 - 80, '1 · observed', 'responses'], [x2, '2 · a simple combination', 'of known responses'], [x3, '3 · a prediction of', 'the unseen response']];
  heads.forEach(([x, a, b]) => { caps(ctx, a, x, 14, { size: 10, color: INK.ink }); caps(ctx, b, x, 28, { size: 10, color: INK.ink }); });
  caps(ctx, 'sketch · a made-up screen, built so the combination is exact', W - 16, 46, { size: 8.5, align: 'right', color: INK.select, clamp: W });

  // 1 · the screen: reference contexts fully measured, the new context only on its panel
  const tw = w1 / S.P, th = Math.min(40, (H - top - 92) / (rows + 0.7));
  S.letters.forEach((l, p) => text(ctx, l, x1 + tw * (p + 0.5), top - 8, {
    font: font.serif(12.5, true), align: 'center', color: p === S.target ? INK.select : S.panel.includes(p) ? INK.ink : INK['ink-3'] }));
  const rowY = (c) => top + c * th + (c === S.C ? th * 0.7 : 0);
  for (let c = 0; c <= S.C; c++) {
    const isNew = c === S.C, yy = rowY(c);
    text(ctx, isNew ? 'new context' : `reference ${c + 1}`, x1 - 10, yy + th / 2 + 4, { font: font.serif(12, true), align: 'right', color: isNew ? INK.ink : INK['ink-2'] });
    for (let p = 0; p < S.P; p++) {
      const x = x1 + p * tw + 2, gy = yy + 2, gw = tw - 4, gh = th - 4;
      if (isNew && !S.panel.includes(p)) {
        ctx.save(); ctx.setLineDash([2, 2]); ctx.strokeStyle = p === S.target ? INK.select : INK.rule; ctx.lineWidth = p === S.target ? 1.4 : 0.8;
        ctx.strokeRect(x, gy, gw, gh); ctx.restore();
        text(ctx, '?', x + gw / 2, gy + gh / 2 + 5, { font: font.serif(13, true), align: 'center', color: p === S.target ? INK.select : INK['ink-3'] });
        continue;
      }
      ctx.strokeStyle = p === S.target ? INK.t1 : INK['rule-2']; ctx.lineWidth = p === S.target ? 1.4 : 0.6; ctx.strokeRect(x, gy, gw, gh);
      glyph(ctx, x + 2, gy + 2, gw - 4, gh - 4, S.y(c, p), rgba(INK.ink, S.panel.includes(p) || p === S.target ? 0.8 : 0.32));
    }
  }
  const by = rowY(S.C) + th + 12;
  penLine(ctx, x1 + 2, by, x1 + S.panel.length * tw - 2, by, 5, INK.ink, 0.9);
  text(ctx, 'the panel: measured in every context', x1, by + 16, { font: font.serif(11.5, true), color: INK['ink-2'] });
  text(ctx, 'ochre: p* where it was measured', x1, by + 32, { font: font.serif(11.5, true), color: INK.t1 });

  // 2 · the weights, learned where p* was measured
  const my = top + 6, rh2 = Math.min(44, (H - my - 110) / S.panel.length), cx = x2 + w2 * 0.55, wmax = 0.7;
  arrow(ctx, x1 + w1 + 8, top + (rows * th) / 2, x2 - 12, top + (rows * th) / 2);
  S.panel.forEach((q, k) => {
    const y = my + k * rh2, len = (S.w[k] / wmax) * (w2 * 0.42);
    text(ctx, S.letters[q], x2, y + rh2 / 2 + 4, { font: font.serif(13, true) });
    penLine(ctx, cx, y + 4, cx, y + rh2 - 4, 30 + k, INK.rule, 0.6);
    ctx.fillStyle = S.w[k] >= 0 ? rgba(INK.t1, 0.8) : rgba(INK.t4, 0.8);
    ctx.fillRect(Math.min(cx, cx + len), y + rh2 * 0.3, Math.abs(len), rh2 * 0.4);
    text(ctx, (S.w[k] >= 0 ? '+' : '−') + Math.abs(S.w[k]).toFixed(2), cx + len + (len >= 0 ? 6 : -6), y + rh2 / 2 + 4,
      { font: font.serif(12), align: len >= 0 ? 'left' : 'right' });
  });
  const ty = my + S.panel.length * rh2 + 18;
  text(ctx, 'one weight per panel perturbation,', x2, ty, { font: font.serif(12, true), color: INK['ink-2'] });
  text(ctx, 'shared by every gene, fitted across', x2, ty + 16, { font: font.serif(12, true), color: INK['ink-2'] });
  text(ctx, 'the reference contexts (ridge regression)', x2, ty + 32, { font: font.serif(12, true), color: INK['ink-2'] });

  // 3 · the new context's own panel, combined with the same weights
  arrow(ctx, x2 + w2 + 8, top + (rows * th) / 2, x3 - 12, top + (rows * th) / 2);
  const gw3 = Math.min(90, w3 * 0.34), gh3 = Math.min(40, rh2 - 6);
  S.panel.forEach((q, k) => {
    const y = my + k * rh2 + (rh2 - gh3) / 2;
    text(ctx, `${S.w[k] >= 0 ? '+' : '−'}${Math.abs(S.w[k]).toFixed(2)} ×`, x3 + 44, y + gh3 / 2 + 4, { font: font.serif(12), align: 'right' });
    ctx.strokeStyle = INK['rule-2']; ctx.lineWidth = 0.6; ctx.strokeRect(x3 + 50, y, gw3, gh3);
    glyph(ctx, x3 + 52, y + 2, gw3 - 4, gh3 - 4, S.y(S.C, q), rgba(INK.ink, 0.8));
    text(ctx, S.letters[q], x3 + 50 + gw3 + 6, y + gh3 / 2 + 4, { font: font.serif(12, true), color: INK['ink-3'] });
  });
  const px = x3 + 50, py = my + S.panel.length * rh2 + 20, pw = gw3, ph = gh3 + 8;
  text(ctx, '=', px - 16, py + ph / 2 + 5, { font: font.serif(18), align: 'center' });
  ctx.strokeStyle = INK.select; ctx.lineWidth = 1.6; ctx.strokeRect(px, py, pw, ph);
  glyph(ctx, px + 2, py + 2, pw - 4, ph - 4, S.y(S.C, S.target), rgba(INK.select, 0.85));
  text(ctx, 'predicted p*', px + pw + 8, py + ph / 2, { font: font.serif(12.5, true), color: INK.select });
  text(ctx, 'in the new context', px + pw + 8, py + ph / 2 + 15, { font: font.serif(12.5, true), color: INK.select });

  text(ctx, 'ŷ(new context, p*)  =  Σ over panel perturbations q  of  weight(q) × y(new context, q)', W / 2, H - 14,
    { font: font.serif(14, true), align: 'center', color: INK.ink, clamp: W });
}

/* ---------------- Plate II — what the authors report ---------------- */
function drawReported(cv) {
  const { ctx, W, H } = setup(cv);
  const R = RH.meta.reported, mets = R.metrics, rows = R.rows;
  const L = Math.min(250, W * 0.26), T = 52, cw = (W - L - 16) / mets.length, rh = (H - T - 14) / rows.length;
  mets.forEach((m, j) => {
    const x = L + cw * (j + 0.5);
    caps(ctx, m.short, x, 16, { align: 'center', size: 9.5, color: INK.ink });
    text(ctx, m.plain, x, 32, { font: font.serif(11, true), color: INK['ink-3'], align: 'center' });
  });
  penLine(ctx, 8, T - 10, W - 8, T - 10, 50, INK.ink, 0.8);
  rows.forEach((r, i) => {
    const y = T + rh * (i + 0.5);
    text(ctx, r.label, L - 16, y + 1, { font: font.serif(14, true), align: 'right' });
    text(ctx, `${r.mode} · ${r.splits} split${r.splits > 1 ? 's' : ''}`, L - 16, y + 17, { font: font.serif(11, true), align: 'right', color: INK['ink-3'] });
    penLine(ctx, 8, T + rh * (i + 1), W - 8, T + rh * (i + 1), 60 + i, rgba(INK.rule, 0.6), 0.5);
    mets.forEach((m, j) => {
      const x0 = L + cw * j + 16, x1 = L + cw * (j + 1) - 16, sx = lin(0, 1, x0, x1), v = r.values[m.key];
      penLine(ctx, x0, y, x1, y, 70 + i * 7 + j, INK['rule-2'], 0.7);
      [0, 1].forEach((t) => caps(ctx, t, sx(t), y + 15, { align: 'center', size: 7.5, spacing: 0.3 }));
      dot(ctx, sx(v), y, 5, INK.paper, INK.ink);
      text(ctx, f2(v), sx(v), y - 10, { font: font.serif(12), align: 'center' });
    });
  });
}

/* ---------------- Plate III — the shape of each screen, to one scale ---------------- */
function drawShapes(cv) {
  // height follows the content: the unit is set by the width, then the rows are stacked
  const S = RH.meta.shapes, gap = 26, T = 28;
  const Wp = Math.max(280, cv.parentElement.clientWidth, +(cv.dataset.minw || 0));
  const Lp = Math.min(250, Wp * 0.31), Rp = Math.min(190, Wp * 0.2), maxP = Math.max(...S.map((s) => s.perturbations));
  const unit = (Wp - Lp - Rp) / maxP;   // one unit on both axes: area = pairs that could be measured
  const need = T + S.reduce((a, s) => a + Math.max(s.contexts * unit, 14) + gap, 0) + 8;
  cv.dataset.aspect = String(need / Wp);
  const { ctx, W } = setup(cv);
  const L = Lp, R = Rp;
  caps(ctx, 'width: perturbations · height: contexts · one scale for both, so area = pairs that could be measured', L, 14, { size: 8.5, clamp: W });
  let y = T;
  S.forEach((s, i) => {
    const w = Math.max(2, s.perturbations * unit), h = Math.max(2, s.contexts * unit), ink = INK[s.ink] || INK.ink;
    text(ctx, s.name, L - 14, y + Math.max(h, 14) / 2 + 2, { font: font.serif(14, true), align: 'right', color: ink });
    text(ctx, `${nf(s.contexts)} ${s.context_word} × ${nf(s.perturbations)} ${s.pert_word}`, L - 14, y + Math.max(h, 14) / 2 + 17,
      { font: font.serif(10.5, true), align: 'right', color: INK['ink-3'] });
    ctx.fillStyle = rgba(ink, 0.28); ctx.fillRect(L, y, w, h);
    ctx.strokeStyle = rgba(ink, 0.8); ctx.lineWidth = 0.8; ctx.strokeRect(L, y, w, h);
    const note = s.pearson_delta == null ? 'not yet tested' : `reported Pearson Δ ${f2(s.pearson_delta)}`;
    text(ctx, note, L + w + 12, y + Math.max(h, 14) / 2 + 4, { font: font.serif(12, s.pearson_delta == null), color: s.pearson_delta == null ? INK['ink-3'] : INK.ink, clamp: W });
    y += Math.max(h, 14) + gap;
  });
}

/* ---------------- the written matter ---------------- */
function writeText() {
  const M = RH.meta, P = M.paper, rep = M.reported.rows, byLab = (l, m) => rep.find((r) => r.label === l && r.mode.startsWith(m)).values.pearson_delta;
  $('mByline').textContent = `a first reading · ${P.org} · ${P.posted}`;
  $('status').innerHTML = `<b>The beginning of an analysis.</b> Nothing on this page has been reproduced yet. Every number is the ` +
    `authors' own, as reported with their released code (<a href="${M.code.repo}" target="_blank" rel="noopener">tahoebio/Rhaister</a>, ` +
    `commit ${M.code.commit.slice(0, 7)}). ${P.reading}`;
  $('intro').innerHTML =
    `<p class="lead">Every new cell type, cell line or condition multiplies the cost of a perturbation screen. Rhaister, from ` +
    `${P.org}, proposes a shortcut: in the new context, measure only a small panel of perturbations. Predict every other one as a ` +
    `weighted sum of the panel's responses, using weights learned in other contexts where everything was measured.</p>` +
    `<ul class="terms">` +
    `<li><b>Context.</b> Where a perturbation is tested: a cell line, a donor's cell type — or, for us, a cell type in a zebrafish embryo.</li>` +
    `<li><b>Response.</b> What the perturbation does to every gene, compared with untreated controls, as a screen already summarises it: ` +
    `fold change, p-value and the change in expression.</li>` +
    `<li><b>Panel.</b> The few perturbations actually measured in the new context.</li>` +
    `<li><b>Reference contexts.</b> Contexts where the panel and the perturbations to be predicted were all measured. The weights are learned there.</li>` +
    `</ul>` +
    `<p>The authors report that this simple, linear rule matches or beats a far larger "virtual cell" model on their benchmarks. On ` +
    `Tahoe-100M its predicted expression changes correlate with the real ones at ${f2(byLab('Tahoe-100M', 'few'))} — and at only ` +
    `${f2(byLab('Replogle–Nadig', 'few'))} on the Replogle–Nadig CRISPRi screens we just reproduced for ` +
    `<a href="/compass">COMPASS</a>.</p>` +
    `<p>For us the question is practical: could the next zebrafish screen measure a small panel in each new condition and predict the ` +
    `rest? This page sets out the idea and the plan. It is the first step of that analysis, not its result.</p>`;
  $('cap1').innerHTML =
    `<p><b>How to read it.</b> Each small tile is one perturbation's response in one context; its bars are the changes in a handful of genes. ` +
    `<b>Left:</b> five reference contexts were measured on everything; the new context was measured only on its panel (A–D). ` +
    `<b>Middle:</b> in the reference contexts, the response to p* (ochre) is found to equal a fixed mix of A–D: +0.60 A, +0.35 B, −0.40 C, ` +
    `+0.15 D. <b>Right:</b> the same mix of the new context's own A–D gives its predicted p* (red).</p>` +
    `<p>That is the whole of the core model: one weight per panel perturbation, shared by every gene, found by ridge regression across the ` +
    `reference contexts. Around it the authors add an additive baseline — an average context effect plus an average perturbation effect ` +
    `— that fills gaps and serves as a fallback, and a small network that calibrates the p-values. <i>The tiles are a made-up example ` +
    `built so that the mix is exact; in real data it is only approximate, and how approximate is what the reproduction will measure.</i></p>`;
  const sens = M.reported.sensitivity;
  $('cap2').innerHTML =
    `<p><b>How to read it.</b> Each ring is a number the authors report, averaged over their test splits; 1 is perfect. <i>Pearson Δ</i> asks ` +
    `whether the predicted change in expression has the right shape across genes. <i>PR-AUC</i> asks whether it picks out the genes that ` +
    `really changed. <i>Spearman LFC</i> asks whether it orders their fold changes correctly. <i>DE overlap</i> asks whether its top genes are ` +
    `the real top genes. Our own numbers will be drawn beside these rings once the reproduction runs.</p>` +
    `<p><b>What stands out.</b> Tahoe is far easier than the CRISPRi screens (Pearson Δ ${f2(byLab('Tahoe-100M', 'few'))} against ` +
    `${f2(byLab('Replogle–Nadig', 'few'))}; PR-AUC ${f2(rep[0].values.pr_auc)} against ${f2(rep[2].values.pr_auc)}). The zero-shot variant, ` +
    `Rhaister-O, predicts from a new cell line's untreated expression alone and still reaches ${f2(byLab('Tahoe-100M', 'zero'))}. For growth ` +
    `rather than expression, the authors report R² ${f2(sens.emerald_bay_r2)} on Emerald Bay (${f2(sens.emerald_bay_r2_features)} with ` +
    `transcriptomic features) and ${f2(sens.prism_r2)} on PRISM. They also report matching or beating the STATE virtual-cell model, and ` +
    `approaching the ceiling set by how well half of the data predicts the other half; those comparison numbers are in the paper, which ` +
    `we have not yet been able to retrieve.</p>`;
  $('cap3').innerHTML =
    `<p><b>How to read it.</b> Each block is one screen, drawn to one scale: its width is the number of perturbations, its height the ` +
    `number of contexts, so its area is the number of (context, perturbation) pairs that could be measured. MegaFin's contexts are the ` +
    `40 cell-type clusters we measured it in for COMPASS.</p>` +
    `<p><b>Why the shape matters.</b> Rhaister learns its weights across reference contexts, so it needs many contexts that share a panel. ` +
    `Replogle–Nadig is a thin sliver: 2,023 knockdowns but four cell lines, so each split learns from just three references. Tahoe has ` +
    `fifty. MegaFin sits between them, with forty cell types, and it has one more thing in common with Tahoe: its contexts share every ` +
    `well. <b>A hypothesis to test, not a finding:</b> our COMPASS work showed that in Tahoe a difference between two no-drug wells ` +
    `looks just like a drug effect shared across cell lines. A linear combination of other drugs' responses will reproduce any structure ` +
    `shared across contexts, biological or technical — so part of Tahoe's advantage may be the wells.</p>`;
  $('plan').innerHTML = `<h3>What we will do, in order</h3><ol class="lessons">` +
    M.plan.map((s) => `<li><b>${s.title}${/[?.!]$/.test(s.title) ? '' : '.'}</b> ${s.what} <span class="small"><i>Data: ${s.data}.</i></span></li>`).join('') +
    `</ol><p class="small"><i>Stopped here on purpose:</i> nothing has been downloaded or run beyond reading the paper's metadata, ` +
    `the code and the dataset cards. The first step needs about 1 GB and minutes of computing.</p>`;
  const ds = M.datasets.map((d) => `${d.name} (${d.license}, revision ${d.rev})`).join('; ');
  $('noteList').innerHTML = [
    `<b>Reported, not reproduced.</b> Every number on this page is the authors' mean over their splits, from the README and ` +
    `reproduction guide in their repository. We have run nothing yet.`,
    `<b>The paper itself.</b> ${P.reading} Items that need the paper — the STATE and half-sample comparison numbers, per-split ` +
    `values, supplementary tables — are marked as such in our notes.`,
    `<b>Per-gene or shared weights?</b> The methods file writes the combination weights with one set per gene; the released code uses ` +
    `one weight per (panel, target) pair shared by all genes, which is what Plate I draws. The code produced the reported numbers.`,
    `<b>MegaFin's shape</b> uses our 40 Leiden clusters as contexts and its 182 designed drug-doses; it has not been run through Rhaister.`,
    `<b>Plate I is a sketch.</b> Its responses are invented and constructed so that the combination is exact.`,
  ].map((s) => `<li>${s}</li>`).join('');
  $('colophon').innerHTML = `Paper: ${P.authors}, ${P.org}. <i>${P.title}.</i> bioRxiv ${P.posted}, ` +
    `<a href="https://doi.org/${P.doi}" target="_blank" rel="noopener">doi:${P.doi}</a> (${P.license}). Code: ` +
    `<a href="${M.code.repo}" target="_blank" rel="noopener">tahoebio/Rhaister</a> at ${M.code.commit} (${M.code.license}). Data cards: ${ds}. ` +
    `Our notes, sources and exact commands: <code>/data/scratch/rhaister_repro/RHAISTER_NOTES.md</code>. Built ${M.built}. ` +
    `The pen wobble on frames and rules is decoration.`;
}

function redraw() { drawIdea($('cvIdea')); drawReported($('cvReported')); drawShapes($('cvShapes')); }
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redraw, 150); });

(async function boot() {
  try {
    readInks();
    await load();
    $('boot').hidden = true; $('stage').hidden = false;
    writeText(); redraw();
  } catch (err) {
    $('boot').hidden = true;
    const f = $('fail'); f.hidden = false; f.textContent = 'The plates could not be drawn: ' + err.message;
    console.error(err);
  }
})();
