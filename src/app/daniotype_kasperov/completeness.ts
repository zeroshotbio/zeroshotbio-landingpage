// completeness.ts — Phase 1 foundation for the daniotype_kasperov run viewer.
//
// A SINGLE pure function, `computeCompletenessProfile(run, context?)`, that
// turns one saved run JSON (schema "daniotype_kasperov_run/v1") into a
// capability descriptor: which blocks of data this particular run actually
// captured. Saved runs vary widely in completeness (some have full per-cluster
// chat transcripts, some none; some have tier-confidence, some null; some have
// ground truth, harness, provenance, notes — most don't), and the run's single
// `schema` tag does NOT distinguish them. This descriptor does.
//
// HARD RULES (see the Phase 1 brief):
//   * Pure. No I/O, no imports, no reads of dataset_facts.json / FACTS / atlas.
//   * NEVER back-fill clustering strategy (or any pipeline config) from live
//     app data. `hasClusteringStrategy` is true ONLY when the run JSON itself
//     structurally snapshotted it. A strategy the run may not have used is
//     worse than a blank → when unsure, false.
//   * Field-presence guards mirror the live wizard's applyRun() so "present"
//     here means the same thing the wizard means.
//
// `context` carries the one thing a run JSON cannot know about itself: whether
// it was archived and why (that lives in the dataset's _archive.json sidecar).
// Passing it stays pure — string in, category out.

export type ArchiveCategory = "quarantined" | "superseded" | "other";

export interface ArchiveContext {
  archived?: boolean;
  archivedReason?: string | null;
}

export interface CompletenessProfile {
  // --- identity (informational; not capability flags) ---
  datasetId: string | null;
  model: string | null;
  schema: string | null;
  exportedAt: string | null;
  nClusters: number;

  // --- per-cluster data blocks (flag + count + fraction 0..1) ---
  hasTranscripts: boolean;
  transcriptClusters: number;
  transcriptCoverage: number;

  hasConfidence: boolean;
  confidenceClusters: number;
  confidenceCoverage: number;

  hasMarkers: boolean;
  markerClusters: number;
  markerCoverage: number;

  hasLabels: boolean;
  labelledClusters: number;
  labelCoverage: number;

  hasValidated: boolean;
  validatedClusters: number;

  // --- run-level data blocks ---
  hasGroundTruth: boolean;
  scored: boolean; // GT scoring actually ran (aggregate present)
  hasHarness: boolean;
  hasProvenance: boolean;
  hasClusteringStrategy: boolean; // STRUCTURED snapshot in the run JSON only
  hasNote: boolean;

  // --- provenance-ish scalars ---
  source: string; // "browser" | "server" | "unknown"
  costEstimated: boolean;
  costUsd: number;

  // --- archive status (only knowable from sidecar context) ---
  archive: {
    archived: boolean;
    reason: string | null;
    category: ArchiveCategory | null;
  };

  // Informational ONLY. The free-text `dataset` name often embeds the strategy
  // ("…de-novo Leiden res 2.0…"), but a display label is NOT a structured
  // snapshot — this flag exists so the distribution report can show the gap,
  // and must NEVER drive `hasClusteringStrategy` or viewer disclosure.
  datasetNameMentionsStrategy: boolean;
}

// --- helpers ----------------------------------------------------------------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function isNonEmptyObject(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function frac(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

// Mirror of the wizard's confidence guard (applyRun: c.confidence &&
// c.confidence.germ_layer && typeof c.confidence.germ_layer.pct === "number").
function hasValidConfidence(c: any): boolean {
  const g = c?.confidence?.germ_layer;
  return !!g && typeof g.pct === "number";
}

/**
 * Classify a free-text archive reason into a viewer badge category.
 * Contamination MUST win over everything: a quarantined run must never read as
 * evidence even if the text also mentions superseding.
 */
export function classifyArchiveReason(reason: string | null | undefined): ArchiveCategory {
  if (!isNonEmptyString(reason)) return "other";
  const r = (reason as string).toLowerCase();
  if (/contaminat|quarantin|leak|poison|corrupt|invalid|tainted/.test(r)) return "quarantined";
  if (/supersed|parked|revert|replaced|preserved|stale|deprecat|superseding/.test(r)) return "superseded";
  return "other";
}

/**
 * Structured clustering-strategy snapshot detector.
 * Checks ONLY dedicated/nested structured fields inside the run JSON. Never the
 * `dataset` display string, never live FACTS. Returns false unless the run
 * deliberately recorded its strategy.
 */
function detectClusteringStrategy(run: any): boolean {
  const candidates = [
    run?.clusteringStrategy,
    run?.clustering,
    run?.provenance?.clustering,
    run?.provenance?.clusteringStrategy,
  ];
  return candidates.some((v) => isNonEmptyObject(v) || isNonEmptyString(v));
}

// --- the function ----------------------------------------------------------

export function computeCompletenessProfile(run: any, context?: ArchiveContext): CompletenessProfile {
  const clusters = asArray(run?.clusters);
  const n = clusters.length;

  let transcriptClusters = 0;
  let confidenceClusters = 0;
  let markerClusters = 0;
  let labelledClusters = 0;
  let validatedClusters = 0;

  for (const c of clusters as any[]) {
    if (asArray(c?.transcript).length > 0) transcriptClusters++;
    if (hasValidConfidence(c)) confidenceClusters++;
    if (asArray(c?.addedMarkers).length > 0) markerClusters++;
    if (isNonEmptyString(c?.finalLabel)) labelledClusters++;
    if (c?.validated) validatedClusters++;
  }

  const groundTruth = run?.groundTruth;
  const hasGroundTruth = isNonEmptyObject(groundTruth);
  // Mirror applyRun: scoring "ran" when an aggregate array is present.
  const scored = hasGroundTruth && asArray((groundTruth as any).aggregate).length > 0;

  const cost = run?.cost || {};

  const reason = context?.archivedReason ?? null;
  const archived = !!context?.archived;

  return {
    datasetId: run?.datasetId ?? null,
    model: run?.model ?? null,
    schema: run?.schema ?? null,
    exportedAt: run?.exportedAt ?? null,
    nClusters: n,

    hasTranscripts: transcriptClusters > 0,
    transcriptClusters,
    transcriptCoverage: frac(transcriptClusters, n),

    hasConfidence: confidenceClusters > 0,
    confidenceClusters,
    confidenceCoverage: frac(confidenceClusters, n),

    hasMarkers: markerClusters > 0,
    markerClusters,
    markerCoverage: frac(markerClusters, n),

    hasLabels: labelledClusters > 0,
    labelledClusters,
    labelCoverage: frac(labelledClusters, n),

    hasValidated: validatedClusters > 0,
    validatedClusters,

    hasGroundTruth,
    scored,
    hasHarness: isNonEmptyObject(run?.harness),
    hasProvenance: isNonEmptyObject(run?.provenance),
    hasClusteringStrategy: detectClusteringStrategy(run),
    hasNote: isNonEmptyString(run?.note),

    source: isNonEmptyString(run?.source) ? run.source : "unknown",
    costEstimated: !!cost.estimated,
    costUsd: typeof cost.usd === "number" ? cost.usd : 0,

    archive: {
      archived,
      reason,
      category: archived ? classifyArchiveReason(reason) : null,
    },

    datasetNameMentionsStrategy: /leiden|harmony|res\s*\d|de-?novo|silhouette|\bpca\b|\bhvg\b/i.test(
      isNonEmptyString(run?.dataset) ? run.dataset : "",
    ),
  };
}
