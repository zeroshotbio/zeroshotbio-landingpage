# ChemFish — provenance record

Chemical-perturbation atlas of zebrafish development. Companion to `../README.md`, which describes
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
| Title | *Embryo-scale single-cell chemical transcriptomics reveals dependencies between cell types and signaling pathways* |
| Authors | Barkan, Duran, Lammers, Tresenrider, Jackson, Lee, Haagen, Saunders, Abitua, … Trapnell |
| Venue | **bioRxiv preprint**, 3 April 2025 — [10.1101/2025.04.03.646423](https://doi.org/10.1101/2025.04.03.646423) |
| Affiliation | Dept. of Genome Sciences, University of Washington; Seattle Hub for Synthetic Biology |
| Licence | Processed data CC-BY-NC |
| Assay | **sci-RNA-seq3** on PFA-fixed **nuclei** with **sci-Plex** oligo hashing. Round 1 fixative **DSP**, round 2 **BS3**. Dissociation per Saunders et al. 2023; library construction per the published sci-RNA-seq3 protocol (PMC9839601). **CONFIRMED** (Methods) |
| Purpose | Chemical counterpart to ZSCAPE: perturb signalling *pathways* rather than genes, and measure dependencies between cell types and pathways at embryo scale |
| Scale | **508 embryos · 2,068,668 cells · 8 compounds over 7 pathways + 3 controls** |

> The dataset README once attributed this to the "Bhatt lab". That is **incorrect** — it is
> Barkan / Trapnell.

**Two experiments, disjoint by embryo:**

| | CHEM10 | CHEM11 |
|---|---|---|
| Cells | 708,764 | 1,359,904 |
| Embryos | 258 | 250 |
| Strain | WIK/AB | AB |
| `fix_protocol` | 2 | 3 |
| Collection timepoints | 36, 48, 72 hpf | 48 hpf only |
| Drug-addition times | 6, 13 hpf | 6, 13, 24, 36, 42 hpf |
| Perturbations present | 11 | 9 |

**CHEM10 = round 1, CHEM11 = round 2** — **CONFIRMED** by design match, not merely numbering: the
paper describes a second round adding drug additions "at multiple time points during organogenesis
(13, 24, 36, 42 hpf)", and CHEM11 is the only experiment containing 24/36/42. Consistently, round 1
used **DSP** fixative and round 2 **BS3**, matching the `fix_protocol` 2→3 change.

### Perturbations — 8 compounds + 3 controls, 7 pathways

| Compound | Pathway | Dose | Cells | Embryos |
|---|---|---|---|---|
| DEAB | RA | 10 µM | 243,353 | 53 |
| LY411575 | Notch | 10 µM | 204,331 | 52 |
| SB505124 | TGFβ | 50 µM | 197,409 | 47 |
| Cyclopamine | Shh | 100 µM | 192,362 | 51 |
| WntC59 | Wnt | 20 µM | 178,098 | 46 |
| DMH1 | BMP | 40 µM | 177,352 | 40 |
| SU5402 | FGF | 20 µM | 163,626 | 43 |
| A8301 | TGFβ | 50 µM | 54,296 | 21 |
| **DMSO** | control | 0 and 33.8 µM | 335,693 | 75 |
| **EtOH** | control | 0 µM and 1% | 228,756 | 56 |
| **novehicle** | control | — (no dose, no addition time) | 93,392 | 24 |

Collection: 36 hpf 139,655 cells / 86 embryos · 48 hpf 1,579,675 / 336 · 72 hpf 349,338 / 86.
`compare_against` is populated for only 419,976 cells (DMSO 373,949, EtOH 46,027); the remaining
1,648,692 are NA.

## 2. Canonical released data

| | |
|---|---|
| Raw sequencing accession | **NOT FOUND.** The paper states *"The accession number for the single cell RNA-seq data reported will be available soon."* GEO, SRA and BioProject searched by title, author, "ChemFish", "CHEM10/CHEM11" and DOI: **0 hits**. The only Barkan+zebrafish GEO record is GSE202294 (*Hotfish*, temperature stress), a different dataset |
| Processed data | `https://trapnell-lab-s3-chemfish-lmx1b.s3.us-west-2.amazonaws.com/` via <https://cole-trapnell-lab.github.io/chemfish/> |

There is no `geo/` directory because no GEO/SRA accession exists.

**Canonical object** — BPCells `unpacked-double-matrix-v2`, column-major, at
`../extracted/chemfish_cds/bpcells_matrix_dir/`:

| | |
|---|---|
| Dimensions | **32,031 genes × 2,068,668 cells** |
| Non-zeros | 1,087,795,475 (98.358% zeros) |
| Total UMIs | **2,316,871,517**, all integral, max 67,624 |
| Mean UMI/cell | 1,120 · median genes/cell 362 |
| `rowRanges` mcols | `gene_short_name, id, chromosome, bp1, bp2, gene_strand, num_cells_expressed` |
| `colData` | 42 fields (see `../README.md`) |
| Object version | `cds_version 1.4.22`; `int_metadata$counts_metadata` = `combin_cds \| 61887caa663cf11bbd99922373468fb9 \| 32031 \| 1359904` |

The `counts_metadata` dimension is **CHEM11's** cell count, indicating the combined CDS was built
onto the CHEM11 matrix.

**Converted H5AD:** `/data/datasets/processed/chemfish/chemfish.h5ad` (2.9 GB).

> **Gotcha.** Every BPCells file carries an **8-byte type header** (`DOUBLEv1`, `UINT32v1`,
> `UINT64v1`). Reading from offset 0 silently corrupts every value. Validate with
> `idxptr[-1] == nnz`.
>
> **Gotcha.** `cds_object.rds` needs monocle3 for S4 dispatch. Without it, load with `readRDS()` and
> reach in via `attr()` only — `class()`, `inherits()` and `slotNames()` all fail. `rowData` lives at
> `attr(attr(cds,"rowRanges"),"elementMetadata")`, **not** the empty top-level `elementMetadata`.
> Working scripts: `analysis/cf_rowdata3.R`, `analysis/cf_rowranges.R`.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCz11** | **CONFIRMED** |
| **Stated annotation** | *none in this paper* — Methods say only that processing followed Saunders et al. 2023 | **UNRESOLVED as a citation** |
| **Deposited feature universe** | **32,031 features**, all ENSDARG | **CONFIRMED** |
| **Gene namespace** | ENSDARG, with `gene_short_name` symbols alongside | **CONFIRMED** |
| Base annotation | Ensembl release 99 | **STRONGLY INFERRED** (by inheritance) |
| FASTA | `Danio_rerio.GRCz11.dna.toplevel.fa.gz` | **STRONGLY INFERRED** |
| GTF | `Danio_rerio.GRCz11.99.gtf.gz` | **STRONGLY INFERRED** |
| **Custom transformation** | BBI +500 bp strand-aware 3′ extension, clipped on same-strand collision | **CONFIRMED** — coordinates identical to ZSCAPE |
| Gene filtering | `pseudogene \| IG_* \| TR_* \| TEC` excluded | **CONFIRMED** by set identity with ZSCAPE |

### The prepared reference is byte-for-byte ZSCAPE's

Measured from the cds `rowRanges` mcols against
`../../ZSCAPE/sources/geo/GSE202639_reference_gene_metadata.csv.gz`:

| Test | Result |
|---|---|
| Gene-ID set | identical — 0 ChemFish-only, 0 ZSCAPE-only |
| Gene-ID **ordering** | identical, position by position |
| `gene_short_name` / `chromosome` / `bp1` / `bp2` / `gene_strand` | **0 mismatches each** |
| **Full 5-tuple identity** | **32,031 / 32,031 = 100.0000%** |

This is *prepared-reference* identity, not merely "same Ensembl release": the extension and clipping
are baked into the coordinates and they match exactly. ChemFish therefore inherits ZSCAPE's fully
reconstructed reference — see `../../ZSCAPE/sources/README.md` §3 for the derivation and for the
closed negative result ruling out Lawson.

The literal FASTA/GTF *filenames* remain **STRONGLY INFERRED by inheritance**: the ChemFish object
contains **no reference strings whatsoever** — a `strings` sweep found no `GRCz11`, `Ensembl`,
`Danio_rerio`, `.gtf`, `bbi-sci` or `release-99`. Evidence: `analysis/cf_rowdata.csv`.

## 4. Processing pipeline

| Stage | Value | Confidence |
|---|---|---|
| Raw processing | `bbi-dmux` → `bbi-sci` | **CONFIRMED** (Methods, with repo URLs) |
| Published QC | min **80 UMI round 1 / 100 UMI round 2**; hash enrichment ratio **≥ 2.5**; total corrected hash UMI **> 5** | **CONFIRMED** as *stated* (Methods + Supplemental Fig. 1A) |
| Annotation method | **label transfer by projection**, not de novo calling (see §5) | **CONFIRMED** |
| Downstream framework | Monocle3 **develop branch v1.3.1**, `align_cds(~log10(n.umi))`, `reduce_dimension(max_components=3, preprocess_method='Aligned')`, `cluster_cells` with k scaled by cell number | **CONFIRMED** |

### Published QC vs the released cells — two discrepancies

| | CHEM10 (round 1) | CHEM11 (round 2) |
|---|---|---|
| min `n.umi` | **101** | **100** |
| cells < 80 UMI | 0 | 0 |
| cells with ratio < 2.5 | **0** (min exactly 2.500) | **65,736 — 4.83%** (min 2.000) |
| cells with `hash_umis` ≤ 5 | **0** (min 6) | **16,541 — 1.22%** (min 1) |
| max `perc_mitochondrial_umis` | 24.99% | 15.00% |

1. **The round-1 80-UMI floor is not present in the release.** Supplemental Fig. 1A states barcodes
   above 80 UMIs were called as cells in round 1, yet no released CHEM10 cell falls below 101 UMI.
   The most parsimonious reading is an additional ≥100 UMI filter applied before release.
   **UNRESOLVED.**
2. **CHEM11 was released without the stated hash filters.** CHEM10 matches every published threshold
   exactly; ~5% of CHEM11 cells fall below the 2.5 enrichment cutoff and ~1% below the hash-UMI
   floor. **UNRESOLVED.**

Do not infer the missing cells from the filtered object — the pre-QC data is not available.

## 5. Ground-truth annotations

**Authoritative file:** `colData` of the released cds. Labels were **transferred by projection**,
not called de novo: cells were projected into the 1.2 M-cell developmental reference atlas
(18–96 hpf; Duran et al., related manuscript), first in a global reference space then within
sub-spaces, with labels transferred by majority vote of k=10 approximate nearest neighbours
(annoy v0.0.20). **CONFIRMED** (Methods).

| Level | Realized | Paper states |
|---|---|---|
| `projection_group` | **30** | 30 tissue-level — **matches** |
| `cell_type` | **348** | 319 transferred — **UNRESOLVED, 29 beyond the vocabulary** |
| `tissue` | 39 | — |
| `partition_col` | 18 | — |

Vocabularies: `analysis/cf_celltypes.csv`, `analysis/cf_projgroups.csv`. The 319-label reference
vocabulary is **not available locally** (unpublished Duran et al.), so the
expected-but-never-realized comparison cannot be run.

No ZFA/CARO ontology IDs; labels are free-text. Because these labels are *transferred*, they are
not independent evidence about the source atlas — see principle 5.

**Perturbation labels:** compound identity, dose, drug-addition time and collection time all live in
`colData`; `compare_against` names the intended control arm but is populated for only 20% of cells.

## 6. Important released analysis products

| Product | File | Contents |
|---|---|---|
| **Differential cell abundance** (Supplemental Table 1) | `data/chemfish_abundance_changes.RDS` | abundance change by perturbation × drug-addition time × collection time |
| **Pectoral-fin DEGs** (Supplemental Table 2) | `data/pectoral_fin_WT_DEGs.RDS` | DEG table for the pectoral-fin subset |
| Whole-atlas DEGs | `data/chemfish_DEGs.RDS` | 8.5 MB |
| Additional DEG set | `data/chemfish_DvEGs.RDS` | 6.1 MB |
| Pectoral-fin subset object | `data/pectoral_fin_WT_cds.tar` | 70 MB |

The bioRxiv supplementary endpoint was rate-limited (HTTP 429) when checked; no additional
supplementary file is known to be missing.

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Prepared reference | none stated; "per Saunders et al." | **100.0000% 5-tuple identity with ZSCAPE's 32,031-gene reference**, including ordering | **CONFIRMED** |
| FASTA/GTF filenames | none | no reference strings exist anywhere in the object | **STRONGLY INFERRED** by inheritance |
| Round-1 UMI floor | 80 UMI | no released CHEM10 cell below 101 UMI | **UNRESOLVED** |
| Hash thresholds | ratio ≥ 2.5, hash UMI > 5 | CHEM10 matches exactly; **CHEM11 has 65,736 cells (4.83%) below ratio and 16,541 below the UMI floor** | **UNRESOLVED** |
| Cell-type vocabulary | 319 transferred labels | **348 realized** | **UNRESOLVED** (+29) |
| `projection_group` | 30 tissue-level | 30 | **CONFIRMED** match |
| Raw sequencing accession | "available soon" | GEO/SRA/BioProject all empty | **NOT FOUND** — waiting on authors |
| `published` / `reference` columns | — | `False` for all 2,068,668 cells | noted, meaning unclear |
| Pectoral-fin subset | — | contains **genetic** perturbations (`hgfa-negsib`, `met-negsib`, `noto-negsib`, `mafba-negsib`) on the same four genes as ZSCAPE's null lines | cross-dataset link worth exploiting |

## 8. Local assets

All six released artifacts are byte-size-identical to S3 and hardlinked into `data/` from `../raw/`
(same inode — no duplication). The 21 GB tar's sha256 was verified against the recorded checksum.

| File | Bytes | sha256 |
|---|---|---|
| `publication/ChemFish_Barkan_2025.pdf` | 11,379,517 | `a522a85487e1231b26f8b405cf9e452450d2800fa702527ece366086522b8ab1` |
| `data/chemfish_cds.tar` | 21,424,343,040 | `ea0a94690d5aca23d72971ccd79ccf9ac8190c278a12cfedd43b3863ac9ba5bf` |
| `data/chemfish_DEGs.RDS` | 8,466,037 | `9331dcd1a8b35a6aba4b191fcd06bb8bce3468ad495cd7efc33baf7bbc3885fc` |
| `data/chemfish_DvEGs.RDS` | 6,093,718 | `535a68e9f7a87a4ef48b6487e744363288624607958e90be8b6f49283b2cb4c4` |
| `data/chemfish_abundance_changes.RDS` | 703,026 | `e44b82c9e4dede53675d473cca446572f738b9910daac1eedd94b9668c796573` |
| `data/pectoral_fin_WT_cds.tar` | 70,041,600 | `42cdff7e9215be3052bc7464364a5a68d81b83b19c9366179b85921db652c3e5` |
| `data/pectoral_fin_WT_DEGs.RDS` | 170,953 | `afe999819b117286aa4fdffced27b9a32d926a67da27e393c7911e16ad17dba0` |

Extracted tree at `../extracted/` preserves the original tar layout
(`net/trapnell/vol1/home/elizab9/…`) with `chemfish_cds` / `pectoral_fin_cds` symlinks for
convenience. Converters in `code/` (hardlinked from `../`). Evidence in `analysis/`:
`cf_rowdata.csv`, `cf_rowdata3.R`, `cf_rowranges.R`, `cf_celltypes.csv`, `cf_projgroups.csv`.

## 9. Caveats and outstanding work

- **Raw sequencing accession does not exist yet.** Nothing downstream can be re-derived from FASTQ.
  **Waiting on the authors.**
- **Do not assume the published QC was applied.** CHEM11 ships cells below both stated hash
  thresholds; CHEM10 ships none below 101 UMI despite an 80-UMI stated floor.
- **348 vs 319 cell types** affects any label-transfer scoring that assumes a closed vocabulary.
- **Labels are transferred, not independent.** Scoring ChemFish labels against the Duran reference
  measures propagation, not agreement.
- The 319-label reference vocabulary is unpublished, so the missing-label comparison cannot be run.

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
