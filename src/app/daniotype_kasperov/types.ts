// types.ts — shared data shapes for the daniotype_kasperov wizard + (Phase 2)
// read-only run viewer. Extracted verbatim from KasperovClient.tsx so the live
// wizard and the future viewer share one source of truth. No runtime logic here
// beyond the tiny pure `overallConf` helper.

export type Pt = { x: number; y: number };

export type AgentMode = "research" | "archivist" | "reason";

// `notes` snowballs one short tagged annotation PER personality (Researcher /
// Archivist / Reasoner) as each contributes to the gene across turns. `note`/`via`
// keep the latest single contribution for back-compat.
export type Marker = { g: string; l2fc?: number; p1?: number; p2?: number; note?: string; via?: AgentMode; dir?: "up" | "down"; notes?: { via: AgentMode; text: string }[] };

export interface Cluster {
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

// Per-cluster characterization: a prediction + confidence at each of the four
// ontology tiers — the goal of a cluster's work is to drive these confidences up.
export type TierPred = { prediction: string; pct: number };
export type ClusterConf = { germ_layer: TierPred; tissue: TierPred; cell_type_broad: TierPred; cell_type_sub: TierPred; why?: string };

export const CONF_TIERS: { key: keyof Omit<ClusterConf, "why">; gtKey: string; label: string }[] = [
  { key: "germ_layer", gtKey: "germ_layer", label: "Germ layer" },
  { key: "tissue", gtKey: "tissue", label: "Tissue" },
  { key: "cell_type_broad", gtKey: "cell_type_broad", label: "Cell type — broad" },
  { key: "cell_type_sub", gtKey: "cell_type_sub", label: "Cell type — sub" },
];

export function overallConf(cc?: ClusterConf): number | undefined {
  if (!cc) return undefined;
  const ps = [cc.germ_layer, cc.tissue, cc.cell_type_broad, cc.cell_type_sub].map((t) => t?.pct).filter((x): x is number => typeof x === "number");
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : undefined;
}

export type SourceKey = "ZFIN" | "ZFA" | "GO" | "NCBI" | "UniProt";

export interface AtlasMeta {
  source: string;
  totalCells: number; // cells actually clustered (may be a sample of the full atlas)
  nClusters: number;
  fullDatasetCells?: number; // full atlas size, when totalCells is a sample
  pointsShown?: number; // dots plotted on the map (a downsample of totalCells)
  partitionId?: string | null; // from umap.json; fingerprint of THIS clustering
  namesApplied?: boolean; // true only when names.partitionId === atlas partitionId
  namesRunId?: string | null; // provenance of the overlaid names, when applied
}

// --- dataset registry + run-scoring shapes (shared with the Scorecard) ------
export type DatasetId = "minifin" | "zscape" | "chemfish" | "megafin" | "megafin_parse" | "daniocell";
export interface DatasetDef {
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

export type Usage = Record<string, { in: number; out: number }>; // tokens keyed by model id
export type TierAgg = { key: string; label: string; matched: number; total: number; pct: number };
export type PctCount = { matched: number; total: number; pct: number };
export type SubStrat = { headline: string; high: PctCount; low: PctCount; raw: PctCount; weighted_pct: number };
export type FailCount = { fail: number; total: number; pct: number };
export type AbstentionStat = { n_assign: number; n_abstain: number; n_unresolved: number; abstained_forced_sub_fail: FailCount; assigned_forced_sub_fail: FailCount };
export type TierVerdict = { match: boolean; note: string };
export type ClusterVerdict = { id: string; germ_layer: TierVerdict; tissue: TierVerdict; cell_type_broad: TierVerdict; cell_type_sub: TierVerdict };
export type RunScore = { verdicts: Record<string, ClusterVerdict>; scoredAt: string | null; agg: TierAgg[]; subStrat?: SubStrat | null; abstention?: AbstentionStat | null };

// Ground-truth atlas shape (used by the Scorecard).
export type GTTier = { label: string | null; frac: number; n: number };
export type GroundTruth = { tiers: string[]; fullDatasetCells?: number; clusteredCells?: number; clusters: Record<string, Record<string, GTTier>>; provenance?: any };
