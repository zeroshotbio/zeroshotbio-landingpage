# /bioinformatics_pipe — contract and ownership

A self-contained static page in `public/bioinformatics_pipe/`: `index.html`
plus five classic scripts, no build step, no dependencies, no CDN. Served by a
Next rewrite (`next.config.js`) with no-cache headers, exactly like
`/pipeline` and `/data_structures`.

`<script src>` attributes are **absolute** (`/bioinformatics_pipe/bp-iso.js`)
because the route has no trailing slash — relative paths resolve against `/`
and 404.

## What this page is

**The matrix-to-matrix half of row 3 of `/pipeline`.**

On the big map the four rows are named *Biological samples*, *Molecular
biology*, **Bioinformatics pipeline** and *Opinionated metadata*. The third
runs FASTQ → counting stack → unfiltered matrix → six culls → filtered matrix.
This page is the second half of it: **everything between the two cubes, and
nothing before them.**

The counting stack and its three reference structures are off this map on
purpose. They are about how a matrix gets *built*; this is about what gets
thrown out of one.

Seven objects, where row 3 has nineteen: **four culls, drawn**, plus the two cubes and the
cull ledger. Two of the big map's six culls are not drawn — D3, the depth
floor, folds into the knee because the knee IS a transcript minimum, fitted
rather than chosen; and G3, sample demultiplex, exists only for hashed
designs, which this chemistry is not. Neither claim is dropped: both are still
on `/pipeline`, just not drawn here.

| roof | what it draws |
|---|---|
| **Knee** | a hard transcript minimum at the steepest point of the barcode-rank curve, per sample |
| **Mito %** | cells above median + 3 MAD of mitochondrial fraction, per sample |
| **Complexity** | both tails of the genes-vs-transcripts fit: under-amplified and over-amplified |
| **Doublets** | scDblFinder, thresholded against the expected collision rate |

Same isometric world — same projection, shell, reader, index, theme switch —
because it is the same map at a different scale, not a different map about the
same subject.

## Every node is lifted, not re-typed

`bp-data.js` is **generated from `pipeline-data.js`**. Each node is extracted
as *source text* by brace-matching on `{id:"…"`, so every character of every
`does` / `built` / `cond` field matches the map it came from.

That is the whole point. Two hand-maintained accounts of one pipeline drift,
and the drift is invisible until someone quotes the wrong one. If a claim
changes, **change it on `/pipeline` and lift it again** — do not edit the prose
here.

Same for the payloads: `REAL_CELLS`, `REAL_GENES`, `REAL_REFS`, `REAL_SUBLIBS`
and the `read` / `cell` / `ref` / `meta` / `drop` snippets are the same records
travelling the same edges.

### What is authored here, and what is lifted

Three fields per cull are authored on this page. Everything else — `does`,
`built`, `cond` — is lifted byte-for-byte.

- **`name` and `sub`.** Three of the four are named differently from
  `/pipeline` and that is not drift. On the big map a cull node has to cover
  *every* policy the corpus uses for its stage: "Cell or background" names
  classifier, fitted knee and expect-cells together, because there it must.
  This page draws **one policy per roof** and names it. `pipelineName` carries
  the original through to the reader so the two can still be matched up.
- **`added`.** Anything this page says for itself, rendered under its own
  heading (*Drawn here*) so a reader can tell which map is talking.

Geometry is also overridden — the four culls become 4.2 units square with a
roof shape — but that is dimensional, never prose.

## Four culls, drawn rather than described

Each of the four makes a two-dimensional decision, and on the big map each is
a 0.7-unit hatched box with that decision in prose — the right call there,
where it is one of nineteen objects in one of four rows. Here there is room.

**Each roof IS its node, not a picture standing next to it.** An earlier build
had the complexity chart as a separate object hanging off D5 by a dashed line;
that put the same claim on the map twice and gave two places to keep in
agreement.

### The roof trick

A scatter rebuilt in three dimensions occludes the very thing it exists to
show, and a chart you have to orbit to read is not a chart. So it is not
rebuilt. It is drawn in flat 2D — axes, ticks, a polyline, circles, in a
176 × 176 chart space — and laid onto the horizontal roof by one
`transform="matrix()"`. `roofFrame()` in `bp-iso.js` is the mechanism.

That hands it a grammar:

> **PAINTED things are ELLIPSES. AIRBORNE things are CIRCLES.**

A cell still under consideration lies on the roof, and the matrix turns its
circle into the correctly-oriented ellipse for free. A cell that is leaving
lifts off it and becomes a true circle, with a shadow beneath it.

**Both tails go, for opposite reasons, and the two gestures are deliberately
not each other's mirror:** under-amplified cells peel off the surface;
over-amplified ones swell where they lie and burst.

### The attrition staircase

Ground scenery **behind** the row: the four culls' arithmetic as a band with
**one straight datum** and a far edge that **staircases down**, one riser per
cull, each shedding a tributary that drifts clear.

The straight edge is the point. It gives the run a datum, so every step is read
against one unmoving line instead of against a shape changing on both sides at
once — which is what the symmetric river this replaces got wrong: neither of
its edges held still, so the eye had nothing to measure against.

**Orientation.** On the ground plane, *decreasing* y projects up and to the
right. `yBase` sits just above the row, so the buildings land on the far side
of the datum and the band reads as lying behind them, with tributaries leaving
away from the buildings rather than across them.

Same trick as the roofs: drawn flat and laid onto the **ground plane** by one
matrix, at z = 0.002 so it never z-fights the grid. It registers **no ticker** —
a moving background behind four moving foregrounds is noise.

**The knee is the first riser and it takes 96.7%.** An earlier version left it
out on the grounds that a proportional band including it is a cliff followed by
three hairlines. It is — and that is the finding, not a drawing problem: on
this dataset the knee is very nearly the whole cull and the three after it are
a rounding. Two things keep the small ones readable:

- **each station's figure is a share of what *reached* it**, so mito reads
  −5.8% whether its riser is forty pixels or one;
- **a thin tributary flares to a floor width** as it drifts clear, so a small
  cull is still visibly a cull. The riser width — where the claim is actually
  made — stays exactly proportional.

**One denominator throughout**: every barcode that ever appeared. Nothing on
the band is a ratio between two different objects. Counts come from
`MODEL.ledger`, which applies the culls **in order**, each over what the one
before left — subtracting four independent percentages double-counts every
barcode two of them agree about, and two of them do.

The running remainder sits **inside** the band where the band is tall enough to
hold it and **just outside the staircase edge** where it is not. After the knee
the band is 3.3% of its own height, so centring every figure in it would stack
four numbers on one line.

Three things about how it sits, each of which was got wrong first:

- **`pointer-events:none`, and it is not optional.** It spans the whole lane
  and is painted after some of what stands near it, so without this it
  swallows their clicks and their drags. `check-clicks.mjs` found it at once.
  It stays reachable from the index, which is the right way to select a thing
  you cannot point at.
- **`scenery:true` keeps it out of the occlusion silhouette.** Punching a
  ground element out of the clip cuts a hole in the layer it belongs to.
- **The cull ledger is gone.** It hung off the row as an empty box saying in
  prose what the band says in geometry — that no per-barcode record of which
  stage killed which barcode exists here or anywhere in the corpus. The claim
  survives in the band's own condition field. One object fewer, same content.

`from`/`to` and the station ids are resolved to coordinates by the view after
`layoutRows()`, the same way `follow{}` is — so re-spacing the row re-shapes
the band instead of stranding it.

### `trend` and `squat` — which way the y axis runs, and how tall the plot is

Chart x and chart y map to the two roof diagonals. So a chart's trend is
projected onto their **sum** or their **difference** — onto the horizontal, or
onto the **vertical**. A trend that comes out vertical is a cloud squeezed into
a two-pixel sliver: geometrically correct, and useless. It happened twice
during this build.

`axesFrame` takes a `trend` and orients y so the trend is always a sum:

- **`"falling"`** — a rank curve. Transcripts drop as rank rises, so y is
  flipped the ordinary way and the axis corner sits bottom-left, exactly like
  a flat chart.
- **`"rising"`** — genes against transcripts. Both grow together, so y is
  **not** flipped: both quantities grow away from the near corner, like the
  corner of a room, and the origin sits top-left.
- **`"none"`** — a histogram, an embedding. No diagonal to protect; takes the
  ordinary orientation.

**`squat` is the second lever, and it is what lets a rising trend keep the
ordinary axis placement.** The trend's screen direction is
`(0.874(a−b), −0.505(a+b))`, where `a` is how far the data runs across the plot
and `b` how far it runs up it. At `a ≈ b` that is straight up — the sliver.
Shrink `b` by making the **plot short**, rather than by lying about the domain,
and the direction swings toward −30°, which is the roof's own x edge.

So the complexity roof is `trend:"none", squat:0.46`: x along the bottom like
every other chart here, and a cloud that still lies along the roof. What it
costs is a band of empty roof above and below the plot, which the axis titles
use anyway. `trend:"rising"` still exists and nothing uses it — fixing the
orientation by moving the *axis* was the wrong lever, because it put one
chart's origin in a different corner from the rest and that is what a reader
notices first.

### One thing on the roof is rotated, and only one

At turn 0 an unrotated string advances up-and-right at **−30°** — the same
angle the step names, the landmark names and the band title all read at. The
chart title and the x title are both flat for that reason, and so is every tick.

**The y title is turned a quarter, and only it.** Flat, it advanced along the
same screen direction as the x title, so the two ran parallel and nothing but
position said which axis either belonged to. Turned, it runs along its own arm
the way a y title does on any chart anywhere.

**The direction of the turn is not a free choice, and both signs look
plausible.** Chart +y projects to **+30°** on screen and chart −y to **−150°**.
Text laid along −150° runs right to left with its tops pointing down: upside
down, at a glance, on a roof. `rotate(+90)` lays it along +30° with its tops
up — parallel to the y arm, running the opposite way down that line from the
arrow, which is what makes it read as a label *on* the axis rather than a
second thing on it.

If this is ever changed, **measure the screen CTM**: the image of `(1,0)` is
the advance direction and the image of `(0,−1)` is glyph-up. Those two angles
are the only evidence that counts. `angles.mjs`, beside the checks, prints
both for every axis title on the map.

`roofFrame`'s `turn` parameter still exists and nothing uses it. Fixing the
orientation in the **data mapping** is the better fix where it is available;
turning is what is left when it is not.

### Ticks are filtered to their own domain

The domains are robust quantiles computed from the population, so which decades
are on the axis is not known when the ticks are written down. Tightening the
complexity domain pushed a "100" off the left end, where it landed on top of
the y axis's own "100" and rendered as `1000`. A tick outside its domain is a
label pointing at nothing, so `axesFrame` drops it.

### There is no panel on the map, and no legend, and no band

Each roof used to carry a small floating panel with its threshold and the
arithmetic behind it. All four are gone, along with the steel-thread band
across the top and the grammar legend in the corner.

A panel is a paragraph pretending to be part of a drawing. It has to be
placed, kept clear of its neighbours, and stopped from taking clicks, and it
says nothing the right-hand column could not say with more room and better
type. Three separate placement bugs came out of the four of them.

What survives is the requirement they existed for: **a modelled figure carries
the word wherever it is shown.** The word is now under each building's name on
the map, and the numbers are in the reader under *What the roof shows*, driven
by `FIGURES` in `bp-shapes.js` — keyed by **shape**, not by node id, because a
shape knows what it drew and the data file should not have to restate it.

A block of text could not have lived on a roof anyway. Chart x and chart y are
the two roof diagonals, so a block grows right-down as it gets wider and
left-down as it gets taller — it **fans**, and a four-line readout anchored in
the one empty corner lands on the data by its last line whichever corner it
starts from. Single lines — axis titles, tick numbers — are fine and stay
there.

`ANN_AT` remains: the annotations that *do* still float (UNDER-AMPLIFIED,
SYNTHETIC REFERENCE) are placed by stepping perpendicular to the row, so they
land in a line parallel to it rather than being nudged one at a time. The row
has been re-spaced four times and every hand-nudged label broke each time.

**Both axis titles are anchored `start`.** Anchored `end` they run leftward off
chart x = 0 — which a five-letter "GENES" survives and an eleven-letter
"TRANSCRIPTS" does not, so it looked like a one-off rather than the rule.

### Labels never take clicks

Everything `mkAnn()` draws carries `pointer-events:none`.

This is load-bearing. A label that floats over a neighbour is a **click target
sitting on top of it**: an arithmetic panel parked up-left meant clicking D4
selected D5, and once it moved, the under-amplified annotation landed on D3 and
did the same thing. Both were caught by `check-clicks.mjs`; neither looked
wrong in a screenshot. Chasing it with coordinates is a losing game — every
future nudge can re-introduce it. A label is not the thing it labels.

## REAL vs MODELLED

**Every threshold on the four roofs is modelled**, computed at load from the
seeded population in `bp-pop.js`. None of these four has a shipping policy with
a single drawable number behind it: the knee search exists in code but is not
what ships, the mitochondrial and complexity cuts are not written anywhere, and
doublet filtering is a docstring that raises. Each roof shows the *shape* of
its decision, not its answer.

Each carries the word in two places — under its name on the map, and in the
reader above the figures. **Keep it in both.** A node opts in with
`modelled:true`.

**One figure is real, and it is on the doublet roof: the expected collision
rate.** Three barcode rounds give 48 × 96 × 96 = 442,368 addressable paths, the
fourth barcode splits the run into 8 sublibraries, 94,616 cells were called,
and Poisson over paths gives the share of recovered barcodes that should hold
two cells. It sits in the reader in the *keep* colour, beside the modelled rate
it is being compared against, because where the two disagree is the point.

**The denominator is cells per SUBLIBRARY, not per run.** Two cells that took
the same path in different sublibraries are told apart by the fourth barcode,
so they never collide. Divide by the whole run instead and the expected rate
comes out roughly eight times too high — 10% instead of 1.3% — and it still
looks like a plausible multiplet rate, which is what makes it dangerous.

## Load order

```
bp-iso.js     projection, faces, paint, roofFrame, the ticker registry, lanes
bp-pop.js     the population and the statistics computed from it
bp-shapes.js  three shapes copied from /pipeline, one added, MODEL
bp-data.js    the lifted nodes, edges, band, payloads, prose
bp-view.js    assembly, camera, reader, index, strip
```

`bp-view.js` asserts this order and fails with a readable message rather than a
`ReferenceError` if a file 404s.

## The three copied shapes

`drawTile`, `drawHeap` and `drawMatrix` are verbatim from
`pipeline-shapes.js`, down to the seed `drawMatrix` uses for its sparsity. **A
step here must be the same object as the step there** — a box that looks
different is telling a reader they are looking at two different things. `SKIN`
keeps `/pipeline`'s token names for the same reason. (`drawHeap` currently has
no user: the FASTQ heap left with the counting stack. It stays because the
shapes file is the shared vocabulary, not a list of what is on screen today.)

## Drawing thousands of marks in SVG: pools

`pool()` is `batch()` from the old canvas build, translated: a whole cloud is
**one `<path>` whose `d` is a run of circle subpaths**, rebuilt as a single
string and written with one `setAttribute`. Alpha varies by having several
pools, not several thousand attributes.

A circle subpath drawn in **chart** space comes out of the matrix as the correct
ellipse; the same subpath in **screen** space comes out a circle. The
painted/airborne grammar, free, with no branch.

## Things that failed, so nobody re-tries them

**Never take a chart's axis limits from min and max.** Transcript counts are
log-normal with a long right tail and a doublet adds two draws together, so the
largest cell sits several sigma out on its own. Taking it as the limit
compressed the whole cloud into a two-pixel sliver: it rendered, it was wrong,
and nothing on screen said so. `domainOf()` takes robust quantiles and `F.plot`
is clipped, so the few off-scale marks do not draw — and **every count in the
reader is over the whole population**, never over what fitted.

**There is no title on a roof.** Two drafts had one, carrying the building's
name — already drawn on the map two centimetres away — and it sat straight
through the y-axis title. The roof carries the chart. The map carries the names.

**Fit the drawing, not the sheet.** `world.getBBox()` includes the ground grid
and the coordinate ruler, both of which deliberately run wider than the map.
`contentBox()` unions the band, the buildings and their names.

**Do not lower `N_BARCODES`.** Below ~11,000 the called population drops under
~370 cells and the doublet cut rises above every score it produces. Measured at
6,000 and 9,000 — both flag exactly zero. Nothing draws that cut now, but
`check-sim.mjs` asserts it and the cubic is fitted to the same population.

## The checks — run all six

```bash
node check-sim.mjs                       # no browser needed
node check-text.mjs    <url>             # needs playwright
node check-clicks.mjs  <url>             # needs playwright
node check-edit.mjs    <url>             # needs playwright
node check-delete.mjs  <url>             # needs playwright
node check-persist.mjs <url>             # needs playwright
```

The browser checks **stub `/api/bpipe_edits`**. What is under test is the
page's behaviour, not DynamoDB's, and a check that fails when a table is
unreachable — or when it is run against a static preview server — is a check
that gets ignored. `check-persist.mjs` is the exception that proves it: it
stands a *stateful* stand-in up instead, because a constant is exactly what
cannot catch the bug it exists for.

- **`check-sim.mjs`** asserts the population still supports the statistics. A
  picture that renders is not evidence the statistic underneath it works.
- **`check-text.mjs`** measures every drawn string as its **true oriented quad**
  — `getBBox()` through `getScreenCTM()` — and asserts each stays on its own
  roof and that no two overlap by real intersection area. **Do not use
  axis-aligned boxes here.** Roof text runs at ±30°, so its AABB is enormous and
  mostly empty, and two stacked lines that never touch report an 85% overlap.
  The first version of that file was useless for exactly that reason.
- **`check-clicks.mjs`** clicks every building with a *real* mouse press at the
  projected centre of its roof. Use `page.mouse.click`, never `dispatchEvent`:
  a synthetic event is not evidence about a real one, and this map pans on
  `pointerdown`. **It is the only check that catches a label eating a
  neighbour's clicks** — see "Labels never take clicks". Two other traps it
  avoids: "collapsed" is not "exactly zero" (a 1px border under `border-box`
  means a shut panel reports width 1), and the expected overview title is read
  off `OVERVIEW` rather than hardcoded — a hardcoded one passed for a build
  after the page was renamed.
- **`check-edit.mjs`** drives Edit positions with a real mouse: handles inert
  until the mode is on, a building drag that moves the building and *not* the
  name offset, a name drag that moves the name and *not* the building, an
  annotation drag whose **leader end follows the text while the end naming a
  point on the chart does not budge**, the result written to local storage, and
  a paste-back block containing both an `ldx`/`ldy` and an `adx`/`ady`. Pointer capture is what the mode is built on, and a
  dispatched `MouseEvent` skips pointer events entirely — a synthetic drag
  would pass against an implementation no hand could drive.
- **`check-delete.mjs`** drives pick → × → confirm → delete, asserts **Cancel
  spares the object**, that the deletion is written and survives a reload with
  its edges gone, and that the Save confirmation both **appears and then leaves
  on its own**. A notice that needs dismissing is a second thing to do after
  the thing you wanted to do; one that never leaves is indistinguishable from a
  stuck page.
- **`check-persist.mjs`** runs a **stateful stub with a monotonic `at`** — a
  constant stamp cannot tell a working reconciliation from one that always
  keeps local — and asserts all seven transitions: a save holds through a
  reload and through a second one; a browser that has never seen the record
  opens on it; **unsaved work survives a reload, both before a save and after
  one**, which is the case that was reported twice; a record published
  elsewhere is still adopted; a browser holding the **pre-stamp** record
  migrates; the table names only what was touched; and applying it twice lands
  where applying it once does. It compares **every object, not the one that was
  dragged** — the second persistence bug moved the attrition band, which the
  drag never touched, while the building that was dragged sat perfectly still. The other five all passed the day Save silently
  stopped taking, because they stub the endpoint to a constant and the author's
  own browser had the arrangement in local storage. This one runs a stateful
  record, opens a **second context** with an empty store, and also asserts the
  saved table names only what was actually touched and that applying it twice
  lands in the same place as applying it once.

## Performance

One `requestAnimationFrame` drives the page. **A roof must never start its own.**
Roofs push to `TICKERS`; a ticker that throws is dropped and the map keeps
running. `window.bpipeDiag()` returns one line of state when it looks stuck.

## Edit positions

Ported from `/pipeline`. Everything the map draws is placed from world
coordinates and the projection is affine, so a drag is exact rather than
approximate: a screen delta divides straight back into a world delta and moving
an object is a `translate` on the group it was drawn into. Nothing re-renders
and no ticker is disturbed.

**Three kinds of thing drag, and they are three different mechanisms.**

- **A building.** World coordinates; the drag divides a screen delta back into
  a world delta and translates the group.
- **Its name.** Same, but into `ldx`/`ldy`, composed in front of the label
  group's own translate+rotate.
- **The band's own name** — a **mover**. It belongs to no building, so nothing
  in the nudge table reached it and it was the one string on the map that could
  not be got out of the way of anything else. It is placed from world
  coordinates like everything else, so it takes the same world-unit nudge a
  building's name does, under its own key (`band:0`). `MOVERS` in `bp-view.js`;
  add to that list and it drags, saves and deletes with no other work.
- **A floating annotation** — UNDER-AMPLIFIED, SYNTHETIC REFERENCE. These are
  not laid out from world coordinates at all: their own shape re-places them
  from scratch **every frame**, so moving the element is pointless — the next
  frame puts it back. What is draggable is `ann.off`, a nudge in world-SVG
  units that `placeAnn()` adds to whatever the shape asked for. The shape keeps
  owning where the label starts; the editor owns where it ends up. And because
  `placeAnn` recomputes the leader from the moved text to the **unmoved**
  target, the line follows the label — which is the whole reason a label like
  this is worth being able to move.

**The building and its name drag separately.** A name is not attached to its
building by anything but convention — it floats above and to one side, and
where it can go depends on what its neighbours are doing. So it gets its own
handle (a box round it, because glyphs are mostly holes and cannot be reliably
picked up) and its own pair of nudges. Moving the building carries the name
along; moving the name leaves the building alone. Both directions are asserted
in `check-edit.mjs`, because both failure modes look fine in a screenshot.

What comes out is a table of **nudges** — `dx`/`dy` for the object, `ldx`/`ldy`
for its name, `adx`/`ady` for an annotation (keyed `"<node>:<which>"`), `del`
for a deletion — relative to whatever `layoutRows()` computed, so it survives
the lane being re-solved or a step being inserted.

### One base, captured once: `_ox` / `_oy`

**Including the scenery.** The attrition band's *span* is derived from the
buildings it covers, and deriving its *base* from them too makes the base a
function of the very table being applied: shift the first matrix a unit left
and the band's zero goes with it, on top of the nudge it already carries. It
moved by different amounts down the two paths a table can arrive by — local
storage lands before the lane is solved, the shared record lands after the map
is drawn — so a layout saved in one browser opened a unit off in the next, and
crept another unit on every save-and-reload after that. It looked exactly like
a save that had not taken, which is what it was reported as, twice.

`resolveScenery()` now takes the base from `A._ox` and the span from `A.x`.
Two different questions, two different answers.

**Every nudge is measured from `_ox`/`_oy`, the lane engine's own output, and
from nothing else.** They are captured immediately after `layoutRows()` and
never written again. `applyNudge(n,o)` sets `n.x = n._ox + o.dx`, so applying a
table twice lands in the same place as applying it once, and reading the table
back is a subtraction that cannot drift.

The version before this composed offsets on top of *wherever the node currently
was* and read them back as `current − start + LIVE[id]`, which is only correct
while `LIVE` is exactly what was applied. Two bugs came out of it:

- **A phantom `RIVER` offset in every save.** The attrition band's `x` is
  *derived* from the buildings it spans, and it was derived after the base was
  captured — so the band read as having been dragged 12.3 units by a user who
  had never touched it. Scenery is now resolved **after** offsets are applied,
  and takes its base from its derived position.
- **A shared copy that could not be applied in place.** See below.

### And the record is read back consistently

`GET /api/bpipe_edits` passes `ConsistentRead: true` and the route is
`force-dynamic`. A save is read back within seconds of being written — the
author reloads to check it took — and DynamoDB's default eventually-consistent
read may legitimately serve the previous layout to exactly that reload. There
is no way to tell that apart from a save that never happened.

### Who is ahead: the record carries a timestamp

**This is `/pipeline`'s scheme, ported.** That map has been edited daily for
months and keeps a sitting; this one had two goes at inventing something and
got it wrong in both directions, so the third answer is to use the one that
works rather than a fourth idea.

The stored record is **`{offsets, at}`**, never a bare table. Every drag stamps
`at` with the local clock. A successful save replaces that with the **record's
own** stamp — stamping with this browser's clock instead means the next load
compares two clocks, and a browser a few seconds fast reads its own save as
somebody else's and reloads over it.

On load: **the shared copy wins only if `doc.at` is strictly newer.** Anything
else is this browser holding work the record has not seen, and it is left
alone — with `seedUnpublished()` marking every key that differs, so the merge
on the way out carries it rather than deferring to the store.

**A save is a merge, never a replacement.** The record is one document and the
write is a whole-document Put, so a blind write means the second person to
press Save flattens the first — and, less obviously, means a browser holding a
stale copy of somebody else's work republishes it. `pushRemote()` reads the
record, lays only the keys this sitting **owns** on top (`ours(k)` = touched
here, or held unpublished), and writes that. A read failure aborts the write:
keeping a change in this browser is recoverable, overwriting somebody else's
sitting is not.

**Taking theirs is a reload, not an in-place application.** `applyOffsets()`
re-runs only a *subset* of what a load does — it moves the objects and repaints
the edges, and does not re-derive the attrition band's span, re-solve the lane,
rebuild the index or recompute the occlusion clip. The result is a picture no
reload reproduces, which from the outside is indistinguishable from a layout
that did not take. The reload is guarded: if the local write did not land, the
page says so instead of reloading into the same state for ever.

#### The two wrong answers, so nobody re-derives them

- **Apply the record on any difference.** Two copies cannot say which is newer.
  Every unpublished drag reads as a stale browser and is discarded: move
  something, Save, move something else, reload, and the second move is gone.
- **Compare JSON against a remembered copy.** A two-way comparison dressed up
  as a three-way one, with a fall-through that adopts when the marker is
  missing — which is every browser that had edits before it shipped. A
  timestamp is one number, and it is monotonic.

### The confirmation counts this sitting, not the table

The saved table is the whole arrangement, not a diff, so counting it and
calling the answer "moved" tells somebody who nudged one label that they moved
eleven things. `touched` is the set of ids this sitting actually changed; the
toast reports both — *"1 moved this sitting · 11 placements in force"*.

### What the shared copy is for

The record at `/api/bpipe_edits` is what makes one person's arrangement the
default for everyone else. It is read **after the map has drawn, never before**
— a page that waits on a network round trip to show anything shows nothing when
the network is slow — and a read failure is silent, because the map is already
on screen from the tables in the data file.

It also declines to disturb a sitting in progress in *this* tab: if `dirty`,
the fetched copy is only used to mark what is unpublished.

### Save

**Save writes to three places, and says which of them took.** The browser
(`localStorage`, `bpipe.offsets`), the shared record at `/api/bpipe_edits`, and
a block printed in the reader to paste into `OFFSETS` in `bp-data.js`. The
shared record is what makes a sitting the default for everyone; the pasted
block is what puts it in the repo, where it survives the store being cleared.
If the POST fails the confirmation says so plainly — "saved in this browser
only" — rather than claiming a default it did not set.

**The shared record has its own `ITEM_ID`, never `/pipeline`'s.** One record
between two maps means whichever saved last erases the other, silently, with
no way to tell which happened.

**It is read after the map has drawn, never before.** A page that waits on a
network round trip to show anything shows nothing when the network is slow.

**Save and Discard are always in the toolbar.** They used to appear only once
something was dirty, which is a control that goes missing exactly when you go
looking for it. `body.haschanges` now only tints Save rather than hiding it.

### Deleting

In the mode, a press that does not travel is a **pick** rather than a drag, and
a picked object gets a **×** at its top corner. Clicking it asks first.

Everything else in this mode undoes itself by dragging back; deleting does not,
and the saved state is shared, so a mis-click takes an object off the map for
everybody. `check-delete.mjs` asserts Cancel as hard as it asserts Delete.

The × is an **HTML button in the stage, not an SVG one**, for two reasons: it
must not shear with the projection, and it must not live inside the group it is
offering to delete — a control that vanishes with its own target cannot be
pressed a second time. It rides the camera from the frame loop so it stays on
its object through a pan.

A deletion is recorded as `del:true` in the same table as the nudges, and is
applied **before anything is laid out** — the lane solve, the edges, the index
and the occlusion clip all have to be computed over what is actually on the
map. A station on the attrition band whose cull has been deleted drops off the
band with it.

**Annotations are held at full opacity while the mode is on.** They only exist
for part of each roof's loop, and a label you cannot see is a label you cannot
pick up — the handle would be an empty dashed box hovering over nothing.

## The palette is `/pipeline`'s, token for token

`index.html`'s `:root` and `body.light` blocks are **lifted from `/pipeline`
verbatim** — the same greys, the same `--t-*` / `--a-*` / `--k-*` face triples,
the same `--signal` and `--drop`. This map is the same row of the same story and
it has to read as the same material.

Three names this page uses are **aliases onto those tokens**, not new colours:

```
--keep:   var(--fg2)     the survivors, the bulk, anything that stays
--cull:   var(--drop)    anything leaving, on any roof and on the staircase
--accent: var(--signal)  a threshold: the knee, the MAD line, the band rails
```

**Do not introduce a fourth.** Every mark on this page is one of three things —
it stays, it goes, or it is the line deciding which — and the moment a roof
gets its own hue the four culls stop being comparable at a glance. If a new
roof needs a distinction the three do not carry, it needs a different
*encoding* (fill vs ring, painted vs airborne), not a different colour.

## What is deliberately NOT here

**Edit text and Edit visual**, the other two authoring modes from `/pipeline`.
Edit positions *is* here, with its own record — `bioinformatics_pipe::edits` in
`src/app/api/bpipe_edits/route.ts`, never `/pipeline`'s `pipeline_map::edits`.
One record between two maps means whichever saved last erases the other,
silently, with no way to tell which happened. If this page ever needs the other
two modes, that is the constraint they inherit.

## Please do not

- **Edit the prose in `bp-data.js`.** It is lifted. Edit `/pipeline` and lift
  again, or the two maps start disagreeing about the same stage. New writing
  belongs in `added:`.
- **Give the modelled band a real-looking label**, or drop the word to tidy a
  line up. It is the one modelled figure on a page where everything else is read
  off an artefact.
- **Hardcode the band** because the computed one moved somewhere you did not
  like. If the computed one is wrong, the population model is wrong.
- **Flip the roof's y axis back.** It looks like a bug and is the only reason
  the cloud lies along the roof rather than across it.
- **Centre a squat plot.** `squat` is anchored to the x axis on purpose: the
  corner and the x arm have to land where they land on every neighbouring roof,
  or four charts meant to be read as a series stop lining up with each other.
- **Write a carry down as coordinates.** Both of them are anchored to the
  building they serve and run along the row. Fixed, they stayed put when that
  building was dragged, so the map could be arranged into a state where the
  barcodes arrive four units short of the matrix.
- **Replace the hand-rolled projection with a library.** Layout, label angles,
  painter ordering, the camera and the roof matrix all derive from `P()`.
- **Write to `_ox`/`_oy` after they are captured**, or read a nudge back as
  anything other than `x − _ox`. That is the single base the whole edit mode
  measures from; the moment something else moves it, saves start containing
  objects nobody touched.
- **Add a colour.** Three encodings — stays, goes, threshold — aliased onto
  `/pipeline`'s tokens. A roof with its own hue is a roof that can no longer be
  compared with the other three at a glance.
