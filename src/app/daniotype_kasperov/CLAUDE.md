# DanioType / Kasperov — read this before touching the pipeline

The cell-type-labelling pipeline: clustering → labelling → merging → final judge. Four stages, each
with a canonical spec and an append-only ledger in `pillars/<stage>/`.

## 1. The rule (do this first)
Before touching a pipeline stage, **read `pillars/<stage>/SPEC.md` and skim its `LEDGER.md`.**
Before proposing an experiment, **grep the LEDGER for it** — if it's marked `FALSIFIED` with
`do-not-retry`, don't propose it.
*Why this file exists:* both Steven and a prior AI advisor have re-proposed already-falsified ideas
(control-only clustering, this month). The ledger is the fix — it only works if you read it first.

## 2. Cardinal norms
- **Verify against disk. Never parrot a prior summary** — re-check the file, the run, the number.
- **A clean negative is a first-class result.** "We tested it, it doesn't work, here's why" ships.
- **Gate every irreversible or expensive action** — report-and-hold, don't autopilot into a write.
- **Offline/scratch first, then ship.** Measure on the fixed judge before touching a live path.
- **Core stays dataset-agnostic; dataset-specific fixes go in adapters**, not the shared program.
- Write bursts, not essays. Don't over-engineer.

## 3. Provenance rule
A behavior change means all three: **bump the SPEC `version`** + **append a LEDGER entry** +
**stamp the run's `pipeline.<stage>.spec`** (in its `.canonical.json`).
**SPEC header = current canon. Run stamp = what actually produced that run. They legitimately differ**
(a golden can carry an older version than live code). Drift = a failing test:
`python3 scripts/test_provenance_binding.py`.

## 4. Known traps (highest-value section)
- **`route.ts` is the LIVE labelling path; `personas.ts` is a display-only mirror.** Verify
  target-vs-mirror before any prompt edit — editing the mirror changes nothing live.
- **`coerceTier` in `operator.ts` silently mangles unknown tiers.** Check it before adding a tier.
- **Canonical clustering scripts live on-instance in `scratch/bench/`, NOT version-controlled.**
  `pillars/clustering/SPEC.md` is the only durable record of the recipe.
- **res08 (149 leaves) is NOT the golden partition; v2_full (250) is.** res08 residue survives in the
  design-stage v2.0 harness + an unlinked viz — benign, non-canonical.
- **The live labeller is 4-tier.** The six-tier CARO/ZFA schema is proven offline, not shipped.
- **The served golden (`9258bd`, Jul-3) predates burst-30/34 — it's `labelling-v1`/`merging-v1`
  while live code is v2.** No golden has been minted since those improvements shipped.
- **`dataset_facts.json` scorecard/provenance is stale (2b, parked)** — stale model/scores/clustering
  description for zscape/chemfish/daniocell. The drift test *warns* on this; don't be surprised.
- **Three labellers exist** — `run_leaf_v2` (app.py, produced the golden — the *proven* one),
  `kasperov_agent/route.ts` (thinner browser path), `kasperov_confidence/route.ts` (forms the scored stack).
  If you ever collapse the fork, collapse TOWARD app.py, not away. See `pillars/labelling/LEDGER.md` #8.
- **The scored broad tier is only as good as `/api/kasperov_confidence`** — that endpoint forms
  germ/tissue/broad, not `run_leaf_v2`. A prompt rule (e.g. burst-30) must live there to affect scoring.

## 5. Where things live
- **Pillars:** `pillars/{clustering,labelling,merging,judge}/{SPEC,LEDGER}.md`.
- **Run store:** `/data/daniotype_runs/<dataset>/<runId>.json` (+ `.canonical.json` sidecar).
- **Services:** `:5007` minifin_query · `:5008` autopilot · `:5011` graphjudge.
- **Golden vs scratch:** golden runs carry `golden:true` (zscape) or are named by
  `GOLDEN_RUN_BY_ATLAS` (KasperovClient.tsx). Scratch/experimental runs are badged, `golden:false`.
- **Two pointer sources:** `GOLDEN_RUN_BY_ATLAS` (atlas-keyed, UI-authoritative) and
  `scripts/canonical_runs.json` (datasetId-keyed). They agree only for zscape (see
  `pillars/README.md ## Known drift`).

## 6. How to update this file
New trap discovered, or a pillar version bumped → edit here. Keep it a **router**: depth goes in
SPEC/LEDGER, not here. If a section grows past a page, cut — don't compress the pillars in.
