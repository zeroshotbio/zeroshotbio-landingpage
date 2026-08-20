#!/usr/bin/env python3
"""Build the static asset bundle for the public ZSCAPE Commit challenge page (/commit).

Mirrors scripts/build_zscape_commit_gold_asset.py in shape and contamination discipline, but emits
*previews* of the four challenge INPUT files rather than the labelling wizard's world map.

CONTAMINATION DISCIPLINE (dataset LEDGER #1)
-------------------------------------------
This row is NOT blind: we authored the gold labels and hold them at
  /data/scratch/zlabel/datasets/zscape_commit_gold/_HELDOUT/
This builder MUST NEVER read that directory. A hard path guard (see _read) raises on any attempt.

Two further restrictions, beyond _HELDOUT/:
  * inputs/cluster_public.csv carries FOUR ZSCAPE label columns. They are a public input in the
    benchmark's own terms, but the answer key was translated FROM them, so they are withheld from
    the challenge. Only cluster_id + n_cells are emitted. The withheld column NAMES are also kept
    out of this bundle so the leakage assertion below is absolute; the page names them in its own
    copy (src/app/commit/), which is hand-written and not machine-derived from the data.
  * gold_features.csv carries zscape_published_markers — ZSCAPE's own marker calls. Excluded from
    the preview for the same reason and flagged in the manifest.

Everything is READ-ONLY. Nothing under /data/scratch/zlabel/ is written, moved or modified.

Outputs under daniotype_data/commit_challenge/ (served by nginx /daniotype_data/):
  manifest.json                    the four input files: size, sha256, shape, one-line description
  cluster_public_preview.json      cluster_id + n_cells only; first 12 rows + total
  gold_features_preview.json       full 10-col schema + 5 example rows, marker lists cut to 8
  zfa_menu_preview.json            term count, hash, pinned release, branch composition, 15 samples
  h5ad_summary.json                shape, obs cols, uns keys, X dtype, thresholds, exclusions
  cluster_size_distribution.json   n_cells per cluster, sorted, for the histogram
"""
import csv
import hashlib
import json
import os
import re
import sys

# --------------------------------------------------------------------------- config
SRC = "/data/scratch/zlabel/datasets/zscape_commit_gold"
OBO = "/data/scratch/zlabel/data/ontologies/zfa.obo"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT_DIR = os.path.join(ROOT, "daniotype_data", "commit_challenge")
# The page renders fully static from a build-time import, so the bundle is ALSO mirrored into the
# route. daniotype_data/ is deliberately kept out of the serverless bundle (next.config.js: the
# 340 MB dir blew Vercel's 250 MB function cap), and this bundle is 23 KB — small enough to live
# in the route, which removes any nginx/asset-auth dependency from a page that is pure prose+JSON.
MIRROR_DIR = os.path.join(ROOT, "src", "app", "commit", "data")

H5AD = os.path.join(SRC, "zscape_gold_48hpf.h5ad")
GOLD_FEATURES = os.path.join(SRC, "gold_features.csv")
CLUSTER_PUBLIC = os.path.join(SRC, "inputs", "cluster_public.csv")
ZFA_MENU = os.path.join(SRC, "artifacts", "zfa_menu.v1.json")
H5AD_VALIDATION = os.path.join(SRC, "artifacts", "h5ad_validation.json")
CHECKSUMS = os.path.join(SRC, "CHECKSUMS.txt")

# columns withheld from the bundle (values AND names). Kept as a module constant so the leakage
# guard can test for them; never written to any emitted file.
WITHHELD_LABEL_COLS = [
    "zscape_sub_cell_type", "zscape_broad_cell_type", "zscape_tissue", "germ_layer",
]
WITHHELD_FEATURE_COL = "zscape_published_markers"

PREVIEW_ROWS_CLUSTER = 12
PREVIEW_ROWS_FEATURES = 5
MARKERS_SHOWN = 8
N_SAMPLE_TERMS = 15


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------- hard _HELDOUT guard
def _read(path, mode="r", **kw):
    """Every read in this script goes through here. Refuses anything under _HELDOUT/."""
    real = os.path.realpath(path)
    if "_HELDOUT" in real.split(os.sep):
        raise RuntimeError(
            f"BLOCKED: build attempted to read the held-out answer key: {real}\n"
            "This builder must never read _HELDOUT/ (dataset LEDGER #1)."
        )
    return open(real, mode, **kw)


def sha256_of(path):
    h = hashlib.sha256()
    with _read(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------- recorded checksums
def load_recorded_checksums():
    """Parse CHECKSUMS.txt. Lines are '<sha> <label>  <file>' or '<label>  <sha>' — tolerate both,
    and ignore any line mentioning the held-out key so we never even echo its hash."""
    out = {}
    with _read(CHECKSUMS) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "HELDOUT" in line or "gold_labels" in line:
                continue  # do not carry the answer key's hash into a public bundle
            hexes = re.findall(r"\b[0-9a-f]{64}\b", line)
            names = re.findall(r"\b[\w.]+\.(?:h5ad|csv|json)\b", line)
            if hexes and names:
                out[names[0]] = hexes[0]
    return out


# --------------------------------------------------------------------------- csv helpers
def read_csv_rows(path):
    with _read(path, newline="") as fh:
        return list(csv.reader(fh))


def infer_dtype(values):
    """Describe a column the way the file actually presents it."""
    vals = [v for v in values if v != ""]
    if not vals:
        return "string (empty)"
    if all(re.fullmatch(r"-?\d+", v) for v in vals):
        return "integer"
    if all(re.fullmatch(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?", v) for v in vals):
        return "float"
    if any(";" in v for v in vals):
        return "string (semicolon-delimited gene list)"
    return "string"


def split_markers(cell):
    return [g for g in cell.split(";") if g]


# --------------------------------------------------------------------------- 1. manifest
def build_manifest(recorded, n_clusters, gold_header, gold_rows, menu, h5_shape):
    def entry(path, display, desc, shape, extra=None):
        base = os.path.basename(path)
        rec = recorded.get(base)
        e = {
            "file": display,
            "bytes": os.path.getsize(path),
            "size_human": human(os.path.getsize(path)),
            "sha256": rec if rec else sha256_of(path),
            "sha256_source": "CHECKSUMS.txt (recorded at ingest)" if rec else "computed by this build",
            "shape": shape,
            "description": desc,
        }
        if extra:
            e.update(extra)
        return e

    return {
        "bundle": "commit_challenge",
        "built_by": "scripts/build_commit_challenge_asset.py",
        "source_row": SRC,
        "benchmark": {
            "clusters": n_clusters,
            "timepoint_hpf": 48,
            "arm": "control",
            "clustering": "GIVEN · FROZEN (ZSCAPE-published partition; we do not re-cluster)",
            "menu_version_hash": menu["menu_version_hash"],
        },
        "not_blind_caveat": (
            "We authored the gold labels; Commit did not. Any score from this row is a "
            "self-consistency / ceiling check, not an independent benchmark (dataset LEDGER #1)."
        ),
        "files": [
            entry(H5AD, "zscape_gold_48hpf.h5ad",
                  "The expression matrix. 48 hpf control arm, the frozen 112-cluster partition, "
                  "raw counts in layers['counts'] and log1p CP10k in X.",
                  f"{h5_shape[0]:,} cells x {h5_shape[1]:,} genes"),
            entry(GOLD_FEATURES, "gold_features.csv",
                  "Per-cluster marker evidence: three ordered 50-gene lists plus QC. "
                  "This is the primary challenge input.",
                  f"{len(gold_rows):,} rows x {len(gold_header)} columns",
                  {"columns_withheld": 1,
                   "withheld_note": (
                       "One column of ZSCAPE's own published marker calls is excluded from the "
                       "challenge input and from this bundle: the answer key was translated from "
                       "ZSCAPE's annotations, so their marker calls are downstream of the key."
                   )}),
            entry(CLUSTER_PUBLIC, "inputs/cluster_public.csv",
                  "Cluster roster. Only the identifier and the cell count are exposed as challenge "
                  "input.",
                  f"{n_clusters:,} rows x 2 columns exposed",
                  {"columns_in_source": 6,
                   "columns_exposed": 2,
                   "columns_withheld": 4,
                   "withheld_note": (
                       "Four ZSCAPE label-tier columns exist in the source file and are withheld. "
                       "Their values and their names are both absent from this bundle; the page "
                       "names them in its own copy. The answer key was translated from these "
                       "columns, so exposing them would hand over the answer."
                   )}),
            entry(ZFA_MENU, "artifacts/zfa_menu.v1.json",
                  "The frozen answer space. Every label, both sides, must be one of these ZFA "
                  "terms — parity is proven by matching the menu hash.",
                  f"{menu['n_terms']:,} terms"),
        ],
    }


def human(n):
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024.0


# --------------------------------------------------------------------------- 2. cluster_public
def build_cluster_public(header, rows):
    i_id, i_n = header.index("cluster_id"), header.index("n_cells")
    kept = [{"cluster_id": r[i_id], "n_cells": int(r[i_n])} for r in rows]
    return {
        "file": "inputs/cluster_public.csv",
        "columns": ["cluster_id", "n_cells"],
        "column_dtypes": {"cluster_id": "string", "n_cells": "integer"},
        "total_rows": len(kept),
        "preview_rows": PREVIEW_ROWS_CLUSTER,
        "restriction": (
            "Restricted view. The source file carries additional label-tier columns which are "
            "withheld from the challenge; only the identifier and cell count are shown."
        ),
        "total_cells": sum(r["n_cells"] for r in kept),
        "rows": kept[:PREVIEW_ROWS_CLUSTER],
    }


# --------------------------------------------------------------------------- 3. gold_features
def build_gold_features(header, rows):
    marker_cols = ["top_50_markers", "bottom_50_markers", "family_50_markers"]
    cols = [c for c in header if c != WITHHELD_FEATURE_COL]
    idx = {c: header.index(c) for c in header}

    schema = []
    for c in header:
        col_vals = [r[idx[c]] for r in rows]
        item = {
            "column": c,
            "dtype": infer_dtype(col_vals),
            "in_challenge_input": c != WITHHELD_FEATURE_COL,
        }
        if c in marker_cols:
            lens = [len(split_markers(v)) for v in col_vals]
            item["genes_per_row"] = {"min": min(lens), "max": max(lens)}
        if c == WITHHELD_FEATURE_COL:
            item["excluded_reason"] = (
                "ZSCAPE's own published marker calls — downstream of the answer key, so excluded "
                "from the challenge input and from this bundle."
            )
        schema.append(item)

    examples = []
    for r in rows[:PREVIEW_ROWS_FEATURES]:
        rec = {}
        for c in cols:
            v = r[idx[c]]
            if c in marker_cols:
                genes = split_markers(v)
                rec[c] = {
                    "shown": genes[:MARKERS_SHOWN],
                    "n_total": len(genes),
                    "more": max(0, len(genes) - MARKERS_SHOWN),
                    "more_label": f"+{max(0, len(genes) - MARKERS_SHOWN)} more",
                }
            elif infer_dtype([v]) == "integer":
                rec[c] = int(v)
            elif infer_dtype([v]) == "float":
                rec[c] = float(v)
            else:
                rec[c] = v
        examples.append(rec)

    return {
        "file": "gold_features.csv",
        "total_rows": len(rows),
        "total_columns": len(header),
        "columns_in_challenge_input": len(cols),
        "schema": schema,
        "marker_columns": marker_cols,
        "markers_shown_per_list": MARKERS_SHOWN,
        "preview_rows": len(examples),
        "note": (
            "Marker lists are truncated for display. The challenge input carries all 50 genes per "
            "list, in rank order."
        ),
        "rows": examples,
    }


# --------------------------------------------------------------------------- 4. zfa menu
def parse_obo_isa(path):
    """Minimal OBO reader: id -> list of is_a parents. Used only to compute depth for sampling."""
    parents, cur = {}, None
    with _read(path) as fh:
        for line in fh:
            line = line.rstrip("\n")
            if line == "[Term]":
                cur = None
            elif line.startswith("id: "):
                cur = line[4:].strip()
                parents.setdefault(cur, [])
            elif line.startswith("is_a: ") and cur:
                parents[cur].append(line[6:].split("!")[0].strip())
    return parents


def compute_depths(ids, parents):
    """Shortest is_a distance to a root. Iterative + memoised; cycle-safe."""
    depth, visiting = {}, set()

    def d(t):
        if t in depth:
            return depth[t]
        if t in visiting:
            return 0
        ps = [p for p in parents.get(t, []) if p in parents]
        if not ps:
            depth[t] = 0
            return 0
        visiting.add(t)
        depth[t] = 1 + min(d(p) for p in ps)
        visiting.discard(t)
        return depth[t]

    sys.setrecursionlimit(10000)
    return {t: d(t) for t in ids}


def build_zfa_menu(menu, banned_label_strings):
    terms = menu["terms"]
    caro = menu["caro_breakdown"]

    # requested 3-way rollup over the 5-way CARO stratification the artifact records
    anatomical = ["tissue", "multi_tissue_structure", "organ"]
    branches = {
        "cell": {
            "n": caro.get("cell", 0),
            "caro_strata": ["cell"],
            "note": "CARO 'cell' stratum — terms naming a cell type.",
        },
        "anatomical_structure": {
            "n": sum(caro.get(k, 0) for k in anatomical),
            "caro_strata": anatomical,
            "breakdown": {k: caro.get(k, 0) for k in anatomical},
            "note": "CARO tissue / multi-tissue-structure / organ strata.",
        },
        "neither": {
            "n": caro.get("above-roots", 0),
            "caro_strata": ["above-roots"],
            "note": (
                "Terms sitting above the CARO roots — they resolve to neither branch. Mostly "
                "developmental-stage-scoped and whole-organism-level anatomy."
            ),
        },
    }

    # depth, for spreading the samples rather than taking the alphabetical head
    depths = {}
    depth_available = os.path.exists(OBO)
    if depth_available:
        parents = parse_obo_isa(OBO)
        depths = compute_depths([t["id"] for t in terms], parents)

    # exclude any term whose name collides with a known label string, so the bundle-wide leakage
    # assertion is absolute rather than caveated. The menu itself is a public input and legitimately
    # contains anatomy vocabulary; this only constrains which 15 we display.
    # Use the same word-boundary test the guard applies, not an exact-name match: a label string
    # can sit INSIDE a longer term name ("hair cell" inside "anterior macula hair cell").
    banned_re = [re.compile(r"(?<![a-z0-9])" + re.escape(s.lower()) + r"(?![a-z0-9])")
                 for s in banned_label_strings if len(s) >= 3]
    pool = [t for t in terms
            if not any(r.search(t["name"].lower()) for r in banned_re)]

    samples = []
    if depth_available and pool:
        dmax = max(depths.get(t["id"], 0) for t in pool)
        # walk the depth range and take a term from each level, cycling to fill 15
        by_depth = {}
        for t in pool:
            by_depth.setdefault(depths.get(t["id"], 0), []).append(t)
        levels = sorted(by_depth)
        round_i = 0
        while len(samples) < N_SAMPLE_TERMS and round_i < 40:
            for lv in levels:
                bucket = by_depth[lv]
                if round_i < len(bucket) and len(samples) < N_SAMPLE_TERMS:
                    # stride through the bucket so we don't take consecutive ids
                    t = bucket[(round_i * max(1, len(bucket) // 5)) % len(bucket)]
                    if t["id"] not in {s["id"] for s in samples}:
                        samples.append({"id": t["id"], "name": t["name"], "caro": t["caro"],
                                        "depth": lv})
            round_i += 1
        samples.sort(key=lambda s: s["depth"])
    else:
        step = max(1, len(pool) // N_SAMPLE_TERMS)
        samples = [{"id": t["id"], "name": t["name"], "caro": t["caro"]}
                   for t in pool[::step][:N_SAMPLE_TERMS]]

    out = {
        "file": "artifacts/zfa_menu.v1.json",
        "version": menu["version"],
        "menu_version_hash": menu["menu_version_hash"],
        "n_terms": menu["n_terms"],
        "rule": menu["rule"],
        "source": {
            "obo": menu["source"].get("obo"),
            "obo_sha256": menu["source"].get("obo_sha256"),
            "release": menu["source"].get("obo_data_version"),
            "obo_date_stamp": menu["source"].get("obo_date"),
        },
        "caro_breakdown": caro,
        "branches": branches,
        "sample_terms": samples,
        "sample_note": (
            "Fifteen terms spread across the ontology depth range (shortest is_a distance to a "
            "root), not the alphabetical head."
            if depth_available else
            "Fifteen terms sampled at a fixed stride across the menu (depth unavailable: obo absent)."
        ),
    }
    if depth_available:
        dvals = [depths.get(t["id"], 0) for t in terms]
        out["depth_range"] = {"min": min(dvals), "max": max(dvals)}
        out["depth_histogram"] = {str(k): dvals.count(k) for k in sorted(set(dvals))}
    return out


# --------------------------------------------------------------------------- 5. h5ad summary
def build_h5ad_summary(n_clusters, total_cells):
    """Prefer the recorded validation artifact; read only file METADATA (group keys, dtypes) for
    the fields it does not carry. The 483 MB of matrix data is never loaded."""
    val = json.load(_read(H5AD_VALIDATION))
    checks = {c["check"]: c for c in val.get("checks", [])}

    shape = None
    for c in checks:
        m = re.search(r"([\d,]+)\s*x\s*([\d,]+)", checks[c].get("detail", ""))
        if m and "shape" in c:
            shape = [int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))]
            break

    obs_cols, uns_keys, obsm_keys, layers, x_dtype, counts_dtype = [], [], [], [], None, None
    processing, n_dropped = {}, None
    try:
        import h5py
        with h5py.File(H5AD, "r") as f:          # metadata only — no matrix reads
            obs_cols = sorted(k for k in f["obs"].keys() if not k.startswith("_"))
            uns_keys = sorted(f["uns"].keys()) if "uns" in f else []
            obsm_keys = sorted(f["obsm"].keys()) if "obsm" in f else []
            layers = sorted(f["layers"].keys()) if "layers" in f else []
            x = f["X"]
            x_dtype = str(x["data"].dtype) if isinstance(x, type(f["obs"])) else str(x.dtype)
            if "layers" in f and "counts" in f["layers"]:
                c = f["layers"]["counts"]
                counts_dtype = str(c["data"].dtype) if hasattr(c, "keys") else str(c.dtype)
            # uns['processing'] is public methodology — scalars only, no labels
            if "uns" in f and "processing" in f["uns"]:
                for k in f["uns"]["processing"].keys():
                    try:
                        v = f["uns"]["processing"][k][()]
                    except Exception:
                        continue
                    if isinstance(v, bytes):
                        v = v.decode()
                    elif hasattr(v, "item"):
                        v = v.item()
                    processing[k] = v
            # uns['dropped_clusters'] is keyed by ZSCAPE LABEL NAME — count only, names withheld
            if "uns" in f and "dropped_clusters" in f["uns"]:
                n_dropped = len(list(f["uns"]["dropped_clusters"].keys()))
        meta_source = "h5py metadata read (group keys + dtypes only; no matrix data loaded)"
    except Exception as e:                        # pragma: no cover
        meta_source = f"unavailable ({type(e).__name__}) — validation artifact only"

    # withheld label columns must not surface via the obs listing either
    obs_cols = [c for c in obs_cols if c not in WITHHELD_LABEL_COLS]

    return {
        "file": "zscape_gold_48hpf.h5ad",
        "sha256": val.get("sha256"),
        "shape": {"cells": shape[0] if shape else total_cells,
                  "genes": shape[1] if shape else None},
        "clusters": n_clusters,
        "cluster_obs_key": val.get("cluster_obs_key"),
        "timepoint_hpf": 48,
        "arm": "control",
        "X": {"contents": "log1p CP10k", "dtype": x_dtype},
        "layers": {"present": layers, "counts_dtype": counts_dtype,
                   "note": "layers['counts'] holds the integer counts."},
        "obs_columns": obs_cols,
        "obs_columns_note": (
            "Label-tier columns are withheld from this bundle and are not listed."
        ),
        "uns_keys": uns_keys,
        "uns_note": (
            "uns['dropped_clusters'] is keyed by ZSCAPE label name — the count is reported below, "
            "the names are withheld from this bundle."
        ),
        "processing": processing,
        "obsm_keys": obsm_keys,
        "inclusion_rule": {
            "threshold": "clusters with >= 50 cells",
            "threshold_from_file": processing.get("min_cells_per_cluster"),
            "included": n_clusters,
            "excluded_upstream": n_dropped if n_dropped is not None else 26,
            "excluded_count_verified_from": (
                "uns['dropped_clusters'] — %s entries" % n_dropped
                if n_dropped is not None else "documentation only"
            ),
            "excluded_names_withheld": True,
            "note": (
                "26 clusters were excluded upstream (below the 50-cell threshold) before the "
                "challenge set was cut. The file DOES retain them, in uns['dropped_clusters'], "
                "keyed by ZSCAPE label name — so those names are deliberately withheld from this "
                "bundle. They are not answers to any scored cluster (the 26 are excluded), but "
                "they are ZSCAPE label vocabulary, which the challenge withholds. ZSCAPE's own "
                "thresholds (UMI >= 100, mito < 25%, hash ratio >= 5) are already enforced "
                "upstream — double-filtering is an explicit failure mode."
            ),
        },
        "validation_checks": [
            {"check": c["check"], "verdict": c["verdict"]} for c in val.get("checks", [])
        ],
        "provenance": {
            "from_validation_artifact": "sha256, shape, cluster key, validation checks",
            "from_file_metadata": meta_source,
        },
    }


# --------------------------------------------------------------------------- 6. size distribution
def build_size_distribution(header, rows):
    i_id, i_n = header.index("cluster_id"), header.index("n_cells")
    pairs = sorted(((r[i_id], int(r[i_n])) for r in rows), key=lambda p: -p[1])
    sizes = [n for _, n in pairs]
    n = len(sizes)

    def pct(p):
        return sorted(sizes)[min(n - 1, int(round(p * (n - 1))))]

    return {
        "source": "inputs/cluster_public.csv",
        "n_clusters": n,
        "total_cells": sum(sizes),
        "threshold": 50,
        "stats": {
            "min": min(sizes), "max": max(sizes),
            "median": pct(0.5), "p25": pct(0.25), "p75": pct(0.75),
            "mean": round(sum(sizes) / n, 1),
        },
        "clusters": [{"cluster_id": c, "n_cells": s} for c, s in pairs],
        "sizes_sorted_desc": sizes,
    }


# --------------------------------------------------------------------------- leakage guard
def leakage_guard(out_dir, label_strings, published_marker_runs):
    """Grep every emitted JSON for the withheld label column names, for known label strings, and
    for contiguous gene runs lifted from the withheld published-marker column.

    NOTE on zscape_published_markers: its NAME is required to appear, once, in the schema listing
    (the spec asks for the full 10-column schema and the column must be visibly marked excluded).
    Its VALUES are the leak risk, so the guard tests 5-gene contiguous runs from that column
    instead of the bare column name. A 5-gene run in identical order is not something a legitimate
    marker list reproduces by chance.
    Zero hits required; anything else fails the build before the bundle is trusted."""
    patterns = [("column-name", c) for c in WITHHELD_LABEL_COLS]
    patterns += [("label-string", s) for s in label_strings]
    patterns += [("published-marker-run", r) for r in published_marker_runs]

    hits, scanned = [], []
    for fn in sorted(os.listdir(out_dir)):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(out_dir, fn)
        with open(path) as fh:
            blob = fh.read()
        low = blob.lower()
        scanned.append(fn)
        for kind, pat in patterns:
            p = pat.lower()
            if not p or len(p) < 3:
                continue
            # word-boundary match so short germ-layer words don't fire on substrings
            if re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", low):
                hits.append({"file": fn, "kind": kind, "pattern": pat})
    return scanned, patterns, hits


# --------------------------------------------------------------------------- main
def main():
    log("=" * 78)
    log("ZSCAPE Commit challenge — asset bundle build")
    log("=" * 78)
    log(f"source (read-only): {SRC}")
    log("_HELDOUT/ guard: ARMED (any read under _HELDOUT/ raises)\n")

    recorded = load_recorded_checksums()
    log(f"recorded checksums parsed from CHECKSUMS.txt: {len(recorded)} "
        f"({', '.join(sorted(recorded))})")

    cp = read_csv_rows(CLUSTER_PUBLIC)
    cp_header, cp_rows = cp[0], cp[1:]
    gf = read_csv_rows(GOLD_FEATURES)
    gf_header, gf_rows = gf[0], gf[1:]
    menu = json.load(_read(ZFA_MENU))
    log(f"read: cluster_public {len(cp_rows)}x{len(cp_header)} | "
        f"gold_features {len(gf_rows)}x{len(gf_header)} | menu {menu['n_terms']} terms")

    # label strings for the guard — sampled from the withheld columns, which we read but never emit
    label_vals = []
    for c in WITHHELD_LABEL_COLS:
        if c in cp_header:
            i = cp_header.index(c)
            label_vals += [r[i] for r in cp_rows if r[i]]
    # ALL distinct withheld values, not a sample of 20. The spec asked for 20; using the full set
    # is strictly stronger and costs nothing, and it keeps the ZFA sample terms clear of every
    # withheld string rather than just the first twenty. (ZFA term names that collide with a label
    # are not themselves a leak — the contestant receives the entire menu — but excluding them
    # makes the end-to-end assertion absolute instead of caveated.)
    seen, label_sample = set(), []
    for v in label_vals:
        if v.lower() not in seen and len(v) >= 4:
            seen.add(v.lower())
            label_sample.append(v)
    # the 26 dropped-cluster names in uns['dropped_clusters'] are ZSCAPE label vocabulary too
    n_from_cols = len(label_sample)
    dropped_names = []
    try:
        import h5py
        with h5py.File(H5AD, "r") as f:
            if "uns" in f and "dropped_clusters" in f["uns"]:
                dropped_names = [str(k) for k in f["uns"]["dropped_clusters"].keys()]
    except Exception as e:
        log(f"  ! could not read uns['dropped_clusters'] ({type(e).__name__}) — guard narrower")
    for v in dropped_names:
        if v.lower() not in seen and len(v) >= 4:
            seen.add(v.lower())
            label_sample.append(v)
    log(f"leakage-guard label sample: {len(label_sample)} distinct strings "
        f"({n_from_cols} from withheld columns + {len(label_sample) - n_from_cols} "
        f"dropped-cluster names)")

    # value-level patterns for the withheld published-marker column: contiguous 5-gene runs
    published_runs = []
    if WITHHELD_FEATURE_COL in gf_header:
        i = gf_header.index(WITHHELD_FEATURE_COL)
        for r in gf_rows:
            genes = split_markers(r[i])
            for start in (0, max(0, len(genes) // 2 - 2)):
                run = genes[start:start + 5]
                if len(run) == 5:
                    published_runs.append(";".join(run))
    published_runs = list(dict.fromkeys(published_runs))
    log(f"leakage-guard published-marker runs: {len(published_runs)} contiguous 5-gene sequences")

    os.makedirs(OUT_DIR, exist_ok=True)

    n_clusters = len(cp_rows)
    total_cells = sum(int(r[cp_header.index('n_cells')]) for r in cp_rows)

    log("\nbuilding…")
    h5 = build_h5ad_summary(n_clusters, total_cells)
    shape = (h5["shape"]["cells"], h5["shape"]["genes"])
    outputs = {
        "manifest.json": build_manifest(recorded, n_clusters, gf_header, gf_rows, menu, shape),
        "cluster_public_preview.json": build_cluster_public(cp_header, cp_rows),
        "gold_features_preview.json": build_gold_features(gf_header, gf_rows),
        "zfa_menu_preview.json": build_zfa_menu(menu, label_sample),
        "h5ad_summary.json": h5,
        "cluster_size_distribution.json": build_size_distribution(cp_header, cp_rows),
    }

    # write to a staging dir first so a guard failure never leaves a trusted-looking bundle
    staging = OUT_DIR + ".staging"
    os.makedirs(staging, exist_ok=True)
    for fn, obj in outputs.items():
        with open(os.path.join(staging, fn), "w") as fh:
            json.dump(obj, fh, indent=1)
        log(f"  {fn:34s} {os.path.getsize(os.path.join(staging, fn)):>9,} B")

    log("\n" + "-" * 78)
    log("LEAKAGE GUARD")
    log("-" * 78)
    scanned, patterns, hits = leakage_guard(staging, label_sample, published_runs)
    log(f"files scanned : {len(scanned)} ({', '.join(scanned)})")
    log(f"patterns      : {len(patterns)} ({len(WITHHELD_LABEL_COLS)} withheld column names + "
        f"{len(label_sample)} label strings + {len(published_runs)} published-marker gene runs)")
    log(f"hits          : {len(hits)}")
    if hits:
        for h in hits:
            log(f"    ✗ {h['file']}: {h['kind']} '{h['pattern']}'")
        # tear down staging — do not publish a bundle that failed the assertion
        for fn in os.listdir(staging):
            os.remove(os.path.join(staging, fn))
        os.rmdir(staging)
        raise SystemExit(
            "\nBUILD FAILED: leakage guard found withheld content in the emitted bundle.\n"
            "Nothing was written to daniotype_data/commit_challenge/."
        )
    log("ASSERTION: zero hits — PASS ✓")

    # promote staging -> live
    os.makedirs(OUT_DIR, exist_ok=True)
    for fn in os.listdir(staging):
        os.replace(os.path.join(staging, fn), os.path.join(OUT_DIR, fn))
    os.rmdir(staging)

    # mirror into the route so /commit renders without fetching anything
    os.makedirs(MIRROR_DIR, exist_ok=True)
    for fn in outputs:
        with open(os.path.join(OUT_DIR, fn)) as src_fh, \
             open(os.path.join(MIRROR_DIR, fn), "w") as dst_fh:
            dst_fh.write(src_fh.read())

    log("\n" + "-" * 78)
    log(f"bundle written: {OUT_DIR}")
    log(f"mirrored to   : {MIRROR_DIR}")
    log("-" * 78)
    return outputs


if __name__ == "__main__":
    main()
