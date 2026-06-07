// src/app/api/kasperov_agent/route.ts
//
// Streaming research-agent backend for the daniotype_kasperov labelling wizard.
//
// Given a Leiden cluster's top differential genes, it runs Claude with the
// web-search server tool restricted to the canonical zebrafish evidence
// resources (ZFIN, ZFA via EBI OLS, GO / QuickGO, NCBI Gene, UniProt) — the
// evidence ladder the daniotype descent grounds on — and streams back the
// model's summarized reasoning, its live search activity, and the answer as it
// is written, so the UI can show progress instead of a dead spinner.
//
// Server-Sent Events. Each line is `data: {json}` where json is one of:
//   {t:"status",   v:"Searching: <query>"}     live search activity
//   {t:"thinking", v:"<delta>"}                 summarized reasoning trace
//   {t:"text",     v:"<delta>"}                 answer text, streamed
//   {t:"done"}                                  stream complete
//   {t:"error",    v:"<message>"}               fatal error (rare)

import "server-only";
export const runtime = "nodejs";
// 60s is the Vercel hobby-plan ceiling. Raise to 300 on Pro for deeper runs.
export const maxDuration = 60;

const MODEL = process.env.KASPEROV_AGENT_MODEL || "claude-opus-4-8";

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

function buildSystem(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).join(", ");
  return [
    "You are a zebrafish (Danio rerio) single-cell cell-type annotation research agent working alongside a human curator who makes the final call.",
    "Your job: from a Leiden cluster's top differential markers, determine the most defensible cell-type identity by grounding it in canonical evidence — as a curator does: markers → in-vivo expression (ZFIN) → ZFA anatomy → cell type, corroborated by GO function.",
    "",
    "RULES (cite-discipline):",
    "- Search ONLY the canonical resources available to you (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Do not assert any anatomical or functional claim from unsourced memory — look it up.",
    "- Ground every claim in one of the cluster's listed marker genes and a looked-up ZFA / GO id or a ZFIN expression record. Cite sources inline as markdown links.",
    "- Note: marker symbols may be human-ortholog-cased (e.g. HOXB13); map to the zebrafish gene where needed.",
    "- Use the zebrafish (identity, state) model: identity is the lineage/cell-type name; state ∈ {progenitor, cycling, quiescent, mature, stress} only when markers support it.",
    "- If the evidence cannot ground a confident name, say so and abstain — do not force-fit. The human adjudicates.",
    "- Be concise and skimmable: short markdown. End with a final line: `**Verdict:** <name>[, <state>] — confidence <low|medium|high>`.",
    "",
    `CLUSTER: ${cluster.label ?? cluster.id} — top up-regulated markers: ${up || "(none provided)"}.`,
  ].join("\n");
}

function offlineDossier(cluster: Cluster): string {
  const up = (cluster.degsUp ?? []).slice(0, 12);
  return [
    `*(Offline mode — no live research agent configured. Showing the cluster's top markers; connect ANTHROPIC_API_KEY for grounded research.)*`,
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

  const key = process.env.ANTHROPIC_API_KEY;
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
        max_tokens: 3000,
        stream: true,
        system: buildSystem(cluster),
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", allowed_domains: ALLOWED_DOMAINS, max_uses: 5 }],
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 56000);
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!r.ok || !r.body) {
          const detail = await r.text().catch(() => "");
          sse(controller, enc, { t: "status", v: "Live agent unavailable — showing markers." });
          sse(controller, enc, { t: "text", v: offlineDossier(cluster) });
          if (detail) sse(controller, enc, { t: "status", v: `(${detail.slice(0, 120)})` });
          return done();
        }

        // Parse Anthropic's SSE stream and re-emit a simplified event stream.
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let curBlock = ""; // current content_block type
        let toolJson = ""; // accumulating server_tool_use input json
        let produced = false; // did we emit any answer text?

        while (true) {
          const { value, done: rdone } = await reader.read();
          if (rdone) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let evt: any;
            try {
              evt = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            switch (evt.type) {
              case "content_block_start": {
                curBlock = evt.content_block?.type ?? "";
                if (curBlock === "server_tool_use") toolJson = "";
                if (curBlock === "web_search_tool_result") {
                  const n = Array.isArray(evt.content_block?.content) ? evt.content_block.content.length : 0;
                  sse(controller, enc, { t: "status", v: n ? `Found ${n} source${n === 1 ? "" : "s"} — reading…` : "Reading results…" });
                }
                break;
              }
              case "content_block_delta": {
                const d = evt.delta ?? {};
                if (d.type === "thinking_delta" && d.thinking) sse(controller, enc, { t: "thinking", v: d.thinking });
                else if (d.type === "text_delta" && d.text) {
                  produced = true;
                  sse(controller, enc, { t: "text", v: d.text });
                } else if (d.type === "input_json_delta" && d.partial_json) toolJson += d.partial_json;
                break;
              }
              case "content_block_stop": {
                if (curBlock === "server_tool_use" && toolJson) {
                  try {
                    const q = JSON.parse(toolJson)?.query;
                    if (q) sse(controller, enc, { t: "status", v: `Searching ZFIN/ZFA/GO: “${String(q).slice(0, 80)}”` });
                  } catch {}
                }
                curBlock = "";
                break;
              }
              case "error": {
                sse(controller, enc, { t: "status", v: `upstream: ${evt.error?.message ?? "error"}` });
                break;
              }
            }
          }
        }
        if (!produced) {
          sse(controller, enc, { t: "text", v: "_(The agent finished without a written answer — try asking again or rephrasing.)_" });
        }
        done();
      } catch (e: any) {
        sse(controller, enc, { t: "status", v: "Agent timed out — showing markers." });
        sse(controller, enc, { t: "text", v: offlineDossier(cluster) });
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
