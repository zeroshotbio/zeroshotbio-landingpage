#!/usr/bin/env python3
"""Plate IV — the terrain across ChemFish's own window, 36 to 72 hpf.

THE PLATE FOLLOWS THE DRUGS NOW. It used to run 24 to 48 hpf like its siblings,
which threw away two thirds of ChemFish: the screen samples 36, 48 and 72 hpf,
and 48 alone carries 1.58M of its 2.07M cells. The window is now 36 to 72 so
every drug arm ChemFish has can appear on it.

That comes at a price the plate has to be honest about: ZSCAPE samples 36, 38,
40, 42, 44, 46, 48 and then nothing at all until 72. So the terrain is drawn as
a continuous range from 36 to 48, then a BREAK — twenty-four hours nobody
sampled — and then the single far ridge of 72 hpf. Nothing is interpolated
across the gap, and the plate draws the gap rather than hiding it.

WHAT THE TERRAIN IS, AND IS NOT. A rendering of where wild-type cells ACCUMULATE
in transcriptomic state space, hour by hour. Elevation blends the inverted
within-hour RANK of cell density with the inverted within-hour normalised
density; both fall as density rises, so the blend does, and the plate's only
ordering claim holds: lower ground holds more cells at that hour. It is a
Waddington-style metaphor drawn from real counts, and it is a metaphor — not
anatomy, nothing rolls down it, nothing on it is a tracked lineage.

    y = developmental time, 36 hpf at the TOP and 72 at the BOTTOM, broken
    x = one axis of the wild-type embedding — the SAME fixed principal
        projection Plate III uses, read out of embed_meta.json so the two
        plates put a cell in the same place

Density is normalised WITHIN each hour. Sampling depth varies more than 13-fold
across this window, so an un-normalised terrain would draw the sequencing
schedule as a mountain range.

THE PERTURBATION LAYER IS CHEMFISH, NOT ZSCAPE. Eight small molecules, each
blocking one named signalling pathway, against their matched vehicle:

    DEAB        retinoic acid       vs DMSO
    LY411575    Notch               vs DMSO
    SB505124    TGF-beta (ALK5)     vs DMSO
    A8301       TGF-beta (ALK5)     vs DMSO
    WntC59      Wnt                 vs DMSO
    DMH1        BMP                 vs DMSO
    SU5402      FGF                 vs DMSO
    Cyclopamine Shh                 vs ETHANOL, not DMSO

Its cell_type vocabulary is the Platt one, so states reach the terrain's x axis
through the verified Platt-to-ZSCAPE cell-level crosswalk rather than by name.

A drug does not move a cell across the terrain here — it changes how many cells
sit in each basin. So a perturbation DEFORMS the landscape: basins deepen where a
state is enriched and fill in where it is depleted.

AND IT CAN BE LATE. The apparent-stage fit asks a different question of the same
numbers: does this drug arm's composition look like its vehicle at its own hour,
or like the vehicle at an earlier one?

Run:  python3 scripts/build_fate_map_24_48_terrain.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys

os.environ.setdefault("HDF5_USE_FILE_LOCKING", "FALSE")   # the file is served live

import h5py
import numpy as np
import pandas as pd

WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"
TABLES = pathlib.Path("/data/fate_map")
CF = "/data/chemfish/chemfish.h5ad"
ZS = "/data/datasets/zebrafish/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad"

STAGES = [36, 38, 40, 42, 44, 46, 48, 72]
GAP = (48, 72)      # ZSCAPE samples nothing between these; the plate draws a break
NX = 200            # terrain columns across the embedding axis
SMOOTH = 3.0        # gaussian sigma in columns
MIN_STATE = 400     # cells in the window before a state gets a channel
MIN_CELLS_CF = 60   # cells per (drug, hour) arm before a state is scored
TAIL = 0.005        # fraction of each hour's cells trimmed off each end of its support

VEHICLE = {"DEAB": "DMSO", "LY411575": "DMSO", "SB505124": "DMSO", "A8301": "DMSO",
           "WntC59": "DMSO", "DMH1": "DMSO", "SU5402": "DMSO",
           "Cyclopamine": "EtOH"}
PATHWAY = {"DEAB": "RA", "LY411575": "Notch", "SB505124": "TGFb", "A8301": "TGFb",
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


def obs_col(o: h5py.Group, k: str, numeric: bool = False):
    """Read an obs column, resolving the categorical-string encoding.

    Every numeric column in the ZSCAPE object is stored as a string categorical
    (it came out of R), so anything numeric has to be parsed rather than read.

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


def read_zscape() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Read ZSCAPE controls over this plate's window and project them to 2D.

    The projection is NOT recomputed: mean and basis come out of Plate III's
    embed_meta.json, so a state sits at the same x on both plates even though the
    two windows no longer agree.

    Returns:
        tuple: xy (n, 2), stage index per cell, cell_type_sub, tissue.

    Raises:
        SystemExit: If ZSCAPE or Plate III's meta is missing.
    """
    meta_p = WEB / "embed_meta.json"
    if not meta_p.exists():
        sys.exit(f"missing {meta_p} — run build_fate_map_24_48_embed.py first")
    proj = json.loads(meta_p.read_text())["projection"]
    mu = np.asarray(proj["mean"], dtype=np.float64)
    basis = np.asarray(proj["basis"], dtype=np.float64)

    if not pathlib.Path(ZS).exists():
        sys.exit(f"missing {ZS}")
    f = h5py.File(ZS, "r")
    o = f["obs"]
    tp = obs_col(o, "timepoint", numeric=True)
    tgt = obs_col(o, "gene_target")
    keep = np.isin(tp, STAGES) & np.char.startswith(tgt.astype(str), "ctrl-")
    u = np.column_stack([obs_col(o, f"umap3d_{i}", numeric=True)[keep] for i in (1, 2, 3)])
    sub = obs_col(o, "cell_type_sub")[keep]
    tis = obs_col(o, "tissue")[keep]
    st = tp[keep].astype(int)
    f.close()

    xy = (u - mu) @ basis
    ti = np.asarray([STAGES.index(int(x)) for x in st], dtype=np.int16)
    print(f"  ZSCAPE controls, {STAGES[0]}-{STAGES[-1]} hpf: {len(xy):,} cells")
    for h in STAGES:
        print(f"    {h:>3} hpf  {int((st == h).sum()):>8,}")
    return xy, ti, sub, tis


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


def apparent_stage(comp: dict, ct_c: np.ndarray, hours: list) -> dict:
    """Fit each drug arm onto the VEHICLE's own developmental trajectory.

    A drug that holds a lineage back does not only change proportions — it makes
    the arm look YOUNGER than the clock says. This asks exactly that, and asks it
    entirely inside ChemFish so the protocol is matched:

        take the vehicle's log-composition at each sampled hour as an anchor,
        then find where along the piecewise line through those anchors the drug
        arm's log-composition projects.

    The answer is an apparent hour. Less than the real one is a delay.

    IT IS A RESEMBLANCE, NOT A CLOCK. An arm can look younger because a program
    genuinely stalled, or because the drug wiped out the states that arrive late
    without holding anything back. This number cannot tell those apart; it says
    the composition resembles an earlier control, which is a claim about the
    composition. The residual is reported alongside so a poor fit shows.

    Args:
        comp (dict): counts per (arm, hour), each a vector over ct_c.
        ct_c (np.ndarray): the Platt cell-type vocabulary.
        hours (list): sampled ChemFish hours, ascending.

    Returns:
        dict: {drug: {hour: {apparent_hpf, shift, residual, ...}}}.
    """
    out: dict = {}
    if len(hours) < 2:
        return out

    def logcomp(v):
        v = np.asarray(v, dtype=np.float64)
        f = (v + 1.0) / (v.sum() + len(ct_c))
        return np.log(f)

    for drug, veh in VEHICLE.items():
        anchors = {}
        for h in hours:
            if (veh, h) in comp:
                anchors[h] = logcomp(comp[(veh, h)])
        hs = [h for h in hours if h in anchors]
        if len(hs) < 2:
            continue
        for h in hours:
            if (drug, h) not in comp or h not in anchors:
                continue
            d = logcomp(comp[(drug, h)])
            # only states the vehicle series actually holds, so an arm is not
            # placed by the noise in states nobody has
            keep = np.ones(len(ct_c), dtype=bool)
            for hh in hs:
                keep &= comp[(veh, hh)] >= 20
            keep &= comp[(drug, h)] >= 0
            if keep.sum() < 20:
                continue
            best = None
            for a, b in zip(hs[:-1], hs[1:]):
                va, vb = anchors[a][keep], anchors[b][keep]
                dv = vb - va
                den = float(dv @ dv)
                if den <= 1e-12:
                    continue
                t = float((d[keep] - va) @ dv / den)
                tc = min(1.0, max(0.0, t))
                res = float(np.linalg.norm((d[keep] - va) - tc * dv))
                if best is None or res < best[0]:
                    best = (res, a + tc * (b - a), t < -1e-9 or t > 1 + 1e-9)
            if best is None:
                continue
            res, app, clipped = best
            # how far the vehicle itself travels per hour, as the yardstick the
            # shift is worth reading against
            span = float(np.linalg.norm(anchors[hs[-1]][keep] - anchors[hs[0]][keep]))
            out.setdefault(drug, {})[str(h)] = {
                "apparent_hpf": round(app, 2),
                "shift": round(app - h, 2),
                "residual": round(res, 3),
                "vehicle_span": round(span, 3),
                "off_trajectory": bool(clipped),
                "n_states": int(keep.sum()),
            }
    return out


def main() -> None:
    """Build terrain.json and write the ChemFish tables.

    Raises:
        SystemExit: If a prerequisite is missing.
    """
    xw_path = TABLES / "crosswalk_platt_zscape.tsv"
    if not xw_path.exists():
        sys.exit(f"missing {xw_path}")

    xy, ti_cell, sub, tis = read_zscape()
    xs, ys = xy[:, 0], xy[:, 1]

    # ---- the terrain field ------------------------------------------------
    # Two axes offered, exactly as /fate_map_wang_2026 Plate II offers two
    # spherical coordinates: the reader picks which slice of the embedding the
    # terrain is cut along, and the shape of the argument survives either way.
    fields = {}
    for axis_name, vals in (("e1", xs), ("e2", ys)):
        lo, hi = float(np.percentile(vals, 0.2)), float(np.percentile(vals, 99.8))
        edges = np.linspace(lo, hi, NX + 1)
        dens = np.zeros((len(STAGES), NX))
        for k in range(len(STAGES)):
            m = ti_cell == k
            h, _ = np.histogram(vals[m], bins=edges)
            # normalise WITHIN the hour: depth varies 13-fold across the window
            dens[k] = h / max(1, h.sum())
        dens = gauss1d(dens, SMOOTH)

        # Elevation: high density is LOW ground. A basin is where cells sit.
        #
        # Three attempts before this one. -log10(density) min-max over the whole
        # field let the empty tails of every hour set the maximum and rendered as
        # ruled lines; dividing by the row maximum left most columns near 1, flat
        # with a few narrow notches; the within-hour RANK gave every hour the
        # full amplitude but, being uniform by construction, gave every valley
        # the same depth and the terrain came out as rolling waves.
        #
        # So elevation adds a second term carrying the actual density contrast,
        # and a basin holding a tenth of the hour's cells is now visibly deeper
        # than one holding a fiftieth. BOTH TERMS ARE MONOTONE DECREASING IN
        # DENSITY, so their sum is too, and the plate's only ordering claim
        # survives intact: at a given hour, lower ground always holds more cells
        # than higher ground. What it is not is proportional, and elevation is
        # not comparable between hours.
        order = np.argsort(np.argsort(dens, axis=1), axis=1)
        e_rank = 1.0 - order / (NX - 1.0)
        e_dens = 1.0 - (dens / np.maximum(dens.max(axis=1, keepdims=True), 1e-12)) ** 0.35
        elev = 0.55 * e_rank + 0.45 * e_dens
        elev = gauss1d(elev, 1.5)

        # ---- the occupied support, hour by hour ---------------------------
        # Does the terrain WIDEN as development runs? Trim TAIL of each hour's
        # cells off each end and report what is left. The silhouette is drawn to
        # this, so if the range widens it is because the occupied part of the
        # axis widened — nothing is stretched to make it look that way.
        support = []
        for k in range(len(STAGES)):
            c = np.cumsum(dens[k]) / max(dens[k].sum(), 1e-12)
            a = int(np.searchsorted(c, TAIL))
            b = int(np.searchsorted(c, 1.0 - TAIL))
            support.append([a, min(NX - 1, max(a + 1, b))])
        widths = [(b - a) / (NX - 1.0) for a, b in support]
        print(f"  {axis_name}: occupied support {widths[0]:.0%} at {STAGES[0]} hpf -> "
              f"{widths[-1]:.0%} at {STAGES[-1]} hpf"
              + ("  (widens)" if widths[-1] > widths[0] else "  (does NOT widen)"))

        fields[axis_name] = {
            "lo": round(lo, 4), "hi": round(hi, 4),
            "elev": [[round(float(v), 4) for v in row] for row in elev],
            "support": support,
            "dens_max": round(float(dens.max()), 6),
        }

    # ---- wild-type channels ----------------------------------------------
    # One channel per state that is big enough to place: its x centroid at each
    # hour. These are the routes the terrain's basins lie along.
    names = sorted(set(sub.tolist()))
    channels = []
    for sname in names:
        m_state = sub == sname
        n = int(m_state.sum())
        if n < MIN_STATE:
            continue
        tt = pd.Series(tis[m_state]).value_counts()
        row = {"state": sname, "tissue": (tt.index[0] if len(tt) else None), "n": n, "pts": []}
        for k in range(len(STAGES)):
            m = m_state & (ti_cell == k)
            cnt = int(m.sum())
            row["pts"].append(None if cnt < 15 else
                              [round(float(xs[m].mean()), 4),
                               round(float(ys[m].mean()), 4), cnt])
        if sum(1 for p in row["pts"] if p) >= 3:
            channels.append(row)
    channels.sort(key=lambda r: -r["n"])
    print(f"  channels: {len(channels)} states with 3+ placeable hours")

    # ---- how many distinct states, hour by hour ---------------------------
    # The reader's intuition is that the range ought to WIDEN as development
    # runs, because there are more cell types later. The terrain cannot show
    # that: x is a fixed embedding coordinate, so its width is fixed by
    # construction and stretching it would move every position on the plate.
    #
    # So the growth is measured instead of drawn into the relief. Two numbers per
    # hour: how many states are present at all, and the EFFECTIVE number —
    # exp(Shannon entropy) of the state fractions, which is how many equally
    # abundant states would give the same diversity. The second is the honest
    # one; the first rises with sampling depth as much as with biology.
    diversity = []
    for k, hpf in enumerate(STAGES):
        m = ti_cell == k
        vc = pd.Series(sub[m]).value_counts()
        frac = (vc / vc.sum()).to_numpy(float)
        eff = float(np.exp(-(frac * np.log(frac)).sum()))
        diversity.append({"hpf": hpf, "n_cells": int(m.sum()),
                          "n_states": int((vc >= 15).sum()),
                          "effective_states": round(eff, 2)})
        print(f"    {hpf:>3} hpf  {int(m.sum()):>8,} cells  "
              f"{int((vc >= 15).sum()):>3} states  effective {eff:5.1f}")

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

    HOURS = [h for h in sorted(set(tp.tolist())) if h in STAGES]
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
            comp[(arm, h)] = np.bincount(ct_k[m], minlength=len(ct_c))

    # x position of a Platt state on the terrain, via the CELL-LEVEL crosswalk:
    # a Platt state inherits the x of the ZSCAPE states its cells actually carry,
    # weighted by how many. Many-to-many is preserved as a weighted mean rather
    # than resolved to a winner.
    xw = pd.read_csv(xw_path, sep="\t")
    ch_x = {c["state"]: c for c in channels}
    place = {}
    for pstate, g in xw.groupby("platt_state"):
        num1 = num2 = wsum = 0.0
        for r in g.itertuples():
            s = ch_x.get(r.zscape_state)
            if not s:
                continue
            pts = [p for p in s["pts"] if p]
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
    # first principal component ACROSS DRUGS. If eight different pathway
    # blockades reshape the landscape the same way, that shows up here; if they
    # do not, PC1 explains little and the page says so.
    #
    # It is a shared COMPOSITIONAL response. A shared transcriptional program —
    # stress, apoptosis and the rest — lives in the expression channel, which
    # this plate never opens.
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

    stage_fit = apparent_stage(comp, ct_c, HOURS)
    for d in sorted(stage_fit):
        bits = ", ".join(f"{h}->{v['apparent_hpf']:.1f}" for h, v in sorted(stage_fit[d].items()))
        print(f"  apparent stage  {d:<12} {bits}")

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
        "gap": list(GAP),
        "nx": NX,
        "fields": fields,
        "channels": channels[:56],
        "diversity": diversity,
        "chemfish": {
            "hours": HOURS,
            "vehicle": VEHICLE, "pathway": PATHWAY,
            "min_cells": MIN_CELLS_CF,
            "rows": cf.to_dict(orient="records"),
            "shared": shared,
            "stage_fit": stage_fit,
        },
        "caveat": "Elevation blends the within-hour RANK of wild-type cell density "
                  "with the within-hour normalised density, both inverted, so a basin "
                  "is where cells accumulate. Monotone but not proportional, and not "
                  "comparable between hours. It is an interpretive rendering of "
                  "transcriptomic state space — not anatomy, not a tracked lineage, "
                  "and nothing rolls down it.",
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
    if stage_fit:
        pd.DataFrame([dict(drug=d, hpf=int(h), **v)
                      for d, hh in stage_fit.items() for h, v in hh.items()]
                     ).to_csv(TABLES / "chemfish_apparent_stage.tsv", sep="\t", index=False)
    print(f"  wrote {WEB/'terrain.json'} "
          f"({(WEB/'terrain.json').stat().st_size/1024:.0f} KB) and the ChemFish tables")


if __name__ == "__main__":
    main()
