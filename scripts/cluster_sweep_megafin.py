#!/usr/bin/env python3
"""Re-cluster the MegaFin Parse object's Harmony embedding at higher Leiden resolution.
Sweep 1.0/2.0/3.0, report cluster count + size distribution + marker-coherence, and save
all three partitions so build_megafin_asset.py can use the chosen one. (Interim Parse
object only — NOT the de-novo+LOKO rebuild.)"""
import scanpy as sc, anndata as ad, numpy as np, pandas as pd, scipy.sparse as sp, time
t0=time.time(); log=lambda *a: print(f"[{time.time()-t0:6.1f}s]",*a,flush=True)
H5AD="/scratch/bench/parse_megafin1.h5ad"
GENE_MAP="/scratch/bench/characterization/ensdarg_symbol_map.csv"
RES=[1.0,2.0,3.0]

log("load", H5AD)
a=ad.read_h5ad(H5AD)
a.X=a.X.tocsr() if sp.issparse(a.X) else sp.csr_matrix(a.X)
log("neighbors on X_harmony", a.obsm["X_harmony"].shape)
sc.pp.neighbors(a, use_rep="X_harmony", n_neighbors=15, random_state=0)
log("neighbors done")

# marker math helper (vectorized 1-vs-rest on CP10k) -> coherence per partition
raw=a.X; N,G=raw.shape
tot=np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
norm=sp.diags(1e4/tot)@raw; binX=(raw>0).astype(np.float32)
g_norm=np.asarray(norm.sum(0)).ravel(); g_bin=np.asarray(binX.sum(0)).ravel()
def coherence(labels):
    cats=sorted(set(labels), key=lambda s:int(s))
    cidx={c:k for k,c in enumerate(cats)}
    rows=np.array([cidx[c] for c in labels])
    C=sp.csr_matrix((np.ones(N,np.float32),(rows,np.arange(N))),shape=(len(cats),N))
    n_k=np.asarray(C.sum(1)).ravel()
    sum_norm=(C@norm).toarray(); sum_bin=(C@binX).toarray()
    coh=0
    for k in range(len(cats)):
        mean_in=sum_norm[k]/n_k[k]; mean_out=(g_norm-sum_norm[k])/(N-n_k[k])
        pct_in=sum_bin[k]/n_k[k]; pct_out=(g_bin-sum_bin[k])/(N-n_k[k])
        l2fc=np.log2((mean_in+1)/(mean_out+1))
        # coherent if it has >=1 specific marker
        ok=(l2fc>=1.0)&(pct_in>=0.25)&((pct_in-pct_out)>=0.15)
        if ok.any(): coh+=1
    return cats,n_k,coh

out=pd.DataFrame({"cell_id":a.obs_names})
rows=[]
for R in RES:
    sc.tl.leiden(a, resolution=R, key_added=f"leiden_{R}", flavor="igraph", n_iterations=2, directed=False, random_state=0)
    lab=a.obs[f"leiden_{R}"].astype(str).values
    out[f"leiden_{R}"]=lab
    cats,n_k,coh=coherence(lab)
    rows.append({"resolution":R,"n_clusters":len(cats),"min_size":int(n_k.min()),
                 "median_size":int(np.median(n_k)),"n_under50":int((n_k<50).sum()),
                 "coherent_clusters":coh,"coherent_frac":round(coh/len(cats),3)})
    log(f"res {R}: {len(cats)} clusters, median {int(np.median(n_k))}, <50: {int((n_k<50).sum())}, coherent {coh}/{len(cats)} ({coh/len(cats):.2f})")

out.to_csv("/scratch/bench/megafin_leiden_labels.csv", index=False)
m=pd.DataFrame(rows); m.to_csv("/scratch/bench/megafin_res_sweep.csv", index=False)
log("=== SWEEP SUMMARY ==="); print(m.to_string(index=False), flush=True)
log("saved labels + sweep metrics")
