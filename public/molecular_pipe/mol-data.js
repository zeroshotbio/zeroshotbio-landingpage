/* ============================================================
   mol-data.js — /molecular_pipe. ROW 2 OF /pipeline, ON ITS OWN.

   A bench for developing the molecular biology row out, the way /FASTQ_pipe is
   one for row 3. Thirteen stations: the thaw, three rounds of in-situ
   barcoding with a pool-and-split between each, the lysis, cDNA capture and
   quantification, library prep, the indexing PCR, the size check, and the
   sequencer.

   EVERY RECORD BELOW IS LIFTED VERBATIM FROM pipeline-data.js. Extracted as
   source text, not re-typed, so every character of every does/built/cond field
   matches the map it came from and a diff between the two stays meaningful.
   /pipeline OWNS THIS PROSE. If a claim changes it changes there and gets
   lifted again — do not edit a lifted field in place, or the two drift into
   two accounts of one row, which is the whole failure both files exist to
   prevent. New writing that belongs only to this page goes in `added:`.

   WHAT IS NOT HERE, AND WHY. FX — ② Fixed material — is the object this row
   opens by undoing, and it is NOT on this page: it sits on lane r1-tail, which
   makes it the end of row 1 rather than the start of row 2. The row's own
   opening landmark is the Thaw, which carries the anchor. If the fixed
   material is ever wanted here for context, it comes in as a CARRIED node the
   way UDc does on the big map, so that it stays one object rather than two.

   IT RUNS THE SAME ENGINE. pipeline-iso.js, pipeline-shapes.js and
   pipeline-view.js are /pipeline's own files, loaded unchanged; only the data,
   the saved record and the paper differ, and index.html sets those three in
   MAP_CONFIG before the view loads. There is no second copy of the drawing
   code and there must not be one.

   Load order: iso -> shapes -> data -> view
   ============================================================ */

/* The row sits at y = 0 here, because it is the only row. */
const R2 = 0;

const NODES = [

{id:"THW", key:"B1", group:"In situ barcoding", groupMark:true, anchor:true,
 shape:"vials", thaw:true, lane:"r2",
 name:"Thaw", x:0.7, y:R2, w:2.52, d:1.82, h:0.665,
 sub:"37°C thaw · haemocytometer · loading table", stat:"the biology restarts",
 does:"Fixed material comes back out of the freezer, is thawed until the last ice crystal goes, counted, and diluted to the concentration the loading table demands. The count taken here decides how many cells enter each round-one well, and therefore how crowded the whole run will be.",
 built:"Section 1.1. Thaw in a 37C water bath, mix, count on a haemocytometer, record the count into the Evercode WT Sample Loading Table v2, dilute with Sample Dilution Buffer, then proceed immediately to round one — the manual gives no stopping point here. The Round 1 Plate thaws alongside, 10 minutes at 25C. The loading table is filled in beforehand and tells you which sample goes in which well; the counts are what get written into it now.",
 cond:"The loading table — not any dispensing sheet — is what the barcodes physically encode, so it is the authority on which drug a cell saw. The run definition carries 44 sample entries against 48 loaded wells and 43 distinct samples reach the matrix; the 48 to 44 to 43 attrition is undocumented at every step. No cell count from this step survives on this instance, so the loading density that sets the collision rate six boxes downstream cannot be recovered."},

{id:"R1p", key:"B2", group:"In situ barcoding", shape:"reversetranscription", name:"Round 1 — reverse transcription", x:2.6, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:4,
 sub:"48 wells · 96 barcodes · sample identity",
 does:"Each well gets its own barcoded primer and RNA is reverse transcribed inside the intact cell. This round carries sample identity — everything the dataset knows about which drug a cell saw is written here, in the first chemical step.",
 built:"Section 1.2. In situ reverse transcription on a 48-well round-one layout (rows A to D, columns 1 to 12), barcode set n141_R1_v3_8. Two barcodes per well, 96 in total: the manual says each well is primed both with oligo dT and with random hexamers, and the run definition records only the counts. 14 microlitres of diluted sample per well, a fresh tip for every well. sample_bc_rounds = 1: round one and only round one carries sample identity.",
 cond:"Clean, and structurally the strongest link on the map — sample identity is written in a chemical step rather than carried in a spreadsheet, so there is no demultiplex cull downstream. The hashed designs in the corpus pay for that convenience with a whole extra QC stage."},

{id:"B1", key:"B3", group:"In situ barcoding", shape:"poolsplit", name:"Pool and split", x:4.2, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3,
 sub:"shuffle the deck",
 does:"Every well is pooled into one tube and redistributed at random across the next plate. The randomisation is the whole trick: after this, well position carries no information.",
 built:"Section 1.2, closing steps — pool, centrifuge, resuspend, load the round two plate.", cond:"Clean."},

{id:"R2p", key:"B4", group:"In situ barcoding", shape:"ligation", name:"Round 2 — ligation", x:5.8, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · barcode set v1",
 does:"A second barcode is ligated onto the cDNA inside the cell.",
 built:"Section 1.3. Ligation in a 96-well plate (rows A to H, columns 1 to 12), barcode set v1, 96 barcodes across 96 wells — one per well, unlike round one.",
 cond:"Clean."},

{id:"B2", key:"B5", group:"In situ barcoding", shape:"tile", name:"Pool and split", x:7.4, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3,
 sub:"shuffle again",
 does:"Pooled and redistributed a second time.",
 built:"Section 1.4, opening steps.", cond:"Clean."},

{id:"R3p", key:"B6", group:"In situ barcoding", shape:"miniplate", name:"Round 3 — ligation", x:9.0, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · R3_v3 · TruSeq R2 + biotin",
 does:"A third barcode is ligated, and it brings two passengers: the Illumina TruSeq Read 2 sequence, and a biotin. After this round a cell's path through three plates is almost certainly unique — that combination is what will be read as a cell identity, and no droplet was ever involved.",
 built:"Section 1.4. Ligation in a third 96-well plate, barcode set R3_v3. The biotin is why the next section works at all: it is the handle streptavidin beads will grab once the cells are gone. The three rounds give 48 x 96 x 96 = 442,368 addressable paths for roughly 95,000 cells. Microwell-seq builds its barcode the same way — three rounds of split-pool synthesis, 3 x 6 nt in an 18 nt barcode.",
 cond:"Two cells can still collide on the same path. That residual collision rate is the real doublet source, it is set by loading density rather than by this step, and it differs per sublibrary — which is exactly why a single global doublet threshold two rows down cannot be right for all eight."},

{id:"SB", key:"B7", group:"In situ barcoding", shape:"tile", name:"Count again, split, lyse", x:10.8, y:R2, lane:"r2", w:0.85, d:0.85, h:0.55,
 sub:"8 sublibraries · 12,500 cell ceiling",
 does:"The pool is washed, counted a second time, divided into eight sublibraries, and only then are the cells lysed. Every sublibrary contains cells from every sample. This is the last moment at which anything in the tube is still a cell.",
 built:"Section 1.5. Wash, resuspend in Pre-Lysis Dilution Buffer, count on a haemocytometer, then split by volume using the Sublibrary Generation Table in Appendix A. Lysis is 15 minutes at 65C; lysates keep at -80C for up to six months. Eight sublibraries here (Sublib1 to Sublib8, library IDs LV6001530579 to LV6001530706, submission SO11332); sublibrary membership becomes a first-class obs field and survives to the matrix.",
 cond:"The manual sets a hard ceiling: do not add more than 12,500 cells to a sublibrary, because more raises the multiplet rate. The worked example recovered 11,152 to 12,656 cells per sublibrary, and recovery is downstream of loading, so at least one sublibrary was loaded at or above the vendor ceiling. The eight are otherwise unusually even. Where they do differ is depth: sequencing saturation runs 0.366 to 0.486 across them, and the per-sample thresholds downstream do not know that."},

{id:"CAP", key:"B8", group:"cDNA capture and amplification", shape:"tile", name:"Capture, template switch, amplify", x:12.6, y:R2, lane:"r2", w:0.72, d:0.72, h:0.44,
 sub:"streptavidin beads · PCR",
 does:"The biotin from round three is used to pull the barcoded cDNA out of the debris, an adapter is added to its far end, and the whole thing is amplified to a workable quantity.",
 built:"Sections 2.1 to 2.4. Streptavidin magnetic beads capture the biotinylated cDNA and the cell debris is washed away; a template switch reaction adds an adapter to the 3-prime end; amplification runs off the template-switch primer and a TruSeq Read 2 primer. Cycle count comes from a table keyed on cells per sublibrary and RNA content — at the 6,000 to 12,500 cell band, 6 cycles for high-RNA material, 8 for low, 7 for nuclei. No run-specific record of which was used exists on this instance.",
 cond:"Amplification is where transcript-length and GC bias enter, and it is unmeasured. Nothing was archived from this step. The one structural comfort is that capture is affinity-based rather than size-based, so the bias it introduces is at least the same bias for every sublibrary."},

{id:"QCD", key:"B9", group:"cDNA capture and amplification", shape:"tile", name:"Quantify the cDNA", x:14.1, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"Qubit + TapeStation · sets the cycle count",
 does:"Concentration and fragment-size distribution are measured. This is not bookkeeping: the number recorded here is what sets the number of PCR cycles in the indexing reaction three boxes along.",
 built:"Section 2.5. Qubit dsDNA HS for concentration, Bioanalyzer High Sensitivity DNA or TapeStation HS D5000 for size. cDNA then keeps at 4C for 48 hours or -20C for three months. The recorded concentration is carried forward by hand into section 3.",
 cond:"The only step on this row where a measured number, rather than the protocol, decides what happens next — and the measurement was not archived. Which cycle branch the run took, anywhere from 13 cycles for a weak sublibrary down to 7 for a strong one, cannot be recovered. Over-amplification shows up as duplicate reads, which is why sequencing saturation two boxes downstream is the only surviving witness to this decision."},

{id:"FRG", key:"C1", group:"Sequencing library prep", shape:"tile", name:"Fragment, end-prep, ligate adapters", x:15.6, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"double-sided SPRI · TruSeq R1",
 does:"The amplified cDNA is chopped to sequenceable lengths, its ends are repaired and A-tailed, and the Illumina TruSeq Read 1 adapter is ligated to the 5-prime end.",
 built:"Sections 3.1 to 3.4. Fragmentation, end repair and A-tailing happen in a single reaction; a double-sided SPRI cleanup selects the size window; the TruSeq R1 adapter is ligated and the product purified again.",
 cond:"Protocol, not transcript. Nothing run-specific was archived and nothing here can be checked after the fact — the size window is enforced by bead chemistry, and the only evidence it worked is the library trace two boxes along."},

{id:"R4p", key:"C2", group:"Sequencing library prep", shape:"tile", name:"Round 4 — indexing PCR", x:17.1, y:R2, lane:"r2", w:0.72, d:0.72, h:0.42,
 sub:"UDI plate · applied by PCR, not in-cell",
 does:"The fourth barcode. It identifies the sublibrary rather than the sample, it is added by PCR long after the cells were lysed, and it arrives as a standard Illumina index — which is why the read appears to carry only three barcodes when the cell identity is really four.",
 built:"Section 3.5, and this is where it belongs in the order: after adapter ligation, not after lysis. One unused well of the UDI Plate - WT per sublibrary, i5 and i7 unique dual indexes, wells never reused. The cycle count comes from the cDNA concentration recorded in section 2.5 — 13 cycles at 10 to 24 ng, down to 7 at a microgram or more. Appendix B lists the index sequences well by well. Visible in the matrix as the __s1 to __s8 suffix on every cell id.",
 cond:"Clean, and the only part of the whole library prep that can be checked after the fact: eight sublibraries went in and eight came back, each with a distinct index, and the valid-barcode fraction of 0.757 is consistent across them."},

{id:"LIB", key:"C3", group:"Sequencing library prep", shape:"dish", name:"Quantify and size-check", x:18.6, y:R2, lane:"r2", w:0.95, d:0.95, h:0.34,
 sub:"eight indexed libraries · 400-500 bp peak",
 does:"The last point at which the bench can catch a failure. Concentration and size distribution are measured one final time, and what should be seen is a single peak between 400 and 500 base pairs. Nothing about the tube looks like a fish any more.",
 built:"Sections 3.6 and 3.7. Double-sided size selection, then Qubit dsDNA HS for concentration and Bioanalyzer High Sensitivity DNA or TapeStation HS D1000 for the trace. Libraries keep at -20C for three months. Appendix B sets the handoff: dilute and denature to the instrument's spec, add 5 percent PhiX, and sequence at a minimum of 20,000 reads per cell.",
 cond:"No QC trace was archived — no Qubit concentration, no electropherogram, so the 400 to 500 bp expectation was never checked against on this instance. What can be recovered is downstream and it is reassuring: cDNA Q30 0.970 to 0.972 and barcode Q30 0.955 to 0.973 across all eight sublibraries."},

{id:"SEQ", key:"S", group:"The sequencer", shape:"machine",
 lane:"r2",
 name:"Illumina sequencer", x:21.0, y:R2, w:2.2, d:1.4, h:1.0,
 sub:"paired-end · R1 cDNA · R2 barcodes + UMI", stat:"3,655,719,111 reads",
 does:"Reads the library by synthesis. Three and a half billion reads across eight sublibraries, 38,637 reads per called cell on average — 1.9 times the vendor's recommended minimum of 20,000, and oversampled on purpose, because combinatorial barcoding spends reads on barcodes that were never cells.",
 built:"Paired-end, to the read structure in Appendix B: read 1 is 64 bases of cDNA insert, read 2 is 58 bases carrying barcodes 1 to 3 plus the UMI, and the i7 and i5 indexes are 8 bases each and carry the fourth barcode. Longer read 2 lengths are allowed and simply trimmed by the analysis pipeline. Per-sublibrary read counts run 420.9 M to 491.9 M. Across the corpus: NextSeq 500/2000 and NovaSeq 6000 (ZSCAPE), NovaSeq 6000 (Zebrahub), NextSeq 550 (CellOracle), HiSeq or MGI DNBSEQ-T7 at 150+150 bp (ZCL2).",
 cond:"Run metrics are only partly recoverable. Q30 and valid-barcode fraction survive in the vendor report (0.757 valid barcodes overall), but cluster density, per-lane yield, the lane count and whether the recommended 5 percent PhiX was spiked in are not held anywhere on this instance. That is the norm, not the exception — no dataset in the corpus archives its run metrics alongside its counts."},

/* ================= ROW 3 — THE MATRIX ================= */
/* THE WHOLE OF THIS ROW IS /FASTQ_pipe, AT /FASTQ_pipe's OWN SIZE.

   Every record below is public/FASTQ_pipe/fq-data.js's, transcribed rather than
   re-typed, so the prose is byte-identical and a diff between the two files
   stays meaningful. NOTHING IS SCALED. Every w, d, h, gd, gap, v, follow{dx}
   and y offset is that page's own number, and no node here sets fqs, tb, tracks
   or lanes — so every helper in pipeline-fqshapes.js falls through to the
   identity and these are the drawings that page makes.

   IT WAS DRAWN AT 1/2.4 FOR A WHILE AND THAT IS WHY THE HELPERS EXIST. The row
   was fitted into the old 7.6-deep band by dividing the geometry by 2.4, holding
   type back to 1/1.55 so it stayed legible, and thinning the density to suit.
   It worked, it passed every check, and side by side with the original it was
   plainly worse: proportions that had been settled by eye at reading scale came
   apart under a uniform shrink. The room was the thing to change, not the
   drawing. THE SCALE MACHINERY IS LEFT IN PLACE AND NOTHING USES IT — see the
   header of pipeline-fqshapes.js. It is one field on a node if this row ever has
   to be squeezed again, and the identity property is what makes it safe.

   WHAT IS THIS MAP'S RATHER THAN THAT PAGE'S. Only bookkeeping. The landmarks
   keep ③ and ④ and the names FASTQ and Unfiltered matrix, because the ①..⑦
   numbering is this map's spine and that page numbers its own stations E1..E8.
   The stations continue the C series; the five reference figures take F1..F5
   rather than that page's G1..G4/W1, because row 4 already has a node keyed G3
   and two badges reading G3 on one map is an ambiguity nobody can resolve. And
   E3/E4/E5 carry `drops` beside `hatch`: they destroy READS, and the index has
   to say so rather than calling them culls, which is row 4's word.

   pipelineName IS DROPPED. It exists there to carry this map's name through to
   the reader so the two can be matched up; here it would point at itself.

   WHAT WAS REMOVED FROM THIS ROW. cb4 "Combine and stamp" and W "Sample
   metadata join" are gone, on request: /FASTQ_pipe scopes itself to the reads
   and the first cube, and this row now covers exactly that. Both were real steps
   and neither is drawn anywhere on the site now. The three abstract reference
   tiles — E, UTR, V — are replaced by the five drawn figures.

   THE LIFT ARROW HAS TURNED ROUND for the new material. does/built/cond on E3,
   E4, E5, DD, FQ and UD are still this map's own writing, lifted THERE. E2, CB
   and the five reference figures were authored on that page and are lifted HERE.
   Change a claim on whichever map owns it and lift it again; do not edit a
   lifted field in place. */
];

/* The row reads left to right and nothing else feeds it: on the big map the
   row above is what supplies the fixed material, and that is said by where the
   rows sit rather than by a track. Same here — the chain starts at the thaw. */
const EDGES = [
  {a:"THW",b:"R1p",kind:"susp"},
  {a:"R1p",b:"B1",kind:"susp"},
  {a:"B1",b:"R2p",kind:"susp"},
  {a:"R2p",b:"B2",kind:"susp"},
  {a:"B2",b:"R3p",kind:"susp"},
  {a:"R3p",b:"SB",kind:"susp"},
  {a:"SB",b:"CAP",kind:"lib"},
  {a:"CAP",b:"QCD",kind:"lib"},
  {a:"QCD",b:"FRG",kind:"lib"},
  {a:"FRG",b:"R4p",kind:"lib"},
  {a:"R4p",b:"LIB",kind:"lib"},
  {a:"LIB",b:"SEQ",kind:"lib"}
];

/* ONE LANE, AND IT IS /pipeline's OWN. Same span, so the stations land at the
   same spacing they have on the big map and this page is a magnification
   rather than a re-layout. */
const LANES = [
  {id:"r2", y:R2, x0:0.7, x1:22.0, dir:+1},
];

const ROWS = [R2], MIRROR = 22.7;

/* The mat under the row, taken from /pipeline's own band for row 2. */
const BANDS = [
  {name:"Molecular biology", x0:-2, x1:24, y0:R2-3.8, y1:R2+3.8},
];

/* No carries: this page is one row and it runs out at the sequencer, which is
   where the reads begin and /FASTQ_pipe picks up. */
const CARRIES = [];
const CARRIED = [];

/* Positions saved from the editor are pasted back here. Empty until somebody
   bakes a layout in — until then the lane engine's own answer is the layout. */
const OFFSETS = {};
const TEXT = {};

/* The two helpers SNIPPETS itself calls. Lifted with it — a payload that
   cannot format its own record is a payload that throws when a dot is clicked,
   and nothing on the page says so until somebody clicks one. */
const pad = (s,n) => String(s).padEnd(n);

const pick = a => a[Math.floor(Math.random()*a.length)];

/* ---- THE PAYLOADS THE DOT SNIPPETS CARRY ---------------------------------
   Lifted with SNIPPETS, because SNIPPETS reads them: clicking a dot on a track
   opens a record, and these are the records. Same rule as everything else here
   — /pipeline owns them, so change them there and lift again. */
const REAL_CELLS = [
 {cell:"01_01_05__s1", sample:"Ctrl_1",            pert:"DMSO",          sub:"1", b1:"A1", b2:"A1", b3:"A5",  tscp:9500, genes:3303, reads:17076},
 {cell:"01_01_95__s1", sample:"Ctrl_1",            pert:"DMSO",          sub:"1", b1:"A1", b2:"A1", b3:"H11", tscp:1934, genes:867,  reads:3475},
 {cell:"19_01_24__s1", sample:"Sorafenib_1",       pert:"Sorafenib",     sub:"1", b1:"B7", b2:"A1", b3:"B12", tscp:5047, genes:1984, reads:9075},
 {cell:"13_01_59__s1", sample:"Orlistat_1",        pert:"Orlistat",      sub:"1", b1:"B1", b2:"A1", b3:"E11", tscp:7655, genes:3083, reads:13856},
 {cell:"31_01_30__s1", sample:"Dapaglifozan_1b",   pert:"Dapagliflozin", sub:"1", b1:"C7", b2:"A1", b3:"C6",  tscp:4155, genes:2036, reads:7630},
];

const REAL_GENES = [
 {sym:"slc35a5", id:"ENSDARG00000000001", orig:"SLC35A5"},
 {sym:"ccdc80",  id:"ENSDARG00000000002", orig:"ccdc80"},
 {sym:"nrf1",    id:"ENSDARG00000000018", orig:"NRF1"},
 {sym:"ube2h",   id:"ENSDARG00000000019", orig:"UBE2H"},
 {sym:"nherf1",  id:"ENSDARG00000000068", orig:"NHERF1"},
 {sym:"dap",     id:"ENSDARG00000000069", orig:"DAP"},
];

const REAL_LEAVES = [
 {id:0,   n:654,  comp:0, nenr:105, low:false,
  mk:[["pdgfrb",3.01,.751,.056],["ednra",2.87,.694,.074],["cxcl12b",2.83,.471,.045],["loxl2a",2.77,.700,.074]],
  call:"early mural cell / pericyte progenitor (peri-arterial perivascular mesenchyme)",
  node:"perivascular mural/pericyte mesenchyme", tier:"cell_type_broad", ssmp:1.0, dec:"assign"},
 {id:40,  n:1316, comp:2, nenr:100, low:false,
  mk:[["si:ch211-250g4.3",4.77,.967,.062],["si:dkey-240n22.2",4.62,.809,.056],["kel",4.26,.853,.070],["hspa2",4.11,.685,.060]],
  call:"erythroid cells (primitive embryonic erythrocytes/erythroblasts)",
  node:"primitive embryonic erythrocytes", tier:"cell_type_sub", ssmp:0.808, dec:"assign"},
 {id:50,  n:3942, comp:3, nenr:23,  low:false,
  mk:[["rorb",2.96,.819,.092],["vsx2",2.47,.729,.048],["rx1",1.99,.645,.039],["ephb6",1.95,.641,.086]],
  call:"retinal progenitor cell (vsx2+ ventral retinal neuroepithelial progenitor / early bipolar-interneuron precursor)",
  node:"— kept as its own node —", tier:"self", ssmp:null, dec:"assign"},
 {id:138, n:295,  comp:7, nenr:199, low:false,
  mk:[["frem2",6.25,.997,.084],["and1",5.18,.827,.042],["vcana",4.95,.800,.038],["and3",4.39,.749,.013]],
  call:"fin fold mesenchyme (actinotrichia-associated embryonic fin mesenchyme)",
  node:"fin fold mesenchyme", tier:"cell_type_sub", ssmp:1.0, dec:"assign"},
];

const REAL_NOTE = "Read off the artefact on the instance, not generated. The file it came from is named in the header of pipeline-data.js.";

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

const REAL_SCORES = [
 {leaf:40, call:"erythroid cells (primitive embryonic erythrocytes/erythroblasts)",
  term:"Erythrocytes", dom:"Erythrocytes", n:279, lenient:1.000, strict:1.000, purity:1.000},
 {leaf:48, call:"neural tissue, unresolved region (abstain · tissue)",
  term:"CNS", dom:"Midbrain (Optic Tectum)", n:661, lenient:0.997, strict:0.065, purity:0.926},
 {leaf:50, call:"retinal progenitor cell (vsx2+ ventral retinal neuroepithelial progenitor)",
  term:"CNS", dom:"CNS", n:1027, lenient:0.998, strict:0.852, purity:0.852},
 {leaf:74, call:"ciliated olfactory sensory neuron",
  term:"CNS", dom:"CNS", n:7, lenient:1.000, strict:1.000, purity:1.000},
];

const REAL_SUBLIBS = [
 {n:"Sublib1", id:"LV6001530579", cells:12656, reads:420996131, tscp:89158063, sat:0.370, q30:0.972, vbc:0.740, knee:613.7},
 {n:"Sublib4", id:"LV6001530639", cells:11611, reads:491944196, tscp:91763905, sat:0.486, q30:0.972, vbc:0.767, knee:684.5},
 {n:"Sublib6", id:"LV6001530676", cells:11477, reads:470748221, tscp:90973638, sat:0.448, q30:0.970, vbc:0.759, knee:681.1},
 {n:"Sublib7", id:"LV6001530694", cells:11152, reads:486116660, tscp:92322615, sat:0.462, q30:0.971, vbc:0.762, knee:711.2},
];

/* ROW 2'S SHARE OF /pipeline's UNVERIFIED SET, and it is not optional: the
   reader reads it WITHOUT guarding, so an absent one is a ReferenceError the
   moment anybody picks a station. Three of this row's stations have not been
   checked with Patrick. */
const UNVERIFIED = new Set(["B9","C1","C2"]);

const SNIPPETS = {
  fish: () => { const c=pick(REAL_CELLS); return {label:"one well of embryos", flag:null,
    note:"Reconstructed from the design spec plus the well this cell's sample actually occupied in the loading table. Dose is from the design document only — it appears in no column of the object.", text:
`round_1_well  ${c.b1}   (48-well layout, rows A-D)
sample        ${c.sample}
embryos       6
line          TU wildtype  (design spec says fli1:egfp — unresolved)
dose_at_24hpf ${c.pert==="DMSO"?"0.1% DMSO (vehicle)":"1 uM"}
compound      ${c.pert}
collected     48 hpf, pooled per well`};},

  susp: () => { const c=pick(REAL_CELLS); return {label:"one fixed cell", flag:null,
    note:"The three barcode wells are real, read from obs for this cell. Shown mid-chemistry: bc2 and bc3 are what this cell will receive two and four steps later.", text:
`round_1_well   ${c.b1}         <- sample identity, written here
bc2_well       ${c.b2}         (not yet ligated)
bc3_well       ${c.b3}${pad("",4-String(c.b3).length)}        (not yet ligated)
sublibrary     not yet assigned
state          fixed, permeabilised, intact
becomes        ${c.cell}`};},

  lib: () => { const s=pick(REAL_SUBLIBS); return {label:"one sublibrary", flag:null, note:REAL_NOTE, text:
`sublibrary      ${s.n}
library_id      ${s.id}
submission      SO11332-Zeroshot-Bio
kit             Evercode WT, chemistry v3
cells_called    ${s.cells.toLocaleString()}
reads           ${s.reads.toLocaleString()}
adapters        TruSeq R1 / R2`};},

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

  meta: () => { const c=pick(REAL_CELLS); return {label:"one sample record",
    flag: c.sample.indexOf("Dapaglifozan")===0 ? "obs['sample'] misspells the compound — prefer obs['perturbation']" : null,
    note:"Four real obs columns for one cell. In a combinatorial design there is no separate well-map file — the round-one barcode is the sample.", text:
`bc1_well      ${c.b1}
parse_sample  ${c.sample}
sample        ${c.sample}
perturbation  ${c.pert}
replicate     ${c.sample}
dose_uM       — not recorded anywhere in the object —`};},

  cell: () => { const c=pick(REAL_CELLS); return {label:"one barcode", flag:null,
    note:"A real row of the delivered matrix. There is no pct_mito and no doublet score in it — the vendor computed them, and did not ship them.", text:
`cell_id      ${c.cell}
sublibrary   ${c.sub}
tscp_count   ${c.tscp.toLocaleString()}
gene_count   ${c.genes.toLocaleString()}
mread_count  ${c.reads.toLocaleString()}
perturbation ${c.pert}
cell_type    unknown          <- all 94,616 of them`};},

  drop: () => ({label:"one discarded barcode", flag:"no such record exists, anywhere in the corpus",
    note:"The one payload on the map that cannot be filled in. Vendors emit settings, authors publish thresholds, and nobody ships a per-barcode outcome. The fields below are what a cull ledger would have to carry.", text:
`barcode      — not recorded —
dropped_by   — not recorded —
stage        one of: cell-calling / depth / mito / outlier / demux / doublet

what exists instead, across the corpus:
  cell calling   FDR 0.01 · fitted knee · --expect-cells 6k-21k
  depth floor    100-250 · >200 genes · 2,000-20,000 · 500
  mito           25% · 15% · 10% · 0.5-1.5% · none · a no-op
  outlier        spline p 7e-6..1e-3 · 4 SD · top 0.5%
  demux          ratio >3/>5 · >=2.5 + 5 UMI · SNR >=5 · n/a
  doublet        p 0.47-0.90 · manual · DoubletFinder 5% · none`}),

  leaf: () => { const l=pick(REAL_LEAVES); return {label:"one leaf briefing", flag:"identity withheld",
    note:"Exactly what the labeller received for this leaf. No label, no compartment name, no hint — and markers_down is empty here because it is empty on all 267.", text:
`leaf            ${l.id}
compartment     ${l.comp}   (of 18)
n_cells         ${l.n.toLocaleString()}
low_n           ${l.low}
n_enriched      ${l.nenr}
markers_up      ${l.mk.map(m=>m[0]).join(", ")}
  ${l.mk.map(m=>`${pad(m[0],20)} l2fc ${String(m[1]).padStart(5)}  in ${(m[2]*100).toFixed(1)}%  out ${(m[3]*100).toFixed(1)}%`).join("\n  ")}
markers_down    — empty on every leaf —`};},

  stat: () => ({label:"one grounding probe", flag:null,
    note:"The probe that gated registration of the worked example's slot on :5007. Leaf 0 is the mural/pericyte leaf; sox2 is checked as a negative control and comes back correctly depleted. Published marker evidence like this exists for exactly one atlas in the corpus, which is why the service has to.", text:
`service      :5007  dataset_id minifin_p0
kind         pvalues
leaf         0

pdgfrb       l2fc  3.005   pct_in 0.751   padj 1.09e-155
ednra        l2fc  2.868
cxcl12b      l2fc  2.828
sox2         l2fc -0.834                  <- correctly depleted

cross-check, CNS leaf 48
sox2         l2fc +0.333   pdgfrb -0.538  <- signs flip`}),

  call: () => { const l=pick(REAL_LEAVES); return {label:"one concluded call", flag:null,
    note:"A real row of the deliverable. Free text, not an ontology id — the frozen ZFA menu postdates this run by four weeks. Called de novo from this leaf's own markers, not transferred from a reference.", text:
`leaf             ${l.id}
decision         ${l.dec}
identity         ${l.call}
consolidated_to  ${l.node}
tier             ${l.tier}
ssmp             ${l.ssmp===null?"— singleton, not merged —":l.ssmp.toFixed(3)+(l.ssmp<0.34?"   FLAGGED marker-disjoint":"")}
called           de novo, from markers — not transferred`};},

  score: () => { const s=pick(REAL_SCORES); return {label:"one judged call", flag:"ground truth enters only here",
    note:"Scored against the sealed expert key, control cells only. Leaf 48 is the ontology-axis mismatch in one row: lenient 1.00, strict 0.07, because the key says Midbrain and markers cannot see a region.", text:
`leaf             ${s.leaf}
predicted        ${s.call}
gold (finest)    ${s.dom}
gold (term)      ${s.term}
n_labelled       ${s.n.toLocaleString()}   (control-vote)
lenient          ${s.lenient.toFixed(3)}
strict           ${s.strict.toFixed(3)}
purity           ${s.purity.toFixed(3)}`};},
};

/* What the reader shows when nothing is selected. */
const OVERVIEW = {
  eyebrow:"ZEBRAFISH SINGLE-CELL · ROW 2 OF THE PLATONIC PIPELINE",
  title:"Molecular biology",
  sub:"thirteen stations · fixed cells in, a sequencing library out",
  /* `does` is the field the reader renders as "The story" — the same name a
     node uses, because the overview IS a node as far as the text editor is
     concerned. Calling it anything else renders the word undefined. */
  does:`
<p><mark>Row 2 of <a href="/pipeline">/pipeline</a>, on its own.</mark> Fixed material comes out of the freezer and thaws, and everything after it is chemistry: three rounds of in-situ barcoding, each followed by a pool and split, then lysis, cDNA capture and amplification, library prep, the indexing PCR, a size check, and the sequencer.</p>
<p><mark>The barcode is built in the cell, not read off it.</mark> That is what makes this the row the rest of the map depends on: a cell never leaves its well with an identity attached — it acquires one by surviving three rounds of ligation in a known order, and the combination is the address. Round 4 is different in kind: it is a PCR index on the tube, not on the cell.</p>
<p>This page is a <mark>bench for developing the row out</mark>, the way <a href="/FASTQ_pipe">/FASTQ_pipe</a> is one for row 3. Every station is drawn as the tile it is on the big map; a station that earns a real drawing gets one here first, and comes back to /pipeline once it works. <mark>The prose is lifted and /pipeline owns it</mark> — change a claim there and lift it again.</p>
`,
  /* `built` and `cond` are the same two fields every node carries, and the
     reader renders them under their own headings. The overview is a node as far
     as the reader and the text editor are concerned, so leaving them out is a
     missing field rather than a shorter page. */
  built:`<p>Thirteen stations, lifted from row 2 of <a href="/pipeline">/pipeline</a>. The figures on them are that map's: 48 wells in round one against 96 in rounds two and three, and 3,655,719,111 reads off the sequencer at the end. Nothing here is modelled — every number is read off an artefact and lives in the prose of the station that owns it.</p>`,
  cond:`<p>This is a bench, so what it draws is deliberately unfinished: eleven of the thirteen stations are still the plain tile a stage gets before anybody has drawn it. That is the work, not an oversight. <mark>What must not drift is the prose</mark> — it is lifted from /pipeline and that map owns it, so a claim that changes has to change there and be lifted again, or the site ends up with two accounts of one row.</p>`,
  howto:`<p>One landmark — the Thaw — sits on a dashed plinth and carries its name on the ground. Every other station is a tile, which is what a stage looks like before anybody has drawn it. Hatching would mean the stage destroys data; nothing on this row does. The row reads left to right and nothing feeds it from off the page: on the big map the row above supplies the fixed material, and that is said by where the rows sit rather than by a track.</p>`,
};
