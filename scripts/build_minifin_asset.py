#!/usr/bin/env python3
"""Build the MiniFin world-map asset family for the daniotype_kasperov wizard.

Method-parity mirror of build_megafin_asset.py. MiniFin is now on a DE-NOVO Leiden
partition (cluster_sweep_minifin.py: HVG->PCA->Harmony(sample)->kNN->Leiden) instead of
Parse's vendor split-pipe clusters. Clusters + UMAP coords come from the sidecar
minifin_leiden_labels.csv (joined on cell_id == obs_names); markers are recomputed
one-vs-rest from the h5ad raw counts. ENSDARG-form var_names are symbol-mapped via the
same ensdarg_symbol_map.csv MegaFin uses (already-symbol names are left as-is).

Outputs (all gated via /api/kasperov_asset, NOT public/):
  daniotype_data/minifin/umap.json
  daniotype_data/minifin/archivist/<id>.json + gene_matrix.json
  src/app/api/kasperov_agent/minifin_archivist.json
No groundtruth.json (MiniFin has no independent published labels).
"""
import json, os, argparse, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad

ap = argparse.ArgumentParser()
ap.add_argument("--resolution", type=float, required=True,
                help="Leiden resolution column (leiden_<res>) to build from, in the sidecar.")
ap.add_argument("--labels_csv", default="/data/scratch/bench/minifin_leiden_labels.csv",
                help="sidecar with cell_id, umap_X, umap_Y, leiden_<res> (from cluster_sweep_minifin.py)")
ARGS = ap.parse_args()

H5AD = "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad"
GENE_MAP = "/data/scratch/bench/characterization/ensdarg_symbol_map.csv"  # ensembl_id,symbol,...
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.join(ROOT, "daniotype_data", "minifin")  # non-public (gated via /api/kasperov_asset)
PROFILE_DIR = os.path.join(OUT_DIR, "archivist")
SRV_OUT = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "minifin_archivist.json")
SEED = 7; TARGET_POINTS = 12000; MIN_PER_CLUSTER = 30; MAX_PER_CLUSTER = 450
TOP_DEGS = 12; N_DOWN = 8; PCT_OUT_MIN = 0.20; DET_MIN = 0.005
np.random.seed(SEED)
def log(*a): print(*a, flush=True)

log("loading", H5AD)
adata = ad.read_h5ad(H5AD)
adata.X = adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
assert np.all(adata.X.data == np.round(adata.X.data)), "X must be raw counts"
n_full = adata.n_obs

# SYMBOL RE-MAP: MiniFin's var_names are the Parse/Trailmaker annotation (40% off the
# ZFIN/Ensembl namespace — aliases like nherf1=slc9a3r1a). Map EVERY gene through its
# ENSDARG id (var["id"]) -> the shared ensdarg_symbol_map symbol that MegaFin/ZSCAPE use,
# falling back to the original var_name only if the ENSDARG isn't in the map. No re-cluster.
m = pd.read_csv(GENE_MAP)
m["ensembl_id"] = m["ensembl_id"].astype(str).str.upper()
m = m.set_index("ensembl_id")
ens_ids = adata.var["id"].astype(str).str.upper()
sym_map = m["symbol"].reindex(ens_ids)
genes = np.array([s if isinstance(s, str) and s.strip() and s != "nan" else g
                  for s, g in zip(sym_map.values, adata.var_names)])
n_mapped = int(sum(1 for s in sym_map.values if isinstance(s, str) and s.strip() and s != "nan"))
log(f"symbol re-map: {n_mapped}/{adata.n_vars} genes mapped to shared ZFIN/Ensembl symbol via ENSDARG id")
# emit a var_name -> canonical map for the live :5007 service (so its co-expression uses
# the same tokens as the displayed assets). Columns named for the service's defaults.
pd.DataFrame({"ensembl_id": list(adata.var_names), "symbol": [str(g) for g in genes]}).to_csv(
    "/data/scratch/bench/minifin_canonical_map.csv", index=False)
log("wrote /data/scratch/bench/minifin_canonical_map.csv (var_name -> canonical) for :5007")

# clusters + UMAP from the de-novo sidecar (joined on cell_id == obs_names)
col = f"leiden_{ARGS.resolution}"
lab = pd.read_csv(ARGS.labels_csv)
assert col in lab.columns, f"{col} not in {ARGS.labels_csv} (have {[c for c in lab.columns if c.startswith('leiden')]})"
lab = lab.set_index("cell_id")
s = lab[col].reindex(adata.obs_names)
assert s.notna().all(), "sidecar missing labels for some cells (cell_id != obs_names?)"
cl_raw = s.astype(int).astype(str).values
ux = lab["umap_X"].reindex(adata.obs_names).to_numpy(float)
uy = lab["umap_Y"].reindex(adata.obs_names).to_numpy(float)
cluster_src = f"de-novo Leiden res {ARGS.resolution} on Harmony embedding (HVG->PCA->Harmony[sample])"
clusters = sorted(set(cl_raw), key=lambda s: int(s))
cidx = {c: k for k, c in enumerate(clusters)}
log("cluster source:", cluster_src, "->", len(clusters), "clusters")

# ---- vectorized per-cluster mean/pct/l2fc on CP10k-normalized counts ----
log("marker math…")
rawX = adata.X
Nn, Gg = rawX.shape
tot = np.asarray(rawX.sum(1)).ravel(); tot[tot == 0] = 1
norm = sp.diags(1e4 / tot) @ rawX
binX = (rawX > 0).astype(np.float32)
rows = np.array([cidx[c] for c in cl_raw])
C = sp.csr_matrix((np.ones(Nn, np.float32), (rows, np.arange(Nn))), shape=(len(clusters), Nn))
n_k = np.asarray(C.sum(1)).ravel()
sum_norm = (C @ norm).toarray(); sum_bin = (C @ binX).toarray()
g_norm = np.asarray(norm.sum(0)).ravel(); g_bin = np.asarray(binX.sum(0)).ravel()
eps = 1.0
mean_mat = sum_norm / n_k[:, None]; pct_mat = sum_bin / n_k[:, None]

up_by, down_by = {}, {}
for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]; mean_out = (g_norm - sum_norm[k]) / (Nn - n_k[k])
    pct_in = sum_bin[k] / n_k[k]; pct_out = (g_bin - sum_bin[k]) / (Nn - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    up = np.where(pct_in >= 0.10)[0]; up = up[np.argsort(-l2fc[up])]
    up_by[c] = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in up[:60]]
    dn = np.where(pct_out >= PCT_OUT_MIN)[0]; dn = dn[np.argsort(l2fc[dn])]
    down_by[c] = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in dn[:N_DOWN]]

# ---- viz points + cluster records ----
log("viz points + records…")
import random as _r; _r.seed(SEED)
records, points = [], []
for k, c in enumerate(clusters):
    sel = np.where(rows == k)[0]; n = len(sel)
    cx, cy = float(ux[sel].mean()), float(uy[sel].mean())
    keep = min(n, max(MIN_PER_CLUSTER, min(MAX_PER_CLUSTER, round(TARGET_POINTS * n / Nn))))
    for j in _r.sample(list(sel), keep):
        points.append([round(float(ux[j]), 3), round(float(uy[j]), 3), k])
    seen, markers = set(), []
    for mk in up_by[c]:
        if mk["g"] in seen: continue
        seen.add(mk["g"]); markers.append(mk)
        if len(markers) >= TOP_DEGS: break
    records.append({"id": c, "label": f"Cluster {c}", "nCells": int(n), "cx": round(cx, 3), "cy": round(cy, 3),
                    "degsUp": [mk["g"] for mk in markers], "markers": markers, "markersDown": down_by[c][:8]})
_r.shuffle(points)

os.makedirs(PROFILE_DIR, exist_ok=True)
umap = {"source": f"MiniFin — 48 hpf, Parse Evercode, 43 drug samples — {cluster_src}",
        "totalCells": int(Nn), "fullDatasetCells": int(n_full), "nClusters": len(clusters),
        "clusters": records, "points": points}
json.dump(umap, open(os.path.join(OUT_DIR, "umap.json"), "w"), separators=(",", ":"))
log("wrote umap.json", f"{os.path.getsize(os.path.join(OUT_DIR,'umap.json'))/1024:.0f}KB {len(points)} pts")

for k, c in enumerate(clusters):
    mean_in = sum_norm[k] / n_k[k]; mean_out = (g_norm - sum_norm[k]) / (Nn - n_k[k])
    pct_in = sum_bin[k] / n_k[k]; pct_out = (g_bin - sum_bin[k]) / (Nn - n_k[k])
    l2fc = np.log2((mean_in + eps) / (mean_out + eps))
    keep_g = np.where((pct_in >= DET_MIN) | (pct_out >= DET_MIN))[0]
    order = keep_g[np.argsort(-l2fc[keep_g])]
    prof = [{"g": str(genes[i]), "l2fc": round(float(l2fc[i]), 2), "p1": round(float(pct_in[i]), 3), "p2": round(float(pct_out[i]), 3)} for i in order]
    json.dump({"id": c, "nCells": int(n_k[k]), "datasetCells": int(Nn), "nGenes": len(prof), "genes": prof},
              open(os.path.join(PROFILE_DIR, f"{c}.json"), "w"), separators=(",", ":"))

gmax = pct_mat.max(0); gene_rows = {}
for j in range(Gg):
    if gmax[j] < 0.01: continue
    key = str(genes[j]).lower()
    if key in gene_rows: continue
    gene_rows[key] = {"m": [round(float(v), 1) for v in mean_mat[:, j]], "p": [round(float(v), 3) for v in pct_mat[:, j]]}
json.dump({"clusters": clusters, "clusterSizes": [int(n_k[cidx[c]]) for c in clusters], "datasetCells": int(Nn), "nGenes": len(gene_rows), "genes": gene_rows},
          open(os.path.join(PROFILE_DIR, "gene_matrix.json"), "w"), separators=(",", ":"))
log("wrote gene_matrix.json", len(gene_rows), "genes")

os.makedirs(os.path.dirname(SRV_OUT), exist_ok=True)
json.dump({"datasetCells": int(Nn), "assignedCells": int(Nn),
           "clusters": {c: {"nCells": int(n_k[cidx[c]]), "up": up_by[c][:40], "down": down_by[c]} for c in clusters}},
          open(SRV_OUT, "w"), separators=(",", ":"))
log("wrote", SRV_OUT)
log("DONE clusters=%d points=%d" % (len(clusters), len(points)))
