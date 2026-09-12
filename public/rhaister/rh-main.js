/* /rhaister — three figures, all quantitative marks from generated JSON. */
'use strict';

const RH = { meta: null, plates: null, manifest: null };
const $ = (id) => document.getElementById(id);
const D = window.RHD;
const { C, serif, sans } = D;

function num(value, digits = 3) {
  return Number(value).toFixed(digits);
}

function sci(value) {
  const [mantissa, exponent] = Number(value).toExponential(2).split('e');
  return `${mantissa} × 10<sup>${Number(exponent)}</sup>`;
}

async function load() {
  const [metaResponse, platesResponse, manifestResponse] = await Promise.all([
    fetch('/rhaister/meta.json', { cache: 'no-store' }),
    fetch('/rhaister/plates.json', { cache: 'no-store' }),
    fetch('/rhaister/exhibits/manifest.json', { cache: 'no-store' }),
  ]);
  for (const response of [metaResponse, platesResponse, manifestResponse]) {
    if (!response.ok) throw new Error(`could not load ${response.url} (${response.status})`);
  }
  [RH.meta, RH.plates, RH.manifest] = await Promise.all([
    metaResponse.json(),
    platesResponse.json(),
    manifestResponse.json(),
  ]);
  const versions = [RH.meta.asset_version, RH.plates.asset_version, RH.manifest.asset_version];
  if (new Set(versions).size !== 1) throw new Error(`asset versions disagree: ${versions.join(' / ')}`);
  if (RH.plates.example.points.length !== RH.meta.split.genes) throw new Error('example point count disagrees with meta.json');
  if (RH.plates.compass.points.length !== RH.meta.compass.matched) throw new Error('COMPASS point count disagrees with meta.json');
}

function responseGlyph(svg, x, y, width, height, values, color, opacity = 1) {
  D.line(svg, x, y + height / 2, x + width, y + height / 2, { stroke: C.light, 'stroke-width': .7 });
  const points = values.map((value, index) => [
    x + (index / (values.length - 1)) * width,
    y + height / 2 - value * height * .34,
  ]);
  D.path(svg, D.polylinePath(points), {
    stroke: color,
    'stroke-width': 1.7,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    opacity,
  });
}

function drawMethodFlow() {
  const box = $('methodFlow');
  const mobile = box.clientWidth < 540;
  const width = Math.max(300, Math.round(box.clientWidth));
  const height = mobile ? 470 : 420;
  const svg = D.svg(box, width, height, 'Observed panel responses become a weighted prediction');
  const waves = [
    [-.2,.4,.1,.8,.25,-.35,-.6,.05,.5,.18],
    [.5,.25,-.15,-.6,-.22,.35,.7,.2,-.18,-.35],
    [-.35,-.55,.05,.25,.68,.35,-.1,-.45,.1,.42],
    [.1,.55,.7,.2,-.2,-.1,.15,.5,.3,-.15],
  ];

  if (!mobile) {
    const thirds = [24, width * .38, width * .72];
    D.caps(svg, thirds[0], 42, '1 · observe', { fill: C.madder });
    D.caps(svg, thirds[1], 42, '2 · weight');
    D.caps(svg, thirds[2], 42, '3 · predict', { fill: C.madder });

    D.text(svg, thirds[0], 65, 'new context', { 'font-size': 17, 'font-style': 'italic' });
    waves.forEach((wave, index) => {
      const y = 90 + index * 55;
      D.rect(svg, thirds[0], y, Math.min(165, width * .25), 39, { stroke: C.light, fill: C.paperHi });
      responseGlyph(svg, thirds[0] + 10, y + 5, Math.min(145, width * .22), 29, wave, C.ink2);
      D.text(svg, thirds[0] + Math.min(165, width * .25) + 8, y + 24, `p${index + 1}`, {
        'font-size': 11, fill: C.ink3, 'font-family': sans,
      });
    });
    D.text(svg, thirds[0], 325, `${RH.meta.split.observed_panel} observed responses`, {
      'font-size': 13, fill: C.ink2,
    });
    D.arrow(svg, width * .305, 189, width * .36, 189);

    D.text(svg, thirds[1], 65, 'shared ridge weights', { 'font-size': 17, 'font-style': 'italic' });
    const weights = [.62,.33,-.27,.14];
    weights.forEach((weight, index) => {
      const y = 99 + index * 50;
      D.text(svg, thirds[1], y + 5, `w${index + 1}`, { 'font-size': 11, fill: C.ink3, 'font-family': sans });
      const zero = thirds[1] + Math.min(75, width * .105);
      D.line(svg, zero, y - 11, zero, y + 10, { stroke: C.rule });
      D.rect(svg, Math.min(zero, zero + weight * 92), y - 7, Math.abs(weight * 92), 13, {
        fill: weight > 0 ? C.teal : C.blue,
      });
    });
    D.multiline(svg, thirds[1], 319, ['learned across', `${RH.meta.split.reference_contexts} reference contexts`], {
      'font-size': 13, fill: C.ink2, 'font-style': 'italic',
    }, 17);
    D.arrow(svg, width * .65, 189, width * .70, 189);

    const rightWidth = Math.max(125, width - thirds[2] - 26);
    D.text(svg, thirds[2], 65, 'unseen perturbation', { 'font-size': 17, 'font-style': 'italic' });
    D.rect(svg, thirds[2], 104, rightWidth, 168, {
      stroke: C.madder, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', fill: 'rgba(151,56,32,.025)',
    });
    const combined = waves[0].map((_, index) => (
      .62 * waves[0][index] + .33 * waves[1][index] - .27 * waves[2][index] + .14 * waves[3][index]
    ));
    responseGlyph(svg, thirds[2] + 15, 143, rightWidth - 30, 95, combined, C.madder);
    D.text(svg, thirds[2] + rightWidth / 2, 298, `${RH.meta.split.held_out} held out`, {
      'font-size': 13, fill: C.madder, 'text-anchor': 'middle',
    });
    D.caps(svg, width - 20, height - 20, 'schematic · response profiles, not cells', {
      'text-anchor': 'end', 'font-size': 8,
    });
    return;
  }

  const center = width / 2;
  D.caps(svg, 20, 40, '1 · observe', { fill: C.madder });
  D.text(svg, 20, 63, `${RH.meta.split.observed_panel} responses in the new context`, { 'font-size': 16, 'font-style': 'italic' });
  waves.slice(0, 3).forEach((wave, index) => {
    const y = 80 + index * 44;
    D.rect(svg, 20, y, width - 40, 32, { stroke: C.light, fill: C.paperHi });
    responseGlyph(svg, 31, y + 3, width - 62, 26, wave, C.ink2);
  });
  D.arrow(svg, center, 215, center, 244);
  D.caps(svg, 20, 260, '2 · learn shared weights');
  const zero = center;
  [.62,.33,-.27].forEach((weight, index) => {
    const y = 285 + index * 28;
    D.line(svg, zero, y - 7, zero, y + 8, { stroke: C.rule });
    D.rect(svg, Math.min(zero, zero + weight * 100), y - 5, Math.abs(weight * 100), 10, {
      fill: weight > 0 ? C.teal : C.blue,
    });
  });
  D.text(svg, 20, 374, `fit across ${RH.meta.split.reference_contexts} reference contexts`, {
    'font-size': 13, fill: C.ink2, 'font-style': 'italic',
  });
  D.arrow(svg, center, 383, center, 406);
  D.caps(svg, 20, 430, `3 · predict ${RH.meta.split.held_out} held-out responses`, { fill: C.madder });
  responseGlyph(svg, 28, 440, width - 56, 25, [.1,.52,.18,-.38,.12,.58,.31,-.2,.08,.4], C.madder);
}

function drawScorePanel() {
  const m = RH.meta;
  const paper = m.reproduction.paper_pearson;
  const ours = m.reproduction.ours.pearson_delta;
  const min = .38;
  const max = .45;
  const pct = (value) => ((value - min) / (max - min)) * 100;
  const components = RH.plates.components;
  const lo = Math.min(...components.map((row) => row.value));
  const hi = Math.max(...components.map((row) => row.value));
  $('scorePanel').innerHTML = `
    <div class="panel-title">A · Paper result versus ours</div>
    <div class="score-pair">
      <div class="score-line"><span class="score-name">Paper · four-split mean</span><span class="score-value">${num(paper, 3)}</span></div>
      <div class="score-line"><span class="score-name">Our canonical split_0</span><span class="score-value ours">${num(ours, 3)}</span></div>
      <div class="match-axis" aria-hidden="true">
        <i class="paper-dot" style="left:${pct(paper)}%"></i>
        <i class="ours-dot" style="left:${pct(ours)}%"></i>
      </div>
      <div class="match-note">Pearson Δ · ring = published aggregate · red = our single split</div>
    </div>
    <ul class="component-list">
      ${components.map((row) => `<li><span>${row.label}</span><span class="component-bar"><i style="width:${12 + ((row.value - lo) / (hi - lo)) * 88}%"></i></span><b>${num(row.value, 3)}</b></li>`).join('')}
    </ul>
    <div class="integrity">Independent reconstruction agrees to <strong>${sci(m.reproduction.reconstruction_max_abs_error)}</strong> maximum absolute error.</div>
  `;
}

function drawExample() {
  const box = $('examplePlot');
  const width = Math.max(280, Math.round(box.clientWidth - 36));
  const height = Math.max(350, box.clientHeight - 36);
  const svg = D.svg(box, width, height, 'Observed versus predicted RABGGTA response');
  const points = RH.plates.example.points;
  const margin = { left: 52, right: 16, top: 52, bottom: 50 };
  const values = points.flatMap((point) => [point.observed, point.predicted]);
  const bound = Math.ceil(Math.max(...values.map(Math.abs)) * 5) / 5;
  const x = D.scale(-bound, bound, margin.left, width - margin.right);
  const y = D.scale(-bound, bound, height - margin.bottom, margin.top);
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  D.caps(svg, 0, 12, 'B · one real held-out response');
  D.text(svg, 0, 38, 'RABGGTA', { 'font-size': 24, 'font-style': 'italic' });
  D.text(svg, width, 36, `r = ${num(RH.meta.reproduction.example.pearson_full, 3)}`, {
    'font-size': 17, fill: C.madder, 'text-anchor': 'end',
  });
  [-1, -.5, 0, .5, 1].filter((tick) => Math.abs(tick) <= bound).forEach((tick) => {
    D.line(svg, x(tick), margin.top, x(tick), height - margin.bottom, { stroke: C.light, 'stroke-width': .55 });
    D.line(svg, margin.left, y(tick), width - margin.right, y(tick), { stroke: C.light, 'stroke-width': .55 });
    D.text(svg, x(tick), height - margin.bottom + 19, tick.toFixed(1), {
      'font-size': 10, 'font-family': sans, fill: C.ink3, 'text-anchor': 'middle',
    });
    D.text(svg, margin.left - 8, y(tick) + 3, tick.toFixed(1), {
      'font-size': 10, 'font-family': sans, fill: C.ink3, 'text-anchor': 'end',
    });
  });
  D.line(svg, x(-bound), y(-bound), x(bound), y(bound), {
    stroke: C.ink3, 'stroke-width': 1, 'stroke-dasharray': '4 4',
  });
  D.rect(svg, margin.left, margin.top, plotW, plotH, { stroke: C.ink, 'stroke-width': .8 });
  const pointGroup = D.group(svg, { opacity: .34 });
  points.forEach((point) => D.circle(pointGroup, x(point.observed), y(point.predicted), 1.55, {
    fill: C.teal, stroke: 'none',
  }));
  const labels = ['NEAT1', 'MALAT1', 'STMN1', 'TUBA1B'];
  labels.forEach((gene) => {
    const point = points.find((row) => row.gene === gene);
    if (!point) return;
    D.circle(svg, x(point.observed), y(point.predicted), 2.6, { fill: C.madder });
    const left = point.observed > .55;
    D.text(svg, x(point.observed) + (left ? -5 : 5), y(point.predicted) - 5, gene, {
      'font-size': 9.5, 'font-family': sans, fill: C.ink2, 'text-anchor': left ? 'end' : 'start',
    });
  });
  D.text(svg, margin.left + plotW / 2, height - 10, 'observed HepG2 Δ', {
    'font-size': 11, 'font-family': sans, fill: C.ink2, 'text-anchor': 'middle',
  });
  D.text(svg, 13, margin.top + plotH / 2, 'predicted HepG2 Δ', {
    'font-size': 11, 'font-family': sans, fill: C.ink2, 'text-anchor': 'middle',
    transform: `rotate(-90 13 ${margin.top + plotH / 2})`,
  });
}

function drawWeights() {
  const box = $('weightsPlot');
  const width = Math.max(230, Math.round(box.clientWidth - 36));
  const height = Math.max(190, box.clientHeight - 36);
  const svg = D.svg(box, width, height, 'Largest measured-panel ridge weights for RABGGTA');
  const wideShort = width > 500 && height < 300;
  const rows = RH.plates.example.weights.slice(0, wideShort ? 8 : 9);
  const margin = { left: wideShort ? 75 : Math.min(82, width * .34), right: 17, top: 51, bottom: 19 };
  const max = Math.max(...rows.map((row) => Math.abs(row.value)));
  const zero = D.scale(-max, max, margin.left, width - margin.right)(0);
  const x = D.scale(-max, max, margin.left, width - margin.right);
  const rowH = (height - margin.top - margin.bottom) / rows.length;

  D.caps(svg, 0, 12, 'C · measured contributors');
  D.text(svg, 0, 37, 'Ridge weights', { 'font-size': 20, 'font-style': 'italic' });
  D.line(svg, zero, margin.top - 5, zero, height - margin.bottom + 2, { stroke: C.ink, 'stroke-width': .8 });
  rows.forEach((row, index) => {
    const cy = margin.top + (index + .5) * rowH;
    D.text(svg, margin.left - 7, cy + 3.5, row.treatment, {
      'font-size': wideShort ? 9 : 10.5,
      'font-family': sans,
      fill: C.ink2,
      'text-anchor': 'end',
    });
    D.rect(svg, Math.min(zero, x(row.value)), cy - Math.max(3, rowH * .23), Math.abs(x(row.value) - zero), Math.max(6, rowH * .46), {
      fill: row.value > 0 ? C.teal : C.blue,
      opacity: .88,
    });
  });
  D.text(svg, zero, height - 3, '0', {
    'font-size': 9, 'font-family': sans, fill: C.ink3, 'text-anchor': 'middle',
  });
}

function drawTitration() {
  const box = $('titrationPlot');
  const width = Math.max(300, Math.round(box.clientWidth));
  const height = Math.max(430, box.clientHeight);
  const svg = D.svg(box, width, height, 'Panel-size titration across ten nested repeats');
  const summary = RH.plates.titration.summary;
  const raw = RH.plates.titration.raw;
  const sizes = summary.map((row) => row.k);
  const margin = { left: width < 480 ? 51 : 64, right: 14, top: 39, bottom: 66 };
  const xAt = (k) => {
    const index = sizes.indexOf(k);
    return margin.left + (index / (sizes.length - 1)) * (width - margin.left - margin.right);
  };
  const yMin = .20;
  const yMax = .44;
  const y = D.scale(yMin, yMax, height - margin.bottom, margin.top);
  const plotRight = width - margin.right;
  const plotBottom = height - margin.bottom;

  D.caps(svg, margin.left, 13, 'Mean held-out Pearson Δ · random nested panels');
  [.20,.25,.30,.35,.40].forEach((tick) => {
    D.line(svg, margin.left, y(tick), plotRight, y(tick), { stroke: C.light, 'stroke-width': .65 });
    D.text(svg, margin.left - 8, y(tick) + 3.5, tick.toFixed(2), {
      'font-size': 10, 'font-family': sans, fill: C.ink3, 'text-anchor': 'end',
    });
  });
  const visibleTicks = width < 480 ? new Set([1, 4, 16, 64, 256, 395]) : new Set(sizes);
  sizes.forEach((k) => {
    D.line(svg, xAt(k), plotBottom, xAt(k), plotBottom + 5, { stroke: C.ink });
    if (visibleTicks.has(k)) D.text(svg, xAt(k), plotBottom + 20, String(k), {
      'font-size': 9.5, 'font-family': sans, fill: C.ink3, 'text-anchor': 'middle',
    });
  });
  D.line(svg, margin.left, plotBottom, plotRight, plotBottom, { stroke: C.ink, 'stroke-width': .9 });
  D.line(svg, margin.left, margin.top, margin.left, plotBottom, { stroke: C.ink, 'stroke-width': .9 });

  const canonical = RH.meta.thresholds.canonical_additive;
  D.line(svg, margin.left, y(canonical), plotRight, y(canonical), {
    stroke: C.blue, 'stroke-width': 1.1, 'stroke-dasharray': '5 4',
  });
  D.text(svg, margin.left + 5, y(canonical) - 6, 'full-panel additive', {
    'font-size': 9.5, 'font-family': sans, fill: C.blue, 'text-anchor': 'start',
  });

  for (let repeat = 0; repeat < RH.meta.thresholds.repeats; repeat += 1) {
    const rows = raw.filter((row) => row.repeat === repeat).sort((a, b) => sizes.indexOf(a.k) - sizes.indexOf(b.k));
    D.path(svg, D.polylinePath(rows.map((row) => [xAt(row.k), y(row.pearson)])), {
      stroke: C.ink3, 'stroke-width': .75, opacity: .18,
    });
  }
  const bandTop = summary.filter((row) => row.high !== null).map((row) => [xAt(row.k), y(row.high)]);
  const bandBottom = summary.filter((row) => row.low !== null).map((row) => [xAt(row.k), y(row.low)]);
  D.path(svg, D.areaPath(bandTop, bandBottom), { fill: C.teal, opacity: .12, stroke: 'none' });
  D.path(svg, D.polylinePath(summary.map((row) => [xAt(row.k), y(row.pearson)])), {
    stroke: C.teal, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
  });
  summary.forEach((row) => D.circle(svg, xAt(row.k), y(row.pearson), 3.1, {
    fill: C.paperHi, stroke: C.teal, 'stroke-width': 1.7,
  }));

  const marks = [
    { k: RH.meta.thresholds.first_useful, label: 'first useful', align: 'start', dx: 5 },
    { k: RH.meta.thresholds.half_gain, label: '½ gain', align: 'end', dx: -5 },
    { k: RH.meta.thresholds.near_saturation, label: '90% gain', align: 'end', dx: -4 },
  ];
  marks.forEach((mark, index) => {
    const xx = xAt(mark.k);
    D.line(svg, xx, margin.top + 22 + index * 15, xx, plotBottom, {
      stroke: C.madder, 'stroke-width': .75, 'stroke-dasharray': '2 3', opacity: .75,
    });
    D.caps(svg, xx + mark.dx, margin.top + 16 + index * 15, `K=${mark.k} · ${mark.label}`, {
      fill: C.madder, 'text-anchor': mark.align, 'font-size': width < 480 ? 7 : 8,
    });
  });
  D.text(svg, margin.left + (plotRight - margin.left) / 2, height - 19, 'measured HepG2 panel perturbations', {
    'font-size': 11, 'font-family': sans, fill: C.ink2, 'text-anchor': 'middle',
  });
  D.text(svg, 13, margin.top + (plotBottom - margin.top) / 2, 'prediction quality', {
    'font-size': 11, 'font-family': sans, fill: C.ink2, 'text-anchor': 'middle',
    transform: `rotate(-90 13 ${margin.top + (plotBottom - margin.top) / 2})`,
  });
}

function drawCompass() {
  const box = $('compassPlot');
  const width = Math.max(210, Math.round(box.clientWidth));
  const height = Math.max(120, box.clientHeight);
  const svg = D.svg(box, width, height, 'COMPASS shared-response fraction and Rhaister predictability');
  const points = RH.plates.compass.points;
  const margin = { left: 27, right: 8, top: 15, bottom: 25 };
  const x = D.scale(0, .85, margin.left, width - margin.right);
  const y = D.scale(-.4, 1, height - margin.bottom, margin.top);
  D.line(svg, margin.left, height - margin.bottom, width - margin.right, height - margin.bottom, { stroke: C.ink, 'stroke-width': .7 });
  D.line(svg, margin.left, margin.top, margin.left, height - margin.bottom, { stroke: C.ink, 'stroke-width': .7 });
  const group = D.group(svg, { opacity: .17 });
  points.forEach((point) => D.circle(group, x(point.shared), y(point.pearson), 1.2, { fill: C.teal }));
  const bins = Array.from({ length: 8 }, (_, index) => {
    const lo = index * .1;
    const rows = points.filter((point) => point.shared >= lo && point.shared < lo + .1);
    if (!rows.length) return null;
    const mean = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
    return [x(mean('shared')), y(mean('pearson'))];
  }).filter(Boolean);
  D.path(svg, D.polylinePath(bins), { stroke: C.madder, 'stroke-width': 1.7 });
  bins.forEach((point) => D.circle(svg, point[0], point[1], 2.2, { fill: C.madder }));
  D.text(svg, width - margin.right, 12, `ρ = ${num(RH.meta.compass.accuracy_rho, 2)}`, {
    'font-size': 11, 'font-family': sans, fill: C.madder, 'text-anchor': 'end',
  });
  D.text(svg, margin.left + (width - margin.right - margin.left) / 2, height - 5, 'shared-response fraction', {
    'font-size': 9, 'font-family': sans, fill: C.ink3, 'text-anchor': 'middle',
  });
}

function populateText() {
  const m = RH.meta;
  $('caption1').innerHTML = `<strong>The released split:</strong> ${m.split.observed_panel} measured HepG2 responses support ${m.split.held_out} held-out predictions across ${m.split.genes.toLocaleString()} genes. Its ridge basis also includes ${m.split.imputed_basis_terms} additive-imputed responses; it is not a pure measured-panel model.`;
  $('caption2').innerHTML = `<strong>Consistent, not like-for-like:</strong> the paper’s ${num(m.reproduction.paper_pearson, 2)} is a four-split mean; ours is one exact split. RABGGTA was chosen before inspection because its gain was closest to the median—not because it was a best case.`;
  $('caption3').innerHTML = `Ten random nested panels; mean and 95% t interval in teal, repeats in grey. At K=${m.thresholds.clear_canonical_additive}, the interval first clears the full-panel additive score. “Half” and “90%” refer to the attainable additive-to-full Rhaister gain, not a biological ceiling; the public release has no A/B ceiling for this screen.`;
  $('thresholds').innerHTML = `
    <div class="threshold"><span class="k">${m.thresholds.first_useful}</span><span><b>First useful</b><span>Ridge gain is reliably above its matching additive fit.</span></span></div>
    <div class="threshold"><span class="k">${m.thresholds.half_gain}</span><span><b>≈50% of gain</b><span>Half of the full-panel uplift beyond canonical additive.</span></span></div>
    <div class="threshold"><span class="k">${m.thresholds.near_saturation}</span><span><b>Near saturation</b><span>90% of that uplift needs the complete tested panel.</span></span></div>
  `;
  $('compassNote').textContent = `Shared responses are easier to predict (ρ=${num(m.compass.accuracy_rho, 2)}), but do not independently need smaller panels (partial ρ=${num(m.compass.panel_k50_partial_rho, 2)}; p=${num(m.compass.panel_k50_partial_p, 2)}).`;
  $('provenanceGrid').innerHTML = `
    <p><strong>Scope.</strong> Canonical Replogle–Nadig split_0 only; ${m.split.held_out} fixed HepG2 test perturbations. This is an operational pipeline reproduction, not all four paper splits.</p>
    <p><strong>Code.</strong> Authors’ Rhaister <code>${m.provenance.authors_code_commit.slice(0, 7)}</code>; reproduction <code>${m.provenance.reproduction_commit.slice(0, 7)}</code>; generated by <code>scripts/build_rhaister.py</code>.</p>
    <p><strong>Split.</strong> The pinned-code split has 945 targets. A legacy dataset definition has 946 because it retains non-targeting; the exact pinned-code split was used unchanged.</p>
    <p><strong>Limit.</strong> The public release contains no Replogle A/B halves, so no half-sample ceiling is inferred. Panel thresholds are specific to this four-context CRISPR screen.</p>
  `;
  $('assetVersion').textContent = `figure data ${m.asset_version}`;
}

let resizeTimer = null;
function drawAll() {
  drawMethodFlow();
  drawScorePanel();
  drawExample();
  drawWeights();
  drawTitration();
  drawCompass();
}

function scheduleDraw() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawAll, 80);
}

async function boot() {
  try {
    await load();
    populateText();
    $('loading').hidden = true;
    $('story').hidden = false;
    $('provenance').hidden = false;
    requestAnimationFrame(() => {
      drawAll();
      window.addEventListener('resize', scheduleDraw, { passive: true });
    });
  } catch (error) {
    $('loading').hidden = true;
    $('error').hidden = false;
    $('error').textContent = `The three figures could not be set: ${error.message}`;
    console.error(error);
  }
}

boot();
