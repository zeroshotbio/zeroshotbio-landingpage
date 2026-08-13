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

### Tahoe-x1 — indexed, and it does NOT filter the gene universe

`tahoebio/Tahoe-x1` (HF **model** repo, apache-2.0, commit `d218a580…`, 2025-10-24) ships three
sizes — **70m / 1b / 3b** — each with `model.safetensors`, `best-model.pt`, `model_config.yml`,
`collator_config.yml` and `vocab.json`.

| Test | Result |
|---|---|
| Tahoe-x1 70m vocabulary | **62,720 entries = 62,710 gene tokens + 10 special** (`<cls>`, `<eoc>`, `<junk0..6>`, `<pad>`) |
| Gene tokens keyed by | **ENSG**, 100% |
| Canonical universe genes missing from the vocabulary | **0** |
| Vocabulary genes outside the canonical universe | **0** |

**VERDICT: Tahoe-x1's vocabulary is the full canonical 62,710-gene universe plus special tokens.**
The model corpus differs from the atlas by *tokenization*, not by gene filtering — so the common
assumption that a training representation implies a reduced feature set does **not** hold here.
(The 3b vocabulary has one extra entry, 62,721; unexamined.) Related repos, indexed only:
`tahoebio/Rhaister` (the model) and `tahoebio/Tahoe-100M-SCVI-v1`.

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

**Acquisition status: 160 of 161 files held (~17 GB); `pdex` is INCOMPLETE.**

> ### ⚠ `pdex/all_plates_pdex.parquet` is a truncated partial download — quarantined 2026-08-13
> 16,655,922,866 B on disk against an expected **~40.6 GB**. The `PAR1` header is present but the
> **footer is absent**, and `pq.ParquetFile(...)` fails with
> `ArrowInvalid: Parquet magic bytes not found in footer`.
>
> It has been **renamed to `pdex/INCOMPLETE_DOWNLOAD_all_plates_pdex.parquet.part`** with a
> `pdex/README_INCOMPLETE.md` beside it. Until then it sat at the canonical path under the canonical
> name with nothing marking it incomplete. **It must not be restored to the canonical filename until
> a `pq.ParquetFile()` open succeeds.**
>
> The HF tree API under-reports LFS sizes, which is why earlier estimates of 1.00 GB and then
> ">1.9 GB" were both wrong. **`pdex`'s schema, row count and the §8 validation remain
> NOT established.** The 14 `cell_eval` plate files are complete and validated and are unaffected.

The ~89 GB Tahoe `pseudobulk_differential_expression` shards were **deliberately not downloaded**:
Rhaister covers the same statistical layer in a fraction of the space, and the relationship between
the two has not yet been established. **UNRESOLVED.**

## 8. Validation of summary statistics against raw cells

**PERFORMED for `cell_eval`.** Six (cell line × treatment) pairs from plate 1 — 4 cell lines,
3 compounds — recomputed from the raw cells and compared against the released deltas over all
2,000 panel genes. Script: `code/validate_rhaister.py`; results:
`analysis/rhaister_validation.csv`.

### The normalization convention — established

| Candidate convention | mean Pearson r | min r |
|---|---|---|
| **mean `log1p(CP10k)`, treated − plate-matched DMSO** | **0.9644** | **0.9337** |
| `log2(mean_raw ratio)` | 0.0289 | 0.0154 |
| raw mean delta | 0.8317 | 0.6569 |

**`cell_eval` is: `normalize_total(target_sum=1e4)` → `log1p` → per-group mean → treated minus
plate-matched DMSO_TF control.** The log-ratio convention is cleanly excluded (r ≈ 0.03, max abs
difference > 20); the raw-count delta is clearly worse. **CONFIRMED.**

| cell line | treatment | r (log1p CP10k) | max abs diff |
|---|---|---|---|
| CVCL_0459 | Gemcitabine 0.05 µM | 0.9745 | 0.351 |
| CVCL_0546 | Gemcitabine 0.05 µM | 0.9498 | 0.193 |
| CVCL_0399 | Gemcitabine 0.05 µM | 0.9812 | 0.179 |
| CVCL_0293 | Gemcitabine 0.05 µM | 0.9797 | 0.203 |
| CVCL_0546 | Everolimus 0.05 µM | 0.9676 | 0.219 |
| CVCL_0546 | Anastrozole 0.05 µM | 0.9337 | 0.214 |

**Why r is ~0.96 and not 1.0:** both the treated and control groups were subsampled to at most
4,000 cells for tractability, so the residual is sampling noise, not disagreement. The consistency
across four cell lines and three compounds — and the three-orders-of-magnitude gap to the nearest
rival convention — is what establishes the transformation.

**Caveats on the sample.** Pairs were ranked by treated-cell count, which biased the selection
toward Gemcitabine (4 of 6). The compound axis is therefore thin: 3 compounds, one dose (0.05 µM),
one plate. This is enough to fix the convention, **not** enough to certify the release globally.

**`pdex` is NOT yet validated** — see §7 for its acquisition status. Its documented columns are
`cell_line`, `target`, `plate`, `feature`, `fold_change` (`log2(target_mean / ref_mean)`, `-inf`
where `target_mean = 0`), plus membership counts, Mann–Whitney statistic, p-value and FDR. Note
that `pdex` uses a **log-ratio** convention while `cell_eval` uses a **log-space delta** — the two
tables are not on the same scale and must not be mixed. **CONFIRMED** from the official schema
documentation; the numeric check awaits the file.

## 9. The training-ready abstraction

Recorded in full at `analysis/ABSTRACTION_INDEX.md`, from the authors' own
`docs/architecture.md`, `docs/data_inventory.md` and `autoresearch/paper_methods.md`:

```
raw single cells → plate-matched (plate, cell_line, treatment) groups
   → pseudobulk means/deltas (cell_eval)  |  per-gene DE statistics (pdex)
      → per-gene response vectors y[c,p] → held-out (context, perturbation) pairs
```

The task Rhaister trains on is **compositional generalization**: predict `y[c*, p*]` where `c*` and
`p*` each appear individually in the observed set but their combination does not. The abstraction is
assay-agnostic — Rhaister applies it to Tahoe-100M (50 cell lines × **1,137 drugs** × 14 plates,
i.e. our 1,138 minus `DMSO_TF`), **Parse PBMC** (18 cell types × 12 donors × ~100 cytokines) and
**PerturbAI** (whole-brain CRISPR). `pdex` is computed by Mann–Whitney U via the `pdex` library;
`cell_eval` by pseudobulk delta.

The index also sketches how ZSCAPE / ChemFish / MIC-Drop / CellOracle would map onto it, and names
the three obstacles specific to us — divergent control semantics (ChemFish's three vehicles;
MIC-Drop's and CellOracle's *tyr* arms, which edit), CellOracle's absent cell-type labels, and
feature universes spanning 25,107–32,520. **No zebrafish harmonisation was performed.**

### Internal artifacts that are not public

`docs/data_inventory.md` documents Vevo-internal files absent from every public release: a
full-gene `cell_eval` (15.3 GB), **A/B replicate-split `pdex` (43.4 + 43.5 GB)**, per-cell-line
top-3k gene lists, seqrun growth-rate labels (282 pairs) and PRISM dose-matched sensitivity
(9,240 rows). The A/B split matters most — it defines the **noise ceiling**, i.e. what agreement is
achievable at all. **UNRESOLVED** whether any becomes available.

## 10. Local assets and caveats

### Local assets

| Path | Size | Notes |
|---|---|---|
| `../h5ad/plate{1..14}_filt_Vevo_Tahoe100M_WServicesFrom_ParseGigalab.h5ad` | ~317 GB | the 14 plate objects; SHA256 in `analysis/SHA256SUMS.plates` |
| `../metadata/obs_metadata.parquet` | 2.29 GB | 100,648,790 × 18 |
| `../metadata/sample_metadata.parquet` | 65 KB | 1,344 samples |
| `sources/metadata/{gene,drug,cell_line}_metadata.parquet`, `gene_vocabulary.json` | ~1.4 MB | acquired from Hugging Face |
| `sources/rhaister/` | ~2.9 GB and growing | the Rhaister release |
| `sources/publication/HF_README.md`, `LICENSE.md` | | official documentation and CC0 licence |

**Previously misfiled, now RESOLVED (2026-08-12 reorganization).** The two Replogle/Weissman
CRISPRi objects that used to sit under `Tahoe/` were moved; all three Replogle objects
(`ReplogleWeissman2022_K562_gwps.h5ad`, `..._K562_essential.h5ad`, `..._rpe1.h5ad`) now live
together in `/data/datasets/human/Replogle/`. Verified on disk 2026-08-13. Nothing
Replogle-related remains under `Tahoe/`.

### Caveats and outstanding work

- **`pdex` acquisition incomplete and the partial file is quarantined** as
  `pdex/INCOMPLETE_DOWNLOAD_all_plates_pdex.parquet.part` (unreadable — no Parquet footer). Its
  schema and the §8 validation are open. This is the single most important remaining item.
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
