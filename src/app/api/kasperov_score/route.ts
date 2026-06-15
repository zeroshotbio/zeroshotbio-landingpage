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
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;
const TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
type Tier = (typeof TIERS)[number];

type Item = {
  id: string;
  ourLabel: string;
  markers?: string[];
  predictions?: Partial<Record<Tier, string | null>>; // our per-tier prediction
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
  "For each cluster you get OUR PREDICTION at four nested ontology tiers (germ_layer = coarsest → tissue → cell_type_broad → cell_type_sub = finest), the cluster's top marker genes, and the REFERENCE label at each of those tiers.",
  "For EACH tier, decide whether OUR PREDICTION at that tier denotes the same biological entity as the REFERENCE at that tier:",
  "- Accept synonyms, ontology parent/child equivalence, and lineage equivalence (e.g. our 'epidermis' vs reference 'Epidermis' → match; our 'ectoderm' vs reference 'ectoderm' → match).",
  "- IGNORE arbitrary numeric suffixes on reference sub labels (e.g. 'periderm 10', 'mature fast muscle 6' — treat as 'periderm', 'mature fast muscle'); match on the biological stem, not the number.",
  "- ROLL-UP (apply generously): our prediction is often a SINGLE specific cell-type identity repeated across all four tiers (it is our one final call). CREDIT it at a COARSER tier whenever that identity IS, or is a subtype / lineage member / anatomical part of, the reference category at that tier. This is the common case — do NOT mark a correct fine identity wrong at a coarse tier merely because it names a cell type rather than the germ-layer / tissue word. Examples that MUST match: 'hepatocyte' vs 'endoderm'; 'chondrocyte' vs 'mesoderm'; 'basal epidermal keratinocyte' vs 'ectoderm'; 'spinal interneuron' vs 'ectoderm'; 'pronephros' / 'renal tubule' / 'kidney' vs 'mesoderm' (pronephric kidney is mesoderm-derived); 'erythrocyte' / 'macrophage' vs 'mesoderm' (blood is mesoderm).",
  "- SUPERSET / multi-name predictions: if OUR prediction lists more than one identity separated by '/', ',', '+', or 'or' (e.g. 'pronephros / renal tubule-duct'), it MATCHES the reference when ANY listed identity matches — treat extra detail as elaboration, not error. 'pronephros / renal tubule-duct' vs reference 'pronephros' → match.",
  "- BENEFIT OF THE DOUBT: when two names plausibly denote the same or a nested anatomical/lineage entity, lean toward match=true. Reserve match=false for a CLEARLY different lineage (e.g. our 'neuron' vs reference 'muscle'). The goal is a fair benchmark, not exact-string matching.",
  "- BUT do NOT roll DOWN: if our prediction is COARSER than the reference at a finer tier (e.g. we only said 'ectoderm' but the reference cell_type_sub is 'periderm 10'), that is match=false at the finer tier — we did not resolve that deep.",
  "- If our prediction is empty or a reference tier label is missing/empty, match=false with note 'missing'.",
  "Each tier verdict carries a note of 10 words or fewer justifying the call. Return one result object per input cluster, in the same order, keyed by the given id.",
].join("\n");

function buildInput(items: Item[]): string {
  return items
    .map((it, i) => {
      const gt = it.gt || {};
      const p = it.predictions || {};
      return [
        `### Cluster ${i + 1} (id=${it.id})`,
        `Top markers: ${(it.markers ?? []).slice(0, 12).join(", ") || "(none)"}`,
        `OUR germ_layer: ${p.germ_layer ?? it.ourLabel ?? "(none)"}    | REFERENCE: ${gt.germ_layer ?? "(none)"}`,
        `OUR tissue: ${p.tissue ?? it.ourLabel ?? "(none)"}    | REFERENCE: ${gt.tissue ?? "(none)"}`,
        `OUR cell_type_broad: ${p.cell_type_broad ?? it.ourLabel ?? "(none)"}    | REFERENCE: ${gt.cell_type_broad ?? "(none)"}`,
        `OUR cell_type_sub: ${p.cell_type_sub ?? it.ourLabel ?? "(none)"}    | REFERENCE: ${gt.cell_type_sub ?? "(none)"}`,
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
    const t = setTimeout(() => ctrl.abort(), 295000);
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
