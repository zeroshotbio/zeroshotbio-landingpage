#!/usr/bin/env python3
"""Re-base a GT benchmark on the dataset's NATIVE annotation. STAGED only (*_native ids).

Units = the authors' own finest native cell groups (no de-novo clustering). Per-group
one-vs-rest DEGs become the markers the labeler sees. Native tiers are mapped into the
existing 4 slots (unused slots left empty → not scored), so the whole pipeline is reused
without tier-count surgery; cards report only the populated native tiers.

  ZSCAPE   : germ_layer, tissue, cell_type_broad, cell_type_sub  (4 native, unchanged)
  ChemFish : tissue, cell_type_sub=cell_type                     (2 native; germ/broad empty)
  DanioCell: tissue=cell_type, cell_type_broad=tissue.figure, cell_type_sub=cell_type_fine (3)

FULL group sizes recorded for the size-stratified scoring (>=100 / >=30 / all). Cells are
per-group capped (CAP) at load for DEG/`:5007` tractability; sizes are from the full window.
Usage: build_native_rebase.py <zscape|chemfish|daniocell>
"""
import json, os, sys, time, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad
t0=time.time(); log=lambda *a: print(f"[{time.time()-t0:7.1f}s]",*a,flush=True)
DS=sys.argv[1]
GENE_MAP="/data/scratch/bench/characterization/ensdarg_symbol_map.csv"
ROOT=os.path.join(os.path.dirname(__file__),".."); SCRATCH="/data/scratch/bench"
SEED=7; CAP=1500; TOP_DEGS=12; N_DOWN=8; PCT_OUT_MIN=0.20; DET_MIN=0.005
np.random.seed(SEED)

CFG={
 "daniocell":{"src":"/data/datasets/raw_datasets/DanioCell_h5ad/daniocell_canonical_all.h5ad",
   "window":("stage.integer",36,72),"finest":"cell_type_fine",
   "slots":{"tissue":"cell_type","cell_type_broad":"tissue.figure"},  # clust/cell_type_fine are codes, not nameable -> dropped from scoring
   "source_name":"DanioCell Sur et al. (Farrell/NICHD)","platform":"10X droplet"},
 "chemfish":{"src":"/data/datasets/processed/chemfish/chemfish.h5ad",
   "window":("timepoint","==","48"),"finest":"cell_type",
   "slots":{"tissue":"tissue","cell_type_sub":"cell_type"},
   "source_name":"ChemFish Barkan et al.","platform":"sci-RNA-seq3"},
 "zscape":{"src":"/data/datasets/raw_datasets/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad",
   "window":None,"finest":"cell_type_sub",
   "slots":{"germ_layer":"germ_layer","tissue":"tissue","cell_type_broad":"cell_type_broad","cell_type_sub":"cell_type_sub"},
   "source_name":"ZSCAPE Saunders et al.","platform":"10X droplet"},
}
c=CFG[DS]
OUT_DIR=os.path.join(ROOT,"daniotype_data",f"{DS}_native"); PROFILE_DIR=os.path.join(OUT_DIR,"archivist")
SRV_OUT=os.path.join(ROOT,"src","app","api","kasperov_agent",f"{DS}_native_archivist.json")
ALL_SLOTS=["germ_layer","tissue","cell_type_broad","cell_type_sub"]

log(f"load (backed) {c['src']}")
a=ad.read_h5ad(c["src"], backed='r'); obs=a.obs
# window mask
if c["window"]:
    col,op,*rest=c["window"]
    if op=="==": wmask=(obs[col].astype(str).values==rest[0])
    else: si=pd.to_numeric(obs[col].astype(str),errors="coerce").values; wmask=(si>=c["window"][1])&(si<=c["window"][2])
else: wmask=np.ones(a.n_obs,bool)
finest=obs[c["finest"]].astype(str).values
valid=wmask & (finest!="nan") & (finest!="None") & pd.notna(obs[c["finest"]].values)
wi=np.where(valid)[0]
flab=finest[wi]
groups=sorted(pd.unique(flab))
full_sizes={g:int((flab==g).sum()) for g in groups}
log(f"  window cells={len(wi)} | finest native groups={len(groups)} | sizes min/med/max={min(full_sizes.values())}/{int(np.median(list(full_sizes.values())))}/{max(full_sizes.values())}")

# per-group cap (DEG + :5007 tractability); keep ALL groups
rng=np.random.RandomState(SEED); keep=[]
for g in groups:
    idx=wi[flab==g]
    if len(idx)>CAP: idx=rng.choice(idx,CAP,replace=False)
    keep.append(idx)
keep=np.sort(np.concatenate(keep))
log(f"  capped working set: {len(keep)} cells (CAP={CAP}/group)")
adata=a[keep].to_memory(); del a
adata.X=adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
assert np.allclose(adata.X.data[:100000], np.round(adata.X.data[:100000])), "X must be raw counts"

# symbol map ENSDARG -> canonical
m=pd.read_csv(GENE_MAP); m["ensembl_id"]=m["ensembl_id"].astype(str).str.upper(); m=m.set_index("ensembl_id")
ens=(adata.var["gene_id"].astype(str) if "gene_id" in adata.var else pd.Series(adata.var_names).astype(str)).str.upper()
symv=m["symbol"].reindex(ens.values)
genes=np.array([s if isinstance(s,str) and s.strip() and s!="nan" else g for s,g in zip(symv, adata.var_names)])
log(f"  symbol map: {int(sum(1 for s in symv if isinstance(s,str) and s.strip() and s!='nan'))}/{adata.n_vars} canonical")

# integer unit ids 0..N-1 over native finest groups; native tier labels per unit
cl_lab=adata.obs[c["finest"]].astype(str).values
uid={g:i for i,g in enumerate(groups)}
cl_raw=np.array([uid[g] for g in cl_lab]).astype(str)
clusters=[str(i) for i in range(len(groups))]; cidx={cc:k for k,cc in enumerate(clusters)}
# per-unit native tier labels (slot-mapped); coarser tiers are deterministic from finest
slot_label={}  # slot -> {unit_id_str -> native label}
for slot,col in c["slots"].items():
    colv=adata.obs[col].astype(str).values
    d={}
    for g in groups:
        vals=pd.Series(colv[cl_lab==g]); vals=vals[(vals!="nan")&(vals!="None")]
        d[str(uid[g])]=str(vals.value_counts().index[0]) if len(vals) else None
    slot_label[slot]=d
# native vocab per populated slot
native_vocab={slot:sorted(set(v for v in d.values() if v)) for slot,d in slot_label.items()}
log("  native tiers: "+", ".join(f"{s}={len(native_vocab[s])}" for s in c["slots"]))

# ---- one-vs-rest DEGs on the capped set ----
raw=adata.X; N,G=raw.shape
tot=np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
norm=sp.diags((1e4/tot).astype(np.float32))@raw; binX=(raw>0).astype(np.float32)
g_norm=np.asarray(norm.sum(0)).ravel(); g_bin=np.asarray(binX.sum(0)).ravel()
rows_i=np.array([cidx[x] for x in cl_raw])
C=sp.csr_matrix((np.ones(N,np.float32),(rows_i,np.arange(N))),shape=(len(clusters),N))
n_k=np.asarray(C.sum(1)).ravel(); sum_norm=(C@norm).toarray(); sum_bin=(C@binX).toarray(); eps=1.0
mean_mat=sum_norm/n_k[:,None]; pct_mat=sum_bin/n_k[:,None]
up_by,down_by={},{}
for k,cc in enumerate(clusters):
    mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
    l2=np.log2((mi+eps)/(mo+eps))
    up=np.where(pi>=0.10)[0]; up=up[np.argsort(-l2[up])]
    up_by[cc]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in up[:60]]
    dn=np.where(po>=PCT_OUT_MIN)[0]; dn=dn[np.argsort(l2[dn])]
    down_by[cc]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in dn[:N_DOWN]]

# ---- staged native asset: umap.json (no map points needed), archivist, gene_matrix, server ----
os.makedirs(PROFILE_DIR, exist_ok=True)
records=[]
for k,cc in enumerate(clusters):
    seen,mk=set(),[]
    for d in up_by[cc]:
        if d["g"] in seen: continue
        seen.add(d["g"]); mk.append(d)
        if len(mk)>=TOP_DEGS: break
    records.append({"id":cc,"label":groups[k],"nCells":int(full_sizes[groups[k]]),"cx":0,"cy":0,
                    "degsUp":[x["g"] for x in mk],"markers":mk,"markersDown":down_by[cc][:8]})
json.dump({"source":f"{c['source_name']} — NATIVE-schema re-base: units = authors' finest native groups ({c['finest']}), per-group one-vs-rest DEGs. Not cross-dataset comparable.",
           "totalCells":int(sum(full_sizes.values())),"fullDatasetCells":int(sum(full_sizes.values())),"nClusters":len(clusters),
           "clusters":records,"points":[]}, open(os.path.join(OUT_DIR,"umap.json"),"w"), separators=(",",":"))
for k,cc in enumerate(clusters):
    mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
    l2=np.log2((mi+eps)/(mo+eps)); keep_g=np.where((pi>=DET_MIN)|(po>=DET_MIN))[0]; order=keep_g[np.argsort(-l2[keep_g])]
    prof=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in order]
    json.dump({"id":cc,"nCells":int(full_sizes[groups[k]]),"datasetCells":int(sum(full_sizes.values())),"nGenes":len(prof),"genes":prof},
              open(os.path.join(PROFILE_DIR,f"{cc}.json"),"w"), separators=(",",":"))
gmax=pct_mat.max(0); gr={}
for j in range(G):
    if gmax[j]<0.01: continue
    key=str(genes[j]).lower()
    if key in gr: continue
    gr[key]={"m":[round(float(v),1) for v in mean_mat[:,j]],"p":[round(float(v),3) for v in pct_mat[:,j]]}
json.dump({"clusters":clusters,"clusterSizes":[int(full_sizes[groups[cidx[cc]]]) for cc in clusters],"datasetCells":int(sum(full_sizes.values())),"nGenes":len(gr),"genes":gr},
          open(os.path.join(PROFILE_DIR,"gene_matrix.json"),"w"), separators=(",",":"))
os.makedirs(os.path.dirname(SRV_OUT),exist_ok=True)
json.dump({"datasetCells":int(sum(full_sizes.values())),"assignedCells":int(sum(full_sizes.values())),
           "clusters":{cc:{"nCells":int(full_sizes[groups[cidx[cc]]]),"up":up_by[cc][:40],"down":down_by[cc]} for cc in clusters}},
          open(SRV_OUT,"w"), separators=(",",":"))

# ---- native groundtruth.json (slot-mapped; pure native group => frac 1.0; nCells=FULL size) ----
gt={}
for k,cc in enumerate(clusters):
    sz=int(full_sizes[groups[k]]); entry={}
    for slot in ALL_SLOTS:
        if slot in slot_label and slot_label[slot][cc]:
            entry[slot]={"label":slot_label[slot][cc],"frac":1.0,"n":sz}
        else:
            entry[slot]={"label":None,"frac":0.0,"n":0}
    entry["nCells"]=sz
    gt[cc]=entry
json.dump({"tiers":ALL_SLOTS,"nativeTiers":list(c["slots"].keys()),"clusteredCells":int(sum(full_sizes.values())),
           "provenance":{"schema":"NATIVE","units":f"authors' finest native groups ({c['finest']})","not_cross_dataset_comparable":True,
                         "native_tier_columns":c["slots"],"platform":c["platform"],"cap_per_group":CAP},
           "clusters":gt}, open(os.path.join(OUT_DIR,"groundtruth.json"),"w"), separators=(",",":"))

# ---- :5007 native sidecar (capped set) + size table for stratified scoring ----
out=pd.DataFrame({"cell_id":adata.obs_names,"native_unit":cl_raw})
out.to_csv(f"{SCRATCH}/{DS}_native_labels.csv", index=False)
pd.DataFrame({"ensembl_id":list(adata.var_names),"symbol":[str(g) for g in genes]}).to_csv(f"{SCRATCH}/{DS}_native_canonical_map.csv", index=False)
ad.AnnData(X=raw, obs=pd.DataFrame({"native_unit":list(cl_raw)}, index=list(adata.obs_names)),
           var=pd.DataFrame(index=list(adata.var_names))).write_h5ad(f"{SCRATCH}/{DS}_native_clustered_subset.h5ad")
pd.DataFrame([{"unit":cc,"label":groups[cidx[cc]],"nCells":full_sizes[groups[cidx[cc]]]} for cc in clusters]).to_csv(f"{SCRATCH}/{DS}_native_unit_sizes.csv", index=False)

sizes=np.array([full_sizes[g] for g in groups])
json.dump({"dataset":DS,"units":len(clusters),"cells_window":int(sum(full_sizes.values())),
           "native_tiers":{s:len(native_vocab[s]) for s in c["slots"]},
           "size_strata":{"ge100":int((sizes>=100).sum()),"ge30":int((sizes>=30).sum()),"lt30":int((sizes<30).sum()),"all":len(sizes)},
           "staged":{"asset":OUT_DIR,"server_archivist":SRV_OUT,"h5ad":f"{SCRATCH}/{DS}_native_clustered_subset.h5ad",
                     "labels":f"{SCRATCH}/{DS}_native_labels.csv (col native_unit)","symbol_map":f"{SCRATCH}/{DS}_native_canonical_map.csv",
                     "unit_sizes":f"{SCRATCH}/{DS}_native_unit_sizes.csv"}},
          open(f"{SCRATCH}/{DS}_native_BUILD.json","w"), indent=1)
log(f"DONE {DS}_native: {len(clusters)} units, tiers {list(c['slots'].keys())}, asset+GT+sidecars staged")
