/* tm-view.js — the /trailmaker_UI plate: the comparison sentence, the row of keys under the plate
 * rule, the drug x cell-type plate, and the page for whatever you click in a row below it. Every
 * number comes from tm-stats.js; this file only decides what to show and how it is inked.
 *
 * The look is the plate style (PLATE_STYLE.md; /compass is the nearest sibling): laid paper, one
 * ink, a hand-tinted wash only where a direction must be told apart — ochre for more cells than
 * DMSO, indigo grey for fewer — and madder for the drug you chose, nothing else. The tissue
 * brackets and rules carry a small deterministic pen wobble; no cell is ever jittered.
 *
 * Scale is still the constraint: MegaFin has ~180 drug-dose rows and ~120 cell types. The default
 * (expanded) view gives every column its full name, upright, and scrolls sideways before cutting
 * one; the overview squeezes the plate to fit and leaves names to hover. Whatever you click opens
 * its page in a row below the plate. DMSO, Sorafenib and the named drug are pinned above the rest
 * so the comparison never scrolls away.
 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif';
  const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
  const DATASETS = [["megafin", "MegaFin part 1"], ["minifin", "MiniFin"]];
  const MIN_TYPE_N = { megafin: 100, minifin: 0 };
  const HEAD_SHORT = 64, BAND_H = 20, PIN_H = 20, FIT_H = 540, NAME_PX = 10;
  const headH = () => (S.geom ? S.geom.headH : HEAD_SHORT);

  const S = {
    ds: "megafin", m: null, layer: null, gene: -1, mode: "delta", tissue: "", typeQ: "", dose: "",
    sort: "response", focus: -1, detail: null, hover: null, expand: false, showTiny: false,
    rows: [], cols: [], pins: [], geom: null, max: 1, notice: "", ref: "",
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
  const unitWord = (n) => (S.m.dataset === "megafin" ? (n === 1 ? "well" : "wells") : n === 1 ? "sample" : "samples");
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
                rule: g("--rule"), rule2: g("--rule-2"), sel: g("--select"), anchor: g("--t3") };
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

  function rowList(mats) {
    const m = S.m, nt = m.nt, cols = S.cols;
    const rows = m.conds.map((_, i) => i).filter((i) => i !== m.base && (!S.dose || !m.conds[i].dose || m.conds[i].dose === S.dose));
    const name = (i) => condLabel(m.conds[i]).toLowerCase();
    const key = new Map();
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
  }

  // Expanded (the default): every column wide enough to carry its FULL name, set upright, and the
  // header as tall as the longest name; the plate scrolls sideways before any name is cut.
  // Overview: the columns squeezed to fit, names on hover.
  let measure = null;
  function geometry() {
    const wrapW = $("#hmwrap").clientWidth, nc = Math.max(1, S.cols.length), nr = Math.max(1, S.rows.length);
    const lw = innerWidth < 600 ? 128 : 190;
    let cw, rh, headH, names, pad = 0, slantMax = 150;
    if (S.expand) {
      cw = Math.max(10, Math.min(24, Math.floor((wrapW - lw - 12) / nc)));
      rh = 14;
      measure = measure || document.createElement("canvas").getContext("2d");
      measure.font = `${NAME_PX}px ${SERIF}`;
      const longest = Math.max(0, ...S.cols.map((t) => measure.measureText(S.m.types[t].name).width));
      headH = Math.max(HEAD_SHORT, Math.ceil(longest) + BAND_H + 16);
      names = "upright";
    } else {
      // overview: the columns widen to fill the plate. Names are slanted, given room for their whole
      // length up to 260px, and the plate keeps a right margin for the lean of the last few names.
      measure = measure || document.createElement("canvas").getContext("2d");
      measure.font = `11.5px ${SERIF}`;
      slantMax = Math.min(260, Math.ceil(Math.max(0, ...S.cols.map((t) => measure.measureText(S.m.types[t].name).width))));
      // Slanted names need ~16px columns or they overprint; narrower columns (half a screen) set the
      // names upright instead, which also frees the lean margin; below 9px there is no room at all.
      const lean = Math.ceil(slantMax * Math.cos(Math.PI / 3));
      rh = Math.max(3, Math.min(20, Math.floor(FIT_H / nr)));
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
    $("#rowscroll").style.maxHeight = S.expand ? "74vh" : "none";
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
        ctx.fillStyle = rgb(t === sel ? C.sel : t === hot ? C.ink : C.ink2);
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
    ctx.fillText(`${S.cols.length} ${typeWord().toUpperCase()}`, x0 + 4, yb + 16);
    if (names === "none" && S.cols.length) {
      ctx.font = `italic 13px ${SERIF}`;
      ctx.fillText("hover a column to read it, or choose the expanded view to see every name", x0 + 4, yb - 14);
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
    labelPanel(ctx, x0, H - 6);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `italic 14px ${SERIF}`;
    S.pins.forEach((i, r) => {
      const y = r * PIN_H + 3;
      ctx.fillStyle = rgb(sw[r]);
      ctx.beginPath(); ctx.arc(x0 + lw - 12, y + PIN_H / 2, 3.6, 0, 7); ctx.fill();
      const label = i < 0 ? "name a drug above" : r === 0 ? `${m.baseline}, the baseline` : condLabel(m.conds[i]);
      ctx.fillStyle = rgb(i < 0 ? C.ink3 : r === 2 ? C.sel : hot && hot.r === r ? C.ink : C.ink2);
      ctx.fillText(clip(ctx, label, lw - 28), x0 + lw - 22, y + PIN_H / 2 + 1);
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
    labelPanel(ctx, x0, rh * nr);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    S.rows.forEach((i, r) => {
      const y = r * rh, isHot = hot && hot.r === r, ctl = m.conds[i].control;
      if (i === S.focus) { ctx.fillStyle = rgb(C.sel, 0.07); ctx.fillRect(x0, y, lw - 4, rh); }
      if (rh >= 9) {
        ctx.font = `${ctl ? "italic " : ""}${Math.min(12.5, rh - 1)}px ${SERIF}`;
        ctx.fillStyle = rgb(i === S.focus ? C.sel : isHot ? C.ink : ctl ? C.ink3 : C.ink2);
        ctx.fillText(clip(ctx, condLabel(m.conds[i]), lw - 12), x0 + lw - 6, y + rh / 2 + 0.5);
      } else if (isHot || i === S.focus) {
        ctx.fillStyle = rgb(i === S.focus ? C.sel : C.ink);
        ctx.fillRect(x0 + lw - 8, y, 4, Math.max(2, rh - 1));
      }
    });
    ctx.textAlign = "left";
  }

  function legendAndCaption() {
    const m = S.m, g = geneName();
    const what = g ? `the share of each cell set expressing ${g}` : "the share of cells in each cell set";
    const cap = {
      pct: `Each square is ${what}`,
      delta: `Each square is the change in ${what}, against DMSO on the same plate`,
      z: `Each square is ${what} as a z-score: ${m.z_method === "robust" ? "each well against every well on its plate" : "the drug's samples against the DMSO samples"}`,
    }[S.mode];
    $("#caption").innerHTML = `<b>${esc(cap)}.</b> ${S.rows.length} ${m.dataset === "megafin" ? "drug-doses" : "drugs"} against ${S.cols.length} ${typeWord()}. `
      + `Hover a square to read it; click a drug, or the name of a cell set, for its page below the plate.`;
    const lo = S.mode === "pct" ? "0" : S.mode === "z" ? "−4" : ppF(-S.max);
    const hi = S.mode === "pct" ? pctF(S.max) : S.mode === "z" ? "+4" : ppF(S.max);
    const words = g ? ["lower than DMSO", "higher"] : ["fewer cells than DMSO", "more"];
    $("#legend").innerHTML = `<span class="lhead">scale</span><span class="ramp">${lo}<i class="bar" style="background:${gradient()}"></i>${hi}</span>`
      + (S.mode === "pct" ? "" : `<span><i class="sw" style="background:${rgb(C.down)}"></i>${words[0]}</span><span><i class="sw" style="background:${rgb(C.up)}"></i>${words[1]}</span>`)
      + `<span>bare paper: too few cells to say</span>`;
    const zText = m.z_method === "robust"
      ? "How surprising the gap is. A set's share wobbles from well to well even without a drug; z measures the gap in units of that ordinary wobble, taken across every well on the plate. Near 0 is ordinary, beyond ±2 unusual, beyond ±3 rare. Each drug-dose is a single well, so a large z is a lead to follow, not a verdict."
      : "How surprising the gap is, given how much the drug's samples and DMSO's samples vary among themselves (a Welch t). Beyond ±2 is unlikely to be chance alone.";
    $("#reading").innerHTML = `<span class="lhead">reading a square</span><dl>`
      + `<div><dt>share %</dt><dd>${g ? `Of a set's cells, the percentage that express ${esc(g)}.` : "Of all a drug's cells, the percentage that fall in a cell set."} The % proportion view colours by this.</dd></div>`
      + `<div><dt>&Delta; pp</dt><dd>The drug's share minus DMSO's share on the same plate, in percentage points: a set that goes from 2% to 3% of the cells is +1 pp. Ochre squares sit above DMSO, indigo below.</dd></div>`
      + `<div><dt>z</dt><dd>${zText}</dd></div></dl>`;
    const tiny = hiddenTiny(), minN = MIN_TYPE_N[S.ds] || 0;
    $("#status").innerHTML = (S.notice ? `<b>${esc(S.notice)}</b> ` : "")
      + (tiny ? `${tiny} ${typeWord()} of fewer than ${minN} cells are left off; <button data-act="tiny">show them</button>. `
        : S.showTiny && minN ? `<button data-act="tiny">leave off ${typeWord()} under ${minN} cells</button>. ` : "")
      + `How these numbers are made, and what they do not show: <button data-act="notes">the notes</button>.`;
  }

  function chips() {
    const a = anchorIdx(), m = S.m;
    $("#chipBaseT").textContent = m.baseline;
    if (document.activeElement !== $("#refQ")) $("#refQ").value = a >= 0 ? condLabel(m.conds[a]) : refName();
    if (document.activeElement !== $("#drugQ")) $("#drugQ").value = S.focus >= 0 ? condLabel(m.conds[S.focus]) : "";
    $("#chipBase").setAttribute("aria-pressed", String(!!S.detail && S.detail.kind === "cond" && S.detail.i === m.base));
    $("#sortSel option[value=similar]").textContent = `most like ${refName()}`;
    document.querySelectorAll("#modeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
    document.querySelectorAll("#dsSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ds === S.ds)));
    document.querySelectorAll("#viewSeg button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.view === "expanded") === S.expand)));
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
        ranked.length ? `<table><thead><tr><th>population</th><th class="n">&Delta; DMSO</th><th class="n">z</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
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
      + `<table><thead><tr><th>swell it</th><th class="n">&Delta; DMSO</th><th class="n">z</th></tr></thead><tbody>${up.map(tr).join("")}</tbody></table>`
      + `<table style="margin-top:10px"><thead><tr><th>thin it</th><th class="n">&Delta; DMSO</th><th class="n">z</th></tr></thead><tbody>${down.map(tr).join("")}</tbody></table>`);

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
    if (kind === "pins") {
      const r = Math.floor((y - 3) / PIN_H), i = S.pins[r];
      return r >= 0 && r < 3 && i >= 0 ? { where: "pins", r, i, j, t } : null;
    }
    const r = Math.floor(y / rh);
    return r >= 0 && r < S.rows.length ? { where: "rows", r, i: S.rows[r], j, t } : null;
  }

  function tipHtml(h) {
    const m = S.m, nt = m.nt;
    if (h.where === "head") {
      const ty = m.types[h.t];
      return `<b>${esc(ty.name)}</b><br><span class="d">${esc(ty.tissue)}, ${nF(ty.n)} cells${ty.n_transfer ? `, ${Math.round((100 * ty.n_transfer) / ty.n)}% by transfer` : ""}</span>`;
    }
    const c = m.conds[h.i];
    if (h.j < 0) return `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)}</span>`;
    const mats = TM.matrices(m, S.layer), k = h.i * nt + h.t, g = geneName(), set = esc(m.types[h.t].name);
    const n = c.units.reduce((s, u) => s + m.counts[u * nt + h.t], 0), N = c.units.reduce((s, u) => s + m.units[u].n, 0);
    const v = mats.pct[k], d = mats.delta[k], base = v - d, z = mats.z[k];
    const head = `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)}</span><br><i>${set}</i>`;
    const count = `<span class="d">${nF(n)} of ${nF(N)} cells, ${c.units.length} ${unitWord(c.units.length)}.</span>`;
    if (!Number.isFinite(v)) return `${head}<p class="d">Too few cells here to say anything.</p>`;
    const where = c.units.length === 1 ? (m.dataset === "megafin" ? "this well" : "this sample") : `its ${c.units.length} ${unitWord(c.units.length)}`;
    if (h.i === m.base) {
      return `${head}<p><b class="v">${pctF(v)}</b> of DMSO's cells ${g ? `in this set express <i>${esc(g)}</i>` : `are ${set}`}. `
        + `DMSO is the baseline: every other row is measured against it, so its own gap is zero.</p>${count}`;
    }
    const share = g ? `<b class="v">${pctF(v)}</b> of the ${set} cells in ${where} express <i>${esc(g)}</i>, against ${pctF(base)} in DMSO.`
                    : `<b class="v">${pctF(v)}</b> of the cells in ${where} are ${set}, against ${pctF(base)} in DMSO.`;
    const ratio = v / base;
    const fold = base > 0 && v > 0 ? ` That is ${ratio.toFixed(ratio < 10 ? 1 : 0)} times DMSO's share.` : "";
    const delta = `<b class="v ${d >= 0 ? "up" : "dn"}">&Delta; ${ppF(d)}</b> is that gap in percentage points: `
      + `${Math.abs(d * 100).toFixed(2)} points ${d >= 0 ? "above" : "below"} DMSO.${fold}`;
    const az = Math.abs(z);
    const verdict = !Number.isFinite(z) ? "can't be judged here" : az < 1 ? "is ordinary" : az < 2 ? "is a modest shift" : az < 3 ? "is unusual" : "is rare, among the strongest";
    const how = m.z_method === "robust" ? "next to how much this set normally varies from well to well on the plate"
                                        : "given how much the drug's samples and DMSO's samples vary among themselves";
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); $("#drugQ").focus(); }
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
    const drugs = m.conds.filter((c) => !c.control).length, cells = m.units.reduce((s, u) => s + u.n, 0);
    $("#byline").textContent = `${nF(drugs)} ${m.dataset === "megafin" ? "drug-doses" : "drugs"} · ${m.types.length} ${typeWord()} · ${nF(cells)} cells`
      + (m.dataset === "megafin" ? ` · plate ${m.plates.join(" + ")}` : ` · ${m.units.length} samples`);
    $("#plateWhen").textContent = m.title;
    $("#notesList").innerHTML = [...m.notes,
      `The gene field reads a panel of ${m.genes.length} marker and context genes worked out when the page was built, not the whole transcriptome.`,
      "Colour runs to the 98th percentile of what is on the plate, so the scale moves when you filter; the legend states it each time."]
      .map((n) => `<li>${esc(n)}</li>`).join("");
    $("#colophon").innerHTML = `Source: <code>${esc(m.source)}</code>. Labels: ${esc(m.labels)}. Built ${esc(m.built)} by <code>scripts/build_trailmaker_ui.py</code>, `
      + `which ships cell counts only; every number on the plate is worked out in the browser by <code>tm-stats.js</code>. What the plate claims and does not: <code>public/trailmaker_UI/NOTES.md</code>.`;
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
    S.tissue = m.tissues.includes(P.get("tissue")) ? P.get("tissue") : "";
    S.dose = P.get("dose") === "both" ? "" : m.doses.includes(P.get("dose")) ? P.get("dose") : m.doses[0] || "";
    if (["pct", "delta", "z"].includes(P.get("mode"))) S.mode = P.get("mode");
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
      if (b && b.dataset.ds !== S.ds) load(b.dataset.ds, false);
    });
    $("#modeSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) { S.mode = b.dataset.mode; render(); }
    });
    $("#tissueSel").addEventListener("change", (e) => { S.tissue = e.target.value; render(); });
    $("#doseSel").addEventListener("change", (e) => { S.dose = e.target.value; render(); });
    $("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; $("#rowscroll").scrollTop = 0; render(); });
    $("#typeQ").addEventListener("input", (e) => { S.typeQ = e.target.value; render(); });
    $("#viewSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) { S.expand = b.dataset.view === "expanded"; $("#rowscroll").scrollTop = 0; render(); }
    });
    $("#chipBase").addEventListener("click", () => { if (S.m) { S.detail = { kind: "cond", i: S.m.base }; render(); } });
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
    let rz = 0;
    new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(render); }).observe($("#hmwrap"));
    const P = new URLSearchParams(location.search);
    load(DATASETS.some(([k]) => k === P.get("ds")) ? P.get("ds") : "megafin", true);
  }

  init();
})();
