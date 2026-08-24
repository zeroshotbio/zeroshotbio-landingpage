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

   SIX STEPS BETWEEN THE READS AND THE MATRIX
     Barcode parse    read 2's three ligation barcodes plus the UMI, matched
                      against the known well lists at one mismatch
     Genome index     built once per reference from FASTA + GTF, not per run
     Alignment        read 1 is the cDNA and goes to STAR
     Gene assignment  aligned read -> a gene model from the GTF
     UMI dedup        reads sharing barcode, gene and UMI become one count
     Cell assignment  group by the full barcode combination, floor, emit MTX

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
   They are two nodes because THE FORK IS AT E2: one molecule sequenced from
   both ends, R1 leaving for the genome and R2 for the whitelists, and a
   transition that splits the segment into two independent problems is a node
   rather than an arrow.

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
 added:"A ball, not a rectangle, and a real one: the reads are placed uniformly through a sphere in world coordinates, turned by a real rotation and projected like everything else on this map, with depth driving size and opacity. The one being magnified is geometrically identical to every other read — same length, same weight, same wander. Only its colour and its ring say it is the one. Two leaders run from the ring's shoulders to the two ends of the opened fragment at E2, because a magnification is a frustum rather than a pointer, and they are recomputed every frame so they follow whichever of the two is dragged."},

{id:"E2", key:"E2", group:"① The reads", shape:"fragment",
 lane:"r3",
 name:"One fragment", x:6.0, y:R3, w:4.1, d:4.1, h:3.2,
 sub:"one molecule, sequenced from both ends, with an unsequenced middle",
 does:"THE FORK. A single fragment carries everything: the cDNA at one end, the three ligation barcodes and the UMI at the other, and a stretch in the middle that neither read reaches. R1 goes to the genome and R2 goes to the whitelists, and from here to the deduplication they are two independent problems.",
 built:"Paired-end, to the read structure in Appendix B: read 1 is 64 bases of cDNA insert, read 2 is 58 bases carrying barcodes 1 to 3 plus the UMI, and the i7 and i5 indexes are 8 bases each and carry the fourth barcode. Longer read 2 lengths are allowed and simply trimmed by the analysis pipeline.",
 cond:"The middle is not recoverable. Insert lengths vary and nothing sequences the span between the two reads, so a fragment is known at both ends and guessed in between — which is why fragment-level evidence for anything (isoform, fusion, allele) is out of reach for this chemistry no matter how deep the run goes.",
 /* ---- authored on this page ------------------------------------------- */
 added:"THE FRAGMENT IS DRAWN IN ITS OWN ORDER, NOT IN R2's ORDER. BC1 sits nearest the cDNA because reverse transcription attached it first, each ligation round adds the next one further out, and the UMI rides on the round-3 oligo at the far end. R2 sequences inward from that end — which is why it meets the UMI first and reaches round 1 last. Draw the molecule truthfully and the reversal explains itself. It is the one thing on this page not drawn in the isometric: a diagram OF a molecule rather than a thing standing somewhere on the map, so it is square to the reader. The arrowheads sit a little inside the ends they point at, because an arrow on the end reads as the place a read stops rather than the direction it travels."},

/* ---------------------------------------------------------------------------
   R1 · THE cDNA HALF. Off the row and above it, because it runs in parallel
   with the barcode half rather than after it.
   --------------------------------------------------------------------------- */

{id:"E4", key:"E4", group:"R1 · the cDNA half", shape:"tile", hatch:true, tag:"× 2 ARMS",
 follow:{a:"E2",dx:5.0}, name:"Align R1", x:11.0, y:R3-2.8, w:1.9, d:1.9, h:1.5,
 sub:"the cDNA half hits the genome · produces coordinates",
 does:"Aligns the cDNA read to the genome and assigns it to a gene.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus — the variation is entirely in the annotation laid over it, and in what counts as being inside a gene. For the worked example: 46.1% of reads map to the transcriptome, exonic fraction 63.8%. For contrast, MIC-Drop-seq's 10x runs confidently map 92.4% to the genome and 72.7% to the transcriptome.",
 cond:"A 46% transcriptome mapping rate looks alarming and is not a failure — it is the 3′ UTR problem next door, unpatched. The gap between 46% here and 73% there is mostly annotation, not chemistry, which is why the reference nodes above this row matter more than they look.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Alignment",
 added:"The first of the two joins: R1 meets the index. Multimappers and unmapped reads are set aside here rather than counted — which is a loss of reads and not a cull, because no barcode is removed and nothing downstream knows a cell by fewer of them. THIS NODE AND EVERY ONE AFTER IT EXISTS TWICE, once per annotation arm, which is what the two indexes above it mean."},

{id:"E5", key:"E5", group:"R1 · the cDNA half", shape:"tile", hatch:true, tag:"× 2 ARMS",
 follow:{a:"E2",dx:9.5}, name:"Assign to gene", x:17.0, y:R3-2.8, w:1.9, d:1.9, h:1.1,
 sub:"coordinates resolved against gene models · exonic by default",
 does:"Decides whether a read landing inside an intron counts toward its gene. It is one flag, it is almost never stated, and it changes the matrix materially.",
 built:"Cell Ranger flipped this default across exactly the versions in play: 5.0.0 counts no intronic reads and offers no option, 6.x makes it opt-in and off by default, 7.x turns it on by default. MIC-Drop-seq's released main-screen matrix was built with Include introns: False, discarding 9.1–9.5% of confidently-mapped reads against 76.5–77.3% exonic.",
 cond:"Three consequences, all worse than the version number. Reproducing that matrix requires Cell Ranger 5.0.0 specifically — a modern default produces a materially different object, silently. Cross-dataset depth comparisons are confounded in a known direction, because sci-RNA-seq3 runs on intron-rich nuclei while the 10x runs here used whole cells and threw the introns away. And low detection of a long or nuclear-retained transcript is weak biological evidence, because gene absence already has two non-biological explanations.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Intron inclusion",
 added:"On /pipeline this station is named for the switch rather than for the assignment, because the switch is the part of it nobody records — the assignment is assumed and the flag is the thing that goes missing. Whether intronic reads count moves totals substantially, and most for nuclei."},

/* ---------------------------------------------------------------------------
   R2 · THE BARCODE HALF. Off the row and below it. Same distance from E2 as
   the alignment above: they are parallel work, not alternatives.
   --------------------------------------------------------------------------- */

{id:"E3", key:"E3", group:"R2 · the barcode half", shape:"tile", hatch:true,
 follow:{a:"E2",dx:8.0}, name:"Match R2 barcodes", x:14.0, y:R3+2.8, w:1.9, d:1.9, h:1.15,
 sub:"three barcodes, each against its own whitelist, one mismatch tolerated",
 does:"Reads the cell barcode off the reads and reconstructs which physical path each molecule took — through three barcode plates, or into one droplet, or onto one microwell bead.",
 built:"Four counting stacks appear across the corpus and they are not interchangeable: bbi-dmux → bbi-sci for sci-RNA-seq3 (ZSCAPE, ChemFish); Cell Ranger for 10x (DanioCell 4.0.0 wrapping STAR 2.5.1b, MIC-Drop-seq 5.0.0, Zebrahub 5.0.1, CellOracle 5.0.1); split-pipe v1.7.1 for Parse (MiniFin, MegaFin); STAR plus modified Drop-seq tools 1.12 for Microwell-seq (ZCL2). In the worked example, 75.7% of reads carry a valid barcode combination.",
 cond:"The version is load-bearing and it is often wrong in the record. MIC-Drop-seq's GEO metadata says Cell Ranger v7 on all 36 samples; the pipeline's own machine-written web_summary.html says 5.0.0 — and that difference decides whether introns were counted. Where a hand-typed field and a machine-written run artefact disagree, the artefact wins. Also worth noticing: the 24.3% of reads with no valid barcode are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Barcode calling",
 added:"Each of the three barcodes is matched independently against its own whitelist, one mismatch tolerated. Concatenate the three plus the subpool index and you have a cell identity — unique only WITHIN a subpool, which is the whole reason the fourth barcode exists. Two cells that took the same path through the three plates in different subpools are told apart by it and by nothing else."},

/* ---------------------------------------------------------------------------
   G AND W · THE REFERENCE. A different class of thing from everything above:
   chosen rather than measured, built once and reused forever, arriving from
   outside the experiment — the same class as "The compounds" in the wet-lab
   half of /pipeline, and drawn off to the side for the same reason.

   THEIR EDGES DO NOT CARRY. A drug library is consumed; a STAR index is not.
   An edge that animates material down it every run asserts a per-sample cost
   that does not exist, so the reference edges are still:true — connected,
   dashed, and never given a dot. Same distinction /data_structures draws
   between "has carried bytes" and "written · never run".
   --------------------------------------------------------------------------- */

{id:"G1", key:"G1", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:-5.1}, name:"GRCz11", x:5.9, y:R3-9.6, w:1.25, d:1.25, h:0.55,
 sub:"the sequence · which bases are where",
 does:"The assembly. Which bases are where, and nothing else — no genes, no exons, no strand. Chosen, not measured.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus without exception, which is the one thing about the reference that IS comparable across all of them.",
 cond:"Sharing an assembly is a much weaker guarantee than it sounds, because it says nothing about the annotation laid over it — and the annotation is where four datasets on the same assembly end up with four different answers to 'which genes exist'.",
 added:"Drawn as its own node rather than folded into the index, because it is its own file and its own decision, and the two arms above differ in this one as well as in the annotation."},

{id:"G2", key:"G2", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:-1.9}, name:"Ensembl 99", x:9.1, y:R3-9.6, w:1.25, d:1.25, h:0.55,
 sub:"the annotation · where genes start and stop",
 does:"Where genes start and stop, what survives splicing, what gets translated, which direction it is read. A separate file and a separate decision from the assembly.",
 built:"MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520 features. ZSCAPE and ChemFish use a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031. DanioCell uses Lawson v4.3.2, 36,250 released names. Zebrahub uses a custom reference, 32,057 plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason.",
 added:"This is the single largest source of incomparability between two zebrafish atlases, and it is a file somebody chose. Nothing downstream can recover which one it was."},

{id:"G3a", key:"G3a", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:-3.5}, name:"STAR index · built", x:7.5, y:R3-6.2, w:1.7, d:1.7, h:0.95,
 sub:"GRCz11 + Ensembl 99, baked together · once, not per run",
 does:"The gene model reads are assigned against. Nominally a detail; in practice the single largest source of incomparability between two zebrafish atlases.",
 built:"Every dataset here is GRCz11, and yet: ZSCAPE and ChemFish share a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031 genes — byte-identical between them, all 32,031 coordinates matching position by position. DanioCell uses Lawson v4.3.2 via Cell Ranger, 36,250 released names. MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520. Zebrahub uses a custom reference called Danio.rerio_genome_Zebrabow_6, 32,057 ENSDARG plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason. What works instead is reconstruction from the builder's own code plus the released coordinates, which is how ZSCAPE's was recovered exactly. What does not work is asking the paper: ZSCAPE, ChemFish and Zebrahub name no GTF at all, and Zebrahub's was written off in 2026 after six sources were exhausted.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"The counting reference",
 added:"BUILT ONCE FROM THE ASSEMBLY AND THE ANNOTATION TOGETHER — the annotation is baked in at index time, not applied afterward. Not per run and not per sample, which is why the edge leaving it is drawn connected but not carrying: nothing travels it when a run goes through. It determines which transcripts are callable at all, and that is the whole reason two indexes give two different matrices from identical reads."},

{id:"G1b", key:"G1b", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:1.9}, name:"GRCz12tu", x:12.9, y:R3-9.6, w:1.25, d:1.25, h:0.55,
 sub:"the sequence · the newer assembly",
 does:"The second assembly. Same species, different coordinates: a base is not at the same address in the two, so nothing that names a position transfers between them without being lifted over.",
 built:"Staged rather than in use. The provenance for this arm, stage by stage, is at /grcz12.",
 cond:"Not interchangeable with GRCz11 by inspection. Two matrices built on the two assemblies cannot be concatenated, and a marker list from one is not a marker list for the other until every coordinate has been mapped across.",
 added:"Drawn because the branch is real. This arm exists as a decision that has been taken and staged, not as a hypothetical."},

{id:"G2b", key:"G2b", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:5.1}, name:"Ensembl 2025_12", x:16.1, y:R3-9.6, w:1.25, d:1.25, h:0.55,
 sub:"the annotation · the newer release",
 does:"The annotation that goes with the newer assembly. A separate file and a separate decision, exactly as on the other arm.",
 built:"Staged alongside GRCz12tu; see /grcz12 for what has been built and what has not.",
 cond:"The two arms differ in BOTH files, which is why the branch is drawn as two pairs rather than as one genome with two annotations. Reporting only one of the two differences would make the arms look more comparable than they are.",
 added:"The pair is the point: an arm is an assembly and an annotation together, and there is no useful sense in which one of them alone defines it."},

{id:"G3b", key:"G3b", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E4",dx:3.5}, name:"STAR index · staged", x:14.5, y:R3-6.2, w:1.7, d:1.7, h:0.95,
 sub:"GRCz12tu + Ensembl 2025_12 · the second arm",
 does:"The second index, from the second assembly and the second annotation. Same reads go into it; a different matrix comes out.",
 built:"Built the same way and at the same cost as the first: once per reference, never per run.",
 cond:"THIS IS THE ONLY PLACE ON THE MAP WHERE ONE INPUT LEGITIMATELY PRODUCES TWO OUTPUTS. Everything from the alignment onward exists twice — two alignments, two gene assignments, two deduplications, two unfiltered matrices — and the two are not reconcilable after the fact, because the gene spaces differ.",
 added:"Same R1. Two indexes. Two matrices, from identical reads. The stations downstream are drawn once with a × 2 under the name rather than twice on the map, which is a density decision and not a claim that they are shared."},

{id:"W1", key:"W1", group:"G · genome, and W · whitelists", shape:"ref",
 follow:{a:"E3",dx:0}, name:"Barcode whitelists", x:14.0, y:R3+5.6, w:1.5, d:1.5, h:0.6,
 sub:"the known well sequences for each ligation round · fixed by the kit",
 does:"The list of sequences that could legitimately be at each barcode position, one list per round of ligation. Fixed by the kit, not by the experiment.",
 built:"Three rounds of ligation give 48 × 96 × 96 = 442,368 addressable paths, and the fourth barcode — the index read — splits the run into subpools. A barcode is called by matching each round against its own list, independently, one mismatch tolerated.",
 cond:"Reused forever and never recorded with the data. Every deposited matrix in the corpus assumes its whitelists and none of them ships them, so a barcode string in an obs index cannot be parsed back into wells without knowing which kit version produced it — and ZCL2's 18 nt barcodes need a 3 × 6 split that is nowhere stated.",
 added:"Drawn on the same footing as the genome, and off to the same side, because it is the same kind of thing: a catalogue chosen once and consumed by nothing. The edge to the barcode matching is connected and still."},

/* ---------------------------------------------------------------------------
   THE JOIN. The two halves have been independent since E2; this is where they
   meet, and neither of them alone can produce a count.
   --------------------------------------------------------------------------- */

{id:"E6", key:"E6", group:"The join", shape:"tile", hatch:true, tag:"× 2 ARMS",
 lane:"r3", gap:9,
 name:"Deduplicate UMIs", x:24.0, y:R3, w:1.9, d:1.9, h:1.35,
 sub:"barcode + gene + UMI collapse to one count · reads become molecules",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 built:"For the worked example, 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424. MIC-Drop-seq's four measured 10x runs sit at 51.5–53.4%.",
 cond:"Saturation around 0.4–0.5 is the corpus norm and it means depth is not saturated: read depth alone accounts for about a quarter of the worked example's cluster resolution. Any cross-dataset comparison of genes-per-cell has to control for it. ZCL2 cannot even be checked — its UMI length is not stated and is not recoverable from a count matrix.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"UMI collapse",
 added:"THE SECOND JOIN, AND THE LOAD-BEARING NODE OF THIS WHOLE SEGMENT. The gene identity comes down the R1 branch and the cell identity comes up the R2 branch, and neither of them alone is a count: a gene with no cell is a read pile and a cell with no gene is an empty row. Two edges arrive here and the map is drawn so that they visibly converge. The UMI itself was stamped during reverse transcription, before any amplification, so every copy of one original molecule carries it — which is what makes this the step that undoes PCR rather than a step that guesses at it."},

{id:"UD", key:"E7", group:"② Unfiltered DGE", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3", tag:"× 2 ARMS",
 name:"Unfiltered DGE", x:30.0, y:R3, w:2.8, d:2.8, h:2.2, cells:8, fill:0.09,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Unfiltered matrix",
 added:"Cells by genes, with the 10-transcript floor already applied by split-pipe — which is a formatting decision about what is worth a row rather than a claim about what is a cell. Almost every row here is not a cell, deliberately: NOTHING IN THIS SEGMENT IS A CULL. Reads are set aside at the alignment and barcodes fail to resolve at the matching, but no cell is ever removed here, and the object is uselessly complete on purpose. The culls are the D lane, drawn at /bioinformatics_pipe, which begins at this cube — the same object, at the same size, from the same shape code and the same sparsity seed."},
];

const ROWS=[R3], MIRROR=29.0;

/* ONE LANE, AND IT IS THE SPINE RATHER THAN THE WHOLE MAP. Only the four nodes
   that every read passes through in order are on it — the pool, the fragment,
   the deduplication and the matrix. Everything else is a side structure that
   takes its x from one of them and keeps its own y, which is what makes the
   fork a fork: the two branches sit above and below the spine at the same
   distance from it, so they read as parallel work rather than as alternatives.

   E6 carries gap:9 because the whole fork has to fit in the span before it.
   The engine scales every gap to fill the lane, so that is a RATIO against the
   others rather than a distance — re-space the lane and the fork keeps its
   share of it. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:26.0, dir:+1},
];

/* Two edge classes, and the difference is the point.

   A read edge CARRIES: dots travel it, because material does. A reference edge
   is still:true — connected, dashed, dimmer, and never given a dot — because
   an index is built once and reused forever, and an edge that animates
   material down it every run asserts a per-sample cost that does not exist. */
const EDGES = [
  {a:"FQ", b:"E2", kind:"read"},
  {a:"E2", b:"E4", kind:"read"},          /* the fork: R1 to the genome */
  {a:"E2", b:"E3", kind:"read"},          /* the fork: R2 to the whitelists */
  {a:"E4", b:"E5", kind:"read"},
  {a:"E5", b:"E6", kind:"read"},          /* the gene identity arrives */
  {a:"E3", b:"E6", kind:"cell"},          /* the cell identity arrives */
  {a:"E6", b:"UD", kind:"cell"},

  {a:"G1",  b:"G3a", kind:"ref", still:true},
  {a:"G2",  b:"G3a", kind:"ref", still:true},
  {a:"G1b", b:"G3b", kind:"ref", still:true},
  {a:"G2b", b:"G3b", kind:"ref", still:true},
  {a:"G3a", b:"E4",  kind:"ref", still:true},
  {a:"G3b", b:"E4",  kind:"ref", still:true},
  {a:"W1",  b:"E3",  kind:"ref", still:true},
];

/* One band, keeping its name from the big map. It has to reach the reference
   lane above the row and the whitelists below it. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-2.0, x1:27.5, y0:R3-11.0, y1:R3+7.0},
];

/* Both ends fade, because neither is on this page: the reads arrive from a
   sequencer that is off the left of this map, and the matrix leaves for the
   culls, which are drawn at /bioinformatics_pipe. Drawing a hard terminus at
   either end would claim this stretch is self-contained, and it is a middle.

   THEY RUN ALONG THE ROW, and they are ANCHORED TO A NODE rather than written
   down as coordinates — fixed coordinates stay put when the object they feed
   is dragged, so the map can be arranged into a state where the reads arrive
   four units short of the pool. */
const CARRIES = [
  {node:"FQ", side:"in",  gap:1.15, len:4.6, fade:"in", kind:"read",
   from:"the sequencer, a row up on /pipeline", to:"FASTQ pool"},
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

const SNIPPETS = {
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
<p><mark>It is not a chain.</mark> It is one fork and two separate joins, and the shape is the content:</p>
<p><mark>The fork is at E2.</mark> One molecule, sequenced from both ends. R1 carries the cDNA and goes to the genome; R2 carries the barcodes and goes to the whitelists. Everything downstream of that node is two independent problems until they meet again.</p>
<p><mark>The first join is E4</mark> — R1 meets the index. <mark>The second is E6</mark>, and it is the load-bearing node of the whole segment: the gene identity comes down one branch and the cell identity comes up the other, and neither of them alone is a count. A gene with no cell is a read pile; a cell with no gene is an empty row.</p>
<p><mark>The reads themselves are drawn once, and only once.</mark> A pool of them turns in the air, and one — geometrically identical to every other, marked only by its colour and its ring — is opened up in the diagram hanging beneath it: cDNA, the middle neither read reaches, then the three ligation barcodes and the UMI. It is drawn in the molecule's own order rather than in the order R2 reads it, because <em>that</em> is what explains the reversal: BC1 is nearest the cDNA since reverse transcription attached it first, the UMI rides on the round-3 oligo at the far end, and R2 sequences inward from that end — meeting the UMI first and reaching round 1 last.</p>
<p><mark>Nothing in this segment is a cull.</mark> Reads are set aside — a quarter of them carry no valid barcode combination and never reach the alignment, and multimappers and unmapped reads are dropped after it — but no cell is ever removed here. The matrix at the end is deliberately, uselessly complete; the culls are the D lane, drawn at <a href="/bioinformatics_pipe">/bioinformatics_pipe</a>, which begins at this cube.</p>`,
  built:`<p><mark>Three lanes, and they are not the same kind of thing.</mark> The <mark>E lane</mark> is sample material: it flows once, per run, and is consumed. The <mark>G lane</mark> (the genome) and the <mark>W lane</mark> (the barcode whitelists) are references — chosen rather than measured, built once and reused forever, arriving from outside the experiment. They are the same class as <em>The compounds</em> in the wet-lab half of the big map, and they start off to the side for the same reason.</p>
<p><mark>But they are not drawn as flowing.</mark> A drug library is consumed; a STAR index is not. An edge that animates material down it every run asserts a per-sample cost that does not exist — so a reference edge is connected, dashed and dimmer, and never carries a dot. It is the distinction <a href="/data_structures">/data_structures</a> already makes between <em>has carried bytes</em> and <em>written · never run</em>. The reference objects wear a different skin from the stations for the same reason.</p>
<p><mark>The assembly and the annotation are two nodes, not one.</mark> They are two files and two independent choices, and the index is built from them <em>together</em> — the annotation is baked in at index time, not applied afterward. Which is why the whole branch below lives in the G lane rather than in the E lane.</p>`,
  cond:`<p class="cond"><mark>The branch is real, and it is the only one on the map.</mark> Same reads. Two indexes — GRCz11 with Ensembl 99, and GRCz12tu with Ensembl 2025_12. Two matrices. This is the one place where a single input legitimately produces two outputs, and the two arms differ in <em>both</em> files rather than in one, which is why they are drawn as two pairs.</p>
<p class="cond">Every station from the alignment onward therefore exists twice, and carries <mark>× 2 arms</mark> under its name. They are drawn once rather than twice — a density decision, not a claim that anything is shared. The two gene spaces are not reconcilable after the fact.</p>
<p class="cond">Nothing on this page is modelled: every figure is read off an artefact — the vendor's own <em>analysis_summary.csv</em>, the delivered <em>var</em>, the corpus provenance records. The one thing that cannot be shown is the reads themselves, which stayed in the vendor's cloud workdir; the payload on the first track is the sequencing statistics that survive of them, and it says so rather than drawing a stand-in.</p>
<p class="cond">The settings that decide the most are the ones nobody records. MIC-Drop-seq's GEO metadata says Cell Ranger v7 across all 36 samples while the pipeline's own machine-written summary says 5.0.0 — and that single difference decides whether intronic reads were counted. Where a hand-typed field and a run artefact disagree, the artefact wins.</p>`
};
