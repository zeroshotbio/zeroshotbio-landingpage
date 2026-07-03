"use client";
// RunViewer — the read-only "view a completed run" path (Phase 2b). Renders a
// saved run JSON with NO editing / streaming / autopilot machinery: the atlas
// map, a per-cluster panel (label · confidence · markers · saved transcript),
// and a ground-truth summary — each shown only when the run actually captured
// it (progressive disclosure driven by computeCompletenessProfile). Reuses the
// presentational components extracted in Phase 1.
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  // A FINALIZE session starts fresh (empty) — the inherited run's own judgements are
  // history, not re-served into the live gate. View mode keeps showing the run's notes.
  const [judgements, setJudgements] = useState<any[]>(finalize ? [] : (Array.isArray(run?.judgements) ? run.judgements : []));
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
  // atlas cluster ids are numeric; openCluster is a string → coerce both (this was
  // silently failing, leaving markers stuck on "Loading atlas…").
  const ocAtlas = openCluster ? clusters?.find((c) => String(c.id) === String(openCluster)) || null : null;
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
              {/* this run's own clustering provenance — shown only when the run JSON
                  structurally snapshotted a strategy (never back-filled from live data) */}
              {profile.hasClusteringStrategy ? (
                <div style={{ marginTop: 16, textAlign: "left" }}>
                  <ClusteringProvenance mode="viewer" strategy={run?.clusteringStrategy} datasetId={dataset.id} nClusters={runClusters.length} datasetName={dataset.name} />
                </div>
              ) : null}
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
            {/* Harness — only when this run stamped one (else the section is omitted) */}
            {profile.hasHarness ? (
              <>
                <h2 style={{ ...SEC, fontSize: 12 }}>Harness</h2>
                <div style={{ ...CARD, border: `2px solid ${ACCENT}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>v{run.harness.version}{run.harness.name ? ` · ${run.harness.name}` : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#9a948c", fontFamily: "ui-monospace, monospace", marginTop: 3 }}>{run.harness.gitCommit ? `commit ${run.harness.gitCommit}` : ""}{run.harness.stampedAt ? ` · stamped ${String(run.harness.stampedAt).slice(0, 10)}` : ""}</div>
                </div>
                {/* the three personalities of this harness — the SAME panel New Run shows */}
                <HarnessDetail harness={run.harness} />
              </>
            ) : null}
            {/* Run provenance — only when the run carried it */}
            {profile.hasProvenance ? (
              <div style={{ ...CARD, marginTop: 12 }}>
                <div style={SEC}>Run provenance</div>
                <GroundingPanel provenance={run?.provenance} />
              </div>
            ) : null}
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
            {ocRun.confidence?.germ_layer ? (
              <div style={CARD}>
                <div style={SEC}>Tier confidence</div>
                <ConfidenceContent conf={ocRun.confidence as ClusterConf} />
              </div>
            ) : null}
            <div style={CARD}>
              <div style={SEC}>Top markers</div>
              {clusters == null ? <div style={{ fontSize: 12.5, color: "#aaa" }}>Loading atlas…</div>
                : ocAtlas ? <MarkersContent cluster={ocAtlas} added={Array.isArray(ocRun.addedMarkers) ? ocRun.addedMarkers : []} />
                : <div style={{ fontSize: 12.5, color: "#b0a89e", fontStyle: "italic" }}>No marker genes for this cluster in the atlas.</div>}
            </div>
            <div style={CARD}>
              <div style={SEC}>How this cluster was decided</div>
              <ClusterTranscript transcript={Array.isArray(ocRun.transcript) ? ocRun.transcript : []} finalLabel={ocRun.finalLabel} />
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
            {(() => {
              const tierRows = gt
                ? nativeAgg.map((t: any) => ({ key: t.key, label: TIER_LABEL[t.key] || t.label, pct: t.pct, sub: `${t.matched}/${t.total} agree` }))
                : meanConf.map((t) => ({ key: t.key, label: t.label, pct: t.pct, sub: `mean of ${t.n} clusters` }));
              if (!tierRows.length) return null; // omit the section entirely when unrecorded
              return (
                <div>
                  <div style={{ ...SEC, marginBottom: 8 }}>{gt ? "Final accuracy by tier vs ground truth" : "Final mean confidence by tier"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    {tierRows.map((t) => {
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
                </div>
              );
            })()}

            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <div style={{ ...SEC, padding: "14px 16px 0" }}>Per-cluster breakdown — click a cluster to see how it was decided</div>
              <div style={{ overflow: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", fontWeight: 700, borderBottom: "1px solid #efece7" }}>
                  <span style={{ width: 64, flexShrink: 0 }}>Cluster</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Predicted label</span>
                  {gt ? nativeAgg.map((t: any) => <span key={t.key} style={{ width: 58, textAlign: "center", flexShrink: 0 }} title={`predicted vs GT · ${TIER_LABEL[t.key] || t.label}`}>{(TIER_LABEL[t.key] || t.label).replace("Cell — ", "")}</span>) : profile.hasConfidence ? <span style={{ width: 70, textAlign: "center", flexShrink: 0 }}>conf</span> : null}
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
                      }) : profile.hasConfidence ? <span style={{ width: 70, textAlign: "center", flexShrink: 0, color: "#777", fontVariantNumeric: "tabular-nums" }}>{mc != null ? `${mc}%` : "—"}</span> : null}
                      <span style={{ width: 14, flexShrink: 0, color: ACCENT, fontWeight: 700, textAlign: "right" }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* 4. MERGING & META-REASONING — full-screen Meta-Reasoner workbench (chat + floaty visuals) */}
        {tab === "merging" && <MetaReasonerStage run={run} clusters={clusters} dataset={dataset} judgements={judgements} addJudgement={addJudgement} onSubmitJudgements={saveJudgements} onBack={() => (finalize ? onBack() : setTab("labels"))} live={finalize} />}

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


// Collapsible per-cluster "how this was decided" view: the saved transcript is
// grouped into BEATS (each user prompt + the personality turns it triggers), one
// collapsible <details> per beat = a major inflection point in the story. The last
// beat (the concluding call) opens by default. Honest muted line when unrecorded.
const TRANSCRIPT_MODE: Record<string, { icon: string; title: string }> = {
  research: { icon: "🔬", title: "Researcher" }, reason: { icon: "🧠", title: "Reasoner" }, archivist: { icon: "📚", title: "Archivist" },
};
function ClusterTranscript({ transcript, finalLabel }: { transcript: any[]; finalLabel?: string }) {
  if (!transcript.length) return (
    <div style={{ fontSize: 12.5, color: "#8a8378", lineHeight: 1.55 }}>
      This run didn&apos;t capture a step-by-step reasoning transcript for each cluster — only the final call{finalLabel ? <> (<b>{finalLabel}</b>)</> : null} was recorded. Full New-Run labelling (and the fixture run) keep the whole chat; the headless / scrubbed runs don&apos;t.
    </div>
  );
  // group into beats — a user prompt and the assistant turns that follow it
  const beats: { prompt: string | null; turns: any[] }[] = [];
  let cur: { prompt: string | null; turns: any[] } | null = null;
  transcript.forEach((t) => {
    if (t.role === "user") { if (cur) beats.push(cur); cur = { prompt: t.content, turns: [] }; }
    else { if (!cur) cur = { prompt: null, turns: [] }; cur.turns.push(t); }
  });
  if (cur) beats.push(cur);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {beats.map((b, i) => {
        const last = i === beats.length - 1;
        const modes = b.turns.map((t) => t.mode).filter(Boolean);
        const mm = TRANSCRIPT_MODE[modes[modes.length - 1]] || { icon: "💬", title: `Step ${i + 1}` };
        // prefer the recorded story title ("Researcher · evidence", "Reasoner ·
        // menu-exposed binning", …); fall back to a mode-derived label.
        const storyTitle = b.turns.map((t) => t.title).find(Boolean);
        const meta = { icon: mm.icon, title: storyTitle || mm.title };
        const preview = stripControlBlocks(b.turns.map((t) => t.content).join(" ")).replace(/\s+/g, " ").trim().slice(0, 96);
        return (
          <details key={i} open={last} style={{ border: "1px solid #e9e3db", borderRadius: 9, background: "#fffdfb", overflow: "hidden" }}>
            <summary style={{ cursor: "pointer", listStyle: "none", padding: "9px 12px", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#33312e", flexShrink: 0 }}>{meta.icon} {meta.title}{last ? " · final call" : ""}</span>
              <span style={{ fontSize: 11.5, color: "#9a938a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}…</span>
            </summary>
            <div style={{ padding: "2px 12px 12px", display: "flex", flexDirection: "column", gap: 9, borderTop: "1px solid #f2ede6" }}>
              {b.prompt ? <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#eef2f6", border: "1px solid #dfe6ee", borderRadius: 10, padding: "8px 11px", fontSize: 12, color: "#334", lineHeight: 1.5, marginTop: 9 }}>{stripControlBlocks(b.prompt)}</div> : null}
              {b.turns.map((t, j) => <AgentMessage key={j} content={stripControlBlocks(t.content)} mode={t.mode} thinking={t.thinking} />)}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function MetaReasonerStage({ run, clusters, dataset, judgements, addJudgement, onBack, live, onSubmitJudgements }: { run: any; clusters: any[] | null; dataset?: DatasetDef; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; live?: boolean; onSubmitJudgements?: () => Promise<{ ok: boolean; runId?: string; error?: string }> }) {
  const prop = run?.operatorProposal;
  // FINALIZE / LIVE mode — pre-flight summary → prep → human-driven live chat.
  if (live) return <MetaFinalizeFlow run={run} clusters={clusters} dataset={dataset} judgements={judgements} addJudgement={addJudgement} onBack={onBack} onSubmitJudgements={onSubmitJudgements} />;
  if (!prop) return <div style={CARD}><div style={SEC}>4. Merging & Meta-Reasoning</div>{notRecorded("Operator proposal (use 'Meta-Reasoner Finalize Run' to run it live, or score this run to view a recorded proposal)")}</div>;
  // COMPLETED-RUN mode — an in-page SUMMARY of the finale visuals (no live chrome).
  return <MergingSummary run={run} clusters={clusters} prop={prop} />;
}

// In-page summary of a completed run's Meta-Reasoner consolidation, rendered in
// the "View Completed Run" card style: the collapse headline, the consolidation
// hierarchy, the finalized world map, and the Prejudice-of-Shape ghost coverage —
// the same major visuals as the live finale, but static + judgeable. Tolerant of
// both operatorProposal shapes (slim live-append + the richer fixture bundle).
function MergingSummary({ run, clusters, prop }: { run: any; clusters: any[] | null; prop: any }) {
  const leafLabel: Record<string, string> = {};
  (run?.clusters || []).forEach((c: any) => { leafLabel[String(c.id)] = c.finalLabel; });
  const propComps: any[] = (prop.compartments || []).filter((c: any) => !c.error);
  // decisions keyed by compartment index, for the hierarchy tree
  const decisions: Record<number, any> = {};
  propComps.forEach((c: any) => { decisions[c.compartment] = { merges: c.merges || [], set_aside: c.set_aside || [] }; });
  // comps (index + leafIds) from the live atlas, else reconstructed from the proposal
  const comps = useMemo(() => {
    const by = new Map<number, string[]>();
    (clusters || []).forEach((c: any) => { if (typeof c.compartmentIndex === "number") { if (!by.has(c.compartmentIndex)) by.set(c.compartmentIndex, []); by.get(c.compartmentIndex)!.push(String(c.id)); } });
    if (by.size) return Array.from(by.keys()).sort((a, b) => a - b).map((idx) => ({ index: idx, leafIds: by.get(idx)! }));
    return propComps.map((c: any) => ({ index: c.compartment, leafIds: [...(c.merges || []).flatMap((m: any) => (m.member_leaf_ids || []).map(String)), ...(c.set_aside || []).map((s: any) => String(s.leaf_id))] }));
  }, [clusters, prop]);
  const merges = propComps.flatMap((c: any) => (c.merges || []).map((m: any) => ({ ...m, ci: c.compartment })));
  const asides = propComps.flatMap((c: any) => (c.set_aside || []).map((s: any) => ({ ...s, ci: c.compartment })));
  const totalNodes = prop.n_nodes ?? prop.after?.total_nodes ?? (merges.length + asides.length);
  const leavesFolded = merges.reduce((s: number, m: any) => s + (m.member_leaf_ids?.length || 0), 0);
  const beforeLeaves = prop.n_before ?? prop.before?.leaves ?? comps.reduce((s: number, c: any) => s + c.leafIds.length, 0);
  const globalDone = prop.flag_missing || null;
  const missing = globalDone?.expected_still_missing || [];
  const reduction = beforeLeaves > 0 ? Math.round((1 - totalNodes / beforeLeaves) * 100) : 0;
  const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, color: fg, background: bg, borderRadius: 99, padding: "1px 8px" });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "6px 4px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* HERO — the collapse */}
      <div style={{ ...RCARD, textAlign: "center", padding: "20px 18px" }}>
        <div style={{ fontSize: 12.5, color: "#9a948c", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Meta-Reasoner consolidation · {run?.model}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "8px 0 4px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#9a948c", fontVariantNumeric: "tabular-nums" }}>{beforeLeaves}</span>
          <span style={{ fontSize: 20, color: "#c8c0b6" }}>fine leaves →</span>
          <span style={{ fontSize: 44, fontWeight: 800, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>{totalNodes}</span>
          <span style={{ fontSize: 20, color: "#c8c0b6" }}>nodes</span>
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>{reduction}% fewer · {leavesFolded} leaves folded into {merges.length} merges · {asides.length} kept distinct</div>
      </div>

      {/* 1 · HIERARCHY — the tree on the left; the per-compartment decisions run
          as a VERTICAL COLUMN in the white space to its right (no separate pane). */}
      <div style={RCARD}>
        <div style={RSEC}>The consolidation hierarchy · compartments → tiers → final nodes</div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ overflowX: "auto", flexShrink: 0 }}>
            <HierarchyTree comps={comps} decisions={decisions} attention={null} nextIdx={null} globalDone={globalDone} width={440} />
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 260, display: "flex", flexDirection: "column", gap: 12, borderLeft: "1px solid #eee7df", paddingLeft: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#9a948c" }}>Per-compartment decisions</div>
            {propComps.map((c: any) => (
              <div key={c.compartment} style={{ borderLeft: "3px solid #e5e1dc", paddingLeft: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#33312e", marginBottom: 4 }}>Compartment {c.compartment} <span style={{ fontWeight: 400, color: "#9a948c" }}>· {(c.merges?.length || 0) + (c.set_aside?.length || 0)} nodes</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {(c.merges || []).map((m: any, i: number) => <div key={"m" + i} style={{ fontSize: 11.5, lineHeight: 1.35 }}><span style={chip("#dcfce7", "#15803d")}>⤵ {String(m.tier).replace("cell_type_", "")}</span> <b>{m.node_label}</b> <span style={{ color: "#9a948c" }}>×{m.member_leaf_ids?.length}</span></div>)}
                  {(c.set_aside || []).map((s: any, i: number) => <div key={"a" + i} style={{ fontSize: 11.5, lineHeight: 1.35 }}><span style={chip("#eef2ff", "#4338ca")}>⎇ {String(s.tier).replace("cell_type_", "")}</span> leaf {s.leaf_id} — {leafLabel[String(s.leaf_id)] || "?"}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2 · WORLD MAP */}
      <div style={{ ...RCARD, padding: 12 }}>
        <div style={{ ...RSEC, textAlign: "center" }}>The finalized atlas · every cluster</div>
        {clusters ? <div style={{ display: "flex", justifyContent: "center" }}>{hasCompartments(clusters) ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set(clusters.map((c: any) => c.id))} width={780} height={450} /> : <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={new Set()} width={560} height={420} />}</div> : <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>loading map…</div>}
      </div>

      {/* 3 · PREJUDICE-OF-SHAPE ghost coverage */}
      <div style={{ ...RCARD, borderColor: missing.length ? "#fed7aa" : "#bbf7d0" }}>
        <div style={{ ...RSEC, color: missing.length ? "#b45309" : "#15803d" }}>Prejudice of shape · did we cover every tissue we expect at 48 hpf?</div>
        <ExpectedTissueCoverage missing={missing} />
        {globalDone?.rationale ? <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 10, lineHeight: 1.5 }}>{globalDone.rationale}</div> : null}
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
function LiveMetaWorkbench({ run, clusters, dataset, judgements, addJudgement, onBack, endBtn }: { run: any; clusters: any[] | null; dataset?: DatasetDef; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; endBtn?: React.ReactNode }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<Record<number, any>>({});
  const [attention, setAttention] = useState<number | null>(null);
  const [globalDone, setGlobalDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [liveTrace, setLiveTrace] = useState(""); // reasoning summary streaming in
  const [liveText, setLiveText] = useState("");   // output text streaming in
  const [chatW, setChatW] = useState(460);        // draggable chat-column width
  const [auto, setAuto] = useState(false);        // autopilot running the whole arc
  const autoRef = useRef(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = chatRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, busy, liveTrace, liveText]);

  const leafLabel: Record<string, string> = {};
  (run?.clusters || []).forEach((c: any) => { leafLabel[String(c.id)] = c.finalLabel; });
  const comps = useMemo(() => {
    const by = new Map<number, string[]>();
    (clusters || []).forEach((c: any) => { if (typeof c.compartmentIndex === "number") { if (!by.has(c.compartmentIndex)) by.set(c.compartmentIndex, []); by.get(c.compartmentIndex)!.push(String(c.id)); } });
    return Array.from(by.keys()).sort((a, b) => a - b).map((idx) => ({ index: idx, leafIds: by.get(idx)!, labelSet: by.get(idx)!.map((id) => ({ leaf_id: id, label: leafLabel[id] || "?" })) }));
  }, [clusters, run]);
  const ledger = { totalLeaves: (clusters || []).length, totalCompartments: comps.length, compartmentSizes: Object.fromEntries(comps.map((c) => [String(c.index), c.leafIds.length])) };
  const processed = Object.keys(decisions).length;
  const doneThrough = processed ? Math.max(...Object.keys(decisions).map(Number)) : null;
  const nextComp = comps.find((c) => !decisions[c.index]);
  const allDone = !nextComp;
  // the exact prompt the NEXT step will send — shown in the judgement gate so you
  // can judge (or improve) it before it's delivered to the Meta-Reasoner.
  const isFirstStep = Object.keys(decisions).length === 0;
  // ⚖️ judged: the very first prompt is the opener — give the Meta-Reasoner proper
  // context on its job/goals (~200 words); subsequent compartments stay concise.
  const promptFor = (nc: any, first: boolean) => nc
    ? (first
      ? `You are the META-REASONER, and this is your opening task. The ~${ledger.totalLeaves} fine leaf clusters of this 48-hour zebrafish embryo are already labelled by a per-cell loop; your job now is to CONSOLIDATE them into a final ~50–80 defensible nodes. Four jobs: (1) MERGE redundant restatements of one identity into a single node (e.g. many "periderm / superficial epidermal keratinocyte" calls → one node); (2) SET-ASIDE / REBEL — keep a genuinely distinct leaf as its own node, and flag any leaf whose markers contradict its compartment for re-parenting; (3) PREJUDICE-OF-SHAPE (later) — audit the whole set against general 48 hpf biology (blood, pancreas, liver, CNS, muscle…) for missing tissues; that prior is a hint, never a licence to invent — "expected tissue not found" is a valid answer; (4) ASSIGN each node the schema tier it can defend (coarse tissue ↔ fine cell type). You are GT-BLIND: reason only from the labeller's own predicted labels, never sealed ground truth. We proceed compartment by compartment. Begin with Compartment ${nc.index} (${nc.leafIds.length} labelled leaves): merge the redundant, set aside the distinct/rebel, and give each node its tier.`
      : `Compartment ${nc.index} — ${nc.leafIds.length} labelled leaves. Continue the consolidation: merge redundant restatements into one node, set aside distinct/rebel leaves, and assign each node the tier it can defend.`)
    : "";
  const compPrompt = promptFor(nextComp, isFirstStep);
  const auditPrompt = "All compartments consolidated. Prejudice-of-Shape — audit the whole labelled set: which expected 48 hpf tissues are still unaccounted for? (A hint, never a licence to invent one.)";
  const pendingPrompt: string | null = nextComp ? compPrompt : (!globalDone ? auditPrompt : null);
  const pendingKeyId = nextComp ? `C${nextComp.index}` : "meta_global";
  // the gate shows the Meta-Reasoner's latest OUTPUT (reasoning + decision) once a
  // step has run, else the next prompt to judge before it's sent.
  const lastAssistant = messages.filter((m) => m.role === "assistant").slice(-1)[0];
  const gateContent: string | null = lastAssistant ? lastAssistant.content : pendingPrompt;
  const gateThinking: string | undefined = lastAssistant ? lastAssistant.thinking : undefined;
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
  // stream a consolidate/chat call, piping the reasoning summary word-by-word into
  // liveTrace (and any output text into liveText). Returns the terminal payload.
  const postStream = async (body: any) => {
    setLiveTrace(""); setLiveText("");
    let r: Response;
    try { r = await fetch("/api/meta_reasoner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, stream: true }) }); }
    catch { return post(body); }
    if (!r.ok || !r.body) return post(body); // fall back to non-streaming
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", final: any = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        const s = line.trim(); if (!s) continue;
        let ev: any; try { ev = JSON.parse(s); } catch { continue; }
        if (ev.t === "trace") setLiveTrace((p) => p + ev.d);
        else if (ev.t === "text") setLiveText((p) => p + ev.d);
        else if (ev.t === "done") final = { ok: true, ...ev };
        else if (ev.t === "error") final = { ok: false, error: ev.error };
      }
    }
    return final || { ok: false, error: "stream_ended" };
  };

  // one compartment step — returns the decision output (or null on error). Drives
  // all side effects (attention, chat, decisions) so both the single-step button
  // and autopilot share exactly one code path.
  async function stepCompartment(nc: any, first: boolean) {
    setAttention(nc.index);
    setMessages((m) => [...m, { role: "user", content: promptFor(nc, first) }]);
    const d = await postStream({ op: "consolidate", scope: "compartment", compartment: nc.index, labelSet: nc.labelSet, ledger, model: run?.model });
    if (d.ok) {
      setDecisions((p) => ({ ...p, [nc.index]: d.output }));
      setMessages((m) => [...m, { role: "assistant", content: stripJsonFence(d.reasoning) + decisionMdOut(d.output), thinking: d.reasoningTrace }]);
      return d.output;
    }
    setMessages((m) => [...m, { role: "assistant", content: `_(operator error: ${d.error}${d.detail ? " — " + d.detail : ""})_` }]);
    return null;
  }
  async function stepGlobal() {
    setAttention(null);
    setMessages((m) => [...m, { role: "user", content: auditPrompt }]);
    const all = comps.flatMap((c) => c.labelSet);
    const d = await postStream({ op: "consolidate", scope: "global", labelSet: all, ledger, model: run?.model });
    if (d.ok) {
      const fm = d.output?.flag_missing || {};
      setGlobalDone(fm);
      setMessages((m) => [...m, { role: "assistant", content: stripJsonFence(d.reasoning) + (fm?.expected_still_missing?.length ? "\n\n**Still missing:** " + fm.expected_still_missing.join(", ") : ""), thinking: d.reasoningTrace }]);
      return fm;
    }
    setMessages((m) => [...m, { role: "assistant", content: `_(audit error: ${d.error})_` }]);
    return null;
  }

  async function selfSuggest() {
    if (busy) return; setBusy(true);
    try {
      if (nextComp) await stepCompartment(nextComp, isFirstStep);
      else if (!globalDone) await stepGlobal();
    } finally { setBusy(false); }
  }

  // AUTOPILOT — run the whole natural arc (every compartment, then the audit)
  // without a click per step. Tracks progress in LOCAL copies since React state
  // won't have flushed between iterations; stoppable at the next step boundary.
  async function autopilot() {
    if (busy || auto) return;
    setAuto(true); autoRef.current = true; setBusy(true);
    try {
      let localDec: Record<number, any> = { ...decisions };
      let localGlobal = globalDone;
      while (autoRef.current) {
        const nc = comps.find((c) => !localDec[c.index]);
        if (nc) {
          const out = await stepCompartment(nc, Object.keys(localDec).length === 0);
          if (!out) break;
          localDec = { ...localDec, [nc.index]: out };
        } else if (!localGlobal) {
          const fm = await stepGlobal();
          if (!fm) break;
          localGlobal = fm;
        } else break; // whole arc complete
      }
    } finally { setBusy(false); setAuto(false); autoRef.current = false; }
  }

  async function sendPrompt() {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setBusy(true);
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    try {
      const labelContext = comps.map((c) => `Compartment ${c.index} (${c.leafIds.length}): ${c.labelSet.map((l) => l.label).join("; ")}`).join("\n");
      const d = await post({ op: "chat", messages: next.map((m) => ({ role: m.role, content: m.content })), labelContext, model: run?.model });
      setMessages((m) => [...m, { role: "assistant", content: d.ok ? d.reasoning : `_(chat error: ${d.error})_`, thinking: d.ok ? d.reasoningTrace : undefined }]);
    } finally { setBusy(false); }
  }

  const attComp = attention != null ? comps.find((c) => c.index === attention) : null;
  // drag the chat column's LEFT edge to widen/narrow the transcript view
  const beginChatDrag = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: chatW };
    const move = (ev: MouseEvent) => { if (!dragRef.current) return; const dx = dragRef.current.startX - ev.clientX; setChatW(Math.max(320, Math.min(820, dragRef.current.startW + dx))); };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.userSelect = ""; };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    e.preventDefault();
  };

  // Once the finale is open, hand the whole screen to FinalizeResults — the live
  // workbench chrome (chat column + floaties) is retired so it never bleeds over.
  if (showResults) return <FinalizeResults run={run} clusters={clusters} dataset={dataset} decisions={decisions} globalDone={globalDone} comps={comps} judgements={judgements} addJudgement={addJudgement} endBtn={endBtn} onBack={() => setShowResults(false)} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: PAPER, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#fffdfb", borderBottom: "1px solid #e5e1dc", zIndex: 100 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <div style={{ fontWeight: 800 }}>🧠 Meta-Reasoner · Finalize (live)</div>
        <span style={{ fontSize: 12.5, color: "#666" }}>{comps.length} compartments · {ledger.totalLeaves} labelled leaves · {processed} consolidated{globalDone ? " · audited" : ""}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#2563eb", fontWeight: 700 }}>{auto ? `🚀 autopilot · ${processed}/${comps.length}${busy ? " · reasoning…" : ""}` : busy ? "⏳ reasoning…" : allDone ? (globalDone ? "✓ finalize proposal complete" : "ready for the audit") : `next: Compartment ${nextComp?.index}`}</span>
        {globalDone ? <button onClick={() => setShowResults(true)} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>🎉 See the final labelling →</button> : null}
      </div>

      {/* right chat column with input + self-suggest — draggable left edge to resize */}
      <div style={{ position: "absolute", top: 52, right: 0, bottom: 0, width: chatW, background: "#fff", borderLeft: "1px solid #e5e1dc", display: "flex", flexDirection: "column", zIndex: 80 }}>
        <div onMouseDown={beginChatDrag} title="Drag to resize the chat column" style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 9, cursor: "col-resize", zIndex: 90 }}>
          <div style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", width: 3, height: 46, borderRadius: 3, background: "#cbd5e1" }} />
        </div>
        <div ref={chatRef} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={SEC}>🧠 Meta-Reasoner chat — you drive</div>
          {messages.length === 0 ? <div style={{ fontSize: 12.5, color: "#9a948c", lineHeight: 1.5 }}>The 250 leaves are labelled. Type a prompt to the Meta-Reasoner, or press <b>Self-Suggest Next Step</b> to have it consolidate the next compartment.</div> : null}
          {messages.map((m, i) => m.role === "user"
            ? <div key={i} style={userBubble}>{m.content}</div>
            : <AgentMessage key={i} mode="reason" content={m.content} thinking={m.thinking} />)}
          {busy ? (
            (liveTrace || liveText)
              ? <AgentMessage mode="reason" content={stripJsonFence(liveText) || "_reasoning…_"} thinking={liveTrace} thinkingCollapsed={false} pending />
              : <div style={{ fontSize: 12, color: "#2563eb", fontStyle: "italic" }}>🧠 the Meta-Reasoner is reasoning…</div>
          ) : null}
        </div>
        <div style={{ flexShrink: 0, borderTop: "1px solid #e5e1dc", padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
          {/* AUTOPILOT — run the whole arc; becomes a Stop button while running */}
          {auto
            ? <button onClick={() => { autoRef.current = false; }} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
                ⏸ Stop autopilot {nextComp ? `· at Compartment ${nextComp.index}` : "· at audit"}
              </button>
            : (allDone && globalDone)
              ? null
              : <button onClick={autopilot} disabled={busy} style={{ background: "linear-gradient(90deg,#1d4ed8,#2563eb)", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}>
                  🚀 Autopilot — run to the end of the arc
                </button>}
          <button onClick={selfSuggest} disabled={busy || auto || (allDone && !!globalDone)} style={{ background: "#fff", color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 8, padding: "9px", fontSize: 12.5, fontWeight: 800, cursor: busy || auto ? "wait" : "pointer", opacity: busy || auto || (allDone && globalDone) ? 0.5 : 1 }}>
            🧠 Self-Suggest Next Step {allDone ? (globalDone ? "· done" : "· (audit)") : `· (Compartment ${nextComp?.index})`}
          </button>
          {allDone && globalDone ? <div style={{ fontSize: 11.5, color: "#15803d", fontWeight: 700, textAlign: "center" }}>✓ Full arc complete — press <b>🎉 See the final labelling</b> above.</div> : null}
          <div style={{ display: "flex", gap: 6, opacity: auto ? 0.5 : 1, pointerEvents: auto ? "none" : "auto" }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }} placeholder="…or type your own prompt to the Meta-Reasoner" rows={2}
              style={{ flex: 1, boxSizing: "border-box", border: "1px solid #e5e1dc", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", fontFamily: "inherit" }} />
            <button onClick={sendPrompt} disabled={busy || !input.trim()} style={{ ...btnGhost, alignSelf: "stretch", fontWeight: 700, opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      </div>

      {/* floaty visuals — track the Meta-Reasoner's current attention */}
      <Floaty title="🗺 WORLD MAP · progress" accent="#2563eb" initial={{ x: 18, y: 64, w: 430, h: 336 }}>
        {clusters ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set(Object.keys(decisions).flatMap((k) => comps.find((c) => c.index === Number(k))?.leafIds || []))} width={404} height={248} dimUnfocused focusCompartments={attention != null ? [attention] : []} doneThrough={doneThrough} nextCompartment={nextComp?.index ?? null} /> : <div style={{ color: "#aaa", fontSize: 12 }}>loading map…</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 10.5, color: "#666" }}>
          <span>✓ <b style={{ color: "#15803d" }}>{Object.keys(decisions).length}</b> done</span>
          <span>→ <b style={{ color: "#2563eb" }}>{nextComp ? `C${nextComp.index}` : "—"}</b> next</span>
          <span>○ <b style={{ color: "#9a948c" }}>{comps.length - Object.keys(decisions).length}</b> pending</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#666", marginTop: 2 }}>{attComp ? `Attending to Compartment ${attComp.index} · ${attComp.leafIds.length} leaves` : allDone ? "Whole set — audit" : "Awaiting first step"}</div>
      </Floaty>
      {/* hierarchy tree — compartments → tiers → consolidated nodes, filling in + highlighting.
          Given more room now that the INPUTS/DECISION floaties are retired. */}
      <Floaty title="🌳 HIERARCHY · compartments → tiers → nodes" accent="#2563eb" initial={{ x: 462, y: 64, w: 466, h: 660 }} minH={240}>
        <HierarchyTree comps={comps} decisions={decisions} attention={attention} nextIdx={nextComp?.index ?? null} globalDone={globalDone} />
      </Floaty>
      <Floaty title="⚖️ JUDGEMENT" accent="#7c3aed" initial={{ x: 18, y: 412, w: 430, h: 424 }} minH={260}>
        <StepJudgeGate
          content={gateContent}
          thinking={gateThinking}
          streamTrace={liveTrace}
          streamText={liveText}
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
function MetaFinalizeFlow({ run, clusters, dataset, judgements, addJudgement, onBack, onSubmitJudgements }: { run: any; clusters: any[] | null; dataset?: DatasetDef; judgements: any[]; addJudgement: (j: any) => void; onBack: () => void; onSubmitJudgements?: () => Promise<{ ok: boolean; runId?: string; error?: string }> }) {
  const [stage, setStage] = useState<"summary" | "prep" | "workbench">("summary");
  const end = <EndJudgementsButton judgements={judgements} onSubmit={onSubmitJudgements} />;
  if (stage === "summary") return <FinalizeSummary run={run} clusters={clusters} judgements={judgements} addJudgement={addJudgement} onBack={onBack} onNext={() => setStage("prep")} endBtn={end} />;
  if (stage === "prep") return <FinalizePrep judgements={judgements} addJudgement={addJudgement} onBack={() => setStage("summary")} onNext={() => setStage("workbench")} endBtn={end} />;
  return <LiveMetaWorkbench run={run} clusters={clusters} dataset={dataset} judgements={judgements} addJudgement={addJudgement} onBack={() => setStage("prep")} endBtn={end} />;
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
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: "#2563eb", fontWeight: 700 }}>Meta-Reasoner Finalize · step 1 of 2</div>
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
        <button onClick={onNext} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Continue → Meta-Reasoner prep</button>
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
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: "#2563eb", fontWeight: 700 }}>Meta-Reasoner Finalize · step 2 of 2</div>
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
        <button onClick={onNext} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Begin finalize → live workbench</button>
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
function StepJudgeGate({ content, thinking, streamTrace, streamText, isResponse, tag, nLogged, priorNotes, busy, nextLabel, stepKey, onSubmitNote, onAdvance, endBtn }: { content: string | null; thinking?: string; streamTrace?: string; streamText?: string; isResponse: boolean; tag: string; nLogged: number; priorNotes: any[]; busy: boolean; nextLabel: string | null; stepKey: string; onSubmitNote: (note: string) => void; onAdvance: () => void; endBtn?: React.ReactNode }) {
  const [note, setNote] = useState("");
  // reset the note whenever the gated step changes, so a note never bleeds across steps
  useEffect(() => { setNote(""); }, [stepKey]);
  // log the note (always), and advance only if there IS a next step. At the final
  // step (no next) this still records the judgement — the earlier bug was that the
  // button was disabled when nextLabel was null, so audit notes never logged.
  const submitStep = () => { if (note.trim()) { onSubmitNote(note.trim()); setNote(""); } if (nextLabel) onAdvance(); };
  if (!content) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ fontSize: 12.5, color: "#15803d", fontWeight: 700 }}>✓ Finalize complete — every compartment consolidated + the missing-tissue audit done.</div>
      <div style={{ fontSize: 11, color: "#9a938a" }}>{nLogged} note{nLogged === 1 ? "" : "s"} logged this run.</div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "center" }}>{endBtn}</div>
    </div>
  );
  // gate content font is ~20% smaller than the chat's (dense judgement pane)
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 5, fontSize: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, color: "#2563eb", background: "#eff6ff", borderRadius: 99, padding: "2px 9px" }}>{tag}</span>
        <span style={{ fontSize: 8.5, color: "#9a938a", fontWeight: 700 }}>{isResponse ? "trace + output" : "prompt"}</span>
      </div>
      <div style={{ fontSize: 9, color: "#666" }}>{isResponse ? "Critique what the Meta-Reasoner produced, or continue." : "Critique the prompt about to be sent, or continue."}</div>
      <div style={{ flex: 1, minHeight: 60, overflow: "auto", background: "#faf8f6", border: "1px solid #eee7df", borderRadius: 8, padding: isResponse || busy ? "2px 6px" : "8px 10px", fontSize: 10 }}>
        {busy
          ? (streamTrace || streamText
              ? <div style={{ fontSize: 9.5, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "#2563eb", margin: "4px 2px 4px" }}>🧠 reasoning…</div>
                  {streamTrace ? <div style={{ color: "#33507a", whiteSpace: "pre-wrap", fontStyle: "italic" }}>{streamTrace}<span style={{ opacity: 0.5 }}>▍</span></div> : null}
                  {streamText ? <div style={{ marginTop: 8, color: "#4a4540", whiteSpace: "pre-wrap" }}>{stripJsonFence(streamText)}</div> : null}
                </div>
              : <div style={{ fontSize: 10, color: "#2563eb", fontStyle: "italic", padding: "6px 4px" }}>🧠 the Meta-Reasoner is reasoning over this step…</div>)
          : isResponse ? <div style={{ fontSize: "80%" }}><AgentMessage mode="reason" content={content} thinking={thinking} thinkingCollapsed /></div> : <div style={{ fontSize: 10, color: "#4a4540", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{content}</div>}
      </div>
      {priorNotes.map((j, i) => <div key={i} style={{ fontSize: 9, color: "#7c3aed", flexShrink: 0 }}>⚖️ {j.note}</div>)}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus rows={2} placeholder={isResponse ? "What's right/wrong about this step? (optional)" : "What's right/wrong about this prompt? (optional)"}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && note.trim()) submitStep(); }}
        style={{ boxSizing: "border-box", minHeight: 44, border: "1px solid #e5e1dc", borderRadius: 8, padding: "6px 9px", fontSize: 10, lineHeight: 1.45, resize: "vertical", fontFamily: "inherit", flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {nextLabel ? <button onClick={() => onAdvance()} disabled={busy} title="Advance without a note" style={{ flex: 1, background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "6px 8px", fontSize: 10, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "…" : "Continue"}</button> : null}
        <button onClick={submitStep} disabled={busy || !note.trim()} style={{ flex: 1.4, background: note.trim() ? "#7c3aed" : "#cbb6ec", color: "#fff", border: "none", borderRadius: 8, padding: "6px 8px", fontSize: 10, fontWeight: 700, cursor: note.trim() ? "pointer" : "default" }}>{nextLabel ? "Add notes + continue →" : "⚖️ Add note"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: "#9a938a" }}>{nLogged} note{nLogged === 1 ? "" : "s"} · next: {nextLabel ?? "—"}</span>
        {endBtn}
      </div>
    </div>
  );
}

// ===================================================================
// FINALIZE RESULTS — the data-vis finale, triggered once the Meta-Reasoner is done.
// Visualises the consolidation: the collapse, per-tier node counts, the biggest
// merges, the per-compartment before→after, and the Prejudice-of-Shape gap.
// Validated categorical trio (#0891b2/#b45309/#7c3aed) + single-hue magnitude bars.
// ===================================================================
const TIER_SHORT: Record<string, string> = { germ_layer: "germ", tissue: "tissue", cell_type_broad: "broad", cell_type_sub: "sub" };
const RCARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
const RSEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 12px" };

// expected 48 hpf tissues (the "prejudice of shape" prior) as a coverage grid:
// each cell is a major tissue we EXPECT; solid = covered by a final node, ghosted
// (dashed, faded) = expected but unaccounted for (from the operator's own audit).
function ExpectedTissueCoverage({ missing }: { missing: string[] }) {
  const expected = META_REASONER_CONTEXT.expectedTissues;
  const isMissing = (t: string) => missing.some((m) => m.toLowerCase().includes(t.toLowerCase().split(" ")[0]) || t.toLowerCase().includes(String(m).toLowerCase().split(" ")[0]));
  const nCovered = expected.filter((t) => !isMissing(t)).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: nCovered === expected.length ? "#15803d" : "#b45309", fontVariantNumeric: "tabular-nums" }}>{nCovered}/{expected.length}</span>
        <span style={{ fontSize: 13, color: "#666" }}>expected 48 hpf tissues covered · {expected.length - nCovered} ghosted (unaccounted for)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {expected.map((t) => {
          const miss = isMissing(t);
          return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 9,
              border: miss ? "1.5px dashed #d8b48a" : "1px solid #bbf7d0", background: miss ? "repeating-linear-gradient(45deg,#fffdf8,#fffdf8 6px,#fdf3e6 6px,#fdf3e6 12px)" : "#f0fdf4", opacity: miss ? 0.72 : 1 }}>
              <span style={{ fontSize: 15 }}>{miss ? "👻" : "✓"}</span>
              <span style={{ fontSize: 12.5, fontWeight: miss ? 600 : 700, color: miss ? "#9a6a2a" : "#15803d", lineHeight: 1.25 }}>{t}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinalizeResults({ run, clusters, dataset, decisions, globalDone, comps, judgements, addJudgement, endBtn, onBack }: any) {
  const [stage, setStage] = useState<"finale" | "gt">("finale");
  const [save, setSave] = useState<{ s: "idle" | "saving" | "ok" | "err"; msg?: string; runId?: string }>({ s: "idle" });
  const dec = Object.entries(decisions).map(([ci, d]: any) => ({ ci: Number(ci), merges: d.merges || [], set_aside: d.set_aside || [] }));
  const merges = dec.flatMap((d) => d.merges.map((m: any) => ({ ...m, ci: d.ci })));
  const asides = dec.flatMap((d) => d.set_aside.map((s: any) => ({ ...s, ci: d.ci })));
  const totalNodes = merges.length + asides.length;
  const leavesFolded = merges.reduce((s: number, m: any) => s + (m.member_leaf_ids?.length || 0), 0);
  const beforeLeaves = comps.reduce((s: number, c: any) => s + c.leafIds.length, 0);
  const missing = globalDone?.expected_still_missing || [];
  const reduction = beforeLeaves > 0 ? Math.round((1 - totalNodes / beforeLeaves) * 100) : 0;
  const leafLabel: Record<string, string> = {};
  (run?.clusters || []).forEach((c: any) => { leafLabel[String(c.id)] = c.finalLabel; });

  // save & APPEND — persist a NEW run that carries the finalized consolidation on
  // top of the original 250 leaves (non-destructive: the source run is untouched).
  async function saveAppend() {
    setSave({ s: "saving" });
    try {
      const slimClusters = (run?.clusters || []).map((c: any) => ({ id: c.id, label: c.label || c.finalLabel, finalLabel: c.finalLabel, validated: c.validated !== false }));
      const operatorProposal = { source: "live_finalize", n_before: beforeLeaves, n_nodes: totalNodes,
        compartments: dec.map((d) => ({ compartment: d.ci, merges: d.merges, set_aside: d.set_aside })), flag_missing: globalDone || null };
      const body = {
        schema: run?.schema ?? "daniotype_kasperov_run/v1", datasetId: run?.datasetId ?? dataset?.id, dataset: run?.dataset, model: run?.model,
        harness: run?.harness, source: "finalize_append", fixtureRunId: run?.fixtureRunId,
        note: `⚙ finalized (appended) — ${beforeLeaves}→${totalNodes} nodes`,
        clusters: slimClusters, metaDecisions: run?.metaDecisions, operatorProposal,
        appendedFrom: run?.runId ?? run?.fixtureRunId ?? null, judgements, exportedAt: new Date().toISOString(),
      };
      const r = await fetch("/api/kasperov_runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.error) throw new Error(d?.error || `HTTP ${r.status}`);
      setSave({ s: "ok", msg: `Appended run version ${d.runId ?? "?"}`, runId: d.runId });
    } catch (e: any) { setSave({ s: "err", msg: String(e?.message ?? e).slice(0, 140) }); }
  }

  if (stage === "gt") return <FinalGtJudgement run={run} dataset={dataset} merges={merges} asides={asides} leafLabel={leafLabel} judgements={judgements} addJudgement={addJudgement} endBtn={endBtn} saveState={save} onBack={() => setStage("finale")} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: PAPER, overflow: "auto" }}>
      <div style={{ position: "sticky", top: 0, height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#fffdfb", borderBottom: "1px solid #e5e1dc", zIndex: 10 }}>
        <button onClick={onBack} style={btnGhost}>← Back to workbench</button>
        <div style={{ fontWeight: 800 }}>🎉 Final labelling</div>
        <div style={{ marginLeft: "auto" }}>{endBtn}</div>
      </div>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 22px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* HERO — the collapse (kept compact) */}
        <div style={{ ...RCARD, textAlign: "center", padding: "22px 18px" }}>
          <div style={{ fontSize: 13, color: "#9a948c", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Meta-Reasoner finalize · {run?.model}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, margin: "8px 0 4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "#9a948c", fontVariantNumeric: "tabular-nums" }}>{beforeLeaves}</span>
            <span style={{ fontSize: 22, color: "#c8c0b6" }}>fine leaves →</span>
            <span style={{ fontSize: 48, fontWeight: 800, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>{totalNodes}</span>
            <span style={{ fontSize: 22, color: "#c8c0b6" }}>nodes</span>
          </div>
          <div style={{ fontSize: 13.5, color: "#666" }}>{reduction}% fewer · {leavesFolded} leaves folded into {merges.length} merges · {asides.length} kept distinct</div>
        </div>

        {/* 1 · THE HIERARCHY — the star of the finale */}
        <div style={RCARD}>
          <div style={RSEC}>The consolidation hierarchy · compartments → tiers → final nodes</div>
          <div style={{ overflowX: "auto" }}>
            <HierarchyTree comps={comps} decisions={decisions} attention={null} nextIdx={null} globalDone={globalDone} width={960} />
          </div>
        </div>

        {/* 2 · THE WORLD MAP */}
        <div style={{ ...RCARD, padding: 12 }}>
          <div style={{ ...RSEC, textAlign: "center" }}>The finalized atlas · every cluster</div>
          {clusters ? <div style={{ display: "flex", justifyContent: "center" }}>{hasCompartments(clusters) ? <CompartmentMap clusters={clusters} activeId={null} validated={new Set(clusters.map((c: any) => c.id))} width={800} height={460} /> : <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={new Set()} width={560} height={420} />}</div> : null}
        </div>

        {/* 3 · PREJUDICE-OF-SHAPE ghost coverage map */}
        <div style={{ ...RCARD, borderColor: missing.length ? "#fed7aa" : "#bbf7d0" }}>
          <div style={{ ...RSEC, color: missing.length ? "#b45309" : "#15803d" }}>Prejudice of shape · did we cover every tissue we expect at 48 hpf?</div>
          <ExpectedTissueCoverage missing={missing} />
          {globalDone?.rationale ? <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 10, lineHeight: 1.5 }}>{globalDone.rationale}</div> : null}
        </div>
      </div>

      {/* SAVE & APPEND → the final GT-judgement stage */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, minHeight: 62, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "10px 16px", background: "#fffdfb", borderTop: "1px solid #e5e1dc", zIndex: 100, flexWrap: "wrap" }}>
        {save.s === "err" ? <span style={{ fontSize: 12, color: "#b91c1c" }}>append failed: {save.msg}</span> : null}
        {save.s === "ok" ? <span style={{ fontSize: 12, color: "#15803d", fontWeight: 700 }}>✓ {save.msg}</span> : null}
        <button onClick={async () => { if (save.s !== "ok") await saveAppend(); setStage("gt"); }} disabled={save.s === "saving"}
          style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "12px 26px", fontSize: 15, fontWeight: 800, cursor: save.s === "saving" ? "wait" : "pointer", opacity: save.s === "saving" ? 0.6 : 1 }}>
          {save.s === "saving" ? "Appending…" : "💾 Save &amp; append → judge against ground truth →"}
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// FINAL GT JUDGEMENT — the culminating assessment. Scores the finalized MERGED
// nodes against the ZSCAPE published reference (dataset.groundTruthUrl) via the
// existing fuzzy judge, each node at its OWN operator tier, weighting member-leaf
// GT by cell count. Read-only over the atlas; the append already persisted.
// ===================================================================
const GT_TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
function FinalGtJudgement({ run, dataset, merges, asides, leafLabel, judgements, addJudgement, endBtn, saveState, onBack }: any) {
  const [state, setState] = useState<{ s: "idle" | "loading" | "scoring" | "done" | "err"; msg?: string; done?: number; total?: number }>({ s: "idle" });
  const [rows, setRows] = useState<any[]>([]);
  // build one scoring node per merge (member leaves) + per set-aside (single leaf)
  const nodes = useMemo(() => {
    const out: any[] = [];
    (merges || []).forEach((m: any, i: number) => out.push({ id: `C${m.ci}-m${i}`, identity: m.node_label, tier: m.tier, leaf_ids: (m.member_leaf_ids || []).map(String), kind: "merge" }));
    (asides || []).forEach((s: any, i: number) => out.push({ id: `C${s.ci}-a${i}`, identity: s.node_label || leafLabel[String(s.leaf_id)] || "?", tier: s.tier, leaf_ids: [String(s.leaf_id)], kind: "rebel" }));
    return out;
  }, [merges, asides, leafLabel]);

  async function runJudgement() {
    if (!dataset?.groundTruthUrl) { setState({ s: "err", msg: "This dataset has no published ground truth to score against." }); return; }
    setState({ s: "loading" });
    let gt: any;
    try { gt = await (await fetch(dataset.groundTruthUrl)).json(); } catch (e: any) { setState({ s: "err", msg: `Could not load ground truth: ${String(e?.message ?? e).slice(0, 100)}` }); return; }
    const gtClusters = gt?.clusters || {};
    const plurality = (leafIds: string[], tier: string) => {
      const cw = new Map<string, number>();
      leafIds.forEach((lid) => { const e = gtClusters[lid]?.[tier]; if (e?.label) cw.set(e.label, (cw.get(e.label) || 0) + (e.n || 1)); });
      let best: string | null = null, bn = -1, tot = 0, top = 0;
      cw.forEach((n, lab) => { tot += n; if (n > bn) { bn = n; best = lab; } });
      top = bn > 0 ? bn : 0;
      return { label: best, purity: tot > 0 ? top / tot : 0 };
    };
    const items = nodes.map((n) => {
      const g: Record<string, string | null> = {}; let purity = 0;
      GT_TIERS.forEach((t) => { const p = plurality(n.leaf_ids, t); g[t] = p.label; if (t === n.tier) purity = p.purity; });
      n._gt = g; n._purity = purity;
      return { id: n.id, ourLabel: n.identity, gt: g };
    });
    setState({ s: "scoring", done: 0, total: items.length });
    const byId: Record<string, any> = {};
    const B = 14;
    for (let k = 0; k < items.length; k += B) {
      const batch = items.slice(k, k + B);
      try {
        const r = await fetch("/api/kasperov_score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataset: dataset.id, model: run?.model, items: batch }) });
        const d = await r.json().catch(() => ({}));
        (d.results || []).forEach((res: any) => { byId[res.id] = res; });
      } catch { /* leave unscored */ }
      setState({ s: "scoring", done: Math.min(k + B, items.length), total: items.length });
    }
    const scored = nodes.map((n) => {
      const v = byId[n.id];
      const tierV = v?.[n.tier];
      return { ...n, gt: n._gt, purity: n._purity, verdict: tierV, match: tierV?.match === true };
    });
    setRows(scored);
    setState({ s: "done" });
  }

  const agree = rows.filter((r) => r.match).length;
  const scoredN = rows.filter((r) => r.verdict).length;
  const pct = scoredN > 0 ? Math.round((agree / scoredN) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 72, background: PAPER, overflow: "auto" }}>
      <div style={{ position: "sticky", top: 0, height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "#fffdfb", borderBottom: "1px solid #e5e1dc", zIndex: 10 }}>
        <button onClick={onBack} style={btnGhost}>← Back to finale</button>
        <div style={{ fontWeight: 800 }}>🏁 Final assessment · vs ZSCAPE ground truth</div>
        {saveState?.s === "ok" ? <span style={{ fontSize: 11.5, color: "#15803d", fontWeight: 700 }}>✓ {saveState.msg}</span> : null}
        <div style={{ marginLeft: "auto" }}>{endBtn}</div>
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 22px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...RCARD }}>
          <div style={RSEC}>The final test · how well did the labelling system do?</div>
          <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.55, margin: "0 0 12px" }}>
            The finalized run has been <b>appended</b> onto the original 250 leaves (the source run is untouched). Now we score the <b>{nodes.length} consolidated nodes</b> against the authors&apos; published ZSCAPE reference — each node judged at its <b>own operator-assigned tier</b>, with member-leaf ground truth weighted by cell count. The judge accepts synonyms / ontology equivalence, not string match.
          </p>
          {state.s === "idle" ? (
            <button onClick={runJudgement} disabled={!dataset?.groundTruthUrl} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14.5, fontWeight: 800, cursor: dataset?.groundTruthUrl ? "pointer" : "not-allowed", opacity: dataset?.groundTruthUrl ? 1 : 0.5 }}>
              🏁 Score {nodes.length} nodes against ground truth
            </button>
          ) : null}
          {state.s === "loading" ? <div style={{ fontSize: 13, color: "#2563eb" }}>Loading ground truth…</div> : null}
          {state.s === "scoring" ? <div style={{ fontSize: 13, color: "#2563eb" }}>Scoring nodes… {state.done}/{state.total}</div> : null}
          {state.s === "err" ? <div style={{ fontSize: 13, color: "#b91c1c" }}>{state.msg}</div> : null}
        </div>

        {state.s === "done" ? (<>
          <div style={{ ...RCARD, textAlign: "center", padding: "24px 18px" }}>
            <div style={{ fontSize: 13, color: "#9a948c", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Agreement at each node&apos;s own tier</div>
            <div style={{ fontSize: 60, fontWeight: 800, color: pct >= 66 ? "#15803d" : pct >= 40 ? "#b45309" : "#b91c1c", margin: "4px 0 2px", fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
            <div style={{ fontSize: 14, color: "#666" }}>{agree}/{scoredN} nodes match the reference</div>
          </div>
          <div style={{ ...RCARD, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 1.3fr 0.5fr 0.6fr", gap: 0, fontSize: 11, fontWeight: 800, color: "#9a948c", textTransform: "uppercase", letterSpacing: 0.4, background: "#faf7f2", padding: "9px 14px", borderBottom: "1px solid #eee7df" }}>
              <div>our node</div><div>tier</div><div>reference @ tier</div><div>purity</div><div style={{ textAlign: "right" }}>verdict</div>
            </div>
            <div style={{ maxHeight: 460, overflow: "auto" }}>
              {rows.map((r, i) => (
                <div key={r.id} title={r.verdict?.note || ""} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 1.3fr 0.5fr 0.6fr", gap: 0, alignItems: "center", fontSize: 12.5, padding: "8px 14px", borderBottom: "1px solid #f2ede6", background: i % 2 ? "#fffdfb" : "#fff" }}>
                  <div style={{ fontWeight: 700, color: "#33312e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kind === "rebel" ? "⎇ " : "⤵ "}{r.identity} {r.kind === "merge" ? <span style={{ color: "#9a948c", fontWeight: 400 }}>×{r.leaf_ids.length}</span> : null}</div>
                  <div style={{ color: "#0891b2", fontWeight: 700 }}>{TIER_SHORT[r.tier] || r.tier}</div>
                  <div style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.gt?.[r.tier] || <span style={{ color: "#c8c0b6" }}>—</span>}</div>
                  <div style={{ color: "#9a948c", fontVariantNumeric: "tabular-nums" }}>{Math.round((r.purity || 0) * 100)}%</div>
                  <div style={{ textAlign: "right", fontWeight: 800, color: !r.verdict ? "#c8c0b6" : r.match ? "#15803d" : "#b91c1c" }}>{!r.verdict ? "—" : r.match ? "✓" : "✗"}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={RCARD}>
            <div style={RSEC}>⚖️ Judge the final assessment</div>
            <JudgeBox stage="gt_judgement" targetId="gt_final" targetLabel="GT assessment" excerpt={`${agree}/${scoredN} nodes agree (${pct}%)`} judgements={judgements} addJudgement={addJudgement} />
          </div>
        </>) : null}
      </div>
    </div>
  );
}

// Hierarchy tree (SVG cladogram): a trunk of compartments, each a branch coloured
// to MATCH the world map (hue = position*360/nComp). As decisions land, a branch
// fans out into its consolidated nodes — and each node sits at a HORIZONTAL COLUMN
// set by its meaning: coarse tissue nodes sit close to the trunk, finer cell-type
// nodes step out to the right, and set-aside "rebels" break out to their own far
// column. Merges are hue-matched + sized by leaves folded; rebels are blue. Pending
// compartments are faint dashed stubs; the current attention branch is ringed blue.
const HTREE_TIER_X: Record<string, number> = { germ_layer: 108, tissue: 108, cell_type_broad: 156, cell_type_sub: 204 };
function HierarchyTree({ comps, decisions, attention, nextIdx, globalDone, width }: { comps: any[]; decisions: Record<number, any>; attention: number | null; nextIdx: number | null; globalDone: any; width?: number }) {
  const nComp = Math.max(1, comps.length);
  const hueFor = (gi: number) => Math.round((gi * 360) / nComp);
  const svgW = width ?? 340;
  const trunkX = 12, branchX = 66, rebelX = 250;
  const nodeXFor = (nd: any) => nd.kind === "rebel" ? rebelX : (HTREE_TIER_X[nd.tier] || 156);
  const headY = 22;
  let y = headY + 6;
  const rows = comps.map((c: any, gi: number) => {
    const d = decisions[c.index];
    const nodes = d ? [
      ...(d.merges || []).map((m: any) => ({ label: m.node_label, n: m.member_leaf_ids?.length || 1, kind: "merge", tier: m.tier })),
      ...(d.set_aside || []).map((s: any) => ({ label: `leaf ${s.leaf_id}`, n: 1, kind: "rebel", tier: s.tier })),
    ] : [];
    const h = d ? Math.max(22, nodes.length * 13 + 6) : 14;
    const top = y; y += h;
    return { c, gi, d, nodes, top, cy: top + h / 2 };
  });
  const totalH = y + 14;
  // faint column guides + headers so the horizontal axis reads as "coarse → fine"
  const cols = [{ x: HTREE_TIER_X.tissue, label: "tissue" }, { x: HTREE_TIER_X.cell_type_broad, label: "broad" }, { x: HTREE_TIER_X.cell_type_sub, label: "sub" }, { x: rebelX, label: "rebel" }];
  return (
    <svg width={svgW} height={totalH} style={{ display: "block" }}>
      {cols.map((cc) => (
        <g key={cc.label}>
          <line x1={cc.x} y1={headY + 2} x2={cc.x} y2={totalH - 12} stroke={cc.label === "rebel" ? "#dbe4f5" : "#efeae4"} strokeWidth={1} strokeDasharray="2 4" />
          <text x={cc.x} y={12} textAnchor="middle" style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.3, fill: cc.label === "rebel" ? "#2563eb" : "#b0a89e" }}>{cc.label}</text>
        </g>
      ))}
      {rows.length > 1 ? <line x1={trunkX} y1={rows[0].cy} x2={trunkX} y2={rows[rows.length - 1].cy} stroke="#cbd5e1" strokeWidth={2} /> : null}
      {rows.map((r) => {
        const hue = hueFor(r.gi);
        const done = !!r.d;
        const isCur = attention === r.c.index;
        const isNext = nextIdx === r.c.index;
        const col = done ? `hsl(${hue} 55% 45%)` : (isNext ? "#2563eb" : "#cbd5e1");
        return (
          <g key={r.c.index}>
            <path d={`M ${trunkX} ${r.cy} C ${trunkX + 22} ${r.cy}, ${branchX - 22} ${r.cy}, ${branchX} ${r.cy}`} fill="none" stroke={col} strokeWidth={isCur ? 3.5 : done ? 2 : 1.2} strokeDasharray={done ? undefined : "3 3"} opacity={done ? 1 : 0.65} />
            {isCur ? <circle cx={branchX} cy={r.cy} r={7} fill="none" stroke="#2563eb" strokeWidth={1.5} opacity={0.6} /> : null}
            <circle cx={branchX} cy={r.cy} r={isCur ? 4.5 : 3.2} fill={col} stroke="#fff" strokeWidth={1} />
            <text x={trunkX + 1} y={r.cy - 5} style={{ fontSize: 8.5, fontWeight: 800, fill: done ? `hsl(${hue} 45% 36%)` : (isNext ? "#2563eb" : "#9a948c") }}>C{r.c.index}</text>
            {r.nodes.map((nd: any, i: number) => {
              const ny = r.top + 8 + i * 13;
              const nx = nodeXFor(nd);
              const ncol = nd.kind === "rebel" ? "#2563eb" : `hsl(${hue} 62% 48%)`;
              const rad = nd.kind === "rebel" ? 2.6 : Math.min(5.5, 2 + Math.sqrt(nd.n));
              const maxChars = Math.max(5, Math.floor((svgW - nx - 10) / 4.7));
              const raw = String(nd.label);
              const lbl = raw.length > maxChars ? raw.slice(0, maxChars - 1) + "…" : raw;
              return (
                <g key={i}>
                  <path d={`M ${branchX} ${r.cy} C ${branchX + 10} ${r.cy}, ${nx - 8} ${ny}, ${nx} ${ny}`} fill="none" stroke={ncol} strokeWidth={1.1} opacity={0.7} />
                  <circle cx={nx} cy={ny} r={rad} fill={ncol} />
                  <text x={nx + rad + 3} y={ny + 3} style={{ fontSize: 8, fill: "#555" }}>{lbl}{nd.kind === "merge" ? ` ×${nd.n}` : ""}</text>
                </g>
              );
            })}
          </g>
        );
      })}
      {globalDone ? <text x={trunkX} y={totalH - 2} style={{ fontSize: 8.5, fontWeight: 800, fill: "#b45309" }}>∅ audit · {(globalDone.expected_still_missing || []).length} tissues missing</text> : null}
    </svg>
  );
}
