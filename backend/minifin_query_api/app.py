"""MiniFin query microservice.

Loads the MiniFin h5ad once and answers the heavy queries the precomputed static
matrices can't: one-vs-rest adjusted p-values (computed on demand, BH-corrected
across the transcriptome) and cell-level co-expression. The daniotype_kasperov
Archivist tool calls POST /query when MINIFIN_SERVICE_URL is configured.

Run:  uvicorn app:app --host 127.0.0.1 --port 5007
Auth: every /query request must carry  x-api-token: $MINIFIN_API_TOKEN
"""
import csv
import os
from typing import List, Union
import numpy as np
import scipy.sparse as sp
from scipy import stats
import anndata as ad
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

H5AD = os.environ.get("MINIFIN_H5AD", "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad")
ASSIGN = os.environ.get("MINIFIN_ASSIGN", "/data/datasets/raw_datasets/MiniFin/all-sample/report/cluster_assignment.csv")
TOKEN = os.environ.get("MINIFIN_API_TOKEN", "")

app = FastAPI(title="minifin-query")
S: dict = {}
_test_cache: dict = {}


def _bh(p: np.ndarray) -> np.ndarray:
    n = len(p)
    order = np.argsort(p)
    adj = p[order] * n / np.arange(1, n + 1)
    adj = np.minimum.accumulate(adj[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.clip(adj, 0, 1)
    return out


@app.on_event("startup")
def _load() -> None:
    a = ad.read_h5ad(H5AD)
    X = a.X.tocsr() if sp.issparse(a.X) else sp.csr_matrix(a.X)
    X = X.astype(np.float32)
    N = X.shape[0]
    genes = np.array([str(g).lower() for g in a.var_names])
    gidx = {g: i for i, g in enumerate(genes)}
    bc = {b: i for i, b in enumerate(a.obs_names)}

    cell_cluster = np.full(N, -1, np.int32)
    with open(ASSIGN, newline="") as f:
        for row in csv.DictReader(f):
            i = bc.get(row["bc_wells"])
            if i is not None:
                try:
                    cell_cluster[i] = int(row["cluster"])
                except ValueError:
                    pass

    tot = np.asarray(X.sum(1)).ravel()
    tot[tot == 0] = 1
    norm = (sp.diags((1e4 / tot).astype(np.float32)) @ X).tocsr()  # CP10K
    xlog = norm.copy()
    xlog.data = np.log1p(xlog.data)
    xlog2 = xlog.copy()
    xlog2.data = xlog2.data ** 2
    B = (X > 0).astype(np.float32).tocsc()  # detection, column-sliceable

    ones = np.ones(N, np.float32)
    S.update(
        dict(
            norm=norm, xlog=xlog, xlog2=xlog2, B=B,
            genes=genes, gidx=gidx, cell_cluster=cell_cluster, N=N,
            clusters=sorted(set(cell_cluster[cell_cluster >= 0].tolist())),
            tot_log=xlog.T.dot(ones), tot_log2=xlog2.T.dot(ones),
            tot_norm=norm.T.dot(ones), tot_b=np.asarray(B.sum(0)).ravel(),
        )
    )
    print(f"[minifin] loaded {N} cells × {len(genes)} genes, {len(S['clusters'])} clusters", flush=True)


def _cluster_test(k: int):
    if k in _test_cache:
        return _test_cache[k]
    ind = (S["cell_cluster"] == k).astype(np.float32)
    n_in = float(ind.sum())
    n_out = float(S["N"] - n_in)
    if n_in < 2 or n_out < 2:
        raise HTTPException(400, f"cluster {k} too small or not found")
    s_in = S["xlog"].T.dot(ind)
    sq_in = S["xlog2"].T.dot(ind)
    mean_in = s_in / n_in
    mean_out = (S["tot_log"] - s_in) / n_out
    var_in = np.maximum(sq_in / n_in - mean_in ** 2, 1e-8)
    var_out = np.maximum((S["tot_log2"] - sq_in) / n_out - mean_out ** 2, 1e-8)
    se = np.sqrt(var_in / n_in + var_out / n_out)
    t = (mean_in - mean_out) / se
    df = (var_in / n_in + var_out / n_out) ** 2 / (
        (var_in / n_in) ** 2 / (n_in - 1) + (var_out / n_out) ** 2 / (n_out - 1)
    )
    p = 2 * stats.t.sf(np.abs(t), np.maximum(df, 1))
    padj = _bh(np.nan_to_num(p, nan=1.0))
    nsum_in = S["norm"].T.dot(ind)
    nmean_in = nsum_in / n_in
    nmean_out = (S["tot_norm"] - nsum_in) / n_out
    l2fc = np.log2((nmean_in + 1) / (nmean_out + 1))
    bsum_in = S["B"].T.dot(ind)
    pct_in = bsum_in / n_in
    pct_out = (S["tot_b"] - bsum_in) / n_out
    res = dict(l2fc=l2fc, padj=padj, p=p, pct_in=pct_in, pct_out=pct_out, n_in=int(n_in))
    _test_cache[k] = res
    return res


class Q(BaseModel):
    kind: str
    cluster: Union[str, int]
    genes: List[str] = []


@app.get("/health")
def health():
    return {"ok": True, "loaded": bool(S), "cells": S.get("N"), "clusters": len(S.get("clusters", []))}


@app.post("/query")
def query(q: Q, x_api_token: str = Header(default="")):
    if TOKEN and x_api_token != TOKEN:
        raise HTTPException(401, "bad token")
    if not S:
        raise HTTPException(503, "still loading")
    try:
        k = int(q.cluster)
    except (ValueError, TypeError):
        raise HTTPException(400, "bad cluster")
    gidx = S["gidx"]
    glist = (q.genes or [])[:60]

    if q.kind == "pvalues":
        r = _cluster_test(k)
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
        return {"kind": "pvalues", "cluster": str(k), "nCells": r["n_in"], "result": out,
                "note": "one-vs-rest Welch t-test on log-normalised expression, Benjamini-Hochberg adjusted across the transcriptome"}

    if q.kind == "coexpress":
        cells = np.where(S["cell_cluster"] == k)[0]
        n = len(cells)
        if n == 0:
            raise HTTPException(400, f"cluster {k} not found")
        cols, per = [], []
        all_mask = np.ones(n, bool)
        for g in glist:
            j = gidx.get(g.lower())
            if j is None:
                per.append({"g": g, "found": False})
                continue
            expr = np.asarray(S["B"][:, j].toarray()).ravel()[cells] > 0
            per.append({"g": g, "found": True, "pct_in_cluster": round(float(expr.mean()), 3)})
            cols.append(expr)
            all_mask &= expr
        co = float(all_mask.mean()) if cols else 0.0
        return {"kind": "coexpress", "cluster": str(k), "nCells": n, "perGene": per,
                "coexpressingAll": {"fraction": round(co, 3), "nCells": int(all_mask.sum()) if cols else 0,
                                    "genes": [p["g"] for p in per if p.get("found")]},
                "note": "cell-level: fraction of this cluster's cells with detected expression of ALL listed genes simultaneously"}

    raise HTTPException(400, f"unknown kind {q.kind}")
