"use client";
import React, { useState } from "react";

// Faithful renderer for the parallel GRAPH-JUDGE block (finalJudge_graph /
// expertGtScorecard_graph, Burst 23). Continuous score + route + graph-structural
// detail — NOT a binarized reshape. Sibling to MergedNodeScorecard; additive, the
// old LLM view is untouched. Provisional: shows the new scores, does not endorse
// them (the Patrick expert gate still governs).

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 8px" };

const scoreColor = (s: number | null) => s == null ? "#c9c2b8" : s >= 0.7 ? "#15803d" : s >= 0.4 ? "#b45309" : "#dc2626";
const ROUTE: Record<string, { c: string; bg: string; label: string }> = {
  graph: { c: "#0e7490", bg: "#ecfeff", label: "graph" },
  llm_fallback: { c: "#b45309", bg: "#fffbeb", label: "llm-fallback" },
  not_scored: { c: "#6b655d", bg: "#f2efeb", label: "not scored" },
};
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

export function GraphJudgeScorecard({ block, datasetName }: { block: any; datasetName?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!block || !Array.isArray(block.rows)) return null;
  const cov = block.coverage || {}, agg = block.aggregate || {};
  const scoreable = (cov.graph || 0) + (cov.fallback || 0);
  const pctScoreable = scoreable ? Math.round((100 * (cov.graph || 0)) / scoreable) : 0;
  const buckets = agg.buckets || {};
  const rows: any[] = block.rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* provisional banner — honest-dark, shows without endorsing */}
      <div style={{ background: "#20242e", color: "#e7e2d8", borderRadius: 10, padding: "9px 13px", fontSize: 12, lineHeight: 1.5 }}>
        <b style={{ color: "#fbbf24" }}>Graph judge · provisional.</b> Resolver not yet expert-validated
        (Qwen3-0.6B · scheme b · THR {block.threshold ?? "?"}). These continuous scores are shown for comparison —
        they do <b>not</b> replace or endorse the expert judgement; the Patrick gate still governs.
      </div>

      {/* header aggregates */}
      <div style={CARD}>
        <div style={SEC}>{block.judge || "graph judge"}{datasetName ? ` · vs ${datasetName}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Stat label="Graph-routed" big={`${cov.graph_pct ?? "—"}%`} sub={`${cov.graph ?? 0} / ${cov.n ?? 0} nodes`} tone="#0e7490" />
          <Stat label="Of scoreable" big={`${pctScoreable}%`} sub={`${cov.graph ?? 0} / ${scoreable} with GT`} tone="#0e7490" />
          <Stat label="Mean score" big={agg.mean_score_graph_routed != null ? Number(agg.mean_score_graph_routed).toFixed(3) : "—"} sub="graph-routed" />
          <Stat label="Not scored" big={String(cov.not_scored ?? 0)} sub="no GT at tier" tone="#6b655d" />
        </div>
        {/* bucket distribution */}
        {Object.keys(buckets).length ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", border: "1px solid #eee7df" }}>
              {BUCKETS.map(([k, c]) => buckets[k] ? <div key={k} style={{ flex: buckets[k], background: c }} title={`${k}: ${buckets[k]}`} /> : null)}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 7, fontSize: 11.5, color: "#6b655d" }}>
              {BUCKETS.map(([k, c]) => buckets[k] ? <span key={k}><b style={{ color: c, fontVariantNumeric: "tabular-nums" }}>{buckets[k]}</b> {k.replace("_", "-")}</span> : null)}
            </div>
          </div>
        ) : null}
      </div>

      {/* per-row table */}
      <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "#f3f0ec", color: "#555" }}>
              <th style={{ padding: "7px 10px", textAlign: "left" }}>Node · predicted → GT</th>
              <th style={{ padding: "7px 10px", textAlign: "left", width: 150 }}>Score</th>
              <th style={{ padding: "7px 10px", textAlign: "left", width: 110 }}>Route</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rt = ROUTE[r.route] || ROUTE.not_scored;
              const isOpen = open === r.id;
              const s = typeof r.score === "number" ? r.score : null;
              return (
                <React.Fragment key={r.id}>
                  <tr onClick={() => setOpen(isOpen ? null : r.id)} style={{ borderTop: "1px solid #f2ede6", cursor: "pointer", background: isOpen ? "#faf8f5" : undefined }}>
                    <td style={{ padding: "6px 10px", maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, color: "#33312e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.identity}>{r.identity || "—"}</div>
                      <div style={{ color: "#9a948c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={String(r.gt ?? "")}>→ {r.gt ?? "—"}</div>
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      {s == null ? <span style={{ color: "#b0a89e", fontSize: 11 }}>{r.route === "not_scored" ? "no GT at tier" : "—"}</span> : (
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 70, height: 7, background: "#eee7df", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                            <div style={{ width: `${Math.round(s * 100)}%`, height: "100%", background: scoreColor(s) }} />
                          </div>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: scoreColor(s) }}>{s.toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: rt.c, background: rt.bg, border: `1px solid ${rt.c}33`, borderRadius: 99, padding: "2px 8px" }}>{rt.label}</span>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr style={{ background: "#faf8f5" }}>
                      <td colSpan={3} style={{ padding: "8px 12px 12px", fontSize: 11.5, color: "#5a554e" }}>
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                          <span><b>subsumption:</b> {r.subsumption ?? "—"}</span>
                          <span><b>distance (dₙ):</b> {r.distance ?? "—"}</span>
                          <span><b>path:</b> {Array.isArray(r.path_edge_types) && r.path_edge_types.length ? r.path_edge_types.join(" → ") : "—"}</span>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", gap: 18, flexWrap: "wrap" }}>
                          <span><b style={{ color: "#0891b2" }}>pred</b> {r.pred_zfa_name ?? "unresolved"} <span style={{ color: "#9a948c" }}>({r.pred_via ?? "—"}{r.pred_zfa ? ` · ${r.pred_zfa}` : ""})</span></span>
                          <span><b style={{ color: "#a59f96" }}>gt</b> {r.gt_zfa_name ?? "unresolved"} <span style={{ color: "#9a948c" }}>({r.gt_via ?? "—"}{r.gt_zfa ? ` · ${r.gt_zfa}` : ""})</span></span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#9a948c", lineHeight: 1.5 }}>
        Score = ZFA graph distance (scheme b): 1.0 exact/subsumption, ~0.5–0.67 near-miss (part_of), lower = further apart.
        Click a row for the resolved ZFA nodes, path, and how each side resolved (string / embed / cl-bridge).
      </div>
    </div>
  );
}
