#!/usr/bin/env python3
"""Retire the model-field tag hack on the restored pre-unify runs.

When the run-note feature wasn't live yet, the two restored reduced-loop runs were
tagged by stuffing "pre-unify (reduced loop)" into the displayed MODEL field. Now that
notes exist, move that into the proper `note` field and restore the model to clean
gpt-5.5 — in BOTH the <runId>.json file and the _index.json entry.

RUN THIS IN THE IDLE GAP, together with the client deploy + worker restart, so the note
renders in the list at the same moment the model un-tags (no untagged window).
Idempotent.
"""
import json, os

RUNS = "/data/daniotype_runs"
NOTE = ("Pre-unify reduced-loop run (2 proposers + reason rounds; NO Archivist verification / "
        "dispatch). Predates the full-loop unify; not comparable to the full-loop re-runs.")
TARGETS = [("minifin", "20260613-184541-dd2be6"), ("megafin", "20260613-032008-66efb7")]

for ds, run_id in TARGETS:
    p = os.path.join(RUNS, ds, run_id + ".json")
    if os.path.exists(p):
        r = json.load(open(p))
        r["model"] = "gpt-5.5"
        r["note"] = NOTE
        r["loop"] = "reduced-pre-unify"
        json.dump(r, open(p, "w"))
    idxp = os.path.join(RUNS, ds, "_index.json")
    idx = json.load(open(idxp))
    for e in idx:
        if e.get("runId") == run_id:
            e["model"] = "gpt-5.5"   # un-tag the model field
            e["note"] = NOTE          # the tag now lives here (rendered by the list)
    json.dump(idx, open(idxp, "w"))
    print(f"retired tag on {ds}/{run_id}: model->gpt-5.5, note set")
print("DONE")
