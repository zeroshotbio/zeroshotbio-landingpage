// src/app/api/kasperov_fit/route.ts
//
// Constrained-classification step for the daniotype_kasperov scorecard. Given our
// ALREADY-FORMED de-novo identity for a cluster, map it onto the dataset's PUBLISHED
// label vocabulary ("bins") at each of the four ontology tiers — so we can score the
// constrained fit ALONGSIDE the open-vocabulary de-novo call. Non-streaming; cheap.
//   POST { dataset, model?, identity, cluster:{label,markers?} }
//     → { fit: { germ_layer, tissue, cell_type_broad, cell_type_sub } }  (or {fit:null})

import "server-only";
export const runtime = "nodejs";
export const maxDuration = 120;
// groundtruth.json is served by nginx (daniotype_data/), not bundled into the function.
const ASSET_HOST = (process.env.DANIOTYPE_ASSET_BASE || "https://zscape.zeroshot.bio/daniotype_data").replace(/\/$/, "");

import { NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;

// GT datasets ship a published-label groundtruth.json under daniotype_data/<id>/ — the
// per-tier "bins" the de-novo call is fitted onto. Mirrors getTierVocab() in the
// kasperov_confidence route (kept local so this endpoint is self-contained).
const GT_DATASETS = new Set<string>(["zscape", "chemfish", "daniocell", "zscape_native", "chemfish_native", "daniocell_native"]);
type TierVocab = { germ_layer: string[]; tissue: string[]; cell_type_broad: string[]; cell_type_sub: string[] };
const VOCAB_KEYS: (keyof TierVocab)[] = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
const vocabCache: Record<string, TierVocab | null> = {};
async function getTierVocab(datasetId: string): Promise<TierVocab | null> {
  if (datasetId in vocabCache) return vocabCache[datasetId];
  if (!GT_DATASETS.has(datasetId)) {
    vocabCache[datasetId] = null;
    return null;
  }
  try {
    const r = await fetch(`${ASSET_HOST}/${datasetId}/groundtruth.json`);
    const gt = r.ok ? await r.json() : {};
    const sets: Record<keyof TierVocab, Set<string>> = { germ_layer: new Set(), tissue: new Set(), cell_type_broad: new Set(), cell_type_sub: new Set() };
    for (const id of Object.keys(gt?.clusters ?? {})) {
      const rec = gt.clusters[id] ?? {};
      for (const k of VOCAB_KEYS) {
        const lab = rec?.[k]?.label;
        if (typeof lab === "string" && lab.trim()) sets[k].add(lab.trim());
      }
    }
    const out = {
      germ_layer: Array.from(sets.germ_layer).sort(),
      tissue: Array.from(sets.tissue).sort(),
      cell_type_broad: Array.from(sets.cell_type_broad).sort(),
      cell_type_sub: Array.from(sets.cell_type_sub).sort(),
    } as TierVocab;
    vocabCache[datasetId] = VOCAB_KEYS.some((k) => out[k].length > 0) ? out : null;
    return vocabCache[datasetId];
  } catch {
    vocabCache[datasetId] = null;
    return null;
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const identity = String(body?.identity ?? "").trim();
  const cluster = body?.cluster ?? {};
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 503 });
  if (!identity) return NextResponse.json({ error: "no_identity" }, { status: 400 });

  const vocab = await getTierVocab(String(body?.dataset ?? ""));
  if (!vocab) return NextResponse.json({ fit: null, reason: "no_vocab" }); // non-GT dataset → nothing to fit to

  const binBlock = VOCAB_KEYS.filter((k) => vocab[k].length > 0).map((k) => `${k}: [ ${vocab[k].join(" | ")} ]`).join("\n");
  const instructions =
    "You map an ALREADY-FORMED de-novo cell-type call onto a dataset's PUBLISHED label vocabulary. " +
    "You are given OUR de-novo identity for a zebrafish (Danio rerio) single-cell cluster and, for each ontology tier (germ_layer → tissue → cell_type_broad → cell_type_sub), the EXACT set of labels that dataset's ground truth uses (its 'bins'). " +
    "For EACH tier, choose the SINGLE existing bin that best matches our call by biology / lineage / anatomy — parent-child, synonym, and lineage membership all count; pick the closest even if imperfect (e.g. our 'keratinocyte' → germ_layer bin 'ectoderm'). " +
    "NEVER invent a label, synonym, or suffix — pick ONLY from the provided bins for that tier. If a tier lists no bins, give your single best free-text label for it. No preamble.";

  const tierSchema = (allowed?: string[]) => ({
    type: "object",
    properties: { prediction: allowed && allowed.length ? { type: "string", enum: allowed } : { type: "string" } },
    required: ["prediction"],
    additionalProperties: false,
  });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 110000);
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        max_output_tokens: 1200,
        instructions,
        input: [{ role: "user", content: `OUR de-novo call: ${identity}\nCluster: ${cluster?.label ?? cluster?.id ?? "?"}${cluster?.markers ? `\nTop markers: ${String(cluster.markers).slice(0, 300)}` : ""}\n\nPUBLISHED bins per tier:\n${binBlock}` }],
        text: {
          format: {
            type: "json_schema",
            name: "fit_to_bins",
            strict: true,
            schema: {
              type: "object",
              properties: {
                germ_layer: tierSchema(vocab.germ_layer),
                tissue: tierSchema(vocab.tissue),
                cell_type_broad: tierSchema(vocab.cell_type_broad),
                cell_type_sub: tierSchema(vocab.cell_type_sub),
              },
              required: ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"],
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
    const lab = (o: any) => String(o?.prediction ?? "").slice(0, 80);
    const fit = {
      germ_layer: lab(parsed.germ_layer),
      tissue: lab(parsed.tissue),
      cell_type_broad: lab(parsed.cell_type_broad),
      cell_type_sub: lab(parsed.cell_type_sub),
    };
    const usage = data?.usage ? { model, in: data.usage.input_tokens ?? 0, out: data.usage.output_tokens ?? 0 } : undefined;
    return NextResponse.json({ fit, usage });
  } catch (e: any) {
    if (e?.name === "AbortError") return NextResponse.json({ error: "timeout" }, { status: 504 });
    return NextResponse.json({ error: "exception", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
