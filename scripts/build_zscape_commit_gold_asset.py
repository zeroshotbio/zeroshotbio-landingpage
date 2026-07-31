#!/usr/bin/env python3
"""Build the ZSCAPE Commit Gold world-map asset family for the daniotype_kasperov wizard.

Unlike ZSCAPE Classic, clustering here is GIVEN and FROZEN: we use ZSCAPE's published
112-cluster gold partition (obs['cluster_id'] = C001..C112, >=50 cells, 26 excluded upstream)
verbatim. We do NOT re-cluster. So this builder is the Classic builder with the clustering spine
removed — just marker math + viz assembly on the frozen partition.

CONTAMINATION DISCIPLINE (dataset LEDGER #1): this row is NOT blind and its answer key is held out.
The h5ad carries NO label tiers (only opaque cluster ids), and we never read datasets/.../
_HELDOUT/. Therefore NO groundtruth.json is written — scoring happens offline via the graph scorer.
Everything emitted here is public marker/embedding data keyed on opaque cluster ids.

Outputs under daniotype_data/zscape_commit_gold/ (served by nginx /daniotype_data/):
  - umap.json                  clusters[] (+degsUp/markers/markersDown) + points[]  (frozen cluster ids)
  - archivist/<Cxxx>.json      per-cluster full gene profile (Archivist tool)
  - archivist/gene_matrix.json gene x cluster mean/pct matrix (Archivist tool)
  - ../../src/app/api/kasperov_agent/zscape_commit_gold_archivist.json   server-side up/down per cluster
"""
import json
import os
import numpy as np
import scipy.sparse as sp
import h5py  # read the h5ad directly — anndata 0.10 can't decode the newer nullable-string obs cols

# --------------------------------------------------------------------------- config
H5AD = "/data/scratch/zlabel/datasets/zscape_commit_gold/zscape_gold_48hpf.h5ad"
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.join(ROOT, "daniotype_data", "zscape_commit_gold")
PROFILE_DIR = os.path.join(OUT_DIR, "archivist")
SRV_OUT = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "zscape_commit_gold_archivist.json")

SEED = 7
TARGET_POINTS = 11000
MIN_PER_CLUSTER = 30
MAX_PER_CLUSTER = 400
TOP_DEGS = 12
N_DOWN = 15
PCT_OUT_MIN = 0.20
DET_MIN = 0.005
CLUSTER_KEY = "cluster_id"          # the FROZEN ZSCAPE-published partition (given, not computed)
EMBED_KEY = "X_umap_zscape"         # ZSCAPE's published 2D embedding

np.random.seed(SEED)


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------- load (full — 209k cells, no subsample, no re-cluster)
def _decode(a):
    return np.array([x.decode() if isinstance(x, bytes) else str(x) for x in a])


def read_categorical(node):
    cats = _decode(node["categories"][:])
    return cats[node["codes"][:]]


def read_csr(grp):
    shape = tuple(int(x) for x in grp.attrs["shape"])
    return sp.csr_matrix((grp["data"][:], grp["indices"][:], grp["indptr"][:]), shape=shape)


log("loading ZSCAPE Commit Gold h5ad (h5py direct)…")
f = h5py.File(H5AD, "r")
# raw counts for marker math (X is log1p CP10k; layers['counts'] is integer counts)
raw = read_csr(f["layers/counts"]).astype(np.float32)

# gene display symbols (gene_symbol categorical covers all genes; patch rare blanks positionally)
sym = read_categorical(f["var"]["gene_symbol"])
genes = np.array([s if isinstance(s, str) and s.strip() and s != "nan" else f"gene_{i}" for i, s in enumerate(sym)])

# frozen partition (given, not computed) + ZSCAPE's published 2D embedding
leaf_arr = read_categorical(f["obs"][CLUSTER_KEY])   # C001..C112
clusters = sorted(set(leaf_arr.tolist()))
cidx = {c: k for k, c in enumerate(clusters)}
emb = np.asarray(f["obsm"][EMBED_KEY][:])
f.close()
ux, uy = emb[:, 0].astype(float), emb[:, 1].astype(float)
N, G = raw.shape
log(f"  shape: {N} x {G} | frozen clusters: {len(clusters)} (given, not computed)")

# --------------------------------------------------------------------------- marker math (full-gene mean/pct per cluster)
log("computing per-cluster mean/pct matrices…")
tot = np.asarray(raw.sum(1)).ravel(); tot[tot == 0] = 1
norm = sp.diags(1e4 / tot) @ raw
binX = (raw > 0).astype(np.float32)
rows = np.array([cidx[x] for x in leaf_arr])
C = sp.csr_matrix((np.ones(N, np.float32), (rows, np.arange(N))), shape=(len(clusters), N))
n_k = np.asarray(C.sum(1)).ravel()
sum_norm = (C @ norm).toarray()
sum_bin = (C @ binX).toarray()
g_norm = np.asarray(norm.sum(0)).ravel()
g_bin = np.asarray(binX.sum(0)).ravel()
eps = 1.0

mean_mat = sum_norm / n_k[:, None]
pct_mat = sum_bin / n_k[:, None]

up_by, down_by = {}, {}
for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]
    mean_out = (g_norm - sum_norm[k]) / (N - n_k[k])
    pct_in = sum_bin[k] / n_k[k]
    pct_out = (g_bin - sum_bin[k]) / (N - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    up_elig = np.where(pct_in >= 0.10)[0]
    up_order = up_elig[np.argsort(-l2fc[up_elig])]
    up_by[c] = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in up_order[:60]]
    dn_elig = np.where(pct_out >= PCT_OUT_MIN)[0]
    dn_order = dn_elig[np.argsort(l2fc[dn_elig])]
    down_by[c] = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in dn_order[:N_DOWN]]

# --------------------------------------------------------------------------- viz points (downsample) + cluster records
log("assembling viz points + cluster records…")
import random as _r
_r.seed(SEED)
records, points = [], []
for k, c in enumerate(clusters):
    sel = np.where(leaf_arr == c)[0]
    n = len(sel)
    cx, cy = float(ux[sel].mean()), float(uy[sel].mean())
    keep = max(MIN_PER_CLUSTER, min(MAX_PER_CLUSTER, round(TARGET_POINTS * n / N)))
    keep = min(keep, n)
    for j in _r.sample(list(sel), keep):
        points.append([round(float(ux[j]), 3), round(float(uy[j]), 3), k])
    up = up_by[c]
    seen, markers = set(), []
    for m in up:
        if m["g"] in seen:
            continue
        seen.add(m["g"]); markers.append(m)
        if len(markers) >= TOP_DEGS:
            break
    records.append({
        "id": c, "label": c, "nCells": int(n),
        "cx": round(cx, 3), "cy": round(cy, 3),
        "degsUp": [m["g"] for m in markers], "markers": markers, "markersDown": down_by[c][:8],
    })
_r.shuffle(points)

os.makedirs(PROFILE_DIR, exist_ok=True)
umap = {
    "source": "ZSCAPE Commit Gold — 48 hpf control arm, GIVEN/FROZEN 112-cluster published partition (no re-clustering); NOT blind (LEDGER #1)",
    "totalCells": int(N), "fullDatasetCells": int(N), "nClusters": len(clusters),
    "clusters": records, "points": points,
}
with open(os.path.join(OUT_DIR, "umap.json"), "w") as f:
    json.dump(umap, f, separators=(",", ":"))
log("wrote umap.json", f"({os.path.getsize(os.path.join(OUT_DIR,'umap.json'))/1024:.0f} KB) {len(points)} pts")

# NOTE: NO groundtruth.json — the gold key is held out (dataset LEDGER #1). Scoring is offline.

# per-cluster full profiles + gene matrix (Archivist tool)
log("writing archivist profiles…")
for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]; mean_out = (g_norm - sum_norm[k]) / (N - n_k[k])
    pct_in = sum_bin[k] / n_k[k]; pct_out = (g_bin - sum_bin[k]) / (N - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    keep_g = np.where((pct_in >= DET_MIN) | (pct_out >= DET_MIN))[0]
    order = keep_g[np.argsort(-l2fc[keep_g])]
    prof = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in order]
    with open(os.path.join(PROFILE_DIR, f"{c}.json"), "w") as f:
        json.dump({"id": c, "nCells": int(n_k[k]), "datasetCells": int(N), "nGenes": len(prof), "genes": prof}, f, separators=(",", ":"))

gmax_pct = pct_mat.max(axis=0)
gene_rows = {}
for j in range(G):
    if gmax_pct[j] < 0.01:
        continue
    key = str(genes[j]).lower()
    if key in gene_rows:
        continue
    gene_rows[key] = {"m": [round(float(v), 1) for v in mean_mat[:, j]], "p": [round(float(v), 3) for v in pct_mat[:, j]]}
with open(os.path.join(PROFILE_DIR, "gene_matrix.json"), "w") as f:
    json.dump({"clusters": clusters, "clusterSizes": [int(n_k[cidx[c]]) for c in clusters], "datasetCells": int(N), "nGenes": len(gene_rows), "genes": gene_rows}, f, separators=(",", ":"))
log("wrote gene_matrix.json", f"({os.path.getsize(os.path.join(PROFILE_DIR,'gene_matrix.json'))/1024/1024:.1f} MB) {len(gene_rows)} genes")

os.makedirs(os.path.dirname(SRV_OUT), exist_ok=True)
with open(SRV_OUT, "w") as f:
    json.dump({"datasetCells": int(N), "assignedCells": int(N), "clusters": {c: {"nCells": int(n_k[cidx[c]]), "up": up_by[c][:40], "down": down_by[c]} for c in clusters}}, f, separators=(",", ":"))
log("wrote", SRV_OUT)
log("DONE. clusters=%d points=%d" % (len(clusters), len(points)))
