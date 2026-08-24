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
const R1=0, R2=13.6, R3=27.2, R4=40.8, R5=54.4;

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
{id:"B0", key:"B1", group:"In situ barcoding", shape:"tile", name:"Thaw, count, dilute", x:0.7, y:R2, lane:"r2", w:0.72, d:0.72, h:0.44,
 sub:"37C thaw · haemocytometer · loading table",
 does:"Fixed material comes back out of the freezer, is thawed until the last ice crystal goes, counted, and diluted to the concentration the loading table demands. The count taken here decides how many cells enter each round-one well, and therefore how crowded the whole run will be.",
 built:"Section 1.1. Thaw in a 37C water bath, mix, count on a haemocytometer, record the count into the Evercode WT Sample Loading Table v2, dilute with Sample Dilution Buffer, then proceed immediately to round one — the manual gives no stopping point here. The Round 1 Plate thaws alongside, 10 minutes at 25C. The loading table is filled in beforehand and tells you which sample goes in which well; the counts are what get written into it now.",
 cond:"The loading table — not any dispensing sheet — is what the barcodes physically encode, so it is the authority on which drug a cell saw. The run definition carries 44 sample entries against 48 loaded wells and 43 distinct samples reach the matrix; the 48 to 44 to 43 attrition is undocumented at every step. No cell count from this step survives on this instance, so the loading density that sets the collision rate six boxes downstream cannot be recovered."},
{id:"R1p", key:"B2", group:"In situ barcoding", shape:"miniplate", name:"Round 1 — reverse transcription", x:2.6, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:4,
 sub:"48 wells · 96 barcodes · sample identity",
 does:"Each well gets its own barcoded primer and RNA is reverse transcribed inside the intact cell. This round carries sample identity — everything the dataset knows about which drug a cell saw is written here, in the first chemical step.",
 built:"Section 1.2. In situ reverse transcription on a 48-well round-one layout (rows A to D, columns 1 to 12), barcode set n141_R1_v3_8. Two barcodes per well, 96 in total: the manual says each well is primed both with oligo dT and with random hexamers, and the run definition records only the counts. 14 microlitres of diluted sample per well, a fresh tip for every well. sample_bc_rounds = 1: round one and only round one carries sample identity.",
 cond:"Clean, and structurally the strongest link on the map — sample identity is written in a chemical step rather than carried in a spreadsheet, so there is no demultiplex cull downstream. The hashed designs in the corpus pay for that convenience with a whole extra QC stage."},
{id:"B1", key:"B3", group:"In situ barcoding", shape:"tile", name:"Pool and split", x:4.2, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3,
 sub:"shuffle the deck",
 does:"Every well is pooled into one tube and redistributed at random across the next plate. The randomisation is the whole trick: after this, well position carries no information.",
 built:"Section 1.2, closing steps — pool, centrifuge, resuspend, load the round two plate.", cond:"Clean."},
{id:"R2p", key:"B4", group:"In situ barcoding", shape:"miniplate", name:"Round 2 — ligation", x:5.8, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:8,
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
  {id:"FXc", carried:"FX", lane:"r2", x:0.7, anchor:true, groupMark:true},
  {id:"UDc", carried:"UD", lane:"r4", x:0.7, anchor:true, groupMark:true},
  {id:"FDc", carried:"FD", lane:"r5", x:0.7, anchor:true, groupMark:true},
];

const LANES = [
  {id:"r1-bio",   y:R1-2.0,   x0:-1.30, x1:9.00, dir:+1},
  {id:"r1-chem",  y:R1+2.0,   x0:-1.00, x1:8.50, dir:+1},
  {id:"r1-tail",  y:R1,       x0: 9.85, x1:23.40, dir:+1},
  {id:"r2",       y:R2,       x0:0.7,  x1:22.0,  dir:+1},
  {id:"r3",       y:R3,       x0:0.7,  x1:22.0,  dir:+1},
  {id:"r4",       y:R4,       x0:0.7,  x1:31.0,  dir:+1},
  {id:"r5",       y:R5,       x0:0.7,  x1:24.0,  dir:+1},
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
  {a:"FXc",b:"B0",kind:"susp"},{a:"B0",b:"R1p",kind:"susp"},{a:"R1p",b:"B1",kind:"susp"},{a:"B1",b:"R2p",kind:"susp"},
  {a:"R2p",b:"B2",kind:"susp"},{a:"B2",b:"R3p",kind:"susp"},{a:"R3p",b:"SB",kind:"susp"},
  {a:"SB",b:"CAP",kind:"lib"},{a:"CAP",b:"QCD",kind:"lib"},{a:"QCD",b:"FRG",kind:"lib"},
  {a:"FRG",b:"R4p",kind:"lib"},{a:"R4p",b:"LIB",kind:"lib"},{a:"LIB",b:"SEQ",kind:"lib"},

  {a:"FQ",b:"cb1",kind:"read"},{a:"cb1",b:"cb2",kind:"read"},{a:"cb2",b:"IN",kind:"read"},
  {a:"IN",b:"cb3",kind:"read"},{a:"cb3",b:"cb4",kind:"cell"},{a:"cb4",b:"UD",kind:"cell"},
  {a:"E",b:"cb2",kind:"ref",dash:true},{a:"UTR",b:"cb2",kind:"ref",dash:true},
  {a:"V",b:"cb2",kind:"ref",dash:true},{a:"W",b:"cb4",kind:"meta",dash:true},
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
const BAND_X=[[-2,24],[-2,24],[-2,24],[-2,33],[-2,26]];
const BANDS = [R1,R2,R3,R4,R5].map((r,i)=>({
  name:["Biological samples","Molecular biology","Reads to a matrix","The cull","Opinionated metadata"][i],
  x0:BAND_X[i][0], x1:BAND_X[i][1], y0:r+BAND_H[0], y1:r+BAND_H[1]
}));

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
<p>Five rows, and <mark>every one of them reads left to right</mark>. No track runs between them: they are stacked in the order things happen, so one feeding the next is already said by where they sit. Instead <mark>each row opens with the object it inherits</mark>, drawn again at half weight — the fixed material, the unfiltered matrix, the filtered matrix. It is the same object as the one the row above ends with, not a second one. Top row is oldest.</p>
<p><mark>Row 1 — the fish, and the compounds.</mark> The only row where biology is being done rather than described, and the only one that forks. A biology line runs above the centreline — the colony, the pair, the clutch, the cull — while a chemistry line runs below it, from picking four compounds out of a library through the Echo to a dosed and empty plate. The two are independent and meet exactly once, when the embryos go into wells that already contain compound. Note what feeds each: the biology line starts in our own tanks, while the chemistry line simply begins — nothing feeds it, because the compounds are not ours and the library they came from is not part of this pipeline. After the merge the row runs on to the choice that governs everything downstream — whole cells, or nuclei.</p>
<p><mark>Row 2 — the chemistry.</mark> Four rounds of barcoding, library prep, three and a half billion reads. One of four assay families the corpus uses.</p>
<p><mark>Row 3 — reads to a matrix.</mark> Barcode calling, alignment, UMI collapse, and the counting reference hanging off the steps that read it. It ends at a cube of every barcode against every gene — almost never delivered, and the reason the funnel below it has no counts.</p>
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
const UNVERIFIED = new Set(["A1","A2","A3","P3","A6","B9","C1","C2"]);

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
