"""DanioType query microservice (multi-dataset).

Loads each dataset's h5ad + per-cell cluster labels resident (lazily, on first
query) and answers the heavy queries the precomputed static matrices can't:
one-vs-rest BH-adjusted p-values, and cell-level co-expression (fraction of a
cluster's cells co-expressing ALL listed genes, plus the pairwise matrix — the
signal that disambiguates a genuine matrix-secreting epithelial type from an
epidermis+mesenchyme doublet/mixture). On-demand sparse subsetting, CPU only,
no all-pairs precompute. The daniotype_kasperov Archivist (query_dataset tool)
POSTs /query with a `dataset` field when MINIFIN_SERVICE_URL is configured.

Bind 127.0.0.1; reached only via nginx /minifin/ -> :5007 (private). Auth: every
/query carries  x-api-token: $MINIFIN_API_TOKEN.

Datasets are env-configured so the object path is swappable (Parse object tonight,
denoised rebuild tomorrow) WITHOUT matching the wizard partition by hand — point
MEGAFIN_ASSIGN at the same Leiden labels build_megafin_asset.py --resolution uses.
"""
import csv
import os
import threading
from collections import defaultdict
from typing import List, Union
import numpy as np
import scipy.sparse as sp
from scipy import stats
import anndata as ad
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

TOKEN = os.environ.get("MINIFIN_API_TOKEN", "")


# --- dataset registry (env-driven; add datasets without code changes) ----------
def _registry() -> dict:
    reg = {
        "minifin": dict(
            h5ad=os.environ.get("MINIFIN_H5AD", "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad"),
            assign=os.environ.get("MINIFIN_ASSIGN", "/data/datasets/raw_datasets/MiniFin/all-sample/report/cluster_assignment.csv"),
            bc_col=os.environ.get("MINIFIN_BC_COL", "bc_wells"),
            cluster_col=os.environ.get("MINIFIN_CLUSTER_COL", "cluster"),
            symbol_map=os.environ.get("MINIFIN_SYMBOL_MAP", ""),  # var_names already symbols
        ),
    }
    if os.environ.get("MEGAFIN_H5AD"):
        reg["megafin"] = dict(
            h5ad=os.environ["MEGAFIN_H5AD"],
            assign=os.environ.get("MEGAFIN_ASSIGN", ""),
            bc_col=os.environ.get("MEGAFIN_BC_COL", "cell_id"),
            cluster_col=os.environ.get("MEGAFIN_CLUSTER_COL", "leiden_3.0"),
            # Parse object var_names are ENSDARG -> map to the same symbols the wizard shows
            symbol_map=os.environ.get("MEGAFIN_SYMBOL_MAP", ""),
            map_id_col=os.environ.get("MEGAFIN_MAP_ID_COL", "ensembl_id"),
            map_sym_col=os.environ.get("MEGAFIN_MAP_SYM_COL", "symbol"),
        )
    if os.environ.get("MEGAFIN_PARSE_H5AD"):
        # Parse/Trailmaker interim MegaFin (id "megafin_parse"); var_names ENSDARG.
        reg["megafin_parse"] = dict(
            h5ad=os.environ["MEGAFIN_PARSE_H5AD"],
            assign=os.environ.get("MEGAFIN_PARSE_ASSIGN", ""),
            bc_col=os.environ.get("MEGAFIN_PARSE_BC_COL", "cell_id"),
            cluster_col=os.environ.get("MEGAFIN_PARSE_CLUSTER_COL", "leiden_3.0"),
            symbol_map=os.environ.get("MEGAFIN_PARSE_SYMBOL_MAP", ""),
            map_id_col=os.environ.get("MEGAFIN_PARSE_MAP_ID_COL", "ensembl_id"),
            map_sym_col=os.environ.get("MEGAFIN_PARSE_MAP_SYM_COL", "symbol"),
        )
    if os.environ.get("ZSCAPE_H5AD"):
        # ZSCAPE = the de-novo leaf partition (clustered-subset h5ad + persisted cell_id->leaf
        # from build_zscape_asset.py). var_names are ENSDARG -> gene_short_name map.
        reg["zscape"] = dict(
            h5ad=os.environ["ZSCAPE_H5AD"],
            assign=os.environ.get("ZSCAPE_ASSIGN", ""),
            bc_col=os.environ.get("ZSCAPE_BC_COL", "cell_id"),
            cluster_col=os.environ.get("ZSCAPE_CLUSTER_COL", "leaf"),
            symbol_map=os.environ.get("ZSCAPE_SYMBOL_MAP", ""),
            map_id_col=os.environ.get("ZSCAPE_MAP_ID_COL", "ensembl_id"),
            map_sym_col=os.environ.get("ZSCAPE_MAP_SYM_COL", "symbol"),
        )
    if os.environ.get("CHEMFISH_H5AD"):
        # ChemFish = de-novo leaf partition (48hpf clustered subset) from build_chemfish_asset.py.
        # var_names ENSDARG; canonical map keyed by var_name (ensembl_id col holds var_name).
        reg["chemfish"] = dict(
            h5ad=os.environ["CHEMFISH_H5AD"],
            assign=os.environ.get("CHEMFISH_ASSIGN", ""),
            bc_col=os.environ.get("CHEMFISH_BC_COL", "cell_id"),
            cluster_col=os.environ.get("CHEMFISH_CLUSTER_COL", "leaf"),
            symbol_map=os.environ.get("CHEMFISH_SYMBOL_MAP", ""),
            map_id_col=os.environ.get("CHEMFISH_MAP_ID_COL", "ensembl_id"),
            map_sym_col=os.environ.get("CHEMFISH_MAP_SYM_COL", "symbol"),
        )
    if os.environ.get("DANIOCELL_H5AD"):
        # DanioCell = de-novo leaf partition (36-72hpf clustered subset) from build_daniocell_asset.py.
        # var_names ENSDARG (canonical copy); canonical map keyed by var_name.
        reg["daniocell"] = dict(
            h5ad=os.environ["DANIOCELL_H5AD"],
            assign=os.environ.get("DANIOCELL_ASSIGN", ""),
            bc_col=os.environ.get("DANIOCELL_BC_COL", "cell_id"),
            cluster_col=os.environ.get("DANIOCELL_CLUSTER_COL", "leaf"),
            symbol_map=os.environ.get("DANIOCELL_SYMBOL_MAP", ""),
            map_id_col=os.environ.get("DANIOCELL_MAP_ID_COL", "ensembl_id"),
            map_sym_col=os.environ.get("DANIOCELL_MAP_SYM_COL", "symbol"),
        )
    # NATIVE-schema re-base datasets (staged): units = authors' finest native groups.
    # var_names ENSDARG; canonical map keyed by var_name; assignment col = native_unit.
    for nid in ("zscape_native", "chemfish_native", "daniocell_native"):
        pre = nid.upper()
        if os.environ.get(f"{pre}_H5AD"):
            reg[nid] = dict(
                h5ad=os.environ[f"{pre}_H5AD"],
                assign=os.environ.get(f"{pre}_ASSIGN", ""),
                bc_col=os.environ.get(f"{pre}_BC_COL", "cell_id"),
                cluster_col=os.environ.get(f"{pre}_CLUSTER_COL", "native_unit"),
                symbol_map=os.environ.get(f"{pre}_SYMBOL_MAP", ""),
                map_id_col=os.environ.get(f"{pre}_MAP_ID_COL", "ensembl_id"),
                map_sym_col=os.environ.get(f"{pre}_MAP_SYM_COL", "symbol"),
            )
    return reg


REG = _registry()
app = FastAPI(title="daniotype-query")
S: dict = {}                       # dataset_id -> loaded state
_test_cache: dict = {}             # (dataset_id, cluster_int) -> per-gene test arrays
_locks: dict = defaultdict(threading.Lock)


def _bh(p: np.ndarray) -> np.ndarray:
    n = len(p)
    order = np.argsort(p)
    adj = p[order] * n / np.arange(1, n + 1)
    adj = np.minimum.accumulate(adj[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.clip(adj, 0, 1)
    return out


def _symbols(var_names, cfg) -> np.ndarray:
    smap = cfg.get("symbol_map") or ""
    if not smap or not os.path.exists(smap):
        return np.array([str(g).lower() for g in var_names])
    m = {}
    with open(smap, newline="") as f:
        for row in csv.DictReader(f):
            # case-fold the ENSDARG key: MiniFin var_names are lowercase ensdarg,
            # MegaFin's are uppercase ENSDARG, the map's ids are uppercase.
            m[str(row[cfg.get("map_id_col", "ensembl_id")]).upper()] = str(row[cfg.get("map_sym_col", "symbol")])
    return np.array([str(m.get(str(g).upper(), g)).lower() for g in var_names])


def _load(ds: str) -> dict:
    if ds in S:
        return S[ds]
    cfg = REG.get(ds)
    if not cfg:
        raise HTTPException(400, f"unknown dataset '{ds}'")
    with _locks[ds]:
        if ds in S:
            return S[ds]
        a = ad.read_h5ad(cfg["h5ad"])
        X = a.X.tocsr() if sp.issparse(a.X) else sp.csr_matrix(a.X)
        X = X.astype(np.float32)
        N = X.shape[0]
        genes = _symbols(a.var_names, cfg)
        gidx = {}
        for i, g in enumerate(genes):
            gidx.setdefault(g, i)  # first occurrence wins (matches the static asset build)
        bc = {str(b): i for i, b in enumerate(a.obs_names)}

        cell_cluster = np.full(N, -1, np.int32)
        with open(cfg["assign"], newline="") as f:
            for row in csv.DictReader(f):
                i = bc.get(str(row[cfg["bc_col"]]))
                if i is not None:
                    try:
                        cell_cluster[i] = int(float(row[cfg["cluster_col"]]))
                    except (ValueError, TypeError):
                        pass

        tot = np.asarray(X.sum(1)).ravel()
        tot[tot == 0] = 1
        norm = (sp.diags((1e4 / tot).astype(np.float32)) @ X).tocsr()  # CP10K
        xlog = norm.copy(); xlog.data = np.log1p(xlog.data)
        xlog2 = xlog.copy(); xlog2.data = xlog2.data ** 2
        B = (X > 0).astype(np.float32).tocsc()                         # detection, col-sliceable
        ones = np.ones(N, np.float32)
        S[ds] = dict(
            norm=norm, xlog=xlog, xlog2=xlog2, B=B,
            genes=genes, gidx=gidx, cell_cluster=cell_cluster, N=N,
            clusters=sorted(set(cell_cluster[cell_cluster >= 0].tolist())),
            tot_log=xlog.T.dot(ones), tot_log2=xlog2.T.dot(ones),
            tot_norm=norm.T.dot(ones), tot_b=np.asarray(B.sum(0)).ravel(),
        )
        print(f"[query] loaded {ds}: {N} cells x {len(genes)} genes, {len(S[ds]['clusters'])} clusters", flush=True)
    return S[ds]


def _cluster_test(ds: str, k: int):
    ck = (ds, k)
    if ck in _test_cache:
        return _test_cache[ck]
    st = _load(ds)
    ind = (st["cell_cluster"] == k).astype(np.float32)
    n_in = float(ind.sum())
    n_out = float(st["N"] - n_in)
    if n_in < 2 or n_out < 2:
        raise HTTPException(400, f"cluster {k} too small or not found in {ds}")
    s_in = st["xlog"].T.dot(ind)
    sq_in = st["xlog2"].T.dot(ind)
    mean_in = s_in / n_in
    mean_out = (st["tot_log"] - s_in) / n_out
    var_in = np.maximum(sq_in / n_in - mean_in ** 2, 1e-8)
    var_out = np.maximum((st["tot_log2"] - sq_in) / n_out - mean_out ** 2, 1e-8)
    se = np.sqrt(var_in / n_in + var_out / n_out)
    t = (mean_in - mean_out) / se
    df = (var_in / n_in + var_out / n_out) ** 2 / (
        (var_in / n_in) ** 2 / (n_in - 1) + (var_out / n_out) ** 2 / (n_out - 1)
    )
    p = 2 * stats.t.sf(np.abs(t), np.maximum(df, 1))
    padj = _bh(np.nan_to_num(p, nan=1.0))
    nsum_in = st["norm"].T.dot(ind)
    nmean_in = nsum_in / n_in
    nmean_out = (st["tot_norm"] - nsum_in) / n_out
    l2fc = np.log2((nmean_in + 1) / (nmean_out + 1))
    bsum_in = st["B"].T.dot(ind)
    pct_in = bsum_in / n_in
    pct_out = (st["tot_b"] - bsum_in) / n_out
    res = dict(l2fc=l2fc, padj=padj, p=p, pct_in=pct_in, pct_out=pct_out, n_in=int(n_in))
    _test_cache[ck] = res
    return res


class Q(BaseModel):
    kind: str
    cluster: Union[str, int]
    genes: List[str] = []
    dataset: str = "minifin"


@app.on_event("startup")
def _warm() -> None:
    # warm every configured dataset resident in the background so the first real
    # query doesn't pay the load cost (the Vercel caller has a ~35s timeout).
    def go():
        for ds in REG:
            try:
                _load(ds)
            except Exception as e:  # noqa: BLE001
                print(f"[query] warm-load {ds} failed: {e}", flush=True)
    threading.Thread(target=go, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True, "datasets": list(REG.keys()), "loaded": list(S.keys())}


@app.post("/query")
def query(q: Q, x_api_token: str = Header(default="")):
    if TOKEN and x_api_token != TOKEN:
        raise HTTPException(401, "bad token")
    ds = q.dataset or "minifin"
    if ds not in REG:
        raise HTTPException(400, f"unknown dataset '{ds}'")
    try:
        k = int(q.cluster)
    except (ValueError, TypeError):
        raise HTTPException(400, "bad cluster")
    st = _load(ds)
    gidx = st["gidx"]
    glist = (q.genes or [])[:60]

    if q.kind == "pvalues":
        r = _cluster_test(ds, k)
        out = []
        for g in glist:
            j = gidx.get(g.lower())
            if j is None:
                out.append({"g": g, "found": False})
            else:
                out.append({
                    "g": g, "found": True,
                    "log2FC": round(float(r["l2fc"][j]), 3),
                    "pct_in": round(float(r["pct_in"][j]), 3),
                    "pct_out": round(float(r["pct_out"][j]), 3),
                    "padj": float(f"{r['padj'][j]:.2e}"),
                })
        return {"kind": "pvalues", "dataset": ds, "cluster": str(k), "nCells": r["n_in"], "result": out,
                "note": "one-vs-rest Welch t-test on log-normalised expression, Benjamini-Hochberg adjusted across the transcriptome"}

    if q.kind == "coexpress":
        cells = np.where(st["cell_cluster"] == k)[0]
        n = len(cells)
        if n == 0:
            raise HTTPException(400, f"cluster {k} not found in {ds}")
        per, masks, found_genes = [], [], []
        all_mask = np.ones(n, bool)
        for g in glist:
            j = gidx.get(g.lower())
            if j is None:
                per.append({"g": g, "found": False})
                continue
            expr = np.asarray(st["B"][:, j].toarray()).ravel()[cells] > 0
            per.append({"g": g, "found": True, "pct_in_cluster": round(float(expr.mean()), 3)})
            masks.append(expr); found_genes.append(g)
            all_mask &= expr
        # pairwise co-detection: fraction of this cluster's cells expressing BOTH genes,
        # vs the product of marginals (expected if independent). enrichment>1 = same cells.
        pairwise = []
        for ai in range(len(found_genes)):
            for bi in range(ai + 1, len(found_genes)):
                both = float((masks[ai] & masks[bi]).mean())
                exp_indep = float(masks[ai].mean()) * float(masks[bi].mean())
                pairwise.append({
                    "a": found_genes[ai], "b": found_genes[bi],
                    "co_fraction": round(both, 3),
                    "expected_if_independent": round(exp_indep, 3),
                    "enrichment": round(both / exp_indep, 2) if exp_indep > 0 else None,
                })
        co = float(all_mask.mean()) if masks else 0.0
        return {"kind": "coexpress", "dataset": ds, "cluster": str(k), "nCells": n, "perGene": per,
                "coexpressingAll": {"fraction": round(co, 3), "nCells": int(all_mask.sum()) if masks else 0,
                                    "genes": found_genes},
                "pairwise": pairwise,
                "note": "cell-level: fraction of this cluster's cells co-detecting genes. pairwise.enrichment>1 = "
                        "co-expressed in the SAME cells (one population); ~<1 = mutually exclusive (mixed populations)"}

    raise HTTPException(400, f"unknown kind {q.kind}")
