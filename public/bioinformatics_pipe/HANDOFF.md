# /bioinformatics_pipe — contract and ownership

A self-contained static page in `public/bioinformatics_pipe/`: `index.html`
plus five classic scripts, no build step, no dependencies, no CDN. Served by a
Next rewrite (`next.config.js`) with no-cache headers, exactly like
`/pipeline` and `/data_structures`.

`<script src>` attributes are **absolute** (`/bioinformatics_pipe/bp-iso.js`)
because the route has no trailing slash — relative paths resolve against `/`
and 404.

## What this page is

**Row 3 of `/pipeline`, and only row 3.**

On the big map the four rows are named *Biological samples*, *Molecular
biology*, **Bioinformatics pipeline** and *Opinionated metadata*. The third of
those is this page: FASTQ in, a counting stack, the unfiltered matrix, six
culls, the filtered matrix out, plus the four side structures that hang off
them. Nineteen objects. There it is one band among four and its nodes are
drawn small; here it has the whole canvas.

It is the same isometric world — same projection, same shell, same reader,
same index, same theme switch — because it is the same map at a different
scale, not a different map about the same subject.

## Every node is lifted, not re-typed

`bp-data.js` is **generated from `pipeline-data.js`**. Each node is extracted
as *source text* by brace-matching on `{id:"…"`, so every character of every
`does` / `built` / `cond` field matches the map it came from.

That is the whole point. Two hand-maintained accounts of one pipeline drift,
and the drift is invisible until someone quotes the wrong one. If a claim
changes, **change it on `/pipeline` and lift it again** — do not edit the prose
here.

The same goes for the payloads: `REAL_CELLS`, `REAL_GENES`, `REAL_REFS`,
`REAL_SUBLIBS` and the `read` / `cell` / `ref` / `meta` / `drop` snippets are
the same records travelling the same edges.

The extraction scripts are not checked in — they are twenty lines and are
rewritten when needed. What matters is the rule, not the tooling.

## What is added, and it is one thing

**`CPLX` — the complexity roof.** Node `D5`, "Outliers off the trend", says it
fits genes detected against total counts and removes points sitting too far
off the fit. That is a two-dimensional argument, and on the big map it is a
0.7-unit hatched box with the argument in the text — the right call there,
where it is one of nineteen objects in one of four rows. Here there is room to
draw it.

It **hangs under D5** rather than replacing it, which is the same relationship
the counting reference, the 3′ UTR handling and the cull ledger already have to
the steps they hang off. D5 stays exactly as it is on the big map.

### The roof trick

A scatter rebuilt in three dimensions occludes the very thing it exists to
show, and a chart you have to orbit to read is not a chart. So it is not
rebuilt. It is drawn in ordinary flat 2D — axes, ticks, a polyline, circles, in
a 176 × 176 chart space — and laid onto the horizontal roof by one
`transform="matrix()"` built from three projected corners. `roofFrame()` in
`bp-iso.js` is the whole mechanism.

That hands it a grammar:

> **PAINTED things are ELLIPSES. AIRBORNE things are CIRCLES.**

A cell still under consideration lies on the roof, and the matrix turns its
circle into the correctly-oriented ellipse for free. A cell that is leaving
lifts off it and becomes a true circle, with a shadow on the roof beneath it.

**Both tails go, for opposite reasons, and the two gestures are deliberately
not each other's mirror:** under-amplified cells peel off the surface;
over-amplified ones swell where they lie and burst. Reading this filter as
one-sided is the common mistake.

### TURN, and why it exists

Chart x and chart y map to the two roof diagonals. A chart whose data trends
diagonally therefore has its trend projected onto the **sum** or the
**difference** of those directions — horizontal, or vertical.

Genes against transcripts is a straight diagonal in log-log, and at turn 0 the
cloud came out as a near-vertical sliver: geometrically correct, and useless.
`roofFrame(..., turn)` lays the chart against the other roof edge.

**The rule for a new roof:** if the data trends up-and-right in chart space,
turn it. If it trends down-and-right — a rank curve, a histogram — leave it.
Both orientations keep a positive determinant, so text is never mirrored.

### The y-axis title sign

`rotate(+90)` at turn 0, `rotate(-90)` at turn 1. Get it backwards and the
title advances along the wrong diagonal and renders upside down, read from its
own end. It looks like a mirroring bug and is not one.

### The threshold panel is upright, and off the roof

A block of text cannot live in chart space. Chart x and chart y are the two
roof diagonals, so a block grows right-down as it gets wider and left-down as
it gets taller — it **fans**. A four-line readout anchored in the one empty
corner sweeps across the roof and lands on the band by its last line,
whichever corner you start from. Three placements were tried and all three did
it. `panel()` draws it upright beside the building instead. Single lines —
axis titles, tick numbers — are fine on the roof and stay there.

## REAL vs MODELLED

**Every figure on this page is real and matches `/pipeline` exactly — with one
exception.** The complexity roof is modelled: computed at load from the seeded
population in `bp-pop.js`, because the real fit is a spline fitted **per
sample** at a p-level spanning 6.9e-6 to 1e-3 across a single plate, and there
is no single band that would be true of the run. What the roof shows is the
*shape* of the decision, not its answer.

It carries the word in three places — on the panel, under its name on the map,
and in the reader. **Keep it in all three.** The node opts in with
`modelled:true`; nothing else on this page sets it.

`bp-pop.js` also computes the knee, the mito cutoff and the doublet threshold.
Nothing draws them any more — the culls on this row are `/pipeline`'s own tiles
— but `check-sim.mjs` still asserts the population supports them, because it is
the same population and a change that breaks one statistic has broken the model
the band is fitted to.

## Load order

```
bp-iso.js     projection, faces, paint, roofFrame, the ticker registry, lanes
bp-pop.js     the population and the statistics computed from it
bp-shapes.js  three shapes copied from /pipeline, one added, MODEL
bp-data.js    row 3, lifted — nodes, edges, band, payloads, prose
bp-view.js    assembly, camera, reader, index, strip
```

`bp-view.js` asserts this order at the top and fails with a readable message
rather than a `ReferenceError` if a file 404s.

## The three copied shapes

`drawTile`, `drawHeap` and `drawMatrix` are verbatim from
`pipeline-shapes.js`, down to the seed `drawMatrix` uses for its sparsity. **A
step on this page must be the same object as the step on that one** — a box
that looks different is telling a reader they are looking at two different
things. `SKIN` keeps `/pipeline`'s token names for the same reason: a shape
copied across finds the tokens it expects.

## Drawing thousands of marks in SVG: pools

`pool()` is `batch()` from the old canvas build, translated: a whole cloud is
**one `<path>` whose `d` is a run of circle subpaths**, rebuilt as a single
string and written with one `setAttribute`. Alpha varies by having several
pools, not several thousand attributes.

A circle subpath drawn in **chart** space comes out of the matrix as the
correct ellipse; the same subpath drawn in **screen** space comes out a circle.
The painted/airborne grammar, for free, with no branch.

## Things that failed, so nobody re-tries them

**Never take a chart's axis limits from min and max.** Transcript counts are
log-normal with a long right tail and a doublet adds two draws together, so the
largest cell sits several sigma out on its own. Taking it as the limit
compressed the whole cloud into a two-pixel sliver: it rendered, it was wrong,
and nothing on screen said so. `domainOf()` takes robust quantiles and `F.plot`
is clipped, so the handful of off-scale marks simply do not draw — and **every
count in the panel is over the whole population**, never over what fitted.

**There is no title on a roof.** Two drafts had one, carrying the building's
name — already drawn on the map two centimetres away — and it sat straight
through the y-axis title. The roof carries the chart. The map carries the names.

**An annotation cannot go straight up from this roof.** That is where D7's name
runs, and the under-amplified label landed on it. Both annotations are pushed
out to the side; the leader lines carry the association.

**Fit the drawing, not the sheet.** `world.getBBox()` includes the ground grid
and the coordinate ruler, both of which deliberately run wider than the map.
`contentBox()` unions the band, the buildings and their names.

**Do not lower `N_BARCODES`.** Below ~11,000 the called population drops under
~370 cells and the doublet cut rises above every score it produces. Measured at
6,000 and 9,000 — both flag exactly zero. Nothing draws the doublet cut here
any more, but `check-sim.mjs` still asserts it, and the cubic is fitted to the
same population.

**Cells need TYPES, and a doublet must BE two cells.** Both were tried the
other way and the scorer had nothing to find. Same reason: the population is
shared.

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
  axis-aligned boxes here.** Roof text runs at ±30°, so its AABB is enormous
  and mostly empty, and two stacked lines of one block that do not touch report
  an 85% overlap. The first version of that file was useless for exactly that
  reason.
- **`check-clicks.mjs`** clicks every building with a *real* mouse press at the
  projected centre of its roof. Use `page.mouse.click`, never `dispatchEvent`:
  a synthetic event is not evidence about a real one, and this map pans on
  `pointerdown`. Two traps it now avoids: "collapsed" is not "exactly zero"
  (both columns carry a 1px border under `border-box`, so a shut panel reports
  width 1), and the expected overview title is read off `OVERVIEW` rather than
  hardcoded — a hardcoded one passed for a build after the page was renamed.

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
  again, or the two maps start disagreeing about the same stage.
- **Give the modelled roof a real-looking label**, or drop the word to tidy a
  line up. It is the one modelled thing on a page where everything else is read
  off an artefact.
- **Hardcode the band** because the computed one moved somewhere you did not
  like. If the computed one is wrong, the population model is wrong.
- **Replace the hand-rolled projection with a library.** Layout, label angles,
  painter ordering, the camera and the roof matrix all derive from `P()`.
