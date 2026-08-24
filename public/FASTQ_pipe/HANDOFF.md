# /FASTQ_pipe — contract and ownership

A self-contained static page in `public/FASTQ_pipe/`: `index.html` plus four
classic scripts, no build step, no dependencies, no CDN. Served by a Next
rewrite (`next.config.js`) with no-cache headers, exactly like `/pipeline`,
`/data_structures` and `/bioinformatics_pipe`.

`<script src>` attributes are **absolute** (`/FASTQ_pipe/fq-iso.js`) because
the route has no trailing slash — relative paths resolve against `/` and 404.

## What this page is

**The FASTQ-to-matrix half of row 3 of `/pipeline`.**

On the big map the four rows are named *Biological samples*, *Molecular
biology*, **Bioinformatics pipeline** and *Opinionated metadata*. The third
runs FASTQ → counting stack → unfiltered matrix → six culls → filtered matrix.
This page is the **first** half of it: everything between the reads and the
first cube, and nothing after them.

**`/bioinformatics_pipe` is the second half**, and the two meet at the same
object: `UD`, the unfiltered matrix, drawn on both from the same `drawMatrix`
with the same sparsity seed. A cube that looked different on the two maps would
be telling a reader they were looking at two different things.

Eight objects: the FASTQ landmark, six stations, and the cube.

| station | what it draws |
|---|---|
| **Barcode parse** | read 2's three ligation barcodes plus the UMI, matched to the well lists at one mismatch |
| **Genome index** | built once per reference from FASTA + GTF, not per run |
| **Alignment** | read 1 is the cDNA and goes to STAR |
| **Gene assignment** | aligned read → a gene model from the GTF, exonic by default |
| **UMI deduplication** | reads sharing barcode, gene and UMI become one transcript |
| **Cell assignment and matrix build** | group by the full barcode combination, floor at 10, emit MTX |

Same isometric world as its three siblings — same projection, shell, reader,
index, theme switch — because it is the same map at a different scale, not a
different map about the same subject.

## Every node is lifted, not re-typed

The `does` / `built` / `cond` fields in `fq-data.js` come from
`pipeline-data.js`, node for node:

```
FQ  → FQ  (③ FASTQ)          BP  → cb1 (Barcode calling)
GX  → E   (The counting reference)    AL  → cb2 (Alignment)
GA  → IN  (Intron inclusion)  UM  → cb3 (UMI collapse)
CM  → cb4 (Combine and stamp) UD  → UD  (④ Unfiltered matrix)
```

That is the whole point. Two hand-maintained accounts of one pipeline drift,
and the drift is invisible until someone quotes the wrong one. If a claim
changes, **change it on `/pipeline` and lift it again** — do not edit the prose
here.

Same for the payloads: `REAL_CELLS`, `REAL_GENES`, `REAL_REFS`, `REAL_SUBLIBS`
and the `read` / `ref` / `cell` snippets are the same records travelling the
same edges.

### What is authored here, and what is lifted

Three fields per station are authored on this page. Everything else is lifted
byte-for-byte.

- **`name` and `sub`.** Five of the eight are named differently from
  `/pipeline` and that is not drift. The big map carries the name the whole
  corpus uses for a stage — "Intron inclusion" names the *flag*, because the
  flag is the part nobody records — while this page names the single operation
  it draws. `pipelineName` carries the original through to the reader so the
  two can still be matched up.
- **`added`.** Anything this page says for itself, rendered under its own
  heading (*Drawn here*) so a reader can tell which map is talking.

Geometry is also overridden — the stations are 1.9 units square where they are
0.68 on the big map — but that is dimensional, never prose.

## NOTHING ON THIS PAGE IS MODELLED

That is the sharpest difference from `/bioinformatics_pipe`, and it is a fact
about the stretch rather than a virtue of the page. Every threshold on that
map's four roofs is computed at load from a seeded population, because none of
those culls has a shipping policy with a single drawable number behind it.

Here there is nothing to invent. Every figure quoted is read off an artefact —
the vendor's own `analysis_summary.csv`, the delivered `var`, the corpus
provenance records for the four counting references. The one policy number on
the page is the **10-transcript floor** at the matrix build, and it is a
formatting decision about what is worth a row rather than a claim about what is
a cell.

So this page **loads no `/culls/` files and derives no statistics.** If a roof
chart ever lands on this row, load `culls-pop.js` and `culls-draw.js` the way
`index.html` on the other map does, and put `MODEL`, `ANNOTATIONS` and
`FIGURES` back in the `requires()` table at the top of `fq-view.js`.

**`roofFrame()` has been lifted into `fq-iso.js`,** verbatim from
`culls-draw.js`. It is projection rather than subject matter, and that is where
this page's own header always claimed it lived. Nothing calls it today — the
same footing `ellipseAt` is on — and it stays for the next flat thing that does
want to lie on a roof. It was *not* there before, and nothing noticed, because **`requires()` cannot see
a missing `const`** — its fallback test is
`typeof eval("typeof sym") === "undefined"`, and `eval` returns the *string*
`"undefined"`, whose typeof is `"string"`. The condition can never be true. The
same block is in three maps; it is documented at the top of `fq-view.js` and
should be fixed in all three together rather than here in passing.

**Do not add a MODELLED badge to anything here without a model behind it.** The
badge machinery is intact (`modelled:true` on a node) precisely so that a
future invented figure carries the word; an unbacked badge is worse than none.

## Hatching

`n.hatch` means **the stage destroys data**, exactly as on `/pipeline`. Five of
the six carry it. The exception is the **genome index**: it decides what can be
found and throws nothing away.

The index column reads **"drops"**, not "cull" — these are not culls, and the
neighbouring map's word would import a claim this page does not make. The
largest deletion here is the first one: 24.3% of reads carry no valid barcode
combination and leave at the barcode parse, before anything has been aligned,
with no record of which ones.

## The genome index stands in the row, and it is the one station no read passes through

On `/pipeline` the counting reference is a **side structure**, hanging below
row 3 on a `follow{}` between barcode calling and alignment, because it is not
a step. Here it is drawn in the row's own order, where it is consumed.

That is a deliberate simplification and the node says so in its own *Drawn
here* paragraph. If it ever reads as a false claim — that reads flow *through*
the index — the fix is a `follow{}` and an edge of kind `ref`, not a change of
prose.

## `drawReads` — the one shape this page has of its own

`drawTile`, `drawHeap` and `drawMatrix` are verbatim from
`pipeline-shapes.js`, down to the seed `drawMatrix` uses for its sparsity.
`drawHeap` has no user today — the FASTQ landmark is `drawReads` — and stays
because the shapes file is the shared vocabulary, not a list of what is on
screen this week.

The FASTQ landmark is **a swarming pool, and one fragment opened up.** It is a
port of a canvas drawing into this map's own idiom; what follows is what the
port had to decide.

**The fragment is drawn in its own order, not in R2's order.** BC1 sits nearest
the cDNA because reverse transcription attached it first; each ligation round
adds the next one further out; the UMI rides on the round-3 oligo at the far
end. R2 sequences inward from that end — which is why it meets the UMI first
and reaches round 1 last. Draw the molecule truthfully and the reversal
explains itself. **Do not reorder the fragment to match the read.**

**The diagram is not in the isometric, and it is the only thing on the page
that is not.** Everything else belongs to the world and shears with it. This is
a diagram *of* a molecule rather than a thing standing somewhere on the map,
and a diagram read at −30° is a diagram read at −30°: it is laid out in plain
screen axes, square to the reader, hanging under the pool with nothing beneath
it. An earlier build painted it flat on a rectangular pad — correct by the
map's grammar, and worse: the pad was a solid claiming the reads sit somewhere,
and it turned the diagram to the map's own angle for no gain. **That is why
this shape does not call `roofFrame()`**: there is no surface to lie on and no
shear to take.

The pool is drawn in screen space too, so a read stays a straight line of even
weight however the ball turns.

**The arrowheads sit 15% in from the ends they point at.** On the end an arrow
reads as a terminus — the place the read stops — and it means the opposite: the
direction the read travels.

**The ball is a real ball.** The reads are placed uniformly through a sphere —
direction on the sphere, radius by cube root, because a uniform radius piles
the population into the centre — in *world* coordinates, turned by a real
rotation, and projected through `P()` like everything else. Depth is the map's
own depth: what is nearer the eye is what has the greater `x + y`, the key
everything else on the page is sorted by.

**Nothing here is a solid, so `n.h` is not the height of any object** — it is
the top of the whole composition, which is what `topOf()` hands the label, so
the name floats clear above the pool rather than landing in it. Both the pool
and the diagram are placed from it: lower the ball and it lands on the diagram;
raise it and the name goes with it.

**The node's box is laid down as a transparent silhouette, first, behind
everything.** Painted, so it takes pointer events; invisible, so it draws
nothing. Without it a node with no solid at the projected centre of its own
footprint cannot be clicked there — which is where a person aims and where
`check-clicks.mjs` presses.

**Colour: the original had five hues, this map has three tokens and a rule
against a fourth.** cDNA is `--keep`, the barcodes are `--accent`, and the
distinction the tokens cannot carry is made by **encoding** instead — the UMI
is the same accent as a barcode, drawn as an *outline* rather than a fill,
because it is the one tag on the molecule that is not a barcode. That is the
rule the palette section states: a new distinction needs a different encoding,
not a different colour.

**380 reads is 760 line segments a frame.** Each depth bucket is one `<path>`
whose `d` is a run of subpaths, rebuilt as a single string and written with one
`setAttribute` — `pool()` on the other map, same idea. Alpha and weight vary by
having four buckets, not by having 760 attributes. The hero is drawn as itself,
because there is one of it.

**The population is built once, at load, from a fixed seed**, so the pool is the
same pool in every browser and the hero is the same read. A swarm that
reshuffles on refresh is a decoration; this one is a drawing of an object.

**It registers one ticker and never its own `requestAnimationFrame`.** A ticker
inherits Pause motion and `prefers-reduced-motion` for free, and one that throws
is dropped without taking the map with it.

### `data-fixed`, and why an animated shape needs it

`check-drawn.mjs` asks "did this come back drawn where it was left" by comparing
the centre of a bounding box across a reload. That is a sound question and a
useless measurement on this object: most of the group is a turning ball, so its
box is a different shape every frame and its centre drifts tens of units while
the node sits perfectly still. It reported sixty units of drift on something
nothing had touched.

So the check measures a `[data-fixed]` element where a shape marks one, and here
that is **the transparent silhouette** — pure geometry, no text, no stroke, so
its box is an exact transform of the node's own coordinates.

**Not the diagram**, which was tried: it is mostly *text*, and a text bounding
box is a font metric rather than a coordinate, so it lands a fraction
differently at a different zoom — and the zoom does differ between two loads,
because the camera fits to a content box that includes the ball. That is 0.6
units of nothing, which is exactly the tolerance.

**Any future shape that animates must mark one static, text-free part the same
way**, or it will fail that check for a reason that has nothing to do with what
the check is for.

## No scenery

`/bioinformatics_pipe` carries the attrition band, painted flat on the ground
behind its row, and resolving it took a whole function — a thing whose *span*
is derived from the buildings it covers must take its *base* from where the
lane put them (`_ox`) rather than from where they ended up (`x`), or its own
saved nudge compounds every time the table is applied.

Nothing here is drawn that way: every object on this page is drawn at its own
coordinate, so a saved `dx` is in the picture the moment the page loads. **If
ground scenery is ever added, lift `resolveScenery()` from that map rather than
re-deriving it** — the bug it exists for looks exactly like a save that did not
take, and it was reported twice before it was found.

## Labels never take clicks

Everything `mkAnn()` draws carries `pointer-events:none`. This page draws no
floating annotations today, and the rule stays anyway: a label that floats over
a neighbour is a **click target sitting on top of it**, and neither failure
looks wrong in a screenshot. `check-clicks.mjs` is the only check that catches
it.

## The palette is `/pipeline`'s, token for token

`index.html`'s `:root` and `body.light` blocks are lifted from `/pipeline`
verbatim. The three mark names are **aliases** onto those tokens, not new
colours:

```
--keep:   var(--fg2)     anything that stays
--cull:   var(--drop)    anything leaving
--accent: var(--signal)  a threshold
```

**Do not introduce a fourth.**

## Load order

```
fq-iso.js     projection, faces, paint, roofFrame, the ticker registry, lanes
fq-shapes.js  the three shapes copied from /pipeline
fq-data.js    the lifted nodes, edges, payloads, prose
fq-view.js    assembly, camera, reader, index, strip
```

`fq-view.js` asserts this order and fails with a readable message rather than a
`ReferenceError` if a file 404s.

## Edit positions

Ported from `/pipeline` via `/bioinformatics_pipe`, unchanged. Everything the
map draws is placed from world coordinates and the projection is affine, so a
drag is exact: a screen delta divides straight back into a world delta and
moving an object is a `translate` on the group it was drawn into.

Three kinds of thing drag, and they are three different mechanisms: a
**building** (world coordinates), **its name** (`ldx`/`ldy`, composed in front
of the label group's own transform), and **the band's own name** — a *mover*,
which belongs to no building and would otherwise be the one string on the map
that could not be got out of the way of anything. `MOVERS` in `fq-view.js`.

What comes out is a table of **nudges** relative to whatever `layoutRows()`
computed — `dx`/`dy`, `ldx`/`ldy`, `del` — so it survives the lane being
re-solved or a station being inserted.

### One base, captured once: `_ox` / `_oy`

Every nudge is measured from `_ox`/`_oy`, the lane engine's own output, and
from nothing else. They are captured immediately after `layoutRows()` and never
written again, so applying a table twice lands where applying it once does and
reading it back is a subtraction that cannot drift.

**Never write to `_ox`/`_oy` after they are captured, or read a nudge back as
anything other than `x − _ox`.** The moment something else moves that base,
saves start containing objects nobody touched.

### The shared record — and it is NOT the other map's

`/api/fqpipe_edits`, `ITEM_ID` **`FASTQ_pipe::edits`**, in
`src/app/api/fqpipe_edits/route.ts`. Never `bioinformatics_pipe::edits` and
never `pipeline_map::edits`. One record between two maps means whichever saved
last erases the other, silently, with no way to tell which happened — and this
page's closest neighbour is the other half of the same row, which is exactly
the one that would collide.

Local storage is namespaced the same way: `fqpipe.offsets`, `fqpipe.motion`,
`fqpipe.panels`.

The record is `{offsets, at}`, never a bare table. Every drag stamps `at` with
the local clock; a successful save replaces it with the **record's own** stamp.
On load, **the shared copy wins only if `doc.at` is strictly newer** — anything
else is this browser holding work the record has not seen. A save is a
**merge**, never a replacement, and a read failure aborts the write: keeping a
change in this browser is recoverable, overwriting somebody else's sitting is
not.

`GET` passes `ConsistentRead: true` and the route is `force-dynamic`, because a
save is read back within seconds of being written and an eventually-consistent
read of the previous layout is indistinguishable from a save that never
happened.

**Taking theirs is a reload, not an in-place application.** `applyOffsets()`
re-runs only a subset of what a load does; using it to adopt a shared copy
produces a picture no reload reproduces.

## The checks — run all six

```bash
node check-text.mjs    <url>             # needs playwright
node check-clicks.mjs  <url>             # needs playwright
node check-edit.mjs    <url>             # needs playwright
node check-delete.mjs  <url>             # needs playwright
node check-persist.mjs <url>             # needs playwright
node check-drawn.mjs   <url>             # needs playwright
```

All six pass as of this build, against `python3 -m http.server` over `public/`
with the url `http://127.0.0.1:8731/FASTQ_pipe/index.html`.

They all **stub `/api/fqpipe_edits`**. What is under test is the page's
behaviour, not DynamoDB's, and a check that fails when a table is unreachable —
or when it is run against a static preview server — is a check that gets
ignored. `check-persist.mjs` is the exception that proves it: it stands a
*stateful* stand-in up instead, because a constant is exactly what cannot catch
the bug it exists for.

- **`check-text.mjs`** measures every drawn string as its **true oriented quad**
  — `getBBox()` through `getScreenCTM()` — and asserts no two overlap by real
  intersection area. **Do not use axis-aligned boxes here.** Map text runs at
  ±30°, so its AABB is enormous and mostly empty, and two stacked lines that
  never touch report an 85% overlap.
- **`check-clicks.mjs`** clicks every building with a *real* mouse press at the
  projected centre of its roof. Use `page.mouse.click`, never `dispatchEvent`:
  a synthetic event is not evidence about a real one, and this map pans on
  `pointerdown`. It is why the FASTQ landmark has a solid pad under its
  drawing: the earlier heap enclosed mostly air and the click went straight
  through it to the canvas behind, which cleared the selection.
- **`check-edit.mjs`** drives Edit positions with a real mouse: handles inert
  until the mode is on, a building drag that moves the building and *not* the
  name offset, a name drag that moves the name and *not* the building, the band
  name as a mover, the result written to local storage, and a paste-back block.
  The floating-annotation section of the other map's copy is **removed here**,
  because this page has none; lift it back if a roof ever lands on this row.
- **`check-delete.mjs`** drives pick → × → confirm → delete, asserts **Cancel
  spares the object**, that the deletion survives a reload with its edges gone,
  and that the Save confirmation both appears and then leaves on its own.
- **`check-drawn.mjs`** asserts a saved position is **in the picture**, which is
  a different claim from being in the record. It measures the drawn group's
  bounding box and pushes the centre back through the world CTM, because the
  camera re-fits after a drag. It drags by the **edit handle**, never a group's
  bbox centre, and it measures a `[data-fixed]` element where a shape marks one
  — see above.
- **`check-persist.mjs`** runs a **stateful stub with a monotonic `at`** and
  asserts all seven transitions, including the two that were reported as bugs:
  **unsaved work survives a reload, both before a save and after one**, and a
  browser holding the pre-stamp record migrates. It compares **every object,
  not the one that was dragged**.

`rendered.mjs` is not a check — it is the same drag-save-reload trial printing
world coordinates, for when something looks wrong and you want the numbers.

## Please do not

- **Edit the prose in `fq-data.js`.** It is lifted. Edit `/pipeline` and lift
  again, or the two maps start disagreeing about the same stage. New writing
  belongs in `added:`.
- **Give this page a modelled figure without a model**, or drop the word if one
  ever arrives.
- **Rename `UD` or redraw it.** It is the join with `/bioinformatics_pipe` and
  it has to be the same object, at the same size, from the same code.
- **Point this page at `/api/bpipe_edits`.** See above; the failure is silent.
- **Replace the hand-rolled projection with a library.** Layout, label angles,
  painter ordering, the camera and `roofFrame`'s matrix all derive from `P()`.
- **Reorder the fragment on the FASTQ landmark to match the order R2 reads
  it.** The reversal is the point.
- **Turn that diagram back into the isometric, or stand it on a solid.** It is
  a diagram of a molecule, not a thing in the map, and it was both of those
  once.
- **Start a `requestAnimationFrame` inside a shape.** Push to `TICKERS`.
- **Add a colour.** Three encodings — stays, goes, threshold — aliased onto
  `/pipeline`'s tokens.
