// brain.ts — the Phase-2 Meta-Reasoner "brain": pure logic for assembling the
// GT-BLIND input, building the prompt, parsing the structured decision, and
// enforcing the descent cap. No React, no network — shared by the API route
// (server) and the panel (client), so both agree on exactly what is sent and how
// guardrails are enforced. The two guardrails live HERE, not in the prompt:
//   A. GT-BLIND — assembleBrainInput only reads whitelisted, labeller-derived
//      fields; assertGtBlind() throws if any sealed key ever appears.
//   B. EXPECTATION-BIAS — enforceCaps() coerces an over-budget `descend` into
//      `not_found_accept`, so "try harder until it appears" is impossible.
import { META_REASONER_CONTEXT, DESCENT_CAPS, BRAIN_OUTCOMES, type BrainAction } from "./metaReasonerContext";

export type { BrainAction };

// ---- ledger the brain reasons over (all fields are labeller-derived / counts) ----
export type LedgerCompartment = {
  index: number;
  status: "done" | "next" | "pending";
  total: number;
  labelled: number;
  abstained: number;
  avgConf: number | null;
  // the LABELLER'S OWN predicted labels for this compartment's leaves (de-novo
  // output) — NOT sealed ground truth. Only populated for done compartments.
  predictedLabels: string[];
};
export type BrainLedger = {
  justFinishedCompartment: number;
  nextCompartment: number | null;
  compartments: LedgerCompartment[];
  confidenceBuckets: { name: string; n: number }[];
};

export type BrainInput = {
  role: "meta_reasoner";
  boundary: { justFinishedCompartment: number; nextCompartment: number | null };
  ledger: BrainLedger;
  rules: { title: string; body: string }[];
  gtDiscipline: { title: string; body: string }[];
  experientialPriors: string[];
  expectedTissues: string[];
  descentCaps: typeof DESCENT_CAPS;
  // how many times `descend` has already been spent per expected tissue this run
  priorDescentAttempts: Record<string, number>;
  outcomes: readonly BrainAction[];
};

export type BrainDecision = {
  action: BrainAction;
  target: string;
  rationale: string;
  expected_still_missing: string[];
};

// ---- GUARDRAIL A: GT-blindness -------------------------------------------------
// Sealed ground-truth / control-vote DATA fields that must never reach the brain.
// SUBSTRING fragments are matched against the raw lowercased key WITH separators
// kept (so "gt_control"/"groundTruth" are caught but the legitimate config field
// "gtDiscipline" — rules ABOUT gt discipline, not sealed data — is NOT). EXACT
// names are matched only when the whole key equals them (so a bare "gt"/"control"
// field is caught without snaring "gtDiscipline").
export const GT_FORBIDDEN_FRAGMENTS = [
  "groundtruth", "ground_truth", "gt_control", "gtcontrol", "gt_allcell", "gtallcell",
  "gt_tissue", "gttissue", "gt_label", "gtlabel", "gt_germ", "gtgermlayer",
  "control_vote", "controlvote", "controlcell", "sealedlabel", "answerkey", "answer_key", "allcelltype",
];
export const GT_FORBIDDEN_EXACT = ["gt", "control", "verdict", "verdicts", "aggregate", "sealed", "truth"];

// Deep-scan an object graph; throw if any key looks like a sealed GT field.
export function assertGtBlind(obj: unknown, path = "$"): true {
  if (obj == null || typeof obj !== "object") return true;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => assertGtBlind(v, `${path}[${i}]`));
    return true;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const raw = k.toLowerCase();
    const exact = raw.replace(/[_\s-]/g, "");
    for (const frag of GT_FORBIDDEN_FRAGMENTS) {
      if (raw.includes(frag)) {
        throw new Error(`GT-SEAL VIOLATION: forbidden key "${k}" at ${path} (matched "${frag}"). The meta-reasoner must never receive sealed ground-truth.`);
      }
    }
    if (GT_FORBIDDEN_EXACT.includes(exact)) {
      throw new Error(`GT-SEAL VIOLATION: forbidden key "${k}" at ${path} (exact sealed-field name). The meta-reasoner must never receive sealed ground-truth.`);
    }
    assertGtBlind(v, `${path}.${k}`);
  }
  return true;
}

// Build the EXACT input object passed to the brain. By construction it reads only
// labeller-derived fields; assertGtBlind is a belt-and-braces final check.
export function assembleBrainInput(args: {
  ledger: BrainLedger;
  priorDescentAttempts?: Record<string, number>;
}): BrainInput {
  const input: BrainInput = {
    role: "meta_reasoner",
    boundary: {
      justFinishedCompartment: args.ledger.justFinishedCompartment,
      nextCompartment: args.ledger.nextCompartment,
    },
    ledger: args.ledger,
    rules: META_REASONER_CONTEXT.rules,
    gtDiscipline: META_REASONER_CONTEXT.gtDiscipline,
    experientialPriors: META_REASONER_CONTEXT.experientialPriors,
    expectedTissues: META_REASONER_CONTEXT.expectedTissues,
    descentCaps: META_REASONER_CONTEXT.descentCaps,
    priorDescentAttempts: args.priorDescentAttempts ?? {},
    outcomes: BRAIN_OUTCOMES,
  };
  assertGtBlind(input);
  return input;
}

// ---- ledger builders (labeller predictions only) -------------------------------
const isAbstain = (s: string) => /abstain/i.test(s || "");

// From the /meta_reasoner replay asset at a given boundary. `finalLabel` is the
// labeller's de-novo prediction (from run.json.final_label) — never sealed GT.
export function ledgerFromReplay(asset: any, boundary: any): BrainLedger {
  const justFinished = boundary.at_boundary_after_compartmentIndex as number;
  const next = (boundary.next_compartmentIndex ?? null) as number | null;
  const comps = [...(asset.compartments || [])].sort((a: any, b: any) => a.index - b.index);
  const leafById = new Map<string, any>((asset.leaves || []).map((l: any) => [String(l.id), l]));
  const compartments: LedgerCompartment[] = comps.map((c: any) => {
    const leaves = (c.leafIds || []).map((id: string) => leafById.get(String(id))).filter(Boolean);
    const labelled = leaves.filter((l: any) => l.finalLabel);
    const status: LedgerCompartment["status"] = c.index <= justFinished ? "done" : c.index === next ? "next" : "pending";
    return {
      index: c.index,
      status,
      total: leaves.length,
      labelled: labelled.length,
      abstained: labelled.filter((l: any) => isAbstain(l.finalLabel)).length,
      avgConf: null, // replay asset carries no per-tier confidence
      predictedLabels: status === "done" ? labelled.map((l: any) => String(l.finalLabel)) : [],
    };
  });
  return { justFinishedCompartment: justFinished, nextCompartment: next, compartments, confidenceBuckets: [] };
}

// From the LIVE sweep state (KasperovClient / MetaReasonerStub). `labels[id]` is
// the labeller's own predicted label; `confidence` is its self-reported tiers.
export function ledgerFromLive(args: {
  clusters: any[];
  labels: Record<string, string>;
  confidence: Record<string, any>;
  justFinished: number;
  nextUp: number | null;
  overallConf: (c: any) => number | undefined;
}): BrainLedger {
  const { clusters, labels, confidence, justFinished, nextUp, overallConf } = args;
  const byComp = new Map<number, any[]>();
  for (const c of clusters) {
    if (typeof c.compartmentIndex !== "number") continue;
    if (!byComp.has(c.compartmentIndex)) byComp.set(c.compartmentIndex, []);
    byComp.get(c.compartmentIndex)!.push(c);
  }
  const indices = Array.from(byComp.keys()).sort((a, b) => a - b);
  const compartments: LedgerCompartment[] = indices.map((idx) => {
    const arr = byComp.get(idx)!;
    const labelledArr = arr.filter((c) => labels[c.id]);
    const confs = arr.map((c) => overallConf(confidence[c.id])).filter((x): x is number => typeof x === "number");
    const status: LedgerCompartment["status"] = idx <= justFinished ? "done" : idx === nextUp ? "next" : "pending";
    return {
      index: idx,
      status,
      total: arr.length,
      labelled: labelledArr.length,
      abstained: labelledArr.filter((c) => isAbstain(labels[c.id])).length,
      avgConf: confs.length ? Math.round(confs.reduce((s, x) => s + x, 0) / confs.length) : null,
      predictedLabels: status === "done" ? labelledArr.map((c) => String(labels[c.id])) : [],
    };
  });
  const allConfs = clusters.filter((c) => labels[c.id]).map((c) => overallConf(confidence[c.id])).filter((x): x is number => typeof x === "number");
  const confidenceBuckets = [
    { name: "high ≥75", n: allConfs.filter((x) => x >= 75).length },
    { name: "med 50–74", n: allConfs.filter((x) => x >= 50 && x < 75).length },
    { name: "low <50", n: allConfs.filter((x) => x < 50).length },
  ];
  return { justFinishedCompartment: justFinished, nextCompartment: nextUp, compartments, confidenceBuckets };
}

// ---- prompt ---------------------------------------------------------------------
export function buildBrainPrompt(input: BrainInput): { system: string; user: string } {
  const system = [
    "You are the META-REASONER — a supervisor that runs ABOVE a per-cluster cell-type labeller, at each COMPARTMENT BOUNDARY of a top-down, coarse-then-fine descent over a zebrafish single-cell atlas.",
    "You do NOT label individual clusters. You reason about whole compartments: was the just-finished compartment homogeneous (one identity restated → consolidate) or heterogeneous (descent justified)? And prospectively: which expected tissues are still unaccounted for, and where should future descent budget go?",
    "",
    "You are GT-BLIND. You never receive sealed ground-truth or control-vote names. The 'predicted labels' you see are the LABELLER'S OWN de-novo predictions — treat them as evidence of what the labeller thinks, not as truth.",
    "Experiential priors are GENERAL developmental biology (what a 48 hpf embryo should contain). They may DIRECT your attention to a missing tissue; they may NEVER be used as grounding to claim a tissue IS present.",
    "",
    "OUTCOMES you may choose (exactly one `action`):",
    "- consolidate — the just-finished compartment is near-homogeneous; its leaves restate one identity and should roll up under a single umbrella.",
    "- descend — the compartment is heterogeneous OR an expected tissue plausibly lives in a not-yet-resolved compartment and is worth spending budget to resolve.",
    "- not_found_accept — an expected tissue is not present after looking (or this is not where it lives). Absence is a VALID terminal answer. Choosing this when appropriate is correct behavior, not failure.",
    "",
    `HARD CAP: a given expected tissue may be pursued by 'descend' at most ${input.descentCaps.maxDescentAttemptsPerExpectedTissue} time(s) across the whole run. If you have already spent that budget on a tissue (see priorDescentAttempts), you MUST choose not_found_accept for it — do not keep descending to make it appear. The server enforces this regardless.`,
    "",
    "Respond with a short prose rationale, THEN a single fenced ```json block with exactly:",
    '{ "action": "consolidate" | "descend" | "not_found_accept", "target": "<compartment / tissue the action is about>", "rationale": "<one or two sentences>", "expected_still_missing": ["<expected tissue>", ...] }',
  ].join("\n");

  const user = [
    "=== BOUNDARY ===",
    `Just finished: Compartment ${input.boundary.justFinishedCompartment}. Next up: ${input.boundary.nextCompartment ?? "none (end of sweep)"}.`,
    "",
    "=== LEDGER (labeller's own output so far) ===",
    ...input.ledger.compartments.map((c) => {
      const head = `Compartment ${c.index} [${c.status}] — ${c.labelled}/${c.total} labelled, ${c.abstained} abstained${c.avgConf != null ? `, avg conf ${c.avgConf}%` : ""}`;
      if (c.status !== "done" || !c.predictedLabels.length) return head;
      // count near-duplicate predicted labels so homogeneity is legible
      const counts = new Map<string, number>();
      for (const l of c.predictedLabels) counts.set(l, (counts.get(l) || 0) + 1);
      const lines = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([lab, n]) => `    - ${lab}${n > 1 ? ` ×${n}` : ""}`);
      return head + "\n  predicted labels:\n" + lines.join("\n");
    }),
    input.ledger.confidenceBuckets.length ? `\nConfidence distribution: ${input.ledger.confidenceBuckets.map((b) => `${b.name}: ${b.n}`).join(" · ")}` : "",
    "",
    "=== EXPECTED TISSUES (general 48 hpf prior — attention only, not grounding) ===",
    input.expectedTissues.join(", "),
    "",
    "=== DESCENT BUDGET ALREADY SPENT (per expected tissue, this run) ===",
    Object.keys(input.priorDescentAttempts).length ? JSON.stringify(input.priorDescentAttempts) : "(none yet)",
    "",
    "Reason retrospectively about the just-finished compartment AND prospectively about what is still missing, then emit your decision JSON.",
  ].join("\n");

  return { system, user };
}

// ---- parse + GUARDRAIL B (cap enforcement) -------------------------------------
export function parseBrainDecision(text: string): BrainDecision {
  let jsonStr = "";
  const fenced = text.match(/```+\s*json\s*([\s\S]*?)```+/i) || text.match(/```+\s*([\s\S]*?)```+/);
  if (fenced) jsonStr = fenced[1];
  else {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) jsonStr = text.slice(first, last + 1);
  }
  let raw: any = {};
  try { raw = JSON.parse(jsonStr); } catch { raw = {}; }
  const action: BrainAction = (BRAIN_OUTCOMES as readonly string[]).includes(raw?.action) ? raw.action : "not_found_accept";
  return {
    action,
    target: typeof raw?.target === "string" ? raw.target : "",
    rationale: typeof raw?.rationale === "string" ? raw.rationale : (jsonStr ? "" : text.slice(0, 400)),
    expected_still_missing: Array.isArray(raw?.expected_still_missing) ? raw.expected_still_missing.map(String) : [],
  };
}

// GUARDRAIL B: if the brain wants to `descend` for a tissue whose descent budget is
// already spent, coerce to not_found_accept. Returns the (possibly coerced)
// decision + a flag/note for the log so the coercion is visible and judgeable.
export function enforceCaps(
  decision: BrainDecision,
  priorDescentAttempts: Record<string, number>,
  caps = DESCENT_CAPS,
): { decision: BrainDecision; capApplied: boolean; note: string | null } {
  if (decision.action !== "descend") return { decision, capApplied: false, note: null };
  const key = (decision.target || "").trim().toLowerCase();
  const spent = key ? priorDescentAttempts[key] ?? priorDescentAttempts[decision.target] ?? 0 : 0;
  if (spent >= caps.maxDescentAttemptsPerExpectedTissue) {
    const note = `descent budget for "${decision.target}" already spent (${spent}/${caps.maxDescentAttemptsPerExpectedTissue}); coerced descend → not_found_accept (expectation-bias guardrail).`;
    return {
      decision: { ...decision, action: "not_found_accept", rationale: `${decision.rationale} [${note}]` },
      capApplied: true,
      note,
    };
  }
  return { decision, capApplied: false, note: null };
}
