/* ============================================================
   pipeline-data.js — what the map is ABOUT.
   Owned by the on-instance. Every fact, number, name and payload lives here.
   You can rewrite this file end to end without touching the renderer.

   WHAT THIS MAP IS
   The platonic end-to-end pipeline for a zebrafish single-cell atlas: aquarium
   to a labelled object. It is not one run. Where a stage varies by technology
   the node names the variants; where the corpus disagrees with itself the cond
   field says so. MiniFin is carried throughout as the worked example, because
   it is the one run whose every artefact is on this instance, and its numbers
   are the ones the payloads show.

   THE CORPUS BEHIND THE GENERAL CLAIMS
   /data/datasets/zebrafish/ holds nine dataset entries. Seven external atlases
   carry a full nine-section provenance record at <DATASET>/sources/README.md —
   ZSCAPE, ChemFish, DanioCell, Zebrahub, ZCL2, MIC-Drop-seq, CellOracle.
   MegaFin/MiniFin are internal and deliberately not at that standard; Farrell's
   count data was never acquired. Every record ends with the same seven
   cross-dataset provenance principles, which are the closest thing that exists
   to a written statement of this pipeline. Four of them drive this map:

     P2  published reference claims and deposited data can disagree
     P4  published QC is verified against released cells, never assumed
     P5  author-called, transferred, ontology-backed and inferred labels are
         distinguished and never silently blended
     P6  harmonisation must not erase dataset-specific biology

   THE INSTANCE ARTEFACTS BEHIND THE MiniFin NUMBERS
     design + protocol   /data/prism/PRISM/.claude/docs/megafin-dataset.md
     dataset front door  /data/datasets/raw_datasets/MiniFin/README.md
     kit manual          ~/parse-public-docs/assets/31841872776724-Evercode-WT-v3-
                         User-Manual-v1.5.pdf  (UMWT3300 — governs all of row 2)
     Parse run def       .../MiniFin/process/run_proc_def.json  (split-pipe v1.7.1)
     Parse QC report     .../MiniFin/all-sample/report/analysis_summary.csv
     the matrix          .../MiniFin/minifin_filtered.h5ad      (94,616 x 32,520)
     Trailmaker QC       /data/scratch/bench/megafin1_processing_settings.txt
     clustering          /data/daniotype_backups/minifin_phaseA_clustering/*.json
     labelling           /data/daniotype_backups/minifin_phaseA_labelling/*.json
     deliverable         /data/daniotype_backups/minifin_phaseB_deliverable/*.json
     corpus context      /data/daniotype_backups/minifin_to_megafin_handoff/HANDOFF.md
     ZFA menu            /data/scratch/zlabel/datasets/zscape_commit_gold/artifacts/zfa_menu.v1.json

   Where an artefact does not exist, the cond field says so rather than
   estimating. Three things are genuinely absent and are marked as absent: the
   raw FASTQs, the unfiltered barcode table, and any per-stage drop count.
   ============================================================ */

/* ============================================================
   FIVE ROWS, ALL READING LEFT TO RIGHT. Nothing is drawn between them:
   they are stacked in the order things happen, so one feeding the next is
   already said by where they sit.

     row 1  the fish and the compounds
     row 2  the chemistry
     row 3  READS TO A MATRIX      FASTQ  ->  unfiltered matrix
     row 4  THE CULL               the four culls  ->  filtered matrix
     row 5  the labelling

   ROWS 3 AND 4 WERE ONE ROW, and splitting them is the point of this
   arrangement. Together they were nineteen objects — a third of the map on a
   single line — and they are two different kinds of work: one turns reads
   into a table of every barcode against every gene, the other decides which
   of those barcodes was a cell. Each half already has its own page built from
   this data (/FASTQ_pipe and /bioinformatics_pipe) precisely because each is
   a subject on its own, and the big map now says the same thing.

   THE UNFILTERED MATRIX ENDS ROW 3 rather than beginning row 4. A node can
   only be in one place, and the row that produces it is the row it belongs
   to: row 3 is named for what it delivers. Row 4 begins with the first cull
   and reads as acting on the object sitting directly above its start, which
   is what the stacking is for.

   Row gaps are equalised by eye, not by grid units, because rows 3, 4 and 5
   carry side structures. x values below are seed order only — layoutRows()
   recomputes them.
   ============================================================ */
/* THE ROWS ARE SPACED BY WHAT STANDS ON THEM, NOT BY A CONSTANT PITCH.

   They used to sit 13.6 apart because every row was 7.6 deep and that left 6.0
   of clear air. Row 3 is now /FASTQ_pipe at that page's own size, 26.4 deep on
   its own, and ROW 4 INHERITS ITS LAST OBJECT: UDc is the unfiltered matrix
   drawn again at the head of the cull, and that object is now 16 units deep and
   9.6 wide rather than a 2.5 cube. A constant pitch cannot hold either of them.

   Each row is placed from the bottom edge of the one above plus EIGHT units of
   clear ground:

     row   band, relative to its line     absolute
     1     -3.8 .. +3.8                     -3.8 ..   3.8
     2     -7.5 .. +7.5                     11.8 ..  26.8
     3     -24.25 .. +13.3                  34.8 ..  72.35
     4     -8.4 .. +8.4                     80.35 .. 97.15
     5     -3.8 .. +3.8                     105.15 .. 112.75

   Row 3's band is /FASTQ_pipe's own, as resized in that page's editor
   (bandbox:0), slid with the row. It also sets how far row 3 sits from row 2:
   the whitelists stand 19.2 above row 3's line, and ROWS gives an object to
   whichever line is nearer, so the two lines must be more than 38.4 apart.

   Row 2 is deeper than the old tiles' 7.6 because /molecular_pipe's drawings
   are bigger than tiles, even shrunk; see the note at the head of OFFSETS.

   IF A ROW'S DEPTH CHANGES, EVERY ROW BELOW IT MOVES, and so does anything that
   CARRIES one of its objects. That is the price of spacing by content and it is
   the right price: the alternative is a constant pitch that silently stops
   fitting, which is exactly what happened here. */
const R1=0, R2=19.3, R3=59.05, R4=88.75, R5=108.95;

const NODES = [

/* ================= ROW 1 — THE FISH ================= */
{id:"AQ", key:"1", group:"① The aquarium", groupMark:true, anchor:true, shape:"tankrack",
 lane:"r1-bio",
 name:"The aquarium", x:1.3, y:R1, w:2.6, d:2.0, h:1.6,
 sub:"recirculating racks · in-house colony", stat:"adult zebrafish",
 does:"Every cell in every dataset downstream was in one of these tanks. The colony is the actual capital asset of the company — an atlas is a claim about zebrafish development, and it is only as good as the fish that made it.",
 built:"Recirculating system, standard husbandry. Line is disputed for the worked example: the MiniFin front door says TU wildtype (and argues GRCz11 is the right reference because GRCz11 was derived from TU); the MegaFin design spec says Tg(fli1:egfp) or Tg(kdrl:egfp) angiogenesis reporters.",
 cond:"Two problems, and the second is general. The line conflict above is unresolved and matters — a fli1:egfp reporter carries a transgene the reference does not, and Zebrahub shows what that costs: its counting reference has three Zebrabow transgene features bolted on, and the recipe for them was never published. And nothing about tank, clutch or parentage travels with a cell into the matrix, so a batch effect originating in husbandry is invisible from the data side."},
{id:"A1", key:"A1", group:"Breeding", shape:"breedingtank", name:"Pair set in the evening", x:4.3, y:R1, w:1.44, d:1.44, h:1.24,
 lane:"r1-bio",
 sub:"male and female, divider in",
 does:"A male and a female go into a breeding tank the night before with a divider between them. Spawning is triggered by pulling the divider at first light.",
 built:"Standard pairwise crossing.",
 cond:"No bench record on this instance. This is the generic protocol, not a transcript of what was done, and there is no artefact that would let anyone check it."},
{id:"A2", key:"A2", group:"Breeding", shape:"clutch", name:"The clutch", x:5.7, y:R1, w:1.5, d:1.5, h:0.33,
 lane:"r1-bio",
 sub:"one morning's eggs",
 does:"Fertilised eggs collected within the first hour. Everything downstream is one narrow developmental cohort, which is what makes staging by hours post fertilisation mean anything.",
 built:"Collected, rinsed, held in embryo medium.",
 cond:"No bench record. Clutch identity is not recorded per well and there is no clutch column anywhere in the object, so if two clutches were mixed that difference cannot be recovered later."},
{id:"A3", key:"A3", group:"Breeding", shape:"culldish", name:"Cull the unfertilised", x:7.1, y:R1, w:1.5, d:1.5, h:0.36,
 lane:"r1-bio",
 sub:"first quality gate",
 does:"Dead and unfertilised eggs are removed under a scope. The first cull on the whole map happens here, by hand, with a pipette.",
 built:"Visual screen.",
 cond:"No bench record and no count, so the denominator at the very start of the experiment is unknown. Every retention figure further down this map is conditional on a number nobody wrote down."},
{id:"CS", key:"P1", group:"The compounds", shape:"whiteboard", name:"Compound selection", x:1.0, y:R1, w:2.0, d:1.4, h:1.2, lab:{dy:1.61},
 lane:"r1-chem",
 sub:"4 picked from ~147,025",
 does:"Somebody decides what the experiment is about. Four compounds are chosen out of the SPARC library — 0.1% DMSO as the vehicle, sorafenib as the anti-angiogenic positive control, orlistat and dapagliflozin as the two unknowns — and written into a cherry-picking layout. Everything the finished atlas can possibly say about drug effect is bounded here, before any of it exists.",
 built:"A cherry-picking layout drawn against the SPARC BioCentre compound library, roughly 147,025 compounds. Four selected, twelve replicate wells each.",
 cond:"This is the only step on the whole map where a human decides what the question is, and it is the one step with no artefact behind it at all. Nothing in the pipeline records why these four — why sorafenib rather than another VEGFR inhibitor, why orlistat and dapagliflozin as the unknowns, what was considered and dropped. The choice is legible in the object as four values in one column, and the reasoning is nowhere. Every downstream claim about mechanism inherits it."},

{id:"LIBR", key:"P2", group:"The compounds", shape:"library", name:"The library", x:2.5, y:R1, w:2.2, d:1.5, h:1.5, lab:{dy:1.48},
 lane:"r1-chem",
 sub:"~147,025 compounds · SPARC BioCentre",
 does:"The shelf the four came off. A screening library of roughly 147,025 compounds, held at the SPARC BioCentre and shared across everyone who books time there. Four are pulled; the rest of the wall is the part of the experiment that was never run.",
 built:"External to this company and to this pipeline — nothing on this map produced it, and nothing on this map constrains what is in it. The four picked keep their colour from here all the way to the wells: vehicle, positive control, and the two unknowns.",
 cond:"Four out of 147,025 is a selection ratio of about one in 36,800, and the map has no artefact recording how that cut was made. That is the same gap the selection step carries, seen from the other side: what is on this wall bounds everything the finished atlas can say about mechanism, and the reasoning that narrowed it is written down nowhere. The molecules drawn here are schematic — deliberately not depictions of sorafenib, orlistat or dapagliflozin, because an approximate structure under a real compound name would be worse than an honest generic one."},

{id:"ECHO", key:"P3", group:"The compounds", shape:"echodispense", name:"Echo 650 dispense", x:8.5, y:R1, w:1.5, d:1.15, h:0.9, lab:{dx:-1.72,dy:0.83},
 lane:"r1-chem",
 sub:"SPARC BioCentre · acoustic, from the cherry-picking layout",
 /* This node carries a copy payload: a self-contained listing of the shape
    that draws it, plus the projection under it and the contract around it,
    for handing to somebody learning to draw in this style. The payload is
    the text/plain block with id copy-ECHO in index.html, and is
    GENERATED from the real source by sync-copy-payload.mjs — a hand-copied
    listing drifts from the code it claims to be the moment either is
    touched. See public/pipeline/HANDOFF.md. */
 copy:"copy-ECHO", copyLabel:"Copy the shape source",
 does:"Compound is fired into an empty 48-well plate without anything touching it. The destination plate is held inverted above the source and 2.5 nL droplets are launched upward into it, hundreds a second, held in place by surface tension until the plate is righted. Tipless and non-contact, so there is no carryover between wells and no tip waste. Because every well is addressed individually from a layout file, the cherry-picking sheet is not a pipetting plan — it is the treatment axis of the finished dataset, written down before a single fish exists.",
 built:"A Beckman Echo 650 at the SPARC BioCentre, SickKids, 686 Bay Street, Toronto. Four compounds into a 48-well destination: 0.1% DMSO vehicle, sorafenib as the anti-angiogenic positive control, orlistat and dapagliflozin as the two unknowns, twelve replicate wells each. The plate is dosed and then left; the embryos arrive later.",
 cond:"The cherry-picking sheet and the sample loading table disagree, and the disagreement starts here. This sheet is where treatment assignment first exists; the loading table is what the barcodes physically encode. Until the two are reconciled nothing downstream is trustworthy at treatment level, and neither sheet is on this instance, so it cannot be settled from here. Three more things about this step are unrecorded and are open questions for the bench: the actual transfer volume per well — 1 µM is in the design document and in no column of the object, and at 2.5 nL a droplet it is hundreds of droplets a well; whether the compound went in dry or into medium; and how long the plate then sat dosed before the embryos arrived. That last one is a real experimental variable — DMSO is hygroscopic and nanolitre volumes evaporate — and this map currently implies it was zero, because nothing records otherwise."},

{id:"A4", key:"A4", group:"The experiment", shape:"arrayplate", name:"Array into the dosed plate", x:13.4, y:R1, w:1.5, d:1.15, h:0.3,
 lane:"r1-tail",
 sub:"48 wells · 4 × 12 · 6 embryos each, at 24 hpf",
 does:"The experiment itself, and the only place in the pipeline where biology is manipulated. Four vertical bands of twelve replicate wells, compound already in every one of them, and now the fish. Embryos are checked for stage and distributed six to a well, into wells that already contain compound. The fish arrive into the dose — there is no separate dosing step afterwards, and 24 hpf is the moment of arrival rather than the moment of addition.",
 built:"48-well format, 4 conditions × 12 replicate wells, single dose of 1 µM — sorafenib at 1 µM being the lowest concentration that visibly does something in zebrafish (pericardial edema). Every well becomes a sample barcode in round one of the chemistry, so the entire treatment axis of the finished dataset is fixed here. Confirmed for the worked example, not assumed: 48 wells and 6 embryos per well are in the MegaFIN 100k column of the design spec, and split-pipe's own run definition independently agrees — round-one barcode set n141_R1_v3_8 is described as '96 barcodes, 48 wells; rows A-D, cols 1-12'. Note that those are two different plates holding the same 48 samples: the treatment vessel here is a physical 48-well plate, 8 by 6, while the Parse round-one plate a row down lays the same samples out 12 by 4.",
 cond:"The label defect on this plate is specific and checkable: obs['sample'] misspells the compound as Dapaglifozan while obs['perturbation'] spells it Dapagliflozin, and the dose is recorded nowhere in the object or the vendor report — 1 µM comes from the design document alone. 48 wells were loaded; 43 samples reach the object. The five missing wells are unexplained by any artefact here. Pooling embryos per well is a design choice with a cost — Zebrahub took the opposite one and optimised its dissociation specifically to avoid pooling, so every cell there traces to a named individual fish. Whether this arraying was done by hand or with a multichannel is not recorded either, and it bears on how tightly the six-per-well count actually held. Six embryos per well also means embryo identity is destroyed here, at the moment of arraying, and not later: the embryos never leave this well again. The design spec's speculative obs schema lists an embryo column as a batch covariate; that column does not exist in the delivered object and never could have. ZSCAPE and ChemFish keep per-embryo identity by hashing the nuclei instead, which is why they can model per-embryo variance and this design cannot."},
{id:"A5", key:"A5", group:"The experiment", shape:"incubate", name:"Incubate to 48 hpf", x:14.7, y:R1, w:2.0, d:1.5, h:0.14, gap:1.25, band:1,
 lane:"r1-tail",
 sub:"24 hours of exposure · one dosed well",
 does:"Twenty-four hours in which the drug either does something or does not. This window is the entire causal content of the dataset. Drawn as one well of the sorafenib band: six larvae swimming in dosed medium, compound drifting around them on its own.",
 built:"Fixed 24→48 hpf window, single collection timepoint — stated in the design spec and used as the confirmed stage by every downstream asset. The compound is drawn loose in the medium and never attached to an animal, because whether any of it got in was never measured; the arraying step withholds the same claim by leaving its embryos untinted.",
 cond:"No imaging or phenotype scoring in this window, so a transcriptomic result cannot be checked against what the embryo visibly did. Incubation temperature is not recorded in any artefact here."},
{id:"A6", key:"A6", group:"Collection", shape:"dissociate", name:"Dissociate", x:17.3, y:R1, w:2.0, d:1.5, h:0.14, gap:0.5,
 lane:"r1-tail",
 sub:"enzymatic digestion — whole cells or nuclei",
 does:"Embryos are euthanised in the well and the tissue is digested enzymatically into a suspension, then strained. They never leave the well they were arrayed into — there is no collection or pooling event, because the pooling already happened at arraying. The choice made here — intact cells or isolated nuclei — propagates through the entire rest of the map.",
 built:"Drawn as the same well as the incubation step one place back — same six larvae, same seed, same poses — with the compound gone and the bodies coming apart. No protocol detail on this instance for the worked example; reagent, digest time and strainer size are recorded nowhere. Across the corpus the split is clean: sci-RNA-seq3 runs on PFA-fixed nuclei (ZSCAPE, ChemFish), while 10x, Microwell-seq and Parse all run on whole cells (Zebrahub, CellOracle, MIC-Drop-seq, ZCL2, MiniFin, MegaFin).",
 cond:"The most biased step in the wet lab and the least documented one. Cell types survive dissociation unequally, so atlas composition is partly a report on how tough each tissue is — and the mitochondrial cull two rows down then deletes the ones most stressed by it. The nuclei-or-cells fork is not a detail: nuclear transcripts are intron-rich, so it changes what the intron-handling stage on row 3 does, and it changes what a mitochondrial fraction even means."},

{id:"A7", key:"A7", group:"Collection", shape:"fixation", name:"Fix the suspension", x:18.5, y:R1, w:2.0, d:1.5, h:0.14, gap:0.5,
 lane:"r1-tail",
 sub:"formaldehyde · the moment the cells stop",
 does:"The last instant anything on this map is alive. Fixative goes into the suspension and transcription stops dead, so whatever each cell happened to be expressing when the drop landed is what the atlas will report it was expressing forever after. In combinatorial chemistries it does a second job at the same time: it turns every cell into its own sealed reaction vessel, which is the whole reason split-pool barcoding can work with no microfluidics at all.",
 built:"Evercode WT fixation, a proprietary formaldehyde-based solution, for the worked example. Drawn as the same well as the step before it — same suspension, same seed — at the instant the jitter stops. Across the corpus the reagent differs but the moment does not: sci-RNA-seq3 fixes nuclei in PFA, Parse fixes whole cells, and 10x skips this step entirely and runs the suspension live, which is why a 10x sample cannot wait.",
 cond:"Fixation efficiency is not measured per sample anywhere in the corpus. A poorly fixed well contributes ambient RNA rather than cells, and because no per-stage drop count survives from any QC chain, that surfaces only as an unexplained low yield with no way to attribute it. How long the suspension sat between dissociation and this drop is also unrecorded, and it is exactly the interval in which a stressed cell rewrites its own transcriptome."},

{id:"FX", key:"2", group:"② Fixed material", groupMark:true, anchor:true, shape:"vials",
 lane:"r1-tail",
 name:"Fixed material", x:19.4, y:R1, w:2.52, d:1.82, h:0.665, gap:1.98,
 sub:"fixed, plated and cold · four assay families downstream", stat:"the biology has stopped",
 does:"Fixed material, plated and put away. Nothing in this freezer is alive and nothing in it changes, which is precisely what makes it useful: samples collected weeks apart can wait here and then be barcoded together in a single run, so the day a sample was collected stops being a batch effect. Everything upstream of this point is a living thing changing while you watch it; everything downstream is a measurement of something that has already stopped.",
 built:"Evercode WT fixation, a proprietary formaldehyde-based solution, for the worked example. Four assay families take it from here across the corpus: combinatorial split-pool on fixed cells (Parse), sci-RNA-seq3 on PFA-fixed nuclei with sci-Plex hashing, droplet 10x Chromium on whole cells, and Microwell-seq with three rounds of split-pool bead synthesis.",
 cond:"How long any given plate actually waited here is not recorded anywhere, and fixed material does not keep indefinitely — the vendor quotes months, not years, and permeabilised cells leak. For the worked example collection and library prep are close enough together that it does not matter; for a dataset assembled from several collections it is a real variable that nothing on this instance pins down. Storage temperature is likewise unrecorded."},

/* ================= ROW 2 — THE CHEMISTRY =================
   Structured on the three sections of the kit manual that governs this run:
   Evercode WT v3 User Manual v1.5 (UMWT3300), section 1 in situ barcoding,
   section 2 cDNA capture and amplification, section 3 sequencing library prep.
   Every built field below cites the section it comes from. The manual is on
   this instance at ~/parse-public-docs/assets/31841872776724-*.pdf. */
/* THE ROW IS /molecular_pipe's, AS HARSHA LEFT IT ON 2026-09-12.

   Every record below is lifted from public/molecular_pipe/mol-data.js as
   source text, comments and all, so the two files stay diffable. The comments
   speak from that page: "this page" means /molecular_pipe, and "the note above
   LANES" is the note above mol-data.js's LANES. Read them there.

   WHAT WAS PORTED IS THE LIVE PAGE, NOT THE FILE. Most of the work lived in
   that page's shared edit record (molecular_map::edits), not in mol-data.js:
     - eight stations were deleted there, and are simply absent here — B8′,
       B8′a, B9, S (the Illumina sequencer), C4, C5, C6 and C7. Sa, the read
       cycle, is the sequencer on this row now.
     - every station was moved and several resized there. On this map the
       row was then shrunk, straightened and re-spaced, on request — see the
       note at the head of OFFSETS. /molecular_pipe keeps his layout as he
       left it, and its shared record is the unshrunk one.
     - his wording — name, sub and the story — is the record's own text now, in
       this file and in mol-data.js both. built and cond are untouched.
   ONE FIELD IS THIS MAP'S OWN: Sa's cloud:false. On /molecular_pipe the read
   cycle streams its reads out of a door into a turning cloud; here the machine
   stands alone and its reads run down a track into FQc — row 3's FASTQ pool,
   drawn again as the end of this row (see CARRIED). The shape reads the field
   and that page does not set it.
   Snapshots of both shared records at the time of the port:
   /data/backups/pipeline_port_2026-09-15/. */
/* shape is this page's own, not the lifted record's, and it has now been both
   things. It drew a plate coming out of a freezer under a slab of ice; that
   went, because what section 1.1 describes doing is a vial in a 37 C water
   bath; and the freezer was then asked for again from this map's own Edit
   visual button, in detail. So it is back, and the ice is not: `thawplate`
   opens the -80, slides one plate out and lets the frost FADE off it — no
   melt, no drips — because the does line's own first clause is "fixed material
   comes back out of the freezer" and that is the half of the step this drawing
   is for. cols/rows are stated for the same reason B3 and B5 state theirs: 96
   wells is the plate's fact, not the drawing's default. `thaw:true` is gone
   with the old shape — it was read by the `vials` shape on the big map and
   never did anything here. */
{id:"THW", key:"B1", group:"In situ barcoding", groupMark:true, anchor:true,
 shape:"thawplate", lane:"r2", cols:12, rows:8,
 name:"Thaw", x:0.7, y:R2, w:2.52, d:1.82, h:0.665,
 sub:"37°C thaw · count · loading table", stat:"the biology restarts",
 does:"This step prepares the preserved cells for barcoding while keeping the molecular snapshot captured during fixation intact.\nFixed cells or nuclei are thawed just until the last ice crystals disappear, then gently mixed, counted and diluted according to the loading table. Because the cells were fixed and permeabilized beforehand, each one can act as its own tiny reaction compartment: reagents can enter while the cell’s RNA remains compartmentalized inside. That simple idea is what allows the next chemistry to happen in ordinary wells — without needing a separate microfluidic droplet for every cell.",
 built:"Section 1.1. Thaw in a 37C water bath, mix, count on a haemocytometer, record the count into the Evercode WT Sample Loading Table v2, dilute with Sample Dilution Buffer, then proceed immediately to round one — the manual gives no stopping point here. The Round 1 Plate thaws alongside, 10 minutes at 25C. The loading table is filled in beforehand and tells you which sample goes in which well; the counts are what get written into it now.",
 cond:"The loading table — not any dispensing sheet — is what the barcodes physically encode, so it is the authority on which drug a cell saw. The run definition carries 44 sample entries against 48 loaded wells and 43 distinct samples reach the matrix; the 48 to 44 to 43 attrition is undocumented at every step. No cell count from this step survives on this instance, so the loading density that sets the collision rate six boxes downstream cannot be recovered."},

/* cols/rows describe THE PLASTIC, not the loading. The round-one plate is a
   green semi-skirted 96-well plate and the drawing is of that plate; what the
   WT protocol fills is 48 of its wells, which is the `sub` line's business and
   stays there. They were 12 x 4 while the shape drew the loading instead, and
   a drawing of a 48-well plate is a drawing of a plate that does not exist.

   IT IS THE BIGGEST TILE ON THE ROW AFTER THE THAW AND THE SEQUENCER, and what
   it is buying room for is the THREE LENSES, not the plate. Every length in
   this shape is cut from w, the lenses included, so w is what sets how big a
   cell you get to look at; the plate was pulled back to well under a tile width
   once it was clear the reader was being shown the plastic when the subject is
   the chemistry. Leave w where it is and the lenses stay legible. The 0.45 the
   tile gained was added to the lane's x1 as well, which is how this file has
   always paid for width: k stays where it is and the fourteen gaps that were
   already priced stay where they are. */
{id:"R1p", key:"B2", group:"In situ barcoding", shape:"reversetranscription", name:"Round 1 — reverse transcription", x:2.6, y:R2, lane:"r2", w:1.45, d:1.16, h:0.42, cols:12, rows:8,
 sub:"reverse transcription · Barcode 1 · sample identity",
 does:"This is where each cell’s RNA is copied into DNA and given its first molecular address.\nFixed, permeabilized cells are distributed across wells, each containing a different barcoded primer. Inside each cell, RNA is reverse transcribed into cDNA while Barcode 1 is attached. Because each well can correspond to a known sample or experimental condition, that first barcode also records where the cell came from — for example, which drug or treatment it experienced. From this point forward, the biology and its sample identity travel together on the same molecule.",
 built:"Section 1.2. In situ reverse transcription on a 48-well round-one layout (rows A to D, columns 1 to 12), barcode set n141_R1_v3_8. Two barcodes per well, 96 in total: the manual says each well is primed both with oligo dT and with random hexamers, and the run definition records only the counts. 14 microlitres of diluted sample per well, a fresh tip for every well. sample_bc_rounds = 1: round one and only round one carries sample identity.",
 cond:"Clean, and structurally the strongest link on the map — sample identity is written in a chemical step rather than carried in a spreadsheet, so there is no demultiplex cull downstream. The hashed designs in the corpus pay for that convenience with a whole extra QC stage."},

/* the grid is stated here rather than left to the shape's default for the same
   reason B5 states its own: it is the round's fact, not the drawing's, and the
   plate a reader is being shown is the 96-well plastic the split is dealt into. */
{id:"B1", key:"B3", group:"In situ barcoding", shape:"poolsplit", name:"Pool and split", x:4.2, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3, cols:12, rows:8,
 sub:"shuffle the deck",
 does:"All of the cells are mixed together, then redistributed so the next barcode is combined independently with the first.\nAfter Round 1, the cells from every well are pooled into a single mixture, erasing their physical positions on the first plate. They are then redistributed across a new plate. The cells no longer need to stay in their original wells because Barcode 1 is already carrying that history with them. This is the core trick of split-pool barcoding: the cells keep changing location, while the growing barcode remembers the path each one has taken.",
 built:"Section 1.2, closing steps — pool, centrifuge, resuspend, load the round two plate.", cond:"Clean."},

{id:"R2p", key:"B4", group:"In situ barcoding", shape:"ligation", name:"Round 2 — ligation", x:5.8, y:R2, lane:"r2", w:1.45, d:1.16, h:0.42, cols:12, rows:8,
 sub:"96 wells · Barcode 2 · 9,216 combinations",
 does:"A second barcode is added to each cell, expanding its molecular address from 96 possibilities to 9,216.\nThe shuffled cells are distributed across a new 96-well plate, where a second well-specific barcode is ligated onto the first — still inside the permeabilized cell. Because the cells were mixed between rounds, Barcode 1 and Barcode 2 are independently combined: 96 × 96 creates 9,216 possible barcode pairs. Each cell now carries one of those combinations, giving it a much more specific molecular identity before the cells are pooled and shuffled again.",
 built:"Section 1.3. Ligation in a 96-well plate (rows A to H, columns 1 to 12), barcode set v1, 96 barcodes across 96 wells — one per well, unlike round one.",
 cond:"Clean."},

/* cols/rows are the round's own fact, not the drawing's: this pool and split
   sits between two 96-well ligations, and both split shapes are told their grid
   outright rather than falling back on a default nobody can see.
   w and d are B3's as the shared record draws it — 0.6 x 0.6 plus its own
   0.9 x 0.7 resize — because the two are one procedure repeated and were asked
   to read at one size. The 0.9 is paid out of this station's own two gaps,
   not the lane's end; see the note above LANES. */
{id:"B2", key:"B5", group:"In situ barcoding", shape:"poolsplit96", name:"Split and pool, round 2", x:7.4, y:R2, lane:"r2", w:1.5, d:1.3, h:0.3, cols:12, rows:8, gap:0.05443,
 sub:"shuffle again",
 does:"The cells are mixed and redistributed again, setting up a new independent combination for Barcode 3.\nAfter Round 2, all of the cells are pooled back together, erasing their positions on the second plate while preserving Barcodes 1 and 2 on the cDNA inside each cell. The mixed population is then redistributed across the next plate. The location changes again, but the molecular history stays with the cell — setting up a third independent barcode combination.",
 built:"Section 1.4, opening steps.", cond:"Clean."},

/* shape is this page's own, not the lifted record's: /pipeline draws all three
   rounds as one plate glyph, and here each round gets its own drawing on the
   shared composition — a plate with a lens tethered to one well. B6 is B4 one
   round later, so it carries two barcodes already on the strand and a third
   landing, plus the 48 x 96 x 96 the built text below asserts, which is the
   one thing on this row no single plate can show. The prose stays lifted
   verbatim.
   w, d and h are B4's, because the two ligations were asked to read at one
   scale. The PLATE is not B4's: it was asked to match B5's receiving plate,
   which it is, so the shape cuts it from w at B5's size rather than B4's.
   The 0.45 is paid out of the gap behind it, not the lane's end; see the note
   above LANES. */
{id:"R3p", key:"B6", group:"In situ barcoding", shape:"ligation3", name:"Round 3 — ligation", x:9.0, y:R2, lane:"r2", w:1.45, d:1.16, h:0.42, cols:12, rows:8, gap:0.05443,
 sub:"96 wells · Barcode 3 · TruSeq R2 + biotin",
 does:"A third barcode completes the three-part combinatorial address used to distinguish individual cells.\nThe shuffled cells are distributed across a third 96-well plate, where Barcode 3 is ligated onto the cDNA. This round also adds the Illumina Read 2 sequence and a biotin tag — a molecular handle that will later let us selectively capture the barcoded cDNA after the cells are lysed. Across three rounds, 96 × 96 × 96 creates 884,736 possible barcode paths. Repeatedly shuffling the cells turns three ordinary 96-well plates into an enormous molecular address space — without having to isolate every cell in its own droplet.",
 built:"Section 1.4. Ligation in a third 96-well plate, barcode set R3_v3. The biotin is why the next section works at all: it is the handle streptavidin beads will grab once the cells are gone. The three rounds give 48 x 96 x 96 = 442,368 addressable paths for roughly 95,000 cells. Microwell-seq builds its barcode the same way — three rounds of split-pool synthesis, 3 x 6 nt in an 18 nt barcode.",
 cond:"Two cells can still collide on the same path. That residual collision rate is the real doublet source, it is set by loading density rather than by this step, and it differs per sublibrary — which is exactly why a single global doublet threshold two rows down cannot be right for all eight."},

{id:"SB", key:"B7", group:"In situ barcoding", shape:"countsplitlyse", name:"Pool and lyse", x:10.8, y:R2, lane:"r2", w:0.85, d:0.85, h:0.55, gap:0.05443,
 sub:"16 sublibraries · 12,500 cell ceiling",
 does:"The fully barcoded cells are divided into sublibraries, then broken open to release their encoded cDNA.\nAfter Round 3, all of the cells are pooled, washed and counted again. The mixed population — now containing cells from every sample and treatment — is divided across 16 sublibraries of up to 12,500 cells each for this experiment. Only then are the cells lysed. Until this point, the barcode chemistry has happened inside fixed, permeabilized cells acting as individual reaction compartments. Once the cells are broken open, those physical compartments disappear — but the three-part barcode written onto the cDNA preserves where every molecule came from.",
 built:"Section 1.5. Wash, resuspend in Pre-Lysis Dilution Buffer, count on a haemocytometer, then split by volume using the Sublibrary Generation Table in Appendix A. Lysis is 15 minutes at 65C; lysates keep at -80C for up to six months. Eight sublibraries here (Sublib1 to Sublib8, library IDs LV6001530579 to LV6001530706, submission SO11332); sublibrary membership becomes a first-class obs field and survives to the matrix.",
 cond:"The manual sets a hard ceiling: do not add more than 12,500 cells to a sublibrary, because more raises the multiplet rate. The worked example recovered 11,152 to 12,656 cells per sublibrary, and recovery is downstream of loading, so at least one sublibrary was loaded at or above the vendor ceiling. The eight are otherwise unusually even. Where they do differ is depth: sequencing saturation runs 0.366 to 0.486 across them, and the per-sample thresholds downstream do not know that."},

{id:"CAP", key:"B8", group:"cDNA capture and amplification", shape:"capture", name:"cDNA CAPTURE", x:12.6, y:R2, lane:"r2", w:0.72, d:0.72, h:0.44,
 sub:"streptavidin beads",
 does:"This step selectively pulls the barcoded cDNA out of the lysate using the biotin tag added in Round 3.\nAfter lysis, the barcoded cDNA is mixed with streptavidin-coated magnetic beads. Streptavidin binds very strongly to biotin, so the biotin-tagged cDNA sticks to the beads while cellular debris and unbound material can be washed away. A magnet then holds the cDNA-loaded beads in place during those washes. What remains is a purified pool of barcoded cDNA, with each molecule still carrying the molecular address that links it back to its cell of origin.",
 built:"Sections 2.1 to 2.4. Streptavidin magnetic beads capture the biotinylated cDNA and the cell debris is washed away; a template switch reaction adds an adapter to the 3-prime end; amplification runs off the template-switch primer and a TruSeq Read 2 primer. Cycle count comes from a table keyed on cells per sublibrary and RNA content — at the 6,000 to 12,500 cell band, 6 cycles for high-RNA material, 8 for low, 7 for nuclei. No run-specific record of which was used exists on this instance.",
 cond:"Amplification is where transcript-length and GC bias enter, and it is unmeasured. Nothing was archived from this step. The one structural comfort is that capture is affinity-based rather than size-based, so the bias it introduces is at least the same bias for every sublibrary."},

/* NOT LIFTED, AND ASKED FOR FROM THE PAGE — the third of its kind here, after
   the pyramid and the regrouping, and the first that is not at the end of the
   row. What the "Add a module" request described was a picture: a thermal
   cycler with its lid down and one lamp lit, a connector in from B8's magnetic
   rack, and tethered over it a magnification in which one barcoded strand
   becomes two and then four, each generation behind the last. It also said what
   the picture must not be taken for — bulk PCR on free DNA in a tube rather
   than a reaction inside a cell — and that distinction is the one claim below
   this record can make, because the row either side of it already carries it.

   IT NAMED NO PROTOCOL. No section, no cycle count, no polymerase, no volume
   and no instrument model, so `built` names none either and points at the
   request, the way C6's and C7's do. Inventing a manual section for it would be
   inventing the manual, which is the one thing this file exists to make
   impossible. In UNVERIFIED for that reason, and the badge says so.

   THE KEY IS A SUFFIX. It lands between B8 and B9 and thirteen of this row's
   keys are lifted from pipeline-data.js with the prose that cross-references
   them, so B9 onwards keep their numbers.

   ASKED FOR AGAIN, from "Edit visual", and the second request changed what is
   in the glass without touching what the record claims: draw the strand the
   way B8 draws it, start with two or three, show the polymerase binding and
   copying, and end on a cloud rather than on a count. So the count has come
   out of `sub` and `cond` — a cloud is the honest figure for a reaction whose
   product is billions, and a number on the glass was always the part of this
   drawing that said more than the request did. It still names no protocol.

   ASKED FOR A THIRD AND A FOURTH TIME, and the fourth took the machine away:
   "the image can just be black circle showing the pcr amplification". The
   thermal cycler the first request described is no longer drawn, so the two
   sentences here that leaned on it — the closed block in `does`, the object in
   `built` — say instead what is drawn and what was asked for. Nothing else
   moves: the record never claimed a cycle count, a polymerase or an
   instrument, and it still does not. */
{id:"AMP", key:"B8a", group:"cDNA capture and amplification", shape:"pcramplify", name:"PCR amplification", x:13.35, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"template-switched cDNA · repeated copying · more material",
 does:"PCR makes many copies of the barcoded cDNA so there is enough material for sequencing-library preparation.\nPrimers bind to adapter sequences on the captured cDNA, and repeated PCR cycles copy each molecule many times. The transcript sequence and its three-cell barcode are copied together, so amplification increases the amount of DNA without losing the molecular address that links each transcript back to its cell. A relatively small pool of encoded cDNA becomes a much larger pool of the same encoded information, ready for quality control and library preparation.",
 built:"Nothing to cite. The request that asked for this station described an object and a motion — a thermal cycler with the lid down and one indicator lit, a connector in from the magnetic rack, and a magnified strand doubling twice — and named no manual section, no cycle count, no polymerase, no volume and no instrument, so this record names none either. A second request from the page later replaced what is under the glass with three strands, an enzyme on each and a cloud, and a fourth removed the cycler altogether, leaving the glass as the whole station; neither named a protocol either, and the object that is gone was never evidence of one. The amplification this row does carry is B8's, off sections 2.1 to 2.4, and the cycle table that governs it is on that record.",
 cond:"Asked for from the page rather than read off an artefact, so what it carries is a figure and not a measurement. Three strands start the picture and a cloud ends it, and neither number is a number: an amplification is billions of molecules, so the three are there to be followed and the cloud is there to say more than can be drawn. The gold drop at each tip is B8's biotin, drawn on every strand because this glass and the one next door draw the same molecule the same way — it marks the molecule, not a claim about which end-tags survive into a copy. What the request does not settle is whether this is a step of its own or a second view of the word amplify already in B8's name — B8's built line is where the amplification is described, this record makes no protocol claim, and nothing downstream depends on which it is."},

/* NOT LIFTED, AND ASKED FOR FROM THE PAGE — a readout, which none of the
   others asked for this way were. What the "Add a module" request described
   was a picture: a strip of PCR tubes, a flat cassette with a row of narrow
   lanes and two electrode pins over one of them; a drop into one well, the
   fragments running, small ones faster, and then a trace of intensity against
   size drawing itself over the cassette. It also said what the step is not —
   the DNA is not changed here, only measured — and that is what `sub` carries.

   IT NAMED NO PROTOCOL. No section, no instrument, no kit, no ladder and no
   size range, so `built` names none and points at the request, the way B8′'s
   and B8a's do. `cond` says the obvious thing out loud: B9 one station back
   already cites a fragment-size measurement of this same cDNA. In UNVERIFIED,
   and the badge says so.

   THE KEY IS A SUFFIX ON THE STATION IT FOLLOWS. It lands between B9 and C1,
   so it is B9a, and nothing downstream is renumbered. It takes C3's .95 tile
   rather than its neighbours' .72, because a strip, a cassette and a graph
   over it do not share the smaller one; the room was paid for at the end of
   the lane — see the note above LANES. */
{id:"SZD", key:"B9a", group:"cDNA capture and amplification", shape:"sizerun", name:"Measure the size distribution", x:14.85, y:R2, lane:"r2", w:0.95, d:0.95, h:0.4,
 sub:"TapeStation · capillary electrophoresis · quality control",
 does:"This is a quality-control checkpoint: we measure how much amplified cDNA we made and whether its fragment sizes look as expected before building the sequencing library.\nA small aliquot of each amplified cDNA sample is run on a TapeStation. The DNA fragments are separated by size using electrophoresis — smaller fragments move faster than larger ones — and the instrument converts that separation into a trace showing DNA intensity across fragment sizes. The shape of that trace lets us see whether amplification produced the broad cDNA distribution we expect and whether anything looks abnormal before moving forward. Nothing new is built here; we are checking the molecular material we already made before committing it to library preparation.",
 built:"Nothing to cite. The request that asked for this station described a picture — a strip of PCR tubes, a flat cassette with a row of narrow lanes, two electrode pins over one lane, and a trace with two or three narrow peaks drawn over it — and named no manual section, no instrument, no kit, no ladder and no size range, so this record names none either.",
 cond:"Asked for from the page rather than read off an artefact, so what it carries is a figure and not a measurement: the peaks are drawn, not read, and the axes carry no units because the request gave none. What it does not settle is how it stands against B9 one station back, whose built line already cites section 2.5 for a fragment-size measurement of this same cDNA. This may be a second view of that measurement rather than a step of its own; the record makes no protocol claim, and nothing downstream depends on which it is."},

/* THE DRAWING HAS BEEN REDRAWN FROM "EDIT VISUAL" MORE THAN ONCE AND THE
   RECORD HAS NOT MOVED, which is the rule for a lifted station: /pipeline owns
   this prose. One request stopped the glass at blunt, A-tailed ends, with
   no adapter drawn — the ligation is left to the next station's picture —
   and a later one took the cycler off and set the glass on the tile; the
   next rounded the glass into B8a's ring; the latest opens on B8a's full glass,
   focuses on one strand drawn as cDNA and barcode blocks, and follows the
   barcoded piece through the cut and repair to its A. The record still names it because the
   protocol does; nothing below ever leaned on the drawing, and none of the
   three sentences names an instrument. */
{id:"FRG", key:"C1", group:"Sequencing library prep", shape:"fragmentligate", name:"Fragment, end-prep, ligate adapters", x:15.6, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"fragment · repair · select · TruSeq R1",
 does:"This step reshapes the amplified cDNA into standardized fragments ready for the final indexing PCR.\nFirst, the amplified cDNA is cut into shorter fragments. The newly created DNA ends are then repaired and A-tailed, preparing them to accept a sequencing adapter. A double-sided SPRI size selection removes fragments that are too large or too small, keeping the desired size range. Finally, an Illumina TruSeq Read 1 adapter is ligated onto the newly prepared end. The barcode-bearing side is preserved throughout, while the transcript becomes a sequencing-sized insert with the architecture needed for the final indexing step.",
 built:"Sections 3.1 to 3.4. Fragmentation, end repair and A-tailing happen in a single reaction; a double-sided SPRI cleanup selects the size window; the TruSeq R1 adapter is ligated and the product purified again.",
 cond:"Protocol, not transcript. Nothing run-specific was archived and nothing here can be checked after the fact — the size window is enforced by bead chemistry, and the only evidence it worked is the library trace two boxes along."},

/* THE DRAWING WAS REPLACED FROM "EDIT VISUAL" AND THE RECORD WAS NOT, which is
   the rule for a lifted station: /pipeline owns this prose. The request asked
   for a UDI plate half full of indexes, one transfer into a strip tube, and —
   over it — the finished construct as a labelled bar assembling in read order,
   P5 · UDI · R1 · insert · BC1 · linker · BC2 · linker · BC3 · polyN · R2 ·
   UDI · P7. Nothing in that contradicts anything here; the read structure the
   bar spells out is S's, off Appendix B, and it is S's record that carries it.
   What the bar adds to this page is arrangement, not a claim: it is the only
   place on the map where the whole molecule is drawn at once.

   THE DRAWING THEN LOST ITS MACHINE, from the same button and by the same
   rule: the request took the cycler off the bench and kept the barcoding in
   the black inset, which is what B8a and C1 were asked for one after the
   other. The record does not move for it. It never cited an instrument — the
   cycle band below is section 3.5's table and not a readout.

   THEN IT LOST THE BENCH, from the same button: the plate, the strip, the
   tile and the transfer came off and the inset is the station. The record
   still does not move — one well per sublibrary, wells never reused, is
   section 3.5's to state, and no longer the drawing's to count. */
{id:"R4p", key:"C2", group:"Sequencing library prep", shape:"indexpcr", name:"Round 4 — indexing PCR", x:17.1, y:R2, lane:"r2", w:0.72, d:0.72, h:0.42,
 sub:"UDI plate · Barcode 4 · P5/P7",
 does:"This step adds the final barcode and completes the DNA library for Illumina sequencing.\nEach sublibrary receives Barcode 4 during an indexing PCR. Unlike Barcodes 1–3, which were added while the cDNA was still inside individual cells, Barcode 4 is shared by every molecule within a sublibrary. It acts as the standard Illumina i5/i7 index, recording which sublibrary each read came from and completing the four-part molecular address used to reconstruct cellular identity. At the same time, PCR amplifies the library and adds the P5 and P7 sequences needed to interact with the Illumina sequencer.",
 built:"Section 3.5, and this is where it belongs in the order: after adapter ligation, not after lysis. One unused well of the UDI Plate - WT per sublibrary, i5 and i7 unique dual indexes, wells never reused. The cycle count comes from the cDNA concentration recorded in section 2.5 — 13 cycles at 10 to 24 ng, down to 7 at a microgram or more. Appendix B lists the index sequences well by well. Visible in the matrix as the __s1 to __s8 suffix on every cell id.",
 cond:"Clean, and the only part of the whole library prep that can be checked after the fact: eight sublibraries went in and eight came back, each with a distinct index, and the valid-barcode fraction of 0.757 is consistent across them."},

/* shape is this page's own, not the lifted record's: /pipeline draws C3 as a
   dish at row-2 size, and at this bench it is B9a's cassette run on the eight
   sublibraries, with the 400-500 bp window printed on its graph.
   The prose below is still lifted verbatim — only the drawing differs. */
{id:"LIB", key:"C3", group:"Sequencing library prep", shape:"sizecheck", name:"Quantify and size-check", x:18.6, y:R2, lane:"r2", w:0.95, d:0.95, h:0.34,
 sub:"16 indexed libraries · Qubit + TapeStation · 400–500 bp peak",
 does:"This is the final quality-control checkpoint before sequencing: we confirm that the finished libraries have the right amount of DNA and the expected fragment size.\nEach indexed library is measured one final time for concentration and size distribution. Compared with the broad cDNA profile measured earlier, the finished sequencing library should now show a much tighter peak around 400–500 base pairs. That narrowing is the result of fragmentation, size selection and library construction — the molecules have been shaped into the physical form the sequencer expects. If the concentration and size profile look right, the libraries are ready to go onto the Illumina sequencer.",
 built:"Sections 3.6 and 3.7. Double-sided size selection, then Qubit dsDNA HS for concentration and Bioanalyzer High Sensitivity DNA or TapeStation HS D1000 for the trace. Libraries keep at -20C for three months. Appendix B sets the handoff: dilute and denature to the instrument's spec, add 5 percent PhiX, and sequence at a minimum of 20,000 reads per cell.",
 cond:"No QC trace was archived — no Qubit concentration, no electropherogram, so the 400 to 500 bp expectation was never checked against on this instance. What can be recovered is downstream and it is reassuring: cDNA Q30 0.970 to 0.972 and barcode Q30 0.955 to 0.973 across all eight sublibraries."},

/* NOT LIFTED, AND ASKED FOR FROM THE PAGE. The "Add a module" request asked
   for the Illumina sequencer again, opened: the interior visible during the
   read cycle, dots multiplying into clusters on a green surface and then the
   clusters reading out in colour, with an arm over a flatbed moving on top.
   It said what to draw and what not to — no strands, no primers, no bridges —
   and named no instrument model, no chemistry, no cycle count and no read
   length, so this record names none either. It is S seen from inside rather
   than a step of its own, and `cond` says so.

   THE KEY IS A SUFFIX ON THE STATION IT FOLLOWS: it lands between S and C4,
   so it is Sa, and nothing downstream is renumbered. In UNVERIFIED, and the
   badge says so. The 1.60 was paid for at the end of the lane — see the note
   above LANES — so no gap already on the row moved.

   ITS NAME IS NUDGED BACK, and that is C4's cloud rather than a taste. C4
   hangs its reads in the empty corridor between S's name and its own, and a
   station put in between S and C4 emits its name straight up the middle of
   that corridor. lab.dx moves the emission point 1.4 back toward S, which is
   just past the cloud's near edge; C4 itself is not touched. */
{id:"RCY", key:"Sa", group:"The sequencer", shape:"readcycle", cloud:false, name:"THE SEQUENCER", x:21.75, y:R2, lane:"r2", w:1.60, d:1.30, h:0.68, lab:{dx:-1.4},
 sub:"paired-end · R1 cDNA · R2 barcodes + UMI",
 does:"The sequencer reads both the biology and the molecular address that tells us which cell each transcript came from.\nEach library molecule is read from both ends. Read 1 reads the cDNA insert, identifying the transcript that was captured. Read 2 reads Barcodes 1–3 and the UMI, while the i5/i7 index reads capture Barcode 4, identifying the sublibrary. Together, those sequences let billions of pooled reads be traced back to individual cells, while the UMI helps distinguish independently captured molecules from PCR copies. For this experiment, we generated 3.66 billion reads across 16 sublibraries — about 38,600 reads per called cell — providing deep coverage of the cellular transcriptomes.",
 built:"Nothing to cite. The requests that asked for this station described a picture — first a charcoal box with its top cut away and an arm reading a green pool, then a factory with a crane feeding a pool on its roof, then the flow cell alone with the whole field read at once, then that flow cell recessed into a charcoal housing with status lights on its front, then the cell made an elliptical chip with a plainer grid, a top-to-bottom scan and brighter lights, then the clusters made to flash as the scan crosses them, the front wall made taller for its lights and a door cut in the side for the reads to leave by — and named no instrument model, no chemistry, no cycle count and no read length, so this record names none either. What was actually sequenced, and on what, is S's record and stays there.",
 cond:"Asked for from the page rather than read off an artefact, so what it carries is a figure and not a measurement. The cluster count, their colours and the beat of the cycle are drawn, not read; a colour is the request's picture of a cluster taking a base and being imaged, not a claim about what any cluster read or how any instrument images one. It is a second view of S rather than a step of its own: nothing is made or consumed here, and nothing downstream depends on it."},

/* ================= ROW 3 — THE MATRIX ================= */
/* THE WHOLE OF THIS ROW IS /FASTQ_pipe, AT /FASTQ_pipe's OWN SIZE — AND NOW AS
   CALIBRATED THERE.

   PORTED AGAIN, 2026-09-15, the way row 2 was ported from /molecular_pipe. The
   first port copied fq-data.js; the calibration on that page lives in its
   shared record (FASTQ_pipe::edits, saved 2026-08-30, after the first port),
   and never came across. It has now: its nudges are in OFFSETS below, exactly,
   and the lane is that page's span slid 27.95 along so the row starts where
   every row starts. G3 is deleted there and here. G2b, a second Ensembl 99
   placed on that page, is lifted as source text. A 0.6x shrink of this row
   and a tick-to-name change on the assign belt were tried the same day and
   reverted on review: the calibrated page is the reference.

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
{id:"FQ", key:"3", group:"③ FASTQ", groupMark:true, anchor:true, shape:"pool",
 noedge:true,   /* deliberate — see the row banner: nothing leaves the pool or the fragment */
 lane:"r3", plinth:false, aims:"E2", ballZ:5.0,
 name:"FASTQ", x:1.0, y:R3, w:5.1, d:5.1, h:9.0,
 sub:"every read from the run, both mates, before anything has been interpreted", stat:"off-instance",
 does:"The first digital object, and the only genuinely shapeless one. Different libraries, different depths, no schema — and nothing in it yet says which barcode is a cell.",
 built:"For the worked example: sequenced 2026-03/04 and processed in the vendor's own cloud workdir, whose S3 path the run definition still points at. Demultiplexing is its own named step in some pipelines — Zebrahub records bcl2fastq v2.20.0.422 — and invisible in others.",
 cond:"The biggest hole on the map, and a general one. The reads are not on this box and no manifest of them is either, so every raw-read claim on this page is downstream of a vendor report rather than of the reads. It is worse elsewhere: ChemFish's pre-QC data is documented as unavailable, and CellOracle's SRA FASTQs are a deliberate non-acquisition. Re-deriving anything — a second annotation arm, a different intron setting — starts by getting the reads back.",
 /* ---- authored on this page, below the lifted fields ------------------ */
 added:"A PILL, not a rectangle, and a real one: the reads are placed uniformly through a sphere in world coordinates and the sphere is stretched along y AFTER the turn — so the swarm churns as it always did inside a shape that holds still, lying on the same line the name reads on. They are placed turned by a real rotation and projected like everything else on this map, with depth driving size and opacity. The one being magnified is geometrically identical to every other read — same length, same weight, same wander. Only its colour and its ring say it is the one. Two leaders run from the ring's shoulders to the two ends of the opened fragment at E2, because a magnification is a frustum rather than a pointer, and they are recomputed every frame so they follow whichever of the two is dragged."},

{id:"E2", key:"C4", group:"Getting to a matrix", shape:"fragment",
 noedge:true,   /* deliberate — see the row banner: nothing leaves the pool or the fragment */
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

{id:"E3", key:"C5", group:"Getting to a matrix", shape:"sortingyard", hatch:true, drops:true, noclip:true,
 lane:"r3", gap:4.2, name:"Match R2 barcodes", x:14.0, y:R3, w:9.6, d:7.0, h:2.15,
 sub:"three barcodes, each against its own whitelist, one mismatch tolerated",
 does:"Reads the cell barcode off the reads and reconstructs which physical path each molecule took — through three barcode plates, or into one droplet, or onto one microwell bead.",
 built:"Four counting stacks appear across the corpus and they are not interchangeable: bbi-dmux → bbi-sci for sci-RNA-seq3 (ZSCAPE, ChemFish); Cell Ranger for 10x (DanioCell 4.0.0 wrapping STAR 2.5.1b, MIC-Drop-seq 5.0.0, Zebrahub 5.0.1, CellOracle 5.0.1); split-pipe v1.7.1 for Parse (MiniFin, MegaFin); STAR plus modified Drop-seq tools 1.12 for Microwell-seq (ZCL2). In the worked example, 75.7% of reads carry a valid barcode combination.",
 cond:"The version is load-bearing and it is often wrong in the record. MIC-Drop-seq's GEO metadata says Cell Ranger v7 on all 36 samples; the pipeline's own machine-written web_summary.html says 5.0.0 — and that difference decides whether introns were counted. Where a hand-typed field and a machine-written run artefact disagree, the artefact wins. Also worth noticing: the 24.3% of reads with no valid barcode are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull.",
 /* ---- authored on this page ------------------------------------------- */
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

{id:"E4", key:"C6", group:"Getting to a matrix", shape:"belts", hatch:true, drops:true, noclip:true,
 lane:"r3", gap:1.6, name:"Align R1", x:22.0, y:R3, w:6.6, d:6.6, h:0.62,
 sub:"the cDNA half hits the genome · produces coordinates",
 does:"Aligns the cDNA read to the genome and assigns it to a gene.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus — the variation is entirely in the annotation laid over it, and in what counts as being inside a gene. For the worked example: 46.1% of reads map to the transcriptome, exonic fraction 63.8%. For contrast, MIC-Drop-seq's 10x runs confidently map 92.4% to the genome and 72.7% to the transcriptome.",
 cond:"A 46% transcriptome mapping rate looks alarming and is not a failure — it is the 3′ UTR problem next door, unpatched. The gap between 46% here and 73% there is mostly annotation, not chemistry, which is why the reference nodes above this row matter more than they look.",
 /* ---- authored on this page ------------------------------------------- */
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

{id:"E5", key:"C7", group:"Getting to a matrix", shape:"assign", hatch:true, drops:true, noclip:true,
 lane:"r3", gap:1.5, name:"Assign to gene", x:27.0, y:R3, w:7.2, d:6.6, h:0.62,
 sub:"coordinates resolved against gene models · exonic by default",
 does:"Decides whether a read landing inside an intron counts toward its gene. It is one flag, it is almost never stated, and it changes the matrix materially.",
 built:"Cell Ranger flipped this default across exactly the versions in play: 5.0.0 counts no intronic reads and offers no option, 6.x makes it opt-in and off by default, 7.x turns it on by default. MIC-Drop-seq's released main-screen matrix was built with Include introns: False, discarding 9.1–9.5% of confidently-mapped reads against 76.5–77.3% exonic.",
 cond:"Three consequences, all worse than the version number. Reproducing that matrix requires Cell Ranger 5.0.0 specifically — a modern default produces a materially different object, silently. Cross-dataset depth comparisons are confounded in a known direction, because sci-RNA-seq3 runs on intron-rich nuclei while the 10x runs here used whole cells and threw the introns away. And low detection of a long or nuclear-retained transcript is weak biological evidence, because gene absence already has two non-biological explanations.",
 /* ---- authored on this page ------------------------------------------- */
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

{id:"G1", key:"F1", noclip:true, group:"The counting reference", shape:"karyotype",
 follow:{a:"E4",dx:1.0}, name:"GRCz11", x:5.9, y:R3+11.4, w:4.0, d:6.0, h:0.5,
 sub:"the sequence · which bases are where",
 does:"The assembly. Which bases are where, and nothing else — no genes, no exons, no strand. Chosen, not measured.",
 built:"GRCz11 is the assembly in every zebrafish dataset in the corpus without exception, which is the one thing about the reference that IS comparable across all of them.",
 cond:"Sharing an assembly is a much weaker guarantee than it sounds, because it says nothing about the annotation laid over it — and the annotation is where four datasets on the same assembly end up with four different answers to 'which genes exist'.",
 added:"Drawn as its own node rather than folded into the index, because it is its own file and its own decision. Swapping it for GRCz12tu — staged, and documented stage by stage at /grcz12 — changes which bases are where, and therefore every coordinate downstream of the aligner. THE FIGURE IS THE 25 CHROMOSOMES AS IDEOGRAMS, ordered by length. The lengths are the real GRCz11 primary assembly in Mb; the banding and the centromere positions are NOT, and are generated from a seed — zebrafish has no standard cytoband table of the kind that exists for human. They are there to make the shapes read as chromosomes, not to be counted."},

{id:"G2", key:"F2", noclip:true, group:"The counting reference", shape:"locus",
 follow:{a:"E4",dx:6.5}, name:"Ensembl 99", x:9.1, y:R3+11.8, w:4.0, d:6.6, h:0.5,
 sub:"the annotation · where genes start and stop",
 does:"Where genes start and stop, what survives splicing, what gets translated, which direction it is read. A separate file and a separate decision from the assembly.",
 built:"MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520 features. ZSCAPE and ChemFish use a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031. DanioCell uses Lawson v4.3.2, 36,250 released names. Zebrahub uses a custom reference, 32,057 plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason.",
 added:"This is the single largest source of incomparability between two zebrafish atlases, and it is a file somebody chose. Nothing downstream can recover which one it was. THE FIGURE IS A ZOOM: one chromosome, a window on it, and the locus that window opens — so the four claims an annotation makes are visible as shapes rather than as a sentence. Which stretches are a gene (the blocks), which parts survive splicing (every exon and every intron is named), which of those get translated (the tall blocks against the low ones at either end), and which way it is read (the chevrons). Transcription runs 5′ to 3′: the 5′ UTR is the front of the first exon, the coding sequence runs from there through the internal exons, and THE 3′ UTR IS THE TAIL OF THE LAST ONE AND MOST OF IT — which is why it is drawn as its own section with its own name rather than as a note off the end. Every assay on this map primes with oligo-dT, so that block is where the reads land, and it is the one whose zebrafish annotation is incomplete in both Ensembl and RefSeq. The structures are real in kind; the coordinates are not."},

/* LIFTED FROM public/FASTQ_pipe/fq-data.js AS SOURCE TEXT (2026-09-15), with
   this map's key and group. Its own comment follows, as it stands there. */
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
{id:"G2b", key:"F2b", noclip:true, group:"The counting reference", shape:"locus",
 follow:{a:"E4",dx:11.5}, name:"Ensembl 99", x:9.1, y:R3+13.6, w:4.0, d:6.6, h:0.5,
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

{id:"G3", key:"F3", noclip:true, group:"The counting reference", shape:"starindex",
 follow:{a:"E4",dx:-1.5}, name:"STAR index", x:7.5, y:R3+6.2, w:2.2, d:3.8, h:0.5,
 sub:"GRCz11 + Ensembl 99, baked together · once, not per run",
 does:"The gene model reads are assigned against. Nominally a detail; in practice the single largest source of incomparability between two zebrafish atlases.",
 built:"Every dataset here is GRCz11, and yet: ZSCAPE and ChemFish share a BBI-prepared Ensembl 99 build with a 3′ extension and a pseudogene/IG/TR/TEC exclusion, 32,031 genes — byte-identical between them, all 32,031 coordinates matching position by position. DanioCell uses Lawson v4.3.2 via Cell Ranger, 36,250 released names. MIC-Drop-seq and the Parse runs use plain Ensembl GRCz11, 32,520. Zebrahub uses a custom reference called Danio.rerio_genome_Zebrabow_6, 32,057 ENSDARG plus three transgene features.",
 cond:"You cannot read the release off the data. The zebrafish gene set is identical across Ensembl releases 99–114 — all 32,520 of it — so set identity cannot date a build, and every reference verdict in the corpus that reads UNRESOLVED reads that way for this reason. What works instead is reconstruction from the builder's own code plus the released coordinates, which is how ZSCAPE's was recovered exactly. What does not work is asking the paper: ZSCAPE, ChemFish and Zebrahub name no GTF at all, and Zebrahub's was written off in 2026 after six sources were exhausted.",
 /* ---- authored on this page ------------------------------------------- */
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

{id:"G4", key:"F4", noclip:true, group:"The counting reference", shape:"aligner",
 /* IT STANDS OFF G3'S OWN LINE, AND THAT IS WHAT MAKES ITS FEEDS VISIBLE.
    G1 and G2 present their top-right edges at y +8.4 and +8.5, and G3's
    bottom-left edge is at +8.1 — so every line into the index is three tenths
    of a unit long, which is a stub with a dot on it rather than a track. Two
    more consumers' worth of line in that same band would have been four stubs
    on top of each other.
    So this one is lifted clear: bl at +7.25 rather than +8.1, which gives both
    feeds about 1.2 units of run and leaves G3's own two lines a whole unit
    above them instead of alongside. The pair is what pins it — bl must stay
    UNDER the sources' +8.4 or the track doubles back, and tr must stay OVER
    E4's near rail at +2.66 or the track runs beneath the opaque deck and is
    never seen. d came 4.4 -> 4.0 to fit both at once: at 4.4 there is no y that
    satisfies them with any margin. RE-CHECK BOTH IF THIS MOVES. */
 follow:{a:"E4",dx:3.4}, name:"STAR Aligner", x:7.5, y:R3+5.25, w:4.0, d:4.0, h:0.5,
 sub:"read 1 against the index · a position, or nothing",
 does:"Takes read 1 and the index and answers one question per read: where on the assembly does this sequence sit, and does it sit anywhere uniquely. A read that lands in one place carries a coordinate from here on. A read that lands nowhere, or in several places, is set aside and never counted — the second deletion on this page, and the largest after the barcode parse.",
 built:"STAR is the aligner behind three of the four counting stacks in this corpus, sometimes named and sometimes wrapped: split-pipe runs it for the Parse datasets, Cell Ranger wraps its own build for the 10x ones, and ZCL2's Microwell-seq pipeline runs STAR plus modified Drop-seq tools 1.12. The STAR version actually recorded anywhere in the corpus is DanioCell's — Cell Ranger 4.0.0 wrapping STAR 2.5.1b. The rest are known only by their wrapper.",
 cond:"THE ALIGNMENT ITSELF IS NOT ON THIS INSTANCE. No BAM, no per-read record, no coverage — the raw reads stayed in the vendor's cloud workdir and what came back was a count matrix. So the one thing this station could be checked against is the one thing missing, and every figure about it on this map is a vendor report rather than a re-derivation. What IS recoverable is the reference: an index is a function of two files, and both of those are here.",
 added:"THE SAME TWENTY-FIVE CHROMOSOMES AS GRCz11, WITH READS ON THEM. G1's roof draws the assembly as an object — this is what there is; this one draws the same object as a result — this is where read 1 ended up on it. Same layout, same lengths, same ideograms, because they are the same object and a second arrangement of chromosomes would be a second genome. The stripes light one at a time and in no order: a field of them lit at once would be a map of coverage, which is a claim about how many and where; lit one at a time it is a machine PLACING them, which is a claim about what the step does. The order is shuffled rather than swept because reads arrive in the order the file has them, and that has nothing to do with position on the genome. NONE OF THE POSITIONS ARE REAL and none of them are counted."},

{id:"W1", key:"F5", group:"The counting reference", shape:"whitelists",
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

{id:"CB", key:"C8", group:"Getting to a matrix", shape:"tracks", noclip:true,
 lane:"r3", gap:3.0, v:1.62,
 name:"Bucket by cell", x:30.0, y:R3, w:5.4, d:8.2, gd:6.6, h:0.62,
 sub:"one index · bc1_bc2_bc3__sublibrary",
 does:"Stitches the per-library matrices into one and stamps each barcode with where it came from.",
 built:"For the worked example: split-pipe mode 'comb' over eight sublibraries. Cell ids come out as bc1_bc2_bc3__sublibrary — 01_01_05__s1 — so all four barcode rounds stay legible in the index itself.",
 cond:"86.1% of transcripts land inside called cells; the remaining 13.9% is the ambient pool and it is dropped here rather than kept as a background profile. Barcode conventions are a live trap whenever matrices are compared: ZCL2's 18 nt barcodes need a 3 × 6 split to parse, and MegaFin's vendor-well barcodes have 0% overlap with the same library's raw-combinatorial rebuild — the same cells, unjoinable.",
 /* ---- authored on this page ------------------------------------------- */
 added:"The barcode combination became a cell identity back at E3; this is where it becomes an ADDRESS. EVERY READ HERE CARRIES THREE FACTS and the drawing shows all three. The cell barcode is the blue bar it has carried since E3 — and the track it is on, because sorting by cell is the whole of what this node does. The GENE lies along the ORANGE, at the orange's own angle, so the aligned end underlines it, and it is drawn at twice the UMI's size — the two labels are not of equal standing, the gene being the answer this row has been working toward since E4 and the UMI a serial number that means nothing until E7 counts it. The UMI lies along the BLUE, at the track's angle, so the barcode end underlines that — the two pieces of the molecule ARE the two underlines, and nothing has to say which fact came off which end. The read is drawn larger here than on the belts for exactly that reason: at belt size the UMI's ten bases are three times the blue they name. It is the same read, magnified, the way E2 magnifies one read out of the pool. AND THEY REPEAT, WHICH IS THE SETUP FOR E7. A track carries one or two genes over and over, because that is what depth on a cell looks like; and each gene has its own UMI pool, smaller than the read count, so most are unique and some turn up two, five, a dozen times. PER GENE and not per track, because what E7 collapses is cell AND gene AND UMI together: a repeated UMI carried by two different genes is not a duplicate molecule, it is a collision between two. If every read in a track looked distinct there would be nothing for deduplication to do. THE EMPTY TRACKS ARE THE POINT. Three rounds of ligation address 96 x 96 x 96 = 884,736 cell barcodes per subpool, and ten tracks here are a window onto that space, labelled with their place in it rather than 1..10. Most are empty or nearly so. That emptiness IS the unfiltered matrix: every barcode by every gene, and the overwhelming majority of addressable barcodes were never a cell. IT ARRIVES IN E5's POSE AND UNFOLDS INTO THIS ONE. The two are the same molecule held two ways: on a belt the aligned end lies flat along the gene and the barcode end stands off it, because the gene is the subject there; on a rail it is the other way round, the barcode end flat along the track because the track IS the barcode, and the aligned end standing off it carrying the gene's name. So the fall is not a rotation but an unfold — both arms swinging about the one hinge and swapping places, with the adapter between them the same segment throughout. It holds E5's shape through a long level runway over the tail of E5's own belt and through the first half of the fall, and finishes the change as it touches, because landing is where a read stops being about a gene and starts being about a cell. It comes off close to the belt's end and already spread, which is the same fact drawn twice: this is the spill off the machine next door, not a jet from somewhere else. NOTHING IS MERGED HERE. No counts, no collapsing — a read that shares cell, gene and UMI with another is still drawn as its own read. That is E7's job and drawing it early would spend the one thing E7 has to show."},

/* GAP 2.6, NOT 0.8, AND IT IS THE LANE FIELD THAT SET IT. E4's kept reads run
   out down five lanes for 0.40 of the belt's length past its end, and CB's
   footprint is that field — so the next station on the row has to start after
   it or it stands in the middle of the traffic. Widen LANEX and widen this. */
/* E7 IS THE ONLY MERGE ON THE MAP AND IT IS DRAWN AS A FORK, NOT A BIN.
   Three stations upstream throw things away and are drawn that way — a cull
   colour, a chute, a shredder. A duplicate is none of those: it is one molecule
   photographed twice, and both roads out of here carry a true thing. So the
   node gets the field treatment rather than the tile: eleven lanes, two decks,
   nothing discarded.
   d IS THE FIELD AND gd IS THE FRAGMENT, the same split E6 uses and for the
   same reason — the depth here is how far eleven lanes spread, and gd is the
   belts' depth, so a read is the read that arrived. */

{id:"DD", key:"C9", group:"Getting to a matrix", shape:"dedup", noclip:true,
 lane:"r3", gap:9.2, v:1.62,
 name:"Deduplicate UMIs", x:33.0, y:R3, w:13.0, d:16.4, gd:6.6, h:0.62,
 sub:"barcode + gene + UMI collapse to one count · reads become molecules",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 added:"IT IS E6's FIELD AND NOT A NEW ONE — same lane pitch, same lanes, same molecule. A reader who has just understood E6 should not have to learn a second machine here: the only new thing is the fork, and every other difference would be noise competing with it. BUT THE READ ARRIVES STRIPPED. E6's read stands its aligned end in the air and writes its gene and its UMI on itself, because E6 is where a read acquires those facts and they have to be legible. By the time it reaches here they have been read. What this station is about is HOW MANY — one number that keeps going up and one that stops — and forty labelled molecules arriving at the fork buried that under its own evidence. So the molecule keeps its three parts and its proportions and loses everything else: aligned end, adapter, barcode end, in a line on the track, a third of E6's length and carrying no writing. Its widths are not scaled down with its length, so what travels is a short solid bar rather than a hairline. The lanes are not named again either: E6 names every one of them, at size, against 884,736, and saying it a second time over the top of the fork is the same fact competing with the only new one. THE FORK DOUBLES THE FIELD. Ten lanes come in and twenty go out at the same pitch, so the element is literally twice as deep downstream as upstream, and each lane's pair straddles exactly twice its parent's offset from the centre line — a doubling, not a reshuffle. That is why E6 dropped from twenty lanes to ten: twenty in would be forty out at half the pitch, and the split would be the one thing on the page you could not see. THIS IS THE ONLY MERGE ON THE MAP AND IT IS DRAWN AS A FORK, NOT A BIN. E3 shreds reads whose barcode is on no whitelist and E5 shunts reads that landed on no gene; both use the cull colour and a chute. A duplicate is neither — it is one molecule photographed twice — so nothing here is binned and nothing is thrown away. A scanner at the fork asks one question of everything that passes: have I seen this cell AND this gene AND this UMI before. THE TRAFFIC IS SET BY THE SCANNER AND NOT BY THE RAIL: a read holds the beam for about a sixth of a lap, so three or four to a lane is what keeps the beam clear between every pair. More than that fits the track perfectly well and then two of them stand in the same place looking like one confused object. AND THE MACHINE IS SEEN ASKING. Everywhere else on this page a thing travels at one speed and something happens to it in passing; here the read rolls in at pace, BRAKES, STOPS under the beam, is scanned along its barcode end, and only then gets an answer. A fragment that sails through a scanner at constant speed is a fragment nobody looked at. A TICK MEANS A UMI NOT SEEN BEFORE, and that fragment leaves the fork slightly larger and at full strength and DUPLICATES — the same molecule going down both roads from the same point at the same moment, its tick riding with the copy on the molecules side all the way to the end. A CROSS MEANS ALREADY COUNTED, and that fragment goes down the reads road alone, a little smaller and a little dimmer. THE CROSS IS GREY AND NOT THE REJECT COLOUR: on this page that colour means thrown away, and a read the scanner has seen before is neither wrong nor discarded. It is one of the reads, and the reads are most of them. THE COUNT TICKS WHERE THE FRAGMENT LANDS, not where it was judged, and the molecules number takes a short pop as it does — the number going up and the thing arriving have to be the same event, or the counter is a number that changes on its own. TWO TOKENS AND NO NEW HUE. The reads lane is drawn in the plain foreground grey because an observation carries no encoding — it is a count of things that happened. The molecules lane is drawn in the accent, which is R2's colour and the UMI's, and has been since E2: a molecule is distinct exactly when its UMI is. Neither road is --ok or --cull, because neither road is a verdict. EVERY OUTPUT LANE SAYS WHICH IT IS, in its own colour, at the far end where no read ever goes, with its count beside it. The two climb together and then visibly part, and THE GAP THAT OPENS IS PCR DUPLICATION. Every lane is given at least one repeat, because a lane whose counters climb together draws a library with no duplication at all, which is not a thing that happens. THE KEY IS ALL THREE FACTS: the same UMI on a different gene is a different molecule, so about a third of the lanes are seeded with exactly that case — one UMI, two genes, both first sightings, both forking. THE COUNTERS ARE DERIVED FROM THE CLOCK rather than accumulated frame by frame, so they cannot drift, cannot double-count, and come back the same after a sleeping tab. AND THE TWO COUNTS ARE NOT SET AS EQUALS. Reads is the number that keeps going up and means less the higher it gets: it is how many times the sequencer looked, and past saturation another million buys almost nothing. Molecules is the number that stops, and where it stops is what the cell actually had. So reads is small, light and faint — present and checkable, and clearly the lesser fact — and molecules is large and solid. The typography is the argument: a reader who takes nothing else from this field should take away which of the two numbers is the one that matters.", built:"For the worked example, 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424. MIC-Drop-seq's four measured 10x runs sit at 51.5–53.4%.",
 cond:"Saturation around 0.4–0.5 is the corpus norm and it means depth is not saturated: read depth alone accounts for about a quarter of the worked example's cluster resolution. Any cross-dataset comparison of genes-per-cell has to control for it. ZCL2 cannot even be checked — its UMI length is not stated and is not recoverable from a count matrix.",
 /* ---- authored on this page ------------------------------------------- */
 added:"THE LOAD-BEARING NODE OF THIS WHOLE SEGMENT, and it is load-bearing because of what has already accumulated on the read rather than because two things meet here. It needs three facts at once — cell, gene, UMI — and by now the read has all three: the cell from E3, the gene from E5, the UMI carried in read 2 the whole way. NOTHING CONVERGES. An earlier version of this page drew two edges arriving here from two branches, which made the dedup look like an assembly step; it is a collapse. The UMI itself was stamped during reverse transcription, before any amplification, so every copy of one original molecule carries it — which is what makes this the step that undoes PCR rather than a step that guesses at it."},

{id:"UD", key:"4", group:"④ Unfiltered matrix", groupMark:true, anchor:true, shape:"dge", noclip:true,
 lane:"r3", gap:1.6,
 name:"Unfiltered matrix", x:37.0, y:R3, w:9.6, d:16.0, h:3.4,
 sub:"every barcode × every gene · rarely delivered", stat:"almost never shipped",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside the counting pipeline and read by every QC stage. It is essentially never part of a delivery: for the worked example, all-sample/ on this instance holds report/ and figures/ only.",
 cond:"Its absence is why the funnel on this row has no numbers. ChemFish states the rule plainly — do not infer the missing cells from the filtered object, the pre-QC data is not available. What survives for the worked example is a ratio, not a count: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone.",
 /* ---- authored on this page ------------------------------------------- */
 added:"Cells by genes, with the 10-transcript floor already applied by split-pipe — which is a formatting decision about what is worth a row rather than a claim about what is a cell. Almost every row here is not a cell, deliberately: NOTHING IN THIS SEGMENT IS A CULL. Reads are set aside at the alignment and barcodes fail to resolve at the matching, but no cell is ever removed here, and the object is uselessly complete on purpose. THE SHAPE OF THE SPARSITY IS THE FIGURE. Every barcode gets a row and the rows are sorted by how many transcripts they carry, so the height of the surface IS the barcode-rank curve — the knee plot, stood up as relief instead of plotted on axes. A short ridge of real cells at the near edge, a cliff, and then a plain that runs away almost flat for the rest of the object. To the near side of the cliff are the barcodes that were cells; beyond it are the ones that never were and never could have been, and there are hundreds of thousands of them. The lit cells scattered on the tops of the rows are the genes actually detected in that barcode, and there are more on the tall rows than the short ones — which is the same fact twice, not decoration. The culls are the D lane, drawn at /bioinformatics_pipe, which begins at this same matrix — drawn there as the plain cube it used to be here; only this page draws its shape."},

{id:"c1", key:"D2", group:"The cull", shape:"kneeroof", hatch:true, modelled:true,
 name:"Knee", x:15.4, y:R4, lane:"r4", w:4.2, d:4.2, h:0.52,
 sub:"hard transcript minimum at the steepest point of the barcode-rank curve, per sample", tier:"physics",
 pipelineName:"Cell or background",
 does:"Separates barcodes that held a cell from barcodes that held only ambient RNA. Not a judgment call in principle, and by volume much the largest cut.",
 built:"Every stack does this and none of them do it the same way. Parse Trailmaker runs a classifier at FDR 0.01; split-pipe fits a transcript cutoff per sublibrary (613.7–711.2 in the worked example, 670.4 combined); Cell Ranger uses its own cell-calling against --expect-cells (DanioCell set 6,000–21,250 per sample); Microwell-seq took the top 10,000 cells by transcript count, or 20,000 depending which artefact you read; ZCL2's code instead treats everything below 500 UMI as the ambient profile and excludes it.",
 cond:"The only stage on this row whose threshold is fitted rather than chosen, which is why it is the one to trust. It is also where an undocumented floor can hide: CellOracle's deposit has a minimum of exactly 500 UMI with zero cells below it, and no paper or GEO record mentions a 500-UMI rule anywhere."},
/* ---- THE TWO CULLS THAT ARE NOT DRAWN ON THE ROOFS -------------------
   Four of the six culls on this row now carry their decision on their own
   roof. These two do not, and they are OFF THE LANE rather than deleted,
   sitting below the row as side structures like the metadata join and the
   cull ledger.

   Deleting them would have been the tidier edit and the wrong one. Every
   claim on them is researched — a two-order-of-magnitude spread of published
   depth floors, and a released screen missing its own stated hash filters —
   and the corpus is the reason this map exists. What has changed is their
   status, not their truth: one FOLDS INTO the knee, because a fitted
   transcript minimum IS a depth floor and drawing both would draw the same
   cut twice; the other applies ONLY TO HASHED DESIGNS, and the chemistry two
   rows up is combinatorial, where the barcode already is the sample.

   So they hang off the culls that absorb them, and a reader who wants either
   claim still finds it exactly where it was. */
{id:"c2", key:"D3", group:"The cull", shape:"tile", hatch:true, follow:{a:"c1",dx:-0.35},
 name:"Depth floor", x:16.6, y:R4-2.9, w:0.62, d:0.62, h:0.52,
 sub:"folds into the knee · 100 UMI to 2,000, depending who you ask", tier:"physics",
 does:"Removes barcodes carrying too few molecules or too few genes to support any statement about cell type.",
 built:"The corpus spread is nearly two orders of magnitude and every value is defensible in its own context: 100–250 UMI set per experiment (ZSCAPE); 80 stated and ~100 realised (ChemFish); more than 200 detected genes (DanioCell); a total-count window of 2,000–20,000 (Zebrahub); 500 transcripts and 200 genes as published (ZCL2); a per-sample fitted knee of 232–1,370 (MegaFin CP01).",
 cond:"Two failures worth carrying. ZCL2's released atlas does not obey its own published floor at all — minimum 63 UMI and 27 genes against a stated 500 and 200, so the deposit is pre-QC. And the worked example retains cells down to 294 transcripts, below split-pipe's own 670 knee estimate, while its cell count is exactly split-pipe's number_of_cells — which suggests the vendor's QC chain was applied to the analysis object and not to what was delivered."},
{id:"c3", key:"D4", group:"The cull", shape:"mitoroof", hatch:true, modelled:true,
 name:"Mito %", x:17.8, y:R4, lane:"r4", w:4.2, d:4.2, h:0.52,
 sub:"cells above median + 3 MAD of mitochondrial fraction, per sample", tier:"taste",
 pipelineName:"Mitochondrial fraction",
 does:"Removes cells dominated by mitochondrial transcripts — usually cells stressed or broken during dissociation.",
 built:"ZSCAPE cuts above 25%, Zebrahub above 15%, DanioCell above 10%, Parse Trailmaker at a per-sample absolute threshold of 0.50–1.51%, CellOracle not at all.",
 cond:"These numbers are not comparable, because the mitochondrial gene set is not the same object twice. Parse counts only the 13 protein-coding mitochondrial genes (~0.19% typical); measured over the full 37-feature MT contig the same cells sit near 8%, forty-three times higher. Reuse '1% mito' against a differently-defined set and you delete the dataset. Worse, the filter can silently do nothing: ZCL2's code matches with the pattern ^mt: — the Drosophila convention, inherited unchanged from a cross-species script — which matches zero zebrafish genes, so percent.mt is 0 for every cell and a cutoff at 20% excludes nothing. And the cut is never neutral across cell types: it sits directly downstream of a dissociation step that stresses tissues unequally."},
{id:"c4", key:"D5", group:"The cull", shape:"complexityroof", hatch:true, modelled:true,
 name:"Complexity", x:19.0, y:R4, lane:"r4", w:4.2, d:4.2, h:0.52,
 /* the pair land in the free lane between this row's band and row 4's */
 annNudge:{under:[-40,-150], over:[80,10]},
 sub:"both tails of the genes-against-transcripts fit: under-amplified and over-amplified", tier:"taste",
 pipelineName:"Outliers off the trend",
 does:"Fits genes detected against total counts and removes points sitting too far off the fit — classically two cells sharing one barcode.",
 built:"Parse Trailmaker fits a spline per sample at a p-level spanning 6.9e-6 to 1e-3 across a single plate. ZSCAPE removes cells more than 4 SD from the mean UMI. DanioCell removes the top 0.5% by detected features.",
 cond:"Two problems. It runs before the doublet scorer and removes much of what the doublet scorer exists to find, so the two are partly redundant and their order decides which gets the credit — and the order genuinely differs between stacks. And DanioCell's version is untestable after the fact: the top 0.5% of an already-filtered distribution is 0.5% by construction, so the rule cannot be verified against the deposit."},
{id:"hx", key:"G3", group:"The cull", shape:"tile", hatch:true, follow:{a:"c5",dx:0.35},
 name:"Sample demultiplex", x:20.0, y:R4-2.9, w:0.62, d:0.62, h:0.46,
 sub:"hashed designs only · not this chemistry", tier:"taste",
 does:"In multiplexed designs, assigns each cell to the embryo or sample it came from by its hash oligo, and discards cells that cannot be confidently assigned. An entire cull stage that exists or does not exist depending on a choice made two rows up.",
 built:"ZSCAPE uses sci-Plex hashing with an enrichment ratio above 3 for the timeseries rounds and above 5 for perturbations, cutoffs set manually from the ratio distribution. ChemFish uses the same chemistry at ratio ≥ 2.5 with total corrected hash UMI above 5. DanioCell uses MULTI-seq: a barcode is negative below 20 UMIs, a singlet needs SNR ≥ 5, and cells called doublets by either approach are removed. Combinatorial designs skip this entirely — the barcode already is the sample.",
 cond:"The clearest case in the corpus of a published threshold that was not applied. ChemFish's round-two screen was released without its stated hash filters: 65,736 cells (4.83%) fall below the 2.5 enrichment cutoff and 16,541 (1.22%) below the hash-UMI floor, while round one matches every published threshold exactly. Two rounds of one experiment, one filtered and one not, and nothing in the object says which is which."},
{id:"c5", key:"D6", group:"The cull", shape:"doubletroof", hatch:true, modelled:true,
 name:"Doublets", x:21.0, y:R4, lane:"r4", w:4.2, d:4.2, h:0.52,
 annNudge:{synth:[10,120]},
 sub:"scDblFinder, thresholded against the expected collision rate", tier:"taste",
 does:"Scores each barcode for looking like two cells and removes those above a threshold.",
 built:"Parse Trailmaker fits a probability threshold per sample, 0.469 to 0.903 across one plate. ZSCAPE inspects residual multiplet clusters manually and removes them. ZCL2 runs DoubletFinder at a fixed 5% expected rate. MIC-Drop-seq's Methods state scDblFinder. Our own droplet path uses Scrublet. CellOracle mentions no doublet detection anywhere.",
 cond:"The least consistent stage on the map and the least auditable. MIC-Drop-seq states scDblFinder in Methods and deposits no doublet column in any object, so the claim cannot be checked at all. A per-sample threshold that swings from 0.47 to 0.90 across one plate is not measuring a constant property. And the true collision rate was set two rows up by loading density, which none of these tools can see."},
/* ---- THE ATTRITION BAND, BEHIND THE ROW -----------------------------
   The four culls' arithmetic drawn flat on the ground, one riser per cull,
   a tributary peeling off each. It is SCENERY: it spans the whole cull
   section, is painted after some of what stands on it, and takes no pointer
   events — a floor rather than a building. Its span, its yBase and its
   ledger are derived in the view from the buildings it covers, so it follows
   them when the row is re-spaced or one of them is dragged.

   Lifted from /bioinformatics_pipe with the same fields, because it is the
   same band: only its key, its group and its position on this longer row are
   this map's. Every count on it is MODELLED — what these culls would take
   from the simulated population, not a record of what any of them took,
   because the per-barcode ledger the node below describes does not exist. */
{id:"RIVER", key:"D0", group:"The cull", shape:"attritionstaircase",
 scenery:true, modelled:true,
 /* The last published drawing ignored these accumulated offsets. Preserve
    that visual origin while applying subsequent saved drags to its geometry. */
 positionOrigin:{dx:-5.1,dy:-42.15},
 name:"Attrition", x:24, y:R4-7.4, w:1.6, d:1.6, h:0, lab:{dy:0.35},
 /* it spans the culls whose arithmetic it is. It used to start at the
    unfiltered matrix, which is a row above it now — a band cannot reach
    across a row, and the population it counts is the one arriving at the
    first cull, which is the same population. */
 from:"c1", to:"FD", yBase:R4-2.6, width:4.6, z:0.002, opacity:0.8,
 sub:"every barcode that ever appeared, and what each of the four takes",
 does:"The four culls' arithmetic, drawn to scale on the ground behind the row. One straight edge gives the run a datum; the opposite edge staircases down, one riser per cull, and a tributary peels off each riser and drifts clear. Every step is then read against one unmoving line rather than against a shape changing on both sides at once, which is what an earlier symmetric version got wrong — neither of its edges held still, so the eye had nothing to measure against.",
 built:"Drawn flat in two dimensions and laid onto the ground plane by one transform, the same trick the roofs use. Counts come from applying the culls in order, each over what the one before left, because subtracting four independent percentages double-counts every barcode two of them agree about — and two of them do: a doublet carries two cells' worth of transcripts and rather less than two cells' worth of distinct genes, so complexity reaches it before the scorer does.",
 cond:"One denominator throughout — every barcode that ever appeared — so nothing on this band is a ratio between two different objects. THE KNEE IS THE FIRST RISER AND IT TAKES 96.7%, which makes the band a cliff followed by three hairlines. That is the finding rather than a drawing problem: on this dataset the knee is very nearly the whole cull and the three after it are a rounding. What keeps the small ones readable is that each station's own figure is a share of what REACHED it, so mito reads −5.8% whether its riser is forty pixels or one, and a thin tributary flares to a floor width so a small cull is still visibly a cull. Exactly one of the 468 barcodes past the knee is not a cell in the simulation, so the population the last three act on is the called cells in all but that one. And the counts are modelled — what these culls would take from the simulated population, not a record of what any of them took, because no per-barcode ledger exists here or anywhere else in the corpus."},

{id:"Q", key:"D7", group:"The cull", shape:"tile", follow:{a:"c4"}, name:"Cull ledger", x:17.8, y:R4+2.6, w:1.2, d:1.2, h:0.3,
 sub:"one row per dropped barcode",
 does:"What the Sankey should be drawn from: which stage killed which barcode, and why.",
 built:"Node and link labels would use the plain-English phrasings on this row, never the internal step names.",
 cond:"It does not exist here, and it does not exist anywhere else in the corpus either, which is the more interesting fact. Vendors emit settings, not tallies. Authors publish thresholds, not ledgers. CellOracle reports a comparison at 57,175 cells against a deposit of 72,870 — roughly 21.5% removed by QC and ambient-cluster steps that are never numerically specified. Every retention figure on this row is therefore a ratio between two objects, never a sum over stages."},

{id:"FD", key:"5", group:"⑤ Filtered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r4",
 name:"Filtered matrix", x:22.0, y:R4, w:1.55, d:1.55, h:1.55, cells:6, fill:0.62,
 sub:"94,616 × 32,520 · median 3,198 UMI / 1,618 genes", stat:"the cells, as asserted",
 does:"The same gene space, a fraction of the barcodes, dense where the first cube was empty. Everything here has been asserted to be a cell.",
 built:"For the worked example: 94,616 cells × 32,520 genes, raw integer counts, no layers and no embedding. Median 3,198 transcripts and 1,618 genes per cell against a design target above 4,000.",
 cond:"The governing rule for this object is corpus principle 4 — a threshold printed in Methods is never assumed to have been applied to the deposited data. Tested against their own releases, four datasets here disagree with their own Methods: ChemFish shipped one screen without its hash filters, ZCL2 shipped a pre-QC atlas with a mitochondrial filter matching zero genes, CellOracle shipped an undocumented 500-UMI floor and no mitochondrial filter, and the worked example keeps cells below its own knee. DanioCell is the one that verifies exactly — and even there a later format conversion broke the guarantee."},


/* ================= ROW 4 — THE LABELLING ================= */

{id:"H5", key:"6", group:"⑥ Published object", groupMark:true, anchor:true, shape:"monolith",
 lane:"r5",
 name:"Published object", x:4.6, y:R5, w:2.0, d:2.0, h:1.9,
 sub:"counts, metadata, provenance · no biology", stat:"complete and mute",
 does:"Counts, treatment metadata, provenance. Complete as a measurement and completely mute about biology — nothing in it says what any of these cells are.",
 built:"For the worked example: minifin_filtered.h5ad, 454 MiB, raw integer counts, symbol-native var_names with ENSDARG kept alongside in var['id'].",
 cond:"Two traps live in objects like this. The gene namespace is rarely stated and frequently assumed wrong: the worked example is symbol-native where MegaFin is ENSDARG-native, and Zebrahub was recorded in our own docs as symbols-needing-mapping when ENSDARG ids were in var['gene_ids'] the whole time. And QC columns go stale through conversion — DanioCell's obs carries nUMI, nGene, percent.mt and percent.ribo describing a 36,250-feature universe while X holds 30,121, so a 10% mitochondrial filter passes on obs while the matrix itself reaches 12.86%. A published QC guarantee, broken by a format change."},


{id:"KAS", key:"K", group:"The labeller", shape:"works", name:"DanioType Kasperov", x:14.0, y:R5, lane:"r5", w:2.0, d:2.0, h:1.9,
 sub:"Researcher · Reasoner · Archivist", stat:"de novo, from markers alone",
 does:"Three specialists arguing about one cluster at a time. The Researcher searches the literature against the marker set. The Archivist answers raw-statistics probes on the live matrix so a claim can be checked rather than believed. The Reasoner synthesises, may go round again up to four times, then concludes or abstains. On the worked example, 46 of 267 leaves never reached the Researcher — a distinctiveness gate committed them to a coarse call up front — and of the 221 that did, 91 needed a second round, 37 a third, 7 a fourth and 5 a fifth.",
 built:"run_leaf_v2 (v1.2), gpt-5.4, ground-truth-blind end to end, leak-scanned per leaf. 209 assigns and 58 abstains, zero errors, $15.35 and 5,321 agent-seconds over 21 minutes — about six cents a leaf.",
 cond:"The transferability discipline is the fragile part, and it is already broken in a way nobody noticed. Every one of the 267 prompts in the worked example opens by telling the model it is looking at 'ZSCAPE 48 hpf'. The dataset name is hard-coded in the core prompt instead of coming from the adapter; the dataset it was actually reading is never named to the model. The results validated well anyway — but this is exactly the failure mode the architecture exists to prevent, it survived a full validated run undetected, and nothing in the code would catch it next time."},


{id:"LB", key:"7", group:"⑦ Usable .h5ad", groupMark:true, anchor:true, shape:"strata",
 lane:"r5",
 name:"Usable .h5ad", x:20.2, y:R5, w:2.0, d:2.0, h:1.9,
 sub:"267 leaves named · 114 nodes · every cell reachable", stat:"the first biological claim",
 does:"The same cells as the published object, sorted into named strata. On the worked example: 209 leaves resolved outright, 24 left region-unresolved, 34 subtype-unresolved, and 19 resolved finer than the expert did. Four rows from a fish tank, this is the first object on the map that makes a biological claim.",
 built:"Validated on the sealed key at 0.989 lenient for committed in-ontology calls and 0.904 across all GT-backed leaves; strict agreement 0.524 and 0.478. At node level, 0.989 and 0.916 on 77 GT-backed nodes.",
 cond:"Read the gap between lenient and strict before quoting either. Lineage recovery is expert-level; depth agreement is about half, and most of that gap is an ontology-axis mismatch rather than error — the expert labels the CNS by anatomical region using spatial lassoes, and region is not recoverable from markers, so the labeller says 'region-unresolved' instead of guessing. Which axis becomes primary is an open product decision, flagged rather than defaulted. And there is no labelled matrix: obs['cell_type'] on the published object is still 'unknown' for every cell. Anyone who wants labelled cells joins the deliverable to the leaf assignment themselves."},
];


const ROWS=[R1,R2,R3,R4,R5], MIRROR=22.7;

/* Row 1 runs as two parallel lines that meet once. The biology line — colony,
   pair, clutch, cull — sits above the centreline; the chemistry line — the four
   compounds, the Echo, the dosed plate — sits below it. Their spans are solved
   so all three lanes share one gap scale, and so that the cull and the plate
   land on the SAME x: the two merges into the arraying step are then mirror
   images of each other. Membership is explicit rather than inferred from y,
   because two lanes share one row and inferring would interleave them. dir:-1
   mirrors the lane so the map snakes. */
/* EVERY ROW READS LEFT TO RIGHT.

   It used to snake — rows 2 and 4 ran right to left so each turned a corner
   into the next — which is efficient with space and asks the reader to change
   direction three times. A row that reads one way and the row under it the
   other is two reading orders on one page, and the only thing telling you
   which is which is the dots.

   Now all four run the same way and NOTHING IS DRAWN BETWEEN THEM. The rows
   are stacked in order and each reads the same way, so one feeding the next
   is already said by the layout; a track saying it too was the longest line
   on the map carrying the least information. A row ends, and the next begins.

   ROW 3 IS STILL LONGER THAN THE OTHERS, and that is honest. Four of its
   culls carry a chart on their own roof, and a chart needs room: they are 4.2
   units square, the same size they are on /bioinformatics_pipe, where they
   are bigger than the unfiltered matrix they follow because the decision is
   the thing that row is about. */

/* ============================================================
   CARRIED IN — the object each row starts from.

   Nothing is drawn between the rows, and that is right: they are stacked in
   the order things happen and one feeding the next is already said by where
   they sit. But "already said" is doing a lot of work at the LEFT edge of a
   row, which is where a reader's eye lands first and is furthest from the
   thing the row before it ended with.

   So each row after the first opens with the object it inherits, drawn again.
   `carried:"<id>"` marks it: same shape, same size, same name, drawn at
   reduced weight so it reads as a restatement rather than a second object,
   and its reader entry says plainly that it is the same thing arriving.

   IT IS NOT A SECOND CLAIM. It carries no prose of its own — `does`, `built`
   and `cond` are the source's, read through at render time — so there is one
   place to change any of it and no way for the two to disagree. It carries no
   key of its own either: it shows the source's, because it IS the source.
   ============================================================ */
const CARRIED = [
  {id:"UDc", carried:"UD", lane:"r4", x:0.7, anchor:true, groupMark:true},
  {id:"FDc", carried:"FD", lane:"r5", x:0.7, anchor:true, groupMark:true},
  /* ROW 2 ENDS ON WHAT ROW 3 OPENS WITH — the same rule the other way round.
     The sequencer's reads ARE the FASTQ pool, so the row that makes them ends
     on it: FQ drawn again, same shape, same size, same name, no prose, fed by
     one read track out of Sa. `aims` is cleared because on row 3 it hangs two
     leaders from the pool to the fragment E2, and from here those would run
     across the gap between rows, which nothing on this map does. It stands on
     its own one-station lane, r2-tail, so adding it does not re-space row 2:
     a fifteenth station on r2 would move the gap scale and every nudge in
     OFFSETS measured from it. */
  {id:"FQc", carried:"FQ", lane:"r2-tail", x:0, aims:undefined},
];

const LANES = [
  {id:"r1-bio",   y:R1-2.0,   x0:-1.30, x1:9.00, dir:+1},
  {id:"r1-chem",  y:R1+2.0,   x0:-1.00, x1:8.50, dir:+1},
  {id:"r1-tail",  y:R1,       x0: 9.85, x1:23.40, dir:+1},
  /* /molecular_pipe's own lane, 0.7..36.68, moved 29.05 along x. Its span is
     what Harsha's nudges in OFFSETS were measured from, so it has to be that
     span to the unit; the shift only undoes the Thaw's own -29.05. */
  {id:"r2",       y:R2,       x0:29.75, x1:65.73, dir:+1},
  /* one station, FQc: the lane only says where it stands — see CARRIED. 46.1
     is the nearest its hovering swarm can come to Sa without covering the
     machine, measured on both drawings' silhouettes; nearer, the reads spill
     over the sequencer. */
  {id:"r2-tail",  y:R2,       x0:47.06, x1:51.51, dir:+1},
  /* The three bioinformatics rows space EVENLY and fill their own mat. Each
     one is a short row of comparable objects — a matrix and five steps, a
     matrix and five culls, a matrix and three landmarks — so the major/minor
     rule had nothing to separate and only invented a rhythm. `even` makes
     every gap the same; the spans are set so the run sits centred in the
     dotted band under it, with the same margin at each end. */
  /* ROW 3 IS NO LONGER AN EVEN LANE, and that is a claim change rather than a
     tolerance. `even` says the spacing carries no meaning — six tiles in a
     line, none of them nearer its neighbour than any other. That was true of
     the six tiles this row used to be. It is not true of what stands here now:
     the barcode match is a nine-and-a-half-unit machine, the fork needs most
     of a lane's run to be seen splitting, and the belts are short. Their gaps
     are 4.2, 1.6, 1.5, 3.0, 9.2 and 1.6, and every one of those is a size
     rather than a preference. Forcing them even would put the fork on top of
     the field before it. r4 and r5 are still even. */
  /* AND IT IS LONGER THAN IT WAS, because what stands on it is bigger. The
     eight machines are 25.25 units of width between them against the 20.6 this
     lane used to span — so layoutRows' gap scale went NEGATIVE and clamped at
     its 0.25 floor, and the row ran to 31.6: seven and a half units past the
     end of its own dotted mat, with the fork field and the matrix standing off
     the paper. Nothing said so. check-rows measures the GRID against the
     drawing and the grid reaches 42, so it passed; the band is what the row
     overran, and no check looks at that.
     31.8 puts the gap scale at about 0.29 — off the clamp, so the engine is
     solving the row rather than giving up on it — and BAND_X[2] below covers
     it with a margin. IF ANY STATION ON THIS ROW GETS WIDER, re-check that
     sum against this span. */
  /* /FASTQ_pipe's own lane, 0.7..50, moved 27.95 along x. That page's saved
     nudges are measured from it (see OFFSETS), so it has to be that span to
     the unit; the shift only undoes the FASTQ pill's own -28.27. */
  {id:"r3",       y:R3,       x0:28.65, x1:77.95, dir:+1},
  /* LONGER, BECAUSE ITS HEAD IS NOW A 9.6-WIDE OBJECT. UDc is the unfiltered
     matrix carried down from row 3, and at the old span the track out of it had
     a third of a unit of open run before the knee — its dots spent the whole
     journey inside one building or the other. */
  {id:"r4",       y:R4,       x0:0.7,  x1:42.0,  dir:+1, even:true},
  {id:"r5",       y:R5,       x0:0.7,  x1:23.3,  dir:+1, even:true},
];

const EDGES = [
  /* the biology lane */
  {a:"AQ",b:"A1",kind:"fish",straight:true},{a:"A1",b:"A2",kind:"fish"},{a:"A2",b:"A3",kind:"fish"},
  /* the chemistry lane — no incoming edge from the colony on purpose: the
     compounds have nothing to do with our fish, and arrive from off-map */
  {a:"CS",b:"LIBR",kind:"meta"},{a:"LIBR",b:"ECHO",kind:"meta"},
  /* the merge — the embryos go into wells that already hold compound */
  {a:"A3",b:"A4",kind:"fish",straight:true},{a:"ECHO",b:"A4",kind:"meta",straight:true},
  {a:"A4",b:"A5",kind:"fish"},{a:"A5",b:"A6",kind:"fish"},{a:"A6",b:"A7",kind:"fish"},{a:"A7",b:"FX",kind:"fish"},

  /* everything up to lysis is a suspension of intact cells; everything after
     it is DNA in a tube. The kind flips at SB, which is where the cells die. */
  /* THE FIXED MATERIAL TAKES B1's PLACE. "Thaw, count, dilute" stood at the
     head of this row and is gone: the row now opens with the object it
     inherits, which is the thing the thaw acts on, and one box that says
     "take it out of the freezer" was the least of the twelve steps here.
     Its prose is in the commit that removed it. */
  /* /molecular_pipe's chain with its deleted stations taken out. A deleted
     node takes its edges with it and nothing bridges the gap, so on that page
     the chain is broken in three places — CAP to B8a, B8a to B9a, C3 to Sa.
     Here each gap is one track: a station with nothing running into it is an
     orphan, and the row would read as ending four times. */
  {a:"THW",b:"R1p",kind:"susp"},{a:"R1p",b:"B1",kind:"susp"},{a:"B1",b:"R2p",kind:"susp"},
  {a:"R2p",b:"B2",kind:"susp"},{a:"B2",b:"R3p",kind:"susp"},{a:"R3p",b:"SB",kind:"susp"},
  {a:"SB",b:"CAP",kind:"lib"},{a:"CAP",b:"AMP",kind:"lib"},{a:"AMP",b:"SZD",kind:"lib"},
  {a:"SZD",b:"FRG",kind:"lib"},{a:"FRG",b:"R4p",kind:"lib"},{a:"R4p",b:"LIB",kind:"lib"},
  {a:"LIB",b:"RCY",kind:"lib"},
  /* and the reads leave the sequencer for the pool they are — see CARRIED */
  {a:"RCY",b:"FQc",kind:"read"},

  /* ---- ROW 3, AND IT IS ONE CHAIN -----------------------------------------
     Eight stations in the order a read meets them, and the ordering is the
     argument: barcode matching happens FIRST, because alignment is the
     expensive step and it is not spent on the quarter of reads that could
     never be assigned to a cell. Everything downstream of E3 inherits a cell
     identity, which is what makes the deduplication possible at all — it needs
     cell, gene and UMI at once, so bucketing by cell has to precede it.

     NOTHING LEAVES THE POOL OR THE FRAGMENT. A track with dots means material
     moving between two objects, and neither is happening at the head of this
     row: the fragment is not somewhere the reads GO, it is one of them drawn
     larger, and the two leaders between them already say so. Nothing arrives
     at the pool either — the run is the row above. So the first track on this
     row is the one out of the barcode match, which is correct: the first thing
     that actually moves is a read that has been given a cell. */
  {a:"E3",b:"E4",kind:"read"},{a:"E4",b:"E5",kind:"read"},
  {a:"E5",b:"CB",kind:"read"},{a:"CB",b:"DD",kind:"cell"},{a:"DD",b:"UD",kind:"cell"},

  /* THE REFERENCE EDGES CARRY, AND THEY ARE GREY. They were dashed and dotless
     for a long time, on the argument that an index is built once and reused
     forever so animating material down it every run asserts a per-sample cost
     that does not exist. True, and it cost more than it was worth: a dashed
     line nothing moves along reads as a footnote, and these are not footnotes.
     The reference is the single largest source of incomparability between two
     zebrafish atlases, and the whitelists are what a barcode MEANS. What marks
     them as a different class of thing is the SKIN their nodes wear, not the
     edge. The grey is neither read's colour: the material owns the accents.

     STRAIGHT AND PORTED AT BOTH ENDS. These are the largest footprints on the
     map, and an edge from the centre of one spends its whole length inside
     that object's own silhouette — drawn, dotted, and reading as unconnected.
     "tr" and "bl" are the two footprint edges anybody would point at under
     this projection, and the chain says edge to edge: assembly and annotation
     into the index and into the aligner, and both of those into the step. */
  {a:"G1",b:"G3",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  {a:"G2",b:"G3",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  {a:"G3",b:"E4",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  {a:"G1",b:"G4",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  {a:"G2",b:"G4",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  {a:"G4",b:"E4",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  /* G2b, lifted with its record: the copy of Ensembl 99 feeds the assign belt */
  {a:"G2b",b:"E5",kind:"ref",straight:true,port:"tr",portB:"bl",tone:"var(--fg2)"},
  /* each whitelist to its own scanner, label to label: BC1's plate is checked
     by BC1's scanner and by neither of the others, and one line collapsed the
     three independent questions into a supply */
  {a:"W1",b:"E3",kind:"ref",straight:true,port:"bc1",portB:"bc1",tone:"var(--fg2)"},
  {a:"W1",b:"E3",kind:"ref",straight:true,port:"bc2",portB:"bc2",tone:"var(--fg2)"},
  {a:"W1",b:"E3",kind:"ref",straight:true,port:"bc3",portB:"bc3",tone:"var(--fg2)"},

  /* THE CULL CHAIN runs through the four culls that carry their decision on a
     roof. The two that do not — the depth floor and the sample demultiplex —
     hang off the culls that absorb them rather than sitting in the line: one
     folds into the knee, the other applies only to hashed designs. A dashed
     edge, because it is a relationship rather than a flow of barcodes. */
  /* the cull row opens with the matrix it acts on, drawn again — see CARRIED */
  {a:"UDc",b:"c1",kind:"cell"},{a:"c1",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"c5",kind:"cell"},
  {a:"c5",b:"FD",kind:"cell"},
  {a:"c2",b:"c1",kind:"ref",dash:true},{a:"hx",b:"c5",kind:"ref",dash:true},
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c4",b:"Q",kind:"drop",dash:true},{a:"c5",b:"Q",kind:"drop",dash:true},

  /* ROW 5, CUT TO ITS LANDMARKS. It carried nineteen objects: the .obs stamp,
     the sibling note, a four-step partition ladder, a stats service, a
     per-dataset adapter, a frozen ontology menu, a meta-reasoner, an SSMP
     flag, a sealed key, an assembly step and a handoff. Every one of them is
     real and researched, and together they made the last row of the map the
     busiest, which is the wrong emphasis for the row that just names things.

     What is left is the three objects the row is actually about: the matrix
     arriving, the mute published object, the labeller, and what comes out.
     The prose that went is in git — see the commit that removed it — and the
     claims that survive are the ones the landmarks carry themselves. */
  {a:"FDc",b:"H5",kind:"cell"},
  {a:"H5",b:"KAS",kind:"leaf"},
  {a:"KAS",b:"LB",kind:"call"},

  /* the corners */
  /* THE THREE ROW TRANSITIONS ARE NOT DRAWN, and their absence is the point.

     Every row reads left to right and the rows are stacked in order, so that
     one feeds the next is a thing the layout already says. Drawing it as well
     meant a track running the entire length of a row backwards, three times,
     to state something no reader was in doubt about — and a track is the
     loudest thing on this map after the objects themselves. The tracks that
     are left all say something that is not obvious from position: which of
     two forks a thing took, that a reference feeds a step it is not beside,
     that a cull drops into the ledger.

     So a row simply ends. The last object of one row leads nowhere and the
     first object of the next is fed by nothing, and both read as "this is
     where the row stops" rather than as a broken link.

     If you put them back, they need routeOf() to route them round rather than
     across — a straight run cuts diagonally through every object on the row
     it is leaving. That routing is gone with them; git has it. */
];

/* the four bands — what kind of work each row is.
   All four share the same x0/x1 gridlines, so the four titles line up
   along one diagonal on the bottom-right edge. */
/* A band is as long as its row, and row 3's row is longer. */
const BAND_W=[-2,24], BAND_H=[-3.8,3.8];
/* ROW 3'S MAT IS THE WIDEST ON THE MAP NOW, and that is honest: it holds eight
   machines where every other row holds tiles. It has to reach past where the
   lane leaves the last object, or the matrix stands off the end of the paper. */
const BAND_X=[[-2,24],[-2,61],[-4.35,86.35],[-2,44.7],[-2,26]];
/* ROW 3 IS THE ONE BAND THAT IS NOT SYMMETRIC ABOUT ITS OWN LINE, and it has
   to be, because what stands on it is not symmetric either: the whitelists sit
   at -2.9 and the annotation at +4.9, so the drawing runs about -3.5 to +6.3.
   Centred, half of it would be outside its own mat.

   THE CEILING IS THE ROW PITCH, NOT THE DEFAULT DEPTH. Rows are 13.6 apart and
   the default band is ±3.8, which leaves 6.0 of clear air between neighbours —
   so this one can reach +7.2 and still stop 2.6 short of row 4's edge at
   37.0, and -4.2 while staying 5.6 clear of row 2's at 17.4. That headroom is
   what set the 2.4 the whole row was scaled by; spend it and the scale has to
   change with it. CHECK BOTH NUMBERS IF ANY ROW MOVES. */
/* A BAND PER ROW, BECAUSE THE ROWS ARE NO LONGER ALIKE. Row 3 is
   /FASTQ_pipe's own band to the unit, -9.6 to +16.8 and 74 long. Row 4 has to
   hold the copy of row 3's last object at its head, which is 16 deep. The rest
   are the 7.6 they always were. */
const BAND_H_ROW = {1:[-7.5,7.5], 2:[-24.25,13.3], 3:[-8.4,8.4]};
const BANDS = [R1,R2,R3,R4,R5].map((r,i)=>{
  const H = BAND_H_ROW[i] || BAND_H;
  return {
    name:["Biological samples","Molecular biology","Reads to a matrix","The cull",
          "Opinionated metadata"][i],
    x0:BAND_X[i][0], x1:BAND_X[i][1], y0:r+H[0], y1:r+H[1]
  };
});

/* one carry: the map runs out at the end, into everything that comes after */
const CARRIES = [
  /* one carry only: the map runs out at the end, into everything after it.
     The chemistry lane simply begins — it has no incoming line, because the
     compound library is not part of this pipeline and drawing a thread back
     to it implied a handover that does not happen. */
  /* row 4 reads left to right like the rest now, so the map runs out at its
     RIGHT end rather than its left */
  {x0:24.6,y0:R5,x1:28.6,y1:R5, fade:"out", kind:"call",
   from:"PRISM handoff", to:"everything after this map"},
];

/* ============================================================
   PAYLOADS
   Real records, transcribed from the artefacts named at the top of this file.
   Nothing below is generated: each generator picks one of a handful of records
   actually read off disk. Where a stage's records are NOT on this instance —
   the raw reads, and any dropped barcode — the payload says so instead of
   fabricating a plausible one.
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

/* leaves from umap.json + their final call in the deliverable */
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

/* per_leaf_control in minifin_phaseA_scores.json */
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

const pad = (s,n) => String(s).padEnd(n);
const REAL_NOTE = "Read off the artefact on the instance, not generated. The file it came from is named in the header of pipeline-data.js.";

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

const OVERVIEW = {
  eyebrow:"Zebrafish single-cell · the platonic pipeline",
  title:"Aquarium to Atlas",
  sub:"five rows · seven landmarks · one claim at the end",
  does:`<p>The end-to-end pipeline behind a zebrafish single-cell atlas, drawn as the shape it takes in general rather than as one run. Where a stage varies by technology the node names the variants; where the corpus disagrees with itself the condition field says so. One run — <mark>MiniFin</mark>, 94,616 cells — is carried throughout as the worked example, because it is the one whose every artefact sits on the instance, and its records are what the moving dots carry.</p>
<p>Five rows, and <mark>every one of them reads left to right</mark>. No track runs between them: they are stacked in the order things happen, so one feeding the next is already said by where they sit. Instead <mark>each row opens with what it inherits</mark>. Rows 4 and 5 open with the object itself — the unfiltered matrix, the filtered matrix — drawn again, the same object the row above ends with rather than a second one. Row 2 opens by <em>undoing</em> the step above it: the fixed material comes back out of the freezer and thaws. Top row is oldest.</p>
<p><mark>Row 1 — the fish, and the compounds.</mark> The only row where biology is being done rather than described, and the only one that forks. A biology line runs above the centreline — the colony, the pair, the clutch, the cull — while a chemistry line runs below it, from picking four compounds out of a library through the Echo to a dosed and empty plate. The two are independent and meet exactly once, when the embryos go into wells that already contain compound. Note what feeds each: the biology line starts in our own tanks, while the chemistry line simply begins — nothing feeds it, because the compounds are not ours and the library they came from is not part of this pipeline. After the merge the row runs on to the choice that governs everything downstream — whole cells, or nuclei.</p>
<p><mark>Row 2 — the chemistry.</mark> Four rounds of barcoding, library prep, three and a half billion reads. One of four assay families the corpus uses.</p>
<p><mark>Row 3 — reads to a matrix.</mark> Six stations between the reads and the first matrix, and <mark>the order is the argument</mark>: read 2's three barcodes are matched against the known well lists <em>first</em>, because alignment is the expensive step and it is not spent on the quarter of reads that could never belong to a cell. Everything past that point carries a cell, which is what makes the deduplication possible at all — it needs cell, gene and UMI at once. Then read 1 goes to the aligner, the coordinate becomes a gene, the reads are bucketed by barcode, and duplicates collapse.</p>
<p>The counting reference is drawn as what it actually is: an assembly, an annotation, the index compiled from the pair, the aligner that consumes it, and the three barcode whitelists — each plate wired to the scanner that checks it and to no other, because three rounds are three independent questions. <mark>Nothing on this row is a cull.</mark> Reads are set aside — a quarter carry no valid barcode combination and never reach the alignment — but no cell is removed here, and the matrix at the end is deliberately, uselessly complete.</p>
<p>It ends at every barcode against every gene, and the shape of it is the point. The rows are sorted by how many transcripts they carry and stood up as relief, so <mark>the surface is the barcode-rank curve</mark> — a short tall ridge, a cliff, and a plain that runs away almost flat. Near side: the barcodes that were cells. Beyond: the hundreds of thousands that never were. This object is almost never delivered, and that is the reason the funnel below it has no counts. <mark>The same row is drawn at reading scale at <a href="/FASTQ_pipe">/FASTQ_pipe</a></mark>, where every one of these machines can be watched working.</p>
<p><mark>Row 4 — the cull.</mark> Which of those barcodes was a cell. This is the row where atlases silently stop being comparable, and it says where. <mark>Four of the six culls carry their decision on their own roof</mark> — a curve with a cut on it, a distribution with a threshold, a cloud with a band through it, an embedding against a manufactured reference. Each is a chart drawn flat and laid onto the building by one matrix, so it can be read without orbiting it. The other two are off the row rather than gone: one folds into the knee, and the other applies only to hashed designs. Behind them, the arithmetic of all four painted flat on the ground.</p>
<p>Those two were one row until they were not. Together they are nineteen objects doing two different kinds of work — one turns reads into a table, the other decides what was alive — and each already has a page of its own built from this data, at <a href="/FASTQ_pipe">/FASTQ_pipe</a> and <a href="/bioinformatics_pipe">/bioinformatics_pipe</a>.</p>
<p><mark>Row 5 — the labelling.</mark> A mute object becomes a named one — de novo, from markers, which is not how most of the atlases here were labelled. It is drawn as three objects and the machinery between them is not on the map: the partition ladder, the stats service, the frozen ontology menu, the meta-reasoner and the sealed key were nineteen boxes making the row that just names things the busiest on the page. What is left is what the row is about.</p>
<p>Seven landmarks are real things you could point at; everything between them is a step, drawn small. Outlines are roads not taken. Hatching means the stage destroys data.</p>
<p>Beyond the row-1 fork, three dependencies do not follow the rows. Sample identity on row 3 was written chemically on row 2 and decided physically on row 1. The doublet threshold on row 3 is trying to measure a collision rate that loading density set on row 2. And the nuclei-or-cells choice on row 1 decides what the intron stage on row 3 does, and what a mitochondrial percentage even means.</p>`,
  built:`<p>General claims come from the corpus at <mark>/data/datasets/zebrafish/</mark>: nine dataset entries, seven carrying a full nine-section provenance record under <mark>&lt;DATASET&gt;/sources/README.md</mark> — ZSCAPE, ChemFish, DanioCell, Zebrahub, ZCL2, MIC-Drop-seq, CellOracle. Every record ends with the same seven cross-dataset provenance principles, which are the nearest thing to a written statement of this pipeline; the four that drive this map are quoted in the header of <mark>pipeline-data.js</mark>.</p>
<p>Worked-example numbers come from that run's own artefacts — vendor run definition and QC report, the matrix itself, and the clustering, labelling and deliverable backups. Every source file is named in the same header comment.</p>
<p>The payloads behind the moving dots are real records, not shapes. Two of them deliberately show nothing, because nothing is what exists.</p>
<p>Row 4 is ground-truth-blind end to end and leak-scanned per leaf. The sealed key opens only at the scoring step, drawn off the line.</p>`,
  cond:`<p class="cond">The governing fact of row 3 is that a threshold printed in Methods is not evidence it was applied. Tested against their own releases, four datasets disagree with their own published QC: one screen shipped without its hash filters, one atlas shipped pre-QC with a mitochondrial filter matching zero genes, one shipped an undocumented UMI floor and no mitochondrial filter at all, and the worked example keeps cells below its own knee.</p>
<p class="cond">Three things are missing rather than wrong, and missing everywhere: the raw reads, the unfiltered barcode matrix, and any per-stage drop count. No dataset in this corpus ships a cull ledger, so every retention figure on this map is a ratio between two objects rather than a sum over stages.</p>
<p class="cond">Four things are wrong and fixable in our own pipeline. The core labeller prompt names the wrong dataset on every leaf. The leaf briefing has a markers-down slot that is empty on every leaf. A compound is misspelled in one metadata column and not another. And the fish line is disputed between two of our own documents.</p>
<p class="cond">Two are open decisions rather than defects: whether cell-type identity or anatomical region is the primary axis, and whether a merge threshold validated on seven cases transfers.</p>`
};

/* Steps with no record of what was actually done on the worked example. The
   arraying and the exposure window were dropped from this set: plate format,
   dose and window are confirmed by the design spec and, for the plate,
   independently by the vendor's own barcode-set description. What remains is
   genuinely undocumented — the breeding steps, the Echo dispense, the
   dissociation, and library prep. */
const UNVERIFIED = new Set(["A1","A2","A3","P3","A6","B8a","B9a","C1","C2","Sa"]);

/* ============================================================
   OFFSETS — fine positioning, applied straight after layoutRows().
   Authored by dragging in the page's own "Edit positions" mode and pasted
   back here. Everything in this table is a NUDGE relative to what the lane
   engine computed, never an absolute coordinate, so re-solving a lane or
   inserting a step carries these along instead of fighting them.
     dx, dy    move the object, in world units
     ldx, ldy  move its name, on top of whatever lab:{} the node carries
   ============================================================ */
const OFFSETS = {
  /* row 2: /molecular_pipe's layout, SHRUNK, STRAIGHTENED AND PACKED 2026-09-15.
     Every station is Harsha's size times a factor — 0.68 for B1 and B6, 0.54
     for the lens stations B8, B8a, C1 and C2, 0.45 for B2, B4, B5 and B7 (the
     lens rows and racks), 0.48 for B3, 0.56 for Sa, and 0.43 for B9a and C3,
     whose footprints were mostly empty ground — and
     every station sits on the row line. Then each is packed against the ones
     before it by its real silhouette: a pixel mask of everything it draws,
     sampled across a full animation cycle, slid back along the row until it
     clears its neighbours' by 0.05 units, with at least 0.3 between
     footprints so every track still shows. Tops may tuck behind a neighbour, as
     row 1's do; nothing touches. Label nudges scale with their station.
     Harsha's unshrunk layout is /molecular_pipe's own record; snapshots in
     /data/backups/pipeline_port_2026-09-15/. */
  THW: {dx:-29.45, dy:0, ldx:-2.35, ldy:2.01, dw:-0.8, dd:-0.58, dh:-0.21},
  R1p: {dx:-32.15, dy:0, ldx:-0.51, ldy:-1.77, dw:0.21, dd:0.55, dh:-0.24},
  B1:  {dx:-31.81, dy:0, ldx:-0.43, ldy:-2.02, dw:0.12, dd:0.02, dh:-0.16},
  R2p: {dx:-31.79, dy:0, ldx:-0.72, ldy:-1.43, dw:0.09, dd:0.26, dh:-0.21},
  B2:  {dx:-30.32, dy:0, ldx:-0.31, ldy:-1.44, dw:-0.76, dd:-0.24, dh:-0.16},
  R3p: {dx:-29.03, dy:0, ldx:-0.54, ldy:-2.52, dw:-0.46, dd:-0.37, dh:-0.13},
  SB:  {dx:-27.19, dy:0, ldx:0.31, ldy:-1.42, dw:-0.47, dd:-0.47, dh:-0.3},
  CAP: {dx:-27.48, dy:0, ldx:0.38, ldy:-1.28, dw:-0.14, dd:-0.06, dh:-0.2},
  AMP: {dx:-26.86, dy:0, ldx:-0.41, ldy:-1.22, dw:-0.16, dd:-0.38, dh:-0.18},
  SZD: {dx:-27.01, dy:0, ldx:-0.17, ldy:-0.78, dw:1.01, dd:1.81, dh:-0.23},
  FRG: {dx:-26.1, dy:0, ldx:-0.3, ldy:-1.28, dw:-0.33, dd:-0.33, dh:-0.38},
  R4p: {dx:-25.86, dy:0, ldx:-0.22, ldy:-1.22, dw:-0.33, dd:-0.33, dh:-0.19},
  LIB: {dx:-26.49, dy:0, ldx:-1, ldy:3.06, dw:1.03, dd:1.83, dh:-0.2},
  RCY: {dx:-26.22, dy:0, dw:-0.31, dd:0.07, dh:-0.3},
  /* row 3: /FASTQ_pipe's shared record (FASTQ_pipe::edits, saved 2026-08-30),
     byte-identical, keyed to this map — that page's E6 is this map's DD. Its
     G3a, G1b and G3b keys name nothing on either page and are left out, as
     are its band keys; this map sizes its own bands. */
  FQ:  {dx:-28.27, dy:-8.8, ldx:1.05, ldy:5.05, dw:-0.65, dd:7.9},
  E2:  {dx:-30.48, dy:-9.25, ldx:2.2, ldy:0.25},
  E4:  {dx:-19.61, dy:-6.14, ldx:-3.45, ldy:0.85, dw:6.75, dd:6.1},
  E5:  {dx:-12.61, dy:-6.03, ldx:-3.9, ldy:0.85, dw:6.45, dd:6.1},
  E3:  {dx:-26.39, dy:-6.77, ldx:-6, ldy:9.55, dw:0.4, dd:1.45},
  G1:  {dx:-25.69, dy:-9.79, ldx:-2.2, ldy:-1.7, dw:-1.75, dd:-2.9},
  G2:  {dx:-30.91, dy:-5.86, ldx:-2.15, ldy:-1.75, dw:-1.45, dd:-2.95},
  G2b: {dx:-18.98, dy:-5.92, ldx:3.2, ldy:-4.3, dw:-0.55, dd:-1.15},
  W1:  {dx:-35.37, dy:-12.2, ldx:7.55, ldy:5},
  DD:  {dx:-8.04, dy:-5.84, ldx:-2.65, ldy:3.25, dw:-3.1, dd:2.1},
  UD:  {dx:-9.72, dy:-5.47, ldx:1.8, ldy:1.5, dw:-3.05, dd:-5.75},
  G3:  {del:true},
  CB:  {dx:-5.2, dy:-5.88, ldx:0.6, ldy:0.1, dw:1.4, dd:1.35},
  G4:  {dx:-23.16, dy:-3.05, ldx:2.7, ldy:-2.65, dw:-1.25, dd:-0.9},
};

/* ============================================================
   TEXT — wording overrides, applied before anything is drawn.
   Authored in the page's "Edit text" mode and pasted back here. Only
   what has actually been changed appears; everything else reads from the
   node, band and OVERVIEW definitions above.
     nodes:{ <id>:{ name, sub, stat, group, does, built, cond } }
     bands:{ <index>: "ROW TITLE" }
     overview:{ title, sub, eyebrow, does, built, cond }
   ============================================================ */
const TEXT = {
};
