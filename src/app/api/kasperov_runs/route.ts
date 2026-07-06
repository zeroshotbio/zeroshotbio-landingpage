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

// --- atlas grouping (replaces the hardcoded BATCH_BY_BASE literals) ---------
// One logical atlas spans several datasetId partitions (e.g. chemfish + chemfish_phase1_finelabel).
// The canonical layer stamps each run's atlasId + lineage, so the "View Completed Runs" list is now
// grouped purely from data: fetch every run's canonical-faithful meta, filter by atlasId. The old
// labelling+consolidation "deliverable" pair (neither run self-sufficient for the 5-tab drill-in)
// is reproduced from lineage.parentRunId — on OPEN we merge the pair, no per-run literals.
type BatchRef = { ds: string; id: string };
const ATLAS_OF = (ds: string) => (ds || "").replace(/_(recursive|phase1_finelabel|phaseA_labelling|final_labelling|parse|batch)$/, "");

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
  const atlas = ATLAS_OF(dataset);
  try {
    // one cross-dataset fetch — meta is canonical-faithful (worker overlays cost/lineage/atlasId/scoreable).
    const allRes = await fetch(`${URL_BASE}/runs/all${include ? "?include=archived" : ""}`, { headers: HEADERS });
    const all = ((await allRes.json().catch(() => ({ runs: [] }))).runs || []) as any[];
    const inAtlas = (m: any) => (m?.atlasId ?? ATLAS_OF(m?.datasetId || "")) === atlas;

    if (id) {
      // resolve the run's REAL datasetId (may be a sibling partition) + its lineage partner.
      const self = all.find((m) => m.runId === id && inAtlas(m));
      const selfDs = self?.datasetId || dataset;
      const run = await fetchRunJson({ ds: selfDs, id });
      if (!run) return NextResponse.json({ error: "no run" }, { status: 404 });
      // lineage merge: labelling (transcripts) + consolidation (operatorProposal) — neither is
      // self-sufficient for the 5-tab drill-in, so we stitch them from lineage.parentRunId.
      // Only the corpus labelling+consolidation pair needs stitching (each is a HALF-deliverable:
      // labelling has transcripts but no operatorProposal; consolidation has operatorProposal but no
      // transcripts). A self-sufficient run (e.g. the golden — both halves) is returned as-is, so a
      // derived re-post that merely points parentRunId→this run never mangles it.
      const hasOp = !!run.operatorProposal;
      const hasTr = (run.clusters || []).some((c: any) => ((c.transcript || c.steps || []).length) > 0);
      if (!hasOp || !hasTr) {
        const bareId = (x: any) => String(x || "").split("/").pop();  // parentRunId may be "datasetId/runId"
        const partnerMeta = all.find((m) => inAtlas(m) && m.recordType !== "dev-effort" && m.runId !== id &&
          (bareId(m.parentRunId) === id || (self?.parentRunId && m.runId === bareId(self.parentRunId))));
        if (partnerMeta) {
          const partner = await fetchRunJson({ ds: partnerMeta.datasetId, id: partnerMeta.runId });
          if (partner) {
            const [lab, cons] = hasOp ? [partner, run] : [run, partner];
            return NextResponse.json(normalizeRun(lab, cons));
          }
        }
      }
      return NextResponse.json(run);
    }

    // LIST — every run in this atlas (base partition + corpus siblings), grouped from atlasId,
    // newest first (across partitions; runs with no date sink to the bottom).
    const rows = all.filter(inAtlas).sort((a: any, b: any) => String(b.exportedAt || "").localeCompare(String(a.exportedAt || "")));
    return NextResponse.json({ runs: rows });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
