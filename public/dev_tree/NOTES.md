# /dev_tree — 0–48 hpf zebrafish developmental tree

Prototype. Built 2026-09-07 on the EC2 instance from data already held there.
Widened from the original 0–24 hpf window on 2026-09-07.

- Page: `public/dev_tree/index.html` + `tree.js` (self-contained, no build step)
- Data: `public/dev_tree/tree.json`, rebuilt with `python3 scripts/build_dev_tree.py`
- Route: rewrite in `next.config.js` (`/dev_tree` → `/dev_tree/index.html`)

One diagram, panned by dragging, with the detail on hover. There is no collapse
and no second layout mode; `HPF_MAX` in the build script is the only knob.


## What the picture claims

**The tree edges are annotation containment, not lineage.**

Each parent→child edge says *"the DanioCell annotation table nests this label
under that one"* — `tissue.subsets` → `tissue` → `identity.super`. It does not
say a cell in the child descends from a cell in the parent. DanioCell carries no
lineage tracing, and none of the paper's own trajectory reconstruction was used
here. Two branches meeting near the left edge means their labels sit under one
heading, not that they share a progenitor.

The one genuinely lineage-flavoured relation on the page is ZFA `develops_from`,
which appears in the hover card, labelled as ontology lineage, and is never used
to position anything.


## Inputs

| What | Where | Used for |
|---|---|---|
| DanioCell cell metadata | `GSE223922_Sur2023_metadata.tsv.gz` (489,686 rows) | `stage.integer` (hpf), `clust`, `tissue.name` |
| DanioCell cluster annotations | `sources/supplementary/cluster_annotations.csv` (521 rows) | the hierarchy, and the `zfin` ZFA column |
| ZFA ontology | `/data/scratch/zlabel/data/ontologies/zfa.obo`, release 2026-06-02 | term names, `is_a`, `part_of`, `develops_from` |
| Kimmel staging | begin-times as in `daniotype.ontology.zfs_stages` | the period bands on the time axis |
| ZFA structural buckets | `/data/darien_ZFA.md` | the is_a\* roots behind the mark shapes and hues |

No H5AD and no expression matrix was read. The tree is built from metadata and
annotation only, so the stale-QC and gene-universe warnings in the DanioCell
README do not bear on it. Existing ontology code (`daniotype.ontology.zfa`)
supplied the edge-type semantics — `is_a`/`part_of` are subsumption,
`develops_from` is lineage and is kept apart — but the page ships a ~40-line OBO
reader instead of importing it, so the static build has no Python dependency.


## How each thing on screen is derived

- **A tip** is one `(tissue.subsets, tissue, identity.super)` triple with ≥20
  cells inside the window. 144 tips, 195 nodes, 220,940 cells.
- **x position** is `onset` — the hpf by which 2% of that node's in-window cells
  have appeared. A parent's onset is forced to the minimum over its subtree, so
  a child can never sit left of its parent. The root is pinned at 0 hpf.
- **Bar length** is onset → offset (2%–98% of the node's cells).
- **Mark area** ∝ cell count.
- **Mark shape and fill** are both the ZFA structural bucket of the node's
  dominant ZFA term, by `is_a*` ancestry: four hues for the four rungs of the
  structural ladder (cell / tissue / multi-tissue structure / organ), and ink
  for the two classes off it — a term ZFA files as existing only during
  development, and no term at all. Shape repeats what hue says, so nothing is
  ever identified by colour alone.
- **A ZFA term is attached only when it covers ≥50%** of the node's
  ZFA-carrying cells. 111 of 195 nodes qualify; the rest say so rather than
  inheriting whichever term their largest descendant happened to carry.

The four hues are slots 1, 4, 5 and 6 of the documented categorical theme,
chosen by running the palette validator over every four-hue subset against both
of this page's surfaces on the **all-pairs** list (a tree puts any two marks
side by side, so the adjacent-pairs gate would have been the wrong one). It is
the only set that passes in both modes. Two WARNs come with it — dark-mode CVD
ΔE 6.9, light-mode contrast under 3:1 — and both are legal only against
secondary encoding and visible labels, which is why the shapes and the
per-node labels are not optional. Re-run the validator before changing a hue.


## Limitations found along the way

1. **There is no 0–3 hpf data.** DanioCell's earliest sample is 3 hpf
   (blastula, ~1k-cell). Zygote and cleavage stages are absent, so the first
   three hours of the window are genuinely empty — shaded on the plot rather
   than trimmed off, because the gap is a finding.
2. **130 of the 144 tips are cut by the 48 hpf boundary**, not ended by
   development — 215,866 further cells of these same clusters sit past 48 hpf,
   and the atlas itself runs to 120. The page marks the *other* 14 (the
   genuinely transient populations: blastula, gastrula, prechordal plate,
   optic field, …) rather than marking the common case.
3. **The whole `neural` program has no ZFA annotation.** 0 of its 48 clusters
   carry a `zfin` value, so hindbrain, diencephalon, telencephalon, optic
   tectum and cerebellum all draw as *no term* even though ZFA has perfectly
   good terms for each. This is a gap in the source annotation table, not in
   the mapping — and since `neural` is 43% of the cells in the window, it is
   the single biggest hole in the ontology layer.
4. **Time resolution is the sampling grid, not biology.** Stages are spaced by
   1 h early, then 2 h, then 2–6 h out to 48, so onsets quantise onto them and
   many branches share an x purely because 14 hpf is a big batch. Simultaneous
   divergence on the plot is a sampling artefact as often as a fact.
5. **`tissue.subsets` is an analysis grouping, not a germ layer.** `neural`
   contains *non-neural ectoderm*; `muscle` contains *heart* and *cardiac
   muscle*; `glial` contains *spinal cord*. Reading the top-level branches as
   ectoderm/mesoderm/endoderm would be wrong.
6. **Names repeat across branches.** `blastomeres` appears under both the
   blastomeres and hematopoietic programs, `satellite cells` twice under
   muscle, `axial` at two levels. That is DanioCell's vocabulary, not a bug —
   the hover card shows the full path.
7. **Cluster identities are atlas-wide.** A cluster annotated over 3–120 hpf is
   placed here by the slice of its cells inside the window, so a tip's position
   describes the window, not the cluster's whole life.
8. **ZFA coverage is partial and curatorial**: 358 of 521 clusters carry a
   `zfin` value, some carry several comma-separated terms, and
   `ZFA:0001185,ZFA:0001179` alone is shared by 17 clusters. The terms are
   ZFIN's call about the cluster, not a computed mapping.
9. **Excluded from the tree**: 43 clusters whose `identity.super` is
   *likely doublets* (8,055 cells in window — a QC class, not a cell type), and
   22 tips under 20 cells (167 cells). The `ceph` cluster (3,188 cells) has no
   row in the annotation table at all and appears as *cephalic → unannotated
   cluster*.
10. Stage period bands are Kimmel et al. 1995 at 28.5 °C. Fish reared colder or
    warmer do not line up with them.


## Obvious next steps

- Fill the `neural` ZFA gap (limitation 3) from the `zfa_*` artefacts under
  `/data/scratch/zlabel/` rather than the `zfin` column alone — that alone
  would put a structural kind on 43% more of the cells.
- Use the paper's own trajectory reconstruction, so at least part of the tree
  could make a lineage claim honestly.
- Widen to the full 3–120 hpf atlas with the window as a brushable range —
  which would retire limitation 2 outright.
