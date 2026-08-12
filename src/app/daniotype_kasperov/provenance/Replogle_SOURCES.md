# Replogle — provenance record

Genome-scale CRISPRi Perturb-seq in human cell lines. Companion to `../README.md`; this file records
**where everything came from and how far each claim is substantiated**.

**Confidence vocabulary** — used identically across all provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **Human, not zebrafish**, and **not provenanced to the depth of the other records**. Everything
> below marked CONFIRMED was measured from the local files. The upstream processing chain has *not*
> been traced — see §9. This record is honest about being partial rather than padded.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *Mapping information-rich genotype-phenotype landscapes with genome-scale Perturb-seq* |
| Authors | Replogle, Saunders, Pogson, Hussmann *et al.* — Weissman lab |
| Venue | **Cell 185, 2559–2575.e28** (2022) — [10.1016/j.cell.2022.05.013](https://doi.org/10.1016/j.cell.2022.05.013) |
| Preprint | bioRxiv [10.1101/2021.12.16.473013](https://doi.org/10.1101/2021.12.16.473013) |
| Assay | **10X Perturb-seq**, CRISPR**i** (knockdown, not knockout) |
| Purpose | Genome-scale genotype–phenotype mapping: knock down essentially every expressed gene in one cell line and read the transcriptional consequence |
| Scale | **2,547,877 cells** across three objects, two cell lines |

**Why it is in this corpus:** it is the *mirror image* of our zebrafish data — many perturbations in
one cellular context, where ZSCAPE/ChemFish/MIC-Drop have few perturbations across many cell types.
Together they bracket the compositional-generalization problem the Tahoe/Rhaister abstraction
targets (`human/Tahoe/sources/analysis/ABSTRACTION_INDEX.md`).

## 2. Canonical released data

> ### What we hold are scPerturb redistributions, not the authors' release
> The three local filenames match the **scPerturb** Zenodo record
> [13350497](https://zenodo.org/records/13350497) — *"scPerturb Single-Cell Perturbation Data: RNA
> and protein h5ad files"*, 54 files — **exactly**. The `obs` schema (`perturbation`,
> `perturbation_type`, `nperts`, `organism`, `disease`, `tissue_type`, `cancer`, `ncounts`,
> `ngenes`, `percent_mito`, `percent_ribo`) is scPerturb's harmonization standard, not the authors'.
> **CONFIRMED** by filename set identity plus schema match.

| Object | Cells | Genes | Targets | Control cells |
|---|---|---|---|---|
| `ReplogleWeissman2022_K562_gwps.h5ad` (8.81 GB) | **1,989,578** | 8,248 | **9,866** | 75,328 |
| `ReplogleWeissman2022_K562_essential.h5ad` (1.55 GB) | **310,385** | 8,563 | **2,057** | 10,691 |
| `ReplogleWeissman2022_rpe1.h5ad` (1.24 GB) | **247,914** | 8,749 | **2,393** | 11,485 |
| **Total** | **2,547,877** | | | **97,504** |

"Targets" = distinct `perturbation` values minus the `control` level. All **CONFIRMED**, measured.

| | |
|---|---|
| `X` | **dense `float32` array** — not sparse — holding **integral values, no negatives, max 431**. These are raw counts despite the dense storage. **CONFIRMED** |
| `nperts` | **0 or 1 only** — single-target throughout, no combinatorial perturbations. **CONFIRMED** |
| Cell lines | **K562** (chronic myeloid leukemia, `cancer = True`) · **RPE1** (`cancer = False`) |
| `perturbation_type` | `CRISPR` for every cell |

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | GRCh38 | **STRONGLY INFERRED** — human 10X data of this era; not verified against a GTF |
| **Stated annotation** | not recorded in the objects | **UNRESOLVED** |
| **Deposited feature universe** | **8,248 / 8,563 / 8,749** — and the three objects differ from one another | **CONFIRMED** |
| **Gene namespace** | `var` index is HGNC symbols; `var['ensembl_id']` carries ENSG | **CONFIRMED** |
| `var` extras | `chr, start, end, strand, length, class, mean, std, cv, fano, ncells, ncounts, in_matrix` | **CONFIRMED** |

> **The feature set is filtered, and by an unknown rule.** ~8.2–8.7k features is far short of a full
> human transcriptome, and the three objects do not share one universe. Whether the filtering is the
> authors' (they report a filtered expression matrix) or scPerturb's is **UNRESOLVED**. Until it is,
> **gene absence here is not biological evidence** — the same caution that applies to ZSCAPE's
> pseudogene-free space and CellOracle's protein-coding-only universe.
>
> **Our standard feature-universe test has NOT been run** against a candidate Ensembl release. That
> is the single largest gap in this record.

## 4. Processing pipeline

**UNRESOLVED throughout.** No alignment software, version, reference build, QC threshold or
replicate structure has been recovered — the paper Methods were not mined and no primary accession
was checked. What the objects themselves carry:

| Field | Present |
|---|---|
| Per-cell QC | `ncounts`, `ngenes`, `percent_mito`, `percent_ribo`, `UMI_count` |
| Replogle-specific | `core_adjusted_UMI_count`, `core_scale_factor`, `z_gemgroup_UMI`, `gemgroup` batching |
| Guide identity | `guide_id`, `gene`, `gene_id`, `gene_transcript`, `transcript` |
| Donor/sample | `batch`, `cell_barcode` |

## 5. Ground-truth annotations

**There is no cell-type axis.** Each object is a single cell line, so the biological context is
constant by construction and `celltype` appears only in the RPE1 object. This is why Replogle is a
**method reference, not a labelling target**.

The perturbation axis is the informative one: `perturbation` (gene symbol knocked down),
`guide_id`, and `nperts`. Controls are labelled **`control`** — non-targeting guides.

## 6. Important released analysis products

**None held.** The paper's derived resources — the genome-wide perturbation similarity map, the
clustered functional modules, and the transcriptional-phenotype landscape — were **not acquired**.
Only the three expression objects are local. **UNRESOLVED** whether the summary layers are
distributed in a form comparable to Tahoe's Rhaister release; if they are, they would be the
valuable part for cross-dataset work.

## 7. Provenance findings and discrepancies

| Item | Published claim | Local data / our finding | Status |
|---|---|---|---|
| Source of our copies | — | filenames match the scPerturb Zenodo record exactly; `obs` schema is scPerturb's | **CONFIRMED** — redistributions |
| Counts | — | dense `float32` but integral, no negatives — raw counts | **CONFIRMED** |
| Feature universe | — | 8,248 / 8,563 / 8,749, differing per object | **CONFIRMED**; the filtering rule is **UNRESOLVED** |
| Reference release | — | not tested against any Ensembl build | **UNRESOLVED** — standard test not run |
| Processing / QC | — | not recovered | **UNRESOLVED** |
| Misfiling (now fixed) | — | `K562_essential` and `rpe1` previously sat under `Tahoe/`; a third, `K562_gwps`, was in `Replogle/`. All three are now together in `human/Replogle/`, and the duplicate Tahoe copies were deleted 2026-08-12 after full SHA256 confirmation | **CONFIRMED** — resolved |

## 8. Local assets

| File | Bytes |
|---|---|
| `../ReplogleWeissman2022_K562_gwps.h5ad` | 8,805,466,154 |
| `../ReplogleWeissman2022_K562_essential.h5ad` | 1,546,729,675 |
| `../ReplogleWeissman2022_rpe1.h5ad` | 1,236,886,900 |

No `sources/` subtree was built — there is nothing acquired to file into one yet. No checksums
computed. No canonical H5AD built: the three objects are already analysis-ready and there is no
merge that would not destroy the per-object feature universes.

## 9. Caveats and outstanding work

This record is **deliberately partial**. To bring Replogle to the standard of the zebrafish records:

- **Run the feature-universe test.** Which Ensembl release, and whose filtering rule produced
  8,248 / 8,563 / 8,749? This is the first thing to do and the most consequential.
- **Trace the chain to the authors' release** — the original GEO/accession, and what scPerturb
  changed. Nothing here has been compared against the primary deposit.
- **Mine the Cell paper's Methods** for alignment, QC thresholds and replicate structure.
- **Establish whether summary statistics are distributed** in a Rhaister-comparable form.
- **Verify guide-level detail** — guides per target, assignment thresholds, and how multi-guide
  cells were handled, given `nperts` never exceeds 1.
- Compute checksums.

---

## Cross-dataset provenance principles

Applies to every dataset in this corpus; substantially identical in all `sources/README.md`
records. (Written for the zebrafish corpus; items 1–5 and 7 apply unchanged to human data, and
item 6's "stage definitions" reads as "dose, timepoint and cellular context" here.)

1. **The deposited feature universe is evidence; the paper's reference claim is a hypothesis.**
   Gene IDs and feature counts are tested against candidate references before any harmonisation.
   *(Not yet done here — see §9.)*
2. **Published reference claims and deposited data can disagree.** ZSCAPE, ZCL 2.0 and MIC-Drop-seq
   each carry a stated or assumed reference that the released features contradict or fail to
   support. Verification precedes downstream mapping, always.
3. **Canonical author releases outrank our older derived objects.** Every derived H5AD must have a
   reproducible build script and a `uns['provenance']` stamp; superseded objects are retained rather
   than overwritten, so prior results stay reproducible. *(Here: what we hold is a third-party
   redistribution, which outranks nothing — the authors' release has not been obtained.)*
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
