// Sample atlas for the daniotype_kasperov human-in-the-loop labelling wizard.
//
// SKELETON / POC DATA. The shapes here mirror daniotype's real descent output
// (the `(identity, state)` label model, the tier ladder, `DescentDecision` +
// `ProposerVote`, and cite-discipline: cited markers ⊆ the node's differential
// genes, every ZFA/GO id looked up via the grounding tools that run). The
// *values* are illustrative zebrafish biology hand-authored for the POC — they
// are replaced wholesale once we point this page at a real
// `runs/<run>/hierarchy.json` + `decision_log.jsonl`.
//
// Tier ladder (coarse → fine), from src/daniotype/descent/tiers.py:
//   germ_layer → organ_system → organ → tissue → sub_tissue → cell_type → cell_type_state
// State (the transient program) is only legal at the cell_type_state tier.

export type Tier =
  | "germ_layer"
  | "organ_system"
  | "organ"
  | "tissue"
  | "sub_tissue"
  | "cell_type"
  | "cell_type_state";

export const TIER_LADDER: Tier[] = [
  "germ_layer",
  "organ_system",
  "organ",
  "tissue",
  "sub_tissue",
  "cell_type",
  "cell_type_state",
];

export type CellState =
  | "progenitor"
  | "cycling"
  | "quiescent"
  | "mature"
  | "stress"
  | null;

export type Decision = "assign" | "abstain";

// One cited differential gene. `direction` = up/down vs sibling baseline;
// cite-discipline requires every cited marker to be one of the node's
// differential genes (this is the candidate set the wizard renders).
export interface MarkerCite {
  gene: string;
  direction: "up" | "down";
  log2fc: number;
  pct_in: number; // fraction of in-cluster cells expressing
  pct_out: number; // fraction of out-of-cluster cells expressing
}

// One ZFIN curated wildtype-expression row — the primary marker → in-vivo
// anatomy → cell-type move (the `expression_lookup` tool return).
export interface ExpressionHit {
  gene: string;
  zfa_term: string;
  zfa_id: string;
  stage: string;
}

// One GO annotation (the `go_lookup` tool return), corroborating function.
export interface GoHit {
  gene: string;
  go_id: string;
  go_term: string;
  aspect: "BP" | "MF" | "CC";
}

// One proposer's independent vote (daniotype ProposerVote).
export interface ProposerVote {
  member: string;
  tier: Tier;
  name: string;
  state: CellState;
  decision: Decision;
  confidence: number;
  rationale: string;
}

// The orchestrator's adjudicated verdict for a node (daniotype DescentDecision).
export interface DescentDecision {
  tier: Tier;
  name: string;
  state: CellState;
  decision: Decision;
  confidence: number;
  rationale: string;
  cited_markers: string[];
  cited_absent_markers: string[];
  cited_ids: string[];
  k_vote_agreement: number;
  lineage_broken: boolean;
}

export interface AtlasNode {
  id: string;
  parent: string | null;
  depth: number;
  n_cells: number;
  // The AI's served evidence + proposal for this node.
  decision: DescentDecision;
  votes: ProposerVote[];
  markers: MarkerCite[];
  expression: ExpressionHit[];
  go: GoHit[];
  // One-line contrast vs siblings — the discriminating evidence a judge cares about.
  sibling_contrast: string;
}

// --- Sample whole-embryo atlas, in DFS pre-order (the wizard walks it top-down,
// so a parent is always judged before its children — clusters, then clusters
// within clusters). ~16 nodes spanning all three germ layers. ---

export const ATLAS: AtlasNode[] = [
  // ============ ECTODERM ============
  {
    id: "ecto",
    parent: null,
    depth: 0,
    n_cells: 18420,
    sibling_contrast:
      "Neural + epidermal programs vs the mesodermal (sox17−, gata1−) and endodermal compartments.",
    decision: {
      tier: "germ_layer",
      name: "ectoderm",
      state: null,
      decision: "assign",
      confidence: 0.93,
      rationale:
        "Broad pan-ectodermal program: sox2/sox3 neural plate markers plus epidermal krt genes, no mesendoderm signature. Coarse but well-grounded at the germ-layer tier.",
      cited_markers: ["sox2", "sox3", "krt4", "tfap2a"],
      cited_absent_markers: ["sox17", "gata1a"],
      cited_ids: ["ZFA:0000118", "ZFA:0001114"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "germ_layer",
        name: "ectoderm",
        state: null,
        decision: "assign",
        confidence: 0.94,
        rationale: "sox2/sox3/tfap2a; no sox17 endoderm signal.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "germ_layer",
        name: "ectoderm",
        state: null,
        decision: "assign",
        confidence: 0.91,
        rationale: "Keratin + neural-plate co-expression is diagnostic of ectoderm.",
      },
    ],
    markers: [
      { gene: "sox2", direction: "up", log2fc: 2.1, pct_in: 0.78, pct_out: 0.22 },
      { gene: "sox3", direction: "up", log2fc: 1.9, pct_in: 0.71, pct_out: 0.19 },
      { gene: "tfap2a", direction: "up", log2fc: 1.6, pct_in: 0.55, pct_out: 0.18 },
      { gene: "krt4", direction: "up", log2fc: 1.4, pct_in: 0.48, pct_out: 0.2 },
      { gene: "sox17", direction: "down", log2fc: -2.4, pct_in: 0.02, pct_out: 0.31 },
    ],
    expression: [
      { gene: "sox2", zfa_term: "neural plate", zfa_id: "ZFA:0000110", stage: "segmentation" },
      { gene: "tfap2a", zfa_term: "non-neural ectoderm", zfa_id: "ZFA:0001114", stage: "gastrula" },
    ],
    go: [
      { gene: "sox2", go_id: "GO:0021895", go_term: "cerebral cortex neuron differentiation", aspect: "BP" },
      { gene: "krt4", go_id: "GO:0045095", go_term: "keratin filament", aspect: "CC" },
    ],
  },
  {
    id: "ecto.nervous",
    parent: "ecto",
    depth: 1,
    n_cells: 11200,
    sibling_contrast: "Neural (sox2+, elavl3+) vs the epidermal sibling (krt4/krt5-high, sox2−).",
    decision: {
      tier: "organ_system",
      name: "nervous system",
      state: null,
      decision: "assign",
      confidence: 0.9,
      rationale:
        "Pan-neural sox2/elavl3 with neurod1; clearly the neural branch of ectoderm. Sits at organ_system — finer subdivision happens in the children.",
      cited_markers: ["sox2", "elavl3", "neurod1"],
      cited_absent_markers: ["krt5"],
      cited_ids: ["ZFA:0000396"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "organ_system",
        name: "nervous system",
        state: null,
        decision: "assign",
        confidence: 0.9,
        rationale: "elavl3 pan-neuronal + sox2 neural progenitor mix.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "organ_system",
        name: "central nervous system",
        state: null,
        decision: "assign",
        confidence: 0.86,
        rationale: "Leans CNS specifically, but no clear PNS exclusion yet — orchestrator rolled up to nervous system.",
      },
    ],
    markers: [
      { gene: "elavl3", direction: "up", log2fc: 2.6, pct_in: 0.69, pct_out: 0.08 },
      { gene: "sox2", direction: "up", log2fc: 1.8, pct_in: 0.74, pct_out: 0.3 },
      { gene: "neurod1", direction: "up", log2fc: 1.7, pct_in: 0.41, pct_out: 0.06 },
      { gene: "krt5", direction: "down", log2fc: -2.1, pct_in: 0.03, pct_out: 0.4 },
    ],
    expression: [
      { gene: "elavl3", zfa_term: "central nervous system", zfa_id: "ZFA:0000396", stage: "pharyngula" },
      { gene: "neurod1", zfa_term: "neural rod", zfa_id: "ZFA:0000112", stage: "segmentation" },
    ],
    go: [{ gene: "elavl3", go_id: "GO:0030182", go_term: "neuron differentiation", aspect: "BP" }],
  },
  {
    id: "ecto.nervous.rg",
    parent: "ecto.nervous",
    depth: 2,
    n_cells: 3100,
    sibling_contrast:
      "Cycling radial glia (her4.1+, mki67+) vs the post-mitotic differentiating-neuron sibling (elavl3-high, mki67−).",
    decision: {
      tier: "cell_type_state",
      name: "radial glia",
      state: "cycling",
      decision: "assign",
      confidence: 0.82,
      rationale:
        "her4.1/fabp7a/gfap radial-glia identity with strong mki67/pcna cycling signature → (radial glia, cycling). ZFIN places fabp7a in the ventricular zone.",
      cited_markers: ["her4.1", "fabp7a", "gfap", "mki67"],
      cited_absent_markers: ["elavl3"],
      cited_ids: ["ZFA:0009285", "GO:0007049"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type_state",
        name: "radial glia",
        state: "cycling",
        decision: "assign",
        confidence: 0.84,
        rationale: "her4.1 + gfap glial identity, mki67 high → cycling.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type_state",
        name: "neural progenitor",
        state: "cycling",
        decision: "assign",
        confidence: 0.74,
        rationale: "Calls it a generic neural progenitor; orchestrator preferred the more specific radial-glia name on fabp7a/gfap.",
      },
    ],
    markers: [
      { gene: "her4.1", direction: "up", log2fc: 2.9, pct_in: 0.62, pct_out: 0.05 },
      { gene: "fabp7a", direction: "up", log2fc: 2.4, pct_in: 0.58, pct_out: 0.07 },
      { gene: "gfap", direction: "up", log2fc: 2.2, pct_in: 0.51, pct_out: 0.04 },
      { gene: "mki67", direction: "up", log2fc: 1.9, pct_in: 0.46, pct_out: 0.12 },
      { gene: "elavl3", direction: "down", log2fc: -1.8, pct_in: 0.07, pct_out: 0.55 },
    ],
    expression: [
      { gene: "fabp7a", zfa_term: "ventricular zone", zfa_id: "ZFA:0009285", stage: "larval" },
      { gene: "gfap", zfa_term: "radial glial cell", zfa_id: "ZFA:0009286", stage: "larval" },
    ],
    go: [
      { gene: "mki67", go_id: "GO:0007049", go_term: "cell cycle", aspect: "BP" },
      { gene: "gfap", go_id: "GO:0045104", go_term: "intermediate filament cytoskeleton organization", aspect: "BP" },
    ],
  },
  {
    id: "ecto.nervous.neuron",
    parent: "ecto.nervous",
    depth: 2,
    n_cells: 4800,
    sibling_contrast:
      "Post-mitotic neurons (elavl3/tubb5+, mki67−) vs the cycling radial-glia sibling.",
    decision: {
      tier: "cell_type",
      name: "differentiating neuron",
      state: null,
      decision: "assign",
      confidence: 0.7,
      rationale:
        "Strong pan-neuronal elavl3/tubb5/snap25 but no subtype-resolving transmitter or regional marker reached threshold — held at cell_type, no state assigned. Candidate for drill-down on a higher-resolution sub-clustering.",
      cited_markers: ["elavl3", "tubb5", "snap25a"],
      cited_absent_markers: ["mki67", "gad1b", "slc17a6a"],
      cited_ids: ["ZFA:0009248"],
      k_vote_agreement: 0.5,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "differentiating neuron",
        state: null,
        decision: "assign",
        confidence: 0.72,
        rationale: "Pan-neuronal, no transmitter identity resolved.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type_state",
        name: "glutamatergic neuron",
        state: "mature",
        decision: "assign",
        confidence: 0.55,
        rationale: "Guesses glutamatergic, but slc17a6a did NOT clear the differential threshold — this is the kind of over-reach a human judge should catch.",
      },
    ],
    markers: [
      { gene: "elavl3", direction: "up", log2fc: 2.7, pct_in: 0.81, pct_out: 0.09 },
      { gene: "tubb5", direction: "up", log2fc: 2.0, pct_in: 0.7, pct_out: 0.2 },
      { gene: "snap25a", direction: "up", log2fc: 1.6, pct_in: 0.44, pct_out: 0.1 },
      { gene: "mki67", direction: "down", log2fc: -1.7, pct_in: 0.05, pct_out: 0.46 },
    ],
    expression: [
      { gene: "elavl3", zfa_term: "neuron", zfa_id: "ZFA:0009248", stage: "pharyngula" },
      { gene: "snap25a", zfa_term: "presynaptic membrane", zfa_id: "ZFA:0001029", stage: "larval" },
    ],
    go: [{ gene: "snap25a", go_id: "GO:0007269", go_term: "neurotransmitter secretion", aspect: "BP" }],
  },
  {
    id: "ecto.nervous.retina",
    parent: "ecto.nervous",
    depth: 2,
    n_cells: 2300,
    sibling_contrast: "Photoreceptors (rho/gnat2/crx+) — eye-specific vs the brain-derived siblings.",
    decision: {
      tier: "cell_type",
      name: "photoreceptor cell",
      state: null,
      decision: "assign",
      confidence: 0.88,
      rationale:
        "Phototransduction cassette: rho (rod opsin), gnat2/opn1sw1 (cone), crx master regulator. ZFIN localizes rho to the photoreceptor layer of the retina.",
      cited_markers: ["rho", "gnat2", "crx", "opn1sw1"],
      cited_absent_markers: [],
      cited_ids: ["ZFA:0009274", "GO:0007601"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "photoreceptor cell",
        state: null,
        decision: "assign",
        confidence: 0.89,
        rationale: "Opsin + crx; unambiguous photoreceptor.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type",
        name: "photoreceptor cell",
        state: null,
        decision: "assign",
        confidence: 0.87,
        rationale: "Agrees; could split rod vs cone on a finer clustering.",
      },
    ],
    markers: [
      { gene: "rho", direction: "up", log2fc: 3.4, pct_in: 0.66, pct_out: 0.01 },
      { gene: "gnat2", direction: "up", log2fc: 2.8, pct_in: 0.52, pct_out: 0.02 },
      { gene: "crx", direction: "up", log2fc: 2.3, pct_in: 0.48, pct_out: 0.03 },
      { gene: "opn1sw1", direction: "up", log2fc: 2.1, pct_in: 0.33, pct_out: 0.01 },
    ],
    expression: [
      { gene: "rho", zfa_term: "photoreceptor layer", zfa_id: "ZFA:0009274", stage: "larval" },
      { gene: "crx", zfa_term: "retina", zfa_id: "ZFA:0000047", stage: "pharyngula" },
    ],
    go: [{ gene: "rho", go_id: "GO:0007601", go_term: "visual perception", aspect: "BP" }],
  },
  {
    id: "ecto.epidermis",
    parent: "ecto",
    depth: 1,
    n_cells: 4100,
    sibling_contrast: "Epidermal keratinocytes (krt4/krt5/cldnb+) vs the neural sibling (sox2/elavl3+).",
    decision: {
      tier: "cell_type",
      name: "keratinocyte",
      state: null,
      decision: "assign",
      confidence: 0.85,
      rationale:
        "krt4/krt5 keratin program with cldnb tight-junction marker — periderm/epidermal keratinocyte. ZFIN places krt4 in the epidermis.",
      cited_markers: ["krt4", "krt5", "cldnb"],
      cited_absent_markers: ["sox2"],
      cited_ids: ["ZFA:0000368", "GO:0045095"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "keratinocyte",
        state: null,
        decision: "assign",
        confidence: 0.86,
        rationale: "krt4/krt5 + cldnb; classic periderm.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type",
        name: "epidermal cell",
        state: null,
        decision: "assign",
        confidence: 0.83,
        rationale: "Slightly coarser 'epidermal cell'; orchestrator took the keratinocyte name.",
      },
    ],
    markers: [
      { gene: "krt4", direction: "up", log2fc: 3.1, pct_in: 0.72, pct_out: 0.08 },
      { gene: "krt5", direction: "up", log2fc: 2.7, pct_in: 0.64, pct_out: 0.05 },
      { gene: "cldnb", direction: "up", log2fc: 2.0, pct_in: 0.55, pct_out: 0.1 },
      { gene: "sox2", direction: "down", log2fc: -2.2, pct_in: 0.04, pct_out: 0.7 },
    ],
    expression: [
      { gene: "krt4", zfa_term: "epidermis", zfa_id: "ZFA:0000368", stage: "pharyngula" },
      { gene: "cldnb", zfa_term: "periderm", zfa_id: "ZFA:0001308", stage: "segmentation" },
    ],
    go: [{ gene: "krt5", go_id: "GO:0045095", go_term: "keratin filament", aspect: "CC" }],
  },

  // ============ MESODERM ============
  {
    id: "meso",
    parent: null,
    depth: 0,
    n_cells: 15600,
    sibling_contrast: "Mesodermal (tbxta/hand2/gata1+) vs neural ectoderm and sox17+ endoderm.",
    decision: {
      tier: "germ_layer",
      name: "mesoderm",
      state: null,
      decision: "assign",
      confidence: 0.91,
      rationale:
        "Mesodermal program — hand2, tbx, hematopoietic and muscle precursors. No neural or endodermal signature.",
      cited_markers: ["tbxta", "hand2", "tagln2"],
      cited_absent_markers: ["sox2", "sox17"],
      cited_ids: ["ZFA:0000119"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "germ_layer",
        name: "mesoderm",
        state: null,
        decision: "assign",
        confidence: 0.92,
        rationale: "Broad mesoderm; children split hematopoietic vs muscle.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "germ_layer",
        name: "mesoderm",
        state: null,
        decision: "assign",
        confidence: 0.9,
        rationale: "Agrees.",
      },
    ],
    markers: [
      { gene: "tbxta", direction: "up", log2fc: 1.9, pct_in: 0.4, pct_out: 0.08 },
      { gene: "hand2", direction: "up", log2fc: 1.7, pct_in: 0.38, pct_out: 0.06 },
      { gene: "tagln2", direction: "up", log2fc: 1.5, pct_in: 0.44, pct_out: 0.15 },
      { gene: "sox2", direction: "down", log2fc: -2.0, pct_in: 0.05, pct_out: 0.6 },
    ],
    expression: [{ gene: "hand2", zfa_term: "lateral plate mesoderm", zfa_id: "ZFA:0000122", stage: "segmentation" }],
    go: [{ gene: "tbxta", go_id: "GO:0001707", go_term: "mesoderm formation", aspect: "BP" }],
  },
  {
    id: "meso.blood",
    parent: "meso",
    depth: 1,
    n_cells: 6900,
    sibling_contrast: "Hematopoietic (gata1a/spi1b/lcp1+) vs the muscle sibling (myhz1.1/actc1b+).",
    decision: {
      tier: "organ_system",
      name: "hematopoietic system",
      state: null,
      decision: "assign",
      confidence: 0.89,
      rationale:
        "gata1a erythroid + spi1b myeloid master regulators co-present → the blood compartment; children resolve erythroid vs macrophage.",
      cited_markers: ["gata1a", "spi1b", "lcp1"],
      cited_absent_markers: ["myhz1.1"],
      cited_ids: ["ZFA:0005052"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "organ_system",
        name: "hematopoietic system",
        state: null,
        decision: "assign",
        confidence: 0.9,
        rationale: "gata1 + spi1b; blood.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "organ_system",
        name: "hematopoietic system",
        state: null,
        decision: "assign",
        confidence: 0.88,
        rationale: "Agrees.",
      },
    ],
    markers: [
      { gene: "gata1a", direction: "up", log2fc: 2.5, pct_in: 0.5, pct_out: 0.04 },
      { gene: "spi1b", direction: "up", log2fc: 2.2, pct_in: 0.41, pct_out: 0.03 },
      { gene: "lcp1", direction: "up", log2fc: 1.8, pct_in: 0.47, pct_out: 0.09 },
      { gene: "myhz1.1", direction: "down", log2fc: -2.6, pct_in: 0.02, pct_out: 0.4 },
    ],
    expression: [
      { gene: "gata1a", zfa_term: "intermediate cell mass", zfa_id: "ZFA:0001399", stage: "segmentation" },
      { gene: "spi1b", zfa_term: "rostral blood island", zfa_id: "ZFA:0001400", stage: "segmentation" },
    ],
    go: [{ gene: "gata1a", go_id: "GO:0030218", go_term: "erythrocyte differentiation", aspect: "BP" }],
  },
  {
    id: "meso.blood.ery",
    parent: "meso.blood",
    depth: 2,
    n_cells: 3400,
    sibling_contrast: "Erythroid (hbbe1.1/alas2/gata1a+) vs the macrophage sibling (mpeg1.1/mfap4+).",
    decision: {
      tier: "cell_type_state",
      name: "erythroid progenitor",
      state: "cycling",
      decision: "assign",
      confidence: 0.8,
      rationale:
        "Globin (hbbe1.1) + heme-synthesis (alas2) erythroid identity with mki67/pcna proliferation → (erythroid progenitor, cycling). Embryonic globin, not adult — consistent with a progenitor.",
      cited_markers: ["hbbe1.1", "alas2", "gata1a", "pcna"],
      cited_absent_markers: ["mpeg1.1"],
      cited_ids: ["ZFA:0009124", "GO:0030218"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type_state",
        name: "erythroid progenitor",
        state: "cycling",
        decision: "assign",
        confidence: 0.82,
        rationale: "Embryonic globin + pcna → cycling erythroid progenitor.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type_state",
        name: "erythrocyte",
        state: "mature",
        decision: "assign",
        confidence: 0.6,
        rationale: "Calls it mature erythrocyte, but pcna+ argues against 'mature' — a judgement call for the human.",
      },
    ],
    markers: [
      { gene: "hbbe1.1", direction: "up", log2fc: 3.6, pct_in: 0.74, pct_out: 0.01 },
      { gene: "alas2", direction: "up", log2fc: 2.9, pct_in: 0.6, pct_out: 0.02 },
      { gene: "gata1a", direction: "up", log2fc: 2.4, pct_in: 0.55, pct_out: 0.05 },
      { gene: "pcna", direction: "up", log2fc: 1.5, pct_in: 0.42, pct_out: 0.18 },
      { gene: "mpeg1.1", direction: "down", log2fc: -2.7, pct_in: 0.01, pct_out: 0.35 },
    ],
    expression: [
      { gene: "hbbe1.1", zfa_term: "erythrocyte", zfa_id: "ZFA:0009124", stage: "segmentation" },
      { gene: "alas2", zfa_term: "blood", zfa_id: "ZFA:0000007", stage: "pharyngula" },
    ],
    go: [{ gene: "alas2", go_id: "GO:0006783", go_term: "heme biosynthetic process", aspect: "BP" }],
  },
  {
    id: "meso.blood.macro",
    parent: "meso.blood",
    depth: 2,
    n_cells: 1800,
    sibling_contrast: "Macrophage (mpeg1.1/mfap4/csf1ra+) vs the erythroid sibling (hbbe1.1/alas2+).",
    decision: {
      tier: "cell_type",
      name: "macrophage",
      state: null,
      decision: "assign",
      confidence: 0.83,
      rationale:
        "mpeg1.1/mfap4 macrophage identity with csf1ra; no neutrophil mpx. ZFIN places mpeg1.1 in macrophages. No clear activation state marker → state left null.",
      cited_markers: ["mpeg1.1", "mfap4", "csf1ra"],
      cited_absent_markers: ["mpx", "hbbe1.1"],
      cited_ids: ["ZFA:0009223", "GO:0006909"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "macrophage",
        state: null,
        decision: "assign",
        confidence: 0.84,
        rationale: "mpeg1.1 + mfap4; macrophage, not neutrophil (mpx−).",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type",
        name: "macrophage",
        state: null,
        decision: "assign",
        confidence: 0.81,
        rationale: "Agrees.",
      },
    ],
    markers: [
      { gene: "mpeg1.1", direction: "up", log2fc: 3.2, pct_in: 0.68, pct_out: 0.02 },
      { gene: "mfap4", direction: "up", log2fc: 2.6, pct_in: 0.59, pct_out: 0.03 },
      { gene: "csf1ra", direction: "up", log2fc: 2.0, pct_in: 0.4, pct_out: 0.04 },
      { gene: "mpx", direction: "down", log2fc: -2.3, pct_in: 0.03, pct_out: 0.22 },
    ],
    expression: [
      { gene: "mpeg1.1", zfa_term: "macrophage", zfa_id: "ZFA:0009223", stage: "larval" },
      { gene: "mfap4", zfa_term: "mononuclear phagocyte", zfa_id: "ZFA:0009224", stage: "larval" },
    ],
    go: [{ gene: "mpeg1.1", go_id: "GO:0006909", go_term: "phagocytosis", aspect: "BP" }],
  },
  {
    id: "meso.muscle",
    parent: "meso",
    depth: 1,
    n_cells: 5200,
    sibling_contrast: "Skeletal muscle (myhz1.1/mylpfa/actc1b+) vs the blood sibling (gata1a/spi1b+).",
    decision: {
      tier: "cell_type",
      name: "fast muscle cell",
      state: null,
      decision: "assign",
      confidence: 0.87,
      rationale:
        "Fast-twitch sarcomere program — myhz1.1, mylpfa, actc1b, tnnt3a. ZFIN places myhz1.1 in fast muscle of the myotome; smyhc1 (slow) is absent → fast, not slow.",
      cited_markers: ["myhz1.1", "mylpfa", "actc1b", "tnnt3a"],
      cited_absent_markers: ["smyhc1"],
      cited_ids: ["ZFA:0001056", "GO:0006936"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "fast muscle cell",
        state: null,
        decision: "assign",
        confidence: 0.88,
        rationale: "Fast myosin myhz1.1, smyhc1−.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "tissue",
        name: "skeletal muscle",
        state: null,
        decision: "assign",
        confidence: 0.8,
        rationale: "Coarser 'skeletal muscle'; orchestrator went finer on the fast-fiber markers.",
      },
    ],
    markers: [
      { gene: "myhz1.1", direction: "up", log2fc: 3.5, pct_in: 0.71, pct_out: 0.02 },
      { gene: "mylpfa", direction: "up", log2fc: 3.0, pct_in: 0.66, pct_out: 0.03 },
      { gene: "actc1b", direction: "up", log2fc: 2.7, pct_in: 0.63, pct_out: 0.05 },
      { gene: "tnnt3a", direction: "up", log2fc: 2.3, pct_in: 0.5, pct_out: 0.04 },
      { gene: "smyhc1", direction: "down", log2fc: -2.1, pct_in: 0.04, pct_out: 0.16 },
    ],
    expression: [
      { gene: "myhz1.1", zfa_term: "fast muscle cell", zfa_id: "ZFA:0001056", stage: "pharyngula" },
      { gene: "actc1b", zfa_term: "myotome", zfa_id: "ZFA:0001056", stage: "segmentation" },
    ],
    go: [{ gene: "myhz1.1", go_id: "GO:0006936", go_term: "muscle contraction", aspect: "BP" }],
  },

  // ============ ENDODERM ============
  {
    id: "endo",
    parent: null,
    depth: 0,
    n_cells: 6300,
    sibling_contrast: "Endodermal (sox17/foxa2/foxa3+) vs neural ectoderm and gata1+ mesoderm.",
    decision: {
      tier: "germ_layer",
      name: "endoderm",
      state: null,
      decision: "assign",
      confidence: 0.9,
      rationale: "sox17/foxa2 definitive endoderm with foxa3 gut-tube marker. No neural or hematopoietic signal.",
      cited_markers: ["sox17", "foxa2", "foxa3"],
      cited_absent_markers: ["sox2", "gata1a"],
      cited_ids: ["ZFA:0000120"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "germ_layer",
        name: "endoderm",
        state: null,
        decision: "assign",
        confidence: 0.91,
        rationale: "sox17/foxa2; definitive endoderm.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "germ_layer",
        name: "endoderm",
        state: null,
        decision: "assign",
        confidence: 0.89,
        rationale: "Agrees.",
      },
    ],
    markers: [
      { gene: "sox17", direction: "up", log2fc: 2.8, pct_in: 0.52, pct_out: 0.02 },
      { gene: "foxa2", direction: "up", log2fc: 2.3, pct_in: 0.48, pct_out: 0.04 },
      { gene: "foxa3", direction: "up", log2fc: 1.9, pct_in: 0.4, pct_out: 0.05 },
    ],
    expression: [{ gene: "sox17", zfa_term: "endoderm", zfa_id: "ZFA:0000120", stage: "gastrula" }],
    go: [{ gene: "foxa2", go_id: "GO:0007492", go_term: "endoderm development", aspect: "BP" }],
  },
  {
    id: "endo.liver",
    parent: "endo",
    depth: 1,
    n_cells: 2600,
    sibling_contrast: "Hepatocytes (fabp10a/apoa1a/tfa+) — liver-specific within the gut endoderm.",
    decision: {
      tier: "cell_type",
      name: "hepatocyte",
      state: "mature",
      decision: "assign",
      confidence: 0.86,
      rationale:
        "Liver program — fabp10a, apoa1a, tfa, serum protein synthesis. ZFIN places fabp10a in the liver. High secretory-protein output → mature.",
      cited_markers: ["fabp10a", "apoa1a", "tfa", "cp"],
      cited_absent_markers: ["prox1a"],
      cited_ids: ["ZFA:0000123", "GO:0042157"],
      k_vote_agreement: 1.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type_state",
        name: "hepatocyte",
        state: "mature",
        decision: "assign",
        confidence: 0.87,
        rationale: "fabp10a + apoa1a; mature hepatocyte.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type",
        name: "hepatocyte",
        state: null,
        decision: "assign",
        confidence: 0.82,
        rationale: "Agrees on identity, less sure on the mature state call.",
      },
    ],
    markers: [
      { gene: "fabp10a", direction: "up", log2fc: 3.3, pct_in: 0.7, pct_out: 0.02 },
      { gene: "apoa1a", direction: "up", log2fc: 2.9, pct_in: 0.64, pct_out: 0.03 },
      { gene: "tfa", direction: "up", log2fc: 2.4, pct_in: 0.55, pct_out: 0.04 },
      { gene: "cp", direction: "up", log2fc: 2.0, pct_in: 0.46, pct_out: 0.05 },
    ],
    expression: [
      { gene: "fabp10a", zfa_term: "liver", zfa_id: "ZFA:0000123", stage: "larval" },
      { gene: "apoa1a", zfa_term: "hepatocyte", zfa_id: "ZFA:0009176", stage: "larval" },
    ],
    go: [{ gene: "apoa1a", go_id: "GO:0042157", go_term: "lipoprotein metabolic process", aspect: "BP" }],
  },
  {
    id: "endo.unknown",
    parent: "endo",
    depth: 1,
    n_cells: 720,
    sibling_contrast:
      "Mixed signal — partial hepatocyte + partial intestinal markers with no clean discriminator; the spine may have under-split this cluster.",
    decision: {
      tier: "tissue",
      name: "gut tube (unresolved)",
      state: null,
      decision: "abstain",
      confidence: 0.34,
      rationale:
        "ABSTAIN. Co-expresses fabp10a (liver) and fabp2 (intestine) at sub-threshold levels with no clean discriminator; the panel disagreed and the orchestrator rolled up rather than force a name. Flagged for the discovery queue — likely a doublet or an under-split cluster needing higher-resolution re-clustering.",
      cited_markers: ["fabp2", "fabp10a"],
      cited_absent_markers: [],
      cited_ids: ["ZFA:0000123"],
      k_vote_agreement: 0.0,
      lineage_broken: false,
    },
    votes: [
      {
        member: "proposer-A (gpt)",
        tier: "cell_type",
        name: "intestinal epithelial cell",
        state: null,
        decision: "assign",
        confidence: 0.45,
        rationale: "Leans intestinal on fabp2, but fabp10a contamination is high.",
      },
      {
        member: "proposer-B (gemini)",
        tier: "cell_type",
        name: "hepatocyte",
        state: null,
        decision: "assign",
        confidence: 0.4,
        rationale: "Leans liver on fabp10a — direct conflict with proposer-A. No agreement.",
      },
    ],
    markers: [
      { gene: "fabp2", direction: "up", log2fc: 1.3, pct_in: 0.31, pct_out: 0.12 },
      { gene: "fabp10a", direction: "up", log2fc: 1.2, pct_in: 0.34, pct_out: 0.14 },
      { gene: "cldn15la", direction: "up", log2fc: 0.9, pct_in: 0.28, pct_out: 0.15 },
    ],
    expression: [
      { gene: "fabp2", zfa_term: "intestine", zfa_id: "ZFA:0000095", stage: "larval" },
      { gene: "fabp10a", zfa_term: "liver", zfa_id: "ZFA:0000123", stage: "larval" },
    ],
    go: [{ gene: "fabp2", go_id: "GO:0006869", go_term: "lipid transport", aspect: "BP" }],
  },
];
