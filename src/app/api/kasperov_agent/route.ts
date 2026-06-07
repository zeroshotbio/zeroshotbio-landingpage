// src/app/api/kasperov_agent/route.ts
//
// Streaming research-agent backend for the daniotype_kasperov labelling wizard.
// Provider: OpenAI Responses API (web search restricted to canonical zebrafish
// resources + streamed reasoning summaries). Given a Leiden cluster's top
// differential genes, it grounds a cell-type call in ZFIN / ZFA / GO and streams
// its reasoning, search activity, and answer so the UI can show live progress.
//
// Server-Sent Events. Each line is `data: {json}` where json is one of:
//   {t:"status",   v:"Searching ZFIN/ZFA/GO…"}   live search activity
//   {t:"thinking", v:"<delta>"}                   reasoning-summary trace
//   {t:"text",     v:"<delta>"}                   answer text, streamed
//   {t:"done"}                                    stream complete
//
// Requires OPENAI_API_KEY in the environment (Vercel project env in prod).

import "server-only";
export const runtime = "nodejs";
// 60s is the Vercel hobby-plan ceiling. Raise to 300 on Pro for deeper runs.
export const maxDuration = 60;

const MODEL = process.env.KASPEROV_OPENAI_MODEL || "gpt-5-mini";

// Canonical zebrafish evidence resources — the only domains web search may use.
const ALLOWED_DOMAINS = [
  "zfin.org",
  "www.ebi.ac.uk",
  "ebi.ac.uk",
  "geneontology.org",
  "amigo.geneontology.org",
  "www.ncbi.nlm.nih.gov",
  "www.uniprot.org",
];

type ChatMessage = { role: "user" | "assistant"; content: string };
type Cluster = { id: string; label?: string; degsUp?: string[] };

function buildInstructions(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).join(", ");
  return [
    "You are a zebrafish (Danio rerio) single-cell cell-type annotation research agent working alongside a human curator who makes the final call.",
    "From a Leiden cluster's top differential markers, determine the most defensible cell-type identity by grounding it in canonical evidence — as a curator does: markers → in-vivo expression (ZFIN) → ZFA anatomy → cell type, corroborated by GO function.",
    "",
    "RULES (cite-discipline):",
    "- Use web search against the canonical resources only (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Do not assert any anatomical or functional claim from unsourced memory — look it up.",
    "- Ground every claim in one of the cluster's listed marker genes and a looked-up record; cite sources inline as markdown links.",
    "- Marker symbols may be human-ortholog-cased (e.g. HOXB13); map to the zebrafish gene where needed.",
    "- Use the zebrafish (identity, state) model: identity is the lineage/cell-type name; state ∈ {progenitor, cycling, quiescent, mature, stress} only when markers support it.",
    "- If evidence is ambiguous, say so and abstain rather than force-fit. The human adjudicates.",
    "",
    "OUTPUT — write skimmable, visually structured markdown so a human can scan straight to a judgement. **200 words maximum.** Use this shape:",
    "- Start with a single bold one-line identity call (no heading).",
    "- `## Evidence` — one bullet per key marker, formatted `**gene** — finding [source](url)`. Bold the gene; keep each bullet to one line.",
    "- `## Caveats` — include only if there is genuine ambiguity; 1–2 short bullets.",
    "- End with this exact final line (its own paragraph): `**Verdict:** <name>[, <state>] — confidence <low|medium|high>`.",
    "Do not exceed the sections above; no preamble like \"I'll ground this…\".",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top up-regulated markers: ${up || "(none provided)"}.`,
  ].join("\n");
}

function offlineDossier(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).slice(0, 12);
  return [
    `*(No OPENAI_API_KEY configured — set it in the Vercel project env to enable the live agent. Showing the cluster's top markers.)*`,
    "",
    `**${cluster.label ?? cluster.id} — top up-regulated markers:** ${up.join(", ") || "—"}`,
    "",
    "Search these in [ZFIN](https://zfin.org), [ZFA (EBI OLS)](https://www.ebi.ac.uk/ols4/ontologies/zfa), and [QuickGO](https://www.ebi.ac.uk/QuickGO/) to ground a cell-type call.",
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

  const key = process.env.OPENAI_API_KEY;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const done = () => {
        sse(controller, enc, { t: "done" });
        controller.close();
      };

      if (!key) {
        sse(controller, enc, { t: "text", v: offlineDossier(cluster) });
        return done();
      }

      const payload = {
        model: MODEL,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        max_output_tokens: 5000,
        instructions: buildInstructions(cluster),
        tools: [{ type: "web_search", filters: { allowed_domains: ALLOWED_DOMAINS } }],
        input: messages.map((m) => ({ role: m.role, content: m.content })),
      };

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
          sse(controller, enc, { t: "text", v: `_The research agent could not start (${r.status}). ${detail.slice(0, 160)}_` });
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
            const payloadStr = line.slice(5).trim();
            if (payloadStr === "[DONE]") continue;
            let evt: any;
            try {
              evt = JSON.parse(payloadStr);
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
                if (evt.item?.type === "web_search_call" && q)
                  sse(controller, enc, { t: "status", v: `Searched: “${String(q).slice(0, 80)}”` });
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
        if (!produced) sse(controller, enc, { t: "text", v: "_(The agent finished without a written answer — try again or rephrase.)_" });
        done();
      } catch (e: any) {
        sse(controller, enc, { t: "status", v: "Agent stopped (time limit) — partial result above." });
        done();
      } finally {
        clearTimeout(timer);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
