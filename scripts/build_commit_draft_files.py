#!/usr/bin/env python3
"""Publish the Commit challenge DRAFT delivery to /commit/draft_files (Basic-Auth gated).

Reads only answer-free material from the benchmark row — delivery_v0/ (what Commit receives before
the run) and test_results/ (counts-only test output and key summary). It never reads _HELDOUT/:
a path guard refuses it, and the answer key is not
published here in any form.

  public/commit/draft_files/files/*          downloadable copies (gated by src/middleware.ts)
  src/app/commit/draft_files/data/bundle.json the page's data: file list, test results, key summary

Rebuild the row first (see _HELDOUT/commit_delivery_v0/README.md there), then:
    python3 scripts/build_commit_draft_files.py
"""
import hashlib, json, os, shutil

ROW = "/data/scratch/zlabel/datasets/zscape_commit_gold"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FILES_OUT = os.path.join(ROOT, "public", "commit", "draft_files", "files")
DATA_OUT = os.path.join(ROOT, "src", "app", "commit", "draft_files", "data")
MAX_PUBLISH_BYTES = 5 << 20  # the 460 MB h5ad is listed, not copied

# (path under ROW, audience, one line) — audience: "before" = sent before the run, "internal" = ours
FILES = [
    ("delivery_v0/README.md", "before", "What each file is, how the gene ids work, how to check the menu hash."),
    ("delivery_v0/zscape_gold_48hpf.v0.h5ad", "before", "The matrix. Fixed copy: excluded-cluster names removed, var['marker_name'] added, opens on anndata 0.10+."),
    ("delivery_v0/gold_features.v1.csv", "before", "Three ranked marker lists per cluster, now each with an aligned Ensembl column, plus QC."),
    ("delivery_v0/genes.tsv", "before", "Gene order of the matrix with symbol, marker name and Ensembl id."),
    ("delivery_v0/zfa_menu.v1.enriched.json", "before", "The 3,107-term answer space (hash unchanged) with synonyms, parents, stage window and kind."),
    ("delivery_v0/zfa_menu.v1.tsv", "before", "The same menu as a table."),
    ("delivery_v0/excluded_clusters.csv", "before", "The 26 clusters dropped upstream, marked excluded (names held back)."),
    ("delivery_v0/sources.v0.json", "before", "Pinned ZFA, ZFIN expression, ZFIN GO annotations and GO, by version and sha256."),
    ("delivery_v0/scoring_rules.v0.md", "before", "The scoring rule made computable: full, half and zero, and what gets reported."),
    ("delivery_v0/submission_format.v0.md", "before", "What a submission looks like: rubric.json plus one JSON line per cluster."),
    ("delivery_v0/validate_submission.py", "before", "Standard-library validator for a submission."),
    ("delivery_v0/MANIFEST.json", "before", "sha256 of every delivered file."),
]
EXTERNAL = [
    ("_HELDOUT/commit_delivery_v0/gold_zfa.v0.csv", "after",
     "The answer key: 112 rows, primary ZFA id, accepted alternatives, both axes, status. Not on this page."),
]


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    shutil.rmtree(FILES_OUT, ignore_errors=True)
    os.makedirs(FILES_OUT)
    os.makedirs(DATA_OUT, exist_ok=True)
    files = []
    for rel, audience, what in FILES:
        src = os.path.join(ROW, rel)
        assert "_HELDOUT" not in os.path.realpath(src).split(os.sep), f"refusing to read {src}"
        size = os.path.getsize(src)
        name = os.path.basename(rel)
        published = size <= MAX_PUBLISH_BYTES
        if published:
            shutil.copyfile(src, os.path.join(FILES_OUT, name))
        files.append({"name": name, "audience": audience, "what": what, "bytes": size, "sha256": sha(src),
                      "href": f"/commit/draft_files/files/{name}" if published else None,
                      "location": None if published else os.path.join(ROW, rel)})
    for rel, audience, what in EXTERNAL:  # listed by name only; never opened
        files.append({"name": os.path.basename(rel), "audience": audience, "what": what, "bytes": None,
                      "sha256": None, "href": None, "location": os.path.join(ROW, rel)})

    results = json.load(open(os.path.join(ROW, "test_results", "results.json")))
    key_summary = json.load(open(os.path.join(ROW, "test_results", "key_summary.json")))
    json.dump({"files": files, "results": results, "key_summary": key_summary,
               "row": ROW, "menu_version_hash": json.load(open(os.path.join(ROW, "delivery_v0", "MANIFEST.json")))["menu_version_hash"]},
              open(os.path.join(DATA_OUT, "bundle.json"), "w"), indent=1)
    print(f"published {sum(f['href'] is not None for f in files)} files; "
          f"tests {results['counts']}; bundle -> {os.path.relpath(DATA_OUT, ROOT)}/bundle.json")


if __name__ == "__main__":
    main()
