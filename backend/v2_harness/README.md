# v2.0 harness — top-down expectation-guided recursion (MVP/POC)

The new control flow from the v2.0 design entry, built **alongside** the served v1.1
`run_one_cluster` (which is unchanged). It reuses the existing gpt-5.5 three-personality
machinery (prod `/api/kasperov_agent`: Researcher→Archivist→Reasoner) unchanged — these
scripts add only the orchestration:

1. **coarse-first labelling** of the coarse compartments,
2. an **expected-tissue gap check** (which known-findable tissues are still unnamed),
3. **selective recursion** routing — recurse only into the compartment(s) experiential
   priors say hold the missing tissues (GT-blind: keyed off the labeller's own coarse calls),
4. **top-down context** — the confirmed parent umbrella is injected into each sub-leaf call,
   plus the experiential-knowledge hints.

## Files
- `build_substrate.mjs` — builds the GT-blind substrate (compartments + leaves + markers)
  from the recursive build's `clusters.json`. GT is written to a **separate** file and never
  enters any prompt.
- `v2_config.mjs` — hand-authored MVP config: expected-tissue checklist, experiential bank,
  routing rules, run plan.
- `v2_harness.mjs` — the orchestrator. Writes `zscape_v2_trace.json` incrementally.
- `recompute_gap.mjs` — re-derives the gap/match over an existing trace (no new inference).

## Data (NOT in the repo — lives on the build box)
`/data/scratch/bench/v2_mvp/` holds `zscape_v2_substrate.json`, `zscape_v2_gt.json`, and the
produced `zscape_v2_trace.json`. The trace is also bundled into the viewer
(`src/app/daniotype_kasperov/v2/zscape_v2_trace.json`) so the staging page renders on Vercel.

## Run
```bash
KPW='<KASPEROV_BASIC_PASSWORD>' node backend/v2_harness/v2_harness.mjs   # uses prod gpt-5.5
```

## Status
Design-stage MVP. NOT the served harness, NOT wired into production, NOT GT-scored. The
viewer at `/daniotype_kasperov/v2` walks the produced trace in judgement mode.
