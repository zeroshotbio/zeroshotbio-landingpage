#!/usr/bin/env python3
"""Build the ZSCAPE world-map asset family for the daniotype_kasperov wizard.

ZSCAPE (Saunders et al.) ships expert annotations but NO de-novo clustering. To
benchmark "can our process recover the published labels", we cluster from scratch
(never using the authors' labels) and only afterward attach their labels as a
held-out ground truth.

Daniotype mechanic folded in at prep time: a deterministic spine that does
de-novo Leiden then **silhouette-gated recursive sub-clustering** of large
clusters (the "sub-leiden for larger clusters" refinement), so a coarse cluster
that genuinely contains two cell types gets split — but only when the split is
supported (mean silhouette floor + min leaf size), not blindly.

Outputs (all under public/daniotype_kasperov/datasets/zscape/ unless noted):
  - umap.json                 client viz: clusters[] (+degsUp/markers/markersDown) + points[]
  - groundtruth.json          per-cluster majority published label at 4 tiers (NOT shown to the agent)
  - archivist/<id>.json        per-cluster full gene profile (Archivist tool)
  - archivist/gene_matrix.json gene x cluster mean/pct matrix (Archivist tool)
  - ../../src/app/api/kasperov_agent/zscape_archivist.json   server-side up/down per cluster
"""
import json
import os
import sys
import numpy as np
import pandas as pd
import scipy.sparse as sp
import anndata as ad
import scanpy as sc

# --------------------------------------------------------------------------- config
H5AD = "/data/datasets/raw_datasets/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad"
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.join(ROOT, "public", "daniotype_kasperov", "datasets", "zscape")
PROFILE_DIR = os.path.join(OUT_DIR, "archivist")
SRV_OUT = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "zscape_archivist.json")

SEED = 7
N_SUB = 250_000          # cells subsampled for de-novo clustering
N_HVG = 2000
N_PCS = 50
LEIDEN_RES = 2.0          # global resolution (deliberately fine; sub-split refines)
SUB_MIN_CELLS = 4000      # only consider splitting clusters at least this big
SUB_MIN_LEAF = 600        # each accepted sub-cluster must have >= this many cells
SUB_SIL_MIN = 0.05        # accept a split only if mean silhouette >= this
SUB_RES = 1.0
TARGET_POINTS = 11000
MIN_PER_CLUSTER = 30
MAX_PER_CLUSTER = 400
TOP_DEGS = 12
N_DOWN = 15
PCT_OUT_MIN = 0.20
DET_MIN = 0.005
TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]

np.random.seed(SEED)
sc.settings.verbosity = 1


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------- load + subsample
log("loading ZSCAPE h5ad into RAM…")
adata = ad.read_h5ad(H5AD)
log("  full:", adata.shape)
if "raw_counts" in adata.layers:
    adata.X = adata.layers["raw_counts"]
adata.X = adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)

n_full = adata.n_obs
idx = np.sort(np.random.choice(n_full, size=min(N_SUB, n_full), replace=False))
adata = adata[idx].copy()
log("  subsample:", adata.shape)

# numeric UMAP (stored as category dtype in obs)
for c in ["umap3d_1", "umap3d_2"]:
    adata.obs[c] = pd.to_numeric(adata.obs[c].astype(str), errors="coerce")
adata = adata[adata.obs["umap3d_1"].notna() & adata.obs["umap3d_2"].notna()].copy()

# gene display symbols (ENSDARG -> gene_short_name, fall back to ENSDARG)
sym = adata.var.get("gene_short_name")
genes = np.array(
    [s if isinstance(s, str) and s.strip() and s != "nan" else g for s, g in zip(sym, adata.var_names)]
    if sym is not None else list(adata.var_names)
)

raw = adata.X.copy()  # keep raw counts for marker math

# --------------------------------------------------------------------------- spine: cluster de novo
log("normalize + log1p + HVG + PCA + neighbors…")
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
try:
    sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG, flavor="seurat_v3", layer="raw_counts")
except Exception as e:  # noqa: BLE001
    log("  seurat_v3 HVG failed, falling back to seurat:", e)
    sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG)
adata.raw = adata
adv = adata[:, adata.var["highly_variable"]].copy()
sc.pp.scale(adv, max_value=10)
sc.tl.pca(adv, n_comps=N_PCS, svd_solver="arpack", random_state=SEED)
adata.obsm["X_pca"] = adv.obsm["X_pca"]
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=N_PCS, random_state=SEED)
log("global leiden (res=%.1f)…" % LEIDEN_RES)
sc.tl.leiden(adata, resolution=LEIDEN_RES, flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
g0 = adata.obs["leiden"].astype(str).to_numpy()
log("  global clusters:", len(set(g0)))

# --------------------------------------------------------------------------- spine: silhouette-gated recursive sub-split
from sklearn.metrics import silhouette_score  # noqa: E402

Xpca = adata.obsm["X_pca"]
leaf = g0.copy().astype(object)
splits = 0
for c in sorted(set(g0)):
    mask = np.where(g0 == c)[0]
    if len(mask) < SUB_MIN_CELLS:
        continue
    sub = adata[mask].copy()
    try:
        sc.pp.neighbors(sub, n_neighbors=15, n_pcs=N_PCS, random_state=SEED)
        sc.tl.leiden(sub, resolution=SUB_RES, flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
    except Exception as e:  # noqa: BLE001
        log(f"  sub-cluster {c} failed: {e}")
        continue
    sl = sub.obs["leiden"].astype(str).to_numpy()
    labs, counts = np.unique(sl, return_counts=True)
    if len(labs) < 2 or counts.min() < SUB_MIN_LEAF:
        continue
    try:
        sil = silhouette_score(Xpca[mask], sl, sample_size=min(2500, len(mask)), random_state=SEED)
    except Exception:  # noqa: BLE001
        sil = -1.0
    if sil >= SUB_SIL_MIN:
        for s in labs:
            leaf[mask[sl == s]] = f"{c}.{s}"
        splits += 1
        log(f"  split cluster {c} -> {len(labs)} (sil={sil:.3f}, n={len(mask)})")
adata.obs["leaf"] = pd.Categorical([str(x) for x in leaf])
clusters = sorted(set(adata.obs["leaf"].tolist()), key=lambda s: (int(s.split('.')[0]), s))
cidx = {c: k for k, c in enumerate(clusters)}
log(f"leaf clusters: {len(clusters)} ({splits} parents split)")

# --------------------------------------------------------------------------- marker math (full-gene mean/pct per cluster)
log("computing per-cluster mean/pct matrices…")
N, G = raw.shape
tot = np.asarray(raw.sum(1)).ravel(); tot[tot == 0] = 1
norm = sp.diags(1e4 / tot) @ raw
binX = (raw > 0).astype(np.float32)
rows = np.array([cidx[x] for x in adata.obs["leaf"]])
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

# --------------------------------------------------------------------------- ground truth (majority published label per tier)
log("computing ground-truth majority labels per cluster…")
gt = {}
for c in clusters:
    rowsel = adata.obs["leaf"] == c
    entry = {}
    for tier in TIERS:
        vc = adata.obs.loc[rowsel, tier].value_counts()
        if len(vc):
            entry[tier] = {"label": str(vc.index[0]), "frac": round(float(vc.iloc[0] / vc.sum()), 3), "n": int(vc.iloc[0])}
        else:
            entry[tier] = {"label": None, "frac": 0.0, "n": 0}
    gt[c] = entry

# --------------------------------------------------------------------------- viz points (downsample) + cluster records
log("assembling viz points + cluster records…")
ux = adata.obs["umap3d_1"].to_numpy(); uy = adata.obs["umap3d_2"].to_numpy()
leaf_arr = adata.obs["leaf"].to_numpy()
records, points = [], []
import random as _r
_r.seed(SEED)
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
        "id": c, "label": f"Cluster {c}", "nCells": int(n),
        "cx": round(cx, 3), "cy": round(cy, 3),
        "degsUp": [m["g"] for m in markers], "markers": markers, "markersDown": down_by[c][:8],
    })
_r.shuffle(points)

os.makedirs(PROFILE_DIR, exist_ok=True)
umap = {
    "source": "ZSCAPE Saunders et al. (de-novo leiden + silhouette-gated sub-split)",
    "totalCells": int(N), "fullDatasetCells": int(n_full), "nClusters": len(clusters),
    "clusters": records, "points": points,
}
with open(os.path.join(OUT_DIR, "umap.json"), "w") as f:
    json.dump(umap, f, separators=(",", ":"))
log("wrote umap.json", f"({os.path.getsize(os.path.join(OUT_DIR,'umap.json'))/1024:.0f} KB) {len(points)} pts")

with open(os.path.join(OUT_DIR, "groundtruth.json"), "w") as f:
    json.dump({"tiers": TIERS, "fullDatasetCells": int(n_full), "clusteredCells": int(N), "clusters": gt}, f, separators=(",", ":"))
log("wrote groundtruth.json")

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
