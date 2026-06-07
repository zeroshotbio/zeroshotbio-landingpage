#!/usr/bin/env python3
"""Extract a compact real-UMAP world-map asset for the daniotype_kasperov wizard.

Reads the MiniFin split-pipe report (per-cell UMAP coords + Leiden cluster, and
per-cluster differential expression) and emits a small JSON the page loads to
draw the actual atlas instead of synthetic blobs.

Output: public/daniotype_kasperov/minifin_umap.json
"""
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
        }
    )

cluster_index = {c["id"]: i for i, c in enumerate(clusters)}

# --- top DEGs per cluster (up-regulated; sorted by score) ---
diff = defaultdict(list)  # cluster_id(str) -> list[(score, gene_name)]
with open(DIFF, newline="") as f:
    r = csv.DictReader(f)
    for row in r:
        cid = row["cluster"].strip()
        try:
            score = float(row["score"])
            l2fc = float(row["log2_FC"])
        except (ValueError, KeyError):
            continue
        if l2fc <= 0:
            continue
        gene = (row.get("gene_name") or row.get("gene_id") or "").strip()
        if gene:
            diff[cid].append((score, gene))

for cid, lst in diff.items():
    if cid not in cluster_index:
        continue
    lst.sort(key=lambda t: t[0], reverse=True)
    seen = []
    for _, g in lst:
        if g not in seen:
            seen.append(g)
        if len(seen) >= TOP_DEGS:
            break
    clusters[cluster_index[cid]]["degsUp"] = seen

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
