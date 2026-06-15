# DanioType Cell-Type Labeling — Technical Handoff

**System.** DanioType (`daniotype_kasperov`): an LLM-driven (gpt-5.5) zebrafish scRNA cell-type-labeling wizard. Repo `/data/zeroshotbio-landingpage`, branch `poc-workflow:main`, Next.js→Vercel client + EC2 backends. Two services: `daniotype_autopilot.service` (:5008, labeling worker) and `minifin_query.service` (:5007, co-expression/DEG grounding — log2FC, %in/out, BH-padj, specificity rank). Assets in `daniotype_data/<dataset>/`, served via nginx at `zscape.zeroshot.bio/daniotype_data/`; runs in `/data/daniotype_runs/`.

**Labeling loop (three personalities).** Researcher (2 proposers, propose identities from markers/literature) → Archivist (verifies each proposed marker against :5007 DEGs) → Reasoner (`kasperov-conclude`: assign/abstain, pick tier, cite markers). Core rule = **cite-discipline**: assign only on markers the Archivist confirms enriched in *that* cluster.

## Native-schema benchmark (the core methodology)

Each ground-truth dataset is scored in **its authors' own native label ontology**, not a ZSCAPE-projected one (projecting measures schema-mimicry, not labeling skill). Units = authors' own finest-native cell groups (pure by construction), with per-group DEGs. Proposals constrained to native vocab per tier via `getTierVocab` (datasets in `GT_DATASETS`; others get open-vocab). Scoring is size-stratified (≥100 / ≥30 / all) by an **LLM semantic judge** (`kasperov_score`) crediting synonyms / ontology parent-child / lineage equivalence and stripping numeric suffixes.

The three GT datasets (967 units total):
- **ZSCAPE** (Saunders/Trapnell 2023; sci-RNA-seq3; *in-paradigm reference*): 4 tiers germ(7)/tissue(34)/broad(99)/sub(156); 156 units.
- **ChemFish** (Barkan et al.; sci-RNA-seq3; *in-paradigm* — its labels were nearest-neighbor projected from ZSCAPE): tissue(39)/cell_type(341); 341 units. Excluded the native `projection_group`(30) column = the ZSCAPE-projection scaffold.
- **DanioCell** (Sur/Farrell 2023; 10X droplet; **genuinely independent / cross-platform — the only true generalization read**): tissue.name(20)/tissue.figure(43)/clust(470). `clust` codes (neur.8, etc.) are numeric IDs, not a nameable vocabulary → **sub-tier dropped**; scored tissue+broad only (≤43-level, coarse). 470 units.

**Critical:** scores are NOT cross-dataset comparable (different ontology sizes → different chance). ZSCAPE/ChemFish are home turf; only DanioCell tests generalization.

## Validated results (harness v1.0)

| Dataset | Scores | Strata ≥100 | Abstentions |
|---|---|---|---|
| ZSCAPE | germ 93.6 / tissue 91.0 / broad 91.7 / sub 89.1 | 91.7 | 0/156 |
| ChemFish | tissue 87.7 / sub 78.8 | 84.4 | 6/341 (83% precision) |
| DanioCell | tissue 80.9 / broad 81.9 | 86.2 | 2/470 |

Error-structure analysis: misses are **near-dominated** (right lineage, wrong exact subtype) even under the semantic judge → the headline is a **conservative floor**; true quality is higher. **No systematic native failure.** Several "misses"/abstentions were the labeler being *correct against a wrong reference* (flagged GT doublets; declined units whose GT-defining marker isn't expressed; followed markers on units whose DEGs contradict their GT label). Abstention is size-calibrated (declines only under-powered units; also refuses technical artifacts).

## Contamination incident (must not reintroduce)

An earlier ChemFish run (`ba32de`) was silently grounded on the **wrong dataset's** :5007 stats: `dsOf(id) = DATASET_CFG[id] ?? DATASET_CFG.minifin` — ChemFish was unregistered (stale deploy from a 250 MB Vercel bundle failure) → fell back to MiniFin's 54-cluster data. Symptoms: "rank 0/54", markers reported depleted that were actually enriched (`cdc14ab` −0.67 vs true +4.1). This contaminated the early harness diagnosis — several apparent "harness flaws" were the labeler reasoning correctly over corrupted grounding. **Lesson: a corrupted measurement channel masquerades as a model failure; verify grounding before trusting/optimizing.**

Fixes (both live):
1. **Fail loud** — unknown dataset → HTTP 400, no silent fallback. Kills the bug class.
2. **`verify_grounding()` guard** in the worker, runs *before* grounding/spend: asserts a known marker's **log2FC ≥ 1.0** (enrichment direction — size-robust; significance required only at n≥50) + cluster-count bound. Halts if misaligned. A real swap shows log2FC ≈ 0/negative; an aligned tiny cluster shows high log2FC but non-significant padj (don't gate on padj alone).

## Harness v1.0 (the validated configuration)

After the contamination revealed several nudges were artifact-motivated, the harness was **stripped to the defensible minimum**:
- **Kept:** fail-loud `dsOf` + `verify_grounding()` guard (infra); **cite-only-confirmed-positives** (assign only on Archivist-enriched markers); **assign-at-supported-depth** (commit a grounded regional/lineage identity rather than abstain demanding a terminal subtype).
- **Reverted:** "gestalt-over-tag" (motivated by the contaminated c46) and "coverage-teeth co-expression requirement" (targeted a de-novo-clustering heterogeneity failure mode — c28 — that **pure native units cannot produce**; also over-tightened a valid regional call).
- Validated on diagnostics: c46→retinal neuron, c8→regional assign, both with clean (all-enriched) citations.

## No-GT deployment (MegaFin / MiniFin)

These lack ground truth → labeled **open-vocab** (no constraint), reported as **coverage + grounding**, never accuracy:

**MegaFin Part 1 design (CSO spec — Patrick).** Kit = **Evercode WT Mega**. Perturbation = small molecules. **96 conditions designed**, 0 replicates. Zebrafish line **TU Wildtype**, **6 embryos/well** on a 96-well plate, **treatment window 24→48 hpf**, dissociation + fixation at **48 hpf**. The 96 conditions:
- **45 test small molecules × 2 concentrations** (1 µM & 5 µM) = 90 wells
- **2 positive control** — Sorafenib (anti-angiogenic), 1 µM & 5 µM
- **2 vehicle control** — DMSO at 0.01% (matches the 1 µM drug wells) and 0.05% (matches the 5 µM drug wells)
- **2 no-vehicle control** — egg water only

**3 wells QC-removed** (cell-size-filter shoulder / "UMAP explosion", almost no cells): **Vorinostat 1 µM (B11)**, **Romidepsin 5 µM (C3)**, **Dinaciclib 5 µM (E3)** → **96 − 3 = 93 samples sequenced/analyzed** (matches both delivered objects). This is exactly why those 3 drugs appear single-dose in the data. *Flagged-but-kept (high doublet rate):* Pazopanib 1 µM (B8), Entinostat 5 µM (C1), ctrl_no_DMSO (H3).

**Verified cell counts (from h5ad `sample`/`samples` metadata; Manual 537,959 / Parse 540,946 cells):**

| Group | Manual | Parse |
|---|---|---|
| Egg-water (no-DMSO) control | 5,519 (1.0%) | 5,513 (1.0%) |
| DMSO vehicle control | 12,472 (2.3%) | 11,886 (2.2%) |
| Sorafenib positive control | 11,996 (2.2%) | 12,032 (2.2%) |
| 45 test small molecules | 507,972 (94.4%) | 511,515 (94.6%) |
| **Negative/vehicle controls (egg + DMSO)** | **17,991 (3.3%)** | **17,399 (3.2%)** |
| **Any active compound (45 test + Sorafenib)** | **519,968 (96.7%)** | **523,547 (96.8%)** |

Note on accounting: pharmacologically, "drug-exposed" cells are ~96.7%, but that includes the **Sorafenib positive control (~2.2%)**; the **45 test compounds alone are ~94.4%**. True untreated/vehicle controls (egg water + DMSO) are only **~3.3%** of cells.


| Dataset | Clusters | Coverage | Grounding | Depth | Abstain |
|---|---|---|---|---|---|
| Manual MegaFin P1 (rebuild, Lawson, 537,959 cells) | 84 | 95.2% | 98.6% | 70 ct / 10 tissue | 4 |
| Parse MegaFin P1 (megafin_parse, ENSDARG) | 77 | 98.7% | 98.4% | 73 ct / 3 tissue | 1 |
| MiniFin (de-novo leiden_1.0, 94,616 cells, Parse) | 54 | 100% | 98.5% | 50 ct / 4 tissue | 0 |

Consistency checks (**NOT accuracy**):
- **MiniFin vs prior Zeroshot annotation** (scVI/scANVI/expert — automated, not GT): ~72–74% lineage / ~52–54% cell-type. Cell-type gap is mostly **granularity** (open-vocab stays coarse where it won't guess an ungroundable subtype). 7 cross-lineage conflicts adjudicated on :5007 markers → **4 prior-error / 1 labeler-error / 2 marker-ceiling** (labeler > prior on hard conflicts; prior errors logged at `PRIOR_ANNOTATION_CORRECTIONS.md`: c41/c27/c29/c24).
- **Manual vs Parse processing-consistency:** 80% aligned / 71% cell-weighted; 7 conflicts → 4 Parse-better / 1 Manual-better / 2 ambiguous; **only 1/77 a flat labeling error → labels robust to pipeline.** Aligned via barcode crosswalk (100% drug-sample concordance, 0.994 expression corr).

## UI / cards (live)

Flow: dataset → model → **harness** → map. Card picker has two labeled sections: **"Ground-truth benchmarks"** (ZSCAPE/ChemFish/DanioCell, native-schema scorecards, in-paradigm vs independent badges, shared "reading the benchmarks" line) and **"Internal atlases — coverage & grounding (no-GT)"** (Manual/Parse MegaFin, MiniFin) headed *"not accuracy, not comparable to benchmark figures above."* All framing is honest-scoping: not cross-comparable, semantic-judge floor, DanioCell coarse caveat, ChemFish 31%→87.7% correction shown (not hidden), abstention-as-feature.

## Harness registry (latest feature)

`scripts/snapshot_harness.py` mints versions into `harness_registry.json`. **v1.0 "native-validated"**, 2026-06-15, commit `ecef07d3`. Pins: **sha256 of behavioral config** (3 API routes + worker guard functions, by name — narrowed so plumbing edits don't bump it), git commit, `model=gpt-5.5`, and the validation record (precise scores stored; card rounds for display; `scoresArePrecise:true`; 6 labeled runs, $77.52 total).
- **`scoreChannel` block:** semantic judge is stochastic (~10% borderline verdict-flip, ±2–3pt aggregate). A version delta must exceed ~±3pt (unpaired) to count; **paired re-scoring of both versions in one pass is the sensitive comparison path** (cancels shared noise, detects sub-3pt deltas). Did NOT force temperature on the reasoning-model judge.
- **`externalDependencies` block:** gpt-5.5 is a floating alias (may drift — pin a dated snapshot when available); :5007 grounding data is **not** hashed → identical config hash is *config-reproducible only, not behavior-identical*.
- Selecting a harness records its id/version/commit in run provenance (`buildRunJSON`). Run-list dates fixed (was epoch-1969 from a null `exportedAt`); validated runs tagged v1.0, older runs honestly untagged.

## Operating principles (carry forward)

A benchmark score is a property of **(harness × dataset)** — hence versioning. Verify grounding integrity AND unit-representativeness before trusting/tuning (de-novo clusters ≠ pure native units). The reference is fallible — the labeler can be more right; read disagreements case-by-case. Read error *structure* (near/gross/marker-ceiling), not just the aggregate. Don't overclaim — apply honest-scoping to good news too (e.g., "labeler 4:1 on the *hardest* conflicts," not "beats our annotation").

## Current state / open items

All live on `main` (latest commit `77d07c3e`), wizard HTTP 200. Guards active, sidecars verified healthy, stale atlas-mismatched runs archived (`_archive.json`, not deleted). **Open:** pin gpt-5.5 to a dated snapshot when offered (re-mint v1.0); version :5007 sidecars per harness if full reproducibility is ever needed; apply the logged MiniFin prior-annotation corrections. Key files: `harness_registry.json`, `snapshot_harness.py`, `/data/scratch/bench/nogt_run/ANALYSIS.json`, score outputs + transcripts under `/data/daniotype_runs/`.
