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

## IT IS NOT A CHAIN. One fork and two separate joins.

```
   G1 GRCz11 ──┐
               ├──→ G3a STAR index ──┐
   G2 Ensembl ─┘                     │   (and G1b/G2b → G3b, the second arm)
                                     ↓
                               E4 align R1 ──→ E5 assign to gene ──┐
                                     ↑                             │
   E1 pool ──→ E2 fragment ──────────┤                             ├──→ E6 dedup ──→ E7 unfiltered DGE
                                     ↓                             │
                               E3 match R2 barcodes ───────────────┘
                                     ↑
   W1 whitelists ────────────────────┘
```

**The fork is at E2**, which is why the fragment is a node and not an arrow:
one molecule sequenced from both ends, R1 to the genome and R2 to the
whitelists, and everything downstream is two independent problems until they
meet again. **Two edges leave E2 and they do not rejoin until E6.**

### They are two lanes, and each leaves from its own end of the glyph

The fragment already puts the cDNA at its left end and the barcodes at its
right, so each outbound edge is **ported** to the end it belongs to — `port:"L"`
and `port:"R"` on the edge, resolved through `PORTS[shape]` in `fq-shapes.js`.
Two edges leaving one node from the same place are two edges nobody can tell
apart. Each lane is then **tinted** with the token that half of the molecule
already wears — `--cull` for R1, `--accent` for R2 — so both journeys are
followable with no labels at all. No new colour: those are two the page has.

**The two bracket names read at the map's angle and stand at the outer end of
their own bracket.** Everything else in the glyph is square to the reader
because it is a diagram of a molecule; those two are not labels on the diagram,
they name the two tracks, which are map objects. So they take the map's
typography (−30°, like every other name on the page) and stand where their
track departs — the line emerges from under its own name.

**Which side each lane sits on is not a free choice.** A track has to leave
toward its own lane rather than back across the drawing it came from, and
screen-left of the glyph is *below* the row in world terms — so **R1 goes below
the spine and R2 above**. The spine between the fragment and the join carries
nothing, so the two are adjacent with only empty ground between them.

**The asymmetry is the point and must not be tidied.** R1 makes two stops, sits
further from the spine, consumes the genome lane, differs per arm, and can fail
— unmapped, multimapping, ambiguous. R2 makes one stop, consumes the
whitelists, is deterministic, and is identical across arms; it finishes early
and runs straight to the join while R1 is still working. **Equal lanes would be
a lie about the pipeline.**

A ported route is two segments and no elbow: the port, a run down to the
destination's lane joining it `PORT_LEAD` (2.0 world units) before the first
stop, then along the lane. **`E2` carries `noclip:true`** — the glyph is a flat
diagram floating in the air, not a solid, so nothing hides behind it; punch its
box out of the occlusion clip and both departures vanish at their own ends.

**E6 has two inbound edges and must look like it.** The gene identity comes down
one branch and the cell identity up the other, and neither alone is a count — a
gene with no cell is a read pile, a cell with no gene is an empty row. That
convergence is the point of the segment.

### Three lanes, and they are not the same kind of thing

| Lane | What it is | Behaviour |
|---|---|---|
| **E · reads** | sample material | flows once, per run, consumed |
| **G · genome** | reference, chosen | built once, reused forever |
| **W · whitelists** | reference, chosen | fixed by the kit, reused forever |

G and W are the same class as *The compounds* in the wet-lab half of
`/pipeline` — a catalogue someone selected from, arriving from outside the
experiment — and they sit off to the side for the same reason.

**They are not drawn as flowing.** A drug library is consumed; a STAR index is
not. An edge that animates material down it every run asserts a per-sample cost
that does not exist. So a reference edge is `still:true` — connected, dashed,
dimmer, **and never given a dot** — the same distinction `/data_structures`
draws between *has carried bytes* and *written · never run*. Reference **nodes**
wear `SKIN.works` rather than `SKIN.tile` for the same reason: a reference that
looks like a station undoes half of that at a glance.

### One index is drawn, because one is what this run used

`G1 · GRCz11` and `G2 · Ensembl 99` are **two nodes, not one** — two files, two
independent choices — and `G3 · STAR index` is built from them *together*, the
annotation baked in at index time rather than applied afterward.

A second arm exists: **GRCz12tu with Ensembl 2025_12**, staged rather than in
use, documented stage by stage at `/grcz12`. **It is deliberately not on this
map.** Two indexes mean two of everything from the alignment onward, and a map
that draws a second arm nothing has been counted against is claiming a result
that does not exist yet.

**If it is ever run, the branch goes back the way it was drawn before**, and
that shape is worth keeping: two *pairs* (`G1/G2 → G3a`, `G1b/G2b → G3b`)
rather than one genome with two annotations, because the arms differ in **both**
files. Each arm is a horizontal triple — a source at
`(index.x − 1.4, index.y + 1.4)` lands 102px directly *left* of its index on
screen and at the same height, `(+1.4, −1.4)` directly right — so every index is
flanked by its own two files and no dashed line crosses another. **Check the
screen order, which is `(x − y)`, not the world x:** the first attempt spread
the four sources along one lane and the arms interleaved on screen even though
they did not in world coordinates. And every station from `E4` on takes a
`tag:"× 2 ARMS"`, the landmark included — the tag was once drawn only on plain
nodes, so the matrix rendered as one bare cube while everything feeding it said
`× 2`, which reads as the branch collapsing back into one object.

### Nothing in this segment is a cull

Reads are set aside — a quarter carry no valid barcode combination and never
reach the alignment, multimappers and unmapped reads are dropped after it — but
**no cell is ever removed here**, and the matrix at the end is deliberately,
uselessly complete. `n.hatch` still means *this stage destroys data* and five
nodes carry it; the index column says **"drops"**, never "cull". The culls are
the D lane, at `/bioinformatics_pipe`.

Same isometric world as its three siblings — same projection, shell, reader,
index, theme switch — because it is the same map at a different scale, not a
different map about the same subject.

## Every node is lifted, not re-typed

The `does` / `built` / `cond` fields in `fq-data.js` come from
`pipeline-data.js`, node for node:

```
FQ  → FQ  (③ FASTQ)             E3  → cb1 (Barcode calling)
E4  → cb2 (Alignment)           E5  → IN  (Intron inclusion)
E6  → cb3 (UMI collapse)        G3a → E   (The counting reference)
UD  → UD  (④ Unfiltered matrix)
```

**The matrix keeps the id `UD`,** not `E7`, and that is load-bearing:
`drawMatrix` seeds its sparsity off `n.id==="UD"`, and this cube has to be the
same object as the one `/bioinformatics_pipe` draws. `key:"E7"` is what shows on
the map. The rest of the ids follow the spec.

That is the whole point. Two hand-maintained accounts of one pipeline drift,
and the drift is invisible until someone quotes the wrong one. If a claim
changes, **change it on `/pipeline` and lift it again** — do not edit the prose
here.

Same for the payloads: `REAL_CELLS`, `REAL_GENES`, `REAL_REFS`, `REAL_SUBLIBS`
and the `read` / `ref` / `cell` snippets are the same records travelling the
same edges.

**Not every node has a source.** `/pipeline` has no node for the fragment, the
whitelists, or the second annotation arm, so `E2`, `W1`, `G1`, `G2`, `G1b`,
`G2b` and `G3b` are **authored here in full** — `does` / `built` / `cond`
included. Every other node's body is lifted. If a lifted node is ever given
authored prose in those three fields the guarantee is gone, so put new writing
in `added:`.

### What is authored here, and what is lifted

Three fields per lifted station are authored on this page. Everything else is
lifted byte-for-byte.

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

### The lane is the spine, not the map

Only the four nodes every read passes through in order are on lane `r3`: the
pool, the fragment, the deduplication, the matrix. Everything else is a
`follow{}` side structure taking its x from one of them and keeping its own y —
which is what makes the fork a fork, with the two branches the same distance
above and below the spine.

`E6` carries `gap:9` so the whole fork fits in the span before it. The engine
scales every gap to fill the lane, so that is a **ratio** against the others
rather than a distance: re-space the lane and the fork keeps its share.

`follow{}` targets resolve in **array order**, so a node must appear after the
one it follows. Every `G*` follows `E4` directly rather than chaining through
`G3a`, which is what lets the index sit in reading order.

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

**One origin, taken once, and everything is an offset from it.** The pool and
the diagram are one object and have to move as one. The first version projected
`n.x + offset` for every read every frame while the diagram was drawn once from
`n.x` and left alone — so a drag moved the pool *twice*, through the group's own
translate and again through the recomputed projection, and the two halves came
apart under the cursor. **Nothing in the shape reads `n.x` or `n.y` after the
line that takes `[X0,Y0]`.** The group translate the editor applies is then the
only thing that moves either half.

**A sphere projects to an ellipse, and the clearance is measured against the
ellipse.** The image of a vector `(a,b,c)` is
`((a−b)·S·C30, (a+b)·S/2 − c·S·CZ)`, so the silhouette's vertical semi-axis is
`RB·hypot(S/2, S/2, S·CZ)` — bigger than `RB·S·CZ`, and using the radius instead
tucks the pool's lower edge into the diagram.

**The pool sits up and to the left**, far enough left that the node's name —
which leaves the far corner up and to the *right* — passes clear of it. Move one
and check the other.

**`n.h` is not the height of any object**; it is where the name hangs, and the
box the silhouette and the drag handle are cut from. Nothing on this node is a
solid, so there is nothing else for it to mean.

**No plinth.** `plinth:false` on the node. The dashed ground patch under a
landmark says "this object stands here", which is true of the matrix cube and
untrue of this one — drawn anyway it was an empty dashed square under the whole
visual with a track running across it, which is exactly what it looked like: a
footprint left by something that has gone. The name is not optional and is drawn
either way.

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

**The leaders are a magnification frustum, not a pointer** — two of them, from
the ring's shoulders to the two ends of the diagram, and heavy enough to read as
structure rather than as a stray hairline.

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

## The outline of a box is a hexagon, and its vertical sides are at the left and right corners

`nodeSil()` in `fq-view.js` builds the silhouette every node's occlusion clip
and drag handle are cut from. The version inherited from the other maps went
*far-top, right-top, **near**-top, near-bottom, left-bottom, **far**-bottom*.

On a square footprint the near and far corners share a screen x, so two of those
edges are the same vertical line travelled in opposite directions: the outline
crosses itself and the region between them cancels out. On a box a unit or so
tall the overlap is a few pixels and nobody sees it. On the FASTQ landmark,
whose box is the height of the whole composition, it drew as a **bow tie with a
hole through the middle** — and that hole is the occlusion clip and the drag
handle both.

It is *far top, right top, right bottom, near bottom, left bottom, left top*
here, which is convex at any height. `drawReads` builds its own hit silhouette
the same way. **If this is ever lifted back to `/pipeline` or
`/bioinformatics_pipe`, take the order with it** — those maps have no object
tall enough to show the bug, which is why it survived there.

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
--cull:   var(--drop)    /pipeline's orange
--accent: var(--signal)  /pipeline's blue
```

**Do not introduce a fourth.**

### On this page the two colours are the two reads, and that is a trade

`--cull` means *this is being dropped* on the other two maps. Here it does not,
because **nothing in this segment is a cull** — the token has no other job on
this page, and the distinction this page does need is the fork. So:

```
R1 · the cDNA        --cull
R2 · the barcodes    --accent
```

**The trail is unbroken and that is the whole point.** The hero read's cDNA half
in the pool, the leader from the ring to the cDNA end of the glyph, the cDNA
block, the `R1` bracket and its name, the R1 track and the dots on it — one
colour from the pool to the moment it re-merges with R2 at the join. The barcode
half is the same story in accent.

**It is only safe while nothing here drops cells.** If anything on this map ever
starts culling, the R1 trail has to move off this token first.

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
  asserts all seven transitions. It reads **both** bases off the node (`_ox`
  *and* `_oy`) rather than assuming a target sits on the row — most of this map
  does not, by design, including the two that were reported as bugs:
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
