#!/usr/bin/env python3
"""Build the data behind /trailmaker_UI from the Gold MegaFin and MiniFin releases.

Inputs, all local (provenance in /data/scratch/gold_labels/out/README.md):
  MegaFin  Gold  megafin/zsb/v1/megafin.h5ad          1,268,343 cells; only plate CP01 is used
           labels out/megafin_zsb_v1_patrick_labels.parquet   Patrick's 27 hand-drawn cell sets on CP01
                  (from the Trailmaker export in s3://zsb-bronze-archive/megafin/part1/patrick-labels/;
                  extraction + id bridge: /data/experiments/patrick_megafin_labels/README.md)
  MiniFin  Gold  minifin/zsb/v2/minifin.h5ad          89,788 cells
           labels out/minifin_zsb_v2_labels.parquet   Patrick's 27 hand-drawn cell sets

Both datasets use ONLY Patrick's hand-drawn labels. No automatic labeller output and no label
transfer: a cell he did not put in a set stays unlabelled and counts only in its well's total.
MegaFin part 1 (CP01) and part 2 (CP02) were labelled in separate Trailmaker projects and are
built as two datasets, "megafin" and "megafin2".

Writes public/trailmaker_UI/data/:
  <ds>.json           conditions, replicate units, cell types, counts[unit][type], gene panel, notes
  <ds>/g<i>.bin       uint16, units x types, row-major: cells of that type in that unit with >= 1
                      count of gene i. The page divides by counts[unit][type] for "% expressing".

Usage:  /data/.venv/bin/python scripts/build_trailmaker_ui.py [--only megafin|minifin]
"""
import argparse
import datetime
import json
import os
import sys
import time
from multiprocessing import get_context

import h5py
import numpy as np
import pandas as pd
import scipy.sparse as sp

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from trailmaker_ui_tissues import ORDER as TISSUE_ORDER, tissue_of  # noqa: E402

WORK = "/data/scratch/gold_labels"
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "trailmaker_UI", "data"))
CONTEXT_GENES = ["kdrl", "flt1", "flt4", "pdgfrb", "kita", "mitfa", "hbba1", "myod1", "sox2",
                 "elavl3", "krt4", "gfap", "mki67", "pcna", "tp53", "cdkn1a", "mdm2", "hsp70l",
                 "fosab", "junba", "egr1", "braf", "raf1a", "ret"]


# ---------------------------------------------------------------- h5ad reading (h5py only; the
# box's anndata is too old for Gold's null-encoded .uns, and we never need the whole object)
def dec(a):
    return np.array([x.decode() if isinstance(x, bytes) else x for x in a], dtype=object)


def col(g):
    if isinstance(g, h5py.Group):
        if "categories" in g:
            cats, codes = dec(g["categories"][:]), g["codes"][:]
            out = np.full(len(codes), None, dtype=object)
            out[codes >= 0] = cats[codes[codes >= 0]]
            return out
        if "values" in g:
            v = g["values"][:]
            v = dec(v) if v.dtype.kind in "OSU" else v.astype(object)
            if "mask" in g:
                v[g["mask"][:]] = None
            return v
        raise ValueError(f"unknown obs encoding {list(g.keys())}")
    a = g[:]
    return dec(a) if a.dtype.kind in "OS" else a


def frame_index(f, frame):
    g = f[frame]
    return col(g[g.attrs.get("_index", "_index")])


# ---------------------------------------------------------------- one pass over X
_G = {}


def _count_chunk(rng):
    """codes x genes: for each membership code (unit*ntypes+type), cells with X > 0 per gene."""
    r0, r1 = rng
    with h5py.File(_G["path"], "r") as f:
        X = f["X"]
        ip = X["indptr"][r0:r1 + 1].astype(np.int64)
        a, b = int(ip[0]), int(ip[-1])
        idx, dat = X["indices"][a:b], X["data"][a:b]
    rows = np.repeat(np.arange(r1 - r0), np.diff(ip))
    keep = dat > 0
    Xb = sp.csr_matrix((np.ones(int(keep.sum()), np.float32), (rows[keep], idx[keep])),
                       shape=(r1 - r0, _G["nvars"]))
    return (_G["member"][r0:r1].T @ Xb).tocsr()


def count_expressing(path, member, nvars, chunk=20000, procs=32):
    with h5py.File(path, "r") as f:
        enc = f["X"].attrs.get("encoding-type", "")
        assert enc == "csr_matrix", f"X is {enc!r}; this pass reads CSR rows"
        n = f["X"]["indptr"].shape[0] - 1
    _G.update(path=path, member=member.tocsr(), nvars=nvars)
    ranges = [(r, min(r + chunk, n)) for r in range(0, n, chunk)]
    acc = None
    t = time.time()
    with get_context("fork").Pool(procs) as pool:
        for i, part in enumerate(pool.imap_unordered(_count_chunk, ranges), 1):
            acc = part if acc is None else acc + part
            if i % 10 == 0 or i == len(ranges):
                print(f"    X pass: {i}/{len(ranges)} chunks, {time.time() - t:.0f}s", flush=True)
    return np.asarray(acc.todense(), dtype=np.float64)


# ---------------------------------------------------------------- shared assembly
def write_dataset(ds, meta, member_counts, C, genes, per_type, n_cells_type):
    nunits, ntypes = member_counts.shape
    T = C.reshape(nunits, ntypes, -1).sum(0)
    tot = T.sum(0)
    n_all = member_counts.sum()
    chosen = []
    bad = np.array([g.startswith(("mt-", "rps", "rpl")) or g.startswith("si:") or g.startswith("zgc:")
                    for g in genes])
    for t in range(ntypes):
        nt = n_cells_type[t]
        if nt < 30:
            continue
        fin = T[t] / nt
        fout = (tot - T[t]) / max(n_all - nt, 1)
        score = np.where((fin >= 0.2) & ~bad, fin - fout, -1)
        for g in np.argsort(-score)[:per_type]:
            if score[g] > 0 and g not in chosen:
                chosen.append(int(g))
    gi = {g: i for i, g in enumerate(genes)}
    for g in CONTEXT_GENES:
        if g in gi and gi[g] not in chosen:
            chosen.append(gi[g])
    chosen.sort(key=lambda i: genes[i])
    gdir = os.path.join(OUT, ds)
    os.makedirs(gdir, exist_ok=True)
    for old in os.listdir(gdir):
        os.remove(os.path.join(gdir, old))
    Cg = C.reshape(nunits, ntypes, -1)
    for j, g in enumerate(chosen):
        arr = Cg[:, :, g]
        assert arr.max() < 65536
        arr.astype("<u2").tofile(os.path.join(gdir, f"g{j}.bin"))
    meta["genes"] = [genes[i] for i in chosen]
    meta["counts"] = member_counts.astype(int).tolist()
    meta["built"] = datetime.date.today().isoformat()
    with open(os.path.join(OUT, f"{ds}.json"), "w") as fh:
        json.dump(meta, fh, separators=(",", ":"))
    size = sum(os.path.getsize(os.path.join(gdir, x)) for x in os.listdir(gdir))
    print(f"  wrote {ds}.json ({os.path.getsize(os.path.join(OUT, ds + '.json')) / 1e3:.0f} kB) "
          f"+ {len(chosen)} gene files ({size / 1e6:.1f} MB)")


def pretty_drug(p):
    return {"DMSO": "DMSO", "ctrl_no_DMSO": "No-DMSO control"}.get(p, p.replace("_", " "))


# ---------------------------------------------------------------- MegaFin parts 1 and 2 (Patrick's sets)
# Each plate was labelled in its own Trailmaker project, so each is its own dataset: the set names do
# not line up one to one ("Floor plate" / "Floorplate", "Sclerotome (axial mesenchyme)" /
# "Sclerotome/axial mesenchyme", ...), and merging them would be a naming decision, not a join.
_NEURAL = ["CNS", "Hindbrain", "Midbrain", "Forebrain"]
MEGAFIN_TISSUE = {
    **{n: "Neural" for n in _NEURAL},
    "Floor plate": "Neural", "Floorplate": "Neural",
    "Schwann cells/peripheral glia": "Neural", "Schwann cell precursors/peripheral glia": "Neural",
    "Otic vesicle": "Ear", "Lens": "Eye",
    "Superficial epidermis": "Epidermis & epithelia", "Basal epidermis": "Epidermis & epithelia",
    "Hatching gland": "Epidermis & epithelia",
    "Erythrocytes": "Blood & immune", "Macrophages": "Blood & immune", "Neutrophils": "Blood & immune",
    "Fast twitch muscle": "Muscle & heart", "Slow twitch muscle": "Muscle & heart", "Cardiomyocytes": "Muscle & heart",
    "Sclerotome (axial mesenchyme)": "Mesenchyme & skeleton", "Sclerotome/axial mesenchyme": "Mesenchyme & skeleton",
    "Pectoral fin bud mesenchyme": "Mesenchyme & skeleton", "Notochord": "Mesenchyme & skeleton",
    "Vascular endothelial cells": "Vasculature",
    "Melanocytes/melanophores/melanoblasts": "Pigment", "Melanocytes/melanophores": "Pigment",
    "Pronephros (early kidney)": "Kidney", "Pronephros/early kidney": "Kidney",
    "Liver/hepatoblasts": "Gut & liver", "Intestine": "Gut & liver", "Exocrine pancreas": "Gut & liver",
    "Endocrine pancreas (Islet)": "Endocrine", "Endocrine pancreas/islet": "Endocrine",
}
MEGAFIN_UMBRELLAS = {"CNS"}
MEGAFIN_PARTS = {
    1: {"ds": "megafin", "plate": "CP01", "labels": "megafin_zsb_v1_patrick_labels.parquet",
        "source": "s3://zsb-bronze-archive/megafin/part1/patrick-labels/60a440dc-46a6-4a40-8250-dd35655317e0_processed_matrix.rds",
        "extra_notes": [
            "The Intestine and Liver/hepatoblasts sets cover nearly the same cells (99.5% of Intestine lies inside Liver); read the two columns as one until they are redrawn.",
        ]},
    2: {"ds": "megafin2", "plate": "CP02", "labels": "megafin_zsb_v1_patrick2_labels.parquet",
        "source": "s3://zsb-bronze-archive/megafin/part2/patrick-labels/7c8414f7-06f6-47f0-9ba8-67f0d56c2b5d_processed_matrix.rds",
        "extra_notes": [
            "The Intestine set lies wholly inside Liver/hepatoblasts, and every Cardiomyocytes cell also sits in Pectoral fin bud mesenchyme; those pairs are overlapping lassoes, so read each pair together until they are redrawn.",
        ]},
}


def build_megafin(part=1):
    cfg = MEGAFIN_PARTS[part]
    plate = cfg["plate"]
    path = f"{WORK}/megafin_zsb_v1.h5ad"
    print(f"MegaFin part {part} ({plate}):", path)
    with h5py.File(path, "r") as f:
        ids = frame_index(f, "obs")
        o = f["obs"]
        obs = pd.DataFrame({c: col(o[c]) for c in ["perturbation", "dose", "plate", "well"]})
        genes = list(frame_index(f, "var"))
    lab = pd.read_parquet(f"{WORK}/out/{cfg['labels']}", columns=["cell_id", "patrick_labels"])
    assert (lab.cell_id.values == ids).all(), "label sidecar is not in Gold order"
    on = (obs.plate == plate).values
    sets = lab.patrick_labels.fillna("").map(lambda s: [x.strip() for x in s.split(";") if x.strip()])
    assert not sets[~on].map(len).any(), f"a cell off {plate} carries a part {part} label"
    names = sorted({x for s in sets for x in s})
    missing = [n for n in names if n not in MEGAFIN_TISSUE]
    assert not missing, f"no tissue for {missing}"
    code = {n: i for i, n in enumerate(names)}
    nt = len(names)
    obs["unit"] = obs.plate.astype(str) + ":" + obs.well.astype(str)
    obs["dose"] = obs.dose.astype(str)
    sub = obs[on]
    units = sub.groupby("unit", sort=True).agg(plate=("plate", "first"), perturbation=("perturbation", "first"),
                                                dose=("dose", "first"), n=("plate", "size")).reset_index()
    assert (sub.groupby("unit").perturbation.nunique() == 1).all()
    controls = {"DMSO", "ctrl_no_DMSO"}
    units["cond"] = np.where(units.perturbation.isin(controls), units.perturbation, units.perturbation + "@" + units.dose)
    conds = []
    for cid, g in units.groupby("cond", sort=False):
        p = g.perturbation.iloc[0]
        ctrl = p in controls
        conds.append({"id": cid, "drug": pretty_drug(p), "dose": "" if ctrl else g.dose.iloc[0],
                      "control": ctrl, "plate": "+".join(sorted(g.plate.unique())), "units": g.index.tolist()})
    conds.sort(key=lambda c: (not c["control"], c["drug"].lower(), c["dose"]))
    uindex = {u: i for i, u in enumerate(units.unit)}
    ucode = obs.unit.map(uindex)
    r, c = [], []
    for i in np.flatnonzero(on):
        u = int(ucode.iat[i])
        for x in sets.iat[i]:
            r.append(i)
            c.append(u * nt + code[x])
    member = sp.csr_matrix((np.ones(len(r), np.float32), (r, c)), shape=(len(ids), len(units) * nt))
    member_counts = np.asarray(member.sum(0)).reshape(len(units), nt)
    n_type = member_counts.sum(0)
    types = [{"name": n, "tissue": MEGAFIN_TISSUE[n], "n": int(a), "n_transfer": 0, "umbrella": n in MEGAFIN_UMBRELLAS}
             for n, a in zip(names, n_type)]
    order = sorted(range(nt), key=lambda i: (TISSUE_ORDER.index(types[i]["tissue"]), not types[i]["umbrella"], -types[i]["n"]))
    n_on = int(on.sum())
    unl = int((sets[on].map(len) == 0).sum())
    other = "CP02 (MegaFin part 2)" if part == 1 else "CP01 (MegaFin part 1)"
    meta = {
        "dataset": cfg["ds"], "title": f"MegaFin part {part} · Patrick's sets", "baseline": "DMSO", "anchor": "Sorafenib",
        "source": f"s3://zsb-gold-library/megafin/zsb/v1/megafin.h5ad (plate {plate})",
        "z_method": "robust",
        "tissues": [t for t in TISSUE_ORDER if any(x["tissue"] == t for x in types)],
        "types": types, "type_order": order,
        "units": [{"id": r.unit, "plate": r.plate, "n": int(r.n)} for r in units.itertuples()],
        "conds": conds,
        "labels": f"Patrick's {nt} hand-drawn Trailmaker cell sets on MegaFin part {part} (plate {plate}), joined to Gold by barcode",
        "notes": [
            f"Cell types are Patrick's hand-drawn Trailmaker cell sets on MegaFin part {part} ({cfg['source']}), joined to the Gold cells by barcode. They overlap by design: CNS is an umbrella over Forebrain, Midbrain and Hindbrain, so a column is the share of all cells in that set and columns do not sum to 100%.",
            f"Only plate {plate} is on this plate. {other} was labelled in a separate Trailmaker project whose set names do not line up one to one, so it is its own dataset on this page rather than merged in.",
            f"{unl:,} of {n_on:,} {plate} Gold cells carry no set (left blank, or absent from his object); they stay in every denominator.",
            "Each drug and dose is one well, compared with the plate's two DMSO wells. z is a robust z of the well against every well on the plate.",
            *cfg["extra_notes"],
            "Expert labels are evaluation data for the labeller; nothing here feeds it.",
        ],
    }
    print(f"  {len(units)} wells, {len(conds)} conditions, {nt} cell sets, {unl:,} of {n_on:,} {plate} cells unlabelled; X pass for gene counts")
    C = count_expressing(path, member, len(genes))
    write_dataset(cfg["ds"], meta, member_counts, C, genes, per_type=6, n_cells_type=n_type)


# ---------------------------------------------------------------- MiniFin (Patrick's sets)
MINIFIN_TISSUE = {
    "MHB": "Neural", "Schwann Cell Precursors": "Neural", "Muscle": "Muscle & heart",
    "Fast-Twitch Muscle": "Muscle & heart", "Slow-Twitch Muscle": "Muscle & heart",
    "Possible bipotent myoblast (myhc1+ and myl1+)": "Muscle & heart", "Goblet Cells": "Epidermis & epithelia",
    "Melanocytes": "Pigment",
}
UMBRELLAS = {"CNS", "Muscle", "Lens"}


def build_minifin():
    path = f"{WORK}/minifin_zsb_v2.h5ad"
    print("MiniFin:", path)
    with h5py.File(path, "r") as f:
        ids = frame_index(f, "obs")
        o = f["obs"]
        obs = pd.DataFrame({c: col(o[c]) for c in ["perturbation", "parse_sample"]})
        genes = list(frame_index(f, "var"))
    lab = pd.read_parquet(f"{WORK}/out/minifin_zsb_v2_labels.parquet", columns=["cell_id", "patrick_labels"])
    assert (lab.cell_id.values == ids).all(), "label sidecar is not in Gold order"
    sets = lab.patrick_labels.fillna("").map(lambda s: [x.strip() for x in s.split(";") if x.strip()])
    names = sorted({x for s in sets for x in s})
    code = {n: i for i, n in enumerate(names)}
    obs["unit"] = obs.parse_sample.astype(str)
    units = obs.groupby("unit", sort=True).agg(perturbation=("perturbation", "first"), n=("unit", "size")).reset_index()
    assert (obs.groupby("unit").perturbation.nunique() == 1).all()
    uindex = {u: i for i, u in enumerate(units.unit)}
    ucode = obs.unit.map(uindex).values
    nt = len(names)
    r, c = [], []
    for i, s in enumerate(sets):
        for x in s:
            r.append(i)
            c.append(ucode[i] * nt + code[x])
    member = sp.csr_matrix((np.ones(len(r), np.float32), (r, c)), shape=(len(ids), len(units) * nt))
    member_counts = np.asarray(member.sum(0)).reshape(len(units), nt)
    n_type = member_counts.sum(0)
    conds = []
    for p, g in units.groupby("perturbation", sort=False):
        conds.append({"id": p, "drug": p, "dose": "", "control": p == "DMSO", "plate": "MiniFin",
                      "units": g.index.tolist()})
    conds.sort(key=lambda c: (not c["control"], c["drug"].lower()))
    types = [{"name": n, "tissue": MINIFIN_TISSUE.get(n, tissue_of(n)), "n": int(a), "n_transfer": 0,
              "umbrella": n in UMBRELLAS} for n, a in zip(names, n_type)]
    order = sorted(range(nt), key=lambda i: (TISSUE_ORDER.index(types[i]["tissue"]),
                                             not types[i]["umbrella"], -types[i]["n"]))
    unl = int((sets.map(len) == 0).sum())
    meta = {
        "dataset": "minifin", "title": "MiniFin · Patrick's labels", "baseline": "DMSO", "anchor": "Sorafenib",
        "source": "s3://zsb-gold-library/minifin/zsb/v2/minifin.h5ad",
        "z_method": "welch",
        "tissues": [t for t in TISSUE_ORDER if any(x["tissue"] == t for x in types)],
        "types": types, "type_order": order,
        "units": [{"id": r.unit, "plate": "MiniFin", "n": int(r.n)} for r in units.itertuples()],
        "conds": conds,
        "labels": "Patrick's 27 hand-drawn Trailmaker cell sets (expert ground truth), joined to Gold by barcode",
        "notes": [
            "Cell types are Patrick's hand-drawn cell sets. They overlap by design: CNS, Muscle and Lens are umbrellas over their sub-sets, so a column is the share of all cells in that set and columns do not sum to 100%.",
            f"{unl:,} of {len(ids):,} Gold cells carry no set (left blank on purpose, or absent from his object); they stay in every denominator.",
            "Replicates are Parse samples. z is a Welch t of the drug's sample proportions against the DMSO samples.",
            "Expert labels are evaluation data for the labeller; nothing here feeds it.",
        ],
    }
    print(f"  {len(units)} samples, {len(conds)} conditions, {nt} cell sets; X pass for gene counts")
    C = count_expressing(path, member, len(genes), procs=16)
    write_dataset("minifin", meta, member_counts, C, genes, per_type=8, n_cells_type=n_type)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["megafin", "megafin2", "minifin"])
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.only in (None, "minifin"):
        build_minifin()
    if a.only in (None, "megafin"):
        build_megafin(1)
    if a.only in (None, "megafin2"):
        build_megafin(2)
