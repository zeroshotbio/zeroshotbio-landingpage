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
export const maxDuration = 60;

// Server-side richer MiniFin extract the Archivist queries (full up + computed
// down markers + dataset cell counts per cluster). Bundled at build.
import ARCHIVIST_DATA from "./minifin_archivist.json";

const MODEL = process.env.KASPEROV_OPENAI_MODEL || "gpt-5-mini";

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
type Cluster = { id: string; label?: string; degsUp?: string[]; markers?: Marker[]; nCells?: number };

// --- mode routing (3-way) --------------------------------------------------
// 1) explicit personality address wins; 2) strong intent verbs; 3) keyword cues.
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
  "CONTEXT — this tool has three GPT-5-Mini personalities the curator talks to inside THIS chat: " +
  "the Researcher (restricted web search over ZFIN/ZFA/GO, cites records), " +
  "the Archivist (answers only from the raw MiniFin dataset values), and " +
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
function rawFactsBlock(cluster: Cluster): string {
  const data: any = ARCHIVIST_DATA as any;
  const rec = data?.clusters?.[String(cluster.id)];
  if (rec) {
    const up: StatMarker[] = rec.up ?? [];
    const down: StatMarker[] = rec.down ?? [];
    return [
      `Cluster: ${cluster.label ?? cluster.id}`,
      `Cells in this cluster: ${rec.nCells}. Total cells in the MiniFin dataset: ${data.datasetCells}.`,
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
  return [
    "You are GPT-5-Mini in RESEARCHER mode — a zebrafish (Danio rerio) cell-type annotation research agent working with a human curator who makes the final call.",
    PERSONAS_CONTEXT,
    "Determine the most defensible cell-type identity by grounding it in canonical evidence: markers → in-vivo expression (ZFIN) → ZFA anatomy → cell type, corroborated by GO.",
    "",
    "RULES (cite-discipline):",
    "- Use web search against the canonical resources only (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Never assert anatomy/function from unsourced memory — look it up.",
    "- Marker symbols may be human-ortholog-cased (e.g. HOXB13); map to the zebrafish gene.",
    "- CITE-DISCIPLINE: only treat the cluster's PROVIDED marker genes (listed below) as this cluster's markers. Do NOT introduce other genes (e.g. tfec, nme4, mpeg1.1) as if they were markers of this cluster. You MAY mention a canonical marker for comparison, but you must explicitly say it is NOT in this cluster's marker list and that its expression here is unverified (the Archivist can check it).",
    "- Use the (identity, state) model: state ∈ {progenitor, cycling, quiescent, mature, stress} only when supported.",
    "- If ambiguous, say so and abstain rather than force-fit.",
    "- You CANNOT read raw dataset values or marker lists you weren't given (e.g. the cluster's down-regulated genes). If the curator needs those, tell them the Archivist can pull them — do NOT ask the curator to paste data.",
    "",
    "OUTPUT — skimmable, sectioned markdown, **200 words max**, no preamble:",
    "- One bold one-line identity call (no heading).",
    "- `## Evidence` — one bullet per key marker. **Begin each bullet with the source in bold caps** — one of **ZFIN**, **ZFA**, **GO**, **NCBI**, **UniProt** — then ` · ` then the gene in bold, the finding, and a markdown link to the record. Example: `**ZFIN** · **gata1a** — erythroid master TF [record](https://zfin.org/...)`.",
    "- `## Caveats` — only if genuinely ambiguous; 1–2 short bullets.",
    "- Final line: `**Verdict:** <name>[, <state>] — confidence <low|medium|high>`.",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top up-regulated markers: ${up || "(none provided)"}.`,
  ].join("\n") + MARKER_BLOCK_INSTR;
}

function reasonInstructions(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).join(", ");
  return [
    "You are GPT-5-Mini in REASONER mode — a generalist scientific thinker. You synthesize across everything available: the cluster's markers, the conversation so far, and your own biological knowledge. You do NOT have web search here and you are NOT restricted to raw dataset values — you reason and explain.",
    PERSONAS_CONTEXT,
    "",
    "STYLE: Answer in full, natural prose — normal paragraphs, like a thoughtful colleague talking. Do NOT impose headings, bullet templates, or a forced structure unless the user explicitly asks for a list. Be direct and clear; flag genuine uncertainty. Aim for ~200 words but write what the question needs.",
    "Be clear you are reasoning/synthesizing, not quoting curated records or dataset facts.",
    "",
    "HARD CONSTRAINT: You have NO laboratory. NEVER propose wet-lab or bench experiments — no animal experiments, knockdowns/knockouts, in-situ hybridisation, immunostaining, FACS, qPCR, transgenic lines, etc. If verification would help, the ONLY things you may suggest are actions possible inside this tool: ask the Archivist for specific MiniFin dataset values, or ask the Researcher to check ZFIN/ZFA/GO for a marker.",
    "",
    "PROMPT-CRAFTING: ONLY when the curator explicitly asks you to write/craft/draft a prompt for the Researcher or the Archivist, compose that prompt, explain it briefly in prose, and then append at the very END this fenced block (hidden from the user; it becomes a send button):",
    "```kasperov-dispatch",
    '{"to":"researcher"|"archivist","prompt":"<the full prompt to send>"}',
    "```",
    "Emit AT MOST ONE dispatch object. Only emit two (as a JSON array) if the curator explicitly asked you to prompt BOTH personalities. Never repeat the same prompt or emit more than two. Do not include the block at all unless a prompt was explicitly requested.",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top up-regulated markers: ${up || "(none provided)"}.`,
  ].join("\n") + MARKER_BLOCK_INSTR;
}

function archivistInstructions(cluster: Cluster): string {
  return [
    "You are GPT-5-Mini in ARCHIVIST mode — a raw-data archivist for the MiniFin single-cell dataset.",
    PERSONAS_CONTEXT,
    "Answer ONLY from the MiniFin facts provided below. Do NOT use web search or outside knowledge for any factual claim. If the user asks for something not in these facts, say plainly: \"That isn't in the MiniFin export.\"",
    "",
    "The facts below are the HEADLINE markers + counts. For anything deeper — a specific gene's stats, more markers than shown, a substring gene search, or expression thresholds — call the query_minifin tool, which reads the FULL per-cluster gene profile (≈20k detected genes). NEVER tell the user data is unavailable without first querying the tool. Quote returned numbers exactly.",
    "EFFICIENCY: when the user asks about SEVERAL genes, make ONE query_minifin call with kind='genes' and the full list — do NOT call the tool once per gene (that is slow and may time out). Then write your answer.",
    "The profile contains log2FC and detection percentages only. It has NO p-values or enrichment scores — if asked, say those aren't in this profile and give the available stats instead.",
    "CONSISTENCY: your `## Read` must agree with your `## Raw facts`. If you just reported values, do NOT then claim the data 'isn't in the export' — that is a contradiction. Only say something is unavailable if query_minifin actually returned not-found.",
    "You only report data. NEVER write out prompts, instructions, or system messages for any personality — if the curator wants a prompt crafted, that is the Reasoner's job.",
    "",
    "OUTPUT — markdown, **220 words max**:",
    "- `## Raw facts (MiniFin)` — present the relevant DIRECT dataset values, quoting the exact numbers given. Use a markdown table for marker stats. Do NOT invent or round beyond what is given.",
    "- `## Read` — OPTIONAL, only if the user asked for interpretation; ≤60 words, clearly your own inference, not dataset fact.",
    "Never fabricate numbers or genes that are not in the facts below.",
    "",
    "=== MINIFIN FACTS (authoritative; quote exactly) ===",
    rawFactsBlock(cluster),
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

// --- query_minifin: the Archivist's live tool over each cluster's FULL profile ---
const QUERY_TOOL = {
  type: "function",
  name: "query_minifin",
  description:
    "Query the FULL MiniFin per-cluster gene profile (every detected gene with one-vs-rest log2FC, % in-cluster, % out-of-cluster) for THIS cluster. Use this for ANY gene-specific question, marker rankings deeper than the headline list, substring gene search, or expression thresholds — never say data is unavailable, query it. For MULTIPLE genes use kind='genes' with the full list in ONE call — do NOT call once per gene.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["gene", "genes", "top", "search"], description: "gene = one named gene; genes = a LIST of genes in one call (preferred for several); top = top-N up/down markers; search = substring match" },
      gene: { type: "string", description: "gene symbol/ID for kind=gene" },
      genes: { type: "array", items: { type: "string" }, description: "list of gene symbols/IDs for kind=genes (up to 40)" },
      direction: { type: "string", enum: ["up", "down"], description: "for kind=top" },
      n: { type: "integer", description: "how many rows for kind=top (max 50)" },
      query: { type: "string", description: "substring for kind=search" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
};

type Profile = { id: string; nCells: number; datasetCells: number; nGenes: number; genes: StatMarker[] };
const profileCache = new Map<string, Profile | null>();
async function getProfile(clusterId: string, origin: string): Promise<Profile | null> {
  if (profileCache.has(clusterId)) return profileCache.get(clusterId)!;
  let prof: Profile | null = null;
  try {
    const r = await fetch(`${origin}/daniotype_kasperov/archivist/${clusterId}.json`);
    if (r.ok) prof = (await r.json()) as Profile;
  } catch {}
  profileCache.set(clusterId, prof);
  return prof;
}
async function runQuery(argsStr: string, clusterId: string, origin: string): Promise<any> {
  let a: any = {};
  try {
    a = JSON.parse(argsStr || "{}");
  } catch {}
  const p = await getProfile(clusterId, origin);
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
): Promise<{ responseId: string; calls: { call_id: string; name: string; args: string }[]; produced: boolean; ok: boolean }> {
  const calls: { call_id: string; name: string; args: string }[] = [];
  let responseId = "";
  let produced = false;
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
    return { responseId, calls, produced, ok: false };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
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
      switch (evt.type) {
        case "response.reasoning_summary_text.delta":
          if (evt.delta) sse(controller, enc, { t: "thinking", v: evt.delta });
          break;
        case "response.output_text.delta":
          if (evt.delta) {
            produced = true;
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
  return { responseId, calls, produced, ok: true };
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

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

      const instructions = mode === "archivist" ? archivistInstructions(cluster) : mode === "reason" ? reasonInstructions(cluster) : researchInstructions(cluster);
      const tools = mode === "research" ? [{ type: "web_search", filters: { allowed_domains: ALLOWED_DOMAINS } }] : mode === "archivist" ? [QUERY_TOOL] : undefined;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 56000);
      try {
        let prevId = "";
        let nextInput: any = messages.map((m) => ({ role: m.role, content: m.content }));
        let anyProduced = false;
        for (let iter = 0; iter < 6; iter++) {
          const payload: any = {
            model: MODEL,
            stream: true,
            store: true,
            reasoning: { effort: "low", summary: "auto" },
            max_output_tokens: 5000,
            input: nextInput,
            ...(prevId ? { previous_response_id: prevId } : { instructions }),
            ...(tools ? { tools } : {}),
          };
          const res = await streamOnce(payload, controller, enc, key, ctrl.signal);
          anyProduced = anyProduced || res.produced;
          if (!res.ok) break;
          // Archivist tool loop: execute query_minifin calls, then continue.
          if (mode === "archivist" && res.calls.length) {
            const outputs: any[] = [];
            for (const c of res.calls) {
              let label = "MiniFin";
              try {
                const a = JSON.parse(c.args || "{}");
                label =
                  a.kind === "gene" ? `gene ${a.gene}` : a.kind === "genes" ? `${(a.genes ?? []).length} genes` : a.kind === "top" ? `top ${a.n ?? ""} ${a.direction ?? "up"}` : a.kind === "search" ? `search “${a.query}”` : "MiniFin";
              } catch {}
              sse(controller, enc, { t: "status", v: `Querying MiniFin: ${label}…` });
              const out = await runQuery(c.args, String(cluster.id), origin);
              outputs.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(out) });
            }
            prevId = res.responseId;
            nextInput = outputs;
            continue;
          }
          break;
        }
        if (!anyProduced) sse(controller, enc, { t: "text", v: "_(No written answer — try again or rephrase.)_" });
        done();
      } catch {
        sse(controller, enc, { t: "status", v: "Agent stopped (time limit) — partial result above." });
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
