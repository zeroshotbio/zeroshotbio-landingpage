# zeroshot.bio/pipeline — file split and working contract

The single HTML file you were handed is now four files. **This replaces it.** Same
behaviour, same output, no functional change — the split exists so two people can
work on it at once without colliding.

## Where it lives and how it is served

The tree is `public/pipeline/` in the `zeroshotbio-landingpage` repo, served at
`https://www.zeroshot.bio/pipeline` by a rewrite in `next.config.js`:

```js
{ source: '/pipeline', destination: '/pipeline/index.html' }
```

Script `src` attributes are **absolute** (`/pipeline/pipeline-iso.js`). They have to
be: the route has no trailing slash, so relative paths resolve against `/` and 404.

## Load order matters

```html
<script src="/pipeline/pipeline-iso.js"></script>     <!-- primitives -->
<script src="/pipeline/pipeline-shapes.js"></script>  <!-- visual vocabulary -->
<script src="/pipeline/pipeline-data.js"></script>    <!-- the pipeline itself -->
<script src="/pipeline/pipeline-view.js"></script>    <!-- assembly + interaction -->
```

Plain classic scripts, no modules, no build step, no dependencies, no CDN, no fonts.
Top-level `const` in one file is visible to later files. If you move to a bundler,
keep this order.

## Who owns what

| File | Owner | What it is |
|---|---|---|
| `pipeline-data.js` | **on-instance** | NODES, EDGES, BANDS, CARRIES, SNIPPETS, OVERVIEW. Every fact, number, name and payload. |
| `pipeline-shapes.js` | **rendering side** | One draw function per shape, plus SKIN and topOf. |
| `pipeline-iso.js` | rendering side | Projection, faces, paint, layout, ticker registry. |
| `pipeline-view.js` | shared, frozen | Grid, bands, labels, edges, dots, camera, reader, index. |
| `index.html` | shared | Markup, header stats, and the CSS variables that define both themes. |

## State of the data — generalised 2026-08-15 (second pass)

The map was reframed from "one run" to **the platonic pipeline**, with MiniFin kept
throughout as the worked example. General claims are sourced from the corpus at
`/data/datasets/zebrafish/` — nine dataset entries, seven with a full nine-section
provenance record under `<DATASET>/sources/README.md`, each ending in the same seven
cross-dataset provenance principles. Four of those principles are quoted in the
`pipeline-data.js` header and drive the row-3 and row-4 condition text.

Nineteen changes went in. The structural ones:

- **Four new nodes.** `G1` 3′ UTR handling and `G2` intron inclusion (row 3),
  `G3` sample demultiplex — a real cull stage the map was missing, which exists only
  for hashed designs — and `G4` label transfer, drawn as a ghost because it is the
  road this pipeline deliberately does not take.
- **The reference node was rewritten from one universe to four.** Same assembly,
  four different answers to "which genes exist": BBI Ensembl 99 + 500 bp 3′
  extension (32,031), Lawson v4.3.2 (36,250 names), plain Ensembl (32,520),
  Zebrahub's custom Zebrabow build (32,057 + 3 transgenes).
- **Every cull node now carries the corpus spread rather than one vendor's number** —
  and says why those numbers are not comparable. The mitochondrial node is the
  sharpest case: 25% / 15% / 10% / ~1% / none / one that matches zero genes.
- **Header stats, `<title>` and OVERVIEW** were re-pitched from MiniFin to the corpus.

Row-3/row-4 claims that changed on the evidence: reference release **cannot** be
inferred from the data (the zebrafish gene set is identical across Ensembl 99–114);
four of the seven external atlases are **label-transferred, not de novo called**; six
of seven ship **no ontology ids** (Zebrahub is the exception); the four-tier
`germ_layer / tissue / cell_type_broad / cell_type_sub` ladder is **inherited from
ZSCAPE's realized obs**, not invented; and ground truth **disagrees with itself** —
ZCL2 ships two published annotations of the same 143 clusters agreeing on cell type
only 113 times.

## State of the data — first pass, 2026-08-15

`pipeline-data.js` was rewritten end to end against the artefacts on the instance.
Every number now names its source in the file's header comment. The five open items
from the previous handoff resolved as follows.

1. **Cull counts.** Not wirable, and now marked as such rather than invented. The
   five stages are real — they are Parse Trailmaker's `1-classifier` …
   `5-doubletScores`, in that order, which is *not* the order the map used to draw.
   But Trailmaker emits per-sample **settings**, never per-stage tallies, the MiniFin
   settings file is not on this box (only MegaFin CP01's is), and the unfiltered
   matrix was never delivered. The nodes now carry the real per-sample threshold
   *ranges* and say plainly that no drop count exists. Related discovery: the
   delivered h5ad has cells down to 294 UMI, below split-pipe's own 670 knee, and its
   cell count is exactly split-pipe's `number_of_cells` — so Trailmaker's QC chain
   may never have been applied to what we were given. **Worth asking Parse.**
2. **The UNVERIFIED set.** A4–A7 are confirmed and dropped from the set: the 48-well
   format, 6 embryos per well, 1 µM single dose, 24→48 hpf window and 48 hpf fixed
   collection are all in the MegaFIN design spec, and the plate format is
   independently corroborated by split-pipe's own barcode-set description
   (`n141_R1_v3_8`, "96 barcodes, 48 wells; rows A-D, cols 1-12"). Still unverified,
   and now including library prep: `A1 A2 A3 A8 B9 C1 C2`.
3. **Plate format.** Resolved: **48-well, 6 embryos, 43 of 48 wells recovered.**
   MiniFin *is* the 100k design. `PL` and `R1p` are now `cols:12, rows:4`.
4. **Payloads.** `SNIPPETS` now serves real records — head-of-file rows from
   `minifin_filtered.h5ad`, real leaf briefings from `umap.json`, real concluded calls
   and real scores against the sealed key. Two payloads deliberately show nothing
   (`read`, `drop`) because nothing is what exists.
5. **`cond` fields.** Rewritten. Several previous claims were retired for lack of an
   artefact (the Echo cherry-picking sheet, the 512-shard / 3.19 TiB delivery, the
   hard-coded Scrublet 0.034, plate `ZEROSHOTCP01`, the missing Lawson bridge, the
   labelled `.h5ad`). One new defect was found and is now on the map: **every one of
   the 267 MiniFin prompts tells the model it is reading "ZSCAPE 48 hpf"** — the
   dataset name is hard-coded in the core prompt instead of coming from the adapter.

Two edits were made outside `pipeline-data.js`, both flagged rather than silent:

- `index.html` header stats — the FASTQ-shard and leaf figures were data, and two of
  them were wrong. Markup and CSS untouched.
- `pipeline-view.js` `inspect()` — the note under a payload was hard-coded to
  "Synthetic stand-in with the right shape". It now reads `s.note`, falling back to a
  real-data sentence. Label geometry and the gap constants were not touched.

## Adding a step

No coordinates needed. `layoutRows()` computes x positions from the row's contents;
the `x` values in `NODES` are seed order only. Side structures use `follow:{a,b}` to
sit at a node's x or midway between two.

## The shape contract

```js
DRAW.myShape = (g, n) => { /* append SVG to g */ };
```

- reads only `n.x n.y n.w n.d n.h` plus its own custom fields
- knows nothing about neighbours, rows, or the map
- colours are **always** `var(--token)`, never a hex literal, or light mode breaks
- anything that moves pushes to `TICKERS`; never `setInterval`, never a second rAF loop
- a node opts in with `shape:"myShape"`

`shape-sandbox.html` renders one shape large and centred with the ticker loop running,
at `/pipeline/shape-sandbox.html`. It loads **only** iso + shapes — if a shape needs
anything from data.js, the contract is broken.

`build.sh` inlines all four into `pipeline-standalone.html` for preview or iframe
embedding. It is a build artefact — never edit it, regenerate it.

## Please do not

- **Inline these back into one file.** That is the entire point of the split.
- **Replace the hand-rolled isometric projection with a library.** Everything —
  layout, label angles, painter ordering, camera — derives from `P()`. Swapping it
  is not a refactor, it is a rewrite.
- **Reformat, minify, or convert to a framework.** Line-level diffs need to stay
  readable across two authors.
- **Change label geometry in `pipeline-view.js`.** The three orientations (+30° flow,
  −30° naming, edge-centred emission) were arrived at over many iterations and the
  clearances are tuned to the layout gap constants.
- **Touch `MIRROR`, `ROWS`, `GAP_MINOR`, `GAP_MAJOR`** unless a row genuinely
  overflows. They interact.

## Notes for integration

- Everything is inside `.app`, full-height via `100dvh`. Under 900px the index
  collapses behind the Stages button and the reader moves below the canvas.
- Dark is default; `document.body.classList.add("light")` flips the whole SVG,
  because every colour is a CSS variable.
- `prefers-reduced-motion` pauses the dots on load.
- No storage, no network, no analytics. Safe to iframe.
