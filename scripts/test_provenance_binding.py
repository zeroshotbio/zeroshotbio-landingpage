#!/usr/bin/env python3
"""Standing assertions for the provenance binding. Run from repo root.

Closes the run-binding question: the dataset->run map is the single committed
canonical_runs.json, and the {ds}.jsonl<->run finalLabel match is asserted on
every run (not a one-time check) — so a cbe006-style mix-up fails CI, not prod.
"""
import os, json

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # scripts/ -> repo root
RUNSTORE = "/data/daniotype_runs"
RUNDIR   = "/data/scratch/bench/nogt_run"
TIPS_ORIGIN = {"provOwnEmbed", "provCarriedEmbed", "provVendorPartition"}
NATIVE = {"zscape", "chemfish", "daniocell"}
CARDED = ["zscape", "chemfish", "daniocell", "megafin", "megafin_parse", "minifin"]
# asset/umap dirs (INVERTED for megafin); run-store dirs are identity (RUN_DIR == id)
DATASET_DIR = {"zscape": "zscape", "chemfish": "chemfish", "daniocell": "daniocell",
               "megafin": "megafin_rebuild", "megafin_parse": "megafin", "minifin": "minifin"}

def _canon():
    return json.load(open(os.path.join(REPO, "scripts", "canonical_runs.json")))

def test_canonical_run_binding():
    canon = _canon()
    facts = json.load(open(os.path.join(REPO, "src/app/daniotype_kasperov/dataset_facts.json")))
    for ds in CARDED:
        rid = canon[ds]
        runpath = f"{RUNSTORE}/{ds}/{rid}.json"            # run-store keyed by datasetId == id
        assert os.path.exists(runpath), f"{ds}: canonical run {rid} missing at {runpath}"
        # (a) GT card's evidentiaryRunId must equal the canonical map
        if ds in NATIVE:
            assert facts[ds]["scorecard"]["evidentiaryRunId"] == rid, \
                f"{ds}: GT evidentiaryRunId != canonical_runs[{ds}]"
        # (b) STANDING PROOF: every {ds}.jsonl finalLabel == the canonical run's finalLabel
        #     (megafin 84/84, megafin_parse 77/77, minifin 54/54 — would have caught cbe006)
        jl = f"{RUNDIR}/{ds}.jsonl"
        if os.path.exists(jl):
            run = {str(c["id"]): str(c["finalLabel"]).strip()
                   for c in json.load(open(runpath))["clusters"]}
            stream = {}
            for line in open(jl):
                r = json.loads(line); stream[str(r["id"])] = str(r["finalLabel"]).strip()
            common = run.keys() & stream.keys()
            mism = [k for k in common if run[k] != stream[k]]
            assert not mism and len(common) == len(stream), \
                f"{ds}: jsonl<->run finalLabel drift on {mism[:5]} — binding broken"

def test_provenance_blocks():
    facts = json.load(open(os.path.join(REPO, "src/app/daniotype_kasperov/dataset_facts.json")))
    canon = _canon()
    for ds in CARDED:
        p = facts[ds].get("provenance")
        assert p, f"{ds}: missing provenance block"
        assert p["originTip"] in TIPS_ORIGIN, f"{ds}: bad originTip {p['originTip']}"
        # partitionId == umap.partitionId, or an honest TODO
        um = json.load(open(os.path.join(REPO, f"daniotype_data/{DATASET_DIR[ds]}/umap.json"))).get("partitionId")
        pid = str(p["partitionId"])
        assert pid.startswith("TODO") or pid == um, f"{ds}: partitionId {pid!r} != umap {um!r}"
        # labellingRunId must equal the canonical map (single source of truth)
        assert p["labellingRunId"] == canon[ds], \
            f"{ds}: labellingRunId {p['labellingRunId']} != canonical_runs[{ds}]"
        assert p["groundingOntologies"], f"{ds}: empty groundingOntologies"
        if facts[ds].get("role") == "gt":
            assert p.get("scoredBasis") == "native-schema", f"{ds}: GT scoredBasis not native-schema"

if __name__ == "__main__":
    test_canonical_run_binding(); test_provenance_blocks()
    print("OK — canonical run binding + provenance blocks verified")
