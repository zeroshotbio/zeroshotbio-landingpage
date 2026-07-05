// src/app/api/kasperov_runs/route.ts
//
// Server-side store for completed daniotype_kasperov runs (labels + ground-truth
// scores + metadata), so a finished run can be reloaded later for compare/
// contrast across models. For the POC this proxies to the EC2 worker, which
// stores run JSONs on its EBS volume — no S3 bucket to provision.
//   - POST  body=<run JSON>            → save → {runId}
//   - GET   ?dataset=<id>              → list run metadata (newest first)
//   - GET   ?dataset=<id>&id=<runId>   → the full run JSON
//
// Uses the same worker as the persistent auto-pilot (KASPEROV_AUTOPILOT_URL +
// _TOKEN). Degrades to {error:"not_configured"} (503) when unset.

import { NextRequest, NextResponse } from "next/server";
import { normalizeRun } from "./normalize";

export const runtime = "nodejs";

const URL_BASE = (process.env.KASPEROV_AUTOPILOT_URL || "").replace(/\/$/, "");
const TOKEN = process.env.KASPEROV_AUTOPILOT_TOKEN || "";
const HEADERS = { "content-type": "application/json", "x-api-token": TOKEN };

// --- batch fine-labelling deliverables -------------------------------------
// The Phase-0→A→B fine-labelling runs are persisted worker-native under their own
// datasetIds (labelling run = transcripts; consolidation run = operatorProposal).
// These virtual picker ids resolve to {labelling, consolidation} worker coordinates;
// on GET we fetch BOTH, merge the consolidation's operatorProposal + deliverable
// labels into the labelling run, and normalize to viewer shape (see ./normalize).
// Read-time only — the persisted worker runs are never rewritten.
type BatchRef = { ds: string; id: string };
const BATCH: Record<string, { labelling: BatchRef; consolidation: BatchRef; model: string; label: string }> = {
  minifin_batch: {
    labelling: { ds: "minifin_phaseA_labelling", id: "20260704-234502-beaeee" },
    consolidation: { ds: "minifin_final_labelling", id: "20260705-002027-a10bb8" },
    model: "gpt-5.4", label: "MiniFin — fine-labelled + consolidated (267 leaves)",
  },
  megafin_batch: {
    labelling: { ds: "megafin_phaseA_labelling", id: "20260705-051439-a10c0a" },
    consolidation: { ds: "megafin_final_labelling", id: "20260705-063523-abad22" },
    model: "gpt-5.4", label: "MegaFin — fine-labelled + consolidated (342 leaves, leaf-124 corrected)",
  },
  chemfish_batch: {
    labelling: { ds: "chemfish_phase1_finelabel", id: "20260704-193854-0c115f" },
    consolidation: { ds: "chemfish_phase1_finelabel", id: "20260704-222534-a70b22" },
    model: "gpt-5.4", label: "ChemFish — fine-labelled + consolidated (288 leaves)",
  },
  daniocell_batch: {
    labelling: { ds: "daniocell_phase1_finelabel", id: "20260704-195339-e48838" },
    consolidation: { ds: "daniocell_phase1_finelabel", id: "20260704-222546-b3c7e8" },
    model: "gpt-5.4", label: "DanioCell — fine-labelled + consolidated (270 leaves)",
  },
};

async function fetchRunJson(ref: BatchRef): Promise<any | null> {
  try {
    const r = await fetch(`${URL_BASE}/runs/${encodeURIComponent(ref.ds)}/${encodeURIComponent(ref.id)}`, { headers: HEADERS });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// GET handler for the virtual batch datasetIds: list → one synthetic row; id → the
// normalized, consolidation-merged run.
async function handleBatch(cfg: (typeof BATCH)[string], id: string | null): Promise<NextResponse> {
  if (!id) {
    return NextResponse.json({
      runs: [{
        runId: cfg.labelling.id, datasetId: cfg.labelling.ds, dataset: cfg.label, model: cfg.model,
        source: "batch (read-time normalized)", note: cfg.label, hasGroundTruth: false,
      }],
    });
  }
  const [lab, cons] = await Promise.all([fetchRunJson(cfg.labelling), fetchRunJson(cfg.consolidation)]);
  if (!lab) return NextResponse.json({ error: "no run" }, { status: 404 });
  return NextResponse.json(normalizeRun(lab, cons));
}

export async function POST(req: NextRequest) {
  if (!URL_BASE) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let run: any;
  try {
    run = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!run?.datasetId || !Array.isArray(run?.clusters)) return NextResponse.json({ error: "bad_run" }, { status: 400 });
  try {
    const r = await fetch(`${URL_BASE}/runs`, { method: "POST", headers: HEADERS, body: JSON.stringify(run) });
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (!URL_BASE) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") || "";
  const id = url.searchParams.get("id");
  // archived runs are surfaced only when explicitly asked for (default off, so
  // existing callers see no behavior change).
  const include = url.searchParams.get("include") === "archived" ? "&include=archived" : "";
  if (!dataset) return NextResponse.json({ error: "no_dataset" }, { status: 400 });
  // batch fine-labelling deliverables: fetch-both + normalize at read time.
  if (BATCH[dataset]) {
    try {
      return await handleBatch(BATCH[dataset], id);
    } catch (e: any) {
      return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
    }
  }
  try {
    if (id) {
      const r = await fetch(`${URL_BASE}/runs/${encodeURIComponent(dataset)}/${encodeURIComponent(id)}`, { headers: HEADERS });
      const body = await r.text();
      return new NextResponse(body, { status: r.status, headers: { "content-type": "application/json" } });
    }
    const r = await fetch(`${URL_BASE}/runs?dataset=${encodeURIComponent(dataset)}${include}`, { headers: HEADERS });
    return NextResponse.json(await r.json().catch(() => ({ runs: [] })), { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
