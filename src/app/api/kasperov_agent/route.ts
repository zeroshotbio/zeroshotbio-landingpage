// src/app/api/kasperov_agent/route.ts
//
// Streaming research-agent backend for the daniotype_kasperov labelling wizard.
// Provider: OpenAI Responses API. Two personalities, routed per question:
//
//   • "research"  — restricted web search over canonical zebrafish resources
//                   (ZFIN, ZFA, GO, NCBI, UniProt); grounds a cell-type call,
//                   tags each evidence item with its source. The default.
//   • "archivist" — NO web search; answers strictly from the raw MiniFin facts
//                   for the cluster (marker stats injected below), separating
//                   direct dataset values from any interpretation.
//
// SSE. Each line is `data: {json}`:
//   {t:"mode",     v:"research"|"archivist"}     chosen personality (first)
//   {t:"status",   v:"…"}                         live activity
//   {t:"thinking", v:"<delta>"}                   reasoning-summary trace
//   {t:"text",     v:"<delta>"}                   answer text, streamed
//   {t:"done"}                                    stream complete

import "server-only";
import { readFile } from "fs/promises";
import path from "path";
export const runtime = "nodejs";
const DATA_DIR = path.join(process.cwd(), "daniotype_data");
// up to 300s on Vercel Pro (heavy models need it); silently capped at 60s on Hobby.
export const maxDuration = 300;

// Server-side richer per-dataset extract the Archivist queries (full up +
// computed down markers + dataset cell counts per cluster). Bundled at build.
import MINIFIN_ARCHIVIST from "./minifin_archivist.json";
import ZSCAPE_ARCHIVIST from "./zscape_archivist.json";
import MEGAFIN_ARCHIVIST from "./megafin_archivist.json";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

// One agent route serves every dataset; the body's `dataset` id selects which
// archivist extract + static-asset base + display name to use.
// dataDir = subdir under daniotype_data/ holding this dataset's profiles (read off
// disk server-side). base = the client-facing (auth-gated) asset URL, for reference.
type DatasetCfg = { id: string; name: string; base: string; dataDir: string; archivist: any };
const DATASET_CFG: Record<string, DatasetCfg> = {
  minifin: { id: "minifin", name: "MiniFin", base: "/api/kasperov_asset/minifin/archivist", dataDir: "minifin", archivist: MINIFIN_ARCHIVIST as any },
  zscape: { id: "zscape", name: "ZSCAPE", base: "/api/kasperov_asset/zscape/archivist", dataDir: "zscape", archivist: ZSCAPE_ARCHIVIST as any },
  megafin: { id: "megafin", name: "MegaFin", base: "/api/kasperov_asset/megafin/archivist", dataDir: "megafin", archivist: MEGAFIN_ARCHIVIST as any },
};
const dsOf = (id: unknown): DatasetCfg => DATASET_CFG[String(id)] ?? DATASET_CFG.minifin;

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;

const ALLOWED_DOMAINS = [
  "zfin.org",
  "www.ebi.ac.uk",
  "ebi.ac.uk",
  "geneontology.org",
  "amigo.geneontology.org",
  "www.ncbi.nlm.nih.gov",
  "www.uniprot.org",
];

type Mode = "research" | "archivist" | "reason";
type ChatMessage = { role: "user" | "assistant"; content: string };
type Marker = { g: string; l2fc?: number; p1?: number; p2?: number };
type Cluster = { id: string; label?: string; degsUp?: string[]; markers?: Marker[]; markersDown?: Marker[]; nCells?: number };

// --- mode routing (3-way) --------------------------------------------------
// Force a specialist by starting the message with "Researcher:" / "Archivist:" /
// "Reasoner:"; otherwise route by address, intent verbs, then keyword cues.
const FORCE_PREFIX = /^\s*(researcher|archivist|reasoner)\s*:/i;
const NAME_TARGETS: [RegExp, Mode][] = [
  [/\barchivist\b/i, "archivist"],
  [/\breasoner\b/i, "reason"],
  [/\b(researcher|research personality)\b/i, "research"],
];
// "give me the prompt for the Archivist" = ask the Reasoner to CRAFT a prompt
// (it owns the dispatch button), NOT a message addressed to the named personality.
const PROMPT_CRAFT = /\b(prompt (for|to send|to give) (the )?\w+|(give|craft|write|draft|make|prepare|compose|generate) (me )?(a |the |another )?prompt)\b/i;
const RESEARCH_VERBS = /\b(do research|research the|research on|look (it |this )?up in zfin|check zfin|search (zfin|the literature|the canonical)|find (the )?(literature|citations|records))\b/i;
const ARCHIVIST_VERBS = /\b(pull up|pull the|fetch the|raw values|raw data|from (the )?minifin|dataset values|list the (top|down|up)|show me the (top|down|up|markers|genes))\b/i;
const REASON_VERBS = /\b(update the confidence|develop confidence|what do you think|your take|reason (about|through)|do you think|interpret|make sense of|synthesi[sz]e|weigh|how confident)\b/i;

const ARCHIVIST_CUES =
  /\b(how many|number of|count|raw|dataset|data set|minifin|log2|fold[- ]?change|pct|percent|expression (value|of)|statistic|exact|list the|which genes|what genes|top \d+|top (genes|markers)|markers? (for|of this)|down[- ]?regulated|up[- ]?regulated|specificity|cell count|cluster size|umap)\b/gi;
const RESEARCH_CUES =
  /\b(cell type|identity|zfin|zfa|\bgo\b|anatomy|function|consistent with|lineage|marker of|role of|literature|known to|express(ed|ion) in|develops?|differentiat|in vivo|ontology)\b/gi;
const REASON_CUES =
  /\b(why|how come|could it|would you|might|hypothes|compare|contrast|explain|interpret|do you think|your (take|opinion)|infer|speculat|overall|in general|make sense|implication|confidence|trade[- ]?off|what if)\b/gi;

function classifyMode(text: string, isFirst: boolean): Mode {
  // -1) explicit force: message starts with "Researcher:" / "Archivist:" / "Reasoner:"
  const fp = text.match(FORCE_PREFIX);
  if (fp) {
    const w = fp[1].toLowerCase();
    return w === "archivist" ? "archivist" : w === "reasoner" ? "reason" : "research";
  }
  if (isFirst) return "research"; // the auto-run identity call is always research
  // 0) crafting a prompt for another personality is the Reasoner's job — even
  // though the message names that other personality, do NOT route there.
  if (PROMPT_CRAFT.test(text)) return "reason";
  // 1) explicit address — if exactly one personality is named, obey it
  const targets = new Set<Mode>();
  for (const [re, m] of NAME_TARGETS) if (re.test(text)) targets.add(m);
  if (targets.size === 1) return Array.from(targets)[0];
  // 2) strong intent verbs (research intent beats an incidental "confidence")
  if (RESEARCH_VERBS.test(text)) return "research";
  if (ARCHIVIST_VERBS.test(text)) return "archivist";
  if (REASON_VERBS.test(text)) return "reason";
  // 3) keyword cue counting
  const a = (text.match(ARCHIVIST_CUES) || []).length;
  const r = (text.match(RESEARCH_CUES) || []).length;
  const g = (text.match(REASON_CUES) || []).length;
  if (a >= r && a >= g && a > 0) return "archivist";
  if (r >= g && r > 0) return "research";
  if (g > 0) return "reason";
  return "reason"; // a bare follow-up with no signal → generalist reasoner
}

// Shared preamble: every personality knows about the other two in-app specialists,
// so references like "the Researcher" / "the research personality" are unambiguous.
const PERSONAS_CONTEXT =
  "CONTEXT — this tool has three in-app personalities the curator talks to inside THIS chat: " +
  "the Researcher (restricted web search over ZFIN/ZFA/GO, cites records), " +
  "the Archivist (answers only from the raw values of the active dataset), and " +
  "the Reasoner (a generalist who synthesises and explains, no tools). " +
  "When the curator says 'the Researcher', 'the Archivist', 'the Reasoner', or e.g. 'the research personality', they mean these in-app specialists — not external people or papers.";

// Shared tail: lets any personality optionally enrich the Top Markers panel.
const MARKER_BLOCK_INSTR =
  "\n\nIf you discuss specific marker genes (with stats or a notable annotation) for THIS cluster, append at the very END a fenced block (it is hidden from the user and used to optionally enrich the Top Markers panel):\n" +
  "```kasperov-markers\n" +
  '[{"g":"GENE","l2fc":<number or null>,"p1":<0-1 or null>,"p2":<0-1 or null>,"note":"<≤8 words>"}]\n' +
  "```\n" +
  "List only genes you actually discussed; use null for unknown numbers; always include a short note. Omit the block entirely if you discussed no specific markers.";

type StatMarker = { g: string; l2fc?: number; p1?: number; p2?: number };
function mtable(ms: StatMarker[]): string[] {
  return [
    "| gene | log2FC | % in-cluster | % out-of-cluster |",
    "| --- | --- | --- | --- |",
    ...ms.map((m) => `| ${m.g} | ${m.l2fc ?? "?"} | ${m.p1 != null ? (m.p1 * 100).toFixed(0) + "%" : "?"} | ${m.p2 != null ? (m.p2 * 100).toFixed(0) + "%" : "?"} |`),
  ];
}

// Build the authoritative facts the Archivist quotes — from the server-side
// MiniFin extract when available, else the markers the client sent.
function rawFactsBlock(cluster: Cluster, ds: DatasetCfg): string {
  const data: any = ds.archivist;
  const rec = data?.clusters?.[String(cluster.id)];
  if (rec) {
    const up: StatMarker[] = rec.up ?? [];
    const down: StatMarker[] = rec.down ?? [];
    return [
      `Cluster: ${cluster.label ?? cluster.id}`,
      `Cells in this cluster: ${rec.nCells}. Total cells in the ${ds.name} dataset: ${data.datasetCells}.`,
      "",
      `UP-REGULATED markers (one-vs-rest, split-pipe leiden) — ${up.length} available, sorted by score:`,
      ...mtable(up),
      "",
      `DOWN-REGULATED markers (one-vs-rest, computed from the h5ad: most-negative log2FC among genes broadly expressed outside the cluster) — top ${down.length}:`,
      ...mtable(down),
    ].join("\n");
  }
  // fallback: only what the client sent (top up markers)
  const rows = mtable(cluster.markers ?? []);
  return [
    `Cluster: ${cluster.label ?? cluster.id}`,
    cluster.nCells != null ? `Cells in cluster: ${cluster.nCells}` : "",
    "Top up-regulated markers (one-vs-rest, split-pipe leiden):",
    ...rows,
    "(Down-regulated markers unavailable in this fallback.)",
  ]
    .filter(Boolean)
    .join("\n");
}

function researchInstructions(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).join(", ");
  const down = (cluster.markersDown ?? []).slice(0, 10).map((m) => m.g).join(", ");
  return [
    "You are the assistant in RESEARCHER mode — a zebrafish (Danio rerio) cell-type annotation research agent working with a human curator who makes the final call.",
    PERSONAS_CONTEXT,
    "Determine the most defensible cell-type identity by grounding it in canonical evidence: markers → in-vivo expression (ZFIN) → ZFA anatomy → cell type, corroborated by GO.",
    "",
    "RULES (cite-discipline):",
    "- Use web search against the canonical resources only (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Never assert anatomy/function from unsourced memory — look it up.",
    "- BREADTH — DO NOT rely on ZFIN gene pages alone. Spread your searches across resources and actually run them: (1) ZFIN for in-vivo expression, (2) the GENE ONTOLOGY (geneontology.org / QuickGO, or via NCBI Gene / UniProt) for the molecular function & biological process your leading markers implicate, and (3) the ZFA anatomy term (search EBI OLS `ebi.ac.uk/ols` or ZFIN anatomy) for the candidate tissue/structure. Aim for the identity call to cite at least ONE GO term and ONE ZFA anatomy term ALONGSIDE ZFIN expression, whenever they exist — a call grounded only in ZFIN is weaker. Issue separate searches for GO and ZFA; don't assume they'll come up under a gene-page search.",
    "- Marker symbols may be human-ortholog-cased (e.g. HOXB13); map to the zebrafish gene.",
    "- CITE-DISCIPLINE: only treat the cluster's PROVIDED marker genes (the UP- and DOWN-regulated lists below) as this cluster's markers. Do NOT introduce other genes (e.g. tfec, nme4, mpeg1.1) as if they were markers of this cluster. You MAY mention a canonical marker for comparison, but you must explicitly say it is NOT in this cluster's marker list and that its expression here is unverified (the Archivist can check it).",
    "- Use the (identity, state) model: state ∈ {progenitor, cycling, quiescent, mature, stress} only when supported.",
    "- If ambiguous, say so and abstain rather than force-fit.",
    "",
    "USE THE DOWN-REGULATED GENES: the cluster's DOWN-regulated genes (significantly DEPLETED here vs the rest of the atlas) are listed below and are real evidence — research them too. A gene that is normally a strong marker of cell-type X being depleted here is positive evidence the cluster is NOT X (or is a different lineage/state). When a down-regulated gene is diagnostic — it rules a candidate OUT, or its absence is itself characteristic — look it up (ZFIN/ZFA/GO), say so in a `## Evidence` bullet, and include it in the kasperov-markers block with a NEGATIVE l2fc (or dir implied by depletion) and a ≤8-word note, so it annotates the Down-regulated panel. Don't force it — only when genuinely informative.",
    "",
    "SCOPE: if the question is a narrow follow-up (map a locus to Ensembl/UniProt, find a synonym, confirm one specific annotation), answer exactly that and skip the identity call + Verdict. Give the full identity call + Verdict ONLY when actually asked to identify the cluster.",
    "",
    "OUTPUT (for an identity request) — skimmable, sectioned markdown, **220 words max**, no preamble:",
    "- One bold one-line identity call (no heading).",
    "- `## Evidence` — one bullet per key marker (up OR informative down): the gene in bold, an em-dash, the finding, then a markdown link to the record. Example: `**gata1a** — erythroid master TF, depleted here → not erythroid [record](https://zfin.org/...)`. Do NOT prefix the source name (ZFIN/ZFA/GO/NCBI/UniProt) — the UI tags it automatically from the link, so writing it again is redundant.",
    "- `## Caveats` — only if genuinely ambiguous; 1–2 short bullets.",
    "- Final line: `**Verdict:** <name>[, <state>] — confidence <low|medium|high>`.",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top UP-regulated markers: ${up || "(none provided)"}.`,
    down ? `Top DOWN-regulated (depleted) genes: ${down}.` : "",
  ].join("\n") + MARKER_BLOCK_INSTR;
}

function reasonInstructions(cluster: Cluster, ds: DatasetCfg): string {
  const up = (cluster.degsUp ?? []).join(", ");
  const down = (cluster.markersDown ?? []).slice(0, 8).map((m) => m.g).join(", ");
  return [
    "You are the assistant in REASONER mode — a generalist scientific thinker. You synthesize across everything available: the cluster's markers, the conversation so far, and your own biological knowledge. You do NOT have web search here and you are NOT restricted to raw dataset values — you reason and explain.",
    PERSONAS_CONTEXT,
    "",
    "STYLE: Write clean, well-formed prose — complete sentences with normal capitalization, punctuation, and grammar, like a thoughtful colleague. Keep it concise (~150 words). When you list things, use proper markdown bullets (each line starting with '- '), never bare line breaks or dumped gene lists. Don't over-structure or add headings. Be clear you are reasoning/synthesising, not quoting curated records or dataset values.",
    "",
    `SCOPE: You work purely with this dataset and the two in-app tools (Researcher = ZFIN/ZFA/GO; Archivist = raw ${ds.name} values incl. p-values, specificity, co-expression). NEVER mention laboratory, bench, wet-lab, experiments, or their absence — it is irrelevant here. Do not write phrases like 'non-wet-lab', 'no bench work', or suggest the curator run code/Seurat/Scanpy themselves. The two personalities do all the work.`,
    "",
    "USE THE ARCHIVIST — don't lean only on the Researcher. The Researcher gives LITERATURE; the Archivist gives this cluster's GROUND-TRUTH NUMBERS (exact log2FC, %in/out, BH-adjusted p-values, cross-cluster specificity, cell-level co-expression). At least ONCE per cluster, before you conclude, you should have the Archivist confirm the raw stats / specificity of the top cited markers — and pull the DEG scores of any 'also-discussed' genes whose numbers could matter (is a discussed gene actually enriched here? how specific?). If the Archivist hasn't run yet for this cluster, your next dispatch should usually include it. Bias toward an Archivist check whenever raw numbers would strengthen, calibrate, or overturn the call — which is more often than not. (Skip it only if the Archivist already supplied the relevant stats this cluster.)",
    "",
    "KNOW WHEN IT'S DONE — this is critical. Before proposing ANY follow-up query, check the conversation: if that lookup has already been answered, DO NOT propose it again (re-dispatching answered queries is the #1 failure here). When the evidence has converged — strong, consistent, statistically significant markers all pointing one way — AND the Archivist has confirmed the key raw stats at least once — SAY the call is settled and that further queries won't change it. Do NOT manufacture 'next steps' to chase a higher confidence number; confidence is not a quota to maximise. If the curator asks 'are we done / have we exhausted them', answer directly: say YES and summarise the conclusion when the identity is well-supported and only minor, non-decisive curation gaps remain (e.g. an uncurated si:… locus). Only say no when there is a SPECIFIC, not-yet-asked query that could actually change the answer.",
    "",
    "NEXT-STEP BUTTONS: ONLY when a genuinely NEW query (not already answered) could change the interpretation, write the ready-to-send prompt(s) and append, at the very END, a fenced dispatch block — they render as one-click send buttons. When in doubt about whether to dispatch the Researcher or the Archivist, prefer the Archivist if its raw stats for this cluster haven't been pulled yet:",
    "```kasperov-dispatch",
    '[{"to":"researcher","prompt":"<full self-contained prompt>"},{"to":"archivist","prompt":"<full self-contained prompt>"}]',
    "```",
    "Include one object per personality (MAX 2). Each prompt must be self-contained — name the cluster and exact genes/terms — and must NOT duplicate a query already run. When the answer is settled or no new query would change it, emit NO block and just give the conclusion.",
    "",
    "PROMOTE A MARKER: when the evidence now clearly establishes that a specific gene (currently only 'also-discussed') is genuinely an UP- or DOWN-regulated marker of THIS cluster, append a fenced block — it surfaces a one-click button that lifts the gene into the Top Markers up/down list:",
    "```kasperov-promote",
    '[{"gene":"GENE","dir":"up"|"down","note":"<≤8 words why>"}]',
    "```",
    "Only promote when the evidence (stats or curated annotation) supports it; omit otherwise.",
    "",
    "CONCLUDE: when the Researcher and Archivist are genuinely exhausted for this cluster and the identity is settled, END your message with a fenced block stating the final call — it lets the curator (or the auto-pilot) accept it and move on:",
    "```kasperov-conclude",
    '{"identity":"<deepest defensible zebrafish cell-type or anatomy name>","tier":"<germ layer|tissue|cell type>","state":"<progenitor|cycling|quiescent|mature|stress|none>","cited_markers":["<gene from THIS cluster\'s marker list>"],"decision":"<assign|abstain>","confidence":<0-100>,"done":true}',
    "```",
    "REQUIRE-EVIDENCE-TO-NAME (enforced): cited_markers MUST be genes drawn from THIS cluster's marker list (its up-regulated markers, or genes promoted into the panel) — never a gene you merely know is canonical but that isn't in this cluster's list. A decision of \"assign\" must cite at least one such marker. If you cannot ground a specific cell type in this cluster's own markers plus a looked-up ZFIN/ZFA/GO fact, set decision \"abstain\" and ROLL UP: put the deepest tier you CAN defend (e.g. a germ layer or tissue) in identity, with state \"none\". State applies ONLY at the cell-type tier; use \"none\" at coarser tiers.",
    "Emit the block ONLY when settled. If a useful query remains, dispatch that instead and do NOT conclude. You may include a one-line wrap-up sentence before the block.",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top up-regulated markers: ${up || "(none provided)"}.`,
    down ? `Notable DOWN-regulated genes (depleted vs the rest of the atlas): ${down}. When any of these is informative (it argues AGAINST a candidate identity, or its absence is itself diagnostic), say so briefly and include it in the kasperov-markers block with a ≤8-word note so it annotates the Down-regulated panel.` : "",
  ].join("\n") + MARKER_BLOCK_INSTR;
}

function archivistInstructions(cluster: Cluster, ds: DatasetCfg): string {
  return [
    `You are the assistant in ARCHIVIST mode — a raw-data archivist for the ${ds.name} single-cell dataset.`,
    PERSONAS_CONTEXT,
    `Answer ONLY from the ${ds.name} facts provided below. Do NOT use web search or outside knowledge for any factual claim. If the user asks for something not in these facts, say plainly: "That isn't in the ${ds.name} export."`,
    "",
    "The facts below are the HEADLINE markers + counts. For anything deeper — a specific gene's stats, more markers than shown, a substring gene search, or expression thresholds — call the query_dataset tool, which reads the FULL per-cluster gene profile (≈20k detected genes). NEVER tell the user data is unavailable without first querying the tool. Quote returned numbers exactly.",
    "ABSOLUTE RULE — NO FABRICATION: every number you report MUST come from a query_dataset call you make in THIS turn. NEVER reproduce values from earlier in the conversation, NEVER estimate, NEVER give 'plausible', 'proxy', 'expected', or qualitative-significance numbers, and NEVER write 'I can't query this turn' / 'I can't fetch' — you always have the tool, so call it. If you have not called the tool, you have no numbers to report.",
    "USE kind='fullstats' WITH THE GENE LIST for any question asking for stats / p-values / mean expression of specific genes — ONE call returns log2FC, %in/out, BH-adjusted p-value, and mean normalised expression for every gene. Do NOT combine pvalues+specificity and do NOT loop 'across' over a list. (Other kinds: top = top-N markers; specificity/across = cross-cluster; coexpress = cell-level co-expression.)",
    "ALWAYS report whatever your tool call returned — if it returned values, present them. NEVER say a field is 'not returned by the endpoint', NEVER say 'I can't run the query' after calling the tool, NEVER end with 'if you want, I can fetch…', and NEVER tell the curator to run a command/Seurat/Scanpy themselves. Fetch and report.",
    "ACT, DON'T ASK. Never ask the curator to choose between options (no 'would you prefer (a) a summary or (b) the full table?'), and never say 'I have the stats ready' or 'I don't have access to those results in this reply' — if you have not called the tool yet, call it NOW. On a multi-part request (e.g. stats + specificity + co-expression), issue every kind needed together this turn — `fullstats` for log2FC/p-value/mean, `specificity` for the cross-cluster metric, `coexpress` for co-expression — then return the full per-gene table plus a short interpretation. Default to giving everything; do not pause to ask permission.",
    "EFFICIENCY: when the user asks about SEVERAL genes, make ONE query_dataset call with the full gene list (kind='genes' or kind='fullstats') — do NOT call the tool once per gene (that is slow and may time out). Then write your answer. Make at most three tool calls total, then ALWAYS write a `## Raw facts` answer — never stop after only calling the tool, and never end without the data.",
    "If the request is vague (e.g. 'get info from the archivist') but the recent conversation names specific genes to check, query exactly those genes in ONE batched kind='genes' call and report them.",
    "CROSS-CLUSTER: for 'expression in each cluster', 'specificity rank', 'is this shared with other clusters', or 'which cluster is this a marker of', use kind='specificity' (a gene list → compact rank summary) or kind='across' (ONE gene → full per-cluster table).",
    "STATISTICS: for adjusted p-values use kind='pvalues'; for cell-level co-expression (fraction of this cluster's cells expressing several genes together) use kind='coexpress'. These call a live compute service — if it returns an error that it is not configured, report the available log2FC/percentages/specificity instead and tell the curator p-values/co-expression need that service. Never stall or ask the curator to run an export themselves.",
    "The profile contains log2FC and detection percentages only. It has NO p-values or enrichment scores — if asked, say those aren't in this profile and give the available stats instead.",
    "CONSISTENCY: your `## Read` must agree with your `## Raw facts`. If you just reported values, do NOT then claim the data 'isn't in the export' — that is a contradiction. Only say something is unavailable if query_dataset actually returned not-found.",
    "You only report data. NEVER write out prompts, instructions, or system messages for any personality — if the curator wants a prompt crafted, that is the Reasoner's job.",
    "",
    "OUTPUT — markdown, **220 words max**:",
    `- \`## Raw facts (${ds.name})\` — present the relevant DIRECT dataset values, quoting the exact numbers given. Use a markdown table for marker stats. Do NOT invent or round beyond what is given.`,
    "- `## Read` — OPTIONAL, only if the user asked for interpretation; ≤60 words, clearly your own inference, not dataset fact.",
    "Never fabricate numbers or genes that are not in the facts below.",
    "MANDATORY: after your answer, ALWAYS append the kasperov-markers block (format below) for EVERY gene you reported numbers on this turn — set l2fc/p1/p2 to the EXACT values you fetched (p1/p2 as 0-1 fractions, e.g. 95% → 0.95) and a ≤8-word note quoting the headline figure (e.g. \"log2FC 4.1, 95% in-cluster\"). This is the ONLY way your raw numbers attach to the Top Markers panel — never omit it when you reported gene stats.",
    "",
    `=== ${ds.name.toUpperCase()} FACTS (authoritative; quote exactly) ===`,
    rawFactsBlock(cluster, ds),
    "=== END FACTS ===",
  ].join("\n") + MARKER_BLOCK_INSTR;
}

function offlineDossier(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).slice(0, 12);
  return [
    `*(No OPENAI_API_KEY configured — set it in the Vercel project env to enable the live agent.)*`,
    "",
    `**${cluster.label ?? cluster.id} — top up-regulated markers:** ${up.join(", ") || "—"}`,
  ].join("\n");
}

function sse(controller: ReadableStreamDefaultController, enc: TextEncoder, obj: unknown) {
  controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
}

// --- query_dataset: the Archivist's live tool over each cluster's FULL profile ---
const QUERY_TOOL = {
  type: "function",
  name: "query_dataset",
  description:
    "Query the active single-cell dataset for THIS cluster. kinds: fullstats = log2FC + %in/out + BH-adjusted p-value + mean normalised expression for a gene LIST, all in ONE call (USE THIS for any 'stats / p-value / mean expression' question about specific genes); gene/genes = log2FC + %in/out only; top = top-N up/down markers; search = substring gene match; across = ONE gene's mean + %expressing in EVERY cluster + specificity rank; specificity = cross-cluster specificity summary for a LIST; pvalues = adjusted p-values for a list; coexpress = cell-level fraction of cells co-expressing ALL listed genes. Never say data is unavailable — query it.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["fullstats", "gene", "genes", "top", "search", "across", "specificity", "pvalues", "coexpress"], description: "fullstats = log2FC+%in/out+padj+mean for a gene list (one call); gene/genes = log2FC+%in/out; top = top-N; search = substring; across = one gene across clusters; specificity = cross-cluster summary for a list; pvalues = adjusted p-values; coexpress = cell-level co-expression" },
      gene: { type: "string", description: "gene for kind=gene or kind=across" },
      genes: { type: "array", items: { type: "string" }, description: "gene list for kind=genes or kind=specificity (up to 40)" },
      direction: { type: "string", enum: ["up", "down"], description: "for kind=top" },
      n: { type: "integer", description: "how many rows for kind=top (max 50)" },
      query: { type: "string", description: "substring for kind=search" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
};

type Profile = { id: string; nCells: number; datasetCells: number; nGenes: number; genes: StatMarker[] };
const profileCache = new Map<string, Profile | null>(); // keyed by `${ds.id}:${clusterId}`
async function getProfile(clusterId: string, _origin: string, ds: DatasetCfg): Promise<Profile | null> {
  const key = `${ds.id}:${clusterId}`;
  if (profileCache.has(key)) return profileCache.get(key)!;
  let prof: Profile | null = null;
  // read off disk (server-side); the gated asset route is for the browser only
  if (/^[A-Za-z0-9._-]+$/.test(clusterId)) {
    try {
      prof = JSON.parse(await readFile(path.join(DATA_DIR, ds.dataDir, "archivist", `${clusterId}.json`), "utf8")) as Profile;
    } catch {}
  }
  profileCache.set(key, prof);
  return prof;
}

// gene × cluster matrix (mean + pct per cluster) for cross-cluster / specificity queries
type GeneMatrix = { clusters: string[]; clusterSizes: number[]; datasetCells: number; nGenes: number; genes: Record<string, { m: number[]; p: number[] }> };
const matrixCache = new Map<string, GeneMatrix | null>(); // keyed by ds.id
async function getMatrix(_origin: string, ds: DatasetCfg): Promise<GeneMatrix | null> {
  if (matrixCache.has(ds.id)) return matrixCache.get(ds.id)!;
  let mx: GeneMatrix | null = null;
  try {
    mx = JSON.parse(await readFile(path.join(DATA_DIR, ds.dataDir, "archivist", "gene_matrix.json"), "utf8")) as GeneMatrix;
  } catch {}
  matrixCache.set(ds.id, mx);
  return mx;
}
// Live MiniFin compute service (p-values + cell-level co-expression). Optional:
// set MINIFIN_SERVICE_URL (+ MINIFIN_SERVICE_TOKEN) to enable; otherwise these
// kinds degrade gracefully.
const SERVICE_URL = (process.env.MINIFIN_SERVICE_URL || "").replace(/\/$/, "");
const SERVICE_TOKEN = process.env.MINIFIN_SERVICE_TOKEN || "";
// The live p-value/co-expression compute service backs ONE dataset (MiniFin by
// default). Guard so a MegaFin/ZSCAPE run never receives the wrong dataset's
// real-looking numbers; the anti-fabrication rule can't catch that (numbers are
// genuine, just from the wrong dataset).
const SERVICE_DATASET = (process.env.STATS_SERVICE_DATASET || "minifin").toLowerCase();
async function callService(kind: string, clusterId: string, genes: string[], ds: DatasetCfg): Promise<any> {
  if (!SERVICE_URL)
    return { error: "the live stats service (p-values / co-expression) is not configured for this deployment — report log2FC, percentages and specificity instead, and tell the curator p-values/co-expression need that service." };
  if (ds.id.toLowerCase() !== SERVICE_DATASET)
    return { error: `the live stats service (p-values / co-expression) is configured for the '${SERVICE_DATASET}' dataset only, not ${ds.name} — report ${ds.name}'s log2FC, percentages and specificity from the profile instead, and tell the curator p-values/co-expression aren't available for ${ds.name}.` };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 35000);
    const r = await fetch(`${SERVICE_URL}/query`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-token": SERVICE_TOKEN },
      body: JSON.stringify({ dataset: ds.id, kind, cluster: String(clusterId), genes }),
    });
    clearTimeout(t);
    if (!r.ok) return { error: `stats service returned ${r.status}` };
    return await r.json();
  } catch {
    return { error: "stats service unreachable" };
  }
}

async function runQuery(argsStr: string, clusterId: string, origin: string, ds: DatasetCfg): Promise<any> {
  let a: any = {};
  try {
    a = JSON.parse(argsStr || "{}");
  } catch {}

  // p-values + cell-level co-expression are served by the live compute service
  if (a.kind === "pvalues" || a.kind === "coexpress") {
    const genes = Array.isArray(a.genes) ? a.genes.slice(0, 60) : a.gene ? [a.gene] : [];
    return await callService(a.kind, String(clusterId), genes, ds);
  }

  // fullstats: everything for a gene list in ONE call — log2FC + %in/out + padj + mean
  if (a.kind === "fullstats") {
    const genes = Array.isArray(a.genes) ? a.genes.slice(0, 40) : a.gene ? [a.gene] : [];
    const mx = await getMatrix(origin, ds);
    const ai = mx ? mx.clusters.indexOf(String(clusterId)) : -1;
    const meanOf = (g: string) => {
      const row = mx?.genes[g.toLowerCase()];
      return row && ai >= 0 ? row.m[ai] : null;
    };
    if (SERVICE_URL) {
      const pv = await callService("pvalues", String(clusterId), genes, ds);
      if (pv && Array.isArray(pv.result)) {
        const result = pv.result.map((r: any) => ({ ...r, mean: r.found ? meanOf(r.g) : null }));
        return { cluster: clusterId, nCells: pv.nCells, result, note: "log2FC + %in/out + BH-adjusted p-value + mean normalised expression (CP10K) — complete; nothing further to fetch." };
      }
    }
    // fallback (no live service): mean + %in from the matrix, no p-values
    const result = genes.map((g: string) => {
      const row = mx?.genes[g.toLowerCase()];
      return row && ai >= 0 ? { g, found: true, mean: row.m[ai], pct_in: row.p[ai] } : { g, found: false };
    });
    return { cluster: clusterId, result, note: "mean + %in from the matrix; p-values require the live stats service (not configured)." };
  }

  // cross-cluster / specificity kinds use the gene × cluster matrix
  if (a.kind === "across" || a.kind === "specificity") {
    const mx = await getMatrix(origin, ds);
    if (!mx) return { error: "gene matrix unavailable" };
    const ai = mx.clusters.indexOf(String(clusterId));
    const ctx = { cluster: clusterId, nCells: ai >= 0 ? mx.clusterSizes[ai] : null, datasetCells: mx.datasetCells, note: "mean = normalised mean expression (CP10K); pct = fraction of cells expressing. No p-values in this export." };
    if (a.kind === "across") {
      const row = mx.genes[String(a.gene ?? "").toLowerCase()];
      if (!row) return { ...ctx, query: a, result: { g: a.gene, found: false } };
      const table = mx.clusters.map((c, i) => ({ cluster: c, mean: row.m[i], pct: row.p[i] }));
      const sorted = [...table].sort((x, y) => y.mean - x.mean);
      return { ...ctx, query: a, result: { g: a.gene, found: true, rankOfActiveByMean: sorted.findIndex((t) => t.cluster === String(clusterId)) + 1, ofClusters: mx.clusters.length, topClusters: sorted.slice(0, 6), perCluster: table } };
    }
    // specificity: compact rank summary for a list of genes
    const list = Array.isArray(a.genes) ? a.genes.slice(0, 40) : a.gene ? [a.gene] : [];
    const result = list.map((name: string) => {
      const row = mx.genes[String(name).toLowerCase()];
      if (!row) return { g: name, found: false };
      const idx = mx.clusters.map((_c, i) => i).sort((x, y) => row.m[y] - row.m[x]);
      const rank = idx.indexOf(ai) + 1;
      const top = idx.slice(0, 3).map((i) => ({ cluster: mx.clusters[i], mean: row.m[i], pct: row.p[i] }));
      return {
        g: name,
        found: true,
        activeMean: ai >= 0 ? row.m[ai] : null,
        activePct: ai >= 0 ? row.p[ai] : null,
        rankOfActiveByMean: rank,
        ofClusters: mx.clusters.length,
        topClusters: top,
        clustersExpressedAtLeast10pct: row.p.filter((v) => v >= 0.1).length,
      };
    });
    return { ...ctx, query: a, result };
  }

  const p = await getProfile(clusterId, origin, ds);
  if (!p) return { error: "profile unavailable for this cluster" };
  const ctx = { cluster: clusterId, nCells: p.nCells, datasetCells: p.datasetCells, genesProfiled: p.nGenes };
  const lookup = (name: string) => {
    const g = String(name).toLowerCase();
    const hit = p.genes.find((m) => m.g.toLowerCase() === g) || p.genes.find((m) => m.g.toLowerCase().includes(g));
    return hit ? { ...hit, found: true } : { g: String(name), found: false };
  };
  if (a.kind === "gene") {
    return { ...ctx, query: a, result: lookup(a.gene ?? "") };
  }
  if (a.kind === "genes") {
    const list = Array.isArray(a.genes) ? a.genes.slice(0, 40) : [];
    return { ...ctx, query: a, result: list.map(lookup) };
  }
  if (a.kind === "top") {
    const n = Math.max(1, Math.min(50, Number(a.n ?? 10)));
    const dir = a.direction === "down" ? "down" : "up";
    const rows = dir === "up" ? p.genes.slice(0, n) : p.genes.slice(-n).reverse();
    return { ...ctx, query: a, result: rows };
  }
  if (a.kind === "search") {
    const q = String(a.query ?? "").toLowerCase();
    return { ...ctx, query: a, result: p.genes.filter((m) => m.g.toLowerCase().includes(q)).slice(0, 25) };
  }
  return { ...ctx, error: "unknown kind" };
}

// Stream one OpenAI Responses turn; forward text/thinking/status; collect any
// function calls + the response id (for continuation).
async function streamOnce(
  payload: any,
  controller: ReadableStreamDefaultController,
  enc: TextEncoder,
  key: string,
  signal: AbortSignal
): Promise<{ responseId: string; calls: { call_id: string; name: string; args: string }[]; produced: boolean; ok: boolean; usageIn: number; usageOut: number; text: string }> {
  const calls: { call_id: string; name: string; args: string }[] = [];
  let responseId = "";
  let produced = false;
  let producedText = "";
  let usageIn = 0;
  let usageOut = 0;
  // retry once on a transient upstream (429 / 5xx) before giving up
  let r: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok && r.body) break;
    if (attempt === 0 && (r.status === 429 || r.status >= 500)) {
      sse(controller, enc, { t: "status", v: "Upstream busy — retrying…" });
      await new Promise((res) => setTimeout(res, 900));
      continue;
    }
    break;
  }
  if (!r || !r.ok || !r.body) {
    const detail = r ? await r.text().catch(() => "") : "no response";
    sse(controller, enc, { t: "text", v: `_The agent could not start (${r?.status ?? "?"}). ${detail.slice(0, 160)}_` });
    return { responseId, calls, produced, ok: false, usageIn, usageOut, text: producedText };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // reasoning-summary formatting: the model emits the trace as discrete "parts"
  // (each a short title line + body) with NO separator between them, so they run
  // together ("…information.Searching genetics…"). Insert a blank line between
  // parts, and end each part's title line with an ellipsis on its own line.
  let anyReasoning = false; // have we emitted any reasoning text yet this stream?
  let titleDone = false; // has the current part's title line been closed?
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const ps = line.slice(5).trim();
      if (ps === "[DONE]") continue;
      let evt: any;
      try {
        evt = JSON.parse(ps);
      } catch {
        continue;
      }
      if (evt.response?.id) responseId = evt.response.id;
      if (evt.response?.usage) {
        usageIn = evt.response.usage.input_tokens ?? usageIn;
        usageOut = evt.response.usage.output_tokens ?? usageOut;
      }
      switch (evt.type) {
        case "response.reasoning_summary_part.added":
          // a new reasoning section begins — separate it from the previous one
          if (anyReasoning) sse(controller, enc, { t: "thinking", v: "\n\n" });
          titleDone = false;
          break;
        case "response.reasoning_summary_text.delta":
          if (evt.delta) {
            anyReasoning = true;
            let v: string = evt.delta;
            // the first newline of a part closes its title line → end it with "…"
            if (!titleDone) {
              const nl = v.indexOf("\n");
              if (nl >= 0) {
                v = v.slice(0, nl) + "…" + v.slice(nl);
                titleDone = true;
              }
            }
            sse(controller, enc, { t: "thinking", v });
          }
          break;
        case "response.output_text.delta":
          if (evt.delta) {
            produced = true;
            producedText += evt.delta;
            sse(controller, enc, { t: "text", v: evt.delta });
          }
          break;
        case "response.web_search_call.in_progress":
          sse(controller, enc, { t: "status", v: "Searching ZFIN / ZFA / GO…" });
          break;
        case "response.web_search_call.completed":
          sse(controller, enc, { t: "status", v: "Reading results…" });
          break;
        case "response.output_item.done": {
          const it = evt.item;
          if (it?.type === "web_search_call" && it?.action?.query) sse(controller, enc, { t: "status", v: `Searched: “${String(it.action.query).slice(0, 80)}”` });
          if (it?.type === "function_call" && it?.call_id) calls.push({ call_id: it.call_id, name: it.name, args: it.arguments ?? "{}" });
          break;
        }
        case "response.failed":
        case "response.error":
        case "error": {
          const msg = evt.response?.error?.message ?? evt.error?.message ?? evt.message ?? "stream error";
          sse(controller, enc, { t: "text", v: `\n\n_Agent error: ${String(msg).slice(0, 200)}_` });
          break;
        }
      }
    }
  }
  return { responseId, calls, produced, ok: true, usageIn, usageOut, text: producedText };
}

// Pull per-gene stats out of a query_dataset result so the Archivist's REAL
// numbers can be attached to Top Markers server-side — after a multi-round tool
// loop the model usually forgets the kasperov-markers block, so we synthesise it.
const numOrU = (v: any): number | undefined => (typeof v === "number" && isFinite(v) ? v : undefined);
function collectStats(out: any, map: Map<string, StatMarker>) {
  if (!out) return;
  const rows = Array.isArray(out.result) ? out.result : out.result ? [out.result] : [];
  for (const r of rows) {
    if (!r || r.found === false || typeof r.g !== "string") continue;
    const l2fc = numOrU(r.l2fc ?? r.log2FC ?? r.log2fc);
    const p1 = numOrU(r.p1 ?? r.pct_in ?? r.activePct ?? r.pct);
    const p2 = numOrU(r.p2 ?? r.pct_out);
    if (l2fc == null && p1 == null && p2 == null) continue;
    const ex = map.get(r.g.toLowerCase());
    map.set(r.g.toLowerCase(), { g: ex?.g ?? r.g, l2fc: l2fc ?? ex?.l2fc, p1: p1 ?? ex?.p1, p2: p2 ?? ex?.p2 });
  }
}
function statNote(m: StatMarker): string {
  const bits: string[] = [];
  if (m.l2fc != null) bits.push(`log2FC ${m.l2fc.toFixed(1)}`);
  if (m.p1 != null) bits.push(`${Math.round(m.p1 * 100)}% in-cluster`);
  return bits.join(", ") || "queried from dataset";
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const ds = dsOf(body?.dataset);
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  const cluster: Cluster = body?.cluster ?? { id: String(body?.clusterId ?? "?") };
  const messages: ChatMessage[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
        .slice(-12)
    : [];
  if (messages.length === 0) return new Response("no messages", { status: 400 });

  const isFirst = messages.filter((m) => m.role === "user").length <= 1;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const mode: Mode =
    body?.mode === "research" || body?.mode === "archivist" || body?.mode === "reason" ? body.mode : classifyMode(lastUser, isFirst);

  const key = process.env.OPENAI_API_KEY;
  const enc = new TextEncoder();
  const origin = new URL(req.url).origin;

  const stream = new ReadableStream({
    async start(controller) {
      const done = () => {
        sse(controller, enc, { t: "done" });
        controller.close();
      };
      sse(controller, enc, { t: "mode", v: mode });

      if (!key) {
        sse(controller, enc, { t: "text", v: offlineDossier(cluster) });
        return done();
      }

      const instructions = mode === "archivist" ? archivistInstructions(cluster, ds) : mode === "reason" ? reasonInstructions(cluster, ds) : researchInstructions(cluster);
      const tools = mode === "research" ? [{ type: "web_search", filters: { allowed_domains: ALLOWED_DOMAINS } }] : mode === "archivist" ? [QUERY_TOOL] : undefined;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 295000);
      let usageIn = 0;
      let usageOut = 0;
      let anyProduced = false;
      let allText = ""; // accumulated answer text (to detect a model-emitted block)
      const archivistStats = new Map<string, StatMarker>(); // real per-gene tool stats
      try {
        let prevId = "";
        let nextInput: any = messages.map((m) => ({ role: m.role, content: m.content }));
        let toolRounds = 0;
        const MAX_TOOL_ROUNDS = 3;
        for (let iter = 0; iter < 5; iter++) {
          // after the tool-round budget, force a written answer (no more tool calls)
          const forceAnswer = mode === "archivist" && toolRounds >= MAX_TOOL_ROUNDS;
          const payload: any = {
            model,
            stream: true,
            store: true,
            // "low" is the only effort the whole gpt-5 series accepts — gpt-5.1+
            // reject "minimal" with a 400 (would break archivist on those models).
            reasoning: { effort: "low", summary: "auto" },
            max_output_tokens: 9000,
            input: nextInput,
            ...(prevId ? { previous_response_id: prevId } : { instructions }),
            ...(tools ? { tools } : {}),
            ...(forceAnswer ? { tool_choice: "none" } : {}),
          };
          const res = await streamOnce(payload, controller, enc, key, ctrl.signal);
          usageIn += res.usageIn;
          usageOut += res.usageOut;
          anyProduced = anyProduced || res.produced;
          allText += res.text;
          if (!res.ok) break;
          // Archivist tool loop: execute query_dataset calls, then continue.
          if (mode === "archivist" && res.calls.length && toolRounds < MAX_TOOL_ROUNDS) {
            toolRounds++;
            const outputs: any[] = [];
            for (const c of res.calls) {
              let label = ds.name;
              try {
                const a = JSON.parse(c.args || "{}");
                label =
                  a.kind === "fullstats" ? `full stats for ${(a.genes ?? []).length} genes`
                  : a.kind === "gene" ? `gene ${a.gene}`
                  : a.kind === "genes" ? `${(a.genes ?? []).length} genes`
                  : a.kind === "top" ? `top ${a.n ?? ""} ${a.direction ?? "up"}`
                  : a.kind === "search" ? `search “${a.query}”`
                  : a.kind === "across" ? `${a.gene} across clusters`
                  : a.kind === "specificity" ? `specificity of ${(a.genes ?? []).length} genes`
                  : a.kind === "pvalues" ? `p-values for ${(a.genes ?? []).length} genes`
                  : a.kind === "coexpress" ? `co-expression of ${(a.genes ?? []).length} genes`
                  : ds.name;
              } catch {}
              sse(controller, enc, { t: "status", v: `Querying ${ds.name}: ${label}…` });
              const out = await runQuery(c.args, String(cluster.id), origin, ds);
              collectStats(out, archivistStats); // keep the real numbers for the Top Markers block
              outputs.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(out) });
            }
            prevId = res.responseId;
            nextInput = outputs;
            continue;
          }
          break;
        }
        if (!anyProduced)
          sse(controller, enc, { t: "text", v: `_(No answer from **${model}** — it likely spent its budget on reasoning/search without writing. Try again, or pick a faster model (gpt-5-mini / gpt-5) for the interactive wizard.)_` });
        // Archivist: if it reported gene stats but omitted the markers block,
        // synthesise one from the REAL tool numbers so they attach to Top Markers.
        if (mode === "archivist" && archivistStats.size && !allText.includes("kasperov-markers")) {
          const arr = Array.from(archivistStats.values()).slice(0, 12).map((m) => ({ g: m.g, l2fc: m.l2fc ?? null, p1: m.p1 ?? null, p2: m.p2 ?? null, note: statNote(m) }));
          sse(controller, enc, { t: "text", v: "\n\n```kasperov-markers\n" + JSON.stringify(arr) + "\n```" });
        }
        sse(controller, enc, { t: "usage", v: { model, in: usageIn, out: usageOut } });
        done();
      } catch {
        if (!anyProduced)
          sse(controller, enc, { t: "text", v: `_(**${model}** didn't respond within the request time limit — heavier models (gpt-5.4 / gpt-5.5) can time out, especially on Vercel Hobby's 60s cap. Use gpt-5-mini or gpt-5 here, or the persistent server auto-pilot.)_` });
        else sse(controller, enc, { t: "status", v: "Agent stopped (time limit) — partial result above." });
        sse(controller, enc, { t: "usage", v: { model, in: usageIn, out: usageOut } });
        done();
      } finally {
        clearTimeout(timer);
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
