"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KASPEROV_MODELS, DEFAULT_MODEL, estimateCost, type KasperovModel } from "./models";

const MODEL_KEY = "daniotype_kasperov_model"; // selected model persists globally
type Usage = Record<string, { in: number; out: number }>; // tokens keyed by model id
type TierAgg = { key: string; label: string; matched: number; total: number; pct: number };
type RunScore = { verdicts: Record<string, ClusterVerdict>; scoredAt: string | null; agg: TierAgg[] };

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
// our de-novo names against; MiniFin has none; MegaFin isn't sequenced yet.
// ---------------------------------------------------------------------------
type DatasetId = "minifin" | "zscape" | "chemfish" | "megafin";
interface DatasetDef {
  id: DatasetId;
  name: string;
  tagline: string;
  blurb: string;
  dataUrl: string; // umap.json
  archivistBase: string; // dir holding <cluster>.json + gene_matrix.json
  groundTruthUrl: string | null; // published-label benchmark, or null
  status: "ready" | "soon";
}
const DATASETS: DatasetDef[] = [
  {
    id: "minifin",
    name: "MiniFin",
    tagline: "Parse Evercode · 48 hpf · 94.6k cells · 47 Leiden clusters",
    blurb:
      "Our in-house zebrafish reference (Parse Biosciences Evercode). No external cell-type labels — the original sandbox for the labelling wizard.",
    dataUrl: "/daniotype_kasperov/minifin_umap.json",
    archivistBase: "/daniotype_kasperov/archivist",
    groundTruthUrl: null,
    status: "ready",
  },
  {
    id: "zscape",
    name: "ZSCAPE",
    tagline: "Saunders et al. · 3.2M cells · 55 de-novo clusters",
    blurb:
      "The Trapnell-lab whole-embryo atlas. We re-cluster from scratch (silhouette-gated sub-Leiden) and score our names against the authors' published germ-layer → tissue → broad → sub labels.",
    dataUrl: "/daniotype_kasperov/datasets/zscape/umap.json",
    archivistBase: "/daniotype_kasperov/datasets/zscape/archivist",
    groundTruthUrl: "/daniotype_kasperov/datasets/zscape/groundtruth.json",
    status: "ready",
  },
  {
    id: "chemfish",
    name: "ChemFish",
    tagline: "Barkan et al. · 2.1M cells · published cell_type (~348)",
    blurb:
      "Chemical-screen zebrafish atlas with published cell-type labels. Clustering + asset prep is the next dataset we wire up.",
    dataUrl: "/daniotype_kasperov/datasets/chemfish/umap.json",
    archivistBase: "/daniotype_kasperov/datasets/chemfish/archivist",
    groundTruthUrl: "/daniotype_kasperov/datasets/chemfish/groundtruth.json",
    status: "soon",
  },
  {
    id: "megafin",
    name: "MegaFin",
    tagline: "Parse Evercode · 2.1M cells · sequencing pending",
    blurb:
      "Our large-scale drug-screen atlas. Not sequenced yet; its only labels would be kNN-projected from ZSCAPE, so there's no independent ground truth to score against.",
    dataUrl: "/daniotype_kasperov/datasets/megafin/umap.json",
    archivistBase: "/daniotype_kasperov/datasets/megafin/archivist",
    groundTruthUrl: null,
    status: "soon",
  },
];
const DATASET_BY_ID = Object.fromEntries(DATASETS.map((d) => [d.id, d])) as Record<DatasetId, DatasetDef>;

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Marker = { g: string; l2fc?: number; p1?: number; p2?: number; note?: string; via?: AgentMode; dir?: "up" | "down" };
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
type Stage = "intro" | "map" | "personas" | "cluster" | "scorecard";

export default function KasperovClient() {
  const [dataset, setDataset] = useState<DatasetDef | null>(null);
  const { clusters, meta, error } = useAtlas(dataset?.dataUrl ?? null);
  const [stage, setStage] = useState<Stage>("intro");
  const [revealed, setRevealed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState(0); // bumping this signals ClusterStage to run auto-pilot
  const [personasSeen, setPersonasSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // chat state lives HERE (not in ClusterStage) so it survives map↔cluster
  // navigation — ClusterStage unmounts when you return to the map.
  const [transcripts, setTranscripts] = useState<Record<string, ChatMsg[]>>({});
  const [augmented, setAugmented] = useState<Record<string, Marker[]>>({});
  const [confidence, setConfidence] = useState<Record<string, { pct: number; why: string }>>({});
  const [incorporated, setIncorporated] = useState<Set<string>>(new Set());
  const hydratedRef = useRef<string | null>(null);

  // selected model (global), accumulated token usage per model (per-dataset), and
  // the latest ground-truth scoring (per-dataset) — all carried into the export.
  const [model, setModel] = useState<KasperovModel>(DEFAULT_MODEL);
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
    setStage("intro");
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
        if (p.score) setScore({ verdicts: p.score.verdicts ?? {}, scoredAt: p.score.scoredAt ?? null, agg: p.score.agg ?? [] });
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
      clusters: (clusters ?? []).map((c) => ({
        id: c.id,
        label: c.label,
        validated: validated.has(c.id),
        finalLabel: labels[c.id] ?? null,
        confidence: confidence[c.id] ?? null,
        addedMarkers: augmented[c.id] ?? [],
        transcript: transcripts[c.id] ?? [],
      })),
      groundTruth: score.scoredAt ? { scoredAt: score.scoredAt, aggregate: score.agg, verdicts: score.verdicts } : null,
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
    const nConf: Record<string, { pct: number; why: string }> = {};
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
      if (c.confidence && typeof c.confidence.pct === "number") nConf[id] = { pct: c.confidence.pct, why: String(c.confidence.why ?? "") };
      if (Array.isArray(c.addedMarkers) && c.addedMarkers.length) nAug[id] = c.addedMarkers;
      if (Array.isArray(c.transcript) && c.transcript.length) nTrans[id] = c.transcript;
    }
    setLabels(nLabels);
    setValidated(nVal);
    setConfidence(nConf);
    setAugmented(nAug);
    setTranscripts(nTrans);
    setIncorporated(new Set());
    // restore run metadata (model, cost/usage, ground-truth scores) when present
    if (data.cost?.usage && typeof data.cost.usage === "object") setUsage(data.cost.usage);
    else setUsage({});
    if ((KASPEROV_MODELS as readonly string[]).includes(data.model)) setModel(data.model as KasperovModel);
    if (data.groundTruth && Array.isArray(data.groundTruth.aggregate)) {
      setScore({ verdicts: data.groundTruth.verdicts ?? {}, scoredAt: data.groundTruth.scoredAt ?? null, agg: data.groundTruth.aggregate });
    } else {
      setScore({ verdicts: {}, scoredAt: null, agg: [] });
    }
    setRevealed(true); // so the cluster grid is visible immediately
    window.alert(`Imported ${loaded} labelled cluster${loaded === 1 ? "" : "s"} into the ${dataset.name} run.`);
  }

  function startAutopilot() {
    if (!clusters) return;
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

  if (!dataset) return <DatasetPicker onPick={setDataset} />;

  if (stage === "intro")
    return <Intro dataset={dataset} meta={meta} onStart={() => setStage("map")} onSwitch={() => setDataset(null)} />;

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
        labels={labels}
        confidence={confidence}
        model={model}
        onModelChange={setModel}
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
        onContinue={() => {
          setPersonasSeen(true);
          setStage("cluster");
        }}
      />
    );
  return (
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
            The server run store isn&apos;t configured yet (set <code>KASPEROV_RUNS_BUCKET</code> in Vercel env). Exported runs still download locally, and you can re-load them with <strong>Import results</strong>.
          </div>
        )}
        {status === "error" && <div style={{ color: "#b91c1c", fontSize: 14 }}>Failed to list runs: {err}</div>}
        {status === "ready" && runs && runs.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>No saved runs for this dataset yet — export a run (or run the server auto-pilot) to save one.</div>}
        {status === "ready" &&
          runs &&
          runs.map((m) => (
            <button
              key={m.runId}
              onClick={() => load(m.runId)}
              disabled={!!loadingId}
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e1dc", borderRadius: 10, padding: "10px 12px", marginBottom: 8, cursor: loadingId ? "default" : "pointer", color: INK }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{m.model}</span>
                <span style={{ fontSize: 12.5, color: "#666" }}>
                  {" "}· {m.nLabelled} labelled{m.hasGroundTruth ? " · scored" : ""}{m.source === "server" ? " · ☁ server" : ""}
                </span>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {new Date(m.exportedAt).toLocaleString()} · ~${money(Number(m.costUsd || 0))}{m.costEstimated ? "*" : ""} est.
                </div>
              </span>
              <span style={{ fontSize: 12.5, color: ACCENT, fontWeight: 700, flexShrink: 0 }}>{loadingId === m.runId ? "Loading…" : "Load →"}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dataset picker — the entry screen: choose which atlas to run the wizard on.
// ---------------------------------------------------------------------------
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {DATASETS.map((d) => {
            const ready = d.status === "ready";
            return (
              <button
                key={d.id}
                onClick={() => ready && onPick(d)}
                disabled={!ready}
                style={{
                  textAlign: "left",
                  background: ready ? "#fffdfb" : "#f3f0ec",
                  border: `1px solid ${ready ? "#e5e1dc" : "#e9e5df"}`,
                  borderTop: `3px solid ${ready ? ACCENT : "#cfcac4"}`,
                  borderRadius: 12,
                  padding: "18px 18px 20px",
                  cursor: ready ? "pointer" : "default",
                  opacity: ready ? 1 : 0.7,
                  color: INK,
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  minHeight: 188,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 19, fontWeight: 700 }}>{d.name}</span>
                  {!ready && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#926a1a", background: "#fef3c7", borderRadius: 99, padding: "2px 8px" }}>soon</span>}
                  {d.groundTruthUrl && (
                    <span title="Has published cell-type labels to score against" style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d", background: "#dcfce7", borderRadius: 99, padding: "2px 8px" }}>
                      ✓ ground truth
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{d.tagline}</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginTop: 2 }}>{d.blurb}</div>
                {ready && <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 13.5, fontWeight: 700, color: ACCENT }}>Open wizard →</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Intro({ onStart, meta, dataset, onSwitch }: { onStart: () => void; meta: AtlasMeta | null; dataset: DatasetDef; onSwitch: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 720, padding: "84px 28px" }}>
        <button onClick={onSwitch} style={{ ...btnGhost, marginBottom: 20, padding: "7px 13px", fontSize: 13 }}>← All datasets</button>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov · {dataset.name}</div>
        <h1 style={{ fontSize: 42, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.08 }}>Label the atlas, together</h1>
        <p style={{ fontSize: 18, color: "#555", lineHeight: 1.6, marginTop: 14 }}>
          Kasparov&apos;s wager: the strongest systems are human–AI hybrids. You fly over the real {dataset.name}
          {" "}single-cell atlas{meta ? (meta.fullDatasetCells && meta.fullDatasetCells > meta.totalCells ? ` (a ${meta.totalCells.toLocaleString()}-cell sample of the ${meta.fullDatasetCells.toLocaleString()}-cell atlas, ${meta.nClusters} de-novo clusters)` : ` (${meta.totalCells.toLocaleString()} cells, ${meta.nClusters} clusters)`) : ""}, drop into any
          cluster, and a research agent pulls grounded evidence from the canonical zebrafish resources (ZFIN, ZFA, GO)
          {" "}for that cluster&apos;s top markers — showing its reasoning and searches live. You decide whether its read is
          on track: accept it, or dig deeper in chat.
          {dataset.groundTruthUrl ? " When you finish, score our names against the authors' published labels." : ""}
        </p>
        <button onClick={onStart} style={{ marginTop: 28, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "15px 30px", fontSize: 18, fontWeight: 600, cursor: "pointer" }}>
          Begin the descent →
        </button>
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

function Personas({ onContinue }: { onContinue: () => void }) {
  const cards = [
    { mode: "reason" as AgentMode, pix: PIX_REASONER, blurb: "Your partner. Synthesises everything, judges when you're done, and offers one-click prompts to send the other two." },
    { mode: "research" as AgentMode, pix: PIX_RESEARCHER, blurb: "Searches ZFIN, ZFA & GO for grounded, cited evidence." },
    { mode: "archivist" as AgentMode, pix: PIX_ARCHIVIST, blurb: "Pulls raw MiniFin values — stats, specificity, p-values, co-expression." },
  ];
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 880, padding: "60px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#999", fontWeight: 600 }}>Your three specialists</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 4px" }}>One GPT-5-Mini, three personalities</h1>
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
  labels = {},
  confidence = {},
  model,
  onModelChange,
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
  labels?: Record<string, string>;
  confidence?: Record<string, { pct: number; why: string }>;
  model: KasperovModel;
  onModelChange: (m: KasperovModel) => void;
  usage: Usage;
  score: RunScore;
  setScore: React.Dispatch<React.SetStateAction<RunScore>>;
  addUsage: (model: string, inT: number, outT: number) => void;
  srvNote: string;
}) {
  const labelled = clusters.filter((c) => labels[c.id]);
  const unlabelled = clusters.filter((c) => !labels[c.id]);
  const [showScore, setShowScore] = useState(!!score.scoredAt);
  const [showPrev, setShowPrev] = useState(false);
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
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 2px" }}>{revealed ? "Choose a cluster to investigate" : sampled ? "A representative sample of the atlas" : "The whole dataset"}</h2>
        <p style={{ color: "#666", fontSize: 15, marginTop: 0, marginBottom: 8 }}>
          {revealed
            ? `${clusters.length} de-novo clusters · ${validated.size} validated. Click a cluster on the map or pick one below.`
            : sampled
            ? `${clusteredCells.toLocaleString()} cells — a representative random sample of the full ${fullCells!.toLocaleString()}-cell ${dataset.name} atlas, sized so de-novo clustering stays interactive. Each dot is one sampled cell — real UMAP. Reveal the clustering to start.`
            : `${clusteredCells.toLocaleString()} cells, one dot each — real UMAP. Reveal the clustering to start.`}
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

        {/* run controls bar — model selector + estimated spend + last-scored stamp */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555" }}>
            <span style={{ fontWeight: 600 }}>Model</span>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value as KasperovModel)}
              style={{ fontFamily: "inherit", fontSize: 13, padding: "5px 9px", borderRadius: 8, border: "1px solid #d8d3cd", background: "#fff", color: INK, cursor: "pointer" }}
            >
              {KASPEROV_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          {(() => {
            const c = estimateCost(usage);
            return (
              <span style={{ color: "#999" }} title={c.estimated ? "Includes tier-estimated pricing for newer models." : "From confirmed OpenAI pricing."}>
                ~${c.usd < 1 ? c.usd.toFixed(3) : c.usd.toFixed(2)} est. spend{c.estimated ? "*" : ""}
                {score.scoredAt ? ` · scored ${new Date(score.scoredAt).toLocaleDateString()}` : ""}
              </span>
            );
          })()}
        </div>

        <div ref={wrap} style={{ display: "inline-block", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 14, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <UmapCanvas clusters={clusters} mode="global" colored={revealed} activeId={null} validated={validated} width={size.w} height={size.h} onPick={onPick} />
        </div>

        <div style={{ marginTop: 20 }}>
          {!revealed ? (
            <button onClick={onReveal} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px 26px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              View Leiden clusters →
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
                {dataset.groundTruthUrl && labelled.length > 0 && (
                  <button
                    onClick={() => setShowScore(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#15803d", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                  >
                    🎯 Score vs ground truth ↓
                  </button>
                )}
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
              {showPrev && <PreviousRunsModal datasetId={dataset.id} onLoad={onImport} onClose={() => setShowPrev(false)} />}
              <p style={{ color: "#999", fontSize: 12.5, margin: "0 auto 14px", maxWidth: 560 }}>
                Auto-pilot drives the Reasoner across every un-labelled cluster — dispatching the Researcher &amp; Archivist,
                adding evidence, and accepting an identity when settled. Watch it go; stop anytime. (Uses OpenAI credits.)
              </p>

              {/* single cluster grid — cell type + confidence (heat-tinted) + ✓ validated */}
              <div style={{ marginTop: 8, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#999", fontWeight: 600 }}>
                    Run summary · {labelled.length}/{clusters.length} labelled · {validated.size} validated
                  </div>
                  <div style={{ fontSize: 11.5, color: "#aaa" }}>✓ = validated · % = confidence (red→green)</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 6 }}>
                  {clusters.map((c) => {
                    const conf = confidence[c.id]?.pct;
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

              {/* surface the gap — clusters that completed the run without a cell-type label */}
              {labelled.length > 0 && unlabelled.length > 0 && (
                <div style={{ marginTop: 14, textAlign: "left", fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px" }}>
                  {unlabelled.length} of {clusters.length} clusters not yet labelled: {unlabelled.map((c) => c.label.replace("Cluster ", "C")).join(", ")}. Run &ldquo;Activate AutoPilot Cluster Labeller&rdquo; — it auto-skips the {labelled.length} already labelled and finishes only these.
                </div>
              )}

              {/* ground-truth scoring, inline under the run summary */}
              {dataset.groundTruthUrl && showScore && labelled.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <Scorecard
                    embedded
                    dataset={dataset}
                    clusters={clusters}
                    labels={labels}
                    confidence={confidence}
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
  confidence: Record<string, { pct: number; why: string }>;
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
  const [status, setStatus] = useState<"loading" | "ready" | "scoring" | "done" | "error">("loading");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState("");
  const ranRef = useRef(false);

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

  // per-tier agreement over clusters that have a verdict + a reference label
  const computeAgg = useCallback(
    (verds: Record<string, ClusterVerdict>): TierAgg[] =>
      SCORE_TIERS.map((t) => {
        let matched = 0;
        let total = 0;
        for (const c of labelled) {
          const v = verds[c.id];
          const ref = gtTiersFor(c.id)[t.gtKey as keyof ReturnType<typeof gtTiersFor>];
          if (!v || !ref) continue;
          total++;
          if (v[t.key].match) matched++;
        }
        return { key: t.key, label: t.label, matched, total, pct: total ? (100 * matched) / total : 0 };
      }),
    [labelled, gtTiersFor]
  );

  // load ground truth; decide whether the stored score already covers this label set
  useEffect(() => {
    ranRef.current = false; // a new label-set (incl. an import) re-arms auto-scoring
    if (!dataset.groundTruthUrl) {
      setErr("This dataset has no published ground truth.");
      setStatus("error");
      return;
    }
    let alive = true;
    const decide = () => {
      const need = labelled.some((c) => !score.verdicts[c.id]);
      setStatus(score.scoredAt && !need ? "done" : "ready");
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
      const items = toScore.map((c) => ({ id: c.id, ourLabel: labels[c.id], markers: c.degsUp, gt: gtTiersFor(c.id) }));
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
      setScore({ verdicts: acc, scoredAt: new Date().toISOString(), agg: computeAgg(acc) });
      setStatus("done");
    },
    [gt, labelled, labels, gtTiersFor, computeAgg, dataset.id, model, addUsage, score.verdicts, setScore]
  );

  // auto-run once when ready
  useEffect(() => {
    if (status === "ready" && !ranRef.current) {
      ranRef.current = true;
      runScoring();
    }
  }, [status, runScoring]);

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

        {/* tier agreement bars */}
        {(status === "done" || (status === "scoring" && scoredCount > 0)) && (
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

        {/* re-run control */}
        <div style={{ display: "flex", gap: 10, margin: "14px 0 18px", alignItems: "center", flexWrap: "wrap" }}>
          {status === "done" && (
            <button onClick={() => { ranRef.current = true; runScoring(true); }} style={{ ...btnGhost, fontSize: 13.5 }}>↻ Re-run scoring</button>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>
            Reference: {dataset.name} published labels{gt?.clusteredCells ? ` · ${gt.clusteredCells.toLocaleString()} cells clustered` : ""} · model {model}. Numeric sub-type suffixes (e.g. &ldquo;periderm 10&rdquo;) are matched on the biological stem.
          </span>
        </div>

        {/* per-cluster detail */}
        {scoredCount > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #e5e1dc", borderRadius: 12, background: "#fffdfb" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", background: "#faf7f3" }}>
                  <th style={{ padding: "9px 12px", fontWeight: 700 }}>Cluster · our label</th>
                  {SCORE_TIERS.map((t) => (
                    <th key={t.key} style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labelled.map((c) => {
                  const v = verdicts[c.id];
                  const refs = gtTiersFor(c.id);
                  const conf = confidence[c.id]?.pct;
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid #eee7df" }}>
                      <td style={{ padding: "9px 12px", minWidth: 220, verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                          <strong>{c.label}</strong>
                          {typeof conf === "number" && <span style={{ fontSize: 11, color: "#aaa" }}>· {conf.toFixed(0)}%</span>}
                        </div>
                        <div style={{ color: "#555", marginTop: 2 }}>{labels[c.id]}</div>
                      </td>
                      {SCORE_TIERS.map((t) => {
                        const ref = refs[t.gtKey as keyof typeof refs];
                        const tv = v ? v[t.key] : null;
                        const ok = tv?.match;
                        return (
                          <td key={t.key} style={{ padding: "9px 12px", verticalAlign: "top", minWidth: 150 }} title={tv?.note || ""}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ color: ok ? "#15803d" : "#c2410c", fontWeight: 800 }}>{!tv ? "·" : ok ? "✓" : "✗"}</span>
                              <span style={{ color: "#444" }}>{ref ?? "—"}</span>
                            </div>
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
type ChatMsg = { role: "user" | "assistant"; content: string; mode?: AgentMode };

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
    const merged: Marker = { ...byGene.get(m.g.toLowerCase()), ...m, via };
    merged.dir = merged.dir ?? (merged.l2fc != null ? (merged.l2fc >= 1 ? "up" : merged.l2fc <= -1 ? "down" : undefined) : undefined);
    byGene.set(m.g.toLowerCase(), merged);
  });
  return Array.from(byGene.values());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTO_REASON_PROMPT =
  "You have TWO independent Researcher reads of this cluster above (a default read and an alternative-hypothesis read). Reconcile them: where they agree, that's strong; where they disagree, resolve it with the evidence. If the specialists are exhausted and the (identity, state) is settled, conclude with a kasperov-conclude block — citing markers that are actually in THIS cluster's marker list; if you cannot ground a specific cell type, set decision \"abstain\" and name the deepest tier you can defend. Otherwise dispatch the single most useful next query (kasperov-dispatch).";
const AUTO_NUDGE_PROMPT =
  "Decide now — do not ask me. Either conclude with a kasperov-conclude block (assign if the identity is grounded in this cluster's markers, or abstain at the deepest defensible tier if not) or dispatch the next query with a kasperov-dispatch block.";
const AUTO_MAX_ROUNDS = 4;

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
  autoStart: number;
  labels: Record<string, string>;
  onLabel: (id: string, label: string) => void;
  transcripts: Record<string, ChatMsg[]>;
  setTranscripts: React.Dispatch<React.SetStateAction<Record<string, ChatMsg[]>>>;
  augmented: Record<string, Marker[]>;
  setAugmented: React.Dispatch<React.SetStateAction<Record<string, Marker[]>>>;
  confidence: Record<string, { pct: number; why: string }>;
  setConfidence: React.Dispatch<React.SetStateAction<Record<string, { pct: number; why: string }>>>;
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
  const [showThinking, setShowThinking] = useState(true);
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

  // live confidence box (appears once there's a conversation to assess) — state in parent
  async function refreshConfidence(msgs: ChatMsg[], clusterId: string, added?: string) {
    if (!msgs.some((m) => m.role === "assistant")) return;
    try {
      const r = await fetch("/api/kasperov_confidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: dataset.id, model, cluster: { id: clusterId, label: active.label }, messages: msgs, addedMarkers: added ?? addedText(augmented[clusterId] ?? []) }),
      });
      if (!r.ok) return;
      const d = await r.json();
      if (d.usage) addUsage(d.usage.model ?? model, d.usage.in ?? 0, d.usage.out ?? 0);
      if (typeof d.pct === "number") setConfidence((c) => ({ ...c, [clusterId]: { pct: d.pct, why: d.why || "" } }));
    } catch {}
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

  // floating panels — geometry lifted here so Top Markers / Confidence can
  // auto-grow to fit content and push the others down (until the user drags one)
  const GAP = 12;
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

  function reflowBoxes(b: { wm: Box; mk: Box; cf: Box }) {
    const x = b.wm.x;
    const mk = { ...b.mk, x, y: b.wm.y + b.wm.h + GAP };
    const cf = { ...b.cf, x, y: mk.y + mk.h + GAP };
    return { ...b, mk, cf };
  }
  const moveBox = useCallback((k: "wm" | "mk" | "cf", x: number, y: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], x, y } } : p));
  }, []);
  const resizeBox = useCallback((k: "wm" | "mk" | "cf", w: number, h: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], w, h } } : p));
  }, []);
  const measureBox = useCallback((k: "mk" | "cf", h: number) => {
    setPb((p) => {
      if (!p || Math.abs(p[k].h - h) < 1) return p;
      const u = { ...p, [k]: { ...p[k], h } };
      return manualRef.current ? u : reflowBoxes(u);
    });
    // reflowBoxes is pure + GAP constant; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top Markers & Confidence also grow WIDER as they gather content (until the
  // user drags a panel, which switches everything to manual layout)
  useEffect(() => {
    if (manualRef.current) return;
    const added = augmented[active.id] ?? [];
    const why = confidence[active.id]?.why ?? "";
    const longestNote = added.reduce((mx, m) => Math.max(mx, m.note?.length ?? 0), 0);
    const mkW = Math.min(380, Math.max(250, 250 + (longestNote > 38 ? 105 : longestNote > 0 ? 45 : 0) + (added.length > 3 ? 25 : 0)));
    const cfW = Math.min(380, Math.max(250, 250 + Math.floor(why.length / 5)));
    setPb((p) => {
      if (!p || (p.mk.w === mkW && p.cf.w === cfW)) return p;
      const u = { ...p, mk: { ...p.mk, w: mkW }, cf: { ...p.cf, w: cfW } };
      return manualRef.current ? u : reflowBoxes(u);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [augmented, confidence, active.id]);

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
    // elapsed-time bar, counts up toward the 60s ceiling
    setElapsed(0);
    const startedAt = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Math.min(60, (Date.now() - startedAt) / 1000)), 250);
    let acc = "";
    let mode: AgentMode = forceMode ?? "research";
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
          cluster: { id: cl.id, label: cl.label, degsUp: cl.degsUp, markers: cl.markers, nCells: cl.nCells },
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
          else if (evt.t === "thinking") setThinking((p) => p + evt.v);
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
    const finalMsgs: ChatMsg[] = [...nextMsgs, { role: "assistant", content: acc || "_(no response)_", mode }];
    setTranscripts((t) => ({ ...t, [cl.id]: finalMsgs }));
    refreshConfidence(finalMsgs, cl.id);
    return finalMsgs;
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
  // pull any kasperov-markers out of a message and add them to Top Markers
  function autoAddMarkers(cl: Cluster, content: string, via: AgentMode, running: Marker[]): Marker[] {
    const mk = splitMarkerBlock(content).markers;
    if (!mk.length) return running;
    const next = mergeMarkers(running, mk, via);
    setAugmented((a) => ({ ...a, [cl.id]: next }));
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    refreshConfidence(transcripts[cl.id] ?? [], cl.id, addedText(next));
    return next;
  }

  // auto-pilot stream with one retry + a hard timeout, so a hung or failed request
  // can't stall the sweep. Throws if it STILL fails — runAutopilot records the
  // cluster as "couldn't finish" and moves on instead of hanging on it.
  async function autoStream(cl: Cluster, msgs: ChatMsg[], mode: AgentMode): Promise<ChatMsg[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (autoAbort.current) throw new Error("aborted");
      const conv = await streamAgent(cl, msgs, mode, true, 90_000);
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
    added = autoAddMarkers(cl, p1[p1.length - 1].content, "research", added);
    if (autoAbort.current) return;
    const p2 = await autoStream(cl, [{ role: "user", content: secondOpinionPrompt(cl) }], "research");
    added = autoAddMarkers(cl, p2[p2.length - 1].content, "research", added);
    // merged context: both independent reads, for the Reasoner to reconcile
    let conv: ChatMsg[] = [
      { role: "user", content: defaultPrompt(cl) },
      p1[p1.length - 1],
      { role: "user", content: "Independent second read (alternative-hypothesis pass) for the same cluster:" },
      p2[p2.length - 1],
    ];
    // 2) Reasoner-orchestrated rounds — adjudicate, dispatch follow-ups, conclude
    for (let round = 0; round < AUTO_MAX_ROUNDS; round++) {
      if (autoAbort.current) return;
      conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_REASON_PROMPT }], "reason");
      let rc = conv[conv.length - 1].content;
      added = autoAddMarkers(cl, rc, "reason", added);
      let concl = splitConclude(rc).conclude;
      let dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      if (!concl && dispatches.length === 0) {
        // neither concluded nor dispatched → nudge once
        conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_NUDGE_PROMPT }], "reason");
        rc = conv[conv.length - 1].content;
        added = autoAddMarkers(cl, rc, "reason", added);
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
        added = autoAddMarkers(cl, conv[conv.length - 1].content, d.to, added);
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
      } catch {
        failed.push(c.id); // errored after retry — record it and keep going
      }
    }
    setAuto((a) => ({ ...a, running: false, current: null, done: a.total }));
    if (!autoAbort.current) {
      setAutoReport({ already: alreadyLabelled, failed });
      if (failed.length) console.warn("[auto-pilot] could not finish clusters:", failed.join(", "));
    }
  }
  function stopAutopilot() {
    autoAbort.current = true;
    setAuto((a) => ({ ...a, running: false }));
  }

  // kick off when the map's "go through each cluster" button bumps autoStart
  const autoStartedRef = useRef(0);
  useEffect(() => {
    if (autoStart > 0 && autoStart !== autoStartedRef.current) {
      autoStartedRef.current = autoStart;
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
        {/* LEFT — zoom map + HUD */}
        <div ref={leftRef} style={{ flex: "1.25 1 0", position: "relative", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #fffefc, #f1ede8)" }}>
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#bbb", textTransform: "uppercase", letterSpacing: 1, pointerEvents: "none" }}>Focused cluster</div>
          <UmapCanvas clusters={clusters} mode="zoom" colored activeId={active.id} validated={validated} width={zoomW} height={Math.round(zoomW * 0.8)} />

          {pb && (
            <>
              {/* world map — draggable + resizable */}
              <DraggablePanel title="WORLD MAP" accent="#999" box={pb.wm} minW={150} minH={120} onMove={(x, y) => moveBox("wm", x, y)} onResize={(w, h) => resizeBox("wm", w, h)}>
                {(w, h) => <UmapCanvas clusters={clusters} mode="global" colored activeId={active.id} validated={validated} width={w} height={h} showFocus />}
              </DraggablePanel>

              {/* top markers — auto-grows to fit content, pushing the others down */}
              <DraggablePanel
                title={`TOP MARKERS${(augmented[active.id] ?? []).length ? ` · +${(augmented[active.id] ?? []).length} from chat` : ""}`}
                accent="#8a847b"
                box={pb.mk}
                minW={190}
                flash={flash}
                autoFitHeight
                onMove={(x, y) => moveBox("mk", x, y)}
                onResize={(w, h) => resizeBox("mk", w, h)}
                onMeasure={(h) => measureBox("mk", h)}
              >
                {() => <MarkersContent cluster={active} added={augmented[active.id] ?? []} />}
              </DraggablePanel>

              {/* live confidence — auto-grows to fit its rationale */}
              {confidence[active.id] && (
                <DraggablePanel
                  title="CONFIDENCE"
                  accent="#8a847b"
                  box={pb.cf}
                  minW={180}
                  autoFitHeight
                  onMove={(x, y) => moveBox("cf", x, y)}
                  onResize={(w, h) => resizeBox("cf", w, h)}
                  onMeasure={(h) => measureBox("cf", h)}
                >
                  {() => <ConfidenceContent pct={confidence[active.id].pct} why={confidence[active.id].why} />}
                </DraggablePanel>
              )}
            </>
          )}
        </div>

        {/* draggable splitter */}
        <div
          onMouseDown={startDrag}
          title="Drag to resize"
          style={{ width: 7, flexShrink: 0, cursor: "col-resize", background: "#e5e1dc", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ width: 2, height: 34, borderRadius: 2, background: "#bdb6ae" }} />
        </div>

        {/* RIGHT — GPT-5-Mini research panel (resizable) */}
        <aside style={{ width: panelW, flexShrink: 0, background: "#fffdfb", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid #f0ece7" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#555", fontWeight: 600 }}>GPT-5-Mini</div>
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
                    {canAdd && (
                      <button
                        onClick={() => incorporate(key, parsed.markers, m.mode ?? "research")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${THEME[m.mode ?? "research"].color}66`, color: THEME[m.mode ?? "research"].color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        ➕ Add {parsed.markers.length} {THEME[m.mode ?? "research"].name} insight{parsed.markers.length === 1 ? "" : "s"} to Top Markers →
                      </button>
                    )}
                    {parsed.markers.length > 0 && incorporated.has(key) && (
                      <span style={{ fontSize: 11.5, color: "#888", fontWeight: 600, alignSelf: "center" }}>✓ added to Top Markers</span>
                    )}
                    {pr.promotes.map((p, pi) => (
                      <button
                        key={`pr${pi}`}
                        onClick={() => promote(p.gene, p.dir, p.note, m.mode ?? "reason")}
                        title={p.note}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid #8a847b`, color: "#555", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        {p.dir === "up" ? "▲" : "▼"} Promote {p.gene} to {p.dir.toUpperCase()}-regulated →
                      </button>
                    ))}
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
                    {m.role === "user" ? "You asked" : `GPT-5-Mini${m.mode ? ` · ${THEME[m.mode].name}` : ""}`}
                  </div>
                  {m.role === "user" ? (
                    <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, border: "1px solid #e2ded8", borderLeft: "3px solid #b0a99f", borderRadius: 8, background: "#faf8f6", padding: "8px 10px" }}>{m.content}</div>
                  ) : (
                    <AgentMessage content={parsed.clean} mode={m.mode} actions={actions} />
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
                    <div style={{ width: `${(elapsed / 60) * 100}%`, height: "100%", background: THEME[sMode].color, borderRadius: 99, transition: "width .25s linear" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#999", fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>{elapsed.toFixed(0)}s / 60s</span>
                </div>
                {/* live status — themed verb */}
                <div style={{ fontSize: 12.5, color: THEME[sMode].color, marginBottom: 8, animation: "kpulse 1.6s ease-in-out infinite" }}>
                  {THEME[sMode].icon} {sStatus || THEME[sMode].verb}
                </div>
                {/* reasoning trace — themed header/colour per personality */}
                {sThinking && (
                  <div style={{ marginBottom: 10, border: `1px solid ${THEME[sMode].color}33`, borderRadius: 8, background: THEME[sMode].bg }}>
                    <button onClick={() => setShowThinking((s) => !s)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "7px 10px", fontSize: 11, color: THEME[sMode].color, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", fontWeight: 700 }}>
                      {showThinking ? "▾" : "▸"} {THEME[sMode].trace}
                    </button>
                    {showThinking && (
                      <div style={{ maxHeight: 180, overflowY: "auto", padding: "0 10px 8px", fontSize: 11.5, color: "#888", lineHeight: 1.45 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={traceMD}>{sThinking}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
                {/* streamed answer (marker block stripped during streaming) */}
                {sText ? <AgentMessage content={splitConclude(splitPromote(splitDispatch(splitMarkerBlock(sText).clean).clean).clean).clean} mode={sMode} /> : !sThinking && <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>{THEME[sMode].verb}</div>}
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

function AgentMessage({ content, mode = "research", actions }: { content: string; mode?: AgentMode; actions?: React.ReactNode }) {
  const m = content.match(/\*\*Verdict:\*\*\s*(.+)$/im);
  const verdict = m ? m[1].trim() : null;
  const body = (m ? content.slice(0, m.index) : content).trim();
  // confidence level is shown greyscale — colour encodes personality only
  const confLabel = verdict ? (/high/i.test(verdict) ? "high" : /med/i.test(verdict) ? "medium" : /low/i.test(verdict) ? "low" : null) : null;
  const verdictName = verdict ? verdict.replace(/—?\s*confidence\s+\w+\.?$/i, "").trim() : "";
  const th = THEME[mode];
  const badge = { label: `${th.name} · ${th.blurb}`, icon: th.icon, color: th.color, bg: th.bg };
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
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: badge.color, background: badge.bg, border: `1px solid ${badge.color}33`, borderRadius: 99, padding: "2px 9px", marginBottom: 8 }}>
        <span>{badge.icon}</span> {badge.label}
      </div>
      {isArchivist && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontStyle: "italic" }}>
          Values under “Raw facts” are read directly from the MiniFin dataset; anything under “Read” is GPT-5-Mini&apos;s inference.
        </div>
      )}
      {body && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode)}>
          {body}
        </ReactMarkdown>
      )}
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

function DraggablePanel({
  title,
  accent,
  box,
  minW = 160,
  minH = 90,
  flash = false,
  autoFitHeight = false,
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
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMeasure?: (h: number) => void;
  children: (w: number, h: number) => React.ReactNode;
}) {
  const [z, setZ] = useState(() => ++zTop);
  const raise = () => setZ(++zTop);
  const HEADER = 24;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // auto-fit panels report their rendered height so the parent can reflow
  useEffect(() => {
    if (!autoFitHeight || !onMeasure) return;
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const report = () => onMeasure(el.offsetHeight);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [autoFitHeight, onMeasure]);

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
        zIndex: z,
        background: "rgba(255,253,251,0.96)",
        border: `1px solid ${accent}44`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: flash ? "kflash .9s ease-out" : "none",
        transition: "top .2s ease, left .2s ease",
      }}
    >
      <div onMouseDown={startDrag} style={{ height: HEADER, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: accent, userSelect: "none" }}>
        <span style={{ opacity: 0.5 }}>⠿</span> {title}
      </div>
      <div style={{ flex: autoFitHeight ? "0 0 auto" : 1, minHeight: 0, overflow: autoFitHeight ? "visible" : "auto", padding: "0 8px 6px" }}>
        {children(box.w - 16, autoFitHeight ? 0 : box.h - HEADER - 12)}
      </div>
      <div onMouseDown={startResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, cursor: "nwse-resize", color: accent, opacity: 0.5, fontSize: 11, lineHeight: "14px", textAlign: "right" }}>◢</div>
    </div>
  );
}

// one chat-contributed annotation, shown inline beneath its gene's row
function Annot({ m }: { m: Marker }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ marginLeft: 76, marginTop: 1, marginBottom: 3, borderLeft: `2px solid ${th.color}`, paddingLeft: 7, fontSize: 10.5, color: "#666", lineHeight: 1.35 }}>
      <span style={{ fontSize: 8, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 4px", textTransform: "uppercase", marginRight: 5 }}>{th.name}</span>
      {m.note}
    </div>
  );
}

function MarkerRow({ m, max, color }: { m: Marker; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
      <span style={{ width: 70, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
      <div style={{ flex: 1, height: 7, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(Math.abs(m.l2fc ?? 0) / max) * 100}%`, height: "100%", background: color }} />
      </div>
      <span style={{ width: 48, textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>{m.p1 != null ? `${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}</span>
    </div>
  );
}

// a chat-added gene that has floated into the up/down list as a ✦ row
function AddedRow({ m, max, color }: { m: Marker; max: number; color: string }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, marginLeft: -2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
        <span style={{ width: 66, fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
        <div style={{ flex: 1, height: 7, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          {m.l2fc != null && <div style={{ width: `${(Math.abs(m.l2fc) / max) * 100}%`, height: "100%", background: color }} />}
        </div>
        <span style={{ fontSize: 8, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase" }}>✦{th.name[0]}</span>
      </div>
      {m.note && <div style={{ fontSize: 10, color: "#777", marginLeft: 8, lineHeight: 1.3 }}>{m.note}</div>}
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

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "2px 0 4px" }}>▲ UP-REGULATED</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {top.map((m) => (
          <React.Fragment key={m.g}>
            <MarkerRow m={m} max={maxUp} color="#8a847b" />
            {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} />}
          </React.Fragment>
        ))}
        {addedUp.map((m) => (
          <AddedRow key={m.g} m={m} max={maxUp} color="#8a847b" />
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "9px 0 4px" }}>▼ DOWN-REGULATED</div>
      {down.length || addedDown.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {down.map((m) => (
            <React.Fragment key={m.g}>
              <MarkerRow m={m} max={maxDn} color="#b8b2a8" />
              {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} />}
            </React.Fragment>
          ))}
          {addedDown.map((m) => (
            <AddedRow key={m.g} m={m} max={maxDn} color="#b8b2a8" />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: "#aaa", lineHeight: 1.35 }}>none computed</div>
      )}

      {extra.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "9px 0 3px" }}>✦ ALSO DISCUSSED (not yet placed)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {extra.map((m) => {
              const th = THEME[m.via ?? "research"];
              return (
                <div key={m.g} style={{ fontSize: 11, borderLeft: `2px solid ${th.color}`, paddingLeft: 7 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{m.g}</span>
                  {m.l2fc != null && <span style={{ color: "#888" }}> · log2FC {m.l2fc}</span>}
                  {m.note && <span style={{ color: "#666" }}> — {m.note}</span>}
                </div>
              );
            })}
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

function ConfidenceContent({ pct, why }: { pct: number; why: string }) {
  // greyscale only — colour is reserved for personalities
  const shown = useTween(pct); // number scrolls smoothly (accel/decel) toward the new value
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "#2b2b2b", fontVariantNumeric: "tabular-nums", minWidth: 86, display: "inline-block" }}>{shown.toFixed(1)}%</span>
        <div style={{ flex: 1, height: 7, background: "#e8e4df", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${shown}%`, height: "100%", background: "#6b6660" }} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.45, marginTop: 6 }}>{why}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const btnPrimary: React.CSSProperties = { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #d8d3cd", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: INK };
