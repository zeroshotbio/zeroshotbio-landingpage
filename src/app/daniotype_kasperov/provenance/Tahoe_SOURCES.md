# Tahoe-100M + Rhaister — provenance record

Giga-scale human single-cell chemical-perturbation atlas, and its summary-statistics companion.
Companion to `../README.md`; this file records **where everything came from and how far each claim
is substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **This is the only human dataset in the corpus.** The shared provenance principles apply, but
> zebrafish-specific conventions (ZFA ontology, hpf staging) do not.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *Tahoe-100M: A Giga-Scale Single-Cell Perturbation Atlas for Context-Dependent Gene Function and Cellular Modeling* |
| Authors | Zhang, Ubas, de Borja, Svensson, Thomas, Thakar, Lai, Winters, Khan, Jones *et al.* — Vevo Therapeutics |
| Venue | **bioRxiv 2025.02.20.639398** |
| Platform | Vevo Therapeutics **Mosaic** high-throughput platform; libraries via **Parse / GigaLab** (local filenames read `WServicesFrom_ParseGigalab`) |
| Licence | **CC0-1.0** (public domain dedication) |
| Design | **50 cancer cell lines** pooled per well ("village"/mosaic), **14 × 96-well plates**, drug-treated spheroids |
| Scale | **100,648,790 cells released**; **95,624,334** in the current public expression split |

### "100M" is branding — state the realized numbers

| Figure | What it counts | Source |
|---|---|---|
| **100,648,790** | every cell in the release; the sum of our 14 plate objects **and** the row count of `obs_metadata.parquet` | **CONFIRMED**, measured |
| **95,624,334** | cells with `pass_filter == 'full'`; **exactly** the Hugging Face expression split's `num_examples` | **CONFIRMED**, measured and cross-checked |
| 5,024,456 | `pass_filter == 'minimal'` — released in the H5AD/obs layer, **absent from the HF expression split** | **CONFIRMED** |
| "100M" / "over 100 million" | the dataset's name and abstract phrasing | branding |
| "~1,100 perturbations" | reconciles to **1,138 distinct `drugname_drugconc`** (drug × dose) combinations | **CONFIRMED** |

`pass_filter` is documented as: *"'full' filters are more stringent on gene_count and tsc_count and
result in ~96 M cells."*

### Realized dimensions, all measured from `obs_metadata.parquet`

| Axis | Count |
|---|---|
| Cells | **100,648,790** |
| Plates | **14** |
| Samples (unique treatment instances) | **1,344** |
| Cell lines | **50** |
| Drugs (distinct `drug` values) | **380** — 379 compounds + `DMSO_TF` |
| Drug × dose combinations | **1,138** |
| Sublibraries | **1,786** |
| (plate × cell line) combinations | **700** = 14 × 50 — every line on every plate |

## 2. Canonical released data

| | |
|---|---|
| Canonical resource | Hugging Face **`tahoebio/Tahoe-100M`**, commit `2dc57900b7981cfcf5e211527169a0b006546a95`, last modified **2025-07-23** |
| Configs | `expression_data` (default), `sample_metadata`, `gene_metadata`, `drug_metadata`, `cell_line_metadata`, `obs_metadata`, `pseudobulk_differential_expression` |
| Expression split | 3,388 parquet shards, `num_examples` **95,624,334**, `download_size` 337,644,770,670 B |
| Our local copy | **Arc Institute-hosted per-plate H5AD conversion**, release stamped **2025-02-25** |

### Local vs Hugging Face — our copy is a superset

| | Local 14 plates | HF `expression_data` |
|---|---|---|
| Cells | **100,648,790** | **95,624,334** |
| Includes `pass_filter == 'minimal'` | **yes** (5,024,456 cells) | **no** |
| Representation | H5AD, CSR `float32`, gene × cell matrix per plate | parquet, ragged `genes`/`expressions` token sequences |
| Gene identifiers | **HGNC symbols only** (`var` has one column, `gene_name`) | integer `token_id`, mapped via `gene_metadata` |
| Feature universe | 62,710, **identical set AND order across all 14 plates** | 62,710 |

**CONFIRMED.** The local objects are the **Arc-hosted H5AD conversion of the 2025-02-25 release**,
not the current HF parquet release and not an older or reduced version. They carry **5,024,456 cells
the public expression split does not**, which makes re-downloading the HF expression data actively
counterproductive.

### Per-plate dimensions

| Plate | Cells | Non-zeros | | Plate | Cells | Non-zeros |
|---|---|---|---|---|---|---|
| 1 | 5,481,420 | 8,276,063,163 | | 8 | 8,880,979 | 13,203,361,742 |
| 2 | 8,064,658 | 12,592,995,937 | | 9 | 5,866,669 | 8,138,798,146 |
| 3 | 4,705,402 | 5,684,054,105 | | 10 | 8,044,908 | 11,507,888,845 |
| 4 | 7,004,356 | 10,092,375,612 | | 11 | 7,435,869 | 10,068,469,580 |
| 5 | 6,419,498 | 8,551,317,207 | | 12 | 10,487,057 | 16,304,667,972 |
| 6 | 7,545,393 | 12,540,175,425 | | 13 | 8,501,658 | 12,184,406,032 |
| 7 | 5,692,117 | 7,138,746,621 | | 14 | 6,518,806 | 9,714,660,608 |
| | | | | **Total** | **100,648,790** | **~146.0 billion** |

All 62,710 genes; all CSR `float32`. Checksums: `analysis/SHA256SUMS.plates`.

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCh38** | **CONFIRMED** (stated) |
| **Stated annotation** | **Ensembl release 109** | **CONFIRMED** (stated in the official gene-metadata documentation) |
| **Deposited feature universe** | **62,710 features** | **CONFIRMED** |
| **Gene namespace** | HGNC `gene_symbol` + `ensembl_id` (ENSG) + integer `token_id` | **CONFIRMED** |
| **Gene filtering** | **none** — the full Ensembl gene set, unfiltered | **CONFIRMED** |
| **Custom transformation** | none | **CONFIRMED** |

### VERDICT: the stated reference is correct — exact match

| Test | Result |
|---|---|
| Tahoe `ensembl_id` set vs **Ensembl 109 GRCh38** gene set | **EXACT SET MATCH — 62,710 / 62,710, 0 differences in either direction** |
| Duplicate symbols in `gene_metadata` | **0** |
| `token_id` range | **3 – 62,712** (0–2 reserved; the first entry of each `genes` sequence is a CLS marker to be discarded) |

**This is the first dataset in the corpus whose published reference claim survives the test
unchanged.** ZSCAPE, ZCL 2.0 and MIC-Drop-seq all failed it. Recording that explicitly matters:
the rule is *verify*, not *distrust*.

### Local files carry symbols only — but the mapping is unambiguous

The 14 plate H5ADs have a single `var` column, `gene_name`, holding HGNC symbols. **No Ensembl IDs
are stored locally.** They are nonetheless fully recoverable: the official
`gene_metadata.parquet` (62,710 rows) is in **identical order** to the local `var` index, verified
position-by-position, so a positional join restores `ensembl_id` and `token_id` exactly.
**CONFIRMED.** `sources/metadata/gene_metadata.parquet` is held locally for this purpose.

## 4. Processing pipeline and experimental design

| Element | Value | Confidence |
|---|---|---|
| Platform | Vevo **Mosaic**; Parse/GigaLab library services | **CONFIRMED** (documentation + local filenames) |
| Village design | **50 cell lines pooled per well**; `plate` identifies the 96-well plate (1–14) in which the mixed-cell spheroid was seeded and treated | **CONFIRMED** |
| Cell-line assignment | genetic demultiplexing back to Cellosaurus IDs (`cell_line`) | **STRONGLY INFERRED** — the mechanism is implied by the village design; the exact demultiplexing tool is **UNRESOLVED** |
| Sublibrary | 1,786 values, "related to library prep and sequencing" | **CONFIRMED** |
| Per-cell QC fields | `gene_count`, `tscp_count`, `mread_count`, `pcnt_mito`, `S_score`, `G2M_score`, `phase` | **CONFIRMED** |
| `pass_filter` | `full` (95,624,334) / `minimal` (5,024,456); "full" is stricter on `gene_count` and `tsc_count` | **CONFIRMED** — the **numeric thresholds themselves are UNRESOLVED** |
| Counts | raw integer counts, stated and consistent with CSR `float32` storage | **CONFIRMED** |
| Sequencing platform, treatment duration, replicate structure | not recovered from the documentation held | **UNRESOLVED** — requires the preprint PDF |

> **Distinguish the atlas from the model corpus.** `tahoebio/tahoe-x1` applies its own preprocessing
> and gene filtering to build a *training* representation. That filtered corpus is **not** the
> canonical Tahoe-100M release and must not be cited as its dimensions. Indexed, not analysed.

## 5. Ground-truth annotations and metadata

There are no cell-type labels — the biological identity axis is the **cell line**, assigned by
genetic demultiplexing, not by clustering.

| Table | Rows | Contents |
|---|---|---|
| `gene_metadata.parquet` | 62,710 | `gene_symbol`, `ensembl_id`, `token_id` |
| `sample_metadata.parquet` | **1,344** | per-sample mean gene/UMI/read counts, mean `pcnt_mito`, `drug`, `drugname_drugconc` |
| `drug_metadata.parquet` | **379** | `targets`, `moa-broad`, `moa-fine`, `human-approved`, `clinical-trials`, `gpt-notes-approval`, `canonical_smiles`, `pubchem_cid` |
| `cell_line_metadata.parquet` | 1,000 rows / **102 distinct lines** | `cell_name`, **`Cell_ID_DepMap`**, **`Cell_ID_Cellosaur`**, `Organ`, and a curated driver-mutation set (`Driver_Gene_Symbol`, zygosity, variant type, protein effect, inferred mechanism, oncogene/suppressor) |
| `obs_metadata.parquet` | **100,648,790** | 17 per-cell columns; the authoritative cell-level table |

Chemistry coverage: **377 of 379** compounds carry SMILES, **379 of 379** carry a PubChem CID.
MoA: **26** `moa-fine` categories; `moa-broad` splits inhibitor/antagonist 276 · unclear 76 ·
activator/agonist 27. Human-approved: yes 263 · no 116. Organs: **15**.

> ### The MoA, target and approval annotations are LLM-generated
> The official documentation states that `targets` were *"proposed by GPT-4o … then validated
> against MedChemExpress"*, `moa-broad` and `moa-fine` were *"assigned by GPT-4o"*, and
> `human-approved` / `clinical-trials` labels were *"provided by GPT-4o"* with corroboration.
> `moa-fine` is described as *"selected from a curated list of 25 MOA categories"* but **26 distinct
> values are realized**. These fields are useful annotation, **not primary-source curation**, and
> should never be cited as authoritative pharmacology. **CONFIRMED** from the official docs.

## 6. Controls — audited

| | |
|---|---|
| Control label | **`DMSO_TF`** — the vehicle control |
| Control cells | **2,330,156 (2.32%)** |
| Plates carrying controls | **14 of 14** |
| (plate × cell line) combinations | **700**, of which **700 have a plate-matched DMSO_TF control — 100% coverage, zero gaps** |
| Control depth per combination | min **20** · median **2,982** · max **15,630** |

Official guidance: *"DMSO_TF marks vehicle controls, use DMSO_TF along with plate to get plate
matched controls."* The audit confirms this is always possible. **CONFIRMED.**

> ### Trap: a drug whose name contains `DMSO_TF`
> **`Trametinib (DMSO_TF solvate)`** — **269,491 cells** — is a **MEK inhibitor**, with PubChem CID
> 11707110 and a `moa-fine` of "MEK inhibitor". It is a *treatment*, not a control. Any filter of
> the form `drug.str.contains("DMSO")` silently mislabels 269,491 trametinib-treated cells as
> vehicle. **Match on `drug == "DMSO_TF"` exactly.** **CONFIRMED.**

## 7. Summary-statistics layers — Tahoe pseudobulk DE and Rhaister

| Resource | Location | Scale |
|---|---|---|
| Tahoe pseudobulk DE | `tahoebio/Tahoe-100M` → `metadata/pseudobulk_differential_expression/` | **1,026 parquet shards** (~89 GB) |
| **Rhaister** | `tahoebio/tahoe-de-rhaister`, commit `c7963cf334bec0683225d41c9586d900ca6303a2`, last modified **2026-06-01**, CC0-1.0 | 161 files |

Rhaister is the smaller, more directly useful layer and is the one acquired. Its structure:

| Component | Files | Contents |
|---|---|---|
| **`pdex/all_plates_pdex.parquet`** | 1 | the per-gene DE table — cell line × treatment × gene × plate |
| **`cell_eval/plate_plate{1..14}.parquet`** | 14 | **4,443 rows × 2,002 columns** per plate: `cell_line`, `treatment`, and pseudobulk deltas across **2,000 modelled genes** |
| **`definition/`** | 141 | split definitions as TOML across `5_holdout` … `9_holdout`; few-shot splits (DE-diversity, biomni, claude, diverse-20, focused-diversity, high-effect-size A/B); **titration** splits at 1/3/6/10/20/30/60 drugs; `generalization_converted_cell_lines_3b`, `zeroshot_*`, `scantshot_*`; plus `dataset.toml` and **`static_2k_genes.json`** (the 2,000-gene panel) |
| **`zeroshot/`** | 3 | `cell_line_centroids_dmso.parquet`, `cell_line_centroids_dmso_hvg.parquet`, `control_expression.parquet` — the zero-shot reference/plate-control tables |

**Acquisition status: 158 of 161 files held (~2.9 GB).** `pdex/all_plates_pdex.parquet` was still
transferring when this record was written — the HF tree API under-reports LFS sizes, so the initial
1.00 GB estimate was wrong; the file alone exceeds 1.9 GB. **Its schema, row count and the
validation in §8 are therefore NOT yet established.**

The ~89 GB Tahoe `pseudobulk_differential_expression` shards were **deliberately not downloaded**:
Rhaister covers the same statistical layer in a fraction of the space, and the relationship between
the two has not yet been established. **UNRESOLVED.**

## 8. Validation of summary statistics against raw cells

**NOT YET PERFORMED.** Blocked on the `pdex` transfer completing.

The intended check, on a modest stratified sample of plates × cell lines × compounds × genes:
recompute from raw cells the treated mean, the plate-matched DMSO reference mean, log2 fold change,
expression delta and membership counts, and compare against the released values — enough to
establish the transformation and its trustworthiness, not to recompute billions of rows. The exact
normalization convention (raw vs CPM vs log1p, and the pseudocount) is **UNRESOLVED** until then.

## 9. Local assets and caveats

### Local assets

| Path | Size | Notes |
|---|---|---|
| `../h5ad/plate{1..14}_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad` | ~317 GB | the 14 plate objects; SHA256 in `analysis/SHA256SUMS.plates` |
| `../metadata/obs_metadata.parquet` | 2.29 GB | 100,648,790 × 18 |
| `../metadata/sample_metadata.parquet` | 65 KB | 1,344 samples |
| `sources/metadata/{gene,drug,cell_line}_metadata.parquet`, `gene_vocabulary.json` | ~1.4 MB | acquired from Hugging Face |
| `sources/rhaister/` | ~2.9 GB and growing | the Rhaister release |
| `sources/publication/HF_README.md`, `LICENSE.md` | | official documentation and CC0 licence |

**Misfiled:** `../ReplogleWeissman2022_K562_essential.h5ad` (1.55 GB) and
`../ReplogleWeissman2022_rpe1.h5ad` (1.24 GB) sit under `Tahoe/` but are the **Replogle/Weissman
CRISPRi** dataset, unrelated to Tahoe. A separate `Replogle/` directory already exists in
`raw_datasets/`. **Not moved** — flagged for a decision.

### Caveats and outstanding work

- **`pdex` acquisition incomplete**, so its schema and the §8 validation are open. This is the
  single most important remaining item.
- **The Tahoe ↔ Rhaister relationship is unestablished** — whether Rhaister is a subset,
  recomputation, or different convention of the 89 GB pseudobulk DE layer.
- **`pass_filter` thresholds are not published** — only that "full" is stricter on `gene_count` and
  `tsc_count`.
- **Sequencing platform, treatment duration and replicate structure** are not in the documentation
  held; they require the preprint PDF, which was not retrieved.
- **Genetic-demultiplexing method is unnamed.**
- **MoA / target / approval annotations are GPT-4o-generated.** Do not treat as curated pharmacology.
- **`cell_line_metadata` covers 102 lines; the dataset uses 50.** The table is a superset — filter
  before joining, or you will silently carry 52 unused lines.
- **`drug_metadata` has 379 rows but `obs` has 380 distinct `drug` values** — `DMSO_TF` has no
  drug-metadata row. Left joins will produce nulls for every control cell.
- **`moa-fine` has 26 realized categories against a documented 25.**
- **No canonical single-object H5AD was built, deliberately.** The 14 plate objects are faithful,
  share one feature universe in identical order, and total 100,648,790 cells. Merging them into one
  ~317 GB object would consume disk and time for no analytical gain. The manifest plus the
  order-identical `gene_metadata` join is the canonical representation.

---

## Cross-dataset provenance principles

Applies to every dataset in this corpus; substantially identical in all `sources/README.md`
records. (Written for the zebrafish corpus; items 1–5 and 7 apply unchanged to human data, and
item 6's "stage definitions" reads as "dose, timepoint and cell-line context" here.)

1. **The deposited feature universe is evidence; the paper's reference claim is a hypothesis.**
   Gene IDs and feature counts are tested against candidate references before any harmonisation.
2. **Published reference claims and deposited data can disagree.** ZSCAPE, ZCL 2.0 and MIC-Drop-seq
   each carry a stated or assumed reference that the released features contradict or fail to
   support. Verification precedes downstream mapping, always. *(Tahoe-100M passed.)*
3. **Canonical author releases outrank our older derived objects.** Every derived H5AD must have a
   reproducible build script and a `uns['provenance']` stamp; superseded objects are retained rather
   than overwritten, so prior results stay reproducible.
4. **Published QC is verified against released cells.** A threshold printed in Methods is never
   assumed to have been applied to the deposited object.
5. **Annotation source matters.** Author-called, transferred, ontology-backed, inferred, and
   our-own-mapping labels are distinguished and never silently blended. *(Here: the MoA and target
   annotations are LLM-generated and are labelled as such.)*
6. **Harmonisation must not erase dataset-specific biology.** Original gene IDs, native labels,
   stage definitions, perturbation identities and technology metadata are preserved alongside any
   canonical mapping.
7. **Summary-level biological truths travel better than raw counts.** Author-derived marker genes,
   pseudobulk DE, abundance effects and perturbation summaries are preserved as first-class assets:
   they may support cross-dataset work in cases where the raw assays are not interchangeable.
