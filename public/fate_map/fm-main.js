/* /fate_map — bootstrap, interaction and the written matter.
 *
 * Every number printed on this page is read out of meta.json, which the build
 * script writes in the same pass that writes the binaries. Nothing here is a
 * literal. If a figure in the prose looks stale, rebuild; do not retype it.
 */
'use strict';

const state = {
  iso: new Set(),      // territories to isolate; empty means show them all
  founder: -1,
  segs: null,
  tipLat: [], tipLon: [],
  geomFirst: null, geomFinal: null,
};

const $ = (id) => document.getElementById(id);
const nf = (n) => n.toLocaleString('en-US');

function setSelection(segs, founder) {
  state.segs = segs && segs.size ? segs : null;
  state.founder = founder;
  state.tipLat = []; state.tipLon = [];
  const f = FM.flow;
  if (state.segs) {
    for (const s of state.segs) {
      if (f.kidOff[s + 1] - f.kidOff[s] > 0) continue;      // not a tip
      const i = f.off[s] + f.len[s] - 1;
      state.tipLat.push(f.lat[i]); state.tipLon.push(f.lon[i]);
    }
  }
  redrawAll();
  renderCard();
}

function redrawAll() {
  drawFirstPlate($('cvFirst'), state);
  drawFinalPlate($('cvFinal'), state);
  flowDraw(state);
}

function renderCard() {
  const card = $('card');
  if (!state.segs) { card.hidden = true; return; }
  const f = FM.flow, fd = FM.founders, T = FM.meta.territories;
  const fi = state.founder >= 0 ? state.founder : f.founder[state.segs.values().next().value];
  let divisions = 0, tips = 0;
  const terrs = new Map();
  for (const s of state.segs) {
    if (f.kidOff[s + 1] - f.kidOff[s] >= 2) divisions++;
    else if (f.kidOff[s + 1] - f.kidOff[s] === 0) {
      tips++;
      const t = flow.segTerr[s];
      terrs.set(t, (terrs.get(t) || 0) + 1);
    }
  }
  const lat = (fd.lat[fi] / 100).toFixed(1), lon = (fd.lon[fi] / 100).toFixed(1);
  const where = [...terrs.entries()].sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${T[t].label} (${n})`).join(', ') || '—';
  $('cardBody').innerHTML = `
    <dt>founder</dt><dd>#${fi} of ${nf(fd.n)}</dd>
    <dt>at 5.5 hpf</dt><dd>${lat}° from the animal pole, ${lon}° from the dorsal meridian</dd>
    <dt>divisions</dt><dd>${divisions} on this path</dd>
    <dt>cells at 11.3 hpf</dt><dd>${tips}</dd>
    <dt>ending in</dt><dd>${where}</dd>`;
  card.hidden = false;
}

function buildLegend() {
  const wrap = $('legend'), T = FM.meta.territories;
  wrap.innerHTML = '';
  const head = document.createElement('div');
  head.style.cssText = 'grid-column:1/-1;font-family:var(--sans);font-size:10px;' +
    'letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px';
  head.textContent = 'territories at 11.3 hpf — click to isolate';
  wrap.appendChild(head);
  T.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'leg';
    b.setAttribute('aria-pressed', 'true');
    b.innerHTML =
      `<span class="swatch" style="background:var(--t${i})"></span>` +
      `<span><span class="leg-name">${t.label}</span> ` +
      `<span style="color:var(--ink-3)">${nf(t.cells)}</span>` +
      (t.classical ? `<span class="leg-note">${t.classical}</span>` : '') +
      `</span>`;
    b.onclick = () => {
      if (state.iso.has(i)) state.iso.delete(i); else state.iso.add(i);
      [...wrap.querySelectorAll('.leg')].forEach((el, j) =>
        el.setAttribute('aria-pressed',
          !state.iso.size || state.iso.has(j) ? 'true' : 'false'));
      redrawAll();
    };
    wrap.appendChild(b);
  });
}

function writeProse() {
  const m = FM.meta, c = m.counts;
  $('mCites').innerHTML =
    `<a href="https://doi.org/${m.source.doi}" target="_blank" rel="noopener">ITEC</a>`;
  $('mSpots').textContent = (c.spots_released / 1e6).toFixed(1) + ' million';
  $('mFrames').textContent = nf(m.integrity.released_frames);

  $('capFirst').innerHTML =
    `Every one of the <b>${nf(c.cells_first_frame)}</b> cells the reconstruction holds at ` +
    `5.5 hpf, seen down the animal pole. Radius is angle from that pole, so the solid ` +
    `circle is the equator — at this stage the blastoderm stops there, which is what ` +
    `<i>50% epiboly</i> means. <b>${nf(c.founders_with_descendants)}</b> of these cells ` +
    `have descendants that can still be followed at 11.3 hpf; they are tinted by where ` +
    `those descendants end, and sized by how many there are. The rest are left as bare ` +
    `ink. <i>This plate is the fate map.</i>`;

  $('capFlow').innerHTML =
    `<b>${nf(c.segments)}</b> unbranched runs of tracked nuclei, carrying ` +
    `<b>${nf(c.founders_with_descendants)}</b> lineages from 5.5 hpf to 11.3 hpf through ` +
    `<b>${nf(c.branch_points)}</b> divisions. Each stroke is one nucleus followed frame to ` +
    `frame; a fork is a division. Drawn in one ink, the density is the picture: the whole ` +
    `sheet sweeps toward the vegetal pole, which is epiboly. <b>Click a territory in the ` +
    `legend above</b> to lift just those lineages out of the mass and see where in the ` +
    `blastula they started — that comparison, not the crowd, is the fate map's claim. ` +
    `Switch the axis to <i>dorsal and ventral</i> to watch convergence instead.`;

  $('capFinal').innerHTML =
    `All <b>${nf(c.cells_last_frame)}</b> cells at 11.3 hpf in the same projection and at ` +
    `the same scale as Plate I. Epiboly is complete: the sheet now reaches the vegetal ` +
    `pole and fills the disc. The dorsal midline is the crowded meridian at right — the ` +
    `build fits it from the data, where it stands out <b>3.4&times;</b> above the mean ` +
    `by the last frame against <b>1.2&times;</b> at the first.`;

  const notes = $('noteList');
  const extra = [
    `<b>The territories are geometry, not anatomy.</b> They are regions of the fitted ` +
    `sphere cut at fixed angles, named for where they sit. The authors did hand-segment ` +
    `eyes, brain, somites and tail bud at their last frame, but those labels are not in ` +
    `the public deposit, so no organ is named here. The italic glosses in the legend are ` +
    `pointers to the classical fate map, not claims about these cells.`,
    `<b>Which flank is left and which is right is not knowable here.</b> The deposited ` +
    `coordinates fix the animal–vegetal axis and, through convergence, the dorsal ` +
    `meridian; they do not orient the embryo's left-right axis. Both flanks are labelled ` +
    `<i>flank</i>.`,
    `<b>The dorsoventral axis is barely readable at the start.</b> At 5.5 hpf longitude ` +
    `predicts fate only weakly — the dorsal organiser is not visible until the shield, ` +
    `half an hour into this window. Latitude at 5.5 hpf is the coordinate that carries ` +
    `the signal, and it orders fates from the animal pole to the margin as the classical ` +
    `map does.`,
  ];
  // Bold the opening sentence of each caveat. The period must be followed by
  // whitespace and a capital, or a decimal like "99.7%" ends the sentence early.
  notes.innerHTML = extra.concat(m.caveats.map(s => s.replace(
    /^(.+?\.)(?=\s+[A-Z])/, '<b>$1</b>'))).map(s => `<li>${s}</li>`).join('');

  $('colophon').innerHTML =
    `Built by <code>scripts/build_fate_map.py</code> from ` +
    `<a href="https://doi.org/${m.source.data_doi}" target="_blank" rel="noopener">${m.source.data_name}</a> ` +
    `(${m.source.files.join(', ')}), the deposit accompanying ` +
    `<a href="https://doi.org/${m.source.doi}" target="_blank" rel="noopener">Wang et al. 2026</a> ` +
    `(CC-BY); code at <a href="${m.source.code}" target="_blank" rel="noopener">yu-lab-vt/ITEC</a>. ` +
    `Dataset ${m.source.dataset}. Time is linear in frame at ` +
    `${m.window.seconds_per_frame} s per frame; stage names are Kimmel et al. 1995 at 28.5 °C. ` +
    `Sphere fitted at radius ${m.geometry.radius} px with the dorsal meridian at ` +
    `${m.geometry.dorsal_meridian_deg}°. The plates are drawn from ` +
    `${nf(m.counts.links_in_window)} single-frame links; the pen wobble on the rules is ` +
    `decoration, and no data mark is jittered.`;
}

function wireFlow() {
  const hold = $('flowHold'), cv = $('cvFlow');
  let dragging = false, moved = false, lx = 0, ly = 0;

  hold.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; lx = e.clientX; ly = e.clientY;
    hold.classList.add('dragging'); hold.setPointerCapture(e.pointerId);
  });
  hold.addEventListener('pointermove', (e) => {
    const r = hold.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      lx = e.clientX; ly = e.clientY;
      flowPan(dx, dy, state);
      return;
    }
    const s = flowPick(e.clientX - r.left, e.clientY - r.top);
    if (s !== flow.hover) { flow.hover = s; flowDraw(state); }
    hold.style.cursor = s >= 0 ? 'pointer' : 'grab';
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false; hold.classList.remove('dragging');
    hold.style.cursor = 'grab';
    if (moved) return;
    const r = hold.getBoundingClientRect();
    const s = flowPick(e.clientX - r.left, e.clientY - r.top);
    if (s >= 0) setSelection(fmLineageOf(s), FM.flow.founder[s]);
    else setSelection(null, -1);
  };
  hold.addEventListener('pointerup', end);
  hold.addEventListener('pointercancel', () => { dragging = false; hold.classList.remove('dragging'); });
  hold.addEventListener('pointerleave', () => { if (flow.hover >= 0) { flow.hover = -1; flowDraw(state); } });

  hold.addEventListener('wheel', (e) => {
    const r = hold.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < MARGIN.l || px > flow.W - MARGIN.r) return;      // gutters scroll the page
    e.preventDefault();
    flowZoom(Math.pow(0.999, e.deltaY), px, py, state);
  }, { passive: false });

  $('btnReset').onclick = () => { flowReset(state); setSelection(null, -1); };
  $('cardClose').onclick = () => setSelection(null, -1);

  const axLat = $('axLat'), axLon = $('axLon');
  const setAxis = (which) => {
    flowSetAxis(which);
    axLat.setAttribute('aria-pressed', which === 'lat' ? 'true' : 'false');
    axLon.setAttribute('aria-pressed', which === 'lon' ? 'true' : 'false');
    flowDraw(state);
  };
  axLat.onclick = () => setAxis('lat');
  axLon.onclick = () => setAxis('lon');
}

function wirePlates() {
  const cv = $('cvFirst');
  cv.style.cursor = 'crosshair';
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const fi = pickFounder(state, e.clientX - r.left, e.clientY - r.top);
    if (fi >= 0) setSelection(fmFounderSegs(fi), fi);
    else setSelection(null, -1);
  });
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { flowResize(state); redrawAll(); }, 120);
});

(async function boot() {
  try {
    await fmLoad();
    $('boot').hidden = true;
    $('stage').hidden = false;
    writeProse();
    buildLegend();
    flowInit($('cvFlow'), $('flowHold'), state);
    wireFlow();
    wirePlates();
    redrawAll();
  } catch (err) {
    $('boot').hidden = true;
    const f = $('fail');
    f.hidden = false;
    f.textContent = 'The plates could not be drawn: ' + err.message;
    console.error(err);
  }
})();
