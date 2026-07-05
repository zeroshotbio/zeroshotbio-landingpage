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
// They do NOT get their own picker card — instead each surfaces inside its BASE
// dataset's "View Completed Runs" list: on a list request we append one synthetic
// row; when that row is opened we fetch BOTH runs, merge the consolidation's
// operatorProposal + deliverable labels into the labelling run, and normalize to
// viewer shape (see ./normalize). Read-time only — persisted runs are never rewritten.
type BatchRef = { ds: string; id: string };
const BATCH_BY_BASE: Record<string, { labelling: BatchRef; consolidation: BatchRef; model: string; note: string }> = {
  chemfish: {
    labelling: { ds: "chemfish_phase1_finelabel", id: "20260704-193854-0c115f" },
    consolidation: { ds: "chemfish_phase1_finelabel", id: "20260704-222534-a70b22" },
    model: "gpt-5.4", note: "Fine-labelled + consolidated · Phase 0→A→B (288 leaves → 51 nodes)",
  },
  daniocell: {
    labelling: { ds: "daniocell_phase1_finelabel", id: "20260704-195339-e48838" },
    consolidation: { ds: "daniocell_phase1_finelabel", id: "20260704-222546-b3c7e8" },
    model: "gpt-5.4", note: "Fine-labelled + consolidated · Phase 0→A→B (270 leaves → 55 nodes)",
  },
  minifin: {
    labelling: { ds: "minifin_phaseA_labelling", id: "20260704-234502-beaeee" },
    consolidation: { ds: "minifin_final_labelling", id: "20260705-002027-a10bb8" },
    model: "gpt-5.4", note: "Fine-labelled + consolidated · Phase 0→A→B (267 leaves → 114 nodes; validated 0.99/0.90)",
  },
  // MegaFin fine-labelling ran on parse_megafin1 (the Parse/ENSDARG object) -> Parse card.
  megafin_parse: {
    labelling: { ds: "megafin_phaseA_labelling", id: "20260705-051439-a10c0a" },
    consolidation: { ds: "megafin_final_labelling", id: "20260705-063523-abad22" },
    model: "gpt-5.4", note: "Fine-labelled + consolidated · Phase 0→A→B (342 leaves → 131 nodes; leaf-124 corrected)",
  },
};

async function fetchRunJson(ref: BatchRef): Promise<any | null> {
  try {
    const r = await fetch(`${URL_BASE}/runs/${encodeURIComponent(ref.ds)}/${encodeURIComponent(ref.id)}`, { headers: HEADERS });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
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
  const batch = BATCH_BY_BASE[dataset];
  try {
    if (id) {
      // opening the appended fine-labelled row -> fetch both worker runs + normalize.
      if (batch && id === batch.labelling.id) {
        const [lab, cons] = await Promise.all([fetchRunJson(batch.labelling), fetchRunJson(batch.consolidation)]);
        if (!lab) return NextResponse.json({ error: "no run" }, { status: 404 });
        return NextResponse.json(normalizeRun(lab, cons));
      }
      const r = await fetch(`${URL_BASE}/runs/${encodeURIComponent(dataset)}/${encodeURIComponent(id)}`, { headers: HEADERS });
      const body = await r.text();
      return new NextResponse(body, { status: r.status, headers: { "content-type": "application/json" } });
    }
    // list: the base dataset's own runs, plus the fine-labelled deliverable row when present.
    const r = await fetch(`${URL_BASE}/runs?dataset=${encodeURIComponent(dataset)}${include}`, { headers: HEADERS });
    const data = await r.json().catch(() => ({ runs: [] }));
    if (batch) {
      const runs = Array.isArray(data.runs) ? data.runs : [];
      if (!runs.some((x: any) => x?.runId === batch.labelling.id)) {
        runs.unshift({
          runId: batch.labelling.id, datasetId: dataset, dataset: batch.note, model: batch.model,
          source: "batch (read-time normalized)", note: batch.note, hasGroundTruth: false,
        });
      }
      return NextResponse.json({ ...data, runs }, { status: r.status });
    }
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
