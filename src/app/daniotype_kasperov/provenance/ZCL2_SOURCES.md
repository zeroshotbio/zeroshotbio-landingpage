# ZCL 2.0 / ZCDL — provenance record

Zebrafish Cell Landscape / Zebrafish Cell Developmental Landscape — a wild-type life-span atlas.
Companion to `../README.md`, which describes dataset *contents*; this file records **where
everything came from and how far each claim is substantiated**.

**Confidence vocabulary** — used identically across all five provenance records:

| Label | Meaning |
|---|---|
| **CONFIRMED** | stated in a primary source, or measured directly from the released data |
| **STRONGLY INFERRED** | not stated, but the only reading consistent with the evidence |
| **RECONSTRUCTED** | derived independently to exact agreement, but never stated anywhere |
| **UNRESOLVED** | open; neither the published record nor the data settles it |

> **Observational, not perturbational.** A five-stage wild-type life-span atlas. It is a reference
> and label-transfer target, not a perturbation-response dataset.

---

## 1. Dataset identity

| | |
|---|---|
| Title | *Construction of a cross-species cell landscape at single-cell level* |
| Authors | Han, Guo *et al.* — Zhejiang University School of Medicine |
| Venue | **Nucleic Acids Research 51(2):501–516 (2023)** — [10.1093/nar/gkac633](https://doi.org/10.1093/nar/gkac633), PMC9881150, PMID 35929025 |
| Portals | ZCL <https://bis.zju.edu.cn/ZCL/> · Cell Landscape <https://bis.zju.edu.cn/cellatlas/> |
| Assay | **Microwell-seq**, beads **3.0** (mice used beads 2.0); whole cells |
| Purpose | Organism-level cell landscape across the life span, as the zebrafish arm of a three-species (mouse, zebrafish, *Drosophila*, >2.6 M cells) study |
| Scale | **1,088,106 cells · 5 stages · 143 clusters** |
| Perturbations | **none** — wild-type only |

Stages: **24 hpf · 72 hpf · 21 day · 3 month · 22 month** — the only atlas in this corpus reaching
adult and aged animals.

Only the zebrafish arm is relevant here.

### Accessions — the paper's citation is incomplete

| Series | Contents | Parent |
|---|---|---|
| **GSE198832** | the accession the paper prints | SuperSeries: GSE153562 (mouse) · **GSE198571** · GSE198831 (*Drosophila*) |
| **GSE198571** | zebrafish **21 d + 22 m**, 93 samples | SubSeries of GSE198832 ✔ |
| **GSE178150** | zebrafish **24 hpf + 72 hpf + 3 m**, 106 samples | SubSeries of **GSE178151** — *"Construction of the whole animal at a single cell resolution"*, BioProject PRJNA737474 |

**Three of the five zebrafish stages are unreachable from the accession the paper cites.**
GSE178150 sits under a different SuperSeries belonging to a different study and is never named in
the NAR paper. **CONFIRMED** from the GEO records. Both tars are held locally (199 GSMs total).

## 2. Canonical released data

| | |
|---|---|
| Data | Figshare article **20363190 v8** — [10.6084/m9.figshare.20363190.v8](https://doi.org/10.6084/m9.figshare.20363190.v8) |
| Code | [ggjlab/cell_landscape](https://github.com/ggjlab/cell_landscape) — filed under `code/` |

Figshare publishes `ZCDL.rdata`, `ZCDL_cellinfo.csv` and five per-stage
`ZCDL_{24hpf,72hpf,21d,3m,22m}_raw.rdata`. Two files are canonical:

| File | SHA256 | Contents |
|---|---|---|
| `ZCDL.rdata` (2,768,604,764 B) | `54afb2d21bae685fc6866bc6a46ab3306a2b7330f37057f7e01fe2cdf1b0da9d` | one object `pbmc` — **Seurat v4.0.2**, RNA assay, **27,538 genes × 1,088,106 cells**, **raw integer counts** (max 587, 627,152,947 nonzeros). `counts` and `data` are **identical**, so the object is *not* normalized. `scale.data`, reductions and commands are all empty. `meta.data` carries only `orig.ident` (constant), `nCount_RNA`, `nFeature_RNA`, `stage` |
| `ZCDL_cellinfo.csv` (108,012,508 B) | `e59310f35c3d185c8551e84e6224bcbcf698f7868d22e9b421efa3fa3955e7f8` | **1,082,680 rows** — `barcodes, cluster, stage, cell_type, cell_lineage, tsne_x, tsne_y`. Zero nulls |

> ### Correction to our own docs
> `../README.md` and the dataset card recorded ZCL2 as having **no annotations**. **That is wrong.**
> The annotations are complete — they simply live in the companion CSV rather than inside the Seurat
> object. 143 clusters, 41 cell types, 10 lineages, t-SNE coordinates, no missing values.

### Cell-count reconciliation — closed

| Figure | What it counts |
|---|---|
| **1,088,106** | `ZCDL.rdata`, **and** the exact sum of the paper's five per-stage figures (24 hpf 44,932 · 72 hpf 159,128 · 21 d 121,954 · 3 m 431,168 · 22 m 330,924) |
| **1,082,680** | `ZCDL_cellinfo.csv`, **and** the figure in the paper's abstract and text |
| **5,426** | the difference — cells present in the object but carrying no published annotation |

**The paper is not inconsistent**: the two numbers count different populations — the full released
object versus the annotated atlas. **CONFIRMED.** The 5,426 unannotated cells span all five stages
(22 m 3,290 · 21 d 947 · 3 m 748 · 72 hpf 280 · 24 hpf 161) and are retained in our rebuild under
`in_published_atlas = False`.

### Barcode parsing — a trap

Barcodes are `<batch>_<SAMPLE>.<18nt>` for 3 Month, 24 hpf, 72 hpf and 21 Day, but
**`<SAMPLE>.<18nt>` for 22 Month** — that stage has no batch prefix. A single regex assuming the
prefix silently returns **zero** samples for 22 Month.

Worse, **`COL` sample ids are reused across stages — 72 of 84** (`COL100` is both a 22 Month and a
72 hpf library). **`(stage, sample)` is the key; `sample` alone is not.**

## 3. Reference genome and feature universe

| Layer | Value | Confidence |
|---|---|---|
| **Genome assembly** | **GRCz11** | **CONFIRMED** (Methods, verbatim) |
| **Stated annotation** | *none* — no GTF or Ensembl release is named in the paper, the Supplementary Methods or the repo | **UNRESOLVED** |
| **Deposited feature universe** | **27,538 features** in `ZCDL.rdata` (our older partial object carried 27,744 — a union over its 40 GEO libraries) | **CONFIRMED** |
| **Gene namespace** | **GRCz11 Ensembl gene *symbols***, including clone-based names (`AL590150.1`, `AL645691.2`). **No ENSDARG ids are published anywhere in the release** | **STRONGLY INFERRED** — 93.6% of names are present in the Ensembl 99 symbol set we hold, and the clone-name convention is Ensembl's |
| **Custom transformation** | none documented | **UNRESOLVED** |

> **Do not assume Ensembl 99.** The 93.6% figure dates the namespace to *an* Ensembl release and no
> further. Nothing here is inferred from ZSCAPE, ChemFish or DanioCell.

**The repository contains no alignment code** — `ggjlab/cell_landscape` holds downstream analysis
only (`Analysis_code/Figure1..N`). The reference recipe is not reproducible from published material.

The absence of ENSDARG ids is the practical barrier for this dataset: integration must go through
symbols, which is lossier than every other atlas in the corpus.

## 4. Processing pipeline

Verbatim from the Methods:

> "Reads from three species were aligned to the *Mus musculus* GRCm38 genome, ***D.rerio* GRCz11
> genome** and *D.melanogaster* BDGP6.28 genome using **STAR**. The digital gene expression (DGE)
> data matrices were obtained using the **modified Drop-seq tools**
> (`https://github.com/ggjlab/mca_data_analysis/tree/master/preprocessing/Drop-seq_tools-1.12/`)"

| Stage | Value | Confidence |
|---|---|---|
| Aligner | **STAR**, version not stated | **CONFIRMED** / version **UNRESOLVED** |
| Counting | modified **Drop-seq tools 1.12** | **CONFIRMED** |
| Cell barcode | built by **three rounds of split-pool** synthesis; **18 nt** in the released data, uniform across all 1,082,680 barcodes → 3 × 6 nt | **CONFIRMED** (length measured; 3 × 6 split inferred) |
| UMI | present in oligonucleotide C, **length not stated**, not recoverable from a DGE | **UNRESOLVED** |
| Sequencing | Illumina HiSeq or MGI DNBSEQ-T7; **150 bp read 1 + 150 bp read 2** | **CONFIRMED** |
| Annotation method | Seurat clustering then manual marker-based annotation | **CONFIRMED** |
| Downstream framework | Seurat (LogNormalize 1e4, 2,500 HVG, `dims 1:50`, `resolution 1`) + Scanpy | **CONFIRMED** |

The Supplementary Methods PDF is **wet-lab only** — no bioinformatics section, no GTF, no Ensembl or
GRCz reference, no aligner settings.

### QC — three sources that do not agree

**Paper Methods:**
> "The DGE data containing the **top 10 000 cells** sorted by the total number of transcriptions were
> obtained after this pre-process. For quality control, we filtered out cells with the detection of
> **< 500 transcripts and 200 genes**. Cells with a high proportion of transcript counts derived from
> mitochondria-encoded genes were also excluded. We corrected the RNA contamination using the same
> methods described previously. Then we used the R package **DoubletFinder** … Approximately **5%**
> of cells were labeled doublets and were removed."

**Authors' code** (`code/cell_landscape-main/Analysis_code/Figure1/Pre_processing.R`): 500-UMI
background/ambient split (cells < 500 UMI become the background profile and are excluded),
`percent.mt < 20`, LogNormalize 1e4, 2,500 HVG, `FindNeighbors dims 1:50`, `FindClusters
resolution 1`, DoubletFinder `pN = 0.25`, `nExp` = 5%, Singlets retained.

**Released object:** `nCount_RNA` min **63**, `nFeature_RNA` min **27**.

| Discrepancy | Detail | Status |
|---|---|---|
| **The released atlas is pre-QC** | minimum 63 UMI / 27 genes sit far below the stated "< 500 transcripts and 200 genes", so the published thresholds were **not** applied to `ZCDL.rdata` | **CONFIRMED** |
| **The mitochondrial filter is a no-op** | `PercentageFeatureSet(pattern = "^mt:")` matches **0** zebrafish genes. Zebrafish mito genes use the `mt-` prefix — 13 are present (`mt-atp6, mt-atp8, mt-co1…mt-nd6`). `^mt:` is the FlyBase/*Drosophila* convention, inherited unchanged from this cross-species script. `percent.mt` is therefore **0 for every zebrafish cell** and `< 20` excludes nothing | **CONFIRMED** |
| **Top-10,000 vs top-20,000** | the paper says the DGEs keep the top 10,000 cells by total transcripts; every GEO DGE file we hold contains **exactly 20,000** | **UNRESOLVED** |
| RNA-contamination correction | cited only as "the same methods described previously"; no code in the repo | **UNRESOLVED** |

### Table S1 average UMI / gene — verified, and where it fails

`analysis/tableS1_zebrafish_seqinfo.csv`, checked against `../zcl2_canonical.h5ad`:

| Stage | S1 UMI | ours | S1 gene | ours | |
|---|---|---|---|---|---|
| 24 hpf | 1164.0 | **1164.5** | 629.4 | **629.4** | ✔ |
| 72 hpf | 1055.0 | **1055.2** | 570.2 | **570.2** | ✔ |
| 21 day | 948.5 | **948.5** | 506.7 | **506.7** | ✔ exact |
| 3 m | 2095.0 | 1666.4 | 682.5 | 602.4 | ✘ |
| 22 m | 2647.0 | 2056.0 | 642.5 | 563.9 | ✘ |

Three stages reproduce **to the decimal**, independently confirming that our rebuild is faithful and
that `ZCDL.rdata` is the object behind Table S1. **The two adult stages do not**, and ours are
*lower* in both. Restricting to annotated cells does not close it (3 m 1668.3, 22 m 2075.1). The
obvious explanation — that Table S1 was computed on the higher-depth GEO top-N deposit — is
**refuted**: those averages are lower still (3 m 1025.7, 22 m 775.9). **UNRESOLVED**, confined to
3 m and 22 m.

## 5. Ground-truth annotations

**Authoritative file: `ZCDL_cellinfo.csv`** — it is the annotation attached to the cells, and it is
what our canonical object carries. Where it conflicts with Supplementary Table S1, **cellinfo
wins**, and any scoring run must declare which source it scored against.

Every one of the 143 clusters is **pure** in `ZCDL_cellinfo.csv` — one `cell_type` and one
`cell_lineage` per cluster — so **cluster is the atomic annotation unit** and the hierarchy is a
strict chain.

| Tier | Cardinality |
|---|---|
| `cluster` | **143** |
| `cell_type` | **41** |
| `cell_lineage` | **10** — Epithelial 474,911 · Immune 173,910 · Neuron 173,794 · Stromal 119,556 · Muscle 31,427 · Germ 29,112 · Erythroid 23,362 · Secretory 20,643 · Endothelial 18,051 · Other 17,914 |

No ZFA/CARO ontology ids; labels are free-text.

### Two conflicting published annotations

Table S1 sheet *"Annotation for ZCDL"* annotates the same 143 clusters differently, with marker genes
and a label-transfer mapping onto ZCL 1.0 (`Tissue.Cell_type`, with mean AUROC per cluster).

| | Agreement |
|---|---|
| `cell_lineage` | **135 / 143** |
| `cell_type` | **113 / 143** |

Most conflicts are granularity or synonym (`C10_Neuron` vs `Neural cell`, `C48_Mucosal muscle cell`
vs `Muscle cell`); **C8 and C11 are outright swapped** (Epithelial cell ↔ Keratinocyte); and C34 is a
real disagreement (`Hepatocyte`/Epithelial vs `Mt-rich cell`/Other). Table S1's 143 labels collapse
to only **38** distinct types against the CSV's 41, and neither set contains the other.

Per-cluster comparison: `analysis/cluster_annotation_tableS1_vs_cellinfo.csv`.

## 6. Important released analysis products

| Product | Where | Contents |
|---|---|---|
| **Cell annotation table** | `ZCDL_cellinfo.csv` | per-cell cluster / cell_type / cell_lineage / t-SNE for 1,082,680 cells |
| **Per-cluster markers** | Table S1 *"ZCDL markers for 143clusters"*; filed at `analysis/tableS1_annotation_for_ZCDL.csv` | marker genes per cluster |
| **ZCL 1.0 label transfer** | same sheet | `Tissue.Cell_type` mapping with **mean AUROC per cluster** — a rare published transfer-quality metric |
| Per-stage sequencing metrics | Table S1 *"Sequencing information"*; `analysis/tableS1_zebrafish_seqinfo.csv` | average UMI and gene count per stage |
| Stage contribution | Table S1 *"Stage contribution"* | per-stage composition |

Table S1 is recorded for its markers and its ZCL 1.0 transfer, **not** as a label source.

## 7. Provenance findings and discrepancies

| Item | Published claim | Deposited data / our finding | Status |
|---|---|---|---|
| Annotations | our docs said "none" | complete 143 → 41 → 10 hierarchy in the companion CSV | **CONFIRMED correction** |
| Cell counts | abstract 1,082,680; per-stage figures sum to 1,088,106 | both are real and count different populations; gap = 5,426 unannotated cells | **CONFIRMED** reconciliation |
| GTF / Ensembl release | none stated | namespace is 93.6% Ensembl-99 symbols; no ENSDARG published | **UNRESOLVED** |
| QC thresholds | "< 500 transcripts and 200 genes" | released object has min 63 UMI / 27 genes | **CONFIRMED** the release is pre-QC |
| Mitochondrial filter | "high mitochondrial proportion excluded" | `^mt:` matches 0 zebrafish genes — the filter is a no-op | **CONFIRMED** |
| Cells per DGE | "top 10 000" | every GEO DGE holds exactly 20,000 | **UNRESOLVED** |
| Table S1 averages | five stages | 3 of 5 reproduce to the decimal; 3 m and 22 m do not, and the deposit explanation is refuted | **UNRESOLVED** |
| Annotation sources | Table S1 and cellinfo | disagree on 30/143 cell types, 8/143 lineages; C8/C11 swapped | **CONFIRMED** conflict — use cellinfo |
| Accession coverage | paper cites GSE198832 | 3 of 5 stages live in GSE178150 under a different SuperSeries | **CONFIRMED** |
| Our old `zcl2.h5ad` | — | 40/199 libraries, 2 of 5 stages, 68.5% recovery of its own libraries' canonical cells, ~40% for 22 m | **UNRESOLVED** (22 m), superseded |

## 8. Local assets

### `../zcl2_canonical.h5ad` — canonical

Built by `code/build_zcl2_canonical.py` from `code/export_zcdl_rdata.R` (R cannot hand a 627 M-nnz
`dgCMatrix` to Python directly, so counts move through flat binaries).

| | |
|---|---|
| Cells × genes | **1,088,106 × 27,538** |
| `X` | **raw integer counts**, float32 CSR, 627,152,947 nonzeros |
| `obs` | `nCount_RNA, nFeature_RNA, stage, sample, batch, cluster, cell_type, cell_lineage, in_published_atlas` |
| `obsm` | `X_tsne` — the authors' coordinates; NaN for the 5,426 unannotated cells |
| `uns` | `provenance` — paper DOI, Figshare DOI, both GEO lineages, source SHA256s, and the QC/namespace caveats above |
| Annotated | **1,082,680 / 1,088,106** |

Validated on read-back: row sums equal `nCount_RNA` and per-row nonzero counts equal `nFeature_RNA`
for every cell checked, values are integral, and finite t-SNE rows number exactly 1,082,680.

### `../zcl2.h5ad` — superseded, retained

800,000 cells × 27,744 genes; `obs` = `stage`/`sample`/`gsm` only; **empty `var`**; no annotations.

- **exactly 40 GSMs × 20,000 cells** — the GEO deposit's per-library cap, **not** a subsample of ours
  (`GSM5380997_Zebrafish_3m_COL3_dge.txt.gz` is itself exactly 20,000 × 24,213). **CONFIRMED**
- covers **only 3 m and 22 m**; 24 hpf, 72 hpf and 21 d absent entirely
- holds **157,640 (68.5%)** of the 230,152 canonical cells belonging to its own 40 libraries
- recovery is stage-split: 3 m ≈ 96–100% per library, **22 m ≈ 40%** — **UNRESOLVED**

**Retained, not overwritten**, so prior results stay reproducible.

### Other

`sources/publication/nar_gkac633_fulltext.xml` · `sources/supplementary/gkac633_supplemental/`
(Methods PDF, Figures PDF, Tables S1–S8) · `sources/data/` (both canonical files) ·
`sources/code/cell_landscape-main` + our two build scripts · `sources/analysis/` (three derived
tables) · GEO tars `../GSE178150_RAW.tar`, `../GSE198571_RAW.tar`.

## 9. Caveats and outstanding work

- **The released atlas is pre-QC.** Do not assume the paper's thresholds hold; the mito filter in
  particular excludes nothing.
- **Two published annotations disagree on 30/143 clusters.** Declare which one any score used.
- **GTF / Ensembl release, STAR version, UMI length and the RNA-contamination method are unresolved**
  and probably not closable — paper, Supplementary Methods and repo are all silent.
- **Table S1's adult UMI/gene averages are not reproduced**, with the obvious explanation refuted.
- **No ENSDARG ids anywhere.** Cross-dataset integration must go through symbols.
- **Retire `zcl2.h5ad`** once we are confident; no consumers were found on the box.
- Per-stage `ZCDL_*_raw.rdata` files not downloaded — the combined object supersedes them.

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
