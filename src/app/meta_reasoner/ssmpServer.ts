// ssmpServer.ts — server-side glue that feeds the GT-BLIND SSMP core (ssmp.ts) with a dataset's
// archivist DE. SSMP must be computed from the FULL archivist marker tables (a run's truncated
// top-K markers collapse SSMP to noise), so this reads them from disk. Best-effort + ADVISORY:
// if the DE/IDF isn't available it silently skips — SSMP is a review flag, it must never block
// consolidation. Never reads labels or GT.
import fs from "fs";
import path from "path";
import { specificSet, computeIDF, annotateMerges, type LeafSpecificSets } from "./ssmp";

const ASSET_ROOT = path.join(process.cwd(), "daniotype_data");
const idfCache: Record<string, Record<string, number>> = {};

function loadIDF(datasetId: string, archDir: string): Record<string, number> {
  if (idfCache[datasetId]) return idfCache[datasetId];
  const idfPath = path.join(ASSET_ROOT, datasetId, "ssmp_idf.json");
  let idf: Record<string, number>;
  if (fs.existsSync(idfPath)) {
    idf = JSON.parse(fs.readFileSync(idfPath, "utf8")); // precomputed per-dataset asset (preferred)
  } else {
    const all: LeafSpecificSets = {};
    for (const f of fs.readdirSync(archDir)) {
      if (!f.endsWith(".json")) continue;
      const g = JSON.parse(fs.readFileSync(path.join(archDir, f), "utf8")).genes || [];
      all[f.replace(".json", "")] = specificSet(g);
    }
    idf = computeIDF(all);
  }
  idfCache[datasetId] = idf;
  return idf;
}

// Attach { ssmp } to each merge in place using the dataset's archivist DE + IDF. GT-blind, advisory.
export function annotateProposalSSMP(datasetId: string | undefined, merges: Array<{ member_leaf_ids?: string[]; ssmp?: number | null }>): void {
  try {
    if (!datasetId || !Array.isArray(merges) || merges.length === 0) return;
    const archDir = path.join(ASSET_ROOT, datasetId, "archivist");
    if (!fs.existsSync(archDir)) return; // no DE for this dataset -> skip (advisory)
    const idf = loadIDF(datasetId, archDir);
    const need = new Set<string>();
    for (const m of merges) for (const id of m.member_leaf_ids || []) need.add(String(id));
    const sets: LeafSpecificSets = {};
    for (const id of Array.from(need)) {
      const p = path.join(archDir, `${id}.json`);
      if (fs.existsSync(p)) sets[id] = specificSet(JSON.parse(fs.readFileSync(p, "utf8")).genes || []);
    }
    annotateMerges(merges, sets, idf);
  } catch {
    /* advisory only — never let SSMP annotation break consolidation */
  }
}
