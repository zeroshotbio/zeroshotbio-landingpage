// src/app/api/kasperov_asset/[...slug]/route.ts
//
// Serves the DanioType wizard's data JSONs (umap / per-cluster archivist profiles /
// gene_matrix / groundtruth) from a NON-public dir (daniotype_data/), so the core
// marker data is never world-readable as a static file. This route is gated by the
// Basic-Auth middleware (same as the page + agent), so only an authenticated browser
// can fetch it. Server-to-server consumers (agent/confidence routes) read the files
// directly off disk instead of going through this gated route.
import "server-only";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "daniotype_data");
const SEG = /^[A-Za-z0-9._-]+$/; // no slashes, no "..", no traversal

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await ctx.params;
  if (
    !Array.isArray(slug) || slug.length === 0 || slug.length > 4 ||
    !slug.every((s) => SEG.test(s) && s !== "..") ||
    !slug[slug.length - 1].endsWith(".json")
  ) {
    return new Response("bad request", { status: 400 });
  }
  const file = path.join(DATA_DIR, ...slug);
  if (file !== DATA_DIR && !file.startsWith(DATA_DIR + path.sep)) {
    return new Response("bad request", { status: 400 });
  }
  try {
    const buf = await readFile(file, "utf8");
    return new Response(buf, {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "private, max-age=300" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
