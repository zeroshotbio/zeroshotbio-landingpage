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
export const runtime = "nodejs";
// Wizard assets (profiles + gene matrix) are served statically by nginx from
// daniotype_data/ — NOT bundled into the Vercel function (that exceeded the 250MB
// serverless cap). These routes fetch them over HTTP so the bundle stays slim.
const ASSET_HOST = (process.env.DANIOTYPE_ASSET_BASE || "https://zscape.zeroshot.bio/daniotype_data").replace(/\/$/, "");
// up to 300s on Vercel Pro (heavy models need it); silently capped at 60s on Hobby.
export const maxDuration = 300;

// Server-side richer per-dataset extract the Archivist queries (full up +
// computed down markers + dataset cell counts per cluster). Bundled at build.
import MINIFIN_ARCHIVIST from "./minifin_archivist.json";
import ZSCAPE_ARCHIVIST from "./zscape_archivist.json";
import ZSCAPE_RECURSIVE_ARCHIVIST from "./zscape_recursive_archivist.json"; // v2 recursive per-compartment (local-HVG) partition, control-vote
import MEGAFIN_ARCHIVIST from "./megafin_rebuild_archivist.json";       // Manual (Lawson) rebuild — id "megafin"
import MEGAFIN_PARSE_ARCHIVIST from "./megafin_archivist.json";         // Parse interim — id "megafin_parse"
import CHEMFISH_ARCHIVIST from "./chemfish_archivist.json";
import DANIOCELL_ARCHIVIST from "./daniocell_archivist.json";
// NATIVE-schema re-base (staged): units = authors' finest native groups, per-group DEGs.
import ZSCAPE_NATIVE_ARCHIVIST from "./zscape_native_archivist.json";
import CHEMFISH_NATIVE_ARCHIVIST from "./chemfish_native_archivist.json";
import DANIOCELL_NATIVE_ARCHIVIST from "./daniocell_native_archivist.json";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

// One agent route serves every dataset; the body's `dataset` id selects which
// archivist extract + static-asset base + display name to use.
// dataDir = subdir under daniotype_data/ holding this dataset's profiles (read off
// disk server-side). base = the client-facing (auth-gated) asset URL, for reference.
type DatasetCfg = { id: string; name: string; base: string; dataDir: string; archivist: any };
const DATASET_CFG: Record<string, DatasetCfg> = {
  minifin: { id: "minifin", name: "MiniFin", base: "/api/kasperov_asset/minifin/archivist", dataDir: "minifin", archivist: MINIFIN_ARCHIVIST as any },
  zscape: { id: "zscape", name: "ZSCAPE", base: "/api/kasperov_asset/zscape/archivist", dataDir: "zscape", archivist: ZSCAPE_ARCHIVIST as any },
  zscape_recursive: { id: "zscape_recursive", name: "ZSCAPE (recursive)", base: "/api/kasperov_asset/zscape_recursive/archivist", dataDir: "zscape_recursive", archivist: ZSCAPE_RECURSIVE_ARCHIVIST as any },
  megafin: { id: "megafin", name: "Manual MegaFin Part 1", base: "/api/kasperov_asset/megafin_rebuild/archivist", dataDir: "megafin_rebuild", archivist: MEGAFIN_ARCHIVIST as any },
  megafin_parse: { id: "megafin_parse", name: "Parse MegaFin Part 1", base: "/api/kasperov_asset/megafin/archivist", dataDir: "megafin", archivist: MEGAFIN_PARSE_ARCHIVIST as any },
  chemfish: { id: "chemfish", name: "ChemFish", base: "/api/kasperov_asset/chemfish/archivist", dataDir: "chemfish", archivist: CHEMFISH_ARCHIVIST as any },
  daniocell: { id: "daniocell", name: "DanioCell", base: "/api/kasperov_asset/daniocell/archivist", dataDir: "daniocell", archivist: DANIOCELL_ARCHIVIST as any },
  // NATIVE-schema re-base (staged benchmark; not surfaced as wizard cards) — native units + native vocab.
  zscape_native: { id: "zscape_native", name: "ZSCAPE (native)", base: "", dataDir: "zscape_native", archivist: ZSCAPE_NATIVE_ARCHIVIST as any },
  chemfish_native: { id: "chemfish_native", name: "ChemFish (native)", base: "", dataDir: "chemfish_native", archivist: CHEMFISH_NATIVE_ARCHIVIST as any },
  daniocell_native: { id: "daniocell_native", name: "DanioCell (native)", base: "", dataDir: "daniocell_native", archivist: DANIOCELL_NATIVE_ARCHIVIST as any },
};
// Look up a dataset config. Returns undefined for an unregistered id — we deliberately do
// NOT fall back to a default dataset: a silent fallback (id -> minifin) is what served MiniFin's
// stats for ChemFish during run ba32de (chemfish absent from a stale deploy's DATASET_CFG ->
// dsOf -> minifin -> getProfile/getMatrix/:5007 all returned MiniFin's 54-cluster data). An
// unknown id must now fail loudly instead of grounding on the wrong atlas.
const dsOf = (id: unknown): DatasetCfg | undefined => DATASET_CFG[String(id)];

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
    "You are the assistant in RESEARCHER mode — a zebrafish (Danio rerio) cell-type EVIDENCE agent working with a human curator who makes the final call.",
    PERSONAS_CONTEXT,
    "Your job is EVIDENCE ONLY: for each marker gene you are given, look it up in the canonical resources (ZFIN in-vivo expression → ZFA anatomy → GO) and report which tissues / cell types it is associated with, or notably absent from. You do NOT determine the cluster's identity — assembling these per-marker facts into a cell-type call is the Reasoner's job, not yours.",
    "",
    "RULES (cite-discipline):",
    "- Use web search against the canonical resources only (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Never assert anatomy/function from unsourced memory — look it up.",
    "- BREADTH — DO NOT rely on ZFIN gene pages alone. For EACH marker, spread your searches across resources and actually run them: (1) ZFIN for in-vivo expression, (2) the GENE ONTOLOGY (geneontology.org / QuickGO, or via NCBI Gene / UniProt) for the molecular function & biological process it implicates, and (3) the ZFA anatomy term (search EBI OLS `ebi.ac.uk/ols` or ZFIN anatomy) for the tissue/structure it marks. Aim to cite ZFIN expression AND a ZFA anatomy term AND a GO term for each marker whenever they exist — evidence grounded only in ZFIN is weaker. Issue separate searches for GO and ZFA; don't assume they'll come up under a gene-page search.",
    "- Marker symbols may be human-ortholog-cased (e.g. HOXB13); map to the zebrafish gene.",
    "- CITE-DISCIPLINE: only treat the cluster's PROVIDED marker genes (the UP- and DOWN-regulated lists below) as this cluster's markers. Do NOT introduce other genes (e.g. tfec, nme4, mpeg1.1) as if they were markers of this cluster. You MAY mention a canonical marker for comparison, but you must explicitly say it is NOT in this cluster's marker list and that its expression here is unverified (the Archivist can check it).",
    "- EVIDENCE ONLY — explicitly forbidden: do NOT propose a cell-type identity, do NOT write a 'Verdict', do NOT give a confidence level, and do NOT synthesise across markers or rank candidate identities. Even if asked to 'identify the cluster', answer with per-marker evidence only and leave the call to the Reasoner. State (progenitor/cycling/quiescent/mature/stress) is part of the identity call — it is not yours to assign either.",
    "- If a marker's association is ambiguous or the records conflict, say so INLINE on that marker's bullet — report it, don't resolve it.",
    "",
    "USE THE DOWN-REGULATED GENES: the cluster's DOWN-regulated genes (significantly DEPLETED here vs the rest of the atlas) are listed below and are real evidence — research them too, just like the up-regulated ones. A gene that is normally a strong marker of cell-type X being depleted here is evidence the cluster is NOT X. When a down-regulated gene is informative — its absence is characteristic of, or argues against, a tissue — look it up (ZFIN/ZFA/GO), say so in a `## Evidence` bullet, and include it in the kasperov-markers block with a NEGATIVE l2fc (or dir implied by depletion) and a ≤8-word note, so it annotates the Down-regulated panel. Don't force it — only when genuinely informative.",
    "",
    "SCOPE: if the question is a narrow follow-up (map a locus to Ensembl/UniProt, find a synonym, confirm one specific annotation), answer exactly that. Otherwise, return the per-marker evidence report below.",
    "",
    "OUTPUT — a per-marker evidence report; skimmable, sectioned markdown, **220 words max**, no preamble. NO identity call, NO Verdict, NO confidence — evidence only:",
    "- `## Evidence` — one bullet per marker (every UP marker, plus any informative DOWN marker): the gene in bold, an em-dash, then the tissues/cell types the records associate it with (or that it is notably absent from). Cite a SEPARATE linked record for each source consulted — ZFIN expression, the ZFA anatomy term, and the GO term — whenever they exist, so all three sources are visible. Example: `**gata1a** — erythroid master TF; depleted here [record](https://zfin.org/...) [ZFA term](https://www.ebi.ac.uk/ols/...) [GO](https://...)`. Do NOT prefix the source name (ZFIN/ZFA/GO/NCBI/UniProt) in the text — the UI tags each link automatically, so writing it again is redundant.",
    "- Consult ZFA for EVERY marker (its own linked anatomy term), not just some — so anatomy coverage is consistent across the report, not skipped for convenience.",
    "- Attach any caveat INLINE to the specific bullet it qualifies (e.g. `… — uncurated locus, association tentative`). Do NOT add a separate trailing `## Caveats` section.",
    "- End there. Do not summarise, rank candidates, or name a cell type — hand the assembled evidence to the Reasoner.",
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
    "CITE ONLY CONFIRMED POSITIVES: build the identity ONLY from markers the Archivist has CONFIRMED enriched in THIS unit, plus their functional annotations. A marker the Archivist showed non-enriched or depleted is NOT evidence for an identity, however strong its literature association — drop it from the call and do NOT place it in cited_markers. cited_markers must contain ONLY Archivist-confirmed positive markers of this unit, and a 'state' (cycling/progenitor/etc.) must rest on confirmed-enriched markers too — never assert a state the stats don't support.",
    "ASSIGN AT THE DEPTH THE EVIDENCE SUPPORTS: do NOT abstain merely because the terminal (finest) subtype is unresolved. If a coarser regional / developmental / lineage identity is confidently grounded — consistent enriched markers, Archivist-confirmed, no internal contradiction — then ASSIGN at that depth: set tier to the deepest level you can defend and decision \"assign\" (state \"none\" when the terminal state is unresolved). Reserve \"abstain\" for genuinely insufficient or contradictory grounding — weak, non-specific, or conflicting markers with no coherent lineage. A confidently-grounded regional/tissue identity is an ASSIGN at that tier, not an abstain.",
    "DECLARE THE FULL STACK: this dataset is scored at four NESTED tiers — germ layer → tissue → cell type (broad) → cell type (sub). When you conclude, state the deepest call you can defend at EACH of the four tiers, each on its own line with its OWN confidence (confidence naturally falls as the tiers get finer — e.g. germ layer high, sub-type lower). Put this four-line stack in your prose immediately BEFORE the kasperov-conclude block. The block's identity/tier/confidence stay the DEEPEST tier you actually assign, and must match the corresponding line of the stack.",
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
  // fetch from nginx (daniotype_data/ served statically); kept out of the Vercel bundle
  if (/^[A-Za-z0-9._-]+$/.test(clusterId)) {
    try {
      const r = await fetch(`${ASSET_HOST}/${ds.dataDir}/archivist/${clusterId}.json`);
      if (r.ok) prof = (await r.json()) as Profile;
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
    const r = await fetch(`${ASSET_HOST}/${ds.dataDir}/archivist/gene_matrix.json`);
    if (r.ok) mx = (await r.json()) as GeneMatrix;
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
const STATS_SERVICE_DATASETS = new Set(
  (process.env.STATS_SERVICE_DATASETS || "minifin,megafin,megafin_parse,zscape,zscape_recursive,chemfish,daniocell,zscape_native,chemfish_native,daniocell_native").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean),
);
async function callService(kind: string, clusterId: string, genes: string[], ds: DatasetCfg): Promise<any> {
  if (!SERVICE_URL)
    return { error: "the live stats service (p-values / co-expression) is not configured for this deployment — report log2FC, percentages and specificity instead, and tell the curator p-values/co-expression need that service." };
  if (!STATS_SERVICE_DATASETS.has(ds.id.toLowerCase()))
    return { error: `the live stats service (p-values / co-expression) is not configured for ${ds.name} — report ${ds.name}'s log2FC, percentages and specificity from the profile instead, and tell the curator p-values/co-expression aren't available for ${ds.name}.` };
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
  if (!ds) return new Response(JSON.stringify({ error: "unknown_dataset", dataset: String(body?.dataset ?? "") }), { status: 400, headers: { "content-type": "application/json" } });
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  const cluster: Cluster = body?.cluster ?? { id: String(body?.clusterId ?? "?") };

  // ⚖️ INPUTS PREVIEW (judgement-mode "Inputs" step). Return the REAL server-side
  // system instructions + briefing assembled for THIS cluster, WITHOUT calling the
  // model — so the curator can critique everything that goes into the chat before
  // the first prompt is ever sent. Purely additive + read-only: the live run path
  // never sends action:"inputs", so this cannot affect normal labelling.
  if (body?.action === "inputs") {
    const out = {
      dataset: ds.id,
      datasetName: ds.name,
      model,
      cluster: {
        id: cluster.id,
        label: cluster.label ?? null,
        degsUp: cluster.degsUp ?? [],
        markers: cluster.markers ?? [],
        markersDown: cluster.markersDown ?? [],
        nCells: cluster.nCells ?? null,
      },
      personasContext: PERSONAS_CONTEXT,
      // the exact per-mode system prompts sent verbatim as the `instructions` field
      instructions: {
        research: researchInstructions(cluster),
        reason: reasonInstructions(cluster, ds),
        archivist: archivistInstructions(cluster, ds),
      },
      // the authoritative ground-truth facts block the Archivist quotes from
      rawFacts: rawFactsBlock(cluster, ds),
      // tools wired per mode + the model-call params actually used
      tools: {
        research: { web_search: { allowed_domains: ALLOWED_DOMAINS } },
        archivist: { tool: QUERY_TOOL.name },
        reason: null,
      },
      modelParams: { reasoning: { effort: "low", summary: "auto" }, max_output_tokens: 9000 },
      // surfaced read-only; flagged as NOT exposed:
      notExposed: "The OPENAI_API_KEY and the raw OpenAI transport/streaming are server-only and not included here. Everything above is the literal text/config sent into the chat.",
    };
    return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
  }

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
