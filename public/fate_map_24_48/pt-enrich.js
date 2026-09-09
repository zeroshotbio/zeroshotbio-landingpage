/* pt-enrich.js — the quantitative half of the reading panel.
 *
 * Everything here hangs off a state that is already selected. The plate does not
 * change: no node moves, no edge restyles, nothing is filtered by any of it. That
 * is deliberate — the graph is a claim about structure and this is a claim about
 * measurement, and mixing them on the same marks is how a page starts asserting
 * more than its sources do.
 *
 * The one rule that governs every row below: a number is either OBSERVED (a count
 * of cells that exist, in the 1,220,178-cell reference) or MODEL-DERIVED (the
 * output of a fit). Each is tagged in the markup, in different type, and the two
 * are never combined into a third number.
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, cls, txt) => {
    const n = document.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* ZMAP's confidence scale is NOT ZSCAPE's and must not read as if it were.
   * ZSCAPE's is a fraction of shared cells; ZMAP's is how far the best profile
   * correlation sits above that state's own null. Different evidence, different
   * words. */
  const ZCONF = {
    strong:    { label: 'strong',    note: 'best match stands 4+ SD above this state\u2019s own null' },
    clear:     { label: 'clear',     note: 'best match stands 2.5+ SD above the null' },
    ambiguous: { label: 'ambiguous', note: 'the top two ZMAP states are within 0.01 of each other' },
    weak:      { label: 'weak',      note: 'no ZMAP state stands out from the rest' },
    thin:      { label: 'thin',      note: 'fewer than 25 Platt cells behind the profile' },
  };

  const CONF = {
    unique:   { label: 'unique',   note: 'one ZSCAPE label takes 80%+ of the cells' },
    dominant: { label: 'dominant', note: 'one label takes 50–80%; the rest are listed' },
    split:    { label: 'split',    note: 'no label takes half — this is NOT a rename' },
    thin:     { label: 'thin',     note: 'fewer than 30 shared cells; read it as a hint' },
    unmapped: { label: 'unmapped', note: 'no cell of this state appears in ZSCAPE' },
  };

  /* A bar chart of the observed 24→48 series. Fraction of each timepoint's cells,
   * never the raw count: sampling depth inside the window varies 16-fold, so a
   * count chart would draw the sequencing effort rather than the biology. */
  function observedBars(obs) {
    const W = 288, H = 62, PADX = 3, TOP = 6, BASE = H - 13;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%'); svg.setAttribute('height', H);
    const tps = obs.grid_hpf;
    const vals = tps.map((t) => obs.frac_of_timepoint[t] || 0);
    const hi = Math.max(...vals) || 1;
    const bw = (W - 2 * PADX) / tps.length;
    tps.forEach((t, i) => {
      const h = (vals[i] / hi) * (BASE - TOP);
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', PADX + i * bw + 1.2);
      r.setAttribute('y', BASE - h);
      r.setAttribute('width', Math.max(1, bw - 2.4));
      r.setAttribute('height', Math.max(0.6, h));
      r.setAttribute('fill', t === obs.peak_hpf_in_window ? '#8f2d16' : '#2b2219');
      r.setAttribute('opacity', t === obs.peak_hpf_in_window ? '0.95' : '0.62');
      svg.appendChild(r);
      if (t % 8 === 0 || t === 24 || t === 48) {
        const lab = document.createElementNS(NS, 'text');
        lab.setAttribute('x', PADX + i * bw + bw / 2);
        lab.setAttribute('y', H - 3);
        lab.setAttribute('text-anchor', 'middle');
        lab.setAttribute('font-size', '8');
        lab.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
        lab.setAttribute('fill', '#8b7d69');
        lab.textContent = t;
        svg.appendChild(lab);
      }
    });
    const rule = document.createElementNS(NS, 'line');
    rule.setAttribute('x1', PADX); rule.setAttribute('x2', W - PADX);
    rule.setAttribute('y1', BASE + 0.5); rule.setAttribute('y2', BASE + 0.5);
    rule.setAttribute('stroke', '#c3b6a0'); rule.setAttribute('stroke-width', '0.6');
    svg.appendChild(rule);
    return svg;
  }

  /* Median and interquartile range of the developmental-time estimate, on the
   * same 18–72 h ruler the model abundance uses, so the two can be read against
   * each other by eye. */
  function devTimeStrip(dt) {
    const W = 288, H = 34, PADX = 4, LO = 18, HI = 72;
    const x = (v) => PADX + ((v - LO) / (HI - LO)) * (W - 2 * PADX);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%'); svg.setAttribute('height', H);

    const band = document.createElementNS(NS, 'rect');
    band.setAttribute('x', x(24)); band.setAttribute('y', 2);
    band.setAttribute('width', x(48) - x(24)); band.setAttribute('height', 18);
    band.setAttribute('fill', '#eae2d2');
    svg.appendChild(band);

    const whisk = document.createElementNS(NS, 'line');
    whisk.setAttribute('x1', x(dt.q10)); whisk.setAttribute('x2', x(dt.q90));
    whisk.setAttribute('y1', 11); whisk.setAttribute('y2', 11);
    whisk.setAttribute('stroke', '#8b7d69'); whisk.setAttribute('stroke-width', '1');
    svg.appendChild(whisk);

    const box = document.createElementNS(NS, 'rect');
    box.setAttribute('x', x(dt.q25)); box.setAttribute('y', 5);
    box.setAttribute('width', Math.max(1, x(dt.q75) - x(dt.q25)));
    box.setAttribute('height', 12);
    box.setAttribute('fill', 'none');
    box.setAttribute('stroke', '#2b2219'); box.setAttribute('stroke-width', '1');
    svg.appendChild(box);

    const med = document.createElementNS(NS, 'line');
    med.setAttribute('x1', x(dt.q50)); med.setAttribute('x2', x(dt.q50));
    med.setAttribute('y1', 4); med.setAttribute('y2', 18);
    med.setAttribute('stroke', '#8f2d16'); med.setAttribute('stroke-width', '1.6');
    svg.appendChild(med);

    [18, 24, 36, 48, 60, 72].forEach((t) => {
      const lab = document.createElementNS(NS, 'text');
      lab.setAttribute('x', x(t)); lab.setAttribute('y', H - 2);
      lab.setAttribute('text-anchor', 'middle'); lab.setAttribute('font-size', '8');
      lab.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
      lab.setAttribute('fill', '#8b7d69');
      lab.textContent = t;
      svg.appendChild(lab);
    });
    return svg;
  }

  /* One ZSCAPE match, as a name with a proportion bar under it. Every match is
   * listed, not just the winner: a one-to-many mapping that prints only its top
   * row has quietly become a one-to-one mapping. */
  function matchRow(m) {
    const row = el('div', 'xw-row');
    const head = el('div', 'xw-head');
    head.append(el('span', 'xw-name', m.zscape_state),
                el('span', 'xw-pct', (m.frac_of_platt_state * 100).toFixed(0) + '%'));
    const bar = el('div', 'xw-bar');
    const fill = el('i');
    fill.style.width = Math.max(1.5, m.frac_of_platt_state * 100) + '%';
    bar.appendChild(fill);
    const back = el('div', 'xw-back',
      `${m.n.toLocaleString()} cells · ${(m.frac_of_zscape_state * 100).toFixed(0)}% of that ZSCAPE state`);
    row.append(head, bar, back);
    return row;
  }

  function tag(kind) {
    const t = el('span', 'prov ' + kind, kind === 'obs' ? 'observed' : 'model-derived');
    t.title = kind === 'obs'
      ? 'a count of cells that exist in the 1,220,178-cell reference'
      : 'the output of a fitted model, not a measurement';
    return t;
  }

  /* The predicted-age strip. Same 18-72 ruler as the developmental-time box so
   * the two can be compared by eye — but it is a DIFFERENT quantity: ZMAP's own
   * time distribution for a state matched by correlation, not this state's cells. */
  function hpfStrip(pr, observedPeak) {
    const W = 288, H = 34, PADX = 4, LO = 18, HI = 72;
    const x = (v) => PADX + ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * (W - 2 * PADX);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%'); svg.setAttribute('height', H);
    const band = document.createElementNS(NS, 'rect');
    band.setAttribute('x', x(24)); band.setAttribute('y', 2);
    band.setAttribute('width', x(48) - x(24)); band.setAttribute('height', 18);
    band.setAttribute('fill', '#eae2d2');
    svg.appendChild(band);
    if (pr.q25 != null && pr.q75 != null) {
      const box = document.createElementNS(NS, 'rect');
      box.setAttribute('x', x(pr.q25)); box.setAttribute('y', 6);
      box.setAttribute('width', Math.max(1, x(pr.q75) - x(pr.q25)));
      box.setAttribute('height', 10);
      box.setAttribute('fill', 'none'); box.setAttribute('stroke', '#8b7d69');
      box.setAttribute('stroke-width', '1'); box.setAttribute('stroke-dasharray', '3 2');
      svg.appendChild(box);
    }
    if (pr.q50 != null) {
      const med = document.createElementNS(NS, 'line');
      med.setAttribute('x1', x(pr.q50)); med.setAttribute('x2', x(pr.q50));
      med.setAttribute('y1', 4); med.setAttribute('y2', 18);
      med.setAttribute('stroke', '#8b7d69'); med.setAttribute('stroke-width', '1.6');
      svg.appendChild(med);
    }
    if (observedPeak != null) {           /* the observation, for contrast */
      const o = document.createElementNS(NS, 'line');
      o.setAttribute('x1', x(observedPeak)); o.setAttribute('x2', x(observedPeak));
      o.setAttribute('y1', 2); o.setAttribute('y2', 20);
      o.setAttribute('stroke', '#8f2d16'); o.setAttribute('stroke-width', '1.6');
      svg.appendChild(o);
    }
    [18, 24, 36, 48, 60, 72].forEach((t) => {
      const lab = document.createElementNS(NS, 'text');
      lab.setAttribute('x', x(t)); lab.setAttribute('y', H - 2);
      lab.setAttribute('text-anchor', 'middle'); lab.setAttribute('font-size', '8');
      lab.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
      lab.setAttribute('fill', '#8b7d69');
      lab.textContent = t;
      svg.appendChild(lab);
    });
    return svg;
  }

  /* The ZMAP block. Deliberately compact, and deliberately hedged: no cell is
   * shared between ZMAP and Platt, so nothing here is a join. */
  function renderZmap(wrap, name, Z, observedPeak) {
    const e = Z && Z[name];
    if (!e) return;
    const fine = e.levels.ZMAP_CellTypeFine;
    const c = ZCONF[fine.confidence] || ZCONF.weak;

    const h = el('div', 'e-head');
    h.append(el('span', null, 'ZMAP'), el('span', 'conf ' + fine.confidence, c.label));
    wrap.appendChild(h);
    wrap.appendChild(el('div', 'e-note',
      'No shared cells \u2014 matched by expression profile over 2,251 genes. ' + c.note + '.'));

    fine.matches.slice(0, 3).forEach((m) => {
      const row = el('div', 'xw-row');
      const head = el('div', 'xw-head');
      head.append(el('span', 'xw-name', m.zmap_state),
                  el('span', 'xw-pct', '\u03c1 ' + m.rho.toFixed(2)));
      const bar = el('div', 'xw-bar');
      const fill = el('i');
      /* the bar shows rho relative to this state's own null, not 0-1: an
       * absolute-scaled bar would make every match look feeble */
      const lo = fine.null_mean_rho, hi = Math.max(fine.top_rho, lo + 1e-6);
      fill.style.width = Math.max(2, ((m.rho - lo) / (hi - lo)) * 100) + '%';
      fill.style.background = '#5f5344';
      bar.appendChild(fill);
      row.append(head, bar,
                 el('div', 'xw-back', m.zmap_cells.toLocaleString() + ' ZMAP cells'));
      wrap.appendChild(row);
    });

    const coarse = ['ZMAP_Tissue', 'ZMAP_GermLayer']
      .map((k) => (e.levels[k].matches[0] || {}).zmap_state).filter(Boolean);
    wrap.appendChild(el('div', 'e-foot',
      `top match ${fine.z_top} SD above this state\u2019s null (mean \u03c1 ` +
      `${fine.null_mean_rho}) \u00b7 tissue ${coarse[0] || '\u2014'} \u00b7 germ layer ` +
      `${coarse[1] || '\u2014'}`));

    if (e.predicted_hpf && e.predicted_hpf.q50 != null) {
      const h2 = el('div', 'e-head');
      h2.append(el('span', null, 'ZMAP predicted age'), tag('model'));
      wrap.appendChild(h2);
      wrap.appendChild(hpfStrip(e.predicted_hpf, observedPeak));
      const v = e.vs_observed_peak;
      wrap.appendChild(el('div', 'e-foot',
        `median ${e.predicted_hpf.q50} hpf, IQR ${e.predicted_hpf.q25}\u2013` +
        `${e.predicted_hpf.q75}, from ZMAP\u2019s own cells in ` +
        `${e.predicted_hpf.from_zmap_state}. ` +
        (v ? `The madder rule is this state\u2019s observed peak, ${v.observed_peak_hpf} hpf ` +
             `\u2014 a difference of ${v.delta_hpf > 0 ? '+' : ''}${v.delta_hpf} h. ` : '') +
        `Indirect twice over: ZMAP\u2019s timing, carried across a correlation.`));
    }

    const vz = e.vs_zscape;
    if (vz && vz.germ_layer_agreement) {
      const h3 = el('div', 'e-head');
      h3.append(el('span', null, 'ZMAP against ZSCAPE'),
                el('span', 'conf ' + (vz.germ_layer_agreement === 'agree' ? 'unique' : 'split'),
                   vz.germ_layer_agreement));
      wrap.appendChild(h3);
      wrap.appendChild(el('div', 'e-foot',
        `Germ layer is the only axis both vocabularies carry. ZSCAPE says ` +
        `<b>${vz.zscape_germ_layer}</b>, observed from shared cells; ZMAP says ` +
        `<b>${vz.zmap_germ_layer}</b>, inferred from the profile. ` +
        (vz.germ_layer_agreement === 'agree'
          ? 'Two routes with no cell in common land in the same place.'
          : 'They do not agree. Neither is automatically right \u2014 look at both.')));
      wrap.lastChild.innerHTML = wrap.lastChild.textContent
        .replace(vz.zscape_germ_layer, '<b>' + vz.zscape_germ_layer + '</b>')
        .replace(vz.zmap_germ_layer, '<b>' + vz.zmap_germ_layer + '</b>');
    }
  }

  /* Append the whole quantitative block to an already-built panel. Returns
   * silently if the state has no enrichment record, so the page still works
   * with enrich.json absent. */
  function render(container, name, E, Z) {
    const e = E && E[name];
    if (!e) return;
    const wrap = el('div', 'enrich');

    /* -- crosswalk ---------------------------------------------------- */
    const z = e.zscape;
    const c = CONF[z.confidence] || CONF.unmapped;
    const h1 = el('div', 'e-head');
    h1.append(el('span', null, 'ZSCAPE state'), el('span', 'conf ' + z.confidence, c.label));
    wrap.appendChild(h1);
    wrap.appendChild(el('div', 'e-note', c.note));

    if (!z.matches || !z.matches.length) {
      wrap.appendChild(el('div', 'e-empty',
        'None. No cell annotated to this Platt state appears in ZSCAPE at all.'));
    } else {
      z.matches.forEach((m) => wrap.appendChild(matchRow(m)));
      const extra = z.n_matches_total - z.matches.length;
      const foot = el('div', 'e-foot',
        `${z.shared_cells.toLocaleString()} cells carry both annotations · ` +
        `${z.n_matches_total} distinct ZSCAPE labels` +
        (extra > 0 ? `, ${extra} smaller ones not shown` : '') +
        ` · entropy ${z.entropy_bits} bits`);
      wrap.appendChild(foot);
    }

    /* -- observed abundance ------------------------------------------- */
    const o = e.observed;
    const h2 = el('div', 'e-head');
    h2.append(el('span', null, 'Abundance 24→48 hpf'), tag('obs'));
    wrap.appendChild(h2);
    if (o.n_in_window === 0) {
      wrap.appendChild(el('div', 'e-empty', 'No cells of this state anywhere in the window.'));
    } else {
      wrap.appendChild(observedBars(o));
      wrap.appendChild(el('div', 'e-foot',
        `${o.n_in_window.toLocaleString()} cells across the 13 timepoints · bars are the ` +
        `state's share of each timepoint, not its cell count`));
    }

    /* -- peak, both kinds --------------------------------------------- */
    const pa = e.peak_agreement;
    const h3 = el('div', 'e-head');
    h3.append(el('span', null, 'Peak'));
    wrap.appendChild(h3);
    /* The two peaks are measured on DIFFERENT GRIDS — 13 timepoints against 6 —
     * so they can differ without either being wrong, and printing them bare
     * invites a reader to treat that as a contradiction. Each carries its grid,
     * and the like-for-like test is stated separately underneath. */
    const pk = el('div', 'e-kv');
    const obsPk = el('div', 'e-peak');
    obsPk.append(el('b', null, o.peak_hpf_in_window ? o.peak_hpf_in_window + ' hpf' : '—'),
                 tag('obs'), el('span', 'e-grid', '13-point grid, 24–48'));
    const modPk = el('div', 'e-peak');
    modPk.append(el('b', null, e.model_abundance ? e.model_abundance.peak_hpf + ' hpf' : '—'),
                 tag('model'), el('span', 'e-grid', '6-point grid, 18–72'));
    pk.append(obsPk, modPk);
    wrap.appendChild(pk);
    if (pa) {
      wrap.appendChild(el('div', 'e-foot',
        pa.agree
          ? `Like for like, on the three timepoints both grids share (24, 36, 48), they ` +
            `agree: ${pa.observed_peak_of_24_36_48} hpf.`
          : `Like for like, on the three timepoints both grids share, they DISAGREE — ` +
            `observed ${pa.observed_peak_of_24_36_48} hpf against model ` +
            `${pa.model_peak_of_24_36_48} hpf. The model is fitted over a complete grid; ` +
            `the observation is a count and can be thin.`));
    } else if (!e.model_abundance) {
      wrap.appendChild(el('div', 'e-foot',
        'No model abundance: this state has no row in the contrast table under any spelling.'));
    }

    /* -- developmental time ------------------------------------------- */
    const dt = e.dev_time;
    const h4 = el('div', 'e-head');
    h4.append(el('span', null, 'Developmental time'), tag('model'));
    wrap.appendChild(h4);
    if (!dt) {
      wrap.appendChild(el('div', 'e-empty', 'No estimate reaches this state.'));
    } else {
      wrap.appendChild(devTimeStrip(dt));
      wrap.appendChild(el('div', 'e-foot',
        `median ${dt.q50} hpf · IQR ${dt.q25}–${dt.q75} · 10–90% ${dt.q10}–${dt.q90} · ` +
        `n=${dt.n.toLocaleString()}. ZSCAPE's nearest-neighbour estimate over the shared ` +
        `cells; Platt's own column is populated for 550 cells in 1.2M and is unusable.`));
    }

    renderZmap(wrap, name, Z, e.observed ? e.observed.peak_hpf_in_window : null);
    container.appendChild(wrap);
  }

  global.PTEnrich = { render };
})(window);
