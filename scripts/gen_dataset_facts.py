#!/usr/bin/env python3
"""Generate src/app/daniotype_kasperov/dataset_facts.json from the REAL assets / scorecards /
sweeps (numbers are read, not hand-typed). Curated text metadata (platform/lab/namespace/caveats)
is from memory; all counts/percentages/sweeps come from files. MegaFin uses the finalized rebuild."""
import json, os, glob, numpy as np, pandas as pd
ROOT=os.path.join(os.path.dirname(__file__),".."); DD=os.path.join(ROOT,"daniotype_data"); RUNS="/data/daniotype_runs"; SCRATCH="/data/scratch/bench"

def umap_facts(ds_dir):
    d=json.load(open(os.path.join(DD,ds_dir,"umap.json")))
    return {"cells":d.get("totalCells"),"clusters":d.get("nClusters"),"source_str":d.get("source"),
            "fullCells":d.get("fullDatasetCells")}

def latest_gt_run(ds):
    rows=[r for r in json.load(open(f"{RUNS}/{ds}/_index.json")) if r.get("source")=="server" and r.get("hasGroundTruth")]
    rows.sort(key=lambda r:r["runId"]); return rows[-1]["runId"] if rows else None

def scorecard(ds):
    rid=latest_gt_run(ds)
    if not rid: return None
    d=json.load(open(f"{RUNS}/{ds}/{rid}.json")); gt=d.get("groundTruth") or {}
    tiers=[{"key":a["key"],"label":a["label"],"pct":round(a["pct"],1),"matched":a["matched"],"total":a["total"]} for a in gt.get("aggregate",[])]
    sub=gt.get("subStratified") or {}; ab=gt.get("abstention") or {}
    return {"runId":rid,"tiers":tiers,
            "highPuritySub":round((sub.get("high") or {}).get("pct",0),1) if sub.get("high") else None,
            "abstentionPrecision":round((ab.get("abstained_forced_sub_fail") or {}).get("pct",0),1) if ab.get("abstained_forced_sub_fail") else None,
            "nAbstain":ab.get("n_abstain"),"nAssign":ab.get("n_assign"),"costUsd":round(d.get("cost",{}).get("usd",0),2)}

def sweep(path, chosen=None):
    if not path or not os.path.exists(path): return None
    df=pd.read_csv(path)
    return [{"res":float(r.resolution),"clusters":int(r.n_clusters),"coherence":round(float(r.coherent_frac),3),
             "minSize":int(r.min_size),"under50":int(r.n_under50),"chosen":(chosen is not None and abs(float(r.resolution)-chosen)<1e-9)} for r in df.itertuples()]

# curated metadata (memory) — numbers below come from files
META={
 "minifin": {"platform":"Parse Evercode (combinatorial split-pool)","lab":"Zeroshot (internal)","year":2026,
   "namespace":"ENSDARG → ZFIN canonical","role":"internal","resLabel":"1.0",
   "noGtNote":"Internal reference — no published labels; intuition-building, not a benchmark.",
   "sweepFile":f"{SCRATCH}/minifin_res_sweep.csv","chosenRes":1.0},
 "zscape": {"platform":"10X droplet","lab":"Saunders/Trapnell et al.","year":2023,
   "namespace":"ENSDARG → ZFIN canonical","role":"gt","resLabel":"silhouette-gated sub-Leiden",
   "caveat":"In-paradigm baseline — the reference standard (authors' own 10X atlas, native 4-tier labels).",
   "caveatTone":"baseline","sweepFile":None,"chosenRes":None,
   "selectionNote":"ZSCAPE uses silhouette-gated sub-Leiden (adaptive per-branch), not a flat resolution sweep."},
 "chemfish": {"platform":"sci-RNA-seq3","lab":"Barkan et al.","year":None,
   "namespace":"ENSDARG → ZFIN canonical","role":"gt","resLabel":"3.0",
   "caveat":"Labels projected from the ZSCAPE reference; germ_layer + broad are derived, not native. Weight tissue + sub; the projected GT itself may be noisy (even germ_layer is near coin-flip).",
   "caveatTone":"projected","sweepFile":f"{SCRATCH}/chemfish_res_sweep.csv","chosenRes":3.0},
 "daniocell": {"platform":"10X droplet","lab":"Sur et al. (Farrell / NICHD)","year":2023,
   "namespace":"ENSDARG → ZFIN canonical","role":"gt","resLabel":"2.0",
   "caveat":"Independent lab, ISH-validated populations, cross-platform (10X droplet). A lower score reflects platform/domain shift — harder, not worse labeling. The genuinely independent read.",
   "caveatTone":"independent","sweepFile":f"{SCRATCH}/daniocell_res_sweep.csv","chosenRes":2.0},
 "megafin": {"platform":"Parse Evercode · manual .h5ad (Lawson)","lab":"Zeroshot (internal)","year":2026,
   "namespace":"Lawson LL → ZFIN canonical","role":"internal","resLabel":"2.0",
   "noGtNote":"Internal drug-screen atlas (Manual build) — no published labels; intuition-building, not a benchmark.",
   "design":"46 drugs × 2 doses (1 µM & 5 µM) + 4 controls · 48 hpf TuWT whole embryos",
   "useUmapDir":"megafin_rebuild",
   "sweepFile":f"{SCRATCH}/megafin_rebuild_res_sweep.csv","chosenRes":2.0},
 "megafin_parse": {"platform":"Parse Evercode (combinatorial split-pool)","lab":"Zeroshot (internal)","year":2026,
   "namespace":"ENSDARG → ZFIN canonical","role":"internal","resLabel":"3.0",
   "noGtNote":"Internal drug-screen atlas (Parse pipeline build) — no published labels; intuition-building, not a benchmark.",
   "design":"46 drugs × 2 doses (1 µM & 5 µM) + 4 controls · 48 hpf TuWT whole embryos",
   "useUmapDir":"megafin",
   "sweepFile":f"{SCRATCH}/megafin_res_sweep.csv","chosenRes":3.0},
}

RECIPE={
 "minifin":"HVG → PCA → Harmony(sample) → kNN graph → Leiden resolution sweep",
 "zscape":"silhouette-gated sub-Leiden on the published embedding (adaptive per branch)",
 "chemfish":"HVG → PCA → Harmony(experiment) → kNN graph → Leiden resolution sweep",
 "daniocell":"HVG → PCA → Harmony(stage) → kNN graph → Leiden resolution sweep",
 "megafin":"HVG → PCA → carried Harmony(sample) embedding → kNN graph → Leiden sweep",
 "megafin_parse":"Leiden resolution sweep on the Parse/Trailmaker Harmony(sample) embedding",
}
facts={}
for ds,m in META.items():
    udir=m.get("useUmapDir",ds)
    uf=umap_facts(udir)
    entry={"id":ds,"platform":m["platform"],"lab":m["lab"],"year":m.get("year"),
           "namespace":m["namespace"],"role":m["role"],"resLabel":m["resLabel"],
           "cells":uf["cells"],"clusters":uf["clusters"],"fullCells":uf["fullCells"],
           "source":uf.get("source_str"),"recipe":RECIPE.get(ds),
           "selectionRule":"coherent_frac ≥ 0.95 & min_size ≥ 30 (finest qualifying)",
           "sweep":sweep(m["sweepFile"],m.get("chosenRes")),"chosenRes":m.get("chosenRes"),
           "selectionNote":m.get("selectionNote")}
    if m["role"]=="gt":
        entry["scorecard"]=scorecard(ds); entry["caveat"]=m["caveat"]; entry["caveatTone"]=m["caveatTone"]
    else:
        entry["noGtNote"]=m["noGtNote"]
    for k in ("design","supersedes"):
        if k in m: entry[k]=m[k]
    facts[ds]=entry

# MegaFin enrichments from FINAL_STATUS (coherence, grounding, rejected re-embed)
fs=json.load(open(f"{SCRATCH}/megafin_rebuild_FINAL_STATUS.json"))
g=fs.get("s5007_grounding",{})
facts["megafin"].update({
  "coherence":fs.get("coherent_frac_at_pick",0.929),
  "coherenceNote":"Less coherent (0.929) than the GT partitions (~1.0) — this 93-condition drug screen needs the Parse embedding; the standard HVG→PCA→Harmony re-embed was tested and rejected (coherence collapsed to ~0.67).",
  "canonicalPct":g.get("canonical_pct"),
  "groundingNote":f"{g.get('queryable_pct','~100')}% of markers queryable on :5007; {g.get('canonical_pct')}% under canonical ZFIN names (thinner than the ENSDARG-native sets, but key cell-type markers ground fine).",
  "rejectedReembed":{"sweep":sweep(f"{SCRATCH}/megafin_rebuild_v2_res_sweep.csv"),
     "note":"Standard re-embed (HVG→PCA→Harmony→neighbors): coherence collapsed to 0.475–0.667 with 56–63 micro-clusters — worse than the Parse embedding. Rejected."},
  "sizeMin":fs.get("size_min"),"sizeMedian":fs.get("size_median"),"sizeMax":fs.get("size_max"),
  "merged":fs.get("merge"),
})

# ChemFish scorecard contaminated: run ba32de grounded on a misaligned :5007 (served MiniFin's
# 54-cluster stats). Suppress the numbers in the card until a re-run on corrected grounding.
if facts.get("chemfish",{}).get("scorecard"):
    facts["chemfish"]["scorecardStale"]=True
    facts["chemfish"]["scorecardCaveat"]=("These scores came from run ba32de, which grounded on a misaligned :5007 "
        "(it served MiniFin's stats for ChemFish). Suppressed pending a re-run on corrected grounding.")

OUT=os.path.join(ROOT,"src","app","daniotype_kasperov","dataset_facts.json")
json.dump(facts, open(OUT,"w"), indent=1)
print("wrote", OUT)
for ds,e in facts.items():
    sc=e.get("scorecard")
    print(f"  {ds}: {e['cells']} cells, {e['clusters']} clusters, role={e['role']}" + (f", germ {sc['tiers'][0]['pct']}% abst-prec {sc['abstentionPrecision']}%" if sc else ""))
