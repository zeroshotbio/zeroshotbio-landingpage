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
<script src="/culls/culls-pop.js"></script>           <!-- SHARED: the population -->
<script src="/culls/culls-draw.js"></script>          <!-- SHARED: the four roofs -->
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
| **`/culls/culls-pop.js`** | **shared with `/bioinformatics_pipe`** | The simulated barcode population and every statistic computed from it. |
| **`/culls/culls-draw.js`** | **shared with `/bioinformatics_pipe`** | The four roofed culls, `roofFrame`, the chart helpers and the floating annotations. |

## The four roofed culls are shared code

Row 3's knee, mito, complexity and doublet culls are drawn from
`public/culls/`, and **`/bioinformatics_pipe` draws the same four from the same
files**. That page is this row drawn deeper; one implementation means two
accounts of one pipeline cannot drift. It is the same rule the node prose
already follows — that page lifts its `does` / `built` / `cond` from this one
as source text rather than re-typing it.

**Edit `/culls/` and you have edited two maps.** `node check-culls.mjs <url>`
beside these files is this map's half of that; the other page has six checks
of its own and they all have to pass too.

Three things about this page in particular, each of which has already gone
wrong once:

- **The buildings are smaller here.** A cull is 4.2 units on that page because
  it is the whole map; here it is 1.5, one object in one of four rows, and the
  lane span is fixed by the snake so it cannot simply grow. Everything about an
  annotation scales with its roof for that reason. A node may also nudge its
  own annotations with `annDx` / `annDy`, which this map needs because the
  ground under row 3 is occupied and the ground under that page's row is not.
- **The palette must carry `--keep` / `--cull` / `--accent`.** They are aliases
  onto `--fg2` / `--drop` / `--signal`, which this page already had. Without
  them every mark on every roof renders black, which is what an undefined CSS
  variable looks like and is easy to mistake for a deliberate choice.
- **The reader must keep saying "modelled".** Every threshold on those roofs is
  computed from a simulated population, and a modelled figure that has lost
  that word claims a result nobody produced. `roofFigures()` in
  `pipeline-view.js` prints it above the numbers.

**Never give a roof `shape:"works"`.** `topOf()` returns `n.h*0.96` for a works
node and `n.h` for everything else, and the chart is laid at `n.h` — so a works
roof would put the label anchor and the occlusion silhouette 4% below its own
chart.

### Row 3 is longer than the other rows

Four culls carrying a chart each need room: they are **4.2 units square, the
same size they are on `/bioinformatics_pipe`**, where they are bigger than the
unfiltered matrix they follow because the decision is the thing that row is
about. Squeezing them into the span the other rows use made them smaller than
either matrix, which says the opposite.

So `r3` has its own span and the snake still closes. **A lane may set its own
`mirror` axis**; without one it uses the map's `MIRROR`. Row 2 runs right to
left and ends where row 3 begins; row 3 runs left to right and ends at 37.85;
row 4 runs right to left **from there**, which is what `r4`'s `mirror: 54.40`
is for. `BAND_X` gives each band its own length rather than all four sharing
one — a band is as long as its row.

If you re-space row 3, check the turn at both ends: the connector from row 2
into `FQ` and the one from `FD` into `s1` are the only two places the snake
can silently come apart.

## Edit positions: deleting, and the floating labels

**A double press picks an object and offers a ✕.** It is deliberately *not* a
`dblclick` listener, and that is worth knowing before you "fix" it: this mode
is built on pointer capture and `begin()` calls `preventDefault()` on
pointerdown to stop the drag becoming a text selection. **preventDefault on
pointerdown suppresses the whole compatibility mouse-event chain — `click` and
`dblclick` included** — so a `dblclick` handler on a node group in this mode
never fires once. It looks right, it is wired to the right element, and it is
dead. The double press is measured from the presses instead: a press that did
not travel is a candidate, and two on the same target inside 420ms is a double
click.

**Deleting asks.** Everything else in this mode undoes itself by dragging
back; this does not, and the saved state is shared, so a mis-click would take
an object off the map for everybody. The ✕ is an HTML button in the stage, not
an SVG one — it must not shear with the projection, and it must not live inside
the group it is offering to delete, because a control that vanishes with its
own target cannot be pressed a second time. It rides the camera from the frame
loop.

**A deletion is `del:true` in the same table as the nudges**, and is applied
**before anything is laid out**: the lane solve, the edges, the index and the
occlusion clip all have to be computed over what is actually on the map.

**The floating labels drag one at a time.** UNDER-AMPLIFIED and OVER-AMPLIFIED
are two labels on one roof, and they name two different tails of the same
cloud, so where each can go depends on what is under it. They are not laid out
from world coordinates at all — their own shape re-places them every frame — so
what is draggable is `off`, a nudge the shape's placement is offset by. The
leader is recomputed from the moved text to the **unmoved** target, which is
the whole reason a label like this is worth being able to move.

**Save renders into the reader, so Save reveals the reader.** With it folded
away, pressing Save all changes did nothing anybody could see: the count, the
block to paste and the Confirm button were all drawn into a closed drawer. It
stays up afterwards — a save result is not a preview that should fold itself
back.

## The two culls that are not on a roof

`c2` (Depth floor) and `hx` (Sample demultiplex) are **off the lane, not
deleted**. Deleting them would have been the tidier edit and the wrong one:
every claim on them is researched, and the corpus is the reason this map
exists. What changed is their status, not their truth — one folds into the
knee, because a fitted transcript minimum *is* a depth floor and drawing both
would draw the same cut twice; the other applies only to hashed designs, and
the chemistry two rows up is combinatorial, where the barcode already is the
sample. They hang off the culls that absorb them, above the row.

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

## The copy payload

The Echo node (`P3`) carries a **Copy the shape source** button in its reader
panel. It puts a ~15 KB self-contained listing on the clipboard: the
projection, the shared plate vocabulary, `drawEchoDispense` itself, the node
that feeds it, and the shape contract — for handing to somebody, or something,
learning to draw in this style.

**The payload is generated, never hand-written.**

```bash
node sync-copy-payload.mjs      # no dependencies
```

It lifts each function and constant out of `pipeline-iso.js` and
`pipeline-shapes.js` **by name**, syntax-checks the result with `node --check`,
and rewrites the block in `index.html` between the `BEGIN copy-ECHO` /
`END copy-ECHO` markers. Re-run it after touching `drawEchoDispense`, the
projection, or the plate helpers. A hand-copied listing drifts from the code it
claims to be the moment either is edited, and a teaching example that is subtly
not the real thing is worse than none.

Three things about how it is wired, each with a reason:

- **The payload lives in a `text/plain` block in `index.html`, not in a JS
  string.** What it holds is source code — backticks, `${...}`, the lot — and
  escaping several hundred lines of that into a template literal is a bug
  waiting to happen. `textContent` gives it back byte for byte. The generator
  refuses to write a payload containing a closing script tag, and **no comment
  anywhere should contain one either** — it would terminate the block early and
  break the page silently.
- **The click handler is delegated on `#read`.** `renderNode` replaces
  `read.innerHTML` wholesale, so a handler bound to the button goes with it on
  the next hover.
- **`navigator.clipboard` has a fallback.** The async API needs a secure context
  and permission, and fails on `http://` and inside some embeds. The deprecated
  textarea + `execCommand` path stays as the fallback; if both fail the button
  says so and selects the text so it can be copied by hand.

Any node can have one: set `copy:"<element id>"` and optionally
`copyLabel:"..."`. If the named block is absent the button is simply not
rendered, so a missing payload never leaves a dead control behind.

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
