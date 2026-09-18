# Commit Challenge — delivery DRAFT v0

Everything you receive before the run. The answer key is delivered after the run. Check every
file against `MANIFEST.json` (sha256).

| file | what it is |
|---|---|
| `zscape_gold_48hpf.v0.h5ad` | The expression matrix: 209,639 cells × 32,031 genes, 48 hpf control arm. It holds the 112 given clusters in `obs['cluster_id']`, raw integer counts in `layers['counts']`, and log1p counts-per-10k in `X`. It opens with anndata 0.10 or later. |
| `gold_features.v2.csv` | One row per cluster: three ranked DEG lists (top, bottom and family, up to 50 genes each), each with an aligned Ensembl twin column, plus QC. `family_contrast_clusters` names the related clusters each family list is ranked against. |
| `genes.tsv` | The matrix's gene order (`position` 0–32,030) with every gene identifier. |
| `zfa_menu.v1.enriched.json`, `.tsv` | The answer space: 3,107 ZFA terms, hash `dec9f7289d7c…`. Each term has its synonyms, `is_a`/`part_of` parents, ZFS stage window, depth and kind (cell or structure). |
| `excluded_clusters.csv` | The 26 clusters dropped before the set was cut. They have no cells in the matrix and are never scored. |
| `sources.v0.json` | The pinned reference sources: ZFA, ZFIN wild-type expression, the ZFIN GO annotation file (GAF) and GO, each by version and sha256. |
| `scoring_rules.v0.md` | How each cluster is scored, and what is reported. |
| `submission_format.v0.md`, `validate_submission.py` | What a submission looks like, and a standard-library validator. |

## Gene identifiers

- **The marker lists use gene symbols** from the matrix's `var['gene_symbol']`. They are lowercased,
  then made unique in matrix order, so a second `efna2b` becomes `efna2b-1`. That name is stored as
  `var['marker_name']` and in `genes.tsv`. Every one of the 15,642 marker entries resolves to exactly
  one gene.
- **To join on stable ids**, use the `*_markers_ensembl` columns. They are aligned position by
  position with the symbol lists and are unique Ensembl gene ids (`var['ensembl_id']`).
- **Raw count gene order** is the matrix's `var` order, which is `genes.tsv` `position`.

## Hashing the menu

`sha256(json.dumps([{"id": t["id"], "name": t["name"]} for t in terms], sort_keys=True, separators=(",", ":")))`
over the terms in file order must give `dec9f7289d7c378815ef8db29a1ab2013c13cb04ed4c5d01735be6b07afcf0a6`.
Only `id` and `name` are hashed. The added fields are not.

## The family list (v2)

`family_50_markers` ranks genes by how much higher they are in the cluster than in its **contrast group**:
the 5 clusters whose mean expression profiles over the 2,000 highly variable genes correlate best with it
(listed in `family_contrast_clusters`). A gene must be detected in at least 10% of the cluster's cells and
in a larger share of them than in the group. It separates a cluster from its nearest relatives, where
`top_50_markers` separates it from everything. v2 replaces the v1 family lists, which did not follow this
definition.
