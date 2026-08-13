# ZSCAPE — provenance record

Genetic-perturbation atlas of zebrafish development. Companion to `../README.md`, which describes
dataset *contents*; this file records **where everything came from and how far each claim is
substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

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
| Scale (paper) | **19 timepoints (18 realized) · 23 crispant perturbations + 5 stable null lines · 3.2 M cells**, ≥8 embryos per condition |
| Scale (**our canonical object**) | **3,231,733 cells · 32,031 genes · 1,860 embryos · 5 experiments · 18 timepoints · 34 `gene_target` labels** |
| Rearing | 28 °C throughout |

> **Use the canonical-object figures for anything computed on our H5AD.** The paper's
> supplementary sheet `1_expt_metrics` describes four experiments totalling 1,812 embryos; the
> object we hold carries a fifth (HF4, 48 embryos), so **1,860** is the correct embryo count here.
> Every figure in the "canonical object" row is measured by
> [`sources/code/verify_zscape_merge.py`](code/verify_zscape_merge.py) — see §2.

**Perturbation counting — say it precisely.** There are **23 crispant perturbations = 18
single-gene + 5 double-gene**, plus **5 stable null mutant lines** of genes already perturbed as
crispants. Do **not** write "23 single KOs": five of the 23 are double-gene crispants.

**Perturbation arm alone:** 804 barcoded embryos across 98 conditions (159 injection control,
645 perturbation), **2.7 M cells in a single sci-RNA-seq3 run**, ~10% of cells sampled per embryo,
~70% embryo-of-origin recovery from hashing. The ~600,000 control-injected cells showed no batch
effect against the wild-type series and **were merged into the reference**, which is why the
reference arm is 1.24 M cells rather than pure wild-type.

### Experiments — five in the canonical object, four in the supplementary sheet

`obs[expt]` carries **`expt1`–`expt5`**, which are *not* the names the paper or GEO use. The
mapping below is **measured** from the `obs[embryo]` prefixes (every embryo id is
`<ALIAS>.<timepoint>.<plate>_<well>`), so it is derived from the object itself rather than assumed:

| `obs[expt]` | Alias (embryo prefix) | Supplementary name | Timepoints (hpf) | Cells | Embryos | Hash enrichment |
|---|---|---|---|---|---|---|
| `expt1` | **GAP13** | Time Series R1 | 48, 72, 96 | 78,741 | 288 | > 3 |
| `expt2` | **GAP14** | Time Series R2 | 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 42 | 332,001 | 529 | > 3 |
| `expt3` | **GAP16** | Zebrafish perturbations | 18, 24, 36, 48, 72 | 2,686,684 | 804 | > 5 |
| `expt4` | **GAP18** | Time Series R3 | 40, 42, 44, 46 | 76,293 | 191 | > 5 |
| `expt5` | **HF4** | *not in `1_expt_metrics`* | 24, 30, 36 | **58,014** | **48** | — |
| | | | | **3,231,733** | **1,860** | |

`expt1`, `expt2`, `expt4` and `expt5` are **100% `ctrl-uninj`** — together they are the 545,049-cell
uninjected developmental baseline. `expt3` is the entire perturbation atlas (33 of the 34
`gene_target` labels; only `ctrl-uninj` is absent from it).

> **`expt5` / HF4 is not anomalous.** It is a genuine uninjected reference population that the
> paper's four-row `1_expt_metrics` sheet does not itemise. It was missing from an earlier draft of
> *this* table, not from the data. `HF4` does appear in the GEO reference-arm metadata's `expt`
> column alongside GAP13/14/16/18 — five values, matching the object.

The union of the five timepoint sets is **exactly the 18 numeric values** in `obs[timepoint]`
(HF4's 24/30/36 are already covered by the others).

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

**Cell metadata** — `geo/GSE202639_reference_cell_metadata.csv.gz`, 1,241,018 × 25:
`cell, Size_Factor, n.umi, perc_mitochondrial_umis, timepoint, hash_umis, top_to_second_best_ratio,
expt, cell_type_sub, cell_type_broad, tissue, germ_layer, log.n.umi, num_genes_expressed,
umap3d_1..3, major_group, gene_target, mean_nn_time, subumap3d_1..3, embryo, temp`.

`expt` = GAP13, GAP14, GAP16, GAP18, HF4. `gene_target` here has only **7** values — the six
`ctrl-*` arms plus `tbx16-mut` (9,004 cells): the reference arm bundles one stable null line with
the controls. The 28 knockouts live in the `zperturb` files.

> **Gotcha.** The GEO RDS is **doubly wrapped** — outer gzip around an already-compressed RDS.
> `readRDS(gzcon(...))` fails with "unknown input format". Run `gunzip -c` first, then `readRDS()`.

---

## 2b. How the canonical object was built

**Canonical object — exact filename on disk:**

```
/data/datasets/zebrafish/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad
```

7,025,830,135 B · **3,231,733 cells × 32,031 genes**. Note the spelling **`dedubled`**, not
`deduplicated`; earlier notes used `..._merged_deduplicated.h5ad`, which **does not exist on this
instance**. Use the name above verbatim.

> **This is an intentional, audited integration artifact — not an unexplained concatenation.**
> It merges the two GEO release arms and removes the cells they share, so that the ~610 k control
> cells published in *both* arms are counted exactly once.

### The two source objects

| | **Source A — Reference atlas** | **Source B — Perturbation atlas** |
|---|---|---|
| Name | `zscape_reference_full.h5ad` | `zscape_perturb_full.h5ad` |
| Cells | **1,241,018** | **2,687,135** |
| Controls | 1,232,014 | 610,839 |
| Perturbed | — | 2,076,296 |
| `tbx16-mut` | 9,004 | — (bundled in its own arm) |
| Embryos | 1,223 | 812 |
| Composition | `ctrl-uninj`, `ctrl-inj`, sibling controls, and 9,004 `tbx16-mut` | F0 crispants, double crispants, stable mutants, injection controls, sibling controls |

> **Do not equate Source A with the final 545,049-cell `ctrl-uninj` baseline.** Source A is
> 1,241,018 cells and includes injected and sibling controls; the 545,049 figure is what *survives*
> filtering and deduplication, and it is uninjected only.

### The merge procedure

1. Remove **85,130 cells** from the Reference atlas — they lack `timepoint` and/or `embryo` metadata.
2. Remove **451 cells** from the Perturbation atlas — they lack cell-type annotation.
3. The two source objects contain **610,839 identical control cells** (the same physical cells,
   published in both arms).
4. **Deduplicate** those shared controls rather than counting them twice — they are retained from
   the Perturbation atlas side.
5. Merge the two filtered objects.

```text
Reference source       1,241,018
− reference filtering     85,130     (missing timepoint and/or embryo)
                        ---------
                       1,155,888

Perturb source         2,687,135
− perturb filtering          451     (missing cell-type annotation)
                        ---------
                       2,686,684

Filtered sum           3,842,572
− duplicated controls    610,839     (present in both source objects)
                        ---------
Canonical merged       3,231,733
```

### How far this is independently verified

`sources/code/verify_zscape_merge.py` re-derives every figure below from the canonical H5AD and
**exits 0 with all checks passing**. Neither source object is still on disk, so steps 1–2 are
recorded from the build documentation rather than re-measured; steps 3–5 **are** independently
confirmed, because the arithmetic closes against the object in two ways:

| Identity | Verified |
|---|---|
| `filtered_reference − duplicated_controls == realised ctrl-uninj` | 1,155,888 − 610,839 = **545,049** ✔ measured |
| `filtered_perturb == expt3 cell count` | **2,686,684** ✔ measured |
| `ctrl-uninj + expt3 == canonical total` | 545,049 + 2,686,684 = **3,231,733** ✔ measured |
| duplicated controls decompose as `expt3` control arms + Source A's `tbx16-mut` | 601,835 + 9,004 = **610,839** ✔ (601,835 measured; 9,004 from Source A) |
| `controls + perturbed == canonical total` | 1,146,884 + 2,084,849 = **3,231,733** ✔ measured |

In other words the merged object contains **exactly** the whole filtered Perturbation atlas plus
**only** the uninjected remainder of the Reference atlas. That is the signature of a correct
deduplication, and it is why the 610,839 figure can be trusted without the source files.

> On `tbx16-mut`: Source A carried 9,004 of these cells and Source B carried its own; after
> deduplication the object retains **16,475**, all under `expt3`. Source A's 9,004 are part of the
> 610,839 dropped as duplicates.

### Provenance of the merge logic

| | |
|---|---|
| Where the merge steps came from | **Operator-supplied build documentation, recorded 2026-08-13.** Not recovered from code |
| Original build script | **Does not exist on this instance.** Searched `/data` for `merged_dedubled`, `merged_deduplicated`, `zscape_reference_full`, `zscape_perturb_full`, `85,130`, `610,839`, `ZSCAPE_EDA.md`, `zscape_manifest.json` — the only hits are *consumers* of the object (notably `/data/prism/Old_Notebook_Series/ZSCAPE_EDA.ipynb`, which loads it from a historical path `/data/cell_vs_org/`) |
| Source objects | **No longer on disk.** Steps 1 and 2 cannot be re-executed |
| What we wrote instead | `sources/code/verify_zscape_merge.py` — **a new reconstruction, dated 2026-08-13, explicitly labelled as such in its docstring.** It verifies; it does not rebuild, and it is not presented as the historical script |
| `uns['provenance']` | **absent** from the object. Corpus principle 3 is therefore not satisfied retroactively; this section is the compensating record |

---

## 2c. Final canonical composition

All figures measured from the object by `sources/code/verify_zscape_merge.py`.

**Controls — 1,146,884 cells**

| `gene_target` | Cells | What it is |
|---|---|---|
| `ctrl-uninj` | **545,049** | uninjected developmental baseline (`expt1/2/4/5`) |
| `ctrl-inj` | **362,755** | scrambled-injection control — the crispant control |
| `ctrl-hgfa` | **116,548** | clutch/sibling control for the `hgfa` null line |
| `ctrl-noto` | **49,172** | clutch/sibling control for the `noto` null line |
| `ctrl-met` | **38,406** | clutch/sibling control for the `met` null line |
| `ctrl-mafba` | **34,954** | clutch/sibling control for the `mafba` null line |
| | **1,146,884** | |

**Perturbed — 2,084,849 cells**

| Class | Labels | Cells |
|---|---|---|
| Single-gene crispants | **18** | **1,397,173** |
| Double-gene crispants | **5** | **328,363** |
| Stable null mutants | **5** | **359,313** |
| | 28 | **2,084,849** |

`1,146,884 + 2,084,849 = 3,231,733` ✔

Members — 18 single: `cdx4, egr2b, epha4a, foxd3, foxi1, hand2, hgfa, hoxb1a, mafba, met, noto,
phox2a, smo, tbx1, tbx16, tbxta, tfap2a, zc4h2` · 5 double: `cdx4-cdx1a, tbx16-msgn1,
tbx16-tbx16l, tfap2a-foxd3, wnt3a-wnt8` · 5 stable null: `hgfa-mut, mafba-mut, met-mut, noto-mut,
tbx16-mut`. Six controls + 28 perturbed = **34 `gene_target` levels**, all accounted for.

---

## 2d. ⚠ Control semantics — pick the right control

**This is the single easiest way to get a wrong answer from this dataset.** The six control arms
are not interchangeable.

| If you are contrasting… | Use | Why |
|---|---|---|
| **F0 crispants** (the 18 single + 5 double) | **`ctrl-inj`** | the injection procedure itself is a confounder — needle damage, Cas9 load, non-specific cutting. `ctrl-inj` absorbs it; `ctrl-uninj` does not |
| **`hgfa-mut`** | **`ctrl-hgfa`** | clutch/sibling control from the same incross |
| **`noto-mut`** | **`ctrl-noto`** | ” |
| **`mafba-mut`** | **`ctrl-mafba`** | ” |
| **`met-mut`** | **`ctrl-met`** | ” |
| **`tbx16-mut`** | **none exists — see below** | |
| **Developmental trajectory / baseline** | **`ctrl-uninj`** | the uninjected reference population, 545,049 cells across four experiments |

> ### `tbx16-mut` has no matched control in the canonical object
> There is **no `ctrl-tbx16`** among the 34 `gene_target` levels. `tbx16-mut` (16,475 cells) is the
> one stable null line without a clutch/sibling control arm in this object.
> **Do not silently substitute `ctrl-inj` or `ctrl-uninj`** — neither shares its genetic background,
> and `tbx16-mut` is a mutant line rather than an injected animal, so `ctrl-inj` controls for a
> procedure it never underwent. Either compare it against the `tbx16` **crispant** arm (matched
> perturbation, different genetics) with the mismatch stated, or exclude it. Flag the choice
> explicitly in any result.

> ### `ctrl-uninj` is not the control for crispants
> It is the developmental baseline. Using it for an F0 crispant contrast folds the entire injection
> effect into the "perturbation" signal. The paper's own design provides `ctrl-inj` for exactly
> this reason.

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
| Canonical-object embryo count | supplementary sheet implies **1,812** across four experiments | **1,860** measured — the object carries a fifth experiment (HF4, 48 embryos). `embryo` alone is a valid key: 1,860 labels == 1,860 `(expt, embryo)` pairs, no blank or unused levels | **CONFIRMED** — use 1,860 |
| Historical "1,868 embryos" note | — | **not reproduced.** The object gives 1,860 by every route tried (`nunique`, level count, `(expt, embryo)` pairs). No blank, unused or duplicate-across-experiment levels exist that could explain +8 | **CONFIRMED 1,860**; 1,868 is unsubstantiated |
| Merge provenance | — | source → filter → dedup arithmetic closes exactly against the object (§2b) | **CONFIRMED**, build script absent |
| Counting reference | none stated | Ensembl 99 + BBI +500 bp 3′ extension + biotype exclusion reproduces the 32,031-gene set **exactly, 0 discrepancies** | **RECONSTRUCTED** |
| Lawson v4.3.2 as reference | never claimed for ZSCAPE | 4.54% coordinate agreement, bidirectional deltas, 3,629 IDs absent | **CONFIRMED negative** |
| Timepoints | abstract says **19** | files resolve **18** numeric values + one blank level | **UNRESOLVED** |
| Perturbations | abstract says **23** | 28 released labels = 18 single + 5 double + 5 stable null | **CONFIRMED** reconciliation |
| `num_cells_expressed` | — | runs systematically higher than the matrix supports (median ratio 1.0076, max 1.093, never lower across all 32,031 genes) despite both files claiming 1,241,018 cells | recompute from the matrix if exact |
| Annotation cardinalities | scheme: 36/101/148/7 | realized `obs`: 34/99/156/7 | expected — different denominators |
| `wnt3a-wnt8` | true gene is `wnt8a` | `obs` label truncates | cosmetic |
| Run manifest naming the GTF | — | none public | **UNRESOLVED**, closed as far as possible |

### Canonical-object handling caveats — all reproduced locally

Verified by `sources/code/verify_zscape_merge.py`; do not skip these when writing code against the
H5AD.

| Caveat | Measured | What to do |
|---|---|---|
| **Numeric-looking `obs` fields are categorical** | **10 of them**: `timepoint, temp, n.umi, num_genes_expressed, perc_mitochondrial_umis, hash_umis, mean_nn_time, Size_Factor, top_to_second_best_ratio, log.n.umi` are stored as pandas categoricals of *strings* | Cast explicitly — `pd.to_numeric(adata.obs[c].astype(str), errors='coerce')`. Sorting, comparison and arithmetic all misbehave otherwise (`'18' < '9'` is `True`) |
| **`dataset_source` is absent** | not a column | Anything keying on it must derive provenance from `expt` instead (§1) |
| **`Size_Factor` is not ordinary library-size normalization** | min 0.1847 · max 27.1806 · mean 1.3698 · median 0.8415. `Size_Factor / n.umi` has **CV 0.0821**, so it is *not* proportional to library size | It is Monocle3's estimator, not `n.umi / mean(n.umi)`. Do not assume `counts / Size_Factor` equals CP10k-style scaling; if you need library-size normalization, compute it from `X` |
| **`top_to_second_best_ratio` contains infinities** | **193,996 cells are `inf`** (finite max 8,184,754) | Guard before any mean, quantile, sort or threshold. `inf` here means no second-best hash was detected — a clean assignment, not bad data |
| **`mean_nn_time` has missing values** | **36 cells** (0.0011%), encoded as the categorical `<NA>` | Drop or impute; with 36 cells it never matters statistically, but it will crash a naive `.astype(float)` |
| **Nine PNS labels collapse to two broad labels** | `tissue == "Peripheral Nervous System"` covers **29,782 cells (0.922%)** across **9** `cell_type_sub` labels, which map to only **2** `cell_type_broad` labels | See the warning below |

> ### The nine PNS labels are a cross-atlas contrast hazard
> The nine `cell_type_sub` labels under `tissue == "Peripheral Nervous System"` —
> `neuron (cranial ganglion)` 13,285 · `neuron (cranial ganglia sensory, Rohon-Beard)` 6,550 ·
> `cranial ganglion progenitor` 3,291 · `epibranchial ganglion` 1,829 · `trigeminal ganglion` 1,535 ·
> `statoacoustic ganglion` 1,239 · `lateral line ganglion` 1,090 · `rohon-beard neuron` 617 ·
> `unknown sensory ganglion` 346 — collapse to just **two** `cell_type_broad` labels.
> Peripheral-neuron subtypes are exactly where annotation pipelines disagree most (they are rare,
> transcriptionally similar, and split differently by DanioCell, the Duran reference and ZSCAPE's
> own scheme). A contrast that matches ZSCAPE on `cell_type_broad` against an atlas annotated at
> finer PNS resolution will produce **artifactual** abundance and DE differences in this 0.9% of
> cells. Match at a consistent tier, or exclude PNS and say so.

## 8. Local assets

| File | Bytes | sha256 |
|---|---|---|
| `publication/ZSCAPE_paper.pdf` | 52,523,540 | `02b2634ac5e9d76b66c2cbaa9d75a83f2171a639bcdb487b3a37d98b79ab0ad7` |
| `supplementary/zscape-extra-metadata.xlsx` | 293,106 | `800e5fc4127bed38b6e1e1078516cb87627a058189170a823c144849953baa29` |
| `geo/GSE202639_reference_cell_metadata.csv.gz` | 141,416,202 | `608f12daca85b58104b0716b281678fa3d0eac584ee073b79e8244cb193c6bf5` |
| `geo/GSE202639_reference_gene_metadata.csv.gz` | 678,506 | `e456e08185057bad5e2349863ce2ffa67ad790c8217518bbaf28290d22ed8425` |
| `geo/GSE202639_reference_raw_counts.RDS.gz` | 1,185,099,475 | `0fc37839a559a31715b4ed51e2b82a9cd2fadd65d902d2c047f837479d1399b3` |
| `geo/GSE202639_zperturb_full_gene_metadata.csv.gz` | 610,634 | `e009f33723f8c338836f089eae06f8b742775f9a283e1fd9d08ca0e4454b5ca9` |

**Canonical object:** `../zscape_perturb_reference_merged_dedubled.h5ad` (7,025,830,135 B,
3,231,733 × 32,031). Build documented in §2b; composition in §2c; control semantics in §2d.

> `X` and `layers['raw_counts']` are **byte-identical int32 CSR copies** of the same matrix
> (1,206,541,247 nnz each, verified over the first 2 M values). Either is the raw counts; there is
> no second representation hiding in the object. ~4.8 GB of the 7.0 GB file is this duplication.

**Scripts and evidence:** `code/verify_zscape_merge.py` (**new reconstruction, 2026-08-13** —
verifies the merge arithmetic and every caveat above; exits 0), `analysis/compare_lawson.py`,
`analysis/diag.py`, `analysis/lawson_comparison_output.txt`, and `analysis/bbi_pipeline_code/`
(`rna.03.make_bed_files.sh`, `genome.zebrafish.sh`, `assign-reads-to-genes.py`, `star_file.txt`,
`gene_file.txt`).

**Not downloaded from GEO:** `reference_cds.RDS.gz` (3.9 GB), `zperturb_full_cds.RDS.gz` (6.1 GB),
`zperturb_full_cell_metadata.csv.gz` (303 MB), `zperturb_full_raw_counts.RDS.gz` (2 GB), hash tables
(~700 MB).

## 9. Caveats and outstanding work

- **The merge is documented but not re-executable.** §2b records the exact procedure and the
  arithmetic closes against the object, but **no build script exists and neither source object is
  on disk.** `code/verify_zscape_merge.py` verifies; it cannot rebuild. Re-deriving the object from
  GEO would require re-downloading `reference_cds.RDS.gz` and `zperturb_full_cds.RDS.gz`.
- **Use `ctrl-inj` for crispants, sibling controls for null lines, and neither for `tbx16-mut`** —
  see §2d. This is the most consequential caveat in this record.
- **1,860 embryos, not 1,812 or 1,868.** Measured. The paper's four-experiment sheet omits HF4.
- **Cast the categorical numeric `obs` fields before arithmetic** — ten of them, §7.
- **19 vs 18 timepoints** — **UNRESOLVED**, 1 unit, cosmetic.
- **No public run manifest names the GTF.** The reference is reconstructed to exact agreement, so
  this is closed as far as it can be from outside the lab.
- **`num_cells_expressed` is unreliable** — recompute from the matrix where exactness matters.
- **Gene space contains no pseudogenes and no IG/TR segments.** The absence of such a gene is a
  property of the reference, **not** biological evidence. This matters for any cross-dataset
  comparison against a fuller feature universe (e.g. MIC-Drop-seq's 32,520).

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
