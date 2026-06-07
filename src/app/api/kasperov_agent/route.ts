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
const ARCHIVIST_CUES =
  /\b(how many|number of|count|raw|dataset|data set|minifin|log2|fold[- ]?change|pct|percent|expression value|statistic|score|exact|list the|which genes|what genes|top (genes|markers)|markers? (for|of this)|specificity|cell count|cluster size|umap)\b/gi;
const RESEARCH_CUES =
  /\b(cell type|identity|zfin|zfa|\bgo\b|anatomy|function|consistent with|lineage|marker of|role of|literature|known to|express(ed|ion) in|develops?|differentiat|in vivo|ontology)\b/gi;
const REASON_CUES =
  /\b(why|how come|could it|would you|might|hypothes|compare|contrast|explain|interpret|do you think|your (take|opinion)|infer|speculat|overall|in general|make sense|implication|trade[- ]?off|what if)\b/gi;

function classifyMode(text: string, isFirst: boolean): Mode {
  if (isFirst) return "research"; // the auto-run identity call is always research
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

function rawFactsBlock(cluster: Cluster): string {
  const rows = (cluster.markers ?? []).map(
    (m) => `| ${m.g} | ${m.l2fc ?? "?"} | ${m.p1 != null ? (m.p1 * 100).toFixed(0) + "%" : "?"} | ${m.p2 != null ? (m.p2 * 100).toFixed(0) + "%" : "?"} |`
  );
  return [
    `Cluster: ${cluster.label ?? cluster.id}`,
    cluster.nCells != null ? `Cells in cluster: ${cluster.nCells}` : "",
    "Top up-regulated markers (one-vs-rest, split-pipe leiden):",
    "| gene | log2FC | % in-cluster | % out-of-cluster |",
    "| --- | --- | --- | --- |",
    ...rows,
    "(Down-regulated markers are not present in the split-pipe export.)",
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
    "- Use the (identity, state) model: state ∈ {progenitor, cycling, quiescent, mature, stress} only when supported.",
    "- If ambiguous, say so and abstain rather than force-fit.",
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
    "OUTPUT — markdown, **200 words max**:",
    "- `## Raw facts (MiniFin)` — present the relevant DIRECT dataset values, quoting the exact numbers given. Prefer a markdown table when reporting marker stats. Do NOT invent or round beyond what is given.",
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

      const payload: any = {
        model: MODEL,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        max_output_tokens: 5000,
        instructions:
          mode === "archivist" ? archivistInstructions(cluster) : mode === "reason" ? reasonInstructions(cluster) : researchInstructions(cluster),
        input: messages.map((m) => ({ role: m.role, content: m.content })),
      };
      if (mode === "research") {
        payload.tools = [{ type: "web_search", filters: { allowed_domains: ALLOWED_DOMAINS } }];
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 56000);
      try {
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok || !r.body) {
          const detail = await r.text().catch(() => "");
          sse(controller, enc, { t: "text", v: `_The agent could not start (${r.status}). ${detail.slice(0, 160)}_` });
          return done();
        }

        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let produced = false;
        while (true) {
          const { value, done: rdone } = await reader.read();
          if (rdone) break;
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
                const q = evt.item?.action?.query;
                if (evt.item?.type === "web_search_call" && q) sse(controller, enc, { t: "status", v: `Searched: “${String(q).slice(0, 80)}”` });
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
        if (!produced) sse(controller, enc, { t: "text", v: "_(No written answer — try again or rephrase.)_" });
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
