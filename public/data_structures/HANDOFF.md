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
| `ds-data.js` | **on-instance** | ZONES, NODES, EDGES, CARRIES, SNIPPETS, OVERVIEW. Every fact, number, key and payload. |
| `ds-shapes.js` | rendering side | One draw function per shape, plus TIER and the title bar. |
| `ds-plan.js` | rendering side | Projection, plate/label, squarify, routing, ticker registry, byte formatting. |
| `ds-view.js` | shared | Grid, zones, conduits, dots, camera, label tiers, index. |
| `index.html` | shared | Markup and the CSS variables that define both themes. |

## The layout

Two enclosures, three columns, read top to bottom.

```
  ┌╌╌ AWS S3 ╌╌╌╌╌╌╌┐        ┌╌╌ GitHub ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
  ╎                 ╎        ╎                               ╎
  ╎  ┌──────────┐   ╎        ╎                               ╎
  ╎  │  BRONZE  │───╎──read──╎──▶┌────────────┐              ╎
  ╎  └──────────┘   ╎        ╎   │ zsb-bronze │◀── imports ─┐╎
  ╎                 ╎   ┌────╎───└────────────┘             │╎
  ╎              [empty bay] ╎                              │╎
  ╎  ┌──────────┐   ╎   │    ╎                        ┌───────────┐
  ╎  │  SILVER  │◀──╎───┘    ╎                        │    zsb-   │
  ╎  └──────────┘───╎──read──╎──▶┌────────────┐◀──────│ medallion │
  ╎                 ╎   ┌────╎───└ zsb-silver ┘       │           │
  ╎  ┌──────────┐   ╎   │    ╎                        └───────────┘
  ╎  │   GOLD   │◀──╎───┘    ╎                              │╎
  ╎  └──────────┘───╎──read──╎──▶┌────────────┐◀── imports ─┘╎
  ╎                 ╎        ╎   │  zsb-gold  │               ╎
  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘        ╎   └────────────┘               ╎
                             └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
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
column and taps left into each repo. Each tap carries the contract version that
repo actually pins — see the second-pass notes below; they are not all the same.

## Zones

Two translucent dotted enclosures, drawn behind everything in `gZone`, the
first layer of `gContent`. Left is the S3 account; right is the GitHub org.

This is the distinction the map most needed and longest went without. Every
station looked like the same kind of object, when in fact half of them are
buckets somebody pays for by the terabyte-month and half are source trees.
The conduits crossing the gap between the two boxes are, literally, the only
places this architecture moves anything between the two systems.

The GitHub zone takes in the contract rail as well as the transform column,
because `zsb-medallion` is a repository like the other three and only sits
apart because it is not a hop. The empty bay falls in the gap between the two
boxes, which is apt: it is a missing S3 prefix, so it is in neither.

Keep them faint. They are a ground, not a frame — noticed second, after the
stations and before the wiring.

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

## The state of the data — second pass, 2026-08-22 (later the same day)

The four repos were re-pulled after a run of work from Darien and the whole map
re-read against them.

```
repos      re-pulled at
             zsb-medallion 2d165be   zsb-bronze 0414ac4
             zsb-silver    b4253a2   zsb-gold   59dabde
```

**The buckets came back byte-for-byte identical.** Bronze 1,258 objects /
7,730,616,859,647 B, silver 79 / 16,592,799,338 B with the same three prefixes at
the same sizes, gold still refusing both `ListBucket` and `HeadBucket`, and still
no `minifin/v1/`. The entire left column of the map, and its central argument,
stands as drawn. Every figure that moved is in the repo column — so when you
refresh this page, re-read both sides but expect the movement on the right.

What changed, and what it cost the map:

| Was on the map | Now |
| --- | --- |
| "There is no CI that runs the tests" | All four repos have `ci.yml` running `make verify` on push + PR to main. The private `zsb-medallion` dependency — the recorded blocker — installs through a per-run GitHub App token. **Claim retired.** |
| "AGENTS.md still says branch off `zsb-minifin`" | Fixed; it says `main`. **Claim retired.** |
| "console has no consumers" | `zsb-bronze` bumped to `v0.5.0` and imports it in the CLI, fetch and publish. **Claim retired.** |
| `115 commits · 3,880 LOC` | `139 commits · 4,358 LOC` (2,511 in `minifin/`) |
| cells `convert` / `build` | `process convert` / `process build` — the CLI grew a `process` group, plus a `process all` |
| — | **New:** the three transforms no longer share one contract version. Bronze pins `v0.5.0`, silver and gold still pin `v0.4.0`. |

That last one is the only new *shape* on the page. `DRAW.spine`'s `n.taps` used to
be a list of y positions; a tap is now `{y, pin}` and renders the pinned version
under the word `imports`, stroked in `--drop` when the pin is behind the rail's own
version (`n.right`). Plain numbers still work. It is drawn rather than written up
because "three consumers of one contract are on two versions of it" is a fact
about the wiring, and belongs on the wiring.

Note also that `zsb-silver` took twelve commits and `zsb-gold` six, and **between
them they did not change one line of any transform** — all CI, Makefiles,
lockfiles and `.gitignore`s. Both now have an excellent gate around three
functions that raise. Worth keeping an eye on across refreshes: the tooling is
moving and the three gates are not, which is what you would expect, because the
gates are conventions and sign-offs and no amount of tooling closes them.

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

## Type, and the one number that scales it

`TYPE` in `ds-plan.js` multiplies every font size on the canvas. Sizes are
still authored in the readable 8–10.5 range so a shape's code says what it
means; `label()` multiplies at the point of use. It is currently **3**.

Everything that has to move when type moves is expressed against it:

| | |
|---|---|
| `FINE_PX` | the fine-tier cutoff, `9.5 * TYPE` |
| `textW(str, size)` | rough advance width in final pixels |
| `lineH(size)` | line pitch in grid units, `size * TYPE * 1.45 / S` |
| `BAR_H` | title-bar height, sized for `10.5 * TYPE` |

**Do not hard-code a line offset in grid units.** Every stack of labels on the
map is laid out from `lineH()`. The leading factor is 1.45 rather than 1.2
because at 1.2 a text box is exactly its own height and stacked lines sit
flush — which is what the overlap checker caught last time.

Changing `TYPE` will need station heights re-checked: a title bar plus N cells
plus a command rail has to fit inside a floor, and a treemap tile has to seat
its caption. Run `check-overlaps.mjs` afterwards, and look at it.

## Fit or lead

A treemap tile captions itself in place only if it can seat **the key and the
size figure**, with the key shrunk to fit the tile's width down to a floor of
`7.6`. Otherwise the tile gets a **leader**: a dot on the feature, an elbow
down and across, and the caption in open space below the enclosure.

This is the textbook move, and it is here because the honest thing and the
readable thing pull apart at the small end. Silver's `minifin/` is 0.59% of
its bucket — at true area, a strip a couple of pixels thick, and the single
most important object set in that bucket. The two obvious alternatives are
both lies: shrink the caption until it fits, or give the tile a minimum area.
A leader keeps the area true and the caption readable.

The bar is key *and* size deliberately. A tile captioned `minifin/` with no
figure is the worst of both — it spends the space of a label and answers none
of the question a treemap exists to answer.

## Tier colour

A transform wears the colour of the tier it reads, end to end: floor wall,
title bar and every cell inside it. `zsb-bronze` is bronze, `zsb-silver` is
silver, `zsb-gold` is gold. That matches the repos' own naming rule — each is
named for the tier it reads — and it means the eye pairs a bucket with its
transform across the corridor without following the line.

`zsb-medallion` keeps the code blue. It is the one thing in that column that
is not a hop.

## Conduits: quiet track, loud dots

A conduit is a **track**, not a highlight: 1.1–1.5px, half opacity. The dots
travelling it carry the signal colour at `r: 9` with a background-coloured
halo, so they read as moving *on* the rail rather than as beads threaded
through it.

The live rail used to be a heavy blue rule with small dots, which made the one
hop that works the loudest thing on the map and left the part that actually
says "bytes moved" smaller than the line it moved along.

**Dots run on every conduit, cold ones included.** They are the only mark that
shows direction — the arrowheads are small and sit only at the landing end —
and a map where half the arrows are static reads as half broken rather than
half unbuilt. What separates the two states is the rail underneath:

| | |
|---|---|
| solid grey | has carried bytes |
| dashed drop | written, never run |
| moving dot | direction of flow, on both |

Keep the legend honest about this. It claimed the live rail was blue for a
while after the rail stopped being blue.

`WIRE` keeps `ink` separate from `stroke` so a caption stays readable when its
rail deliberately is not.

## No reader panel

There was a right-hand prose column: eyebrow, title, what-it-is / what-is-
there / condition, a payload transcript and a key-value table per station. It
was removed once the type tripled and the map became legible on its own.

**The prose is still in `ds-data.js`** — `does`, `built`, `cond`, `kv`,
`SNIPPETS` and `OVERVIEW` are all intact and still the on-instance record of
what this map asserts. Nothing renders them today. Bringing the panel back is
a markup-and-CSS job plus an `inspect()` function; the facts are waiting.

Selection is therefore just a mark: the halo on the station and the highlight
on its index row. It does not move the camera. **There used to be a fly-to** —
it earned its keep when a station was unreadable until you were on top of it,
and at the current scale it only took the rest of the map away from you.

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
- **Re-add a command rail along the bottom of a floor.** There was one, listing
  `fetch / convert / build / publish` — the same four words as the four cells
  stacked directly above it. The cells are the ones carrying the figures, so
  the rail was the copy that went.
- **Re-add the fly-to on select.** See above: at this type size it removes more
  than it reveals.
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
  collapses into the horizontal strip along the bottom.
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
