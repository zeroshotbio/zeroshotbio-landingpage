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

export const runtime = "nodejs";

const URL_BASE = (process.env.KASPEROV_AUTOPILOT_URL || "").replace(/\/$/, "");
const TOKEN = process.env.KASPEROV_AUTOPILOT_TOKEN || "";
const HEADERS = { "content-type": "application/json", "x-api-token": TOKEN };

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
