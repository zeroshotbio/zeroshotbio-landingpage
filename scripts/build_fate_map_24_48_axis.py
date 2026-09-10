#!/usr/bin/env python3
"""One shared perturbation-response axis, computed on the displacements.

The question this answers is narrow and worth stating exactly: **do thirty-odd
different genetic perturbations push cells in a COMMON direction in this
embedding, or in unrelated ones?**

Method, and its limits. Every arrow from build_fate_map_24_48_perturb.py is a 2D
displacement — a perturbed state's centroid minus the same state's control
centroid at the same hour. Stack them, take the first principal component, and
that is the shared axis. Each arrow then gets a signed projection onto it, and
each target a mean projection and an alignment fraction.

This is an axis in a UMAP projection, NOT a gene programme. It cannot name a
pathway and it does not try to. A gene-level shared response would need a
pseudobulk pass over ZSCAPE's expression matrix; that is a different job and is
not this one. What this can say is whether the responses are collinear at all,
and the honest answer is reported either way — including the answer "they are
not", which would show up as a first component explaining little.

Run:  python3 scripts/build_fate_map_24_48_axis.py
"""

from __future__ import annotations

import json
import pathlib
import sys

import numpy as np
import pandas as pd

WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"
TABLES = pathlib.Path("/data/fate_map")


def main() -> None:
    """Fit the axis, score every arrow and target, and fold it into perturb.json.

    Raises:
        SystemExit: If perturb.json is missing.
    """
    pj = WEB / "perturb.json"
    if not pj.exists():
        sys.exit(f"missing {pj} — run build_fate_map_24_48_perturb.py first")
    doc = json.loads(pj.read_text())
    A = pd.DataFrame(doc["arrows"])
    if A.empty:
        sys.exit("perturb.json has no arrows")

    V = np.column_stack([A.x1 - A.x0, A.y1 - A.y0])
    print(f"  {len(V):,} displacements over {A.target.nunique()} targets, "
          f"{A.state.nunique()} states")

    # Not mean-centred. A displacement of zero means "no response", and it is a
    # meaningful origin — centring would move it and turn "no response" into a
    # position on the axis.
    U, S, Wt = np.linalg.svd(V, full_matrices=False)
    var = (S ** 2) / (S ** 2).sum()
    axis = Wt[0]
    # orient it so the commonest response is positive
    proj = V @ axis
    if np.median(proj) < 0:
        axis = -axis
        proj = -proj
    # The un-centred number alone would overstate the case badly. An un-centred
    # first component captures whatever common offset the displacements share,
    # and a systematic control-versus-perturbed shift would produce a large one
    # with no biology in it at all. So the centred fit is computed too, and both
    # are reported: the gap between them is how much of the "shared axis" is
    # just a shared mean.
    Vc = V - V.mean(0)
    Sc = np.linalg.svd(Vc, compute_uv=False)
    var_c = (Sc ** 2) / (Sc ** 2).sum()
    mean_v = V.mean(0)
    mean_frac = float((mean_v @ mean_v) / (V ** 2).sum() * len(V))
    print(f"  UN-CENTRED first component: {var[0]:.1%} of displacement variance")
    print(f"  CENTRED   first component: {var_c[0]:.1%}  <- the honest number")
    print(f"  common mean displacement: [{mean_v[0]:+.4f}, {mean_v[1]:+.4f}], "
          f"|mean| = {np.hypot(*mean_v):.4f}, {mean_frac:.1%} of total squared length")
    print(f"  axis direction in embedding units: [{axis[0]:+.3f}, {axis[1]:+.3f}]")

    A["proj"] = np.round(proj, 4)
    A["aligned"] = A.proj > 0

    per_target = (A.groupby("target")
                    .agg(n=("proj", "size"), mean_proj=("proj", "mean"),
                         median_proj=("proj", "median"),
                         frac_aligned=("aligned", "mean"),
                         median_d=("d", "median"))
                    .round(4).sort_values("median_proj", ascending=False).reset_index())

    # A per-target null: how much of that target's own displacement lies along
    # the shared axis rather than across it. 1.0 would mean the target moves only
    # along the shared direction.
    frac_along = []
    for tg, g in A.groupby("target"):
        v = np.column_stack([g.x1 - g.x0, g.y1 - g.y0])
        tot = float((v ** 2).sum())
        alo = float(((v @ axis) ** 2).sum())
        frac_along.append({"target": tg, "frac_variance_along_axis": round(alo / tot, 4)
                           if tot > 0 else None})
    per_target = per_target.merge(pd.DataFrame(frac_along), on="target")

    doc["axis"] = {
        "method": "first principal component of the 2D displacement vectors, un-centred",
        "direction": [round(float(axis[0]), 5), round(float(axis[1]), 5)],
        "var_explained": round(float(var[0]), 4),
        "var_explained_second": round(float(var[1]), 4),
        "var_explained_centred": round(float(var_c[0]), 4),
        "mean_displacement": [round(float(mean_v[0]), 5), round(float(mean_v[1]), 5)],
        "mean_share_of_squared_length": round(mean_frac, 4),
        "caveat": "An axis in a UMAP projection, not a gene programme. It says whether "
                  "responses are collinear; it cannot name a pathway. Compare the "
                  "un-centred and centred variance explained before believing it: the "
                  "gap between them is a common offset shared by every perturbation, "
                  "which may be biology or may be a control-versus-injected batch effect.",
        "per_target": per_target.to_dict(orient="records"),
    }
    for a, p in zip(doc["arrows"], A.proj.tolist()):
        a["p"] = p
    pj.write_text(json.dumps(doc, separators=(",", ":")))

    TABLES.mkdir(parents=True, exist_ok=True)
    per_target.to_csv(TABLES / "zscape_response_axis_by_target.tsv", sep="\t", index=False)
    A.to_parquet(TABLES / "zscape_perturb_displacement.parquet", index=False)

    top = per_target.head(4)
    bot = per_target.tail(3)
    print("  most aligned targets: " +
          ", ".join(f"{r.target} {r.median_proj:+.2f}" for r in top.itertuples()))
    print("  least aligned:        " +
          ", ".join(f"{r.target} {r.median_proj:+.2f}" for r in bot.itertuples()))
    print(f"  wrote the axis into {pj} and "
          f"{TABLES/'zscape_response_axis_by_target.tsv'}")


if __name__ == "__main__":
    main()
