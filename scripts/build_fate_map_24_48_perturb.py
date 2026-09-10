#!/usr/bin/env python3
"""Control-versus-perturbation centroid displacement, in the same embedding.

Reuses the projection written by build_fate_map_24_48_embed.py verbatim — the
mean and the two basis vectors are read from embed_meta.json rather than
recomputed, so perturbed cells land in exactly the coordinate system the control
cells were drawn in. Recomputing it over a different cell set would silently
shift every arrow.

WHAT AN ARROW IS. Tail at the control centroid of a state at one hour, head at
the same state's centroid in a perturbed embryo at the same hour. It is a
difference between two populations of different cells, in a UMAP. It is NOT a
trajectory, NOT a velocity, and its length is not a distance in any unit — UMAP
distance has no scale. Short arrows are not "small effects"; they are small
displacements in a projection.

Only (state, hour, target) cells with at least MIN_CELLS on BOTH arms are kept.
An arrow drawn from six cells would be noise given a name.

Run:  python3 scripts/build_fate_map_24_48_perturb.py
"""

from __future__ import annotations

import collections
import json
import pathlib
import sys

import h5py
import numpy as np

ZS = "/data/datasets/zebrafish/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad"
WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"
TABLES = pathlib.Path("/data/fate_map")
MIN_CELLS = 25


def codes_and_cats(o, k):
    """Return an obs column as integer codes plus its category list.

    Nothing here ever expands a categorical into 3.2 million Python strings.
    The version that did was OOM-killed with an empty log after half an hour;
    every grouping below works on the integer codes instead.

    Args:
        o: the obs group.
        k (str): column name.

    Returns:
        tuple[np.ndarray, list[str]]: codes, categories.
    """
    n = o[k]
    if not isinstance(n, h5py.Group):
        raise TypeError(f"{k} is not categorical")
    raw = n["categories"][:]
    cats = [x.decode() if isinstance(x, bytes) else str(x) for x in raw]
    return n["codes"][:], cats


def numeric_col(o, k):
    """Return a numeric obs column stored as a string categorical.

    Args:
        o: the obs group.
        k (str): column name.

    Returns:
        np.ndarray: float values, one per cell.
    """
    c, cats = codes_and_cats(o, k)
    return np.asarray(cats, dtype=np.float64)[c]


def main() -> None:
    """Compute the arrows and write perturb.json.

    Raises:
        SystemExit: If the embedding meta is missing.
    """
    mp = WEB / "embed_meta.json"
    if not mp.exists():
        sys.exit(f"missing {mp} — run build_fate_map_24_48_embed.py first")
    meta = json.loads(mp.read_text())
    STAGES = meta["stages"]
    mu = np.asarray(meta["projection"]["mean"])
    basis = np.asarray(meta["projection"]["basis"])

    f = h5py.File(ZS, "r")
    o = f["obs"]
    tp = numeric_col(o, "timepoint")
    keep = np.isin(tp, STAGES)
    t_ix = {h: i for i, h in enumerate(STAGES)}
    ti = np.asarray([t_ix[int(v)] for v in tp[keep]], dtype=np.int32)

    g_codes, g_cats = codes_and_cats(o, "gene_target")
    s_codes, s_cats = codes_and_cats(o, "cell_type_sub")
    g_codes = g_codes[keep].astype(np.int32)
    s_codes = s_codes[keep].astype(np.int32)
    u = np.column_stack([numeric_col(o, f"umap3d_{i}")[keep] for i in (1, 2, 3)])
    f.close()
    xy = (u - mu) @ basis
    del u
    print(f"  cells in window: {len(xy):,}", flush=True)

    is_ctrl = np.asarray([c.startswith("ctrl-") for c in g_cats], dtype=bool)[g_codes]
    targets = [c for i, c in enumerate(g_cats) if not c.startswith("ctrl-")]
    nS, nT, nG = len(s_cats), len(STAGES), len(g_cats)
    print(f"  perturbation targets: {len(targets)}", flush=True)

    def group_means(mask, key, nkey):
        """Mean x, mean y and count per integer key, over a boolean mask."""
        k = key[mask]
        cnt = np.bincount(k, minlength=nkey)
        sx = np.bincount(k, weights=xy[mask, 0], minlength=nkey)
        sy = np.bincount(k, weights=xy[mask, 1], minlength=nkey)
        with np.errstate(invalid="ignore"):
            return sx / cnt, sy / cnt, cnt

    ck = s_codes * nT + ti                       # (state, hour)
    cx, cy, cn = group_means(is_ctrl, ck, nS * nT)

    pk = (s_codes * nT + ti) * nG + g_codes      # (state, hour, target)
    pxm, pym, pn = group_means(~is_ctrl, pk, nS * nT * nG)

    ok = np.nonzero((pn >= MIN_CELLS))[0]
    arrows = []
    for idx in ok:
        gi = idx % nG
        rest = idx // nG
        hi = rest % nT
        si = rest // nT
        if g_cats[gi].startswith("ctrl-"):
            continue
        c_idx = si * nT + hi
        if cn[c_idx] < MIN_CELLS:
            continue
        arrows.append({
            "target": g_cats[gi], "state": s_cats[si], "hpf": STAGES[hi],
            "x0": round(float(cx[c_idx]), 4), "y0": round(float(cy[c_idx]), 4),
            "x1": round(float(pxm[idx]), 4), "y1": round(float(pym[idx]), 4),
            "n_ctrl": int(cn[c_idx]), "n_pert": int(pn[idx]),
            "d": round(float(np.hypot(pxm[idx] - cx[c_idx], pym[idx] - cy[c_idx])), 4),
        })

    # a per-target summary: how far, on average, and over how many matched states
    summ = []
    for tg in targets:
        a = [x for x in arrows if x["target"] == tg]
        if not a:
            continue
        d = np.array([x["d"] for x in a])
        summ.append({"target": tg, "n_arrows": len(a),
                     "median_d": round(float(np.median(d)), 4),
                     "max_d": round(float(d.max()), 4),
                     "states": len({x["state"] for x in a})})
    summ.sort(key=lambda r: -r["median_d"])

    doc = {"min_cells": MIN_CELLS, "stages": STAGES,
           "targets": targets, "summary": summ, "arrows": arrows,
           "caveat": "An arrow is the difference between two populations of DIFFERENT cells "
                     "in a UMAP. Not a trajectory, not a velocity; its length has no unit."}
    (WEB / "perturb.json").write_text(json.dumps(doc, separators=(",", ":")))
    TABLES.mkdir(parents=True, exist_ok=True)
    import pandas as pd
    pd.DataFrame(arrows).to_parquet(TABLES / "zscape_perturb_displacement.parquet", index=False)
    pd.DataFrame(arrows).to_csv(TABLES / "zscape_perturb_displacement.tsv", sep="\t", index=False)

    print(f"  arrows: {len(arrows):,} over {len({a['state'] for a in arrows})} states")
    print(f"  largest median displacement: " +
          ", ".join(f"{r['target']} {r['median_d']}" for r in summ[:5]))
    print(f"  wrote {WEB/'perturb.json'} ({(WEB/'perturb.json').stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
