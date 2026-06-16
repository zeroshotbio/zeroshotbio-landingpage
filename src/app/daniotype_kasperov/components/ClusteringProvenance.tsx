"use client";
// ClusteringProvenance — "how the clustering is decided" panel: identity strip,
// de-novo recipe, the Leiden resolution sweep (res/clusters/coherence/min-size,
// chosen row highlighted) OR silhouette-gating note, and the coherence/min-size
// criteria. Extracted from KasperovClient.tsx so the new-run step 1 AND the
// read-only run viewer's Clustering tab share it. `showProceedHint` adds the
// new-run "good to proceed?" footer (off in the viewer).
import React from "react";
import DATASET_FACTS from "../dataset_facts.json";
import { ACCENT, THEME } from "../theme";

const FACTS: Record<string, any> = DATASET_FACTS as any;

export function ClusteringProvenance({ datasetId, nClusters, datasetName, showProceedHint = false }: { datasetId: string; nClusters: number; datasetName: string; showProceedHint?: boolean }) {
  const f: any = FACTS[datasetId];
  if (!f) return null;
  const sweep: any[] | null = f.sweep ?? null;
  const card: React.CSSProperties = { width: "100%", margin: "20px auto 0", textAlign: "left", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
  const th: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", padding: "2px 8px", textAlign: "right" };
  const renderSweep = (rows: any[], compact = false) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: "left" }}>res</th><th style={th}>clusters</th>
          <th style={{ ...th, textAlign: "left", paddingLeft: 14 }}>coherence</th><th style={th}>min size</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.res} style={{ background: s.chosen ? "#ecfdf3" : "transparent", color: s.chosen ? "#15803d" : "#4a443d", fontWeight: s.chosen ? 700 : 400 }}>
            <td style={{ padding: "3px 8px" }}>{s.res.toFixed(1)}{s.chosen ? " ★" : ""}</td>
            <td style={{ padding: "3px 8px", textAlign: "right" }}>{s.clusters}</td>
            <td style={{ padding: "3px 8px 3px 14px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: compact ? 70 : 110, height: 6, background: "#ece8e2", borderRadius: 99, overflow: "hidden", display: "inline-block" }}>
                  <span style={{ display: "block", height: "100%", width: `${s.coherence * 100}%`, background: s.coherence >= 0.95 ? "#15803d" : s.coherence >= 0.8 ? "#ca8a04" : "#dc2626", borderRadius: 99 }} />
                </span>
                <span>{s.coherence.toFixed(3)}</span>
              </span>
            </td>
            <td style={{ padding: "3px 8px", textAlign: "right", color: s.minSize < 30 ? "#b45309" : "inherit" }}>{s.minSize}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const name = datasetName;
  const isGt = f.role === "gt";
  const ident: [string, string][] = [
    ["cells", `${(f.cells as number).toLocaleString()}${f.fullCells && f.fullCells > f.cells ? ` (of ${(f.fullCells as number).toLocaleString()})` : ""}`],
    ["platform", f.platform],
    ["source", `${f.lab}${f.year ? " · " + f.year : ""}`],
    ["gene namespace", f.namespace],
  ];
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: ACCENT }}>How the clustering is decided · {nClusters} clusters</div>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: isGt ? "#15803d" : "#475569", background: isGt ? "#dcfce7" : "#eef2f6", borderRadius: 99, padding: "2px 8px" }}>{isGt ? "✓ GT benchmark" : "internal"}</span>
      </div>

      {/* decision at a glance — the outcome + the one variable that drives it */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d" }}>Chosen</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#14532d", lineHeight: 1.1 }}>{sweep ? `res ${f.chosenRes}` : "silhouette-gated"} → {f.clusters} clusters</div>
        </div>
        <div style={{ flex: 1, minWidth: 220, fontSize: 12, color: "#3f5a47", lineHeight: 1.45 }}>
          {sweep
            ? "the finest Leiden resolution where ≥95% of clusters carry a strong, specific marker and none drops below 30 cells — coarse enough to trust, fine enough to be useful."
            : "adaptive per-branch sub-splitting: a cluster splits further only when the split is geometrically clean (mean silhouette ≥ 0.05) and every leaf keeps enough cells."}
        </div>
      </div>

      {/* identity strip */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 11.5, color: "#555", lineHeight: 1.5, marginBottom: 10 }}>
        {ident.map(([a, b], i) => (
          <React.Fragment key={i}>
            <span style={{ fontWeight: 700, color: "#3f3a34" }}>{a}</span>
            <span style={{ color: "#6b655d" }}>{b}</span>
          </React.Fragment>
        ))}
      </div>

      {/* method */}
      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.55, margin: "0 0 10px" }}>
        We re-cluster {name} <b>de-novo</b>{isGt ? " — the authors' published cell-type labels are held out, so after labeling we score our calls against them" : ""}. Pipeline: <code style={{ background: "#f3f0ec", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>{f.recipe}</code>.
      </p>

      {sweep ? (
        <>
          <p style={{ fontSize: 12.5, color: "#6b655d", lineHeight: 1.55, margin: "0 0 8px" }}>
            We sweep the Leiden resolution and score each one for <b>coherence</b> — the fraction of clusters carrying at least one strongly-enriched, cluster-specific marker — and minimum cluster size. The rule picks the <b>finest resolution that still holds together</b>: <code style={{ background: "#f3f0ec", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>{f.selectionRule}</code> → <b style={{ color: "#15803d" }}>res {f.chosenRes}, {f.clusters} clusters</b>.
          </p>
          {renderSweep(sweep)}
        </>
      ) : f.selectionNote ? (
        <p style={{ fontSize: 12.5, color: "#6b655d", lineHeight: 1.55, margin: "0 0 6px" }}>{f.selectionNote}</p>
      ) : null}

      {/* why we trust each cluster — the coherence + min-size + silhouette criteria */}
      <div style={{ marginTop: 12, background: "#f6faf7", border: "1px solid #d6e8db", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#3f5a47", lineHeight: 1.55 }}>
        <b>Why we trust each cluster.</b> A cluster counts as <b>coherent</b> when it carries at least one marker gene that is both <b>strongly enriched</b> (≥2×, log<sub>2</sub>FC ≥ 1) and <b>specific</b> — expressed in ≥25% of its cells and ≥15 percentage-points more than the rest of the atlas. The resolution we keep is the finest one where <b>≥95%</b> of clusters clear that bar and none falls below <b>30 cells</b> — coarse enough to trust, fine enough to be useful.
        {f.subSplitNote && <div style={{ marginTop: 6 }}>{f.subSplitNote}</div>}
      </div>

      {/* MegaFin (Manual) embedding story */}
      {f.coherenceNote && (
        <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
          <b>MegaFin&rsquo;s real story.</b> {f.coherenceNote}
          {f.rejectedReembed?.sweep && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#b45309", marginBottom: 2 }}>Rejected: standard HVG→PCA→Harmony re-embed</div>
              {renderSweep(f.rejectedReembed.sweep, true)}
            </div>
          )}
        </div>
      )}
      {showProceedHint && (
      <p style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.55, margin: "12px 0 0", borderTop: "1px solid #efece7", paddingTop: 10 }}>
        Good to proceed? <b style={{ color: THEME.research.color }}>Apply this clustering</b> to colour the map in, then <b style={{ color: ACCENT }}>choose a model</b> and a <b>harness</b> — and two <b style={{ color: THEME.research.color }}>Proposers</b> debate each of these {nClusters} clusters while the <b style={{ color: THEME.reason.color }}>Archivist</b> grounds the call in real marker stats.
      </p>
      )}
    </div>
  );
}
