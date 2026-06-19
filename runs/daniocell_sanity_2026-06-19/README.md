# DanioCell 10-cluster sanity check — 2026-06-19

Isolated, additive, de-leaked sanity check. **No** canonical scorecard, index, or leaked
baseline was touched; all outputs live here and are trivially revertible.

## Invariants verified
- **De-leak CONFIRMED (per cluster).** Phase-1 input prompts carry DEG markers only; the
  cluster's true tissue and true cell type appear in **no** user/input message (asserted per
  cluster; the run halts on any violation). First prompt opens `Cluster {id}'s top up-regulated
  markers are:`. Clust-code labels (`mese.5`, `eye.18`) — whose prefix encodes the tissue — were
  replaced with `Cluster {id}`.
- **Two-stage order CONFIRMED.** (a) open-vocab de-novo name produced + **frozen** (recorded with
  `frozenAt`), (b) only then the menu is constructed and the frozen name binned. Menu vocab appears
  in **no** phase-1 input (asserted; halt on violation).
- **Tiers correct.** DanioCell native has exactly two populated tiers: **tissue** (19-vocab)
  and **cell type** (`cell_type_broad`, 43-vocab — DanioCell's finest *nameable* level).
  `germ_layer` and `cell_type_sub` are null in the native schema and were **not** fabricated.
- **Provenance stamped.** Per-cell partition sha `4ce6087667d38f57` (`daniocell_native_labels.csv`),
  GT-label sha `0e6779403c07b18c`, menu sha `849f36bf06ca3a42`, harness `daniocell-sanity/v1.0`, judge `driver/v2` — on every
  artifact. The scored bundle carries `scored: true` (never "NOT scored").
- **Channels unblended.** `menu-exact` (string match) and `denovo-semantic` (driver/v2 judge) are
  reported separately, each with explicit denominators. Abstains recorded; a not-attempted tier is
  neither credited nor penalized but tracked.

## Files
- `run_bundle.json` — importable run (Import in the chat interface) — 10 clusters, transcripts + deNovo + menu + scored groundTruth.
- `transcripts/cluster_<id>.json` — per-cluster chat transcript + de-leak proof.
- `three_way_table.md` — the per-cluster three-way table + aggregate.
- `aggregate.json` — tissue + cell type × (menu-exact, de-novo-semantic), with denominators.
- `sample.json` — seed + cluster IDs + all provenance hashes.

Seed **31337** · clusters ['28', '87', '92', '104', '154', '161', '258', '304', '348', '423']
