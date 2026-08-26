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
the next bucket (the WRITE). Both doglegs turn on the same corridor — `CORRIDOR`
in `ds-data.js`, currently `x = 38` — at different heights, so the channel
between the two stacks reads as one thing.

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

## The steel thread — say it once, in the headline

Every worked example on this page is **MiniFin 100k**: one 94,616-cell
zebrafish chemical-perturbation dataset, carried end to end as a single thin
slice through every tier. That is the whole idea of a steel thread — prove the
entire path on one small real thing before widening it to the datasets that
cost money. It is not a sample of the map; it *is* the map's example:

- every transform repo has exactly **one** dataset module, `minifin/`
- every command on the page (`fetch`, `process convert`, `process build`,
  `process all`, `publish`) is a MiniFin command
- the release that does not exist is `minifin/v1/`
- the notebook that has not landed is `notebooks/minifin/01_eda.ipynb`

The MegaFin deliveries in bronze are drawn at true area because 92.2% of a
7 TiB bill is worth seeing. **They are not the thread**, and no repo on this
page reads them.

It is stated in **two** places: the **headline**, in one line of at most forty
words, and the **reader's default entry**, at length. There used to be a third —
a four-sentence band of its own between the header and the map — and it was the
largest single thing on the page before the drawing. It existed because an
earlier version was an overlay that sat on the bronze vault, and a band in the
page flow cannot collide with the drawing. But "cannot collide" is a low bar for
a paragraph of framing above every visit.

The headline line **ellipses rather than wraps**. The header is a single row and
a headline that reflows to three lines is a band again by another name. Keep it
under forty words and let the reader carry the rest.

Nodes on the thread carry `thread:true`, which flags them in the reader. If you
add a station, decide which of the two it is and say so.

## Naming

The tiers are **bronze**, **silver** and **gold**. The buckets carry nickname
suffixes for historical reasons — `fortknox`, `warehouse`, `library` — and those
appear *only* inside a real identifier: the `s3://` URI in a bucket's subtitle,
a transcribed CLI command, or the literal value of a `zsb_medallion` constant.
Never as the name of a tier, in the map or in the reader. If you find yourself
typing "the warehouse", write "silver".

## No text may overlap other text — and no text may overflow a box

`check-overlaps.mjs` (beside these files, run with `node check-overlaps.mjs <url>`)
renders the page, forces every label tier
visible (fine labels are `display:none` at overview zoom and would otherwise
measure 0×0 and be skipped), and tests every text box pairwise. It must
report **0 overlapping pairs**. The count moves as the map does — it is 87 at
the third pass — so read the count as a sanity check that the run saw the whole
map, not as a number to hold constant. `getBBox()` is in untransformed user space, so
one run covers every zoom level.

Run it after any change to a shape's internal label spacing. The last round of
failures were all sub-2px: stacked lines inside a treemap tile sitting 0.30
grid units apart, which is exactly a 9px box's height.

### `check-fit.mjs` — because text-on-text is only half of it

`check-overlaps.mjs` reported **0 overlapping pairs** while the bay's contents
hung off both its edges, a conduit caption lay across the silver treemap, and a
cell's note filled 91% of its box. None of those is a text-on-text collision.
Two strings can miss each other perfectly and still both be in the wrong place,
because the thing they are colliding with is a **rectangle**.

```bash
node check-fit.mjs <url>
```

Four assertions, all in grid units, so one run covers every zoom:

| | |
|---|---|
| **containment** | a string inside a node's box stays inside it |
| **trespass** | a string does not lie across a box it is not centred in |
| **zone** | a string is wholly inside a dotted enclosure or wholly outside it |
| **crowding** | a string uses at most **80%** of its box's width |

**The boxes nest** — a cell inside a repo floor, a tile inside a vault — so the
host is the **smallest** box containing the string's centre, and everything
containing that centre is exempt from trespass. Taking the first match instead
made every cell's own caption trespass on itself, which is the sort of finding
that gets a check switched off.

**Crowding is a house style, not a collision.** A caption at 91% touches both
walls and reads as a mistake beside neighbours sitting at 55%. If a string will
not come under the cap, the honest fixes in order are: **cut a figure that
already appears within a few grid units** — the silver fetch caption carried a
size printed twice more in the same corridor — then widen the box, then widen
the corridor. Truncating the words is last.

### The corridor is a place, and it has a width

The gap between the two zones was 18 grid units and is now **23**. It is not
empty space: every conduit caption lives in it, and a vertical run's caption is
anchored `end` at the corridor line, so it runs **leftward, toward the S3
zone** — which is why the silver fetch caption ended up lying on the silver
vault's treemap. If you add a conduit with a caption, check what is to the left
of `CORRIDOR` at that height before you write the words.

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

**The finding the map was built around, for its first two reads**: `zsb-bronze`'s
committed changelog described a `v1` silver release dated 2026-08-22, and the
warehouse had no `minifin/v1/` prefix. Of the four hops the architecture
describes, one had run. **That is no longer true — see the third pass.**

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

## The state of the data — third pass, 2026-08-24. The left column moved.

The first two reads found the buckets byte-for-byte identical and every moving
figure in the repo column. **This one is the other way round**, because a step
on the right finally ran.

```
repos      re-pulled at
             zsb-medallion 00b71e8   zsb-bronze 6126161
             zsb-silver    4a64566   zsb-gold   513ca22
buckets     aws s3 ls --recursive --summarize   on bronze and silver
            aws s3api head-object               on all 8 bronze pins + the new release
```

**`minifin/v1/` exists.** On 2026-08-23 at 00:21:59 UTC the bronze publish step
wrote a 1,561,917,184-byte artifact into the warehouse; its README at 00:22:28,
and the ledger at the same moment — **objects first, ledger after**, which is
the order that was wrong the last two times this page was read. The sharpest
finding this map has ever carried is closed, and it closed by the release being
published rather than by the note being retracted.

| Was on the map | Now |
| --- | --- |
| "the changelog indexes a release that does not exist" | it exists. **Claim retired.** |
| silver `79 obj · 15.45 GiB`, 0 versioned releases | `82 obj · 16.91 GiB`, one release under the convention |
| one hop of four has run | **two** |
| bronze `139 commits · 4,358 LOC` | `153 · 4,996` (2,680 in `minifin/`) |
| silver `25 commits · 155 LOC`, three stubs | `34 · 870`, **fetch is written** and pinned to the release by size and ETag |
| gold `20 commits · 92 LOC` | `30 · 93` — ten commits, one line of source |
| medallion `v0.5.0 · 58 · 1,843` | `v0.8.0 · 83 · 2,656`, and it grew a shared `fetch` |
| bronze on `v0.5.0`, silver and gold on `v0.4.0` | **all three on `v0.8.0`.** Divergence closed. |
| entry point `zsb-minifin <command>` | `zsb-bronze minifin <command>` — one command per repo, datasets as subcommand groups. Silver adopted the same shape. |
| — | **New:** both working repos have a `pins` command — check declared objects against the live bucket, exit non-zero on drift. |
| — | **New:** `bump-consumers.yml` in medallion opens a PR against each consumer on a version tag. That is what closed the divergence. |

**Two shape changes came out of this read**, and both are in `ds-shapes.js`:

- **`DRAW.bay` gained a `filled` state.** The bay for `minifin/v1/` had been
  drawn empty and hatched since this page existed. Keep both states — the next
  release prefix starts empty too, and a map that can only draw good news is
  not a plan.
- **`DRAW.cell` gained a third state, `ready`.** For as long as this map had
  two, "written" and "has run" were the same mark, because every step that was
  written had run. zsb-silver's fetch broke that: a real implementation, pinned
  to a real object, with nothing in the account able to say whether anybody has
  run it — a fetch lands on a machine. Drawing it live would claim bytes moved;
  drawing it as a stub would claim a function that raises. **Plate dashed means
  it raises; lamp filled means it has moved bytes.** A ready cell is a solid box
  with a hollow lamp.

**One standing unknown is partly answered, and by a route around the closed
door.** Every `GetBucket*` call is still AccessDenied — but `head-object` on any
key in bronze or silver returns a `VersionId` and `ServerSideEncryption:
AES256`. Both buckets are **versioned and encrypted at rest**, which this page
had recorded as unknown since it was drawn. Replication is still unconfirmed: no
object carries a `ReplicationStatus` header, which is suggestive rather than
decisive, since that header only appears where a rule covers the object.
**Generalise the move, not the finding** — when a bucket-level door is shut,
look at what the object responses already carry.

**What is left is two gates, both in the last two steps**, and neither is a
research problem: the gold v1 QC sign-off, and the gold object-key convention.
For the first time there is work aimed at the sign-off rather than around it —
zsb-silver's open PR **#17**, porting Trailmaker QC steps 3 and 4. And the
second now has a worked example one tier up: the silver key was answered by
naming the object and pinning its identity, which is stronger than a convention.

**Watch the rail.** `zsb_medallion` stopped being a vocabulary and became a
library: the shared `fetch` is real code both working transforms depend on, so
a change there can break a transform in a way that renaming a constant never
could.


## The state of the data — fourth pass, 2026-08-26. Nothing moved.

```
repos      re-checked at (all four already at their upstream tips, nothing to pull)
             zsb-medallion 00b71e8   zsb-bronze 6126161
             zsb-silver    4a64566   zsb-gold   513ca22
buckets     aws s3 ls --recursive --summarize   on bronze and silver
            aws s3api head-object               on all 8 bronze pins + the v1 release
```

**Both sides came back identical.** Bronze 1,258 / 7,730,616,859,647 B and
silver 82 / 18,154,728,187 B to the byte, the same three prefixes at the same
counts and sizes (`zebrahub/` 12 / 10.36 GiB, `megafin-1/` 61 / 5.00 GiB,
`minifin/` 9 / 1.55 GiB), gold still refusing both `ListBucket` and
`HeadBucket`. All eight bronze pins matched on size and multipart etag for the
**fourth read running**, every one still returning a `VersionId` and
`ServerSideEncryption: AES256`; so did `minifin/v1/minifin.h5ad`
(1,561,917,184 B, `9ce4a7f9…-187`, written 2026-08-23 00:21:59 UTC). Two days,
four repos, zero commits merged. **No figure on this page changed.**

Two pieces of **prose** did, and both were the same kind of error — a claim
that outlived the read it was made in.

| Was on the map | Now |
| --- | --- |
| Silver's `cond` opened *"one of the three tiles is now a real release"* and closed, four sentences later, with the second pass's *"not one object in this tier follows the convention … silver is full of things, and empty of releases"* | The tail is rewritten. The old sentence is **named and half-retired** rather than deleted — it is still full of things. |
| zsb-silver *"carries the only open pull request in the set"* | It carries **both**: #17 is still open and **#18** (docs) opened 2026-08-24 22:26 UTC, after the third read. The other three repos have none. |

**The lesson is worth more than either fix. When a finding is retired, grep the
panel for its other half.** A rewrite starts at the top of a paragraph and stops
when the new fact has been stated, so the closing line is exactly where the
superseded claim survives — and a panel that contradicts itself in four
sentences is worse than one that is merely out of date, because a reader cannot
tell which half to trust. The third pass retired that claim in the `brief` and
in the headline and left it standing in the `cond`. Both shipped for two days.

**And the quiet read is the one to keep doing.** Three of the four passes on
this page found something; this one found nothing on either side and was still
worth the hour, because *nothing moved* is a fact about a project and because
the two errors it did turn up were only findable by re-reading panels nobody had
a reason to open. The pins are now a `pins` command in two repos — ask the
machine — but the prose has no such check, and `check-fit.mjs` cannot read.


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

## The reader panel — and its hundred-word cap

Click a box and its entry renders in the right-hand column. An entry is:

```
eyebrow (group)  ·  title  ·  sub
[on the steel thread]  [not confirmable from here]
n.brief          <- ONE paragraph, AT MOST 100 WORDS
SNIPPETS[n.id]   <- a real transcript, where one exists
n.kv             <- the figures
```

**The cap is the feature, not a limitation.** The first version of this panel
rendered `does` / `built` / `cond` per station — three long sections, nine
hundred-odd words — which was an excellent record and a bad panel, and it is
why the column got deleted for a while. Nobody reads nine hundred words to
find out what a box is. If a brief will not fit in a hundred words, the box is
doing too much, or the sentence is.

`does` / `built` / `cond` **are still in `ds-data.js` and are deliberately not
rendered.** They are where every figure in the brief came from, and the next
person to re-read the buckets will need them. Do not delete them, and do not
render them either. There is a word-count check worth re-running after edits:

```bash
node -e 'const s=require("fs").readFileSync("ds-data.js","utf8");(0,eval)(s+`
  const wc=x=>String(x).replace(/<[^>]+>/g,"").trim().split(/\s+/).length;
  NODES.forEach(n=>{const w=wc(n.brief); if(w>100)console.log("OVER",n.id,w)});
  ["brief","how","state"].forEach(k=>{const w=wc(OVERVIEW[k]);
    if(w>100)console.log("OVER OVERVIEW."+k,w)});`)'
```

`OVERVIEW` renders three fields under the same cap — `brief` (the steel
thread), `how` (how to read the map) and `state` (where it stands) — and is
what you see with nothing selected.

Selection marks the station and fills the reader. It does **not** move the
camera. There used to be a fly-to; it earned its keep when a station was
unreadable until you were on top of it, and at the current type scale it only
took the rest of the map away from you.

## Clicking a station — and the pointer-capture trap

`check-clicks.mjs` (beside these files, `node check-clicks.mjs <url>`) clicks
every station with a **real** mouse press and asserts the reader shows that
station, that a background click clears to the overview, and that a pan does
not count as a click. It must report no failures.

**Read this before touching the pan handlers.** Selection broke once and
shipped. The `<svg>` was calling `setPointerCapture()` on `pointerdown`, and
pointer capture *retargets the compatibility `click` event to the capturing
element*. So a click on a station was delivered to the `<svg>`, not to the
station's `<g>`: the station's handler never ran, its `stopPropagation()` never
happened, and the background handler fired instead and cleared the selection.
Every click on the map read as a click on nothing.

The fix is that capture is taken **lazily** — not on `pointerdown`, but on the
first `pointermove` past `PAN_SLOP` (3px). Capture is only needed once a drag
is genuinely underway, to keep the pan alive when the cursor leaves the canvas;
a click never travels far enough to take it, so a click reaches the shape it
landed on. Do not move `setPointerCapture` back to `pointerdown`.

The reason it shipped is worth keeping too: the test that was meant to cover it
dispatched `new MouseEvent('click')` straight at the `<g>`. That path always
works and proves nothing about the real one. **A synthetic event is not
evidence about a real one** — `check-clicks.mjs` uses `page.mouse.click` only.

Note also that stations **nest**: cells sit inside a repo floor, so a floor's
centre legitimately belongs to a cell. The check picks each hit point with
`elementFromPoint` rather than assuming the centre is clickable.

## The column borders

Both grips do two jobs, separated by whether the pointer travelled more than
`MOVED` (4px):

| gesture | result |
| --- | --- |
| drag | resize that column live, 0–640px |
| click | collapse it all the way to the edge |
| click again | restore it at the width it had before |
| drag to the wall | collapse, same as a click |

A collapsed column leaves the grip behind — a 16px sliver with an arrow
pointing the way back — rather than nothing, because a panel that collapses to
a truly invisible edge is a panel nobody finds again. `wOpen` remembers the
pre-collapse width so restoring does not snap back to the default.

Resizing calls `refresh()`, which re-fits **only when nothing is selected**: if
somebody is reading a station, moving the map out from under them to gain forty
pixels is not a favour.

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
  means bytes have crossed, and can be shown to have. **A second hop went solid
  on 2026-08-23, and it went solid because `head-object` returned an object** —
  not because a commit said it would. The next one is the same standard.
- **Draw a written step as live.** `state:"ready"` exists for the case that
  broke the two-state scheme: implemented, pinned to a real object, and with
  nothing in the account able to show whether anybody has run it. A fetch lands
  on a machine, and a machine is not in the account. Solid box, hollow lamp.

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
