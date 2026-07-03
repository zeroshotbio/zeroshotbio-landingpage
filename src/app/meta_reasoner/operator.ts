// operator.ts — the REDESIGNED Meta-Reasoner operator: "fine-then-consolidate".
//
// The leaves are already labelled FINE (250 de-novo calls, frozen fixture). This
// operator's job is to CONSOLIDATE them into a smaller proposed final node set:
//   MERGE       — collapse redundant leaves within a compartment into one node
//                 (e.g. C2's ~16 periderm restatements → one node), justified by
//                 the predicted labels.
//   SET_ASIDE   — isolate a genuinely distinct leaf as its own node rather than
//                 letting it be swept into a merge (e.g. a neural/mitotic outlier).
//   FLAG_MISSING— (global scope) audit which expected tissues remain unaccounted
//                 across the whole labelled set.
//
// Contract is fixed + stateless: IN = current label set + ledger + general-biology
// priors; OUT = structured decisions. GT-BLIND (reuses assertGtBlind): the label
// set is the labeller's OWN predictions — never sealed ground truth. PROPOSE-ONLY:
// nothing here mutates the fixture; decisions are emit-and-log for judgement.
import { assertGtBlind } from "./brain";
import { META_REASONER_CONTEXT } from "./metaReasonerContext";
import { assertPartition } from "./partition";

export type OperatorTier = "germ_layer" | "tissue" | "cell_type_broad" | "cell_type_sub";
export type OperatorScope = "compartment" | "global";

export type MergeGroup = { node_label: string; tier: OperatorTier; member_leaf_ids: string[]; rationale: string };
export type SetAside = { leaf_id: string; node_label?: string; tier: OperatorTier; rationale: string };
export type FlagMissing = { expected_still_missing: string[]; rationale: string };
export type OperatorOutput = { merges: MergeGroup[]; set_aside: SetAside[]; flag_missing?: FlagMissing };

export type LabelSetEntry = { leaf_id: string; label: string };
export type OperatorInput = {
  role: "meta_reasoner_operator";
  scope: OperatorScope;
  compartment: number | null;
  labelSet: LabelSetEntry[];           // labeller's OWN predicted labels (GT-blind)
  ledger: { totalLeaves: number; totalCompartments: number; compartmentSizes: Record<string, number> };
  expectedTissues: string[];           // general-biology prior (attention only)
  rules: { title: string; body: string }[];
  gtDiscipline: { title: string; body: string }[];
};

// Assemble the GT-blind operator input. labelSet carries ONLY leaf ids + the
// labeller's predicted label strings; no sealed field can enter. assertGtBlind is
// the belt-and-braces final check (throws on any sealed key).
export function assembleOperatorInput(args: {
  scope: OperatorScope;
  compartment?: number | null;
  labelSet: LabelSetEntry[];
  ledger: OperatorInput["ledger"];
}): OperatorInput {
  const input: OperatorInput = {
    role: "meta_reasoner_operator",
    scope: args.scope,
    compartment: args.compartment ?? null,
    labelSet: args.labelSet,
    ledger: args.ledger,
    expectedTissues: META_REASONER_CONTEXT.expectedTissues,
    rules: META_REASONER_CONTEXT.rules,
    gtDiscipline: META_REASONER_CONTEXT.gtDiscipline,
  };
  assertGtBlind(input);
  return input;
}

const OUT_SCHEMA_COMPARTMENT =
  '{ "merges": [ { "node_label": "<one identity for the merged group>", "tier": "germ_layer|tissue|cell_type_broad|cell_type_sub", "member_leaf_ids": ["<leaf id>", ...], "rationale": "<why these restate one identity, citing the predicted labels>" } ], "set_aside": [ { "leaf_id": "<id>", "tier": "...", "rationale": "<why this leaf is genuinely distinct and must stay its own node>" } ] }';
const OUT_SCHEMA_GLOBAL =
  '{ "flag_missing": { "expected_still_missing": ["<expected tissue>", ...], "rationale": "<which general-biology tissues are unaccounted for across the whole labelled set>" } }';

export function buildOperatorPrompt(input: OperatorInput): { system: string; user: string } {
  const system = [
    "You are the META-REASONER OPERATOR in FINE-THEN-CONSOLIDATE mode, sitting ABOVE a per-cluster cell-type labeller for a zebrafish single-cell atlas.",
    "The leaves are ALREADY labelled (the fine pass is done). You do NOT re-label. You CONSOLIDATE the existing labels into a smaller, cleaner proposed node set.",
    "",
    "You are GT-BLIND. The labels you see are the LABELLER'S OWN de-novo predictions — treat them as what the labeller thinks, never as ground truth. Experiential priors are GENERAL developmental biology (what a 48 hpf embryo should contain); they may DIRECT attention to a missing tissue but may NEVER be used to assert a tissue is present.",
    "You PROPOSE ONLY. Nothing you emit mutates any stored label; a human judges and gates execution.",
    "",
    input.scope === "compartment"
      ? [
          "TASK (compartment scope): partition THIS compartment's leaves into consolidated nodes.",
          "- MERGE: group leaves whose predicted labels restate ONE identity (e.g. many 'periderm / EVL / superficial epidermal keratinocyte' variants) into a single node with one node_label and the tier that shared identity supports.",
          "- SET_ASIDE: a leaf whose predicted label is genuinely DISTINCT from the compartment's dominant identity (e.g. a lone neural or cycling-progenitor call among periderm) stays its own node — do NOT sweep it into a merge.",
          "- Every leaf id MUST appear exactly once, either in a merge group's member_leaf_ids or in set_aside. Justify each decision by the predicted labels themselves.",
          "- tier = the DEEPEST ontology layer (germ_layer < tissue < cell_type_broad < cell_type_sub) the node's shared identity confidently supports.",
          "",
          "Respond with a short prose read, THEN one fenced ```json block:",
          OUT_SCHEMA_COMPARTMENT,
        ].join("\n")
      : [
          "TASK (global scope): across the WHOLE labelled set (all compartments' predicted labels below), audit which EXPECTED tissues remain unaccounted for.",
          "- Compare the labeller's predicted identities against the general 48 hpf expected-tissue checklist. Name the expected tissues you do NOT see represented.",
          "- General biology only — do not name anything partition-specific or any sealed identity.",
          "",
          "Respond with a short prose read, THEN one fenced ```json block:",
          OUT_SCHEMA_GLOBAL,
        ].join("\n"),
  ].join("\n");

  const compartmentSizes = Object.entries(input.ledger.compartmentSizes).map(([k, v]) => `C${k}:${v}`).join(", ");
  const user = [
    `=== LEDGER === ${input.ledger.totalLeaves} leaves across ${input.ledger.totalCompartments} compartments (sizes: ${compartmentSizes}).`,
    input.scope === "compartment" ? `\n=== COMPARTMENT ${input.compartment} — predicted labels (leaf_id: label) ===` : "\n=== ALL PREDICTED LABELS (leaf_id: label) ===",
    ...input.labelSet.map((e) => `  ${e.leaf_id}: ${e.label}`),
    "",
    "=== EXPECTED TISSUES (general 48 hpf prior — attention only, never grounding) ===",
    input.expectedTissues.join(", "),
    "",
    input.scope === "compartment"
      ? "Partition every leaf above into merges + set_aside, then emit the JSON."
      : "List the expected tissues not represented in the labels above, then emit the JSON.",
  ].join("\n");

  return { system, user };
}

const TIERS: OperatorTier[] = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
function coerceTier(t: any): OperatorTier {
  return TIERS.includes(t) ? t : "cell_type_broad";
}

// parseOperatorOutput extracts the operator's fenced-JSON decisions from its prose
// response. When expectedLeafIds is supplied for a COMPARTMENT-scope response, the
// parsed merges + set_aside are asserted to be an exact partition of those ids —
// so a malformed block (which regex-parses to empty) throws PartitionError loudly
// rather than silently dropping every leaf from the proposed node set.
export function parseOperatorOutput(text: string, scope: OperatorScope, expectedLeafIds?: string[]): OperatorOutput {
  let jsonStr = "";
  const fenced = text.match(/```+\s*json\s*([\s\S]*?)```+/i) || text.match(/```+\s*([\s\S]*?)```+/);
  if (fenced) jsonStr = fenced[1];
  else {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a >= 0 && b > a) jsonStr = text.slice(a, b + 1);
  }
  let raw: any = {};
  try { raw = JSON.parse(jsonStr); } catch { raw = {}; }
  const merges: MergeGroup[] = Array.isArray(raw?.merges) ? raw.merges.map((m: any) => ({
    node_label: String(m?.node_label ?? "unresolved"),
    tier: coerceTier(m?.tier),
    member_leaf_ids: Array.isArray(m?.member_leaf_ids) ? m.member_leaf_ids.map(String) : [],
    rationale: String(m?.rationale ?? ""),
  })) : [];
  const set_aside: SetAside[] = Array.isArray(raw?.set_aside) ? raw.set_aside.map((s: any) => ({
    leaf_id: String(s?.leaf_id ?? ""),
    node_label: s?.node_label != null ? String(s.node_label) : undefined,
    tier: coerceTier(s?.tier),
    rationale: String(s?.rationale ?? ""),
  })) : [];
  const out: OperatorOutput = { merges, set_aside };
  if (scope === "global" || raw?.flag_missing) {
    out.flag_missing = {
      expected_still_missing: Array.isArray(raw?.flag_missing?.expected_still_missing) ? raw.flag_missing.expected_still_missing.map(String) : [],
      rationale: String(raw?.flag_missing?.rationale ?? ""),
    };
  }
  // Structural safety floor: compartment scope must exactly partition its input
  // leaves. Global scope emits flag_missing only (no partition) and is exempt.
  if (expectedLeafIds && scope === "compartment") assertPartition(out, expectedLeafIds);
  return out;
}
