// src/app/api/kasperov_runs/all/route.ts
//
// Cross-dataset run list for the (Phase 2b) run gallery: proxies the worker's
// GET /runs/all, which merges every dataset's _index.json (and _archive.json
// when include=archived). Same worker + auth as kasperov_runs.
//   - GET                      → active runs across all datasets
//   - GET ?include=archived    → also includes archived runs (badged)

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const URL_BASE = (process.env.KASPEROV_AUTOPILOT_URL || "").replace(/\/$/, "");
const TOKEN = process.env.KASPEROV_AUTOPILOT_TOKEN || "";
const HEADERS = { "content-type": "application/json", "x-api-token": TOKEN };

export async function GET(req: NextRequest) {
  if (!URL_BASE) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const include = url.searchParams.get("include") === "archived" ? "?include=archived" : "";
  try {
    const r = await fetch(`${URL_BASE}/runs/all${include}`, { headers: HEADERS });
    return NextResponse.json(await r.json().catch(() => ({ runs: [] })), { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "worker_unreachable", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
  }
}
