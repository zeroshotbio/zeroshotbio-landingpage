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

## Next layers, in dependency order

1. Install BPCells + monocle3; open `reference_cds.tar`; export cell metadata to parquet. Everything
   else needs this.
2. Build a vocabulary crosswalk from ZMAP co-occurrence — ZMAP carries per-cell labels from eight
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
