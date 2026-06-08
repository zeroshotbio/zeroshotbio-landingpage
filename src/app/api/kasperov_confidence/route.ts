// src/app/api/kasperov_confidence/route.ts
//
// Lightweight confidence assessor for the daniotype_kasperov wizard. Given the
// cluster + the chat so far, returns how confident a curator should be in the
// cell-type identity (0-100) plus a single ≤40-word rationale. Non-streaming;
// cheap; called after each agent turn to keep the confidence box live.

import "server-only";
export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";

const MODEL = process.env.KASPEROV_OPENAI_MODEL || "gpt-5-mini";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const cluster = body?.cluster ?? {};
  const messages: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 503 });
  if (messages.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });

  const convo = messages.map((m) => `${m.role === "user" ? "Curator" : "Agent"}: ${m.content}`).join("\n\n").slice(0, 8000);
  const added = typeof body?.addedMarkers === "string" ? body.addedMarkers.slice(0, 1200) : "";
  const instructions =
    "You assess how confident a curator should be in the proposed cell-type identity for a zebrafish single-cell cluster, given ONLY the conversation and the evidence added to the Top Markers panel. " +
    "Weigh: strength and specificity of cited evidence, agreement across turns, statistical support, and unresolved caveats. If little is established, score low. " +
    "Return confidence_pct (a number 0-100 with ONE decimal place — be granular, e.g. 65.4 or 88.7, not a round number) and a rationale of 100 words or fewer giving the HIGHEST-LEVEL reasons for that level of confidence (or lack of it) — what is the single strongest support and the main remaining uncertainty. Reference what was actually discussed; no preamble.";

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "minimal" },
        max_output_tokens: 900,
        instructions,
        input: [{ role: "user", content: `Cluster: ${cluster?.label ?? cluster?.id ?? "?"}\n\nConversation:\n${convo}${added ? `\n\nEvidence added to Top Markers panel:\n${added}` : ""}` }],
        text: {
          format: {
            type: "json_schema",
            name: "confidence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                confidence_pct: { type: "number", minimum: 0, maximum: 100 },
                rationale: { type: "string" },
              },
              required: ["confidence_pct", "rationale"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    clearTimeout(t);
    if (!r.ok) return NextResponse.json({ error: "upstream", status: r.status }, { status: 502 });
    const data = await r.json();
    const text: string =
      (data?.output ?? [])
        .filter((o: any) => o.type === "message")
        .flatMap((o: any) => o.content ?? [])
        .find((c: any) => c.type === "output_text")?.text ?? data?.output_text ?? "";
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "parse" }, { status: 502 });
    }
    const pct = Math.round(Math.max(0, Math.min(100, Number(parsed.confidence_pct ?? 0))) * 10) / 10;
    const why = String(parsed.rationale ?? "").slice(0, 800);
    return NextResponse.json({ pct, why });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
