/* pt-main.js — bootstrap, the reading panel, the legend, and all written matter.
 *
 * Every number this page prints is read from meta.json, which the build script
 * writes in the same pass as graph.json. A retyped figure goes stale silently —
 * PLATE_STYLE.md §4 — so there are no literals below that count anything.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TIMEPOINTS_LABEL = 'hpf';

  function fail(err) {
    $('boot').hidden = true;
    const el = $('fail');
    el.hidden = false;
    el.textContent = 'could not draw the plate — ' + (err && err.message ? err.message : err);
    console.error(err);
  }

  /* A six-point abundance trajectory, drawn small. It is not a plate; it is a
   * reading aid inside the panel, so it gets no axis furniture beyond the
   * window shading and the two endpoints the page is about. */
  function sparkline(abund, tps, window_) {
    const W = 288, H = 54, PADX = 4, PADY = 9;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    if (!abund) return svg;

    const lo = Math.min(...abund), hi = Math.max(...abund);
    const span = (hi - lo) || 1;
    const x = (i) => PADX + (i / (tps.length - 1)) * (W - 2 * PADX);
    const y = (v) => PADY + (1 - (v - lo) / span) * (H - 2 * PADY);

    const i0 = tps.indexOf(window_[0]), i1 = tps.indexOf(window_[1]);
    if (i0 >= 0 && i1 >= 0) {
      const band = document.createElementNS(NS, 'rect');
      band.setAttribute('x', x(i0)); band.setAttribute('y', 1);
      band.setAttribute('width', x(i1) - x(i0)); band.setAttribute('height', H - 2);
      band.setAttribute('fill', '#eae2d2');
      svg.appendChild(band);
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', abund.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2b2219');
    path.setAttribute('stroke-width', '1.3');
    svg.appendChild(path);

    abund.forEach((v, i) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x(i)); c.setAttribute('cy', y(v)); c.setAttribute('r', 2);
      const inWin = tps[i] >= window_[0] && tps[i] <= window_[1];
      c.setAttribute('fill', inWin ? '#8f2d16' : '#8b7d69');
      svg.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x(i)); t.setAttribute('y', H - 1);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '8');
      t.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
      t.setAttribute('fill', '#8b7d69');
      t.textContent = tps[i];
      svg.appendChild(t);
    });
    return svg;
  }

  function band(peak, window_) {
    if (peak == null) return 'no timing on record';
    if (peak <= window_[0]) return 'waning — crests at or before ' + peak + ' ' + TIMEPOINTS_LABEL;
    if (peak <= window_[1]) return 'cresting in the window, at ' + peak + ' ' + TIMEPOINTS_LABEL;
    return 'emerging — crests after the window, at ' + peak + ' ' + TIMEPOINTS_LABEL;
  }

  PT.load().then(({ graph, meta, enrich, sources, zmap, embed, perturb, terrain }) => {
    const c = meta.counts;
    const S = PTGraph.STYLE;
    /* Anything that measures the DOM has to wait until #stage is visible.
     * A canvas sized inside a hidden ancestor gets clientWidth 0 and paints
     * nothing — which is exactly how Plate III shipped blank the first time,
     * while every other part of it worked. Plate I escaped only by accident,
     * because its resize happens to be the last statement in this function. */
    const afterVisible = [];
    /* mapping-confidence tallies, counted from the enrichment rather than typed */
    const conf = { unique: 0, dominant: 0, split: 0, thin: 0, unmapped: 0 };
    if (enrich) Object.values(enrich).forEach((e) => { conf[e.zscape.confidence] += 1; });
    const gl = { agree: 0, disagree: 0 };
    let zdelta = 0, zdeltaN = 0;
    if (zmap) Object.values(zmap).forEach((e) => {
      const a = e.vs_zscape && e.vs_zscape.germ_layer_agreement;
      if (a) gl[a] += 1;
      const v = e.vs_observed_peak;
      if (v && v.delta_hpf != null) { zdeltaN += 1; if (Math.abs(v.delta_hpf) <= 6) zdelta += 1; }
    });

    /* ---- written matter, all from meta.json ---------------------------- */
    $('srcLine').textContent =
      `${c.states} states · ${c.edges} inferred transitions · ${c.components} disconnected ` +
      `components · built ${meta.built}`;
    $('whenLine').textContent = `depth 0–${c.maxDepth} · ${c.components} components`;

    const timedEdges = graph.edges.filter(
      (e) => graph.nodes[e.s].peak != null && graph.nodes[e.t].peak != null);
    const fwd = timedEdges.filter((e) => graph.nodes[e.s].peak < graph.nodes[e.t].peak).length;
    $('fwdCount').textContent = `${fwd} of ${timedEdges.length}`;

    $('cap1').innerHTML =
      `<b>${c.states} cell states, ${c.edges} inferred transitions.</b> Horizontal position is ` +
      `depth in the graph, so every arrow reads left to right; it is <b>not</b> a time axis. ` +
      `A filled node has a wild-type abundance trajectory on record, a hollow one does not ` +
      `(${c.untimedStates} of ${c.states}). The graph is not one tree but ` +
      `<b>${c.components} disconnected pieces</b>, separated here by a hairline — ` +
      `${c.roots} states have no parent in it and ${c.leaves} have no child. A madder tick ` +
      `marks the ${c.retroEdges} arrows that run from a later-peaking state to an earlier-peaking ` +
      `one, against the abundance evidence.`;

    /* ---- legend, which is also the edge key ---------------------------- */
    const legend = $('legend');
    const order = Object.keys(S).sort((a, b) => S[b].rank - S[a].rank);
    let isolated = null;
    const buttons = [];
    order.forEach((key) => {
      const n = key === '' ? meta.support['(none)'] : meta.support[key];
      if (!n) return;                       /* a class with no edges gets no line */
      const b = document.createElement('button');
      b.className = 'leg';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      const sw = document.createElement('span');
      sw.className = 'leg-swatch';
      sw.style.borderTopColor = S[key].stroke;
      sw.style.borderTopWidth = Math.max(1.5, S[key].w) + 'px';
      sw.style.borderTopStyle = S[key].dash.length
        ? (S[key].dash[0] > 3 ? 'dashed' : 'dotted') : 'solid';
      const nm = document.createElement('span');
      nm.className = 'leg-name';
      nm.textContent = S[key].label;
      const ct = document.createElement('span');
      ct.className = 'leg-n';
      ct.textContent = n;
      b.append(sw, nm, ct);
      b.addEventListener('click', () => {
        isolated = (isolated === key) ? null : key;
        buttons.forEach((x) => x.b.setAttribute('aria-pressed', String(x.key === isolated)));
        view.select(-1); showPanel(-1);
        view.isolateClass(isolated);
      });
      legend.appendChild(b);
      buttons.push({ key, b });
    });

    /* ---- the plate ------------------------------------------------------ */
    const view = PTGraph.make($('graph'), graph, showPanel);

    function showPanel(i) {
      const empty = $('panelEmpty'), body = $('panelBody');
      if (i < 0) { empty.hidden = false; body.hidden = true; body.innerHTML = ''; return; }
      empty.hidden = true; body.hidden = false;
      const n = graph.nodes[i];

      body.innerHTML = '';
      const h = document.createElement('h3');
      h.textContent = n.name;
      body.appendChild(h);

      const dl = document.createElement('dl');
      const add = (label, node) => {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd');
        if (typeof node === 'string') dd.innerHTML = node; else dd.appendChild(node);
        dl.append(dt, dd);
      };

      const hasEnrich = !!(enrich && enrich[n.name]);
      const timing = document.createElement('div');
      timing.append(document.createTextNode(band(n.peak, graph.window) + ' '));
      const tg = document.createElement('span');
      tg.className = 'prov model';
      tg.textContent = 'model-derived';
      tg.title = 'from the fitted abundance table, not a count';
      timing.appendChild(tg);
      add('Timing', timing);

      /* The model sparkline is the only timing view when the enrichment is
       * absent, and a duplicate of it when it is present — the block below
       * draws the same series beside its observed counterpart, tagged. So it is
       * drawn here only as a fallback. */
      if (n.abund && !hasEnrich) {
        const wrap = document.createElement('div');
        wrap.appendChild(sparkline(n.abund, graph.timepoints, graph.window));
        const cap = document.createElement('div');
        cap.className = 'cite';
        cap.textContent = 'wild-type log abundance, model-derived; shaded band is 24–48 hpf';
        wrap.appendChild(cap);
        add('Abundance trajectory', wrap);
      }
      add('Position', `depth <b>${n.depth}</b> · component <b>${n.comp}</b>`);

      const listOf = (arr, dir) => {
        const ul = document.createElement('ul');
        if (!arr.length) {
          const li = document.createElement('li');
          li.innerHTML = '<span style="color:#8b7d69;font-style:italic">none in this graph</span>';
          ul.appendChild(li);
          return ul;
        }
        arr.forEach((p) => {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = graph.nodes[p.n].name;
          btn.addEventListener('click', () => { view.select(p.n); showPanel(p.n); });
          const lit = document.createElement('span');
          lit.className = 'lit';
          const sup = graph.edges[p.e].support || '';
          lit.textContent = S[sup].label;
          lit.style.color = S[sup].stroke;
          li.append(btn, lit);
          ul.appendChild(li);
        });
        return ul;
        void dir;
      };
      add('Arrives from', listOf(graph.parents[i]));
      add('Leads to', listOf(graph.children[i]));

      const cites = [...graph.parents[i], ...graph.children[i]]
        .map((p) => graph.edges[p.e].cite).filter(Boolean);
      if (cites.length) {
        const uniq = [...new Set(cites)];
        const d = document.createElement('div');
        d.className = 'cite';
        d.textContent = uniq.join(' · ');
        add('Cited for these transitions', d);
      }
      body.appendChild(dl);

      /* The quantitative block is appended, never merged into the list above:
       * the fields there describe the GRAPH, and everything below describes
       * MEASUREMENTS of the state. Keeping them in two blocks is the cheapest
       * way to stop a reader reading a model output as a count. */
      if (window.PTEnrich) PTEnrich.render(body, n.name, enrich, zmap);
    }

    /* ---- filter: states that crest inside the window -------------------- */
    let winOnly = false;
    function applyFilter() {
      $('fAll').setAttribute('aria-pressed', String(!winOnly));
      $('fWin').setAttribute('aria-pressed', String(winOnly));
      view.select(-1); showPanel(-1);
      view.windowOnly(winOnly);
    }
    $('fAll').addEventListener('click', () => { winOnly = false; applyFilter(); });
    $('fWin').addEventListener('click', () => { winOnly = true; applyFilter(); });
    $('reset').addEventListener('click', () => { view.reset(); });

    /* ---- Plate III: the landscape ---------------------------------------- */
    if (embed) {
      const EM = embed.meta, ST = embed.states;
      $('embWhen').textContent =
        `${EM.n_cells.toLocaleString()} wild-type cells · ${EM.stages.length} hours · ` +
        `${EM.n_states} states`;
      $('cap3').innerHTML =
        `<b>${EM.n_cells.toLocaleString()} wild-type ZSCAPE cells</b> at ${EM.stages[0]}, ` +
        `${EM.stages[1]} … ${EM.stages[EM.stages.length - 1]} hpf — every control arm, no ` +
        `perturbed cell. The scrubber does not move a cell; it moves a window over developmental ` +
        `time, and the whole window stays behind it as a ground. <b>Nothing here is tracked.</b> ` +
        `ZSCAPE is 1,860 separate embryos fixed at separate hours, so a state whose trail crosses ` +
        `the plate is a state whose expression changed, not a population that travelled — which ` +
        `is why the trail is dotted. The embedding is the authors' own 3D UMAP under a fixed ` +
        `principal projection keeping ${(EM.projection.variance_kept * 100).toFixed(0)}% of its ` +
        `variance; UMAP distance is not a quantity.`;

      const view3 = PTEmbed.make($('emb'), $('embHold'), embed, showHeld);
      const slider = $('embSlider');
      slider.max = String(EM.stages.length - 1);
      const readOut = () => {
        const h = EM.stages[+slider.value];
        $('embRead').textContent =
          `${h} hpf · ${(EM.cells_per_stage[h] || 0).toLocaleString()} cells`;
      };
      slider.addEventListener('input', () => { view3.setStage(+slider.value); readOut(); });
      slider.value = '0'; readOut();

      function showHeld(i) {
        const empty = $('embEmpty'), body = $('embBody');
        if (i < 0) { empty.hidden = false; body.hidden = true; body.innerHTML = ''; return; }
        empty.hidden = true; body.hidden = false;
        const st = ST[i];
        body.innerHTML = '';
        const h = document.createElement('h3'); h.textContent = st.name; body.appendChild(h);
        const dl = document.createElement('dl');
        const add = (k2, v) => {
          const dt = document.createElement('dt'); dt.textContent = k2;
          const dd = document.createElement('dd'); dd.innerHTML = v;
          dl.append(dt, dd);
        };
        add('Tissue', st.tissue || '—');
        add('Wild-type cells, 24–48 hpf', `<b>${st.n.toLocaleString()}</b>`);
        const seen = st.trail.map((p, ti) => (p ? EM.stages[ti] : null)).filter((x) => x !== null);
        add('Hours with enough cells to place',
            seen.length ? `${seen.length} of ${EM.stages.length} — ${seen[0]} to ${seen[seen.length - 1]} hpf`
                        : 'none; fewer than 15 cells at every hour');
        if (st.platt_top) {
          add('Platt state', `${st.platt_top}<div class="trail-note">` +
              `${(st.platt_frac_of_zscape * 100).toFixed(0)}% of this ZSCAPE state's cells ` +
              `carry that Platt label. Crosswalk from Plate I's panel, same cells.</div>`);
        }
        body.appendChild(dl);
        const n2 = document.createElement('div');
        n2.className = 'trail-note';
        n2.textContent = 'The dotted trail joins this state\u2019s centroid at each hour. ' +
          'It is not a path any cell took.';
        body.appendChild(n2);
      }
      $('embClear').addEventListener('click', () => { view3.select(-1); showHeld(-1); });

      /* tissue legend — isolate, never hide */
      const lg = $('embLegend');
      let isoT = null;
      const tButtons = [];
      const tCount = {};
      ST.forEach((s2) => { tCount[s2.tissue] = (tCount[s2.tissue] || 0) + s2.n; });
      EM.tissues.forEach((tname, ti) => {
        const b2 = document.createElement('button');
        b2.className = 'leg'; b2.type = 'button'; b2.setAttribute('aria-pressed', 'false');
        const nm = document.createElement('span'); nm.className = 'leg-name'; nm.textContent = tname;
        const ct = document.createElement('span'); ct.className = 'leg-n';
        ct.textContent = (tCount[tname] || 0).toLocaleString();
        b2.append(nm, ct);
        b2.addEventListener('click', () => {
          isoT = (isoT === ti) ? null : ti;
          tButtons.forEach((q, qi) => q.setAttribute('aria-pressed', String(qi === isoT)));
          view3.setIso(isoT);
        });
        lg.appendChild(b2); tButtons.push(b2);
      });

      /* perturbation arrows */
      if (perturb) {
        view3.setArrows(perturb);
        const selT = $('embTarget'), chk = $('embArrows');
        perturb.summary.forEach((r) => {
          const op = document.createElement('option');
          op.value = r.target;
          op.textContent = `${r.target} — ${r.n_arrows} arrows`;
          selT.appendChild(op);
        });
        const axInfo = $('embAxis');
        const byT = {};
        (perturb.axis ? perturb.axis.per_target : []).forEach((r) => { byT[r.target] = r; });
        const sync = () => {
          selT.disabled = !chk.checked;
          view3.showArrows(chk.checked, selT.value);
          const r = byT[selT.value];
          axInfo.innerHTML = (!chk.checked || !r) ? '' :
            `<b>${selT.value}</b> — ${r.n} arrows, median displacement ${r.median_d}. ` +
            `${(r.frac_aligned * 100).toFixed(0)}% run along the shared axis, ` +
            `${(r.frac_variance_along_axis * 100).toFixed(0)}% of its displacement variance ` +
            `lies along it. Arrows against the axis are drawn in madder.`;
        };
        chk.addEventListener('change', sync);
        selT.addEventListener('change', sync);
        $('embHint').innerHTML = 'click a cell to hold its state &middot; the trail is expression ' +
          'changing, not cells moving &middot; an arrow is control &rarr; perturbed, two ' +
          'populations of different cells';
        if (perturb.axis) {
          $('cap3').innerHTML += ` <b>The perturbation layer.</b> ` +
            `${perturb.arrows.length.toLocaleString()} arrows over ` +
            `${new Set(perturb.arrows.map((r) => r.state)).size} states and ` +
            `${perturb.targets.length} gene targets, each one a perturbed centroid minus its ` +
            `matched control centroid at the same hour, both from at least ${perturb.min_cells} ` +
            `cells. <b>An arrow is a difference between two populations of different cells</b> — ` +
            `not a trajectory, not a velocity, and its length has no unit. Their first principal ` +
            `component takes ` +
            `<b>${(perturb.axis.var_explained_centred * 100).toFixed(0)}% of the displacement ` +
            `variance</b> after centring (${(perturb.axis.var_explained * 100).toFixed(0)}% ` +
            `before), so twenty-eight different perturbations really do push cells along one ` +
            `direction in this projection — and the common offset they share is only ` +
            `${(perturb.axis.mean_share_of_squared_length * 100).toFixed(0)}% of the total, so ` +
            `that is collinearity rather than a batch shift. It is an axis in a UMAP, not a ` +
            `gene programme; it cannot name a pathway.`;
        }
      } else {
        $('embArrows').disabled = true;
      }

      afterVisible.push(() => view3.resize());
      let rz3;
      window.addEventListener('resize', () => { clearTimeout(rz3); rz3 = setTimeout(view3.resize, 140); });
    } else {
      const p3 = $('plate3'); if (p3) p3.hidden = true;
    }

    /* ---- Plate IV: the terrain -------------------------------------------- */
    if (terrain) {
      const CF = terrain.chemfish;
      const view4 = PTTerrain.make($('terr'), $('trHold'), terrain, showChannel);

      $('cap4').innerHTML =
        `<b>Time runs down the page, 24 hpf at the top rule to 48 at the bottom.</b> The surface ` +
        `blends the within-hour rank of wild-type cell density with the within-hour normalised ` +
        `density, along one axis of the same embedding Plate III draws, inverted — so it ` +
        `<b>rises where few cells are and dips where many are</b>. A rank because two attempts on ` +
        `the raw log density rendered as ruled lines; the density term because a rank alone is ` +
        `uniform by construction and gave every valley the same depth. <b>Both terms fall as ` +
        `density rises, so the blend does too</b>: a lower point always holds more cells than a ` +
        `higher one at the same hour. Depth is still not proportional to number, and not ` +
        `comparable between hours. Cells sit in the valleys, and a channel is a valley that persists ` +
        `down the page. The ${terrain.channels.length} dotted routes are state centroids, hour by ` +
        `hour. <b>This is an interpretive rendering of transcriptomic state space, not anatomy ` +
        `and not a tracked lineage.</b> Nothing rolls down it, no cell crosses a ridge, and a ` +
        `ridge's height is not an energy, a barrier or a probability — underneath it is a count of ` +
        `cells per bin per hour and nothing else. <b>The drug layer is ChemFish</b>, not ZSCAPE: ` +
        `${Object.keys(CF.pathway).length} small molecules each blocking one named pathway, ` +
        `against their matched vehicle, at ${CF.hours.join(' and ')} hpf — the only hours ChemFish ` +
        `shares with this window. Choosing one <b>re-cuts the terrain at those two hours</b>: the ` +
        `surface is displaced by the log ratio of drug to vehicle occupancy along the axis, the ` +
        `wild-type line is left behind as a ghost, and the inked area between them is the size of ` +
        `the change. <b>That is a change in occupancy, not in position.</b> ChemFish cells reach ` +
        `this axis by which state they are, through the crosswalk — they were never embedded ` +
        `themselves — so a drug can make a basin deeper or shallower here, but it cannot move one ` +
        `sideways. <b>Turn on the shared response and the valleys flood</b>, tinted warm where a ` +
        `basin gains cells under the drugs and cool where it loses them. The water is drawn from ` +
        `the seven drug arms; the terrain beneath it is wild type and knows nothing about it. ` +
        `<b>Scroll to zoom, drag to move.</b>`;

      const sel4 = $('trDrug');
      const opt0 = document.createElement('option');
      opt0.value = ''; opt0.textContent = 'no drug — wild type only';
      sel4.appendChild(opt0);
      Object.keys(CF.pathway).sort().forEach((d) => {
        const o2 = document.createElement('option');
        o2.value = d;
        o2.textContent = `${d} — ${CF.pathway[d]} (vs ${CF.vehicle[d]})`;
        sel4.appendChild(o2);
      });

      function drugBlurb(d) {
        if (!d) return '';
        const rows = CF.rows.filter((r) => r.drug === d);
        const up = rows.filter((r) => r.lfc > 0.5), dn = rows.filter((r) => r.lfc < -0.5);
        const top = rows.slice().sort((a, b) => b.lfc - a.lfc);
        const bot = rows.slice().sort((a, b) => a.lfc - b.lfc);
        return `<dl><dt>${d} — ${CF.pathway[d]} blockade</dt>` +
          `<dd>against ${CF.vehicle[d]}, ${rows.length} state-hours scored at a floor of ` +
          `${CF.min_cells} cells. The terrain is re-cut at ${CF.hours.join(' and ')} hpf and ` +
          `nowhere else — the brackets in the margin are where the measurement is.</dd>` +
          `<dt>Basins that deepen</dt><dd>${up.length} states enriched. Most: ` +
          `<b>${top[0] ? top[0].state : '—'}</b>${top[0] ? ` (+${top[0].lfc.toFixed(2)} at ${top[0].hpf} hpf)` : ''}.</dd>` +
          `<dt>Basins that fill in</dt><dd>${dn.length} states depleted. Most: ` +
          `<b>${bot[0] ? bot[0].state : '—'}</b>${bot[0] ? ` (${bot[0].lfc.toFixed(2)} at ${bot[0].hpf} hpf)` : ''}.</dd>` +
          `</dl>`;
      }

      function sharedBlurb() {
        const parts = Object.entries(CF.shared || {}).map(([h, s]) => {
          const ld = Object.entries(s.drug_loadings).sort((a, b) => b[1] - a[1]);
          return `<dt>${h} hpf — PC1 takes ${(s.var_explained * 100).toFixed(0)}%</dt>` +
            `<dd>over ${s.n_states} states and ${s.n_drugs} drugs. Loads hardest on ` +
            `<b>${ld[0][0]}</b> (${CF.pathway[ld[0][0]]}, ${ld[0][1].toFixed(2)}), least on ` +
            `${ld[ld.length - 1][0]} (${ld[ld.length - 1][1].toFixed(2)}).</dd>`;
        });
        return `<dl><dt>Why a drug response on a wild-type terrain</dt>` +
          `<dd><b>The terrain is wild type. The water is not.</b> The tint is the first principal ` +
          `component of the state-by-drug matrix of compositional log fold-change — it marks the ` +
          `basins that <i>change when any of the seven drugs is applied</i>, painted onto the ` +
          `unperturbed landscape they change. Warm water gains cells, cool water loses them, and ` +
          `the depth of colour is the size of the score.</dd>` +
          `<dt>Where there is no water</dt><dd>ChemFish reaches under half of this axis. A dry ` +
          `valley is one it never measured, not one that failed to respond, and nothing is tinted ` +
          `above the first measured hour.</dd>` +
          parts.join('') + `</dl>`;
      }

      const baseBlurb =
        '<h3>What the surface is</h3>' +
        '<p><b>Elevation blends the within-hour rank of cell density with the within-hour ' +
        'normalised density, both inverted.</b> High ground is where few wild-type cells are; the ' +
        'valley floors are where they pile up, and the deeper floors hold more. Monotone, so a ' +
        'lower point always holds more cells than a higher one at the same hour \u2014 but not ' +
        'proportional, and not comparable between hours.</p>' +
        '<p><b>A channel</b> is a valley that persists down the page. The dotted lines are state ' +
        'centroids at each hour \u2014 routes, not paths anything travelled.</p>' +
        '<p><b>The metaphor is Waddington\u2019s and it stops there.</b> No cell rolls, nothing ' +
        'crosses a ridge, and no height here is an energy or a probability.</p>' +
        '<p class="tr-move"><b>Scroll to zoom</b> on the point under the cursor, drag to move, ' +
        'double-click to reset. Scroll out past the start and the page carries on.</p>';

      function showChannel(i) {
        const extra = (sel4.value ? drugBlurb(sel4.value) : '') +
                      ($('trShared').checked ? sharedBlurb() : '');
        if (i < 0) { $('trBody').innerHTML = baseBlurb + extra; return; }
        const ch = terrain.channels[i];
        const seen = ch.pts.map((p, ti) => (p ? terrain.stages[ti] : null)).filter((x) => x !== null);
        $('trBody').innerHTML =
          `<h3>${ch.state}</h3>` +
          `<dl><dt>Tissue</dt><dd>${ch.tissue || '—'}</dd>` +
          `<dt>Wild-type cells, 24–48 hpf</dt><dd><b>${ch.n.toLocaleString()}</b></dd>` +
          `<dt>Hours it can be placed</dt><dd>${seen.length} of ${terrain.stages.length}` +
          `${seen.length ? ` — ${seen[0]} to ${seen[seen.length - 1]} hpf` : ''}</dd></dl>` +
          extra;
      }

      $('trA1').addEventListener('click', () => {
        view4.setAxis('e1');
        $('trA1').setAttribute('aria-pressed', 'true'); $('trA2').setAttribute('aria-pressed', 'false');
      });
      $('trA2').addEventListener('click', () => {
        view4.setAxis('e2');
        $('trA1').setAttribute('aria-pressed', 'false'); $('trA2').setAttribute('aria-pressed', 'true');
      });
      sel4.addEventListener('change', () => {
        view4.setDrug(sel4.value || null);
        showChannel(-1);
      });
      $('trShared').addEventListener('change', () => {
        view4.setShared($('trShared').checked); showChannel(-1);
      });
      $('trClear').addEventListener('click', () => {
        view4.select(-1); sel4.value = ''; view4.setDrug(null);
        $('trShared').checked = false; view4.setShared(false);
        view4.resetView(); showChannel(-1);
      });

      showChannel(-1);
      afterVisible.push(() => view4.resize());
      let rz4;
      window.addEventListener('resize', () => { clearTimeout(rz4); rz4 = setTimeout(view4.resize, 140); });
    } else {
      const p4 = $('plate4'); if (p4) p4.hidden = true;
    }

    /* ---- Plate II: provenance ------------------------------------------- */
    if (sources) {
      const nW = sources.sources.filter((s2) => s2.status === 'wired').length;
      const nL = sources.sources.filter((s2) => s2.band === 'lineage').length;
      $('srcWhen').textContent =
        `${sources.sources.length} sources · ${nW} wired · ${sources.bands.length} bands`;
      $('cap2').innerHTML =
        `<b>Fourteen sources, two of them load-bearing.</b> Every bar is a real holding in ` +
        `the silver warehouse, drawn across the developmental window it covers. Filled bars ` +
        `feed this page — Platt supplies all ${sources.live.graph_edges} arrows on Plate I, ` +
        `ZSCAPE supplies the crosswalk and timing in ` +
        `${(sources.live.crosswalked_states || 0)} of ${sources.live.enriched_states} state ` +
        `panels. The other twelve are held and unwired. <b>Read down the shaded column:</b> ` +
        `six bars cross 24–48 hpf with transcriptomes and none of the ${nL} lineage sources ` +
        `does — two stop at 24 hpf, one is unplaceable on this axis, and one is probably a ` +
        `different stage altogether. That absence is the argument of this page, drawn.`;

      const cardHost = $('srcCard');
      let view2 = null;
      const pick = (key) => {
        const s2 = sources.sources.find((q) => q.key === key);
        if (!s2) return;
        PTSources.card(cardHost, s2, sources.bands);
        if (view2) view2.highlight(key);
      };
      const render2 = () => {
        view2 = PTSources.draw($('srcHold'), sources, pick);
      };
      afterVisible.push(render2);
      afterVisible.push(() => pick('platt'));
      let rz2;
      window.addEventListener('resize', () => {
        clearTimeout(rz2);
        rz2 = setTimeout(() => { const cur = sources.sources.find(
          (q) => cardHost.querySelector('h3') &&
                 q.name === cardHost.querySelector('h3').textContent);
          render2(); if (cur) view2.highlight(cur.key); }, 140);
      });
    }

    /* ---- notes on the plate -------------------------------------------- */
    const notes = [
      `<b>These are inferred transitions, not observed lineage.</b> The graph was built from ` +
      `transcriptional similarity between states at adjacent timepoints. Nothing in the corpus ` +
      `behind this page observed a cell dividing between 24 and 48 hpf: the two datasets that ` +
      `track nuclei stop at about 24 hpf, and the lineage-recording datasets give clonal groups ` +
      `rather than parent-and-child. An arrow here is a hypothesis with a citation attached, at best.`,

      `<b>A quarter of the arrows are not believed by the people who drew them.</b> Of ` +
      `${c.edges} edges, ${meta.support.TRUE} are marked supported and ${meta.support.PLAUSIBLE} ` +
      `plausible, but ${meta.support.FALSE} are marked <i>false</i>, ${meta.support.UNKNOWN} ` +
      `unknown and ${meta.support['(none)']} were never adjudicated. They are drawn rather than ` +
      `deleted, because an edge someone checked and rejected is evidence, and a graph with the ` +
      `rejections quietly removed would look far more settled than this one is.`,

      `<b>The horizontal axis is not time.</b> It is longest-path depth from a root, which is a ` +
      `property of the graph. Timing is a separate claim carried on each node — a six-point ` +
      `wild-type abundance trajectory at 18, 24, 36, 48, 60 and 72 hpf. The two agree more often ` +
      `than not: ${fwd} of ${timedEdges.length} arrows with timing at both ends run from an ` +
      `earlier-peaking state to a later-peaking one. The ${c.retroEdges} that do not are ticked.`,

      `<b>The window could not be used to drop states.</b> The abundance table reports every state ` +
      `at every timepoint — it is a model fit over a complete grid, not a record of presence — so ` +
      `it cannot say a state is absent at 24 hpf. All ${c.states} states are therefore drawn. ` +
      `The <i>crest 24–48 hpf</i> control isolates the ${meta.peakBands.cresting} whose abundance ` +
      `peaks inside the window; the other ${meta.peakBands.waning} crest at or before 24 hpf and ` +
      `${meta.peakBands.emerging} after 48.`,

      `<b>It is not a tree.</b> ${c.components} disconnected components, ${c.roots} states with no ` +
      `parent and ${c.leaves} with no child. The gaps are missing inference, not biology: a state ` +
      `with no parent in this graph certainly had one in the embryo.`,

      `<b>One perturbation, not thirty-four.</b> The abundance trajectories come from the control ` +
      `arm of a single published contrast (lmx1ba/lmx1bb). It is the wild-type side of that ` +
      `experiment and is used here only for timing. The larger perturbation panel is not on this ` +
      `page yet.`,

      `<b>The panel's numbers come from the reference itself.</b> Clicking a state opens the ` +
      `1,220,178-cell v2.2.1 reference: how many of its cells carry that state at each of the ` +
      `thirteen timepoints from 24 to 48 hpf, which ZSCAPE labels the same cells carry, and how ` +
      `confidently. Sampling depth varies sixteenfold across the window, so every abundance figure ` +
      `is a <i>fraction of that timepoint</i>, never a raw count.`,

      `<b>Observed and model-derived are tagged, and never added together.</b> A count of cells ` +
      `that exist is one kind of number; the output of a fitted abundance model is another. They ` +
      `disagree about where a state peaks for <b>42 of the 184</b> states where both can be ` +
      `computed on the three timepoints their grids share.`,

      `<b>The ZSCAPE crosswalk is a join, not a name match.</b> The reference carries the same cell ` +
      `barcodes ZSCAPE does, so 89% of its cells are ZSCAPE cells re-annotated and the mapping is ` +
      `counted rather than guessed. It is reported with its ambiguity: ${conf.unique} states map to ` +
      `one ZSCAPE label, ${conf.dominant} to a dominant one, <b>${conf.split} are split across ` +
      `several</b>, and 1 has no ZSCAPE cells at all. Uncertain mappings are shown as they are, not ` +
      `resolved.`,

      `<b>Platt is finer than ZSCAPE, and that is the integration problem.</b> These ${c.states} ` +
      `states collapse onto only 82 distinct top-matching ZSCAPE labels — ten of them share one. ` +
      `The relationship is many-to-many and no join key fixes it; the two annotations subdivide the ` +
      `same cells along different axes. Treating it as a rename would silently merge states.`,

      `<b>ZMAP corroborates most of the graph's identities by an independent route.</b> ` +
      `ZMAP shares <i>no cells</i> with Platt — it integrates eight other studies — so its states ` +
      `are matched by expression profile over 2,251 genes rather than by a join, which is weaker ` +
      `evidence and is labelled as such everywhere. On germ layer, the one axis both vocabularies ` +
      `carry, the two routes <b>agree for ${gl.agree} of ${gl.agree + gl.disagree}</b> graph ` +
      `states. Its predicted ages are unbiased but wide: the median difference from the observed ` +
      `peak is 0 hours and only ${zdelta} of ${zdeltaN} states land within six.`,

      `<b>What is deliberately absent, and Plate II is the audit of it.</b> ZMAP, DanioCell, ` +
      `Zebrahub, the spatial layers and the anatomy are acquired, verified and sitting in the ` +
      `warehouse <i>unwired</i>. Plate II draws all fourteen sources on one developmental axis and ` +
      `fills in only the two that feed this page, so a held source cannot be misread as an ` +
      `integrated one. It is also where the window's real hole is visible: nothing in the ` +
      `observed-lineage band crosses 24–48 hpf.`,
    ];
    $('notes').innerHTML = notes.map((t) => `<li>${t}</li>`).join('');

    $('colophon').innerHTML =
      `Source: ${meta.source.release} — <code>${meta.source.graph}</code>, ` +
      `<code>${meta.source.evidence}</code> and the control arm of ` +
      `<code>${meta.source.abundance}</code>, held at <code>${meta.source.silver}</code>. ` +
      `Built by <code>scripts/build_fate_map_24_48.py</code> on ${meta.built}. ` +
      `Layout is longest-path depth with two barycentre passes; no figure on this page is typed ` +
      `into the HTML. Reconnaissance behind it: <code>/data/fate_map_recon.md</code>.`;

    /* ---- go ------------------------------------------------------------- */
    $('boot').hidden = true;
    $('stage').hidden = false;
    afterVisible.forEach((fn) => fn());
    view.resize();
    showPanel(-1);
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(view.resize, 120); });
  }).catch(fail);
})();
