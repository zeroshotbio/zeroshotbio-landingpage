# CellOracle (zebrafish) — provenance record

Zebrafish crispant/mutant perturbation series underpinning the CellOracle GRN method. Companion to
`../README.md`, which describes dataset *contents*; this file records **where everything came from
and how far each claim is substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **The zebrafish arm is one part of a three-system paper** (mouse haematopoiesis, human
> haematopoiesis, zebrafish embryogenesis). Only the zebrafish series, GSE145298, is covered here.
> One of its 31 samples is **mouse** and is excluded — see §1.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *Dissecting cell identity via network inference and in silico gene perturbation* |
| Authors | Kamimoto, Stringa, Hoffmann, Jindal, Solnica-Krezel, Morris — Morris lab |
| Venue | **Nature 614, 742–751**, 8 February 2023 — [10.1038/s41586-022-05688-9](https://doi.org/10.1038/s41586-022-05688-9), PMC9946838 |
| Preprint | bioRxiv [10.1101/2020.02.17.947416](https://doi.org/10.1101/2020.02.17.947416) |
| Assay | **10X Chromium**, whole cells, ~10,000 cells targeted per lane, Illumina **NextSeq 550** |
| Purpose | Provide the *observed* perturbation ground truth against which CellOracle's **in silico** TF knockouts are validated. The dataset's value is the pairing of real crispant scRNA-seq with inferred regulatory networks |
| Scale | **394,459 cells · 30 zebrafish samples · 3 stages · 6 perturbed genotypes** |
| Embryos | ~25 embryos per sample |

**Accessions:** GEO **GSE145298** · BioProject PRJNA606682 · SRA SRP249509.

### The series holds 31 samples — one is mouse

`GSM4314394` (`perturbseq_ieps`, *Mus musculus*, HiSeq 2500, `genes.tsv` Cell Ranger v2 format,
plus a gRNA/gene barcode reference table) belongs to the **mouse iEP Perturb-seq** arm. The other
**30 samples are *Danio rerio***, all on NextSeq 550 with `features.tsv` v3 format. **CONFIRMED.**
Headline counts that treat the series as 31 zebrafish samples are wrong.

### Design — reconstructed exactly from GEO characteristics

| Group | Samples | Stage | Strain field | Cells |
|---|---|---|---|---|
| `wt_s1..s6` | 6 | **6 hpf** (s1,s2) · **8 hpf** (s3,s4) · **10 hpf** (s5,s6) | WT | 42,617 |
| `tyr_1..7` | 7 | 10 hpf | tyr crispant generated from wild type | 105,090 |
| `flh_control_1,2` | 2 | 10 hpf | floating head mutant, **+/+ and +/n1** | 37,154 |
| `flh_mut_1,2` | 2 | 10 hpf | floating head mutant, **n1/n1** | 35,716 |
| `noto_1..3` | 3 | 10 hpf | noto crispant | 27,554 |
| `lhx1a_1..4` | 4 | 10 hpf | lhx1a crispant | 58,119 |
| `sebox_1..3` | 3 | 10 hpf | sebox crispant | 44,119 |
| `irx3a_1..3` | 3 | 10 hpf | irx3a crispant | 44,090 |

**Two distinct genetic strategies**, which must not be pooled:

- **F0 crispants** — Cas9/gRNA ribonucleoprotein injected at 0 hpf: `noto`, `lhx1a`, `sebox`,
  `irx3a`, `tyr`.
- **Stable mutant line** — *floating head* (`flh`), heterozygote incross with `n1/n1` mutants and
  `+/+`, `+/n1` siblings selected on morphology at 10 hpf. **CONFIRMED** from GEO characteristics.

**All perturbations are at 10 hpf.** The 6/8/10 hpf wild-type series is the developmental reference
used for GRN inference and label transfer, not a perturbation arm.

Candidate TF selection is documented in Methods: `lhx1a`, `sebox` and `irx3a` were chosen from a
larger list; `creb3l1` was dropped (sequence similarity to `creb3l2` prevented specific sgRNA
design) and `zic2a` was dropped (expressed in other sub-branches). **CONFIRMED.**

## 2. Canonical released data

GEO deposits **only Cell Ranger filtered matrices** — `barcodes.tsv.gz`, `features.tsv.gz`,
`matrix.mtx.gz` per sample, delivered as `GSE145298_RAW.tar` (1,882,255,360 B, 94 entries) and held
locally in extracted form at `data/matrices/`. The tar itself was deleted 2026-08-12 once every
entry was verified present on disk.

> ### There are no annotations in the deposit
> **No cell-type labels, no embeddings, no Seurat object, no per-cell metadata of any kind** are
> distributed in GSE145298. The paper's cell types exist only in its figures. This is the single
> largest limitation of the dataset as we hold it, and it is **CONFIRMED** by exhaustive listing of
> the tar. See §5.

Per-sample cell counts are tabulated in §1. Feature files are **byte-identical across all 30
zebrafish samples** — one reference, verified row-for-row and in order.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCz11** | **CONFIRMED** (GEO `Genome_build: GRCz11`; the string "GRCz11" does **not** appear in the paper text) |
| **Stated annotation** | *none* — neither paper nor GEO names a GTF or Ensembl release | **UNRESOLVED as a citation** |
| **Deposited feature universe** | **25,107 features**, all `Gene Expression` | **CONFIRMED** |
| **Gene namespace** | **100% ENSDARG**, with symbols in column 2 | **CONFIRMED** |
| **Custom transformation** | none — no spike-ins, no transgenes, no guide features | **CONFIRMED** |

### VERDICT: Ensembl GRCz11 protein-coding, primary assembly only — reconstructed exactly

| Rule | Result |
|---|---|
| Ensembl GRCz11, `gene_biotype == protein_coding`, **primary assembly only (chr 1–25 + MT)**, unplaced scaffolds dropped | **exactly 25,107 — set match AND identical ordering to the GTF** |

Cell Ranger preserves GTF order, so order identity confirms the GTF lineage rather than merely the
set. **RECONSTRUCTED.**

Supporting evidence:

| Test | Result |
|---|---|
| CellOracle ids outside the Ensembl GRCz11 gene set | **0** — a strict subset |
| Biotype of all 25,107 | **protein_coding**, 100% |
| Ensembl protein_coding total | 25,432 → **325 absent** |
| Location of those 325 | **all on unplaced scaffolds** (`KN*`/`KZ*`); **0 on primary chromosomes** |
| Mitochondrial genes | **13 retained** |
| 10x standard `mkgtf` allowlist (protein_coding + lncRNA + IG/TR) | 25,606 — **does not match**; CellOracle keeps no lncRNA and no IG/TR |
| **Lawson v4.3 LL gene ids** | **0 of 36,351 shared** — not a Lawson reference |
| Lawson v4.3 Ensembl-99 cross-reference | 24,388 shared (97.1% of CellOracle), but Lawson has no scaffold rule matching this |

**Ensembl release is UNRESOLVED but tightly bounded**: releases **99, 102 and 114 give byte-identical
results** for this rule (32,520 genes, 25,432 protein_coding, the same 325 scaffold genes), so set
identity cannot date it. Cell Ranger v5.0.1 dates the build to roughly 2020–2021.

### Gene overlap with our corpus

CellOracle has the **smallest feature universe in the corpus** and is a strict subset of every
Ensembl-based atlas we hold:

| Atlas | Their features | Shared with CellOracle | % of CellOracle |
|---|---|---|---|
| MIC-Drop-seq | 32,520 ENSDARG | 25,107 | **100%** |
| ZSCAPE / ChemFish | 32,031 ENSDARG | 25,107 | **100%** |
| Zebrahub | 32,057 ENSDARG | 25,107 | **100%** |
| DanioCell (canonical) | 30,121 ENSDARG | 23,719 | 94.5% |
| Ensembl GRCz11 (rel-99/102/114) | 32,520 | 25,107 | **100%** |

> **Consequence for harmonisation.** Because CellOracle contains only protein-coding, primary-assembly
> genes, the *absence* of a lncRNA, pseudogene or scaffold gene here is a property of the reference,
> **not** biological evidence. Any cross-dataset comparison must intersect to CellOracle's 25,107,
> or explicitly mark the missing classes.

## 4. Processing pipeline

| Stage | Value | Confidence |
|---|---|---|
| Chemistry | 10X Chromium, ~10,000 cells targeted per lane | **CONFIRMED** |
| Alignment / counting | **Cell Ranger v5.0.1**, default pipeline, **filtered** output used downstream | **CONFIRMED — stated in BOTH the paper Methods and GEO, in agreement** |
| Downstream framework | **Seurat v4.0.1** | **CONFIRMED** |
| Normalization | `NormalizeData()` defaults; `FindVariableFeatures(nfeature = 2000)` | **CONFIRMED** |
| Integration | `SelectIntegrationFeatures` → `FindIntegrationAnchors` → `IntegrateData`, default parameters | **CONFIRMED** |
| Dimensionality / clustering | scale → PCA → clustering; **t-SNE on the first 30 PCs** | **CONFIRMED** |
| Doublet detection | **none mentioned** — no Scrublet, DoubletFinder or scDblFinder anywhere in the paper | **CONFIRMED absence** |
| QC thresholds | *"Cells were filtered by RNA count and percentage of mitochondrial genes"* — **no numbers given** | **UNRESOLVED** |
| Ambient / non-cell removal | *"we assessed the RNA count distribution to remove clusters with an abnormal RNA count distribution"* — a manual, unreproducible step | **UNRESOLVED** |

### Published QC vs the released cells

The paper states no numeric thresholds, so the deposit was tested directly:

| Measure | Deposited value | Reading |
|---|---|---|
| minimum UMI | **exactly 500**, 0 cells below | an **undocumented hard 500-UMI floor** was applied before deposit — Cell Ranger's default filtered output does not impose this |
| minimum genes | 213; 0 cells below 200 | consistent with, but not proof of, a 200-gene rule |
| `pct_mt` | max **52.17%**; **1,475 cells (0.4%) above 10%** | **no mitochondrial filter was applied to the deposit** |
| median UMI / genes | 2,762 / 1,147 | |

**The deposited matrices are therefore pre-Seurat-QC but post an undocumented UMI floor.**
**CONFIRMED.**

Independent corroboration: the paper reports the flh mutant-vs-control comparison at
**n = 57,175 cells, 2 biological replicates**. The deposited flh mutant + sibling samples total
**72,870** — the published figure is **78%** of the deposit, i.e. roughly 21.5% of cells were
removed by the Seurat QC and ambient-cluster steps that are not numerically specified.
Per-genotype QC: `analysis/qc_by_genotype.csv`.

## 5. Ground-truth annotations

> **No annotation is distributed *for the zebrafish arm*.** GSE145298 contains matrices only. The
> zebrafish cell-type labels used in the paper cannot be recovered from the deposit, and searching
> the CellOracle package (2026-08-13) confirmed it: the only downloadable annotations are **2,671
> mouse haematopoiesis cells** (Paul et al. 2015). **Our 394,459 zebrafish cells remain unlabelled.**
> This is now an established absence rather than an unsearched gap — closing it needs an author
> request, or re-derivation using the zebrafish base GRN we now hold (§6).

What the Methods document about how those labels were made:

| Step | Detail | Confidence |
|---|---|---|
| Source of labels | **transferred from Farrell et al. 2018** zebrafish scRNA-seq segmentation labels via Seurat `FindTransferAnchors` / `TransferData`, defaults | **CONFIRMED** |
| Manual step | *"We manually adjusted the cell annotation to account for differences in the timing of cell collection"* | **CONFIRMED** |
| Propagation | WT reference labels then transferred to the crispant/mutant data by the same functions | **CONFIRMED** |
| Embedding | UMAP trained on WT axial-mesoderm clusters, then KO/control data projected onto it | **CONFIRMED** |
| Ontology ids | none | **CONFIRMED absence** |

**CellOracle's zebrafish labels are transferred, twice**: Farrell → WT reference → perturbed
samples. They are not independent evidence about Farrell et al., and error propagates across both
hops. This is the same category as ChemFish (Duran reference) and MIC-Drop-seq (DanioCell).

### Perturbation ground truth — three control tiers, do not conflate

| Tier | Samples | What it controls for |
|---|---|---|
| **Uninjected wild type** | `wt_s1..s6` | baseline development; the only cells with no manipulation at all |
| **Uninjected mutant siblings** | `flh_control_1,2` (`+/+` and `+/n1`) | genetic background of the flh line, no injection |
| **Injection control crispant** | `tyr_1..7` | injection, Cas9 activity and non-specific cutting — **NOT a neutral control** |

> **`tyr` is a crispant, not a neutral control.** Cas9 cuts the *tyr* locus in these embryos; they
> carry real double-strand breaks and real indels. The paper uses them as the comparison baseline
> throughout (Supplementary Data explicitly compares `lhx1a_gRNA_average` against
> `tyr_gRNA_average`). This is the same trap as MIC-Drop-seq, where the tyr control guides were
> mislabelled "Non-Targeting" and shown to edit at 9.79%. Anything requiring a *genuinely unedited*
> baseline must use `wt_*` or `flh_control_*`, not `tyr_*`. **CONFIRMED.**

The canonical H5AD encodes this in `obs['control_class']` with four values:
`uninjected_wild_type`, `uninjected_mutant_sibling`, `injection_control_crispant`, `not_a_control`.

## 6. Important released analysis products

This dataset's distinguishing value is that it links observed perturbations to **inferred regulatory
networks**. Those outputs ship as supplementary tables, all extracted to `analysis/`:

| Product | Source | Contents |
|---|---|---|
| **Systematic in silico TF KO screen** | Supp. Data 3 → `perturbation_score_all_TFs.csv` | negative perturbation-score sum for **325 TFs**, ranked (top: *foxc1b*, *fosab*, *zeb1b*, *foxd2*, *mef2d*) |
| **Predicted vs literature validation** | Supp. Data 3 "References" → `perturbation_score_references.csv` | 31 TFs annotated **Direct 11 · Hox gene family 10 · Indirect 6 · Unknown 4**, with PubMed ids |
| **Cell-type abundance effects** | Supp. Data 4 → `cell_composition_effects.csv` | 45 rows: `celltype, p, p_adjusted, proportion_Control, proportion_LOF` for noto/lhx1a, chi-square with Bonferroni correction |
| **NMF module results** | Supp. Data 5 → `nmf_modules_summary.csv`, `nmf_module_weights_top30.csv` | **40 modules**, `lhx1a_gRNA_average` vs `tyr_gRNA_average`, delta, p, p_adj, cell-type annotation and GO terms. **24 of 40 significant** at p_adj < 0.05. Plus top-30 genes and weights per module |
| **sgRNA sequences** | Supp. Data 6 → `sgRNA_sequences.csv` | 25 rows — per-gene guide sequences |
| **Genotyping primers** | Supp. Data 6 → `genotyping_primers.csv` | 18 rows, including crispant-specific primers |
| **RT-qPCR primers** | Supp. Data 6 → `rtqpcr_primers.csv` | 4 rows |
| Pre-built base GRNs | Supp. Data 1 | catalogue of base GRNs by species, reference genome and motif source |
| Literature gene annotations | Supp. Data 2 | `Zebrafish_gene_previous_studies` with PubMed ids |
| Statistics summary | Supp. Data 4 "summary" | test, correction and location for every reported p-value |

### GRNs — partially recovered 2026-08-13, from the CellOracle *package*, not GEO

The paper's Data-availability statement points only at raw reads and expression matrices, and
nothing network-shaped is deposited in GEO, Zenodo, figshare or cellxgene. **But the authors ship
annotations and GRNs inside the CellOracle Python package** (`celloracle/data/`, retrievable via the
`celloracle.data.load_*` API). Those were extracted to portable tables and are now held locally —
every row count independently re-verified:

| Product | Rows | Verified |
|---|---|---|
| **Zebrafish `danRer11` promoter base GRN** | **6,029,993** TF→target edges | ✔ |
| Mouse `mm10` promoter base GRN | 4,100,756 | ✔ |
| Human `hg38` promoter base GRN | 5,411,629 | ✔ |
| Mouse sci-ATAC-atlas base GRN (the paper's actual mouse prior) | 91,976 peaks × 1,093 TFs, native matrix | ✔ |
| **Inferred** GRN, mouse haematopoiesis — significant edges | 48,000 (top 2,000 × 24 states) | ✔ |
| **Inferred** GRN, mouse haematopoiesis — complete | **1,798,488** edges, split `part1of2`/`part2of2` | ✔ |
| Per-gene network scores (degree, betweenness, PageRank…) | per gene × cluster | ✔ |
| Mouse haematopoiesis cell annotations (Paul et al. 2015) | 2,671 cells | ✔ |

The two-part split is **on cluster boundaries, not an arbitrary chunking**: 12 disjoint clusters per
file, zero overlap, both carrying the full header, exactly 74,937 edges per cluster. **Each part is
a standalone valid CSV.gz — no reassembly needed.**

> **Still NOT distributed:** the **zebrafish** inferred GRN, the mouse-gastrulation inferred GRN, the
> CellOracle **simulation vectors**, and the **differentiation vector fields**. The authors state
> these are regenerated by running CellOracle against the GEO/ArrayExpress data with the matching
> base GRN. <https://celloracle.org> remains interactive-only. **UNRESOLVED — but now tractable**,
> because the zebrafish base GRN prior is in hand.

> ⚠ **Joining caveat.** The zebrafish base GRN is keyed on **danRer11 coordinates and gene symbols**
> (`peak_id` like `chr10_10312024_10313124`; TFs such as `CABZ01056727.1`). danRer11 *is* GRCz11, so
> coordinates are compatible — but our canonical object is **ENSDARG**, so any join runs through
> symbols and is lossy. Same trap family as ZCL 2.0.

**Base GRN ≠ inferred GRN.** Base GRNs are motif-derived *priors* — a TF has a motif in an
accessible promoter — direction-agnostic and not cell-type-specific. The inferred network is what
CellOracle fits per cell state; its `coef_mean` carries the signed edge weight.

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Reference annotation | none stated | Ensembl GRCz11 `protein_coding`, primary assembly only → **exactly 25,107, set and order match** | **RECONSTRUCTED** |
| Lawson reference | never claimed | 0 of Lawson's 36,351 LL ids appear | **CONFIRMED negative** |
| Ensembl release | none stated | releases 99 / 102 / 114 identical under the rule | **UNRESOLVED**, bounded |
| Cell Ranger version | **v5.0.1** in the paper | **v5.0.1** in GEO for all 30 samples | **CONFIRMED — sources agree** |
| Series composition | — | 31 samples = **30 zebrafish + 1 mouse** | **CONFIRMED** |
| QC thresholds | "filtered by RNA count and mitochondrial percentage", no numbers | deposit has a hard **500-UMI floor**, 0 cells below; **no mito filter** (0.4% exceed 10%) | **CONFIRMED**, thresholds themselves **UNRESOLVED** |
| Ambient-cluster removal | manual inspection of RNA-count distribution | not reproducible | **UNRESOLVED** |
| flh comparison size | **57,175 cells** | deposited flh mutant + sibling = **72,870** | **CONFIRMED** — deposit is pre-QC, ~21.5% removed downstream |
| Cell-type annotations | used throughout the paper | **none deposited anywhere** | **UNRESOLVED — not recoverable** |
| Annotation independence | — | transferred from Farrell et al., then WT→perturbed; two hops | **CONFIRMED** |
| `tyr` control | used as the comparison baseline | it is an **F0 crispant with real Cas9 cutting**, not a neutral control | **CONFIRMED** |
| GRNs / simulations | central to the paper | no network or simulation object distributed | **UNRESOLVED** |
| Doublet handling | not mentioned | no doublet method in Methods or deposit | **CONFIRMED absence** |
| Independent critique | — | *"Critical issues found in 'Dissecting cell identity via network inference and in silico gene perturbation'"*, Nourisa, Passemiers & Tomforde, bioRxiv [10.1101/2024.10.16.618746](https://doi.org/10.1101/2024.10.16.618746), 2024-10-17 | **a PREPRINT critique, not peer-reviewed** — recorded, not endorsed; not assessed by us |

## 8. Local assets

### `../celloracle_zebrafish_canonical.h5ad` — canonical

Built by `code/build_celloracle_canonical.py`. Source matrices are never modified.

| | |
|---|---|
| Cells × genes | **394,459 × 25,107** |
| `X` | **raw integer counts** (max 1,083 in the first 30k block), float32 CSR, from the Cell Ranger **filtered** matrices as used by the paper |
| `obs` | `barcode, gsm, sample, genotype, perturbation_class, control_class, replicate, stage, strain` |
| `var` | `ensembl_id` (ENSDARG), `gene_symbol`, `feature_type` |
| `uns['provenance']` | paper DOI, GEO lineage, tar SHA256, the reconstructed reference rule, the Cell Ranger agreement, the three control tiers, and the QC caveats |
| Annotations | **none** — the deposit carries no labels, and nothing was invented to fill the gap |

Validated: counts integral; feature files byte-identical and in identical order across all 30
samples (asserted during the build); 13 mitochondrial genes present.

### Source files

| File | Size | Notes |
|---|---|---|
| ~~`geo/GSE145298_RAW.tar`~~ | 1,882,255,360 B | **deleted 2026-08-12** after verifying all 94 entries were extracted to `data/matrices/`. Size matched the remote `Content-Length` exactly; re-downloadable from GEO |
| `geo/GSE145298_family.soft.gz` | | full GEO metadata, 31 samples |
| `data/matrices/` | | extracted per-sample barcodes/features/matrix |
| `publication/nature_celloracle_fulltext.xml` | 325,423 B | Europe PMC full text |
| `supplementary/41586_2022_5688_MOESM{1..9}_ESM.*` | | SI PDF (9.2 MB), reporting summary, Supplementary Data 1–6, video |
| `code/CellOracle-master/` | | morris-lab/CellOracle repository |

`analysis/` holds `celloracle_features.csv`, `geo_sample_metadata.json`, `qc_by_genotype.csv`,
`sgRNA_sequences.csv`, `genotyping_primers.csv`, `rtqpcr_primers.csv`,
`perturbation_score_all_TFs.csv`, `perturbation_score_references.csv`,
`cell_composition_effects.csv`, `nmf_modules_summary.csv`, `nmf_module_weights_top30.csv`.

Raw SRA FASTQs were not downloaded.

## 9. Caveats and outstanding work

- **No zebrafish cell-type annotations exist anywhere public** — confirmed 2026-08-13 against both
  GEO and the CellOracle package. Anything label-dependent needs re-derivation or an author request.
  **Still the dominant limitation of this dataset.**
- **`tyr` is not a neutral control.** Any analysis needing an unedited baseline must use `wt_*` or
  `flh_control_*`.
- **QC thresholds are unstated and the ambient-removal step is manual**, so the paper's cell counts
  cannot be reproduced from the deposit — confirmed by the flh 72,870 vs 57,175 gap.
- **The feature universe is protein-coding, primary-assembly only.** Gene absence here is a
  reference property, not biology.
- **GRNs partially recovered** (§6): base GRNs for zebrafish/mouse/human and the mouse
  haematopoiesis inferred network are held, extracted from the CellOracle package. The **zebrafish
  inferred GRN, simulation vectors and vector fields are still not distributed**.
- **Ensembl release is not datable** from the gene set.
- A **preprint critique** of the paper's methods exists (§7). We have not evaluated it; it is
  recorded so that anyone relying on the *inferred* networks knows to read it first. It does not
  bear on the observed scRNA-seq data, which is what we hold.

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
