#!/usr/bin/env python3
"""MegaFin rebuild v2 — RE-EMBED with the DanioType-standard recipe, then re-sweep.

Diagnosis (v1 = build_megafin_rebuild_asset.py): the v1 build reused the carried Parse-box
X_harmony (Harmony-on-sample, built on GeneFull for Trailmaker comparability), NOT the
DanioType-standard recipe. v1 sweep peaked at coherence 0.938 and — unlike every
standard-recipe dataset (DanioCell: coherence 1.0, min_size 188) — produced 10-20 cell
micro-clusters at EVERY resolution incl. coarse res 1.0, so min_size>=30 was never met (the
binding constraint). Micro-islands at coarse resolution are the embedding-artifact signature.

v2 re-embeds from the primary Gene layer (X): normalize_total -> log1p -> HVG(seurat,3000) ->
scale -> PCA(50) -> Harmony(sample) -> neighbors -> UMAP, exactly as MiniFin/ChemFish/DanioCell,
then re-sweeps Leiden [1-5] with the same coherence+min30 selection. Markers/DEGs on the
primary Gene layer. Same Lawson LL -> ENSDARG -> canonical ZFIN symbol flip as v1.

STAGED ONLY to *_v2 paths; v1 outputs + live megafin/ + :5007 registry all untouched.
"""
import json, os, time, gc, traceback, numpy as np, pandas as pd, scipy.sparse as sp, anndata as ad, scanpy as sc
t0 = time.time(); log = lambda *a: print(f"[{time.time()-t0:7.1f}s]", *a, flush=True)

H5AD     = "/data/scratch/bench/megafin_rebuild_src.h5ad"
LAW2ENS  = "/data/scratch/bench/characterization/lawson_to_ensdarg.csv"
GENE_MAP = "/data/scratch/bench/characterization/ensdarg_symbol_map.csv"
ROOT     = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR  = os.path.join(ROOT, "daniotype_data", "megafin_rebuild_v2")     # versioned, parallel to v1
PROFILE_DIR = os.path.join(OUT_DIR, "archivist")
SRV_OUT  = os.path.join(ROOT, "src", "app", "api", "kasperov_agent", "megafin_rebuild_v2_archivist.json")
SCRATCH  = "/data/scratch/bench"
MARKER   = f"{SCRATCH}/megafin_rebuild_v2_STATUS.json"
V1_SWEEP = f"{SCRATCH}/megafin_rebuild_res_sweep.csv"

SEED=7; N_HVG=3000; N_PCS=50; NN=15; BATCH="sample"
RES=[1.0,2.0,3.0,4.0,5.0]
TARGET_POINTS=12000; MIN_PER_CLUSTER=30; MAX_PER_CLUSTER=450; TOP_DEGS=12; N_DOWN=8; PCT_OUT_MIN=0.20; DET_MIN=0.005
COH_STD=0.95; MIN_STD=30; SENSIBLE_HI=90; SENSIBLE_LO=45     # relaxed-pick window if standard rule unmet
np.random.seed(SEED)

def write_status(state, **kw):
    json.dump({"state": state, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "elapsed_s": round(time.time()-t0,1), **kw},
              open(MARKER, "w"), indent=1)

try:
    write_status("RUNNING", step="load")
    log("load", H5AD)
    a = ad.read_h5ad(H5AD, backed='r'); adata = a.to_memory(); del a
    if "GeneFull" in adata.layers: del adata.layers["GeneFull"]
    for k in list(adata.obsm.keys()):
        if k != "X_umap": del adata.obsm[k]            # discard reused Parse X_harmony/X_pca; we re-embed
    gc.collect()
    adata.X = adata.X.tocsr() if sp.issparse(adata.X) else sp.csr_matrix(adata.X)
    n_pre = adata.n_obs
    if "is_doublet" in adata.obs:
        adata = adata[adata.obs["is_doublet"].astype(float).values < 0.5].copy(); gc.collect()
    adata.obs[BATCH] = adata.obs[BATCH].astype(str)
    log(f"  cells {n_pre}->{adata.n_obs} | genes {adata.n_vars} | Harmony batches({BATCH}): {adata.obs[BATCH].nunique()}")

    # ---- gene namespace: Lawson LL/symbol -> canonical ZFIN symbol (same as v1) ----
    write_status("RUNNING", step="gene_map")
    ll = adata.var["ll_id"].astype(str).str.upper().values
    lawson_sym = adata.var["symbol"].astype(str).values
    l2e = pd.read_csv(LAW2ENS); l2e["lawson_gene_id"] = l2e["lawson_gene_id"].astype(str).str.upper()
    ll2ens = l2e.set_index("lawson_gene_id")["mapped_ensdarg"]
    m = pd.read_csv(GENE_MAP); m["ensembl_id"] = m["ensembl_id"].astype(str).str.upper()
    ens2sym = m.set_index("ensembl_id")["symbol"]
    canon = set(str(s) for s in m["symbol"].dropna().unique()); canon_lower = {s.lower(): s for s in canon}
    sym_via_ens = ens2sym.reindex(pd.Series(ll2ens.reindex(ll).values).astype(str).str.upper().values).values
    def resolve(i):
        s = sym_via_ens[i]
        if isinstance(s, str) and s.strip() and s != "nan": return s
        g = lawson_sym[i]
        if g in canon: return g
        if g.lower() in canon_lower: return canon_lower[g.lower()]
        return g
    genes = np.array([resolve(i) for i in range(len(ll))])
    n_canon = int(sum(1 for g in genes if g in canon))
    log(f"  canonical: {n_canon}/{len(genes)} ({100*n_canon/len(genes):.1f}%)")

    # ---- STANDARD re-embed: HVG -> PCA -> Harmony(sample) -> neighbors -> UMAP ----
    write_status("RUNNING", step="reembed")
    raw = adata.X.copy()                                # primary Gene counts for marker math
    sc.pp.normalize_total(adata, target_sum=1e4); sc.pp.log1p(adata)
    sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG, flavor="seurat")
    w = adata[:, adata.var.highly_variable].copy(); sc.pp.scale(w, max_value=10)
    sc.tl.pca(w, n_comps=N_PCS, svd_solver="arpack", random_state=SEED); log("PCA done -> harmony")
    sc.external.pp.harmony_integrate(w, BATCH, basis="X_pca", adjusted_basis="X_pca_harmony", random_state=SEED)
    adata.obsm["X_pca_harmony"] = w.obsm["X_pca_harmony"]; del w; gc.collect()
    sc.pp.neighbors(adata, n_neighbors=NN, use_rep="X_pca_harmony", random_state=SEED); log("neighbors done")
    sc.tl.umap(adata, random_state=SEED); log("umap done")

    N0 = adata.n_obs
    tot = np.asarray(raw.sum(1)).ravel(); tot[tot==0]=1
    norm = sp.diags((1e4/tot).astype(np.float32)) @ raw
    binX = (raw>0).astype(np.float32)
    g_norm = np.asarray(norm.sum(0)).ravel(); g_bin = np.asarray(binX.sum(0)).ravel()
    def coherence(labels):
        cats = sorted(set(labels), key=lambda s:int(s)); cidx={c:k for k,c in enumerate(cats)}
        rows = np.array([cidx[c] for c in labels])
        C = sp.csr_matrix((np.ones(N0,np.float32),(rows,np.arange(N0))),shape=(len(cats),N0))
        n_k = np.asarray(C.sum(1)).ravel(); sn=(C@norm).toarray(); sb=(C@binX).toarray(); coh=0
        for k in range(len(cats)):
            mi=sn[k]/n_k[k]; mo=(g_norm-sn[k])/(N0-n_k[k]); pi=sb[k]/n_k[k]; po=(g_bin-sb[k])/(N0-n_k[k])
            if (((np.log2((mi+1)/(mo+1)))>=1.0)&(pi>=0.25)&((pi-po)>=0.15)).any(): coh+=1
        return cats,n_k,coh
    out = pd.DataFrame({"cell_id":adata.obs_names,
                        "umap_X":np.round(adata.obsm["X_umap"][:,0],4),"umap_Y":np.round(adata.obsm["X_umap"][:,1],4)})
    rows=[]
    for R in RES:
        write_status("RUNNING", step=f"leiden_{R}")
        sc.tl.leiden(adata, resolution=R, key_added=f"leiden_{R}", flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
        lab = adata.obs[f"leiden_{R}"].astype(str).values; out[f"leiden_{R}"]=lab
        cats,n_k,coh = coherence(lab)
        rows.append({"resolution":R,"n_clusters":len(cats),"min_size":int(n_k.min()),"median_size":int(np.median(n_k)),
                     "n_under50":int((n_k<50).sum()),"coherent":coh,"coherent_frac":round(coh/len(cats),3)})
        log(f"res {R}: {len(cats)} clusters min {int(n_k.min())} med {int(np.median(n_k))} coherent {coh}/{len(cats)} ({coh/len(cats):.3f})")
    sweep = pd.DataFrame(rows); sweep.to_csv(f"{SCRATCH}/megafin_rebuild_v2_res_sweep.csv", index=False)
    log("=== v2 SWEEP ==="); print(sweep.to_string(index=False), flush=True)

    # ---- selection: standard rule first, else documented relaxed peak in sensible window ----
    ok = sweep[(sweep.coherent_frac>=COH_STD)&(sweep.min_size>=MIN_STD)]
    if len(ok):
        CHOSEN = float(ok.resolution.max()); method = f"standard-rule (re-embedded): coherent_frac>={COH_STD} & min_size>={MIN_STD}, finest"
        relax = None
    else:
        win = sweep[(sweep.n_clusters>=SENSIBLE_LO)&(sweep.n_clusters<=SENSIBLE_HI)]
        pool = win if len(win) else sweep
        peak = float(pool.coherent_frac.max())
        cand = pool[pool.coherent_frac>=peak-1e-9]
        CHOSEN = float(cand.resolution.min())   # finest at the peak within the sensible window
        chosen_row = sweep[sweep.resolution==CHOSEN].iloc[0]
        method = f"relaxed peak-pick (re-embedded): no res met {COH_STD}/{MIN_STD}; chose coherence peak within {SENSIBLE_LO}-{SENSIBLE_HI} clusters"
        relax = {"coherence_threshold_relaxed_from": COH_STD, "to": round(float(chosen_row.coherent_frac),3),
                 "min_size_floor": MIN_STD, "min_size_actual": int(chosen_row.min_size),
                 "min_size_exception": bool(chosen_row.min_size < MIN_STD),
                 "n_clusters_under50": int(chosen_row.n_under50)}
    log("CHOSEN resolution:", CHOSEN, "| method:", method)

    # ---- markers/DEGs at chosen resolution (primary Gene layer) ----
    write_status("RUNNING", step="markers", chosen_resolution=CHOSEN)
    cl_raw = out[f"leiden_{CHOSEN}"].astype(int).astype(str).values
    clusters = sorted(set(cl_raw), key=lambda s:int(s)); cidx={c:k for k,c in enumerate(clusters)}
    ux,uy = adata.obsm["X_umap"][:,0], adata.obsm["X_umap"][:,1]
    N,G = raw.shape
    rows_i = np.array([cidx[c] for c in cl_raw])
    C = sp.csr_matrix((np.ones(N,np.float32),(rows_i,np.arange(N))),shape=(len(clusters),N))
    n_k = np.asarray(C.sum(1)).ravel(); sum_norm=(C@norm).toarray(); sum_bin=(C@binX).toarray(); eps=1.0
    mean_mat = sum_norm/n_k[:,None]; pct_mat = sum_bin/n_k[:,None]
    up_by,down_by = {},{}
    for k,c in enumerate(clusters):
        mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
        l2=np.log2((mi+eps)/(mo+eps))
        up=np.where(pi>=0.10)[0]; up=up[np.argsort(-l2[up])]
        up_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in up[:60]]
        dn=np.where(po>=PCT_OUT_MIN)[0]; dn=dn[np.argsort(l2[dn])]
        down_by[c]=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in dn[:N_DOWN]]
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
    marker_toks = set(t for c in clusters for t in [d["g"] for d in up_by[c]])
    marker_div = sorted(t for t in marker_toks if t not in canon)

    os.makedirs(PROFILE_DIR, exist_ok=True)
    json.dump({"source":f"MegaFin Part 1 REBUILD v2 — 48 hpf TuWT, 93 drug samples (Manual/Lawson object) — de-novo Leiden res {CHOSEN} on DanioType-standard re-embed (HVG->PCA->Harmony[sample]->neighbors), supersedes the v1 Parse-embedding rebuild and the 77-cluster Parse interim",
               "totalCells":int(N),"fullDatasetCells":int(n_pre),"nClusters":len(clusters),"clusters":records,"points":points},
              open(os.path.join(OUT_DIR,"umap.json"),"w"), separators=(",",":"))
    for k,c in enumerate(clusters):
        mi=sum_norm[k]/n_k[k]; mo=(g_norm-sum_norm[k])/(N-n_k[k]); pi=sum_bin[k]/n_k[k]; po=(g_bin-sum_bin[k])/(N-n_k[k])
        l2=np.log2((mi+eps)/(mo+eps)); keep_g=np.where((pi>=DET_MIN)|(po>=DET_MIN))[0]; order=keep_g[np.argsort(-l2[keep_g])]
        prof=[{"g":str(genes[i]),"l2fc":round(float(l2[i]),2),"p1":round(float(pi[i]),3),"p2":round(float(po[i]),3)} for i in order]
        json.dump({"id":c,"nCells":int(n_k[k]),"datasetCells":int(N),"nGenes":len(prof),"genes":prof}, open(os.path.join(PROFILE_DIR,f"{c}.json"),"w"), separators=(",",":"))
    gmax=pct_mat.max(0); gr={}
    for j in range(G):
        if gmax[j]<0.01: continue
        key=str(genes[j]).lower()
        if key in gr: continue
        gr[key]={"m":[round(float(v),1) for v in mean_mat[:,j]],"p":[round(float(v),3) for v in pct_mat[:,j]]}
    json.dump({"clusters":clusters,"clusterSizes":[int(n_k[cidx[c]]) for c in clusters],"datasetCells":int(N),"nGenes":len(gr),"genes":gr},
              open(os.path.join(PROFILE_DIR,"gene_matrix.json"),"w"), separators=(",",":"))
    os.makedirs(os.path.dirname(SRV_OUT), exist_ok=True)
    json.dump({"datasetCells":int(N),"assignedCells":int(N),"clusters":{c:{"nCells":int(n_k[cidx[c]]),"up":up_by[c][:40],"down":down_by[c]} for c in clusters}},
              open(SRV_OUT,"w"), separators=(",",":"))
    log("wrote v2 asset (umap + archivist + gene_matrix + server archivist)")

    out["leaf"]=cl_raw; out.to_csv(f"{SCRATCH}/megafin_rebuild_v2_leiden_labels.csv", index=False)
    ll_ids = adata.var["ll_id"].astype(str).values
    pd.DataFrame({"gene_id":list(ll_ids),"symbol":[str(g) for g in genes]}).to_csv(f"{SCRATCH}/megafin_rebuild_v2_canonical_map.csv", index=False)
    ad.AnnData(X=raw, obs=pd.DataFrame({"leaf":list(cl_raw)}, index=list(adata.obs_names)),
               var=pd.DataFrame(index=list(ll_ids))).write_h5ad(f"{SCRATCH}/megafin_rebuild_v2_clustered_subset.h5ad")
    log("wrote v2 :5007 sidecars")

    # ---- OPTIONAL scVI ARI cross-check (idle GPU; raw GeneFull counts via source) ----
    scvi_info = {"ran": False}
    try:
        write_status("RUNNING", step="scvi")
        import scvi
        sa = ad.AnnData(X=raw.copy(), obs=adata.obs[[BATCH]].copy(), var=pd.DataFrame(index=list(ll_ids)))
        sc.pp.highly_variable_genes(sa, n_top_genes=N_HVG, flavor="seurat_v3", batch_key=BATCH, subset=True, span=0.5)
        scvi.model.SCVI.setup_anndata(sa, batch_key=BATCH)
        model = scvi.model.SCVI(sa, n_latent=30); model.train(max_epochs=60, early_stopping=True, accelerator="gpu")
        sa.obsm["X_scVI"] = model.get_latent_representation()
        sc.pp.neighbors(sa, use_rep="X_scVI", n_neighbors=NN, random_state=SEED)
        sc.tl.leiden(sa, resolution=CHOSEN, key_added="scvi_leiden", flavor="igraph", n_iterations=2, directed=False, random_state=SEED)
        from sklearn.metrics import adjusted_rand_score
        ari = float(adjusted_rand_score(cl_raw, sa.obs["scvi_leiden"].astype(str).values))
        pd.DataFrame({"cell_id":list(adata.obs_names),"scvi_leiden":sa.obs["scvi_leiden"].astype(str).values}).to_csv(f"{SCRATCH}/megafin_rebuild_v2_scvi_labels.csv", index=False)
        scvi_info = {"ran": True, "n_scvi_clusters": int(sa.obs["scvi_leiden"].nunique()), "ari_vs_harmony": round(ari,3)}
        log(f"scVI ARI vs harmony partition = {ari:.3f}")
    except Exception as e:
        scvi_info = {"ran": False, "error": str(e)[:300]}; log("scVI skipped/failed:", str(e)[:200])

    v1_sweep = pd.read_csv(V1_SWEEP).to_dict("records") if os.path.exists(V1_SWEEP) else None
    write_status("DONE", version=2, selection_method=method, chosen_resolution=CHOSEN, n_clusters=len(clusters),
                 cells=int(N), cells_pre_doublet=int(n_pre), genes=int(G),
                 canonical_genes=n_canon, canonical_frac=round(n_canon/len(genes),3),
                 marker_token_divergence=len(marker_div), marker_div_examples=marker_div[:25],
                 relaxation=relax, v2_sweep=rows, v1_sweep_reused_embedding=v1_sweep, scvi=scvi_info,
                 cluster_sizes=sorted([int(x) for x in n_k]),
                 staged_paths={"asset_dir":OUT_DIR,"server_archivist":SRV_OUT,
                               "h5ad":f"{SCRATCH}/megafin_rebuild_v2_clustered_subset.h5ad",
                               "labels":f"{SCRATCH}/megafin_rebuild_v2_leiden_labels.csv (col 'leaf')",
                               "symbol_map":f"{SCRATCH}/megafin_rebuild_v2_canonical_map.csv (cols gene_id,symbol)"},
                 note="STAGED v2 only — v1 + live megafin/ + :5007 registry untouched. Morning go-live: megafin_rebuild_v2 :5007 drop-in (H5AD=..._v2_clustered_subset.h5ad, ASSIGN=..._v2_leiden_labels.csv col leaf, SYMBOL_MAP=..._v2_canonical_map.csv cols gene_id,symbol) + swap wizard asset to megafin_rebuild_v2/, then verify live stats.")
    log("DONE v2 clusters=%d res=%s" % (len(clusters), CHOSEN))
except Exception as e:
    write_status("FAILED", error=str(e), traceback=traceback.format_exc()[-2000:])
    log("FAILED:", e); print(traceback.format_exc(), flush=True); raise
