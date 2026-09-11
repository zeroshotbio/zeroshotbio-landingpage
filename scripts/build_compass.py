#!/usr/bin/env python3
"""Build /compass — a plate-style essay on the COMPASS shared-response result, reproduced.

Reads the finished reproduction in /data/scratch/compass_repro (git-tracked; see its
COMPASS_REPRODUCTION.md and reproduction_meta.json) and writes the two files the page draws from:

  public/compass/meta.json    every number the prose prints, the paper's own published values
                              (cited by table/section), provenance, caveats
  public/compass/plates.json  the arrays the plates draw

Nothing here re-analyses anything. The analysis lives in the reproduction repo's scripts
(stages 0-13); this script only selects, summarises and serialises its outputs. The paper's
numbers are constants below, each tagged with where in Liang & Singh 2026 it is printed.

Run:  python3 scripts/build_compass.py
"""
from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import subprocess
import time

import numpy as np

REPRO = pathlib.Path("/data/scratch/compass_repro")
RES = REPRO / "results"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "compass"
LINES = ["K562", "RPE1", "HepG2", "Jurkat", "HCT116", "HEK293T"]
RN = ["K562", "RPE1", "HepG2", "Jurkat"]

# ---- The paper's published values (Liang & Singh 2026, bioRxiv 10.64898/2026.08.03.742643 v1) ----
PAPER = {
    "W": {"1000": [0.590, 0.524, 0.587], "2000": [0.587, 0.533, 0.588], "5000": [0.562, 0.546, 0.581]},   # §2.5, Table 5
    "pairwise_r_ams": [0.50, 0.38, 0.50],                                                              # §2.5
    "spearman_m_a": {"HEK293T": 0.41, "HepG2": 0.82},                                                  # §2.4 (range ends)
    "s_pairs": {"RPE1_HepG2": 0.66, "HepG2_HCT116": 0.62, "K562_RPE1": 0.41},                         # §2.5
    "beta_pairs": {"K562_RPE1": 0.50, "K562_HepG2": 0.54, "K562_Jurkat": 0.56, "RPE1_HepG2": 0.66,
                   "RPE1_Jurkat": 0.54, "HepG2_Jurkat": 0.53, "HCT116_HEK293T": 0.56},               # Table 13
    "transfer_beta": {"K562": 0.61, "RPE1": 0.70, "HepG2": 0.71, "Jurkat": 0.62, "X-Atlas": 0.56},     # Tables 2, 9
    "transfer_g": {"K562": 0.22, "RPE1": 0.22, "HepG2": 0.21, "Jurkat": 0.21, "X-Atlas": 0.09},
    "betabar_sbar": [0.88, 0.90],                                                                      # §2.8, Table 8
    "table3": {  # de-biased Pearson delta / cosine PDS gain, per line in LINES order
        "CompassX": ([0.33, 0.43, 0.40, 0.32, 0.12, 0.12], [0.25, 0.30, 0.22, 0.24, 0.18, 0.19]),
        "source average": ([0.28, 0.37, 0.35, 0.26, 0.10, 0.08], [0.25, 0.32, 0.24, 0.23, 0.18, 0.16]),
        "training mean": ([0.26, 0.55, 0.36, 0.24, 0.19, 0.09], [0.0] * 6)},
    "budget": {"n": [10, 130], "pearson": [0.253, 0.288], "pds": 0.24},                               # §2.10, Fig. 4
    "anchor": 2270, "group_panel_overlap": 282,
}

# Design facts for Zeroshot's own screens, from the zsb-bronze READMEs (minifin/, megafin/).
ZEROSHOT = {
    "MiniFin": {"perturbations": 3, "conditions": "DMSO + Sorafenib + 2 test drugs", "replicates": "12 wells per condition",
                "cells": 94864, "median_umis": 3198, "context": "whole embryos, 48 hpf", "controls": "DMSO wells"},
    "MegaFin": {"perturbations": 182, "conditions": "91 drugs x 2 doses (5 and 1 uM), 2 plates x 96 wells",
                "replicates": "one well per drug-dose", "cells": 1347643, "median_umis": 3130, "context": "whole embryos; cell types share wells",
                "controls": "one DMSO well per dose per plate + 2 wells where the planned drug was never dispensed"},
}


def tsv(name):
    with open(RES / name) as f:
        return list(csv.DictReader(f, delimiter="\t"))


def jload(name, base=RES):
    return json.load(open(base / name))


def f(x, nd=3):
    return None if x in (None, "", "nan") else round(float(x), nd)


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def reproduction():
    C = tsv("geometry_crossline.tsv")
    W = {}
    for anchor, key in (("paper-matched symbol anchor", "paper_anchor"), ("2,317 Ensembl anchor", "ensembl_anchor")):
        W[key] = {}
        for panel in ("1000", "2000", "5000"):
            rows = {r["quantity"]: r for r in C if r["anchor"] == anchor and r["panel"] == panel}
            W[key][panel] = {"W": [f(rows[q]["kendalls_W"]) for q in "ams"], "r": [f(rows[q]["mean_pairwise_pearson"]) for q in "ams"],
                             "all_positive": all(rows[q]["all_positive"] == "True" for q in "ams"), "n": int(rows["a"]["n_perturbations"])}
    srow = next(r for r in C if r["anchor"] == "paper-matched symbol anchor" and r["panel"] == "2000" and r["quantity"] == "s")
    s_pairs = {k[2:]: f(v) for k, v in srow.items() if k.startswith("r_")}
    G = {r["line"]: r for r in tsv("geometry_line_summary.tsv")}
    beta_pairs = {f"{r['a']}_{r['b']}": {"r": f(r["pearson_beta"]), "same_group": r["same_group"] == "True"} for r in tsv("beta_conservation_ensembl.tsv")}
    T = {}
    for tag in ("ensembl", "symbol"):
        T[tag] = {r["held_out"]: {"beta": f(r["beta_transfer_r"]), "g": f(r["g_transfer_r"]), "g_shuffled": f(r["g_transfer_r_shuffled"])}
                  for r in tsv(f"transfer_loco_{tag}.tsv")}
    B = tsv("compassx_benchmark_ensembl.tsv")
    bench = {}
    for m in ("CompassX", "source average", "training mean"):
        bench[m] = {"pearson": [f(np.mean([float(r["debiased_pearson"]) for r in B if r["method"] == m and r["target"] == l])) for l in LINES],
                    "pds": [f(np.mean([float(r["pds_gain"]) for r in B if r["method"] == m and r["target"] == l])) for l in LINES]}
    Bu = tsv("compassx_budget.tsv"); ns = sorted({int(r["n_train"]) for r in Bu})
    budget = {m: {"n": ns, "pearson": [f(np.mean([float(r["debiased_pearson"]) for r in Bu if r["method"] == m and int(r["n_train"]) == n])) for n in ns],
                  "pds": [f(np.mean([float(r["pds_gain"]) for r in Bu if r["method"] == m and int(r["n_train"]) == n])) for n in ns]}
              for m in ("CompassX", "source average", "training mean")}
    stats = jload("decomposition_stats_ensembl.json")
    return {"W": W, "s_pairs": s_pairs, "spearman_m_a": {l: f(G[l]["spearman_m_a_2000"]) for l in LINES},
            "beta_pairs": beta_pairs, "transfer": T, "bench": bench, "budget": budget,
            "betabar_sbar": [f(stats["pearson_betabar_RN_vs_sbar"]), f(stats["spearman_betabar_RN_vs_sbar"])],
            "kendall_W_beta_all6": f(stats["kendalls_W_beta_all6"])}


def decomposition():
    D = {r["line"]: r for r in tsv("decomposition_summary_ensembl.tsv")}
    sim = tsv("pair_similarity_ensembl.tsv")
    St = tsv("stress_per_line.tsv")
    A = {l: [r for r in St if r["line"] == l and r["condition"] == "A:independent halves"] for l in LINES}
    mean = lambda rows, k: f(np.mean([float(r[k]) for r in rows]))
    conf = {r["line"]: r for r in tsv("crispr_confounding.tsv")}
    return {"per_line": {l: {"energy": f(D[l]["energy_on_axis"]), "cos": f(D[l]["median_cos_alignment"]), "beta_pos": f(D[l]["frac_beta_positive"]),
                             "split_cos_u": mean(A[l], "cos_u"), "split_beta_r": mean(A[l], "beta_r"), "split_residual_r": mean(A[l], "split_residual_r_median"),
                             "noise_ratio": f(float(D[l]["median_norm"]) / np.mean([float(r["control_noise_norm"]) for r in A[l]]), 2),
                             "rho_beta_cells": f(conf[l]["rho_beta_ncells"], 2), "rho_beta_lib": f(conf[l]["rho_beta_libsize_ratio"], 2)} for l in LINES},
            "pairs": [{"a": r["a"], "b": r["b"], "raw_same": f(r["raw_same"]), "raw_random": f(r["raw_random"]),
                       "res_same": f(r["residual_same"]), "res_random": f(r["residual_random"]), "u_cos": f(r["u_cosine"])} for r in sim]}


def stress():
    St = tsv("stress_per_line.tsv")
    pick = lambda cond, key: {l: [(f(r["level"], 4), f(r[key])) for r in St if r["line"] == l and r["condition"] == cond] for l in LINES}
    Cons = tsv("stress_conservation.tsv")
    cons = lambda prefix: [(r["level"], f(r["cons_r_Replogle/Nadig"]), f(r["cons_r_X-Atlas"])) for r in Cons if r["condition"].startswith(prefix)]
    ph = tsv("phase_summary.tsv"); ks = list(dict.fromkeys(r["k"] for r in ph)); ns = list(dict.fromkeys(int(r["n"]) for r in ph))
    grid = [[f(next(r["conservation_Replogle/Nadig"] for r in ph if int(r["n"]) == n and r["k"] == k)) for k in ks] for n in ns]
    gridX = [[f(next(r["conservation_X-Atlas"] for r in ph if int(r["n"]) == n and r["k"] == k)) for k in ks] for n in ns]
    fid = [[f(next(r["fidelity_beta_r"] for r in ph if int(r["n"]) == n and r["k"] == k)) for k in ks] for n in ns]
    dp = tsv("depth_sweep.tsv"); fs = sorted({float(r["f"]) for r in dp}, reverse=True)
    depth = {"f": fs, "library": [f(np.median([float(r["median_library"]) for r in dp if float(r["f"]) == x]), 0) for x in fs],
             "cons_RN": [f(next(r["conservation_Replogle/Nadig"] for r in dp if float(r["f"]) == x)) for x in fs],
             "cons_XA": [f(next(r["conservation_X-Atlas"] for r in dp if float(r["f"]) == x)) for x in fs],
             "split_cos": [f(np.median([float(r["split_cos_u"]) for r in dp if float(r["f"]) == x])) for x in fs],
             "beta_rel": [f(np.median([float(r["split_beta_r"]) for r in dp if float(r["f"]) == x])) for x in fs],
             "vs_full": [f(np.median([float(r["beta_r_vs_full"]) for r in dp if float(r["f"]) == x])) for x in fs]}
    return {"detect_split_cos": pick("B:perturbations used for the axis", "split_cos_AB"),
            "detect_null": pick("B:perturbations used for the axis", "null_cos_AB_p95"),
            "detect_frac": pick("B:perturbations used for the axis", "detectable"),
            "cells_beta_r": pick("C:max cells per perturbation", "beta_r_own"),
            "remove_top_cos": pick("D:remove top-loading %", "cos_u"),
            "remove_top_cons": cons("D:remove top-loading"),
            "cells_cons": cons("C:"),
            "controls_cos": {l: {r["condition"][2:]: f(r["cos_u"]) for r in St if r["line"] == l and r["condition"].startswith("H:")} for l in LINES},
            "controls_cons": {r["condition"][2:]: [f(r["cons_r_Replogle/Nadig"]), f(r["cons_r_X-Atlas"])] for r in Cons if r["condition"].startswith("H:")},
            "growth_cos": {r["condition"][2:]: {l: f(next(x["cos_u"] for x in St if x["line"] == l and x["condition"] == r["condition"])) for l in LINES}
                           for r in Cons if r["condition"].startswith("F:")},
            "panels_cons": {r["condition"][8:]: [f(r["cons_r_Replogle/Nadig"]), f(r["cons_r_X-Atlas"])] for r in Cons if r["condition"].startswith("G:")},
            "phase": {"n": ns, "k": ks, "cons_RN": grid, "cons_XA": gridX, "fidelity": fid}, "depth": depth}


def external():
    out = {}
    for ds in ("tahoe", "chemfish"):
        P = tsv(f"{ds}_axis_per_context.tsv")
        med = lambda k: f(np.median([float(r[k]) for r in P]))
        out[ds] = {"contexts": len(P), "n_perturbations": med("n_perturbations"), "median_cells": med("median_cells"),
                   "energy": med("energy_on_axis"), "cos": med("median_cos_alignment"), "split_cos_u": med("split_cos_uA_uB"),
                   "split_beta_r": med("split_beta_r"), "split_residual_r": med("split_residual_r_median"),
                   "noise_ratio": f(np.median([float(r["median_effect_norm"]) / float(r["control_noise_norm"]) for r in P]), 2),
                   "frac_above_2x": med("frac_effects_above_2x_noise"),
                   "conservation": jload(f"{ds}_axis_conservation.json"), "checks": jload(f"{ds}_checks.json"),
                   "pair_similarity": {k: f(np.median([float(r[k]) for r in tsv(f"{ds}_pair_similarity.tsv")])) for k in ("raw_same", "raw_random", "residual_same", "residual_random", "u_cosine")},
                   "detect": [(int(r["n"]), f(r["split_cos"]), f(r["null_p95"]), f(r["detectable"])) for r in tsv(f"{ds}_axis_detectability.tsv")]}
    w = {r[0]: r[1] for r in csv.reader(open(RES / "tahoe_dmso_well_summary.tsv"), delimiter="\t")}
    out["tahoe"]["dmso_well"] = {k: f(v) for k, v in w.items()}
    out["tahoe"]["dose_tiers"] = {k: f(v["median_beta"]) for k, v in out["tahoe"]["checks"]["by_dose_tier"].items()}
    return out


def fin():
    """MiniFin / MegaFin readiness (compass_repro stages 14-16): the headline gene panel ('hvg', the
    stage-7d rule) and the robustness panel ('expressed', the 2,000 highest-mean genes)."""
    out = {}
    for p, base in (("hvg", RES / "fin"), ("expressed", RES / "fin" / "expressed")):
        s = jload("fin_summary.json", base)
        nod = [r for r in csv.DictReader(open(base / "megafin_nodrug_pairs.tsv"), delimiter="\t") if r["pair"].startswith("no-drug")]
        s["megafin"]["nodrug_within_plate"]["median_expected_sampling"] = f(np.median([float(r["expected_sampling"]) for r in nod]))
        wr = s["megafin"]["crosscluster_r_of_well_difference"]
        s["megafin"]["crosscluster_r_of_nodrug_difference_mean"] = f(np.mean([v for k, v in wr.items() if k.startswith("no-drug")]))
        out[p] = s
    return out


def histograms(p5):
    edges = np.round(np.arange(-0.6, 2.21, 0.06), 3)
    h = {}
    for ds in ("crispr", "tahoe", "chemfish"):
        x = np.asarray(p5[ds]["ratio"]); c, _ = np.histogram(x, bins=edges)
        h[ds] = {"counts": c.tolist(), "n": int(len(x)), "median": f(10 ** np.median(x), 2), "above_2x": f(np.mean(x > np.log10(2)))}
    cedges = np.round(np.arange(0, 4.01, 0.1), 2)
    for ds in ("crispr", "tahoe"):
        x = np.log10(np.maximum(np.asarray(p5[ds]["cells"]), 1)); c, _ = np.histogram(x, bins=cedges)
        h[ds]["cells_counts"] = c.tolist(); h[ds]["cells_median"] = int(np.median(p5[ds]["cells"]))
    # MegaFin, measured (compass_repro stage 15): every drug well x cluster effect, against the halves of the
    # plate's pooled no-drug cells (the CRISPRi-style yardstick) and against the single-well noise floor
    rows = list(csv.DictReader(open(RES / "fin" / "megafin_effect_vs_wellnoise.tsv"), delimiter="\t"))
    for ds, col in (("megafin", "effect_over_control_split"), ("megafin_wells", "effect_over_null")):
        x = np.log10(np.array([float(r[col]) for r in rows]))
        c, _ = np.histogram(np.clip(x, edges[0], edges[-1] - 1e-9), bins=edges)
        h[ds] = {"counts": c.tolist(), "n": int(len(x)), "median": f(10 ** np.median(x), 2), "above_2x": f(np.mean(x > np.log10(2)))}
    return {"ratio_edges": edges.tolist(), "cells_edges": cedges.tolist(), **h}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rm = jload("reproduction_meta.json", REPRO); choices = jload("choices.json", REPRO)
    page = {k: jload(f"page/{k}.json") for k in ("plate1", "plate2", "plate3", "plate4", "plate5")}
    anchor = tsv("anchor_investigation.tsv")
    an = {(r["match_on"], r["protein_coding_targets_only"], r["min_cells"]): int(r["shared"]) for r in anchor}
    comp = {r["property"]: {k: v for k, v in r.items() if k != "property"} for r in tsv("../dataset_comparison.tsv")}
    repro_head = subprocess.run(["git", "-C", str(REPRO), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    meta = {
        "page": "/compass", "generated_by": "scripts/build_compass.py", "built": time.strftime("%Y-%m-%d"),
        "asset_version": None,
        "source": {"repro_dir": str(REPRO), "repro_commit": repro_head, "paper_doi": "10.64898/2026.08.03.742643",
                   "paper_sha256": next(i["sha256"] for i in rm["inputs"] if i["path"].endswith(".pdf")),
                   "compass_repo": rm["compass_package"]["repo"], "compass_commit": rm["compass_package"]["commit"][:7],
                   "software": rm["software"]},
        "paper": PAPER, "zeroshot": ZEROSHOT,
        "anchor": {"ensembl": an[("Ensembl ID", "False", "2")], "symbol": an[("source symbol (as deposited)", "False", "2")],
                   "renamed": 54, "symbol_only": 7, "paper_matched_extracted": 2263},
        "data": {"cells": {"K562": 547949, "RPE1": 238932, "HepG2": 140479, "Jurkat": 254927, "HCT116": 491895, "HEK293T": 646231},
                 "controls": {"K562": 75328, "RPE1": 11485, "HepG2": 4976, "Jurkat": 12013, "HCT116": 165777, "HEK293T": 218838}},
        "reproduction": reproduction(), "decomposition": decomposition(), "stress": stress(), "external": external(), "fin": fin(),
        "biology": {"r2": {l: f(page["plate3"]["r2"][l]["R2_u_on_curated_signatures"], 2) for l in LINES},
                    "beta_vs_essential": page["plate3"]["r2"]["beta_vs_essentiality"]},
        "comparison": comp, "choices": choices,
    }
    plates = {"p1": page["plate1"], "p2": page["plate2"],
              "p3": {k: v for k, v in page["plate3"].items() if k != "r2"},
              "p4": page["plate4"], "p5": histograms(page["plate5"]),
              "p5_chemfish_cells": page["plate5"]["chemfish"]["median_cells_by_tissue"]}
    # NaN is not JSON (browsers refuse the whole file); an undefined statistic ships as null.
    def nonan(o):
        if isinstance(o, dict): return {k: nonan(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)): return [nonan(v) for v in o]
        if isinstance(o, float) and o != o: return None
        return o
    plates, meta = nonan(plates), nonan(json.loads(json.dumps(meta, default=float)))
    ptxt = json.dumps(plates, separators=(",", ":"), allow_nan=False)
    meta["asset_version"] = hashlib.sha256(ptxt.encode()).hexdigest()[:12]
    (OUT / "plates.json").write_text(ptxt)
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1, allow_nan=False))
    print(f"wrote meta.json ({(OUT / 'meta.json').stat().st_size / 1e3:.0f} kB) and plates.json ({len(ptxt) / 1e3:.0f} kB), "
          f"asset_version {meta['asset_version']}, repro {repro_head}")


if __name__ == "__main__":
    main()
