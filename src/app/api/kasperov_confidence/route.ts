// src/app/api/kasperov_confidence/route.ts
//
// Lightweight confidence assessor for the daniotype_kasperov wizard. Given the
// cluster + the chat so far, returns how confident a curator should be in the
// cell-type identity (0-100) plus a single ≤40-word rationale. Non-streaming;
// cheap; called after each agent turn to keep the confidence box live.

import "server-only";
import { readFile } from "fs/promises";
import nodePath from "path";
export const runtime = "nodejs";
export const maxDuration = 120;
const DATA_DIR = nodePath.join(process.cwd(), "daniotype_data");

import { NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

const DEFAULT = process.env.KASPEROV_OPENAI_MODEL || DEFAULT_MODEL;

// Datasets with a published label set: the four-tier predictions are constrained
// to the EXACT labels that exist in that dataset's ground truth (so we never
// invent a label the atlas doesn't use, and predictions are directly comparable).
// datasets that ship a published-label groundtruth.json under daniotype_data/<id>/
// ChemFish gated out until its assets + groundtruth.json are actually built — it ships
// no published-label file, so vocab-enum/scoring would silently fall back. Re-add when built.
const GT_DATASETS = new Set<string>(["zscape"]);
type TierVocab = { germ_layer: string[]; tissue: string[]; cell_type_broad: string[]; cell_type_sub: string[] };
const VOCAB_KEYS: (keyof TierVocab)[] = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
const vocabCache: Record<string, TierVocab | null> = {};
async function getTierVocab(_origin: string, datasetId: string): Promise<TierVocab | null> {
  if (datasetId in vocabCache) return vocabCache[datasetId];
  if (!GT_DATASETS.has(datasetId)) {
    vocabCache[datasetId] = null;
    return null;
  }
  try {
    // read off disk (server-side); the gated asset route is for the browser only
    const gt = JSON.parse(await readFile(nodePath.join(DATA_DIR, datasetId, "groundtruth.json"), "utf8"));
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
    vocabCache[datasetId] = VOCAB_KEYS.every((k) => out[k].length > 0) ? out : null;
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
  const cluster = body?.cluster ?? {};
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT;
  const messages: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "no_key" }, { status: 503 });
  if (messages.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const vocab = await getTierVocab(origin, String(body?.dataset ?? ""));

  const convo = messages.map((m) => `${m.role === "user" ? "Curator" : "Agent"}: ${m.content}`).join("\n\n").slice(0, 8000);
  const added = typeof body?.addedMarkers === "string" ? body.addedMarkers.slice(0, 1200) : "";
  const instructions =
    "You characterize a zebrafish single-cell cluster at FOUR nested ontology tiers — germ layer → tissue → cell type (broad) → cell type (sub) — using ONLY the conversation and the evidence added to the Top Markers panel. " +
    "For EACH tier give: prediction (your single best short label for that tier, e.g. germ_layer 'ectoderm', tissue 'epidermis', cell_type_broad 'periderm', cell_type_sub 'periderm (outer)'; if genuinely unestablished, your best provisional guess) and confidence_pct (0-100, ONE decimal, granular — e.g. 84.3 not 85). " +
    "Confidence is grounded in the evidence actually discussed (cited markers, in-vivo expression, anatomy) — generally highest at the coarse germ-layer tier and lower at the fine sub-type tier; if a tier is barely supported, score it low. The GOAL of the cluster's work is to drive all four tier confidences up. " +
    "Also give a `why` of 60 words or fewer: the single strongest support and the main remaining uncertainty across the tiers. No preamble." +
    (vocab
      ? " CONSTRAINED LABEL SET: this dataset uses a FIXED published vocabulary. For EACH tier, `prediction` MUST be EXACTLY one of that tier's allowed labels listed below — choose the single closest existing label to your read; never invent a new label, synonym, or suffix. " +
        VOCAB_KEYS.map((k) => `${k}: [ ${vocab[k].join(" | ")} ]`).join("  ·  ")
      : "");

  const tierSchema = (allowed?: string[]) => ({
    type: "object",
    properties: {
      prediction: allowed && allowed.length ? { type: "string", enum: allowed } : { type: "string" },
      confidence_pct: { type: "number", minimum: 0, maximum: 100 },
    },
    required: ["prediction", "confidence_pct"],
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
              properties: {
                germ_layer: tierSchema(vocab?.germ_layer),
                tissue: tierSchema(vocab?.tissue),
                cell_type_broad: tierSchema(vocab?.cell_type_broad),
                cell_type_sub: tierSchema(vocab?.cell_type_sub),
                why: { type: "string" },
              },
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
