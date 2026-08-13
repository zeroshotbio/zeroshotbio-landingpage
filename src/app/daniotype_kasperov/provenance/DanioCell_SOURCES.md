# DanioCell — source material and provenance

Technical record for the DanioCell developmental atlas. Companion to `../README.md`.

Confidence labels: **CONFIRMED** (stated in a primary source or measured directly),
**STRONGLY INFERRED**, **RECONSTRUCTED** (derived to agreement but not directly stated),
**UNRESOLVED**.

```
sources/
  publication/    NOTE.md — paper not programmatically retrievable, see within
  supplementary/  reserved for Tables S1–S7 (not retrieved)
  geo/            the GSE223922 release (hardlinks to ..)
  data/           authors' Seurat object + annotation tables (hardlinks)
  code/           farrelllab/2023_Sur — GitHub main + Zenodo v1.01
  reference/      Lawson gene-information table used for the gene-universe check
  analysis/       API responses substantiating the citation/accession claims
  README.md       this file
```

---

## Publication

| | |
|---|---|
| Citation | **Sur, Wang, Capar, Margolin, Prochaska & Farrell.** *Single-cell analysis of shared signatures and transcriptional diversity during zebrafish development.* **Developmental Cell 58, 3028–3047.e12 (2023)** |
| DOI | [10.1016/j.devcel.2023.11.001](https://doi.org/10.1016/j.devcel.2023.11.001) |
| PMID / PMCID | 37995681 / PMC11181902 |
| Lab | Farrell lab, NICHD |
| Portal | <https://daniocell.nichd.nih.gov> |

> ### Correction
> `../README.md` previously cited *Nature Communications* **10.1038/s41467-024-50053-5**.
> **That DOI does not exist** — Crossref returns HTTP 404 for it. The correct venue is
> *Developmental Cell* 2023, confirmed via Europe PMC. Corrected in this pass.

## Accessions and code

| | |
|---|---|
| GEO | [GSE223922](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE223922) — FASTQs and UMI count tables |
| Code | [farrelllab/2023_Sur](https://github.com/farrelllab/2023_Sur) · Zenodo [10.5281/zenodo.10048114](https://doi.org/10.5281/zenodo.10048114) (v1.01, "Corrected code associated with publication") |
| Processed | Seurat object via the DanioCell portal |

Both code snapshots are filed under `code/` (GitHub `main` tree and the Zenodo v1.01 zip).

## Experimental design

| | |
|---|---|
| Cells | **489,686** |
| Stages | 3 → 120 hpf |
| Samples | 86 |
| Platforms | **10X Chromium 3′ v3.1 + MULTI-seq** (450,955 cells) and **2018 Farrell Drop-seq** (38,731 cells) |
| Strain | TL/AB wild-type |

The 2018 Drop-seq cells (3–12 hpf) were **realigned against the same DanioCell reference** before
merging with the new 10X data (14–120 hpf) — confirmed both in the Methods and in the repo:
`01_Pre-processing/merging_mama_dropseq.R` states it combines "the 2018 DropSeq dataset (3.3-12hpf)
remapped to the Lawson transcriptome with the newly generated dataset (14-120 hpf)".

The two platforms cover **disjoint** stage ranges — Drop-seq 3–12 hpf (10 integer stages), 10X
14–120 hpf (53 integer stages), zero overlap.

## Genomic reference

| | | Confidence |
|---|---|---|
| Assembly | **GRCz11, Ensembl release 99** | **CONFIRMED** (Methods) |
| Annotation | **Lawson Lab Zebrafish Transcriptome Annotation v4.3.2** | **CONFIRMED** (Methods) |
| Filtering | 320 Ensembl-annotated pseudogenes removed | **CONFIRMED** (Methods) |
| Aligner | **Cell Ranger 4.0.0** wrapping **STAR 2.5.1b** | **CONFIRMED** (Methods) |
| `--expect-cells` | 6,000–21,250, per sample | **CONFIRMED** (Methods) |
| Released feature universe | **36,250 names** | **CONFIRMED** (measured) |

> This is a **different reference lineage from ZSCAPE and ChemFish.** Those two share a
> BBI-prepared Ensembl-99 build with a +500 bp 3′ extension and a 32,031-gene universe. DanioCell is
> Lawson v4.3.2 via Cell Ranger, with a 36,250-name universe. The datasets are **not** directly
> comparable at the feature level without mapping.

### How 36,250 released names arise — reconstruction

> ### Corrected 2026-08-13 — we DO hold Lawson v4.3.2
> This section previously said v4.3.2 "is distributed only from the UMass site and was not
> retrievable", and attributed the 2,006-name residual to the v4.3 → v4.3.2 version delta.
> **Both statements were wrong.** A v4.3.2 GTF was already on the instance, undocumented, at
> `/data/scratch/bench/ref/`; it is now promoted to
> `../../references/lawson_v4_3_2/V4.3.2.ensembl_names.gtf` with its own README.
>
> The four statistics below reproduce **exactly against v4.3.2 and not against v4.3** — so this
> reconstruction was computed with v4.3.2 all along, while the text claimed v4.3. Re-run it with
> `code/verify_lawson_v4_3_2.py` (25 checks, exits 0).

The study used **v4.3.2**. We hold both it and v4.3 (eLife 55792 Source Data 2,
`../../references/lawson_v4_3/`). Measured against **v4.3.2**:

| Step | Count |
|---|---|
| Lawson gene rows (identical in v4.3 and v4.3.2) | 36,351 |
| — of which Ens99 biotype contains "pseudogene" | **314** measured *(from the **v4.3** gene table — the paper removes **320** in v4.3.2, and the v4.3.2 gene table is **still missing**, so this one number cannot yet be checked at v4.3.2)* |
| Lawson genes minus pseudogenes | 36,031 |
| **DanioCell released names** | **36,250** (delta **+219**) |

Two mechanisms account for the shape of the difference, both verified:

1. **Cell Ranger feature-name de-duplication.** Lawson has **216 symbols occurring more than once**
   (covering 458 gene rows). Cell Ranger makes feature names unique by suffixing. Exactly **242**
   DanioCell-only names are of the form `<lawson symbol>.N` — e.g. `AL935186.9.1`,
   `CABZ01043953.1.1`, and unmistakably `HTRA2 (1 of many).1`, `HTRA2 (1 of many).10`.
   This is why the released count follows the *gene-row* count (36,351-scale), not the *unique
   symbol* count (36,109).
2. **Case handling.** 32 DanioCell-only names differ from a Lawson symbol only by case
   (`ABCD2`, `ANXA1`, `ARF5`, …).

The remaining **2,006** names are unexplained by either mechanism. **They are NOT a Lawson version
artifact** — measured 2026-08-13, they persist unchanged against v4.3.2:

| Statistic | v4.3 | **v4.3.2** |
|---|---|---|
| unique gene_names | 36,208 | **36,109** |
| direct matches | 33,788 | **33,970** |
| Cell Ranger `.N` matches | 227 | **242** |
| case-only matches | 32 | **32** |
| **unexplained residual** | 2,203 | **2,006** |

Upgrading v4.3 → v4.3.2 resolves **197** names and leaves **2,006**. What they are:

- **1,997 (99.6%) are ALL-UPPERCASE symbols** — `ANXA1`, `CCR8`, `CDHR1`, `CELA1`, `COX7A2`,
  `DOCK4`, `ERBB4`, … — absent from Lawson **even case-insensitively** (the 32 case-only matches
  are already accounted for above), and matching no column of `v4_3geneinformation.tab`.
- **9 others**: eight `unm-*` ZFIN mutant-allele features (`unm-hu7910`, `unm-sa808`,
  `unm-sa1506`, …) plus `si:ch211-64i20.5-2`. The same `unm-*` family accounts for the 13
  unmapped rows in MIC-Drop-seq's canonical H5AD, so it is not DanioCell-specific.

**Origin UNRESOLVED.** The uppercase convention suggests a second annotation source merged into
DanioCell's Cell Ranger reference, but nothing local establishes which. Do **not** attribute this
residual to the Lawson version delta.

Script: `code/verify_lawson_v4_3_2.py` — reproduces every number in this section and asserts that
v4.3 does *not* reproduce them.

## QC — published thresholds vs the released cells

Published: remove cells with **≤200 detected genes**; remove the **top 0.5% by detected features**;
remove cells with **≥10% mitochondrial** expression. MULTI-seq: barcode **negative if <20 UMIs**;
singlet requires **SNR ≥ 5**; cells called doublets by **either** classification approach removed.

Measured on the 489,686 released cells:

| Rule | Result |
|---|---|
| `nGene` ≤ 200 | **0 cells** — minimum is exactly **201** ✔ |
| `percent.mt` ≥ 10 | **0 cells** — maximum is **9.999** ✔ |
| Top 0.5% by features | **not testable post-hoc** — the top 0.5% of a filtered distribution is 0.5% by construction (cutoff 5,610, max 8,072) |
| MULTI-seq doublets | **0 cells** labelled `Doublet` — `MS_Seurat` / `MS_SNR` contain only `Bar1`–`Bar12` and `Negative` ✔ |
| `nUMI_MS` < 20 | **1 cell** (minimum 19) — a single borderline case against the <20 negative rule |

**Unlike ChemFish, DanioCell's released object is a clean pass.** Both hard thresholds are satisfied
at the boundary exactly, which is what a correctly-applied filter looks like.

MULTI-seq coverage: 59,013 cells carry no MULTI-seq call — **38,731 Drop-seq** (platform predates
it) plus **20,282 10X** cells from non-hashed samples. The two classification approaches disagree on
18,235 cells; since the rule removes doublets called by *either*, disagreement on singlet-barcode
assignment among retained cells is expected and not a violation.

## Cell / stage / cluster accounting

Each discrepancy has a different denominator. They are documented, not forced into agreement.

| Item | Resolution |
|---|---|
| **489,686 vs 489,687** | Resolved — 489,687 was a `wc -l` count **including the header line**. The metadata has exactly 489,686 data rows, matching the published cell count. |
| **62 vs 63 stages** | The released `stage.integer` has **63** distinct values (Drop-seq 10, 3–12 hpf; 10X 53, 14–120 hpf; **no overlap**, 10+53=63). The paper states 62. One integer bin more than the paper counts — most likely the paper counts *named developmental stages* rather than rounded integer hpf. **UNRESOLVED**, one unit. |
| **521 vs 522 clusters** | The metadata has **522** distinct `clust`; `cluster_annotations.csv` has **521** rows. The missing one is **`ceph`** (3,191 cells). Annotation therefore covers **486,495 / 489,686 = 99.348%** of cells. |
| **498 clusters** | That is the count in our **18–96 hpf canonical subset**, not an alternative full-atlas figure — 24 clusters have no cells in that window. |
| **19 vs 20 tissues** | Full atlas has **20** `tissue` / `tissue.name`; the 18–96 hpf subset has **19**. `tissue.figure` is 43 in both. |

## `cluster_annotations.csv` — primary annotation asset

**521 rows × 26 columns.** This is the authors' own cluster annotation table and the most valuable
ground-truth artifact in the dataset:

| Field group | Contents |
|---|---|
| Identity | `clust`, `num`, `tissue.subsets`, `tissue`, `identity.super`, `identity.sub`, and short forms |
| **Ontology** | **`zfin` — ZFA identifiers** (e.g. `ZFA:0001423`), present on **358 / 521** rows (68.7%) |
| Grouping | `daniocell.cluster`, `clust.collapse` |
| Markers | `ident.gene.1–3`, `roc.1–6` (ROC-selected), `wilcox.1–6` (Wilcoxon-selected) |

Covers 99.348% of released cells (all but `ceph`). The ZFA identifiers make this directly
comparable to our ZFA-targeted labelling work — a scoring target of the same class as ZSCAPE's
supplementary marker sheets, but ontology-grounded.

> Caveat: these are the **publication-era** annotations. The live DanioCell portal has been updated
> since, so portal labels and this table may diverge. **UNRESOLVED** — not audited in this pass.

## Our canonical conversion — provenance NOT reconstructable

Our labelling work consumes `daniocell_canonical.h5ad`, so this matters.

**What the outputs are** (measured):

| Object | Cells | Genes | Stages | `clust` | `tissue` |
|---|---|---|---|---|---|
| `daniocell.h5ad` | 489,686 | 36,250 symbols | 3–120 hpf | 522 | 20 |
| `daniocell_canonical_all.h5ad` | 489,686 | **30,121 ENSDARG** | 3–120 hpf (63) | 522 | 20 |
| `daniocell_canonical.h5ad` | **336,603** | **30,121 ENSDARG** | **18–96 hpf (39)** | **498** | **19** |

`var` carries a single `gene_id` column; `obs` has 26 columns (the GEO metadata's 22 plus 4 added).
All 30,121 canonical IDs fall **inside the ZSCAPE/ChemFish 32,031-gene space**, so the conversion
was evidently targeting that shared space.

**What cannot be reconstructed** — flagged rather than guessed:

- **No conversion script exists anywhere on this instance.** Searched the dataset directories and
  `/data` broadly; nothing produces these objects.
- **The documented figure does not reproduce.** `../README.md` states "30,121 (26,251 mapped)".
  Using the only symbol→ENSDARG map on the box (`../../gene_id_map_zf.tsv`, 31,312 entries), the
  DanioCell symbol intersection is **27,247**, not 26,251 — and neither equals the 30,121 features
  actually present. A different, unrecorded mapping was used.
- Consequently **unmapped-feature handling, one-to-many / many-to-one resolution, and duplicate
  collapsing are undocumented**. With the on-box map the mapping happens to be injective (0 ENSDARG
  receives >1 symbol), but that map is demonstrably not the one used.

**Status: UNRESOLVED.** The canonical objects are usable and their contents are characterised above,
but the transformation that produced them is not recorded and should be regenerated with a scripted,
logged conversion before anything depends on its exact gene set.

### ⚠ The inherited QC columns are STALE — they describe the pre-conversion gene universe

**Measured 2026-08-13** over a 2,000-cell block of each object. `obs` was carried across from the
36,250-feature source object unchanged, but `X` holds only the 30,121 mapped features. The
feature-dependent QC columns therefore **no longer describe `X`**:

| | `daniocell_canonical.h5ad` | `daniocell_canonical_all.h5ad` |
|---|---|---|
| `X` rowsum ÷ `obs['nUMI']` | mean **0.9468** (range 0.7183–0.9772) | mean **0.7471** (range 0.5564–0.9318) |
| `X` nnz ÷ `obs['nGene']` | mean **0.9345** (range 0.9080–0.9625) | mean **0.9500** (range 0.9264–0.9680) |
| Exact matches | **0 / 2,000** | **0 / 2,000** |
| Median UMI lost per cell | 664 (**5.11%**) | 1,822 (**24.31%**) |

**Four columns are affected: `nUMI`, `nGene`, `percent.mt`, `percent.ribo`.** All four refer to the
pre-conversion 36,250-feature universe.

The loss is **per-cell variable, not a constant factor**, so it cannot be rescaled away — it is a
bias, and it is much larger in `daniocell_canonical_all` than in the 18–96 hpf subset.

> **It breaks a published QC guarantee.** DanioCell's Methods remove cells with ≥10% mitochondrial
> expression, and `obs['percent.mt']` honours that exactly (max 9.999). But **recomputed from the
> canonical `X` the maximum is 12.86%** — because the denominator shrank while all 13 `mt-` genes
> were retained. A filter of `percent.mt < 10` on `obs` therefore does **not** mean the object's own
> matrix satisfies that threshold.

**What to do:** for the canonical H5ADs, **recompute every feature-dependent QC statistic from `X`**
(`X.sum(1)`, `(X>0).sum(1)`, mito fraction over the 13 `mt-` ENSDARG ids, all of which are present).
Use `obs['nUMI']` / `nGene` / `percent.mt` / `percent.ribo` only when you specifically want the
*original* 36,250-feature values — e.g. reproducing the authors' published QC — and say so.

This is a property of the conversion, not of the released data: `daniocell.h5ad` (36,250 symbols) is
self-consistent.

## Local files and checksums

| File | Bytes | sha256 |
|---|---|---|
| `geo/GSE223922_Sur2023_counts_rows_genes.txt.gz` | 107,072 | `d33ef1b0f036a62656a1a6706a4d15d6a914826b6e2428e51c94d4035b2caede` |
| `geo/GSE223922_Sur2023_metadata.tsv.gz` | 17,937,652 | `746ee22f4003bde7897c67699b3ac3e4ff06187fe6068f9903d2dd09f11ec7f6` |
| `data/cluster_annotations.csv` | 130,818 | `2a5ddf15a3f02cef49f70a56d21dff92a11a41ba5fc10fe84c6724e6ccd08446` |
| `code/2023_Sur-1.01-zenodo.zip` | 635,786 | `fe5f03d53cc23f655455670525e58094b255ef4dd1f4c8a56af467cd0638e090` |

Also present: `geo/GSE223922_Sur2023_counts.mtx.gz` (2.5 GB), `data/daniocell.rds` (2.2 GB),
`data/metadata.csv`, `data/genes.txt`, `data/barcodes.txt`,
`reference/lawson_v4_3geneinformation.tab`. All are hardlinks to the originals — no duplication.

Large derived objects stay at the dataset root: `daniocell.h5ad` (10 GB),
`daniocell_canonical_all.h5ad` (9.7 GB), `daniocell_canonical.h5ad` (6.6 GB).

## Discrepancies and caveats

| Item | Status |
|---|---|
| Canonical conversion provenance | **UNRESOLVED** — no script; documented gene count does not reproduce |
| **Inherited `nUMI` / `nGene` / `percent.mt` / `percent.ribo` are stale** — they describe the 36,250-feature source, not the 30,121-feature `X`. Recompute from `X`. Breaks the published <10% mito guarantee (recomputed max 12.86%) | **CONFIRMED**, measured 2026-08-13 |
| Lawson **v4.3.2** GTF | **HELD** — `../../references/lawson_v4_3_2/`, promoted 2026-08-13. Biological identity **CONFIRMED**; original UMass acquisition **UNRESOLVED** |
| Lawson **v4.3.2 gene-information table** (biotypes + Ens99 cross-reference) | **STILL MISSING** — blocks the 314-vs-320 pseudogene check |
| 2,006-name residual | **UNRESOLVED** — persists against v4.3.2, so *not* a version delta. 1,997 are uppercase symbols absent from Lawson; 9 are `unm-*`/`si:` features |
| Paper says 62 stages; released metadata has 63 integer stages | **UNRESOLVED**, one unit |
| `ceph` cluster (3,191 cells) has no row in `cluster_annotations.csv` | documented |
| ZFA identifiers present on only 358 of 521 clusters | documented |
| Publication-era annotations may differ from the current portal | **UNRESOLVED**, not audited |
| Paper PDF and Supplementary Tables S1–S7 not retrieved (not OA / paywalled) | archival gap |
| DanioCell does **not** share the ZSCAPE/ChemFish feature universe | by design — different reference lineage |

---

## Cross-dataset provenance principles

Applies to every dataset in this corpus; substantially identical in all `sources/README.md` records.

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
