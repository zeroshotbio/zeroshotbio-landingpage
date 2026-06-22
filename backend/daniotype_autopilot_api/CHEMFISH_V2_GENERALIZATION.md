# ChemFish v2 — cross-technology generalization result

**Harness:** frozen at commit `00ee0f27` (collision dominance-gate — final ZSCAPE v2).
No new harness logic for ChemFish; only the dataset stage (`chemfish_v2` → "48 hpf")
set at runtime. Registry key `chemfish_v2` added in `0e571bdc`.

**Asset:** 111 recursive-leaf v2 asset, GT-blind, barcode-exact (`/data/scratch/v2_chemfish/`).
**Grounding:** `chemfish_v2` on `:5007`, guard green (111 clusters, count-bounded).
**Technology:** sci-RNA-seq3 (vs ZSCAPE 10x) — the cross-technology test.

## Result (true cost $6.01 at $5/$30; 261 calls; no $1.50-ceiling leaves)

| tier | ChemFish v2 | ZSCAPE v2 | note |
|---|---|---|---|
| tissue | **75.7%** (84/111) | 74.7% | comparable tier (40-cat vs 34-cat) — generalizes |
| cell_type (broad==sub) | ~55–61% (55/90, 50/90) | broad 75 / sub 65.5 | NOT comparable — ChemFish `cell_type` is 322-category, 2–3× finer |
| germ_layer | — | 87.9% | ChemFish has no native germ-layer tier (scored ChemFish's own labels only) |

- **Abstention precision: 95.2%** (20/21 abstained leaves would have failed a forced fine call) — held vs ZSCAPE's 93.75%, the key behavioral signal.
- **Coverage:** 90/111 = 81% fine assigns. Routing: 90 assign / 21 abstain (10 continuum, 8 n_limited, 3 reasoner-abstain).
- **Endoderm anchors (commercial test):** intestine (leaf 9) and liver/hepatoblast (leaf 11) both named correctly from early programs. Pancreas formed no leaf (64 cells in subsample — n-limited at the partition).
- **Collision discipline transferred:** pigment subtypes melanophore/iridophore/xanthophore all 3 discriminated; chondrocyte correct; notochord mixed (fired on collagen-dominant leaves, not on mature-state notochord leaves whose top markers aren't collagen — data-dependent, not a mechanism failure).

## Bottom line
The frozen harness generalizes across technology: tissue accuracy ~75% (10x → sci-RNA-seq3),
abstention precision ~95%, endoderm anchors correct, collision discipline transferred — zero
harness changes. cell_type absolute number not comparable (322-cat label space).

Run record + scores preserved in `/data/scratch/v2_chemfish/` (`run_v2_chemfish_record.json`,
`run_v2_chemfish_partial.json`, `score_v2_chemfish.json`).
