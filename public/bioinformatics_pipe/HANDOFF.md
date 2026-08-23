# /bioinformatics_pipe — contract and ownership

A self-contained static page in `public/bioinformatics_pipe/`: `index.html`
plus five classic scripts, no build step, no dependencies, no CDN. Served by a
Next rewrite (`next.config.js`) with no-cache headers, exactly like
`/pipeline` and `/data_structures`.

`<script src>` attributes are **absolute** (`/bioinformatics_pipe/bp-pop.js`)
because the route has no trailing slash — relative paths resolve against `/`
and 404.

## What it is, and how it relates to /data_structures

`/data_structures` is a plan of the medallion **architecture**: three buckets,
three repos, one contract. This page is **one leg of it at higher resolution** —
the six culls between the unfiltered DGE that split-pipe produces and the
filtered matrix normalisation expects.

Same steel thread (MiniFin 100k), same chrome, same reader contract, same
collapsing columns. Two things are deliberately different:

| | /data_structures | here |
| --- | --- | --- |
| Stage | one pannable SVG plan | a scrolling column of animated canvas tiles |
| Why | a structure you navigate | a sequence of events in order |
| Palette | bronze / silver / gold | keep / cull / accent |

The tile palette is **not** the medallion palette on purpose. Those colours
mean bronze, silver and gold; reusing them for "survives / leaving / threshold"
would say something false.

## Load order

```
bp-pop.js     the population and the statistics computed from it
bp-draw.js    the drawing vocabulary — one unit, the frame, text, annotation
bp-tiles.js   the cascade + the six tiles
bp-data.js    what the page ASSERTS: state, briefs, figures
bp-view.js    canvases, the loop, the index, the reader, the grips
```

`bp-pop.js` and `bp-data.js` are the on-instance's; `bp-draw.js` and
`bp-view.js` are the renderer's. `bp-tiles.js` is the seam and is the one file
where changing a number changes a picture.

## REAL vs MODELLED — the thing this page lives or dies on

Two kinds of number appear and they are never allowed to look alike.

**Real**, read from the artifacts: 2,743,021 barcodes, 32,520 genes, 94,616
called cells, the three cell-calling policies and their jaccards.

**Modelled**, computed at load from a seeded simulation: every threshold on
tiles 02–06, and every survivor count downstream of the knee.

The reason this matters is the state of the pipeline. Verified 2026-08-23
against `zsb-bronze 0414ac4` and `zsb-silver b4253a2`:

- **zsb-bronze contains no mito, complexity or doublet code at all.** The only
  "mitochondrial" string in the tree is a sample name in a test fixture.
- **zsb-silver's `build_gold()` is a docstring and a `raise`.** It names "QC and
  doublet filtering"; it does not name mito% or complexity under any name.
- **zsb-bronze does implement `barcode_ranks()`** — a real port of the
  DropletUtils knee search, which finds 94,338 against the delivered 94,616
  (jaccard 0.9827). It is *not* the shipping policy; `parse-cutoffs` is.

So of the four culls drawn, **one has a method in code and it is not the one
that ships.** A page that showed a mitochondrial cutoff without saying it was
invented would be claiming a result nobody has produced. Every modelled figure
carries the word on the tile, in the card, and in the reader. Keep it there.

## Every threshold is computed. None is a literal.

`bp-pop.js` calculates the knee (steepest descent on a smoothed log-log rank
curve), the mito cutoff (median + 3 × MAD), the complexity band (least-squares
cubic + robust residual sigma) and the doublet threshold. Reseed and they all
move. This is invisible when right and obvious when wrong — a hardcoded band
sits in the same place no matter what the cloud does, and the tile becomes an
illustration pretending to be a computation.

## Things that failed, so nobody re-tries them

**Do not lower `N_BARCODES` to make tile 01 less crowded.** Below ~11,000 the
called population drops under ~370 cells and the doublet cut rises above every
score it produces: tile 05 flags nothing, the ledger loses a row, and nothing
on screen says anything is wrong. Measured at 6,000 and 9,000 — both flag
exactly zero. Crowding is a *drawing* problem, solved in radius and alpha.

**Cells need TYPES.** Without an expression embedding a doublet is almost
exactly a large singlet: the scorer recovered them at 10% precision, flagging a
quarter of the population. Real doublet finders work in expression space, where
a doublet lands *between* two clusters. Without neighbourhoods there is no
between.

**A doublet must BE two cells.** Carrying `isDoublet` as a label that left the
profile untouched gave the scorer nothing to find.

**Otsu is wrong for the doublet threshold.** It maximises a mass-weighted
quantity and doublets are ~3% of the mass, so the cut lands inside the singlet
bulk. Steepest-descent (borrowed from the rank knee) is worse — it puts the cut
above the highest-scoring real doublet. `median + 3 × MAD` is what works, and
it is the same instrument the mito tile uses.

**The doublet caller over-calls, roughly 2×. That is not a bug to tune away.**
`TYPES` contains one deliberately adjacent pair (neural / neural crest) so the
tile shows the hard case as well as the easy one.

**Never estimate text width from a character count.** The monospace advance is
0.60 em with SF Mono and **0.93 em** with the default monospace in headless
Chromium — a 55% difference. Three tiles ran their annotations off the canvas
because the layout was sized against a guessed 0.6. Everything goes through
`ctx.measureText` now, and `tracked(..., max)` shrinks to fit.

**The loss bar in tile 06 is over the cells, not the barcodes.** Including the
knee made it 97% one segment with three invisible slivers, *and* conflated two
denominators: the knee removes empty droplets, the QC filters remove cells.

## One unit governs everything

```js
const S = Math.min(wrap.clientWidth, wrap.clientHeight);
const u = S / 100;
```

Every size — type, stroke, tick, dot radius, dash gap, padding — is a multiple
of `u`. There is not one fixed pixel value in `bp-draw.js` or `bp-tiles.js`.
The tiles are ~190px in the column and ~420px in preview and must read
identically in both; a single hardcoded `12px` breaks that everywhere at once
and is invisible at whatever size you happened to be looking at.

Settled values are in `PAD`, `TYPE_` and `W` in `bp-draw.js`. Do not re-derive
them.

## Each cull's gesture is different, and the difference means something

```
02  barcodes below the knee RAIN downward      they were never cells
03  dying cells RISE off the top and fade      they are leaking
04  under-amplified SHRINK, over-amplified SWELL AND BURST
05  doublets PULL APART into their two halves  they were always two
```

Six identical fades would make the sequence read as one animation on a loop.
**Do not reuse a gesture.**

## The checks — run all three

```bash
node check-sim.mjs                       # no browser needed
node check-text.mjs  <url>               # needs playwright
node check-clicks.mjs <url>              # needs playwright
```

- **`check-sim.mjs`** asserts the population still supports the statistics: cell
  fraction, knee separation, both complexity tails populated, doublet score
  separation and recall, and same-seed reproducibility.
- **`check-text.mjs`** renders all six tiles at two sizes across 24 frames and
  asserts every drawn label lies inside its tile and no two overlap. Canvas
  text leaves no DOM, so `tracked()` logs each string to `window.__BP_TEXTLOG`
  when a checker creates that array. **The box is mapped through the current
  transform before logging** — the rotated y-axis titles are drawn at the
  origin of a rotated frame and would otherwise all report as off-canvas.
- **`check-clicks.mjs`** clicks every tile with a *real* mouse press and asserts
  the reader follows. Use `page.mouse.click`, never `dispatchEvent`: a
  synthetic event is not evidence about a real one. (`/data_structures` shipped
  a broken selection because of exactly that.)

## Performance

Six canvases × 14,000 dots is the budget. Three things keep it viable and all
three are load-bearing:

- an `IntersectionObserver` stops offscreen tiles drawing
- `batch()` quantises alpha and emits one path per bucket, ~40× cheaper than
  one `arc()+fill()` per dot
- tile 01 refills a reusable scratch array; tile 06's ghost layer is static and
  cached per tile size, and membership is a `Set` (it was `s4.includes(b)`,
  5.4M comparisons a frame)

One `requestAnimationFrame` drives the whole page. **Tiles must never start
their own** — six clocks drift apart and the sequence stops being a sequence.

## Please do not

- **Add an ambient-RNA tile.** Its absence is a claim: Parse barcodes inside
  the fixed cell and washes between rounds, so the soup is a droplet problem.
  Importing SoupX or CellBender here borrows a correction for a failure mode
  this chemistry does not have.
- **Give a modelled figure a real-looking label**, or drop the word "modelled"
  to tidy a line up.
- **Hardcode a threshold** because the computed one moved somewhere you did not
  like. If the computed one is wrong, the population model is wrong.
- **Reuse the medallion palette.** Bronze, silver and gold mean tiers.
