#!/usr/bin/env python3
"""
create_ortholog_subset.py
─────────────────────────
Turn the Alliance combined-TSV (or any of the other supported formats) into a
JSON file that the Next-.js visualisation can load immediately.

Run it twice:

1.  FULL dump – **keep every edge**  
       python create_ortholog_subset.py \
              --input  public/data/ORTHOLOGY-ALLIANCE_COMBINED_7.tsv \
              --output public/data/alliance_full.json \
              --size   0

2.  REPRESENTATIVE subset – **stratified 5 000-edge sample**  
       python create_ortholog_subset.py \
              --input  public/data/ORTHOLOGY-ALLIANCE_COMBINED_7.tsv \
              --output public/data/alliance_subset_5k.json \
              --size   5000

The script auto-detects whether it produced a subset (`is_subset = False` when
`--size 0` or `--size >= full_size`).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import random
import sys
from collections import Counter
from typing import Dict, List, Tuple

import pandas as pd

# ═══════════════════════════════════════════════════════════════════════════════
# configuration
# ═══════════════════════════════════════════════════════════════════════════════
CONF_BINS: List[Tuple[str, float, float]] = [
    ("high", 0.80, 1.01),
    ("medium", 0.50, 0.80),
    ("low", 0.00, 0.50),
]

CANONICAL_COLS = {
    "zebrafish_id",
    "human_id",
    "orthology_type",
    "confidence",
    "validated",
}

ZEBRAFISH_TAXON = "7955"
HUMAN_TAXON = "9606"


# ═══════════════════════════════════════════════════════════════════════════════
# helpers
# ═══════════════════════════════════════════════════════════════════════════════
def confidence_bin(score: float) -> str:
    for name, low, hi in CONF_BINS:
        if low <= score < hi:
            return name
    return "low"


# Alliance-specific mapping ------------------------------------------------------
def _from_alliance(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Convert Alliance TSV into canonical schema – only human⇄zebrafish rows."""
    req = {
        "gene1id",
        "gene1speciestaxonid",
        "gene2id",
        "gene2speciestaxonid",
        "algorithmsmatch",
        "outofalgorithms",
        "isbestscore",
        "isbestrevscore",
    }
    missing = req - set(df_raw.columns)
    if missing:
        raise KeyError("Alliance TSV missing: " + ", ".join(sorted(missing)))

    g1_taxon = df_raw["gene1speciestaxonid"].str.split(":").str[-1]
    g2_taxon = df_raw["gene2speciestaxonid"].str.split(":").str[-1]

    mask_hz = (g1_taxon == HUMAN_TAXON) & (g2_taxon == ZEBRAFISH_TAXON)
    mask_zh = (g1_taxon == ZEBRAFISH_TAXON) & (g2_taxon == HUMAN_TAXON)
    df = df_raw[mask_hz | mask_zh].copy()

    zebrafish_id = df["gene1id"].where(g1_taxon == ZEBRAFISH_TAXON, df["gene2id"])
    human_id = df["gene1id"].where(g1_taxon == HUMAN_TAXON, df["gene2id"])

    conf = df["algorithmsmatch"].astype(int) / df["outofalgorithms"].astype(int)
    validated = (df["isbestscore"].str.lower() == "yes") & (
        df["isbestrevscore"].str.lower() == "yes"
    )

    tmp = (
        pd.DataFrame(
            {
                "zebrafish_id": zebrafish_id,
                "human_id": human_id,
                "confidence": conf,
                "validated": validated,
            }
        )
        .drop_duplicates(subset=["zebrafish_id", "human_id"])
        .reset_index(drop=True)
    )

    size_z = tmp["zebrafish_id"].map(tmp["zebrafish_id"].value_counts())
    size_h = tmp["human_id"].map(tmp["human_id"].value_counts())

    def classify(sz: int, sh: int) -> str:
        if sz == 1 and sh == 1:
            return "ortholog_one2one"
        if sz == 1 and sh > 1:
            return "ortholog_one2many"
        if sz > 1 and sh == 1:
            return "ortholog_many2one"
        return "ortholog_many2many"

    tmp["orthology_type"] = [classify(sz, sh) for sz, sh in zip(size_z, size_h)]
    return tmp


# Ingest dispatcher -------------------------------------------------------------
def load_edges(path: pathlib.Path) -> pd.DataFrame:
    """Load JSON / Parquet / Alliance TSV into canonical DataFrame."""
    suffix = path.suffix.lower()

    if suffix == ".json":
        payload = json.loads(path.read_text())
        df = pd.DataFrame(payload["edges"]).rename(columns=str.lower)

    elif suffix == ".parquet":
        df = pd.read_parquet(path).rename(columns=str.lower)

    elif suffix in {".tsv", ".txt"}:
        raw = pd.read_csv(
            path,
            sep="\t",
            engine="python",
            comment="#",
            na_filter=False,
            dtype=str,
            quoting=3,
            on_bad_lines="skip",
        )
        raw.columns = [c.lower() for c in raw.columns]
        df = _from_alliance(raw)

    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")

    missing = CANONICAL_COLS - set(df.columns)
    if missing:
        raise KeyError("Missing canonical columns: " + ", ".join(sorted(missing)))

    return df[list(CANONICAL_COLS)].copy()


# Statistics & sampling ---------------------------------------------------------
def full_statistics(df: pd.DataFrame) -> Dict:
    type_dist = dict(Counter(df["orthology_type"]))
    conf_dist = dict(Counter(df["confidence"].map(confidence_bin)))
    return {
        "total_edges": len(df),
        "total_fish_genes": df["zebrafish_id"].nunique(),
        "total_human_genes": df["human_id"].nunique(),
        "type_distribution": type_dist,
        "confidence_distribution": conf_dist,
        "validated_count": int(df["validated"].sum()),
    }


def stratified_sample(df: pd.DataFrame, target_n: int) -> pd.DataFrame:
    """
    Deterministic sampling:
      • ensure every orthology_type is present (≥ 10 % each or all rows)
      • favour validated + high-confidence edges
    """
    groups = df.groupby("orthology_type", sort=False)
    counts = {typ: len(grp) for typ, grp in groups}

    quota = max(1, target_n // 10)  # ≥10 % floor
    alloc = {typ: min(quota, cnt) for typ, cnt in counts.items()}
    allocated = sum(alloc.values())

    # distribute remaining proportionally
    remaining = target_n - allocated
    if remaining > 0:
        total_left = sum(cnt - alloc[typ] for typ, cnt in counts.items())
        for typ, cnt in counts.items():
            room = cnt - alloc[typ]
            extra = int(round(room / total_left * remaining)) if total_left else 0
            alloc[typ] += min(extra, room)

        # rounding corrections
        while sum(alloc.values()) < target_n:
            typ = max(counts, key=lambda t: counts[t] - alloc[t])
            alloc[typ] += 1
        while sum(alloc.values()) > target_n:
            typ = max(alloc, key=alloc.get)
            alloc[typ] -= 1

    rng = random.Random(42)
    bucket = []
    for typ, grp in groups:
        need = alloc[typ]
        grp = grp.copy()
        grp["__rand"] = [rng.random() for _ in range(len(grp))]
        grp = grp.sort_values(
            by=["validated", "confidence", "__rand"], ascending=[False, False, True]
        )
        bucket.append(grp.head(need))

    return pd.concat(bucket, ignore_index=True)


def best_training_subset(
    df: pd.DataFrame, min_conf: float = 0.80, deduplicate: bool = True
) -> pd.DataFrame:
    """Return only high-confidence, bidirectional 1-1 orthologs."""
    best = df[
        (df["orthology_type"] == "ortholog_one2one")
        & (df["validated"])
        & (df["confidence"] >= min_conf)
    ].copy()

    if not deduplicate:
        return best.reset_index(drop=True)

    # keep highest-confidence edge per gene (stable / reproducible)
    best = best.sort_values(
        ["confidence", "zebrafish_id", "human_id"], ascending=[False, True, True]
    )
    best = best.drop_duplicates("zebrafish_id", keep="first").drop_duplicates(
        "human_id", keep="first"
    )
    return best.reset_index(drop=True)


# CLI --------------------------------------------------------------------------
def main(argv: List[str] | None = None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=pathlib.Path)
    p.add_argument("--output", required=True, type=pathlib.Path)
    p.add_argument("--mode", choices=["subset", "best"], default="subset")
    p.add_argument(
        "--size",
        type=int,
        default=5000,
        help="subset size (only for --mode subset, 0 = all)",
    )
    p.add_argument(
        "--min-conf",
        type=float,
        default=0.80,
        help="confidence cut-off (only for --mode best)",
    )
    args = p.parse_args(argv)

    df_full = load_edges(args.input)
    stats = full_statistics(df_full)

    if args.mode == "subset":
        subset = df_full if args.size == 0 else stratified_sample(df_full, args.size)
        subset_method = "stratified_sampling_prioritise_validated"
    else:  # --mode best
        subset = best_training_subset(df_full, min_conf=args.min_conf)
        subset_method = f"best_training_conf≥{args.min_conf:.2f}"

    payload = {
        "fishGenes": sorted(subset["zebrafish_id"].unique()),
        "humanGenes": sorted(subset["human_id"].unique()),
        "edges": subset.to_dict("records"),
        "counts": {},
        "metadata": {
            "is_subset": True,
            "subset_size": len(subset),
            "full_size": stats["total_edges"],
            "sampling_ratio": round(len(subset) / stats["total_edges"], 5),
            "subset_stats": full_statistics(subset),
            "full_stats": stats,
            "subset_method": subset_method,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2))
    print(f"wrote {len(subset):,} edges → {args.output}")


if __name__ == "__main__":
    sys.exit(main())
