#!/usr/bin/env python3
"""DEPRECATED (2026-06-13) — superseded by build_minifin_asset.py.

MiniFin is now on a DE-NOVO Harmony+Leiden partition (method-parity with MegaFin),
not Parse's vendor split-pipe clusters. This script reads Parse's cluster_assignment.csv
and writes the stale public/ path — both wrong now. Use instead:
    python cluster_sweep_minifin.py            # de-novo embedding + Leiden sweep
    python build_minifin_asset.py --resolution 1.0
Kept for historical reference only; do not run.

--- original docstring ---
Extract a compact real-UMAP world-map asset for the daniotype_kasperov wizard.
Reads the MiniFin split-pipe report; emits public/daniotype_kasperov/minifin_umap.json.
"""
import sys; sys.exit("DEPRECATED: use cluster_sweep_minifin.py + build_minifin_asset.py (see header)")
import csv
import json
import os
import random
from collections import defaultdict

random.seed(7)

SRC = "/data/datasets/raw_datasets/MiniFin/all-sample/report"
ASSIGN = os.path.join(SRC, "cluster_assignment.csv")
DIFF = os.path.join(SRC, "cluster_diff_exp.csv")
OUT = os.path.join(
    os.path.dirname(__file__), "..", "public", "daniotype_kasperov", "minifin_umap.json"
)

TARGET_POINTS = 8000
MIN_PER_CLUSTER = 40
MAX_PER_CLUSTER = 400
TOP_DEGS = 12

# --- read per-cell assignments ---
cells = defaultdict(list)  # cluster_id(int) -> list[(x,y)]
total = 0
with open(ASSIGN, newline="") as f:
    r = csv.DictReader(f)
    for row in r:
        try:
            c = int(row["cluster"])
            x = float(row["umap_X"])
            y = float(row["umap_Y"])
        except (ValueError, KeyError):
            continue
        cells[c].append((x, y))
        total += 1

cluster_ids = sorted(cells.keys())
print(f"{len(cluster_ids)} clusters, {total} cells")

# --- per-cluster centroid + bounds + downsample ---
clusters = []
points = []  # [x, y, clusterIndex]
for idx, cid in enumerate(cluster_ids):
    pts = cells[cid]
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    keep = max(MIN_PER_CLUSTER, min(MAX_PER_CLUSTER, round(TARGET_POINTS * n / total)))
    keep = min(keep, n)
    sample = random.sample(pts, keep)
    for (x, y) in sample:
        points.append([round(x, 3), round(y, 3), idx])
    clusters.append(
        {
            "id": str(cid),
            "label": f"Cluster {cid}",
            "nCells": n,
            "cx": round(cx, 3),
            "cy": round(cy, 3),
            "degsUp": [],
            "markers": [],
        }
    )

cluster_index = {c["id"]: i for i, c in enumerate(clusters)}

# --- top DEGs per cluster (up-regulated; sorted by score) with specificity stats ---
diff = defaultdict(list)  # cluster_id(str) -> list[(score, gene, l2fc, pct1, pct2)]
with open(DIFF, newline="") as f:
    r = csv.DictReader(f)
    for row in r:
        cid = row["cluster"].strip()
        try:
            score = float(row["score"])
            l2fc = float(row["log2_FC"])
            p1 = float(row["pct1"])
            p2 = float(row["pct2"])
        except (ValueError, KeyError):
            continue
        if l2fc <= 0:
            continue
        gene = (row.get("gene_name") or row.get("gene_id") or "").strip()
        if gene:
            diff[cid].append((score, gene, l2fc, p1, p2))

for cid, lst in diff.items():
    if cid not in cluster_index:
        continue
    lst.sort(key=lambda t: t[0], reverse=True)
    markers = []
    seen = set()
    for score, g, l2fc, p1, p2 in lst:
        if g in seen:
            continue
        seen.add(g)
        markers.append({"g": g, "l2fc": round(l2fc, 2), "p1": round(p1, 3), "p2": round(p2, 3)})
        if len(markers) >= TOP_DEGS:
            break
    ci = cluster_index[cid]
    clusters[ci]["markers"] = markers
    clusters[ci]["degsUp"] = [m["g"] for m in markers]

random.shuffle(points)  # avoid draw-order bias by cluster

out = {
    "source": "MiniFin all-sample (split-pipe v1.7.1, leiden)",
    "totalCells": total,
    "nClusters": len(clusters),
    "clusters": clusters,
    "points": points,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(out, f, separators=(",", ":"))

size = os.path.getsize(OUT)
print(f"wrote {OUT}  ({size/1024:.0f} KB)  {len(points)} points")
print("sample cluster:", json.dumps(clusters[0]))
print("clusters missing DEGs:", [c["id"] for c in clusters if not c["degsUp"]])
