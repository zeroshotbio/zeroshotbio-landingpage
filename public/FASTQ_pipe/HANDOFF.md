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

**The gap is the one entry whose `w` is not a length, and the one figure on this
glyph that is not measured.** It cannot be measured: read 2's 58 bases are
barcode, linker and UMI end to end — not one base of cDNA — so the two reads
never overlap and no paired-end inference is available.

What the reads DO settle is that the middle is never short. 0.37% of read 1s
carry a run of 12+ A and those starts are spread flat across all positions, so
they are A-rich sequence rather than a polyA junction: **read 1 essentially never
runs off the end of its insert.** The span is longer than 64 bp and that is the
end of what the FASTQs will say.

So the `~250` is an order of magnitude from the protocol's expected library size
— final library, less the Illumina adapters, less read 2's block, less the
oligo-dT scaffold, less the 64 read 1 already has. **It is marked as a different
kind of fact three ways**: a tilde, a unit where every other figure is a bare
number, and an axis break drawn across the segment itself.

**The axis break is the important one.** At ~250 against a molecule whose whole
sequenced length is 122, drawing the gap to scale would make it twice everything
else put together and the barcodes would vanish. So `w` is a token — and the two
slashes say the shortening is deliberate. A quietly shortened bar with a number
under it would be the worst of both: a reader would take the width for the
length, which is exactly what the old drawing's proportions did wrong.

### Two registers, one on each side of the bar

**Above it: the measurements.** Every base-pair figure and nothing else — grey,
small, no words. **Below it: the names** a person reads to find out what the
molecule is made of, then the brackets and the two reads.

They were interleaved before — the middle's name above, the figures below, the
segment names in between — and the eye had to sort measurement from nomenclature
on every row. Split by side and there is nothing to sort: one glance for what it
*is*, another for how long.

The figures are meant to be **found rather than read**: bare numbers over read
2's six segments (no unit — the `58 bp` under the bracket has given it), and the
two read lengths in neutral ink under their own brackets, the name at the outer
end saying *which* read. Six segment figures that add to 58, so the drawing can
be checked against itself. The read lengths stay **below**, with the brackets:
they annotate a bracket rather than a segment, and separating a figure from the
thing it measures to satisfy a rule about sides is the rule serving itself.

**Two names need a second row.** "never sequenced" is fifteen characters over a
32-unit token and would run into `BC1`; and at the true 10 bp the UMI is 26px
wide against BC3's 21 with 23 between their centres, so `BC3` and `UMI` on one
row read as `BC3UMI` — which is what shipped for one commit. Both drop to
`ROW2`, where they are 180px apart and each has the row to itself. *(The old
code carried a comment claiming the UMI already dropped to a second row. It did
not: `ROW2` was defined as `ROW1`. A comment describing an intention that the
code does not implement is worse than no comment.)*

**check-text did not catch `BC3UMI`** and cannot. Its `OVERLAP` rule is a
*share* of the smaller quad, and two strings that meet with almost no overlap
still read as one word. A same-building minimum-gap rule was tried and backed
out: at 3px it failed 121 times on the locus, whose exon/intron labels are
small, angled and deliberately close, and a check that fires that often on
correct drawing is a check people learn to skip. The blind spot is recorded at
the top of `check-text.mjs`. Look at the picture.

### The arrowheads sit at the outer ends

20% in from the end each read **starts** at, next to its own name — not 15% in
from the inner one. Both brackets meet at the gap, so an arrow near each inner
end put the two of them within a few pixels of each other in the middle of the
drawing, where they read as one symmetrical ornament rather than as two reads
going opposite ways. Out at the ends, each arrow sits under its own name and
points away from it, which is what the read does.

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

**One belt, and the gene lies across it** — the same turn `E3` makes, for the
same reason and with the opposite subject.

At `E3` the molecule lies broadside so three scanners can each read a different
part of it. Here the molecule *lands* broadside so its cDNA half can lie **along**
a gene. Four belts of models running down-track could only ever show reads
landing *on* something; one gene turned across the track shows a read landing
**somewhere on it**, which is the whole of what an aligner decides.

### The barcode end does not land, and it leans away like an aerial

It has no genome to match — it is a synthetic tag and the aligner has nothing to
do with it — so past the cDNA the molecule lifts off the surface: grey adapter,
then blue, still attached and doing nothing. That is the honest shape of a 3′
read. **Two thirds of the molecule is the reason it can be counted, and none of
it aligns.**

**And it leaves the gene's axis altogether.** It used to carry on *along* the
gene as it rose, which put the one part of the molecule with **no** position
onto the axis that means position — a blue tail pointing along a gene reads as
blue lying on the gene. `TDIR` is `[-0.86, +0.51]`, so it goes into −x and +z:
up-and-to-the-left, about 47° off the deck, across the direction of travel and
across the gene both.

**`LIFT` is gone and the length is base pairs.** It was `0.52 × n.h`, a height
with nothing behind it. The tail is 32 of unsequenced middle and 58 of barcode
against the 64 that aligned, so it is `(RG+RB)` of the gene long — half again
the orange, which is the true ratio. `TKNEE` is where the dashes stop and the
blue starts, and it is 32/90 for the same reason.

### But it arrives flat, and the descent is what flaps it up

**A molecule in free air is a straight molecule.** At the top of the fall the
whole read is one flat line — cDNA, adapter, barcode end, in a row along the
gene's own axis, at the height it is falling through. The aerial is not a shape
the molecule *has*; it is a shape the descent puts it in. `flapOf(kk)` swings the
tail from that line up into `TDIR` as the read comes down, the way wind takes a
streamer, and the splice arch opens on the same number — **a read that lands
opens up in one motion.**

**The tail turns; it does not stretch.** The direction is interpolated and then
*normalised*, so it is the same molecule at every point in the swing. Lerping
the components without normalising shortens the tail through the middle of the
turn, which reads as the barcode end retracting into the read.

### The orange is the subject, and the drawing says so in widths

| | |
|---|---|
| `RW` | `0.047 × GW` — was 0.40, then 0.28, then 0.093 |
| `RWB` | `0.25 × RW` |
| screen floor | read `0.42`, aerial `0.26` half-pixels |

**A read is a line, not a body.** At 0.28 of a gene's own thickness thirty reads
on one model were a *texture* — you could see that reads were there and not how
many. At 0.047 a hundred lines at slightly different heights read as a hundred,
which is the count the aggregate argument is made of.

**Neither half takes an outline.** A `0.6` stroke on a bar under a pixel wide is
not an edge, it *is* the bar, and it draws every read at the same width whatever
the width is.

**The floor is in screen pixels and it is the one place this shape leaves world
units** — and it is the one that bit. Under a pixel an SVG polygon stops being
drawn faintly and starts not being drawn at all. The aerial was floored and the
read was a true quad, so at map zoom *the part with no position was drawn wider
than the part with one*: the floor had quietly inverted the hierarchy the widths
were set to make. Both go through `barTo` now, the read at roughly twice the
aerial's minimum, so the ratio survives down to the zoom where the true widths
stop meaning anything. **Move one floor and move the other.**

**The unsequenced middle sets its own dash pattern, per frame.** It is a few
pixels long at map zoom and a few more at reading zoom, and a fixed `2.2 2.2`
gave it one dash at one scale and three at the other — *a dotted line that is
three dots is not read as dotted*. `seg` measures the length it actually has and
divides it into `DASHN` dashes and `DASHN-1` gaps, so it is the same line at
every zoom. That is the general fix for any dash on a projected segment here.

### One shower at a time, and the arithmetic that guarantees it

Every gene used to be rained on across most of its crossing, so three or four
were being showered at once and the belt read as continuous weather. **It is not
weather: a gene is a target and a shower is the thing being aimed at it.**

The guarantee is arithmetic, not a scheduler. The genes are evenly spaced
`1/NG = 0.1` apart in `u`, so **a shower whose whole airborne interval is
narrower than 0.1 can only ever have one gene under it.**

```
SHOWER_AT 0.402   the first read's u0
SHOWER_W  0.040   the spread of u0 across the shower
FALL      0.052   one read's fall
          -----
          0.092   airborne, first read's start to last read's landing  < 0.1
```

**Change any of the three and check the sum.** They also have to sit inside the
window where a gene is actually on the belt — roughly `u` 0.30 to 0.70 — or the
shower lands in the dark, which is how an earlier spread came out looking like
no rain at all. A gene now comes on bare at 0.30, is showered around 0.35–0.45,
and rides the rest of the way covered.

**One point, not a region.** `NOZX` and `NOZZ` are constants: every read on a
gene falls from the same place, up-belt and above the exon tops, on the belt's
centre line. *A spray whose source is itself spread out is a shower*, and what
this station does is a stream of reads each finding its own place on one model —
so `dx` closes in as `air` goes to zero and `dy` comes down off `cy`. **The fan
is the landing sites and nothing else.**

**And a read is invisible until its own fall starts.** Before, `kk` was 0 and
`air` was 1 for everything whose window had not opened, so thirty reads hung
motionless above every gene at three-quarter strength waiting their turn. `op`
is `sstep(0, 0.10, kk)`: the first frame anybody sees of a read is a frame in
which **it is already moving**.

### They stack, the way a pile-up in a genome browser does

Laid on one plane the pile turned to soup: thirty lines at the same height over
the same stretch of exon are one orange smear, and the count — *which is the
whole argument of this station* — is unreadable off it.

`rd.row` comes from greedy interval packing, exactly what every read viewer
does: walk the reads in start order and drop each into the lowest row whose last
read ended before this one starts, with `STACK_GAP` of clear transcript between
them so two in a row never touch end to end. `z0` is then the read's **own row**,
not the exon roof — a stack sits on the thing under it, and the top of it is
where the next read goes.

**The records are re-sorted into row order before the elements are built**,
because DOM order is paint order and a stack has to paint from the bottom up.
Sorting after the elements exist leaves the two orders unrelated.

`dx` came down to 30% of the line's width at the same time. The wide jitter was
right while reads lay side by side and is wrong now that they stack: **a column
that wanders in x is not a column.**

### The 3′ bias is drawn as height, and it is a shape rather than a profile

Every assay on this map primes with oligo-dT, which is why reads pile at the 3′
end. But **Evercode WT puts two primers in each BC1 well** — an oligo-dT and a
random hexamer, which is the reason BC1's plate is two thirds the width of the
others and still yields 96, drawn on `W1` — and the hexamer primes anywhere on
the transcript. So the pile is a mixture: most of it at the tail, a real spread
along the body, and neither of them zero. `P3` is the share taken at the tail;
the rest is uniform.

A read aims at a position on the transcript first and then takes the exon whose
middle is nearest it, so the bias is a property of the **transcript** and the
exon layout only decides where on it a read can sit.

**Combined with the stack, the bias comes out as HEIGHT rather than density** —
deep where the oligo-dT reads pile up, a single layer along the body. That is a
fact about the chemistry drawn as a shape, and it is the one thing a flat pile
could not say at all.

### A pyramid, not a staircase

Packed in **start** order the pile climbs from one end to the other: every row
begins where the row below it left off, which draws a flight of steps. A pile-up
is not a flight of steps — it is deep where the reads are and shallow where they
are not, and *the shape of it is the coverage*.

So the order of insertion is **how contested a read's stretch is**, not where it
starts. Count each read's overlaps first, place the loneliest ones first so they
take the ground floor, and the ones in the thick of it are forced upward over
everything they cross. The densest stretch ends up highest and the edges taper.

Rows hold **intervals** rather than a high-water mark, because reads no longer
arrive in start order and a single end is not enough to test against.

### Nothing here is translucent, and anything that looked it was sub-pixel

The splice arch was `1.0` wide at `0.55` opacity — a sub-pixel stroke held back
on top of being sub-pixel — and it came out looking like a *shadow* of a read
rather than part of one. It is the same molecule as the blocks at its feet and
it is drawn like it: `1.5` at `0.95`.

The reads themselves needed the pixel floor raised to `0.62` for the same
reason. **At `0.42` of a half-width a read is 0.84px across, and a sub-pixel
shape is drawn at partial coverage — which looks exactly like a read with
transparency on it, because that is what partial coverage is.** Before reaching
for an opacity, check whether the thing is under a pixel wide.

**`P3` IS NOT A MEASURED PROFILE AND MUST NOT BE LABELLED AS ONE.** Nothing on
this page is modelled; this is a drawing decision with a stated reason, in the
same class as the exon layout it lands on. A real coverage profile needs the
alignments, and those are not on this instance.

### Both ends of every gene are named

`5′` at `f = -0.055` and `3′` at `f = 1.055`, on the gene's own line, set at −30
like the model itself, anchored so each runs *away* from the gene rather than
across it. Which way a transcript runs is not a detail on this belt: it is the
reason the pile is where it is. Unlabelled, that stack is a lump at one end of a
diagram and a reader has to be told what it means; labelled, it says it. The
gene's name moved out to `K*0.55` off the near rail at the same time, to keep
clear of the `5′` mark now sitting between them.

### The assignment is its own station

**Alignment answers *where on the assembly*; assignment answers *which gene*,**
and they are different questions asked of the same read a moment apart. The
extra belt is where the second one gets asked: a gene crosses `ASSIGN0` with a
pile of reads on it and leaves with every one of them marked.

**The sweep runs 5′ to 3′ rather than firing all at once.** A verdict per read
is a verdict per read; one mark appearing on thirty of them simultaneously is a
decision about the *gene*, which is not what this step does. Each read's mark
fires when the model has carried it past `ASSIGN0 + f·ASSIGNL`, so the marks
travel the transcript. `ASSIGN0` sits at 0.30 of `E5`'s own belt with the sweep
running to 0.62, so a gene has run-in before it and run-out after.

**The gene's name is the answer, so it becomes the answer's colour.** Assignment
does not produce a mark on a read and nothing else — what it produces is a
*gene*, and the gene's name is already on the belt beside it. It grows and turns
`--ok` across the stretch, so the step reads as the model claiming its reads.

### Some reads land on introns now, and that is what changed

**This is a real change to a claim this page used to make**, so it is written
down rather than absorbed. The aggregate was *"every read on an exon, none on an
intron"*, and it was the annotation's whole argument. It was also why the last
third of the belt had nothing to decide: **a pile in which every read is exonic
is a pile every read of which is assigned, and a station where nothing is ever
declined is not a station.**

Reads land where the *sequence* matches, and pre-mRNA is in the library. So a
share of them land on introns — which is why the intron gaps had to widen to
`0.055…0.14`, since a read is 0.0602 of a gene and could not fit in the old ones
— and those are the reads that get the cross.

**That is exactly the subject of the step being drawn.** Whether an intronic
read counts is `--include-introns`: **a flag, not a fact**, and the node that
owns this step is named for it. The share is **tuned for legibility and is not a
measurement**, the same way `E3`'s reject rate is; there is no per-read
assignment record on this instance and the real figures live in the prose —
`E4`'s own `built` carries them: 46.1% of reads map to the transcriptome against
an exonic fraction of 63.8%.

**`E4`'s `added` had to be corrected with it.** It said *"every read lands on an
exon and none on an intron"*, which was true of the drawing when it was written
and stopped being true the moment the crosses arrived. **A claim in the reader
that the picture beside it contradicts is worse than either alone** — and this
one survived a whole commit because the prose is not what you look at when you
are looking at the belt. When a drawing's aggregate changes, grep the node.

### A cross is an exit, and the bin is on the far side

A declined read leaves the model it was sitting on, slides off the rail and
drops into a bin — the same movement, and literally the same object, as a
fragment with no barcode.

**`shredBin()` is shared by both stations now.** What a caller gives it is the
**slot**, because the slot is the only part with a constraint: whatever drops
through it has to fit lying flat. Everything else is derived outward. *Sizing
the box first and taking a fraction of it for the slot* is what produced a mouth
shorter than the thing going into it at `E3`, and a whole pose of contortion to
get around that.

**`E3`'s bin is at +y and this one is at −y, and that is deliberate.** The near
side of this belt is where the entire reference row lives — index, aligner and
both annotations are all at +y — and a bin wedged between the rail and the STAR
Aligner's footprint had 0.1 of a unit of clearance and a label that landed on
somebody else's roof. **A discard has to be somewhere a reader can watch it
land, and that beats matching the other bin's side.**

Two constraints, both about height and reach: the lid must sit **below** the
height reads ride at, or they climb into it rather than falling in; and the bin
must be **inside the belt's own visible span**, because a shunted read is drawn
in its gene's group. `0.86` leaves the last-declined read room to get there —
and once it is off the model it carries **its own visibility**, because the gene
is already dimming by the time it arrives.

**`rd.start`, never `rd.f`.** A spliced read has `fA` and `fB` and no `f` at
all, so reading `f` in the verdict block put `NaN` into every coordinate of
every read on the belt — and it did it through `shunt * (BINY4 − NaN)`, which is
`NaN` even when `shunt` is zero. *Multiplying by zero does not rescue an
undefined.* The every-read fields are `start` and `end`.

### The annotation feeds the assignment, four fifths along

`PORTS.belts` answers `"bl"` with the middle of the near rail — where the index
feeds the aligner — and `"assign"` with four fifths along it, where the gene
model feeds the assignment. **Two consumers, two points on one machine, and the
gap between the ports is the gap between the two questions.** Both divide by
`BELTU` and not by 9.2: it is the same divide `drawBelts` makes and it has to
make it the same way, or the port lands on a rail that is not where the rail is.

### Where a read lands is the whole claim, so the model has to be able to hold it

**Every read on an exon, none on an intron** is the only thing this station
asserts in aggregate, and it was quietly false twice over.

- **`dx` ran to ±1.1 of a gene's own thickness**, so most reads landed off the
  line entirely and the pile read as scatter *around* a gene rather than
  coverage *of* one. It is bounded by `GWE - RW` now — the line's own width less
  the read's — so every read lands somewhere a read could actually have aligned.
- **The exon generator started at 0.055 and a read is 0.0602 of a gene**, so the
  short half of the distribution could not hold one. The placement clamps rather
  than rejects, so those reads sat at the exon's start and hung off the far end
  onto the intron beside it. Exons now start at `RL + 0.012`, and the placement
  additionally filters to exons that fit and falls back to the longest. **A
  model with somewhere a read cannot land is a model that will eventually be
  seen to break the claim.**

### The gene is one line, opaque, with thicker sections

`GWE` is `0.58 × GW` and the body and the exons are **both** that width. They
were `GW*0.58` and `GW` — the exons *wider* than the body they sit on — and both
drawn through, at 0.42 and 0.80. A gene came apart into a wide translucent
staircase with a narrow strip showing between the treads and the deck's own grid
through all of it. **A gene model is one line with thicker sections: same width,
different height, both solid.** What separates an exon from the intron beside it
is that it stands up, and that is the only difference there should be.

**`exonH` went 0.565 → 0.24 of `n.h`, `geneH` 0.19 → 0.09.** Opaque and narrowed,
an exon at 0.565 against a line 0.12 world units wide is a *wall*: the models
came out as rows of train cars standing on a rail. A little over its own width in
height reads as a thicker part of a line, and a read landing on its top lands
somewhere the eye can still see is part of the gene.

**Three steps of one grey, darkest at the bottom:** the deck is `--t-right`, the
gene's line is `--t-top`, the exons are `--k-top`. On a translucent deck the body
could be `--t-left` and still be seen; on an opaque one it is within a shade of
the floor and reads as an *empty outlined box*, because all that is left of it is
its own stroke.

### The deck is opaque, and that is what made it quiet

The belt was drawn through at 0.55 and 0.7. **A translucent deck is not quieter
than a solid one — it is busier**, because the ground grid reads straight through
it and every gene on it acquires a second set of lines nobody drew. Quiet is a
colour close to the ground, not a hole in the floor.

`setBoxY`'s outlines came down with it, 0.42/0.28 → 0.30/0.18. An outline earns
its keep on a translucent face, where it is the only thing saying where the box
ends; on a solid one at full strength it is a second drawing of the same edge.

### The splice arches are back

They were dropped in the rewrite and noted as a decision rather than a loss.
**One read in six** now lands in two pieces: its orange is split across an exon
boundary, one piece ending at the end of exon *k* and the other starting at the
start of exon *k+1*, with an arc over the intron between them that **never
touches down**. Those are the reads the sequence alone could not place, and they
are the reason `G2` is a node of its own rather than a note on `G1`.

`archPath` samples the curve in the gene's own `f`, so it lands on the two exon
ends it belongs to however the model is scaled, and it takes its height as an
argument so the arch can **open with the flap** — flat in the air, arched on the
model. `ARCH` is `0.26 × n.h` and it was 0.42: an intron here is a few hundredths
of a gene wide, and an arch as tall as it is long draws a **loop**, which reads
as something the read does rather than as the something it does not. The split is
`RL` between the two halves — the read does not get longer for being spliced —
and the aerial hangs off the far end of the second piece like any other.

### Every gene is named, and the names are real on models that are not

Real zebrafish symbols, in `--fg3` at `0.55`, smaller than every other name on
this map: it is an identification, not a heading, and there are ten of them
moving. Each rides at its own gene's x just off the near rail, set at −30 like
the gene's own long axis, anchored `end` so it finishes at the rail and trails
away from the belt into empty ground rather than across it.

**The pairing is not a claim and must not become one.** Every gene on this belt
is a seeded arrangement of exons — real in kind, no real coordinates, the same
deal `LOCUS_BANDS` is on. What the names add is the one thing the geometry
cannot say: that these are zebrafish genes and that they are all *different from
each other*. A row of unnamed models reads as one gene drawn ten times. The
symbols are real because "realistic-sounding" invented ones are how you end up
with a plausible string somebody looks up — but **no name here describes the
model under it**, and if that ever has to be true the models have to come from
the annotation rather than from a seed.

Thirty names, picked with a stride coprime to the count, so ten genes get ten
different ones and the same gene keeps its name for as long as the page is open.

### Proportions that had to move together

`RTOT` is 0.145 of a gene — 64 bp of cDNA, then 32 and 58 that do not align, in
the same base pairs as everywhere else on this page. It started at 0.205 and the
reads would not fit inside an exon; the exon generator makes more and smaller
ones to suit, and `NG` went 6 to 10 so more than two genes are on the belt at
once.

**The gene body carries at 0.80.** Below that the model reads as a staircase of
unrelated blocks rather than one gene with exons standing proud of it — the body
is the thing that says these blocks belong to each other.

### `setBoxY` and `barTo`

`setBox`'s twin: same three faces, same roles, transposed for a box long in `y`
and thin in `x`. Anything laid across a belt on this page needs it.

`barTo` replaced both `quadX` and `quadY`. They were this shape's two
axis-aligned bars and between them they covered every direction a read used to
run in; the aerial swings through a whole arc now, so it needs a bar that does
not care which axis it is on — and once one existed there was no reason for the
read to keep its own. It offsets in the **screen** plane, which is exact enough
for a line and is what lets both halves share one pixel floor: a world extent in
`x` or in `y` projects to exactly `w·S` under this projection, so a bar is the
same weight in any direction.

## `drawSortingYard` — matching as a place

One belt, and what travels it is **the molecule from E2, lying across the belt**.

### The eight lanes are gone, and so is the funnel they drew

They merged 8 -> 4 -> 2 -> 1 through the three gantries, which drew a funnel —
and a funnel is what this station is not. Nothing is combined here. Each
fragment is asked three questions in turn and either survives them or does not.
One belt says that; eight lanes narrowing to one said something else, and said
it three times.

### The fragment lies ACROSS the belt, and that is the whole trick

Its long axis is world y and it travels in world x, so the whole molecule —
cDNA, the dotted middle, the three barcodes with their linkers, the UMI —
presents itself broadside to every scanner it passes under. Which is the truth
of the operation: **all three barcodes are on one read, and every gantry can see
all of them.** What makes gantry *i* a different question from gantry *j* is
which one it *checks*.

The payoff is geometric. Because the barcodes sit at different `y`, the three
verdicts land at three different places **on the same object**. Travelling
lengthwise they would have stacked on one point, which is why the old drawing
needed a summarising check at the end to say "all three passed". It does not any
more: three ticks earned one at a time and still riding at the far edge of the
yard say more than one big one that replaces them, because they say *which*
three and they stay attached to the blocks they are about.

`YARD_MOL` restates E2's molecule in bp. `FRAG` itself cannot be reused — it
carries screen-space widths and labels for a diagram square to the reader — but
the numbers are the same measured numbers, so they are written out again rather
than approximated into a decoration. 154 bp end to end, cDNA end at `+y`, the
barcode end at `-y`, which is the side the whitelist plates are on.

**The cDNA is held back to 0.55.** It is two fifths of the molecule and it is not
what this station is about; at full strength it was the loudest thing on the belt
and the barcodes read as trim on the end of an orange bar.

### The scanner is a cantilever over the R2 block, on one post

**It was an arch, and an arch was a claim this station does not make.** Two legs
straddling the belt, a cross-beam under the face, and a face as wide as the
molecule: that draws a machine reading *everything that passes beneath it*. This
station reads R2. The cDNA half of the fragment goes under nothing, is checked
against nothing, and no scanner here has an opinion about it.

So the face covers **bp 96 to 154 — the three barcodes and the UMI — and
nothing else**, and it is carried by a **single post at its far tip**, out past
the UMI end on the side the whitelist plates are on, which is where the answer
comes from. `TIP` (0.55) is how far past that end the face runs before the post
takes it; `LIP` (0.22) is how far back over the unsequenced middle it laps, so
the near edge *covers* bc1 rather than stopping exactly on it. `SCN_F`, `SCN_N`,
`SCN_MID` and `SCN_LEN` are derived from `YARD_MOL`'s own base pairs, so the
face is measured off the molecule and moves with it — **do not write the span as
a constant**, and `A.SPAN` is gone rather than left at a value nothing reads.

The post rises to `panelZ`, flush with the panel's underside, because a post
that stops at `gz` and leaves the face floating above it is the cross-beam's
problem again in a smaller size. **The second leg and the cross-beam are both
gone**: the beam was a solid repeating the panel's own outline one step lower,
and with the face this short there is nothing for it to stiffen.

The post lands `TIP` clear of the far rail, so nothing stands on the belt.

### The laser is aimed, and it locks onto the block

A beam dropped from the scanner face to the deck, **at the station's own barcode
and no other** — BC1's on bc1, BC2's on bc2, BC3's on bc3 — brightest at the
instant that block is directly beneath, with a `sin(pi*u)` fade so it arrives
with the block and leaves with it.

**It used to sweep**, first the whole molecule and then the whole R2 block, and
both were the same mistake in different sizes: *a beam that travels the length
of a read is a beam reading all of it*, and no station here reads more than one
square. Every gantry can *see* all three — that is what lying broadside buys —
but what makes gantry *i* a different question from gantry *j* is which one it
**checks**.

**And it drops on the block rather than at the station.** Standing at the arch's
own `x` it was on its target only for the instant the fragment was exactly
underneath; either side of that it was landing on bare deck a bar's width away,
and the whole lit window read as *a zap that misses*. The face is `PANW` wide,
so a beam leaving any point on its underside is the same machine — aiming it at
the block keeps it locked on for the whole pass, which is what a reader does.
The mark still fires later, at `FIREAT`: **scan, then answer.**

A **light curtain** hangs under each face: a plane from the face to the deck, at
**0.105** — it was 0.035, which is a thing you notice only once you have been
told it is there. It is what makes the scanner a scanner rather than a shelf: *a
shelf has a top and nothing underneath it.* It spans the face, so it falls
across the R2 block alone and the cDNA end passes through open air. Both are
built AFTER the scanners, so they paint as light rather than as structure.

### The readout scans, and it scans on its own clock

Each slot on the face used to be lit by a **verdict** and left to decay over 1.7
seconds, so the face changed about as often as a fragment passed — one line
coming up bright every second or so, which reads as *a light blinking* rather
than as a machine reading.

**A scanner's face is not a tally of what it has decided; it is the reading, and
reading is fast.** `SCANHZ` is 21 slots a second with `SCANTRAIL` slots of tail
behind the head, so it crosses all fourteen in about two thirds of a second.
That is the difference between a lamp and an instrument, and it costs one line
of arithmetic — the verdict no longer touches the slots at all.

### The panel is half as wide and see-through

Opaque and `SC(1.45)` along the belt it was a bench top: it hid the fragment for
a long stretch and the one moment this station exists to show happened
underneath it. `SC(0.72)` at **0.78** opacity — it was 0.62, which was a
*suggestion* of a face with the deck's own lines coming through it, the same
mistake `E4`'s belt was making. What has to stay legible through it is a mark,
and a mark is a bright stroke on a dark ground: it survives 0.78 comfortably.
The read happens in view — the
verdict marks, which pass *under* the scanners by build order, are now visible
through the glass at the moment they fire. That is load-bearing now rather than
a nicety: two of the three verdicts fire under their own face, and they are legible
because the glass is thin, translucent, and a good deal higher in z than a mark
riding at `cz + 0.5·KZ`, which projects it clear below the panel's silhouette.

### `BC1` is twice the size and `WHITELIST` sits under it

Set as one string, the three arches read as three instances of one label with a
digit buried in it; what a reader needs at a glance is **which round**. Two
lines, the same treatment every other named thing on this map gets.

**`dy` is measured from the big glyph's baseline**, so the 1.35 that works under
a normal name puts the second line inside a 2x one — 23% overlap, which
check-text caught on all three at once. 1.85 clears it.

**And the name is centred on the face's own tip edge.** Anchored `start` and
nudged off a corner it was a label parked beside a wide arch and it read as one.
The face is now a short cantilever and it *has* an end, so the name sits square
over that end: `text-anchor:middle` at the station's own x, `SC(0.95)` outward
in −y. Both edges of the face at constant y run at **+30° on screen**, which is
the angle the two lines are already set at, so a middle anchor at that x puts the
centre of the text on the centre of the tip edge and the two run parallel;
offsetting in −y — up and to the right — carries it clear of the panel without
moving it off that line. The second line's `dy` shifts it perpendicular to the
text, which reads as down-left on screen: both lines stay centred on the same
line, which is what a two-line stack does everywhere else on this map.

### Scan, then answer, and in that order

**The two are separate events with a gap between them, and the gap is the
point.** `LASW` is `SC(0.50)`: the laser is lit while the fragment is within
that of the station, brightest at the instant its own square is directly
beneath. `FIREAT` is `SC(0.62)` — deliberately **outside** that window. The beam
goes out, and a moment later the mark pops.

That ordering is the whole content of the station: it read, and *then* it
decided. Every arrangement that collapses the two is worse. Firing inside the
window draws one flash that is somehow both the question and the answer. Firing
at a fixed offset while the beam ran on its own clock — which is what shipped
for one build — draws a machine answering about something it is not looking at.

**Both numbers are pinned at both ends.** Keep `FIREAT > LASW` or the two
collapse back into a single event; keep `FIREAT` under `SC(0.9)` or the answer
arrives after the reject siding has begun to peel the fragment away, and a
verdict struck on a fragment that is visibly already leaving is a verdict
arriving after the decision. The same figure drives the block's own brightening
(`scanned`), so a barcode lights and its verdict lands together.

The marks are built before the scanners, so a tick rides above its block and
passes *under* the face — and the face is see-through, which is what it was
thinned for.

### Who fails is the figure, not a coin flip

A per-fragment random draw gives whatever it gives. At `NF=12` and `p=0.30` this
page's seed produced **twelve passes in a row** — the reject siding ran empty and
the bin was scenery, and nobody would have noticed from the code. Worse, the
picture would have changed the next time somebody re-spaced the belt: an
aggregate that moves when you change `NF` is not saying anything.

`FAILAT` names them. **3 of 12 is 25%, against the worked example's measured
24.3%** of reads carrying no valid barcode combination. They are spread down the
belt so they do not clump, and they fail at three *different* rounds, so every
gantry is seen to reject somebody and none of them is decoration.

### The deck is a platform, and the shredder is off the edge of it

`base` was **0.14** — a ghost of a surface, which was right while everything on
this station stood *on* it and nothing ever left. The reject path leaves it:
fragments run to the near edge, tip over it and drop onto a shredder standing on
the floor below. **You cannot fall off an edge that has no height.** `base` is
0.62 and `n.h` went 1.6 → 2.15 with it, which holds `KZ` — and therefore the
gantries — where they were. **Change one of those two and change the other.**
The deck's own fill went 0.10 → 0.32 for the same reason: an edge nobody can see
is not an edge.

The bin used to stand *on* the deck at the end of a siding, which is a place on
the same surface and reads as **sorting**. Beyond the edge and lower, the last
thing a rejected fragment does is leave the machine's own floor. Its top has to
sit **below** the height the fragments ride at, or they climb into it rather
than falling in.

### The bin is a shredder, and a shredder is loaded through its lid

It was a hopper lying **across** the siding; then it was a slot fed from the
side. Both were wrong about the same thing: **you do not push paper into the
side of a shredder, you drop it down the hole in the top.** A machine loaded
side-on is a chute, and a chute is a place things pass *through*.

**A pail with a shredder head on it.** As one slab it was a skip — a box you
throw things into, which is a picture of *storage*. The silhouette that says
shredder is two boxes: a bin, and a machine sitting across the top of it, wider
than the bin so the join reads as a lid rather than as a step. `binTop` **is**
that lid, and it has to stay below the height fragments ride at on the deck, or
they climb into it rather than falling in.

### The pose is two poses, and the discard stays flat

A fragment on this belt used to lie one way and one way only — broadside, long
in `y` — so a piece of it was a span of `y` at a fixed `x`. It has two:

| | | |
|---|---|---|
| broadside | long in ±y | the reading pose, under the scanners |
| end on | long in x | the discard pose, a quarter turn clockwise |

So a piece is a **segment between two base pairs along a direction, from an
anchor**. `PA`, `PD` and `PBP` are that pose, `ptOf(bp)` reads it, and `across()`
gives the width in the ground plane. **One anchor the whole way: its middle.**

**There was a third pose and it is gone.** A reject used to stand on end and feed
down through the slot, pivoting about its nose. That was a workaround for a slot
too short to take it lying down, and it looked like one: *nothing about a
discarded read turns it upright.* Widen the mouth and the molecule does not have
to do anything clever — it crosses to sit above the slot and drops in flat.

**The axis is still normalised** through the turn. Lerping the two components
without it shortens the molecule to 71% at the halfway point, which reads as the
thing shrinking as it turns.

### The slot is sized first and the box around it second

The slot is the only part with a constraint: a fragment drops through it lying
flat, so it has to be **longer than the fragment** and **wider than the
fragment's bar**. `SLOTX = FL·1.12`, `SLOTY = THK·2.8`, and `HEADX`/`HEADY`/the
pail are derived outward from those.

Sizing the box first and taking a fraction of it for the slot is what produced a
mouth **shorter than the thing going into it** — and that, rather than any
argument about shredders, is why the first version had to stand the fragment on
end to get it in at all. **When one part of an assembly has a hard constraint,
that part is the one with the free parameter.**

### And the lid does the disappearing

The bin is drawn **after** the fragments, so a thing at the slot goes behind the
machine's own top face and is gone. `vis` fades over the last of the drop as
well, which is belt and braces — but the occlusion is the part that reads.

**The per-base-pair clip is gone, and it is worth saying what it was for.**
While a reject was fed in *end first*, the honest way to draw it disappearing
was to stop drawing the part that had already gone through: `CUTBP` was the base
pair the blades had reached. That is the right mechanism for a thing consumed
**progressively**. It is the wrong one for a thing that **drops in** — a fragment
falling flat through a slot goes in all at once, and a clip would be a second
answer to a question the geometry already answers.

### `TIPB` is where the nose reaches the slot, and it lays out the yard

`TIPB` is not an offset from a mouth any more — the nose is **placed** at the
slot by interpolation — so it only has to be far enough back that the tip is not
travelling backwards, and far enough forward that the last gantry's divert is
finished first. **Move any one of `gx`, `MZ`, `binX` or `FLEN` and re-check
`TIPA > gx[2] + MZ`.** That is what moved `gx` up-belt to 2.4/5.9/9.4 and `MZ`
down to 2.6.

**The history is worth one line each, because two of the three drew nothing.**
Version one fed the fragment into the *side* of the bin and put `TIPB` a hair
before the blades — every reject was eaten before its tip began, so the fall ran
every lap and was never once seen. Version two moved `TIPB` to where the nose
met the blades, which worked, and then stood the fragment on end to feed it
through a slot too short to take it lying down. This one widens the slot instead
and the fragment stays flat.

The drop itself is `tip²` rather than `tip`, because a fall accelerates and a
linear one reads as a lift lowering.

### And it shreds, which is the honest verb

A bin that swallows is a bin that **stores**, and nothing is stored here: 24.3%
of reads carry no valid barcode combination and they are discarded with no
record of which ones.

**`CUTBP` is where the blades have got to, in the molecule's own base pairs.**
Anything past it is not drawn. Fading the whole fragment out was the first
attempt and it says the wrong thing: *a discarded read does not get dimmer, it
stops existing, and it stops existing from the end that went in.* Because the
discard pose puts the UMI end at +x and the slot is at +x, that end is the
high-bp end — so the clip is a single upper bound and needs no special case, and
the ticks riding on the blocks go with them.

**The cutters run only while something is in them.** A machine that turns all
the time is scenery; one that starts when a thing reaches it is a machine doing
something *to that thing*. They scroll along the slot and fade out over `RUNOUT`
once the last fragment is through, so it spins down rather than stopping dead.

**The siding stops at the edge.** It used to run all the way to the bin, which
drew a rail into a hopper on the same surface. There is no rail past the edge;
there is a drop.

### Slats, so the belt is a belt

Two rails and a centre line draw a *track*; what makes it a conveyor is that the
surface moves. The slats scroll at exactly the speed the fragments travel, which
is the claim: nothing here is pulled along by anything of its own, **the floor is
carrying it.** Built before the fragments, so they ride on top of it, and quiet
enough (0.30) to be texture rather than pattern.

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

### The panel is the whole face, and the face sits low

The panel used to be 78% of the arch's span, centred — which *is* centred and
does not look it: a slab narrower than the legs it sits on, floating above them,
reads as slipped rather than as inset. It was taken to the full span, and now
that the span is the R2 block the two are the same thing: **the face is the
panel, and `SCN_LEN` is both.** The whitelist slots run its length
(`hw = SCN_LEN/2 - SC(0.16)`), which is the better half of that change — the
scanner face shows the list it is checking against, right over the blocks it
checks.

**`gz` and `pgap` are in `YARD_ROUNDS`, not inline, because `NATZ` is built from
them.** Lower the face without lowering `NATZ` and `n.h` stops meaning the height
of the thing — the whole shape rescales under you. They went 1.05/0.66 to
0.66/0.40: high enough to be a gantry, low enough that it reads as standing over
its blocks instead of hovering up-left of them.

**The names hang past the tip of the face**, at `SCN_F - SC(0.95)`, centred —
see above. *NO MATCH* is placed off the bin's own foot at `base`, out from under
the reject tracks that reach it, so moving `REJ` and `binX` carried it along.

***VALIDATED TRIPLETS* is right of the mouth and above it**, at
`x1 + SC(1.05)`, `cy - FL/2 - SC(1.75)` — one move in world terms and two on
screen, since a little more x carries it past the end and a good way into −y
lifts it clear (−y is up-and-to-the-right here). A third of a fragment off the
far rail it still read as a label *on* the belt; up there it reads as what
leaves it, which is what it names. The track out still leaves from the **near**
rail, so the two never lie parallel.


**Three build-order facts do real work.** The verdict marks are built after the
fragments and *before* the scanners, so a tick rides above its block but passes
*under* the face. The falling fragments are under the scanners for the same
reason. The bin is built last, so a discarded triplet slides *behind* it and is
gone.

## `drawGeneBelt` — one function, two machines

**Aligning and assigning are two steps and they are drawn as two objects.** For
a while assignment was the far end of the alignment belt, which is tidy and says
the wrong thing twice over: that a read is carried between the two on one
surface, and that the two are one machine somebody named in halves. They are
not — the first reads the assembly, the second reads the model, and *a reader
who cannot see where one ends cannot see that there are two.*

`drawGeneBelt(g, n, MODE)` with `DRAW.belts` and `DRAW.assign` as the two
wrappers. What they share is everything about a gene and a read — the models,
the pile-up, the 3′ bias, the aerial, the names, the stack. What they do not
share is the **rain** (align only) and the **sweep, the bin and the tracks**
(assign only).

### The join is a fade, and an imperfect join is the honest one

Genes go out gently over the last fifth of `E4` and fresh ones appear over the
first fifth of `E5`. That is the same not-quite-connected the rest of this page
already uses: `E3`'s validated triplets fade at its mouth and fresh fragments
appear at `E4`. **Nothing on this map claims to have followed one molecule end
to end, and a belt running unbroken between two stations would.**

`E5`'s genes arrive **already covered**. The reads landed one station back;
drawing them falling again would say the alignment happens twice, so `kk` is
pinned to 1 in assign mode and the nozzle is unused.

### `K` comes off the depth, which is what lets two belts differ in length

It was `span/9.2` with the 9.2 in the divide, so widening a belt scaled the whole
machine. Then it was `span/BELTU`, which fixed that at the cost of two numbers
that had to move together. **Depth is the right source**: a gene lies *across*
the belt, so what sets its size is how wide the belt is, and the length is then
free. Give two belts the same `d` and they are the same machine at two lengths —
which is exactly what `E4` and `E5` are.

**The gene pitch is what is shared, not the count.** `NG` follows from `LOOP`, or
a short belt carries its models bunched and a long one strung out and the two
stop looking like the same conveyor.

**`PORTS.belts` and `PORTS.assign` both go through `beltRail()`**, which derives
`K` the same way `drawGeneBelt` does. A port that computes the rail its own way
lands on a rail that is not where the rail is — that went wrong once already,
when the port still divided by `BELTU`.

## The end of the assign belt: the gene rolls off, and nothing is handed across

**The model used to fade where the belt stops, which draws a thing being
switched off.** It drops instead — `roll²`, so it accelerates — and the fade
goes with it. `z` is the only axis this projection draws straight up, so a drop
is the one movement that cannot be mistaken for anything else. **Its reads go
with it.**

Nothing is carried to the next station. *Assignment ends with a read that has a
gene, bucketing begins with a read that has a barcode, and between those two
facts there is no conveyor* — so `E6` is its own machine and its reads rain onto
it fresh. That is the same join `E4` → `E5` uses and the same one `E3` → `E4`
has always used.

## `drawTracks` — E6, thirty tracks and a rain onto them

**The tracks were the far end of the assign belt for a while**, which drew the
reads being carried from one step to the next on one surface. They are not.

**They rain in the way they rained onto the models at `E4`**, and rain says
something a fade alone does not: the reads arrive *from a population*, one at a
time, in no order. One nozzle, up-track and above — *a spray whose own source is
spread out is a shower*.

**And this is where the blue leads.** On a gene the barcode end is the part with
**no** position and it stands off every axis that means one. On a track there is
no gene and nothing is being placed: what travels is the **read**, and the thing
that says which read it is is the **barcode**. So the blue lies along the track
with its **middle** on it and the aligned end takes over the pose the blue has
just given up. *The two swap, and the swap is the whole content of the step.*

**Same `d` as the two belts**, so `K` — which comes off the depth — makes a
fragment here the same size as the one that was riding a gene next door.

### Every read carries three facts, and the drawing shows all three

| fact | how it is drawn | why there |
|---|---|---|
| cell barcode | the **blue bar**, and the **track** it is on | it has carried it since `E3`; sorting by it is what this node does |
| gene | `--ok` text **along the orange**, at the orange's own angle | that verdict was struck one station back, on that end |
| UMI | `--accent` text **along the blue**, at the track's angle | it is R2's and has been R2's since `E2` |

**The gene is twice the UMI's size.** They are not two labels of equal
standing: the gene is the answer this row has been working toward since `E4`,
the UMI a serial number that means nothing until `E7` counts it. At that size
the gene overhangs its orange, and that is the trade — *the orange still says
which end it came off, which is all the underline was ever doing.*

**Each label lies along the segment it came off, so the two pieces of the
molecule *are* the two underlines** and no legend has to say which fact came
from which end. Both angles are taken off the projection (`ANGB`, `ANGO`) rather
than written down, and both read *back down* their segment — the reverse of its
own direction, because Latin type has to advance to the right and only one of
each segment's two directions does that here.

**The cell is not written on the read.** Writing it a dozen times over on one
track is a caption for the track, and the track already has one. *The sort key
belongs to the lane; the labels ride along.*

**The read is drawn `RS` = 2.9 times belt size**, both halves together so the
64 : 90 holds. At belt size the UMI's ten bases are three times the blue they
name. It is the same read, magnified — `E2` does the same thing for the same
reason. **`RS` trades against how many reads fit a track**: at 2.9 a fragment is
just under two units end to end and four fit a lap with room for their labels.
Push it further and the tracks thin out until the repetition stops being
visible, which is the one thing this station is for.

**Three type sizes, each set by what it has to sit over**: `CAP` (the field's
one caption, read once), `CFS` (a cell's name, over its track), `LFS` (a read's
gene and UMI, over their segments — **bold**, because at that size against this
grid weight is the only thing that makes them read as text).

### They repeat, and that is the whole setup for `E7`

A track carries **one or two genes over and over** — that is what depth on a
cell looks like — and **each gene has its own UMI pool**, smaller than the read
count and sampled with a skew, so most are unique and some turn up two, five, a
dozen times. **Per gene and not per track**: what `E7` collapses is cell *and*
gene *and* UMI together, so a repeated UMI carried by two different genes is not
a duplicate molecule — it is a collision between two, and drawing one gives the
next station a job it does not have. **If every read in a track looked distinct there would be nothing for
deduplication to do**, and the next station would read as an empty gesture.

Nothing is merged here. No counts, no collapsing: two reads that share cell,
gene and UMI are still two reads. *Drawing it early would spend the one thing
`E7` has to show.*

### It arrives in `E5`'s pose and unfolds into `E6`'s

**The two poses are the same molecule held two ways.** On a belt the **aligned**
end lies flat along the gene and the **barcode** end stands off it in `TDIR`:
the gene is the subject and the barcode has nothing to say. On a rail it is the
other way round — the **barcode** end lies flat along the track, *because the
track IS the barcode*, and the aligned end stands off in `TDIR` carrying the
gene's name. Same hinge, same angle, opposite arms. **Landing is where the read
stops being about a gene and starts being about a cell**, and this is that
sentence drawn.

**The reverse L, and how to check it.** The junction sits at the **right** end
of the orange, so the adapter comes off that side and the barcode end follows
it — the aligned end running *down-left* away from the hinge, which is how `E5`
draws it. With the ground arm's sign the other way the same three pieces make
the mirror image: a letter `L` instead of a reversed one, and the read stops
looking like the one that left the belt.

> **Do not compare the two stations by their raw polygon point lists.** `E5`
> goes through `barTo` and `E6` through `barTo2`, and **the two emit their four
> corners in different orders** — so a naive `points[0] → points[1]` reads one
> as its long axis and the other as its width, and two mirrored poses measure
> as identical. It cost a round trip. Take the direction from the **adapter's
> junction to the far end of each strip**, which no corner order can confuse.

**So it is not a rotation, it is an unfold.** Both arms swing about the one
hinge and swap places — the orange comes off the ground up onto the aerial while
the blue comes down off the aerial onto the rail — and **the adapter between
them (`J` → `J + TDIR·Ta`) is the same segment in both poses** and never moves
relative to the hinge. That is what keeps the two ends readable as one molecule
through the middle of the change.

`q` is **1 in `E5`'s pose and 0 in `E6`'s**, and it **holds at 1 through the
whole runway and the first half of the fall** — the shape has to register before
it changes, or the unfold is a flicker. It reaches 0 **as the read touches**, not
before: what lands is the pose the rail is drawn for.

**`q` is clocked off `kk`, not off `air`, and that is why the hold reads.** `air`
is `kk` raised to a power — it is the *height*, and it falls away fast by design
so the landing is soft. Clocking the unfold off it spent the hold in the first
sixth of the descent and then whipped through the change. *A curve shaped for
one job is the wrong clock for another.*

### The runway, and the bug it was hiding

**`PADA` ≠ `PADB`.** A read has to be in the air, in `E5`'s pose, travelling
downstream, long enough for a reader to take the shape in *before* anything
happens to it: five gene-units of open sky upstream of the first track, flown
level, over the tail of `E5`'s own belt. Downstream there is nothing to
establish, so `PADB` is almost nothing — a symmetric pad spends the same
distance again on an empty field after the last read has faded.

**The bug this uncovered.** `u0` used to be `0.10 + rnd()·0.16` against a fall
of `0.16`, so any read whose `u0` was smaller than the fall length **started
falling before its lap began** and appeared already a third of the way through
it. That is what *"it comes out of nowhere too close to the track"* was, and
it is also why the arrival pose never registered — there wasn't one. `u0` is
now measured from the runway's own end (`UBASE = PADA/LOOP + 0.03`), so every
read gets the whole of it. **`vis` fades up over the first of the runway**, not
over the first of the fall: *the point of a runway is to be seen flying along
it.*

**`E6`'s gap opened from 1.5 to 3.0 to make room for it**, and the band's `x1`
from 52.5 to 54.5 to hold the shift. Without that the birth point sits a third
of the way back along `E5`'s belt instead of at its tip.

**And it touches down *before* the first track** (`UBASE` = `PADA/LOOP − 0.075`),
not after it. The cell names live at the field's near end and run a unit and a
half along their own lines; a read still turning as it crosses them puts a whole
diagonal molecule through somebody's name. What passes through the names is now
a fragment lying flat on a rail, *which is what a rail is for.*

### The caption is three rows on the bottom-left edge

**Three rows and not one.** As a single line it was **wider than the field it
belonged to**, so it could not be both centred on the node and clear of the belt
one station back — every placement that fixed one broke the other. Broken over
three, the longest row is narrower than the edge it sits on and the problem
stops existing.

**The edge, not the centre.** The bottom-left edge of the footprint runs from
the left vertex to the bottom one — the far-side edge, running in `x`, so on
screen it lies at the tracks' own thirty degrees. The block is centred on its
midpoint (first row lifted a row, so the *middle* line takes the anchor) and set
just outside it.

**`G2b` moved to `R3+13.6` to get out from in front of it.** Nodes paint in
`(x+y)` order, which is depth — `G2b` at 47 is genuinely nearer the viewer than
`CB` at 41.5, so it *should* cover that ground. The fix is to move the card, not
to reorder the painter. Moving it upstream in `x` instead put its own labels
into `E5`'s; down-left in `y` is the direction with room.

### The blue carries weight from `E4` onward

It was drawn as a hairline on the belts (`RWB = RW·0.25`, floor `0.26`, opacity
`0.34`) on the argument that the gene is the subject there. True, but **it is
also the piece that carries the cell barcode into `E6`** — and a reader who
cannot see it on the belt cannot follow it onto the rail. `RW·0.42`, floor
`0.36`, opacity `0.58`. **On the rail it is the heaviest thing on the read**
(floor `0.44`): it is the sort key there, and the track it lies on *is* that
segment.

**And it comes off close and already spread.** `NOZX` / `NOZZ` put the start a
little up-belt and a little above, not out of a nozzle halfway across the map,
so it reads as the spill off the belt next door. `FAN` = 0.34 means the fan in
the air is already two thirds of the fan on the ground — at `FAN` = 1 every read
in the air sits over the field's centre line and the twenty tracks do all the
spreading at the last moment, which draws a jet rather than a fall.

### The empty tracks are the point, and the number is real

Three rounds of ligation address **96 × 96 × 96 = 884,736** cell barcodes per
subpool. The tracks are a **window onto that space** and are labelled with their
place in it — ascending, spread across it — rather than 1…20. **Most are empty
or nearly so**, and that emptiness *is* the unfiltered matrix: every barcode by
every gene, and the overwhelming majority of addressable barcodes were never a
cell. An even sprinkle would draw a machine working evenly, which is the one
thing this stage is not.

**Two counts are on this map and neither is wrong.** `W1` says 48 × 96 × 96 =
442,368 addressable **well paths**; this says 884,736 addressable **barcode
combinations**. BC1's 48 wells each hold two primers carrying different
barcodes, so there are 96 BC1 barcodes and only 48 BC1 wells. **Do not "fix" one
to match the other** — `W1`'s own prose now says both and why.

### `n.d` is the field and `n.gd` is the fragment

The only node where the two differ. On a belt they are one thing: a gene lies
across it, so the belt's depth sets the fragment's size. Here there is no gene —
`d` is how far the tracks spread, which is set by **having to write two rows of
type between neighbouring lines**, and sizing the fragments off that would make
them four times what they were one station back. `gd` is the belts' own depth,
so a read here is the read that was riding a gene next door.

## ② Unfiltered DGE — the matrix as relief

**What was wrong with the cube.** It was a cube with some voxels lit: a picture
of *"a matrix, sparsely filled"*. True, and it said nothing the words underneath
it did not. **The thing worth drawing is not that it is sparse — it is *how* it
is sparse**, which has a shape, and that shape is the most recognisable artefact
in the field.

**So the rows are sorted and their height is their count.** Every barcode gets a
row, ordered by how many transcripts it carries, and the height of that row is
that number. Sorted descending, **the surface *is* the barcode-rank curve** — the
knee plot, stood up as physical relief instead of plotted on axes. A short tall
ridge at the near edge, a cliff, and a plain that runs away almost flat.

**The cliff is the whole point.** Near side: the barcodes that were cells. Beyond
it: the ones that never were and never could have been — ambient RNA, sequencing
error, combinations that simply never happened — and there are hundreds of
thousands of them. **Nothing here is culled.** Keeping every one of those rows is
what makes it the *unfiltered* matrix and what makes it almost never shipped.

**The second axis is genes.** The lit cells on the tops of the rows are the genes
actually detected in that barcode, and there are more of them on the tall rows —
*not decoration, the same fact twice*: a barcode with more transcripts has more
distinct genes. The exponent is under one because the relationship saturates.

### The three things that had to be got right

- **The rank curve is two factors and both are real.** A hard sigmoid at the knee
  (`SS` = 7.5) *and* a slow decay across the plateau (`/(1+k·0.12)`). Without the
  second the ridge came out as one solid wall — which draws a population where
  every cell is the same size, the one thing no population of cells has ever
  been.
- **The floor is painted down to `fo` 0.34.** At the anchor skin's full strength
  its top face showed straight through the rows standing a few hundredths above
  it, and the plate read as a bright solid table with specks on. **Whatever is
  brightest here has to be the data.**
- **Far rows first.** Screen depth is `x + y`, so a nearer row is a row at larger
  `y` — and the tall ones are at the near edge, which puts the ridge in front of
  the plain it fell off.

**The sweep** is one soft band travelling the gene axis, lifting whatever it
passes. This object is written once and read by every QC stage after it, and a
matrix that just sits there does not say so.

**Two figures, both already asserted elsewhere on the page**: 884,736 barcodes
(`E6`, 96³) and 32,520 features (Ensembl GRCz11, the `G` cards). Their product —
28.8 billion entries — is arithmetic on those two, not a new claim. *No sparsity
percentage is stated, because the page has no figure that supports one.*

> `/bioinformatics_pipe` still draws this same matrix as the plain cube it used
> to be here. **The two pages no longer share the drawing** — only the object —
> and `UD`'s prose says so. Do not "restore" the cube to make them match.

## `E7` · Deduplicate UMIs — `E6`'s field, forked

**It is `E6`'s field and not a new one.** Same lane pitch, same lanes, same
molecule. *A reader who has just understood `E6` should not have to learn a
second machine* — the only new thing here is the fork.

**But the read arrives stripped: `RS` = 0.97, flat on the rail, no writing.**
`E6`'s read stands its aligned end in the air and writes its gene and UMI on
itself, because `E6` is where a read *acquires* those facts. By the time it
reaches here they have been read. **What `E7` is about is how many** — one number
that keeps going up and one that stops — and forty labelled molecules arriving at
the fork buried that under its own evidence. The molecule keeps its three parts
and its proportions and loses everything else: aligned end, adapter, barcode end,
in a line, in the order they travel. **The widths come off `K`, not `RS`**, so a
third-length fragment is a short solid bar rather than a hairline.

**The lanes are not named again.** `E6` names every one of them, at size, against
884,736; saying it a second time over the top of the fork is the same fact
competing with the only new one.

**Three or four reads a lane.** The traffic is set by the scanner's dwell, not by
how much fits on the rail — see *One cycle* below.

**The fork doubles the field.** Ten lanes in, twenty out, at the same pitch, so
`n.d` is exactly twice `E6`'s. Each lane's pair straddles **exactly twice** its
parent's offset from the centre line (`yIn(k) = cy + (2k+1−NL)·TP` sits half-way
between `yOut(2k)` and `yOut(2k+1)`), so the fan is a doubling and not a
reshuffle. **That is why `E6` dropped from twenty lanes to ten**: twenty in
would be forty out at half the pitch, and the split would be the one thing on
the page you could not see.

**The only merge on the map, and it must not look like a reject.** `E3` shreds
reads whose barcode is on no whitelist; `E5` shunts reads that landed on no
gene; both use the cull colour and a chute. A duplicate is neither — **it is one
molecule photographed twice** — so nothing here is binned and nothing thrown
away.

### Two tokens and no new hue

| road | colour | why that one |
|---|---|---|
| **READS** | `--fg2`, plain | an observation carries no encoding: it is a count of things that happened |
| **MOLECULES** | `--accent` | R2's colour and the UMI's, since `E2` — *a molecule is distinct exactly when its UMI is* |

**Neither is `--ok` or `--cull`, because neither road is a verdict.** The word
and the count sit together at the far end of each lane, in the lane's own
colour, **past where any read goes** — written along the rail they sat in the
traffic, and twenty more words in the part of the field already carrying a gene
name and a UMI per read is the difference between busy and unreadable.

### One cycle, and it is not a conveyor

Everywhere else on this page a thing travels at one speed and something happens
to it in passing. Here **the machine has to be seen asking**, so a read rolls in,
brakes, **stops**, is scanned along its barcode end, gets an answer, and only
then leaves. *A fragment that sails through a scanner at constant speed is a
fragment nobody looked at.*

| fraction of a lap | what happens |
|---|---|
| `0 → APP` (0.40) | rolling in at pace, braking over the last fifth |
| `APP → SCN` (0.50) | stopped; the beam sweeps the barcode end |
| `SCN → VER` (0.57) | stopped; the answer shows |
| `VER → SPL` (0.72) | away down the fork, accelerating from rest |
| `SPL → END` (0.96) | out to the far end — **where the count ticks** |

- **The dwell must be shorter than the gap between two reads on a lane**, or two
  are stopped under the beam at once and the queue reads as a pile-up. **Phases
  are exactly even, no jitter** — the spacing is load-bearing, not decoration.
- **Three or four reads a lane, and the stop is what sets it.** Six to eight fit
  the *track* — the fragment is short and the lap is long — but not the
  *scanner*: at seven, reads sit 0.14 apart against a 0.17 stop, so the next one
  arrives before the last has left and two fragments stand in the same place
  looking like one confused object. At four the gap is 0.25 and the beam is
  clear between every pair.

> **The queue is the constraint, not the rail.** Anything that lengthens the stop
> — a longer scan, a longer look at the answer — has to come out of the traffic,
> and anything that adds traffic has to come out of the stop.
- **The braking is confined to the last fifth of the run.** A single ease-out
  over the whole approach covers nine tenths of the distance in half the time,
  so every read spent its run-in loitering by the beam and the first half of
  every rail was bare. Both have to be true: **even spacing down the open track**,
  because that is what a lane of traffic looks like, and **a real stop at the
  end**, because that is what being scanned looks like.
- **Both bodies leave the fork from the same point at the same moment.** That is
  the whole reason the copy is not spawned off to the side: it is *the same
  fragment* until the fork and two fragments after it.
- **A tick rides with the copy all the way down the molecules road.** A cross
  fades once its read is through the fork.

**The cross is grey, not `--rej`.** The two marks are `E3`'s and `E5`'s, because
it is the same kind of event — a thing checked against a memory. The colours are
not. On this page `--rej` means *thrown away*, and a read the scanner has seen
before is neither wrong nor discarded: it goes down the reads road with
everything else. **Grey says "already counted", which is what happened.**

**Dimmed, not erased.** Held back too far, the reads road came out looking
*emptier* than the molecules road — the exact opposite of the fact this station
exists to show.

### The count ticks where the fragment lands

Not where it was judged. **The number going up and the thing arriving have to be
the same event**, or the counter is a number that changes on its own. The
molecules label takes a short pop as it happens: fast attack, short tail —
*eased both ways it read as a slow breathing of every number at once; what it
has to read as is a thing landing.*

### The two counts are not set as equals

**Reads is the number that keeps going up and means less the higher it gets** —
it is how many times the sequencer looked, and past saturation another million
buys almost nothing. **Molecules is the number that stops**, and where it stops
is what the cell actually had. So reads is small, light and faint — present and
checkable, and clearly the lesser fact — and molecules is large and solid.
*The typography is the argument.*

> **A note on a rule that was here and is gone.** When the reads still carried
> gene names, this field could not be laid out at all: a gene name rides at the
> tip of an aerial that reaches most of a lane pitch toward the rail above it,
> every lane here is busy by construction, and the pairs *move* — so no spacing
> cleared them at every instant and the check's failure count wandered run to
> run. The fix was a per-frame yield: a gene name that would arrive on the rail
> above it faded out. **Stripping the labels removed the problem instead of
> managing it**, and the yield pass went with them. Worth remembering if writing
> ever comes back to this field.

### The rest of the fork's arithmetic

- **The copy lags `LAG` behind the read it came from.** The children sit one
  pitch apart — `E6`'s pitch, which holds exactly one read and its two labels —
  so a copy travelling *abreast* puts its gene name through its parent's own
  rail. The lag reads as having taken the longer way round.
- **The copy's fade starts a quarter into the splay**, not at the fork: at the
  fork it is exactly on top of the read it came from, and two labels in one
  place reads as a rendering fault, not as a copy.
- **Three to four reads a lane, and that is the ceiling.** Every first sighting
  is drawn twice, so a lane of six is ten bodies with ten gene names across two
  rails.
- **Each lane's stream is turned 0.41 of a lap from its neighbour's**, far
  enough from a half and a third that ten lanes never come back into step.
- **The scanner's caption sits outboard of the post and above it**, on a
  hairline back to the beam. Written over its own machine it was unreadable, and
  *a question nobody can read is a question the drawing is not asking.*

### The tracks and their names

- **Spacing off the type.** A track only has to be as far from its neighbour as
  the barcode written above it is tall; the fragments on it are a bar a few
  hundredths of a unit wide and could be packed ten times closer.
- **`rotate(30)`, not `−30`.** A track runs along **+x**, and +x goes *down* and
  to the right on this projection; it is +y that goes up-right, which is why a
  gene name is set at −30. At −30 the thirty labels ran across their own tracks.
- **Appended last.** A fragment on a track stands its aligned end up and to the
  left, which is exactly where its own name is — drawn first, a dozen of the
  thirty were simply missing.
- **Not equally busy.** Half the tracks are empty, most of the rest carry one or
  two, and a few carry up to seven. *Twenty-four equally fed tracks draw a
  manifold, not a set of cells.*
- **A busy track is capped at four**, and the cap is the loop divided by how long
  a labelled fragment is: two reads on one line are two sets of labels on one
  line. It is a drawing limit and not a claim about depth — *the UMI pool is what
  says a read repeats.*
- **Track spacing is set by how far a fragment reaches toward the track above
  it**, not by the type alone: the aligned end stands up and up-belt, which on
  this projection lands ~5.8 screen units per unit of length toward the previous
  track — times `RS`, plus the gene name sitting over it. `S · cos30 · TP` is the
  clear air there. Twenty tracks at that spacing is what fits between the
  reference row and the band.
- **The field's caption holds `x - y` = `n.x - n.y`, and that is the whole of
  centring it.** Screen x is `(x - y)`, so a line placed at the middle of the
  tracks in `x` but at the field's far side in `y` is not under the node at all —
  it is a third of the map to the left, because `+y` carries it down *and* left.
  So the `y` is chosen for how far below to sit and the `x` **follows it**.
- **Centred and near pull apart here.** Holding `x - y` fixed means every unit
  closer in `y` is a unit further downstream in `x`, and the caption is wider
  than the field — so past a point its left end runs back through the ends of
  the tracks. The offset is that point plus a margin, and the gap that leaves
  between the last track and the line is the projection, not a mistake.
- **A tag stays off until its read is clear of the cell names.** Those sit at
  the field's near end and run about a unit along their own tracks; a read that
  lands under one puts its gene and UMI through the name of the cell in the next
  lane. That is the one collision here no amount of spacing fixes, because the
  two are on different lines going the same way.

## The assignment reads louder## The assignment reads louder

- **The gene lights up**, and it is **one** box rather than one per exon: at ten
  genes and eight exons apiece the per-exon version is 240 more boxes to rewrite
  every frame for a difference nobody could see. What has to read is that *the
  model* has claimed something, not which part of it.
- **The name grows and turns `--ok`.** `GFS` went `8.0·K` → `10.4·K` and the
  assign scale to `+0.95`.
- **The marks are pushed left, in screen units.** A mark is about a read, and the
  read is a line running up-right; sitting on top of it the two overlap and
  neither is legible. A world offset would have to pick an axis and *every axis
  here is diagonal* — the one direction that is unambiguously "off the read" on
  this projection is straight left.
- **The NO GENE MATCH bin is E3's bin's shape**, which is a **ratio and not a
  size**: slot 5.9 times as long as wide, pail and head 0.204 and 0.058 of the
  slot's length. Carry those three and the two boxes are one object at two
  scales. Left to itself this one came out nearly square, which is a different
  machine.

## `drawStarIndex` — the third reference figure

**It was a labelled cube, which is what the other two were before they were
drawn.** `G1` says which bases are where and `G2` says which stretches are a
gene; the index is what you get when the second is **baked into the first**, and
a cube said none of that — a reader had two drawn figures feeding an unlabelled
box that fed the aligner, which reads as a *step* rather than as a thing built
once and reused forever.

**A shelf of spines, because that is what the object is.** STAR's index is a
suffix array with the annotation compiled in: a structure whose whole purpose is
that you can go straight to the entry you want without reading what comes
before it. That is a library, and the visual idiom for one is a shelf.

Two things were got wrong first and are worth not repeating:

- **The spines were two units wide and read as a bar chart.** Bars are thin
  because their width means nothing; *a book's width is the first thing about
  it*. Wider and fewer, and the run reads as objects standing.
- **The shelf board was a line at the same `y` as the book bottoms**, so every
  book covered it and it showed only in the gaps — which at this scale is
  nothing. It is a `rect` **under** the spines now. A shelf you cannot see is a
  bar chart with extra steps.

**The lookup jumps; it does not sweep.** An index is a thing you *address*: what
a shelf cannot show standing still is that you do not walk it, you arrive at one
place on it. A sweep would draw a scan, which is the one access pattern this
structure exists to avoid.

### `tr` and `bl` — the two edges anybody can point at

These footprints are rectangles in the ground plane, and under this projection
two of their four edges are the ones a person would name:

| | |
|---|---|
| `"tr"` | the edge at **min y** — up and to the right |
| `"bl"` | the edge at **max y** — down and to the left |

Both are returned at their **centre**, by `edgePort()`. A corner is where two
edges meet and it belongs to neither: `roofCorner` is the right answer when a
line just has to leave from the side it is going, and the wrong one when the
drawing is meant to say *this edge feeds that edge*. The reference chain says
exactly that — assembly and annotation into the index, index into the aligner —
so it is drawn edge to edge.

`PORTS.belts` answers `"bl"` with the **belt's own near rail**, not the
footprint's near edge: the rail is what a reader sees as the machine's
bottom-left edge, and it is a good half unit inside the box the layout gave it.

### The row is arranged around those three tracks

For a track to read as *leaving* rather than doubling back, the destination's
bottom-left edge has to be at **lower y** than the source's top-right edge. That
one inequality fixes all four positions:

```
G1 tr  y +8.4   ->  G3 bl  y +8.1        G1 and G2 sit below the index
G2 tr  y +8.5   ->  G3 bl  y +8.1
G3 tr  y +4.3   ->  E4 bl  y +2.66       and the index below the belt
```

**The last one is the tight constraint and it is not about the footprint.**
`E4`'s box reaches y +3.3 but its drawn belt stops at +2.66, and the belt is
opaque and paints after the edges — so an index whose top-right edge is inside
+2.66 sends its track *under the deck*, where none of it survives. `G1` and `G2`
lost a unit of depth each to make room and both roofs reflow, which is what
`roofPanel` is for; the band grew to `R3+15.5` to hold them.

**`G3 → E4` took three tries and each failure was a different mechanism**, which
is the part worth keeping:

1. **Corner to corner was a stub.** `roofCorner` picks by distance to the
   destination's *centre*, and the two nearest corners were a unit apart.
2. **Then the occlusion clip ate it.** The feed lands on the belt's near rail,
   and the rail is inside `E4`'s footprint. `E4` carries `noclip:true` now — the
   third node on this page to need it, for the same reason every time. `G1`,
   `G2` and `G3` carry it too: they are flat cards, and a track that grazes one
   is hidden by the card itself rather than by a box around it.
3. **Then the opaque deck painted over it.** `gNode` paints after `gEdge`, and
   the corner `roofCorner` chose was at *low* y, so the track ran the length of
   the deck to reach a rail on the deck's near edge. Naming the edge fixed it.

**A note on the name.** This box is the STAR **index** and not the STAR
*aligner*: the aligner is `E4`, one station along. Every word of this node's
lifted prose is about the index, so the roof says index — if the two ever have
to agree on "aligner", the node they belong to is `E4`.

## The orange chain is off the map

**Every `--cull` track and every dot on one has been removed, on request.** All
five are written out in full in the `EDGES` block of `fq-data.js`, in a comment,
with their ports intact. Uncommenting them restores the chain and nothing else
has to move: the ports they used are all still on their shapes,
`PORTS.sortingyard` still answers `"tail"`, and the dots come back with the
edges.

**Be clear about what the map now says without them.** The header of `fq-data.js`
and this file both open with *"IT IS ONE CHAIN"*, and the chain **was** those
five lines: they are what made eight stations a sequence rather than eight
objects standing in a row. The stations are still in lane order and the reader
still walks them in order, so the *order* survives. What is gone is the
assertion that material moves along it — and the reference edges are now the
only edges on the page, which inverts the emphasis of the whole drawing: the
things chosen once and reused forever are drawn as connected, and the thing that
actually flows is not.

That is a claim change rather than a style change, and it is one line each to
put back.

## `drawAligner` — G1's figure read the other way round

**`E4` is the step; this is the result.** One belt with genes going past and
reads landing on them is what an aligner *does to one read at a time*. This is
the same operation seen from the other end: the assembly with reads on it, which
is what alignment *produces*.

**It uses `CHR_LAYOUT` and `CHR` — G1's own layout and G1's own lengths —
deliberately.** Same twenty-five ideograms, same order, same proportions,
because they are the same object; a second arrangement of chromosomes would be a
second genome, and a reader would have to work out whether it was one.

What changes is what is drawn on them. GRCz11 punches its bands out in `--bg`,
so a band is the roof showing through. This one leaves the bodies whole and lays
**stripes in `--cull`** across them — the read colour, drawn *across* the
chromosome because an alignment is a position on it and nothing else: not a
length, not a direction, not a depth.

**They light one at a time, and in no order.** A field of stripes all lit at
once is a map of *coverage*, which is a claim about how many and where. Lit one
at a time it is a machine **placing** them, which is a claim about what the step
does — and the order is shuffled rather than swept, because reads arrive in the
order the file has them and that has nothing to do with position on the genome.

**Nothing in the picture is measured, and the node's own prose says so twice.**
There is no per-read alignment record on this instance — no BAM, no coverage —
so the stripes are the *shape* of an alignment. **Do not add a count, a scale or
an axis to this roof** without the alignments to back it.

**The roof title is 12u where the karyotype's is 17u.** "STAR Aligner" is twelve
characters against GRCz11's seven, and at 17 it ran off the end of its own roof.
*A roof title is set to the word, not to a house style.*

## Connect two items — the one edit that adds something

Everything else in the editor **moves** what the data file already put on the
map. This puts a track on it that no file asserted, which is why it is a mode
inside Edit positions rather than a click: *a drag that sometimes creates a
track is a drag nobody can predict.* Press the button, click one object, click
another. Clicking the first one again cancels.

### Always the middle of an edge, never a corner

`roofCorner` picks the nearest **corner**, which is the right answer for a
reference line that only has to leave on the side it is going. It is the wrong
answer for a track somebody drew between two things: *a corner belongs to
neither of the edges that meet at it*, so a line leaving one reads as escaping
the box rather than as coming out of a face.

`faceMid(n,B)` takes all four edge midpoints and returns the nearest to the
other object, so **which** face is used follows from where that object is and
needs no bookkeeping. Both ends of every link go through it.

**It is resolved in `routeOf` before `PORTS` is consulted, on purpose.** `PORTS`
is keyed by *shape* and most shapes on this page have no entry — a link between
two of those would have fallen through to a centre-to-centre line, which runs
out of the middle of a box and through whatever is in the way. `faceMid` needs
nothing but a footprint, and every node has one.

### They are ordinary edges from the first frame

`LIVELINKS` is read at load and each pair is pushed into `EDGES` **before
anything reads it**, so links route, paint, carry dots, get clipped and get
repainted on a drag through exactly the same code as every authored edge.
Nothing downstream knows the difference except `link:true`, which is how they
are found again at save time. `addLink()` does the same three things at runtime
— `linkEdge()`, an entry in `edgeGeom`, dots from `makeDots()` — so a link drawn
by hand is indistinguishable from a loaded one on the frame it appears.

**`makeDots()` exists because of this.** The dot loop used to be inline in the
DOTS block; the Connect tool needs it after that block has run, and a second
copy drifts from the first the day one of them changes.

**A grey track with white dots**, and the split is deliberate: `tone` colours
the line, `dotTone` the dots. A white line would be the loudest thing on the
map, and *a hand-drawn connection is not a claim that outranks the drawn ones.*

### The bug worth keeping: the drag swallows the click

`begin()` calls `preventDefault()` and captures the pointer on the way down, so
**no `click` is ever delivered while a drag is armed.** The mode lit, the cursor
changed, and nothing happened. Taking `pointer-events` off `.ehandle` and
`.ehit` is not enough on its own — the press still lands on the node's own
group, which is where `begin` is attached. `begin` returns early while
`linking`, and connect mode owns the press.

This is also why `check-link.mjs` uses `page.mouse.click` and never
`dispatchEvent`: a synthetic click sails straight past a pointer capture, and
the check would have passed on a tool that did not work.

### Links are a list, not a table, and the merge is a union

They are kept **out of the offsets table**. The two answer different questions —
the table is *where is this object*, the list is *what did somebody join to
what* — and a list of pairs merged as if it were a table of keyed nudges would
lose one of any two links drawn in the same sitting.

**A pair is not a property of either end**, so "whose is this" cannot be asked
of one, and the per-key ownership rule the offsets merge runs on has nothing to
grip. The merge takes the **union** instead. Two people drawing in the same
sitting both keep their tracks; the one thing it cannot express is *deleting*
somebody else's link. That is the right trade for a mark this cheap to redraw
and this easy to lose by accident.

The record is `{offsets, links, at}`. Save prints a `LINKS` block for
`fq-data.js` beside the `OFFSETS` one, and `LINKS` in the data file is the baked
default — empty until somebody bakes one in.

**`SNIPPETS.link` is the one payload on this page that is about the map rather
than about the pipeline**, and it says so: *not a claim this page makes*. Every
other edge has prose beside it in `fq-data.js` saying what moves along it; this
one has a person's judgement and nothing else. It carries dots because tracks on
this map carry dots — a drawing convention, not a measurement.

## Two things placed on request, and what they cost

**`G2 → E5` is off the map.** The line is written out in a comment in `EDGES`
with the claim it drew: *the annotation has a second consumer, and it is `E5`
rather than `E4` — the aligner reads the index, and the thing that turns a
coordinate into a gene reads the model.* Uncomment it, or draw it by hand.

**There is a second `Ensembl 99`, and it is a copy rather than a claim.**
`G2b` — same figure, same size, same prose, unconnected, placed for the Connect
tool to wire up. Which also means **the map currently shows one file twice** and
says so nowhere but in the comment above the record.

**If it is meant to be the second annotation arm it needs its own name and its
own prose.** The arm this page has always described as staged-not-run is
GRCz12tu with Ensembl 2025_12, documented at `/grcz12`. A second box labelled
"Ensembl 99" is a duplicate; a second box labelled with the release it actually
is would be *the arm*, and would want a `G1b` beside it.

### It also broke a check, and the check was wrong

`check-text` matched each string to a building by `aria-label` and then looked
that building's roof up in a map keyed by **name**. With two nodes called
"Ensembl 99" the map held one entry, so one card's labels were tested against
the other card's roof and came back 100% off it.

**Name is not identity.** Node groups carry `data-id` now and the check keys off
it; the failure line prints both, because the name is what a person recognises
and the id is what the page means. Anything else that keys off a name is the
same bug waiting — the two "Ensembl 99"s are the first pair this page has ever
had, and they will not be the last.

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

### Three lists, three scanners, three lines — and each one joins its own pair

It was **one** line, from this node's corner to the far rail at the middle arch.
That is where a whitelist feeds, and it still left the only thing about this
pair worth drawing unsaid: **BC1's plate is checked by BC1's scanner and by
neither of the others.** Three rounds are three independent questions, and one
line collapsed them into a supply.

Each of the three now runs **from the bottom of a plate's own name to the top of
its scanner's own name** — label to label. That is not a decorative choice: at
this scale the names *are* the objects a reader is holding on to, and a line
between two small machines is a line you have to trace, where a line between two
words is a sentence.

**The ports are on the shapes, and they are measured off the text.**
`PORTS.whitelists` takes `bc1`/`bc2`/`bc3` and returns the point centred under
that plate's label block — under the *block*, so BC1's second row (*two primers
per well*) is cleared too rather than crossed. `PORTS.sortingyard` takes the
same names and returns the point just above the top of that station's `BC1`
glyph. Both go through `ROT30`, which brings an offset expressed **in the
label's own frame** — along the line it reads on, and up or down from its
baseline — back to the screen through the same rotation the text got. That is
what lets an edge land on the *top of a string* rather than at the point the
string was hung from.

`wlLayout()` exists for the same reason `yardMetrics()` does: the draw and the
port derive the layout **once**, together. A port that works out its own idea of
where a name is drifts off it the first time a plate width changes.

**W1 carries `noclip:true` because of this**, and it was the whole of the first
attempt's bug. A name sits *inside* its node's footprint, so the occlusion clip
cut every one of the three lines at the box edge and all three appeared to begin
in mid-air, a third of the way along. Nothing here is a solid — three plates,
three registries and the air between them — and the plates still paint over a
line that runs behind one, because `gNode` paints after `gEdge`. Same reasoning
E3 has carried all along, one object further back.

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

## The checks — run all seven

```bash
node check-text.mjs    <url>             # needs playwright
node check-clicks.mjs  <url>             # needs playwright
node check-edit.mjs    <url>             # needs playwright
node check-delete.mjs  <url>             # needs playwright
node check-persist.mjs <url>             # needs playwright
node check-drawn.mjs   <url>             # needs playwright
node check-link.mjs    <url>             # needs playwright
```

All seven pass as of this build, against `python3 -m http.server` over `public/`
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

- **`check-link.mjs`** drives Connect two items with a **real mouse** against a
  **stateful stub**: the button is hidden outside the editor, two clicks join
  two objects, the same pair cannot be joined twice, the track paints with white
  dots, Save carries it into the record, and it comes back in a browser that has
  never seen it. Three of those six were broken at some point while it was being
  built and none of them shows up in a screenshot.

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
- **Let a scanner at `E3` read more than its own square.** The aim is the one
  thing that distinguishes the three stations from each other, and a beam that
  travels a read is a beam reading all of it.
- **Collapse `E3`'s scan and its verdict into one event.** `FIREAT > LASW`, and
  both under `SC(0.9)`. See *Scan, then answer*.
- **Treat a gene name at `E4` as a claim about the model under it.** The symbols
  are real; the models are seeded. If one ever has to describe the other, the
  models come from the annotation.
- **Generate an exon at `E4` that is shorter than `RL`.** The placement clamps
  rather than rejects, so a read on one hangs off the end onto the intron and
  breaks the only claim this station makes in aggregate.
- **Give one half of a read a pixel floor and not the other.** Below a pixel the
  floor decides the widths, so a floor on one side silently inverts whatever the
  widths were set to say.
- **Widen `E4`'s shower past `0.1` of `u`.** `SHOWER_W + FALL` under the gene
  spacing is the whole guarantee that one gene is rained on at a time.
- **Call `E4`'s 3′ bias a coverage profile.** It is the shape of the bias with a
  stated reason, not a measurement; the alignments are not on this instance.
- **Put the orange chain back without reading the note on it.** It is one line
  each and it changes what the map claims, in both directions.
- **Let `E3`'s readout be driven by verdicts again.** The face is the reading,
  not a tally of what has been decided, and reading is fast.
- **Move any of `G1`/`G2`/`G3`/`E4` without re-checking the three `tr → bl`
  inequalities.** The belt's own near rail at +2.66, not the footprint at +3.3,
  is what the index has to clear.
- **Change `E3`'s `base` without changing its `n.h`.** `KZ` is derived from
  their sum and every gantry on the station scales with it.
- **Move `gx`, `MZ`, `binX` or `FLEN` without re-checking `TIPA > gx[2] + MZ`.**
  Got wrong twice; both times the fall ran every lap and was never once seen.
- **Pivot `E3`'s dive about the fragment's middle.** It has to turn about the
  end that is already in the machine, or it rises half its length to get there.
- **Reach for an opacity at `E4` before checking the width.** Under a pixel, a
  shape is drawn at partial coverage, which is indistinguishable from
  transparency.
- **Put a count, a scale or an axis on the aligner's roof.** The stripes are the
  shape of an alignment; the alignments are not on this instance.
- **Merge `LINKS` key by key.** A pair is not a property of either end. Union.
- **Arm a drag and a click on the same press.** `preventDefault` plus a pointer
  capture means the click never arrives — see Connect two items.
- **Land a hand-drawn link on a corner.** Both ends go through `faceMid`.
- **Key anything off a node's NAME.** Two nodes may share one; `data-id` is the
  identity. `check-text` shipped that bug for one build.
- **Size a `shredBin` before its slot.** The slot has the constraint — longer
  than what drops through it, wider than its bar — so the slot is the free
  parameter and the box is derived outward.
- **Derive `K` from a belt's length.** It comes off the depth, which is what
  lets `E4` and `E5` be different lengths and carry the same size of gene.
- **Join two belts with a continuous surface.** The fade at each end is the
  claim: nothing here followed one molecule from station to station.
- **Call `E4`'s intronic share a measurement.** It is tuned for legibility, like
  `E3`'s reject rate, and the real figures are in the prose.
- **Use `rd.f` anywhere a spliced read can reach.** It has `fA` and `fB`;
  `start` and `end` are the fields every read has.
- **Move `ASSIGN0` without moving `E5`'s footprint.** They are the same line
  written twice.
- **Key `E4`'s `gn.hid` off `vis`.** `vis` is the model; `live` is the group, and
  the lanes run after the model has gone.
- **Set the lane spread without the lane fade.** Push the spread past the fade
  and the reads that ran furthest ahead vanish before they are drawn.
- **Widen `LANEX` or `LANEP` without widening `E7`'s gap and `CB`'s footprint.**
  All of them describe the same field.
- **Set a label on the track field at −30.** Tracks run along +x, which is +30 on
  screen; −30 is the gene's axis, not the track's.
- **Draw the track names before the fragments.** A fragment stands its orange end
  exactly where its own name is.
- **Reconcile `W1`'s 442,368 with `E6`'s 884,736 by changing one of them.** They
  count wells and barcodes; both are on the map and both are right.
- **Write the cell barcode on the read at `E6`.** The track is the cell; the
  read carries the labels that are not the sort key.
