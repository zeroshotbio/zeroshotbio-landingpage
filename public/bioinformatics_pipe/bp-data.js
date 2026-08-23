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

   TWO THINGS ARE CHANGED, AND BOTH ARE GEOMETRY, NEVER PROSE
   The six culls are scaled up 1.7x, because on the big map they share a row
   with thirteen other objects and here they are the only thing on the canvas.
   And D5, "Outliers off the trend", is drawn as a ROOF: it says it fits genes
   detected against total counts and removes points too far off the fit, which
   is a two-dimensional argument, and there is finally room to show it. It is
   the same node — not a picture of it standing next to it — because putting
   the claim on the map twice would be two places to keep in agreement.

   ONE FIGURE ON THIS PAGE IS MODELLED AND THE REST ARE REAL
   D5's band. The real fit is a per-sample spline at a p-level spanning
   6.9e-6 to 1e-3 across a single plate, so there is no single band to draw.
   It says MODELLED on the panel beside it, under its name on the map, and in
   the reader. Keep it in all three.

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

{id:"c1", key:"D2", group:"The cull", shape:"tile", hatch:true, name:"Cell or background", x:15.4, y:R3, lane:"r3", w:1.19, d:1.19, h:1.33,
 sub:"knee, classifier, or expect-cells", tier:"physics",
 does:"Separates barcodes that held a cell from barcodes that held only ambient RNA. Not a judgment call in principle, and by volume much the largest cut.",
 built:"Every stack does this and none of them do it the same way. Parse Trailmaker runs a classifier at FDR 0.01; split-pipe fits a transcript cutoff per sublibrary (613.7–711.2 in the worked example, 670.4 combined); Cell Ranger uses its own cell-calling against --expect-cells (DanioCell set 6,000–21,250 per sample); Microwell-seq took the top 10,000 cells by transcript count, or 20,000 depending which artefact you read; ZCL2's code instead treats everything below 500 UMI as the ambient profile and excludes it.",
 cond:"The only stage on this row whose threshold is fitted rather than chosen, which is why it is the one to trust. It is also where an undocumented floor can hide: CellOracle's deposit has a minimum of exactly 500 UMI with zero cells below it, and no paper or GEO record mentions a 500-UMI rule anywhere."},

{id:"c2", key:"D3", group:"The cull", shape:"tile", hatch:true, name:"Depth floor", x:16.6, y:R3, lane:"r3", w:1.19, d:1.19, h:0.88,
 sub:"100 UMI to 2,000, depending who you ask", tier:"physics",
 does:"Removes barcodes carrying too few molecules or too few genes to support any statement about cell type.",
 built:"The corpus spread is nearly two orders of magnitude and every value is defensible in its own context: 100–250 UMI set per experiment (ZSCAPE); 80 stated and ~100 realised (ChemFish); more than 200 detected genes (DanioCell); a total-count window of 2,000–20,000 (Zebrahub); 500 transcripts and 200 genes as published (ZCL2); a per-sample fitted knee of 232–1,370 (MegaFin CP01).",
 cond:"Two failures worth carrying. ZCL2's released atlas does not obey its own published floor at all — minimum 63 UMI and 27 genes against a stated 500 and 200, so the deposit is pre-QC. And the worked example retains cells down to 294 transcripts, below split-pipe's own 670 knee estimate, while its cell count is exactly split-pipe's number_of_cells — which suggests the vendor's QC chain was applied to the analysis object and not to what was delivered."},

{id:"c3", key:"D4", group:"The cull", shape:"tile", hatch:true, name:"Mitochondrial fraction", x:17.8, y:R3, lane:"r3", w:1.19, d:1.19, h:0.85,
 sub:"25% · 15% · 10% · 1% · none", tier:"taste",
 does:"Removes cells dominated by mitochondrial transcripts — usually cells stressed or broken during dissociation.",
 built:"ZSCAPE cuts above 25%, Zebrahub above 15%, DanioCell above 10%, Parse Trailmaker at a per-sample absolute threshold of 0.50–1.51%, CellOracle not at all.",
 cond:"These numbers are not comparable, because the mitochondrial gene set is not the same object twice. Parse counts only the 13 protein-coding mitochondrial genes (~0.19% typical); measured over the full 37-feature MT contig the same cells sit near 8%, forty-three times higher. Reuse '1% mito' against a differently-defined set and you delete the dataset. Worse, the filter can silently do nothing: ZCL2's code matches with the pattern ^mt: — the Drosophila convention, inherited unchanged from a cross-species script — which matches zero zebrafish genes, so percent.mt is 0 for every cell and a cutoff at 20% excludes nothing. And the cut is never neutral across cell types: it sits directly downstream of a dissociation step that stresses tissues unequally."},

{id:"c4", key:"D5", group:"The cull", shape:"complexityroof", hatch:true, name:"Outliers off the trend", x:19.0, y:R3, lane:"r3", w:4.2, d:4.2, h:0.52,
 sub:"spline residual, or 4 SD, or the top 0.5%", tier:"taste",
 does:"Fits genes detected against total counts and removes points sitting too far off the fit — classically two cells sharing one barcode.",
 built:"Parse Trailmaker fits a spline per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate. ZSCAPE removes cells more than 4 SD from the mean UMI. DanioCell removes the top 0.5% by detected features.",
 cond:"Two problems. It runs before the doublet scorer and removes much of what the doublet scorer exists to find, so the two are partly redundant and their order decides which gets the credit — and the order genuinely differs between stacks. And DanioCell's version is untestable after the fact: the top 0.5% of an already-filtered distribution is 0.5% by construction, so the rule cannot be verified against the deposit.",
 /* ---- added on this page, below the lifted fields ---------------------
    modelled:true puts the word under this node's name on the map and a
    badge in the reader. The added field is rendered as its own section,
    headed so a reader sees it is this page speaking, not /pipeline. ---- */
 modelled:true,
 added:"On the big map this node is a 0.7-unit box and the fit is described in the text. Here it is drawn: the cloud, the least-squares cubic through it, and a band opened to a robust residual sigma, painted flat on the roof by a single transform so a circle in chart space comes out as the correct ellipse and nothing can occlude it. Painted cells are ellipses; cells that are leaving lift off the roof and become circles. Both tails go and the two gestures are deliberately not each other's mirror — under-amplified cells peel off the surface, over-amplified ones swell where they lie and burst — because reading this filter as one-sided is the common mistake. The band is MODELLED and it is the only modelled figure on this page: the real fit is a spline fitted per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate, so there is no single band that would be true of the run. What the roof shows is the shape of the decision, not its answer."},

{id:"hx", key:"G3", group:"The cull", shape:"tile", hatch:true, name:"Sample demultiplex", x:20.0, y:R3, lane:"r3", w:1.19, d:1.19, h:0.78,
 sub:"only if the sample was hashed", tier:"taste",
 does:"In multiplexed designs, assigns each cell to the embryo or sample it came from by its hash oligo, and discards cells that cannot be confidently assigned. An entire cull stage that exists or does not exist depending on a choice made two rows up.",
 built:"ZSCAPE uses sci-Plex hashing with an enrichment ratio above 3 for the timeseries rounds and above 5 for perturbations, cutoffs set manually from the ratio distribution. ChemFish uses the same chemistry at ratio ≥ 2.5 with total corrected hash UMI above 5. DanioCell uses MULTI-seq: a barcode is negative below 20 UMIs, a singlet needs SNR ≥ 5, and cells called doublets by either approach are removed. Combinatorial designs skip this entirely — the barcode already is the sample.",
 cond:"The clearest case in the corpus of a published threshold that was not applied. ChemFish's round-two screen was released without its stated hash filters: 65,736 cells (4.83%) fall below the 2.5 enrichment cutoff and 16,541 (1.22%) below the hash-UMI floor, while round one matches every published threshold exactly. Two rounds of one experiment, one filtered and one not, and nothing in the object says which is which."},

{id:"c5", key:"D6", group:"The cull", shape:"tile", hatch:true, name:"Doublets", x:21.0, y:R3, lane:"r3", w:1.19, d:1.19, h:0.75,
 sub:"five tools, and one no tool at all", tier:"taste",
 does:"Scores each barcode for looking like two cells and removes those above a threshold.",
 built:"Parse Trailmaker fits a probability threshold per sample, 0.469 to 0.903 across one plate. ZSCAPE inspects residual multiplet clusters manually and removes them. ZCL2 runs DoubletFinder at a fixed 5% expected rate. MIC-Drop-seq's Methods state scDblFinder. Our own droplet path uses Scrublet. CellOracle mentions no doublet detection anywhere.",
 cond:"The least consistent stage on the map and the least auditable. MIC-Drop-seq states scDblFinder in Methods and deposits no doublet column in any object, so the claim cannot be checked at all. A per-sample threshold that swings from 0.47 to 0.90 across one plate is not measuring a constant property. And the true collision rate was set two rows up by loading density, which none of these tools can see."},

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
];

const ROWS=[R3], MIRROR=29.0;

/* One lane, and a long one. Nine objects had to share this span before the
   counting stack came off; six do now, so the gap engine gives every one of
   them room it did not have. */
const LANES = [
  {id:"r3", y:R3, x0:0.7, x1:26.0, dir:+1},
];

const EDGES = [
  {a:"UD",b:"c1",kind:"cell"},{a:"c1",b:"c2",kind:"cell"},{a:"c2",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"hx",kind:"cell"},{a:"hx",b:"c5",kind:"cell"},
  {a:"c5",b:"FD",kind:"cell"},
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c4",b:"Q",kind:"drop",dash:true},
  {a:"hx",b:"Q",kind:"drop",dash:true},
];

/* One band, keeping its name from the big map. */
const BANDS = [
  {name:"Bioinformatics pipeline", x0:-1.4, x1:27.4, y0:R3-4.0, y1:R3+6.4},
];

/* Both ends fade, because neither is on this page: the barcodes arrive from a
   counting stack that is off the left of this map, and the cells leave for the
   labelling a row below on the big one. Drawing a hard terminus at either end
   would claim this stretch is self-contained, and it is a middle. */
const CARRIES = [
  {x0:1.95,y0:R3-8.0, x1:1.95,y1:R3-3.2, fade:"in", kind:"cell",
   from:"the counting stack, off this map", to:"Unfiltered matrix"},
  {x0:26.5,y0:R3, x1:31.0,y1:R3, fade:"out", kind:"cell",
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

const OVERVIEW = {
  eyebrow:"Zeroshot · from /pipeline, row 3",
  title:"Unfiltered → Filtered",
  sub:"two cubes, six culls, and the one that gets drawn",
  does:`<p>Everything that happens between the two matrices on row 3 of <a href="/pipeline">/pipeline</a> — the band called <mark>Bioinformatics pipeline</mark>. Left to right: every barcode that ever appeared against every gene, then six culls, then the cells as asserted.</p>
<p>Nothing has been re-written. Every name, number and claim is lifted from that map as source text rather than re-typed, so the two cannot drift into two different accounts of the same stage. What has changed is size: on the big map these culls share a row with thirteen other objects, so they are drawn small. Here they are the only thing on the canvas.</p>
<p><mark>Hatching means the stage destroys data.</mark> All six culls carry it. Each is tiered — <mark>physics</mark> where the threshold is fitted from a real feature of the data, <mark>taste</mark> where it is chosen — and the tiers are not evenly split: only the first two are physics.</p>
<p><mark>Below the line</mark> hangs the cull ledger, which would say which stage killed which barcode. It does not exist here, and it does not exist anywhere else in the corpus either, which is the more interesting fact. Every retention figure on this page is therefore a ratio between two objects rather than a sum over stages.</p>`,
  built:`<p><mark>D5 is drawn rather than described.</mark> "Outliers off the trend" fits genes detected against total counts and removes points sitting too far off the fit — a two-dimensional argument, and on the big map a 0.7-unit box with the argument in the text. Here it is the roof of the building: the cloud, the least-squares cubic through it, and a band opened to a robust residual sigma, <mark>painted flat</mark> and laid onto the roof by one matrix.</p>
<p>That is why nothing occludes it, and why a circle painted in chart space comes out as the correct ellipse. Which gives the roof its grammar: <mark>painted things are ellipses, airborne things are circles</mark>. A cell still under consideration lies on the surface; a cell that is leaving lifts off it.</p>
<p><mark>Both tails go, for opposite reasons</mark>, and the two gestures are deliberately not each other's mirror — under-amplified cells peel off the surface, over-amplified ones swell where they lie and burst. Reading this filter as one-sided is the common mistake.</p>
<p>The chart reads at the same angle as everything else on the map, which took two goes to get right: both of its axes grow away from the near corner rather than one of them flipping back toward the viewer, and that single choice is what keeps the cloud lying along the roof instead of squeezed into a vertical sliver.</p>`,
  cond:`<p class="cond">Every figure on this page is real and matches /pipeline exactly — <mark>with one exception</mark>. D5's band is modelled, computed at load from a seeded simulation, because the real fit is a spline fitted per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate and there is no single band that would be true of the run. It says so on the panel, under its name, and here.</p>
<p class="cond">The governing fact of this stretch is that a threshold printed in Methods is not evidence it was applied. Tested against their own releases, four datasets in the corpus disagree with their own published QC.</p>
<p class="cond">The culls are not independent, and their order decides which of them gets the credit. D5 removes much of what D6 exists to find — a doublet carries two cells' worth of transcripts and rather less than two cells' worth of distinct genes, so it lands in the low tail of D5's band first. The order genuinely differs between stacks, and the ledger that would settle it is the empty box below the line.</p>`
};
