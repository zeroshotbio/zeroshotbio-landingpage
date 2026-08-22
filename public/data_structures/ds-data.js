/* ============================================================
   ds-data.js — what this map is ABOUT.
   Owned by the on-instance. Every fact, number, key and payload lives here.
   You can rewrite this file end to end without touching the renderer.

   WHAT THIS MAP IS
   The medallion data architecture as it actually stands, drawn straight down
   and read top to bottom. Three buckets in a column — bronze, silver, gold —
   and beside each hop, the repository that performs it. Underneath the whole
   thing, one shared contract.

   It is a plan of a building, not a diagram of an intention: where a stage
   exists in code but has never moved a byte, the map says so and draws it
   dashed.

   The single most important thing on it: of the three hops the architecture
   describes, ONE has run against the real buckets. The rest are wired,
   documented, and cold.

   NAMING
   The tiers are bronze, silver and gold. The buckets carry nickname suffixes
   for historical reasons — fortknox, warehouse, library — and those nicknames
   are shown once each, in the bucket's own subtitle, and used nowhere else.
   In the map, in the reader and in conversation the tiers are just their
   colours.

   WHERE THE NUMBERS COME FROM
   Every byte count, object count and etag below was read on 2026-08-22 from
   the live account (arn:aws:sts::423623857952:assumed-role/ec2-s3-work-role)
   and from the four repositories at these commits:

     zsb-medallion  2d165be   main = v0.5.0 +10  58 commits   1,843 LOC
     zsb-bronze     0414ac4   main              139 commits   4,358 LOC
     zsb-silver     b4253a2   main               25 commits     155 LOC
     zsb-gold       59dabde   main               20 commits      92 LOC

   Bucket totals are the `aws s3 ls --recursive --summarize` figures; prefix
   tiles are those objects aggregated two segments deep. The eight ingestion
   manifest entries were each confirmed with head-object against the bronze
   bucket on the same read — all eight matched size and etag exactly.

   SECOND READ — 2026-08-22, later the same day
   The four repos were re-pulled after a run of work from Darien and the map
   re-read against them. What that read found, and what it means for the map:

   - EVERY FIGURE ON THE S3 SIDE IS UNCHANGED, to the byte. Bronze is still
     1,258 objects / 7,730,616,859,647 B, silver still 79 / 16,592,799,338 B
     with the same three prefixes at the same sizes, gold still refuses both
     ListBucket and HeadBucket. There is still no `minifin/v1/`. The whole
     left column of this map, and its central argument — one hop of three has
     moved a byte — stands exactly as drawn.
   - THE REPO COLUMN MOVED, and one of the two failings this map called out
     on that side has been fixed. All four repos now carry a real
     `.github/workflows/ci.yml` that runs `make verify` on every push and PR
     to main, with the private zsb-medallion dependency installed through a
     GitHub App token minted per run. The credential problem this map
     recorded as the reason there was no CI is solved.
   - zsb-bronze's AGENTS.md no longer points at the dead `zsb-minifin`
     branch. The second failing is fixed too.
   - zsb-bronze's CLI grew a level: `convert` and `build` now sit under a
     `process` group, alongside a new `process all`. The cells on this map
     are named for the commands you would actually type.
   - zsb-bronze bumped its zsb-medallion pin to v0.5.0 and now imports
     `zsb_medallion.console`. The "console has no consumers" loose end this
     map recorded is closed on the bronze side and still open on the other
     two, which both remain pinned to v0.4.0 — so the divergence is now
     drawn on the contract rail's taps rather than buried in prose.

   WHAT IS NOT KNOWN, AND IS MARKED AS NOT KNOWN
   - The gold bucket's contents. The role this was read with has no
     s3:ListBucket on zsb-gold-library, and HeadBucket returns 403. The map
     says "contents unknown", never "empty".
   - Bucket-level configuration on any of them. GetBucketVersioning,
     GetBucketReplication, GetBucketEncryption and
     GetBucketLifecycleConfiguration are all AccessDenied to this role, so
     zsb-medallion's README claim that bronze is "versioned, cross-region
     replicated" is repeated here as a claim and is not confirmed.
   ============================================================ */

/* ============================================================
   GEOMETRY — three columns, read top to bottom.

     x = 13    THE BUCKETS.  bronze, then silver, then gold, in tier order,
               each one directly below the last. This column is the data.
     x = 58    THE TRANSFORMS. One repository per hop, each sitting in the
               vertical gap between the two buckets it bridges — so a repo is
               always beside the seam it works on, never beside a tier.
     x = 78.5  THE CONTRACT. zsb-medallion, a single bar running the full
               height of the transform column and tapped by every repo in it.
               It is not a stage and it touches no bucket, which is why it is
               drawn as a rail rather than a station.

   Each hop is two conduits, and the pair is the whole shape of the map:
   out of a bucket's right wall, right and down into the repo (the READ), then
   back out of the repo's left wall, left and down into the next bucket (the
   WRITE). Both doglegs turn on the same corridor at x = 36, at different
   heights, so the column between the two stacks reads as one channel.

   Station heights and gaps are authored, not computed. /pipeline lays its rows
   out with layoutRows() because a row there is a sequence of steps whose
   spacing carries no meaning; here every station has a real extent — a bucket
   is as tall as its treemap needs to be — so a solver would only fight the
   drawing.
   ============================================================ */
const COL_BUCKET = 13, COL_REPO = 58, COL_RAIL = 78.5, CORRIDOR = 36;

/* ============================================================
   ZONES — the two systems the map spans.

   Everything on the left is an S3 bucket; everything on the right is a git
   repository. That is the most important distinction on the map and the one
   it went longest without stating: half these stations cost money by the
   terabyte-month and half are source trees, and until they were enclosed they
   all looked like the same kind of object.

   The GitHub zone takes in the contract rail as well as the transform column.
   zsb-medallion is a repository like the other three and only sits apart
   because it is not a hop.

   The gap between the two boxes is where every conduit crosses, which is the
   literal truth: those crossings are the only places this architecture moves
   anything between the two systems.
   ============================================================ */
const ZONES = [
  { name: "AWS S3", sub: "account 423623857952 · buckets",
    x0: -1.5, y0: -3.6, x1: 27.5, y1: 64.5 },
  { name: "GitHub", sub: "github.com/zeroshotbio · repositories",
    x0: 45.5, y0: 6.6, x1: 84, y1: 73.5 },
];

const NODES = [

/* ================= BRONZE ================= */
{id:"BRONZE", key:"1", group:"① Bronze", groupMark:true, anchor:true,
 shape:"vault", tier:"bronze", doors:["r"],
 name:"Bronze", bucket:"BRONZE", right:"1,258 obj · 7.03 TiB",
 x:COL_BUCKET, y:9, w:24, h:16,
 sub:"s3://zsb-bronze-fortknox · human-write, automation-read",
 tiles:[
   {key:"megafin/",   value:3565423800576, objs:594},
   {key:"megafin-1/", value:1863029842194, objs:282},
   {key:"megafin-2/", value:1698635254871, objs:281},
   {key:"minifin/",   value:603527962001,  objs:100},
 ],
 does:"The sealed raw tier, and the only one on this map a person is allowed to write to. Everything below it is derivable: if silver and gold both burned down they could be rebuilt from this bucket plus the repos. This bucket could not be rebuilt from anything. That is the rule that decides what belongs here — <mark>anything we cannot regenerate from code plus a lower tier</mark> — and it is why 7 TiB of vendor deliverables sit in one place with the write path closed.",
 built:"Four datasets, 1,258 objects, 7,730,616,859,647 bytes read on 2026-08-22. Every object is in the STANDARD storage class — there is no Glacier or Intelligent-Tiering anywhere in the bucket, which for 7 TiB of write-once archive is a standing monthly cost and a decision nobody has recorded making. The tiles are drawn by area: MegaFin's three deliveries are 92.2% of the tier between them, and MiniFin — the dataset the entire pipeline has been built and proven against — is the 7.8% tile.",
 cond:"Three things. First, <mark>minifin/raw/fastq/ and minifin/raw-fastq/ are the same 17 objects twice</mark> — identical names and sizes, 209 GiB duplicated, 2.9% of the tier held for nothing. Nothing on this instance settles which prefix is the orphan, and the rule for this bucket is that a person deletes it, not a script. Second, eight per-sublibrary QC summaries sit in <mark>minifin/parse-output/qc/</mark> and are excluded from the ingestion manifest <em>by name</em>: their sublibN labels do not match the barcode __sN suffix, so pairing them by name selects the wrong cells from every sublibrary and still totals exactly 94,616. No count-based check catches that. Third, the medallion README says this tier is versioned and cross-region replicated; that could not be confirmed here, because every bucket-level Get call is AccessDenied to the pipeline role.",
 kv:[["Bucket","zsb-bronze-fortknox"],["Objects","1,258"],["Size","7.03 TiB (7,730,616,859,647 B)"],["Storage class","STANDARD, all 1,258"],["Written by","humans only"],["Read on","2026-08-22"]]},

/* ================= THE BRONZE → SILVER TRANSFORM ================= */
{id:"BREPO", key:"2", group:"② Bronze → Silver", groupMark:true, anchor:true,
 shape:"floor", tier:"bronze", state:"live",
 name:"zsb-bronze", repo:"zsb-bronze", right:"139 commits · 4,358 LOC",
 x:COL_REPO, y:21, w:22, h:18.5,
 sub:"reads bronze · writes silver · the only repo here that has run",
 does:"The transform for the first hop. Named for the tier it <em>reads</em>, not the one it writes — the convention that makes this whole column unambiguous: zsb-bronze reads bronze and writes silver, zsb-silver reads silver and writes gold, zsb-gold only reads.",
 built:"One dataset module, <mark>minifin/</mark>, implemented end to end: 2,511 lines under src, ten test files, and five commands behind the <mark>zsb-minifin</mark> entry point — <mark>fetch</mark>, <mark>process convert</mark>, <mark>process build</mark>, <mark>process all</mark> and <mark>publish</mark>. 139 commits from four people since 2026-07-21 — Darien 84, Steve 52, Creighton 2, and one from Claude. Python 3.13, uv + hatchling, ruff with pydocstyle on, and <mark>make verify</mark> as the single gate.",
 cond:"<mark>Both of the failings this map recorded here have been fixed.</mark> There is now a real <mark>.github/workflows/ci.yml</mark> that runs <mark>make verify</mark> — ruff check, format check, pyright, pytest, in that order — on every push and pull request to main; the private zsb-medallion dependency that used to block it is installed through a GitHub App token minted per run and scoped to that one repo, so a green branch is now a machine's word rather than a person's. And AGENTS.md now says to branch off <mark>main</mark>; the dead <mark>zsb-minifin</mark> line is no longer being pointed at. What is left is smaller and specific: this repo has moved to <mark>zsb-medallion v0.5.0</mark> while zsb-silver and zsb-gold are still pinned to v0.4.0, so the three transforms no longer agree on the version of the contract they share.",
 kv:[["Repo","zeroshotbio/zsb-bronze"],["HEAD","0414ac4 (main)"],["Commits","139, since 2026-07-21"],["Source","4,358 LOC · 2,511 in minifin/"],["Tests","10 files · CI runs make verify"],["CI","ci.yml — push + PR to main"],["Depends on","zsb-medallion @ v0.5.0"],["Open PRs","0"]]},

{id:"BFETCH", key:"2a", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"fetch", cellName:"fetch", note:"8 of 1,258 objects · 944 MiB",
 x:COL_REPO, y:16.05, w:19, h:3.4,
 sub:"fetch/ · manifest.py + fetch.py · 244 LOC",
 does:"Mirrors eight named objects out of bronze, validating each one's size and etag against a pin before it is written to disk. This is the one step in the entire architecture that has demonstrably moved bytes between a real bucket and a real machine.",
 built:"The manifest is the most consequential twelve lines of configuration in the architecture, and the reason this hop is cheap. It is a list of eight object keys, each pinned to an exact size and an exact etag. <em>Not a prefix. Not a sync. Eight names.</em> The same Parse delivery holds ~225 GB of raw FASTQ and ~135 GB of split-pipe intermediates in adjacent prefixes; a prefix sync of minifin/ pulls 562 GiB and a very large egress bill. This pulls 944 MiB — about 0.16% of the dataset's own prefix — and it is everything conversion and cell-calling actually read. Downloads through <mark>zsb_medallion.io.S3IO</mark>, so the repo carries no boto3 of its own, and now reports through <mark>zsb_medallion.console.download_with_progress</mark> as it goes.",
 cond:"All eight pins were re-confirmed against the live bucket on 2026-08-22 — every size and every etag matched, multipart etags included. That is a real check and it passed. What it does not tell you is whether the pins would survive a re-upload: an S3 multipart etag depends on the part size the uploader chose, so re-uploading byte-identical content with a different chunk size changes the etag and this manifest would reject a file identical to the one it wants.",
 kv:[["Command","uv run zsb-minifin fetch"],["Keys pinned","8"],["Bytes pinned","989,650,630 (944 MiB)"],["Share of minifin/","0.16%"],["Verified","2026-08-22 — 8/8 size + etag"],["State","implemented and exercised"]]},

{id:"BCONV", key:"2b", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"convert", cellName:"process convert", note:"279M entries · ~150 MB peak",
 x:COL_REPO, y:19.95, w:19, h:3.4,
 sub:"process/convert.py · 490 LOC",
 does:"Streams the unfiltered Parse triplet into an h5ad instead of loading it whole. Parse ships one combined MatrixMarket of roughly 279 million non-zero entries; blocks of <mark>chunk_cells</mark> rows are appended to an on-disk CSR matrix.",
 built:"Default chunk is 100,000 cells. Peak memory on the measured run was about 150 MB — against a 2,743,021 × 32,520 matrix. Writes through zsb_medallion's AtomicPath, so a killed run leaves no half-written file where a good one should be.",
 cond:"The intermediate is local only and gitignored. It is not published anywhere and is reproducible only from bronze — correct for the tier rules, but it does mean the expensive step is thrown away between runs. The command moved under a <mark>process</mark> group in the CLI restructure; the stage itself did not change shape, it gained progress seams — an <mark>on_start</mark> that fires once and an <mark>on_block</mark> per chunk — so a run that streams 279 million entries now says how far along it is.",
 kv:[["Command","uv run zsb-minifin process convert"],["Matrix","2,743,021 × 32,520"],["Non-zeros","~279 million"],["Peak memory","~150 MB"],["Also runs under","process all"]]},

{id:"BBUILD", key:"2c", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"build", cellName:"process build", note:"94,616 cells · jaccard 1.0000",
 x:COL_REPO, y:23.85, w:19, h:3.4,
 sub:"process/ · cells, corrections, provenance, validate · 1,080 LOC",
 does:"Calls cells, applies the mandatory corrections, stamps provenance into <mark>.uns</mark>, validates the schema, and writes the silver artifact. This is where the tier rule bites: silver is counts plus corrections and <em>no judgment calls</em> — if two scientists would pick different values, it is not silver, it is gold.",
 built:"Three cell-calling policies, in decreasing fidelity. <mark>parse-cutoffs</mark> is canonical: it reads Parse's per-(sample, sublibrary) thresh_raw and applies round(thresh_raw) per slice, reproducing the delivered barcode set <em>exactly</em> — 94,616 called, jaccard 1.0000, a set match rather than a count match. parse-settings reaches 94,876 (+260, jaccard 0.9940); barcode-ranks, a port of the DropletUtils search that takes no Parse threshold as input, reaches 94,338 (−278, jaccard 0.9827). The corrections are the three that are not judgment calls: Ctrl→DMSO, the Dapaglifozan typo→Dapagliflozin, and splitting five asterisk-merged samples back to two wells each, recovering 48 replicates from 43 Parse samples.",
 cond:"Exact parity <em>requires</em> the per-slice cut, and that is structural rather than a matter of tuning: split-pipe called cells per sample <em>and</em> sublibrary, and for all 43 samples the per-sample minimum called count falls below the maximum uncalled count. The per-sample policies therefore cannot reach 94,616 however they are tuned, and AGENTS.md warns against trying.",
 kv:[["Command","uv run zsb-minifin process build"],["Cells called","94,616 of 2,743,021 barcodes"],["Genes","32,520"],["Non-zeros","193,544,653 · CSR int32"],["Replicates","48, from 43 Parse samples"],["Policy","parse-cutoffs (exact)"],["Also runs under","process all — stops on the first failure"]]},

{id:"BPUB", key:"2d", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"stub",
 name:"publish", cellName:"publish", note:"written · never run against S3",
 x:COL_REPO, y:27.75, w:19, h:3.4,
 sub:"publish/publish.py · 254 LOC · the cold end of the live repo",
 does:"Uploads one silver release — the validated h5ad, the dataset README, and the changelog — under <mark>minifin/&lt;version&gt;/</mark>. Publication is deliberately a separate act from the build, so writing to a shared bucket is always something a person chose to do.",
 built:"Version prefixes are immutable by default; <mark>--overwrite</mark> is an explicit override meant for retrying a failed prefix, not for corrections — a correction is a new version. The one always-mutable object is the ledger at <mark>minifin/CHANGELOG.md</mark>. There is no delete path at all: removing a released object is a human console act. Re-validates the annotation schema on a backed read before uploading, so a stamped-but-wrong file is rejected at the door — and the changelog gate is now enforced <em>inside</em> <mark>publish_release</mark> rather than by the caller, so there is no path to the bucket that skips it. <mark>--verify-matrix full</mark> is a new opt-in that re-checks the artifact end to end instead of sampling it.",
 cond:"<mark>This step is written, tested, hardened and documented, and it has still not run.</mark> The changelog in the repo carries a complete <mark>v1 — 2026-08-22</mark> entry describing the release; the silver bucket contains no <mark>minifin/v1/</mark> prefix, no CHANGELOG.md, and nothing at all under the versioned convention. So the ledger currently documents a release that does not exist. That is the largest gap on this map, and it is why everything below here is drawn cold. A second, smaller drift arrived with the medallion bump: the ledger entry still records <mark>Built with: zsb_medallion 0.4.0</mark>, and the repo now pins v0.5.0 — a release note describing a build that could no longer be reproduced from this tree, for a release that was never uploaded.",
 kv:[["Command","uv run zsb-minifin publish"],["Would write","s3://zsb-silver-warehouse/minifin/v1/"],["Changelog says","v1 published 2026-08-22"],["Bucket says","no minifin/v1/ prefix exists"],["Changelog build pin","zsb_medallion 0.4.0 — repo now pins 0.5.0"],["Delete path","none"]]},

/* ================= THE GAP, ON THE WRITE CONDUIT ================= */
{id:"SGAP", key:"3", group:"③ The gap", groupMark:true, anchor:true,
 shape:"bay", tier:"silver",
 name:"minifin/v1/ — the prefix that is not there", x:CORRIDOR, y:32, w:9.4, h:6,
 headline:"empty",
 lines:["minifin.h5ad", "README.md", "CHANGELOG.md"],
 sub:"the release the changelog describes · absent from silver",
 does:"Drawn as an empty bay on the write conduit, because that is what a plan does with a room that was specified and never built. Three objects would land here on the first real publish: the validated artifact, the dataset README that describes it, and the changelog ledger at the dataset root.",
 built:"The key convention is settled and written down in publish.py and AGENTS.md — the bucket is the tier, so keys carry no <mark>silver</mark> segment; artifacts live under <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> and are immutable; the ledger sits above the version prefixes and is the sole object ever replaced.",
 cond:"Checked directly on 2026-08-22: <mark>aws s3 ls s3://zsb-silver-warehouse/minifin/</mark> returns six objects, all of them flat keys written in early August by the pipeline that preceded these repos, and no v1/ prefix. Two readings fit what is on disk and this map cannot distinguish them: either publish has only ever been run with --dry-run, or it was run against a bucket this role cannot see. Either way the changelog entry was written and committed before the objects existed, which is the wrong order for a ledger whose job is to index a bucket.",
 kv:[["Expected prefix","minifin/v1/"],["Expected objects","3"],["Actually present","0"],["Checked","2026-08-22"],["Blocks","every station below"]]},

/* ================= SILVER ================= */
{id:"SILVER", key:"4", group:"④ Silver", groupMark:true, anchor:true,
 shape:"vault", tier:"silver", doors:["r"],
 name:"Silver", bucket:"SILVER", right:"79 obj · 15.45 GiB",
 x:COL_BUCKET, y:34, w:24, h:15,
 sub:"s3://zsb-silver-warehouse · written by zsb-bronze",
 tiles:[
   {key:"zebrahub/",  value:11127199502, objs:12},
   {key:"megafin-1/", value:5367910950,  objs:61},
   {key:"minifin/",   value:97688886,    objs:6, stale:true},
 ],
 does:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. This is the hinge of the architecture — the last tier where the data is still <em>just what was measured</em>. Everything below it is opinion, versioned and defensible, but opinion.",
 built:"79 objects, 16,592,799,338 bytes, read 2026-08-22. It is 0.21% the size of bronze, which is the medallion architecture working exactly as intended: 7 TiB of vendor deliverables reduce to 15 GiB of counts.",
 cond:"None of the three tiles was written by the repo that is supposed to write this tier. <mark>zebrahub/</mark> (10.4 GiB, 12 objects, 2026-07-27) predates the zsb-* repos entirely and is the placeholder both zsb-silver and zsb-gold have since deleted from their own source trees as 'not the shape the real transforms take'. <mark>megafin-1/characterization/</mark> (5.0 GiB, 61 objects) is an analysis working set — scripts, CSVs, diff reports and a 4.9 GiB h5ad — not a published artifact, and it has no version prefix. <mark>minifin/</mark> (93 MiB, 6 objects, called out in red on the map) is the previous pipeline's output: flat keys, provenance in a sidecar object rather than stamped inside the artifact, and the reference encoded in the filename. Not one object in this tier follows the <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> convention the code enforces. Silver is full of things, and empty of releases.",
 kv:[["Bucket","zsb-silver-warehouse"],["Objects","79"],["Size","15.45 GiB (16,592,799,338 B)"],["vs bronze","0.21%"],["Versioned releases","0"],["Written by zsb-bronze","nothing"],["Read on","2026-08-22"]]},

/* ================= THE SILVER → GOLD TRANSFORM ================= */
{id:"SREPO", key:"5", group:"⑤ Silver → Gold", groupMark:true, anchor:true,
 shape:"floor", tier:"silver", state:"stub",
 name:"zsb-silver", repo:"zsb-silver", right:"25 commits · 155 LOC",
 x:COL_REPO, y:45, w:22, h:14.6,
 sub:"reads silver · writes gold · three stubs, three gates",
 does:"The transform for the second hop, and the place the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, cell-type annotation. Everything the silver tier refused to decide.",
 built:"A scaffold, honestly labelled as one. 155 lines total across four source files and one test — and the test is the shared docstring-convention checker, not a test of any transform. Three step modules exist, each exporting one function that raises NotImplementedError with the specific thing it is waiting on. The placeholder that used to live here was deleted rather than kept, on the grounds that it described a passthrough applying no QC, which is not the shape a real transform takes.",
 cond:"Every one of the three gates is a <em>convention</em> rather than an algorithm — an object-key format, a QC sign-off, another object-key format. None of them needs research; they need a decision. And the first, the silver object-key convention, is already settled on the other side: zsb-bronze's publish.py implements it and its AGENTS.md documents it. The two repos have not been reconciled, so the reading side is still gated on something the writing side has already chosen. <mark>Twelve commits landed here since the first read and not one line of the transform changed</mark> — they are CI, a .gitignore, a .env.example, an aligned Makefile and a vendored Node for pyright. The scaffolding around the stubs is now as good as the bronze repo's; the stubs are the same three stubs. This repo is still pinned to zsb-medallion v0.4.0 while bronze has moved to v0.5.0.",
 kv:[["Repo","zeroshotbio/zsb-silver"],["HEAD","b4253a2 (main)"],["Commits","25, since 2026-07-21"],["Source","155 LOC, all stubs — unchanged"],["Tests","1 file — the docstring checker"],["CI","ci.yml — new, runs make verify"],["Depends on","zsb-medallion @ v0.4.0"],["Bytes moved","0"]]},

{id:"SFETCH", key:"5a", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"fetch (silver)", cellName:"fetch", note:"gated: silver object-key convention",
 x:COL_REPO, y:42.0, w:19, h:3.4,
 sub:"download_silver() → raises NotImplementedError",
 does:"Would download the corrected silver h5ad that zsb-bronze published, through zsb_medallion's S3IO.",
 built:"Signature and docstring only. The docstring names its own blocker: the exact key 'comes from the Silver object-key convention, still to be settled with the bronze publish side'.",
 cond:"That convention <mark>is</mark> settled — <mark>&lt;dataset&gt;/&lt;version&gt;/</mark>, immutable, ledger at the dataset root. It is implemented in zsb-bronze's publish.py and stated in its AGENTS.md. This stub could be written today. What it could not do today is succeed, because nothing has been published under that convention for it to fetch.",
 kv:[["Function","download_silver(destination)"],["State","raises NotImplementedError"],["Stated gate","silver object-key convention"],["Actual state of that gate","settled upstream, unreconciled here"]]},

{id:"SPROC", key:"5b", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"process (silver→gold)", cellName:"process", note:"gated: gold v1 QC sign-off",
 x:COL_REPO, y:45.9, w:19, h:3.4,
 sub:"build_gold() → raises NotImplementedError",
 does:"The heaviest step in any tier, and the only one on this map that is genuinely unbuilt rather than merely unrun. QC and doublet filtering with fixed seeds, normalization and log1p, HVGs, batch-aware embeddings, clustering, and cell-type annotation.",
 built:"Docstring only, but the docstring is a real specification: raw counts preserved in <mark>layers['counts']</mark> before .X is touched, and every parameter, seed, version and cell-count transition stamped into <mark>.uns</mark>. It also fixes where the thresholds come from — Parse's recorded settings.txt, not inferred defaults — which is why settings.txt is pinned in the bronze manifest two stations up even though the canonical cell-calling policy does not read it.",
 cond:"Gated on 'Gold v1 QC sign-off', which is a human decision nobody has made. This is the one gate on the map that is a real question rather than a naming argument: it asks which QC thresholds this company is prepared to defend, and that is exactly the judgment call the silver tier exists to defer.",
 kv:[["Function","build_gold(source, destination)"],["State","raises NotImplementedError"],["Gate","gold v1 QC sign-off — unmade"],["Thresholds from","Parse settings.txt"],["Preserves","layers['counts'] before .X changes"]]},

{id:"SPUB", key:"5c", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"publish (gold)", cellName:"publish", note:"gated: gold object-key convention",
 x:COL_REPO, y:49.8, w:19, h:3.4,
 sub:"publish_gold() → raises NotImplementedError",
 does:"Would upload one validated gold h5ad under a versioned, non-overwriting key, and never publish an unvalidated artifact.",
 built:"Docstring only. Deliberately separate from the build, for the same reason the bronze publish is: uploading to a shared bucket should be an explicit act.",
 cond:"Gated on the gold object-key convention — the same argument as the silver one, one tier along, and the thing zsb-gold is <em>also</em> blocked on from the reading side. Two repos are waiting on the same unwritten paragraph.",
 kv:[["Function","publish_gold(source, key)"],["State","raises NotImplementedError"],["Gate","gold object-key convention"],["Also blocks","zsb-gold's download_gold()"]]},

/* ================= GOLD ================= */
{id:"GOLD", key:"6", group:"⑥ Gold", groupMark:true, anchor:true,
 shape:"vault", tier:"gold", doors:["r"],
 name:"Gold", bucket:"GOLD", right:"contents unknown",
 x:COL_BUCKET, y:57, w:24, h:12,
 sub:"s3://zsb-gold-library · analysis-ready, versioned · what the team trains on",
 tiles:[],
 emptyHead:"contents unknown",
 emptyLines:["ListBucket: AccessDenied", "HeadBucket: 403 Forbidden",
             "not known to be empty — not readable"],
 does:"The terminal tier: analysis-ready, immutable, versioned, and the thing every model downstream is actually trained on. Nothing writes to it but zsb-silver, and nothing reads it but zsb-gold and the people using them.",
 built:"Nothing observable. The bucket is named in <mark>zsb_medallion.GOLD</mark> and referenced by both neighbouring repos, and that is the full extent of what can be confirmed from here.",
 cond:"<mark>This tier is drawn empty because it is unknown, not because it is known to be empty.</mark> The pipeline role has no s3:ListBucket on it and HeadBucket returns 403 — it cannot even establish that the bucket exists in this account, only that something at that name refuses it. The distinction matters: an empty gold tier and an unreadable one call for completely different next actions, and no artefact on this instance settles which it is. What can be said is that nothing upstream has ever been in a position to write here — the silver publish step raises on every call.",
 kv:[["Bucket","zsb-gold-library"],["ListBucket","AccessDenied to the pipeline role"],["HeadBucket","403 Forbidden"],["Objects","unknown"],["Ever written by zsb-silver","no — publish_gold raises"],["Read on","2026-08-22"]]},

/* ================= THE GOLD READER ================= */
{id:"GREPO", key:"7", group:"⑦ Gold — the reader", groupMark:true, anchor:true,
 shape:"floor", tier:"gold", state:"stub",
 name:"zsb-gold", repo:"zsb-gold", right:"20 commits · 92 LOC",
 x:COL_REPO, y:66, w:22, h:10.7,
 sub:"reads gold · publishes nothing · the terminal repo",
 does:"The consumer end. Downloads and validates released gold artifacts and hosts the starter analysis notebooks. It is the only repo in the architecture with no write path at all — by design, not by omission, which is why nothing leaves it on this map.",
 built:"92 lines: a package init, a minifin module, one fetch stub, and the docstring-convention test. Plus <mark>notebooks/minifin/README.md</mark>, which describes an <mark>01_eda.ipynb</mark> that has not landed.",
 cond:"Blocked on the same unwritten gold key convention, and the README states the reason precisely: the previous download flow prefix-listed the bucket and pulled everything it found, which does not survive immutable versioned keys — a fresh clone would download every version ever released. So the pull must name one release, and the shape of that name has not been agreed. Like zsb-silver, the six commits since the first read are all scaffolding — CI, workflows, an aligned Makefile — and none of them touched the single stub. It too remains pinned to zsb-medallion v0.4.0, and it carries the one open pull request in the set (#7, aligning the Makefile catalog).",
 kv:[["Repo","zeroshotbio/zsb-gold"],["HEAD","59dabde (main)"],["Commits","20"],["Source","92 LOC — unchanged"],["CI","ci.yml — new, runs make verify"],["Depends on","zsb-medallion @ v0.4.0"],["Write path","none, by design"],["Notebooks","1 README, 0 notebooks"]]},

{id:"GFETCH", key:"7a", group:"⑦ Gold — the reader", shape:"cell", tier:"gold", state:"stub",
 name:"fetch (gold)", cellName:"fetch", note:"gated: versioned-key convention",
 x:COL_REPO, y:64.95, w:19, h:3.4,
 sub:"download_gold() → raises NotImplementedError",
 does:"Would download one released MiniFin gold artifact.",
 built:"Docstring only.",
 cond:"Named blocker: 'a clone must pull one release, not every version'. The same paragraph that unblocks the silver publish step unblocks this one.",
 kv:[["Function","download_gold(destination)"],["State","raises NotImplementedError"],["Gate","versioned-key convention (shared with the silver publish)"]]},

{id:"GNB", key:"7b", group:"⑦ Gold — the reader", shape:"cell", tier:"gold", state:"stub",
 name:"the starter notebooks", cellName:"notebooks", note:"1 README · 0 notebooks",
 x:COL_REPO, y:68.85, w:19, h:3.4,
 sub:"notebooks/minifin/README.md",
 does:"Where the analysis that consumes a gold release is meant to live. One README, describing an <mark>01_eda.ipynb</mark> that has not landed.",
 built:"The README specifies the notebook well: load the downloaded gold artifact, show its source and preprocessing provenance, validate shape, layers, required metadata and embeddings, and summarise QC distributions and perturbation / replicate / cell-type balance. Generated files go to a gitignored path or the sandbox bucket, never back under a gold key.",
 cond:"It cannot be written before there is an artifact to open, and it is the last thing in the chain — which makes it a useful test of the whole map. Everything above this cell has to work before a single line of it can run.",
 kv:[["Path","notebooks/minifin/"],["Files","README.md"],["Notebooks","0"],["Writes to","gitignored paths or sandbox — never a gold key"]]},

/* ================= THE CONTRACT ================= */
{id:"MED", key:"8", group:"⑧ The contract", groupMark:true, anchor:true,
 shape:"spine", tier:"code",
 name:"zsb-medallion", repo:"zsb-medallion", right:"v0.5.0",
 x:COL_RAIL, y:41, w:8, h:62, tapLen:5.5,
 /* one tap per transform repo, carrying the version that repo actually pins.
    Two of the three are behind the rail and are drawn in the drop colour. */
 taps:[{y:21, pin:"v0.5.0"}, {y:45, pin:"v0.4.0"}, {y:66, pin:"v0.4.0"}],
 sub:"v0.5.0 · 58 commits · 1,843 LOC · the only repo here with boto3",
 exports:["BRONZE", "SILVER", "GOLD", "SANDBOX", "S3IO", "AtomicPath", "6 errors", "console"],
 does:"Not a stage, which is why it is drawn as a rail beside the transform column rather than a station in it. It is the shared vocabulary all three transforms import, and it touches no bucket. It holds exactly three things: the four bucket names, the S3 and atomic-file mechanics, and the CLI presentation helpers.",
 built:"1,843 lines, 58 commits, and a single author — Darien, under four different git identities. It is the only repo in the set that depends on boto3, and that is enforced socially rather than technically: zsb-bronze's AGENTS.md says 'S3 mechanics come from zsb-medallion; add no boto3 here', and no transform repo does. It is also the only repo with real S3 tests — moto and boto3-stubs are in its dev group and nowhere else. Tagged v0.1.0 through v0.5.0; main now sits ten commits past the v0.5.0 tag, all of them CI, tooling and type-checking work rather than surface changes.",
 cond:"The interesting property of this package is what it refuses to do. <mark>S3IO.upload</mark> will not clobber — it raises S3ObjectExistsError rather than overwrite — which is what makes 'version prefixes are immutable' a property of the code rather than a promise in a README. Six named exception types, so a caller can tell 'the object changed' from 'you are not allowed' without parsing a message. <mark>The console package now has a consumer.</mark> zsb-bronze bumped its pin to v0.5.0 and imports it in three places — the CLI, the fetch step and the publish step — so the loose end this map recorded, that console was built, reviewed, merged, tagged and unused, is closed. What replaced it is narrower and is drawn on the taps: the three repos that share this contract are no longer on the same version of it. zsb-silver and zsb-gold are still on v0.4.0, which is now the version <em>behind</em> the one the working transform runs against.",
 kv:[["Repo","zeroshotbio/zsb-medallion"],["Version","v0.5.0 · main is +10 commits"],["Pinned by bronze","v0.5.0 — imports console"],["Pinned by silver, gold","v0.4.0"],["Commits","58, sole author"],["Source","1,843 LOC"],["boto3","here only"],["S3 tests","moto — here only"]]},
];

/* ============================================================
   CONDUITS

   kind:"live"  bytes have crossed this, and can be shown to have
   kind:"cold"  implemented or specified, never run against a real bucket

   Two kinds only. There were four; the archived-generation lane and the
   deliberately-refused edge were both retired when the map was simplified,
   and their content moved into the reader text of the stations they were
   about. A legend with two rows is a legend people read.

   Each hop is a READ (bucket → repo) and a WRITE (repo → next bucket), both
   turning on the corridor at x = 36.
   ============================================================ */
const EDGES = [
  /* bronze → zsb-bronze → silver */
  {a:{n:"BRONZE", s:"r", dy:-4}, b:{n:"BREPO", s:"l", dy:-4.95}, kind:"live",
   label:"8 keys · 944 MiB", sub:"size + etag verified"},
  {a:{n:"BREPO", s:"l", dy:6}, b:{n:"SGAP", s:"t"}, kind:"cold",
   label:"publish v1", sub:"has not run"},
  {a:{n:"SGAP", s:"b"}, b:{n:"SILVER", s:"r", dy:2}, kind:"cold"},

  /* silver → zsb-silver → gold */
  {a:{n:"SILVER", s:"r", dy:6}, b:{n:"SREPO", s:"l", dy:0}, kind:"cold",
   label:"download_silver()", sub:"raises"},
  {a:{n:"SREPO", s:"l", dy:5}, b:{n:"GOLD", s:"r", dy:-2}, kind:"cold",
   label:"publish_gold()", sub:"raises"},

  /* gold → zsb-gold */
  {a:{n:"GOLD", s:"r", dy:3}, b:{n:"GREPO", s:"l", dy:0}, kind:"cold",
   label:"download_gold()", sub:"raises"},
];

/* one carry: the map runs out at the bottom, into everything gold feeds */
const CARRIES = [
  {x0:COL_REPO, y0:71.35, x1:COL_REPO, y1:76, fade:"out",
   from:"zsb-gold", to:"PRISM · the models · everything trained downstream"},
];

/* ============================================================
   PAYLOADS
   Real records, transcribed from the artefacts and the live API responses.
   Nothing below is invented; one of them shows a refusal, because a refusal
   is what exists.
   ============================================================ */
const pad = (s, n) => String(s).padEnd(n);
const SNIPPETS = {
  BRONZE: () => ({
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
  BFETCH: () => ({
    title: "head-object against the eight manifest pins",
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
    note: "Each pin re-checked against the live bucket on 2026-08-22."
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
      "2026-08-09   12159345  ...disposition_ensembl99.parquet",
      "2026-08-09       5532  ...parquet.provenance.json",
      "2026-08-07   40307760  minifin_rebuild_ensembl99.h5ad",
      "2026-08-07      13166  ...ensembl99.h5ad.provenance.json",
      "2026-08-07   45190039  minifin_rebuild_lawson.h5ad",
      "2026-08-07      13044  ...lawson.h5ad.provenance.json",
      "",
      "# no v1/ prefix. no CHANGELOG.md. six flat keys,",
      "# none newer than 2026-08-09."
    ].join("\n"),
    note: "The whole gap, in one listing."
  }),
  GOLD: () => ({
    title: "aws s3api head-bucket --bucket zsb-gold-library",
    body: [
      "An error occurred (403) when calling the HeadBucket",
      "operation: Forbidden",
      "",
      "$ aws s3 ls s3://zsb-gold-library/",
      "An error occurred (AccessDenied) when calling the",
      "ListObjectsV2 operation: User: arn:aws:sts::423623857952:",
      "assumed-role/ec2-s3-work-role/... is not authorized to",
      "perform: s3:ListBucket"
    ].join("\n"),
    note: "This is the whole of what is known about the gold tier from here. It is a refusal, not an inventory."
  }),
  MED: () => ({
    title: "zsb_medallion — the whole public surface",
    body: [
      "BRONZE   = 'zsb-bronze-fortknox'",
      "SILVER   = 'zsb-silver-warehouse'",
      "GOLD     = 'zsb-gold-library'",
      "SANDBOX  = 'zsb-sandbox'",
      "",
      "io:       S3IO, AtomicPath, S3File,",
      "          DownloadResult, UploadResult,",
      "          S3ObjectExistsError, S3ObjectMismatchError,",
      "          S3ShortUploadError, S3PublishPermissionError,",
      "          S3TransferError",
      "",
      "console:  Console, get_console, print_phase,",
      "          print_failure, byte_progress, unit_progress,",
      "          download_with_progress, upload_with_progress,",
      "          format_bytes, format_count"
    ].join("\n"),
    note: "Four strings and twenty names. That is the entire agreement between the tiers — and as of the v0.5.0 bump, zsb-bronze is the first repo to import from the console half of it."
  })
};

/* nodes whose claims rest on something this instance cannot check */
const UNVERIFIED = new Set(["GOLD"]);

const OVERVIEW = {
  eyebrow: "Zeroshot · the medallion data architecture",
  title: "Data Structures",
  sub: "three tiers · three hops · one of them has moved a byte",
  does: `<p>A plan of the medallion architecture, drawn straight down and read top to bottom.</p>
<p><mark>Down the left, the buckets</mark> — bronze, then silver, then gold, in tier order. That column is the data. <mark>Down the middle, the transforms</mark> — one repository per hop, each sitting in the gap between the two buckets it bridges, so a repo is always beside the seam it works on rather than beside a tier. <mark>Down the right, the contract</mark>: zsb-medallion, a single rail every transform taps and no bucket touches.</p>
<p>Each hop is two conduits and the pair is the whole shape of the map: out of a bucket's right wall into the repo (the <em>read</em>), then back out of the repo and down into the next bucket (the <em>write</em>).</p>
<p>This is a companion to <a href="/pipeline">/pipeline</a> and its opposite in two ways. That map is drawn on an isometric axonometric and is about <em>the platonic process</em> — how a zebrafish becomes an atlas, in general. This one is orthographic top-down and is about <em>the state of one system on one day</em>: what is in the buckets, what is in the repos, and where the two disagree.</p>
<p><mark>The reason it is worth drawing top down.</mark> Each bucket's contents are a squarified treemap by bytes, and area is the only honest encoding for a 466:1 ratio between bronze and silver. An isometric projection foreshortens one axis, so two tiles of equal area read as unequal depending on where they sit. Straight down, a square is a square everywhere on the canvas.</p>
<p><mark>How to read the conduits.</mark> A solid line with dots moving along it has carried bytes and can be shown to have. A dashed line is code that exists and has never run. There is exactly one solid line on this map.</p>`,
  built: `<p>Everything here was read on <mark>2026-08-22</mark> from the live AWS account and from the four repositories at their current main commits — zsb-medallion 2d165be, zsb-bronze 0414ac4, zsb-silver b4253a2, zsb-gold 59dabde. The repos were re-pulled and the whole map re-read after a run of work from Darien; the buckets came back byte-for-byte identical, and every figure that moved is in the repo column.</p>
<p>Bucket totals are <mark>aws s3 ls --recursive --summarize</mark>. Tiles aggregate those objects two path segments deep. The eight ingestion manifest entries were each re-checked with <mark>head-object</mark> — all eight matched size and etag, multipart etags included.</p>
<p>Repository figures are commit counts, author tallies and line counts taken from fresh clones, not from the READMEs.</p>
<p>Two things are on this map's edges and deliberately off it. The <mark>zsb-sandbox</mark> bucket — 706 objects, 64.6 GiB, mostly three STARsolo alignment arms — has no conduits in either direction by definition, so it is not a station here. And the pipeline that preceded these repos, whose output is what silver's minifin/ tile actually holds, is described in that tile's own notes rather than drawn as a second lane.</p>`,
  cond: `<p class="cond">The governing fact: <mark>of the three hops this architecture describes, one has run.</mark> Bronze into the bronze repo works, is fast, and verifies itself. Everything below the build step is written or specified and cold. Silver contains 79 objects and zero versioned releases; gold cannot be read from here at all.</p>
<p class="cond">The changelog problem is the sharpest one and the cheapest to fix. zsb-bronze's committed ledger describes a <mark>v1</mark> release dated 2026-08-22; silver has no <mark>minifin/v1/</mark> prefix. A ledger whose job is to index a bucket was written before the bucket was written to.</p>
<p class="cond">Three gates block everything below the first hop, and none is a research problem. The silver object-key convention is already settled on the bronze side and unreconciled on the silver side. The gold object-key convention blocks two repos from opposite directions at once. Only the gold v1 QC sign-off is a real question, and it is a question for a person, not a sprint.</p>
<p class="cond"><mark>What changed on the re-read, and what it says.</mark> Two of the three things this map called out on the repo side are fixed. All four repos now have CI that runs the real gate — <mark>make verify</mark> on every push and PR — with the private zsb-medallion dependency installed through a per-run GitHub App token, which was the exact blocker recorded here as unsolved. zsb-bronze's AGENTS.md no longer points contributors at a dead branch. And the console package, which this map described as built, tagged and unused, now has its first consumer.</p>
<p class="cond">The shape of what remains is worth naming, because the re-read sharpened it rather than changing it. <mark>Twelve commits landed in zsb-silver and six in zsb-gold, and between them they did not change one line of any transform</mark> — every one was CI, tooling, a Makefile or a lockfile. Both repos now have an excellent gate around three functions that raise. The work is going into the parts of these repos that do not need a decision, and the parts that do are untouched, which is what you would expect: the three gates are conventions and sign-offs, and no amount of tooling closes them.</p>
<p class="cond">One new crack, drawn on the contract rail's taps: the three transforms no longer agree on which version of the shared contract they import. zsb-bronze moved to <mark>v0.5.0</mark> to pick up the console helpers; zsb-silver and zsb-gold are still on <mark>v0.4.0</mark>. Nothing breaks today — the stubs that would notice do not run — but a shared vocabulary with three consumers on two versions is the thing this rail exists to prevent.</p>
<p class="cond">Two things could not be checked from this instance and are marked rather than assumed: whether the gold bucket has contents, and whether any bucket has the versioning, replication, encryption or lifecycle configuration the medallion README claims. Every bucket-level Get call is AccessDenied to the role this was read with.</p>
<p class="cond">One piece of pure waste, in the one tier nobody is allowed to clean up automatically: <mark>minifin/raw/fastq/</mark> and <mark>minifin/raw-fastq/</mark> hold the same 17 objects, 209 GiB duplicated.</p>`
};
