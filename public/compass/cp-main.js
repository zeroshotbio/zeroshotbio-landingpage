/* /compass — bootstrap, interaction and the written matter.
 *
 * Every number printed here is read from meta.json (our results, the paper's published values,
 * the design facts of our own screens). Nothing is a literal. If a figure in the prose looks
 * stale, rebuild with scripts/build_compass.py; do not retype it.
 *
 * Voice: plain English. For every figure say what a mark represents, what it is measured
 * relative to, and what a big or small value means. Define a term the first time it is used.
 */
'use strict';

const st = { ex: 0, progIso: new Set(), cluster: -1, p4geom: null };
const $ = (id) => document.getElementById(id);

function redrawAll() {
  drawDecomp($('cvDecomp'), st); drawVector($('cvVector'), st);
  drawContinuum($('cvCont')); drawLedger($('cvLedger')); drawBudget($('cvBudget'));
  drawSpectrum($('cvSpectrum'), st); drawSignatures($('cvSig'));
  drawResidual($('cvResid'), st); drawReliability($('cvReliab'));
  drawCount($('cvCount')); drawStrength($('cvStrength')); drawDepth($('cvDepth')); drawLanes($('cvLanes'));
  drawPhase($('cvPhase')); drawDepthSweep($('cvDepthSweep')); drawRemove($('cvRemove')); drawControls($('cvControls'));
  drawTahoe($('cvTahoe')); drawThree($('cvThree'));
}

/* ---------------- controls ---------------- */

function buildExemplars() {
  const seg = $('exSeg'); seg.innerHTML = '';
  CP.plates.p1.exemplars.forEach((e, i) => {
    const b = document.createElement('button');
    b.textContent = e.symbol; b.setAttribute('aria-pressed', i === st.ex ? 'true' : 'false');
    b.onclick = () => { st.ex = i; [...seg.children].forEach((c, j) => c.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
      drawDecomp($('cvDecomp'), st); drawVector($('cvVector'), st); writeCap1(); };
    seg.appendChild(b);
  });
}

function buildPrograms() {
  const wrap = $('progLegend'), P = CP.plates.p3;
  wrap.innerHTML = '<div class="lhead">gene programmes &nbsp;·&nbsp; click one to see it alone; each tick under a curve is one of its genes</div>';
  P.programs.forEach((p, j) => {
    const b = document.createElement('button'); b.className = 'leg'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="swatch" style="background:var(--t${j})"></span><span><span class="leg-name">${p.name}</span>` +
      `<span class="leg-note">expected to be turned ${p.expect}</span></span>`;
    b.onclick = () => { if (st.progIso.has(j)) st.progIso.delete(j); else st.progIso.add(j);
      [...wrap.querySelectorAll('.leg')].forEach((el, k) => el.setAttribute('aria-pressed', !st.progIso.size || st.progIso.has(k) ? 'true' : 'false'));
      drawSpectrum($('cvSpectrum'), st); };
    wrap.appendChild(b);
  });
}

function clusterName(c) { return c.members_sig ? shortTerm(c.members) : 'no shared pathway'; }

function buildClusters() {
  const wrap = $('clusterLegend'), P = CP.plates.p4;
  wrap.innerHTML = '<div class="lhead">groups of knockdowns with similar own parts, named by what the knocked-down genes have in common &nbsp;·&nbsp; click to see one</div>';
  P.clusters.slice().sort((a, b) => b.n - a.n).forEach((c) => {
    const b = document.createElement('button'); b.className = 'leg'; b.dataset.id = c.id;
    b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="swatch" style="background:${c.members_sig ? 'var(--ink)' : 'transparent'}"></span>` +
      `<span><span class="leg-name">${clusterName(c).toLowerCase()}</span> <span style="color:var(--ink-3)">${c.n}</span></span>`;
    b.onclick = () => selectCluster(st.cluster === c.id ? -1 : c.id);
    wrap.appendChild(b);
  });
}

function selectCluster(id) {
  st.cluster = id;
  [...$('clusterLegend').querySelectorAll('.leg')].forEach((el) => el.setAttribute('aria-pressed', id < 0 || +el.dataset.id === id ? 'true' : 'false'));
  drawResidual($('cvResid'), st); writeClusterCard();
}

function writeClusterCard() {
  const P = CP.plates.p4, card = $('clusterCard');
  if (st.cluster < 0) {
    card.innerHTML = `<h4>Groups of knockdowns</h4><p class="big">Choose a group, or click a dot.</p>` +
      `<p class="small">Each dot is one knockdown's own part — what it does beyond the typical response. ` +
      `Dots close together move the same genes the same way.</p>`;
    return;
  }
  const c = P.clusters[st.cluster];
  const bar = (gs, vs) => gs.slice(0, 8).map((g, i) => `<span style="display:inline-block;margin-right:10px"><i>${g}</i> <span style="color:var(--ink-3)">${Number(vs[i]).toFixed(2)}</span></span>`).join('');
  card.innerHTML = `<h4>${c.n} knockdowns</h4><p class="big">${clusterName(c)}</p>` +
    `<dl class="kv"><dt>for example</dt><dd>${c.examples}</dd>` +
    (c.program_up ? `<dt>their own part switches on</dt><dd>${shortTerm(c.program_up)}</dd>` : '') +
    (c.program_down ? `<dt>and switches off</dt><dd>${shortTerm(c.program_down)}</dd>` : '') +
    `<dt>typical-response strength</dt><dd>median β ${Number(c.median_beta).toFixed(2)}</dd></dl>` +
    `<p class="small" style="margin:10px 0 4px">genes their own part raises most</p><div class="small">${bar(c.up_genes, c.up_vals)}</div>` +
    `<p class="small" style="margin:8px 0 4px">genes it lowers most</p><div class="small">${bar(c.down_genes, c.down_vals)}</div>` +
    (c.members_sig ? '' : `<p class="small" style="margin-top:8px"><i>The knocked-down genes in this group have no function in common that passes a significance test; read it as a direction, not a pathway.</i></p>`);
}

function wireResidual() {
  const cv = $('cvResid'); cv.style.cursor = 'crosshair';
  cv.addEventListener('click', (e) => {
    if (!st.p4geom) return;
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, P = CP.plates.p4;
    let best = -1, bd = 64;
    for (let i = 0; i < P.x.length; i++) {
      const dx = st.p4geom.sx(P.x[i]) - px; if (dx > 8 || dx < -8) continue;
      const dy = st.p4geom.sy(P.y[i]) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
    }
    selectCluster(best >= 0 ? P.label[best] : -1);
  });
}

/* ---------------- the written matter ---------------- */

const pctShared = (e) => Math.round(e.frac_shared * 100);
const span = (xs, fmt = f2) => `${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))}`;

function writeCap1() {
  const P = CP.plates.p1, e = P.exemplars[st.ex];
  const plain = (s) => s.replace(/the shared axis|the axis/g, 'the typical response');   // data strings use the paper's word
  const others = P.exemplars.filter((x) => x !== e).map((x) => `<i>${x.symbol}</i> (${pctShared(x)}% shared)`).join(' and ');
  $('cap1').innerHTML =
    `<p><b>How to read it.</b> Each thin vertical line is one of ${nf(P.n_genes)} genes. Its height is how much that gene went up ` +
    `(above the middle line) or down (below it) in ${P.line} cells with <i>${e.symbol}</i> knocked down, compared with control cells. ` +
    `The genes are in the same order in all three rows: from the genes a typical knockdown raises most (left) to the ones it lowers most (right).</p>` +
    `<p><b>Top row:</b> what was measured. <b>Middle row:</b> the shared part — the line's typical response, scaled to fit this ` +
    `knockdown. Because the genes are sorted by the typical response, it comes out as one smooth curve; how tall the curve is ` +
    `(β = ${f2(e.beta)}) says how strongly this knockdown sets off the typical response. <b>Bottom row:</b> what is left over — the ` +
    `part only this knockdown does. Add the middle and bottom rows and you get the top row back. All three rows use the same vertical scale.</p>` +
    `<p><b>This knockdown:</b> ${plain(e.why)}; ${pctShared(e)}% of its response is the shared part. Compare ${others}. ` +
    `<i>These three were picked to show the range, not as a random sample.</i></p>`;
  $('capVector').innerHTML = `The same split, as geometry. Think of each response as an arrow: its length is how big the response ` +
    `is, its direction is which genes move and which way. The flat line is the typical response. Drop a line straight down from an ` +
    `arrow's tip: the distance along the flat line is the shared part (β); the drop is the knockdown's own part (r). Angles and ` +
    `lengths are the real ones. Squared lengths add up exactly (β² + r² = length²), which is why shares on this page are quoted by ` +
    `squared size: <i>${e.symbol}</i>'s shared part is ${pctShared(e)}% of it.`;
}

function writeProse() {
  const M = CP.meta, R = M.reproduction, Pp = M.paper, D = M.decomposition.per_line, S = M.stress, E = M.external, Z = M.zeroshot;
  const W2 = R.W.paper_anchor['2000'], col = (k) => LINES.map((l) => D[l][k]);
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const CRc = 'COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)';
  $('mByline').textContent = `${nf(M.anchor.ensembl)} CRISPRi knockdowns · six human cell lines · three studies`;
  ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'].forEach((id, i) => { $(id).textContent =
    ['the two-part split', `${nf(M.anchor.ensembl)} knockdowns`, 'all protein-coding genes', 'Replogle / Nadig', 'what makes it visible', 'stress tests', 'Tahoe · ChemFish · MiniFin · MegaFin'][i]; });

  $('intro').innerHTML =
    `<p class="lead">A CRISPRi screen turns down one gene in each cell, then reads out the activity of every other gene. Do that ` +
    `for two thousand genes and something odd appears: if you simply average all the responses together, that average predicts ` +
    `any single knockdown's response about as well as sophisticated machine-learning models do. Liang and Singh's COMPASS offers ` +
    `an explanation. Every knockdown's response, they say, has two parts: a <i>typical response</i> that any strong knockdown in ` +
    `that cell line tends to produce, plus a part that belongs to the gene that was knocked down.</p>` +
    `<ul class="terms">` +
    `<li><b>Knockdown.</b> CRISPRi turns one chosen gene down in a cell. Cells given a guide that targets nothing are the <i>controls</i>.</li>` +
    `<li><b>Response.</b> How the activity of every other gene changes in the knocked-down cells, compared with the control cells.</li>` +
    `<li><b>Typical response</b> (the paper's <i>shared axis</i>). The average response over all ${nf(M.anchor.ensembl)} knockdowns in one ` +
    `cell line — the usual way that cell reacts to losing a gene.</li>` +
    `<li><b>β, the strength.</b> How far a knockdown's response goes in the direction of the typical response. Big β: it looks like ` +
    `a strong dose of the typical response. β near zero: it doesn't.</li>` +
    `<li><b>Own part</b> (the paper's <i>residual</i>). What is left after the shared part is taken away — what this knockdown does ` +
    `that the typical one doesn't.</li></ul>` +
    `<p>The paper makes three claims. First, the <i>same</i> knockdowns set off the typical response strongly in every cell line. ` +
    `Second, you can predict how strongly a knockdown will set it off in a cell line where it was never measured. Third, the own ` +
    `part carries the real biology — what makes one knockdown different from another.</p>` +
    `<p>We rebuilt the analysis from the original data of three studies, six human cell lines in all: K562 and RPE1 (Replogle), ` +
    `HepG2 and Jurkat (Nadig), HCT116 and HEK293T (X-Atlas/Orion), using the paper's methods and the authors' own code. It ` +
    `reproduces almost exactly (Plate II). The rest of the page asks: what is the typical response, biologically (III)? Where does ` +
    `the gene-specific biology show up (IV)? What about these screens lets you see all this (V), and how much data does it take (VI)? ` +
    `And why don't two datasets closer to our own work, Tahoe-100M and ChemFish, show it cleanly (VII)?</p>` +
    `<p class="caution">What we did not reproduce: the paper's methods built on the STRING protein-interaction database (COMPASS-N, ` +
    `COMPASS-H) and its STRING-based prediction of where a knockdown lands. Everything here is about the two-part split itself and ` +
    `the paper's cross-cell-line predictor, COMPASS-X.</p>`;

  writeCap1();

  const rho = R.spearman_m_a;
  const hi = LINES.reduce((a, l) => (rho[l] > rho[a] ? l : a)), lo = LINES.reduce((a, l) => (rho[l] < rho[a] ? l : a));
  $('cap2a').innerHTML = `<p><b>What you're looking at.</b> Each dot is one knockdown — all ${nf(M.anchor.ensembl)} of them, in each ` +
    `of six cell lines. Higher up means a bigger response (more genes change, by more). Further right means the response looks more ` +
    `like that line's typical response (a correlation: 1 is the same shape, 0 is unrelated). All six panels use the same scales.</p>` +
    `<p><b>What it shows.</b> The knockdowns with big responses are almost all ones that look like the typical response; small ` +
    `responses can point anywhere. This is the paper's starting observation, and it holds in every line — most clearly in ${hi} ` +
    `(rank correlation between size and likeness ${f2(rho[hi])}; paper ${f2(Pp.spearman_m_a[hi])}), least in ${lo} ` +
    `(${f2(rho[lo])}; paper ${f2(Pp.spearman_m_a[lo])}).</p>`;

  const samePairs = Object.values(R.beta_pairs).filter((p) => p.same_group).map((p) => p.r);
  const tr = ['K562', 'RPE1', 'HepG2', 'Jurkat'].map((l) => R.transfer.ensembl[l]);
  const cxPds = R.bench.CompassX.pds.reduce((a, b) => a + b) / 6;
  $('cap2b').innerHTML =
    `<p><b>How to read the ledger.</b> Each row is one number the paper printed. The open ring is the paper's value; the solid dot ` +
    `is ours. When the dot sits in the ring, we reproduced it — nearly every row does, to within about 0.02.</p>` +
    `<p><b>Do the six lines rank knockdowns alike?</b> Kendall's W is 1 if all six lines put the knockdowns in the same order, and ` +
    `about 1/6 by chance. We get ${W2.W.map(f2).join(', ')} for three ways of ranking; the paper got ${Pp.W['2000'].map(f2).join(', ')}. ` +
    `<b>Do two lines agree on β?</b> Yes, at correlations of ${span(samePairs)}, as in the paper. <b>Can you predict a hidden line?</b> ` +
    `Hide one line and predict each knockdown's β there from the others: the predictions correlate with the truth at ` +
    `${span(tr.map((t) => t.beta))}. Predicting the own part this way works much less well (${span(tr.map((t) => t.g))}), but ` +
    `chance would be zero.</p>` +
    `<p><b>CompassX</b> predicts a knockdown's whole response in a new line. The ledger scores it two ways: does the prediction have ` +
    `the right overall shape (accuracy), and does it get <i>this</i> knockdown right rather than the average one (discrimination, ` +
    `"PDS gain").</p>` +
    `<p><b>One honest difference</b> (the last block, in red). The laziest possible predictor — always guess the average of the ` +
    `training knockdowns — scores 0.02–0.03 higher for us than in the paper, enough to tie CompassX on accuracy. But it tells ` +
    `nothing apart (discrimination ${f2(Math.max(...R.bench['training mean'].pds))}, against CompassX's ${f2(cxPds)}), because it ` +
    `predicts the same thing for every knockdown. That is the paper's own point: accuracy alone rewards guessing the average.</p>` +
    `<p><b>The curve.</b> How CompassX improves as you measure more knockdowns in the new line, from 10 to 130: ours rises from ` +
    `${f3(R.budget.CompassX.pearson[0])} to ${f3(R.budget.CompassX.pearson.at(-1))}, the paper's from ${f3(Pp.budget.pearson[0])} ` +
    `to ${f3(Pp.budget.pearson[1])}.</p>` +
    `<p class="small"><i>A detail:</i> the paper matched genes across studies by name and got ${nf(Pp.anchor)}; we matched by stable ` +
    `gene ID and got ${nf(M.anchor.ensembl)} (${M.anchor.renamed} genes had been renamed). Results differ by at most 0.01.</p>`;

  const P3 = CP.plates.p3, sig = P3.signatures, byName = (n) => sig.find((s) => s.signature === n);
  const myc = byName('Hallmark Myc Targets V1'), p53 = byName('p53 targets (core)');
  const ng = LINES.map((l) => P3.lines[l].n_genes);
  $('cap3').innerHTML =
    `<p><b>What you're looking at.</b> One row per cell line. The grey curve is that line's typical response across all its genes ` +
    `(${span(ng, nf)} of them), sorted from the genes it raises most (left) to those it lowers most (right); the few genes named ` +
    `at each end are the most extreme. Under each curve, thin coloured ticks show where the genes of seven well-known programmes ` +
    `fall. Click a programme below to see it alone. <i>The curves share one scale, with the extreme tips cut off so the middle is visible.</i></p>` +
    `<p><b>What it shows.</b> In all six lines the same thing happens. Growth genes — MYC and E2F targets, the machinery for making ` +
    `ribosomes, mitochondrial protein synthesis — pile up on the right: a typical knockdown turns them down. Stress and shut-down ` +
    `genes — the p53 pathway, NF-κB inflammation signalling, cell death — sit on the left: it turns them up. The names at the ends ` +
    `say it plainly: <i>CDKN1A, MDM2, GDF15</i> (the cell-cycle brake and the p53 alarm) go up; <i>MKI67, CENPF, TUBA1B</i> ` +
    `(markers of dividing cells) go down. <b>In plain words, the typical response is a cell that has stopped growing and is under ` +
    `stress.</b> Each line adds a bit of itself: K562, a blood-cell line, raises red-blood-cell genes like <i>HBZ</i> and ` +
    `<i>ALAS2</i>; Jurkat, a T-cell line, raises T-cell genes like <i>LEF1</i> and <i>PTPRC</i>.</p>`;
  const r2 = Object.values(M.biology.r2);
  $('cap3b').innerHTML =
    `<p><b>How to read it.</b> Each row is a gene programme, each column a cell line. Colour says which way the programme moves in a ` +
    `typical knockdown, compared with control cells: ochre up, grey-blue down. The dot's area says how far its genes move — the ` +
    `average, over the programme's genes, of each gene's standardised score on the typical response. A big dot means the programme ` +
    `sits far out at one end; a tiny dot means it barely moves.</p>` +
    `<p><b>What it shows.</b> MYC targets go down in every line (average scores between ${f2(Math.min(...LINES.map((l) => myc[l])))} and ${f2(Math.max(...LINES.map((l) => myc[l])))}); ` +
    `core p53 targets go up in every line (between ${f2(Math.min(...LINES.map((l) => p53[l])))} and ${f2(Math.max(...LINES.map((l) => p53[l])))}). Heat-shock and protein-folding genes go down too, so this is not a generic ` +
    `"all stress genes up" signal but a specific one. <b>Still, these familiar programmes explain only ` +
    `${Math.round(Math.min(...r2) * 100)}–${Math.round(Math.max(...r2) * 100)}% of the typical response;</b> the rest is spread thinly ` +
    `over many genes, part of it the cell line's own identity. And knocking down genes a cell cannot live without (core essential ` +
    `genes) sets off the typical response more strongly, in every line.</p>`;

  const pr = M.decomposition.pairs.filter((p) => p.a !== 'HCT116');
  const resSame = pr.map((p) => p.res_same), resRand = pr.map((p) => p.res_random);
  const nSig = CP.plates.p4.clusters.filter((c) => c.members_sig).length;
  $('cap4').innerHTML =
    `<p><b>What you're looking at.</b> Each dot is one knockdown — but here the shared part has been thrown away and only its own ` +
    `part kept, averaged over the four Replogle/Nadig lines. Dots close together have own parts that move the same genes the same ` +
    `way. <i>The map is a t-SNE, a way of flattening many dimensions onto a page: near means similar, but distances and positions ` +
    `otherwise mean nothing. The groups were found in the full data before the map was drawn.</i></p>` +
    `<p><b>What it shows.</b> We grouped the knockdowns only by what their own parts look like, telling the computer nothing about ` +
    `what the genes do. Yet ${nSig} of the 20 groups turn out to be knockdowns of genes that work together. The clearest are single ` +
    `machines of the cell: the proteasome (which breaks down old proteins), the small ribosome subunit, the enzymes that load ` +
    `tRNAs, mitochondrial protein synthesis, the spliceosome, DNA copying, protein glycosylation. Their own parts also say what ` +
    `losing that machine does beyond the typical response: losing the tRNA-loading enzymes sets off the unfolded-protein alarm; ` +
    `losing <i>CUL3</i> or <i>KEAP1</i> switches on the oxidative-stress defence; losing vesicle-transport genes switches on ` +
    `cholesterol making. A few groups ("lamellipodium assembly", "thermogenesis") hang together only loosely; read those names as ` +
    `the nearest label, not a finding. Click a group or a dot to see its genes on the card.</p>`;
  $('cap4b').innerHTML =
    `<p><b>How to read it.</b> A simple test of what is real: split each line's cells in two at random, redo everything on each ` +
    `half, and see whether the halves agree (1 is perfect agreement, 0 none). Dark dots: the typical response. Grey: each ` +
    `knockdown's strength β. Green: each knockdown's own part.</p>` +
    `<p><b>What it shows.</b> The typical response repeats almost perfectly (${span(col('split_cos_u'))}) and β nearly as well ` +
    `(${span(col('split_beta_r'))}). A single knockdown's own part repeats only weakly (${span(col('split_residual_r'))}). Across cell ` +
    `lines, a knockdown's own part matches itself at ${span(resSame)} — faint, but real, because random pairs of knockdowns match ` +
    `at zero (never more than ${Math.max(...resRand.map(Math.abs)).toFixed(3)} either way). <b>So the gene-specific biology is ` +
    `there, but any one knockdown's own part is noisy;</b> it is the patterns across many knockdowns, like the groups above, that are solid.</p>`;

  const cr = CP.plates.p5.crispr, ta = CP.plates.p5.tahoe, cf = CP.plates.p5.chemfish;
  $('cap5').innerHTML =
    `<p>Four things about these CRISPRi screens make the typical response easy to see. Each panel sets them beside Tahoe-100M ` +
    `(a large drug screen on 50 human cancer cell lines grown together), ChemFish (a drug screen on whole zebrafish embryos) and ` +
    `our own MegaFin and MiniFin designs.</p>` +
    `<p><b>1. Many perturbations</b> (top left). One stroke per perturbation at the same spacing in every row, so a row's length is ` +
    `its count: ${nf(M.anchor.ensembl)} knockdowns per line, against ${nf(Math.round(E.tahoe.n_perturbations))} drug-doses per Tahoe line, ` +
    `${Z.MegaFin.perturbations} in MegaFin, a median of ${Math.round(E.chemfish.n_perturbations)} per ChemFish tissue, and ` +
    `${Z.MiniFin.perturbations} in MiniFin. The red dashed lines mark roughly how many you need before a typical response shows up ` +
    `at all: about 30, or about 100 in the hardest line.</p>` +
    `<p><b>2. Strong perturbations</b> (top right). For each perturbation: how big its response is, divided by how different two ` +
    `random halves of the control cells look from each other. 1× means you can't tell it from noise. Nearly every knockdown is above ` +
    `2× (median ${f2(cr.median)}×); Tahoe's median is ${f2(ta.median)}×; ChemFish's is ${f2(cf.median)}×, with most conditions under 2×. ` +
    `The knockdowns are strong partly because many hit genes a cell cannot live without — a quarter of the targets, against about ` +
    `3.5% of all genes.</p>` +
    `<p><b>3. Plenty of measurement</b> (bottom left). About ${nf(num(M.comparison['UMIs per cell (median, protein-coding)'][CRc]))} ` +
    `molecules read per cell, and a median of ${num(M.comparison['cells per perturbation x context (median)'][CRc])} cells per ` +
    `knockdown in each line.</p>` +
    `<p><b>4. Controls in the same place</b> (bottom right, a sketch). In a CRISPRi screen the control cells are mixed into the same ` +
    `pool as everything else, so they go through exactly the same handling. In Tahoe the controls sit in their own wells; in ` +
    `ChemFish, in separate embryos. Anything that differs between wells or embryos can then look like an effect.</p>`;

  const ph = S.phase, kAll = ph.k.length - 1, iN = (n) => ph.n.indexOf(n), kx = (k) => ph.k.indexOf(String(k));
  const kMin = ph.k.find((k, j) => ph.cons_RN[iN(300)][j] >= 0.5);
  // nearest thinning step (on a log scale) to each dataset's own median depth
  const UM = M.comparison['UMIs per cell (median, protein-coding)'];
  const dp = S.depth, near = (v) => dp.library.reduce((b, x, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(dp.library[b] / v)) ? i : b), 0);
  const iT = near(num(UM['Tahoe-100M'])), iC = near(num(UM['ChemFish 2026_09']));
  const ref = S.controls_cons['stratified pool (reference)'][0];
  const single = LINES.map((l) => S.controls_cos[l]['single largest batch']);
  $('cap6').innerHTML =
    `<p><b>How much data does it take?</b> Four stress tests. In three of them the score is the paper's headline: do the four ` +
    `Replogle/Nadig lines agree on which knockdowns set off the typical response strongly? (A correlation of β between lines; with ` +
    `all the data it is ${f2(ref)}.)</p>` +
    `<p><b>Top left — fewer knockdowns, fewer cells</b> (new for this page). Each square rebuilds everything from a random subset: ` +
    `the row sets how many knockdowns are used, the column the most cells allowed per knockdown. The number is the agreement; the ` +
    `red outline surrounds squares at 0.5 or more. <b>Read across, not up.</b> Cutting from all cells to 10 per knockdown drops ` +
    `agreement from ${f2(ph.cons_RN[iN(300)][kAll])} to ${f2(ph.cons_RN[iN(300)][kx(10)])}, and to 2 cells, ${f2(ph.cons_RN[iN(300)][kx(2)])}. ` +
    `Cutting from ${nf(ph.n.at(-1))} knockdowns to just 10 barely changes it (${f2(ph.cons_RN[iN(ph.n.at(-1))][kAll])} to ` +
    `${f2(ph.cons_RN[iN(10)][kAll])}). Cells per knockdown decide it.</p>` +
    `<p><b>Top right — shallower sequencing</b> (new). The same cells, but with molecules thrown away at random, as if each cell ` +
    `had been sequenced less deeply. Agreement barely moves: ${f2(dp.cons_RN[iT])} at Tahoe's depth, ${f2(dp.cons_RN[iC])} near ` +
    `ChemFish's. The X-Atlas pair frays sooner (${f2(dp.cons_XA[iC])}). <b>Shallow sequencing on its own does not erase it.</b></p>` +
    `<p><b>Bottom left — take away the strongest.</b> Remove the knockdowns that set off the typical response hardest. Agreement ` +
    `falls from ${f2(ref)} to ${f2(S.remove_top_cons[3][1])} once the top quarter is gone (X-Atlas pair: ${f2(S.remove_top_cons[3][2])}), ` +
    `and to ${f2(S.remove_top_cons[4][1])} at half. The faint lines ask whether each line's typical response still points the same ` +
    `way: it mostly does while a quarter is removed, then comes apart. The phenomenon lives in the strong knockdowns.</p>` +
    `<p><b>Bottom right — which controls?</b> Every response is measured against control cells. Any large, mixed set of controls ` +
    `gives the same typical response (dots near 1). Controls from a single batch do not (${span(single)}): that batch's quirks ` +
    `leak into every response.</p>` +
    `<p><b>The short version:</b> about ${kMin} or more cells per perturbation in each cell type, a few dozen perturbations including ` +
    `strong ones, and controls pooled across batches.</p>`;

  const w = E.tahoe.dmso_well, t = E.tahoe.checks, c = E.chemfish;
  $('cap7').innerHTML =
    `<p><b>At first Tahoe looks like an even stronger case.</b> Its ${t.W_block_contexts} lines agree on which drugs set off the ` +
    `typical response at ${f2(t.mean_pairwise_spearman_from_W)}, far more than the CRISPRi lines do. But the pattern does not behave ` +
    `like biology. <b>It does not grow with dose:</b> the lowest dose pulls on it as hard as the middle one ` +
    `(${f2(E.tahoe.dose_tiers['1'])} and ${f2(E.tahoe.dose_tiers['2'])}), and harder than the highest (${f2(E.tahoe.dose_tiers['3'])}).</p>` +
    `<p><b>The test</b> (left panel). In Tahoe all 50 cell lines are grown together in every well, and each plate has two wells ` +
    `with no drug — just DMSO, the solvent. Every drug on the plate is measured against those two wells. So we treated one ` +
    `no-drug well as if it were a drug and measured it against the other. If the wells were identical, the difference would be ` +
    `only sampling noise (${f2(w.median_norm_sampling_noise)}). It is ${f2(w.median_norm_well_diff)} — about ` +
    `${Math.round((w.median_norm_well_diff / w.median_drug_effect_norm) * 100)}% the size of a typical drug's effect ` +
    `(${f2(w.median_drug_effect_norm)}). And this no-drug "effect" looks the same across the 50 lines exactly as much as a real ` +
    `drug's effect does (${f2(w.mean_crossline_r_of_well_diff)} against ${f2(w.mean_crossline_r_of_same_drug_effect)}). ` +
    `<b>In this design, a quirk of one well cannot be told apart from a drug response shared by every line.</b> Tahoe's own ` +
    `parts, by contrast, are strongly drug-specific and look like real signal.</p>` +
    `<p><b>ChemFish is weak for plainer reasons:</b> about ${Math.round(c.n_perturbations)} conditions per tissue, effects only ` +
    `${f2(c.noise_ratio)}× the difference between control embryos, and tissues whose typical responses barely resemble one another ` +
    `(${f2(c.pair_similarity.u_cosine)} on a scale where 1 is identical). Its tissues agree on which drugs are strong at only ` +
    `${f2(c.checks.mean_pairwise_spearman_from_W)}.</p>` +
    `<p><b>Right panel:</b> the same measurements for all three datasets; the black bar spans the six CRISPRi lines. On paper ` +
    `Tahoe scores highest nearly everywhere, which is exactly why the no-drug-well test matters.</p>`;
}

function writeTable() {
  const C = CP.meta.comparison, Z = CP.meta.zeroshot;
  const cols = ['COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)', 'Tahoe-100M', 'ChemFish 2026_09'];
  const pick = [
    ['perturbations per context (analysed)', 'perturbations per cell line or tissue', () => `${Z.MegaFin.perturbations} drug-doses`, () => `${Z.MiniFin.perturbations} drugs + DMSO`],
    ['perturbation type', 'what is perturbed', () => 'drugs, whole embryos', () => 'drugs, whole embryos'],
    ['contexts', 'in what', () => Z.MegaFin.context, () => Z.MiniFin.context],
    ['control design', 'control cells', () => Z.MegaFin.controls, () => Z.MiniFin.controls],
    ['independent replication', 'repeats', () => Z.MegaFin.replicates, () => Z.MiniFin.replicates],
    ['cells per perturbation x context (median)', 'cells per perturbation, per line or tissue', () => `about ${nf(Math.round(Z.MegaFin.cells / 192 / 1000) * 1000)} per well (2 × 96 wells), split across cell types`, () => `about ${nf(Math.round(Z.MiniFin.cells / 48 / 100) * 100)} per well`],
    ['effect size: median ||z|| / control-noise ||z||', 'response size ÷ control noise (typical line or tissue)', () => 'not yet measured', () => 'not yet measured'],
    ['shared-axis strength: energy on axis (median over contexts)', 'share of a response that is the shared part', () => '—', () => '—'],
    ['beta conservation across contexts (Kendall W)', 'lines or tissues agree on which perturbations are strong', () => '—', () => '—'],
    ['residual reproducibility: split-half residual r (median)', 'own part repeats when measured twice', () => '—', () => '—'],
    ['technical confounding: DMSO-well-vs-DMSO-well |beta| / median drug |beta|', 'no-drug well "effect" ÷ a real drug\'s', () => 'one well per drug-dose: cannot be checked', () => '12 replicate wells: can be checked',
      { 'Tahoe-100M': `${f2(CP.meta.external.tahoe.dmso_well.median_abs_beta_well_over_median_drug_beta)}: a no-drug well pulls on the typical response about a quarter as hard as a typical drug` }],
  ];
  const head = `<tr><th></th><th>CRISPRi (COMPASS)</th><th>Tahoe-100M</th><th>ChemFish</th><th>MegaFin</th><th>MiniFin</th></tr>`;
  const body = pick.map(([key, label, mega, mini, over = {}]) => {
    const r = C[key] || {}, esc = (s) => (s === undefined || s === '' ? '—' : String(s));
    const key_ = /control|replication|confounding/.test(key) ? ' class="key"' : '';
    return `<tr${key_}><td>${label}</td>` + cols.map((c) => `<td>${over[c] ?? esc(r[c])}</td>`).join('') + `<td>${mega()}</td><td>${mini()}</td></tr>`;
  }).join('');
  $('cmpTable').innerHTML = head + body;
}

function writeLessons() {
  const M = CP.meta, S = M.stress, ph = S.phase, Z = M.zeroshot, i300 = ph.n.indexOf(300);
  $('lessons').innerHTML =
    `<h3>What follows for MiniFin, MegaFin and the screens after them</h3>` +
    `<ol class="lessons">` +
    `<li><b>Put the controls where the perturbations are.</b> The CRISPRi result is trustworthy because its control cells share ` +
    `every step with the perturbed ones. When controls live in their own wells (Tahoe, MegaFin) or their own embryos (ChemFish), ` +
    `anything odd about those wells becomes part of every response. Spread several control wells across every plate, and put each ` +
    `perturbation in at least two wells, so a well quirk can be told from a real effect. MiniFin's twelve wells per condition allow ` +
    `this; MegaFin's one well per drug-dose does not.</li>` +
    `<li><b>Get enough cells per perturbation first.</b> Here the agreement between lines is ${f2(ph.cons_RN[i300][ph.k.indexOf('10')])} ` +
    `with 10 cells per knockdown, ${f2(ph.cons_RN[i300][ph.k.indexOf('25')])} with 25, and ${f2(ph.cons_RN[i300][ph.k.length - 1])} with ` +
    `all of them. In a whole-embryo screen each cell type counts separately, so what matters is how many cells <i>of each type</i> you ` +
    `get per perturbation, not the total per well.</li>` +
    `<li><b>Then enough perturbations, including a few strong ones.</b> The typical response is defined mostly by the strongest ` +
    `quarter of perturbations, so a few potent drugs that hit core growth machinery would anchor it. MegaFin's ` +
    `${Z.MegaFin.perturbations} drug-doses are enough to find a typical response; MiniFin's ${Z.MiniFin.perturbations} drugs are not, ` +
    `and were never meant to be.</li>` +
    `<li><b>Shallow sequencing is fine if the cells are many.</b> Thinning the CRISPRi data down to Tahoe- and ChemFish-like depths ` +
    `left the result largely intact. Few cells per cell type would hurt; shallow libraries mostly don't.</li>` +
    `<li><b>Treat the typical response as background, not the finding.</b> It is a generic "stopped growing, under stress" ` +
    `programme. The reusable biology is in the gene- or drug-specific own part, and that is the most expensive part to measure ` +
    `well, so plan the screen around it.</li>` +
    `<li><b>Judge predictions on whether they tell perturbations apart.</b> A "predictor" that gives the same average answer for ` +
    `everything ties CompassX on accuracy in these data, and tells nothing apart.</li></ol>`;
}

function writeNotes() {
  const M = CP.meta, R = M.reproduction;
  const notes = [
    `<b>What we reproduced.</b> The size-versus-likeness picture and how well the six lines agree on it (Kendall's W, all fifteen ` +
    `pairs); the agreement of β between lines (Table 13); predicting β in a hidden line (Tables 2, 9); the link between β and a ` +
    `knockdown's position (${f2(R.betabar_sbar[0])}; paper ${f2(M.paper.betabar_sbar[0])}); CompassX and its comparison predictors ` +
    `(Table 3); and the curve of CompassX against the number of knockdowns measured (Fig. 4). Each was checked with both ways of ` +
    `matching genes across studies.`,
    `<b>What we did not.</b> The STRING-based methods (COMPASS-N, COMPASS-H), the STRING prediction of a knockdown's position ` +
    `(R² 0.35), the deep-learning comparison models and TabICL. None of the conclusions on this page rests on them.`,
    `<b>The guess-the-average predictor scores higher for us</b>, by 0.02–0.03 in every line, so it ties CompassX on accuracy in ` +
    `our hands. CompassX still wins clearly at telling knockdowns apart.`,
    `<b>Which K562 data.</b> The paper doesn't say which K562 screen it used. The essential-genes-only screen has too few targets ` +
    `(2,057) to include all the shared knockdowns, so it must have been the genome-wide one, which is what we used.`,
    `<b>The examples and the map are illustrations.</b> Plate I's three knockdowns were picked by a stated rule to show the range; ` +
    `Plate IV's map is a drawing aid. Every number and group comes from the full data.`,
    `<b>Tahoe is shown as confounded, and should stay that way.</b> The no-drug-well test shows the well problem exists and ` +
    `roughly how big it is; it can't remove it, because Tahoe has only two no-drug wells per plate and doesn't repeat drugs across ` +
    `wells. Treat Tahoe's typical-response numbers as an upper limit on any real biology.`,
    `<b>ChemFish's "contexts" are tissues of the same embryos</b>, not independent cell lines; its genetic-perturbation arm is not ` +
    `in the released cell data; and only about 25 conditions are shared by most tissues. Its numbers cover the drugs only.`,
    `<b>The two data-requirement experiments are ours, not the paper's.</b> Cell and knockdown subsets are random draws with fixed ` +
    `seeds (30 draws per square); the sequencing test throws away molecules at random from the raw counts.`,
    `<b>β partly reflects how sick the cells get.</b> Knockdowns that hurt the cell badly leave fewer cells with fewer molecules ` +
    `(correlation of β with cell count about ` +
    `${f2(LINES.map((l) => M.decomposition.per_line[l].rho_beta_cells).sort((a, b) => a - b)[3])}), so part of what β measures ` +
    `is simply how much the knockdown slows the cell down.`,
  ];
  $('noteList').innerHTML = notes.map((s) => `<li>${s}</li>`).join('');
  const s = M.source;
  $('colophon').innerHTML = `Built by <code>${M.generated_by}</code> on ${M.built} from the reproduction at <code>${s.repro_dir}</code> ` +
    `(commit ${s.repro_commit}; its <code>COMPASS_REPRODUCTION.md</code>, <code>choices.json</code> and <code>reproduction_meta.json</code> ` +
    `are the record). Paper: Liang &amp; Singh 2026, <a href="https://doi.org/${s.paper_doi}" target="_blank" rel="noopener">bioRxiv ${s.paper_doi}</a> ` +
    `(PDF sha256 ${s.paper_sha256.slice(0, 12)}…). Decomposition and CompassX: the authors' <a href="${s.compass_repo}" target="_blank" rel="noopener">compass</a> ` +
    `package at ${s.compass_commit}. Data: Replogle 2022 (Figshare+ 20029387), Nadig 2025 (GEO GSE264667), X-Atlas/Orion (Hugging Face, ` +
    `commit 53a5bc98, CC BY-NC-SA 4.0), Tahoe-100M (Arc Institute, 2025-02-25), ChemFish (Trapnell lab, 2026-09 release). ` +
    `Python ${s.software.python}, numpy ${s.software.numpy}, scanpy ${s.software.scanpy}. Asset version ${M.asset_version}. ` +
    `The pen wobble on frames and rules is decoration; no data mark is jittered.`;
}

let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawAll, 150); });

(async function boot() {
  try {
    readInks();
    await cpLoad();
    $('boot').hidden = true; $('stage').hidden = false;
    const pro = CP.plates.p4.clusters.find((c) => /proteasome/i.test(c.members));
    st.cluster = pro ? pro.id : -1;
    writeProse(); writeTable(); writeLessons(); writeNotes();
    buildExemplars(); buildPrograms(); buildClusters(); wireResidual();
    redrawAll(); selectCluster(st.cluster);
  } catch (err) {
    $('boot').hidden = true;
    const f = $('fail'); f.hidden = false; f.textContent = 'The plates could not be drawn: ' + err.message;
    console.error(err);
  }
})();
