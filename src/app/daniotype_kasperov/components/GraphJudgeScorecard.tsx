"use client";
import React, { useState } from "react";

// Faithful renderer for the parallel GRAPH-JUDGE block (finalJudge_graph /
// expertGtScorecard_graph). Mirrors the old MergedNodeScorecard's stacked-label
// presentation so labels read side-by-side for the human eye — GT / DN / MX one
// above the other, FULL text (never truncated), DN in baby-blue, MX in purple, and
// ONLY the ✓/✗ carries green/red (larger, with a red underline on a miss). The
// graph judge scores the de-novo (DN) call; MX is shown for comparison, pulled from
// the co-resident old block (the graph judge does not re-score the menu bin).
// Provisional: shows the scores, does not endorse them (the Patrick gate governs).

const GT_COL = "#4b5563", DN_COL = "#0891b2", MX_COL = "#7c3aed";
const HIT = "#16a34a", MISS = "#dc2626";

// one stacked label line: tag (small, coloured) + full-text value (coloured) + optional big ✓/✗
function LabelLine({ tag, tagColor, text, verdict, score }: { tag: string; tagColor: string; text: any; verdict?: "hit" | "miss" | null; score?: number | null }) {
  const isMiss = verdict === "miss";
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "2px 0" }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: tagColor, width: 22, flexShrink: 0, letterSpacing: 0.3, paddingTop: 2 }}>{tag}</span>
      <span style={{ color: tagColor, fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, whiteSpace: "normal", wordBreak: "break-word",
        borderBottom: isMiss ? `2px solid ${MISS}` : undefined, paddingBottom: isMiss ? 1 : 0 }}>{text ?? "—"}</span>
      {verdict ? <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: verdict === "hit" ? HIT : MISS, flexShrink: 0 }}>{verdict === "hit" ? "✓" : "✗"}</span> : null}
      {score != null ? <span style={{ fontSize: 11.5, color: "#9a948c", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{score.toFixed(2)}</span> : null}
    </div>
  );
}

export function GraphJudgeScorecard({ block, run, datasetName }: { block: any; run?: any; datasetName?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!block || !Array.isArray(block.rows)) return null;
  const rows: any[] = block.rows;

  // MX (menu-exposed) label per node, from the co-resident old block — for human comparison only.
  const menuById: Record<string, any> = {};
  for (const r of (run?.finalJudge?.rows || [])) menuById[String(r.id)] = r.menu?.[r.tier] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11.5, color: "#7a746c", lineHeight: 1.5 }}>
        Each node's blind <b style={{ color: DN_COL }}>de-novo</b> call vs the published <b>GT</b> (and the <b style={{ color: MX_COL }}>menu-exposed</b> bin, shown for comparison), scored by the fuzzy graph judge on ZFA distance — <b style={{ color: HIT }}>✓</b> agrees, <b style={{ color: MISS }}>✗</b> misses (red-underlined). Full label text, nothing truncated.
      </div>

      {/* per-node stacked label rows — GT / DN / MX one above the other, full text */}
      <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "hidden" }}>
        {rows.map((r, i) => {
          const isGraph = r.route === "graph" && typeof r.score === "number";
          const verdict: "hit" | "miss" | null = isGraph ? (r.score >= 0.4 ? "hit" : "miss") : null;
          const mx = menuById[String(r.id)];
          const isOpen = open === String(r.id);
          return (
            <div key={r.id} style={{ borderTop: i ? "1px solid #f2ede6" : undefined, background: verdict === "miss" ? "#fffbfb" : verdict === "hit" ? "#fbfffb" : "#fff" }}>
              <div onClick={() => setOpen(isOpen ? null : String(r.id))} style={{ display: "flex", gap: 12, padding: "8px 12px", cursor: "pointer" }}>
                <div style={{ flexShrink: 0, width: 118, minWidth: 118 }}>
                  <div style={{ fontSize: 10.5, color: "#b0a89e", fontVariantNumeric: "tabular-nums" }}>{r.id}{r.tier ? ` · ${String(r.tier).replace("cell_type_", "")}` : ""}</div>
                  <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: r.route === "graph" ? "#0e7490" : r.route === "not_scored" ? "#9a948c" : "#b45309" }}>
                    {r.route === "graph" ? "graph" : r.route === "not_scored" ? "no GT at tier" : "llm-fallback"}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <LabelLine tag="GT" tagColor={GT_COL} text={r.gt} />
                  <LabelLine tag="DN" tagColor={DN_COL} text={r.identity} verdict={verdict} score={isGraph ? r.score : null} />
                  {mx ? <LabelLine tag="MX" tagColor={MX_COL} text={mx} /> : null}
                </div>
              </div>
              {isOpen && isGraph ? (
                <div style={{ padding: "0 12px 10px 142px", fontSize: 11.5, color: "#5a554e" }}>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span><b>subsumption:</b> {r.subsumption ?? "—"}</span>
                    <span><b>distance:</b> {r.distance ?? "—"}</span>
                    <span><b>path:</b> {Array.isArray(r.path_edge_types) && r.path_edge_types.length ? r.path_edge_types.join(" → ") : "—"}</span>
                  </div>
                  <div style={{ marginTop: 5, display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span><b style={{ color: DN_COL }}>pred→ZFA</b> {r.pred_zfa_name ?? "unresolved"} <span style={{ color: "#9a948c" }}>({r.pred_via ?? "—"})</span></span>
                    <span><b style={{ color: GT_COL }}>gt→ZFA</b> {r.gt_zfa_name ?? "unresolved"} <span style={{ color: "#9a948c" }}>({r.gt_via ?? "—"})</span></span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
