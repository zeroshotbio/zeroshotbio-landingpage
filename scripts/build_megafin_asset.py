#!/usr/bin/env python3
"""Build the MegaFin Part 1 world-map asset family for the daniotype_kasperov wizard.

Unlike ZSCAPE (re-clustered de novo to score against published labels), MegaFin has
NO independent ground truth — its clusters just need to be sensible populations to name.
So we use the Parse/Trailmaker processed object's existing UMAP + Leiden clusters
(res 0.8, 37 clusters) directly (the Parse object is the ground-truth-for-now per the
data page), and compute the per-cluster marker profiles the wizard/Archivist consume.

Outputs:
  public/daniotype_kasperov/datasets/megafin/umap.json
  public/daniotype_kasperov/datasets/megafin/archivist/<id>.json + gene_matrix.json
  src/app/api/kasperov_agent/megafin_archivist.json
No groundtruth.json (MegaFin has no independent published labels).
"""
import json, os, argparse, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad

ap = argparse.ArgumentParser()
ap.add_argument("--resolution", type=float, default=None,
                help="Leiden resolution on the Parse Harmony embedding (X_harmony). "
                     "Default None = use the Parse seurat_clusters (res 0.8) as-is. "
                     "Carries to the de-novo rebuild: set e.g. --resolution 2.0 for finer cell-type-level clusters.")
ap.add_argument("--labels_csv", default="/scratch/bench/megafin_leiden_labels.csv",
                help="optional sidecar with precomputed leiden_<res> columns (from cluster_sweep_megafin.py)")
ARGS = ap.parse_args()

H5AD = "/scratch/bench/parse_megafin1.h5ad"
GENE_MAP = "/scratch/bench/characterization/ensdarg_symbol_map.csv"  # ensembl_id,symbol,...
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.join(ROOT, "public", "daniotype_kasperov", "datasets", "megafin")
PROFILE_DIR = os.path.join(OUT_DIR, "archivist")
SRV_OUT = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "megafin_archivist.json")
SEED=7; TARGET_POINTS=12000; MIN_PER_CLUSTER=30; MAX_PER_CLUSTER=450
TOP_DEGS=12; N_DOWN=8; PCT_OUT_MIN=0.20; DET_MIN=0.005
np.random.seed(SEED)
def log(*a): print(*a, flush=True)

log("loading", H5AD)
adata = ad.read_h5ad(H5AD)
adata.X = adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
assert np.all(adata.X.data == np.round(adata.X.data)), "X must be raw counts"
n_full = adata.n_obs
# ENSDARG -> symbol
m = pd.read_csv(GENE_MAP).set_index("ensembl_id")
sym_map = m["symbol"].reindex(adata.var_names.astype(str))
genes = np.array([s if isinstance(s,str) and s.strip() and s!="nan" else g
                  for s,g in zip(sym_map.values, adata.var_names)])
# clusters: either Parse seurat_clusters (res 0.8) or de-novo Leiden at --resolution
if ARGS.resolution is None:
    cl_raw = adata.obs["seurat_clusters"].astype(str).str.replace("Cluster ","",regex=False).values
    cluster_src = "Parse/Trailmaker Leiden res 0.8"
else:
    R = ARGS.resolution; col = f"leiden_{R}"; used = None
    if os.path.exists(ARGS.labels_csv):
        lab = pd.read_csv(ARGS.labels_csv)
        if col in lab.columns and len(lab) == adata.n_obs:
            s = lab.set_index("cell_id")[col].reindex(adata.obs_names)
            if s.notna().all():
                cl_raw = s.astype(int).astype(str).values; used = f"sidecar:{os.path.basename(ARGS.labels_csv)}"
    if used is None:
        import scanpy as sc
        log(f"computing neighbors on X_harmony + leiden(res={R})…")
        sc.pp.neighbors(adata, use_rep="X_harmony", n_neighbors=15, random_state=SEED)
        sc.tl.leiden(adata, resolution=R, key_added=col, flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
        cl_raw = adata.obs[col].astype(str).values; used = "computed"
    cluster_src = f"de-novo Leiden res {R} on Parse Harmony embedding ({used})"
clusters = sorted(set(cl_raw), key=lambda s:int(s))
cidx = {c:k for k,c in enumerate(clusters)}
log("cluster source:", cluster_src, "->", len(clusters), "clusters")
ux, uy = adata.obsm["X_umap"][:,0], adata.obsm["X_umap"][:,1]

# ---- vectorized per-cluster mean/pct/l2fc on CP10k-normalized counts ----
log("marker math…")
raw = adata.X
N, G = raw.shape
tot = np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
norm = sp.diags(1e4/tot) @ raw
binX = (raw>0).astype(np.float32)
rows = np.array([cidx[c] for c in cl_raw])
C = sp.csr_matrix((np.ones(N,np.float32),(rows,np.arange(N))), shape=(len(clusters),N))
n_k = np.asarray(C.sum(1)).ravel()
sum_norm = (C @ norm).toarray(); sum_bin = (C @ binX).toarray()
g_norm = np.asarray(norm.sum(0)).ravel(); g_bin = np.asarray(binX.sum(0)).ravel()
eps=1.0
mean_mat = sum_norm/n_k[:,None]; pct_mat = sum_bin/n_k[:,None]

up_by, down_by = {}, {}
for k,c in enumerate(clusters):
    mean_in=sum_norm[k]/n_k[k]; mean_out=(g_norm-sum_norm[k])/(N-n_k[k])
    pct_in=sum_bin[k]/n_k[k]; pct_out=(g_bin-sum_bin[k])/(N-n_k[k])
    l2fc=np.log2((mean_in+eps)/(mean_out+eps))
    up=np.where(pct_in>=0.10)[0]; up=up[np.argsort(-l2fc[up])]
    up_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2fc[i]),2),"p1":round(float(pct_in[i]),3),"p2":round(float(pct_out[i]),3)} for i in up[:60]]
    dn=np.where(pct_out>=PCT_OUT_MIN)[0]; dn=dn[np.argsort(l2fc[dn])]
    down_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2fc[i]),2),"p1":round(float(pct_in[i]),3),"p2":round(float(pct_out[i]),3)} for i in dn[:N_DOWN]]

# ---- viz points + cluster records ----
log("viz points + records…")
import random as _r; _r.seed(SEED)
records, points = [], []
for k,c in enumerate(clusters):
    sel=np.where(rows==k)[0]; n=len(sel)
    cx,cy=float(ux[sel].mean()),float(uy[sel].mean())
    keep=min(n, max(MIN_PER_CLUSTER, min(MAX_PER_CLUSTER, round(TARGET_POINTS*n/N))))
    for j in _r.sample(list(sel), keep):
        points.append([round(float(ux[j]),3), round(float(uy[j]),3), k])
    seen,markers=set(),[]
    for mk in up_by[c]:
        if mk["g"] in seen: continue
        seen.add(mk["g"]); markers.append(mk)
        if len(markers)>=TOP_DEGS: break
    records.append({"id":c,"label":f"Cluster {c}","nCells":int(n),"cx":round(cx,3),"cy":round(cy,3),
                    "degsUp":[mk["g"] for mk in markers],"markers":markers,"markersDown":down_by[c][:8]})
_r.shuffle(points)

os.makedirs(PROFILE_DIR, exist_ok=True)
umap={"source":f"MegaFin Part 1 — 48 hpf TuWT, 93 drug samples — {cluster_src}",
      "totalCells":int(N),"fullDatasetCells":int(n_full),"nClusters":len(clusters),
      "clusters":records,"points":points}
json.dump(umap, open(os.path.join(OUT_DIR,"umap.json"),"w"), separators=(",",":"))
log("wrote umap.json", f"{os.path.getsize(os.path.join(OUT_DIR,'umap.json'))/1024:.0f}KB {len(points)} pts")

for k,c in enumerate(clusters):
    mean_in=sum_norm[k]/n_k[k]; mean_out=(g_norm-sum_norm[k])/(N-n_k[k])
    pct_in=sum_bin[k]/n_k[k]; pct_out=(g_bin-sum_bin[k])/(N-n_k[k])
    l2fc=np.log2((mean_in+eps)/(mean_out+eps))
    keep_g=np.where((pct_in>=DET_MIN)|(pct_out>=DET_MIN))[0]
    order=keep_g[np.argsort(-l2fc[keep_g])]
    prof=[{"g":str(genes[i]),"l2fc":round(float(l2fc[i]),2),"p1":round(float(pct_in[i]),3),"p2":round(float(pct_out[i]),3)} for i in order]
    json.dump({"id":c,"nCells":int(n_k[k]),"datasetCells":int(N),"nGenes":len(prof),"genes":prof},
              open(os.path.join(PROFILE_DIR,f"{c}.json"),"w"), separators=(",",":"))

gmax=pct_mat.max(0); gene_rows={}
for j in range(G):
    if gmax[j]<0.01: continue
    key=str(genes[j]).lower()
    if key in gene_rows: continue
    gene_rows[key]={"m":[round(float(v),1) for v in mean_mat[:,j]],"p":[round(float(v),3) for v in pct_mat[:,j]]}
json.dump({"clusters":clusters,"clusterSizes":[int(n_k[cidx[c]]) for c in clusters],"datasetCells":int(N),"nGenes":len(gene_rows),"genes":gene_rows},
          open(os.path.join(PROFILE_DIR,"gene_matrix.json"),"w"), separators=(",",":"))
log("wrote gene_matrix.json", len(gene_rows),"genes")

os.makedirs(os.path.dirname(SRV_OUT), exist_ok=True)
json.dump({"datasetCells":int(N),"assignedCells":int(N),
           "clusters":{c:{"nCells":int(n_k[cidx[c]]),"up":up_by[c][:40],"down":down_by[c]} for c in clusters}},
          open(SRV_OUT,"w"), separators=(",",":"))
log("wrote", SRV_OUT)
log("DONE clusters=%d points=%d"%(len(clusters),len(points)))
