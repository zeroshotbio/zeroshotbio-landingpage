#!/data/scratch/hier_venv/bin/python
"""Hierarchical pilot — STEP 1: fresh per-tissue re-embed + Leiden sweep (isolated venv).

For eye / muscle / glial: subset the authors' integrated DanioCell object to that tissue's
cells, re-HVG → re-PCA → neighbors → Leiden sweep (res 0.2–1.0), pick the FINEST resolution
whose mean silhouette stays >= COH (coherence-gated, count not forced). Per sub-cluster: top
markers (wilcoxon, ensembl→symbol), nCells, and the GT fine identity (majority vote of
identity.super) + its fraction. Writes a sub-atlas JSON per tissue.

NOTE: no stage/batch covariate survives in the on-box object's obs, so Harmony-on-stage cannot
be replicated; this is a single already-integrated source, so we re-embed without Harmony and
record the deviation. Read-only inputs; outputs additive under runs/daniocell_hier_<date>/.
"""
import json, csv, re, os, sys
import numpy as np, scanpy as sc
from collections import Counter

DATE="2026-06-20"
DD="/data/zeroshotbio-landingpage/daniotype_data/daniocell_native"
H5="/data/scratch/bench/daniocell_native_clustered_subset.h5ad"
ANN="/data/scratch/bench/daniocell_cluster_annotations.csv"
ENS="/data/scratch/bench/daniocell_native_canonical_map.csv"   # ensembl,symbol
OUT=f"/data/zeroshotbio-landingpage/runs/daniocell_hier_{DATE}/reembed"
TISSUES=["eye","muscle","glial"]
RES_BAND=[0.2,0.4,0.6,0.8,1.0]
COH=0.0   # coherence gate: keep raising res while mean silhouette stays > 0 (clusters separable)
os.makedirs(OUT, exist_ok=True)

# --- mappings ---
clust2fine={}
for r in csv.DictReader(open(ANN, encoding="utf-8-sig")):
    clust2fine[r["clust"]]=r["identity.super"].strip()
ens2sym={r[0]:r[1] for r in csv.reader(open(ENS)) if r and r[0]!="ensembl_id"}
um={str(c["id"]):c["label"] for c in json.load(open(f"{DD}/umap.json"))["clusters"]}   # cid->clust code
gt=json.load(open(f"{DD}/groundtruth.json"))["clusters"]
cid2tissue={cid:(g.get("tissue") or {}).get("label") for cid,g in gt.items()}
cid2fine={cid:clust2fine.get(um.get(cid)) for cid in gt}

print("loading h5ad…", flush=True)
ad=sc.read_h5ad(H5)
ad.obs["native_unit"]=ad.obs["native_unit"].astype(str)
ad.obs["tissue"]=ad.obs["native_unit"].map(cid2tissue)
ad.obs["fine"]=ad.obs["native_unit"].map(cid2fine)
# counts vs lognorm?
sample=ad.X[:50].data if hasattr(ad.X,"data") else np.asarray(ad.X[:50]).ravel()
is_counts=bool(np.all(np.equal(np.mod(sample[:2000],1),0)))
print(f"X looks like {'raw counts' if is_counts else 'normalized'}", flush=True)

summary={}
for tis in TISSUES:
    sub=ad[ad.obs["tissue"]==tis].copy()
    print(f"\n[{tis}] cells={sub.n_obs}", flush=True)
    if is_counts:
        sc.pp.normalize_total(sub, target_sum=1e4); sc.pp.log1p(sub)
    sub.raw=sub
    sc.pp.highly_variable_genes(sub, n_top_genes=2000)
    sub=sub[:, sub.var.highly_variable].copy()
    sc.pp.scale(sub, max_value=10)
    sc.tl.pca(sub, n_comps=min(50, sub.n_obs-1))
    sc.pp.neighbors(sub, n_neighbors=15, n_pcs=min(50, sub.n_obs-1))
    from sklearn.metrics import silhouette_score
    chosen=None
    for res in RES_BAND:
        sc.tl.leiden(sub, resolution=res, key_added="leiden", flavor="igraph", n_iterations=2, directed=False)
        k=sub.obs["leiden"].nunique()
        sil=silhouette_score(sub.obsm["X_pca"], sub.obs["leiden"]) if k>1 else -1.0
        print(f"   res {res}: {k} sub-clusters, silhouette {sil:.3f}", flush=True)
        if k>1 and sil>COH:
            chosen=(res,k,sil)   # finest-coherent: keep the LAST (highest res) that passes
    if chosen is None:
        sc.tl.leiden(sub, resolution=RES_BAND[0], key_added="leiden", flavor="igraph", n_iterations=2, directed=False)
        chosen=(RES_BAND[0], sub.obs["leiden"].nunique(), -1.0)
    else:
        sc.tl.leiden(sub, resolution=chosen[0], key_added="leiden", flavor="igraph", n_iterations=2, directed=False)
    res,k,sil=chosen
    print(f"   CHOSEN res {res}: {k} sub-clusters (silhouette {sil:.3f})", flush=True)
    # markers per sub-cluster
    sub.X=sub.raw[:, sub.var_names].X  # back to lognorm for DE
    sc.tl.rank_genes_groups(sub, "leiden", method="wilcoxon", n_genes=12)
    names=sub.uns["rank_genes_groups"]["names"]
    subclusters=[]
    for cl in sorted(sub.obs["leiden"].unique(), key=lambda x:int(x)):
        m=sub.obs["leiden"]==cl
        degs=[ens2sym.get(g, g) for g in list(names[cl])][:8]
        fines=[f for f in sub.obs.loc[m,"fine"] if f]
        c=Counter(fines); top=c.most_common(1)[0] if c else (None,0)
        subclusters.append({"id":f"{tis}.s{cl}", "nCells":int(m.sum()), "degsUp":degs,
                            "gtFine":top[0], "gtFineFrac":round(top[1]/max(1,len(fines)),3),
                            "gtTissue":tis})
    json.dump({"tissue":tis,"resolution":res,"silhouette":round(sil,3),"nSubclusters":k,
               "harmonyNote":"no batch covariate in obs — re-embedded without Harmony (single integrated source)",
               "subclusters":subclusters},
              open(f"{OUT}/{tis}_subatlas.json","w"), indent=1)
    summary[tis]={"cells":int(sub.n_obs),"res":res,"nSub":k,"silhouette":round(sil,3)}
    print(f"   wrote {OUT}/{tis}_subatlas.json", flush=True)

json.dump(summary, open(f"{OUT}/_reembed_summary.json","w"), indent=1)
print("\nRE-EMBED DONE:", json.dumps(summary))
