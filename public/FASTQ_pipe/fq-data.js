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

/* The landmark, and the only object on this page drawn by a shape of this
   page's own. NOTHING ABOUT IT IS A SOLID: a pool of reads in the air and a
   diagram of one read below it, and neither of those is a building. So n.h is
   not the height of any object — it is the top of the whole composition, which
   is what topOf() hands the label, so the name floats clear above the pool
   instead of landing in it. The pool and the diagram are both placed from it.
   See drawReads in fq-shapes.js. */
{id:"FQ", key:"3", group:"③ FASTQ", groupMark:true, anchor:true, shape:"reads",
 lane:"r3",
 name:"FASTQ", x:1.0, y:R3, w:2.6, d:2.6, h:8.7,
 sub:"paired-end · demultiplexed · usually gone", stat:"off-instance",
 does:"The first digital object, and the only genuinely shapeless one. Different libraries, different depths, no schema — and nothing in it yet says which barcode is a cell.",
 built:"For the worked example: sequenced 2026-03/04 and processed in the vendor's own cloud workdir, whose S3 path the run definition still points at. Demultiplexing is its own named step in some pipelines — Zebrahub records bcl2fastq v2.20.0.422 — and invisible in others.",
 cond:"The biggest hole on the map, and a general one. The reads are not on this box and no manifest of them is either, so every raw-read claim on this page is downstream of a vendor report rather than of the reads. It is worse elsewhere: ChemFish's pre-QC data is documented as unavailable, and CellOracle's SRA FASTQs are a deliberate non-acquisition. Re-deriving anything — a second annotation arm, a different intron setting — starts by getting the reads back.",
 /* ---- authored on this page, below the lifted fields ------------------
    Everything above this comment is lifted byte-for-byte. --------------- */
 added:"A swarming pool, and one fragment opened up. THE FRAGMENT IS DRAWN IN ITS OWN ORDER, NOT IN R2's ORDER: BC1 sits nearest the cDNA because reverse transcription attached it first, each ligation round adds the next one further out, and the UMI rides on the round-3 oligo at the far end. R2 sequences inward from that end — which is why it meets the UMI first and reaches round 1 last. Draw the molecule truthfully and the reversal explains itself. The pool is a BALL rather than a rectangle, and a real one: the reads are placed uniformly through a sphere in world coordinates, turned by a real rotation and projected like everything else on this map, with depth driving size and opacity. The one being magnified is geometrically identical to every other read — same length, same weight, same wander. Only its colour and its ring say it is the one. Two leaders run from the ring's shoulders to the two ends of the opened fragment, because a magnification is a frustum rather than a pointer. The reads are AIRBORNE and the structure is PAINTED, which is this map's grammar and not a decision taken again here: what lies on the surface shears with it, what is in the air does not. And it is still the one object on this page that cannot be opened for real — the payload on the track leaving it is the vendor's sequencing statistics, because the reads those statistics describe are not on this instance."},

{id:"BP", key:"C4", group:"Getting to a matrix", shape:"tile", hatch:true,
 name:"Barcode parse", x:4.2, y:R3, lane:"r3", w:1.9, d:1.9, h:1.1,
 sub:"read 2's three ligation barcodes plus the UMI, matched at one mismatch",
 does:"Reads the cell barcode off the reads and reconstructs which physical path each molecule took — through three barcode plates, or into one droplet, or onto one microwell bead.",
 built:"Four counting stacks appear across the corpus and they are not interchangeable: bbi-dmux → bbi-sci for sci-RNA-seq3 (ZSCAPE, ChemFish); Cell Ranger for 10x (DanioCell 4.0.0 wrapping STAR 2.5.1b, MIC-Drop-seq 5.0.0, Zebrahub 5.0.1, CellOracle 5.0.1); split-pipe v1.7.1 for Parse (MiniFin, MegaFin); STAR plus modified Drop-seq tools 1.12 for Microwell-seq (ZCL2). In the worked example, 75.7% of reads carry a valid barcode combination.",
 cond:"The version is load-bearing and it is often wrong in the record. MIC-Drop-seq's GEO metadata says Cell Ranger v7 on all 36 samples; the pipeline's own machine-written web_summary.html says 5.0.0 — and that difference decides whether introns were counted. Where a hand-typed field and a machine-written run artefact disagree, the artefact wins. Also worth noticing: the 24.3% of reads with no valid barcode are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Barcode calling",
 added:"Read 2 carries the three round-of-ligation barcodes plus the UMI. Match each against the known well lists, allowing one mismatch; reads whose barcodes don't resolve are dropped here. The building is hatched for that reason and it is the first hatched thing on the page — a quarter of the reads leave at this station, before anything has been aligned, and no record of which ones survives."},

{id:"GX", key:"C8", group:"Getting to a matrix", shape:"tile",
 name:"Genome index", x:5.6, y:R3, lane:"r3", w:1.9, d:1.9, h:0.7,
 sub:"built once per reference from FASTA + GTF, not per run",
 does:"The gene model reads are assigned against. Nominally a detail; in practice the single largest source of incomparability between two zebrafish atlases.",
 built:"Every dataset here is GRCz11, and yet: ZSCAPE and ChemFish share a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031 genes — byte-identical between them, all 32,031 coordinates matching position by position. DanioCell uses Lawson v4.3.2 via Cell Ranger, 36,250 released names. MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520. Zebrahub uses a custom reference called Danio.rerio_genome_Zebrabow_6, 32,057 ENSDARG plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason. What works instead is reconstruction from the builder's own code plus the released coordinates, which is how ZSCAPE's was recovered exactly. What does not work is asking the paper: ZSCAPE, ChemFish and Zebrahub name no GTF at all, and Zebrahub's was written off in 2026 after six sources were exhausted.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"The counting reference",
 added:"Built once per reference from FASTA plus GTF, not per run. It determines which transcripts are callable at all, which is why GRCz11 and GRCz12tu give different matrices from identical reads. It stands in the row's own order here, between the barcodes and the aligner, because that is where it is consumed — but it is the one station on this page that no read passes through, and it is the only one not hatched: it destroys nothing, it decides what can be found."},

{id:"AL", key:"C5", group:"Getting to a matrix", shape:"tile", hatch:true,
 name:"Alignment", x:7.0, y:R3, lane:"r3", w:1.9, d:1.9, h:1.6,
 sub:"read 1 is the cDNA and goes to STAR",
 does:"Aligns the cDNA read to the genome and assigns it to a gene.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus — the variation is entirely in the annotation laid over it, and in what counts as being inside a gene. For the worked example: 46.1% of reads map to the transcriptome, exonic fraction 63.8%. For contrast, MIC-Drop-seq's 10x runs confidently map 92.4% to the genome and 72.7% to the transcriptome.",
 cond:"A 46% transcriptome mapping rate looks alarming and is not a failure — it is the 3′ UTR problem next door, unpatched. The gap between 46% here and 73% there is mostly annotation, not chemistry, which is why the reference nodes above this row matter more than they look.",
 /* ---- authored on this page ------------------------------------------- */
 added:"Read 1 is the cDNA and goes to STAR. It produces genomic coordinates per read; multimappers and unmapped reads are set aside rather than counted. The tallest building on the row, because it is the one doing the most work per read and the one whose output every station after it is a re-description of."},

{id:"GA", key:"G2", group:"Getting to a matrix", shape:"tile", hatch:true,
 name:"Gene assignment", x:8.4, y:R3, lane:"r3", w:1.9, d:1.9, h:1.15,
 sub:"aligned read → a gene model from the GTF · exonic by default",
 does:"Decides whether a read landing inside an intron counts toward its gene. It is one flag, it is almost never stated, and it changes the matrix materially.",
 built:"Cell Ranger flipped this default across exactly the versions in play: 5.0.0 counts no intronic reads and offers no option, 6.x makes it opt-in and off by default, 7.x turns it on by default. MIC-Drop-seq's released main-screen matrix was built with Include introns: False, discarding 9.1–9.5% of confidently-mapped reads against 76.5–77.3% exonic.",
 cond:"Three consequences, all worse than the version number. Reproducing that matrix requires Cell Ranger 5.0.0 specifically — a modern default produces a materially different object, silently. Cross-dataset depth comparisons are confounded in a known direction, because sci-RNA-seq3 runs on intron-rich nuclei while the 10x runs here used whole cells and threw the introns away. And low detection of a long or nuclear-retained transcript is weak biological evidence, because gene absence already has two non-biological explanations.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Intron inclusion",
 added:"Each aligned read is attributed to a gene model from the GTF. Exonic by default; whether intronic reads count is a switch that changes totals substantially, especially for nuclei. On /pipeline this station is named for the switch rather than for the assignment, because the switch is the part of it nobody records — the assignment is assumed and the flag is the thing that goes missing."},

{id:"UM", key:"C6", group:"Getting to a matrix", shape:"tile", hatch:true,
 name:"UMI deduplication", x:9.8, y:R3, lane:"r3", w:1.9, d:1.9, h:1.3,
 sub:"reads sharing barcode, gene and UMI collapse to one transcript",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 built:"For the worked example, 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424. MIC-Drop-seq's four measured 10x runs sit at 51.5–53.4%.",
 cond:"Saturation around 0.4–0.5 is the corpus norm and it means depth is not saturated: read depth alone accounts for about a quarter of the worked example's cluster resolution. Any cross-dataset comparison of genes-per-cell has to control for it. ZCL2 cannot even be checked — its UMI length is not stated and is not recoverable from a count matrix.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"UMI collapse",
 added:"Collapse reads sharing barcode, gene and UMI into one transcript count. This is the step that turns read depth into molecule counts and removes PCR amplification. It is hatched like the rest, and it is the one place on the page where what is destroyed is a duplicate rather than a datum — which is exactly why the saturation figure matters: it says how much of the discarded pile was ever going to be new."},

{id:"CM", key:"C7", group:"Getting to a matrix", shape:"tile", hatch:true,
 name:"Cell assignment and matrix build", x:11.2, y:R3, lane:"r3", w:1.9, d:1.9, h:1.45,
 sub:"group by the full barcode combination, floor at 10 transcripts, emit MTX",
 does:"Stitches the per-library matrices into one and stamps each barcode with where it came from.",
 built:"For the worked example: split-pipe mode 'comb' over eight sublibraries. Cell ids come out as bc1_bc2_bc3__sublibrary — 01_01_05__s1 — so all four barcode rounds stay legible in the index itself.",
 cond:"86.1% of transcripts land inside called cells; the remaining 13.9% is the ambient pool and it is dropped here rather than kept as a background profile. Barcode conventions are a live trap whenever matrices are compared: ZCL2's 18 nt barcodes need a 3 × 6 split to parse, and MegaFin's vendor-well barcodes have 0% overlap with the same library's raw-combinatorial rebuild — the same cells, unjoinable.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Combine and stamp",
 added:"Group counts by the full barcode combination, apply the 10-transcript floor, and emit DGE_unfiltered as an MTX triplet with barcode and gene metadata. The floor is the only threshold on this page, and it is nothing like the culls next door: ten transcripts is a formatting decision about what is worth a row, not a claim about what is a cell. Everything that survives it is still a barcode, and the object it lands in is still called unfiltered."},

{id:"UD", key:"4", group:"④ Unfiltered DGE", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Unfiltered DGE", x:14.0, y:R3, w:2.8, d:2.8, h:2.2, cells:8, fill:0.09,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone.",
 /* ---- authored on this page ------------------------------------------- */
 pipelineName:"Unfiltered matrix",
 added:"The end of this page and the start of the other one. Everything drawn here exists to produce this cube; everything drawn at /bioinformatics_pipe exists to take barcodes out of it. It is the same object in both places, drawn at the same size, from the same shape code and the same sparsity seed — a cube that looked different on the two maps would be telling a reader they were two different objects."},
];

const ROWS=[R3], MIRROR=29.0;

/* One lane, and a long one. Eight objects share this span, and the gap engine
   spaces them from their own widths rather than from the x values above —
   those are an ORDERING, not a position. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:31.6, dir:+1},
];

const EDGES = [
  {a:"FQ",b:"BP",kind:"read"},{a:"BP",b:"GX",kind:"read"},
  {a:"GX",b:"AL",kind:"ref"}, {a:"AL",b:"GA",kind:"read"},
  {a:"GA",b:"UM",kind:"read"},{a:"UM",b:"CM",kind:"cell"},
  {a:"CM",b:"UD",kind:"cell"},
];

/* One band, keeping its name from the big map. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-1.4, x1:33.0, y0:R3-4.8, y1:R3+3.6},
];

/* Both ends fade, because neither is on this page: the reads arrive from a
   sequencer that is off the left of this map, and the matrix leaves for the
   culls, which are drawn at /bioinformatics_pipe. Drawing a hard terminus at
   either end would claim this stretch is self-contained, and it is a middle.

   THEY RUN ALONG THE ROW, and they are ANCHORED TO A BUILDING rather than
   written down as coordinates — fixed coordinates stay put when the building
   they feed is dragged, so the map can be arranged into a state where the
   reads arrive four units short of the heap. */
const CARRIES = [
  {node:"FQ", side:"in",  gap:1.15, len:4.6, fade:"in", kind:"read",
   from:"the sequencer, a row up on /pipeline", to:"FASTQ"},
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
  sub:"six stations between the reads and the first matrix",
  does:`<p>Everything that happens between the reads and the first matrix on row 3 of <a href="/pipeline">/pipeline</a> — the band called <mark>Bioinformatics pipeline</mark>. Paired-end FASTQ goes in on the left; every barcode that ever appeared, against every gene, comes out on the right.</p>
<p>Six stations stand between them:</p>
<p><mark>Barcode parse</mark> — read 2 carries the three round-of-ligation barcodes plus the UMI, matched against the known well lists at one mismatch. <mark>Genome index</mark> — built once per reference from FASTA plus GTF, not per run. <mark>Alignment</mark> — read 1 is the cDNA and goes to STAR. <mark>Gene assignment</mark> — each aligned read is attributed to a gene model from the GTF. <mark>UMI deduplication</mark> — reads sharing barcode, gene and UMI collapse into one transcript count. <mark>Cell assignment and matrix build</mark> — group by the full barcode combination, apply the 10-transcript floor, emit the MTX triplet.</p>
<p>Nothing has been re-written. Every name, number and claim is lifted from that map as source text rather than re-typed, so the two cannot drift into two different accounts of the same stage. Several stations are <em>named</em> differently here, and that is not drift either: the big map carries the name the whole corpus uses for a stage, while this page names the single operation it draws. The reader carries the original name through.</p>
<p><mark>Hatching means the stage destroys data.</mark> Five of the six carry it, and the exception is the genome index — it decides what can be found and throws nothing away. The largest deletion on the page is the first one: <mark>24.3% of reads carry no valid barcode combination</mark> and leave at the barcode parse, before anything has been aligned.</p>
<p>The culls are not on this map. They are the other half of this row and they are drawn at <a href="/bioinformatics_pipe">/bioinformatics_pipe</a>, which begins where this page ends — at the same cube, drawn at the same size from the same code.</p>`,
  built:`<p>The four counting stacks in the corpus do these six things in this order and are still not interchangeable, because <mark>each station has a setting that is rarely written down</mark>: how many mismatches a barcode may carry, which annotation was laid over GRCz11, whether an intronic read counts, what a UMI's length is. Every one of those changes the matrix and none of them is recoverable from the matrix.</p>
<p>The figures on this page are read off artefacts rather than modelled: the vendor's own <em>analysis_summary.csv</em> for the per-sublibrary reads, transcripts and saturation; the delivered <em>var</em> for the gene records; the corpus provenance records for the four feature universes. <mark>The one thing that cannot be shown is the reads themselves.</mark> They stayed in the vendor's cloud workdir, so the payload travelling the first track is the sequencing statistics that survive of them, and the page says so on the payload rather than drawing a stand-in.</p>
<p><mark>The reads themselves are drawn once, at the left, and only once.</mark> A pool of them turns in the air over a bench, and one — geometrically identical to every other, marked only by its colour and its ring — is opened up on the bench below: cDNA, the middle neither read reaches, then the three ligation barcodes and the UMI. It is drawn in the molecule's own order rather than in the order R2 reads it, because <em>that</em> is what explains the reversal: BC1 is nearest the cDNA since reverse transcription attached it first, the UMI rides on the round-3 oligo at the far end, and R2 sequences inward from that end — meeting the UMI first and reaching round 1 last.</p>
<p>Each station after it is a building whose height is roughly what it does per read, and the tallest is the aligner. The tracks between them carry the object that actually moves: reads out of the pool, a reference into the aligner, barcodes into the cube. Click a dot to read what is in transit.</p>`,
  cond:`<p class="cond">Nothing on this page is modelled, and that is a difference from <a href="/bioinformatics_pipe">the culls page</a> rather than a virtue. There is no threshold on this stretch that has to be invented to be drawn — the one number here that is a policy is the <mark>10-transcript floor</mark> at the matrix build, and it is a formatting decision about what is worth a row rather than a claim about what is a cell.</p>
<p class="cond">The settings that matter most are the ones nobody records. MIC-Drop-seq's GEO metadata says Cell Ranger v7 across all 36 samples while the pipeline's own machine-written summary says 5.0.0 — and that single difference decides whether intronic reads were counted. Where a hand-typed field and a run artefact disagree, the artefact wins.</p>
<p class="cond">And the reference is the largest source of incomparability on the page. Every dataset in the corpus is GRCz11, and four of them still count against four different feature universes: 32,031 · 36,250 · 32,520 · 32,057 + 3. The gene set cannot date a build — it is identical across Ensembl 99 to 114 — so a reference that was not recorded when it was built is usually not recoverable at all.</p>`
};
