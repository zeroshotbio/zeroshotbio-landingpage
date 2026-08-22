/* ============================================================
   ds-data.js — what this map is ABOUT.
   Owned by the on-instance. Every fact, number, name and payload lives here.
   You can rewrite this file end to end without touching the renderer.

   WHAT THIS MAP IS
   The medallion data architecture as it actually stands, drawn straight down.
   Eight stations in flow order — bronze bucket, the manifest, bronze repo,
   the empty bay, silver bucket, then a fold and back the other way through
   silver repo, gold bucket, gold repo — plus the shared contract between the
   two rows and the scratch bucket off the flow entirely. It is a plan of a
   building, not a diagram of an intention: where a stage exists in code but
   has never moved a byte, the map says so and draws it dashed.

   The single most important thing on it: of the four hops the architecture
   describes, ONE has run against the real buckets. The rest are wired,
   documented, and cold.

   WHERE THE NUMBERS COME FROM
   Every byte count, object count and etag below was read on 2026-08-22 from
   the live account (arn:aws:sts::423623857952:assumed-role/ec2-s3-work-role)
   and from the four repositories at these commits:

     zsb-medallion  871346f   main == v0.5.0    48 commits   1,843 LOC
     zsb-bronze     82c5b75   main             115 commits   3,880 LOC
     zsb-silver     b88dfa2   main              13 commits     155 LOC
     zsb-gold       b80b2bc   main              14 commits      92 LOC

   Bucket totals are the `aws s3 ls --recursive --summarize` figures; prefix
   tiles are those objects aggregated two segments deep. The eight manifest
   etags in the RACK were each confirmed with head-object against Fort Knox
   on the same read — all eight matched size and etag exactly.

   WHAT IS NOT KNOWN, AND IS MARKED AS NOT KNOWN
   - The gold bucket's contents. The role this was read with has no
     s3:ListBucket on zsb-gold-library, and HeadBucket returns 403. The map
     says "unknown to this role", never "empty".
   - Bucket-level configuration on any of the four. GetBucketVersioning,
     GetBucketReplication, GetBucketEncryption and
     GetBucketLifecycleConfiguration are all AccessDenied to this role, so
     zsb-medallion's README claim that bronze is "versioned, cross-region
     replicated" is repeated here as a claim and is not confirmed.
   ============================================================ */

/* ============================================================
   GEOMETRY

   Four registers, and the split is the argument of the drawing.

     y = -5.5   the ARCHIVED lane — the generation that actually put the
                objects that are in the warehouse today
     y =  7     ROW 1, running →   bronze bucket · manifest · bronze repo ·
                the empty bay · silver bucket
     y = 20.5   the CONTRACT — zsb-medallion, tapped from both sides
     y = 34     ROW 2, running ←   silver repo · gold bucket · gold repo
     y = 47     the SCRATCH — zsb-sandbox, deliberately connected to nothing

   The flow folds once, turning the corner off the right-hand wall of the
   silver bucket and running back the other way — the same snake /pipeline
   uses, for the same reason. Laid out in one straight line the eight stations
   are 121 grid units wide against about 45 tall, which is 2.7:1; no viewport
   is that shape, so a fit-to-stage view was throwing away half the canvas and
   rendering everything at a third of readable size. Folded once it is roughly
   1.2:1 and fits a normal screen almost exactly.

   The fold also buys the one adjacency the straight line could not: the
   contract bar now sits BETWEEN the two rows, with the bronze repo reaching
   down into it and the silver and gold repos reaching up. That is what
   zsb-medallion actually is — the thing in the middle that all three movers
   import — rather than a bar parked underneath them.

   Station widths and gaps are authored, not computed. /pipeline lays its rows
   out with layoutRows() because a row there is a sequence of steps whose
   spacing carries no meaning; here every station has a real extent — a bucket
   is as wide as its treemap needs to be — so a solver would only fight the
   drawing.
   ============================================================ */
const ROW1 = 7, ROW2 = 34, UPPER = -5.5, BUS_Y = 20.5;

const NODES = [

/* ================= STATION 1 — THE BRONZE BUCKET ================= */
{id:"BS3", key:"1", group:"① Bronze — the sealed floor", groupMark:true, anchor:true,
 shape:"vault", tier:"bronze", doors:["r","t"],
 name:"Fort Knox", bucket:"zsb-bronze-fortknox", right:"1,258 obj · 7.03 TiB",
 x:7.5, y:ROW1, w:14, h:16,
 sub:"s3://zsb-bronze-fortknox · human-write, automation-read",
 stat:"7,730,616,859,647 bytes",
 tiles:[
   {key:"megafin/",   value:3565423800576, objs:594},
   {key:"megafin-1/", value:1863029842194, objs:282},
   {key:"megafin-2/", value:1698635254871, objs:281},
   {key:"minifin/",   value:603527962001,  objs:100},
 ],
 does:"The sealed raw floor, and the only tier on this map that a person is allowed to write to. Everything else in the architecture is derivable: if the warehouse and the library both burned down they could be rebuilt from this bucket plus the repos. This bucket could not be rebuilt from anything. That is the rule that decides what belongs here — <mark>anything we cannot regenerate from code plus a lower tier</mark> — and it is why 7 TiB of vendor deliverables sit in one place with the write path closed.",
 built:"Four datasets, 1,258 objects, 7,730,616,859,647 bytes read on 2026-08-22. Every object is in the STANDARD storage class — there is no Glacier or Intelligent-Tiering anywhere in the bucket, which for 7 TiB of write-once archive is a standing monthly cost and a decision nobody has recorded making. The tiles are drawn by area: MegaFin's three deliveries are 92.2% of the bucket between them, and MiniFin — the dataset the entire pipeline has been built and proven against — is the 7.8% tile bottom right.",
 cond:"Two things. First, <mark>minifin/raw/fastq/ and minifin/raw-fastq/ are the same 17 objects twice</mark> — byte-for-byte identical names and sizes, 224,908,197,699 bytes duplicated, 2.9% of the bucket held for nothing. Neither prefix is in any manifest; the archived provenance record points at minifin/raw/fastq/, so raw-fastq/ appears to be the orphan, but nothing on this instance settles which is safe to delete and the rule for this bucket is that a person deletes it, not a script. Second, the medallion README says bronze is versioned and cross-region replicated. That could not be confirmed here: GetBucketVersioning and GetBucketReplication are both AccessDenied to the pipeline role, so the claim is repeated on this map as a claim.",
 kv:[["Bucket","zsb-bronze-fortknox"],["Objects","1,258"],["Size","7.03 TiB (7,730,616,859,647 B)"],["Storage class","STANDARD, all 1,258"],["Written by","humans only"],["Read on","2026-08-22"]]},

{id:"BTRAP", key:"1a", group:"① Bronze — the sealed floor", shape:"stack", tier:"bronze", depth:4,
 name:"The eight files nobody may fetch", x:23, y:UPPER, w:11, h:3.0,
 headline:"minifin/parse-output/qc/per-sublibrary/",
 lines:["agg_sample_summary_sublib1…8.csv","present in the bucket · excluded from the manifest on purpose"],
 sub:"8 objects · 58,057 bytes · deliberately unreachable",
 does:"A group of objects that are in the bronze bucket, are small, are obviously relevant, and are excluded from the ingestion manifest by name. They are drawn up here in the archived register rather than inside the vault because the interesting fact about them is not where they sit — it is that the code refuses to reach for them.",
 built:"Eight per-sublibrary summary CSVs, uploaded 2026-08-09, about 7.2 KB each. The manifest in zsb-bronze names eight other objects and stops; these are not among them, and the exclusion is documented in three places — the module docstring, the dataset README, and AGENTS.md.",
 cond:"The reason is the sharpest data trap in the whole architecture. The <mark>sublibN</mark> in these filenames does not correspond to the <mark>__sN</mark> suffix on the barcodes — the real mapping is a permutation recorded in run-proc-def.json under <mark>combine</mark>. Pair them by name and you select the wrong cells from every sublibrary <em>and still total exactly 94,616</em>, because you are summing the same multiset of per-group counts in a different order. No count-based check can catch that. The build guards it a different way, by comparing the called barcode set identity-for-identity against the delivered filtered metadata — the one check a count cannot fake.",
 kv:[["Keys","minifin/parse-output/qc/per-sublibrary/"],["Objects","8"],["Size","58,057 B"],["In manifest","no — excluded by name"],["Guarded by","set-identity check in cells.py"]]},

/* ================= THE MANIFEST — the selector ================= */
{id:"BMAN", key:"2", group:"② The selector", groupMark:true, anchor:true,
 shape:"rack", tier:"bronze",
 name:"The named-key manifest", x:23, y:ROW1, w:10, h:12,
 headline:"MANIFEST", right:"8 keys · verified 2026-08-22",
 sub:"fetch/manifest.py · 8 of 1,258 objects · 944 MiB of 7.03 TiB",
 rows:[
   {name:"dge-unfiltered/count_matrix.mtx.gz", bytes:959601177},
   {name:"dge-unfiltered/cell_metadata.csv.gz", bytes:28068414},
   {name:"dge-filtered/cell_metadata.csv.gz", bytes:1561948},
   {name:"dge-unfiltered/all_genes.csv.gz", bytes:251854},
   {name:"run-proc-def.json", bytes:124056},
   {name:"cutoffs.tar.gz", bytes:18209},
   {name:"settings.txt", bytes:17409},
   {name:"sample-summary.csv", bytes:7563},
 ],
 does:"The single most consequential twelve lines of configuration in the architecture, and the reason the bronze hop is cheap. It is a list of eight object keys, each pinned to an exact size and an exact etag. Not a prefix. Not a sync. Eight names.",
 built:"The same Parse delivery holds ~225 GB of raw FASTQ and ~135 GB of split-pipe intermediates in adjacent prefixes; the 16 sublibrary output zips alone are 141 GB. A prefix sync of minifin/ pulls 562 GiB and a very large egress bill. This manifest pulls 944 MiB — about 0.16% of the dataset's own prefix — and it is everything conversion and cell-calling actually read. The three unfiltered triplet files feed the streamed conversion; cutoffs.tar.gz carries Parse's per-slice thresholds, which is the policy that reproduces the delivered cell set exactly; the filtered metadata is the parity fixture the build checks itself against.",
 cond:"All eight entries were confirmed against the live bucket on 2026-08-22 — every size and every etag matched, including the multipart etags (the 959 MB matrix is <mark>…fb652-115</mark>, 115 parts). That is a real check and it passed. What it does not tell you is whether the pins would survive a re-upload: an S3 multipart etag depends on the part size the uploader chose, so re-uploading the identical bytes with a different chunk size changes the etag and this manifest would reject a file that is byte-identical to the one it wants.",
 kv:[["Source","src/zsb_bronze/minifin/fetch/manifest.py"],["Keys pinned","8"],["Bytes pinned","989,650,630 (944 MiB)"],["Share of minifin/","0.16%"],["Verified","2026-08-22 — 8/8 size + etag"],["Excluded","FASTQ, intermediates, .rds, filtered matrix, per-sublibrary QC"]]},

/* ================= STATION 2 — THE BRONZE REPO ================= */
{id:"BREPO", key:"3", group:"③ Bronze — the mover", groupMark:true, anchor:true,
 shape:"floor", tier:"code", state:"live",
 name:"zsb-bronze", repo:"zsb-bronze", right:"115 commits · 3,880 LOC",
 x:38, y:ROW1, w:13, h:16,
 rail:["fetch","convert","build","publish"],
 sub:"reads bronze · writes silver · the only repo here that has run",
 does:"The mover for the first hop. Named for the tier it <em>reads</em>, not the one it writes — a convention worth holding onto, because it is the thing that makes the five-station line unambiguous: zsb-bronze reads bronze and writes silver, zsb-silver reads silver and writes gold, zsb-gold only reads.",
 built:"One dataset module, <mark>minifin/</mark>, implemented end to end: 2,226 lines under src, ten test files, four CLI verbs behind the <mark>zsb-minifin</mark> entry point. 115 commits from four people since 2026-07-21 — Darien 60, Steve 52, Creighton 2, and one from Claude. Python 3.13, uv + hatchling, ruff with pydocstyle on, and <mark>make verify</mark> as the single gate.",
 cond:"There is no CI that runs the tests. Both workflow files in .github/ are Claude review bots; the README says plainly why the real gate is missing — cloning the private zsb-medallion dependency inside GitHub Actions needs credential plumbing that is not sorted out. So a green branch means somebody ran make verify on their own machine and said so. Separately, AGENTS.md still instructs you to branch off <mark>zsb-minifin</mark> rather than main; that branch is 41 commits behind and dead, and the last 48 commits went straight to main. Thirteen stale branches remain on the remote, five of them carrying unmerged commits.",
 kv:[["Repo","zeroshotbio/zsb-bronze"],["HEAD","82c5b75 (main)"],["Commits","115, since 2026-07-21"],["Source","3,880 LOC · 2,226 in minifin/"],["Tests","10 files · no CI runs them"],["Depends on","zsb-medallion @ v0.4.0"],["Open PRs","0"]]},

{id:"BFETCH", key:"3a", group:"③ Bronze — the mover", shape:"cell", tier:"code", state:"live",
 name:"fetch", cellName:"fetch", note:"8 keys · 944 MiB · ~90 s",
 x:38, y:2.0, w:11, h:2.8,
 sub:"fetch/ · manifest.py + fetch.py · 221 LOC",
 does:"Mirrors the eight manifest keys beneath <mark>data/minifin/bronze/</mark>, validating each object's size and etag against the pin before it is written. This is the one step in the entire architecture that has demonstrably moved bytes between a real bucket and a real disk.",
 built:"Downloads through <mark>zsb_medallion.io.S3IO</mark>, so the repo itself carries no boto3 dependency — that is deliberate and stated in AGENTS.md. Roughly 990 MB in about 90 seconds on the instance. Has a --dry-run.",
 cond:"Nothing outstanding. The validation this step performs was re-run independently against the live bucket on 2026-08-22 and all eight objects matched.",
 kv:[["Command","uv run zsb-minifin fetch"],["Reads","zsb-bronze-fortknox"],["Writes","data/minifin/bronze/ (local)"],["State","implemented and exercised"]]},

{id:"BCONV", key:"3b", group:"③ Bronze — the mover", shape:"cell", tier:"code", state:"live",
 name:"convert", cellName:"convert", note:"279M entries · ~150 MB peak",
 x:38, y:5.2, w:11, h:2.8,
 sub:"process/convert.py · 417 LOC",
 does:"Streams the unfiltered Parse triplet into an h5ad instead of loading it whole. Parse ships one combined MatrixMarket of roughly 279 million non-zero entries; blocks of <mark>chunk_cells</mark> rows are appended to an on-disk CSR matrix.",
 built:"Default chunk is 100,000 cells. Peak memory on the measured run was about 150 MB — against a 2,743,021 × 32,520 matrix. Writes the scratch artifact <mark>data/minifin/work/dge_unfiltered.h5ad</mark> through zsb_medallion's AtomicPath, so a killed run leaves no half-written file where a good one should be.",
 cond:"The scratch h5ad is local only and gitignored. It is not published anywhere and not reproducible from the warehouse — only from Fort Knox — which is correct for the tier rules but does mean the expensive intermediate is thrown away between runs.",
 kv:[["Command","uv run zsb-minifin convert"],["Input","the unfiltered triplet, 944 MiB"],["Matrix","2,743,021 × 32,520"],["Non-zeros","~279 million"],["Peak memory","~150 MB"]]},

{id:"BBUILD", key:"3c", group:"③ Bronze — the mover", shape:"cell", tier:"code", state:"live",
 name:"build", cellName:"build", note:"94,616 cells · jaccard 1.0000",
 x:38, y:8.4, w:11, h:2.8,
 sub:"process/ · cells, corrections, provenance, validate · 924 LOC",
 does:"Calls cells, applies the mandatory corrections, stamps provenance into <mark>.uns</mark>, validates the schema, and writes the Silver artifact. This is where the tier rule bites: silver is counts plus corrections and <em>no judgment calls</em> — if two scientists would pick different values, it is not silver, it is gold.",
 built:"Three cell-calling policies in cells.py, in decreasing fidelity. <mark>parse-cutoffs</mark> is canonical: it reads Parse's per-(sample, sublibrary) thresh_raw out of cutoffs.tar.gz and applies round(thresh_raw) per slice, reproducing the delivered barcode set <em>exactly</em> — 94,616 called, jaccard 1.0000, a set match rather than a count match. parse-settings reaches 94,876 (+260, jaccard 0.9940); barcode-ranks, a port of the DropletUtils search that takes no Parse threshold as input, reaches 94,338 (−278, jaccard 0.9827). Corrections are the three that are not judgment calls: Ctrl→DMSO, the Dapaglifozan typo→Dapagliflozin, and splitting five asterisk-merged samples back to two wells each by Round 1 well, recovering 48 replicates from 43 Parse samples.",
 cond:"Exact parity <em>requires</em> the per-slice cut, and that is a structural fact rather than a tuning one: split-pipe called cells per sample <em>and</em> sublibrary, and for all 43 samples the per-sample minimum called count falls below the maximum uncalled count. The per-sample policies therefore cannot reach 94,616 no matter how they are tuned, and AGENTS.md warns against trying. Also do not use the published <mark>cell_tscp_cutoff</mark> column — it is a rounded, read-weighted figure, not the threshold that was applied.",
 kv:[["Command","uv run zsb-minifin build"],["Cells called","94,616 of 2,743,021 barcodes"],["Genes","32,520"],["Non-zeros","193,544,653 · CSR int32"],["Replicates","48, from 43 Parse samples"],["Policy","parse-cutoffs (exact)"],["Output","work/minifin.h5ad"]]},

{id:"BPUB", key:"3d", group:"③ Bronze — the mover", shape:"cell", tier:"code", state:"stub",
 name:"publish", cellName:"publish", note:"implemented · never run against S3",
 x:38, y:11.6, w:11, h:2.8,
 sub:"publish/publish.py · 184 LOC · the cold end of the live repo",
 does:"Uploads one silver release — the validated h5ad, the dataset README, and the changelog — to the warehouse under <mark>minifin/&lt;version&gt;/</mark>. Publication is deliberately a separate act from the build, so that writing to a shared bucket is always something a person chose to do.",
 built:"Version prefixes are immutable by default; <mark>--overwrite</mark> is an explicit override meant for retrying a failed prefix, not for corrections — a correction is a new version. The one always-mutable object is the ledger at <mark>minifin/CHANGELOG.md</mark>, rewritten each release. There is no delete path at all: removing a released object is a human console act. Re-validates the annotation schema on a backed read before it uploads, so a stamped-but-wrong file is rejected at the door. Has a --dry-run.",
 cond:"<mark>This step is written, tested and documented, and it has not run.</mark> The changelog in the repo carries a complete <mark>v1 — 2026-08-22</mark> entry describing the release; the warehouse contains no <mark>minifin/v1/</mark> prefix, no CHANGELOG.md, and nothing at all published under the versioned convention. The six minifin objects that <em>are</em> in the warehouse are flat keys from 2026-08-07 and 2026-08-09, written by the archived pipeline. So the ledger currently documents a release that does not exist. That is the single largest gap on this map, and it is the reason the four stations to the right of here are drawn cold.",
 kv:[["Command","uv run zsb-minifin publish"],["Would write","s3://zsb-silver-warehouse/minifin/v1/"],["Changelog says","v1 published 2026-08-22"],["Bucket says","no minifin/v1/ prefix exists"],["Mutable object","minifin/CHANGELOG.md only"],["Delete path","none"]]},

/* ================= THE GAP ================= */
{id:"SGAP", key:"4", group:"④ The gap", groupMark:true, anchor:true,
 shape:"bay", tier:"silver",
 name:"minifin/v1/ — the prefix that is not there", x:51, y:ROW1, w:6, h:5,
 headline:"empty bay",
 lines:["minifin/v1/minifin.h5ad","minifin/v1/README.md","minifin/CHANGELOG.md"],
 sub:"the release the changelog describes · absent from the warehouse",
 does:"Drawn as an empty bay because that is what a plan does with a room that was specified and never built. Three objects would land here on the first real publish: the validated artifact, the dataset README that describes it, and the changelog ledger at the dataset root.",
 built:"The key convention is settled and written down in publish.py and AGENTS.md — the bucket is the tier, so keys carry no <mark>silver</mark> segment; artifacts live under <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> and are immutable; the ledger sits above the version prefixes at <mark>&lt;dataset&gt;/CHANGELOG.md</mark> and is the sole object ever replaced.",
 cond:"Checked directly on 2026-08-22: <mark>aws s3 ls s3://zsb-silver-warehouse/minifin/</mark> returns six objects, all of them the archived generation's flat keys, and no v1/ prefix. Two readings are consistent with what is on disk and this map cannot distinguish them: either publish has only ever been run with --dry-run, or it was run against a bucket this role cannot see. Whichever it is, the changelog entry was written and committed before the objects existed, which is the wrong order for a ledger whose entire job is to index what is in the bucket.",
 kv:[["Expected prefix","minifin/v1/"],["Expected objects","3"],["Actually present","0"],["Checked","2026-08-22"],["Blocks","every station to the right"]]},

/* ================= STATION 3 — THE SILVER BUCKET ================= */
{id:"SS3", key:"5", group:"⑤ Silver — the warehouse", groupMark:true, anchor:true,
 shape:"vault", tier:"silver", doors:["l","r","t"],
 name:"The warehouse", bucket:"zsb-silver-warehouse", right:"79 obj · 15.45 GiB",
 x:63.5, y:ROW1, w:12, h:16,
 sub:"s3://zsb-silver-warehouse · written by zsb-bronze",
 stat:"16,592,799,338 bytes",
 tiles:[
   {key:"zebrahub/",  value:11127199502, objs:12},
   {key:"megafin-1/", value:5367910950,  objs:61},
   {key:"minifin/",   value:97688886,    objs:6, stale:true},
 ],
 does:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. The warehouse is the hinge of the whole architecture — the last tier where the data is still <em>just what was measured</em>. Everything to the right of it is opinion, versioned and defensible, but opinion.",
 built:"79 objects, 16,592,799,338 bytes, read 2026-08-22. It is 0.21% the size of Fort Knox, which is the medallion architecture working exactly as intended: 7 TiB of vendor deliverables reduce to 15 GiB of counts.",
 cond:"None of the three tiles was written by the repo that is supposed to write this bucket. <mark>zebrahub/</mark> (10.4 GiB, 12 objects, 2026-07-27) predates the zsb-* repos entirely and is the placeholder both zsb-silver and zsb-gold have since deleted from their own source trees as 'not the shape the real transforms take'. <mark>megafin-1/characterization/</mark> (5.0 GiB, 61 objects, 2026-08-06) is an analysis working set — Python scripts, CSVs, diff reports and a 4.9 GiB h5ad — not a published artifact, and it has no version prefix. <mark>minifin/</mark> (93 MiB, 6 objects, hatched on the map) is the archived pipeline's output. Not one object in this bucket follows the <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> convention that the code enforces. The warehouse is full of things, and empty of releases.",
 kv:[["Bucket","zsb-silver-warehouse"],["Objects","79"],["Size","15.45 GiB (16,592,799,338 B)"],["vs bronze","0.21%"],["Versioned releases","0"],["Written by zsb-bronze","nothing"],["Read on","2026-08-22"]]},

{id:"SOLD", key:"5a", group:"⑤ Silver — the warehouse", shape:"stack", tier:"silver", depth:3,
 name:"What is actually in minifin/", x:63.5, y:UPPER, w:12, h:3.0,
 headline:"minifin_rebuild_{ensembl99,lawson}.h5ad",
 lines:["+ minifin_barcode_disposition_ensembl99.parquet","each with a sidecar .provenance.json · 6 objects · 93 MiB"],
 sub:"written 2026-08-07 and 08-09 by the archived pipeline",
 does:"The objects a consumer would actually find if they looked in the warehouse for MiniFin today. Two h5ads built against two different gene sets — Ensembl 99 and Lawson v4.3.2 — a barcode disposition table, and a provenance sidecar for each.",
 built:"Written by <mark>/data/s3-bronze</mark>, the previous generation, at stage <mark>05_publish</mark>. The sidecars are thorough: schema_version 1, git sha 426f9ecd on branch feat/minifin-rebuild-scaffold, dirty:false, a sha256 of the resolved config, the full reference bundle with md5 and sha256 per file, and the eight sublibrary library IDs. That is a genuinely good provenance record and it is machine-readable.",
 cond:"It is a <em>different architecture</em>, and the two are incompatible in three ways at once. Flat keys with no version segment, so nothing is immutable and a rebuild overwrites. Provenance in a sidecar object rather than stamped into <mark>.uns</mark> inside the artifact, so the artifact and its history can be separated by a copy. And a naming scheme — <mark>&lt;dataset&gt;_rebuild_&lt;reference&gt;.h5ad</mark> — that encodes the reference in the filename, where the new schema puts the reference in provenance and the version in the key. A consumer pointed at this bucket has no way to tell which generation any object belongs to except by its date.",
 kv:[["Objects","6 (3 artifacts + 3 sidecars)"],["Size","93.2 MiB"],["Written","2026-08-07, 2026-08-09"],["By","/data/s3-bronze, stage 05_publish"],["Git sha","426f9ecd (clean)"],["Convention","flat keys, sidecar provenance"]]},

{id:"OLD", key:"5b", group:"⑤ Silver — the warehouse", shape:"stack", tier:"side", depth:3,
 name:"The archived generation", x:38, y:UPPER, w:13, h:3.0,
 headline:"archive-old-bronze-main",
 lines:["e0d8356 · 30 decisions · the minifin_rebuild pipeline","an orphan lineage inside zsb-bronze — NOT an ancestor of main"],
 sub:"the repo that wrote what is in the warehouse",
 does:"The pipeline that produced every MiniFin object currently in the silver warehouse. Its history is preserved inside zsb-bronze under the tag <mark>archive-old-bronze-main</mark>, and it is drawn up here in its own register because it is not part of the current flow — it is what the current flow is replacing.",
 built:"Tag e0d8356, the head of the old <mark>zeroshotbio/s3-bronze</mark> repository: a stage-numbered pipeline (01…05) with a 30-entry decisions log, a TRAPS file, and per-stage manifests for three alignment arms. It ran on the instance under conda, not uv.",
 cond:"The tag is <mark>not an ancestor of zsb-bronze's main</mark> — merge-base confirms it. The history is retained but disconnected: nothing on today's main builds on those 30 decisions, and none of them were carried across as commits. What survives the transition is what somebody re-typed into AGENTS.md and the dataset README. Worth knowing before trusting either as complete: /data/STATUS.md on the instance still describes the archived repo as the live one.",
 kv:[["Tag","archive-old-bronze-main → e0d8356"],["Ancestor of main","no"],["Former repo","zeroshotbio/s3-bronze"],["Decisions log","30 entries, none open"],["Wrote","silver minifin/ + most of sandbox staging/"]]},

/* ================= STATION 4 — THE SILVER REPO ================= */
{id:"SREPO", key:"6", group:"⑥ Silver — the mover", groupMark:true, anchor:true,
 shape:"floor", tier:"code", state:"stub", lab:"b",
 name:"zsb-silver", repo:"zsb-silver", right:"13 commits · 155 LOC",
 x:63.5, y:ROW2, w:13, h:16,
 rail:["fetch","process","publish"],
 sub:"reads silver · writes gold · three stubs, three gates",
 does:"The mover for the second hop, and the place the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, cell-type annotation. Everything the silver tier refused to decide.",
 built:"A scaffold, honestly labelled as one. 155 lines total across four source files and one test — and the test is the shared docstring-convention checker, not a test of any transform. Three step modules exist, each exporting one function that raises NotImplementedError with the specific thing it is waiting on. The ZebraHub placeholder that used to live here was deleted rather than kept, on the grounds that it described a passthrough applying no QC, which is not the shape a real transform takes.",
 cond:"Every one of the three gates is a <em>convention</em> rather than an algorithm — an object-key format, a QC sign-off, another object-key format. None of them needs research; they need a decision. And the first of them, the Silver object-key convention, is already settled on the other side: zsb-bronze's publish.py implements it and AGENTS.md documents it. The two repos have not been reconciled, so the reading side is still gated on something the writing side has already chosen.",
 kv:[["Repo","zeroshotbio/zsb-silver"],["HEAD","b88dfa2 (main)"],["Commits","13, since 2026-07-21"],["Source","155 LOC, all stubs"],["Tests","1 file — the docstring checker"],["Depends on","zsb-medallion @ v0.4.0"],["Bytes moved","0"]]},

{id:"SFETCH", key:"6a", group:"⑥ Silver — the mover", shape:"cell", tier:"code", state:"stub",
 name:"fetch (silver)", cellName:"fetch", note:"gated: Silver object-key convention",
 x:63.5, y:29.1, w:11, h:3.0,
 sub:"download_silver() → raises NotImplementedError",
 does:"Would download the corrected Silver h5ad that zsb-bronze published, through zsb_medallion's S3IO.",
 built:"Signature and docstring only. The docstring names its own blocker: the exact key 'comes from the Silver object-key convention, still to be settled with the bronze publish side'.",
 cond:"That convention <mark>is</mark> settled — <mark>&lt;dataset&gt;/&lt;version&gt;/</mark>, immutable, ledger at the dataset root. It is implemented in zsb-bronze's publish.py and stated in its AGENTS.md. This stub could be written today. What it could not do today is succeed, because nothing has been published under that convention for it to fetch.",
 kv:[["Function","download_silver(destination)"],["State","raises NotImplementedError"],["Stated gate","Silver object-key convention"],["Actual state of that gate","settled on the bronze side, unreconciled here"]]},

{id:"SPROC", key:"6b", group:"⑥ Silver — the mover", shape:"cell", tier:"code", state:"stub",
 name:"process (silver→gold)", cellName:"process", note:"gated: Gold v1 QC sign-off",
 x:63.5, y:32.7, w:11, h:3.0,
 sub:"build_gold() → raises NotImplementedError",
 does:"The heaviest step in any tier, and the only one on this map that is genuinely unbuilt rather than merely unrun. QC and doublet filtering with fixed seeds, normalization and log1p, HVGs, batch-aware embeddings, clustering, and cell-type annotation.",
 built:"Docstring only, but the docstring is a real specification: raw counts preserved in <mark>layers['counts']</mark> before .X is touched, and every parameter, seed, version and cell-count transition stamped into <mark>.uns</mark>. It also fixes where the thresholds come from — Parse's recorded settings.txt, not inferred defaults — which is why settings.txt is pinned in the bronze manifest two stations back even though bronze's own canonical cell-calling policy does not read it.",
 cond:"Gated on 'Gold v1 QC sign-off', which is a human decision nobody has made. This is the one gate on the map that is a real question rather than a naming argument: it is asking which QC thresholds this company is prepared to defend, and that is exactly the judgment call the silver tier exists to defer.",
 kv:[["Function","build_gold(source, destination)"],["State","raises NotImplementedError"],["Gate","Gold v1 QC sign-off — unmade"],["Thresholds from","Parse settings.txt (pinned in the bronze manifest)"],["Preserves","layers['counts'] before .X changes"]]},

{id:"SPUB", key:"6c", group:"⑥ Silver — the mover", shape:"cell", tier:"code", state:"stub",
 name:"publish (gold)", cellName:"publish", note:"gated: Gold object-key convention",
 x:63.5, y:36.3, w:11, h:3.0,
 sub:"publish_gold() → raises NotImplementedError",
 does:"Would upload one validated Gold h5ad to the library under a versioned, non-overwriting key, and never publish an unvalidated artifact.",
 built:"Docstring only. Deliberately separate from the build, for the same reason bronze's publish is: uploading to a shared bucket should be an explicit act.",
 cond:"Gated on the Gold object-key convention — which is the same argument as the Silver one, one tier along, and which zsb-gold is <em>also</em> blocked on from the reading side. Two repos are waiting on the same unwritten paragraph.",
 kv:[["Function","publish_gold(source, key)"],["State","raises NotImplementedError"],["Gate","Gold object-key convention"],["Also blocks","zsb-gold's download_gold()"]]},

/* ================= STATION 5 — THE GOLD BUCKET ================= */
{id:"GS3", key:"7", group:"⑦ Gold — the library", groupMark:true, anchor:true,
 shape:"vault", tier:"gold", doors:["l","r"], lab:"b",
 name:"The library", bucket:"zsb-gold-library", right:"unknown to this role",
 x:45, y:ROW2, w:11, h:16,
 sub:"s3://zsb-gold-library · analysis-ready, versioned · what the team trains on",
 stat:"no objects observed",
 tiles:[],
 emptyHead:"contents unknown",
 emptyLines:["ListBucket: AccessDenied", "HeadBucket: 403 Forbidden",
             "not known to be empty — not readable"],
 does:"The terminal tier: analysis-ready, immutable, versioned, and the thing every model downstream is actually trained on. Nothing writes to it but zsb-silver, and nothing reads it but zsb-gold and the people using them.",
 built:"Nothing observable. The bucket is named in <mark>zsb_medallion.GOLD</mark> and referenced by both neighbouring repos, and that is the full extent of what can be confirmed from here.",
 cond:"<mark>This vault is drawn empty because it is unknown, not because it is known to be empty.</mark> The pipeline role has no s3:ListBucket on zsb-gold-library and HeadBucket returns 403 — it cannot even establish that the bucket exists in this account, only that something at that name refuses it. The distinction matters: an empty gold library and an unreadable one call for completely different next actions, and no artefact on this instance settles which it is. What can be said is that nothing upstream has ever been in a position to write here — silver's publish step raises on every call.",
 kv:[["Bucket","zsb-gold-library"],["ListBucket","AccessDenied to the pipeline role"],["HeadBucket","403 Forbidden"],["Objects","unknown"],["Ever written by zsb-silver","no — publish_gold raises"],["Read on","2026-08-22"]]},

{id:"GREPO", key:"8", group:"⑧ Gold — the reader", groupMark:true, anchor:true,
 shape:"floor", tier:"code", state:"stub", lab:"b",
 name:"zsb-gold", repo:"zsb-gold", right:"14 commits · 92 LOC",
 x:27, y:ROW2, w:11, h:16,
 rail:["fetch","notebooks"],
 sub:"reads gold · publishes nothing · the terminal repo",
 does:"The consumer end. Downloads and validates released gold artifacts and hosts the starter analysis notebooks. It is the only repo in the architecture with no write path at all — by design, not by omission.",
 built:"92 lines: a package init, a minifin module, one fetch stub, and the docstring-convention test. Plus <mark>notebooks/minifin/README.md</mark>, which describes an <mark>01_eda.ipynb</mark> that has not landed — it would load a downloaded artifact, show its provenance, validate shape, layers, metadata and embeddings, and summarise QC and perturbation balance.",
 cond:"Blocked on the same unwritten Gold key convention, and the README states the reason precisely and well: the previous download flow prefix-listed the bucket and pulled everything it found, which does not survive immutable versioned keys — a fresh clone would download every version ever released. So the pull must name one release, and the shape of that name has not been agreed. Notebooks write only to gitignored local paths or the Sandbox bucket, never back under a Gold key; that rule is stated and there is nothing yet to enforce it against.",
 kv:[["Repo","zeroshotbio/zsb-gold"],["HEAD","b80b2bc (main)"],["Commits","14"],["Source","92 LOC"],["Write path","none, by design"],["Notebooks","1 README, 0 notebooks"],["Blocked on","the Gold versioned-key convention"]]},

{id:"GFETCH", key:"8a", group:"⑧ Gold — the reader", shape:"cell", tier:"code", state:"stub",
 name:"fetch (gold)", cellName:"fetch", note:"gated: versioned-key convention",
 x:27, y:31.4, w:9.5, h:3.0,
 sub:"download_gold() → raises NotImplementedError",
 does:"Would download one released MiniFin Gold artifact.",
 built:"Docstring only.",
 cond:"Named blocker: 'a clone must pull one release, not every version'. The same paragraph that unblocks zsb-silver's publish step unblocks this one.",
 kv:[["Function","download_gold(destination)"],["State","raises NotImplementedError"],["Gate","versioned-key convention (shared with SPUB)"]]},

{id:"GNB", key:"8b", group:"⑧ Gold — the reader", shape:"cell", tier:"code", state:"stub",
 name:"the starter notebooks", cellName:"notebooks", note:"1 README · 0 notebooks",
 x:27, y:36.4, w:9.5, h:3.0,
 sub:"notebooks/minifin/README.md",
 does:"Where the analysis that consumes a gold release is meant to live. One README, describing an <mark>01_eda.ipynb</mark> that has not landed.",
 built:"The README specifies the notebook well: load the downloaded gold artifact, show its source and preprocessing provenance, validate shape, layers, required metadata and embeddings, and summarise QC distributions and perturbation / replicate / cell-type balance.",
 cond:"It cannot be written before there is an artifact to open, and it is the last thing in the chain — which makes it a useful test of the whole map. Everything to the left of this cell has to work before a single line of it can run.",
 kv:[["Path","notebooks/minifin/"],["Files","README.md"],["Notebooks","0"],["Writes to","gitignored local paths or Sandbox — never a Gold key"]]},

/* ================= THE CONTRACT ================= */
{id:"MED", key:"9", group:"⑨ The contract", groupMark:true, anchor:true,
 shape:"bus", tier:"code",
 name:"zsb-medallion", repo:"zsb-medallion",
 x:45, y:BUS_Y, w:50, h:2.0, tapLen:4.4,
 taps:[{x:38, dir:-1}, {x:63.5, dir:1}, {x:27, dir:1}],
 sub:"v0.5.0 · 48 commits · 1,843 LOC · the only repo here with boto3",
 exports:["BRONZE SILVER GOLD SANDBOX","S3IO","AtomicPath","6 error types","console"],
 does:"Not a stage. The shared vocabulary all three movers import, drawn as a bus under them because that is the relationship — every repo above touches it, and it touches no bucket. It holds exactly three things: the four bucket names, the S3 and atomic-file mechanics, and the CLI presentation helpers.",
 built:"1,843 lines, 48 commits, and a single author — Darien, under four different git identities. It is the only repo in the set that depends on boto3, and that is enforced socially rather than technically: AGENTS.md in zsb-bronze says 'S3 mechanics come from zsb-medallion; add no boto3 here', and no tier repo does. It is also the only repo with real S3 tests — moto and boto3-stubs are in its dev group and nowhere else. Tagged v0.1.0 through v0.5.0; main is exactly v0.5.0.",
 cond:"The interesting property of this package is what it refuses to do. <mark>S3IO.upload</mark> will not clobber — it raises S3ObjectExistsError rather than overwrite — which is what makes 'version prefixes are immutable' a property of the code rather than a promise in a README. Six named exception types, including S3ObjectMismatchError for a pinned etag that has drifted and S3PublishPermissionError for a 403 on the write path, so a caller can tell 'the object changed' from 'you are not allowed' without parsing a message.",
 kv:[["Repo","zeroshotbio/zsb-medallion"],["Version","v0.5.0 (main == tag)"],["Commits","48, sole author"],["Source","1,843 LOC"],["Exports","4 bucket names, S3IO, AtomicPath, 6 errors, console"],["boto3","here only"],["S3 tests","moto — here only"]]},

{id:"PIN", key:"9a", group:"⑨ The contract", shape:"stack", tier:"code", depth:2,
 name:"The version pin", x:9, y:BUS_Y, w:11, h:2.6,
 headline:"zsb-medallion @ v0.4.0",
 lines:["pinned by zsb-bronze and zsb-silver","medallion is at v0.5.0"],
 sub:"one minor version of drift · currently harmless",
 does:"Both tier repos pin the contract by git tag, not by range: <mark>zsb-medallion @ git+https://github.com/zeroshotbio/zsb-medallion@v0.4.0</mark>, with hatchling's allow-direct-references turned on to permit it. Pinning by tag is the right call for a private dependency with no index behind it.",
 built:"v0.5.0 shipped on 2026-08-22 and the delta from v0.4.0 is almost entirely the new <mark>zsb_medallion.console</mark> package — shared Progress bars, byte formatting, and failure lines.",
 cond:"The drift is benign right now, and it is worth being precise about why rather than just noting the version numbers differ: neither consumer imports console. zsb-bronze uses <mark>zsb_medallion.io</mark> and the four bucket constants and nothing else, so v0.4.0 contains everything it references. The real observation is the other one — <mark>console has no consumers</mark>. It was built, reviewed, merged and tagged, and the two repos that would use it are both still on the tag before it.",
 kv:[["Pinned","v0.4.0, by zsb-bronze and zsb-silver"],["Available","v0.5.0"],["Delta","the console package"],["Consumers of console","none"],["Breaks anything","no"]]},

/* ================= THE SIDE ROOM ================= */
{id:"SBX", key:"10", group:"⑩ Off the flow", groupMark:true, anchor:true,
 shape:"vault", tier:"side", doors:[],
 name:"Sandbox", bucket:"zsb-sandbox", right:"706 obj · 64.6 GiB",
 x:8, y:47, w:14, h:9.5,
 sub:"s3://zsb-sandbox · per-user scratch · input to nothing",
 stat:"69,343,831,982 bytes",
 tiles:[
   {key:"staging/minifin-solo-lawson",       value:26350916826, objs:217},
   {key:"staging/minifin-solo-grcz12tu_ncbi",value:19371519374, objs:217},
   {key:"staging/minifin-solo-ensembl99",    value:18755153236, objs:217},
   {key:"staging/minifin-parse-equivalent",  value:4100974930,  objs:4},
   {key:"staging/refs + reference",          value:627304963,   objs:12},
   {key:"staging/ other + tooling",          value:137962653,   objs:39},
 ],
 does:"The fourth bucket, and the only one on this map with no edges. That is not an omission — the medallion README defines it that way: 'per-user scratch, nothing here is an input to anything else'. It is drawn as a room off the corridor with the doorway left off, because a scratch bucket that something depends on has stopped being a scratch bucket.",
 built:"706 objects, 69,343,831,982 bytes. Almost all of it is the archived pipeline's three STARsolo alignment arms — Lawson v4.3.2 (24.5 GiB), GRCz12tu NCBI RefSeq (18.0 GiB) and Ensembl 99 (17.5 GiB), 217 objects each, which is the same run aligned against three different answers to 'which genes exist'. Plus a Parse-equivalent rebuild, staged references, a repo bundle and the Parse pipeline zip.",
 cond:"The rule holds today, and it is worth checking that it keeps holding, because 651 of these 706 objects are the only surviving copy of three expensive alignment runs. They are reproducible from Fort Knox plus the archived pipeline — that is the tier rule working — but 'reproducible' here means re-running three STARsolo arms, and the archived pipeline is an orphan lineage that no longer has a live environment. Nothing depends on this bucket. Something being one careless decision away from depending on it is the thing to watch.",
 kv:[["Bucket","zsb-sandbox"],["Objects","706"],["Size","64.6 GiB (69,343,831,982 B)"],["Edges on this map","zero, by design"],["Largest holding","3 STARsolo arms, 651 objects, 60 GiB"],["Written by","people and the archived pipeline"]]},

/* the scale block */
{id:"SCALE", key:"", group:"", shape:"scalebar", tier:"side", noindex:true,
 name:"scale", x:8, y:54, w:6.7,
 headline:"tile area = bytes",
 sub:"bronze and silver vaults share one scale"},
];

/* ============================================================
   EDGES — the flow.

   kind:"live"    bytes have moved across this, and can be shown to have
   kind:"cold"    implemented or specified, never run against a real bucket
   kind:"hist"    the archived generation's path — how the objects that are
                  in the warehouse today actually got there
   kind:"never"   an edge the architecture deliberately does not have

   Ports are {node, side, dx, dy} — dx/dy nudge along the wall so two
   conduits leaving the same face do not overlap.
   ============================================================ */
const EDGES = [
  {a:{n:"BS3", s:"r"}, b:{n:"BMAN", s:"l"}, kind:"live",
   label:"8 of 1,258 objects", sub:"selected by name"},
  {a:{n:"BMAN", s:"r"}, b:{n:"BREPO", s:"l"}, kind:"live",
   label:"944 MiB · size + etag verified", sub:"fetch"},

  {a:{n:"BS3", s:"t"}, b:{n:"BTRAP", s:"l"}, kind:"never",
   label:"never fetched", sub:"the sublibN trap"},

  {a:{n:"BREPO", s:"r"}, b:{n:"SGAP", s:"l"}, kind:"cold",
   label:"publish minifin/v1/", sub:"has not run"},
  {a:{n:"SGAP", s:"r"}, b:{n:"SS3", s:"l"}, kind:"cold",
   label:"", sub:""},

  {a:{n:"OLD", s:"r"}, b:{n:"SOLD", s:"l"}, kind:"hist",
   label:"stage 05_publish · 2026-08-07", sub:"the generation that did write"},
  {a:{n:"SOLD", s:"b"}, b:{n:"SS3", s:"t"}, kind:"hist",
   label:"", sub:""},

  /* the fold: out past the right-hand wall, down, and back in. Routed
     around the outside rather than straight down, so it does not cross the
     contract bar or collide with the silver repo's own riser into it. */
  {a:{n:"SS3", s:"r"}, b:{n:"SREPO", s:"r"}, kind:"cold", at:73,
   label:"download_silver()", sub:"raises"},
  {a:{n:"SREPO", s:"l"}, b:{n:"GS3", s:"r"}, kind:"cold",
   label:"publish_gold()", sub:"raises"},
  {a:{n:"GS3", s:"l"}, b:{n:"GREPO", s:"r"}, kind:"cold",
   label:"download_gold()", sub:"raises"},
];

/* one carry: the map runs out at the right, into everything the gold tier
   feeds. Nothing on this map is responsible for any of it. */
const CARRIES = [
  {x0:21.5, y0:ROW2, x1:16.5, y1:ROW2, fade:"out",
   from:"zsb-gold", to:"PRISM · the models · everything trained downstream"},
];

/* ============================================================
   REGISTERS — the horizontal bands, named.
   ============================================================ */
const BANDS = [
  {name:"The archived generation — what actually wrote the warehouse", y0:-8.4, y1:-3.2, x0:-2, x1:75},
  {name:"Row 1 → — bronze bucket · the manifest · bronze repo · silver bucket", y0:-2.4, y1:16.4, x0:-2, x1:75},
  {name:"The shared contract — imported by all three movers, written by none of them", y0:17, y1:24, x0:-2, x1:75},
  {name:"Row 2 ← — silver repo · gold bucket · gold repo, running back the other way", y0:24.6, y1:44.2, x0:-2, x1:75},
  {name:"Off the flow", y0:44.8, y1:57.5, x0:-2, x1:24},
];

/* ============================================================
   PAYLOADS
   Real records, transcribed from the artefacts and the live API responses.
   Nothing below is invented; two of them show a refusal, because a refusal
   is what exists.
   ============================================================ */
const pad = (s, n) => String(s).padEnd(n);
const SNIPPETS = {
  BS3: () => ({
    title: "aws s3 ls s3://zsb-bronze-fortknox/ --recursive --summarize",
    body: [
      "                           PRE megafin-1/",
      "                           PRE megafin-2/",
      "                           PRE megafin/",
      "                           PRE minifin/",
      "2026-08-06 20:37:17          5 _writetest.txt",
      "",
      "Total Objects: 1258",
      "   Total Size: 7730616859647"
    ].join("\n"),
    note: "Read from the live bucket on 2026-08-22."
  }),
  BMAN: () => ({
    title: "head-object against the manifest pins",
    /* keys are shown without their common minifin/parse-output/ prefix so the
       block fits the reader without a horizontal scroll */
    body: [
      pad("key", 33) + "size".padStart(12),
      "-".repeat(47),
      pad("unfiltered/count_matrix.mtx.gz", 33) + "959,601,177".padStart(12) + " ok",
      pad("unfiltered/cell_metadata.csv.gz", 33) + "28,068,414".padStart(12) + " ok",
      pad("unfiltered/all_genes.csv.gz", 33) + "251,854".padStart(12) + " ok",
      pad("filtered/cell_metadata.csv.gz", 33) + "1,561,948".padStart(12) + " ok",
      pad("run-proc-def.json", 33) + "124,056".padStart(12) + " ok",
      pad("cutoffs.tar.gz", 33) + "18,209".padStart(12) + " ok",
      pad("settings.txt", 33) + "17,409".padStart(12) + " ok",
      pad("sample-summary.csv", 33) + "7,563".padStart(12) + " ok",
      "",
      "8/8 matched size AND etag, multipart included:",
      "count_matrix is 2952be…fb652-115 — 115 parts."
    ].join("\n"),
    note: "Each of the eight pins re-checked against Fort Knox on 2026-08-22."
  }),
  BPUB: () => ({
    title: "src/zsb_bronze/minifin/CHANGELOG.md — committed",
    body: [
      "## v1 — 2026-08-22",
      "",
      "First MiniFin silver release: the 94,616-cell zebrafish",
      "chemical-perturbation pilot, and the schema every later",
      "version is measured against.",
      "",
      "- Matrix: 94,616 called cells × 32,520 genes",
      "- Cell calling: parse-cutoffs, identity-matched",
      "- Built with: zsb_bronze 0.1.0, zsb_medallion 0.4.0"
    ].join("\n"),
    note: "The ledger entry exists in git. The objects it indexes do not exist in the bucket."
  }),
  SGAP: () => ({
    title: "aws s3 ls s3://zsb-silver-warehouse/minifin/",
    body: [
      "2026-08-09 20:00:59   12159345 minifin_barcode_disposition_ensembl99.parquet",
      "2026-08-09 20:15:52       5532 minifin_barcode_disposition_ensembl99.parquet.provenance.json",
      "2026-08-07 18:25:28   40307760 minifin_rebuild_ensembl99.h5ad",
      "2026-08-07 18:25:28      13166 minifin_rebuild_ensembl99.h5ad.provenance.json",
      "2026-08-07 18:25:27   45190039 minifin_rebuild_lawson.h5ad",
      "2026-08-07 18:25:28      13044 minifin_rebuild_lawson.h5ad.provenance.json",
      "",
      "# no v1/ prefix. no CHANGELOG.md. six flat keys, all from the",
      "# archived pipeline, none newer than 2026-08-09."
    ].join("\n"),
    note: "The whole gap, in one listing."
  }),
  GS3: () => ({
    title: "aws s3api head-bucket --bucket zsb-gold-library",
    body: [
      "An error occurred (403) when calling the HeadBucket",
      "operation: Forbidden",
      "",
      "$ aws s3 ls s3://zsb-gold-library/",
      "An error occurred (AccessDenied) when calling the",
      "ListObjectsV2 operation: User: arn:aws:sts::423623857952:",
      "assumed-role/ec2-s3-work-role/i-08a7d900afad61771 is not",
      "authorized to perform: s3:ListBucket"
    ].join("\n"),
    note: "This is the whole of what is known about the gold tier from here. It is a refusal, not an inventory."
  }),
  SOLD: () => ({
    title: "minifin_rebuild_ensembl99.h5ad.provenance.json",
    body: [
      '{ "schema_version": 1,',
      '  "module": "minifin_rebuild",',
      '  "stage": "05_publish",',
      '  "timestamp_utc": "2026-08-07T18:25:26.810261+00:00",',
      '  "config": {',
      '    "path": "/data/s3-bronze/pipelines/minifin_rebuild/…",',
      '    "git": { "sha": "426f9ecd0221e5d3d…",',
      '             "branch": "feat/minifin-rebuild-scaffold",',
      '             "dirty": false },',
      '    "sha256": "94e1e7d9d1a76942ed242431…" } }'
    ].join("\n"),
    note: "Read from the object in the warehouse. Good provenance — attached to the wrong architecture."
  }),
  MED: () => ({
    title: "zsb_medallion — the whole public surface",
    body: [
      "BRONZE   = 'zsb-bronze-fortknox'",
      "SILVER   = 'zsb-silver-warehouse'",
      "GOLD     = 'zsb-gold-library'",
      "SANDBOX  = 'zsb-sandbox'",
      "",
      "S3IO, AtomicPath, S3File,",
      "DownloadResult, UploadResult,",
      "S3ObjectExistsError, S3ObjectMismatchError,",
      "S3ShortUploadError, S3PublishPermissionError,",
      "S3TransferError"
    ].join("\n"),
    note: "Four strings and ten names. That is the entire agreement between the tiers."
  }),
  SBX: () => ({
    title: "the three arms",
    body: [
      pad("staging/minifin-solo-lawson", 38) + pad("217", 6) + "24.5 GiB",
      pad("staging/minifin-solo-grcz12tu_ncbi", 38) + pad("217", 6) + "18.0 GiB",
      pad("staging/minifin-solo-ensembl99", 38) + pad("217", 6) + "17.5 GiB",
      "",
      "# one run, aligned against three different answers to",
      "# 'which genes exist'. Nothing on this map depends on them."
    ].join("\n"),
    note: "Reproducible in principle from Fort Knox; the pipeline that made them is an orphan lineage."
  })
};

/* nodes whose claims rest on something this instance cannot check */
const UNVERIFIED = new Set(["GS3"]);

const OVERVIEW = {
  eyebrow: "Zeroshot · the medallion data architecture",
  title: "Data Structures",
  sub: "eight stations · four hops · one of them has moved a byte",
  does: `<p>A plan of the medallion architecture, drawn straight down. Eight stations in flow order: <mark>bronze bucket → the manifest → bronze repo → the empty bay → silver bucket</mark>, then the flow turns the corner off the right-hand wall and runs back the other way — <mark>silver repo → gold bucket → gold repo</mark>. Between the two rows sits the contract all three movers import. Below and to the left, the scratch bucket that is deliberately connected to nothing.</p>
<p>This is a companion to <a href="/pipeline">/pipeline</a> and its opposite in two ways. That map is drawn on an isometric axonometric and is about <em>the platonic process</em> — how a zebrafish becomes an atlas, in general. This one is orthographic top-down and is about <em>the state of one system on one day</em>: what is in the buckets, what is in the repos, and where the two disagree.</p>
<p><mark>The reason it is worth drawing top down.</mark> The bucket tiles are a squarified treemap by bytes, and area is the only honest encoding for a 466:1 ratio between Fort Knox and the warehouse. An isometric projection foreshortens one axis, so two tiles of equal area read as unequal depending on where they sit. Straight down, a square is a square everywhere on the canvas — which is also why the manifest can be drawn as what it is, a list of eight rows in order.</p>
<p><mark>Why it folds.</mark> Eight stations in one straight line is about 121 grid units against 45, and no screen is that shape — laid out flat, half the canvas was empty and everything rendered at a third of readable size. Folded once it is roughly square. The fold pays for itself twice: it also puts <mark>zsb-medallion</mark> physically between the two rows, with the bronze repo reaching down into it and the silver and gold repos reaching up, which is what that package actually is.</p>
<p><mark>Two registers above and below.</mark> The top band is the archived generation — the pipeline that actually wrote the objects sitting in the warehouse today, drawn separately because it is not part of the current flow. The bottom band is the sandbox, which has no conduits at all, on purpose.</p>
<p><mark>How to read the conduits.</mark> A solid line with dots moving along it has carried bytes and can be shown to have. A dashed line is code that exists and has never run. A dotted line is the archived generation's path. One conduit is drawn and crossed out: the eight files the ingestion manifest refuses to fetch, on purpose. There is exactly one solid line on this map.</p>`,
  built: `<p>Everything on this map was read on <mark>2026-08-22</mark> from the live AWS account and from the four repositories at their current main commits — zsb-medallion 871346f, zsb-bronze 82c5b75, zsb-silver b88dfa2, zsb-gold b80b2bc.</p>
<p>Bucket totals are <mark>aws s3 ls --recursive --summarize</mark>. Tiles aggregate those objects two path segments deep. The eight manifest entries in the rack were each re-checked with <mark>head-object</mark> against Fort Knox — all eight matched size and etag, multipart etags included.</p>
<p>Repository figures are commit counts, author tallies and line counts taken from fresh clones, not from memory or from the READMEs.</p>`,
  cond: `<p class="cond">The governing fact: <mark>of the four hops this architecture describes, one has run.</mark> Bronze bucket into the bronze repo works, is fast, and verifies itself. Everything downstream of the build step is written or specified and cold. The silver warehouse contains 79 objects and zero versioned releases; the gold library cannot be read from here at all.</p>
<p class="cond">The changelog problem is the sharpest one and the cheapest to fix. zsb-bronze's committed ledger describes a <mark>v1</mark> release dated 2026-08-22; the warehouse has no <mark>minifin/v1/</mark> prefix. A ledger whose job is to index a bucket was written before the bucket was written to.</p>
<p class="cond">Three gates block four stations, and none of them is a research problem. The Silver object-key convention is already settled on the bronze side and unreconciled on the silver side. The Gold object-key convention blocks two repos from opposite directions at once. Only the Gold v1 QC sign-off is a real question, and it is a question for a person, not a sprint.</p>
<p class="cond">Two things could not be checked from this instance and are marked rather than assumed: whether the gold bucket has contents, and whether any of the four buckets has the versioning, replication, encryption or lifecycle configuration the medallion README claims. Every bucket-level Get call is AccessDenied to the role this was read with.</p>
<p class="cond">One piece of pure waste, and it is in the one bucket nobody is allowed to clean up automatically: <mark>minifin/raw/fastq/</mark> and <mark>minifin/raw-fastq/</mark> hold the same 17 objects, 209 GiB duplicated.</p>`
};
