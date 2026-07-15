version: clustering-v3
last-verified: 2026-07-15
authoritative-file: scratch/bench/build_zscape_recursive_v2_full.py

# Clustering — two-stage recursive local-HVG Leiden

Groups the ZSCAPE 48 hpf cells (813,782 of the full 3,231,733) into fine leaf clusters
GT-blind, then names each leaf from all cells (control-only vote kept as secondary).

## What it does
1. **Coarse pass** — Leiden res 0.1 over all cells → broad compartments (igraph flavor).
2. **Per-compartment recursion** — for each compartment ≥500 cells: recompute 2,000 local HVGs on
   the subset → scale → PCA(50) → 15-NN → local Leiden res 0.8 (leidenalg). Local features are what
   surface rare tissues (blood / pancreas / liver). → **250 fine leaf clusters**.
3. **Naming (v3)** — all cells vote each leaf's tissue name; the control-only vote (`gene_target`
   startswith `ctrl-`) is kept alongside as secondary (the diff is useful — see LEDGER #3). The
   partition is GT-blind and unchanged by the vote; names are a provisional scaffold.

## Params that matter (verified on disk)
COARSE_RES 0.1 · MIN_COMP 500 · N_HVG 2000 (seurat) · SCALE_MAX 10 · N_PCS 50 · N_NEIGHBORS 15 ·
LOCAL_RES 0.8 · SEED 7 · vote = **all-cells primary, control-only secondary** (v3). Golden = 250 leaves.

## The shared-program boundary (why the recipe is shaped this way)
Distinct transcriptional programs separate cleanly. **Shared programs do NOT split at any resolution
or depth** — sarcomeric muscle (fast/slow/cranial share the sarcomere program) and 48 hpf endoderm
(liver/gut/pancreas share a common endoderm program) stay entangled. Local-HVG recompute is what lets
rare-but-distinct tissues surface; it cannot separate a genuinely shared program. See LEDGER #5, #9, #12.

## Known drift
- ⚠ The authoritative script lives on-instance at `scratch/bench/build_zscape_recursive_v2_full.py`,
  **NOT version-controlled**. This SPEC is currently the only durable record of the recipe.
  Open question (later burst): vendor the build scripts into the repo. Do not move files yet.
- ⚠ Harness scores banked against the OLD `build_zscape_asset.py` partition sit on a **defective build**
  (no local-HVG recompute — it never ran the mechanism) and should be **re-banked onto v2**.

## Changelog
- **v3 (2026-07-14)** — leaf naming vote switched control-only → all-cells. Partition unchanged (vote
  does not touch clustering). Justified by LEDGER #3: 0% tissue-identity flips between the two votes.
  Simplification, not an accuracy claim. Supersedes v2. → LEDGER #3, #14
- **v2 (2026-06-29)** — single local level, res 0.8, control-vote, local-HVG recompute. Supersedes
  v1 (flat res-2.0 / `build_zscape_asset.py`, no local recompute — defective). → LEDGER #1, #2
