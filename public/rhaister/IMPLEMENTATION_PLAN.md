# Rhaister evidence page — reconnaissance and implementation plan

> **Editorial status, 2026-09-12:** the seven-plate concept below was superseded
> before implementation by the three-figure brief. The shipped page retains
> this document's data, scope, provenance, and validation requirements, but
> condenses the story to task → canonical evidence → panel titration. See
> `NOTES.md` for the implemented contract.

Prepared 2026-09-12. This is the plan for replacing the local,
pre-reproduction prototype at `/rhaister`. It deliberately makes no website
code or data change yet and does not authorize a push or deployment.

## 1. Readiness decision

The reproduction is scientifically solid enough to support a **canonical-run
evidence page**, with two boundaries made prominent:

1. The complete Replogle–Nadig work is one exact split (`split_0`), whereas the
   paper reports four-split averages. The page must not call itself a complete
   reproduction of all Rhaister claims.
2. The A/B half-sample ceiling for this split cannot be obtained from the public
   release. Any “fraction of ceiling” field remains absent rather than inferred.

Evidence already complete:

| evidence | status | page wording |
|---|---|---|
| 57 upstream unit tests | passed | exact authors' code environment tested |
| official Replogle–Nadig command | passed | canonical `split_0` reproduced unchanged |
| official evaluator | passed | all six metrics available |
| independent prediction reconstruction | passed | agrees to `8.94e-9` max absolute error |
| component dissection | passed | additive, ridge, calibration, blend separated |
| concrete held-out prediction | passed | RABGGTA, chosen by a prespecified median-gain rule |
| panel-size experiment | passed | 10 nested random repeats; maximin comparator |
| COMPASS identifier join | passed | 922/945 held-out perturbations matched |
| official Tahoe default | passed | one default run, kept separate from confounding |
| four Replogle splits | incomplete | future work; never imply complete |
| Replogle A/B ceiling | unavailable | public files absent; show `not available` |

## 2. Page argument

The current prototype treats the authors' thesis as the destination. The new
page should treat it as a question and walk from reproduction to mechanism:

> Can a small panel in a new context predict everything else? The canonical
> run works. Most accuracy is already in an additive model. Linear panel
> composition adds about 0.02 Pearson, but most of that gain needs a large
> panel. Shared COMPASS-like responses are easier to predict; they do not,
> independently, require fewer panel measurements.

The masthead should say **“a canonical reproduction and dissection”**. A short
scope strip immediately below it should state `one Replogle–Nadig split · exact
authors' pipeline · new panel experiment · no public half-sample ceiling`.

Do not retain the old “nothing here is reproduced yet” banner, screen-size
survey, or proposed-work plate. The exact split ledger now gives the necessary
screen context, and completed results should replace the plan.

## 3. The paired-exhibit grammar

Every numbered plate uses the same reading order:

```text
PLATE TITLE                                      scope / dataset

┌ SOURCE EXHIBIT ─────────┐   ┌ OUR REPRODUCTION ──────────────┐
│ unchanged figure/crop   │   │ exact page-native data marks   │
│ source stamp + figure # │   │ run/split stamp                │
└─────────────────────────┘   └────────────────────────────────┘

PAPER CLAIMED   one precise sentence, scoped to its dataset
OUR RUN         one precise sentence with the relevant result
MATCH           exact / consistent, not like-for-like / extension / unresolved
WHY             the consequence for interpretation or screen design
```

Desktop uses a `minmax(300px, .82fr) minmax(0, 1.18fr)` grid. Mobile stacks the
source first. Original figures keep their native aspect ratio and unmodified
pixels. CSS texture belongs to the mat and caption furniture, not the image.
Use a 1px ink frame, 8–12px inner paper gutter, a faint linen crosshatch on the
outer mat, and a small sans-serif registration label (`FIG. 1 · P. 3 · SOURCE`).
Clicking a crop opens the uncropped local image. Every image has descriptive alt
text; the visible caption carries attribution and license.

The four ledger labels are fixed across plates. A reader should never have to
infer whether two unlike datasets or aggregation levels are being compared.

## 4. Plate sequence

### Plate I — The missing square

**Original exhibit:** the authors' Figure 1 task schematic, backed by the
released `plots/Rhaister_split.png` at code commit `75fed20`.

**Our reproduction:** an exact four-row split matrix for Replogle–Nadig
`split_0`: Jurkat, K562, and RPE1 as reference contexts; HepG2 as query context;
945 fixed test perturbations; 395 actually measured HepG2 panel perturbations;
2,000 genes. A bracket separates the 395 measured responses from the full
1,078-term ridge basis, whose other 683 entries are additive-imputed.

**Ledger:**

- **Paper claimed:** a small observed panel in a query context can support
  prediction of its out-of-panel perturbations from reference contexts.
- **Our run:** the released split has exactly that combinatorial holdout, but
  the implementation expands the measured panel with 683 ALS-imputed terms.
- **Match:** task geometry matches; “linear combination of the observed panel”
  is an incomplete description of the released predictor.
- **Why:** this is the denominator for every later claim about how many
  measurements and how much measured-panel information are involved.

### Plate II — The canonical score, set beside the paper

**Original exhibit:** the Replogle–Nadig panel from paper Figure 1, plus a
typeset source card for the README's four-split means. Do not redraw the paper
bars as if they were split-level observations.

**Our reproduction:** six aligned metric rows for the authors' baselines and
full Rhaister on `split_0`; use open rings for the paper's four-split means only
where the same metric exists, and filled marks for our single split. A scope key
must say `ring = four-split paper mean; dot = our split_0`.

Primary values for our split:

| method | Pearson delta | discrimination | Spearman LFC | PR-AUC | DE overlap | effect-size Spearman |
|---|---:|---:|---:|---:|---:|---:|
| additive ALS | 0.4114 | 0.7629 | 0.6534 | 0.0920 | 0.1377 | 0.2161 |
| full Rhaister | 0.4319 | 0.7986 | 0.5983 | 0.0971 | 0.1447 | 0.2093 |

**Ledger:**

- **Paper claimed:** across four Replogle–Nadig splits, Rhaister reports 0.41
  Pearson delta, 0.08 PR-AUC, 0.63 Spearman LFC, and 0.14 DE overlap, with mixed
  wins relative to STATE.
- **Our run:** the official split-0 evaluator gives 0.4319, 0.0971, 0.5983, and
  0.1447 on those metrics.
- **Match:** consistent with the aggregate, not an independent exact per-split
  match; no authors' per-split result artifact is published.
- **Why:** it establishes an operational reproduction while keeping its scope
  narrower than “the paper reproduced.”

### Plate III — What makes the number move

**Original exhibit:** paper Methods equations for the additive starting point
and panel-combination regression, or the corresponding unmodified crop if it is
legible at page scale. Accompany it with the released
`plots/Rhaister_arch.png` workflow, not an invented neural-network metaphor.

**Our reproduction:** a waterfall on Pearson delta and a basis ledger:

```text
global mean            0.35551
additive ALS            0.41137   +0.05586
drug ridge              0.43079   +0.01942
95:5 ridge/ALS blend    0.43186   +0.00108
```

Beside it, show `395 measured / 683 imputed = 1,078 basis terms`, median measured
weight mass `41.8%`, and the fixed-weight residual counterfactual `0.42615`.
Calibration belongs in a small footnote: it affects significance metrics, not
the fold-change or delta predictor, and changes PR-AUC by only `+0.000812` here.

**Ledger:**

- **Paper claimed:** Rhaister predicts a target response as a linear
  combination of panel responses learned across reference contexts.
- **Our run:** the ridge produces the response improvement, but additive ALS
  supplies most absolute accuracy and also supplies most basis rows.
- **Match:** the core mechanism works; the released implementation is more
  additive-assisted than the short description suggests.
- **Why:** this answers what new predictive information the observed panel adds.

### Plate IV — Open one prediction

**Original exhibit:** the paper's linear-combination equation and the relevant
query-context corner of Figure 1. Keep this as a small archival methods panel;
do not imply that the paper selected RABGGTA.

**Our reproduction:** the existing RABGGTA plot rebuilt from
`example_prediction.tsv` and `example_ridge_weights.tsv`: observed versus
predicted HepG2 delta across 2,000 genes; strongest measured positive and
negative panel weights; labelled extreme predicted genes; three score ticks.
RABGGTA was chosen before inspection because its full-minus-additive gain is
closest to the median, not because it is a best case.

**Ledger:**

- **Paper claimed:** shared ridge weights turn the measured query panel into an
  interpretable out-of-panel response.
- **Our run:** RABGGTA reaches additive `r=0.72580`, ridge `r=0.72888`, and full
  `r=0.73126`; TRAPPC1 is the largest measured positive weight (`+0.1564`) and
  SPC25 the largest measured negative shown (`-0.0713`).
- **Match:** mechanism demonstrated on a concrete held-out response; biological
  ceiling remains unavailable.
- **Why:** aggregate metrics no longer hide what a prediction and its weights
  actually look like.

### Plate V — How few is “few”?

**Original exhibit:** paper Figure 3 left, including its Tahoe panel-size axis
and caption. Preserve its dataset label. The paper says performance continues
to improve with panel size and that, with ten reference lines, a one-drug,
three-dose panel reaches the half-sample reference across the reported metrics
on Tahoe.

**Our reproduction:** the repeated Replogle–Nadig curve from
`panel_titration.tsv`, with every random replicate faintly visible, mean and 95%
t interval in ink, canonical additive as a fixed rule, and a toggle that adds
the reference-only maximin strategy. A second narrow row plots gain over the
matching-K additive model so the changing additive fit cannot be mistaken for
ridge information.

Mark four thresholds: `K=8` first reliable ridge gain; `K=128` first 95%
interval above canonical additive; `K=256` half of eventual gain; `K=395` 90%
of eventual gain. Label the last two as fractions of the **full-panel Rhaister
gain**, not fractions of the unavailable A/B ceiling.

**Ledger:**

- **Paper claimed:** larger panels provide more predictive information; Tahoe
  remains strong with a very small drug panel.
- **Our run:** direction matches, but the four-context CRISPR screen needs 128
  measurements to confidently beat the canonical additive score and 256 for
  half the eventual uplift.
- **Match:** qualitative scaling matches; the small-panel Tahoe conclusion does
  not transfer quantitatively to this split.
- **Why:** this is the Zeroshot-facing screen-design result. The tested maximin
  rule is worse than random, so “diverse” cannot yet be sold as a shortcut.

### Plate VI — Which perturbations are easy?

**Original exhibit:** paper Figure S1 (context/perturbation signal ablations),
framed as the authors' evidence that reference interaction signal matters. Do
not present it as a COMPASS analysis.

**Our reproduction:** the 922 matched HepG2 perturbations from
`compass_rhaister_join.tsv`. Default view is shared-axis fraction versus full
Rhaister Pearson, with all points in one ink and decile medians overlaid. A
small companion ledger gives raw and response-magnitude-adjusted associations;
an optional switch changes the outcome from full accuracy to panel K50.

**Ledger:**

- **Paper claimed:** rich, diverse reference contexts and intact interaction
  structure enable Rhaister performance.
- **Our run:** COMPASS shared fraction strongly predicts overall accuracy
  (`rho=0.822`, partial `rho=0.506`) but not K50 after magnitude control
  (partial `rho=0.016`, `p=0.70`).
- **Match:** extension, not a direct reproduction of Figure S1.
- **Why:** reusable response geometry identifies easy targets, but it does not
  yet tell us how small to make a new-context panel.

### Plate VII — Tahoe: benchmark reproduced, biology unresolved

**Original exhibit:** the Tahoe panel from paper Figure 1, with the authors'
five-split mean Pearson delta `0.87` and near-ceiling framing.

**Our reproduction:** a two-part ledger. First, the literal official CLI
default `tahoe_5_holdout` result (`Pearson delta=0.906587`, Spearman LFC
`0.827467`, PR-AUC `0.770087`, DE overlap `0.658862`, effect-size Spearman
`0.963516`). Second, a restrained cross-reference to `/compass` showing that
Tahoe cell lines share wells and that no-drug well differences can resemble a
shared drug response. Do not import a COMPASS number without rebuilding it from
the COMPASS page's generated source.

**Ledger:**

- **Paper claimed:** Rhaister reaches 0.87 mean Pearson delta on Tahoe and
  approaches how well the data can predict itself.
- **Our run:** the official default succeeds at 0.9066 on one holdout-scale run.
- **Match:** benchmark result is consistent; one run is not the five-split mean.
- **Why:** prediction reproducibility and biological cleanliness are separate.
  A strong benchmark can coexist with shared-well technical structure.

## 5. Ending, outside the plates

End in prose with the five direct answers, not another dashboard:

1. Yes, one canonical split and the official Tahoe default reproduce
   operationally; not every paper split was rerun.
2. Additive ALS supplies most accuracy; the drug ridge supplies almost all of
   the improvement beyond additive.
3. In HepG2 `split_0`, useful recovery is not truly tiny-panel: 128 to
   confidently clear canonical additive, 256 for half the eventual gain.
4. COMPASS geometry predicts overall ease, not independently the panel count.
5. Before MegaFin: repeat splits 1–3 and build raw-data A/B halves for all four
   lines.

Do not add MiniFin or MegaFin result plates in this pass. Link to `/compass` for
the existing screen-quality work and leave the next MegaFin as a future design
question.

## 6. Archival source inventory

The first source download was blocked by bioRxiv rate limiting, but the official
repository's small LFS images are now available locally. The manuscript text
was independently inspected through the canonical bioRxiv PDF URL; final page
assets must come from the actual CC BY 4.0 PDF or authors' repository, not a
text-proxy rendering.

| exhibit | canonical source | local source | integrity |
|---|---|---|---|
| authors' workflow | Rhaister repository `plots/Rhaister_arch.png` | `/data/scratch/rhaister_repro/code/plots/Rhaister_arch.png` | Git LFS SHA-256 `f24abcc278037f4fef2a780b19212095e63809cfd44fa947f667e1664ff70f3e` |
| authors' split | Rhaister repository `plots/Rhaister_split.png` | `/data/scratch/rhaister_repro/code/plots/Rhaister_split.png` | Git LFS SHA-256 `4475694a9512a5b9f59853ea008b6e9667b9fc341273b968fe7566160b46b132` |
| paper Figure 1 | bioRxiv PDF, page 3 | acquire into an asset-staging directory | checksum before crop |
| paper Figure 3 | bioRxiv PDF, page 7 | acquire into an asset-staging directory | checksum before crop |
| paper Figure S1 | bioRxiv PDF, page 16 | acquire into an asset-staging directory | checksum before crop |

Paper: Svensson et al., *Back to basics: Observed statistics are sufficient to
predict drug responses*, bioRxiv 2026, DOI
`10.64898/2026.06.09.731197`, CC BY 4.0. Code and repository images:
`https://huggingface.co/tahoebio/Rhaister` at `75fed20`, Apache-2.0.

Store uncropped originals under `public/rhaister/exhibits/original/` and crops
under `public/rhaister/exhibits/crops/`. Write
`public/rhaister/exhibits/manifest.json` with source URL, figure/page, upstream
commit where applicable, source SHA-256, crop rectangle, output SHA-256,
license, and attribution. Cropping is allowed; recolouring, retouching, or
redrawing a source exhibit is not.

## 7. Generated-data architecture

Add `scripts/build_rhaister.py`, following `scripts/build_compass.py`:

- assert reproduction HEAD `831d5ff` (or require an explicit `--allow-commit`
  override that is recorded in output);
- assert upstream code commit `75fed20a1d97b05a09bf25c5341762141882106a`;
- read all values from the reproduction TSV/JSON artifacts;
- validate uniqueness, row counts, finite numeric fields, known method names,
  the 945 test targets, 10 random repeats, panel-size grid, and 922 COMPASS
  matches;
- copy/check the archival assets against the manifest;
- write `public/rhaister/meta.json` for prose/ledger values and
  `public/rhaister/plates.json` for data marks;
- compute `asset_version = sha256(plates.json)[:12]` and put it in both files;
- support `--check` to rebuild in memory and compare with committed outputs.

Suggested `plates.json` blocks:

| block | source fields |
|---|---|
| `split` | context, role, train/panel/test counts, measured/imputed basis counts |
| `metrics` | method × six official evaluator metrics; paper aggregate separately tagged |
| `components` | global, additive, ridge, blend, fixed-weight counterfactual, calibration deltas |
| `example` | gene observed/predicted/additive vectors; measured and imputed ridge weights |
| `titration` | every strategy × repeat × K point and precomputed interval/threshold summary |
| `compass` | matched target, shared fraction, response magnitude, residual magnitude, full Pearson, gain, K50 |
| `tahoe` | default metrics, split geometry, runtime, explicit aggregation scope |

Do not load raw scientific TSVs in the browser. Materialise only the fields the
plates draw. Retain all 922 COMPASS points; no decorative subsampling.

## 8. Page files

| file | role |
|---|---|
| `index.html` | masthead, scope strip, seven paired plate shells, notes, colophon |
| `rh-data.js` | fetch `meta.json` and `plates.json`, cross-check versions and shapes, fail loudly |
| `rh-draw.js` | shared canvas furniture; keep in step with `/compass/cp-draw.js` |
| `rh-plates.js` | exact data rendering, one function per plate |
| `rh-main.js` | bootstrap, restrained toggles, captions and ledgers from generated values |
| `meta.json`, `plates.json` | generated only |
| `exhibits/manifest.json` | generated/validated archival provenance |

Interactions should clarify rather than turn the essay into an instrument:

- Plate II: metric focus highlights one row without hiding the others.
- Plate V: random/maximin switch; random is the default and both retain the
  fixed additive rules.
- Plate VI: full-accuracy/panel-K50 outcome switch.

No hover-only facts. Essential numbers and scope remain in visible captions.

## 9. Notes and colophon requirements

The page-level notes must include:

- exact code, data, and reproduction commits;
- the dataset-vs-code split-definition discrepancy (`non-targeting` makes 946
  in the legacy dataset definition; exact pinned-code split has 945 and was used);
- paper aggregate versus our single-split distinction;
- 395 observed versus 683 imputed ridge-basis terms;
- unavailable A/B ceiling;
- random panel nesting, repeated seeds, fixed test set, and no-leakage maximin
  criterion;
- RABGGTA selection rule;
- COMPASS join coverage and non-causal, cross-pipeline nature;
- Tahoe benchmark/biological-cleanliness distinction;
- from-scratch runtimes and CPU environment;
- a link to the reproducibility repository once its Rhaister counterpart is
  published, without blocking the local build on that future URL.

## 10. Implementation order

1. Acquire and checksum the CC BY paper PDF; extract only Figures 1, 3, S1 and
   any legible Methods excerpt needed for the paired plates.
2. Write `scripts/build_rhaister.py` and its validation tests before changing
   the page shell.
3. Generate `meta.json`, `plates.json`, and the exhibit manifest from the pinned
   artifacts.
4. Replace `index.html`; split the current monolithic `rh-main.js` into data,
   plates, and prose/bootstrap modules.
5. Draw Plates I–VII with paper/source scope written on every pair.
6. Add notes and colophon, then update `next.config.js` comments and the sitemap.
7. Run the publication gate below. Commit locally only; pushing/deploying is a
   separate action.

## 11. Publication gate

- `python scripts/build_rhaister.py --check` passes from a clean reproduction
  commit and reproduces byte-identical generated JSON.
- Every archival original and crop matches `exhibits/manifest.json`.
- A value audit traces every visible number back to a generated JSON field and
  then to a named TSV/JSON source; no result is embedded in prose code.
- Search finds none of the obsolete phrases `nothing here is reproduced yet`,
  `the beginning of an analysis`, or the old proposed MegaFin plan.
- `npm run lint` and `npm run build` pass.
- Browser renders at 1440, 768, and 390 pixels with no clipped labels,
  collisions, sideways overflow, or unreadable source crops.
- Every source exhibit has visible attribution, license, figure/page, and a link
  to its uncropped original.
- Every `match` line uses one of the four explicit states: `exact`, `consistent,
  not like-for-like`, `extension`, or `unresolved`.
- The local commit is reviewed before any push or deployment.
