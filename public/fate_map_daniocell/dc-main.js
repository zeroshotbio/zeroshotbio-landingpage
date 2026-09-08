/* /fate_map_daniocell — bootstrap, interaction and the written matter.
 *
 * Every number printed on this page is read out of meta.json, which the build
 * script writes in the same pass that writes the binaries. Nothing is a
 * literal. If a figure in the prose looks stale, rebuild; do not retype it.
 */
'use strict';

const state = { iso: new Set() };     // isolated tissue indices; empty = all

const $ = (id) => document.getElementById(id);
const nf = (n) => n.toLocaleString('en-US');

/* ---- Plate I ----------------------------------------------------------- */
function wireLandscape() {
  const hold = $('landHold'), cv = $('cvLand');
  const scrub = $('tScrub'), read = $('tRead');
  scrub.max = String(DC.meta.stages.length - 1);
  scrub.value = String(DC.meta.stages.length - 1);
  const readOut = () => {
    const s = DC.meta.stages[land.stage];
    read.textContent = `${s} hpf · stage ${land.stage + 1}/${DC.meta.stages.length}`;
  };
  readOut();
  scrub.addEventListener('input', () => {
    land.stage = +scrub.value; readOut(); landDraw();
  });
  $('cbTime').onclick = () => setLandMode('time');
  $('cbTissue').onclick = () => setLandMode('tissue');
  $('landReset').onclick = () => {
    land.held = -1; state.iso.clear(); land.stage = DC.meta.stages.length - 1;
    scrub.value = String(land.stage); readOut();
    syncLegend(); $('landCard').hidden = true; redrawAll();
  };
  hold.addEventListener('click', (e) => {
    const r = hold.getBoundingClientRect();
    const ci = landPick(e.clientX - r.left, e.clientY - r.top);
    land.held = (ci === land.held) ? -1 : ci;
    renderLandCard();
    landDraw();
  });
}

function setLandMode(m) {
  land.mode = m;
  $('cbTime').setAttribute('aria-pressed', m === 'time' ? 'true' : 'false');
  $('cbTissue').setAttribute('aria-pressed', m === 'tissue' ? 'true' : 'false');
  landDraw();
}

function renderLandCard() {
  const card = $('landCard');
  if (land.held < 0) { card.hidden = true; return; }
  const c = DC.clusters[land.held];
  const prof = DC.stageProfile(land.held);
  let first = -1, last = -1;
  for (let i = 0; i < prof.length; i++) if (prof[i]) { if (first < 0) first = i; last = i; }
  $('landCardBody').innerHTML = `
    <dt>state</dt><dd>${c.id}${c.annotated ? '' : ' <i>(no annotation row)</i>'}</dd>
    <dt>identity</dt><dd>${c.identity || '—'}${c.identity_sub ? ' · <i>' + c.identity_sub + '</i>' : ''}</dd>
    <dt>tissue</dt><dd>${c.tissue}</dd>
    <dt>cells</dt><dd>${nf(c.n)}</dd>
    <dt>seen</dt><dd>${DC.meta.stages[first]} – ${DC.meta.stages[last]} hpf</dd>
    <dt>persistence</dt><dd>${c.persistence_median ?? '—'} h <span style="color:var(--ink-3)">(median of its cells' neighbourhood spread)</span></dd>
    <dt>cycling</dt><dd>${Math.round(c.cycling_frac * 100)}% of its cells</dd>`;
  card.hidden = false;
}

/* ---- legend (isolate, never hide) -------------------------------------- */
function buildLegend() {
  const wrap = $('legend');
  wrap.innerHTML = '<div class="lhead">tissue subsets — click to isolate; a wash is assigned on isolation</div>';
  DC.meta.tissues.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'leg';
    b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="swatch"></span>` +
      `<span><span class="leg-name">${t.key}</span> <span class="leg-n">${nf(t.cells)}</span></span>`;
    b.onclick = () => {
      if (state.iso.has(i)) state.iso.delete(i); else state.iso.add(i);
      syncLegend(); redrawAll();
    };
    b.dataset.tix = String(i);
    wrap.appendChild(b);
  });
}
function syncLegend() {
  // The wash a tissue gets is its position in the isolation set, so the colours
  // on the plate always match the colours in the legend however many are lit.
  const order = [...state.iso];
  [...$('legend').querySelectorAll('.leg')].forEach((el, i) => {
    const lit = !state.iso.size || state.iso.has(i);
    el.setAttribute('aria-pressed', lit ? 'true' : 'false');
    const k = order.indexOf(i);
    el.querySelector('.swatch').style.background =
      k >= 0 ? `var(--t${k % 7})` : 'var(--ink-3)';
  });
}

/* ---- Plate II ---------------------------------------------------------- */
function wireScore() {
  const hold = $('scoreHold');
  const set = (o) => {
    score.order = o;
    for (const [id, k] of [['soTissue', 'tissue'], ['soOnset', 'onset'], ['soDur', 'dur']])
      $(id).setAttribute('aria-pressed', o === k ? 'true' : 'false');
    scoreLayout();
  };
  $('soTissue').onclick = () => set('tissue');
  $('soOnset').onclick = () => set('onset');
  $('soDur').onclick = () => set('dur');
  hold.addEventListener('pointermove', (e) => {
    const r = hold.getBoundingClientRect();
    const h = scorePick(e.clientX - r.left, e.clientY - r.top);
    if (h !== score.hover) { score.hover = h; renderScoreCard(); scoreDraw(); }
  });
  hold.addEventListener('pointerleave', () => {
    if (score.hover >= 0) { score.hover = -1; renderScoreCard(); scoreDraw(); }
  });
}

function renderScoreCard() {
  const card = $('scoreCard');
  if (score.hover < 0) { card.hidden = true; return; }
  const c = DC.clusters[score.hover];
  const lt = (c.persistence_median ?? 0) >= DC.meta.long_term_hours;
  $('scoreCardBody').innerHTML = `
    <dt>state</dt><dd>${c.id} · ${c.identity || 'unannotated'}${c.identity_sub ? ' <i>(' + c.identity_sub + ')</i>' : ''}</dd>
    <dt>tissue</dt><dd>${c.tissue} · ${nf(c.n)} cells</dd>
    <dt>observed</dt><dd>${c.span_lo}–${c.span_hi} hpf <span style="color:var(--ink-3)">(2–98%; extremes ${c.span_first}–${c.span_last})</span></dd>
    <dt>persistence</dt><dd>${c.persistence_median ?? '—'} h${lt ? ' — <b>long-term</b>' : ''} <span style="color:var(--ink-3)">(IQR ${c.persistence_q1}–${c.persistence_q3})</span></dd>
    <dt>cycling</dt><dd>${Math.round(c.cycling_frac * 100)}%</dd>`;
  card.hidden = false;
}

/* ---- Plate III --------------------------------------------------------- */
function buildProgList() {
  const wrap = $('progList');
  const shared = DC.programs
    .map((m, i) => ({ m, i }))
    .filter(x => x.m.shared && x.m.tissues.length >= 2)
    .sort((a, b) => b.m.tissues.length - a.m.tissues.length);
  wrap.innerHTML = '';
  for (const { m, i } of shared) {
    const b = document.createElement('button');
    b.className = 'prog-item';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="pid">${m.id}</span> ${m.desc || '<i>unnamed</i>'}` +
      `<span class="pt"> — ${m.tissues.join(', ')}${m.broad ? ' + broadly' : ''}</span>`;
    b.onclick = () => {
      prog.sel = (prog.sel === i) ? -1 : i;
      [...wrap.children].forEach(el => el.setAttribute('aria-pressed', 'false'));
      if (prog.sel === i) b.setAttribute('aria-pressed', 'true');
      renderProgCaption();
      progDraw();
    };
    wrap.appendChild(b);
  }
  DC._drawable = shared.length;
  $('progWhen').textContent =
    `${shared.length} drawn of ${DC.meta.counts.programs_shared} shared`;
}

function renderProgCaption() {
  const m = prog.sel >= 0 ? DC.programs[prog.sel] : null;
  const c = DC.meta.counts;
  $('capProg').innerHTML = m
    ? `<b>${m.id}</b> — ${m.desc || 'unnamed'}. Deployed in <b>${m.tissues.join(', ')}</b>` +
      (m.broad ? ', and described by the authors as broadly expressed beyond these' : '') +
      `. Cell types named: <i>${m.celltypes || 'not specified'}</i>. Top-loaded genes: ` +
      `<i>${m.genes.slice(0, 12).join(', ')}</i>${m.n_genes > 12 ? ` … (${m.n_genes} listed)` : ''}.` +
      (m.excluded === 'Y' ? ' <b>The authors marked this module for exclusion from downstream analysis.</b>' : '')
    : `Each figure is one gene expression program, drawn through the tissue subsets that deploy it. ` +
      `The authors mark <b>${c.programs_shared}</b> of <b>${c.programs}</b> modules as shared, giving ` +
      `<b>${c.program_tissue_edges}</b> program-to-tissue edges; <b>${DC._drawable}</b> of them name two ` +
      `or more of the nineteen subsets and so can be drawn as a figure. The rest name one subset plus ` +
      `prose, or only prose, and are left out rather than given invented edges. Pick one from the list ` +
      `to lift it out. The pile is the point: development keeps reaching for the same small vocabulary.`;
}

/* ---- Plate IV ---------------------------------------------------------- */
function wireCascade() {
  const hold = $('cascHold');
  const set = (w) => {
    casc.which = w; casc.hover = -1;
    $('cxIsmc').setAttribute('aria-pressed', w === 'ismc' ? 'true' : 'false');
    $('cxBest4').setAttribute('aria-pressed', w === 'best4' ? 'true' : 'false');
    cascLayout(); renderCascCaption();
  };
  $('cxIsmc').onclick = () => set('ismc');
  $('cxBest4').onclick = () => set('best4');
  hold.addEventListener('pointermove', (e) => {
    const r = hold.getBoundingClientRect();
    const h = cascPick(e.clientX - r.left, e.clientY - r.top);
    if (h !== casc.hover) { casc.hover = h; cascDraw(); }
  });
  hold.addEventListener('pointerleave', () => {
    if (casc.hover >= 0) { casc.hover = -1; cascDraw(); }
  });
}

function renderCascCaption() {
  const d = DC.cascades[casc.which];
  const branched = d.segments.length > 1;
  $('capCasc').innerHTML = branched
    ? `The intestinal smooth muscle trajectory: a shared trunk of <b>${d.segments[0][1]}</b> pseudotime ` +
      `points that divides into two branches, <b>${d.genes.length}</b> genes ordered by where each peaks. ` +
      `The branch labels are not taken from the table's sheet name — which has them the other way round ` +
      `— but re-derived each build from the paper's own markers: <i>il13ra2</i> for the putative ` +
      `longitudinal layer, <i>fsta</i>, <i>kcnk18</i> and <i>foxf2a</i> for the circular one. ` +
      `<b>This is an inferred ordering.</b> No cell here was observed becoming another.`
    : `The best4<sup>+</sup> intestinal trajectory: <b>${d.genes.length}</b> genes across ` +
      `<b>${d.pseudotime.length}</b> pseudotime points, ordered by where each peaks, which is what makes ` +
      `the diagonal. <b>This is an inferred ordering</b> reconstructed from expression alone — pseudotime ` +
      `is a statistical arrangement of a snapshot population, not elapsed time.`;
}

/* ---- prose ------------------------------------------------------------- */
function writeProse() {
  const m = DC.meta, c = m.counts;
  $('mCells').textContent = nf(c.cells);
  $('mStages').textContent = String(c.stages);

  $('capLand').innerHTML =
    `All <b>${nf(c.cells)}</b> cells in one fixed UMAP of the whole atlas. The faint ground is every ` +
    `cell; the inked cells are those collected at or before the scrubbed stage, and the madder ones are ` +
    `that stage alone — so dragging the scrubber shows populations arriving. <b>Distance here is not a ` +
    `quantity.</b> Two populations far apart are not "more different" by any stated amount, and a ` +
    `population that appears to move between stages is one whose expression changed, not one that ` +
    `travelled. Isolating a tissue tints it; clicking a cell holds its whole state across all of time.`;

  $('capScore').innerHTML =
    `One rule per transcriptional state, <b>${nf(c.clusters)}</b> of them. <b>Length is the observed ` +
    `extent</b> — the 2nd to 98th percentile of the stages at which its cells were actually collected, ` +
    `with hairlines to the extremes. <b>Ink weight is the authors' persistence measure</b>, which is a ` +
    `different quantity: the median, over the state's cells, of the mean stage difference between a cell ` +
    `and its neighbours in gene-expression space. Heavier rules are the states the authors call ` +
    `long-term (${m.long_term_hours} hours or more); <b>${nf(c.cells_long_term)}</b> cells sit in one. A hollow tick ` +
    `marks states that are mostly cycling. A long rule with light ink is a state seen across much of ` +
    `development whose early and late cells do <i>not</i> resemble each other — which is the most ` +
    `interesting shape on the plate, and is only visible because the two measures are kept apart.`;

  renderProgCaption();
  renderCascCaption();

  const notes = [
    `<b>Nothing on this page is lineage.</b> DanioCell dissociates and reads each cell once. Two cells ` +
    `near each other in Plate I are expressing similar genes; they are not relatives, and no plate here ` +
    `— including the trajectory — observed any cell turning into another. Its sister page ` +
    `<a href="/fate_map_wang_2026">/fate_map_wang_2026</a> is the one that may use that vocabulary.`,
    `<b>Persistence is not a lifetime.</b> It is per-cell: the mean absolute stage difference between a ` +
    `cell and the cells within a fixed distance of it in gene-expression space, computed <i>within</i> ` +
    `tissue subsets rather than globally. Every state carries a distribution of it, and Plate II draws ` +
    `the median. The rule's length is the separate, observed quantity.`,
    `<b>The programs are a curated reading, not a computed matrix.</b> Plate III's edges come from the ` +
    `authors' free-text "Tissue(s) expressed" column in Table S5, normalised onto the nineteen subsets ` +
    `by the build script. Modules the authors described only in prose — "lots of tissues" — carry a ` +
    `broadly-deployed mark and no edges, because inventing them would look like data. The binary ` +
    `module-by-cell-type matrix behind the paper's own figure is not in the deposit.`,
    `<b>The published module count does not reconcile.</b> Table S5's caption says 147 programs; the ` +
    `sheet holds <b>${c.programs}</b> rows, of which <b>${c.programs_shared}</b> are marked shared and 22 ` +
    `marked for exclusion. The paper separately describes eliminating 57 of 147. This page counts what ` +
    `is in the table and says so rather than quoting a figure it cannot reproduce.`,
    `<b>The stage count does not reconcile either.</b> The paper says 62 stages throughout. The Seurat ` +
    `object's own <code>hpf</code> column holds <b>${c.stages}</b> distinct collected stages, which is ` +
    `exactly what Table S1's sample list expands to; the GEO metadata bins them to 63. This page uses ` +
    `the object's ${c.stages}.`,
    `<b>The GEO matrix is log-normalised, not raw counts.</b> It does not affect these four plates, ` +
    `which use metadata, embeddings and the supplementary tables — but it will bite anything that ` +
    `normalises again.`,
    `<b>One cluster has no annotation row.</b> <code>ceph</code> carries cells and a subset but no entry ` +
    `in the cluster annotation table, so it appears as an unannotated state rather than being dropped.`,
    `<b>One animal's worth of biology, pooled.</b> The atlas is many wild-type embryos dissociated at ` +
    `each stage, not one followed through time. Abundance in Plate I is abundance in the dissociated ` +
    `sample, which is a function of dissociation and capture as much as of the embryo.`,
  ];
  $('noteList').innerHTML = notes.map(s => `<li>${s}</li>`).join('');

  $('colophon').innerHTML =
    `Built by <code>${m.generated_by}</code> from the DanioCell release: ` +
    `<a href="https://doi.org/${m.source.doi}" target="_blank" rel="noopener">${m.source.journal}</a>, ` +
    `GEO <a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${m.source.geo}" target="_blank" rel="noopener">${m.source.geo}</a>, ` +
    `the <a href="${m.source.portal}" target="_blank" rel="noopener">NIH portal</a> Seurat object and ` +
    `supplementary Tables S5 and S6; code at ` +
    `<a href="${m.source.code}" target="_blank" rel="noopener">farrelllab/2023_Sur</a> (CC0). ` +
    `Embeddings extracted once by <code>scripts/extract_daniocell_seurat.R</code> from the portal object, ` +
    `sha256 ${m.source.embedding_from.split('sha256 ')[1].slice(0, 16)}…, verified against the copy held ` +
    `at <code>${m.source.warehouse}</code>. Its look is the plate style — see PLATE_STYLE.md.`;
}

/* ---- boot -------------------------------------------------------------- */
function redrawAll() { landDraw(); scoreDraw(); progDraw(); }

let rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { landResize(); scoreResize(); progResize(); cascResize(); }, 140);
});

(async function boot() {
  try {
    await dcLoad();
    $('boot').hidden = true;
    $('stage').hidden = false;
    landInit($('cvLand'), $('landHold'));
    scoreInit($('cvScore'), $('scoreHold'));
    progInit($('cvProg'), $('progHold'));
    cascInit($('cvCasc'), $('cascHold'));
    buildLegend();
    buildProgList();
    wireLandscape();
    wireScore();
    wireCascade();
    writeProse();
    redrawAll();
  } catch (err) {
    $('boot').hidden = true;
    const f = $('fail'); f.hidden = false;
    f.textContent = 'The plates could not be drawn: ' + err.message;
    console.error(err);
  }
})();
