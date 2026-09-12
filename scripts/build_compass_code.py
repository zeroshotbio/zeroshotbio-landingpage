#!/usr/bin/env python3
"""Build the code panes for /compass: public/compass/code.json.

Each plate gets a notebook-style pane that walks from the raw files to the number the plate prints.
Nothing in a pane is typed by hand:

  code cells   verbatim excerpts, pulled out of a PINNED commit with `git show`, by symbol name (ast
               for Python, brace matching for JS) or by a line range whose first line must contain an
               expected string, so a moved line fails the build instead of quoting the wrong code
  out cells    read from the result files committed at that same commit, then compared with what the
               page itself prints (public/compass/meta.json and plates.json); any disagreement at the
               printed precision stops the build
  provenance   the input fingerprints in the reproduction's reproduction_meta.json, cross-checked at
               build time against the SHA256SUMS files in s3://zsb-open-source

Sources:
  repro    zeroshotbio/compass_reproduction (private) at REPRO_COMMIT, cloned at $COMPASS_REPRO
  compass  the authors' package, github.com/rohitsinghlab/compass at COMPASS_COMMIT (public)
  tahoe    /data/experiments/tahoe_compass (local repository) at TAHOE_COMMIT, for the position test
  page     this repository's own public/compass/cp-plates.js (Plate IX's arithmetic)

Run:  python3 scripts/build_compass_code.py        (stdlib only; needs git and the aws CLI)
"""
from __future__ import annotations

import ast
import csv
import hashlib
import io
import json
import math
import os
import pathlib
import re
import statistics
import subprocess
import time

HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / "public" / "compass"
REPRO = pathlib.Path(os.environ.get("COMPASS_REPRO", "/data/experiments/compass_reproduction"))
COMPASS = pathlib.Path(os.environ.get("COMPASS_PKG", "/data/experiments/_vendor/compass"))
TAHOE = pathlib.Path(os.environ.get("TAHOE_COMPASS", "/data/experiments/tahoe_compass"))
REPRO_COMMIT = "a700359d737ef3720661baf948674f7d4e2f2182"
COMPASS_COMMIT = "fb4c9e121c782e556d49ecb093dfe44e3086d589"
TAHOE_COMMIT = "cefd298c1096197500d50d01a6d0999f7f1ec695"
LINES = ["K562", "RPE1", "HepG2", "Jurkat", "HCT116", "HEK293T"]
RN = ["K562", "RPE1", "HepG2", "Jurkat"]

SOURCES = {
    "repro": {"label": "zeroshotbio/compass_reproduction", "commit": REPRO_COMMIT, "public": False,
              "note": "a private repository"},
    "compass": {"label": "rohitsinghlab/compass", "commit": COMPASS_COMMIT, "public": True,
                "url": "https://github.com/rohitsinghlab/compass/blob/" + COMPASS_COMMIT + "/{path}#L{start}-L{end}",
                "note": "the authors' own package, used unmodified"},
    "tahoe": {"label": "tahoe_compass", "commit": TAHOE_COMMIT, "public": False,
              "note": "a separate local repository: the later Tahoe position test"},
    "page": {"label": "zeroshotbio-landingpage", "commit": None, "public": False,
             "note": "this page's own script"},
}
REPOS = {"repro": (REPRO, REPRO_COMMIT), "compass": (COMPASS, COMPASS_COMMIT), "tahoe": (TAHOE, TAHOE_COMMIT)}


# ---------------------------------------------------------------------------------------------
# sources

def git(repo, *args):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"git {' '.join(args)} in {repo} failed: {r.stderr.strip()}")
    return r.stdout


_cache = {}


def source(src, path):
    key = (src, path)
    if key not in _cache:
        if src == "page":
            if git(HERE, "status", "--porcelain", "--", path).strip():
                raise SystemExit(f"{path} has uncommitted changes; commit it so the pane can name the version it quotes")
            _cache[key] = (HERE / path).read_text()
        else:
            repo, commit = REPOS[src]
            _cache[key] = git(repo, "show", f"{commit}:{path}")
    return _cache[key]


def page_commit(path):
    return git(HERE, "log", "-1", "--format=%h", "--", path).strip()


def span_of(text, path, sym):
    """1-based (start, end) of a top-level Python def/class, or a JS function, named `sym`."""
    if path.endswith(".py"):
        for node in ast.parse(text).body:
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name == sym:
                start = min([node.lineno] + [d.lineno for d in node.decorator_list])
                return start, node.end_lineno
        raise SystemExit(f"{path}: no top-level def/class {sym}")
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith(f"function {sym}("):
            depth, seen = 0, False
            for j in range(i, len(lines)):
                depth += lines[j].count("{") - lines[j].count("}")
                seen = seen or "{" in lines[j]
                if seen and depth == 0:
                    return i + 1, j + 1
    raise SystemExit(f"{path}: no function {sym}")


def code(src, path, sym=None, lines=None, expect=None, note=None):
    """A verbatim excerpt. `lines=(a, b)` must come with `expect`, a string line a has to contain."""
    text = source(src, path)
    if sym:
        a, b = span_of(text, path, sym)
    else:
        a, b = lines
        if expect is None:
            raise SystemExit(f"{path}:{a}-{b}: a line-range excerpt needs an expect guard")
    body = text.split("\n")[a - 1:b]
    if expect is not None and expect not in body[0]:
        raise SystemExit(f"{path}:{a}: expected {expect!r}, found {body[0]!r} (the file moved; update the range)")
    cell = {"t": "code", "src": src, "path": path, "start": a, "end": b, "lang": "js" if path.endswith(".js") else "py",
            "code": "\n".join(body).rstrip()}
    if src == "page":
        cell["commit"] = page_commit(path)
    if note:
        cell["note"] = note
    return cell


def md(text):
    return {"t": "md", "text": text}


def chain(cid):
    return {"t": "chain", "id": cid}


def rtext(path):
    return source("repro", path)


def rtsv(name):
    return list(csv.DictReader(io.StringIO(rtext("results/" + name)), delimiter="\t"))


def rjson(name):
    return json.loads(rtext("results/" + name))


# ---------------------------------------------------------------------------------------------
# checks against the page

META = json.loads((OUT / "meta.json").read_text())
PLATES = json.loads((OUT / "plates.json").read_text())
_checks = []


def same(ours, page, nd, what):
    """ours (from the committed results) must equal what the page prints, at nd decimals."""
    if ours is None or page is None or round(float(ours), nd) != round(float(page), nd):
        raise SystemExit(f"MISMATCH {what}: results give {ours}, the page has {page}")
    _checks.append(what)


def f(x, nd=2):
    return "—" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{float(x):.{nd}f}"


def out(head, rows, check, note=None):
    cell = {"t": "out", "head": head, "rows": rows, "check": check}
    if note:
        cell["note"] = note
    return cell


def med(xs):
    return statistics.median([float(x) for x in xs])


def mean(xs):
    return statistics.fmean([float(x) for x in xs])


# ---------------------------------------------------------------------------------------------
# provenance

def s3_sums(prefix):
    r = subprocess.run(["aws", "s3", "cp", f"s3://zsb-open-source/{prefix}/SHA256SUMS", "-"], capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise SystemExit(f"could not read s3://zsb-open-source/{prefix}/SHA256SUMS: {r.stderr.strip()}")
    return {ln.split()[1]: ln.split()[0] for ln in r.stdout.splitlines() if ln.strip()}


def s3_size(uri):
    r = subprocess.run(["aws", "s3", "ls", uri], capture_output=True, text=True, timeout=120)
    if r.returncode or not r.stdout.strip():
        raise SystemExit(f"could not list {uri}: {r.stderr.strip()}")
    return int(r.stdout.split()[2])


def provenance():
    rm = json.loads(rtext("reproduction_meta.json"))
    sums = {"replogle": s3_sums("human/replogle/figshare_20029387"), "nadig": s3_sums("human/nadig/GSE264667"),
            "xatlas": s3_sums("human/xatlas-orion/53a5bc98"), "tahoe": s3_sums("human/tahoe/2025-02-25")}
    s3key = {"replogle": "s3://zsb-open-source/human/replogle/figshare_20029387/", "nadig": "s3://zsb-open-source/human/nadig/GSE264667/",
             "xatlas": "s3://zsb-open-source/human/xatlas-orion/53a5bc98/", "tahoe": "s3://zsb-open-source/human/tahoe/2025-02-25/"}
    rows = {}
    for i in rm["inputs"]:
        p = i["path"]; name = p.split("/")[-1]
        ds = next((k for k in ("replogle", "nadig", "xatlas", "tahoe") if f"/{k}/" in p), None)
        rel = None
        if ds:
            rel = p.split("/2025-02-25/")[-1] if ds == "tahoe" else (p.split("/hf_53a5bc98/")[-1] if ds == "xatlas" else name)
        s3sha = sums[ds].get(rel) if ds else None
        sha = i.get("sha256") or i.get("sha256_of_manifest")
        if s3sha is not None and s3sha != sha:
            raise SystemExit(f"PROVENANCE MISMATCH {name}: reproduction record {sha}, S3 SHA256SUMS {s3sha}")
        if "compass_filtered" in p:
            name = f"X-Atlas/Orion HCT116 + HEK293T, {i.get('files', '?')} parquet batches"
        rows[p] = {"name": name, "bytes": i.get("bytes"),
                   "sha256": sha, "sha_kind": "manifest" if "sha256_of_manifest" in i else "file",
                   "origin": i.get("origin", ""), "s3": (s3key[ds] + rel) if s3sha else None,
                   "s3_match": bool(s3sha)}
    tahoe_plates = sorted(k for k in sums["tahoe"] if k.startswith("h5ad/"))
    return rows, tahoe_plates


# ---------------------------------------------------------------------------------------------
# the two chains every CRISPRi plate shares

def chain_crispr(PROV):
    keep = [r for p, r in PROV.items() if any(s in p for s in ("/replogle/", "/nadig/", "/xatlas/", "compass_shared_targets", "hgnc_complete"))]
    return {"title": "From the raw files to one effect vector per knockdown",
            "sub": "the same seven steps feed every CRISPRi plate",
            "cells": [
                md("<b>0 · The raw files.</b> Six cell lines from three studies, fingerprinted when the reproduction ran. "
                   "Where our S3 mirror keeps a <code>SHA256SUMS</code>, the build checked the recorded hash against it."),
                {"t": "prov", "rows": keep},
                md("<b>1 · Which cells and genes.</b> Keep every cell whose guide targets one of the 2,317 genes all six lines share, plus "
                   "every non-targeting control; keep protein-coding genes only (HGNC, Ensembl IDs); refuse non-integer counts. "
                   "X-Atlas's parquet batches go through <code>extract_xatlas</code> in the same file under the same rules."),
                code("repro", "scripts/01_extract.py", sym="extract_h5ad"),
                md("<b>2 · Normalise each cell.</b> Counts per 10,000, then log(1 + x)."),
                code("repro", "scripts/02b_build.py", sym="lognorm_chunk"),
                md("<b>3 · The control reference.</b> In K562, HCT116 and HEK293T the paper draws exactly 10,000 controls, stratified over "
                   "30 k-means clusters of the controls (§A.1); the other lines keep every control."),
                code("repro", "scripts/02b_build.py", sym="stratified_pool"),
                md("<b>4 · The gene panel.</b> Seurat normalised dispersion, as scanpy's <code>flavor='seurat'</code>, streamed so no line has to "
                   "fit in memory; the file checks itself against scanpy on a subsample. The group panel is the 2,000 genes most often called "
                   "variable across the study group's lines."),
                code("repro", "scripts/02a_hvg.py", sym="seurat_dispersion"),
                md("<b>5 · Average each knockdown's cells</b> (the pseudobulk), one chunk of cells at a time."),
                code("repro", "scripts/02b_build.py", lines=(88, 93), expect="for k in ks_p1:"),
                code("repro", "scripts/02b_build.py", lines=(132, 135), expect='np.savez(d / f"{line}.npz"'),
                md("<b>6 · The effect vector.</b> A knockdown's mean minus the control reference's mean, on the group panel. This matrix, "
                   "2,317 knockdowns by 2,000 genes per line, is what COMPASS decomposes."),
                code("repro", "scripts/04_decomposition.py", lines=(38, 47), expect="def load_effects"),
            ]}


def chain_decomp():
    return {"title": "The split itself: typical response, strength, own part",
            "sub": "the authors' code, unmodified",
            "cells": [
                md("The typical response <i>u</i> is the average effect vector, scaled to length 1. A knockdown's strength β is how far its "
                   "effect runs along <i>u</i> (a dot product); its own part is what is left. Exact linear algebra: no fitting, no parameters."),
                code("compass", "compass/decomposition.py", lines=(26, 53), expect="def shared_axis"),
            ]}


# ---------------------------------------------------------------------------------------------
# the plates

def plate1():
    P = json.loads(rtext("results/page/plate1.json")); pp = PLATES["p1"]
    rows = []
    for e, q in zip(P["exemplars"], pp["exemplars"]):
        if e["symbol"] != q["symbol"]:
            raise SystemExit(f"Plate I exemplar {e['symbol']} vs page {q['symbol']}")
        same(e["beta"], q["beta"], 3, f"Plate I β of {e['symbol']}")
        same(e["frac_shared"], q["frac_shared"], 3, f"Plate I share of {e['symbol']}")
        gap = max(abs(z - (s + r)) for z, s, r in zip(e["z"], e["shared"], e["residual"]))
        z2 = sum(z * z for z in e["z"]); r2 = sum(r * r for r in e["residual"])
        rows.append([e["symbol"], f(e["beta"], 3), f"{round(e['frac_shared'] * 100)}%", f"{gap:.4f}", f"{abs(z2 - (e['beta'] ** 2 + r2)) / z2:.4f}"])
    return {"title": "One response, two parts",
            "lede": "RPE1's 2,317 effect vectors, split by the authors' two functions; the three examples come from a fixed rule.",
            "cells": [chain("crispr"), chain("decomp"),
                      md("<b>Choosing the three examples.</b> Written down before drawing: the ribosomal-protein knockdown with the largest β; "
                         "among the largest 30% of responses, the one closest to half shared and the one least like the typical response."),
                      code("repro", "scripts/11_page_assets.py", sym="plate1"),
                      md("<b>Check it.</b> Recomputed here from the vectors the plate draws: the middle row plus the bottom row should give the "
                         "top row back, and squared lengths should add (β² + |own part|² = |response|²). Both hold to the four decimals the "
                         "page stores."),
                      out(["knockdown", "β", "shared", "max |z − (βu + r)|", "squared-length gap"], rows,
                          "β and shared share match the plate")]}


def plate2(PROV):
    C = rtsv("geometry_crossline.tsv"); R = META["reproduction"]; Pp = META["paper"]
    wrow = lambda anchor, q: next(r for r in C if r["anchor"] == anchor and r["panel"] == "2000" and r["quantity"] == q)
    wr = []
    for k, q in enumerate("ams"):
        o = float(wrow("paper-matched symbol anchor", q)["kendalls_W"]); e = float(wrow("2,317 Ensembl anchor", q)["kendalls_W"])
        same(o, R["W"]["paper_anchor"]["2000"]["W"][k], 3, f"Plate II Kendall's W ({q})")
        wr.append([{"a": "alignment a", "m": "magnitude m", "s": "coordinate s"}[q], f(o, 3), f(e, 3), f(Pp["W"]["2000"][k], 3)])
    A = rtsv("anchor_investigation.tsv")
    an = {r["match_on"]: int(r["shared"]) for r in A if r["min_cells"] == "2" and r["protein_coding_targets_only"] == "False"}
    same(an["Ensembl ID"], META["anchor"]["ensembl"], 0, "Plate II anchor, Ensembl"); same(an["source symbol (as deposited)"], META["anchor"]["symbol"], 0, "Plate II anchor, symbol")
    B = {f"{r['a']}_{r['b']}": float(r["pearson_beta"]) for r in rtsv("beta_conservation_ensembl.tsv")}
    br = []
    for k, pv in Pp["beta_pairs"].items():
        same(B[k], R["beta_pairs"][k]["r"], 3, f"Plate II β conservation {k}")
        br.append([k.replace("_", " – "), f(B[k]), f(pv)])
    T = {r["held_out"]: r for r in rtsv("transfer_loco_ensembl.tsv")}
    tr = []
    for l in LINES:
        same(T[l]["beta_transfer_r"], R["transfer"]["ensembl"][l]["beta"], 3, f"Plate II β transfer {l}")
        pk = l if l in Pp["transfer_beta"] else "X-Atlas"
        tr.append([l, f(T[l]["beta_transfer_r"]), f(Pp["transfer_beta"][pk]), f(T[l]["g_transfer_r"]), f(Pp["transfer_g"][pk]), f(T[l]["g_transfer_r_shuffled"], 3)])
    Bn = rtsv("compassx_benchmark_ensembl.tsv"); cx = []
    for i, l in enumerate(LINES):
        row = [l]
        for m in ("CompassX", "training mean"):
            pe = mean(r["debiased_pearson"] for r in Bn if r["method"] == m and r["target"] == l)
            pd_ = mean(r["pds_gain"] for r in Bn if r["method"] == m and r["target"] == l)
            same(pe, R["bench"][m]["pearson"][i], 3, f"Plate II {m} accuracy {l}"); same(pd_, R["bench"][m]["pds"][i], 3, f"Plate II {m} discrimination {l}")
            row += [f"{f(pe)} / {f(pd_)}", f"{f(Pp['table3'][m][0][i])} / {f(Pp['table3'][m][1][i])}"]
        cx.append(row)
    return {"title": "The reproduction, set beside the paper",
            "lede": "Every ledger row, from the committed results, beside the value the paper printed.",
            "cells": [
                md("<b>The scatter uses a different statistic from the rest of the page</b>, because the paper's §2.4 does: a signed "
                   "Mann–Whitney z per gene, a knockdown's cells against the control reference, over each line's own 5,000 most variable "
                   "genes. Steps 1–5 of the shared chain feed it; step 6 does not."),
                chain("crispr"),
                code("repro", "scripts/03_geometry.py", sym="mw_z"),
                md("<b>Size and likeness.</b> m is the length of a knockdown's z-vector; a is its correlation with the line's average "
                   "z-vector; s is a one-dimensional Isomap of the two, turned so it rises with m."),
                code("repro", "scripts/03_geometry.py", lines=(85, 90), expect="for size in (1000, 2000, 5000):"),
                code("repro", "scripts/03_geometry.py", sym="isomap_coord"),
                md("<b>Do the six lines rank knockdowns alike?</b> Kendall's coefficient of concordance, with the standard tie "
                   "correction, on the paper-matched gene-name anchor and on our Ensembl anchor."),
                code("repro", "scripts/crlib.py", sym="kendalls_w"),
                code("repro", "scripts/03_geometry.py", sym="crossline"),
                out(["", "ours, paper's anchor", "ours, 2,317 anchor", "paper (§2.5)"], wr, "matches the ledger"),
                md("<b>Why 2,317 and not 2,270.</b> The paper joined targets across studies on gene names as deposited; joining on "
                   "Ensembl IDs keeps 54 genes renamed between annotations. Every ledger row is run on both."),
                code("repro", "scripts/00_anchor_investigation.py", sym="shared"),
                out(["join on", "targets in all six lines, ≥ 2 cells"], [["Ensembl ID", f"{an['Ensembl ID']:,}"], ["gene name as deposited", f"{an['source symbol (as deposited)']:,}"], ["paper (§A.1)", f"{Pp['anchor']:,}"]],
                    "matches the page"),
                chain("decomp"),
                md("<b>Do two lines agree on β?</b> (paper Table 13). β from each line's own decomposition, correlated over the 2,317 knockdowns."),
                code("repro", "scripts/04_decomposition.py", lines=(155, 159), expect="# --- Table 13"),
                out(["pair", "ours", "paper"], br, "matches the ledger"),
                md("<b>Predict a hidden line</b> (Tables 2, 9). Average β, and the own part, over the other lines of the same study; "
                   "correlate with the hidden line. The last column shuffles which knockdown is which: the own part's transfer drops to zero."),
                code("repro", "scripts/04_decomposition.py", lines=(161, 170), expect="# --- Table 2 / Table 9"),
                out(["held out", "β r", "paper", "own part r", "paper", "shuffled"], tr, "matches the ledger"),
                md("<b>CompassX</b> (Table 3), the authors' predictor: the hidden line contributes only its typical response; β and the own "
                   "part come from the other lines. Scored two ways: de-biased Pearson against measured effects built from the other half "
                   "of the controls (accuracy), and whether a prediction is closer to its own knockdown than to the others (PDS gain)."),
                code("compass", "compass/estimators.py", sym="CompassX"),
                code("repro", "scripts/04_decomposition.py", sym="donor_components"),
                code("repro", "scripts/04_decomposition.py", sym="benchmark"),
                code("repro", "scripts/04_decomposition.py", sym="pds_gain"),
                out(["line", "CompassX, ours", "paper", "training mean, ours", "paper"], cx,
                    "matches the ledger", "each cell: accuracy / discrimination, mean of five 80/20 splits"),
            ]}


def plate3():
    S = rtsv("biology_u_signatures.tsv"); P3 = {r["signature"]: r for r in PLATES["p3"]["signatures"]}
    sg = []
    for name in ("Hallmark Myc Targets V1", "p53 targets (core)"):
        row = [name]
        for l in LINES:
            v = next(float(r["mean_z_of_u"]) for r in S if r["line"] == l and r["signature"] == name)
            same(v, P3[name][l], 2, f"Plate III {name} {l}"); row.append(f(v))
        sg.append(row)
    bs = rjson("biology_summary.json"); r2 = [["R² on curated signatures"]]
    for l in LINES:
        same(bs[l]["R2_u_on_curated_signatures"], META["biology"]["r2"][l], 2, f"Plate III R² {l}"); r2[0].append(f(bs[l]["R2_u_on_curated_signatures"]))
    return {"title": "What the typical response is made of",
            "lede": "The typical response over every protein-coding gene, and where known programmes sit on it.",
            "cells": [
                md("Same raw files and pseudobulk as the shared chain (steps 0–5), but the typical response is taken over <i>every</i> "
                   "protein-coding gene of the line, not the 2,000-gene panel: the same normalised mean, written out."),
                chain("crispr"),
                code("repro", "scripts/06_biology.py", lines=(104, 110), expect="# ---------- (1)-(2) shared direction over all genes"),
                md("<b>The gene sets are choices, so here they are.</b> The four hand-written sets; Hallmark, GO, Reactome and KEGG come "
                   "from the Enrichr downloads fingerprinted in the reproduction record."),
                code("repro", "scripts/06_biology.py", lines=(34, 39), expect="CURATED = {"),
                md("<b>Where a programme sits</b>: the average standardised score of its genes on the typical response (the dots), and a "
                   "rank test of its genes against all others."),
                code("repro", "scripts/06_biology.py", lines=(118, 125), expect="ss = signature_sets(set(genes))"),
                code("repro", "scripts/06_biology.py", sym="rank_enrichment"),
                out(["", *LINES], sg, "matches the dots"),
                md("<b>How much do the familiar programmes explain?</b> Regress the standardised typical response on membership "
                   "indicators of all the signatures at once."),
                code("repro", "scripts/06_biology.py", lines=(126, 135), expect="# (2) variance explained"),
                out(["", *LINES], r2, "matches the caption's range"),
            ]}


def plate4():
    C = rtsv("biology_residual_clusters.tsv")
    rn = [r for r in C if r["group"] == "Replogle/Nadig" and r["scope"] == "whole anchor"]
    nsig = sum(r["members_sig"] == "True" for r in rn)
    same(nsig, sum(c["members_sig"] for c in PLATES["p4"]["clusters"]), 0, "Plate IV clusters with a shared function")
    top = sorted((r for r in rn if r["members_sig"] == "True"), key=lambda r: -int(r["n"]))[:5]
    cl = [[r["n"], r["examples"], r["members_enrichment"].split("|")[-1]] for r in top]
    St = rtsv("stress_per_line.tsv"); D = META["decomposition"]["per_line"]; rel = []
    for l in LINES:
        A = [r for r in St if r["line"] == l and r["condition"] == "A:independent halves"]
        v = [mean(r[k] for r in A) for k in ("cos_u", "beta_r", "split_residual_r_median")]
        for x, k in zip(v, ("split_cos_u", "split_beta_r", "split_residual_r")):
            same(x, D[l][k], 3, f"Plate IV {k} {l}")
        rel.append([l, f(v[0], 3), f(v[1]), f(v[2])])
    pr = []
    for r in rtsv("pair_similarity_ensembl.tsv"):
        pg = next(p for p in META["decomposition"]["pairs"] if p["a"] == r["a"] and p["b"] == r["b"])
        same(r["residual_same"], pg["res_same"], 3, f"Plate IV own-part match {r['a']}-{r['b']}")
        pr.append([f"{r['a']} – {r['b']}", f(r["residual_same"], 3), f(r["residual_random"], 3)])
    return {"title": "Where the particular biology lives",
            "lede": "The own parts, grouped without being told what the genes do; then measured twice.",
            "cells": [chain("crispr"), chain("decomp"),
                      md("<b>Grouping the own parts.</b> Average each knockdown's own part over the four Replogle/Nadig lines, scale every "
                         "row to length 1, k-means into 20 groups. Only then ask what the knocked-down genes of each group have in common "
                         "(hypergeometric test against the 2,317 screened genes, Benjamini–Hochberg)."),
                      code("repro", "scripts/06_biology.py", lines=(187, 208), expect="for g, ls in GROUPS.items():"),
                      code("repro", "scripts/06_biology.py", sym="hyper"),
                      md("<b>The map is a drawing.</b> The page re-runs the identical k-means (same seed) and lays the points out with t-SNE; "
                         "the groups come from the full data, not from the map."),
                      code("repro", "scripts/11_page_assets.py", lines=(121, 127), expect="B = {l: dec(l) for l in GROUPS"),
                      out(["knockdowns", "for example", "what they share"], cl,
                          f"{nsig} of 20 groups have a significant shared function, as the caption says", "the five largest of them"),
                      md("<b>Measure it twice.</b> Split each knockdown's cells, and the controls, into two random halves; redo everything "
                         "on each half; compare. Five random splits per line."),
                      code("repro", "scripts/05_stress.py", lines=(108, 123), expect="# A: independent halves"),
                      out(["line", "typical response (cos)", "β (r)", "own part (median r)"], rel, "matches the reliability panel"),
                      md("<b>Across lines</b>, the same knockdown's own part against a random pairing of knockdowns."),
                      code("repro", "scripts/04_decomposition.py", lines=(171, 180), expect="# --- same-perturbation similarity"),
                      out(["pair", "same knockdown", "random pairs"], pr, "matches the caption")]}


def plate5():
    P5 = json.loads(rtext("results/page/plate5.json")); pp = PLATES["p5"]; st = []
    for ds, lab in (("crispr", "CRISPRi"), ("tahoe", "Tahoe"), ("chemfish", "ChemFish")):
        x = P5[ds]["ratio"]; m = 10 ** statistics.median(x); a = sum(v > math.log10(2) for v in x) / len(x)
        same(m, pp[ds]["median"], 2, f"Plate V {lab} response / noise"); st.append([lab, f"{len(x):,}", f(m), f"{round(a * 100)}%"])
    E = rtsv("fin/megafin_effect_vs_wellnoise.tsv")
    for col, key, lab in (("effect_over_control_split", "megafin", "MegaFin, against control halves"), ("effect_over_null", "megafin_wells", "MegaFin, against the noise between wells")):
        x = [math.log10(float(r[col])) for r in E]; m = 10 ** statistics.median(x)
        same(m, pp[key]["median"], 2, f"Plate V {lab}"); st.append([lab, f"{len(x):,}", f(m), f"{round(sum(v > math.log10(2) for v in x) / len(x) * 100)}%"])
    St = [r for r in rtsv("stress_per_line.tsv") if r["condition"] == "B:perturbations used for the axis"]
    dfrac = lambda l, n: float(next(r["detectable"] for r in St if r["line"] == l and int(float(r["level"])) == n))
    det = [[f"{n:,}", *[f"{round(dfrac(l, n) * 100)}%" for l in LINES]] for n in (3, 5, 10, 30, 100, 300)]
    # the caption: about 30 in five lines; HEK293T 94% of draws at 100, all at 300
    if not (all(dfrac(l, 30) >= 0.95 for l in LINES[:5]) and round(dfrac("HEK293T", 100), 2) == 0.94 and dfrac("HEK293T", 300) == 1.0):
        raise SystemExit("Plate V detection caption no longer matches stress_per_line.tsv")
    _checks.append("Plate V detection: 30 in five lines; HEK293T 94% at 100, 100% at 300")
    CR = "COMPASS source (Replogle/Nadig/X-Atlas CRISPRi)"
    DC = {r["property"]: r for r in csv.DictReader(io.StringIO(rtext("dataset_comparison.tsv")), delimiter="\t")}
    dp = []
    for k in ("UMIs per cell (median, protein-coding)", "cells per perturbation x context (median)"):
        if DC[k][CR] != META["comparison"][k][CR]:
            raise SystemExit(f"Plate V {k}: {DC[k][CR]} vs page {META['comparison'][k][CR]}")
        _checks.append(f"Plate V {k}")
        dp.append([k, DC[k][CR], DC[k]["Tahoe-100M"], DC[k]["ChemFish 2026_09"]])
    return {"title": "Why it can be seen in these screens",
            "lede": "Response size against the right noise; how many perturbations before a typical response exists; how much was measured.",
            "cells": [
                md("<b>The noise a response has to beat.</b> For CRISPRi: split the control reference in two at random and take the "
                   "length of the difference of the halves' means. A knockdown's ratio is its effect length over that."),
                code("repro", "scripts/05_stress.py", lines=(117, 123), expect="noise = np.linalg.norm"),
                code("repro", "scripts/11_page_assets.py", sym="plate5"),
                md("For Tahoe and ChemFish every perturbation carries its own control halves; the noise is the difference between them."),
                code("repro", "scripts/07d_external_axis.py", lines=(94, 98), expect="ctlA, ctlB = A[ci].sum(0) / nA"),
                out(["", "responses", "median ratio", "over 2×"], st, "matches the strength panel"),
                md("<b>How many perturbations before a typical response exists.</b> Draw two disjoint sets of n knockdowns and compare "
                   "their typical responses; as a null, flip each response's sign at random first, which keeps sizes but destroys any "
                   "shared direction. Detectable = the two sets agree more than 95% of null draws, in at least 95% of 50 draws."),
                code("repro", "scripts/05_stress.py", lines=(212, 226), expect="# ---- B: perturbation subsampling"),
                out(["knockdowns n", *LINES], det, "matches the caption: 30 in five lines; HEK293T 94% at 100, all at 300",
                    "share of 50 draws in which the typical response is detectable"),
                md("<b>How much was measured.</b> Median molecules per cell and cells per knockdown, from the extracted cells."),
                code("repro", "scripts/09_comparison_table.py", lines=(31, 35), expect="cells, umi, conf = [], [], []"),
                out(["", "CRISPRi", "Tahoe", "ChemFish"], dp, "matches the table"),
                md("<i>The fourth panel, where the controls sit, is a sketch of each design, not a measurement.</i>"),
            ]}


def plate6():
    S = META["stress"]; ph = S["phase"]; P = rtsv("phase_summary.tsv")
    g = lambda n, k: float(next(r["conservation_Replogle/Nadig"] for r in P if int(r["n"]) == n and r["k"] == k))
    rows = []
    for n, k in ((300, "all"), (300, "25"), (300, "10"), (300, "2"), (2317, "all"), (10, "all")):
        same(g(n, k), ph["cons_RN"][ph["n"].index(n)][ph["k"].index(k)], 3, f"Plate VI grid n={n} k={k}")
        rows.append([f"{n:,}", k, f(g(n, k))])
    D = rtsv("depth_sweep.tsv"); dp = S["depth"]; dr = []
    for i, fr in enumerate(dp["f"]):
        rr = [r for r in D if float(r["f"]) == fr]
        lib = med(r["median_library"] for r in rr); cr = float(rr[0]["conservation_Replogle/Nadig"]); cx = float(rr[0]["conservation_X-Atlas"])
        same(lib, dp["library"][i], 0, f"Plate VI depth library f={fr}"); same(cr, dp["cons_RN"][i], 3, f"Plate VI depth RN f={fr}")
        dr.append([f"{fr:g}", f"{lib:,.0f}", f(cr), f(cx)])
    Cs = rtsv("stress_conservation.tsv"); rm = []
    for r in (x for x in Cs if x["condition"].startswith("D:remove top-loading")):
        pg = next(t for t in S["remove_top_cons"] if t[0] == r["level"])
        same(r["cons_r_Replogle/Nadig"], pg[1], 3, f"Plate VI removal {r['level']}%")
        rm.append([f"{float(r['level']):g}%", f(r["cons_r_Replogle/Nadig"]), f(r["cons_r_X-Atlas"])])
    St = rtsv("stress_per_line.tsv"); cc = []
    for l in LINES:
        row = [l]
        for cond in ("stratified pool (reference)", "random 10k", "all controls", "single largest batch"):
            v = next(float(r["cos_u"]) for r in St if r["line"] == l and r["condition"] == "H:" + cond)
            same(v, S["controls_cos"][l][cond], 3, f"Plate VI controls {l} {cond}"); row.append(f(v))
        cc.append(row)
    return {"title": "When it falls apart",
            "lede": "Four stress tests; the first two were run for this page.",
            "cells": [chain("crispr"), chain("decomp"),
                      md("<b>Fewer knockdowns, fewer cells.</b> Cap every knockdown at k cells (a fixed random order per line), rebuild the "
                         "effect vectors; then for n knockdowns (30 random draws, the same draw in every line) rebuild each line's typical "
                         "response and β, and ask how well the four Replogle/Nadig lines still agree on β."),
                      code("repro", "scripts/12_phase.py", sym="zk"),
                      code("repro", "scripts/12_phase.py", sym="grid"),
                      out(["knockdowns n", "cells k", "agreement"], rows, "matches the grid", "median over draws"),
                      md("<b>Shallower sequencing.</b> Binomial thinning of the raw counts, count by count on the panel genes and as one "
                         "draw for the rest of each library, then the whole pipeline again."),
                      code("repro", "scripts/13_depth.py", lines=(57, 64), expect="for fi, f in enumerate(FS):"),
                      code("repro", "scripts/13_depth.py", lines=(81, 89), expect="for fi, f in enumerate(FS):"),
                      out(["fraction kept", "median molecules", "Replogle/Nadig", "X-Atlas"], dr, "matches the thinning panel"),
                      md("<b>Take away the strongest.</b> Drop the knockdowns with the top q% of mean β in every line, rebuild the axis from "
                         "the rest, re-score agreement."),
                      code("repro", "scripts/05_stress.py", lines=(233, 246), expect="# ---- D: remove strongest loaders"),
                      out(["removed", "Replogle/Nadig", "X-Atlas"], rm, "matches the removal panel"),
                      md("<b>Which controls.</b> The same knockdown means against four control references; cosine of each typical "
                         "response with the reference one."),
                      code("repro", "scripts/05_stress.py", lines=(149, 158), expect="# H: control sets"),
                      out(["line", "stratified pool", "random 10k", "all controls", "one batch"], cc, "matches the controls panel")]}


def plate7(PROV, tahoe_plates):
    W = {r[0]: float(r[1]) for r in csv.reader(io.StringIO(rtext("results/tahoe_dmso_well_summary.tsv")), delimiter="\t")}
    w = META["external"]["tahoe"]["dmso_well"]; wr = []
    for k, lab in (("median_norm_sampling_noise", "two halves of one no-drug well (sampling only)"), ("median_norm_well_diff", "no-drug well 1 − no-drug well 2"),
                   ("median_drug_effect_norm", "a typical drug's effect"), ("mean_crossline_r_of_well_diff", "no-drug difference, agreement across lines"),
                   ("mean_crossline_r_of_same_drug_effect", "a drug's effect, agreement across lines"),
                   ("median_abs_beta_well_over_median_drug_beta", "no-drug pull on the typical response ÷ a drug's")):
        same(W[k], w[k], 3, f"Plate VII {k}"); wr.append([lab, f(W[k])])
    ck = rjson("tahoe_checks.json"); dt = []
    for t, v in ck["by_dose_tier"].items():
        same(v["median_beta"], META["external"]["tahoe"]["dose_tiers"][t], 3, f"Plate VII dose tier {t}")
        dt.append([{"1": "lowest", "2": "middle", "3": "highest"}[t], f(v["median_beta"])])
    cf = rjson("chemfish_checks.json"); ps = rtsv("chemfish_pair_similarity.tsv")
    ucos = med(r["u_cosine"] for r in ps)
    same(cf["mean_pairwise_spearman_from_W"], META["external"]["chemfish"]["checks"]["mean_pairwise_spearman_from_W"], 3, "Plate VII ChemFish agreement")
    same(ucos, META["external"]["chemfish"]["pair_similarity"]["u_cosine"], 3, "Plate VII ChemFish axis cosine")
    # the result file is not committed in tahoe_compass (its results/ are git-ignored): read it from disk and name its hash
    ptf = TAHOE / "results" / "final" / "position_test_summary.tsv"
    ptxt = ptf.read_text(); psha = hashlib.sha256(ptxt.encode()).hexdigest()
    pmod = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ptf.stat().st_mtime))
    pos = list(csv.DictReader(io.StringIO(ptxt), delimiter="\t"))
    pk = pos[0].keys().__iter__().__next__()
    pr = [[{"same_drug_same_well": "same drug, same well position", "diff_drug_same_well": "different drugs, same well position",
            "same_drug_diff_well": "same drug, different position (16 pairs)", "diff_drug_diff_well": "different drugs, different position"}[r[pk]],
           f(r["clean_active global"])] for r in pos if r[pk] in ("same_drug_same_well", "diff_drug_same_well", "same_drug_diff_well", "diff_drug_diff_well")]
    tprov = [r for p, r in PROV.items() if "/tahoe/" in p or "chemfish" in p]
    tprov.append({"name": f"{len(tahoe_plates)} plate files (h5ad)", "bytes": None, "sha256": None, "sha_kind": "none",
                  "origin": "Tahoe-100M 2025-02-25, read by 07b one plate at a time; hashes are in the bucket's SHA256SUMS but were not "
                            "recorded by the reproduction", "s3": "s3://zsb-open-source/human/tahoe/2025-02-25/h5ad/", "s3_match": False})
    return {"title": "Two screens closer to ours",
            "lede": "The same measurements on Tahoe and ChemFish, the no-drug-well test, and the later position test.",
            "cells": [
                {"t": "prov", "rows": tprov},
                md("<b>Tahoe onto COMPASS.</b> Context = cell line, perturbation = drug-dose, control = the DMSO wells of the plate(s) "
                   "carrying that drug-dose. Each plate is streamed once; every cell goes to a random half, so each effect has two "
                   "independent replicates."),
                code("repro", "scripts/07b_tahoe_axis.py", lines=(59, 66), expect='obs = a.obs[["drugname_drugconc"'),
                code("repro", "scripts/07b_tahoe_axis.py", lines=(77, 83), expect="lib = np.asarray(M.sum(1)).ravel(); good"),
                code("repro", "scripts/07d_external_axis.py", sym="tahoe_design"),
                code("repro", "scripts/07d_external_axis.py", sym="effects"),
                md("<b>The no-drug-well test.</b> Every plate has two DMSO wells, and all 50 lines share each. Their difference, per line, "
                   "is a pseudo-drug with no drug in it."),
                code("repro", "scripts/07f_tahoe_dmso_wells.py", lines=(73, 90), expect="w1, w2 = sorted(set(well))[:2]"),
                out(["", "median"], wr, "matches the caption and the left panel"),
                md("<b>Dose.</b> A shared axis that is drug potency should rise with dose."),
                code("repro", "scripts/07e_tahoe_checks.py", lines=(64, 78), expect='if ds == "tahoe":'),
                out(["dose tier", "median β"], dt, "matches the caption"),
                md("<b>ChemFish onto COMPASS.</b> Context = tissue; control = the condition's own vehicle in the same experiment, "
                   "timepoint and tissue; halves drawn per <i>embryo</i>, so the two replicates are biologically independent."),
                code("repro", "scripts/07c_chemfish_accumulate.py", lines=(58, 66), expect='is_ctrl = np.isin(s["perturbation"]'),
                code("repro", "scripts/07d_external_axis.py", sym="chemfish_design"),
                out(["", "ChemFish"], [["tissues agree on which drugs are strong (Spearman, from W)", f(cf["mean_pairwise_spearman_from_W"])],
                                       ["cosine between tissues' typical responses (median)", f(ucos)]], "matches the caption"),
                md("<b>The later position test</b> (a separate repository; the reason the caption calls Tahoe's own parts well position). "
                   "Pairs of wells on different plates, grouped by whether they hold the same drug and whether they sit at the same well "
                   "position; cleaned expression vectors, all lines pooled."),
                code("tahoe", "scripts/08c_position_test.py", sym="classes"),
                code("tahoe", "scripts/08c_position_test.py", sym="summarise"),
                out(["pair of wells", "mean cosine"], pr,
                    f"read from tahoe_compass results/final/position_test_summary.tsv (on disk, not committed; sha256 {psha[:16]}…, written {pmod})",
                    "not printed on the plate; this is the evidence behind the caption's wording"),
            ]}


def plate8():
    Fs = rjson("fin/fin_summary.json"); mf = META["fin"]["hvg"]["megafin"]; m = Fs["megafin"]; rows = []
    for path, lab, nd in ((("nodrug_within_plate", "median_norm_diff"), "two no-drug wells, length of the difference", 2),
                          (("nodrug_within_plate", "median_diff_over_sampling"), "… over what sampling alone gives", 2),
                          (("median_drug_effect_norm",), "a typical drug's effect", 2),
                          (("nodrug_within_plate", "median_abs_beta_well_over_median_drug_beta"), "no-drug pull on the typical response ÷ a drug's", 2),
                          (("effect_vs_single_well_null", "frac_over_2x_null"), "drug × cell-type effects over 2× the noise between wells", 3),
                          (("dose", "frac_beta5_gt_beta1"), "higher dose pulls harder", 3)):
        o, p = m, mf
        for k in path:
            o, p = o[k], p[k]
        same(o, p, nd, f"Plate VIII {'.'.join(path)}"); rows.append([lab, f(o, nd)])
    pj = Fs["replication"]["projection"]; pg = META["fin"]["hvg"]["replication"]["projection"]; rp = []
    for k in (1, 2, 4, 8, 12, 24):
        o = next(r for r in pj if r["wells_per_drug"] == k); p = next(r for r in pg if r["wells_per_drug"] == k)
        same(o["frac_over_2x_noise"], p["frac_over_2x_noise"], 3, f"Plate VIII projection k={k}")
        rp.append([str(k), str(o["control_wells"]), f"{round(o['frac_over_2x_noise'] * 100)}%"])
    gold = []
    for ds in ("megafin", "minifin"):
        uri = f"s3://zsb-gold-library/{ds}/parse/v1/{ds}.h5ad"
        gold.append({"name": f"{ds}.h5ad (gold parse/v1)", "bytes": s3_size(uri), "sha256": None, "sha_kind": "none",
                     "origin": "Zeroshot gold object; stage 14 reads a local copy. Not fingerprinted in the reproduction record.",
                     "s3": uri, "s3_match": False})
    return {"title": "The test, run on our own screens",
            "lede": "MegaFin and MiniFin through the same checks: contexts = cell clusters, perturbations = drug wells.",
            "cells": [
                {"t": "prov", "rows": gold},
                md("<b>One pass over the raw counts.</b> Normalise exactly as the CRISPRi arm; sum every cell into its (well, cluster, "
                   "random half) group. Everything after is arithmetic on those sums."),
                code("repro", "scripts/14_fin_aggregate.py", lines=(53, 55), expect="rng = np.random.default_rng(SEED)"),
                code("repro", "scripts/14_fin_aggregate.py", lines=(83, 92), expect="M = sp.csr_matrix((data, ind, ip)"),
                md("<b>Effects</b> against the plate's pooled no-drug wells, with a control half for each half of the drug well."),
                code("repro", "scripts/15_fin_measure.py", sym="build_rec"),
                md("<b>Two wells that should be the same.</b> The difference of two no-drug wells, against the difference sampling alone "
                   "would give at those cell counts; the excess is the noise between wells (τ²)."),
                code("repro", "scripts/15_fin_measure.py", sym="pair_test"),
                md("<b>Every drug effect against the noise one well carries.</b>"),
                code("repro", "scripts/15_fin_measure.py", lines=(243, 259), expect='tau2 = P[P.pair.str.startswith("no-drug")]'),
                md("<b>The dose check.</b>"),
                code("repro", "scripts/15_fin_measure.py", lines=(263, 271), expect="drow = []"),
                out(["MegaFin", "median"], rows, "matches the caption and the table"),
                md("<b>How many wells per drug</b> — a projection, not a measurement: each effect's true size is estimated from its one "
                   "well by subtracting the noise expected there, then re-scored against the noise k wells would carry."),
                code("repro", "scripts/16_fin_replication.py", lines=(33, 43), expect="null1 = E.single_well_null.to_numpy()"),
                out(["wells per drug", "no-drug wells", "effects over 2× noise"], rp, "matches the right panel"),
            ]}


def plate9():
    M = META; E = M["external"]; F = M["fin"]; mf = F["hvg"]["megafin"]; mn = F["hvg"]["minifin"]; w = E["tahoe"]["dmso_well"]
    ratio = [["CRISPRi", f(PLATES["p5"]["crispr"]["median"])], ["Tahoe", f(w["median_drug_effect_norm"] / w["median_norm_well_diff"])],
             ["ChemFish", f(PLATES["p5"]["chemfish"]["median"])], ["MegaFin", f(mf["effect_vs_single_well_null"]["median_effect_over_null"])],
             ["MiniFin", f(mn["Sorafenib"]["median_single_well_over_null"])]]
    nxt = [[str(k), str((192 - 16 - 8) // (2 * k))] for k in (1, 2, 4, 8)]
    return {"title": "Clearing the bar",
            "lede": "No new analysis: every value on this plate is read from the results behind Plates V–VIII.",
            "cells": [
                md("The four bars and each dataset's value are assembled in the page's own script from <code>meta.json</code>, the "
                   "file every earlier pane checks against."),
                code("page", "public/compass/cp-plates.js", sym="gauges"),
                out(["a typical response ÷ the noise it has to beat", "value"], ratio, "the values the bar draws (bar: 2×)"),
                md("<b>The next MegaFin on the same 192 wells</b>: 16 no-drug wells and 8 reference-drug wells set aside, two doses per drug."),
                code("page", "public/compass/cp-plates.js", lines=(752, 753), expect="const NEXT"),
                out(["wells per drug-dose", "drugs that fit"], nxt, "floor((192 − 16 − 8) ÷ (2k))"),
            ]}


# ---------------------------------------------------------------------------------------------

def main():
    PROV, tahoe_plates = provenance()
    doc = {
        "built": time.strftime("%Y-%m-%d"), "sources": SOURCES,
        "chains": {"crispr": chain_crispr(PROV), "decomp": chain_decomp()},
        "plates": {"plate1": plate1(), "plate2": plate2(PROV), "plate3": plate3(), "plate4": plate4(), "plate5": plate5(),
                   "plate6": plate6(), "plate7": plate7(PROV, tahoe_plates), "plate8": plate8(), "plate9": plate9()},
    }
    doc["sources"]["page"]["commit"] = page_commit("public/compass/cp-plates.js")
    doc["checks"] = {"n": len(_checks), "against": f"meta.json {META['asset_version']}", "list": _checks}
    txt = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    (OUT / "code.json").write_text(txt)
    ncode = sum(c["t"] == "code" for p in list(doc["plates"].values()) + list(doc["chains"].values()) for c in p["cells"])
    print(f"wrote code.json ({len(txt) / 1e3:.0f} kB): {ncode} excerpts, {len(_checks)} values checked against the page")


if __name__ == "__main__":
    main()
