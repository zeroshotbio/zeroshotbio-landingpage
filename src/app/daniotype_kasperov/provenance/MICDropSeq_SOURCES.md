# MIC-Drop-seq — provenance record

Pooled CRISPR screen with per-cell genotypes. Companion to `../README.md`, which describes dataset
*contents*; this file records **where everything came from and how far each claim is
substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **Two experiments, not one.** An 8-target **pilot** (21,994 cells) and a 50-target **flagship
> screen** (226,492 cells). They differ in QC thresholds, guide inventory, Seurat generation and
> annotation depth, and must never be pooled without saying so.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *MIC-Drop-seq: scalable single-cell phenotyping of mutant vertebrate embryos* |
| Authors | Carey, Parvez *et al.* — Burgess lab |
| Venue | **Nature Communications 17, 4738 (2026)** — [10.1038/s41467-026-70989-w](https://doi.org/10.1038/s41467-026-70989-w), PMC13216532, PMID 41922342 |
| Preprint | bioRxiv [10.1101/2025.05.27.656468](https://doi.org/10.1101/2025.05.27.656468) |
| Assay | **10X Chromium Next GEM 3.1**, whole cells, with **CRISPR Guide Capture** feature barcoding |
| Purpose | Scale reverse genetics in a vertebrate: disrupt many genes across pooled embryos, then read genotype *and* phenotype from the same cell. Whole-embryo sequencing makes **cell-extrinsic** effects visible |
| Scale | **226,492 cells · 50 TFs + tyr control · 74 cell types · 24 hpf** |

| | Pilot | 50-gene screen |
|---|---|---|
| Targets | **7 TFs + tyr control** — cdx4, foxa2, hand2, hoxb1b, rx3, tbx16, tbxta, tyr | **50 TFs + tyr control** |
| Guides | **32** (4 per target, Supplementary Data 1) | **204** (4 per target, Supplementary Data 3) |
| Embryos | 40, one pooled super-loaded 10X channel | ~1,000 → 4 biological replicates of ~250 → 4 technical pools each = 16 samples |
| Stage | 24 hpf | 24 hpf |
| Cells | **21,994** | **226,492** — matches the paper exactly |
| Clusters | **35** (`seurat_clusters`, res 0.5) | **74** (`curated_cell_type2`) |
| Genotype-assigned | **14,488 (65.9%)** | **138,767 (61.3%)** — see §7 |
| gRNA recovery | median 15 molecules/cell; paper reports 71% detection | median 5 molecules/cell |

Both counts reproduce directly from the deposited cell-metadata tables. **CONFIRMED.**

**Accessions:** GEO **GSE315445** (public 2026-01-02, updated 2026-04-03) · BioProject
PRJNA1397167. GEO carries **36 samples** in three datasets: the pilot (GEX + CRISPR libraries),
amplicon validation (injected + wild type), and the 50-gene screen (16 GEX + 16 CRISPR libraries).
The same processed matrix is linked to both the GEX and CRISPR sample entries of each replicate.

## 2. Canonical released data

| Source | Where |
|---|---|
| Code | [clay-carey/MIC-Drop-seq](https://github.com/clay-carey/MIC-Drop-seq) — 4 R Markdown files, one per figure. Archived at Zenodo [10.5281/zenodo.18615355](https://doi.org/10.5281/zenodo.18615355) |
| Processed data | Zenodo [10.5281/zenodo.18602858](https://doi.org/10.5281/zenodo.18602858) — a single **28.95 GB** zip |

**Deposited flagship object** — `geo/GSE315445_micdrop_50_gene.rds`, Seurat **4.1.3**, four assays:

| Assay | Shape | Notes |
|---|---|---|
| `RNA` | **26,435 × 226,492** | raw integer counts, max 23,472, 530,118,067 nnz. **Gene-filtered** below the 32,520-feature Cell Ranger universe; rownames are **symbols** with Seurat `make.unique` suffixes (`phtf2`, `phtf2.1`) |
| `CRISPR` | 204 × 226,492 | the guide-capture matrix — the genotype evidence |
| `integrated` | 2,000 × 226,492 | Seurat-integrated HVG values |
| `prediction.score.celltype` | 274 × 226,492 | label-transfer scores over the full DanioCell reference label space |

Reductions: `pca`, `umap`, **`ref.pca`, `ref.umap`** — a Seurat reference-mapping workflow.

**Deposited pilot object** — `geo/GSE315445_pilot_seurat_object.rds`, **Seurat v5** (`Assay5`,
layer-based). The two experiments ship in **different Seurat generations**; code reaching for
`@counts` works on one and fails on the other. Use `SeuratObject::LayerData()`. **CONFIRMED.**

**The Zenodo bundle** (MD5 `133fbc3728adbfba436d2027590068df`, matching the published checksum;
211 files, 28 GB, held extracted at `data/input_data/` — the zip itself was deleted 2026-08-12 once
every entry was verified on disk) carries material GEO does not. The authors ship
a `README.md` inside it documenting every file.

| File | Size | What it gives |
|---|---|---|
| `DEG_results_5_9_24.rds` | 1.09 GB | **the precomputed edgeR pseudobulk DE grid** (§6) |
| `dcell_21_26.rds` | 8.64 GB | **the Daniocell 21–26 hpf reference actually used for label transfer** — the annotation chain is reproducible, not merely documented |
| `dcell_3_24.rds` | 52.7 MB | Daniocell 3–24 hpf, for the lineage analysis |
| `micdrop_int_xfer.RDS` | 8.70 GB | the integrated + label-transfer object |
| `micdrop_2-6-25.rds` | 7,221,586,953 B | the annotated 50-gene object. **Not** the same size as GEO's (7,212,997,471 B) — an 8.6 MB difference. Not yet hashed, so whether it is a different build is **UNVERIFIED** |
| `feature_reference.csv` | 3.7 KB | **all 32 pilot guides across 8 target sets** |
| `micdrop-50-config.csv` | 23 KB | the 204-guide config the classifier reads |
| `protospacer_calls_per_cell.csv` | 1.0 MB | pilot gRNA detection per cell |
| `amplican_results_summary.csv` | 19 KB | **frameshift frequencies per gRNA** |
| `micdrop_50_out_light/x1…x16` | ~3.5 GB | per-sample Cell Ranger output + `protospacer_calls_summary.csv` |
| `lineagemeta.rds`, `nodes_full2.csv`, `links_full.csv`, `coords_layout.rds`, `dcell_lineage_codes.csv` | | the developmental tree behind the cell-intrinsic / lineage-intrinsic / cell-extrinsic classification |
| in-situ / phenotype measurement CSVs | | gata, dlx, tp63, ntl, flow, bpm |

> **Extraction trap.** Info-ZIP refuses this archive with *"invalid zip file with overlapped
> components (possible zip bomb)"* and stops partway — after writing 24 GB, so the output directory
> looks plausibly complete. The MD5 matches, so this is a false positive. Extract with Python's
> `zipfile` (see `code/`), or set `UNZIP_DISABLE_ZIPBOMB_DETECTION=TRUE`.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCz11** | **CONFIRMED** |
| **Stated annotation** | **"GRCz11 v4.3.2 zebrafish reference genome"**, citing **Lawson et al., eLife 2020**. GEO's per-sample metadata repeats `Assembly: GRCZ v4.3.2` | **CONFIRMED as a claim** |
| **Deposited feature universe** | **32,724 features = 32,520 Gene Expression + 204 CRISPR Guide Capture** | **CONFIRMED** |
| **Gene namespace** | **100% ENSDARG** in the Cell Ranger matrices | **CONFIRMED** |
| **Custom transformation** | the 204 gRNA protospacers added as CRISPR Guide Capture features, giving a separate guide count matrix per sample | **CONFIRMED** |

### VERDICT: the deposited reference is plain Ensembl GRCz11, not Lawson v4.3.2

| Test | Result |
|---|---|
| vs **Ensembl GRCz11 gene set** (our release-114 GTF) | **exact identity — 32,520 / 32,520, zero differences in either direction** |
| vs Lawson v4.3 GTF (`LLgeneID` space) | **0 of 36,351 shared** — the Lawson GTF is not in ENSDARG space at all |
| vs Lawson v4.3 Ensembl-99 cross-reference | 28,875 ids, **all** inside MIC-Drop, but MIC-Drop has **3,645 more** |
| Lawson genes with no Ensembl equivalent | **7,265** — none appear |

A Cell Ranger reference built from the Lawson GTF would carry LL gene IDs and Lawson's 36,351
features. The deposited matrices carry the Ensembl gene set exactly. **The "v4.3.2" wording in both
the paper and the GEO metadata is not supported by the released feature universe.** **CONFIRMED** by
set identity. This is the same class of finding as ZSCAPE, where a Lawson claim also failed.

The exact Ensembl *release* is **UNRESOLVED** — the zebrafish gene set is identical between releases
99 and 114, so set identity cannot date it.

> **Caveat for integration.** The *deposited Seurat objects* carry only 26,435 (flagship) and 26,007
> (pilot) genes as **symbols**, not the full 32,520 ENSDARG universe. The complete universe exists
> only in the per-sample `features.tsv` files. Our canonical H5ADs recover ENSDARG by replaying
> Seurat's `make.unique` over those names (§8).

### Gene overlap with the corpus

MIC-Drop's 32,520-gene universe is a **strict superset of every other atlas we hold**:

| Atlas | Their features | Shared |
|---|---|---|
| ZSCAPE / ChemFish | 32,031 ENSDARG | **32,031 — 100% of theirs** |
| Zebrahub | 32,057 ENSDARG | **32,057 — 100% of theirs** |
| DanioCell (canonical) | 30,121 ENSDARG | **30,121 — 100% of theirs** |
| DanioCell (symbol-space `daniocell.h5ad`) | 36,250 symbols | 27,495 by symbol (86.5%) |

At ENSDARG level MIC-Drop integrates with all three with no loss on their side. **CONFIRMED.**

## 4. Processing pipeline

| Stage | Value | Confidence |
|---|---|---|
| Alignment / counting | Cell Ranger — **GEO states v7 for all 36 samples**, pilot and screen alike | **CONFIRMED** |
| Cell Ranger version in the paper | **none given anywhere in the Methods**; "Cell Ranger" appears in no supplementary PDF, and the Seurat objects carry no aligner provenance | **CONFIRMED absence** |
| Genotype thresholding | **Gaussian mixture model (Cell Ranger)** sets a UMI threshold per gRNA species, separating injected guides from ambient | **CONFIRMED** |
| Doublets | scDblFinder | **CONFIRMED** in Methods; **no doublet column in any deposited object** |
| Annotation method | **label transfer from Daniocell (21–26 hpf)**, then manual verification against markers | **CONFIRMED** |
| Downstream framework | Seurat — **4.1.3** (flagship) / **v5** (pilot) | **CONFIRMED** |

### QC — three sources, three thresholds

| Source | mito | min genes | max genes |
|---|---|---|---|
| Paper Methods | remove > **15%** | remove < **200** | — |
| Repo `Figure1` (pilot) | `< 15` | `> 200` | `< 9000` |
| Repo `Figure2` (50-gene) | `< 10` | `> 250` | `< 9000` |
| **Deposited pilot object** | max **15.00** ✔ | min **203** ✔ | max 8,980 ✔ |
| **Deposited 50-gene object** | max **14.99** ✔ | min **251** — stricter than the paper's 200 | max **9,984** ✘ |

The deposited 50-gene object satisfies neither the paper (which allows 200 genes) nor the Figure-2
code: **1,783 cells have ≥10% mitochondrial reads and 8 exceed 9,000 genes**. It is the state
*before* the Figure-2 subset, which the analysis applies downstream. **CONFIRMED** — do not assume
the code's thresholds hold in the released data.

## 5. Ground-truth annotations

**Authoritative file:** `obs` of the deposited objects, with Supplementary Data 4 as the published
companion table.

> **MIC-Drop is not independently annotated.** Labels were transferred from the **Daniocell**
> reference atlas (21–26 hpf) and then manually verified against marker expression. A
> DanioCell-derived label set cannot be treated as independent evidence about DanioCell.

| Tier | Cardinality | Notes |
|---|---|---|
| `predicted.id` | **179 realized** | raw DanioCell transfer labels |
| `prediction.score.celltype` assay | **274 features** | the full DanioCell reference label space, scored per cell |
| `curated_cell_type2` | **74** | the published cell types, manually curated |
| `cell_class` | **3** | Neural · Mesoderm / Endoderm · Non-neural Ectoderm |

No ZFA/CARO ontology ids; labels are free-text.

Supplementary Data 4 gives all 74 clusters with cell counts, `pct.classified` and five marker genes
each. Its counts sum to **exactly 226,492**, and **73 of 73** name-matched clusters agree
cell-for-cell with the deposited metadata. Filed at `analysis/supp_data4_50gene_cell_types.csv`. The
pilot's equivalent is Supplementary Data 2 (35 clusters, with `tissue` / `cell type` / markers).

**Vocabulary compatibility with DanioCell:** `predicted.id` is DanioCell's own annotation string
composed as `tissue | identity.super > identity.sub`. Against DanioCell's `cluster_annotations.csv`
(521 rows, 495 distinct composed labels), **161 of 179** MIC-Drop labels match a DanioCell row
exactly (89.9%). The misses mostly have an empty sub-tier (`adenohypophysis|adenohypophysis>`).
**CONFIRMED** — no harmonisation attempted.

### Perturbation labels — genotype assignment

| | | Confidence |
|---|---|---|
| Design | **4 gRNAs per target**, direct capture via 10X Feature Barcoding (`(BC)GTTTAAGAGCTAAGCTGGAA`, read R2) | **CONFIRMED** |
| No guide over threshold | `class = "ND"` — **87,725 cells (38.7%)** | **CONFIRMED** |
| Guides for >1 target | assigned `"Multiple"` and **treated as doublets and removed** | **CONFIRMED** in Methods; **no `Multiple` level survives in the deposited object** |
| Multi-guide, single target | retained — 76,128 cells with 1 guide, 42,265 with 2, 15,902 with 3, 4,472 with 4 | **CONFIRMED** |
| Coverage by replicate | group 1 **64.1%** · 2 **59.6%** · 3 **62.7%** · 4 **57.8%** | **CONFIRMED** |
| Per-target yield | **976** (*neurod1*) to **4,701** (*neurod4*), median 2,539 | **CONFIRMED** |

> **Trap:** `class` has **51 target levels + ND**, not 50. The 51st is `tyr`, the control.

### The "Non-Targeting" guides are tyr-targeting — proven

Supplementary Data 3 lists the four control guides as **`tyr-1..tyr-4`**. The deposited feature
reference, `micdrop-50-config.csv`, the CRISPR assay and amplican's `Group` column all call the same
four sequences **`Non-Targeting`**:

```
GAAAGTTACAACCTCCGCG  GATGTTGGCGAACATTGGCG  GAACCTCTGCCTCTCGGTAG  GGACTGGAGGACTTCTGGGG
```

`amplican_results_summary.csv` assays them under `ID = tyr-1..tyr-4` and measures **real editing**:

| Group | guides | mean % edited | mean % frameshifted |
|---|---|---|---|
| **Non-Targeting (= tyr)** | 4 | **9.79** | **6.33** |
| cdx4 | 4 | 9.72 | 5.81 |
| tbx16 | 4 | 10.72 | 7.20 |
| tbxta | 4 | 9.62 | 6.87 |
| foxa2 | 4 | 7.64 | 5.26 |
| rx3 | 4 | 4.88 | 3.44 |
| hand2 | 4 | 4.36 | 3.45 |
| hoxb1b | 4 | 2.79 | 1.70 |

The control edits at the same rate as the real gene targets, against a wild-type background indel of
≤0.89%. **A genuinely non-targeting guide cannot do that.** "Non-Targeting" is a persistent misnomer
across every machine-readable file the authors ship. **CONFIRMED.**

> **Consequence:** anyone using the "Non-Targeting" cells as an *unedited* control is using **tyr
> crispants carrying real Cas9 cutting**. Per-guide table at `analysis/amplican_editing_by_guide.csv`.

## 6. Important released analysis products

| Product | Where | Contents |
|---|---|---|
| **Pseudobulk DE grid** | `analysis/deg_results_pseudobulk.parquet` (from `DEG_results_5_9_24.rds`) | **30,053,751 rows** — `logFC, logCPM, F, PValue, FDR, cell_type, perturbation, gene, ncell_perturbed` over **71 cell types × 51 perturbations × 20,362 genes**. **76,490** combinations reach FDR < 0.05 with \|logFC\| > 0.5, led by *neurod1* (3,911), *tcf7l2* (3,309), *tbxta* (3,227) |
| **Cell-type metrics + markers** | Supp. Data 4 (50-gene, 74 clusters) and Supp. Data 2 (pilot, 35 clusters) | cell counts, `pct.classified`, 5 markers each |
| **Editing validation** | `amplican_results_summary.csv` (32 guides) and `geo/GSE315445_rhamp_results.csv.gz` (23 amplicons) | per-guide reads, indels, **frameshift frequency**. Both **pilot only** |
| **Guide inventory** | Supp. Data 1 / 3, `feature_reference.csv`, `micdrop-50-config.csv` | protospacer sequences, target gene ids, capture pattern |
| **Genotype calls** | `obs['class']`, `feature_call`, `num_umis`, `all_protos` | per-cell genotype and the guide evidence behind it |
| Lineage network | `lineagemeta.rds`, `nodes_full2.csv`, `links_full.csv`, `coords_layout.rds` | the tree behind cell-intrinsic / lineage-intrinsic / cell-extrinsic classification |
| Phenotype measurements | gata / dlx / tp63 / ntl / flow / bpm CSVs | in-situ and physiological validation |

> **The DE grid is collapsed across biological replicates.** There is no replicate column, so
> per-replicate pseudobulk DE is **not part of the release** — only the pooled contrast per
> cell type × perturbation. **CONFIRMED.**

Republished as Parquet by `code/convert_deg_results.R` because the RDS is unreadable from Python.

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Reference | "GRCz11 v4.3.2", citing Lawson | feature universe is **exactly** the Ensembl GRCz11 gene set; 0 of Lawson's 36,351 LL ids present | **CONFIRMED mismatch** |
| Ensembl release | — | identical sets across releases 99–114 | **UNRESOLVED** |
| Cell Ranger version | paper names **none**; GEO says **v7** on all 36 samples | no artifact contains "v5.0.0" | **v7 CONFIRMED; v5 NOT FOUND** |
| Control guides | Supp. Data 3 says `tyr-1..4` | every machine-readable file says `Non-Targeting`; amplican shows **9.79% editing** | **CONFIRMED** — they are tyr guides |
| Genotyped cells | **135,881** | deposited metadata gives **138,767**; excluding tyr **134,518**; with Figure-2 QC **138,224**; the paper's own Supp. Data 4 sums to **138,822** | **UNRESOLVED** — nothing lands on 135,881 |
| scDblFinder | used per Methods | no doublet flag distributed anywhere | **UNRESOLVED** |
| 50-gene QC | Figure2 code: mt < 10, genes < 9000 | released object has 1,783 cells ≥10% mito and 8 above 9,000 genes | **CONFIRMED** — object is pre-subset |
| Pilot feature reference | — | GEO ships 16 rows / 4 target sets; the data uses 32 guides / 8 sets | **CONFIRMED gap, now closed** by the Zenodo `feature_reference.csv` |
| Flagship validation | — | amplican and rhAmpSeq cover the **pilot only** | **UNRESOLVED** — no editing efficiency published for the 50 targets |
| Seurat generation | — | flagship v4.1.3 (`Assay`), pilot **v5** (`Assay5`) | **CONFIRMED** |
| `micdrop_2-6-25.rds` vs GEO object | — | differ by 8.6 MB | **UNVERIFIED** — not hashed |

## 8. Local assets

### Canonical H5ADs

Built by `code/build_micdrop_canonical.py` from `code/export_micdrop_rds.R`. The deposited RDS files
are never modified.

| | `../micdrop_50gene_canonical.h5ad` | `../micdrop_pilot_canonical.h5ad` |
|---|---|---|
| Cells × genes | **226,492 × 26,435** | **21,994 × 26,007** |
| `X` | raw integer counts, float32 CSR, 530,118,067 nnz | 60,342,478 nnz |
| ENSDARG recovered | **26,422 / 26,435** | **25,997 / 26,007** |
| `obsm['gRNA_counts']` | **204 guides**, 305,445 nnz | **32 guides**, 69,583 nnz |
| `obsm` embeddings | `X_pca`, `X_umap`, `X_ref_pca`, `X_ref_umap` | same |
| `uns` | `gRNA_features`, `daniocell_reference_labels` (274), `provenance` | same |

Two things a naive Seurat → H5AD conversion loses are preserved deliberately:

- **the guide-capture matrix** — it *is* the genotype evidence; without it the `class` calls cannot
  be checked. Validated: `obsm['gRNA_counts']` row sums equal `nCount_CRISPR` exactly.
- **the ENSDARG namespace** — recovered by replaying Seurat's `make.unique` over the `features.tsv`
  names, since the deposited objects carry symbols like `phtf2.1`.

Validated on read-back: counts integral, row sums equal `nCount_RNA`, per-row nonzeros equal
`nFeature_RNA`, all annotation tiers intact (74 / 3 / 179, 52 `class` levels, 138,767 assigned).

> **The pilot object carries all 32 guides** across its 8 target sets — confirming the 16-row
> deposited pilot feature reference is a deposit gap, not a smaller experiment.

### Source files

| File | Size | Notes |
|---|---|---|
| `geo/GSE315445_micdrop_50_gene.rds` | 7,212,997,471 B | the flagship object (Seurat 4.1.3) |
| `geo/GSE315445_pilot_seurat_object.rds` | 376,452,563 B | the pilot (Seurat v5) |
| ~~`data/mic_drop_seq_source_data.zip`~~ | 28,952,036,968 B | **deleted 2026-08-12** after verifying all 211 entries were extracted to `data/input_data/`. MD5 was `133fbc3728adbfba436d2027590068df`, matching Zenodo's published checksum; re-downloadable from the Zenodo DOI |
| `geo/*_cell_metadata.csv.gz` | | 226,492 × 17 and 21,994 × 23 |
| `geo/*_feature_reference.csv.gz` | | 204 guides (50-gene) and only 16 (pilot) |
| `geo/GSE315445_rhamp_results.csv.gz` | | 23 amplicons, pilot only |
| `geo/GSE315445_family.soft.gz` | | full GEO metadata, 36 samples |
| `publication/ncomms_micdropseq_fulltext.xml` | 182,545 B | Europe PMC full text |
| `supplementary/41467_2026_70989_MOESM{3,4,5,6,7}_ESM.xlsx` | | Supplementary Data 1–5 |
| `supplementary/41467_2026_70989_MOESM10_ESM.xlsx` | | Source Data, 48 per-figure sheets |

`analysis/` holds `deg_results_pseudobulk.parquet`, `amplican_editing_by_guide.csv`,
`supp_data4_50gene_cell_types.csv`, `micdrop_gex_features.csv`. `code/` holds the authors' repo plus
our four scripts (`export_micdrop_rds.R`, `build_micdrop_canonical.py`, `convert_deg_results.R`, and
the Python extractor).

The 100 per-sample feature-barcode matrices (~65 GB) were **not** bulk-downloaded; one
`features.tsv` pair established the feature universe. Raw FASTQs were not touched.

## 9. Caveats and outstanding work

- **The paper's reference claim is wrong for the deposited data.** Treat the feature universe as
  Ensembl GRCz11 and ignore the "v4.3.2" wording.
- **"v5.0.0" appears in no released artifact.** Check the bioRxiv preprint if the version matters.
- **135,881 is not reproducible** from any released file, including the paper's own Supp. Data 4.
- **No editing validation exists for the 50 flagship targets**, so per-target knockout efficiency is
  unknown for the main screen. This limits how much weight a null result per target can carry.
- **Per-replicate DE is not distributed.**
- **`micdrop_2-6-25.rds` vs the GEO object** — differ by 8.6 MB, not yet hashed; unclear which is
  canonical. Our H5ADs were built from the GEO object.
- **Annotation is DanioCell-derived**, so it cannot serve as independent evidence about DanioCell.

---

## Cross-dataset provenance principles

Applies to every dataset in this corpus; substantially identical in all `sources/README.md`
records.

1. **The deposited feature universe is evidence; the paper's reference claim is a hypothesis.**
   Gene IDs and feature counts are tested against candidate references before any harmonisation.
2. **Published reference claims and deposited data can disagree.** ZSCAPE, ZCL 2.0 and MIC-Drop-seq
   each carry a stated or assumed reference that the released features contradict or fail to
   support. Verification precedes downstream mapping, always.
3. **Canonical author releases outrank our older derived objects.** Every derived H5AD must have a
   reproducible build script and a `uns['provenance']` stamp; superseded objects are retained rather
   than overwritten, so prior results stay reproducible.
4. **Published QC is verified against released cells.** A threshold printed in Methods is never
   assumed to have been applied to the deposited object.
5. **Annotation source matters.** Author-called, transferred, ontology-backed, inferred, and
   our-own-mapping labels are distinguished and never silently blended.
6. **Harmonisation must not erase dataset-specific biology.** Original gene IDs, native labels,
   stage definitions, perturbation identities and technology metadata are preserved alongside any
   canonical mapping.
7. **Summary-level biological truths travel better than raw counts.** Author-derived marker genes,
   pseudobulk DE, abundance effects and perturbation summaries are preserved as first-class assets:
   they may support cross-dataset work in cases where the raw assays are not interchangeable.
