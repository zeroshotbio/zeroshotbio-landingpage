#!/usr/bin/env python3
"""Build the /dev_tree prototype dataset: a 0-24 hpf zebrafish developmental
tidy tree derived from DanioCell annotations, timed by DanioCell stage
metadata and annotated (not structured) by ZFA.

IMPORTANT — what the tree edges mean:
  The parent/child edges are ANNOTATION CONTAINMENT from the DanioCell
  cluster annotation table (tissue.subsets -> tissue -> identity.super),
  NOT cell lineage. DanioCell carries no lineage tracing. ZFA `develops_from`
  edges ARE lineage-flavoured and are attached to nodes as a separate,
  clearly-labelled annotation; they are never used to build the tree.

Inputs (read-only, on-instance):
  /data/datasets/zebrafish/DanioCell/GSE223922_Sur2023_metadata.tsv.gz
  /data/datasets/zebrafish/DanioCell/sources/supplementary/cluster_annotations.csv
  /data/scratch/zlabel/data/ontologies/zfa.obo

Output:
  public/dev_tree/tree.json  (also inlined into index.html by build_dev_tree_page.py)
"""
from __future__ import annotations

import collections
import csv
import gzip
import json
import sys
from pathlib import Path

DANIOCELL = Path("/data/datasets/zebrafish/DanioCell")
META = DANIOCELL / "GSE223922_Sur2023_metadata.tsv.gz"
ANN = DANIOCELL / "sources/supplementary/cluster_annotations.csv"
ZFA_OBO = Path("/data/scratch/zlabel/data/ontologies/zfa.obo")
OUT = Path(__file__).resolve().parent.parent / "public/dev_tree/tree.json"

HPF_MAX = 48          # the requested window
MIN_CELLS = 20        # prune leaves thinner than this — prototype legibility
DOUBLET_LABEL = "likely doublets"   # QC class in identity.super; not a cell type
ONSET_Q = 0.02        # onset = hpf where 2% of a node's cells have appeared
ZFA_DOMINANCE = 0.5   # a node shows a ZFA term only if it covers this share
OFFSET_Q = 0.98

# Kimmel et al. 1995 periods, for the time-axis bands. Begin times match
# daniotype.ontology.zfs_stages (the ZFIN staging series at 28.5 C).
PERIODS = [
    ("Cleavage",     0.75,  2.25),
    ("Blastula",     2.25,  5.25),
    ("Gastrula",     5.25, 10.0),
    ("Segmentation", 10.0, 24.0),
    ("Pharyngula",   24.0, 48.0),
    ("Hatching",     48.0, 72.0),
]


def load_annotations() -> dict[str, dict]:
    with open(ANN, encoding="utf-8-sig") as fh:
        return {r["clust"]: r for r in csv.DictReader(fh)}


def load_window() -> tuple[dict[str, collections.Counter], collections.Counter, dict[str, str]]:
    """Per-cluster hpf histograms inside the window, the cell count each cluster
    has AFTER the window, and a tissue.name fallback for unannotated clusters."""
    hist: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    after: collections.Counter = collections.Counter()
    tissue_name: dict[str, str] = {}
    with gzip.open(META, "rt") as fh:
        for row in csv.DictReader(fh, delimiter="\t"):
            try:
                hpf = int(row["stage.integer"])
            except (TypeError, ValueError):
                continue
            clust = row["clust"]
            if hpf > HPF_MAX:
                # Counted, not plotted: a tip whose cluster keeps going past the
                # window has been CUT by the window, not ended by development,
                # and the page has to be able to say which.
                after[clust] += 1
                continue
            hist[clust][hpf] += 1
            tissue_name.setdefault(clust, row["tissue.name"] or row["tissue"])
    return hist, after, tissue_name


def quantile_hpf(hist: collections.Counter, q: float) -> float:
    """Smallest hpf at which the cumulative fraction of cells reaches q."""
    total = sum(hist.values())
    target = total * q
    run = 0
    for hpf in sorted(hist):
        run += hist[hpf]
        if run >= target:
            return float(hpf)
    return float(max(hist))


def load_zfa() -> dict[str, dict]:
    """Minimal OBO reader — id, name, is_a, part_of, develops_from.

    Deliberately not `obonet`/`networkx`: this script runs under the system
    python on the instance, and the three fields below are all the page needs.
    Same edge-type semantics as daniotype.ontology.zfa (is_a + part_of are
    subsumption; develops_from is lineage and is kept apart).
    """
    terms: dict[str, dict] = {}
    cur: dict | None = None
    in_term = False
    for raw in ZFA_OBO.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.rstrip()
        if line == "[Term]":
            in_term = True
            cur = {"id": None, "name": None, "is_a": [], "part_of": [],
                   "develops_from": [], "obsolete": False}
            continue
        if line.startswith("["):          # [Typedef] etc.
            in_term = False
            cur = None
            continue
        if not in_term or cur is None or not line:
            continue
        if line.startswith("id: "):
            cur["id"] = line[4:].strip()
            terms[cur["id"]] = cur
        elif line.startswith("name: "):
            cur["name"] = line[6:].strip()
        elif line.startswith("is_obsolete: true"):
            cur["obsolete"] = True
        elif line.startswith("is_a: "):
            cur["is_a"].append(line[6:].split("!")[0].strip())
        elif line.startswith("relationship: part_of "):
            cur["part_of"].append(line[len("relationship: part_of "):].split("!")[0].strip())
        elif line.startswith("relationship: develops_from "):
            cur["develops_from"].append(
                line[len("relationship: develops_from "):].split("!")[0].strip())
    return terms


def zfa_label(terms: dict[str, dict], tid: str) -> str | None:
    t = terms.get(tid)
    return t["name"] if t and t.get("name") else None


def structural_kind(terms: dict[str, dict], tid: str) -> str | None:
    """Coarse ZFA structural bucket via is_a* ancestry.

    Roots and the is_a-only rule are taken from /data/darien_ZFA.md (the
    on-instance ZFA structural-bucket export, ontology release 2026-06-02).
    This is a STRUCTURAL classification of the anatomical term — it is not a
    labelling-depth ladder and it is not lineage.
    """
    roots = {
        "ZFA:0009000": "cell",
        "ZFA:0001477": "tissue",
        "ZFA:0001488": "multi-tissue structure",
        "ZFA:0000496": "organ",
        "ZFA:0001492": "organ",
        "ZFA:0001439": "anatomical system",
        "ZFA:0001487": "organism substance",
        "ZFA:0001308": "organism subdivision",
        # Six terms the atlas leans on (tail bud, hatching gland, the placodes,
        # presumptive endoderm, axial chorda mesoderm) sit off the
        # cell/tissue/organ ladder entirely: ZFA files them as things that
        # exist only during development. That is a real distinction, so they
        # get their own bucket rather than being forced onto the ladder.
        "ZFA:0001105": "embryonic structure",
        "ZFA:0001116": "embryonic structure",
    }
    seen, frontier = set(), [tid]
    hits = set()
    if tid in roots:
        hits.add(roots[tid])
    while frontier:
        nxt = []
        for node in frontier:
            term = terms.get(node)
            if not term:
                continue
            for parent in term["is_a"]:      # is_a only — see docstring
                if parent in seen:
                    continue
                seen.add(parent)
                if parent in roots:
                    hits.add(roots[parent])
                nxt.append(parent)
        frontier = nxt
    # Most specific bucket wins where a term reaches more than one root.
    for kind in ("cell", "tissue", "multi-tissue structure", "organ",
                 "anatomical system", "organism substance", "organism subdivision",
                 "embryonic structure"):
        if kind in hits:
            return kind
    return None


def main() -> int:
    ann = load_annotations()
    hist, after, tissue_name = load_window()
    zfa = load_zfa()

    # ---- assemble leaves: one per (tissue.subsets, tissue, identity.super) ----
    leaves: dict[tuple[str, str, str], dict] = {}
    unannotated_cells = 0
    doublet_cells = 0
    doublet_clusters = 0
    for clust, h in hist.items():
        a = ann.get(clust)
        if a is None:
            # `ceph` is the one metadata cluster with no annotation row.
            unannotated_cells += sum(h.values())
            key = (tissue_name.get(clust, "unassigned"),
                   tissue_name.get(clust, "unassigned"),
                   "unannotated cluster")
            sup, sub, zid = "unannotated cluster", "", ""
        elif a["identity.super"].strip().lower() == DOUBLET_LABEL:
            # Technical QC category, not a cell type — kept out of the tree
            # and reported in meta.
            doublet_cells += sum(h.values())
            doublet_clusters += 1
            continue
        else:
            # 48 annotation rows have a blank `tissue`; all but one are the
            # doublet class dropped above. Fall back to the identity name.
            tissue = a["tissue"].strip() or a["identity.super"].strip() or a["tissue.subsets"]
            key = (a["tissue.subsets"], tissue, a["identity.super"])
            sup, sub, zid = a["identity.super"], a["identity.sub"], a["zfin"]
        node = leaves.setdefault(key, {
            "hist": collections.Counter(), "clusters": [], "zfa": collections.Counter(),
            "after": 0,
        })
        node["hist"].update(h)
        node["after"] += after.get(clust, 0)
        node["clusters"].append({
            "clust": clust,
            "sub": sub,
            "cells": sum(h.values()),
            "first": min(h), "last": max(h),
            "after": after.get(clust, 0),
        })
        for one in (z.strip() for z in zid.split(",") if z.strip()):
            node["zfa"][one] += sum(h.values())

    total_cells = sum(sum(v["hist"].values()) for v in leaves.values())

    # ---- prune thin leaves ----
    kept = {k: v for k, v in leaves.items() if sum(v["hist"].values()) >= MIN_CELLS}
    pruned_leaves = len(leaves) - len(kept)
    pruned_cells = total_cells - sum(sum(v["hist"].values()) for v in kept.values())

    # ---- build the node tree ----
    def new_node(name: str, level: str) -> dict:
        return {"name": name, "level": level, "children": [],
                "hist": collections.Counter(), "clusters": [],
                "zfa": collections.Counter(), "after": 0}

    root = new_node("embryo", "root")
    index: dict[tuple, dict] = {(): root}
    for (subset, tissue, sup), v in sorted(kept.items()):
        path = [(subset, "program"), (tissue, "tissue"), (sup, "identity")]
        cur = root
        acc: list = []
        for name, level in path:
            acc.append(name)
            key = tuple(acc)
            if key not in index:
                child = new_node(name, level)
                index[key] = child
                cur["children"].append(child)
            cur = index[key]
        cur["hist"].update(v["hist"])
        cur["clusters"] = sorted(v["clusters"], key=lambda c: -c["cells"])
        cur["zfa"].update(v["zfa"])
        cur["after"] += v["after"]

    # ---- roll counts up, derive times, attach ZFA ----
    def roll(node: dict) -> None:
        for child in node["children"]:
            roll(child)
            node["hist"].update(child["hist"])
            node["zfa"].update(child["zfa"])
            node["after"] += child["after"]

        node["cells"] = sum(node["hist"].values())
        node["onset"] = quantile_hpf(node["hist"], ONSET_Q)
        node["offset"] = quantile_hpf(node["hist"], OFFSET_Q)
        node["first"] = float(min(node["hist"])) if node["hist"] else 0.0
        node["last"] = float(max(node["hist"])) if node["hist"] else 0.0
        node["peak"] = float(max(node["hist"], key=lambda h: node["hist"][h])) if node["hist"] else 0.0
        # A parent cannot start after its own subtree does.
        if node["children"]:
            node["onset"] = min([node["onset"]] + [c["onset"] for c in node["children"]])
            node["offset"] = max([node["offset"]] + [c["offset"] for c in node["children"]])
        node["stages"] = [[h, node["hist"][h]] for h in sorted(node["hist"])]
        # `continues` says the window truncated this branch; without it a bar
        # ending at 24 hpf reads as "this cell type stops here", which is false
        # for almost every tip in the tree.
        node["continues"] = node["after"] > 0

        # ZFA is an ANNOTATION on the node, never a structural input. Only
        # attach a term where it actually dominates the node's ZFA-carrying
        # cells — otherwise an internal node would inherit whichever term its
        # biggest descendant happened to carry, which says nothing true about
        # the node itself.
        zfa_total = sum(node["zfa"].values())
        dominant = node["zfa"].most_common(1)[0] if node["zfa"] else None
        if dominant and node["level"] != "root" and dominant[1] >= ZFA_DOMINANCE * zfa_total:
            tid, _ = dominant
            term = zfa.get(tid)
            node["zfa_id"] = tid
            node["zfa_name"] = zfa_label(zfa, tid)
            node["zfa_kind"] = structural_kind(zfa, tid) if term else None
            node["zfa_develops_from"] = [
                {"id": p, "name": zfa_label(zfa, p)}
                for p in (term["develops_from"] if term else [])
            ]
            node["zfa_is_a"] = [
                {"id": p, "name": zfa_label(zfa, p)}
                for p in (term["is_a"] if term else [])
            ]
            node["zfa_all"] = [
                {"id": t, "name": zfa_label(zfa, t), "cells": n}
                for t, n in node["zfa"].most_common(6)
            ]
    roll(root)

    def strip_work(node: dict) -> None:
        del node["hist"], node["zfa"]
        for child in node["children"]:
            strip_work(child)

    strip_work(root)

    # sort children by onset then size — reads left-to-right, early first
    def sort_tree(node: dict) -> None:
        node["children"].sort(key=lambda c: (c["onset"], -c["cells"]))
        for child in node["children"]:
            sort_tree(child)

    sort_tree(root)

    # A program with a single identically-named tissue child (neural/neural,
    # eye/eye, ...) is one rung of pure repetition. Fold it away so the depth
    # of a branch means something.
    def collapse(node: dict) -> None:
        while len(node["children"]) == 1 and node["children"][0]["name"] == node["name"]:
            only = node["children"][0]
            node["children"] = only["children"]
            node["clusters"] = node["clusters"] or only["clusters"]
            node["after"] = max(node["after"], only["after"])
            node["collapsed_from"] = node.get("collapsed_from", []) + [only["level"]]
        for child in node["children"]:
            collapse(child)

    collapse(root)

    n_nodes = 0
    def count(node: dict) -> None:
        nonlocal n_nodes
        n_nodes += 1
        for c in node["children"]:
            count(c)
    count(root)

    payload = {
        "meta": {
            "window_hpf": [0, HPF_MAX],
            "observed_hpf": [root["first"], root["last"]],
            "cells": root["cells"],
            "cells_before_prune": total_cells,
            "nodes": n_nodes,
            "leaves": len(kept),
            "pruned_leaves": pruned_leaves,
            "pruned_cells": pruned_cells,
            "unannotated_cells": unannotated_cells,
            "doublet_cells": doublet_cells,
            "doublet_clusters": doublet_clusters,
            "zfa_dominance": ZFA_DOMINANCE,
            "min_cells": MIN_CELLS,
            "onset_quantile": ONSET_Q,
            "offset_quantile": OFFSET_Q,
            "periods": [{"name": n, "begin": b, "end": e} for n, b, e in PERIODS],
            "sources": {
                "expression": "DanioCell / Sur et al. 2023, Dev Cell 58:3028 (GSE223922)",
                "annotation": "GSE223922 cluster_annotations.csv (tissue.subsets / tissue / identity.super)",
                "ontology": "ZFA zfa.obo, releases/2026-06-02",
            },
        },
        "tree": root,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    print(f"  {root['cells']:,} cells, {n_nodes} nodes, {len(kept)} leaves")
    print(f"  pruned {pruned_leaves} leaves / {pruned_cells:,} cells (<{MIN_CELLS} cells)")
    print(f"  excluded {doublet_clusters} '{DOUBLET_LABEL}' clusters / {doublet_cells:,} cells")
    print(f"  observed window {root['first']:.0f}-{root['last']:.0f} hpf")
    return 0


if __name__ == "__main__":
    sys.exit(main())
