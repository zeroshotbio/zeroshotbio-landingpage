import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/* Agentic literature-research dossier for the POC workflow.
   Hits the Claude Messages API (raw fetch, no SDK) with a cheap model to synthesize a short,
   zebrafish-screening-flavored dossier for a submitted drug. Falls back gracefully (the client
   uses its precomputed dossier) when the key is missing or the call fails. */

// Cheapest current model; override with POC_DOSSIER_MODEL (e.g. "claude-sonnet-4-6").
const MODEL = process.env.POC_DOSSIER_MODEL || "claude-haiku-4-5";

const SCHEMA = {
  type: "object",
  properties: {
    target: { type: "string" },
    indication: { type: "string" },
    moa: { type: "string" },
    findings: { type: "array", items: { type: "string" } },
    zebrafish: { type: "string" },
    source: { type: "string" },
  },
  required: ["target", "indication", "moa", "findings", "zebrafish", "source"],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const name = String(body?.name ?? "").slice(0, 120);
  if (!name) return NextResponse.json({ error: "no_name" }, { status: 400 });
  const smiles = String(body?.smiles ?? "").slice(0, 300);
  const moa = String(body?.moa_fine ?? "").slice(0, 200);
  const targets = Array.isArray(body?.targets) ? body.targets.slice(0, 8).join(", ") : "";
  const drugClass = String(body?.drug_class ?? "").slice(0, 120);

  const system =
    "You are a pharmacology research assistant compiling a concise literature dossier for a zebrafish " +
    "whole-organism phenotypic screening program. Be accurate and specific; if a compound is well known, use " +
    "established facts. Keep every field tight — this feeds a UI card, not a paper.";
  const prompt =
    `Compile a dossier for the drug below.\n\n` +
    `Name: ${name}\n` +
    (smiles ? `SMILES: ${smiles}\n` : "") +
    (moa ? `Known mechanism class: ${moa}\n` : "") +
    (targets ? `Known target(s): ${targets}\n` : "") +
    (drugClass ? `Drug class: ${drugClass}\n` : "") +
    `\nReturn JSON with:\n` +
    `- target: primary molecular target(s), short.\n` +
    `- indication: main clinical indication(s), short.\n` +
    `- moa: mechanism of action in 1–2 sentences.\n` +
    `- findings: 3–4 short bullet strings of the most relevant pharmacology / toxicology findings.\n` +
    `- zebrafish: one sentence on what phenotype this compound class tends to produce in zebrafish (developmental, cardiotoxic, neuroactive, etc.).\n` +
    `- source: a short attribution line noting this was synthesized from public literature by an automated agent.`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000); // stay under the default serverless function limit
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      }),
    });
    clearTimeout(t);
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json({ error: "upstream", status: r.status, detail: detail.slice(0, 400) }, { status: 502 });
    }
    const data = await r.json();
    const text: string = (data?.content ?? []).find((b: any) => b.type === "text")?.text ?? "";
    let dossier: any;
    try { dossier = JSON.parse(text); } catch { return NextResponse.json({ error: "parse" }, { status: 502 }); }
    return NextResponse.json({ dossier, model: MODEL });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
}
