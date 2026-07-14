# Pillars — canonical spec + improvement ledger per pipeline stage

Four pillars: **clustering · labelling · merging · judge**. Each has:
- **SPEC.md** — current canon only, one page. Header carries `version`, `last-verified`, `authoritative-file`.
- **LEDGER.md** — append-only, newest last. One entry per tested idea, INCLUDING negatives, numbered so SPEC can cite them.

**The rule:** any behavior change bumps the SPEC `version` AND adds a LEDGER entry AND updates the run's `.canonical.json` `pipeline.<stage>.spec`.

**SPEC header vs run stamp — they legitimately differ.** The SPEC `version:` header = *current canon* (the live code state). A run's `pipeline.<stage>.spec` = *what actually produced that run* — an immutable historical fact. A golden run can carry an OLDER version than the header (e.g. the served ZSCAPE golden `9258bd` is `labelling-v1`/`merging-v1` while live code is v2, because it was minted before those improvements shipped and no golden has been re-minted since). That is NOT drift.
Drift = a run stamps a version that is recorded NOWHERE in the matching SPEC file (header or changelog) = a failing test (`scripts/test_provenance_binding.py`). So every superseded version keeps a changelog entry, precisely so old runs' stamps still resolve.
Never edit a past LEDGER entry — append a new one. Anything not backed by disk or the source-of-record doc stays `[UNVERIFIED]`.

## Known drift (recorded, not fixed)
- **minifin/megafin canonical_runs are stale.** `canonical_runs.json` still points them at Jun-15 ids because their `GOLDEN_RUN_BY_ATLAS` targets (`…a10bb8`, `…abad22`) **don't exist in the datasetId run-store** — pointing canonical there would crash `gen_dataset_facts.py`. Separate rot; fix needs the run-store keying reconciled first. The drift test skips these two loudly (does not fail on them).
- **The on-disk `golden:true` flag and the UI `GOLDEN_RUN_BY_ATLAS` map are two sources that only agree for zscape.** chemfish/daniocell goldens have no `golden:true` on disk; the UI map is authoritative and `canonical_runs.json` follows it. We did not invent an on-disk flag.
- **`dataset_facts.json` scorecard/provenance for zscape/chemfish/daniocell is derived from superseded Jun-15 runs** (stale model `gpt-5.5` vs actual `gpt-5.4`, stale scores, stale clustering description). Needs stats **recomputed from the new goldens** via a generator that preserves the hand-authored `clusteringViz`/copy — **not** an id swap (an id swap makes the block internally lie). Not covered by the drift test. Parked as its own burst.
- **No `.canonical.json` writer exists in `app.py`.** Run sidecars (which carry the `pipeline{}` stamp) are written by per-effort scratch assembly scripts, so **new runs do NOT self-stamp** — the stamp is a manual backfill today. Fix when someone next mints a run: a ~15-line `_write_canonical(run, pipeline={…})` in the producer's save step so the golden self-stamps `clustering-v2/labelling-v2/merging-v2/judge-v1`.
