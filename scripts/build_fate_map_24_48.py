#!/usr/bin/env python3
"""Build /fate_map_24_48 — the Platt inferred state graph over the 24-48 hpf window.

FIRST PASS. One source only: the Trapnell lab's v2.2.1 reference release, held at
`/data/datasets/zebrafish/Platt/sources/data/`. ZSCAPE, ZMAP and DanioCell are
deliberately NOT integrated yet; see public/fate_map_24_48/NOTES.md for why the
seams are where they are.

Three inputs, and each one answers a different question:

  combined_state_graphs.rds       WHAT connects to what.   186 states, 173 directed
                                  edges, a DAG in 26 weakly-connected components.
                                  Vertex attribute `name` and NOTHING else — no
                                  weight, no time, no confidence on any edge.

  edge_lit_evidence.tsv           WHETHER a human believes it. 200 adjudicated
                                  edges: TRUE / PLAUSIBLE / UNKNOWN / FALSE /
                                  EXCLUDE, with citations. This is the only reason
                                  the page can be honest about its own skeleton.

  perturb_lmx1ba,lmx1bb_          WHEN a state is abundant. `log_abund_x` is the
  contrast_abundance.tsv          WILD-TYPE arm (knockout_x is FALSE in all 2,082
                                  rows), so it gives a 6-point abundance
                                  trajectory per state at 18/24/36/48/60/72 hpf.

The .rds needs R + igraph (both present); it does NOT need monocle3 or BPCells,
which is why this page could be built while `reference_cds.tar` stays unopened.

Run:  python3 scripts/build_fate_map_24_48.py
"""

from __future__ import annotations

import collections
import csv
import json
import pathlib
import subprocess
import sys
import tempfile

SRC = pathlib.Path("/data/datasets/zebrafish/Platt/sources/data")
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"

RDS = SRC / "combined_state_graphs.rds"
LIT = SRC / "edge_lit_evidence.tsv"
ABUND = SRC / "perturb_lmx1ba,lmx1bb_contrast_abundance.tsv"

TIMEPOINTS = [18, 24, 36, 48, 60, 72]
WINDOW = (24, 48)

# The five states an edge can be in. Order is the legend order and the draw order:
# the least-believed are drawn first so the believed ones sit on top of them.
SUPPORT_ORDER = ["EXCLUDE", "FALSE", "UNKNOWN", "PLAUSIBLE", "TRUE"]


def read_graph() -> tuple[list[str], list[tuple[str, str]]]:
    """Read the igraph object through R, because it is an R object.

    Returns:
        tuple[list[str], list[tuple[str, str]]]: vertex names in graph order, and
            edges as (parent, child) name pairs.

    Raises:
        SystemExit: If Rscript or igraph is unavailable, or the file is not a graph.
    """
    with tempfile.NamedTemporaryFile("w", suffix=".tsv", delete=False) as fh:
        tsv = fh.name
    script = f"""
    if (!requireNamespace("igraph", quietly=TRUE)) {{ cat("NO_IGRAPH\\n"); quit(status=3) }}
    suppressMessages(library(igraph))
    g <- readRDS({str(RDS)!r})
    if (!inherits(g, "igraph")) {{ cat("NOT_A_GRAPH\\n"); quit(status=4) }}
    el <- as_edgelist(g)
    con <- file({tsv!r}, "w")
    for (n in V(g)$name) writeLines(paste0("V\\t", n), con)
    for (i in seq_len(nrow(el))) writeLines(paste0("E\\t", el[i,1], "\\t", el[i,2]), con)
    close(con)
    """
    r = subprocess.run(["Rscript", "-e", script], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"reading {RDS} failed: {r.stdout.strip()} {r.stderr.strip()}")
    verts, edges = [], []
    for line in open(tsv, encoding="utf-8"):
        parts = line.rstrip("\n").split("\t")
        if parts[0] == "V":
            verts.append(parts[1])
        elif parts[0] == "E":
            edges.append((parts[1], parts[2]))
    pathlib.Path(tsv).unlink(missing_ok=True)
    return verts, edges


def read_literature() -> dict[tuple[str, str], dict]:
    """Read the adjudicated edge evidence, keyed by (from, to).

    The file carries six tally rows appended below the data whose `support` column
    holds counts rather than a verdict. They are dropped by requiring the value to
    be one of the five known verdicts, which is also how a new verdict would be
    caught rather than silently admitted.

    Returns:
        dict[tuple[str, str], dict]: verdict, citation and note per edge.
    """
    out = {}
    for row in csv.DictReader(open(LIT, encoding="utf-8"), delimiter="\t"):
        support = (row.get("support") or "").strip()
        if support not in SUPPORT_ORDER:
            continue
        cite = (row.get("citation") or "").strip()
        note = (row.get("summary of citation/notes") or "").strip()
        out[(row["from"].strip(), row["to"].strip())] = {
            "support": support,
            "cite": "" if cite in ("NA", "") else cite,
            "note": "" if note in ("NA", "") else note,
        }
    return out


def read_abundance() -> dict[str, dict[int, float]]:
    """Read the WILD-TYPE abundance trajectory per state.

    Every row of the contrast table has `knockout_x` FALSE and `knockout_y` TRUE, so
    `log_abund_x` is the control arm and `log_abund_y` the lmx1ba/lmx1bb crispant.
    Only the control arm is read here: this page is about the unperturbed window.

    Returns:
        dict[str, dict[int, float]]: state -> {hpf: log abundance}.
    """
    out: dict[str, dict[int, float]] = collections.defaultdict(dict)
    for row in csv.DictReader(open(ABUND, encoding="utf-8"), delimiter="\t"):
        try:
            out[row["cell_group"]][int(row["timepoint"])] = float(row["log_abund_x"])
        except (ValueError, KeyError):
            continue
    return dict(out)


def layer(verts: list[str], edges: list[tuple[str, str]]) -> dict[str, int]:
    """Assign each state its longest-path depth from a root.

    Depth, not time, is the horizontal axis. It is a property of the graph and is
    therefore guaranteed to make every edge point rightward, which is what makes 173
    edges legible without a force simulation. The timing evidence is carried
    separately, on the node, so that the two are never confused for each other.

    Args:
        verts (list[str]): all state names.
        edges (list[tuple[str, str]]): parent-child pairs.

    Returns:
        dict[str, int]: state -> depth, 0 for roots.
    """
    adj = collections.defaultdict(list)
    indeg = collections.Counter()
    for s, t in edges:
        adj[s].append(t)
        indeg[t] += 1
    depth = {v: 0 for v in verts}
    remaining = dict.fromkeys(verts, 0) | dict(indeg)
    queue = collections.deque(v for v in verts if remaining[v] == 0)
    while queue:
        v = queue.popleft()
        for w in adj[v]:
            depth[w] = max(depth[w], depth[v] + 1)
            remaining[w] -= 1
            if remaining[w] == 0:
                queue.append(w)
    return depth


def components(verts: list[str], edges: list[tuple[str, str]]) -> dict[str, int]:
    """Label each state with its weakly-connected component id, largest first.

    Args:
        verts (list[str]): all state names.
        edges (list[tuple[str, str]]): parent-child pairs.

    Returns:
        dict[str, int]: state -> component index, 0 being the largest.
    """
    adj = collections.defaultdict(set)
    for s, t in edges:
        adj[s].add(t)
        adj[t].add(s)
    seen, groups = set(), []
    for v in verts:
        if v in seen:
            continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            x = stack.pop()
            comp.append(x)
            for y in adj[x]:
                if y not in seen:
                    seen.add(y)
                    stack.append(y)
        groups.append(comp)
    groups.sort(key=len, reverse=True)
    return {name: i for i, comp in enumerate(groups) for name in comp}


def main() -> None:
    """Build graph.json and meta.json for the page.

    Raises:
        SystemExit: If an input is missing.
    """
    for p in (RDS, LIT, ABUND):
        if not p.exists():
            sys.exit(f"missing input: {p}")

    verts, edges = read_graph()
    lit = read_literature()
    abund = read_abundance()
    depth = layer(verts, edges)
    comp = components(verts, edges)

    def traj(name: str) -> list[float] | None:
        d = abund.get(name)
        if not d or not all(t in d for t in TIMEPOINTS):
            return None
        return [round(d[t], 3) for t in TIMEPOINTS]

    nodes = []
    for i, name in enumerate(verts):
        t = traj(name)
        peak = TIMEPOINTS[max(range(len(t)), key=lambda k: t[k])] if t else None
        nodes.append(
            {
                "i": i,
                "name": name,
                "depth": depth[name],
                "comp": comp[name],
                "abund": t,
                "peak": peak,
            }
        )
    idx = {n["name"]: n["i"] for n in nodes}

    out_edges = []
    for s, t in edges:
        ev = lit.get((s, t), {})
        out_edges.append(
            {
                "s": idx[s],
                "t": idx[t],
                "support": ev.get("support", ""),
                "cite": ev.get("cite", ""),
                "note": ev.get("note", ""),
            }
        )

    # An edge whose parent peaks LATER than its child runs against the abundance
    # evidence. Six do. They are flagged rather than hidden: a disagreement between
    # the graph and the abundance table is the most interesting thing either says.
    for e in out_edges:
        ps, pt = nodes[e["s"]]["peak"], nodes[e["t"]]["peak"]
        e["retro"] = bool(ps and pt and ps > pt)

    by_support = collections.Counter(e["support"] or "(none)" for e in out_edges)
    by_peak = collections.Counter(n["peak"] for n in nodes if n["peak"])
    timed = [n for n in nodes if n["abund"]]

    graph = {
        "timepoints": TIMEPOINTS,
        "window": list(WINDOW),
        "supportOrder": SUPPORT_ORDER,
        "nodes": nodes,
        "edges": out_edges,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "graph.json").write_text(json.dumps(graph, separators=(",", ":")))

    meta = {
        "built": __import__("datetime").date.today().isoformat(),
        "source": {
            "release": "Trapnell lab reference v2.2.1",
            "silver": "s3://zsb-silver-warehouse/platt/v2.2.1/",
            "graph": RDS.name,
            "evidence": LIT.name,
            "abundance": ABUND.name,
        },
        "counts": {
            "states": len(nodes),
            "edges": len(out_edges),
            "roots": sum(1 for n in nodes if not any(e["t"] == n["i"] for e in out_edges)),
            "leaves": sum(1 for n in nodes if not any(e["s"] == n["i"] for e in out_edges)),
            "components": max(comp.values()) + 1,
            "maxDepth": max(depth.values()),
            "timedStates": len(timed),
            "untimedStates": len(nodes) - len(timed),
            "retroEdges": sum(1 for e in out_edges if e["retro"]),
        },
        "support": {k: by_support.get(k, 0) for k in SUPPORT_ORDER + ["(none)"]},
        "peak": {str(k): by_peak.get(k, 0) for k in TIMEPOINTS},
        "peakBands": {
            "waning": sum(v for k, v in by_peak.items() if k <= 24),
            "cresting": sum(v for k, v in by_peak.items() if 24 < k <= 48),
            "emerging": sum(v for k, v in by_peak.items() if k > 48),
        },
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"  states {len(nodes)}  edges {len(out_edges)}  components {meta['counts']['components']}")
    print(f"  support {dict(by_support)}")
    print(f"  peak bands {meta['peakBands']}  retro edges {meta['counts']['retroEdges']}")
    print(f"  wrote {OUT/'graph.json'} and {OUT/'meta.json'}")


if __name__ == "__main__":
    main()
