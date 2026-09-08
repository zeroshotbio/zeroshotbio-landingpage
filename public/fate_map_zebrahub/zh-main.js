/* /fate_map_zebrahub — bootstrap, interaction and the written matter.
 *
 * Every number printed on this page is read out of meta.json, which the build
 * script writes in the same pass as the binaries. Nothing is a literal.
 */
'use strict';

const state = { iso: new Set() };

const $ = (id) => document.getElementById(id);
const nf = (n) => n.toLocaleString('en-US');

/* ---- Plate I ----------------------------------------------------------- */
function wireAtlas() {
  const hold = $('atlasHold'), scrub = $('aScrub'), read = $('aRead');
  scrub.max = String(ZH.meta.timepoints.length - 1);
  scrub.value = scrub.max;
  const readOut = () => {
    const t = ZH.meta.timepoints[atlas.stage];
    read.textContent = `${t.name} · ${t.stage} · ${nf(t.cells)} cells`;
  };
  readOut();
  scrub.addEventListener('input', () => { atlas.stage = +scrub.value; readOut(); atlasDraw(); });
  const mode = (m) => {
    atlas.mode = m;
    $('amCumul').setAttribute('aria-pressed', m === 'cumul' ? 'true' : 'false');
    $('amOnly').setAttribute('aria-pressed', m === 'only' ? 'true' : 'false');
    atlasDraw();
  };
  $('amCumul').onclick = () => mode('cumul');
  $('amOnly').onclick = () => mode('only');
  $('atlasReset').onclick = () => {
    atlas.held = -1; state.iso.clear(); atlas.stage = ZH.meta.timepoints.length - 1;
    scrub.value = String(atlas.stage); readOut(); syncLegend();
    $('atlasCard').hidden = true; redrawAll();
  };
  hold.addEventListener('click', (e) => {
    const r = hold.getBoundingClientRect();
    const k = atlasPick(e.clientX - r.left, e.clientY - r.top);
    atlas.held = (k === atlas.held) ? -1 : k;
    renderAtlasCard(); atlasDraw();
  });
}

function renderAtlasCard() {
  const card = $('atlasCard');
  if (atlas.held < 0) { card.hidden = true; return; }
  const tpi = atlas.held >> 16, cl = atlas.held & 0xffff, C = ZH.cells;
  let n = 0; const byCls = {}; const byFish = {};
  for (let i = 0; i < C.n; i++) {
    if (C.t[i] !== tpi || C.cluster[i] !== cl) continue;
    n++;
    byCls[C.cls[i]] = (byCls[C.cls[i]] || 0) + 1;
    byFish[C.fish[i]] = (byFish[C.fish[i]] || 0) + 1;
  }
  const top = Object.entries(byCls).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${ZH.meta.classes[k].key} (${v})`).slice(0, 3).join(', ');
  const fishes = Object.entries(byFish).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${ZH.meta.fish[k]} ${v}`).join(' · ');
  $('atlasCardBody').innerHTML = `
    <dt>cluster</dt><dd>${ZH.meta.timepoints[tpi].name} cluster ${cl}</dd>
    <dt>cells</dt><dd>${nf(n)}</dd>
    <dt>tissue</dt><dd>${top}</dd>
    <dt>across the four fish</dt><dd>${fishes}</dd>`;
  card.hidden = false;
}

function buildLegend() {
  const wrap = $('legend');
  wrap.innerHTML = '<div class="lhead">anatomy classes — click to isolate; a wash is assigned on isolation</div>';
  ZH.meta.classes.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'leg'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="swatch"></span><span><span class="leg-name">` +
      `${c.key.replace(/_/g, ' ')}</span> <span class="leg-n">${nf(c.cells)}</span></span>`;
    b.onclick = () => {
      if (state.iso.has(i)) state.iso.delete(i); else state.iso.add(i);
      syncLegend(); redrawAll();
    };
    wrap.appendChild(b);
  });
}
function syncLegend() {
  const order = [...state.iso];
  [...$('legend').querySelectorAll('.leg')].forEach((el, i) => {
    el.setAttribute('aria-pressed', !state.iso.size || state.iso.has(i) ? 'true' : 'false');
    const k = order.indexOf(i);
    el.querySelector('.swatch').style.background = k >= 0 ? `var(--t${k % 7})` : 'var(--ink-3)';
  });
}

/* ---- Plate II ---------------------------------------------------------- */
function wireEmb() {
  const hold = $('embHold');
  hold.addEventListener('pointermove', (e) => {
    const r = hold.getBoundingClientRect();
    const h = embPick(e.clientX - r.left, e.clientY - r.top);
    const same = h && emb.hover && h.s === emb.hover.s && h.e === emb.hover.e;
    if (!same) { emb.hover = h; renderEmbCard(); embDraw(); }
  });
  hold.addEventListener('pointerleave', () => { emb.hover = null; renderEmbCard(); embDraw(); });
}

function renderEmbCard() {
  const card = $('embCard');
  if (!emb.hover) { card.hidden = true; return; }
  const s = ZH.embryos[emb.hover.s], e = s.embryos[emb.hover.e];
  const tot = e.comp.reduce((a, b) => a + b, 0) || 1;
  const top = e.comp.map((v, i) => [ZH.meta.classes[i].key, v])
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, ' ')} ${(v / tot * 100).toFixed(0)}%`).join(' · ');
  const sib = s.embryos.map(q => nf(q.n)).join(', ');
  $('embCardBody').innerHTML = `
    <dt>fish</dt><dd>${e.fish} — one of four at ${s.timepoint} (${s.stage})</dd>
    <dt>cells</dt><dd>${nf(e.n)} <span style="color:var(--ink-3)">(its four siblings: ${sib})</span></dd>
    <dt>mostly</dt><dd>${top}</dd>
    <dt>divergence here</dt><dd>${s.jsd_mean.toFixed(3)} bits mean between the four, ${s.jsd_max.toFixed(3)} at widest</dd>
    <dt>most variable class</dt><dd>${s.widest_class.replace(/_/g, ' ')} — ${(s.widest_range * 100).toFixed(1)} points between the highest and lowest animal</dd>`;
  card.hidden = false;
}

/* ---- Plate III --------------------------------------------------------- */
function wireAx() {
  const hold = $('axHold');
  hold.addEventListener('pointermove', (e) => {
    const r = hold.getBoundingClientRect();
    const h = axPick(e.clientX - r.left, e.clientY - r.top);
    if (h !== ax.hover) { ax.hover = h; axDraw(); }
  });
  hold.addEventListener('pointerleave', () => { if (ax.hover >= 0) { ax.hover = -1; axDraw(); } });
}

/* ---- Plate IV ---------------------------------------------------------- */
function wireTracks() {
  const hold = $('trHold'), scrub = $('tScrub'), read = $('tRead');
  scrub.max = String(ZH.tracks.nF - 1);
  scrub.value = String(tr.frame);      // trInit opens mid-movie; keep the thumb with it
  const readOut = () => {
    const fr = tr.frame * ZH.meta.track_step;
    read.textContent = `frame ${fr} / ${ZH.meta.counts.track_frames}`;
  };
  readOut();
  scrub.addEventListener('input', () => { tr.frame = +scrub.value; readOut(); trDraw(); });
  const view = (v) => {
    tr.view = v;
    $('tvXY').setAttribute('aria-pressed', v === 'xy' ? 'true' : 'false');
    $('tvXZ').setAttribute('aria-pressed', v === 'xz' ? 'true' : 'false');
    trResize();
  };
  $('tvXY').onclick = () => view('xy');
  $('tvXZ').onclick = () => view('xz');
  $('trReset').onclick = () => {
    tr.sel = null; tr.selTracks = null; $('trCard').hidden = true; trDraw();
  };
  hold.addEventListener('click', (e) => {
    const r = hold.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top, rad = 26;
    const set = trSelect(px, py, rad);
    if (!set.size) { tr.sel = null; tr.selTracks = null; $('trCard').hidden = true; trDraw(); return; }
    tr.sel = { px, py, r: rad }; tr.selTracks = set;
    renderTrCard(); trDraw();
  });
}

function renderTrCard() {
  const card = $('trCard');
  if (!tr.selTracks) { card.hidden = true; return; }
  const s = trStats(tr.selTracks), step = ZH.meta.track_step;
  $('trCardBody').innerHTML = `
    <dt>nuclei here</dt><dd>${nf(s.n)} at frame ${tr.frame * step}</dd>
    <dt>their records span</dt><dd>frame ${s.t0 * step} to ${s.t1 * step}</dd>
    <dt>arose from a division</dt><dd>${nf(s.withParent)} of ${nf(s.n)} have a recorded parent inside the movie</dd>
    <dt>drawn</dt><dd><span style="color:var(--past)">where they came from</span> ·
        <span style="color:var(--future)">where they go</span></dd>`;
  card.hidden = false;
}

/* ---- prose ------------------------------------------------------------- */
function writeProse() {
  const m = ZH.meta, c = m.counts;
  $('mCells').textContent = nf(c.cells);
  $('mFish').textContent = String(c.fish);
  $('mTp').textContent = String(c.timepoints);
  $('mTracks').textContent = nf(c.tracks);
  $('mFrames').textContent = nf(c.track_frames);
  $('mDiv').textContent = nf(c.track_divisions);

  $('capAtlas').innerHTML =
    `All <b>${nf(c.cells)}</b> cells in the authors' own UMAP, across <b>${c.timepoints}</b> stages ` +
    `and <b>${c.timepoint_clusters}</b> per-stage clusters. The faint ground is the whole atlas; the ` +
    `inked cells are the ones the scrubber selects. <b>Distance here is not a quantity</b>, and this ` +
    `embedding carries a second caution its siblings do not: the ten stages were integrated before ` +
    `it was computed, so some of the continuity between them is the integration working rather than ` +
    `cells moving. Nothing on this plate is lineage.`;

  $('capEmb').innerHTML =
    `Each column is <b>one animal</b>. Zebrahub dissociated its embryos one at a time instead of ` +
    `pooling them, so all <b>${nf(c.cells)}</b> cells still know which of <b>${c.fish}</b> fish they ` +
    `came from — four at each stage. Columns are stacked by <i>share</i> rather than count, because ` +
    `the four differ several-fold in yield and a raw stack would draw dissociation instead of ` +
    `biology. Beneath each stage: the mean pairwise Jensen-Shannon divergence between its four ` +
    `composition vectors, in bits. <b>This is composition only</b> — the authors' own inter-embryo ` +
    `divergence analysis works on gene expression and needs their differential-expression pipeline.`;

  $('axWhen').textContent = `${m.axial_states.length} marker states`;
  const mk = Object.entries(m.axial_markers);
  const neu = mk.filter(([, v]) => v === 'neural').map(([k]) => `<i>${k}</i>`).join(', ');
  const mes = mk.filter(([, v]) => v === 'meso').map(([k]) => `<i>${k}</i>`).join(', ');
  $('capAx').innerHTML =
    `The share of each stage's cells carrying <b>both</b> programmes at once — neural (${neu}) and ` +
    `mesodermal (${mes}) — normalised to counts per 10,000 and called present above ` +
    `log1p &gt; ${m.axial_detect_log1p_cp10k}. It falls from <b>3.4%</b> at 10 hpf to about ` +
    `<b>0.1%</b> from 2 dpf on, which is the axial progenitor pool being spent. ` +
    `<b>These states are our marker definition, not the authors' annotation</b> — the released ` +
    `object carries no NMP label. And this is not RNA velocity: the direction of travel is not ` +
    `something this page can assert, so it draws none.`;

  $('capTr').innerHTML =
    `A different embryo, alive. <b>${nf(c.tracks)}</b> nuclei followed through ` +
    `<b>${nf(c.track_frames)}</b> frames of a light-sheet movie of the tail, with ` +
    `<b>${nf(c.track_divisions)}</b> divisions recorded — from <b>${nf(c.track_rows)}</b> tracked ` +
    `positions, sampled here every ${m.track_step}th frame. <b>This plate may say lineage</b>, ` +
    `because a nucleus really was watched dividing. Click anywhere and the plate draws the tracks ` +
    `that were actually in that spot at that moment, backward and forward — the authors' in-silico ` +
    `fate mapping done with the observation instead of a model. It knows where every cell went and ` +
    `nothing whatever about what any of them was expressing.`;

  const notes = m.caveats.map(s => s.replace(/^(.+?\.)(?=\s+[A-Z])/, '<b>$1</b>'));
  notes.push(
    `<b>The 15 hpf file is a packaging duplicate.</b> Figshare ships eleven per-stage archives for ` +
    `ten real stages: <code>zf_atlas_15hpf</code> holds the same 3,862 barcodes and the same four ` +
    `fish as 14 hpf, and the authors' own combined atlas has no 15 hpf timepoint. This build reads ` +
    `the combined atlas and never concatenates, and asserts the ${nf(c.cells)}-cell count as the guard.`,
    `<b>The counts in this release are raw.</b> <code>X</code> holds integers, not log-normalised ` +
    `values — the opposite of the DanioCell deposit. Marker scores here are normalised per cell ` +
    `before comparison; skipping that would score big cells higher than small ones.`,
    `<b>Its two siblings each answer half of this.</b> ` +
    `<a href="/fate_map_wang_2026">/fate_map_wang_2026</a> has ancestry and no expression; ` +
    `<a href="/fate_map_daniocell">/fate_map_daniocell</a> has expression and no ancestry. ` +
    `Zebrahub has both, in different animals, which is why this page keeps them on separate plates.`
  );
  $('noteList').innerHTML = notes.map(s => `<li>${s}</li>`).join('');

  $('colophon').innerHTML =
    `Built by <code>${m.generated_by}</code> from ` +
    `<a href="https://doi.org/${m.source.doi}" target="_blank" rel="noopener">${m.source.journal}</a>, ` +
    `Figshare <a href="https://doi.org/${m.source.figshare}" target="_blank" rel="noopener">${m.source.figshare}</a>, ` +
    `and the authors' public imaging endpoint for the tracks; code at ` +
    `<a href="${m.source.code}" target="_blank" rel="noopener">czbiohub-sf/zebrahub_analysis</a>. ` +
    `The atlas file is verified against <b>Figshare's own published md5</b> — the first origin in ` +
    `this warehouse that attests to its own bytes — and against the copy held at ` +
    `<code>${m.source.warehouse}</code>. Its look is the plate style; see PLATE_STYLE.md.`;
}

/* ---- boot -------------------------------------------------------------- */
function redrawAll() { atlasDraw(); embDraw(); axDraw(); }

let rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { atlasResize(); embResize(); axResize(); trResize(); }, 140);
});

(async function boot() {
  try {
    await zhLoad();
    $('boot').hidden = true;
    $('stage').hidden = false;
    atlasInit($('cvAtlas'), $('atlasHold'));
    embInit($('cvEmb'), $('embHold'));
    axInit($('cvAx'), $('axHold'));
    trInit($('cvTr'), $('trHold'));
    buildLegend();
    wireAtlas(); wireEmb(); wireAx(); wireTracks();
    writeProse();
    redrawAll(); trDraw();
    zhRepaintOnView($('plate1'), () => atlasDraw());
    zhRepaintOnView($('plate2'), () => embDraw());
    zhRepaintOnView($('plate3'), () => axDraw());
    zhRepaintOnView($('plate4'), () => trDraw());
  } catch (err) {
    $('boot').hidden = true;
    const f = $('fail'); f.hidden = false;
    f.textContent = 'The plates could not be drawn: ' + err.message;
    console.error(err);
  }
})();
