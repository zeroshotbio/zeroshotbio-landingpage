// src/app/api/kasperov_confidence/route.ts
//
// Lightweight confidence assessor for the daniotype_kasperov wizard. Given the
// cluster + the chat so far, returns how confident a curator should be in the
// cell-type identity (0-100) plus a single ≤40-word rationale. Non-streaming;
// cheap; called after each agent turn to keep the confidence box live.

import "server-only";
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const cluster = body?.cluster ?? {};
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  const messages: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 503 });
  if (messages.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });

  const convo = messages.map((m) => `${m.role === "user" ? "Curator" : "Agent"}: ${m.content}`).join("\n\n").slice(0, 8000);
  const added = typeof body?.addedMarkers === "string" ? body.addedMarkers.slice(0, 1200) : "";
  const instructions =
    "You characterize a zebrafish single-cell cluster at FOUR nested ontology tiers — germ layer → tissue → cell type (broad) → cell type (sub) — using ONLY the conversation and the evidence added to the Top Markers panel. " +
    "For EACH tier give: prediction (your single best short label for that tier, e.g. germ_layer 'ectoderm', tissue 'epidermis', cell_type_broad 'periderm', cell_type_sub 'periderm (outer)'; if genuinely unestablished, your best provisional guess) and confidence_pct (0-100, ONE decimal, granular — e.g. 84.3 not 85). " +
    "Confidence is grounded in the evidence actually discussed (cited markers, in-vivo expression, anatomy) — generally highest at the coarse germ-layer tier and lower at the fine sub-type tier; if a tier is barely supported, score it low. The GOAL of the cluster's work is to drive all four tier confidences up. " +
    "Also give a `why` of 60 words or fewer: the single strongest support and the main remaining uncertainty across the tiers. No preamble.";

  const TIER = {
    type: "object",
    properties: { prediction: { type: "string" }, confidence_pct: { type: "number", minimum: 0, maximum: 100 } },
    required: ["prediction", "confidence_pct"],
    additionalProperties: false,
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 110000);
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        // "low" is the only effort accepted across the whole gpt-5 series — gpt-5.1+
        // reject "minimal" with a 400, which silently broke this whole endpoint
        // (and the live TIER CONFIDENCE box) whenever a .x model was selected.
        reasoning: { effort: "low" },
        max_output_tokens: 2000,
        instructions,
        input: [{ role: "user", content: `Cluster: ${cluster?.label ?? cluster?.id ?? "?"}\n\nConversation:\n${convo}${added ? `\n\nEvidence added to Top Markers panel:\n${added}` : ""}` }],
        text: {
          format: {
            type: "json_schema",
            name: "characterization",
            strict: true,
            schema: {
              type: "object",
              properties: { germ_layer: TIER, tissue: TIER, cell_type_broad: TIER, cell_type_sub: TIER, why: { type: "string" } },
              required: ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub", "why"],
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
    const tier = (o: any) => ({
      prediction: String(o?.prediction ?? "").slice(0, 80),
      pct: Math.round(Math.max(0, Math.min(100, Number(o?.confidence_pct ?? 0))) * 10) / 10,
    });
    const tiers = {
      germ_layer: tier(parsed.germ_layer),
      tissue: tier(parsed.tissue),
      cell_type_broad: tier(parsed.cell_type_broad),
      cell_type_sub: tier(parsed.cell_type_sub),
    };
    const why = String(parsed.why ?? "").slice(0, 600);
    const usage = { model, in: data?.usage?.input_tokens ?? 0, out: data?.usage?.output_tokens ?? 0 };
    return NextResponse.json({ tiers, why, usage });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
