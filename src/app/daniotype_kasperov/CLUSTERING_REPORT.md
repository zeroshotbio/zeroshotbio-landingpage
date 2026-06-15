# How DanioType clusters each atlas — process report

A walk-through of exactly how the de-novo clusters behind every `daniotype_kasperov`
dataset card were produced, pulled from the build scripts (`scripts/build_*_asset.py`,
`scripts/cluster_sweep_*.py`) so the process can be double-checked. Numbers match
`dataset_facts.json`. Everything is deterministic (`random_state = 7`, Leiden seed fixed).

## The shared pipeline

Five of the six atlases follow one recipe; ZSCAPE is the deliberate exception (below).

1. **Input & cell selection.** Start from raw integer counts. For the two atlases too
   large to cluster whole, take a *uniform random* subsample (not a biological subset):
   ZSCAPE 250,000 of 3,231,733; ChemFish 250,000 of the 48-hpf slice. DanioCell, MiniFin
   and the MegaFin builds are clustered in full.
2. **Normalisation.** Keep the raw matrix for marker math, then on a copy:
   `normalize_total(target_sum = 1e4)` (CP10k) → `log1p`.
3. **Feature selection.** Highly-variable genes — 2,000 (ZSCAPE, `seurat_v3` on the raw
   layer) or 3,000 (`seurat`) elsewhere — then `scale(max_value = 10)`.
4. **Linear embedding.** PCA, 50 components (`arpack`).
5. **Batch integration.** Harmony on the relevant nuisance key — *experiment* (ChemFish),
   *developmental stage* (DanioCell), *drug sample* (MiniFin). MegaFin reuses a carried
   Harmony embedding (below); ZSCAPE uses none.
6. **Graph + clustering.** A 15-nearest-neighbour graph on the integrated embedding, then
   **Leiden** (`igraph` flavour, 2 iterations, undirected) swept across resolutions
   1.0–5.0 (MegaFin-Parse 1.0–3.0).
7. **Resolution choice — coherence.** This is the core idea. For every candidate
   resolution we score each cluster 1-vs-rest on CP10k counts and call it **coherent** if
   it carries **at least one marker gene** that is simultaneously: enriched
   `log2((mean_in+1)/(mean_out+1)) ≥ 1` (≥2×), prevalent `pct_in ≥ 0.25`, and specific
   `pct_in − pct_out ≥ 0.15`. The **selection rule** keeps the *finest* resolution where
   `coherent_frac ≥ 0.95` **and** `min_size ≥ 30` — coarse enough that every cluster has a
   real marker signature, fine enough to be biologically useful. Each sweep is saved
   (`*_res_sweep.csv`) and rendered on the "How we clustered" page.

The coherence metric is identical across `cluster_sweep_minifin.py`,
`cluster_sweep_megafin.py`, and the inline versions in the ChemFish/DanioCell builders, so
the partitions are comparable in *how* they were chosen even though they are not
score-comparable.

## ZSCAPE Classic — silhouette-gated recursive sub-Leiden

ZSCAPE does **not** use a flat sweep. From a 250,000-cell uniform random sample of the
3.23M-cell perturbation reference (every condition, drug-treated and control alike), we
take HVG (2,000, `seurat_v3`) → PCA(50) → 15-NN → a single **global Leiden at resolution
2.0** (no Harmony — the reference is already a coherent embedding). Then we **recursively
sub-split**: every global cluster with ≥ 4,000 cells is re-clustered at resolution 1.0, and
the split is **accepted only if** it yields ≥ 2 sub-clusters, each leaf keeps ≥ 600 cells,
**and** the mean silhouette of the split (on PCA coordinates, sampled) is ≥ 0.05. Splits
failing any test are rolled back. This adaptive, per-branch descent gives **55 leaf
clusters** spanning all four native tiers (germ layer → tissue → cell-type broad →
cell-type sub). Silhouette gating is what lets us trust each leaf: a sub-cluster only
survives if it is geometrically separated, never merely over-fragmented. This is why the
ZSCAPE card shows a `subSplitNote` rather than a resolution sweep table.

## ChemFish — 48-hpf subset, Harmony on experiment

ChemFish ships ~2M cells across 36/48/72 hpf and two screens (CHEM10 DSP, CHEM11 BS3). For
parity with the other 48-hpf atlases we take the **48-hpf cells only** (`timepoint == "48"`)
and a uniform random **250,000** of them (of 1,579,675 at that timepoint). Pipeline: HVG
(3,000) → PCA(50) → **Harmony on `expt`** (so the two screens integrate rather than split
by batch) → 15-NN → UMAP → Leiden sweep 1.0–5.0. The sweep selects **resolution 3.0 → 78
clusters**, with `coherent_frac = 1.0`, `min_size = 40`, only one cluster under 50 cells.
Lower resolutions were coarser (res 1.0 = 46 clusters); higher ones (4.0/5.0) pushed
several clusters below the size floor, so 3.0 is the finest fully-qualifying partition. The
gene namespace is mapped ENSDARG → canonical ZFIN symbols via the shared map so markers
ground on the same `:5007` service as the other atlases.

## DanioCell — independent, Harmony on stage

DanioCell (Sur/Farrell, NICHD; 10X droplet) is the genuinely cross-platform atlas. We take
the **36–72 hpf window** (191,832 cells; below the 260k subsample cap, so all are used),
HVG (3,000) → PCA(50) → **Harmony on `stage.integer`** (so the developmental-time axis
doesn't dominate the partition) → 15-NN → UMAP → Leiden sweep 1.0–5.0. Selected:
**resolution 2.0 → 77 clusters**, `coherent_frac = 1.0`, `min_size = 188`, zero clusters
under 50 — an unusually clean partition (every resolution scored coherence 1.0, so the size
floor and "finest still-clean" rule pick 2.0 over the coarser 1.0). Because the publication
ships only tissue- and figure-level labels (the finest `clust` codes are numeric, not a
nameable vocabulary), scoring is later restricted to the tissue/broad tiers — but that is a
scoring decision, not a clustering one.

## MiniFin — internal Parse reference, Harmony on sample

MiniFin (94,616 cells, Parse Evercode, 43 drug samples, 48 hpf) is clustered in full: HVG
(3,000) → PCA(50) → **Harmony on `sample`** (the 43 drug conditions, so drug identity
doesn't shatter the partition) → 15-NN → UMAP → Leiden sweep 1.0–5.0. Selected:
**resolution 1.0 → 54 clusters**, `coherent_frac = 0.981`, `min_size = 180`, zero under 50.
Resolution 2.0 reached 74 clusters at coherence 1.0 but introduced a sub-50-cell cluster,
so by the "finest qualifying" rule 1.0 wins — MiniFin is a coarse intuition-building
reference, not a benchmark, so we stay conservative.

## MegaFin Part 1 — Parse build (megafin_parse)

The Parse/Trailmaker pipeline delivers `parse_megafin1.h5ad` (540,946 cells) **with its own
batch-corrected Harmony embedding already attached** (`X_harmony`, integrated on sample).
We therefore do **not** re-embed: `cluster_sweep_megafin.py` builds a 15-NN graph directly
on that carried embedding and sweeps Leiden 1.0/2.0/3.0. Selected: **resolution 3.0 → 77
clusters**, `coherent_frac = 0.974`, `min_size = 203`, zero under 50. Trusting the vendor
embedding is the deliberate choice here, validated by the consistency check against the
Manual build (only 1/77 a flat labeling disagreement).

## MegaFin Part 1 — Manual build (megafin), and why the embedding was kept

The Manual build starts from the independently, manually-denoised Lawson `.h5ad`
(537,959 cells) for the **same library**. The obvious move — re-embed from scratch with our
standard recipe (HVG → PCA → Harmony[sample] → neighbours) — was **tested and rejected**:
coherence *collapsed* to 0.475–0.667 with 56–63 micro-clusters across the sweep, far worse
than the carried Parse embedding. The 93-sample (96-condition) drug screen's biological
heterogeneity is simply too much for a naïve re-embed. So we **kept the carried Parse
Harmony embedding** and swept Leiden on it. Here the strict `coherent_frac ≥ 0.95` rule is
unreachable — coherence plateaus around **0.929** because real drug-perturbed states blur
some boundaries — so we use a **relaxed "branch-3" pick**: the finest resolution in the
50–90-cluster window at the coherence plateau. That is **resolution 2.0 → 85 clusters**;
one 29-cell periderm fragment (C67) was merged into its parent (C61), giving the final
**84 clusters** (`min_size = 9`). The card flags this honestly: less coherent (0.929) than
the GT partitions (~1.0), with the rejected re-embed sweep shown alongside.

## What to double-check

- **Subsampling is random, not curated** — ZSCAPE/ChemFish 250k draws span all conditions;
  they are not control-only and not biased toward any state.
- **Coherence is the confidence proxy** and is identical everywhere; ZSCAPE adds silhouette
  gating on top. Neither uses the published labels — clustering is fully blind, so the
  later accuracy scores are honest.
- **MegaFin is the one relaxed selection** (0.929 plateau, branch-3 pick, C67→C61 merge);
  every other atlas meets the strict ≥0.95 / ≥30-cell rule at its chosen resolution.
- **Reproducibility:** fixed seeds make each partition deterministic, but Harmony and the
  random subsample mean an identical re-run needs the same input object and seed.
