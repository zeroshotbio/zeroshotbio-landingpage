# /trailmaker_UI — what the picture does and does not claim

A prototype for exploring the MegaFin drug screen: every drug-dose against every cell type, as a
change in cell-type proportion against DMSO, with Sorafenib pinned as the reference response.
Trailmaker's Data Exploration screen was the conceptual reference; this page is organised around
the comparison (DMSO vs Sorafenib vs a searched drug) rather than around one embedding.

Files: `index.html` (shell), `tm-stats.js` (every number, no DOM; testable in node),
`tm-view.js` (rendering), `data/` (built). Plate style (`PLATE_STYLE.md`, nearest sibling `/compass`),
asked for as a Darwin-notebook look: paper, one ink, ochre = more cells than DMSO, indigo grey =
fewer, madder only for the drug you chose, pen wobble on furniture only. The route has no trailing
slash, so script `src` is absolute. Rebuild: `/data/.venv/bin/python scripts/build_trailmaker_ui.py`.

## What it claims

- **Counts, not finished statistics, ship.** `data/<ds>.json` holds cells per (replicate unit ×
  cell type); `data/<ds>/g<i>.bin` holds cells expressing gene i per (unit × type). Proportions,
  ΔDMSO and z are computed in `tm-stats.js` from those, the same way for every layer.
- **ΔDMSO** is the drug's pooled proportion minus the DMSO wells *on the same plate*. A condition
  run on both plates (DMSO, Sorafenib) is compared plate for plate, weighted by cells.
- **z** differs by dataset and says so on screen. MegaFin: most drug-doses are ONE well and each
  plate has TWO DMSO wells, too few for a DMSO variance, so z is a robust z of each well against
  every well on its own plate (median, 1.4826 × MAD), averaged over the condition's wells.
  MiniFin: a Welch t of the drug's samples against DMSO's.
- **Trap:** Sorafenib sits on both MegaFin plates. An earlier build treated any two-plate
  condition as plateless and gave it no z, which silently emptied every similarity score.
- **Similarity to Sorafenib** is Pearson r between z-score profiles over the columns currently
  visible, against Sorafenib at the same dose. It moves when you filter; that is intended.

## What it does not claim

- **Only Patrick's hand-drawn labels are used, on both datasets.** No automatic labeller output and
  no label transfer (an earlier build used DanioType labels plus a nearest-neighbour vote; removed
  2026-09-14 at the user's request). MegaFin is part 1 only (plate CP01), because Patrick has not
  labelled CP02; its drugs are not on the page. Source and id bridge:
  `/data/experiments/patrick_megafin_labels/README.md`.
- **Unlabelled cells stay in every denominator.** A column is the share of all of a well's cells that
  sit in that set, so a region Patrick left blank lowers every column a little, evenly.
- **The Intestine and Liver/hepatoblasts sets cover nearly the same MegaFin cells** (99.5% of
  Intestine lies inside Liver). Read them as one column until they are redrawn.
- **Tissues are a grouping of Patrick's set names** (`MEGAFIN_TISSUE` / `MINIFIN_TISSUE` in the build
  script, falling back to `scripts/trailmaker_ui_tissues.py`), for filtering only. Not ZFA, not reviewed.
- **Columns overlap.** Patrick's sets are hierarchical (CNS is an umbrella on both; Muscle and Lens on MiniFin),
  so a column is the share of all cells in that set and columns do not sum to 100%. His labels are
  evaluation data; nothing here feeds the labeller.
- **n = 1 well per MegaFin drug-dose.** A strong z is a lead, not a finding.
- **The gene filter is a panel** (top markers per cell type plus a few context genes), not the
  transcriptome.
