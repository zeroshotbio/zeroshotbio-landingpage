#!/data/.venv/bin/python
"""Register the DanioCell HIERARCHICAL pilot (runs/daniocell_hier_2026-06-20/) into
the DanioCell run store + _index.json so it appears in the chat-interface
"Load Previous Run" picker ALONGSIDE the existing runs.

ADDITIVE + IDEMPOTENT. Inserts exactly ONE index entry for this run; never
touches other runs' entries, the canonical scorecards, or the flat sanity
baseline (daniocell-sanity/v1.0, runId 20260619-231859-f985a5). Re-running
replaces this run's own entry in place rather than duplicating it.

What it does:
  1. Loads the committed bundle, asserts provenance (gt-hash + partition sha) and
     that it is SCORED with ground truth populated (so the entry never reads
     "NOT scored").
  2. Bakes the KILL verdict + the three-confound caveat + the propagation signal
     into the run's `note`, labels it clearly as a two-level (tissue->cell type)
     pilot, points at the flat sanity run as the reference baseline, and keeps the
     de-novo-semantic and menu-exact channels named separately (never blended).
  3. Writes <runId>.json into the store and inserts the enriched meta at the head
     of _index.json (back up first). Provenance hashes + harness/judge versions
     are stamped onto the index entry itself.
  4. Verifies the worker's OWN code path (app.get_run / app.list_runs) resolves
     the run and that the flat RunViewer's field extraction succeeds — i.e. it
     loads and renders, two-level structure carried per sub-cluster (menu.tissue +
     menu.cellType), not force-fit into a tier the flat viewer lacks.
"""
import os, sys, json, shutil
from datetime import datetime, timezone

APP_DIR = "/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"
sys.path.insert(0, APP_DIR)
import app  # noqa: E402

REPO = "/data/zeroshotbio-landingpage"
RUN_DIR = f"{REPO}/runs/daniocell_hier_2026-06-20"
BUNDLE = f"{RUN_DIR}/run_bundle.json"
DATASET = "daniocell"
RUN_ID = "20260620-051208-hierp01"        # stable id (derived from exportedAt); recognizably hierarchical
FLAT_BASELINE_RUN_ID = "20260619-231859-f985a5"  # the flat 10-cluster DanioCell sanity run

EXPECT_GT_HASH = "2278d043c64f7adf"
EXPECT_PARTITION = "4ce6087667d38f57"
EXPECT_HARNESS_ID = "daniocell-hier/v1.0"

# The verdict + caveat baked verbatim into the entry, then the labelling that
# keeps this visibly distinct from the flat run and points to the baseline.
NOTE = (
    "KILL — dropped from the re-mint. Headline deltas are NOT a clean "
    "hierarchy-vs-flat comparison — three confounds biased against hierarchy: "
    "cell tier graded against the finer identity.super (144) while flat used "
    "cell_type_broad (43); Harmony skipped; over-split ~2.4x (90 sub-clusters "
    "vs ~38 fine types). The one clean signal is top-down propagation: glial "
    "cascaded 47%→11% tissue→cell at 31.6% escalation. "
    "│ HIERARCHICAL / two-level pilot (tissue→cell type), eye/muscle/glial — "
    "NOT like-for-like with the flat run. Reference baseline = the flat "
    f"10-cluster DanioCell sanity run (daniocell-sanity/v1.0, runId {FLAT_BASELINE_RUN_ID}). "
    "Channels kept separate, never blended: de-novo-semantic vs menu-exact "
    "(see the run's aggregate.json). SCORED (driver/v2, GT identity.super); not "
    f"promoted. prov: gt {EXPECT_GT_HASH} · partition {EXPECT_PARTITION} · "
    "harness daniocell-hier/v1.0 · judge driver/v2."
)


def die(msg):
    print(f"[FATAL] {msg}")
    sys.exit(2)


# ---- 1. load + assert provenance / scored ---------------------------------
run = json.load(open(BUNDLE))
prov = run.get("provenance") or {}
if run.get("datasetId") != DATASET:
    die(f"datasetId {run.get('datasetId')!r} != {DATASET!r}")
if prov.get("gtLabelSha") != EXPECT_GT_HASH:
    die(f"gtLabelSha {prov.get('gtLabelSha')!r} != {EXPECT_GT_HASH!r}")
if prov.get("partitionSha") != EXPECT_PARTITION:
    die(f"partitionSha {prov.get('partitionSha')!r} != {EXPECT_PARTITION!r}")
if (run.get("harness") or {}).get("id") != EXPECT_HARNESS_ID:
    die(f"harness id {(run.get('harness') or {}).get('id')!r} != {EXPECT_HARNESS_ID!r}")
gt = run.get("groundTruth")
if not (gt and gt.get("scoredAt") and prov.get("scored") is True):
    die("run is not SCORED / groundTruth missing — would read 'NOT scored'")
if not run.get("scoredAt"):
    die("scoredAt missing on bundle")

# ---- 2. bake the verdict into the note (repo copy + served copy) ----------
run["note"] = NOTE
json.dump(run, open(BUNDLE, "w"), indent=1)  # indent=1 matches the bundle as written -> minimal diff (note only)
print(f"[note] baked verdict+caveat into {BUNDLE}")

# ---- 3. write store file + insert enriched index entry --------------------
d = app._ds_dir(DATASET)
store_path = os.path.join(d, RUN_ID + ".json")
with open(store_path, "w") as f:
    json.dump(run, f)
print(f"[store] wrote {store_path}")

idx_path = os.path.join(d, "_index.json")
stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
if os.path.exists(idx_path):
    shutil.copy2(idx_path, f"{idx_path}.bak-{stamp}")
    idx = json.load(open(idx_path))
else:
    idx = []

# enriched meta: standard _meta_from + provenance/labelling stamped on the entry
meta = app._meta_from(run, RUN_ID)
meta.update({
    "hierarchical": True,
    "twoLevel": "tissue→cell type",
    "schemaBasis": run.get("schemaBasis"),
    "scored": True,
    "promoted": False,
    "channels": ["denovo_semantic", "menu_exact"],
    "gtLabelSha": EXPECT_GT_HASH,
    "partitionSha": EXPECT_PARTITION,
    "judge": (run.get("harness") or {}).get("judge"),
    "referenceBaselineRunId": FLAT_BASELINE_RUN_ID,
})

# idempotent: drop any prior entry for THIS run (same runId, or same harness+exportedAt)
before = len(idx)
idx = [e for e in idx if not (
    e.get("runId") == RUN_ID
    or ((e.get("harness") or {}).get("id") == EXPECT_HARNESS_ID and e.get("exportedAt") == run.get("exportedAt"))
)]
removed = before - len(idx)
idx.insert(0, meta)
json.dump(idx[:500], open(idx_path, "w"))
print(f"[index] inserted entry (runId {RUN_ID}); replaced {removed} prior · {len(idx)} total")

# ---- 4. verify load + flat-viewer render (worker's own code path) ---------
loaded = app.get_run(DATASET, RUN_ID)
assert loaded is not None, "get_run returned None — would 404 in picker"
listing = app.list_runs(DATASET)
assert any(e.get("runId") == RUN_ID for e in listing), "run absent from list_runs — not in picker"

# emulate RunViewer's field extraction (the flat-run viewer) — must not throw
rc = loaded.get("clusters") or []
assert isinstance(rc, list) and rc, "no clusters for viewer"
native_agg = [t for t in (loaded.get("groundTruth", {}).get("aggregate") or []) if t.get("total", 0) > 0]
verdicts = loaded.get("groundTruth", {}).get("verdicts") or {}
two_level_ok = all(("menu" in c and "tissue" in (c.get("menu") or {})) for c in rc[:5])
print(f"[verify] loads OK · {len(rc)} sub-clusters · note carries verdict={'KILL' in (loaded.get('note') or '')}")
print(f"[verify] flat-viewer render OK · GT tiers shown={[t['key'] for t in native_agg]} · "
      f"verdicts={len(verdicts)} · two-level per-cluster (menu.tissue/menu.cellType)={two_level_ok}")
print(f"[verify] entry distinct from flat run: dataset={loaded.get('dataset')!r} harness={loaded.get('harness',{}).get('name')!r}")
print("\n=== REGISTERED === DanioCell hierarchical pilot now in 'Load Previous Run' (daniocell).")
