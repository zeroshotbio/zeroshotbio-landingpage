#!/usr/bin/env python3
"""Build the compact, three-figure /rhaister visual essay.

This script only selects and serialises completed reproduction outputs. It does
not fit a model or recompute scientific results. The analysis record lives in
/data/scratch/rhaister_repro/RHAISTER_REPRODUCTION.md.

Run:
    python3 scripts/build_rhaister.py
    python3 scripts/build_rhaister.py --check
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import pathlib
import re
import subprocess
from typing import Any

from PIL import Image


ROOT = pathlib.Path(__file__).resolve().parent.parent
REPRO = pathlib.Path("/data/scratch/rhaister_repro")
OUT = ROOT / "public" / "rhaister"

EXPECTED_REPRO_HEAD = "831d5ff3c301390cf13d4e01670cd4e2c309fe38"
EXPECTED_CODE_HEAD = "75fed20a1d97b05a09bf25c5341762141882106a"
EXPECTED_DATA_REV = "6fbb5f721c7ed8bef23fa8e5d2a08bc47470db83"

SOURCE_ART = REPRO / "code" / "plots" / "Rhaister_split.png"
ORIGINAL_REL = pathlib.Path("exhibits/original/rhaister_figure1_task_source.png")
CROP_REL = pathlib.Path("exhibits/crops/rhaister_figure1_task_crop.png")
CROP_BOX = (38, 25, 1181, 737)


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_head(path: pathlib.Path) -> str:
    return subprocess.check_output(
        ["git", "-C", str(path), "rev-parse", "HEAD"], text=True
    ).strip()


def read_tsv(name: str) -> list[dict[str, str]]:
    with (REPRO / name).open(newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def finite(value: str) -> float:
    out = float(value)
    if not math.isfinite(out):
        raise ValueError(f"expected finite number, found {value!r}")
    return out


def rounded(value: str | float, digits: int = 8) -> float:
    return round(finite(str(value)), digits)


def json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    ).encode()


def published_replogle_metrics() -> dict[str, float]:
    """Read the paper aggregate from the authors' pinned repository README."""
    text = (REPRO / "code" / "README.md").read_text()
    match = re.search(
        r"\|\s*Replogle-Nadig\s*\|\s*4\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)"
        r"\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|",
        text,
    )
    if not match:
        raise ValueError("could not locate the Replogle-Nadig results row in README.md")
    pearson, pr_auc, spearman_lfc, de_overlap = map(float, match.groups())
    return {
        "pearson_delta": pearson,
        "pr_auc": pr_auc,
        "spearman_lfc": spearman_lfc,
        "de_overlap": de_overlap,
    }


def official_metric(rows: list[dict[str, str]], method: str, metric: str) -> float:
    found = [
        row
        for row in rows
        if row["dataset"] == "replogle_nadig"
        and row["split"] == "split_0"
        and row["method"] == method
        and row["metric"] == metric
    ]
    if len(found) != 1:
        raise ValueError(f"expected one {method}/{metric} row, found {len(found)}")
    return rounded(found[0]["value"])


def prepare_exhibit() -> tuple[bytes, bytes, dict[str, Any]]:
    source = SOURCE_ART.read_bytes()
    if sha_bytes(source) != "4475694a9512a5b9f59853ea008b6e9667b9fc341273b968fe7566160b46b132":
        raise ValueError("authors' Rhaister_split.png checksum changed")
    image = Image.open(io.BytesIO(source))
    if image.size != (1210, 782):
        raise ValueError(f"unexpected source-art dimensions: {image.size}")
    crop = image.crop(CROP_BOX)
    buffer = io.BytesIO()
    crop.save(buffer, format="PNG", optimize=True)
    cropped = buffer.getvalue()
    manifest = {
        "schema": "rhaister_exhibits/v1",
        "items": [
            {
                "id": "figure1_task",
                "description": "Authors' original task schematic released with the paper code",
                "paper_figure": "Figure 1 task schematic",
                "source_url": "https://huggingface.co/tahoebio/Rhaister/blob/75fed20a1d97b05a09bf25c5341762141882106a/plots/Rhaister_split.png",
                "paper_url": "https://doi.org/10.64898/2026.06.09.731197",
                "upstream_commit": EXPECTED_CODE_HEAD,
                "license": "CC BY 4.0 paper; source repository Apache-2.0",
                "attribution": "Svensson et al., 2026",
                "original": str(ORIGINAL_REL),
                "original_dimensions": [1210, 782],
                "original_sha256": sha_bytes(source),
                "crop": str(CROP_REL),
                "crop_box_xyxy": list(CROP_BOX),
                "crop_dimensions": list(crop.size),
                "crop_sha256": sha_bytes(cropped),
                "pixel_edits": "crop only; no recolouring, retouching, or overlays",
            }
        ],
    }
    return source, cropped, manifest


def build() -> dict[pathlib.Path, bytes]:
    repro_head = git_head(REPRO)
    code_head = git_head(REPRO / "code")
    if repro_head != EXPECTED_REPRO_HEAD:
        raise ValueError(f"reproduction HEAD {repro_head} != {EXPECTED_REPRO_HEAD}")
    if code_head != EXPECTED_CODE_HEAD:
        raise ValueError(f"authors' code HEAD {code_head} != {EXPECTED_CODE_HEAD}")

    components = json.loads((REPRO / "component_summary.json").read_text())
    thresholds = json.loads((REPRO / "panel_thresholds.json").read_text())
    metric_rows = read_tsv("reproduction_metrics.tsv")
    prediction_rows = read_tsv("example_prediction.tsv")
    weight_rows = read_tsv("example_ridge_weights.tsv")
    titration_rows = read_tsv("panel_titration.tsv")
    summary_rows = read_tsv("panel_titration_summary.tsv")
    compass_rows = read_tsv("compass_rhaister_join.tsv")
    association_rows = read_tsv("compass_rhaister_associations.tsv")

    if components["test_pairs"] != 945 or components["heldout_targets"] != 945:
        raise ValueError("expected 945 held-out split_0 perturbations")
    if components["genes"] != 2000 or len(prediction_rows) != 2000:
        raise ValueError("expected the complete 2,000-gene example")
    if len({row["gene"] for row in prediction_rows}) != 2000:
        raise ValueError("example genes are not unique")
    if {row["treatment"] for row in prediction_rows} != {"RABGGTA"}:
        raise ValueError("example is not exclusively RABGGTA")
    if len(weight_rows) != components["regression_basis_terms"]:
        raise ValueError("ridge-weight count does not match the component summary")

    random_raw = [row for row in titration_rows if row["selection_strategy"] == "random"]
    sizes = thresholds["sizes"]
    repeats = sorted({int(row["repeat"]) for row in random_raw})
    if repeats != list(range(10)):
        raise ValueError(f"expected repeats 0..9, found {repeats}")
    if sorted({int(row["panel_size"]) for row in random_raw}) != sizes:
        raise ValueError("random titration sizes do not match panel_thresholds.json")
    for size in sizes[:-1]:
        if sum(int(row["panel_size"]) == size for row in random_raw) != 10:
            raise ValueError(f"panel K={size} does not have ten repeats")

    random_summary = [
        row for row in summary_rows if row["selection_strategy"] == "random"
    ]
    if len(random_summary) != len(sizes):
        raise ValueError("expected one random-panel summary row per panel size")

    matched_compass = [row for row in compass_rows if row["compass_match_status"] == "matched"]
    if len(matched_compass) != 922:
        raise ValueError(f"expected 922 COMPASS matches, found {len(matched_compass)}")

    paper = published_replogle_metrics()
    ours = {
        "pearson_delta": official_metric(metric_rows, "full_rhaister_all_metrics", "state/pearson_delta_mean"),
        "discrimination": official_metric(metric_rows, "full_rhaister_all_metrics", "state/discrimination_mean"),
        "spearman_lfc": official_metric(metric_rows, "full_rhaister_all_metrics", "state/spearman_lfc_sig_mean"),
        "pr_auc": official_metric(metric_rows, "full_rhaister_all_metrics", "state/pr_auc_mean"),
        "de_overlap": official_metric(metric_rows, "full_rhaister_all_metrics", "state/de_overlap_mean"),
        "effect_size_spearman": official_metric(metric_rows, "full_rhaister_all_metrics", "state/de_spearman_sig"),
    }

    top_measured = sorted(
        (row for row in weight_rows if row["basis_source"] == "measured_panel"),
        key=lambda row: finite(row["abs_ridge_weight"]),
        reverse=True,
    )[:10]

    def assoc(predictor: str, outcome: str, analysis: str) -> dict[str, Any]:
        matches = [
            row
            for row in association_rows
            if row["predictor"] == predictor
            and row["outcome"] == outcome
            and row["analysis"] == analysis
        ]
        if len(matches) != 1:
            raise ValueError(f"association row not unique: {predictor}/{outcome}/{analysis}")
        row = matches[0]
        return {"n": int(row["n"]), "rho": rounded(row["rho"]), "p": rounded(row["p_value"], 12)}

    compass_accuracy = assoc("compass_shared_fraction", "pearson_full_rhaister", "spearman")
    compass_k50_partial = assoc(
        "compass_shared_fraction",
        "random_panel_k50_isotonic",
        "partial_spearman_controlling_compass_response_l2",
    )

    plates: dict[str, Any] = {
        "schema": "rhaister_plates/v2",
        "components": [
            {"label": "Global mean", "value": official_metric(metric_rows, "global_mean", "state/pearson_delta_mean")},
            {"label": "Additive ALS", "value": rounded(components["delta_pearson_additive_mean"])},
            {"label": "Drug ridge", "value": rounded(components["delta_pearson_ridge_mean"])},
            {"label": "Full blend", "value": rounded(components["delta_pearson_full_mean"])},
        ],
        "example": {
            "treatment": components["example_treatment"],
            "points": [
                {
                    "gene": row["gene"],
                    "observed": rounded(row["observed_delta"]),
                    "predicted": rounded(row["predicted_delta"]),
                }
                for row in prediction_rows
            ],
            "weights": [
                {
                    "treatment": row["basis_treatment"],
                    "value": rounded(row["ridge_weight"]),
                    "source": row["basis_source"],
                }
                for row in top_measured
            ],
        },
        "titration": {
            "raw": [
                {
                    "repeat": int(row["repeat"]),
                    "k": int(row["panel_size"]),
                    "pearson": rounded(row["pearson_full_mean"]),
                    "gain": rounded(row["gain_full_over_additive"]),
                }
                for row in random_raw
            ],
            "summary": [
                {
                    "k": int(row["panel_size"]),
                    "pearson": rounded(row["pearson_mean"]),
                    "low": None if row["pearson_full_mean_ci95_low"] == "NA" else rounded(row["pearson_full_mean_ci95_low"]),
                    "high": None if row["pearson_full_mean_ci95_high"] == "NA" else rounded(row["pearson_full_mean_ci95_high"]),
                }
                for row in random_summary
            ],
        },
        "compass": {
            "points": [
                {
                    "shared": rounded(row["compass_shared_fraction"]),
                    "pearson": rounded(row["pearson_full_rhaister"]),
                }
                for row in matched_compass
            ],
            "accuracy_association": compass_accuracy,
            "panel_k50_partial_association": compass_k50_partial,
        },
    }
    asset_version = sha_bytes(json_bytes(plates))[:12]
    plates["asset_version"] = asset_version

    meta = {
        "schema": "rhaister_meta/v2",
        "asset_version": asset_version,
        "page": "/rhaister",
        "built": "2026-09-12",
        "title": "Rhaister — three figures on predicting what was not measured",
        "paper": {
            "title": "Back to basics: Observed statistics are sufficient to predict drug responses",
            "authors": "Svensson et al.",
            "doi": "10.64898/2026.06.09.731197",
            "url": "https://doi.org/10.64898/2026.06.09.731197",
            "posted": "2026-06-12",
            "license": "CC BY 4.0",
            "replogle_four_split_mean": paper,
        },
        "provenance": {
            "reproduction_commit": repro_head,
            "authors_code_commit": code_head,
            "dataset_revision": EXPECTED_DATA_REV,
            "split": "replogle_nadig/split_0",
            "scope": "one canonical split; paper comparison is to a four-split mean",
        },
        "split": {
            "contexts": components["n_contexts"],
            "reference_contexts": components["reference_contexts"],
            "observed_panel": components["measured_hepg2_panel"],
            "held_out": components["heldout_targets"],
            "genes": components["genes"],
            "basis_terms": components["regression_basis_terms"],
            "imputed_basis_terms": components["als_imputed_basis_terms"],
        },
        "reproduction": {
            "paper_pearson": paper["pearson_delta"],
            "ours": ours,
            "reconstruction_max_abs_error": rounded(components["official_reconstruction_max_abs_error"], 12),
            "example": {
                "treatment": components["example_treatment"],
                "selection_rule": components["example_selection_rule"],
                "pearson_additive": rounded(components["example_pearson_additive"]),
                "pearson_ridge": rounded(components["example_pearson_ridge"]),
                "pearson_full": rounded(components["example_pearson_full"]),
            },
        },
        "thresholds": {
            "first_useful": thresholds["random"]["first_k_with_gain_ci95_above_matching_k_additive"],
            "clear_canonical_additive": thresholds["random"]["first_k_with_performance_ci95_above_canonical_additive"],
            "half_gain": thresholds["random"]["k_for_50pct_canonical_additive_to_full_panel_gain"],
            "near_saturation": thresholds["random"]["k_for_90pct_canonical_additive_to_full_panel_gain"],
            "canonical_additive": rounded(thresholds["random"]["canonical_additive"]),
            "full_panel": rounded(thresholds["random"]["full_panel_asymptote"]),
            "repeats": thresholds["repeats"],
            "half_sample_reference_available": thresholds["half_sample_reference_available"],
        },
        "compass": {
            "matched": len(matched_compass),
            "accuracy_rho": compass_accuracy["rho"],
            "panel_k50_partial_rho": compass_k50_partial["rho"],
            "panel_k50_partial_p": compass_k50_partial["p"],
        },
    }

    original, crop, manifest = prepare_exhibit()
    manifest["asset_version"] = asset_version
    return {
        OUT / "meta.json": json_bytes(meta),
        OUT / "plates.json": json_bytes(plates),
        OUT / "exhibits" / "manifest.json": json_bytes(manifest),
        OUT / ORIGINAL_REL: original,
        OUT / CROP_REL: crop,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare generated bytes with committed outputs")
    args = parser.parse_args()
    outputs = build()
    if args.check:
        failures = []
        for path, expected in outputs.items():
            actual = path.read_bytes() if path.exists() else None
            if actual != expected:
                failures.append(str(path.relative_to(ROOT)))
        if failures:
            raise SystemExit("generated outputs differ: " + ", ".join(failures))
        print(f"rhaister build check passed ({len(outputs)} generated files)")
        return
    for path, data in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
