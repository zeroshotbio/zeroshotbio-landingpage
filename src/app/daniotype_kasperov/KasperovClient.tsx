"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KASPEROV_MODELS, DEFAULT_MODEL, estimateCost, projectRunCost, modelInfo, type KasperovModel } from "./models";
import DATASET_FACTS from "./dataset_facts.json";
import HARNESS_REGISTRY from "./harness_registry.json";
import { type AgentMode, type Pt, type Marker, type Cluster, type TierPred, type ClusterConf, type AtlasMeta, type DatasetId, type DatasetDef, type DatasetPartition, type Usage, type TierAgg, type PctCount, type SubStrat, type FailCount, type AbstentionStat, type ClusterVerdict, type RunScore, CONF_TIERS, overallConf } from "./types";
import { PAPER, INK, ACCENT, THEME, confColor, btnPrimary, btnGhost } from "./theme";
// Presentational components shared with the Phase 2 read-only run viewer.
import { UmapCanvas } from "./components/UmapCanvas";
import { CompartmentMap, MapViewSwitch, hasCompartments, type MapView } from "./components/CompartmentMap";
import { AgentMessage, mdFor } from "./components/ChatMessage";
import { MarkersContent } from "./components/MarkersPanel";
import { ConfidenceContent } from "./components/ConfidencePanel";
import { Scorecard } from "./components/Scorecard";
import { MetaReasonerStub } from "./components/MetaReasonerStub";
import { RunViewer } from "./components/RunViewer";
import { ClusteringExplainer, ZscapeClusteringExplainer } from "./components/ClusteringExplainer";
import { HarnessDetail } from "./components/HarnessDetail";
import { useTween } from "./useTween";
import { useAtlas } from "./useAtlas";

// Wizard assets are served statically by nginx (daniotype_data/), NOT by the gated Vercel
// asset route — keeps the Vercel function bundle slim. The browser fetches umap/groundtruth
// cross-origin (nginx sends CORS for www.zeroshot.bio).
// Assets are AUTHORED + patched on this box (zscape.zeroshot.bio, served via nginx
// Option-1 /daniotype_data/). daniotype.zeroshot.bio is a separate snapshot box that
// does NOT receive our patches — pointing there silently drops asset updates (e.g.
// the Meta-Reasoner compartment topology). Verified: this host serves every dataset
// asset (200) with Access-Control-Allow-Origin for www.zeroshot.bio.
const ASSET_BASE = "https://zscape.zeroshot.bio/daniotype_data";
// Rich per-dataset facts generated from the real assets/scorecards/sweeps (scripts/gen_dataset_facts.py)
const FACTS: Record<string, any> = DATASET_FACTS as any;

const MODEL_KEY = "daniotype_kasperov_model"; // selected model persists globally
// Usage, TierAgg, PctCount, SubStrat, FailCount, AbstentionStat, ClusterVerdict, RunScore → ./types

// TierPred, ClusterConf, CONF_TIERS, overallConf → ./types
// PAPER, INK, ACCENT → ./theme
// ---------------------------------------------------------------------------
const STORAGE_BASE = "daniotype_kasperov_v3";
const RESULTS_BASE = "daniotype_kasperov_results"; // full run history: transcripts + markers + confidence
// per-dataset storage so each dataset's run is independent
const storageKey = (d: string) => `${STORAGE_BASE}:${d}`;
const resultsKey = (d: string) => `${RESULTS_BASE}:${d}`;
// stable empty set so the pre-reveal "How we clustered" UMAP shows no validation checkmarks
const EMPTY_VALIDATED: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Dataset registry — each entry points the same wizard at a different atlas.
// ZSCAPE / CHEMFISH carry published cell-type labels (ground truth) we score
// our de-novo names against; MiniFin and MegaFin Part 1 have no published labels.
// ---------------------------------------------------------------------------
// DatasetId, DatasetDef → ./types
const DATASETS: DatasetDef[] = [
  {
    id: "minifin",
    name: "MiniFin",
    tagline: "Parse Evercode · 48 hpf · 94.6k cells · 54 de-novo clusters",
    blurb:
      "Our in-house zebrafish reference (Parse Biosciences Evercode, 43 drug samples). Re-clustered de-novo at Leiden res 1.0 (54 clusters) on a Harmony-integrated embedding (HVG→PCA→Harmony on sample) — same method as MegaFin Part 1, replacing Parse's vendor partition. No external cell-type labels, so the wizard names clusters without a ground-truth score. Provisional — to be regenerated on the de-novo + LOKO STARsolo rebuild.",
    dataUrl: `${ASSET_BASE}/minifin/umap.json`,
    archivistBase: `${ASSET_BASE}/minifin/archivist`,
    groundTruthUrl: null,
    status: "ready",
    approxClusters: 54,
  },
  {
    id: "zscape",
    name: "ZSCAPE Classic",
    tagline: "Saunders et al. · 48 hpf · recursive per-compartment · ~250 leaf-clusters",
    blurb:
      "The Trapnell-lab whole-embryo atlas. We re-cluster from scratch with two-stage recursive per-compartment clustering — recomputing marker genes locally inside each compartment before re-clustering, which surfaces rare tissues a single global pass buries — then name each cluster by a control-cell-only vote, and score against the authors' published germ-layer → tissue → broad → sub labels.",
    dataUrl: `${ASSET_BASE}/zscape_recursive/umap.json`,
    archivistBase: `${ASSET_BASE}/zscape_recursive/archivist`,
    groundTruthUrl: `${ASSET_BASE}/zscape_recursive/groundtruth.json`,
    serveId: "zscape_recursive",
    status: "ready",
    approxClusters: 250,
  },
  {
    id: "chemfish",
    name: "ChemFish",
    tagline: "Barkan et al. · 48 hpf subset · 78 de-novo clusters",
    blurb:
      "Barkan et al. chemical-screen atlas (CHEM10 DSP + CHEM11 BS3). We re-cluster the 48 hpf subset de-novo (HVG→PCA→Harmony on experiment → Leiden res 3.0, 78 clusters) and score against the published labels. GT caveat: ChemFish ships only cell_type + tissue, so the four tiers are projected — cell_type_sub + tissue are native; cell_type_broad is derived (marker-qualifier strip) and germ_layer is an anatomical projection from tissue — not an independent four-tier set.",
    dataUrl: `${ASSET_BASE}/chemfish/umap.json`,
    archivistBase: `${ASSET_BASE}/chemfish/archivist`,
    groundTruthUrl: `${ASSET_BASE}/chemfish/groundtruth.json`,
    status: "ready",
    approxClusters: 78,
  },
  {
    id: "daniocell",
    name: "DanioCell",
    tagline: "Sur et al. (Farrell/NICHD) · 36–72 hpf · 77 de-novo clusters",
    blurb:
      "Independent dense-development atlas (Sur et al., Farrell lab / NICHD). We re-cluster the 36–72 hpf window de-novo (HVG→PCA→Harmony on stage → Leiden res 2.0, 77 clusters) and score against the published labels. Independent-lab CROSS-PLATFORM check: 10X droplet (vs ZSCAPE 10X / ChemFish sci-RNA-seq3 / MiniFin·MegaFin Parse) — a lower score reflects platform/domain shift, not necessarily worse labelling. Strength: DanioCell populations are in-situ-hybridization (ISH) validated. GT tiers: cell_type_sub (clust) + cell_type_broad (tissue.figure) + tissue (tissue.name) are native Farrell labels; germ_layer is an anatomical projection.",
    dataUrl: `${ASSET_BASE}/daniocell/umap.json`,
    archivistBase: `${ASSET_BASE}/daniocell/archivist`,
    groundTruthUrl: `${ASSET_BASE}/daniocell/groundtruth.json`,
    status: "ready",
    approxClusters: 77,
    serveId: "daniocell",
    partitions: [
      { key: "denovo", label: "De-novo Leiden · 77 clusters", serveId: "daniocell",
        dataUrl: `${ASSET_BASE}/daniocell/umap.json`, groundTruthUrl: `${ASSET_BASE}/daniocell/groundtruth.json`,
        approxClusters: 77, tagline: "Sur et al. · 36–72 hpf · 77 de-novo clusters",
        blurb: "We re-cluster the 36–72 hpf cells from scratch — HVG → PCA → Harmony(stage) → Leiden (res 2.0) → 77 clusters — then label those and score against the authors' held-out published labels. An honest from-zero test: the model never sees the published grouping." },
      { key: "native", label: "Authors' native groups · 470 clusters", serveId: "daniocell_native",
        dataUrl: `${ASSET_BASE}/daniocell_native/umap.json`, groundTruthUrl: `${ASSET_BASE}/daniocell_native/groundtruth.json`,
        approxClusters: 470, tagline: "Sur et al. · authors' 470 published cell groups", schemaBasis: "native-schema",
        blurb: "We adopt the authors' own published cell groups as the clusters (their 470 finest 'clust' units) and label those directly — a finer-grained, like-for-like check against the authors' exact schema. Two native tiers: tissue (19) + cell type (43)." },
    ],
  },
  {
    id: "megafin_parse",
    name: "Parse MegaFin Part 1",
    tagline: "Parse Evercode pipeline · 48 hpf · 540.9k cells · 77 Leiden clusters",
    blurb:
      "MegaFin Part 1 — our large-scale drug-screen atlas (96 conditions: 45 small molecules + Sorafenib positive control, each at 1 & 5 µM, plus DMSO-vehicle and egg-water controls; 93 samples after 3 QC removals; 48 hpf TuWT whole embryos, 6 embryos/well, treated 24→48 hpf), as processed by the Parse/Trailmaker pipeline (ENSDARG namespace). De-novo Leiden res 3.0 (77 clusters) on the Parse Harmony embedding. No external cell-type labels — internal, intuition-building. Compare against the Manual build of the same library.",
    dataUrl: `${ASSET_BASE}/megafin/umap.json`,
    archivistBase: `${ASSET_BASE}/megafin/archivist`,
    groundTruthUrl: null,
    status: "ready",
    approxClusters: 77,
  },
  {
    id: "megafin",
    name: "Manual MegaFin Part 1",
    tagline: "Manual .h5ad (Lawson) · 48 hpf · 537.9k cells · 84 de-novo clusters",
    blurb:
      "MegaFin Part 1 — the same drug-screen library (96 conditions: 45 small molecules + Sorafenib positive control at 1 & 5 µM, plus DMSO-vehicle and egg-water controls; 93 samples after 3 QC removals; 48 hpf TuWT) built from the manually-created denoised .h5ad (Lawson LL → ZFIN namespace). De-novo Leiden res 2.0 (84 clusters) on the carried Harmony(sample) embedding. The standard HVG→PCA→Harmony re-embed was tested and rejected (coherence collapsed), so the Parse embedding is retained; honestly less coherent (0.929) than the GT partitions. No external cell-type labels — internal, intuition-building.",
    dataUrl: `${ASSET_BASE}/megafin_rebuild/umap.json`,
    archivistBase: `${ASSET_BASE}/megafin_rebuild/archivist`,
    groundTruthUrl: null,
    status: "ready",
    approxClusters: 84,
  },
];
const DATASET_BY_ID = Object.fromEntries(DATASETS.map((d) => [d.id, d])) as Record<DatasetId, DatasetDef>;
// Card grid order: the three GT benchmarks first, then Parse/Manual MegaFin, MiniFin.
// (The Phase-0→A→B fine-labelled deliverables are NOT separate cards — each surfaces in
// its base dataset's "View Completed Runs" list, appended by the kasperov_runs proxy.)
const DATASET_ORDER: DatasetId[] = ["zscape", "chemfish", "daniocell", "megafin_parse", "megafin", "minifin"];
const ORDERED_DATASETS: DatasetDef[] = DATASET_ORDER.map((id) => DATASET_BY_ID[id]).filter(Boolean);

type Box = { x: number; y: number; w: number; h: number };
// Pt, Marker, Cluster → ./types


// ---------------------------------------------------------------------------
// UMAP canvas — global (world map / HUD) and zoom (focused cluster)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
type Stage = "model" | "harness" | "intro" | "map" | "personas" | "cluster" | "scorecard";

// the from-scratch default for a NEW run's harness step. Defaults to the registry's
// global `active`, EXCEPT where a dataset is pinned below. ZSCAPE new-runs serve
// run_one_cluster (= v1.1's configFingerprint), NOT the headless run_leaf_v2 path that
// the current global active (v1.2) describes — so ZSCAPE defaults to v1.1, the harness
// whose config IS the served path. Global `active` is left untouched (v1.2 stays the
// headless recursive-leaf harness for other contexts).
const HARNESS_DEFAULT_BY_DATASET: Record<string, string> = { zscape: "v2.0" };
function defaultHarness(datasetId?: string) {
  const r: any = HARNESS_REGISTRY;
  const hs: any[] = r.harnesses || [];
  const wantId = (datasetId && HARNESS_DEFAULT_BY_DATASET[datasetId]) || r.active;
  return hs.find((h: any) => h.id === wantId) || hs.find((h: any) => h.id === r.active) || hs[0] || null;
}

// ⚖️ Judgement mode — a "New Run + judgement notes" sweep step-gates after EVERY
// personality turn (Researcher/Archivist/Reasoner) and pops a note box. Each typed
// note becomes a self-contained record logged onto the run JSON (mined later by a
// SEPARATE gated harness pass — nothing here touches the harness).
type Judgement = {
  cluster_id: string;
  cluster_label: string;
  step_index: number; // ordinal of the gated step within this cluster's sweep
  mode: AgentMode | "inputs" | "first_prompt" | null; // step source ("inputs" = system prompt + briefing; "first_prompt" = the literal first question)
  content_excerpt: string; // first chars of what the step produced (self-contained)
  note: string;
  ts: string;
};

export default function KasperovClient() {
  const [dataset, setDataset] = useState<DatasetDef | null>(null);
  // Swap the active clustering partition (e.g. DanioCell de-novo-77 <-> native-470). The run is
  // still STORED under dataset.id; only the SERVED assets/grounding/agent key (serveId) changes.
  // Only offered before labelling starts, so there are no labels to invalidate.
  const choosePartition = (p: DatasetPartition) => {
    setDataset((d) => d ? ({ ...d, dataUrl: p.dataUrl, groundTruthUrl: p.groundTruthUrl, approxClusters: p.approxClusters, serveId: p.serveId, tagline: p.tagline ?? d.tagline, schemaBasis: p.schemaBasis, partitionKey: p.key }) : d);
    setClusteringConfirmed(true); // picking a partition IS confirming the clustering — colors the map + enables proceed
  };
  // Phase 2b "View Completed Runs" read-only path (independent of the wizard):
  // a dataset whose run list is open, and a loaded run being viewed.
  const [viewRunsFor, setViewRunsFor] = useState<DatasetDef | null>(null);
  const [finalizeFor, setFinalizeFor] = useState<DatasetDef | null>(null); // ⚙ Meta-Reasoner Finalize Run picker
  const [viewingRun, setViewingRun] = useState<{ run: any; meta: any; dataset: DatasetDef; finalize?: boolean } | null>(null);
  const { clusters, meta, error } = useAtlas(dataset?.dataUrl ?? null);
  const [stage, setStage] = useState<Stage>("intro");
  const [revealed, setRevealed] = useState(false);
  // step 1 (Clustering): the UMAP starts grey; confirming the clustering colours
  // it in and unlocks "Choose a model →". Reset per dataset (fresh new run).
  const [clusteringConfirmed, setClusteringConfirmed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState(0); // bumping this signals ClusterStage to run auto-pilot
  // tracks the last autoStart value the (re-mountable) ClusterStage has consumed —
  // lives in the PARENT so a plain cluster click (which remounts ClusterStage)
  // can't be mistaken for a fresh auto-pilot trigger.
  const autoConsumedRef = useRef(0);
  // ⚖️ judgement mode: chosen at "New Run", step-gates the sweep + collects notes
  const [judgementMode, setJudgementMode] = useState(false);
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  // ⚖️🧠 Phase-2 meta-reasoner boundary decisions, keyed by just-finished
  // compartmentIndex. Emitted + logged (with the run); does NOT steer the queue yet.
  const [metaDecisions, setMetaDecisions] = useState<Record<number, any>>({});
  const [newRunOpen, setNewRunOpen] = useState(false); // New Run chooser modal
  const [personasSeen, setPersonasSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // timelapse capture mode (set from ?capture=1&dataset=&model= by the EC2 capturer)
  const capParams = useRef<{ on: boolean; ds: string; model: string } | null>(null);
  const [captureDone, setCaptureDone] = useState(false);
  const [captureSaved, setCaptureSaved] = useState(false);
  const capStartedRef = useRef(false);
  const capSavedRef = useRef(false);

  // chat state lives HERE (not in ClusterStage) so it survives map↔cluster
  // navigation — ClusterStage unmounts when you return to the map.
  const [transcripts, setTranscripts] = useState<Record<string, ChatMsg[]>>({});
  const [augmented, setAugmented] = useState<Record<string, Marker[]>>({});
  const [confidence, setConfidence] = useState<Record<string, ClusterConf>>({});
  const [incorporated, setIncorporated] = useState<Set<string>>(new Set());
  // optional free-text note for the NEXT browser autopilot run ("what's special about this run?")
  const [runNote, setRunNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // ⚖️ judgement New Run is gated behind two blocking popups BEFORE the sweep starts:
  // (1) the run-note popup, then (2) the Inputs popup (the full first prompt to the
  // Researcher + a judgement note). The sweep only kicks off on the Inputs popup's
  // Submit + Continue. pendingFirstCluster holds the cluster whose inputs to show.
  const [pendingFirstCluster, setPendingFirstCluster] = useState<Cluster | null>(null);
  const [inputsModal, setInputsModal] = useState<{ clusterId: string; clusterLabel: string; loading: boolean; data: any | null; firstPrompt: string } | null>(null);
  const [loadedNote, setLoadedNote] = useState<string | null>(null); // note of a loaded previous run
  // identity of the run currently being viewed (so the map says WHICH run), titled like Load Previous Run
  const [loadedRun, setLoadedRun] = useState<{ model?: string; nLabelled?: number; scoredAt?: string | null; exportedAt?: string | null; note?: string | null } | null>(null);
  const hydratedRef = useRef<string | null>(null);

  // selected model (global), accumulated token usage per model (per-dataset), and
  // the latest ground-truth scoring (per-dataset) — all carried into the export.
  const [model, setModel] = useState<KasperovModel>(DEFAULT_MODEL);
  // active labelling harness (the loop + grounding rules) — selected after the model.
  // Default to the registry's active version. Recorded in run provenance.
  const [activeHarness, setActiveHarness] = useState<any>(defaultHarness);
  const [usage, setUsage] = useState<Usage>({});
  const [score, setScore] = useState<RunScore>({ verdicts: {}, scoredAt: null, agg: [] });
  const [srvNote, setSrvNote] = useState(""); // transient "Saved to server ✓" message
  // every stage transition should start at the top of the page (fixes landing
  // mid-way down "3. Cell Labelling" after Proceed when the picker was scrolled).
  useEffect(() => { if (typeof window !== "undefined") window.scrollTo(0, 0); }, [stage]);
  const addUsage = useCallback((m: string, inT: number, outT: number) => {
    if (!inT && !outT) return;
    setUsage((u) => ({ ...u, [m]: { in: (u[m]?.in ?? 0) + (inT || 0), out: (u[m]?.out ?? 0) + (outT || 0) } }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_KEY, model);
    } catch {}
  }, [model]);

  // NEW RUN = a naked, from-scratch setup. Picking a dataset clears ALL prior
  // state AND config, and pre-loads NOTHING — no localStorage cache, no server
  // run, no carried model/harness. Every step (clustering → model → harness →
  // chat) starts empty. (Viewing past runs is the separate read-only
  // "View Completed Runs" path; loading one into the wizard is an explicit click.)
  useEffect(() => {
    if (!dataset) return;
    setLoaded(false);
    hydratedRef.current = null;
    setValidated(new Set());
    setLabels({});
    setTranscripts({});
    setAugmented({});
    setConfidence({});
    setIncorporated(new Set());
    setRevealed(false);
    setClusteringConfirmed(false);
    setActiveId(null);
    setLoadedNote(null);
    setLoadedRun(null);
    setStage("map"); // dataset chosen → show "How we clustered" first, then model → harness → chat
    setUsage({});
    setScore({ verdicts: {}, scoredAt: null, agg: [] });
    setModel(DEFAULT_MODEL);          // model step starts fresh — never carried from a prior run/session
    setActiveHarness(defaultHarness(dataset.id)); // harness step starts fresh at this dataset's default (ZSCAPE→v1.1, else global active)
    // wipe any lingering per-dataset cache so nothing from a previous session repopulates a step
    try { localStorage.removeItem(resultsKey(dataset.id)); localStorage.removeItem(storageKey(dataset.id)); } catch {}
    hydratedRef.current = dataset.id;
    setLoaded(true);
  }, [dataset]);

  // persist the full run (debounced); on quota overflow, fall back to markers+confidence only
  useEffect(() => {
    if (!dataset || hydratedRef.current !== dataset.id) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(resultsKey(dataset.id), JSON.stringify({ transcripts, augmented, confidence, usage, score, runMeta: loadedRun }));
      } catch {
        try {
          localStorage.setItem(resultsKey(dataset.id), JSON.stringify({ augmented, confidence, usage, score, runMeta: loadedRun }));
        } catch {}
      }
    }, 800);
    return () => clearTimeout(id);
  }, [transcripts, augmented, confidence, usage, score, dataset, loadedRun]);

  useEffect(() => {
    if (!dataset || !loaded || hydratedRef.current !== dataset.id) return;
    try {
      localStorage.setItem(storageKey(dataset.id), JSON.stringify({ validated: Array.from(validated), labels }));
    } catch {}
  }, [validated, labels, loaded, dataset]);

  function setLabel(id: string, label: string) {
    setLabels((l) => ({ ...l, [id]: label }));
  }

  // one combined run object — cluster labels + ground-truth scores + metadata
  // (model, estimated cost, dates). Reused by export-to-file and (Increment B)
  // save-to-server.
  function buildRunJSON() {
    const cost = estimateCost(usage);
    const labelledN = (clusters ?? []).filter((c) => labels[c.id]).length;
    return {
      schema: "daniotype_kasperov_run/v1",
      dataset: dataset?.name ?? "",
      datasetId: dataset?.id ?? "",
      model,
      cost: { usd: Math.round(cost.usd * 10000) / 10000, estimated: cost.estimated, usage },
      exportedAt: new Date().toISOString(),
      scoredAt: score.scoredAt,
      nLabelled: labelledN,
      nValidated: validated.size,
      note: runNote.trim() || null,
      judgementMode,
      judgements,                 // ⚖️ per-step critique notes (self-contained)
      hasJudgement: judgements.length > 0,
      // ⚖️🧠 Phase-2 boundary brain decisions (structured, GT-blind, cap-enforced)
      metaDecisions: Object.entries(metaDecisions).filter(([, r]: any) => r?.decision).map(([ci, r]: any) => ({
        boundary_after_compartmentIndex: Number(ci),
        action: r.decision.action, target: r.decision.target, rationale: r.decision.rationale,
        expected_still_missing: r.decision.expected_still_missing,
        cap_applied: !!r.guardrails?.capApplied, cap_note: r.guardrails?.capNote ?? null,
        gt_blind: !!r.guardrails?.gtBlind, reasoning_excerpt: (r.reasoning || "").slice(0, 600),
        model: r.usage?.model ?? model,
      })),
      harness: activeHarness ? { id: activeHarness.id, version: activeHarness.version, name: activeHarness.name, gitCommit: activeHarness.gitCommit, stampedAt: activeHarness.stampedAt } : null,
      clusters: (clusters ?? []).map((c) => ({
        id: c.id,
        label: c.label,
        validated: validated.has(c.id),
        finalLabel: labels[c.id] ?? null,
        confidence: confidence[c.id] ?? null,
        addedMarkers: augmented[c.id] ?? [],
        transcript: transcripts[c.id] ?? [],
      })),
      groundTruth: score.scoredAt ? { scoredAt: score.scoredAt, aggregate: score.agg, verdicts: score.verdicts, subStratified: score.subStrat ?? null, abstention: score.abstention ?? null, constrainedAggregate: score.aggConstrained ?? null, constrainedVerdicts: score.verdictsConstrained ?? null, scoring: "driver/v2" } : null,
    };
  }

  // save the combined run to the server store (EC2 worker → EBS volume). Returns
  // true ONLY when the worker actually persisted it (HTTP 2xx + {ok:true}); the
  // judgement confirmation screen relies on this so it can never claim "saved"
  // when the save 503'd / 502'd / threw.
  async function saveRunToServer(): Promise<boolean> {
    if (!dataset) return false;
    setSrvNote("Saving to server…");
    let ok = false;
    try {
      const r = await fetch("/api/kasperov_runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...buildRunJSON(), source: "browser" }),
      });
      if (r.status === 503) setSrvNote("Server store not configured");
      else {
        const d = await r.json().catch(() => ({}));
        ok = r.ok && !!d?.ok;
        setSrvNote(ok ? "Saved to server ✓ (Load Previous Run)" : "Server save failed");
      }
    } catch {
      setSrvNote("Server save failed");
    }
    setTimeout(() => setSrvNote(""), 5000);
    return ok;
  }

  // ⚖️ let the judge keep their own copy of the judgements + the conversations they
  // were made against, as a .json — independent of the server save, so the notes are
  // never lost even if persistence fails.
  function downloadJudgements() {
    if (!dataset) return;
    const run = buildRunJSON();
    const payload = {
      schema: "daniotype_kasperov_judgements/v1",
      dataset: run.dataset,
      datasetId: run.datasetId,
      model: run.model,
      harness: run.harness,
      exportedAt: run.exportedAt,
      nLabelled: run.nLabelled,
      judgements: run.judgements,
      // full per-cluster transcripts = the conversations the notes were made against
      clusters: run.clusters,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daniotype_kasperov_judgements_${dataset.id}_${(run.exportedAt || "run").replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // download the combined run JSON — and also persist it to the server store
  function exportResults() {
    // keep saved runs complete: if the dataset has ground truth and we've labelled
    // but not scored, steer the user to run the comparison first.
    const labelledN = (clusters ?? []).filter((c) => labels[c.id]).length;
    if (dataset?.groundTruthUrl && labelledN > 0 && !score.scoredAt) {
      if (!window.confirm(`This ${dataset.name} run hasn't been compared to the published ground truth yet — the saved file would be incomplete.\n\nFirst, run "Compare to ${dataset.name} ground truth" (the green button below the run summary). Export labels-only anyway?`)) return;
    }
    const blob = new Blob([JSON.stringify(buildRunJSON(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daniotype_kasperov_${dataset?.id ?? "run"}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
    saveRunToServer();
  }

  // Core apply of a run JSON (export/server shape) into THIS dataset's state — no prompts,
  // no alert, no reveal. Used by importResults (interactive) and the server auto-load.
  function applyRun(data: any): number {
    const nLabels: Record<string, string> = {};
    const nConf: Record<string, ClusterConf> = {};
    const nAug: Record<string, Marker[]> = {};
    const nTrans: Record<string, ChatMsg[]> = {};
    const nVal = new Set<string>();
    let loaded = 0;
    for (const c of data.clusters) {
      if (!c || c.id == null) continue;
      const id = String(c.id);
      if (c.finalLabel) {
        nLabels[id] = String(c.finalLabel);
        loaded++;
      }
      if (c.validated) nVal.add(id);
      if (c.confidence && c.confidence.germ_layer && typeof c.confidence.germ_layer.pct === "number") nConf[id] = c.confidence as ClusterConf;
      if (Array.isArray(c.addedMarkers) && c.addedMarkers.length) nAug[id] = c.addedMarkers;
      if (Array.isArray(c.transcript) && c.transcript.length) nTrans[id] = c.transcript;
    }
    setLabels(nLabels);
    setValidated(nVal);
    setConfidence(nConf);
    setAugmented(nAug);
    setTranscripts(nTrans);
    setIncorporated(new Set());
    setJudgements(Array.isArray(data.judgements) ? data.judgements : []);
    setJudgementMode(!!data.judgementMode || (Array.isArray(data.judgements) && data.judgements.length > 0));
    setLoadedNote(typeof data.note === "string" && data.note.trim() ? data.note.trim() : null);
    setLoadedRun({ model: data.model, nLabelled: data.nLabelled, scoredAt: data.groundTruth?.scoredAt ?? data.scoredAt ?? null, exportedAt: data.exportedAt ?? null, note: (typeof data.note === "string" && data.note.trim()) ? data.note.trim() : null });
    // restore run metadata (model, cost/usage, ground-truth scores) when present
    if (data.cost?.usage && typeof data.cost.usage === "object") setUsage(data.cost.usage);
    else setUsage({});
    if ((KASPEROV_MODELS as readonly string[]).includes(data.model)) setModel(data.model as KasperovModel);
    if (data.groundTruth && Array.isArray(data.groundTruth.aggregate)) {
      setScore({ verdicts: data.groundTruth.verdicts ?? {}, scoredAt: data.groundTruth.scoredAt ?? null, agg: data.groundTruth.aggregate, subStrat: data.groundTruth.subStratified ?? null, abstention: data.groundTruth.abstention ?? null, verdictsConstrained: data.groundTruth.constrainedVerdicts ?? undefined, aggConstrained: data.groundTruth.constrainedAggregate ?? undefined });
    } else {
      setScore({ verdicts: {}, scoredAt: null, agg: [] });
    }
    return loaded;
  }

  // re-load a previously exported run (the exportResults shape) into state for THIS
  // dataset — interactive (prompts + reveal + alert).
  function importResults(data: any) {
    if (!dataset) return;
    if (!data || !Array.isArray(data.clusters)) {
      window.alert("That doesn't look like a daniotype run export (no `clusters` array).");
      return;
    }
    if (data.dataset && String(data.dataset).toLowerCase() !== dataset.name.toLowerCase()) {
      if (!window.confirm(`This file was exported from "${data.dataset}", but you're on ${dataset.name}. Import anyway? Cluster ids may not line up.`)) return;
    }
    const hasWork = Object.keys(labels).length > 0 || validated.size > 0;
    if (hasWork && !window.confirm(`Replace the current ${dataset.name} run with the imported one? Your current labels for this dataset will be overwritten.`)) return;
    const loaded = applyRun(data);
    setRevealed(true); // so the cluster grid is visible immediately
    window.alert(`Imported ${loaded} labelled cluster${loaded === 1 ? "" : "s"} into the ${dataset.name} run.`);
  }

  function startAutopilot(withJudgement = false) {
    if (!clusters) return;
    // judgement mode is chosen fresh per New Run; clear any prior notes.
    setJudgementMode(withJudgement);
    if (withJudgement) setJudgements([]);
    // "done" == has a cell-type label (NOT merely validated — a cluster can be
    // validated by hand without a label). Land on the first unlabelled cluster.
    const first = clusters.find((c) => !labels[c.id]) ?? clusters[0];
    setActiveId(first.id);
    setStage("cluster");
    // ⚖️ JUDGEMENT run: do NOT start the sweep yet. Gate it behind the run-note
    // popup, then the Inputs popup; the sweep begins only on Submit + Continue
    // (resolveInputs bumps autoStart). Skip the gating in headless capture mode.
    if (withJudgement && !captureMode) {
      setRunNote("");
      setPendingFirstCluster(first); // which cluster's inputs the Inputs popup shows
      setNoteOpen(true); // step 1 — blocking
      return; // step 2 (Inputs) + the sweep follow from afterRunNote → resolveInputs
    }
    // normal (or capture) New Run: the optional, skippable note is non-blocking and
    // the sweep starts immediately — unchanged behaviour.
    if (!captureMode) { setRunNote(""); setNoteOpen(true); }
    setAutoStart((n) => n + 1);
  }

  // ⚖️ run-note popup resolved (judgement run) → open the Inputs popup. For a normal
  // run pendingFirstCluster is null, so this just records the note (sweep already running).
  function afterRunNote(noteText: string | null) {
    if (noteText != null) setRunNote(noteText.trim());
    setNoteOpen(false);
    if (pendingFirstCluster) openInputsModal(pendingFirstCluster);
  }

  // ⚖️ fetch + assemble the full inputs (real server-side system instructions +
  // briefing + the literal first prompts) and show them in a blocking popup.
  async function openInputsModal(cl: Cluster) {
    setInputsModal({ clusterId: cl.id, clusterLabel: cl.label, loading: true, data: null, firstPrompt: defaultPrompt(cl) });
    try {
      const r = await fetch("/api/kasperov_agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "inputs",
          dataset: dataset?.serveId ?? dataset?.id,
          model,
          cluster: { id: cl.id, label: cl.label, degsUp: cl.degsUp, markers: cl.markers, markersDown: cl.markersDown, nCells: cl.nCells },
        }),
      });
      const d = await r.json();
      setInputsModal((m) => (m && m.clusterId === cl.id ? { ...m, data: d, loading: false } : m));
    } catch (e) {
      setInputsModal((m) => (m && m.clusterId === cl.id ? { ...m, data: { error: String((e as any)?.message ?? e) }, loading: false } : m));
    }
  }

  // ⚖️ Inputs popup resolved → log the first-question judgement + ONE judgement PER
  // personality system prompt the curator critiqued, then START the sweep (the only place
  // the judgement run kicks off).
  function resolveInputs(notes: { sys: { research: string; reason: string; archivist: string; briefing: string } }) {
    const im = inputsModal;
    if (im) {
      const recs: Judgement[] = [];
      const ts = new Date().toISOString();
      const I = im.data?.instructions ?? {};
      const excerptFor: Record<string, string> = { research: `[Researcher system prompt] ` + String(I.research ?? "").slice(0, 560), reason: `[Reasoner system prompt] ` + String(I.reason ?? "").slice(0, 560), archivist: `[Archivist system prompt] ` + String(I.archivist ?? "").slice(0, 560), briefing: `[Briefing & background] ` + String(im.data?.rawFacts ?? im.data?.personasContext ?? "").slice(0, 560) };
      (["research", "reason", "archivist", "briefing"] as const).forEach((k) => {
        const n = notes.sys[k]?.trim();
        if (n) recs.push({ cluster_id: im.clusterId, cluster_label: im.clusterLabel, step_index: 0, mode: "inputs", content_excerpt: excerptFor[k], note: n, ts });
      });
      if (recs.length) setJudgements((prev) => [...prev, ...recs]);
    }
    setInputsModal(null);
    setPendingFirstCluster(null);
    setAutoStart((n) => n + 1); // NOW the Researcher receives the first prompt
  }

  function resetRun() {
    if (typeof window !== "undefined" && !window.confirm("Clear all validations, cell-type labels, and the saved run history? This can't be undone.")) return;
    setValidated(new Set());
    setLabels({});
    setTranscripts({});
    setAugmented({});
    setConfidence({});
    setIncorporated(new Set());
    setJudgements([]);
    setJudgementMode(false);
    try {
      if (dataset) localStorage.removeItem(resultsKey(dataset.id));
    } catch {}
  }

  // pick a cluster → show the personalities primer once, then the chat
  function openCluster(id: string) {
    setActiveId(id);
    setStage(personasSeen ? "cluster" : "personas");
  }

  function markValidated(id: string, yes: boolean) {
    setValidated((prev) => {
      const next = new Set(prev);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // ---- timelapse capture mode (driven by a headless browser on the EC2 box) ----
  // ?capture=1&dataset=<id>&model=<m> auto-runs the in-browser autopilot so the
  // whole sweep can be filmed; window.__kasperov exposes progress to the capturer.
  if (capParams.current === null && typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search);
    capParams.current = { on: q.get("capture") === "1", ds: q.get("dataset") ?? "", model: q.get("model") ?? "" };
  }
  const captureMode = !!capParams.current?.on;

  useEffect(() => {
    if (!captureMode) return;
    if (!dataset) {
      const d = DATASETS.find((x) => x.id === capParams.current!.ds);
      if (d) setDataset(d);
      return;
    }
    if (!clusters) return;
    const wantModel = capParams.current!.model;
    if (wantModel && (KASPEROV_MODELS as readonly string[]).includes(wantModel) && model !== wantModel) {
      setModel(wantModel as KasperovModel);
      return;
    }
    if (!capStartedRef.current) {
      capStartedRef.current = true;
      setRevealed(true);
      setPersonasSeen(true);
      setTimeout(() => startAutopilot(), 2200); // let the map paint before the sweep
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureMode, dataset, clusters, model]);

  // publish progress for the headless capturer to poll. "done" is only reported
  // AFTER the run is saved, so the capturer never closes the tab mid-save.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const total = clusters?.length ?? 0;
    const done = clusters ? clusters.filter((c) => labels[c.id]).length : 0;
    const phase = !captureMode ? "off" : captureSaved ? "done" : captureDone ? "saving" : capStartedRef.current ? "running" : "loading";
    (window as any).__kasperov = { capture: captureMode, phase, done, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureMode, clusters, labels, captureDone, captureSaved]);

  // when the filmed autopilot finishes, persist the run to the EBS store (no
  // dialog) and only THEN mark the capture complete, so "Load Previous Run" has it
  useEffect(() => {
    if (!captureMode || !captureDone || capSavedRef.current) return;
    capSavedRef.current = true;
    (async () => {
      try {
        await saveRunToServer();
      } catch {}
      setCaptureSaved(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureMode, captureDone]);

  if (viewingRun)
    return <RunViewer run={viewingRun.run} meta={viewingRun.meta} dataset={viewingRun.dataset} finalize={viewingRun.finalize} onBack={() => setViewingRun(null)} />;

  if (!dataset)
    return (
      <>
        <DatasetPicker onPick={setDataset} onViewRuns={setViewRunsFor} onFinalize={setFinalizeFor} />
        {viewRunsFor && (
          <RunListModal
            dataset={viewRunsFor}
            onView={(run, m) => { setViewingRun({ run, meta: m, dataset: viewRunsFor }); setViewRunsFor(null); }}
            onClose={() => setViewRunsFor(null)}
          />
        )}
        {finalizeFor && (
          <RunListModal
            dataset={finalizeFor}
            title="⚙ Meta-Reasoner Finalize Run"
            subtitle="Pick a labelled run to finalize — the Meta-Reasoner will consolidate its leaves live. Only compatible runs are shown: many fine leaves labelled, not yet finalized."
            filter={isFinalizable}
            emptyNote="No compatible runs yet. A run qualifies only once it has produced many fine-grained leaf clusters (labelled) and has NOT already been finalized by the Meta-Reasoner. Run a full New Run labelling first (or use the scrubbed fine-leaf run)."
            onView={(run, m) => { setViewingRun({ run, meta: m, dataset: finalizeFor, finalize: true }); setFinalizeFor(null); }}
            onClose={() => setFinalizeFor(null)}
          />
        )}
      </>
    );

  if (stage === "model" || stage === "harness")
    return (
      <ModelHarnessPicker
        dataset={dataset}
        registry={HARNESS_REGISTRY as any}
        currentModel={model}
        currentHarness={activeHarness}
        onProceed={(m, h) => { setModel(m); setActiveHarness(h); setRevealed(true); setStage("map"); }}
        onBack={() => setStage("map")}
      />
    );


  if (!clusters) {
    return (
      <Centered>
        {error ? `Failed to load the atlas: ${error}` : `Loading the ${dataset.name} atlas…`}
      </Centered>
    );
  }

  if (stage === "map")
    return (
      <>
      {newRunOpen && (
        <NewRunModal
          onNormal={() => { setNewRunOpen(false); startAutopilot(false); }}
          onJudgement={() => { setNewRunOpen(false); startAutopilot(true); }}
          onCancel={() => setNewRunOpen(false)}
        />
      )}
      <MapStage
        dataset={dataset}
        clusters={clusters}
        meta={meta}
        revealed={revealed}
        validated={validated}
        onPick={openCluster}
        onAuto={() => setNewRunOpen(true)}
        onExport={exportResults}
        onReset={resetRun}
        onSwitchDataset={() => setDataset(null)}
        onChoosePartition={choosePartition}
        onImport={importResults}
        loadedNote={loadedNote}
        loadedRun={loadedRun}
        labels={labels}
        confidence={confidence}
        model={model}
        onChangeModel={() => setStage("model")}
        clusteringConfirmed={clusteringConfirmed}
        onConfirmClustering={() => setClusteringConfirmed(true)}
        usage={usage}
        score={score}
        setScore={setScore}
        addUsage={addUsage}
        srvNote={srvNote}
      />
      </>
    );

  const active = clusters.find((c) => c.id === activeId)!;

  if (stage === "personas")
    return (
      <Personas
        model={model}
        onContinue={() => {
          setPersonasSeen(true);
          setStage("cluster");
        }}
      />
    );
  return (
    <>
      {noteOpen && <RunNoteModal initial={runNote} onSubmit={(t) => afterRunNote(t)} onSkip={() => afterRunNote(null)} />}
      {inputsModal && <InputsModal modal={inputsModal} onResolve={resolveInputs} />}
    <ClusterStage
      dataset={dataset}
      model={model}
      addUsage={addUsage}
      clusters={clusters}
      active={active}
      validated={validated}
      onBack={() => setStage("map")}
      onValidate={markValidated}
      goToCluster={setActiveId}
      autoStart={autoStart}
      autoConsumedRef={autoConsumedRef}
      onAutoDone={() => setCaptureDone(true)}
      judgementMode={judgementMode}
      addJudgement={(j: Judgement) => setJudgements((prev) => [...prev, j])}
      nJudgements={judgements.length}
      judgements={judgements}
      onLogJudgements={saveRunToServer}
      onDownloadJudgements={downloadJudgements}
      labels={labels}
      onLabel={setLabel}
      transcripts={transcripts}
      setTranscripts={setTranscripts}
      augmented={augmented}
      setAugmented={setAugmented}
      confidence={confidence}
      setConfidence={setConfidence}
      incorporated={incorporated}
      setIncorporated={setIncorporated}
      metaDecisions={metaDecisions}
      onMetaDecision={(comp: number, r: any) => setMetaDecisions((m) => ({ ...m, [comp]: r }))}
    />
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: "#777", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dataset picker — the entry screen: choose which atlas to run the wizard on.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Small uppercase section label shared by the horizontal card bodies.
const CARD_SECLABEL: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#a59f96" };

// Textbook-style explanations (each <=100 words) shown when a card element is
// hovered, so a reader can learn what every figure means without leaving the page.
const TIPS: Record<string, string> = {
  cells: "The number of individual cells profiled in this atlas (after quality filtering). Each cell's RNA is sequenced separately, giving one gene-expression profile per cell — the raw material the labeler reads.",
  clusters: "Cells are grouped into clusters of similar expression by the Leiden algorithm. 'Resolution' is the granularity knob — higher resolution gives more, finer clusters. We pick the finest resolution where clusters still hold together as distinct types.",
  platform: "The single-cell technology used to capture each cell's RNA (e.g. Parse Evercode split-pool, sci-RNA-seq3, or 10X droplets). Different platforms have different biases, so agreement across platforms is a stronger test of a label.",
  source: "The lab (and year) that generated this atlas. Published atlases come with the authors' own cell-type labels; internal atlases do not.",
  genes: "The naming system for genes here. ENSDARG are Ensembl zebrafish gene IDs; we map them to canonical ZFIN gene symbols so marker genes can be looked up and compared consistently across datasets.",
  gtBadge: "Ground-truth benchmark: this atlas ships with the original authors' published cell-type labels, so we can score our blind labels against theirs for real accuracy.",
  internalBadge: "Internal atlas: no published cell-type labels exist, so there is nothing to score accuracy against. Instead we report coverage and grounding — how much got labeled and how well-supported each label is.",
  benchmark: "We re-cluster this atlas from scratch and label it blind, then score our names against the authors' own published labels — in their native label scheme, not ours. A genuine accuracy benchmark: did we recover the biology the original study described?",
  inParadigm: "In-paradigm means the same sequencing platform and label vocabulary as our reference atlas (ZSCAPE). High scores here are 'home turf' — encouraging, but not proof the method generalises to new platforms or labs.",
  independent: "Independent means a different lab and a different platform (10X droplet vs ours). Agreement here is the real test of generalisation, so a somewhat lower score is expected and still meaningful.",
  tierAccuracy: "Identity is judged at several levels of detail, coarse to fine. Each tile is the agreement with the authors' published label at that tier. Accuracy naturally drops as the labels get more specific.",
  bySize: "Clusters are scored in size bands. '≥100 cells' keeps only the larger, more reliable clusters; '≥30' relaxes it; 'all' includes the smallest. Bigger clusters give cleaner marker signal, so accuracy usually rises with size.",
  abstain: "Abstaining means the labeler chose NOT to name a cluster — because the evidence was too weak or the cluster looks like a technical artifact rather than a real cell type. Declining a bad cluster is the correct call, not a failure.",
  precision: "Of the clusters the labeler abstained on, the fraction that were genuinely unlabelable (under-powered or artifacts). High precision means it abstains for good reasons, not at random.",
  coverageSection: "How much of the atlas got labeled and how well-supported those labels are — the read-out we use when there are no published labels to score against.",
  coverage: "Coverage = the share of clusters the labeler actually named instead of abstaining. 95% assigned means it confidently named 95% of clusters and declined the rest as too weak or artifactual.",
  grounded: "Grounding here does NOT mean matching a ground-truth cell type — this atlas has none. Every marker gene the labeler cites as evidence is checked against this cluster's own measured expression (our live :5007 service). '98.5% grounded' = 98.5% of cited markers are confirmed genuinely enriched in those very cells. It is a hallucination check on the evidence, fully defined without any reference labels — the same check runs on the labelled atlases too.",
  tierDepth: "How specific the labels got: how many clusters were resolved all the way to a cell-type name versus only to a broader tissue name. More cell-type-level calls means a more granular, more useful atlas.",
  coherence: "Coherence = the fraction of clusters that carry at least one strongly-enriched, cluster-specific marker gene. Near 1.0 means almost every cluster is biologically distinct and nameable; lower means some clusters lack a clean signature and are harder to label.",
  recipe: "The computational pipeline that produced these clusters: pick highly-variable genes → PCA → Harmony batch-integration → nearest-neighbour graph → Leiden clustering, swept across resolutions to choose the finest one that still holds together.",
  design: "The wet-lab design behind this atlas — the perturbations (drugs and doses), the controls, the zebrafish line, and how the embryos were treated and sequenced. Sample-level facts about the experiment, separate from the clustering.",
  consistencyPrior: "With no ground truth, we compare to our own earlier automated annotation (which is also not truth). Lineage agreement = how often the broad lineage matches. Where they differ, the newer labeler is often the more correct one — read disagreements case by case, not as errors.",
  consistencyCelltype: "Agreement at the fine cell-type level versus the prior automated annotation. It is lower than lineage mainly because the labeler deliberately stays coarse when it cannot ground a specific subtype — a granularity gap, not a wrong call.",
  adjudicationPrior: "For the hardest disagreements we re-checked each cluster's actual marker genes. 'prior-err' = the old annotation was wrong; 'labeler-err' = the new call was wrong; 'amb' = the markers cannot decide. The new labeler was better-supported on most.",
  processingAligned: "Manual and Parse are two processing pipelines run on the SAME cells. Where their clusters line up cleanly (mapping purity ≥0.70), this is how often the labels agree — a test of whether a label survives the processing choice, not of accuracy.",
  // --- provenance explainers (reusable across cards) ---
  provOwnEmbed: "Our embedding and our clustering — HVG → PCA → Harmony → Leiden, built from the counts up. Both the coordinate space and the grouping are ours.",
  provCarriedEmbed: "Our Leiden clustering, but on a carried embedding — we ran our own partition in a coordinate space someone else built (the vendor's or the authors'). The grouping is ours; the space isn't.",
  provVendorPartition: "The provider's own clustering, read as delivered on their embedding — a same-cells, same-space comparison to our own Leiden build.",
  provGtScores: "Accuracy from a separate native-schema run — the wizard labeled the authors' own partition blind, then those names were scored against the authors' published labels. The atlas shown above is a de-novo re-clustering for visualization, not the partition these scores were computed on.",
  provNoGtScores: "No published labels exist here, so there is nothing to score accuracy against — these are coverage + grounding read-outs, not accuracy, and are not comparable to the benchmark cards.",
  provLabelsAreEval: "The names came from a blind labelling run; the published labels (where they exist) were held out and used only to score afterward — evaluation, never supervision.",
  provPartitionId: "partitionId is a fingerprint of the exact clustering these names describe (a hash of the per-cell assignments). Shown for provenance only — this card does not re-verify the hash.",
  provRun: "The labelling run, model and harness that produced these numbers. Open it under View Completed Runs for the full per-cluster transcript and grounding evidence.",
  processingWeighted: "The same agreement, weighted by cell count and across all clusters. It is lower than the aligned figure mainly because the two pipelines cut the cell continuum at different granularities — partition differences, not labels conflicting on the same cells.",
  adjudicationProc: "For the cross-lineage conflicts we adjudicated on the shared cells' markers. 'Parse'/'Manual' = which build's label was better-supported; 'amb' = markers cannot decide. Only 1 of 77 was a flat labeling error — labels are robust to the pipeline.",
};

// View-mode run list (Phase 2b): lists every saved run for ONE dataset and opens
// the chosen one in the read-only RunViewer. Archived runs are off by default,
// revealed by a toggle and badged by reason (quarantined / superseded / other).
// A run is a valid Meta-Reasoner FINALIZE candidate only if it produced many
// fine-grained leaf clusters (labelled) AND has not already been finalized — the
// operator consolidates fresh leaves, so a run that already carries meta-reasoner
// work (or is archived) is not offered again.
function isFinalizable(m: any): boolean {
  const metaDone = m.source === "finalize_append" || (typeof m.note === "string" && /operator proposal|finaliz|meta-reasoner|consolidat/i.test(m.note));
  if (metaDone || m.archived) return false;
  const leaves = Number(m.nLabelled || 0);
  return leaves >= 20 || /scrub|fine[- ]?leaf|leaves/i.test(String(m.note || ""));
}

function RunListModal({ dataset, onView, onClose, title, subtitle, filter, emptyNote }: { dataset: DatasetDef; onView: (run: any, meta: any) => void; onClose: () => void; title?: string; subtitle?: string; filter?: (m: any) => boolean; emptyNote?: string }) {
  const [runs, setRuns] = useState<any[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notconfigured" | "error">("loading");
  const [err, setErr] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    const q = `/api/kasperov_runs?dataset=${encodeURIComponent(dataset.id)}${showArchived ? "&include=archived" : ""}`;
    fetch(q)
      .then(async (r) => {
        if (r.status === 503) { if (alive) setStatus("notconfigured"); return; }
        if (!r.ok) throw new Error(`list ${r.status}`);
        const d = await r.json();
        if (alive) { setRuns(d.runs ?? []); setStatus("ready"); }
      })
      .catch((e) => alive && (setErr(String(e?.message ?? e)), setStatus("error")));
    return () => { alive = false; };
  }, [dataset.id, showArchived]);

  async function open(m: any) {
    setLoadingId(m.runId);
    try {
      const r = await fetch(`/api/kasperov_runs?dataset=${encodeURIComponent(dataset.id)}&id=${encodeURIComponent(m.runId)}`);
      if (!r.ok) throw new Error();
      onView(await r.json(), m);
    } catch {
      window.alert("Couldn't load that run.");
      setLoadingId(null);
    }
  }

  const money = (v: number) => (v < 1 ? v.toFixed(3) : v.toFixed(2));
  const ARCH: Record<string, { bg: string; fg: string; label: string }> = {
    quarantined: { bg: "#fef2f2", fg: "#b91c1c", label: "⚠ quarantined · contaminated" },
    superseded: { bg: "#eef2f6", fg: "#475569", label: "superseded" },
    other: { bg: "#f1ede8", fg: "#7a746c", label: "archived" },
  };
  const archivedCount = (runs || []).filter((m) => m.archived).length;
  // optional compatibility filter (e.g. the finalize picker shows only labelled,
  // not-yet-finalized fine-leaf runs). Archived gating is handled by the API.
  const shown = (runs || []).filter((m) => !filter || filter(m));
  const nHidden = (runs || []).length - shown.length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 720, width: "100%", maxHeight: "82vh", overflow: "auto", padding: "20px 22px", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <strong style={{ fontSize: 16 }}>{title ? `${title} · ${dataset.name}` : `Completed runs · ${dataset.name}`}</strong>
          {subtitle ? <div style={{ fontSize: 12, color: "#7a746c", width: "100%", marginTop: 2 }}>{subtitle}</div> : null}
          <button onClick={onClose} style={{ marginLeft: "auto", ...btnGhost, padding: "5px 11px", fontSize: 13 }}>Close</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#888", marginBottom: 12 }}>{filter ? "Click a run to finalize it — the Meta-Reasoner will consolidate its fine leaves live." : "Click a run to view it read-only — its map, labels, scorecard, and saved transcripts."}</div>

        {status === "loading" && <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>}
        {status === "notconfigured" && (
          <div style={{ color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            The server run store isn&apos;t configured (set <code>KASPEROV_AUTOPILOT_URL</code>).
          </div>
        )}
        {status === "error" && <div style={{ color: "#b91c1c", fontSize: 14 }}>Failed to list runs: {err}</div>}
        {status === "ready" && runs && runs.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>No saved runs for this dataset yet.</div>}
        {status === "ready" && runs && runs.length > 0 && shown.length === 0 && (
          <div style={{ color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>{emptyNote || "No matching runs."}</div>
        )}

        {status === "ready" && (() => {
        // ★ PRIMARY marks only the HEAD of a lineage group (a primary that actually has derived
        // re-posts) — not every self-contained run. So a dataset shows at most one PRIMARY per effort.
        const primaryHeads = new Set(shown.map((x: any) => String(x?.parentRunId || "").split("/").pop()).filter(Boolean));
        return shown.map((m) => {
          const cat = m.archiveCategory || "other";
          // synthetic dev-effort record — not a run; distinct compact row, not clickable
          if (m.recordType === "dev-effort") {
            return (
              <div key={m.runId} style={{ background: "#faf7f0", border: "1px dashed #d8cdb8", borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#7c5e10", background: "#fdf6d8", border: "1px solid #e8cf6b", borderRadius: 99, padding: "1px 8px" }}>⚙ dev-effort</span>
                  <span style={{ fontSize: 12.5, color: "#666" }}>{Number(m.costUsd) > 0 ? `~$${money(Number(m.costUsd))} est.` : "cost n/a"}{m.costSource ? ` · ${String(m.costSource).replace("ledger:multiple", "ledger ×4")}` : ""}</span>
                  {m.parentRunId ? <span style={{ fontSize: 11, color: "#9a948c" }}>child of {String(m.parentRunId).slice(0, 15)}…</span> : null}
                </div>
                {m.note ? <div style={{ fontSize: 12, color: "#7a746c", marginTop: 3, lineHeight: 1.4 }}>{m.note}</div> : null}
              </div>
            );
          }
          // date = the row's main title; cost + a single leaf-count go on a de-emphasised second line.
          const dt = m.exportedAt ? new Date(m.exportedAt) : null;
          const when = dt ? (() => { const d = dt.getDate(); const v = d % 100; const suf = ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"; return `${dt.toLocaleString("en-US", { month: "long" })} ${d}${suf} · ${dt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}`; })() : "date n/a";
          const costStr = Number(m.costUsd) > 0 ? `~$${money(Number(m.costUsd))}${m.costEstimated ? " est." : ""}${m.costSource ? ` · ${String(m.costSource).startsWith("ledger:") ? "ledger" : m.costSource}` : ""}` : "cost n/a";
          const isSmoke = /smoke/i.test(String(m.source ?? "")) || /\bsmoke\b/i.test(String(m.note ?? ""));
          const metaDone = m.source === "finalize_append" || (typeof m.note === "string" && /operator proposal|finaliz|meta-reasoner|consolidat/i.test(m.note));
          const pill = (bg: string, fg: string, bd?: string): React.CSSProperties => ({ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, border: bd ? `1px solid ${bd}` : undefined, borderRadius: 99, padding: "1px 8px" });
          return (
            <div key={m.runId} onClick={() => !loadingId && open(m)} style={{ cursor: loadingId ? "default" : "pointer", background: "#fff", border: `1px solid ${m.archived ? ARCH[cat].fg + "44" : "#e5e1dc"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              {/* DATE is the row title (prominent, top-left); status pills follow. */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#2b2b2b" }}>{when}</span>
                {m.golden ? <span title="The reference 'golden' run for this dataset" style={pill("#fef3c7", "#92400e", "#fcd34d")}>★ GOLDEN</span> : null}
                {String(m.harness?.version) === "zscape-port" ? <span title="Ran the ZSCAPE golden harness (V1.0 port)" style={pill("#fdf6d8", "#7c5e10", "#e8cf6b")}>🏅 Golden Harness V1.0</span> : null}
                {m.lineageRole === "primary" && primaryHeads.has(m.runId) ? <span title="Primary run of this effort — carries its recovered cost; its derived re-posts link here" style={pill("#ecfdf5", "#065f46", "#a7f3d0")}>★ PRIMARY</span>
                  : m.lineageRole === "derived" ? <span title={`Derived re-post${m.parentRunId ? ` of ${String(m.parentRunId).slice(0, 13)}…` : ""} — no additional spend`} style={pill("#f3f4f6", "#6b7280")}>↳ derived</span> : null}
                {m.canonical && m.scoreable === false ? <span title="No coherent asset set for this clustering — it cannot be trusted to score against ground truth" style={pill("#fff7ed", "#9a3412", "#fed7aa")}>⚠ not scoreable</span> : null}
                {isSmoke ? <span title="Smoke test — a few leaves only, not the full atlas" style={pill("#fff7ed", "#b45309", "#fed7aa")}>🧪 smoke test</span> : null}
                {m.harness ? <span title={m.harness.name || undefined} style={String(m.harness.version) === "zscape-gold" ? pill("#fef3c7", "#92400e", "#fcd34d") : pill("#eef2f6", "#475569")}>harness v{m.harness.version}</span> : null}
                {metaDone ? <span title="Meta-Reasoner consolidation has been run on this run" style={pill("#eff6ff", "#2563eb")}>🧠 meta-reasoner</span> : null}
                {m.hasJudgement ? <span title={`${m.nJudgements ?? ""} step critique note${m.nJudgements === 1 ? "" : "s"}`} style={pill("#f3e8ff", "#7c3aed")}>⚖️ judgement{m.nJudgements ? ` · ${m.nJudgements}` : ""}</span> : null}
                {m.schemaBasis ? <span title={m.basisNote || ""} style={pill("#f3e8ff", "#7c3aed")}>{m.schemaBasis}{m.promotedFrom ? " · promoted" : ""}</span> : null}
                {m.archived ? <span style={pill(ARCH[cat].bg, ARCH[cat].fg, ARCH[cat].fg + "33")}>{ARCH[cat].label}</span> : null}
                <span style={{ marginLeft: "auto", fontSize: 12.5, color: ACCENT, fontWeight: 700 }}>{loadingId === m.runId ? "Loading…" : "View →"}</span>
              </div>
              {/* de-emphasised second line: model · single leaf-count · cost */}
              <div style={{ fontSize: 12, color: "#8a847c", marginTop: 4 }}>
                <span style={{ fontWeight: 600, color: "#7a746c" }}>{m.model}</span>
                {m.nLabelled > 0 ? <> · <span style={{ color: "#0f766e", fontWeight: 700 }}>🔬 {m.nLabelled} fine leaves</span></> : null}
                {` · ${costStr}`}{m.hasGroundTruth ? " · scored" : ""}{m.source === "server" ? " · ☁ server" : ""}
              </div>
              {m.note ? <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 3, lineHeight: 1.45 }}>📝 {m.note}</div> : null}
              {m.archived && cat === "quarantined" ? <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 3, lineHeight: 1.4 }}>{m.archivedReason}</div> : null}
            </div>
          );
        });
        })()}

        {status === "ready" && filter && nHidden > 0 && shown.length > 0 ? (
          <div style={{ fontSize: 11.5, color: "#9a948c", marginTop: 8, fontStyle: "italic" }}>{nHidden} other run{nHidden === 1 ? "" : "s"} hidden — not compatible (already finalized, or no fine leaves labelled).</div>
        ) : null}
        {status === "ready" && !filter && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, color: "#666", cursor: "pointer" }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived runs{!showArchived ? " (superseded / quarantined / other)" : archivedCount ? ` — ${archivedCount} shown, badged` : " — none"}
          </label>
        )}
      </div>
    </div>
  );
}

// Hover tooltip wrapper — wraps any inline element and shows its explanation on hover.
function Tip({ text, children, style, block }: { text?: string; children: React.ReactNode; style?: React.CSSProperties; block?: boolean }) {
  const [show, setShow] = useState(false);
  if (!text) return <>{children}</>;
  return (
    <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ position: "relative", display: block ? "flex" : "inline-flex", cursor: "help", ...style }}>
      {children}
      {show && (
        <span style={{ position: "absolute", bottom: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)", zIndex: 60, width: 232, background: "#1f2937", color: "#eef1f4", fontSize: 11, fontWeight: 400, fontStyle: "normal", lineHeight: 1.5, textTransform: "none", letterSpacing: 0, textAlign: "left", padding: "9px 11px", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.28)", pointerEvents: "none", whiteSpace: "normal" }}>{text}</span>
      )}
    </span>
  );
}


function DatasetPicker({ onPick, onViewRuns, onFinalize }: { onPick: (d: DatasetDef) => void; onViewRuns: (d: DatasetDef) => void; onFinalize: (d: DatasetDef) => void }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1120, padding: "72px 28px 60px", width: "100%" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov</div>
        <h1 style={{ fontSize: 38, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.1 }}>Choose a dataset to label</h1>
        <p style={{ fontSize: 16.5, color: "#555", lineHeight: 1.55, margin: "0 0 30px", maxWidth: 720 }}>
          Run the same human–AI labelling wizard on any of these zebrafish single-cell atlases. Where the authors
          published their own cell-type labels, you can score our de-novo names against that ground truth when the run
          completes.
        </p>
        {(() => {
          const renderCard = (d: DatasetDef) => {
            const ready = d.status === "ready";
            const f: any = FACTS[d.id];
            const isGt = f?.role === "gt";
            const cellsTip = f?.subsample ? `${TIPS.cells} ${f.subsample}` : TIPS.cells;
            const hasFull = !!(f && f.fullCells && f.fullCells > f.cells);
            const ident: { a: string; b: string; aTip?: string; bTip?: string }[] | null = f ? [
              { a: `${(f.cells as number).toLocaleString()} cells`, b: hasFull ? `of ${(f.fullCells as number).toLocaleString()} total` : `${f.clusters} clusters · res ${f.resLabel}`, aTip: cellsTip, bTip: hasFull ? cellsTip : TIPS.clusters },
              ...(hasFull ? [{ a: `${f.clusters} clusters`, b: `res ${f.resLabel}`, aTip: TIPS.clusters }] : []),
              { a: f.platform, b: `${f.lab}${f.year ? " · " + f.year : ""}`, aTip: TIPS.platform, bTip: TIPS.source },
              { a: "genes", b: f.namespace, aTip: TIPS.genes, bTip: TIPS.genes },
            ] : null;
            return (
              <div
                key={d.id}
                style={{
                  textAlign: "left",
                  background: ready ? "#fffdfb" : "#f3f0ec",
                  border: `1px solid ${ready ? "#e5e1dc" : "#e9e5df"}`,
                  borderLeft: `3px solid ${ready ? (isGt ? "#15803d" : ACCENT) : "#cfcac4"}`,
                  borderRadius: 12,
                  padding: "15px 17px",
                  opacity: ready ? 1 : 0.7,
                  color: INK,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "stretch",
                  gap: 16,
                  width: "100%",
                }}
              >
                {/* identity rail */}
                <div style={{ width: 224, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{d.name}</span>
                    {!ready && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#926a1a", background: "#fef3c7", borderRadius: 99, padding: "2px 8px" }}>soon</span>}
                  </div>
                  {ident && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", fontSize: 11, color: "#555", lineHeight: 1.45 }}>
                      {ident.map((r, i) => (
                        <React.Fragment key={i}>
                          <Tip text={r.aTip} style={{ justifySelf: "start" }}><span style={{ fontWeight: 700, color: "#3f3a34", borderBottom: r.aTip ? "1px dotted #cfc8bf" : "none" }}>{r.a}</span></Tip>
                          {r.bTip
                            ? <Tip text={r.bTip} style={{ justifySelf: "end" }}><span style={{ color: "#7a746c", textAlign: "right", borderBottom: "1px dotted #d8d2c9" }}>{r.b}</span></Tip>
                            : <span style={{ color: "#7a746c", textAlign: "right", justifySelf: "end" }}>{r.b}</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  {/* two paths live under the identity, so hovering the card for tooltips never navigates */}
                  {ready && (
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => onPick(d)} title={`Start a new ${d.name} run (clustering → model → harness → chat)`} style={{ alignSelf: "stretch", background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>＋ NEW RUN</button>
                      <button onClick={() => onFinalize(d)} title={`Finalize a labelled ${d.name} run — run the Meta-Reasoner live to consolidate its leaves`} style={{ alignSelf: "stretch", background: "#0891b2", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>＋＋ META-REASONER</button>
                      <button onClick={() => onViewRuns(d)} title={`Browse completed ${d.name} runs (read-only)`} style={{ alignSelf: "stretch", background: "#fff", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 9, padding: "9px 0", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>▤ VIEW COMPLETED RUNS</button>
                    </div>
                  )}
                </div>

                {/* content area — a plain high-level summary for every dataset */}
                <div style={{ flex: 1, alignSelf: "center", fontSize: 13, color: "#5a544c", lineHeight: 1.6 }}>{d.blurb}</div>
              </div>
            );
          };
          const gtDs = ORDERED_DATASETS.filter((d) => (FACTS[d.id] as any)?.role === "gt");
          const order = ["megafin", "megafin_parse", "minifin"];
          const internalDs = ORDERED_DATASETS.filter((d) => (FACTS[d.id] as any)?.role !== "gt")
            .sort((a, b) => ((order.indexOf(a.id) + 1) || 99) - ((order.indexOf(b.id) + 1) || 99));
          const gridStyle = { display: "flex", flexDirection: "column", gap: 14 } as const;
          const hdr = { fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#3f3a34", fontWeight: 700, margin: "8px 0 12px" };
          return (
            <>
              <div style={hdr}>Atlases with published labels</div>
              <div style={gridStyle}>{gtDs.map(renderCard)}</div>
              <div style={{ ...hdr, marginTop: 34 }}>Internal atlases</div>
              <div style={gridStyle}>{internalDs.map(renderCard)}</div>
            </>
          );
        })()}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Model & Harness picker — STEP 2 of the new run: pick the model AND the
// labelling harness on one page, then proceed to cell labelling.
// ---------------------------------------------------------------------------
function ModelHarnessPicker({ dataset, registry, currentModel, currentHarness, onProceed, onBack }: { dataset: DatasetDef; registry: any; currentModel: KasperovModel; currentHarness: any; onProceed: (m: KasperovModel, h: any) => void; onBack: () => void }) {
  const [model, setModel] = useState<KasperovModel>(currentModel);
  const [harness, setHarness] = useState<any>(currentHarness);
  const n = dataset.approxClusters;
  // dataset-scoped: a harness with `appliesTo` shows only for those datasets (e.g. the
  // DanioCell-specific two-tier harness); generic harnesses (no appliesTo) show everywhere.
  const harnesses: any[] = (registry?.harnesses || []).filter((h: any) => !h.appliesTo || h.appliesTo.includes(dataset.id));
  const tierShort = (l: string) => l.replace("Cell type — ", "").replace("Germ layer", "germ").replace("Tissue", "tissue").toLowerCase();
  const secHead: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: "8px 0 4px" };
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1160, padding: "56px 28px 56px", width: "100%" }}>
        <button onClick={onBack} style={{ ...btnGhost, marginBottom: 16, padding: "7px 13px", fontSize: 13 }}>← 1. Clustering</button>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov · {dataset.name}</div>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: "8px 0 4px", lineHeight: 1.1 }}>2. Model &amp; Harness</h1>
        <p style={{ fontSize: 15.5, color: "#555", lineHeight: 1.5, margin: "0 0 20px", maxWidth: 760 }}>
          Choose the <strong>model</strong> that drives every personality and the scoring, and the <strong>harness</strong> — the labelling loop + grounding rules. Both are recorded in the saved run.
        </p>

        <h2 style={secHead}>Model</h2>
        <p style={{ fontSize: 13, color: "#777", margin: "0 0 10px" }}>{dataset.id === "zscape"
          ? <>Cost is a rough projection across the current {dataset.name} partition (~{n} clusters); the partition is being re-cut, so this will shift. You can switch models later on the world map.</>
          : <>Cost is a rough projection for labelling all ~{n} {dataset.name} clusters; you can switch models later on the world map.</>}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {KASPEROV_MODELS.map((m) => {
            const info = modelInfo(m); const cost = projectRunCost(m, n); const selected = m === model;
            const tierColor = info.tier === "base" ? "#15803d" : info.tier === "mini" ? ACCENT : "#a16207";
            return (
              <button key={m} onClick={() => setModel(m)} style={{ textAlign: "left", background: selected ? "#eef7f9" : "#fffdfb", border: `1px solid ${selected ? ACCENT : "#e5e1dc"}`, borderTop: `3px solid ${tierColor}`, borderRadius: 11, padding: "11px 14px 12px", cursor: "pointer", color: INK, display: "flex", flexDirection: "column", gap: 4, minHeight: 124 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700 }}>{m}</span>
                  {selected && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: ACCENT, background: "#dbeef2", borderRadius: 99, padding: "1px 7px" }}>selected</span>}
                  <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: tierColor, background: `${tierColor}1a`, borderRadius: 99, padding: "1px 7px" }}>{info.tierLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.45 }}>{info.strength}</div>
                <div style={{ marginTop: "auto", paddingTop: 5, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: tierColor, fontVariantNumeric: "tabular-nums" }}>~${cost.toFixed(2)}</span>
                  <span style={{ fontSize: 11, color: "#999" }}>est. full run ({n})</span>
                </div>
              </button>
            );
          })}
        </div>

        <h2 style={{ ...secHead, marginTop: 24 }}>Harness</h2>
        <p style={{ fontSize: 13, color: "#777", margin: "0 0 12px" }}>Pick the labelling loop on the left; its three personalities are on the right. Each version is stamped and carries its verification history.</p>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* LEFT — harness options as a column */}
          <div style={{ flex: "1 1 320px", minWidth: 300, maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
          {harnesses.map((h) => {
            const sel = harness?.id === h.id; const v = h.verification || {}; const prov = v.provenance || {};
            return (
              <button key={h.id} onClick={() => setHarness(h)} style={{ textAlign: "left", background: sel ? "#eef7f9" : "#fffdfb", border: `1px solid ${sel ? ACCENT : "#e5e1dc"}`, borderTop: `3px solid ${ACCENT}`, borderRadius: 12, padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 9, cursor: "pointer", color: INK, boxShadow: sel ? `0 0 0 2px ${ACCENT}22` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>Harness v{h.version}</span>
                  <span style={{ fontSize: 13, color: "#7a746c" }}>· {h.name}</span>
                  {sel && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: ACCENT, background: "#dbeef2", borderRadius: 99, padding: "2px 8px" }}>selected</span>}
                  {registry.active === h.id && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d", background: "#dcfce7", borderRadius: 99, padding: "2px 8px" }}>✓ active</span>}
                </div>
                <div style={{ fontSize: 11, color: "#9a948c", fontFamily: "monospace" }}>stamped {String(h.stampedAt).slice(0, 10)} · commit {h.gitCommit} · {h.model}</div>
                <div style={{ fontSize: 11.5, color: "#5a544c", lineHeight: 1.5 }}>{h.summary}</div>
                {(v.gt?.length || v.benchmark) ? (
                <div style={{ background: "#faf8f5", border: "1px solid #ece8e2", borderRadius: 9, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c" }}>Verified on {(v.gt || []).length} ground-truth atlases</div>
                  {(v.gt || []).map((g: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, display: "flex", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: "#3f3a34", width: 70, flexShrink: 0, textTransform: "capitalize" }}>{g.dataset}</span>
                      <span style={{ color: "#6b655d" }}>{(g.tiers || []).map((t: any) => `${tierShort(t.label)} ${Math.round(t.pct)}`).join(" · ")}</span>
                    </div>
                  ))}
                  {(v.gt?.length) ? <div style={{ fontSize: 9.5, color: "#9a948c", fontStyle: "italic" }}>single draw · ±~3pt judge band (see judge note below)</div> : null}
                  {v.benchmark ? <div style={{ fontSize: 10, color: "#7a746c", marginTop: 1 }}>{v.benchmark}</div> : null}
                  {(v.noGt || []).length ? <div style={{ fontSize: 10, color: "#7a746c" }}>+ {(v.noGt || []).map((nn: any) => nn.dataset).join(" / ")} no-GT (coverage/grounding{(v.noGt || []).some((nn: any) => nn.processingConsistency) ? " + processing-consistency" : ""})</div> : null}
                  {(prov.runs || prov.totalCostUsd != null) ? <div style={{ fontSize: 10, color: "#9a948c" }}>provenance: {(prov.runs || []).length} labelled runs{prov.totalCostUsd != null ? ` · $${prov.totalCostUsd}` : ""}</div> : null}
                </div>
                ) : (
                  <div style={{ fontSize: 10.5, color: "#9a948c", fontStyle: "italic", padding: "2px 1px" }}>No ground-truth scorecard on this harness version.</div>
                )}
              </button>
            );
          })}
          </div>
          {/* RIGHT — the three personalities of the selected harness */}
          <div style={{ flex: "1 1 480px", minWidth: 320 }}>
            <HarnessDetail harness={harness} />
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <button onClick={() => model && harness && onProceed(model, harness)} disabled={!model || !harness} style={{ background: model && harness ? ACCENT : "#cdd5cf", color: "#fff", border: "none", borderRadius: 10, padding: "13px 26px", fontSize: 16, fontWeight: 700, cursor: model && harness ? "pointer" : "not-allowed" }}>
            Proceed to 3. Cell Labelling →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalities primer (shown once before the chat) + pixel-art icons
// ---------------------------------------------------------------------------
function PixelIcon({ rows, color, size = 80 }: { rows: string[]; color: string; size?: number }) {
  const n = rows.length;
  const cells: React.ReactNode[] = [];
  rows.forEach((row, y) =>
    row.split("").forEach((ch, x) => {
      if (ch === ".") return;
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={ch === "o" ? "#2b2b2b" : color} />);
    })
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      {cells}
    </svg>
  );
}

// 12×12 pixel glyphs
const PIX_RESEARCHER = [
  ".xxxx.......",
  "x....x......",
  "x....x......",
  "x....x......",
  ".xxxx.......",
  ".....xx.....",
  "......xx....",
  ".......xx...",
  "........xx..",
  ".........xx.",
  "..........x.",
  "............",
];
const PIX_ARCHIVIST = [
  "............",
  "...xxxx.....",
  "..xxxxxxxxx.",
  ".xxxxxxxxxxx",
  ".x.........x",
  ".x..oooo...x",
  ".x.........x",
  ".x..oooo...x",
  ".x.........x",
  ".x..oooo...x",
  ".xxxxxxxxxxx",
  "............",
];
const PIX_REASONER = [
  "....xxx.....",
  "...x...x....",
  "..x..o..x...",
  "..x.ooo.x...",
  "..x..o..x...",
  "...x.o.x....",
  "...x.o.x....",
  "....xxx.....",
  "....x.x.....",
  ".....x......",
  "....ooo.....",
  "....ooo.....",
];

function Personas({ onContinue, model }: { onContinue: () => void; model: string }) {
  const cards = [
    { mode: "reason" as AgentMode, pix: PIX_REASONER, blurb: "Your partner. Synthesises everything, judges when you're done, and offers one-click prompts to send the other two." },
    { mode: "research" as AgentMode, pix: PIX_RESEARCHER, blurb: "Searches ZFIN, ZFA & GO for grounded, cited evidence." },
    { mode: "archivist" as AgentMode, pix: PIX_ARCHIVIST, blurb: "Pulls raw MiniFin values — stats, specificity, p-values, co-expression." },
  ];
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 880, padding: "60px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#999", fontWeight: 600 }}>Your three specialists</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 4px" }}>One {model}, three personalities</h1>
        <p style={{ fontSize: 15, color: "#666", maxWidth: 700, margin: "0 auto 26px", lineHeight: 1.55 }}>
          Each specialist has its own input line below the chat — ask any of them directly, any time. Lean on the{" "}
          <strong style={{ color: THEME.reason.color }}>Reasoner</strong> as your partner: it reads the evidence, judges when you&apos;re
          done, and offers one-click prompts to send the <strong style={{ color: THEME.research.color }}>Researcher</strong> and{" "}
          <strong style={{ color: THEME.archivist.color }}>Archivist</strong>.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {cards.map(({ mode, pix, blurb }) => {
            const th = THEME[mode];
            return (
              <div key={mode} style={{ flex: "1 1 240px", maxWidth: 260, background: th.bg, border: `1px solid ${th.color}44`, borderTop: `3px solid ${th.color}`, borderRadius: 12, padding: "20px 18px" }}>
                <PixelIcon rows={pix} color={th.color} />
                <div style={{ fontSize: 17, fontWeight: 700, color: th.color, marginTop: 8 }}>{th.name}</div>
                <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, marginTop: 6 }}>{blurb}</div>
              </div>
            );
          })}
        </div>
        <button
          onClick={onContinue}
          style={{ marginTop: 30, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px 30px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
        >
          Enter the cluster →
        </button>
      </div>
    </div>
  );
}

const PIX_BY_MODE: Record<AgentMode, string[]> = { reason: PIX_REASONER, research: PIX_RESEARCHER, archivist: PIX_ARCHIVIST };

// one labelled, colour-coded personality input line (gated until unlocked)
function AskLine({
  mode,
  value,
  setValue,
  onSend,
  enabled,
  locked,
}: {
  mode: AgentMode;
  value: string;
  setValue: (s: string) => void;
  onSend: () => void;
  enabled: boolean;
  locked: boolean;
}) {
  const th = THEME[mode];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: locked ? 0.55 : 1 }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} title={th.name}>
        <PixelIcon rows={PIX_BY_MODE[mode]} color={locked ? "#b0a99f" : th.color} size={22} />
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && enabled && onSend()}
        placeholder={locked ? `${th.name} — unlocks when the Reasoner calls for it` : `Ask the ${th.name}…`}
        disabled={!enabled}
        style={{
          flex: 1,
          padding: "8px 10px",
          border: `1px solid ${locked ? "#d8d3cd" : th.color + "66"}`,
          borderLeft: `3px solid ${locked ? "#cfcac4" : th.color}`,
          borderRadius: 8,
          fontSize: 13,
          fontFamily: "inherit",
          background: enabled ? "#fff" : "#f3f0ec",
        }}
      />
      <button
        onClick={onSend}
        disabled={!enabled || !value.trim()}
        title={locked ? "Locked" : `Send to the ${th.name}`}
        style={{
          flexShrink: 0,
          background: enabled && value.trim() ? th.color : "#fff",
          color: enabled && value.trim() ? "#fff" : "#bbb",
          border: `1px solid ${enabled && value.trim() ? th.color : "#d8d3cd"}`,
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: enabled && value.trim() ? "pointer" : "default",
        }}
      >
        {locked ? "🔒" : "→"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Optional, skippable "what's special about this run?" popup. Non-blocking: the run
// is already underway; this just attaches a free-text note (or skips). Shared by the
// browser AutoPilot button and the server persistent button.
function RunNoteModal({ initial, onSubmit, onSkip, title }: { initial?: string; onSubmit: (note: string) => void; onSkip: () => void; title?: string }) {
  const [v, setV] = useState(initial ?? "");
  return (
    <div onClick={onSkip} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 480, width: "100%", padding: "20px 22px", textAlign: "left" }}>
        <strong style={{ fontSize: 16 }}>{title ?? "What's special about this run?"}</strong>
        <div style={{ fontSize: 13, color: "#666", margin: "6px 0 10px", lineHeight: 1.5 }}>Optional — the run is already underway. Note what to remember it by (a hypothesis, a model/partition tweak, etc.), or skip.</div>
        <textarea value={v} onChange={(e) => setV(e.target.value)} autoFocus rows={4} placeholder="e.g. first full-loop run on the new 54-cluster partition" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e5e1dc", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={onSkip} style={{ ...btnGhost, padding: "8px 14px", fontSize: 13 }}>Skip</button>
          <button onClick={() => onSubmit(v.trim())} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Attach note</button>
        </div>
      </div>
    </div>
  );
}

// New Run chooser — normal vs ⚖️ judgement (step-gated critique-note capture).
function NewRunModal({ onNormal, onJudgement, onCancel }: { onNormal: () => void; onJudgement: () => void; onCancel: () => void }) {
  const card: React.CSSProperties = { textAlign: "left", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px", cursor: "pointer", background: "#fffdfb", flex: 1, minWidth: 220 };
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 600, width: "100%", padding: "20px 22px" }}>
        <strong style={{ fontSize: 17 }}>Start a New Run</strong>
        <div style={{ fontSize: 13, color: "#666", margin: "6px 0 14px", lineHeight: 1.5 }}>Both run the same AutoPilot labeller across every cluster. Judgement mode pauses after every personality step so you can log a critique note.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div onClick={onNormal} style={card} onMouseEnter={(e) => (e.currentTarget.style.borderColor = THEME.reason.color)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e1dc")}>
            <div style={{ fontSize: 15, fontWeight: 800, color: THEME.reason.color }}>🤖 New Run (normal)</div>
            <div style={{ fontSize: 12.5, color: "#5a544c", lineHeight: 1.5, marginTop: 4 }}>The standard AutoPilot sweep — runs straight through and labels every cluster.</div>
          </div>
          <div onClick={onJudgement} style={card} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7c3aed")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e1dc")}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#7c3aed" }}>⚖️ New Run + judgement notes</div>
            <div style={{ fontSize: 12.5, color: "#5a544c", lineHeight: 1.5, marginTop: 4 }}>Same sweep, but it <b>pauses after every step</b> (Researcher / Archivist / Reasoner) so you can hit OK or type a critique note. Notes are saved on the run and marked with a ⚖️ pill.</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onCancel} style={{ ...btnGhost, padding: "8px 14px", fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── shared judgement-UI helpers ───────────────────────────────────────────────
// rich markdown (tables, headings, links) using the same renderer as the chat
function RichMD({ children, mode = "reason" }: { children: string; mode?: AgentMode }) {
  return <div style={{ fontSize: 12.5, color: "#3f3a33", lineHeight: 1.55 }}><ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode) as any}>{children || "_(empty)_"}</ReactMarkdown></div>;
}
// drop the hidden ```kasperov-*``` fences so step content reads as prose + tables
const stripFences = (s: string) => (s || "").replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim();

function Collapsible({ title, badge, defaultOpen = false, accent = "#8a847b", children }: { title: React.ReactNode; badge?: string; defaultOpen?: boolean; accent?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e8e3dd", borderRadius: 10, marginBottom: 8, overflow: "hidden", background: "#fff" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: open ? "#faf8f6" : "#fff", border: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}>
        <span style={{ fontSize: 10, color: accent, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform .15s" }}>▶</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#2a2620" }}>{title}</span>
        {badge ? <span style={{ fontSize: 10.5, color: "#9a938a", marginLeft: "auto" }}>{badge}</span> : null}
      </button>
      {open ? <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #f0ece7" }}>{children}</div> : null}
    </div>
  );
}

function NoteField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#7c3aed", marginBottom: 5 }}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} style={{ width: "100%", boxSizing: "border-box", minHeight: 90, border: "1px solid #e5e1dc", borderRadius: 8, padding: "11px 13px", fontSize: 13.5, lineHeight: 1.55, resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );
}


// small key/value table for the GT-blind cluster object + tools/model params
function KVTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div style={{ border: "1px solid #e2ded8", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} style={{ borderTop: i ? "1px solid #f0ece7" : "none" }}>
              <td style={{ padding: "6px 10px", color: "#7a736a", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top", width: 130, background: "#faf8f6" }}>{k}</td>
              <td style={{ padding: "6px 10px", color: "#2a2620", lineHeight: 1.5 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputsQuote: React.CSSProperties = { fontSize: 13.5, color: "#2a2620", background: "rgba(124,58,237,0.05)", borderLeft: "3px solid #7c3aed", borderRadius: 6, padding: "11px 13px", lineHeight: 1.6 };

// In-chat disclosure on the FIRST "You asked" message: makes it obvious the model also
// carries a separate system prompt + briefing (not shown in the chat), and lets you read
// the real verbatim text on demand (lazy-fetched from the action:"inputs" endpoint).
function SystemPromptDisclosure({ datasetId, model, cluster }: { datasetId: string; model: string; cluster: Cluster }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    if (data || loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/kasperov_agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "inputs", dataset: datasetId, model, cluster: { id: cluster.id, label: cluster.label, degsUp: cluster.degsUp, markers: cluster.markers, markersDown: cluster.markersDown, nCells: cluster.nCells } }) });
      setData(await r.json());
    } catch (e) {
      setData({ error: String((e as any)?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => { setOpen((o) => !o); load(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#f3e8ff", border: "1px solid #e6d8fb", borderRadius: 99, padding: "3px 11px", cursor: "pointer" }}>
        🔧 {open ? "Hide" : "Show"} the system prompt the model also received
      </button>
      {open ? (
        <div style={{ marginTop: 8, border: "1px solid #e8e3dd", borderRadius: 10, padding: "10px 12px", background: "#fffdfb" }}>
          <div style={{ fontSize: 11.5, color: "#777", marginBottom: 8, lineHeight: 1.5 }}>The text above (“You asked”) is your <b>question</b>. Separately, the model carries this <b>system prompt</b> + briefing on every turn — it’s not shown in the chat. (You already reviewed and judged these at the start.)</div>
          {loading ? <div style={{ fontSize: 12, color: "#9a938a" }}>Loading…</div> : data?.error ? <div style={{ fontSize: 12, color: "#8a5a00" }}>Couldn’t load ({String(data.error)}).</div> : data ? (
            <>
              <Collapsible title="🔬 Researcher — system prompt" defaultOpen accent={THEME.research.color}><RichMD mode="research">{data.instructions?.research ?? "(unavailable)"}</RichMD></Collapsible>
              <Collapsible title="🧠 Reasoner — system prompt" accent={THEME.reason.color}><RichMD mode="reason">{data.instructions?.reason ?? "(unavailable)"}</RichMD></Collapsible>
              <Collapsible title="📚 Archivist — system prompt" accent={THEME.archivist.color}><RichMD mode="archivist">{data.instructions?.archivist ?? "(unavailable)"}</RichMD></Collapsible>
              <Collapsible title="🧾 Briefing & raw facts" accent="#8a847b"><RichMD mode="archivist">{data.rawFacts ?? "(unavailable)"}</RichMD></Collapsible>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ⚖️ Pre-run INPUTS popup — the SECOND blocking popup, after the run-note popup. The two
// things the model receives are shown as DISTINCT, individually-judgeable parts: (1) the
// literal first question ("You asked"), and (2) the system prompt + briefing it always
// carries — organised into collapsible, rich-text sections. The sweep starts only on a
// button click.
function InputsModal({ modal, onResolve }: { modal: { clusterId: string; clusterLabel: string; loading: boolean; data: any | null; firstPrompt: string }; onResolve: (notes: { sys: { research: string; reason: string; archivist: string; briefing: string } }) => void }) {
  const [sys, setSys] = useState({ research: "", reason: "", archivist: "", briefing: "" });
  const setSysNote = (k: "research" | "reason" | "archivist" | "briefing", v: string) => setSys((s) => ({ ...s, [k]: v }));
  const d = modal.data;
  const I = d?.instructions ?? {};
  const cl = d?.cluster ?? {};
  const tools = d?.tools ?? {};
  const len = (s?: string) => (s ? `${s.length.toLocaleString()} chars` : undefined);
  const anyNote = sys.research.trim() || sys.reason.trim() || sys.archivist.trim() || sys.briefing.trim();
  const summary = [sys.research.trim() && "Researcher", sys.reason.trim() && "Reasoner", sys.archivist.trim() && "Archivist", sys.briefing.trim() && "Briefing"].filter(Boolean).join(" + ");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 860, width: "100%", maxHeight: "90vh", textAlign: "left", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
        {/* fixed header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #eee7df" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "3px 10px" }}>📥 Inputs — Before First Prompt</div>
          <div style={{ fontSize: 16, fontWeight: 800, margin: "10px 0 6px" }}>The system prompt &amp; briefing the labeller carries</div>
          <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.55 }}>
            Every turn of the three-personality chat carries this <b>system prompt</b> — hidden from the conversation, but it shapes how the labeller behaves on every cluster. The <b style={{ color: THEME.research.color }}>Researcher</b> prompt fixes what it grounds in (ZFIN / ZFA / GO) and its cite-discipline; the <b style={{ color: THEME.reason.color }}>Reasoner</b> prompt sets how it synthesises evidence, when it dispatches the other two, and the rules for concluding vs abstaining; the <b style={{ color: THEME.archivist.color }}>Archivist</b> prompt locks it to the dataset&apos;s raw values only. The <b>briefing</b> supplies this cluster&apos;s markers + authoritative stats. These are the levers that steer the system — a change here changes the labeller for every cluster. Read each below and judge it on its own. <i>(Your first question comes next, in the judgement box.)</i>
          </div>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflow: "auto", padding: "10px 22px 16px" }}>
          {modal.loading ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#9a938a", fontSize: 13 }}>Loading the assembled inputs…</div>
          ) : d?.error ? (
            <div style={{ fontSize: 12.5, color: "#8a5a00", background: "#fff7e6", border: "1px solid #f0dca8", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>Couldn’t load the full server-side inputs ({String(d.error)}).</div>
          ) : null}
          <Collapsible title="🔬 Researcher — system prompt" badge={len(I.research)} accent={THEME.research.color}>
            <RichMD mode="research">{I.research ?? "(unavailable)"}</RichMD>
            <NoteField label="⚖️ Judge the Researcher system prompt" hint="Anything in the Researcher's instructions that would bias or mislead its grounding?" value={sys.research} onChange={(v) => setSysNote("research", v)} />
          </Collapsible>
          <Collapsible title="🧠 Reasoner — system prompt" badge={len(I.reason)} accent={THEME.reason.color}>
            <RichMD mode="reason">{I.reason ?? "(unavailable)"}</RichMD>
            <NoteField label="⚖️ Judge the Reasoner system prompt" hint="Anything in the Reasoner's instructions (synthesis, conclude/abstain rules) you'd change?" value={sys.reason} onChange={(v) => setSysNote("reason", v)} />
          </Collapsible>
          <Collapsible title="📚 Archivist — system prompt" badge={len(I.archivist)} accent={THEME.archivist.color}>
            <RichMD mode="archivist">{I.archivist ?? "(unavailable)"}</RichMD>
            <NoteField label="⚖️ Judge the Archivist system prompt" hint="Anything in the Archivist's instructions (raw-data discipline) you'd change?" value={sys.archivist} onChange={(v) => setSysNote("archivist", v)} />
          </Collapsible>
          <Collapsible title="🧾 Briefing &amp; background (markers, cluster object, raw facts, tools)">
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a736a", margin: "2px 0 5px" }}>Personas context (prepended to every personality)</div>
            <div style={{ ...inputsQuote, fontSize: 12.5 }}>{d?.personasContext ?? "(unavailable)"}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a736a", margin: "12px 0 5px" }}>GT-blind cluster object (what the server sees — no published labels)</div>
            <KVTable rows={[
              ["cluster id", String(cl.id ?? modal.clusterId)],
              ["label", String(cl.label ?? "—")],
              ["cells", cl.nCells != null ? Number(cl.nCells).toLocaleString() : "—"],
              ["up markers", (cl.degsUp ?? []).length ? (cl.degsUp as string[]).join(", ") : "—"],
              ["down markers", (cl.markersDown ?? []).length ? (cl.markersDown as any[]).map((m) => m?.g ?? m).join(", ") : "—"],
            ]} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a736a", margin: "12px 0 5px" }}>Raw-facts block (authoritative values the Archivist quotes)</div>
            <RichMD mode="archivist">{d?.rawFacts ?? "(unavailable)"}</RichMD>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a736a", margin: "12px 0 5px" }}>Tools &amp; model</div>
            <KVTable rows={[
              ["model", String(d?.model ?? "—")],
              ["Researcher tools", `web_search · ${(tools.research?.web_search?.allowed_domains ?? []).join(", ") || "—"}`],
              ["Archivist tools", String(tools.archivist?.tool ?? "—") + " (live :5007 grounding)"],
              ["Reasoner tools", "none"],
              ["model params", JSON.stringify(d?.modelParams ?? {})],
              ...(d?.notExposed ? [["not exposed", String(d.notExposed)] as [string, React.ReactNode]] : []),
            ]} />
            <NoteField label="⚖️ Judge the briefing & background" hint="Anything in the markers / cluster object / raw facts / tools that's wrong, missing, or would mislead?" value={sys.briefing} onChange={(v) => setSysNote("briefing", v)} />
          </Collapsible>
        </div>

        {/* fixed footer */}
        <div style={{ display: "flex", gap: 10, padding: "12px 22px", borderTop: "1px solid #eee7df", justifyContent: "flex-end", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "#9a938a", marginRight: "auto" }}>{summary || "no notes yet"}</div>
          <button onClick={() => onResolve({ sys: { research: "", reason: "", archivist: "", briefing: "" } })} disabled={modal.loading} style={{ ...btnGhost, padding: "8px 18px", fontSize: 13.5, opacity: modal.loading ? 0.5 : 1 }}>Continue without adding notes</button>
          <button onClick={() => onResolve({ sys })} disabled={modal.loading || !anyNote} style={{ background: !modal.loading && anyNote ? "#7c3aed" : "#cbb6ec", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13.5, fontWeight: 700, cursor: !modal.loading && anyNote ? "pointer" : "default" }}>Add notes + continue →</button>
        </div>
      </div>
    </div>
  );
}

// ⚖️ Persistent judgement-panel body — a live HUD box that stays put across the sweep,
// updating its destination tag + rich content as the conversation turns personality to
// personality. Note box + Continue / Add notes + continue, logged to judgements[].
function judgeStepMeta(mode: AgentMode | "inputs" | "first_prompt" | null): { who: string; icon: string } {
  if (mode === "inputs") return { who: "System prompt", icon: "📥" };
  if (mode === "first_prompt") return { who: "First question", icon: "❓" };
  if (mode && (THEME as any)[mode]) return { who: THEME[mode].name, icon: THEME[mode].icon };
  return { who: "Step", icon: "⚖️" };
}
function JudgePanelContent({
  pending,
  liveMode,
  streaming,
  autoRunning,
  nLogged,
  onResolve,
  onEndAndLog,
  onHome,
  logged,
  savedOk,
  onDownload,
  onRetry,
  height,
}: {
  pending: { clusterId: string; clusterLabel: string; stepIndex: number; mode: AgentMode | "inputs" | "first_prompt" | null; excerpt: string; full: string; kind: "output" | "prompt" } | null;
  liveMode: AgentMode;
  streaming: boolean;
  autoRunning: boolean;
  nLogged: number;
  onResolve: (note: string) => void;
  onEndAndLog: () => void;
  onHome: () => void;
  logged: number | null;
  savedOk: boolean | null;
  onDownload: () => void;
  onRetry: () => Promise<void> | void;
  height?: number;
}) {
  const [v, setV] = useState("");
  // reset the note whenever the gated step changes, so a note never bleeds across steps
  const stepKey = pending ? `${pending.clusterId}:${pending.stepIndex}` : "";
  useEffect(() => { setV(""); }, [stepKey]);

  const tagBase: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "2px 9px" };

  // ── after "Submit judgements & finish" — the confirmation + exit. The headline
  // reflects the ACTUAL server result (savedOk), so it can never claim "saved" when
  // the persist failed. A .json download is offered on both paths so the judge can
  // always keep their own copy. ──
  if (logged != null) {
    const dlBtn = (
      <button onClick={onDownload} style={{ background: "#fff", color: "#7c3aed", border: "1px solid #7c3aed", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>⬇ Download judgements (.json)</button>
    );
    if (savedOk === false) {
      return (
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: "#b91c1c", background: "#fee2e2", borderRadius: 99, padding: "3px 11px" }}>⚠ Save failed — NOT persisted</div>
          <div style={{ marginTop: 12, fontSize: 13.5, color: "#1a1a1a", lineHeight: 1.5, fontWeight: 700 }}>Your {logged} judgement{logged === 1 ? "" : "s"} could not be saved to the server.</div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#4a443c", lineHeight: 1.6 }}>
            They were <b>not</b> recorded in the store and won&apos;t appear under <b>Load Previous Run</b>. <b>Download a copy now</b> so nothing is lost, then retry.
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dlBtn}
            <button onClick={onRetry} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>↻ Retry save</button>
            <button onClick={onHome} style={{ background: "transparent", color: "#6b6b6b", border: "1px solid #d8d2ca", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>← Back to home</button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ paddingTop: 4 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: "#15803d", background: "#dcfce7", borderRadius: 99, padding: "3px 11px" }}>✓ Saved to the run store</div>
        <div style={{ marginTop: 12, fontSize: 13.5, color: "#1a1a1a", lineHeight: 1.5, fontWeight: 700 }}>Your {logged} judgement{logged === 1 ? "" : "s"} {logged === 1 ? "was" : "were"} saved to the server.</div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#4a443c", lineHeight: 1.6 }}>
          Reload this run any time via <b>Load Previous Run</b>. The notes will be <b>integrated to refine the behaviour of the three-personality chat</b> for future runs. Thank you — this is exactly the signal that improves the system.
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {dlBtn}
          <button onClick={onHome} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>← Back to home</button>
        </div>
      </div>
    );
  }

  let body: React.ReactNode;
  if (!pending) {
    const live = judgeStepMeta(liveMode);
    body = (
      <div style={{ fontSize: 12.5, color: "#5a544c", lineHeight: 1.5 }}>
        <div style={tagBase}>⚖️ Judgement · standing by</div>
        <div style={{ marginTop: 10 }}>
          {autoRunning || streaming
            ? <>The run is going{streaming ? <> — <b style={{ color: THEME[liveMode]?.color }}>{live.icon} {live.who}</b> is thinking</> : null}. This box will pause on the next step so you can leave a note.</>
            : <>No step is waiting. It updates through each prompt + Researcher → Reasoner → conclude (the Archivist runs on demand), pausing at each.</>}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "#9a938a" }}>{nLogged} note{nLogged === 1 ? "" : "s"} logged this run</div>
      </div>
    );
  } else {
    const { who, icon } = judgeStepMeta(pending.mode);
    const accent = pending.mode && (THEME as any)[pending.mode] ? THEME[pending.mode as AgentMode].color : "#7c3aed";
    const renderMode: AgentMode = pending.mode && (THEME as any)[pending.mode] ? (pending.mode as AgentMode) : "reason";
    const isPrompt = pending.kind === "prompt";
    const isFirstQ = pending.mode === "first_prompt";
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ ...tagBase, color: accent, background: accent + "1a" }}>{isFirstQ ? "❓ You asked — the first question" : isPrompt ? `↳ prompt → ${who}` : `${icon} ${who}`} · step {pending.stepIndex}</span>
          <span style={{ fontSize: 10.5, color: "#9a938a", fontWeight: 700 }}>{pending.clusterLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#666" }}>{isFirstQ ? "Critique the first question — the opening prompt sent to the Researcher — or continue." : isPrompt ? `Critique the prompt about to be sent to the ${who}, or continue.` : `Critique what the ${who} produced, or continue.`}</div>
        <div style={{ background: "#faf8f6", border: "1px solid #eee7df", borderRadius: 8, padding: "8px 11px", flex: 1, minHeight: 60, overflow: "auto" }}>
          <RichMD mode={renderMode}>{(isPrompt ? pending.full : stripFences(pending.full)) || pending.excerpt}</RichMD>
        </div>
        <textarea value={v} onChange={(e) => setV(e.target.value)} autoFocus rows={3} placeholder={isPrompt ? "What's right/wrong about this prompt? (optional)" : "What's right/wrong about this step? (optional)"}
          style={{ width: "100%", boxSizing: "border-box", minHeight: 60, border: "1px solid #e5e1dc", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", flexShrink: 0 }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && v.trim()) onResolve(v); }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", flexShrink: 0 }}>
          <button onClick={() => onResolve("")} style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}>Continue without adding notes</button>
          <button onClick={() => onResolve(v)} disabled={!v.trim()} style={{ background: v.trim() ? "#7c3aed" : "#cbb6ec", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: v.trim() ? "pointer" : "default" }}>Add notes + continue →</button>
        </div>
        <div style={{ fontSize: 10.5, color: "#9a938a", textAlign: "right", flexShrink: 0 }}>{nLogged} note{nLogged === 1 ? "" : "s"} logged this run</div>
      </div>
    );
  }

  // content expands to fill the box (vertical + horizontal) as the user resizes it
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, height: height && height > 40 ? height : undefined, minHeight: 0 }}>
      {body}
      {/* always available — end the run at any point. Red/dangerous, not full-width. */}
      <div style={{ flexShrink: 0 }}>
        <button onClick={onEndAndLog} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>■ End run &amp; log judgements</button>
      </div>
    </div>
  );
}

// ⚖️ Review-before-submit popup for the judgement run — summarises every judgement logged
// so far, with the choice to go back to the editor or submit + finish.
function JudgeSummaryModal({ judgements, onBack, onSubmit }: { judgements: Judgement[]; onBack: () => void; onSubmit: () => void }) {
  const n = judgements.length;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 680, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eee7df" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "3px 10px" }}>⚖️ Review judgements before submitting</div>
          <div style={{ fontSize: 16, fontWeight: 800, margin: "10px 0 2px" }}>{n} judgement{n === 1 ? "" : "s"} to submit</div>
          <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.55 }}>These are the notes you&apos;ve logged this run. <b>Submitting ends the run</b> and sends them to Steven to refine the three-personality chat. Or go back and keep editing.</div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "10px 22px 14px" }}>
          {n === 0 ? (
            <div style={{ color: "#9a938a", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No judgement notes logged yet — go back to add some, or submit an empty run.</div>
          ) : judgements.map((j, i) => {
            const meta = judgeStepMeta(j.mode);
            return (
              <div key={i} style={{ border: "1px solid #eee7df", borderRadius: 9, padding: "9px 11px", marginBottom: 8, background: "#fff" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
                  <span style={{ fontWeight: 800, color: "#7c3aed" }}>{meta.icon} {meta.who}</span>
                  <span style={{ color: "#9a938a" }}>{j.cluster_label} · step {j.step_index}</span>
                </div>
                {j.content_excerpt ? <div style={{ fontSize: 10.5, color: "#9a938a", margin: "4px 0 0", fontStyle: "italic" }}>re: {j.content_excerpt.slice(0, 120)}{j.content_excerpt.length > 120 ? "…" : ""}</div> : null}
                <div style={{ fontSize: 12.5, color: "#2a2620", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 4 }}>{j.note}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px", borderTop: "1px solid #eee7df", justifyContent: "flex-end" }}>
          <button onClick={onBack} style={{ ...btnGhost, padding: "9px 18px", fontSize: 13.5 }}>← Back to editor</button>
          <button onClick={onSubmit} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>Submit judgements &amp; finish →</button>
        </div>
      </div>
    </div>
  );
}

// POST a note onto a run (in-flight by runId, or a saved run by runId+dataset).
async function postRunNote(runId: string, note: string, dataset?: string) {
  try {
    await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setNote", runId, note, dataset }) });
  } catch {}
}

// "Show your work": the resolution sweep, selection rule, chosen resolution, and the
// coherence curve behind this dataset's de-novo partition — shown when the clustering is
// revealed, before handing off to the three-personality labeling interface.

// The "1. Clustering" explainer — the two knobs behind every Leiden clustering, in plain
// language with a tiny visual each. Replaces the dense methodology dump on the new-run screen.

function MapStage({
  dataset,
  clusters,
  meta,
  revealed,
  validated,
  onPick,
  onAuto,
  onExport,
  onReset,
  onSwitchDataset,
  onChoosePartition,
  onImport,
  loadedNote,
  loadedRun,
  labels = {},
  confidence = {},
  model,
  onChangeModel,
  clusteringConfirmed,
  onConfirmClustering,
  usage,
  score,
  setScore,
  addUsage,
  srvNote,
}: {
  dataset: DatasetDef;
  clusters: Cluster[];
  meta: AtlasMeta | null;
  revealed: boolean;
  validated: Set<string>;
  onPick: (id: string) => void;
  onAuto: () => void;
  onExport: () => void;
  onReset: () => void;
  onSwitchDataset: () => void;
  onChoosePartition: (p: DatasetPartition) => void;
  onImport: (data: unknown) => void;
  loadedNote?: string | null;
  loadedRun?: { model?: string; nLabelled?: number; scoredAt?: string | null; exportedAt?: string | null; note?: string | null } | null;
  labels?: Record<string, string>;
  confidence?: Record<string, ClusterConf>;
  model: KasperovModel;
  onChangeModel: () => void;
  clusteringConfirmed: boolean;
  onConfirmClustering: () => void;
  usage: Usage;
  score: RunScore;
  setScore: React.Dispatch<React.SetStateAction<RunScore>>;
  addUsage: (model: string, inT: number, outT: number) => void;
  srvNote: string;
}) {
  const labelled = clusters.filter((c) => labels[c.id]);
  const unlabelled = clusters.filter((c) => !labels[c.id]);
  const [srvNoteFor, setSrvNoteFor] = useState<string | null>(null); // server run awaiting its optional note
  // completeness gate for saving: every cluster must be labelled + have tier
  // confidence, and (on GT datasets) the ground-truth comparison must have run.
  const confN = clusters.filter((c) => confidence[c.id]).length;
  const needsGt = !!dataset.groundTruthUrl;
  const saveChecks = [
    { ok: clusters.length > 0 && labelled.length === clusters.length, label: `Every cluster labelled (${labelled.length}/${clusters.length})` },
    { ok: clusters.length > 0 && confN === clusters.length, label: `Tier confidence on every cluster (${confN}/${clusters.length})` },
    ...(needsGt ? [{ ok: !!score.scoredAt, label: `Compared to ${dataset.name} ground truth` }] : []),
  ];
  const saveReady = saveChecks.every((c) => c.ok);

  // persistent server-side auto-pilot (runs on EC2, survives the browser closing)
  const [serverRun, setServerRun] = useState<{ runId?: string; phase: string; done: number; total: number; msg?: string } | null>(null);
  // timelapse GIF capture (a headless browser on EC2 films the in-browser AutoPilot)
  const [capture, setCapture] = useState<{ captureId?: string; phase: string; gif?: string; outDir?: string; frames?: number; run_phase?: string; done?: number; total?: number; size_mb?: number } | null>(null);
  async function startServerRun() {
    if (!window.confirm(`Run the AutoPilot Cluster Labeller on the server for ${dataset.name} with ${model}? It runs independently — you can close this tab and the result will be saved to "Load Previous Run" when done.`)) return;
    // OPTIONAL timelapse GIF: a headless browser on the EC2 box films the whole
    // run and squeezes it into a ~1-minute GIF on the EBS volume.
    const wantGif = window.confirm(`Also record a ~1-minute timelapse GIF of the entire run?\n\nA headless browser on the EC2 box will film the AutoPilot and assemble the GIF onto the EBS volume — you'll get a file path to grab it. The run still saves to "Load Previous Run" when done.\n\nOK = run + record GIF   ·   Cancel = run without GIF`);
    if (wantGif) {
      setCapture({ phase: "starting" });
      try {
        const r = await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "capture", dataset: dataset.id, model }) });
        if (r.status === 503) return setCapture({ phase: "not_configured" });
        const d = await r.json().catch(() => ({}));
        setCapture(d?.captureId ? { captureId: d.captureId, phase: "spawned", gif: d.gif, outDir: d.outDir } : { phase: "error" });
      } catch {
        setCapture({ phase: "error" });
      }
      return; // the capture run IS the run (it films + saves) — don't double-run
    }
    setServerRun({ phase: "starting", done: 0, total: 0 });
    try {
      const r = await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", dataset: dataset.id, serveDataset: dataset.serveId, model }) });
      if (r.status === 503) return setServerRun({ phase: "not_configured", done: 0, total: 0 });
      const d = await r.json().catch(() => ({}));
      setServerRun(d?.runId ? { runId: d.runId, phase: "queued", done: 0, total: 0 } : { phase: "error", done: 0, total: 0, msg: "could not start" });
      if (d?.runId) setSrvNoteFor(d.runId); // non-blocking: run is churning; offer the optional note now
    } catch {
      setServerRun({ phase: "error", done: 0, total: 0, msg: "worker unreachable" });
    }
  }
  // poll capture progress
  useEffect(() => {
    if (!capture?.captureId || ["done", "error", "capture_error", "not_configured"].includes(capture.phase)) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "captureStatus", captureId: capture.captureId }) });
        const d = await r.json().catch(() => ({}));
        if (d && d.phase) setCapture((c) => (c ? { ...c, ...d } : c));
      } catch {}
    }, 6000);
    return () => clearInterval(id);
  }, [capture?.captureId, capture?.phase]);
  useEffect(() => {
    if (!serverRun?.runId || ["done", "error", "aborted", "not_configured"].includes(serverRun.phase)) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status", runId: serverRun.runId }) });
        const d = await r.json().catch(() => ({}));
        setServerRun((s) => (s ? { ...s, phase: d.phase ?? s.phase, done: d.done ?? s.done, total: d.total ?? s.total, msg: d.error } : s));
      } catch {}
    }, 4000);
    return () => clearInterval(id);
  }, [serverRun?.runId, serverRun?.phase]);

  // projected full-run cost for the selected model — tweened (accel/decel) so it
  // rolls up/down as the model changes.
  const projectedCost = useTween(projectRunCost(model, clusters.length));
  const spent = estimateCost(usage).usd;
  const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

  // which run is being viewed — titled exactly like the "Load Previous Run…" list
  const runTitle = (() => {
    if (loadedRun && (loadedRun.model || loadedRun.nLabelled != null)) {
      let t = `${loadedRun.model ?? model} · ${loadedRun.nLabelled ?? labelled.length} labelled`;
      if (loadedRun.scoredAt) t += " · scored";
      return t;
    }
    if (labelled.length > 0) return `${model} · ${labelled.length} labelled${score.scoredAt ? " · scored" : ""} · local run`;
    return null;
  })();
  const runDate = loadedRun?.exportedAt || loadedRun?.scoredAt || score.scoredAt || null;

  // reconcile the (localStorage-cached) loaded run against the SERVER index, so the banner
  // never implies a run is saved/loadable when it isn't (e.g. an archived/contaminated run
  // still cached in this browser). null = checking; true = on server; false = local-only.
  const [loadedOnServer, setLoadedOnServer] = useState<boolean | null>(null);
  useEffect(() => {
    if (!loadedRun) { setLoadedOnServer(null); return; }
    let alive = true;
    fetch(`/api/kasperov_runs?dataset=${encodeURIComponent(dataset.id)}`)
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((d: any) => {
        if (!alive) return;
        const runs: any[] = d.runs || [];
        const hit = runs.some((r) => r.exportedAt === loadedRun.exportedAt || (r.model === loadedRun.model && r.nLabelled === loadedRun.nLabelled && r.scoredAt === loadedRun.scoredAt));
        setLoadedOnServer(hit);
      })
      .catch(() => alive && setLoadedOnServer(false));
    return () => { alive = false; };
  }, [dataset.id, loadedRun]);

  const trim15 = (s: string) => {
    const w = s.trim().split(/\s+/);
    return w.length > 15 ? w.slice(0, 15).join(" ") + "…" : s.trim();
  };
  const [size, setSize] = useState({ w: 760, h: 560 });
  const [mapView, setMapView] = useState<MapView>(hasCompartments(clusters) ? "islands" : "umap");
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function fit() {
      const w = Math.min(860, (wrap.current?.clientWidth ?? 800) - 8);
      setSize({ w, h: Math.round(w * 0.74) });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // is the clustered set a sample of a larger atlas? (ZSCAPE: 250k of 3.2M)
  const fullCells = meta?.fullDatasetCells;
  const clusteredCells = meta?.totalCells ?? 0;
  const sampled = !!(fullCells && fullCells > clusteredCells);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 1056, margin: "0 auto", padding: revealed ? "28px 24px 60px" : "16px 24px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
          <button onClick={onSwitchDataset} style={{ ...btnGhost, position: "absolute", left: 0, padding: "6px 12px", fontSize: 12.5 }}>← Datasets</button>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>World map · {dataset.name} atlas</div>
        </div>
        {/* cluster-naming provenance — honest badge from the partitionId-guarded overlay.
            No-ops when meta is null or the atlas carries no partitionId (pre-stamp). */}
        {meta && meta.partitionId ? (
          <div style={{ marginTop: 6 }}>
            <span
              title={meta.namesApplied
                ? `Names overlaid from labelling run ${meta.namesRunId ?? "?"} — partitionId-matched to this clustering`
                : "No partition-matched names.json for this clustering — showing generic cluster ids"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, borderRadius: 99, padding: "2px 10px",
                color: meta.namesApplied ? "#15803d" : "#6b7280", background: meta.namesApplied ? "#ecfdf5" : "#f3f4f6", border: `1px solid ${meta.namesApplied ? "#86efac" : "#e5e7eb"}` }}
            >
              <span aria-hidden style={{ fontSize: 9 }}>{meta.namesApplied ? "●" : "○"}</span>
              {meta.namesApplied ? `Named · run ${meta.namesRunId ?? "—"}` : "Unnamed clusters"}
            </span>
          </div>
        ) : null}
        <h2 style={{ fontSize: revealed ? 26 : 23, fontWeight: 700, margin: revealed ? "6px 0 2px" : "2px 0 2px" }}>{revealed ? "3. Cell Labelling" : "1. Clustering"}</h2>
        <p style={{ color: "#666", fontSize: 15, marginTop: 0, marginBottom: 8 }}>
          {revealed
            ? `${clusters.length} de-novo clusters · ${validated.size} validated. Click a cluster on the map or pick one below.`
            : clusteringConfirmed
            ? `Clustering applied — ${clusters.length} de-novo Leiden clusters${sampled ? ` on a ${clusteredCells.toLocaleString()}-cell representative sample of the full ${fullCells!.toLocaleString()}-cell atlas` : `, ${clusteredCells.toLocaleString()} cells`} (real UMAP). Good to proceed — set up the model & harness next.`
            : `Coming at ${dataset.name} fresh — here's how the cells get grouped into clusters.`}
        </p>
        {/* methodology note — why this many cells, and that the clustering is ours, not the authors' */}
        <p style={{ color: "#9a948c", fontSize: 12.5, marginTop: 0, marginBottom: revealed ? 18 : 8, lineHeight: 1.5, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
          {sampled
            ? `The sample spans every condition in ${dataset.name} (perturbed and control alike) — it is not a biological subset, just a random cross-section drawn so we can cluster ${clusteredCells.toLocaleString()} cells rather than all ${fullCells!.toLocaleString()}.`
            : ""}
          {dataset.groundTruthUrl
            ? ` We re-cluster from scratch — the authors' published cell-type labels are held out, so we can score our de-novo calls against them afterward.`
            : ""}
        </p>

        {/* which run am I looking at — shown on the cluster-chooser so it's never ambiguous.
            If the cached run isn't on the server (e.g. an archived/contaminated run still in
            this browser), say so plainly instead of implying it's loadable. */}
        {revealed && runTitle && (() => {
          const stale = !!loadedRun && loadedOnServer === false;
          return (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12, background: stale ? "#fffbeb" : "#eef7f9", border: `1px solid ${stale ? "#fde68a" : ACCENT + "33"}`, borderRadius: 99, padding: "6px 16px", fontSize: 13 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: stale ? "#b45309" : ACCENT }}>{stale ? "⚠ Local cache" : "Viewing run"}</span>
              <strong style={{ color: "#2b2b2b" }}>{runTitle}</strong>
              {runDate && <span style={{ color: "#8a847c", fontSize: 12 }}>· {new Date(runDate).toLocaleString()}</span>}
              {stale && <span style={{ fontSize: 11.5, color: "#92400e" }}>· not on the server (not in Load Previous Run) — use ↺ Reset run to clear, or Export to save it</span>}
            </div>
          );
        })()}

        {/* run info bar — model + projected cost + spend. This is about the LABELLING
            run, not the clustering, so it only appears after reveal; the "How we
            clustered" page stays purely about how the clusters were derived. */}
        {revealed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
            <span style={{ color: "#555" }}>
              Model <strong>{model}</strong>{" "}
              <button onClick={onChangeModel} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0 }}>change</button>
            </span>
            <span style={{ color: "#555" }} title="Rough projection: ~21k tokens/cluster × the model's price.">
              ~<strong style={{ fontVariantNumeric: "tabular-nums", color: ACCENT, fontSize: 14 }}>{fmtUsd(projectedCost)}</strong> projected to label all {clusters.length} clusters
            </span>
            {spent > 0 && labelled.length > 0 && <span style={{ color: "#aaa" }}>· {fmtUsd(spent)} spent so far</span>}
            {score.scoredAt && <span style={{ color: "#aaa" }}>· scored {new Date(score.scoredAt).toLocaleDateString()}</span>}
          </div>
        )}

        <div ref={wrap} style={{ display: "inline-block", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 14, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {hasCompartments(clusters) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <MapViewSwitch view={mapView} setView={setMapView} />
            </div>
          )}
          {mapView === "islands" && hasCompartments(clusters) ? (
            <CompartmentMap clusters={clusters} activeId={null} validated={revealed ? validated : EMPTY_VALIDATED} width={revealed ? size.w : Math.min(size.w, 560)} height={revealed ? size.h : Math.min(size.h, 392)} onPick={revealed ? onPick : undefined} />
          ) : (
            <UmapCanvas clusters={clusters} mode="global" colored={revealed || clusteringConfirmed} activeId={null} validated={revealed ? validated : EMPTY_VALIDATED} width={revealed ? size.w : Math.min(size.w, 560)} height={revealed ? size.h : Math.min(size.h, 392)} onPick={revealed ? onPick : undefined} />
          )}
        </div>
        {!revealed && dataset.partitions && dataset.partitions.length > 1 && (
          <div style={{ maxWidth: 720, margin: "4px auto 14px", textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#9a948c", marginBottom: 8, textAlign: "center" }}>Choose a clustering to colour the map</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {dataset.partitions.map((p) => {
                const sel = dataset.partitionKey === p.key;
                return (
                  <button key={p.key} onClick={() => onChoosePartition(p)} style={{ textAlign: "left", background: sel ? "#eef7f9" : "#fffdfb", border: `1px solid ${sel ? ACCENT : "#e5e1dc"}`, borderTop: `3px solid ${sel ? ACCENT : "#cbd5cf"}`, borderRadius: 12, padding: "13px 15px", cursor: "pointer", color: INK, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800 }}>{p.label}</span>
                      {sel && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: ACCENT, background: "#dbeef2", borderRadius: 99, padding: "2px 8px" }}>selected</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#5a544c", lineHeight: 1.5 }}>{p.blurb}</div>
                  </button>
                );
              })}
            </div>
            {/* proceed — lights up only once a clustering is picked (which colours the map above) */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button onClick={onChangeModel} disabled={!clusteringConfirmed}
                title={clusteringConfirmed ? "" : "Pick a clustering above first"}
                style={{ background: clusteringConfirmed ? ACCENT : "#d8d3cc", color: "#fff", border: "none", borderRadius: 10, padding: "13px 26px", fontSize: 16, fontWeight: 600, cursor: clusteringConfirmed ? "pointer" : "not-allowed" }}>
                Set up model &amp; harness →
              </button>
            </div>
          </div>
        )}
        {!revealed && (dataset.id === "zscape" ? <ZscapeClusteringExplainer nLeaves={clusters?.length} /> : <ClusteringExplainer />)}

        {loadedNote && (
          <div style={{ maxWidth: 640, margin: "14px auto 0", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#92400e", textAlign: "left", lineHeight: 1.5 }}>
            <strong>📝 Run note:</strong> {loadedNote}
          </div>
        )}
        <div style={{ marginTop: revealed ? 20 : 12 }}>
          {!revealed ? (
            dataset.partitions ? null : clusteringConfirmed ? (
              <button onClick={onChangeModel} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 15.5, fontWeight: 600, cursor: "pointer" }}>
                Set up model &amp; harness →
              </button>
            ) : (
              <button onClick={onConfirmClustering} style={{ background: THEME.research.color, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}>
                Good to proceed — apply this clustering →
              </button>
            )
          ) : (
            <>
              {/* run-itself controls */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  onClick={onAuto}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: THEME.reason.color, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                >
                  🤖 Activate AutoPilot Cluster Labeller →
                </button>
                <button
                  onClick={startServerRun}
                  title="Runs the whole loop on the server — survives closing this tab; saves to Load Previous Run when done."
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: THEME.reason.color, border: `1px solid ${THEME.reason.color}`, borderRadius: 10, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  ☁ Run AutoPilot on server (persistent)
                </button>
                {/* No load/import here — this page manages the NEW run only.
                    Saving lives at the very bottom (gated on a completeness check).
                    Viewing past runs is the separate "View Completed Runs" path. */}
                {(labelled.length > 0 || validated.size > 0) && (
                  <button onClick={onReset} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14, color: "#b91c1c", borderColor: "#e7c3c3" }}>↺ Reset run</button>
                )}
              </div>
              {srvNote && <div style={{ fontSize: 12.5, color: srvNote.includes("✓") ? "#15803d" : "#999", marginBottom: 10 }}>{srvNote}</div>}
              {serverRun && (
                <div style={{ fontSize: 12.5, marginBottom: 12, color: serverRun.phase === "error" || serverRun.phase === "not_configured" ? "#b91c1c" : "#2563eb", display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  {serverRun.phase === "not_configured" ? (
                    <span>Server runner not configured yet (set <code>KASPEROV_AUTOPILOT_URL</code> in Vercel env).</span>
                  ) : serverRun.phase === "error" ? (
                    <span>Server run failed{serverRun.msg ? `: ${serverRun.msg}` : ""}.</span>
                  ) : serverRun.phase === "done" ? (
                    <span style={{ color: "#15803d" }}>✓ Server run complete — saved. Find it under &ldquo;View Completed Runs&rdquo; on the dataset card.</span>
                  ) : (
                    <span>
                      <span style={{ animation: "kpulse 1s infinite" }}>☁</span> Server run · {serverRun.phase}
                      {serverRun.total ? ` · ${serverRun.done}/${serverRun.total} clusters` : ""} — you can safely close this tab; it keeps running.
                    </span>
                  )}
                </div>
              )}
              {capture && (
                <div style={{ fontSize: 12.5, marginBottom: 12, color: capture.phase === "error" || capture.phase === "capture_error" || capture.phase === "not_configured" ? "#b91c1c" : capture.phase === "done" ? "#15803d" : "#a16207", maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                  {capture.phase === "not_configured" ? (
                    <span>GIF capture needs the server runner configured (<code>KASPEROV_AUTOPILOT_URL</code>).</span>
                  ) : capture.phase === "error" || capture.phase === "capture_error" ? (
                    <span>Couldn&apos;t start the timelapse capture.</span>
                  ) : capture.phase === "done" ? (
                    <span>
                      🎬 <strong>Timelapse ready</strong>{capture.size_mb ? ` (${capture.size_mb} MB${capture.frames ? `, ${capture.frames} frames` : ""})` : ""} on the EC2 EBS volume:
                      <br />
                      <code style={{ fontSize: 11.5, wordBreak: "break-all", background: "#f0fdf4", padding: "1px 5px", borderRadius: 4 }}>{capture.gif}</code>
                    </span>
                  ) : (
                    <span>
                      <span style={{ animation: "kpulse 1s infinite" }}>🎬</span> Recording timelapse on the server{capture.run_phase === "running" && capture.total ? ` · labelling ${capture.done}/${capture.total}` : capture.frames ? ` · ${capture.frames} frames` : "…"}. The GIF will land at:
                      <br />
                      <code style={{ fontSize: 11.5, wordBreak: "break-all", background: "#fef9c3", padding: "1px 5px", borderRadius: 4 }}>{capture.gif}</code>
                      <br />
                      You can close this tab — it films and saves on the EC2 box.
                    </span>
                  )}
                </div>
              )}
              {srvNoteFor && <RunNoteModal onSubmit={(t) => { postRunNote(srvNoteFor, t); setSrvNoteFor(null); }} onSkip={() => setSrvNoteFor(null)} />}
              <p style={{ color: "#999", fontSize: 12.5, margin: "0 auto 14px", maxWidth: 560 }}>
                Auto-pilot drives the Reasoner across every un-labelled cluster — dispatching the Researcher &amp; Archivist,
                adding evidence, and accepting an identity when settled. Watch it go; stop anytime. (Uses OpenAI credits.)
              </p>

              {/* run-summary cluster grid — only when there's no ground-truth
                  scorecard to merge the per-cluster list into (e.g. MiniFin) */}
              {!dataset.groundTruthUrl && (
              <div style={{ marginTop: 8, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#999", fontWeight: 600 }}>
                    Run summary · {labelled.length}/{clusters.length} labelled · {validated.size} validated
                  </div>
                  <div style={{ fontSize: 11.5, color: "#aaa" }}>✓ = validated · % = confidence (red→green)</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 6 }}>
                  {clusters.map((c) => {
                    const conf = overallConf(confidence[c.id]);
                    const isVal = validated.has(c.id);
                    const hasLabel = !!labels[c.id];
                    const heat = typeof conf === "number" ? confColor(conf) : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => onPick(c.id)}
                        title={
                          hasLabel
                            ? `${c.label}: ${labels[c.id]}${typeof conf === "number" ? ` · ${conf.toFixed(0)}% confidence` : ""}`
                            : `${c.label} — not yet labelled`
                        }
                        style={{ display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", background: isVal ? "#f6fdf8" : "#fffdfb", border: `1px solid ${isVal ? "#bfe3cc" : "#e5e1dc"}`, borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: INK, minWidth: 0 }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color, flexShrink: 0, marginTop: 5 }} />
                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <strong style={{ fontSize: 12.5 }}>{c.label}</strong>
                            {isVal && <span style={{ color: "#15803d", fontWeight: 800, fontSize: 12 }}>✓</span>}
                          </span>{" "}
                          {hasLabel ? (
                            <span style={{ fontSize: 12, color: "#666" }}>— {trim15(labels[c.id])}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#b3ada5", fontStyle: "italic" }}>— not yet labelled</span>
                          )}
                        </span>
                        {typeof conf === "number" && heat && (
                          <span style={{ flexShrink: 0, marginTop: 2, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: heat.fg, background: heat.bg, border: `1px solid ${heat.fg}22`, borderRadius: 99, padding: "2px 7px" }}>
                            {conf.toFixed(0)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* surface the gap — clusters that completed the run without a cell-type label */}
              {labelled.length > 0 && unlabelled.length > 0 && (
                <div style={{ marginTop: 14, textAlign: "left", fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px" }}>
                  {unlabelled.length} of {clusters.length} clusters not yet labelled: {unlabelled.map((c) => c.label.replace("Cluster ", "C")).join(", ")}. Run &ldquo;Activate AutoPilot Cluster Labeller&rdquo; — it auto-skips the {labelled.length} already labelled and finishes only these.
                </div>
              )}

              {/* ground-truth scoring, always inline under the run summary —
                  un-filled until you press the button (once all clusters are labelled) */}
              {dataset.groundTruthUrl && (
                <div style={{ marginTop: 28 }}>
                  <Scorecard
                    embedded
                    dataset={dataset}
                    clusters={clusters}
                    labels={labels}
                    confidence={confidence}
                    validated={validated}
                    onPick={onPick}
                    model={model}
                    addUsage={addUsage}
                    score={score}
                    setScore={setScore}
                    onImport={onImport}
                  />
                </div>
              )}

              {/* Save lives at the very bottom — gated on a completeness check so
                  an incomplete run (incl. an un-scored GT run) can't be saved. */}
              <div style={{ marginTop: 36, borderTop: "1px solid #e5e1dc", paddingTop: 22, maxWidth: 640, marginLeft: "auto", marginRight: "auto", textAlign: "left" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: "#999", fontWeight: 700, marginBottom: 10 }}>Finish &amp; save this run</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {saveChecks.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: c.ok ? "#15803d" : "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800 }}>{c.ok ? "✓" : "○"}</span> {c.label}
                    </div>
                  ))}
                </div>
                <button
                  onClick={onExport}
                  disabled={!saveReady}
                  title={saveReady ? "Download the run JSON and save it to the server" : "Complete every check above before saving"}
                  style={{ background: saveReady ? "#15803d" : "#cdd5cf", color: "#fff", border: "none", borderRadius: 10, padding: "13px 22px", fontSize: 15, fontWeight: 700, cursor: saveReady ? "pointer" : "not-allowed" }}
                >
                  ⬇ Export results (JSON) + save to server
                </button>
                {!saveReady && <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 8 }}>Saving unlocks once every item above is checked{needsGt ? ", including the ground-truth comparison" : ""}.</div>}
                {srvNote && <div style={{ fontSize: 12.5, color: srvNote.includes("✓") ? "#15803d" : "#999", marginTop: 8 }}>{srvNote}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ground-truth scorecard — score our de-novo labels against the authors'
// published labels at every ontology tier (germ layer → tissue → broad → sub),
// via an LLM semantic judge. Depth-stratified: coarse tiers should agree more.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
type ChatMsg = { role: "user" | "assistant"; content: string; mode?: AgentMode; thinking?: string };

const MODES: AgentMode[] = ["research", "archivist", "reason"];

// extract the hidden ```kasperov-markers``` block: returns display text + parsed markers
// Extract a hidden control block by keyword. Robust to the model emitting it
// EITHER fenced ( ```kasperov-x\n[...]\n``` ) OR bare ( kasperov-x [...] ) — it
// locates the keyword, bracket-matches the following JSON array, and removes the
// whole thing (plus any surrounding fence) from the visible text.
function extractTagged(content: string, keyword: string): { json: string | null; clean: string } {
  const kw = new RegExp("(?:```)?\\s*" + keyword + "\\s*", "i");
  const m = content.match(kw);
  if (!m || m.index === undefined) return { json: null, clean: content };
  const afterKw = m.index + m[0].length;
  const ai = content.indexOf("[", afterKw);
  const oi = content.indexOf("{", afterKw);
  let start = -1;
  let open = "[";
  if (ai !== -1 && (oi === -1 || ai < oi)) { start = ai; open = "["; }
  else if (oi !== -1) { start = oi; open = "{"; }
  if (start === -1) return { json: null, clean: content };
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    const c = content[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return { json: null, clean: content };
  let after = end + 1;
  const tail = content.slice(after).match(/^\s*```/); // consume a trailing fence if present
  if (tail) after += tail[0].length;
  const json = content.slice(start, end + 1);
  const clean = (content.slice(0, m.index) + content.slice(after)).trim();
  return { json, clean };
}

// the Reasoner's final call for a cluster (settled identity) — drives auto-accept.
// The Reasoner's settled call, daniotype-style: an (identity, state) at the
// ontology tier the evidence supports, an assign/abstain decision, and the
// cluster markers it leaned on. Legacy flat {label,...} blocks still parse.
type Conclude = {
  label: string; // formatted display string
  identity?: string;
  tier?: string;
  state?: string; // omitted when "none"
  decision?: "assign" | "abstain";
  citedMarkers?: string[];
  confidence?: number;
  stack?: ClusterConf; // ⚖️ Reasoner-declared 4-tier breakdown (drives the confidence panel)
  done: boolean;
};

// parse the Reasoner's conclude `stack` (4 tiers × {prediction, confidence 0-100})
// into a ClusterConf. Returns undefined unless all four tiers are present + numeric.
function parseConcludeStack(s: any): ClusterConf | undefined {
  if (!s || typeof s !== "object") return undefined;
  const tier = (k: string): TierPred | null => {
    const t = s[k];
    if (!t || typeof t !== "object" || typeof t.confidence !== "number") return null;
    return { prediction: String(t.prediction ?? ""), pct: Math.max(0, Math.min(100, t.confidence)) };
  };
  const gl = tier("germ_layer"), ti = tier("tissue"), cb = tier("cell_type_broad"), cs = tier("cell_type_sub");
  if (!gl || !ti || !cb || !cs) return undefined;
  return { germ_layer: gl, tissue: ti, cell_type_broad: cb, cell_type_sub: cs };
}

function formatConcludeLabel(c: { identity?: string; state?: string; tier?: string; decision?: "assign" | "abstain" }): string {
  const id = (c.identity ?? "").trim();
  if (c.decision === "abstain") return `${id || "unresolved"} (abstained · ${c.tier ?? "tier"})`;
  return c.state ? `${id} · ${c.state}` : id;
}

function splitConclude(content: string): { clean: string; conclude: Conclude | null } {
  const { json, clean } = extractTagged(content, "kasperov-conclude");
  if (!json) return { clean: content, conclude: null };
  try {
    const o = JSON.parse(json);
    if (o && typeof o.identity === "string") {
      const state = typeof o.state === "string" && o.state.toLowerCase() !== "none" && o.state.trim() ? String(o.state) : undefined;
      const decision: "assign" | "abstain" = o.decision === "abstain" ? "abstain" : "assign";
      const citedMarkers = Array.isArray(o.cited_markers) ? o.cited_markers.filter((g: unknown) => typeof g === "string").map(String) : [];
      const base = { identity: String(o.identity), tier: typeof o.tier === "string" ? o.tier : undefined, state, decision };
      return {
        clean,
        conclude: { ...base, label: formatConcludeLabel(base), citedMarkers, confidence: typeof o.confidence === "number" ? o.confidence : undefined, stack: parseConcludeStack(o.stack), done: o.done !== false },
      };
    }
    // legacy flat block
    if (o && typeof o.label === "string") return { clean, conclude: { label: String(o.label), confidence: typeof o.confidence === "number" ? o.confidence : undefined, done: o.done !== false } };
  } catch {}
  return { clean, conclude: null };
}

// Require-evidence-to-name, enforced (not just prompted): a confident "assign"
// must cite ≥1 marker that is actually one of THIS cluster's differential genes
// (its degsUp or a gene promoted into the panel). If it can't, we roll up to an
// abstention rather than letting an ungrounded name through.
function enforceCiteDiscipline(c: Conclude, cl: Cluster, added: Marker[]): Conclude {
  if (!c.identity) return c; // legacy flat label — nothing to enforce
  const universe = new Set([...(cl.degsUp ?? []), ...(added ?? []).map((m) => m.g)].map((s) => String(s).toLowerCase()));
  const cited = (c.citedMarkers ?? []).filter((g) => universe.has(String(g).toLowerCase()));
  if (c.decision === "assign" && cited.length === 0) {
    const downgraded = { ...c, decision: "abstain" as const, citedMarkers: cited, confidence: Math.min(c.confidence ?? 40, 45) };
    return { ...downgraded, label: formatConcludeLabel(downgraded) };
  }
  return { ...c, citedMarkers: cited };
}

// heuristic: a specialist deferred / is asking the curator to choose instead of
// just doing the work → surface a one-click "just run it" button.
function looksStuck(content: string): boolean {
  const t = content.trim();
  return (
    /\b(would you (prefer|like)|which would you|do you want me to|shall i|let me know which|prefer\b[\s\S]{0,40}\(a\)|\(a\)[\s\S]{0,120}\(b\)|don'?t have access to those results|i have the .*ready)\b/i.test(t) ||
    /\?\s*$/.test(t)
  );
}

// a streamed reply that came back as a request error / empty body — auto-pilot
// uses this to decide whether to retry the call.
function streamFailed(content: string): boolean {
  return /_Request failed:|_Error:|_\(no response\)_/.test(content ?? "");
}

function splitMarkerBlock(content: string): { clean: string; markers: Marker[] } {
  const { json, clean } = extractTagged(content, "kasperov-markers");
  if (!json) return { clean: content, markers: [] };
  let markers: Marker[] = [];
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr))
      markers = arr
        .filter((x) => x && typeof x.g === "string")
        .map((x) => ({ g: x.g, l2fc: x.l2fc ?? undefined, p1: x.p1 ?? undefined, p2: x.p2 ?? undefined, note: x.note ?? undefined }));
  } catch {}
  return { clean, markers };
}

// a prompt the Reasoner crafted for another personality, surfaced as a send button.
function splitDispatch(content: string): { clean: string; dispatches: { to: AgentMode; prompt: string }[] } {
  const { json, clean } = extractTagged(content, "kasperov-dispatch");
  if (!json) return { clean: content, dispatches: [] };
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    return { clean, dispatches: [] };
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const dispatches = arr
    .filter((x) => x && typeof x.prompt === "string")
    .map((x) => ({ to: (x.to === "archivist" ? "archivist" : "research") as AgentMode, prompt: String(x.prompt) }))
    .filter((d) => {
      const k = `${d.to}:${d.prompt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 2); // never flood the chat with dispatch buttons
  return { clean, dispatches };
}

// the Reasoner moving an "also-discussed" gene up into the UP/DOWN marker list.
function splitPromote(content: string): { clean: string; promotes: { gene: string; dir: "up" | "down"; note?: string }[] } {
  const { json, clean } = extractTagged(content, "kasperov-promote");
  if (!json) return { clean: content, promotes: [] };
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    return { clean, promotes: [] };
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const promotes = arr
    .filter((x) => x && typeof x.gene === "string" && (x.dir === "up" || x.dir === "down"))
    .map((x) => ({ gene: String(x.gene), dir: x.dir as "up" | "down", note: x.note ? String(x.note) : undefined }))
    .slice(0, 6);
  return { clean, promotes };
}

function defaultPrompt(c: Cluster): string {
  // COST-TRIMMED: fewer markers (top 5 up / top 3 down) + a hard efficiency budget.
  // A/B-verified to keep ~the same labels at ~half the Researcher cost/time.
  const upList = c.degsUp.slice(0, 5).join(", ");
  const downList = (c.markersDown ?? []).slice(0, 3).map((m) => m.g).join(", ");
  return (
    `${c.label}'s top UP markers: ${upList || "(none)"}. ` +
    (downList ? `Depleted (DOWN): ${downList}. ` : "") +
    `Return cited evidence (ZFIN / ZFA / GO) for what tissue or cell type these markers indicate. ` +
    `BE FAST AND EFFICIENT — you are strictly time-budgeted (~30s): at MOST one targeted search per marker, ` +
    `skip ZFA/GO lookups for any marker ZFIN already resolves, and STOP as soon as the tissue picture is clear. ` +
    `Do NOT exhaustively search every resource for every gene, and do not research markers beyond the ones listed. ` +
    `Evidence only — no identity call (that is the Reasoner's job).`
  );
}


// pure marker merge (gene-keyed; classifies up/down by log2FC) — shared by the
// manual "Add to Top Markers" button and the auto-pilot.
function mergeMarkers(cur: Marker[], add: Marker[], via: AgentMode): Marker[] {
  const byGene = new Map(cur.map((m) => [m.g.toLowerCase(), m]));
  add.forEach((m) => {
    const ex = byGene.get(m.g.toLowerCase());
    // snowball: keep one tagged note PER personality (this turn's note replaces
    // only this personality's prior note, so each gene accrues up to three tags)
    const notes = (ex?.notes ?? []).filter((n) => n.via !== via);
    if (m.note) notes.push({ via, text: m.note });
    const merged: Marker = { ...ex, ...m, via, note: m.note ?? ex?.note, notes };
    merged.dir = merged.dir ?? (merged.l2fc != null ? (merged.l2fc >= 1 ? "up" : merged.l2fc <= -1 ? "down" : undefined) : undefined);
    byGene.set(m.g.toLowerCase(), merged);
  });
  return Array.from(byGene.values());
}

function applyPromotes(list: Marker[], promotes: { gene: string; dir: "up" | "down"; note?: string }[], via: AgentMode): Marker[] {
  const byGene = new Map(list.map((m) => [m.g.toLowerCase(), m]));
  for (const p of promotes) {
    const ex = byGene.get(p.gene.toLowerCase());
    const notes = (ex?.notes ?? []).filter((n) => n.via !== via);
    if (p.note) notes.push({ via, text: p.note });
    byGene.set(p.gene.toLowerCase(), { ...(ex ?? { g: p.gene }), g: ex?.g ?? p.gene, dir: p.dir, note: p.note ?? ex?.note, via, notes });
  }
  return Array.from(byGene.values());
}

// section headers / non-gene bold tokens to ignore when scraping evidence bullets
const EVIDENCE_SKIP = new Set(["verdict", "evidence", "caveats", "note", "notes", "identity", "read", "raw", "facts", "specificity", "statistics", "summary", "context", "conclusion", "caveat"]);
// While a personality streams, scrape `**gene** — short finding` evidence bullets
// out of the partial text so Top Markers can snowball BEFORE the final block.
function extractEvidenceMarkers(text: string): Marker[] {
  const out: Marker[] = [];
  const seen = new Set<string>();
  const re = /\*\*([A-Za-z][A-Za-z0-9.:_-]{0,17})\*\*\s*[—:–-]+\s*([^\n[]{3,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const g = m[1].replace(/[:._-]+$/, "").trim();
    if (g.length < 2 || /\s/.test(g) || EVIDENCE_SKIP.has(g.toLowerCase()) || seen.has(g.toLowerCase())) continue;
    seen.add(g.toLowerCase());
    const note = m[2].replace(/\*\*/g, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ").replace(/[\s.,;:([]+$/, "");
    out.push({ g, note });
  }
  return out;
}

// Scrape mentions of KNOWN cluster genes from free-form prose (the reasoning log
// / Research Log, where the Researcher spends most of its time before the final
// answer). For each gene found, take the short clause AFTER it as a live note —
// this is what makes Top Markers update continuously while the agent thinks.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractMentions(text: string, vocab: string[]): Marker[] {
  if (!text) return [];
  const out: Marker[] = [];
  for (const g of vocab) {
    if (g.length < 2) continue;
    const re = new RegExp(`\\b${escapeRe(g)}\\b`, "gi");
    let last = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) last = m.index + m[0].length;
    if (last < 0) continue;
    const after = text.slice(last, last + 110).replace(/\*\*/g, "").replace(/\s+/g, " ").replace(/^[\s,.;:)\]]+/, "").trim();
    const note = after.split(/[.;\n]/)[0].split(" ").slice(0, 9).join(" ").replace(/[\s.,;:([]+$/, "");
    if (note.length >= 3) out.push({ g, note });
  }
  return out;
}

// a signature so live (frequent) re-scrapes only commit a state update when the
// gene set / note TEXT / directions actually changed (note text is included so
// continually-edited live notes do get flushed to the UI)
function augSig(list: Marker[]): string {
  return list
    .map((m) => `${m.g.toLowerCase()}:${(m.notes ?? []).map((n) => n.via + n.text).join("~") || (m.note ?? "")}:${m.dir ?? ""}`)
    .sort()
    .join("|");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// COST-TRIMMED (A/B-verified): the cluster's markers + stats are PRECOMPUTED, so
// conclude by default — gate the Archivist (only if a specific number is genuinely
// in doubt) and don't routinely double-check.
const AUTO_REASON_PROMPT =
  "You have the Researcher's read above. IMPORTANT: this cluster's differential markers + their stats are ALREADY PRECOMPUTED and given to you — trust them. Your DEFAULT action is to CONCLUDE. Do NOT routinely dispatch the Archivist to double-check precomputed numbers — only dispatch it if a SPECIFIC raw stat is genuinely in doubt AND would change your call. When the identity + 4-tier stack are settled — which for a clear marker set is NOW — conclude with a kasperov-conclude block, citing markers that are actually in THIS cluster's marker list (abstain at the deepest defensible tier if you cannot ground a specific type). Only dispatch (kasperov-dispatch) if a single specific query would actually change the call.";
const AUTO_NUDGE_PROMPT =
  "Decide now — do not ask me. Prefer to conclude with a kasperov-conclude block (assign if grounded in this cluster's markers, or abstain at the deepest defensible tier). Only dispatch if a specific query would change the call.";
// rounds AFTER the first: the specialist(s) the Reasoner dispatched have already
// replied (their output is in the conversation), so the round-0 priming prompt —
// which asserts "the Archivist has NOT run yet" — would be both false and redundant.
// Just hand the new evidence back and let the Reasoner take over and drive.
const AUTO_REASON_CONT =
  "The specialist(s) replied above. The markers are precomputed — CONCLUDE now unless a specific unanswered query would genuinely change the call. If settled across the germ-layer → tissue → cell-type-broad → cell-type-sub stack, emit a kasperov-conclude block (citing markers in THIS cluster's list, or abstaining at the deepest defensible tier). Do not add routine double-checks. Only dispatch (kasperov-dispatch) a single specific query if it would change the call — and never re-ask anything already answered.";
// after the first continuation, the Reasoner already knows it's driving — don't re-inject
// the whole instruction every round; a one-line nudge is enough to hand back the reply.
const AUTO_REASON_MIN =
  "The specialist(s) replied above. Continue driving: conclude (kasperov-conclude) if it's settled, or dispatch the single most useful not-yet-answered query (kasperov-dispatch). Don't re-ask anything already answered.";
const AUTO_MAX_ROUNDS = 4;
// per-personality loading-bar ceiling (seconds). The agent route's maxDuration
// is 300s on Vercel Pro, shared by all three personalities, so the bar counts
// toward 300 — heavy Researcher/Archivist tool turns can run that long.
const TURN_MAX_S: Record<AgentMode, number> = { research: 300, archivist: 300, reason: 300 };


function ClusterStage({
  dataset,
  model,
  addUsage,
  clusters,
  active,
  validated,
  onBack,
  onValidate,
  goToCluster,
  autoStart,
  autoConsumedRef,
  onAutoDone,
  judgementMode,
  addJudgement,
  nJudgements,
  judgements,
  onLogJudgements,
  onDownloadJudgements,
  labels,
  onLabel,
  transcripts,
  setTranscripts,
  augmented,
  setAugmented,
  confidence,
  setConfidence,
  incorporated,
  setIncorporated,
  metaDecisions,
  onMetaDecision,
}: {
  dataset: DatasetDef;
  model: string;
  metaDecisions: Record<number, any>;
  onMetaDecision: (comp: number, r: any) => void;
  addUsage: (model: string, inT: number, outT: number) => void;
  clusters: Cluster[];
  active: Cluster;
  validated: Set<string>;
  onBack: () => void;
  onValidate: (id: string, yes: boolean) => void;
  goToCluster: (id: string) => void;
  autoConsumedRef: React.MutableRefObject<number>;
  onAutoDone?: () => void;
  judgementMode: boolean;
  addJudgement: (j: Judgement) => void;
  nJudgements: number;
  judgements: Judgement[];
  onLogJudgements: () => Promise<boolean> | boolean;
  onDownloadJudgements: () => void;
  autoStart: number;
  labels: Record<string, string>;
  onLabel: (id: string, label: string) => void;
  transcripts: Record<string, ChatMsg[]>;
  setTranscripts: React.Dispatch<React.SetStateAction<Record<string, ChatMsg[]>>>;
  augmented: Record<string, Marker[]>;
  setAugmented: React.Dispatch<React.SetStateAction<Record<string, Marker[]>>>;
  confidence: Record<string, ClusterConf>;
  setConfidence: React.Dispatch<React.SetStateAction<Record<string, ClusterConf>>>;
  incorporated: Set<string>;
  setIncorporated: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt(active));
  const [inReason, setInReason] = useState("");
  const [inRes, setInRes] = useState("");
  const [inArch, setInArch] = useState("");
  const [zoomW, setZoomW] = useState(560);
  const [panelW, setPanelW] = useState(470); // resizable GPT-5-Mini panel
  const leftRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // drag the splitter to trade space between the focused-cluster view and the panel
  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(window.innerWidth - ev.clientX, 320), window.innerWidth - 360);
      setPanelW(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // live streaming buffers
  const [streaming, setStreaming] = useState(false);
  const [sStatus, setStatus] = useState("");
  const [sThinking, setThinking] = useState("");
  const [sText, setText] = useState("");
  const [elapsed, setElapsed] = useState(0); // seconds since run started
  const [sMode, setSMode] = useState<AgentMode>("research");
  const [routing, setRouting] = useState(false); // ~1s "choosing a specialist" phase
  const [routed, setRouted] = useState(false); // chosen mode known
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // markers added to the Top Markers panel from chat, per cluster (state in parent)
  const [flash, setFlash] = useState(false);
  // auto-pilot run state
  const [auto, setAuto] = useState<{ running: boolean; current: string | null; done: number; total: number }>({ running: false, current: null, done: 0, total: 0 });
  const autoAbort = useRef(false);
  // ⚖️ judgement gate: in judgement mode the sweep pauses after every personality
  // step and waits for the curator to hit OK or type a note + Submit + Continue.
  const judgeModeRef = useRef(judgementMode);
  useEffect(() => { judgeModeRef.current = judgementMode; }, [judgementMode]);
  // `full` carries the complete step content for the persistent panel to
  // display + scroll; `excerpt` is the trimmed copy stored on the logged record.
  const [pendingJudge, setPendingJudge] = useState<{ clusterId: string; clusterLabel: string; stepIndex: number; mode: AgentMode | "inputs" | "first_prompt" | null; excerpt: string; full: string; kind: "output" | "prompt" } | null>(null);
  const judgeResolve = useRef<(() => void) | null>(null);
  const judgeStepRef = useRef<Record<string, number>>({}); // gated-step ordinal per cluster
  // pause after a step; resolves when OK / Submit+Continue is clicked (or the sweep aborts).
  function judgeGate(cl: Cluster, mode: AgentMode | "inputs" | "first_prompt", content: string, kind: "output" | "prompt" = "output"): Promise<void> {
    if (!judgeModeRef.current) return Promise.resolve();
    const stepIndex = (judgeStepRef.current[cl.id] = (judgeStepRef.current[cl.id] ?? -1) + 1);
    const full = (content || "").trim();
    // for personality OUTPUTS strip fenced blocks from the logged excerpt; for a prompt
    // step (a "You asked" message) or the Inputs step the content is the prompt itself, keep it.
    const excerpt = (mode === "inputs" || kind === "prompt" ? full : full.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim()).slice(0, 600);
    return new Promise<void>((resolve) => {
      judgeResolve.current = resolve;
      setPendingJudge({ clusterId: cl.id, clusterLabel: cl.label, stepIndex, mode, excerpt, full, kind });
    });
  }

  // submit (with optional note) or skip — close the popup and let the sweep continue.
  const [judgeLogged, setJudgeLogged] = useState(0); // notes logged this sweep (panel footer)
  const [judgeDone, setJudgeDone] = useState<number | null>(null); // set after submit (# judgements logged)
  const [judgeSaveOk, setJudgeSaveOk] = useState<boolean | null>(null); // did the post-submit server save actually persist?
  const [judgeSummaryOpen, setJudgeSummaryOpen] = useState(false); // the "review before submit" popup
  // ⚖️🧠 META-REASONER (Phase 1 stub): the autopilot pauses at each compartment
  // boundary and hands the screen to a full-takeover stub (ledger + Continue). No
  // brain yet — just proves boundary-detection + screen-takeover + ledger-assembly.
  const [metaBoundary, setMetaBoundary] = useState<{ justFinished: number; nextUp: number | null } | null>(null);
  // world-map view toggle (compartment islands ↔ raw UMAP) for the labelling map
  const [wmView, setWmView] = useState<MapView>(hasCompartments(clusters) ? "islands" : "umap");
  const metaResolve = useRef<(() => void) | null>(null);
  function metaGate(justFinished: number, nextUp: number | null): Promise<void> {
    return new Promise<void>((resolve) => {
      metaResolve.current = resolve;
      setMetaBoundary({ justFinished, nextUp });
    });
  }
  function resumeFromMeta() {
    setMetaBoundary(null);
    const r = metaResolve.current;
    metaResolve.current = null;
    if (r) r();
  }
  function resolveJudge(note: string) {
    const pj = pendingJudge;
    if (pj && note.trim()) {
      const who = judgeStepMeta(pj.mode).who;
      const excerpt = pj.kind === "prompt" ? `[prompt to ${who}] ${pj.excerpt}` : pj.excerpt;
      addJudgement({ cluster_id: pj.clusterId, cluster_label: pj.clusterLabel, step_index: pj.stepIndex, mode: pj.mode, content_excerpt: excerpt, note: note.trim(), ts: new Date().toISOString() });
      setJudgeLogged((n) => n + 1);
    }
    setPendingJudge(null);
    const r = judgeResolve.current;
    judgeResolve.current = null;
    if (r) r();
  }
  // live mirror of `labels` so the running loop can skip clusters that got labelled
  // mid-sweep (a prior pass) without rebuilding its closure. "done" is keyed off
  // labels, not `validated` — a cluster can be validated by hand without a label.
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  // what the last auto-pilot run skipped (already labelled) / couldn't finish (errored after retry)
  const [autoReport, setAutoReport] = useState<{ already: number; failed: string[] } | null>(null);
  // auto-pilot "job complete" celebration: green glow on TIER CONFIDENCE with the
  // four settled tiers highlighted, held before the world map re-focuses + advances
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [wmPulse, setWmPulse] = useState(false);

  function addedText(list: Marker[]): string {
    return list.map((m) => `${m.g}${m.l2fc != null ? ` log2FC ${m.l2fc}` : ""}${m.note ? ` — ${m.note}` : ""} [${m.dir ?? "?"}, via ${m.via}]`).join("; ");
  }

  function incorporate(msgKey: string, markers: Marker[], via: AgentMode) {
    const next = mergeMarkers(augmented[active.id] ?? [], markers, via);
    setAugmented((a) => ({ ...a, [active.id]: next }));
    setIncorporated((s) => new Set(s).add(msgKey));
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    refreshConfidence(transcripts[active.id] ?? [], active.id, addedText(next));
  }

  // Reasoner lifting an "also-discussed" gene into the up/down marker list
  function promote(gene: string, dir: "up" | "down", note: string | undefined, via: AgentMode) {
    const cur = augmented[active.id] ?? [];
    const byGene = new Map(cur.map((m) => [m.g.toLowerCase(), m]));
    const ex = byGene.get(gene.toLowerCase());
    byGene.set(gene.toLowerCase(), { ...(ex ?? { g: gene }), g: ex?.g ?? gene, dir, note: note ?? ex?.note, via: via ?? ex?.via ?? "reason" });
    const next = Array.from(byGene.values());
    setAugmented((a) => ({ ...a, [active.id]: next }));
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    refreshConfidence(transcripts[active.id] ?? [], active.id, addedText(next));
  }

  // TIER CONFIDENCE refresh — runs at the end of every turn (and whenever
  // markers change), re-scoring all four tiers from the conversation + the
  // evidence now folded into Top Markers. `confBusy` drives the "updating…" pulse.
  // a live mirror of `augmented` so the streaming cadence ticker reads the
  // freshest markers without waiting for streamAgent's closure to be recreated
  const augmentedRef = useRef(augmented);
  useEffect(() => {
    augmentedRef.current = augmented;
  }, [augmented]);

  const [confBusy, setConfBusy] = useState(false);
  // once a cluster's confidence comes from the Reasoner's conclude `stack`, that is
  // authoritative — the /api/kasperov_confidence side-channel must not overwrite it.
  const concludeConfRef = useRef<Record<string, boolean>>({});
  // published GT label MENU (bins per tier), fetched once per run for the in-chat
  // menu-aware binning step. undefined = not fetched; null = open-vocab (no menu).
  const menuBinsRef = useRef<Record<string, string[]> | null | undefined>(undefined);
  async function getMenuBins(): Promise<Record<string, string[]> | null> {
    if (menuBinsRef.current !== undefined) return menuBinsRef.current;
    try {
      const r = await fetch(`/api/kasperov_fit?dataset=${encodeURIComponent(dataset.id)}`);
      const d = r.ok ? await r.json() : {};
      menuBinsRef.current = d?.bins ?? null;
    } catch {
      menuBinsRef.current = null;
    }
    return menuBinsRef.current ?? null;
  }
  async function refreshConfidence(msgs: ChatMsg[], clusterId: string, added?: string) {
    if (!msgs.some((m) => m.role === "assistant")) return;
    if (concludeConfRef.current[clusterId]) return; // Reasoner stack already drives this cluster
    setConfBusy(true);
    try {
      const r = await fetch("/api/kasperov_confidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: dataset.serveId ?? dataset.id, model, cluster: { id: clusterId, label: active.label }, messages: msgs, addedMarkers: added ?? addedText(augmentedRef.current[clusterId] ?? []) }),
      });
      if (!r.ok) {
        console.warn("[kasperov] confidence refresh failed:", r.status, await r.text().catch(() => ""));
        return;
      }
      const d = await r.json();
      if (d.usage) addUsage(d.usage.model ?? model, d.usage.in ?? 0, d.usage.out ?? 0);
      // a conclude stack may have landed while this request was in flight — don't clobber it
      if (d.tiers && d.tiers.germ_layer && !concludeConfRef.current[clusterId]) {
        const cc: ClusterConf = { ...d.tiers, why: d.why || "" };
        setConfidence((c) => ({ ...c, [clusterId]: cc }));
      }
    } catch (e) {
      console.warn("[kasperov] confidence refresh error:", e);
    } finally {
      setConfBusy(false);
    }
  }

  const msgs = transcripts[active.id] ?? [];
  const started = msgs.length > 0 || streaming;

  useEffect(() => {
    setPrompt(defaultPrompt(active));
    setInReason("");
    setInRes("");
    setInArch("");
    setStatus("");
    setThinking("");
    setText("");
    setStreaming(false);
    setRouting(false);
    setRouted(false);
  }, [active.id]);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    function fit() {
      const el = leftRef.current;
      setZoomW(Math.max(280, (el?.clientWidth ?? 560) - 24));
      if (el) setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [panelW]);

  // start with chat + focused-cluster splitting the screen 50/50
  useEffect(() => {
    setPanelW(Math.round(window.innerWidth / 2));
  }, []);

  // floating panels — natural geometry lifted here (content heights via measureBox,
  // widths via the auto-grow effect); on-screen positions/caps come from fitPanels
  const [pb, setPb] = useState<{ wm: Box; mk: Box; cf: Box } | null>(null);
  const manualRef = useRef(false);
  useEffect(() => {
    if (pb || containerSize.w < 60 || containerSize.h < 60) return;
    setPb({
      wm: { x: 14, y: 14, w: 226, h: 184 },
      mk: { x: 14, y: 210, w: 250, h: 238 },
      cf: { x: 14, y: 462, w: 252, h: 120 },
    });
  }, [containerSize, pb]);

  // ⚖️ persistent judgement panel — its own draggable box, independent of
  // the auto-fit world-map / markers / confidence stack so it never reshuffles them.
  const [jb, setJb] = useState<Box>({ x: 16, y: 250, w: 360, h: 320 });
  const moveJudge = useCallback((x: number, y: number) => setJb((b) => ({ ...b, x, y })), []);
  const resizeJudge = useCallback((w: number, h: number) => setJb((b) => ({ ...b, w, h })), []);

  const moveBox = useCallback((k: "wm" | "mk" | "cf", x: number, y: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], x, y } } : p));
  }, []);
  const resizeBox = useCallback((k: "wm" | "mk" | "cf", w: number, h: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], w, h } } : p));
  }, []);
  // store each auto-fit panel's NATURAL content height; on-screen positions and
  // height caps are derived (fitPanels) so the stack always fits the container
  const measureBox = useCallback((k: "mk" | "cf", h: number) => {
    setPb((p) => (!p || Math.abs(p[k].h - h) < 1 ? p : { ...p, [k]: { ...p[k], h } }));
  }, []);

  // Top Markers fills the left column (width set by fitPanels); only Tier
  // Confidence (right column, below the World Map) sizes to its rationale text.
  useEffect(() => {
    if (manualRef.current) return;
    const why = confidence[active.id]?.why ?? "";
    const cfW = Math.round(Math.min(Math.max(300, Math.round((containerSize.w || 560) * 0.42)), Math.max(280, 280 + why.length * 1.2)));
    setPb((p) => (!p || p.cf.w === cfW ? p : { ...p, cf: { ...p.cf, w: cfW } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidence, active.id, containerSize.w]);

  // on-screen geometry that ALWAYS fits the focused-cluster pane: panels stack,
  // the two auto-fit panels cap their height (scrolling past it), and everything
  // is clamped so nothing is pushed completely off-screen ("playdoh" fit)
  const layout = useMemo(
    () => (pb ? fitPanels(pb, containerSize.w, containerSize.h, manualRef.current) : null),
    [pb, containerSize]
  );

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sText, sThinking, streaming]);

  async function streamAgent(cl: Cluster, nextMsgs: ChatMsg[], forceMode?: AgentMode, fast = false, timeoutMs?: number): Promise<ChatMsg[]> {
    setTranscripts((t) => ({ ...t, [cl.id]: nextMsgs }));
    setStreaming(true);
    setRouting(!fast);
    setRouted(false);
    setStatus("");
    setThinking("");
    setText("");
    // elapsed-time bar, counts up toward the per-personality ceiling (≤300s)
    setElapsed(0);
    const startedAt = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Math.min(300, (Date.now() - startedAt) / 1000)), 250);
    let acc = "";
    let think = ""; // full reasoning trace for this turn (stored on the message)
    let mode: AgentMode = forceMode ?? "research";
    // LIVE CADENCE: while the turn streams, continuously fold the Research Log
    // (reasoning trace) + partial answer into Top Markers (~every 1.1s) and
    // re-score Tier Confidence (~every 5s) — the Researcher spends most of its
    // time reasoning before the answer, so we scrape the log, not just the answer.
    let lastLiveConf = 0;
    const liveTimer = setInterval(() => {
      const log = think ? think + "\n\n" + acc : acc;
      if (!log) return;
      incorporateFrom(cl, log, mode);
      const now = Date.now();
      // re-score confidence often when a human is watching; throttle in auto-pilot
      // (fast) where each cluster fires many sub-streams, to keep token cost sane
      // COST-TRIMMED: the live confidence side-channel runs only in the INTERACTIVE
      // flow (a human is watching). In autopilot (fast) the conclude stack is the source.
      if (!fast && now - lastLiveConf > 5000) {
        lastLiveConf = now;
        refreshConfidence([...nextMsgs, { role: "assistant", content: log.slice(-4000) }], cl.id, addedText(augmentedRef.current[cl.id] ?? []));
      }
    }, 1100);
    // hard timeout so a hung request can't stall the whole auto-pilot sweep
    const ctrl = new AbortController();
    const killTimer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch("/api/kasperov_agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataset: dataset.serveId ?? dataset.id,
          model,
          cluster: { id: cl.id, label: cl.label, degsUp: cl.degsUp, markers: cl.markers, markersDown: cl.markersDown, nCells: cl.nCells },
          messages: nextMsgs,
          ...(forceMode ? { mode: forceMode } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let evt: any;
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.t === "mode") {
            mode = evt.v === "archivist" ? "archivist" : evt.v === "reason" ? "reason" : "research";
            setSMode(mode);
            setRouted(true);
            // hold the selection screen ~2s — it's a feature, let it breathe (skip in auto)
            if (fast) setRouting(false);
            else {
              const wait = Math.max(0, 2000 - (Date.now() - startedAt));
              setTimeout(() => setRouting(false), wait);
            }
          } else if (evt.t === "status") setStatus(evt.v);
          else if (evt.t === "thinking") {
            think += evt.v;
            setThinking((p) => p + evt.v);
          }
          else if (evt.t === "usage") addUsage(evt.v?.model ?? model, evt.v?.in ?? 0, evt.v?.out ?? 0);
          else if (evt.t === "text") {
            acc += evt.v;
            setText(acc);
          } else if (evt.t === "error") {
            acc += `\n\n_Error: ${evt.v}_`;
            setText(acc);
          }
        }
      }
    } catch (e: any) {
      acc += `\n\n_Request failed: ${String(e?.message ?? e)}_`;
    } finally {
      clearInterval(liveTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (killTimer) clearTimeout(killTimer);
      setStreaming(false);
      setRouting(false);
      setStatus("");
      setText("");
      setThinking("");
    }
    const finalMsgs: ChatMsg[] = [...nextMsgs, { role: "assistant", content: acc || "_(no response)_", mode, ...(think.trim() ? { thinking: think.slice(0, 6000) } : {}) }];
    setTranscripts((t) => ({ ...t, [cl.id]: finalMsgs }));
    // final fold of this turn (reasoning log + answer) into Top Markers + confidence
    const mergedMk = incorporateFrom(cl, (think ? think + "\n\n" : "") + acc, mode);
    refreshConfidence(finalMsgs, cl.id, addedText(mergedMk));
    return finalMsgs;
  }

  // Fold a personality's output into Top Markers — called LIVE while it streams
  // (so the box snowballs continuously, off the Research Log, before the final
  // verdict) and again at turn end. Pulls: mentions of known cluster genes in the
  // reasoning prose (lowest priority, but the most frequent live signal), then
  // `**gene** — finding` evidence bullets, then the kasperov-markers block, then
  // promotes — each later source overriding the same personality's earlier note.
  // Ref-based so rapid ticks don't fight stale state; commits only on real change.
  function incorporateFrom(cl: Cluster, content: string, via: AgentMode): Marker[] {
    // include DOWN-regulated genes in the vocab too, so when any personality
    // mentions one (the Archivist/Reasoner can see them) it annotates that row
    const vocab = Array.from(new Set([...(cl.degsUp ?? []), ...((cl.markers ?? []).map((m) => m.g)), ...((cl.markersDown ?? []).map((m) => m.g))]));
    const mentions = via === "archivist" ? [] : extractMentions(content, vocab);
    const evidence = extractEvidenceMarkers(content);
    const block = splitMarkerBlock(content).markers;
    const promotes = splitPromote(content).promotes;
    const cur = augmentedRef.current[cl.id] ?? [];
    let next = cur;
    if (mentions.length) next = mergeMarkers(next, mentions, via);
    if (evidence.length) next = mergeMarkers(next, evidence, via);
    if (block.length) next = mergeMarkers(next, block, via); // authoritative — wins over live scrapes
    if (promotes.length) next = applyPromotes(next, promotes, via);
    if (augSig(next) === augSig(cur)) return cur;
    const grew = next.length > cur.length;
    augmentedRef.current = { ...augmentedRef.current, [cl.id]: next };
    setAugmented((a) => ({ ...a, [cl.id]: next }));
    if (grew) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    }
    return next;
  }

  function runResearch() {
    if (streaming) return;
    streamAgent(active, [{ role: "user", content: prompt }]);
  }
  // send a message forced to a specific personality (via the labelled input line or a button)
  function ask(mode: AgentMode, text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    streamAgent(active, [...msgs, { role: "user", content: t }], mode);
  }

  // ---- AUTO-PILOT: drive the whole loop across every cluster --------------
  // fold a turn's evidence/markers/promotes into Top Markers (same snowball path
  // the interactive flow uses) and refresh confidence. Returns the full merged
  // list so the loop can ground its cite-discipline check on it.
  function autoAddMarkers(cl: Cluster, content: string, via: AgentMode): Marker[] {
    // COST-TRIMMED: no per-turn confidence side-channel in autopilot — the Reasoner's
    // conclude `stack` fills the 4-tier confidence at the end (A/B: 20→0 calls, no label impact).
    return incorporateFrom(cl, content, via);
  }

  // auto-pilot stream with one retry + a hard timeout, so a hung or failed request
  // can't stall the sweep. Throws if it STILL fails — runAutopilot records the
  // cluster as "couldn't finish" and moves on instead of hanging on it.
  async function autoStream(cl: Cluster, msgs: ChatMsg[], mode: AgentMode): Promise<ChatMsg[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (autoAbort.current) throw new Error("aborted");
      const conv = await streamAgent(cl, msgs, mode, true, 285_000);
      const last = conv[conv.length - 1]?.content ?? "";
      if (!streamFailed(last)) return conv;
      if (attempt === 0) await sleep(1200); // brief backoff, then one retry
    }
    throw new Error("stream failed after retry");
  }

  async function runOneCluster(cl: Cluster) {
    let added: Marker[] = augmented[cl.id] ?? [];
    // 0) FIRST QUESTION — the opening "You asked" prompt is judged in the JUDGEMENT box
    //    (moved out of the Inputs popup) BEFORE the Researcher runs.
    await judgeGate(cl, "first_prompt", defaultPrompt(cl), "prompt");
    if (autoAbort.current) return;
    // 1) Researcher — a single grounded identity proposal. (The independent second
    //    opinion + the unconditional Archivist verification were removed; the Reasoner
    //    dispatches the Archivist/Researcher on demand instead.)
    const p1 = await autoStream(cl, [{ role: "user", content: defaultPrompt(cl) }], "research");
    added = autoAddMarkers(cl, p1[p1.length - 1].content, "research");
    await judgeGate(cl, "research", p1[p1.length - 1].content);
    if (autoAbort.current) return;
    let conv: ChatMsg[] = [
      { role: "user", content: defaultPrompt(cl) },
      p1[p1.length - 1],
    ];
    // 2) Reasoner-orchestrated rounds — adjudicate, dispatch follow-ups, conclude
    for (let round = 0; round < AUTO_MAX_ROUNDS; round++) {
      if (autoAbort.current) return;
      // gate the Reasoner PROMPT ("You asked") before it's sent, then its output.
      // Round 0 primes the Archivist dispatch; later rounds the specialists have
      // already replied, so feed their output back and let the Reasoner drive.
      const reasonPrompt = round === 0 ? AUTO_REASON_PROMPT : round === 1 ? AUTO_REASON_CONT : AUTO_REASON_MIN;
      await judgeGate(cl, "reason", reasonPrompt, "prompt");
      if (autoAbort.current) return;
      conv = await autoStream(cl, [...conv, { role: "user", content: reasonPrompt }], "reason");
      let rc = conv[conv.length - 1].content;
      added = autoAddMarkers(cl, rc, "reason");
      await judgeGate(cl, "reason", rc);
      if (autoAbort.current) return;
      let concl = splitConclude(rc).conclude;
      let dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      if (!concl && dispatches.length === 0) {
        // neither concluded nor dispatched → nudge once (gate the nudge prompt + its output)
        await judgeGate(cl, "reason", AUTO_NUDGE_PROMPT, "prompt");
        if (autoAbort.current) return;
        conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_NUDGE_PROMPT }], "reason");
        rc = conv[conv.length - 1].content;
        added = autoAddMarkers(cl, rc, "reason");
        await judgeGate(cl, "reason", rc);
        if (autoAbort.current) return;
        concl = splitConclude(rc).conclude;
        dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      }
      if (concl?.done) {
        // require-evidence-to-name: roll up to abstain if no cited marker is grounded
        const grounded = enforceCiteDiscipline(concl, cl, added);
        // ⚖️ the Reasoner's declared 4-tier stack drives the confidence panel (authoritative)
        if (grounded.stack) { concludeConfRef.current[cl.id] = true; setConfidence((c) => ({ ...c, [cl.id]: grounded.stack as ClusterConf })); }
        onLabel(cl.id, grounded.label);
        onValidate(cl.id, true);
        // ⚖️ MENU-AWARE BINNING — after the (uncontaminated) de-novo call is settled, hand the
        // Reasoner the dataset's published label MENU and have it declare its best fit per tier,
        // in-chat and judgeable. Best-effort: a binning failure never undoes the settled label.
        try {
          const bins = await getMenuBins();
          const tierKeys = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
          const menuBlock = bins ? tierKeys.filter((k) => Array.isArray(bins[k]) && bins[k].length).map((k) => `${k}: [ ${bins[k].join(" | ")} ]`).join("\n") : "";
          if (menuBlock && !autoAbort.current) {
            const binPrompt =
              `=== MENU-EXPOSED PHASE — ${cl.label} ===\n` +
              `Your DE-NOVO call is now LOCKED: "${grounded.label}". From here you are in the MENU-EXPOSED phase — do NOT revise the de-novo answer.\n\n` +
              `Below is the published ZSCAPE label MENU — the ONLY labels the ground truth uses at each tier:\n${menuBlock}\n\n` +
              `Fit your de-novo call to the SINGLE closest existing menu option at EACH tier (germ layer → tissue → cell type broad → cell type sub), each with its own confidence (0-100). Pick ONLY from the menu; never invent a label. ` +
              `Declare it under a "**Menu-aware binning**" heading as four short lines — "<tier>: <menu option> (<confidence>%)". ` +
              `Then REFLECT: for any tier where the menu-aware bin diverges from your de-novo call, say whether that gap is just a MENU-VOCABULARY ARTIFACT (the menu lacks your finer/better term, so the bin is only the closest available label) or a REAL uncertainty in your call. If it's real uncertainty — not just a vocabulary gap — say whether you'd want more research/thinking before trusting the menu-aware bin, and lower that tier's confidence accordingly. ` +
              `FINALLY, end with a clear "### ✅ CLUSTER COMPLETE — ${cl.label}" block that restates BOTH final answers side by side, so it is unambiguous the cluster is finished: a "**De-novo:**" line and a "**Menu-exposed:**" line, each giving germ layer / tissue / cell type broad / cell type sub with their confidences. This step does NOT change your de-novo answer.`;
            await judgeGate(cl, "reason", binPrompt, "prompt");
            if (!autoAbort.current) {
              const bconv = await autoStream(cl, [...conv, { role: "user", content: binPrompt }], "reason");
              await judgeGate(cl, "reason", bconv[bconv.length - 1].content);
            }
          }
        } catch (e) {
          console.warn("[kasperov] menu-binning step failed:", e);
        }
        return;
      }
      for (const d of dispatches) {
        if (autoAbort.current) return;
        // gate the "You asked" follow-up PROMPT before it's sent (a judgeable step of its own)…
        await judgeGate(cl, d.to, d.prompt, "prompt");
        if (autoAbort.current) return;
        conv = await autoStream(cl, [...conv, { role: "user", content: d.prompt }], d.to);
        added = autoAddMarkers(cl, conv[conv.length - 1].content, d.to);
        // …then gate the personality's OUTPUT.
        await judgeGate(cl, d.to, conv[conv.length - 1].content);
        if (autoAbort.current) return;
      }
    }
    // ran out of rounds — accept best-effort so the loop keeps moving
    onValidate(cl.id, true);
    if (!labels[cl.id]) onLabel(cl.id, "(unresolved — review)");
  }

  async function runAutopilot() {
    if (auto.running) return;
    autoAbort.current = false;
    judgeStepRef.current = {}; // fresh gated-step ordinals for this sweep
    setJudgeLogged(0);
    setJudgeDone(null); // clear any prior "logged" confirmation for the fresh run
    setJudgeSaveOk(null);
    setJudgeSummaryOpen(false);
    setAutoReport(null);
    // auto-detect & skip clusters that already have a cell-type label (= done).
    // NB: keyed off labels, not `validated` — a cluster can be validated by hand
    // without a label, and those still need the labeller to run.
    const alreadyLabelled = clusters.filter((c) => labels[c.id]).length;
    // STEP 2: walk compartment-by-compartment. Stable sort by compartmentIndex keeps
    // leaves contiguous within a compartment; flat partitions (no index) are untouched.
    const queue = clusters
      .filter((c) => !labels[c.id])
      .slice()
      .sort((a, b) => (a.compartmentIndex ?? Infinity) - (b.compartmentIndex ?? Infinity));
    const failed: string[] = [];
    setAuto({ running: true, current: null, done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      if (autoAbort.current) break;
      const c = queue[i];
      // skip if it got labelled since the queue was built (a prior pass)
      if (labelsRef.current[c.id]) {
        setAuto((a) => ({ ...a, done: i + 1 }));
        continue;
      }
      setAuto((a) => ({ ...a, current: c.id, done: i }));
      goToCluster(c.id);
      await sleep(80); // let the per-cluster reset effect settle before streaming
      try {
        await runOneCluster(c);
        // CELEBRATE the completed four-tier call: glow the TIER CONFIDENCE box and
        // hold the highlighted germ-layer/tissue/broad/sub outcomes before moving on
        if (!autoAbort.current) {
          setCelebrateId(c.id);
          await sleep(3300);
          setCelebrateId(null);
          // then expand the world map + a subtle shift as it re-focuses the next cluster
          if (i < queue.length - 1) {
            setWmPulse(true);
            await sleep(800);
            setWmPulse(false);
          }
        }
        // STEP 3: HIERARCHY BOUNDARY — fire when the last leaf of a compartment finishes
        // and another compartment still remains. Triggered by the compartment changing,
        // NOT a cluster count. STEP 4: pause the sweep on the Meta-Reasoner stub.
        const next = queue[i + 1];
        const atBoundary =
          !autoAbort.current &&
          typeof c.compartmentIndex === "number" &&
          !!next &&
          next.compartmentIndex !== c.compartmentIndex;
        if (atBoundary) {
          await metaGate(c.compartmentIndex!, next!.compartmentIndex ?? null);
          if (autoAbort.current) break;
        }
      } catch {
        failed.push(c.id); // errored after retry — record it and keep going
      }
    }
    setAuto((a) => ({ ...a, running: false, current: null, done: a.total }));
    if (!autoAbort.current) {
      setAutoReport({ already: alreadyLabelled, failed });
      if (failed.length) console.warn("[auto-pilot] could not finish clusters:", failed.join(", "));
      onAutoDone?.(); // signal the timelapse capturer that the sweep finished
    }
  }
  function stopAutopilot() {
    autoAbort.current = true;
    setAuto((a) => ({ ...a, running: false }));
    // unblock any open judgement gate so the (now-aborting) sweep can unwind
    if (pendingJudge) { setPendingJudge(null); const r = judgeResolve.current; judgeResolve.current = null; if (r) r(); }
    // unblock an open Meta-Reasoner boundary gate too
    if (metaResolve.current) { setMetaBoundary(null); const r = metaResolve.current; metaResolve.current = null; r(); }
  }

  // ⚖️ Submit judgements & finish — confirmed from the review popup: stop the sweep,
  // persist the run (with all judgements) to the server store, then show the clear
  // "logged / Steven notified" confirmation with the back-to-home exit.
  async function endRunAndLog() {
    const n = nJudgements;
    setJudgeSummaryOpen(false);
    stopAutopilot();
    let ok = false;
    try { ok = !!(await onLogJudgements()); } catch (e) { console.warn("[judgement] log failed:", e); }
    setJudgeSaveOk(ok); // gate the confirmation screen on the ACTUAL save result
    setJudgeDone(n);
  }

  // ⚖️ retry the server save from the "save failed" confirmation screen, without
  // re-running the sweep — just re-post and update the success flag.
  async function retryLogJudgements() {
    let ok = false;
    try { ok = !!(await onLogJudgements()); } catch (e) { console.warn("[judgement] retry failed:", e); }
    setJudgeSaveOk(ok);
  }

  // kick off ONLY when the world-map auto-pilot button bumps autoStart. The
  // consumed-marker lives in the parent (autoConsumedRef), so re-mounting
  // ClusterStage via a plain cluster click never re-triggers a sweep.
  useEffect(() => {
    if (autoStart > 0 && autoStart !== autoConsumedRef.current) {
      autoConsumedRef.current = autoStart;
      runAutopilot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const isValidated = validated.has(active.id);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: PAPER, color: INK }}>
      {/* per-step critique is captured in the persistent draggable JUDGEMENT box (below),
          not a modal — the box live-updates and pauses at each personality's turn. */}
      {judgeSummaryOpen && <JudgeSummaryModal judgements={judgements} onBack={() => setJudgeSummaryOpen(false)} onSubmit={endRunAndLog} />}
      {metaBoundary && (
        <MetaReasonerStub
          justFinished={metaBoundary.justFinished}
          nextUp={metaBoundary.nextUp}
          clusters={clusters}
          labels={labels}
          confidence={confidence}
          onContinue={resumeFromMeta}
          model={model}
          priorDescentAttempts={Object.entries(metaDecisions).reduce((acc: Record<string, number>, [ci, r]: any) => {
            if (Number(ci) < metaBoundary.justFinished && r?.decision?.action === "descend" && r.decision.target) {
              const k = String(r.decision.target).trim().toLowerCase(); acc[k] = (acc[k] || 0) + 1;
            }
            return acc;
          }, {})}
          onDecision={(r) => onMetaDecision(metaBoundary.justFinished, r)}
        />
      )}
      <style>{`
        @keyframes kpulse{0%,100%{opacity:.45}50%{opacity:1}}
        @keyframes kscan{0%,100%{transform:translateY(0) scale(1);box-shadow:0 0 0 0 rgba(14,116,144,0)}50%{transform:translateY(-3px) scale(1.03);box-shadow:0 6px 16px rgba(0,0,0,.10)}}
        @keyframes kflash{0%{box-shadow:0 0 0 0 rgba(67,56,202,.5)}100%{box-shadow:0 0 0 14px rgba(67,56,202,0)}}
        @keyframes kpop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes kcelebrate{0%,100%{box-shadow:0 0 0 1px #15803d55,0 2px 14px rgba(21,128,61,.18)}50%{box-shadow:0 0 0 2px #15803d99,0 4px 22px rgba(21,128,61,.45)}}
        @keyframes kexpand{0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}
        @keyframes krowglow{0%{background:rgba(21,128,61,0)}30%{background:rgba(21,128,61,.14)}100%{background:rgba(21,128,61,.06)}}
      `}</style>

      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderBottom: "1px solid #e5e1dc", background: "#fffdfb" }}>
        <button onClick={onBack} style={btnGhost}>← World map</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: active.color }} />
          <strong style={{ fontSize: 16 }}>{active.compartmentLabel ?? active.label}</strong>
        </div>
        <span style={{ fontSize: 13, color: "#888" }}>{active.nCells.toLocaleString()} cells</span>
        {labels[active.id] && <span style={{ fontSize: 12.5, color: THEME.reason.color, fontWeight: 600, background: THEME.reason.bg, padding: "2px 8px", borderRadius: 99 }}>{labels[active.id]}</span>}
        {auto.running && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: THEME.reason.color, background: THEME.reason.bg, padding: "4px 10px", borderRadius: 99 }}>
            <span style={{ animation: "kpulse 1s infinite" }}>🤖</span> Auto-pilot · cluster {auto.done + 1}/{auto.total}
            <button onClick={stopAutopilot} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>■ Stop</button>
          </span>
        )}
        {!auto.running && autoReport && (autoReport.failed.length > 0 || autoReport.already > 0) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: autoReport.failed.length ? "#b91c1c" : "#15803d", background: autoReport.failed.length ? "#fef2f2" : "#f0fdf4", padding: "4px 10px", borderRadius: 99 }}>
            {autoReport.already > 0 && <span>skipped {autoReport.already} already-labelled</span>}
            {autoReport.failed.length > 0 && (
              <>
                <span>
                  {autoReport.already > 0 ? "· " : ""}
                  {autoReport.failed.length} couldn&apos;t finish: {autoReport.failed.map((id) => clusters.find((c) => c.id === id)?.label.replace("Cluster ", "C") ?? id).join(", ")}
                </span>
                <button onClick={() => { setAutoReport(null); runAutopilot(); }} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Retry these</button>
              </>
            )}
            <button onClick={() => setAutoReport(null)} title="Dismiss" style={{ background: "transparent", border: "none", color: "#999", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </span>
        )}
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>{validated.size}/{clusters.length} validated</div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT — focused cluster + floating HUD panels */}
        <div ref={leftRef} style={{ flex: "1 1 0", position: "relative", minWidth: 260, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #fffefc, #f1ede8)" }}>
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#bbb", textTransform: "uppercase", letterSpacing: 1, pointerEvents: "none" }}>Focused cluster</div>
          <UmapCanvas clusters={clusters} mode="zoom" colored activeId={active.id} validated={validated} width={zoomW} height={Math.round(zoomW * 0.8)} />

          {layout && (
            <>
              {/* world map — draggable + resizable; pulses/expands as auto-pilot re-focuses */}
              <DraggablePanel title="WORLD MAP" accent="#999" box={layout.wm.box} minW={150} minH={120} effect={wmPulse ? "pulse" : null} onMove={(x, y) => moveBox("wm", x, y)} onResize={(w, h) => resizeBox("wm", w, h)}>
                {(w, h) => (
                  <div style={{ width: w, height: h, position: "relative" }}>
                    {hasCompartments(clusters) && (
                      <div style={{ position: "absolute", top: 2, right: 2, zIndex: 2 }}>
                        <MapViewSwitch view={wmView} setView={setWmView} compact />
                      </div>
                    )}
                    {wmView === "islands" && hasCompartments(clusters)
                      ? <CompartmentMap clusters={clusters} activeId={active.id} validated={validated} width={w} height={h} onPick={goToCluster} dimUnfocused />

                      : <UmapCanvas clusters={clusters} mode="global" colored activeId={active.id} validated={validated} width={w} height={h} showFocus />}
                  </div>
                )}
              </DraggablePanel>

              {/* top markers — grows with content, capped to stay on-screen (scrolls past the cap) */}
              <DraggablePanel
                title={`TOP MARKERS${(augmented[active.id] ?? []).length ? ` · +${(augmented[active.id] ?? []).length} from chat` : ""}`}
                accent="#8a847b"
                box={layout.mk.box}
                maxH={layout.mk.maxH}
                minW={190}
                flash={flash}
                autoFitHeight
                onMove={(x, y) => moveBox("mk", x, y)}
                onResize={(w, h) => resizeBox("mk", w, h)}
                onMeasure={(h) => measureBox("mk", h)}
              >
                {() => <MarkersContent cluster={active} added={augmented[active.id] ?? []} />}
              </DraggablePanel>

              {/* TIER CONFIDENCE — always visible HUD; its four numbers tween up/down
                  every turn. Grows with content but stays on-screen below Top Markers. */}
              <DraggablePanel
                title={celebrateId === active.id ? "TIER CONFIDENCE · ✓ COMPLETE" : "TIER CONFIDENCE"}
                accent="#8a847b"
                box={layout.cf.box}
                maxH={layout.cf.maxH}
                minW={230}
                flash={flash}
                autoFitHeight
                effect={celebrateId === active.id ? "celebrate" : null}
                onMove={(x, y) => moveBox("cf", x, y)}
                onResize={(w, h) => resizeBox("cf", w, h)}
                onMeasure={(h) => measureBox("cf", h)}
              >
                {() => <ConfidenceContent conf={confidence[active.id]} busy={confBusy} celebrate={celebrateId === active.id} />}
              </DraggablePanel>
            </>
          )}

          {/* ⚖️ JUDGEMENT — persistent, draggable critique box (judgement runs). Replaces
              the per-step modal popup: it stays present through the sweep and live-updates
              to the current step (Researcher → Researcher 2nd → Archivist → Reasoner rounds
              → conclude), pausing for a note at each. The pre-run Inputs popup is separate. */}
          {judgementMode && (
            <DraggablePanel title="⚖️ JUDGEMENT" accent="#7c3aed" box={jb} minW={250} minH={170} pinTop onMove={moveJudge} onResize={resizeJudge}>
              {(w, h) => (
                <JudgePanelContent
                  pending={pendingJudge}
                  liveMode={sMode}
                  streaming={streaming}
                  autoRunning={auto.running}
                  nLogged={judgeLogged}
                  onResolve={resolveJudge}
                  onEndAndLog={() => setJudgeSummaryOpen(true)}
                  onHome={onBack}
                  logged={judgeDone}
                  savedOk={judgeSaveOk}
                  onDownload={onDownloadJudgements}
                  onRetry={retryLogJudgements}
                  height={h}
                />
              )}
            </DraggablePanel>
          )}
        </div>

        {/* draggable splitter — resize the focused-cluster view vs the chat */}
        <div
          onMouseDown={startDrag}
          title="Drag to resize"
          style={{ width: 7, flexShrink: 0, cursor: "col-resize", background: "#e2ddd5", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
        >
          <div style={{ width: 2, height: 30, borderRadius: 2, background: "#bdb6ae" }} />
        </div>

        {/* CHAT — the agent chat (Reasoner / Researcher / Archivist), resizable */}
        <aside style={{ width: panelW, flexShrink: 0, minWidth: 320, background: "#fffdfb", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid #f0ece7" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#555", fontWeight: 600 }}>{model}</div>
            <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>Searches ZFIN · ZFA · GO for this cluster&apos;s markers. You judge the result.</div>
          </div>

          <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {msgs.length === 0 && !streaming && (
              <div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Pre-filled from the cluster&apos;s top DEGs — edit if you like, then run it.</div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", minHeight: 130, padding: 10, border: "1px solid #d8d3cd", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", background: "#fff" }} />
                <button onClick={runResearch} style={{ ...btnPrimary, background: THEME.research.color, width: "100%", marginTop: 10 }}>▶ Run research agent</button>
              </div>
            )}

            {msgs.map((m, i) => {
              const mk = m.role === "assistant" ? splitMarkerBlock(m.content) : { clean: m.content, markers: [] as Marker[] };
              const dp = m.role === "assistant" ? splitDispatch(mk.clean) : { clean: mk.clean, dispatches: [] as { to: AgentMode; prompt: string }[] };
              const pr = m.role === "assistant" ? splitPromote(dp.clean) : { clean: dp.clean, promotes: [] as { gene: string; dir: "up" | "down"; note?: string }[] };
              const cc = m.role === "assistant" ? splitConclude(pr.clean) : { clean: pr.clean, conclude: null as Conclude | null };
              // enforce require-evidence-to-name before showing the accept button
              const grounded = cc.conclude ? enforceCiteDiscipline(cc.conclude, active, augmented[active.id] ?? []) : null;
              const parsed = { clean: cc.clean, markers: mk.markers };
              const key = `${active.id}:${i}`;
              const canAdd = parsed.markers.length > 0 && !incorporated.has(key);
              const isLast = m.role === "assistant" && i === msgs.length - 1 && !streaming;
              const actions =
                m.role === "assistant" ? (
                  <>
                    {grounded && (
                      <button
                        onClick={() => {
                          onLabel(active.id, grounded.label);
                          onValidate(active.id, true);
                          // ⚖️ adopt the Reasoner's declared 4-tier stack as the confidence panel
                          if (grounded.stack) { concludeConfRef.current[active.id] = true; setConfidence((c) => ({ ...c, [active.id]: grounded.stack as ClusterConf })); }
                        }}
                        title={grounded.decision === "abstain" ? "Require-evidence-to-name: no cited marker was one of this cluster's DEGs, so this rolls up to an abstention." : grounded.citedMarkers?.length ? `Grounded on: ${grounded.citedMarkers.join(", ")}` : undefined}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: validated.has(active.id) ? "#15803d" : "#fff", border: `1px solid ${grounded.decision === "abstain" ? "#a16207" : "#15803d"}`, color: validated.has(active.id) ? "#fff" : grounded.decision === "abstain" ? "#a16207" : "#15803d", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        {validated.has(active.id) ? "✓ Accepted" : grounded.decision === "abstain" ? "⤴ Accept (abstain/roll-up)" : "✓ Accept identity"}: {grounded.label}
                      </button>
                    )}
                    {/* markers + promotes are now folded into Top Markers / TIER
                        CONFIDENCE automatically at the end of each turn — no button.
                        Show a quiet receipt of what this turn contributed. */}
                    {(parsed.markers.length > 0 || pr.promotes.length > 0) && (
                      <span style={{ fontSize: 11, color: "#999", fontWeight: 600, alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ color: THEME[m.mode ?? "research"].color }}>✓</span> folded {parsed.markers.length + pr.promotes.length} insight{parsed.markers.length + pr.promotes.length === 1 ? "" : "s"} into Top Markers
                      </span>
                    )}
                    {dp.dispatches.map((d, di) => (
                      <button
                        key={di}
                        onClick={() => streamAgent(active, [...msgs, { role: "user", content: d.prompt }], d.to)}
                        disabled={streaming}
                        title={d.prompt}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${THEME[d.to].color}66`, color: THEME[d.to].color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: streaming ? "default" : "pointer", opacity: streaming ? 0.5 : 1 }}
                      >
                        {THEME[d.to].icon} ▶ Send to the {THEME[d.to].name} →
                      </button>
                    ))}
                    {/* safety net: a specialist that defers / asks you to choose gets a one-click "just do it" */}
                    {isLast && m.mode !== "reason" && looksStuck(parsed.clean) && (
                      <button
                        onClick={() => ask(m.mode ?? "archivist", "Yes — go ahead and run the query now and return the full result for everything I asked. Don't ask me to choose or summarise; just fetch and report it all.")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME[m.mode ?? "archivist"].color, border: `1px solid ${THEME[m.mode ?? "archivist"].color}`, color: "#fff", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        ▶ Yes — just run it and show everything →
                      </button>
                    )}
                    {/* always offer to hand back to the Reasoner for the next step */}
                    {isLast && m.mode !== "reason" && (
                      <button
                        onClick={() => ask("reason", "Summarize what we've established for this cluster so far, then suggest the next steps — or tell me if we're done.")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.reason.bg, border: `1px solid ${THEME.reason.color}66`, color: THEME.reason.color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        🧠 Ask Reasoner to Summarize and Suggest Next Steps →
                      </button>
                    )}
                  </>
                ) : undefined;
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: m.role === "user" ? "#999" : THEME[m.mode ?? "research"].color, fontWeight: 600, marginBottom: 3 }}>
                    {m.role === "user" ? (i === 0 ? "You asked — the first question" : "You asked") : `${model}${m.mode ? ` · ${THEME[m.mode].name}` : ""}`}
                  </div>
                  {m.role === "user" ? (
                    <>
                      <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, border: "1px solid #e2ded8", borderLeft: "3px solid #b0a99f", borderRadius: 8, background: "#faf8f6", padding: "8px 10px" }}>{m.content}</div>
                      {/* make it obvious the (separate) system prompt + briefing is also in play */}
                      {i === 0 && dataset && <SystemPromptDisclosure datasetId={dataset.serveId ?? dataset.id} model={model} cluster={active} />}
                    </>
                  ) : (
                    <AgentMessage content={parsed.clean} mode={m.mode} actions={actions} thinking={m.thinking} />
                  )}
                </div>
              );
            })}

            {/* router: three specialists, ~1s to decide, then the chosen one lights up */}
            {streaming && routing && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12.5, color: "#888", marginBottom: 10, animation: "kpulse 1.4s ease-in-out infinite" }}>
                  {routed ? `→ Routing to the ${THEME[sMode].name}…` : "Choosing the right specialist…"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MODES.map((mk, idx) => {
                    const th = THEME[mk];
                    const isChosen = routed && mk === sMode;
                    const dim = routed && mk !== sMode;
                    return (
                      <div
                        key={mk}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "12px 6px",
                          borderRadius: 10,
                          border: `1.5px solid ${isChosen ? th.color : "#e5e1dc"}`,
                          background: isChosen ? th.bg : "#fffdfb",
                          opacity: dim ? 0.4 : 1,
                          transform: isChosen ? "scale(1.04)" : "scale(1)",
                          transition: "all .35s ease",
                          animation: routed ? "none" : `kscan 1.1s ease-in-out ${idx * 0.18}s infinite`,
                        }}
                      >
                        <div style={{ fontSize: 22 }}>{th.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isChosen ? th.color : "#555", marginTop: 2 }}>{th.name}</div>
                        <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{th.blurb}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* working view — themed per chosen personality */}
            {streaming && !routing && (
              <div style={{ marginTop: 4, animation: "kpop .3s ease" }}>
                {/* personality banner */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: THEME[sMode].color, background: THEME[sMode].bg, border: `1px solid ${THEME[sMode].color}33`, borderRadius: 99, padding: "3px 10px", marginBottom: 8 }}>
                  <span>{THEME[sMode].icon}</span> {THEME[sMode].name} at work
                </div>
                {/* elapsed-time bar in the personality's colour */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ position: "relative", flex: 1, height: 5, background: "#ece8e3", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (elapsed / TURN_MAX_S[sMode]) * 100)}%`, height: "100%", background: THEME[sMode].color, borderRadius: 99, transition: "width .25s linear" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#999", fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}>{elapsed.toFixed(0)}s / {TURN_MAX_S[sMode]}s</span>
                </div>
                {/* live status — themed verb */}
                <div style={{ fontSize: 12.5, color: THEME[sMode].color, marginBottom: 8, animation: "kpulse 1.6s ease-in-out infinite" }}>
                  {THEME[sMode].icon} {sStatus || THEME[sMode].verb}
                </div>
                {/* the live bubble — the reasoning trace (e.g. RESEARCH LOG) sits
                    INSIDE it: open and growing while thinking, collapsing to one
                    line once the settled answer streams in below it */}
                {sThinking || sText ? (
                  <AgentMessage
                    content={sText ? splitConclude(splitPromote(splitDispatch(splitMarkerBlock(sText).clean).clean).clean).clean : ""}
                    mode={sMode}
                    thinking={sThinking}
                    thinkingCollapsed={!!sText}
                    pending={!sText}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>{THEME[sMode].verb}</div>
                )}
              </div>
            )}
          </div>

          {/* footer: three personality input lines + judge */}
          {started && (
            <div style={{ borderTop: "1px solid #f0ece7", padding: "10px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 9 }}>
                <AskLine mode="reason" value={inReason} setValue={setInReason} onSend={() => { ask("reason", inReason); setInReason(""); }} enabled={!streaming && !auto.running} locked={false} />
                <AskLine mode="research" value={inRes} setValue={setInRes} onSend={() => { ask("research", inRes); setInRes(""); }} enabled={!streaming && !auto.running} locked={false} />
                <AskLine mode="archivist" value={inArch} setValue={setInArch} onSend={() => { ask("archivist", inArch); setInArch(""); }} enabled={!streaming && !auto.running} locked={false} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onValidate(active.id, !isValidated)}
                  style={{ flex: 1, padding: "11px", borderRadius: 8, border: `1.5px solid ${isValidated ? "#444" : "#bdb6ae"}`, background: isValidated ? "#444" : "#fffdfb", color: isValidated ? "#fff" : "#555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  {isValidated ? "✓ Identity validated" : "✓ Accept this identity"}
                </button>
                <button onClick={onBack} style={btnGhost}>Next →</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Focused-cluster markers panel — HUD aesthetic matching the world map
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// A floating panel that can be dragged (by its header) and resized (corner).
// children may be a render-prop receiving the inner content (w,h).
// ---------------------------------------------------------------------------
let zTop = 20; // shared stacking counter — last interacted panel sits on top

// Lay the HUD panels out so they ALWAYS fit the focused-cluster pane. TWO
// columns: World Map sits in the top-RIGHT corner with Tier Confidence beneath
// it, leaving the whole LEFT column to Top Markers — which gets full height and
// most of the width, so the entire UP + DOWN gene set stays visible. Auto-fit
// panels still cap their height (scroll past it) and everything is clamped so
// nothing is pushed off-screen. Returns each panel's display box + optional cap.
function fitPanels(
  pb: { wm: Box; mk: Box; cf: Box },
  W: number,
  H: number,
  manual: boolean
): { wm: { box: Box; maxH?: number }; mk: { box: Box; maxH?: number }; cf: { box: Box; maxH?: number } } {
  const GAP = 12, M = 10;
  const cw = (w: number) => Math.max(160, Math.min(w, Math.max(160, W - 8)));
  const cx = (x: number) => Math.max(2, Math.min(x, Math.max(2, W - 48)));
  const cy = (y: number) => Math.max(2, Math.min(y, Math.max(2, H - 26)));
  if (manual) {
    // respect the user's positions/sizes, but clamp so nothing leaves the pane
    const fix = (b: Box, auto: boolean) => {
      const x = cx(b.x), y = cy(b.y);
      return { box: { ...b, x, y, w: cw(b.w) }, maxH: auto ? Math.max(80, H - y - M) : undefined };
    };
    return { wm: fix(pb.wm, false), mk: fix(pb.mk, true), cf: fix(pb.cf, true) };
  }
  // RIGHT column (World Map on top, Tier Confidence below) — share one width,
  // capped at ~36% of the pane so the LEFT column (Top Markers) stays wide
  const rightW = Math.max(180, Math.min(Math.max(cw(pb.wm.w), cw(pb.cf.w)), Math.round(W * 0.36)));
  const rightX = Math.max(M, W - rightW - M);
  const cfY = 12 + pb.wm.h + GAP;
  const cfMin = 92;
  // LEFT column: Top Markers fills it — full height, wide
  const mkX = M;
  const mkW = Math.max(240, rightX - GAP - mkX);
  return {
    wm: { box: { ...pb.wm, x: rightX, y: 12, w: rightW }, maxH: undefined },
    mk: { box: { ...pb.mk, x: mkX, y: 12, w: mkW }, maxH: Math.max(160, H - 12 - M) },
    cf: { box: { ...pb.cf, x: rightX, y: cfY, w: rightW }, maxH: Math.max(cfMin, H - cfY - M) },
  };
}

function DraggablePanel({
  title,
  accent,
  box,
  minW = 160,
  minH = 90,
  flash = false,
  autoFitHeight = false,
  maxH,
  effect = null,
  pinTop = false,
  onMove,
  onResize,
  onMeasure,
  children,
}: {
  title: string;
  accent: string;
  box: Box;
  minW?: number;
  minH?: number;
  flash?: boolean;
  autoFitHeight?: boolean;
  maxH?: number; // cap the auto-fit height; the body scrolls past it (keeps panels on-screen)
  effect?: "celebrate" | "pulse" | null; // celebrate = green completion glow; pulse = brief expand
  pinTop?: boolean; // always sit above the other panels (the JUDGEMENT box)
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMeasure?: (h: number) => void;
  children: (w: number, h: number) => React.ReactNode;
}) {
  const [z, setZ] = useState(() => ++zTop);
  const raise = () => { if (!pinTop) setZ(++zTop); };
  const HEADER = 24;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // auto-fit panels report their NATURAL content height (independent of any cap)
  // so the parent can lay all panels out to fit the container
  useEffect(() => {
    if (!autoFitHeight || !onMeasure) return;
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const report = () => onMeasure(HEADER + el.offsetHeight + 6);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [autoFitHeight, onMeasure]);

  const capped = autoFitHeight && maxH != null;

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    raise();
    const sx = e.clientX, sy = e.clientY, ox = box.x, oy = box.y;
    const move = (ev: MouseEvent) => onMove(Math.max(0, ox + ev.clientX - sx), Math.max(0, oy + ev.clientY - sy));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    raise();
    const sx = e.clientX, sy = e.clientY, ow = box.w, oh = box.h;
    const move = (ev: MouseEvent) => onResize(Math.max(minW, ow + ev.clientX - sx), autoFitHeight ? box.h : Math.max(minH, oh + ev.clientY - sy));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      ref={rootRef}
      onMouseDown={raise}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: autoFitHeight ? "auto" : box.h,
        maxHeight: capped ? maxH : undefined,
        zIndex: pinTop ? 990 : z, // above the other HUD panels (zTop range), below the modals (≥1000)
        background: effect === "celebrate" ? "rgba(240,253,244,0.97)" : "rgba(255,253,251,0.96)",
        border: `1px solid ${effect === "celebrate" ? "#15803d66" : accent + "44"}`,
        borderTop: `2px solid ${effect === "celebrate" ? "#15803d" : accent}`,
        borderRadius: 10,
        boxShadow: effect === "celebrate" ? "0 0 0 1px #15803d55, 0 2px 18px rgba(21,128,61,0.25)" : "0 2px 10px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: effect === "celebrate" ? "kcelebrate 1.5s ease-in-out infinite" : effect === "pulse" ? "kexpand .8s ease-in-out" : flash ? "kflash .9s ease-out" : "none",
        transition: "top .25s ease, left .25s ease, width .25s ease, max-height .2s ease",
      }}
    >
      <div onMouseDown={startDrag} style={{ height: HEADER, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: accent, userSelect: "none" }}>
        <span style={{ opacity: 0.5 }}>⠿</span> {title}
      </div>
      <div style={{ flex: autoFitHeight ? "0 0 auto" : 1, minHeight: 0, maxHeight: capped ? Math.max(40, (maxH as number) - HEADER) : undefined, overflowY: capped ? "auto" : autoFitHeight ? "visible" : "auto", overflowX: "hidden", padding: "0 8px 6px" }}>
        <div ref={contentRef}>{children(box.w - 16, autoFitHeight ? 0 : box.h - HEADER - 12)}</div>
      </div>
      <div onMouseDown={startResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, cursor: "nwse-resize", color: accent, opacity: 0.5, fontSize: 11, lineHeight: "14px", textAlign: "right" }}>◢</div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// btnPrimary, btnGhost → ./theme
