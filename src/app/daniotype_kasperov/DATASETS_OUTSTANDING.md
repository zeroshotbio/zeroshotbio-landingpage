# Outstanding work — held datasets + acquisition targets

Held and provenanced: ZSCAPE · ChemFish · DanioCell · Zebrahub. ZCL 2.0 / ZCDL in progress.

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

## Acquisition targets — zebrafish perturbation scRNA-seq class
_Steven's defensible public list, 2026-08-11. **Not independently verified by us** — cell counts and
years are as supplied; treat as acquisition scope, not as sourced facts, until each is checked
against its own release the way ZSCAPE/ChemFish/Zebrahub/ZCL2 were._

| Dataset | Year | Perturbation | Cells | Held? |
|---|---|---|---|---|
| Farrell / URD | 2018 | MZoep Nodal mutant | 38,731-cell WT atlas + 5,616 WT/MZoep assay cells | No |
| Wagner | 2018 | CRISPR *chordin* vs *tyr* | >92,000 total; six CRISPR embryos | No |
| **CellOracle** | 2023 | *noto, lhx1a, sebox, irx3a, flh* LOF | main replicated *lhx1a*/*tyr* 121,745; further cohorts | No |
| Body-elongation perturbations | 2023 | FGF/BMP inhibition + Wnt suppression | ~120–140k across WT + 3 perturbations | No |
| **ZSCAPE** | 2023 | 23 genetic perturbations | 3.2M total; ~2.0M perturbation arm | **Yes** |
| **Cell-cycle arrest** | 2024 | HUA drugs + *emi1* mutant | 248,998 | No |
| UPR-TF / MIMIR | 2025 | CRISPR + TF gain-of-function | ~60,000 across 12 conditions | No |
| **ChemFish** | 2025 | 8 compounds / 7 pathways | 2,068,668; 508 embryos | **Yes** |
| **MIC-Drop-seq** | 2026 | 50-TF CRISPR screen | 226,492 flagship + 21,994 pilot | **Yes — acquired & provenanced 2026-08-11** |
| Cranial-neural-crest Perturb-seq | 2026 (public GEO) | F0 TF crispants | 15-library Direct-Capture Perturb-seq; no consolidated count reported | No |

**Standouts:** ZSCAPE · ChemFish · MIC-Drop · CellOracle · cell-cycle arrest.
**MIC-Drop-seq is the most important missing acquisition.** Held datasets are bold+Yes; the other
eight are unacquired, so each needs accession discovery, download, and a `sources/` provenance pass.

## Technical debt
_Ours to finish._

| Dataset | Task | Why it matters | Status |
|---|---|---|---|
| DanioCell | Regenerate `daniocell_canonical*.h5ad` with a logged script | **Our labelling consumes it**; no script exists and the recorded "26,251 mapped" doesn't reproduce (on-box map gives 27,247; object has 30,121) | **Not started — highest priority** |
| DanioCell | Audit publication-era `cluster_annotations.csv` vs the live portal | Labels may have drifted since 2023; we score against them | Not started |
| Zebrahub | Rerun `visualization/` against `zebrahub_combined_v2.h5ad` | Existing outputs used the defective object — it duplicated 14 hpf as 15 hpf and omitted 3 dpf entirely | **Required** |
| MIC-Drop | Canonical H5ADs **built** — `micdrop_50gene_canonical.h5ad` (226,492 × 26,435) + `micdrop_pilot_canonical.h5ad` (21,994 × 26,007), gRNA matrices and ENSDARG preserved | Genotype evidence survives conversion; validated against nCount_RNA/nFeature_RNA/nCount_CRISPR | **Done 2026-08-11** |
| MIC-Drop | Zenodo processed bundle **held** (MD5-verified, 211 files) — DE grid republished as `analysis/deg_results_pseudobulk.parquet` (30,053,751 rows, 71 cell types × 51 perturbations × 20,362 genes) | Also brings the Daniocell 21–26 hpf reference used for label transfer, so the annotation chain is reproducible | **Done 2026-08-11** |
| MIC-Drop | Hash `micdrop_2-6-25.rds` (Zenodo) against `GSE315445_micdrop_50_gene.rds` (GEO) | They differ by 8.6 MB; unclear which is canonical. I built from the GEO one | Not started — small |
| infra | `minifin_query.service` has **427 restarts** | OOM-killed while loading MegaFin (537,959 × 36,351). Pre-existing, not caused by this work, but it makes any large local job unsafe | **Not started — real production issue** |
| all five | Version-control the `sources/README.md` files | `raw_datasets/` is not a git repo — provenance records exist on this box only | Not started |
| ZCL2 | Retire `zcl2.h5ad` in favour of `zcl2_canonical.h5ad` | The old object is 40/199 libraries, 2 of 5 stages, empty `var`, no labels | Superseded; **no consumers found**, so retiring is safe whenever we want the 2.8 GB back |
| ZCL2 | Decide whether ZCL 2.0 becomes a labelling target | It now has a full 143-cluster GT hierarchy and is the only atlas here covering adult + aged fish; but Microwell-seq is shallow (median 872 UMI) and cross-platform | **Product decision — not started** |

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
| MIC-Drop | Paper + GEO claim a Lawson v4.3.2 reference; the feature universe is **exactly** the Ensembl GRCz11 gene set | 32,520/32,520 identical to Ensembl; 0 of Lawson's 36,351 LL ids present | **Closed as a confirmed mismatch** |
| MIC-Drop | Cell Ranger version | GEO says v7 on all 36 samples; the paper names no version and "v5.0.0" appears in no released artifact | Open — check the bioRxiv preprint |
| MIC-Drop | Paper's 135,881 genotyped cells not reproducible | Released data and the paper's own Supplementary Data 4 both give ~138.8k | Open — likely scDblFinder, but no doublet flag was distributed |
| MIC-Drop | Deposited pilot feature reference covers 4 of 8 target sets | **Closed** — the Zenodo bundle's `feature_reference.csv` has all 32 guides | Closed |
| MIC-Drop | No editing validation for the 50 flagship targets | amplican and rhAmpSeq are pilot-only. The pilot's "Non-Targeting" control edits at 9.79% — it is a tyr crispant, not an unedited control | Open — authors' data simply doesn't cover it |
| MIC-Drop | Per-replicate pseudobulk DE not distributed | The released DE grid is collapsed across the 4 biological replicates | Open |
| ZSCAPE | No run manifest naming the GTF | Reference is reconstructed to exact agreement; manifest is simply not public | Closed as far as possible |
| ZCL2 | GTF / Ensembl release, STAR version, UMI length, RNA-contamination method | Paper, Supplementary Methods (wet-lab only) and repo (downstream only) are all silent; namespace is 93.6% Ensembl-99 symbols, which dates it no further | Open — likely not closable |
| ZCL2 | Table S1 vs `ZCDL_cellinfo.csv` disagree on **30/143** cluster cell types, 8/143 lineages | Two published annotations of the same clusters; C8/C11 are swapped. We use cellinfo — any score must declare which | Open |
| ZCL2 | Paper says top **10,000** cells/library; every GEO DGE holds exactly **20,000** | Affects what "the deposit" means; the cap is the authors', not ours | Open |
| ZCL2 | Table S1 adult average UMI/gene not reproduced (3 of 5 stages match to the decimal) | 3 m and 22 m only; the GEO-deposit explanation is refuted | Open |
| ZCL2 | Old `zcl2.h5ad` recovers only ~40% of canonical 22-month cells (~96–100% for 3 m) | Stage-split, so not a simple depth cap | Open — moot once retired |
