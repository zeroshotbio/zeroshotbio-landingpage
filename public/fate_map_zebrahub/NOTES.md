# /fate_map_zebrahub — two maps of becoming

Built 2026-09-08 on the EC2 instance from the Zebrahub release.

- Page: `public/fate_map_zebrahub/index.html` + `zh-data.js`, `zh-atlas.js`,
  `zh-embryos.js`, `zh-axial.js`, `zh-tracks.js`, `zh-main.js` (no build step)
- Data: `{meta.json, cells.bin, embryos.json, tracks.bin}`, rebuilt with
  `python3 scripts/build_fate_map_zebrahub.py`
- Route: rewrite in `next.config.js`; look: the plate style, `PLATE_STYLE.md`


## The line this page exists to hold

Zebrahub observed development twice, and **not in the same animals**.

| | Plates I–III | Plate IV |
|---|---|---|
| what | 120,444 transcriptomes | 101,676 tracked nuclei |
| from | 40 dissociated embryos, 4 per stage | ONE other, living embryo (ZSNS001) |
| carries lineage? | **no** — each cell read once | **yes** — 36,878 divisions |
| carries expression? | yes | **no** |

So this page has to speak both vocabularies and keep them on separate plates.
Plate IV may say *divides*, *parent*, *daughter*. Plates I–III may not: those
embryos were taken apart to be read, and proximity in the embedding is
similarity of expression and nothing else. Nothing registers one side to the
other, because nothing can.

Its siblings each carry one half: `/fate_map_wang_2026` is ancestry without
expression, `/fate_map_daniocell` is expression without ancestry.


## What is deliberately absent: RNA velocity

The brief for this page asked for velocity flow and an NMP velocity centrepiece.
Neither is here, and the reason is not effort:

- The released h5ad has **no spliced/unspliced layers**, so velocity cannot be
  recomputed from it.
- The authors' velocity notebooks *are* in the code snapshot, but they read
  `velocyto_Zebrahub_115k_cells.h5ad`, `nmps_all.loom` and intermediates under
  `/mnt/ibm_lg/alejandro/...` — a lab filesystem. Their transition matrices
  (`results/tran_matrix_*.npz`) were never deposited.
- The notebooks' outputs are PNGs, not vectors; nothing is recoverable from them.

Plate III therefore shows the axial-progenitor decision as **marker composition
over time** and draws no arrows. Getting the real thing means the loom files,
which means asking the authors.


## Inputs

| What | Where | Used for |
|---|---|---|
| Combined atlas | `zf_atlas_full_v1_release.h5ad` (5.37 GB) | Plates I–III |
| Light-sheet tracks | `ZSNS001_tail_tracks.csv` (487 MB, 7,505,357 rows) | Plate IV |

Lange *et al.*, *Cell* (2024), doi `10.1016/j.cell.2024.09.047`. Data: Figshare
`10.6084/m9.figshare.20510367.v1`. Code:
[czbiohub-sf/zebrahub_analysis](https://github.com/czbiohub-sf/zebrahub_analysis).
Tracks from the authors' public endpoint, named in the `in-silico-fate-mapping`
README: `http://public.czbiohub.org/royerlab/zebrahub/imaging/single-objective/`.

Mirrored at `s3://zsb-silver-warehouse/zebrahub/`. **The atlas is verified
against Figshare's own published md5** (`c26f326d…`) — the first origin in this
warehouse that attests to its own bytes, so a passing check proves the archive is
the one the authors uploaded, not merely unchanged since acquisition.


## TRAPS

**1. `zf_atlas_15hpf` is a packaging duplicate.** Figshare ships eleven per-stage
archives for **ten** real stages. The 15 hpf file holds the same 3,862 barcodes
and the same four fish (`TDR18/19/21/22`) as 14 hpf, and the authors' own
combined atlas has no 15 hpf timepoint. Concatenating the per-stage files
double-counts it — that is how a 101,833-cell object was once produced here:

    101,833 − 3,862 (the duplicate) + 22,473 (3 dpf, then missing) = 120,444

This build reads the combined atlas and **never concatenates**, and asserts the
120,444 count as the guard.

**2. `X` is raw integer counts, not log-normalised.** The opposite of the
DanioCell GEO matrix. Marker scores are normalised to counts-per-10k and log1p'd
here; skipping that scores big cells higher than small ones.

**3. Sampling tracks every Nth frame silently drops short tracks.** 2,161 of
101,676 have no sample on a multiple of 10 and vanished — caught only because
`zhLoad()` cross-checks the header counts against `meta.json`. The build now adds
back the first row of any track that would otherwise disappear. **Keep that
check**; it is the only thing that noticed.


## Numbers the brief had, and what the data says

| brief | data | note |
|---|---|---|
| 529 annotated clusters | **336** | distinct (timepoint, cluster) pairs; `timepoint_cluster` has 51 labels reused across 10 stages |
| 120,444 cells · 40 fish · 10 stages | same | exactly 4 fish per stage, confirmed |

`uns` carries `global_annotation_colors` (10 entries) but `obs` has **no**
`global_annotation` column; the palette matches the ten anatomy classes.


## How each thing on screen is derived

- **Plate I** is the authors' own `X_umap`. Distance in it is not a quantity, and
  it has a caution the sibling pages do not: the ten timepoints were *integrated*
  before it was computed, so some apparent continuity between stages is the
  integration working rather than cells moving.
- **Plate II** stacks each animal by *share*, not count — the four embryos at a
  stage differ several-fold in yield and a raw stack would draw dissociation
  efficiency. Beneath each stage is the mean pairwise Jensen-Shannon divergence
  between the four composition vectors, in bits. This is **composition only**;
  the authors' inter-embryo divergence analysis works on gene expression.
- **Plate III** calls a cell neural if any of `sox2`/`sox3`/`sox19a` exceeds
  log1p(CP10K) > 1, mesodermal if any of `tbxta`/`tbx16`/`msgn1` does, and
  bipotent-like if both. **Our definition, the authors' markers** — the released
  object carries no NMP label. The share falls 3.36% → 0.10%, and those cells sit
  in paraxial mesoderm (292) and CNS (167), straddling the two fates.
- **Plate IV** draws the tracks that were *really* at the clicked spot at the
  current frame, backward and forward. That is the authors' in-silico fate
  mapping done with the observation instead of the radial-regression model:
  observed beats modelled where the observation exists.


## Limitations

1. **One embryo's tail, for the tracking.** ZSNS001, and the field of view is the
   tail, not the whole animal. Nothing about it generalises by itself.
2. **Composition is composition of a dissociated sample.** Plate II's shares are
   as much a function of dissociation and capture as of the animal.
3. **The inter-embryo divergences are small** — 0.009 to 0.039 bits — which is
   itself the finding: four fish of the same age look much alike by composition.
   24 hpf and 10 dpf are the widest.
4. **Plate III's threshold is a choice.** `DETECT = 1.0` in log1p(CP10K). The
   monotonic decline is robust to moving it, but the absolute percentages are not.
5. **Tracks are sampled every 10th frame** for the browser. Fine for trajectory
   shape; do not read exact division timings off this page.
