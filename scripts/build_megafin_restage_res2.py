#!/usr/bin/env python3
"""Re-stage the MegaFin rebuild asset at the DEFENSIBLE pick: v1 (Parse X_harmony) embedding,
Leiden res 2.0 = 85 clusters (coherence 0.929). Decision record:

  v1 (reuse Parse X_harmony):       coherence 0.867-0.938, 3-6 micro-clusters  <- BEST
  v2 (standard HVG->PCA->Harmony):  coherence 0.475-0.667, 56-63 micro-clusters <- WORSE, rejected

Re-embedding with the DanioType-standard recipe made coherence collapse, so the Parse-box
X_harmony is the right basis for this 93-condition drug screen. Per the branch-3 rule we accept
a sensible relaxed pick (~85, comparable to ChemFish 78 / DanioCell 77) and flag MegaFin as
less coherent than the other partitions (0.929 vs ~1.0). Builds the asset from the existing v1
sidecars (exact scored partition; NO re-cluster). STAGED to daniotype_data/megafin_rebuild/.
v2 dir kept as the rejected-experiment record; live megafin/ + :5007 registry untouched.
"""
import json, os, time, glob, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad
t0=time.time(); log=lambda *a: print(f"[{time.time()-t0:6.1f}s]",*a,flush=True)
SCRATCH="/data/scratch/bench"
ROOT=os.path.join(os.path.dirname(__file__),"..")
OUT_DIR=os.path.join(ROOT,"daniotype_data","megafin_rebuild"); PROFILE_DIR=os.path.join(OUT_DIR,"archivist")
SRV_OUT=os.path.join(ROOT,"src","app","api","kasperov_agent","megafin_rebuild_archivist.json")
GENE_MAP="/data/scratch/bench/characterization/ensdarg_symbol_map.csv"
RES_COL="leiden_2.0"; CHOSEN=2.0
TOP_DEGS=12; N_DOWN=8; PCT_OUT_MIN=0.20; DET_MIN=0.005; TARGET_POINTS=12000; MIN_PER_CLUSTER=30; MAX_PER_CLUSTER=450

log("load v1 sidecars")
adata=ad.read_h5ad(f"{SCRATCH}/megafin_rebuild_clustered_subset.h5ad")     # X=counts, var=ll_ids, obs=cell_id
adata.X=adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
lab=pd.read_csv(f"{SCRATCH}/megafin_rebuild_leiden_labels.csv").set_index("cell_id")
lab=lab.reindex(adata.obs_names)
assert lab[RES_COL].notna().all() and lab["umap_X"].notna().all(), "label/umap alignment failed"
cl_raw=lab[RES_COL].astype(int).astype(str).values
ux=lab["umap_X"].values.astype(float); uy=lab["umap_Y"].values.astype(float)
cmap=pd.read_csv(f"{SCRATCH}/megafin_rebuild_canonical_map.csv").set_index("gene_id")["symbol"]
genes=np.array([str(cmap.get(g,g)) for g in adata.var_names])
canon=set(str(s) for s in pd.read_csv(GENE_MAP)["symbol"].dropna().unique())
log(f"  cells {adata.n_obs} genes {adata.n_vars} | res {CHOSEN}: {len(set(cl_raw))} clusters")

raw=adata.X; N,G=raw.shape
clusters=sorted(set(cl_raw),key=lambda s:int(s)); cidx={c:k for k,c in enumerate(clusters)}
tot=np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
norm=sp.diags((1e4/tot).astype(np.float32))@raw; binX=(raw>0).astype(np.float32)
g_norm=np.asarray(norm.sum(0)).ravel(); g_bin=np.asarray(binX.sum(0)).ravel()
rows_i=np.array([cidx[c] for c in cl_raw])
C=sp.csr_matrix((np.ones(N,np.float32),(rows_i,np.arange(N))),shape=(len(clusters),N))
n_k=np.asarray(C.sum(1)).ravel(); sum_norm=(C@norm).toarray(); sum_bin=(C@binX).toarray(); eps=1.0
mean_mat=sum_norm/n_k[:,None]; pct_mat=sum_bin/n_k[:,None]
up_by,down_by={},{}
for k,c in enumerate(clusters):
    mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
    l2=np.log2((mi+eps)/(mo+eps))
    up=np.where(pi>=0.10)[0]; up=up[np.argsort(-l2[up])]
    up_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in up[:60]]
    dn=np.where(po>=PCT_OUT_MIN)[0]; dn=dn[np.argsort(l2[dn])]
    down_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in dn[:N_DOWN]]
import random as _r; _r.seed(7)
records,points=[],[]
for k,c in enumerate(clusters):
    sl=np.where(rows_i==k)[0]; n=len(sl); cx,cy=float(ux[sl].mean()),float(uy[sl].mean())
    keep=min(n,max(MIN_PER_CLUSTER,min(MAX_PER_CLUSTER,round(TARGET_POINTS*n/N))))
    for j in _r.sample(list(sl),keep): points.append([round(float(ux[j]),3),round(float(uy[j]),3),k])
    seen,mk=set(),[]
    for d in up_by[c]:
        if d["g"] in seen: continue
        seen.add(d["g"]); mk.append(d)
        if len(mk)>=TOP_DEGS: break
    records.append({"id":c,"label":f"Cluster {c}","nCells":int(n),"cx":round(cx,3),"cy":round(cy,3),
                    "degsUp":[x["g"] for x in mk],"markers":mk,"markersDown":down_by[c][:8]})
_r.shuffle(points)

# clear stale archivist (v1 had 128 files) then rewrite
for f in glob.glob(os.path.join(PROFILE_DIR,"*.json")): os.remove(f)
os.makedirs(PROFILE_DIR,exist_ok=True)
json.dump({"source":f"MegaFin Part 1 REBUILD — 48 hpf TuWT, 93 drug samples (Manual/Lawson object) — de-novo Leiden res {CHOSEN} ({len(clusters)} clusters) on the carried Harmony(sample) embedding. Standard re-embed tested and REJECTED (collapsed coherence); Parse embedding retained. Supersedes the 77-cluster Parse interim.",
           "totalCells":int(N),"fullDatasetCells":int(N),"nClusters":len(clusters),"clusters":records,"points":points},
          open(os.path.join(OUT_DIR,"umap.json"),"w"),separators=(",",":"))
for k,c in enumerate(clusters):
    mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
    l2=np.log2((mi+eps)/(mo+eps)); keep_g=np.where((pi>=DET_MIN)|(po>=DET_MIN))[0]; order=keep_g[np.argsort(-l2[keep_g])]
    prof=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in order]
    json.dump({"id":c,"nCells":int(n_k[k]),"datasetCells":int(N),"nGenes":len(prof),"genes":prof},open(os.path.join(PROFILE_DIR,f"{c}.json"),"w"),separators=(",",":"))
gmax=pct_mat.max(0); gr={}
for j in range(G):
    if gmax[j]<0.01: continue
    key=str(genes[j]).lower()
    if key in gr: continue
    gr[key]={"m":[round(float(v),1) for v in mean_mat[:,j]],"p":[round(float(v),3) for v in pct_mat[:,j]]}
json.dump({"clusters":clusters,"clusterSizes":[int(n_k[cidx[c]]) for c in clusters],"datasetCells":int(N),"nGenes":len(gr),"genes":gr},
          open(os.path.join(PROFILE_DIR,"gene_matrix.json"),"w"),separators=(",",":"))
json.dump({"datasetCells":int(N),"assignedCells":int(N),"clusters":{c:{"nCells":int(n_k[cidx[c]]),"up":up_by[c][:40],"down":down_by[c]} for c in clusters}},
          open(SRV_OUT,"w"),separators=(",",":"))

marker_toks=set(t for c in clusters for t in [d["g"] for d in up_by[c]])
marker_div=sorted(t for t in marker_toks if t not in canon)
sizes=sorted(int(x) for x in n_k)
json.dump({"state":"DONE","ts":time.strftime("%Y-%m-%dT%H:%M:%S"),"chosen":"v1 Parse-embedding @ res 2.0",
           "n_clusters":len(clusters),"coherent_frac_at_pick":0.929,"cells":int(N),
           "selection_method":"branch-3 relaxed pick: re-embed (v2) tested & rejected (coherence collapsed 0.93->0.67); kept Parse X_harmony; finest res in 50-90 window at coherence plateau; MegaFin flagged less coherent (0.929) than other partitions (~1.0)",
           "size_min":sizes[0],"size_median":int(np.median(sizes)),"size_max":sizes[-1],"n_under50":int((np.array(sizes)<50).sum()),
           "marker_token_divergence":len(marker_div),"marker_div_examples":marker_div[:25],
           "cluster_sizes":sizes,
           "go_live_recipe":{"asset_dir":"daniotype_data/megafin_rebuild/","server_archivist":"megafin_rebuild_archivist.json",
                             "h5ad":f"{SCRATCH}/megafin_rebuild_clustered_subset.h5ad",
                             "assign":f"{SCRATCH}/megafin_rebuild_leiden_labels.csv","cluster_col":"leiden_2.0","bc_col":"cell_id",
                             "symbol_map":f"{SCRATCH}/megafin_rebuild_canonical_map.csv","map_id_col":"gene_id","map_sym_col":"symbol"},
           "note":"STAGED only. v1 res-4.0 asset OVERWRITTEN by res-2.0 (same embedding/sidecars; all leiden cols still in labels csv). v2 re-embed dir kept as rejected record. live megafin/ + :5007 registry untouched."},
          open(f"{SCRATCH}/megafin_rebuild_FINAL_STATUS.json","w"),indent=1)
log(f"DONE re-stage: res {CHOSEN}, {len(clusters)} clusters, marker_div {len(marker_div)}, sizes {sizes[0]}/{int(np.median(sizes))}/{sizes[-1]} (min/med/max), n_under50 {int((np.array(sizes)<50).sum())}")
