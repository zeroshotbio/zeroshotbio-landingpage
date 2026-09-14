#!/usr/bin/env python3
"""Build the data behind /trailmaker_UI straight from Patrick's Trailmaker .rds files.

Every number on the page comes from one Seurat object per dataset: its cells, its replicate units
(the object's `samples` column), Patrick's hand-drawn `custom_cellset-*` columns and its RNA counts.
Nothing is matched to anything else: no Gold, no barcode join, no automatic labels, no transfer.

  dataset   object (local copy of the S3 upload)
  megafin   MegaFin part 1, plate CP01   /data/experiments/patrick_megafin_labels/megafin1_processed_matrix_PATRICK_LABELS.rds
  megafin2  MegaFin part 2, plate CP02   /data/experiments/patrick_megafin2_labels/megafin2_processed_matrix_PATRICK_LABELS.rds
  minifin   MiniFin                      /data/experiments/patrick_minifin_labels/minifin100k_processed_matrix_PATRICK_LABELS.rds

Step 1 (R, scripts/export_trailmaker_rds.R) reads an object and writes per-unit cell counts, per
(unit x set) cell counts and, per gene, how many of those cells express it. Step 2 (here) parses
drug and dose from the sample names, names the genes (the objects carry Ensembl ids; names come
from the Ensembl 99 GTF in s3://zsb-bronze-fortknox/reference/ensembl_99/, gene annotation only),
groups sets into tissues for filtering, picks a marker panel and writes:
  public/trailmaker_UI/data/<ds>.json     conditions, units, sets, counts[unit][set], gene panel, notes
  public/trailmaker_UI/data/<ds>/g<i>.bin uint16, units x sets: cells of that set in that unit expressing gene i

Usage:  /data/.venv/bin/python scripts/build_trailmaker_ui.py [--only megafin|megafin2|minifin] [--reexport]
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from trailmaker_ui_tissues import ORDER as TISSUE_ORDER, tissue_of  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "public", "trailmaker_UI", "data"))
EXPORT = "/data/scratch/trailmaker_rds"
GENE_NAMES = f"{EXPORT}/ensembl99_gene_names.tsv"   # gene_id \t gene_name, from Danio_rerio.GRCz11.99.gtf.gz
CONTEXT_GENES = ["kdrl", "flt1", "flt4", "pdgfrb", "kita", "mitfa", "hbba1", "myod1", "sox2",
                 "elavl3", "krt4", "gfap", "mki67", "pcna", "tp53", "cdkn1a", "mdm2", "hsp70l",
                 "fosab", "junba", "egr1", "braf", "raf1a", "ret"]

# ---------------------------------------------------------------- tissues (filtering only)
_MEGAFIN_TISSUE = {
    "CNS": "Neural", "Hindbrain": "Neural", "Midbrain": "Neural", "Forebrain": "Neural",
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
_MINIFIN_TISSUE = {
    "MHB": "Neural", "Schwann Cell Precursors": "Neural", "Muscle": "Muscle & heart",
    "Fast-Twitch Muscle": "Muscle & heart", "Slow-Twitch Muscle": "Muscle & heart",
    "Possible bipotent myoblast (myhc1+ and myl1+)": "Muscle & heart", "Goblet Cells": "Epidermis & epithelia",
    "Melanocytes": "Pigment",
}

DATASETS = {
    "megafin": {
        "rds": "/data/experiments/patrick_megafin_labels/megafin1_processed_matrix_PATRICK_LABELS.rds",
        "s3": "s3://zsb-bronze-archive/megafin/part1/patrick-labels/60a440dc-46a6-4a40-8250-dd35655317e0_processed_matrix.rds",
        "title": "MegaFin part 1 · Patrick's sets", "kind": "megafin", "part": 1,
        "tissue": _MEGAFIN_TISSUE, "umbrellas": {"CNS"},
        "extra_notes": ["The Intestine and Liver/hepatoblasts sets cover nearly the same cells (99.5% of Intestine lies inside Liver); read the two columns as one until they are redrawn."],
    },
    "megafin2": {
        "rds": "/data/experiments/patrick_megafin2_labels/megafin2_processed_matrix_PATRICK_LABELS.rds",
        "s3": "s3://zsb-bronze-archive/megafin/part2/patrick-labels/7c8414f7-06f6-47f0-9ba8-67f0d56c2b5d_processed_matrix.rds",
        "title": "MegaFin part 2 · Patrick's sets", "kind": "megafin", "part": 2,
        "tissue": _MEGAFIN_TISSUE, "umbrellas": {"CNS"},
        "extra_notes": ["The Intestine set lies wholly inside Liver/hepatoblasts, and every Cardiomyocytes cell also sits in Pectoral fin bud mesenchyme; those pairs are overlapping lassoes, so read each pair together until they are redrawn."],
    },
    "minifin": {
        "rds": "/data/experiments/patrick_minifin_labels/minifin100k_processed_matrix_PATRICK_LABELS.rds",
        "s3": "s3://zsb-bronze-archive/minifin/patrick-labels/processed-matrix-patrick-labels.rds",
        "title": "MiniFin · Patrick's sets", "kind": "minifin",
        "tissue": _MINIFIN_TISSUE, "umbrellas": {"CNS", "Muscle", "Lens"},
        "extra_notes": [],
    },
}

SAMPLE = re.compile(r"^m(\d)_([A-H]\d{1,2})_(CP0\d)_(.+?)(?:_(\d+(?:\.\d+)?)uM)?$")


def pretty_drug(p):
    return {"DMSO": "DMSO", "ctrl_no_DMSO": "No-DMSO control"}.get(p, p.replace("_", " "))


def parse_units(kind, units):
    """unit rows -> (plate, drug id, dose, control) per unit, read from the object's own labels."""
    out = []
    for r in units.itertuples():
        if kind == "megafin":
            mt = SAMPLE.match(r.unit)
            assert mt, f"unrecognised MegaFin sample name {r.unit!r}"
            _, _, plate, drug, dose = mt.groups()
            if drug.upper().startswith("DMSO"):
                drug, dose = "DMSO", None
            ctrl = drug in ("DMSO", "ctrl_no_DMSO")
            out.append((plate, drug, "" if ctrl else str(dose), ctrl))
        else:
            t = str(r.treatment)
            drug = "DMSO" if "DMSO" in t else t
            out.append(("MiniFin", drug, "", drug == "DMSO"))
    return out


def gene_names(genes):
    """Ensembl ids -> lower-case names (Ensembl 99); names kept as they are otherwise; made unique."""
    if sum(g.startswith("ENSDARG") for g in genes) > len(genes) / 2:
        m = dict(pd.read_csv(GENE_NAMES, sep="\t", header=None, names=["id", "name"]).values)
        names = [str(m.get(g) or g).lower() for g in genes]
    else:
        names = [g.lower() for g in genes]
    seen, out = {}, []
    for n in names:
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}.{seen[n]}")
    return out


def write_dataset(ds, meta, member_counts, C, genes, per_type):
    """Marker panel (per set: expressed in >= 20% of it, most specific against the rest) + context genes."""
    nunits, ntypes = member_counts.shape
    n_type = member_counts.sum(0)
    T = C.reshape(nunits, ntypes, -1).sum(0)
    tot, n_all = T.sum(0), member_counts.sum()
    bad = np.array([g.startswith(("mt-", "rps", "rpl", "si:", "zgc:")) for g in genes])
    chosen = []
    for t in range(ntypes):
        if n_type[t] < 30:
            continue
        fin = T[t] / n_type[t]
        fout = (tot - T[t]) / max(n_all - n_type[t], 1)
        score = np.where((fin >= 0.2) & ~bad, fin - fout, -1)
        for g in np.argsort(-score)[:per_type]:
            if score[g] > 0 and int(g) not in chosen:
                chosen.append(int(g))
    gi = {g: i for i, g in enumerate(genes)}
    chosen += [gi[g] for g in CONTEXT_GENES if g in gi and gi[g] not in chosen]
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
    print(f"  wrote {ds}.json ({os.path.getsize(os.path.join(OUT, ds + '.json')) / 1e3:.0f} kB) + {len(chosen)} gene files ({size / 1e6:.1f} MB)")


def build(ds, reexport=False):
    cfg = DATASETS[ds]
    d = os.path.join(EXPORT, ds)
    if reexport or not os.path.exists(os.path.join(d, "expr_counts.int32")):
        subprocess.run(["Rscript", os.path.join(HERE, "export_trailmaker_rds.R"), cfg["rds"], d], check=True)
    units = pd.read_csv(os.path.join(d, "units.csv"))
    sets = open(os.path.join(d, "sets.txt")).read().splitlines()
    genes = gene_names(open(os.path.join(d, "genes.txt")).read().splitlines())
    nu, ns, ng = len(units), len(sets), len(genes)
    mc = pd.read_csv(os.path.join(d, "member_counts.csv"))
    member_counts = mc.n.to_numpy().reshape(nu, ns)
    assert list(mc.unit[::ns]) == list(units.unit) and list(mc.set[:ns]) == sets
    C = np.fromfile(os.path.join(d, "expr_counts.int32"), dtype="<i4").reshape(nu * ns, ng).astype(np.float64)
    missing = [s for s in sets if s not in cfg["tissue"] and tissue_of(s) == "Unresolved"]
    assert not missing, f"no tissue for {missing}"

    parsed = parse_units(cfg["kind"], units)
    units["plate"], units["drug"], units["dose"], units["control"] = zip(*parsed)
    units["cond"] = np.where(units.control, units.drug, units.drug + "@" + units.dose)
    conds = []
    for cid, g in units.groupby("cond", sort=False):
        conds.append({"id": cid, "drug": pretty_drug(g.drug.iloc[0]), "dose": g.dose.iloc[0], "control": bool(g.control.iloc[0]),
                      "plate": "+".join(sorted(g.plate.unique())), "units": g.index.tolist()})
    conds.sort(key=lambda c: (not c["control"], c["drug"].lower(), c["dose"]))
    assert any(c["id"] == "DMSO" for c in conds), "no DMSO units found in the sample names"
    dmso_units = next(len(c["units"]) for c in conds if c["id"] == "DMSO")

    n_type = member_counts.sum(0)
    types = [{"name": s, "tissue": cfg["tissue"].get(s, tissue_of(s)), "n": int(n), "n_transfer": 0, "umbrella": s in cfg["umbrellas"]}
             for s, n in zip(sets, n_type)]
    order = sorted(range(ns), key=lambda i: (TISSUE_ORDER.index(types[i]["tissue"]), not types[i]["umbrella"], -types[i]["n"]))
    n_cells = int(units.n.sum())
    # Notes here are the ones specific to this dataset; the page carries the ones common to all three.
    counts_by = units.groupby("drug", sort=False).size()
    if cfg["kind"] == "megafin":
        plate = units.plate.iloc[0]
        missing_wells = 96 - nu
        notes = [
            f"Read from Patrick's Trailmaker Seurat object for MegaFin part {cfg['part']}: {cfg['s3']}. It holds {n_cells:,} cells in {nu} wells of plate {plate}"
            + (f" ({missing_wells} of the plate's 96 wells are not in the object)." if missing_wells > 0 else "."),
            f"{ns} hand-drawn cell sets; CNS is an umbrella over Forebrain, Midbrain and Hindbrain.",
            f"Each drug and dose is a single well, set against the plate's {dmso_units} DMSO wells. z is a robust z of each well against every well on the plate, so it does not move when the baseline changes.",
            *cfg["extra_notes"],
        ]
        z_method = "robust"
    else:
        reps = ", ".join(f"{pretty_drug(k)} {v}" for k, v in counts_by.items())
        notes = [
            f"Read from Patrick's Trailmaker Seurat object for MiniFin: {cfg['s3']}. It holds {n_cells:,} cells in {nu} samples ({reps}).",
            f"{ns} hand-drawn cell sets; CNS, Muscle and Lens are umbrellas over their sub-sets.",
            "Replicates are the object's samples, so z here is a Welch t of the drug's samples against the baseline's samples and does move with the baseline.",
        ]
        z_method = "welch"
    meta = {
        "dataset": ds, "title": cfg["title"], "baseline": "DMSO", "anchor": "Sorafenib",
        "source": cfg["s3"], "z_method": z_method,
        "tissues": [t for t in TISSUE_ORDER if any(x["tissue"] == t for x in types)],
        "types": types, "type_order": order,
        "units": [{"id": r.unit, "plate": r.plate, "n": int(r.n)} for r in units.itertuples()],
        "conds": conds,
        "labels": f"Patrick's {ns} hand-drawn Trailmaker cell sets, read straight from his Seurat object",
        "notes": notes,
    }
    print(f"{ds}: {n_cells:,} cells, {nu} units, {len(conds)} conditions ({dmso_units} DMSO units), {ns} sets, {ng} genes")
    write_dataset(ds, meta, member_counts, C, genes, per_type=6 if cfg["kind"] == "megafin" else 8)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(DATASETS))
    ap.add_argument("--reexport", action="store_true", help="re-read the .rds even if an export exists")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for ds in DATASETS:
        if a.only in (None, ds):
            build(ds, a.reexport)
    # a small index of every dataset, for the page-wide notes (order = the order of the dataset keys)
    idx = []
    for ds in ["minifin", "megafin", "megafin2"]:
        f = os.path.join(OUT, f"{ds}.json")
        if os.path.exists(f):
            m = json.load(open(f))
            idx.append({"dataset": ds, "title": m["title"], "source": m["source"], "cells": sum(u["n"] for u in m["units"]),
                        "units": len(m["units"]), "unit": "wells" if ds.startswith("megafin") else "samples",
                        "sets": len(m["types"]), "drugs": len({c["drug"] for c in m["conds"] if not c["control"]})})
    with open(os.path.join(OUT, "index.json"), "w") as fh:
        json.dump(idx, fh, separators=(",", ":"))
    print("wrote index.json:", [(d["dataset"], d["cells"], d["units"]) for d in idx])
