// src/app/api/kasperov_autopilot/route.ts
//
// Thin proxy from the browser to the EC2 persistent auto-pilot worker
// (backend/daniotype_autopilot_api). Keeps the worker token server-side.
//   POST {action:"start", dataset, model}  → {runId}
//   POST {action:"status", runId}          → worker status
//   POST {action:"abort", runId}           → {ok}
// Degrades to {error:"not_configured"} (503) when KASPEROV_AUTOPILOT_URL is unset.

import { NextRequest, NextResponse } from "next/server";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

export const runtime = "nodejs";

const URL_BASE = (process.env.KASPEROV_AUTOPILOT_URL || "").replace(/\/$/, "");
const TOKEN = process.env.KASPEROV_AUTOPILOT_TOKEN || "";

export async function POST(req: NextRequest) {
  if (!URL_BASE) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const headers = { "content-type": "application/json", "x-api-token": TOKEN };
  try {
    if (body?.action === "start") {
      const model = isKasperovModel(body?.model) ? body.model : DEFAULT_MODEL;
      // serveDataset (optional): the partition to LABEL (e.g. daniocell_native) when it differs from
      // the store key `dataset` (e.g. daniocell). The worker defaults serveDataset -> datasetId.
      const r = await fetch(`${URL_BASE}/start`, { method: "POST", headers, body: JSON.stringify({ datasetId: String(body?.dataset || ""), serveDataset: body?.serveDataset ? String(body.serveDataset) : undefined, model }) });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    if (body?.action === "status") {
      const r = await fetch(`${URL_BASE}/status/${encodeURIComponent(String(body?.runId || ""))}`, { headers });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    if (body?.action === "abort") {
      const r = await fetch(`${URL_BASE}/abort/${encodeURIComponent(String(body?.runId || ""))}`, { method: "POST", headers });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    // timelapse capture: a headless browser on the EC2 box films the in-browser
    // AutoPilot and assembles a ~60s GIF (and saves the run when it finishes).
    if (body?.action === "capture") {
      const model = isKasperovModel(body?.model) ? body.model : DEFAULT_MODEL;
      const r = await fetch(`${URL_BASE}/capture`, { method: "POST", headers, body: JSON.stringify({ datasetId: String(body?.dataset || ""), model }) });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    if (body?.action === "captureStatus") {
      const r = await fetch(`${URL_BASE}/capture/${encodeURIComponent(String(body?.captureId || ""))}`, { headers });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    // attach/edit a free-text note on a run (in-flight by runId, or a saved run by runId+dataset)
    if (body?.action === "setNote") {
      const r = await fetch(`${URL_BASE}/note`, { method: "POST", headers, body: JSON.stringify({ runId: String(body?.runId || ""), note: typeof body?.note === "string" ? body.note : "", dataset: body?.dataset ? String(body.dataset) : undefined }) });
      return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
    }
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
