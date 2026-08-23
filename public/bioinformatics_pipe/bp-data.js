/* ============================================================
   bp-data.js — what this map is ABOUT.
   Owned by the on-instance.

   THIS IS THE MATRIX-TO-MATRIX HALF OF ROW 3 OF /pipeline.

   On the big map the four rows are named "Biological samples", "Molecular
   biology", "Bioinformatics pipeline" and "Opinionated metadata". The third
   of those runs FASTQ -> counting stack -> unfiltered matrix -> six culls ->
   filtered matrix. This page is the second half of it: everything between the
   two cubes, and nothing before them. The counting stack and its three
   reference structures are off this map — they are about how a matrix gets
   BUILT, and this is about what gets thrown out of one.

   EVERY NODE BELOW IS LIFTED VERBATIM FROM pipeline-data.js. Not re-typed —
   extracted as source text, so every character of every does/built/cond field
   matches the map it came from and a diff between the two stays meaningful.
   If a claim on that map changes, change it there and lift it again; do not
   let the two drift into two different accounts of the same stage.

   FOUR CULLS, EACH WITH ITS DECISION DRAWN ON ITS ROOF
     Knee        a hard transcript minimum at the steepest point of the
                 barcode-rank curve, per sample
     Mito %      cells above median + 3 MAD of mitochondrial fraction
     Complexity  both tails of the genes-vs-transcripts fit
     Doublets    scDblFinder, against the expected collision rate

   Each is one of /pipeline's own cull nodes, lifted, and each keeps its
   lifted body. What is authored here is the NAME and the one-line sub, which
   say which single policy is on the roof — on the big map a cull node has to
   cover every policy the corpus uses for that stage, and "Cell or background"
   names three of them at once. The pipelineName field carries the original
   name through to the reader so the two maps can still be matched up.

   Two of the big map's six culls are not drawn: D3, the depth floor, folds
   into the knee because the knee IS a transcript minimum, fitted rather than
   chosen; and G3, sample demultiplex, exists only for hashed designs, which
   this chemistry is not. Neither claim is being dropped — both are still on
   /pipeline — only not drawn here.

   EVERY FIGURE ON THESE FOUR ROOFS IS MODELLED, WITH ONE EXCEPTION
   The thresholds are computed at load from the seeded population in
   bp-pop.js, because none of these four has a shipping policy with a single
   drawable number behind it. The exception is the expected collision rate on
   the doublet roof, which is Poisson arithmetic over real figures — 442,368
   paths, 8 sublibraries, 94,616 cells — and is labelled REAL beside the
   modelled one it is being compared against.

   Load order: iso -> pop -> shapes -> data -> view
   ============================================================ */

/* The row sits at y = 0 here, because it is the only row. */
const R3 = 0;

const NODES = [

{id:"UD", key:"4", group:"④ Unfiltered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Unfiltered matrix", x:12.2, y:R3, w:2.5, d:2.5, h:2.0, cells:8, fill:0.09,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone."},

{id:"c1", key:"D2", group:"The cull", shape:"kneeroof", hatch:true, name:"Knee", x:15.4, y:R3, lane:"r3", w:4.2, d:4.2, h:0.52,
 sub:"hard transcript minimum at the steepest point of the barcode-rank curve, per sample", tier:"physics",
 does:"Separates barcodes that held a cell from barcodes that held only ambient RNA. Not a judgment call in principle, and by volume much the largest cut.",
 built:"Every stack does this and none of them do it the same way. Parse Trailmaker runs a classifier at FDR 0.01; split-pipe fits a transcript cutoff per sublibrary (613.7–711.2 in the worked example, 670.4 combined); Cell Ranger uses its own cell-calling against --expect-cells (DanioCell set 6,000–21,250 per sample); Microwell-seq took the top 10,000 cells by transcript count, or 20,000 depending which artefact you read; ZCL2's code instead treats everything below 500 UMI as the ambient profile and excludes it.",
 cond:"The only stage on this row whose threshold is fitted rather than chosen, which is why it is the one to trust. It is also where an undocumented floor can hide: CellOracle's deposit has a minimum of exactly 500 UMI with zero cells below it, and no paper or GEO record mentions a 500-UMI rule anywhere.",
 /* ---- authored on this page, below the lifted fields ------------------
    name and sub say which single policy is on the roof; pipelineName keeps
    the broader name it has on /pipeline so the two can still be matched up.
    Everything above this comment is lifted byte-for-byte. ------------- */
 modelled:true, pipelineName:"Cell or background",
 added:"The knee is drawn as a rank curve with the cut standing VERTICALLY at the rank it lands on, because that is the right way round for this cull and for no other on the page: the knee is a statement about how many barcodes are cells, and the transcript number is what that statement costs. A horizontal floor would say the opposite — that a number was picked and the count fell out of it. The barcodes below the cut rain off the near eaves rather than fading, because they were never cells and the building is where the cells are."},

{id:"c3", key:"D4", group:"The cull", shape:"mitoroof", hatch:true, name:"Mito %", x:17.8, y:R3, lane:"r3", w:4.2, d:4.2, h:0.52,
 sub:"cells above median + 3 MAD of mitochondrial fraction, per sample", tier:"taste",
 does:"Removes cells dominated by mitochondrial transcripts — usually cells stressed or broken during dissociation.",
 built:"ZSCAPE cuts above 25%, Zebrahub above 15%, DanioCell above 10%, Parse Trailmaker at a per-sample absolute threshold of 0.50–1.51%, CellOracle not at all.",
 cond:"These numbers are not comparable, because the mitochondrial gene set is not the same object twice. Parse counts only the 13 protein-coding mitochondrial genes (~0.19% typical); measured over the full 37-feature MT contig the same cells sit near 8%, forty-three times higher. Reuse '1% mito' against a differently-defined set and you delete the dataset. Worse, the filter can silently do nothing: ZCL2's code matches with the pattern ^mt: — the Drosophila convention, inherited unchanged from a cross-species script — which matches zero zebrafish genes, so percent.mt is 0 for every cell and a cutoff at 20% excludes nothing. And the cut is never neutral across cell types: it sits directly downstream of a dissociation step that stresses tissues unequally.",
 /* ---- authored on this page, below the lifted fields ------------------
    name and sub say which single policy is on the roof; pipelineName keeps
    the broader name it has on /pipeline so the two can still be matched up.
    Everything above this comment is lifted byte-for-byte. ------------- */
 modelled:true, pipelineName:"Mitochondrial fraction",
 added:"The cut is median + 3 x MAD, and the arithmetic is in the record below because it is short enough to check by eye — which is the whole argument for preferring it to a round number somebody liked. The axis stops a little past the cut rather than at the far end of the dying tail: a handful of cells at 40% would squash the singlet distribution into two bins and hide the shape the cut is made against. They are off-scale, and the count in the record below is over all of them regardless. Cells above the cut rise straight up off the roof and fade, because they are leaking."},

{id:"c4", key:"D5", group:"The cull", shape:"complexityroof", hatch:true, name:"Complexity", x:19.0, y:R3, lane:"r3", w:4.2, d:4.2, h:0.52,
 sub:"both tails of the genes-vs-transcripts fit: under-amplified and over-amplified", tier:"taste",
 does:"Fits genes detected against total counts and removes points sitting too far off the fit — classically two cells sharing one barcode.",
 built:"Parse Trailmaker fits a spline per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate. ZSCAPE removes cells more than 4 SD from the mean UMI. DanioCell removes the top 0.5% by detected features.",
 cond:"Two problems. It runs before the doublet scorer and removes much of what the doublet scorer exists to find, so the two are partly redundant and their order decides which gets the credit — and the order genuinely differs between stacks. And DanioCell's version is untestable after the fact: the top 0.5% of an already-filtered distribution is 0.5% by construction, so the rule cannot be verified against the deposit.",
 /* ---- authored on this page, below the lifted fields ------------------
    name and sub say which single policy is on the roof; pipelineName keeps
    the broader name it has on /pipeline so the two can still be matched up.
    Everything above this comment is lifted byte-for-byte. ------------- */
 modelled:true, pipelineName:"Outliers off the trend",
 added:"Both tails go, for opposite reasons, and the two gestures are deliberately not each other's mirror: under-amplified cells peel off the surface and become spheres, over-amplified ones swell where they lie and burst. One leaves the roof and one never does, which is the difference between having too many genes for your transcripts and too few. Reading this filter as one-sided is the common mistake, so the drawing refuses to make the two look alike."},

{id:"c5", key:"D6", group:"The cull", shape:"doubletroof", hatch:true, name:"Doublets", x:21.0, y:R3, lane:"r3", w:4.2, d:4.2, h:0.52,
 sub:"scDblFinder, thresholded against the expected collision rate", tier:"taste",
 does:"Scores each barcode for looking like two cells and removes those above a threshold.",
 built:"Parse Trailmaker fits a probability threshold per sample, 0.469 to 0.903 across one plate. ZSCAPE inspects residual multiplet clusters manually and removes them. ZCL2 runs DoubletFinder at a fixed 5% expected rate. MIC-Drop-seq's Methods state scDblFinder. Our own droplet path uses Scrublet. CellOracle mentions no doublet detection anywhere.",
 cond:"The least consistent stage on the map and the least auditable. MIC-Drop-seq states scDblFinder in Methods and deposits no doublet column in any object, so the claim cannot be checked at all. A per-sample threshold that swings from 0.47 to 0.90 across one plate is not measuring a constant property. And the true collision rate was set two rows up by loading density, which none of these tools can see.",
 /* ---- authored on this page, below the lifted fields ------------------
    name and sub say which single policy is on the roof; pipelineName keeps
    the broader name it has on /pipeline so the two can still be matched up.
    Everything above this comment is lifted byte-for-byte. ------------- */
 modelled:true, pipelineName:"Doublets",
 added:"The roof is the expression embedding rather than a histogram, because between-ness is the entire signal and only an embedding has a between. The chords crossing it are the manufacture of the reference itself — pairs of real cells from different neighbourhoods, added together — which is the part nobody pictures. The expected collision rate in the record below is the one real figure on any of these four roofs. Three barcode rounds give 442,368 addressable paths, the fourth splits the run into 8 sublibraries, 94,616 cells were called, and Poisson over paths within a sublibrary says what share of recovered barcodes should hold two cells. Collisions can only happen WITHIN a sublibrary, because the fourth barcode tells two cells apart that took the same path in different ones — get that denominator wrong and the expected rate comes out eight times too high. The scorer's own rate is modelled and sits beside it; where the two disagree is the interesting part, so both are shown rather than one being picked. Only true doublets pull apart on the roof. Over-called singlets get a ring and fade where they sit, because drawing them coming apart would be the picture claiming something the method does not."},

{id:"Q", key:"D7", group:"The cull", shape:"tile", follow:{a:"c4"}, name:"Cull ledger", x:17.8, y:R3+4.2, w:1.2, d:1.2, h:0.3,
 sub:"one row per dropped barcode",
 does:"What the Sankey should be drawn from: which stage killed which barcode, and why.",
 built:"Node and link labels would use the plain-English phrasings on this row, never the internal step names.",
 cond:"It does not exist here, and it does not exist anywhere else in the corpus either, which is the more interesting fact. Vendors emit settings, not tallies. Authors publish thresholds, not ledgers. CellOracle reports a comparison at 57,175 cells against a deposit of 72,870 — roughly 21.5% removed by QC and ambient-cluster steps that are never numerically specified. Every retention figure on this row is therefore a ratio between two objects, never a sum over stages."},

{id:"FD", key:"5", group:"⑤ Filtered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Filtered matrix", x:22.0, y:R3, w:1.55, d:1.55, h:1.55, cells:6, fill:0.62,
 sub:"94,616 × 32,520 · median 3,198 UMI / 1,618 genes", stat:"the cells, as asserted",
 does:"The same gene space, a fraction of the barcodes, dense where the first cube was empty. Everything here has been asserted to be a cell.",
 built:"For the worked example: 94,616 cells × 32,520 genes, raw integer counts, no layers and no embedding. Median 3,198 transcripts and 1,618 genes per cell against a design target above 4,000.",
 cond:"The governing rule for this object is corpus principle 4 — a threshold printed in Methods is never assumed to have been applied to the deposited data. Tested against their own releases, four datasets here disagree with their own Methods: ChemFish shipped one screen without its hash filters, ZCL2 shipped a pre-QC atlas with a mitochondrial filter matching zero genes, CellOracle shipped an undocumented 500-UMI floor and no mitochondrial filter, and the worked example keeps cells below its own knee. DanioCell is the one that verifies exactly — and even there a later format conversion broke the guarantee."},

/* ---- the attrition staircase --------------------------------------------
   Ground scenery BEHIND the row: the four culls' arithmetic as a band with
   one straight datum and a staircased far edge, one riser per cull, each
   shedding a tributary that drifts clear.

   yBase sits just above the row in world terms — and on the ground plane
   decreasing y projects UP AND RIGHT, so the band lies behind the buildings
   and the tributaries leave away from them rather than across them.

   It owns no data: MODEL.ledger in bp-shapes.js computes the counts by
   applying the culls in order over one denominator. from/to and the station
   ids are resolved to real coordinates by the view once layoutRows() has
   run; the x below is a placeholder. scenery:true keeps it out of the
   occlusion silhouette, so the edges and dots above it are not punched
   through by a thing lying flat on the floor.
   ------------------------------------------------------------------------ */
{id:"RIVER", key:"A1", group:"Behind the row", shape:"attritionstaircase",
 scenery:true, modelled:true,
 name:"Attrition", x:14, y:R3-7.0, w:0.9, d:0.9, h:0, lab:{dy:-1.2},
 from:"UD", to:"FD", yBase:R3-2.6, width:4.6, z:0.002, opacity:0.8,
 sub:"every barcode that ever appeared, and what each of the four takes",
 does:"The four culls' arithmetic, drawn to scale on the ground behind the row. One straight edge gives the run a datum; the opposite edge staircases down, one riser per cull, and a tributary peels off each riser and drifts clear. Every step is then read against one unmoving line rather than against a shape changing on both sides at once, which is what an earlier symmetric version got wrong — neither of its edges held still, so the eye had nothing to measure against.",
 built:"Drawn flat in two dimensions and laid onto the ground plane by one transform, the same trick the roofs use. Counts come from applying the culls in order, each over what the one before left, because subtracting four independent percentages double-counts every barcode two of them agree about — and two of them do: a doublet carries two cells' worth of transcripts and rather less than two cells' worth of distinct genes, so complexity reaches it before the scorer does.",
 cond:"One denominator throughout — every barcode that ever appeared — so nothing on this band is a ratio between two different objects. THE KNEE IS THE FIRST RISER AND IT TAKES 96.7%, which makes the band a cliff followed by three hairlines. That is the finding rather than a drawing problem: on this dataset the knee is very nearly the whole cull and the three after it are a rounding. What keeps the small ones readable is that each station's own figure is a share of what REACHED it, so mito reads −5.8% whether its riser is forty pixels or one, and a thin tributary flares to a floor width so a small cull is still visibly a cull. Exactly one of the 468 barcodes past the knee is not a cell in the simulation, so the population the last three act on is the called cells in all but that one. And the counts are modelled — what these culls would take from the simulated population, not a record of what any of them took, because no per-barcode ledger exists here or anywhere else in the corpus."},
];

const ROWS=[R3], MIRROR=29.0;

/* One lane, and a long one. Nine objects had to share this span before the
   counting stack came off; six do now, so the gap engine gives every one of
   them room it did not have. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:31.6, dir:+1},
];

const EDGES = [
  {a:"UD",b:"c1",kind:"cell"},{a:"c1",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"c5",kind:"cell"},
  {a:"c5",b:"FD",kind:"cell"},
  /* every cull would write a row in the ledger, and none of them can */
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c3",b:"Q",kind:"drop",dash:true},
  {a:"c4",b:"Q",kind:"drop",dash:true},{a:"c5",b:"Q",kind:"drop",dash:true},
];

/* One band, keeping its name from the big map. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-1.4, x1:33.0, y0:R3-11.4, y1:R3+6.2},
];

/* Both ends fade, because neither is on this page: the barcodes arrive from a
   counting stack that is off the left of this map, and the cells leave for the
   labelling a row below on the big one. Drawing a hard terminus at either end
   would claim this stretch is self-contained, and it is a middle. */
const CARRIES = [
  {x0:1.95,y0:R3-8.0, x1:1.95,y1:R3-3.2, fade:"in", kind:"cell",
   from:"the counting stack, off this map", to:"Unfiltered matrix"},
  {x0:32.1,y0:R3, x1:36.6,y1:R3, fade:"out", kind:"cell",
   from:"Filtered matrix", to:"the labelling, a row below on /pipeline"},
];

/* ============================================================
   PAYLOADS
   Also lifted: the same records, moving along the same edges. One of them
   deliberately shows nothing, because nothing is what exists — no per-barcode
   drop record exists anywhere in the corpus.
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
  title:"Unfiltered → Filtered",
  sub:"two cubes, four culls, and every decision drawn on a roof",
  does:`<p>Everything that happens between the two matrices on row 3 of <a href="/pipeline">/pipeline</a> — the band called <mark>Bioinformatics pipeline</mark>. Every barcode that ever appeared against every gene goes in on the left; the cells, as asserted, come out on the right.</p>
<p>Four culls stand between them, and <mark>each one has its decision drawn on its roof</mark>:</p>
<p><mark>Knee</mark> — a hard transcript minimum at the steepest point of the barcode-rank curve, per sample. <mark>Mito %</mark> — cells above median + 3 MAD of mitochondrial fraction. <mark>Complexity</mark> — both tails of the genes-vs-transcripts fit, under-amplified and over-amplified. <mark>Doublets</mark> — scDblFinder, thresholded against the expected collision rate.</p>
<p>Nothing has been re-written. Every name, number and claim is lifted from that map as source text rather than re-typed, so the two cannot drift into two different accounts of the same stage. Three of the four are <em>named</em> differently here, and that is not drift either: on the big map a cull node has to cover every policy the corpus uses for its stage — "Cell or background" names three at once — while this page draws one policy per roof and says which. The reader carries the original name through.</p>
<p><mark>Hatching means the stage destroys data.</mark> All four carry it. Each is tiered — <mark>physics</mark> where the threshold is fitted from a real feature of the data, <mark>taste</mark> where it is chosen — and the tiers are not evenly split.</p>
<p><mark>Behind the row</mark> lies the attrition band: the four culls' arithmetic painted flat on the ground, one straight datum and a staircase descending against it, a tributary peeling off every riser. <mark>The knee is the first riser and it takes 96.7%</mark>, so the band is a cliff followed by three hairlines — which is the finding rather than a drawing problem. On this dataset the knee is very nearly the whole cull and the three after it are a rounding. Each station's own figure is a share of what <em>reached</em> it, so mito still reads −5.8% whether its riser is forty pixels or one.</p>
<p><mark>Below the line</mark> hangs the cull ledger, which would say which stage killed which barcode. It does not exist here, and it does not exist anywhere else in the corpus either, which is the more interesting fact — the band above is what a ledger would let you draw from records instead of from a simulation.</p>`,
  built:`<p>None of the four charts is rebuilt in three dimensions. Each is drawn in ordinary flat 2D and <mark>laid onto its roof by one matrix</mark> — which is why nothing occludes it, and why a circle painted in chart space comes out as the correct ellipse. That gives the page its grammar: <mark>painted things are ellipses, airborne things are circles</mark>. A barcode still under consideration lies on the surface; one that is leaving lifts off it.</p>
<p><mark>And each cull leaves differently.</mark> Barcodes below the knee rain off the near eaves — they were never cells. Dying cells rise straight up and fade — they are leaking. Under-amplified cells peel off the surface while over-amplified ones swell where they lie and burst — two failures, not one filter with a mirror. True doublets pull apart into their two halves — they were always two. Four identical fades would make the row read as one animation on a loop.</p>
<p>Every roof reads at the same angle as the rest of the map, which took two goes to get right. Chart x and chart y map to the two roof diagonals, so a chart's trend lands on their sum or their difference — on the horizontal, or on the vertical. A trend that comes out vertical is a cloud squeezed into a sliver. So the y axis on each roof is oriented so the trend is always a sum: the rank curve falls and takes the ordinary orientation, the genes-against-transcripts cloud rises and takes the inverted one. Their origins therefore sit in different corners, which is correct rather than sloppy — a roof has no up.</p>`,
  cond:`<p class="cond">Every threshold on these four roofs is <mark>modelled</mark>, computed at load from a seeded population, and each says so under its name on the map and in this column. None of the four has a shipping policy with a single drawable number behind it: the knee search exists in code but is not what ships, the mitochondrial and complexity cuts are not written anywhere, and doublet filtering is a docstring that raises. A roof showing a mitochondrial cutoff without saying it was invented would be claiming a result nobody has produced.</p>
<p class="cond">One figure is <mark>real</mark>, and it is on the doublet roof: the expected collision rate. Three barcode rounds give 442,368 addressable paths, the fourth splits the run into 8 sublibraries, 94,616 cells were called, and Poisson over paths within a sublibrary gives the share of recovered barcodes that should hold two cells. Collisions can only happen within a sublibrary — get that denominator wrong and the rate comes out eight times too high. The scorer's own rate sits beside it, and where the two disagree is the interesting part.</p>
<p class="cond">The four are not independent, and their order decides which gets the credit. Complexity removes much of what the doublet scorer exists to find — a doublet carries two cells' worth of transcripts and rather less than two cells' worth of distinct genes, so it lands in the low tail first. The order genuinely differs between stacks, and the ledger that would settle it is the empty box below the line.</p>`
};

