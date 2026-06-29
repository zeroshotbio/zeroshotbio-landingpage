// v2 MVP substrate: from the res08 recursive build's clusters.json, emit a GT-BLIND
// substrate (compartments + leaves + markers) the harness labels, and a SEPARATE GT
// file (never passed to prompts) for later scoring + demo curation.
import fs from "node:fs";
const SRC = "/data/scratch/bench/zscape_recursive_ctrlvote_48hpf_res08/clusters.json";
const OUT = "/data/scratch/bench/v2_mvp";
const d = JSON.parse(fs.readFileSync(SRC, "utf8"));
const leaves = d.clusters; // each: {id:"c.s", compartment, nCells, degsUp:[names], gt_control, gt_allcell}

// group leaves by compartment
const byComp = {};
for (const lf of leaves) (byComp[lf.compartment] ??= []).push(lf);

// derive a coarse compartment marker signature: rank genes by how many of the
// compartment's leaves list them as a top marker (shared program), tie-break by best rank.
function coarseMarkers(lvs, topN = 14) {
  const freq = new Map(), bestRank = new Map();
  for (const lf of lvs) (lf.degsUp || []).forEach((g, i) => {
    freq.set(g, (freq.get(g) || 0) + 1);
    bestRank.set(g, Math.min(bestRank.get(g) ?? 99, i));
  });
  return [...freq.keys()]
    .sort((a, b) => (freq.get(b) - freq.get(a)) || (bestRank.get(a) - bestRank.get(b)))
    .slice(0, topN);
}

const compartments = Object.keys(byComp).sort((a, b) => +a - +b).map((cid) => {
  const lvs = byComp[cid];
  return {
    id: `comp:${cid}`,
    compartment: cid,
    nCells: lvs.reduce((s, l) => s + l.nCells, 0),
    nLeaves: lvs.length,
    leafIds: lvs.map((l) => l.id).sort((a, b) => (+a.split(".")[1]) - (+b.split(".")[1])),
    degsUp: coarseMarkers(lvs),
  };
});

const leafOut = {};
for (const lf of leaves) leafOut[lf.id] = { compartment: lf.compartment, nCells: lf.nCells, degsUp: lf.degsUp || [] };

const substrate = {
  provenance: { ...d.provenance, source: SRC, note: "GT-BLIND substrate for v2 MVP. Coarse compartment markers are derived from leaf-marker frequency (NOT a fresh one-vs-rest DEG) — MVP approximation." },
  nCompartments: compartments.length,
  nLeaves: leaves.length,
  compartments,
  leaves: leafOut,
};
fs.writeFileSync(`${OUT}/zscape_v2_substrate.json`, JSON.stringify(substrate, null, 1));

// SEPARATE GT (control-vote) — for scoring + demo curation ONLY; never enters prompts.
const gt = { _warning: "GT — control-vote. NEVER inject into any prompt. For scoring/curation only.", leaves: {}, compartments: {} };
for (const lf of leaves) gt.leaves[lf.id] = { gt_control: lf.gt_control, gt_allcell: lf.gt_allcell };
for (const c of compartments) {
  // dominant control-vote tissue across the compartment's leaves (curation aid)
  const tally = {};
  for (const id of c.leafIds) { const t = gt.leaves[id]?.gt_control?.tissue?.label; if (t) tally[t] = (tally[t] || 0) + (leafOut[id].nCells || 1); }
  const dom = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  gt.compartments[c.id] = { dominantTissue_byCells: dom ? dom[0] : null, tissueMix: tally };
}
fs.writeFileSync(`${OUT}/zscape_v2_gt.json`, JSON.stringify(gt, null, 1));

console.log(`substrate: ${compartments.length} compartments, ${leaves.length} leaves`);
console.log("compartments (id · nCells · nLeaves · top6 coarse markers):");
for (const c of compartments) console.log(`  ${c.id}  n=${c.nCells}  leaves=${c.nLeaves}  [${c.degsUp.slice(0,6).join(", ")}]  → GTdom: ${gt.compartments[c.id].dominantTissue_byCells}`);
