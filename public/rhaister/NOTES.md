# /rhaister — implementation note

A plate-style page (see `PLATE_STYLE.md`; `/compass` is its sibling) that opens our analysis of
Rhaister (Svensson et al., Tahoe Therapeutics, bioRxiv 2026, doi:10.64898/2026.06.09.731197). It is
**the beginning of an analysis, not a reproduction**: every number is the authors' own, as reported in
their repository, and the page says so in a banner and on each plate.

| file | role |
|---|---|
| `index.html` | shell; the `/compass` stylesheet verbatim plus a `.status` banner style |
| `rh-draw.js` | a copy of `/compass/cp-draw.js` (canvas setup, pen-wobble furniture, text, axes) — keep in step |
| `rh-main.js` | the three plates, all captions, the plan, notes and colophon; every number read from `meta.json` |
| `meta.json` | hand-written from the authors' README / CLAUDE.md at HF commit 75fed20, the dataset cards, and our MegaFin cluster count; each block names its source |

Plates: I — the method as a sketch (observed → a combination of known responses → prediction of the
unseen one), built from an invented screen in which the combination is exact, and labelled as a sketch;
II — the authors' reported metrics (open rings; our dots will join them); III — the shape of each screen
(contexts × perturbations) drawn to one scale; IV — the proposed sequence of experiments.

The analysis itself lives in `/data/scratch/rhaister_repro` (git): `RHAISTER_NOTES.md` (datasets, task,
inputs, splits, baselines, metrics, results, the mathematics, zebrafish relevance, local inventory,
smallest downloads, the first canonical experiment, sources and exact commands),
`scripts/00_fetch_sources.sh` (what was fetched, reproducibly) and `scripts/01_download_minimal.sh`
(the next downloads, not yet run).

When the reproduction runs, replace the hand-written `reported` block's companions with a build script
(as `scripts/build_compass.py` does for `/compass`) that reads our results and adds our numbers beside
the authors' rings.
