#!/usr/bin/env python3
"""Per-state pseudobulk for ZMAP, over the same gene panel as the Platt side.

ZMAP's X is CSR (cells as rows), float64, already log-normalised — its own
`raw_nolog` layer is left untouched. Because both sides are compared with
Spearman, an exact normalisation match is not required, only monotonicity.

Also collects each ZMAP state's `time_id` distribution, which IS hours
post-fertilisation (verified against stage_id and DanioCell's own hours), so a
Platt state matched here inherits a predicted developmental age.
"""
import numpy as np, pandas as pd, h5py, json, pathlib, collections

OUT = pathlib.Path('/data/scratch/platt_open')
Z = '/data/datasets/zebrafish/ZMAP/sources/data/ZMAP_251209_processed.h5ad'
LEVELS = ['ZMAP_CellTypeFine', 'ZMAP_CellType', 'ZMAP_Tissue', 'ZMAP_GermLayer']

panel = [c for c in pd.read_parquet(OUT / 'platt_state_pseudobulk.parquet').columns if c != 'n_cells']
panel_ix = {s: i for i, s in enumerate(panel)}

f = h5py.File(Z, 'r')
var = f['var']
vk = var.attrs.get('_index', '_index')
vk = vk.decode() if isinstance(vk, bytes) else vk
syms = [x.decode() if isinstance(x, bytes) else str(x) for x in var[vk][:]]
remap = np.full(len(syms), -1, dtype=np.int32)
for i, s in enumerate(syms):
    if s in panel_ix:
        remap[i] = panel_ix[s]
print(f"  panel genes found in ZMAP: {(remap >= 0).sum()} of {len(panel)}")

o = f['obs']
def cat(k):
    n = o[k]
    c = [x.decode() if isinstance(x, bytes) else str(x) for x in n['categories'][:]]
    return c, n['codes'][:]

labels = {k: cat(k) for k in LEVELS}
time_id = o['time_id'][:]
NCELL = len(time_id)

X = f['X']
indptr = X['indptr']
data, indices = X['data'], X['indices']
print(f"  {NCELL:,} cells, {data.shape[0]:,} non-zeros")

acc = {k: np.zeros((len(labels[k][0]), len(panel))) for k in LEVELS}
ncell = {k: np.zeros(len(labels[k][0]), dtype=np.int64) for k in LEVELS}

CH = 8000
ptr = indptr[:]
for lo in range(0, NCELL, CH):
    hi = min(NCELL, lo + CH)
    a, b = int(ptr[lo]), int(ptr[hi])
    if b <= a:
        continue
    gi_all = np.asarray(indices[a:b])
    v_all = np.asarray(data[a:b])
    counts = np.diff(ptr[lo:hi + 1]).astype(np.int64)
    rowof = np.repeat(np.arange(lo, hi), counts)
    keep = remap[gi_all] >= 0
    if keep.any():
        gi = remap[gi_all[keep]]
        ri = rowof[keep]
        vv = v_all[keep]
        for k in LEVELS:
            np.add.at(acc[k], (labels[k][1][ri], gi), vv)
    for k in LEVELS:
        ncell[k] += np.bincount(labels[k][1][lo:hi], minlength=len(labels[k][0]))
    if (lo // CH) % 20 == 0:
        print(f"    {hi:,}/{NCELL:,}", flush=True)

for k in LEVELS:
    m = acc[k] / np.maximum(ncell[k], 1)[:, None]
    df = pd.DataFrame(m, index=labels[k][0], columns=panel)
    df.insert(0, 'n_cells', ncell[k])
    df.to_parquet(OUT / f'zmap_pseudobulk_{k}.parquet')
    print(f"  wrote zmap_pseudobulk_{k}.parquet — {df.shape[0]} states")

# time_id distribution per ZMAP state, at every level
rows = []
for k in LEVELS:
    cats, codes = labels[k]
    for i, name in enumerate(cats):
        t = time_id[codes == i]
        if not len(t):
            continue
        rows.append(dict(level=k, zmap_state=name, n_cells=int(len(t)),
                         hpf_mean=round(float(t.mean()), 2),
                         hpf_q10=float(np.quantile(t, .10)), hpf_q25=float(np.quantile(t, .25)),
                         hpf_q50=float(np.quantile(t, .50)), hpf_q75=float(np.quantile(t, .75)),
                         hpf_q90=float(np.quantile(t, .90)),
                         frac_in_window=round(float(((t >= 24) & (t <= 48)).mean()), 4)))
pd.DataFrame(rows).to_parquet(OUT / 'zmap_state_time.parquet')
print(f"  wrote zmap_state_time.parquet — {len(rows)} state-level rows")
f.close()
