# `/rhaister` — three-figure visual essay

Built 2026-09-12 from the completed reproduction at
`/data/scratch/rhaister_repro` (`831d5ff`). The public page is intentionally
short: one figure explains the task, one shows the canonical reproduction and
RABGGTA holdout, and one ends on the panel-size experiment.

## Page contract

- `index.html` is the paper-like shell and contains exactly three major
  sections.
- `rh-main.js` draws all quantitative marks from `meta.json` and `plates.json`;
  it fails visibly if their asset versions disagree.
- `rh-draw.js` contains only shared SVG furniture.
- `scripts/build_rhaister.py` reads the finished TSV/JSON artifacts, validates
  their shapes and commits, builds the browser payloads, and prepares the
  archival source exhibit.
- `python3 scripts/build_rhaister.py --check` must reproduce all five generated
  files byte for byte.

## What the page may claim

- One canonical Replogle–Nadig split operationally reproduces with the authors'
  pinned pipeline: mean Pearson delta `0.431864`, beside the paper's four-split
  mean `0.41`.
- This is not a rerun of all four paper splits. The comparison is consistent,
  not like-for-like.
- The independent prediction reconstruction agrees with the official saved
  output to `8.94e-9` maximum absolute error.
- RABGGTA is a prespecified median-gain example, not a best case. Its full
  prediction reaches `r=0.731259` across 2,000 genes.
- In ten nested random panel repeats, the ridge first reliably helps at `K=8`,
  half of the attainable additive-to-full gain needs `K=256`, and 90% needs all
  `K=395` tested perturbations. The full prediction interval first clears the
  canonical additive score at `K=128`.
- Those gain fractions are not fractions of a noise ceiling. Replogle A/B
  halves are absent from the public release.
- COMPASS shared-response geometry identifies responses that are easy to
  predict (`rho=0.822`), but does not independently predict a smaller panel
  requirement after response-magnitude control (`partial rho=0.016`, `p=0.70`).
  This is a small inset, not a fourth section.

## Archival exhibit

Figure 1 uses the authors' unchanged `plots/Rhaister_split.png` source artwork
at code commit `75fed20`. The crop removes only outer white space; the original,
crop rectangle, source URL, license, and both SHA-256 values are recorded in
`exhibits/manifest.json`. Clicking the crop opens the uncropped local file.

## Provenance and boundary conditions

- Authors' code: `75fed20a1d97b05a09bf25c5341762141882106a`
- Replogle–Nadig release: `6fbb5f721c7ed8bef23fa8e5d2a08bc47470db83`
- Exact split used: pinned-code `replogle_nadig/split_0`, 945 test targets
- Legacy dataset split: 946 entries because it retains `non-targeting`; it was
  not substituted for the documented code split
- Observed HepG2 panel: 395 perturbations
- Released ridge basis: 1,078 terms, including 683 additive-imputed responses
- Paper: Svensson et al. 2026,
  doi `10.64898/2026.06.09.731197`, CC BY 4.0

The final MiniFin/MegaFin sentence is a design implication, not a cross-dataset
performance claim. The numerical thresholds belong to this four-context CRISPR
screen until tested directly in zebrafish.
