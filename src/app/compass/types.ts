export type Gene = { symbol: string; id: string; loading: number };
export type Enrichment = { process: string; direction: "UP" | "DOWN"; p: number; n_genes: number };
export type Program = {
  id: string; label: string; module: number; cross_tissue: boolean; tissues: string[];
  catalog_id: string; tier: string; score: number;
  rubric: Record<string, number>;
  evidence: {
    dense_reproducibility: number; sparse_reproducibility: number; lodo_worst: number; lodo_culprit: string;
    leave_one_tissue_out: number | null; heldout_stratum_recurrence: number | null;
    direction_transfer_chem10: number | null;
  };
  loading_conservation_chem11: number; loading_transfer_chem10: number | null;
  cos_placebo: number | null; cos_depth: number;
  enrichment: Enrichment[]; interpretation: string; caveat: string;
  top_positive: Gene[]; top_negative: Gene[]; gram_row: Record<string, number>;
};
export type ProgramsFile = { order: string[]; programs: Program[]; global_loading_conservation_chem11: number; source: string };

export type StratumLoading = { stratum: string; exposure_h: number; beta: number; ci_lo: number; ci_hi: number };
export type Loading = {
  beta: number; frac_captured: number; sign_consistent: boolean; n_tissues: number; n_embryos: number;
  strata: StratumLoading[]; chem10_beta: number | null;
};
export type Drug = {
  id: string; pathway: string; vehicle: string; loadings: Record<string, Loading>;
  phase2_cross_stratum_reproducibility: number; residual_catalog: { tier: string; score: number };
};
export type DrugLoadingsFile = { order: string[]; program_order: string[]; drugs: Drug[]; source: string };

export type Tissue = {
  name: string; group: string; powered: boolean; module: number | null; module_program: string | null;
  dense_reproducibility?: number; sparse_reproducibility?: number; lodo_worst?: number; lodo_culprit?: string;
  transfer_chem10?: number | null; drug_discrimination?: number | null; tier?: string; score?: number; parent?: string;
  n_embryos?: number; cos_to_axis?: Record<string, number>; drug_loading_on_axis?: Record<string, Record<string, number>>;
};
export type TissuesFile = { groups: string[]; tissues: Tissue[]; source: string };

export type Subset = {
  fraction_captured: number; residual_magnitude: number; coefficients: Record<string, number>;
  top_positive: Gene[]; top_negative: Gene[];
};
export type OrganismResidual = {
  top_positive: Gene[]; top_negative: Gene[]; n_strata: number;
  canonical_targets: { symbol: string; loading: number | null }[]; canonical_pathway: string;
  n_strata_coherent: number; coherence_p: number; coherence_percentile: number;
  dense_reproducibility: number; sparse_reproducibility: number; transfer_chem10: number | null; tier: string;
};
export type DrugResidual = {
  id: string; pathway: string; response_magnitude: number; raw_coefficients: Record<string, number>;
  n_tissues: number; subsets: Record<string, Subset>; organism_residual: OrganismResidual;
};
export type ResidualsFile = { program_order: string[]; gram: Record<string, Record<string, number>>; drugs: DrugResidual[]; source: string };

export type Annotation = { retained: string; discarded: string; interpretable: string; transfers: string; identity: string };
export type CompressionRow = {
  representation: string; dim: number; retrieval: number; per_drug: Record<string, number>;
  family: "sparse" | "pca" | "biological" | "hybrid" | "full"; annotation: Annotation | null;
};
export type CompressionFile = { chance: number; results: CompressionRow[]; headline: CompressionRow[]; source: string };

export type Warning = { id: string; level: "info" | "warn"; text: string };
export type MetadataFile = {
  generated: string; phase: string; warnings: Warning[]; tiers: Record<string, string>;
  strata: { chem11: string[]; chem10: string[]; exposure_h: Record<string, number>; definition: string };
  drugs: Record<string, { pathway: string; vehicle: string }>;
};

export const PATHWAY_COLOR: Record<string, string> = {
  Notch: "#25746b", TGFb: "#7a4fb6", BMP: "#5f762a", FGF: "#a54061", Wnt: "#3565a8", Shh: "#b56322", RA: "#846030",
};
export const TIER_SHORT = (t: string) =>
  t.startsWith("TIER 1") ? "T1" : t.startsWith("TIER 2") ? "T2" : t.startsWith("TIER 3") ? "T3" : "FAIL";
export const TIER_CLASS = (t: string) =>
  t.startsWith("TIER 1") ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
  : t.startsWith("TIER 2") ? "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
  : t.startsWith("TIER 3") ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
  : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200";
export const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d));
export const fmtP = (p: number) => (p < 1e-3 ? p.toExponential(1) : p.toFixed(3));
