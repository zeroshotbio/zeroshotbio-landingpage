// ssmpServer.ts — server-side glue that feeds the GT-BLIND SSMP core (ssmp.ts) with a dataset's
// archivist DE. SSMP must be computed from the FULL archivist marker tables (a run's truncated
// top-K markers collapse SSMP to noise), so the DE is read from the archivist assets.
//
// The archivist assets live under daniotype_data/ (~1.5 GB) and are served STATICALLY by nginx —
// they are NOT bundled into the Vercel function (that read exceeded the 250 MB function cap and
// broke deploys). This module therefore FETCHES the per-dataset `ssmp_idf.json` (precomputed IDF)
// and the per-leaf archivist JSONs over HTTP, exactly like kasperov_agent/route.ts — no fs reads
// of process.cwd(), so nothing large is traced into the bundle.
//
// Best-effort + ADVISORY: if the IDF/DE isn't reachable it silently skips — SSMP is a review flag,
// it must never block consolidation. Never reads labels or GT.
import { specificSet, annotateMerges, type LeafSpecificSets } from "./ssmp";

// nginx-served asset host (daniotype_data/), overridable per environment. Same default + env as
// kasperov_agent/kasperov_fit/kasperov_confidence — keeps the big assets out of the Vercel bundle.
const ASSET_HOST = (process.env.DANIOTYPE_ASSET_BASE || "https://zscape.zeroshot.bio/daniotype_data").replace(/\/$/, "");

const idfCache: Record<string, Record<string, number> | null> = {};

async function fetchJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Precomputed per-dataset IDF (daniotype_data/<ds>/ssmp_idf.json). Cached per process. Returns
// null when unavailable → the caller skips (advisory). The old readdir-the-whole-archivist-dir
// fallback is gone: every dataset with an archivist ships a precomputed ssmp_idf.json, and a dir
// listing can't be done over static HTTP anyway.
async function loadIDF(datasetId: string): Promise<Record<string, number> | null> {
  if (datasetId in idfCache) return idfCache[datasetId];
  const idf = await fetchJson(`${ASSET_HOST}/${datasetId}/ssmp_idf.json`);
  const val = idf && typeof idf === "object" ? (idf as Record<string, number>) : null;
  idfCache[datasetId] = val;
  return val;
}

// Attach { ssmp } to each merge in place using the dataset's archivist DE + IDF (fetched from
// nginx). GT-blind, advisory. Async now (network fetch) — callers must await.
export async function annotateProposalSSMP(
  datasetId: string | undefined,
  merges: Array<{ member_leaf_ids?: string[]; ssmp?: number | null }>,
): Promise<void> {
  try {
    if (!datasetId || !Array.isArray(merges) || merges.length === 0) return;
    const idf = await loadIDF(datasetId);
    if (!idf) return; // no precomputed IDF for this dataset -> skip (advisory)
    const need = new Set<string>();
    for (const m of merges) for (const id of m.member_leaf_ids || []) need.add(String(id));
    const ids = Array.from(need);
    const sets: LeafSpecificSets = {};
    await Promise.all(
      ids.map(async (id) => {
        const d = await fetchJson(`${ASSET_HOST}/${datasetId}/archivist/${id}.json`);
        if (d && Array.isArray(d.genes)) sets[id] = specificSet(d.genes);
      }),
    );
    annotateMerges(merges, sets, idf);
  } catch {
    /* advisory only — never let SSMP annotation break consolidation */
  }
}
