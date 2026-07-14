# Labelling — improvement ledger (append-only, newest last)

### 1 — Broad-tier reuse-specific-term phrasing — [SHIPPED]
2026-07-13 · at cell_type_broad, reuse the Researcher's specific ZFA term instead of coarsening to a
superclass · result: broad de-novo mean **0.417 → 0.572 paired (+0.16)** on 40 ZSCAPE leaves vs the
fixed graph judge · verdict: shipped to reasonInstructions (commit `6202c41e`). do-not-retry: n/a.

### 2 — Anti-slash / one-clean-term at the TISSUE tier — [FALSIFIED]
2026-07-13 · extend the phrasing rule to tissue (no slash-compounds) · result: **−0.10 paired**
(12 worse / 5 better) — shipped slash-compounds resolve robustly via first-token; forcing one word
lands farther · verdict: NOT applied at tissue (broad-only). do-not-retry: yes.

### 3 — Per-tier menu constraint (tier-constrained MX) — [FALSIFIED]
2026-07-13 · constrain the menu-exposed bin to each tier's closed menu · result: coerce ≥ rescue at
EVERY tier (germ 0/1, tissue 0/2, broad 1/2, sub 0/1); the shipped menu-exposed already bins well ·
verdict: no rail. do-not-retry: yes.

### 4 — ZFA-neighborhood injection into the DE-NOVO step — [FALSIFIED]
2026-07-13 · inject OnClass ZFA-neighbor candidates into the Reasoner's de-novo input · result:
net-negative (2×2 ablation); seeds candidates into a step whose failure was phrasing, not knowledge —
the model reasoned toward/away from terms it already knew · verdict: neighborhood has no job in
de-novo; relocate to menu-exposed. do-not-retry: yes (in de-novo).

### 5 — Sub-floor rule (repeat broad at sub, never "none") — [SHELVED]
2026-07-13 · A′ variant: floor the sub tier at broad specificity · result: fixed the sub crater but
collapsed to a pure copy (40/40) on ZSCAPE's DEGENERATE sub tier (GT = broad + a cluster number) —
untestable here · verdict: needs DanioCell/ChemFish (real sub-granularity) before shipping. do-not-retry: re-test elsewhere.

### 6 — Menu-exposed neighborhood-snapping — [UNTESTED]
· the relocated home for ZFA-neighborhood (snap a phrasing to a constrained valid vocabulary at the
menu step, not seed de-novo reasoning) · status: not yet built/measured. do-not-retry: n/a.

### 7 — Root cause of "sub rolled up verbatim up the hierarchy" — [DIAGNOSED, not fixed]
2026-07-14 · the golden's producer (`run_leaf_v2` in app.py) emits ONLY a driver `identity` (the sub
tier) and forms NO germ/tissue/broad stack. The scored 4-tier stack is produced by a SEPARATE endpoint
`/api/kasperov_confidence`, which the headless producer (`run_v2_full.py`, sets `confidence:None`)
never calls. So `_denovo_stack()` finds no `kasperov-conclude` block → the scorer falls back to
`stk.get(tier) or ident` = the sub label rolled up every tier · **fix (unbuilt): the producer must call
`get_confidence` per leaf so the coarse tiers are real labels, not a roll-up.** do-not-retry: n/a.

### 8 — Three labellers exist, not two — [MAPPED; fork-collapse REJECTED as scoped]
2026-07-14 · (1) `run_leaf_v2` (app.py) — **produced the 94% golden**; carries ledger soft-prior,
collision-shape bypass, `_route_depth` gate, the discriminating-marker rubric; lacks burst-30.
(2) `kasperov_agent/route.ts` — thinner browser path; HAS burst-30; lacks all of (1)'s machinery.
(3) `kasperov_confidence/route.ts` — forms the SCORED germ/tissue/broad stack; lacks burst-30 (the
[[labelling]] one-line fix lands here). **The proven labeller is app.py's (1).** Option B (rewire the
producer to the TS endpoints / port app.py→TS) was scoped and **REJECTED**: multi-day cross-language
port toward the WEAKER program. If the fork is ever collapsed, evidence says collapse TOWARD `run_leaf_v2`,
not toward route.ts. do-not-retry: option B as scoped, yes.
