# ZSCAPE — provenance record

Genetic-perturbation atlas of zebrafish development. Companion to `../README.md`, which describes
dataset *contents*; this file records **where everything came from and how far each claim is
substantiated**.

**Confidence vocabulary** — used identically across all five provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

---

## 1. Dataset identity

| | |
|---|---|
| Title | *Embryo-scale reverse genetics at single-cell resolution* |
| Authors | Saunders, Srivatsan, Duran, Dorrity, Ewing, Linbo, Shendure, Raible, Moens, Kimelman, Trapnell |
| Venue | **Nature 623**, 23 November 2023 — [10.1038/s41586-023-06720-2](https://www.nature.com/articles/s41586-023-06720-2) |
| Assay | **sci-RNA-seq3** on PFA-fixed **nuclei**, with **sci-Plex** oligo hashing for per-embryo barcoding. Illumina NextSeq 500 / NextSeq 2000 / NovaSeq 6000. **CONFIRMED** (Methods) |
| Purpose | Reverse genetics at embryo scale: resolve embryos *individually* so cell-type abundance variance can be estimated first, and perturbation effects measured against it |
| Scale | **1,812 embryos · 19 timepoints (18 realized) · 23 perturbations · 3.2 M cells**, ≥8 embryos per condition |
| Rearing | 28 °C throughout |

**Perturbation arm alone:** 804 barcoded embryos across 98 conditions (159 injection control,
645 perturbation), **2.7 M cells in a single sci-RNA-seq3 run**, ~10% of cells sampled per embryo,
~70% embryo-of-origin recovery from hashing. The ~600,000 control-injected cells showed no batch
effect against the wild-type series and **were merged into the reference**, which is why the
reference arm is 1.24 M cells rather than pure wild-type.

Four experiments (supplementary sheet `1_expt_metrics`):

| Experiment | Timepoints (hpf) | Cells | Embryos | Hash enrichment |
|---|---|---|---|---|
| Time Series R1 | 48, 72, 96 | 78,741 | 288 | > 3 |
| Time Series R2 | 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 42 | 332,001 | 529 | > 3 |
| Time Series R3 | 40, 42, 44, 46 | 76,293 | 191 | > 5 |
| Zebrafish perturbations | 18, 24, 36, 48, 72 (varies) | 2,686,684 | 804 | > 5 |

Their union is **exactly the 18 numeric values** in `obs[timepoint]`.

### Perturbations — 28 released labels = 23 distinct perturbations

`obs[gene_target]` carries 34 values: 28 knockouts + 6 control arms.

| Class | n | Members |
|---|---|---|
| Single-gene F0 crispant | 18 | cdx4, egr2b, epha4a, foxd3, foxi1, hand2, hgfa, hoxb1a, mafba, met, noto, phox2a, smo, tbx1, tbx16, tbxta, tfap2a, zc4h2 |
| Double-gene crispant | 5 | cdx4-cdx1a, tbx16-msgn1, tbx16-tbx16l, tfap2a-foxd3, wnt3a-wnt8 |
| Stable null mutant line | 5 | hgfa-mut, mafba-mut, met-mut, noto-mut, tbx16-mut |
| Controls | 6 | ctrl-uninj, ctrl-inj, ctrl-hgfa, ctrl-noto, ctrl-met, ctrl-mafba |

**18 + 5 = 23**, matching the abstract: the five `-mut` labels are stable null lines of five genes
already perturbed as crispants. **CONFIRMED** by supplementary sheet `6_perturbation_info`, which
names the rows `hgfa` / `hgfa null`, `mafba` / `mafba null`, etc., and marks
`Null Comparison (y/n) = y` on exactly those five crispant rows.

`obs` writes `wnt3a-wnt8`; the supplementary gives the true second gene as **`wnt8a`**.

## 2. Canonical released data

| | |
|---|---|
| Accession | GEO [GSE202639](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE202639) · SRA SRP374541 · BioProject PRJNA836866 |
| Analysis repo | [cole-trapnell-lab/sdg-zfish](https://github.com/cole-trapnell-lab/sdg-zfish) — figure code and processed results only; no pipeline or reference config |

**Reference arm** — `geo/GSE202639_reference_raw_counts.RDS.gz`, a Monocle3 `dgCMatrix`:

| | |
|---|---|
| Dimensions | **32,031 genes × 1,241,018 cells** |
| Non-zeros | 523,335,834 (98.68% zeros) |
| Total UMIs | **954,711,330**, all integral, max 2,391 |
| Median UMI/cell | 454 |
| Genes with zero counts | **951** — retained, confirming the gene set is the *reference*, not an expression filter |

**Full perturbation object** — `../zscape_perturb_reference_merged_dedubled.h5ad` (7.0 GB),
**3,231,733 cells × 32,031 genes**.

**Cell metadata** — `geo/GSE202639_reference_cell_metadata.csv.gz`, 1,241,018 × 25:
`cell, Size_Factor, n.umi, perc_mitochondrial_umis, timepoint, hash_umis, top_to_second_best_ratio,
expt, cell_type_sub, cell_type_broad, tissue, germ_layer, log.n.umi, num_genes_expressed,
umap3d_1..3, major_group, gene_target, mean_nn_time, subumap3d_1..3, embryo, temp`.

`expt` = GAP13, GAP14, GAP16, GAP18, HF4. `gene_target` here has only **7** values — the six
`ctrl-*` arms plus `tbx16-mut` (9,004 cells): the reference arm bundles one stable null line with
the controls. The 28 knockouts live in the `zperturb` files.

> **Gotcha.** The GEO RDS is **doubly wrapped** — outer gzip around an already-compressed RDS.
> `readRDS(gzcon(...))` fails with "unknown input format". Run `gunzip -c` first, then `readRDS()`.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCz11** | **CONFIRMED** (GEO: `Assembly: GRCz11`) |
| **Stated annotation** | *none* — no source names a GTF or Ensembl release | **UNRESOLVED as a citation** |
| **Deposited feature universe** | **32,031 features**, all ENSDARG, no spike-ins or non-gene features | **CONFIRMED** |
| **Gene namespace** | ENSDARG (unversioned), with `gene_short_name` symbols alongside | **CONFIRMED** |
| Base annotation | **Ensembl release 99** | **RECONSTRUCTED** |
| FASTA | `Danio_rerio.GRCz11.dna.toplevel.fa.gz` | **RECONSTRUCTED** |
| GTF | `Danio_rerio.GRCz11.99.gtf.gz` | **RECONSTRUCTED** |
| **Custom transformation** | BBI genome-preparation pipeline: **+500 bp strand-aware 3′ extension**, clipped/retracted where it would overlap another same-strand gene | **RECONSTRUCTED** |
| **Gene filtering** | excludes `pseudogene | IG_* | TR_* | TEC` (ZSCAPE-era build) | **RECONSTRUCTED** |
| Run manifest naming the GTF | none recovered | **UNRESOLVED** |

> **The Lawson Lab annotation was NOT used.** Tested directly and ruled out — see the closed negative
> result below. It is not a plausible alternative.

### How the reference was reconstructed

Nothing names it: not the paper, the GEO series record, the per-sample records, the `bbi-sci`
documentation, or `sdg-zfish`. It was recovered from the public BBI reference-building code plus the
released data, which agree exactly.

**Code** — [`bbi-lab/bbi-genome-data`](https://github.com/bbi-lab/bbi-genome-data), tree `946231a3`
(copies in `analysis/bbi_pipeline_code/`). `organisms/genome.zebrafish.sh` names all three files:

```bash
ENSEMBL_DNA_URL="ftp://ftp.ensembl.org/pub/release-99/fasta/danio_rerio/dna"
FASTA_GZ="Danio_rerio.GRCz11.dna.toplevel.fa.gz"
ENSEMBL_GTF_URL="ftp://ftp.ensembl.org/pub/release-99/gtf/danio_rerio"
GTF_GZ="Danio_rerio.GRCz11.99.gtf.gz"
```

`scripts/rna.03.make_bed_files.sh` applies the extension (`EXTENSION_LIST="500"`, line 4;
`extend_3p_utr_gene_annotations()`, line 207):

```awk
if ($6 == "+")      { $3 = $3 + EXTENSION; }
else if ($6 == "-") { $2 = $2 - EXTENSION; if ($2 < 1) $2 = 1; }
```

then `bedtools intersect` against the un-extended genes, retracting or clipping any extension that
collides with a same-strand gene. The 500 bp constant dates to **2020-03-20**, predating the
2022-05 deposit. `bbi-sci`'s `bin/assign-reads-to-genes.py` (lines 7–14) reads `gene_start` /
`gene_end` from exactly these BEDs.

**Data** — measured from `geo/GSE202639_reference_gene_metadata.csv.gz` against Ensembl 99:

| Test | Result |
|---|---|
| `+` strand 3′ end delta | median **+500 bp** |
| `−` strand 3′ start delta | median **−500 bp** |
| 5′ ends, both strands | median **0** — untouched |
| Max extension | **exactly 500 bp** (mean 493; shortfall = clipped genes) |
| Unchanged vs Ensembl | 2,206 (6.89%) — extensions fully retracted by same-strand overlap |
| **Gene set** | Ensembl 99 minus `pseudogene\|IG_*\|TR_*\|TEC` = **32,031, exact set match, 0 discrepancies either way** |

> **Note on the biotype rule.** `genome.zebrafish.sh` today carries an *include*-list
> (`SELECT_GENE_BIOTYPES="protein|lncRNA|TR_V|…|IG_LV"`) yielding 25,606 genes, which does **not**
> fit. The rule that fits exactly is the *exclude*-list above. The 174 genes the current list would
> keep but ZSCAPE lacks are precisely the `TR_J_gene` / `TR_V_gene` / IG-pseudogene entries — the
> IG/TR terms were added **after** ZSCAPE was built (that file's single commit is 2022-11-06,
> postdating the deposit). The ZSCAPE-era rule was therefore derived from the data.

### Closed negative result — Lawson ruled out

Tested against the published Lawson annotation (eLife 55792 Source Data 2, md5
`19759898187c47edfd9c216162851e31`, filed at `../../_annotations/lawson_v4_3/`):

| Test | Result |
|---|---|
| Exact coordinate match, ZSCAPE vs Lawson | 1,455 (**4.54%**) — *worse* than vs plain Ensembl (7.34%) |
| Lawson vs Ensembl | 13,471 (47.43%) |
| Deltas vs Lawson | **bidirectional** (17,163 longer, 9,398 shorter) — no systematic relationship |
| ZSCAPE gene IDs absent from Lawson | **3,629** — impossible if it were the counting reference |

## 4. Processing pipeline

| Stage | Value | Confidence |
|---|---|---|
| Raw processing | **`bbi-dmux` → `bbi-sci`** | **CONFIRMED** (Methods verbatim, and every GEO sample record) |
| UMI floor | 100–250, set per experiment | **CONFIRMED** |
| Outliers | cells > 4 SD from mean UMI removed | **CONFIRMED** |
| Mitochondrial | cells > 25% mitochondrial reads removed | **CONFIRMED** |
| Hash | enrichment ratio > 3 (TS R1/R2), > 5 (perturbations, TS R3); cutoffs set manually from the ratio distribution | **CONFIRMED** |
| Multiplets | residual multiplet clusters manually inspected and removed | **CONFIRMED** |
| Annotation method | hierarchical annotation with subclustering; **perturbed cells annotated by projection onto the reference atlas with label transfer** | **CONFIRMED** |
| Downstream framework | **Monocle3 v1.3.1**, defaults except 100 PCs whole-embryo / 50 for subsets, `align_cds(residual_model_formula_str="~log10(n.umi)")`, `reduce_dimension(max_components=3, preprocess_method='Aligned')`, `cluster_cells(resolution=1e-4)` | **CONFIRMED** |

> Methods, verbatim: *"Read alignment and gene-count matrix generation were performed using the
> Brotman Baty Institute pipelines for sci-RNA-seq3 (bbi-dmux; bbi-sci)."*
>
> The paper's only GRCz11/Ensembl sentence sits in *"Comparison of published zebrafish developmental
> atlases"* and concerns harmonising **other** atlases' gene names. Do not cite it as evidence about
> the counting reference.

## 5. Ground-truth annotations

**Authoritative file:** `obs` of the released objects for *what is present*; supplementary sheet
`2_cell_type_annotations` for *what a label means*.

| Level | Full object | Reference arm |
|---|---|---|
| `germ_layer` | 7 | 6 |
| `tissue` | 34 | 33 |
| `cell_type_broad` | 99 | ~98 |
| `cell_type_sub` | 156 | ~156 |
| `major_group` | 4 (CNS, periderm-other, mesoderm, mesenchyme-fin) | 4 |

The supplementary workbook documents the *authored scheme* (36 tissue / 101 broad / 148 sub /
7 germ_layer over 151 annotation rows), which does **not** equal the values realized in `obs` —
different denominators, both correct.

**Marker evidence is published**, which is unusual and valuable: sheet `2_cell_type_annotations`
carries a free-text `evidence` column naming the marker genes behind each call (120 of 151
populated), and sheet `8_top_marker_genes` gives quantitative top markers for **151 `cell_type_sub`**
with specificity, marker score, pseudo-R² and q-values.

No ZFA/CARO ontology IDs are published with this dataset; labels are free-text.

**Perturbation labels:** `obs[gene_target]`, 34 values as tabulated in §1. Authoritative
per-perturbation metadata is sheet `6_perturbation_info`.

## 6. Important released analysis products

| Product | Where | Contents |
|---|---|---|
| Cell-type annotation scheme + **marker evidence** | supp. sheet `2_cell_type_annotations` (151 rows) | label definitions, free-text marker evidence |
| **Quantitative marker table** | supp. sheet `8_top_marker_genes` (2,532 rows) | top markers per `cell_type_sub`, specificity, marker score, pseudo-R², q-values |
| Cranial-ganglion markers | supp. sheet `7_CG-markers` (210 rows) | markers across 7 cell types |
| Per-perturbation summary | supp. sheet `6_perturbation_info` (28 rows) | timepoints, individuals, cells, `Null Comparison (y/n)` |
| Target notes | supp. sheet `3_target_notes` (22 rows) | gene1/gene2, functional category, synonyms, phenotype **PMIDs** |
| **gRNA sequences** | supp. sheet `4_gRNA_sequences` (76 rows) | crRNA sequences, Ensembl id, `Passed Phenotyping`, `Used in Pool` |
| Genotyping primers | supp. sheet `5_rhAmpseq_primers` (66 rows) | primer pairs, plate and insert coordinates (26 genes) |
| Per-experiment metrics | supp. sheet `1_expt_metrics` (4 rows) | timepoints, cells, embryos, reads, duplication, UMI and hash ranges |

gRNAs: 76 guides over 27 gene entries (24 targets + 3 non-targeting controls), typically 3 per gene
(range 1–5); **7 failed phenotyping**, **10 unused**, so the shipped pool is 66.

Sheets 2, 7 and 8 are the most useful to downstream labelling work — they are marker *evidence*,
not merely label strings.

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Counting reference | none stated | Ensembl 99 + BBI +500 bp 3′ extension + biotype exclusion reproduces the 32,031-gene set **exactly, 0 discrepancies** | **RECONSTRUCTED** |
| Lawson v4.3.2 as reference | never claimed for ZSCAPE | 4.54% coordinate agreement, bidirectional deltas, 3,629 IDs absent | **CONFIRMED negative** |
| Timepoints | abstract says **19** | files resolve **18** numeric values + one blank level | **UNRESOLVED** |
| Perturbations | abstract says **23** | 28 released labels = 18 single + 5 double + 5 stable null | **CONFIRMED** reconciliation |
| `num_cells_expressed` | — | runs systematically higher than the matrix supports (median ratio 1.0076, max 1.093, never lower across all 32,031 genes) despite both files claiming 1,241,018 cells | recompute from the matrix if exact |
| Annotation cardinalities | scheme: 36/101/148/7 | realized `obs`: 34/99/156/7 | expected — different denominators |
| `wnt3a-wnt8` | true gene is `wnt8a` | `obs` label truncates | cosmetic |
| Run manifest naming the GTF | — | none public | **UNRESOLVED**, closed as far as possible |

## 8. Local assets

| File | Bytes | sha256 |
|---|---|---|
| `publication/ZSCAPE_paper.pdf` | 52,523,540 | `02b2634ac5e9d76b66c2cbaa9d75a83f2171a639bcdb487b3a37d98b79ab0ad7` |
| `supplementary/zscape-extra-metadata.xlsx` | 293,106 | `800e5fc4127bed38b6e1e1078516cb87627a058189170a823c144849953baa29` |
| `geo/GSE202639_reference_cell_metadata.csv.gz` | 141,416,202 | `608f12daca85b58104b0716b281678fa3d0eac584ee073b79e8244cb193c6bf5` |
| `geo/GSE202639_reference_gene_metadata.csv.gz` | 678,506 | `e456e08185057bad5e2349863ce2ffa67ad790c8217518bbaf28290d22ed8425` |
| `geo/GSE202639_reference_raw_counts.RDS.gz` | 1,185,099,475 | `0fc37839a559a31715b4ed51e2b82a9cd2fadd65d902d2c047f837479d1399b3` |
| `geo/GSE202639_zperturb_full_gene_metadata.csv.gz` | 610,634 | `e009f33723f8c338836f089eae06f8b742775f9a283e1fd9d08ca0e4454b5ca9` |

**Working object:** `../zscape_perturb_reference_merged_dedubled.h5ad` (7.0 GB, 3,231,733 × 32,031).

**Scripts and evidence:** `analysis/compare_lawson.py`, `analysis/diag.py`,
`analysis/lawson_comparison_output.txt`, and `analysis/bbi_pipeline_code/`
(`rna.03.make_bed_files.sh`, `genome.zebrafish.sh`, `assign-reads-to-genes.py`, `star_file.txt`,
`gene_file.txt`).

**Not downloaded from GEO:** `reference_cds.RDS.gz` (3.9 GB), `zperturb_full_cds.RDS.gz` (6.1 GB),
`zperturb_full_cell_metadata.csv.gz` (303 MB), `zperturb_full_raw_counts.RDS.gz` (2 GB), hash tables
(~700 MB).

## 9. Caveats and outstanding work

- **19 vs 18 timepoints** — **UNRESOLVED**, 1 unit, cosmetic.
- **No public run manifest names the GTF.** The reference is reconstructed to exact agreement, so
  this is closed as far as it can be from outside the lab.
- **`num_cells_expressed` is unreliable** — recompute from the matrix where exactness matters.
- **Gene space contains no pseudogenes and no IG/TR segments.** The absence of such a gene is a
  property of the reference, **not** biological evidence. This matters for any cross-dataset
  comparison against a fuller feature universe (e.g. MIC-Drop-seq's 32,520).

---

## Cross-dataset provenance principles

Applies to every dataset in this corpus; substantially identical in all five `sources/README.md`
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
