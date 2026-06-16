// completeness_report.ts — Phase 1 distribution report (read-only, no mutation).
//
// Walks /data/daniotype_runs, runs computeCompletenessProfile() over EVERY run
// file (active + archived), and prints how common each capability block is,
// broken down by dataset, plus the full archived-runs list with reasons +
// derived category. This is the signal for which blocks are load-bearing
// before we design the viewer.
//
//   node scripts/completeness_report.ts            # human-readable
//   node scripts/completeness_report.ts --json      # raw JSON dump
//
// Touches nothing: no writes to _index.json, no promotions, no worker calls.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { computeCompletenessProfile, type CompletenessProfile } from "../src/app/daniotype_kasperov/completeness.ts";

const RUNS_DIR = process.env.AUTOPILOT_RUNS_DIR || "/data/daniotype_runs";
const NOT_DATASETS = new Set(["gifs"]);

function readJSON(p: string): any {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// reason map from a sidecar array ([{runId, archivedReason}, ...])
function reasonMap(p: string): Map<string, string | null> {
  const m = new Map<string, string | null>();
  const arr = existsSync(p) ? readJSON(p) : null;
  if (Array.isArray(arr)) for (const e of arr) if (e?.runId) m.set(e.runId, e.archivedReason ?? null);
  return m;
}

interface Row {
  datasetId: string;
  runId: string;
  profile: CompletenessProfile;
}

const rows: Row[] = [];

const datasets = readdirSync(RUNS_DIR).filter((d) => {
  if (NOT_DATASETS.has(d)) return false;
  try {
    return statSync(join(RUNS_DIR, d)).isDirectory();
  } catch {
    return false;
  }
});

for (const ds of datasets) {
  const dir = join(RUNS_DIR, ds);
  const archived = reasonMap(join(dir, "_archive.json"));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  for (const f of files) {
    const runId = f.replace(/\.json$/, "");
    const run = readJSON(join(dir, f));
    if (!run) continue;
    const isArchived = archived.has(runId);
    const profile = computeCompletenessProfile(run, {
      archived: isArchived,
      archivedReason: isArchived ? archived.get(runId) : null,
    });
    rows.push({ datasetId: ds, runId, profile });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 1));
  process.exit(0);
}

// --- human-readable -----------------------------------------------------------
const N = rows.length;
const byDataset = new Map<string, Row[]>();
for (const r of rows) (byDataset.get(r.datasetId) ?? byDataset.set(r.datasetId, []).get(r.datasetId)!).push(r);

const FLAGS: { key: keyof CompletenessProfile; label: string }[] = [
  { key: "hasLabels", label: "labels (finalLabel)" },
  { key: "hasConfidence", label: "tier confidence" },
  { key: "hasTranscripts", label: "chat transcripts" },
  { key: "hasMarkers", label: "added markers" },
  { key: "hasValidated", label: "validated flags" },
  { key: "hasGroundTruth", label: "ground truth" },
  { key: "scored", label: "GT scored" },
  { key: "hasHarness", label: "harness stamp" },
  { key: "hasProvenance", label: "provenance" },
  { key: "hasClusteringStrategy", label: "clustering strategy (structured)" },
  { key: "hasNote", label: "note" },
  { key: "costEstimated", label: "cost estimated" },
];

const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

console.log(`\n===== daniotype_kasperov run-store completeness report =====`);
console.log(`store: ${RUNS_DIR}`);
console.log(`datasets: ${datasets.join(", ")}`);
console.log(`total runs scanned: ${N}\n`);

// per-dataset counts
const dsNames = [...byDataset.keys()].sort();
console.log(`runs per dataset (active+archived):`);
for (const ds of dsNames) {
  const list = byDataset.get(ds)!;
  const arch = list.filter((r) => r.profile.archive.archived).length;
  console.log(`  ${pad(ds, 16)} ${padL(String(list.length), 3)}  (${arch} archived)`);
}

// flag distribution overall + per dataset
console.log(`\nflag distribution  (count / total ; per-dataset count where present):`);
console.log(`  ${pad("flag", 34)} ${padL("all", 8)}   by dataset`);
for (const { key, label } of FLAGS) {
  const total = rows.filter((r) => r.profile[key] as boolean).length;
  const perDs = dsNames
    .map((ds) => {
      const c = byDataset.get(ds)!.filter((r) => r.profile[key] as boolean).length;
      const t = byDataset.get(ds)!.length;
      return c > 0 ? `${ds}:${c}/${t}` : null;
    })
    .filter(Boolean)
    .join("  ");
  console.log(`  ${pad(label, 34)} ${padL(`${total}/${N}`, 8)}   ${perDs || "—"}`);
}

// coverage spread for the per-cluster blocks (where present, how complete)
console.log(`\nper-cluster coverage when present (min / median / max fraction of clusters):`);
function spread(sel: (p: CompletenessProfile) => number, has: (p: CompletenessProfile) => boolean) {
  const vals = rows.filter((r) => has(r.profile)).map((r) => sel(r.profile)).sort((a, b) => a - b);
  if (!vals.length) return "—";
  const m = vals[Math.floor(vals.length / 2)];
  return `${vals[0].toFixed(2)} / ${m.toFixed(2)} / ${vals[vals.length - 1].toFixed(2)}  (n=${vals.length})`;
}
console.log(`  transcripts : ${spread((p) => p.transcriptCoverage, (p) => p.hasTranscripts)}`);
console.log(`  confidence  : ${spread((p) => p.confidenceCoverage, (p) => p.hasConfidence)}`);
console.log(`  markers     : ${spread((p) => p.markerCoverage, (p) => p.hasMarkers)}`);
console.log(`  labels      : ${spread((p) => p.labelCoverage, (p) => p.hasLabels)}`);

// archived inventory
const archivedRows = rows.filter((r) => r.profile.archive.archived);
console.log(`\n===== archived runs (${archivedRows.length}) — reason + derived category =====`);
console.log(`(no promotions performed; you decide promotions separately)`);
const byCat = new Map<string, Row[]>();
for (const r of archivedRows) (byCat.get(r.profile.archive.category!) ?? byCat.set(r.profile.archive.category!, []).get(r.profile.archive.category!)!).push(r);
for (const cat of ["quarantined", "superseded", "other"]) {
  const list = byCat.get(cat) ?? [];
  console.log(`\n  [${cat}]  ${list.length}`);
  for (const r of list) {
    const p = r.profile;
    const blocks = [p.hasLabels && "labels", p.hasConfidence && "conf", p.hasTranscripts && "chat", p.scored && "scored", p.hasGroundTruth && "gt"].filter(Boolean).join(",");
    console.log(`    ${pad(r.datasetId + "/" + r.runId, 38)} n=${padL(String(p.nClusters), 3)}  [${blocks}]`);
    console.log(`        reason: ${p.archive.reason ?? "(none recorded)"}`);
  }
}

// orphan check: run files in neither _index nor _archive
console.log(`\n===== index reconciliation =====`);
for (const ds of dsNames) {
  const dir = join(RUNS_DIR, ds);
  const idx = existsSync(join(dir, "_index.json")) ? readJSON(join(dir, "_index.json")) : [];
  const idxIds = new Set((Array.isArray(idx) ? idx : []).map((e: any) => e?.runId));
  const archIds = reasonMap(join(dir, "_archive.json"));
  const orphans = byDataset.get(ds)!.filter((r) => !idxIds.has(r.runId) && !archIds.has(r.runId));
  if (orphans.length) console.log(`  ${ds}: ${orphans.length} orphan run file(s) (in neither _index nor _archive): ${orphans.map((o) => o.runId).join(", ")}`);
}
console.log(`\n(end)\n`);
