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
- the releases that exist are `minifin/v1/`, `v2/` and `v3/` — the same
  barcodes called three ways, published side by side, none superseding another
- the notebook that has not landed is `notebooks/minifin/01_eda.ipynb`

That third bullet read *"the release that does not exist is `minifin/v1/`"* until
the fifth pass. It was written for the first pass, when that was the map's whole
argument, and it survived the release landing on 2026-08-23 and two full re-reads
afterwards — in this file, three lines above a heading that says to state the
thread in two places. Prose in the handoff goes stale the same way prose in a
panel does, and nothing checks it.

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

**Two things are marked unknown rather than guessed**, and should stay that
way until somebody widens the role:

1. The gold bucket's contents. `ListBucket` is AccessDenied and `HeadBucket`
   returns 403 to `ec2-s3-work-role`. The map says *contents unknown*, never
   *empty* — they call for different next actions.
2. Bucket-level configuration on all four buckets. Every `GetBucket*` call is
   AccessDenied, so `zsb-medallion`'s README claim that bronze is versioned and
   cross-region replicated is repeated as a claim and is not confirmed.

**A third was resolved on 2026-08-29** — which of `minifin/raw/fastq/` and
`minifin/raw-fastq/` was the orphan. It was not resolved by widening the role or
by finding a decisive fact in the bucket, and the evidence available on this
instance pointed the wrong way: `raw/fastq/` was the original upload (2026-07-20,
against 08-07 for the other) and the prefix that `minifin_rebuild`'s `paths.yaml`
and ten stage manifests named, which reads as a live dependency. It is not one.
That tree has been retired — its working copy is marked stale, `STATUS.md`
records the MiniFin rebuild as CLOSED, and `pipelines/minifin_rebuild/` is not on
`zsb-bronze` main. Current `zsb-bronze` references neither FASTQ prefix. So the
manifests record what a past run used, `raw/fastq/` was purged, and
`minifin/raw-fastq/` is canonical.

**The rule that generalises**: a path reference is only a dependency if something
still runs. A map drawn from a bucket plus a source tree cannot tell a live pin
from a historical record — both are just a string in a file. Deciding which one
you are looking at means asking whether the tree is alive, which is a question
about the repo rather than about the object.

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


## The state of the data — 2026-09-11, later. Three human datasets arrive, straight to open source.

```
zsb-open-source  903 obj · 566.22 GiB   26 datasets + the _access_check/ probe (drawn: 902 · 566.22)
silver            79 obj ·  65.64 GiB   megafin/ · megafin-1/ · minifin/ — unchanged
```

**The three COMPASS sources landed in `zsb-open-source` without passing through silver**, each with a
custody README, uploaded by another session: `human/replogle/` (Figshare+ 20029387, 4 of its 12 files,
79.69 GiB), `human/nadig/` (GEO GSE264667, 13.95 GiB) and `human/xatlas-orion/` (annotation only — the
Hugging Face gene table and the Figshare guide library, 4 MiB; the 559 GB of cells are not held, and
the licence is CC BY-NC-SA). They join Tahoe in the **Human scRNA-seq** band.

**`gen_open_source_panel.py` gained two rules.** `NEW` gives a prefix the node has never drawn its band
and accent on first appearance only — after the splice the OPEN node is the palette, as before; a
prefix with no entry still draws, grey, in "Other". And any prefix starting with `_` is skipped: the
`_access_check/` write-probe is no longer filtered out of the listing by hand before each splice.

**Three rendered sentences that assumed 23 were rewritten:** BACQ's kv (`19 of 26`), its panel item
(now *seven with no module at all* — keller, zfap, tomoseq, tahoe and the three new ones, 77 objects,
419.1 GiB), and SILVER's closing section, in both `ds-data.js` and `gen_silver_panel.py`. OPEN's
`built` / `cond` still say 23; they are dated records and are not rendered.

Checks: `check-overlaps` 0 pairs (140 text nodes), `check-clicks` 18, `check-fit` the known 7.

## The open-source vault is 1.6x taller, and its bands say which organism — 2026-09-11

**OPEN is `h 30 → 48`**, centre `y 40.5 → 49.5`, so its top edge stays level with SILVER's at 25.5 and
its foot lands at 73.5, inside the lane (`y1 83.5`). Every band gets the extra height in proportion, so
each dataset tile has more room for its caption. Nothing else sits in the lane, so nothing moved.

**Two bands renamed, exactly as the user wrote them:** `scRNA-seq → ZEBRAFISH scRNA-Seq` and
`Human scRNA-seq → HUMAN scRNA-Seq`. The generator reads bands and accents from the OPEN node itself,
so the rename lives in the node's `groups` and survives every re-splice.

**Band captions are drawn as written.** `DRAW.vault` used to force every band caption to capitals
(`upper: true`), which turned `scRNA-Seq` into `SCRNA-SEQ`. It no longer does, and it measures the
caption at its real case for the fit-to-width scaling. The other four bands are stored in capitals
(`IMAGING / TRACKING`, `SPATIAL`, `ANATOMY`, `REFERENCE`) so they look as they did, and the panel
headings — which never uppercased — now match the map character for character. Column captions
(`PARSE (OUR DATA)`) still force capitals.

**No `~` after a floored band.** `DRAW.vault` still floors a small band's height at `FLOOR = 2.1`; it no
longer appends `" ~"` to the caption. The user asked for the category names alone.

**The reader panel mirrors the map.** `gen_open_source_panel.py`'s section headings are now the band
captions word for word (the `Acquired · ` prefix is gone — everything in this vault is acquired), in the
same order as the vault draws them: ZEBRAFISH scRNA-Seq, HUMAN scRNA-Seq, Imaging / tracking, Spatial,
Anatomy, Reference. Re-spliced from a live listing: 902 obj · 566.22 GiB, 26 datasets.

**Checks.** `check-overlaps` 0 pairs (139 text nodes). `check-clicks` 17/17. `check-fit` the same 7
pre-existing failures, none in OPEN. `check-pinch` 3.000x about a fixed midpoint, floor 0.600x fit,
0 of 139 hidden.

## The state of the data — 2026-09-11, later. The custody PRs closed, and nothing hides on zoom.

**Audit against the sources**, all read live today:

| source | live | page |
|---|---|---|
| `zsb-bronze-fortknox` | 136,246 obj · 9.56 TiB; megafin-1/ megafin-2/ minifin/ (+ reference/, 2 probe files) | matches |
| `zsb-silver-warehouse` | 79 obj · 65.64 GiB | matches |
| `zsb-open-source` | 26 datasets, 902 obj · 566.22 GiB (+ the `_access_check/` probe, not drawn) | matches, per dataset |
| zsb-bronze | 331 commits on main, **0 open PRs** | **was stale** — fixed below |
| zsb-silver / zsb-gold / zsb-medallion | 98 / 59 commits, v0.13.0, 0 open PRs each | matches |

**The GitHub column lost the `acquire` cell.** The 19 custody PRs (#103–#121) were closed unmerged
on 2026-09-11 and labelled `archived-custody` (branches kept), because open-source datasets now live in
`s3://zsb-open-source` with custody in each dataset's README. So:
- `BACQ` and its `BAND_PUBLIC` ("PUBLIC ORIGIN") band are gone, as is the `Public origins · the internet`
  group in `OVERVIEW.processes`.
- `BREPO`'s floor shrank by the band's height: `y 24.45 → 22.45`, `h 22.4 → 18.4` (top edge unmoved at
  13.25). Its two left-side conduit ports took `dy +2` (`-4.95 → -2.95`, `6 → 8`) so they land where
  they did — a port is the side midpoint plus `dy`.
- `BREPO`'s `sub`, `brief`, `built` and `kv` no longer claim open PRs, acquired modules or a dataset it
  "only vouches for"; SILVER's closing sentence says the branches closed.
- `gen_repo_panels.py` dropped chemfish from the zsb-bronze panel (2 datasets · 1 origin) and takes
  `PANEL_OUT` for its output dir. Note the repo reader panels it builds are **not embedded on this page**
  any more — the repo readers render `brief`/`kv` — so nothing was spliced.

**No label is hidden at any zoom.** The fine tier (text below `FINE_PX`) used to be switched off below
zoom 0.25 (`svg.coarse .fine{display:none}`). At an iPad-sized viewport the fit zoom is ~0.21 — already
under that line — so small labels were gone before the reader touched anything, and pinching out shrank
the rest toward nothing. The rule and `labelTier()` are removed; the `fine` class is still assigned. What
keeps text legible now is a **zoom floor**: `MIN_ZOOM_OF_FIT = 0.6` of the fit zoom (recorded by `fit()`
as `fitZ`), replacing the absolute `0.08`.

**Pinch and pan, rewritten for iPad.** One Pointer Events path with a `Map` of live pointers: one pans,
two pinch about the midpoint between the fingers (and pan with it), lifting one finger continues as a
pan. The old split had `pointermove` panning while `touchmove` zoomed, so during a pinch each finger
dragged the camera toward itself and the zoom scaled about the canvas corner. Also: camera writes are
coalesced to one `apply()` per animation frame (`schedule()`); the conduit dots hold still while a
gesture is moving (`gesturing`, cleared 160 ms after the last movement); `svg.moving` sets
`text-rendering`/`shape-rendering` to `optimizeSpeed` for the duration; Safari's
`gesturestart/change/end` are cancelled so the page itself never zooms. The lazy pointer-capture rule
that keeps clicks working is untouched, and a pinch never reads as a click.

**`check-pinch.mjs`** (new, beside the others; `node check-pinch.mjs <url>`) emulates a two-finger touch
in Chromium at 1180×820: a 3× finger spread zooms exactly 3.000× with the midpoint's model point fixed
(0.000 drift), a two-finger drag pans 100 px with no zoom, a heavy wheel zoom-out stops at 0.600× fit,
and 0 of 137 text nodes are hidden. Real-device feel still wants a check on an actual iPad.

**Checks.** `check-overlaps` 0 pairs (137 text nodes). `check-clicks` **17** stations (acquire gone).
`check-fit` the same 7 pre-existing failures. `check-pinch` as above. No page errors.

## The state of the data — 2026-09-11. Silver's copies are deleted; silver is ours again.

```
silver            79 obj ·  65.64 GiB   megafin/ · megafin-1/ · minifin/ — nothing else
zsb-open-source  879 obj · 472.57 GiB   all 23 acquired datasets — now the only copy
```

**A person deleted the 23 acquired prefixes from silver in the console.** Checked from the instance
afterwards against a listing taken just before: silver holds exactly the 79 objects of `megafin/` (5),
`megafin-1/` (61) and `minifin/` (13), every one unchanged in key, size and ETag; `zsb-open-source`
is unchanged at 879. Before the delete, all 819 shared non-README files matched across the two buckets
on size and ETag. The only files that exist nowhere now are 24 superseded silver READMEs (the
open-source ones replaced them) and `micdropseq/GSE315445/GSE315445_family.soft.txt`, our
decompression of a `.gz` the new bucket holds. zebrahub's 12 pre-convention files (10.36 GiB) were
copied to `zsb-open-source` first and verified against the instance's local copies, so the delete
lost no data file.

**SILVER is one column again.** The `Acquired (Open Source)` group and its 23 tiles are gone; the
`Parse (Our Data)` group stays, captioned. `right`, `built` and `cond` are rewritten.
`gen_silver_panel.py` lost its 23 hand-written acquired blocks (in git history, last in `fa9034e7`)
and ends with one pointer section, `Acquired (Open Source) · moved out`. It no longer indexes any key
outside ours, so it runs against the post-delete listing.

**`gen_open_source_panel.py` reads its palette from the OPEN node now**, not SILVER's tiles; those
tiles were the only place the accents and bands lived, and they went with the delete. Its `STRAY`
list lost zebrahub: `timepoints/` and `zebrahub_base.h5ad` are drawn with the `leg` class ("kept on
purpose"), because keeping them was a decision, not a filter bug. A `leg` row joined the legend.
chemfish's stray `2025_03_release/Paper/` is still red.

**Prose that said silver was the big tier** is corrected: GOLD's brief ("under a fifth of silver" is
now "larger than silver, 93.85 GiB against 65.64"), GOLD's two zebrahub twin sentences, and the
OVERVIEW line ("more than five times gold"). `BACQ` says what the delete did to it: its 19 modules
pin silver keys that no longer exist, and the custody record moved into each dataset's README.

**Not drawn:** `zsb-open-source/_access_check/claude-20260911T003824.txt`, a write-probe another
session left at 00:38 UTC. It is not a dataset; it was filtered out of the listing before the splice.
Delete it in the console when convenient.

**Checks.** `check-overlaps` 0 pairs (135 text nodes, down from 167 with silver's tiles gone).
`check-clicks` 18/18. `check-fit` 7 failures, none in either vault — SPUB/GFETCH crowding and five
zone-boundary straddles, as before.

## Tile captions are two rows at one size — 2026-09-11

**A tile caption is its key and its size, nothing else.** The object count is gone from the tiles
(it is in each vault's reader panel); a wholly-legacy tile says `· legacy` on its size row instead.
Every tile in every vault starts from the same `CAP_KEY = 8.6` / `CAP_SIZE = 7.6` and only shrinks
when it must — before, a big tile set its key at 10.5, so `human/tahoe/` and `megafin/` shouted while
the tiles beside them whispered, and the eye read lettering instead of area. Bronze's split tiles
(aspirational / legacy halves) use the same two sizes. Rows sit at a pitch of `1.22`, not `lineH`'s
`1.45`: a caption is one object. `1.15` let glyph boxes touch by 0.2px (`check-overlaps` caught
`micdropseq/` against `15.7 GiB`).

**An unlabelled group draws no column caption and reserves no row for one.** The OPEN vault's single
group is now `label:""` — "Acquired (Open Source)" repeated the vault's own name. SILVER keeps its
caption; there it separates ours from theirs.

**The OPEN vault now shows 879 objects, 472.57 GiB, not 867.** At 00:24 UTC another Claude session on
this instance (the fate-map one) copied `zebrahub/timepoints/` (11) and `zebrahub/zebrahub_base.h5ad`
into `zsb-open-source` and verified them against local and silver copies — the pre-convention legacy
objects the move had excluded. The panel draws them in the pending-deletion red, as it does the
chemfish stray. Whether they stay is the user's call, not this page's.

Checks: `check-overlaps` 0 pairs, `check-clicks` 18, `check-fit` the known 7.

## Tiles lay out wide, not square — 2026-09-11

**Squarify aimed every tile at 1:1, which is the worst shape for a horizontal caption.** A key like
`micdropseq/` shrank to the tile's width while half its height sat empty. `drawTiles` now lays out on a
canvas stretched vertically by `TILE_WIDE` (in `ds-shapes.js`) and squashes the result back, so the
layout optimises for tiles `TILE_WIDE` times wider than tall. **Every area is exactly what it was** —
area is still the encoding, and nothing here is a minimum size.

`TILE_WIDE = 3`, chosen by measurement across Silver and Open Source (58 tile keys): at 1, 26 keys
rendered at 8 px or taller and the median was 7.0 px; at 2.2, 30 and 8.0 px; at 3, 30 and 9.0 px. The
cost is that a tile shorter than about one line now sheds its size row sooner (Silver's `zmap/`) —
that is the existing shed-a-row rule, not a regression. `?wide=<k>` on the page URL overrides the
factor, for tuning without an edit.

Checks at 3: `check-overlaps` 0 pairs (170 text nodes), `check-clicks` 18, `check-fit` the known 7.

## The state of the data — 2026-09-10, last. The open-source bucket is full.

```
zsb-open-source   867 obj · 462.21 GiB   all 23 acquired datasets, each with its custody README
silver            959 obj · 538.20 GiB   unchanged - still holds every copied object
```

**All 23 acquired prefixes are now in `zsb-open-source`**, copied key for key and reconciled clean:
`/data/scratch/open_source_migration/reconcile_all.py` checks every planned key for presence, size and
a CRC64NVME match, then for anything unexpected, excluded, README-less or left behind in silver, and
found nothing on any prefix. The 14 declared exclusions stayed out, bar the one known stray
(`chemfish/2025_03_release/Paper/`), which is drawn in the pending-deletion red until someone deletes
it in the console. Silver is drawn exactly as it still is: a person deletes the copies, not a script,
and its tile literals were deliberately left alone.

**Each dataset's root README is the custody record now**, written for this bucket and replacing
silver's: provenance, a per-file SHA-256 table (and the origin's own digests where it publishes them),
the acquisition procedure, how to verify, and the move itself. Writing them surfaced errors in the old
records, corrected in the new ones - celloracle's manifest pointed its 90 GSM files at GEO URLs that
404, micdropseq's `SHA256SUMS` pins a README edited after it was computed, several silver READMEs
carried wrong byte totals. `zcl2/analysis/` is the one thing in the bucket that is ours (a Table S1
annotation reconciliation); the panel lede and its row say so.

**The vault is 26 wide, not SILVER's 24.** At 867 objects the byte count on the right of the title bar
ran into `OPEN SOURCE DATASETS` on the left - `check-overlaps` caught it. Two more units keep the name
the user chose and still sit inside the lane.

**`PROJECTED="…"`** on `gen_open_source_panel.py` draws the bucket as a copy in flight will leave it and
puts that sentence at the top of the panel; the next plain refresh removes it. Use it only with the
line on - a projection drawn as fact is the one thing this page must never do.

**Checks.** `check-overlaps` 0 pairs (172 text nodes). `check-clicks` 18 stations. `check-fit` the same 7
pre-existing failures. The console now logs 10 negative-`<rect>` errors, up from 5: the new vault has
its own hairline tiles (tomoseq, trunk30hpf, farrell). Same debt, same reason not to clamp it.

## The state of the data — 2026-09-10, later. A second S3 lane: open-source datasets get a bucket.

```
new bucket  s3://zsb-open-source   44 obj · 50.58 GiB   zscape/ + chemfish/ (2 of 23 acquired)
silver      unchanged              959 obj · 538.20 GiB — every copied object is still there
```

**Datasets somebody else published are moving out of silver into their own bucket**,
`zsb-open-source`, created by hand in the console. The copy is server-side and key-identical,
each object confirmed by size and full-object CRC64NVME against its source, and each dataset's
root `README.md` there carries its custody record (provenance, per-file SHA-256, acquisition,
verification) — the zsb-bronze custody PRs are no longer the vehicle. Silver still holds every
copied object, because a delete is a human console act; it is drawn as the bucket actually is.

**The map now has three enclosures, not two.** Left to right: `AWS S3 Open Source Datasets`
(new, `x0 -32.5 … x1 -3.5`), `AWS S3 ZSB Datasets` (the old `AWS S3`, renamed, unmoved), `GitHub`.
The new vault is `OPEN`, at `COL_OPEN = -18`, level with SILVER and the same size, in silver's
tier colouring. It is its own lane rather than a fourth tier because it is not a stage: no hop reads
it and nothing in it was made here, so it has no conduits. The grid's `X0` moved from -6 to -36 so
the lane sits on paper. The *Layout* and *Zones* sections above still describe two enclosures;
read them with that in mind.

**Its tiles are generated, unlike silver's.** `gen_open_source_panel.py` builds both the reader
panel and the treemap groups from a live listing, and `--splice` writes `groups`, `right` and
`panel` into the OPEN node only (found by id, bounded by the next node). Each dataset inherits its
accent and modality band from SILVER's tiles, so a dataset keeps its colour across both vaults and
the next batch needs no hand edits. Refresh after every batch:

```bash
aws s3 ls s3://zsb-open-source/ --recursive | awk '{s=$3; $1=$2=$3=""; sub(/^ +/,""); print s"\t"$0}' > <dir>/open_source.tsv
cp <silver panel_style.txt> <dir>/      # everything up to the first </style> of the SILVER panel
python3 gen_open_source_panel.py <dir> --splice
```

The panel's rows are a generic two-level tree, marks the one stray object (`chemfish/2025_03_release/Paper/`,
excluded from the move and let through by a filter bug) in the pending-deletion red, and closes
with **Not moved yet · 21 of 23** so the migration reads as partial rather than being inferred.

**The wider plan broke selection, and `fit()` now reserves the reader.** Selecting a station opens
the reader, and the map does not re-fit while something is selected. That was free while the plan was
height-bound; the new lane made it width-bound, and the first click then buried the zsb-medallion
rail under the reader — `check-clicks` caught it (`"zsb-medallion" -> reader showed "the starter
notebooks"`). `fit()` now fits into the stage minus the reader's reopening width while it is shut
(`readerReserve()`, fed by `shut()` recording that width on the panel), so opening it covers empty
stage. The price is an empty strip on the right at first load on width-bound screens. The phone
layout is exempt. The *no fly-to* and *no re-fit while selected* rules are untouched.

The group eyebrow is plain `Open Source`, not `⓪ Open Source`: the page font has ①–⑤ and no ⓪,
which rendered as a missing-glyph box — and it is not a numbered stage anyway.

**Checks.** `check-overlaps` 0 pairs (144 text nodes). `check-clicks` passes, **18** stations.
`check-fit` the same 7 failures as before, now reported against the renamed zone. Word counts
unchanged (the six pre-existing over-cap briefs; `OVERVIEW.how` 95 after its edit). No new console
errors beyond the five known negative-`<rect>` ones.

## The state of the data — 2026-09-10. `human/` opens, and one prefix is most of silver.

```
buckets    aws s3 ls --recursive on silver (bronze, gold and the repos not re-read)
silver     959 obj · 538.20 GiB     was 925 · 222.44
new        human/tahoe/  34 obj · 315.76 GiB · 58.7% of the bucket
```

**Tahoe-100M landed, and it is the first key with a species segment.** Every other
prefix is zebrafish and sits at the root; this one is `human/tahoe/`, chosen over a
flat `tahoe/` so the species is in the key rather than only in the prose. Two
releases, both held as their origins serve them: `2025-02-25/` (Arc's per-plate H5AD
release from GCS, 19 files, every one matching GCS's own `md5Hash`) and `2dc57900/`
(the authors' annotation tables from Hugging Face at that commit, every one matching
HF's LFS sha256 or git blob SHA-1). Plus `Paper/`. Uploaded by
`/data/scratch/tahoe_upload.sh`, staged as symlinks in `/data/scratch/tahoe_publish/`.

**It is bigger than everything else in silver put together**, which is what the map
now shows: the Acquired column takes almost the whole vault, Tahoe gets its own
"Human scRNA-seq" band, and the Parse column is a sliver. That is true area, not a
layout bug — see *Please do not* on minimum tile areas.

What changed, the four edits plus the claims the new bytes broke:

| Was on the map | Now |
| --- | --- |
| silver `925 obj · 222.44 GiB` | **959 · 538.20** |
| `22 datasets · 19 pinned`, `19 of 22 acquired prefixes have a module` | **23**, **19 of 23** |
| `keller, zfap, tomoseq — the three that are not scRNA` | **+ human/tahoe — the first scRNA one** |
| "half of what is in silver" — three prefixes, 20 obj, 9.7 GiB | **"most of what is in silver"** — four, 54 obj, 325.5 GiB |
| `vs silver: 123% — gold is larger than silver` | **17% — silver is 5.7× gold** |
| GOLD brief and OVERVIEW.state: "Gold is larger than silver" | rewritten |

**"Gold is larger than silver" was already false before Tahoe.** It was true at the
2026-08-29 read (93.85 GiB against 76.00) and stopped being true when the acquired
prefixes landed on 2026-09-08; the 2026-09-09 read recorded silver at 222.44 GiB and
the sentence survived it in three places. GOLD's `cond` still carries the 76.00
comparison and is left alone — it is dated, and `cond` is the record.

**`gen_silver_panel.py` takes its scratch dir as an argument now.** It had the previous
session's scratchpad baked in, and that scratchpad was gone by this read — both
`silver.tsv` and `panel_style.txt` with it. The style block was recovered from the
live SILVER panel (everything up to the first `</style>`). Run it as
`python3 gen_silver_panel.py <dir>`. `tahoe/` is not in `PINNED`, so it reads
**NO RECORD**, which is true: its zsb-bronze module is not written, because the
module generator assumes a one-segment `<dataset>/` prefix.

**The hundred-word check in this file was counting the letter s.** The snippet under
*The reader panel* puts `\s` inside a template literal, where it becomes a plain `s`,
so it split on the letter and every brief looked short. Fixed to `\\s`. With a real
count **six nodes are over the cap and were before this read** — BRONZE 124, BFETCH
127, BREPO 114, SREPO 108, BACQ 103, MED 101. Not touched here; they are debt the
broken check hid.

**Checks.** `check-overlaps` **0 pairs** (132 text nodes), down from 1 — the
`"Acquired (Open Source)"` / `"scRNA-seq"` pair is gone. `check-clicks` passes, 17
stations. `check-fit` **7 failures, all identical on the previous commit** (served from
a detached worktree and run side by side), so none is from this read. The console
logs **5** negative-`<rect>` width/height errors against **3** on the previous commit:
hairline tiles getting thinner as Tahoe takes the width. Layout debt, not clamped —
a clamp is a minimum area by another name.

## The state of the data — 2026-09-09. Nothing moved in S3. The GitHub column had a wall behind it.

```
buckets    aws s3 ls --recursive --summarize on all three
repos      fresh clones at /data/scratch/zsb-repos/ + gh api
             zsb-bronze dfaf9df   zsb-silver da1d04d
             zsb-gold   31c381a   zsb-medallion 7ef6198
```

**The S3 column is exactly where the previous read left it, to the object.** Bronze
136,246 / 9.56 TiB, silver 925 / 222.44 GiB, gold 14 / 93.85 GiB, and all
twenty-five silver prefixes match the panel tile for tile. Nothing on the left
half of this map changed, and re-reading it to find that out is the point of
re-reading it.

**`main` did not move on any of the four repos either.** Same four commits, same
commit counts, same v0.13.0 on all three taps. Five reads in a row this map has
found movement on one side or the other; this is the first that found none on
either.

**And that is the finding, because of what is behind it.** `zsb-bronze` now
carries **21 branches and 19 open pull requests** — `#103`–`#121`, one per
acquired dataset, four opened 2026-09-08 and fifteen on 2026-09-09, **none
merged**. The other three repos have none. So the bytes are in silver, the
custody modules that would pin them are all written, and every one of them is
sitting in review. The DanioCell and Zebrahub warehouse READMEs each end with
the same sentence — *this upload is the bytes; the custody record that pins them
is the pull request that follows it*. Nineteen of those pull requests now exist
and not one has landed.

**The "no gh CLI" claim was wrong and is retired.** For two reads `zsb-silver`
and `zsb-gold` carried *not re-checked — no gh CLI on this instance*. There is a
`gh` here and it is authenticated; both now read **none open**, checked. This is
the second time this map has recorded an instance limitation that had quietly
stopped being true — the first was `uv`. **Re-test the tool before repeating the
excuse.**

| Was on the map | Now |
| --- | --- |
| `16 branches`, `16 acquired proposed` | **19** branches, 19 proposed |
| `16 of 19 acquired prefixes have a module` | **19 of 22** — the denominator was wrong too |
| `Three of the nineteen acquired prefixes` | **twenty-two**; the three are still keller, zfap, tomoseq |
| `307 rows across 16 modules` | **544 across 19** (counted by AST over each branch's manifest) |
| bronze `Open PRs #103–#118` | **#103–#121 — 19 open** |
| silver/gold `not re-checked — no gh CLI` | **none open**, gh present and authenticated |

**The denominator was wrong before the numerator was.** `16 of 19` implied
nineteen acquired prefixes. Silver holds twenty-five, three of which this account
produced — minifin, megafin, megafin-1 — so twenty-two are acquired. The page had
been carrying a nineteen since before the last three prefixes landed. Both halves
of that ratio are now derived from the same read.

**One row is deliberately not updated.** *Authors' digests: 25 of 307* now reads
*was 25 of 307 — not re-counted across the three new modules*. The row counts
origins that publish their own checksum, and that is a per-module prose question:
a `md5` field is present on 514 of the 544 rows, but most of those are ours,
computed at acquisition. Counting the field would have produced a confident wrong
number. **A stale figure marked stale beats a fresh figure that is invented.**

**Checks.** `check-clicks` passes, 17 stations. `check-fit` **1 failure, down
from 8** — `"132 keys · 947 MiB"` straddling the S3 zone boundary, the last of the
known set. `check-overlaps` reports **1 pair**, `"Acquired (Open Source)"` against
`"scRNA-seq"` at 116.3 x 1.2 px; it reproduces on the previous commit, so it
arrived with the silver band work and is not from this read. Both are layout debt.

**Note for the next reader.** `check-*.mjs` need node's own playwright and its own
browser build — `npm install --no-save playwright && npx playwright install
chromium`. The python playwright already on this instance is a different install
and its browsers do not satisfy them.

## The state of the data — 2026-09-07. The gold door opened, and the answer was six reads old.

```
repos      fresh clones at /data/zsb-repos/
             zsb-medallion 7ef6198   zsb-bronze dfaf9df
             zsb-silver    da1d04d   zsb-gold   31c381a
buckets    aws s3 ls --recursive --summarize   on ALL FIVE, gold included
```

**This log stopped at the fifth pass while the page kept moving.** The map has had
readings through an "eleventh read"; `ds-data.js` carries their figures and this
file does not mention them. It is the same failure the fifth pass described in
the other direction — prose going stale beside the numbers it describes — and the
fix is the same: if you update the panel, update this. The gap between pass five
and here is recoverable from `git log -- public/data_structures/ds-data.js`.

**The role was widened and gold is not empty.** For six reads this map said
*contents unknown, not known to be empty*, and insisted the distinction mattered
because the two call for different next actions. It did. Gold holds **14 objects,
93.85 GiB**, and has been in use since 2026-07-27.

| Was on the map | Now |
| --- | --- |
| gold `contents unknown` · ListBucket AccessDenied | **14 obj · 93.85 GiB**, read cleanly |
| "Ever written by zsb-silver: no — publish_gold raises" | **implemented and run** |
| `build_gold` raises · `download_gold` raises | both implemented; gold built from silver |
| key convention "settled 2026-08-23", an open gate | **realised** — `minifin/parse/v1/`, `minifin/zsb/v1/`, `minifin/zsb/v2/`, `megafin/parse/v1/`, `megafin/zsb/v1/` |
| silver `86 obj · 19.82 GiB` | `91 · 76.00 GiB` — a 56.16 GiB `megafin/` prefix landed |
| bronze panel `100,545 obj · 7.20 TiB` | `136,246 · 9.56 TiB` — the panel had fallen behind its own headline |
| bronze `189 commits · 5,947 LOC` | `331 · 13,575` |
| silver `60 · 3,977` · gold `37 · 93` · medallion `83 · 2,656` | `98 · 8,422` · `59 · 2,871` · `148 · 3,729` |
| all three pin `v0.9.0` | all three pin **v0.13.0**, still in step |
| "one steel thread: MiniFin 100k" | **two** — every repo now has `megafin/` beside `minifin/` |

**Three conduits changed state, which is the only shape change.** Silver→zsb-silver
and zsb-silver→gold are now **live**: gold holds the artifacts, so the bytes moved
and can be shown to have. Gold→zsb-gold **stays dashed** — `fetch_release` is
implemented for both datasets, but nothing here demonstrates it has read anything,
and the rule on this map is *carried bytes, and can be shown to have*, not
*implemented*. Resist the temptation to solid-line a hop because the code exists.

**Gold is larger than silver** (93.85 GiB against 76.00). That is not a defect.
The medallion shape promises shrinkage down to the tier where opinion starts; past
it, two recipes of one dataset are two artifacts, and MegaFin's `zsb` recipe alone
is 51.2 GiB.

**The three MiniFin silver releases were re-published.** Same three keys, different
bytes — `1,562,739,920 / 1,559,526,002 / 1,583,429,276` against the
`1,561,917,184 / 1,562,792,160 / 1,559,446,470` the fifth pass recorded. **No check
on this map would have caught that.** The manifest pins watch bronze; silver's
releases are pinned by key, and a key-level pin cannot see a byte-level rewrite.
If one thing from this read is worth acting on, it is that.

**The read date moved out of `ds-view.js` into `ds-data.js` as `READ_DATE`.** The
fifth pass found it hardcoded twice in the renderer, against the ownership table,
and said to move it next time somebody touched the reader. Done.

**Checks.** `check-overlaps` 0 pairs (93 text nodes). `check-clicks` passes.
`check-fit` reports **8 failures, down from 9** — the pre-existing set, all of them
conduit captions straddling the zone boundary or crowding a stub's box. They are
not from this read; the same 9 reproduce on the previous commit. Worth fixing, but
they are a layout debt, not a fact debt.

**What could not be checked.** Open PR counts: there is no `gh` on this instance
and no API path that does not mean handling the stored token by hand, so all four
repos now read *not re-checked* rather than carrying a stale count. Bucket-level
configuration (versioning, replication, encryption) is still `GetBucket*`
AccessDenied and is still repeated as zsb-medallion's claim rather than confirmed.

## The state of the data — fifth pass, 2026-08-29. Both columns moved, and a gate had been closed for three days.

```
repos      re-pulled at
             zsb-medallion 00b71e8 (unchanged)   zsb-bronze d595a82
             zsb-silver    560d34a               zsb-gold   513ca22 (unchanged)
buckets    aws s3 ls --recursive --summarize   on bronze and silver
           aws s3api head-object               on all 8 bronze pins + all 3 silver releases
```

**The first read where both sides moved at once.** Three of the four previous
passes found movement on one side only; the fourth found none. This one found
two new releases on the left, 1,900 new lines on the right — and one claim that
had been wrong since before the fourth pass.

| Was on the map | Now |
| --- | --- |
| silver `82 obj · 16.91 GiB`, 1 versioned release | `86 · 19.82 GiB`, **three** — v1, v2, v3 |
| `minifin/` tile 9 objects · 1.55 GiB | 13 objects · 4.45 GiB, **22.5% of the bucket** |
| bronze `153 commits · 4,996 LOC` | `156 · 5,205` (2,792 in `minifin/`) |
| silver `34 commits · 870 LOC`, "fetch is written, two gates left" | `38 · 2,552` — **771 lines of ported QC in `process/`** |
| barcode-ranks `94,338 · jaccard 0.9827` | `94,087 · 0.9824` — the curve is now fit per slice, not per sample |
| "two gates remain: the QC sign-off and the gold key convention" | **one.** The key convention was settled 2026-08-23 |
| "every open pull request in the set is in zsb-silver" | all four repos have them — bronze 3, silver 5, gold 1, medallion 1 |
| "thresholds come from Parse's recorded `settings.txt`" | **reversed.** Re-derived per sample; the recorded values are noise |
| — | **New:** `build --policy` chooses the cell-calling policy; `.uns["called_overlap"]` measures the ones it cannot assert |

**The finding that matters most is about this document, not the repos.** The
gold object-key convention — `<dataset>/<recipe>/<version>/` — was written down
on 2026-08-23 in zsb-gold's README, its AGENTS.md, and the docstring of the very
stub this map drew as blocked. All of it at `513ca22`, **the commit the fourth
pass read and cited**. The map carried that gate as open for two passes.

The fourth pass's lesson was *when a finding is retired, grep the panel for its
other half*. This is the sharper version of it: **a gate is a claim about a repo
other than the one the panel is about, and re-reading the panel will never catch
it.** `SPUB` and `GFETCH` both named that gate; both live in panels about
zsb-silver and zsb-gold's *stubs*, and the answer was in zsb-gold's *prose*. When
a panel says "blocked on X", go and read the repo X belongs to, not the panel.

**The second finding is the founding one, inverted.** zsb-bronze's dataset README
says `barcode-ranks` is "deliberately unpublished" and stops its version table at
v2 — while `minifin/v3/` has been in the warehouse since 2026-08-28 21:09:52,
published under exactly that policy, and recorded in the CHANGELOG committed in
the same tree. Two documents in one commit disagreeing about a bucket. This map
was built on a ledger that indexed a release nobody had uploaded; it now carries
a README that denies one that exists. Open PR **#49** names the distinction the
README was reaching for: *publication is not promotion*.

**No shape changes this pass, and one was deliberately declined.** zsb-silver's
`process` is 771 lines of real ported filters whose orchestrator still raises —
which looks like it wants a fourth cell state. It does not get one. The existing
scheme already says it exactly: **plate dashed means it raises; lamp filled means
it has moved bytes.** `build_gold` raises, so the plate stays dashed, and the 771
lines are a fact for the panel rather than for the mark. A state per situation is
how a visual vocabulary stops being one. `DRAW.bay` also needed nothing — it
takes an arbitrary `lines` array, so three releases rendered in the same three
rows v1's three objects used to.

> **That bay is gone** (2026-09-08). It sat in the corridor describing MiniFin's
> three releases, and once the versioned convention was named on the repo's own
> entry it was restating one dataset's release count in the middle of a write
> path. Removing it closed group ③ up rather than leaving a hole, so the groups
> after it renumbered; the two conduits that routed through it are one direct
> `BREPO → SILVER` hop now, carrying the label the pair used to share.
> `DRAW.bay` is unused but kept — the shape is sound and the next thing that
> wants a captioned box in a corridor should not have to rewrite it.

**Two pieces of stale scaffolding found while working, both now fixed:**

- **The read date was hardcoded in `ds-view.js`**, twice — the reader's `Read on`
  heading and the overview footer. That is a fact living in a rendering-side file,
  against the ownership table above. It has been updated, but the right fix is to
  move it into `ds-data.js` next time somebody touches the reader; it will go
  stale again exactly the same way.
- **The "Please do not" note about treemap minimum area** describes `minifin/` as
  "0.59% of its bucket and a two-pixel hairline at true area". That was true when
  it was written and the tile is 22.5% now. **The rule still stands** — do not
  floor tile area — but the example in it has outlived itself. Left as written,
  flagged here, because the rule is right and the number was only ever the
  illustration.

**On running the checks.** The eleven pins (8 bronze + 3 silver) all matched, and
none of it was run the intended way: there is no `uv` and no virtualenv on this
instance, so `zsb-bronze minifin pins` and `zsb-silver minifin pins` do not start.
The pins were read out of `fetch/manifest.py` and `minifin/release.py` and put to
`head-object` directly. Same comparison, done by hand. **If the next reader has a
working toolchain, run the commands and say so here** — the third pass recorded
"the most perishable claims are now something CI can be asked", and that is true
on a machine that can ask.

`check-overlaps.mjs`, `check-fit.mjs` and `check-clicks.mjs` all pass. `check-fit`
caught one real regression during this pass: `SPROC`'s note read "parts ported ·
nothing orchestrates them" at 85% of the box against an 80% cap. It is "parts
ported · nothing runs them" now. **The 80% cap earns its keep on exactly this
kind of edit** — a note that grew by four words while nobody was looking at the
box it lives in.

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
  const wc=x=>String(x).replace(/<[^>]+>/g," ").trim().split(/\\s+/).length;
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

### A vault with two kinds of prefix

`DRAW.vault` takes either `n.tiles` (one treemap) or `n.groups`
(`[{label, tiles}]`, one column each). Silver uses groups: everything this
account produced from a Parse delivery on the left, everything published by
somebody else on the right. **Column widths stay proportional to the bytes in
each group** — area encoding size is the reason this map is drawn top-down, and
a 50/50 split would break it across the divide for free.

Two things that bit while adding it. The "no objects observed" branch tested
`n.tiles` alone and painted its hatch straight over seven grouped tiles; it
tests both now. And two group captions ran into each other across the divide,
so a caption is scaled to its own column the way tile captions are.

The right column is itself `sub:[{label, tiles}]` — five modality bands, one
per kind of measurement: scRNA-seq, imaging, spatial, anatomy, reference. Small
bands sit on a floor (`FLOOR = 2.1`) and say `~` where they do, because a
truthful band for anatomy alone would be a tenth of a grid unit. A band's
captions shed rows down to one before shrinking below 6px, which is what keeps
a 0.0003% tile like `tomoseq/` from writing over its neighbour.

`legacy` on a tile is a byte count. Less than `value` splits the tile and
captions both halves; equal to `value` means the whole prefix is legacy, which
takes the dashed grey rule instead of a dataset accent. The same dash is on the
legacy half of a split tile, and on `.fkds.leg` in the reader panel — one
vocabulary for "retained, not what to build on" in all three places.

### The silver panel is generated, the tiles are not

`gen_silver_panel.py` builds the whole SILVER reader panel from a live
`aws s3 ls --recursive` of the warehouse, written to
`scratchpad/silver.tsv`. Run it, then splice its output into the SILVER node's
`panel:` string — **target that node, not the first `panel:` in the file**: the
BRONZE panel opens with the same `<style>.fkw{` block and a naive search-replace
lands on it. Adding a prefix means four edits: `PINNED`, a row in `SIMPLE` or
`MULTI`, its name in the section list at the bottom of the generator, and a tile
in `ds-data.js` `groups`. The tiles are still hand-maintained literals, and that
is where this page has drifted from the bucket every time it has drifted.

### `panelOnly` stations, and the box vocabulary

A station whose entry *is* a list of things renders `n.panel` and stops — no
brief, no kv. `does` / `built` / `cond` stay in `ds-data.js` for these too, and
stay unrendered. The classes live in `index.html`:

| class | what it is |
|---|---|
| `.pg` | the panel |
| `.pgl` | a lede — one ruled paragraph *above* the first heading, for a rule the boxes below are instances of |
| `.pgq` | a chip row inside the lede, for the two or three numbers a reader would otherwise assemble from the boxes |
| `.pgq.ds` | a chip row of dataset names, in each dataset's own accent, naming what a section carries |
| `.pgh` | a group heading; takes `--c` |
| `.pgi` | a box; takes `--c` |
| `.pgi.ic` | a box with a drawing of its action in a 26px column |

`OVERVIEW.processes` groups take an optional `sets: [[label, ink], …]`, rendered by
`processBlock` as a `.pgq.ds` row between the group heading and its boxes — what a
section has under its wing, before what it does to them. The inks are the dataset
accents the bucket treemaps use, so the two panels read as one map; they are fixed hex
with no light variant, which is why `body.light` darkens them.

`.ic` is opt-in for a reason: `.pgi` is used by five other panels whose boxes
have no icon, and a grid applied to all of them puts their name in a 26px
column. An icon is a 24×24 inline `<svg>`, `fill:none`, stroking `var(--c)` so
it inherits the box's accent in both themes; `.sf` fills a mark instead,
`.th` thins it, `.dm` dashes it. Draw the **action**, not a symbol for its
name — a bucket with something going into it, an origin with an arrow leaving
it — and check it at 26px, where four strokes crossing become a smudge.

**A step box says what the step does in one plain sentence, then at most one
concrete detail.** The acquire panel is the worked example: it opened as nine
boxes of 47 words each with no lede, which is a record rather than a panel.
The rewrite put the claim at the top (run these and you get the warehouse
back), the exceptions to it in their own section, and numbered the boxes in
the order a person runs them.

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
