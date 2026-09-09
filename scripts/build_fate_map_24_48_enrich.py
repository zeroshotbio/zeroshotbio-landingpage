#!/usr/bin/env python3
"""Enrich each Platt state with 24-48 hpf quantitative context, and cross it to ZSCAPE.

This is the second pass over /fate_map_24_48. The first pass drew the graph from
three small files. This one opens the release's actual payload — the 1,220,178-cell
reference CDS — and attaches to every state what is *measured* about it, keeping
that visibly separate from what is *modelled*.

THE CROSSWALK IS NOT A STRING MATCH. The CDS carries `orig_cell`, which is the
same barcode ZSCAPE stores in `obs['cell']`. 1,059,836 of Platt's cells are
literally ZSCAPE cells re-annotated, so the Platt-to-ZSCAPE mapping is computed
from a contingency table over shared cells and reports its own ambiguity. Nothing
here is matched by name similarity, and no uncertain match is forced: a state
whose cells scatter across many ZSCAPE labels is reported as `split`, with every
component listed.

Provenance is carried per field. `observed` means a count of cells that exist.
`model` means a number a fitted model produced. They are never added together.

PREREQUISITE, and it is not cheap:
    /data/scratch/platt_open/platt_coldata.parquet   (see read_cds.R beside it)
    /data/scratch/platt_open/zscape_obs.parquet
Both are produced by the extraction step documented in
public/fate_map_24_48/NOTES.md § "Opening the reference".

Run:  python3 scripts/build_fate_map_24_48_enrich.py
"""

from __future__ import annotations

import collections
import csv
import json
import math
import pathlib
import re
import subprocess
import sys

import numpy as np
import pandas as pd

SCRATCH = pathlib.Path("/data/scratch/platt_open")
PLATT_CD = SCRATCH / "platt_coldata.parquet"
ZSCAPE_OBS = SCRATCH / "zscape_obs.parquet"
ABUND = pathlib.Path(
    "/data/datasets/zebrafish/Platt/sources/data/perturb_lmx1ba,lmx1bb_contrast_abundance.tsv"
)
RDS = pathlib.Path("/data/datasets/zebrafish/Platt/sources/data/combined_state_graphs.rds")

TABLES = pathlib.Path("/data/fate_map")          # reusable, for ZMAP/DanioCell later
WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"

WINDOW = list(range(24, 49, 2))                  # 24, 26, ... 48
MODEL_TP = [18, 24, 36, 48, 60, 72]


def norm(s: str) -> str:
    """Fold a state name to a comparison key.

    The release spells the same state three slightly different ways across its
    three files — `head and neck mesoderm (pax3+, pax7+)` in the graph and the
    CDS, `head/neck mesoderm (pax3+, pax7+)` in the abundance table. Folding
    slashes, hyphens and the word "and" reconciles 11 of them without merging any
    two distinct states (checked: no normalised key collides).

    Args:
        s (str): a state name as written in one of the files.

    Returns:
        str: the comparison key.
    """
    s = s.lower().replace("/", " ").replace("+", " plus ").replace("-", " ")
    s = re.sub(r"\band\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return " ".join(s.split())


def read_graph_vertices() -> list[str]:
    """Return the 186 vertex names of the inferred state graph, in graph order.

    Returns:
        list[str]: vertex names.

    Raises:
        SystemExit: If R or igraph is unavailable.
    """
    script = f"""
    suppressMessages(library(igraph))
    g <- readRDS({str(RDS)!r})
    cat(paste(V(g)$name, collapse="\\n"))
    """
    r = subprocess.run(["Rscript", "-e", script], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"reading {RDS} failed: {r.stderr.strip()}")
    return [x for x in r.stdout.split("\n") if x]


def entropy(fracs: list[float]) -> float:
    """Shannon entropy of a mapping, in bits.

    Zero means the state maps to exactly one ZSCAPE label. Higher means the
    state's cells scatter, and the mapping should not be treated as a rename.

    Args:
        fracs (list[float]): fractions summing to about 1.

    Returns:
        float: entropy in bits.
    """
    return -sum(f * math.log2(f) for f in fracs if f > 0)


def confidence(top: float, n_at_5: int, shared: int) -> str:
    """Classify a mapping rather than force it.

    Args:
        top (float): fraction of shared cells carrying the commonest ZSCAPE label.
        n_at_5 (int): how many ZSCAPE labels take at least 5% of the state.
        shared (int): number of cells the two annotations have in common.

    Returns:
        str: one of `unmapped`, `thin`, `unique`, `dominant`, `split`.
    """
    if shared == 0:
        return "unmapped"
    if shared < 30:
        return "thin"
    if top >= 0.80 and n_at_5 == 1:
        return "unique"
    if top >= 0.50:
        return "dominant"
    return "split"


def main() -> None:
    """Build the crosswalk and the per-state enrichment, and write both.

    Raises:
        SystemExit: If a prerequisite extraction is missing.
    """
    for p in (PLATT_CD, ZSCAPE_OBS, ABUND):
        if not p.exists():
            sys.exit(f"missing prerequisite: {p}\n  see public/fate_map_24_48/NOTES.md")

    verts = read_graph_vertices()
    platt = pd.read_parquet(PLATT_CD)
    z = pd.read_parquet(ZSCAPE_OBS, columns=["cell", "cell_type_sub", "cell_type_broad",
                                             "tissue", "germ_layer", "timepoint",
                                             "mean_nn_time"])

    # ---------------------------------------------------------------- crosswalk
    # orig_cell is the ZSCAPE barcode. This is a join, not a match.
    j = platt[["orig_cell", "cell_type"]].dropna().merge(
        z[["cell", "cell_type_sub", "cell_type_broad", "mean_nn_time"]],
        left_on="orig_cell", right_on="cell", how="inner")
    print(f"  shared cells: {len(j):,} of {len(platt):,} Platt cells "
          f"({100*len(j)/len(platt):.1f}%)")

    pairs = (j.groupby(["cell_type", "cell_type_sub"], observed=True)
               .size().rename("n_cells").reset_index())
    n_by_platt = pairs.groupby("cell_type", observed=True)["n_cells"].transform("sum")
    n_by_z = pairs.groupby("cell_type_sub", observed=True)["n_cells"].transform("sum")
    pairs["frac_of_platt_state"] = (pairs.n_cells / n_by_platt).round(5)
    pairs["frac_of_zscape_state"] = (pairs.n_cells / n_by_z).round(5)
    pairs["rank_in_platt_state"] = (pairs.groupby("cell_type", observed=True)["n_cells"]
                                    .rank(ascending=False, method="first").astype(int))
    pairs = pairs.sort_values(["cell_type", "rank_in_platt_state"])
    pairs = pairs.rename(columns={"cell_type": "platt_state", "cell_type_sub": "zscape_state"})

    # --------------------------------------------------------- observed context
    # Platt's own cells at its own 2-hour grid. These are counts of things that
    # exist, which is a different kind of number from the abundance model below.
    obs_ct = (platt.dropna(subset=["cell_type", "timepoint"])
                   .assign(timepoint=lambda d: d.timepoint.astype(int))
                   .groupby(["cell_type", "timepoint"], observed=True).size())
    tp_totals = platt.dropna(subset=["timepoint"]).timepoint.astype(int).value_counts()

    # Developmental time has to come from ZSCAPE, not from Platt. The CDS has a
    # mean_nn_time column and it is EMPTY — 550 of 1,220,178 cells carry a value.
    # ZSCAPE's is complete over all 3.2M of its cells, and the cell-level join
    # makes it attachable to a Platt state. It stays labelled model-derived,
    # because a nearest-neighbour time estimate is a model output either way.
    nn = j.dropna(subset=["cell_type", "mean_nn_time"]).groupby("cell_type", observed=True)
    nn_stats = nn["mean_nn_time"].agg(
        n="size", mean="mean", sd="std",
        q10=lambda s: s.quantile(0.10), q25=lambda s: s.quantile(0.25),
        q50="median", q75=lambda s: s.quantile(0.75), q90=lambda s: s.quantile(0.90))

    # ------------------------------------------------------------ model context
    model = collections.defaultdict(dict)
    for row in csv.DictReader(open(ABUND, encoding="utf-8"), delimiter="\t"):
        try:
            model[row["cell_group"]][int(row["timepoint"])] = float(row["log_abund_x"])
        except (ValueError, KeyError):
            continue
    model_by_key = {norm(k): v for k, v in model.items()}

    # --------------------------------------------------------------- assemble
    xw = {k: g for k, g in pairs.groupby("platt_state", observed=True)}
    states = sorted(set(platt.cell_type.dropna().unique()) | set(verts))
    out = {}
    for s in states:
        rec: dict = {"state": s, "in_graph": s in set(verts)}

        n_cells = int((platt.cell_type == s).sum())
        rec["n_cells_platt"] = n_cells

        counts = {int(t): int(obs_ct.get((s, t), 0)) for t in WINDOW}
        rec["observed"] = {
            "source": "Platt v2.2.1 reference CDS — counts of cells that exist",
            "grid_hpf": WINDOW,
            "cells_per_hpf": counts,
            "frac_of_timepoint": {t: round(counts[t] / int(tp_totals.get(t, 1)), 6) for t in WINDOW},
            "n_in_window": sum(counts.values()),
        }
        # Peak on the FRACTION, never on the raw count. Sampling depth inside the
        # window varies 16-fold (256,701 cells at 48 hpf against 15,727 at 44), so
        # a peak taken on counts would just rediscover which timepoints were
        # sequenced deepest.
        fr = rec["observed"]["frac_of_timepoint"]
        nzf = {t: v for t, v in fr.items() if v > 0}
        rec["observed"]["peak_hpf_in_window"] = max(nzf, key=nzf.get) if nzf else None
        rec["observed"]["peak_basis"] = "fraction of that timepoint's cells, not raw count"

        if s in nn_stats.index:
            r = nn_stats.loc[s]
            rec["dev_time"] = {
                "source": "ZSCAPE mean_nn_time over the shared cells — a per-cell "
                          "nearest-neighbour estimate, MODEL-DERIVED. Platt's own column "
                          "is populated for 550 of 1,220,178 cells and is unusable.",
                "n": int(r["n"]),
                **{k: (None if pd.isna(r[k]) else round(float(r[k]), 2))
                   for k in ("mean", "sd", "q10", "q25", "q50", "q75", "q90")},
            }
        else:
            rec["dev_time"] = None

        m = model.get(s) or model_by_key.get(norm(s))
        if m and all(t in m for t in MODEL_TP):
            rec["model_abundance"] = {
                "source": "lmx1b contrast, control arm (log_abund_x) — MODEL-DERIVED, fitted "
                          "over a complete grid, so it cannot say a state is absent",
                "grid_hpf": MODEL_TP,
                "log_abund": {t: round(m[t], 3) for t in MODEL_TP},
                "peak_hpf": max(MODEL_TP, key=lambda t: m[t]),
                "name_matched_by": "exact" if s in model else "normalised",
            }
        else:
            rec["model_abundance"] = None

        # A like-for-like check. The observed grid is 24-48 and the model grid is
        # 18-72, so comparing their peaks directly compares different questions.
        # Both are restricted to the three timepoints they share.
        SHARED_TP = [24, 36, 48]
        if m and all(t in m for t in SHARED_TP):
            of = {t: rec["observed"]["frac_of_timepoint"][t] for t in SHARED_TP}
            op = max(of, key=of.get) if any(of.values()) else None
            mp = max(SHARED_TP, key=lambda t: m[t])
            rec["peak_agreement"] = {"observed_peak_of_24_36_48": op,
                                     "model_peak_of_24_36_48": mp,
                                     "agree": (op is not None and op == mp)}
        else:
            rec["peak_agreement"] = None

        g = xw.get(s)
        if g is None or not len(g):
            rec["zscape"] = {"shared_cells": 0, "matches": [],
                             "confidence": "unmapped", "entropy_bits": None, "top_frac": None}
        else:
            shared = int(g.n_cells.sum())
            fr = g.frac_of_platt_state.tolist()
            n5 = int((g.frac_of_platt_state >= 0.05).sum())
            rec["zscape"] = {
                "source": "join on orig_cell — the SAME cells, two annotations. Not a name match.",
                "shared_cells": shared,
                "matches": [
                    {"zscape_state": r.zscape_state, "n": int(r.n_cells),
                     "frac_of_platt_state": float(r.frac_of_platt_state),
                     "frac_of_zscape_state": float(r.frac_of_zscape_state)}
                    for r in g.head(6).itertuples()
                ],
                "n_matches_total": int(len(g)),
                "n_matches_over_5pct": n5,
                "top_frac": round(float(fr[0]), 4),
                "entropy_bits": round(entropy(fr), 3),
                "confidence": confidence(float(fr[0]), n5, shared),
            }
        out[s] = rec

    # ------------------------------------------------------------------ write
    TABLES.mkdir(parents=True, exist_ok=True)
    pairs.to_csv(TABLES / "crosswalk_platt_zscape.tsv", sep="\t", index=False)
    pairs.to_parquet(TABLES / "crosswalk_platt_zscape.parquet", index=False)

    flat = []
    for s, r in out.items():
        row = {"state": s, "in_graph": r["in_graph"], "n_cells_platt": r["n_cells_platt"],
               "n_cells_24_48": r["observed"]["n_in_window"],
               "peak_hpf_observed": r["observed"]["peak_hpf_in_window"],
               "peak_hpf_model": (r["model_abundance"] or {}).get("peak_hpf"),
               "dev_time_median": (r["dev_time"] or {}).get("q50"),
               "zscape_shared_cells": r["zscape"]["shared_cells"],
               "zscape_top": (r["zscape"]["matches"] or [{}])[0].get("zscape_state"),
               "zscape_top_frac": r["zscape"]["top_frac"],
               "zscape_entropy_bits": r["zscape"]["entropy_bits"],
               "zscape_n_matches": r["zscape"].get("n_matches_total", 0),
               "mapping_confidence": r["zscape"]["confidence"]}
        row.update({f"cells_{t}hpf": r["observed"]["cells_per_hpf"][t] for t in WINDOW})
        flat.append(row)
    fl = pd.DataFrame(flat).sort_values("state")
    fl.to_csv(TABLES / "platt_state_enrichment.tsv", sep="\t", index=False)
    fl.to_parquet(TABLES / "platt_state_enrichment.parquet", index=False)
    (TABLES / "platt_state_enrichment.json").write_text(json.dumps(out, indent=1))

    # the web page only needs the 186 graph states, and only the fields it draws
    web = {s: out[s] for s in verts if s in out}
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "enrich.json").write_text(json.dumps(web, separators=(",", ":")))

    agree = [r["peak_agreement"] for s, r in out.items()
             if r["in_graph"] and r["peak_agreement"]]
    n_agree = sum(1 for a in agree if a["agree"])
    print(f"  observed and model peak agree on 24/36/48 for {n_agree} of {len(agree)} graph states")
    conf = collections.Counter(r["zscape"]["confidence"] for s, r in out.items() if r["in_graph"])
    missing_cds = [v for v in verts if v not in out or out[v]["n_cells_platt"] == 0]
    no_model = [v for v in verts if v in out and out[v]["model_abundance"] is None]
    print(f"  crosswalk rows: {len(pairs):,}  covering {pairs.platt_state.nunique()} Platt states")
    print(f"  enrichment rows: {len(fl)} states ({sum(fl.in_graph)} of them in the graph)")
    print(f"  graph-state mapping confidence: {dict(conf)}")
    print(f"  graph states with no cells in the CDS: {missing_cds}")
    print(f"  graph states with no model abundance: {no_model}")
    print(f"  wrote {TABLES}/ and {WEB/'enrich.json'} "
          f"({(WEB/'enrich.json').stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
