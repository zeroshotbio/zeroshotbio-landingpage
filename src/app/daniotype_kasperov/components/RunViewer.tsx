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
import { ClusteringProvenance, BackfillBadge } from "./ClusteringProvenance";
import { HarnessDetail } from "./HarnessDetail";
import { Scorecard } from "./Scorecard";

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

const SHA = (h: any) => String(h ?? "").slice(0, 12);
const Row = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
  <div style={{ fontSize: 12, display: "flex", gap: 10, lineHeight: 1.5 }}>
    <span style={{ width: 132, flexShrink: 0, color: "#9a948c", fontWeight: 700 }}>{k}</span>
    <span style={{ color: "#444", wordBreak: "break-word", fontFamily: mono ? "ui-monospace, monospace" : undefined, fontSize: mono ? 11.5 : undefined }}>{v}</span>
  </div>
);

// Structured Grounding panel — reads ONLY the run's own provenance.grounding (never a service).
// Un-buries the evidence-anchored cleanliness story + the self-attestation warning.
function GroundingPanel({ provenance }: { provenance: any }) {
  if (!provenance || typeof provenance !== "object") return notRecorded("Run provenance");
  const g = provenance.grounding && typeof provenance.grounding === "object" ? provenance.grounding : null;
  const denom = g?.denominatorCheck;
  const enrich: any[] = Array.isArray(g?.sampledEnrichment) ? g.sampledEnrichment : [];
  const dist = g?.distinctness;
  const refs: any[] = Array.isArray(provenance.evidenceRefs) ? provenance.evidenceRefs : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#15803d" }}>Grounding</span>
        {provenance.source ? <span style={{ fontSize: 11, color: "#888" }}>source: {String(provenance.source)}</span> : null}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          {provenance.modelSnapshot === "unrecoverable" ? (
            <span title="floating gpt-5.5 alias; dated snapshot not recoverable — pin is a forward-runs-only fix" style={{ fontSize: 10, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 8px" }}>model snapshot · unrecoverable</span>
          ) : null}
          {provenance.backfilled ? <BackfillBadge at={provenance.backfillAt} sources={refs} /> : null}
        </span>
      </div>
      {provenance.harnessNote ? <div style={{ fontSize: 11.5, color: "#7a746c", lineHeight: 1.45 }}>{provenance.harnessNote}</div> : null}
      {g ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "#f6faf7", border: "1px solid #d6e8db", borderRadius: 9, padding: "10px 12px" }}>
          {g.servedDataset ? <Row k="served dataset" v={String(g.servedDataset)} mono /> : null}
          {g.guardResult ? <Row k="guard" v={String(g.guardResult)} /> : null}
          {g.guardDetail ? <Row k="guard detail" v={String(g.guardDetail)} /> : null}
          {typeof g.abstentionRate === "number" ? <Row k="abstention" v={`${(g.abstentionRate * 100).toFixed(1)}%`} /> : null}
          {denom ? <Row k="denominator" v={`✓ ${denom.correct ?? ""}  ·  ${denom.contaminant ?? ""}`} /> : null}
          {enrich.length ? (
            <Row k="sampled enrichment" v={
              <table style={{ borderCollapse: "collapse", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                <tbody>
                  {enrich.map((e, i) => (
                    <tr key={i}>
                      <td style={{ padding: "1px 8px 1px 0", color: "#555" }}>c{e.cluster}</td>
                      <td style={{ padding: "1px 8px", fontFamily: "ui-monospace, monospace" }}>{e.gene}</td>
                      <td style={{ padding: "1px 8px", color: (Number(e.log2FC) >= 1 ? "#15803d" : "#b45309") }}>log2FC {e.log2FC}</td>
                      <td style={{ padding: "1px 8px", color: "#888" }}>padj {e.padj}{e.note ? ` · ${e.note}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            } />
          ) : null}
          {dist ? <Row k="distinctness" v={`${dist.gene} c${dist.cluster}: parse ${dist.megafin_parse} vs megafin ${dist.megafin} vs minifin ${dist.minifin} — ${dist.note ?? ""}`} /> : null}
          {g.scanNote ? <Row k="scan note" v={String(g.scanNote)} /> : null}
          {g.selfAttestationWarning ? <div style={{ fontSize: 11, color: "#9a3412", fontStyle: "italic", marginTop: 2 }}>⚠ {String(g.selfAttestationWarning)}</div> : null}
        </div>
      ) : notRecorded("Grounding")}
      {refs.length ? (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", margin: "2px 0 4px" }}>Evidence ({refs.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {refs.map((r, i) => (
              <div key={i} style={{ fontSize: 11, display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "#475569" }}>{r.path}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "#94a3b8" }}>{SHA(r.sha256)}</span>
                {r.role ? <span style={{ color: "#9a948c" }}>· {r.role}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Build QC (RAW→h5ad) — run-owned; explicit "unrecoverable" when the run says so.
function BuildQCCard({ run }: { run: any }) {
  const q = run?.buildQC;
  const note = run?._buildQC_note;
  const skip = new Set(["backfilled", "backfillAt", "backfillSources", "rawToH5adQC"]);
  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={SEC}>Build QC · RAW→h5ad</div>
        {q?.backfilled ? <span style={{ marginLeft: "auto" }}><BackfillBadge at={q.backfillAt} sources={q.backfillSources} /></span> : null}
      </div>
      {q && typeof q === "object" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.entries(q).filter(([k]) => !skip.has(k)).map(([k, v]) => (
            <Row key={k} k={k} v={typeof v === "object" ? JSON.stringify(v) : String(v)} />
          ))}
          {q.rawToH5adQC ? <div style={{ fontSize: 11.5, color: "#7a746c", marginTop: 4, lineHeight: 1.45 }}>{String(q.rawToH5adQC)}</div> : null}
        </div>
      ) : note ? (
        <div style={{ fontSize: 12.5, color: "#9a3412", lineHeight: 1.45 }}>
          <b>RAW→h5ad QC: unrecoverable.</b> <span style={{ color: "#7a746c" }}>{String(note)}</span>
        </div>
      ) : notRecorded("Build QC")}
    </div>
  );
}

// stable empty set so the Clustering-tab map shows no per-cluster validation
// checkmarks (that tab is about the partition, not the labelling pass).
const NO_CHECKS: Set<string> = new Set();

// Friendly run-date headline, e.g. "June 15th, 2:02 PM".
function fmtRunDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const month = d.toLocaleString("en-US", { month: "long" });
  const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${ord(d.getDate())}, ${time}`;
}

const ARCHIVE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  quarantined: { bg: "#fef2f2", fg: "#b91c1c", label: "⚠ quarantined · contaminated" },
  superseded: { bg: "#eef2f6", fg: "#475569", label: "superseded" },
  other: { bg: "#f1ede8", fg: "#7a746c", label: "archived" },
};

export function RunViewer({ run, meta, dataset, onBack }: { run: any; meta?: any; dataset: DatasetDef; onBack: () => void }) {
  // A run labelled on a dataset's NATIVE published partition (schemaBasis
  // "native-schema") carries cluster ids in the *_native asset space — not the
  // registered de-novo atlas. The de-novo groundtruth.json has no matching ids,
  // so every GT label would render "—". Resolve such a run's GROUND TRUTH to its
  // own _native asset so the labels line up. The predicate is EXACTLY
  // schemaBasis === "native-schema" (de-novo runs lack the field) — never
  // promotedFrom, never back-filled from dataset_facts. Only groundTruthUrl is
  // overridden; dataset.id is preserved so native-tier maps still resolve.
  // NOTE: dataUrl is deliberately NOT overridden — the *_native umap.json assets
  // carry cluster metadata but no scatter points, so loading them blanks the
  // Clustering-tab map. The de-novo atlas (with points) stays as the illustrative
  // map; only the per-cluster GT label strings come from the native asset.
  const viewDataset = useMemo<DatasetDef>(() => {
    if (run?.schemaBasis !== "native-schema" || !dataset.groundTruthUrl) return dataset;
    const toNative = (u: string) => u.replace(`/${dataset.id}/`, `/${dataset.id}_native/`);
    return { ...dataset, groundTruthUrl: toNative(dataset.groundTruthUrl) };
  }, [run, dataset]);
  const { clusters, error } = useAtlas(dataset.dataUrl);
  const profile = useMemo(() => computeCompletenessProfile(run, meta), [run, meta]);
  const runClusters: any[] = Array.isArray(run?.clusters) ? run.clusters : [];
  const byId = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of runClusters) m.set(String(c.id), c);
    return m;
  }, [run]);
  const validated = useMemo(() => new Set(runClusters.filter((c) => c.validated).map((c) => String(c.id))), [run]);

  const [tab, setTab] = useState<"clustering" | "modelHarness" | "labels">("clustering");
  // Cell Labelling is a master→detail: openCluster=null shows the per-tier
  // summary + per-cluster breakdown; setting it drills into that cluster's chat.
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  const gt = run?.groundTruth;
  const archived = !!meta?.archived;
  const archiveCat = profile.archive.category || "other";
  const money = (v: number) => (v == null ? "?" : v < 1 ? v.toFixed(3) : v.toFixed(2));

  // --- Cell Labelling helpers ---
  // 1-indexed cluster number by position (so it starts at "Cluster 1", never 0)
  const numOf = (id: string) => {
    const i = runClusters.findIndex((c) => String(c.id) === id);
    return i >= 0 ? i + 1 : id;
  };
  const verdicts: Record<string, any> = gt?.verdicts || {};
  // schema-aware native tiers (4 for ZSCAPE, 2 for ChemFish/DanioCell) — the GT
  // aggregate carries a row per native tier; projected tiers come through as total=0.
  const nativeAgg: any[] = (Array.isArray(gt?.aggregate) ? gt.aggregate : []).filter((t: any) => t.total > 0);
  const TIER_LABEL: Record<string, string> = { germ_layer: "Germ layer", tissue: "Tissue", cell_type_broad: "Cell — broad", cell_type_sub: "Cell — sub" };
  const CONF_KEYS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
  // for no-GT runs, the "final per-tier confidence" = mean model confidence per tier
  const meanConf = CONF_KEYS.map((k) => {
    const vals = runClusters.map((c) => c?.confidence?.[k]?.pct).filter((x: any) => typeof x === "number");
    return { key: k, label: TIER_LABEL[k], pct: vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0, n: vals.length };
  }).filter((t) => t.n > 0);
  const clusterMeanConf = (c: any): number | null => {
    const vals = CONF_KEYS.map((k) => c?.confidence?.[k]?.pct).filter((x: any) => typeof x === "number");
    return vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
  };
  const ocRun = openCluster ? byId.get(openCluster) : null;
  const ocAtlas = openCluster ? clusters?.find((c) => c.id === openCluster) || null : null;
  // for the read-only Scorecard (the per-cluster Daniotype-vs-GT breakdown the
  // new-run page shows) — rebuilt from the saved run.
  const labelsMap = useMemo(() => { const m: Record<string, string> = {}; for (const c of runClusters) if (c.finalLabel) m[String(c.id)] = String(c.finalLabel); return m; }, [run]);
  const confMap = useMemo(() => { const m: Record<string, any> = {}; for (const c of runClusters) if (c?.confidence?.germ_layer) m[String(c.id)] = c.confidence; return m; }, [run]);
  const savedScore: any = { verdicts: gt?.verdicts || {}, scoredAt: gt?.scoredAt || null, agg: Array.isArray(gt?.aggregate) ? gt.aggregate : [], subStrat: gt?.subStratified || null, abstention: gt?.abstention || null };
  const noop: any = () => {};
  // feed the Scorecard the RUN's own clusters (not the live atlas) so labels +
  // verdicts always line up — including for runs whose clustering differs from
  // the currently-registered atlas (e.g. the parked native-schema runs).
  const viewerClusters: any = useMemo(() => runClusters.map((c) => ({
    id: String(c.id), label: c.label || `Cluster ${c.id}`,
    color: clusters?.find((a) => a.id === String(c.id))?.color || "#9aa0a6",
    nCells: 0, cx: 0, cy: 0, degsUp: [], markers: [], markersDown: [], points: [], bounds: { minx: 0, maxx: 0, miny: 0, maxy: 0 },
  })), [run, clusters]);

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
            <span style={{ fontSize: 18, fontWeight: 800 }}>{fmtRunDate(run?.exportedAt ?? run?.scoredAt) ?? (run?.model ?? "?")}</span>
            <span style={{ fontSize: 12.5, color: "#666" }}>
              {run?.model ? <span style={{ fontWeight: 600, color: "#555" }}>{run.model}</span> : null}
              {run?.model ? " · " : ""}
              {profile.labelledClusters}/{profile.nClusters} labelled
              {profile.scored ? " · scored" : ""}
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
            {run?.clusteringStrategy?.partitionId ? (
              <span title={`partitionId — fingerprint of this run's clustering: ${run.clusteringStrategy.partitionId}`} style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", background: "#f1f5f9", borderRadius: 99, padding: "1px 8px", fontFamily: "ui-monospace, monospace" }}>
                partition {String(run.clusteringStrategy.partitionId).slice(0, 12)}…
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

        {/* How to read this run — the labelling method, stated once. Static copy. */}
        <details style={{ ...CARD, marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: "#475569" }}>How to read this run</summary>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#5a544c", lineHeight: 1.55 }}>
            <li><b>Three-personality loop</b> — two Researcher proposers debate the cluster, an Archivist checks every claim against live :5007 stats, a Reasoner concludes.</li>
            <li><b>Grounded proposals</b> — each name is anchored in cited markers → in-vivo expression (ZFIN) → ZFA anatomy → GO function; uncited names roll up to an abstention.</li>
            <li><b>Confidence tiers</b> — the call is placed at the depth the evidence supports (germ-layer → tissue → cell-type); the per-tier confidence shows how far it could defensibly go.</li>
            <li><b>Evaluation, not supervision</b> — where published labels exist they were <i>held out</i> and used only to score afterward; the labeler never saw them.</li>
          </ol>
        </details>

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
            <div style={{ ...CARD, padding: 10 }}>
              {clusters ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={NO_CHECKS} width={560} height={420} />
                </div>
              ) : (
                <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>Loading atlas…</div>
              )}
            </div>
            <div style={CARD}>
              <div style={SEC}>This run</div>
              <div style={{ fontSize: 13.5, color: "#444" }}>{runClusters.length} clusters · {profile.validatedClusters} validated</div>
              {run?.dataset ? <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 5 }}>🧬 {run.dataset}</div> : notRecorded("Clustering recipe")}
            </div>
            {/* how this run clustered — the RUN's own snapshot (never live FACTS) */}
            <ClusteringProvenance mode="viewer" strategy={run?.clusteringStrategy} datasetId={dataset.id} nClusters={runClusters.length} datasetName={dataset.name} />
            <BuildQCCard run={run} />
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
            {/* the personalities + loop this harness runs */}
            <HarnessDetail harness={run?.harness} />
            <div style={CARD}>
              <div style={SEC}>Run provenance</div>
              <GroundingPanel provenance={run?.provenance} />
            </div>
          </div>
        )}

        {/* 3. CELL LABELLING — final per-tier summary + per-cluster breakdown → drill into a cluster's chat */}
        {tab === "labels" && (openCluster && ocRun ? (
          /* ---- drill-in: one cluster's full chat history ---- */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><button onClick={() => setOpenCluster(null)} style={btnGhost}>← Back to clusters</button></div>
            <div style={CARD}>
              <div style={{ fontSize: 11, color: "#9a948c", fontWeight: 700 }}>CLUSTER {numOf(openCluster)}{ocRun.label ? ` · ${ocRun.label}` : ""}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: ocRun.finalLabel ? INK : "#b0a89e" }}>
                {ocRun.finalLabel || "not labelled in this run"}
                {ocRun.validated ? <span style={{ fontSize: 12, color: "#15803d", marginLeft: 8, fontWeight: 700 }}>✓ validated</span> : null}
              </div>
            </div>
            <div style={CARD}>
              <div style={SEC}>Tier confidence</div>
              {ocRun.confidence?.germ_layer ? <ConfidenceContent conf={ocRun.confidence as ClusterConf} /> : notRecorded("Tier confidence")}
            </div>
            <div style={CARD}>
              <div style={SEC}>Top markers</div>
              {ocAtlas ? <MarkersContent cluster={ocAtlas} added={Array.isArray(ocRun.addedMarkers) ? ocRun.addedMarkers : []} /> : <div style={{ fontSize: 12.5, color: "#aaa" }}>Loading atlas…</div>}
            </div>
            <div style={CARD}>
              <div style={SEC}>Chat history — how this cluster was decided</div>
              {Array.isArray(ocRun.transcript) && ocRun.transcript.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ocRun.transcript.map((t: any, i: number) =>
                    t.role === "user" ? (
                      <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#eef2f6", border: "1px solid #dfe6ee", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, color: "#334", lineHeight: 1.5 }}>{stripControlBlocks(t.content)}</div>
                    ) : (
                      <AgentMessage key={i} content={stripControlBlocks(t.content)} mode={t.mode} thinking={t.thinking} />
                    )
                  )}
                </div>
              ) : notRecorded("Chat history")}
            </div>
          </div>
        ) : viewDataset.groundTruthUrl ? (
          /* ---- GT datasets: the exact per-cluster breakdown from the new-run page (read-only) ---- */
          <div style={{ fontSize: 12.5, color: "#888", marginBottom: -4 }}>
            <Scorecard embedded readOnly dataset={viewDataset} clusters={viewerClusters} labels={labelsMap} confidence={confMap} validated={validated} onPick={setOpenCluster} model={run?.model ?? "?"} addUsage={noop} score={savedScore} setScore={noop} onImport={noop} />
            <div style={{ marginTop: 8, fontStyle: "italic" }}>Click any cluster row above to see how it was decided.</div>
          </div>
        ) : (
          /* ---- no-GT datasets: final mean confidence + per-cluster breakdown ---- */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ ...SEC, marginBottom: 8 }}>{gt ? "Final accuracy by tier vs ground truth" : "Final mean confidence by tier"}</div>
              {((gt
                ? nativeAgg.map((t: any) => ({ key: t.key, label: TIER_LABEL[t.key] || t.label, pct: t.pct, sub: `${t.matched}/${t.total} agree` }))
                : meanConf.map((t) => ({ key: t.key, label: t.label, pct: t.pct, sub: `mean of ${t.n} clusters` })))).length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {(gt
                    ? nativeAgg.map((t: any) => ({ key: t.key, label: TIER_LABEL[t.key] || t.label, pct: t.pct, sub: `${t.matched}/${t.total} agree` }))
                    : meanConf.map((t) => ({ key: t.key, label: t.label, pct: t.pct, sub: `mean of ${t.n} clusters` }))).map((t) => {
                    const heat = confColor(t.pct ?? 0);
                    return (
                      <div key={t.key} style={CARD}>
                        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", fontWeight: 700 }}>{t.label}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
                          <span style={{ fontSize: 30, fontWeight: 800, color: heat.fg, fontVariantNumeric: "tabular-nums" }}>{(t.pct ?? 0).toFixed(0)}%</span>
                          <span style={{ fontSize: 12, color: "#999" }}>{t.sub}</span>
                        </div>
                        <div style={{ height: 8, background: "#eee7df", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${t.pct ?? 0}%`, height: "100%", background: heat.fg }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : notRecorded(gt ? "Ground-truth tiers" : "Tier confidence")}
            </div>

            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <div style={{ ...SEC, padding: "14px 16px 0" }}>Per-cluster breakdown — click a cluster to see how it was decided</div>
              <div style={{ overflow: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", fontWeight: 700, borderBottom: "1px solid #efece7" }}>
                  <span style={{ width: 64, flexShrink: 0 }}>Cluster</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Predicted label</span>
                  {gt ? nativeAgg.map((t: any) => <span key={t.key} style={{ width: 58, textAlign: "center", flexShrink: 0 }} title={`predicted vs GT · ${TIER_LABEL[t.key] || t.label}`}>{(TIER_LABEL[t.key] || t.label).replace("Cell — ", "")}</span>) : <span style={{ width: 70, textAlign: "center", flexShrink: 0 }}>conf</span>}
                  <span style={{ width: 14, flexShrink: 0 }} />
                </div>
                {runClusters.map((c) => {
                  const id = String(c.id);
                  const v = verdicts[id];
                  const mc = clusterMeanConf(c);
                  return (
                    <div key={id} onClick={() => setOpenCluster(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderBottom: "1px solid #f3f0ec", cursor: "pointer", fontSize: 12.5 }}>
                      <span style={{ width: 64, flexShrink: 0, fontWeight: 700, color: "#555" }}>{numOf(id)}{c.validated ? " ✓" : ""}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: c.finalLabel ? "#333" : "#b0a89e" }} title={c.finalLabel || ""}>{c.finalLabel || "not labelled"}</span>
                      {gt ? nativeAgg.map((t: any) => {
                        const tv = v?.[t.key];
                        return <span key={t.key} style={{ width: 58, textAlign: "center", flexShrink: 0, fontWeight: 800, color: !tv ? "#ccc" : tv.match ? "#15803d" : "#dc2626" }}>{!tv ? "·" : tv.match ? "✓" : "✗"}</span>;
                      }) : <span style={{ width: 70, textAlign: "center", flexShrink: 0, color: "#777", fontVariantNumeric: "tabular-nums" }}>{mc != null ? `${mc}%` : "—"}</span>}
                      <span style={{ width: 14, flexShrink: 0, color: ACCENT, fontWeight: 700, textAlign: "right" }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
