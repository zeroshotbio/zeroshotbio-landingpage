# DanioCell hierarchical-labelling pilot — 2026-06-20

Tests whether **two-level de-novo labelling** (re-cluster a tissue → label each sub-cluster:
tissue, then a conditional fine cell type) beats the **flat** baseline (label native clusters
directly). Three tissues: eye / muscle / glial. Isolated, additive, de-leaked. Not promoted.

## Method
1. **Tissue subset is IMPOSED from GT** (authors' published `tissue` labels select eye/muscle/glial
   cells) — this pilot does NOT test from-scratch tissue discovery.
2. **Fresh per-tissue re-embed**: HVG → PCA → neighbors → Leiden sweep (res 0.2–1.0, finest with
   silhouette > 0). *No Harmony — the on-box object has no batch/stage covariate; documented.*
   → eye 32, muscle 20, glial 38 sub-clusters (90 total, 57,159 cells).
3. **Two-step labelling** per sub-cluster: open-vocab de-novo (markers only, frozen) → bin to tissue
   (19-menu) → bin to a fine cell type from THAT tissue's children (conditional) or NO_MATCH (escalate).
4. **GT = `identity.super`** (Sur et al. 2023; cluster_annotations.csv) — the fine, nameable tier.

## Results (candidate-set size beside each menu-cell score)
| tissue | tissue-exact | cell-exact (candset) | de-novo-sem cell | escalation | junk rec |
|---|---|---|---|---|---|
| eye | 27/32 = 84% | 15/32 = 47% (12) | — | 18.8% | 0/0 |
| muscle | 12/20 = 60% | 9/18 = 50% (15) | — | 5.0% | 0/2 |
| glial | 18/38 = 47% | 4/38 = 11% (11) | — | 31.6% | 0/0 |
| **overall** | **menu 63.3% / de-novo-sem 57.5%** | **menu 31.8% / de-novo-sem 66.7%** | | | |

## Kill condition — FAILED → drop hierarchy
- **Matched tissue tier:** de-novo-semantic **57.5% vs flat 80%** (worse); menu-exact 63.3% vs 60% (≈tie).
- **Cell tier:** de-novo-semantic **66.7% vs flat 77.8%**; menu-exact 31.8% vs 55.6% — both worse.
- **Cost:** $0.000344 / labelled cell; flat baseline didn't track per-cell cost → no clear cut.
- **Verdict: hierarchical does not beat flat at matched tiers and does not clearly cut cost.**

## Why — the propagation cascade (the diagnostic firing)
Re-clustering creates progenitor/ambiguous sub-clusters whose de-novo calls **drift off-tissue**;
the conditional fine menu then inherits the wrong candidate set. **glial is the clearest**: CNS-under-glial
sub-clusters land on "neural" (47% tissue → 11% cell), 31.6% escalation. Flat labelling of the native
clusters avoided this cascade.

## Caveats (honest)
- **Tiers not fully matched**: flat baseline scored vs coarse `cell_type_broad` (43); this scored vs the
  finer `identity.super` (144) — a harder target, which depresses the cell number somewhat.
- No Harmony (no batch covariate); re-embed over-split (90 sub vs ~38 fine identities).

## Provenance
partition `4ce6087667d38f57` · gt-label `2278d043c64f7adf` · menu `cc6402b1b7eb0250` · judge driver/v2 ·
harness daniocell-hier/v1.0 · de-leak asserts (neutral prompt label, word-boundary, pre-spend) held on all 90.

## Files
`run_bundle.json` (importable — 90 sub-clusters, transcripts + de-novo + 2-step menu + scored GT) ·
`aggregate.json` (full per-tissue + kill condition + per-sub-cluster rows) · `reembed/` (sub-atlases).
