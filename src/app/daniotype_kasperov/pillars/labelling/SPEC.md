version: labelling-v2
last-verified: 2026-07-14
authoritative-file: src/app/api/kasperov_agent/route.ts (reasonInstructions)

# Fine-leaf labelling — three-personality de-novo → menu-exposed

Live path: `/api/kasperov_agent`, mode `reason` → `reasonInstructions()` in route.ts. Both the browser
wizard and the worker autopilot call it. Researcher (ZFIN/ZFA/GO evidence) → Reasoner (open-vocab
4-tier de-novo conclude) → menu-exposed binning. **`personas.ts` is a DISPLAY MIRROR only** (the
"2. Model & Harness" tab), never the live prompt.

## Canon
- Reasoner emits a 4-tier stack `{germ_layer, tissue, cell_type_broad, cell_type_sub}`.
- **Broad-tier REUSE-SPECIFIC-TERM rule** — at cell_type_broad, reuse the specific ZFA term the
  Researcher surfaced rather than coarsening to a superclass (burst-30, shipped commit `6202c41e`).
- gpt-5.x; Archivist available but not auto-invoked in the golden run (DEFAULT-to-CONCLUDE).

## Known drift
- The six-tier CARO/ZFA retarget is **offline MVP only** (scratch runs); route.ts is still 4-tier.
- ⚠ **The served golden (`9258bd`, Jul-3) is `labelling-v1`** — it predates burst-30 (broad-tier rule,
  shipped 2026-07-14). Live code is v2; **no golden has been minted since the improvement shipped.**
  SPEC header = current canon (v2); the run stamp = what actually produced it (v1). They legitimately differ.

## Changelog
- **v2 (2026-07-14)** — broad-tier reuse-specific-term rule added to reasonInstructions (commit `6202c41e`). → LEDGER #1
- **v1** — 3-personality de-novo → menu-exposed, no broad-tier phrasing rule. The state that produced the
  Jul-3 golden `9258bd`. Superseded by v2, retained so the golden's stamp resolves.
