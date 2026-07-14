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
