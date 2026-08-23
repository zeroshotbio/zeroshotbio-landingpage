/* ============================================================
   bp-data.js — what this map is ABOUT.
   Owned by the on-instance.

   THIS IS ROW 3 OF /pipeline, AND ONLY ROW 3.

   On the big map the four rows are named "Biological samples", "Molecular
   biology", "Bioinformatics pipeline" and "Opinionated metadata". The third
   of those is this page: FASTQ in, a counting stack, the unfiltered matrix,
   six culls, the filtered matrix out. There it is one band among four and its
   nodes are drawn small. Here it has the whole canvas.

   EVERY NODE BELOW IS LIFTED VERBATIM FROM pipeline-data.js. Not re-typed —
   extracted as source text, so every character of every does/built/cond field
   matches the map it came from and a diff between the two stays meaningful.
   If a claim on that map changes, change it there and lift it again; do not
   let the two drift into two different accounts of the same stage.

   WHAT IS ADDED, AND IT IS ONE THING
   CPLX, the complexity roof, hanging under the cull that fits it. Node D5
   "Outliers off the trend" says it fits genes detected against total counts
   and removes points sitting too far off the fit. That is a two-dimensional
   argument, and on /pipeline it is a 0.7-unit box with the argument in the
   text. Here it is drawn: a building with the actual scatter, the fitted
   cubic and the robust band painted flat on its roof.

   THE ONE THING THAT MAKES IT DIFFERENT FROM EVERYTHING ELSE HERE
   Every figure on this page is REAL — read off the artefacts, and identical
   to /pipeline's. The complexity roof is not: it is drawn from a seeded
   simulation in bp-pop.js, because the real fit is a per-sample spline at a
   p-level spanning 6.9e-6 to 1e-3 across a single plate, and there is no
   single number to draw. It says MODELLED on the roof, on its label on the
   map, and in the reader. Keep it in all three.

   Load order: iso -> pop -> shapes -> data -> view
   ============================================================ */

/* Row 3 sits at y = 0 here, because it is the only row. On /pipeline it is
   at 27.2, under the chemistry and above the labelling. */
const R3 = 0;

const NODES = [

{id:"FQ", key:"3", group:"③ FASTQ", groupMark:true, anchor:true, shape:"heap",
 lane:"r3",
 name:"FASTQ", x:1.0, y:R3, w:2.7, d:2.7, h:0.7,
 sub:"paired-end · demultiplexed · usually gone", stat:"off-instance",
 does:"The first digital object, and the only genuinely shapeless one. Different libraries, different depths, no schema — and nothing in it yet says which barcode is a cell.",
 built:"For the worked example: sequenced 2026-03/04 and processed in the vendor's own cloud workdir, whose S3 path the run definition still points at. Demultiplexing is its own named step in some pipelines — Zebrahub records bcl2fastq v2.20.0.422 — and invisible in others.",
 cond:"The biggest hole on the map, and a general one. The reads are not on this box and no manifest of them is either, so every raw-read claim on this page is downstream of a vendor report rather than of the reads. It is worse elsewhere: ChemFish's pre-QC data is documented as unavailable, and CellOracle's SRA FASTQs are a deliberate non-acquisition. Re-deriving anything — a second annotation arm, a different intron setting — starts by getting the reads back."},

{id:"cb1", key:"C4", group:"Getting to a matrix", shape:"tile", name:"Barcode calling", x:4.2, y:R3, lane:"r3", w:0.68, d:0.68, h:0.42,
 sub:"four stacks, one job",
 does:"Reads the cell barcode off the reads and reconstructs which physical path each molecule took — through three barcode plates, or into one droplet, or onto one microwell bead.",
 built:"Four counting stacks appear across the corpus and they are not interchangeable: bbi-dmux → bbi-sci for sci-RNA-seq3 (ZSCAPE, ChemFish); Cell Ranger for 10x (DanioCell 4.0.0 wrapping STAR 2.5.1b, MIC-Drop-seq 5.0.0, Zebrahub 5.0.1, CellOracle 5.0.1); split-pipe v1.7.1 for Parse (MiniFin, MegaFin); STAR plus modified Drop-seq tools 1.12 for Microwell-seq (ZCL2). In the worked example, 75.7% of reads carry a valid barcode combination.",
 cond:"The version is load-bearing and it is often wrong in the record. MIC-Drop-seq's GEO metadata says Cell Ranger v7 on all 36 samples; the pipeline's own machine-written web_summary.html says 5.0.0 — and that difference decides whether introns were counted. Where a hand-typed field and a machine-written run artefact disagree, the artefact wins. Also worth noticing: the 24.3% of reads with no valid barcode are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull."},

{id:"cb2", key:"C5", group:"Getting to a matrix", shape:"tile", name:"Alignment", x:5.9, y:R3, lane:"r3", w:0.68, d:0.68, h:0.5,
 sub:"cDNA → gene model",
 does:"Aligns the cDNA read to the genome and assigns it to a gene.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus — the variation is entirely in the annotation laid over it, and in what counts as being inside a gene. For the worked example: 46.1% of reads map to the transcriptome, exonic fraction 63.8%. For contrast, MIC-Drop-seq's 10x runs confidently map 92.4% to the genome and 72.7% to the transcriptome.",
 cond:"A 46% transcriptome mapping rate looks alarming and is not a failure — it is the 3′ UTR problem next door, unpatched. The gap between 46% here and 73% there is mostly annotation, not chemistry, which is why the reference nodes above this row matter more than they look."},

{id:"IN", key:"G2", group:"Getting to a matrix", shape:"tile", hatch:true, name:"Intron inclusion", x:6.8, y:R3, lane:"r3", w:0.68, d:0.68, h:0.36,
 sub:"one boolean, rarely reported",
 does:"Decides whether a read landing inside an intron counts toward its gene. It is one flag, it is almost never stated, and it changes the matrix materially.",
 built:"Cell Ranger flipped this default across exactly the versions in play: 5.0.0 counts no intronic reads and offers no option, 6.x makes it opt-in and off by default, 7.x turns it on by default. MIC-Drop-seq's released main-screen matrix was built with Include introns: False, discarding 9.1–9.5% of confidently-mapped reads against 76.5–77.3% exonic.",
 cond:"Three consequences, all worse than the version number. Reproducing that matrix requires Cell Ranger 5.0.0 specifically — a modern default produces a materially different object, silently. Cross-dataset depth comparisons are confounded in a known direction, because sci-RNA-seq3 runs on intron-rich nuclei while the 10x runs here used whole cells and threw the introns away. And low detection of a long or nuclear-retained transcript is weak biological evidence, because gene absence already has two non-biological explanations."},

{id:"cb3", key:"C6", group:"Getting to a matrix", shape:"tile", name:"UMI collapse", x:7.6, y:R3, lane:"r3", w:0.68, d:0.68, h:0.4,
 sub:"reads → molecules",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 built:"For the worked example, 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424. MIC-Drop-seq's four measured 10x runs sit at 51.5–53.4%.",
 cond:"Saturation around 0.4–0.5 is the corpus norm and it means depth is not saturated: read depth alone accounts for about a quarter of the worked example's cluster resolution. Any cross-dataset comparison of genes-per-cell has to control for it. ZCL2 cannot even be checked — its UMI length is not stated and is not recoverable from a count matrix."},

{id:"cb4", key:"C7", group:"Getting to a matrix", shape:"tile", name:"Combine and stamp", x:9.3, y:R3, lane:"r3", w:0.68, d:0.68, h:0.45,
 sub:"one index",
 does:"Stitches the per-library matrices into one and stamps each barcode with where it came from.",
 built:"For the worked example: split-pipe mode 'comb' over eight sublibraries. Cell ids come out as bc1_bc2_bc3__sublibrary — 01_01_05__s1 — so all four barcode rounds stay legible in the index itself.",
 cond:"86.1% of transcripts land inside called cells; the remaining 13.9% is the ambient pool and it is dropped here rather than kept as a background profile. Barcode conventions are a live trap whenever matrices are compared: ZCL2's 18 nt barcodes need a 3 × 6 split to parse, and MegaFin's vendor-well barcodes have 0% overlap with the same library's raw-combinatorial rebuild — the same cells, unjoinable."},

{id:"W", key:"D1", group:"Getting to a matrix", shape:"tile", follow:{a:"cb4"}, name:"Sample metadata join", x:9.3, y:R3+2.4, w:0.85, d:0.85, h:0.35,
 sub:"which cell saw what",
 does:"Carries the treatment plate forward: which barcode belongs to which sample, and therefore which compound each cell saw. It is the only thing on this row that came from the first row rather than from the row above.",
 built:"In a combinatorial design this is free — the round-one barcode is the sample, so the join is a lookup. For the worked example it lands as bc1_well (48 values), parse_sample, sample and perturbation (4 values).",
 cond:"Free here, expensive elsewhere. Hashed designs have to infer sample identity statistically and lose cells doing it — that is the demultiplex cull further along this row. Worth checking what actually survives the join: ChemFish records compound, dose, addition time and collection time, but its compare_against column, which names the intended control arm, is populated for only 20% of cells."},

{id:"E", key:"C8", group:"The counting reference", shape:"tile", follow:{a:"cb1",b:"cb2"}, name:"The counting reference", x:5.05, y:R3-2.3, w:0.34, d:0.34, h:0.2,
 sub:"one assembly, four feature universes",
 does:"The gene model reads are assigned against. Nominally a detail; in practice the single largest source of incomparability between two zebrafish atlases.",
 built:"Every dataset here is GRCz11, and yet: ZSCAPE and ChemFish share a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031 genes — byte-identical between them, all 32,031 coordinates matching position by position. DanioCell uses Lawson v4.3.2 via Cell Ranger, 36,250 released names. MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520. Zebrahub uses a custom reference called Danio.rerio_genome_Zebrabow_6, 32,057 ENSDARG plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason. What works instead is reconstruction from the builder's own code plus the released coordinates, which is how ZSCAPE's was recovered exactly. What does not work is asking the paper: ZSCAPE, ChemFish and Zebrahub name no GTF at all, and Zebrahub's was written off in 2026 after six sources were exhausted."},

{id:"UTR", key:"G1", group:"The counting reference", shape:"tile", follow:{a:"cb2",b:"cb3"}, name:"3′ UTR handling", x:6.75, y:R3-2.3, w:0.34, d:0.34, h:0.2,
 sub:"the defect everything routes around",
 does:"Every assay on this map primes with oligo-dT, which puts the reads at the 3′ end. Zebrafish 3′ UTRs are incomplete in both Ensembl and RefSeq. So a large share of perfectly good reads land just past the annotated end of a gene and get called intergenic.",
 built:"Three responses exist in this corpus and each dataset picks exactly one. BBI extends every gene 3′ by 500 bp, strand-aware, clipping or retracting where the extension would collide with a same-strand gene — measured in the released ZSCAPE coordinates as a median +500 on the plus strand, −500 on the minus, 0 at the 5′ end, with 2,206 genes fully retracted. The Lawson Lab instead rebuilt the annotation with improved 3′ UTR models and added genes missing from both sources. Parse does neither.",
 cond:"The most important thing on this row, and invisible in every deposited object. The three responses cannot be reconciled after the fact: a gene's coordinates differ, so its counts differ, so its markers differ. It also explains two numbers that look like problems and are not — the worked example's 46% transcriptome mapping rate, and the existence of a second annotation arm at all."},

{id:"V", key:"C9", group:"The counting reference", shape:"tile", follow:{a:"cb3",b:"cb4"}, name:"Second annotation arm", x:8.45, y:R3-2.3, w:0.34, d:0.34, h:0.2,
 sub:"same reads, different gene space",
 does:"Re-counting the same library against a better annotation, as a second arm rather than a replacement.",
 built:"Lawson v4.3.2 is held at datasets/zebrafish/references/lawson_v4_3_2/. The one arm that exists was built with our own STARsolo on MegaFin Part 1 and recovered 345,651 cells against the vendor's 540,946 on the same library — 36% fewer, at a far harsher UMI floor (min retained 1,769 vs 232).",
 cond:"It is not 'the same cells in a different gene space'. The two arms differ by 195,295 cells, and six of the eight worst-hit samples lose more than 90% of theirs. A bridge exists but is thin — lawson_to_ensdarg.csv maps 7,238 of 36,351 Lawson genes to ENSDARG, 19.9%: enough to compare, nowhere near enough to concatenate. And the v4.3.2 gene-information table is still missing, so the GTF carries no biotypes."},

{id:"UD", key:"4", group:"④ Unfiltered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Unfiltered matrix", x:12.2, y:R3, w:2.5, d:2.5, h:2.0, cells:8, fill:0.09,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone."},

{id:"c1", key:"D2", group:"The cull", shape:"tile", hatch:true, name:"Cell or background", x:15.4, y:R3, lane:"r3", w:0.7, d:0.7, h:0.78,
 sub:"knee, classifier, or expect-cells", tier:"physics",
 does:"Separates barcodes that held a cell from barcodes that held only ambient RNA. Not a judgment call in principle, and by volume much the largest cut.",
 built:"Every stack does this and none of them do it the same way. Parse Trailmaker runs a classifier at FDR 0.01; split-pipe fits a transcript cutoff per sublibrary (613.7–711.2 in the worked example, 670.4 combined); Cell Ranger uses its own cell-calling against --expect-cells (DanioCell set 6,000–21,250 per sample); Microwell-seq took the top 10,000 cells by transcript count, or 20,000 depending which artefact you read; ZCL2's code instead treats everything below 500 UMI as the ambient profile and excludes it.",
 cond:"The only stage on this row whose threshold is fitted rather than chosen, which is why it is the one to trust. It is also where an undocumented floor can hide: CellOracle's deposit has a minimum of exactly 500 UMI with zero cells below it, and no paper or GEO record mentions a 500-UMI rule anywhere."},

{id:"c2", key:"D3", group:"The cull", shape:"tile", hatch:true, name:"Depth floor", x:16.6, y:R3, lane:"r3", w:0.7, d:0.7, h:0.52,
 sub:"100 UMI to 2,000, depending who you ask", tier:"physics",
 does:"Removes barcodes carrying too few molecules or too few genes to support any statement about cell type.",
 built:"The corpus spread is nearly two orders of magnitude and every value is defensible in its own context: 100–250 UMI set per experiment (ZSCAPE); 80 stated and ~100 realised (ChemFish); more than 200 detected genes (DanioCell); a total-count window of 2,000–20,000 (Zebrahub); 500 transcripts and 200 genes as published (ZCL2); a per-sample fitted knee of 232–1,370 (MegaFin CP01).",
 cond:"Two failures worth carrying. ZCL2's released atlas does not obey its own published floor at all — minimum 63 UMI and 27 genes against a stated 500 and 200, so the deposit is pre-QC. And the worked example retains cells down to 294 transcripts, below split-pipe's own 670 knee estimate, while its cell count is exactly split-pipe's number_of_cells — which suggests the vendor's QC chain was applied to the analysis object and not to what was delivered."},

{id:"c3", key:"D4", group:"The cull", shape:"tile", hatch:true, name:"Mitochondrial fraction", x:17.8, y:R3, lane:"r3", w:0.7, d:0.7, h:0.5,
 sub:"25% · 15% · 10% · 1% · none", tier:"taste",
 does:"Removes cells dominated by mitochondrial transcripts — usually cells stressed or broken during dissociation.",
 built:"ZSCAPE cuts above 25%, Zebrahub above 15%, DanioCell above 10%, Parse Trailmaker at a per-sample absolute threshold of 0.50–1.51%, CellOracle not at all.",
 cond:"These numbers are not comparable, because the mitochondrial gene set is not the same object twice. Parse counts only the 13 protein-coding mitochondrial genes (~0.19% typical); measured over the full 37-feature MT contig the same cells sit near 8%, forty-three times higher. Reuse '1% mito' against a differently-defined set and you delete the dataset. Worse, the filter can silently do nothing: ZCL2's code matches with the pattern ^mt: — the Drosophila convention, inherited unchanged from a cross-species script — which matches zero zebrafish genes, so percent.mt is 0 for every cell and a cutoff at 20% excludes nothing. And the cut is never neutral across cell types: it sits directly downstream of a dissociation step that stresses tissues unequally."},

{id:"c4", key:"D5", group:"The cull", shape:"tile", hatch:true, name:"Outliers off the trend", x:19.0, y:R3, lane:"r3", w:0.7, d:0.7, h:0.62,
 sub:"spline residual, or 4 SD, or the top 0.5%", tier:"taste",
 does:"Fits genes detected against total counts and removes points sitting too far off the fit — classically two cells sharing one barcode.",
 built:"Parse Trailmaker fits a spline per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate. ZSCAPE removes cells more than 4 SD from the mean UMI. DanioCell removes the top 0.5% by detected features.",
 cond:"Two problems. It runs before the doublet scorer and removes much of what the doublet scorer exists to find, so the two are partly redundant and their order decides which gets the credit — and the order genuinely differs between stacks. And DanioCell's version is untestable after the fact: the top 0.5% of an already-filtered distribution is 0.5% by construction, so the rule cannot be verified against the deposit."},

{id:"hx", key:"G3", group:"The cull", shape:"tile", hatch:true, name:"Sample demultiplex", x:20.0, y:R3, lane:"r3", w:0.7, d:0.7, h:0.46,
 sub:"only if the sample was hashed", tier:"taste",
 does:"In multiplexed designs, assigns each cell to the embryo or sample it came from by its hash oligo, and discards cells that cannot be confidently assigned. An entire cull stage that exists or does not exist depending on a choice made two rows up.",
 built:"ZSCAPE uses sci-Plex hashing with an enrichment ratio above 3 for the timeseries rounds and above 5 for perturbations, cutoffs set manually from the ratio distribution. ChemFish uses the same chemistry at ratio ≥ 2.5 with total corrected hash UMI above 5. DanioCell uses MULTI-seq: a barcode is negative below 20 UMIs, a singlet needs SNR ≥ 5, and cells called doublets by either approach are removed. Combinatorial designs skip this entirely — the barcode already is the sample.",
 cond:"The clearest case in the corpus of a published threshold that was not applied. ChemFish's round-two screen was released without its stated hash filters: 65,736 cells (4.83%) fall below the 2.5 enrichment cutoff and 16,541 (1.22%) below the hash-UMI floor, while round one matches every published threshold exactly. Two rounds of one experiment, one filtered and one not, and nothing in the object says which is which."},

{id:"c5", key:"D6", group:"The cull", shape:"tile", hatch:true, name:"Doublets", x:21.0, y:R3, lane:"r3", w:0.7, d:0.7, h:0.44,
 sub:"five tools, and one no tool at all", tier:"taste",
 does:"Scores each barcode for looking like two cells and removes those above a threshold.",
 built:"Parse Trailmaker fits a probability threshold per sample, 0.469 to 0.903 across one plate. ZSCAPE inspects residual multiplet clusters manually and removes them. ZCL2 runs DoubletFinder at a fixed 5% expected rate. MIC-Drop-seq's Methods state scDblFinder. Our own droplet path uses Scrublet. CellOracle mentions no doublet detection anywhere.",
 cond:"The least consistent stage on the map and the least auditable. MIC-Drop-seq states scDblFinder in Methods and deposits no doublet column in any object, so the claim cannot be checked at all. A per-sample threshold that swings from 0.47 to 0.90 across one plate is not measuring a constant property. And the true collision rate was set two rows up by loading density, which none of these tools can see."},

{id:"Q", key:"D7", group:"The cull", shape:"tile", follow:{a:"c4"}, name:"Cull ledger", x:17.8, y:R3+2.6, w:1.2, d:1.2, h:0.3,
 sub:"one row per dropped barcode",
 does:"What the Sankey should be drawn from: which stage killed which barcode, and why.",
 built:"Node and link labels would use the plain-English phrasings on this row, never the internal step names.",
 cond:"It does not exist here, and it does not exist anywhere else in the corpus either, which is the more interesting fact. Vendors emit settings, not tallies. Authors publish thresholds, not ledgers. CellOracle reports a comparison at 57,175 cells against a deposit of 72,870 — roughly 21.5% removed by QC and ambient-cluster steps that are never numerically specified. Every retention figure on this row is therefore a ratio between two objects, never a sum over stages."},

/* ---- the one addition ---------------------------------------------------
   Hung under D5 rather than replacing it, because D5 is part of the section
   being copied and its text is the text on the big map. This is that node's
   argument, drawn — the same relationship the counting reference, the 3' UTR
   handling and the cull ledger already have to the steps they hang off.
   ------------------------------------------------------------------------ */
{id:"CPLX", key:"F4", group:"The cull", shape:"complexityroof",
 follow:{a:"c4", dx:2.2}, modelled:true,   /* off D7's label line, see below */
 name:"Genes vs transcripts", x:19.0, y:R3+6.6, w:4.55, d:4.55, h:0.55,
 sub:"the fit D5 makes, drawn · modelled", tier:"taste",
 does:"The argument node D5 makes, as a picture. Genes detected against total counts, log-log, with a least-squares cubic through the cloud and a band opened to a robust residual sigma. Both tails go and they go for opposite reasons, which is the thing a sentence keeps losing: above the band are under-amplified cells, unusually many distinct genes per transcript; below it are over-amplified ones, the same transcripts read again and again. Reading this filter as one-sided is the common mistake, so the two annotations sit diagonally opposed and the two gestures are deliberately not each other's mirror — the under-amplified peel off the surface, the over-amplified swell where they lie and burst.",
 built:"The chart is drawn in ordinary flat two dimensions and laid onto the roof by a single transform, so a circle painted in chart space comes out as the correct ellipse and nothing can occlude it. Painted cells are ellipses; cells that are leaving lift off the roof and become circles. The cubic, the residual sigma and the band half-width are all computed at load from the population in bp-pop.js — none is a literal, and reseeding moves all of them.",
 cond:"Modelled, and the only modelled figure on this page. The real fit is a spline fitted per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate, so there is no single band to draw; what is on the roof shows the shape of the decision, not its answer. The overlap D5 already names is visible here too: a doublet carries two cells' worth of transcripts and rather less than two cells' worth of distinct genes, so it lands in the low tail of this band and would be removed before the doublet scorer at D6 ever saw it."},

{id:"FD", key:"5", group:"⑤ Filtered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Filtered matrix", x:22.0, y:R3, w:1.55, d:1.55, h:1.55, cells:6, fill:0.62,
 sub:"94,616 × 32,520 · median 3,198 UMI / 1,618 genes", stat:"the cells, as asserted",
 does:"The same gene space, a fraction of the barcodes, dense where the first cube was empty. Everything here has been asserted to be a cell.",
 built:"For the worked example: 94,616 cells × 32,520 genes, raw integer counts, no layers and no embedding. Median 3,198 transcripts and 1,618 genes per cell against a design target above 4,000.",
 cond:"The governing rule for this object is corpus principle 4 — a threshold printed in Methods is never assumed to have been applied to the deposited data. Tested against their own releases, four datasets here disagree with their own Methods: ChemFish shipped one screen without its hash filters, ZCL2 shipped a pre-QC atlas with a mitochondrial filter matching zero genes, CellOracle shipped an undocumented 500-UMI floor and no mitochondrial filter, and the worked example keeps cells below its own knee. DanioCell is the one that verifies exactly — and even there a later format conversion broke the guarantee."}
];

const ROWS=[R3], MIRROR=22.7;

/* One lane, and it is /pipeline's r3 lane unchanged — same span, same
   direction, so the section lays out here exactly as it does there. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:22.0, dir:+1},
];

const EDGES = [
  {a:"FQ",b:"cb1",kind:"read"},{a:"cb1",b:"cb2",kind:"read"},{a:"cb2",b:"IN",kind:"read"},
  {a:"IN",b:"cb3",kind:"read"},{a:"cb3",b:"cb4",kind:"cell"},{a:"cb4",b:"UD",kind:"cell"},
  {a:"E",b:"cb2",kind:"ref",dash:true},{a:"UTR",b:"cb2",kind:"ref",dash:true},
  {a:"V",b:"cb2",kind:"ref",dash:true},{a:"W",b:"cb4",kind:"meta",dash:true},
  {a:"UD",b:"c1",kind:"cell"},{a:"c1",b:"c2",kind:"cell"},{a:"c2",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"hx",kind:"cell"},{a:"hx",b:"c5",kind:"cell"},
  {a:"c5",b:"FD",kind:"cell"},
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c4",b:"Q",kind:"drop",dash:true},
  {a:"hx",b:"Q",kind:"drop",dash:true},
  /* the addition, dashed like every other side structure on this row */
  {a:"c4",b:"CPLX",kind:"trend",dash:true},
];

/* One band, and it keeps its name from the big map, because that name is the
   reason this page exists. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-2.4, x1:24.4, y0:R3-4.2, y1:R3+9.8},
];

/* Both ends fade, because neither is on this page: the reads arrive from the
   sequencer one row up, and the filtered matrix leaves for the labelling one
   row down. Drawing a hard terminus at either end would claim this stretch is
   self-contained, and it is a middle. */
const CARRIES = [
  {x0:2.05,y0:R3-8.2, x1:2.05,y1:R3-3.7, fade:"in", kind:"read",
   from:"the sequencer, one row up", to:"FASTQ"},
  {x0:22.4,y0:R3, x1:27.0,y1:R3, fade:"out", kind:"cell",
   from:"Filtered matrix", to:"the labelling, one row down"},
];

/* ============================================================
   PAYLOADS
   Also lifted from pipeline-data.js: the same records, moving along the same
   edges. Two of them deliberately show nothing, because nothing is what
   exists — the raw reads are not on this instance, and no per-barcode drop
   record exists anywhere in the corpus.
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

const pad = (s,n) => String(s).padEnd(n);
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

  /* the one payload this page adds, for the one edge it adds */
  trend: () => ({label:"the fit, as drawn", flag:"modelled, not read off anything",
    note:"Everything else in transit on this page is a real record. This is not: the real fit is a per-sample spline and there is no single band to show, so the roof draws the shape of the decision from a seeded simulation instead of its answer.", text:
`method       least-squares cubic, log10(genes) on log10(umi)
band         K x robust residual sigma (MAD of residuals)
K            2.6
above        under-amplified — many genes per transcript
below        over-amplified  — few genes per transcript

what is REAL, from Parse Trailmaker:
  a spline per sample, p-level 6.9e-6 .. 1e-3
  across one plate. No single number to draw.`}),
};

const OVERVIEW = {
  eyebrow:"Zeroshot · row 3 of the pipeline map",
  title:"Bioinformatics pipeline",
  sub:"FASTQ to a filtered matrix · six culls · the whole canvas",
  does:`<p>This is the third row of the map at <a href="/pipeline">/pipeline</a> — the band called <mark>Bioinformatics pipeline</mark> — at full size. There it is one of four rows and its nineteen objects are drawn small enough to read as a strip. Here it has the canvas to itself.</p>
<p>Nothing has been re-written. Every name, number and claim on this page is lifted from that map as source text rather than re-typed, so the two cannot drift into two different accounts of the same stage.</p>
<p><mark>Left to right:</mark> the FASTQs arrive from the sequencer one row up. A counting stack reads the barcode off the read, aligns the cDNA, decides whether introns count, collapses reads to molecules and stamps each barcode with where it came from. That produces the unfiltered matrix — every barcode that ever appeared, against every gene. Then six culls. Then the cells, as asserted.</p>
<p><mark>Above the counting stack</mark> hang the three reference structures: which gene model the reads are assigned against, how the 3′ UTR problem is handled, and whether a second annotation arm exists. They are drawn off the line because they are not steps — they are choices the line is conditional on, and they are the single largest source of incomparability between two zebrafish atlases.</p>
<p><mark>Below the culls</mark> hangs the cull ledger, which does not exist here or anywhere else in the corpus, and the one thing this page adds that the big map does not have.</p>
<p><mark>Hatching means the stage destroys data.</mark> All six culls carry it. Each one is tiered: <mark>physics</mark> where the threshold is fitted from a real feature of the data, <mark>taste</mark> where it is chosen.</p>`,
  built:`<p>The addition is <mark>D5's argument, drawn</mark>. "Outliers off the trend" fits genes detected against total counts and removes points too far off the fit. That is a two-dimensional argument, and on the big map it is a 0.7-unit box with the argument in the text. Here it is a building with the scatter, the fitted cubic and the robust band <mark>painted flat on its roof</mark>.</p>
<p>The chart is not rebuilt in three dimensions. It is drawn in ordinary flat 2D and laid onto the roof by one matrix, which is why a circle painted in chart space comes out as the correct ellipse and why nothing can occlude it. That hands it a grammar: <mark>painted things are ellipses, airborne things are circles</mark>. A cell still under consideration lies on the roof; a cell that is leaving lifts off it.</p>
<p>Both tails go, for opposite reasons, and the two gestures are deliberately not each other's mirror: under-amplified cells peel off the surface, over-amplified ones swell where they lie and burst.</p>`,
  cond:`<p class="cond">Every figure on this page is real and matches /pipeline exactly — <mark>with one exception</mark>. The complexity roof is modelled, computed at load from a seeded simulation, because the real fit is a per-sample spline at a p-level spanning 6.9e-6 to 1e-3 across a single plate and there is no single band to draw. It says so on the roof, on its label, and here.</p>
<p class="cond">The governing fact of this row is that a threshold printed in Methods is not evidence it was applied. Tested against their own releases, four datasets in the corpus disagree with their own published QC.</p>
<p class="cond">Three things are missing rather than wrong, and missing everywhere: the raw reads, the unfiltered barcode matrix, and any per-stage drop count. No dataset in this corpus ships a cull ledger, so every retention figure here is a ratio between two objects rather than a sum over stages.</p>`
};
