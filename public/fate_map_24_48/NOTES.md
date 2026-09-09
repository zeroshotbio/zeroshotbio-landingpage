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

## Reusable tables

Written to `/data/fate_map/`, outside the web repo, for the ZMAP and DanioCell layers:

| File | Rows | What |
|---|---|---|
| `crosswalk_platt_zscape.tsv` / `.parquet` | 3,870 | every (Platt state, ZSCAPE state) pair with cell count and the fraction **in both directions** |
| `platt_state_enrichment.tsv` / `.parquet` | 358 | one flat row per state: counts at 24–48, both peaks, dev-time median, mapping confidence |
| `platt_state_enrichment.json` | 358 | the same, nested, with per-field provenance strings and all matches |

The web page loads only `enrich.json` — the 186 graph states, same records, 402 KB.

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
