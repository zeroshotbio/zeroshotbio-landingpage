// completeness.test.ts — run with:  node --test src/app/daniotype_kasperov/completeness.test.ts
// (Node 24 strips TS types natively; no test-runner dependency.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompletenessProfile, classifyArchiveReason } from "./completeness.ts";

// --- fixtures ---------------------------------------------------------------

function clusterFull(id: string) {
  return {
    id,
    label: `Cluster ${id}`,
    validated: true,
    finalLabel: "peridermal epithelial cell · mature",
    confidence: { germ_layer: { prediction: "ectoderm", pct: 72.4 } },
    addedMarkers: [{ g: "krt4" }],
    transcript: [
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ],
  };
}

function clusterBare(id: string) {
  return { id, label: `Cluster ${id}`, validated: false, finalLabel: null, confidence: null, addedMarkers: [], transcript: [] };
}

const RUN_FULL_GT = {
  schema: "daniotype_kasperov_run/v1",
  dataset: "ZSCAPE — de-novo Leiden res 1.0",
  datasetId: "zscape",
  model: "gpt-5.5",
  source: "server",
  note: "best run",
  harness: { id: "v1.1", version: "1.1" },
  cost: { usd: 9.87, estimated: true },
  scoredAt: "2026-06-15T00:00:00Z",
  groundTruth: { aggregate: [{ key: "germ_layer", pct: 93.5 }], verdicts: {} },
  clusters: [clusterFull("0"), clusterFull("1")],
};

const RUN_BARE = {
  schema: "daniotype_kasperov_run/v1",
  dataset: "MegaFin",
  datasetId: "megafin",
  model: "gpt-5.5",
  cost: { usd: 0 },
  clusters: [clusterBare("0"), clusterBare("1"), clusterBare("2")],
};

const RUN_PARTIAL = {
  // 1 of 2 clusters carries transcript+confidence; no GT; browser source.
  schema: "daniotype_kasperov_run/v1",
  dataset: "ZSCAPE",
  datasetId: "zscape",
  source: "browser",
  cost: { usd: 24.1, estimated: false },
  clusters: [clusterFull("0"), clusterBare("1")],
};

// --- per-cluster coverage ---------------------------------------------------

test("full GT run: all blocks present, coverage 1.0", () => {
  const p = computeCompletenessProfile(RUN_FULL_GT);
  assert.equal(p.hasTranscripts, true);
  assert.equal(p.transcriptCoverage, 1);
  assert.equal(p.hasConfidence, true);
  assert.equal(p.confidenceCoverage, 1);
  assert.equal(p.hasMarkers, true);
  assert.equal(p.hasLabels, true);
  assert.equal(p.labelledClusters, 2);
  assert.equal(p.hasValidated, true);
  assert.equal(p.hasGroundTruth, true);
  assert.equal(p.scored, true);
  assert.equal(p.hasHarness, true);
  assert.equal(p.hasNote, true);
  assert.equal(p.source, "server");
  assert.equal(p.costEstimated, true);
});

test("bare run: every per-cluster + run-level block absent", () => {
  const p = computeCompletenessProfile(RUN_BARE);
  assert.equal(p.nClusters, 3);
  assert.equal(p.hasTranscripts, false);
  assert.equal(p.transcriptClusters, 0);
  assert.equal(p.transcriptCoverage, 0);
  assert.equal(p.hasConfidence, false);
  assert.equal(p.hasMarkers, false);
  assert.equal(p.hasLabels, false);
  assert.equal(p.hasValidated, false);
  assert.equal(p.hasGroundTruth, false);
  assert.equal(p.scored, false);
  assert.equal(p.hasHarness, false);
  assert.equal(p.hasProvenance, false);
  assert.equal(p.hasNote, false);
  assert.equal(p.source, "unknown");
  assert.equal(p.costEstimated, false);
});

test("partial run: fractional coverage computed correctly", () => {
  const p = computeCompletenessProfile(RUN_PARTIAL);
  assert.equal(p.transcriptClusters, 1);
  assert.equal(p.transcriptCoverage, 0.5);
  assert.equal(p.confidenceClusters, 1);
  assert.equal(p.confidenceCoverage, 0.5);
  assert.equal(p.hasTranscripts, true); // "has" = at least one
  assert.equal(p.source, "browser");
  assert.equal(p.costEstimated, false);
});

// --- ground-truth present-but-unscored --------------------------------------

test("groundTruth object without aggregate is NOT scored", () => {
  const p = computeCompletenessProfile({ ...RUN_BARE, groundTruth: { verdicts: {} } });
  assert.equal(p.hasGroundTruth, true);
  assert.equal(p.scored, false);
});

// --- confidence guard mirrors applyRun --------------------------------------

test("confidence without numeric germ_layer.pct does not count", () => {
  const run = { clusters: [{ id: "0", confidence: { germ_layer: { prediction: "x" } } }] };
  assert.equal(computeCompletenessProfile(run).hasConfidence, false);
});

// --- clustering strategy: correctness rule ----------------------------------

test("dataset NAME mentioning Leiden does NOT set hasClusteringStrategy", () => {
  const p = computeCompletenessProfile(RUN_FULL_GT);
  assert.equal(p.datasetNameMentionsStrategy, true); // informational only
  assert.equal(p.hasClusteringStrategy, false); // must stay false
});

test("structured clusteringStrategy field DOES set hasClusteringStrategy", () => {
  const p = computeCompletenessProfile({ ...RUN_BARE, clusteringStrategy: { method: "leiden", res: 2.0 } });
  assert.equal(p.hasClusteringStrategy, true);
});

test("provenance.clustering nested snapshot counts", () => {
  const p = computeCompletenessProfile({ ...RUN_BARE, provenance: { clustering: "Leiden res 3.0" } });
  assert.equal(p.hasClusteringStrategy, true);
  assert.equal(p.hasProvenance, true);
});

// --- archive classification -------------------------------------------------

test("archive context: contaminated → quarantined", () => {
  const p = computeCompletenessProfile(RUN_BARE, {
    archived: true,
    archivedReason: "contaminated grounding — served MiniFin :5007 stats during labeling",
  });
  assert.equal(p.archive.archived, true);
  assert.equal(p.archive.category, "quarantined");
});

test("archive context: parked/preserved → superseded", () => {
  const p = computeCompletenessProfile(RUN_BARE, {
    archived: true,
    archivedReason: "native-schema run — parked on de-novo revert; preserved",
  });
  assert.equal(p.archive.category, "superseded");
});

test("archive context: null reason → other", () => {
  const p = computeCompletenessProfile(RUN_BARE, { archived: true, archivedReason: null });
  assert.equal(p.archive.category, "other");
});

test("not archived → archive category null", () => {
  const p = computeCompletenessProfile(RUN_BARE);
  assert.equal(p.archive.archived, false);
  assert.equal(p.archive.category, null);
});

test("classifyArchiveReason: contamination wins over supersede language", () => {
  assert.equal(classifyArchiveReason("superseded but also contaminated"), "quarantined");
  assert.equal(classifyArchiveReason(""), "other");
  assert.equal(classifyArchiveReason(undefined), "other");
});

// --- robustness: malformed input must not throw -----------------------------

test("empty / malformed runs do not throw", () => {
  for (const bad of [{}, { clusters: null }, { clusters: [{}] }, null, undefined]) {
    assert.doesNotThrow(() => computeCompletenessProfile(bad as any));
  }
  const p = computeCompletenessProfile({});
  assert.equal(p.nClusters, 0);
  assert.equal(p.datasetId, null);
});
