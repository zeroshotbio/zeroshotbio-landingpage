version: merging-v2
last-verified: 2026-07-14
authoritative-file: src/app/meta_reasoner/operator.ts (buildOperatorPrompt)

# Merging & Meta-Reasoner — fine-then-consolidate operator

Live path: `/api/meta_reasoner` `op:consolidate` → `buildOperatorPrompt()` (GT-BLIND — sees only leaf
ids + predicted labels). Four ops: **MERGE** (group leaves restating one identity), **SET_ASIDE**
(keep a genuinely distinct leaf as its own node), **ASSIGN-TIER** (deepest defensible tier per node),
**PREJUDICE-OF-SHAPE** (global audit flagging expected tissues left unaccounted — a hint, never a
licence to invent). ZSCAPE golden: 250 leaves → 70 nodes (29 merges + 41 set-aside).

## Canon
- **node_label CLEAN-PHRASING rule** — one clean canonical anatomical term per node: no `X / Y`
  slash-compounds, no parenthetical qualifiers, no verbose coining; may reuse a member label OR coin a
  clean shared abstraction (burst-34 variant C, shipped commit `a931020e`).

## Known drift
- Consolidation is **net-neutral-to-negative on clean (post-burst-30) leaves** — the recon's +0.215
  was phrasing-rescue, now done upstream (LEDGER #2). Over-merge is an open, un-bundled lever (LEDGER #4).
- ⚠ **The served golden (`9258bd`, Jul-3) is `merging-v1`** — it predates burst-34 (node_label
  clean-phrasing, shipped 2026-07-14). Live code is v2; **no golden has been minted since.**
  SPEC header = current canon (v2); the run stamp = what produced it (v1). They legitimately differ.

## Changelog
- **v2 (2026-07-14)** — node_label clean-phrasing added to buildOperatorPrompt (commit `a931020e`). → LEDGER #1
- **v1** — fine-then-consolidate operator without the node_label phrasing rule. The state that produced
  the Jul-3 golden `9258bd`. Superseded by v2, retained so the golden's stamp resolves.
