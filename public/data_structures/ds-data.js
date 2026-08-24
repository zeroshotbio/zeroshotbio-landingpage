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

   The single most important thing on it: of the FOUR hops the architecture
   describes, TWO have now run against the real buckets. The rest are wired,
   documented, and cold.

   THE STEEL THREAD — read this before any figure on the page
   Every worked example here is MINIFIN 100k: one 94,616-cell zebrafish
   chemical-perturbation dataset, carried end to end as a single thin slice
   through every tier. That is the whole idea of a steel thread — prove the
   entire path on one small real thing before widening it to the datasets
   that cost money.

   It is not a sample of the map, it IS the map's example:

     - every transform repo has exactly ONE dataset module, `minifin/`
     - every command on the page is a MiniFin command
     - the release that now exists is `minifin/v1/`
     - the notebook that has not landed is `notebooks/minifin/01_eda.ipynb`

   The MegaFin deliveries in bronze are drawn at true area because 92.2% of
   a 7 TiB bill is a fact worth seeing. They are NOT the thread, and no repo
   on this page reads them. If you add a station, say which of the two it is.

   Nodes on the thread carry `thread:true`, which flags them in the reader.

   NAMING
   The tiers are bronze, silver and gold. The buckets carry nickname suffixes
   for historical reasons — fortknox, warehouse, library — and those nicknames
   are shown once each, in the bucket's own subtitle, and used nowhere else.
   In the map, in the reader and in conversation the tiers are just their
   colours.

   WHERE THE NUMBERS COME FROM
   Every byte count, object count and etag below was read on 2026-08-24 from
   the live account (arn:aws:sts::423623857952:assumed-role/ec2-s3-work-role)
   and from the four repositories at these commits:

     zsb-medallion  00b71e8   main = v0.8.0 +4   83 commits   2,656 LOC
     zsb-bronze     6126161   main              153 commits   4,996 LOC
     zsb-silver     4a64566   main               34 commits     870 LOC
     zsb-gold       513ca22   main               30 commits      93 LOC

   Bucket totals are the `aws s3 ls --recursive --summarize` figures; prefix
   tiles are those objects aggregated two segments deep. LOC is every .py
   under src/ and tests/; a per-module figure is src/ only. The eight bronze
   manifest entries were each confirmed with head-object on the same read —
   all eight matched size and etag, for the third read running.

   THIRD READ — 2026-08-24. THE LEFT COLUMN MOVED.
   The first two reads found the buckets byte-for-byte identical and all the
   movement in the repo column. This one is the other way round, because a
   step on the right finally ran:

   - `minifin/v1/` EXISTS. On 2026-08-23 at 00:21:59 UTC the bronze publish
     step wrote a 1,561,917,184-byte artifact into the warehouse, its README
     at 00:22:28, and the ledger at the same moment — objects first, ledger
     after, which is the order that was wrong the last two times this map was
     read. The sharpest finding this page has ever carried is closed, and it
     was closed by publishing the release rather than by retracting the note.
   - SILVER IS 82 OBJECTS / 18,154,728,187 B, up three objects and 1.46 GiB,
     all of it that release. Bronze is unchanged to the byte. Gold still
     refuses both ListBucket and HeadBucket.
   - zsb-silver's FETCH IS WRITTEN, and pinned to that exact object by size
     and ETag. It has not been run from here and nothing in the account could
     show that it had, so it is drawn in the new third cell state: solid box,
     hollow lamp — built, not yet lit.
   - THE CONTRACT DIVERGENCE IS CLOSED. All three transforms pin v0.8.0,
     carried there by a `bump-consumers` workflow in zsb-medallion that opens
     a PR against each consumer on a version tag. The taps agree again.
   - THE RAIL BECAME A LIBRARY. `zsb_medallion.fetch` is new and both working
     fetches run on it, so a change there can now break a transform in a way
     that renaming a constant never could.
   - Both working repos gained a `pins` command: check the declared objects
     against the live bucket, exit non-zero on drift. The most perishable
     claims on this page are now something CI can be asked.

   WHAT IS NOT KNOWN, AND IS MARKED AS NOT KNOWN
   - The gold bucket's contents. The role this was read with has no
     s3:ListBucket on zsb-gold-library, and HeadBucket returns 403. The map
     says "contents unknown", never "empty".
   - Cross-region replication, and lifecycle configuration, on any bucket.
     Every GetBucket* call is AccessDenied to this role.
   - Versioning and encryption at rest are NO LONGER unknown. Both were
     answered by going around the closed door rather than through it: a
     head-object on any key in bronze or silver returns a VersionId and
     ServerSideEncryption: AES256. If you need another bucket-level fact and
     the door is shut, look at what the object responses already carry.
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
 brief:"The sealed raw tier, and the only one a person may write to. Everything below it is derivable; this is not. 1,258 objects, 7.03 TiB, every one of them STANDARD storage — no Glacier, no tiering, for an archive that is written once. The tiles are drawn by true area: MegaFin's three deliveries are 92.2% of the tier, and <mark>MiniFin — the steel thread, the dataset the whole pipeline was proven against — is the 7.8% sliver</mark> called out below the wall. 209 GiB of the tier is one prefix duplicated.",
 does:"The sealed raw tier, and the only one on this map a person is allowed to write to. Everything below it is derivable: if silver and gold both burned down they could be rebuilt from this bucket plus the repos. This bucket could not be rebuilt from anything. That is the rule that decides what belongs here — <mark>anything we cannot regenerate from code plus a lower tier</mark> — and it is why 7 TiB of vendor deliverables sit in one place with the write path closed.",
 built:"Four datasets, 1,258 objects, 7,730,616,859,647 bytes read on 2026-08-24, unchanged to the byte across three reads. Every object is in the STANDARD storage class — there is no Glacier or Intelligent-Tiering anywhere in the bucket, which for 7 TiB of write-once archive is a standing monthly cost and a decision nobody has recorded making. The tiles are drawn by area: MegaFin's three deliveries are 92.2% of the tier between them, and MiniFin — the dataset the entire pipeline has been built and proven against — is the 7.8% tile.",
 cond:"Three things. First, <mark>minifin/raw/fastq/ and minifin/raw-fastq/ are the same 17 objects twice</mark> — identical names and sizes, 209 GiB duplicated, 2.9% of the tier held for nothing. Nothing on this instance settles which prefix is the orphan, and the rule for this bucket is that a person deletes it, not a script. Second, eight per-sublibrary QC summaries sit in <mark>minifin/parse-output/qc/</mark> and are excluded from the ingestion manifest <em>by name</em>: their sublibN labels do not match the barcode __sN suffix, so pairing them by name selects the wrong cells from every sublibrary and still totals exactly 94,616. No count-based check catches that. Third, the medallion README says this tier is versioned and cross-region replicated. <mark>Half of that is now confirmed, by a route around the closed door</mark>: every bucket-level Get call is still AccessDenied, but a <mark>head-object</mark> on any key comes back carrying a <mark>VersionId</mark> and <mark>ServerSideEncryption: AES256</mark> — so this bucket is versioned and encrypted at rest, and both were previously written down here as unknown. Replication is still unconfirmed. No object returns a <mark>ReplicationStatus</mark> header, which is suggestive and not decisive: that header only appears where a replication rule actually covers the object.",
 kv:[["Bucket","zsb-bronze-fortknox"],["Objects","1,258"],["Size","7.03 TiB (7,730,616,859,647 B)"],["Storage class","STANDARD, all 1,258"],["Versioned","yes — every object carries a VersionId"],["Encrypted","AES256 at rest"],["Written by","humans only"],["Read on","2026-08-24 — unchanged"]]},

/* ================= THE BRONZE → SILVER TRANSFORM ================= */
{id:"BREPO", key:"2", group:"② Bronze → Silver", groupMark:true, anchor:true,
 shape:"floor", tier:"bronze", state:"live",
 name:"zsb-bronze", repo:"zsb-bronze", right:"153 commits · 4,996 LOC",
 x:COL_REPO, y:21, w:22, h:18.5,
 sub:"reads bronze · writes silver · the only repo here that has run",
 thread:true,
 brief:"The transform for the first hop, and <mark>the repo that has now moved bytes in both directions</mark> — 944 MiB down out of bronze, 1.45 GiB up into silver. Named for the tier it <em>reads</em>, not the one it writes. One dataset module, minifin/, implemented end to end in 2,680 lines behind six commands. 153 commits from six contributors. Every failing this map has recorded here is now retired: CI runs make verify, AGENTS.md points at main, and the contract divergence closed when all three transforms landed on v0.8.0.",
 does:"The transform for the first hop. Named for the tier it <em>reads</em>, not the one it writes — the convention that makes this whole column unambiguous: zsb-bronze reads bronze and writes silver, zsb-silver reads silver and writes gold, zsb-gold only reads.",
 built:"One dataset module, <mark>minifin/</mark>, implemented end to end: 2,680 lines under src, eleven test files, and six commands. The entry point changed shape — it is <mark>zsb-bronze</mark> now, one command per repo, with each dataset a subcommand group beneath it: <mark>zsb-bronze minifin fetch</mark>, <mark>process convert</mark>, <mark>process build</mark>, <mark>process all</mark>, <mark>publish</mark>, and a new <mark>pins</mark>. Silver and gold adopted the same shape, so the three repos now read the same way from the command line. 153 commits since 2026-07-22 — Darien 97, Steve 52 across two identities, Creighton 2, one from CI and one from Claude.",
 cond:"<mark>There is nothing left in this repo that this map has ever recorded as a failing.</mark> CI runs make verify on every push and PR; AGENTS.md points at main; the contract divergence closed when the bump-consumers workflow carried all three transforms to v0.8.0. The publish step has run. What is worth watching instead is a new habit: the repo now has a <mark>pins</mark> command that checks all eight manifest objects against Fort Knox and exits non-zero if any moved. That is the one claim on this map that could go stale silently, and it is now something a machine can be asked rather than something a person remembers to re-check. It writes nothing — Fort Knox is human-owned, so drift is a finding, not a file to regenerate.",
 kv:[["Repo","zeroshotbio/zsb-bronze"],["HEAD","6126161 (main)"],["Commits","153, since 2026-07-22"],["Source","4,996 LOC · 2,680 in minifin/"],["Tests","11 files · CI runs make verify"],["Entry point","zsb-bronze minifin <command>"],["Depends on","zsb-medallion @ v0.8.0"],["Open PRs","0"]]},

{id:"BFETCH", key:"2a", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"fetch", cellName:"fetch", note:"8 of 1,258 objects · 944 MiB",
 x:COL_REPO, y:16.05, w:19, h:3.4,
 sub:"fetch/ · manifest.py + fetch.py · 244 LOC",
 thread:true,
 brief:"Mirrors eight named objects out of bronze, checking each one's size and etag against a pin before it lands on disk. <mark>Eight names — not a prefix, not a sync.</mark> That choice is why this hop is cheap: a prefix sync of minifin/ pulls 562 GiB, this pulls 944 MiB, and it is everything conversion and cell-calling actually read. All eight pins re-verified against the live bucket on 2026-08-24, multipart etags included, and the repo now carries a <mark>pins</mark> command that runs exactly that check. This was the one step in the architecture demonstrably moving bytes; as of 2026-08-23 it is no longer the only one.",
 does:"Mirrors eight named objects out of bronze, validating each one's size and etag against a pin before it is written to disk. This is the one step in the entire architecture that has demonstrably moved bytes between a real bucket and a real machine.",
 built:"The manifest is the most consequential twelve lines of configuration in the architecture, and the reason this hop is cheap. It is a list of eight object keys, each pinned to an exact size and an exact etag. <em>Not a prefix. Not a sync. Eight names.</em> The same Parse delivery holds ~225 GB of raw FASTQ and ~135 GB of split-pipe intermediates in adjacent prefixes; a prefix sync of minifin/ pulls 562 GiB and a very large egress bill. This pulls 944 MiB — about 0.16% of the dataset's own prefix — and it is everything conversion and cell-calling actually read. Downloads through <mark>zsb_medallion.io.S3IO</mark>, so the repo carries no boto3 of its own, and now reports through <mark>zsb_medallion.console.download_with_progress</mark> as it goes.",
 cond:"All eight pins were re-confirmed against the live bucket on 2026-08-24 — every size and every etag matched, multipart etags included, for the third read running. That is a real check and it passed. What it does not tell you is whether the pins would survive a re-upload: an S3 multipart etag depends on the part size the uploader chose, so re-uploading byte-identical content with a different chunk size changes the etag and this manifest would reject a file identical to the one it wants.",
 kv:[["Command","uv run zsb-bronze minifin fetch"],["Drift check","zsb-bronze minifin pins"],["Keys pinned","8"],["Bytes pinned","989,650,630 (944 MiB)"],["Share of minifin/","0.16%"],["Verified","2026-08-24 — 8/8 size + etag"],["State","implemented and exercised"]]},

{id:"BCONV", key:"2b", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"convert", cellName:"process convert", note:"279M entries · ~150 MB peak",
 x:COL_REPO, y:19.95, w:19, h:3.4,
 sub:"process/convert.py · 490 LOC",
 thread:true,
 brief:"Streams Parse's unfiltered MiniFin triplet into an h5ad instead of loading it whole. The combined MatrixMarket holds roughly 279 million non-zero entries; blocks of 100,000 cells are appended to an on-disk CSR matrix, so peak memory on the measured run was about <mark>150 MB against a 2,743,021 × 32,520 matrix</mark>. Writes through AtomicPath, so a killed run leaves no half-written file where a good one should be. The intermediate is local and gitignored — correct for the tier rules, but it does mean the expensive step is thrown away between runs.",
 does:"Streams the unfiltered Parse triplet into an h5ad instead of loading it whole. Parse ships one combined MatrixMarket of roughly 279 million non-zero entries; blocks of <mark>chunk_cells</mark> rows are appended to an on-disk CSR matrix.",
 built:"Default chunk is 100,000 cells. Peak memory on the measured run was about 150 MB — against a 2,743,021 × 32,520 matrix. Writes through zsb_medallion's AtomicPath, so a killed run leaves no half-written file where a good one should be.",
 cond:"The intermediate is local only and gitignored. It is not published anywhere and is reproducible only from bronze — correct for the tier rules, but it does mean the expensive step is thrown away between runs. The command moved under a <mark>process</mark> group in the CLI restructure; the stage itself did not change shape, it gained progress seams — an <mark>on_start</mark> that fires once and an <mark>on_block</mark> per chunk — so a run that streams 279 million entries now says how far along it is.",
 kv:[["Command","uv run zsb-bronze minifin process convert"],["Matrix","2,743,021 × 32,520"],["Non-zeros","~279 million"],["Peak memory","~150 MB"],["Also runs under","process all"]]},

{id:"BBUILD", key:"2c", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"build", cellName:"process build", note:"94,616 cells · jaccard 1.0000",
 x:COL_REPO, y:23.85, w:19, h:3.4,
 sub:"process/ · cells, corrections, provenance, validate · 1,080 LOC",
 thread:true,
 brief:"Calls cells, applies the mandatory corrections, stamps provenance into .uns, validates, and writes the silver artifact. The canonical policy reads Parse's own per-slice thresholds and reproduces the delivered barcode set exactly — <mark>94,616 cells, jaccard 1.0000</mark>, a set match rather than a count match. The corrections are only the three nobody would argue about: Ctrl→DMSO, one typo, and five asterisk-merged samples split back out into 48 replicates. This is where the tier rule bites: silver is counts plus corrections and no judgment calls.",
 does:"Calls cells, applies the mandatory corrections, stamps provenance into <mark>.uns</mark>, validates the schema, and writes the silver artifact. This is where the tier rule bites: silver is counts plus corrections and <em>no judgment calls</em> — if two scientists would pick different values, it is not silver, it is gold.",
 built:"Three cell-calling policies, in decreasing fidelity. <mark>parse-cutoffs</mark> is canonical: it reads Parse's per-(sample, sublibrary) thresh_raw and applies round(thresh_raw) per slice, reproducing the delivered barcode set <em>exactly</em> — 94,616 called, jaccard 1.0000, a set match rather than a count match. parse-settings reaches 94,876 (+260, jaccard 0.9940); barcode-ranks, a port of the DropletUtils search that takes no Parse threshold as input, reaches 94,338 (−278, jaccard 0.9827). The corrections are the three that are not judgment calls: Ctrl→DMSO, the Dapaglifozan typo→Dapagliflozin, and splitting five asterisk-merged samples back to two wells each, recovering 48 replicates from 43 Parse samples.",
 cond:"Exact parity <em>requires</em> the per-slice cut, and that is structural rather than a matter of tuning: split-pipe called cells per sample <em>and</em> sublibrary, and for all 43 samples the per-sample minimum called count falls below the maximum uncalled count. The per-sample policies therefore cannot reach 94,616 however they are tuned, and AGENTS.md warns against trying.",
 kv:[["Command","uv run zsb-bronze minifin process build"],["Cells called","94,616 of 2,743,021 barcodes"],["Genes","32,520"],["Non-zeros","193,544,653 · CSR int32"],["Replicates","48, from 43 Parse samples"],["Policy","parse-cutoffs (exact)"],["Also runs under","process all — stops on the first failure"]]},

{id:"BPUB", key:"2d", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"publish", cellName:"publish", note:"ran 2026-08-23 · v1 in the warehouse",
 x:COL_REPO, y:27.75, w:19, h:3.4,
 sub:"publish/publish.py · the second hop, and it has now run",
 thread:true,
 brief:"Uploads one MiniFin silver release — the artifact, its README and the changelog — under minifin/&lt;version&gt;/. Version prefixes are immutable, the ledger is the only object ever replaced, and there is no delete path. <mark>It has run.</mark> On 2026-08-23 at 00:21 UTC it wrote v1 into the warehouse: 1.45 GiB of validated h5ad, its README, and the ledger above it. The largest gap this map has ever recorded — a changelog indexing a release that did not exist — is closed, and closed in the right order: objects first, ledger after.",
 does:"Uploads one silver release — the validated h5ad, the dataset README, and the changelog — under <mark>minifin/&lt;version&gt;/</mark>. Publication is deliberately a separate act from the build, so writing to a shared bucket is always something a person chose to do.",
 built:"Version prefixes are immutable by default; <mark>--overwrite</mark> is an explicit override meant for retrying a failed prefix, not for corrections — a correction is a new version. The one always-mutable object is the ledger at <mark>minifin/CHANGELOG.md</mark>. There is no delete path at all: removing a released object is a human console act. Re-validates the annotation schema on a backed read before uploading, so a stamped-but-wrong file is rejected at the door — and the changelog gate is now enforced <em>inside</em> <mark>publish_release</mark> rather than by the caller, so there is no path to the bucket that skips it. <mark>--verify-matrix full</mark> is a new opt-in that re-checks the artifact end to end instead of sampling it.",
 cond:"<mark>It ran, and the ledger now indexes something.</mark> <mark>minifin/v1/minifin.h5ad</mark> was written at 00:21:59 UTC on 2026-08-23, the README at 00:22:28, the ledger at the same moment — objects first, ledger after, which is the order that was wrong when this map last recorded it. What remains is a version drift and it is the ordinary kind: the release note records <mark>Built with: zsb_bronze 0.1.0, zsb_medallion 0.5.0</mark> and the repo now pins medallion v0.8.0, so reproducing this artifact means checking the tree back out to the commit that built it. Worth stating once because a release note is a reproduction claim, and worth distinguishing from the previous version of this note, which recorded the same drift for a release that did not exist.",
 kv:[["Command","uv run zsb-bronze minifin publish"],["Wrote","s3://zsb-silver-warehouse/minifin/v1/"],["Ran","2026-08-23 00:21:59 UTC"],["Artifact","1,561,917,184 B · 1.45 GiB"],["Ledger","minifin/CHANGELOG.md, written after"],["Built with","zsb_medallion 0.5.0 — repo now pins 0.8.0"],["Delete path","none"]]},

/* ================= THE GAP, ON THE WRITE CONDUIT ================= */
{id:"SGAP", key:"3", group:"③ The first release", groupMark:true, anchor:true,
 shape:"bay", tier:"silver", filled:true,
 name:"minifin/v1/ — the release that landed", x:CORRIDOR, y:32, w:9.4, h:6,
 headline:"landed 2026-08-23",
 lines:["minifin.h5ad · 1.45 GiB", "README.md · 9.9 KiB", "CHANGELOG.md · 1.5 KiB"],
 sub:"published by zsb-bronze · the second hop has run",
 thread:true,
 brief:"<mark>This bay was empty on every previous read of this map, and it is not empty now.</mark> On 2026-08-23 at 00:21 UTC the publish step ran for the first time and wrote the release it had been describing since the 22nd: the validated artifact at 1.45 GiB, the dataset README beside it, and the ledger one level up. The convention the bronze side settled and wrote down is now a convention with an instance. Two of the architecture's four hops have carried bytes.",
 does:"The first object set in the silver tier written under the versioned convention, by the repo meant to write it. Three objects: the validated artifact under <mark>minifin/v1/</mark>, the dataset README beside it, and the mutable ledger at <mark>minifin/CHANGELOG.md</mark>, one level above the version prefixes.",
 built:"The key convention, now with an instance to point at: the bucket is the tier, so keys carry no <mark>silver</mark> segment; artifacts live under <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> and are immutable; the ledger sits above the version prefixes and is the sole object ever replaced. Timestamps put the artifact at 00:21:59 and the README and ledger at 00:22:28 — the ledger written after the objects it indexes, which is the order that was wrong the last time this map was read.",
 cond:"Two notes, neither of them a hole. The release note records <mark>Built with: zsb_bronze 0.1.0, zsb_medallion 0.5.0</mark>, and bronze now pins medallion v0.8.0 — so the artifact in the bucket cannot be reproduced from today's tree without checking the tree back out. That is ordinary for a versioned release and is only worth saying because the previous version of this note recorded the same drift when the release did not exist. And <mark>zsb-silver has pinned this object's exact size and ETag</mark> in its own source: 1,561,917,184 bytes, etag 9ce4a7f9…-187. Both were re-checked against the live bucket on 2026-08-24 and both match, so the next tier's input is now a named object rather than a description of one.",
 kv:[["Prefix","minifin/v1/"],["Objects","2, plus the ledger above them"],["Artifact","1,561,917,184 B (1.45 GiB)"],["ETag","9ce4a7f95864628bd9e482e7388bc0d8-187"],["Written","2026-08-23 00:21:59 UTC"],["Verified","2026-08-24 — size + etag"]]},

/* ================= SILVER ================= */
{id:"SILVER", key:"4", group:"④ Silver", groupMark:true, anchor:true,
 shape:"vault", tier:"silver", doors:["r"],
 name:"Silver", bucket:"SILVER", right:"82 obj · 16.91 GiB",
 x:COL_BUCKET, y:34, w:24, h:15,
 sub:"s3://zsb-silver-warehouse · written by zsb-bronze",
 tiles:[
   {key:"zebrahub/",  value:11127199502, objs:12},
   {key:"megafin-1/", value:5367910950,  objs:61},
   {key:"minifin/",   value:1659617735,  objs:9},
 ],
 brief:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. The hinge of the architecture — the last tier where the data is still just what was measured. 82 objects, 16.91 GiB, <mark>0.23% the size of bronze</mark>, which is the medallion idea working as intended. The <mark>minifin/</mark> tile is seventeen times the size it was on the last read, and the reason is one object: the first release written under the versioned convention, by the repo meant to write this tier. This bucket has stopped being full of things and empty of releases.",
 does:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. This is the hinge of the architecture — the last tier where the data is still <em>just what was measured</em>. Everything below it is opinion, versioned and defensible, but opinion.",
 built:"82 objects, 18,154,728,187 bytes, read 2026-08-24 — three objects and 1.46 GiB more than the last read, all of them the v1 release and its ledger. It is 0.23% the size of bronze, which is the medallion architecture working exactly as intended: 7 TiB of vendor deliverables reduce to 17 GiB of counts.",
 cond:"<mark>One of the three tiles is now a real release, and the other two are what they were.</mark> The <mark>minifin/</mark> tile holds nine objects: the six flat keys the previous pipeline left, plus <mark>v1/minifin.h5ad</mark>, <mark>v1/README.md</mark> and the ledger — the first objects in this bucket to follow the <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> convention the code enforces, and 94% of the tile's bytes. The old six are still there beside it, unversioned, provenance in sidecars: a released prefix does not tidy up what preceded it, and nothing on this map proposes deleting them. The other two tiles are unchanged and were not written by these repos either. <mark>zebrahub/</mark> (10.4 GiB, 12 objects, 2026-07-27) predates the zsb-* repos entirely and is the placeholder both zsb-silver and zsb-gold have since deleted from their own source trees as 'not the shape the real transforms take'. <mark>megafin-1/characterization/</mark> (5.0 GiB, 61 objects) is an analysis working set — scripts, CSVs, diff reports and a 4.9 GiB h5ad — not a published artifact, and it has no version prefix. <mark>minifin/</mark> (93 MiB, 6 objects, called out in red on the map) is the previous pipeline's output: flat keys, provenance in a sidecar object rather than stamped inside the artifact, and the reference encoded in the filename. Not one object in this tier follows the <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> convention the code enforces. Silver is full of things, and empty of releases.",
 kv:[["Bucket","zsb-silver-warehouse"],["Objects","82"],["Size","16.91 GiB (18,154,728,187 B)"],["vs bronze","0.23%"],["Versioned releases","1 — minifin/v1/"],["Written by zsb-bronze","1.45 GiB, on 2026-08-23"],["Read on","2026-08-24"]]},

/* ================= THE SILVER → GOLD TRANSFORM ================= */
{id:"SREPO", key:"5", group:"⑤ Silver → Gold", groupMark:true, anchor:true,
 shape:"floor", tier:"silver", state:"stub",
 name:"zsb-silver", repo:"zsb-silver", right:"34 commits · 870 LOC",
 x:COL_REPO, y:45, w:22, h:14.6,
 sub:"reads silver · writes gold · one step written, two gates left",
 thread:true,
 brief:"The transform for the second hop, and where the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, annotation — everything the silver tier refused to decide. <mark>The first of its three steps is now written.</mark> 870 lines, up from 155, and fetch is real: it names the exact release object, pins its size and ETag, and plans every download before a byte moves. Two stubs remain and both are the same kind of thing they always were — a sign-off and a key convention, not an algorithm.",
 does:"The transform for the second hop, and the place the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, cell-type annotation. Everything the silver tier refused to decide.",
 built:"870 lines across twelve source files and six tests — the repo has stopped being a scaffold with a docstring checker. <mark>fetch</mark> is implemented and it is implemented by delegation: <mark>release.py</mark> declares the one object that makes up the release and pins its size and ETag, <mark>config.py</mark> derives the local paths from the release version so two versions can sit side by side, and <mark>fetch.py</mark> is 67 lines that hand those facts to zsb-medallion's shared batch fetch. The mechanics — key guards, the plan model, the transfer loop — live once, on the rail. There is a <mark>pins</mark> command here too, checking the release against the warehouse the way bronze checks the manifest against Fort Knox.",
 cond:"<mark>The gate this map has complained about twice is gone, and it was closed the way it was always going to be: by somebody writing down the key.</mark> The reading side used to be blocked on a convention the writing side had already chosen; that reconciliation happened, and what came out is not a convention but a named object with a pinned identity. The two remaining stubs are still <em>conventions and sign-offs rather than algorithms</em> — the Gold v1 QC sign-off, and the gold object-key format — and no amount of tooling closes either. This repo also carries the only open pull request in the set: <mark>#17, porting Trailmaker QC steps 3 and 4 and naming the parse recipe</mark>, which is the first work anywhere on this map aimed at the sign-off rather than around it. Worth watching on the next read.",
 kv:[["Repo","zeroshotbio/zsb-silver"],["HEAD","4a64566 (main)"],["Commits","34, since 2026-07-22"],["Source","870 LOC · 366 in minifin/"],["Tests","6 files"],["Steps written","1 of 3 — fetch"],["Depends on","zsb-medallion @ v0.8.0"],["Open PRs","#17 — Trailmaker QC steps 3 and 4"],["Bytes moved","0 — the fetch has not been run from here"]]},

{id:"SFETCH", key:"5a", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"ready",
 name:"fetch (silver)", cellName:"fetch", note:"written · pinned to a real object · not yet run",
 x:COL_REPO, y:42.0, w:19, h:3.4,
 sub:"fetch/ · release.py + config.py + fetch.py · 154 LOC",
 thread:true,
 brief:"Downloads the MiniFin silver release the bronze repo published. <mark>Written, and pinned to an object that exists</mark> — one key, minifin/v1/minifin.h5ad, with its size and ETag written into the source. The stub this replaces was gated on a key convention the writing side had already settled; the reconciliation is what this step is. Both halves were re-checked against the live warehouse on 2026-08-24 and match. It is drawn cold because nothing on this map can show it has been run — a fetch lands on a machine, not in a bucket.",
 does:"Downloads the pinned MiniFin silver release into the local workspace, refusing the transfer if the live object's size or ETag differs from the pin. That refusal is the point: it is a refusal to trust the warehouse, not a transfer failure.",
 built:"<mark>A named key, never a prefix listing</mark> — for the same reason the bronze manifest is eight names, and one more besides: the warehouse still holds the previous pipeline's flat exploratory objects at the dataset root, so a glob would sweep them up alongside the release. 154 lines across three small modules. The mechanics are not here: <mark>zsb_medallion.fetch</mark> owns the key guards, the plan model and the transfer loop, and this repo supplies the three MiniFin facts they need. The local path carries the release version, so two silver versions can sit side by side without one overwriting the other.",
 cond:"It has not been run from here, and this map cannot tell you whether it ever will be without somebody saying so — a fetch writes to a working directory, and a working directory is not in the account. What can be said is that it would now succeed: <mark>1,561,917,184 bytes, etag 9ce4a7f9…-187</mark>, checked against the live object on 2026-08-24 and matching. The step below it is the one that cannot run, and it is gated on a human decision rather than on anything this step does.",
 kv:[["Command","uv run zsb-silver minifin fetch"],["Drift check","zsb-silver minifin pins"],["Keys pinned","1"],["Bytes pinned","1,561,917,184 (1.45 GiB)"],["Verified","2026-08-24 — size + etag match"],["State","written · not run from here"]]},

{id:"SPROC", key:"5b", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"process (silver→gold)", cellName:"process", note:"gated: gold v1 QC sign-off",
 x:COL_REPO, y:45.9, w:19, h:3.4,
 sub:"build_gold() → raises NotImplementedError",
 thread:true,
 brief:"The heaviest step in any tier, and the only one on this map genuinely unbuilt rather than merely unrun. Docstring only — but the docstring is a real specification: raw counts preserved in layers['counts'] before .X is touched, and every parameter, seed, version and cell-count transition stamped into .uns. Thresholds come from Parse's recorded settings.txt, which is why that file is pinned in the bronze manifest. <mark>Gated on 'Gold v1 QC sign-off'</mark> — a human decision nobody has made, and the one real question on this map.",
 does:"The heaviest step in any tier, and the only one on this map that is genuinely unbuilt rather than merely unrun. QC and doublet filtering with fixed seeds, normalization and log1p, HVGs, batch-aware embeddings, clustering, and cell-type annotation.",
 built:"Docstring only, but the docstring is a real specification: raw counts preserved in <mark>layers['counts']</mark> before .X is touched, and every parameter, seed, version and cell-count transition stamped into <mark>.uns</mark>. It also fixes where the thresholds come from — Parse's recorded settings.txt, not inferred defaults — which is why settings.txt is pinned in the bronze manifest two stations up even though the canonical cell-calling policy does not read it.",
 cond:"Gated on 'Gold v1 QC sign-off', which is a human decision nobody has made. This is the one gate on the map that is a real question rather than a naming argument: it asks which QC thresholds this company is prepared to defend, and that is exactly the judgment call the silver tier exists to defer.",
 kv:[["Function","build_gold(source, destination)"],["State","raises NotImplementedError"],["Gate","gold v1 QC sign-off — unmade"],["Thresholds from","Parse settings.txt"],["Preserves","layers['counts'] before .X changes"]]},

{id:"SPUB", key:"5c", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"publish (gold)", cellName:"publish", note:"gated: gold object-key convention",
 x:COL_REPO, y:49.8, w:19, h:3.4,
 sub:"publish_gold() → raises NotImplementedError",
 thread:true,
 brief:"Would upload one validated MiniFin gold h5ad under a versioned, non-overwriting key, and would never publish an unvalidated artifact. Docstring only. Deliberately separate from the build, for the same reason the bronze publish is: writing to a shared bucket should be something a person chose to do. Gated on the gold object-key convention — the same argument as the silver one, one tier along. <mark>That single unwritten paragraph blocks this step and zsb-gold's download at the same time</mark>, from opposite directions.",
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
 brief:"The terminal tier: analysis-ready, immutable, versioned, and what every model downstream actually trains on. Nothing writes here but zsb-silver; nothing reads it but zsb-gold and the people using it. <mark>This tier is drawn empty because it is unknown, not because it is known to be empty.</mark> ListBucket is AccessDenied and HeadBucket returns 403 — from here you cannot even establish the bucket exists, only that something at that name refuses you. What can be said: nothing upstream has ever been able to write here, because the silver publish raises on every call.",
 does:"The terminal tier: analysis-ready, immutable, versioned, and the thing every model downstream is actually trained on. Nothing writes to it but zsb-silver, and nothing reads it but zsb-gold and the people using them.",
 built:"Nothing observable. The bucket is named in <mark>zsb_medallion.GOLD</mark> and referenced by both neighbouring repos, and that is the full extent of what can be confirmed from here.",
 cond:"<mark>This tier is drawn empty because it is unknown, not because it is known to be empty.</mark> The pipeline role has no s3:ListBucket on it and HeadBucket returns 403 — it cannot even establish that the bucket exists in this account, only that something at that name refuses it. The distinction matters: an empty gold tier and an unreadable one call for completely different next actions, and no artefact on this instance settles which it is. What can be said is that nothing upstream has ever been in a position to write here — the silver publish step raises on every call.",
 kv:[["Bucket","zsb-gold-library"],["ListBucket","AccessDenied to the pipeline role"],["HeadBucket","403 Forbidden"],["Objects","unknown"],["Ever written by zsb-silver","no — publish_gold raises"],["Read on","2026-08-24 — same refusal"]]},

/* ================= THE GOLD READER ================= */
{id:"GREPO", key:"7", group:"⑦ Gold — the reader", groupMark:true, anchor:true,
 shape:"floor", tier:"gold", state:"stub",
 name:"zsb-gold", repo:"zsb-gold", right:"30 commits · 93 LOC",
 x:COL_REPO, y:66, w:22, h:10.7,
 sub:"reads gold · publishes nothing · the terminal repo",
 thread:true,
 brief:"The consumer end. Downloads and validates released gold artifacts and hosts the starter notebooks. It is <mark>the only repo in the architecture with no write path at all</mark> — by design, not omission, which is why nothing leaves it on this map. 93 lines: a package init, a minifin module, one fetch stub, and the docstring test. Ten commits since the last read and <mark>one line of source</mark>: everything else was CI, docs and the contract bump. It is the far end of the thread, and the last station on this map that has not moved.",
 does:"The consumer end. Downloads and validates released gold artifacts and hosts the starter analysis notebooks. It is the only repo in the architecture with no write path at all — by design, not by omission, which is why nothing leaves it on this map.",
 built:"92 lines: a package init, a minifin module, one fetch stub, and the docstring-convention test. Plus <mark>notebooks/minifin/README.md</mark>, which describes an <mark>01_eda.ipynb</mark> that has not landed.",
 cond:"Blocked on the same unwritten gold key convention, and the README states the reason precisely: the previous download flow prefix-listed the bucket and pulled everything it found, which does not survive immutable versioned keys — a fresh clone would download every version ever released. So the pull must name one release, and the shape of that name has not been agreed. <mark>Which is now the one gate on this map with a worked example sitting one tier above it</mark>: zsb-silver answered the same question for the silver tier by naming the key and pinning its identity, and that answer is in a file anybody can read. The ten commits here since the last read were CI, docs and the medallion bump; the stub is the same stub. It is on v0.8.0 with the rest, and its previously open Makefile PR is merged.",
 kv:[["Repo","zeroshotbio/zsb-gold"],["HEAD","513ca22 (main)"],["Commits","30"],["Source","93 LOC — one line more than the last read"],["Tests","1 file — the docstring checker"],["Depends on","zsb-medallion @ v0.8.0"],["Write path","none, by design"],["Open PRs","0"],["Notebooks","1 README, 0 notebooks"]]},

{id:"GFETCH", key:"7a", group:"⑦ Gold — the reader", shape:"cell", tier:"gold", state:"stub",
 name:"fetch (gold)", cellName:"fetch", note:"gated: versioned-key convention",
 x:COL_REPO, y:64.95, w:19, h:3.4,
 sub:"download_gold() → raises NotImplementedError",
 thread:true,
 brief:"Would download one released MiniFin gold artifact. Docstring only. Its named blocker is precise and worth keeping: <mark>'a clone must pull one release, not every version'</mark>. The previous download flow prefix-listed the bucket and pulled everything it found, which does not survive immutable versioned keys — a fresh clone would drag down every version ever published. So the pull has to name one release, and the shape of that name is the paragraph nobody has written. The same paragraph unblocks the silver publish step one tier up.",
 does:"Would download one released MiniFin gold artifact.",
 built:"Docstring only.",
 cond:"Named blocker: 'a clone must pull one release, not every version'. The same paragraph that unblocks the silver publish step unblocks this one.",
 kv:[["Function","download_gold(destination)"],["State","raises NotImplementedError"],["Gate","versioned-key convention (shared with the silver publish)"]]},

{id:"GNB", key:"7b", group:"⑦ Gold — the reader", shape:"cell", tier:"gold", state:"stub",
 name:"the starter notebooks", cellName:"notebooks", note:"1 README · 0 notebooks",
 x:COL_REPO, y:68.85, w:19, h:3.4,
 sub:"notebooks/minifin/README.md",
 thread:true,
 brief:"Where the analysis that consumes a MiniFin gold release is meant to live. One README, describing an 01_eda.ipynb that has not landed. The README specifies it well: load the artifact, show its provenance, validate shape, layers, required metadata and embeddings, then summarise QC distributions and perturbation, replicate and cell-type balance. Generated files go to a gitignored path or the sandbox, never back under a gold key. <mark>It is the far end of the steel thread</mark> — everything above it has to work before one line of it can run.",
 does:"Where the analysis that consumes a gold release is meant to live. One README, describing an <mark>01_eda.ipynb</mark> that has not landed.",
 built:"The README specifies the notebook well: load the downloaded gold artifact, show its source and preprocessing provenance, validate shape, layers, required metadata and embeddings, and summarise QC distributions and perturbation / replicate / cell-type balance. Generated files go to a gitignored path or the sandbox bucket, never back under a gold key.",
 cond:"It cannot be written before there is an artifact to open, and it is the last thing in the chain — which makes it a useful test of the whole map. Everything above this cell has to work before a single line of it can run.",
 kv:[["Path","notebooks/minifin/"],["Files","README.md"],["Notebooks","0"],["Writes to","gitignored paths or sandbox — never a gold key"]]},

/* ================= THE CONTRACT ================= */
{id:"MED", key:"8", group:"⑧ The contract", groupMark:true, anchor:true,
 shape:"spine", tier:"code",
 name:"zsb-medallion", repo:"zsb-medallion", right:"v0.8.0",
 x:COL_RAIL, y:41, w:8, h:62, tapLen:5.5,
 /* One tap per transform repo, carrying the version that repo actually pins.
    A pin behind the rail's own version is stroked in --drop. All three agreed
    on the first read, diverged on the second, and agree again on the third —
    which is why the pin is drawn rather than written up: it moves. */
 taps:[{y:21, pin:"v0.8.0"}, {y:45, pin:"v0.8.0"}, {y:66, pin:"v0.8.0"}],
 sub:"v0.8.0 · 83 commits · 2,656 LOC · the only repo here with boto3",
 exports:["BRONZE", "SILVER", "GOLD", "SANDBOX", "S3IO", "AtomicPath", "5 errors", "console", "fetch"],
 brief:"Not a stage — which is why it is a rail beside the transform column rather than a station in it. It is the shared vocabulary all three transforms import, and it touches no bucket: four bucket names, the S3 and atomic-file mechanics, the CLI helpers, and now <mark>the batch fetch and pin check both working transforms run on</mark>. The only repo with boto3, enforced socially rather than technically. Its interesting property is what it refuses to do — S3IO.upload raises rather than overwrite, which makes 'immutable' a property of the code. <mark>The taps agree again</mark>: all three on v0.8.0.",
 does:"Not a stage, which is why it is drawn as a rail beside the transform column rather than a station in it. It is the shared vocabulary all three transforms import, and it touches no bucket. It holds exactly three things: the four bucket names, the S3 and atomic-file mechanics, and the CLI presentation helpers.",
 built:"2,656 lines, 83 commits, and a single author. It is the only repo in the set that depends on boto3, and that is enforced socially rather than technically: zsb-bronze's AGENTS.md says 'S3 mechanics come from zsb-medallion; add no boto3 here', and no transform repo does. It is also the only repo with real S3 tests — moto and boto3-stubs are in its dev group and nowhere else. Tagged v0.1.0 through v0.8.0, and the three releases since the last read are why the rail grew: <mark>fetch/</mark> is new — plan, execute and pin-check a batch of downloads — and it is what both working fetches on this map now run on. Main sits four commits past the v0.8.0 tag.",
 cond:"The interesting property of this package is still what it refuses to do. <mark>S3IO.upload</mark> will not clobber — it raises S3ObjectExistsError rather than overwrite — which is what makes 'version prefixes are immutable' a property of the code rather than a promise in a README. <mark>And the divergence this map drew here last time is closed.</mark> All three transforms are on v0.8.0. What closed it is worth naming because it is a mechanism rather than a tidy-up: a <mark>bump-consumers</mark> workflow in this repo opens a pull request against each of the three whenever a version tag lands, so the contract carries its own consumers forward. It fires on tags rather than on every merge to main, and it refuses to force-push over human commits on a bump branch — two decisions that read as somebody having already been bitten. The rail also stopped being a vocabulary and started being a library: the shared <mark>fetch</mark> is real code two repos now depend on, so a change here can break a transform in a way that renaming a constant never could.",
 kv:[["Repo","zeroshotbio/zsb-medallion"],["Version","v0.8.0 · main is +4 commits"],["Pinned by all three","v0.8.0"],["Kept in step by","bump-consumers.yml, on version tags"],["Commits","83, sole author"],["Source","2,656 LOC"],["Shared fetch","used by bronze and silver"],["boto3","here only"]]},
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
  {a:{n:"BREPO", s:"l", dy:6}, b:{n:"SGAP", s:"t"}, kind:"live",
   label:"publish v1 · 1.45 GiB", sub:"ran 2026-08-23"},
  {a:{n:"SGAP", s:"b"}, b:{n:"SILVER", s:"r", dy:2}, kind:"live"},

  /* silver → zsb-silver → gold */
  {a:{n:"SILVER", s:"r", dy:6}, b:{n:"SREPO", s:"l", dy:0}, kind:"cold",
   label:"fetch · 1 key · 1.45 GiB", sub:"written · pinned · not yet run"},
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
    note: "Read from the live bucket on 2026-08-24. Identical to both earlier reads, to the byte."
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
    note: "Each pin re-checked against the live bucket on 2026-08-24 — the third read running, and the repo now has a pins command that runs exactly this."
  }),
  BPUB: () => ({
    title: "aws s3api head-object --bucket zsb-silver-warehouse \\\n    --key minifin/v1/minifin.h5ad",
    body: [
      "{",
      '    "AcceptRanges": "bytes",',
      '    "LastModified": "2026-08-23T00:21:59+00:00",',
      '    "ContentLength": 1561917184,',
      '    "ETag": "\\"9ce4a7f95864628bd9e482e7388bc0d8-187\\"",',
      '    "VersionId": "zuxZ4XtIIJZw5CDpnSWM9PLUFTLDgIe2",',
      '    "ContentType": "binary/octet-stream",',
      '    "ServerSideEncryption": "AES256",',
      '    "Metadata": {}',
      "}",
      "",
      "# 187 parts. the ledger beside it was written at",
      "# 00:22:28 — after the object, not before it."
    ].join("\n"),
    note: "The same command this map used to run against a key that was not there. zsb-silver now pins this exact size and etag as its input."
  }),
  SGAP: () => ({
    title: "aws s3 ls s3://zsb-silver-warehouse/minifin/",
    body: [
      "2026-08-23       1556  CHANGELOG.md",
      "2026-08-09   12159345  ...disposition_ensembl99.parquet",
      "2026-08-09       5532  ...parquet.provenance.json",
      "2026-08-07   40307760  minifin_rebuild_ensembl99.h5ad",
      "2026-08-07      13166  ...ensembl99.h5ad.provenance.json",
      "2026-08-07   45190039  minifin_rebuild_lawson.h5ad",
      "2026-08-07      13044  ...lawson.h5ad.provenance.json",
      "2026-08-23      10109  v1/README.md",
      "2026-08-23 1561917184  v1/minifin.h5ad",
      "",
      "# the six flat keys are the old pipeline's, and stay.",
      "# the three from the 23rd are the first release."
    ].join("\n"),
    note: "The same listing this map ran twice and found six objects in. The bottom two are the release; the ledger at the top indexes it."
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
    note: "Four strings and twenty names — and, since v0.6.0, a shared fetch as well. That is no longer only an agreement between the tiers; it is code two of them run on."
  })
};

/* nodes whose claims rest on something this instance cannot check */
const UNVERIFIED = new Set(["GOLD"]);

const OVERVIEW = {
  eyebrow: "Zeroshot · the medallion data architecture",
  title: "Data Structures",
  sub: "three tiers · four hops · one steel thread: MiniFin 100k",

  /* The three rendered fields. Same hundred-word cap as a station's brief;
     the long-form `does` / `built` / `cond` below are the record and are not
     rendered. If you lengthen these, lengthen the panel first. */
  brief: `Every worked example on this map is <mark>MiniFin 100k</mark>: one 94,616-cell zebrafish chemical-perturbation dataset, carried end to end as a single thin slice through every tier. That is what a steel thread is for — prove the whole path on one small real thing before widening it. Where a stage has run, it ran on MiniFin. Where a stage has not, MiniFin is what it would carry. The far larger MegaFin deliveries are drawn to true scale in bronze because they cost real money by the terabyte-month, but they are not the thread.`,

  how: `Down the left, the buckets in tier order — that column is the data, and each one's contents are a squarified treemap by true area. Down the middle, the transforms: one repository per hop, each sitting in the gap between the two buckets it bridges. Down the right, the contract every transform imports. Each hop is two conduits — out of a bucket into the repo, then out of the repo into the next bucket. <mark>A solid line has carried bytes. A dashed line is code that exists and has never run.</mark>`,

  state: `<mark>Two of the four hops have now run.</mark> Bronze into the bronze repo works and verifies itself; on 2026-08-23 the publish step ran for the first time and wrote <mark>minifin/v1/</mark> into silver — 1.45 GiB, the ledger written after the objects it indexes. The next hop's fetch is written and pinned to that exact object, and has not been run. What is left is two gates, both in the last two steps, and neither is a research problem: a QC sign-off and a key convention. Gold still cannot be read from here at all.`,

  does: `<p>A plan of the medallion architecture, drawn straight down and read top to bottom.</p>
<p><mark>Down the left, the buckets</mark> — bronze, then silver, then gold, in tier order. That column is the data. <mark>Down the middle, the transforms</mark> — one repository per hop, each sitting in the gap between the two buckets it bridges, so a repo is always beside the seam it works on rather than beside a tier. <mark>Down the right, the contract</mark>: zsb-medallion, a single rail every transform taps and no bucket touches.</p>
<p>Each hop is two conduits and the pair is the whole shape of the map: out of a bucket's right wall into the repo (the <em>read</em>), then back out of the repo and down into the next bucket (the <em>write</em>).</p>
<p>This is a companion to <a href="/pipeline">/pipeline</a> and its opposite in two ways. That map is drawn on an isometric axonometric and is about <em>the platonic process</em> — how a zebrafish becomes an atlas, in general. This one is orthographic top-down and is about <em>the state of one system on one day</em>: what is in the buckets, what is in the repos, and where the two disagree.</p>
<p><mark>The reason it is worth drawing top down.</mark> Each bucket's contents are a squarified treemap by bytes, and area is the only honest encoding for a 466:1 ratio between bronze and silver. An isometric projection foreshortens one axis, so two tiles of equal area read as unequal depending on where they sit. Straight down, a square is a square everywhere on the canvas.</p>
<p><mark>How to read the conduits.</mark> A solid line with dots moving along it has carried bytes and can be shown to have. A dashed line is code that exists and has never run. Two of the four are solid, and the pair of them is one dataset going down and coming back out again.</p>`,
  built: `<p>Everything here was read on <mark>2026-08-24</mark> from the live AWS account and from the four repositories at their current main commits — zsb-medallion 00b71e8, zsb-bronze 6126161, zsb-silver 4a64566, zsb-gold 513ca22. This is the third read of this map. The first two found the buckets byte-for-byte identical and all the movement in the repo column; this one is the other way round — the left column changed, and it changed because a step on the right finally ran.</p>
<p>Bucket totals are <mark>aws s3 ls --recursive --summarize</mark>. Tiles aggregate those objects two path segments deep. The eight bronze manifest pins were each re-checked with <mark>head-object</mark> and all eight matched size and etag, multipart etags included — three reads running. The new silver release object was checked the same way against the identity zsb-silver pins for it, and matches.</p>
<p>Repository figures are commit counts, author tallies and line counts taken from fresh clones, not from the READMEs. Lines are every <mark>.py</mark> under <mark>src/</mark> and <mark>tests/</mark>; the per-module figure is <mark>src/</mark> only.</p>
<p>Two things are on this map's edges and deliberately off it. The <mark>zsb-sandbox</mark> bucket — 706 objects, 64.6 GiB, mostly three STARsolo alignment arms — has no conduits in either direction by definition, so it is not a station here. And the pipeline that preceded these repos, whose output is the six unversioned objects still sitting beside the new release in silver's minifin/ tile, is described in that tile's own notes rather than drawn as a second lane.</p>`,
  cond: `<p class="cond">The governing fact has changed for the first time since this map was drawn: <mark>two of the four hops have run.</mark> Bronze into the bronze repo still works, is fast, and verifies itself. And on 2026-08-23 at 00:21 UTC the publish step ran and wrote the release it had been describing on paper since the 22nd — 1.45 GiB of validated h5ad under <mark>minifin/v1/</mark>, its README beside it, and the ledger written a half-minute later, after the objects it indexes rather than before them.</p>
<p class="cond"><mark>The changelog problem is closed, and it is worth recording how.</mark> This map's sharpest finding for two reads was a ledger that indexed a release nobody had uploaded. Nothing was retracted to fix it; the release was published. What is left of that finding is a version drift of the ordinary kind — the release note records a build against medallion v0.5.0 and the repo now pins v0.8.0 — which is a fact about reproducing an artifact, not about whether it exists.</p>
<p class="cond"><mark>The gate count went from three to two, and the one that closed was closed by writing down a key.</mark> zsb-silver's fetch is no longer a stub: it names <mark>minifin/v1/minifin.h5ad</mark>, pins its size and ETag, and refuses the transfer if either has moved. That is the reconciliation this map has asked for twice — the reading side was gated on a convention the writing side had already chosen — and what came out is stronger than a convention, because it is a specific object with a checkable identity.</p>
<p class="cond">The two that remain are both in the last two steps and neither is a research problem. The <mark>gold v1 QC sign-off</mark> is a question for a person, and there is now, for the first time, work aimed at it rather than around it: zsb-silver's open PR #17 ports Trailmaker QC steps 3 and 4 and names the parse recipe. The <mark>gold object-key convention</mark> blocks two repos from opposite directions at once, and it is the same question the silver key answered one tier up — the worked example is sitting there.</p>
<p class="cond"><mark>The contract divergence is closed, by a mechanism rather than a tidy-up.</mark> All three transforms are on v0.8.0. zsb-medallion now carries a <mark>bump-consumers</mark> workflow that opens a pull request against each consumer when a version tag lands — on tags, not on every merge, and refusing to force-push over human commits on a bump branch. The rail also stopped being a vocabulary and became a library: the shared <mark>fetch</mark> is real code that both working transforms depend on, so a change there can now break a transform in a way that renaming a constant never could. That is the thing to watch next.</p>
<p class="cond">One habit worth noting because it changes what this map is for. Both working repos now have a <mark>pins</mark> command that checks their declared objects against the live bucket and exits non-zero on drift. The identity checks that were the most perishable claims on this page — the thing a refresh had to re-run by hand — are now something CI can be asked. Neither writes anything: the buckets are owned by people, so drift is a finding.</p>
<p class="cond"><mark>One of the two standing unknowns is partly answered, and by a route around the closed door rather than through it.</mark> Every bucket-level Get call is still AccessDenied, so the configuration cannot be read — but a <mark>head-object</mark> on any key in bronze or silver returns a <mark>VersionId</mark> and <mark>ServerSideEncryption: AES256</mark>. Both buckets are versioned and encrypted at rest, which this map has recorded as unknown since it was drawn. Cross-region replication is still unconfirmed; no object carries a ReplicationStatus header, and that is suggestive rather than decisive, because the header only appears where a rule covers the object.</p>
<p class="cond">What still cannot be checked from this instance, and is marked rather than assumed: whether the gold bucket has contents at all, and whether any bucket has a lifecycle configuration. Gold refuses both ListBucket and HeadBucket to this role, so the map says <em>contents unknown</em> and never <em>empty</em> — they call for different next actions.</p>
<p class="cond">One piece of pure waste, in the one tier nobody is allowed to clean up automatically: <mark>minifin/raw/fastq/</mark> and <mark>minifin/raw-fastq/</mark> hold the same 17 objects, 209 GiB duplicated.</p>`
};
