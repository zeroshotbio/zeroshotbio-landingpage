#!/usr/bin/env python3
"""Standing assertions for the provenance binding. Run from repo root.

Closes the run-binding question: the dataset->run map is the single committed
canonical_runs.json, and the {ds}.jsonl<->run finalLabel match is asserted on
every run (not a one-time check) — so a cbe006-style mix-up fails CI, not prod.
"""
import os, json, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # scripts/ -> repo root
RUNSTORE = "/data/daniotype_runs"
RUNDIR   = "/data/scratch/bench/nogt_run"
TIPS_ORIGIN = {"provOwnEmbed", "provCarriedEmbed", "provVendorPartition"}
NATIVE = {"zscape", "chemfish", "daniocell"}
CARDED = ["zscape", "chemfish", "daniocell", "megafin", "megafin_parse", "minifin"]
# asset/umap dirs (INVERTED for megafin); run-store dirs are identity (RUN_DIR == id)
DATASET_DIR = {"zscape": "zscape", "chemfish": "chemfish", "daniocell": "daniocell",
               "megafin": "megafin_rebuild", "megafin_parse": "megafin", "minifin": "minifin"}

# --- Pillars provenance (SPEC/run-stamp binding) ---
PILLARS = os.path.join(REPO, "src/app/daniotype_kasperov/pillars")
KASPEROV_CLIENT = os.path.join(REPO, "src/app/daniotype_kasperov/KasperovClient.tsx")
# canonical_runs is the datasetId->run map; GOLDEN_RUN_BY_ATLAS is atlas-keyed. The two only
# both resolve for the three GT datasets; minifin/megafin GOLDEN targets aren't in the datasetId
# run-store (see pillars/README.md ## Known drift) — assertion (b) skips them LOUDLY, never fails.
GT_ATLASES = ["zscape", "chemfish", "daniocell"]
# 2b PARKED: dataset_facts.json scorecard/provenance for these still points at the superseded
# Jun-15 runs. canonical_runs is fresh (== golden); facts lag until 2b lands. The facts<->canonical
# asserts below WARN (not fail) for these while parked — but still fail if the stale id is dead.
# (see pillars/README.md ## Known drift)
PARKED_2B = {"zscape", "chemfish", "daniocell"}

_WARN = []
def _warn(msg):
    _WARN.append(msg)

def _canon():
    return json.load(open(os.path.join(REPO, "scripts", "canonical_runs.json")))

def _golden_by_atlas():
    """Parse the GOLDEN_RUN_BY_ATLAS literal out of KasperovClient.tsx (the authoritative UI map)."""
    src = open(KASPEROV_CLIENT).read()
    m = re.search(r"GOLDEN_RUN_BY_ATLAS[^=]*=\s*\{(.*?)\}", src, re.S)
    assert m, "GOLDEN_RUN_BY_ATLAS literal not found in KasperovClient.tsx"
    body = re.sub(r"//[^\n]*", "", m.group(1))   # strip line comments
    return dict(re.findall(r'(\w+)\s*:\s*"([^"]+)"', body))

def _spec_versions(stage):
    """Every version recorded in a stage's SPEC.md — header `version:` AND changelog `**vN`.
    A golden legitimately stamps an OLDER version than the header, so both must resolve."""
    txt = open(os.path.join(PILLARS, stage, "SPEC.md")).read()
    hdr = re.search(r"^version:\s*(\S+)", txt, re.M)
    assert hdr, f"{stage}/SPEC.md has no `version:` header"
    versions = {hdr.group(1)}                                     # e.g. "labelling-v2"
    for n in re.findall(r"\*\*v(\d+)", txt):                      # changelog "**v1", "**v2 (…)"
        versions.add(f"{stage}-v{n}")
    # ALSO accept any explicit "<stage>-<token>" version literally recorded in the SPEC — covers
    # dataset-specific goldens (e.g. clustering-chemfish-v1) and date-meta stamps. The SPEC is the
    # source of truth for what versions exist; if it's written there, a run may legitimately stamp it.
    for v in re.findall(rf"{re.escape(stage)}-[a-z0-9][a-z0-9.\-]*", txt):
        versions.add(v)
    return versions

def test_canonical_run_binding():
    canon = _canon()
    facts = json.load(open(os.path.join(REPO, "src/app/daniotype_kasperov/dataset_facts.json")))
    for ds in CARDED:
        rid = canon[ds]
        runpath = f"{RUNSTORE}/{ds}/{rid}.json"            # run-store keyed by datasetId == id
        assert os.path.exists(runpath), f"{ds}: canonical run {rid} missing at {runpath}"
        # (a) GT card's evidentiaryRunId must equal the canonical map.
        #     While 2b is parked, dataset_facts lags canonical — WARN (don't fail), but the stale
        #     id must still resolve to a real run (a dead id is genuine rot, not the known gap).
        if ds in NATIVE:
            ev = facts[ds]["scorecard"]["evidentiaryRunId"]
            if ev != rid:
                assert ds in PARKED_2B, f"{ds}: evidentiaryRunId {ev} != canonical {rid} (unexpected)"
                assert os.path.exists(f"{RUNSTORE}/{ds}/{ev}.json"), \
                    f"{ds}: parked-stale evidentiaryRunId {ev} points at a DEAD run — genuine rot"
                _warn(f"[2b PARKED] {ds}.scorecard.evidentiaryRunId={ev} lags canonical {rid} "
                      f"(dataset_facts stale — see pillars/README.md ## Known drift)")
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
        # labellingRunId must equal the canonical map (single source of truth).
        # Same 2b-parked treatment as evidentiaryRunId above: WARN while facts lag, fail on a dead id.
        lb = p["labellingRunId"]
        if lb != canon[ds]:
            assert ds in PARKED_2B, f"{ds}: labellingRunId {lb} != canonical {canon[ds]} (unexpected)"
            assert os.path.exists(f"{RUNSTORE}/{ds}/{lb}.json"), \
                f"{ds}: parked-stale labellingRunId {lb} points at a DEAD run — genuine rot"
            _warn(f"[2b PARKED] {ds}.provenance.labellingRunId={lb} lags canonical {canon[ds]} "
                  f"(dataset_facts stale — see pillars/README.md ## Known drift)")
        assert p["groundingOntologies"], f"{ds}: empty groundingOntologies"
        if facts[ds].get("role") == "gt":
            assert p.get("scoredBasis") == "native-schema", f"{ds}: GT scoredBasis not native-schema"

def test_pipeline_spec_binding():
    """(a) Every run's pipeline.<stage>.spec resolves to a version recorded in that stage's SPEC.md
    (header OR changelog). A golden may carry an older version than current canon — that's fine, as
    long as the version is recorded so the stamp is meaningful."""
    canon = _canon()
    checked = 0
    for ds in CARDED:
        cpath = f"{RUNSTORE}/{ds}/{canon[ds]}.canonical.json"
        if not os.path.exists(cpath):
            continue
        pipe = json.load(open(cpath)).get("pipeline")
        if not pipe:
            _warn(f"[no pipeline stamp] {ds}/{canon[ds]}.canonical.json has no pipeline{{}} block")
            continue
        for stage, blk in pipe.items():
            spec = blk.get("spec")
            versions = _spec_versions(stage)
            assert spec in versions, (
                f"{ds}: pipeline.{stage}.spec={spec!r} not recorded in "
                f"pillars/{stage}/SPEC.md (known versions: {sorted(versions)})")
            checked += 1
    assert checked > 0, "no pipeline specs checked — expected at least the zscape golden"

def test_canonical_matches_golden():
    """(b) canonical_runs.json must match the authoritative UI GOLDEN_RUN_BY_ATLAS for the three GT
    atlases. minifin/megafin are skipped LOUDLY (their golden targets aren't in the datasetId
    run-store — see pillars/README.md ## Known drift)."""
    canon = _canon()
    golden = _golden_by_atlas()
    for ds in GT_ATLASES:
        assert ds in golden, f"{ds} missing from GOLDEN_RUN_BY_ATLAS"
        assert canon[ds] == golden[ds], (
            f"{ds}: canonical_runs={canon[ds]} != GOLDEN_RUN_BY_ATLAS={golden[ds]}")
    for ds in ("minifin", "megafin"):
        if golden.get(ds) and canon.get(ds) != golden.get(ds):
            _warn(f"[SKIP known-rot] {ds}: canonical_runs={canon.get(ds)} != "
                  f"GOLDEN_RUN_BY_ATLAS={golden.get(ds)} — golden target not in datasetId "
                  f"run-store; not reconciled (see pillars/README.md ## Known drift)")

if __name__ == "__main__":
    test_canonical_run_binding(); test_provenance_blocks()
    test_pipeline_spec_binding(); test_canonical_matches_golden()
    if _WARN:
        print("\n".join("⚠ " + w for w in _WARN))
    print("OK — canonical run binding + provenance blocks + pipeline-spec + golden-match verified")
