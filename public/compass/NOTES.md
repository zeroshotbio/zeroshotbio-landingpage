# /compass — implementation note

A plate-style figure page (see `PLATE_STYLE.md`) reporting our reproduction of COMPASS
(Liang & Singh 2026, bioRxiv 10.64898/2026.08.03.742643) on the six human CRISPRi lines, and
holding it against Tahoe-100M and ChemFish. It replaces the earlier ChemFish "flotilla" app at
this route (`src/app/compass/` removed; an app route would shadow the rewrite).

## Files

| file | role |
|---|---|
| `index.html` | shell, tokens, typography, seven `figure.plate` blocks, notes, colophon |
| `cp-data.js` | loads `meta.json` + `plates.json`; refuses a pair whose `asset_version` (sha256[:12] of plates.json) disagrees; shape checks |
| `cp-draw.js` | canvas setup (parent width, dpr ≤ 2), pen-wobble furniture, axes, text |
| `cp-plates.js` | one function per canvas |
| `cp-main.js` | bootstrap, interactions (exemplar switch, isolate legends, cluster card), every caption — all numbers read from `meta.json` |
| `meta.json`, `plates.json` | written by `scripts/build_compass.py` from the reproduction repo (commit recorded in `meta.source`) |
| `cp-code.js`, `code.json` | the "show the code" pane beside every plate; `code.json` is written by `scripts/build_compass_code.py` |

The reproduction repo is `github.com/zeroshotbio/compass_reproduction` (**private**, by decision), cloned at
`/data/experiments/compass_reproduction`. It was built at `/data/scratch/compass_repro` on another machine
(r7i.4xlarge), which is why its scripts still name that path.

Rebuild: `python3 scripts/build_compass.py` (stdlib + numpy; `COMPASS_REPRO` overrides the clone path). It reads
`results/**` and `results/page/plate1..5.json`; never hand-edit the JSON.

## Focused layout (2026-09-12)

At the user's request the page shows only Plates I, III and V, with captions and intro cut to about a quarter
(visible words 5,066 → 343). Plates II, IV, VI–IX and the notes live in a closed `<details id="archive">` at the
bottom, unchanged; `cp-main.js` redraws them when it opens (canvases drawn while shut have no width). Plate
numbers are kept so the archived plates' cross-references and the code panes still line up.

## Code panes

`scripts/build_compass_code.py` (stdlib only; needs git and the aws CLI) writes `code.json`: per plate, a notebook
from the raw files to the plate's numbers. The rules that make it worth showing a skeptic:

- **Code cells are quoted, never typed.** Each is pulled with `git show` from a pinned commit (reproduction
  `a700359`, the authors' `compass` `fb4c9e1`, `tahoe_compass` `cefd298`, or this repo's `cp-plates.js`), by symbol
  name or by a line range whose first line must contain an expected string. A moved line fails the build.
- **Out cells are read from the committed results and checked against the page.** Every value is compared with
  `meta.json` / `plates.json` at the precision the page prints; one mismatch stops the build. (The first build
  caught Plate V's "about 100 in the hardest line": HEK293T is 94% of draws at 100, 100% at 300. Caption fixed.)
- **Provenance is cross-checked.** Input sha256s in `reproduction_meta.json` are compared at build time with
  the `SHA256SUMS` in `s3://zsb-open-source`. Inputs the reproduction never fingerprinted (Tahoe plate files,
  the MegaFin/MiniFin gold objects) are shown as not recorded, not as verified.
- The one uncommitted input is the Tahoe position-test summary (`tahoe_compass/results/` is git-ignored); the
  pane names its sha256 and timestamp.
- The repo is private, so excerpts carry `file · lines · commit` with no link; the authors' public package links
  to GitHub at the pinned commit.

Rebuild the panes after any change to the reproduction, the page's numbers, or `cp-plates.js` (commit first:
the build refuses to quote an uncommitted page file).

## Plates and what feeds them

| plate | canvases | source in `compass_repro` |
|---|---|---|
| I · one response, two parts | `cvDecomp`, `cvVector` | `11_page_assets.py` → `results/page/plate1.json` (RPE1 u over the group top-2,000 panel; three exemplars chosen by a stated rule: RPL27, PSMC4, NPAT) |
| II · the reproduction | `cvCont`, `cvLedger`, `cvBudget` | `03_geometry.py` (m, a, s; Kendall's W; `results/geometry_*.tsv`), `04_decomposition.py` (β pairs, transfer, CompassX Table 3, budget; `results/decomposition_*`, `beta_conservation_*`, `transfer_loco_*`, `compassx_*`), paper values transcribed in `build_compass.py:PAPER`; figs 1–4 |
| III · the shared axis | `cvSpectrum`, `cvSig` | `06_biology.py` (u over all protein-coding genes, hallmark/curated signatures, R²; `results/biology_*`), `11_page_assets.py` (silhouettes, programme rugs) → `plate3.json`; fig 6 |
| IV · residual biology | `cvResid`, `cvReliab` | `06_biology.py` residual clustering + Enrichr terms, `11_page_assets.py` t-SNE layout → `plate4.json`; split-half reliability from `04_decomposition.py`; fig 7 |
| V · why it can be seen | `cvCount`, `cvStrength`, `cvDepth`, `cvLanes` | `09_comparison_table.py` → `dataset_comparison.tsv`; effect/noise histograms from `05_stress.py` + `07b`/`07c` → `plate5.json`; `cvLanes` is a schematic (control share of K562 is real; Tahoe's 2 DMSO wells per 96 as deposited) |
| VI · when it falls apart | `cvPhase`, `cvDepthSweep`, `cvRemove`, `cvControls` | **new** `12_phase.py` (n × k grid) and `13_depth.py` (UMI thinning); `05_stress.py` (removal of top loaders, control reference, detectability); fig 5 |
| VII · Tahoe & ChemFish | `cvTahoe`, `cvThree` (MegaFin added), `#cmpTable` | `07b`–`07f` (Tahoe axis, dose tiers, DMSO-well pseudo-drug test; ChemFish accumulate/axis), `dataset_comparison.tsv`, MiniFin/MegaFin design facts in `build_compass.py:ZEROSHOT`; figs 8–9 |

| VIII · our own screens | `#finTable`, `cvFinWells`, `cvFinDose`, `cvFinRep`, `#lessons` | **new** `14_fin_aggregate.py`, `15_fin_measure.py [hvg|expressed]`, `16_fin_replication.py` → `results/fin/` (write-up `results/fin/FIN_READINESS.md`), read by `build_compass.py:fin()` |

## MegaFin / MiniFin readiness (Plate VIII)

Stages 14–16 in the reproduction measure, on the gold `parse/v1` objects (clusters as contexts), every
check the page applies to CRISPRi and Tahoe: cells per cell type, the COMPASS split, the no-drug-well
test on MegaFin's own no-drug pairs, a single-well noise floor, the dose check, MiniFin's replicate-well
noise, the MiniFin–MegaFin bridge, and a projection of how many wells per drug would be enough. Headline
panel plus a most-expressed-genes panel. Verdict: MegaFin has the size but fails the artefact checks;
what it lacks is replicate wells.

## New experiments run for this page (Plate VI)

1. **Perturbations × cells phase grid** (`12_phase.py`, results in `results/phase_grid.tsv`, `results/phase_summary.tsv`).
   For n ∈ {10, 30, 100, 300, 1000, 2317} perturbations and at most k ∈ {2, 5, 10, 25, 50, 100, all}
   cells each, rebuild every line's axis and β from the draw (30 seeded draws per cell, same
   perturbations in all lines) and score cross-line β agreement (mean pairwise Pearson over the
   four Replogle/Nadig lines, and the X-Atlas pair). Finding: with every cell, n = 10 already gives
   0.57; cells per perturbation sets the level (k = 10 → 0.43, k = 2 → 0.22).
2. **Sequencing-depth sweep** (`13_depth.py`, `results/depth_sweep.tsv`). Exact binomial thinning of
   the raw counts to f ∈ {1, ½, ¼, 0.1, 0.05, 0.025} (median 13.3k → 334 molecules per cell),
   then the full pipeline. Replogle/Nadig agreement 0.56 → 0.52; X-Atlas pair 0.57 → 0.38; axis
   split-half cosine 0.95 → 0.81. Depth alone does not remove the phenomenon when cells are many.

Already in the reproduction and reused: detectability vs perturbation count, removal of the
strongest loaders, control-reference swaps, growth-set removal (`05_stress.py`; `results/stress_per_line.tsv`, `results/stress_conservation.tsv`).

## Voice

Plain English (the user's standing preference). Every caption says what a mark represents, what it is
measured relative to, and what a big or small value means; terms are defined once in the intro
("typical response" = the paper's shared axis, "own part" = its residual, β = strength).

## Caveats the page must keep

- STRING, COMPASS-N, COMPASS-H and the STRING position prediction were **not** reproduced.
- Our training-mean baseline scores 0.02–0.03 higher than the paper's on accuracy (ties CompassX);
  it still has zero discrimination.
- Tahoe's shared axis is described as **confounded** (DMSO-well pseudo-drug test); its numbers are
  upper bounds on a biological shared response. ChemFish contexts are tissues of the same embryos.
- Plate I exemplars and the Plate IV t-SNE are illustrations; statistics come from the full space.
- MegaFin / MiniFin (Plates V–VIII): clusters stand in for cell types; the wells-per-drug curve is a model;
  10 MegaFin wells with near-empty-droplet cells are excluded (9 of them 1 µM wells).

## Possible future work

- Reproduce the STRING-based estimators (COMPASS-N/H) and the STRING position model.
- Combine thinning with cell caps (depth × cells grid) to find the joint frontier, and repeat the
  phase grid with Tahoe-like pooled-well controls to see whether the confound can be simulated.
- Tahoe: model well as a random effect using the second DMSO well and multi-plate drug-doses; test
  whether the axis survives.
- MegaFin / MiniFin: redo Plate VIII on annotated cell types and on the `zsb` recipe; test whether the
  inverted dose check follows cell yield (9 of 10 failed wells are 1 µM); run a small replicate-well pilot
  to check the wells-per-drug projection before designing the next screen.
- ChemFish genetic arm, once its cells are released.
