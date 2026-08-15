/* ============================================================
   pipeline-data.js — what the map is ABOUT.
   Owned by the on-instance. Every fact, number, name and payload lives here.
   You can rewrite this file end to end without touching the renderer.

   PROVENANCE OF THE NUMBERS IN THIS FILE
   Everything quoted below was read off an artefact on the instance. The sources,
   in the order the map walks them:

     design + protocol   /data/prism/PRISM/.claude/docs/megafin-dataset.md
                         (MiniFin is the "MegaFIN 100k" run of that spec)
     dataset front door  /data/datasets/raw_datasets/MiniFin/README.md
     Parse run def       .../MiniFin/process/run_proc_def.json      (split-pipe v1.7.1, 2026-04-08)
     Parse QC report     .../MiniFin/all-sample/report/analysis_summary.csv
                                                    analysis_process.json
     the matrix          .../MiniFin/minifin_filtered.h5ad          (94,616 x 32,520)
     Trailmaker QC       /data/scratch/bench/megafin1_processing_settings.txt
                         -> characterization/parse_qc_config.csv    (MegaFin CP01, 93 samples)
     clustering          /data/daniotype_backups/minifin_phaseA_clustering/{_run_stats,metadata,umap}.json
     labelling           /data/daniotype_backups/minifin_phaseA_labelling/{metadata,full_minifin_partial,
                                                                           minifin_phaseA_scores,minifin_node_scores}.json
     deliverable         /data/daniotype_backups/minifin_phaseB_deliverable/{metadata,minifin_final_labelling}.json
     corpus context      /data/daniotype_backups/minifin_to_megafin_handoff/HANDOFF.md
     ZFA menu            /data/scratch/zlabel/datasets/zscape_commit_gold/artifacts/zfa_menu.v1.json

   Where an artefact does NOT exist, the cond field says so rather than
   estimating. Three things the previous version asserted are simply not held
   on this instance and are now marked as such: the raw FASTQs, the unfiltered
   barcode table, and any per-stage drop count.
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
const R1=0, R2=12, R3=24, R4=36;

const NODES = [

/* ================= ROW 1 — THE FISH ================= */
{id:"AQ", key:"1", group:"① The aquarium", groupMark:true, anchor:true, shape:"tankrack",
 name:"The aquarium", x:1.3, y:R1, w:2.6, d:2.0, h:1.6,
 sub:"recirculating racks · in-house colony", stat:"the colony",
 does:"Every cell in every dataset downstream was in one of these tanks. The colony is the actual capital asset of the company — an atlas is a claim about zebrafish development, and it is only as good as the fish that made it.",
 built:"Recirculating system, standard husbandry. Line is disputed: the MiniFin front door says TU wildtype (and argues GRCz11 is the right reference because GRCz11 was derived from TU); the MegaFin design spec says Tg(fli1:egfp) or Tg(kdrl:egfp) angiogenesis reporters.",
 cond:"Two problems. The line conflict above is unresolved and matters — a fli1:egfp reporter carries a transgene the reference does not. And nothing about tank, clutch or parentage travels with a cell into the h5ad, so a batch effect originating in husbandry is invisible from the data side. Temperature and light cycle are not recorded in any artefact here; the usual 28.5 °C / 14:10 is an assumption, not a reading."},
{id:"A1", key:"A1", group:"Breeding", shape:"tile", name:"Pair set in the evening", x:4.3, y:R1, w:0.72, d:0.72, h:0.45,
 sub:"male and female, divider in",
 does:"A male and a female go into a breeding tank the night before with a divider between them. Spawning is triggered by pulling the divider at first light.",
 built:"Standard pairwise crossing.",
 cond:"No bench record on this instance. This is the generic protocol, not a transcript of what Patrick did, and there is no artefact that would let anyone check it."},
{id:"A2", key:"A2", group:"Breeding", shape:"dish", name:"The clutch", x:5.7, y:R1, w:1.0, d:1.0, h:0.22,
 sub:"one morning's eggs",
 does:"Fertilised eggs collected within the first hour. Everything downstream is one narrow developmental cohort, which is what makes staging by hours post fertilisation mean anything.",
 built:"Collected, rinsed, held in embryo medium.",
 cond:"No bench record. Clutch identity is not recorded per well and there is no clutch column anywhere in the object, so if two clutches were mixed that difference cannot be recovered later."},
{id:"A3", key:"A3", group:"Breeding", shape:"tile", name:"Cull the unfertilised", x:7.1, y:R1, w:0.72, d:0.72, h:0.4,
 sub:"first quality gate",
 does:"Dead and unfertilised eggs are removed under a scope. The first cull on the whole map happens here, by hand, with a pipette.",
 built:"Visual screen.",
 cond:"No bench record and no count, so the denominator at the very start of the experiment is unknown. Every retention figure further down this map is conditional on a number nobody wrote down."},
{id:"A4", key:"A4", group:"Breeding", shape:"tile", name:"Stage and array", x:8.5, y:R1, w:0.72, d:0.72, h:0.42,
 sub:"6 embryos × 48 wells",
 does:"Embryos are checked for stage and distributed into the treatment plate, six per well, before dosing at 24 hpf.",
 built:"Confirmed, not assumed: 48 wells and 6 embryos per well are in the MegaFIN 100k column of the design spec, and split-pipe's own run definition independently agrees — round-one barcode set n141_R1_v3_8 is described as '96 barcodes, 48 wells; rows A-D, cols 1-12'.",
 cond:"48 wells were loaded; 43 samples reach the object. The five missing wells are unexplained by any artefact here — no failure note, no zero-cell row in the Parse report, nothing. Worth asking Patrick which five and why."},

{id:"PL", key:"2", group:"② The treatment plate", groupMark:true, anchor:true, shape:"plate96",
 name:"The treatment plate", x:10.8, y:R1, w:2.6, d:2.0, h:0.36, cols:12, rows:4,
 sub:"one well = one condition = one future .obs row", stat:"48 wells · 43 recovered",
 does:"The experiment itself, and the only place in the whole pipeline where biology is actually manipulated. Four conditions — 0.1% DMSO vehicle, sorafenib as the anti-angiogenic positive control, orlistat and dapagliflozin as the two unknowns — at twelve replicate wells each. Every well becomes a sample barcode in round one of the Parse chemistry, so the entire treatment axis of the final dataset is decided here, physically.",
 built:"48-well format, 4 conditions × 12 replicate wells, all at a single dose of 1 µM. Sorafenib at 1 µM is the lowest concentration that visibly does something in zebrafish (pericardial edema).",
 cond:"The label defect here is real but smaller and more specific than 'the sheets disagree'. There is no Echo cherry-picking sheet on this instance to compare against, so that claim is retired. What is checkable: obs['sample'] misspells the compound as Dapaglifozan while obs['perturbation'] spells it Dapagliflozin — prefer perturbation. And the dose is recorded nowhere in the object or the Parse report. 1 µM comes from the design document alone."},

{id:"A5", key:"A5", group:"The experiment", shape:"tile", name:"Dose at 24 hpf", x:13.4, y:R1, w:0.72, d:0.72, h:0.5,
 sub:"1 µM · compound into embryo medium",
 does:"Compound goes into the water at 24 hours post fertilisation, when the body plan is laid down but organs are still forming and angiogenesis is active.",
 built:"Single dose, 1 µM for all three compounds; vehicle is 0.1% DMSO. Dosed in medium, absorbed through chorion and skin. Confirmed against the design spec and the dataset front door.",
 cond:"Dose is nominal, not measured. Actual internal exposure is unknown and compound-dependent — orlistat is a lipase inhibitor with poor aqueous behaviour and sorafenib is strongly lipophilic; the same 1 µM in the water is not the same experiment in the embryo. Nothing downstream can distinguish 'the drug did nothing' from 'the drug never got in'."},
{id:"A6", key:"A6", group:"The experiment", shape:"tile", name:"Incubate to 48 hpf", x:14.7, y:R1, w:0.72, d:0.72, h:0.58,
 sub:"24 hours of exposure",
 does:"Twenty-four hours in which the drug either does something or does not. This window is the entire causal content of the dataset.",
 built:"Fixed 24→48 hpf window, single collection timepoint — stated in the design spec and used as the confirmed stage by every downstream asset.",
 cond:"No imaging or phenotype scoring in this window, so a transcriptomic result cannot be checked against what the embryo visibly did — which is a shame, because sorafenib's known 1 µM phenotype is pericardial edema and the transcriptomic result found exactly the cardiomyocyte stress program that would explain it. Incubation temperature is not recorded in any artefact here."},
{id:"A7", key:"A7", group:"Collection", shape:"tile", name:"Collect at 48 hpf", x:16.0, y:R1, w:0.72, d:0.72, h:0.46,
 sub:"euthanise, pool per well",
 does:"Embryos are euthanised and pooled within their well. From here the well is the unit, not the animal.",
 built:"Fixed collection at 48 hpf, single timepoint, confirmed in the design spec and re-confirmed by the Phase-A clustering metadata, which records the stage as protocol-derived rather than guessed.",
 cond:"Six embryos go in, one pool comes out, and embryo identity is destroyed permanently. The design spec's speculative obs schema lists an embryo column as a batch covariate — that column does not exist in the delivered object and never could have. ZSCAPE keeps per-embryo identity via sci-Plex hashing; this design does not, so per-embryo variance cannot be modelled and the twelve replicate wells are the only variance structure available."},
{id:"A8", key:"A8", group:"Collection", shape:"tile", name:"Dissociate", x:17.3, y:R1, w:0.72, d:0.72, h:0.62,
 sub:"tissue → single cells",
 does:"Enzymatic and mechanical dissociation into a single-cell suspension, then strained to remove clumps.",
 built:"No protocol detail on this instance — reagent, digest time and strainer size are not recorded anywhere here. The dataset's stated scientific purpose was partly to validate this dissociation method, which makes the absence of the method conspicuous.",
 cond:"The most biased step in the wet lab and the least documented one. Cell types survive dissociation unequally, so atlas composition is partly a report on how tough each tissue is — and the mitochondrial cull two rows down then deletes the ones most stressed by it. Nothing measures either effect."},

{id:"FX", key:"3", group:"③ Fixed cells", groupMark:true, anchor:true, shape:"vials",
 name:"Fixed cells", x:19.4, y:R1, w:1.8, d:1.5, h:1.0,
 sub:"biology locked · Parse formaldehyde-based fixative", stat:"the biology stops here",
 does:"Fixation and permeabilisation stop transcription dead and turn each cell into its own sealed reaction vessel. This is what lets the Parse chemistry work without any microfluidics — and it is the last moment on this map at which the sample is alive in any sense.",
 built:"Evercode WT fixation, Parse proprietary formaldehyde-based solution. Fixed samples hold for months, which is what allows samples collected on different days to be barcoded together.",
 cond:"Fixation efficiency is not measured per sample. A poorly fixed well contributes ambient RNA rather than cells, and because no per-stage drop count survives from the QC chain, that would surface only as an unexplained low yield with no way to attribute it."},

/* ================= ROW 2 — THE CHEMISTRY ================= */
{id:"B0", key:"B1", group:"Parse barcoding", shape:"tile", name:"Count and loading table", x:0.7, y:R2, w:0.72, d:0.72, h:0.44,
 sub:"finalised before anything starts",
 does:"Cells are counted and the sample loading table is fixed: which sample goes in which round-one well, at what concentration. The kit does not let you improvise later.",
 built:"Parse sample loading table, completed in advance. The run definition carries 44 sample entries against 48 loaded wells; 43 distinct samples reach the matrix.",
 cond:"This table — not any dispensing sheet — is what the barcodes physically encode, so it is the authority on which drug a cell saw. The 48 → 44 → 43 attrition across the three artefacts is undocumented at every step."},
{id:"R1p", key:"B2", group:"Parse barcoding", shape:"miniplate", name:"Round 1 — reverse transcription", x:2.6, y:R2, w:1.0, d:0.8, h:0.3, cols:12, rows:4,
 sub:"48 wells · 96 barcodes · sample identity",
 does:"Each well gets its own barcoded primer and RNA is reverse transcribed inside the intact cell. This round carries sample identity — everything the dataset knows about which drug a cell saw is written here, in the first chemical step.",
 built:"In-situ RT on a 48-well round-one layout (rows A–D, cols 1–12), barcode set n141_R1_v3_8. Two barcodes per well, 96 in total — the Evercode explanation being that each well is primed both with poly-dT and with random hexamers, though the run definition records only the counts, not the priming. The run definition records sample_bc_rounds = 1: round one and only round one carries sample identity.",
 cond:"Clean, and structurally the strongest link on the map — sample identity is written in a chemical step rather than carried in a spreadsheet. It is correct if and only if the loading table was."},
{id:"B1", key:"B3", group:"Parse barcoding", shape:"tile", name:"Pool and split", x:4.2, y:R2, w:0.6, d:0.6, h:0.3,
 sub:"shuffle the deck",
 does:"Every well is pooled into one tube and redistributed at random across the next plate. The randomisation is the whole trick: after this, well position carries no information.",
 built:"Pool, mix, redistribute.", cond:"Clean."},
{id:"R2p", key:"B4", group:"Parse barcoding", shape:"miniplate", name:"Round 2 — ligation", x:5.8, y:R2, w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · barcode set v1",
 does:"A second barcode is ligated onto the cDNA inside the cell.",
 built:"Ligation in a 96-well plate (rows A–H, cols 1–12), barcode set v1, 96 barcodes across 96 wells — one per well, unlike round one.",
 cond:"Clean."},
{id:"B2", key:"B5", group:"Parse barcoding", shape:"tile", name:"Pool and split", x:7.4, y:R2, w:0.6, d:0.6, h:0.3,
 sub:"shuffle again",
 does:"Pooled and redistributed a second time.",
 built:"Pool, mix, redistribute.", cond:"Clean."},
{id:"R3p", key:"B6", group:"Parse barcoding", shape:"miniplate", name:"Round 3 — ligation", x:9.0, y:R2, w:1.0, d:0.8, h:0.3, cols:12, rows:8,
 sub:"96 wells · barcode set R3_v3 + TruSeq R2",
 does:"A third barcode is ligated, carrying the Illumina TruSeq R2 sequence with it. After this round a cell's path through three plates is almost certainly unique — that combination is what will be read as a cell identity, and no droplet was ever involved.",
 built:"Ligation in a third 96-well plate, barcode set R3_v3. The three rounds give 48 × 96 × 96 ≈ 442k addressable paths for roughly 95k cells.",
 cond:"Two cells can still collide on the same path. That residual collision rate is the real doublet source, it is set here by loading density, and it differs per sublibrary — which is exactly why a single global doublet threshold two rows down cannot be right for all eight."},
{id:"SB", key:"B7", group:"Parse barcoding", shape:"tile", name:"Split into sublibraries, lyse", x:10.8, y:R2, w:0.85, d:0.85, h:0.55,
 sub:"8 sublibraries",
 does:"The pool is divided into sublibraries and only now are the cells lysed. Every sublibrary contains cells from every sample.",
 built:"Eight sublibraries, named in the run definition as Sublib1–Sublib8 (library IDs LV6001530579 … LV6001530706, submission SO11332). Sublibrary membership becomes a first-class .obs field and survives to the matrix as sublibrary = 1…8.",
 cond:"The eight are unusually even — 11,152 to 12,656 cells each — so this is not the weak point it looks like. Where they do differ is depth: sequencing saturation runs 0.366 to 0.486 across them, and the per-sample thresholds downstream do not know that."},
{id:"R4p", key:"B8", group:"Parse barcoding", shape:"tile", name:"Round 4 — sublibrary index", x:12.4, y:R2, w:0.72, d:0.72, h:0.42,
 sub:"applied by PCR, not in-cell",
 does:"The fourth barcode identifies the sublibrary and is added by PCR after lysis. Four barcodes, not three — the read only shows three because the fourth arrives as the Illumina index.",
 built:"UDI plate. Visible in the matrix as the __s1 … __s8 suffix on every cell id.",
 cond:"Clean."},
{id:"B3", key:"B9", group:"Library prep", shape:"tile", name:"cDNA capture and amplify", x:13.9, y:R2, w:0.72, d:0.72, h:0.44,
 sub:"beads, PCR",
 does:"cDNA is captured on beads and amplified to a workable quantity.",
 built:"Evercode WT protocol. No run-specific record on this instance.",
 cond:"Amplification is where transcript-length and GC bias enter, and it is unmeasured. Nothing was archived from this step."},
{id:"B4", key:"C1", group:"Library prep", shape:"tile", name:"Fragment, repair, A-tail", x:15.4, y:R2, w:0.72, d:0.72, h:0.4,
 sub:"→ sequenceable lengths",
 does:"DNA is fragmented, ends repaired and A-tailed.",
 built:"Evercode WT protocol. No run-specific record on this instance.",
 cond:"Protocol, not transcript. Nothing to check it against."},
{id:"B5", key:"C2", group:"Library prep", shape:"tile", name:"Adapters and index PCR", x:16.9, y:R2, w:0.72, d:0.72, h:0.4,
 sub:"TruSeq R1 adapter",
 does:"Illumina adapters are ligated and the final index PCR is run.",
 built:"TruSeq R1 adapter to the 5′ end, then indexing. Evercode WT protocol; no run-specific record.",
 cond:"Protocol, not transcript. The index assignment is the only part of this step that can be checked after the fact, and it checks out — eight sublibraries came back."},
{id:"LIB", key:"C3", group:"Library prep", shape:"dish", name:"Sequencing-ready library", x:18.5, y:R2, w:0.95, d:0.95, h:0.34,
 sub:"eight indexed libraries",
 does:"A tube of adapter-flanked, indexed DNA. Nothing about it looks like a fish any more.",
 built:"Eight libraries, one per sublibrary, QC'd on fragment size and concentration before loading.",
 cond:"No QC trace was archived. What can be recovered after the fact are the base-quality figures from the sequencer, and they are good: cDNA Q30 0.971, barcode Q30 0.955–0.973 across all eight."},

{id:"SEQ", key:"S", group:"The sequencer", shape:"machine",
 name:"Illumina sequencer", x:21.0, y:R2, w:2.2, d:1.4, h:1.0,
 sub:"paired-end · R1 cDNA · R2 barcodes + UMI", stat:"3,655,719,111 reads",
 does:"Reads the library by synthesis. Three and a half billion reads across eight sublibraries, 38,637 reads per called cell on average — heavily oversampled on purpose, because combinatorial barcoding wastes reads on barcodes that were never cells.",
 built:"Paired-end. R1 carries the cDNA insert, R2 carries the three in-cell barcodes plus the UMI; the fourth barcode arrives as the sample index. Per-sublibrary read counts run 420.9 M to 491.9 M.",
 cond:"Run metrics are only partly recoverable. Q30 and valid-barcode fraction survive in the Parse report (0.757 valid barcodes overall, 0.739–0.772 per sublibrary), but cluster density, per-lane yield and the lane count itself are not held anywhere on this instance. Earlier versions of this map claimed 512 files across 8 lanes and 3.19 TiB; none of that is supported by an artefact here and it has been withdrawn."},

/* ================= ROW 3 — THE MATRIX ================= */
{id:"FQ", key:"4", group:"④ FASTQ", groupMark:true, anchor:true, shape:"heap",
 name:"FASTQ", x:1.0, y:R3, w:2.7, d:2.7, h:0.7,
 sub:"8 sublibraries · paired-end · not held here", stat:"off-instance",
 does:"The first digital object, and the only genuinely shapeless one. Different sublibraries, different depths, no schema — and nothing in it yet says which barcode is a cell.",
 built:"Sequenced 2026-03/04 and processed in Parse's own cloud workdir: split-pipe's run definition still points at the S3 secondary-workdir path it ran in. The reads themselves are not on this box and no manifest of them is either.",
 cond:"This is the biggest hole on the map. There is no local copy, no checksum list and no size figure — every raw-read claim on this page is downstream of a report Parse produced, not of the reads. Re-deriving anything, including the second annotation arm, means fetching the FASTQs back from Parse first."},
{id:"cb1", key:"C4", group:"Getting to a matrix", shape:"tile", name:"Barcode calling", x:4.2, y:R3, w:0.68, d:0.68, h:0.42,
 sub:"bc1 · bc2 · bc3 + index",
 does:"Reads the three in-cell barcode rounds off R2 and the sublibrary index, and reconstructs which path through the plates each molecule took.",
 built:"split-pipe v1.7.1, chemistry v3, kit WT, run dated 2026-04-08. One process per sublibrary, then a combine.",
 cond:"75.7% of reads carry a valid barcode combination. The other 24.3% are discarded here and never counted again — the first and largest deletion on the digital side, and the one nobody thinks of as a cull."},
{id:"cb2", key:"C5", group:"Getting to a matrix", shape:"tile", name:"Alignment", x:5.9, y:R3, w:0.68, d:0.68, h:0.5,
 sub:"cDNA → gene model",
 does:"Aligns the cDNA read and assigns it to a gene.",
 built:"Aligned against GRCz11 as packaged by Parse. 46.1% of reads map to the transcriptome and the exonic fraction is 63.8% — the Parse report does not state which denominator the exonic figure uses.",
 cond:"A 46% transcriptome mapping rate looks alarming against a 60–70% expectation and is not a failure: GRCz11's 3′ UTRs are systematically under-annotated, so genuine 3′-end reads get called intergenic. The high exonic fraction follows from zebrafish's short introns. Both flags were reviewed and explained — but the explanation lives in a README, not in the pipeline, so the next person will re-panic."},
{id:"cb3", key:"C6", group:"Getting to a matrix", shape:"tile", name:"UMI collapse", x:7.6, y:R3, w:0.68, d:0.68, h:0.4,
 sub:"reads → molecules",
 does:"Collapses duplicate reads sharing a UMI so a count means one molecule, not one read.",
 built:"Standard split-pipe dedup. 3.66 billion reads collapse to 735,624,135 transcripts — sequencing saturation 0.424.",
 cond:"Saturation of 0.42 means roughly four in ten reads were re-observations. That is a reasonable place to stop, but it also means depth is not saturated: the intrinsic-structure work found that read depth alone accounts for about a quarter of MiniFin's cluster resolution."},
{id:"cb4", key:"C7", group:"Getting to a matrix", shape:"tile", name:"Combine sublibraries", x:9.3, y:R3, w:0.68, d:0.68, h:0.45,
 sub:"one index",
 does:"Stitches the eight per-sublibrary matrices into one and stamps each barcode with where it came from.",
 built:"split-pipe mode 'comb'. Cell ids come out as bc1_bc2_bc3__sublibrary — 01_01_05__s1 — so all four barcode rounds stay legible in the index itself.",
 cond:"86.1% of transcripts land inside called cells. The remaining 13.9% is the ambient pool, and it is dropped here rather than kept as a background profile."},
{id:"E", key:"C8", group:"Getting to a matrix", shape:"tile", follow:{a:"cb1",b:"cb2"}, name:"Ensembl reference", x:5.05, y:R3-2.3, w:0.34, d:0.34, h:0.2,
 sub:"32,520 genes · GRCz11 · f919f3e8",
 does:"The gene model the Parse arm assigns against.",
 built:"Genome name GRcZ11, 32,520 genes, identified in the run definition only by its directory UUID f919f3e8-0b98-4482-ab39-ccdf5036854b. Same gene count as MegaFin Part 1's Parse arm.",
 cond:"The Ensembl release is not recorded in the run definition. Release 99 is the working assumption, carried over from the MegaFin fingerprinting work which established Parse's arm as ENSDARG rel-99 — a strong inference from a sibling run, not a fact read off this one. GRCz11 rather than GRCz12 is deliberate and defensible if the line really is TU."},
{id:"V", key:"C9", group:"Getting to a matrix", shape:"tile", follow:{a:"cb2",b:"cb3"}, name:"Lawson V4.3.2 · MegaFin only", x:6.75, y:R3-2.3, w:0.34, d:0.34, h:0.2,
 sub:"36,351 genes · STARsolo arm",
 does:"The better zebrafish annotation, run through our own STARsolo. It is drawn on this row because it belongs to this stage of the pipeline — but it was never run on MiniFin.",
 built:"Held at datasets/zebrafish/references/lawson_v4_3_2/. The one STARsolo arm that exists was built on MegaFin Part 1, and it recovered 345,651 cells against Parse's 540,946 on the same library — 36% fewer, at a much harsher UMI floor (min retained 1,769 vs 232).",
 cond:"Two corrections to what this node used to claim. It is not 'the same cells in a different gene space' — the two arms differ by 195,295 cells, and six of the eight worst-hit samples lose more than 90% of their cells in ours. And a bridge does exist: lawson_to_ensdarg.csv maps 7,238 of 36,351 Lawson genes to ENSDARG, which is 19.9% — enough to compare, nowhere near enough to concatenate. Doing this for MiniFin requires the FASTQs back first."},
{id:"W", key:"D1", group:"Getting to a matrix", shape:"tile", follow:{a:"cb4"}, name:"Well map", x:9.3, y:R3+2.4, w:0.85, d:0.85, h:0.35,
 sub:"bc1 well → sample → compound",
 does:"Carries the treatment plate forward: which round-one well held which sample, and therefore which compound each barcode saw at 24 hpf. It is the only thing on this row that came from the first row rather than from the row above.",
 built:"Comes through the Parse loading table rather than as a separate CSV, and lands in the matrix as four columns: bc1_well (48 values), parse_sample, sample and perturbation (4 values).",
 cond:"The plate id ZEROSHOTCP01 that this node used to carry belongs to MegaFin 1M Plate 1; the 100k run has no plate id in the design spec at all. Two real defects survive: obs['sample'] spells the compound Dapaglifozan, and dose appears in no column. A downstream reader who groups by sample rather than perturbation will silently split dapagliflozin in two."},

{id:"UD", key:"5", group:"⑤ Unfiltered DGE", groupMark:true, anchor:true, shape:"matrix",
 name:"Unfiltered DGE", x:12.2, y:R3, w:2.5, d:2.5, h:2.0, cells:8, fill:0.09,
 sub:"every barcode × 32,520 · not delivered", stat:"never left Parse",
 does:"Every barcode that ever appeared, against every gene. Drawn sparse because it is sparse — almost all of this volume is empty, and most of these barcodes were never cells.",
 built:"Written once inside Parse's pipeline and read by every QC stage there. It was not part of the delivery: all-sample/ on this instance contains report/ and figures/ only, no DGE_unfiltered.",
 cond:"The five numbers that used to sit between this cube and the filtered one — 4,812,144 in, five named deltas out — were invented, and they cannot be replaced, because the object they would be measured against is not here. What is real: 86.1% of transcripts and 86.4% of reads fell inside called cells, so the discarded ambient tail is roughly a seventh of the signal. That tail is also the only place treatment-correlated contamination would show up, and it is gone."},

{id:"c1", key:"D2", group:"The cull", shape:"tile", hatch:true, name:"Cell-vs-background classifier", x:15.4, y:R3, w:0.7, d:0.7, h:0.78,
 sub:"FDR = 0.01", tier:"physics",
 does:"Trailmaker's first QC stage. Classifies each barcode as a cell or as background and removes the background. Not a judgment call, and by volume much the largest cut.",
 built:"Trailmaker step 1-classifier, FDR 0.01. The threshold is identical across all samples in the sibling MegaFin settings file — the only one of the five that is.",
 cond:"No drop count for MiniFin. Trailmaker reports per-sample settings, not per-stage tallies, and the MiniFin settings file is not on this instance at all — only MegaFin CP01's is. The FDR quoted here is MegaFin's, and it is the one number of the five safe to carry across because it never varies."},
{id:"c2", key:"D3", group:"The cull", shape:"tile", hatch:true, name:"Below the per-sample UMI knee", x:16.6, y:R3, w:0.7, d:0.7, h:0.52,
 sub:"knee 232 – 1,370 UMI, per sample", tier:"physics",
 does:"Removes barcodes carrying too few molecules to support any statement about cell type. The threshold is fitted per sample from that sample's own cell-size distribution, not set globally.",
 built:"Trailmaker step 2-cellSizeDistribution, bin step 200. In MegaFin CP01 the fitted knee ranges from 232 to 1,370 UMI across 93 samples — a six-fold spread. split-pipe's own independent estimate for MiniFin is much tighter: 613.7 to 711.2 across the eight sublibraries, 670.4 combined.",
 cond:"Something did not run. The delivered MiniFin matrix has cells down to 294 total transcripts, well below split-pipe's own 670 knee estimate, and its cell count is exactly split-pipe's number_of_cells. The most likely reading is that the delivered h5ad is split-pipe's cell call and Trailmaker's QC chain was applied only to the analysis object, not to what we were given. Worth confirming with Parse before anyone quotes a UMI floor for this dataset."},
{id:"c3", key:"D4", group:"The cull", shape:"tile", hatch:true, name:"Too much mitochondrial RNA", x:17.8, y:R3, w:0.7, d:0.7, h:0.5,
 sub:"0.50 – 1.51% of counts, per sample", tier:"taste",
 does:"Removes cells dominated by mitochondrial transcripts — usually cells stressed or broken during dissociation.",
 built:"Trailmaker step 3-mitochondrialContent, method absoluteThreshold, per-sample maxFraction. In MegaFin CP01 that fraction runs 0.0050 to 0.0151.",
 cond:"Two things to know. First, those cutoffs are startlingly low — around 1% — because Parse's percent.mt counts only the 13 protein-coding mitochondrial genes, not the 37-feature MT contig; measured the contig way the same cells sit near 8%, forty-three times higher. Anyone reusing '1% mito' as a threshold on a differently-defined mito set will delete the entire dataset. Second, the cut is not neutral across cell types: it sits downstream of a dissociation step that stresses tissues unequally, so it preferentially removes the cells a tox study cares about."},
{id:"c4", key:"D5", group:"The cull", shape:"tile", hatch:true, name:"Genes-versus-UMIs spline outliers", x:19.0, y:R3, w:0.7, d:0.7, h:0.62,
 sub:"spline · p ≈ 7e-6 – 1e-3, per sample", tier:"taste",
 does:"Fits genes detected against total counts and removes points sitting too far off the fit — classically two cells that took the same path through the barcode plates.",
 built:"Trailmaker step 4-numGenesVsNumUmis, regression type spline, per-sample p-level. In MegaFin CP01 the p-level spans 6.9e-6 to 1e-3 — more than two orders of magnitude of stringency across one plate.",
 cond:"This runs before the doublet scorer and removes much of what the doublet scorer exists to find, so the two stages are partly redundant and their order decides which one gets the credit. Correcting the order shown here was one of the changes this rewrite made: Trailmaker runs classifier → cell size → mito → spline → doublets, not the order the map used to draw."},
{id:"c5", key:"D6", group:"The cull", shape:"tile", hatch:true, name:"Doublet score", x:20.2, y:R3, w:0.7, d:0.7, h:0.44,
 sub:"p > 0.47 – 0.90, per sample", tier:"taste",
 does:"Scores each barcode for looking like two cells and removes those above the probability threshold.",
 built:"Trailmaker step 5-doubletScores, per-sample probabilityThreshold. In MegaFin CP01 it ranges 0.4686 to 0.9034.",
 cond:"The hard-coded Scrublet rate of 0.034 this node used to quote was wrong twice over: Scrublet is not what ran, and the parameter is not an expected rate but a probability cutoff — and it is fitted per sample, not fixed. The underlying criticism survives and gets sharper: a threshold that swings from 0.47 to 0.90 across one plate is not measuring a constant property, and the true collision rate was set two rows up by how densely the barcode plates were loaded."},
{id:"Q", key:"D7", group:"The cull", shape:"tile", follow:{a:"c4"}, name:"Cull ledger", x:17.8, y:R3+2.6, w:1.2, d:1.2, h:0.3,
 sub:"one row per dropped barcode",
 does:"What the Sankey should be drawn from: which stage killed which barcode, and why.",
 built:"Node and link labels would use the plain-English phrasings on this row, never the internal step names.",
 cond:"Still does not exist, and this rewrite is the proof of why it matters. Reconstructing the five-stage funnel from the artefacts on this instance was impossible — Trailmaker emits settings, not tallies, and the unfiltered matrix was never delivered. A ledger written at the time would have cost nothing and would have made this row measurable instead of merely described."},

{id:"FD", key:"6", group:"⑥ Filtered DGE", groupMark:true, anchor:true, shape:"matrix",
 name:"Filtered DGE", x:22.0, y:R3, w:1.55, d:1.55, h:1.55, cells:6, fill:0.62,
 sub:"94,616 × 32,520 · median 3,198 UMI / 1,618 genes", stat:"94,616 × 32.5k",
 does:"The same gene space, a fraction of the barcodes, dense where the first cube was empty. Everything here has been asserted to be a cell.",
 built:"94,616 cells × 32,520 genes, raw integer counts, no layers and no embedding attached. Per-sublibrary yield 11,152–12,656; median 3,198 transcripts and 1,618 genes per cell, against a design target of over 4,000 UMI.",
 cond:"Two honest caveats. The retention rate this map used to quote — 1.97% of what went in — has no denominator on this instance and is withdrawn. And the spread is wide: cells run from 294 to 599,164 transcripts and from 16 to 18,151 genes, so a 16-gene cell and a 3,300-gene cell are both 'a cell' here on equal footing."},

/* ================= ROW 4 — THE LABELLING ================= */
{id:"s1", key:"D8", group:"Finishing", shape:"tile", name:"Stamp .obs", x:0.7, y:R4, w:0.68, d:0.68, h:0.4,
 sub:"sample · well · perturbation",
 does:"Joins the well map onto the cells so each one knows what it was treated with at 24 hpf.",
 built:"Fourteen obs columns: bc1/bc2/bc3_well, cell_id, cell_type, gene_count, mread_count, parse_sample, perturbation, replicate, sample, species, sublibrary, tscp_count.",
 cond:"Inherits the Dapaglifozan misspelling and the absent dose. cell_type is written here too, and it is the string 'unknown' for all 94,616 cells — it stays that way to the end of this map."},
{id:"s2", key:"D9", group:"Finishing", shape:"tile", name:"Sibling note", x:2.2, y:R4, w:0.68, d:0.68, h:0.4,
 sub:"versions, inputs, hashes",
 does:"Writes the provenance that travels beside the object.",
 built:"Carried in uns rather than a separate file: dataset MiniFIN-100k, genome GRcZ11, kit Evercode WT, pipeline split-pipe v1.7.1, run_date 2026-04-08, source Parse Biosciences.",
 cond:"Six fields, all true, and thinner than it looks — no Ensembl release, no reference checksum, no QC settings, no cell-calling parameters. Everything this map had to reconstruct by hand is exactly what these six fields do not say."},

{id:"H5", key:"7", group:"⑦ Silver object", groupMark:true, anchor:true, shape:"monolith",
 name:"Silver .h5ad", x:4.6, y:R4, w:2.0, d:2.0, h:1.9,
 sub:"minifin_filtered.h5ad · 454 MiB · unlabelled", stat:".h5ad",
 does:"Counts, treatment metadata, provenance. Complete as a measurement and completely mute about biology — nothing in it says what any of these cells are.",
 built:"Raw integer counts, symbol-native var_names (slc35a5, ccdc80 …) with ENSDARG kept alongside in var['id']. No obsm, no layers, no embedding.",
 cond:"The symbol-native var_names are the single most consequential quirk of this object and are recorded nowhere on it. They are the exact inverse of MegaFin, which is ENSDARG-native — and getting that backwards is how the DanioCell adapter once missed every marker it looked for. Everything downstream had to be told."},
{id:"H5b", key:"E1", group:"⑦ Silver object", shape:"ghost", follow:{a:"s2",b:"H5"}, name:"Second arm — not built", x:3.4, y:R4-2.5, w:1.2, d:1.2, h:1.2,
 sub:"MiniFin has one arm only",
 does:"Where the Lawson/STARsolo object would sit if it existed for this dataset.",
 built:"Nothing to build it from: the arm requires the FASTQs, and they are not on this instance.",
 cond:"Drawn as an outline because it is absent, not because it is unusable. MegaFin Part 1 has such an arm and it diverges sharply from the Parse arm; whether MiniFin would diverge the same way is unknown and currently unknowable here."},

{id:"p1", key:"E2", group:"Building the partition", shape:"tile", name:"Coarse Leiden 0.1", x:7.4, y:R4, w:0.7, d:0.7, h:0.5,
 sub:"→ 18 compartments",
 does:"A deliberately blunt first pass carving the object into eighteen broad compartments. Nothing here is a cell type yet.",
 built:"2,000 HVGs, seurat_v3 flavour on the counts layer, then Leiden at resolution 0.1. Compartments hold 6 to 28 leaves each.",
 cond:"Runs from raw counts, not from a carried embedding — MiniFin has no embedding to carry, and no global Harmony is applied at this stage. That is deliberate: global re-Harmonization was tried on the MegaFin Manual build and coherence collapsed from 0.93 to the 0.48–0.67 range."},
{id:"p2", key:"E3", group:"Building the partition", shape:"tile", name:"Local 2000-HVG recompute", x:8.8, y:R4, w:0.7, d:0.7, h:0.72,
 sub:"per compartment · seurat_v3 · raw counts",
 does:"The load-bearing trick. Inside each compartment, variable genes are chosen again from scratch, then scaled, re-PCA'd to 50 dimensions and re-neighboured at 15. Genes invisible globally become the axis locally.",
 built:"Per compartment: fresh seurat_v3 2,000-HVG on the counts layer → scale → PCA(50) → 15-NN. random_state 0, held constant across all five corpus datasets rather than tuned per dataset.",
 cond:"Load-bearing for droplet data and arguably skippable for combinatorial, kept on for cross-dataset comparability. The cost of that consistency is unmeasured on MiniFin specifically."},
{id:"p3", key:"E4", group:"Building the partition", shape:"tile", name:"Local Leiden 0.8 → leaves", x:10.2, y:R4, w:0.7, d:0.7, h:0.62,
 sub:"267 leaves · median 150 cells",
 does:"Clusters inside each compartment and assembles one fine-leaf partition. This, not the labeller, decides how fine the answers can possibly be.",
 built:"Leiden 0.8 first try, no nudge needed. 267 leaves, median 150 cells, smallest 6 and largest 3,942. The corpus lands at 251 (ZSCAPE) / 267 (MiniFin) / 270 (DanioCell) / 288 (ChemFish) / 342 (MegaFin) — leaf count is near-invariant to cell count, because the recipe finds transcriptional states rather than cells.",
 cond:"Near-invariance cuts both ways. MiniFin gets 267 leaves from 94,616 cells where ChemFish gets 288 from 295,000, so MiniFin's leaves are finer relative to its cell count and 29 of them fall under 30 cells — small enough that the labeller is instructed not to trust their fine statistics."},
{id:"p4", key:"E5", group:"Building the partition", shape:"tile", name:"Leaf briefing", x:11.6, y:R4, w:0.7, d:0.7, h:0.48,
 sub:"GT-blind context object",
 does:"What the labeller sees for each leaf, and nothing else: id, cell count, compartment, UMAP centroid, the enriched genes, per-marker log2FC with in- and out-of-cluster prevalence, and a low-n flag. No identity, no published label, no hint.",
 built:"umap.json, assembled fresh per cluster and re-sent with the standing instructions. Verified GT-blind: Patrick's labels are loaded only to build the sealed key and never written into this file.",
 cond:"Two gaps worth naming. 265 of 267 leaves carry markers — two carry none and are being asked to be identified from nothing. And the markersDown field exists on every leaf and is empty on every leaf: the briefing has a slot for what a cluster fails to express, and it has never once been filled. Absence of a marker is often the discriminating evidence, and the labeller has never been given any."},

{id:"KAS", key:"K", group:"The labeller", shape:"works", name:"DanioType Kasperov", x:14.0, y:R4, w:2.0, d:2.0, h:1.9,
 sub:"Researcher · Reasoner · Archivist", stat:"267 leaves · $15.35 · 21 min",
 does:"Three specialists arguing about one cluster at a time. The Researcher searches the literature against the marker set. The Archivist answers raw-statistics probes on the live matrix so a claim can be checked rather than believed. The Reasoner synthesises, may go round again up to four times, then concludes or abstains. On MiniFin: 46 of 267 leaves never reached the Researcher at all — a distinctiveness gate committed them to a coarse call up front — and of the 221 that did, 91 needed a second round, 37 a third, 7 a fourth and 5 a fifth.",
 built:"run_leaf_v2 (v1.2), gpt-5.4, ground-truth-blind end to end, leak-scanned per leaf. 209 assigns and 58 abstains, zero errors, $15.35 and 5,321 agent-seconds over 21 minutes of wall clock — about six cents a leaf.",
 cond:"The transferability discipline is the fragile part, and it is already broken in a way nobody noticed. Every one of the 267 MiniFin prompts opens by telling the model it is looking at 'ZSCAPE 48 hpf'. The dataset name is hard-coded in the core prompt instead of coming from the adapter; MiniFin is never named to the model. The results validated well anyway — but this is exactly the failure mode the architecture exists to prevent, it survived a full validated run undetected, and nothing in the code would catch it next time."},
{id:"ST", key:"E7", group:"The labeller", shape:"pylon", follow:{a:"p4",b:"KAS"}, name:"Stats service :5007", x:12.8, y:R4-2.4, w:0.42, d:0.42, h:1.5,
 sub:"grounding",
 does:"Serves real per-cluster statistics so the Archivist can verify a marker claim instead of believing it.",
 built:"minifin_query.service on 127.0.0.1:5007, behind nginx at /minifin/, token-gated. MiniFin's partition is registered as its own slot, minifin_p0, additively — the live flat-54-cluster minifin slot was left untouched.",
 cond:"Registration was gated on a mandatory grounding check and it passed convincingly: on leaf 0, pdgfrb comes back at log2FC 3.005, 75.1% in-cluster, padj 1.09e-155, while sox2 is correctly depleted — and on CNS leaf 48 the signs flip the right way. That check exists because the DanioCell adapter once returned a clean miss on every symbol it queried. Registering a partition without it is the standing risk."},
{id:"AD", key:"E6", group:"The labeller", shape:"tile", follow:{a:"KAS",dx:-1.0}, name:"Per-dataset adapter", x:13.0, y:R4+2.8, w:0.9, d:0.9, h:0.42,
 sub:"gene scheme · control vote · gate",
 does:"Everything the core is not allowed to know: how gene ids are written, which cells count as controls, what stage the animals were at, and how distinctive a leaf must be before a fine call is allowed.",
 built:"symbol_native_identity_map — an empty symbol map, which is correct here and wrong almost everywhere else. Control vote on DMSO (24,837 cells, 26% of the matrix). Stage 48 hpf. Distinctiveness gate at n_enriched = 15, kept at the core default after checking MiniFin's own distribution: median 120 enriched markers per leaf, gate fires on 6.4%, which sits inside the shallow-Parse band between ChemFish at 3.5% and ZSCAPE at 7.2%.",
 cond:"The control vote thins the scoring denominator hard: DMSO is a quarter of the cells, so 34 of 267 leaves have no labelled control cell at all and cannot be scored, only spot-checked. Keeping the gate at the default was the right call and was argued from the distribution rather than tuned to a target rate — but that reasoning lives in a metadata file, not in the code."},
{id:"MENU", key:"E8", group:"The labeller", shape:"tile", follow:{a:"KAS",dx:1.4}, name:"Frozen ZFA menu · not used here", x:15.4, y:R4+2.8, w:0.9, d:0.9, h:0.36,
 sub:"3,107 terms · dec9f728",
 does:"A closed ontology vocabulary: one ZFA id per cluster, chosen from a frozen list and no other.",
 built:"zfa_menu.v1.json — 3,107 non-obsolete ZFA terms from the 2026-06-02 ZFA release, hashed dec9f7289d7c…, built for the ZSCAPE Commit Gold benchmark on 2026-07-30.",
 cond:"It postdates this run by four weeks and MiniFin never saw it. MiniFin's calls are free-text cell-type identities — 'early mural cell / pericyte progenitor (peri-arterial perivascular mesenchyme)' — scored against Patrick's own 27-set vocabulary, not against an ontology. Drawn here because the menu is where this stage is going, not where it was."},

{id:"m1", key:"E9", group:"Consolidation", shape:"tile", name:"Meta-reasoner", x:17.0, y:R4, w:0.75, d:0.75, h:0.66,
 sub:"267 leaves → 114 nodes",
 does:"Collapses the fine leaves into a defensible set: merge what is the same thing, set aside what cannot be called, assign a tier to what survives.",
 built:"One GT-blind consolidation pass, compartment-scoped, gpt-5.4, offline — not a re-run of the labeller. 51 merge nodes plus 63 set aside, 114 in total, all 267 leaves mapped, none orphaned.",
 cond:"It works better than the leaves do. Merged nodes score 0.968 lenient against the sealed key while the leaves that stayed alone score 0.799, there are zero over-merge misses, and consolidation rescued leaves the labeller had abstained on. The open item is transfer: Prejudice-of-Shape is how this is meant to reach atlases with no ground truth, and it is not validated."},
{id:"m2", key:"F1", group:"Consolidation", shape:"tile", follow:{a:"m1"}, name:"SSMP flag", x:17.0, y:R4+2.7, w:0.8, d:0.8, h:0.34,
 sub:"τ = 0.34 · 7 of 51 flagged",
 does:"Flags merges where the two leaves share no specific marker program — a warning that a merge is cosmetic.",
 built:"Log-IDF shared-core ratio on symbol-native full DE, attached to every merge node. 7 of 51 merge nodes flagged marker-disjoint; the lowest scoring merge on MiniFin sits at 0.231 against a threshold of 0.34.",
 cond:"Advisory only, and τ was validated on ZSCAPE alone with N = 7. Carrying one seven-sample threshold to a second dataset without re-validating is the kind of quiet borrowing this map exists to make visible. Nobody is required to read the flag either."},
{id:"JU", key:"F2", group:"Consolidation", shape:"pylon", follow:{a:"KAS",b:"m1"}, name:"Sealed key · lenient/strict", x:15.9, y:R4-2.4, w:0.42, d:0.42, h:1.3,
 sub:"27 sets · 73,149 cells",
 does:"Where ground truth finally enters. Patrick's 27 hand-drawn Trailmaker cell sets, hierarchical and overlapping — a cell can carry up to three — sealed before clustering and opened only to score.",
 built:"Per-leaf multi-label profiles, primary on DMSO controls and secondary on all cells, full distribution kept rather than collapsed to a plurality. Scoring is lenient (right lineage) and strict (right depth), never a single number.",
 cond:"Sits outside the labelling loop on purpose and stayed outside it — the leak scan came back clean per leaf. The graph judge on :5011 that this node used to describe is real but belongs to the ZSCAPE/ZFA track; MiniFin was never scored by ontology graph distance. And the key is partial: 73,149 of 94,616 cells carry a label, control-vote scoring reaches only 156 of 267 leaves, and 34 leaves have no labelled control cell at all."},
{id:"m3", key:"F3", group:"Consolidation", shape:"tile", name:"Assemble the deliverable", x:18.2, y:R4, w:0.7, d:0.7, h:0.44,
 sub:"JSON, not a column",
 does:"Writes out every leaf's identity, its consolidation node, tier, SSMP score and route.",
 built:"minifin_final_labelling.json, schema daniotype_kasperov_run/v1, beside leaf_assign.csv which maps all 94,616 cells to their leaf. Tiers are cell_type_sub, cell_type_broad, tissue and self.",
 cond:"This is a file next to the matrix, not a column inside it. The two-column ZFA model — final_identity_id under ZFA:0009000 plus final_anatomy_id against the 156-row canonical mapping — is real, but it belongs to the ZSCAPE mapping track. Nothing here was ever written back into the h5ad."},

{id:"LB", key:"8", group:"⑧ Labelled deliverable", groupMark:true, anchor:true, shape:"strata",
 name:"Labelled deliverable", x:20.2, y:R4, w:2.0, d:2.0, h:1.9,
 sub:"267 leaves named · 114 nodes · 94,616 cells reachable", stat:"the first biological claim",
 does:"The same cells as the Silver object, sorted into named strata. 209 leaves resolved outright, 24 left region-unresolved, 34 subtype-unresolved, and 19 resolved finer than the expert did. Four rows from a fish tank, this is the first object on the map that makes a biological claim.",
 built:"Validated on Patrick's sealed key at 0.989 lenient for committed in-ontology calls and 0.904 across all GT-backed leaves; strict agreement is 0.524 and 0.478. At node level: 0.989 and 0.916 on 77 GT-backed nodes.",
 cond:"Read the gap between lenient and strict before quoting either. Lineage recovery is expert-level; depth agreement is about half, and most of that gap is an ontology-axis mismatch rather than error — Patrick labels the CNS by anatomical region using spatial lassoes, and region is not recoverable from markers, so the labeller says 'CNS neuron, region-unresolved' instead of guessing. Which axis becomes primary is an open product decision, flagged rather than defaulted. And there is no labelled .h5ad: obs['cell_type'] on the Silver object is still the string 'unknown' for all 94,616 cells. Anyone who wants labelled cells joins the JSON to leaf_assign.csv themselves."},
{id:"PR", key:"F4", group:"⑧ Labelled deliverable", shape:"tile", name:"PRISM handoff", x:22.2, y:R4, w:0.8, d:0.8, h:0.55,
 sub:"foundation model",
 does:"Where a labelled atlas stops being an analysis and becomes training data.",
 built:"Reads the deliverable directly. No copy, no re-label.",
 cond:"MiniFin is the 100k pilot; the 2.1M-cell MegaFin runs are what PRISM is actually specified against. MiniFin's role in that chain is to be the validated template — the labeller earned its trust here, on the only dataset in the corpus with a 27-set expert key, and spends it on the big ones."},
];


const ROWS=[R1,R2,R3,R4], MIRROR=22.7;

const EDGES = [
  {a:"AQ",b:"A1",kind:"fish"},{a:"A1",b:"A2",kind:"fish"},{a:"A2",b:"A3",kind:"fish"},
  {a:"A3",b:"A4",kind:"fish"},{a:"A4",b:"PL",kind:"fish"},{a:"PL",b:"A5",kind:"fish"},
  {a:"A5",b:"A6",kind:"fish"},{a:"A6",b:"A7",kind:"fish"},{a:"A7",b:"A8",kind:"fish"},{a:"A8",b:"FX",kind:"fish"},

  {a:"B0",b:"R1p",kind:"susp"},{a:"R1p",b:"B1",kind:"susp"},{a:"B1",b:"R2p",kind:"susp"},
  {a:"R2p",b:"B2",kind:"susp"},{a:"B2",b:"R3p",kind:"susp"},{a:"R3p",b:"SB",kind:"susp"},
  {a:"SB",b:"R4p",kind:"lib"},{a:"R4p",b:"B3",kind:"lib"},{a:"B3",b:"B4",kind:"lib"},
  {a:"B4",b:"B5",kind:"lib"},{a:"B5",b:"LIB",kind:"lib"},{a:"LIB",b:"SEQ",kind:"lib"},

  {a:"FQ",b:"cb1",kind:"read"},{a:"cb1",b:"cb2",kind:"read"},{a:"cb2",b:"cb3",kind:"read"},
  {a:"cb3",b:"cb4",kind:"cell"},{a:"cb4",b:"UD",kind:"cell"},
  {a:"E",b:"cb2",kind:"ref",dash:true},{a:"V",b:"cb2",kind:"ref",dash:true},{a:"W",b:"cb4",kind:"meta",dash:true},
  {a:"UD",b:"c1",kind:"cell"},{a:"c1",b:"c2",kind:"cell"},{a:"c2",b:"c3",kind:"cell"},
  {a:"c3",b:"c4",kind:"cell"},{a:"c4",b:"c5",kind:"cell"},{a:"c5",b:"FD",kind:"cell"},
  {a:"c1",b:"Q",kind:"drop",dash:true},{a:"c4",b:"Q",kind:"drop",dash:true},{a:"c5",b:"Q",kind:"drop",dash:true},

  {a:"s1",b:"s2",kind:"cell"},{a:"s2",b:"H5",kind:"cell"},{a:"H5b",b:"H5",kind:"cell",dash:true},
  {a:"H5",b:"p1",kind:"cell"},{a:"p1",b:"p2",kind:"cell"},{a:"p2",b:"p3",kind:"cell"},{a:"p3",b:"p4",kind:"cell"},
  {a:"p4",b:"KAS",kind:"leaf"},
  {a:"ST",b:"KAS",kind:"stat",dash:true},{a:"AD",b:"KAS",kind:"meta",dash:true},{a:"MENU",b:"KAS",kind:"meta",dash:true},
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
const BAND_W=[-2,24], BAND_H=[-2.7,3.3];
const BANDS = [R1,R2,R3,R4].map((r,i)=>({
  name:["Biological samples","Molecular biology","Bioinformatics pipeline","Opinionated metadata"][i],
  x0:BAND_W[0], x1:BAND_W[1], y0:r+BAND_H[0], y1:r+BAND_H[1]
}));

/* one carry: the map runs out at the end, into everything that comes after */
const CARRIES = [
  {x0:-0.6,y0:R4,x1:-4.6,y1:R4, fade:"out", kind:"call",
   from:"PRISM handoff", to:"everything after this map"},
];

/* ============================================================
   PAYLOADS
   These are real records, transcribed from the artefacts named at the top of
   this file. Nothing below is generated: each generator picks one of a handful
   of records actually read off disk. Where a stage's records are NOT on this
   instance — the raw reads, and any dropped barcode — the payload says so
   instead of fabricating a plausible one.
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

/* per-sublibrary rows of all-sample/report/analysis_summary.csv */
const REAL_SUBLIBS = [
 {n:"Sublib1", id:"LV6001530579", cells:12656, reads:420996131, tscp:89158063, sat:0.370, q30:0.972, vbc:0.740, knee:613.7},
 {n:"Sublib4", id:"LV6001530639", cells:11611, reads:491944196, tscp:91763905, sat:0.486, q30:0.972, vbc:0.767, knee:684.5},
 {n:"Sublib6", id:"LV6001530676", cells:11477, reads:470748221, tscp:90973638, sat:0.448, q30:0.970, vbc:0.759, knee:681.1},
 {n:"Sublib7", id:"LV6001530694", cells:11152, reads:486116660, tscp:92322615, sat:0.462, q30:0.971, vbc:0.762, knee:711.2},
];

/* umap.json leaves + their final call in minifin_final_labelling.json */
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
    note:"Reconstructed from the MegaFIN 100k design spec plus the well this cell's sample actually occupied in the Parse loading table. Dose is from the design document only — it appears in no column of the object.", text:
`round_1_well  ${c.b1}   (48-well layout, rows A-D)
sample        ${c.sample}
embryos       6
line          TU wildtype  (design spec says fli1:egfp — unresolved)
dose_at_24hpf ${c.pert==="DMSO"?"0.1% DMSO (vehicle)":"1 uM"}
compound      ${c.pert}
collected     48 hpf, pooled per well`};},

  susp: () => { const c=pick(REAL_CELLS); return {label:"one fixed cell", flag:null,
    note:"The three barcode wells are real, read from obs bc1_well / bc2_well / bc3_well for this cell. Shown mid-chemistry: bc2 and bc3 are what this cell will receive two and four steps later.", text:
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

  read: () => { const s=pick(REAL_SUBLIBS); return {label:"one sublibrary's reads", flag:"the FASTQs are not on this instance",
    note:"No read-level record can be shown: the raw files stayed in Parse's cloud workdir. These are the sequencing statistics split-pipe reported for this sublibrary — everything that survives of the reads themselves.", text:
`sublibrary          ${s.n}
reads               ${s.reads.toLocaleString()}
transcripts         ${s.tscp.toLocaleString()}
saturation          ${s.sat.toFixed(3)}
valid_barcode_frac  ${s.vbc.toFixed(3)}
cDNA_Q30            ${s.q30.toFixed(3)}
cell_tscp_cutoff    ${s.knee.toFixed(1)}
paired-end: R1 cDNA · R2 bc1+bc2+bc3+UMI · index = sublibrary`};},

  ref: () => { const g=pick(REAL_GENES); return {label:"one gene record", flag:null,
    note:"Head of var in minifin_filtered.h5ad. Note that var_names are symbols and ENSDARG sits alongside in var['id'] — the inverse of MegaFin.", text:
`var_name        ${g.sym}
id              ${g.id}
gene_name_orig  ${g.orig}
genome          GRcZ11
genome_uuid     f919f3e8-0b98-4482-ab39-ccdf5036854b
release         not recorded (rel-99 inferred)`};},

  meta: () => { const c=pick(REAL_CELLS); return {label:"one well record",
    flag: c.sample.indexOf("Dapaglifozan")===0 ? "obs['sample'] misspells the compound — prefer obs['perturbation']" : null,
    note:"Four real obs columns for one cell. There is no separate well-map CSV; the mapping arrives through the Parse loading table.", text:
`bc1_well      ${c.b1}
parse_sample  ${c.sample}
sample        ${c.sample}
perturbation  ${c.pert}
replicate     ${c.sample}
dose_uM       — not recorded anywhere in the object —`};},

  cell: () => { const c=pick(REAL_CELLS); return {label:"one barcode", flag:null,
    note:"A real row of minifin_filtered.h5ad. There is no pct_mito and no doublet score in the delivered object — Trailmaker computed them, and did not ship them.", text:
`cell_id      ${c.cell}
sublibrary   ${c.sub}
tscp_count   ${c.tscp.toLocaleString()}
gene_count   ${c.genes.toLocaleString()}
mread_count  ${c.reads.toLocaleString()}
perturbation ${c.pert}
cell_type    unknown          <- all 94,616 of them`};},

  drop: () => ({label:"one discarded barcode", flag:"no such record exists",
    note:"This is the one payload on the map that cannot be filled in. Trailmaker reports per-sample settings, never per-barcode outcomes, and the unfiltered matrix was not delivered. The fields below are what a cull ledger would have to carry.", text:
`barcode      — not recorded —
dropped_by   — not recorded —
stage        one of: classifier / cell size / mito / spline / doublet
n_counts     — not recorded —
pct_mito     — not recorded —
doublet_p    — not recorded —

what exists instead:
  classifier FDR      0.01
  UMI knee            per-sample, 232 - 1370 (MegaFin CP01)
  mito maxFraction    per-sample, 0.0050 - 0.0151
  spline p.level      per-sample, 6.9e-6 - 1e-3
  doublet threshold   per-sample, 0.469 - 0.903`}),

  leaf: () => { const l=pick(REAL_LEAVES); return {label:"one leaf briefing", flag:"identity withheld",
    note:"Exactly what the labeller received for this leaf, copied from umap.json. No label, no compartment name, no hint — and markers_down is empty here because it is empty on all 267.", text:
`leaf            ${l.id}
compartment     ${l.comp}   (of 18)
n_cells         ${l.n.toLocaleString()}
low_n           ${l.low}
n_enriched      ${l.nenr}
markers_up      ${l.mk.map(m=>m[0]).join(", ")}
  ${l.mk.map(m=>`${pad(m[0],20)} l2fc ${String(m[1]).padStart(5)}  in ${(m[2]*100).toFixed(1)}%  out ${(m[3]*100).toFixed(1)}%`).join("\n  ")}
markers_down    — empty on every leaf —`};},

  stat: () => ({label:"one grounding probe", flag:null,
    note:"The probe that gated registration of the minifin_p0 slot on :5007. Leaf 0 is the mural/pericyte leaf; sox2 is checked as a negative control and comes back correctly depleted.", text:
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
    note:"A real row of minifin_final_labelling.json. Free text, not an ontology id — the frozen ZFA menu postdates this run.", text:
`leaf             ${l.id}
decision         ${l.dec}
identity         ${l.call}
consolidated_to  ${l.node}
tier             ${l.tier}
ssmp             ${l.ssmp===null?"— singleton, not merged —":l.ssmp.toFixed(3)+(l.ssmp<0.34?"   FLAGGED marker-disjoint":"")}
model            gpt-5.4 · run_leaf_v2 v1.2`};},

  score: () => { const s=pick(REAL_SCORES); return {label:"one judged call", flag:"ground truth enters only here",
    note:"Scored against Patrick's sealed 27-set key, DMSO control cells only. Leaf 48 is the ontology-axis mismatch in one row: lenient 1.00, strict 0.07, because the key says Midbrain and markers cannot see a region.", text:
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
  eyebrow:"MiniFin · MegaFIN 100k · 43 samples · 4 compounds",
  title:"Aquarium to Atlas",
  sub:"four rows · eight landmarks · one claim at the end",
  does:`<p>Four rows, snaking. Each one turns a corner at the end and runs back the other way; the moving dots tell you which direction you are reading. Top row is oldest.</p>
<p><mark>Row 1 — the fish.</mark> Aquarium to fixed cells. Four conditions in a 48-well plate, six embryos a well, one dose. The only row where biology is being done rather than described.</p>
<p><mark>Row 2 — the chemistry.</mark> Four rounds of barcoding — 48 wells then 96 then 96, then a PCR index — library prep, and 3.66 billion reads off the sequencer.</p>
<p><mark>Row 3 — the matrix.</mark> Reads to a cube of every barcode, then five QC stages, then 94,616 cells. This row is where the map is thinnest, and it says so.</p>
<p><mark>Row 4 — the labelling.</mark> A mute object becomes a named one: 18 compartments, 267 leaves, 114 consolidated nodes, $15.35.</p>
<p>Eight landmarks along the way are real things you could point at; everything between them is a step, drawn small. The two apparatus — the sequencer and the labeller — sit on dotted plinths rather than dashed ones, because they are machines, not objects.</p>
<p>Two dependencies do not follow the rows. Sample identity on row 3 was written chemically on row 2 and decided physically on row 1 — it is the one piece of metadata on this map that is not carried by a spreadsheet. And the doublet threshold on row 3 is trying to measure a collision rate that was set on row 2, by how densely the barcode plates were loaded.</p>`,
  built:`<p>Every number on this map was read off an artefact on the instance, and the file it came from is named in the header comment of <mark>pipeline-data.js</mark>. The chain is: the MegaFIN design spec and the MiniFin front door for row 1; split-pipe's run definition and QC report for rows 2 and 3; the matrix itself for row 3's tail; and the Phase-A/Phase-B backups under <mark>daniotype_backups/minifin_*</mark> for row 4.</p>
<p>The payloads behind the moving dots are real records, not shapes — head-of-file rows from the h5ad, real leaf briefings, real concluded calls, real scores against the sealed key. Two of them deliberately show nothing, because nothing is what exists.</p>
<p>Row 4 is ground-truth-blind end to end and leak-scanned per leaf. The sealed key opens only at the scoring step, drawn off the line.</p>`,
  cond:`<p class="cond">Three things are missing rather than wrong. The raw FASTQs are not on this instance, so nothing upstream of Parse's report can be re-derived. The unfiltered barcode matrix was never delivered, so the five-stage cull has settings but no counts and the funnel cannot be drawn. And no cull ledger exists, so no dropped barcode can be attributed to the stage that dropped it.</p>
<p class="cond">Four things are wrong and fixable. The core labeller prompt tells the model it is reading ZSCAPE on all 267 MiniFin leaves. The leaf briefing has a markers-down slot that is empty on every leaf. obs['sample'] misspells dapagliflozin. And the line is disputed — TU wildtype in one document, fli1:egfp reporters in another.</p>
<p class="cond">Two are open decisions, not defects: whether cell-type identity or anatomical region is the primary axis, and whether τ = 0.34, validated on seven ZSCAPE cases, transfers.</p>`
};

/* Steps with no record of what was actually done on this run. A4-A7 were
   dropped from this set: the plate format, dose, exposure window and collection
   point are all confirmed by the design spec and, for the plate, independently
   by split-pipe's own barcode-set description. What remains is genuinely
   undocumented — the breeding steps, the dissociation, and library prep. */
const UNVERIFIED = new Set(["A1","A2","A3","A8","B9","C1","C2"]);
