#!/usr/bin/env python3
"""De-novo re-cluster MiniFin to method-parity with MegaFin (build_megafin_asset.py).

MiniFin currently rides Parse's vendor split-pipe partition (47 clusters). MegaFin
runs a de-novo Leiden re-cluster on a batch-integrated embedding. This brings MiniFin
onto the SAME method: HVG -> PCA -> Harmony(on `sample`) -> kNN -> Leiden sweep, picking
the finest resolution still marker-coherent (same coherence rule as cluster_sweep_megafin.py).

Unlike MegaFin (whose Parse object already carried X_harmony/X_umap), minifin_filtered.h5ad
has NO embedding, so we compute it here. Saves a sidecar parallel to megafin_leiden_labels.csv:
  /data/scratch/bench/minifin_leiden_labels.csv   cols: cell_id, umap_X, umap_Y, leiden_<res>...
  /data/scratch/bench/minifin_res_sweep.csv        sweep metrics (count / sizes / coherence)
build_minifin_asset.py consumes the chosen leiden_<res> column + the UMAP coords.
"""
import time, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad, scanpy as sc
t0 = time.time(); log = lambda *a: print(f"[{time.time()-t0:6.1f}s]", *a, flush=True)

H5AD = "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad"
OUT_LABELS = "/data/scratch/bench/minifin_leiden_labels.csv"
OUT_SWEEP = "/data/scratch/bench/minifin_res_sweep.csv"
BATCH_KEY = "sample"          # 43 drug conditions in MiniFin obs
N_HVG = 3000; N_PCS = 50; N_NEIGHBORS = 15; SEED = 7
RES = [1.0, 2.0, 3.0, 4.0, 5.0]

log("load", H5AD)
a = ad.read_h5ad(H5AD)
a.X = a.X.tocsr() if sp.issparse(a.X) else sp.csr_matrix(a.X)
assert np.allclose(a.X.data, np.round(a.X.data)), "X must be raw counts"
N, G = a.shape
log("cells", N, "genes", G, "| batches:", a.obs[BATCH_KEY].nunique())

# --- keep raw counts for 1-vs-rest coherence (CP10k), embed on a normalised copy ---
raw = a.X.copy()
sc.pp.normalize_total(a, target_sum=1e4)
sc.pp.log1p(a)
sc.pp.highly_variable_genes(a, n_top_genes=N_HVG, flavor="seurat")
log("HVG", int(a.var.highly_variable.sum()))
w = a[:, a.var.highly_variable].copy()
sc.pp.scale(w, max_value=10)
sc.tl.pca(w, n_comps=N_PCS, svd_solver="arpack", random_state=SEED)
log("PCA done -> harmony on", BATCH_KEY)
sc.external.pp.harmony_integrate(w, BATCH_KEY, basis="X_pca", adjusted_basis="X_pca_harmony", random_state=SEED)
a.obsm["X_pca_harmony"] = w.obsm["X_pca_harmony"]
log("harmony done -> neighbors + umap")
sc.pp.neighbors(a, n_neighbors=N_NEIGHBORS, use_rep="X_pca_harmony", random_state=SEED)
sc.tl.umap(a, random_state=SEED)
log("umap done")

# --- coherence helper: 1-vs-rest on CP10k raw counts (identical rule to megafin sweep) ---
tot = np.asarray(raw.sum(1)).ravel(); tot[tot == 0] = 1
norm = sp.diags(1e4 / tot) @ raw
binX = (raw > 0).astype(np.float32)
g_norm = np.asarray(norm.sum(0)).ravel(); g_bin = np.asarray(binX.sum(0)).ravel()
def coherence(labels):
    cats = sorted(set(labels), key=lambda s: int(s))
    cidx = {c: k for k, c in enumerate(cats)}
    rows = np.array([cidx[c] for c in labels])
    C = sp.csr_matrix((np.ones(N, np.float32), (rows, np.arange(N))), shape=(len(cats), N))
    n_k = np.asarray(C.sum(1)).ravel()
    sum_norm = (C @ norm).toarray(); sum_bin = (C @ binX).toarray()
    coh = 0
    for k in range(len(cats)):
        mean_in = sum_norm[k] / n_k[k]; mean_out = (g_norm - sum_norm[k]) / (N - n_k[k])
        pct_in = sum_bin[k] / n_k[k]; pct_out = (g_bin - sum_bin[k]) / (N - n_k[k])
        l2fc = np.log2((mean_in + 1) / (mean_out + 1))
        ok = (l2fc >= 1.0) & (pct_in >= 0.25) & ((pct_in - pct_out) >= 0.15)
        if ok.any(): coh += 1
    return cats, n_k, coh

# --- Leiden sweep ---
out = pd.DataFrame({"cell_id": a.obs_names,
                    "umap_X": np.round(a.obsm["X_umap"][:, 0], 4),
                    "umap_Y": np.round(a.obsm["X_umap"][:, 1], 4)})
rows = []
for R in RES:
    key = f"leiden_{R}"
    sc.tl.leiden(a, resolution=R, key_added=key, flavor="igraph", n_iterations=2,
                 directed=False, random_state=SEED)
    lab = a.obs[key].astype(str).values
    out[key] = lab
    cats, n_k, coh = coherence(lab)
    rows.append({"resolution": R, "n_clusters": len(cats), "min_size": int(n_k.min()),
                 "median_size": int(np.median(n_k)), "n_under50": int((n_k < 50).sum()),
                 "coherent_clusters": coh, "coherent_frac": round(coh / len(cats), 3)})
    log(f"res {R}: {len(cats)} clusters, median {int(np.median(n_k))}, min {int(n_k.min())}, "
        f"<50: {int((n_k<50).sum())}, coherent {coh}/{len(cats)} ({coh/len(cats):.2f})")

out.to_csv(OUT_LABELS, index=False)
m = pd.DataFrame(rows); m.to_csv(OUT_SWEEP, index=False)
log("=== SWEEP SUMMARY ==="); print(m.to_string(index=False), flush=True)
log("saved", OUT_LABELS, "+", OUT_SWEEP)
