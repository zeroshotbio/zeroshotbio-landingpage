# /trailmaker_UI — what the picture does and does not claim

A prototype for exploring the MegaFin drug screen: every drug-dose against every cell set, as a
change in cell-set share against a baseline (DMSO unless another is chosen), with a reference drug
(Sorafenib unless another is chosen) pinned for comparison. Trailmaker's Data Exploration screen
was the conceptual reference. Plate style (`PLATE_STYLE.md`, nearest sibling `/compass`), asked for
as a Darwin-notebook look.

Files: `index.html` (shell), `tm-stats.js` (every number, no DOM; testable in node), `tm-view.js`
(rendering), `data/` (built). The route has no trailing slash, so script `src` is absolute.

## Where the numbers come from — one file per dataset, nothing joined

Each dataset is read straight from Patrick's Trailmaker Seurat object, and from nothing else:

| dataset | object | cells | units |
|---|---|---:|---:|
| MegaFin part 1 (CP01) | `s3://zsb-bronze-archive/megafin/part1/patrick-labels/60a440dc-…_processed_matrix.rds` | 540,859 | 93 wells |
| MegaFin part 2 (CP02) | `s3://zsb-bronze-archive/megafin/part2/patrick-labels/7c8414f7-…_processed_matrix.rds` | 599,209 | 96 wells |
| MiniFin | `s3://zsb-bronze-archive/minifin/patrick-labels/processed-matrix-patrick-labels.rds` | 84,744 | 43 samples |

`scripts/export_trailmaker_rds.R` reads an object and writes, per unit (the object's `samples`),
its cell count, the cells in each of Patrick's `custom_cellset-*` sets, and per gene how many of
those cells express it. `scripts/build_trailmaker_ui.py` parses drug and dose from the sample names
(`m1_B12_CP01_LDE225_Erismodegib_1uM`; MiniFin from its `Treatment` column), names the genes from
the Ensembl 99 GTF (the objects carry Ensembl ids; gene annotation only) and writes the page data.
There is no Gold, no barcode join, no automatic labeller output and no label transfer (earlier
builds had all of those; removed 2026-09-14 at the user's request). Rebuild:
`/data/.venv/bin/python scripts/build_trailmaker_ui.py [--reexport]`.

## What it claims

- **Counts, not finished statistics, ship.** `data/<ds>.json` holds cells per (unit x set);
  `data/<ds>/g<i>.bin` cells expressing gene i per (unit x set). Share, delta and z are computed in
  `tm-stats.js` from those, the same way for every layer.
- **Delta** is the drug's pooled share minus the baseline's share on the same plate.
- **z** differs by dataset and says so on screen. MegaFin: each drug-dose is ONE well and each plate
  has two DMSO wells, too few for a variance, so z is a robust z of each well against every well on
  its plate (median, 1.4826 x MAD, floored at a typical well's binomial noise). It does not move
  with the baseline. MiniFin: a Welch t of the drug's samples against the baseline's samples.
- **Similarity to the reference** is Pearson r between z-score profiles over the visible sets,
  against the reference at the same dose.

## What it does not claim

- **Sets overlap.** Patrick's sets are hierarchical (CNS is an umbrella on all three; Muscle and Lens
  on MiniFin), so a column is the share of all a unit's cells in that set and columns do not sum to
  100%. Cells he put in no set stay in every denominator.
- **The two MegaFin parts are separate datasets.** They were labelled in separate Trailmaker
  projects and their set names do not line up one to one.
- **Overlapping lassoes:** Intestine sits inside Liver/hepatoblasts on both parts; on part 2 every
  Cardiomyocytes cell also sits in Pectoral fin bud mesenchyme.
- **Tissues are a grouping of Patrick's set names**, for filtering only. Not ZFA, not reviewed.
- **n = 1 well per MegaFin drug-dose.** A strong z is a lead, not a finding. Near-empty wells
  (Budesonide 5 uM on part 1) make every gap look large; the worked examples skip wells under 1,000 cells.
- **The gene field is a panel** (top markers per set plus a few context genes), not the transcriptome.
- Patrick's labels are evaluation data for the labeller; nothing here feeds it.
