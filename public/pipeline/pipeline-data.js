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
   FOUR ROWS, SNAKING. Odd rows run one way, even rows the other,
   turning a corner at the end of each. Row gaps are equalised by eye,
   not by grid units, because rows 3 and 4 carry side structures.
     row 1  y= 0   the fish          →
     row 2  y=12   the chemistry     ←
     row 3  y=24   the matrix        →
     row 4  y=36   the labelling     ←
   x values below are seed order only — layoutRows() recomputes them.
   ============================================================ */
const R1=0, R2=13.6, R3=27.2, R4=40.8;

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
{id:"CS", key:"P1", group:"The compounds", shape:"whiteboard", name:"Compound selection", x:1.0, y:R1, w:2.0, d:1.4, h:1.2,
 lane:"r1-chem",
 sub:"4 picked from ~147,025",
 does:"Somebody decides what the experiment is about. Four compounds are chosen out of the SPARC library — 0.1% DMSO as the vehicle, sorafenib as the anti-angiogenic positive control, orlistat and dapagliflozin as the two unknowns — and written into a cherry-picking layout. Everything the finished atlas can possibly say about drug effect is bounded here, before any of it exists.",
 built:"A cherry-picking layout drawn against the SPARC BioCentre compound library, roughly 147,025 compounds. Four selected, twelve replicate wells each.",
 cond:"This is the only step on the whole map where a human decides what the question is, and it is the one step with no artefact behind it at all. Nothing in the pipeline records why these four — why sorafenib rather than another VEGFR inhibitor, why orlistat and dapagliflozin as the unknowns, what was considered and dropped. The choice is legible in the object as four values in one column, and the reasoning is nowhere. Every downstream claim about mechanism inherits it."},

{id:"LIBR", key:"P2", group:"The compounds", shape:"library", name:"The library", x:2.5, y:R1, w:2.2, d:1.5, h:1.5,
 lane:"r1-chem",
 sub:"~147,025 compounds · SPARC BioCentre",
 does:"The shelf the four came off. A screening library of roughly 147,025 compounds, held at the SPARC BioCentre and shared across everyone who books time there. Four are pulled; the rest of the wall is the part of the experiment that was never run.",
 built:"External to this company and to this pipeline — nothing on this map produced it, and nothing on this map constrains what is in it. The four picked keep their colour from here all the way to the wells: vehicle, positive control, and the two unknowns.",
 cond:"Four out of 147,025 is a selection ratio of about one in 36,800, and the map has no artefact recording how that cut was made. That is the same gap the selection step carries, seen from the other side: what is on this wall bounds everything the finished atlas can say about mechanism, and the reasoning that narrowed it is written down nowhere. The molecules drawn here are schematic — deliberately not depictions of sorafenib, orlistat or dapagliflozin, because an approximate structure under a real compound name would be worse than an honest generic one."},

{id:"ECHO", key:"P3", group:"The compounds", shape:"echodispense", name:"Echo 650 dispense", x:8.5, y:R1, w:1.5, d:1.15, h:0.9,
 lane:"r1-chem",
 sub:"SPARC BioCentre · acoustic, from the cherry-picking layout",
 does:"Compound is fired into an empty 48-well plate without anything touching it. The destination plate is held inverted above the source and 2.5 nL droplets are launched upward into it, hundreds a second, held in place by surface tension until the plate is righted. Tipless and non-contact, so there is no carryover between wells and no tip waste. Because every well is addressed individually from a layout file, the cherry-picking sheet is not a pipetting plan — it is the treatment axis of the finished dataset, written down before a single fish exists.",
 built:"A Beckman Echo 650 at the SPARC BioCentre, SickKids, 686 Bay Street, Toronto. Four compounds into a 48-well destination: 0.1% DMSO vehicle, sorafenib as the anti-angiogenic positive control, orlistat and dapagliflozin as the two unknowns, twelve replicate wells each. The plate is dosed and then left; the embryos arrive later.",
 cond:"The cherry-picking sheet and the sample loading table disagree, and the disagreement starts here. This sheet is where treatment assignment first exists; the loading table is what the barcodes physically encode. Until the two are reconciled nothing downstream is trustworthy at treatment level, and neither sheet is on this instance, so it cannot be settled from here. Three more things about this step are unrecorded and are open questions for the bench: the actual transfer volume per well — 1 µM is in the design document and in no column of the object, and at 2.5 nL a droplet it is hundreds of droplets a well; whether the compound went in dry or into medium; and how long the plate then sat dosed before the embryos arrived. That last one is a real experimental variable — DMSO is hygroscopic and nanolitre volumes evaporate — and this map currently implies it was zero, because nothing records otherwise."},

{id:"A4", key:"A4", group:"The experiment", shape:"arrayplate", name:"Array into the dosed plate", x:13.4, y:R1, w:1.5, d:1.15, h:0.3,
 lane:"r1-tail",
 sub:"48 wells · 4 × 12 · 6 embryos each, at 24 hpf",
 does:"The experiment itself, and the only place in the pipeline where biology is manipulated. Four vertical bands of twelve replicate wells, compound already in every one of them, and now the fish. Embryos are checked for stage and distributed six to a well, into wells that already contain compound. The fish arrive into the dose — there is no separate dosing step afterwards, and 24 hpf is the moment of arrival rather than the moment of addition.",
 built:"48-well format, 4 conditions × 12 replicate wells, single dose of 1 µM — sorafenib at 1 µM being the lowest concentration that visibly does something in zebrafish (pericardial edema). Every well becomes a sample barcode in round one of the chemistry, so the entire treatment axis of the finished dataset is fixed here. Confirmed for the worked example, not assumed: 48 wells and 6 embryos per well are in the MegaFIN 100k column of the design spec, and split-pipe's own run definition independently agrees — round-one barcode set n141_R1_v3_8 is described as '96 barcodes, 48 wells; rows A-D, cols 1-12'. Note that those are two different plates holding the same 48 samples: the treatment vessel here is a physical 48-well plate, 8 by 6, while the Parse round-one plate a row down lays the same samples out 12 by 4.",
 cond:"The label defect on this plate is specific and checkable: obs['sample'] misspells the compound as Dapaglifozan while obs['perturbation'] spells it Dapagliflozin, and the dose is recorded nowhere in the object or the vendor report — 1 µM comes from the design document alone. 48 wells were loaded; 43 samples reach the object. The five missing wells are unexplained by any artefact here. Pooling embryos per well is a design choice with a cost — Zebrahub took the opposite one and optimised its dissociation specifically to avoid pooling, so every cell there traces to a named individual fish. Whether this arraying was done by hand or with a multichannel is not recorded either, and it bears on how tightly the six-per-well count actually held. Six embryos per well also means embryo identity is destroyed here, at the moment of arraying, and not later: the embryos never leave this well again. The design spec's speculative obs schema lists an embryo column as a batch covariate; that column does not exist in the delivered object and never could have. ZSCAPE and ChemFish keep per-embryo identity by hashing the nuclei instead, which is why they can model per-embryo variance and this design cannot."},
{id:"A5", key:"A5", group:"The experiment", shape:"incubator", name:"Incubate to 48 hpf", x:14.7, y:R1, w:2.0, d:1.7, h:1.8, gap:1.25,
 lane:"r1-tail",
 sub:"24 hours of exposure",
 does:"Twenty-four hours in which the drug either does something or does not. This window is the entire causal content of the dataset.",
 built:"Fixed 24→48 hpf window, single collection timepoint — stated in the design spec and used as the confirmed stage by every downstream asset.",
 cond:"No imaging or phenotype scoring in this window, so a transcriptomic result cannot be checked against what the embryo visibly did. Incubation temperature is not recorded in any artefact here."},
{id:"A6", key:"A6", group:"Collection", shape:"dissociate", name:"Dissociate", x:17.3, y:R1, w:2.55, d:1.725, h:0.45, gap:0.225,
 lane:"r1-tail",
 sub:"whole cells or nuclei — the fork",
 does:"Embryos are euthanised in the well and the tissue is digested enzymatically into a suspension, then strained. They never leave the well they were arrayed into — there is no collection or pooling event, because the pooling already happened at arraying. The choice made here — intact cells or isolated nuclei — propagates through the entire rest of the map.",
 built:"No protocol detail on this instance for the worked example; reagent, digest time and strainer size are recorded nowhere. Across the corpus the split is clean: sci-RNA-seq3 runs on PFA-fixed nuclei (ZSCAPE, ChemFish), while 10x, Microwell-seq and Parse all run on whole cells (Zebrahub, CellOracle, MIC-Drop-seq, ZCL2, MiniFin, MegaFin).",
 cond:"The most biased step in the wet lab and the least documented one. Cell types survive dissociation unequally, so atlas composition is partly a report on how tough each tissue is — and the mitochondrial cull two rows down then deletes the ones most stressed by it. The nuclei-or-cells fork is not a detail: nuclear transcripts are intron-rich, so it changes what the intron-handling stage on row 3 does, and it changes what a mitochondrial fraction even means."},

{id:"FX", key:"2", group:"② Fixed material", groupMark:true, anchor:true, shape:"vials",
 lane:"r1-tail",
 name:"Fixed material", x:19.4, y:R1, w:2.52, d:1.82, h:0.665, gap:1.705,
 sub:"biology locked · four assay families downstream", stat:"the biology stops here",
 does:"Fixation and permeabilisation stop transcription dead. In combinatorial chemistries this also turns each cell into its own sealed reaction vessel, which is what lets the barcoding work without any microfluidics. It is the last moment on this map at which the sample is alive in any sense.",
 built:"Evercode WT fixation, a proprietary formaldehyde-based solution, for the worked example. Four assay families take it from here across the corpus: combinatorial split-pool on fixed cells (Parse), sci-RNA-seq3 on PFA-fixed nuclei with sci-Plex hashing, droplet 10x Chromium on whole cells, and Microwell-seq with three rounds of split-pool bead synthesis.",
 cond:"Fixation efficiency is not measured per sample anywhere in the corpus. A poorly fixed well contributes ambient RNA rather than cells, and because no per-stage drop count survives from any QC chain, that surfaces only as an unexplained low yield with no way to attribute it."},

/* ================= ROW 2 — THE CHEMISTRY ================= */
{id:"B0", key:"B1", group:"Combinatorial barcoding", shape:"tile", name:"Count and loading table", x:0.7, y:R2, lane:"r2", w:0.72, d:0.72, h:0.44,
 sub:"finalised before anything starts",
 does:"Cells are counted and the sample loading table is fixed: which sample goes in which round-one well, at what concentration. The kit does not let you improvise later.",
 built:"Sample loading table, completed in advance. The run definition carries 44 sample entries against 48 loaded wells; 43 distinct samples reach the matrix.",
 cond:"This table — not any dispensing sheet — is what the barcodes physically encode, so it is the authority on which drug a cell saw. The 48 → 44 → 43 attrition across the three artefacts is undocumented at every step."},
{id:"R1p", key:"B2", group:"Combinatorial barcoding", shape:"miniplate", name:"Round 1 — reverse transcription", x:2.6, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:4,
 sub:"48 wells · 96 barcodes · sample identity",
 does:"Each well gets its own barcoded primer and RNA is reverse transcribed inside the intact cell. This round carries sample identity — everything the dataset knows about which drug a cell saw is written here, in the first chemical step.",
 built:"In-situ RT on a 48-well round-one layout (rows A–D, cols 1–12), barcode set n141_R1_v3_8. Two barcodes per well, 96 in total — the Evercode explanation being that each well is primed both with poly-dT and with random hexamers, though the run definition records only the counts. sample_bc_rounds = 1: round one and only round one carries sample identity.",
 cond:"Clean, and structurally the strongest link on the map — sample identity is written in a chemical step rather than carried in a spreadsheet, so there is no demultiplex cull downstream. The hashed designs pay for that convenience with a whole extra QC stage."},
{id:"B1", key:"B3", group:"Combinatorial barcoding", shape:"tile", name:"Pool and split", x:4.2, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3,
 sub:"shuffle the deck",
 does:"Every well is pooled into one tube and redistributed at random across the next plate. The randomisation is the whole trick: after this, well position carries no information.",
 built:"Pool, mix, redistribute.", cond:"Clean."},
{id:"R2p", key:"B4", group:"Combinatorial barcoding", shape:"miniplate", name:"Round 2 — ligation", x:5.8, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · barcode set v1",
 does:"A second barcode is ligated onto the cDNA inside the cell.",
 built:"Ligation in a 96-well plate (rows A–H, cols 1–12), barcode set v1, 96 barcodes across 96 wells — one per well, unlike round one.",
 cond:"Clean."},
{id:"B2", key:"B5", group:"Combinatorial barcoding", shape:"tile", name:"Pool and split", x:7.4, y:R2, lane:"r2", w:0.6, d:0.6, h:0.3,
 sub:"shuffle again",
 does:"Pooled and redistributed a second time.",
 built:"Pool, mix, redistribute.", cond:"Clean."},
{id:"R3p", key:"B6", group:"Combinatorial barcoding", shape:"miniplate", name:"Round 3 — ligation", x:9.0, y:R2, lane:"r2", w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · barcode set R3_v3 + TruSeq R2",
 does:"A third barcode is ligated, carrying the Illumina TruSeq R2 sequence with it. After this round a cell's path through three plates is almost certainly unique — that combination is what will be read as a cell identity, and no droplet was ever involved.",
 built:"Ligation in a third 96-well plate, barcode set R3_v3. The three rounds give 48 × 96 × 96 ≈ 442k addressable paths for roughly 95k cells. Microwell-seq builds its barcode the same way — three rounds of split-pool synthesis, 3 × 6 nt in an 18 nt barcode.",
 cond:"Two cells can still collide on the same path. That residual collision rate is the real doublet source, it is set here by loading density, and it differs per sublibrary — which is exactly why a single global doublet threshold two rows down cannot be right for all eight."},
{id:"SB", key:"B7", group:"Combinatorial barcoding", shape:"tile", name:"Split into sublibraries, lyse", x:10.8, y:R2, lane:"r2", w:0.85, d:0.85, h:0.55,
 sub:"8 sublibraries",
 does:"The pool is divided into sublibraries and only now are the cells lysed. Every sublibrary contains cells from every sample.",
 built:"Eight sublibraries (Sublib1–Sublib8, library IDs LV6001530579 … LV6001530706, submission SO11332). Sublibrary membership becomes a first-class .obs field and survives to the matrix.",
 cond:"The eight are unusually even — 11,152 to 12,656 cells each — so this is not the weak point it looks like. Where they do differ is depth: sequencing saturation runs 0.366 to 0.486 across them, and the per-sample thresholds downstream do not know that."},
{id:"R4p", key:"B8", group:"Combinatorial barcoding", shape:"tile", name:"Round 4 — sublibrary index", x:12.4, y:R2, lane:"r2", w:0.72, d:0.72, h:0.42,
 sub:"applied by PCR, not in-cell",
 does:"The fourth barcode identifies the sublibrary and is added by PCR after lysis. Four barcodes, not three — the read only shows three because the fourth arrives as the Illumina index.",
 built:"UDI plate. Visible in the matrix as the __s1 … __s8 suffix on every cell id.",
 cond:"Clean."},
{id:"B3", key:"B9", group:"Library prep", shape:"tile", name:"cDNA capture and amplify", x:13.9, y:R2, lane:"r2", w:0.72, d:0.72, h:0.44,
 sub:"beads, PCR",
 does:"cDNA is captured on beads and amplified to a workable quantity.",
 built:"Evercode WT protocol. No run-specific record on this instance.",
 cond:"Amplification is where transcript-length and GC bias enter, and it is unmeasured. Nothing was archived from this step."},
{id:"B4", key:"C1", group:"Library prep", shape:"tile", name:"Fragment, repair, A-tail", x:15.4, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"→ sequenceable lengths",
 does:"DNA is fragmented, ends repaired and A-tailed.",
 built:"Evercode WT protocol. No run-specific record on this instance.",
 cond:"Protocol, not transcript. Nothing to check it against."},
{id:"B5", key:"C2", group:"Library prep", shape:"tile", name:"Adapters and index PCR", x:16.9, y:R2, lane:"r2", w:0.72, d:0.72, h:0.4,
 sub:"TruSeq R1 adapter",
 does:"Illumina adapters are ligated and the final index PCR is run.",
 built:"TruSeq R1 adapter to the 5′ end, then indexing. Evercode WT protocol; no run-specific record.",
 cond:"Protocol, not transcript. The index assignment is the only part that can be checked after the fact, and it checks out — eight sublibraries came back."},
{id:"LIB", key:"C3", group:"Library prep", shape:"dish", name:"Sequencing-ready library", x:18.5, y:R2, lane:"r2", w:0.95, d:0.95, h:0.34,
 sub:"eight indexed libraries",
 does:"A tube of adapter-flanked, indexed DNA. Nothing about it looks like a fish any more.",
 built:"Eight libraries, one per sublibrary, QC'd on fragment size and concentration before loading.",
 cond:"No QC trace was archived. What can be recovered after the fact are the base-quality figures from the sequencer, and they are good: cDNA Q30 0.971, barcode Q30 0.955–0.973 across all eight."},

{id:"SEQ", key:"S", group:"The sequencer", shape:"machine",
 lane:"r2",
 name:"Illumina sequencer", x:21.0, y:R2, w:2.2, d:1.4, h:1.0,
 sub:"paired-end · R1 cDNA · R2 barcodes + UMI", stat:"3,655,719,111 reads",
 does:"Reads the library by synthesis. Three and a half billion reads across eight sublibraries, 38,637 reads per called cell on average — heavily oversampled on purpose, because combinatorial barcoding spends reads on barcodes that were never cells.",
 built:"Paired-end. R1 carries the cDNA insert, R2 carries the three in-cell barcodes plus the UMI; the fourth barcode arrives as the sample index. Per-sublibrary read counts run 420.9 M to 491.9 M. Across the corpus: NextSeq 500/2000 and NovaSeq 6000 (ZSCAPE), NovaSeq 6000 (Zebrahub), NextSeq 550 (CellOracle), HiSeq or MGI DNBSEQ-T7 at 150+150 bp (ZCL2).",
 cond:"Run metrics are only partly recoverable. Q30 and valid-barcode fraction survive in the vendor report (0.757 valid barcodes overall), but cluster density, per-lane yield and the lane count are not held anywhere on this instance. That is the norm, not the exception — no dataset in the corpus archives its run metrics alongside its counts."},

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

{id:"FD", key:"5", group:"⑤ Filtered matrix", groupMark:true, anchor:true, shape:"matrix",
 lane:"r3",
 name:"Filtered matrix", x:22.0, y:R3, w:1.55, d:1.55, h:1.55, cells:6, fill:0.62,
 sub:"94,616 × 32,520 · median 3,198 UMI / 1,618 genes", stat:"the cells, as asserted",
 does:"The same gene space, a fraction of the barcodes, dense where the first cube was empty. Everything here has been asserted to be a cell.",
 built:"For the worked example: 94,616 cells × 32,520 genes, raw integer counts, no layers and no embedding. Median 3,198 transcripts and 1,618 genes per cell against a design target above 4,000.",
 cond:"The governing rule for this object is corpus principle 4 — a threshold printed in Methods is never assumed to have been applied to the deposited data. Tested against their own releases, four datasets here disagree with their own Methods: ChemFish shipped one screen without its hash filters, ZCL2 shipped a pre-QC atlas with a mitochondrial filter matching zero genes, CellOracle shipped an undocumented 500-UMI floor and no mitochondrial filter, and the worked example keeps cells below its own knee. DanioCell is the one that verifies exactly — and even there a later format conversion broke the guarantee."},

/* ================= ROW 4 — THE LABELLING ================= */
{id:"s1", key:"D8", group:"Finishing", shape:"tile", name:"Stamp .obs", x:0.7, y:R4, lane:"r4", w:0.68, d:0.68, h:0.4,
 sub:"sample · well · perturbation",
 does:"Joins the sample metadata onto the cells so each one knows what it was treated with.",
 built:"Fourteen obs columns for the worked example: bc1/bc2/bc3_well, cell_id, cell_type, gene_count, mread_count, parse_sample, perturbation, replicate, sample, species, sublibrary, tscp_count.",
 cond:"Inherits the misspelled compound and the absent dose. cell_type is written here too, and it is the string 'unknown' for all 94,616 cells — it stays that way to the end of this map. Principle 6 governs from here on: original gene ids, native labels, stage definitions and perturbation identities are preserved alongside any canonical mapping, never replaced by it."},
{id:"s2", key:"D9", group:"Finishing", shape:"tile", name:"Sibling note", x:2.2, y:R4, lane:"r4", w:0.68, d:0.68, h:0.4,
 sub:"versions, inputs, hashes",
 does:"Writes the provenance that travels beside the object.",
 built:"Carried in uns for the worked example: dataset MiniFIN-100k, genome GRcZ11, kit Evercode WT, pipeline split-pipe v1.7.1, run_date 2026-04-08, source Parse Biosciences.",
 cond:"Six fields, all true, and thinner than it looks — no Ensembl release, no reference checksum, no QC settings, no cell-calling parameters, no intron flag. Everything the reference and cull nodes on the row above had to reconstruct by hand is exactly what these six fields do not say. The corpus standard is stricter: every derived object must carry a reproducible build script and a uns['provenance'] stamp, and superseded objects are retained rather than overwritten."},

{id:"H5", key:"6", group:"⑥ Published object", groupMark:true, anchor:true, shape:"monolith",
 lane:"r4",
 name:"Published object", x:4.6, y:R4, w:2.0, d:2.0, h:1.9,
 sub:"counts, metadata, provenance · no biology", stat:"complete and mute",
 does:"Counts, treatment metadata, provenance. Complete as a measurement and completely mute about biology — nothing in it says what any of these cells are.",
 built:"For the worked example: minifin_filtered.h5ad, 454 MiB, raw integer counts, symbol-native var_names with ENSDARG kept alongside in var['id'].",
 cond:"Two traps live in objects like this. The gene namespace is rarely stated and frequently assumed wrong: the worked example is symbol-native where MegaFin is ENSDARG-native, and Zebrahub was recorded in our own docs as symbols-needing-mapping when ENSDARG ids were in var['gene_ids'] the whole time. And QC columns go stale through conversion — DanioCell's obs carries nUMI, nGene, percent.mt and percent.ribo describing a 36,250-feature universe while X holds 30,121, so a 10% mitochondrial filter passes on obs while the matrix itself reaches 12.86%. A published QC guarantee, broken by a format change."},
{id:"H5b", key:"E1", group:"⑥ Published object", shape:"ghost", follow:{a:"s2",b:"H5"}, name:"Second arm — not built", x:3.4, y:R4-2.5, w:1.2, d:1.2, h:1.2,
 sub:"one arm only, for this run",
 does:"Where the second-annotation object would sit if it existed for this dataset.",
 built:"Nothing to build it from: the arm requires the reads, and they are not on this instance.",
 cond:"Drawn as an outline because it is absent, not because it would be useless. MegaFin Part 1 has such an arm and it diverges sharply from the vendor arm; whether this one would diverge the same way is unknown and currently unknowable here."},

{id:"p1", key:"E2", group:"Building the partition", shape:"tile", name:"Coarse Leiden 0.1", x:7.4, y:R4, lane:"r4", w:0.7, d:0.7, h:0.5,
 sub:"→ 18 compartments",
 does:"A deliberately blunt first pass carving the object into broad compartments. Nothing here is a cell type yet.",
 built:"2,000 HVGs, seurat_v3 flavour on the counts layer, then Leiden at resolution 0.1. Eighteen compartments for the worked example, holding 6 to 28 leaves each.",
 cond:"Runs from raw counts, not from a carried embedding — the worked example has no embedding to carry, and no global batch correction is applied at this stage. That is deliberate: global re-Harmonization was tried on the MegaFin Manual build and coherence collapsed from 0.93 to the 0.48–0.67 range."},
{id:"p2", key:"E3", group:"Building the partition", shape:"tile", name:"Local 2000-HVG recompute", x:8.8, y:R4, lane:"r4", w:0.7, d:0.7, h:0.72,
 sub:"per compartment · seurat_v3 · raw counts",
 does:"The load-bearing trick. Inside each compartment, variable genes are chosen again from scratch, then scaled, re-PCA'd to 50 dimensions and re-neighboured at 15. Genes invisible globally become the axis locally.",
 built:"Per compartment: fresh seurat_v3 2,000-HVG on the counts layer → scale → PCA(50) → 15-NN. random_state 0, held constant across all five internally-clustered datasets rather than tuned per dataset.",
 cond:"Load-bearing for droplet data and arguably skippable for combinatorial, kept on for cross-dataset comparability. The cost of that consistency is unmeasured on any single dataset."},
{id:"p3", key:"E4", group:"Building the partition", shape:"tile", name:"Local Leiden 0.8 → leaves", x:10.2, y:R4, lane:"r4", w:0.7, d:0.7, h:0.62,
 sub:"251 – 342 leaves across five atlases",
 does:"Clusters inside each compartment and assembles one fine-leaf partition. This, not the labeller, decides how fine the answers can possibly be.",
 built:"Leiden 0.8, no nudge needed on the worked example: 267 leaves, median 150 cells, smallest 6 and largest 3,942. Across the corpus the same recipe lands at 251 (ZSCAPE) / 267 (MiniFin) / 270 (DanioCell) / 288 (ChemFish) / 342 (MegaFin), over datasets spanning 55k to 540k cells.",
 cond:"Leaf count being near-invariant to cell count is the strongest generalisation on this row — the recipe finds transcriptional states, not cells. It cuts both ways: 267 leaves from 94,616 cells is finer, relative to cell count, than 288 from 295,000, and 29 of the worked example's leaves fall under 30 cells, small enough that the labeller is told not to trust their fine statistics."},
{id:"p4", key:"E5", group:"Building the partition", shape:"tile", name:"Leaf briefing", x:11.6, y:R4, lane:"r4", w:0.7, d:0.7, h:0.48,
 sub:"GT-blind context object",
 does:"What the labeller sees for each leaf, and nothing else: id, cell count, compartment, embedding centroid, the enriched genes, per-marker log2FC with in- and out-of-cluster prevalence, and a low-n flag. No identity, no published label, no hint.",
 built:"Assembled fresh per cluster and re-sent with the standing instructions. Verified ground-truth-blind: expert labels are loaded only to build the sealed key and never written into this file.",
 cond:"Two gaps worth naming. 265 of 267 leaves carry markers — two carry none and are being asked to be identified from nothing. And the markersDown field exists on every leaf and is empty on every leaf: the briefing has a slot for what a cluster fails to express and it has never once been filled. Absence of a marker is often the discriminating evidence, and the labeller has never been given any."},

{id:"KAS", key:"K", group:"The labeller", shape:"works", name:"DanioType Kasperov", x:14.0, y:R4, lane:"r4", w:2.0, d:2.0, h:1.9,
 sub:"Researcher · Reasoner · Archivist", stat:"de novo, from markers alone",
 does:"Three specialists arguing about one cluster at a time. The Researcher searches the literature against the marker set. The Archivist answers raw-statistics probes on the live matrix so a claim can be checked rather than believed. The Reasoner synthesises, may go round again up to four times, then concludes or abstains. On the worked example, 46 of 267 leaves never reached the Researcher — a distinctiveness gate committed them to a coarse call up front — and of the 221 that did, 91 needed a second round, 37 a third, 7 a fourth and 5 a fifth.",
 built:"run_leaf_v2 (v1.2), gpt-5.4, ground-truth-blind end to end, leak-scanned per leaf. 209 assigns and 58 abstains, zero errors, $15.35 and 5,321 agent-seconds over 21 minutes — about six cents a leaf.",
 cond:"The transferability discipline is the fragile part, and it is already broken in a way nobody noticed. Every one of the 267 prompts in the worked example opens by telling the model it is looking at 'ZSCAPE 48 hpf'. The dataset name is hard-coded in the core prompt instead of coming from the adapter; the dataset it was actually reading is never named to the model. The results validated well anyway — but this is exactly the failure mode the architecture exists to prevent, it survived a full validated run undetected, and nothing in the code would catch it next time."},
{id:"XF", key:"G4", group:"The labeller", shape:"ghost", follow:{a:"KAS",dx:-3.2}, name:"Label transfer — the road not taken", x:10.8, y:R4+2.8, w:0.9, d:0.9, h:0.9,
 sub:"how most of these atlases were labelled",
 does:"The dominant alternative, drawn as an outline because this pipeline deliberately does not do it: instead of calling a cluster from its own markers, project the cells into an already-labelled reference and copy the nearest neighbours' labels across.",
 built:"Four of the seven external atlases here are labelled this way. ChemFish projects into a 1.2 M-cell developmental reference and transfers by majority vote of k=10 approximate nearest neighbours. MIC-Drop-seq transfers from DanioCell, then verifies manually against markers. CellOracle transfers twice — Farrell to a wild-type reference, then that reference to the perturbed samples. ZSCAPE calls its reference arm de novo but annotates perturbed cells by projection.",
 cond:"Transferred labels are not independent evidence about the source atlas — principle 5 — and error propagates across every hop. Two of these chains cannot even be audited: ChemFish's 319-label reference vocabulary is unpublished, and CellOracle's zebrafish labels were never deposited at all, leaving 394,459 cells unlabelled. Transfer is cheap, fast, and faithfully reproduces whatever the reference got wrong. Calling de novo from markers is the expensive choice this pipeline makes on purpose."},
{id:"ST", key:"E7", group:"The labeller", shape:"pylon", follow:{a:"p4",b:"KAS"}, name:"Stats service :5007", x:12.8, y:R4-2.4, w:0.42, d:0.42, h:1.5,
 sub:"grounding",
 does:"Serves real per-cluster statistics so the Archivist can verify a marker claim instead of believing it.",
 built:"minifin_query.service on 127.0.0.1:5007, behind nginx, token-gated, one registered slot per partition. Registration is gated on a mandatory grounding check.",
 cond:"It exists because published marker evidence almost never does. ZSCAPE is the one exception in the corpus — a free-text evidence column naming the genes behind 120 of 151 calls, plus quantitative top markers for 151 subtypes with specificity and q-values. Everywhere else labels arrive with no supporting evidence at all, so a labeller either grounds itself or believes itself. The check matters: on the worked example pdgfrb came back at log2FC 3.005, 75.1% in-cluster, padj 1.09e-155 with sox2 correctly depleted, and the signs flipped the right way on a CNS leaf. It exists because a sibling adapter once returned a clean miss on every symbol it queried."},
{id:"AD", key:"E6", group:"The labeller", shape:"tile", follow:{a:"KAS",dx:-1.0}, name:"Per-dataset adapter", x:13.0, y:R4+2.8, w:0.9, d:0.9, h:0.42,
 sub:"gene scheme · control vote · gate",
 does:"Everything the core is not allowed to know: how gene ids are written, which cells count as controls, what stage the animals were at, and how distinctive a leaf must be before a fine call is allowed.",
 built:"For the worked example: an identity gene map, which is correct there and wrong almost everywhere else; control vote on DMSO (24,837 cells, 26% of the matrix); stage 48 hpf; distinctiveness gate at n_enriched = 15, kept at the core default after checking the dataset's own distribution — median 120 enriched markers per leaf, gate fires on 6.4%, inside the shallow band between ChemFish at 3.5% and ZSCAPE at 7.2%.",
 cond:"The control vote thins the scoring denominator hard: DMSO is a quarter of the cells, so 34 of 267 leaves have no labelled control cell and cannot be scored. Choosing the control is itself a trap — CellOracle has three distinct control tiers, and its injection control is a tyr crispant carrying real Cas9 cuts, not a neutral baseline. Keeping the gate at the default was argued from the distribution rather than tuned to a target rate, but that reasoning lives in a metadata file, not in the code."},
{id:"MENU", key:"E8", group:"The labeller", shape:"tile", follow:{a:"KAS",dx:1.4}, name:"Frozen ZFA menu", x:15.4, y:R4+2.8, w:0.9, d:0.9, h:0.36,
 sub:"3,107 terms · dec9f728",
 does:"A closed ontology vocabulary: one ZFA id per cluster, chosen from a frozen list and no other.",
 built:"zfa_menu.v1.json — 3,107 non-obsolete ZFA terms from the 2026-06-02 release, hashed dec9f7289d7c…, built for the ZSCAPE Commit Gold benchmark on 2026-07-30.",
 cond:"It exists because almost nothing else does. Of the seven external atlases here, six ship free text with no ontology ids — ZSCAPE, ChemFish, DanioCell, ZCL2, MIC-Drop-seq and CellOracle. Zebrahub is the sole exception and ships ZFA identifiers natively, coarse in the full atlas and fine per stage. Without a closed vocabulary two atlases cannot be compared without a human adjudicating synonyms. Note the date: this menu postdates the worked example's run by four weeks, so those calls are free-text cell-type identities scored against an expert's own vocabulary, not against an ontology."},

{id:"m1", key:"E9", group:"Consolidation", shape:"tile", name:"Meta-reasoner", x:17.0, y:R4, lane:"r4", w:0.75, d:0.75, h:0.66,
 sub:"267 leaves → 114 nodes",
 does:"Collapses the fine leaves into a defensible set: merge what is the same thing, set aside what cannot be called, assign a tier to what survives.",
 built:"One GT-blind consolidation pass, compartment-scoped, offline — not a re-run of the labeller. For the worked example: 51 merge nodes plus 63 set aside, 114 in total, all 267 leaves mapped, none orphaned.",
 cond:"It works better than the leaves do. Merged nodes score 0.968 lenient against the sealed key while nodes that stayed single score 0.799, there are zero over-merge misses, and consolidation rescued leaves the labeller had abstained on. The open item is transfer: Prejudice-of-Shape is how this is meant to reach atlases with no ground truth, and it is not validated."},
{id:"m2", key:"F1", group:"Consolidation", shape:"tile", follow:{a:"m1"}, name:"SSMP flag", x:17.0, y:R4+2.7, w:0.8, d:0.8, h:0.34,
 sub:"τ = 0.34 · 7 of 51 flagged",
 does:"Flags merges where the two leaves share no specific marker program — a warning that a merge is cosmetic.",
 built:"Log-IDF shared-core ratio on full differential expression, attached to every merge node. 7 of 51 merge nodes flagged marker-disjoint on the worked example; the lowest sits at 0.231 against a threshold of 0.34.",
 cond:"Advisory only, and τ was validated on one dataset with N = 7. Carrying a seven-sample threshold to a second dataset without re-validating is the kind of quiet borrowing this map exists to make visible. Nobody is required to read the flag either."},
{id:"JU", key:"F2", group:"Consolidation", shape:"pylon", follow:{a:"KAS",b:"m1"}, name:"Sealed key · lenient/strict", x:15.9, y:R4-2.4, w:0.42, d:0.42, h:1.3,
 sub:"27 sets · 73,149 cells",
 does:"Where ground truth finally enters. Expert hand-drawn cell sets, hierarchical and overlapping — a cell can carry up to three — sealed before clustering and opened only to score.",
 built:"Per-leaf multi-label profiles, primary on controls and secondary on all cells, full distribution kept rather than collapsed to a plurality. Scoring is lenient (right lineage) and strict (right depth), never a single number.",
 cond:"Ground truth is thinner and less stable than the phrase suggests. Coverage across the corpus: 27 expert sets over 77% of cells (MiniFin), 4 sets over 9.5% (MegaFin), tissue level only (DanioCell), transferred rather than called and therefore not ground truth at all (ChemFish), none deposited (CellOracle). It also disagrees with itself — ZCL2 ships two published annotations of the same 143 clusters that agree on lineage 135 times out of 143 but on cell type only 113, with two clusters outright swapped. And an authored scheme rarely equals the labels realized in the object: ZSCAPE's workbook documents 36 tissue / 101 broad / 148 sub against a realized 34 / 99 / 156. Any score has to declare which source it scored against."},
{id:"m3", key:"F3", group:"Consolidation", shape:"tile", name:"Assemble the deliverable", x:18.2, y:R4, lane:"r4", w:0.7, d:0.7, h:0.44,
 sub:"JSON, not a column",
 does:"Writes out every leaf's identity, its consolidation node, tier, marker-overlap score and route.",
 built:"schema daniotype_kasperov_run/v1, beside a leaf assignment mapping every cell to its leaf. Tiers are cell_type_sub, cell_type_broad, tissue and self.",
 cond:"That tier ladder is inherited, not invented: it mirrors the four levels realized in ZSCAPE's obs — germ_layer 7, tissue 34, cell_type_broad 99, cell_type_sub 156 — which is the closest thing the field has to a shared depth scale. Other atlases ladder differently: ZCL2 runs cluster 143 → cell_type 41 → cell_lineage 10, Zebrahub coarse 10 → fine 154. A tier name only means something next to the vocabulary it came from."},

{id:"LB", key:"7", group:"⑦ Labelled deliverable", groupMark:true, anchor:true, shape:"strata",
 lane:"r4",
 name:"Labelled deliverable", x:20.2, y:R4, w:2.0, d:2.0, h:1.9,
 sub:"267 leaves named · 114 nodes · every cell reachable", stat:"the first biological claim",
 does:"The same cells as the published object, sorted into named strata. On the worked example: 209 leaves resolved outright, 24 left region-unresolved, 34 subtype-unresolved, and 19 resolved finer than the expert did. Four rows from a fish tank, this is the first object on the map that makes a biological claim.",
 built:"Validated on the sealed key at 0.989 lenient for committed in-ontology calls and 0.904 across all GT-backed leaves; strict agreement 0.524 and 0.478. At node level, 0.989 and 0.916 on 77 GT-backed nodes.",
 cond:"Read the gap between lenient and strict before quoting either. Lineage recovery is expert-level; depth agreement is about half, and most of that gap is an ontology-axis mismatch rather than error — the expert labels the CNS by anatomical region using spatial lassoes, and region is not recoverable from markers, so the labeller says 'region-unresolved' instead of guessing. Which axis becomes primary is an open product decision, flagged rather than defaulted. And there is no labelled matrix: obs['cell_type'] on the published object is still 'unknown' for every cell. Anyone who wants labelled cells joins the deliverable to the leaf assignment themselves."},
{id:"PR", key:"F4", group:"⑦ Labelled deliverable", shape:"tile", name:"PRISM handoff", x:22.2, y:R4, lane:"r4", w:0.8, d:0.8, h:0.55,
 sub:"foundation model",
 does:"Where a labelled atlas stops being an analysis and becomes training data.",
 built:"Reads the deliverable directly. No copy, no re-label.",
 cond:"Principle 7 is why this handoff is possible at all: summary-level biological truths travel better than raw counts. Two of these atlases cannot be concatenated — different feature universes, different intron handling, different mitochondrial definitions — but their marker genes, pseudobulk DE and abundance effects can be compared. The map ends here because past this point the right way to look at the data is no longer a pipeline."},
];


const ROWS=[R1,R2,R3,R4], MIRROR=22.7;

/* Row 1 runs as two parallel lines that meet once. The biology line — colony,
   pair, clutch, cull — sits above the centreline; the chemistry line — the four
   compounds, the Echo, the dosed plate — sits below it. Their spans are solved
   so all three lanes share one gap scale, and so that the cull and the plate
   land on the SAME x: the two merges into the arraying step are then mirror
   images of each other. Membership is explicit rather than inferred from y,
   because two lanes share one row and inferring would interleave them. dir:-1
   mirrors the lane so the map snakes. */
const LANES = [
  {id:"r1-bio",   y:R1-2.0,   x0:-1.30, x1:9.25, dir:+1},
  {id:"r1-chem",  y:R1+2.0,   x0:-1.00, x1:8.75, dir:+1},
  {id:"r1-tail",  y:R1,       x0:10.25, x1:22.00, dir:+1},
  {id:"r2",       y:R2,       x0:0.7,  x1:22.0, dir:-1},
  {id:"r3",       y:R3,       x0:0.7,  x1:22.0, dir:+1},
  {id:"r4",       y:R4,       x0:0.7,  x1:22.0, dir:-1},
];

const EDGES = [
  /* the biology lane */
  {a:"AQ",b:"A1",kind:"fish",straight:true},{a:"A1",b:"A2",kind:"fish"},{a:"A2",b:"A3",kind:"fish"},
  /* the chemistry lane — no incoming edge from the colony on purpose: the
     compounds have nothing to do with our fish, and arrive from off-map */
  {a:"CS",b:"LIBR",kind:"meta"},{a:"LIBR",b:"ECHO",kind:"meta"},
  /* the merge — the embryos go into wells that already hold compound */
  {a:"A3",b:"A4",kind:"fish",straight:true},{a:"ECHO",b:"A4",kind:"meta",straight:true},
  {a:"A4",b:"A5",kind:"fish"},{a:"A5",b:"A6",kind:"fish"},{a:"A6",b:"FX",kind:"fish"},

  {a:"B0",b:"R1p",kind:"susp"},{a:"R1p",b:"B1",kind:"susp"},{a:"B1",b:"R2p",kind:"susp"},
  {a:"R2p",b:"B2",kind:"susp"},{a:"B2",b:"R3p",kind:"susp"},{a:"R3p",b:"SB",kind:"susp"},
  {a:"SB",b:"R4p",kind:"lib"},{a:"R4p",b:"B3",kind:"lib"},{a:"B3",b:"B4",kind:"lib"},
  {a:"B4",b:"B5",kind:"lib"},{a:"B5",b:"LIB",kind:"lib"},{a:"LIB",b:"SEQ",kind:"lib"},

  {a:"FQ",b:"cb1",kind:"read"},{a:"cb1",b:"cb2",kind:"read"},{a:"cb2",b:"IN",kind:"read"},
  {a:"IN",b:"cb3",kind:"read"},{a:"cb3",b:"cb4",kind:"cell"},{a:"cb4",b:"UD",kind:"cell"},
  {a:"E",b:"cb2",kind:"ref",dash:true},{a:"UTR",b:"cb2",kind:"ref",dash:true},
  {a:"V",b:"cb2",kind:"ref",dash:true},{a:"W",b:"cb4",kind:"meta",dash:true},
  {a:"UD",b:"c1",kind:"cell"},{a:"c1",b:"c2",kind:"cell"},{a:"c2",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"hx",kind:"cell"},{a:"hx",b:"c5",kind:"cell"},
  {a:"c5",b:"FD",kind:"cell"},
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c4",b:"Q",kind:"drop",dash:true},{a:"hx",b:"Q",kind:"drop",dash:true},

  {a:"s1",b:"s2",kind:"cell"},{a:"s2",b:"H5",kind:"cell"},{a:"H5b",b:"H5",kind:"cell",dash:true},
  {a:"H5",b:"p1",kind:"cell"},{a:"p1",b:"p2",kind:"cell"},{a:"p2",b:"p3",kind:"cell"},{a:"p3",b:"p4",kind:"cell"},
  {a:"p4",b:"KAS",kind:"leaf"},
  {a:"ST",b:"KAS",kind:"stat",dash:true},{a:"AD",b:"KAS",kind:"meta",dash:true},
  {a:"MENU",b:"KAS",kind:"meta",dash:true},{a:"XF",b:"KAS",kind:"call",dash:true},
  {a:"KAS",b:"m1",kind:"call"},{a:"m2",b:"m1",kind:"meta",dash:true},
  {a:"m1",b:"m3",kind:"call"},{a:"m1",b:"JU",kind:"score",dash:true},
  {a:"m3",b:"LB",kind:"call"},{a:"LB",b:"PR",kind:"call"},

  /* the corners */
  {a:"FX",b:"B0",kind:"susp"},
  {a:"SEQ",b:"FQ",kind:"read"},
  {a:"FD",b:"s1",kind:"cell"},
];

/* the four bands — what kind of work each row is.
   All four share the same x0/x1 gridlines, so the four titles line up
   along one diagonal on the bottom-right edge. */
const BAND_W=[-2,24], BAND_H=[-3.8,3.8];
const BANDS = [R1,R2,R3,R4].map((r,i)=>({
  name:["Biological samples","Molecular biology","Bioinformatics pipeline","Opinionated metadata"][i],
  x0:BAND_W[0], x1:BAND_W[1], y0:r+BAND_H[0], y1:r+BAND_H[1]
}));

/* one carry: the map runs out at the end, into everything that comes after */
const CARRIES = [
  /* one carry only: the map runs out at the end, into everything after it.
     The chemistry lane simply begins — it has no incoming line, because the
     compound library is not part of this pipeline and drawing a thread back
     to it implied a handover that does not happen. */
  {x0:-0.6,y0:R4,x1:-4.6,y1:R4, fade:"out", kind:"call",
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
  sub:"four rows · seven landmarks · one claim at the end",
  does:`<p>The end-to-end pipeline behind a zebrafish single-cell atlas, drawn as the shape it takes in general rather than as one run. Where a stage varies by technology the node names the variants; where the corpus disagrees with itself the condition field says so. One run — <mark>MiniFin</mark>, 94,616 cells — is carried throughout as the worked example, because it is the one whose every artefact sits on the instance, and its records are what the moving dots carry.</p>
<p>Four rows, snaking. Each turns a corner at the end and runs back the other way; the dots tell you which direction you are reading. Top row is oldest.</p>
<p><mark>Row 1 — the fish, and the compounds.</mark> The only row where biology is being done rather than described, and the only one that forks. A biology line runs above the centreline — the colony, the pair, the clutch, the cull — while a chemistry line runs below it, from picking four compounds out of a library through the Echo to a dosed and empty plate. The two are independent and meet exactly once, when the embryos go into wells that already contain compound. Note what feeds each: the biology line starts in our own tanks, while the chemistry line simply begins — nothing feeds it, because the compounds are not ours and the library they came from is not part of this pipeline. After the merge the row runs on to the choice that governs everything downstream — whole cells, or nuclei.</p>
<p><mark>Row 2 — the chemistry.</mark> Four rounds of barcoding, library prep, three and a half billion reads. One of four assay families the corpus uses.</p>
<p><mark>Row 3 — the matrix.</mark> Reads to a cube of every barcode, then six culls, then the cells. This is the row where atlases silently stop being comparable, and it says where.</p>
<p><mark>Row 4 — the labelling.</mark> A mute object becomes a named one — de novo, from markers, which is not how most of the atlases here were labelled.</p>
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
