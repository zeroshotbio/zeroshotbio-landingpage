# Zebrahub — provenance record

Wild-type developmental reference atlas. Companion to `../README.md`, which describes dataset
*contents*; this file records **where everything came from and how far each claim is
substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **Zebrahub-Multiome is a different dataset.** A separate snRNA+ATAC assay with its own preprint,
> repo (`czbiohub-sf/zebrahub-multiome-analysis`) and reference (Cell Ranger ARC 2.0.2 on Ensembl
> GRCz11). Its methods surface repeatedly in searches for *this* atlas and must not be cited for it.
> Nothing in this file comes from the Multiome paper.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *A multimodal zebrafish developmental atlas reveals the state-transition dynamics of late-vertebrate pluripotent axial progenitors* |
| Authors | Lange et al. — Royer lab, CZ Biohub |
| Venue | **Cell (2024)** — [S0092-8674(24)01147-4](https://www.cell.com/cell/fulltext/S0092-8674(24)01147-4) |
| Portal | <https://zebrahub.ds.czbiohub.org/> |
| Assay | **10X Chromium**, whole cells (not nuclei). Dissociation optimised to avoid embryo pooling, so every cell traces to a named individual |
| Purpose | Wild-type developmental reference spanning 10 hpf to 10 dpf with single-embryo resolution |
| Scale | **120,444 cells · 10 timepoints · 40 embryos (4 per stage)** |
| Perturbations | **none** — observational wild-type reference |

Timepoints: 10, 12, 14, 16, 19, 24 hpf and 2, 3, 5, 10 dpf.

**Not a labelling target for us.** 10X droplet chemistry keeps it from integrating with the
combinatorial-indexing atlases we label (ZSCAPE / ChemFish / MegaFIN). Gene IDs are *not* the
barrier — see §3.

## 2. Canonical released data

| | |
|---|---|
| Data | Figshare article **20510367**, "Zebrahub single cell dataset", **v1, 2022-08-23** |
| Code | [czbiohub-sf/zebrahub_analysis](https://github.com/czbiohub-sf/zebrahub_analysis) — filed under `code/` |

**Figshare publishes 12 files. We previously held 10.** The two we lacked mattered more than the ten
we had:

| Missing file | Size | Why it matters |
|---|---|---|
| `zf_atlas_3dpf_v1_release.h5ad` | 218 MB | **a real timepoint we never downloaded** — 22,473 cells |
| `zf_atlas_full_v1_release.h5ad` | 1.59 GB | **the authors' own combined atlas** — we had been concatenating our own |

**`zf_atlas_full_v1_release.h5ad` is canonical: 120,444 cells × 32,060 genes**, matching the final
paper exactly, with `var` intact, zero duplicate barcodes, and 10 timepoints.

Figshare file ids: 2dpf 36736062 · 10dpf 36736065 · 10hpf 36736068 · 12hpf 36736071 ·
14hpf 36736074 · *15hpf 36736077 (duplicate)* · 16hpf 36736080 · 24hpf 36736089 ·
19hpf 36736158 · 5dpf 36736161 · **3dpf 36736164** · **full 36736206**.
Checksums for the ten original per-stage releases: `data/SHA256SUMS.figshare`.

### 14 hpf vs 15 hpf — VERDICT: the cells are 14 hpf

`zf_atlas_15hpf_v1_release.h5ad` is a **Figshare packaging duplicate of the 14 hpf release**:

- identical barcode sets (3,862 / 3,862)
- identical fish (`TDR18, TDR19, TDR21, TDR22`)
- identical `total_counts` sum and range
- archive sizes 404 bytes apart (100,911,369 vs 100,910,965)

Decisive primary evidence: **the authors' own full atlas contains no 15 hpf timepoint at all.**
Its ten stages match the paper. The cells belong to **14 hpf**, and the 15 hpf file should be
disregarded. **CONFIRMED**, not a judgement call.

### Cell-count reconciliation

| Figure | Explanation |
|---|---|
| 101,833 | our old concatenation — 10 files including the 15 hpf duplicate, missing 3 dpf |
| **120,444** | authors' full release **and** the final paper |
| 3,862 | the duplicated 14/15 hpf population |
| 22,473 | 3 dpf, which we never had |

**101,833 − 3,862 + 22,473 = 120,444** — exact. **CONFIRMED.**

The 120,671 figure quoted for an "early release" is **not reproduced by any local artifact**; the
Figshare v1 full release is already 120,444. **UNRESOLVED** (227 cells), not consequential.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **UNRESOLVED** — never stated | **UNRESOLVED** |
| **Stated annotation** | **`Danio.rerio_genome_Zebrabow_6`**, a custom Cell Ranger reference named in `var['genome']` of every release | **CONFIRMED** (the *name*; not the recipe) |
| **Deposited feature universe** | **32,060 features** = 32,057 ENSDARG + 3 transgenes | **CONFIRMED** |
| **Gene namespace** | **ENSDARG in `var['gene_ids']`**; `var_names` are symbols with scanpy `var_names_make_unique()` applied (1,132 names carry a `-N` suffix) | **CONFIRMED** |
| **Custom transformation** | three **Zebrabow transgene features** added: `dTomato`, `mCerulean`, `EYFP` | **CONFIRMED** |
| `feature_types` | `Gene Expression` — Cell Ranger output | **CONFIRMED** |
| mt / nc flags | 13 mitochondrial, 24 nc genes flagged | **CONFIRMED** |
| FASTA / GTF / Ensembl release / Cell Ranger version / `mkref` procedure | **not published** | **UNRESOLVED** |

### The reference recipe — WRITTEN OFF 2026-08-13 as unpublished

**Cell Ranger versions are now CONFIRMED** from the paper's STAR Methods, verbatim:

> *"After sequencing, the obtained sequences were de-multiplexed using **bcl2fastq (v2.20.0.422)**.
> To align the reads to the reference genome, a **reference genome was first created using
> CellRanger v.4.0.0**. Subsequently, the **CellRanger v.5.0.1** software was used for read
> alignment to the reference zebrafish genome."*

Identical wording appears in the bioRxiv v2 preprint. (An earlier pass reported "Cell Ranger absent"
from the paper — that was a **search error**: the paper writes `CellRanger` with no space.)

| Layer | Status |
|---|---|
| `mkref` builder | **CellRanger v4.0.0** — CONFIRMED |
| Aligner | **CellRanger v5.0.1** — CONFIRMED |
| Demultiplexer | **bcl2fastq v2.20.0.422** — CONFIRMED |
| Sequencer | **NovaSeq 6000** — CONFIRMED (Key Resources Table) |
| Chemistry | **Chromium Next GEM Single Cell 3′ v3.1** (10 hpf–1 dpf) and **Single Cell 3′ v3.1 HT** (2–10 dpf) — CONFIRMED |
| Raw data accession | **NIH BioProject PRJNA940501** — CONFIRMED (Key Resources Table) |
| **FASTA / GTF / assembly / Ensembl release fed to `mkref`** | ❌ **UNPUBLISHED — written off** |
| **Zebrabow transgene sequences** (`dTomato`, `mCerulean`, `EYFP`) | ❌ **UNPUBLISHED — written off** |

**Sources exhausted 2026-08-13.** Every one of the following was obtained and searched for
`Zebrabow`, `mkref`, `GRCz`, `Ensembl`, `GTF`, `FASTA` and the transgene names:

| Source | Result |
|---|---|
| *Cell* 2024 paper incl. STAR Methods (36 pp) | versions yes; **no** reference inputs |
| **Methods S1** (14 pp) | **all terms ABSENT** — it is the imaging/HCR supplement |
| Data S1 (17 pp), Tables S1 & S2 | no reference content |
| bioRxiv **v2** preprint (50 pp) | repeats the paper verbatim, adds nothing |
| `zebrahub_analysis` repo | only printed `adata.var` output echoing the name |
| **`zebrahub-multiome-analysis` repo** (267 MB) | **`Zebrabow` appears nowhere in it** |

> ⚠ **The multiome repo's reference statement is a trap, not an answer.** Its README specifies
> *"Cell Ranger ARC 2.0.2 reference built from the Ensembl GRCz11 genome (`Danio.rerio.fa`) and
> annotation (`Danio.rerio.gtf`), primary chromosomes 1–25 + MT"* — but that is the **Multiome**
> dataset, a different assay with its own reference and its own accession (PRJNA1164307). **Do not
> transplant it onto this atlas.**

**Consequence for use:** the name `Danio.rerio_genome_Zebrabow_6` is all that is knowable about the
counting reference from published material. Treat the 32,057 ENSDARG ids as the operative feature
universe — all are members of Ensembl 99, though that does not date the build, since the zebrafish
gene set is identical across releases 99–114. Closing this now requires an author request. Recorded
as a documented gap rather than an open task.

All 32,057 ENSDARG ids are members of Ensembl 99 — but that is uninformative for dating, since the
zebrafish gene set is identical between releases 99 and 114.

> ### Correction to our own docs
> `../README.md` and the dataset card recorded the namespace as *"gene symbols — requires mapping to
> ENSDARG"*, and cited that as a barrier to integration. **That is wrong.** ENSDARG ids are present
> in `var['gene_ids']` of every original release. We believed otherwise only because our old combined
> object had discarded `var` entirely. **31,569 genes are shared with the ZSCAPE/ChemFish
> 32,031-gene space**, and all 32,057 are contained in MIC-Drop-seq's 32,520-gene Ensembl universe.

## 4. Processing pipeline

| Stage | Value | Confidence |
|---|---|---|
| Alignment / counting | **Cell Ranger** (version unstated) against the custom `Danio.rerio_genome_Zebrabow_6` reference | **STRONGLY INFERRED** from `feature_types`/`genome` in `var` |
| Published QC | see below | **CONFIRMED** as *stated* |
| Annotation method | ZFA-term assignment; the full atlas carries a coarse vocabulary and the per-stage releases a finer one | **CONFIRMED** |
| Downstream framework | scanpy (`var_names_make_unique`, `pct_counts_*` fields present) | **CONFIRMED** |

From `code/zebrahub_analysis/pre_processing/Sequencing_QualityControl.ipynb` (Jan 2023):

```python
# per-sample load, explicitly "not QC ... only to reduce the size of the file"
min_genes_pcell = 100 ; min_counts_pcell = 100
# the actual filters
adata = adata[adata.obs.pct_counts_nc < 15, :]
adata = adata[adata.obs.pct_counts_mt < 15, :]
adata = adata[adata.obs['total_counts'].between(2000, 20000), :]
sc.pp.filter_genes(adata, min_cells=3)
```

### Published QC vs the released objects

| Rule | Result across all ten per-stage releases |
|---|---|
| `pct_counts_nc` < 15 | **0 violations** ✔ |
| `pct_counts_mt` < 15 | **0 violations** ✔ |
| `n_genes` ≥ 100 | **0 violations** ✔ |
| `total_counts` ∈ [2000, 20000] | **holds for 2 dpf, 5 dpf and 10 dpf only** |

**Two QC regimes in one release set.** The late timepoints sit exactly inside the documented window
(10 dpf 2,000–20,000; 2 dpf 2,000–19,988; 5 dpf 2,501–19,995). The early timepoints do not:
10 hpf–24 hpf all span roughly **17,000–100,000** total counts, with minima near 17,000 rather than
2,000. Whatever produced the early per-stage releases used a different count window from the
notebook. **UNRESOLVED.**

Chronology is consistent: the Figshare v1 files are dated **Aug 2022**, the QC notebook **Jan 2023**.
The notebook likely documents the final-paper pipeline, not the v1 packaging.

## 5. Ground-truth annotations

**Authoritative file:** `obs` of the authors' full release for the coarse vocabulary; the per-stage
releases for the fine one. Both are preserved in our rebuild.

| Field | Values | Notes |
|---|---|---|
| `zebrafish_anatomy_ontology_class` | **10** in the full atlas · **12–45** per stage | two genuine granularities |
| `zebrafish_anatomy_ontology_id` | matching **ZFA** identifiers | **ontology-backed** — the only dataset in this corpus that ships ZFA ids natively |
| `developmental_stage` | 10 | somite-stage names early (`0/05/10/15/20/30 somites`), `larval-Ndpf` late |
| `timepoint` | 10 | `10hpf … 10dpf` |
| `fish` | **40** individual embryos (4 per stage), TDR-numbered | |
| `timepoint_cluster` | 51 | **per-timepoint** cluster ids, not a global vocabulary — the same integer means different things at different stages, and the authors' code does not define them further. **UNRESOLVED** |

The full atlas carries a **coarse** 10-term ZFA vocabulary (germ-layer/system level:
`central_nervous_system`, `paraxial_mesoderm`, `neural_crest`, …). The per-stage releases carry a
**fine** vocabulary (`diencephalon`, `blood island`, `otic vesicle`, `trigeminal ganglion`, …),
**154 distinct** across all stages. Our rebuild joins both.

No perturbation labels — this is an observational atlas.

## 6. Important released analysis products

Zebrahub distributes objects rather than derived statistic tables: there is no published DE table,
abundance-effect table or marker workbook equivalent to ZSCAPE's or MIC-Drop's. The portable
analysis-ready assets are therefore:

| Product | Where | Contents |
|---|---|---|
| **ZFA-term assignments** | `obs` of every release | ontology-backed cell labels, coarse (10) and fine (154) |
| Per-cell QC statistics | `obs` | `pct_counts_mt`, `pct_counts_nc`, `total_counts`, `n_genes` |
| Per-gene QC statistics | `var` | `n_cells_by_counts`, `mean_counts`, `pct_dropout_by_counts`, `total_counts` |
| UMAP embedding | `obsm['X_umap']` | preserved in the rebuild |
| Single-embryo assignment | `obs['fish']` | 40 named individuals — rare and valuable for variance modelling |

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Gene namespace | our docs said "symbols only, needs mapping" | **ENSDARG present in `var['gene_ids']` of every original release**; only our old combined object had discarded `var` | **CONFIRMED correction** |
| Canonical object | — | the authors publish their own combined atlas; we had been concatenating our own | **CONFIRMED** |
| 15 hpf timepoint | Figshare ships a 15 hpf file | duplicate of 14 hpf; absent from the authors' atlas | **CONFIRMED** — disregard |
| 3 dpf | in the paper | never downloaded by us | **CONFIRMED** — now restored |
| Cell count | 120,444 | 101,833 − 3,862 + 22,473 = 120,444 exactly | **CONFIRMED** |
| 120,671 "early release" | quoted externally | not reproduced by any local artifact | **UNRESOLVED**, 227 cells |
| Reference recipe | name only (`Danio.rerio_genome_Zebrabow_6`) | assembly, Ensembl release, FASTA, GTF, Cell Ranger version, mkref and transgene sequences all absent | **UNRESOLVED** |
| QC window | notebook: `total_counts` 2,000–20,000 | holds for 2/5/10 dpf only; 10 hpf–24 hpf span ~17,000–100,000 | **UNRESOLVED** |
| `timepoint_cluster` | — | per-timepoint ids, undefined in the code | **UNRESOLVED** |

## 8. Local assets

**Canonical rebuild:** `../zebrahub_combined_v2.h5ad`, built by `code/build_zebrahub_combined.py`
(reproducible, with a `uns['provenance']` stamp recording base file, Figshare article, exclusions and
source checksums).

| | |
|---|---|
| Cells | **120,444** |
| Genes | **32,060** (32,057 ENSDARG + dTomato, mCerulean, EYFP) |
| Timepoints | 10 — no 15 hpf, 3 dpf included |
| Fish | 40 |
| ZFA coarse / fine | 10 / **154**, fine labels joined for **120,444 / 120,444** cells |
| `var` preserved | `gene_ids, feature_types, genome, mt, nc, n_cells_by_counts, mean_counts, pct_dropout_by_counts, total_counts, n_cells` |
| Also preserved | `layers['counts']`, `obsm['X_umap']` |
| Shared genes | **31,569** with ZSCAPE/ChemFish; all 32,057 contained in MIC-Drop-seq's 32,520 |

The approach is to **adopt the authors' full atlas and enrich it**, not to re-concatenate — their
object is already correct, and rebuilding from parts would only reintroduce risk.

The old `../zebrahub_combined.h5ad` is **retained, not overwritten**, so prior results stay
reproducible.

Twelve Figshare files are held. Code in `code/zebrahub_analysis` + `code/build_zebrahub_combined.py`.
API responses substantiating the claims above are in `analysis/`.

## 9. Caveats and outstanding work

- ⚠ **`../visualization/` must be regenerated.** `1_sample_zebrahub_cells.py` reads the old
  `zebrahub_combined.h5ad`, so every downstream output (latent space, timepoint centroids,
  developmental paths, renders) was computed on an object that double-counted 3,862 cells as two
  timepoints and omitted 3 dpf entirely. **Required.**
- **The exact reference recipe is WRITTEN OFF as unpublished** (§3). Cell Ranger v4.0.0/v5.0.1,
  bcl2fastq v2.20.0.422, NovaSeq 6000 and PRJNA940501 are now confirmed; the FASTA/GTF/assembly and
  the Zebrabow transgene sequences appear in **no** source we hold, including Methods S1 and the
  multiome repo. Author request only.
- **Two QC regimes** in the v1 release set — early vs late timepoints. Do not assume the notebook's
  window applies to 10 hpf–24 hpf. **Likely explanation found 2026-08-13:** the paper used two
  different kits — `Chromium Next GEM Single Cell 3′ v3.1` for **10 hpf–1 dpf** and
  `Single Cell 3′ v3.1 HT` for **2–10 dpf**. That boundary coincides with the observed
  `total_counts` split (10 hpf–24 hpf ~17k–100k vs 2/5/10 dpf inside 2,000–20,000).
  **STRONGLY INFERRED**, not proven.
- **`timepoint_cluster` is not a global vocabulary.** Never pool it across stages.
- ~~Final *Cell* paper PDF and supplementary not retrieved~~ — **CLOSED 2026-08-13**: paper,
  Methods S1, Data S1, Tables S1–S2, Videos S1–S5, the bioRxiv v2 preprint and both analysis repos
  are all held.

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
