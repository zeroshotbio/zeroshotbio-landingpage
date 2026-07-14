# Merging & Meta-Reasoner — improvement ledger (append-only, newest last)

### 1 — node_label clean-phrasing rule (variant C) — [SHIPPED]
2026-07-14 · give each consolidated node ONE clean canonical term — no slash-compounds, no
parentheticals, no verbose coining; reuse a member label or coin a clean shared abstraction · result:
won the A/B/C phrasing bake-off, best node-label graph scores without regressing the merge topology ·
verdict: shipped to buildOperatorPrompt (commit `a931020e`). do-not-retry: n/a.

### 2 — Consolidation as a SCORE lever on clean leaves — [FALSIFIED]
2026-07-13 (burst-32 re-audit) · re-measure the recon's +0.215 consolidation gain on POST-burst-30
(clean-phrasing) leaves · result: **net neutral-to-NEGATIVE** — the original +0.215 was almost
entirely phrasing-rescue, which the upstream broad-tier rule now does. Merging clean leaves does not
raise the graph score · verdict: consolidation earns its keep as a STRUCTURE step (250→70 readable
nodes), not a score step. do-not-retry: as a score lever, yes.

### 3 — Variant A (plurality node label) / Variant B (operator-picks) — [FALSIFIED vs C]
2026-07-14 · A = label each node by member-plurality; B = let the operator free-pick · result: both
lost to C's explicit phrasing discipline (A stale/coarse, B re-verbosified) · verdict: superseded by
#1. do-not-retry: yes.

### 4 — Over-merge audit (does consolidation over-collapse distinct leaves?) — [OPEN]
· the un-bundled lever flagged in SPEC "Known drift": consolidation may fold genuinely distinct leaves
into one node under a shared coarse identity · status: not measured this session. do-not-retry: n/a.
