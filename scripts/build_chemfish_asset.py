#!/usr/bin/env python3
"""Build ChemFish (Barkan et al., CHEM10 DSP + CHEM11 BS3) to GT-dataset parity for the
daniotype_kasperov wizard — same recipe as the other datasets. OFFLINE build only.

ChemFish has ~2M cells across 36/48/72 hpf. For parity with the other 48hpf atlases we
take the 48 hpf subset (both CHEM10 + CHEM11 present there) and subsample for clustering.
De-novo: HVG -> PCA -> Harmony(on `expt`) -> kNN -> Leiden sweep, coherence-selected res.
Published labels are HELD OUT and attached afterward as ground truth.

GT tier caveat (CARRIED FORWARD): ChemFish ships only `cell_type` (349) + `tissue` (40).
The four-tier GT is therefore PROJECTED, not independent:
  cell_type_sub  = cell_type            (native, finest)
  cell_type_broad = cell_type w/ marker-qualifier parentheticals stripped  (derived)
  tissue          = tissue              (native)
  germ_layer      = anatomical projection from tissue  (NOT native ChemFish)
Recorded in groundtruth.json.provenance.

Outputs (NEW files only; nothing deployed/restarted here):
  daniotype_data/chemfish/umap.json, archivist/<id>.json + gene_matrix.json, groundtruth.json
  src/app/api/kasperov_agent/chemfish_archivist.json
  /data/scratch/bench/chemfish_leiden_labels.csv, chemfish_canonical_map.csv, chemfish_clustered_subset.h5ad
  /data/scratch/bench/chemfish_res_sweep.csv
"""
import json, os, time, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad, scanpy as sc, re
t0=time.time(); log=lambda *a: print(f"[{time.time()-t0:6.1f}s]",*a,flush=True)

H5AD="/data/datasets/processed/chemfish/chemfish.h5ad"
GENE_MAP="/data/scratch/bench/characterization/ensdarg_symbol_map.csv"
ROOT=os.path.join(os.path.dirname(__file__),"..")
OUT_DIR=os.path.join(ROOT,"daniotype_data","chemfish"); PROFILE_DIR=os.path.join(OUT_DIR,"archivist")
SRV_OUT=os.path.join(ROOT,"src","app","api","kasperov_agent","chemfish_archivist.json")
SCRATCH="/data/scratch/bench"
SEED=7; N_SUB=250_000; N_HVG=3000; N_PCS=50; NN=15; BATCH="expt"; TIMEPOINT="48"
RES=[1.0,2.0,3.0,4.0,5.0]
TARGET_POINTS=12000; MIN_PER_CLUSTER=30; MAX_PER_CLUSTER=450; TOP_DEGS=12; N_DOWN=8; PCT_OUT_MIN=0.20; DET_MIN=0.005
TIERS=["germ_layer","tissue","cell_type_broad","cell_type_sub"]
np.random.seed(SEED)

# anatomical tissue -> germ layer projection (ChemFish's 40 tissues). Carry the caveat.
GERM={
 "CNS other":"ectoderm","ear":"ectoderm","epiderm":"ectoderm","epithelium":"ectoderm","eye":"ectoderm",
 "floor plate":"ectoderm","forebrain":"ectoderm","hindbrain":"ectoderm","ionocytes":"ectoderm","lens":"ectoderm",
 "midbrain":"ectoderm","motor neuron":"ectoderm","olfactory":"ectoderm","periderm":"ectoderm","retina":"ectoderm",
 "rhombomeres":"ectoderm","spinal cord":"ectoderm",
 "blood":"mesoderm","cardiomyocyte":"mesoderm","endothelium":"mesoderm","fast muscle":"mesoderm",
 "head mesenchyme":"mesoderm","lpm derivatives":"mesoderm","mesenchyme":"mesoderm","muscle":"mesoderm",
 "notochord":"mesoderm","pectoral fin":"mesoderm","pronephros":"mesoderm","sclerotome":"mesoderm","slow muscle":"mesoderm",
 "endoderm":"endoderm","intestine":"endoderm","pancreas":"endoderm",
 "neural crest":"neural crest","head mesenchyme neural crest":"neural crest","pigment":"neural crest",
 "cranial sensory ganglia":"neural crest","pharyngeal arch":"neural crest",
}
def germ_of(t): return GERM.get(str(t))
def broad_of(ct):
    b=re.sub(r"\s*\([^)]*\)","",str(ct)).strip()
    return b or str(ct)

log("load (backed) + 48hpf subsample", H5AD)
a=ad.read_h5ad(H5AD, backed='r')
mask=np.where(a.obs["timepoint"].astype(str).values==TIMEPOINT)[0]
log(f"  48hpf cells: {len(mask)}")
sel=np.sort(np.random.choice(mask, size=min(N_SUB,len(mask)), replace=False))
adata=a[sel].to_memory()
del a
adata.X=adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
assert np.allclose(adata.X.data, np.round(adata.X.data)), "X must be raw counts"
N0=adata.n_obs
log("  subset", adata.shape, "| batches(expt):", adata.obs[BATCH].astype(str).nunique())

# symbols: ENSDARG (var.id) -> shared canonical (same map as megafin/minifin/zscape)
m=pd.read_csv(GENE_MAP); m["ensembl_id"]=m["ensembl_id"].astype(str).str.upper(); m=m.set_index("ensembl_id")
ens=adata.var["gene_id"].astype(str).str.upper() if "gene_id" in adata.var else pd.Series(adata.var_names).astype(str).str.upper()
symv=m["symbol"].reindex(ens.values)
genes=np.array([s if isinstance(s,str) and s.strip() and s!="nan" else g for s,g in zip(symv, adata.var_names)])
log(f"  symbol map: {int(sum(1 for s in symv if isinstance(s,str) and s.strip() and s!='nan'))}/{adata.n_vars} via ENSDARG")

raw=adata.X.copy()  # raw counts for marker math + subset h5ad
# embedding
sc.pp.normalize_total(adata, target_sum=1e4); sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG, flavor="seurat")
w=adata[:, adata.var.highly_variable].copy(); sc.pp.scale(w, max_value=10)
sc.tl.pca(w, n_comps=N_PCS, svd_solver="arpack", random_state=SEED)
log("PCA done -> harmony on", BATCH)
sc.external.pp.harmony_integrate(w, BATCH, basis="X_pca", adjusted_basis="X_pca_harmony", random_state=SEED)
adata.obsm["X_pca_harmony"]=w.obsm["X_pca_harmony"]
sc.pp.neighbors(adata, n_neighbors=NN, use_rep="X_pca_harmony", random_state=SEED)
sc.tl.umap(adata, random_state=SEED); log("umap done")

# coherence sweep (same rule as cluster_sweep_megafin/minifin)
tot=np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
norm=sp.diags(1e4/tot)@raw; binX=(raw>0).astype(np.float32)
g_norm=np.asarray(norm.sum(0)).ravel(); g_bin=np.asarray(binX.sum(0)).ravel()
def coherence(labels):
    cats=sorted(set(labels), key=lambda s:int(s)); cidx={c:k for k,c in enumerate(cats)}
    rows=np.array([cidx[c] for c in labels])
    C=sp.csr_matrix((np.ones(N0,np.float32),(rows,np.arange(N0))),shape=(len(cats),N0))
    n_k=np.asarray(C.sum(1)).ravel(); sn=(C@norm).toarray(); sb=(C@binX).toarray(); coh=0
    for k in range(len(cats)):
        mi=sn[k]/n_k[k]; mo=(g_norm-sn[k])/(N0-n_k[k]); pi=sb[k]/n_k[k]; po=(g_bin-sb[k])/(N0-n_k[k])
        l2=np.log2((mi+1)/(mo+1))
        if ((l2>=1.0)&(pi>=0.25)&((pi-po)>=0.15)).any(): coh+=1
    return cats,n_k,coh
out=pd.DataFrame({"cell_id":adata.obs_names,"umap_X":np.round(adata.obsm["X_umap"][:,0],4),"umap_Y":np.round(adata.obsm["X_umap"][:,1],4)})
rows=[]
for R in RES:
    sc.tl.leiden(adata, resolution=R, key_added=f"leiden_{R}", flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
    lab=adata.obs[f"leiden_{R}"].astype(str).values; out[f"leiden_{R}"]=lab
    cats,n_k,coh=coherence(lab)
    rows.append({"resolution":R,"n_clusters":len(cats),"min_size":int(n_k.min()),"median_size":int(np.median(n_k)),
                 "n_under50":int((n_k<50).sum()),"coherent":coh,"coherent_frac":round(coh/len(cats),3)})
    log(f"res {R}: {len(cats)} clusters min {int(n_k.min())} med {int(np.median(n_k))} <50 {int((n_k<50).sum())} coherent {coh}/{len(cats)}")
sweep=pd.DataFrame(rows); sweep.to_csv(f"{SCRATCH}/chemfish_res_sweep.csv", index=False)
out.to_csv(f"{SCRATCH}/chemfish_leiden_labels.csv", index=False)
# auto-pick: finest res still marker-coherent and well-supported (min cluster >=30, the
# MIN_PER_CLUSTER floor) — matches the cell-type-level granularity of the other datasets.
ok=sweep[(sweep.coherent_frac>=0.95)&(sweep.min_size>=30)]
CHOSEN=float(ok.resolution.max()) if len(ok) else float(sweep.sort_values("coherent_frac").iloc[-1].resolution)
log("=== SWEEP ==="); print(sweep.to_string(index=False), flush=True); log("CHOSEN resolution:", CHOSEN)

cl_raw=out[f"leiden_{CHOSEN}"].astype(int).astype(str).values
clusters=sorted(set(cl_raw), key=lambda s:int(s)); cidx={c:k for k,c in enumerate(clusters)}
ux,uy=adata.obsm["X_umap"][:,0],adata.obsm["X_umap"][:,1]

# marker math (vectorized, canonical symbols)
N,G=raw.shape
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

# held-out GT: 4 tiers (projected) majority + purity
ct=adata.obs["cell_type"].astype(str).values; tis=adata.obs["tissue"].astype(str).values
sub=ct; broad=np.array([broad_of(x) for x in ct]); germ=np.array([germ_of(x) for x in tis], dtype=object)
tiervals={"germ_layer":germ,"tissue":tis,"cell_type_broad":broad,"cell_type_sub":sub}
gt={}
for c in clusters:
    selc=np.where(cl_raw==c)[0]; entry={}
    for tier in TIERS:
        vals=pd.Series(tiervals[tier][selc]).dropna(); vals=vals[vals.astype(str)!="nan"]
        if len(vals):
            vc=vals.value_counts(); entry[tier]={"label":str(vc.index[0]),"frac":round(float(vc.iloc[0]/len(selc)),3),"n":int(vc.iloc[0])}
        else: entry[tier]={"label":None,"frac":0.0,"n":0}
    gt[c]=entry

# viz points + records
import random as _r; _r.seed(SEED)
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
os.makedirs(PROFILE_DIR, exist_ok=True)
json.dump({"source":f"ChemFish Barkan et al. (CHEM10 DSP + CHEM11 BS3) — 48 hpf subset, de-novo Leiden res {CHOSEN} on Harmony(expt) embedding",
           "totalCells":int(N),"fullDatasetCells":int(len(mask)),"nClusters":len(clusters),"clusters":records,"points":points},
          open(os.path.join(OUT_DIR,"umap.json"),"w"), separators=(",",":"))
log("wrote umap.json", len(points),"pts")
json.dump({"tiers":TIERS,"fullDatasetCells":int(len(mask)),"clusteredCells":int(N),
           "provenance":{"caveat":"4-tier GT is PROJECTED, not independent. cell_type_sub + tissue are native ChemFish; "
                         "cell_type_broad is cell_type with marker-qualifier parentheticals stripped; germ_layer is an "
                         "anatomical projection from tissue (not a native ChemFish label). Treat coarse-tier scores accordingly.",
                         "native_tiers":["tissue","cell_type_sub"],"projected_tiers":["germ_layer","cell_type_broad"]},
           "clusters":gt}, open(os.path.join(OUT_DIR,"groundtruth.json"),"w"), separators=(",",":"))
log("wrote groundtruth.json")

# profiles + gene_matrix + server archivist
for k,c in enumerate(clusters):
    mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
    l2=np.log2((mi+eps)/(mo+eps)); keep_g=np.where((pi>=DET_MIN)|(po>=DET_MIN))[0]; order=keep_g[np.argsort(-l2[keep_g])]
    prof=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in order]
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
os.makedirs(os.path.dirname(SRV_OUT), exist_ok=True)
json.dump({"datasetCells":int(N),"assignedCells":int(N),"clusters":{c:{"nCells":int(n_k[cidx[c]]),"up":up_by[c][:40],"down":down_by[c]} for c in clusters}},
          open(SRV_OUT,"w"), separators=(",",":"))
log("wrote profiles + gene_matrix + server archivist")

# :5007 sidecars
out["leaf"]=cl_raw; out.to_csv(f"{SCRATCH}/chemfish_leiden_labels.csv", index=False)  # cell_id, umap_X/Y, leiden_*, leaf
pd.DataFrame({"ensembl_id":list(adata.var_names),"symbol":[str(g) for g in genes]}).to_csv(f"{SCRATCH}/chemfish_canonical_map.csv", index=False)
sub_h=ad.AnnData(X=raw, obs=pd.DataFrame({"leaf":list(cl_raw)}, index=list(adata.obs_names)), var=pd.DataFrame(index=list(adata.var_names)))
sub_h.write_h5ad(f"{SCRATCH}/chemfish_clustered_subset.h5ad")
log("wrote :5007 sidecars (leaf labels incl umap, canonical map, subset h5ad)")
log("DONE clusters=%d res=%s points=%d"%(len(clusters),CHOSEN,len(points)))
