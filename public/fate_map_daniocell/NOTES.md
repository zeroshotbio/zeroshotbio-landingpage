# /fate_map_daniocell — five days of becoming a fish

Built 2026-09-08 on the EC2 instance from the DanioCell release.

- Page: `public/fate_map_daniocell/index.html` + `dc-data.js`, `dc-landscape.js`,
  `dc-score.js`, `dc-programs.js`, `dc-cascade.js`, `dc-main.js` (no build step)
- Data: `public/fate_map_daniocell/{meta.json, cells.bin, clusters.json,
  programs.json, cascades.json}`, rebuilt with
  `python3 scripts/build_fate_map_daniocell.py`
- Embeddings: extracted **once** by `scripts/extract_daniocell_seurat.R` from the
  portal Seurat object. R is never needed again; the build reads CSVs.
- Route: rewrite in `next.config.js` (`/fate_map_daniocell` → `.../index.html`)
- Look: the plate style, see `PLATE_STYLE.md` at the repo root.

Four plates read top to bottom: where the states sit, how long each lasts, which
programs are shared, and one inferred trajectory.


## What the picture claims — and the line this page must not cross

**Nothing here is lineage.** DanioCell dissociates each embryo and reads each
cell once. Two cells adjacent in Plate I are expressing similar genes. They are
not relatives, and no plate on this page — Plate IV included — observed any cell
turning into another.

This matters more than usual because the sister page
`/fate_map_wang_2026` draws *physical ancestry* from tracked nuclei and is
entitled to say "descends from". Do not let the two pages borrow each other's
vocabulary. On this page:

| banned | correct |
|---|---|
| descends from, ancestor, daughter, lineage, born | state, identity, program, trajectory, inferred |

**Plate IV is inferred.** URD reconstructs an ordering from expression alone.
Pseudotime is a statistical arrangement of a snapshot population, not elapsed
time, and the branch is a claim about transcriptional structure.


## The measure that is easiest to misrepresent

`persistence.avg.stage.diff` is **not** how long a cluster exists. It is a
**per-cell** statistic: for each cell, the authors found the cells within a fixed
distance (epsilon) in gene-expression space and took the mean **absolute
developmental-stage difference** between that cell and those neighbours. It
answers *"how far apart in developmental time are the cells that look like this
one"*, and it was computed **within tissue subsets**, not globally. Every cluster
carries a distribution of it, never a single value.

Plate II therefore draws two different quantities and keeps them apart:

- **rule length** = the OBSERVED extent, the 2nd–98th percentile of the stages at
  which the state's cells were actually collected (hairlines to the extremes).
  A fact about sampling.
- **ink weight** = the AUTHORS' persistence measure, median over the state's
  cells. A fact about transcriptional similarity.

A long rule in light ink is a state seen across much of development whose early
and late cells do *not* resemble one another. That mismatch is the most
interesting thing on the plate and it only exists because the two measures are
not collapsed into one bar. **Never merge them.**


## Inputs

| What | Where | Used for |
|---|---|---|
| Per-cell metadata | GEO `GSE223922_Sur2023_metadata.tsv.gz` (489,686 rows) | persistence, cell cycle |
| Global + 19 tissue UMAPs | portal `Daniocell2023_SeuratV4.rds` (2,231,805,865 B) | Plate I, and `hpf` |
| Cluster annotations | portal `cluster_annotations.csv` (521 rows) | identities, ZFA terms |
| Table S5 | `mmc6.xlsx` — 146 module rows | Plate III |
| Table S6 | `mmc7.xlsx` — two URD cascades | Plate IV |

Sur, Wang, Capar, Margolin, Prochaska & Farrell, *Developmental Cell* **58**,
3028–3047.e12 (2023), doi `10.1016/j.devcel.2023.11.001`. Code
[farrelllab/2023_Sur](https://github.com/farrelllab/2023_Sur) (CC0).

All artifacts are mirrored, with SHA256 manifests, at
`s3://zsb-silver-warehouse/daniocell/`. Every file used here was fetched
independently from GEO / the portal / PMC **and** verified byte-identical
against that mirror. The Seurat object's sha256 is checked in the colophon.


## THE TRAP: Table S6's sheet name has the branches backwards

`iSMCs_circular_longitudinal` is **not** the column order. Two things must be
read out of the sheet rather than assumed:

1. **The pseudotime header is non-monotonic**, and where it falls back is where
   one run ends and the next begins: a **37-point shared trunk** (0.253→0.576),
   then branches of **16** (0.570→0.649) and **15** (0.574→0.649) points. That is
   the bifurcation, and it is the only place the branch structure is recorded.
2. **Branch identity comes from markers, not from the name.** At the branch tips,
   branch A carries `il13ra2` at 0.95 (vs 0.07) so it is the putative
   **longitudinal** layer; branch B carries `fsta` 0.87, `kcnk18` 0.92,
   `foxf2a` 0.87 so it is the **circular** layer. Both marker sets are the
   paper's own (Figure 5G, 5I). The build re-derives this every run and
   **exits** if the markers stop separating the branches.

Taking the sheet name at face value would have labelled both branches wrong, and
nothing on the page would have looked broken.


## Numbers that do not reconcile, and what this page does about them

1. **Stages.** The paper says **62** throughout. The Seurat object's own `hpf`
   column holds **65** distinct collected stages, which is exactly what Table
   S1's sample list expands to once the pooled MULTI-seq libraries
   ("26, 28, 30, 32, 34, 36 hpf" in one row) are unfolded. The GEO metadata's
   `stage.integer` bins to **63**, because the five fractional early Drop-seq
   stages (3.3, 3.8, 4.3, 4.8, 5.3) truncate onto three integers. This page uses
   the object's 65 and says so.
2. **Gene programs.** Table S5's caption says **147**; the sheet holds **146**
   rows (IDs `FC_1`–`FC_200`, non-contiguous). Of those, 93 are marked shared,
   22 marked for exclusion and 5 "unsure". The paper separately describes
   eliminating 57 of 147, implying 90 retained. None of these is the sometimes-
   quoted 87. The page counts what is in the table, states the rule, and quotes
   no figure it cannot reproduce. The publisher's `mmc6.xlsx` and the PMC author
   manuscript were compared and are identical, so the 147 is the paper's own
   off-by-one, not a transcription error.
3. **Drawable programs.** 93 modules are marked shared, but only **65** name two
   or more of the nineteen subsets after normalisation and can be drawn as a
   figure. The rest name one subset plus prose, or only prose. The plate reports
   "65 drawn of 93 shared" rather than hiding the gap.
4. **Tissues.** `subset.full` has **20** values; the atlas's own reclustering has
   **19**. The extra is `cephalic`, which has 3,191 cells, no subset UMAP and no
   annotation row. It is kept and marked, the way `/dev_tree` keeps it.


## Limitations found along the way

1. **The GEO count matrix is log-normalised, not raw UMIs.** It does not affect
   these four plates, which use metadata, embeddings and the supplementary
   tables — but it will bite anything that normalises again. FASTQs are under the
   same accession if raw counts are what you need.
2. **Plate III's edges are a curated reading, not a computed matrix.** They come
   from the authors' free-text "Tissue(s) expressed" column, normalised onto the
   19 subsets by `TISSUE_ALIASES` in the build script — 51 distinct tokens for 19
   tissues, plus about twenty prose entries ("lots of tissues", "almost all
   others"). Prose becomes a *broadly deployed* flag and **no edges**; inventing
   nineteen edges for it would be a fiction shaped like data. The binary module ×
   cell-type matrix behind the paper's Figure 3A is not in the deposit. The build
   **exits** on an unmapped token rather than silently dropping it.
3. **The URD tree topology is not deposited.** Only the cascades are. Plate IV can
   therefore show the branch point that Table S6 encodes and the gene cascade
   along each arm, but not the force-directed tree the paper draws. Getting that
   would mean re-running the authors' R from the counts, or asking them.
4. **Abundance is abundance in a dissociated sample.** How many cells a state has
   in Plate I is a function of dissociation efficiency and capture as much as of
   the embryo. Do not read it as how much of the animal that state is.
5. **UMAP distance is not a quantity.** Two populations far apart are not "more
   different" by any stated amount, and a population that appears to move between
   stages is one whose expression changed, not one that travelled.
6. **Nineteen tissues cannot have nineteen honest hues.** The legend is ink; a
   wash is assigned only on isolation, in isolation order, so the colours on the
   plate always match the colours in the legend however many are lit. Do not
   hand out twenty fixed colours.
7. **One `≥` cost a render.** That glyph, like `→` and `↔` on the Wang page, is
   missing from these font stacks and draws as a blank. Say it in words.
