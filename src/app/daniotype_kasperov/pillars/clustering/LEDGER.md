# Clustering — improvement ledger (append-only, newest last)

### 1 — Two-stage recursive local-HVG clustering — [SHIPPED]
2026-06-29 · coarse Leiden 0.1 → per-compartment 2,000-local-HVG → local Leiden 0.8 · 250 leaves;
rare tissues (liver/blood/pancreas) surface where a global HVG pass buries them · verdict: canon
(clustering-v2). do-not-retry: n/a.

### 2 — Control-only naming vote — [SHIPPED]
2026-06-29 · name each leaf from `ctrl-*` cells only (all-cells kept as secondary) · keeps
drug-induced shifts out of the scaffold · verdict: canon. do-not-retry: n/a.

### 3 — Naming perturbation-invariance — [FALSIFIED (the concern)]
2026-07-14 (verified this session) · control-vote vs all-cells-vote names, 250 leaves · result:
germ 0%, tissue 8% — but ALL 19 tissue "flips" are the single muscle-vocab pair Muscle ↔ Cranial
Muscle (Late); zero tissue-IDENTITY changes; broad 2%, sub 12% (granularity) · verdict: naming is
robust to perturbation inclusion (Clever Hans confirmed). do-not-retry: settled.

### 4 — Depth rule v3 (extra local recursion level) — [FALSIFIED]
2026-06-29 · `build_zscape_recursive_v3_full.py` adds a deeper level · result: 352 leaves (= 250
+102 bulk leaves) at full scale, zero scoring payoff · verdict: extra depth adds bulk, not signal.
do-not-retry: yes.

### 5 — Local resolution as the recovery lever — [FALSIFIED]
· at res 0.2–0.4 the liver/gut split does NOT form (purity ~0.18); res 0.8 is *necessary*. Sweeping
0.8 → 1.0 → 1.2 → 1.5 moves liver purity <0.01 · verdict: 0.8 is the operating point; resolution is
NOT the recovery lever (local-HVG recompute is). do-not-retry: yes.

### 6 — Informed gene seeding (marker-primed HVG) — [FALSIFIED]
· seed HVG with known/Researcher-named markers · result: mean ΔF1 −0.005. The Researcher-named-gene
variant showed apparent wins, but **a null control collapsed it: deliberately WRONG genes won as
often as right ones** · verdict: null-to-negative; the null control is why this is trustworthy.
do-not-retry: yes.

### 7 — Perturbation-as-lever (drug cells to sharpen partition) — [FALSIFIED]
· the apparent seeding wins traced to *perturbation of the HVG SET*, not its content. Did NOT scale
with magnitude (flat 10 → 500 genes; ΔF1 negative at 500); a **reseed-only control flipped as many
splits as any gene change** · verdict: wins were partition instability, not mechanism. do-not-retry: yes.

### 8 — Marker-density threshold gate — [SHELVED]
· gate clusters on a marker-density floor (downstream of the seeding result — died with it) ·
surviving form: **marker count is a necessary FLOOR, not a sufficient predictor** — recovered leaves
~75 median markers, abstains ~32, merged muscle 0; **not portable across technology** (ChemFish
needed ~2× the ZSCAPE cut) · do-not-retry: as a sufficient predictor, yes; as a floor it stands.

### 9 — Control-only CLUSTERING (not just control-only naming) — [FALSIFIED]
· cluster on control cells only · result: controls ≈28% of cells → starves the endoderm compartment
to ~2,940 cells, UNDER the 500-cell recursion trigger for its sub-splits → liver/gut/pancreas never
get a local pass and collapse into one sink; the entire endoderm recovery is lost · verdict:
all-cell clustering is a deliberate, tested choice. **do-not-retry: yes (settled — the ledger
existing is precisely what prevents re-litigating this).**

### 10 — Partition stability (ARI/NMI across reseeds) — [SHIPPED-as-advisory]
· tested at N=20 reseeds, ≥80% cutoff → cuts only 4/57 splits across three datasets, no portable
cutoff — **but every established recovery (blood/gut/pancreas) scores 1.0** · verdict: keep as an
ADVISORY signal, not a hard filter. Most valuable on no-GT MegaFin. do-not-retry: n/a.

### 11 — HVG count sweep [400/800/1200/2000] — [UNTESTED-elsewhere / candidate]
· weak, size-conditioned lever: only sub-3k-cell compartments benefit from a sharper count
(~400–800); large compartments tie or favour 2,000. Feared rare-tissue recall loss did NOT
materialise · verdict: 2,000 stays default; **~400–800 for small compartments is a candidate
refinement pending second-dataset confirmation.** do-not-retry: n/a.

### 12 — Endoderm ceiling (documented method LIMIT, not an idea) — [FALSIFIED as a tuning gap]
· the liver leaf is an entangled blend (~1,554 Liver + 977 Intestine + 345 Pancreas), votes Liver on
plurality at purity ~0.56; pancreas ~0.60. A 100k POC showed liver 0.975 but **did not generalize to
full scale** · verdict: likely a developmental fact at 48 hpf, not a tuning gap; labelled "Liver" on
plurality with explicit caveat · **one untested lever:** does a cleaner coarse pass — forming
endoderm as its OWN compartment from the start rather than re-recursing a leaf — move the ceiling?
[UNTESTED]. do-not-retry: the tuning attempts, yes; the coarse-compartment lever, open.

### 13 — Three ZSCAPE partitions are staged on disk — [HAZARD, recorded]
2026-07-14 · a fresh run can silently label the wrong one. Served `daniotype_data/zscape/umap.json` =
**55** leaves; producer input `/data/scratch/v2_zscape/umap.json` = **99**; the GOLDEN (`9258bd`) partition
= **250**, at `/data/scratch/bench/zscape_recursive_v2_full_48hpf/clusters.json`. `run_v2_full.py` reads
the 99. **Any fresh golden must stage the 250-leaf `clusters.json` + schema-convert it to the loader's
`{clusters:[{id,label,degsUp,markers,nCells,compartment}]}` shape** — it's an edit, not a param.
do-not-retry: n/a.
