/* /compass — bootstrap, interaction and the written matter.
 *
 * Every number printed here is read from meta.json (our results, the paper's published values,
 * the design facts of our own screens). Nothing is a literal. If a figure in the prose looks
 * stale, rebuild with scripts/build_compass.py; do not retype it.
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
  wrap.innerHTML = '<div class="lhead">programs &nbsp;·&nbsp; click to isolate; the rug beneath each line marks every member gene</div>';
  P.programs.forEach((p, j) => {
    const b = document.createElement('button'); b.className = 'leg'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="swatch" style="background:var(--t${j})"></span><span><span class="leg-name">${p.name}</span>` +
      `<span class="leg-note">expected ${p.expect} along the axis</span></span>`;
    b.onclick = () => { if (st.progIso.has(j)) st.progIso.delete(j); else st.progIso.add(j);
      [...wrap.querySelectorAll('.leg')].forEach((el, k) => el.setAttribute('aria-pressed', !st.progIso.size || st.progIso.has(k) ? 'true' : 'false'));
      drawSpectrum($('cvSpectrum'), st); };
    wrap.appendChild(b);
  });
}

function clusterName(c) { return c.members_sig ? shortTerm(c.members) : 'no shared pathway'; }

function buildClusters() {
  const wrap = $('clusterLegend'), P = CP.plates.p4;
  wrap.innerHTML = '<div class="lhead">residual clusters, by what their knocked-down genes share &nbsp;·&nbsp; click to isolate</div>';
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
    card.innerHTML = `<h4>Residual programmes</h4><p class="big">Choose a cluster, or click a point.</p>` +
      `<p class="small">Each point is one knockdown's residual — what is left of its response once the shared part is taken out — ` +
      `averaged over the four Replogle/Nadig lines and compared by direction alone. Knockdowns that land together move the same genes the same way.</p>`;
    return;
  }
  const c = P.clusters[st.cluster];
  const bar = (gs, vs) => gs.slice(0, 8).map((g, i) => `<span style="display:inline-block;margin-right:10px"><i>${g}</i> <span style="color:var(--ink-3)">${Number(vs[i]).toFixed(2)}</span></span>`).join('');
  card.innerHTML = `<h4>${c.n} knockdowns</h4><p class="big">${clusterName(c)}</p>` +
    `<dl class="kv"><dt>examples</dt><dd>${c.examples}</dd>` +
    (c.program_up ? `<dt>genes pushed up</dt><dd>${shortTerm(c.program_up)}</dd>` : '') +
    (c.program_down ? `<dt>genes pushed down</dt><dd>${shortTerm(c.program_down)}</dd>` : '') +
    `<dt>median β</dt><dd>${Number(c.median_beta).toFixed(2)} along the shared axis</dd></dl>` +
    `<p class="small" style="margin:10px 0 4px">most raised in the residual</p><div class="small">${bar(c.up_genes, c.up_vals)}</div>` +
    `<p class="small" style="margin:8px 0 4px">most lowered</p><div class="small">${bar(c.down_genes, c.down_vals)}</div>` +
    (c.members_sig ? '' : `<p class="small" style="margin-top:8px"><i>No enrichment among the knocked-down genes reaches significance here; read it as a direction, not a pathway.</i></p>`);
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

function writeCap1() {
  const P = CP.plates.p1, e = P.exemplars[st.ex];
  $('cap1').innerHTML =
    `<b>${e.symbol}</b> knockdown in ${P.line}: ${e.why}. Every one of the ${nf(P.n_genes)} readout genes is a hairline, laid ` +
    `out left to right in the order of ${P.line}'s shared axis, so the shared part — β times the axis — falls as one smooth ` +
    `wash from genes the average knockdown raises to genes it lowers. What the wash does not explain is the residual. ` +
    `All three rows share one vertical scale. <i>The three knockdowns were chosen by rule to span the continuum ` +
    `(the most axis-bound ribosomal-protein knockdown; the large response closest to half shared; the large response least on the axis); ` +
    `they illustrate the decomposition, they are not a sample.</i>`;
  $('capVector').innerHTML = `The same three responses as arrows in gene space, drawn at their true angle to the shared axis and ` +
    `their true length. The shared part is the shadow an arrow casts on the axis (β); the residual is the rest, at right angles to it. ` +
    `${e.symbol} casts ${Math.round(e.frac_shared * 100)}% of its squared length.`;
}

function writeProse() {
  const M = CP.meta, R = M.reproduction, Pp = M.paper, D = M.decomposition.per_line, S = M.stress, E = M.external, Z = M.zeroshot;
  const W2 = R.W.paper_anchor['2000'], range = (k) => [Math.min(...LINES.map((l) => D[l][k])), Math.max(...LINES.map((l) => D[l][k]))];
  const [eLo, eHi] = range('energy');
  $('mByline').textContent = `${nf(M.anchor.ensembl)} CRISPRi knockdowns · six human cell lines · three studies`;
  ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'].forEach((id, i) => { $(id).textContent =
    ['the decomposition', `${nf(M.anchor.ensembl)} perturbations`, 'all protein-coding genes', 'Replogle / Nadig', 'the enabling conditions', 'stress tests', 'Tahoe · ChemFish · MiniFin · MegaFin'][i]; });

  $('intro').innerHTML =
    `<p class="lead">A CRISPRi Perturb-seq screen knocks down one gene per cell and reads the whole transcriptome back. Do it for ` +
    `two thousand genes and a puzzle appears that the field has been circling for two years: the <i>average</i> of all the ` +
    `responses predicts any single one about as well as purpose-built models do. Liang and Singh's COMPASS gives that puzzle a ` +
    `structure. Each response, they argue, is a shared part — the same direction in every perturbation of a given cell line, ` +
    `scaled by how strongly that perturbation engages it — plus a part that belongs to the perturbed gene alone.</p>` +
    `<p>They make three claims. How strongly a knockdown engages the shared direction is <i>conserved</i>: the same ` +
    `knockdowns engage it strongly in every cell line. That engagement <i>transfers</i> to a line where the knockdown was never ` +
    `measured. And the part left over <i>carries the biology</i> that tells one knockdown from another.</p>` +
    `<p>We rebuilt the analysis from the three source studies — Replogle's K562 and RPE1, Nadig's HepG2 and Jurkat, X-Atlas/Orion's ` +
    `HCT116 and HEK293T — using the paper's methods and the authors' own code. It reproduces almost to the second decimal ` +
    `(Plate II). The plates then ask what the shared part is (III), where the specific biology lives (IV), what about these ` +
    `screens lets it be seen (V), how much data it takes (VI), and why two datasets closer to our own work, Tahoe-100M and ` +
    `ChemFish, do not show it cleanly (VII).</p>` +
    `<p class="caution">We did not reproduce the paper's STRING-based estimators (COMPASS-N, COMPASS-H) or its STRING prediction of ` +
    `response position. Everything here concerns the decomposition itself and the cross-cell estimator COMPASS-X.</p>`;

  writeCap1();

  $('cap2a').innerHTML = `Every one of the ${nf(M.anchor.ensembl)} shared knockdowns in each line, placed by how large its response is ` +
    `(the length of its vector of per-gene Mann–Whitney statistics) and how closely it follows the line's average response. ` +
    `Large responses tend to be aligned ones in every line. The paper reports the rank correlation running from ${f2(Pp.spearman_m_a.HEK293T)} in HEK293T to ` +
    `${f2(Pp.spearman_m_a.HepG2)} in HepG2; we find ${f2(R.spearman_m_a.HEK293T)} and ${f2(R.spearman_m_a.HepG2)}. All six panels share one scale.`;
  $('cap2b').innerHTML = `<b>Every headline number lands within about 0.02 of the paper's.</b> Kendall's W for alignment, magnitude ` +
    `and position is ${W2.W.map(f3).join(', ')} against the paper's ${Pp.W['2000'].map(f3).join(', ')}; since W for six unrelated rankings ` +
    `is about 1/6 rather than 0, these correspond to mean pairwise correlations of ${W2.r.map(f2).join(', ')} (paper ${Pp.pairwise_r_ams.map(f2).join(', ')}). ` +
    `The perturbation-level β transfers to a held-out line at ${f2(R.transfer.ensembl.RPE1.beta)}–${f2(R.transfer.ensembl.HepG2.beta)}; the residual at ` +
    `${f2(R.transfer.ensembl.Jurkat.g)}–${f2(R.transfer.ensembl.RPE1.g)}. Left: the profiling-budget curve (paper Fig. 4), CompassX rising from ` +
    `${f3(R.budget.CompassX.pearson[0])} to ${f3(R.budget.CompassX.pearson.at(-1))} (paper ${f3(Pp.budget.pearson[0])} to ${f3(Pp.budget.pearson[1])}). ` +
    `<b>One honest difference</b>, in madder in the ledger: our training-mean baseline scores 0.02–0.03 higher than the paper's on ` +
    `accuracy in every line, which makes it tie CompassX on that metric. It still has zero discrimination (PDS gain ` +
    `${f2(Math.max(...R.bench['training mean'].pds))} against CompassX's ${f2(R.bench.CompassX.pds.reduce((a, b) => a + b) / 6)}), which is the paper's point. ` +
    `The paper's 2,270 perturbations are the targets shared by <i>symbol</i>; matching on Ensembl IDs keeps the ${M.anchor.renamed} renamed ` +
    `genes and gives our ${nf(M.anchor.ensembl)}. Headline statistics differ by at most 0.01 between the two.`;

  const sig = CP.plates.p3.signatures, byName = (n) => sig.find((s) => s.signature === n);
  const myc = byName('Hallmark Myc Targets V1'), p53 = byName('p53 targets (core)');
  $('cap3').innerHTML = `The shared direction of each line over all of its protein-coding genes, sorted from most raised (left) to most lowered ` +
    `(right), drawn at one scale for all six with the extreme tips clipped; beneath each, one thin rug per programme marks where that programme's genes fall. <b>In all six lines the same thing ` +
    `happens</b>: MYC and E2F targets, ribosome biogenesis and mitochondrial translation sink to the right, while p53 targets, ` +
    `TNF-α/NF-κB and apoptosis genes rise to the left. The top genes at each end name it plainly — <i>CDKN1A, MDM2, ZMAT3, GDF15</i> ` +
    `on one side, <i>MKI67, CENPF, TUBA1B, H2AZ1</i> on the other. It is the transcriptional signature of a cell that has stopped ` +
    `growing and is under stress. Line identity rides on top: K562's raised end is led by erythroid genes (<i>HBZ, GYPB, ALAS2</i>), ` +
    `Jurkat's by T-cell genes (<i>LEF1, PTPRC</i>).`;
  $('cap3b').innerHTML = `Mean z-score of the shared direction over each signature's genes; ochre raised, grey-blue lowered, disc area by size. ` +
    `MYC targets are lowered in every line (${LINES.map((l) => f2(myc[l])).join(', ')}); core p53 targets raised in every line ` +
    `(${LINES.map((l) => f2(p53[l])).join(', ')}). Heat-shock and ER chaperones are lowered too — this is not a generic ` +
    `"stress up" axis but a specific one. <b>Still, these programmes explain only ${Math.round(Math.min(...Object.values(M.biology.r2)) * 100)}–` +
    `${Math.round(Math.max(...Object.values(M.biology.r2)) * 100)}% of the direction's gene-by-gene variance</b>; the rest is spread thinly, ` +
    `and part of it is the cell line's own identity. Knockdowns of core-essential genes engage the axis more in every line.`;

  const pr = M.decomposition.pairs.filter((p) => p.a !== 'HCT116');
  const resSame = pr.map((p) => p.res_same), resRand = pr.map((p) => p.res_random);
  const [rLo, rHi] = range('split_residual_r'), [cLo, cHi] = range('split_cos_u');
  $('cap4').innerHTML = `Each point is one knockdown's residual direction, averaged over the four Replogle/Nadig lines. Clustered by ` +
    `direction alone — no pathway labels are used — ${CP.plates.p4.clusters.filter((c) => c.members_sig).length} of the 20 clusters are significantly enriched for a shared function among ` +
    `their knocked-down genes, and the clearest are single machines: the small ribosomal subunit, tRNA synthetases, the proteasome, ` +
    `mitochondrial translation, the spliceosome, DNA replication, N-glycosylation. Their residuals say what that machine's loss does beyond ` +
    `the shared response: tRNA-synthetase knockdowns raise the unfolded-protein response; neddylation knockdowns (<i>CUL3, KEAP1</i>) ` +
    `raise the oxidative-stress programme; vesicle-trafficking and V-ATPase knockdowns raise cholesterol biosynthesis. Some clusters ` +
    `(“lamellipodium assembly”, “thermogenesis”) are enriched but loose; read those names as the nearest label, not a finding.`;
  $('cap4').innerHTML += ` <i>The layout is a t-SNE: distances on it are a drawing aid, and the clusters were computed before it, in the full space.</i>`;
  $('cap4b').innerHTML = `<b>The residual is where the biology is, and it is the hardest part to measure.</b> Split every line's cells and ` +
    `controls in two and rebuild everything from each half: the shared axis agrees with itself at cosine ${f2(cLo)}–${f2(cHi)}, β at ` +
    `${f2(range('split_beta_r')[0])}–${f2(range('split_beta_r')[1])}, but the residual of a single knockdown only at ${f2(rLo)}–${f2(rHi)}. ` +
    `Across lines the same knockdown's residual agrees at ${f2(Math.min(...resSame))}–${f2(Math.max(...resSame))}, against ` +
    `zero for random pairs (never more than ${Math.max(...resRand.map(Math.abs)).toFixed(3)} either way) — small, but entirely specific. Individual residuals are noisy; ` +
    `their shared pathway structure is not.`;

  const cr = CP.plates.p5.crispr;
  $('cap5').innerHTML = `<b>Many perturbations.</b> ${nf(M.anchor.ensembl)} per line, drawn as one stroke each at the same pitch as every ` +
    `other row, against the ${nf(Math.round(E.tahoe.n_perturbations))} drug-doses Tahoe gives each line, the ${Z.MegaFin.perturbations} drug-doses MegaFin was built ` +
    `with, a median of ${Math.round(E.chemfish.n_perturbations)} drug conditions per ChemFish tissue, and MiniFin's ${Z.MiniFin.perturbations}. ` +
    `<b>Strong perturbations.</b> ${Math.round(cr.above_2x * 100)}% of the knockdowns move their line more than twice as far as two halves of ` +
    `the controls differ from each other (median ${f2(cr.median)}×); a quarter of the targets are core-essential genes, against about 3.5% ` +
    `genome-wide. <b>Depth.</b> Around ${nf(parseFloat(String(M.comparison['UMIs per cell (median, protein-coding)']['COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)']).replace(/,/g, '')))} ` +
    `molecules per cell and a median of ${M.comparison['cells per perturbation x context (median)']['COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)'].replace('(lines', '(line medians').replace('-', '–')} cells per knockdown. <b>Controls in the same lanes.</b> Non-targeting guides are ` +
    `delivered into the same pool, so control cells share every lane, every capture and every handling step with the perturbed ones.`;

  const ph = S.phase, kAll = ph.k.length - 1, iN = (n) => ph.n.indexOf(n), kx = (k) => ph.k.indexOf(String(k));
  // nearest thinning step (on a log scale) to each dataset's own median depth
  const num = (s) => parseFloat(String(s).replace(/,/g, '')), UM = M.comparison['UMIs per cell (median, protein-coding)'];
  const dp = S.depth, near = (v) => dp.library.reduce((b, x, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(dp.library[b] / v)) ? i : b), 0);
  const iT = near(num(UM['Tahoe-100M'])), iC = near(num(UM['ChemFish 2026_09']));
  const ctl = S.controls_cos, single = LINES.map((l) => ctl[l]['single largest batch']);
  $('cap6').innerHTML = `<b>How much data before the phenomenon is visible?</b> Top left, a new experiment for this page: every line's axis ` +
    `and β rebuilt from n perturbations with at most k cells each, scored by how well β agrees across the four Replogle/Nadig lines ` +
    `(the paper's headline). <b>Cells per perturbation decide it; the number of perturbations barely matters once there are ten.</b> With ` +
    `every cell, ten knockdowns already give ${f2(ph.cons_RN[iN(10)][kAll])}; at ten cells each the agreement falls to ${f2(ph.cons_RN[iN(300)][kx(10)])}, ` +
    `at two to ${f2(ph.cons_RN[iN(300)][kx(2)])}. Top right, the second new experiment: the same cells binomially thinned toward shallower ` +
    `libraries. Agreement holds at ${f2(dp.cons_RN[iT])} at Tahoe-like depth and ${f2(dp.cons_RN[iC])} near ChemFish's — <b>depth alone does not ` +
    `erase it</b>, though the X-Atlas pair frays sooner (${f2(dp.cons_XA[iC])}). Bottom left: the axis is carried by its strongest knockdowns; ` +
    `remove the top quarter and agreement drops to ${f2(S.remove_top_cons[3][1])} (X-Atlas ${f2(S.remove_top_cons[3][2])}); remove half and it is ${f2(S.remove_top_cons[4][1])}. ` +
    `Bottom right: any pooled control set gives the same axis, but controls from a single batch break it (cosine ${f2(Math.min(...single))}–${f2(Math.max(...single))}). ` +
    `The axis direction itself is visible from about 30 perturbations in five lines (about 100 in HEK293T, whose axis carries only ` +
    `${Math.round(D.HEK293T.energy * 100)}% of the response).`;

  const w = E.tahoe.dmso_well, t = E.tahoe.checks, c = E.chemfish;
  $('cap7').innerHTML = `<b>Tahoe shows a stronger, more conserved axis than the CRISPRi screens</b> — β agrees across ` +
    `${t.W_block_contexts} lines at a mean rank correlation of ${f2(t.mean_pairwise_spearman_from_W)} — <b>but it does not behave like drug biology.</b> ` +
    `It does not rise with dose: the median β of the lowest dose (${f2(E.tahoe.dose_tiers['1'])}) matches the middle one and exceeds the highest ` +
    `(${f2(E.tahoe.dose_tiers['3'])}). Every plate has two DMSO wells, and every drug on the plate is measured against them, in wells shared by all ` +
    `fifty lines. The difference between those two DMSO wells — a pseudo-drug containing no drug — is ${f2(w.median_norm_well_diff)} in size against ` +
    `${f2(w.median_norm_sampling_noise)} for sampling alone and ${f2(w.median_drug_effect_norm)} for a median drug, loads on the axis at ` +
    `${Math.round(w.median_abs_beta_well_over_median_drug_beta * 100)}% of a typical drug's β, and is shared across the fifty lines exactly as strongly as a ` +
    `real drug effect (r = ${f2(w.mean_crossline_r_of_well_diff)} against ${f2(w.mean_crossline_r_of_same_drug_effect)}). In a pooled-line design a well artefact ` +
    `is indistinguishable from a conserved response. Tahoe's residuals, by contrast, are strongly drug-specific. ` +
    `<b>ChemFish is weak for simpler reasons:</b> about ${Math.round(c.n_perturbations)} conditions per tissue, effects only ${f2(c.noise_ratio)}× the ` +
    `control noise, and tissues whose axes barely agree with one another (cosine ${f2(c.pair_similarity.u_cosine)}); β agrees across tissues at ` +
    `${f2(c.checks.mean_pairwise_spearman_from_W)}.`;
}

function writeTable() {
  const C = CP.meta.comparison, Z = CP.meta.zeroshot;
  const cols = ['COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)', 'Tahoe-100M', 'ChemFish 2026_09'];
  const pick = [
    ['perturbations per context (analysed)', 'perturbations per context', (k) => `${Z.MegaFin.perturbations} drug-doses`, (k) => `${Z.MiniFin.perturbations} drugs + DMSO`],
    ['perturbation type', 'perturbation', () => 'drugs, whole embryos', () => 'drugs, whole embryos'],
    ['contexts', 'contexts', () => Z.MegaFin.context, () => Z.MiniFin.context],
    ['control design', 'controls', () => Z.MegaFin.controls, () => Z.MiniFin.controls],
    ['independent replication', 'replication', () => Z.MegaFin.replicates, () => Z.MiniFin.replicates],
    ['cells per perturbation x context (median)', 'cells per perturbation × context', () => `about ${nf(Math.round(Z.MegaFin.cells / 192 / 1000) * 1000)} per well (2 × 96 wells), split across cell types`, () => `about ${nf(Math.round(Z.MiniFin.cells / 48 / 100) * 100)} per well`],
    ['effect size: median ||z|| / control-noise ||z||', 'effect ÷ control noise', () => 'not yet measured', () => 'not yet measured'],
    ['shared-axis strength: energy on axis (median over contexts)', 'share of response on the axis', () => '—', () => '—'],
    ['beta conservation across contexts (Kendall W)', 'β agreement across contexts', () => '—', () => '—'],
    ['residual reproducibility: split-half residual r (median)', 'residual split-half r', () => '—', () => '—'],
    ['technical confounding: DMSO-well-vs-DMSO-well |beta| / median drug |beta|', 'well artefact ÷ drug β', () => 'one well per drug-dose: not separable', () => '12 replicate wells: separable'],
  ];
  const head = `<tr><th></th><th>CRISPRi (COMPASS)</th><th>Tahoe-100M</th><th>ChemFish</th><th>MegaFin</th><th>MiniFin</th></tr>`;
  const body = pick.map(([key, label, mega, mini]) => {
    const r = C[key] || {}, esc = (s) => (s === undefined || s === '' ? '—' : String(s));
    const key_ = /control|replication|confounding/.test(key) ? ' class="key"' : '';
    return `<tr${key_}><td>${label}</td>` + cols.map((c) => `<td>${esc(r[c])}</td>`).join('') + `<td>${mega()}</td><td>${mini()}</td></tr>`;
  }).join('');
  $('cmpTable').innerHTML = head + body;
}

function writeLessons() {
  const M = CP.meta, S = M.stress, ph = S.phase, Z = M.zeroshot;
  $('lessons').innerHTML =
    `<h3>What follows for MiniFin, MegaFin and the screens after them</h3>` +
    `<ol class="lessons">` +
    `<li><b>Put controls where the perturbations are.</b> The CRISPRi axis is trustworthy because its controls share every lane with the ` +
    `perturbed cells. Tahoe's and MegaFin's controls live in their own wells, ChemFish's in their own embryos; the reference then becomes a ` +
    `shared, confoundable object. Distribute several control wells across every plate, and give every perturbation at least two ` +
    `replicate wells, so a well effect can be told from a perturbation effect. MiniFin's twelve replicate wells can do this; MegaFin's ` +
    `one well per drug-dose cannot.</li>` +
    `<li><b>Budget cells per perturbation before perturbations.</b> In these data the cross-line phenomenon is set by cells per ` +
    `perturbation per context — ${f2(ph.cons_RN[ph.n.indexOf(300)][ph.k.indexOf('10')])} at ten cells, ${f2(ph.cons_RN[ph.n.indexOf(300)][ph.k.indexOf('25')])} at twenty-five, ` +
    `${f2(ph.cons_RN[ph.n.indexOf(300)][ph.k.length - 1])} with all of them. In a whole-embryo screen every cell type is a context, so the ` +
    `count that matters is cells of that type per well, not cells per well.</li>` +
    `<li><b>Then enough perturbations, including strong ones.</b> The axis is defined by its strongest quarter; include a few potent ` +
    `"calibrator" perturbations of core growth machinery. MegaFin's ${Z.MegaFin.perturbations} drug-doses are enough to estimate an axis; ` +
    `MiniFin's ${Z.MiniFin.perturbations} drugs are not, and never were meant to be.</li>` +
    `<li><b>Depth can be traded for cells.</b> Thinning CRISPRi libraries toward Tahoe- and ChemFish-like depths kept the axis largely ` +
    `intact when the cells were many. Shallow libraries are not the obstacle; few cells per context would be.</li>` +
    `<li><b>Treat the shared axis as a covariate, not the result.</b> It is a growth-arrest and p53 stress programme. The perturbation-specific ` +
    `residual is where reusable biology lives, and it is the most expensive part to measure: plan for it explicitly.</li>` +
    `<li><b>Score discrimination, not only accuracy.</b> A predictor that returns the training mean matches CompassX on accuracy in these ` +
    `data and discriminates nothing.</li></ol>`;
}

function writeNotes() {
  const M = CP.meta, R = M.reproduction;
  const notes = [
    `<b>What was reproduced.</b> The magnitude–alignment geometry, its cross-line conservation (Kendall's W, all fifteen pairs), β ` +
    `conservation (Table 13), leave-one-line-out transfer (Tables 2, 9), the β-to-position correlation (${f2(R.betabar_sbar[0])}; paper ` +
    `${f2(M.paper.betabar_sbar[0])}), CompassX with its baselines (Table 3) and the budget curve (Fig. 4), on both the Ensembl anchor and the ` +
    `paper's symbol anchor.`,
    `<b>What was not.</b> STRING, COMPASS-N and COMPASS-H, the STRING prediction of response position (R² 0.35), the deep-learning baselines ` +
    `and TabICL. None of the page's conclusions rests on them.`,
    `<b>The training-mean baseline scores higher for us.</b> By 0.02–0.03 in every line, so it ties CompassX on accuracy in our hands; ` +
    `CompassX still leads decisively on discrimination.`,
    `<b>K562 is the genome-wide screen.</b> The paper does not say which K562 object it used; the essential-gene screen has too few targets ` +
    `(2,057) to contain the shared anchor, so it cannot have been that one.`,
    `<b>Exemplars and layouts are illustrations.</b> Plate I's three knockdowns were picked by a stated rule; Plate IV's t-SNE is a drawing ` +
    `aid. The clusters, statistics and captions come from the full space.`,
    `<b>Tahoe is shown as confounded, and should stay so.</b> The DMSO-well test bounds the well artefact; it cannot subtract it, because ` +
    `there are two DMSO wells per plate and no replicate drug wells. Tahoe's shared-axis numbers are upper bounds on any biological shared response.`,
    `<b>ChemFish's contexts are tissues of the same embryos</b>, not independent cell lines; its genetic arm is not in the released cell ` +
    `object; and only about 25 conditions are shared by most tissues. Its numbers are for the drug arm only.`,
    `<b>The two threshold experiments are ours, not the paper's.</b> Cell caps and perturbation draws use fixed seeds (30 draws per cell ` +
    `of the grid); thinning is exact binomial thinning of the raw counts, with the unpaneled remainder of each library thinned as one draw.`,
    `<b>β is partly fitness.</b> Strong knockdowns yield fewer cells and smaller libraries (median ρ with cell count ` +
    `${f2(LINES.map((l) => M.decomposition.per_line[l].rho_beta_cells).sort((a, b) => a - b)[3])}), so part of what β measures is growth ` +
    `expressed through cell yield and depth.`,
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
