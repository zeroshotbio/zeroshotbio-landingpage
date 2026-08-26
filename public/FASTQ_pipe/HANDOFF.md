# /FASTQ_pipe — contract and ownership

A self-contained static page in `public/FASTQ_pipe/`: `index.html` plus four
classic scripts, no build step, no dependencies, no CDN. Served by a Next
rewrite (`next.config.js`) with no-cache headers, exactly like `/pipeline`,
`/data_structures` and `/bioinformatics_pipe`.

`<script src>` attributes are **absolute** (`/FASTQ_pipe/fq-iso.js`) because
the route has no trailing slash — relative paths resolve against `/` and 404.

## What this page is

**The FASTQ-to-matrix half of row 3 of `/pipeline`.**

On the big map the four rows are named *Biological samples*, *Molecular
biology*, **Bioinformatics pipeline** and *Opinionated metadata*. The third
runs FASTQ → counting stack → unfiltered matrix → six culls → filtered matrix.
This page is the **first** half of it: everything between the reads and the
first cube, and nothing after them.

**`/bioinformatics_pipe` is the second half**, and the two meet at the same
object: `UD`, the unfiltered matrix, drawn on both from the same `drawMatrix`
with the same sparsity seed. A cube that looked different on the two maps would
be telling a reader they were looking at two different things.

## IT IS NOT A CHAIN. One fork and two separate joins.

```
   G1 GRCz11 ──┐
               ├──→ G3a STAR index ──┐
   G2 Ensembl ─┘                     │   (and G1b/G2b → G3b, the second arm)
                                     ↓
                               E4 align R1 ──→ E5 assign to gene ──┐
                                     ↑                             │
   E1 pool ──→ E2 fragment ──────────┤                             ├──→ E6 dedup ──→ E7 unfiltered DGE
                                     ↓                             │
                               E3 match R2 barcodes ───────────────┘
                                     ↑
   W1 whitelists ────────────────────┘
```

**The fork is at E2**, which is why the fragment is a node and not an arrow:
one molecule sequenced from both ends, R1 to the genome and R2 to the
whitelists, and everything downstream is two independent problems until they
meet again. **Two edges leave E2 and they do not rejoin until E6.**

### They are two lanes, and each leaves from its own end of the glyph

The fragment already puts the cDNA at its left end and the barcodes at its
right, so each outbound edge is **ported** to the end it belongs to — `port:"L"`
and `port:"R"` on the edge, resolved through `PORTS[shape]` in `fq-shapes.js`.
Two edges leaving one node from the same place are two edges nobody can tell
apart. Each lane is then **tinted** with the token that half of the molecule
already wears — `--cull` for R1, `--accent` for R2 — so both journeys are
followable with no labels at all. No new colour: those are two the page has.

**The two bracket names read at the map's angle and stand at the outer end of
their own bracket.** Everything else in the glyph is square to the reader
because it is a diagram of a molecule; those two are not labels on the diagram,
they name the two tracks, which are map objects. So they take the map's
typography (−30°, like every other name on the page) and stand where their
track departs — the line emerges from under its own name.

**Which side each lane sits on is not a free choice.** A track has to leave
toward its own lane rather than back across the drawing it came from, and
screen-left of the glyph is *below* the row in world terms — so **R1 goes below
the spine and R2 above**. The spine between the fragment and the join carries
nothing, so the two are adjacent with only empty ground between them.

**The asymmetry is the point and must not be tidied.** R1 makes two stops, sits
further from the spine, consumes the genome lane, differs per arm, and can fail
— unmapped, multimapping, ambiguous. R2 makes one stop, consumes the
whitelists, is deterministic, and is identical across arms; it finishes early
and runs straight to the join while R1 is still working. **Equal lanes would be
a lie about the pipeline.**

A ported route is two segments and no elbow: the port, a run down to the
destination's lane joining it `PORT_LEAD` (2.0 world units) before the first
stop, then along the lane. **`E2` carries `noclip:true`** — the glyph is a flat
diagram floating in the air, not a solid, so nothing hides behind it; punch its
box out of the occlusion clip and both departures vanish at their own ends.

**Both lanes run straight into E6** (`straight:true` on the last leg of each).
The elbow route puts a Z in that leg, and a Z at the moment two things converge
reads as two things being nudged together rather than as two things arriving.
**All four reference edges are `straight:true` too**, for the same reason: the
whole content of one is "this feeds that", and a Z reads as a detour the thing
actually takes.

**E6 has two inbound edges and must look like it.** The gene identity comes down
one branch and the cell identity up the other, and neither alone is a count — a
gene with no cell is a read pile, a cell with no gene is an empty row. That
convergence is the point of the segment.

### Three lanes, and they are not the same kind of thing

| Lane | What it is | Behaviour |
|---|---|---|
| **E · reads** | sample material | flows once, per run, consumed |
| **G · genome** | reference, chosen | built once, reused forever |
| **W · whitelists** | reference, chosen | fixed by the kit, reused forever |

G and W are the same class as *The compounds* in the wet-lab half of
`/pipeline` — a catalogue someone selected from, arriving from outside the
experiment — and they sit off to the side for the same reason.

**What marks them is the SKIN, not the edge.** Reference *nodes* wear
`SKIN.works` where the stations wear `SKIN.tile`.

Their edges were drawn `still:true` for a while — connected, dashed, dimmer,
never given a dot — on the argument that a STAR index is built once and reused
forever, so animating material down it every run asserts a per-sample cost that
does not exist. **True, and it cost more than it was worth.** A dashed line
nothing moves along reads as a footnote, and these are not footnotes: the
reference is the single largest source of incomparability between two zebrafish
atlases, and the whitelists are what a barcode *means*.

So they are proper lines with dots, in a **neutral grey** (`--fg2`) that is
neither read's colour — the fork owns orange and blue and nothing else on the
map may borrow them. **The `still` mechanism is still in `paintEdge` and the
DOTS block and nothing uses it**; it is one branch each and it is the right
answer for a genuinely inert edge, if this map ever grows one.

### One index is drawn, because one is what this run used

`G1 · GRCz11` and `G2 · Ensembl 99` are **two nodes, not one** — two files, two
independent choices — and `G3 · STAR index` is built from them *together*, the
annotation baked in at index time rather than applied afterward.

A second arm exists: **GRCz12tu with Ensembl 2025_12**, staged rather than in
use, documented stage by stage at `/grcz12`. **It is deliberately not on this
map.** Two indexes mean two of everything from the alignment onward, and a map
that draws a second arm nothing has been counted against is claiming a result
that does not exist yet.

**If it is ever run, the branch goes back the way it was drawn before**, and
that shape is worth keeping: two *pairs* (`G1/G2 → G3a`, `G1b/G2b → G3b`)
rather than one genome with two annotations, because the arms differ in **both**
files. Each arm is a horizontal triple — a source at
`(index.x − 1.4, index.y + 1.4)` lands 102px directly *left* of its index on
screen and at the same height, `(+1.4, −1.4)` directly right — so every index is
flanked by its own two files and no dashed line crosses another. **Check the
screen order, which is `(x − y)`, not the world x:** the first attempt spread
the four sources along one lane and the arms interleaved on screen even though
they did not in world coordinates. And every station from `E4` on takes a
`tag:"× 2 ARMS"`, the landmark included — the tag was once drawn only on plain
nodes, so the matrix rendered as one bare cube while everything feeding it said
`× 2`, which reads as the branch collapsing back into one object.

### Nothing in this segment is a cull

Reads are set aside — a quarter carry no valid barcode combination and never
reach the alignment, multimappers and unmapped reads are dropped after it — but
**no cell is ever removed here**, and the matrix at the end is deliberately,
uselessly complete. `n.hatch` still means *this stage destroys data* and five
nodes carry it; the index column says **"drops"**, never "cull". The culls are
the D lane, at `/bioinformatics_pipe`.

Same isometric world as its three siblings — same projection, shell, reader,
index, theme switch — because it is the same map at a different scale, not a
different map about the same subject.

## Every node is lifted, not re-typed

The `does` / `built` / `cond` fields in `fq-data.js` come from
`pipeline-data.js`, node for node:

```
FQ  → FQ  (③ FASTQ)             E3  → cb1 (Barcode calling)
E4  → cb2 (Alignment)           E5  → IN  (Intron inclusion)
E6  → cb3 (UMI collapse)        G3a → E   (The counting reference)
UD  → UD  (④ Unfiltered matrix)
```

**The matrix keeps the id `UD`,** not `E7`, and that is load-bearing:
`drawMatrix` seeds its sparsity off `n.id==="UD"`, and this cube has to be the
same object as the one `/bioinformatics_pipe` draws. `key:"E7"` is what shows on
the map. The rest of the ids follow the spec.

That is the whole point. Two hand-maintained accounts of one pipeline drift,
and the drift is invisible until someone quotes the wrong one. If a claim
changes, **change it on `/pipeline` and lift it again** — do not edit the prose
here.

Same for the payloads: `REAL_CELLS`, `REAL_GENES`, `REAL_REFS`, `REAL_SUBLIBS`
and the `read` / `ref` / `cell` snippets are the same records travelling the
same edges.

**Not every node has a source.** `/pipeline` has no node for the fragment, the
whitelists, or the second annotation arm, so `E2`, `W1`, `G1`, `G2`, `G1b`,
`G2b` and `G3b` are **authored here in full** — `does` / `built` / `cond`
included. Every other node's body is lifted. If a lifted node is ever given
authored prose in those three fields the guarantee is gone, so put new writing
in `added:`.

### What is authored here, and what is lifted

Three fields per lifted station are authored on this page. Everything else is
lifted byte-for-byte.

- **`name` and `sub`.** Five of the eight are named differently from
  `/pipeline` and that is not drift. The big map carries the name the whole
  corpus uses for a stage — "Intron inclusion" names the *flag*, because the
  flag is the part nobody records — while this page names the single operation
  it draws. `pipelineName` carries the original through to the reader so the
  two can still be matched up.
- **`added`.** Anything this page says for itself, rendered under its own
  heading (*Drawn here*) so a reader can tell which map is talking.

Geometry is also overridden — the stations are 1.9 units square where they are
0.68 on the big map — but that is dimensional, never prose.

### The lane is the spine, not the map

Only the four nodes every read passes through in order are on lane `r3`: the
pool, the fragment, the deduplication, the matrix. Everything else is a
`follow{}` side structure taking its x from one of them and keeping its own y —
which is what makes the fork a fork, with the two branches the same distance
above and below the spine.

`E6` carries `gap:9` so the whole fork fits in the span before it. The engine
scales every gap to fill the lane, so that is a **ratio** against the others
rather than a distance: re-space the lane and the fork keeps its share.

`follow{}` targets resolve in **array order**, so a node must appear after the
one it follows. Every `G*` follows `E4` directly rather than chaining through
`G3a`, which is what lets the index sit in reading order.

## NOTHING ON THIS PAGE IS MODELLED

That is the sharpest difference from `/bioinformatics_pipe`, and it is a fact
about the stretch rather than a virtue of the page. Every threshold on that
map's four roofs is computed at load from a seeded population, because none of
those culls has a shipping policy with a single drawable number behind it.

Here there is nothing to invent. Every figure quoted is read off an artefact —
the vendor's own `analysis_summary.csv`, the delivered `var`, the corpus
provenance records for the four counting references. The one policy number on
the page is the **10-transcript floor** at the matrix build, and it is a
formatting decision about what is worth a row rather than a claim about what is
a cell.

So this page **loads no `/culls/` files and derives no statistics.** If a roof
chart ever lands on this row, load `culls-pop.js` and `culls-draw.js` the way
`index.html` on the other map does, and put `MODEL`, `ANNOTATIONS` and
`FIGURES` back in the `requires()` table at the top of `fq-view.js`.

**`roofFrame()` has been lifted into `fq-iso.js`,** verbatim from
`culls-draw.js`. It is projection rather than subject matter, and that is where
this page's own header always claimed it lived. Nothing calls it today — the
same footing `ellipseAt` is on — and it stays for the next flat thing that does
want to lie on a roof. It was *not* there before, and nothing noticed, because **`requires()` cannot see
a missing `const`** — its fallback test is
`typeof eval("typeof sym") === "undefined"`, and `eval` returns the *string*
`"undefined"`, whose typeof is `"string"`. The condition can never be true. The
same block is in three maps; it is documented at the top of `fq-view.js` and
should be fixed in all three together rather than here in passing.

**Do not add a MODELLED badge to anything here without a model behind it.** The
badge machinery is intact (`modelled:true` on a node) precisely so that a
future invented figure carries the word; an unbacked badge is worse than none.

## Hatching

`n.hatch` means **the stage destroys data**, exactly as on `/pipeline`. Five of
the six carry it. The exception is the **genome index**: it decides what can be
found and throws nothing away.

The index column reads **"drops"**, not "cull" — these are not culls, and the
neighbouring map's word would import a claim this page does not make. The
largest deletion here is the first one: 24.3% of reads carry no valid barcode
combination and leave at the barcode parse, before anything has been aligned,
with no record of which ones.

## The genome index stands in the row, and it is the one station no read passes through

On `/pipeline` the counting reference is a **side structure**, hanging below
row 3 on a `follow{}` between barcode calling and alignment, because it is not
a step. Here it is drawn in the row's own order, where it is consumed.

That is a deliberate simplification and the node says so in its own *Drawn
here* paragraph. If it ever reads as a false claim — that reads flow *through*
the index — the fix is a `follow{}` and an edge of kind `ref`, not a change of
prose.

## `drawReads` — the one shape this page has of its own

`drawTile`, `drawHeap` and `drawMatrix` are verbatim from
`pipeline-shapes.js`, down to the seed `drawMatrix` uses for its sparsity.
`drawHeap` has no user today — the FASTQ landmark is `drawReads` — and stays
because the shapes file is the shared vocabulary, not a list of what is on
screen this week.

The FASTQ landmark is **a swarming pool, and one fragment opened up.** It is a
port of a canvas drawing into this map's own idiom; what follows is what the
port had to decide.

**The fragment is drawn in its own order, not in R2's order.** BC1 sits nearest
the cDNA because reverse transcription attached it first; each ligation round
adds the next one further out; the UMI rides on the round-3 oligo at the far
end. R2 sequences inward from that end — which is why it meets the UMI first
and reaches round 1 last. Draw the molecule truthfully and the reversal
explains itself. **Do not reorder the fragment to match the read.**

**The diagram is turned to the map's diagonal, and that is a *rotation* rather
than a shear.** Level, it was the one horizontal thing on a page where every
other line runs at 30°, and it read as pasted on. Turned −30° it lies along the
**world Y axis** — the same line the step names and the band title read at —
while staying a rigid, undistorted drawing of a molecule.

That is the difference from lying it on the ground plane, which is what
`roofFrame()` would do: **a roof shears its contents and a circle on it becomes
an ellipse. This does not.** It is square to the reader, just not level with the
reader. So the shape still does not call `roofFrame()` — there is no surface to
lie on and no shear to take.

And the turn puts the molecule's own axis on the two lanes: the cDNA end points
down-left, which is where R1 goes, and the barcode end up-right, which is where
R2 goes. The departures stopped needing an explanation.

Everything inside is laid out **level** and the group carries one `rotate()`, so
the arithmetic in `fragGeom()` is still the arithmetic of a flat strip.
`F.rot()` is for the two callers that need a *final* screen point — the ports,
and the pool's leaders — because those live outside the rotated group. An
earlier build painted the diagram on a rectangular pad, which was a solid
claiming the reads sit somewhere; that is what `plinth:false` and this rotation
between them replaced.

The pool is drawn in screen space too, so a read stays a straight line of even
weight however the ball turns.

**The arrowheads sit 15% in from the ends they point at.** On the end an arrow
reads as a terminus — the place the read stops — and it means the opposite: the
direction the read travels.

**The two brackets hang UNDERNEATH, below even the barcode names, and the
unsequenced middle is called out from above.** That is not symmetry for its own
sake: the tracks leave from the bracket ends, so the brackets have to be on the
side the tracks go, and everything that leaves this glyph leaves downward. The
one label that names an *absence* is the one thing pointing back *into* the
molecule, from the other side.

**The ports are the MIDDLE of each bracket.** At the end, a track left from
under its own name and the two overlapped; from the middle the name has the end
to itself and the line has clear air. The spans are computed in `fragGeom()`
rather than in `drawFragment()` for exactly that reason — **a port that works
out its own idea of the layout drifts off the drawing the first time a width
changes.** The pool's leaders still aim at the *bar* ends: the magnification
points at the molecule, not at the brackets.

**Nothing leaves this glyph at the moment.** The `E2 -> E3` edge and its dots are
gone: it is a measured diagram of a molecule, and a track running out of it turns
it back into a station on a route. `PORTS.fragment` stays because it is correct
and is what the edge will leave from when it returns; the chain starts at `E3`
until then.

### The widths are base pairs, measured, and two of them were telling a story

`FRAG[].w` is **bp**, not a schematic weight. The numbers came off MegaFin 1's
own FASTQs rather than a config, because no run folder and no split-pipe config
for that run exist on this instance:

```
R1  64 bp   the cDNA insert
R2  58 bp   UMI[0:10] bc3[10:18] bc2[30:38] bc1[50:58]
            -> UMI 10, three barcodes of 8, two linkers of 12   (= 58)
```

Two proportions were wrong before and **both were wrong in the same direction**.
R2 was drawn *longer* than R1; it is shorter, and the two are nearly equal. And
the linkers were drawn at twice a barcode when they are one and a half times it.
Together they made read 2 look like a long spacer with small marks on it, when
the barcodes are most of what read 2 is.

The order stays the **molecule's**, not R2's — BC1 nearest the cDNA because
reverse transcription attached it first, the UMI on the round-3 oligo at the far
end. R2 reads inward from that end, which is why it meets the UMI first. Drawn
truthfully, the reversal explains itself.

**The gap is the one entry whose `w` is not a length**, and the one segment with
no figure under it. Insert size varies per fragment and nothing sequences the
span between the two reads, so there is no number to draw and none is drawn.
That silence is the honest statement and nothing is allowed to fill it.

The figures themselves are meant to be **found rather than read**: bare numbers
in `--fg3` under read 2's six segments (no unit — the `58 bp` under the bracket
has given it), and the two read lengths in neutral ink centred under their own
brackets, the name at the outer end saying *which* read. Six segment figures
that add to 58: the drawing can be checked against itself.

**The ball is a real ball.** The reads are placed uniformly through a sphere —
direction on the sphere, radius by cube root, because a uniform radius piles
the population into the centre — in *world* coordinates, turned by a real
rotation, and projected through `P()` like everything else. Depth is the map's
own depth: what is nearer the eye is what has the greater `x + y`, the key
everything else on the page is sorted by.

**One origin, taken once, and everything is an offset from it.** The pool and
the diagram are one object and have to move as one. The first version projected
`n.x + offset` for every read every frame while the diagram was drawn once from
`n.x` and left alone — so a drag moved the pool *twice*, through the group's own
translate and again through the recomputed projection, and the two halves came
apart under the cursor. **Nothing in the shape reads `n.x` or `n.y` after the
line that takes `[X0,Y0]`.** The group translate the editor applies is then the
only thing that moves either half.

**A sphere projects to an ellipse, and the clearance is measured against the
ellipse.** The image of a vector `(a,b,c)` is
`((a−b)·S·C30, (a+b)·S/2 − c·S·CZ)`, so the silhouette's vertical semi-axis is
`RB·hypot(S/2, S/2, S·CZ)` — bigger than `RB·S·CZ`, and using the radius instead
tucks the pool's lower edge into the diagram.

**The pool sits up and to the left**, far enough left that the node's name —
which leaves the far corner up and to the *right* — passes clear of it. Move one
and check the other.

**`n.h` is not the height of any object**; it is where the name hangs, and the
box the silhouette and the drag handle are cut from. Nothing on this node is a
solid, so there is nothing else for it to mean.

**No plinth.** `plinth:false` on the node. The dashed ground patch under a
landmark says "this object stands here", which is true of the matrix cube and
untrue of this one — drawn anyway it was an empty dashed square under the whole
visual with a track running across it, which is exactly what it looked like: a
footprint left by something that has gone. The name is not optional and is drawn
either way.

**The node's box is laid down as a transparent silhouette, first, behind
everything.** Painted, so it takes pointer events; invisible, so it draws
nothing. Without it a node with no solid at the projected centre of its own
footprint cannot be clicked there — which is where a person aims and where
`check-clicks.mjs` presses.

**Colour: the original had five hues, this map has three tokens and a rule
against a fourth.** cDNA is `--keep`, the barcodes are `--accent`, and the
distinction the tokens cannot carry is made by **encoding** instead — the UMI
is the same accent as a barcode, drawn as an *outline* rather than a fill,
because it is the one tag on the molecule that is not a barcode. That is the
rule the palette section states: a new distinction needs a different encoding,
not a different colour.

**The leaders are a magnification frustum, not a pointer** — two of them, from
the ring's shoulders to the two ends of the diagram, heavy enough to read as
structure rather than as a stray hairline, and **grey**. They say "this fragment
is that read, magnified". Nothing travels them and nothing is routed along them,
so they take neither read colour: those belong to the tracks, which start at the
glyph. Tinting them made the pool look like the head of two pipelines, and it is
the head of neither.

**There is no track between the pool and the fragment, and none into the pool.**
A track with dots means material moving from one object to another, and neither
is happening: the fragment is not somewhere the reads *go*, it is one of them
drawn larger, and the leaders already say so. Nothing arrives at the pool
either — the run is upstream, on `/pipeline`, and the page opens on the reads
rather than fetching them. **Which means the first track on this map is the
fork**, and that is correct: the first thing that actually moves is a read
leaving for its own lane.

**380 reads is 760 line segments a frame.** Each depth bucket is one `<path>`
whose `d` is a run of subpaths, rebuilt as a single string and written with one
`setAttribute` — `pool()` on the other map, same idea. Alpha and weight vary by
having four buckets, not by having 760 attributes. The hero is drawn as itself,
because there is one of it.

### The hero is marked, not lit

There was a candle here for a build — a depth-sorted halo, moths crossing in
front of the light. It worked, and it is out: **a light source is a claim about
a physical scene, and this is a diagram of a file.**

What stands instead is what the drawing said in the first place. The hero is
**geometrically identical to every other read** — same length, same weight, same
wander — and only its colour and its ring say it is the one. The ring now does
that work harder: brighter, heavier, and with a second faint ring outside it,
which reads as a mark *on a drawing* rather than as a glow. The rest of the pool
is a shade dimmer to let the two coloured halves carry.

The hero is drawn **last and stays on top**. It is the subject and both leaders
point at it; a subject you can lose behind the crowd is one the reader has to
hunt for.

### It was a pill for a while, and it is a ball again

The stretch is gone, and it is gone from the code rather than set to 1. A pool
is a **population**, not a shape with an axis; giving it a long axis along world
y implied an ordering in the molecule's own direction that a bag of unsorted
reads does not have. `n.w` and `n.d` are back to equal (5.1) and the count is
back to 380 — density was what the 620 was holding constant, and the volume
went back with the shape.

Worth recording why the removal touched three lines and not one. The stretch was
applied **after** the turn (stretching the source points instead makes the pill
tumble end over end — a rotating capsule rather than a still one with a crowd
inside it), which meant the depth key had to be taken after it too. A spare
multiply left in the hot loop is a spare thing to get wrong the next time
somebody edits this, so `RBY` is gone and `dep` divides by `RB*2` again.

**The population is built once, at load, from a fixed seed**, so the pool is the
same pool in every browser and the hero is the same read. A swarm that
reshuffles on refresh is a decoration; this one is a drawing of an object.

**It registers one ticker and never its own `requestAnimationFrame`.** A ticker
inherits Pause motion and `prefers-reduced-motion` for free, and one that throws
is dropped without taking the map with it.

## `drawBelts` — the alignment as a machine

**The index is not a step reads pass through, it is a surface they land on**,
and that is why this station is drawn rather than labelled. Four belts run along
the lane's own direction carrying annotated gene models past — exons standing
proud, introns flat between them — and the reads fly in from up-belt, chase a
moving target, drop onto it, and then **ride along** with the gene until it goes.

**Everything shares one velocity**: slats, genes and landed reads. That is what
makes it a machine rather than three animations in a trench coat.

**The aggregate is the argument.** Every read lands on an exon and none on an
intron. One worked example is a fact about that read; three hundred of them is a
fact about the *annotation* — the half of the index the assembly cannot supply,
and the reason `G1` and `G2` are two nodes rather than one. A few cannot land in
one piece: they came from spliced mRNA and cover the end of one exon and the
start of the next, so they arrive as two halves with an arc between them that
never touches down over the intron. Those are the reads the sequence alone could
not place.

**The reads are `--cull`, R1's own colour** — the same the track into this
station carries and the same the cDNA block wears in the fragment, so the trail
does not break at the moment it lands. **The spliced reads are that colour too:**
a distinction the palette has no token left for, made by *encoding* instead. Two
halves and an arc is unmistakable, and a fourth hue would say "a different kind
of read" when it is the same read.

### The ladder, dark to light: track, gene body, exon, read

**Each rung is a step, and the reads are the top of it.** Everything below them
is there to be landed *on*, and the moment two rungs sit at the same brightness
the eye has to be *told* what to look at instead of being *shown*.

- **The track** is `--t-right`, barely above the ground, slats at a tenth. It
  was as solid as the genes riding it, so four belts competed with the sixteen
  gene models and three hundred reads that are the actual subject. It still
  carries the motion — the slats are what make it a belt — without asking to be
  looked at.
- **Every gene is the same tone, and it is the quiet one.** They alternated
  between two, which made every other model on the belt look like a different
  kind of object: the variation said something, and there was nothing for it to
  say.
- **The exons** are a rung above the gene body and no more. They were the light
  rung for a build, on the argument that a read needs a surface to look like it
  is landing on. It does — but a light one competed with the reads themselves,
  and the reads are the point.
- **The reads** are the only saturated thing in the frame, the only bright one,
  and **fully opaque**. They were drawn at 0.62 so they would sit *into* the
  surface rather than on it — the right instinct while the exons were bright and
  the wrong one now that they are not. They are the thing a viewer is meant to
  count; nothing is served by making them argue with the box underneath.

**No shadow under a read.** Every one carried a soft ellipse on the exon below
it, which is correct for an object in the air and wrong for three hundred of
them: at rest the drawing was a field of grey blobs with an orange line on each.
The reads still fall — the slant and the height are what make them arrive — they
just no longer leave a mark where they land.

**A box on a belt is three faces, not two.** It was top and the long near side,
on the reasoning that nothing on a belt is seen from its far side. True of the
far side and not of the **leading end**, which is square to the eye and was
simply missing: every exon read as an open trough with its front wall knocked
out. The eye is at +x +y, so top, the +y flank and the +x end are the three that
face it — exactly what `paint()` draws for a static box, done per frame instead.

**Every absolute length is scaled by the node.** The original was authored
against a fixed 9.2-unit span; `K` and `KZ` carry that onto whatever `w` and `h`
the editor leaves behind. `w` runs along the belts, `d` across all four, `h` is
the whole stack — base, gene body, exon — so `topOf(n)` is exactly the exon top
and a resize rescales the machine rather than stretching it. That is checked:
`check-edit` resizes this node and asserts the ticker count does not grow.

**`hatch:true` no longer draws anything here.** It still means *this stage
destroys data* and still puts "drops" in the index — multimappers and unmapped
reads are set aside — but `drawBelts` paints no faces for the pattern to go on.
The claim survives in the index and in the prose.

## `drawSortingYard` — matching as a place

Eight lanes of raw R2 fragments enter. Three reader gantries stand across them,
one per barcoding round, each holding its whitelist overhead. A fragment crosses
a gantry, that round's barcode is checked, and it **merges into the lane for
what it matched** — eight lanes become four, then two, then one. By the far end
the survivors are on a single trunk, which opens again into the distinct cell
identities the triplets actually name. **The funnel and the fan are the same
movement twice**: many things becoming one, and one validated thing standing for
many.

**The reject lane is drawn on purpose.** A picture where everything matches is a
picture of transport, not of matching. **The rate is tuned for legibility and is
much worse than a real run** — the dump lane has to be visibly busy to read at
all — and the node's own prose carries the real figure: 75.7% of reads carry a
valid barcode combination.

### The verdict pair — the one place this page adds a colour

The rule everywhere else is three tokens and no fourth: a new distinction gets a
new *encoding*, not a new hue. **The sorting yard is where that stops working.**
Both accents are spoken for — orange **is** R1 and blue **is** R2, the whole
length of the map — so a pass/fail inside R2's own station has nothing left to
borrow that would not also say *this is the other branch*. `--cull` was the
obvious choice for a reject and is the worst one available here.

So `:root` carries two more: **`--ok`** (green) and **`--rej`** (brown), defined
in both themes, **muted on purpose** — they answer a question, they do not
compete with the two tracks. Dim-versus-bright still carries the block and the
tick and cross still carry the verdict; the colour is what makes the verdict
readable from across the room, which is the one thing on this station a reader
is meant to take in at a glance.

**Nothing outside `drawSortingYard` may use them.** The bin and its *NO MATCH*
take `--rej`, the ticks and *VALIDATED TRIPLETS* take `--ok`, and the big
end-of-line tick takes `--ok` at well under full opacity: it is a confirmation,
not an announcement.

### The falling thing IS the fragment

`E4`'s reads fall as plain lines because a read at that station *is* a plain
line — a stretch of cDNA lying on a gene model. Here the object that matters is
the triplet: three blocks on a strand, exactly as it will look for the rest of
its run. So the fragment itself descends. There is no separate rain and no
moment where one thing becomes another, because **there is only ever one
object.** It slants in from up-line, drops, lands, and keeps going.

This costs nothing and buys two things. The fragments are built before the
gantries and DOM order is paint order, so a falling read passes *under* a
scanner for free — which the earlier stand-in rain, built after them, did not.
And the lap counter, the verdict clearing, the fail lane and the pack-up at the
hourglass all already exist on the fragment; a stand-in would have had to
duplicate the ones it needed and silently diverge on the ones it did not.

It is still the other half of a pair with `E4`: R1's reads fall onto gene models
and stay; R2's fall onto lanes and are carried off to be checked. That is the
difference between the two branches said twice, once on each station.

**The eight lanes run back past the yard's own `x0`** — because a fragment has
to have somewhere to land. It comes down onto bare track, runs a good way along
it, and only then reaches the first gantry. That run-in is the difference
between arriving and simply appearing. The deck is stretched back with them,
though at a tenth opacity nobody will ever notice.

**It is ONE polyline per lane.** The run-in was briefly drawn as its own
segment at lower opacity, and it read as a second set of tracks that happened to
meet the first — the join showed and the shading disagreed. Same call, same
opacity, `xIn` straight through to `fanX`.

`IN`, `PAD` and `LANDX` live in `YARD_ROUNDS` with everything else, in authored
units: the track starts at `IN`, a fragment is born at `PAD` (further back
still, and in the air — "further back" is a thing the *fall* does, not something
the track has to be lengthened for), and it touches down at `LANDX`, just past
the start of the track. So the landing happens ON the track with most of the
run still ahead of it, rather than a few units short of the first scanner.

### Where the R2 track lands, and why not at the obvious place

`E2 -> E3` used to aim at `E3`'s centre. The yard is 9.6 units long, so the line
ran the whole length of it to get there, and butted end to end with the
`E3 -> E6` line leaving the same centre: one blue rail crossing the entire
picture, which says the opposite of what a station is. Both are ported now —
`portB:"head"` in and `port:"tail"` out — so the blue stops at the yard and
starts again where the fan comes out.

**"head" is not the head of the run-in, and not the footprint edge either.**
Both were tried. It is `TRK` units along the lane, just inside the yard and
short of the first arch, for a reason that is pure projection: at this `y`,
every point within about a unit of the yard's left edge lies along −30° from the
R2 bracket — which is the angle the bracket itself is drawn at. Aimed there, the
track leaves its port and lies down exactly on top of the bracket and is
invisible. A point further along the lane puts the line near horizontal, and it
reads as a track running forward into the yard. Aimed at the far end of the
run-in it was worse still: that reaches back under `E2`, so the line went almost
straight up the screen and crossed the fragment glyph on the way.

`routeOf` had to be taught this: a ported *source* edge that also has a `portB`
now returns `[p0, endAt]` instead of falling through to the lane-entry route,
which ignored `endAt` and went to the destination's centre anyway.

### It arrives blue and is demoted

A read falling out of the sky is R2 — blue is that branch's identity the whole
length of the map, and the thing that lands has to be readable as one of those.
What it is *not* yet is checked. So it holds `--accent` down the run-in, and the
instant the first scanner reads block one **the other two go dim**: the fragment
has stopped being a read and become a candidate with two claims outstanding,
which it then earns back one gantry at a time.

The change is a snap and wants to be. It is an event, not a transition, and it
happens under the first arch where the eye is already looking. A crossfade there
would blur the one moment the station exists to stage.

**The body is one bar, not two connectors.** It spans all three blocks at
`SC(0.045)` half-depth — the same glyph `E2` draws up the lane — so the thing
that lands here is recognisably the thing that was named there. Built before the
blocks, for the same paint-order reason.

### The deck is almost not there

It was a solid floor, and a solid floor under a yard whose whole subject is eight
thin lanes and what travels them is a large bright rectangle competing with all
of it. What the yard needs from a floor is the fact that the gantry legs stand on
something; **the lanes themselves draw the ground.** So it is kept and dropped to
a tenth. `E3` also takes `noclip:true` — there is no floor left to hide anything
behind, and the whitelist line arriving from `W1` was being cut the moment it
entered the node's silhouette.

The barcode blocks are `--accent`, R2's own token: dim until a gantry has read
them, bright after. Ticks are `--fg` so a verdict sits legibly on the block it
judges. The whitelist slots overhead are `--fg`, the same white the plates at
`W1` write into.

### The scanner panel spans the whole arch, and the arch sits lower

It was 78% of the span, centred — which *is* centred and does not look it. A slab
narrower than the legs it sits on, floating above them, reads as slipped rather
than as inset; there is nothing in the picture to measure it against except the
legs, and it disagrees with them. Full width and the two agree, and the arch
reads as one object with a lid. The 20 whitelist slots widen with it
(`hw = halfSpan - SC(0.22)`), which is the better half of the change: the
scanner face now shows the list it is checking against, right across the lanes
it checks.

**`gz` and `pgap` are in `YARD_ROUNDS`, not inline, because `NATZ` is built from
them.** Lower the arch without lowering `NATZ` and `n.h` stops meaning the height
of the thing — the whole shape rescales under you. They went 1.05/0.66 to
0.66/0.40: high enough to be a gantry, low enough that it reads as standing over
its lanes instead of hovering up-left of them. The stations moved a little
further along the lane at the same time (`gx` 3.6/7.2/10.8 to 3.9/7.5/11.1),
which is the rest of the same complaint.

**The names hang past the far end of the panel**, at `cy - halfSpan - SC(0.95)`.
They used to sit at 0.78 of the half-span, which was clear of a panel that
stopped at 0.78 and is on top of one that runs the full width. *NO MATCH* moved
too — down to the bin's foot at `base`, out from under the reject tracks that
reach it.

### The bin is opaque, and the cut happens where you cannot see it

Translucent, it was a box you could watch things vanish *inside*, which is a
different and much worse idea — the point of a bin is that the far side of it is
out of the story.

The fade window then matters. The bin is 1.5 units of footprint and the triplet
is 1.34, so there is a narrow window where the whole fragment is inside the
box's silhouette and nothing else: `binX - 0.48·BINW` to `binX - 0.39·BINW`.
Take `vis` to zero there and the fragment is at full strength right up to the
moment it goes behind the box, and never comes out the other side. Any wider a
window and you watch it dissolve in the open, which is a much sadder story than
being thrown away — and a hair too narrow and a sliver reappears past the bin's
lower-right corner, which is what the old `binX - 1.1 -> binX - 0.1` window did.

The verdict marks ride at `zR + 0.5·KZ` against the bin's `0.62·KZ` top, so a
cross that is still up when the cut happens projects onto the bin's top face and
is covered by it. That is luck rather than design, but it is checked luck.

**Three build-order facts do real work.** The verdict marks are built after the
fragments and *before* the gantries, so a tick rides above its block but passes
*under* the scanner. The falling fragments are under the scanners for the same
reason. The bin is built last, so a discarded triplet slides *behind* it and is
gone.

## `drawWhitelists` — where the lists come from

Three plates in the sizes the chemistry uses — BC1 48 wells, BC2 and BC3 96 —
with a registry hanging over each.

**All three share a well pitch**, because real 48- and 96-well plates have the
same wells: the 48 is simply a smaller plate. So BC1's plate is visibly two
thirds the width of the others *and still yields 96*, because each of its wells
holds two RT primers — an oligo-dT and a random hexamer — carrying different
barcodes. Barcodes rise from it **in pairs** and singly from the other two. Same
count, half the wells, two per well, **shown in the motion rather than asserted
in a caption**.

**Each riser is exactly eight bases, and that is arithmetic rather than
decoration.** The dash pattern is fixed in *screen* pixels and the riser's world
length is derived from it, so eight dashes and seven gaps land on the line
exactly. **Do not scale the dashes with the plates** — scale only the layout, or
a barcode stops being eight of anything and turns into texture.

**The registry is built last on purpose.** DOM order is paint order, so the
panels sit on top of the risers and a climbing barcode passes *up and behind*
its register rather than stopping short of it.

**The barcodes are `--fg`, the page's brightest ink, and they are meant to be
white.** These are the whitelists. It is the one place on the map where the
brightest token is spent on something that is neither a read nor a name, and the
pun is the reason. `--fg` follows the theme, so in light mode the "white" list is
the darkest ink on the page — the same joke told the other way up.

**The names lie along the edges they belong to.** Both edges at constant y run
at **+30°** on screen, so a register's name rides its far edge and a plate's
rides its near one and the two share an angle. That is +30 rather than the map's
own −30 on purpose: these are not names *of* an object on the map, they are
writing *on* one, and writing on a surface takes the surface's angle. One size
for all three, taken from the shortest edge — three sibling labels at three
different sizes would read as a mistake rather than as a fit.

## The two reference figures — `karyotype` and `locus`

The genome lane is two files and two decisions, and until now it was two
labelled cubes. These are what those files actually *contain*: the assembly
says which bases are where; the annotation says which stretches are a gene,
which parts survive splicing, which get translated, and which way it is read.
Both ported from canvas drawings into this page's idiom.

**A roof leaves from its nearest corner, not from its middle.** These two are
the largest footprints on the map, and an edge drawn from the centre of one
spends its whole length inside the object's own occlusion silhouette: GRCz11's
line to the index was 136 pixels long and every one of them was underneath
GRCz11. The track was there, the dot was travelling it, and the node read as
unconnected. `PORTS.karyotype` / `PORTS.locus` pick the corner nearest the far
end, so the line leaves on the side it is going — no per-edge bookkeeping, and
it stays right if either object is dragged or resized. **A straight ported edge
is two points**; the lane-entry route is only for a track that has a lane to
join.

**And an edge can port at its far end too.** `portB` lands the arrival on the
destination's near corner instead of its centre — same reason as the source
port, one object further along. Without it the whitelist line from `W1` crossed
the entire sorting yard to reach the middle of it.

**And each file runs to the aligner itself**, not only to the index. The index
is built from the pair and the aligner consumes the index — which the two short
lines to `G3` say — but on the map that left the assembly and the annotation
looking like they stopped at a cube. They do not: what is in them is what the
alignment can find, and `G1 → E4` / `G2 → E4` are that claim drawn rather than
written.

**They are buildings with their content painted on the roof**, which is
`/bioinformatics_pipe`'s own idiom and the reason `roofFrame` was lifted into
`fq-iso.js` in the first place.

An earlier build had them as flat cards turned to the map's diagonal, like the
fragment. **That is right for the fragment and wrong for these two, and the
difference is worth stating:** the fragment is a diagram *of* a molecule, which
is nowhere; an index is a *file that sits somewhere* and feeds the aligner, and
the map already has a way of drawing a thing that sits somewhere and feeds
something. A short flat prism feeding another prism reads as a pipeline. A card
floating beside one does not.

**The roof is not square, and `roofPanel()` is why.** `roofFrame` takes one side
from `n.w` and uses it for both axes, because every chart it was written for is
square; twenty-five ideograms in a row and a gene model laid end to end both
want a roof much longer than it is deep. `roofPanel` takes the footprint from
`n.w` *and* `n.d` and derives the chart's own height from them, so **`CW` is a
resolution rather than a shape** — change the footprint and the drawing
rescales, change the aspect and it reflows. `roofFrame` is left exactly as it
was lifted: two functions rather than one generalised one, because that file is
`/culls`' and this one is ours.

**Text on the roof follows the roof.** At turn 0 an unrotated string advances at
−30°, the angle every other name on the map reads at, so nothing in either
figure is rotated by hand. Single lines only — a block on a roof fans, because
chart x and chart y are the two roof diagonals.

**The roof is `--bg`, not the tile's own face.** `--t-top` sits only a shade
under the chromosome bodies drawn on it, and the drawing read as a texture
rather than as a figure. `--bg` is the darkest thing the page has — and the
bands punched out of the chromosomes are drawn in it too, so **a band is the
roof showing through**, which is what a band is.

**GRCz11 carries a turning double helix beside its name**, so a glance says DNA
before the caption does — **small and quiet**, because a mark that says "DNA"
only has to be read once and it stands beside a word that already says it. Long
and bright it competed with the twenty-five ideograms that are the actual
figure. It lies along the same line the title reads on — local
+x, −30° on screen — so it belongs to the word rather than sitting next to it.
Two sines half a period apart, redrawn each frame at a moving phase; the rungs
between them shorten as the pair comes edge-on and lengthen again, which is the
whole of the illusion, and their **weight and opacity follow the same cosine**
so the near side of the turn is heavier than the far side. Depth without a
second projection. It registers a ticker, which `redrawNode()` accounts for like
any other.

**No other colour of their own.** Chromosome bodies take the reference skin's
own face (`--k-top`) and the bands are punched out in `--bg`. The window and its frustum
are **grey — the same grey the pool's leaders use, for the same reason: a
magnification is not a track.** Coding sequence and UTR are one token at two
weights, which is the UMI's trick again. The fork owns orange and blue and
nothing here borrows them.

**Every exon and every intron is named, all of them below the model, and all of
them angled** — and the two go together. Exons above and introns below kept them
apart by putting them on opposite sides, which spends the whole drawing on the
labelling; below the line they interleave, and eleven horizontal words on one
row would collide. Turned, each trails off down-left from its own tick and its
neighbours run parallel to it — the standard trick for a crowded categorical
axis, and it works here for the same reason it works there. Anchored `end`, so
the word finishes at its tick rather than starting there.

**Above the line is left empty for two spliced reads**, arching the introns they
cross — the same object the belts at `E4` draw, in the same orange, on the node
that explains why it exists. A read from spliced mRNA covers the end of one exon
and the start of the next, so it lands in two halves with nothing over the
intron between them. Drawn here it says what the annotation is *for*: the
assembly alone cannot place these, and this is the file that can.

**The 5′ UTR is long enough to be its own ground.** It was a stub at the front
of the first exon, close enough to that exon's coding block that its name and
the exon's name had to share a stretch of roof. Given a real run of its own — a
low block with clear space to its left before anything else starts — both names
have somewhere to be. **Each UTR name sits at its own outer end** rather than at the block's
centre. The angled names trail down-*left* from their ticks, so the first of
them ran off the left of the model and landed exactly on the 5′ UTR's own label.
The tick still rises to the block, so the name is still *on* its section rather
than off beside the model. Where the model sits on the roof is not a claim —
it is a schematic — so moving it costs nothing.

**Both untranslated ends are long, and pushed outward.** They were short enough
to read as trim on the first and last exon rather than as regions of their own,
and on this map they are the regions that matter. Each still leaves a visible
run of coding sequence inside its own exon, which is what says it is a *part* of
that exon and not a separate block.

**The last exon is not labelled "exon", and that is a correction rather than an
omission.** A label sits at the centre of what it names, and the centre of that
exon is inside the 3′ UTR — so the word pointed at the untranslated tail and
said the wrong thing about it. What that block needs saying is already said, on
the row below, by *3′ UTR*. Every other exon is a coding block and keeps its
name.

**The model is a 3′-biased gene, which is the only kind this page is about.**
Transcription runs 5′ → 3′: the 5′ UTR is the front of the first exon, the
coding sequence runs from there through the internal exons, and **the 3′ UTR is
the tail of the last one and most of it.** That is why it gets its own block and
its own name rather than a note off the end — every assay on this map primes
with oligo-dT, so that block is where the reads land, and it is the one whose
zebrafish annotation is incomplete in both Ensembl and RefSeq. It is the 3′ UTR
problem the reference nodes keep naming, and the reason a 46% transcriptome
mapping rate is not a failure.

### Honest note on the bands, carried over from the original

Chromosome **lengths** are the real GRCz11 primary assembly, in Mb. The
**banding pattern and the centromere positions are not** — zebrafish has no
standard cytoband table of the kind that exists for human, so both are generated
deterministically from a seed. They are there to make the shapes read as
chromosomes, **not to be counted.** If a real band table ever lands, replace
`CHR_LAYOUT` and `LOCUS_BANDS` and nothing else changes. The gene model is the
same deal: real in kind, no real coordinates. **Both nodes say so in their own
`added` prose, and that is not optional** — it is the same rule the culls page
lives by, that a figure nobody can check must say which parts are which.

### `data-fixed`, and why an animated shape needs it

`check-drawn.mjs` asks "did this come back drawn where it was left" by comparing
the centre of a bounding box across a reload. That is a sound question and a
useless measurement on this object: most of the group is a turning ball, so its
box is a different shape every frame and its centre drifts tens of units while
the node sits perfectly still. It reported sixty units of drift on something
nothing had touched.

So the check measures a `[data-fixed]` element where a shape marks one, and here
that is **the transparent silhouette** — pure geometry, no text, no stroke, so
its box is an exact transform of the node's own coordinates.

**Not the diagram**, which was tried: it is mostly *text*, and a text bounding
box is a font metric rather than a coordinate, so it lands a fraction
differently at a different zoom — and the zoom does differ between two loads,
because the camera fits to a content box that includes the ball. That is 0.6
units of nothing, which is exactly the tolerance.

**Any future shape that animates must mark one static, text-free part the same
way**, or it will fail that check for a reason that has nothing to do with what
the check is for.

## The outline of a box is a hexagon, and its vertical sides are at the left and right corners

`nodeSil()` in `fq-view.js` builds the silhouette every node's occlusion clip
and drag handle are cut from. The version inherited from the other maps went
*far-top, right-top, **near**-top, near-bottom, left-bottom, **far**-bottom*.

On a square footprint the near and far corners share a screen x, so two of those
edges are the same vertical line travelled in opposite directions: the outline
crosses itself and the region between them cancels out. On a box a unit or so
tall the overlap is a few pixels and nobody sees it. On the FASTQ landmark,
whose box is the height of the whole composition, it drew as a **bow tie with a
hole through the middle** — and that hole is the occlusion clip and the drag
handle both.

It is *far top, right top, right bottom, near bottom, left bottom, left top*
here, which is convex at any height. `drawReads` builds its own hit silhouette
the same way. **If this is ever lifted back to `/pipeline` or
`/bioinformatics_pipe`, take the order with it** — those maps have no object
tall enough to show the bug, which is why it survived there.

## The band is an object, not a backdrop

It was the one thing on the map drawn from constants and untouchable — every
building drags and every name nudges, and the patch of ground they all stand on
was fixed. It is also what the camera fits to, so getting it wrong costs the
whole view.

It has the two handles a rectangle anywhere has: **drag the border to move it,
drag a corner to reshape it.** Its record is `bandbox:<i>`, carrying `dx`/`dy`
for the move and `bx0`/`by0`/`bx1`/`by1` for the four extents — the smallest
thing that expresses both without them interfering, so a move leaves the extents
alone and a corner leaves the move alone and neither can quietly undo the other
on a reload. A corner owns exactly two extents and touches no others.

**The border, not the interior, and that is not a style choice.** The band covers
the whole map. Give it a filled hit target and every drag that misses a building
— which is how you pan — grabs the band instead. `pointer-events:stroke` on a
polygon with no fill takes presses on the outline and nowhere else.

**One element is both the target and the feedback.** A separate dashed outline
on top of it — the obvious way to show "grabbable" — sits on exactly the same
geometry and, being an `.ehandle`, takes the press instead: two of the four
edges were dead before this was noticed. The fat translucent stroke *is* the
affordance.

**Its name rides its edge.** The title is placed from the band's own
bottom-right corner rather than from a remembered constant, so reshaping carries
the title along. It still has its own nudge on top (`band:<i>`) — the same split
a building and its name already have.

The handles live in their own layer appended last, so a corner can never end up
underneath something, and they are inert until the mode is on like every other
handle here.

## No ruler, and three fewer buttons

There was a coordinate ruler — ticks and numbers along the two outer edges, in
the same x and y `fq-data.js` is authored in — and a **Hide axes** button for
it. That button was the tell: **a control whose job is to remove something from
the drawing is an admission that the thing should not have been in the
drawing.** Positions are authored by dragging in Edit positions and pasting the
block back, which is how every layout here has actually been made. Both are
gone, and `gAxis` with them.

**Fit the map** is gone as a button and alive as a key: `Home` (or `0`) re-fits,
the hint line says so, and `check-clicks.mjs` presses it between every building
it clicks. It is a way back rather than a thing to do.

**Pause motion** is the one that cost something, and it is worth being honest
about. `prefers-reduced-motion` is still read and still obeyed, and still
re-read when it changes — a machine asking for less motion gets less. What went
is the **override**, in both directions. `setMotion()` and the `MOTION_KEY`
store are intact, so putting it back is one line in `index.html` and one in the
CONTROLS block.

## No scenery

`/bioinformatics_pipe` carries the attrition band, painted flat on the ground
behind its row, and resolving it took a whole function — a thing whose *span*
is derived from the buildings it covers must take its *base* from where the
lane put them (`_ox`) rather than from where they ended up (`x`), or its own
saved nudge compounds every time the table is applied.

Nothing here is drawn that way: every object on this page is drawn at its own
coordinate, so a saved `dx` is in the picture the moment the page loads. **If
ground scenery is ever added, lift `resolveScenery()` from that map rather than
re-deriving it** — the bug it exists for looks exactly like a save that did not
take, and it was reported twice before it was found.

## Labels never take clicks

Everything `mkAnn()` draws carries `pointer-events:none`. This page draws no
floating annotations today, and the rule stays anyway: a label that floats over
a neighbour is a **click target sitting on top of it**, and neither failure
looks wrong in a screenshot. `check-clicks.mjs` is the only check that catches
it.

## The palette is `/pipeline`'s, token for token

`index.html`'s `:root` and `body.light` blocks are lifted from `/pipeline`
verbatim. The three mark names are **aliases** onto those tokens, not new
colours:

```
--keep:   var(--fg2)     anything that stays
--cull:   var(--drop)    /pipeline's orange
--accent: var(--signal)  /pipeline's blue
```

**Do not introduce a fourth.**

### `--cull` is the whole E chain, and `--accent` is being held back

The two tokens used to be the two branches — `--cull` for R1's cDNA lane,
`--accent` for R2's barcode lane. **That distinction is gone**, because the fork
it encoded was wrong (see below), and a colour that outlives the claim it was
made for is the claim smuggled through in paint. So the entire E chain is
`--cull`, which is `/pipeline`'s own colour for this row and means here exactly
what it means there: *this is the material, and it is moving.*

`--cull` means *this is being dropped* on the other two maps. Here it does not,
because **nothing in this segment is a cull** — the token has no other job on
this page. **It is only safe while that stays true.** If anything on this map
ever starts culling, the read trail has to move off this token first.

`--accent` is now unspoken for, deliberately. A read that has cleared `E3`
carries a **cell**, and colouring reads by cell from `E4` onward is the next
thing this page owes; the token is being kept for that rather than spent on a
distinction that no longer exists.

**There is a live inconsistency and it is on purpose.** `E3` still draws blue
fragments and `E4` still draws orange reads — two stations disagreeing about
what colour a read is — because the flow was fixed first and the artwork pass
has not landed. Do not "fix" it by putting the branch colours back.

### The fork was wrong

Worth writing down so nobody re-derives it. The page used to run two parallel
lanes out of `E2` and join them at the deduplication: R1 to the genome, R2 to
the whitelists, both arriving at `E6` where "neither of them alone is a count".
It drew beautifully and it is not what any counting stack does.

R1 and R2 are **two ends of one read pair sharing one read ID.** They are never
separate objects, they are never separately routed, and there is nothing to
reunite — so a join node was drawing an assembly step that does not happen. And
the ordering was wrong in a way that mattered: barcode matching comes **first**,
because alignment is the expensive step and it is not spent on the quarter of
reads that could never be assigned to a cell. Everything downstream of `E3`
inherits a cell identity, which is what makes `E7` possible at all — dedup needs
cell, gene and UMI at once, so `E6` (bucket by cell) has to precede it.

One chain, eight stations, all of them on the lane. The only things off the lane
are the references, and they are off it because they are a different *class of
object*, not a different route.

### `id` does not track `key`, and must not be made to

`id` is the stable name an object is known by in the saved-offsets table. Rename
one and somebody's saved drag silently re-applies to a different building. When
the chain was re-ordered the **keys** moved and the **ids** did not: id `E6`
carries key `E7`, and the new bucketing station is id `CB` carrying key `E6`.
The key is what the map shows and what the prose refers to; the id is
bookkeeping and is allowed to look odd. Tidying it is a data migration, not a
rename.

## Load order

```
fq-iso.js     projection, faces, paint, roofFrame, the ticker registry, lanes
fq-shapes.js  the three shapes copied from /pipeline
fq-data.js    the lifted nodes, edges, payloads, prose
fq-view.js    assembly, camera, reader, index, strip
```

`fq-view.js` asserts this order and fails with a readable message rather than a
`ReferenceError` if a file 404s.

## Edit positions

Ported from `/pipeline` via `/bioinformatics_pipe`, unchanged. Everything the
map draws is placed from world coordinates and the projection is affine, so a
drag is exact: a screen delta divides straight back into a world delta and
moving an object is a `translate` on the group it was drawn into.

Three kinds of thing drag, and they are three different mechanisms: a
**building** (world coordinates), **its name** (`ldx`/`ldy`, composed in front
of the label group's own transform), and **the band's own name** — a *mover*,
which belongs to no building and would otherwise be the one string on the map
that could not be got out of the way of anything. `MOVERS` in `fq-view.js`.

What comes out is a table of **nudges** relative to whatever `layoutRows()`
computed — `dx`/`dy`, `ldx`/`ldy`, `del` — so it survives the lane being
re-solved or a station being inserted.

### One base, captured once: `_ox` / `_oy`

Every nudge is measured from `_ox`/`_oy`, the lane engine's own output, and
from nothing else. They are captured immediately after `layoutRows()` and never
written again, so applying a table twice lands where applying it once does and
reading it back is a subtraction that cannot drift.

**Never write to `_ox`/`_oy` after they are captured, or read a nudge back as
anything other than `x − _ox`.** The moment something else moves that base,
saves start containing objects nobody touched.

### The shared record — and it is NOT the other map's

`/api/fqpipe_edits`, `ITEM_ID` **`FASTQ_pipe::edits`**, in
`src/app/api/fqpipe_edits/route.ts`. Never `bioinformatics_pipe::edits` and
never `pipeline_map::edits`. One record between two maps means whichever saved
last erases the other, silently, with no way to tell which happened — and this
page's closest neighbour is the other half of the same row, which is exactly
the one that would collide.

Local storage is namespaced the same way: `fqpipe.offsets`, `fqpipe.motion`,
`fqpipe.panels`.

The record is `{offsets, at}`, never a bare table. Every drag stamps `at` with
the local clock; a successful save replaces it with the **record's own** stamp.
On load, **the shared copy wins only if `doc.at` is strictly newer** — anything
else is this browser holding work the record has not seen. A save is a
**merge**, never a replacement, and a read failure aborts the write: keeping a
change in this browser is recoverable, overwriting somebody else's sitting is
not.

`GET` passes `ConsistentRead: true` and the route is `force-dynamic`, because a
save is read back within seconds of being written and an eventually-consistent
read of the previous layout is indistinguishable from a save that never
happened.

**Taking theirs is a reload, not an in-place application.** `applyOffsets()`
re-runs only a subset of what a load does; using it to adopt a shared copy
produces a picture no reload reproduces.

## The checks — run all six

```bash
node check-text.mjs    <url>             # needs playwright
node check-clicks.mjs  <url>             # needs playwright
node check-edit.mjs    <url>             # needs playwright
node check-delete.mjs  <url>             # needs playwright
node check-persist.mjs <url>             # needs playwright
node check-drawn.mjs   <url>             # needs playwright
```

All six pass as of this build, against `python3 -m http.server` over `public/`
with the url `http://127.0.0.1:8731/FASTQ_pipe/index.html`.

They all **stub `/api/fqpipe_edits`**. What is under test is the page's
behaviour, not DynamoDB's, and a check that fails when a table is unreachable —
or when it is run against a static preview server — is a check that gets
ignored. `check-persist.mjs` is the exception that proves it: it stands a
*stateful* stand-in up instead, because a constant is exactly what cannot catch
the bug it exists for.

- **`check-text.mjs`** measures every drawn string as its **true oriented quad**
  — `getBBox()` through `getScreenCTM()` — and asserts no two overlap by real
  intersection area. **Do not use axis-aligned boxes here.** Map text runs at
  ±30°, so its AABB is enormous and mostly empty, and two stacked lines that
  never touch report an 85% overlap.
- **`check-clicks.mjs`** clicks every building with a *real* mouse press at the
  projected centre of its roof. Use `page.mouse.click`, never `dispatchEvent`:
  a synthetic event is not evidence about a real one, and this map pans on
  `pointerdown`. It is why the FASTQ landmark has a solid pad under its
  drawing: the earlier heap enclosed mostly air and the click went straight
  through it to the canvas behind, which cleared the selection.
- **`check-edit.mjs`** drives Edit positions with a real mouse: handles inert
  until the mode is on, a building drag that moves the building and *not* the
  name offset, a name drag that moves the name and *not* the building, the band
  name as a mover, the result written to local storage, and a paste-back block.
  The floating-annotation section of the other map's copy is **removed here**,
  because this page has none; lift it back if a roof ever lands on this row.
- **`check-delete.mjs`** drives pick → × → confirm → delete, asserts **Cancel
  spares the object**, that the deletion survives a reload with its edges gone,
  and that the Save confirmation both appears and then leaves on its own.
- **`check-drawn.mjs`** asserts a saved position is **in the picture**, which is
  a different claim from being in the record. It measures the drawn group's
  bounding box and pushes the centre back through the world CTM, because the
  camera re-fits after a drag. It drags by the **edit handle**, never a group's
  bbox centre, and it measures a `[data-fixed]` element where a shape marks one
  — see above.
- **`check-persist.mjs`** runs a **stateful stub with a monotonic `at`** and
  asserts all seven transitions. It reads **both** bases off the node (`_ox`
  *and* `_oy`) rather than assuming a target sits on the row — most of this map
  does not, by design, including the two that were reported as bugs:
  **unsaved work survives a reload, both before a save and after one**, and a
  browser holding the pre-stamp record migrates. It compares **every object,
  not the one that was dragged**.

`rendered.mjs` is not a check — it is the same drag-save-reload trial printing
world coordinates, for when something looks wrong and you want the numbers.


### A picked node resizes

The ✕ appears on a pick because deleting is the one thing that cannot be undone
by dragging back. **Resizing appears there too, and for the opposite reason:**
it can be, but it needs handles, and four corners on every object at once would
bury the map under its own tooling. One object at a time, and it is the one you
just pointed at.

**Four corners on the top face and one in the middle.** The corners take `w` and
`d`; the middle one takes `h` and is dragged up the screen — z is the one axis
this projection draws straight up, so a height drag divides by `S*CZ` and never
touches the ground-plane inverse. They are SVG rects inside `world`, so they
ride the camera for free and cannot shear.

**A corner is anchored at its opposite.** Drag one and the other three hold
still, which is what a rectangle anywhere does — so the drag writes `dw`/`dd`
**and** `dx`/`dy`, because `w` and `d` are measured from a centre and the centre
has to move to keep the far corner where it was.

### A resize is the only edit that redraws, and that costs two things

Every other edit is a translate on a group already drawn — nothing re-renders
and no ticker is disturbed. `w`, `d` and `h` are read by the shape *at draw
time*, so the only way to see a new size is `redrawNode()`.

**Tickers have to be accounted for.** A shape that animates pushes into
`TICKERS` when it draws; draw it twice and there are two, the older one running
over elements that have been thrown away. The count is taken before and after
each draw and remembered on the node. **Recording that only in the redraw is not
enough** — the *first* draw's ticker was never on the books, so one resize left
two. It is invisible on screen and it compounds.

**And a shape can be squeezed below what it can draw.** Some derive what they
draw from their own size — how many wells, how many cells, how many groups — and
far enough down they produce nothing, at which point their own animation reads
an empty array and throws. The frame loop drops a throwing ticker and keeps
going, which is designed behaviour and not a crash; the shape stops moving until
it is redrawn, and resizing it back does that. `MINWD` makes it hard to reach by
accident rather than impossible — no single number knows what every shape needs.

**`applyNudge` only clamps when there is actually a delta.** Clamping
unconditionally reaches every node on every load, and at least one is authored
`h:0` — a patch of ground rather than a box. A floor turned that 0 into 0.02,
which is a difference, which put it in the saved table as an object somebody had
resized. Nobody had.

## Please do not

- **Edit the prose in `fq-data.js`.** It is lifted. Edit `/pipeline` and lift
  again, or the two maps start disagreeing about the same stage. New writing
  belongs in `added:`.
- **Give this page a modelled figure without a model**, or drop the word if one
  ever arrives.
- **Rename `UD` or redraw it.** It is the join with `/bioinformatics_pipe` and
  it has to be the same object, at the same size, from the same code.
- **Point this page at `/api/bpipe_edits`.** See above; the failure is silent.
- **Replace the hand-rolled projection with a library.** Layout, label angles,
  painter ordering, the camera and `roofFrame`'s matrix all derive from `P()`.
- **Reorder the fragment on the FASTQ landmark to match the order R2 reads
  it.** The reversal is the point.
- **Turn that diagram back into the isometric, or stand it on a solid.** It is
  a diagram of a molecule, not a thing in the map, and it was both of those
  once.
- **Start a `requestAnimationFrame` inside a shape.** Push to `TICKERS`.
- **Add a colour.** Three encodings — stays, goes, threshold — aliased onto
  `/pipeline`'s tokens.
