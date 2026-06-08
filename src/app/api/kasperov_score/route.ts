// src/app/api/kasperov_score/route.ts
//
// Ground-truth scorer for the daniotype_kasperov wizard. Given a batch of our
// de-novo cluster labels + each cluster's published reference labels at four
// ontology tiers (germ_layer → tissue → cell_type_broad → cell_type_sub), an
// LLM judge decides per tier whether our name is SEMANTICALLY consistent with
// the reference (synonyms / ontology equivalence / lineage — not string match).
// Non-streaming, structured JSON. The client chunks clusters into batches.

import "server-only";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;
const TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
type Tier = (typeof TIERS)[number];

type Item = {
  id: string;
  ourLabel: string;
  markers?: string[];
  gt: Partial<Record<Tier, string | null>>;
};

const TIER_SCHEMA = {
  type: "object",
  properties: { match: { type: "boolean" }, note: { type: "string" } },
  required: ["match", "note"],
  additionalProperties: false,
};

const INSTRUCTIONS = [
  "You are a strict-but-fair benchmark judge scoring an automated zebrafish (Danio rerio) cell-type annotator against a published reference atlas.",
  "For each cluster you get: OUR de-novo label, the cluster's top marker genes, and the REFERENCE label at four nested ontology tiers (germ_layer = coarsest → tissue → cell_type_broad → cell_type_sub = finest).",
  "For EACH tier, decide whether OUR label denotes the same biological entity as the reference label AT THAT TIER's level of resolution:",
  "- Accept synonyms, ontology parent/child equivalence, and lineage equivalence (e.g. our 'periderm' vs reference tissue 'Epidermis' → match: periderm is epidermal; our 'erythroid progenitor' vs reference 'erythroid lineage' → match).",
  "- IGNORE arbitrary numeric suffixes on reference sub labels (e.g. 'periderm 10', 'mature fast muscle 6' — treat as 'periderm', 'mature fast muscle'); match on the biological stem, not the number.",
  "- DEPTH DISCIPLINE: only mark match=true at a tier if our label is SPECIFIC ENOUGH to denote that tier. If our label is correct but COARSER than the tier (e.g. we said 'epidermal cell' and the tier asks for the fine sub-type), mark match=false at that finer tier — being right at a coarse tier does not earn credit at a finer one.",
  "- If our label is simply wrong / a different lineage, match=false at every tier it conflicts with.",
  "- If a reference tier label is missing/empty, match=false with note 'no reference'.",
  "Each tier verdict carries a note of 10 words or fewer justifying the call. Return one result object per input cluster, in the same order, keyed by the given id.",
].join("\n");

function buildInput(items: Item[]): string {
  return items
    .map((it, i) => {
      const gt = it.gt || {};
      return [
        `### Cluster ${i + 1} (id=${it.id})`,
        `OUR label: ${it.ourLabel || "(none)"}`,
        `Top markers: ${(it.markers ?? []).slice(0, 12).join(", ") || "(none)"}`,
        `REFERENCE germ_layer: ${gt.germ_layer ?? "(none)"}`,
        `REFERENCE tissue: ${gt.tissue ?? "(none)"}`,
        `REFERENCE cell_type_broad: ${gt.cell_type_broad ?? "(none)"}`,
        `REFERENCE cell_type_sub: ${gt.cell_type_sub ?? "(none)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const items: Item[] = Array.isArray(body?.items) ? body.items.slice(0, 14) : [];
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  if (items.length === 0) return NextResponse.json({ error: "no_items" }, { status: 400 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 503 });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 55000);
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        max_output_tokens: 6000,
        instructions: INSTRUCTIONS,
        input: [{ role: "user", content: buildInput(items) }],
        text: {
          format: {
            type: "json_schema",
            name: "scorecard",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      germ_layer: TIER_SCHEMA,
                      tissue: TIER_SCHEMA,
                      cell_type_broad: TIER_SCHEMA,
                      cell_type_sub: TIER_SCHEMA,
                    },
                    required: ["id", "germ_layer", "tissue", "cell_type_broad", "cell_type_sub"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
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
    const usage = { model, in: data?.usage?.input_tokens ?? 0, out: data?.usage?.output_tokens ?? 0 };
    return NextResponse.json({ results: Array.isArray(parsed.results) ? parsed.results : [], usage });
  } catch (e: any) {
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
