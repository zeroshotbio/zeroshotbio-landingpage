"use client";
// RunViewer — the read-only "view a completed run" path (Phase 2b). Renders a
// saved run JSON with NO editing / streaming / autopilot machinery: the atlas
// map, a per-cluster panel (label · confidence · markers · saved transcript),
// and a ground-truth summary — each shown only when the run actually captured
// it (progressive disclosure driven by computeCompletenessProfile). Reuses the
// presentational components extracted in Phase 1.
import React, { useEffect, useMemo, useState } from "react";
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
import { CompartmentMap, MapViewSwitch, hasCompartments, type MapView } from "./CompartmentMap";
import { ClusteringExplainer, ZscapeClusteringExplainer } from "./ClusteringExplainer";
import { META_REASONER_CONTEXT } from "../../meta_reasoner/metaReasonerContext";

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

// Tissue-only labelling view — for runs that predicted a SINGLE tissue tier
// (run.provenance.tissueOnly). Shows exactly: de-novo call (what the chat arrived at) →
// binned tissue → ground-truth tissue, per cluster. No germ-layer / cell-type-broad / sub.
function TissueOnlyLabels({ clusters, numOf, onPick }: { clusters: any[]; numOf: (id: string) => React.ReactNode; onPick: (id: string) => void }) {
  const norm = (s: any) => String(s ?? "").trim().toLowerCase();
  const rows = clusters.map((c) => {
    const denovo = (c?.deNovo && c.deNovo.label) || c?.finalLabel || null;
    const bin = (c?.menu && (c.menu.tissueConsensus || c.menu.tissue)) || null;
    const gt = c?.gtTissue || null;
    const match = bin && gt ? norm(bin) === norm(gt) : null;
    return { id: String(c.id), denovo, bin, gt, match };
  });
  const scored = rows.filter((r) => r.gt && r.bin);
  const hits = scored.filter((r) => r.match).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={CARD}>
        <div style={SEC}>Tissue labelling — de-novo → binned → ground truth</div>
        <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.5 }}>
          Single tissue tier (no germ-layer / cell-type). Menu-exact tissue agreement:{" "}
          <b>{hits}/{scored.length}</b>{scored.length ? ` (${Math.round((100 * hits) / scored.length)}%)` : ""} over clusters with both a bin and a ground-truth tissue. Click a row to see how it was decided.
        </div>
      </div>
      <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: "8px 16px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", fontWeight: 700, borderBottom: "1px solid #efece7" }}>
          <span style={{ width: 56, flexShrink: 0 }}>Cluster</span>
          <span style={{ flex: 1, minWidth: 0 }}>De-novo call (chat)</span>
          <span style={{ flex: 1, minWidth: 0 }}>Binned tissue</span>
          <span style={{ flex: 1, minWidth: 0 }}>Ground-truth tissue</span>
          <span style={{ width: 36, textAlign: "center", flexShrink: 0 }}>=</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} onClick={() => onPick(r.id)} style={{ display: "flex", gap: 8, padding: "7px 16px", borderBottom: "1px solid #f3f0ec", cursor: "pointer", fontSize: 12.5, alignItems: "center" }}>
            <span style={{ width: 56, flexShrink: 0, fontWeight: 700, color: "#555" }}>{numOf(r.id)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.denovo ? "#333" : "#b0a89e" }} title={r.denovo || ""}>{r.denovo || "—"}</span>
            <span style={{ flex: 1, minWidth: 0, color: r.bin ? "#333" : "#b0a89e" }}>{r.bin || "abstain"}</span>
            <span style={{ flex: 1, minWidth: 0, color: r.gt ? "#444" : "#b0a89e" }}>{r.gt || "—"}</span>
            <span style={{ width: 36, textAlign: "center", flexShrink: 0, fontWeight: 800, color: r.match == null ? "#ccc" : r.match ? "#15803d" : "#dc2626" }}>{r.match == null ? "·" : r.match ? "✓" : "✗"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunViewer({ run, meta, dataset, onBack, finalize }: { run: any; meta?: any; dataset: DatasetDef; onBack: () => void; finalize?: boolean }) {
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
  const { clusters, meta: atlasMeta, error } = useAtlas(dataset.dataUrl);
  const [mapView, setMapView] = useState<MapView>("islands");
  const profile = useMemo(() => computeCompletenessProfile(run, meta), [run, meta]);
  const runClusters: any[] = Array.isArray(run?.clusters) ? run.clusters : [];
  const byId = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of runClusters) m.set(String(c.id), c);
    return m;
  }, [run]);
  const validated = useMemo(() => new Set(runClusters.filter((c) => c.validated).map((c) => String(c.id))), [run]);

  const [tab, setTab] = useState<"clustering" | "modelHarness" | "labels" | "merging" | "judge">(finalize ? "merging" : "clustering");
  // Cell Labelling is a master→detail: openCluster=null shows the per-tier
  // summary + per-cluster breakdown; setting it drills into that cluster's chat.
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  // ⚖️ Click-in judgement: comments accumulate here (seeded from the run's own
  // judgements[]) and save back to the SAME log the New Run flow writes —
  // run.judgements[] via /api/kasperov_runs. Save creates a new run version whose
  // judgements[] carry every prior + newly-added note (append endpoint doesn't
  // exist, so we re-save the whole run — matches the New Run judgement pattern).
  const [judgements, setJudgements] = useState<any[]>(Array.isArray(run?.judgements) ? run.judgements : []);
  const [dirty, setDirty] = useState(false);
  const [jSave, setJSave] = useState<{ s: "idle" | "saving" | "ok" | "err"; msg?: string }>({ s: "idle" });
  const addJudgement = (j: any) => { setJudgements((p) => [...p, { ...j, ts: new Date().toISOString() }]); setDirty(true); setJSave({ s: "idle" }); };
  async function saveJudgements(): Promise<{ ok: boolean; runId?: string; error?: string }> {
    setJSave({ s: "saving" });
    try {
      // SLIM the payload — the full run carries 250 chat transcripts + proposal/scores
      // (multi-MB → 413). A judgement-save only needs labels + the notes; drop the
      // heavy transcript/proposal blobs (they live on the original run).
      const slimClusters = (run?.clusters || []).map((c: any) => ({ id: c.id, label: c.label, finalLabel: c.finalLabel, validated: c.validated }));
      const body = {
        schema: run?.schema, datasetId: run?.datasetId ?? dataset.id, dataset: run?.dataset, model: run?.model,
        harness: run?.harness, source: run?.source, fixtureRunId: run?.fixtureRunId, note: run?.note,
        clusters: slimClusters, metaDecisions: run?.metaDecisions,
        judgements, judgementMode: true, hasJudgement: judgements.length > 0, exportedAt: new Date().toISOString(),
      };
      const r = await fetch("/api/kasperov_runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.error) throw new Error(d?.error || `HTTP ${r.status}`);
      setDirty(false);
      setJSave({ s: "ok", msg: `Saved ${judgements.length} judgement${judgements.length === 1 ? "" : "s"} — new run version ${d.runId ?? "?"} (now the latest).` });
      return { ok: true, runId: d.runId };
    } catch (e: any) { const error = String(e?.message ?? e).slice(0, 140); setJSave({ s: "err", msg: `Save failed: ${error}` }); return { ok: false, error }; }
  }
  const nNew = dirty ? judgements.length - (Array.isArray(run?.judgements) ? run.judgements.length : 0) : 0;

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
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {jSave.s !== "idle" && <span style={{ fontSize: 11.5, color: jSave.s === "ok" ? "#15803d" : jSave.s === "err" ? "#b91c1c" : "#888" }}>{jSave.s === "saving" ? "Saving…" : jSave.msg}</span>}
            <button onClick={saveJudgements} disabled={!dirty || jSave.s === "saving"} style={{ ...btnGhost, fontWeight: 700, opacity: dirty ? 1 : 0.5, ...(dirty ? { borderColor: "#7c3aed", color: "#7c3aed" } : {}) }}>
              ⚖️ Save judgements{nNew > 0 ? ` (${nNew} new)` : ""}
            </button>
          </div>
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
            {Array.isArray(run?.judgements) && run.judgements.length ? (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "1px 8px" }}>⚖️ judgement · {run.judgements.length}</span>
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
          {Array.isArray(run?.judgements) && run.judgements.length ? (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12.5, fontWeight: 700, color: "#7c3aed", cursor: "pointer" }}>⚖️ {run.judgements.length} step critique note{run.judgements.length === 1 ? "" : "s"}</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {run.judgements.map((j: any, i: number) => (
                  <div key={i} style={{ fontSize: 12.5, color: "#4a4540", background: "#faf7ff", border: "1px solid #ece2fb", borderLeft: "3px solid #7c3aed", borderRadius: 6, padding: "6px 9px", lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, color: "#7c3aed" }}>{j.cluster_label || `Cluster ${j.cluster_id}`}{j.mode ? ` · ${j.mode}` : ""}{typeof j.step_index === "number" ? ` · step ${j.step_index}` : ""}</span>
                    <div>{j.note}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
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
          {([["clustering", "1. Clustering"], ["modelHarness", "2. Model & Harness"], ["labels", "3. Fine Cell Labelling"], ["merging", "4. Merging & Meta-Reasoning"], ["judge", "5. Final Judge"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...btnGhost, fontWeight: 700, ...(tab === k ? { background: ACCENT, color: "#fff", borderColor: ACCENT } : {}) }}>{label}</button>
          ))}
        </div>

        {error && <div style={{ ...CARD, color: "#b91c1c" }}>Failed to load the atlas: {error}</div>}

        {/* 1. CLUSTERING — the SAME "World map" stage the New Run wizard shows, filled in */}
        {tab === "clustering" && (() => {
          const clusteredCells = atlasMeta?.totalCells ?? 0;
          const fullCells = atlasMeta?.fullDatasetCells;
          const sampled = !!fullCells && fullCells > clusteredCells;
          const hasComp = hasCompartments(clusters ?? []);
          return (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>World map · {dataset.name} atlas</div>
              <h2 style={{ fontSize: 23, fontWeight: 700, margin: "2px 0 2px" }}>1. Clustering</h2>
              <p style={{ color: "#666", fontSize: 15, margin: "0 0 8px" }}>Coming at {dataset.name} fresh — here&apos;s how the cells get grouped into clusters.</p>
              <p style={{ color: "#9a948c", fontSize: 12.5, margin: "0 auto 8px", lineHeight: 1.5, maxWidth: 720 }}>
                {sampled ? `The sample spans every condition in ${dataset.name} (perturbed and control alike) — it is not a biological subset, just a random cross-section drawn so we can cluster ${clusteredCells.toLocaleString()} cells rather than all ${fullCells!.toLocaleString()}.` : ""}
                {dataset.groundTruthUrl ? " We re-cluster from scratch — the authors' published cell-type labels are held out, so we can score our de-novo calls against them afterward." : ""}
              </p>
              <div style={{ ...CARD, padding: 10 }}>
                {clusters ? (
                  <>
                    {hasComp && <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><MapViewSwitch view={mapView} setView={setMapView} /></div>}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {mapView === "islands" && hasComp
                        ? <CompartmentMap clusters={clusters} activeId={null} validated={NO_CHECKS} width={720} height={460} onPick={(id) => { setOpenCluster(id); setTab("labels"); }} />
                        : <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={NO_CHECKS} width={560} height={420} />}
                    </div>
                  </>
                ) : <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>Loading atlas…</div>}
              </div>
              {dataset.id === "zscape" ? <ZscapeClusteringExplainer nLeaves={clusters?.length} /> : <ClusteringExplainer />}
              <div style={{ marginTop: 16 }}>
                <button onClick={() => setTab("modelHarness")} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}>Good to proceed — model &amp; harness →</button>
              </div>
              {/* this run's own clustering provenance — the "filled-in" logged decision, kept below */}
              <div style={{ marginTop: 16, textAlign: "left" }}>
                <ClusteringProvenance mode="viewer" strategy={run?.clusteringStrategy} datasetId={dataset.id} nClusters={runClusters.length} datasetName={dataset.name} />
              </div>
            </div>
          );
        })()}

        {/* 2. MODEL & HARNESS — the SAME picker stage as New Run, filled in read-only */}
        {tab === "modelHarness" && (
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: "4px 0 4px", lineHeight: 1.1, textAlign: "center" }}>2. Model &amp; Harness</h1>
            <p style={{ color: "#666", fontSize: 14, textAlign: "center", margin: "0 auto 18px", maxWidth: 620, lineHeight: 1.5 }}>
              The <strong>model</strong> that drove every personality and the scoring, and the <strong>harness</strong> — the labelling loop + grounding rules — as recorded for this run.
            </p>
            <h2 style={{ ...SEC, fontSize: 12 }}>Model</h2>
            <div style={{ ...CARD, border: `2px solid ${ACCENT}`, display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{run?.model ?? "?"}</span>
              {run?.cost?.usd != null ? <span style={{ fontSize: 12.5, color: "#666" }}>~${money(Number(run.cost.usd))}{run?.cost?.estimated ? " (est.)" : ""} total</span> : null}
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#15803d" }}>✓ used this run</span>
            </div>
            <h2 style={{ ...SEC, fontSize: 12 }}>Harness</h2>
            <div style={{ ...CARD, border: `2px solid ${ACCENT}`, marginBottom: 12 }}>
              {run?.harness ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>v{run.harness.version}{run.harness.name ? ` · ${run.harness.name}` : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#9a948c", fontFamily: "ui-monospace, monospace", marginTop: 3 }}>{run.harness.gitCommit ? `commit ${run.harness.gitCommit}` : ""}{run.harness.stampedAt ? ` · stamped ${String(run.harness.stampedAt).slice(0, 10)}` : ""}</div>
                </>
              ) : notRecorded("Harness")}
            </div>
            {/* the three personalities of this harness — the SAME panel New Run shows */}
            <HarnessDetail harness={run?.harness} />
            <div style={{ ...CARD, marginTop: 12 }}>
              <div style={SEC}>Run provenance</div>
              <GroundingPanel provenance={run?.provenance} />
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={() => setTab("labels")} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}>Proceed to 3. Fine Cell Labelling →</button>
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
            <div style={CARD}>
              <div style={SEC}>⚖️ Judge this cluster</div>
              <JudgeBox stage="labelling" targetId={openCluster!} targetLabel={ocRun.finalLabel || `Cluster ${numOf(openCluster!)}`} excerpt={ocRun.finalLabel} judgements={judgements} addJudgement={addJudgement} />
            </div>
          </div>
        ) : (
          /* ---- master: the SAME "3. Cell Labelling" map view New Run shows (revealed), filled in ---- */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 2px" }}>3. Fine Cell Labelling</h1>
              <p style={{ color: "#666", fontSize: 14, margin: "0 0 10px" }}>{runClusters.length} de-novo clusters · {profile.validatedClusters} validated. Click a cluster on the map or in the list below to see how it was decided.</p>
              {clusters ? (
                <div style={{ ...CARD, padding: 10 }}>
                  {hasCompartments(clusters) && <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><MapViewSwitch view={mapView} setView={setMapView} /></div>}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    {mapView === "islands" && hasCompartments(clusters)
                      ? <CompartmentMap clusters={clusters} activeId={null} validated={validated} width={720} height={440} onPick={(id) => setOpenCluster(id)} />
                      : <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={validated} width={560} height={420} />}
                  </div>
                </div>
              ) : null}
            </div>
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

        {/* 4. MERGING & META-REASONING — full-screen Meta-Reasoner workbench (chat + floaty visuals) */}
        {tab === "merging" && <MetaReasonerStage run={run} clusters={clusters} judgements={judgements} addJudgement={addJudgement} onSubmitJudgements={saveJudgements} onBack={() => (finalize ? onBack() : setTab("labels"))} live={finalize} />}

        {/* 5. FINAL JUDGE — score the MERGED NODES (fuzzy judge + purity); scorecard relocated here */}
        {tab === "judge" && (
          <JudgeView
            run={run} dataset={viewDataset} viewerClusters={viewerClusters}
            labels={labelsMap} confidence={confMap} validated={validated}
            savedScore={savedScore} model={run?.model ?? "?"}
            judgements={judgements} addJudgement={addJudgement}
            onPick={(id: string) => { setOpenCluster(id); setTab("labels"); }}
          />
        )}
      </div>
    </div>
  );
}

// ---- STEP 4: Merging & Meta-Reasoning — surface the operator proposal (propose-and-judge) ----
const ACT_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  merge: { bg: "#dcfce7", fg: "#15803d", icon: "⤵" },
  set_aside: { bg: "#eef2ff", fg: "#4338ca", icon: "⎇" },
};
// ⚖️ click-in judgement box — shows this target's existing notes + captures a new
// one into run.judgements[] (persisted by the header "Save judgements" button).
function JudgeBox({ stage, targetId, targetLabel, excerpt, judgements, addJudgement }: {
  stage: string; targetId: string; targetLabel: string; excerpt?: string; judgements: any[]; addJudgement: (j: any) => void;
}) {
  const [note, setNote] = useState("");
  const mine = (judgements || []).filter((j) => j.mode === stage && String(j.cluster_id) === String(targetId));
  return (
    <div style={{ marginTop: 8, border: "1px solid #ece2fb", borderLeft: "3px solid #7c3aed", background: "#faf7ff", borderRadius: 8, padding: "8px 10px" }}>
      {mine.map((j, i) => (
        <div key={i} style={{ fontSize: 12, color: "#4a4540", marginBottom: 5 }}>⚖️ {j.note}</div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="judge this…"
          onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { addJudgement({ cluster_id: targetId, cluster_label: targetLabel, mode: stage, step_index: 0, content_excerpt: excerpt ?? targetLabel }); setNote(""); } }}
          style={{ flex: 1, border: "1px solid #ddd3ee", borderRadius: 6, padding: "5px 9px", fontSize: 12.5, background: "#fff" }} />
        <button onClick={() => { if (note.trim()) { addJudgement({ cluster_id: targetId, cluster_label: targetLabel, mode: stage, step_index: 0, content_excerpt: excerpt ?? targetLabel, note: note.trim() }); setNote(""); } }}
          style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add ⚖️</button>
      </div>
    </div>
  );
}

const stripJsonFence = (s: string) => String(s || "").replace(/```+\s*json[\s\S]*?```+/gi, "").replace(/\n{3,}/g, "\n\n").trim();
function decisionMd(c: any): string {
  const lines: string[] = [];
  (c.merges || []).forEach((m: any) => lines.push(`- ⤵ **merge** _[${String(m.tier || "").replace("cell_type_", "")}]_ **${m.node_label}** ← ${m.member_leaf_ids?.length || 0} leaves`));
  (c.set_aside || []).forEach((s: any) => lines.push(`- ⎇ **set aside** leaf ${s.leaf_id} (kept distinct)`));
  return lines.length ? "\n\n**→ Decision**\n" + lines.join("\n") : "";
}
const userBubble: React.CSSProperties = { alignSelf: "flex-end", maxWidth: "86%", background: "#eef2f6", border: "1px solid #dfe6ee", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, color: "#334", lineHeight: 1.5 };

// STEP 4 as a Meta-Reasoner CHAT REPLAY — the same chat UI as per-cluster labelling,
// but the agent is the Meta-Reasoner reasoning sequentially through the compartments
// AFTER the 250 leaves are labelled. Plus a floaty draggable "Add Judgement" box.
function MergingView({ run, numOf, judgements, addJudgement }: { run: any; numOf: (id: string) => React.ReactNode; judgements: any[]; addJudgement: (j: any) => void }) {
  const prop = run?.operatorProposal;
  const [judgeOpen, setJudgeOpen] = useState(false);
  if (!prop) return <div style={CARD}><div style={SEC}>Merging & Meta-Reasoning</div>{notRecorded("Operator proposal (run the fine-then-consolidate operator to populate this)")}</div>;
  const af = prop.after || {}, be = prop.before || {};
  const tierOrder = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
  const comps = (prop.compartments || []).filter((c: any) => !c.error);
  const fm = prop.flag_missing;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px auto", textAlign: "center" }}>4. Merging &amp; Meta-Reasoning</h1>
        <button onClick={() => setJudgeOpen(true)} style={{ position: "absolute", right: 22, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>⚖️ Add Judgement</button>
      </div>
      {/* collapse summary */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={SEC}>Meta-Reasoner · after the 250 leaves are labelled</div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 8px" }}>proposal only · execution gated OFF</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 2px" }}>{be.leaves ?? "?"} fine leaves → {af.total_nodes ?? "?"} consolidated nodes</div>
        <div style={{ fontSize: 12.5, color: "#666" }}>{af.n_merge_nodes ?? 0} merge-nodes ({af.leaves_in_merges ?? 0} leaves folded) + {af.n_set_aside_nodes ?? 0} set-aside</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {tierOrder.map((t) => (
            <span key={t} style={{ fontSize: 12, background: "#f5f3f0", color: "#555", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>{t.replace("cell_type_", "")}: {af.nodes_per_tier?.[t] ?? 0}</span>
          ))}
        </div>
      </div>
      {/* the Meta-Reasoner chat — one reasoning turn per compartment, in sequence */}
      <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={SEC}>🧠 Meta-Reasoner — reasoning through the compartments</div>
        {comps.map((c: any) => (
          <React.Fragment key={c.compartment}>
            <div style={userBubble}>Compartment {c.compartment} — {c.n_leaves} labelled leaves. Reason over them and consolidate: merge redundant restatements into one node, set aside genuinely distinct leaves.</div>
            <AgentMessage mode="reason" content={stripJsonFence(c.reasoning) + decisionMd(c)} />
          </React.Fragment>
        ))}
        <div style={userBubble}>Now audit the whole labelled set — which expected 48&nbsp;hpf tissues are still unaccounted for?</div>
        <AgentMessage mode="reason" content={fm ? (fm.rationale || "") + (fm.expected_still_missing?.length ? "\n\n**Still missing:** " + fm.expected_still_missing.join(", ") : "") : "No global audit recorded."} />
      </div>
      {judgeOpen && (
        <FloatyJudgeBox
          judgements={judgements}
          onClose={() => setJudgeOpen(false)}
          onAdd={(note: string) => addJudgement({ cluster_id: "meta_reasoner", cluster_label: "Meta-Reasoner chat", mode: "merging", step_index: 0, content_excerpt: `${be.leaves}→${af.total_nodes} consolidation`, note })}
        />
      )}
    </div>
  );
}

// floaty, draggable + resizable "Add Judgement" box — mirrors the live wizard's
// persistent judgement panel behavior (drag header, resize corner), self-contained.
function FloatyJudgeBox({ judgements, onClose, onAdd }: { judgements: any[]; onClose: () => void; onAdd: (note: string) => void }) {
  const [box, setBox] = useState({ x: 60, y: 170, w: 360, h: 320 });
  const [note, setNote] = useState("");
  const mine = (judgements || []).filter((j) => j.mode === "merging" && j.cluster_id === "meta_reasoner");
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault(); const sx = e.clientX, sy = e.clientY, ox = box.x, oy = box.y;
    const mv = (ev: MouseEvent) => setBox((b) => ({ ...b, x: Math.max(0, ox + ev.clientX - sx), y: Math.max(0, oy + ev.clientY - sy) }));
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none"; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); const sx = e.clientX, sy = e.clientY, ow = box.w, oh = box.h;
    const mv = (ev: MouseEvent) => setBox((b) => ({ ...b, w: Math.max(250, ow + ev.clientX - sx), h: Math.max(180, oh + ev.clientY - sy) }));
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none"; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  const submit = () => { if (note.trim()) { onAdd(note.trim()); setNote(""); } };
  return (
    <div style={{ position: "fixed", left: box.x, top: box.y, width: box.w, height: box.h, zIndex: 1200, background: "rgba(255,253,251,0.98)", border: "1px solid #7c3aed44", borderTop: "2px solid #7c3aed", borderRadius: 10, boxShadow: "0 4px 18px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div onMouseDown={startDrag} style={{ height: 26, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, color: "#7c3aed", userSelect: "none" }}>
        <span style={{ opacity: 0.5 }}>⠿</span> ⚖️ ADD JUDGEMENT · META-REASONER
        <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#9a948c", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 9px 8px", display: "flex", flexDirection: "column" }}>
        {mine.map((j, i) => <div key={i} style={{ fontSize: 12, color: "#4a4540", marginBottom: 5, background: "#faf7ff", borderRadius: 6, padding: "5px 8px" }}>⚖️ {j.note}</div>)}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Judge the meta-reasoner's reasoning — a merge call, a set-aside, the missing-tissue audit…"
          style={{ flex: 1, minHeight: 70, boxSizing: "border-box", border: "1px solid #ddd3ee", borderRadius: 6, padding: "8px 10px", fontSize: 13, lineHeight: 1.5, resize: "none", fontFamily: "inherit", background: "#fff", marginTop: mine.length ? 4 : 0 }} />
        <button onClick={submit} style={{ marginTop: 7, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Add ⚖️ judgement</button>
      </div>
      <div onMouseDown={startResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 15, height: 15, cursor: "nwse-resize", color: "#7c3aed", opacity: 0.55, fontSize: 12, lineHeight: "15px", textAlign: "right" }}>◢</div>
    </div>
  );
}

// ---- STEP 5: Final Judge — score the MERGED NODES (own tier · fuzzy agreement · purity) ----
function JudgeView({ run, dataset, viewerClusters, labels, confidence, validated, savedScore, model, onPick, judgements, addJudgement }: any) {
  const sc = run?.scoredNodes;
  const noop: any = () => {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 2px", textAlign: "center" }}>5. Final Judge</h1>
      {sc ? <MergedNodesTable sc={sc} judgements={judgements} addJudgement={addJudgement} /> : (
        <div style={CARD}><div style={SEC}>Merged-node scoring</div>{notRecorded("Merged-node scores (score the step-4 nodes through the fuzzy judge to populate this)")}</div>
      )}
      {/* the ZSCAPE Classic GT scorecard, relocated here — now secondary to the merged-node score above */}
      {dataset.groundTruthUrl ? (
        <details style={CARD}>
          <summary style={{ ...SEC, margin: 0, cursor: "pointer" }}>Per-leaf scorecard vs ZSCAPE Classic (pre-merge, 250 leaves)</summary>
          <div style={{ marginTop: 10 }}>
            <Scorecard embedded readOnly dataset={dataset} clusters={viewerClusters} labels={labels} confidence={confidence} validated={validated} onPick={onPick} model={model} addUsage={noop} score={savedScore} setScore={noop} onImport={noop} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function MergedNodesTable({ sc, judgements, addJudgement }: { sc: any; judgements: any[]; addJudgement: (j: any) => void }) {
  const tierOrder = ["tissue", "cell_type_broad", "cell_type_sub"];
  const rows: any[] = Array.isArray(sc.rows) ? sc.rows : [];
  const [open, setOpen] = useState<string | null>(null);
  const hasNote = (id: string) => (judgements || []).some((j) => j.mode === "judge" && String(j.cluster_id) === String(id));
  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={SEC}>Final Judge · merged nodes scored at their own tier (fuzzy judge)</div>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800 }}>{sc.overall_agree}/{sc.n_nodes} agree</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 4px" }}>
        {tierOrder.map((t) => sc.agree_by_tier?.[t] ? (
          <span key={t} style={{ fontSize: 12, background: "#f5f3f0", color: "#555", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>{t.replace("cell_type_", "")}: {sc.agree_by_tier[t].agree}/{sc.agree_by_tier[t].total}</span>
        ) : null)}
        <span style={{ fontSize: 11.5, color: "#9a948c", alignSelf: "center" }}>purity = fraction of member GT-cells sharing the dominant GT identity (diagnostic, not a gate)</span>
      </div>
      <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "auto", marginTop: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#f3f0ec", color: "#555", textAlign: "left" }}>
            {["Node identity", "Tier", "GT @ tier", "Agree", "Purity", "Judge note"].map((h) => <th key={h} style={{ padding: "6px 9px", fontWeight: 700, borderBottom: "1px solid #e5e1dc", whiteSpace: "nowrap" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const id = r.node_id ?? `row${i}`;
              return (
                <React.Fragment key={id}>
                  <tr onClick={() => setOpen(open === id ? null : id)} style={{ background: r.agree ? "#fbfffb" : "#fffbfb", cursor: "pointer" }}>
                    <td style={{ padding: "5px 9px", maxWidth: 240 }}>{hasNote(id) ? "⚖️ " : ""}{r.identity}{r.kind === "merge" ? <span style={{ color: "#15803d", fontSize: 10.5, marginLeft: 5 }}>⤵{r.n_leaves}</span> : null}</td>
                    <td style={{ padding: "5px 9px", color: "#777" }}>{String(r.tier).replace("cell_type_", "")}</td>
                    <td style={{ padding: "5px 9px", color: "#777", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={String(r.gt_at_tier ?? "")}>{r.gt_at_tier ?? "—"}</td>
                    <td style={{ padding: "5px 9px", textAlign: "center", fontWeight: 800, color: r.agree ? "#15803d" : "#dc2626" }}>{r.agree ? "✓" : "✗"}</td>
                    <td style={{ padding: "5px 9px", textAlign: "center", color: (r.purity ?? 1) < 0.75 ? "#9a3412" : "#555", fontVariantNumeric: "tabular-nums" }}>{Math.round((r.purity ?? 0) * 100)}%</td>
                    <td style={{ padding: "5px 9px", color: "#888", fontSize: 11.5 }}>{r.note}</td>
                  </tr>
                  {open === id ? (
                    <tr><td colSpan={6} style={{ padding: "0 9px 8px", background: "#faf7ff" }}>
                      <JudgeBox stage="judge" targetId={id} targetLabel={r.identity} excerpt={`${r.identity} @ ${r.tier} vs GT ${r.gt_at_tier} — ${r.agree ? "agree" : "disagree"}`} judgements={judgements} addJudgement={addJudgement} />
                    </td></tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================================================================
// STEP 4 as a full-screen META-REASONER WORKBENCH — the same shape as the
// per-cluster labelling stage (right-side chat column + floaty windows + a
// step-by-step flow), but centred on the Meta-Reasoner reasoning over the
// compartments after the 250 leaves are labelled. Floaties update live as the
// step (its "attention") moves across compartments.
// ===================================================================
let floatyZ = 20;
function Floaty({ title, accent, initial, children, minW = 220, minH = 130 }: { title: React.ReactNode; accent: string; initial: { x: number; y: number; w: number; h: number }; children: React.ReactNode; minW?: number; minH?: number }) {
  const [box, setBox] = useState(initial);
  const [z, setZ] = useState(() => ++floatyZ);
  const raise = () => setZ(++floatyZ);
  const startDrag = (e: React.MouseEvent) => {
    raise(); const sx = e.clientX, sy = e.clientY, ox = box.x, oy = box.y;
    const mv = (ev: MouseEvent) => setBox((b) => ({ ...b, x: Math.max(0, ox + ev.clientX - sx), y: Math.max(52, oy + ev.clientY - sy) }));
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none"; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation(); raise(); const sx = e.clientX, sy = e.clientY, ow = box.w, oh = box.h;
    const mv = (ev: MouseEvent) => setBox((b) => ({ ...b, w: Math.max(minW, ow + ev.clientX - sx), h: Math.max(minH, oh + ev.clientY - sy) }));
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none"; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  };
  return (
    <div onMouseDown={raise} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z, background: "rgba(255,253,251,0.98)", border: `1px solid ${accent}44`, borderTop: `2px solid ${accent}`, borderRadius: 10, boxShadow: "0 3px 14px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div onMouseDown={startDrag} style={{ height: 24, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: accent, userSelect: "none" }}><span style={{ opacity: 0.5 }}>⠿</span> {title}</div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "2px 10px 8px" }}>{children}</div>
      <div onMouseDown={startResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, cursor: "nwse-resize", color: accent, opacity: 0.5, fontSize: 11, lineHeight: "14px", textAlign: "right" }}>◢</div>
    </div>
  );
}

function MetaJudgeInput({ judgements, onAdd, stage, keyId }: { judgements: any[]; onAdd: (note: string) => void; stage: string; keyId: string }) {
  const [note, setNote] = useState("");
  const mine = (judgements || []).filter((j) => j.mode === stage && String(j.cluster_id) === String(keyId));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {mine.map((j, i) => <div key={i} style={{ fontSize: 12, color: "#4a4540", marginBottom: 4, background: "#faf7ff", borderRadius: 6, padding: "4px 7px" }}>⚖️ {j.note}</div>)}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Judge this step — the merge, a rebel leaf, the tier call, the missing-tissue hint…" style={{ boxSizing: "border-box", minHeight: 54, border: "1px solid #ddd3ee", borderRadius: 6, padding: "6px 8px", fontSize: 12.5, lineHeight: 1.45, resize: "vertical", fontFamily: "inherit", marginTop: 5 }} />
      <button onClick={() => { if (note.trim()) { onAdd(note.trim()); setNote(""); } }} style={{ marginTop: 6, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add ⚖️</button>
    </div>
  );
}

function MetaReasonerStage({ run, clusters, judgements, addJudgement, onBack, live, onSubmitJudgements }: { run: any; clusters: any[] | null; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; live?: boolean; onSubmitJudgements?: () => Promise<{ ok: boolean; runId?: string; error?: string }> }) {
  const prop = run?.operatorProposal;
  const [step, setStep] = useState(0);
  // FINALIZE / LIVE mode — pre-flight summary → prep → human-driven live chat.
  if (live) return <MetaFinalizeFlow run={run} clusters={clusters} judgements={judgements} addJudgement={addJudgement} onBack={onBack} onSubmitJudgements={onSubmitJudgements} />;
  if (!prop) return <div style={CARD}><div style={SEC}>4. Merging & Meta-Reasoning</div>{notRecorded("Operator proposal (use 'Meta-Reasoner Finalize Run' to run it live, or score this run to view a recorded proposal)")}</div>;
  const comps: any[] = (prop.compartments || []).filter((c: any) => !c.error);
  const N = comps.length + 1; // + the global Prejudice-of-Shape audit
  const cur = step < comps.length ? comps[step] : null;
  const isGlobal = !cur;
  const fm = prop.flag_missing;
  const ctx = META_REASONER_CONTEXT;
  const leafLabel: Record<string, string> = {};
  (run?.clusters || []).forEach((c: any) => { leafLabel[String(c.id)] = c.finalLabel; });
  const curLeaves: string[] = cur ? [...(cur.merges || []).flatMap((m: any) => m.member_leaf_ids || []), ...(cur.set_aside || []).map((s: any) => s.leaf_id)].map(String) : [];
  const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: "1px 8px" });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: PAPER, overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#fffdfb", borderBottom: "1px solid #e5e1dc", zIndex: 100 }}>
        <button onClick={onBack} style={btnGhost}>← Back to run</button>
        <div style={{ fontWeight: 800 }}>🧠 Meta-Reasoner workbench</div>
        <span style={{ fontSize: 12.5, color: "#666" }}>after {prop.before?.leaves} leaves labelled · → {prop.after?.total_nodes} nodes</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#7c3aed", fontWeight: 800 }}>Step {step + 1}/{N} · {isGlobal ? "Prejudice-of-Shape audit" : `Compartment ${cur.compartment}`}</span>
      </div>

      {/* right chat column */}
      <div style={{ position: "absolute", top: 52, right: 0, bottom: 0, width: 440, background: "#fff", borderLeft: "1px solid #e5e1dc", overflow: "auto", padding: "12px 12px 24px", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={SEC}>🧠 Meta-Reasoner chat</div>
        {comps.slice(0, Math.min(step + 1, comps.length)).map((c: any) => (
          <React.Fragment key={c.compartment}>
            <div style={userBubble}>Compartment {c.compartment} — {c.n_leaves} labelled leaves. Merge redundant restatements, set aside distinct/rebel leaves, assign each node its defensible tier.</div>
            <AgentMessage mode="reason" content={stripJsonFence(c.reasoning) + decisionMd(c)} />
          </React.Fragment>
        ))}
        {isGlobal && (
          <>
            <div style={userBubble}>Prejudice-of-Shape — audit the whole labelled set: which expected 48 hpf tissues are still unaccounted for? (A hint, never a licence to invent one.)</div>
            <AgentMessage mode="reason" content={fm ? (fm.rationale || "") + (fm.expected_still_missing?.length ? "\n\n**Still missing:** " + fm.expected_still_missing.join(", ") : "") : "No audit recorded."} />
          </>
        )}
      </div>

      {/* floaty visuals over the left canvas */}
      <Floaty title="🗺 WORLD MAP · attention" accent="#0e7490" initial={{ x: 18, y: 64, w: 430, h: 322 }}>
        {clusters ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set()} width={404} height={248} dimUnfocused focusCompartments={cur ? [cur.compartment] : []} /> : <div style={{ color: "#aaa", fontSize: 12 }}>loading map…</div>}
        <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{isGlobal ? "Whole labelled set — missing-tissue audit" : `Focused on Compartment ${cur.compartment} · ${cur.n_leaves} leaves`}</div>
      </Floaty>

      <Floaty title="📥 INPUTS · what it reasons over" accent="#15803d" initial={{ x: 18, y: 398, w: 430, h: 250 }}>
        {cur ? (
          <>
            <div style={{ fontSize: 10.5, color: "#9a948c", fontWeight: 800 }}>PREDICTED LABELS · labeller&apos;s own (GT-blind)</div>
            {curLeaves.map((id) => <div key={id} style={{ fontSize: 12, color: "#444", lineHeight: 1.4 }}><span style={{ color: "#9a948c" }}>{id}:</span> {leafLabel[id] || "?"}</div>)}
          </>
        ) : (
          <>
            <div style={{ fontSize: 10.5, color: "#9a948c", fontWeight: 800 }}>RUN LEDGER · whole set</div>
            <div style={{ fontSize: 12.5, color: "#444", marginTop: 3 }}>{prop.before?.leaves} leaves · {prop.before?.compartments} compartments · {prop.after?.total_nodes} nodes ({prop.after?.n_merge_nodes} merges + {prop.after?.n_set_aside_nodes} set-aside)</div>
          </>
        )}
      </Floaty>

      <Floaty title="📜 PRE-PROMPT · rules this phase" accent="#a16207" initial={{ x: 462, y: 64, w: 440, h: 322 }}>
        {isGlobal ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#a16207" }}>Prejudice-of-Shape · expected 48 hpf tissues (hint, not mandate)</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3, lineHeight: 1.5 }}>{ctx.expectedTissues.join(", ")}</div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {ctx.rules.slice(0, 5).map((r, i) => <div key={i} style={{ fontSize: 11.5, color: "#4a4540", lineHeight: 1.4 }}><b>{r.title}.</b> {r.body}</div>)}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 800, color: "#15803d" }}>🔒 GT-BLIND DISCIPLINE</div>
        {ctx.gtDiscipline.slice(0, 2).map((r, i) => <div key={i} style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}><b>{r.title}.</b> {r.body}</div>)}
      </Floaty>

      <Floaty title="🎯 DECISION · this step (4 jobs)" accent="#7c3aed" initial={{ x: 462, y: 398, w: 440, h: 250 }}>
        {cur ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(cur.merges || []).map((m: any, i: number) => <div key={"m" + i} style={{ fontSize: 12, lineHeight: 1.4 }}><span style={chip("#dcfce7", "#15803d")}>⤵ merge · {String(m.tier).replace("cell_type_", "")}</span> <b>{m.node_label}</b> ← {m.member_leaf_ids?.length} leaves</div>)}
            {(cur.set_aside || []).map((s: any, i: number) => <div key={"a" + i} style={{ fontSize: 12, lineHeight: 1.4 }}><span style={chip("#eef2ff", "#4338ca")}>⎇ set-aside / rebel · {String(s.tier).replace("cell_type_", "")}</span> leaf {s.leaf_id} — {leafLabel[String(s.leaf_id)] || "?"}</div>)}
            {!(cur.merges || []).length && !(cur.set_aside || []).length ? <div style={{ fontSize: 12, color: "#9a948c" }}>no decision recorded</div> : null}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#9a3412", lineHeight: 1.5 }}><b>Prejudice-of-Shape · still missing:</b> {(fm?.expected_still_missing || []).join(", ") || "— nothing flagged"}</div>
        )}
      </Floaty>

      <Floaty title="⚖️ ADD JUDGEMENT" accent="#7c3aed" initial={{ x: 250, y: 236, w: 350, h: 244 }}>
        <MetaJudgeInput
          judgements={judgements}
          stage="merging"
          keyId={cur ? `C${cur.compartment}` : "meta_global"}
          onAdd={(note: string) => addJudgement({ cluster_id: cur ? `C${cur.compartment}` : "meta_global", cluster_label: cur ? `Meta-Reasoner · Compartment ${cur.compartment}` : "Meta-Reasoner · Prejudice-of-Shape audit", mode: "merging", step_index: step, content_excerpt: cur ? `compartment ${cur.compartment} decision` : "missing-tissue audit", note })}
        />
      </Floaty>

      {/* bottom nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 440, height: 54, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, background: "#fffdfb", borderTop: "1px solid #e5e1dc", zIndex: 100 }}>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{ ...btnGhost, opacity: step === 0 ? 0.4 : 1 }}>← Prev</button>
        <span style={{ fontSize: 12.5, color: "#666" }}>{isGlobal ? "Prejudice-of-Shape audit" : `Compartment ${cur.compartment} · ${(cur.merges?.length || 0) + (cur.set_aside?.length || 0)} nodes`}</span>
        <button onClick={() => setStep((s) => Math.min(N - 1, s + 1))} disabled={step >= N - 1} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: step >= N - 1 ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}

// ===================================================================
// LIVE / FINALIZE workbench — a human-driven Meta-Reasoner CHAT over a labelled
// run. You type the next prompt, or (usually) press "Self-Suggest Next Step" and
// the Meta-Reasoner runs its operator on the next compartment live. Floaties track
// its attention. Judgements append to run.judgements[] and persist via Save.
// ===================================================================
function LiveMetaWorkbench({ run, clusters, judgements, addJudgement, onBack, endBtn }: { run: any; clusters: any[] | null; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; endBtn?: React.ReactNode }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<Record<number, any>>({});
  const [attention, setAttention] = useState<number | null>(null);
  const [globalDone, setGlobalDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");

  const leafLabel: Record<string, string> = {};
  (run?.clusters || []).forEach((c: any) => { leafLabel[String(c.id)] = c.finalLabel; });
  const comps = useMemo(() => {
    const by = new Map<number, string[]>();
    (clusters || []).forEach((c: any) => { if (typeof c.compartmentIndex === "number") { if (!by.has(c.compartmentIndex)) by.set(c.compartmentIndex, []); by.get(c.compartmentIndex)!.push(String(c.id)); } });
    return Array.from(by.keys()).sort((a, b) => a - b).map((idx) => ({ index: idx, leafIds: by.get(idx)!, labelSet: by.get(idx)!.map((id) => ({ leaf_id: id, label: leafLabel[id] || "?" })) }));
  }, [clusters, run]);
  const ledger = { totalLeaves: (clusters || []).length, totalCompartments: comps.length, compartmentSizes: Object.fromEntries(comps.map((c) => [String(c.index), c.leafIds.length])) };
  const processed = Object.keys(decisions).length;
  const nextComp = comps.find((c) => !decisions[c.index]);
  const allDone = !nextComp;
  // the exact prompt the NEXT step will send — shown in the judgement gate so you
  // can judge (or improve) it before it's delivered to the Meta-Reasoner.
  const isFirstStep = Object.keys(decisions).length === 0;
  // ⚖️ judged: the very first prompt is the opener — give the Meta-Reasoner proper
  // context on its job/goals (~200 words); subsequent compartments stay concise.
  const compPrompt = nextComp
    ? (isFirstStep
      ? `You are the META-REASONER, and this is your opening task. The ~${ledger.totalLeaves} fine leaf clusters of this 48-hour zebrafish embryo are already labelled by a per-cell loop; your job now is to CONSOLIDATE them into a final ~50–80 defensible nodes. Four jobs: (1) MERGE redundant restatements of one identity into a single node (e.g. many "periderm / superficial epidermal keratinocyte" calls → one node); (2) SET-ASIDE / REBEL — keep a genuinely distinct leaf as its own node, and flag any leaf whose markers contradict its compartment for re-parenting; (3) PREJUDICE-OF-SHAPE (later) — audit the whole set against general 48 hpf biology (blood, pancreas, liver, CNS, muscle…) for missing tissues; that prior is a hint, never a licence to invent — "expected tissue not found" is a valid answer; (4) ASSIGN each node the schema tier it can defend (coarse tissue ↔ fine cell type). You are GT-BLIND: reason only from the labeller's own predicted labels, never sealed ground truth. We proceed compartment by compartment. Begin with Compartment ${nextComp.index} (${nextComp.leafIds.length} labelled leaves): merge the redundant, set aside the distinct/rebel, and give each node its tier.`
      : `Compartment ${nextComp.index} — ${nextComp.leafIds.length} labelled leaves. Continue the consolidation: merge redundant restatements into one node, set aside distinct/rebel leaves, and assign each node the tier it can defend.`)
    : "";
  const auditPrompt = "All compartments consolidated. Prejudice-of-Shape — audit the whole labelled set: which expected 48 hpf tissues are still unaccounted for? (A hint, never a licence to invent one.)";
  const pendingPrompt: string | null = nextComp ? compPrompt : (!globalDone ? auditPrompt : null);
  const pendingKeyId = nextComp ? `C${nextComp.index}` : "meta_global";
  // the gate shows the Meta-Reasoner's latest OUTPUT (reasoning + decision) once a
  // step has run, else the next prompt to judge before it's sent.
  const lastAssistant = messages.filter((m) => m.role === "assistant").slice(-1)[0];
  const gateContent: string | null = lastAssistant ? lastAssistant.content : pendingPrompt;
  const gateIsResponse = !!lastAssistant;
  const gateTargetId = gateIsResponse ? (attention != null ? `C${attention}` : "meta_global") : pendingKeyId;
  const gateTargetLabel = gateIsResponse ? (attention != null ? `Meta-Reasoner output · Compartment ${attention}` : "Meta-Reasoner audit output") : (nextComp ? `Prompt · Compartment ${nextComp.index}` : "Prompt · audit");
  const nextLabel = nextComp ? `Compartment ${nextComp.index}` : (!globalDone ? "audit" : null);
  const nLoggedMeta = (judgements || []).filter((j) => j.mode === "merging").length;
  const gateTag = gateIsResponse
    ? (attention != null ? `🧠 Meta-Reasoner · Compartment ${attention}` : "∅ Prejudice-of-Shape · audit")
    : (Object.keys(decisions).length === 0 && nextComp ? "❓ First prompt → Meta-Reasoner" : nextComp ? `↳ prompt → Compartment ${nextComp.index}` : "∅ audit prompt");
  const post = async (body: any) => {
    const r = await fetch("/api/meta_reasoner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  };

  async function selfSuggest() {
    if (busy) return; setBusy(true);
    try {
      if (nextComp) {
        setAttention(nextComp.index);
        setMessages((m) => [...m, { role: "user", content: compPrompt }]);
        const d = await post({ op: "consolidate", scope: "compartment", compartment: nextComp.index, labelSet: nextComp.labelSet, ledger, model: run?.model });
        if (d.ok) {
          setDecisions((p) => ({ ...p, [nextComp.index]: d.output }));
          setMessages((m) => [...m, { role: "assistant", content: stripJsonFence(d.reasoning) + decisionMdOut(d.output) }]);
        } else {
          setMessages((m) => [...m, { role: "assistant", content: `_(operator error: ${d.error}${d.detail ? " — " + d.detail : ""})_` }]);
        }
      } else if (!globalDone) {
        setAttention(null);
        setMessages((m) => [...m, { role: "user", content: auditPrompt }]);
        const all = comps.flatMap((c) => c.labelSet);
        const d = await post({ op: "consolidate", scope: "global", labelSet: all, ledger, model: run?.model });
        if (d.ok) {
          setGlobalDone(d.output?.flag_missing || {});
          const fm = d.output?.flag_missing;
          setMessages((m) => [...m, { role: "assistant", content: stripJsonFence(d.reasoning) + (fm?.expected_still_missing?.length ? "\n\n**Still missing:** " + fm.expected_still_missing.join(", ") : "") }]);
        } else setMessages((m) => [...m, { role: "assistant", content: `_(audit error: ${d.error})_` }]);
      }
    } finally { setBusy(false); }
  }

  async function sendPrompt() {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setBusy(true);
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    try {
      const labelContext = comps.map((c) => `Compartment ${c.index} (${c.leafIds.length}): ${c.labelSet.map((l) => l.label).join("; ")}`).join("\n");
      const d = await post({ op: "chat", messages: next.map((m) => ({ role: m.role, content: m.content })), labelContext, model: run?.model });
      setMessages((m) => [...m, { role: "assistant", content: d.ok ? d.reasoning : `_(chat error: ${d.error})_` }]);
    } finally { setBusy(false); }
  }

  const attComp = attention != null ? comps.find((c) => c.index === attention) : null;
  const attDec = attention != null ? decisions[attention] : null;
  const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: "1px 8px" });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: PAPER, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#fffdfb", borderBottom: "1px solid #e5e1dc", zIndex: 100 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <div style={{ fontWeight: 800 }}>🧠 Meta-Reasoner · Finalize (live)</div>
        <span style={{ fontSize: 12.5, color: "#666" }}>{comps.length} compartments · {ledger.totalLeaves} labelled leaves · {processed} consolidated{globalDone ? " · audited" : ""}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>{busy ? "⏳ reasoning…" : allDone ? (globalDone ? "✓ finalize proposal complete" : "ready for the audit") : `next: Compartment ${nextComp?.index}`}</span>
      </div>

      {/* right chat column with input + self-suggest */}
      <div style={{ position: "absolute", top: 52, right: 0, bottom: 0, width: 460, background: "#fff", borderLeft: "1px solid #e5e1dc", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={SEC}>🧠 Meta-Reasoner chat — you drive</div>
          {messages.length === 0 ? <div style={{ fontSize: 12.5, color: "#9a948c", lineHeight: 1.5 }}>The 250 leaves are labelled. Type a prompt to the Meta-Reasoner, or press <b>Self-Suggest Next Step</b> to have it consolidate the next compartment.</div> : null}
          {messages.map((m, i) => m.role === "user"
            ? <div key={i} style={userBubble}>{m.content}</div>
            : <AgentMessage key={i} mode="reason" content={m.content} />)}
          {busy ? <div style={{ fontSize: 12, color: "#7c3aed", fontStyle: "italic" }}>🧠 the Meta-Reasoner is reasoning…</div> : null}
        </div>
        <div style={{ flexShrink: 0, borderTop: "1px solid #e5e1dc", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          <button onClick={selfSuggest} disabled={busy || (allDone && !!globalDone)} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy || (allDone && globalDone) ? 0.5 : 1 }}>
            🧠 Meta-Reasoner Self-Suggest Next Step {allDone ? (globalDone ? "· done" : "· (audit)") : `· (Compartment ${nextComp?.index})`}
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }} placeholder="…or type your own prompt to the Meta-Reasoner" rows={2}
              style={{ flex: 1, boxSizing: "border-box", border: "1px solid #e5e1dc", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", fontFamily: "inherit" }} />
            <button onClick={sendPrompt} disabled={busy || !input.trim()} style={{ ...btnGhost, alignSelf: "stretch", fontWeight: 700, opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      </div>

      {/* floaty visuals — track the Meta-Reasoner's current attention */}
      <Floaty title="🗺 WORLD MAP · attention" accent="#0e7490" initial={{ x: 18, y: 64, w: 430, h: 322 }}>
        {clusters ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set(Object.keys(decisions).flatMap((k) => comps.find((c) => c.index === Number(k))?.leafIds || []))} width={404} height={248} dimUnfocused focusCompartments={attention != null ? [attention] : []} /> : <div style={{ color: "#aaa", fontSize: 12 }}>loading map…</div>}
        <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{attComp ? `Attending to Compartment ${attComp.index} · ${attComp.leafIds.length} leaves` : allDone ? "Whole set — audit" : "Awaiting first step"}</div>
      </Floaty>
      <Floaty title="📥 INPUTS · what it reasons over" accent="#15803d" initial={{ x: 18, y: 398, w: 430, h: 250 }}>
        {attComp ? (<>
          <div style={{ fontSize: 10.5, color: "#9a948c", fontWeight: 800 }}>PREDICTED LABELS · Compartment {attComp.index} (GT-blind)</div>
          {attComp.labelSet.map((l) => <div key={l.leaf_id} style={{ fontSize: 12, color: "#444", lineHeight: 1.4 }}><span style={{ color: "#9a948c" }}>{l.leaf_id}:</span> {l.label}</div>)}
        </>) : <div style={{ fontSize: 12, color: "#9a948c" }}>{ledger.totalLeaves} leaves across {comps.length} compartments. Self-suggest to begin.</div>}
      </Floaty>
      <Floaty title="🎯 DECISION · latest step" accent="#7c3aed" initial={{ x: 462, y: 64, w: 440, h: 300 }}>
        {attDec ? (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(attDec.merges || []).map((m: any, i: number) => <div key={"m" + i} style={{ fontSize: 12, lineHeight: 1.4 }}><span style={chip("#dcfce7", "#15803d")}>⤵ merge · {String(m.tier).replace("cell_type_", "")}</span> <b>{m.node_label}</b> ← {m.member_leaf_ids?.length} leaves</div>)}
          {(attDec.set_aside || []).map((s: any, i: number) => <div key={"a" + i} style={{ fontSize: 12, lineHeight: 1.4 }}><span style={chip("#eef2ff", "#4338ca")}>⎇ rebel · {String(s.tier).replace("cell_type_", "")}</span> leaf {s.leaf_id} — {leafLabel[String(s.leaf_id)] || "?"}</div>)}
        </div>) : globalDone ? <div style={{ fontSize: 12.5, color: "#9a3412" }}><b>Still missing:</b> {(globalDone.expected_still_missing || []).join(", ") || "— nothing flagged"}</div> : <div style={{ fontSize: 12, color: "#9a948c" }}>no decision yet</div>}
      </Floaty>
      <Floaty title="⚖️ JUDGEMENT" accent="#7c3aed" initial={{ x: 250, y: 224, w: 420, h: 400 }} minH={260}>
        <StepJudgeGate
          content={gateContent}
          isResponse={gateIsResponse}
          tag={gateTag}
          nLogged={nLoggedMeta}
          busy={busy}
          nextLabel={nextLabel}
          stepKey={gateTargetId + ":" + processed}
          priorNotes={(judgements || []).filter((j) => j.mode === "merging" && String(j.cluster_id) === gateTargetId)}
          onSubmitNote={(note: string) => addJudgement({ cluster_id: gateTargetId, cluster_label: gateTargetLabel, mode: "merging", step_index: processed, content_excerpt: (gateContent || "").slice(0, 240), note })}
          onAdvance={() => selfSuggest()}
          endBtn={endBtn}
        />
      </Floaty>
    </div>
  );
}

// decision summary (markdown) from a LIVE operator output object
function decisionMdOut(out: any): string {
  const lines: string[] = [];
  (out?.merges || []).forEach((m: any) => lines.push(`- ⤵ **merge** _[${String(m.tier || "").replace("cell_type_", "")}]_ **${m.node_label}** ← ${m.member_leaf_ids?.length || 0} leaves`));
  (out?.set_aside || []).forEach((s: any) => lines.push(`- ⎇ **set aside** leaf ${s.leaf_id} (kept distinct)`));
  return lines.length ? "\n\n**→ Decision**\n" + lines.join("\n") : "";
}

// ===================================================================
// META-REASONER FINALIZE FLOW — pre-flight before the live chat:
//   1) Summary of the labelled run we're inheriting (glanceable map + stats)
//   2) Prep: what the Meta-Reasoner is loaded with (rules/discipline/priors) + its goals
//   3) the live workbench (LiveMetaWorkbench)
// Every pre-step is judgement-able (persists to run.judgements[]).
// ===================================================================
function MetaFinalizeFlow({ run, clusters, judgements, addJudgement, onBack, onSubmitJudgements }: { run: any; clusters: any[] | null; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; onSubmitJudgements?: () => Promise<{ ok: boolean; runId?: string; error?: string }> }) {
  const [stage, setStage] = useState<"summary" | "prep" | "workbench">("summary");
  const end = <EndJudgementsButton judgements={judgements} onSubmit={onSubmitJudgements} />;
  if (stage === "summary") return <FinalizeSummary run={run} clusters={clusters} judgements={judgements} addJudgement={addJudgement} onBack={onBack} onNext={() => setStage("prep")} endBtn={end} />;
  if (stage === "prep") return <FinalizePrep judgements={judgements} addJudgement={addJudgement} onBack={() => setStage("summary")} onNext={() => setStage("workbench")} endBtn={end} />;
  return <LiveMetaWorkbench run={run} clusters={clusters} judgements={judgements} addJudgement={addJudgement} onBack={() => setStage("prep")} endBtn={end} />;
}

// Red "End & Submit Judgements" control — opens a summary modal, submits via the
// run's judgement-save path, and confirms to the operator.
function EndJudgementsButton({ judgements, onSubmit }: { judgements: any[]; onSubmit?: () => Promise<{ ok: boolean; runId?: string; error?: string }> }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ s: "idle" | "saving" | "ok" | "err"; msg?: string }>({ s: "idle" });
  const n = (judgements || []).length;
  const submit = async () => {
    if (!onSubmit) { setState({ s: "err", msg: "No save path wired." }); return; }
    setState({ s: "saving" });
    const r = await onSubmit();
    setState(r.ok ? { s: "ok", msg: `✓ Submitted ${n} judgement${n === 1 ? "" : "s"} — logged as run version ${r.runId ?? "?"}.` } : { s: "err", msg: `Submit failed: ${r.error}` });
  };
  const modeLabel = (m: string) => m === "finalize_summary" ? "Run summary" : m === "finalize_prep" ? "Meta-Reasoner prep" : m === "meta" ? "boundary" : m;
  return (
    <>
      <button onClick={() => { setOpen(true); setState({ s: "idle" }); }} title="End the judgement flow and submit all notes" style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>🛑 End &amp; Submit Judgements ({n})</button>
      {open && (
        <div onClick={() => state.s !== "saving" && setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 96vw)", maxHeight: "88vh", overflow: "auto", background: "#fffdfb", borderRadius: 14, border: "1px solid #e5e1dc", padding: "20px 22px", boxShadow: "0 24px 70px rgba(0,0,0,.35)" }}>
            {state.s === "ok" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 34 }}>✓</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{state.msg}</div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>Your judgements are logged to the run. I&apos;ll use them to refine the Meta-Reasoner.</div>
                <button onClick={() => setOpen(false)} style={{ marginTop: 16, ...btnGhost }}>Close</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>End judgement flow — submit {n} judgement{n === 1 ? "" : "s"}</div>
                <div style={{ fontSize: 12.5, color: "#666", margin: "4px 0 12px" }}>Review your notes, then submit. This logs them to the run (a new version) and confirms back to you.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {n === 0 ? <div style={{ fontSize: 13, color: "#9a948c", fontStyle: "italic" }}>No judgements captured yet.</div> :
                    (judgements || []).map((j, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: "#4a4540", background: "#faf7ff", border: "1px solid #ece2fb", borderLeft: "3px solid #7c3aed", borderRadius: 6, padding: "6px 9px" }}>
                        <span style={{ fontWeight: 700, color: "#7c3aed" }}>{j.cluster_label || j.cluster_id} · {modeLabel(j.mode)}</span>
                        <div>{j.note}</div>
                      </div>
                    ))}
                </div>
                {state.s === "err" ? <div style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 10 }}>{state.msg}</div> : null}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => { const blob = new Blob([JSON.stringify({ schema: "meta_reasoner_judgements/v1", exportedAt: new Date().toISOString(), judgements }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "meta_reasoner_judgements.json"; a.click(); URL.revokeObjectURL(a.href); }} disabled={n === 0} style={{ ...btnGhost, color: "#7c3aed", borderColor: "#7c3aed", opacity: n === 0 ? 0.5 : 1 }}>⬇ Download (.json)</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setOpen(false)} disabled={state.s === "saving"} style={btnGhost}>Cancel</button>
                    <button onClick={submit} disabled={state.s === "saving" || n === 0} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 800, cursor: n === 0 ? "not-allowed" : "pointer", opacity: n === 0 ? 0.5 : 1 }}>{state.s === "saving" ? "Submitting…" : "🛑 Submit judgements"}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const FIN_SHELL: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 60, background: PAPER, overflow: "auto" };
const FIN_INNER: React.CSSProperties = { maxWidth: 940, margin: "0 auto", padding: "20px 22px 90px" };
const FIN_BAR: React.CSSProperties = { position: "fixed", left: 0, right: 0, bottom: 0, height: 60, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, background: "#fffdfb", borderTop: "1px solid #e5e1dc", zIndex: 100 };

function FinalizeSummary({ run, clusters, judgements, addJudgement, onBack, onNext, endBtn }: any) {
  const nLeaves = (run?.clusters || []).length;
  const comps = new Set((clusters || []).map((c: any) => c.compartmentIndex).filter((x: any) => typeof x === "number"));
  const money = (v: number) => (v == null ? "?" : v < 1 ? v.toFixed(3) : v.toFixed(2));
  return (
    <div style={FIN_SHELL}>
      <div style={FIN_INNER}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={onBack} style={btnGhost}>← Back to datasets</button>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c3aed", fontWeight: 700 }}>Meta-Reasoner Finalize · step 1 of 2</div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "2px 0 4px" }}>⚖️ Inheriting a labelled run</h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5, margin: "0 0 14px" }}>
          These clusters are already labelled by the fine per-cell loop. The Meta-Reasoner picks up here — you&apos;ll drive it to consolidate them. A glance at what we&apos;re inheriting:
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {[["model", run?.model ?? "?"], ["fine leaves", nLeaves], ["compartments", comps.size], ["cost", run?.cost?.usd != null ? `~$${money(Number(run.cost.usd))}` : "—"], ["harness", run?.harness ? `v${run.harness.version}` : "—"]].map(([k, v]) => (
            <div key={String(k)} style={{ ...CARD, padding: "8px 14px" }}><div style={{ fontSize: 10.5, color: "#9a948c", fontWeight: 700, textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: 17, fontWeight: 800 }}>{v as any}</div></div>
          ))}
        </div>
        <div style={{ ...CARD, padding: 10 }}>
          <div style={{ ...SEC, textAlign: "center" }}>Clustering & labelling — the fine partition (glanceable)</div>
          {clusters ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {hasCompartments(clusters)
                ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set(clusters.map((c: any) => c.id))} width={760} height={440} />
                : <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={new Set()} width={560} height={420} />}
            </div>
          ) : <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>Loading atlas…</div>}
        </div>
        <div style={{ ...CARD, marginTop: 12 }}>
          <div style={SEC}>⚖️ Judge this inherited run</div>
          <JudgeBox stage="finalize_summary" targetId="run_summary" targetLabel="Inherited run summary" excerpt={`${nLeaves} leaves · ${comps.size} compartments`} judgements={judgements} addJudgement={addJudgement} />
        </div>
      </div>
      <div style={FIN_BAR}>
        {endBtn}
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <button onClick={onNext} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Continue → Meta-Reasoner prep</button>
      </div>
    </div>
  );
}

function FinalizePrep({ judgements, addJudgement, onBack, onNext, endBtn }: any) {
  const ctx = META_REASONER_CONTEXT;
  const cat = (title: string, color: string, items: { title: string; body: string }[]) => (
    <div style={{ ...CARD, marginBottom: 12 }}>
      <div style={{ ...SEC, color }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: "#4a4540", lineHeight: 1.5 }}><b style={{ color: "#333" }}>{r.title}.</b> {r.body}</div>)}
      </div>
    </div>
  );
  return (
    <div style={FIN_SHELL}>
      <div style={FIN_INNER}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={onBack} style={btnGhost}>← Run summary</button>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: "#7c3aed", fontWeight: 700 }}>Meta-Reasoner Finalize · step 2 of 2</div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "2px 0 4px" }}>🧠 Prepping the Meta-Reasoner</h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5, margin: "0 0 14px" }}>What it&apos;s loaded with before it reasons — and what it&apos;s trying to achieve. Refine these over time via system prompting + experiential knowledge.</p>

        {/* GOALS */}
        <div style={{ ...CARD, marginBottom: 14, borderColor: "#e0d3f7", background: "#fdfbff" }}>
          <div style={{ ...SEC, color: "#7c3aed" }}>🎯 Goals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#333" }}><b>Merge redundant clusters</b> — collapse restatements into one node (e.g. fifteen periderm calls → one &quot;epidermis / periderm&quot;).</div>
            <div style={{ fontSize: 13, color: "#333" }}><b>Spot &quot;Rebel&quot; clusters</b> — isolate a genuinely distinct leaf, and where its markers contradict its compartment, flag it to be re-parented to the branch it actually belongs to.</div>
            <div style={{ fontSize: 13, color: "#333" }}><b>Land at ~50–80 final labelled clusters</b> — each emitted at the schema tier it can defend (coarse tissue ↔ fine cell type), plus a missing-tissue audit.</div>
          </div>
        </div>

        <div style={{ ...SEC, fontSize: 12 }}>What it&apos;s prepped with</div>
        {cat("Consolidation rules", "#a16207", ctx.rules)}
        {cat("🔒 GT-blind discipline", "#15803d", ctx.gtDiscipline)}
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={{ ...SEC, color: "#0e7490" }}>Experiential priors · general biology (a hint, not a mandate)</div>
          <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.5 }}>{ctx.expectedTissues.join(", ")}</div>
        </div>

        <div style={{ ...CARD }}>
          <div style={SEC}>⚖️ Judge the meta-reasoner&apos;s prep</div>
          <JudgeBox stage="finalize_prep" targetId="meta_prep" targetLabel="Meta-Reasoner prep (rules + goals)" excerpt="rules/discipline/priors + goals" judgements={judgements} addJudgement={addJudgement} />
        </div>
      </div>
      <div style={FIN_BAR}>
        {endBtn}
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <button onClick={onNext} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Begin finalize → live workbench</button>
      </div>
    </div>
  );
}

// step-gate judgement box for the live workbench: shows the exact PROMPT the next
// step will send, lets you judge/improve it, then either "Submit & continue" (logs
// the note + advances) or "Skip · auto-flow" (advances with no note).
// mirrors the labeller's JudgePanelContent: colored tag + step, instruction line,
// the step content rendered richly, a note box that RESETS per step, and two
// advance buttons (Continue / Add notes + continue), a note count, + End & Submit.
function StepJudgeGate({ content, isResponse, tag, nLogged, priorNotes, busy, nextLabel, stepKey, onSubmitNote, onAdvance, endBtn }: { content: string | null; isResponse: boolean; tag: string; nLogged: number; priorNotes: any[]; busy: boolean; nextLabel: string | null; stepKey: string; onSubmitNote: (note: string) => void; onAdvance: () => void; endBtn?: React.ReactNode }) {
  const [note, setNote] = useState("");
  // reset the note whenever the gated step changes, so a note never bleeds across steps
  useEffect(() => { setNote(""); }, [stepKey]);
  const advance = () => { onAdvance(); };
  const addAndContinue = () => { if (note.trim()) onSubmitNote(note.trim()); onAdvance(); };
  if (!content) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ fontSize: 12.5, color: "#15803d", fontWeight: 700 }}>✓ Finalize complete — every compartment consolidated + the missing-tissue audit done.</div>
      <div style={{ fontSize: 11, color: "#9a938a" }}>{nLogged} note{nLogged === 1 ? "" : "s"} logged this run.</div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>{endBtn}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "2px 9px" }}>{tag}</span>
        <span style={{ fontSize: 10.5, color: "#9a938a", fontWeight: 700 }}>{isResponse ? "output" : "prompt"}</span>
      </div>
      <div style={{ fontSize: 11, color: "#666" }}>{isResponse ? "Critique what the Meta-Reasoner produced, or continue." : "Critique the prompt about to be sent, or continue."}</div>
      <div style={{ flex: 1, minHeight: 60, overflow: "auto", background: "#faf8f6", border: "1px solid #eee7df", borderRadius: 8, padding: isResponse ? "2px 6px" : "8px 10px" }}>
        {busy
          ? <div style={{ fontSize: 12.5, color: "#7c3aed", fontStyle: "italic", padding: "6px 4px" }}>🧠 the Meta-Reasoner is reasoning over this step…</div>
          : isResponse ? <AgentMessage mode="reason" content={content} /> : <div style={{ fontSize: 12, color: "#4a4540", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{content}</div>}
      </div>
      {priorNotes.map((j, i) => <div key={i} style={{ fontSize: 11, color: "#7c3aed", flexShrink: 0 }}>⚖️ {j.note}</div>)}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus rows={2} placeholder={isResponse ? "What's right/wrong about this step? (optional)" : "What's right/wrong about this prompt? (optional)"}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && note.trim()) addAndContinue(); }}
        style={{ boxSizing: "border-box", minHeight: 48, border: "1px solid #e5e1dc", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, lineHeight: 1.45, resize: "vertical", fontFamily: "inherit", flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={advance} disabled={busy || !nextLabel} title="Advance without a note" style={{ ...btnGhost, flex: 1, padding: "7px 8px", fontSize: 12, opacity: busy || !nextLabel ? 0.5 : 1 }}>{busy ? "…" : "Continue"}</button>
        <button onClick={addAndContinue} disabled={busy || !note.trim() || !nextLabel} style={{ flex: 1.4, background: note.trim() ? "#7c3aed" : "#cbb6ec", color: "#fff", border: "none", borderRadius: 8, padding: "7px 8px", fontSize: 12, fontWeight: 700, cursor: note.trim() ? "pointer" : "default" }}>Add notes + continue →</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "#9a938a" }}>{nLogged} note{nLogged === 1 ? "" : "s"} · next: {nextLabel ?? "—"}</span>
        {endBtn}
      </div>
    </div>
  );
}
