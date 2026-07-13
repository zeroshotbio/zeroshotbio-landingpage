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

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 8px" };
const GT_COL = "#4b5563", DN_COL = "#0891b2", MX_COL = "#7c3aed";
const HIT = "#16a34a", MISS = "#dc2626";
const BUCKETS: [string, string][] = [["exact", "#15803d"], ["specific", "#16a34a"], ["coarse", "#65a30d"], ["near_miss", "#b45309"], ["error", "#dc2626"]];

function Stat({ label, big, sub, tone }: { label: string; big: string; sub?: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#9a948c", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || "#2b2b2b", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{big}</div>
      {sub ? <div style={{ fontSize: 11, color: "#8a847c" }}>{sub}</div> : null}
    </div>
  );
}

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
  const cov = block.coverage || {}, agg = block.aggregate || {};
  const scoreable = (cov.graph || 0) + (cov.fallback || 0);
  const pctScoreable = scoreable ? Math.round((100 * (cov.graph || 0)) / scoreable) : 0;
  const buckets = agg.buckets || {};
  const rows: any[] = block.rows;

  // MX (menu-exposed) label per node, from the co-resident old block — for human comparison only.
  const menuById: Record<string, any> = {};
  for (const r of (run?.finalJudge?.rows || [])) menuById[String(r.id)] = r.menu?.[r.tier] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#20242e", color: "#e7e2d8", borderRadius: 10, padding: "9px 13px", fontSize: 12, lineHeight: 1.5 }}>
        <b style={{ color: "#fbbf24" }}>Graph judge · provisional.</b> Resolver not yet expert-validated
        (Qwen3-0.6B · scheme b · THR {block.threshold ?? "?"}). Scores shown for comparison — they do <b>not</b> endorse; the Patrick gate governs.
      </div>

      <div style={CARD}>
        <div style={SEC}>{block.judge || "graph judge"}{datasetName ? ` · vs ${datasetName}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Stat label="Graph-routed" big={`${cov.graph_pct ?? "—"}%`} sub={`${cov.graph ?? 0} / ${cov.n ?? 0} nodes`} tone="#0e7490" />
          <Stat label="Of scoreable" big={`${pctScoreable}%`} sub={`${cov.graph ?? 0} / ${scoreable} with GT`} tone="#0e7490" />
          <Stat label="Mean score" big={agg.mean_score_graph_routed != null ? Number(agg.mean_score_graph_routed).toFixed(3) : "—"} sub="graph-routed" />
          <Stat label="Not scored" big={String(cov.not_scored ?? 0)} sub="no GT at tier" tone="#6b655d" />
        </div>
        {Object.keys(buckets).length ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", border: "1px solid #eee7df" }}>
              {BUCKETS.map(([k, c]) => buckets[k] ? <div key={k} style={{ flex: buckets[k], background: c }} title={`${k}: ${buckets[k]}`} /> : null)}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 7, fontSize: 11.5, color: "#6b655d" }}>
              {BUCKETS.map(([k, c]) => buckets[k] ? <span key={k}><b style={{ color: c }}>{buckets[k]}</b> {k.replace("_", "-")}</span> : null)}
            </div>
          </div>
        ) : null}
      </div>

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
