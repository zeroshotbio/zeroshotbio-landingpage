#!/usr/bin/env python3
"""Build the richer archivist dataset the Archivist personality queries.

For every Leiden cluster:
  - up   : all split-pipe one-vs-rest up markers (from cluster_diff_exp.csv)
  - down : top down-regulated genes computed from the h5ad (one-vs-rest, most
           negative log2FC among genes broadly expressed outside the cluster)
  - nCells + dataset-wide cell count

Outputs:
  - src/app/api/kasperov_agent/minifin_archivist.json  (server-side, full)
  - merges top-8 down markers into public/daniotype_kasperov/minifin_umap.json
"""
import csv, json, os
from collections import defaultdict
import numpy as np
import scipy.sparse as sp
import anndata as ad

ROOT = os.path.join(os.path.dirname(__file__), "..")
H5AD = "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad"
ASSIGN = "/data/datasets/raw_datasets/MiniFin/all-sample/report/cluster_assignment.csv"
DIFF = "/data/datasets/raw_datasets/MiniFin/all-sample/report/cluster_diff_exp.csv"
OUT_SRV = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "minifin_archivist.json")
UMAP_JSON = os.path.join(ROOT, "public", "daniotype_kasperov", "minifin_umap.json")

N_DOWN = 15
PCT_OUT_MIN = 0.20  # a down marker must be reasonably expressed outside the cluster

print("loading h5ad…")
a = ad.read_h5ad(H5AD)  # full into RAM
X = a.X.tocsr() if sp.issparse(a.X) else sp.csr_matrix(a.X)
genes = np.asarray(a.var_names)
bc = {b: i for i, b in enumerate(a.obs_names)}
N, G = X.shape
print("cells", N, "genes", G)

# barcode -> cluster
cell_cluster = np.full(N, -1, dtype=np.int32)
with open(ASSIGN, newline="") as f:
    for row in csv.DictReader(f):
        i = bc.get(row["bc_wells"])
        if i is not None:
            try:
                cell_cluster[i] = int(row["cluster"])
            except ValueError:
                pass
keep = cell_cluster >= 0
clusters = sorted(set(cell_cluster[keep].tolist()))
print("clusters", len(clusters), "assigned cells", int(keep.sum()))

# CPM-like normalisation (per-cell total -> 1e4), keep sparse
tot = np.asarray(X.sum(1)).ravel()
tot[tot == 0] = 1
inv = sp.diags((1e4 / tot))
norm = inv @ X  # csr, normalised counts
binX = (X > 0).astype(np.float32)  # detection

# one-hot cluster indicator (n_clusters x n_cells)
cidx = {c: k for k, c in enumerate(clusters)}
rows = [cidx[c] for c in cell_cluster[keep]]
cols = np.nonzero(keep)[0]
C = sp.csr_matrix((np.ones(len(rows), np.float32), (rows, cols)), shape=(len(clusters), N))

n_k = np.asarray(C.sum(1)).ravel()  # cells per cluster
N_assigned = n_k.sum()
sum_norm = (C @ norm).toarray()  # clusters x genes
sum_bin = (C @ binX).toarray()
g_norm = np.asarray(norm.sum(0)).ravel()
g_bin = np.asarray(binX.sum(0)).ravel()

eps = 1.0
print("computing down markers…")
down_by_cluster = {}
for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]
    mean_out = (g_norm - sum_norm[k]) / (N_assigned - n_k[k])
    pct_in = sum_bin[k] / n_k[k]
    pct_out = (g_bin - sum_bin[k]) / (N_assigned - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    # down = strongly negative log2FC, broadly expressed outside
    elig = np.where(pct_out >= PCT_OUT_MIN)[0]
    order = elig[np.argsort(l2fc[elig])]  # ascending (most negative first)
    top = order[:N_DOWN]
    down_by_cluster[str(c)] = [
        {"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)}
        for i in top
    ]

# up markers (all available, from split-pipe csv)
up_by_cluster = defaultdict(list)
with open(DIFF, newline="") as f:
    for row in csv.DictReader(f):
        cid = row["cluster"].strip()
        try:
            l2fc = float(row["log2_FC"])
            if l2fc <= 0:
                continue
            up_by_cluster[cid].append(
                {"g": (row.get("gene_name") or row.get("gene_id") or "").strip(), "l2fc": round(l2fc, 2), "p1": round(float(row["pct1"]), 3), "p2": round(float(row["pct2"]), 3), "score": float(row["score"])}
            )
        except (ValueError, KeyError):
            continue
for cid in up_by_cluster:
    up_by_cluster[cid].sort(key=lambda d: d["score"], reverse=True)
    for d in up_by_cluster[cid]:
        d.pop("score", None)

# per-cluster FULL gene profile (every detected gene) for live tool queries
PROFILE_DIR = os.path.join(ROOT, "public", "daniotype_kasperov", "archivist")
os.makedirs(PROFILE_DIR, exist_ok=True)
DET_MIN = 0.005  # keep genes detected in >=0.5% of either group
print("writing per-cluster full profiles…")
for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]
    mean_out = (g_norm - sum_norm[k]) / (N_assigned - n_k[k])
    pct_in = sum_bin[k] / n_k[k]
    pct_out = (g_bin - sum_bin[k]) / (N_assigned - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    keep_g = np.where((pct_in >= DET_MIN) | (pct_out >= DET_MIN))[0]
    order = keep_g[np.argsort(-l2fc[keep_g])]  # most up first → most down last
    prof = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in order]
    with open(os.path.join(PROFILE_DIR, f"{c}.json"), "w") as f:
        json.dump({"id": str(c), "nCells": int(n_k[k]), "datasetCells": int(N), "nGenes": len(prof), "genes": prof}, f, separators=(",", ":"))
print(f"wrote {len(clusters)} profiles to {PROFILE_DIR}")

archivist = {
    "datasetCells": int(N),
    "assignedCells": int(N_assigned),
    "clusters": {
        str(c): {"nCells": int(n_k[cidx[c]]), "up": up_by_cluster.get(str(c), []), "down": down_by_cluster.get(str(c), [])}
        for c in clusters
    },
}
os.makedirs(os.path.dirname(OUT_SRV), exist_ok=True)
with open(OUT_SRV, "w") as f:
    json.dump(archivist, f, separators=(",", ":"))
print("wrote", OUT_SRV, f"({os.path.getsize(OUT_SRV)/1024:.0f} KB)")

# merge top-8 down into the client UMAP asset so the Top Markers box can show them
with open(UMAP_JSON) as f:
    umap = json.load(f)
for cl in umap["clusters"]:
    d = down_by_cluster.get(str(cl["id"]), [])
    cl["markersDown"] = d[:8]
with open(UMAP_JSON, "w") as f:
    json.dump(umap, f, separators=(",", ":"))
print("merged down markers into", UMAP_JSON, f"({os.path.getsize(UMAP_JSON)/1024:.0f} KB)")
print("sample down (cluster 28):", json.dumps(down_by_cluster.get("28", [])[:4]))
