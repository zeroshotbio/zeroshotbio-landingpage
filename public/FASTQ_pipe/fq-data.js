/* ============================================================
   fq-data.js — what this map is ABOUT.
   Owned by the on-instance.

   THIS IS THE FASTQ-TO-MATRIX HALF OF ROW 3 OF /pipeline.

   On the big map the four rows are named "Biological samples", "Molecular
   biology", "Bioinformatics pipeline" and "Opinionated metadata". The third
   of those runs FASTQ -> counting stack -> unfiltered matrix -> six culls ->
   filtered matrix. This page is the FIRST half of it: everything between the
   reads and the first cube, and nothing after them. The culls are off this
   map — they are about what gets thrown OUT of a matrix, and this is about
   how one gets BUILT. They are drawn at /bioinformatics_pipe, which is this
   page's other half.

   EVERY NODE BELOW IS LIFTED VERBATIM FROM pipeline-data.js. Not re-typed —
   extracted as source text, so every character of every does/built/cond field
   matches the map it came from and a diff between the two stays meaningful.
   If a claim on that map changes, change it there and lift it again; do not
   let the two drift into two different accounts of the same stage.

   IT IS ONE CHAIN. IT WAS DRAWN AS A FORK AND THAT WAS WRONG.

   An earlier version of this page ran two parallel lanes out of E2 — orange
   cDNA below, blue barcode above — and joined them at the deduplication. That
   is not what split-pipe does, and it is not what any of the four counting
   stacks in the corpus does either. R1 and R2 are two ends of ONE read pair
   sharing one read ID; they are never separate objects and there is nothing to
   reunite. Barcode matching happens FIRST and everything downstream inherits
   its result. The fork was a picture of a data structure nobody builds.

   SIX STEPS BETWEEN THE READS AND THE MATRIX, IN ORDER
     E3  Match R2 barcodes   read 2's three ligation barcodes plus the UMI,
                             matched against the known well lists at one
                             mismatch. Reads that clear it go on; the rest are
                             discarded HERE, before anything expensive.
     E4  Align R1            read 1 is the cDNA and goes to STAR, against an
                             index built once per reference from FASTA + GTF
     E5  Assign to gene      aligned read -> a gene model from the GTF
     E6  Bucket by cell      group by the full barcode combination
     E7  Deduplicate UMIs    reads sharing cell, gene and UMI become one count
     E8  Unfiltered DGE      every barcode x every gene

   WHY THAT ORDER AND NOT ANOTHER. Alignment is the expensive step, and it is
   not spent on reads that could never be assigned to a cell — a quarter of them
   in the worked example. And a read that has cleared E3 CARRIES ITS CELL
   IDENTITY for the whole rest of the chain, which is what makes E7 possible at
   all: deduplication needs cell, gene and UMI together, so the bucketing by
   cell has to happen before it rather than after.

   Each is one of /pipeline's own row-3 nodes, lifted, and each keeps its
   lifted body. What is authored here is the NAME and the one-line sub, which
   say what this page draws at that station — on the big map a node has to
   carry the name the whole corpus uses for its stage, and those names are
   broader than the single operation drawn here. The pipelineName field
   carries the original name through to the reader so the two maps can still
   be matched up.

   NOTHING ON THIS PAGE IS MODELLED. There is no simulated population behind
   any of it, because there is no threshold on this stretch that has to be
   invented to be drawn: every figure quoted is read off an artefact — the
   vendor's own analysis_summary.csv, the delivered var, the provenance
   records for the four counting references. The one thing that cannot be
   shown is the reads themselves, and the page says so rather than drawing a
   stand-in.

   Load order: iso -> shapes -> data -> view
   ============================================================ */

/* The row sits at y = 0 here, because it is the only row. */
const R3 = 0;

const NODES = [

/* ---------------------------------------------------------------------------
   E · THE READS. Sample material: it flows once, per run, and is consumed.
   --------------------------------------------------------------------------- */

/* E1 and E2 are ONE DRAWING AND TWO NODES. The pool and the fragment are drawn
   by two shapes of this page's own, held together by the leaders between them.
   They are two nodes because the pool is a population and the fragment is a
   member of it opened up — a magnification is a change of subject, and a change
   of subject is a node rather than an arrow. E2 is NOT a fork; nothing on this
   page forks.

   Neither is a solid, so n.h on either is not the height of an object — it is
   where the name hangs, and the box the silhouette and the drag handle are cut
   from. plinth:false because nothing about the pool is on the ground.
   See drawPool / drawFragment in fq-shapes.js. */
{id:"FQ", key:"E1", group:"① The reads", groupMark:true, anchor:true, shape:"pool",
 lane:"r3", plinth:false, aims:"E2", ballZ:5.0,
 name:"FASTQ pool", x:1.0, y:R3, w:5.1, d:5.1, h:9.0,
 sub:"every read from the run, both mates, before anything has been interpreted", stat:"off-instance",
 does:"The first digital object, and the only genuinely shapeless one. Different libraries, different depths, no schema — and nothing in it yet says which barcode is a cell.",
 built:"For the worked example: sequenced 2026-03/04 and processed in the vendor's own cloud workdir, whose S3 path the run definition still points at. Demultiplexing is its own named step in some pipelines — Zebrahub records bcl2fastq v2.20.0.422 — and invisible in others.",
 cond:"The biggest hole on the map, and a general one. The reads are not on this box and no manifest of them is either, so every raw-read claim on this page is downstream of a vendor report rather than of the reads. It is worse elsewhere: ChemFish's pre-QC data is documented as unavailable, and CellOracle's SRA FASTQs are a deliberate non-acquisition. Re-deriving anything — a second annotation arm, a different intron setting — starts by getting the reads back.",
 /* ---- authored on this page, below the lifted fields ------------------ */
 pipelineName:"FASTQ",
 added:"A PILL, not a rectangle, and a real one: the reads are placed uniformly through a sphere in world coordinates and the sphere is stretched along y AFTER the turn — so the swarm churns as it always did inside a shape that holds still, lying on the same line the name reads on. They are placed turned by a real rotation and projected like everything else on this map, with depth driving size and opacity. The one being magnified is geometrically identical to every other read — same length, same weight, same wander. Only its colour and its ring say it is the one. Two leaders run from the ring's shoulders to the two ends of the opened fragment at E2, because a magnification is a frustum rather than a pointer, and they are recomputed every frame so they follow whichever of the two is dragged."},

{id:"E2", key:"E2", group:"① The reads", shape:"fragment",
 lane:"r3", noclip:true,
 name:"One fragment", x:6.0, y:R3, w:4.1, d:4.1, h:5.6,
 sub:"one molecule, sequenced from both ends, with an unsequenced middle",
 does:"ONE MOLECULE CARRIES EVERYTHING: the cDNA at one end, the three ligation barcodes and the UMI at the other, and a stretch in the middle that neither read reaches. R1 and R2 are two ends of one fragment sharing one read ID — never two objects and never separately routed. The barcode end is read first, and it decides whether the cDNA end is ever looked at.",
 built:"Paired-end, to the read structure in Appendix B: read 1 is 64 bases of cDNA insert, read 2 is 58 bases carrying barcodes 1 to 3 plus the UMI, and the i7 and i5 indexes are 8 bases each and carry the fourth barcode. Longer read 2 lengths are allowed and simply trimmed by the analysis pipeline.",
 cond:"The middle is not recoverable. Insert lengths vary and nothing sequences the span between the two reads, so a fragment is known at both ends and guessed in between — which is why fragment-level evidence for anything (isoform, fusion, allele) is out of reach for this chemistry no matter how deep the run goes.",
 /* ---- authored on this page ------------------------------------------- */
 added:"THE FRAGMENT IS DRAWN IN ITS OWN ORDER, NOT IN R2's ORDER. BC1 sits nearest the cDNA because reverse transcription attached it first, each ligation round adds the next one further out, and the UMI rides on the round-3 oligo at the far end. R2 sequences inward from that end — which is why it meets the UMI first and reaches round 1 last. Draw the molecule truthfully and the reversal explains itself. It is the one thing on this page not drawn in the isometric: a diagram OF a molecule rather than a thing standing somewhere on the map, so it is square to the reader. The arrowheads sit a little inside the ends they point at, because an arrow on the end reads as the place a read stops rather than the direction it travels. THE WIDTHS ARE THE REAL BASE PAIRS, measured off this run's own FASTQs rather than read off a config, because no run folder and no split-pipe config for it exist on this instance: R1 is 64 and R2 is 58, so the cDNA is slightly the longer of the two rather than the shorter as it was drawn; and read 2 is UMI 10, three barcodes of 8, two linkers of 12, which makes a linker one and a half times a barcode rather than twice it. Both errors flattered the barcode end. THE MIDDLE IS THE ONE FIGURE HERE THAT IS NOT MEASURED, and it is marked twice over so it cannot be mistaken for one. Read 2's 58 bases are barcode, linker and UMI end to end — not one base of cDNA — so the two reads never overlap and no paired-end inference is possible. What the reads do settle is that the middle is never short: read 1 essentially never runs off the end of its insert, so the span is longer than 64 bp and that is all they will say. The ~250 is an order of magnitude from the protocol's expected library size, it carries a tilde and a unit where every other figure is a bare number, and the segment is drawn with an axis break — at ~250 against a sequenced length of 122 it would be twice everything else put together, so the bar is a token and says so. NOTHING LEAVES THIS GLYPH FOR NOW — no track, no dots. It is a measured diagram of a molecule, and a line running out of it turns it back into a station on a route."},

/* ---------------------------------------------------------------------------
   THE CHAIN. Six stations on one line, in the order a read actually meets them.

   EVERY ONE OF THEM IS ON THE LANE NOW. They used to be side structures hung
   off E2 by follow{}, because two were on one branch and one was on another and
   the lane was only the spine between the fork and the join. There is no fork
   and no join, so there is no spine either — there is just the line, and
   everything that happens to a read happens on it.
   --------------------------------------------------------------------------- */

/* A SORTING YARD, not a box. w is the run of the whole yard, d is the deck
   from the top lane to the reject bin, and h is the top of the whitelist
   panels overhead — the layout is authored in its own units and scaled onto
   those three. See drawSortingYard in fq-shapes.js. */
/* noclip because the yard has no floor to hide anything behind. The whitelist
   line arriving from W1 was cut the moment it entered this node's silhouette —
   a track that stops a hundred pixels short of what it feeds. The yard's own
   graphics still paint over it where they overlap, which is the occlusion that
   was actually wanted. */
{id:"E3", key:"E3", group:"The chain", shape:"sortingyard", hatch:true, noclip:true,
 lane:"r3", gap:4.2, name:"Match R2 barcodes", x:14.0, y:R3, w:9.6, d:7.0, h:2.15,
 sub:"three barcodes, each against its own whitelist, one mismatch tolerated",
 does:"Reads the cell barcode off the reads and reconstructs which physical path each molecule took — through three barcode plates, or into one droplet, or onto one microwell bead.",
 built:"Four counting stacks appear across the corpus and they are not interchangeable: bbi-dmux → bbi-sci for sci-RNA-seq3 (ZSCAPE, ChemFish); Cell Ranger for 10x (DanioCell 4.0.0 wrapping STAR 2.5.1b, MIC-Drop-seq 5.0.0, Zebrahub 5.0.1, CellOracle 5.0.1); split-pipe v1.7.1 for Parse (MiniFin, MegaFin); STAR plus modified Drop-seq tools 1.12 for Microwell-seq (ZCL2). In the worked example, 75.7% of reads carry a valid barcode combination.",
 cond:"The version is load-bearing and it is often wrong in the record. MIC-Drop-seq's GEO metadata says Cell Ranger v7 on all 36 samples; the pipeline's own machine-written web_summary.html says 5.0.0 — and that difference decides whether introns were counted. Where a hand-typed field and a machine-written run artefact disagree, the artefact wins. Also worth noticing: the 24.3% of reads with no valid barcode are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Barcode calling",
 added:"Each of the three barcodes is matched independently against its own whitelist, one mismatch tolerated. Concatenate the three plus the subpool index and you have a cell identity — unique only WITHIN a subpool, which is the whole reason the fourth barcode exists. Two cells that took the same path through the three plates in different subpools are told apart by it and by nothing else."},

/* THE ONE STATION ON THIS PAGE THAT IS A SURFACE RATHER THAN A BOX. Four
   belts along the lane's own direction, carrying annotated gene models past;
   the reads fly in from up-belt and land on them. w runs along the belts, d
   across all four, and h is the whole stack — base, gene body, exon — so a
   resize rescales the machine rather than stretching it. See drawBelts. */
/* hatch:true still means "this stage destroys data" and still puts "drops" in
   the index — multimappers and unmapped reads are set aside here. What it no
   longer does is DRAW hatching, because drawBelts paints no faces for the
   pattern to go on. The claim survives in the index and in the prose; if a
   future belt wants it back it has to be part of the machine. */
/* NOCLIP, THE THIRD TIME THIS PAGE HAS NEEDED IT AND FOR THE SAME REASON EVERY
   TIME. The index's track lands on the belt's NEAR RAIL, and the rail is inside
   this node's footprint — n.d is 6.6 and the drawn belt is 5.3 — so the
   occlusion clip ate the whole line: it ran from G3's corner across the
   footprint to a point well inside it and not one pixel of it survived. Nothing
   here is a solid except the deck, and the deck paints over an edge on its own
   because gNode paints after gEdge. Punch the box out of the clip and the feed
   is visible on the ground and hidden under the machine, which is the occlusion
   that was actually wanted. */
{id:"E4", key:"E4", group:"The chain", shape:"belts", hatch:true, noclip:true,
 lane:"r3", gap:1.6, name:"Align R1", x:22.0, y:R3, w:6.6, d:6.6, h:0.62,
 sub:"the cDNA half hits the genome · produces coordinates",
 does:"Aligns the cDNA read to the genome and assigns it to a gene.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus — the variation is entirely in the annotation laid over it, and in what counts as being inside a gene. For the worked example: 46.1% of reads map to the transcriptome, exonic fraction 63.8%. For contrast, MIC-Drop-seq's 10x runs confidently map 92.4% to the genome and 72.7% to the transcriptome.",
 cond:"A 46% transcriptome mapping rate looks alarming and is not a failure — it is the 3′ UTR problem next door, unpatched. The gap between 46% here and 73% there is mostly annotation, not chemistry, which is why the reference nodes above this row matter more than they look.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Alignment",
 added:"THE INDEX IS NOT A STEP READS PASS THROUGH, IT IS A SURFACE THEY LAND ON, and that is why this station is drawn rather than labelled. One belt runs along the lane's own direction and the gene models lie ACROSS it — exons standing proud, introns flat between them, each model named along the near rail — and the reads rain in from up-belt and above, settle onto a moving target, and then ride along with the gene until it goes. Everything shares one velocity: slats, genes and landed reads. THE AGGREGATE IS THE ARGUMENT: nearly every read lands on an exon, and the ones that do not are the point of the second half of this belt. One worked example is a fact about that read; three hundred of them is a fact about the ANNOTATION, which is the half of the index the assembly cannot supply and the reason GRCz11 and Ensembl 99 are two nodes rather than one. SOME READS LAND ON INTRONS AND THAT IS DELIBERATE: reads land where the sequence matches and pre-mRNA is in the library, and those are the reads the next station has to decide about. The share drawn is tuned for legibility, like the reject rate at E3; the measured figures for this run are in HOW IT IS BUILT above, where 46.1% of reads map to the transcriptome against an exonic fraction of 63.8%. THE GENES FADE OUT AS THEY REACH THE END, and fresh ones appear at E5's own belt next door. That join is deliberately imperfect, the same way E3's validated triplets fade at its mouth and fresh fragments appear here: nothing on this map claims to have followed one molecule end to end, and a belt running unbroken between two stations would. And a few cannot land in one piece — they came from spliced mRNA and cover the end of one exon and the start of the next, so they arrive as two halves with an arc between them that never touches down over the intron. Those are the reads the sequence alone could not place. The reads are drawn in R1's own colour, the same one the track into this station carries, so the trail does not break at the moment it lands; the barcode end takes no position from any of this and is drawn saying so — half the width of the aligned end, and leaning off the gene's axis entirely. THE GENE NAMES ARE REAL ZEBRAFISH SYMBOLS AND THE MODELS UNDER THEM ARE NOT: every gene on this belt is a seeded arrangement of exons, real in kind with no real coordinates, and the names are there to say that these are ten different zebrafish genes rather than one gene drawn ten times. No name here describes the model it sits beside."},

/* E5 IS ITS OWN MACHINE, NOT THE FAR END OF E4's.

   For a while it was an outline over the downstream part of the alignment belt,
   which is tidy and says the wrong thing twice: that a read is carried between
   the two on one surface, and that the two are one machine somebody named in
   halves. They are not. The first reads the assembly, the second reads the
   model, and a reader who cannot see where one ends cannot see that there are
   two.

   THE JOIN IS A FADE AND THAT IS THE HONEST FORM OF IT. Genes go out gently
   over the last fifth of E4 and fresh ones appear over the first fifth here —
   the same not-quite-connected E3's validated triplets already use. Nothing on
   this map claims to have followed one molecule end to end, and a belt running
   unbroken between two stations would.

   SAME d AS E4, ON PURPOSE. K comes off the DEPTH now, so two belts that share
   a depth carry the same size of gene whatever their lengths are. Change this d
   and this station's models stop matching the ones next door. */
{id:"E5", key:"E5", group:"The chain", shape:"assign", hatch:true, noclip:true,
 lane:"r3", gap:1.5, name:"Assign to gene", x:27.0, y:R3, w:7.2, d:6.6, h:0.62,
 sub:"coordinates resolved against gene models · exonic by default",
 does:"Decides whether a read landing inside an intron counts toward its gene. It is one flag, it is almost never stated, and it changes the matrix materially.",
 built:"Cell Ranger flipped this default across exactly the versions in play: 5.0.0 counts no intronic reads and offers no option, 6.x makes it opt-in and off by default, 7.x turns it on by default. MIC-Drop-seq's released main-screen matrix was built with Include introns: False, discarding 9.1–9.5% of confidently-mapped reads against 76.5–77.3% exonic.",
 cond:"Three consequences, all worse than the version number. Reproducing that matrix requires Cell Ranger 5.0.0 specifically — a modern default produces a materially different object, silently. Cross-dataset depth comparisons are confounded in a known direction, because sci-RNA-seq3 runs on intron-rich nuclei while the 10x runs here used whole cells and threw the introns away. And low detection of a long or nuclear-retained transcript is weak biological evidence, because gene absence already has two non-biological explanations.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Intron inclusion",
 added:"On /pipeline this station is named for the switch rather than for the assignment, because the switch is the part of it nobody records — the assignment is assumed and the flag is the thing that goes missing. Whether intronic reads count moves totals substantially, and most for nuclei. ITS OWN MACHINE, NOT THE FAR END OF E4's. Genes arrive already covered in reads — they landed one station back and drawing them falling again would say the alignment happens twice — and appear fresh over the first fifth of this belt. Across the middle each model is CLAIMED: its name grows and turns green, and a mark lands on every read in turn from 5' to 3', because a verdict per read is a verdict per read and thirty marks appearing together would be a decision about the gene. READS THAT FELL ON INTRONS GET A CROSS and are shunted off to NO GENE MATCH, which is exactly what this step decides: whether an intronic read counts is --include-introns, a flag and not a fact, and this node is named for the flag. AT THE END THE MODEL ROLLS OFF THE EDGE and its reads go with it, gently. Nothing is handed across: E6's tracks are their own machine and its reads rain onto them fresh, the same not-quite-connected join this map uses everywhere it will not claim continuity. Assignment ends with a read that has a gene, bucketing begins with a read that has a barcode, and between those two facts there is no conveyor."},

/* ---------------------------------------------------------------------------
   G AND W · THE REFERENCE. A different class of thing from everything above:
   chosen rather than measured, built once and reused forever, arriving from
   outside the experiment — the same class as "The compounds" in the wet-lab
   half of /pipeline, and drawn off to the side for the same reason.

   ONE ARM IS DRAWN. A second index — GRCz12tu with Ensembl 2025_12 — is staged
   rather than in use, and it is at /grcz12 rather than here: two indexes mean
   two of everything from the alignment onward, and a map that draws a second
   arm nothing has been counted against claims a result that does not exist
   yet. If it is ever run, the branch goes back in the G lane as two pairs —
   the arms differ in BOTH files — and every station from E4 on gets its × 2.

   THE WIRING, WHICH IS NOT WHAT IT WAS. GRCz11 and Ensembl 99 both feed the
   STAR index, and the index feeds E4. Ensembl 99 ALSO feeds E5 directly: the
   GTF is baked in at index time and read again at the gene assignment, one file
   with two consumers. The whitelists feed E3, which is now the first station on
   the chain rather than the only stop on a branch.

   WHAT MARKS THEM IS THE SKIN, NOT THE EDGE. They wear SKIN.works where the
   stations wear SKIN.tile. Their edges used to be drawn still as well — dashed,
   dimmer, never given a dot — and that went too far: a dashed line nothing
   moves along reads as a footnote, and the reference is the single largest
   source of incomparability between two zebrafish atlases. They are proper
   lines with dots now, in a grey that is neither read's colour.
   --------------------------------------------------------------------------- */

/* NOT A CUBE ANY MORE. The assembly and the annotation are two files and two
   decisions, and what they actually contain is drawable — so they are drawn.
   Both are flat panels turned onto the map's diagonal, the same treatment the
   fragment gets: noclip because a panel is not a solid, and n.h is where the
   name hangs rather than the height of anything. See drawKaryotype and
   drawLocus in fq-shapes.js. */
/* NOT CUBES ANY MORE, BUT STILL BUILDINGS. The assembly and the annotation are
   two files and two decisions, and what they contain is drawable — so it is
   drawn, on the roof of a short flat prism, which is /bioinformatics_pipe's own
   idiom. The roof is NOT square: the aspect comes from w and d, and roofPanel()
   reflows the chart to it. See drawKaryotype and drawLocus in fq-shapes.js. */
{id:"G1", key:"G1", noclip:true, group:"G · genome, and W · whitelists", shape:"karyotype",
 follow:{a:"E4",dx:1.0}, name:"GRCz11", x:5.9, y:R3+11.4, w:4.0, d:6.0, h:0.5,
 sub:"the sequence · which bases are where",
 does:"The assembly. Which bases are where, and nothing else — no genes, no exons, no strand. Chosen, not measured.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus without exception, which is the one thing about the reference that IS comparable across all of them.",
 cond:"Sharing an assembly is a much weaker guarantee than it sounds, because it says nothing about the annotation laid over it — and the annotation is where four datasets on the same assembly end up with four different answers to 'which genes exist'.",
 added:"Drawn as its own node rather than folded into the index, because it is its own file and its own decision. Swapping it for GRCz12tu — staged, and documented stage by stage at /grcz12 — changes which bases are where, and therefore every coordinate downstream of the aligner. THE FIGURE IS THE 25 CHROMOSOMES AS IDEOGRAMS, ordered by length. The lengths are the real GRCz11 primary assembly in Mb; the banding and the centromere positions are NOT, and are generated from a seed — zebrafish has no standard cytoband table of the kind that exists for human. They are there to make the shapes read as chromosomes, not to be counted."},

{id:"G2", key:"G2", noclip:true, group:"G · genome, and W · whitelists", shape:"locus",
 follow:{a:"E4",dx:6.5}, name:"Ensembl 99", x:9.1, y:R3+11.8, w:4.0, d:6.6, h:0.5,
 sub:"the annotation · where genes start and stop",
 does:"Where genes start and stop, what survives splicing, what gets translated, which direction it is read. A separate file and a separate decision from the assembly.",
 built:"MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520 features. ZSCAPE and ChemFish use a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031. DanioCell uses Lawson v4.3.2, 36,250 released names. Zebrahub uses a custom reference, 32,057 plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason.",
 added:"This is the single largest source of incomparability between two zebrafish atlases, and it is a file somebody chose. Nothing downstream can recover which one it was. THE FIGURE IS A ZOOM: one chromosome, a window on it, and the locus that window opens — so the four claims an annotation makes are visible as shapes rather than as a sentence. Which stretches are a gene (the blocks), which parts survive splicing (every exon and every intron is named), which of those get translated (the tall blocks against the low ones at either end), and which way it is read (the chevrons). Transcription runs 5′ to 3′: the 5′ UTR is the front of the first exon, the coding sequence runs from there through the internal exons, and THE 3′ UTR IS THE TAIL OF THE LAST ONE AND MOST OF IT — which is why it is drawn as its own section with its own name rather than as a note off the end. Every assay on this map primes with oligo-dT, so that block is where the reads land, and it is the one whose zebrafish annotation is incomplete in both Ensembl and RefSeq. The structures are real in kind; the coordinates are not."},

/* A SECOND ENSEMBL 99, AND IT IS A COPY RATHER THAN A CLAIM.

   Placed on request, unconnected, for the Connect tool to wire up. Same figure,
   same size and same prose as G2, because that is what a copy is — which also
   means THE MAP CURRENTLY SHOWS ONE FILE TWICE and says so nowhere but here.

   IF IT IS MEANT TO BE THE SECOND ANNOTATION ARM IT NEEDS ITS OWN NAME AND ITS
   OWN PROSE. The arm this page has always described as staged-not-run is
   GRCz12tu with Ensembl 2025_12, documented at /grcz12 — see the note at the
   top of this file. A second box labelled "Ensembl 99" is a duplicate; a second
   box labelled with the release it actually is would be the arm, and would want
   a G1b beside it. Until then it is scaffolding, which is what the b says. */
{id:"G2b", key:"G2b", noclip:true, group:"G · genome, and W · whitelists", shape:"locus",
 follow:{a:"E4",dx:11.5}, name:"Ensembl 99", x:9.1, y:R3+11.8, w:4.0, d:6.6, h:0.5,
 sub:"the annotation · where genes start and stop",
 does:"Where genes start and stop, what survives splicing, what gets translated, which direction it is read. A separate file and a separate decision from the assembly.",
 built:"MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520 features. ZSCAPE and ChemFish use a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031. DanioCell uses Lawson v4.3.2, 36,250 released names. Zebrahub uses a custom reference, 32,057 plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason.",
 added:"This is the single largest source of incomparability between two zebrafish atlases, and it is a file somebody chose. Nothing downstream can recover which one it was. THE FIGURE IS A ZOOM: one chromosome, a window on it, and the locus that window opens — so the four claims an annotation makes are visible as shapes rather than as a sentence. Which stretches are a gene (the blocks), which parts survive splicing (every exon and every intron is named), which of those get translated (the tall blocks against the low ones at either end), and which way it is read (the chevrons). Transcription runs 5′ to 3′: the 5′ UTR is the front of the first exon, the coding sequence runs from there through the internal exons, and THE 3′ UTR IS THE TAIL OF THE LAST ONE AND MOST OF IT — which is why it is drawn as its own section with its own name rather than as a note off the end. Every assay on this map primes with oligo-dT, so that block is where the reads land, and it is the one whose zebrafish annotation is incomplete in both Ensembl and RefSeq. The structures are real in kind; the coordinates are not."},

/* DRAWN, NOT LABELLED, AND FOR THE SAME REASON THE OTHER TWO ARE. G1 says which
   bases are where and G2 says which stretches are a gene; this is what you get
   when the second is baked into the first, and as a small unlabelled cube it
   read as a STEP between them and the aligner rather than as a thing built once
   and reused forever. It is a shelf of spines now — a structure whose whole
   point is that you can go straight to the entry you want — with a lookup
   landing on one spine at a time. See drawStarIndex.

   THE WHOLE ROW IS ARRANGED AROUND THREE EDGE-TO-EDGE TRACKS, and that is what
   fixes these three positions. Each source leaves from the centre of its
   TOP-RIGHT edge and each track lands on the centre of a BOTTOM-LEFT one, so
   for a track to read as leaving rather than doubling back, the destination's
   bottom-left edge has to be at LOWER y than the source's top-right edge:

     G1 tr  y +8.4  ->  G3 bl  y +8.1      G1 and G2 sit below the index
     G2 tr  y +8.5  ->  G3 bl  y +8.1
     G3 tr  y +4.3  ->  E4 bl  y +2.66     and the index below the belt

   That last one is the tight constraint and it is not about the footprint: E4's
   BOX reaches y +3.3 but its drawn belt stops at +2.66, and the belt is opaque
   and paints after the edges. An index whose top-right edge is inside +2.66
   sends its track under the deck, where none of it survives. G1 and G2 lost a
   unit of depth each to make room; both roofs reflow, which is what roofPanel
   is for. Move any of the four and re-check the three inequalities. */
{id:"G3", key:"G3", noclip:true, group:"G · genome, and W · whitelists", shape:"starindex",
 follow:{a:"E4",dx:-1.5}, name:"STAR index", x:7.5, y:R3+6.2, w:2.2, d:3.8, h:0.5,
 sub:"GRCz11 + Ensembl 99, baked together · once, not per run",
 does:"The gene model reads are assigned against. Nominally a detail; in practice the single largest source of incomparability between two zebrafish atlases.",
 built:"Every dataset here is GRCz11, and yet: ZSCAPE and ChemFish share a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031 genes — byte-identical between them, all 32,031 coordinates matching position by position. DanioCell uses Lawson v4.3.2 via Cell Ranger, 36,250 released names. MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520. Zebrahub uses a custom reference called Danio.rerio_genome_Zebrabow_6, 32,057 ENSDARG plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason. What works instead is reconstruction from the builder's own code plus the released coordinates, which is how ZSCAPE's was recovered exactly. What does not work is asking the paper: ZSCAPE, ChemFish and Zebrahub name no GTF at all, and Zebrahub's was written off in 2026 after six sources were exhausted.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"The counting reference",
 added:"BUILT ONCE FROM THE ASSEMBLY AND THE ANNOTATION TOGETHER — the annotation is baked in at index time, not applied afterward. Not per run and not per sample: it is built once and then consumed by every run for as long as nobody changes it. IT IS DRAWN AS A SHELF, because that is what the object is — STAR's index is a suffix array with the annotation compiled into it, a structure whose whole purpose is that you can go straight to the entry you want without reading what comes before it, which is a library. It was a labelled cube for as long as this map existed, and a cube sitting between two drawn figures and the aligner reads as a STEP, something reads pass through. Nothing passes through this. The lookup jumps from spine to spine rather than sweeping along them, because an index is a thing you ADDRESS: a sweep would draw the one access pattern this structure exists to avoid. The spines come from a fixed seed and are real in kind with no real content — there is no claim here about how many entries a STAR index holds. It determines which transcripts are callable at all, which is why a second index built from a different assembly and a different annotation would produce a different matrix from identical reads. One is drawn, because one is what this run used."},

/* THREE PLATES AND A REGISTRY OVERHEAD, not a cube. w is the run of all three
   plus their gaps, d is the deepest plate and its register margin, and h is the
   registry's own top — the layout is authored in its own units and scaled onto
   those three. See drawWhitelists in fq-shapes.js. */
/* NOCLIP, FOR THE SAME REASON E3 CARRIES IT, ONE OBJECT FURTHER BACK. The three
   lines to the scanners now leave from under each plate's own name, and a name
   sits INSIDE this node's footprint — so the occlusion clip cut every one of
   them at the box edge and all three appeared to start in mid-air, a third of
   the way along. Nothing here is a solid: it is three plates, three registries
   and the air between them, and the plates themselves still paint over a line
   that runs behind one, because gNode paints after gEdge. Punch the box out of
   the clip and the departures are visible where the ground is empty and hidden
   where something actually stands. */
/* G4 · THE ALIGNER ITSELF, drawn as a figure rather than as a station.

   E4 is the STEP — one belt, genes going past, reads landing on them, which is
   what an aligner DOES to one read at a time. This is the same operation seen
   from the other end: the assembly with reads on it, which is what alignment
   produces. It is G1's own figure read the other way round, and it uses G1's
   layout and G1's lengths on purpose — a second arrangement of chromosomes
   would be a second genome.

   AUTHORED HERE IN FULL. /pipeline has no node for the aligner as an object
   (its row-3 node is the alignment step, lifted onto E4), so does/built/cond
   below are this page's own writing and are lifted from nowhere.

   NOTHING IN THE PICTURE IS MEASURED. There is no per-read alignment record on
   this instance, so the stripes are the SHAPE of an alignment and not a
   coverage track. See drawAligner. */
{id:"G4", key:"G4", noclip:true, group:"G · genome, and W · whitelists", shape:"aligner",
 follow:{a:"E4",dx:3.4}, name:"STAR Aligner", x:7.5, y:R3+5.9, w:4.0, d:4.4, h:0.5,
 sub:"read 1 against the index · a position, or nothing",
 does:"Takes read 1 and the index and answers one question per read: where on the assembly does this sequence sit, and does it sit anywhere uniquely. A read that lands in one place carries a coordinate from here on. A read that lands nowhere, or in several places, is set aside and never counted — the second deletion on this page, and the largest after the barcode parse.",
 built:"STAR is the aligner behind three of the four counting stacks in this corpus, sometimes named and sometimes wrapped: split-pipe runs it for the Parse datasets, Cell Ranger wraps its own build for the 10x ones, and ZCL2's Microwell-seq pipeline runs STAR plus modified Drop-seq tools 1.12. The STAR version actually recorded anywhere in the corpus is DanioCell's — Cell Ranger 4.0.0 wrapping STAR 2.5.1b. The rest are known only by their wrapper.",
 cond:"THE ALIGNMENT ITSELF IS NOT ON THIS INSTANCE. No BAM, no per-read record, no coverage — the raw reads stayed in the vendor's cloud workdir and what came back was a count matrix. So the one thing this station could be checked against is the one thing missing, and every figure about it on this map is a vendor report rather than a re-derivation. What IS recoverable is the reference: an index is a function of two files, and both of those are here.",
 pipelineName:"Alignment",
 added:"THE SAME TWENTY-FIVE CHROMOSOMES AS GRCz11, WITH READS ON THEM. G1's roof draws the assembly as an object — this is what there is; this one draws the same object as a result — this is where read 1 ended up on it. Same layout, same lengths, same ideograms, because they are the same object and a second arrangement of chromosomes would be a second genome. The stripes light one at a time and in no order: a field of them lit at once would be a map of coverage, which is a claim about how many and where; lit one at a time it is a machine PLACING them, which is a claim about what the step does. The order is shuffled rather than swept because reads arrive in the order the file has them, and that has nothing to do with position on the genome. NONE OF THE POSITIONS ARE REAL and none of them are counted."},

{id:"W1", key:"W1", group:"G · genome, and W · whitelists", shape:"whitelists",
 noclip:true,
 follow:{a:"E3",dx:1.4}, name:"Barcode whitelists", x:14.0, y:R3-7.0, w:8.4, d:2.9, h:3.5,
 sub:"the known well sequences for each ligation round · fixed by the kit",
 does:"The list of sequences that could legitimately be at each barcode position, one list per round of ligation. Fixed by the kit, not by the experiment.",
 built:"Three rounds of ligation give 48 × 96 × 96 = 442,368 addressable WELL PATHS — and 96 × 96 × 96 = 884,736 addressable BARCODE combinations, because BC1's 48 wells each hold two primers carrying different barcodes. The two numbers are about different things and both are on this map: the well count is what a physical path through the plates is, and the barcode count is what a cell identity can be, which is the space E6's tracks are a window onto, and the fourth barcode — the index read — splits the run into subpools. A barcode is called by matching each round against its own list, independently, one mismatch tolerated.",
 cond:"Reused forever and never recorded with the data. Every deposited matrix in the corpus assumes its whitelists and none of them ships them, so a barcode string in an obs index cannot be parsed back into wells without knowing which kit version produced it — and ZCL2's 18 nt barcodes need a 3 × 6 split that is nowhere stated.",
 added:"THREE PLATES IN THE SIZES THE CHEMISTRY ACTUALLY USES, with a registry hanging over each. All three share a well pitch, because real 48- and 96-well plates have the same wells — the 48 is simply a smaller plate. So BC1's plate is visibly two thirds the width of the others and still yields 96, because each of its wells holds two RT primers, an oligo-dT and a random hexamer, carrying different barcodes: barcodes rise from it IN PAIRS and singly from the other two. Same count, half the wells, two per well, shown in the motion rather than asserted in a caption. Each riser is exactly eight bases, and that is arithmetic rather than decoration — the dash pattern is fixed in screen pixels and the riser's length is derived from it, so eight dashes and seven gaps land on the line exactly. Each climbs to the registry overhead and is written in; the registry fills continuously, in order, and never empties. The barcodes are drawn in the page's brightest ink because these are the WHITELISTS, which is the one pun this map allows itself."},

/* ---------------------------------------------------------------------------
   THE LAST TWO STATIONS. Nothing meets here — nothing was ever apart. What
   happens is a regrouping and then a collapse.

   THE IDS DO NOT TRACK THE KEYS, ON PURPOSE. `id` is the stable name this
   object is known by in the saved-offsets table, so renaming one silently
   re-applies somebody's drag to a different building. When the chain was
   re-ordered the KEYS moved and the ids did not: id "E6" carries key "E7", and
   the new bucketing station is id "CB". The key is what the map shows and what
   the prose refers to; the id is bookkeeping and is allowed to look odd.
   --------------------------------------------------------------------------- */

/* NEW, AND IT HAS TO EXIST FOR THE NEXT ONE TO WORK. Deduplication needs cell,
   gene and UMI together — so the grouping by cell cannot come after it, which
   is where an earlier version of this page implicitly put it by having the cell
   identity arrive at the dedup node on its own branch. Lifted from /pipeline's
   "Combine and stamp", which is the same operation seen from the other end:
   the cell id is assembled out of the barcode rounds and every read carrying it
   lands in the same bucket. */
/* E6 IS ITS OWN MACHINE: thirty tracks and a rain of reads onto them.

   It was the far end of the assign belt for a while, which drew the reads being
   carried from one step to the next on one surface. They are not carried:
   assignment ends with a read that has a gene, bucketing begins with a read
   that has a barcode, and between those two facts there is no conveyor. So the
   reads rain in, the way they rained onto the models at E4 — fade out there,
   appear fresh here, which is the join this page uses everywhere it does not
   want to claim continuity.

   AND THIS IS WHERE THE BLUE LEADS. On a gene the barcode end is the part with
   no position and it stands off every axis that means one; on a track there is
   no gene, what travels is the read, and the thing that says which read it is
   is the barcode. So the blue lies along the track with its middle on it and
   the aligned end takes over the pose the blue has just given up.

   d IS THE FIELD AND gd IS THE FRAGMENT, and this is the only node where the
   two differ. On a belt they are one thing: a gene lies across it, so the
   belt's depth sets the fragment's size. Here there is no gene — d is how far
   thirty tracks spread, which is set by having to write two rows of type
   between neighbouring lines, and sizing the fragments off that would make them
   four times what they were one station back. gd is the belts' own depth, so a
   read here is the read that was riding a gene next door. */
{id:"CB", key:"E6", group:"The chain", shape:"tracks", noclip:true,
 lane:"r3", gap:1.5,
 name:"Bucket by cell", x:30.0, y:R3, w:5.4, d:16.4, gd:6.6, h:0.62,
 sub:"one index · bc1_bc2_bc3__sublibrary",
 does:"Stitches the per-library matrices into one and stamps each barcode with where it came from.",
 built:"For the worked example: split-pipe mode 'comb' over eight sublibraries. Cell ids come out as bc1_bc2_bc3__sublibrary — 01_01_05__s1 — so all four barcode rounds stay legible in the index itself.",
 cond:"86.1% of transcripts land inside called cells; the remaining 13.9% is the ambient pool and it is dropped here rather than kept as a background profile. Barcode conventions are a live trap whenever matrices are compared: ZCL2's 18 nt barcodes need a 3 × 6 split to parse, and MegaFin's vendor-well barcodes have 0% overlap with the same library's raw-combinatorial rebuild — the same cells, unjoinable.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Combine and stamp",
 added:"The barcode combination became a cell identity back at E3; this is where it becomes an ADDRESS. EVERY READ HERE CARRIES THREE FACTS and the drawing shows all three. The cell barcode is the blue bar it has carried since E3 — and the track it is on, because sorting by cell is the whole of what this node does. The GENE lies along the ORANGE, at the orange's own angle, so the aligned end underlines it, and it is drawn at twice the UMI's size — the two labels are not of equal standing, the gene being the answer this row has been working toward since E4 and the UMI a serial number that means nothing until E7 counts it. The UMI lies along the BLUE, at the track's angle, so the barcode end underlines that — the two pieces of the molecule ARE the two underlines, and nothing has to say which fact came off which end. The read is drawn larger here than on the belts for exactly that reason: at belt size the UMI's ten bases are three times the blue they name. It is the same read, magnified, the way E2 magnifies one read out of the pool. AND THEY REPEAT, WHICH IS THE SETUP FOR E7. A track carries one or two genes over and over, because that is what depth on a cell looks like; and each gene has its own UMI pool, smaller than the read count, so most are unique and some turn up two, five, a dozen times. PER GENE and not per track, because what E7 collapses is cell AND gene AND UMI together: a repeated UMI carried by two different genes is not a duplicate molecule, it is a collision between two. If every read in a track looked distinct there would be nothing for deduplication to do. THE EMPTY TRACKS ARE THE POINT. Three rounds of ligation address 96 x 96 x 96 = 884,736 cell barcodes per subpool, and twenty tracks here are a window onto that space, labelled with their place in it rather than 1..20. Most are empty or nearly so. That emptiness IS the unfiltered matrix: every barcode by every gene, and the overwhelming majority of addressable barcodes were never a cell. IT ARRIVES IN E5's POSE AND UNFOLDS INTO THIS ONE. The two are the same molecule held two ways: on a belt the aligned end lies flat along the gene and the barcode end stands off it, because the gene is the subject there; on a rail it is the other way round, the barcode end flat along the track because the track IS the barcode, and the aligned end standing off it carrying the gene's name. So the fall is not a rotation but an unfold — both arms swinging about the one hinge and swapping places, with the adapter between them the same segment throughout. It holds E5's shape for the first part of the fall and finishes the change as it touches, because landing is where a read stops being about a gene and starts being about a cell. It comes off close to the belt's end and already spread, which is the same fact drawn twice: this is the spill off the machine next door, not a jet from somewhere else. NOTHING IS MERGED HERE. No counts, no collapsing — a read that shares cell, gene and UMI with another is still drawn as its own read. That is E7's job and drawing it early would spend the one thing E7 has to show."},

/* GAP 2.6, NOT 0.8, AND IT IS THE LANE FIELD THAT SET IT. E4's kept reads run
   out down five lanes for 0.40 of the belt's length past its end, and CB's
   footprint is that field — so the next station on the row has to start after
   it or it stands in the middle of the traffic. Widen LANEX and widen this. */
{id:"E6", key:"E7", group:"The chain", shape:"tile", hatch:true,
 lane:"r3", gap:5.2,
 name:"Deduplicate UMIs", x:33.0, y:R3, w:1.9, d:1.9, h:1.35,
 sub:"barcode + gene + UMI collapse to one count · reads become molecules",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 built:"For the worked example, 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424. MIC-Drop-seq's four measured 10x runs sit at 51.5–53.4%.",
 cond:"Saturation around 0.4–0.5 is the corpus norm and it means depth is not saturated: read depth alone accounts for about a quarter of the worked example's cluster resolution. Any cross-dataset comparison of genes-per-cell has to control for it. ZCL2 cannot even be checked — its UMI length is not stated and is not recoverable from a count matrix.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"UMI collapse",
 added:"THE LOAD-BEARING NODE OF THIS WHOLE SEGMENT, and it is load-bearing because of what has already accumulated on the read rather than because two things meet here. It needs three facts at once — cell, gene, UMI — and by now the read has all three: the cell from E3, the gene from E5, the UMI carried in read 2 the whole way. NOTHING CONVERGES. An earlier version of this page drew two edges arriving here from two branches, which made the dedup look like an assembly step; it is a collapse. The UMI itself was stamped during reverse transcription, before any amplification, so every copy of one original molecule carries it — which is what makes this the step that undoes PCR rather than a step that guesses at it."},

{id:"UD", key:"E8", group:"② Unfiltered DGE", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3", gap:1.6,
 name:"Unfiltered DGE", x:37.0, y:R3, w:2.8, d:2.8, h:2.2, cells:8, fill:0.09,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Unfiltered matrix",
 added:"Cells by genes, with the 10-transcript floor already applied by split-pipe — which is a formatting decision about what is worth a row rather than a claim about what is a cell. Almost every row here is not a cell, deliberately: NOTHING IN THIS SEGMENT IS A CULL. Reads are set aside at the alignment and barcodes fail to resolve at the matching, but no cell is ever removed here, and the object is uselessly complete on purpose. The culls are the D lane, drawn at /bioinformatics_pipe, which begins at this cube — the same object, at the same size, from the same shape code and the same sparsity seed."},
];

const ROWS=[R3], MIRROR=29.0;

/* ONE LANE, AND NOW IT IS THE WHOLE E STORY. All eight stations are on it, in
   order, because a read meets them in that order and nothing leaves the line.
   The only things off the lane are the references — the genome pair above the
   row and the whitelists below it — and they are off it because they are a
   different class of object, not because they are a different route.

   The per-node gap:{} values are RATIOS, not distances: the engine scales every
   gap to fill x0..x1, so widening the lane keeps their proportions. E3 carries
   the largest one because the sorting yard's lanes run back past its own
   footprint to give arriving reads somewhere to land, and that run-in has to
   clear the fragment glyph in front of it. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:50.0, dir:+1},
];

/* Two edge classes, and the difference is the point.

   A read edge CARRIES: dots travel it, because material does. A reference edge
   is still:true — connected, dashed, dimmer, and never given a dot — because
   an index is built once and reused forever, and an edge that animates
   material down it every run asserts a per-sample cost that does not exist. */
const EDGES = [
  /* NO EDGE FROM THE POOL TO THE FRAGMENT, and none into the pool either.

     A track with dots on it means material moving from one object to another,
     and neither of those is happening here. The fragment is not somewhere the
     reads GO — it is one of them, drawn larger, and the two dashed leaders
     already say so. A track between them would double the claim and put dots
     on a magnification. And nothing arrives at the pool on this page: the run
     is upstream, on /pipeline, and the page opens on the reads rather than
     fetching them from somewhere.

     WHICH MEANS THE FIRST TRACK ON THIS MAP IS THE FORK. That is correct: the
     first thing that actually moves is a read leaving for its own lane. */

  /* ONE CHAIN, ONE COLOUR.

     The two tokens used to mean the two branches: --cull was R1 and --accent
     was R2, and every edge on the page was one or the other. With the fork gone
     that distinction has nothing left to distinguish, and keeping it would be
     the old claim smuggled through in paint. So the whole E chain is --cull —
     which is /pipeline's own colour for this row, and means here exactly what
     it means there: this is the material, and it is moving.

     --accent is now unspoken for, deliberately. A read that has cleared E3
     carries a CELL, and colouring reads by cell from E4 onward is the next
     thing this page has to do; the token is being kept back for that rather
     than spent on a distinction that no longer exists. Until the artwork pass
     lands, E3 still draws blue fragments and E4 still draws orange reads, and
     those two disagree with each other on purpose — the flow is right first.

     STRAIGHT, AND PORTED AT BOTH ENDS WHERE THE OBJECT IS BIG. E3 is 9.6 units
     long and E4 is 6.4; an edge aimed at either centre spends half its length
     inside the thing it is arriving at.

     NOTHING LEAVES E2 AT THE MOMENT. The E2 -> E3 track and its dots are
     deliberately absent while the fragment is being made accurate: the glyph is
     a measured diagram of a molecule, and a track running out of it turns it
     back into a station on a route. The chain therefore starts at E3 for now.
     PORTS.fragment is still there and still correct — it is what the edge will
     leave from when it comes back. */
  /* ---- THE ORANGE CHAIN IS OFF THE MAP, AND THIS IS WHERE IT WAS ---------

     Every --cull track and every dot on one is gone, on request. What was here:

       {a:"E3", b:"E4", kind:"read", straight:true, port:"tail", portB:"corner", tone:"var(--cull)"},
       {a:"E4", b:"E5", kind:"read", straight:true, port:"corner", tone:"var(--cull)"},
       {a:"E5", b:"CB", kind:"read", tone:"var(--cull)"},
       {a:"CB", b:"E6", kind:"cell", tone:"var(--cull)"},
       {a:"E6", b:"UD", kind:"cell", tone:"var(--cull)"},

     PUT THEM BACK BY UNCOMMENTING THOSE FIVE LINES. Nothing else has to move:
     the ports they used are all still on their shapes, PORTS.sortingyard still
     answers "tail", and the dots come back with the edges.

     BE CLEAR ABOUT WHAT THE MAP NOW SAYS WITHOUT THEM. The header of this file
     and the handoff both open with "IT IS ONE CHAIN", and the chain was those
     five lines: they are what made eight stations a sequence rather than eight
     objects standing in a row. The stations are still in lane order and the
     reader still walks them in order, so the ORDER survives; what is gone is
     the assertion that material moves along it. The reference edges are all
     that connect anything now, which inverts the emphasis of the whole
     drawing — the things chosen once and reused forever are drawn as
     connected, and the thing that actually flows is not. */

  /* THESE CARRY, AND THEY ARE GREY. They were drawn still — dashed, dimmer,
     never given a dot — on the argument that an index is built once and reused
     forever, so animating material down it every run asserts a per-sample cost
     that does not exist. True, and it cost more than it was worth: a dashed
     line nothing moves along reads as a footnote, and these are not footnotes.
     The reference is the single largest source of incomparability between two
     zebrafish atlases, and the whitelists are what a barcode means.

     So they are proper lines with dots on them, in a neutral grey that is
     neither read's colour — the fork owns orange and blue and nothing else on
     the map may borrow them. What still marks a reference as a different class
     of thing is the SKIN its node wears.

     STRAIGHT, ALL FOUR, for the same reason the two lanes arrive at the join
     straight: the elbow route puts a Z in a line whose whole content is "this
     feeds that", and a Z reads as a detour the thing actually takes.
  */
  {a:"G1", b:"G3", kind:"ref", straight:true, port:"tr", portB:"bl", tone:"var(--fg2)"},
  {a:"G2", b:"G3", kind:"ref", straight:true, port:"tr", portB:"bl", tone:"var(--fg2)"},
  {a:"G3", b:"E4", kind:"ref", straight:true, port:"tr", portB:"bl", tone:"var(--fg2)"},

  /* ---- G2 -> E5 IS OFF THE MAP, AND THIS IS WHERE IT WAS -----------------

       {a:"G2", b:"E5", kind:"ref", straight:true, port:"corner", tone:"var(--fg2)"},

     Removed on request. The claim it drew is still true and still worth
     drawing: the annotation has a SECOND consumer, and it is E5 rather than E4
     — the aligner reads the index, and the thing that turns a coordinate into
     a gene reads the model. Put it back by uncommenting that line, or draw it
     by hand with the Connect tool, which is what the second Ensembl 99 was
     added for. */

    /* THREE LISTS, THREE SCANNERS, THREE LINES — AND EACH ONE JOINS ITS OWN PAIR.

     It was one line, from this node's corner to the far rail at the middle
     arch. That is where a whitelist feeds, and it still left the only thing
     about this pair worth drawing unsaid: BC1's plate is checked by BC1's
     scanner and by neither of the others. The three rounds are three
     independent questions, and one line collapsed them into a supply.

     Each runs from the bottom of a plate's own name to the top of its
     scanner's own name — label to label, because at this scale the names are
     the objects a reader is actually holding on to, and a line between two
     small machines is a line you have to trace. The ports are on the shapes
     (PORTS.whitelists / PORTS.sortingyard), so they are measured off the text
     itself and stay off it when a plate or a station is resized. */
    /* THE SECOND ANNOTATION FEEDS THE ASSIGNMENT, and now that assignment is
     its own machine the port is simply that machine's near rail. It used to be
     four fifths along E4's belt, which was the best available answer while the
     two steps shared one surface: two consumers at two points on one machine.
     Two machines is the better answer, and it needs no special port at all. */
  {a:"G2b", b:"E5", kind:"ref", straight:true, port:"tr", portB:"bl", tone:"var(--fg2)"},

  {a:"W1", b:"E3", kind:"ref", straight:true, port:"bc1", portB:"bc1", tone:"var(--fg2)"},
  {a:"W1", b:"E3", kind:"ref", straight:true, port:"bc2", portB:"bc2", tone:"var(--fg2)"},
  {a:"W1", b:"E3", kind:"ref", straight:true, port:"bc3", portB:"bc3", tone:"var(--fg2)"},
];

/* One band, keeping its name from the big map. It has to reach the reference
   lane above the row and the whitelists below it. */
  /* THE REFERENCES CAME IN WHEN THE ROW STRAIGHTENED. They were hung off an E4
   that sat 3.4 units off the row and an E3 that sat 3.6 the other way; with
   every station back on y = R3 those offsets were 3-odd units of empty ground
   each, and the band had to be 29 deep to hold nothing. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-2.0, x1:52.5, y0:R3-9.6, y1:R3+16.8},
];

/* ONE CARRY, AT THE FAR END ONLY. The matrix leaves for the culls, which are
   drawn at /bioinformatics_pipe, and it fades rather than stopping because
   drawing a hard terminus would claim this stretch is self-contained and it is
   a middle.

   There is no inbound one. The reads do not arrive at the pool from anywhere
   on this page — the pool IS the start, and a track fading in toward it was a
   second way of saying what the page's own title already says.

   IT RUNS ALONG THE ROW, and it is ANCHORED TO ITS NODE rather than written
   down as coordinates — fixed coordinates stay put when the object they leave
   is dragged, so the map could be arranged into a state where the cells depart
   four units clear of the cube. */
const CARRIES = [
  {node:"UD", side:"out", gap:1.15, len:4.6, fade:"out", kind:"cell",
   from:"Unfiltered DGE", to:"the culls, drawn at /bioinformatics_pipe"},
];

/* ============================================================
   PAYLOADS
   Also lifted: the same records, moving along the same edges. The first one
   deliberately shows no reads, because the reads are not here — what travels
   the first track is everything that survives of them.
   ============================================================ */
const pick = a => a[Math.floor(Math.random()*a.length)];

/* head of minifin_filtered.h5ad, plus first cell of each perturbation */
const REAL_CELLS = [
 {cell:"01_01_05__s1", sample:"Ctrl_1",            pert:"DMSO",          sub:"1", b1:"A1", b2:"A1", b3:"A5",  tscp:9500, genes:3303, reads:17076},
 {cell:"01_01_95__s1", sample:"Ctrl_1",            pert:"DMSO",          sub:"1", b1:"A1", b2:"A1", b3:"H11", tscp:1934, genes:867,  reads:3475},
 {cell:"19_01_24__s1", sample:"Sorafenib_1",       pert:"Sorafenib",     sub:"1", b1:"B7", b2:"A1", b3:"B12", tscp:5047, genes:1984, reads:9075},
 {cell:"13_01_59__s1", sample:"Orlistat_1",        pert:"Orlistat",      sub:"1", b1:"B1", b2:"A1", b3:"E11", tscp:7655, genes:3083, reads:13856},
 {cell:"31_01_30__s1", sample:"Dapaglifozan_1b",   pert:"Dapagliflozin", sub:"1", b1:"C7", b2:"A1", b3:"C6",  tscp:4155, genes:2036, reads:7630},
];

/* head of var, minifin_filtered.h5ad */
const REAL_GENES = [
 {sym:"slc35a5", id:"ENSDARG00000000001", orig:"SLC35A5"},
 {sym:"ccdc80",  id:"ENSDARG00000000002", orig:"ccdc80"},
 {sym:"nrf1",    id:"ENSDARG00000000018", orig:"NRF1"},
 {sym:"ube2h",   id:"ENSDARG00000000019", orig:"UBE2H"},
 {sym:"nherf1",  id:"ENSDARG00000000068", orig:"NHERF1"},
 {sym:"dap",     id:"ENSDARG00000000069", orig:"DAP"},
];

/* the four feature universes, from the corpus provenance records */
const REAL_REFS = [
 {who:"ZSCAPE · ChemFish", stack:"bbi-dmux -> bbi-sci", ann:"Ensembl 99 + BBI 3' extension", n:"32,031",
  utr:"+500 bp, strand-aware, clipped on collision", note:"byte-identical between the two, position by position"},
 {who:"DanioCell",         stack:"Cell Ranger 4.0.0",   ann:"Lawson v4.3.2",                 n:"36,250",
  utr:"rebuilt 3' UTR models",                  note:"released NAMES, not genes - Cell Ranger de-duplicates symbols"},
 {who:"MIC-Drop · Parse",  stack:"Cell Ranger 5.0.0 / split-pipe", ann:"plain Ensembl GRCz11", n:"32,520",
  utr:"none",                                   note:"gene set identical across Ensembl 99-114 - the release cannot be dated"},
 {who:"Zebrahub",          stack:"Cell Ranger 5.0.1",   ann:"custom Danio.rerio_genome_Zebrabow_6", n:"32,057 + 3",
  utr:"unknown",                                note:"recipe unpublished; written off after six sources exhausted"},
];

/* per-sublibrary rows of all-sample/report/analysis_summary.csv */
const REAL_SUBLIBS = [
 {n:"Sublib1", id:"LV6001530579", cells:12656, reads:420996131, tscp:89158063, sat:0.370, q30:0.972, vbc:0.740, knee:613.7},
 {n:"Sublib4", id:"LV6001530639", cells:11611, reads:491944196, tscp:91763905, sat:0.486, q30:0.972, vbc:0.767, knee:684.5},
 {n:"Sublib6", id:"LV6001530676", cells:11477, reads:470748221, tscp:90973638, sat:0.448, q30:0.970, vbc:0.759, knee:681.1},
 {n:"Sublib7", id:"LV6001530694", cells:11152, reads:486116660, tscp:92322615, sat:0.462, q30:0.971, vbc:0.762, knee:711.2},
];

const REAL_NOTE = "Read off the artefact on the instance, not generated. The file it came from is named in the header of pipeline-data.js.";

/* ---------------------------------------------------------------------------
   HAND-DRAWN CONNECTIONS, baked.

   Pairs somebody joined with the Connect tool and then saved. They are a list
   rather than a keyed table because a pair is not a property of either end, so
   there is no key for one side to own — see the merge note in fq-view.js.

   THEY ARE NOT CLAIMS THIS PAGE MAKES ABOUT THE PIPELINE. Every other edge in
   EDGES is asserted here in prose alongside it; these are drawn on the map by
   hand and carry no argument. Keep them apart from EDGES for exactly that
   reason, and if one of them turns out to be a real claim, promote it into
   EDGES with a comment saying why.
   --------------------------------------------------------------------------- */
const LINKS = [
];

const SNIPPETS = {
  /* the one payload that is about the MAP rather than about the pipeline */
  link: () => ({label:"a connection drawn by hand", flag:"not a claim this page makes",
    note:"This track was drawn on the map with the Connect tool, not asserted in fq-data.js. Every other edge here has prose beside it saying what moves along it and why; this one has a person's judgement and nothing else. It carries dots because it is a track and tracks on this map carry dots — that is a drawing convention, not a measurement.", text:
`source     drawn in Edit positions
stored     LINKS in fq-data.js, and the shared record
payload    none — nothing is asserted to travel this`}),
  read: () => { const s=pick(REAL_SUBLIBS); return {label:"one library's reads", flag:"the FASTQs are not on this instance",
    note:"No read-level record can be shown: the raw files stayed in the vendor's cloud workdir. That is the corpus norm, not a local lapse. Below is everything that survives of the reads — the sequencing statistics the vendor reported.", text:
`sublibrary          ${s.n}
reads               ${s.reads.toLocaleString()}
transcripts         ${s.tscp.toLocaleString()}
saturation          ${s.sat.toFixed(3)}
valid_barcode_frac  ${s.vbc.toFixed(3)}
cDNA_Q30            ${s.q30.toFixed(3)}
cell_tscp_cutoff    ${s.knee.toFixed(1)}
paired-end: R1 cDNA · R2 bc1+bc2+bc3+UMI · index = sublibrary`};},

  ref: () => { const r=pick(REAL_REFS), g=pick(REAL_GENES); return {label:"one counting reference", flag:null,
    note:"One of the four feature universes in the corpus, from its sources/README.md provenance record. Same assembly, same species, four different answers to 'which genes exist'. The gene record below is from the worked example's own var.", text:
`used by       ${r.who}
stack         ${r.stack}
annotation    ${r.ann}
features      ${r.n}
3' UTR        ${r.utr}
note          ${r.note}
── one gene record, worked example ──
var_name      ${g.sym}
id            ${g.id}
genome        GRcZ11`};},

  cell: () => { const c=pick(REAL_CELLS); return {label:"one barcode", flag:null,
    note:"A real row of the delivered matrix, as it comes out of the matrix build. There is no pct_mito and no doublet score in it — those are computed by the culls next door, and the vendor did not ship them either.", text:
`cell_id      ${c.cell}
sublibrary   ${c.sub}
bc1_well     ${c.b1}
bc2_well     ${c.b2}
bc3_well     ${c.b3}
tscp_count   ${c.tscp.toLocaleString()}
gene_count   ${c.genes.toLocaleString()}
mread_count  ${c.reads.toLocaleString()}
cell_type    unknown          <- all 94,616 of them`};},
};

/* ============================================================
   OFFSETS — fine positioning, applied straight after layoutRows().
   Authored by dragging in the page's own "Edit positions" mode and pasted
   back here. Everything in this table is a NUDGE relative to what the lane
   engine computed, never an absolute coordinate, so re-solving the lane or
   inserting a step carries these along instead of fighting them.
     dx, dy      move the building, in world units
     ldx, ldy    move its name, on top of whatever lab:{} the node carries
   ============================================================ */
const OFFSETS = {
};

const OVERVIEW = {
  eyebrow:"Zeroshot · from /pipeline, row 3",
  title:"FASTQ → Unfiltered DGE",
  sub:"one fork, two joins, and a reference that is chosen rather than measured",
  does:`<p>Everything that happens between the reads and the first matrix on row 3 of <a href="/pipeline">/pipeline</a> — the band called <mark>Bioinformatics pipeline</mark>. Paired-end FASTQ goes in on the left; every barcode that ever appeared, against every gene, comes out on the right.</p>
<p><mark>It is one chain.</mark> An earlier version of this page drew it as a fork — orange cDNA below, blue barcode above, rejoining at the deduplication — and that was a picture of a data structure nobody builds. R1 and R2 are two ends of one read pair sharing one read ID. They are never separate objects, so there is nothing to reunite.</p>
<p><mark>The barcode comes first, and that ordering is the argument.</mark> Read 2's three ligation barcodes are matched against their whitelists before anything else happens. Reads that clear it go on; the quarter that do not are discarded there. Alignment is the expensive step and it is not spent on reads that could never be assigned to a cell.</p>
<p><mark>A read that has cleared E3 carries its cell for the whole rest of the chain.</mark> Which is what makes the deduplication possible at all: it needs cell, gene and UMI at once, so the bucketing by cell has to happen before it rather than after. Six stations, in the order a read meets them — match, align, assign to gene, bucket by cell, collapse UMIs, matrix.</p>
<p><mark>The reads themselves are drawn once, and only once.</mark> A pool of them turns in the air, and one — geometrically identical to every other, marked only by its colour and its ring — is opened up in the diagram hanging beneath it: cDNA, the middle neither read reaches, then the three ligation barcodes and the UMI. It is drawn in the molecule's own order rather than in the order R2 reads it, because <em>that</em> is what explains the reversal: BC1 is nearest the cDNA since reverse transcription attached it first, the UMI rides on the round-3 oligo at the far end, and R2 sequences inward from that end — meeting the UMI first and reaching round 1 last.</p>
<p><mark>Nothing in this segment is a cull.</mark> Reads are set aside — a quarter of them carry no valid barcode combination and never reach the alignment, and multimappers and unmapped reads are dropped after it — but no cell is ever removed here. The matrix at the end is deliberately, uselessly complete; the culls are the D lane, drawn at <a href="/bioinformatics_pipe">/bioinformatics_pipe</a>, which begins at this cube.</p>`,
  built:`<p><mark>Three lanes, and they are not the same kind of thing.</mark> The <mark>E lane</mark> is sample material: it flows once, per run, and is consumed — one line, every station on it. The <mark>G lane</mark> (the genome) and the <mark>W lane</mark> (the barcode whitelists) are references — chosen rather than measured, built once and reused forever, arriving from outside the experiment. They are the same class as <em>The compounds</em> in the wet-lab half of the big map, and they sit off to the side for the same reason: they are a different kind of object, not a different route.</p>
<p><mark>But they are not drawn as flowing.</mark> A drug library is consumed; a STAR index is not. An edge that animates material down it every run asserts a per-sample cost that does not exist — so a reference edge is connected, dashed and dimmer, and never carries a dot. It is the distinction <a href="/data_structures">/data_structures</a> already makes between <em>has carried bytes</em> and <em>written · never run</em>. The reference objects wear a different skin from the stations for the same reason.</p>
<p><mark>The assembly and the annotation are two nodes, not one.</mark> They are two files and two independent choices, and the index is built from them <em>together</em> — the annotation is baked in at index time, not applied afterward. Which is why they live in the G lane rather than in the E lane.</p>
<p><mark>Ensembl 99 is one file with two consumers.</mark> It is baked into the index that the alignment uses, and it is read again at the gene assignment — so it is one box with two arrows leaving it, rather than two annotation nodes. The aligner itself reads neither file directly: it reads the index, which is why the FASTA and the GTF run to the index and the index runs to the aligner.</p>`,
  cond:`<p class="cond"><mark>One index is drawn, because one is what this run used.</mark> A second — GRCz12tu with Ensembl 2025_12 — is staged rather than in use, and the provenance for it is at <a href="/grcz12">/grcz12</a> stage by stage. It is not on this map: two indexes would mean two of everything from the alignment onward, and a map that draws a second arm nothing has been counted against is claiming a result that does not exist yet.</p>
<p class="cond">What the single index does assert is how much rides on it. Every dataset in the corpus is GRCz11 and four of them still count against four different feature universes — 32,031 · 36,250 · 32,520 · 32,057 + 3 — so the assembly agreeing is a much weaker guarantee than it sounds. The gene set cannot even date the build: it is identical across Ensembl 99 to 114.</p>
<p class="cond">Nothing on this page is modelled: every figure is read off an artefact — the vendor's own <em>analysis_summary.csv</em>, the delivered <em>var</em>, the corpus provenance records. The one thing that cannot be shown is the reads themselves, which stayed in the vendor's cloud workdir; the payload on the first track is the sequencing statistics that survive of them, and it says so rather than drawing a stand-in.</p>
<p class="cond">The settings that decide the most are the ones nobody records. MIC-Drop-seq's GEO metadata says Cell Ranger v7 across all 36 samples while the pipeline's own machine-written summary says 5.0.0 — and that single difference decides whether intronic reads were counted. Where a hand-typed field and a run artefact disagree, the artefact wins.</p>`
};
