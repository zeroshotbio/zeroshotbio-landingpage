// ── v2.0 harness config (hand-authored MVP, from the experiential bank) ──────────
// Expected tissues known findable in ZSCAPE 48 hpf. `hides:true` = rare/entangled,
// typically lumped inside a larger umbrella at coarse res rather than forming its own.
export const EXPECTED_TISSUES = [
  { tissue: "epidermis",   syn: ["epiderm","periderm","epithel","skin","keratinocyte","enveloping"] },
  { tissue: "muscle",      syn: ["skeletal muscle","striated muscle","musculature","myotome","myocyte","somit","myogenic","fast-twitch","slow-twitch","sarcomere","myofib"] },
  { tissue: "CNS",         syn: ["central nervous","nervous","cns","neural","neuron","brain","spinal","neuroepithel"] },
  { tissue: "eye",         syn: ["eye","retina","lens","photoreceptor","rpe"] },
  { tissue: "notochord",   syn: ["notochord","chordamesoderm"] },
  { tissue: "endothelial", syn: ["endotheli","vascul","blood vessel","angioblast"] },
  { tissue: "heart",       syn: ["heart","cardiac","myocard"] },
  { tissue: "pharyngeal arch", syn: ["pharyng","arch","cartilage","chondro"] },
  // rare/entangled — the targets of selective recursion:
  { tissue: "liver",     hides: true, syn: ["liver","hepato","hepatocyte"] },
  { tissue: "pancreas",  hides: true, syn: ["pancrea","islet","endocrine pancreas","acinar"] },
  { tissue: "intestine", hides: true, syn: ["intestin","gut","enterocyte","enteroendocrine"] },
  { tissue: "blood",     hides: true, syn: ["blood","erythro","hematopoiet","myeloid","leukocyte","hemoglobin"] },
  { tissue: "kidney",    hides: true, syn: ["kidney","pronephr","nephron","renal"] },
];

// Experiential-knowledge bank — promoted from run-logs into standing HINTS (not rules).
export const EXPERIENTIAL_BANK = {
  endoderm_entanglement: "At 48 hpf the endodermal organs (liver, pancreas, intestine) are transcriptionally close and are frequently NOT separated at coarse resolution — they get absorbed into a larger neighbouring compartment. Watch for them hiding inside big epithelial/neural compartments; separating them usually needs this targeted recursion.",
  adult_markers_off: "Many canonical ADULT tissue markers are not yet expressed at 48 hpf, so the ABSENCE of an adult marker is NOT evidence against a tissue. Do not rule a tissue out on absence at this stage.",
  robo4_r4b: "Some markers (e.g. robo4) are promiscuous across lineages — treat low-specificity markers cautiously; require a PRESENT, specific positive anchor before assigning (R4-style positive-anchor floor).",
  muscle_continuum: "Muscle/myogenic leaves form a continuum where the finest subtype is often unresolvable — prefer rolling up / abstaining at the defensible tier over force-fitting a terminal subtype.",
};

// Routing rules — GT-BLIND: each rule's predicate is evaluated against the labeller's
// OWN coarse umbrella CALLS (not ground truth). When an expected tissue is unfound, recurse
// into the compartment(s) whose coarse call matches `intoUmbrella` (fallback: largest unrecursed).
export const ROUTING_RULES = {
  liver:     { intoUmbrella: ["epidermis","epithel","endoderm"], hints: ["endoderm_entanglement","adult_markers_off"], lookFor: "liver — fabp10a, apoa1/apoa2, tfa, serpina, transthyretin (ttr)" },
  intestine: { intoUmbrella: ["epidermis","epithel","endoderm"], hints: ["endoderm_entanglement","adult_markers_off"], lookFor: "intestine — fabp2, vil1, cdx1b, anxa4, agr2" },
  blood:     { intoUmbrella: ["epidermis","epithel"],            hints: ["adult_markers_off","robo4_r4b"],            lookFor: "blood/erythroid — hbae/hbbe, alas2, gata1a, slc4a1a" },
  pancreas:  { intoUmbrella: ["CNS","neural","nervous","endoderm"],        hints: ["endoderm_entanglement","adult_markers_off"], lookFor: "pancreas — ins, gcga, sst2, prss1, nkx6.1" },
  kidney:    { intoUmbrella: ["CNS","neural","nervous","mesoderm"],        hints: ["adult_markers_off"],                          lookFor: "pronephros/kidney — slc20a1a, cdh17, pax2a, atp1a1a.4" },
};

// The handful of coarse compartments to run for the MVP trace, and recursion caps.
export const RUN_PLAN = {
  coarseCompartments: ["comp:1", "comp:3", "comp:5", "comp:12"], // epidermis(endoderm/blood-bearing), muscle, CNS, heart
  recurseLeafCap: 10,          // label the N largest sub-leaves of the recursed compartment
  maxRecurseCompartments: 1,   // MVP: execute the primary chosen compartment; others recorded in routing
  reasonerRounds: 2,
};
