// STAGING: serve the v2.0 MVP harness trace. On the build box it reads the live file the
// orchestrator writes (so a re-run shows immediately); on Vercel that path doesn't exist,
// so it falls back to the trace bundled into the repo at build time. Gated by the existing
// /daniotype_kasperov/:path* Basic-Auth matcher. Not wired into the served harness.
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import BUNDLED from "../zscape_v2_trace.json";

export const dynamic = "force-dynamic";

const TRACE_PATH = process.env.V2_TRACE_PATH || "/data/scratch/bench/v2_mvp/zscape_v2_trace.json";

export async function GET() {
  // disk-first (live re-runs on the build box), bundled-fallback (Vercel / prod)
  try {
    const raw = readFileSync(TRACE_PATH, "utf8");
    return new NextResponse(raw, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(BUNDLED, { headers: { "cache-control": "no-store" } });
  }
}
