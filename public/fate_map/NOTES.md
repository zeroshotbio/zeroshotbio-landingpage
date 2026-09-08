# /fate_map — a 5.5–11.3 hpf zebrafish cell-fate map

Built 2026-09-08 on the EC2 instance from the public ITEC deposit.

- Page: `public/fate_map/index.html` + `fm-data.js`, `fm-plates.js`, `fm-flow.js`,
  `fm-main.js` (self-contained, no build step)
- Data: `public/fate_map/{meta,founders,flow,final,first}.{json,bin}`, rebuilt with
  `python3 scripts/build_fate_map.py` (`--fetch` pulls the 1.2 GB of source CSVs)
- Route: rewrite in `next.config.js` (`/fate_map` → `/fate_map/index.html`)

This page is the reference implementation of the plate style. The reusable
rules — tokens, typography, canvas practice, and the mistakes that cost the most
here — are written up in `PLATE_STYLE.md` at the repo root. Read that before
copying this page's look onto another one, and add to it if you learn something
new; keep this page and that document in step.

Three plates read top to bottom: the blastoderm at 5.5 hpf, the passage of every
followable lineage, the embryo at 11.3 hpf. Plate II pans and zooms; the plates
are linked, so a chosen lineage lights in all three.


## What the picture claims

**The tree edges ARE lineage.** Every stroke on Plate II is one nucleus tracked
frame to frame in a 3D time-lapse, and a fork is a division the tracker called.
This is the one page on the site that may say *descends from*. `/dev_tree`'s
edges are annotation containment and say nothing of the kind — do not let the
two pages borrow each other's language.

**The territories are NOT anatomy.** They are regions of a fitted sphere cut at
fixed angles by `TERRITORIES` in the build script, named for where they sit. The
authors did hand-segment eyes, brain, somites and tail bud at their final frame,
but **those labels are not in the public deposit** — the deposited Spot table is
`ID, Spot frame, X, Y, Z` and nothing else. So no organ is named on this page.
The italic glosses in the legend point at the classical fate map; they are not
claims about these cells.

**Left and right are not knowable here.** The coordinates fix the animal–vegetal
axis, and convergence fixes the dorsal meridian. Nothing in them orients the
left–right axis, so both flanks are labelled *flank*.


## Inputs

| What | Where | Used for |
|---|---|---|
| ITEC FISH2 spot table | `ITEC-FISH2-1000-Spot.csv` (18,497,012 rows) | frame, X, Y, Z per detection |
| ITEC FISH2 link table | `ITEC-FISH2-1000-Link.csv` (18,447,520 rows) | parent → child |
| ITEC run parameters | `params_FISH2.csv` | `z_resolution 7`, `max_dist 50` |
| Kimmel staging | Kimmel et al. 1995, 28.5 °C | the named stage rules on Plate II |

Source: Mendeley *Evaluation results of ITEC*, doi `10.17632/tg55phtk4r.1`,
accompanying Wang et al., doi `10.64898/2026.03.12.711203` (bioRxiv, CC-BY).
Code: <https://github.com/yu-lab-vt/ITEC>. The raw microscopy is not public and
is not needed: the deposited CSVs carry the whole reconstruction.


## THE TRAP: CSV row order is not ID order

In `ITEC-FISH2-1000-Spot.csv` the row index equals the spot ID only up to ID
**13,817,671** (partway through frame 807). After that 4.68 million rows carry an
ID that is not their row number, and the final 194 rows carry IDs from the middle
of the space. `Link.csv` speaks IDs.

Index the position arrays by ROW and the lineage silently rots from frame 807 on.
Parents land on the wrong cell *in the right frame*, so ~99% of links appear to
jump ~660 px — the chance distance between two random cells in this embryo — and
the second half of the movie looks corrupt. It is not. Scatter rows into
ID-indexed arrays (`arr[ids] = rows`) and every one of the 18,447,520 links is a
clean +1-frame step with a median displacement of **2.73 px**, comfortably inside
ITEC's own `max_dist` of 50.

This failure does not raise. It draws a confident, beautiful, entirely false fate
map. `load()` reports how many rows are out of place and refuses to continue if
the `max_dist` check starts failing wholesale.


## How each thing on screen is derived

- **The sphere.** The blastoderm is a shell of near-constant radius. An algebraic
  sphere fit every 50 frames gives a centre stable to a few px and radius
  **764.9 ± 6.2** across all 1001 frames. Z is multiplied by 7 first
  (`z_resolution`) to make the voxels isotropic.
- **Latitude** is the angle from the animal pole, taken as the direction of the
  frame-0 centroid. It is the epiboly coordinate: cells span 8–90° at 5.5 hpf
  (the margin sitting on the equator — that *is* 50% epiboly) and 8–172° by
  11.3 hpf (epiboly complete).
- **Longitude** is measured from the dorsal meridian, fitted as the circular mean
  of the mid-latitude longitude mode at the last frame. Its contrast rises from
  **1.24× the mean at 5.5 hpf to 3.36× at 11.3 hpf** — convergence, and the
  reason the axis is findable at all.
- **A founder** is a cell at frame 0 with at least one descendant still tracked
  at frame 1000. 2,541 of 8,034 qualify, carrying 10,966 of the 23,095 final
  cells through 8,425 divisions.
- **A segment** is an unbranched run, resampled onto a global grid every 8 frames
  (~2.8 min) by linear interpolation — interpolated, not selected, because a run
  may bridge a skipped frame and a plain mask would slide it in time.
- **Plates I and III share one scale** on purpose. Plate I's canvas is smaller
  because the sheet is smaller; rescaling it to fill its frame would look tidier
  and would throw away the growth the pair exists to show.


## Limitations found along the way

1. **Only 47.5% of the final cells have a followable ancestry.** The rest sit on
   tracks that begin mid-movie. Absence of a lineage is a tracking outcome, not a
   biological one, and Plate I leaves those founders as bare ink rather than
   pretending the map covers them.
2. **The paper's >99.7% is per-edge, between adjacent frames.** Over 600 frames it
   reports ~50% of complete lineages error-free. Any single long path on Plate II
   is likelier than not to contain an error somewhere, even though the aggregate
   picture is sound. Read the crowd, not the individual, unless you have a reason.
3. **Longitude barely predicts fate at 5.5 hpf.** The dorsal organiser is not
   visible until the shield, half an hour into the window, and founder longitude
   scatters with a circular sd of 47–134° by territory. Latitude is the
   coordinate carrying the signal, and it orders fates animal-pole → margin
   (animal 24° · anterior axial 39° · trunk 58° · posterior 70°) the way the
   classical map does.
4. **Founder "purity" is inflated by small families.** The median founder has 3
   descendants, and a family of one is trivially pure. Purity is 100% for
   single-descendant founders and falls to 56% for those with eight or more.
5. **One embryo.** Nothing here is a population statistic, and the fate map is
   this animal's, not the species'.
6. **2,170 links (0.012%) are dropped** for exceeding `max_dist` or spanning more
   than two frames. They are kept out rather than trusted.
7. **The 600-frame release is a different run.** `ITEC-FISH2-600-*` has 8,120
   cells at frame 0 against the 1000-frame run's 8,034 and is not a subset of it.
   The 1000-frame run also traces further back (75.9% vs 60.0% at the same
   timepoint), which is why this page uses it.
