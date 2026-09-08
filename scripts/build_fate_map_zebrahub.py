#!/usr/bin/env python3
"""Build the /fate_map_zebrahub dataset: two maps of the same five days.

THE THESIS, AND THE LINE THAT MUST NOT BE CROSSED:
  Development has two kinds of motion. Cells move through PHYSICAL space, and
  cell states move through TRANSCRIPTIONAL space. Zebrahub observed both — but
  it did not observe both in the same cells.

  The 120,444 single-cell transcriptomes come from 40 dissociated embryos.
  The 101,676 light-sheet tracks come from ONE OTHER, LIVE embryo (ZSNS001).
  They are complementary modalities, not one population measured twice. No
  cell on Plate I appears on Plate IV, and the page must keep saying so.

  Within the scRNA side, nothing is lineage: those embryos were dissociated and
  read once. Within the tracking side, the parent links ARE lineage — a nucleus
  followed frame to frame, and 36,878 divisions. So this page has to hold BOTH
  vocabularies at once and keep them on their own plates. That is the whole
  reason it exists, and it is the easiest thing here to get wrong.

WHAT IS NOT IN THE PUBLIC RELEASE — and so is not on this page:
  RNA velocity. The authors' velocity notebooks are in the code snapshot, but
  they read velocyto loom files (`velocyto_Zebrahub_115k_cells.h5ad`,
  `nmps_all.loom`) and intermediate objects from a lab filesystem
  (`/mnt/ibm_lg/alejandro/...`) that the Figshare release does not contain, and
  their transition matrices (`results/tran_matrix_*.npz`) were never deposited.
  The released h5ad has no spliced/unspliced layers, so velocity cannot be
  recomputed from it either. Rather than draw arrows we cannot justify, Plate
  III shows the axial-progenitor decision as MARKER COMPOSITION over time, and
  says that is what it is.

TRAPS, both recorded by the warehouse README and both re-checked here:
  1. `zf_atlas_15hpf_v1_release.h5ad` is a Figshare PACKAGING DUPLICATE of the
     14 hpf release — same 3,862 barcodes, same four fish. Concatenating the
     per-stage files double-counts it. This build reads the authors' combined
     `zf_atlas_full_v1_release.h5ad` and never concatenates, so the trap cannot
     be sprung; the assertion on the cell count is the guard.
  2. `X` in this release is RAW INTEGER COUNTS, not log-normalised. (DanioCell's
     GEO matrix is the other way round.) Marker scores here are normalised to
     counts-per-10k and log1p'd by this script. Skipping that step silently
     scores big cells higher than small ones.

Inputs (mirrored at s3://zsb-silver-warehouse/zebrahub/):
  {SRC}/raw/zf_atlas_full_v1_release.h5ad     120,444 x 32,060, author md5 verified
  {SRC}/tracks/ZSNS001_tail_tracks.csv        7,505,357 rows of light-sheet tracking
  The tracks come from the authors' public imaging endpoint, which the
  in-silico-fate-mapping README names:
  http://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/

Outputs (public/fate_map_zebrahub/):
  meta.json      counts, stages, classes, and every caveat the page prints
  cells.bin      the 120,444-cell embedding + time / class / cluster / markers
  embryos.json   Plate II — per-fish composition and inter-embryo divergence
  tracks.bin     Plate IV — the light-sheet tracks, time-sampled
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np

SRC = Path("/data/scratch/zebrahub")
OUT = Path(__file__).resolve().parent.parent / "public" / "fate_map_zebrahub"
H5 = SRC / "raw" / "zf_atlas_full_v1_release.h5ad"
TRACKS = SRC / "tracks" / "ZSNS001_tail_tracks.csv"

N_CELLS = 120_444          # the paper's count; the guard against the 15 hpf trap
N_GENES = 32_060
XY_SCALE = 500.0           # UMAP units -> int16
TRACK_STEP = 10            # sample the tracks every 10th frame
CP10K = 1e4

# The axial-progenitor markers, from the paper's own account of the NMP
# decision. sox2 is the neural arm, tbxta the mesodermal one, and a cell
# carrying both is the bipotent state the paper is about; tbx16/msgn1 mark the
# paraxial-mesoderm route out of it and sox3/sox19a the neural route.
MARKERS = {
    "sox2": "neural", "sox3": "neural", "sox19a": "neural",
    "tbxta": "meso", "tbx16": "meso", "msgn1": "meso",
}
DETECT = 1.0               # log1p(CP10K) above this counts as expressed


def load_h5():
    import h5py
    f = h5py.File(H5, "r")
    n = f["obs"]["timepoint"].shape[0]
    if n != N_CELLS:
        sys.exit(f"expected {N_CELLS} cells (the paper's count) and found {n} — "
                 "is this a concatenation that swallowed the 15 hpf duplicate?")
    cat = f["obs"]["__categories"]
    dec = lambda k: [x.decode() if isinstance(x, bytes) else str(x) for x in cat[k][:]]
    out = {
        "timepoint_names": dec("timepoint"),
        "stage_names": dec("developmental_stage"),
        "fish_names": dec("fish"),
        "class_names": dec("zebrafish_anatomy_ontology_class"),
        "zfa_ids": dec("zebrafish_anatomy_ontology_id"),
        "timepoint": f["obs"]["timepoint"][:],
        "stage": f["obs"]["developmental_stage"][:],
        "fish": f["obs"]["fish"][:],
        "cls": f["obs"]["zebrafish_anatomy_ontology_class"][:],
        "zfa": f["obs"]["zebrafish_anatomy_ontology_id"][:],
        "cluster": f["obs"]["timepoint_cluster"][:],
        "total": f["obs"]["total_counts"][:].astype(np.float64),
        "umap": f["obsm"]["X_umap"][:],
    }
    genes = np.array([x.decode() for x in f["var"]["_index"][:]])
    out["genes"] = genes
    return f, out


def marker_scores(f, meta):
    """log1p(CP10K) for each marker gene, pulled out of the CSR by column.

    X here is RAW COUNTS (integers), which is why the normalisation is done
    rather than assumed. Reading the whole index array once and masking is far
    faster than slicing per gene.
    """
    genes = meta["genes"]
    want = {}
    for g in MARKERS:
        hit = np.flatnonzero(genes == g)
        if not len(hit):
            sys.exit(f"marker {g} is not in var — the release changed")
        want[g] = int(hit[0])
    cols = np.array(sorted(want.values()))
    col_of = {c: i for i, c in enumerate(cols)}

    X = f["X"]
    indptr = X["indptr"][:]
    print(f"  scanning {X['data'].shape[0]:,} nonzeros for {len(cols)} marker columns ...",
          flush=True)
    scores = np.zeros((N_CELLS, len(cols)), np.float32)
    CH = 20_000_000
    nnz = X["data"].shape[0]
    # cell index for every nonzero, built once per chunk from indptr
    for lo in range(0, nnz, CH):
        hi = min(nnz, lo + CH)
        idx = X["indices"][lo:hi]
        m = np.isin(idx, cols)
        if not m.any():
            continue
        dat = X["data"][lo:hi][m]
        pos = np.flatnonzero(m) + lo
        cell = np.searchsorted(indptr, pos, side="right") - 1
        for j, c in enumerate(cols):
            sel = idx[m] == c
            if sel.any():
                scores[cell[sel], j] = dat[sel]
    tot = np.maximum(meta["total"], 1.0)[:, None]
    scores = np.log1p(scores / tot * CP10K)
    return {g: scores[:, col_of[want[g]]] for g in MARKERS}


def axial_state(sc):
    """Four states around the axial-progenitor decision, by marker detection.

    This is OUR definition, drawn with the paper's marker genes but not the
    paper's annotation — the released object carries no NMP label. The page
    says so; do not let it be read as the authors' call.
    """
    neu = np.zeros(N_CELLS, bool)
    mes = np.zeros(N_CELLS, bool)
    for g, arm in MARKERS.items():
        if arm == "neural":
            neu |= sc[g] > DETECT
        else:
            mes |= sc[g] > DETECT
    st = np.zeros(N_CELLS, np.uint8)      # 0 neither
    st[neu & ~mes] = 1                     # neural only
    st[~neu & mes] = 2                     # mesodermal only
    st[neu & mes] = 3                      # both — the bipotent-like state
    return st


def divergence(p, q):
    """Jensen-Shannon divergence in bits between two composition vectors."""
    p = np.asarray(p, float); q = np.asarray(q, float)
    p = p / max(p.sum(), 1e-12); q = q / max(q.sum(), 1e-12)
    m = (p + q) / 2
    def kl(a, b):
        s = a > 0
        return float(np.sum(a[s] * np.log2(a[s] / np.maximum(b[s], 1e-12))))
    return 0.5 * kl(p, m) + 0.5 * kl(q, m)


def build_embryos(meta, st):
    """Plate II — what four embryos of the same age look like beside each other.

    Composition over the ten anatomy classes, per fish, plus the mean pairwise
    Jensen-Shannon divergence between the four embryos at each stage. This is a
    composition measure and NOT the authors' gene-level inter-embryo divergence
    analysis, which needs their DE pipeline; the page says which it is.
    """
    tp, fish, cls = meta["timepoint"], meta["fish"], meta["cls"]
    nC = len(meta["class_names"])
    stages = []
    for t, tname in enumerate(meta["timepoint_names"]):
        fl = sorted(set(fish[tp == t].tolist()))
        embryos = []
        for fi in fl:
            m = (tp == t) & (fish == fi)
            comp = np.bincount(cls[m], minlength=nC).astype(float)
            embryos.append({
                "fish": meta["fish_names"][fi],
                "n": int(m.sum()),
                "comp": [int(x) for x in comp],
                "axial": [int((st[m] == k).sum()) for k in range(4)],
            })
        ds = [divergence(a["comp"], b["comp"])
              for i, a in enumerate(embryos) for b in embryos[i + 1:]]
        # which class contributes most to the spread between the four
        fr = np.array([np.array(e["comp"], float) / max(sum(e["comp"]), 1) for e in embryos])
        spread = (fr.max(0) - fr.min(0))
        stages.append({
            "timepoint": tname,
            "stage": meta["stage_names"][int(np.bincount(meta["stage"][tp == t]).argmax())],
            "n": int((tp == t).sum()),
            "embryos": embryos,
            "jsd_mean": round(float(np.mean(ds)), 4) if ds else 0.0,
            "jsd_max": round(float(np.max(ds)), 4) if ds else 0.0,
            "widest_class": meta["class_names"][int(spread.argmax())],
            "widest_range": round(float(spread.max()), 4),
        })
    return stages


def build_tracks():
    """Plate IV — the light-sheet tracks, thinned in time.

    Every track is kept; only the time axis is sampled, so a region selected on
    the plate still contains the cells that were really there. Positions are
    int16 microns-ish in the movie's own frame; no registration to the scRNA
    side is possible or attempted.
    """
    import pandas as pd
    print("  reading tracks ...", flush=True)
    df = pd.read_csv(TRACKS, usecols=["track_id", "ParentTrackID", "t", "z", "y", "x"])
    n_tracks = df.track_id.nunique()
    n_frames = int(df.t.max()) + 1
    divisions = int(df[df.ParentTrackID.notna()].groupby("ParentTrackID").track_id.nunique().ge(2).sum())
    # Sampling every Nth frame silently DROPS any track short enough to fall
    # between two sample frames - 2,161 of them at step 10, which the page's
    # integrity check caught as a count mismatch. Keep the sampled frames, then
    # add back the first row of every track that would otherwise vanish, so the
    # track count in the binary is the track count in the source.
    keep = (df.t.values % TRACK_STEP == 0)
    kept_ids = set(df.track_id.values[keep].tolist())
    missing = df.track_id.isin(set(df.track_id.unique()) - kept_ids)
    if missing.any():
        first_of_missing = df[missing].groupby("track_id", sort=False).head(1)
        print(f"  keeping {first_of_missing.track_id.nunique():,} short tracks "
              f"that fall between sample frames")
        keep = keep | df.index.isin(first_of_missing.index)
    d = df[keep].sort_values(["track_id", "t"], kind="stable")
    tid = d.track_id.to_numpy()
    starts = np.flatnonzero(np.r_[True, tid[1:] != tid[:-1]])
    lens = np.diff(np.r_[starts, len(tid)])
    order = tid[starts]
    parent = df.groupby("track_id").ParentTrackID.first()
    pid = parent.reindex(order).to_numpy()
    tix = {t: i for i, t in enumerate(order.tolist())}
    par_ix = np.array([tix.get(p, -1) if p == p else -1 for p in pid.tolist()], np.int32)
    print(f"  {n_tracks:,} tracks, {n_frames} frames, {divisions:,} divisions; "
          f"kept {len(d):,} samples every {TRACK_STEP} frames")
    return {
        "n_tracks": int(n_tracks), "n_frames": n_frames, "n_rows": int(len(df)),
        "divisions": divisions,
        "t": (d.t.to_numpy() // TRACK_STEP).astype(np.uint16),
        "z": d.z.to_numpy(), "y": d.y.to_numpy(), "x": d.x.to_numpy(),
        "starts": starts.astype(np.uint32), "lens": lens.astype(np.uint16),
        "parent": par_ix,
        "n_samp_frames": int(n_frames // TRACK_STEP) + 1,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    f, meta = load_h5()
    print(f"  {N_CELLS:,} cells x {N_GENES:,} genes; "
          f"{len(meta['timepoint_names'])} timepoints, {len(set(meta['fish'].tolist()))} fish, "
          f"{len(meta['class_names'])} anatomy classes")
    pairs = len(set(zip(meta["timepoint"].tolist(), meta["cluster"].tolist())))
    print(f"  {pairs} distinct (timepoint, cluster) pairs")

    sc = marker_scores(f, meta)
    st = axial_state(sc)
    f.close()
    for k in range(4):
        print(f"    axial state {k}: {int((st == k).sum()):,}")

    # ---- cells.bin: widest first, 16-byte header --------------------------
    u = meta["umap"]
    with open(OUT / "cells.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"ZHCL", 1, N_CELLS, len(meta["timepoint_names"])))
        fh.write(np.round(u[:, 0] * XY_SCALE).astype("<i2").tobytes())
        fh.write(np.round(u[:, 1] * XY_SCALE).astype("<i2").tobytes())
        fh.write(meta["cluster"].astype("<u2").tobytes())
        fh.write(meta["timepoint"].astype("<u1").tobytes())
        fh.write(meta["cls"].astype("<u1").tobytes())
        fh.write(meta["fish"].astype("<u1").tobytes())
        fh.write(st.astype("<u1").tobytes())

    embryos = build_embryos(meta, st)
    (OUT / "embryos.json").write_text(json.dumps(embryos, separators=(",", ":")))
    print("  inter-embryo JSD by stage: " +
          ", ".join(f"{s['timepoint']} {s['jsd_mean']:.3f}" for s in embryos))

    tr = build_tracks()
    with open(OUT / "tracks.bin", "wb") as fh:
        fh.write(struct.pack("<4sIIII", b"ZHTR", 1, len(tr["starts"]), len(tr["t"]),
                             tr["n_samp_frames"]))
        fh.write(tr["starts"].astype("<u4").tobytes())
        fh.write(tr["parent"].astype("<i4").tobytes())
        fh.write(tr["lens"].astype("<u2").tobytes())
        for k in ("x", "y", "z"):
            fh.write(np.clip(np.round(tr[k]), 0, 65535).astype("<u2").tobytes())
        fh.write(tr["t"].astype("<u2").tobytes())

    stage_of_tp = {}
    for t in range(len(meta["timepoint_names"])):
        m = meta["timepoint"] == t
        stage_of_tp[t] = meta["stage_names"][int(np.bincount(meta["stage"][m]).argmax())]

    meta_out = {
        "generated_by": "scripts/build_fate_map_zebrahub.py",
        "source": {
            "paper": "Lange et al., A multimodal zebrafish developmental atlas reveals the "
                     "state-transition dynamics of late-vertebrate pluripotent axial progenitors",
            "journal": "Cell (2024)",
            "doi": "10.1016/j.cell.2024.09.047",
            "figshare": "10.6084/m9.figshare.20510367.v1",
            "portal": "https://zebrahub.ds.czbiohub.org/",
            "code": "https://github.com/czbiohub-sf/zebrahub_analysis",
            "atlas_file": "zf_atlas_full_v1_release.h5ad (author md5 c26f326d67bb169e187008467c1ef2f2)",
            "tracks_url": "http://public.czbiohub.org/royerlab/zebrahub/imaging/"
                          "single-objective/ZSNS001_tail_tracks.csv",
            "warehouse": "s3://zsb-silver-warehouse/zebrahub/",
        },
        "counts": {
            "cells": N_CELLS, "genes": N_GENES,
            "timepoints": len(meta["timepoint_names"]),
            "fish": len(meta["fish_names"]),
            "classes": len(meta["class_names"]),
            "timepoint_clusters": pairs,
            "track_rows": tr["n_rows"], "tracks": tr["n_tracks"],
            "track_frames": tr["n_frames"], "track_divisions": tr["divisions"],
            "track_samples": len(tr["t"]),
        },
        "timepoints": [{"name": n, "stage": stage_of_tp[i],
                        "cells": int((meta["timepoint"] == i).sum())}
                       for i, n in enumerate(meta["timepoint_names"])],
        "classes": [{"key": n, "zfa": meta["zfa_ids"][i] if i < len(meta["zfa_ids"]) else "",
                     "cells": int((meta["cls"] == i).sum())}
                    for i, n in enumerate(meta["class_names"])],
        "fish": meta["fish_names"],
        "axial_states": ["neither", "neural markers only", "mesodermal markers only",
                         "both — bipotent-like"],
        "axial_markers": {k: v for k, v in MARKERS.items()},
        "axial_detect_log1p_cp10k": DETECT,
        "xy_scale": XY_SCALE,
        "track_step": TRACK_STEP,
        "caveats": [
            "The two maps are not the same cells. The 120,444 transcriptomes come from 40 "
            "dissociated embryos; the 101,676 tracks come from one other, living embryo. "
            "They are complementary modalities and no cell appears on both plates.",
            "The single-cell side carries no lineage. Those embryos were dissociated and read "
            "once, so proximity in the embedding is similarity of expression and nothing more.",
            "The tracking side DOES carry lineage - a nucleus followed frame to frame, with "
            "36,878 divisions - but it carries no transcriptome. It says where a cell went, "
            "never what it was expressing.",
            "RNA velocity is not on this page. The authors' velocity notebooks read loom files "
            "and intermediate objects that the public release does not contain, and the released "
            "matrix has no spliced/unspliced layers, so it cannot be recomputed. Plate III shows "
            "marker composition instead and does not draw arrows it cannot justify.",
            "The axial-progenitor states on Plate III are OUR marker definition, not the "
            "authors' annotation - the released object carries no NMP label. Cells are called "
            "by detection of the paper's own marker genes above a stated threshold.",
            "One embryo's tail, for the tracking. The light-sheet movie is a single specimen, "
            "and the field of view is the tail, not the whole animal.",
        ],
    }
    (OUT / "meta.json").write_text(json.dumps(meta_out, indent=1))
    for p in ("meta.json", "cells.bin", "embryos.json", "tracks.bin"):
        print(f"  wrote {p}  {(OUT / p).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
