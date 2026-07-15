// Per-dataset, per-stage pipeline VERSION registry — the selectable versions of each pipeline step,
// each with a plain-English "what's different". Surfaced in the New Run wizard as a version selector,
// and (eventually) stamped onto the run's pipeline{} so provenance records exactly which recipe ran.
//
// Versions are decimal: v0.0 = unspecified/legacy (no recorded recipe); vN.0 mirror the pillar SPEC
// integer versions (clustering-v2 -> v2.0, etc). Keep the summaries plain-English and honest — this is
// the copy a user reads to decide which version to run. Source of truth for the prose: pillars/<stage>/
// {SPEC,LEDGER}.md. When a pillar SPEC version bumps, add the new version here too.

export type PipelineStage = "clustering" | "labelling" | "merging" | "judge";
export type VersionStatus = "current" | "supported" | "legacy" | "defective" | "unspecified";
export type PipelineVersion = { version: string; name: string; summary: string; status: VersionStatus };

// Shared "no recorded recipe" option — every stage offers it so a user can explicitly decline to pin a version.
const UNSPECIFIED: PipelineVersion = {
  version: "v0.0",
  name: "Unspecified / legacy",
  status: "unspecified",
  summary:
    "No specific pipeline version pinned. Older runs whose exact recipe we don't have provenance for stamp v0.0. " +
    "Pick a numbered version to record exactly which recipe produced this run.",
};

export const PIPELINE_VERSIONS: Record<string, Partial<Record<PipelineStage, PipelineVersion[]>>> = {
  zscape: {
    clustering: [
      UNSPECIFIED,
      {
        version: "v1.0",
        status: "defective",
        name: "Flat global Leiden (superseded)",
        summary:
          "The original build: one global highly-variable-gene pass → Leiden at resolution 2.0 over all cells, with " +
          "no per-compartment recompute. Rare tissues (blood, liver, pancreas) stay buried inside larger compartments. " +
          "Superseded — kept for provenance only, not recommended for new runs.",
      },
      {
        version: "v2.0",
        status: "supported",
        name: "Recursive local-HVG · control-vote naming",
        summary:
          "Two-stage recursive clustering: a coarse Leiden (res 0.1) splits broad compartments, then inside each " +
          "compartment we recompute 2,000 local marker genes and re-cluster (local Leiden res 0.8). This surfaces " +
          "rare tissues a single global pass buries — 250 fine leaf clusters. Each leaf's provisional name is voted " +
          "from control (untreated) cells only.",
      },
      {
        version: "v3.0",
        status: "current",
        name: "Recursive local-HVG · all-cell naming",
        summary:
          "Identical partition to v2.0 — the same 250 leaves; the clustering itself is unchanged. The only difference: " +
          "each leaf's provisional name is voted from all cells rather than controls-only. Simpler single vote path, and " +
          "measured-neutral (0% tissue-identity flips vs v2.0). This is the current recommended recipe.",
      },
    ],
  },
  chemfish: {
    clustering: [
      UNSPECIFIED,
      {
        version: "v1.0",
        status: "current",
        name: "Harmony-integrated Leiden (res 3.0)",
        summary:
          "Highly-variable genes → PCA → Harmony batch-integration on experiment → 15-nearest-neighbour graph → " +
          "Leiden resolution sweep, resolution 3.0 chosen. 288 fine leaf clusters. A flat Harmony-integrated sweep " +
          "(not the ZSCAPE recursive local-HVG recipe) — appropriate for this chemical-screen atlas.",
      },
    ],
  },
  daniocell: {
    clustering: [
      UNSPECIFIED,
      {
        version: "v1.0",
        status: "current",
        name: "Harmony-integrated Leiden (stage)",
        summary:
          "Highly-variable genes → PCA → Harmony batch-integration on developmental stage → 15-nearest-neighbour graph → " +
          "Leiden resolution sweep. 270 fine leaf clusters (the de-novo partition). Same recipe family as ChemFish, " +
          "stage-integrated. (The authors' native published groups are a separate clustering choice, offered below.)",
      },
    ],
  },
};

export function versionsFor(datasetId: string, stage: PipelineStage): PipelineVersion[] {
  return PIPELINE_VERSIONS[datasetId]?.[stage] ?? [UNSPECIFIED];
}

// The default selected version for a dataset's stage — the one flagged `current`, else the last listed.
export function recommendedVersion(datasetId: string, stage: PipelineStage): string {
  const vs = versionsFor(datasetId, stage);
  return (vs.find((v) => v.status === "current") ?? vs[vs.length - 1]).version;
}
