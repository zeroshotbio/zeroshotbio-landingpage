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
thrown out of one. Nine objects, where row 3 has nineteen.

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

### Geometry is rescaled. Prose never is.

Two overrides are applied to the lifted text, both purely dimensional:

- the six culls are scaled **×1.7** in `w`/`d`/`h`, because on the big map they
  share a row with thirteen other objects and here they are the only thing on
  the canvas. Left at 0.7 they are specks in a wide lane.
- **D5 becomes the roof** — `shape:"complexityroof"`, 4.2 units square.

Anything this page has to say for itself goes in the added `added:` field,
rendered in the reader under its own heading (*Drawn here*) so a reader can
tell which map is talking.

## D5 is drawn, not described

Node D5, "Outliers off the trend", says it fits genes detected against total
counts and removes points sitting too far off the fit. That is a
two-dimensional argument, and on the big map it is a 0.7-unit hatched box with
the argument in the text — the right call there. Here there is room to draw it.

**It is the same node, not a picture standing next to it.** An earlier build
had the chart as a separate object hanging off D5 by a dashed line; that put
the same claim on the map twice and gave two places to keep in agreement.

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

### Both chart axes grow AWAY from the corner, and y is not flipped

This one line does two jobs and they are the same job.

On a flat chart y is flipped because the page has a top and a bottom and "up"
means more. **A roof has neither.** What it has is a near corner and two edges
running away from it. Chart x and chart y map to those two roof diagonals, so a
trend is projected onto their **sum** or their **difference** — onto the
horizontal, or onto the vertical. Genes rise with transcripts; with y flipped
that is a difference, and the cloud came out as a near-vertical sliver:
geometrically correct and useless.

Unflipped, both quantities grow outward from the corner, the trend is a sum,
and the cloud lies **along** the roof. The axis L opens from the origin with one
arm up-right and one down-right, arrowheads pointing away from the corner —
like the corner of a room.

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

### The threshold panel is upright, and off the roof

A block of text cannot live in chart space. Chart x and chart y are the two
roof diagonals, so a block grows right-down as it gets wider and left-down as
it gets taller — it **fans**. A four-line readout anchored in the one empty
corner sweeps across the roof and lands on the band by its last line, from
whichever corner it starts. Three placements were tried and all three did it.
`panel()` draws it upright beside the building. Single lines — axis titles, tick
numbers — are fine on the roof and stay there.

### Labels never take clicks

Everything `panel()` and `mkAnn()` draw carries `pointer-events:none`.

This is load-bearing. A label that floats over a neighbour is a **click target
sitting on top of it**: the panel parked up-left meant clicking D4 selected D5,
and once it moved, the under-amplified annotation landed on D3 and did the same
thing. Both were caught by `check-clicks.mjs`; neither looked wrong in a
screenshot. Chasing it with coordinates is a losing game — every future nudge
can re-introduce it. A label is not the thing it labels.

## REAL vs MODELLED

**Every figure on this page is real and matches `/pipeline` exactly — with one
exception.** D5's band is modelled: computed at load from the seeded population
in `bp-pop.js`, because the real fit is a spline fitted **per sample** at a
p-level spanning 6.9e-6 to 1e-3 across a single plate, and there is no single
band that would be true of the run. The roof shows the *shape* of the decision,
not its answer.

It carries the word in three places — on the panel, under its name on the map,
and in the reader. **Keep it in all three.** The node opts in with
`modelled:true`; nothing else on this page sets it.

`bp-pop.js` also computes the knee, the mito cutoff and the doublet threshold.
Nothing draws them — those culls are `/pipeline`'s own tiles — but
`check-sim.mjs` still asserts the population supports them, because it is the
same population and a change that breaks one statistic has broken the model the
band is fitted to.

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
panel is over the whole population**, never over what fitted.

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
node check-text.mjs  <url>               # needs playwright
node check-clicks.mjs <url>              # needs playwright
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

## Performance

One `requestAnimationFrame` drives the page. **A roof must never start its own.**
Roofs push to `TICKERS`; a ticker that throws is dropped and the map keeps
running. `window.bpipeDiag()` returns one line of state when it looks stuck.

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
