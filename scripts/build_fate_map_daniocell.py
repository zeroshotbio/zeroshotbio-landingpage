#!/usr/bin/env python3
"""Build the /fate_map_daniocell dataset: 489,686 cells of wild-type zebrafish
from 3.3 to 120 hpf, from the DanioCell atlas (Sur et al. 2023).

WHAT THIS PAGE IS, AND WHAT IT IS NOT:
  /fate_map_wang_2026 draws PHYSICAL ANCESTRY — a tracked nucleus per stroke.
  This page draws TRANSCRIPTIONAL IDENTITY, and the two must never be spoken of
  in the same language. Nothing here is lineage. Two cells adjacent in the UMAP
  are similar in expression; that is all. DanioCell carries no lineage tracing,
  and the one pseudotime object on the page (Plate IV) is an INFERRED
  trajectory, not an observed one.

  Concretely, the words that are banned on this page: descends from, ancestor,
  daughter, lineage, born. The words that are correct: state, identity,
  program, trajectory, inferred.

THE MEASURE THAT IS EASIEST TO MISREPRESENT — persistence:
  `persistence.avg.stage.diff` is NOT how long a cluster exists. It is a
  PER-CELL statistic: for each cell, the authors found the cells within a fixed
  distance (epsilon) in gene-expression space and took the mean ABSOLUTE
  developmental-stage difference between that cell and those neighbours. It
  answers "how far apart in developmental time are the cells that look like
  this one", and it was computed WITHIN tissue subsets, not globally.
  So every cluster carries a DISTRIBUTION of it, not a value.

  This build therefore emits both, kept apart and named apart:
    span_*        the OBSERVED extent — when cells of this cluster are seen.
    persistence_* the AUTHORS' MEASURE — the epsilon-neighbourhood statistic.
  The page draws the first as ribbon length and the second as ink. Do not let
  them collapse into one quantity.

THE TRAP IN TABLE S6:
  The iSMC sheet is named "iSMCs_circular_longitudinal" and its columns are
  ordered the OTHER WAY ROUND. Read as a branch identity, the name is wrong.
  The pseudotime header is non-monotonic and falls into three runs — a shared
  trunk and two branches — and marker expression at the branch tips settles
  which is which: branch A carries il13ra2 (0.95 vs 0.07) so it is the putative
  LONGITUDINAL layer, branch B carries fsta / kcnk18 / foxf2a (0.87 / 0.92 /
  0.87) so it is the CIRCULAR layer. Both markers are the paper's own
  (Figure 5G, 5I). This script re-derives that assignment every run rather than
  hard-coding it, and fails loudly if the markers stop agreeing.

Inputs (read-only; mirrored in s3://zsb-silver-warehouse/daniocell/):
  {SRC}/extracted/umap_global.csv     489,686 x (cell, UMAP_1, UMAP_2)
  {SRC}/extracted/meta_extra.csv      the Seurat object's own metadata
  {SRC}/raw/GSE223922_Sur2023_metadata.tsv.gz   persistence + cell cycle
  {SRC}/s3/portal/2024_08_release/cluster_annotations.csv
  {SRC}/s3/Paper/mmc6.xlsx            Table S5 — gene expression programs
  {SRC}/s3/Paper/mmc7.xlsx            Table S6 — URD cascades
  The embeddings come from Daniocell2023_SeuratV4.rds via
  scripts/extract_daniocell_seurat.R (R is needed once, never again).

Outputs (public/fate_map_daniocell/):
  meta.json      counts, stages, tissues, and every caveat the page prints
  cells.bin      the 489,686-cell embedding + per-cell time/tissue/cluster
  clusters.json  Plate II — one record per transcriptional state
  programs.json  Plate III — the shared gene expression programs
  cascades.json  Plate IV — the two inferred trajectories
"""
from __future__ import annotations

import csv
import gzip
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np

SRC = Path("/data/scratch/daniocell")
OUT = Path(__file__).resolve().parent.parent / "public" / "fate_map_daniocell"

UMAP_CSV = SRC / "extracted" / "umap_global.csv"
SEURAT_META = SRC / "extracted" / "meta_extra.csv"
GEO_META = SRC / "raw" / "GSE223922_Sur2023_metadata.tsv.gz"
ANNOT = SRC / "s3" / "portal" / "2024_08_release" / "cluster_annotations.csv"
TAB_S5 = SRC / "s3" / "Paper" / "mmc6.xlsx"
TAB_S6 = SRC / "s3" / "Paper" / "mmc7.xlsx"

XY_SCALE = 1000.0          # UMAP units -> int16 hundredths-of-a-milli
SPAN_Q = (0.02, 0.98)      # a state's observed extent, as /dev_tree does it
LONG_TERM_H = 36.0         # the authors' threshold for a "long-term" state

# The 19 tissue subsets the atlas is reclustered into, plus `cephalic`, which
# has cells and no subset UMAP and no annotation row. It is kept and marked
# rather than dropped, the same way /dev_tree keeps it.
CANON_TISSUES = [
    "blastomeres", "periderm", "epidermis", "neural", "glial", "eye", "otic",
    "taste", "axial", "muscle", "mural", "mesenchyme", "fin", "hematopoietic",
    "endoderm", "pronephros", "ionocytes", "pigment", "pgc", "cephalic",
]

# Table S5's "Tissue(s) expressed" is curated free text: 51 distinct tokens for
# 19 tissues, plus prose. Everything on the left maps to a canonical subset;
# everything in BROAD_TOKENS is a statement of breadth rather than a tissue and
# becomes a flag on the module, never an edge. Anything unmatched stops the
# build rather than being silently dropped.
TISSUE_ALIASES = {
    "neural": "neural", "neurons": "neural",
    "glial-cells": "glial", "glial_cells": "glial", "glia": "glial",
    "endoderm": "endoderm", "mesendoderm": "endoderm", "intestine": "endoderm",
    "liver": "endoderm", "exocrine pancreas": "endoderm",
    "hematopoietic": "hematopoietic", "hematopoietic cells": "hematopoietic",
    "eye": "eye", "fin": "fin", "pronephros": "pronephros",
    "mesenchyme": "mesenchyme",
    "axial mesoderm": "axial", "axial-mesoderm": "axial",
    "periderm": "periderm", "periderm/evl": "periderm",
    "mural-cells": "mural",
    "basal epidermis": "epidermis", "epidermis": "epidermis",
    "muscle": "muscle", "non-skeletal muscle": "muscle",
    "taste-olfactory": "taste", "taste_olfactory": "taste",
    "taste_epithelia": "taste", "taste epithelia": "taste",
    "otic": "otic", "otic/lateral-line": "otic", "otic_lateral-line": "otic",
    "pigment-cells": "pigment",
    "ionocytes": "ionocytes", "ionocytes_mucous-secreting": "ionocytes",
    "ionocyte_mucous-secreting": "ionocytes",
    "pgcs": "pgc",
    "gastrula": "blastomeres", "blastula": "blastomeres",
}
BROAD_TOKENS = {
    "lots of tissues", "many", "a lot of tissues", "all others", "many tissues",
    "almost all others", "almost all tissues",
    "many tissues (almost all epithelial cells)",
    "periderm + lots of other tissues",
    "early dividing cells and many other proliferative populations",
    "scattered and non-specific", "unknown? ysl?",
}

# Marker genes the paper uses to tell the two iSMC layers apart (Fig 5G, 5I).
ISMC_MARKERS = {
    "circular": ["fsta", "kcnk18", "foxq1a", "foxq1b", "foxf2a"],
    "longitudinal": ["il13ra2"],
}


def load_cells():
    """Per-cell embedding, time, tissue and cluster, joined on the cell id."""
    print("reading embedding ...", flush=True)
    cells, xy = [], []
    with open(UMAP_CSV) as fh:
        next(fh)
        for line in fh:
            c, x, y = line.rstrip("\n").split(",")
            cells.append(c); xy.append((float(x), float(y)))
    xy = np.asarray(xy)
    idx = {c: i for i, c in enumerate(cells)}
    n = len(cells)
    print(f"  {n:,} cells")

    print("reading the object's metadata ...", flush=True)
    hpf = np.full(n, np.nan)
    tissue = np.full(n, -1, np.int16)
    cluster = np.empty(n, object)
    tmap = {t: i for i, t in enumerate(CANON_TISSUES)}
    with open(SEURAT_META) as fh:
        for row in csv.DictReader(fh):
            i = idx.get(row["cell"])
            if i is None:
                sys.exit("meta_extra.csv holds a cell the embedding does not")
            hpf[i] = float(row["hpf"])
            t = row["subset.full"].strip()
            if t not in tmap:
                sys.exit(f"unknown subset.full {t!r} — CANON_TISSUES is stale")
            tissue[i] = tmap[t]
            cluster[i] = row["cluster"]

    print("reading the GEO metadata ...", flush=True)
    pers = np.full(n, np.nan)
    cyc = np.zeros(n, bool)
    with gzip.open(GEO_META, "rt") as fh:
        cols = fh.readline().rstrip("\n").split("\t")
        ci = {c: k for k, c in enumerate(cols)}
        for line in fh:
            f = line.rstrip("\n").split("\t")
            i = idx.get(f[0])
            if i is None:
                sys.exit("the GEO metadata holds a cell the embedding does not")
            v = f[ci["persistence.avg.stage.diff"]]
            pers[i] = float(v) if v else np.nan
            cyc[i] = f[ci["cell.cycle.class"]] == "cycling"
    if np.isnan(hpf).any() or (tissue < 0).any():
        sys.exit("some cells got no hpf or no tissue — the join is incomplete")
    return cells, xy, hpf, tissue, cluster, pers, cyc


def load_annotations():
    with open(ANNOT, encoding="utf-8-sig") as fh:
        return {r["clust"]: r for r in csv.DictReader(fh)}


def build_clusters(cluster, hpf, pers, cyc, tissue, annot):
    """One record per transcriptional state, for Plate II.

    span_* and persistence_* are different measurements and are kept apart —
    see the module docstring.
    """
    order = np.argsort(cluster.astype(str), kind="stable")
    cl = cluster.astype(str)[order]
    bounds = [0] + list(np.flatnonzero(cl[1:] != cl[:-1]) + 1) + [len(cl)]
    out = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        sel = order[a:b]
        name = cl[a]
        h = hpf[sel]
        p = pers[sel][~np.isnan(pers[sel])]
        rec = annot.get(name, {})
        out.append({
            "id": name,
            "tissue": CANON_TISSUES[int(np.bincount(tissue[sel]).argmax())],
            "n": int(len(sel)),
            # OBSERVED extent: when cells of this state are actually seen.
            "span_lo": round(float(np.quantile(h, SPAN_Q[0])), 2),
            "span_hi": round(float(np.quantile(h, SPAN_Q[1])), 2),
            "span_first": round(float(h.min()), 2),
            "span_last": round(float(h.max()), 2),
            "span_median": round(float(np.median(h)), 2),
            # AUTHORS' MEASURE: the epsilon-neighbourhood stage spread.
            "persistence_median": round(float(np.median(p)), 2) if len(p) else None,
            "persistence_q1": round(float(np.quantile(p, 0.25)), 2) if len(p) else None,
            "persistence_q3": round(float(np.quantile(p, 0.75)), 2) if len(p) else None,
            "long_term_frac": round(float((p >= LONG_TERM_H).mean()), 3) if len(p) else None,
            "cycling_frac": round(float(cyc[sel].mean()), 3),
            "identity": (rec.get("identity.super") or "").strip(),
            "identity_sub": (rec.get("identity.sub") or "").strip(),
            "zfa": (rec.get("zfin") or "").strip(),
            "annotated": name in annot,
        })
    return out


def build_programs():
    import openpyxl
    wb = openpyxl.load_workbook(TAB_S5, read_only=True)
    rows = [r for r in wb.worksheets[0].iter_rows(values_only=True)]
    hdr = rows[0]; ix = {h: i for i, h in enumerate(hdr)}
    data = [r for r in rows[1:] if r and r[0]]
    mods, unmatched = [], set()
    for r in data:
        toks = [t.strip() for t in re.split(r"[,;]", str(r[ix["Tissue(s) expressed"]] or "")) if t.strip()]
        tis, broad = [], False
        for t in toks:
            k = t.lower()
            if k in BROAD_TOKENS:
                broad = True
            elif k in TISSUE_ALIASES:
                v = TISSUE_ALIASES[k]
                if v not in tis:
                    tis.append(v)
            else:
                unmatched.add(t)
        genes = [g.strip() for g in str(r[ix["Top loaded genes"]] or "").split(",") if g.strip()]
        mods.append({
            "id": str(r[ix["Module"]]),
            "desc": str(r[ix["Module description"]] or "").strip(),
            "shared": str(r[ix["Shared?"]]).strip() == "Y",
            "excluded": str(r[ix["Exclude?"]]).strip(),
            "tissues": tis,
            "broad": broad,
            "celltypes": str(r[ix["Cell type(s) expressed"]] or "").strip(),
            "genes": genes[:14],
            "n_genes": len(genes),
        })
    wb.close()
    if unmatched:
        sys.exit(f"unmapped tissue tokens in Table S5 — extend TISSUE_ALIASES: {sorted(unmatched)}")
    return mods


def build_cascades():
    """The two inferred trajectories, split into trunk and branches.

    The pseudotime header is non-monotonic where one run ends and the next
    begins; that is how the branching is encoded, and it is read here rather
    than assumed.
    """
    import openpyxl
    wb = openpyxl.load_workbook(TAB_S6, read_only=True)
    out = {}
    for ws in wb.worksheets:
        rows = [r for r in ws.iter_rows(values_only=True)]
        pt = [float(c) for c in rows[0][1:] if c is not None]
        genes = [str(r[0]) for r in rows[1:] if r[0]]
        mat = np.array([[float(v) if v is not None else np.nan for v in r[1:1 + len(pt)]]
                        for r in rows[1:] if r[0]], dtype=np.float64)
        drops = [i for i in range(len(pt) - 1) if pt[i + 1] < pt[i]]
        segs, s = [], 0
        for d in drops:
            segs.append((s, d + 1)); s = d + 1
        segs.append((s, len(pt)))
        key = "ismc" if "iSMC" in ws.title else "best4"
        out[key] = {"sheet": ws.title, "genes": genes, "pseudotime": pt,
                    "segments": segs, "matrix": mat}
        print(f"  {key}: {len(genes)} genes x {len(pt)} pseudotime points, "
              f"{len(segs)} run(s) {[f'{a}-{b-1}' for a, b in segs]}")
    wb.close()

    # Name the two iSMC branches from marker expression at their tips, and
    # refuse to guess if the markers disagree — the sheet's own name has them
    # the other way round.
    ism = out["ismc"]
    if len(ism["segments"]) == 3:
        gi = {g: i for i, g in enumerate(ism["genes"])}
        def tip(seg, gene):
            if gene not in gi:
                return np.nan
            v = ism["matrix"][gi[gene], seg[0]:seg[1]]
            v = v[~np.isnan(v)]
            return float(v[-5:].mean()) if len(v) else np.nan
        labels = []
        for seg in ism["segments"][1:]:
            c = np.nanmean([tip(seg, g) for g in ISMC_MARKERS["circular"]])
            l = np.nanmean([tip(seg, g) for g in ISMC_MARKERS["longitudinal"]])
            labels.append(("circular", c, l) if c > l else ("longitudinal", c, l))
        names = [x[0] for x in labels]
        if sorted(names) != ["circular", "longitudinal"]:
            sys.exit(f"iSMC branch markers do not separate the branches: {labels}")
        ism["branch_labels"] = ["trunk"] + names
        print(f"  ismc branches assigned from markers: {names} "
              f"(circular/longitudinal marker means {[(round(c,2), round(l,2)) for _, c, l in labels]})")
    else:
        ism["branch_labels"] = ["trunk"]
    out["best4"]["branch_labels"] = ["trajectory"]
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cells, xy, hpf, tissue, cluster, pers, cyc = load_cells()
    annot = load_annotations()
    n = len(cells)

    stages = sorted(set(hpf.tolist()))
    stage_ix = {s: i for i, s in enumerate(stages)}
    print(f"  {len(stages)} distinct collected stages, {stages[0]}-{stages[-1]} hpf")

    clusters = build_clusters(cluster, hpf, pers, cyc, tissue, annot)
    cl_ids = [c["id"] for c in clusters]
    cl_ix = {c: i for i, c in enumerate(cl_ids)}
    print(f"  {len(clusters)} transcriptional states; "
          f"{sum(1 for c in clusters if not c['annotated'])} without an annotation row")

    # ---- cells.bin: widest elements first, 16-byte header ------------------
    with open(OUT / "cells.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"DCEL", 1, n, len(stages)))
        fh.write(np.round(xy[:, 0] * XY_SCALE).astype("<i2").tobytes())
        fh.write(np.round(xy[:, 1] * XY_SCALE).astype("<i2").tobytes())
        fh.write(np.array([cl_ix[c] for c in cluster.astype(str)], "<u2").tobytes())
        fh.write(np.array([stage_ix[h] for h in hpf.tolist()], "<u1").tobytes())
        fh.write(tissue.astype("<u1").tobytes())

    programs = build_programs()
    n_shared = sum(1 for m in programs if m["shared"])
    n_edges = sum(len(m["tissues"]) for m in programs if m["shared"])
    print(f"  {len(programs)} gene programs; {n_shared} shared; {n_edges} program-tissue edges")

    print("reading the cascades ...")
    casc = build_cascades()
    casc_out = {}
    for k, v in casc.items():
        m = np.nan_to_num(v["matrix"], nan=0.0)
        m = np.clip(m, 0, 1)
        casc_out[k] = {
            "sheet": v["sheet"], "genes": v["genes"],
            "pseudotime": [round(p, 4) for p in v["pseudotime"]],
            "segments": v["segments"], "branch_labels": v["branch_labels"],
            # peak position orders the genes into a cascade when drawn
            "peak": [int(i) for i in m.argmax(1)],
            "values": [[int(round(x * 255)) for x in row] for row in m],
        }

    (OUT / "clusters.json").write_text(json.dumps(clusters, separators=(",", ":")))
    (OUT / "programs.json").write_text(json.dumps(programs, separators=(",", ":")))
    (OUT / "cascades.json").write_text(json.dumps(casc_out, separators=(",", ":")))

    tissue_counts = {t: int((tissue == i).sum()) for i, t in enumerate(CANON_TISSUES)}
    meta = {
        "generated_by": "scripts/build_fate_map_daniocell.py",
        "source": {
            "paper": "Sur, Wang, Capar, Margolin, Prochaska & Farrell, Single-cell analysis "
                     "of shared signatures and transcriptional diversity during zebrafish "
                     "development",
            "journal": "Developmental Cell 58, 3028-3047.e12 (2023)",
            "doi": "10.1016/j.devcel.2023.11.001",
            "geo": "GSE223922",
            "portal": "https://daniocell.nichd.nih.gov",
            "code": "https://github.com/farrelllab/2023_Sur",
            "code_doi": "10.5281/zenodo.10048114",
            "embedding_from": "Daniocell2023_SeuratV4.rds (portal, 2024-08 release), "
                              "sha256 754043e7878e8594b9c3044b69268bad9ec4652d685f90ce6c34a2ea15ea72f9",
            "warehouse": "s3://zsb-silver-warehouse/daniocell/",
        },
        "counts": {
            "cells": n,
            "stages": len(stages),
            "clusters": len(clusters),
            "tissues": len(CANON_TISSUES),
            "programs": len(programs),
            "programs_shared": n_shared,
            "program_tissue_edges": n_edges,
            "cells_cycling": int(cyc.sum()),
            "cells_long_term": int((pers >= LONG_TERM_H).sum()),
        },
        "stages": [round(s, 2) for s in stages],
        "tissues": [{"key": t, "cells": tissue_counts[t]} for t in CANON_TISSUES],
        "xy_scale": XY_SCALE,
        "long_term_hours": LONG_TERM_H,
        "span_quantiles": list(SPAN_Q),
        "caveats": [
            "Nothing on this page is lineage. DanioCell carries no lineage tracing. Two "
            "cells near each other in the embedding are similar in expression, which is a "
            "statement about identity and not about ancestry.",
            "Persistence is not a lifetime. It is a per-cell statistic: the mean absolute "
            "developmental-stage difference between a cell and its neighbours within a "
            "fixed distance in gene-expression space, computed within tissue subsets. A "
            "state's ribbon length here is the separate, observed quantity - when its "
            "cells are actually seen.",
            "The embedding is one fixed 2D projection of the whole atlas. Distances in it "
            "are not quantitative, and a population that appears to move is a population "
            "whose expression changed, not one that travelled.",
            "Plate IV is an inferred trajectory. URD reconstructs it from expression "
            "alone; no cell in it was observed turning into another.",
            "The programs on Plate III come from the authors' curated free-text "
            "annotation of each module, normalised onto the 19 tissue subsets by this "
            "script. Modules the authors described in prose as broad are marked as such "
            "rather than given invented edges.",
        ],
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    for p in ("meta.json", "cells.bin", "clusters.json", "programs.json", "cascades.json"):
        print(f"  wrote {p}  {(OUT / p).stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
