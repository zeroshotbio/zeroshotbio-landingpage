/* tm-view.js — the /trailmaker_UI screen: comparison bar, filters, the drug x cell-type heatmap
 * and the detail panel. Every number comes from tm-stats.js; this file only decides what to show.
 *
 * Scale is the design constraint: MegaFin has ~180 drug-dose rows and ~120 cell types. Rows are
 * fitted to the viewport by default (a few pixels each: an overview you can read at a glance),
 * a label is drawn only where a row or column is big enough to carry one, and the rest is on
 * hover, behind a filter, or in the detail panel. Three rows are pinned above the rest — DMSO,
 * Sorafenib and the searched drug — so the comparison never scrolls away.
 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
  };
  const MONO = 'ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,Consolas,monospace';
  const DATASETS = [["megafin", "MegaFin"], ["minifin", "MiniFin · Patrick's labels"]];
  const MIN_TYPE_N = { megafin: 100, minifin: 0 };
  const HEAD_H = 140, BAND_H = 15, PIN_H = 18;

  const S = {
    ds: "megafin", m: null, layer: null, gene: -1, mode: "delta", tissue: "", typeQ: "", dose: "",
    sort: "response", focus: -1, detail: null, hover: null, expand: false, showTiny: false,
    rows: [], cols: [], pins: [], geom: null, max: 1, notice: "",
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
  const typeWord = () => (S.m.dataset === "minifin" ? "cell sets" : "cell types");
  const geneName = () => (S.gene >= 0 ? S.m.genes[S.gene] : null);

  // ------------------------------------------------------------------ colour
  function hex(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readColors() {
    const cs = getComputedStyle(document.body);
    const g = (n) => hex(cs.getPropertyValue(n).trim() || "#000");
    return { bg: g("--bg"), panel: g("--panel"), panel2: g("--panel2"), fg: g("--fg"), fg2: g("--fg2"), fg3: g("--fg3"),
             rule: g("--rule"), up: g("--drop"), down: g("--signal"), ok: g("--ok"), hl: g("--gd") };
  }
  const rgb = (a, al) => (al == null ? `rgb(${a.join(",")})` : `rgba(${a.join(",")},${al})`);
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const seqCol = (t) => rgb(mix(C.panel, C.fg, 0.9 * Math.sqrt(Math.min(1, Math.max(0, t)))));
  const divCol = (x) => rgb(mix(C.panel, x >= 0 ? C.up : C.down, Math.pow(Math.min(1, Math.abs(x)), 0.8)));
  function cellColor(v) {
    if (!Number.isFinite(v)) return null;
    return S.mode === "pct" ? seqCol(v / S.max) : divCol(v / S.max);
  }
  function gradient() {
    const stops = S.mode === "pct" ? [0, 0.25, 0.5, 0.75, 1].map(seqCol) : [-1, -0.5, 0, 0.5, 1].map(divCol);
    return `linear-gradient(90deg,${stops.join(",")})`;
  }

  // ------------------------------------------------------------------ what is on screen
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

  function geometry() {
    const wrap = $("#hmwrap"), rs = $("#rowscroll");
    const lw = innerWidth < 600 ? 132 : 214, nc = Math.max(1, S.cols.length), nr = Math.max(1, S.rows.length);
    const cw = Math.max(3, Math.min(26, Math.floor((wrap.clientWidth - lw - 10) / nc)));
    const avH = innerWidth <= 860 ? Math.round(innerHeight * 0.6) : rs.clientHeight;
    const rh = S.expand ? 14 : Math.max(3, Math.min(22, Math.floor(avH / nr)));
    S.geom = { lw, cw, rh, W: lw + cw * S.cols.length + 10 };
  }

  function fitCanvas(cv, w, h) {
    const d = window.devicePixelRatio || 1;
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
    const { lw, cw, W } = S.geom, m = S.m;
    const ctx = fitCanvas($("#cvHead"), W, HEAD_H);
    ctx.font = `9px ${MONO}`;
    ctx.textBaseline = "middle";
    // tissue band: one block per run of columns from the same tissue
    for (let j = 0, k = 0; j < S.cols.length; k++) {
      const tis = m.types[S.cols[j]].tissue;
      let e = j;
      while (e < S.cols.length && m.types[S.cols[e]].tissue === tis) e++;
      const x = lw + j * cw, w = (e - j) * cw;
      ctx.fillStyle = k % 2 ? rgb(C.panel2) : rgb(C.rule, 0.6);
      ctx.fillRect(x, HEAD_H - BAND_H, w - 1, BAND_H);
      if (w > 22) { ctx.fillStyle = rgb(C.fg2); ctx.fillText(clip(ctx, tis, w - 6), x + 3, HEAD_H - BAND_H / 2); }
      j = e;
    }
    const hot = hotType(), sel = selType();
    if (cw >= 9) {
      ctx.font = `${Math.min(10, cw)}px ${MONO}`;
      S.cols.forEach((t, j) => {
        ctx.save();
        ctx.translate(lw + j * cw + cw / 2, HEAD_H - BAND_H - 5);
        ctx.rotate(-Math.PI / 3);
        ctx.fillStyle = rgb(t === hot || t === sel ? C.hl : C.fg2);
        ctx.fillText(clip(ctx, m.types[t].name, 148), 0, 0);
        ctx.restore();
      });
    }
    for (const t of [hot, sel]) {
      const j = S.cols.indexOf(t);
      if (j >= 0) { ctx.fillStyle = rgb(C.hl); ctx.fillRect(lw + j * cw, HEAD_H - 3, cw, 3); }
    }
    ctx.fillStyle = rgb(C.fg3);
    ctx.font = `9px ${MONO}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${S.cols.length} ${typeWord().toUpperCase()} →`, 6, HEAD_H - BAND_H - 6);
    if (cw < 9 && S.cols.length) {
      ctx.fillText("hover a column to read it,", 6, HEAD_H - BAND_H - 34);
      ctx.fillText("pick a tissue to widen them", 6, HEAD_H - BAND_H - 22);
    }
  }

  function paintCells(ctx, vals, i, y, h) {
    const { lw, cw } = S.geom, nt = S.m.nt, gx = cw > 4 ? 1 : 0, gy = h > 4 ? 1 : 0;
    const none = rgb(C.rule, 0.35);
    S.cols.forEach((t, j) => {
      ctx.fillStyle = cellColor(vals[i * nt + t]) || none;
      ctx.fillRect(lw + j * cw, y, cw - gx, h - gy);
    });
  }

  function paintPins(vals) {
    const { lw, cw, W } = S.geom, m = S.m, H = PIN_H * 3 + 8;
    const ctx = fitCanvas($("#cvPin"), W, H);
    const sw = [C.fg3, C.ok, C.hl];
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `11px ${MONO}`;
    S.pins.forEach((i, r) => {
      const y = r * PIN_H + 2;
      ctx.fillStyle = rgb(sw[r]);
      ctx.fillRect(lw - 14, y + PIN_H / 2 - 4, 8, 8);
      const label = i < 0 ? "search a drug ↑" : r === 0 ? `${m.baseline} · baseline` : condLabel(m.conds[i]);
      const hot = S.hover && S.hover.where === "pins" && S.hover.r === r;
      ctx.fillStyle = rgb(i < 0 ? C.fg3 : hot ? C.hl : C.fg);
      ctx.fillText(clip(ctx, label, lw - 26), lw - 20, y + PIN_H / 2);
      if (i >= 0) paintCells(ctx, vals, i, y, PIN_H);
      if (hot && S.hover.j >= 0) {
        ctx.strokeStyle = rgb(C.fg, 0.9);
        ctx.strokeRect(lw + S.hover.j * cw - 0.5, y - 0.5, cw + 1, PIN_H);
      }
    });
    const sel = S.cols.indexOf(selType());
    if (sel >= 0) { ctx.strokeStyle = rgb(C.hl); ctx.strokeRect(lw + sel * cw - 0.5, 1.5, cw + 1, PIN_H * 3); }
    ctx.strokeStyle = rgb(C.fg);
    ctx.beginPath(); ctx.moveTo(0, H - 2.5); ctx.lineTo(W, H - 2.5); ctx.stroke();
    ctx.textAlign = "left";
  }

  function paintRows(vals) {
    const { lw, cw, rh, W } = S.geom, m = S.m, nr = S.rows.length;
    const ctx = fitCanvas($("#cvRows"), W, Math.max(rh * nr, 1));
    const hot = S.hover && S.hover.where === "rows" ? S.hover : null;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.font = `${Math.min(11, rh - 2)}px ${MONO}`;
    S.rows.forEach((i, r) => {
      const y = r * rh;
      const isHot = hot && hot.r === r;
      if (isHot || i === S.focus) { ctx.fillStyle = rgb(i === S.focus ? C.hl : C.fg, 0.14); ctx.fillRect(0, y, lw - 4, rh); }
      if (rh >= 9) {
        ctx.fillStyle = rgb(i === S.focus ? C.hl : m.conds[i].control ? C.fg3 : isHot ? C.fg : C.fg2);
        ctx.fillText(clip(ctx, condLabel(m.conds[i]), lw - 12), lw - 6, y + rh / 2);
      }
      paintCells(ctx, vals, i, y, rh);
    });
    const fr = S.rows.indexOf(S.focus);
    ctx.lineWidth = 1;
    if (fr >= 0) { ctx.strokeStyle = rgb(C.hl); ctx.strokeRect(lw - 0.5, fr * rh - 0.5, cw * S.cols.length + 1, rh + 1); }
    const sel = S.cols.indexOf(selType());
    if (sel >= 0) { ctx.strokeStyle = rgb(C.hl); ctx.strokeRect(lw + sel * cw - 0.5, -0.5, cw + 1, rh * nr + 1); }
    if (hot && hot.j >= 0) {
      ctx.fillStyle = rgb(C.fg, 0.07);
      ctx.fillRect(lw + hot.j * cw, 0, cw, rh * nr);
      ctx.strokeStyle = rgb(C.fg, 0.9);
      ctx.strokeRect(lw + hot.j * cw - 0.5, hot.r * rh - 0.5, cw + 1, rh + 1);
    }
    ctx.textAlign = "left";
  }

  function legendAndCaption() {
    const m = S.m, g = geneName();
    const what = g ? `% of cells expressing ${g}, within each ${m.dataset === "minifin" ? "cell set" : "cell type"}` : "cell-type proportion";
    const cap = {
      pct: what.charAt(0).toUpperCase() + what.slice(1),
      delta: `Change in ${what} against DMSO`,
      z: `${what.charAt(0).toUpperCase() + what.slice(1)}, as a z-score (${m.z_method === "robust" ? "robust, against every well on the same plate" : "Welch, drug samples against DMSO samples"})`,
    }[S.mode];
    $("#caption").innerHTML = `${esc(cap)} <span class="d">· ${S.rows.length} ${m.dataset === "megafin" ? "drug-doses" : "drugs"} × ${S.cols.length} ${typeWord()}</span>`;
    const lo = S.mode === "pct" ? "0" : S.mode === "z" ? "−4" : ppF(-S.max);
    const hi = S.mode === "pct" ? pctF(S.max) : S.mode === "z" ? "+4" : ppF(S.max);
    const more = g ? ["lower", "higher"] : ["fewer cells", "more cells"];
    $("#legend").innerHTML = `<span>${lo}</span><i style="background:${gradient()}"></i><span>${hi}${S.mode === "z" ? "" : " ·98th pct"}</span>`
      + (S.mode === "pct" ? "" : `<span><b class="dn">■</b> ${more[0]} than DMSO &nbsp;<b class="up">■</b> ${more[1]}</span>`)
      + `<span><b style="color:${rgb(C.rule)}">■</b> too few cells to say</span>`;
    const tiny = hiddenTiny();
    const minN = MIN_TYPE_N[S.ds] || 0;
    $("#status").innerHTML = (S.notice ? `<b class="up">${esc(S.notice)}</b> ` : "") + `${esc(m.labels)}. `
      + (tiny ? `${tiny} ${typeWord()} under ${minN} cells hidden · <button data-act="tiny">show</button> · `
        : S.showTiny && minN ? `<button data-act="tiny">hide ${typeWord()} under ${minN} cells</button> · ` : "")
      + `<button data-act="about">about the data</button>`;
  }

  function renderNotice() { if (S.m) legendAndCaption(); }

  function chips() {
    const a = anchorIdx(), m = S.m;
    $("#chipBaseT").textContent = m.baseline;
    $("#chipAnchorT").textContent = a >= 0 ? condLabel(m.conds[a]) : m.anchor;
    $("#chipBase").setAttribute("aria-pressed", String(!!S.detail && S.detail.kind === "cond" && S.detail.i === m.base));
    $("#chipAnchor").setAttribute("aria-pressed", String(!!S.detail && S.detail.kind === "cond" && S.detail.i === a));
    document.querySelectorAll("#modeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
    document.querySelectorAll("#dsSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ds === S.ds)));
    $("#btnRows").textContent = S.expand ? "Fit rows" : "Expand rows";
  }

  function writeUrl() {
    const m = S.m, p = new URLSearchParams();
    p.set("ds", S.ds);
    if (S.focus >= 0) p.set("drug", m.conds[S.focus].id);
    if (S.mode !== "delta") p.set("mode", S.mode);
    if (S.tissue) p.set("tissue", S.tissue);
    if (S.gene >= 0) p.set("gene", m.genes[S.gene]);
    if (m.doses.length && S.dose !== m.doses[0]) p.set("dose", S.dose || "both");
    try { history.replaceState(null, "", `${location.pathname}?${p}`); } catch { /* sandboxed frame */ }
  }

  // ------------------------------------------------------------------ detail panel
  function section(title, body) { return `<section><h3>${esc(title)}</h3>${body}</section>`; }
  const clsOf = (x) => (x === S.m.base ? "k0" : S.m.anchors.includes(x) ? "k1" : "k2");
  const swOf = (x) => (x === S.m.base ? "sw0" : S.m.anchors.includes(x) ? "sw1" : "sw2");
  const keyHtml = (trio) => `<div class="keys">${trio.map((x) => `<span><i class="sw ${swOf(x)}"></i>${esc(condLabel(S.m.conds[x]))}</span>`).join("")}</div>`;
  const condBtn = (k) => `<button class="lnk" data-cond="${k}">${esc(condLabel(S.m.conds[k]))}</button>`;
  const typeBtn = (t) => `<button class="lnk" data-type="${t}">${esc(S.m.types[t].name)}</button>`;

  function barsSVG(groups, max) {
    const W = 350, lab = 128, bw = W - lab - 66, bh = 10;
    let y = 2, s = "";
    for (const g of groups) {
      const gh = g.bars.length * (bh + 1);
      s += `<text x="0" y="${y + gh / 2 + 3}"><title>${esc(g.label)}</title>${esc(cut(g.label, 21))}</text>`;
      for (const b of g.bars) {
        const w = Number.isFinite(b.v) ? Math.max(1, bw * Math.min(1, b.v / max)) : 0;
        s += `<rect class="${b.cls}" x="${lab}" y="${y}" width="${w.toFixed(1)}" height="${bh}"/>`;
        // values sit in their own column past the longest bar, so the per-unit dots never overprint them
        s += `<text x="${lab + bw + 8}" y="${y + bh - 1.5}">${pctF(b.v)}</text>`;
        for (const d of b.dots || []) {
          if (Number.isFinite(d)) s += `<circle class="dot" cx="${(lab + bw * Math.min(1, d / max)).toFixed(1)}" cy="${y + bh / 2}" r="1.8"/>`;
        }
        y += bh + 1;
      }
      y += 7;
    }
    return `<svg viewBox="0 0 ${W} ${y}" width="100%" role="img" aria-label="proportions by condition">${s}</svg>`;
  }

  function stripSVG(sim, me) {
    const W = 350, H = 40, x = (r) => 10 + ((W - 20) * (r + 1)) / 2;
    let s = `<line class="ax" x1="10" x2="${W - 10}" y1="20" y2="20"/>`;
    for (const v of [-1, 0, 1]) s += `<line class="ax" x1="${x(v)}" x2="${x(v)}" y1="15" y2="25"/><text x="${x(v)}" y="37" text-anchor="middle">${v}</text>`;
    for (const [k, r] of sim) if (k !== me) s += `<line class="tk" x1="${x(r).toFixed(1)}" x2="${x(r).toFixed(1)}" y1="12" y2="28"/>`;
    const hit = sim.find((p) => p[0] === me);
    if (hit) s += `<line class="me" x1="${x(hit[1]).toFixed(1)}" x2="${x(hit[1]).toFixed(1)}" y1="3" y2="31"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="similarity of every drug to Sorafenib">${s}</svg>`;
  }

  function measureNote() {
    const g = geneName();
    return g ? `% of each ${S.m.dataset === "minifin" ? "set" : "population"} expressing <b>${esc(g)}</b>.` : "Share of all cells in the condition.";
  }

  function detailCond(i) {
    const m = S.m, nt = m.nt, mats = TM.matrices(m, S.layer), c = m.conds[i], cols = S.cols;
    const isBase = i === m.base, isAnchor = m.anchors.includes(i);
    const a = TM.anchorFor(m, i, S.dose);
    const N = c.units.reduce((s, u) => s + m.units[u].n, 0);
    const zr = TM.row(mats.z, i, nt), dr = TM.row(mats.delta, i, nt), pr = TM.row(mats.pct, i, nt);
    const ranked = cols.filter((t) => Number.isFinite(zr[t])).sort((x, y) => Math.abs(zr[y]) - Math.abs(zr[x]));
    let h = `<div class="dk">${isBase ? "baseline" : isAnchor ? "reference drug" : c.control ? "control" : "drug"}</div>`
      + `<h2>${esc(condLabel(c))}</h2><p class="meta">${esc(c.plate)} · ${c.units.length} ${unitWord(c.units.length)} · ${nF(N)} cells</p>`;

    const trio = [m.base, a, i].filter((x, k, arr) => x >= 0 && arr.indexOf(x) === k);
    const top = (isBase ? cols.filter((t) => Number.isFinite(pr[t])).sort((x, y) => pr[y] - pr[x]) : ranked).slice(0, 8);
    const groups = top.map((t) => ({
      label: m.types[t].name,
      bars: trio.map((x) => ({ v: mats.pct[x * nt + t], cls: clsOf(x) })),
    }));
    const max = Math.max(1e-9, ...groups.flatMap((g) => g.bars.map((b) => b.v)).filter(Number.isFinite));
    h += section("Proportions across the three conditions",
      keyHtml(trio) + barsSVG(groups, max)
      + `<p class="note">${measureNote()} ${isBase ? "Its largest populations." : "The eight populations this condition moves most (by |z|)."}</p>`);

    if (!isBase) {
      const rowsHtml = ranked.slice(0, 10).map((t) => `<tr><td>${typeBtn(t)}</td><td class="n ${dr[t] >= 0 ? "up" : "dn"}">${ppF(dr[t])}</td><td class="n">${zF(zr[t])}</td></tr>`).join("");
      h += section("Strongest affected populations",
        ranked.length ? `<table><thead><tr><th>population</th><th class="n">Δ DMSO</th><th class="n">z</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
          : `<p class="d">No population has enough cells to score.</p>`);
    }

    if (!isBase && !c.control) {
      const sim = simList(mats, cols, i, c.dose || S.dose);
      if (isAnchor) {
        const list = sim.filter((p) => p[0] !== i).slice(0, 8);
        h += section("Response similarity to Sorafenib",
          `<p>This is the reference. The drugs whose z-score profile across the ${cols.length} visible ${typeWord()} looks most like it:</p>`
          + stripSVG(sim, -1)
          + `<table><tbody>${list.map(([k, r]) => `<tr><td>${condBtn(k)}</td><td class="n">r ${rF(r)}</td></tr>`).join("")}</tbody></table>`);
      } else {
        const idx = sim.findIndex((p) => p[0] === i);
        const r = idx >= 0 ? sim[idx][1] : NaN;
        const peers = sim.filter((p) => p[0] !== i).slice(0, 5);
        h += section("Response similarity to Sorafenib",
          `<p><span class="big">r ${rF(r)}</span><span class="d">${idx >= 0 ? `${idx + 1} of ${sim.length} drugs` : "not enough overlap"}</span></p>`
          + stripSVG(sim, i)
          + `<p class="note">Pearson r between this drug's z-score profile and ${esc(condLabel(m.conds[a] || { drug: m.anchor }))}'s, over the ${cols.length} visible ${typeWord()}. Each tick is one drug; gold is this one.</p>`
          + `<table><thead><tr><th>most Sorafenib-like</th><th class="n">r</th></tr></thead><tbody>${peers.map(([k, rr]) => `<tr><td>${condBtn(k)}</td><td class="n">${rF(rr)}</td></tr>`).join("")}</tbody></table>`);
      }
    }
    return h;
  }

  function detailType(t) {
    const m = S.m, nt = m.nt, mats = TM.matrices(m, S.layer), ty = m.types[t], L = S.layer;
    const a = anchorIdx();
    const trio = [m.base, a, S.focus].filter((x, k, arr) => x >= 0 && arr.indexOf(x) === k);
    let h = `<div class="dk">${esc(ty.tissue)}${ty.umbrella ? " · umbrella set" : ""}</div><h2>${esc(ty.name)}</h2>`
      + `<p class="meta">${nF(ty.n)} cells${ty.n_transfer ? ` · ${Math.round((100 * ty.n_transfer) / ty.n)}% by label transfer` : ""}</p>`;
    const groups = trio.map((x) => ({
      label: condLabel(m.conds[x]),
      bars: [{ v: mats.pct[x * nt + t], cls: clsOf(x), dots: m.conds[x].units.map((u) => TM.unitVal(L, u, t, nt)) }],
    }));
    const max = Math.max(1e-9, ...groups.flatMap((g) => [g.bars[0].v, ...g.bars[0].dots]).filter(Number.isFinite));
    h += section("Proportions across the three conditions",
      keyHtml(trio) + barsSVG(groups, max) + `<p class="note">${measureNote()} Dots are single ${unitWord(2)}.</p>`);

    const cands = m.conds.map((_, k) => k).filter((k) => !m.conds[k].control && Number.isFinite(mats.z[k * nt + t]) && (!S.dose || m.conds[k].dose === S.dose));
    const zOf = (k) => mats.z[k * nt + t], dOf = (k) => mats.delta[k * nt + t];
    const byZ = cands.slice().sort((x, y) => zOf(y) - zOf(x));
    const up = byZ.filter((k) => zOf(k) > 0).slice(0, 5), down = byZ.filter((k) => zOf(k) < 0).reverse().slice(0, 5);
    const tr = (k) => `<tr><td>${condBtn(k)}</td><td class="n ${dOf(k) >= 0 ? "up" : "dn"}">${ppF(dOf(k))}</td><td class="n">${zF(zOf(k))}</td></tr>`;
    h += section("Strongest affected populations",
      `<p class="d">The drugs that move this population most.</p>`
      + `<table><thead><tr><th>increase it</th><th class="n">Δ DMSO</th><th class="n">z</th></tr></thead><tbody>${up.map(tr).join("")}</tbody></table>`
      + `<table style="margin-top:8px"><thead><tr><th>decrease it</th><th class="n">Δ DMSO</th><th class="n">z</th></tr></thead><tbody>${down.map(tr).join("")}</tbody></table>`);

    if (a >= 0) {
      const az = zOf(a);
      const same = cands.filter((k) => !m.anchors.includes(k) && Math.sign(zOf(k)) === Math.sign(az) && Math.abs(zOf(k)) >= 2)
        .sort((x, y) => Math.abs(zOf(y)) - Math.abs(zOf(x)));
      h += section("Response similarity to Sorafenib",
        `<p><span class="big">z ${zF(az)}</span><span class="d">${esc(condLabel(m.conds[a]))} on this population</span></p>`
        + (Math.abs(az) < 1 ? `<p class="d">Sorafenib barely moves this population, so agreeing with it here says little.</p>`
          : `<p>${same.length} of ${cands.length - 1} drugs move it the same way at |z| ≥ 2${same.length ? ":" : "."}</p>`
            + `<table><tbody>${same.slice(0, 8).map((k) => `<tr><td>${condBtn(k)}</td><td class="n">${zF(zOf(k))}</td></tr>`).join("")}</tbody></table>`));
    }
    return h;
  }

  function renderDetail() {
    const d = S.detail, el = $("#detail");
    if (!d) { el.innerHTML = `<p class="d">Click a drug or a cell type.</p>`; return; }
    el.innerHTML = d.kind === "type" ? detailType(d.i) : detailCond(d.i);
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
    const j = x >= lw ? Math.floor((x - lw) / cw) : -1;
    if (j >= S.cols.length) return null;
    const t = j >= 0 ? S.cols[j] : null;
    if (kind === "head") return j >= 0 ? { where: "head", j, t } : null;
    if (kind === "pins") {
      const r = Math.floor((y - 2) / PIN_H), i = S.pins[r];
      return r >= 0 && r < 3 && i >= 0 ? { where: "pins", r, i, j, t } : null;
    }
    const r = Math.floor(y / rh);
    return r >= 0 && r < S.rows.length ? { where: "rows", r, i: S.rows[r], j, t } : null;
  }

  function tipHtml(h) {
    const m = S.m, nt = m.nt;
    if (h.where === "head") {
      const ty = m.types[h.t];
      return `<b>${esc(ty.name)}</b><br><span class="d">${esc(ty.tissue)} · ${nF(ty.n)} cells${ty.n_transfer ? ` · ${Math.round((100 * ty.n_transfer) / ty.n)}% transferred` : ""}</span><br><span class="d">click for detail</span>`;
    }
    const c = m.conds[h.i];
    if (h.j < 0) return `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)} · click for detail</span>`;
    const mats = TM.matrices(m, S.layer), k = h.i * nt + h.t, g = geneName();
    const n = c.units.reduce((s, u) => s + m.counts[u * nt + h.t], 0), N = c.units.reduce((s, u) => s + m.units[u].n, 0);
    return `<b>${esc(condLabel(c))}</b> <span class="d">${esc(c.plate)}</span><br>${esc(m.types[h.t].name)}<br>`
      + `<span class="d">${g ? `${esc(g)}+` : "share"}</span> ${pctF(mats.pct[k])} <span class="d">vs DMSO</span> ${pctF(mats.pct[k] - mats.delta[k])}<br>`
      + `Δ <span class="${mats.delta[k] >= 0 ? "up" : "dn"}">${ppF(mats.delta[k])}</span> · z ${zF(mats.z[k])}<br>`
      + `<span class="d">${nF(n)} of ${nF(N)} cells in ${c.units.length} ${unitWord(c.units.length)}</span>`;
  }

  function showTip(html, e) {
    const tip = $("#tip");
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + hh > innerHeight - 8) y = e.clientY - hh - 14;
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

  // ------------------------------------------------------------------ drug search
  function wireSearch() {
    const q = $("#drugQ"), list = $("#drugList");
    let items = [], sel = -1;
    const mark = () => {
      [...list.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === sel)));
      const li = list.children[sel];
      if (li) li.scrollIntoView({ block: "nearest" });
    };
    const show = () => {
      const m = S.m;
      if (!m) return;
      const s = q.value.trim().toLowerCase();
      items = m.conds.map((_, i) => i).filter((i) => !m.conds[i].control && condLabel(m.conds[i]).toLowerCase().includes(s)).slice(0, 60);
      sel = items.length ? 0 : -1;
      list.innerHTML = items.map((i) => `<li role="option" data-i="${i}">${esc(condLabel(m.conds[i]))}<span>${esc(m.conds[i].plate)}</span></li>`).join("");
      mark();
      list.hidden = !items.length;
      q.setAttribute("aria-expanded", String(!list.hidden));
    };
    const hide = () => { list.hidden = true; q.setAttribute("aria-expanded", "false"); };
    const choose = (i) => { hide(); q.blur(); openCond(i); };
    q.addEventListener("focus", () => { q.select(); show(); });
    q.addEventListener("input", show);
    q.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { hide(); q.blur(); return; }
      if (list.hidden) return;
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0) { choose(items[sel]); e.preventDefault(); }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (li) { e.preventDefault(); choose(+li.dataset.i); }
    });
    q.addEventListener("blur", () => setTimeout(() => {
      hide();
      if (S.m) q.value = S.focus >= 0 ? condLabel(S.m.conds[S.focus]) : "";
    }, 120));
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
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
      $("#status").textContent = `Loading ${m.genes[j]}…`;
      try {
        const r = await fetch(`/trailmaker_UI/data/${m.dataset}/g${j}.bin`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        L = TM.geneLayer(m, j, await r.arrayBuffer());
      } catch (err) {
        $("#status").textContent = `Could not load ${m.genes[j]}: ${err.message}`;
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
    $("#tissueSel").innerHTML = `<option value="">all tissues</option>` + m.tissues.map((t) => `<option value="${esc(t)}">${esc(t)} (${counts[t]})</option>`).join("");
    $("#typeList").innerHTML = m.type_order.map((t) => `<option value="${esc(m.types[t].name)}"></option>`).join("");
    $("#geneList").innerHTML = m.genes.map((g) => `<option value="${esc(g)}"></option>`).join("");
    $("#geneQ").placeholder = `optional · ${m.genes.length} in panel`;
    $("#doseWrap").hidden = !m.doses.length;
    $("#doseSel").innerHTML = m.doses.map((d) => `<option value="${esc(d)}">${esc(doseLabel(d))}</option>`).join("") + `<option value="">both doses</option>`;
    $("#typeQ").value = "";
    $("#geneQ").value = "";
    $("#geneClear").hidden = true;
    $("#aboutBody").innerHTML = `<h2>${esc(m.title)}</h2><p class="d">${esc(m.source)} · built ${esc(m.built)}</p>`
      + `<p>${esc(m.labels)}.</p><ul>${m.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      + `<p class="d">A prototype. The gene filter reads a panel of ${m.genes.length} marker and context genes computed at build time, not the whole transcriptome. `
      + `Build: scripts/build_trailmaker_ui.py. What this page does and does not claim: public/trailmaker_UI/NOTES.md.</p>`;
  }

  async function load(ds, first) {
    const prev = { ds: S.ds, m: S.m };
    S.ds = ds;
    S.m = null;
    S.hover = null;
    $("#status").textContent = "Loading…";
    let m;
    try {
      const r = await fetch(`/trailmaker_UI/data/${ds}.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      m = TM.prepare(await r.json());
    } catch (err) {
      // MegaFin's data is the heavy build; until it has shipped, open on MiniFin rather than on an error
      if (first && ds !== "minifin") { await load("minifin", false); S.notice = `MegaFin data is not published yet (${err.message}); showing MiniFin.`; renderNotice(); return; }
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
    if (store.get("tm.theme") === "light") document.body.classList.add("light");
    const themeBtn = $("#btnTheme");
    themeBtn.textContent = document.body.classList.contains("light") ? "Dark" : "Light";
    themeBtn.addEventListener("click", () => {
      const light = document.body.classList.toggle("light");
      themeBtn.textContent = light ? "Dark" : "Light";
      store.set("tm.theme", light ? "light" : "dark");
      render();
    });
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
    $("#btnRows").addEventListener("click", () => { S.expand = !S.expand; render(); });
    $("#chipBase").addEventListener("click", () => { if (S.m) { S.detail = { kind: "cond", i: S.m.base }; render(); } });
    $("#chipAnchor").addEventListener("click", () => { const a = S.m && anchorIdx(); if (a >= 0) { S.detail = { kind: "cond", i: a }; render(); } });
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
    const about = () => { const d = $("#about"); if (d.showModal) d.showModal(); };
    $("#btnAbout").addEventListener("click", about);
    $("#status").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      if (b.dataset.act === "about") about();
      if (b.dataset.act === "tiny") { S.showTiny = !S.showTiny; render(); }
    });
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
