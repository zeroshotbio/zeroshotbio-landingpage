"use client";
import React from "react";

// Graph-judge scorecard. No Full-GT column — GT shows as the top sub-row of every cell.
// Each cell stacks three subtle bands: GT (neutral), DN and MX (tinted green→yellow→red by
// their graph score) so the whole table reads as a heat-map. Verdict (✓/✗ + score) is
// right-aligned and coloured on the same fluid scale. A label ZFA can't place shows n/a and
// is excluded from the tallies. The summary at the top is a DN row + MX row × the four tiers.

const GT_COL = "#4b5563", DN_COL = "#0891b2", MX_COL = "#7c3aed", NOSCORE = "#b8b2a9";
const TIER_LABEL: Record<string, string> = { germ_layer: "Germ layer", tissue: "Tissue", cell_type_broad: "Cell type (broad)", cell_type_sub: "Cell type (sub)", gt: "Ground truth" };
const heat = (pct: number) => (pct >= 66 ? "#15803d" : pct >= 40 ? "#b45309" : "#dc2626");

// fluid graph-score colour: dark green = exact (1.00), amber = nearby, red = far (0.00)
function scoreRGB(s: number) {
  const stops: [number, number, number][] = [[201, 42, 42], [214, 129, 20], [21, 128, 61]];
  const t = Math.max(0, Math.min(1, s));
  const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t / 0.5] : [stops[1], stops[2], (t - 0.5) / 0.5];
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * u));
}
const scoreColor = (s: number) => { const [r, g, b] = scoreRGB(s); return `rgb(${r}, ${g}, ${b})`; };
const scoreBg = (s: number, alpha = 0.15) => { const [r, g, b] = scoreRGB(s); return `rgba(${r}, ${g}, ${b}, ${alpha})`; };

export function GraphJudgeScorecard({ block }: { block: any; run?: any; datasetName?: string }) {
  if (!block) return null;

  // normalise per-tier (ZSCAPE/CF/DC) and single-tier (MiniFin) into one shape
  let tiers: string[]; let rows: any[];
  if (Array.isArray(block.tiers)) {
    tiers = block.tiers; rows = block.rows || [];
  } else {
    tiers = ["gt"];
    rows = (block.rows || []).map((r: any) => ({
      id: r.id, gt: { gt: r.gt }, menu: {},
      dn: { gt: { value: r.identity, score: r.score, match: r.route === "graph" && r.score >= 0.4, route: r.route } }, mx: {},
    }));
  }

  // per-side (DN / MX) × per-tier aggregate: total = cells actually placed in ZFA (route graph);
  // route llm_fallback / not_scored -> unresolved (not a miss), tracked separately.
  const sideAgg = (side: string) => tiers.map((t) => {
    let agree = 0, total = 0, unresolved = 0;
    rows.forEach((r) => { const c = r[side]?.[t]; if (!c) return; if (c.route === "graph") { total++; if (c.match) agree++; } else unresolved++; });
    return { t, agree, total, unresolved, pct: total ? Math.round((100 * agree) / total) : 0 };
  });
  const dnAgg = sideAgg("dn"), mxAgg = sideAgg("mx");
  const showMx = mxAgg.some((x) => x.total || x.unresolved);
  const summaryRows: [string, string, string, ReturnType<typeof sideAgg>][] = [["dn", "DN", DN_COL, dnAgg]];
  if (showMx) summaryRows.push(["mx", "MX", MX_COL, mxAgg]);

  const gridCols = `58px repeat(${tiers.length}, minmax(96px, 1fr))`;

  // one stacked band inside a cell (GT neutral; DN / MX tinted by their score)
  const band = (tag: string, tagColor: string, val: any, cell: any, first: boolean) => {
    const scored = cell && cell.route === "graph" && typeof cell?.score === "number";
    const col = scored ? scoreColor(cell.score) : NOSCORE;
    const matched: boolean | null = cell ? !!cell.match : null;
    const bg = tag === "GT" ? "transparent" : scored ? scoreBg(cell.score) : cell ? "rgba(184,178,169,0.15)" : "transparent";
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2.5px 9px", background: bg, borderTop: first ? undefined : "1px solid rgba(0,0,0,0.04)" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: tagColor, letterSpacing: 0.3, flexShrink: 0, width: 15, paddingTop: 1 }}>{tag}</span>
        <span style={{ color: tagColor, fontSize: 11, fontWeight: 500, lineHeight: 1.25, whiteSpace: "nowrap" }}>{val ?? "—"}</span>
        {cell && scored && matched != null ? (
          <span style={{ marginLeft: "auto", paddingLeft: 14, display: "inline-flex", alignItems: "baseline", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, color: col }}>{matched ? "✓" : "✗"}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums" }}>{cell.score.toFixed(2)}</span>
          </span>
        ) : cell ? (
          <span title="label not found in the ZFA ontology — no graph distance" style={{ marginLeft: "auto", paddingLeft: 14, fontSize: 10, fontWeight: 700, color: NOSCORE, flexShrink: 0, letterSpacing: 0.3 }}>n/a</span>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.5, marginBottom: 4 }}>
        The blind <b style={{ color: DN_COL }}>de-novo</b> call&apos;s own answer at each tier (and its <b style={{ color: MX_COL }}>menu-exposed</b> bin) vs the published <b style={{ color: GT_COL }}>GT</b> (top row of each cell), scored by the fuzzy <b>graph judge</b> on ZFA ontology distance. Each tier is judged at its own granularity.
      </div>
      <div style={{ fontSize: 11.5, color: "#9a948c", lineHeight: 1.5, marginBottom: 14 }}>
        The number is the <b>graph score</b>, coloured fluidly — <b style={{ color: scoreColor(1) }}>dark green</b> = exact or ontology-contained (1.00), <b style={{ color: scoreColor(0.5) }}>amber</b> = nearby (a hop or two), <b style={{ color: scoreColor(0) }}>red</b> = far apart. The DN and MX rows are shaded the same way, so the table reads as a heat-map. A label the ontology can&apos;t place shows <b style={{ color: NOSCORE }}>n/a</b> and is left out of the tallies below.
      </div>

      {/* summary heat-map: DN row + MX row × tiers */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 6 }}>
          <div />
          {tiers.map((t) => <div key={t} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: "#999", fontWeight: 700, textAlign: "center" }}>{TIER_LABEL[t] || t}</div>)}
        </div>
        {summaryRows.map(([side, label, color, ag]) => (
          <div key={side} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 6, alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800, color }}>{label}</div>
            {ag.map((t) => (
              <div key={t.t} style={{ background: t.total ? scoreBg(t.pct / 100, 0.16) : "#faf9f7", border: "1px solid #eceae6", borderRadius: 8, padding: "7px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: heat(t.pct), fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{t.total ? `${t.pct}%` : "—"}</div>
                <div style={{ fontSize: 9.5, color: "#999" }}>{t.agree}/{t.total}{t.unresolved ? <span style={{ color: NOSCORE }}> · {t.unresolved} n/a</span> : null}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Node × tier table — each cell is a 3-band heat-map (GT / DN / MX) */}
      <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f3f0ec", color: "#555" }}>
              {tiers.map((t, i) => <th key={t} style={{ padding: "5px 9px", fontSize: 12, fontWeight: 700, borderLeft: i === 0 ? undefined : "1px solid #e5e1dc", textAlign: "left", minWidth: 150 }}>{TIER_LABEL[t] || t}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #e9e4dd", verticalAlign: "top" }}>
                {tiers.map((t, i) => {
                  const gt = r.gt?.[t]; const dnC = r.dn?.[t]; const mx = r.menu?.[t]; const mxC = r.mx?.[t];
                  return (
                    <td key={t} style={{ padding: 0, borderLeft: i === 0 ? undefined : "1px solid #f2ede6", background: "#fff" }}>
                      {band("GT", GT_COL, gt, null, true)}
                      {band("DN", DN_COL, dnC?.value ?? "—", gt == null ? null : dnC, false)}
                      {mx ? band("MX", MX_COL, mx, mxC, false) : null}
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
