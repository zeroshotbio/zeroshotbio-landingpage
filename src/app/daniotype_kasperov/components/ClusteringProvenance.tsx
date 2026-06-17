"use client";
// ClusteringProvenance — "how the clustering is decided" panel.
//
// TWO MODES:
//   * mode="wizard" (default) — the LIVE New Run step 1. It is actively clustering and has
//     no saved run, so it reads live dataset_facts.json (FACTS). UNCHANGED behaviour.
//   * mode="viewer" — the read-only run viewer. It renders the RUN's OWN
//     `clusteringStrategy` snapshot and NEVER falls back to live FACTS. If the run has no
//     strategy, it says so explicitly ("not recorded in this run") rather than showing live
//     data — otherwise the drift bug survives for un-back-filled runs.
//
// The mode gate is wizard-vs-viewer, NOT field-presence.
import React from "react";
import DATASET_FACTS from "../dataset_facts.json";
import { ACCENT, THEME } from "../theme";

const FACTS: Record<string, any> = DATASET_FACTS as any;

const PCARD: React.CSSProperties = { width: "100%", margin: "20px auto 0", textAlign: "left", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
const PTH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", padding: "2px 8px", textAlign: "right" };

// A "reconstructed · backfilled <date>" badge — visually DISTINCT from a native-capture ✓
// (slate/indigo dashed), so the viewer never presents reconstructed provenance as captured
// at run time. Tooltip lists the backfillSources paths + short hashes.
export function BackfillBadge({ at, sources }: { at?: string | null; sources?: any[] }) {
  const title = (Array.isArray(sources) ? sources : [])
    .map((s) => `${s?.path ?? "?"}  ${String(s?.sha256 ?? "").slice(0, 12)}`)
    .join("\n");
  return (
    <span
      title={title || undefined}
      style={{ fontSize: 10, fontWeight: 700, color: "#4338ca", background: "#eef2ff", border: "1px dashed #a5b4fc", borderRadius: 99, padding: "1px 8px", whiteSpace: "nowrap", letterSpacing: 0.2 }}
    >
      ⟲ reconstructed{at ? ` · ${String(at).slice(0, 10)}` : ""}
    </span>
  );
}

function renderSweep(rows: any[], compact = false) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
      <thead>
        <tr>
          <th style={{ ...PTH, textAlign: "left" }}>res</th><th style={PTH}>clusters</th>
          <th style={{ ...PTH, textAlign: "left", paddingLeft: 14 }}>coherence</th><th style={PTH}>min size</th>
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
}

// ---- VIEWER MODE: render the run's own clusteringStrategy snapshot, never live FACTS ----
function ViewerClusteringProvenance({ strategy, nClusters }: { strategy: any; nClusters: number }) {
  const hdr = (
    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: ACCENT }}>
      How this run clustered · {nClusters} clusters
    </div>
  );
  if (!strategy || typeof strategy !== "object") {
    return (
      <div style={PCARD}>
        {hdr}
        <div style={{ fontSize: 12.5, color: "#b0a89e", fontStyle: "italic", marginTop: 8 }}>Clustering strategy — not recorded in this run.</div>
      </div>
    );
  }
  const s = strategy;
  const native = s.basis === "native-schema";
  const label: React.CSSProperties = { fontWeight: 700, color: "#3f3a34" };
  const val: React.CSSProperties = { color: "#6b655d" };

  return (
    <div style={PCARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {hdr}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: native ? "#7c3aed" : "#475569", background: native ? "#f3e8ff" : "#eef2f6", borderRadius: 99, padding: "2px 8px" }}>
          {native ? "native-schema basis" : "de-novo"}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          {s.backfilled ? <BackfillBadge at={s.backfillAt} sources={s.backfillSources} /> : null}
        </span>
      </div>

      {native ? (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 12px", fontSize: 12, lineHeight: 1.5 }}>
          <span style={label}>basis</span><span style={val}>native-schema — {s.derivation || "authors' published finest cell groups"}</span>
          {s.nGroups != null ? (<><span style={label}>groups</span><span style={val}>{s.nGroups}</span></>) : null}
          {s.referenceAsset ? (<><span style={label}>reference asset</span><span style={{ ...val, fontFamily: "ui-monospace, monospace", fontSize: 11.5, wordBreak: "break-all" }}>{s.referenceAsset}</span></>) : null}
          {s.nativeTiers && typeof s.nativeTiers === "object" ? (
            <><span style={label}>native tiers</span><span style={val}>{Object.entries(s.nativeTiers).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span></>
          ) : null}
          {s.lab ? (<><span style={label}>lab</span><span style={val}>{s.lab}</span></>) : null}
          {s.note ? (<><span style={label}>note</span><span style={val}>{s.note}</span></>) : null}
        </div>
      ) : (
        <>
          {/* decision at a glance — from the RUN's own numbers */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: s.nonStandard ? "#fffbeb" : "#ecfdf3", border: `1px solid ${s.nonStandard ? "#fde68a" : "#bbf7d0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: s.nonStandard ? "#b45309" : "#15803d" }}>Chosen</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: s.nonStandard ? "#92400e" : "#14532d", lineHeight: 1.1 }}>
                res {s.chosenRes}{" → "}
                {s.merged && s.rawSweepClusters ? `${s.rawSweepClusters} raw → ${s.nClusters ?? nClusters} after merge` : `${s.nClusters ?? nClusters} clusters`}
              </div>
            </div>
            {s.minClusterSize != null ? <div style={{ fontSize: 12, color: "#3f5a47" }}>min cluster size {s.minClusterSize}</div> : null}
          </div>

          {/* NON-STANDARD selection banner — the manual-override + merge story */}
          {s.nonStandard ? (
            <div style={{ marginBottom: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠ Non-standard selection</div>
              {s.selectionNote ? <div style={{ marginBottom: 6 }}>{s.selectionNote}</div> : null}
              {s.merged ? (
                <div style={{ marginBottom: 6 }}>
                  <b>Merge:</b> cluster {s.merged.from} → {s.merged.into}
                  {s.merged.cells_moved != null ? ` (${s.merged.cells_moved} cells)` : ""}
                  {s.rawSweepClusters ? ` — raw sweep ${s.rawSweepClusters} → ${s.nClusters ?? nClusters} clusters` : ""}
                  {s.merged.renumbered_to_contiguous ? ", renumbered contiguous" : ""}.
                </div>
              ) : null}
              {s.gate ? <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{s.gate}</div> : null}
            </div>
          ) : null}

          {s.recipe ? (
            <p style={{ fontSize: 12.5, color: "#555", lineHeight: 1.55, margin: "0 0 8px" }}>
              Pipeline: <code style={{ background: "#f3f0ec", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>{s.recipe}</code>
            </p>
          ) : null}
          {s.embedding ? <p style={{ fontSize: 12, color: "#6b655d", lineHeight: 1.5, margin: "0 0 8px" }}>{s.embedding}</p> : null}
          {s.selectionRule && !s.nonStandard ? (
            <p style={{ fontSize: 12.5, color: "#6b655d", lineHeight: 1.55, margin: "0 0 8px" }}>
              Selection rule: <code style={{ background: "#f3f0ec", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>{s.selectionRule}</code>
            </p>
          ) : null}

          {Array.isArray(s.sweep) && s.sweep.length ? renderSweep(s.sweep) : null}

          {s.gate && !s.nonStandard ? (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "#15803d", fontFamily: "ui-monospace, monospace" }}>{s.gate}</div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ClusteringProvenance({
  datasetId, nClusters, datasetName, showProceedHint = false, mode = "wizard", strategy = null,
}: { datasetId: string; nClusters: number; datasetName: string; showProceedHint?: boolean; mode?: "wizard" | "viewer"; strategy?: any }) {
  // VIEWER: run-owned snapshot only, never live FACTS.
  if (mode === "viewer") return <ViewerClusteringProvenance strategy={strategy} nClusters={nClusters} />;

  // WIZARD (live New Run): FACTS-driven — actively clustering, no saved run. UNCHANGED.
  const f: any = FACTS[datasetId];
  if (!f) return null;
  const sweep: any[] | null = f.sweep ?? null;
  const card = PCARD;
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
