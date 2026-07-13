"use client";
import React from "react";

// Shared scorecard for BOTH judges (variant "graph" | "llm"). No Full-GT column — GT shows as
// the top sub-row of every cell. Each cell stacks three subtle bands: GT (neutral), DN and MX
// (tinted green→yellow→red by score) so the table reads as a heat-map. Each node's GT/DN/MX
// triplet is boxed with a thick border and separated by whitespace. The graph judge scores a
// fluid ZFA distance (0–1, shown as a number); the LLM judge is binary (✓/✗), rendered on the
// same green/red scale. The summary is a DN row + MX row × the four tiers.

const GT_COL = "#4b5563", DN_COL = "#0891b2", MX_COL = "#7c3aed", NOSCORE = "#b8b2a9";
const SCORE_TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
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

export function GraphJudgeScorecard({ block, variant = "graph" }: { block: any; run?: any; datasetName?: string; variant?: "graph" | "llm" }) {
  if (!block) return null;
  const isLLM = variant === "llm";

  // normalise every block shape into { tiers, rows[{gt, menu, dn{tier:cell}, mx{tier:cell}}] }.
  // graph cells carry {value, score, route, match}; llm cells carry {value, match, note} (no route).
  let tiers: string[]; let rows: any[];
  if (isLLM) {
    const present = SCORE_TIERS.filter((t) => (block.rows || []).some((r: any) => r.gt?.[t]));
    tiers = present;
    rows = (block.rows || []).map((r: any) => {
      const dn: any = {}, mx: any = {};
      present.forEach((t) => {
        const g = r.gt?.[t];
        dn[t] = g && r.dn?.[t] ? { value: r.identity, match: !!r.dn[t].match, note: r.dn[t].note } : null;
        mx[t] = g && r.menu?.[t] ? { value: r.menu[t], match: !!(r.mx?.[t]?.match), note: r.mx?.[t]?.note } : null;
      });
      return { id: r.id, gt: r.gt, menu: r.menu, dn, mx };
    });
  } else if (Array.isArray(block.tiers)) {
    tiers = block.tiers; rows = block.rows || [];
  } else {
    tiers = ["gt"];
    rows = (block.rows || []).map((r: any) => ({
      id: r.id, gt: { gt: r.gt }, menu: {},
      dn: { gt: { value: r.identity, score: r.score, match: r.route === "graph" && r.score >= 0.4, route: r.route } }, mx: {},
    }));
  }

  // per-side (DN / MX) × per-tier aggregate. graph: total = cells placed in ZFA (route graph),
  // else unresolved (not a miss). llm: every scored cell counts (binary match).
  const sideAgg = (side: string) => tiers.map((t) => {
    let agree = 0, total = 0, unresolved = 0;
    rows.forEach((r) => {
      const c = r[side]?.[t]; if (!c) return;
      const graphCell = "route" in c;
      if (!graphCell) { total++; if (c.match) agree++; }
      else if (c.route === "graph") { total++; if (c.match) agree++; }
      else unresolved++;
    });
    return { t, agree, total, unresolved, pct: total ? Math.round((100 * agree) / total) : 0 };
  });
  const dnAgg = sideAgg("dn"), mxAgg = sideAgg("mx");
  const showMx = mxAgg.some((x) => x.total || x.unresolved);
  const summaryRows: [string, string, string, ReturnType<typeof sideAgg>][] = [["dn", "DN", DN_COL, dnAgg]];
  if (showMx) summaryRows.push(["mx", "MX", MX_COL, mxAgg]);
  const gridCols = `58px repeat(${tiers.length}, minmax(96px, 1fr))`;

  // one stacked band inside a cell (GT neutral; DN / MX tinted by score/verdict)
  const band = (tag: string, tagColor: string, val: any, cell: any, first: boolean) => {
    const graphCell = !!cell && "route" in cell;
    const placed = !!cell && cell.route === "graph" && typeof cell.score === "number";
    const binary = !!cell && !graphCell && typeof cell.match === "boolean";
    const scored = placed || binary;
    const sv = placed ? cell.score : binary ? (cell.match ? 1 : 0) : 0;
    const col = scored ? scoreColor(sv) : NOSCORE;
    const matched: boolean | null = cell ? !!cell.match : null;
    const bg = tag === "GT" ? "transparent" : scored ? scoreBg(sv) : cell ? "rgba(184,178,169,0.15)" : "transparent";
    return (
      <div title={cell?.note || undefined} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2.5px 9px", background: bg, borderTop: first ? undefined : "1px solid rgba(0,0,0,0.045)" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: tagColor, letterSpacing: 0.3, flexShrink: 0, width: 15, paddingTop: 1 }}>{tag}</span>
        <span style={{ color: tagColor, fontSize: 11, fontWeight: 500, lineHeight: 1.25, whiteSpace: "nowrap" }}>{val ?? "—"}</span>
        {scored && matched != null ? (
          <span style={{ marginLeft: "auto", paddingLeft: 14, display: "inline-flex", alignItems: "baseline", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, color: col }}>{matched ? "✓" : "✗"}</span>
            {placed ? <span style={{ fontSize: 10, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums" }}>{cell.score.toFixed(2)}</span> : null}
          </span>
        ) : cell ? (
          <span title="label not found in the ZFA ontology — no graph distance" style={{ marginLeft: "auto", paddingLeft: 14, fontSize: 10, fontWeight: 700, color: NOSCORE, flexShrink: 0, letterSpacing: 0.3 }}>n/a</span>
        ) : null}
      </div>
    );
  };

  const last = tiers.length - 1;
  return (
    <div>
      {isLLM ? (
        <>
          <div style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.5, marginBottom: 4 }}>
            The blind <b style={{ color: DN_COL }}>de-novo</b> consolidated identity (and its <b style={{ color: MX_COL }}>menu-exposed</b> bin) vs the published <b style={{ color: GT_COL }}>GT</b> (top row of each cell), scored by the <b>LLM judge</b> on biological meaning. The one identity is judged at every tier — rolled up where it fits (e.g. hepatocyte → endoderm counts).
          </div>
          <div style={{ fontSize: 11.5, color: "#9a948c", lineHeight: 1.5, marginBottom: 14 }}>
            <b style={{ color: scoreColor(1) }}>✓</b> = the judge agreed the labels denote the same thing at that tier, <b style={{ color: scoreColor(0) }}>✗</b> = a miss. The DN and MX rows are shaded green / red to match, so the table reads as a heat-map. Hover a cell for the judge&apos;s note.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.5, marginBottom: 4 }}>
            The blind <b style={{ color: DN_COL }}>de-novo</b> call&apos;s own answer at each tier (and its <b style={{ color: MX_COL }}>menu-exposed</b> bin) vs the published <b style={{ color: GT_COL }}>GT</b> (top row of each cell), scored by the fuzzy <b>graph judge</b> on ZFA ontology distance. Each tier is judged at its own granularity.
          </div>
          <div style={{ fontSize: 11.5, color: "#9a948c", lineHeight: 1.5, marginBottom: 14 }}>
            The number is the <b>graph score</b>, coloured fluidly — <b style={{ color: scoreColor(1) }}>dark green</b> = exact or ontology-contained (1.00), <b style={{ color: scoreColor(0.5) }}>amber</b> = nearby (a hop or two), <b style={{ color: scoreColor(0) }}>red</b> = far apart. The DN and MX rows are shaded the same way, so the table reads as a heat-map. A label the ontology can&apos;t place shows <b style={{ color: NOSCORE }}>n/a</b> and is left out of the tallies below.
          </div>
        </>
      )}

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

      {/* Node × tier table — each cell is a boxed 3-band heat-map (GT / DN / MX), rows spaced apart */}
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 9px", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f3f0ec", color: "#555" }}>
              {tiers.map((t, i) => <th key={t} style={{ padding: "5px 9px", fontSize: 12, fontWeight: 700, borderLeft: i === 0 ? undefined : "1px solid #e5e1dc", textAlign: "left", minWidth: 150 }}>{TIER_LABEL[t] || t}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ verticalAlign: "top" }}>
                {tiers.map((t, i) => {
                  const gt = r.gt?.[t]; const dnC = r.dn?.[t]; const mx = r.menu?.[t]; const mxC = r.mx?.[t];
                  return (
                    <td key={t} style={{
                      padding: 0, background: "#fff",
                      borderTop: "2px solid #d8d2c9", borderBottom: "2px solid #d8d2c9",
                      borderLeft: i === 0 ? "2px solid #d8d2c9" : "1px solid #efece7",
                      borderRight: i === last ? "2px solid #d8d2c9" : undefined,
                    }}>
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
