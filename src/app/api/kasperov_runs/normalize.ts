// src/app/api/kasperov_runs/normalize.ts
//
// READ-TIME normalization: transform a batch-shaped worker run (produced by the
// Phase-0→A→B fine-labelling harnesses) into the shape the daniotype_kasperov
// RunViewer already reads — WITHOUT rewriting the persisted worker run. The
// canonical, provenance-complete run stays worker-native on disk; the UI adapts
// to it in-flight. Non-destructive by construction.
//
// Fixes:
//   * Wall 3 (transcripts): worker step {step,title,mode,request,response,thinking,
//     statuses} → viewer turns {role,content,mode,thinking} so the drill-in renders
//     real 3-personality bodies instead of blanks.
//   * Wall 2 (provenance): surface run.metadata.* into the TOP-LEVEL fields the
//     viewer reads — clusteringStrategy (ClusteringProvenance viewer mode), provenance
//     (GroundingPanel), harness (HarnessDetail), cost. Map, never invent: a field
//     absent from metadata is left absent.
//   * Two-run split (MiniFin/MegaFin): the labelling run carries transcripts, the
//     consolidation run carries operatorProposal — merge the consolidation's
//     operatorProposal + deliverable labels in so one pick shows the whole picture.
//
// ZSCAPE-style runs are already viewer-shaped ({role,content} transcripts, no
// metadata blob) → isBatchRun() is false → they pass through untouched.

type AnyRec = Record<string, any>;

const isObj = (v: any): v is AnyRec => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: any): v is string => typeof v === "string" && v.trim().length > 0;

/** A batch-shaped run carries our metadata blob and/or worker-native transcript
 *  steps ({request,response,...}) rather than the viewer's {role,content}. */
export function isBatchRun(run: AnyRec): boolean {
  if (!isObj(run)) return false;
  const m = run.metadata;
  const hasMeta = isObj(m) && (m.labeller || m.phase0_provenance || m.gate_adapter || m.grounding);
  const firstStep = (run.clusters || [])
    .find((c: any) => Array.isArray(c?.transcript) && c.transcript.length)?.transcript?.[0];
  const workerStep = isObj(firstStep) && (firstStep.request !== undefined || firstStep.response !== undefined || firstStep.step !== undefined);
  return !!(hasMeta || workerStep);
}

/** worker step → viewer turns. Each step becomes a user beat (the prompt) plus an
 *  assistant turn (the response + thinking). Preserves title + mode so the
 *  collapsible beats label correctly (research#1 → "Researcher · evidence", etc.). */
function normalizeTranscript(steps: any[]): any[] {
  if (!Array.isArray(steps)) return [];
  const out: any[] = [];
  for (const s of steps) {
    if (!isObj(s)) continue;
    if (isStr(s.role) && s.content !== undefined) { out.push(s); continue; } // already viewer-shaped
    const mode = s.mode === "research" ? "research" : s.mode === "reason" ? "reason" : (isStr(s.mode) ? s.mode : "reason");
    const title = isStr(s.title) ? s.title : undefined;
    if (isStr(s.request)) out.push({ role: "user", content: String(s.request), mode, title });
    const statuses = Array.isArray(s.statuses) && s.statuses.length
      ? `\n\n🔎 web search: ${s.statuses.filter(Boolean).join(" · ")}` : "";
    if (s.response !== undefined || statuses) {
      out.push({ role: "assistant", content: String(s.response ?? "") + statuses, mode, title, thinking: isStr(s.thinking) ? s.thinking : undefined });
    }
  }
  return out;
}

/** "run_leaf_v2 (v1.2)" → { name:"run_leaf_v2", version:"1.2" } */
function parseLabeller(lab?: string): { name?: string; version?: string } {
  if (!isStr(lab)) return {};
  const m = /^(.*?)\s*\(v?([\d.]+)\)/.exec(lab);
  return m ? { name: m[1].trim(), version: m[2] } : { name: lab };
}

function gateLine(g: any): string | undefined {
  if (!isObj(g)) return undefined;
  const rationale = isObj(g.provenance) ? (g.provenance.anchor || g.provenance.reason) : (isStr(g.note) ? g.note : "");
  return `n_enriched gate = ${g.n_enriched_gate}${isStr(rationale) ? " · " + rationale : ""}`;
}

/** vote + stage + gt-blind prose for the clustering panel (renders as `embedding`). */
function clusteringNote(pp: any, ppStr: string | null, stage: string | undefined, gt: any): string | undefined {
  const parts: string[] = [];
  if (isObj(pp)) {
    if (pp.control_vote) parts.push(`Control-vote: ${pp.control_vote}${pp.n_control_cells ? ` (${Number(pp.n_control_cells).toLocaleString()} cells` : ""}${pp.control_column ? `, obs.${pp.control_column} ~ “${pp.control_value_match}”)` : pp.n_control_cells ? ")" : ""}.`);
    parts.push(`Stage ${stage || "48 hpf"}${pp.gene_scheme ? `, ${pp.gene_scheme}` : ""}.`);
  } else {
    parts.push(`Stage ${stage || "48 hpf"}.`);
  }
  if (isObj(gt) && gt.asserted) parts.push(`GT-blind: asserted; leak-scan ${gt.run_level_leak_scan || gt.leak_scan || "clean"}.`);
  return parts.length ? parts.join(" ") : undefined;
}

/** trust basis + dataset caveats for the grounding panel (renders as `harnessNote`). */
function harnessNote(lm: AnyRec, cm: AnyRec, model: string | undefined): string | undefined {
  const parts: string[] = [];
  const lab = lm.labeller || cm.labeller;
  if (lab) parts.push(`${lab}${model ? " · " + model : ""} — web-search Researcher → Reasoner → Archivist (marker-grounded).`);
  const tb = cm.trust_basis || lm.trust_basis;
  if (isStr(tb)) parts.push(`Trust basis: ${tb}`);
  else if (isObj(tb)) parts.push(`Trust basis: ${[tb.primary, tb.megafin_gt].filter(isStr).join(" ")}`);
  const val = cm.validation;
  if (isObj(val) && isObj(val.lenient_agreement)) {
    const la = val.lenient_agreement;
    parts.push(`Validation (vs sealed GT): lenient ${[la.committed_in_ontology, la.all_GTbacked_control].filter((x) => x != null).join(" committed / ")} .`);
  }
  const nm = cm.near_miss_finding;
  if (isObj(nm) && isStr(nm.action)) parts.push(`Near-miss cutoff finding: ${nm.action}`);
  const ont = cm.ontology;
  if (isObj(ont) && ont.PENDING_PATRICK) parts.push(`Ontology: ${ont.scheme || "cell-type identity"} — Patrick decision pending.`);
  return parts.length ? parts.join("  ") : undefined;
}

/** Map merged metadata → the top-level provenance fields the viewer reads. */
function mapProvenance(run: AnyRec, lm: AnyRec, cm: AnyRec): void {
  const stamp = lm.finished || lm.started || cm.created || undefined;

  // harness → HarnessDetail + the "2. Model & Harness" header
  const lv = parseLabeller(lm.labeller || cm.labeller);
  run.harness = {
    id: lv.version ? `v${lv.version}` : "v1.2",
    version: lv.version || "1.2",
    name: lv.name || "run_leaf_v2",
    gitCommit: lm.git_commit || lm.labeller_core_commit || cm.git_commit || undefined,
    stampedAt: stamp,
  };

  // clusteringStrategy → ClusteringProvenance (viewer mode)
  const pp = lm.phase0_provenance ?? cm.phase0_provenance;
  const cs: AnyRec = {
    backfilled: true, backfillAt: stamp,
    backfillSources: [{ path: `daniotype_backups (worker run ${run.datasetId})`, sha256: "" }],
  };
  if (isObj(pp)) {
    if (pp.recipe) cs.recipe = pp.recipe;
    if (pp.resolution != null) cs.chosenRes = pp.resolution;
    cs.nClusters = pp.nLeaves ?? (run.clusters || []).length;
  } else if (isStr(pp)) {
    cs.recipe = pp;
    const r = /local\s*([0-9]+\.[0-9]+)/.exec(pp); if (r) cs.chosenRes = parseFloat(r[1]);
    const n = /([0-9]+)\s*leaves/.exec(pp); cs.nClusters = n ? parseInt(n[1], 10) : (run.clusters || []).length;
  } else {
    cs.nClusters = (run.clusters || []).length;
  }
  const note = clusteringNote(isObj(pp) ? pp : null, isStr(pp) ? pp : null, lm.stage || cm.stage, lm.gt_blind || cm.gt_blind);
  if (note) cs.embedding = note;
  const gl = gateLine(lm.gate_adapter || cm.gate_adapter); if (gl) cs.gate = gl;
  run.clusteringStrategy = cs;

  // provenance → GroundingPanel (grounding + trust/caveats via harnessNote)
  const g = lm.grounding || cm.grounding;
  const prov: AnyRec = { source: run.source || "worker (batch, normalized)", backfilled: true, backfillAt: stamp };
  const hn = harnessNote(lm, cm, run.model); if (hn) prov.harnessNote = hn;
  if (isObj(g)) {
    prov.grounding = {
      servedDataset: g.service || run.dataset,
      guardResult: g.preflight ? "preflight-verified" : undefined,
      guardDetail: g.preflight || undefined,
      scanNote: g.symbol_map_coverage || undefined, // surfaces the gene-map coverage caveat
    };
    const refs: AnyRec[] = [];
    for (const [p, role] of [[g.h5ad, "matrix"], [g.symbol_map, "ENSDARG→symbol map"], [g.leaf_assign, "leaf assignment"]] as [string, string][]) {
      if (isStr(p)) refs.push({ path: p, sha256: "", role });
    }
    if (refs.length) prov.evidenceRefs = refs;
  }
  run.provenance = prov;

  // cost → "2. Model & Harness" model card
  const usd = lm.cost_usd ?? cm.cost_usd;
  if (typeof usd === "number") run.cost = { usd, estimated: false };
}

/**
 * Normalize one batch run for the viewer. `consolidation` (optional) contributes
 * operatorProposal (the merge/set-aside/SSMP tab) and the deliverable labels.
 * If `run` is already viewer-shaped (ZSCAPE), it is returned untouched.
 */
export function normalizeRun(run: AnyRec, consolidation?: AnyRec | null): AnyRec {
  if (!isBatchRun(run)) return run;
  const lm: AnyRec = isObj(run.metadata) ? run.metadata : {};
  const cm: AnyRec = isObj(consolidation?.metadata) ? consolidation!.metadata : {};

  const out: AnyRec = { ...run, schema: run.schema || "daniotype_kasperov_run/v1" };
  // run date: the worker run JSON has no top-level exportedAt (it's in metadata.finished) — surface
  // it so the viewer header shows the real run date instead of falling back to the model name.
  if (!out.exportedAt) out.exportedAt = lm.finished || lm.started || cm.created || undefined;

  // clusters: transcript from the labelling run; label/node/ssmp from the
  // consolidation deliverable when present (authoritative final labels).
  const consById = new Map<string, any>();
  for (const c of (consolidation?.clusters || [])) consById.set(String(c.id), c);
  out.clusters = (run.clusters || []).map((lc: any) => {
    const cc = consById.get(String(lc.id)) || {};
    return {
      ...lc,
      ...cc,
      finalLabel: cc.finalLabel ?? lc.finalLabel,
      label: cc.label ?? lc.label,
      validated: cc.validated ?? lc.validated,
      transcript: normalizeTranscript(lc.transcript || []),
    };
  });

  // consolidation tab (merges/set-aside/tier + SSMP flags)
  if (isObj(consolidation?.operatorProposal)) out.operatorProposal = consolidation!.operatorProposal;
  else if (isObj(run.operatorProposal)) out.operatorProposal = run.operatorProposal;

  // bespoke expert-GT scorecard (kind:"expertGT-4bucket") lives on the CONSOLIDATION run — carry it
  // through the lineage merge so the Judge tab's two-panel screen renders (else {...run}=labelling drops it).
  if (isObj(consolidation?.expertGtScorecard)) out.expertGtScorecard = consolidation!.expertGtScorecard;
  else if (isObj(run.expertGtScorecard)) out.expertGtScorecard = run.expertGtScorecard;

  mapProvenance(out, lm, cm);

  // keep the raw metadata around (harmless; nothing reads it) but drop nothing.
  return out;
}
