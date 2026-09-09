#!/usr/bin/env python3
"""Map Platt states into ZMAP, and compare the result against the ZSCAPE crosswalk.

THE CENTRAL CONSTRAINT, and the reason this looks nothing like the ZSCAPE pass:
ZMAP and Platt share NO CELLS. ZMAP integrates eight studies — Farnsworth2020,
Farrell2018, Kamimoto2023, Kukreja2024, Lange2023, Spanjaard2018, Sur2023,
Wagner2018 — and neither ZSCAPE nor Platt is among them. Its barcodes are a
different grammar entirely (`ZFOBLONG_WT_DS5_AGAAGGTCAGCG-3`). The cell-level
join that made the ZSCAPE crosswalk exact is simply unavailable here.

So this maps by EXPRESSION PROFILE instead, and says so everywhere:

    Platt state  -> mean log1p(CP10K) over ZMAP's HVG panel
    ZMAP state   -> mean of ZMAP's own log-normalised X over the same panel
    match        -> Spearman correlation between the two profiles

Spearman rather than Pearson because the two sides are normalised differently
and only the ordering is trustworthy across them. 2,251 of ZMAP's 2,411 highly
variable genes survive the ENSDARG-to-symbol bridge and are the shared space.

This is a WEAKER kind of evidence than the ZSCAPE crosswalk and must never be
presented as the same thing. A ZSCAPE match says "these are the same cells,
labelled twice". A ZMAP match says "these two populations look alike". The output
carries `method` on every row so the distinction survives into any downstream use.

PREREQUISITES (built by the scripts beside them in /data/scratch/platt_open):
    platt_state_pseudobulk.parquet      pseudobulk_platt.py
    zmap_pseudobulk_*.parquet           pseudobulk_zmap.py
    zmap_state_time.parquet             pseudobulk_zmap.py

Run:  python3 scripts/build_fate_map_24_48_zmap.py
"""

from __future__ import annotations

import collections
import json
import math
import pathlib
import sys

import numpy as np
import pandas as pd
from scipy.stats import rankdata

SCRATCH = pathlib.Path("/data/scratch/platt_open")
TABLES = pathlib.Path("/data/fate_map")
WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"

LEVELS = ["ZMAP_CellTypeFine", "ZMAP_CellType", "ZMAP_Tissue", "ZMAP_GermLayer"]
MIN_CELLS = 25          # below this a pseudobulk profile is mostly noise
TOP_N = 6               # matches kept per Platt state per level


def spearman_matrix(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    """Spearman correlation of every row of A against every row of B.

    Ranking each profile once and then taking Pearson on the ranks is the same
    number and is two orders of magnitude faster than looping.

    Args:
        A (np.ndarray): (n, g) profiles.
        B (np.ndarray): (m, g) profiles.

    Returns:
        np.ndarray: (n, m) correlations.
    """
    ra = np.apply_along_axis(rankdata, 1, A)
    rb = np.apply_along_axis(rankdata, 1, B)
    ra = (ra - ra.mean(1, keepdims=True)) / ra.std(1, keepdims=True)
    rb = (rb - rb.mean(1, keepdims=True)) / rb.std(1, keepdims=True)
    return (ra @ rb.T) / ra.shape[1]


def confidence(z_top: float, gap: float, n_cells: int) -> str:
    """Classify an expression-profile match against the state's OWN null.

    The first version of this thresholded raw Spearman at 0.55 and called 180 of
    185 states weak — while mapping cardiomyocyte to cardiac_muscle, notochord to
    notochord and hatching gland to hatching_gland. The thresholds were wrong, not
    the mapping. Cross-dataset pseudobulk profiles over 2,251 sparse genes are
    full of near-ties, which compresses Spearman toward the middle: the whole
    distribution sits around 0.43, so 0.51 is a strong match and 0.55 was an
    arbitrary line drawn in the wrong place.

    What discriminates is how far the best match sits above the OTHER matches for
    the same state. `z_top` is the top correlation expressed in standard
    deviations of that state's own correlations against every ZMAP state, which
    is self-calibrating and needs no global threshold. The raw rho is reported
    alongside so a z-score is never mistaken for a correlation.

    Args:
        z_top (float): top rho, in SDs above that state's mean rho to all ZMAP states.
        gap (float): top rho minus the runner-up's.
        n_cells (int): cells behind the Platt profile.

    Returns:
        str: `thin`, `ambiguous`, `weak`, `clear` or `strong`.
    """
    if n_cells < MIN_CELLS:
        return "thin"
    if gap < 0.01:
        return "ambiguous"
    if z_top >= 4.0 and gap >= 0.03:
        return "strong"
    if z_top >= 2.5:
        return "clear"
    return "weak"


def main() -> None:
    """Build the ZMAP crosswalk, compare it to ZSCAPE, and write everything.

    Raises:
        SystemExit: If a prerequisite pseudobulk is missing.
    """
    need = [SCRATCH / "platt_state_pseudobulk.parquet",
            SCRATCH / "zmap_state_time.parquet",
            TABLES / "platt_state_enrichment.json"]
    need += [SCRATCH / f"zmap_pseudobulk_{lv}.parquet" for lv in LEVELS]
    for p in need:
        if not p.exists():
            sys.exit(f"missing prerequisite: {p}\n  see public/fate_map_24_48/NOTES.md")

    # ZSCAPE germ layer per Platt state, from the CELL JOIN — the only axis on
    # which the two vocabularies can honestly be compared. Word overlap between
    # label strings is not one: ZSCAPE's "cardiomyocyte" and ZMAP's
    # "cardiac_muscle" are the same thing and share no token.
    pcd = pd.read_parquet(SCRATCH / "platt_coldata.parquet", columns=["orig_cell", "cell_type"])
    zo = pd.read_parquet(SCRATCH / "zscape_obs.parquet", columns=["cell", "germ_layer"])
    jj = pcd.dropna().merge(zo, left_on="orig_cell", right_on="cell", how="inner")
    zs_germ = (jj.groupby(["cell_type", "germ_layer"], observed=True).size()
                 .reset_index(name="n").sort_values("n", ascending=False)
                 .groupby("cell_type", observed=True).first())

    platt = pd.read_parquet(SCRATCH / "platt_state_pseudobulk.parquet")
    p_n = platt.pop("n_cells")
    genes = list(platt.columns)
    ztime = pd.read_parquet(SCRATCH / "zmap_state_time.parquet")
    enrich = json.loads((TABLES / "platt_state_enrichment.json").read_text())

    rows = []
    per_state: dict = collections.defaultdict(dict)
    for lv in LEVELS:
        z = pd.read_parquet(SCRATCH / f"zmap_pseudobulk_{lv}.parquet")
        z_n = z.pop("n_cells")
        z = z[genes]
        keep = z_n.values >= MIN_CELLS
        zk, zn, znames = z.values[keep], z_n.values[keep], list(z.index[keep])
        C = spearman_matrix(platt.values, zk)

        tmap = {r.zmap_state: r for r in ztime[ztime.level == lv].itertuples()}
        for i, name in enumerate(platt.index):
            order = np.argsort(-C[i])
            top = float(C[i, order[0]])
            second = float(C[i, order[1]]) if len(order) > 1 else float("nan")
            gap = top - second if not math.isnan(second) else float("nan")
            mu, sd = float(C[i].mean()), float(C[i].std())
            z_top = (top - mu) / sd if sd > 0 else 0.0
            conf = confidence(z_top, gap, int(p_n.iloc[i]))
            matches = []
            for j in order[:TOP_N]:
                zs = znames[j]
                t = tmap.get(zs)
                matches.append({
                    "zmap_state": zs, "rho": round(float(C[i, j]), 4),
                    "zmap_cells": int(zn[j]),
                    "hpf_q50": (None if t is None else t.hpf_q50),
                    "hpf_q25": (None if t is None else t.hpf_q25),
                    "hpf_q75": (None if t is None else t.hpf_q75),
                    "frac_in_window": (None if t is None else t.frac_in_window),
                })
                rows.append({"platt_state": name, "level": lv, "zmap_state": zs,
                             "rank": len(matches), "spearman_rho": round(float(C[i, j]), 4),
                             "zmap_cells": int(zn[j]), "platt_cells": int(p_n.iloc[i]),
                             "confidence": conf, "z_top": round(z_top, 2),
                             "method": "expression-profile Spearman"})
            per_state[name][lv] = {
                "matches": matches, "top_rho": round(top, 4),
                "z_top": round(z_top, 2),
                "null_mean_rho": round(mu, 4), "null_sd_rho": round(sd, 4),
                "gap_to_second": (None if math.isnan(gap) else round(gap, 4)),
                "confidence": conf,
            }

    xw = pd.DataFrame(rows)
    TABLES.mkdir(parents=True, exist_ok=True)
    xw.to_csv(TABLES / "crosswalk_platt_zmap.tsv", sep="\t", index=False)
    xw.to_parquet(TABLES / "crosswalk_platt_zmap.parquet", index=False)

    # ---- predicted developmental age, and whether it agrees with the observation
    # The age is ZMAP's own time_id distribution for the matched state, carried
    # across unchanged. It is a property of ZMAP's cells, not of Platt's, and the
    # match that carries it is a correlation — so it is doubly indirect and is
    # labelled that way wherever it appears.
    out = {}
    for name, lvl in per_state.items():
        fine = lvl["ZMAP_CellTypeFine"]
        best = fine["matches"][0] if fine["matches"] else None
        e = enrich.get(name, {})
        obs_peak = (e.get("observed") or {}).get("peak_hpf_in_window")
        pred = best["hpf_q50"] if best else None

        # ZSCAPE comparison. Two tests, and the second is the real one.
        zs = (e.get("zscape") or {})
        zs_top = (zs.get("matches") or [{}])[0].get("zscape_state")
        agree = None
        if zs_top and best:
            a = set(zs_top.lower().replace(",", " ").split())
            b = set(best["zmap_state"].lower().replace("_", " ").split())
            agree = "shared-term" if (a & b) else "no-shared-term"

        # Germ layer is the one axis both vocabularies carry. ZSCAPE's comes from
        # the cell join (observed), ZMAP's from the profile correlation
        # (inferred), so this compares the two mappings on comparable ground.
        # Both are folded to a coarse four-way first: ZSCAPE splits neural crest
        # out of ectoderm and ZMAP splits neurectoderm out of it, and neither
        # split is the other's.
        def fold(g):
            if not g:
                return None
            g = g.lower()
            if "endoderm" in g:
                return "endoderm"
            if "mesoderm" in g and "ectoderm" not in g:
                return "mesoderm"
            if "ectoderm" in g or "neural crest" in g or "neurectoderm" in g:
                return "ectoderm"
            return "other"
        zs_gl = fold(zs_germ.loc[name, "germ_layer"]) if name in zs_germ.index else None
        zm_gl_raw = (lvl["ZMAP_GermLayer"]["matches"] or [{}])[0].get("zmap_state")
        zm_gl = fold(zm_gl_raw)
        germ_agree = (None if (zs_gl is None or zm_gl is None)
                      else ("agree" if zs_gl == zm_gl else "disagree"))

        out[name] = {
            "method": "expression-profile Spearman over 2,251 ZMAP HVGs — NO shared cells",
            "platt_cells": int(p_n.loc[name]),
            "levels": lvl,
            "predicted_hpf": None if not best else {
                "q25": best["hpf_q25"], "q50": best["hpf_q50"], "q75": best["hpf_q75"],
                "frac_in_window": best["frac_in_window"],
                "from_zmap_state": best["zmap_state"],
                "note": "ZMAP's own time_id distribution for the matched state, "
                        "carried across a correlation — indirect twice over",
            },
            "vs_observed_peak": None if (pred is None or obs_peak is None) else {
                "observed_peak_hpf": obs_peak, "zmap_predicted_median_hpf": pred,
                "delta_hpf": round(float(pred) - float(obs_peak), 1),
            },
            "vs_zscape": {
                "zscape_top": zs_top, "zscape_confidence": zs.get("confidence"),
                "zmap_top": None if not best else best["zmap_state"],
                "zmap_confidence": fine["confidence"],
                "term_overlap": agree,
                "zscape_germ_layer": (None if name not in zs_germ.index
                                      else zs_germ.loc[name, "germ_layer"]),
                "zmap_germ_layer": zm_gl_raw,
                "germ_layer_agreement": germ_agree,
                "note": "germ layer is the only axis both vocabularies carry; the "
                        "ZSCAPE side is observed from shared cells and the ZMAP side "
                        "is inferred from a profile correlation",
            },
        }

    (TABLES / "platt_zmap_enrichment.json").write_text(json.dumps(out, indent=1))
    flat = pd.DataFrame([{
        "state": k, "platt_cells": v["platt_cells"],
        "zmap_fine_top": (v["levels"]["ZMAP_CellTypeFine"]["matches"] or [{}])[0].get("zmap_state"),
        "zmap_fine_rho": v["levels"]["ZMAP_CellTypeFine"]["top_rho"],
        "zmap_fine_z": v["levels"]["ZMAP_CellTypeFine"]["z_top"],
        "zmap_confidence": v["levels"]["ZMAP_CellTypeFine"]["confidence"],
        "zmap_tissue_top": (v["levels"]["ZMAP_Tissue"]["matches"] or [{}])[0].get("zmap_state"),
        "zmap_germlayer_top": (v["levels"]["ZMAP_GermLayer"]["matches"] or [{}])[0].get("zmap_state"),
        "predicted_hpf_q50": (v["predicted_hpf"] or {}).get("q50"),
        "observed_peak_hpf": (v["vs_observed_peak"] or {}).get("observed_peak_hpf"),
        "delta_hpf": (v["vs_observed_peak"] or {}).get("delta_hpf"),
        "zscape_top": v["vs_zscape"]["zscape_top"],
        "zscape_confidence": v["vs_zscape"]["zscape_confidence"],
        "term_overlap": v["vs_zscape"]["term_overlap"],
        "zscape_germ_layer": v["vs_zscape"]["zscape_germ_layer"],
        "zmap_germ_layer": v["vs_zscape"]["zmap_germ_layer"],
        "germ_layer_agreement": v["vs_zscape"]["germ_layer_agreement"],
    } for k, v in out.items()]).sort_values("state")
    flat.to_csv(TABLES / "platt_zmap_enrichment.tsv", sep="\t", index=False)
    flat.to_parquet(TABLES / "platt_zmap_enrichment.parquet", index=False)

    graph_states = [k for k, v in enrich.items() if v.get("in_graph")]
    web = {k: out[k] for k in graph_states if k in out}
    (WEB / "zmap.json").write_text(json.dumps(web, separators=(",", ":")))

    g = flat[flat.state.isin(graph_states)]
    conf = collections.Counter(g.zmap_confidence)
    ov = collections.Counter(g.term_overlap.dropna())
    d = g.delta_hpf.dropna()
    print(f"  crosswalk rows: {len(xw):,} over {xw.platt_state.nunique()} states x {len(LEVELS)} levels")
    print(f"  graph-state ZMAP confidence: {dict(conf)}")
    print(f"  ZSCAPE vs ZMAP top-label term overlap: {dict(ov)}")
    gl = collections.Counter(g.germ_layer_agreement.dropna())
    print(f"  germ-layer agreement (the meaningful test): {dict(gl)}")
    print(f"  predicted-vs-observed hpf delta: median {d.median():+.1f}, "
          f"|delta|<=6 for {(d.abs()<=6).sum()} of {len(d)}")
    print(f"  wrote {TABLES}/crosswalk_platt_zmap.* , platt_zmap_enrichment.* and "
          f"{WEB/'zmap.json'} ({(WEB/'zmap.json').stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
