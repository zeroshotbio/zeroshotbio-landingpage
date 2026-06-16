"use client";
// RunViewer — the read-only "view a completed run" path (Phase 2b). Renders a
// saved run JSON with NO editing / streaming / autopilot machinery: the atlas
// map, a per-cluster panel (label · confidence · markers · saved transcript),
// and a ground-truth summary — each shown only when the run actually captured
// it (progressive disclosure driven by computeCompletenessProfile). Reuses the
// presentational components extracted in Phase 1.
import React, { useMemo, useState } from "react";
import { useAtlas } from "../useAtlas";
import { computeCompletenessProfile } from "../completeness";
import type { ClusterConf, DatasetDef } from "../types";
import { PAPER, INK, ACCENT, confColor, btnGhost } from "../theme";
import { UmapCanvas } from "./UmapCanvas";
import { AgentMessage } from "./ChatMessage";
import { MarkersContent } from "./MarkersPanel";
import { ConfidenceContent } from "./ConfidencePanel";

// Strip the hidden ```kasperov-*``` control blocks the live loop embeds in
// assistant turns, so the saved transcript reads as clean prose. Best-effort
// (display only) — mirrors the intent of the wizard's splitMarker/Conclude parse.
function stripControlBlocks(s: string): string {
  return String(s || "")
    .replace(/```+\s*kasperov-\w+[\s\S]*?```+/g, "")
    .replace(/kasperov-\w+\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Chip({ on, label, off }: { on: boolean; label: string; off?: string }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap",
        color: on ? "#15803d" : "#9a948c", background: on ? "#f0fdf4" : "#f1ede8",
        border: `1px solid ${on ? "#bbf7d0" : "#e5e1dc"}`,
      }}
    >
      {on ? "✓ " : "○ "}{on ? label : off ?? `${label} · not recorded`}
    </span>
  );
}

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 8px" };
const notRecorded = (what: string) => <div style={{ fontSize: 12.5, color: "#b0a89e", fontStyle: "italic" }}>{what} — not recorded in this run.</div>;

const ARCHIVE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  quarantined: { bg: "#fef2f2", fg: "#b91c1c", label: "⚠ quarantined · contaminated" },
  superseded: { bg: "#eef2f6", fg: "#475569", label: "superseded" },
  other: { bg: "#f1ede8", fg: "#7a746c", label: "archived" },
};

export function RunViewer({ run, meta, dataset, onBack }: { run: any; meta?: any; dataset: DatasetDef; onBack: () => void }) {
  const { clusters, error } = useAtlas(dataset.dataUrl);
  const profile = useMemo(() => computeCompletenessProfile(run, meta), [run, meta]);
  const runClusters: any[] = Array.isArray(run?.clusters) ? run.clusters : [];
  const byId = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of runClusters) m.set(String(c.id), c);
    return m;
  }, [run]);
  const validated = useMemo(() => new Set(runClusters.filter((c) => c.validated).map((c) => String(c.id))), [run]);
  const labelledIds = useMemo(() => runClusters.filter((c) => c.finalLabel).map((c) => String(c.id)), [run]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"clustering" | "modelHarness" | "labels">("clustering");
  const active = activeId ?? labelledIds[0] ?? clusters?.[0]?.id ?? null;
  const atlasActive = clusters?.find((c) => c.id === active) || null;
  const runActive = active ? byId.get(active) : null;

  const gt = run?.groundTruth;
  const archived = !!meta?.archived;
  const archiveCat = profile.archive.category || "other";
  const money = (v: number) => (v == null ? "?" : v < 1 ? v.toFixed(3) : v.toFixed(2));

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 22px 70px" }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={btnGhost}>← Back to datasets</button>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>{dataset.name} · view completed run</div>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#999", fontFamily: "ui-monospace, monospace" }}>read-only</span>
        </div>

        {/* metadata header */}
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{run?.model ?? "?"}</span>
            <span style={{ fontSize: 12.5, color: "#666" }}>
              {profile.labelledClusters}/{profile.nClusters} labelled
              {profile.scored ? " · scored" : ""}
              {run?.exportedAt ? ` · ${new Date(run.exportedAt).toLocaleString()}` : ""}
              {run?.cost?.usd != null ? ` · ~$${money(Number(run.cost.usd))}${run?.cost?.estimated ? "*" : ""}` : ""}
            </span>
            {run?.harness ? (
              <span title={run.harness.gitCommit ? `commit ${run.harness.gitCommit}` : undefined} style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", background: "#eef2f6", borderRadius: 99, padding: "1px 8px" }}>
                harness v{run.harness.version}{run.harness.name ? ` · ${run.harness.name}` : ""}
              </span>
            ) : null}
            {(run?.schemaBasis || meta?.schemaBasis) ? (
              <span title={meta?.basisNote || run?.basisNote || ""} style={{ fontSize: 10.5, fontWeight: 700, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "1px 8px" }}>
                {run?.schemaBasis || meta?.schemaBasis}{run?.promotedFrom || meta?.promotedFrom ? " · promoted" : ""}
              </span>
            ) : null}
            {archived ? (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: ARCHIVE_BADGE[archiveCat].fg, background: ARCHIVE_BADGE[archiveCat].bg, borderRadius: 99, padding: "1px 8px", border: `1px solid ${ARCHIVE_BADGE[archiveCat].fg}33` }}>
                {ARCHIVE_BADGE[archiveCat].label}
              </span>
            ) : null}
          </div>
          {run?.dataset ? <div style={{ fontSize: 11.5, color: "#7a746c", marginTop: 6 }}>🧬 {run.dataset}</div> : null}
          {run?.note ? <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 5, lineHeight: 1.45 }}>📝 {run.note}</div> : null}
          {/* completeness chips — what this run actually captured */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <Chip on={profile.hasLabels} label={`labels ${profile.labelledClusters}/${profile.nClusters}`} />
            <Chip on={profile.hasConfidence} label="tier confidence" />
            <Chip on={profile.hasTranscripts} label={`transcripts ${profile.transcriptClusters}/${profile.nClusters}`} />
            <Chip on={profile.scored} label="ground-truth scored" off="no ground truth" />
            <Chip on={profile.hasMarkers} label="chat markers" />
            <Chip on={profile.hasHarness} label="harness stamped" />
            <Chip on={profile.hasClusteringStrategy} label="clustering strategy" />
          </div>
        </div>

        {/* tabs — mirror the new-run steps */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {([["clustering", "1. Clustering"], ["modelHarness", "2. Model & Harness"], ["labels", "3. Cell Labelling"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...btnGhost, fontWeight: 700, ...(tab === k ? { background: ACCENT, color: "#fff", borderColor: ACCENT } : {}) }}>{label}</button>
          ))}
        </div>

        {error && <div style={{ ...CARD, color: "#b91c1c" }}>Failed to load the atlas: {error}</div>}

        {/* 1. CLUSTERING — the atlas map + how it was clustered */}
        {tab === "clustering" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...CARD, padding: 10, textAlign: "center" }}>
              {clusters ? (
                <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={validated} width={560} height={420} />
              ) : (
                <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>Loading atlas…</div>
              )}
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>green ✓ = validated cluster</div>
            </div>
            <div style={CARD}>
              <div style={SEC}>Clustering</div>
              <div style={{ fontSize: 13.5, color: "#444" }}>{runClusters.length} clusters · {profile.validatedClusters} validated</div>
              {run?.dataset ? <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 5 }}>🧬 {run.dataset}</div> : notRecorded("Clustering recipe")}
            </div>
          </div>
        )}

        {/* 2. MODEL & HARNESS — run config */}
        {tab === "modelHarness" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={CARD}>
              <div style={SEC}>Model</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{run?.model ?? "?"}</div>
              {run?.cost?.usd != null ? <div style={{ fontSize: 12.5, color: "#666", marginTop: 2 }}>~${money(Number(run.cost.usd))}{run?.cost?.estimated ? " (est.)" : ""} total cost</div> : null}
            </div>
            <div style={CARD}>
              <div style={SEC}>Harness</div>
              {run?.harness ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>v{run.harness.version}{run.harness.name ? ` · ${run.harness.name}` : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#9a948c", fontFamily: "ui-monospace, monospace", marginTop: 3 }}>{run.harness.gitCommit ? `commit ${run.harness.gitCommit}` : ""}{run.harness.stampedAt ? ` · stamped ${String(run.harness.stampedAt).slice(0, 10)}` : ""}</div>
                </>
              ) : notRecorded("Harness")}
            </div>
            <div style={CARD}>
              <div style={SEC}>Run provenance</div>
              {run?.provenance && typeof run.provenance === "object" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Object.entries(run.provenance).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, display: "flex", gap: 8, lineHeight: 1.4 }}>
                      <span style={{ width: 150, flexShrink: 0, color: "#9a948c", fontWeight: 700 }}>{k}</span>
                      <span style={{ color: "#444", wordBreak: "break-word" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : notRecorded("Run provenance")}
            </div>
          </div>
        )}

        {/* 3. CELL LABELLING — per-cluster labels/confidence/markers/transcript + GT scorecard */}
        {tab === "labels" && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 14, alignItems: "start" }}>
            {/* left: cluster list */}
            <div style={{ ...CARD, maxHeight: 520, overflow: "auto", padding: 8 }}>
              <div style={SEC}>Clusters ({runClusters.length})</div>
              {runClusters.map((c) => {
                const id = String(c.id);
                const isA = id === active;
                return (
                  <div key={id} onClick={() => setActiveId(id)} style={{ cursor: "pointer", padding: "5px 7px", borderRadius: 7, background: isA ? "#eef2f6" : "transparent", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>#{id}</span>
                    {c.validated ? <span style={{ color: "#15803d", marginLeft: 5 }}>✓</span> : null}
                    <div style={{ fontSize: 12, color: c.finalLabel ? "#444" : "#b0a89e", lineHeight: 1.3 }}>{c.finalLabel || "not labelled"}</div>
                  </div>
                );
              })}
            </div>

            {/* right: active cluster detail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!runActive ? (
                <div style={CARD}>{notRecorded("This cluster")}</div>
              ) : (
                <>
                  <div style={CARD}>
                    <div style={{ fontSize: 11, color: "#9a948c", fontWeight: 700 }}>CLUSTER #{active}{runActive.label ? ` · ${runActive.label}` : ""}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: runActive.finalLabel ? INK : "#b0a89e" }}>
                      {runActive.finalLabel || "not labelled in this run"}
                      {runActive.validated ? <span style={{ fontSize: 12, color: "#15803d", marginLeft: 8, fontWeight: 700 }}>✓ validated</span> : null}
                    </div>
                  </div>

                  <div style={CARD}>
                    <div style={SEC}>Tier confidence</div>
                    {runActive.confidence?.germ_layer ? <ConfidenceContent conf={runActive.confidence as ClusterConf} /> : notRecorded("Tier confidence")}
                  </div>

                  <div style={CARD}>
                    <div style={SEC}>Top markers</div>
                    {atlasActive ? <MarkersContent cluster={atlasActive} added={Array.isArray(runActive.addedMarkers) ? runActive.addedMarkers : []} /> : <div style={{ fontSize: 12.5, color: "#aaa" }}>Loading atlas…</div>}
                  </div>

                  <div style={CARD}>
                    <div style={SEC}>Transcript</div>
                    {Array.isArray(runActive.transcript) && runActive.transcript.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {runActive.transcript.map((t: any, i: number) =>
                          t.role === "user" ? (
                            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#eef2f6", border: "1px solid #dfe6ee", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, color: "#334", lineHeight: 1.5 }}>
                              {stripControlBlocks(t.content)}
                            </div>
                          ) : (
                            <AgentMessage key={i} content={stripControlBlocks(t.content)} mode={t.mode} thinking={t.thinking} />
                          )
                        )}
                      </div>
                    ) : (
                      notRecorded("Transcript")
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* GT scorecard sits under the labels — it scores those labels */}
          {profile.hasGroundTruth && (
            <div style={{ marginTop: 20 }}>
              <div style={{ ...SEC, fontSize: 13, marginBottom: 10 }}>Ground-truth scorecard</div>
              <ScorecardSummary gt={gt} clustersById={byId} datasetName={dataset.name} />
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

// Lean, read-only ground-truth summary rendered straight from the saved
// run.groundTruth (aggregate + stratified + abstention + per-cluster verdicts).
// Deliberately NOT the interactive Scorecard — no re-scoring, no fetch.
function ScorecardSummary({ gt, clustersById, datasetName }: { gt: any; clustersById: Map<string, any>; datasetName: string }) {
  if (!gt) return <div style={CARD}>{notRecorded("Ground-truth comparison")}</div>;
  const agg: any[] = Array.isArray(gt.aggregate) ? gt.aggregate : [];
  const verdicts: Record<string, any> = gt.verdicts || {};
  const TIERS = [
    { key: "germ_layer", label: "Germ layer" },
    { key: "tissue", label: "Tissue" },
    { key: "cell_type_broad", label: "Cell — broad" },
    { key: "cell_type_sub", label: "Cell — sub" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {agg.map((t) => {
          const heat = confColor(t.pct ?? 0);
          return (
            <div key={t.key} style={CARD}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", fontWeight: 700 }}>{t.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: heat.fg, fontVariantNumeric: "tabular-nums" }}>{t.total ? (t.pct ?? 0).toFixed(0) : "—"}{t.total ? "%" : ""}</span>
                <span style={{ fontSize: 12.5, color: "#999" }}>{t.matched}/{t.total} agree</span>
              </div>
              <div style={{ height: 8, background: "#eee7df", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${t.pct ?? 0}%`, height: "100%", background: heat.fg }} />
              </div>
            </div>
          );
        })}
      </div>

      {gt.subStratified && (
        <div style={CARD}>
          <div style={SEC}>Sub-type — purity stratified</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>
            high-purity <b style={{ color: "#15803d" }}>{gt.subStratified.high?.total ? gt.subStratified.high.pct.toFixed(0) + "%" : "—"}</b> ({gt.subStratified.high?.matched}/{gt.subStratified.high?.total}) · raw {gt.subStratified.raw?.pct?.toFixed(0)}% · weighted {gt.subStratified.weighted_pct?.toFixed(0)}%
          </div>
        </div>
      )}
      {gt.abstention && (
        <div style={CARD}>
          <div style={SEC}>Abstention</div>
          <div style={{ fontSize: 13, color: "#444" }}>assign {gt.abstention.n_assign} · abstain {gt.abstention.n_abstain} · unresolved {gt.abstention.n_unresolved}</div>
        </div>
      )}

      <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ ...SEC, padding: "12px 14px 0" }}>Per-cluster verdicts</div>
        <div style={{ maxHeight: 420, overflow: "auto", padding: "8px 14px 14px" }}>
          {Object.keys(verdicts).length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>No per-cluster verdicts saved.</div>}
          {Object.entries(verdicts).map(([id, v]: [string, any]) => {
            const c = clustersById.get(String(id));
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f3f0ec", fontSize: 12.5 }}>
                <span style={{ width: 34, fontWeight: 700, color: "#666" }}>#{id}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c?.finalLabel || ""}>{c?.finalLabel || "—"}</span>
                {TIERS.map((t) => {
                  const tv = v[t.key];
                  if (!tv) return <span key={t.key} style={{ width: 16, textAlign: "center", color: "#ccc" }}>·</span>;
                  return <span key={t.key} title={t.label} style={{ width: 16, textAlign: "center", color: tv.match ? "#15803d" : "#dc2626", fontWeight: 800 }}>{tv.match ? "✓" : "✗"}</span>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
