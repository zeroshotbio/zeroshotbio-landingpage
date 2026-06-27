"use client";
/* ============================================================================
   GTViz — Patrick's GT and GT-vs-prediction, 6 D3 views (V1–V6).
   New tabbed section inside /patrick (noindex, unguessable slug). All data is REAL,
   read from public/patrick/gtviz_*.json (built by scripts/prep_patrick_gtviz.py,
   which reuses the LIVE crosswalk and cross-checks against scorecard_vs_patrick.json).
   Unlabelled / abstained / no-GT cells are FIRST-CLASS in every view (never dropped).
   ============================================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { sankey as d3sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { PAPER, INK, ACCENT } from "../daniotype_kasperov/theme";

/* ---- paper-theme chrome tokens (matches /daniotype_kasperov) ---- */
const CARD = "#fffdfb";      // card / canvas surface
const BORDER = "#e5e1dc";    // card borders
const HAIRLINE = "#ece8e2";  // dividers / grid
const MUTED = "#6f685f";     // secondary text
const FAINT = "#9a948c";     // tertiary text
const ACCENT_BG = "#eef7f9"; // selected tint
const SOFT = "#f0ede9";      // subtle panel / empty cell

/* ---- shared palettes (tissue palette matches the R4b dashboard) ---- */
const TISSUE_COLOR: Record<string, string> = {
  CNS: "#6366f1", Retina: "#8b5cf6", Vascular: "#ef4444", Mesenchyme: "#a8a29e", Muscle: "#f59e0b",
  Heart: "#dc2626", Epidermis: "#10b981", Blood: "#be123c", Immune: "#f97316", Pigment: "#7c3aed",
  Notochord: "#14b8a6", PNS_glia: "#0ea5e9", Endoderm: "#eab308", Kidney: "#3b82f6", Lens: "#06b6d4",
  NC: "#ec4899", Hypochord: "#64748b", Stress: "#94a3b8", HatchingGland: "#84cc16", Ear: "#22d3ee",
  PNS_neuron: "#38bdf8", Cartilage: "#d6d3d1", AMB: "#a855f7",
};
const tcolor = (t: string) => TISSUE_COLOR[t] || "#9a948c";
const GRAY = "#c7c0b6"; // unlabelled / no-GT — warm gray, visible on paper, never dropped
const OUTCOME_COLOR: Record<string, string> = {
  agree: "#16a34a", gt_too_coarse: "#ca8a04", disagree: "#dc2626",
  abstained: "#0e7490", no_gt_assigned: "#a89e92", no_gt_abstained: "#cdc6bb", ambiguous: "#9333ea",
};
const OUTCOME_LABEL: Record<string, string> = {
  agree: "agree (tissue hit)", gt_too_coarse: "GT-too-coarse", disagree: "disagree (tissue miss)",
  abstained: "abstained — declined (success)", no_gt_assigned: "no-GT · we labelled",
  no_gt_abstained: "no-GT · declined", ambiguous: "cross-tissue ambiguous",
};
const fmt = (n: number) => n.toLocaleString();

/* ---- types ---- */
type Cells = { n: number; x: number[]; y: number[]; leaf: number[];
  leafTissue: Record<string, string>; leafCall: Record<string, string>; leafN: Record<string, number> };
type Paint = { n: number; collapseVersion: string; gtClasses: string[]; gtCode: number[]; gtUnlabelled: number;
  outClasses: string[]; outCode: number[]; gtCounts: Record<string, number>; outCounts: Record<string, number> };
type Meta = { generatedAt: string; collapseVersion: string; decisions: string; nCells: number;
  buckets: Record<string, number>; tissueAccuracy: { hits: number; scorable: number; pct: number };
  multiLabelledCells: number; crossCheck: { passed: boolean; discrepancies: string[] } };

const TABS = [
  { id: "v1", label: "V1 · GT sunburst" },
  { id: "v2", label: "V2 · multi-label UpSet" },
  { id: "v3", label: "V3 · UMAP by GT" },
  { id: "v4", label: "V4 · confusion heatmap" },
  { id: "v5", label: "V5 · GT→pred→outcome" },
  { id: "v6", label: "V6 · UMAP by outcome" },
];

export default function GTViz() {
  const [tab, setTab] = useState("v6"); // V6 first — the "concentrated vs diffuse" view
  const [cells, setCells] = useState<Cells | null>(null);
  const [paint, setPaint] = useState<Paint | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sun, setSun] = useState<any>(null);
  const [upset, setUpset] = useState<any>(null);
  const [xtab, setXtab] = useState<any>(null);
  const [sank, setSank] = useState<any>(null);

  useEffect(() => {
    const g = (f: string, set: (d: any) => void) =>
      fetch(`/patrick/${f}`).then((r) => r.json()).then(set).catch(() => {});
    g("cells.json", setCells); g("gtviz_paint.json", setPaint); g("gtviz_meta.json", setMeta);
    g("gtviz_sunburst.json", setSun); g("gtviz_upset.json", setUpset);
    g("gtviz_crosstab.json", setXtab); g("gtviz_sankey.json", setSank);
  }, []);

  return (
    <div>
      {/* provenance / collapse-version banner (honest: which collapse rendered + join health) */}
      <div style={ST.banner}>
        <div>
          <b style={{ color: INK }}>Patrick GT × prediction</b> · 94,616 cells · 151 leaves
          {meta && <> · collapse <code style={ST.code}>{meta.collapseVersion}</code></>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {meta && (
            <span style={{ color: meta.crossCheck.passed ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
              {meta.crossCheck.passed ? "✓ join verified vs scorecard" : `✗ ${meta.crossCheck.discrepancies.length} join discrepancies`}
            </span>
          )}
          {meta && <span style={{ color: FAINT }}>tissue acc {meta.tissueAccuracy.pct}% · built {meta.generatedAt.slice(0, 10)}</span>}
        </div>
      </div>
      {meta && meta.decisions && <div style={ST.decisions}>collapse decisions: {meta.decisions}</div>}

      <div style={ST.tabs}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...ST.tab, ...(tab === t.id ? ST.tabOn : {}) }}>{t.label}</button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === "v1" && <Sunburst data={sun} />}
        {tab === "v2" && <UpSet data={upset} />}
        {tab === "v3" && cells && paint && <UmapPaint cells={cells} paint={paint} mode="gt" />}
        {tab === "v4" && <Confusion data={xtab} />}
        {tab === "v5" && <SankeyView data={sank} />}
        {tab === "v6" && cells && paint && <UmapPaint cells={cells} paint={paint} mode="outcome" />}
        {(tab === "v3" || tab === "v6") && !(cells && paint) && <div style={ST.loading}>loading 94,616 cells…</div>}
      </div>
    </div>
  );
}

/* ============================================================ V1 — GT sunburst / icicle */
function Sunburst({ data }: { data: any }) {
  const ref = useRef<SVGSVGElement>(null);
  const [icicle, setIcicle] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  const W = 720, H = 560, R = Math.min(W, H) / 2 - 10;

  useEffect(() => {
    if (!data || !ref.current) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const root = d3.hierarchy(data).sum((d: any) => d.value || 0).sort((a, b) => (b.value || 0) - (a.value || 0));
    const total = root.value || 1;
    const colorOf = (d: any) => {
      let n = d; while (n.depth > 1) n = n.parent;
      const t = n.data.tissue || n.data.name;
      if (t === "_unlabelled") return GRAY;
      if (t === "_ambiguous") return TISSUE_COLOR.AMB;
      return tcolor(t);
    };
    const path = (d: any) => d.ancestors().map((a: any) => a.data.name).reverse().slice(1).join(" › ");
    const showTip = (e: any, d: any) =>
      setTip({ x: e.clientX, y: e.clientY,
        html: `<b>${path(d) || d.data.name}</b><br/>${fmt(d.value)} cells · ${(100 * d.value / total).toFixed(1)}% of all` });

    if (!icicle) {
      d3.partition().size([2 * Math.PI, R])(root);
      const arc = d3.arc<any>().startAngle((d) => d.x0).endAngle((d) => d.x1)
        .innerRadius((d) => d.y0).outerRadius((d) => d.y1).padAngle(0.004);
      const g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);
      g.selectAll("path").data(root.descendants().filter((d: any) => d.depth)).join("path")
        .attr("d", arc as any).attr("fill", colorOf).attr("fill-opacity", (d: any) => (d.depth === 1 ? 0.92 : 0.62))
        .attr("stroke", CARD).attr("stroke-width", 1).style("cursor", "pointer")
        .on("mousemove", showTip).on("mouseleave", () => setTip(null));
      g.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em").attr("fill", INK)
        .attr("font-size", 13).attr("font-weight", 600).text("MiniFin GT");
      g.append("text").attr("text-anchor", "middle").attr("dy", "1.1em").attr("fill", FAINT)
        .attr("font-size", 11).text(`${fmt(total)} cells`);
    } else {
      d3.partition().size([H, W])(root);
      const g = svg.append("g");
      g.selectAll("rect").data(root.descendants().filter((d: any) => d.depth)).join("rect")
        .attr("x", (d: any) => d.y0).attr("y", (d: any) => d.x0)
        .attr("width", (d: any) => d.y1 - d.y0).attr("height", (d: any) => Math.max(0, d.x1 - d.x0 - 1))
        .attr("fill", colorOf).attr("fill-opacity", (d: any) => (d.depth === 1 ? 0.92 : 0.62))
        .attr("stroke", CARD).style("cursor", "pointer")
        .on("mousemove", showTip).on("mouseleave", () => setTip(null));
      g.selectAll("text").data(root.descendants().filter((d: any) => d.depth && d.x1 - d.x0 > 13)).join("text")
        .attr("x", (d: any) => d.y0 + 4).attr("y", (d: any) => (d.x0 + d.x1) / 2).attr("dy", "0.35em")
        .attr("fill", "#3a352e").attr("font-size", 10).attr("font-weight", 600)
        .text((d: any) => `${d.data.name} ${fmt(d.value)}`);
    }
  }, [data, icicle]);

  return (
    <div>
      <ViewHead title="V1 · Hierarchical GT sunburst"
        sub="Patrick's per-cell labels after most-specific-wins collapse — every cell appears exactly once. Umbrella → subtype nesting; hover for counts. Unlabelled (no GT) is a first-class wedge. Tiny commercial tails (Heart/Cardiomyocyte, Lens Fiber) are present — hover the thin slivers." />
      <button onClick={() => setIcicle((v) => !v)} style={ST.toggle}>{icicle ? "→ sunburst" : "→ icicle"}</button>
      {!data ? <div style={ST.loading}>loading…</div> :
        <svg ref={ref} width={W} height={H} style={ST.svg} />}
      <Tip tip={tip} />
    </div>
  );
}

/* ============================================================ V2 — UpSet (multi-label overlaps) */
function UpSet({ data }: { data: any }) {
  const ref = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);

  useEffect(() => {
    if (!data || !ref.current) return;
    const sets: { label: string; size: number; tissue: string }[] = data.sets;
    const inter: { labels: string[]; count: number; tissues: string[]; crossTissue: boolean }[] = data.intersections;
    const setIdx = new Map(sets.map((s, i) => [s.label, i]));
    const ML = 150, RB = 24, dotR = 6, colW = 30, rowH = 22, topH = 200;
    const W = ML + RB + inter.length * colW + 30, H = topH + sets.length * rowH + 40;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    svg.attr("width", W).attr("height", H);
    const maxC = d3.max(inter, (d) => d.count) || 1;
    const yBar = d3.scaleLinear().domain([0, maxC]).range([0, topH - 20]);
    const maxS = d3.max(sets, (d) => d.size) || 1;
    const xSet = d3.scaleLinear().domain([0, maxS]).range([0, ML - 12]);
    const cx = (j: number) => ML + RB + j * colW + colW / 2;
    const cy = (i: number) => topH + i * rowH + rowH / 2;

    // intersection count bars (top)
    inter.forEach((it, j) => {
      svg.append("rect").attr("x", cx(j) - 9).attr("y", topH - 18 - yBar(it.count))
        .attr("width", 18).attr("height", yBar(it.count))
        .attr("fill", it.crossTissue ? "#dc2626" : ACCENT).attr("rx", 2)
        .style("cursor", "pointer")
        .on("mousemove", (e) => setTip({ x: e.clientX, y: e.clientY,
          html: `<b>${it.labels.join(" ∩ ")}</b><br/>${fmt(it.count)} cells · ${it.crossTissue ? "⚠ cross-umbrella (ambiguous)" : "hierarchy-consistent"}<br/>tissues: ${it.tissues.join(", ")}` }))
        .on("mouseleave", () => setTip(null));
      svg.append("text").attr("x", cx(j)).attr("y", topH - 22 - yBar(it.count)).attr("text-anchor", "middle")
        .attr("fill", MUTED).attr("font-size", 9).text(it.count >= 1000 ? `${Math.round(it.count / 1000)}k` : it.count);
    });

    // set-size bars (left) + labels
    sets.forEach((s, i) => {
      svg.append("rect").attr("x", ML - 8 - xSet(s.size)).attr("y", cy(i) - 7)
        .attr("width", xSet(s.size)).attr("height", 14).attr("fill", tcolor(s.tissue)).attr("fill-opacity", 0.55).attr("rx", 2);
      svg.append("text").attr("x", 2).attr("y", cy(i)).attr("dy", "0.32em").attr("fill", INK).attr("font-size", 10)
        .text(`${s.label.length > 26 ? s.label.slice(0, 24) + "…" : s.label}`);
      svg.append("line").attr("x1", ML + 4).attr("x2", W).attr("y1", cy(i)).attr("y2", cy(i)).attr("stroke", HAIRLINE);
    });

    // dot matrix
    inter.forEach((it, j) => {
      const rows = it.labels.map((l) => setIdx.get(l)!).filter((v) => v !== undefined).sort((a, b) => a - b);
      if (rows.length > 1)
        svg.append("line").attr("x1", cx(j)).attr("x2", cx(j)).attr("y1", cy(rows[0])).attr("y2", cy(rows[rows.length - 1]))
          .attr("stroke", it.crossTissue ? "#dc2626" : ACCENT).attr("stroke-width", 2);
      sets.forEach((_, i) => {
        svg.append("circle").attr("cx", cx(j)).attr("cy", cy(i)).attr("r", dotR)
          .attr("fill", rows.includes(i) ? (it.crossTissue ? "#dc2626" : ACCENT) : "#ddd6cc");
      });
    });
  }, [data]);

  return (
    <div>
      <ViewHead title="V2 · Multi-label overlap (UpSet)"
        sub={`${data ? fmt(data.multiLabelledCells) : "…"} cells carry ≥2 of Patrick's raw labels (pre-collapse). Top intersections by count; red bars/dots = cross-umbrella combos (the ambiguous ones Decision B excludes from scoring). Blue = hierarchy-consistent umbrella+subtype pairs.`} />
      {!data ? <div style={ST.loading}>loading…</div> :
        <div style={{ overflowX: "auto" }}><svg ref={ref} style={ST.svg} /></div>}
      <Tip tip={tip} />
    </div>
  );
}

/* ============================================================ V3/V6 — shared UMAP canvas (recolor) */
function UmapPaint({ cells, paint, mode }: { cells: Cells; paint: Paint; mode: "gt" | "outcome" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState<Record<string, Set<string>>>({ gt: new Set(), outcome: new Set() });
  const W = 720, H = 560;

  // legend entries for the current mode
  const legend = useMemo(() => {
    if (mode === "gt") {
      const items = paint.gtClasses.map((t) => ({ key: t, label: t, color: t === "AMB" ? TISSUE_COLOR.AMB : tcolor(t), n: paint.gtCounts[t] || 0 }));
      items.push({ key: "_unl", label: "unlabelled (no GT)", color: GRAY, n: paint.gtUnlabelled });
      return items.sort((a, b) => b.n - a.n);
    }
    return paint.outClasses.map((o) => ({ key: o, label: OUTCOME_LABEL[o] || o, color: OUTCOME_COLOR[o] || GRAY, n: paint.outCounts[o] || 0 }))
      .sort((a, b) => b.n - a.n);
  }, [paint, mode]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d")!; ctx.scale(dpr, dpr);
    ctx.fillStyle = CARD; ctx.fillRect(0, 0, W, H);
    const { x, y } = cells, n = cells.n;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++) { if (x[i] < minx) minx = x[i]; if (x[i] > maxx) maxx = x[i]; if (y[i] < miny) miny = y[i]; if (y[i] > maxy) maxy = y[i]; }
    const pad = 14, sx = (W - 2 * pad) / (maxx - minx), sy = (H - 2 * pad) / (maxy - miny);
    const hid = hidden[mode];
    const colorFor = (i: number): string | null => {
      if (mode === "gt") {
        const c = paint.gtCode[i];
        if (c < 0) return hid.has("_unl") ? null : GRAY;
        const t = paint.gtClasses[c];
        return hid.has(t) ? null : (t === "AMB" ? TISSUE_COLOR.AMB : tcolor(t));
      } else {
        const o = paint.outClasses[paint.outCode[i]];
        return hid.has(o) ? null : (OUTCOME_COLOR[o] || GRAY);
      }
    };
    // pass 1: gray/background classes first so the signal sits on top
    const bg = mode === "gt" ? (i: number) => paint.gtCode[i] < 0
      : (i: number) => { const o = paint.outClasses[paint.outCode[i]]; return o === "no_gt_assigned" || o === "no_gt_abstained"; };
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const isBg = bg(i);
        if (pass === 0 ? !isBg : isBg) continue;
        const col = colorFor(i); if (!col) continue;
        ctx.fillStyle = col; ctx.globalAlpha = isBg ? 0.5 : 0.82;
        const px = pad + (x[i] - minx) * sx, py = H - (pad + (y[i] - miny) * sy);
        ctx.fillRect(px, py, 1.7, 1.7);
      }
    }
    ctx.globalAlpha = 1;
  }, [cells, paint, mode, hidden]);

  const toggle = (k: string) => setHidden((h) => {
    const s = new Set(h[mode]); s.has(k) ? s.delete(k) : s.add(k);
    return { ...h, [mode]: s };
  });

  return (
    <div>
      <ViewHead title={mode === "gt" ? "V3 · UMAP painted by collapsed GT label" : "V6 · UMAP painted by comparison outcome"}
        sub={mode === "gt"
          ? "Native v2 embedding (94,616 cells, canvas). Tissue-family palette; the 13.3%+ unlabelled gap is rendered gray — visible, never dropped. Click a legend entry to toggle it."
          : "Same canvas, recolored by outcome — the concentrated-vs-diffuse view. abstained = declined (a success, blue), no-GT cells gray (no answer key). Disagreement (red) clusters at the real errors (e.g. leaf 18); it is not smeared everywhere."} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <canvas ref={ref} style={{ width: W, height: H, ...ST.svg }} />
        <div style={{ minWidth: 230, flex: 1 }}>
          <div style={ST.legendTitle}>{mode === "gt" ? "GT tissue families" : "outcome"} — click to toggle</div>
          {legend.map((it) => {
            const off = hidden[mode].has(it.key === "unlabelled (no GT)" ? "_unl" : it.key);
            return (
              <button key={it.key} onClick={() => toggle(it.key)} style={{ ...ST.legendRow, opacity: off ? 0.35 : 1 }}>
                <span style={{ width: 11, height: 11, borderRadius: 2, background: it.color, display: "inline-block" }} />
                <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
                <span style={{ opacity: 0.55, fontSize: 11 }}>{fmt(it.n)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ V4 — confusion heatmap */
function Confusion({ data }: { data: any }) {
  const [recall, setRecall] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  if (!data) return <div style={ST.loading}>loading…</div>;
  const rows: string[] = data.rows, cols: string[] = data.cols, M = data.matrix;
  const rowTotal = (r: string) => cols.reduce((s, c) => s + (M[r][c] || 0), 0);
  const cell = 26, lab = 92, top = 120;
  const W = lab + cols.length * cell + 20, H = top + rows.length * cell + 30;
  const maxRaw = Math.max(...rows.flatMap((r) => cols.map((c) => M[r][c] || 0)));
  const color = (r: string, c: string) => {
    const v = M[r][c] || 0; if (!v) return SOFT;
    const isAbst = c === data.abstainCol, isNoGt = r === data.noGtRow;
    const t = recall ? v / (rowTotal(r) || 1) : v / maxRaw;
    const inten = recall ? t : Math.sqrt(t); // sqrt so small off-diagonal cells are visible
    const base = isAbst ? "14,116,144" : isNoGt ? "168,158,146" : "37,99,160"; // teal / warm-gray / indigo on paper
    return `rgba(${base},${0.08 + 0.9 * inten})`;
  };
  return (
    <div>
      <ViewHead title="V4 · Extended confusion heatmap"
        sub="Rows = Patrick collapsed GT tissue, cols = our predicted tissue, both hierarchy-ordered so CNS-region confusion forms a block. The '(abstained)' column (declined — success, not error) and the '(no GT)' row (we labelled where Patrick had no key) keep all four buckets in frame. Toggle raw counts vs row-normalized recall." />
      <button onClick={() => setRecall((v) => !v)} style={ST.toggle}>{recall ? "→ raw counts" : "→ row-normalized (recall)"}</button>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} style={ST.svg}>
          {cols.map((c, j) => (
            <text key={c} x={lab + j * cell + cell / 2} y={top - 6} transform={`rotate(-55 ${lab + j * cell + cell / 2} ${top - 6})`}
              fill={c === data.abstainCol ? ACCENT : MUTED} fontSize={10} textAnchor="start">{c}</text>
          ))}
          {rows.map((r, i) => (
            <g key={r}>
              <text x={lab - 6} y={top + i * cell + cell / 2} dy="0.32em" textAnchor="end"
                fill={r === data.noGtRow ? FAINT : INK} fontSize={10}>{r}</text>
              {cols.map((c, j) => {
                const v = M[r][c] || 0;
                const diag = r === c;
                return (
                  <rect key={c} x={lab + j * cell} y={top + i * cell} width={cell - 1.5} height={cell - 1.5}
                    fill={color(r, c)} stroke={diag ? "#16a34a" : CARD} strokeWidth={diag ? 1.6 : 0.5}
                    style={{ cursor: v ? "pointer" : "default" }}
                    onMouseMove={(e) => v && setTip({ x: e.clientX, y: e.clientY,
                      html: `<b>GT ${r} → pred ${c}</b><br/>${fmt(v)} cells${recall ? `<br/>${(100 * v / (rowTotal(r) || 1)).toFixed(1)}% of GT ${r}` : ""}` })}
                    onMouseLeave={() => setTip(null)} />
                );
              })}
            </g>
          ))}
          {/* divider before abstained column */}
          <line x1={lab + (cols.length - 1) * cell - 1} x2={lab + (cols.length - 1) * cell - 1} y1={top - 2} y2={top + rows.length * cell} stroke={ACCENT} strokeOpacity={0.5} />
          <line x1={lab - 2} x2={lab + cols.length * cell} y1={top + (rows.length - 1) * cell - 1} y2={top + (rows.length - 1) * cell - 1} stroke="#b8b0a6" strokeOpacity={0.7} />
        </svg>
      </div>
      <div style={{ fontSize: 11, color: FAINT, marginTop: 6 }}>green outline = diagonal (correct tissue). Teal col = declined. Gray row = no-GT.</div>
      <Tip tip={tip} />
    </div>
  );
}

/* ============================================================ V5 — Sankey GT→pred→outcome */
function SankeyView({ data }: { data: any }) {
  const ref = useRef<SVGSVGElement>(null);
  const [filter, setFilter] = useState("__all");
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);

  const gtOptions = useMemo(() => {
    if (!data) return [];
    const m: Record<string, number> = {};
    data.links.forEach((l: any) => { m[l.gt] = (m[l.gt] || 0) + l.value; });
    return Object.entries(m).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([k]) => k);
  }, [data]);

  useEffect(() => {
    if (!data || !ref.current) return;
    const links0 = data.links.filter((l: any) => filter === "__all" || l.gt === filter);
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    if (!links0.length) return;
    // build node index across 3 columns
    const nid = (col: number, name: string) => `${col} ${name}`;
    const nameOf = (id: string) => id.split(" ")[1];
    const colOf = (id: string) => +id.split(" ")[0];
    const nodeSet = new Set<string>();
    const links = links0.map((l: any) => {
      const s = nid(0, l.gt), m = nid(1, l.pred), t = nid(2, l.outcome);
      nodeSet.add(s); nodeSet.add(m); nodeSet.add(t);
      return [{ source: s, target: m, value: l.value, outcome: l.outcome },
              { source: m, target: t, value: l.value, outcome: l.outcome }];
    }).flat();
    const nodes = Array.from(nodeSet).map((id: string) => ({ id }));
    const idIdx = new Map<string, number>(nodes.map((n, i) => [n.id, i]));
    const L = links.map((l: any) => ({ ...l, source: idIdx.get(l.source as string)!, target: idIdx.get(l.target as string)! }));
    const H = Math.max(420, nodeSet.size * 11), W = 860;
    svg.attr("width", W).attr("height", H);
    const sk = d3sankey().nodeWidth(12).nodePadding(7).nodeAlign(sankeyJustify)
      .extent([[140, 10], [W - 150, H - 10]]);
    const graph = sk({ nodes: nodes.map((d: any) => ({ ...d })), links: L.map((d: any) => ({ ...d })) } as any);
    const PAPER_OUT: Record<string, string> = { hit: "#16a34a", "GT-too-coarse": "#ca8a04", miss: "#dc2626", abstain: "#0e7490", no_gt: "#a89e92" };
    const lc = (o: string) => PAPER_OUT[o] || "#a89e92";
    svg.append("g").attr("fill", "none").selectAll("path").data((graph.links as any)).join("path")
      .attr("d", sankeyLinkHorizontal() as any).attr("stroke", (d: any) => lc(d.outcome))
      .attr("stroke-opacity", 0.5).attr("stroke-width", (d: any) => Math.max(1, d.width))
      .style("cursor", "pointer")
      .on("mousemove", (e: any, d: any) => setTip({ x: e.clientX, y: e.clientY,
        html: `<b>${nameOf(d.source.id)} → ${nameOf(d.target.id)}</b><br/>${fmt(d.value)} cells · ${d.outcome}` }))
      .on("mouseleave", () => setTip(null));
    const node = svg.append("g").selectAll("g").data((graph.nodes as any)).join("g");
    node.append("rect").attr("x", (d: any) => d.x0).attr("y", (d: any) => d.y0)
      .attr("width", (d: any) => d.x1 - d.x0).attr("height", (d: any) => Math.max(1, d.y1 - d.y0))
      .attr("fill", (d: any) => colOf(d.id) === 2 ? lc(nameOf(d.id)) : "#b3a99c").attr("rx", 1);
    node.append("text").attr("x", (d: any) => colOf(d.id) === 0 ? d.x0 - 6 : d.x1 + 6)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2).attr("dy", "0.32em")
      .attr("text-anchor", (d: any) => colOf(d.id) === 0 ? "end" : "start")
      .attr("fill", INK).attr("font-size", 9.5)
      .text((d: any) => `${nameOf(d.id)}`);
  }, [data, filter]);

  return (
    <div>
      <ViewHead title="V5 · GT label → prediction → outcome (Sankey)"
        sub="Flow width = cells. Each GT concept flows to our prediction, then to outcome {hit / GT-too-coarse / miss / abstain / no-GT}. Filter to a GT label to read it cleanly — try 'Liver' (splits into gut-endoderm vs hepatocyte, both endoderm → tissue hit but the liver call is invisible in his GT)." />
      {data && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={ST.select}>
            <option value="__all">All flows (≥{data.minLink} cells)</option>
            {gtOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {["Liver", "CNS", "Vascular Endothelial Cells"].filter((g) => gtOptions.includes(g)).map((g) => (
            <button key={g} onClick={() => setFilter(g)} style={ST.toggle}>{g}</button>
          ))}
          <span style={{ fontSize: 11, opacity: 0.5 }}>
            {fmt(data.prunedLinks)} tiny links ({fmt(data.prunedCells)} cells) pruned for legibility · Liver→Intestine {data.liverSplit["Endoderm:Intestine"]}, →Hepatocyte {data.liverSplit["Endoderm:Hepatocyte"]}
          </span>
        </div>
      )}
      {!data ? <div style={ST.loading}>loading…</div> :
        <div style={{ overflowX: "auto" }}><svg ref={ref} style={ST.svg} /></div>}
      <Tip tip={tip} />
    </div>
  );
}

/* ---- small shared bits ---- */
function ViewHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 16.5, fontWeight: 700, color: INK }}>{title}</div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, maxWidth: 880, lineHeight: 1.55 }}>{sub}</div>
    </div>
  );
}
function Tip({ tip }: { tip: { x: number; y: number; html: string } | null }) {
  if (!tip) return null;
  return <div style={{ ...ST.tip, left: tip.x + 12, top: tip.y + 12 }} dangerouslySetInnerHTML={{ __html: tip.html }} />;
}

const ST: Record<string, React.CSSProperties> = {
  banner: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
    padding: "12px 16px", borderRadius: 12, background: CARD, border: `1px solid ${BORDER}`,
    borderTop: `3px solid ${ACCENT}`, fontSize: 12.5, color: MUTED },
  decisions: { fontSize: 11.5, color: FAINT, marginTop: 6, fontFamily: "ui-monospace, monospace" },
  code: { background: SOFT, padding: "1px 5px", borderRadius: 4, fontSize: 11, fontFamily: "ui-monospace, monospace" },
  tabs: { display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" },
  tab: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD,
    color: MUTED, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" },
  tabOn: { background: ACCENT_BG, color: ACCENT, border: `1px solid ${ACCENT}`, fontWeight: 600 },
  svg: { borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD },
  toggle: { padding: "7px 13px", borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD,
    color: INK, fontSize: 12.5, fontWeight: 500, cursor: "pointer", marginBottom: 10, marginRight: 8 },
  select: { padding: "7px 11px", borderRadius: 8, border: `1px solid #d8d3cd`, background: "#fff",
    color: INK, fontSize: 12.5 },
  legendTitle: { fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: INK },
  legendRow: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 9px",
    marginBottom: 4, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: INK,
    fontSize: 12, cursor: "pointer" },
  loading: { padding: 40, color: FAINT, fontSize: 13 },
  tip: { position: "fixed", zIndex: 50, pointerEvents: "none", background: "#fffefc", border: `1px solid ${BORDER}`,
    borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: INK, maxWidth: 320, lineHeight: 1.5,
    boxShadow: "0 6px 20px rgba(70,60,45,0.18)" },
};
