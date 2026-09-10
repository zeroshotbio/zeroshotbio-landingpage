# /fate_map_24_48 — the inferred skeleton

**First pass, one source.** The Trapnell lab's v2.2.1 reference release, drawn as a graph with the
published literature verdict on every edge. ZSCAPE, ZMAP, DanioCell, Zebrahub and the spatial and
anatomical layers are **deliberately not integrated yet**; this page is the skeleton they hang on.

Reconnaissance behind it: `/data/fate_map_recon.md` on the analysis instance.

---

## What the picture claims

- 186 named cell states exist in this release's annotation, and 173 directed transitions were
  inferred between them.
- Each transition carries a **verdict from the authors' own literature review**: supported (73),
  plausible (60), unknown (14), rejected (24), unadjudicated (2).
- Each state carries a **six-point wild-type abundance trajectory** at 18/24/36/48/60/72 hpf, which
  says when it is abundant.
- The graph is **26 disconnected pieces**, not one tree.

## What it does NOT claim

1. **It is not observed lineage.** Nothing here watched a cell divide. The graph was built from
   transcriptional similarity between states at adjacent timepoints. The corpus behind this page
   contains **no observation of a cell division between 24 and 48 hpf** at all: Keller and Wagner
   both stop at ~24 hpf, ITEC's tracks are not registered to hpf, and the lineage-recording datasets
   give clonal groups rather than parent-and-child. This is stated in the dek, the caution block,
   the caption and note 1 — four times, because a reader landing mid-page must not be able to
   acquire the wrong belief.
2. **The x axis is not time.** It is longest-path depth from a root, and only *within* a component.
   Depth deliberately does not line up across components — see "Layout" below.
3. **The window could not be used to drop states.** The abundance table reports every state at
   every timepoint; it is a model fit over a complete grid, not a record of presence, so it cannot
   say a state is absent at 24 hpf. All 186 are drawn. The *crest 24–48 hpf* control isolates the
   65 whose abundance peaks inside the window (55 crest at or before 24 hpf, 56 after 48).
4. **The abundance numbers are one experiment's control arm.** `log_abund_x` from the
   lmx1ba/lmx1bb contrast, where `knockout_x` is FALSE in all 2,082 rows. It is the wild-type side
   of a single published perturbation and is used here only for timing. The 34-target ZSCAPE
   perturbation panel is not on this page.

## Inputs

| File | What it gives | Note |
|---|---|---|
| `combined_state_graphs.rds` | 186 vertices, 173 edges, directed, acyclic | igraph. Vertex attribute `name` and **nothing else** — no weight, time or confidence on any edge |
| `edge_lit_evidence.tsv` | the verdict per edge | 200 data rows **plus six tally rows appended at the bottom** whose `support` column holds counts; the build script drops them by requiring a known verdict. `REAL SUPPORTED (T/F)` is NA in every row — an empty column, do not read it |
| `perturb_lmx1ba,lmx1bb_contrast_abundance.tsv` | abundance per state per timepoint | 2,082 rows, 347 states, 6 timepoints. Only `log_abund_x` (control) is read |

All three live at `s3://zsb-silver-warehouse/platt/v2.2.1/` and on the instance at
`/data/datasets/zebrafish/Platt/sources/data/`. Custody: zsb-bronze PR #113.

**None of them needs monocle3 or BPCells**, which is why this page could be built while
`reference_cds.tar` — the 1.3 M-cell CDS, and the release's real payload — stays unopened. Opening
it needs those two R packages installed; neither is on the instance today.

## Layout, and the two versions that were wrong

The graph is 26 pieces of very different shape: the largest is 8 depths wide, half are 1 or 2. Two
layouts were built, rendered, and thrown away for the same reason — most of the paper was empty.

```
one tall stack       content 1330 x 2110   aspect 0.63   a ribbon down the left
three super-columns  content 4562 x  708   aspect 6.44   a band across the top
shelf packing        content ~1650 x 1000  aspect ~1.65  what is shipped
```

Components are shelved: laid left to right at their own width until the shelf is full, then a new
shelf. The cost is the global depth axis, which was removed — it would have been furniture
pretending to be a scale. Exact depth is one click away in the panel.

Within a component, nodes are ordered by two barycentre passes over the depth columns. Deterministic,
no force simulation, no jitter (PLATE_STYLE.md §1.3).

## Encoding

| Mark | Means |
|---|---|
| solid heavy ink | transition supported by the literature |
| solid light ink | plausible |
| dotted grey | unknown |
| dashed plum | **rejected** — the authors checked it and did not believe it |
| hairline rule | never adjudicated |
| filled node | has an abundance trajectory |
| hollow node | no timing on record (10 of 186) |
| madder tick across an edge | runs from a later-peaking state to an earlier-peaking one (6 of them) |
| madder ring | the selected state |

**Rejected edges are drawn, not deleted.** An edge someone checked and rejected is evidence, and a
graph with the rejections quietly removed would look far more settled than this one is. If you are
tempted to filter them out by default, read note 2 on the page first.

The abundance evidence corroborates the structure rather than defining it: of the 103 edges with
timing at both ends, **97 run from an earlier-peaking state to a later-peaking one**. The 6 that do
not are ticked.

## Traps

- **Absolute `<script src>`.** The route has no trailing slash; a relative `src` resolves against
  `/` and 404s.
- **The tally rows in the evidence TSV.** A naive `csv.DictReader` pass admits six rows whose
  `support` is `75`, `59`, `25`, `14`, `24` and `0.8427672956`.
- **`REAL SUPPORTED (T/F)` is empty.** It looks like the authoritative column and is not.
- **The abundance file name contains a comma.** `perturb_lmx1ba,lmx1bb_contrast_abundance.tsv` —
  quote it in shell.
- **Vocabulary.** This release names 186 states in the graph and 347 in the annotation. Only **27**
  match a ZSCAPE `cell_type_sub` label exactly, and ZSCAPE is the same lab's earlier annotation of
  overlapping data. Any integration starts with that crosswalk, and it cannot be done by string
  matching.

## Opening the reference (second pass, 2026-09-09)

`reference_cds.tar` is now open, and every state on the page carries measured context.

**How, without monocle3.** The CDS is a monocle3 `cell_data_set` wrapping a BPCells on-disk
matrix. Installing monocle3 pulls leidenbase, sf and terra; installing **SingleCellExperiment
1.24.0 and SummarizedExperiment 1.32.0 alone** is enough, because `cell_data_set` is defined as
`contains = "SingleCellExperiment"`. Declare a stub for it, plus a permissive stub for BPCells'
`IterableMatrix`, and `readRDS` restores the object in **73 seconds**.

**The trap that costs an hour.** Do not then call `dim()`, `colData()` or any other S4 generic on
it. Method dispatch walks the class hierarchy, reaches a monocle3-defined class and tries to load
the package — the exact thing being avoided. Read `cds@colData` by direct slot access instead;
slot access does not dispatch. `read_cds.R` in `/data/scratch/platt_open/` does this.

The result is 1,220,178 cells × 59 metadata columns, including `cell_type`, `timepoint`,
`orig_cell`, `embryo_ID`, `perturbation` and `expt`. The counts matrix is never touched.

## The crosswalk is a join, not a name match

The CDS carries **`orig_cell`**, and it is the same barcode string ZSCAPE stores in `obs['cell']`.
**1,087,108 of Platt's 1,220,178 cells (89.1%) are ZSCAPE cells re-annotated.** So the mapping is a
contingency table over cells that both files describe, not a string similarity. The 133,070 that do
not join are the `CHEM1/2/3/5` chemical experiments and ~30k barcodes with a different suffix form;
ZSCAPE has no such cells.

Confidence is reported, never resolved away:

| class | rule | graph states |
|---|---|---|
| `unique` | one ZSCAPE label takes ≥80%, and only one takes ≥5% | 89 |
| `dominant` | one label takes 50–80% | 78 |
| `split` | **no label takes half** | 18 |
| `unmapped` | no shared cells | 1 |

Every match above 0 is written to the crosswalk table; the panel shows the top six and says how many
it did not show.

### Platt v2.2.1 is much finer than ZSCAPE, and that is the integration problem

**186 graph states collapse onto only 82 distinct top-matching ZSCAPE labels.** Ten Platt states
have `head mesenchyme (maybe ventral, hand2+)` as their commonest ZSCAPE label; eight have
`neurons (gabaergic, glutamatergic)`. In the other direction, 35 of 154 ZSCAPE labels have no single
Platt state taking half of them. **The relationship is many-to-many and no join key will fix it** —
the two annotations subdivide the same cells along different axes. Anything that treats this as a
rename will silently merge states.

The muscle states show it cleanly. Platt's
`mature fast muscle (pvalb1-, pvalb2-, igfn1.3-, ank3a-, stim2b-)` (70,341 cells) spreads across
ZSCAPE's `mature fast muscle 2` (34%), `6` (27%), `1` (19%) and `4` (14%). Both annotations split
fast muscle finely; neither split is a refinement of the other.

## Mapping failures and surprising inconsistencies

1. **The release spells its own states three different ways.** The graph and the CDS say
   `head and neck mesoderm (pax3+, pax7+)`; the abundance table says `head/neck mesoderm (pax3+,
   pax7+)`. Same for `delaminating trunk vagal` against `delaminating trunk/vagal`. Normalising
   slashes, hyphens and the word "and" reconciles **11 of the 15** names that did not match
   exactly, with no key collisions. **The first pass reported "10 states with no timing"; most of
   those were this, not missing data.**
2. **`renal progenitors`** (graph, CDS) has no abundance row because the abundance table splits it
   into `distal renal progenitors` and `proximal renal progenitors`. A real granularity mismatch,
   not a typo — left unmapped rather than arbitrarily assigned to one half.
3. **`anterior segment mesenchyme (col9a2+)`** exists in the graph and the CDS and has no abundance
   row under any spelling.
4. **`unknown (head mesenchyme, paraxial-mesoderm derived, stc1+)`** is a graph vertex that appears
   in **neither** the CDS nor the abundance table. One of the 186 nodes has no cells anywhere in the
   release. It is drawn, and its panel says so.
5. **`mean_nn_time` in the CDS is empty.** The column exists, is typed correctly, and is populated
   for **550 of 1,220,178 cells** — 0.045%. Developmental time therefore comes from ZSCAPE's
   `mean_nn_time`, which is complete over all 3.2M of its cells, attached through the cell join. It
   is still labelled model-derived, because a nearest-neighbour time estimate is a model output
   whichever file it is in.
6. **`published` and `reference` are `FALSE` for all 1,220,178 rows.** Both flags look like they
   should partition the object and neither carries any information in this release.
7. **`keratinocyte` is the most striking disagreement.** Platt annotates 1,622 cells as
   keratinocyte; ZSCAPE calls the same cells `pharyngeal arch (contains muscle, early cartilage)`
   (42%) and `pharyngeal arch (early)` (28%), scattered over 32 labels at 2.54 bits of entropy.
   Two annotations of one set of cells, disagreeing about the germ layer.
8. **Sampling depth varies 16-fold inside the window** — 256,701 cells at 48 hpf against 15,727 at
   44 hpf. Every abundance figure on the page is therefore a **fraction of that timepoint**, never a
   raw count. A peak taken on counts would rediscover the sequencing schedule.
9. **The observed and modelled peaks disagree for 42 of 184 states** on the three timepoints both
   grids share (24, 36, 48). Both are shown, each with its grid, and the like-for-like test is
   stated separately — the two are measured on 13 points and 6 points respectively and can differ
   without either being wrong.
10. **The observed evidence is thin for a long tail.** Median 1,301 cells in the window per graph
    state, but **15 states have fewer than 100** and one has none. A 13-bar chart over 40 cells is
    a picture of noise; the panel prints the n beneath every chart for that reason.

## Plate II — the provenance stack (third pass, 2026-09-09)

Fourteen sources on one 0–120 hpf axis, banded by what each contributes, ordered from the most
interpreted evidence at the top to the most directly observed at the bottom. It is provenance, not
analysis: nothing on it was computed this pass beyond two figures read from `meta.json` and
`enrich.json`.

**A filled bar feeds the page; an open bar does not.** Two of fourteen are filled. Drawing a held
source the same way as a wired one would be the page claiming an integration it has not performed,
and the distinction has to survive someone landing on Plate II without reading a word.

**The plate's real job is the empty column.** Read down the shaded 24–48 hpf band: six bars cross
it with transcriptomes and **none of the four observed-lineage sources does**. Wagner and Keller
both stop at 24 hpf — at the window's left edge, which the axis makes literal. LINNAEUS is drawn
without a bar because its stage is not established for this window, and ITEC without one because
its release carries frames and no registration to hours. Two rows of madder italic where a bar
should be is the whole argument of the page, as a shape.

Sources that cannot be placed get a written reason in the plot area rather than a blank row. A
blank row reads as *missing data*; these are *unplaceable data*, which is a different problem with a
different fix.

### Where the figures come from

`sources.json` carries a `from` field on every source naming where its numbers were checked —
usually the silver README, sometimes the object itself as read during this session's recon. Two
figures are read live at build time from the page's own artefacts (`graph_edges`, and how many state
panels carry a crosswalk) so the caption cannot go stale. Citations are taken verbatim from the
silver READMEs, which is also why Platt's reads *"cited on the project site as Duran et al., with
no DOI given"* rather than inventing one.

### Two design decisions worth keeping

- **SVG, not canvas**, unlike Plate I. Fourteen rows is not a data mass, every row carries a
  citation that should be a real link, and the rows should be keyboard-reachable. The canvas
  practice in PLATE_STYLE.md §3 is for the case Plate I actually has.
- **The status column and the axis unit both had to move.** `x: W` with `text-anchor: end` clipped
  against the viewBox edge, and the unit label at `plotR + 6` collided with the 120 tick, which sits
  at `plotR` exactly by construction. Both were invisible in the code and obvious in a screenshot.

## ZMAP (fourth pass, 2026-09-09) — corroboration, not a join

**ZMAP shares no cells with Platt.** It integrates eight studies — Farnsworth2020, Farrell2018,
Kamimoto2023, Kukreja2024, Lange2023, Spanjaard2018, Sur2023, Wagner2018 — and neither ZSCAPE nor
Platt is among them. Its barcodes are a different grammar (`ZFOBLONG_WT_DS5_AGAAGGTCAGCG-3`). The
cell-level join that made the ZSCAPE crosswalk exact is unavailable, and no amount of care recovers
it.

So states are matched by **expression profile**: mean log1p(CP10K) per Platt state against mean of
ZMAP's own log-normalised X, over the 2,251 of ZMAP's 2,411 highly variable genes that survive the
gene-identifier bridge, scored by Spearman. **This is weaker evidence than the ZSCAPE crosswalk and
is labelled as such on every row and in the panel.** A ZSCAPE match says *these are the same cells,
labelled twice*. A ZMAP match says *these two populations look alike*.

### Three identifier systems, and a bridge that had to be built

Platt's genes are ENSDARG. **ZMAP's `gene_ids` are Lawson ids** (`LL0000000001`) — it was built on
the Lawson annotation, not Ensembl — so the ENSDARG intersection is **zero**. The join runs through
gene *symbols* instead, using the ZSCAPE symbol map: 27,923 of Platt's 32,031 genes reach a ZMAP
symbol, and 2,251 of the 2,411 HVGs are covered. Anyone integrating ZMAP with an Ensembl-based
dataset will hit this first.

### The thresholds were wrong before the mapping was

The first scoring pass thresholded raw Spearman at 0.55 and called **180 of 185 states weak** —
while mapping cardiomyocyte→cardiac_muscle, notochord→notochord and hatching gland→hatching_gland.
The mapping was right and the threshold was arbitrary. Cross-dataset pseudobulk over 2,251 sparse
genes is full of near-ties, which compresses Spearman: the whole top-match distribution sits around
ρ 0.43, so 0.51 is a strong match.

The fix is self-calibrating. A match is scored by **how far it stands above that state's own null** —
its correlations against every ZMAP state — in standard deviations. Raw ρ is still reported so a
z-score is never mistaken for a correlation. Rescored: **24 strong, 80 clear, 55 ambiguous, 26
weak** across the 185 graph states with a profile.

### Does ZMAP support, refine, or contradict?

**Mostly support.** On germ layer — the one axis both vocabularies carry — the two routes
**agree for 160 of 185 graph states**, with no cell in common. The strongest matches are clean
three-way agreements: `proximal straight tubule` → ZMAP `pronephros` / ZSCAPE `pronephros proximal
tubule`; `neutrophil` → `neutrophil` → `neutrophil`; `endothelium, dorsal aorta` → `aorta` →
`endothelium (dorsal aorta)`.

**It contradicts in 25 cases, and the contradictions go both ways.** `intestine, cloaca` — ZSCAPE
endoderm (right), ZMAP ectoderm (wrong). `early distal tubule` — ZSCAPE mesoderm (right), ZMAP
ectoderm (wrong). The page adjudicates none of them and says so.

### The one contradiction that is a real error, and it is ZSCAPE's

**Four notochord states disagree the same way, and ZMAP is right.** `early notochord`,
`early notochord progenitor`, `early notochord sheath` and `early vacuolated notochord` all map to
ZSCAPE `notochord (early)`/`(late)` at 87–100% of shared cells — the identity is not in doubt — and
all four come back ZSCAPE **ectoderm** against ZMAP **mesoderm**.

Notochord is axial mesoderm. Checking ZSCAPE directly: both of its notochord labels carry
`germ_layer = ectoderm`, and **all 57,931 ZSCAPE cells labelled notochord are assigned to ectoderm**,
42,059 of them inside the 24–48 hpf window. ZSCAPE's `cell_type_sub` is correct and its `germ_layer`
for those two labels is not. Anything grouping ZSCAPE by germ layer mis-assigns the entire
notochord, and that is 1.8% of its cells landing in the wrong layer.

This is what an independent source is *for*, and it was found by two annotations that share no cell
disagreeing about one.

### Predicted age: unbiased and too wide to use per state

Every ZMAP state carries its own `time_id` distribution, which is genuinely hpf. Carried across the
match, that gives each Platt state a predicted age — **indirect twice over**, and the panel says so.
Against the observed peak the median difference is **0 hours**, so there is no systematic bias, but
the spread is −18 h at the 10th percentile to +29 h at the 90th and **only 70 of 185 land within six
hours**. Read it as a sanity check on a state's rough era, never as a timing measurement.

### The ZMAP confidence scale is not the ZSCAPE one

Deliberately different words — `strong`/`clear`/`ambiguous`/`weak`/`thin` against ZSCAPE's
`unique`/`dominant`/`split`/`unmapped` — because they measure different things. Reusing the
vocabulary would invite the two to be read as comparable, and a fraction of shared cells and a
z-score against a null are not.

## Plate III (fifth pass, 2026-09-10) — the landscape, hour by hour

**844,825 wild-type ZSCAPE cells** at 24, 26 … 48 hpf — every control arm, no perturbed cell — under
a scrubber. 6.4 MiB binary, 13 hours, 154 states.

**Nothing on this plate is tracked, and the design says so three ways.** ZSCAPE is 1,860 separate
embryos fixed at separate hours; a cell at 24 hpf and a cell at 26 hpf are different cells from
different animals. So a state's trail is **dotted** rather than solid, the toolbar hint says
*the trail is expression changing, not cells moving*, and the caption says it again. A solid line
would read as a path and the plate would be lying.

The embedding is the **authors' own 3D UMAP** (`umap3d_1..3`) under a fixed principal projection to
2D, computed once and written into `embed_meta.json` as a mean and two basis vectors so it is
reproducible and auditable. It keeps **83.9%** of the 3D UMAP's variance. No new embedding is
invented. UMAP distance is not a quantity.

### The perturbation layer

**5,011 arrows** over 132 states and 28 gene targets. Each is a perturbed state's centroid minus
the *same state's* control centroid *at the same hour*, both arms needing at least 25 cells.
Perturbed cells are projected with the **same** stored basis as the controls — recomputing it over a
different cell set would silently shift every arrow.

An arrow is a difference between two populations of different cells in a UMAP. Not a trajectory, not
a velocity, and its length has no unit.

**Arrows are drawn ×8, and the plate says so with two stacked scale bars** — one showing a 0.1
displacement as drawn, one showing it true size. A median displacement is about 0.6% of the plate's
width, six pixels, invisible; drawing them unmagnified was the first version and it looked like the
feature had failed.

### One shared response axis, and it is real

The first principal component of all 5,011 displacement vectors takes **81.8% of the variance after
centring** (82.8% before). Twenty-eight different genetic perturbations really do push cells along one
direction in this projection.

**The centred figure is the one that matters and it was nearly not computed.** An un-centred first
component captures whatever common offset the displacements share, and a systematic
control-versus-injected batch shift would produce a large one with no biology in it. Here the common
mean displacement is only **8.0% of total squared length**, and centring costs a single point of
variance explained — so this is collinearity, not a batch shift. Both numbers are on the page for
exactly that reason.

Arrows running *against* the axis are drawn in madder; they are the interesting minority. Per-target
alignment is in `/data/fate_map/zscape_response_axis_by_target.tsv`.

**It is an axis in a UMAP, not a gene programme.** It cannot name a pathway and does not try. A
gene-level shared response would need a pseudobulk pass over ZSCAPE's expression matrix; that is a
different job.

### Traps, all of which cost real time

- **A canvas sized inside a hidden ancestor gets `clientWidth` 0 and paints nothing.** Plate III
  shipped completely blank the first time while every other part of it — legend, slider, panel,
  caption — worked perfectly. Plate I had escaped this only by accident, because its resize happens
  to be the last statement in the bootstrap. Anything measuring the DOM now runs from an
  `afterVisible` queue, after `#stage` is unhidden.
- **0.5 alpha at 1.6px turned 202,388 cells into solid black blobs.** Technically correct and it
  said nothing about where cells pile up. 0.16 at 1.3px, per PLATE_STYLE.md §1.1.
- **Joining a three-level MultiIndex onto a two-level one hung for 33 minutes at 100% CPU** with no
  output. Merge on columns instead.
- **The rewrite that expanded categoricals into 2.37M Python strings was OOM-killed with an empty
  log.** Everything now groups on integer codes with `np.bincount`; the aggregation runs in minutes
  and never materialises an object array.
- **The scale-bar block was placed at `H - 52` and its last two rows fell off the canvas.** It is
  four rows tall.

## Plate IV (sixth pass, 2026-09-10) — the terrain, and ChemFish

**Time is the y axis**, 24 hpf at the top rule and 48 at the bottom, after
`/fate_map_wang_2026` Plate II. x is one axis of the same wild-type embedding Plate III draws,
switchable between the projection's two axes exactly as that page switches between two spherical
coordinates.

**What the surface is.** Elevation is the **within-hour rank of wild-type cell density**, inverted:
high ground where few cells are, valley floors where they pile up. Drawn as 130 interpolated
profiles, each the real density curve at its own moment, filled with paper so a nearer row occludes
the one behind it and the stack reads as relief — plus hachures down the steep faces, which is the
whole texture budget of the plate.

**Why a rank and not the density.** Two earlier attempts rendered as ruled lines, and both are worth
recording because each looked like a code bug and was not:

    -log10(density), min-max over the whole field   the empty tails of every hour set the
                                                    maximum; all structure squeezed into a
                                                    narrow band, relief invisible
    1 - (density / row max) ** 0.45                 most columns sit near 1, so each profile
                                                    was flat with a few narrow notches
    1 - within-hour percentile rank   <- shipped    every hour uses the full amplitude

The rank transform is **monotone in density**, so every ordering claim the plate makes still holds —
a lower point always has more cells than a higher one at the same hour. What it is not is
proportional: **a valley twice as deep does not hold twice as many cells**, and elevation is not
comparable between hours. Both are said on the plate.

**And it is a metaphor.** Waddington's, and it stops there. Not anatomy. Not a tracked lineage.
Nothing rolls down it, nothing crosses a ridge, and no height is an energy, a barrier or a
probability. What is underneath it is a count of cells per bin per hour, normalised within the hour.

**Channels** are the 44 largest states' centroids at each hour, drawn dotted for the same reason
Plate III's trail is: a route, not a path anything travelled.

### The drug layer is ChemFish, not ZSCAPE

Seven small molecules, each blocking one named signalling pathway, against their matched vehicle:

| drug | pathway | vehicle |
|---|---|---|
| DEAB | retinoic acid | DMSO |
| LY411575 | Notch | DMSO |
| SB505124 | TGF-beta | DMSO |
| WntC59 | Wnt | DMSO |
| DMH1 | BMP | DMSO |
| SU5402 | FGF | DMSO |
| **Cyclopamine** | Shh | **ethanol, not DMSO** |

Cyclopamine's vehicle is the one that would be silently wrong if the controls were pooled.

ChemFish covers 36, 48 and **72** hpf, so only **36 and 48** fall inside this window. Its
`cell_type` vocabulary is the Platt one, so states reach the terrain's x axis through the verified
**cell-level** Platt-to-ZSCAPE crosswalk rather than by name — 355 Platt states placed, weighted
across their ZSCAPE counterparts so many-to-many survives as a weighted mean rather than a winner.

**A drug does not move a cell across this terrain.** It changes how many cells sit in each basin, so
the layer is drawn as deformation: a filled wedge where a state is enriched (its basin deepens) and
an open one where it is depleted (the basin fills in). 1,959 state-hours scored over
224 states, at a floor of 60 cells on an arm.

### The shared response, and it is interpretable

First principal component of the state-by-drug matrix of compositional log fold-change, per hour:

- **36 hpf — PC1 takes 45%** over 68 states and 7 drugs. It
  loads overwhelmingly on **LY411575 (Notch, +0.87)**, and what it separates is textbook: the states
  that gain are *differentiated neurons* — hindbrain glutamatergic, spinal cord GABAergic and
  glutamatergic — and the states that lose are *progenitors*: spinal cord progenitor, lateral floor
  plate, telencephalon. Blocking Notch drives premature neuronal differentiation at the expense of
  the progenitor pool, and the axis recovered that without being told any of it.
- **48 hpf — PC1 takes 37%** over 215 states. By then all seven loadings are
  positive (0.07 to 0.50), so it has become a broad shared depletion-and-differentiation direction
  rather than one drug's signature.

### Traps

- **The relief rises above its own row**, by up to seven row-spacings. A 30px top margin put the
  24 hpf crest off the canvas entirely; it needs 104.
- **`HDF5_USE_FILE_LOCKING` must be off to read `/data/chemfish/chemfish.h5ad`.** `minifin_query`
  serves the same file, and h5py blocks indefinitely on the open — no error, no timeout, no output.
  This cost about forty minutes of thinking the reads were merely slow.
- **AnnData writes `-1` for an unlabelled categorical** and `np.bincount` refuses a negative. 573
  ChemFish cells carry no `cell_type`; they are dropped, not folded into a bin, which would have
  invented a state.

## Plate IV, second cut (seventh pass, 2026-09-10) — you can walk on it now

Three things were wrong with the first cut, and the reader found all three.

**1. It could not be examined.** A 200-column field on an 1100px canvas is four
pixels a column and no way in. Scroll now zooms about the cursor and a drag pans,
to a limit of ×9. The view transform is applied to POSITIONS ONLY, never to a
line width, so the engraving keeps its weight at every scale and a ridge at ×6 is
the same ridge, not a fatter one.

The scroll is not a trap: at ×1 a further scroll-out is left alone and falls
through to the page, so nobody gets stuck inside the figure trying to read past
it. Double-click resets, and so does *clear*.

Two things broke under zoom and both were invisible until the plate was enlarged:

- **The 24 and 48 hpf rules were nailed to the margins.** They stayed put while
  the terrain slid under them, so at ×5.8 a hairline across the top was still
  captioned 24 hpf. They belong to the data and are now drawn at `hourY()`.
- **The hachures thinned out**, because they step every two COLUMNS and the
  columns spread apart. The step now scales with `1/sqrt(zoom)`.

**2. The shared response was a cloud of discs, and it did not say why a
wild-type terrain had a drug response at all.** That was a fair question with an
answer the plate never gave: *the terrain is wild type, the water is not.* The
tint is computed entirely from the seven drug arms and painted onto the
unperturbed landscape it describes — these are the basins that move when a drug
is applied, drawn where they sit when none is.

So the discs are gone and the valleys are tinted instead, on a diverging ramp
built out of PLATE_STYLE.md's categorical set: verdigris to indigo where a basin
loses cells, ochre to the madder TINT where it gains them, paper-deep in the
middle. `--select` is not in the ramp and stays reserved for the channel you
chose.

Getting it to read as landscape rather than as a stain took three goes:

    fill from the waterline down to the profile   what water actually does, and
                                                  eleven rows of it stacked into
                                                  a comb of vertical spikes
    fill the row's whole polygon, clipped to      no spikes, but hard vertical
    the columns below the waterline               edges: a rectangular stain
    fill the whole polygon, masked by the         soft pools that sit IN the
    gradient's own ALPHA         <- shipped       valleys and fade out as the
                                                  ground climbs

The last one works because the tint is filled over the SAME polygon as the paper
above it, so the nearer rows paint over all of it but the strip belonging to that
row, and the colour survives as a ribbon hugging the surface. Alpha falls with
the height of the ground toward the waterline and with ChemFish's coverage of
that part of the axis.

**Where there is no water, ChemFish never measured.** It reaches
39% of axis 1 at 36 hpf and 43% at 48; on
axis 2, 60% and 62%. A dry valley is an
unmeasured one, not one that failed to respond, and nothing is tinted above the
first measured hour — there is a labelled rule across the plate saying so.

**3. The drug layer was little up-and-down arrows on a landscape.** Marks on top
of a metaphor rather than the metaphor doing the work. A drug now DEFORMS the
terrain, which is both prettier and closer to the arithmetic:

    P_arm(x) = sum over states of  frac_arm(state) * K(x - x_state)
    L(x)     = log2( P_drug(x) / P_vehicle(x) )

Each arm gets an occupancy profile — every scored state's cell fraction smeared
along the axis with the terrain's OWN kernel, which is the only way the two stay
commensurate — and the surface is displaced by the log ratio, down where the drug
puts more cells and up where it puts fewer. It is the same `lfc` as the published
table, read as a function of position instead of as a list of states. The
wild-type line stays as a dashed ghost and the sliver between them is inked, so
the AREA is the size of the change.

**This is the reader's own idea, with one correction.** The suggestion was that
the undulations of the line are the changes in 2D position you would otherwise
see in the UMAP. They are not — they are changes in OCCUPANCY. ChemFish cells
reach this axis by which state they are, through the Platt-to-ZSCAPE crosswalk;
they were never embedded themselves. A drug can make a basin deeper or shallower
here. It cannot move one sideways, and the caption says so.

Two more things the deformation needed:

- **Only the row at the measured hour carries the ghost, the sliver and the
  hachures.** The band is about eleven drawing rows wide, and eleven identical
  slivers stacked into an opaque block that destroyed the relief exactly where
  the argument was.
- **That measured profile is inked hard only across the part of the axis
  ChemFish reached.** Run bold from edge to edge, it claimed a measurement
  everywhere.

### And the surface itself got its depths back

The rank transform gave every hour the full amplitude, and gave every valley the
same depth — a rank is uniform by construction, so the terrain came out as smooth
rolling waves. Elevation now adds a second term carrying the actual density
contrast:

    e_rank = 1 - (within-hour percentile rank of density)
    e_dens = 1 - (density / hour's densest column) ** 0.35
    elev   = 0.55 * e_rank + 0.45 * e_dens

**Both terms are monotone decreasing in density, so their sum is too**, and the
plate's only ordering claim survives untouched: at a given hour, lower ground
always holds more cells than higher ground. What changes is that a basin holding
a tenth of the hour's cells is now visibly deeper than one holding a fiftieth.

Relief went from 7 row-spacings to 11, and the near ridges are inked harder than
the far ones (0.14 to 0.34). That last one is **aerial perspective, a drawing
convention carrying no number** — every profile is still drawn at the same scale
and the data is entirely in their shape. At 16 row-spacings with hachures on
every column the plate turned into corduroy; 11 is where it stops being wallpaper
and starts being a range.

## Reusable tables

Written to `/data/fate_map/`, outside the web repo, for the ZMAP and DanioCell layers:

| File | Rows | What |
|---|---|---|
| `crosswalk_platt_zscape.tsv` / `.parquet` | 3,870 | every (Platt state, ZSCAPE state) pair with cell count and the fraction **in both directions** |
| `platt_state_enrichment.tsv` / `.parquet` | 358 | one flat row per state: counts at 24–48, both peaks, dev-time median, mapping confidence |
| `platt_state_enrichment.json` | 358 | the same, nested, with per-field provenance strings and all matches |
| `crosswalk_platt_zmap.tsv` / `.parquet` | 8,592 | every (Platt state, ZMAP state) match at four ZMAP levels, with ρ, the z against the state's null, and `method` on every row |
| `platt_zmap_enrichment.tsv` / `.parquet` / `.json` | 358 | per state: ZMAP fine/tissue/germ-layer calls, confidence, predicted hpf, and the ZSCAPE comparison |
| `zscape_perturb_displacement.tsv` / `.parquet` | 5,011 | every control→perturbed centroid displacement, with its projection on the shared axis |
| `zscape_response_axis_by_target.tsv` | 28 | per target: median projection, fraction aligned, fraction of its displacement variance along the shared axis |
| `chemfish_state_composition_lfc.tsv` / `.parquet` | 1,959 | per drug, hour and state: cell counts on both arms, fractions, compositional log fold-change, and the state's terrain position |
| `chemfish_shared_axis_loadings.tsv` | 14 | drug loadings on the shared response axis at each hour |

The web page loads `enrich.json` (402 KB) and `zmap.json` (840 KB) — the 186 graph states only.
Both are optional at runtime; the panel degrades block by block if either is absent.

## Next layers, in dependency order

1. ~~Open `reference_cds.tar`~~ — done, see above. SingleCellExperiment alone was enough.
2. ~~Platt↔ZSCAPE crosswalk~~ — done, and it is a cell-level join rather than the hand curation
   that was expected. The hand work that remains is deciding what to do about the many-to-many
   structure, which is a modelling question, not a matching one.
3. Build a vocabulary crosswalk from ZMAP co-occurrence — ZMAP carries per-cell labels from eight
   studies at once, so a cell with both a DanioCell and a Farnsworth label *is* a mapping
   observation. ZMAP contains neither ZSCAPE nor Platt, which is what makes it a usable referee.
3. Hand-curate the Platt↔ZSCAPE crosswalk. Unavoidable manual work.
4. Add ZSCAPE per-embryo composition (1,860 embryos, 34 targets) as a second, independent abundance
   layer beside the one used here.
5. Extend ZFA mapping (`/data/scratch/zlabel/`) to these state names, which is what would let the
   anatomy volumes and ZFIN's 2,578 in-window terms attach.

## Rebuild

```bash
python3 scripts/build_fate_map_24_48.py     # writes graph.json + meta.json
```

Every figure the page prints comes from `meta.json`, written in the same pass as `graph.json`.
Nothing is typed into the HTML.
