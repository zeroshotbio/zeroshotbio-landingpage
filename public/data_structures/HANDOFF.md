# zeroshot.bio/data_structures — file split and working contract

The plan-view companion to [`/pipeline`](../pipeline/HANDOFF.md). Same four-file
split, same ownership boundary, same rules. If you have worked on `/pipeline`
you already know how to work on this.

## What it is, and how it differs from /pipeline

| | `/pipeline` | `/data_structures` |
|---|---|---|
| Projection | isometric, 2:1 dimetric | **orthographic top-down** |
| Subject | the platonic process, in general | **one system, on one day** |
| Source of truth | the dataset corpus on the instance | **the live S3 buckets + the four zsb-\* repos** |
| Unit | a cell, a read, a gene | **a byte, an object, a commit** |
| Reading direction | left to right, snaking | **top to bottom, three columns** |

The two are meant to be read together and share a palette, a shell, and the
index/reader/strip interaction. They deliberately do not share code: the
projection is the root of everything in both, and they have opposite ones.

## Where it lives and how it is served

`public/data_structures/` in `zeroshotbio-landingpage`, served at
`https://www.zeroshot.bio/data_structures` by a rewrite in `next.config.js`:

```js
{ source: '/data_structures', destination: '/data_structures/index.html' }
```

Script `src` attributes are **absolute** (`/data_structures/ds-plan.js`), for
exactly the reason `/pipeline`'s are: the route has no trailing slash, so a
relative path resolves against `/` and 404s. The same no-cache headers are set
on the route and its assets, for the same reason — the HTML names the elements
the scripts reach for, and a browser running today's scripts against last
week's HTML does not degrade, it stops.

## Load order matters

```html
<script src="/data_structures/ds-plan.js"></script>    <!-- primitives   -->
<script src="/data_structures/ds-shapes.js"></script>  <!-- vocabulary   -->
<script src="/data_structures/ds-data.js"></script>    <!-- the facts    -->
<script src="/data_structures/ds-view.js"></script>    <!-- assembly     -->
```

Plain classic scripts. No modules, no build step, no dependencies, no CDN, no
fonts. Top-level `const` in one file is visible to later files.

## Who owns what

| File | Owner | What it is |
|---|---|---|
| `ds-data.js` | **on-instance** | COLUMNS, NODES, EDGES, CARRIES, SNIPPETS, OVERVIEW. Every fact, number, key and payload. |
| `ds-shapes.js` | rendering side | One draw function per shape, plus TIER and the title bar. |
| `ds-plan.js` | rendering side | Projection, plate/label, squarify, routing, ticker registry, byte formatting. |
| `ds-view.js` | shared | Grid, column headers, conduits, dots, camera, label tiers, reader, index. |
| `index.html` | shared | Markup and the CSS variables that define both themes. |

## The layout

Three columns, read top to bottom.

```
   THE BUCKETS          THE TRANSFORMS        CONTRACT
   x = 13               x = 46                x = 64

   ┌──────────┐
   │  BRONZE  │──read──┐
   └──────────┘        └──▶┌────────────┐
                            │ zsb-bronze │◀── imports ──┐
                       ┌────└────────────┘              │
                    [empty bay]                         │
   ┌──────────┐        │                                │
   │  SILVER  │◀───────┘                          ┌───────────┐
   └──────────┘──read──┐                          │    zsb-   │
                       └──▶┌────────────┐◀────────│ medallion │
                       ┌───└ zsb-silver ┘         │           │
   ┌──────────┐        │                          └───────────┘
   │   GOLD   │◀───────┘                                │
   └──────────┘──read──┐                                │
                       └──▶┌────────────┐◀── imports ───┘
                           │  zsb-gold  │
                           └────────────┘
```

Each hop is **two conduits**: out of a bucket's right wall, right and down into
the repo (the READ), then back out of the repo's left wall, left and down into
the next bucket (the WRITE). Both doglegs turn on the same corridor at `x = 30`
at different heights, so the channel between the two stacks reads as one thing.

A repo therefore always sits in the *vertical gap between the two buckets it
bridges* — beside the seam it works on, never beside a tier. That is the whole
reason the middle column is offset half a station down from the left one.

`zsb-medallion` is a rail rather than a station, because it is not a stage: it
touches no bucket and moves no bytes. It runs the full height of the transform
column and taps left into each repo.

## Naming

The tiers are **bronze**, **silver** and **gold**. The buckets carry nickname
suffixes for historical reasons — `fortknox`, `warehouse`, `library` — and those
appear *only* inside a real identifier: the `s3://` URI in a bucket's subtitle,
a transcribed CLI command, or the literal value of a `zsb_medallion` constant.
Never as the name of a tier, in the map or in the reader. If you find yourself
typing "the warehouse", write "silver".

## No text may overlap other text

`check-overlaps.mjs` (beside these files, run with `node check-overlaps.mjs <url>`)
renders the page, forces every label tier
visible (fine labels are `display:none` at overview zoom and would otherwise
measure 0×0 and be skipped), and tests all 93 text boxes pairwise. It must
report **0 overlapping pairs**. `getBBox()` is in untransformed user space, so
one run covers every zoom level.

Run it after any change to a shape's internal label spacing. The last round of
failures were all sub-2px: stacked lines inside a treemap tile sitting 0.30
grid units apart, which is exactly a 9px box's height.

## The state of the data — first pass, 2026-08-22

Written from a live read, not from the READMEs. Sources:

```
buckets    aws s3 ls --recursive --summarize   on all four medallion buckets
           aws s3api head-object               on each of the 8 manifest pins
repos      fresh clones at
             zsb-medallion 871346f   zsb-bronze 82c5b75
             zsb-silver    b88dfa2   zsb-gold   b80b2bc
```

The eight manifest pins were each re-checked against the bronze bucket. All eight
matched size and etag, multipart etags included. That check is worth re-running
whenever this page is refreshed — it is the one claim on the map that can go
stale silently.

Two things are on the map's edge and deliberately off it: the **zsb-sandbox**
bucket (706 objects, 64.6 GiB, mostly three STARsolo alignment arms), which has
no conduits in either direction by definition and so is not a station; and the
pipeline that preceded these repos, whose output is what silver's `minifin/`
tile actually holds — described in that tile's own notes rather than drawn as a
second lane. Both were stations in the first version and both cost more than
they explained.

**Three things are marked unknown rather than guessed**, and should stay that
way until somebody widens the role:

1. The gold bucket's contents. `ListBucket` is AccessDenied and `HeadBucket`
   returns 403 to `ec2-s3-work-role`. The map says *contents unknown*, never
   *empty* — they call for different next actions.
2. Bucket-level configuration on all four buckets. Every `GetBucket*` call is
   AccessDenied, so `zsb-medallion`'s README claim that bronze is versioned and
   cross-region replicated is repeated as a claim and is not confirmed.
3. Which of `minifin/raw/fastq/` and `minifin/raw-fastq/` is the orphan. They
   are the same 17 objects twice, 209 GiB duplicated; the archived provenance
   record points at the former, which is suggestive and not decisive.

**The finding the map is built around**: `zsb-bronze`'s committed changelog
describes a `v1` silver release dated 2026-08-22, and the warehouse has no
`minifin/v1/` prefix. Of the four hops the architecture describes, one has run.

## The shape contract

```js
DRAW.myShape = (g, n) => { /* append SVG to g */ };
```

- reads only `n.x n.y n.w n.h` plus its own custom fields. There is **no `n.d`**
  and no elevation: `h` is the footprint's second dimension, not a height.
- knows nothing about neighbours, the rows, or the map
- colours are **always** `var(--token)`, never a hex literal, or light mode breaks
- anything that moves pushes to `TICKERS`; never `setInterval`
- a node opts in with `shape:"myShape"`

Because the projection is orthographic, shapes **nest** — a vault holds tiles, a
floor holds separately-addressable cell nodes. On the isometric map that would
need a depth sort. Here there is no depth to sort, which is most of why this
file is a third the size of `pipeline-shapes.js`.

## Label tiers

The map is about 73 grid units wide, so fit-to-stage sits near `z = 0.47`, at
which a 9px label is 4px. Anything under **9.5px** is tagged `.fine` at build
time by `ds-view.js` and hidden below `FINE_Z`. Decoration that only exists to
frame a fine label — the bus export chips, the repo command rails — carries the
class explicitly, so an empty frame never survives its own caption.

If you add a label that must persist at overview zoom, give it a font size of
9.5 or greater. That is the whole opt-out.

## Please do not

- **Replace the top-down projection with the isometric one, or with a library.**
  `P(x,y) => [x*S, y*S]` is the argument of the page. Everything — the treemap,
  the orthogonal routing, the nesting, the fact that the manifest can be drawn
  as an ordered list — falls out of it.
- **Give a treemap tile a minimum area.** The warehouse's `minifin/` is 0.59% of
  its bucket and is a two-pixel hairline at true area. That is the finding, not
  a rendering bug. It is handled with a forced callout in the drop colour; a
  floor on tile area would lie about the size *and* bury the meaning.
- **Turn the columns back into rows.** This was a horizontal flow twice — one
  straight line, then folded into two rows — and both read as a process diagram
  rather than as a structure. The tiers are a stack; drawing them as a stack is
  what makes "bronze, then silver, then gold" a thing you see instead of a thing
  you follow.
- **Put a station name outside its own box.** Every station carries its name in
  its title bar. The external name plates this map used to have were a second
  copy of a string already on screen, and they were the only thing on the canvas
  not bounded by a box — which is exactly why "Fort Knox" ended up sitting on
  the register rule behind it. If a label needs to exist, give it a box that
  owns it.
- **Reformat, minify, or convert to a framework.** Line-level diffs need to stay
  readable across two authors.
- **Let a dashed conduit become solid without a bucket read behind it.** Solid
  means bytes have crossed, and can be shown to have. There is currently exactly
  one solid conduit on this map. When a second appears it should be because a
  second hop ran.

## Notes for integration

- Everything is inside `.app`, full-height via `100dvh`. Under 900px the index
  collapses into the strip and the reader moves below the canvas.
- Dark is default; `document.body.classList.add("light")` flips the whole SVG,
  because every colour is a CSS variable.
- `prefers-reduced-motion` pauses the dots on load and makes the camera cut
  rather than glide.
- No storage, no network, no analytics. Safe to iframe.
- **No edit modes.** `/pipeline` has Edit positions / Edit text / Edit visual
  wired to `/api/pipeline_edits` and `/api/pipeline_prompts`, backed by a fixed
  DynamoDB item id and the on-instance queue daemon. None of that is wired here.
  Adding it needs a second `ITEM_ID`, a second daemon route, and a decision about
  whether the two maps share a queue.
