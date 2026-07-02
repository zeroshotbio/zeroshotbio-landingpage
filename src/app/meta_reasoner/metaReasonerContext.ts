// metaReasonerContext.ts — the INTENDED Phase-2 meta-reasoner system context,
// surfaced read-only at each compartment boundary of the /meta_reasoner replay so
// the curator can judge the rules + experiential knowledge the brain WOULD reason
// with, BEFORE it is built. Phase 2 (the descend/consolidate brain) is not yet
// implemented, so nothing was captured at run time — this is a first draft to
// critique, not a recording. Edit freely; the replay reads it verbatim.
//
// Sourced from: harness_registry.json v2.0 `design[]` (top-down descent MVP),
// the GT-discipline the labeller must carry, and general-biology experiential
// priors for a 48 hpf whole-embryo atlas.

export type ContextRule = { title: string; body: string };

export const META_REASONER_CONTEXT: {
  version: string;
  status: string;
  intro: string;
  rules: ContextRule[];
  gtDiscipline: ContextRule[];
  experientialPriors: string[];
} = {
  version: "phase2-draft-v0",
  status:
    "DRAFT — the Meta-Reasoner brain is NOT built yet. This is the intended context to judge, not a captured prompt.",
  intro:
    "The Meta-Reasoner sits ABOVE the per-cluster chat loop. It runs at each compartment boundary of a top-down, coarse-then-fine descent: name each compartment's umbrella first, then descend into a compartment's leaf clusters ONLY where an expected tissue is still missing or the compartment is genuinely heterogeneous. Most compartments resolve at the umbrella and are never descended into — that is where the cost savings live.",
  rules: [
    {
      title: "Umbrella-first",
      body: "At a compartment boundary, first form the compartment's umbrella identity from the leaves already seen (and their evidence). State what tissue/lineage family the compartment represents at the coarsest defensible tier.",
    },
    {
      title: "Descend only on cause",
      body: "Descend into remaining leaves ONLY when (a) an expected tissue for this stage/region is still unaccounted for, or (b) the compartment's leaves disagree enough that a single umbrella call would lose real signal. A homogeneous compartment (e.g. 16 near-duplicate periderm leaves) resolves at the umbrella — do not spend a full labelling run per near-duplicate leaf.",
    },
    {
      title: "Consolidate near-duplicates",
      body: "When leaves within a compartment are restatements of one identity, consolidate them under the umbrella with a count, rather than emitting N separate near-identical labels. Record the consolidation as a decision, with the evidence that justified it.",
    },
    {
      title: "Escape hatch (R4b-style)",
      body: "A strong, SPECIFIC lineage anchor in a leaf (a genuine positive marker, not a promiscuous/shared gene) that contradicts the parent compartment lets the Reasoner re-home that leaf outside the parent. A promiscuous gene is not enough.",
    },
    {
      title: "Abstain / roll-up preserved",
      body: "The per-cluster evidentiary bar is unchanged: an ASSIGN needs a present, specific positive anchor from THIS unit's own markers. When grounding is insufficient or contradictory, roll up to the deepest defensible tier (germ layer or tissue) and state 'none' at finer tiers — never invent a subtype to fill the umbrella.",
    },
    {
      title: "Budget is a decision, not a quota",
      body: "The point of descending selectively is to spend calls where they change the answer. Do not descend to raise a confidence number; do not skip a descent that would surface a missing expected tissue just to save cost.",
    },
  ],
  gtDiscipline: [
    {
      title: "Topology is allowed input",
      body: "WHICH leaves group into a compartment (the clustering topology) is a legitimate signal the Meta-Reasoner may use to reason about umbrellas and heterogeneity.",
    },
    {
      title: "The compartment's name is NOT",
      body: "Any sealed ground-truth / control-vote NAME for a compartment or leaf is never shown to the reasoning brain. The umbrella identity must be derived from evidence, exactly like a leaf identity — the brain stays GT-blind.",
    },
    {
      title: "Priors are general biology only",
      body: "Experiential priors are general developmental biology ('a 48 hpf embryo has blood, pancreas, liver…'), never this run's answers. A prior may motivate looking for a missing tissue; it may never stand in as evidence for a call.",
    },
    {
      title: "Expectation-bias guard",
      body: "Expecting a tissue must not lower the evidentiary bar for calling it. The unchanged per-cluster bar + an offline control-vote audit are the mitigations; a prior can direct attention but cannot supply grounding.",
    },
  ],
  experientialPriors: [
    "This is a ~48 hpf (Saunders et al.) whole zebrafish embryo — expect the major germ layers and their derivatives all present at once.",
    "Ectoderm: epidermis / periderm / EVL surface keratinocytes, neural (CNS, retina, otic/placodal sensory), neural crest derivatives.",
    "Mesoderm: fast & slow skeletal muscle, notochord, dermomyotome, blood/erythroid, endothelium/vasculature, pronephros, cartilage/skeletal.",
    "Endoderm: pharynx, gut/enterocyte, liver/hepatocyte, pancreas, thyroid follicle.",
    "Surface/periderm and muscle are high-abundance and tend to spawn many near-duplicate leaves — prime candidates for umbrella consolidation.",
    "Rarer endoderm derivatives (thyroid, hepatocyte, pancreas) are the tissues most likely to be 'missing' and most worth a targeted descent.",
  ],
};
