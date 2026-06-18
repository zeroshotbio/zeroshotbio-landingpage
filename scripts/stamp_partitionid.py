#!/usr/bin/env python3
"""Stamp partitionId (= canonical assignmentSha256) + partitionColumn into each
served daniotype_data/<dir>/umap.json, computing the hash from the per-cell labels
CSV (NOT copied from names.json — computing it independently is what keeps the
viewer's overlay guard a real check). Idempotent; NEVER overwrites an existing
partitionId. Dry-run by default — pass --apply to write.

  partitionId := sha256 of sorted "cell_id,<label>\\n" over the per-cell partition CSV.

UI mapping note (Prism): served dir `megafin/` = the 77-cluster Parse atlas (UI id
`megafin_parse`); `megafin_rebuild/` = the 84-cluster Manual atlas (UI id `megafin`).
On other boxes verify the served-dir↔partition mapping before trusting this map
(see daniotype_server_handoff/HANDOFF.md verify-on-live checklist).
"""
import os, sys, csv, json, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DD = os.path.join(ROOT, "daniotype_data")
SCRATCH = "/data/scratch/bench"

# (served umap dir, per-cell labels CSV, partition column, expected sha256 prefix for a self-check)
DATASETS = [
    ("megafin",         f"{SCRATCH}/megafin_leiden_labels.csv",         "leiden_3.0",    "f093170b"),
    ("megafin_rebuild", f"{SCRATCH}/megafin_rebuild_leiden_labels.csv", "megafin_final", "33e60eb5"),
]

def assignment_sha(csv_path, col):
    pairs = []
    with open(csv_path) as f:
        r = csv.reader(f); hdr = next(r)
        ci, idi = hdr.index(col), hdr.index("cell_id")
        for row in r:
            pairs.append((row[idi], row[ci]))
    pairs.sort()
    h = hashlib.sha256()
    for cid, lab in pairs:
        h.update(f"{cid},{lab}\n".encode())
    return h.hexdigest(), len(pairs), len({c for _, c in pairs})

def main(apply):
    print(f"{'APPLY' if apply else 'DRY-RUN'} — stamp partitionId into umap.json")
    for ds_dir, csv_path, col, expect in DATASETS:
        upath = os.path.join(DD, ds_dir, "umap.json")
        if not os.path.exists(upath):
            print(f"[skip] {ds_dir}: no umap.json"); continue
        if not os.path.exists(csv_path):
            print(f"[skip] {ds_dir}: labels CSV missing ({csv_path})"); continue
        pid, ncells, nclust = assignment_sha(csv_path, col)
        if expect and not pid.startswith(expect):
            print(f"[STOP] {ds_dir}: computed {pid[:12]}… does not start with expected {expect} "
                  f"-> wrong CSV/partition for this dir? Refusing."); continue
        j = json.load(open(upath)); cur = j.get("partitionId")
        if cur == pid:
            print(f"[ok]   {ds_dir}: already stamped — no change"); continue
        if cur and cur != pid:
            print(f"[WARN] {ds_dir}: existing partitionId {cur[:12]}… != computed {pid[:12]}… "
                  f"-> REFUSING to overwrite. Investigate."); continue
        print(f"[set]  {ds_dir}: col={col} nCells={ncells} nClusters={nclust} -> partitionId={pid}")
        if apply:
            j["partitionId"] = pid; j["partitionColumn"] = col
            tmp = upath + ".tmp"
            json.dump(j, open(tmp, "w"), separators=(",", ":"))
            os.replace(tmp, upath)
            print(f"          WROTE {upath}")

if __name__ == "__main__":
    main(apply="--apply" in sys.argv[1:])
