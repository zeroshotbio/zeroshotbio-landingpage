# Outstanding work — ZSCAPE · ChemFish · DanioCell · Zebrahub

Only genuinely unfinished items. Detail lives in each `<DATASET>/sources/README.md`.
Canonical path: `/data/datasets/raw_datasets/OUTSTANDING.md` (symlink to this file, so edits are versioned).

## Manual downloads needed
_Automated access is blocked; these need a browser._

| Dataset | File | Why it matters | Status |
|---|---|---|---|
| DanioCell | Final paper PDF (PMC11181902 / Dev Cell) | Only archival gap; the Methods facts are already recorded | PMC is free-to-read but **not** OA, bot wall — **blocked** |
| DanioCell | Supplementary Tables S1–S7 + figures | Unreviewed; may hold per-sample QC and cluster detail | Elsevier paywall — **blocked** |
| all three | **Lawson v4.3.2** GTF + gene table | Would close DanioCell's 2,006-name residual exactly; we only hold v4.3 | UMass Cloudflare challenge — **blocked** |
| Zebrahub | Final *Cell* paper PDF + supplementary | Archives the publication package; may resolve the reference recipe and QC-regime questions below | **blocked** — not yet held |

Upload to `/daniotype_kasperov` tagged with the dataset; `sweep_uploads.sh --go` files them.

## Technical debt
_Ours to finish._

| Dataset | Task | Why it matters | Status |
|---|---|---|---|
| DanioCell | Regenerate `daniocell_canonical*.h5ad` with a logged script | **Our labelling consumes it**; no script exists and the recorded "26,251 mapped" doesn't reproduce (on-box map gives 27,247; object has 30,121) | **Not started — highest priority** |
| DanioCell | Audit publication-era `cluster_annotations.csv` vs the live portal | Labels may have drifted since 2023; we score against them | Not started |
| Zebrahub | Rerun `visualization/` against `zebrahub_combined_v2.h5ad` | Existing outputs used the defective object — it duplicated 14 hpf as 15 hpf and omitted 3 dpf entirely | **Required** |
| all four | Version-control the `sources/README.md` files | `raw_datasets/` is not a git repo — provenance records exist on this box only | Not started |

## Unresolved provenance
_Small, documented, mostly not closable by us._

| Dataset | Item | Why it matters | Status |
|---|---|---|---|
| DanioCell | Paper says 62 stages, release has 63 integer stages | Cosmetic; platforms are disjoint (10 + 53) so no data is missing | Open, 1 unit |
| ZSCAPE | Paper says 19 timepoints, files resolve 18 + one blank level | Same shape as above | Open, 1 unit |
| ChemFish | 348 realized `cell_type` vs 319 stated reference vocabulary | 29 labels beyond the vocabulary; affects label-transfer scoring | Open |
| ChemFish | CHEM11 released below the published hash thresholds (4.83% under ratio 2.5) | Released object is looser than the paper states — don't assume filtering | Open |
| ChemFish | Round-1 80-UMI cells absent (no cell below 100 UMI) | Extra pre-release filter, undocumented | Open |
| ChemFish | Raw sequencing accession | Paper: "will be available soon"; GEO/SRA/BioProject all empty | **Waiting on authors** |
| Zebrahub | Exact custom reference recipe | Name is known (`Danio.rerio_genome_Zebrabow_6`); assembly, Ensembl release, FASTA, GTF, Cell Ranger version and mkref are not | Open |
| Zebrahub | Historical QC-regime discrepancy | 2/5/10 dpf match the notebook's `total_counts` window; 10 hpf–24 hpf do not (~17k–100k) | Open |
| ZSCAPE | No run manifest naming the GTF | Reference is reconstructed to exact agreement; manifest is simply not public | Closed as far as possible |
