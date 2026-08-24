# zeroshot.bio/pipeline — file split and working contract

The single HTML file you were handed is now four files. **This replaces it.** Same
behaviour, same output, no functional change — the split exists so two people can
work on it at once without colliding.

## Where it lives and how it is served

The tree is `public/pipeline/` in the `zeroshotbio-landingpage` repo, served at
`https://www.zeroshot.bio/pipeline` by a rewrite in `next.config.js`:

```js
{ source: '/pipeline', destination: '/pipeline/index.html' }
```

Script `src` attributes are **absolute** (`/pipeline/pipeline-iso.js`). They have to
be: the route has no trailing slash, so relative paths resolve against `/` and 404.

## Load order matters

```html
<script src="/pipeline/pipeline-iso.js"></script>     <!-- primitives -->
<script src="/pipeline/pipeline-shapes.js"></script>  <!-- visual vocabulary -->
<script src="/culls/culls-pop.js"></script>           <!-- SHARED: the population -->
<script src="/culls/culls-draw.js"></script>          <!-- SHARED: the four roofs -->
<script src="/pipeline/pipeline-data.js"></script>    <!-- the pipeline itself -->
<script src="/pipeline/pipeline-view.js"></script>    <!-- assembly + interaction -->
```

Plain classic scripts, no modules, no build step, no dependencies, no CDN, no fonts.
Top-level `const` in one file is visible to later files. If you move to a bundler,
keep this order.

## Who owns what

| File | Owner | What it is |
|---|---|---|
| `pipeline-data.js` | **on-instance** | NODES, EDGES, BANDS, CARRIES, SNIPPETS, OVERVIEW. Every fact, number, name and payload. |
| `pipeline-shapes.js` | **rendering side** | One draw function per shape, plus SKIN and topOf. |
| `pipeline-iso.js` | rendering side | Projection, faces, paint, layout, ticker registry. |
| `pipeline-view.js` | shared, frozen | Grid, bands, labels, edges, dots, camera, reader, index. |
| `index.html` | shared | Markup, header stats, and the CSS variables that define both themes. |
| **`/culls/culls-pop.js`** | **shared with `/bioinformatics_pipe`** | The simulated barcode population and every statistic computed from it. |
| **`/culls/culls-draw.js`** | **shared with `/bioinformatics_pipe`** | The four roofed culls, `roofFrame`, the chart helpers and the floating annotations. |

## The four roofed culls are shared code

Row 3's knee, mito, complexity and doublet culls are drawn from
`public/culls/`, and **`/bioinformatics_pipe` draws the same four from the same
files**. That page is this row drawn deeper; one implementation means two
accounts of one pipeline cannot drift. It is the same rule the node prose
already follows — that page lifts its `does` / `built` / `cond` from this one
as source text rather than re-typing it.

**Edit `/culls/` and you have edited two maps.** The other page has six checks
of its own and they all have to pass too. This map's are:

```bash
node check-culls.mjs <url>     # the shared roofs load, draw, animate, stay put
node check-edit.mjs  <url>     # floating labels, the double press, the ✕
node check-pads.mjs  <url>     # the four row pads: move, resize, name
node check-rows.mjs  <url>     # rows stay unconnected, all read one way, grid covers all
node check-multi.mjs <url>     # Select many: one delta, spacing intact
node check-carried.mjs <url>   # the row-opening clones stay clones
```

Three things about this page in particular, each of which has already gone
wrong once:

- **The buildings are smaller here.** A cull is 4.2 units on that page because
  it is the whole map; here it is 1.5, one object in one of four rows, and the
  lane span is fixed by the snake so it cannot simply grow. Everything about an
  annotation scales with its roof for that reason. A node may also nudge its
  own annotations with `annDx` / `annDy`, which this map needs because the
  ground under row 3 is occupied and the ground under that page's row is not.
- **The palette must carry `--keep` / `--cull` / `--accent`.** They are aliases
  onto `--fg2` / `--drop` / `--signal`, which this page already had. Without
  them every mark on every roof renders black, which is what an undefined CSS
  variable looks like and is easy to mistake for a deliberate choice.
- **The reader must keep saying "modelled".** Every threshold on those roofs is
  computed from a simulated population, and a modelled figure that has lost
  that word claims a result nobody produced. `roofFigures()` in
  `pipeline-view.js` prints it above the numbers.

**Never give a roof `shape:"works"`.** `topOf()` returns `n.h*0.96` for a works
node and `n.h` for everything else, and the chart is laid at `n.h` — so a works
roof would put the label anchor and the occlusion silhouette 4% below its own
chart.

### Five rows: the bioinformatics row is two rows

`R1..R5`. Rows 3 and 4 were one row and splitting them is the point of the
current arrangement: together they were nineteen objects, a third of the map on
one line, doing two different kinds of work. One turns reads into a table of
every barcode against every gene; the other decides which of those barcodes was
a cell. Each half already has a page of its own built from this data —
`/FASTQ_pipe` and `/bioinformatics_pipe` — precisely because each is a subject
on its own, and the big map now says the same thing.

| | | |
|---|---|---|
| **row 3** | *Reads to a matrix* | FASTQ → barcode calling, alignment, UMI collapse → **unfiltered matrix** |
| **row 4** | *The cull* | the four roofed culls → **filtered matrix**, with the attrition band behind them |

**The unfiltered matrix ends row 3 rather than beginning row 4.** A node can
only be in one place, and the row that *produces* it is the row it belongs to —
row 3 is named for what it delivers. Row 4 begins with the first cull and reads
as acting on the object sitting directly above its start, which is what the
stacking is for. There is no `UD → c1` edge for the same reason there is no
edge between any two rows.

**The attrition band spans `c1 → FD`, not `UD → FD`.** A band cannot reach
across a row, and the population it counts is the one arriving at the first
cull, which is the same population.

If you split or merge a row, four things move together: `LANES`, `ROWS`,
`BANDS`' name list and `BAND_X`. `ROWS` is what decides whether a node's name
emits up-right or down-left, so a row missing from it silently sends every
side structure's label the wrong way.

### Every row reads left to right, and nothing is drawn between them

The map used to snake: rows 2 and 4 ran right to left so each turned a corner
into the next. That is efficient with space and asks the reader to change
direction three times — a row that reads one way with a row under it reading
the other is two reading orders on one page, and the only thing telling you
which is which is the dots. All four now run the same way.

**And the row-to-row tracks are gone.** The rows are stacked in the order
things happen and each reads the same way, so "this row feeds the next" is
already said by where they sit. Drawing it as well meant a track running the
entire length of a row backwards, three times, to state something no reader
was in doubt about — and a track is the loudest thing on this map after the
objects themselves.

**Every track that is left says something position does not**: which of two
forks a thing took, that a reference feeds a step it is not beside, that a
cull drops into a ledger. A row-to-row track said nothing of the sort. So a
row simply ends: the last object of one leads nowhere and the first object of
the next is fed by nothing, and both read as "the row stops here" rather than
as a broken link.

`check-rows.mjs` asserts it, because **this is easy to undo by accident**.
Adding an edge is one line in the data file and the obvious line to add is the
one joining two rows — it is what the prose describes. The check also asserts
every lane still reads left to right: a lane quietly flipped back is a row
reading against its neighbours with nothing on screen saying so.

If they ever go back, they need routing that goes **around** rather than
across — a straight run between two rows cuts diagonally through every object
on the row it is leaving. git has the version that did.

### The four pads move, resize and carry their names

A band is the ground a row stands on. It was authored geometry and nothing
else; it is now an object with a position, a size and a name, all three tunable
in Edit positions — because the rows have different lengths and different
amounts of side structure, and no formula gets four of those right at once.

Committed under `band:<i>` in the same offsets table: `dx`/`dy` move it,
`sw`/`sh` grow it from the far corner, `ldx`/`ldy` move its name, `del`
removes it. `_b0` is the pad as the data file authored it, captured once, so
every nudge measures from one base — the same rule the buildings follow.

**Its handle is its EDGE, never its area.** A pad is the biggest object on the
map: a filled handle means pressing anywhere on a row picks up the floor
instead of whatever is standing on it. The outline has no fill and a fat
invisible stroke, so it picks up where it is drawn and nowhere else.

**The size grip is on the far corner** — the corner that moves when the pad
grows — so dragging it means what it looks like it means. A pad will not go
inside out: below a floor it stops rather than flipping.

`check-pads.mjs` asserts all three move independently (moving must not resize,
resizing must not drag the near corner, moving the name must leave the pad
alone), that the handles are inert before the mode is on, and that the whole
lot saves and comes back.

### Row 3 is longer than the other rows

Four culls carrying a chart each need room: they are **4.2 units square, the
same size they are on `/bioinformatics_pipe`**, where they are bigger than the
unfiltered matrix they follow because the decision is the thing that row is
about. Squeezing them into the span the other rows use made them smaller than
either matrix, which says the opposite.

So `r3` has its own span and the snake still closes. **A lane may set its own
`mirror` axis**; without one it uses the map's `MIRROR`. Row 2 runs right to
left and ends where row 3 begins; row 3 runs left to right and ends at 37.85;
row 4 runs right to left **from there**, which is what `r4`'s `mirror: 54.40`
is for. `BAND_X` gives each band its own length rather than all four sharing
one — a band is as long as its row.

If you re-space row 3, check the turn at both ends: the connector from row 2
into `FQ` and the one from `FD` into `s1` are the only two places the snake
can silently come apart.

## Carried in: each row opens with what it inherits

No track runs between rows. That is right — they are stacked in the order
things happen — but *"already said by the layout"* does a lot of work at the
**left edge** of a row, which is where a reader's eye lands first and is
furthest from the thing the row above ended with.

So each row after the first opens with the object it inherits, drawn again:
`carried:"<id>"` in `CARRIED`, expanded into `NODES` before anything else looks
at them, so the lane engine, the index, the occlusion clip and Edit positions
all see an ordinary node.

**The failure this can produce is a reader counting two of something.** There
is one unfiltered matrix on this map and it appears twice, and four rules keep
those from contradicting each other:

- **Same object.** Shape, size and name come from the source. A clone that has
  drifted from what it clones is a second claim.
- **Full weight**, and this is the reverse of where it started. They were
  faded once, on the reasoning that a restatement should not be mistaken for a
  second object. Faded, they stopped reading as objects at all: the track
  leaving one and the dots on that track looked like they came from nowhere,
  because the thing they came from was a ghost. **An object a row inherits is
  the most solid thing on that row, not the least.** What says "restatement" is
  where it sits and what the reader says about it.
- **Wired like anything else.** A track out of it into the first step of its
  row, with dots on it. It is the object the row acts on; a row whose opening
  object connects to nothing is a row that starts twice.
- **No prose.** It holds no `does` of its own; the reader shows the source's
  and says plainly why the object is here twice.
- **Not a step.** Absent from the index and the arrow-key walk.

`check-carried.mjs` asserts all four. Note the `el()` trap it exposed:
`el(tag, attrs)` writes **every** key it is handed, so `opacity: null` lands as
the literal string `"null"`. Set an optional attribute after creation.

## A track runs wall to wall, not centre to centre

The occlusion clip punches every object's silhouette out of the edge layer, so
any part of a track **inside its own two objects is not drawn** — and a dot
travelling that part is invisible.

Authored centre to centre this was a sliver at each end and nobody noticed.
Then row 4 got 4.2-unit culls beside 2.5-unit matrices and the arithmetic
turned over: from the unfiltered matrix to the knee is 5.1 units of which 3.35
are inside one building or the other. **Two thirds of that track was clipped**,
so the dot on it was invisible for two thirds of its journey and the two
objects read as unconnected. The track was always there; you could not see it
move.

`portOut()` pulls each end back to the object's own wall before anything is
projected, leaving `PORT` between the wall and the line so a track reads as
arriving at a building rather than growing out of it.

`check-carried.mjs` asserts **both halves separately**, because they fail for
different reasons: the *layout* (enough open run between the two walls) and the
*routing* (the drawn polyline's first point is not the node's own centre).
Reverting the routing leaves the layout untouched and buries the track anyway,
so the layout check alone would not have caught it — measured, after writing
only the first one.

**The bar is an absolute length, not a share.** A share fails half of row 1,
whose objects are packed close on purpose and have always been fine. What a
reader needs is enough visible line for a dot to read as travelling, and that
is a length.

## `even` lanes

The lane engine's default is a **major/minor rule**: a landmark gets room to
stand clear of the cluster either side of it. That is right on a row that is
mostly small steps with two big things in it — rows 1 and 2. On a row whose
objects are all comparable it does the opposite: it invents a rhythm out of
nothing and the row reads as clustered when nothing about it is.

`even:true` on a lane says **the spacing carries no meaning here** — make every
gap the same. Rows 3, 4 and 5 use it, and their spans are set so the run sits
centred in the dotted band under it with the same margin at each end.

**A node's own `gap` still overrides `even`**, which is the one way this can be
true in the data and false on screen. `check-rows.mjs` therefore *measures* the
gaps rather than trusting the flag, and checks the run is centred in its mat: a
row hard against one end of its own band reads as having slipped.

## Select many

Turn it on inside Edit positions, click objects to gather them, drag any one
and **the whole set moves by the same world delta**. Nothing is scaled and
nothing is re-spaced; the set keeps its own arrangement exactly, which is the
only reason to move things together rather than in turn.

**Quantise the delta, never the result.** `r2()` on each member's new position
rounds every one of them independently, and the lane engine does not put
objects on tidy coordinates — so three objects moved by one drag came out 0.005
apart from each other. Small, compounding, and precisely the thing the tool
exists to prevent. `check-multi.mjs` compares the members' deltas **to each
other** at a tolerance of 0.001, which is the assertion that matters; comparing
them to zero would have passed that bug.

**It is a mode, not a modifier key.** Shift-click is the obvious answer and is
wrong here: Edit positions is driven by pointer capture with `preventDefault`
on pointerdown, so the browser's own notion of a click never arrives and a
modifier would have to be read off the pointer event and carried across a
capture. A mode is one boolean and it is visible in the toolbar, which matters
more — a selection you did not know you were building is a selection you will
move by accident.

A press that does not travel **toggles membership**; in this mode it does not
offer a ✕, because the two would fight over one gesture. Dragging something
outside the set clears the set and drags that one alone — and that clearing
happens on the first travel, **not on pointerdown**, because on pointerdown a
press is still ambiguous. Doing it there emptied the set on every click, so
only ever one thing could be gathered.

The set is a way of moving, not a thing that is saved: every member writes its
own `dx`/`dy` like any other drag.

## The grid is the paper, and the ruler is gone

`GRID` has to be bigger than everything drawn on it. The map has outgrown it
twice — when row 3's culls went to 4.2 units each, and when that row split in
two — and **neither time did anything else look wrong**, because the fit camera
measures the *content* and quietly framed a drawing with no paper under half of
it. `check-rows.mjs` asserts the coverage now. Extending it costs nothing but
the lines, so the bounds are deliberately generous.

**The coordinate ruler is gone**, along with its button. It was numbers along
the two outer edges so any position could be named in the same x and y the data
file is authored in — a working tool for placing objects by hand. Edit
positions replaced that job: you drag a thing and the offset is written down
for you. `gAxis` is kept as an empty layer rather than removed, because the
layer order is the z order and renumbering it moves something else by accident.

**Pause motion is gone too, and the machinery is not.** `playing`,
`setMotion()` and `MOTION_MIN` all still run: the map still stops for
`prefers-reduced-motion` and still stops below the zoom where a chart is
smaller than a postage stamp. What replaced the button is the **M key**, and
that is not a detail to drop — without it a reader whose browser asks for
reduced motion gets a still map and never learns that four of the culls draw
their own decision. The hint says so whenever motion is off.

## Edit positions: deleting, and the floating labels

**A double press picks an object and offers a ✕.** It is deliberately *not* a
`dblclick` listener, and that is worth knowing before you "fix" it: this mode
is built on pointer capture and `begin()` calls `preventDefault()` on
pointerdown to stop the drag becoming a text selection. **preventDefault on
pointerdown suppresses the whole compatibility mouse-event chain — `click` and
`dblclick` included** — so a `dblclick` handler on a node group in this mode
never fires once. It looks right, it is wired to the right element, and it is
dead. The double press is measured from the presses instead: a press that did
not travel is a candidate, and two on the same target inside 420ms is a double
click.

**Deleting asks.** Everything else in this mode undoes itself by dragging
back; this does not, and the saved state is shared, so a mis-click would take
an object off the map for everybody. The ✕ is an HTML button in the stage, not
an SVG one — it must not shear with the projection, and it must not live inside
the group it is offering to delete, because a control that vanishes with its
own target cannot be pressed a second time. It rides the camera from the frame
loop.

**A deletion is `del:true` in the same table as the nudges**, and is applied
**before anything is laid out**: the lane solve, the edges, the index and the
occlusion clip all have to be computed over what is actually on the map.

**The floating labels drag one at a time.** UNDER-AMPLIFIED and OVER-AMPLIFIED
are two labels on one roof, and they name two different tails of the same
cloud, so where each can go depends on what is under it. They are not laid out
from world coordinates at all — their own shape re-places them every frame — so
what is draggable is `off`, a nudge the shape's placement is offset by. The
leader is recomputed from the moved text to the **unmoved** target, which is
the whole reason a label like this is worth being able to move.

**Save renders into the reader, so Save reveals the reader.** With it folded
away, pressing Save all changes did nothing anybody could see: the count, the
block to paste and the Confirm button were all drawn into a closed drawer. It
stays up afterwards — a save result is not a preview that should fold itself
back.

## The two culls that are not on a roof

`c2` (Depth floor) and `hx` (Sample demultiplex) are **off the lane, not
deleted**. Deleting them would have been the tidier edit and the wrong one:
every claim on them is researched, and the corpus is the reason this map
exists. What changed is their status, not their truth — one folds into the
knee, because a fitted transcript minimum *is* a depth floor and drawing both
would draw the same cut twice; the other applies only to hashed designs, and
the chemistry two rows up is combinatorial, where the barcode already is the
sample. They hang off the culls that absorb them, above the row.

## State of the data — generalised 2026-08-15 (second pass)

The map was reframed from "one run" to **the platonic pipeline**, with MiniFin kept
throughout as the worked example. General claims are sourced from the corpus at
`/data/datasets/zebrafish/` — nine dataset entries, seven with a full nine-section
provenance record under `<DATASET>/sources/README.md`, each ending in the same seven
cross-dataset provenance principles. Four of those principles are quoted in the
`pipeline-data.js` header and drive the row-3 and row-4 condition text.

Nineteen changes went in. The structural ones:

- **Four new nodes.** `G1` 3′ UTR handling and `G2` intron inclusion (row 3),
  `G3` sample demultiplex — a real cull stage the map was missing, which exists only
  for hashed designs — and `G4` label transfer, drawn as a ghost because it is the
  road this pipeline deliberately does not take.
- **The reference node was rewritten from one universe to four.** Same assembly,
  four different answers to "which genes exist": BBI Ensembl 99 + 500 bp 3′
  extension (32,031), Lawson v4.3.2 (36,250 names), plain Ensembl (32,520),
  Zebrahub's custom Zebrabow build (32,057 + 3 transgenes).
- **Every cull node now carries the corpus spread rather than one vendor's number** —
  and says why those numbers are not comparable. The mitochondrial node is the
  sharpest case: 25% / 15% / 10% / ~1% / none / one that matches zero genes.
- **Header stats, `<title>` and OVERVIEW** were re-pitched from MiniFin to the corpus.

Row-3/row-4 claims that changed on the evidence: reference release **cannot** be
inferred from the data (the zebrafish gene set is identical across Ensembl 99–114);
four of the seven external atlases are **label-transferred, not de novo called**; six
of seven ship **no ontology ids** (Zebrahub is the exception); the four-tier
`germ_layer / tissue / cell_type_broad / cell_type_sub` ladder is **inherited from
ZSCAPE's realized obs**, not invented; and ground truth **disagrees with itself** —
ZCL2 ships two published annotations of the same 143 clusters agreeing on cell type
only 113 times.

## State of the data — first pass, 2026-08-15

`pipeline-data.js` was rewritten end to end against the artefacts on the instance.
Every number now names its source in the file's header comment. The five open items
from the previous handoff resolved as follows.

1. **Cull counts.** Not wirable, and now marked as such rather than invented. The
   five stages are real — they are Parse Trailmaker's `1-classifier` …
   `5-doubletScores`, in that order, which is *not* the order the map used to draw.
   But Trailmaker emits per-sample **settings**, never per-stage tallies, the MiniFin
   settings file is not on this box (only MegaFin CP01's is), and the unfiltered
   matrix was never delivered. The nodes now carry the real per-sample threshold
   *ranges* and say plainly that no drop count exists. Related discovery: the
   delivered h5ad has cells down to 294 UMI, below split-pipe's own 670 knee, and its
   cell count is exactly split-pipe's `number_of_cells` — so Trailmaker's QC chain
   may never have been applied to what we were given. **Worth asking Parse.**
2. **The UNVERIFIED set.** A4–A7 are confirmed and dropped from the set: the 48-well
   format, 6 embryos per well, 1 µM single dose, 24→48 hpf window and 48 hpf fixed
   collection are all in the MegaFIN design spec, and the plate format is
   independently corroborated by split-pipe's own barcode-set description
   (`n141_R1_v3_8`, "96 barcodes, 48 wells; rows A-D, cols 1-12"). Still unverified,
   and now including library prep: `A1 A2 A3 A8 B9 C1 C2`.
3. **Plate format.** Resolved: **48-well, 6 embryos, 43 of 48 wells recovered.**
   MiniFin *is* the 100k design. `PL` and `R1p` are now `cols:12, rows:4`.
4. **Payloads.** `SNIPPETS` now serves real records — head-of-file rows from
   `minifin_filtered.h5ad`, real leaf briefings from `umap.json`, real concluded calls
   and real scores against the sealed key. Two payloads deliberately show nothing
   (`read`, `drop`) because nothing is what exists.
5. **`cond` fields.** Rewritten. Several previous claims were retired for lack of an
   artefact (the Echo cherry-picking sheet, the 512-shard / 3.19 TiB delivery, the
   hard-coded Scrublet 0.034, plate `ZEROSHOTCP01`, the missing Lawson bridge, the
   labelled `.h5ad`). One new defect was found and is now on the map: **every one of
   the 267 MiniFin prompts tells the model it is reading "ZSCAPE 48 hpf"** — the
   dataset name is hard-coded in the core prompt instead of coming from the adapter.

Two edits were made outside `pipeline-data.js`, both flagged rather than silent:

- `index.html` header stats — the FASTQ-shard and leaf figures were data, and two of
  them were wrong. Markup and CSS untouched.
- `pipeline-view.js` `inspect()` — the note under a payload was hard-coded to
  "Synthetic stand-in with the right shape". It now reads `s.note`, falling back to a
  real-data sentence. Label geometry and the gap constants were not touched.

## Adding a step

No coordinates needed. `layoutRows()` computes x positions from the row's contents;
the `x` values in `NODES` are seed order only. Side structures use `follow:{a,b}` to
sit at a node's x or midway between two.

## The copy payload

The Echo node (`P3`) carries a **Copy the shape source** button in its reader
panel. It puts a ~15 KB self-contained listing on the clipboard: the
projection, the shared plate vocabulary, `drawEchoDispense` itself, the node
that feeds it, and the shape contract — for handing to somebody, or something,
learning to draw in this style.

**The payload is generated, never hand-written.**

```bash
node sync-copy-payload.mjs      # no dependencies
```

It lifts each function and constant out of `pipeline-iso.js` and
`pipeline-shapes.js` **by name**, syntax-checks the result with `node --check`,
and rewrites the block in `index.html` between the `BEGIN copy-ECHO` /
`END copy-ECHO` markers. Re-run it after touching `drawEchoDispense`, the
projection, or the plate helpers. A hand-copied listing drifts from the code it
claims to be the moment either is edited, and a teaching example that is subtly
not the real thing is worse than none.

Three things about how it is wired, each with a reason:

- **The payload lives in a `text/plain` block in `index.html`, not in a JS
  string.** What it holds is source code — backticks, `${...}`, the lot — and
  escaping several hundred lines of that into a template literal is a bug
  waiting to happen. `textContent` gives it back byte for byte. The generator
  refuses to write a payload containing a closing script tag, and **no comment
  anywhere should contain one either** — it would terminate the block early and
  break the page silently.
- **The click handler is delegated on `#read`.** `renderNode` replaces
  `read.innerHTML` wholesale, so a handler bound to the button goes with it on
  the next hover.
- **`navigator.clipboard` has a fallback.** The async API needs a secure context
  and permission, and fails on `http://` and inside some embeds. The deprecated
  textarea + `execCommand` path stays as the fallback; if both fail the button
  says so and selects the text so it can be copied by hand.

Any node can have one: set `copy:"<element id>"` and optionally
`copyLabel:"..."`. If the named block is absent the button is simply not
rendered, so a missing payload never leaves a dead control behind.

## The shape contract

```js
DRAW.myShape = (g, n) => { /* append SVG to g */ };
```

- reads only `n.x n.y n.w n.d n.h` plus its own custom fields
- knows nothing about neighbours, rows, or the map
- colours are **always** `var(--token)`, never a hex literal, or light mode breaks
- anything that moves pushes to `TICKERS`; never `setInterval`, never a second rAF loop
- a node opts in with `shape:"myShape"`

`shape-sandbox.html` renders one shape large and centred with the ticker loop running,
at `/pipeline/shape-sandbox.html`. It loads **only** iso + shapes — if a shape needs
anything from data.js, the contract is broken.

`build.sh` inlines all four into `pipeline-standalone.html` for preview or iframe
embedding. It is a build artefact — never edit it, regenerate it.

## Please do not

- **Inline these back into one file.** That is the entire point of the split.
- **Replace the hand-rolled isometric projection with a library.** Everything —
  layout, label angles, painter ordering, camera — derives from `P()`. Swapping it
  is not a refactor, it is a rewrite.
- **Reformat, minify, or convert to a framework.** Line-level diffs need to stay
  readable across two authors.
- **Change label geometry in `pipeline-view.js`.** The three orientations (+30° flow,
  −30° naming, edge-centred emission) were arrived at over many iterations and the
  clearances are tuned to the layout gap constants.
- **Touch `MIRROR`, `ROWS`, `GAP_MINOR`, `GAP_MAJOR`** unless a row genuinely
  overflows. They interact.

## Notes for integration

- Everything is inside `.app`, full-height via `100dvh`. Under 900px the index
  collapses behind the Stages button and the reader moves below the canvas.
- Dark is default; `document.body.classList.add("light")` flips the whole SVG,
  because every colour is a CSS variable.
- `prefers-reduced-motion` pauses the dots on load.
- No storage, no network, no analytics. Safe to iframe.
