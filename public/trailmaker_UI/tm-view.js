/* tm-view.js — the /trailmaker_UI plate: the comparison sentence, the row of keys under the plate
 * rule, the drug x cell-type plate, and the page for whatever you click in a row below it. Every
 * number comes from tm-stats.js; this file only decides what to show and how it is inked.
 *
 * The look is the plate style (PLATE_STYLE.md; /compass is the nearest sibling): laid paper, one
 * ink, a hand-tinted wash only where a direction must be told apart — ochre for more cells than
 * DMSO, indigo grey for fewer — and madder for the drug you chose, nothing else. The tissue
 * brackets and rules carry a small deterministic pen wobble; no cell is ever jittered.
 *
 * The plate is fitted to its frame: columns widen to fill it and carry their names on a slant (or
 * upright when narrow). Whatever you click opens its page in a row below the plate. The baseline,
 * the reference and the named drug are pinned above the rest so the comparison never scrolls away.
 * Four stories preset the controls and narrate what the plate shows, spotlighting the rows and
 * columns each beat is about; every number they quote is computed from the loaded counts.
 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif';
  const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  const DATASETS = [["minifin", "MiniFin"], ["megafin", "MegaFin part 1"], ["megafin2", "MegaFin part 2"]];
  const MIN_TYPE_N = { megafin: 100, megafin2: 100, minifin: 0 };
  const HEAD_SHORT = 64, BAND_H = 20, PIN_H = 20, FIT_H = 540, NAME_PX = 10, ROW_MIN = 11;
  const headH = () => (S.geom ? S.geom.headH : HEAD_SHORT);

  const S = {
    ds: "megafin", m: null, layer: null, gene: -1, mode: "delta", tissue: "", typeQ: "", dose: "",
    sort: "response", focus: -1, detail: null, hover: null, showTiny: false,
    rows: [], cols: [], pins: [], geom: null, max: 1, notice: "", ref: "", story: null, spot: null, idx: null, stab: null,
  };
  const geneCache = new Map();
  let C = null;

  // ------------------------------------------------------------------ formatting
  const doseLabel = (d) => (!d ? "" : /^[\d.]+$/.test(d) ? `${+d} µM` : d.replace(/\s*u[mM]$/, " µM"));
  const condLabel = (c) => (c.dose ? `${c.drug} · ${doseLabel(c.dose)}` : c.drug);
  const pctF = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(Math.abs(v) < 0.01 ? 2 : 1)}%` : "–");
  const ppF = (v) => (Number.isFinite(v) ? `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(2)} pp` : "–");
  const zF = (v) => (Number.isFinite(v) ? `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}` : "–");
  const rF = (v) => (Number.isFinite(v) ? `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(2)}` : "–");
  const nF = (v) => Math.round(v).toLocaleString("en-US");
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const unitWord = (n) => (S.m.dataset.startsWith("megafin") ? (n === 1 ? "well" : "wells") : n === 1 ? "sample" : "samples");
  const typeWord = () => "cell sets"; // both datasets carry Patrick's hand-drawn sets, nothing else
  const geneName = () => (S.gene >= 0 ? S.m.genes[S.gene] : null);

  // ------------------------------------------------------------------ ink
  function hex(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = (a, al) => (al == null ? `rgb(${a.join(",")})` : `rgba(${a.join(",")},${al})`);
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => hex(cs.getPropertyValue(n).trim() || "#000");
    const c = { paper: g("--paper"), deep: g("--paper-deep"), ink: g("--ink"), ink2: g("--ink-2"), ink3: g("--ink-3"),
                rule: g("--rule"), rule2: g("--rule-2"), sel: g("--select"), anchor: g("--t3"), plum: g("--t6") };
    // the two washes, deepened a little toward the ink so the strongest cells still read on paper
    c.up = mix(g("--t1"), c.ink, 0.22);
    c.down = mix(g("--t4"), c.ink, 0.12);
    return c;
  }
  const seqCol = (t) => rgb(mix(C.deep, C.ink, 0.86 * Math.sqrt(Math.min(1, Math.max(0, t)))));
  const divCol = (x) => rgb(mix(C.deep, x >= 0 ? C.up : C.down, Math.pow(Math.min(1, Math.abs(x)), 0.8)));
  const cellColor = (v) => (!Number.isFinite(v) ? null : S.mode === "pct" ? seqCol(v / S.max) : divCol(v / S.max));
  function gradient() {
    const stops = S.mode === "pct" ? [0, 0.25, 0.5, 0.75, 1].map(seqCol) : [-1, -0.5, 0, 0.5, 1].map(divCol);
    return `linear-gradient(90deg,${stops.join(",")})`;
  }

  // A rule drawn as a pen would draw it. Furniture only; never a data mark.
  function penLine(ctx, x1, y1, x2, y2, seed, color, width) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, n = Math.max(2, Math.ceil(len / 6));
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = 0.42 * Math.sin(t * 9.1 + seed) + 0.28 * Math.sin(t * 23.7 + seed * 1.7);
      const x = x1 + (x2 - x1) * t + nx * w, y = y1 + (y2 - y1) * t + ny * w;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // ------------------------------------------------------------------ what is on the plate
  function visibleCols() {
    const m = S.m, q = S.typeQ.trim().toLowerCase(), minN = S.showTiny ? 0 : MIN_TYPE_N[S.ds] || 0;
    return m.type_order.filter((t) => {
      const ty = m.types[t];
      return (!S.tissue || ty.tissue === S.tissue) && (!q || ty.name.toLowerCase().includes(q)) && ty.n >= minN;
    });
  }
  function hiddenTiny() {
    const minN = MIN_TYPE_N[S.ds] || 0;
    return S.showTiny ? 0 : S.m.types.filter((t) => t.n < minN && (!S.tissue || t.tissue === S.tissue)).length;
  }
  const anchorIdx = () => TM.anchorFor(S.m, -1, S.dose || S.m.doses[0] || "");
  const refName = () => S.ref || S.m.anchor;
  const baseName = () => condLabel(S.m.conds[S.m.base]);
  const baseShort = () => (S.m.conds[S.m.base].id === S.m.baseline ? S.m.baseline : "baseline");

  // The baseline (DMSO to start) can be any condition: a control, or a drug at one dose.
  function setBase(i) {
    TM.setBase(S.m, i);
    if (S.focus === i) S.focus = -1;
  }

  // The reference drug (Sorafenib to start) can be any drug: its conditions become the anchors that
  // the pinned row, the similarity ranking and "most like…" order all read.
  function setRef(name) {
    const m = S.m;
    const ix = m.conds.map((c, i) => (c.drug === name && !c.control ? i : -1)).filter((i) => i >= 0);
    if (!ix.length) return false;
    S.ref = name;
    m.anchors = ix;
    if (ix.includes(S.focus)) S.focus = -1;
    return true;
  }

  // Rank drugs by similarity to Sorafenib among drugs at one dose, so like is compared with like.
  function simList(mats, cols, keep, dose = S.dose) {
    const m = S.m, nt = m.nt;
    return m.conds.map((_, k) => k)
      .filter((k) => k === keep || (!m.conds[k].control && !m.anchors.includes(k) && (!dose || m.conds[k].dose === dose)))
      .map((k) => [k, TM.pearson(TM.row(mats.z, k, nt), TM.row(mats.z, TM.anchorFor(m, k, dose), nt), cols)])
      .filter((p) => Number.isFinite(p[1]))
      .sort((a, b) => b[1] - a[1]);
  }

  // Average-linkage clustering of the rows' z-score profiles (distance 1 - r over the sets on
  // screen), read out as a leaf order: drugs that move the plate the same way end up side by side.
  function clusterOrder(rows, mats) {
    const m = S.m, nt = m.nt, cols = S.cols.filter((t) => !m.types[t].umbrella), n = rows.length;
    if (n < 3) return rows.slice();
    const D = Array.from({ length: n }, () => new Float64Array(n));
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const r = TM.pearson(TM.row(mats.z, rows[a], nt), TM.row(mats.z, rows[b], nt), cols);
      D[a][b] = D[b][a] = Number.isFinite(r) ? 1 - r : 1;
    }
    let groups = rows.map((_, k) => ({ ids: [k], size: 1, alive: true }));
    for (let step = 0; step < n - 1; step++) {
      let best = Infinity, ba = -1, bb = -1;
      for (let a = 0; a < n; a++) if (groups[a].alive) for (let b = a + 1; b < n; b++) if (groups[b].alive && D[a][b] < best) { best = D[a][b]; ba = a; bb = b; }
      const A = groups[ba], B = groups[bb];
      for (let k = 0; k < n; k++) if (groups[k].alive && k !== ba && k !== bb) {
        D[ba][k] = D[k][ba] = (A.size * D[ba][k] + B.size * D[bb][k]) / (A.size + B.size);
      }
      groups[ba] = { ids: A.ids.concat(B.ids), size: A.size + B.size, alive: true };
      groups[bb].alive = false;
    }
    return groups.find((g) => g.alive).ids.map((k) => rows[k]);
  }

  function rowList(mats) {
    const m = S.m, nt = m.nt, cols = S.cols;
    const rows = m.conds.map((_, i) => i).filter((i) => i !== m.base && (!S.dose || !m.conds[i].dose || m.conds[i].dose === S.dose));
    const name = (i) => condLabel(m.conds[i]).toLowerCase();
    if (S.sort === "cluster") {
      const drugs = clusterOrder(rows.filter((i) => !m.conds[i].control), mats);
      return drugs.concat(rows.filter((i) => m.conds[i].control));
    }
    const key = new Map();
    const setT = selType();
    if (S.sort === "set") {
      // from the most raised at the top to the most lowered at the bottom, in the value on screen
      const vals = mats[S.mode];
      rows.forEach((i) => key.set(i, setT >= 0 && Number.isFinite(vals[i * nt + setT]) ? -vals[i * nt + setT] : Infinity));
    }
    if (S.sort === "response") rows.forEach((i) => key.set(i, -(TM.responseScore(TM.row(mats.z, i, nt), cols) || 0)));
    if (S.sort === "similar") {
      rows.forEach((i) => {
        const a = TM.anchorFor(m, i, S.dose);
        const r = i === a ? 2 : TM.pearson(TM.row(mats.z, i, nt), TM.row(mats.z, a, nt), cols);
        key.set(i, Number.isFinite(r) ? -r : 3);
      });
    }
    rows.sort((a, b) => {
      if (m.conds[a].control !== m.conds[b].control) return m.conds[a].control ? 1 : -1;
      if (S.sort === "az") return name(a).localeCompare(name(b));
      if (S.sort === "plate") return m.conds[a].plate.localeCompare(m.conds[b].plate) || name(a).localeCompare(name(b));
      if (S.sort === "set" && setT < 0) return name(a).localeCompare(name(b));
      return key.get(a) - key.get(b) || name(a).localeCompare(name(b));
    });
    return rows;
  }

  function scaleMax(vals) {
    if (S.mode === "z") return 4;
    const nt = S.m.nt, xs = [];
    for (const i of S.rows) for (const t of S.cols) {
      const v = vals[i * nt + t];
      if (Number.isFinite(v)) xs.push(S.mode === "pct" ? v : Math.abs(v));
    }
    const q = TM.quantile(xs, 0.98);
    return q > 0 ? q : 1e-6;
  }

  // ------------------------------------------------------------------ render
  let raf = 0;
  const requestPaint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (S.m) paint(); }); };

  function render() {
    const m = S.m;
    if (!m) return;
    C = readColors();
    const mats = TM.matrices(m, S.layer);
    S.cols = visibleCols();
    S.rows = rowList(mats);
    S.pins = [m.base, anchorIdx(), S.focus];
    geometry();
    S.max = scaleMax(mats[S.mode]);
    paint();
    legendAndCaption();
    renderDetail();
    chips();
    writeUrl();
    paintStoryCard();
  }

  // The plate is fitted to its frame: the columns widen to fill it.
  let measure = null;
  function geometry() {
    const wrapW = $("#hmwrap").clientWidth, nc = Math.max(1, S.cols.length), nr = Math.max(1, S.rows.length);
    const lw = innerWidth < 600 ? 128 : 190;
    let cw, rh, headH, names, pad = 0, slantMax = 150;
    {
      // the columns widen to fill the plate. Names are slanted, given room for their whole
      // length up to 260px, and the plate keeps a right margin for the lean of the last few names.
      measure = measure || document.createElement("canvas").getContext("2d");
      measure.font = `11.5px ${SERIF}`;
      slantMax = Math.min(260, Math.ceil(Math.max(0, ...S.cols.map((t) => measure.measureText(S.m.types[t].name).width))));
      // Slanted names need ~16px columns or they overprint; narrower columns (half a screen) set the
      // names upright instead, which also frees the lean margin; below 9px there is no room at all.
      const lean = Math.ceil(slantMax * Math.cos(Math.PI / 3));
      rh = Math.max(ROW_MIN, Math.min(20, Math.floor(FIT_H / nr)));
      const cwSlant = Math.floor((wrapW - lw - 12 - lean) / nc), cwFlat = Math.floor((wrapW - lw - 12) / nc);
      if (cwSlant >= 16) {
        cw = Math.min(44, cwSlant); names = "slant"; pad = lean;
        headH = Math.max(HEAD_SHORT, Math.ceil(slantMax * Math.sin(Math.PI / 3)) + BAND_H + 14);
      } else if (cwFlat >= 9) {
        cw = Math.min(44, cwFlat); names = "upright";
        measure.font = `${NAME_PX}px ${SERIF}`;
        headH = Math.max(HEAD_SHORT, Math.ceil(Math.max(0, ...S.cols.map((t) => measure.measureText(S.m.types[t].name).width))) + BAND_H + 16);
      } else {
        cw = Math.max(3, cwFlat); names = "none"; headH = HEAD_SHORT;
      }
    }
    // with both doses on screen (~180 rows) the rows would fall to 3px and lose their names; instead
    // they keep ROW_MIN and the rows scroll inside their own frame, under the pinned rows
    $("#rowscroll").style.maxHeight = rh * nr > FIT_H + rh ? `${Math.max(FIT_H, Math.round(innerHeight * 0.62))}px` : "none";
    S.geom = { lw, cw, rh, headH, names, slantMax, W: lw + cw * S.cols.length + 12 + pad };
  }

  function fitCanvas(cv, w, h) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(w * d));
    cv.height = Math.max(1, Math.round(h * d));
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext("2d");
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }

  function clip(ctx, s, w) {
    if (ctx.measureText(s).width <= w) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(`${s.slice(0, mid)}…`).width <= w) lo = mid; else hi = mid - 1;
    }
    return `${s.slice(0, lo)}…`;
  }

  function paint() {
    const vals = TM.matrices(S.m, S.layer)[S.mode];
    paintHead();
    paintPins(vals);
    paintRows(vals);
  }

  const selType = () => (S.detail && S.detail.kind === "type" ? S.detail.i : -1);
  const hotType = () => (S.hover && S.hover.t != null ? S.hover.t : -1);

  function paintHead() {
    const { lw, cw, W } = S.geom, m = S.m, HEAD_H = headH(), yb = HEAD_H - BAND_H;
    const ctx = fitCanvas($("#cvHead"), W, HEAD_H);
    // tissue brackets: a pen rule over each run of columns from one tissue, its name in italic below
    ctx.textBaseline = "alphabetic";
    ctx.font = `italic 11.5px ${SERIF}`;
    for (let j = 0, k = 0; j < S.cols.length; k++) {
      const tis = m.types[S.cols[j]].tissue;
      let e = j;
      while (e < S.cols.length && m.types[S.cols[e]].tissue === tis) e++;
      const x0 = lw + j * cw + 1.5, x1 = lw + e * cw - 2.5, y = yb + 4;
      penLine(ctx, x0, y, x1, y, 11 + k * 3.1, rgb(C.ink3), 0.7);
      penLine(ctx, x0, y, x0 + 0.3, y - 4, 5 + k, rgb(C.ink3), 0.7);
      penLine(ctx, x1, y, x1 - 0.3, y - 4, 7 + k, rgb(C.ink3), 0.7);
      if (x1 - x0 > 24) { ctx.fillStyle = rgb(C.ink2); ctx.fillText(clip(ctx, tis, x1 - x0 - 2), x0 + 1, yb + 17); }
      j = e;
    }
    const hot = hotType(), sel = selType(), names = S.geom.names;
    if (names !== "none") {
      const upright = names === "upright";
      ctx.font = upright ? `${NAME_PX}px ${SERIF}` : `11.5px ${SERIF}`;
      ctx.textBaseline = upright ? "middle" : "alphabetic";
      S.cols.forEach((t, j) => {
        ctx.save();
        ctx.translate(lw + j * cw + cw / 2 + (upright ? 0 : 2), yb - 6);
        ctx.rotate(upright ? -Math.PI / 2 : -Math.PI / 3);
        ctx.fillStyle = rgb(t === sel || spotT(t) ? C.sel : t === hot ? C.ink : C.ink2);
        ctx.fillText(upright ? m.types[t].name : clip(ctx, m.types[t].name, S.geom.slantMax), 0, 0);
        ctx.restore();
      });
      ctx.textBaseline = "alphabetic";
    } else {
      for (const t of [hot, sel]) {
        const j = S.cols.indexOf(t);
        if (j >= 0) { ctx.fillStyle = rgb(t === sel ? C.sel : C.ink); ctx.beginPath(); ctx.arc(lw + j * cw + cw / 2, yb - 5, 2.2, 0, 7); ctx.fill(); }
      }
    }
    const x0 = scrollX0();
    labelPanel(ctx, x0, HEAD_H);
    ctx.fillStyle = rgb(C.ink3);
    ctx.font = `9.5px ${SANS}`;
    ctx.fillText(`${S.cols.length} ${typeWord().toUpperCase()}`, x0 + 18, yb + 16);
    if (S.stab) {
      ctx.save();
      ctx.translate(x0 + 11, yb + 18);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `9px ${SANS}`;
      ctx.fillStyle = rgb(C.plum);
      ctx.fillText("STOCK STABILITY", 0, 0);
      ctx.restore();
    }
    if (names === "none" && S.cols.length) {
      ctx.font = `italic 13px ${SERIF}`;
      ctx.fillText("hover a column to read it, or choose a tissue to widen them", x0 + 4, yb - 14);
    }
  }

  // When the plate is wider than its frame it scrolls sideways; the name column is redrawn at the
  // scroll offset over a paper panel, so the squares pass under the names instead of taking them away.
  const scrollX0 = () => $("#hmwrap").scrollLeft;
  function labelPanel(ctx, x0, h) {
    if (x0 <= 0) return;
    const { lw } = S.geom;
    ctx.fillStyle = rgb(C.paper);
    ctx.fillRect(x0, 0, lw - 2, h);
    ctx.strokeStyle = rgb(C.rule);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0 + lw - 2.5, 0); ctx.lineTo(x0 + lw - 2.5, h); ctx.stroke();
  }

  // Stock stability: a quick triage of how likely each drug's DMSO stock is to lose potency through
  // freeze-thaw cycles and storage (data/stability.json, built by scripts/trailmaker_stability.py).
  // One plum hue, light to dark, so it never competes with the heatmap's ochre / indigo or madder.
  const STAB = { low: ["robust", 0.2], some: ["some risk", 0.52], high: ["likely to lose potency", 1] };
  const stabOf = (c) => (S.stab && c && !c.control ? S.stab.drugs[c.drug] : null);
  const stabCol = (tier) => rgb(mix(C.paper, C.plum, STAB[tier][1]));
  function stabMark(ctx, c, x, y, h) {
    const s = stabOf(c);
    if (!s) return;
    const side = Math.max(3, Math.min(9, h - 2)), top = y + (h - side) / 2;
    ctx.fillStyle = stabCol(s.tier);
    ctx.fillRect(x, top, 9, side);
    ctx.strokeStyle = rgb(C.plum, 0.55);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + 0.35, top + 0.35, 8.3, side - 0.7);
  }
  function stabTip(c) {
    const s = stabOf(c);
    if (!s) return `<b>${esc(condLabel(c))}</b><br><span class="d">${c.control ? "a control, not a drug" : "not rated"}</span>`;
    return `<b>${esc(c.drug)}</b><br>stock stability: <i>${STAB[s.tier][0]}</i><p>${esc(s.why)}</p>`
      + `<span class="d">A quick estimate from the molecule's chemistry and common handling guidance, not measured on these plates.</span>`;
  }
  function stabLegend() {
    if (!S.stab) return "";
    return `<span class="lhead">stock stability</span>` + ["low", "some", "high"].map((t) => `<span><i class="sw" style="background:${stabCol(t)};border-radius:1px;box-shadow:inset 0 0 0 1px ${rgb(C.plum, 0.55)}"></i>${STAB[t][0]}</span>`).join("");
  }

  function paintCells(ctx, vals, i, y, h) {
    const { lw, cw } = S.geom, nt = S.m.nt, gx = cw > 4 ? 1 : 0, gy = h > 4 ? 1 : 0;
    S.cols.forEach((t, j) => {
      const col = cellColor(vals[i * nt + t]);
      if (!col) return; // too few cells: left as bare paper
      ctx.fillStyle = col;
      ctx.fillRect(lw + j * cw, y, cw - gx, h - gy);
    });
  }

  function paintPins(vals) {
    const { lw, cw, W } = S.geom, m = S.m, H = PIN_H * 3 + 12, x0 = scrollX0();
    const ctx = fitCanvas($("#cvPin"), W, H);
    const sw = [C.ink3, C.anchor, C.sel];
    const hot = S.hover && S.hover.where === "pins" ? S.hover : null;
    S.pins.forEach((i, r) => { if (i >= 0) paintCells(ctx, vals, i, r * PIN_H + 4, PIN_H - 2); });
    ctx.lineWidth = 1;
    if (hot && hot.j >= 0) { ctx.strokeStyle = rgb(C.ink); ctx.strokeRect(lw + hot.j * cw - 0.5, hot.r * PIN_H + 3.5, cw + 1, PIN_H - 1); }
    const sel = S.cols.indexOf(selType());
    if (sel >= 0) { ctx.strokeStyle = rgb(C.sel); ctx.strokeRect(lw + sel * cw - 0.5, 3.5, cw + 1, PIN_H * 3 - 1); }
    dimForSpot(ctx, S.pins, (r) => r * PIN_H + 4, PIN_H - 2);
    labelPanel(ctx, x0, H - 6);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `italic 14px ${SERIF}`;
    S.pins.forEach((i, r) => {
      const y = r * PIN_H + 3;
      ctx.fillStyle = rgb(sw[r]);
      ctx.beginPath(); ctx.arc(x0 + lw - 12, y + PIN_H / 2, 3.6, 0, 7); ctx.fill();
      const label = i < 0 ? "name a drug above" : r === 0 ? `${baseName()}, the baseline` : condLabel(m.conds[i]);
      ctx.fillStyle = rgb(i < 0 ? C.ink3 : r === 2 ? C.sel : hot && hot.r === r ? C.ink : C.ink2);
      ctx.fillText(clip(ctx, label, lw - 42), x0 + lw - 22, y + PIN_H / 2 + 1);
      if (i >= 0) stabMark(ctx, m.conds[i], x0 + 3, y + 1, PIN_H - 2);
    });
    penLine(ctx, 0, H - 4, W - 6, H - 4, 3, rgb(C.ink), 0.8);
    ctx.textAlign = "left";
  }

  function paintRows(vals) {
    const { lw, cw, rh, W } = S.geom, m = S.m, nr = S.rows.length, x0 = scrollX0();
    const ctx = fitCanvas($("#cvRows"), W, Math.max(rh * nr, 1));
    const hot = S.hover && S.hover.where === "rows" ? S.hover : null;
    if (hot && hot.j >= 0) { ctx.fillStyle = rgb(C.ink, 0.05); ctx.fillRect(lw + hot.j * cw, 0, cw, rh * nr); }
    S.rows.forEach((i, r) => paintCells(ctx, vals, i, r * rh, rh));
    ctx.lineWidth = 1;
    const fr = S.rows.indexOf(S.focus);
    if (fr >= 0) { ctx.strokeStyle = rgb(C.sel); ctx.strokeRect(lw - 0.5, fr * rh - 0.5, cw * S.cols.length + 1, rh + 1); }
    const sel = S.cols.indexOf(selType());
    if (sel >= 0) { ctx.strokeStyle = rgb(C.sel); ctx.strokeRect(lw + sel * cw - 0.5, -0.5, cw + 1, rh * nr + 1); }
    if (hot && hot.j >= 0) { ctx.strokeStyle = rgb(C.ink); ctx.strokeRect(lw + hot.j * cw - 0.5, hot.r * rh - 0.5, cw + 1, rh + 1); }
    dimForSpot(ctx, S.rows, (r) => r * rh, rh);
    labelPanel(ctx, x0, rh * nr);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    S.rows.forEach((i, r) => {
      const y = r * rh, isHot = hot && hot.r === r, ctl = m.conds[i].control;
      if (i === S.focus) { ctx.fillStyle = rgb(C.sel, 0.07); ctx.fillRect(x0, y, lw - 4, rh); }
      if (rh >= 9) {
        ctx.font = `${ctl ? "italic " : ""}${Math.min(12.5, rh - 1)}px ${SERIF}`;
        ctx.fillStyle = rgb(i === S.focus || spotR(i) ? C.sel : isHot ? C.ink : ctl ? C.ink3 : C.ink2);
        ctx.fillText(clip(ctx, condLabel(m.conds[i]), lw - 26), x0 + lw - 6, y + rh / 2 + 0.5);
      } else if (isHot || i === S.focus) {
        ctx.fillStyle = rgb(i === S.focus ? C.sel : C.ink);
        ctx.fillRect(x0 + lw - 8, y, 4, Math.max(2, rh - 1));
      }
      stabMark(ctx, m.conds[i], x0 + 3, y, rh);
    });
    ctx.textAlign = "left";
  }

  function legendAndCaption() {
    const m = S.m, g = geneName();
    const what = g ? `the share of each cell set expressing ${g}` : "the share of cells in each cell set";
    const cap = {
      pct: `Each square is ${what}`,
      delta: `Each square is the change in ${what}, against ${baseName()} on the same plate`,
      z: `Each square is ${what} as a z-score: ${m.z_method === "robust" ? "each well against every well on its plate" : `the drug's samples against ${baseName()}'s samples`}`,
    }[S.mode];
    $("#caption").innerHTML = `<b>${esc(cap)}.</b> ${S.rows.length} ${m.dataset.startsWith("megafin") ? "drug-doses" : "drugs"} against ${S.cols.length} ${typeWord()}. `
      + `Hover a square to read it; click a drug, or the name of a cell set, for its page below the plate.`;
    const lo = S.mode === "pct" ? "0" : S.mode === "z" ? "−4" : ppF(-S.max);
    const hi = S.mode === "pct" ? pctF(S.max) : S.mode === "z" ? "+4" : ppF(S.max);
    const words = g ? [`lower than ${baseName()}`, "higher"] : [`fewer cells than ${baseName()}`, "more"];
    $("#legend").innerHTML = `<span class="lhead">scale</span><span class="ramp">${lo}<i class="bar" style="background:${gradient()}"></i>${hi}</span>`
      + (S.mode === "pct" ? "" : `<span><i class="sw" style="background:${rgb(C.down)}"></i>${words[0]}</span><span><i class="sw" style="background:${rgb(C.up)}"></i>${words[1]}</span>`)
      + `<span>bare paper: too few cells to say</span>` + stabLegend();
    const zText = m.z_method === "robust"
      ? "How surprising the gap is. A set's share wobbles from well to well even without a drug; z measures the gap in units of that ordinary wobble, taken across every well on the plate. Near 0 is ordinary, beyond ±2 unusual, beyond ±3 rare. Each drug-dose is a single well, so a large z is a lead to follow, not a verdict."
      : `How surprising the gap is, given how much the drug's samples and ${baseName()}'s samples vary among themselves (a Welch t). Beyond ±2 is unlikely to be chance alone.`;
    const ex = examples(TM.matrices(m, S.layer));
    $("#reading").innerHTML = `<span class="lhead">reading a square</span><dl>`
      + `<div><dt>share %</dt><dd>${g ? `Of a set's cells, the percentage that express ${esc(g)}.` : "Of all a drug's cells, the percentage that fall in a cell set."} The % proportion view colours by this.${ex.share}</dd></div>`
      + `<div><dt>&Delta; pp</dt><dd>The drug's share minus ${esc(baseName())}'s share on the same plate, in percentage points: a set that goes from 2% to 3% of the cells is +1 pp. Ochre squares sit above the baseline, indigo below.${ex.delta}</dd></div>`
      + `<div><dt>z</dt><dd>${zText}${ex.z}</dd></div></dl>`;
    const tiny = hiddenTiny(), minN = MIN_TYPE_N[S.ds] || 0;
    $("#status").innerHTML = (S.notice ? `<b>${esc(S.notice)}</b> ` : "")
      + (tiny ? `${tiny} ${typeWord()} of fewer than ${minN} cells are left off; <button data-act="tiny">show them</button>. `
        : S.showTiny && minN ? `<button data-act="tiny">leave off ${typeWord()} under ${minN} cells</button>. ` : "")
      + `How these numbers are made, and what they do not show: <button data-act="notes">the notes</button>.`;
  }

  // Worked examples for the reading key, drawn from the plate as it stands (visible rows and sets,
  // umbrella sets left out), so they move with every filter, dose and baseline.
  function examples(mats) {
    const m = S.m, nt = m.nt, b = m.base, g = geneName();
    const V = mats.pct, D = mats.delta, Z = mats.z;
    // a near-empty well (Budesonide 5 µM holds 168 cells) makes every gap look huge, so examples skip small wells
    const MIN_CELLS = 1000, cellsIn = (i) => m.conds[i].units.reduce((s, u) => s + m.units[u].n, 0);
    const rows = S.rows.filter((i) => !m.conds[i].control && i !== b && cellsIn(i) >= MIN_CELLS);
    const cols = S.cols.filter((t) => !m.types[t].umbrella);
    const nm = (t) => `<button class="lnk" data-type="${t}">${esc(m.types[t].name)}</button>`;
    const dr = (i) => `<button class="lnk" data-cond="${i}">${esc(condLabel(m.conds[i]))}</button>`;
    const hd = '<span class="exh">for example</span>';
    const out = { share: "", delta: "", z: "" };
    const inSet = (t) => (g ? `of ${esc(m.types[t].name)} cells express <i>${esc(g)}</i>` : `of cells are ${nm(t)}`);
    const byShare = cols.filter((t) => V[b * nt + t] > 0).sort((x, y) => V[b * nt + y] - V[b * nt + x]);
    if (byShare.length > 1) {
      const hi = byShare[0], lo = byShare[byShare.length - 1];
      out.share = `<p class="ex">${hd}in ${esc(baseName())}, <b>${pctF(V[b * nt + hi])}</b> ${inSet(hi)}, the most of any set here, `
        + `while ${g ? `for ${esc(m.types[lo].name)} it is` : `${nm(lo)} makes up`} only <b>${pctF(V[b * nt + lo])}</b>. `
        + `A share says how common a cell type is, not yet whether a drug changed it.</p>`;
    }
    const cells = [];
    for (const i of rows) for (const t of cols) {
      const k = i * nt + t;
      if (Number.isFinite(V[k]) && Number.isFinite(D[k]) && Number.isFinite(Z[k])) cells.push({ i, t, k, d: Math.abs(D[k]), z: Math.abs(Z[k]) });
    }
    if (!cells.length) return out;
    const big = cells.reduce((a, c) => (c.d > a.d ? c : a));
    const fromTo = (c) => `from <b>${pctF(V[c.k] - D[c.k])}</b> to <b>${pctF(V[c.k])}</b>`;
    out.delta = `<p class="ex">${hd}${dr(big.i)} takes ${g ? `the share of ${nm(big.t)} cells expressing <i>${esc(g)}</i>` : nm(big.t)} ${fromTo(big)}, `
      + `<b>&Delta; ${ppF(D[big.k])}</b>: out of every 100 ${g ? `${esc(m.types[big.t].name)} ` : ""}cells, about ${(big.d * 100).toFixed(1)} `
      + `${D[big.k] >= 0 ? "more" : "fewer"} ${g ? "express it" : "are of that type"} than in ${esc(baseName())}. `
      + `The biggest gap on the plate, leaving out wells of fewer than ${nF(MIN_CELLS)} cells; the same Δ means more for a rare set than a common one, which is what z is for.</p>`;
    const quiet = cells.filter((c) => c.z >= 3).sort((x, y) => x.d - y.d)[0];
    const dq = TM.quantile(cells.map((c) => c.d), 0.9);
    const loud = cells.filter((c) => c.d >= dq && c !== quiet).sort((x, y) => x.z - y.z)[0];
    const vary = m.z_method === "robust" ? "from well to well" : "from sample to sample";
    if (quiet) {
      out.z = `<p class="ex">${hd}${dr(quiet.i)} moves ${nm(quiet.t)} by only <b>${ppF(D[quiet.k])}</b> yet scores <b>z ${zF(Z[quiet.k])}</b>: `
        + `that set hardly varies ${vary}, so even a small shift stands out.`
        + (loud ? ` By contrast, ${dr(loud.i)} moves ${nm(loud.t)} by <b>${ppF(D[loud.k])}</b> but scores only <b>z ${zF(Z[loud.k])}</b>: `
          + `that set swings about that much ${vary} anyway.` : "") + `</p>`;
    }
    return out;
  }

  function chips() {
    const a = anchorIdx(), m = S.m;
    if (document.activeElement !== $("#baseQ")) $("#baseQ").value = baseName();
    document.querySelector("#modeSeg [data-mode=delta]").innerHTML = `&Delta; ${esc(baseShort())}`;
    if (document.activeElement !== $("#refQ")) $("#refQ").value = a >= 0 ? condLabel(m.conds[a]) : refName();
    if (document.activeElement !== $("#drugQ")) $("#drugQ").value = S.focus >= 0 ? condLabel(m.conds[S.focus]) : "";
    $("#sortSel option[value=similar]").textContent = `most like ${refName()}`;
    document.querySelectorAll("#modeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
    document.querySelectorAll("#dsSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ds === S.ds)));
    const st = selType();
    $("#sortSel option[value=set]").textContent = st >= 0 ? `by ${m.types[st].name}` : "by the chosen cell set (click a set's name)";
    document.querySelectorAll("#storyKeys button").forEach((b) => b.setAttribute("aria-pressed", String(!!S.story && +b.dataset.story === S.story.k)));
  }

  function writeUrl() {
    const m = S.m, p = new URLSearchParams();
    p.set("ds", S.ds);
    if (S.focus >= 0) p.set("drug", m.conds[S.focus].id);
    if (S.mode !== "delta") p.set("mode", S.mode);
    if (S.tissue) p.set("tissue", S.tissue);
    if (S.gene >= 0) p.set("gene", m.genes[S.gene]);
    if (m.doses.length && S.dose !== m.doses[0]) p.set("dose", S.dose || "both");
    if (S.ref && S.ref !== m.anchor) p.set("ref", S.ref);
    if (m.conds[m.base].id !== m.baseline) p.set("base", m.conds[m.base].id);
    if (S.sort !== "response") p.set("order", S.sort);
    if (S.story) p.set("story", S.story.k + 1);
    try { history.replaceState(null, "", `${location.pathname}?${p}`); } catch { /* sandboxed frame */ }
  }

  // ------------------------------------------------------------------ the margin
  function section(title, body) { return `<section><h3>${esc(title)}</h3>${body}</section>`; }
  const clsOf = (x) => (x === S.m.base ? "k0" : S.m.anchors.includes(x) ? "k1" : "k2");
  const dotOf = (x) => (x === S.m.base ? "d0" : S.m.anchors.includes(x) ? "d1" : "d2");
  const keyHtml = (trio) => `<div class="keys">${trio.map((x) => `<span><i class="dot ${dotOf(x)}"></i>${esc(condLabel(S.m.conds[x]))}</span>`).join("")}</div>`;
  const condBtn = (k) => `<button class="lnk" data-cond="${k}">${esc(condLabel(S.m.conds[k]))}</button>`;
  const typeBtn = (t) => `<button class="lnk" data-type="${t}">${esc(S.m.types[t].name)}</button>`;

  function barsSVG(groups, max) {
    const W = 314, lab = 118, bw = W - lab - 56, bh = 8;
    let y = 3, s = "";
    for (const g of groups) {
      const gh = g.bars.length * (bh + 4) - 4;
      s += `<text x="0" y="${y + gh / 2 + 3}" font-style="italic"><title>${esc(g.label)}</title>${esc(cut(g.label, 20))}</text>`;
      for (const b of g.bars) {
        const w = Number.isFinite(b.v) ? Math.max(1, bw * Math.min(1, b.v / max)) : 0;
        s += `<rect class="${b.cls}" x="${lab}" y="${y}" width="${w.toFixed(1)}" height="${bh}"/>`;
        // values sit in their own column past the longest bar, so the per-unit dots never overprint them
        s += `<text x="${lab + bw + 8}" y="${y + bh}">${pctF(b.v)}</text>`;
        for (const d of b.dots || []) {
          if (Number.isFinite(d)) s += `<circle class="pt" cx="${(lab + bw * Math.min(1, d / max)).toFixed(1)}" cy="${y + bh / 2}" r="1.7"/>`;
        }
        y += bh + 4;
      }
      y += 9;
    }
    return `<svg viewBox="0 0 ${W} ${y}" width="100%" role="img" aria-label="proportions by condition">${s}</svg>`;
  }

  function stripSVG(sim, me) {
    const W = 314, H = 40, x = (r) => 8 + ((W - 16) * (r + 1)) / 2;
    let s = `<line class="ax" x1="8" x2="${W - 8}" y1="20" y2="20"/>`;
    for (const v of [-1, 0, 1]) s += `<line class="ax" x1="${x(v)}" x2="${x(v)}" y1="16" y2="24"/><text x="${x(v)}" y="37" text-anchor="middle">${v}</text>`;
    for (const [k, r] of sim) if (k !== me) s += `<line class="tk" x1="${x(r).toFixed(1)}" x2="${x(r).toFixed(1)}" y1="13" y2="27"/>`;
    const hit = sim.find((p) => p[0] === me);
    if (hit) s += `<line class="me" x1="${x(hit[1]).toFixed(1)}" x2="${x(hit[1]).toFixed(1)}" y1="4" y2="31"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="similarity of every drug to Sorafenib">${s}</svg>`;
  }

  function measureNote() {
    const g = geneName();
    return g ? `The share of each set expressing <i>${esc(g)}</i>.` : "The share of all cells in the condition.";
  }

  function detailCond(i) {
    const m = S.m, nt = m.nt, mats = TM.matrices(m, S.layer), c = m.conds[i], cols = S.cols;
    const isBase = i === m.base, isAnchor = m.anchors.includes(i);
    const a = TM.anchorFor(m, i, S.dose);
    const N = c.units.reduce((s, u) => s + m.units[u].n, 0);
    const zr = TM.row(mats.z, i, nt), dr = TM.row(mats.delta, i, nt), pr = TM.row(mats.pct, i, nt);
    const ranked = cols.filter((t) => Number.isFinite(zr[t])).sort((x, y) => Math.abs(zr[y]) - Math.abs(zr[x]));
    let h = `<div class="dk">${isBase ? "the baseline" : isAnchor ? "the reference" : c.control ? "a control" : "a drug"}</div>`
      + `<h2>${esc(condLabel(c))}</h2><p class="meta">${esc(c.plate)}, ${c.units.length} ${unitWord(c.units.length)}, ${nF(N)} cells</p>`;

    const trio = [m.base, a, i].filter((x, k, arr) => x >= 0 && arr.indexOf(x) === k);
    const top = (isBase ? cols.filter((t) => Number.isFinite(pr[t])).sort((x, y) => pr[y] - pr[x]) : ranked).slice(0, 8);
    const groups = top.map((t) => ({ label: m.types[t].name, bars: trio.map((x) => ({ v: mats.pct[x * nt + t], cls: clsOf(x) })) }));
    const max = Math.max(1e-9, ...groups.flatMap((g) => g.bars.map((b) => b.v)).filter(Number.isFinite));
    h += section("Proportions across the three conditions",
      keyHtml(trio) + barsSVG(groups, max)
      + `<p class="note">${measureNote()} ${isBase ? "Its largest populations." : "The eight populations it moves most."}</p>`);

    if (!isBase) {
      const rowsHtml = ranked.slice(0, 10).map((t) => `<tr><td>${typeBtn(t)}</td><td class="n ${dr[t] >= 0 ? "up" : "dn"}">${ppF(dr[t])}</td><td class="n">${zF(zr[t])}</td></tr>`).join("");
      h += section("Strongest affected populations",
        ranked.length ? `<table><thead><tr><th>population</th><th class="n">&Delta; ${esc(baseShort())}</th><th class="n">z</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
          : `<p class="note">No population has enough cells to score.</p>`);
    }

    if (!isBase && !c.control) {
      const sim = simList(mats, cols, i, c.dose || S.dose);
      if (isAnchor) {
        const list = sim.filter((p) => p[0] !== i).slice(0, 8);
        h += section(`Response similarity to ${refName()}`,
          `<p>This is the reference. The drugs whose z-score profile over the ${cols.length} ${typeWord()} on the plate looks most like it:</p>`
          + stripSVG(sim, -1)
          + `<table><tbody>${list.map(([k, r]) => `<tr><td>${condBtn(k)}</td><td class="n">r ${rF(r)}</td></tr>`).join("")}</tbody></table>`);
      } else {
        const idx = sim.findIndex((p) => p[0] === i);
        const r = idx >= 0 ? sim[idx][1] : NaN;
        const peers = sim.filter((p) => p[0] !== i).slice(0, 5);
        h += section(`Response similarity to ${refName()}`,
          `<p><span class="big">r ${rF(r)}</span><span class="d">${idx >= 0 ? `${idx + 1} of ${sim.length} drugs` : "not enough overlap"}</span></p>`
          + stripSVG(sim, i)
          + `<p class="note">Pearson r between this drug's z-score profile and ${esc(condLabel(m.conds[a] || { drug: m.anchor }))}'s, over the ${cols.length} ${typeWord()} on the plate. Each tick is a drug; the madder one is this.</p>`
          + `<table style="margin-top:8px"><thead><tr><th>most like ${esc(refName())}</th><th class="n">r</th></tr></thead><tbody>${peers.map(([k, rr]) => `<tr><td>${condBtn(k)}</td><td class="n">${rF(rr)}</td></tr>`).join("")}</tbody></table>`);
      }
    }
    return h;
  }

  function detailType(t) {
    const m = S.m, nt = m.nt, mats = TM.matrices(m, S.layer), ty = m.types[t], L = S.layer;
    const a = anchorIdx();
    const trio = [m.base, a, S.focus].filter((x, k, arr) => x >= 0 && arr.indexOf(x) === k);
    let h = `<div class="dk">${esc(ty.tissue)}${ty.umbrella ? " · an umbrella set" : ""}</div><h2>${esc(ty.name)}</h2>`
      + `<p class="meta">${nF(ty.n)} cells${ty.n_transfer ? `, ${Math.round((100 * ty.n_transfer) / ty.n)}% of them named by label transfer` : ""}</p>`;
    const groups = trio.map((x) => ({
      label: condLabel(m.conds[x]),
      bars: [{ v: mats.pct[x * nt + t], cls: clsOf(x), dots: m.conds[x].units.map((u) => TM.unitVal(L, u, t, nt)) }],
    }));
    const max = Math.max(1e-9, ...groups.flatMap((g) => [g.bars[0].v, ...g.bars[0].dots]).filter(Number.isFinite));
    h += section("Proportions across the three conditions",
      keyHtml(trio) + barsSVG(groups, max) + `<p class="note">${measureNote()} Each dot is a single ${unitWord(1)}.</p>`);

    const cands = m.conds.map((_, k) => k).filter((k) => !m.conds[k].control && Number.isFinite(mats.z[k * nt + t]) && (!S.dose || m.conds[k].dose === S.dose));
    const zOf = (k) => mats.z[k * nt + t], dOf = (k) => mats.delta[k * nt + t];
    const byZ = cands.slice().sort((x, y) => zOf(y) - zOf(x));
    const up = byZ.filter((k) => zOf(k) > 0).slice(0, 5), down = byZ.filter((k) => zOf(k) < 0).reverse().slice(0, 5);
    const tr = (k) => `<tr><td>${condBtn(k)}</td><td class="n ${dOf(k) >= 0 ? "up" : "dn"}">${ppF(dOf(k))}</td><td class="n">${zF(zOf(k))}</td></tr>`;
    h += section("Strongest affected populations",
      `<p class="note" style="margin:0 0 8px">For a population, the drugs that move it most.</p>`
      + `<table><thead><tr><th>swell it</th><th class="n">&Delta; ${esc(baseShort())}</th><th class="n">z</th></tr></thead><tbody>${up.map(tr).join("")}</tbody></table>`
      + `<table style="margin-top:10px"><thead><tr><th>thin it</th><th class="n">&Delta; ${esc(baseShort())}</th><th class="n">z</th></tr></thead><tbody>${down.map(tr).join("")}</tbody></table>`);

    if (a >= 0) {
      const az = zOf(a);
      const same = cands.filter((k) => !m.anchors.includes(k) && Math.sign(zOf(k)) === Math.sign(az) && Math.abs(zOf(k)) >= 2)
        .sort((x, y) => Math.abs(zOf(y)) - Math.abs(zOf(x)));
      h += section(`Response similarity to ${refName()}`,
        `<p><span class="big">z ${zF(az)}</span><span class="d">${esc(condLabel(m.conds[a]))} here</span></p>`
        + (Math.abs(az) < 1 ? `<p class="note">${esc(refName())} barely moves this population, so agreeing with it here says little.</p>`
          : `<p>${same.length} of ${cands.length - 1} drugs move it the same way at |z| of 2 or more${same.length ? ":" : "."}</p>`
            + `<table><tbody>${same.slice(0, 8).map((k) => `<tr><td>${condBtn(k)}</td><td class="n">${zF(zOf(k))}</td></tr>`).join("")}</tbody></table>`));
    }
    return h;
  }

  function renderDetail() {
    const d = S.detail, el = $("#detail");
    if (!d) { el.innerHTML = `<p class="note">Click a drug or a cell type.</p>`; return; }
    el.innerHTML = d.kind === "type" ? detailType(d.i) : detailCond(d.i);
    // the eyebrow, title and meta line run across the top of the row; the sections sit side by side under it
    const head = document.createElement("div");
    head.className = "dhead";
    [...el.children].filter((c) => c.tagName !== "SECTION").forEach((c) => head.appendChild(c));
    el.prepend(head);
  }

  function openCond(i) {
    const m = S.m;
    if (!m.conds[i].control && !m.anchors.includes(i)) { S.focus = i; $("#drugQ").value = condLabel(m.conds[i]); }
    S.detail = { kind: "cond", i };
    render();
  }
  function openType(t) { S.detail = { kind: "type", i: t }; render(); }

  // ------------------------------------------------------------------ hover + click
  function hit(cv, e, kind) {
    if (!S.geom) return null;
    const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, { lw, cw, rh } = S.geom;
    const inNames = x - $("#hmwrap").scrollLeft < lw; // the pinned name column, wherever the plate has scrolled
    const j = !inNames && x >= lw ? Math.floor((x - lw) / cw) : -1;
    if (j >= S.cols.length) return null;
    const t = j >= 0 ? S.cols[j] : null;
    if (kind === "head") return j >= 0 ? { where: "head", j, t } : null;
    const stab = x - $("#hmwrap").scrollLeft < 15; // the stock-stability swatch at the name column's left edge
    if (kind === "pins") {
      const r = Math.floor((y - 3) / PIN_H), i = S.pins[r];
      return r >= 0 && r < 3 && i >= 0 ? { where: "pins", r, i, j, t, stab } : null;
    }
    const r = Math.floor(y / rh);
    return r >= 0 && r < S.rows.length ? { where: "rows", r, i: S.rows[r], j, t, stab } : null;
  }

  function tipHtml(h) {
    const m = S.m, nt = m.nt;
    if (h.where === "head") {
      const ty = m.types[h.t];
      return `<b>${esc(ty.name)}</b><br><span class="d">${esc(ty.tissue)}, ${nF(ty.n)} cells${ty.n_transfer ? `, ${Math.round((100 * ty.n_transfer) / ty.n)}% by transfer` : ""}</span>`;
    }
    const c = m.conds[h.i];
    if (h.stab) return stabTip(c);
    if (h.j < 0) return `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)}</span>`;
    const mats = TM.matrices(m, S.layer), k = h.i * nt + h.t, g = geneName(), set = esc(m.types[h.t].name);
    const n = c.units.reduce((s, u) => s + m.counts[u * nt + h.t], 0), N = c.units.reduce((s, u) => s + m.units[u].n, 0);
    const v = mats.pct[k], d = mats.delta[k], base = v - d, z = mats.z[k];
    const head = `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)}</span><br><i>${set}</i>`;
    const count = `<span class="d">${nF(n)} of ${nF(N)} cells, ${c.units.length} ${unitWord(c.units.length)}.</span>`;
    if (!Number.isFinite(v)) return `${head}<p class="d">Too few cells here to say anything.</p>`;
    const where = c.units.length === 1 ? (m.dataset.startsWith("megafin") ? "this well" : "this sample") : `its ${c.units.length} ${unitWord(c.units.length)}`;
    if (h.i === m.base) {
      return `${head}<p><b class="v">${pctF(v)}</b> of ${esc(baseName())}'s cells ${g ? `in this set express <i>${esc(g)}</i>` : `are ${set}`}. `
        + `It is the baseline: every other row is measured against it, so its own gap is zero.</p>${count}`;
    }
    const share = g ? `<b class="v">${pctF(v)}</b> of the ${set} cells in ${where} express <i>${esc(g)}</i>, against ${pctF(base)} in ${esc(baseName())}.`
                    : `<b class="v">${pctF(v)}</b> of the cells in ${where} are ${set}, against ${pctF(base)} in ${esc(baseName())}.`;
    const ratio = v / base;
    const fold = base > 0 && v > 0 ? ` That is ${ratio.toFixed(ratio < 10 ? 1 : 0)} times ${esc(baseName())}'s share.` : "";
    const delta = `<b class="v ${d >= 0 ? "up" : "dn"}">&Delta; ${ppF(d)}</b> is that gap in percentage points: `
      + `${Math.abs(d * 100).toFixed(2)} points ${d >= 0 ? "above" : "below"} ${esc(baseName())}.${fold}`;
    const az = Math.abs(z);
    const verdict = !Number.isFinite(z) ? "can't be judged here" : az < 1 ? "is ordinary" : az < 2 ? "is a modest shift" : az < 3 ? "is unusual" : "is rare, among the strongest";
    const how = m.z_method === "robust" ? "next to how much this set normally varies from well to well on the plate"
                                        : `given how much the drug's samples and ${esc(baseName())}'s samples vary among themselves`;
    const zl = `<b class="v">z ${zF(z)}</b> says how surprising the gap is, ${how}: it ${verdict}${Number.isFinite(z) ? " (0 is typical, ±2 unusual, ±3 rare)" : ""}.`;
    return `${head}<p>${share}</p><p>${delta}</p><p>${zl}</p>${count}`;
  }

  function showTip(html, e) {
    const tip = $("#tip");
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + hh > innerHeight - 8) y = e.clientY - hh - 16;
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.max(4, y)}px`;
  }

  function wireCanvas(id, kind) {
    const cv = $(id);
    cv.addEventListener("mousemove", (e) => {
      const h = hit(cv, e, kind);
      S.hover = h;
      if (h) showTip(tipHtml(h), e); else $("#tip").hidden = true;
      requestPaint();
    });
    cv.addEventListener("mouseleave", () => { S.hover = null; $("#tip").hidden = true; requestPaint(); });
    cv.addEventListener("click", (e) => {
      const h = hit(cv, e, kind);
      if (!h) return;
      $("#tip").hidden = true;
      if (h.where === "head") openType(h.t); else openCond(h.i);
    });
  }

  // ------------------------------------------------------------------ naming a drug
  // A text field that opens a list: focus shows everything, typing filters, arrows and Enter pick.
  function wireCombo(q, list, itemsFor, choose, restore) {
    let items = [], sel = -1;
    const mark = () => {
      [...list.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === sel)));
      const li = list.children[sel];
      if (li) li.scrollIntoView({ block: "nearest" });
    };
    const show = (filter) => {
      if (!S.m) return;
      items = itemsFor(filter.trim().toLowerCase()).slice(0, 80);
      sel = items.length ? 0 : -1;
      list.innerHTML = items.map((it, k) => `<li role="option" data-k="${k}">${esc(it.label)}<span>${esc(it.sub || "")}</span></li>`).join("");
      mark();
      list.hidden = !items.length;
      q.setAttribute("aria-expanded", String(!list.hidden));
    };
    const hide = () => { list.hidden = true; q.setAttribute("aria-expanded", "false"); };
    const pick = (k) => { const it = items[k]; hide(); q.blur(); if (it) choose(it.key); };
    q.addEventListener("focus", () => { q.select(); show(""); });
    q.addEventListener("input", () => show(q.value));
    q.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { hide(); q.blur(); return; }
      if (list.hidden) return;
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0) { pick(sel); e.preventDefault(); }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (li) { e.preventDefault(); pick(+li.dataset.k); }
    });
    q.addEventListener("blur", () => setTimeout(() => { hide(); if (S.m) q.value = restore(); }, 120));
  }

  function wireSearch() {
    // the named drug (third pinned row)
    wireCombo($("#drugQ"), $("#drugList"),
      (s) => S.m.conds.map((c, i) => [c, i])
        .filter(([c, i]) => !c.control && !S.m.anchors.includes(i) && condLabel(c).toLowerCase().includes(s))
        .map(([c, i]) => ({ key: i, label: condLabel(c), sub: c.plate })),
      (i) => openCond(i),
      () => (S.focus >= 0 ? condLabel(S.m.conds[S.focus]) : ""));
    // the reference drug (second pinned row): any drug, both its doses follow
    wireCombo($("#refQ"), $("#refList"),
      (s) => [...new Set(S.m.conds.filter((c) => !c.control).map((c) => c.drug))]
        .sort((x, y) => x.localeCompare(y))
        .filter((d) => d.toLowerCase().includes(s))
        .map((d) => ({ key: d, label: d, sub: d === refName() ? "the reference now" : d === S.m.anchor ? "the default" : "" })),
      (d) => { if (setRef(d)) { S.detail = { kind: "cond", i: anchorIdx() }; render(); } },
      () => { const a = anchorIdx(); return a >= 0 ? condLabel(S.m.conds[a]) : refName(); });
    // the baseline (first pinned row): the controls first, then any drug at one dose
    wireCombo($("#baseQ"), $("#baseList"),
      (s) => S.m.conds.map((c, i) => [c, i])
        .filter(([c]) => condLabel(c).toLowerCase().includes(s))
        .sort(([a], [b]) => (b.control - a.control) || condLabel(a).localeCompare(condLabel(b)))
        .map(([c, i]) => ({ key: i, label: condLabel(c), sub: i === S.m.base ? "the baseline now" : c.control ? "a control" : c.plate })),
      (i) => { setBase(i); S.detail = { kind: "cond", i }; render(); },
      () => baseName());
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); $("#drugQ").focus(); }
    });
  }

  // ------------------------------------------------------------------ notes
  const GENERAL_NOTES = [
    "Cell types are Patrick's hand-drawn cell sets. They overlap by design (umbrella sets such as CNS contain their regions), so a column is the share of all of a unit's cells in that set and columns do not sum to 100%. Cells he put in no set stay in every denominator.",
    "MegaFin part 1 and part 2 are two plates, labelled in separate Trailmaker projects whose set names do not line up one to one, so they are shown side by side and never merged. MiniFin is a separate, smaller experiment with replicate samples.",
    "&Delta; is a drug's share minus the baseline's share on the same plate (DMSO unless you choose another). z differs by design: on MegaFin, where each drug-dose is a single well, it is a robust z of the well against every well on its plate; on MiniFin, which has replicate samples, it is a Welch t against the baseline's samples.",
    "On MegaFin, neighbouring wells resemble each other more than distant ones, and each drug's two doses sit in neighbouring wells, so a single-well effect is a lead to replicate rather than a finding. Story III shows it.",
    "Similarity to the reference is the correlation of two z-score profiles over the sets on screen, at the same dose. The clustered order uses the same correlation, average-linked.",
    "Tissues are a grouping of set names for filtering only. The gene field reads a panel of marker and context genes chosen when the page was built, not the whole transcriptome. Colour runs to the 98th percentile of what is on screen, so the scale moves when you filter.",
    "The eight stories are the page author's reading of the data. Their settings are the page's own controls, and every number they quote is computed from the same counts as the plate.",
    "The plum column left of the drug names is a quick triage of how likely each drug's DMSO stock is to lose potency through freeze-thaw cycles and storage time, read from the molecule's chemistry (esters and lactones that hydrolyse as thawed DMSO takes up water, epoxides, boronates, catechols, quinones, light-sensitive dihydropyridines, macrolides) and common handling guidance, against the background of Kozikowski et al. and Cheng et al. (J Biomol Screen, 2003). It is an estimate, not measured on these plates; hover a swatch for the reason. Built by <code>scripts/trailmaker_stability.py</code>.",
    "Patrick's labels are evaluation data for the labeller; nothing here feeds it.",
  ];

  function fillNotes(m) {
    const idx = S.idx || [];
    $("#notesIntro").textContent = "Three datasets share this page. Each is read from one of Patrick's Trailmaker Seurat objects and from nothing else, and they are never joined: switching dataset swaps the whole plate, with its own cells, its own wells or samples, and its own cell sets.";
    $("#notesSets").innerHTML = idx.map((d) => `<li><b>${esc(d.title.split(" · ")[0])}</b> &nbsp;·&nbsp; ${nF(d.cells)} cells in ${d.units} ${d.unit}, ${d.drugs} drugs, ${d.sets} cell sets &nbsp;·&nbsp; <code>${esc(d.source)}</code></li>`).join("");
    $("#byline").textContent = idx.length
      ? `three datasets · ${nF(idx.reduce((s, d) => s + d.cells, 0))} cells · Patrick's hand-drawn cell sets`
      : `${nF(m.units.reduce((s, u) => s + u.n, 0))} cells · Patrick's hand-drawn cell sets`;
    $("#notesList").innerHTML = GENERAL_NOTES.map((n) => `<li>${n}</li>`).join("");
    $("#notesHereHead").textContent = `About ${m.title.split(" · ")[0]}, the dataset now on the plate`;
    $("#notesHere").innerHTML = m.notes.map((n) => `<li>${esc(n)}</li>`).join("");
    $("#colophon").innerHTML = `Built ${esc(m.built)} by <code>scripts/export_trailmaker_rds.R</code> and <code>scripts/build_trailmaker_ui.py</code>, which ship cell counts only; `
      + `every number on the plate, and in the stories, is worked out in the browser by <code>tm-stats.js</code>. What the page claims and does not: <code>public/trailmaker_UI/NOTES.md</code>.`;
  }

  // ------------------------------------------------------------------ stories
  // Eight readings of the data. Each is a preset of the page's own controls plus a few beats of
  // narration; each beat spotlights the rows and columns it is about and dims the rest. Numbers in
  // the narration come from storyKit(), i.e. from the loaded counts, never from typed text.
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  // set names differ slightly between the two MegaFin projects; this lines them up for cross-plate numbers only
  const normSet = (s) => s.toLowerCase().replace(/[()]/g, "").replace(/floor ?plate/, "floorplate").replace(/\/melanoblasts/, "")
    .replace(/schwann cells?( precursors)?/, "schwann").replace(/sclerotome.*/, "sclerotome").replace(/pronephros.*/, "pronephros")
    .replace(/endocrine pancreas.*/, "endocrine pancreas").trim();
  async function ensureAux(ds) {
    S.aux = S.aux || {};
    if (S.aux[ds]) return;
    try { const r = await fetch(`/trailmaker_UI/data/${ds}.json`); if (r.ok) S.aux[ds] = TM.prepare(await r.json()); } catch { /* the beat will print "–" */ }
  }
  const spotR = (i) => !!(S.spot && S.spot.rows.has(i));
  const spotT = (t) => !!(S.spot && S.spot.types.has(t));
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

  function dimForSpot(ctx, rowIdx, yOf, h) {
    if (!S.spot || (!S.spot.rows.size && !S.spot.types.size) || !rowIdx.length) return;
    const { lw, cw } = S.geom;
    ctx.fillStyle = rgb(C.paper, 0.74);
    rowIdx.forEach((i, r) => {
      if (i < 0 || spotR(i)) return;
      S.cols.forEach((t, j) => { if (!spotT(t)) ctx.fillRect(lw + j * cw, yOf(r), cw, h); });
    });
    ctx.save();
    ctx.strokeStyle = rgb(C.sel);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 2]);
    rowIdx.forEach((i, r) => { if (i >= 0 && spotR(i)) ctx.strokeRect(lw - 1.5, yOf(r) - 1, cw * S.cols.length + 2, h + 1); });
    const top = yOf(0), bottom = yOf(rowIdx.length - 1) + h;
    S.cols.forEach((t, j) => { if (spotT(t)) ctx.strokeRect(lw + j * cw - 1, top - 1, cw + 1, bottom - top + 1); });
    ctx.restore();
  }

  function storyKit() {
    const m = S.m, nt = m.nt, M = TM.matrices(m, S.layer);
    const c = (drug, dose) => m.conds.findIndex((x) => x.drug === drug && (dose == null || x.dose === String(dose)));
    const t = (name) => m.types.findIndex((x) => x.name === name);
    const val = (A, d, dose, s) => { const i = c(d, dose), j = t(s); return i < 0 || j < 0 ? NaN : A[i * nt + j]; };
    const cols = S.cols.filter((j) => !m.types[j].umbrella);
    const cellsOf = (i) => m.conds[i].units.reduce((s, u) => s + m.units[u].n, 0);
    const wellOf = (i) => { const mt = m.units[m.conds[i].units[0]].id.match(/_([A-H])(\d{1,2})_CP0/); return mt ? { r: "ABCDEFGH".indexOf(mt[1]), c: +mt[2], w: mt[1] + mt[2], row: mt[1] } : null; };
    const R = (a, b) => TM.pearson(TM.row(M.z, a, nt), TM.row(M.z, b, nt), cols);
    const drugRows = m.conds.map((_, i) => i).filter((i) => !m.conds[i].control && cellsOf(i) >= 1000);
    const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
    // the neighbour check: median z of the other drugs' wells touching this one (needs two of them)
    const nbrZ = (i, j) => {
      const w = i >= 0 && wellOf(i); if (!w || j < 0) return NaN;
      const zs = drugRows.filter((k) => { if (k === i || m.conds[k].drug === m.conds[i].drug) return false; const wk = wellOf(k); return wk && Math.max(Math.abs(wk.r - w.r), Math.abs(wk.c - w.c)) === 1; })
        .map((k) => M.z[k * nt + j]).filter(Number.isFinite).sort((a, b2) => a - b2);
      return zs.length >= 2 ? zs[zs.length >> 1] : NaN;
    };
    const auxK = (ds) => {
      const X = S.aux && S.aux[ds]; if (!X) return null;
      const XM = TM.matrices(X, X.propLayer), xn = X.nt;
      const xt = (name) => X.types.findIndex((u) => u.name === name);
      const xc = (d, dose) => X.conds.findIndex((u) => u.drug === d && (dose == null || u.dose === String(dose)));
      const xcells = (i) => X.conds[i].units.reduce((s, u) => s + X.units[u].n, 0);
      const usable = X.conds.map((_, i) => i).filter((i) => !X.conds[i].control && xcells(i) >= 1000);
      const loose = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
      const xtl = (name) => X.types.findIndex((u) => loose(u.name) === loose(name));
      const medN = (() => { const ns = X.units.map((u) => u.n).sort((a, b) => a - b); return ns[ns.length >> 1]; })();
      const wellsAll = X.conds.map((_, i) => i).filter((i) => !X.conds[i].control);
      const rmsCols = X.types.map((_, j) => j).filter((j) => !X.types[j].umbrella && X.types[j].n >= 100);
      const rms = (i) => TM.responseScore(TM.row(XM.z, i, xn), rmsCols);
      return {
        X, XM, xn, xt, xc,
        basePct: (s) => { const j = xt(s); return j < 0 ? "–" : pctF(XM.pct[X.base * xn + j]); },
        baseVal: (s) => { const j = xt(s); return j < 0 ? NaN : XM.pct[X.base * xn + j]; },
        zv: (d, dose, s) => { const i = xc(d, dose), j = xt(s); return i < 0 || j < 0 ? NaN : XM.z[i * xn + j]; },
        maxAbsDelta: (s) => { const j = xt(s); let best = NaN; for (const i of usable) { const v = Math.abs(XM.delta[i * xn + j]); if (Number.isFinite(v) && !(v <= best)) best = v; } return best; },
        chg: (d, dose, s) => { const i = xc(d, dose), j = xtl(s); if (i < 0 || j < 0) return "–"; const v = XM.pct[i * xn + j] / XM.pct[X.base * xn + j] - 1;
          return Number.isFinite(v) ? `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(100 * v))}%` : "–"; },
        cells: (d, dose) => { const i = xc(d, dose); return i < 0 ? "–" : nF(xcells(i)); },
        cellsX: (d, dose) => { const i = xc(d, dose); return i < 0 ? "–" : `×${(xcells(i) / medN).toFixed(1)}`; },
        flat: (d, dose) => { const i = xc(d, dose); if (i < 0) return "–"; const r = rms(i); return ord(wellsAll.filter((k) => rms(k) < r).length + 1); },
        nWells: wellsAll.length,
        well: (d, dose) => { const i = xc(d, dose); const mt = i >= 0 && X.units[X.conds[i].units[0]].id.match(/_([A-H]\d{1,2})_CP0/); return mt ? mt[1] : "?"; },
      };
    };
    return {
      nbr: (d, dose, s) => zF(nbrZ(c(d, dose), t(s))),
      survivors: () => {
        const byDrug = {}, out = [];
        drugRows.forEach((i) => { (byDrug[m.conds[i].drug] = byDrug[m.conds[i].drug] || []).push(i); });
        for (const [d, is] of Object.entries(byDrug)) {
          if (is.length !== 2) continue;
          for (const j of cols) {
            const r1 = M.z[is[0] * nt + j] - nbrZ(is[0], j), r2 = M.z[is[1] * nt + j] - nbrZ(is[1], j);
            if (Number.isFinite(r1) && Number.isFinite(r2) && Math.sign(r1) === Math.sign(r2) && Math.abs(r1) >= 2 && Math.abs(r2) >= 2) out.push({ d, set: m.types[j].name });
          }
        }
        return out;
      },
      classUp: (drugs, s) => {
        const j = t(s), ws = drugRows.filter((k) => drugs.includes(m.conds[k].drug));
        return { n: ws.length, up: ws.filter((k) => M.z[k * nt + j] > 0).length, plate: drugRows.length, plateUp: drugRows.filter((k) => M.z[k * nt + j] > 0).length };
      },
      rankUp: (d, dose, s) => {
        const j = t(s), i = c(d, dose);
        const ok = drugRows.filter((k) => Number.isFinite(M.z[k * nt + j])).sort((a, b2) => M.z[b2 * nt + j] - M.z[a * nt + j]);
        return ord(ok.indexOf(i) + 1);
      },
      other: auxK,
      crossR: (d, dose) => {
        const A = auxK("megafin"), B = auxK("megafin2"); if (!A || !B) return "–";
        const ia = A.xc(d, dose), ib = B.xc(d, dose); if (ia < 0 || ib < 0) return "–";
        const xs = [], ys = [];
        A.X.types.forEach((u, j) => {
          if (u.umbrella || u.n < 100) return;
          const jb = B.X.types.findIndex((v) => normSet(v.name) === normSet(u.name) && v.n >= 100);
          if (jb < 0) return;
          const za = A.XM.z[ia * A.xn + j], zb = B.XM.z[ib * B.xn + jb];
          if (Number.isFinite(za) && Number.isFinite(zb)) { xs.push(za); ys.push(zb); }
        });
        return rF(TM.pearson(xs, ys, xs.map((_, k) => k)));
      },
      b: (x) => `<b>${x}</b>`,
      pct: (d, dose, s) => pctF(val(M.pct, d, dose, s)),
      basePct: (s) => { const j = t(s); return j < 0 ? "–" : pctF(M.pct[m.base * nt + j]); },
      z: (d, dose, s) => zF(val(M.z, d, dose, s)),
      fewer: (d, dose, s) => { const a = val(M.pct, d, dose, s), j = t(s), base = j < 0 ? NaN : M.pct[m.base * nt + j]; return base > 0 ? `${Math.round(100 * (1 - a / base))}%` : "–"; },
      r: (d1, x1, d2, x2) => rF(R(c(d1, x1), c(d2, x2))),
      units: (d, dose) => { const i = c(d, dose); return i < 0 ? 0 : m.conds[i].units.length; },
      below: (d, dose, s) => { const i = c(d, dose), j = t(s); if (i < 0 || j < 0) return "–"; const b0 = M.pct[m.base * nt + j], us = m.conds[i].units;
        return `${us.filter((u) => TM.unitVal(S.layer, u, j, nt) < b0).length} of ${us.length}`; },
      cells: (d, dose) => { const i = c(d, dose); return i < 0 ? "–" : nF(cellsOf(i)); },
      wells: (list) => list.map(([d, dose]) => { const i = c(d, dose), w = i >= 0 && wellOf(i); return w ? w.w : "?"; }).join(", "),
      rankDown: (d, dose, s) => {
        const j = t(s), i = c(d, dose);
        const ok = S.rows.filter((k) => !m.conds[k].control && Number.isFinite(M.z[k * nt + j])).sort((a, b2) => M.z[a * nt + j] - M.z[b2 * nt + j]);
        return `${ord(ok.indexOf(i) + 1)} of ${ok.length}`;
      },
      strongest: (d, dose, s) => {
        let best = -1, bi = -1, bj = -1;
        for (const k of drugRows) for (const j of cols) { const zz = Math.abs(M.z[k * nt + j]); if (Number.isFinite(zz) && zz > best) { best = zz; bi = k; bj = j; } }
        return bi === c(d, dose) && bj === t(s);
      },
      geometry: () => {
        const near = [], far = [], byRow = {};
        for (let x = 0; x < drugRows.length; x++) for (let y = x + 1; y < drugRows.length; y++) {
          const a = drugRows[x], b2 = drugRows[y], wa = wellOf(a), wb = wellOf(b2);
          if (!wa || !wb || m.conds[a].drug === m.conds[b2].drug) continue;
          const r = R(a, b2); if (!Number.isFinite(r)) continue;
          const dist = Math.max(Math.abs(wa.r - wb.r), Math.abs(wa.c - wb.c));
          if (dist === 1) near.push(r); else if (dist > 2) far.push(r);
          if (wa.r === wb.r) (byRow[wa.row] = byRow[wa.row] || []).push(r);
        }
        const rows = Object.entries(byRow).map(([k, v]) => [k, mean(v)]).sort((a, b2) => b2[1] - a[1]);
        const inner = rows.filter(([k]) => k !== "A" && k !== "H").map(([, v]) => v);
        const h = rows.find(([k]) => k === "H");
        return { near: rF(mean(near)), far: rF(mean(far)), rowH: rF(h ? h[1] : NaN), inner: rF(mean(inner)) };
      },
    };
  }

  const STORIES = [
    {
      ds: "minifin", title: "Sorafenib thins the blood vessels",
      set: { mode: "z", ref: "Sorafenib", focus: ["Dapagliflozin"], sort: "set", type: "Vascular Endothelial Cells" },
      beats: [
        { types: ["Vascular Endothelial Cells"],
          text: (k) => `Start with one column: vascular endothelial cells, the lining of the blood vessels. In DMSO they make up ${k.b(k.basePct("Vascular Endothelial Cells"))} of a larva's cells.` },
        { rows: [["Sorafenib"]], types: ["Vascular Endothelial Cells"],
          text: (k) => `Sorafenib brings them down to ${k.b(k.pct("Sorafenib", null, "Vascular Endothelial Cells"))}, about ${k.fewer("Sorafenib", null, "Vascular Endothelial Cells")} fewer, at ${k.b("z " + k.z("Sorafenib", null, "Vascular Endothelial Cells"))}: `
            + `${k.strongest("Sorafenib", null, "Vascular Endothelial Cells") ? "the strongest move any drug makes on any set here" : "one of the strongest moves here"}, and it holds across ${k.units("Sorafenib")} samples against ${k.units("DMSO")} of DMSO.` },
        { rows: [["Dapagliflozin"], ["Orlistat"]], types: ["Vascular Endothelial Cells"],
          text: (k) => `The other two drugs leave the vessels alone (z ${k.z("Dapagliflozin", null, "Vascular Endothelial Cells")} and ${k.z("Orlistat", null, "Vascular Endothelial Cells")}). `
            + `That fits what Sorafenib is: a kinase inhibitor that blocks VEGF receptors, the signal growing blood vessels depend on.` },
      ],
    },
    {
      ds: "minifin", title: "Two different drugs, one fingerprint",
      set: { mode: "delta", ref: "Dapagliflozin", focus: ["Orlistat"], sort: "similar" },
      beats: [
        { rows: [["Dapagliflozin"], ["Orlistat"]],
          text: (k) => `Dapagliflozin lowers blood sugar through the kidney; Orlistat blocks fat digestion in the gut. Different drugs with different targets, yet across Patrick's sets `
            + `their profiles correlate at ${k.b("r " + k.r("Dapagliflozin", null, "Orlistat", null))}, against ${k.r("Dapagliflozin", null, "Sorafenib", null)} and ${k.r("Orlistat", null, "Sorafenib", null)} with Sorafenib.` },
        { rows: [["Dapagliflozin"], ["Orlistat"]], types: ["CNS", "Midbrain (Optic Tectum)", "MHB"],
          text: (k) => `Both shrink the nervous system's share of the larva: CNS falls from ${k.b(k.basePct("CNS"))} of cells to ${k.b(k.pct("Dapagliflozin", null, "CNS"))} and ${k.b(k.pct("Orlistat", null, "CNS"))} `
            + `(z ${k.z("Dapagliflozin", null, "CNS")} and ${k.z("Orlistat", null, "CNS")}), led by the midbrain and the midbrain–hindbrain boundary.` },
        { rows: [["Dapagliflozin"], ["Orlistat"]], types: ["Liver", "Cardiomyocytes", "Erythrocytes"],
          text: (k) => `And both lift the liver, from ${k.b(k.basePct("Liver"))} to ${k.b(k.pct("Dapagliflozin", null, "Liver"))} and ${k.b(k.pct("Orlistat", null, "Liver"))}, with heart and blood cells up too. `
            + `These are shares, so a smaller brain and a larger liver may be one shift seen from two sides; a shared metabolic stress is one guess. Hover a square for the cell counts behind it.` },
      ],
    },
    {
      ds: "megafin2", title: "The well, not the drug",
      set: { mode: "z", dose: "1", ref: "Famotidine", focus: ["Nifedipine", "1"], sort: "cluster" },
      beats: [
        { rows: [["Famotidine", "1"], ["Nifedipine", "1"], ["Loratadine", "1"], ["Verapamil HCl", "1"]],
          text: (k) => `Clustered by response, four 1 µM wells fall together: Famotidine, an acid blocker; Nifedipine and Verapamil, calcium-channel blockers; and Loratadine, an antihistamine. `
            + `Famotidine and Nifedipine correlate at ${k.b("r " + k.r("Famotidine", "1", "Nifedipine", "1"))}, and all four push fast-twitch muscle up.` },
        { rows: [["Famotidine", "1"], ["Nifedipine", "1"], ["Loratadine", "1"], ["Verapamil HCl", "1"]], types: ["Fast twitch muscle"],
          text: (k) => `They share no target. What they share is an address: wells ${k.b(k.wells([["Loratadine", "1"], ["Famotidine", "1"], ["Nifedipine", "1"], ["Verapamil HCl", "1"]]))}, along row H at the plate's bottom edge.` },
        { text: (k) => { const g = k.geometry(); return `Across the plate, wells more than two apart barely resemble each other (mean r ${g.far}); neighbours do (${g.near}), and row H hangs together more than the inner rows (${g.rowH} against ${g.inner}). `
            + `Each drug's two doses also sit side by side, so on MegaFin a single-well effect is a lead to replicate, not yet a finding.`; } },
      ],
    },
    {
      ds: "megafin2", title: "Sorafenib again, one well at a time",
      set: { mode: "z", dose: "5", ref: "Sorafenib", focus: ["Pimecrolimus", "5"], sort: "set", type: "Vascular endothelial cells" },
      beats: [
        { rows: [["Sorafenib", "5"]], types: ["Vascular endothelial cells"],
          text: (k) => `Back to Sorafenib and the blood vessels, now on MegaFin part 2. Its 5 µM well takes vascular endothelial cells from ${k.b(k.basePct("Vascular endothelial cells"))} of cells to ${k.b(k.pct("Sorafenib", "5", "Vascular endothelial cells"))}: the direction MiniFin showed in story I.` },
        { rows: [["Sorafenib", "5"]], types: ["Vascular endothelial cells"],
          text: (k) => `But at ${k.b("z " + k.z("Sorafenib", "5", "Vascular endothelial cells"))} it is only the ${k.rankDown("Sorafenib", "5", "Vascular endothelial cells")} wells at thinning this set, inside the ordinary wobble between wells. `
            + `Its 1 µM well holds just ${k.cells("Sorafenib", "1")} cells, too few to read.` },
        { text: () => `Same drug, same direction, but one well cannot tell a drug from its well (story III). The replicated MiniFin result is the one to trust; MegaFin would need repeat wells to say more.` },
      ],
    },
    {
      ds: "megafin", title: "Rucaparib beats its neighbours", aux: ["megafin2"],
      set: { mode: "z", dose: "", ref: "Rucaparib AG-014699", focus: ["Fluoxetine HCl", "1"], sort: "set", type: "Basal epidermis" },
      beats: [
        { rows: [["Rucaparib AG-014699", "1"], ["Rucaparib AG-014699", "5"]],
          text: (k) => { const s = k.survivors(); const ru = s.filter((x) => x.d === "Rucaparib AG-014699").length;
            return `Single wells are easy to over-read (story III), so put every effect on part 1 through two tests: it must appear at both doses, and stand above the wells around it. `
              + `Only ${k.b(s.length)} drug–set pairs pass both, and ${k.b(ru)} of them are Rucaparib's.`; } },
        { rows: [["Rucaparib AG-014699", "1"], ["Rucaparib AG-014699", "5"], ["Fluoxetine HCl", "1"]], types: ["Basal epidermis", "Fast twitch muscle"],
          text: (k) => `Rucaparib, a PARP inhibitor, raises basal epidermis at ${k.b("z " + k.z("Rucaparib AG-014699", "1", "Basal epidermis"))} and ${k.b(k.z("Rucaparib AG-014699", "5", "Basal epidermis"))} (1 and 5 µM) `
            + `while the wells around it sit near ${k.nbr("Rucaparib AG-014699", "1", "Basal epidermis")}, and it lifts fast-twitch muscle too. Fluoxetine, next door, echoes it only faintly (z ${k.z("Fluoxetine HCl", "1", "Basal epidermis")}).` },
        { rows: [["Rucaparib AG-014699", "1"], ["Rucaparib AG-014699", "5"]], types: ["Basal epidermis"],
          text: (k) => { const o = k.other("megafin2"); const zs = o ? [["Olaparib AZD2281"], ["MK-4827 Niraparib"], ["ABT-888 Veliparib"]].flatMap(([d]) => ["1", "5"].map((x) => o.zv(d, x, "Basal epidermis"))).filter(Number.isFinite) : [];
            const mx = zs.length ? Math.max(...zs.map(Math.abs)) : NaN;
            return `Is it PARP? On part 2, three other PARP inhibitors (Olaparib, Niraparib, Veliparib) leave basal epidermis flat, every well within z ±${Number.isFinite(mx) ? mx.toFixed(1) : "–"}. `
              + `So the effect looks like Rucaparib's own rather than its class's: the strongest lead on part 1, and worth a repeat well.`; } },
      ],
    },
    {
      ds: "megafin", title: "One pathway, one cell type",
      set: { mode: "z", dose: "", ref: "Rapamycin Sirolimus", focus: ["GSK2126458 Omipalisib", "5"], sort: "set", type: "Vascular endothelial cells" },
      beats: [
        { rows: ["Rapamycin Sirolimus", "Everolimus RAD001", "GSK2126458 Omipalisib", "CAL-101 Idelalisib"].flatMap((d) => [[d, "1"], [d, "5"]]), types: ["Vascular endothelial cells"],
          text: (k) => { const c = k.classUp(["Rapamycin Sirolimus", "Everolimus RAD001", "GSK2126458 Omipalisib", "CAL-101 Idelalisib"], "Vascular endothelial cells");
            return `Four drugs on part 1 act on one growth pathway, PI3K–mTOR: Rapamycin, Everolimus, Omipalisib and Idelalisib. ${k.b(`${c.up} of their ${c.n}`)} wells hold more vascular endothelial cells than the plate's typical well, `
              + `where about half would by chance (${c.plateUp} of all ${c.plate}).`; } },
        { rows: [["GSK2126458 Omipalisib", "5"], ["Rapamycin Sirolimus", "1"]], types: ["Vascular endothelial cells"],
          text: (k) => `Two of them make the plate's loudest vascular squares: Omipalisib at 5 µM is the ${k.rankUp("GSK2126458 Omipalisib", "5", "Vascular endothelial cells")} (${k.b("z " + k.z("GSK2126458 Omipalisib", "5", "Vascular endothelial cells"))}) `
            + `and Rapamycin at 1 µM the ${k.rankUp("Rapamycin Sirolimus", "1", "Vascular endothelial cells")} (${k.b("z " + k.z("Rapamycin Sirolimus", "1", "Vascular endothelial cells"))}), while the wells around each sit near `
            + `${k.nbr("GSK2126458 Omipalisib", "5", "Vascular endothelial cells")} and ${k.nbr("Rapamycin Sirolimus", "1", "Vascular endothelial cells")}. Not the neighbourhood, then.` },
        { rows: [["GSK2126458 Omipalisib", "1"], ["Rapamycin Sirolimus", "5"]], types: ["Vascular endothelial cells"],
          text: (k) => `But neither spike repeats at the drug's other dose (Omipalisib 1 µM z ${k.z("GSK2126458 Omipalisib", "1", "Vascular endothelial cells")}, Rapamycin 5 µM z ${k.z("Rapamycin Sirolimus", "5", "Vascular endothelial cells")}). `
            + `A pathway that leans one way in every well and spikes in two is a lead worth repeat wells, not yet a finding.` },
      ],
    },
    {
      ds: "megafin", label: "MegaFin parts 1 + 2", title: "Two plates, two baselines", aux: ["megafin", "megafin2"],
      set: { mode: "pct", dose: "5", ref: "Sorafenib", sort: "response" },
      beats: [
        { rows: [["DMSO"]], types: ["CNS", "Midbrain"],
          text: (k) => { const a = k.other("megafin"); return `Start with the vehicle. On part 1, the DMSO wells are ${k.b(a ? a.basePct("CNS") : "–")} CNS and ${k.b(a ? a.basePct("Midbrain") : "–")} midbrain.`; } },
        { ds: "megafin2", rows: [["DMSO"]], types: ["CNS", "Midbrain"],
          text: (k) => { const a = k.other("megafin"), b = k.other("megafin2"); if (!a || !b) return "–";
            const gap = Math.abs(b.baseVal("CNS") - a.baseVal("CNS")), ma = a.maxAbsDelta("CNS"), mb = b.maxAbsDelta("CNS");
            return `On part 2, the same vehicle reads ${k.b(b.basePct("CNS"))} CNS and ${k.b(b.basePct("Midbrain"))} midbrain. That gap between the plates, ${(gap * 100).toFixed(0)} points of CNS, `
              + `${gap > Math.max(ma, mb) ? "is larger than any drug's CNS effect within either plate" : "rivals the largest drug effects within a plate"} (at most ${(ma * 100).toFixed(0)} and ${(mb * 100).toFixed(0)} points). `
              + `The plates differ as batches, so every Δ here compares a drug with DMSO on its own plate.`; } },
        { ds: "megafin2", rows: [["Sorafenib", "5"]],
          text: (k) => { const a = k.other("megafin"), b = k.other("megafin2");
            return `Even the drug placed identically does not line up: Sorafenib at 5 µM sat in well ${a ? a.well("Sorafenib", "5") : "?"} on part 1 and ${b ? b.well("Sorafenib", "5") : "?"} on part 2, `
              + `and its two profiles across the shared sets correlate at ${k.b("r " + k.crossR("Sorafenib", "5"))}. That is why the parts sit side by side here and are never merged.`; } },
      ],
    },
    {
      ds: "minifin", label: "all three datasets", title: "Fresh stock, aged stock", aux: ["minifin", "megafin", "megafin2"],
      set: { mode: "delta", ref: "Sorafenib", sort: "set", type: "Vascular Endothelial Cells" },
      beats: [
        { rows: [["Sorafenib"]], types: ["Vascular Endothelial Cells"],
          text: (k) => `MiniFin was dosed from freshly made stock. There Sorafenib cuts vascular endothelial cells from ${k.b(k.basePct("Vascular Endothelial Cells"))} to ${k.b(k.pct("Sorafenib", null, "Vascular Endothelial Cells"))}, `
            + `${k.b(k.fewer("Sorafenib", null, "Vascular Endothelial Cells"))} fewer, and ${k.b(k.below("Sorafenib", null, "Vascular Endothelial Cells"))} samples sit below the DMSO average.` },
        { ds: "megafin2", set: { dose: "5", type: "Vascular endothelial cells" }, rows: [["Sorafenib", "5"]], types: ["Vascular endothelial cells"],
          text: (k) => { const a = k.other("megafin"), b = k.other("megafin2"); if (!a || !b) return "–";
            return `MegaFin's stocks were older. At 5 µM the same drug moves the vessels ${k.b(a.chg("Sorafenib", "5", "Vascular endothelial cells"))} on part 1 and ${k.b(b.chg("Sorafenib", "5", "Vascular endothelial cells"))} on part 2 `
              + `(z ${zF(a.zv("Sorafenib", "5", "Vascular endothelial cells"))} and ${zF(b.zv("Sorafenib", "5", "Vascular endothelial cells"))}), inside the ordinary spread between wells. Its thin 1 µM wells (${a.cells("Sorafenib", "1")} and ${b.cells("Sorafenib", "1")} cells) even point up.`; } },
        { ds: "megafin", set: { dose: "5", type: "Fast twitch muscle" }, rows: [["Dapagliflozin", "5"]], types: ["Fast twitch muscle"],
          text: (k) => { const f = k.other("minifin"), a = k.other("megafin"); if (!f || !a) return "–";
            return `Old stock can't be the whole answer. Dapagliflozin is chemically robust, yet its MiniFin signature fails too: fast-twitch muscle ${k.b(f.chg("Dapagliflozin", null, "Fast-Twitch Muscle"))} on MiniFin, `
              + `${k.b(a.chg("Dapagliflozin", "5", "Fast twitch muscle"))} on part 1. One well on a batch-shifted plate (stories III, VII) blurs even a stable drug.`; } },
        { ds: "megafin2", set: { dose: "5", sort: "response", type: "" }, rows: [["Paclitaxel Taxol", "5"], ["Vinblastine sulfate", "5"], ["Epothilone B", "5"]],
          text: (k) => { const b = k.other("megafin2"); if (!b) return "–";
            return `Where age could still show: drugs that should hit hard and don't. Paclitaxel and Vinblastine block cell division, yet Paclitaxel 5 µM is the ${k.b(b.flat("Paclitaxel Taxol", "5"))} flattest of ${b.nWells} wells, `
              + `and both keep more cells than a typical well (${b.cellsX("Paclitaxel Taxol", "5")}, ${b.cellsX("Vinblastine sulfate", "5")}). Epothilone B, same target, leaves ${k.b(b.cellsX("Epothilone B", "5"))}.`; } },
        { ds: "megafin", set: { dose: "5", sort: "response", type: "" }, rows: [["Panobinostat", "5"], ["Vorinostat SAHA", "5"], ["17-AAG KOS953", "5"]],
          text: (k) => { const a = k.other("megafin"); if (!a) return "–"; const r = a.flat("17-AAG KOS953", "5");
            return `On part 1, Panobinostat, an HDAC inhibitor far more potent than Vorinostat, is among the flattest wells (${k.b(a.flat("Panobinostat", "1"))} and ${k.b(a.flat("Panobinostat", "5"))} of ${a.nWells}); `
              + `17-AAG at 5 µM is the ${k.b(r === "1st" ? "flattest of all" : r + " flattest")}. Paclitaxel and 17-AAG barely dissolve in water, so wet, refrozen stock can lose them by settling out. Re-make these from fresh powder first.`; } },
      ],
    },
  ];

  function settingsLine() {
    const m = S.m, opt = $("#sortSel").selectedOptions[0];
    const parts = [m.title.split(" · ")[0], { pct: "% proportion", delta: `Δ ${baseShort()}`, z: "z-score" }[S.mode], `baseline ${baseName()}`, `reference ${refName()}`];
    if (m.doses.length) parts.push(S.dose ? `${doseLabel(S.dose)} rows` : "both doses");
    if (S.tissue) parts.push(S.tissue);
    parts.push(`rows ${opt ? opt.textContent : S.sort}`);
    return `<span class="lhead">settings chosen</span>${esc(parts.join(" · "))}`;
  }

  const beatDs = () => { const st = STORIES[S.story.k]; return st.beats[S.story.beat].ds || st.ds; };
  function paintStoryCard() {
    const card = $("#storyCard");
    if (!S.story || !S.m || S.m.dataset !== beatDs()) { card.hidden = true; return; }
    const st = STORIES[S.story.k], n = st.beats.length, b = S.story.beat;
    card.hidden = false;
    $("#scNum").textContent = `story ${ROMAN[S.story.k]} of ${ROMAN[STORIES.length - 1]} · ${S.m.title.split(" · ")[0]} · ${b + 1} / ${n}`;
    $("#scTitle").textContent = st.title;
    const text = $("#scText"), html = st.beats[b].text(storyKit());
    if (text.dataset.key !== `${S.story.k}:${b}`) { text.style.animation = "none"; void text.offsetHeight; text.style.animation = ""; text.dataset.key = `${S.story.k}:${b}`; }
    text.innerHTML = html;
    $("#scSet").innerHTML = settingsLine();
    $("#scDots").innerHTML = st.beats.map((_, i) => `<i class="${i === b ? "on" : ""}"></i>`).join("");
    $("#storyPrev").disabled = b === 0;
    $("#storyNext").innerHTML = b === n - 1 ? "the end &rsaquo;" : "next &rsaquo;";
  }

  async function showBeat() {
    const st = STORIES[S.story.k], b = st.beats[S.story.beat];
    if (S.ds !== beatDs()) {
      const keep = S.story;
      S.spot = null;
      await load(beatDs(), false);
      S.story = keep;
      applySettings({ ...st.set, ...(b.set || {}) });
    } else if (b.set) applySettings({ ...st.set, ...b.set });
    const m = S.m;
    const rows = (b.rows || []).map(([d, dose]) => m.conds.findIndex((c) => c.drug === d && (dose == null || c.dose === String(dose)))).filter((i) => i >= 0);
    const types = (b.types || []).map((nm) => m.types.findIndex((t) => t.name === nm)).filter((i) => i >= 0);
    S.spot = { rows: new Set(rows), types: new Set(types) };
    render();
    const rs = $("#rowscroll"), first = S.rows.findIndex((i) => spotR(i));
    rs.scrollTop = first >= 0 ? Math.max(0, (first - 2) * S.geom.rh) : 0;
  }

  function applySettings(set) {
    const m = S.m;
    S.mode = set.mode;
    S.gene = -1; S.layer = m.propLayer; $("#geneQ").value = ""; $("#geneClear").hidden = true;
    S.tissue = set.tissue || ""; $("#tissueSel").value = S.tissue;
    S.typeQ = ""; $("#typeQ").value = "";
    S.dose = set.dose != null ? String(set.dose) : m.doses[0] || ""; $("#doseSel").value = S.dose;
    const b0 = m.conds.findIndex((c) => c.id === m.baseline);
    if (b0 >= 0 && b0 !== m.base) setBase(b0);
    setRef(set.ref || m.anchor);
    const f = set.focus || [];
    S.focus = m.conds.findIndex((c) => c.drug === f[0] && !c.control && (f[1] == null || c.dose === String(f[1])));
    S.sort = set.sort; $("#sortSel").value = S.sort;
    const ty = set.type ? m.types.findIndex((t) => t.name === set.type) : -1;
    S.detail = ty >= 0 ? { kind: "type", i: ty } : { kind: "cond", i: anchorIdx() };
  }

  async function startStory(k, scroll = true) {
    const st = STORIES[k];
    if (st.aux) await Promise.all(st.aux.map(ensureAux));
    if (!S.m || S.ds !== st.ds) await load(st.ds, false);
    if (!S.m || S.m.dataset !== st.ds) return;
    applySettings(st.set);
    S.story = { k, beat: 0 };
    await showBeat();
    if (scroll) $("#plate1").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function stepStory(d) {
    if (!S.story) return;
    const n = STORIES[S.story.k].beats.length, b = S.story.beat + d;
    if (b >= n) { exitStory(); return; }
    S.story.beat = Math.max(0, b);
    showBeat();
  }

  function exitStory(draw = true) {
    S.story = null;
    S.spot = null;
    if (draw && S.m) render(); else paintStoryCard();
  }

  function wireStories() {
    $("#storyKeys").innerHTML = STORIES.map((st, k) => `<button class="storykey" data-story="${k}" aria-pressed="false">`
      + `<span class="sk-n">story ${ROMAN[k]} · ${esc(st.label || DATASETS.find(([d]) => d === st.ds)[1])}</span><em>${esc(st.title)}</em></button>`).join("");
    $("#storyKeys").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-story]");
      if (!b) return;
      if (S.story && S.story.k === +b.dataset.story) exitStory(); else startStory(+b.dataset.story);
    });
    $("#storyNext").addEventListener("click", () => stepStory(1));
    $("#storyPrev").addEventListener("click", () => stepStory(-1));
    $("#storyExit").addEventListener("click", () => exitStory());
    document.addEventListener("keydown", (e) => {
      if (!S.story || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stepStory(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepStory(-1); }
      if (e.key === "Escape") exitStory();
    });
  }

  // ------------------------------------------------------------------ gene layer
  async function setGene(j) {
    const m = S.m;
    if (j < 0) {
      S.gene = -1; S.layer = m.propLayer; $("#geneQ").value = ""; $("#geneClear").hidden = true;
      render();
      return;
    }
    const key = `${m.dataset}:${j}`;
    let L = geneCache.get(key);
    if (!L) {
      $("#status").textContent = `fetching ${m.genes[j]}…`;
      try {
        const r = await fetch(`/trailmaker_UI/data/${m.dataset}/g${j}.bin`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        L = TM.geneLayer(m, j, await r.arrayBuffer());
      } catch (err) {
        $("#status").textContent = `Could not fetch ${m.genes[j]}: ${err.message}`;
        return;
      }
      geneCache.set(key, L);
    }
    if (S.m !== m) return;
    S.gene = j; S.layer = L;
    $("#geneQ").value = m.genes[j];
    $("#geneClear").hidden = false;
    render();
  }

  // ------------------------------------------------------------------ load + controls
  function fillControls(m) {
    const counts = {};
    m.types.forEach((t) => { counts[t.tissue] = (counts[t.tissue] || 0) + 1; });
    $("#tissueSel").innerHTML = `<option value="">every tissue</option>` + m.tissues.map((t) => `<option value="${esc(t)}">${esc(t)} (${counts[t]})</option>`).join("");
    $("#typeList").innerHTML = m.type_order.map((t) => `<option value="${esc(m.types[t].name)}"></option>`).join("");
    $("#geneList").innerHTML = m.genes.map((g) => `<option value="${esc(g)}"></option>`).join("");
    $("#doseWrap").hidden = !m.doses.length;
    $("#doseSel").innerHTML = m.doses.map((d) => `<option value="${esc(d)}">${esc(doseLabel(d))}</option>`).join("") + `<option value="">both doses</option>`;
    $("#typeQ").value = "";
    $("#geneQ").value = "";
    $("#geneClear").hidden = true;
    $("#plateWhen").textContent = m.title;
    fillNotes(m);
  }

  async function load(ds, first) {
    const prev = { ds: S.ds, m: S.m };
    S.ds = ds;
    S.m = null;
    S.hover = null;
    $("#status").textContent = "setting the plate…";
    let m;
    try {
      const r = await fetch(`/trailmaker_UI/data/${ds}.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      m = TM.prepare(await r.json());
    } catch (err) {
      // MegaFin's data is the heavy build; if it is missing, open on MiniFin rather than on an error
      if (first && ds !== "minifin") { await load("minifin", false); S.notice = `MegaFin's data is not published yet (${err.message}); this is MiniFin.`; if (S.m) legendAndCaption(); return; }
      S.ds = prev.ds; S.m = prev.m;
      S.notice = `Could not load ${ds}: ${err.message}.`;
      if (S.m) render(); else $("#status").textContent = S.notice;
      return;
    }
    S.notice = "";
    const P = first ? new URLSearchParams(location.search) : new URLSearchParams();
    S.m = m;
    S.layer = m.propLayer;
    S.gene = -1;
    S.typeQ = "";
    S.ref = "";
    if (P.get("ref")) setRef(P.get("ref"));
    const b0 = m.conds.findIndex((c) => c.id === P.get("base"));
    if (b0 >= 0) setBase(b0);
    S.tissue = m.tissues.includes(P.get("tissue")) ? P.get("tissue") : "";
    S.dose = P.get("dose") === "both" ? "" : m.doses.includes(P.get("dose")) ? P.get("dose") : m.doses[0] || "";
    if (["pct", "delta", "z"].includes(P.get("mode"))) S.mode = P.get("mode");
    if ([...$("#sortSel").options].some((o) => o.value === P.get("order"))) { S.sort = P.get("order"); $("#sortSel").value = S.sort; }
    fillControls(m);
    $("#tissueSel").value = S.tissue;
    $("#doseSel").value = S.dose;
    S.cols = visibleCols();
    const want = P.get("drug");
    let f = want ? m.conds.findIndex((c) => c.id === want && !c.control) : -1;
    if (f < 0) {
      const sims = simList(TM.matrices(m, m.propLayer), S.cols, -1);
      f = sims.length ? sims[0][0] : -1;
    }
    S.focus = f;
    $("#drugQ").value = f >= 0 ? condLabel(m.conds[f]) : "";
    const a = anchorIdx();
    S.detail = { kind: "cond", i: a >= 0 ? a : m.base };
    render();
    const g = P.get("gene");
    if (g && m.genes.includes(g.toLowerCase())) setGene(m.genes.indexOf(g.toLowerCase()));
  }

  function init() {
    $("#dsSwitch").innerHTML = DATASETS.map(([k, n]) => `<button data-ds="${k}" aria-pressed="false">${esc(n)}</button>`).join("");
    $("#dsSwitch").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && b.dataset.ds !== S.ds) { exitStory(false); load(b.dataset.ds, false); }
    });
    $("#modeSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) { S.mode = b.dataset.mode; render(); }
    });
    $("#tissueSel").addEventListener("change", (e) => { S.tissue = e.target.value; render(); });
    $("#doseSel").addEventListener("change", (e) => { S.dose = e.target.value; render(); });
    $("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; $("#rowscroll").scrollTop = 0; render(); });
    $("#typeQ").addEventListener("input", (e) => { S.typeQ = e.target.value; render(); });
    const gq = $("#geneQ");
    const tryGene = () => {
      if (!S.m) return;
      const v = gq.value.trim().toLowerCase();
      const j = S.m.genes.indexOf(v);
      gq.classList.toggle("bad", !!v && j < 0);
      gq.title = v && j < 0 ? "not in this page's gene panel" : "";
      if (j >= 0 && j !== S.gene) setGene(j);
      else if (!v && S.gene >= 0) setGene(-1);
    };
    gq.addEventListener("input", tryGene);
    gq.addEventListener("change", tryGene);
    $("#geneClear").addEventListener("click", () => { gq.classList.remove("bad"); setGene(-1); });
    $("#reading").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cond],[data-type]");
      if (!b) return;
      if (b.dataset.cond != null) openCond(+b.dataset.cond); else openType(+b.dataset.type);
    });
    $("#detail").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cond],[data-type]");
      if (!b) return;
      if (b.dataset.cond != null) openCond(+b.dataset.cond); else openType(+b.dataset.type);
    });
    $("#status").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      if (b.dataset.act === "notes") $("#notes").scrollIntoView({ behavior: "smooth", block: "start" });
      if (b.dataset.act === "tiny") { S.showTiny = !S.showTiny; render(); }
    });
    $("#hmwrap").addEventListener("scroll", requestPaint, { passive: true });
    wireCanvas("#cvHead", "head");
    wireCanvas("#cvPin", "pins");
    wireCanvas("#cvRows", "rows");
    wireSearch();
    wireStories();
    fetch("/trailmaker_UI/data/stability.json").then((r) => (r.ok ? r.json() : null)).then((d) => { S.stab = d; if (S.m) render(); }).catch(() => {});
    fetch("/trailmaker_UI/data/index.json").then((r) => (r.ok ? r.json() : null)).then((d) => { S.idx = d; if (S.m) fillNotes(S.m); }).catch(() => {});
    let rz = 0;
    new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(render); }).observe($("#hmwrap"));
    const P = new URLSearchParams(location.search);
    const st = +P.get("story");
    load(DATASETS.some(([k]) => k === P.get("ds")) ? P.get("ds") : "megafin", true)
      .then(() => { if (st >= 1 && st <= STORIES.length) startStory(st - 1, false); });
  }

  init();
})();
