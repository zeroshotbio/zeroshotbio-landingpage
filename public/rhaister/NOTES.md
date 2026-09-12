# `/rhaister` — implementation note

`/rhaister` is a plate-style evidence page about Rhaister (Svensson et al. 2026,
bioRxiv `10.64898/2026.06.09.731197`). Its first-pass page still says that
nothing has been reproduced. That is now obsolete: the canonical Replogle–Nadig
`split_0` run, its components, a repeated panel-size titration, a COMPASS join,
and the official Tahoe default have been completed under
`/data/scratch/rhaister_repro` at commit `831d5ff`.

Do **not** update only the prose or `meta.json`. The old page's claim, data, and
four-plate structure agree with one another. Replace the shell, generated data,
and captions atomically using [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Scientific scope the replacement page may claim

- We operationally reproduced one canonical Replogle–Nadig split with the
  authors' pinned code, released data, exact split, exact configuration, and
  evaluation harness. Our independent reconstruction agrees with the official
  predictions to `8.94e-9` maximum absolute error.
- We reproduced the authors' **prediction pipeline**, not every paper result.
  Their published Replogle–Nadig numbers are means over four splits; our complete
  dissection is `split_0`. No published per-split result artifact exists for an
  independent exact-number comparison.
- Additive ALS supplies most of the absolute Pearson score (`0.411368`). The
  drug ridge raises it to `0.430789`; the final blend reaches `0.431864`.
- The released implementation is not a pure combination of the 395 measured
  HepG2 panel responses. Its 1,078-term ridge basis contains 395 measured and
  683 additive-ALS-imputed responses. The measured terms carry a median 41.8%
  of absolute ridge-weight mass.
- Ten repeated random nested panels show that the ridge first reliably helps
  its matching additive fit at 8 measurements. Total score confidently exceeds
  the canonical full-panel additive score at 128, reaches 50% of the eventual
  gain at 256, and 90% only at all 395 tested panel perturbations.
- COMPASS shared-axis fraction strongly associates with full Rhaister accuracy
  (`rho=0.822`; partial `rho=0.506` after response-magnitude control), but does
  not independently explain per-perturbation panel K50 (partial `rho=0.016`,
  `p=0.70`). This is an extension, not a paper result.
- The official Tahoe default ran successfully (`Pearson delta=0.906587`). This
  reproduces a benchmark run; it does not make Tahoe's shared-well biological
  signal technically clean. Preserve the distinction made on `/compass`.
- A Replogle–Nadig half-sample/noise ceiling remains unavailable because the
  authors' A/B files are not in the public release. Show `not available`, never
  a guessed surrogate.

## Source of truth

| item | source |
|---|---|
| full scientific account | `/data/scratch/rhaister_repro/RHAISTER_REPRODUCTION.md` |
| official metrics and components | `reproduction_metrics.tsv`, `component_summary.json` |
| exact split geometry | `component_summary.json`, plus the pinned code's `splits/replogle_nadig/split_0/split.toml` |
| held-out RABGGTA example | `example_prediction.tsv`, `example_ridge_weights.tsv` |
| panel experiment | `panel_titration.tsv`, `panel_titration_summary.tsv`, `panel_strategy_comparison.tsv` |
| COMPASS extension | `compass_rhaister_join.tsv`, `compass_rhaister_associations.tsv` |
| authors' pinned code | `/data/scratch/rhaister_repro/code` at `75fed20a1d97b05a09bf25c5341762141882106a` |
| released dataset | `tahoebio/replogle-nadig-de-rhaister` at `6fbb5f721c7ed8bef23fa8e5d2a08bc47470db83` |

Every displayed number must be built from those files by
`scripts/build_rhaister.py`; do not transcribe values into JavaScript or HTML.

## Voice

Lead with the result, then narrow it. The page's sentence is:

> A canonical Rhaister result reproduces. Most of its score is additive; the
> panel combination adds a real but modest gain, and recovering that gain takes
> dozens to hundreds of measurements in this four-context CRISPR screen.

Use “canonical split reproduced,” not “the paper reproduced.” Use “observed
panel” for the 395 measured HepG2 perturbations and “ridge basis” for all 1,078
terms. “Few-shot” is the authors' task name, not our conclusion about a useful
panel size.

## Visual rule

Each evidence plate pairs an unchanged, attributed source exhibit with a
page-native rendering of our result. The source lives in an archival mat; tooth,
rules, labels, and a quiet registration stamp belong to the mat, never on top of
the source image. Our data marks remain exact and receive no pen wobble. Beneath
the pair, a four-row ledger always says: **paper claimed / our run / match / why
it matters**.

The paper is CC BY 4.0 and the released code is Apache-2.0. Keep figure number,
page, DOI/repository URL, license, source commit, and source-file SHA-256 with
each exhibit. Link every crop to an uncropped local copy.

## Publication state

The science is sufficient for a page with the limited scope above. The website
implementation has not yet been rebuilt, pushed, or deployed. Do not publish
until the generated-data integrity checks, archival asset checksums,
desktop/mobile render review, and language audit in the implementation plan all
pass.
