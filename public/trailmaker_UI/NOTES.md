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
- **The plum "stock stability" column is an estimate, not a measurement.** It is a quick triage of how
  likely each drug's DMSO stock is to lose potency through freeze-thaw cycles and storage time, read from
  the molecule's chemistry (ester and lactone hydrolysis as thawed DMSO takes up water, epoxides,
  boronates, catechols, quinones, light-sensitive dihydropyridines, macrolides) and common handling
  guidance. Background: Kozikowski et al. 2003 and Cheng et al. 2003 (J Biomol Screen). Tiers:
  `data/stability.json`, built by `scripts/trailmaker_stability.py`, which checks that every drug is rated.
  No stock on these plates was assayed; a weak drug with a "likely" swatch may be a decayed stock, not a
  weak drug.
- Patrick's labels are evaluation data for the labeller; nothing here feeds it.

## The eight stories (above the plate)

Presets of the page's own controls plus a few beats of narration; each beat spotlights the rows and
columns it is about. Every number they quote is computed live by `storyKit()` in `tm-view.js` from
the loaded counts, so a rebuild moves the text with the data. They are the page author's reading:

1. **MiniFin: Sorafenib thins the blood vessels.** Vascular endothelial share falls from 1.2% to
   0.7% (z -4.0, 11 samples vs 11 DMSO), the strongest move on MiniFin; the other two drugs leave it
   alone. Fits a VEGF-receptor kinase inhibitor.
2. **MiniFin: two different drugs, one fingerprint.** Dapagliflozin and Orlistat correlate at
   r 0.84: both lower the CNS share (58.8% to 53.0% / 51.7%) and lift liver, heart and blood. Shares,
   so one shift seen from two sides; mechanism not claimed.
3. **MegaFin part 2: the well, not the drug.** The tightest cluster (Famotidine, Nifedipine,
   Loratadine, Verapamil at 1 uM, r up to 0.93) shares no target but shares row H. Plate-wide,
   wells more than two apart correlate at about 0 and neighbours at 0.1-0.2; a drug's two doses
   (always vertical neighbours) agree no more than any two neighbouring wells. **Plate position is
   the dominant structure on both MegaFin plates**; treat single-well effects as leads.
4. **MegaFin part 2: Sorafenib again, one well at a time.** Same direction as MiniFin (1.15% to
   0.99%) but z -1.3, 11th of 90 wells; the 1 uM well holds 375 cells. Replicates are what separate
   a drug from a well.

Class checks that did NOT hold and so are not stories: glucocorticoids vs macrophages/neutrophils,
Hedgehog inhibitors vs slow muscle, HDAC / statin / CDK class fingerprints (within-class r ~ 0),
PARP inhibitors vs muscle (Rucaparib's signal is mirrored by its neighbour Fluoxetine, r 0.78).

Added the same day, for MegaFin part 1 and across the plates (a beat may switch plate; numbers from
the other plate come from a second, untouched copy of its data):

5. **MegaFin part 1: Rucaparib beats its neighbours.** The "neighbour check" (a well's z minus the
   median z of the other drugs' wells touching it) plus "repeats at both doses" leaves 5 drug-set
   pairs on part 1, 3 of them Rucaparib's (basal epidermis z 6.1 / 4.4 vs neighbours ~0.5, fast-twitch
   muscle, exocrine pancreas). Fluoxetine next door echoes it only faintly. The three PARP inhibitors
   on part 2 leave basal epidermis flat, so it looks like Rucaparib's own effect, not its class's.
6. **MegaFin part 1: one pathway, one cell type.** 7 of the 8 wells of the four PI3K-mTOR drugs sit
   above the plate's typical well for vascular endothelial cells (z > 0), where half would by chance.
   (Against DMSO the count is 8 of 8, but 69 of the plate's 82 wells beat DMSO there, so that is no
   evidence; the story uses z.) Omipalisib 5 uM (z 11.1) and Rapamycin 1 uM (z 6.9) are
   among the plate's loudest vascular squares with neighbours near 0, but neither repeats at its
   other dose. A lead, not a finding.
7. **Parts 1 + 2: two plates, two baselines.** DMSO wells are 43% CNS on part 1 and 62% on part 2;
   Sorafenib 5 uM sat in well A2 on both plates and its profiles correlate at r ~ 0. Plates are
   batches: compare within a plate, never merge.
8. **All three: fresh stock, aged stock.** MiniFin was dosed from fresh stock, MegaFin from older
   stock. Sorafenib's MiniFin vessel loss (-39%, all 11 samples below the DMSO average) is absent at
   5 uM on MegaFin (+13% part 1, -14% part 2, z -0.5 / -1.3); the thin 1 uM wells point up. But
   Dapagliflozin, chemically robust, fails to replicate too (fast-twitch muscle +56% on MiniFin, -2%
   on part 1), so stock age cannot be separated from one-well-per-dose and plate batch here. The
   stability-tier column does NOT predict flat wells (median RMS z of "likely" wells is no lower than
   "robust"). Known-potent drugs that look weirdly flat, the wells to re-make first: Paclitaxel 5 uM
   (6th flattest of 92, x1.3 cells) and Vinblastine (x1.3-1.6 cells) on part 2, while Epothilone B,
   same target, leaves x0.4; Panobinostat (4th and 8th flattest of 89) and 17-AAG 5 uM (flattest)
   on part 1. Cell ratios were checked against each well's column (part 1's column 5, Panobinostat's,
   runs x1.6, so its high cell count is its column's; its flatness is not). Paclitaxel and 17-AAG
   barely dissolve in water, so a wet, refrozen stock can lose them by precipitation, which the
   stability column (chemical breakdown) does not score. MiniFin's dose is not recorded in its
   object; the matched dose is the team's statement.

**Side-by-side figures in the story card.** The plate shows one dataset at a time, so beats that compare
datasets (I.2, IV.2, VII.3, all of VIII) carry a small figure drawn from untouched copies of all three
datasets: a *strip* (Sorafenib's vascular change against each plate's own DMSO, every sample / well as a
tick, the middle 80% as a band), a *fingerprint* (a drug's change on the 14 sets all three projects
drew, one row per dataset, r against the top row), and a *response* plot (how much named wells move
anything, against their plate's spread, with cells against the typical well). The shared-set list is
`XSETS` in `tm-view.js`; set names were matched by hand, not by ontology.

Also measured: bottom-edge row H holds the fewest cells per well on both plates (median ~4,400 and
~2,600 vs ~6,500-8,000 elsewhere); part 1's column 3 is thin (median ~800 cells) and holds the
no-DMSO controls (1,489 and 474 cells).
