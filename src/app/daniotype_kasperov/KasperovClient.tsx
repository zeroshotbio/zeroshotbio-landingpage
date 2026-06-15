"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KASPEROV_MODELS, DEFAULT_MODEL, estimateCost, projectRunCost, modelInfo, type KasperovModel } from "./models";
import DATASET_FACTS from "./dataset_facts.json";
import HARNESS_REGISTRY from "./harness_registry.json";

// Wizard assets are served statically by nginx (daniotype_data/), NOT by the gated Vercel
// asset route — keeps the Vercel function bundle slim. The browser fetches umap/groundtruth
// cross-origin (nginx sends CORS for www.zeroshot.bio).
const ASSET_BASE = "https://zscape.zeroshot.bio/daniotype_data";
// Rich per-dataset facts generated from the real assets/scorecards/sweeps (scripts/gen_dataset_facts.py)
const FACTS: Record<string, any> = DATASET_FACTS as any;

const MODEL_KEY = "daniotype_kasperov_model"; // selected model persists globally
type Usage = Record<string, { in: number; out: number }>; // tokens keyed by model id
type TierAgg = { key: string; label: string; matched: number; total: number; pct: number };
type PctCount = { matched: number; total: number; pct: number };
type SubStrat = { headline: string; high: PctCount; low: PctCount; raw: PctCount; weighted_pct: number };
type FailCount = { fail: number; total: number; pct: number };
type AbstentionStat = { n_assign: number; n_abstain: number; n_unresolved: number; abstained_forced_sub_fail: FailCount; assigned_forced_sub_fail: FailCount };
type RunScore = { verdicts: Record<string, ClusterVerdict>; scoredAt: string | null; agg: TierAgg[]; subStrat?: SubStrat | null; abstention?: AbstentionStat | null };

// Per-cluster characterization: a prediction + confidence at each of the four
// ontology tiers — the goal of a cluster's work is to drive these confidences up.
type TierPred = { prediction: string; pct: number };
type ClusterConf = { germ_layer: TierPred; tissue: TierPred; cell_type_broad: TierPred; cell_type_sub: TierPred; why?: string };
const CONF_TIERS: { key: keyof Omit<ClusterConf, "why">; gtKey: string; label: string }[] = [
  { key: "germ_layer", gtKey: "germ_layer", label: "Germ layer" },
  { key: "tissue", gtKey: "tissue", label: "Tissue" },
  { key: "cell_type_broad", gtKey: "cell_type_broad", label: "Cell type — broad" },
  { key: "cell_type_sub", gtKey: "cell_type_sub", label: "Cell type — sub" },
];
function overallConf(cc?: ClusterConf): number | undefined {
  if (!cc) return undefined;
  const ps = [cc.germ_layer, cc.tissue, cc.cell_type_broad, cc.cell_type_sub].map((t) => t?.pct).filter((x): x is number => typeof x === "number");
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : undefined;
}

// ---------------------------------------------------------------------------
const PAPER = "#f6f4f2";
const INK = "#2b2b2b";
const ACCENT = "#0e7490";
const STORAGE_BASE = "daniotype_kasperov_v3";
const RESULTS_BASE = "daniotype_kasperov_results"; // full run history: transcripts + markers + confidence
// per-dataset storage so each dataset's run is independent
const storageKey = (d: string) => `${STORAGE_BASE}:${d}`;
const resultsKey = (d: string) => `${RESULTS_BASE}:${d}`;

// ---------------------------------------------------------------------------
// Dataset registry — each entry points the same wizard at a different atlas.
// ZSCAPE / CHEMFISH carry published cell-type labels (ground truth) we score
// our de-novo names against; MiniFin and MegaFin Part 1 have no published labels.
// ---------------------------------------------------------------------------
type DatasetId = "minifin" | "zscape" | "zscape_v2" | "chemfish" | "megafin" | "megafin_parse" | "daniocell";
interface DatasetDef {
  id: DatasetId;
  name: string;
  tagline: string;
  blurb: string;
  dataUrl: string; // umap.json
  archivistBase: string; // dir holding <cluster>.json + gene_matrix.json
  groundTruthUrl: string | null; // published-label benchmark, or null
  status: "ready" | "soon";
  approxClusters: number; // for the model picker's cost projection (before the atlas loads)
}
const DATASETS: DatasetDef[] = [
  {
    id: "zscape_v2",
    name: "ZSCAPE V2",
    tagline: "Saunders et al. · next-gen pipeline — coming soon",
    blurb:
      "ZSCAPE V2 — the next iteration of the ZSCAPE ground-truth benchmark (re-clustering + scoring to be wired up). Stub registered; assets and scoring not built yet. Use ZSCAPE Classic for the current GT pipeline.",
    dataUrl: `${ASSET_BASE}/zscape_v2/umap.json`,
    archivistBase: `${ASSET_BASE}/zscape_v2/archivist`,
    groundTruthUrl: null,
    status: "soon",
    approxClusters: 0,
  },
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
    tagline: "Saunders et al. · 3.2M cells · 55 de-novo clusters",
    blurb:
      "The Trapnell-lab whole-embryo atlas. We re-cluster from scratch (silhouette-gated sub-Leiden) and score our names against the authors' published germ-layer → tissue → broad → sub labels.",
    dataUrl: `${ASSET_BASE}/zscape/umap.json`,
    archivistBase: `${ASSET_BASE}/zscape/archivist`,
    groundTruthUrl: `${ASSET_BASE}/zscape/groundtruth.json`,
    status: "ready",
    approxClusters: 55,
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
// Card grid order: the three GT benchmarks first, then Parse/Manual MegaFin, MiniFin, then the V2 stub.
const DATASET_ORDER: DatasetId[] = ["zscape", "chemfish", "daniocell", "megafin_parse", "megafin", "minifin", "zscape_v2"];
const ORDERED_DATASETS: DatasetDef[] = DATASET_ORDER.map((id) => DATASET_BY_ID[id]).filter(Boolean);

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
// `notes` snowballs one short tagged annotation PER personality (Researcher /
// Archivist / Reasoner) as each contributes to the gene across turns. `note`/`via`
// keep the latest single contribution for back-compat.
type Marker = { g: string; l2fc?: number; p1?: number; p2?: number; note?: string; via?: AgentMode; dir?: "up" | "down"; notes?: { via: AgentMode; text: string }[] };
interface Cluster {
  id: string;
  label: string;
  nCells: number;
  color: string;
  cx: number;
  cy: number;
  degsUp: string[];
  markers: Marker[];
  markersDown: Marker[];
  points: Pt[];
  bounds: { minx: number; maxx: number; miny: number; maxy: number };
}

interface AtlasMeta {
  source: string;
  totalCells: number; // cells actually clustered (may be a sample of the full atlas)
  nClusters: number;
  fullDatasetCells?: number; // full atlas size, when totalCells is a sample
  pointsShown?: number; // dots plotted on the map (a downsample of totalCells)
}

function paletteColor(i: number, n: number) {
  const h = Math.round((i * 360) / n + (i % 2 ? 180 / n : 0)) % 360;
  const s = 60 + (i % 3) * 9;
  const l = 46 + (i % 2) * 9;
  return `hsl(${h} ${s}% ${l}%)`;
}

// confidence % → a subtle red→amber→green heat tint for the world-map cards.
function confColor(pct: number): { bg: string; fg: string } {
  const p = Math.max(0, Math.min(100, pct));
  const h = (p / 100) * 130; // 0% = red, 100% = green
  return { bg: `hsl(${h} 72% 92%)`, fg: `hsl(${h} 55% 27%)` };
}

// ---------------------------------------------------------------------------
// Load + shape the real MiniFin atlas asset
// ---------------------------------------------------------------------------
function useAtlas(dataUrl: string | null) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [meta, setMeta] = useState<AtlasMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataUrl) return;
    setClusters(null);
    setMeta(null);
    setError(null);
    let alive = true;
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`asset ${r.status}`);
        return r.json();
      })
      .then((d: any) => {
        if (!alive) return;
        const n = d.clusters.length;
        const cs: Cluster[] = d.clusters.map((c: any, i: number) => ({
          id: c.id,
          label: c.label,
          nCells: c.nCells,
          color: paletteColor(i, n),
          cx: c.cx,
          cy: c.cy,
          degsUp: c.degsUp ?? [],
          markers: c.markers ?? [],
          markersDown: c.markersDown ?? [],
          points: [],
          bounds: { minx: Infinity, maxx: -Infinity, miny: Infinity, maxy: -Infinity },
        }));
        for (const [x, y, ci] of d.points as [number, number, number][]) {
          const c = cs[ci];
          if (!c) continue;
          c.points.push({ x, y });
          if (x < c.bounds.minx) c.bounds.minx = x;
          if (x > c.bounds.maxx) c.bounds.maxx = x;
          if (y < c.bounds.miny) c.bounds.miny = y;
          if (y > c.bounds.maxy) c.bounds.maxy = y;
        }
        setClusters(cs);
        setMeta({ source: d.source, totalCells: d.totalCells, nClusters: n, fullDatasetCells: d.fullDatasetCells, pointsShown: Array.isArray(d.points) ? d.points.length : undefined });
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [dataUrl]);

  return { clusters, meta, error };
}

// ---------------------------------------------------------------------------
// UMAP canvas — global (world map / HUD) and zoom (focused cluster)
// ---------------------------------------------------------------------------
function UmapCanvas({
  clusters,
  mode,
  colored,
  activeId,
  validated,
  width,
  height,
  onPick,
  showFocus,
}: {
  clusters: Cluster[];
  mode: "global" | "zoom";
  colored: boolean;
  activeId: string | null;
  validated: Set<string>;
  width: number;
  height: number;
  onPick?: (id: string) => void;
  showFocus?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const active = clusters.find((c) => c.id === activeId) || null;

  const transform = useMemo(() => {
    const pad = 16;
    let minx: number, maxx: number, miny: number, maxy: number;
    if (mode === "zoom" && active) {
      const ext = Math.max(active.bounds.maxx - active.bounds.minx, active.bounds.maxy - active.bounds.miny) * 0.7 + 1;
      minx = active.cx - ext;
      maxx = active.cx + ext;
      miny = active.cy - ext;
      maxy = active.cy + ext;
    } else {
      minx = Infinity;
      maxx = -Infinity;
      miny = Infinity;
      maxy = -Infinity;
      clusters.forEach((c) => {
        minx = Math.min(minx, c.bounds.minx);
        maxx = Math.max(maxx, c.bounds.maxx);
        miny = Math.min(miny, c.bounds.miny);
        maxy = Math.max(maxy, c.bounds.maxy);
      });
    }
    const scale = Math.min((width - 2 * pad) / (maxx - minx), (height - 2 * pad) / (maxy - miny));
    const ox = pad + (width - 2 * pad - (maxx - minx) * scale) / 2;
    const oy = pad + (height - 2 * pad - (maxy - miny) * scale) / 2;
    const toC = (x: number, y: number) => ({ cx: ox + (x - minx) * scale, cy: height - (oy + (y - miny) * scale) });
    return { scale, toC };
  }, [clusters, mode, active, width, height]);

  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    cnv.width = width * dpr;
    cnv.height = height * dpr;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const baseR = mode === "zoom" ? 2.4 : width < 260 ? 1.0 : 1.5;
    clusters.forEach((c) => {
      const isActive = c.id === activeId;
      let fill: string;
      if (mode === "zoom") fill = isActive ? c.color : "#e3ded7";
      else fill = colored ? c.color : "#cbc5be";
      ctx.globalAlpha = mode === "zoom" ? (isActive ? 0.95 : 0.35) : colored ? 0.82 : 0.5;
      ctx.fillStyle = fill;
      const r = isActive && mode === "zoom" ? baseR + 0.6 : baseR;
      c.points.forEach((p) => {
        const { cx, cy } = transform.toC(p.x, p.y);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;

    if (mode === "global" && colored) {
      clusters.forEach((c) => {
        if (!validated.has(c.id)) return;
        const { cx, cy } = transform.toC(c.cx, c.cy);
        ctx.beginPath();
        ctx.arc(cx, cy, width < 260 ? 5 : 7, 0, Math.PI * 2);
        ctx.fillStyle = "#15803d";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx - 1, cy + 2.4);
        ctx.lineTo(cx + 3, cy - 2.4);
        ctx.stroke();
      });
    }

    if (showFocus && active) {
      const a = transform.toC(active.bounds.minx, active.bounds.maxy);
      const b = transform.toC(active.bounds.maxx, active.bounds.miny);
      const x = Math.min(a.cx, b.cx) - 3;
      const y = Math.min(a.cy, b.cy) - 3;
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, Math.abs(b.cx - a.cx) + 6, Math.abs(b.cy - a.cy) + 6);
    }
  }, [clusters, mode, colored, activeId, validated, width, height, transform, showFocus, active]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onPick || mode !== "global" || !colored) return;
    const rect = ref.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let bestId = "";
    let bestD = Infinity;
    clusters.forEach((c) => {
      const { cx, cy } = transform.toC(c.cx, c.cy);
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestD) {
        bestD = d;
        bestId = c.id;
      }
    });
    if (bestId && bestD < 45) onPick(bestId);
  }

  return (
    <canvas
      ref={ref}
      onClick={handleClick}
      style={{ width, height, display: "block", cursor: onPick && mode === "global" && colored ? "pointer" : "default", borderRadius: 10 }}
    />
  );
}

// ---------------------------------------------------------------------------
type Stage = "model" | "harness" | "intro" | "map" | "personas" | "cluster" | "scorecard";

export default function KasperovClient() {
  const [dataset, setDataset] = useState<DatasetDef | null>(null);
  const { clusters, meta, error } = useAtlas(dataset?.dataUrl ?? null);
  const [stage, setStage] = useState<Stage>("intro");
  const [revealed, setRevealed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState(0); // bumping this signals ClusterStage to run auto-pilot
  // tracks the last autoStart value the (re-mountable) ClusterStage has consumed —
  // lives in the PARENT so a plain cluster click (which remounts ClusterStage)
  // can't be mistaken for a fresh auto-pilot trigger.
  const autoConsumedRef = useRef(0);
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
  const [loadedNote, setLoadedNote] = useState<string | null>(null); // note of a loaded previous run
  const hydratedRef = useRef<string | null>(null);

  // selected model (global), accumulated token usage per model (per-dataset), and
  // the latest ground-truth scoring (per-dataset) — all carried into the export.
  const [model, setModel] = useState<KasperovModel>(DEFAULT_MODEL);
  // active labelling harness (the loop + grounding rules) — selected after the model.
  // Default to the registry's active version. Recorded in run provenance.
  const [activeHarness, setActiveHarness] = useState<any>(() => {
    const r: any = HARNESS_REGISTRY; return (r.harnesses || []).find((h: any) => h.id === r.active) || (r.harnesses || [])[0] || null;
  });
  const [usage, setUsage] = useState<Usage>({});
  const [score, setScore] = useState<RunScore>({ verdicts: {}, scoredAt: null, agg: [] });
  const [srvNote, setSrvNote] = useState(""); // transient "Saved to server ✓" message
  const addUsage = useCallback((m: string, inT: number, outT: number) => {
    if (!inT && !outT) return;
    setUsage((u) => ({ ...u, [m]: { in: (u[m]?.in ?? 0) + (inT || 0), out: (u[m]?.out ?? 0) + (outT || 0) } }));
  }, []);

  // restore the globally-selected model once
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODEL_KEY);
      if (m && (KASPEROV_MODELS as readonly string[]).includes(m)) setModel(m as KasperovModel);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_KEY, model);
    } catch {}
  }, [model]);

  // When a dataset is chosen, clear any prior dataset's run state and hydrate this
  // dataset's saved run (validated/labels + transcripts/markers/confidence). Each
  // dataset persists under its own keys so runs never collide.
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
    setActiveId(null);
    setStage("model"); // dataset chosen → pick a model next, then the intro/map
    setUsage({});
    setScore({ verdicts: {}, scoredAt: null, agg: [] });
    try {
      const raw = localStorage.getItem(resultsKey(dataset.id));
      if (raw) {
        const p = JSON.parse(raw);
        if (p.transcripts) setTranscripts(p.transcripts);
        if (p.augmented) setAugmented(p.augmented);
        if (p.confidence) setConfidence(p.confidence);
        if (p.usage) setUsage(p.usage);
        if (p.score) setScore({ verdicts: p.score.verdicts ?? {}, scoredAt: p.score.scoredAt ?? null, agg: p.score.agg ?? [], subStrat: p.score.subStrat ?? null, abstention: p.score.abstention ?? null });
      }
    } catch {}
    try {
      const raw = localStorage.getItem(storageKey(dataset.id));
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.validated)) setValidated(new Set(p.validated));
        if (p.labels && typeof p.labels === "object") setLabels(p.labels);
        // personasSeen is intentionally NOT persisted — the primer shows once per
        // page load (reliably present each visit, not nagging within a session).
      }
    } catch {}
    hydratedRef.current = dataset.id;
    setLoaded(true);
  }, [dataset]);

  // persist the full run (debounced); on quota overflow, fall back to markers+confidence only
  useEffect(() => {
    if (!dataset || hydratedRef.current !== dataset.id) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(resultsKey(dataset.id), JSON.stringify({ transcripts, augmented, confidence, usage, score }));
      } catch {
        try {
          localStorage.setItem(resultsKey(dataset.id), JSON.stringify({ augmented, confidence, usage, score }));
        } catch {}
      }
    }, 800);
    return () => clearTimeout(id);
  }, [transcripts, augmented, confidence, usage, score, dataset]);

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
      groundTruth: score.scoredAt ? { scoredAt: score.scoredAt, aggregate: score.agg, verdicts: score.verdicts, subStratified: score.subStrat ?? null, abstention: score.abstention ?? null, scoring: "driver/v2" } : null,
    };
  }

  // save the combined run to the server store (S3 + DynamoDB index)
  async function saveRunToServer() {
    if (!dataset) return;
    setSrvNote("Saving to server…");
    try {
      const r = await fetch("/api/kasperov_runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...buildRunJSON(), source: "browser" }),
      });
      if (r.status === 503) setSrvNote("Server store not configured");
      else {
        const d = await r.json().catch(() => ({}));
        setSrvNote(d?.ok ? "Saved to server ✓ (Load Previous Run)" : "Server save failed");
      }
    } catch {
      setSrvNote("Server save failed");
    }
    setTimeout(() => setSrvNote(""), 5000);
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

  // re-load a previously exported run (the exportResults shape) into state for
  // THIS dataset — restores labels, validations, confidence, markers, transcripts.
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
    setLoadedNote(typeof data.note === "string" && data.note.trim() ? data.note.trim() : null);
    // restore run metadata (model, cost/usage, ground-truth scores) when present
    if (data.cost?.usage && typeof data.cost.usage === "object") setUsage(data.cost.usage);
    else setUsage({});
    if ((KASPEROV_MODELS as readonly string[]).includes(data.model)) setModel(data.model as KasperovModel);
    if (data.groundTruth && Array.isArray(data.groundTruth.aggregate)) {
      setScore({ verdicts: data.groundTruth.verdicts ?? {}, scoredAt: data.groundTruth.scoredAt ?? null, agg: data.groundTruth.aggregate, subStrat: data.groundTruth.subStratified ?? null, abstention: data.groundTruth.abstention ?? null });
    } else {
      setScore({ verdicts: {}, scoredAt: null, agg: [] });
    }
    setRevealed(true); // so the cluster grid is visible immediately
    window.alert(`Imported ${loaded} labelled cluster${loaded === 1 ? "" : "s"} into the ${dataset.name} run.`);
  }

  function startAutopilot() {
    if (!clusters) return;
    // optional, skippable "what's special about this run?" popup — non-blocking: the
    // sweep kicks off below regardless; the note folds into buildRunJSON at save time.
    // Skip in capture mode (headless filming has no human to prompt).
    if (!captureMode) { setRunNote(""); setNoteOpen(true); }
    // "done" == has a cell-type label (NOT merely validated — a cluster can be
    // validated by hand without a label). Land on the first unlabelled cluster.
    const first = clusters.find((c) => !labels[c.id]) ?? clusters[0];
    setActiveId(first.id);
    setStage("cluster");
    setAutoStart((n) => n + 1);
  }

  function resetRun() {
    if (typeof window !== "undefined" && !window.confirm("Clear all validations, cell-type labels, and the saved run history? This can't be undone.")) return;
    setValidated(new Set());
    setLabels({});
    setTranscripts({});
    setAugmented({});
    setConfidence({});
    setIncorporated(new Set());
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

  if (!dataset) return <DatasetPicker onPick={setDataset} />;

  if (stage === "model")
    return <ModelPicker dataset={dataset} current={model} onPick={(m) => { setModel(m); setStage("harness"); }} onBack={() => setDataset(null)} />;

  if (stage === "harness")
    return <HarnessPicker dataset={dataset} registry={HARNESS_REGISTRY as any} current={activeHarness} onPick={(h: any) => { setActiveHarness(h); setStage("map"); }} onBack={() => setStage("model")} />;


  if (!clusters) {
    return (
      <Centered>
        {error ? `Failed to load the atlas: ${error}` : `Loading the ${dataset.name} atlas…`}
      </Centered>
    );
  }

  if (stage === "map")
    return (
      <MapStage
        dataset={dataset}
        clusters={clusters}
        meta={meta}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        validated={validated}
        onPick={openCluster}
        onAuto={startAutopilot}
        onExport={exportResults}
        onReset={resetRun}
        onSwitchDataset={() => setDataset(null)}
        onImport={importResults}
        loadedNote={loadedNote}
        labels={labels}
        confidence={confidence}
        model={model}
        onChangeModel={() => setStage("model")}
        usage={usage}
        score={score}
        setScore={setScore}
        addUsage={addUsage}
        srvNote={srvNote}
      />
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
      {noteOpen && <RunNoteModal initial={runNote} onSubmit={(t) => { setRunNote(t); setNoteOpen(false); }} onSkip={() => setNoteOpen(false)} />}
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
// Import button — reads a previously exported run JSON and hands it to onImport.
// Shared by the World Map controls and the scorecard.
// ---------------------------------------------------------------------------
function ImportButton({ onImport, label, style }: { onImport: (data: unknown) => void; label: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => {
            try {
              onImport(JSON.parse(String(r.result)));
            } catch {
              window.alert("Couldn't parse that file as JSON.");
            }
          };
          r.readAsText(f);
          e.target.value = ""; // let the same file be re-picked
        }}
      />
      <button onClick={() => ref.current?.click()} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14, ...style }}>
        {label}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Previous-runs browser — lists server-saved runs for a dataset (model · cost ·
// date · #labelled) and loads any one back in. Backed by /api/kasperov_runs.
// ---------------------------------------------------------------------------
function PreviousRunsModal({ datasetId, onLoad, onClose }: { datasetId: string; onLoad: (data: unknown) => void; onClose: () => void }) {
  const [runs, setRuns] = useState<any[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notconfigured" | "error">("loading");
  const [err, setErr] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/kasperov_runs?dataset=${encodeURIComponent(datasetId)}`)
      .then(async (r) => {
        if (r.status === 503) {
          if (alive) setStatus("notconfigured");
          return;
        }
        if (!r.ok) throw new Error(`list ${r.status}`);
        const d = await r.json();
        if (alive) {
          setRuns(d.runs ?? []);
          setStatus("ready");
        }
      })
      .catch((e) => alive && (setErr(String(e?.message ?? e)), setStatus("error")));
    return () => {
      alive = false;
    };
  }, [datasetId]);

  async function load(runId: string) {
    setLoadingId(runId);
    try {
      const r = await fetch(`/api/kasperov_runs?dataset=${encodeURIComponent(datasetId)}&id=${encodeURIComponent(runId)}`);
      if (!r.ok) throw new Error();
      const json = await r.json();
      onLoad(json);
      onClose();
    } catch {
      window.alert("Couldn't load that run.");
      setLoadingId(null);
    }
  }

  const money = (v: number) => (v < 1 ? v.toFixed(3) : v.toFixed(2));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fffdfb", borderRadius: 14, maxWidth: 680, width: "100%", maxHeight: "80vh", overflow: "auto", padding: "20px 22px", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Previous runs · {datasetId}</strong>
          <button onClick={onClose} style={{ marginLeft: "auto", ...btnGhost, padding: "5px 11px", fontSize: 13 }}>Close</button>
        </div>
        {status === "loading" && <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>}
        {status === "notconfigured" && (
          <div style={{ color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            The server run store isn&apos;t configured yet (set <code>KASPEROV_AUTOPILOT_URL</code> in Vercel env + deploy the EC2 worker). Exported runs still download locally, and you can re-load them with <strong>Import results</strong>.
          </div>
        )}
        {status === "error" && <div style={{ color: "#b91c1c", fontSize: 14 }}>Failed to list runs: {err}</div>}
        {status === "ready" && runs && runs.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>No saved runs for this dataset yet — export a run (or run the server auto-pilot) to save one.</div>}
        {status === "ready" &&
          runs &&
          runs.map((m) => (
            <div
              key={m.runId}
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e1dc", borderRadius: 10, padding: "10px 12px", marginBottom: 8, color: INK }}
            >
              <span onClick={() => !loadingId && load(m.runId)} style={{ flex: 1, minWidth: 0, cursor: loadingId ? "default" : "pointer" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{m.model}</span>
                <span style={{ fontSize: 12.5, color: "#666" }}>
                  {" "}· {m.nLabelled} labelled{m.hasGroundTruth ? " · scored" : ""}{m.source === "server" ? " · ☁ server" : ""}
                </span>
                {m.harness ? (
                  <span title={m.harness.gitCommit ? `commit ${m.harness.gitCommit}` : undefined} style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#475569", background: "#eef2f6", borderRadius: 99, padding: "1px 7px" }}>
                    harness v{m.harness.version}{m.harness.name ? ` · ${m.harness.name}` : ""}
                  </span>
                ) : null}
                <div style={{ fontSize: 12, color: "#999" }}>
                  {m.exportedAt ? new Date(m.exportedAt).toLocaleString() : "date n/a"} · ~${money(Number(m.costUsd || 0))}{m.costEstimated ? "*" : ""} est.
                </div>
                {m.note ? (
                  <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 3, lineHeight: 1.45 }}>📝 {m.note}</div>
                ) : null}
              </span>
              <button
                title={m.note ? "Edit note" : "Add note"}
                onClick={async () => {
                  const next = window.prompt("Note for this run (what's special about it?):", m.note || "");
                  if (next === null) return; // cancelled
                  await postRunNote(m.runId, next.trim(), datasetId);
                  setRuns((rs) => (rs || []).map((x) => (x.runId === m.runId ? { ...x, note: next.trim() || null } : x)));
                }}
                style={{ ...btnGhost, padding: "4px 9px", fontSize: 12, flexShrink: 0 }}
              >
                {m.note ? "✎" : "📝 note"}
              </button>
              <span onClick={() => !loadingId && load(m.runId)} style={{ fontSize: 12.5, color: ACCENT, fontWeight: 700, flexShrink: 0, cursor: loadingId ? "default" : "pointer" }}>{loadingId === m.runId ? "Loading…" : "Load →"}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dataset picker — the entry screen: choose which atlas to run the wizard on.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Standardized body for the internal (no-GT) dataset cards. Sections the info
// into a fixed order — Coverage & grounding · Experimental design · Clustering ·
// Consistency — rendered identically for Manual MegaFin, Parse MegaFin and
// MiniFin; each section self-hides when its data is absent. Replaces the older
// single cramped block so the three cards read the same way.
// ---------------------------------------------------------------------------
function NoGtBody({ f }: { f: any }) {
  const ng = f.noGtScorecard;
  const cs = ng?.consistency;
  const pcs = ng?.processingConsistency;
  const sec = (label: string, children: React.ReactNode, first = false) => (
    <div style={{ borderTop: first ? "none" : "1px solid #ece8e2", marginTop: first ? 0 : 9, paddingTop: first ? 0 : 9, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#a59f96" }}>{label}</div>
      {children}
    </div>
  );
  const stat = (v: string, sub: string, accent = false) => (
    <div style={{ flex: 1, background: accent ? "#f0fdf4" : "#fff", border: `1px solid ${accent ? "#d6e8db" : "#ece8e2"}`, borderRadius: 7, padding: "6px 9px" }}>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, color: accent ? "#15803d" : "#3f3a34" }}>{v}</div>
      <div style={{ fontSize: 9, color: "#9a948c", marginTop: 3 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{ background: "#faf8f5", border: "1px solid #ece8e2", borderRadius: 9, padding: "10px 11px", color: "#6b655d", display: "flex", flexDirection: "column" }}>
      {ng && sec("Coverage & grounding", (
        <>
          <div style={{ display: "flex", gap: 7 }}>
            {stat(`${ng.coverage.assigned_pct}%`, `assigned · ${ng.coverage.abstained} abstained`)}
            {stat(`${ng.grounding_pct}%`, "marker grounding", true)}
          </div>
          <div style={{ fontSize: 10.5, color: "#7a746c" }}>tier depth <b style={{ color: "#3f3a34" }}>{ng.tier_depth.cell_type}</b> cell-type · {ng.tier_depth.tissue} tissue</div>
          {ng.abstentionNote && <div style={{ fontSize: 9.5, color: "#8a847c", lineHeight: 1.45 }}>{ng.abstentionNote}</div>}
        </>
      ), true)}

      {f.designFacts && sec("Experimental design", (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 10.5, lineHeight: 1.4 }}>
          {Object.entries(f.designFacts).map(([k, v]: any, i: number) => (
            <React.Fragment key={i}>
              <span style={{ color: "#a59f96" }}>{k}</span>
              <span style={{ color: "#5a544c" }}>{v as string}</span>
            </React.Fragment>
          ))}
        </div>
      ))}

      {(() => {
        const chosen = (f.sweep || []).find((s: any) => s.chosen);
        const coh = typeof f.coherence === "number" ? f.coherence : chosen?.coherence;
        return sec("Clustering", (
        <>
          <div style={{ fontSize: 10, color: "#a59f96", lineHeight: 1.4 }}>{f.recipe}</div>
          {typeof coh === "number" && (
            <div style={{ fontSize: 10.5, color: "#7a746c" }}>coherence <b style={{ color: coh >= 0.95 ? "#15803d" : "#b45309" }}>{coh.toFixed(3)}</b> at chosen res {f.chosenRes}</div>
          )}
          {f.coherenceNote
            ? <div style={{ fontSize: 9.5, color: "#b45309", lineHeight: 1.45 }}>⚠ Kept the carried Parse embedding; a standard re-embed was tested &amp; rejected. Full sweep on the map screen.</div>
            : f.noGtNote ? <div style={{ fontSize: 9.5, color: "#8a847c", lineHeight: 1.45 }}>{f.noGtNote}</div> : null}
        </>
        ));
      })()}

      {cs && sec("Consistency vs prior annotation", (
        <>
          <div style={{ fontSize: 11 }}><b style={{ color: "#3f3a34" }}>{cs.headlinePct}%</b> lineage <span style={{ color: "#9a948c" }}>· {cs.celltypePct}% cell-type</span></div>
          <div style={{ fontSize: 9.5, color: "#b45309", fontStyle: "italic", lineHeight: 1.45 }}>{cs.framing}</div>
          <div style={{ fontSize: 10, color: "#5a544c" }}>7 hardest conflicts <b style={{ color: "#15803d" }}>{cs.adjudication.prior_error} prior-error</b> · {cs.adjudication.labeler_error} labeler-error · {cs.adjudication.ambiguous} ambiguous</div>
        </>
      ))}

      {pcs && sec("Manual ↔ Parse processing-consistency", (
        <>
          <div style={{ fontSize: 11 }}><b style={{ color: "#3f3a34" }}>{pcs.headlinePct}%</b> aligned <span style={{ color: "#9a948c" }}>· {pcs.cellWeightedPct}% cell-weighted · {pcs.allClusterPct}% all-cluster</span></div>
          <div style={{ fontSize: 9.5, color: "#b45309", fontStyle: "italic", lineHeight: 1.45 }}>{pcs.framing}</div>
          <div style={{ fontSize: 10, color: "#5a544c" }}>7 high-purity conflicts <b style={{ color: "#15803d" }}>{pcs.adjudication.parse_better} Parse-better</b> · {pcs.adjudication.manual_better} Manual-better · {pcs.adjudication.marker_ceiling} ambiguous</div>
        </>
      ))}

      {f.supersedes && <div style={{ marginTop: 9, fontSize: 9.5, color: "#a59f96", fontStyle: "italic" }}>Supersedes the {f.supersedes}.</div>}
    </div>
  );
}

function DatasetPicker({ onPick }: { onPick: (d: DatasetDef) => void }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 920, padding: "72px 28px 60px", width: "100%" }}>
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
            const toneColor: Record<string, string> = { baseline: "#15803d", projected: "#b45309", independent: "#7c3aed" };
            const fmtCells = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
            const ident = f ? [
              [`${(f.cells as number).toLocaleString()} cells`, `${f.clusters} clusters · res ${f.resLabel}`],
              [f.platform, `${f.lab}${f.year ? " · " + f.year : ""}`],
              ["genes", f.namespace],
            ] : null;
            return (
              <button
                key={d.id}
                onClick={() => ready && onPick(d)}
                disabled={!ready}
                style={{
                  textAlign: "left",
                  background: ready ? "#fffdfb" : "#f3f0ec",
                  border: `1px solid ${ready ? "#e5e1dc" : "#e9e5df"}`,
                  borderTop: `3px solid ${ready ? (isGt ? "#15803d" : ACCENT) : "#cfcac4"}`,
                  borderRadius: 12,
                  padding: "16px 16px 18px",
                  cursor: ready ? "pointer" : "default",
                  opacity: ready ? 1 : 0.7,
                  color: INK,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 188,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{d.name}</span>
                  {!ready && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#926a1a", background: "#fef3c7", borderRadius: 99, padding: "2px 8px" }}>soon</span>}
                  {f && (
                    <span title={isGt ? "Scored against published cell-type labels" : "No published labels — intuition-building, not a benchmark"} style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: isGt ? "#15803d" : "#475569", background: isGt ? "#dcfce7" : "#eef2f6", borderRadius: 99, padding: "2px 8px" }}>
                      {isGt ? "✓ GT benchmark" : "internal"}
                    </span>
                  )}
                </div>

                {ident && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px", fontSize: 11.5, color: "#555", lineHeight: 1.45 }}>
                    {ident.map(([a, b], i) => (
                      <React.Fragment key={i}>
                        <span style={{ fontWeight: 700, color: "#3f3a34" }}>{a}</span>
                        <span style={{ color: "#7a746c", textAlign: "right" }}>{b}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {isGt && f.scorecard && (() => {
                  const sc = f.scorecard; const indep = sc.platform_class === "independent";
                  return (
                  <div style={{ background: "#faf8f5", border: "1px solid #ece8e2", borderRadius: 9, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c" }}>Native-schema benchmark</span>
                      <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: indep ? "#7c3aed" : "#475569", background: indep ? "#f3e8ff" : "#eef2f6", borderRadius: 99, padding: "1px 7px" }}>{indep ? "independent · cross-platform" : "in-paradigm"}</span>
                    </div>
                    {sc.tiers.map((t: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                        <span style={{ width: 64, color: "#6b655d", flexShrink: 0 }}>{t.label.replace("Cell type — ", "")}</span>
                        <span style={{ flex: 1, height: 6, background: "#ece8e2", borderRadius: 99, overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: `${t.pct}%`, background: t.pct >= 70 ? "#15803d" : t.pct >= 45 ? "#ca8a04" : "#dc2626", borderRadius: 99 }} />
                        </span>
                        <span style={{ width: 34, textAlign: "right", fontWeight: 700, color: "#3f3a34", flexShrink: 0 }}>{t.pct}%</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10.5, color: "#7a746c" }}>by size: ≥100 <b>{sc.strata.ge100}%</b> · ≥30 {sc.strata.ge30}% · all {sc.strata.all}%</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                      <span style={{ color: "#9a948c" }}>abstained {sc.abstention.n}/{sc.abstention.total}</span>
                      {sc.abstention.precision ? <span style={{ fontWeight: 700, color: "#15803d", background: "#dcfce7", borderRadius: 99, padding: "1px 7px" }}>{sc.abstention.precision}% precision</span> : null}
                    </div>
                    {(sc.notes || []).map((n: string, i: number) => (
                      <div key={i} style={{ fontSize: 10, color: i < 2 ? "#5a544c" : "#9a948c", lineHeight: 1.4 }}>• {n}</div>
                    ))}
                  </div>
                  );
                })()}

                {f && !isGt && <NoGtBody f={f} />}

                {!f && <div style={{ fontSize: 12.5, color: "#777", lineHeight: 1.5 }}>{d.blurb}</div>}
                {ready && <div style={{ marginTop: "auto", paddingTop: 8, fontSize: 13, fontWeight: 700, color: ACCENT }}>Open wizard →</div>}
              </button>
            );
          };
          const gtDs = ORDERED_DATASETS.filter((d) => (FACTS[d.id] as any)?.role === "gt");
          const order = ["megafin", "megafin_parse", "minifin"];
          const internalDs = ORDERED_DATASETS.filter((d) => (FACTS[d.id] as any)?.role !== "gt")
            .sort((a, b) => ((order.indexOf(a.id) + 1) || 99) - ((order.indexOf(b.id) + 1) || 99));
          const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 } as const;
          const hdr = { fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#3f3a34", fontWeight: 700, margin: "8px 0 12px" };
          return (
            <>
              <div style={hdr}>Ground-truth benchmarks</div>
              <div style={gridStyle}>{gtDs.map(renderCard)}</div>
              {(DATASET_FACTS as any)._suite?.notes && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #ece8e2", fontSize: 11, color: "#9a948c", lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#7a746c" }}>Reading the benchmarks · </span>
                  {((DATASET_FACTS as any)._suite.notes as string[]).join("  ·  ")}
                </div>
              )}
              <div style={{ ...hdr, marginTop: 38 }}>Internal atlases — coverage &amp; grounding (no GT)</div>
              <div style={{ fontSize: 12, color: "#7a746c", margin: "-4px 0 14px", lineHeight: 1.5, maxWidth: 720 }}>Coverage and grounding readouts — not accuracy, not comparable to the benchmark figures above.</div>
              <div style={gridStyle}>{internalDs.map(renderCard)}</div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Harness picker — third setup screen (after the model): choose which labelling
// HARNESS (the proposer→archivist→reasoner loop + grounding rules) drives the
// run. Each version is stamped + carries its verification history (the scores it
// produced on the ground-truth atlases). One harness today; the registry + the
// run-provenance stamp make adding/comparing versions a drop-in later.
// ---------------------------------------------------------------------------
function HarnessPicker({ dataset, registry, current, onPick, onBack }: { dataset: DatasetDef; registry: any; current: any; onPick: (h: any) => void; onBack: () => void }) {
  const harnesses: any[] = registry?.harnesses || [];
  const tierShort = (l: string) => l.replace("Cell type — ", "").replace("Germ layer", "germ").replace("Tissue", "tissue").toLowerCase();
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 920, padding: "72px 28px 60px", width: "100%" }}>
        <button onClick={onBack} style={{ ...btnGhost, marginBottom: 20, padding: "7px 13px", fontSize: 13 }}>← Model</button>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov · {dataset.name}</div>
        <h1 style={{ fontSize: 38, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.1 }}>Choose a harness</h1>
        <p style={{ fontSize: 16.5, color: "#555", lineHeight: 1.55, margin: "0 0 30px", maxWidth: 720 }}>
          The harness is the labelling loop and grounding rules — the configuration that produces the labels. Each version is
          stamped and carries its verification history: the scores it earned on the ground-truth atlases.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {harnesses.map((h) => {
            const sel = current?.id === h.id; const v = h.verification || {}; const prov = v.provenance || {};
            return (
              <div key={h.id} style={{ background: "#fffdfb", border: `1px solid ${sel ? ACCENT : "#e5e1dc"}`, borderTop: `3px solid ${ACCENT}`, borderRadius: 12, padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 9, boxShadow: sel ? `0 0 0 2px ${ACCENT}22` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>Harness v{h.version}</span>
                  <span style={{ fontSize: 13, color: "#7a746c" }}>· {h.name}</span>
                  {registry.active === h.id && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d", background: "#dcfce7", borderRadius: 99, padding: "2px 8px" }}>✓ active</span>}
                </div>
                <div style={{ fontSize: 11, color: "#9a948c", fontFamily: "monospace" }}>stamped {String(h.stampedAt).slice(0, 10)} · commit {h.gitCommit} · {h.model}</div>
                <div style={{ fontSize: 11.5, color: "#5a544c", lineHeight: 1.5 }}>{h.summary}</div>
                <div style={{ background: "#faf8f5", border: "1px solid #ece8e2", borderRadius: 9, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c" }}>Verified on {(v.gt || []).length} ground-truth atlases</div>
                  {(v.gt || []).map((g: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, display: "flex", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: "#3f3a34", width: 70, flexShrink: 0, textTransform: "capitalize" }}>{g.dataset}</span>
                      <span style={{ color: "#6b655d" }}>{(g.tiers || []).map((t: any) => `${tierShort(t.label)} ${Math.round(t.pct)}`).join(" · ")}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#7a746c", marginTop: 1 }}>{v.benchmark}</div>
                  <div style={{ fontSize: 10, color: "#7a746c" }}>+ {(v.noGt || []).map((n: any) => n.dataset).join(" / ")} no-GT (coverage/grounding{(v.noGt || []).some((n: any) => n.processingConsistency) ? " + processing-consistency" : ""})</div>
                  <div style={{ fontSize: 10, color: "#9a948c" }}>provenance: {(prov.runs || []).length} labelled runs · ${prov.totalCostUsd}</div>
                </div>
                <button onClick={() => onPick(h)} style={{ marginTop: 2, background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Use this harness →</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model picker — second setup screen (after the dataset): choose which model
// drives the whole run, with a strength summary + projected full-run cost.
// ---------------------------------------------------------------------------
function ModelPicker({ dataset, current, onPick, onBack }: { dataset: DatasetDef; current: KasperovModel; onPick: (m: KasperovModel) => void; onBack: () => void }) {
  const n = dataset.approxClusters;
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 920, padding: "72px 28px 60px", width: "100%" }}>
        <button onClick={onBack} style={{ ...btnGhost, marginBottom: 20, padding: "7px 13px", fontSize: 13 }}>← Datasets</button>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov · {dataset.name}</div>
        <h1 style={{ fontSize: 38, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.1 }}>Choose a model</h1>
        <p style={{ fontSize: 16.5, color: "#555", lineHeight: 1.55, margin: "0 0 30px", maxWidth: 720 }}>
          The model drives every personality and the ground-truth scoring for this run, and is recorded in the saved JSON. Cost is a rough projection for
          labelling all <strong>~{n}</strong> {dataset.name} clusters — you can also switch models later on the world map.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {KASPEROV_MODELS.map((m) => {
            const info = modelInfo(m);
            const cost = projectRunCost(m, n);
            const selected = m === current;
            const tierColor = info.tier === "base" ? "#15803d" : info.tier === "mini" ? ACCENT : "#a16207";
            return (
              <button
                key={m}
                onClick={() => onPick(m)}
                style={{
                  textAlign: "left",
                  background: selected ? "#eef7f9" : "#fffdfb",
                  border: `1px solid ${selected ? ACCENT : "#e5e1dc"}`,
                  borderTop: `3px solid ${tierColor}`,
                  borderRadius: 12,
                  padding: "16px 18px 18px",
                  cursor: "pointer",
                  color: INK,
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  minHeight: 184,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{m}</span>
                  {selected && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: ACCENT, background: "#dbeef2", borderRadius: 99, padding: "2px 8px" }}>selected</span>}
                  <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: tierColor, background: `${tierColor}1a`, borderRadius: 99, padding: "2px 8px" }}>{info.tierLabel}</span>
                </div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{info.strength}</div>
                <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: tierColor, fontVariantNumeric: "tabular-nums" }}>~${cost.toFixed(2)}</span>
                  <span style={{ fontSize: 12, color: "#999" }}>est. full run ({n} clusters)</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

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

// POST a note onto a run (in-flight by runId, or a saved run by runId+dataset).
async function postRunNote(runId: string, note: string, dataset?: string) {
  try {
    await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setNote", runId, note, dataset }) });
  } catch {}
}

// "Show your work": the resolution sweep, selection rule, chosen resolution, and the
// coherence curve behind this dataset's de-novo partition — shown when the clustering is
// revealed, before handing off to the three-personality labeling interface.
function ClusteringProvenance({ datasetId, nClusters }: { datasetId: string; nClusters: number }) {
  const f: any = FACTS[datasetId];
  if (!f) return null;
  const sweep: any[] | null = f.sweep ?? null;
  const card: React.CSSProperties = { maxWidth: 720, margin: "20px auto 0", textAlign: "left", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
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
  const name = DATASET_BY_ID[datasetId as DatasetId]?.name ?? datasetId;
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
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: ACCENT }}>How we found these {nClusters} clusters</div>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: isGt ? "#15803d" : "#475569", background: isGt ? "#dcfce7" : "#eef2f6", borderRadius: 99, padding: "2px 8px" }}>{isGt ? "✓ GT benchmark" : "internal"}</span>
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

      {/* GT scoring caveat */}
      {isGt && f.caveat && (
        <div style={{ marginTop: 12, background: "#f6faf7", border: "1px solid #d6e8db", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "#3f5a47", lineHeight: 1.5 }}>
          <b>Reading the score:</b> {f.caveat}
        </div>
      )}

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
      {f.groundingNote && !f.coherenceNote && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#9a948c", lineHeight: 1.5 }}>{f.groundingNote}</div>
      )}

      <p style={{ fontSize: 12.5, color: "#7a746c", lineHeight: 1.55, margin: "12px 0 0", borderTop: "1px solid #efece7", paddingTop: 10 }}>
        Next: enter the <b>World Map</b> to label these {nClusters} clusters — two <b style={{ color: THEME.research.color }}>Proposers</b> debate each one and the <b style={{ color: THEME.reason.color }}>Archivist</b> grounds the call in real marker stats. Click <b style={{ color: ACCENT }}>Choose a cluster to investigate →</b> below to begin.
      </p>
    </div>
  );
}

function MapStage({
  dataset,
  clusters,
  meta,
  revealed,
  onReveal,
  validated,
  onPick,
  onAuto,
  onExport,
  onReset,
  onSwitchDataset,
  onImport,
  loadedNote,
  labels = {},
  confidence = {},
  model,
  onChangeModel,
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
  onReveal: () => void;
  validated: Set<string>;
  onPick: (id: string) => void;
  onAuto: () => void;
  onExport: () => void;
  onReset: () => void;
  onSwitchDataset: () => void;
  onImport: (data: unknown) => void;
  loadedNote?: string | null;
  labels?: Record<string, string>;
  confidence?: Record<string, ClusterConf>;
  model: KasperovModel;
  onChangeModel: () => void;
  usage: Usage;
  score: RunScore;
  setScore: React.Dispatch<React.SetStateAction<RunScore>>;
  addUsage: (model: string, inT: number, outT: number) => void;
  srvNote: string;
}) {
  const labelled = clusters.filter((c) => labels[c.id]);
  const unlabelled = clusters.filter((c) => !labels[c.id]);
  const [showPrev, setShowPrev] = useState(false);
  const [srvNoteFor, setSrvNoteFor] = useState<string | null>(null); // server run awaiting its optional note

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
      const r = await fetch("/api/kasperov_autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", dataset: dataset.id, model }) });
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

  const trim15 = (s: string) => {
    const w = s.trim().split(/\s+/);
    return w.length > 15 ? w.slice(0, 15).join(" ") + "…" : s.trim();
  };
  const [size, setSize] = useState({ w: 760, h: 560 });
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
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
          <button onClick={onSwitchDataset} style={{ ...btnGhost, position: "absolute", left: 0, padding: "6px 12px", fontSize: 12.5 }}>← Datasets</button>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>World map · {dataset.name} atlas</div>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 2px" }}>{revealed ? "Choose a cluster to investigate" : `How we clustered the ${dataset.name} atlas`}</h2>
        <p style={{ color: "#666", fontSize: 15, marginTop: 0, marginBottom: 8 }}>
          {revealed
            ? `${clusters.length} de-novo clusters · ${validated.size} validated. Click a cluster on the map or pick one below.`
            : sampled
            ? `${clusters.length} de-novo Leiden clusters, colored on a ${clusteredCells.toLocaleString()}-cell representative sample of the full ${fullCells!.toLocaleString()}-cell atlas (real UMAP). Here's how we found them — then choose a cluster to label.`
            : `${clusters.length} de-novo Leiden clusters, colored — ${clusteredCells.toLocaleString()} cells, one dot each (real UMAP). Here's how we found them — then choose a cluster to label.`}
        </p>
        {/* methodology note — why this many cells, and that the clustering is ours, not the authors' */}
        <p style={{ color: "#9a948c", fontSize: 12.5, marginTop: 0, marginBottom: 18, lineHeight: 1.5, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
          {sampled
            ? `The sample spans every condition in ${dataset.name} (perturbed and control alike) — it is not a biological subset, just a random cross-section drawn so we can cluster ${clusteredCells.toLocaleString()} cells rather than all ${fullCells!.toLocaleString()}.`
            : ""}
          {dataset.groundTruthUrl
            ? ` We re-cluster from scratch — the authors' published cell-type labels are held out, so we can score our de-novo calls against them afterward.`
            : ""}
        </p>

        {/* run info bar — model (chosen on the previous screen) + projected cost.
            "spent so far" shows only once a run actually has labelled clusters. */}
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

        <div ref={wrap} style={{ display: "inline-block", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 14, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <UmapCanvas clusters={clusters} mode="global" colored activeId={null} validated={validated} width={size.w} height={size.h} onPick={onPick} />
        </div>
        {!revealed && <ClusteringProvenance datasetId={dataset.id} nClusters={clusters.length} />}

        {loadedNote && (
          <div style={{ maxWidth: 640, margin: "14px auto 0", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 13px", fontSize: 13, color: "#92400e", textAlign: "left", lineHeight: 1.5 }}>
            <strong>📝 Run note:</strong> {loadedNote}
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          {!revealed ? (
            <button onClick={onReveal} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px 26px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Choose a cluster to investigate →
            </button>
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
                <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                  <button onClick={onExport} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14 }}>⬇ Export results (JSON) + save to server</button>
                  <button onClick={() => setShowPrev(true)} style={{ ...btnGhost, padding: "9px 18px", fontSize: 13 }}>☁ Load Previous Run…</button>
                </div>
                <ImportButton onImport={onImport} label="⬆ Import results (JSON)" />
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
                    <>
                      <span style={{ color: "#15803d" }}>✓ Server run complete — saved.</span>
                      <button onClick={() => setShowPrev(true)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12.5 }}>☁ Open Load Previous Run</button>
                    </>
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
              {showPrev && <PreviousRunsModal datasetId={dataset.id} onLoad={onImport} onClose={() => setShowPrev(false)} />}
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
type GTTier = { label: string | null; frac: number; n: number };
type GroundTruth = { tiers: string[]; fullDatasetCells?: number; clusteredCells?: number; clusters: Record<string, Record<string, GTTier>> };
type TierVerdict = { match: boolean; note: string };
type ClusterVerdict = { id: string; germ_layer: TierVerdict; tissue: TierVerdict; cell_type_broad: TierVerdict; cell_type_sub: TierVerdict };
const SCORE_TIERS: { key: keyof Omit<ClusterVerdict, "id">; gtKey: string; label: string }[] = [
  { key: "germ_layer", gtKey: "germ_layer", label: "Germ layer" },
  { key: "tissue", gtKey: "tissue", label: "Tissue" },
  { key: "cell_type_broad", gtKey: "cell_type_broad", label: "Cell type — broad" },
  { key: "cell_type_sub", gtKey: "cell_type_sub", label: "Cell type — sub" },
];

// --- driver-scoring: parse the kasperov-conclude label that's actually persisted as the
// assignment (NOT the confidence side-channel). Abstention credited at the tier reached.
// Mirrors _parse_driver/_attempted in backend/daniotype_autopilot_api/app.py.
function normTierIdx(s: string): number | null {
  const x = (s || "").toLowerCase().trim();
  if (x.includes("germ")) return 0;
  if (x.includes("tissue")) return 1;
  if (x.includes("broad")) return 2;
  if (x.includes("sub")) return 3;
  if (x.includes("cell type") || x.includes("cell_type")) return 2;
  return null;
}
function parseDriverLabel(finalLabel: string): { identity: string; reached: number; kind: "assign" | "abstain" | "unresolved" } {
  const fl = (finalLabel || "").trim();
  const m = fl.match(/\(abstain(?:ed)?\s*[·:-]\s*([^)]+)\)/i);
  if (m && m.index != null) {
    const idx = normTierIdx(m[1]);
    return { identity: fl.slice(0, m.index).trim(), reached: idx == null ? 1 : idx, kind: "abstain" };
  }
  if (!fl || fl.toLowerCase().includes("unresolved")) return { identity: "", reached: -1, kind: "unresolved" };
  return { identity: fl, reached: 3, kind: "assign" };
}
function attemptedTier(reached: number, kind: string, tierIdx: number): boolean {
  return kind === "unresolved" ? false : tierIdx <= reached;
}

function ScorecardEmbedWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "left" }}>{children}</div>;
}
function ScorecardPageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 70px" }}>{children}</div>
    </div>
  );
}

function Scorecard({
  dataset,
  clusters,
  labels,
  confidence,
  validated,
  onPick,
  model,
  addUsage,
  score,
  setScore,
  onImport,
  embedded,
  onBack,
}: {
  dataset: DatasetDef;
  clusters: Cluster[];
  labels: Record<string, string>;
  confidence: Record<string, ClusterConf>;
  validated?: Set<string>;
  onPick?: (id: string) => void;
  model: string;
  addUsage: (model: string, inT: number, outT: number) => void;
  score: RunScore;
  setScore: React.Dispatch<React.SetStateAction<RunScore>>;
  onImport: (data: unknown) => void;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const labelled = useMemo(() => clusters.filter((c) => labels[c.id]), [clusters, labels]);
  const fingerprint = useMemo(() => JSON.stringify(labelled.map((c) => [c.id, labels[c.id]]).sort()), [labelled, labels]);
  const verdicts = score.verdicts; // controlled by the parent (so export sees it)

  const [gt, setGt] = useState<GroundTruth | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "scoring" | "done" | "error">("loading");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState("");
  const allLabelled = clusters.length > 0 && clusters.every((c) => labels[c.id]);

  const gtTiersFor = useCallback(
    (id: string) => {
      const rec = gt?.clusters?.[id] ?? {};
      return {
        germ_layer: rec.germ_layer?.label ?? null,
        tissue: rec.tissue?.label ?? null,
        cell_type_broad: rec.cell_type_broad?.label ?? null,
        cell_type_sub: rec.cell_type_sub?.label ?? null,
      };
    },
    [gt]
  );

  const subFracFor = useCallback((id: string) => gt?.clusters?.[id]?.cell_type_sub?.frac ?? 0, [gt]);

  // DRIVER-SCORING aggregate: per-tier agreement over clusters that have a verdict + a
  // reference label AND that attempted the tier (abstention is credited at the tier
  // reached — finer tiers are not-attempted, never counted as a miss).
  const computeAgg = useCallback(
    (verds: Record<string, ClusterVerdict>): TierAgg[] =>
      SCORE_TIERS.map((t, ti) => {
        let matched = 0;
        let total = 0;
        for (const c of labelled) {
          const v = verds[c.id];
          const ref = gtTiersFor(c.id)[t.gtKey as keyof ReturnType<typeof gtTiersFor>];
          const drv = parseDriverLabel(labels[c.id] || "");
          if (!v || !ref || !attemptedTier(drv.reached, drv.kind, ti)) continue;
          total++;
          if (v[t.key].match) matched++;
        }
        return { key: t.key, label: t.label, matched, total, pct: total ? (100 * matched) / total : 0 };
      }),
    [labelled, gtTiersFor, labels]
  );

  // purity-stratified sub (headline = high-purity frac>=0.5) + abstention precision
  const computeExtras = useCallback(
    (verds: Record<string, ClusterVerdict>): { subStrat: SubStrat; abstention: AbstentionStat } => {
      let hi = 0, hin = 0, lo = 0, lon = 0, wnum = 0, wden = 0;
      for (const c of labelled) {
        const v = verds[c.id];
        const drv = parseDriverLabel(labels[c.id] || "");
        if (!v || !attemptedTier(drv.reached, drv.kind, 3) || !gtTiersFor(c.id).cell_type_sub) continue;
        const f = subFracFor(c.id);
        const m = v.cell_type_sub.match ? 1 : 0;
        wnum += m * f; wden += f;
        if (f >= 0.5) { hin++; hi += m; } else { lon++; lo += m; }
      }
      const pc = (mt: number, tt: number): PctCount => ({ matched: mt, total: tt, pct: tt ? (100 * mt) / tt : 0 });
      const subStrat: SubStrat = { headline: "high_purity", high: pc(hi, hin), low: pc(lo, lon), raw: pc(hi + lo, hin + lon), weighted_pct: wden ? (100 * wnum) / wden : 0 };
      const forcedFail = (kindsel: string): FailCount => {
        let fail = 0, tot = 0;
        for (const c of labelled) {
          const v = verds[c.id];
          const drv = parseDriverLabel(labels[c.id] || "");
          if (drv.kind !== kindsel || !v || !gtTiersFor(c.id).cell_type_sub) continue;
          tot++;
          if (!v.cell_type_sub.match) fail++;
        }
        return { fail, total: tot, pct: tot ? (100 * fail) / tot : 0 };
      };
      const kindOf = (id: string) => parseDriverLabel(labels[id] || "").kind;
      const abstention: AbstentionStat = {
        n_assign: labelled.filter((c) => kindOf(c.id) === "assign").length,
        n_abstain: labelled.filter((c) => kindOf(c.id) === "abstain").length,
        n_unresolved: labelled.filter((c) => kindOf(c.id) === "unresolved").length,
        abstained_forced_sub_fail: forcedFail("abstain"),
        assigned_forced_sub_fail: forcedFail("assign"),
      };
      return { subStrat, abstention };
    },
    [labelled, gtTiersFor, labels, subFracFor]
  );

  // load ground truth; decide whether the stored score already covers this label set
  useEffect(() => {
    if (!dataset.groundTruthUrl) {
      setErr("This dataset has no published ground truth.");
      setStatus("error");
      return;
    }
    let alive = true;
    const decide = () => {
      const need = labelled.some((c) => !score.verdicts[c.id]);
      // "idle" = structure shown but un-filled; the user presses the button to fill it
      setStatus(score.scoredAt && !need ? "done" : "idle");
    };
    if (gt) {
      decide();
      return;
    }
    fetch(dataset.groundTruthUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`ground truth ${r.status}`);
        return r.json();
      })
      .then((d: GroundTruth) => {
        if (!alive) return;
        setGt(d);
        decide();
      })
      .catch((e) => alive && (setErr(String(e?.message ?? e)), setStatus("error")));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset.groundTruthUrl, fingerprint]);

  // score clusters (default: only those missing a verdict; full=true re-scores all)
  const runScoring = useCallback(
    async (full?: boolean) => {
      if (!gt) return;
      setStatus("scoring");
      setErr("");
      const targets = full ? labelled : labelled.filter((c) => !score.verdicts[c.id]);
      const toScore = targets.length ? targets : labelled;
      const items = toScore.map((c) => {
        // DRIVER-SCORING: judge the persisted kasperov-conclude identity at every tier,
        // not the confidence side-channel. (Abstention crediting happens in aggregation.)
        const drv = parseDriverLabel(labels[c.id] || "");
        const pred = drv.identity || labels[c.id] || "";
        const predictions = { germ_layer: pred, tissue: pred, cell_type_broad: pred, cell_type_sub: pred };
        return { id: c.id, ourLabel: labels[c.id], predictions, markers: c.degsUp, gt: gtTiersFor(c.id) };
      });
      const BATCH = 10;
      const batches: (typeof items)[] = [];
      for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
      setProgress({ done: 0, total: items.length });
      const acc: Record<string, ClusterVerdict> = { ...score.verdicts };
      let failed = 0;
      let doneN = 0;
      let next = 0;
      async function worker() {
        while (next < batches.length) {
          const b = batches[next++];
          try {
            const r = await fetch("/api/kasperov_score", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ dataset: dataset.id, model, items: b }),
            });
            if (!r.ok) throw new Error(`score ${r.status}`);
            const d = await r.json();
            if (d.usage) addUsage(d.usage.model ?? model, d.usage.in ?? 0, d.usage.out ?? 0);
            for (const res of d.results ?? []) if (res?.id) (acc[res.id] = res), doneN++;
          } catch {
            failed += b.length;
          }
          setScore((s) => ({ ...s, verdicts: { ...acc } }));
          setProgress({ done: doneN + failed, total: items.length });
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
      const extras = computeExtras(acc);
      setScore({ verdicts: acc, scoredAt: new Date().toISOString(), agg: computeAgg(acc), subStrat: extras.subStrat, abstention: extras.abstention });
      setStatus("done");
    },
    [gt, labelled, labels, gtTiersFor, computeAgg, computeExtras, dataset.id, model, addUsage, score.verdicts, setScore]
  );

  const agg = computeAgg(verdicts);
  const scoredCount = labelled.filter((c) => verdicts[c.id]).length;

  const Wrapper = embedded ? ScorecardEmbedWrap : ScorecardPageWrap;

  return (
    <Wrapper>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          {!embedded && onBack && <button onClick={onBack} style={btnGhost}>← World map</button>}
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>{dataset.name} · ground-truth scorecard</div>
          <ImportButton onImport={onImport} label="⬆ Import run (JSON)" style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 13 }} />
        </div>
        <h2 style={{ fontSize: embedded ? 22 : 26, fontWeight: 700, margin: "4px 0 2px" }}>Our de-novo labels vs the published atlas</h2>
        <p style={{ color: "#666", fontSize: 14.5, margin: "0 0 18px", lineHeight: 1.5 }}>
          An LLM judge scores each of our {scoredCount}/{labelled.length} labelled clusters against the authors&apos; published labels at every ontology tier — by
          biological meaning, not string match. Agreement should fall as the tier gets finer; that gradient is the honest read on how deep our calls actually resolve.
        </p>

        {status === "error" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
            {err || "Scoring failed."}
          </div>
        )}

        {(status === "scoring" || status === "loading") && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#555", fontSize: 14, marginBottom: 16 }}>
            <span style={{ animation: "kpulse 1s infinite" }}>🎯</span>
            {status === "loading" ? "Loading ground truth…" : `Scoring clusters… ${progress.done}/${progress.total}`}
          </div>
        )}

        {/* tier agreement bars — shown un-filled (—) until the comparison is run */}
        {status !== "loading" && status !== "error" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 8 }}>
            {agg.map((t) => {
              const heat = confColor(t.pct);
              return (
                <div key={t.key} style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", fontWeight: 700 }}>{t.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: heat.fg, fontVariantNumeric: "tabular-nums" }}>{t.total ? t.pct.toFixed(0) : "—"}{t.total ? "%" : ""}</span>
                    <span style={{ fontSize: 12.5, color: "#999" }}>{t.matched}/{t.total} agree</span>
                  </div>
                  <div style={{ height: 8, background: "#eee7df", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${t.pct}%`, height: "100%", background: heat.fg }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* driver-scoring extras: purity-stratified sub headline + abstention precision */}
        {status === "done" && score.subStrat && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, margin: "4px 0 8px" }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d", fontWeight: 700 }}>Sub-type — headline (high-purity)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 4px" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>{score.subStrat.high.total ? score.subStrat.high.pct.toFixed(0) : "—"}{score.subStrat.high.total ? "%" : ""}</span>
                <span style={{ fontSize: 12.5, color: "#666" }}>{score.subStrat.high.matched}/{score.subStrat.high.total} on pure clusters (frac≥0.5)</span>
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>raw {score.subStrat.raw.pct.toFixed(0)}% ({score.subStrat.raw.matched}/{score.subStrat.raw.total}) · weighted {score.subStrat.weighted_pct.toFixed(0)}% · low-purity {score.subStrat.low.total ? score.subStrat.low.pct.toFixed(0) + "%" : "—"} ({score.subStrat.low.matched}/{score.subStrat.low.total})</div>
            </div>
            {score.abstention && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#a16207", fontWeight: 700 }}>Abstention precision</div>
                <div style={{ fontSize: 13.5, color: "#444", margin: "6px 0 4px", lineHeight: 1.5 }}>
                  Forced sub-call would-fail: <b style={{ color: "#a16207" }}>{score.abstention.abstained_forced_sub_fail.total ? score.abstention.abstained_forced_sub_fail.pct.toFixed(0) + "%" : "—"}</b> on abstained ({score.abstention.abstained_forced_sub_fail.fail}/{score.abstention.abstained_forced_sub_fail.total}) vs {score.abstention.assigned_forced_sub_fail.total ? score.abstention.assigned_forced_sub_fail.pct.toFixed(0) + "%" : "—"} on assigned. A higher abstained rate means abstention declines precisely where a forced call fails.
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>assign {score.abstention.n_assign} · abstain {score.abstention.n_abstain} · unresolved {score.abstention.n_unresolved}</div>
              </div>
            )}
          </div>
        )}

        {/* the trigger — fills the comparison in once all clusters are labelled */}
        <div style={{ display: "flex", gap: 12, margin: "14px 0 18px", alignItems: "center", flexWrap: "wrap" }}>
          {(status === "idle" || status === "scoring") && (
            <button
              onClick={() => runScoring(true)}
              disabled={!allLabelled || status === "scoring"}
              title={allLabelled ? "" : "Label every cluster first"}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: allLabelled && status !== "scoring" ? "#15803d" : "#cdd5cf", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, cursor: allLabelled && status !== "scoring" ? "pointer" : "default" }}
            >
              🎯 {status === "scoring" ? `Comparing… ${progress.done}/${progress.total}` : `Compare to ${dataset.name} ground truth`}
            </button>
          )}
          {status === "done" && <button onClick={() => runScoring(true)} style={{ ...btnGhost, fontSize: 13.5 }}>↻ Re-run comparison</button>}
          {status === "idle" && !allLabelled && (
            <span style={{ fontSize: 12.5, color: "#92400e" }}>Label all {clusters.length} clusters to enable the comparison.</span>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>
            Reference: {dataset.name} published labels{gt?.clusteredCells ? ` · ${gt.clusteredCells.toLocaleString()} cells clustered` : ""} · model {model}. Numeric sub-type suffixes (e.g. &ldquo;periderm 10&rdquo;) are matched on the biological stem.
          </span>
        </div>

        {/* per-cluster detail — the full set of clusters with their tier cells (un-filled until scored) */}
        {clusters.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #e5e1dc", borderRadius: 12, background: "#fffdfb" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", background: "#faf7f3" }}>
                  <th style={{ padding: "9px 12px", fontWeight: 700 }}>Cluster · our label · conf</th>
                  {SCORE_TIERS.map((t) => (
                    <th key={t.key} style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clusters.map((c) => {
                  const v = verdicts[c.id];
                  const refs = gtTiersFor(c.id);
                  const cc = confidence[c.id];
                  const conf = overallConf(cc);
                  const hasLabel = !!labels[c.id];
                  const isVal = validated?.has(c.id);
                  const heat = typeof conf === "number" ? confColor(conf) : null;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onPick?.(c.id)}
                      title={hasLabel ? `${c.label}: ${labels[c.id]} — click to open` : `${c.label} — not yet labelled`}
                      style={{ borderTop: "1px solid #eee7df", opacity: hasLabel ? 1 : 0.6, cursor: onPick ? "pointer" : "default" }}
                    >
                      <td style={{ padding: "9px 12px", minWidth: 240, verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                          <strong>{c.label}</strong>
                          {isVal && <span style={{ color: "#15803d", fontWeight: 800, fontSize: 11.5 }} title="validated">✓</span>}
                          {typeof conf === "number" && heat && (
                            <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: heat.fg, background: heat.bg, border: `1px solid ${heat.fg}22`, borderRadius: 99, padding: "1px 6px" }}>
                              {conf.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div style={{ color: hasLabel ? "#555" : "#b3ada5", fontStyle: hasLabel ? "normal" : "italic", marginTop: 2 }}>{hasLabel ? labels[c.id] : "not yet labelled"}</div>
                      </td>
                      {SCORE_TIERS.map((t) => {
                        const ref = refs[t.gtKey as keyof typeof refs];
                        const tv = v ? v[t.key] : null;
                        const ok = tv?.match;
                        const tp = cc ? (cc[t.key as keyof Omit<ClusterConf, "why">] as TierPred | undefined) : undefined;
                        const tHeat = tp && typeof tp.pct === "number" ? confColor(tp.pct) : null;
                        return (
                          <td key={t.key} style={{ padding: "9px 12px", verticalAlign: "top", minWidth: 160 }} title={tv?.note || ""}>
                            {/* OUR prediction + per-tier confidence (shown as we work the cluster) */}
                            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                              {tv && <span style={{ color: ok ? "#15803d" : "#c2410c", fontWeight: 800, flexShrink: 0 }}>{ok ? "✓" : "✗"}</span>}
                              <span style={{ color: tp ? "#333" : "#cbc5be", minWidth: 0 }}>{tp?.prediction || "·"}</span>
                              {tp && tHeat && typeof tp.pct === "number" && (
                                <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: tHeat.fg, background: tHeat.bg, borderRadius: 99, padding: "0px 5px" }}>{tp.pct.toFixed(0)}%</span>
                              )}
                            </div>
                            {/* the corrected ZSCAPE label — subtle red — only after scoring + only when wrong */}
                            {tv && !ok && ref && <div style={{ color: "#dc7a5a", fontSize: 11.5, marginTop: 2 }}>→ {ref}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
type AgentMode = "research" | "archivist" | "reason";
type ChatMsg = { role: "user" | "assistant"; content: string; mode?: AgentMode; thinking?: string };

// per-personality theming for badges, router cards, and loading views
// Global personality colour code: green = Researcher, yellow = Archivist, blue = Reasoner.
const THEME: Record<AgentMode, { name: string; icon: string; color: string; bg: string; trace: string; verb: string; blurb: string }> = {
  research: { name: "Researcher", icon: "🔬", color: "#15803d", bg: "#f0fdf4", trace: "Research log", verb: "Searching ZFIN · ZFA · GO…", blurb: "ZFIN / ZFA / GO literature" },
  archivist: { name: "Archivist", icon: "🗄", color: "#a16207", bg: "#fef9c3", trace: "Archive search", verb: "Pulling records from the MiniFin stacks…", blurb: "raw MiniFin records" },
  reason: { name: "Reasoner", icon: "🧠", color: "#2563eb", bg: "#eff6ff", trace: "Reasoning", verb: "Reasoning across what's known…", blurb: "generalist synthesis" },
};
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
  done: boolean;
};

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
        conclude: { ...base, label: formatConcludeLabel(base), citedMarkers, confidence: typeof o.confidence === "number" ? o.confidence : undefined, done: o.done !== false },
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
  const upList = c.degsUp.slice(0, 8).join(", ");
  return (
    `${c.label}'s top up-regulated markers are: ${upList || "(none)"}. ` +
    `Using ZFIN curated expression, ZFA anatomy, and GO, identify the most likely zebrafish cell type ` +
    `(with state if the markers support it), grounding each claim in a cited record. If the evidence is ambiguous, say so.`
  );
}

// the K=2 second proposer for auto-pilot — an independent, alternative-hypothesis
// read so the Reasoner has two grounded opinions to adjudicate, not one.
function secondOpinionPrompt(c: Cluster): string {
  const upList = c.degsUp.slice(0, 8).join(", ");
  return (
    `Independent second opinion for ${c.label}. Its top up-regulated markers are: ${upList || "(none)"}. ` +
    `Assume NO prior conclusion. Name at least one ALTERNATIVE cell-type hypothesis besides the most obvious one and weigh them ` +
    `against each other using ZFIN curated expression, ZFA anatomy, and GO, citing a record for each claim. ` +
    `If the markers are ambiguous between identities, say which and why, and which tier (germ layer / tissue / cell type) is the deepest you can defend.`
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
const AUTO_REASON_PROMPT =
  "You have TWO independent Researcher reads of this cluster above (a default read and an alternative-hypothesis read) AND the Archivist's raw ground-truth stats for the top markers. Reconcile the literature reads AGAINST the raw numbers: where they agree, that's strong; where they disagree, resolve it with the Archivist's stats (which marker is actually the most enriched / most specific?). If a discussed gene's DEG score still matters and the Archivist hasn't reported it, dispatch the Archivist for it. If the specialists are exhausted, the raw stats are confirmed, and the (identity, state) is settled, conclude with a kasperov-conclude block — citing markers that are actually in THIS cluster's marker list; if you cannot ground a specific cell type, set decision \"abstain\" and name the deepest tier you can defend. Otherwise dispatch the single most useful next query (kasperov-dispatch), preferring the Archivist when raw numbers are still missing.";
const AUTO_NUDGE_PROMPT =
  "Decide now — do not ask me. Either conclude with a kasperov-conclude block (assign if the identity is grounded in this cluster's markers, or abstain at the deepest defensible tier if not) or dispatch the next query with a kasperov-dispatch block.";
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
}: {
  dataset: DatasetDef;
  model: string;
  addUsage: (model: string, inT: number, outT: number) => void;
  clusters: Cluster[];
  active: Cluster;
  validated: Set<string>;
  onBack: () => void;
  onValidate: (id: string, yes: boolean) => void;
  goToCluster: (id: string) => void;
  autoConsumedRef: React.MutableRefObject<number>;
  onAutoDone?: () => void;
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
  async function refreshConfidence(msgs: ChatMsg[], clusterId: string, added?: string) {
    if (!msgs.some((m) => m.role === "assistant")) return;
    setConfBusy(true);
    try {
      const r = await fetch("/api/kasperov_confidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: dataset.id, model, cluster: { id: clusterId, label: active.label }, messages: msgs, addedMarkers: added ?? addedText(augmentedRef.current[clusterId] ?? []) }),
      });
      if (!r.ok) {
        console.warn("[kasperov] confidence refresh failed:", r.status, await r.text().catch(() => ""));
        return;
      }
      const d = await r.json();
      if (d.usage) addUsage(d.usage.model ?? model, d.usage.in ?? 0, d.usage.out ?? 0);
      if (d.tiers && d.tiers.germ_layer) {
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
      if (now - lastLiveConf > (fast ? 15000 : 5000)) {
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
          dataset: dataset.id,
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
    const next = incorporateFrom(cl, content, via);
    refreshConfidence(transcripts[cl.id] ?? [], cl.id, addedText(next));
    return next;
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
    // 1) K=2 INDEPENDENT identity proposers (Researcher) — a default read and an
    //    alternative-hypothesis read, each from a fresh context so they can't
    //    anchor on each other. The Reasoner then adjudicates the two.
    const p1 = await autoStream(cl, [{ role: "user", content: defaultPrompt(cl) }], "research");
    added = autoAddMarkers(cl, p1[p1.length - 1].content, "research");
    if (autoAbort.current) return;
    const p2 = await autoStream(cl, [{ role: "user", content: secondOpinionPrompt(cl) }], "research");
    added = autoAddMarkers(cl, p2[p2.length - 1].content, "research");
    if (autoAbort.current) return;
    // 1b) ARCHIVIST verification — at least once per cluster, pull the cluster's
    //     ground-truth numbers (log2FC, %in/out, p-values, specificity) for the
    //     top markers, so the Reasoner adjudicates against raw data, not just lit.
    const topG = (cl.degsUp ?? []).slice(0, 6).join(", ") || (cl.markers ?? []).slice(0, 6).map((m) => m.g).join(", ");
    const arch = await autoStream(cl, [{ role: "user", content: `Pull this cluster's raw DEG stats for its top markers (${topG}): exact log2FC, %in/out, BH-adjusted p-value, and cross-cluster specificity. Return the full per-gene table so we can confirm which are the strongest, most specific markers.` }], "archivist");
    added = autoAddMarkers(cl, arch[arch.length - 1].content, "archivist");
    // merged context: both independent reads + the Archivist's raw stats, for the Reasoner to reconcile
    let conv: ChatMsg[] = [
      { role: "user", content: defaultPrompt(cl) },
      p1[p1.length - 1],
      { role: "user", content: "Independent second read (alternative-hypothesis pass) for the same cluster:" },
      p2[p2.length - 1],
      { role: "user", content: "Archivist raw-data verification of the top markers (ground-truth stats):" },
      arch[arch.length - 1],
    ];
    // 2) Reasoner-orchestrated rounds — adjudicate, dispatch follow-ups, conclude
    for (let round = 0; round < AUTO_MAX_ROUNDS; round++) {
      if (autoAbort.current) return;
      conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_REASON_PROMPT }], "reason");
      let rc = conv[conv.length - 1].content;
      added = autoAddMarkers(cl, rc, "reason");
      let concl = splitConclude(rc).conclude;
      let dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      if (!concl && dispatches.length === 0) {
        // neither concluded nor dispatched → nudge once
        conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_NUDGE_PROMPT }], "reason");
        rc = conv[conv.length - 1].content;
        added = autoAddMarkers(cl, rc, "reason");
        concl = splitConclude(rc).conclude;
        dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      }
      if (concl?.done) {
        // require-evidence-to-name: roll up to abstain if no cited marker is grounded
        const grounded = enforceCiteDiscipline(concl, cl, added);
        onLabel(cl.id, grounded.label);
        onValidate(cl.id, true);
        return;
      }
      for (const d of dispatches) {
        if (autoAbort.current) return;
        conv = await autoStream(cl, [...conv, { role: "user", content: d.prompt }], d.to);
        added = autoAddMarkers(cl, conv[conv.length - 1].content, d.to);
      }
    }
    // ran out of rounds — accept best-effort so the loop keeps moving
    onValidate(cl.id, true);
    if (!labels[cl.id]) onLabel(cl.id, "(unresolved — review)");
  }

  async function runAutopilot() {
    if (auto.running) return;
    autoAbort.current = false;
    setAutoReport(null);
    // auto-detect & skip clusters that already have a cell-type label (= done).
    // NB: keyed off labels, not `validated` — a cluster can be validated by hand
    // without a label, and those still need the labeller to run.
    const alreadyLabelled = clusters.filter((c) => labels[c.id]).length;
    const queue = clusters.filter((c) => !labels[c.id]);
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
          <strong style={{ fontSize: 16 }}>{active.label}</strong>
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
                {(w, h) => <UmapCanvas clusters={clusters} mode="global" colored activeId={active.id} validated={validated} width={w} height={h} showFocus />}
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
                    {m.role === "user" ? "You asked" : `${model}${m.mode ? ` · ${THEME[m.mode].name}` : ""}`}
                  </div>
                  {m.role === "user" ? (
                    <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, border: "1px solid #e2ded8", borderLeft: "3px solid #b0a99f", borderRadius: 8, background: "#faf8f6", padding: "8px 10px" }}>{m.content}</div>
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
// Evidence-source classification (colours the rounded evidence boxes)
// ---------------------------------------------------------------------------
type SourceKey = "ZFIN" | "ZFA" | "GO" | "NCBI" | "UniProt";
function classifyHref(href: string): SourceKey | null {
  const h = href.toLowerCase();
  if (h.includes("zfin.org")) return "ZFIN";
  if (h.includes("/zfa") || h.includes("ols") && h.includes("zfa")) return "ZFA";
  if (h.includes("quickgo") || h.includes("geneontology") || h.includes("amigo")) return "GO";
  if (h.includes("uniprot")) return "UniProt";
  if (h.includes("ncbi.nlm.nih.gov")) return "NCBI";
  if (h.includes("ebi.ac.uk")) return "ZFA"; // OLS default → anatomy
  return null;
}
// pull the first href + any leading **SOURCE** token from a hast li node
function liSource(node: any): SourceKey | null {
  let href: string | null = null;
  const walk = (n: any) => {
    if (!n || href) return;
    if (n.tagName === "a" && n.properties?.href) href = String(n.properties.href);
    (n.children ?? []).forEach(walk);
  };
  (node?.children ?? []).forEach(walk);
  if (href) {
    const k = classifyHref(href);
    if (k) return k;
  }
  // fall back to a leading bold source word
  const txt = JSON.stringify(node ?? {});
  const m = txt.match(/\b(ZFIN|ZFA|GO|NCBI|UniProt)\b/);
  return (m?.[1] as SourceKey) ?? null;
}

// ---------------------------------------------------------------------------
const mdH: React.CSSProperties = { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, color: ACCENT, margin: "12px 0 6px", paddingTop: 8, borderTop: "1px solid #f0ece7" };
const baseMD = {
  h1: (p: any) => <div style={mdH}>{p.children}</div>,
  h2: (p: any) => <div style={mdH}>{p.children}</div>,
  h3: (p: any) => <div style={mdH}>{p.children}</div>,
  p: (p: any) => <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{p.children}</p>,
  ul: (p: any) => <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>{p.children}</ul>,
  ol: (p: any) => <ol style={{ margin: "0 0 8px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>{p.children}</ol>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#1f2937" }}>{p.children}</strong>,
  a: (p: any) => (
    <a href={p.href} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2 }}>{p.children}</a>
  ),
  blockquote: (p: any) => (
    <blockquote style={{ margin: "0 0 8px", padding: "4px 10px", borderLeft: `3px solid #e5e1dc`, color: "#777", background: "#faf8f6" }}>{p.children}</blockquote>
  ),
  code: (p: any) => <code style={{ background: "#f0eeec", padding: "1px 5px", borderRadius: 4, fontSize: 12.5 }}>{p.children}</code>,
  table: (p: any) => (
    <div style={{ border: "1px solid #d8d3cd", borderRadius: 8, overflow: "hidden", margin: "0 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{p.children}</table>
    </div>
  ),
  th: (p: any) => <th style={{ textAlign: "left", padding: "5px 8px", background: "#f3f0ec", borderBottom: "1px solid #e5e1dc", fontWeight: 700, color: "#555" }}>{p.children}</th>,
  td: (p: any) => <td style={{ padding: "5px 8px", borderBottom: "1px solid #f3f0ec" }}>{p.children}</td>,
};
// Markdown components for a personality. Every colour in an agent message is the
// PERSONALITY colour (headings, links, evidence); plain text stays neutral.
function mdFor(mode: AgentMode) {
  const th = THEME[mode];
  const heading = (p: any) => <div style={{ ...mdH, color: th.color }}>{p.children}</div>;
  const base: any = {
    ...baseMD,
    h1: heading,
    h2: heading,
    h3: heading,
    a: (p: any) => (
      <a href={p.href} target="_blank" rel="noreferrer" style={{ color: th.color, textDecoration: "underline", textUnderlineOffset: 2 }}>
        {p.children}
      </a>
    ),
  };
  if (mode !== "research") return base; // archivist tables / reasoner prose render plain
  return {
    ...base,
    // each evidence item: a small source chip + plain text — no boxed section
    li: (p: any) => {
      const src = liSource(p.node);
      if (!src) return <li style={{ lineHeight: 1.45, listStyle: "disc", marginLeft: 18 }}>{p.children}</li>;
      return (
        <li style={{ listStyle: "none", display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.45, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: th.color, border: `1px solid ${th.color}55`, borderRadius: 4, padding: "0 4px", marginTop: 2, whiteSpace: "nowrap" }}>{src}</span>
          <span>{p.children}</span>
        </li>
      );
    },
  };
}

// Reasoning-trace dropdown shown in the CENTER chat. While the model is
// thinking (`collapsed=false`) it stays open and grows as the trace streams in;
// once the settled answer starts (`collapsed=true`) it compresses to a single
// line (with a teaser of the last thought) — re-expandable by clicking.
function ThinkingTrace({ thinking, mode, collapsed }: { thinking: string; mode: AgentMode; collapsed: boolean }) {
  const th = THEME[mode] ?? THEME.reason;
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? !collapsed;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thinking, open]);
  const lastLine = thinking.replace(/\s+/g, " ").trim().slice(-140);
  return (
    <div style={{ marginBottom: 10, border: `1px solid ${th.color}33`, borderRadius: 8, background: th.bg, overflow: "hidden" }}>
      <button
        onClick={() => setOverride(!open)}
        style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "7px 10px", fontSize: 11, color: th.color, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span style={{ flexShrink: 0 }}>{th.icon} {th.trace}</span>
        {!open && lastLine && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>· {lastLine}</span>}
      </button>
      {open && (
        <div ref={bodyRef} style={{ maxHeight: 220, overflowY: "auto", padding: "0 10px 8px", fontSize: 11.5, color: "#888", lineHeight: 1.45 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={traceMD}>{thinking}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// Compact, grey, markdown-rendered reasoning trace.
const traceMD = {
  p: (p: any) => <p style={{ margin: "0 0 5px", lineHeight: 1.45 }}>{p.children}</p>,
  h1: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h2: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h3: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#555" }}>{p.children}</strong>,
  ul: (p: any) => <ul style={{ margin: "0 0 5px", paddingLeft: 16 }}>{p.children}</ul>,
  li: (p: any) => <li style={{ marginBottom: 2 }}>{p.children}</li>,
  a: (p: any) => <a href={p.href} target="_blank" rel="noreferrer" style={{ color: "#888" }}>{p.children}</a>,
  code: (p: any) => <code style={{ background: "#eee", padding: "0 3px", borderRadius: 3 }}>{p.children}</code>,
};

function AgentMessage({ content, mode = "research", actions, thinking, thinkingCollapsed = true, pending = false }: { content: string; mode?: AgentMode; actions?: React.ReactNode; thinking?: string; thinkingCollapsed?: boolean; pending?: boolean }) {
  const m = content.match(/\*\*Verdict:\*\*\s*(.+)$/im);
  const verdict = m ? m[1].trim() : null;
  const body = (m ? content.slice(0, m.index) : content).trim();
  // confidence level is shown greyscale — colour encodes personality only
  const confLabel = verdict ? (/high/i.test(verdict) ? "high" : /med/i.test(verdict) ? "medium" : /low/i.test(verdict) ? "low" : null) : null;
  const verdictName = verdict ? verdict.replace(/—?\s*confidence\s+\w+\.?$/i, "").trim() : "";
  const th = THEME[mode];
  const badge = { color: th.color };
  const isArchivist = mode === "archivist";
  return (
    <div
      style={{
        fontSize: 13.5,
        color: INK,
        // every personality's response sits in its own colour-bordered section
        border: `1px solid ${badge.color}33`,
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 8,
        background: "#fffdfb",
        padding: "8px 10px",
      }}
    >
      {/* the personality's reasoning trace (e.g. RESEARCH LOG) lives INSIDE its
          own bubble, at the top — collapsed to one line once the answer is here */}
      {thinking && <ThinkingTrace thinking={thinking} mode={mode} collapsed={thinkingCollapsed} />}
      {isArchivist && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontStyle: "italic" }}>
          Values under “Raw facts” are read directly from the dataset; anything under “Read” is the model&apos;s inference.
        </div>
      )}
      {body ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode)}>
          {body}
        </ReactMarkdown>
      ) : pending ? (
        <div style={{ fontSize: 12.5, color: "#999", fontStyle: "italic" }}>{th.icon} drafting the answer…</div>
      ) : null}
      {verdict && (
        <div style={{ marginTop: 8, border: `1px solid ${badge.color}`, borderLeft: `3px solid ${badge.color}`, borderRadius: 10, background: "#fffdfb", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: badge.color, fontWeight: 700 }}>Verdict</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b", flex: 1 }}>{verdictName || verdict}</span>
            {confLabel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", background: "#ece8e3", padding: "2px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {confLabel}
              </span>
            )}
          </div>
        </div>
      )}
      {actions && <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div>}
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
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMeasure?: (h: number) => void;
  children: (w: number, h: number) => React.ReactNode;
}) {
  const [z, setZ] = useState(() => ++zTop);
  const raise = () => setZ(++zTop);
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
        zIndex: z,
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

// the per-personality tagged notes that have snowballed on a gene
function markerNotes(m: Marker): { via: AgentMode; text: string }[] {
  if (m.notes?.length) return m.notes;
  return m.note ? [{ via: m.via ?? "research", text: m.note }] : [];
}

// Reveals text one character at a time, left-to-right, whenever it CHANGES — so
// every live update to a Top Markers note / Tier prediction reads in fluidly.
// The whole reveal is capped to ~0.42s so frequent live edits stay snappy.
function Typewriter({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState("");
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    if (typeof window === "undefined" || !text) {
      setShown(text);
      return;
    }
    const total = text.length;
    const step = Math.max(6, Math.min(24, Math.round(420 / Math.max(1, total))));
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= total) clearInterval(id);
    }, step);
    return () => clearInterval(id);
  }, [text]);
  return <span style={style}>{shown}</span>;
}

// one tagged note line: a coloured personality chip + its ≤8-word contribution
function NoteLine({ via, text, scale = 1 }: { via: AgentMode; text: string; scale?: number }) {
  const th = THEME[via] ?? THEME.research;
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, fontSize: 10 * scale, color: "#555", lineHeight: 1.28 }}>
      <span style={{ fontSize: 7.5 * scale, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase", marginRight: 4 }}>{th.name}</span>
      <Typewriter text={text} />
    </div>
  );
}

// chat-contributed annotations, snowballed inline beneath a gene's row — one
// tagged line per personality that has weighed in on the gene
function Annot({ m, scale = 1 }: { m: Marker; scale?: number }) {
  const notes = markerNotes(m);
  if (!notes.length) return null;
  return (
    <div style={{ marginLeft: 60 * scale, marginTop: 1, marginBottom: 2, display: "flex", flexDirection: "column", gap: 1 }}>
      {notes.map((n, i) => (
        <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
      ))}
    </div>
  );
}

function MarkerRow({ m, max, color, scale = 1 }: { m: Marker; max: number; color: string; scale?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 * scale }}>
      <span style={{ width: 66 * scale, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
      <div style={{ flex: 1, height: 6 * scale + 1, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(Math.abs(m.l2fc ?? 0) / max) * 100}%`, height: "100%", background: color }} />
      </div>
      <span style={{ width: 46 * scale, textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>{m.p1 != null ? `${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}</span>
    </div>
  );
}

// a chat-added gene that has floated into the up/down list as a ✦ row
function AddedRow({ m, max, color, scale = 1 }: { m: Marker; max: number; color: string; scale?: number }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, marginLeft: -2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 * scale }}>
        <span style={{ width: 62 * scale, fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
        <div style={{ flex: 1, height: 6 * scale + 1, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          {m.l2fc != null && <div style={{ width: `${(Math.abs(m.l2fc) / max) * 100}%`, height: "100%", background: color }} />}
        </div>
        <span style={{ fontSize: 8 * scale, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase" }}>✦{th.name[0]}</span>
      </div>
      {markerNotes(m).length > 0 && (
        <div style={{ marginLeft: 8, marginTop: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          {markerNotes(m).map((n, i) => (
            <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarkersContent({ cluster, added }: { cluster: Cluster; added: Marker[] }) {
  const top = cluster.markers.slice(0, 8);
  const down = cluster.markersDown.slice(0, 8);
  const baseUp = new Set(top.map((m) => m.g.toLowerCase()));
  const baseDown = new Set(down.map((m) => m.g.toLowerCase()));
  const listed = new Set<string>([...top.map((m) => m.g.toLowerCase()), ...down.map((m) => m.g.toLowerCase())]);
  // annotations attach to base rows; chat genes with a direction float into the lists
  const annByGene = new Map(added.map((m) => [m.g.toLowerCase(), m]));
  const addedUp = added.filter((m) => m.dir === "up" && !baseUp.has(m.g.toLowerCase()));
  const addedDown = added.filter((m) => m.dir === "down" && !baseDown.has(m.g.toLowerCase()));
  const extra = added.filter((m) => !m.dir && !listed.has(m.g.toLowerCase()));
  const maxUp = Math.max(...top.map((m) => m.l2fc ?? 0), ...addedUp.map((m) => Math.abs(m.l2fc ?? 0)), 1);
  const maxDn = Math.max(...down.map((m) => Math.abs(m.l2fc ?? 0)), ...addedDown.map((m) => Math.abs(m.l2fc ?? 0)), 1);

  // dynamic density: as the snowball grows, shrink text/spacing so the WHOLE
  // UP + DOWN set + notes stays visible without a scrollbar
  const totalNotes = added.reduce((s, m) => s + markerNotes(m).length, 0);
  const lines = top.length + down.length + addedUp.length + addedDown.length + extra.length + totalNotes;
  const scale = lines > 46 ? 0.72 : lines > 38 ? 0.79 : lines > 30 ? 0.86 : lines > 23 ? 0.93 : 1;
  const rowGap = Math.max(1, Math.round(3 * scale));
  const hz = 10 * scale; // section header font

  return (
    <div>
      <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `2px 0 ${rowGap + 1}px` }}>▲ UP-REGULATED</div>
      <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
        {top.map((m) => (
          <React.Fragment key={m.g}>
            <MarkerRow m={m} max={maxUp} color="#8a847b" scale={scale} />
            {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} scale={scale} />}
          </React.Fragment>
        ))}
        {addedUp.map((m) => (
          <AddedRow key={m.g} m={m} max={maxUp} color="#8a847b" scale={scale} />
        ))}
      </div>

      <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `${rowGap + 6}px 0 ${rowGap + 1}px` }}>▼ DOWN-REGULATED</div>
      {down.length || addedDown.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
          {down.map((m) => (
            <React.Fragment key={m.g}>
              <MarkerRow m={m} max={maxDn} color="#b8b2a8" scale={scale} />
              {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} scale={scale} />}
            </React.Fragment>
          ))}
          {addedDown.map((m) => (
            <AddedRow key={m.g} m={m} max={maxDn} color="#b8b2a8" scale={scale} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10.5 * scale, color: "#aaa", lineHeight: 1.35 }}>none computed</div>
      )}

      {extra.length > 0 && (
        <>
          <div style={{ fontSize: hz, fontWeight: 700, color: "#555", margin: `${rowGap + 6}px 0 ${rowGap}px` }}>✦ ALSO DISCUSSED (not yet placed)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: rowGap + 1 }}>
            {extra.map((m) => (
              <div key={m.g} style={{ fontSize: 11 * scale }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{m.g}</span>
                  {m.l2fc != null && <span style={{ color: "#888", fontSize: 10 * scale }}>log2FC {m.l2fc}</span>}
                </div>
                {markerNotes(m).length > 0 && (
                  <div style={{ marginTop: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    {markerNotes(m).map((n, i) => (
                      <NoteLine key={i} via={n.via} text={n.text} scale={scale} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// tween a number toward `target` with ease-in-out (accelerate then decelerate)
function useTween(target: number, duration = 1100): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    if (typeof requestAnimationFrame === "undefined" || typeof performance === "undefined") {
      fromRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // easeInOutQuad
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(from + (to - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// one tier's prediction + a smoothly-tweened confidence bar (greyscale — colour
// is reserved for personalities)
function TierConfRow({ label, pred, pct, celebrate }: { label: string; pred: string; pct: number; celebrate?: boolean }) {
  const shown = useTween(pct); // easeInOutQuad — accelerates then decelerates toward the new value
  const barColor = celebrate ? "#15803d" : "#6b6660";
  return (
    <div style={{ marginBottom: 11, borderRadius: 6, padding: celebrate ? "3px 5px" : 0, margin: celebrate ? "0 -5px 8px" : "0 0 11px", animation: celebrate ? "krowglow 1.6s ease-out forwards" : "none" }}>
      {/* row 1: tier name + the % */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span style={{ color: celebrate ? "#15803d" : "#999", fontWeight: celebrate ? 700 : 600, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 10 }}>{label}</span>
        <span style={{ color: celebrate ? "#15803d" : "#2b2b2b", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontSize: 14, textAlign: "right" }}>{shown.toFixed(0)}%</span>
      </div>
      {/* row 2: the label gets its OWN full-width line (names can be long) */}
      <Typewriter text={pred || "—"} style={{ display: "block", color: celebrate ? "#14532d" : "#2b2b2b", fontWeight: celebrate ? 700 : 500, fontSize: 12.5, lineHeight: 1.3, margin: "1px 0 3px", wordBreak: "break-word" }} />
      {/* row 3: the confidence bar */}
      <div style={{ height: 7, background: "#e8e4df", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${shown}%`, height: "100%", background: barColor, transition: "background .3s ease" }} />
      </div>
    </div>
  );
}

// Always-on TIER CONFIDENCE HUD. Renders the four tiers even before the first
// assessment (placeholder "—" / 0%), then the numbers tween up/down each turn.
// `celebrate` lights up the settled four-tier call when an auto-pilot job finishes.
function ConfidenceContent({ conf, busy, celebrate }: { conf?: ClusterConf; busy?: boolean; celebrate?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: celebrate ? "#15803d" : busy ? "#6b6660" : "#aaa", fontWeight: celebrate ? 700 : 400, marginBottom: 7 }}>
        {(busy || celebrate) && <span style={{ width: 6, height: 6, borderRadius: 99, background: celebrate ? "#15803d" : "#6b6660", animation: "kpulse 1.1s infinite", flexShrink: 0 }} />}
        <span>{celebrate ? "✓ Cell type labelled — four-tier call settled." : busy ? "Re-scoring all four tiers…" : conf ? "Goal: drive every tier's confidence up." : "Awaiting evidence — confidences update every turn."}</span>
      </div>
      {CONF_TIERS.map((t) => {
        const tp = conf?.[t.key];
        return <TierConfRow key={t.key} label={t.label} pred={tp?.prediction ?? ""} pct={tp?.pct ?? 0} celebrate={celebrate} />;
      })}
      {conf?.why && <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.45, marginTop: 4 }}><Typewriter text={conf.why} /></div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
const btnPrimary: React.CSSProperties = { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #d8d3cd", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: INK };
