#!/usr/bin/env python3
"""Build the embedding plate for /fate_map_24_48 — ZSCAPE controls, 24 to 48 hpf.

WHAT THIS IS NOT. The scrubber does not follow cells. No cell in this plate was
tracked; ZSCAPE is a collection of separate embryos fixed at separate hours, and
a population that appears to move between timepoints is a population whose
expression changed, not one that travelled. Everything downstream of here — the
trail, the arrows, the response axis — is movement in transcriptomic space.

The embedding is the AUTHORS' OWN 3D UMAP (`umap3d_1..3`), reduced to two
dimensions by a fixed principal projection computed once over the control cells
and then applied to everything. No new embedding is invented, and the projection
is deterministic, so a rebuild puts every cell back where it was.

Outputs
    cells.bin        one row per control cell in the window
    states.json      ZSCAPE cell_type_sub, with its Platt crosswalk and tissue
    embed_meta.json  stages, tissues, bounds, counts

Run:  python3 scripts/build_fate_map_24_48_embed.py
"""

from __future__ import annotations

import collections
import json
import pathlib
import struct
import sys

import h5py
import numpy as np
import pandas as pd

ZS = "/data/datasets/zebrafish/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad"
TABLES = pathlib.Path("/data/fate_map")
WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"
STAGES = list(range(24, 49, 2))
XY_SCALE = 900.0        # int16 quantisation; UMAP coords are order 10


def col(o: h5py.Group, k: str, numeric: bool = False):
    """Read an obs column, resolving the categorical-string encoding.

    Every numeric column in this object is stored as a string categorical
    (the file came out of R), so anything numeric has to be parsed rather
    than read.

    Args:
        o (h5py.Group): the obs group.
        k (str): column name.
        numeric (bool, optional): parse the categories as floats.

    Returns:
        np.ndarray: values, one per cell.
    """
    n = o[k]
    if isinstance(n, h5py.Group):
        cats = [x.decode() if isinstance(x, bytes) else str(x) for x in n["categories"][:]]
        if numeric:
            return np.asarray([float(c) for c in cats], dtype=np.float64)[n["codes"][:]]
        return np.asarray(cats, dtype=object)[n["codes"][:]]
    d = n[:]
    if d.dtype.kind in "SO":
        v = np.asarray([x.decode() if isinstance(x, bytes) else str(x) for x in d], dtype=object)
        return v.astype(np.float64) if numeric else v
    return d


def main() -> None:
    """Read ZSCAPE, project, and write the plate's three files.

    Raises:
        SystemExit: If the ZSCAPE object or the crosswalk is missing.
    """
    if not pathlib.Path(ZS).exists():
        sys.exit(f"missing {ZS}")
    xw_path = TABLES / "crosswalk_platt_zscape.tsv"
    if not xw_path.exists():
        sys.exit(f"missing {xw_path} — run build_fate_map_24_48_enrich.py first")

    f = h5py.File(ZS, "r")
    o = f["obs"]
    tp = col(o, "timepoint", numeric=True)
    tgt = col(o, "gene_target")
    keep = np.isin(tp, STAGES) & np.char.startswith(tgt.astype(str), "ctrl-")
    print(f"  control cells at even hpf 24-48: {int(keep.sum()):,}")

    u = np.column_stack([col(o, f"umap3d_{i}", numeric=True)[keep] for i in (1, 2, 3)])
    sub = col(o, "cell_type_sub")[keep]
    tis = col(o, "tissue")[keep]
    stage = tp[keep].astype(np.int16)
    f.close()

    # A fixed principal projection of the 3D UMAP. Computed once, here, over
    # these cells; the eigenvectors are written into the meta so the projection
    # is reproducible and auditable rather than a magic rotation.
    mu = u.mean(0)
    cov = np.cov((u - mu).T)
    w, V = np.linalg.eigh(cov)
    order = np.argsort(-w)
    basis = V[:, order[:2]]
    xy = (u - mu) @ basis
    var_kept = float(w[order[:2]].sum() / w.sum())
    print(f"  principal projection keeps {var_kept:.1%} of the 3D UMAP's variance")

    states = sorted(set(sub.tolist()))
    tissues = sorted(set(tis.tolist()))
    s_ix = {s: i for i, s in enumerate(states)}
    t_ix = {t: i for i, t in enumerate(tissues)}
    st_ix = {s: i for i, s in enumerate(STAGES)}

    c = np.asarray([s_ix[x] for x in sub], dtype=np.uint16)
    s = np.asarray([t_ix[x] for x in tis], dtype=np.uint8)
    t = np.asarray([st_ix[int(x)] for x in stage], dtype=np.uint8)

    x16 = np.clip(np.round(xy[:, 0] * XY_SCALE), -32000, 32000).astype(np.int16)
    y16 = np.clip(np.round(xy[:, 1] * XY_SCALE), -32000, 32000).astype(np.int16)

    n = len(x16)
    WEB.mkdir(parents=True, exist_ok=True)
    with open(WEB / "cells.bin", "wb") as fh:
        fh.write(b"ZCEL")
        fh.write(struct.pack("<III", 1, n, len(STAGES)))   # 16-byte header
        fh.write(x16.tobytes()); fh.write(y16.tobytes())   # widest first
        fh.write(c.tobytes())
        fh.write(t.tobytes()); fh.write(s.tobytes())
    print(f"  cells.bin: {n:,} cells, {(WEB/'cells.bin').stat().st_size/2**20:.1f} MiB")

    # per-state centroid at each stage — the trail, precomputed so the browser
    # never has to average 845k cells to draw a line
    cen = {}
    for si, sname in enumerate(states):
        m = c == si
        rows = []
        for ti, hpf in enumerate(STAGES):
            mm = m & (t == ti)
            k = int(mm.sum())
            rows.append(None if k < 15 else
                        [round(float(xy[mm, 0].mean()), 4),
                         round(float(xy[mm, 1].mean()), 4), k])
        cen[sname] = rows

    xw = pd.read_csv(xw_path, sep="\t")
    top_platt = (xw.sort_values("n_cells", ascending=False)
                   .drop_duplicates("zscape_state")
                   .set_index("zscape_state"))

    st_json = []
    for si, sname in enumerate(states):
        m = c == si
        tt = collections.Counter(tis[m].tolist()).most_common(1)
        row = top_platt.loc[sname] if sname in top_platt.index else None
        st_json.append({
            "i": si, "name": sname, "tissue": tt[0][0] if tt else None,
            "n": int(m.sum()),
            "trail": cen[sname],
            "platt_top": None if row is None else row.platt_state,
            "platt_frac_of_zscape": None if row is None else float(row.frac_of_zscape_state),
        })

    (WEB / "states.json").write_text(json.dumps(st_json, separators=(",", ":")))

    meta = {
        "stages": STAGES,
        "tissues": tissues,
        "n_cells": n,
        "n_states": len(states),
        "bounds": {"x0": float(x16.min()) / XY_SCALE, "x1": float(x16.max()) / XY_SCALE,
                   "y0": float(y16.min()) / XY_SCALE, "y1": float(y16.max()) / XY_SCALE},
        "xy_scale": XY_SCALE,
        "projection": {
            "of": "ZSCAPE obs umap3d_1..3, the authors' own 3D UMAP",
            "method": "fixed principal projection to 2D, computed once over these cells",
            "variance_kept": round(var_kept, 4),
            "mean": [round(float(v), 5) for v in mu],
            "basis": [[round(float(v), 6) for v in row] for row in basis],
        },
        "cells_per_stage": {int(h): int((t == i).sum()) for i, h in enumerate(STAGES)},
        "selection": "gene_target starts with ctrl- (6 control arms), even hpf 24-48",
    }
    (WEB / "embed_meta.json").write_text(json.dumps(meta, indent=1))
    print(f"  states.json: {len(st_json)} states · embed_meta.json written")
    print(f"  cells per stage: {meta['cells_per_stage']}")


if __name__ == "__main__":
    main()
