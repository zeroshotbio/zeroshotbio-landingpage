#!/usr/bin/env python3
"""Per-state pseudobulk for the Platt reference, over ZMAP's HVG panel.

BPCells' `unpacked-double-matrix-v2` is a plain CSC triple on disk and needs no
BPCells to read: `shape` (uint32 rows, cols), `idxptr` (uint64 column offsets),
`index` (uint32 row ids) and `val` (float64), each with an 8-byte magic header.
storage_order says "col", so a column is a cell.

478,828,111 non-zeros. Streamed in column chunks so nothing beyond a chunk is
ever resident; the accumulator is 357 states x 2,279 genes and fits in 7 MB.

Writes platt_state_pseudobulk.parquet — mean log1p(CP10K) per state per gene.
"""
import numpy as np, pandas as pd, json, struct, pathlib

D = pathlib.Path('/data/scratch/platt_open/reference_cds/bpcells_matrix_dir')
OUT = pathlib.Path('/data/scratch/platt_open')

sh = open(D / 'shape', 'rb').read()
NR, NC = struct.unpack('<I', sh[8:12])[0], struct.unpack('<I', sh[12:16])[0]
assert open(D / 'storage_order', 'rb').read().strip() == b'col'

idxptr = np.memmap(D / 'idxptr', dtype='<u8', mode='r', offset=8)
index = np.memmap(D / 'index', dtype='<u4', mode='r', offset=8)
val = np.memmap(D / 'val', dtype='<f8', mode='r', offset=8)
print(f"  {NR} genes x {NC} cells, {len(val):,} non-zeros")

rows = [l.strip() for l in open(D / 'row_names')]
sym = dict(pd.read_csv('/data/scratch/v2_zscape/zscape_v2_symbol_map.csv').values)
zg = json.load(open(OUT / 'zmap_genes.json'))
hv_syms = [s for s, h in zip(zg['symbols'], zg['highly_variable']) if h]
hv_set = set(hv_syms)

# gene selection, and the row -> panel-column remap
panel = [s for s in hv_syms if s in {sym.get(g) for g in rows}]
panel_ix = {s: i for i, s in enumerate(panel)}
remap = np.full(NR, -1, dtype=np.int32)
for r, g in enumerate(rows):
    s = sym.get(g)
    if s in panel_ix:
        remap[r] = panel_ix[s]
print(f"  panel: {len(panel)} genes of ZMAP's {len(hv_syms)} HVGs")

cd = pd.read_parquet(OUT / 'platt_coldata.parquet', columns=['cell_type'])
states = pd.Categorical(cd.cell_type.fillna('(none)'))
codes = states.codes.astype(np.int32)
NS = len(states.categories)
print(f"  states: {NS}")

acc = np.zeros((NS, len(panel)), dtype=np.float64)   # sum of log1p(CP10K)
ncell = np.zeros(NS, dtype=np.int64)
CH = 20000
for lo in range(0, NC, CH):
    hi = min(NC, lo + CH)
    a, b = int(idxptr[lo]), int(idxptr[hi])
    if b > a:
        ridx = np.asarray(index[a:b])
        v = np.asarray(val[a:b])
        counts = np.diff(idxptr[lo:hi + 1]).astype(np.int64)
        colof = np.repeat(np.arange(lo, hi), counts)
        # per-cell total, over ALL genes, before any selection
        tot = np.bincount(colof - lo, weights=v, minlength=hi - lo)
        tot[tot == 0] = 1.0
        keep = remap[ridx] >= 0
        if keep.any():
            gi = remap[ridx[keep]]
            cj = colof[keep]
            x = np.log1p(v[keep] / tot[cj - lo] * 1e4)
            np.add.at(acc, (codes[cj], gi), x)
    ncell += np.bincount(codes[lo:hi], minlength=NS)
    if (lo // CH) % 15 == 0:
        print(f"    {hi:,}/{NC:,} cells", flush=True)

mean = acc / np.maximum(ncell, 1)[:, None]
df = pd.DataFrame(mean, index=list(states.categories), columns=panel)
df.insert(0, 'n_cells', ncell)
df.to_parquet(OUT / 'platt_state_pseudobulk.parquet')
print(f"  wrote {OUT/'platt_state_pseudobulk.parquet'} — {df.shape[0]} states x {len(panel)} genes")
