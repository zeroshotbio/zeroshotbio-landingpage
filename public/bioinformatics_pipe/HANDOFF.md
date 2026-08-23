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
- **The cull ledger has to be on the other side.** It has been above and below
  during this build; whichever side the band is not on is the right one.

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

### Nothing on the roof is rotated

At turn 0 an unrotated string advances up-and-right at **−30°** — the same
angle the step names, the landmark names and the band title all read at. So
every word on the roof lies the same way as every word on the rest of the map,
and the eye never changes reading angle crossing between them.

The cost: an axis title cannot run *parallel* to its own axis, because the y arm
goes down-right and a title following it would read at +30° and break the rule.
So **both titles sit at the far end of their arm**, past the arrowhead. That is
a legitimate convention and keeps the association without the rotation.

`roofFrame`'s `turn` parameter still exists and nothing uses it. Fixing the
orientation in the **data mapping** is the better fix where it is available;
turning is what is left when it is not.

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

## The checks — run all three

```bash
node check-sim.mjs                       # no browser needed
node check-text.mjs   <url>              # needs playwright
node check-clicks.mjs <url>              # needs playwright
node check-edit.mjs   <url>              # needs playwright
```

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
for its name, `adx`/`ady` for an annotation (keyed `"<node>:<which>"`) —
relative to whatever `layoutRows()` computed — so it
survives the lane being re-solved or a step being inserted. Save prints the
block to paste into `OFFSETS` in `bp-data.js`; the browser holds a copy under
`bpipe.offsets` until it is baked in.

**It writes to local storage only.** `/pipeline`'s Save posts to a shared
DynamoDB record keyed `pipeline_map::edits`; a second page writing there would
overwrite that map's saved state.

## What is deliberately NOT here

**The three authoring modes from `/pipeline`** — Edit positions, Edit text, Edit
visual. They write to a single fixed DynamoDB record keyed `pipeline_map::edits`,
and a second page pointing at it would silently overwrite that map's saved
state. If this page ever needs them, it needs its own record first.

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
- **Replace the hand-rolled projection with a library.** Layout, label angles,
  painter ordering, the camera and the roof matrix all derive from `P()`.
