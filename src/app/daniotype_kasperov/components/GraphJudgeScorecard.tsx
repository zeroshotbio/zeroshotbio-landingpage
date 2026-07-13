"use client";
import React from "react";

// Graph-judge scorecard — copies the old MergedNodeScorecard layout exactly (per-tier
// agreement tiles + Node × tier table with stacked GT / DN / MX cells), but the verdict
// + the distance SCORE come from the fuzzy graph judge. Node column black, DN text
// baby-blue, MX text purple. The verdict (✓/✗ + score) is right-aligned and coloured on
// a FLUID red→amber→green scale by the graph score. Text never wraps — the table scrolls
// horizontally instead, so every label reads on one line.

const GT_COL = "#4b5563", DN_COL = "#0891b2", MX_COL = "#7c3aed", NODE_COL = "#111827", NOSCORE = "#b8b2a9";
const TIER_LABEL: Record<string, string> = { germ_layer: "Germ layer", tissue: "Tissue", cell_type_broad: "Cell type (broad)", cell_type_sub: "Cell type (sub)", gt: "Ground truth" };
const heat = (pct: number) => (pct >= 66 ? "#15803d" : pct >= 40 ? "#b45309" : "#dc2626");

// fluid graph-score colour: dark green = exact (1.00), amber = nearby, red = far (0.00)
function scoreColor(s: number) {
  const stops: [number, number, number][] = [[201, 42, 42], [214, 129, 20], [21, 128, 61]];
  const t = Math.max(0, Math.min(1, s));
  const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t / 0.5] : [stops[1], stops[2], (t - 0.5) / 0.5];
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * u);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

export function GraphJudgeScorecard({ block }: { block: any; run?: any; datasetName?: string }) {
  if (!block) return null;

  // normalise per-tier (ZSCAPE/CF/DC) and single-tier (MiniFin) into one shape
  let tiers: string[]; let rows: any[]; let agg: { t: string; agree: number; total: number; pct: number }[];
  if (Array.isArray(block.tiers)) {
    tiers = block.tiers; rows = block.rows || [];
    agg = tiers.map((t) => ({ t, agree: block.aggregate?.per_tier?.[t]?.agree ?? 0, total: block.aggregate?.per_tier?.[t]?.total ?? 0, pct: block.aggregate?.per_tier?.[t]?.pct ?? 0 }));
  } else {
    tiers = ["gt"];
    rows = (block.rows || []).map((r: any) => ({
      id: r.id, identity: r.identity, kind: r.kind, leaf_ids: r.leaf_ids, gt: { gt: r.gt }, menu: {},
      dn: { gt: { score: r.score, match: r.route === "graph" && r.score >= 0.4, route: r.route, subsumption: r.subsumption, distance: r.distance, path_edge_types: r.path_edge_types, pred_zfa_name: r.pred_zfa_name, gt_zfa_name: r.gt_zfa_name } }, mx: {},
    }));
    let a = 0, tot = 0; rows.forEach((r) => { const c = r.dn.gt; if (c && c.route !== "not_scored") { tot++; if (c.match) a++; } });
    agg = [{ t: "gt", agree: a, total: tot, pct: tot ? Math.round((100 * a) / tot) : 0 }];
  }

  const line = (tag: string, tagColor: string, val: any, cell: any) => {
    const scored = cell && cell.route !== "not_scored" && typeof cell?.score === "number";
    const col = scored ? scoreColor(cell.score) : NOSCORE;
    const matched: boolean | null = cell ? !!cell.match : null;
    const isMiss = scored && matched === false;
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: tag === "GT" ? 0 : 3 }}>
        <span style={{ fontSize: 8.5, fontWeight: 800, color: tagColor, letterSpacing: 0.3, flexShrink: 0, width: 16, paddingTop: 1 }}>{tag}</span>
        <span style={{ color: tagColor, fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap",
          borderBottom: isMiss ? `2px solid ${col}` : undefined, paddingBottom: isMiss ? 1 : 0 }}>{val ?? "—"}</span>
        {cell && scored && matched != null ? (
          <span style={{ marginLeft: "auto", paddingLeft: 18, display: "inline-flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, color: col }}>{matched ? "✓" : "✗"}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums" }}>{cell.score.toFixed(2)}</span>
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.5, marginBottom: 4 }}>
        The blind <b style={{ color: DN_COL }}>de-novo</b> call&apos;s own answer at each tier (and its <b style={{ color: MX_COL }}>menu-exposed</b> bin) vs the published <b style={{ color: GT_COL }}>GT</b>, scored by the fuzzy <b>graph judge</b> on ZFA ontology distance. Each tier is judged at its own granularity — the de-novo&apos;s germ-layer word vs GT&apos;s germ layer, its tissue word vs GT&apos;s tissue, and so on.
      </div>
      <div style={{ fontSize: 11.5, color: "#9a948c", lineHeight: 1.5, marginBottom: 12 }}>
        The right-hand number is the <b>graph score</b> and its colour is fluid — <b style={{ color: scoreColor(1) }}>dark green</b> = exact or ontology-contained (1.00), <b style={{ color: scoreColor(0.5) }}>amber</b> = nearby in the graph (a hop or two, e.g. cell↔its tissue), <b style={{ color: scoreColor(0) }}>red</b> = far apart. ✓ marks a pass, ✗ a miss (underlined). Coarse tiers read high when the de-novo names the right germ layer / tissue; fine tiers are where the real disagreements show.
      </div>

      {/* per-tier agreement tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
        {agg.map((t) => (
          <div key={t.t} style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "12px 15px" }}>
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", fontWeight: 700 }}>{TIER_LABEL[t.t] || t.t}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: heat(t.pct), fontVariantNumeric: "tabular-nums" }}>{t.total ? t.pct : "—"}{t.total ? "%" : ""}</span>
              <span style={{ fontSize: 12.5, color: "#999" }}>{t.agree}/{t.total} agree</span>
            </div>
            <div style={{ height: 8, background: "#eee7df", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${t.pct}%`, height: "100%", background: heat(t.pct) }} /></div>
          </div>
        ))}
      </div>

      {/* Node × tier table — stacked GT / DN / MX cells, full text */}
      <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "#f3f0ec", color: "#555" }}>
              <th style={{ padding: "7px 10px", textAlign: "left", position: "sticky", left: 0, background: "#f3f0ec", minWidth: 190 }}>Node · De-Novo identity</th>
              {tiers.map((t) => <th key={t} style={{ padding: "7px 10px", fontWeight: 700, borderLeft: "1px solid #e5e1dc", textAlign: "left", minWidth: 230 }}>{TIER_LABEL[t] || t}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #f2ede6", verticalAlign: "top" }}>
                <td style={{ padding: "7px 12px", position: "sticky", left: 0, background: "#fff", fontWeight: 600, color: NODE_COL, whiteSpace: "nowrap", minWidth: 190 }} title={r.identity}>
                  {r.identity}{r.kind === "merge" && r.leaf_ids ? <span style={{ color: "#9a948c", fontWeight: 400 }}> ×{r.leaf_ids.length}</span> : null}
                </td>
                {tiers.map((t) => {
                  const gt = r.gt?.[t]; const dnC = r.dn?.[t]; const mx = r.menu?.[t]; const mxC = r.mx?.[t];
                  return (
                    <td key={t} style={{ padding: "7px 12px", borderLeft: "1px solid #f2ede6", background: "#fff" }}>
                      {line("GT", GT_COL, gt, null)}
                      {line("DN", DN_COL, dnC?.value ?? r.identity, gt == null ? null : dnC)}
                      {mx ? line("MX", MX_COL, mx, mxC) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
