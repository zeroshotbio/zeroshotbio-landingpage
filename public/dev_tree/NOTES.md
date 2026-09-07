# /dev_tree — 0–24 hpf zebrafish developmental tree

Prototype. Built 2026-09-07 on the EC2 instance from data already held there.

- Page: `public/dev_tree/index.html` + `tree.js` (self-contained, no build step)
- Data: `public/dev_tree/tree.json`, rebuilt with `python3 scripts/build_dev_tree.py`
- Route: rewrite in `next.config.js` (`/dev_tree` → `/dev_tree/index.html`)


## What the picture claims

**The tree edges are annotation containment, not lineage.**

Each parent→child edge says *"the DanioCell annotation table nests this label
under that one"* — `tissue.subsets` → `tissue` → `identity.super`. It does not
say a cell in the child descends from a cell in the parent. DanioCell carries no
lineage tracing, and none of the paper's own trajectory reconstruction was used
here. Two branches meeting near the left edge means their labels sit under one
heading, not that they share a progenitor.

The one genuinely lineage-flavoured relation on the page is ZFA `develops_from`,
which appears in the detail panel, labelled as ontology lineage, and is never
used to position anything.


## Inputs

| What | Where | Used for |
|---|---|---|
| DanioCell cell metadata | `GSE223922_Sur2023_metadata.tsv.gz` (489,686 rows) | `stage.integer` (hpf), `clust`, `tissue.name` |
| DanioCell cluster annotations | `sources/supplementary/cluster_annotations.csv` (521 rows) | the hierarchy, and the `zfin` ZFA column |
| ZFA ontology | `/data/scratch/zlabel/data/ontologies/zfa.obo`, release 2026-06-02 | term names, `is_a`, `part_of`, `develops_from` |
| Kimmel staging | begin-times as in `daniotype.ontology.zfs_stages` | the period bands on the time axis |
| ZFA structural buckets | `/data/darien_ZFA.md` | the is_a\* roots behind the mark shapes |

No H5AD and no expression matrix was read. The tree is built from metadata and
annotation only, so the stale-QC and gene-universe warnings in the DanioCell
README do not bear on it. Existing ontology code (`daniotype.ontology.zfa`)
supplied the edge-type semantics — `is_a`/`part_of` are subsumption,
`develops_from` is lineage and is kept apart — but the page ships a ~40-line OBO
reader instead of importing it, so the static build has no Python dependency.

## How each thing on screen is derived

- **A tip** is one `(tissue.subsets, tissue, identity.super)` triple with ≥20
  cells inside the window. 96 tips, 139 nodes, 98,469 cells.
- **x position** is `onset` — the hpf by which 2% of that node's in-window cells
  have appeared. A parent's onset is forced to the minimum over its subtree, so
  a child can never sit left of its parent.
- **Bar length** is onset → offset (2%–98% of the node's cells).
- **Mark area** ∝ cell count. **Mark shape** = the ZFA structural bucket of the
  node's dominant ZFA term (cell / tissue / multi-tissue structure / organ /
  anatomical system), by `is_a*` ancestry.
- **A ZFA term is attached only when it covers ≥50%** of the node's
  ZFA-carrying cells. 78 of 139 nodes qualify; the rest say so rather than
  inheriting whichever term their largest descendant happened to carry.
- **Colour carries nothing.** Twenty tissue programs cannot be twenty separable
  hues, so identity is position + a direct label on every node, and the single
  accent colour means only "the branch under the pointer".


## Limitations found along the way

1. **There is no 0–3 hpf data.** DanioCell's earliest sample is 3 hpf
   (blastula, ~1k-cell). Zygote and cleavage stages are absent, so the left
   third of the nominal window is empty. The axis starts at 3.
2. **86 of the 96 tips are cut by the 24 hpf boundary**, not ended by
   development — 200,371 further cells of these same clusters sit past 24 hpf.
   The page marks the *other* 10 (the genuinely transient early populations:
   blastula, gastrula, prechordal plate, optic field, …) rather than marking the
   common case.
3. **Time resolution is the sampling grid, not biology.** Only 15 integer
   stages exist at ≤24 hpf (3–12 by ones, then 14, 16, 18, 21, 24), so onsets
   quantise onto those, and many branches share an x purely because 14 hpf is a
   big batch. Simultaneous divergence on the plot is a sampling artefact as
   often as a fact.
4. **`tissue.subsets` is an analysis grouping, not a germ layer.** `neural`
   contains *non-neural ectoderm*; `muscle` contains *heart* and *cardiac
   muscle*; `glial` contains *spinal cord*. Reading the top-level branches as
   ectoderm/mesoderm/endoderm would be wrong.
5. **Names repeat across branches.** `blastomeres` appears under both the
   blastomeres and hematopoietic programs, `axial` at two levels. That is
   DanioCell's vocabulary, not a bug — the detail panel shows the full path.
6. **Cluster identities are atlas-wide.** A cluster annotated over 3–120 hpf is
   placed here by the slice of its cells inside the window, so a tip's position
   describes the window, not the cluster's whole life.
7. **ZFA coverage is partial**: 358 of 521 clusters carry a `zfin` value, some
   carry several comma-separated terms, and `ZFA:0001185,ZFA:0001179` alone is
   shared by 17 clusters. The terms are ZFIN's curatorial call about the
   cluster, not a computed mapping.
8. **Excluded from the tree**: 32 clusters whose `identity.super` is
   *likely doublets* (752 cells in window — a QC class, not a cell type), and
   33 tips under 20 cells (230 cells). The `ceph` cluster (3,188 cells) has no
   row in the annotation table at all and appears as *cephalic → unannotated
   cluster*.
9. Stage period bands are Kimmel et al. 1995 at 28.5 °C. Fish reared colder or
   warmer do not line up with them.


## Obvious next steps

- Use the paper's own trajectory reconstruction, so at least part of the tree
  could make a lineage claim honestly.
- Widen to the full 3–120 hpf atlas with the window as a brushable range —
  which would retire limitation 2 outright.
- Cross-check the ZFA terms against the `zfa_*` artefacts under
  `/data/scratch/zlabel/` rather than trusting the `zfin` column alone.
