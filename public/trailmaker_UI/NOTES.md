# /trailmaker_UI — what the picture does and does not claim

A prototype for exploring the MegaFin drug screen: every drug-dose against every cell type, as a
change in cell-type proportion against DMSO, with Sorafenib pinned as the reference response.
Trailmaker's Data Exploration screen was the conceptual reference; this page is organised around
the comparison (DMSO vs Sorafenib vs a searched drug) rather than around one embedding.

Files: `index.html` (shell), `tm-stats.js` (every number, no DOM; testable in node),
`tm-view.js` (rendering), `data/` (built). Same instrument shell as `/pipeline`; the route has no
trailing slash, so script `src` is absolute. Rebuild: `/data/.venv/bin/python scripts/build_trailmaker_ui.py`.

## What it claims

- **Counts, not finished statistics, ship.** `data/<ds>.json` holds cells per (replicate unit ×
  cell type); `data/<ds>/g<i>.bin` holds cells expressing gene i per (unit × type). Proportions,
  ΔDMSO and z are computed in `tm-stats.js` from those, the same way for every layer.
- **ΔDMSO** is the drug's pooled proportion minus the DMSO wells *on the same plate*.
- **z** differs by dataset and says so on screen. MegaFin: each drug-dose is ONE well and each plate
  has TWO DMSO wells, too few for a DMSO variance, so z is a robust z of the well against every well
  on its plate (median, 1.4826 × MAD). MiniFin: a Welch t of the drug's samples against DMSO's.
- **Similarity to Sorafenib** is Pearson r between z-score profiles over the columns currently
  visible, against Sorafenib at the same dose. It moves when you filter; that is intended.

## What it does not claim

- **MegaFin cell types are automatic.** DanioType labels on CP01 (validated on MiniFin, spot-checked
  on four MegaFin lineages), and on CP02 plus the extra zsb-recipe cells a 15-nearest-neighbour vote
  in the Gold Harmony PCA. A 5% hold-out measures that vote; the number is in the About dialog.
  Do not read a CP02 drug's column as an expert call.
- **Tissues are a keyword grouping** of the cell-type names (`scripts/trailmaker_ui_tissues.py`),
  for filtering only. Not ZFA, not reviewed.
- **MiniFin columns overlap.** Patrick's sets are hierarchical (CNS, Muscle and Lens are umbrellas),
  so a column is the share of all cells in that set and columns do not sum to 100%. His labels are
  evaluation data; nothing here feeds the labeller.
- **n = 1 well per MegaFin drug-dose.** A strong z is a lead, not a finding.
- **The gene filter is a panel** (top markers per cell type plus a few context genes), not the
  transcriptome.
