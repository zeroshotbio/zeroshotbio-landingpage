// ssmpConfig.ts — ADAPTER-layer config for the SSMP review flag. The SSMP computation
// (ssmp.ts) is core/dataset-agnostic; the FLAG THRESHOLD is a per-dataset calibration —
// like the DanioCell n_enriched gate=11 — because the clean-vs-disjoint margin is tight
// and may not transfer across datasets. Core stays agnostic; only τ lives here.
//
// τ = 0.34 validated on sealed ZSCAPE (N=7 over-merges): catches C5-m1 (a mild-band over-merge
// the coherence metric D missed) with 0 false-fires on clean nodes. HONEST caveat — the margin
// is tight (lowest clean node SSMP = 0.363, only 0.023 above τ), so this threshold is
// dataset-specific and should be re-checked, not assumed to transfer. Flag-not-block contains
// the risk of a borderline fire.

export const SSMP_TAU_DEFAULT = 0.34;

// per-dataset overrides; fall back to default. Add a dataset only after checking its own
// SSMP distribution (do NOT reuse ZSCAPE's τ blind — the margin does not necessarily transfer).
export const SSMP_TAU: Record<string, number> = {
  zscape_recursive: 0.34, // validated (see above)
  // chemfish / daniocell: pending per-dataset distribution check before a tuned τ is set.
};

export function ssmpTau(datasetId?: string): number {
  return SSMP_TAU[datasetId ?? ""] ?? SSMP_TAU_DEFAULT;
}
