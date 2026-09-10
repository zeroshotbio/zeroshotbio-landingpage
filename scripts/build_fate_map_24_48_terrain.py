#!/usr/bin/env python3
"""Plate IV — the 24 to 48 hpf terrain, and a ChemFish perturbation layer.

WHAT THE TERRAIN IS, AND IS NOT. It is a rendering of where wild-type cells
ACCUMULATE in transcriptomic state space, hour by hour. Elevation is the inverted
within-hour RANK of cell density, so a basin is a state many cells occupy and a
ridge is a sparsely occupied region between two of them. That is a Waddington-style
metaphor drawn from real counts — and it is a metaphor. The terrain is not
anatomy, no cell rolls down it, and nothing on it is a tracked lineage.

Axes, and this is the whole point of the plate:

    y = developmental time, 24 hpf at the TOP and 48 hpf at the BOTTOM
    x = one axis of the existing wild-type embedding (the fixed principal
        projection of ZSCAPE's own 3D UMAP, already used by Plate III)

Density is normalised WITHIN each hour. Sampling depth varies 16-fold across the
window, so an un-normalised terrain would draw the sequencing schedule as a
mountain range.

THE PERTURBATION LAYER IS CHEMFISH, NOT ZSCAPE. Seven small molecules, each
blocking one named signalling pathway, against their matched vehicle:

    DEAB        retinoic acid       vs DMSO
    LY411575    Notch               vs DMSO
    SB505124    TGF-beta            vs DMSO
    WntC59      Wnt                 vs DMSO
    DMH1        BMP                 vs DMSO
    SU5402      FGF                 vs DMSO
    Cyclopamine Shh                 vs ETHANOL, not DMSO

ChemFish covers 36, 48 and 72 hpf, so only 36 and 48 fall in this window. Its
cell_type vocabulary is the Platt one, so states reach the terrain's x axis
through the verified Platt-to-ZSCAPE cell-level crosswalk rather than by name.

A drug does not move a cell across the terrain here — it changes how many cells
sit in each basin. So a perturbation DEFORMS the landscape: basins deepen where
a state is enriched and fill in where it is depleted.

Run:  python3 scripts/build_fate_map_24_48_terrain.py
"""

from __future__ import annotations

import collections
import json
import os
import pathlib
import struct
import sys

os.environ.setdefault("HDF5_USE_FILE_LOCKING", "FALSE")   # the file is served live

import h5py
import numpy as np
import pandas as pd

WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"
TABLES = pathlib.Path("/data/fate_map")
CF = "/data/chemfish/chemfish.h5ad"

NX = 200            # terrain columns across the embedding axis
SMOOTH = 3.0        # gaussian sigma in columns
MIN_STATE = 400     # cells in the window before a state gets a channel
MIN_CELLS_CF = 60   # cells per (drug, hour) arm before a state is scored

VEHICLE = {"DEAB": "DMSO", "LY411575": "DMSO", "SB505124": "DMSO",
           "WntC59": "DMSO", "DMH1": "DMSO", "SU5402": "DMSO",
           "Cyclopamine": "EtOH"}
PATHWAY = {"DEAB": "RA", "LY411575": "Notch", "SB505124": "TGFb",
           "WntC59": "Wnt", "DMH1": "BMP", "SU5402": "FGF",
           "Cyclopamine": "Shh"}


def gauss1d(a: np.ndarray, sigma: float) -> np.ndarray:
    """Smooth along the last axis with a gaussian kernel, edges reflected.

    Args:
        a (np.ndarray): values.
        sigma (float): kernel width in samples.

    Returns:
        np.ndarray: smoothed values, same shape.
    """
    r = int(max(1, round(sigma * 3)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(a, [(0, 0)] * (a.ndim - 1) + [(r, r)], mode="reflect")
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), -1, pad)


def state_kernels(xs: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Gaussian kernel of each state's position over the terrain's column grid.

    A state is a point on this axis, and the terrain is a continuous profile, so
    every per-state quantity has to be smeared before the two can be compared.
    The kernel is the SAME width as the one that smoothed the terrain itself,
    which is the only way the deformation and the surface stay commensurate.

    Args:
        xs (np.ndarray): state positions in embedding units, shape (S,).
        lo (float): left edge of the terrain's x range.
        hi (float): right edge.

    Returns:
        np.ndarray: shape (S, NX), each row a gaussian bump summing to 1.
    """
    j = np.arange(NX)[None, :]
    js = ((xs - lo) / (hi - lo) * NX - 0.5)[:, None]
    k = np.exp(-0.5 * ((j - js) / SMOOTH) ** 2)
    return k / np.maximum(k.sum(1, keepdims=True), 1e-12)


def perturbation_fields(cf: pd.DataFrame, shared: dict, axis: str,
                        lo: float, hi: float, hours: list) -> tuple[dict, dict, dict]:
    """Project ChemFish onto the terrain's x axis as continuous profiles.

    THIS IS THE ONE-DIMENSIONAL VERSION OF WHAT A DRUG DOES TO THE EMBEDDING.
    Each arm gets an occupancy profile — every scored state's cell fraction
    smeared along the axis with the terrain's own kernel — and the deformation is
    the log ratio of the two profiles, column by column:

        P_arm(x) = sum_s  frac_arm(s) * K(x - x_s)
        L(x)     = log2( P_drug(x) / P_vehicle(x) )

    L is positive where the drug arm puts MORE of its cells than the vehicle arm
    does, which is a basin that deepens. It is the same quantity as the `lfc`
    column of the published table, read as a function of position instead of as a
    list of states.

    What it is NOT is a change in position. ChemFish cells are placed on this axis
    by WHICH STATE THEY ARE, through the Platt-to-ZSCAPE crosswalk — they were
    never embedded themselves. A drug can make a basin deeper or shallower here.
    It cannot move one sideways.

    Args:
        cf (pd.DataFrame): the per drug/hour/state composition table.
        shared (dict): the per-hour PC1 result, keyed by str(hour).
        axis (str): "e1" or "e2".
        lo (float): left edge of this axis's range.
        hi (float): right edge.
        hours (list): measured ChemFish hours inside the window.

    Returns:
        tuple[dict, dict, dict]: drug fields {drug: {hour: [NX]}}, shared field
            {hour: [NX]}, coverage {hour: [NX]}.
    """
    xcol = "x_" + axis
    dfield: dict = {}
    sfield: dict = {}
    cov: dict = {}
    for h in hours:
        hh = cf[cf.hpf == h]
        if hh.empty:
            continue
        # coverage: where on the axis ChemFish has any scored cells at all. The
        # deformation is blanked outside it rather than drawn as a flat zero,
        # which would claim "measured, and no change".
        w = hh.groupby("state").apply(
            lambda g: float((g.n_drug + g.n_vehicle).mean()), include_groups=False)
        pos = hh.groupby("state")[xcol].first().reindex(w.index)
        K = state_kernels(pos.to_numpy(float), lo, hi)
        c = (w.to_numpy(float)[:, None] * K).sum(0)
        cov[str(h)] = c / max(c.max(), 1e-12)

        for drug, g in hh.groupby("drug"):
            Kd = state_kernels(g[xcol].to_numpy(float), lo, hi)
            pd_ = (g.frac_drug.to_numpy(float)[:, None] * Kd).sum(0)
            pv_ = (g.frac_vehicle.to_numpy(float)[:, None] * Kd).sum(0)
            pd_ /= max(pd_.sum(), 1e-12)
            pv_ /= max(pv_.sum(), 1e-12)
            floor = 1e-3 * max(pv_.max(), 1e-12)
            L = np.log2((pd_ + floor) / (pv_ + floor))
            L[cov[str(h)] < 0.02] = 0.0
            dfield.setdefault(drug, {})[str(h)] = [round(float(v), 4) for v in L]

        # the shared axis, as a field: a kernel-weighted mean of the PC1 state
        # scores. Derived entirely from the DRUG arms — the wild-type terrain
        # underneath it knows nothing about this number.
        sc = (shared.get(str(h)) or {}).get("state_scores") or {}
        keep = [i for i, st in enumerate(w.index) if st in sc]
        if keep:
            vals = np.array([sc[w.index[i]] for i in keep])
            Ks = K[keep] * w.to_numpy(float)[keep][:, None]
            num = (Ks * vals[:, None]).sum(0)
            den = Ks.sum(0)
            sv = np.where(den > 1e-12, num / np.maximum(den, 1e-12), 0.0)
            # A weighted mean is defined wherever the kernel reaches, including
            # far outside anywhere ChemFish has cells. Blank it there rather than
            # publish an extrapolation: the renderer floods only what is covered.
            sv[cov[str(h)] < 0.02] = 0.0
            sfield[str(h)] = [round(float(v), 4) for v in sv]
    return dfield, sfield, cov


def read_cells() -> tuple[dict, dict, list]:
    """Read Plate III's binary and its companions.

    Returns:
        tuple[dict, dict, list]: cells, embed meta, states.

    Raises:
        SystemExit: If Plate III's assets are missing.
    """
    for p in ("cells.bin", "embed_meta.json", "states.json"):
        if not (WEB / p).exists():
            sys.exit(f"missing {WEB/p} — run build_fate_map_24_48_embed.py first")
    buf = (WEB / "cells.bin").read_bytes()
    if buf[:4] != b"ZCEL":
        sys.exit("cells.bin: bad magic")
    ver, n, nstage = struct.unpack("<III", buf[4:16])
    o = 16
    x = np.frombuffer(buf, "<i2", n, o); o += 2 * n
    y = np.frombuffer(buf, "<i2", n, o); o += 2 * n
    c = np.frombuffer(buf, "<u2", n, o); o += 2 * n
    t = np.frombuffer(buf, "<u1", n, o); o += n
    s = np.frombuffer(buf, "<u1", n, o)
    meta = json.loads((WEB / "embed_meta.json").read_text())
    states = json.loads((WEB / "states.json").read_text())
    return {"n": n, "x": x, "y": y, "c": c, "t": t, "s": s}, meta, states


def main() -> None:
    """Build terrain.json and write the ChemFish tables.

    Raises:
        SystemExit: If a prerequisite is missing.
    """
    cells, meta, states = read_cells()
    SC = meta["xy_scale"]
    STAGES = meta["stages"]
    xs = cells["x"].astype(np.float64) / SC
    ys = cells["y"].astype(np.float64) / SC

    xw_path = TABLES / "crosswalk_platt_zscape.tsv"
    if not xw_path.exists():
        sys.exit(f"missing {xw_path}")

    # ---- the terrain field ------------------------------------------------
    # Two axes offered, exactly as /fate_map_wang_2026 Plate II offers two
    # spherical coordinates: the reader picks which slice of the embedding the
    # terrain is cut along, and the shape of the argument survives either way.
    fields = {}
    for axis_name, vals in (("e1", xs), ("e2", ys)):
        lo, hi = float(np.percentile(vals, 0.2)), float(np.percentile(vals, 99.8))
        edges = np.linspace(lo, hi, NX + 1)
        dens = np.zeros((len(STAGES), NX))
        for ti in range(len(STAGES)):
            m = cells["t"] == ti
            h, _ = np.histogram(vals[m], bins=edges)
            # normalise WITHIN the hour: depth varies 16-fold across the window
            dens[ti] = h / max(1, h.sum())
        dens = gauss1d(dens, SMOOTH)
        # Elevation: high density is LOW ground. A basin is where cells sit.
        #
        # The first version took -log10(density) and min-max normalised the whole
        # field. It rendered as ruled lines: the empty tails of every hour drove
        # the maximum, so all the real structure was squeezed into a narrow band
        # and the relief was invisible. Normalising WITHIN each hour against that
        # hour's own densest column, with a compressive exponent, gives every
        # hour the full amplitude and the terrain its shape. The trade is that
        # elevation is comparable across x within an hour, but NOT between hours
        # — which is the same trade the within-hour density normalisation
        # already made, and is stated on the plate.
        # Two attempts before this one rendered as ruled lines. -log10 min-max
        # over the whole field let the empty tails set the maximum; dividing by
        # the row maximum left most columns near 1, so each profile was flat with
        # a few narrow notches. What the eye needs is the row's values spread
        # over the full amplitude, which is a RANK transform: elevation is one
        # minus the within-hour percentile rank of density, blended with the
        # within-hour normalised density so the depths mean something.
        #
        # It is monotone in density, so every ordering claim the plate makes is
        # still true — a lower point always has more cells than a higher one at
        # the same hour. What it is NOT is proportional: the depth of a valley is
        # a rank, not a cell count, and the plate says so.
        # The rank ALONE gives every hour the full amplitude, but it also gives
        # every valley the same depth: a rank is uniform by construction, so the
        # surface came out as smooth rolling waves rather than a range with real
        # peaks and canyons. The fix is to add back a term that carries the
        # actual density contrast, so a basin holding a tenth of the hour's cells
        # is visibly deeper than one holding a fiftieth.
        #
        # Both terms are monotone DECREASING in density, so their sum is too, and
        # the plate's only ordering claim survives intact: at a given hour, lower
        # ground always holds more cells than higher ground.
        order = np.argsort(np.argsort(dens, axis=1), axis=1)
        e_rank = 1.0 - order / (NX - 1.0)
        e_dens = 1.0 - (dens / np.maximum(dens.max(axis=1, keepdims=True), 1e-12)) ** 0.35
        elev = 0.55 * e_rank + 0.45 * e_dens
        elev = gauss1d(elev, 1.5)
        fields[axis_name] = {
            "lo": round(lo, 4), "hi": round(hi, 4),
            "elev": [[round(float(v), 4) for v in row] for row in elev],
            "dens_max": round(float(dens.max()), 6),
        }
        print(f"  terrain {axis_name}: {len(STAGES)} x {NX}, x range [{lo:.2f}, {hi:.2f}]")

    # ---- wild-type channels ----------------------------------------------
    # One channel per state that is big enough to place: its x centroid at each
    # hour. These are the routes the terrain's basins lie along.
    channels = []
    for st in states:
        if st["n"] < MIN_STATE:
            continue
        m_state = cells["c"] == st["i"]
        row = {"state": st["name"], "tissue": st["tissue"], "n": st["n"], "pts": []}
        for ti in range(len(STAGES)):
            m = m_state & (cells["t"] == ti)
            k = int(m.sum())
            row["pts"].append(None if k < 15 else
                              [round(float(xs[m].mean()), 4),
                               round(float(ys[m].mean()), 4), k])
        if sum(1 for p in row["pts"] if p) >= 3:
            channels.append(row)
    channels.sort(key=lambda r: -r["n"])
    print(f"  channels: {len(channels)} states with 3+ placeable hours")

    # ---- ChemFish --------------------------------------------------------
    if not pathlib.Path(CF).exists():
        sys.exit(f"missing {CF}")
    f = h5py.File(CF, "r")
    o = f["obs"]

    def cat(k):
        n = o[k]
        c = np.array([x.decode() if isinstance(x, bytes) else str(x)
                      for x in n["categories"][:]], dtype=object)
        return c, n["codes"][:]

    tp_c, tp_k = cat("timepoint") if isinstance(o["timepoint"], h5py.Group) else (None, o["timepoint"][:])
    tp = (tp_c[tp_k].astype(int) if tp_c is not None else tp_k.astype(int))
    pert_c, pert_k = cat("perturbation")
    ct_c, ct_k = cat("cell_type")
    f.close()
    print(f"  chemfish: {len(tp):,} cells, timepoints {sorted(set(tp.tolist()))}")

    HOURS = [h for h in (36, 48) if h in set(tp.tolist())]
    pert = pert_c[pert_k]

    # composition per (arm, hour) over the Platt vocabulary.
    # AnnData writes -1 for an unlabelled categorical, and bincount refuses a
    # negative. Those cells carry no cell_type and are dropped, not folded into
    # a bin, which would invent a state.
    labelled = ct_k >= 0
    print(f"  cells with a cell_type: {int(labelled.sum()):,} of {len(ct_k):,}")
    comp = {}
    for arm in set(pert.tolist()):
        for h in HOURS:
            m = (pert == arm) & (tp == h) & labelled
            if not m.any():
                continue
            cnt = np.bincount(ct_k[m], minlength=len(ct_c))
            comp[(arm, h)] = cnt

    # x position of a Platt state on the terrain, via the CELL-LEVEL crosswalk:
    # a Platt state inherits the x of the ZSCAPE states its cells actually carry,
    # weighted by how many. Many-to-many is preserved as a weighted mean rather
    # than resolved to a winner.
    xw = pd.read_csv(xw_path, sep="\t")
    st_x = {s["name"]: s for s in states}
    place = {}
    for pstate, g in xw.groupby("platt_state"):
        num1 = num2 = wsum = 0.0
        for r in g.itertuples():
            s = st_x.get(r.zscape_state)
            if not s:
                continue
            pts = [p for p in s["trail"] if p]
            if not pts:
                continue
            w = float(r.n_cells)
            num1 += w * float(np.mean([p[0] for p in pts]))
            num2 += w * float(np.mean([p[1] for p in pts]))
            wsum += w
        if wsum > 0:
            place[pstate] = (num1 / wsum, num2 / wsum, wsum)
    print(f"  placed {len(place)} Platt states on the terrain via the crosswalk")

    rows = []
    for drug, veh in VEHICLE.items():
        for h in HOURS:
            a, b = comp.get((drug, h)), comp.get((veh, h))
            if a is None or b is None:
                continue
            na, nb = a.sum(), b.sum()
            for i, name in enumerate(ct_c):
                if a[i] < MIN_CELLS_CF and b[i] < MIN_CELLS_CF:
                    continue
                if name not in place:
                    continue
                fa, fb = (a[i] + 1) / (na + len(ct_c)), (b[i] + 1) / (nb + len(ct_c))
                px, py, pw = place[name]
                rows.append({"drug": drug, "pathway": PATHWAY[drug], "vehicle": veh,
                             "hpf": h, "state": name,
                             "n_drug": int(a[i]), "n_vehicle": int(b[i]),
                             "frac_drug": round(float(fa), 6),
                             "frac_vehicle": round(float(fb), 6),
                             "lfc": round(float(np.log2(fa / fb)), 4),
                             "x_e1": round(px, 4), "x_e2": round(py, 4)})
    cf = pd.DataFrame(rows)
    print(f"  chemfish rows: {len(cf):,} over {cf.state.nunique()} states, "
          f"{cf.drug.nunique()} drugs, hours {sorted(cf.hpf.unique().tolist())}")

    # ---- one shared perturbation structure --------------------------------
    # A state x drug matrix of compositional log fold-change, per hour, then the
    # first principal component ACROSS DRUGS. If seven different pathway
    # blockades reshape the landscape the same way, that shows up here; if they
    # do not, PC1 explains little and the page says so.
    shared = {}
    for h in HOURS:
        piv = cf[cf.hpf == h].pivot_table(index="state", columns="drug", values="lfc")
        piv = piv.dropna(thresh=max(3, piv.shape[1] - 2))
        piv = piv.fillna(0.0)
        if piv.shape[0] < 10 or piv.shape[1] < 3:
            continue
        M = piv.values - piv.values.mean(0)
        U, S, Wt = np.linalg.svd(M, full_matrices=False)
        var = (S ** 2) / (S ** 2).sum()
        load = Wt[0]
        if np.median(load) < 0:
            load, U = -load, -U
        score = M @ load
        shared[str(h)] = {
            "var_explained": round(float(var[0]), 4),
            "var_explained_second": round(float(var[1]), 4),
            "n_states": int(piv.shape[0]), "n_drugs": int(piv.shape[1]),
            "drug_loadings": {d: round(float(v), 4) for d, v in zip(piv.columns, load)},
            "state_scores": {s: round(float(v), 4) for s, v in zip(piv.index, score)},
        }
        print(f"  shared structure at {h} hpf: PC1 {var[0]:.1%} over "
              f"{piv.shape[0]} states x {piv.shape[1]} drugs")

    # ---- ChemFish as fields over the terrain's x axis ----------------------
    for axis_name in ("e1", "e2"):
        d_f, s_f, c_f = perturbation_fields(
            cf, shared, axis_name, fields[axis_name]["lo"], fields[axis_name]["hi"], HOURS)
        fields[axis_name]["dfield"] = d_f
        fields[axis_name]["sfield"] = s_f
        fields[axis_name]["cov"] = {k: [round(float(v), 4) for v in vv] for k, vv in c_f.items()}
        rng = [abs(v) for dd in d_f.values() for vv in dd.values() for v in vv]
        print(f"  {axis_name}: deformation |log2| max {max(rng):.2f}, "
              f"p99 {float(np.percentile(rng, 99)):.2f}")

    doc = {
        "stages": STAGES,
        "nx": NX,
        "fields": fields,
        "channels": channels[:44],
        "chemfish": {
            "hours": HOURS,
            "vehicle": VEHICLE, "pathway": PATHWAY,
            "min_cells": MIN_CELLS_CF,
            "rows": cf.to_dict(orient="records"),
            "shared": shared,
        },
        "caveat": "Elevation blends the within-hour RANK of wild-type cell density "
                  "with the within-hour normalised density, both inverted, so a basin "
                  "is where cells accumulate. Monotone but not "
                  "proportional, and not comparable between hours. It is an "
                  "interpretive rendering of transcriptomic state space — not anatomy, "
                  "not a tracked lineage, and nothing rolls down it.",
    }
    (WEB / "terrain.json").write_text(json.dumps(doc, separators=(",", ":")))
    TABLES.mkdir(parents=True, exist_ok=True)
    cf.to_csv(TABLES / "chemfish_state_composition_lfc.tsv", sep="\t", index=False)
    cf.to_parquet(TABLES / "chemfish_state_composition_lfc.parquet", index=False)
    if shared:
        pd.DataFrame([{"hpf": h, "drug": d, "loading": v}
                      for h, s in shared.items()
                      for d, v in s["drug_loadings"].items()]
                     ).to_csv(TABLES / "chemfish_shared_axis_loadings.tsv",
                              sep="\t", index=False)
    print(f"  wrote {WEB/'terrain.json'} "
          f"({(WEB/'terrain.json').stat().st_size/1024:.0f} KB) and the ChemFish tables")


if __name__ == "__main__":
    main()
