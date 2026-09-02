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

   The second most important thing: the gate count is ONE. It was three when
   this map was drawn, two for the third and fourth reads, and the second of
   them turns out to have closed before the fourth read rather than after it
   — see the fifth-read note. What is left is a QC sign-off, and there is now
   real code aimed at it.

   THE STEEL THREAD — read this before any figure on the page
   Every worked example here is MINIFIN 100k: one 94,616-cell zebrafish
   chemical-perturbation dataset, carried end to end as a single thin slice
   through every tier. That is the whole idea of a steel thread — prove the
   entire path on one small real thing before widening it to the datasets
   that cost money.

   It is not a sample of the map, it IS the map's example:

     - every transform repo has exactly ONE dataset module, `minifin/`
     - every command on the page is a MiniFin command
     - the releases that now exist are `minifin/v1/`, `v2/` and `v3/`
     - the notebook that has not landed is `notebooks/minifin/01_eda.ipynb`

   THE THREE RELEASES ARE NOT REVISIONS OF EACH OTHER
   v1, v2 and v3 hold the same 2,743,021 barcodes called three different ways,
   published side by side. None supersedes another and the ledger says so.
   v1 is Parse's own delivered set (the reference schema), v2 is the knee
   filter Trailmaker itself applied, v3 is a call that reads no Parse
   threshold at all. Where a figure below says "94,616 cells", it is v1's.

   The MegaFin deliveries in bronze are drawn at true area because 89% of
   a 7.20 TiB bill is a fact worth seeing. They are NOT the thread, and no repo
   on this page reads them — though as of the seventh read MegaFin-1 has been
   restructured into the same six stages as the thread. If you add a station,
   say which of the two it is.

   Nodes on the thread carry `thread:true`, which flags them in the reader.

   NAMING
   The tiers are bronze, silver and gold. The buckets carry nickname suffixes
   for historical reasons — fortknox, warehouse, library — and those nicknames
   are shown once each, in the bucket's own subtitle, and used nowhere else.
   In the map, in the reader and in conversation the tiers are just their
   colours.

   WHERE THE NUMBERS COME FROM
   Every byte count, object count and etag below was read on 2026-08-29 from
   the live account (arn:aws:sts::423623857952:assumed-role/ec2-s3-work-role)
   and from the four repositories at these commits:

     zsb-medallion  ebcc1c5   main = v0.9.0       96 commits   2,632 LOC
     zsb-bronze     ff2ff70   main               189 commits   5,947 LOC
     zsb-silver     74d0d23   main                60 commits   3,977 LOC
     zsb-gold       497bd1c   main                37 commits      93 LOC

   Bucket totals are the `aws s3 ls --recursive --summarize` figures; prefix
   tiles are those objects aggregated two segments deep. LOC is every .py
   under src/ and tests/; a per-module figure is src/ only. The eight bronze
   manifest entries were each confirmed with head-object on the same read —
   all eight matched size and etag for the FIFTH read running — and so were
   all three silver release objects zsb-silver now pins, which matched too.

   ELEVEN PINS, CHECKED THE LONG WAY. The two `pins` commands are the right
   way to run this check and neither could be run here: there is no `uv` and
   no virtualenv on this instance, so `zsb-bronze minifin pins` does not
   start. The eleven pins were read out of `fetch/manifest.py` and
   `minifin/release.py` and put to `head-object` directly, which is the same
   comparison by hand. If the next reader has a working toolchain, run the
   commands instead and say so here — this note is a workaround, not a method.

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
   - THE CONTRACT DIVERGENCE IS CLOSED. All three transforms pin v0.9.0,
     carried there by a `bump-consumers` workflow in zsb-medallion that opens
     a PR against each consumer on a version tag. The taps agree again.
   - THE RAIL BECAME A LIBRARY. `zsb_medallion.fetch` is new and both working
     fetches run on it, so a change there can now break a transform in a way
     that renaming a constant never could.
   - Both working repos gained a `pins` command: check the declared objects
     against the live bucket, exit non-zero on drift. The most perishable
     claims on this page are now something CI can be asked.

   FOURTH READ — 2026-08-26. NOTHING MOVED, AND THAT IS THE FINDING.
   Both sides re-read, both sides identical. Bronze 1,258 / 7,730,616,859,647
   and silver 82 / 18,154,728,187 to the byte, the same three prefixes at the
   same sizes and object counts, gold still refusing ListBucket and HeadBucket.
   All four repos sit on exactly the commits above — nothing merged in two days.
   The eight bronze pins were re-checked with head-object and matched on size
   and multipart etag for the FOURTH read running, and so did the v1 release
   object in silver.

   So no figure on this page changed. Two pieces of PROSE did, and both were
   the same kind of error — a claim that outlived the read it was made in:

   - Silver's cond opened with "one of the three tiles is now a real release"
     and still closed, four sentences later, with the second read's "not one
     object in this tier follows the convention ... silver is full of things,
     and empty of releases". Both halves shipped, in one panel, for two days.
     WHEN A FINDING IS RETIRED, GREP THE PANEL FOR ITS OTHER HALF: the closing
     line of a paragraph is where the old claim hides, because a rewrite starts
     at the top and stops when the new fact has been stated.
   - zsb-silver no longer carries "the only open pull request in the set". It
     carries both of them: #17 is still open and #18 (docs) opened on the 24th
     at 22:26 UTC, after the third read. The other three repos have none.

   FIFTH READ — 2026-08-29. BOTH COLUMNS MOVED, AND ONE GATE WAS ALREADY GONE.
   Three of the four previous reads found movement on one side only. This one
   found it on both, and also found that the fourth read had missed something
   sitting in a file it had open.

   - THE GOLD KEY CONVENTION WAS ALREADY SETTLED, and this map said otherwise
     for two reads. Gold keys are `<dataset>/<recipe>/<version>/…` — a recipe
     is a named hyperparameter set, a version one immutable build of it. It is
     in zsb-gold's README, in its AGENTS.md, and in the docstring of the very
     stub this map drew as blocked, all of it committed on 2026-08-23 at
     513ca22 — the commit the fourth read read. THE GATE COUNT WAS ONE, NOT
     TWO, ON 2026-08-26. This is the fourth read's own lesson landing on the
     fourth read: it re-read the panels it suspected and not the ones it did
     not. A gate is a claim about somebody else's repo; check it there.
   - TWO MORE RELEASES. `minifin/v2/` and `minifin/v3/` were published on
     2026-08-28, 21:06 and 21:09 UTC, objects first and the ledger after both
     times. They are not revisions: same barcodes, three cell-calling policies,
     published side by side because each answers a different question.
   - SILVER IS 86 OBJECTS / 21,276,994,543 B, up four objects and 2.91 GiB,
     all of it those two releases. Bronze is unchanged to the byte for the
     FIFTH read running. Gold still refuses both ListBucket and HeadBucket.
   - zsb-silver TRIPLED: 870 LOC to 2,552, and the new lines are the thing
     this map has been waiting on since it was drawn — Trailmaker's QC steps
     3 and 4 ported, and a doublet scorer that calls real scDblFinder. The
     step still raises, so it is still drawn dashed. See SPROC.
   - THE THRESHOLD SOURCE REVERSED. This map recorded that gold's thresholds
     would come from Parse's recorded `settings.txt`. zsb-silver has since
     established that those values are run-state noise and now re-derives
     every threshold per sample, keeping the recorded ones as a cross-check
     it must never gate on. The pin in the bronze manifest stays, for a
     different reason than the one this page gave for it.
   - A NEW SELF-CONTRADICTION, AND IT IS THE FOUNDING FINDING INVERTED.
     zsb-bronze's dataset README says `barcode-ranks` "is deliberately
     unpublished" and its version table stops at v2 — while `minifin/v3/`
     has been in the warehouse since the 28th, published with exactly that
     policy, and the CHANGELOG in the same commit records it. The ledger once
     indexed a release that did not exist; now a README denies one that does.
     Open PR #49 is the fix. See BBUILD.
   - EVERY REPO NOW HAS OPEN PULL REQUESTS — bronze 3, silver 5, gold 1,
     medallion 1. "Every open pull request is in zsb-silver" is retired.

   SEVENTH READ — 2026-08-31. THE TIER WAS RESTRUCTURED, AND THE PINS PASSED
   ANYWAY.
   Six reads recorded the bronze manifest verifying clean. It verified clean
   again. That is now the most misleading true sentence on this page, and the
   seventh read is mostly about why.

   - PARSE REGENERATED THE MINIFIN DELIVERY, and the manifest cannot see it.
     The delivery this map has described since it was drawn is UUID
     `a354c053`. The one now in the canonical stages is `a24cce10`: same 44
     samples, same 1,819 archive entries, same extension histogram — and
     different bytes throughout. The combined unfiltered matrix is
     959,585,881 B against the pinned 959,601,177; `all_summaries.zip` grew
     17 MB; every CRC checked differed. The eight pins still match because
     the objects they name were never touched. A DRIFT CHECK THAT PASSES IS
     A CLAIM ABOUT THE BUCKET, NOT ABOUT THE VENDOR. This one has been
     answering a question nobody was asking for two deliveries.
   - THE TIER NEARLY DOUBLED, BY COPY, ON PURPOSE. 75,673 objects and
     5.81 TiB, up from 710 and 3.59 TiB. Both MiniFin and MegaFin-1 now carry
     a six-stage layout — 1_FASTQ, 2_BAM, 3_DGE-unfiltered, 4_DGE-filtered,
     5_RDS, 6_PARSE-support — built alongside the originals rather than
     replacing them, because AGENTS.md forbids deleting from this bucket and
     nobody has amended it. 14,669 files for MiniFin and 60,116 for MegaFin-1,
     each verified present and byte-exact against the source archives.
   - A SECOND BUCKET EXISTS. `zsb-bronze-archive`, 27 objects, 1.29 TiB, the
     raw vendor ZIPs. The rule that put them there is the one that removed
     `original-archives/` from every stage: FORT KNOX HOLDS EXTRACTED,
     DIRECTLY READABLE ARTIFACTS; THE ARCHIVE HOLDS THE VENDOR DELIVERIES
     THEY CAME OUT OF.
   - A FOURTH TOP-LEVEL PREFIX. `reference/` — 15 objects, 1.46 GiB, the
     genome, GTFs and barcode whitelists that were byte-identical in all
     three datasets, deduplicated into one copy. Darien's framing settles the
     naming: reference is a dataset of materials only ever used alongside
     other datasets, so `<dataset>/…` still holds.
   - settings.txt IS NOT IN THE ALL FILES DELIVERY. Zero occurrences across
     all 26 archives, both datasets. It ships with the RDS deliverable:
     `megafin-1/parse-output/original-run/` holds exactly processed-matrix.rds
     and settings.txt and nothing else. MegaFin-1 has two, 47,859 B and
     47,922 B, different etags, neither yet canonical. THE FIFTH READ RECORDED
     THAT SILVER STOPPED TRUSTING THIS FILE; THE SEVENTH RECORDS THAT WE DID
     NOT KNOW WHERE IT CAME FROM.
   - MEGAFIN IS NO LONGER THE UNTOUCHED 90%. MegaFin-1 is 61.5% of the tier
     and now has a canonical structure, 55 BAMs split 16 canonical and 39
     intermediate. No repo reads it yet, so the "not the thread" note stands —
     but it is no longer true that nothing has been done to it.

   EIGHTH READ — 2026-09-01. ALL THREE DATASETS NOW SHARE ONE SHAPE, AND THE
   TREEMAP CHANGED WHAT IT ASKS.
   The seventh read caught the restructure mid-flight on one dataset. This one
   finds it done on two and running on the third, and takes the chance to redraw
   the bronze tiles one level down.

   - THE TILES ARE NOW THE FIVE ANCHOR STAGES, not the three datasets. FASTQ,
     BAM, unfiltered DGE, filtered DGE, RDS — per dataset, at true area. The
     dataset-level view had done its job: it said MegaFin is most of the bill.
     This one says something the pipeline column has been implying for eight
     reads without ever showing it — THE BYTES ARE IN THE THINGS NOTHING READS.
     FASTQ and BAM are 96% of the tier. Every DGE matrix across all three
     datasets, the only bronze objects any transform actually opens, fits in
     75 GB. The eight pinned keys are 944 MiB of a 7.2 TiB bucket.
   - Note what the tiles no longer sum to. 6_PARSE-support and every legacy
     prefix are excluded, so the treemap is a view of the anchors and not of
     the tier. That is a deliberate loss of one property this map has held
     since it was drawn; it is called out in the panel because a treemap that
     silently stops totalling is worse than one that says so.
   - 100,545 OBJECTS, 7.20 TiB, up from 75,673 and 5.81. Read mid-extraction:
     MegaFin-2 is seven archives of seventeen through its unpack.
   - THE ARCHIVE BUCKET HOLDS ALL THREE DELIVERIES — 43 objects, 2.31 TiB,
     UUIDs a24cce10, ca21e8e1 and f3cad9ab, one per dataset.
   - THE NO-DELETE RULE IS INFRASTRUCTURE, NOT CONVENTION. An attempt to remove
     thirty redundant copies from this instance returned AccessDenied with an
     EXPLICIT DENY on s3:DeleteObject for the whole bucket. AGENTS.md and IAM
     agree, and the IAM half is the one that cannot be forgotten. The cleanup
     was done from a separate admin identity and the guardrail left intact.

   NINTH READ — 2026-09-01, THE REPO COLUMN. THE THIRD HOP IS BUILT.
   The eighth read looked only at bronze and said so. This one re-read the four
   repositories, and every figure on the right-hand column had moved.

   - THE SILVER TRANSFORM IS NO LONGER A STUB, and this map has drawn it as one
     since it was made. `build_gold` in zsb-silver is now a real orchestrator —
     it resolves the recipe's doublet scorer, refuses a source whose X is not
     raw counts, opens a cell-count ledger and runs the steps — across fourteen
     modules with a dedicated test file. What still raises NotImplementedError
     is the RESERVED `zsb` doublet method, not the step. SPROC moves from the
     stub state to the third state: built, not yet lit. THE GATE THAT REMAINED
     WAS NEVER THE CODE.
   - THE CONTRACT MOVED TO v0.9.0 and all three consumers pin it. The taps agree
     again, which is the second time this map has recorded that and the second
     time the bump-consumers workflow did the work.
   - EVERY REPO GREW. bronze 156→189 commits and 5,205→5,947 LOC; silver 38→60
     and 2,552→3,977; gold 30→37 with its line count unchanged at 93, which is
     its own finding — seven commits of documentation and configuration around
     a package that still holds one stub; medallion 83→96 and a v0.9.0 tag.
   - THE OPEN PULL REQUESTS ARE ALMOST ALL CLOSED. The eighth read recorded
     bronze 3, silver 5, gold 1, medallion 1. It is now bronze 1 — and that one
     is this session's own README PR, #63 — with none anywhere else. "Every repo
     now has open pull requests" is retired after one read.
   - WHAT DID NOT MOVE: silver is 86 objects / 21,276,994,543 bytes, unchanged
     to the byte for the third read running. Gold still refuses ListBucket and
     HeadBucket. `publish_gold` and gold's `download_gold` both still raise, so
     two of the four hops remain cold and the count of hops that have run is
     still two.

   WHAT IS NOT KNOWN, AND IS MARKED AS NOT KNOWN
   - The gold bucket's contents. The role this was read with has no
     s3:ListBucket on zsb-gold-library, and HeadBucket returns 403. The map
     says "contents unknown", never "empty". Note that zsb-gold's README now
     states "the gold library is empty today" — somebody with more access
     than this role believes it. That is a claim on the map's edge, recorded
     and not adopted: this instance still cannot see it either way.
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
const COL_BUCKET = 13, COL_REPO = 63, COL_RAIL = 83.5, CORRIDOR = 38;

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
    x0: 50.5, y0: 6.6, x1: 89, y1: 73.5 },
];

const NODES = [

/* ================= BRONZE ================= */
{id:"BRONZE", key:"1", group:"① Bronze", groupMark:true, anchor:true,
 shape:"vault", tier:"bronze", doors:["r"],
 name:"Bronze", bucket:"BRONZE", right:"136,221 obj · 9.51 TiB",
 x:COL_BUCKET, y:11, w:24, h:22,
 sub:"s3://zsb-bronze-fortknox",
 tiles:[
   {key:"megafin-1/", value:5058148910735, objs:60717, legacy:1868397757280, accent:"#C08552"},
   {key:"megafin-2/", value:4638762432242, objs:60701, legacy:1698635254871, accent:"#6E8CA0"},
   {key:"minifin/", value:759208795497, objs:14786, legacy:378619764302, accent:"#9C7BA0"},
 ],
 panel:"<style>.fkw{margin:.3rem 0 0;font-family:var(--mono,ui-monospace,monospace);font-size:clamp(9px,calc(var(--reader-w,360px)*0.0145),12px)}.fkl{display:flex;flex-direction:column;gap:.2rem;margin:.1rem 0 .55rem;font-size:clamp(9px,calc(var(--reader-w,360px)*0.014),11.5px);color:var(--fg2)}.fkl b{display:flex;align-items:center;gap:.45rem;font-weight:400}.fkl i{width:1.9em;height:.8em;border-radius:2px;flex:0 0 auto}.fkds{border:2px solid var(--acc);border-radius:5px;overflow:hidden;margin-bottom:1rem}.fkds h5{margin:0;padding:.4em .6em;font-family:var(--sans,system-ui);font-size:1.15em;font-weight:700;color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent);display:flex;justify-content:space-between;align-items:baseline;gap:.5em}.fkds h5 s{text-decoration:none;font-size:.62em;font-weight:600;opacity:.75}.fkg{display:flex;align-items:stretch;border-top:1px solid var(--rule,#2a2a2e)}.fkgl{flex:0 0 1.5em;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;rotate:180deg;font-size:.62em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow:hidden;white-space:nowrap}.fkr{flex:1 1 auto;min-width:0}.fk{display:grid;grid-template-columns:minmax(0,1.3fr) 4.4em minmax(0,1.1fr);gap:0 .7em;padding:.16em .5em;line-height:1.5;border-left:2px solid transparent;align-items:baseline}.fk .p{white-space:pre;overflow:hidden;text-overflow:ellipsis}.fk .n{text-align:right;font-variant-numeric:tabular-nums;opacity:.85}.fk .t{font-family:var(--sans,system-ui);font-size:.88em;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fk.d1 .p{font-size:1.12em;font-weight:700}.fk.d2{opacity:.82}.fk.d2 .p{font-size:.94em}.fk.d3{opacity:.68}.fk.d3 .p{font-size:.88em}.fkh{font-size:.76em;letter-spacing:.09em;text-transform:uppercase;opacity:.45;border-bottom:1px solid var(--rule,#2a2a2e);padding:.3em .6em}</style><div class=\"fkl\"><b><i style=\"background:linear-gradient(90deg,#6FA8E8 0 50%,rgba(111,168,232,.13) 50%)\"></i>Canonical \u2014 separate delivery</b><b><i style=\"background:linear-gradient(90deg,#4FCB8A 0 50%,rgba(79,203,138,.13) 50%)\"></i>New \u2014 fresh \u201cAll Files\u201d download</b><b><i style=\"background:linear-gradient(90deg,#E8A33F 0 50%,rgba(232,163,63,.15) 50%)\"></i>Awaiting your next upload</b><b><i style=\"background:linear-gradient(90deg,#8A8A92 0 50%,rgba(138,138,146,.10) 50%)\"></i>Legacy \u2014 leaves Fort Knox</b></div><div class=\"fkds\" style=\"--acc:#9C7BA0\"><h5>minifin/<s>14,786 obj \u00b7 707 GiB</s></h5><div class=\"fkw\"><div class=\"fk fkh\"><span>path</span><span class=\"n\">GiB</span><span>note</span></div><div class=\"fk d1\"><span class=\"p\">minifin/</span><span class=\"n\">707.07</span><span class=\"t\">14,786 obj</span></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#4FCB8A;border-right:2px solid #4FCB8A\">minifin/ aspirational</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u251c\u2500\u2500 1_FASTQ/</span><span class=\"n\">209.46</span><span class=\"t\" title=\"FASTQ delivery, not All Files\">FASTQ delivery, not All Files</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u251c\u2500\u2500 raw-read-files/</span><span class=\"n\">209.46</span><span class=\"t\" title=\"8 sublibs \u00d7 R1/R2\">8 sublibs \u00d7 R1/R2</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u251c\u2500\u2500 sequencing-metadata/</span><span class=\"n\">2 KB</span><span class=\"t\" title=\"md5 checksums\">md5 checksums</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u2514\u2500\u2500 barcodes/</span><span class=\"n\">18 KB</span><span class=\"t\" title=\"3 Parse tables + note + README\">3 Parse tables + note + README</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 2_BAM/</span><span class=\"n\">121.57</span><span class=\"t\" title=\"All Files only\">All Files only</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 alignment-bams/</span><span class=\"n\">121.57</span><span class=\"t\" title=\"one per sublibrary, incl. 3b\">one per sublibrary, incl. 3b</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 3_DGE-unfiltered/</span><span class=\"n\">3.76</span><span class=\"t\" title=\"396 dirs \u00d7 3\">396 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">1.84</span><span class=\"t\" title=\"44 samples \u00d7 3\">44 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 per-sublibrary/</span><span class=\"n\">1.91</span><span class=\"t\" title=\"8 \u00d7 44 \u00d7 3\">8 \u00d7 44 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 4_DGE-filtered/</span><span class=\"n\">2.42</span><span class=\"t\" title=\"396 dirs \u00d7 3\">396 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">1.18</span><span class=\"t\" title=\"44 samples \u00d7 3\">44 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 per-sublibrary/</span><span class=\"n\">1.24</span><span class=\"t\" title=\"8 \u00d7 44 \u00d7 3\">8 \u00d7 44 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#E8A33F;background:rgba(232,163,63,.15);color:#E8A33F\"><span class=\"p\">\u251c\u2500\u2500 5_RDS/</span><span class=\"n\">1.87</span><span class=\"t\" title=\"awaiting upload \u2014 brings settings.txt too\">awaiting upload \u2014 brings settings.txt too</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2514\u2500\u2500 6_PARSE-support/</span><span class=\"n\">12.09</span><span class=\"t\" title=\"everything not a BAM or DGE matrix\">everything not a BAM or DGE matrix</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u251c\u2500\u2500 combined/</span><span class=\"n\">0.91</span><span class=\"t\" title=\"from output_combined/\">from output_combined/</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/report/</span><span class=\"n\">0.17</span><span class=\"t\" title=\"QC + metrics CSVs\">QC + metrics CSVs</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/figures/</span><span class=\"n\">0.05</span><span class=\"t\" title=\"fig_cell_by_rnd*.png\">fig_cell_by_rnd*.png</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 *_analysis_summary.html</span><span class=\"n\">0.69</span><span class=\"t\" title=\"+ all_summaries.zip\">+ all_summaries.zip</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u2514\u2500\u2500 process/</span><span class=\"n\">2 MB</span><span class=\"t\" title=\"run_proc_def.json, all_genes\">run_proc_def.json, all_genes</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">11.18</span><span class=\"t\" title=\"8 sublibrary trees\">8 sublibrary trees</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/report/</span><span class=\"n\">0.40</span><span class=\"t\" title=\"44 samples \u00d7 17 files \u00d7 8\">44 samples \u00d7 17 files \u00d7 8</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/figures/</span><span class=\"n\">0.27</span><span class=\"t\" title=\"PNGs per sample\">PNGs per sample</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/ root HTML + logs</span><span class=\"n\">1.41</span><span class=\"t\" title=\"summaries, split-pipe logs\">summaries, split-pipe logs</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u2514\u2500\u2500 sublib_N/process/</span><span class=\"n\">9.10</span><span class=\"t\" title=\"tscp_assignment.csv.gz dominates\">tscp_assignment.csv.gz dominates</span></div></div></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#8A8A92;border-right:2px solid #8A8A92\">minifin/ legacy</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 dataset-reference/</span><span class=\"n\">3.29</span><span class=\"t\" title=\"LEAVES Fort Knox \u2014 fails both tests\">LEAVES Fort Knox \u2014 fails both tests</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 annotation/</span><span class=\"n\">3.07</span><span class=\"t\" title=\"ZSCAPE \u2014 downstream, public\">ZSCAPE \u2014 downstream, public</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 paralogs.tsv + PARALOGS_NOTE.md</span><span class=\"n\">0.22</span><span class=\"t\" title=\"unreproducible \u2014 copy out, not delete\">unreproducible \u2014 copy out, not delete</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 parse-output/</span><span class=\"n\">138.40</span><span class=\"t\" title=\"the OLD delivery, a354c053\">the OLD delivery, a354c053</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 split-pipe-raw/</span><span class=\"n\">135.02</span><span class=\"t\" title=\"old 9 ZIPs \u2014 1 combine + 8 sublib\">old 9 ZIPs \u2014 1 combine + 8 sublib</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 dge-unfiltered/</span><span class=\"n\">0.92</span><span class=\"t\" title=\"= new combined/all-sample, older\">= new combined/all-sample, older</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 dge-filtered/</span><span class=\"n\">0.59</span><span class=\"t\" title=\"what MANIFEST still pins\">what MANIFEST still pins</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 *.rds \u00d72</span><span class=\"n\">1.87</span><span class=\"t\" title=\"source of 5_RDS/\">source of 5_RDS/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 qc/per-sublibrary/</span><span class=\"n\">57 KB</span><span class=\"t\" title=\"the sublibN \u2260 __sN trap\">the sublibN \u2260 __sN trap</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 settings \u00b7 cutoffs \u00b7 summaries</span><span class=\"n\">36 KB</span><span class=\"t\" title=\"\"></span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 raw-fastq/</span><span class=\"n\">209.46</span><span class=\"t\" title=\"source for 1_FASTQ/\">source for 1_FASTQ/</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 reference/</span><span class=\"n\">4.74</span><span class=\"t\" title=\"dupe of shared + dataset-reference\">dupe of shared + dataset-reference</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 annotation/</span><span class=\"n\">3.07</span><span class=\"t\" title=\"now in dataset-reference/\">now in dataset-reference/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 lawson_v4.3.2/ \u00b7 ensembl_99/</span><span class=\"n\">1.46</span><span class=\"t\" title=\"now in shared reference/\">now in shared reference/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 barcodes/ \u00b7 paralogs \u00b7 notes</span><span class=\"n\">0.22</span><span class=\"t\" title=\"\"></span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 results/</span><span class=\"n\">0.01</span><span class=\"t\" title=\"Zeroshot minifin_rebuild, not Parse\">Zeroshot minifin_rebuild, not Parse</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2514\u2500\u2500 REFERENCE_NOTE.md \u00b7 reference-note.md</span><span class=\"n\">8 KB</span><span class=\"t\" title=\"differ only by case\">differ only by case</span></div></div></div></div></div><div class=\"fkds\" style=\"--acc:#C08552\"><h5>megafin-1/<s>60,717 obj \u00b7 4,711 GiB</s></h5><div class=\"fkw\"><div class=\"fk fkh\"><span>path</span><span class=\"n\">GiB</span><span>note</span></div><div class=\"fk d1\"><span class=\"p\">megafin-1/</span><span class=\"n\">4,710.77</span><span class=\"t\">60,717 obj</span></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#4FCB8A;border-right:2px solid #4FCB8A\">megafin-1/ aspirational</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u251c\u2500\u2500 1_FASTQ/</span><span class=\"n\">1,708.10</span><span class=\"t\" title=\"FASTQ delivery, not All Files\">FASTQ delivery, not All Files</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u251c\u2500\u2500 raw-read-files/</span><span class=\"n\">1,708.10</span><span class=\"t\" title=\"16 sublibs \u00d7 R1/R2 \u00d7 8 lanes\">16 sublibs \u00d7 R1/R2 \u00d7 8 lanes</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u2514\u2500\u2500 barcodes/</span><span class=\"n\">22 KB</span><span class=\"t\" title=\"3 Parse tables + note + README\">3 Parse tables + note + README</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 2_BAM/</span><span class=\"n\">1,031.29</span><span class=\"t\" title=\"All Files only\">All Files only</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 alignment-bams/</span><span class=\"n\">968.09</span><span class=\"t\" title=\"one per sublibrary, ~60 GiB each\">one per sublibrary, ~60 GiB each</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 intermediate-bams/</span><span class=\"n\">63.20</span><span class=\"t\" title=\"sublib_13 (31) \u00b7 sublib_15 (8)\">sublib_13 (31) \u00b7 sublib_15 (8)</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 3_DGE-unfiltered/</span><span class=\"n\">23.20</span><span class=\"t\" title=\"1,649 dirs \u00d7 3\">1,649 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">11.46</span><span class=\"t\" title=\"97 samples \u00d7 3\">97 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">11.73</span><span class=\"t\" title=\"16 \u00d7 97 \u00d7 3\">16 \u00d7 97 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 4_DGE-filtered/</span><span class=\"n\">15.39</span><span class=\"t\" title=\"1,649 dirs \u00d7 3\">1,649 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">7.57</span><span class=\"t\" title=\"97 samples \u00d7 3\">97 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">7.82</span><span class=\"t\" title=\"16 \u00d7 97 \u00d7 3\">16 \u00d7 97 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#E8A33F;background:rgba(232,163,63,.15);color:#E8A33F\"><span class=\"p\">\u251c\u2500\u2500 5_RDS/</span><span class=\"n\">\u2014</span><span class=\"t\" title=\"awaiting upload \u2014 brings settings.txt too\">awaiting upload \u2014 brings settings.txt too</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2514\u2500\u2500 6_PARSE-support/</span><span class=\"n\">192.71</span><span class=\"t\" title=\"everything not a BAM or DGE matrix\">everything not a BAM or DGE matrix</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u251c\u2500\u2500 combined/</span><span class=\"n\">4.48</span><span class=\"t\" title=\"from output_combined/\">from output_combined/</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/report/</span><span class=\"n\">0.65</span><span class=\"t\" title=\"QC + metrics CSVs\">QC + metrics CSVs</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/figures/</span><span class=\"n\">0.13</span><span class=\"t\" title=\"fig_cell_by_rnd*.png\">fig_cell_by_rnd*.png</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 *_analysis_summary.html</span><span class=\"n\">3.70</span><span class=\"t\" title=\"+ all_summaries.zip\">+ all_summaries.zip</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u2514\u2500\u2500 process/</span><span class=\"n\">0.01</span><span class=\"t\" title=\"run_proc_def.json, all_genes\">run_proc_def.json, all_genes</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">188.22</span><span class=\"t\" title=\"16 sublibrary trees\">16 sublibrary trees</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/report/</span><span class=\"n\">1.73</span><span class=\"t\" title=\"97 samples \u00d7 17 \u00d7 16\">97 samples \u00d7 17 \u00d7 16</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/figures/</span><span class=\"n\">1.13</span><span class=\"t\" title=\"PNGs per sample\">PNGs per sample</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/ root HTML + logs</span><span class=\"n\">6.19</span><span class=\"t\" title=\"summaries, split-pipe logs\">summaries, split-pipe logs</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u2514\u2500\u2500 sublib_N/process/</span><span class=\"n\">179.17</span><span class=\"t\" title=\"tscp_assignment.csv.gz dominates\">tscp_assignment.csv.gz dominates</span></div></div></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#8A8A92;border-right:2px solid #8A8A92\">megafin-1/ legacy</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 dataset-reference/</span><span class=\"n\">\u2014</span><span class=\"t\" title=\"emptied \u2014 note moved to 1_FASTQ/barcodes/\">emptied \u2014 note moved to 1_FASTQ/barcodes/</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 raw-fastq/</span><span class=\"n\">1,708.10</span><span class=\"t\" title=\"source for 1_FASTQ/\">source for 1_FASTQ/</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 parse-output/</span><span class=\"n\">25.53</span><span class=\"t\" title=\"both runs, untouched\">both runs, untouched</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 original-run/</span><span class=\"n\">5.48</span><span class=\"t\" title=\"processed-matrix.rds + settings.txt\">processed-matrix.rds + settings.txt</span></div><div class=\"fk d3\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2502   \u2514\u2500\u2500 settings.txt</span><span class=\"n\">47,859 B</span><span class=\"t\" title=\"\u2605 differs from rerun\">\u2605 differs from rerun</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 rerun/</span><span class=\"n\">20.05</span><span class=\"t\" title=\"likely superseded by ca21e8e1\">likely superseded by ca21e8e1</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502       \u251c\u2500\u2500 settings.txt</span><span class=\"n\">47,922 B</span><span class=\"t\" title=\"\u2605 differs from original-run\">\u2605 differs from original-run</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502       \u251c\u2500\u2500 dge-unfiltered.zip</span><span class=\"n\">11.46</span><span class=\"t\" title=\"never extracted\">never extracted</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502       \u2514\u2500\u2500 rds \u00b7 summaries \u00b7 reports \u00b7 logs</span><span class=\"n\">8.59</span><span class=\"t\" title=\"\"></span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 reference/</span><span class=\"n\">1.46</span><span class=\"t\" title=\"duplicate of shared reference/\">duplicate of shared reference/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 lawson_v4.3.2/ \u00b7 ensembl_99/</span><span class=\"n\">1.46</span><span class=\"t\" title=\"now in shared reference/\">now in shared reference/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 barcodes/ + manifest</span><span class=\"n\">33 KB</span><span class=\"t\" title=\"BARCODES_NOTE.md is per-dataset\">BARCODES_NOTE.md is per-dataset</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2514\u2500\u2500 archive/2026-08-mega1-characterization/</span><span class=\"n\">5.00</span><span class=\"t\" title=\"Zeroshot, not Parse\">Zeroshot, not Parse</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">    \u251c\u2500\u2500 fp_parse/ \u00b7 fp_ours/ \u00b7 fp_ours2/</span><span class=\"n\">0.12</span><span class=\"t\" title=\"false-positive comparisons\">false-positive comparisons</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">    \u2514\u2500\u2500 composition \u00b7 depth \u00b7 diffs \u00b7 em_gate</span><span class=\"n\">4 MB</span><span class=\"t\" title=\"+ 17 scripts and notes at root\">+ 17 scripts and notes at root</span></div></div></div></div></div><div class=\"fkds\" style=\"--acc:#6E8CA0\"><h5>megafin-2/<s>60,701 obj \u00b7 4,320 GiB</s></h5><div class=\"fkw\"><div class=\"fk fkh\"><span>path</span><span class=\"n\">GiB</span><span>note</span></div><div class=\"fk d1\"><span class=\"p\">megafin-2/</span><span class=\"n\">4,320</span><span class=\"t\">60,701 obj</span></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#4FCB8A;border-right:2px solid #4FCB8A\">megafin-2/ aspirational</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u251c\u2500\u2500 1_FASTQ/</span><span class=\"n\">1,561.72</span><span class=\"t\" title=\"FASTQ delivery, not All Files\">FASTQ delivery, not All Files</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u251c\u2500\u2500 raw-read-files/</span><span class=\"n\">1,561.72</span><span class=\"t\" title=\"16 sublibs \u00d7 R1/R2 \u00d7 8 lanes\">16 sublibs \u00d7 R1/R2 \u00d7 8 lanes</span></div><div class=\"fk d2\" style=\"border-left-color:#6FA8E8;background:rgba(111,168,232,.13);color:#6FA8E8\"><span class=\"p\">\u2502   \u2514\u2500\u2500 barcodes/</span><span class=\"n\">22 KB</span><span class=\"t\" title=\"3 Parse tables + note + README\">3 Parse tables + note + README</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 2_BAM/</span><span class=\"n\">950.05</span><span class=\"t\" title=\"\"></span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 alignment-bams/</span><span class=\"n\">924.63</span><span class=\"t\" title=\"one per sublibrary, ~58 GiB each\">one per sublibrary, ~58 GiB each</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 intermediate-bams/</span><span class=\"n\">25.41</span><span class=\"t\" title=\"sublib_11 only\">sublib_11 only</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 3_DGE-unfiltered/</span><span class=\"n\">20.74</span><span class=\"t\" title=\"1,649 dirs \u00d7 3\">1,649 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">10.23</span><span class=\"t\" title=\"97 samples \u00d7 3\">97 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">10.52</span><span class=\"t\" title=\"16 \u00d7 97 \u00d7 3\">16 \u00d7 97 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u251c\u2500\u2500 4_DGE-filtered/</span><span class=\"n\">15.47</span><span class=\"t\" title=\"1,649 dirs \u00d7 3\">1,649 dirs \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u251c\u2500\u2500 combined/</span><span class=\"n\">7.61</span><span class=\"t\" title=\"97 samples \u00d7 3\">97 samples \u00d7 3</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2502   \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">7.86</span><span class=\"t\" title=\"16 \u00d7 97 \u00d7 3\">16 \u00d7 97 \u00d7 3</span></div><div class=\"fk d1\" style=\"border-left-color:#E8A33F;background:rgba(232,163,63,.15);color:#E8A33F\"><span class=\"p\">\u251c\u2500\u2500 5_RDS/</span><span class=\"n\">\u2014</span><span class=\"t\" title=\"awaiting upload\">awaiting upload</span></div><div class=\"fk d1\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">\u2514\u2500\u2500 6_PARSE-support/</span><span class=\"n\">190.22</span><span class=\"t\" title=\"everything not a BAM or DGE matrix\">everything not a BAM or DGE matrix</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u251c\u2500\u2500 combined/</span><span class=\"n\">4.52</span><span class=\"t\" title=\"from output_combined/\">from output_combined/</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/report/</span><span class=\"n\">0.65</span><span class=\"t\" title=\"QC + metrics CSVs\">QC + metrics CSVs</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 &lt;sample&gt;/figures/</span><span class=\"n\">0.13</span><span class=\"t\" title=\"fig_cell_by_rnd*.png\">fig_cell_by_rnd*.png</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u251c\u2500\u2500 *_analysis_summary.html</span><span class=\"n\">3.75</span><span class=\"t\" title=\"+ all_summaries.zip\">+ all_summaries.zip</span></div><div class=\"fk d3\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2502   \u2514\u2500\u2500 process/</span><span class=\"n\">0.01</span><span class=\"t\" title=\"run_proc_def.json, all_genes\">run_proc_def.json, all_genes</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">    \u2514\u2500\u2500 per-sublibrary/</span><span class=\"n\">185.70</span><span class=\"t\" title=\"16 sublibrary trees\">16 sublibrary trees</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/report/</span><span class=\"n\">1.74</span><span class=\"t\" title=\"97 samples \u00d7 17 \u00d7 16\">97 samples \u00d7 17 \u00d7 16</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/&lt;sample&gt;/figures/</span><span class=\"n\">1.13</span><span class=\"t\" title=\"PNGs per sample\">PNGs per sample</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u251c\u2500\u2500 sublib_N/ root HTML + logs</span><span class=\"n\">6.13</span><span class=\"t\" title=\"summaries, split-pipe logs\">summaries, split-pipe logs</span></div><div class=\"fk d2\" style=\"border-left-color:#4FCB8A;background:rgba(79,203,138,.13);color:#4FCB8A\"><span class=\"p\">        \u2514\u2500\u2500 sublib_N/process/</span><span class=\"n\">176.7</span><span class=\"t\" title=\"tscp_assignment.csv.gz dominates\">tscp_assignment.csv.gz dominates</span></div></div></div><div class=\"fkg\"><div class=\"fkgl\" style=\"color:#8A8A92;border-right:2px solid #8A8A92\">megafin-2/ legacy</div><div class=\"fkr\"><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 dataset-reference/</span><span class=\"n\">\u2014</span><span class=\"t\" title=\"emptied \u2014 note moved to 1_FASTQ/barcodes/\">emptied \u2014 note moved to 1_FASTQ/barcodes/</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 raw-fastq/</span><span class=\"n\">1,561.72</span><span class=\"t\" title=\"source for 1_FASTQ/\">source for 1_FASTQ/</span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u251c\u2500\u2500 parse-output/</span><span class=\"n\">18.80</span><span class=\"t\" title=\"the partial pre-delivery export\">the partial pre-delivery export</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 dge-unfiltered.zip</span><span class=\"n\">10.23</span><span class=\"t\" title=\"superseded by 3_DGE-unfiltered/\">superseded by 3_DGE-unfiltered/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 processed-matrix.rds</span><span class=\"n\">5.46</span><span class=\"t\" title=\"source for 5_RDS/\">source for 5_RDS/</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u251c\u2500\u2500 settings.txt</span><span class=\"n\">48 KB</span><span class=\"t\" title=\"\u2605 single copy, no ambiguity\">\u2605 single copy, no ambiguity</span></div><div class=\"fk d2\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2502   \u2514\u2500\u2500 reports \u00b7 summaries \u00b7 logs</span><span class=\"n\">3.11</span><span class=\"t\" title=\"\"></span></div><div class=\"fk d1\" style=\"border-left-color:#8A8A92;background:rgba(138,138,146,.10);color:#8A8A92\"><span class=\"p\">\u2514\u2500\u2500 reference/</span><span class=\"n\">1.46</span><span class=\"t\" title=\"duplicate of shared reference/\">duplicate of shared reference/</span></div></div></div></div></div><p class=\"note\">Read live 2026-09-01. All three datasets complete.</p>",

 brief:"The sealed raw tier, and the only one a person may write to. Everything below it is derivable; this is not. One tile per top-level folder, at true area. <mark>Each tile is split: the bronze share is the six-stage layout the restructure built, the grey band is what still sits in the pre-restructure folders</mark> — <code>raw-fastq/</code>, <code>parse-output/</code>, <code>reference/</code>, <code>results/</code>, <code>archive/</code>. That grey <em>is</em> the duplication, drawn inside the box it belongs to: nothing can be removed until the delete invariant is amended, so all three datasets hold their FASTQs twice. The shared <code>reference/</code> prefix is not drawn: at 1.46 GiB against 8.2 TiB it is 0.02% of the tier and would be a sliver. It is in the panel.",

 does:"The sealed raw tier, and the only one on this map a person is allowed to write to. Everything below it is derivable: if silver and gold both burned down they could be rebuilt from this bucket plus the repos. This bucket could not be rebuilt from anything. That is the rule that decides what belongs here — <mark>anything we cannot regenerate from code plus a lower tier</mark> — and it is why 7.2 TiB of vendor deliverables sit in one place with the write path closed.",
 built:"100,545 objects, 7,915,871,001,136 bytes read on 2026-09-01, <mark>mid-extraction</mark>: MegaFin-2 is seven archives of seventeen into its unpack, so its stages are partial and still growing. All three datasets now carry the same six-stage layout — 1_FASTQ, 2_BAM, 3_DGE-unfiltered, 4_DGE-filtered, 5_RDS, 6_PARSE-support — each split combined/ and per-sublibrary/. The anchor figures in the table below show where the mass actually is: MegaFin-1 holds 1.67 TiB of FASTQ and 1.01 TiB of BAM, MiniFin 209 GiB and 122 GiB, and every DGE stage across all three datasets fits inside 71 GiB. <mark>A MegaFin delivery's sixteen canonical BAMs outweigh its entire DGE output roughly forty to one.</mark> Every object is STANDARD storage; there is still no Glacier or Intelligent-Tiering anywhere in a write-once archive.",
 cond:"<mark>The eight pins still match, and that is still the finding.</mark> Parse regenerated the MiniFin delivery — the old one is UUID <mark>a354c053</mark>, the one now in the canonical stages is <mark>a24cce10</mark>, same 44 samples and 1,819 entries, different bytes throughout. The manifest passes because the objects it names were never touched. A drift check that passes is a claim about the bucket, not about the vendor. Second, <mark>a companion bucket now holds the vendor ZIPs</mark>: zsb-bronze-archive, 43 objects, 2.31 TiB, all three deliveries. The rule that put them there is what removed original-archives/ from every stage — Fort Knox holds extracted, directly readable artifacts; the archive holds the deliveries they came out of. Third, <mark>the duplication is now the dominant cost</mark>. Each dataset holds its FASTQs twice, once under the legacy raw-fastq/ and once under 1_FASTQ/, and nothing can be removed: AGENTS.md forbids deleting from this bucket and the rule is enforced as an <mark>explicit IAM deny</mark>, not merely written down. Fourth, settings.txt is absent from every All Files delivery — it ships with the RDS deliverable instead, which is why 5_RDS is the one stage still empty for two of the three datasets.",
 kv:[["Bucket","zsb-bronze-fortknox"],["Objects","100,545"],["Size","7.20 TiB"],
   ["— anchor stages —","minifin · megafin-1 · megafin-2"],
   ["1_FASTQ","209 GiB · 1.67 TiB · pending"],
   ["2_BAM","122 GiB · 1.01 TiB · 319 GiB (partial)"],
   ["3_DGE-unfiltered","3.76 GiB · 23.2 GiB · 14.1 GiB"],
   ["4_DGE-filtered","2.42 GiB · 15.4 GiB · 10.5 GiB"],
   ["5_RDS","1.87 GiB · pending · pending"],
   ["6_PARSE-support","12.1 GiB · 193 GiB · 27.2 GiB"],
   ["— tier —",""],
   ["Storage class","STANDARD"],["Versioned","yes — every object carries a VersionId"],
   ["Encrypted","AES256 at rest"],["Written by","humans only"],
   ["Companion","zsb-bronze-archive — 43 obj, 2.31 TiB"],
   ["Read on","2026-09-01 — eighth read, mid-extraction"]]},

/* ================= THE BRONZE → SILVER TRANSFORM ================= */
{id:"BREPO", key:"2", group:"② Bronze → Silver", groupMark:true, anchor:true,
 shape:"floor", tier:"bronze", state:"live",
 name:"zsb-bronze", repo:"zsb-bronze", right:"189 commits · 5,947 LOC",
 x:COL_REPO, y:21, w:22, h:18.5,
 sub:"reads bronze · writes silver · three releases published",
 thread:true,
 brief:"The transform for the first hop, and <mark>the repo that has now moved bytes in both directions</mark> — 944 MiB down out of bronze, 4.36 GiB up into silver across three releases. Named for the tier it <em>reads</em>, not the one it writes. One dataset module, minifin/, implemented end to end in 2,792 lines behind six commands. 156 commits from six contributors. <mark>Its build step now chooses a cell-calling policy</mark> rather than having one, which is why the tier below it holds three artifacts instead of one. Its dataset README has fallen behind its own bucket.",
 does:"The transform for the first hop. Named for the tier it <em>reads</em>, not the one it writes — the convention that makes this whole column unambiguous: zsb-bronze reads bronze and writes silver, zsb-silver reads silver and writes gold, zsb-gold only reads.",
 built:"One dataset module, <mark>minifin/</mark>, implemented end to end: 3,501 lines under src, twelve test files, and six commands. The entry point changed shape — it is <mark>zsb-bronze</mark> now, one command per repo, with each dataset a subcommand group beneath it: <mark>zsb-bronze minifin fetch</mark>, <mark>process convert</mark>, <mark>process build</mark>, <mark>process all</mark>, <mark>publish</mark>, and <mark>pins</mark>. Silver and gold adopted the same shape, so the three repos now read the same way from the command line. 189 commits since 2026-07-22 — Darien 123, Steve 61 across two identities, Creighton 2, two from CI and one from Claude.",
 cond:"<mark>Every failing this map recorded in this repo is retired, including the one it opened last read.</mark> CI runs make verify on every push and PR, AGENTS.md points at main, the contract divergence closed at v0.9.0, and publish has now run three times. The dataset README used to say <mark>barcode-ranks was 'deliberately unpublished'</mark>, its version table stopping at v2, while <mark>minifin/v3/</mark> had sat in the warehouse since the 28th, published under exactly that policy and recorded in the CHANGELOG committed alongside it — two documents in one commit, disagreeing about what is in a bucket. <mark>#49 merged on the 29th and closed it</mark>: the table now carries v3 and calls it published so it has a real artifact to be evaluated against. Publication is not promotion — v3 exists and is not recommended, and those are different sentences.",
 kv:[["Repo","zeroshotbio/zsb-bronze"],["HEAD","ff2ff70 (main)"],["Commits","189, since 2026-07-22"],["Source","5,947 LOC · 3,501 in src/"],["Tests","12 files · CI runs make verify"],["Entry point","zsb-bronze minifin <command>"],["Depends on","zsb-medallion @ v0.9.0"],["Open PRs","1 — #63 README folder tree; re-checked 2026-09-02"],["Published","minifin/v1, v2, v3"]]},

{id:"BFETCH", key:"2a", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"fetch", cellName:"fetch", note:"8 of 100,545 objects · 944 MiB",
 x:COL_REPO, y:16.05, w:19, h:3.4,
 sub:"fetch/ · manifest.py + fetch.py · 244 LOC",
 thread:true,
 brief:"Mirrors eight named objects out of bronze, checking each one's size and etag against a pin before it lands on disk. <mark>Eight names — not a prefix, not a sync.</mark> That choice is why this hop is cheap: a prefix sync of minifin/ pulls 562 GiB, this pulls 944 MiB, and it is everything conversion and cell-calling actually read. All eight pins re-verified against the live bucket on 2026-08-31, multipart etags included — <mark>the seventh read running</mark> — and the repo carries a <mark>pins</mark> command that runs exactly that check. <mark>They now verify a superseded delivery</mark>: Parse regenerated MiniFin, the canonical matrix moved to 3_DGE-unfiltered/combined/all-sample/ at 959,585,881 B, and this manifest still names the 959,601,177 B object beside it. This was the one step in the architecture demonstrably moving bytes; as of 2026-08-23 it is no longer the only one.",
 does:"Mirrors eight named objects out of bronze, validating each one's size and etag against a pin before it is written to disk. This is the one step in the entire architecture that has demonstrably moved bytes between a real bucket and a real machine.",
 built:"The manifest is the most consequential twelve lines of configuration in the architecture, and the reason this hop is cheap. It is a list of eight object keys, each pinned to an exact size and an exact etag. <em>Not a prefix. Not a sync. Eight names.</em> The same Parse delivery holds ~225 GB of raw FASTQ and ~135 GB of split-pipe intermediates in adjacent prefixes; a prefix sync of minifin/ pulls 562 GiB and a very large egress bill. This pulls 944 MiB — about 0.16% of the dataset's own prefix — and it is everything conversion and cell-calling actually read. Downloads through <mark>zsb_medallion.io.S3IO</mark>, so the repo carries no boto3 of its own, and now reports through <mark>zsb_medallion.console.download_with_progress</mark> as it goes.",
 cond:"All eight pins were re-confirmed against the live bucket on 2026-08-31 — every size and every etag matched, multipart etags included, for the seventh read running. <mark>The check is sound and the objects are stale.</mark> Parse regenerated the MiniFin delivery; the canonical unfiltered matrix now sits at 3_DGE-unfiltered/combined/all-sample/ at 959,585,881 B, while these pins name the 959,601,177 B object from the superseded a354c053 delivery. Repointing them is a code change nobody has made yet, and until it is made this hop reads old data cleanly. That is a real check and it passed. Note how it was run: there is no <mark>uv</mark> on this instance, so the <mark>pins</mark> command could not start and the eight pins were read out of manifest.py and put to head-object by hand. Same comparison, worse ergonomics — and a reminder that a check only counts as automated where the toolchain exists. What none of it tells you is whether the pins would survive a re-upload: an S3 multipart etag depends on the part size the uploader chose, so re-uploading byte-identical content with a different chunk size changes the etag and this manifest would reject a file identical to the one it wants.",
 kv:[["Command","uv run zsb-bronze minifin fetch"],["Drift check","zsb-bronze minifin pins"],["Keys pinned","8"],["Bytes pinned","989,650,630 (944 MiB)"],["Share of minifin/","0.16%"],["Verified","2026-08-31 — 8/8 size + etag"],["Streak","seven reads, no drift in the bucket"],["Pins","name the superseded a354c053 delivery"],["State","implemented, exercised, aimed at old objects"]]},

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
 name:"build", cellName:"process build", note:"3 policies · --policy chooses",
 x:COL_REPO, y:23.85, w:19, h:3.4,
 sub:"process/ · cells, corrections, provenance, validate · 1,203 LOC",
 thread:true,
 brief:"Calls cells, applies the mandatory corrections, stamps provenance into .uns, validates, and writes the silver artifact. <mark>It now chooses its cell-calling policy rather than having one</mark> — <mark>--policy</mark> selects among three, and which ran is stamped into .uns. The canonical one reads Parse's per-slice thresholds and reproduces the delivered set exactly: 94,616 cells, jaccard 1.0000, a set match rather than a count match. The other two decide for themselves, so equality would be the wrong question and they are measured instead. This is a step that grew an opinion and a way to record having had it.",
 does:"Calls cells, applies the mandatory corrections, stamps provenance into <mark>.uns</mark>, validates the schema, and writes the silver artifact. This is where the tier rule bites: silver is counts plus corrections and <em>no judgment calls</em> — if two scientists would pick different values, it is not silver, it is gold.",
 built:"Three cell-calling policies, <mark>all three now reachable from build --policy</mark> and each published under its own version. <mark>parse-cutoffs</mark> is canonical: Parse's per-(sample, sublibrary) thresh_raw applied as round(thresh_raw) per slice, reproducing the delivered set <em>exactly</em> — 94,616, jaccard 1.0000. <mark>parse-settings</mark> reaches 94,876 — and the often-quoted +260 is a net, not a one-sided count: 417 called here that v1 does not have, 157 of v1's not called here, jaccard 0.9940. <mark>barcode-ranks</mark> reaches 94,087 (−529 net: 571 added, 1,100 dropped, jaccard 0.9824). The corrections are unchanged and still the three nobody would argue about: Ctrl→DMSO, the Dapaglifozan typo→Dapagliflozin, and five asterisk-merged samples split back to two wells each, recovering 48 replicates from 43 Parse samples.",
 cond:"Three things. First, <mark>only parse-cutoffs is asserted</mark>; it is the only policy trying to reproduce a decision somebody else made, and the parity guard is the one check a count cannot fake. The other two are deciding for themselves, so they are <em>measured</em> — the full comparison lands in <mark>.uns['called_overlap']</mark> and a non-canonical build stops rather than quietly record nothing. Second, <mark>the barcode-ranks figures on this map have changed</mark>, from 94,338 / 0.9827 to 94,087 / 0.9824, and not because the policy got better: it was fitting one rank curve per sample and now fits one per (sample, sublibrary) slice, because split-pipe cut cells per slice. Pooling a sample's eight sublibraries moves the knee and drops 12,383 real cells while still returning a plausible-looking answer — the failure mode this map should fear most, since nothing about the output looks wrong. A test now pins the grouping at the call. Third, exact parity <em>requires</em> the per-slice cut structurally rather than by tuning: for all 43 samples the per-sample minimum called count falls below the maximum uncalled count, so no per-sample policy can reach 94,616 however it is tuned.",
 kv:[["Command","uv run zsb-bronze minifin process build --policy"],["parse-cutoffs","94,616 · jaccard 1.0000 · asserted"],["parse-settings","94,876 · jaccard 0.9940 · measured"],["barcode-ranks","94,087 · jaccard 0.9824 · measured"],["Of","2,743,021 barcodes × 32,520 genes"],["Replicates","48, from 43 Parse samples"],["Stamps",".uns cell_calling_policy + called_overlap"]]},

{id:"BPUB", key:"2d", group:"② Bronze → Silver", shape:"cell", tier:"bronze", state:"live",
 name:"publish", cellName:"publish", note:"ran 3× · v1, v2, v3",
 x:COL_REPO, y:27.75, w:19, h:3.4,
 sub:"publish/publish.py · the second hop, and it is now routine",
 thread:true,
 brief:"Uploads one MiniFin silver release — the artifact, its README and the changelog — under minifin/&lt;version&gt;/. Version prefixes are immutable, the ledger is the only object ever replaced, and there is no delete path. <mark>It has now run three times</mark>: v1 on 2026-08-23, then v2 and v3 three minutes apart on the 28th. Each time the objects went up before the ledger that indexes them. What was the map's largest gap became a closed finding, and has now become the least remarkable thing on the page — which is what a working step is supposed to look like.",
 does:"Uploads one silver release — the validated h5ad, the dataset README, and the changelog — under <mark>minifin/&lt;version&gt;/</mark>. Publication is deliberately a separate act from the build, so writing to a shared bucket is always something a person chose to do.",
 built:"Version prefixes are immutable by default; <mark>--overwrite</mark> is an explicit override meant for retrying a failed prefix, not for corrections — a correction is a new version. The one always-mutable object is the ledger at <mark>minifin/CHANGELOG.md</mark>. There is no delete path at all: removing a released object is a human console act. Re-validates the annotation schema on a backed read before uploading, so a stamped-but-wrong file is rejected at the door — and the changelog gate is enforced <em>inside</em> <mark>publish_release</mark> rather than by the caller, so there is no path to the bucket that skips it. That is why three releases exist and all three are indexed: the ledger entry is not a step somebody remembered. <mark>--verify-matrix full</mark> is an opt-in that re-checks the artifact end to end instead of sampling it.",
 cond:"<mark>Three runs, and the ordering discipline held every time.</mark> v1's artifact landed at 00:21:59 on the 23rd and its README at 00:22:28; v2's at 21:06:22 on the 28th and its README at 21:06:44; v3's at 21:09:52 and the README <em>and</em> the rewritten ledger at 21:10:14. Objects first, ledger after — three for three, which is the difference between a step that got it right and a step that does it right. What this cell can no longer tell you on its own is <em>which</em> release to read: three prefixes now sit under minifin/ and the artifact carries the answer in <mark>.uns['cell_calling_policy']</mark>, not the key. The ledger names them all and ranks none, deliberately. The v1 version drift stands as recorded — its note says <mark>Built with zsb_medallion 0.5.0</mark> and the repo pins 0.8.0 — and v2 and v3 will acquire their own the moment the rail moves again.",
 kv:[["Command","uv run zsb-bronze minifin publish"],["Wrote","minifin/v1/, v2/, v3/"],["Ran","2026-08-23 · 2026-08-28 ×2"],["v1","1,561,917,184 B · parse-cutoffs"],["v2","1,562,792,160 B · parse-settings"],["v3","1,559,446,470 B · barcode-ranks"],["Ledger","rewritten last, all three times"],["Delete path","none"]]},

/* ================= THE GAP, ON THE WRITE CONDUIT ================= */
{id:"SGAP", key:"3", group:"③ The releases", groupMark:true, anchor:true,
 shape:"bay", tier:"silver", filled:true,
 name:"minifin/ — three releases, side by side", x:CORRIDOR, y:32, w:12.4, h:6,
 headline:"three releases",
 lines:["v1 · parse-cutoffs", "v2 · parse-settings", "v3 · barcode-ranks"],
 sub:"published by zsb-bronze · none supersedes another",
 thread:true,
 brief:"<mark>This bay held one release on the last read and holds three now</mark> — v1 on 2026-08-23, v2 and v3 three minutes apart on the 28th. They are not revisions of each other. The same 2,743,021 barcodes are called three different ways and published side by side: Parse's own delivered set, the knee filter Trailmaker itself applied, and a call that reads no Parse threshold at all. <mark>The ledger names all three and ranks none.</mark> That is a real decision — a version here is a question answered differently, not a defect fixed.",
 does:"The object sets in the silver tier written under the versioned convention, by the repo meant to write them. Three version prefixes under <mark>minifin/</mark>, each holding a validated artifact and its README, plus the single mutable ledger at <mark>minifin/CHANGELOG.md</mark> one level above them.",
 built:"The convention with three instances to point at: the bucket is the tier, so keys carry no <mark>silver</mark> segment; artifacts live under <mark>&lt;dataset&gt;/&lt;version&gt;/</mark> and are immutable; the ledger sits above the version prefixes and is the sole object ever replaced. The write order held all three times — v1's artifact at 00:21:59 and README at 00:22:28 on the 23rd; v2's at 21:06:22 and 21:06:44 on the 28th; v3's at 21:09:52, with the README and the rewritten ledger together at 21:10:14. Objects first, ledger after, three for three.",
 cond:"<mark>The interesting question stopped being whether a release exists and became which one to read</mark>, and the architecture answers it in two places at once. The ledger describes all three and explicitly declines to rank them. zsb-silver picks one in source — <mark>SILVER_VERSION = 'v2'</mark>, because a recipe reproducing Trailmaker's QC should start from the population Trailmaker filtered — and pins the other two so its <mark>pins</mark> command checks them anyway. All three were verified against the live bucket on 2026-08-29 and match on size and multipart etag. The v1 version drift stands as recorded: its note says <mark>Built with zsb_medallion 0.5.0</mark> and the repo pins 0.8.0. The same will be true of v2 and v3 the next time the rail moves, which is ordinary and worth saying once rather than three times.",
 kv:[["Prefixes","minifin/v1/, v2/, v3/"],["Objects","6, plus the ledger above them"],["v1","1,561,917,184 B · 2026-08-23"],["v2","1,562,792,160 B · 2026-08-28"],["v3","1,559,446,470 B · 2026-08-28"],["Read by silver","v2 — the other two pinned, not fetched"],["Verified","2026-08-29 — 3/3 size + etag"]]},

/* ================= SILVER ================= */
{id:"SILVER", key:"4", group:"④ Silver", groupMark:true, anchor:true,
 shape:"vault", tier:"silver", doors:["r"],
 name:"Silver", bucket:"SILVER", right:"86 obj · 19.82 GiB",
 x:COL_BUCKET, y:34, w:24, h:15,
 sub:"s3://zsb-silver-warehouse · written by zsb-bronze",
 tiles:[
   {key:"zebrahub/",  value:11127199502, objs:12},
   {key:"megafin-1/", value:5367910950,  objs:61},
   {key:"minifin/",   value:4781884091,  objs:13},
 ],
 brief:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. The hinge of the architecture — the last tier where the data is still just what was measured. 86 objects, 19.82 GiB, <mark>0.28% the size of bronze</mark>, which is the medallion idea working as intended. <mark>The minifin/ tile has tripled again</mark> — two more releases on 2026-08-28. It was 0.59% of this bucket when the map was drawn and a two-pixel hairline at true area; it is 22.5% now, and 98% of it is released bytes. The tile this page was built to point at no longer needs pointing at.",
 does:"Rudimentary h5ad: counts plus the mandatory corrections, and nothing anyone could reasonably disagree with. This is the hinge of the architecture — the last tier where the data is still <em>just what was measured</em>. Everything below it is opinion, versioned and defensible, but opinion.",
 built:"86 objects, 21,276,994,543 bytes, read 2026-08-29 — four objects and 2.91 GiB more than the last read, all of it the v2 and v3 releases. It is 0.54% the size of bronze, which is the medallion architecture working exactly as intended: 3.6 TiB of vendor deliverables reduce to 20 GiB of counts. That ratio doubled on the 29th without silver gaining a byte — bronze halved.",
 cond:"<mark>The tile this map was drawn to complain about is now the one doing the work.</mark> <mark>minifin/</mark> holds thirteen objects: the six flat keys the previous pipeline left, the ledger, and three version prefixes of two objects each. Those releases are 98% of the tile's bytes. The old six are still there beside them, unversioned, provenance in sidecars — a released prefix does not tidy up what preceded it, and nothing on this map proposes deleting them. The other two tiles have not moved a byte in five reads and were written by neither repo here. <mark>zebrahub/</mark> (10.4 GiB, 12 objects, 2026-07-27) predates the zsb-* repos and is the placeholder both zsb-silver and zsb-gold deleted from their own source trees as 'not the shape the real transforms take'. <mark>megafin-1/characterization/</mark> (5.0 GiB, 61 objects) is an analysis working set — scripts, CSVs, diff reports and a 4.9 GiB h5ad — not a published artifact, and it has no version prefix. <mark>The same 61 objects now also sit in bronze</mark>, byte-identical, carried out of the megafin/ purge on the 29th into megafin-1/archive/2026-08-mega1-characterization/ — a set that was rescued as though it were unique and turns out to have been held in two tiers all along. The tier still reads two ways at once and that is still the honest picture, but the balance has tipped: <mark>the bytes written under the convention now outweigh the bytes that predate it</mark> in the only tile either repo touches. The sentence this note carried for two reads — <em>silver is full of things and empty of releases</em> — was half retired on the third read. It is now retired outright, and the half that survived it was <em>full of things</em>, which is also still true.",
 kv:[["Bucket","zsb-silver-warehouse"],["Objects","86"],["Size","19.82 GiB (21,276,994,543 B)"],["vs bronze","0.28%"],["Versioned releases","3 — minifin/v1/, v2/, v3/"],["Written by zsb-bronze","4.36 GiB, on 2026-08-23 and 08-28"],["Read on","2026-08-29"]]},

/* ================= THE SILVER → GOLD TRANSFORM ================= */
{id:"SREPO", key:"5", group:"⑤ Silver → Gold", groupMark:true, anchor:true,
 shape:"floor", tier:"silver", state:"stub",
 name:"zsb-silver", repo:"zsb-silver", right:"60 commits · 3,977 LOC",
 x:COL_REPO, y:45, w:22, h:14.6,
 sub:"reads silver · writes gold · the parts are ported, nothing runs them",
 thread:true,
 brief:"The transform for the second hop, and where the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, annotation. <mark>It tripled since the last read — 870 lines to 2,552</mark> — and the new lines are the thing this map has been waiting on since it was drawn: Trailmaker's QC steps 3 and 4 ported and asserted against R, and a doublet scorer that calls real scDblFinder. <mark>The step that would run them still raises.</mark> The parts exist; the orchestrator does not. That is a genuinely new state for this map, and it is drawn dashed.",
 does:"The transform for the second hop, and the place the judgment calls are supposed to live: QC, doublet filtering, normalization, HVGs, batch-aware embeddings, clustering, cell-type annotation. Everything the silver tier refused to decide.",
 built:"2,552 lines across nineteen source files and fourteen tests, up from 870 and six. <mark>fetch</mark> and <mark>pins</mark> are implemented, by delegation to the rail. What is new is <mark>process/</mark> — 771 lines that are not a scaffold: <mark>mito.py</mark> and <mark>spline.py</mark> port Trailmaker's steps 3 and 4, <mark>doublets.py</mark> and <mark>scdblfinder.py</mark> put a real Bioconductor scorer behind a swappable seam, and <mark>recipe.py</mark> names the hyperparameter set the whole thing is built with. <mark>The repo grew a second language.</mark> R arrives through a pinned pixi environment — r-base 4.5.3, bioconductor-scdblfinder 1.24.0 — kept deliberately outside the gate: make verify stays uv-only and hermetic, and the tests that call R are marked integration and skipped, so a machine without pixi still passes.",
 cond:"<mark>The claim this panel made on the last read is the one that broke.</mark> It said the two remaining stubs were 'conventions and sign-offs rather than algorithms, and no amount of tooling closes either'. Half of that was already wrong when it shipped — the gold key convention had been settled since the 23rd, in a file this map had open. The other half was wrong about what would happen next: what landed was 1,700 lines of algorithm, aimed squarely at the sign-off. <mark>One gate is left</mark>, the gold v1 QC sign-off, and it is still a question for a person. But it is no longer being waited on. The tests are worth naming as a piece of engineering judgment: the ported filters assert against hard-coded values <em>produced by running the same rule in R</em>, because a port compared against itself passes however wrong it is. The five pull requests this repo carried are all resolved, and so are gold's and medallion's — <mark>bronze's #63 is now the only one open in the set</mark>.",
 kv:[["Repo","zeroshotbio/zsb-silver"],["HEAD","74d0d23 (main)"],["Commits","60, since 2026-07-22"],["Source","3,977 LOC · 1,886 in src/ · 771 in process/"],["Tests","14 files · R tests outside the gate"],["Steps written","1 of 3 — fetch. process is parts, not a step"],["Depends on","zsb-medallion @ v0.9.0 · pixi for R"],["Open PRs","none — all five closed; re-checked 2026-09-02"],["Bytes moved","0 — the fetch has not been run from here"]]},

{id:"SFETCH", key:"5a", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"ready",
 name:"fetch (silver)", cellName:"fetch", note:"written · pinned · not yet run",
 x:COL_REPO, y:42, w:19, h:3.4,
 sub:"fetch/ · release.py + config.py + fetch.py · 188 LOC",
 thread:true,
 brief:"Downloads the MiniFin silver release the bronze repo published. Written, and pinned to objects that exist. <mark>It now has to choose which release to read, and it chooses v2</mark> — the population Trailmaker itself filtered, because the recipe above it reproduces Trailmaker's QC and should start from what Trailmaker saw. v1 and v3 are pinned too but not fetched, so <mark>pins</mark> checks all three. All three matched the live warehouse on 2026-08-29. Still drawn cold: nothing on this map can show it has been run, because a fetch lands on a machine, not in a bucket.",
 does:"Downloads the pinned MiniFin silver release into the local workspace, refusing the transfer if the live object's size or ETag differs from the pin. That refusal is the point: it is a refusal to trust the warehouse, not a transfer failure.",
 built:"<mark>A named key, never a prefix listing</mark> — for the same reason the bronze manifest is eight names, and one more besides: the warehouse still holds the previous pipeline's flat exploratory objects at the dataset root, so a glob would sweep them up alongside the releases. 188 lines across three small modules. The mechanics are not here: <mark>zsb_medallion.fetch</mark> owns the key guards, the plan model and the transfer loop, and this repo supplies the MiniFin facts they need. <mark>release.py now declares two things rather than one</mark>: <mark>SILVER_VERSION</mark>, the release actually fetched, and <mark>OTHER_SILVER_VERSIONS</mark>, the ones pinned so the drift check can cover them and a recipe can be pointed at one without rediscovering its identity. The local path carries the release version, so versions sit side by side without overwriting each other.",
 cond:"It still has not been run from here, and this map still cannot tell you whether it ever will be — a fetch writes to a working directory, and a working directory is not in the account. What can be said is that it would succeed: all three pinned objects were checked against the live warehouse on 2026-08-29 and matched on size and multipart etag. <mark>The more interesting thing this cell now carries is a choice.</mark> When there was one release, pinning it was bookkeeping. With three, naming one in source is a scientific decision with a comment explaining it, sitting in a file the drift checker also reads — which is roughly the best place a decision like that can live. The step below is still the one that cannot run, and still for a reason that has nothing to do with this one.",
 kv:[["Command","uv run zsb-silver minifin fetch"],["Drift check","zsb-silver minifin pins"],["Fetches","minifin/v2/minifin.h5ad"],["Bytes fetched","1,562,792,160 (1.46 GiB)"],["Also pinned","v1 and v3 — checked, not fetched"],["Verified","2026-08-29 — 3/3 size + etag"],["State","written · not run from here"]]},

{id:"SPROC", key:"5b", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"ready",
 name:"process (silver→gold)", cellName:"process", note:"built · not yet run",
 x:COL_REPO, y:45.9, w:19, h:3.4,
 sub:"process/ · 771 LOC of real filters · build_gold() still raises",
 thread:true,
 brief:"The heaviest step in any tier, and <mark>it is now built</mark>. <code>build_gold</code> resolves the recipe's doublet scorer, refuses a source whose X is not raw counts, opens a cell-count ledger and runs the steps — 1,342 lines across fourteen modules, with its own test file and a real CLI command behind it. <mark>What still raises is the reserved <code>zsb</code> doublet method</mark>, not the step: name that recipe and it fails before any work, which is the point of resolving the scorer first. Drawn solid with a hollow lamp — built, and not yet run from here.",
 built:"1,342 lines under <mark>process/</mark>, and a <mark>zsb-silver minifin process</mark> command that calls them. <mark>mito.py</mark> is Trailmaker step 3, the 3-MAD mitochondrial cut; <mark>spline.py</mark> is step 4, the genes-versus-transcripts fit; <mark>doublets.py</mark> and <mark>scdblfinder.py</mark> are step 5, calling real Bioconductor scDblFinder through a swappable seam; <mark>normalize.py</mark>, <mark>embed.py</mark>, <mark>grouping.py</mark> and <mark>metrics.py</mark> carry the rest. A recipe names every dial, so a changed threshold is a new version and a different method is a new recipe. Twenty-one test files across the repo.",
 cond:"<mark>This map had the threshold source backwards, and the correction is the most useful thing on this page.</mark> It recorded that gold's thresholds would come from Parse's recorded settings.txt. zsb-silver has since established that those recorded values are <em>run-state noise</em>: MegaFin Plate 1 was put through Trailmaker twice on identical input and the mito threshold moved in 88 of 90 samples (0.33× to 2.25×), the cell-size floor in 88 of 90, the doublet threshold in 90 of 90 — and on MiniFin, with no rerun at all, the doublet threshold the app displayed differs from the exported one in all 43. What <em>is</em> reproducible is the vendor's decisions: its recorded thresholds applied to the reconstructed step-3 population reproduce its recorded step-4 count to 17 cells in 92,555, 0.018%. So the repo ports the documented <em>rules</em> and re-derives every threshold from the sample it is filtering, keeping the recorded values as a cross-check it must never gate on. <mark>Gate on decisions and cell sets; never on a recorded threshold.</mark> settings.txt stays pinned in the bronze manifest two stations up — for the parse-settings policy and as that cross-check, not as this step's input. The full investigation is written down at <mark>docs/trailmaker-fidelity.md</mark> so it never has to be redone.",
 kv:[["Function","build_gold(source, destination)"],["State","raises — the parts exist, the orchestrator does not"],["Ported","steps 3, 4, 5 — mito, spline, doublets"],["Doublet scorer","real scDblFinder 1.24.0, via pixi"],["Thresholds","re-derived per sample, never read from settings.txt"],["Gate","gold v1 QC sign-off — unmade"],["Dossier","docs/trailmaker-fidelity.md"]]},

{id:"SPUB", key:"5c", group:"⑤ Silver → Gold", shape:"cell", tier:"silver", state:"stub",
 name:"publish (gold)", cellName:"publish", note:"key settled · waiting on an artifact",
 x:COL_REPO, y:49.8, w:19, h:3.4,
 sub:"publish_gold() → raises NotImplementedError",
 thread:true,
 brief:"Would upload one validated MiniFin gold h5ad under a versioned, non-overwriting key. Docstring only, and deliberately separate from the build for the same reason the bronze publish is. <mark>The gate this map drew on it is gone</mark> — gold keys are <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark>, settled on 2026-08-23 in both repos that needed to agree, and this page recorded it as open for two reads afterwards. What is left is not a decision but an order of operations: there is no gold artifact to publish until the step above it runs.",
 does:"Would upload one validated gold h5ad under a versioned, non-overwriting key, and never publish an unvalidated artifact.",
 built:"Docstring only. Deliberately separate from the build, for the same reason the bronze publish is: uploading to a shared bucket should be an explicit act. The key it would write is no longer an open question — <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark>, where a recipe is a named hyperparameter set and a version is one immutable build of it, so a changed dial is a new version and a different scientific choice is a new recipe. <mark>recipe.py</mark> one cell up already declares both halves of that key for MiniFin.",
 cond:"<mark>This map said for two reads that an unwritten paragraph blocked this step and zsb-gold's download at once. The paragraph had been written.</mark> It landed on 2026-08-23 in zsb-gold's README, its AGENTS.md, and the docstring of the stub itself — all of it in the commit this page was already citing. The error is worth keeping visible rather than quietly fixing: a gate is a claim about a <em>different</em> repo than the one the panel is about, and the fourth read checked the panels it suspected rather than the repos they pointed at. What actually blocks this step now is the ordinary thing — nothing has built a gold artifact for it to upload.",
 kv:[["Function","publish_gold(source, key)"],["State","raises NotImplementedError"],["Key convention","settled 2026-08-23 — <dataset>/<recipe>/<version>/"],["Blocked by","no gold artifact yet, not a decision"],["Recipe + version","named in silver's recipe.py"]]},

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
 cond:"<mark>This tier is drawn empty because it is unknown, not because it is known to be empty.</mark> The pipeline role has no s3:ListBucket on it and HeadBucket returns 403 — it cannot even establish that the bucket exists in this account, only that something at that name refuses it. The distinction matters: an empty gold tier and an unreadable one call for completely different next actions, and no artefact on this instance settles which it is. What can be said is that nothing upstream has ever been in a position to write here — the silver publish step raises on every call. <mark>One new data point, recorded and not adopted.</mark> zsb-gold's README now states plainly that 'the gold library is empty today'. Somebody with more access than this role believes that, and they are probably right. It is still a claim read out of a source tree rather than an observation of a bucket, and this map's whole method is the difference between those two — so the tile stays hatched and the sentence stays here, in the notes, where it can be attributed.",
 kv:[["Bucket","zsb-gold-library"],["ListBucket","AccessDenied to the pipeline role"],["HeadBucket","403 Forbidden"],["Objects","unknown"],["Ever written by zsb-silver","no — publish_gold raises"],["zsb-gold's README says","empty today — unconfirmable from here"],["Read on","2026-08-29 — same refusal"]]},

/* ================= THE GOLD READER ================= */
{id:"GREPO", key:"7", group:"⑦ Gold — the reader", groupMark:true, anchor:true,
 shape:"floor", tier:"gold", state:"stub",
 name:"zsb-gold", repo:"zsb-gold", right:"37 commits · 93 LOC",
 x:COL_REPO, y:66, w:22, h:10.7,
 sub:"reads gold · publishes nothing · the terminal repo",
 thread:true,
 brief:"The consumer end. Downloads and validates released gold artifacts and hosts the starter notebooks. It is <mark>the only repo in the architecture with no write path at all</mark> — by design, not omission, which is why nothing leaves it on this map. 93 lines: a package init, a minifin module, one fetch stub, and the docstring test. <mark>Not one commit in six days</mark>, and it is the only station here that did not move. But its README moved the map: the key convention this page called a gate has been settled in it since 2026-08-23.",
 does:"The consumer end. Downloads and validates released gold artifacts and hosts the starter analysis notebooks. It is the only repo in the architecture with no write path at all — by design, not by omission, which is why nothing leaves it on this map.",
 built:"92 lines: a package init, a minifin module, one fetch stub, and the docstring-convention test. Plus <mark>notebooks/minifin/README.md</mark>, which describes an <mark>01_eda.ipynb</mark> that has not landed.",
 cond:"<mark>This panel said this repo was blocked on an unwritten key convention. Its own README has said otherwise since 2026-08-23.</mark> Gold keys are <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark> — a recipe is a named hyperparameter set, a version one immutable build of it, and a pull names both. The reasoning is intact and worth keeping: the old download flow prefix-listed the bucket, which does not survive immutable versioned keys, so the pull must name one release. What is new is that the name has a shape. <mark>Unlike every other tier on this map, this one deliberately does not pin what it reads</mark> — which release to open is the question the reader is asking, so the key is built from their answer rather than declared in advance. That is the correct inversion at the consumer end and it is the last structural decision the architecture was missing. The stub is the same stub; nothing has committed here in six days. Note also that this README states the gold library is empty today — a claim this map records and does not adopt, because the role it reads with cannot see the bucket either way.",
 kv:[["Repo","zeroshotbio/zsb-gold"],["HEAD","497bd1c (main)"],["Commits","37"],["Source","93 LOC"],["Tests","1 file — the docstring checker"],["Depends on","zsb-medallion @ v0.9.0"],["Write path","none, by design"],["Key convention","settled — and never pinned, by design"],["Open PRs","none — #16 closed unmerged; re-checked 2026-09-02"],["Notebooks","1 README, 0 notebooks"]]},

{id:"GFETCH", key:"7a", group:"⑦ Gold — the reader", shape:"cell", tier:"gold", state:"stub",
 name:"fetch (gold)", cellName:"fetch", note:"key settled · waiting on an artifact",
 x:COL_REPO, y:64.95, w:19, h:3.4,
 sub:"download_gold() → raises NotImplementedError",
 thread:true,
 brief:"Would download one released MiniFin gold artifact. Docstring only — but the docstring now names the key it would build: <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark>, with the caller naming both. Its old blocker is retired. The reasoning behind it survives and is the good part: prefix-listing does not survive immutable versioned keys, so a pull must name one release. <mark>This is the one place on the map that reads without pinning</mark> — which release to open is the reader's question, not a fact fixed upstream.",
 does:"Would download one released MiniFin gold artifact, naming a recipe and a version rather than listing the bucket.",
 built:"Docstring only — and the docstring carries the convention: gold keys are <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark>, the caller names both, and the key is never discovered by listing. The error it raises says the same thing, so the constraint survives even where nobody reads the docstring.",
 cond:"The blocker this map recorded — 'the shape of that name is the paragraph nobody has written' — was retired on 2026-08-23 and this page carried it for two reads afterwards. What is left is not a gate: there is no gold artifact to download, because the step that would build one is still parts rather than a pipeline. <mark>The distinction matters for what happens next.</mark> A convention gate is closed by an argument; this is closed by somebody running a command, and the command does not exist yet.",
 kv:[["Function","download_gold(destination)"],["State","raises NotImplementedError"],["Key convention","settled 2026-08-23"],["Pins what it reads","no — by design, unlike every other tier"],["Blocked by","no gold artifact exists"]]},

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
 name:"zsb-medallion", repo:"zsb-medallion", right:"v0.9.0",
 x:COL_RAIL, y:41, w:8, h:62, tapLen:5.5,
 /* One tap per transform repo, carrying the version that repo actually pins.
    A pin behind the rail's own version is stroked in --drop. All three agreed
    on the first read, diverged on the second, and agree again on the third —
    which is why the pin is drawn rather than written up: it moves. */
 taps:[{y:21, pin:"v0.9.0"}, {y:45, pin:"v0.9.0"}, {y:66, pin:"v0.9.0"}],
 sub:"v0.9.0 · 96 commits · 2,632 LOC · the only repo here with boto3",
 exports:["BRONZE", "SILVER", "GOLD", "SANDBOX", "S3IO", "AtomicPath", "5 errors", "console", "fetch"],
 brief:"Not a stage — which is why it is a rail beside the transform column rather than a station in it. It is the shared vocabulary all three transforms import, and it touches no bucket: four bucket names, the S3 and atomic-file mechanics, the CLI helpers, and now <mark>the batch fetch and pin check both working transforms run on</mark>. The only repo with boto3, enforced socially rather than technically. Its interesting property is what it refuses to do — S3IO.upload raises rather than overwrite, which makes 'immutable' a property of the code. <mark>The taps agree again</mark>: all three on v0.9.0.",
 does:"Not a stage, which is why it is drawn as a rail beside the transform column rather than a station in it. It is the shared vocabulary all three transforms import, and it touches no bucket. It holds exactly three things: the four bucket names, the S3 and atomic-file mechanics, and the CLI presentation helpers.",
 built:"2,632 lines, 96 commits, and a single author. It is the only repo in the set that depends on boto3, and that is enforced socially rather than technically: zsb-bronze's AGENTS.md says 'S3 mechanics come from zsb-medallion; add no boto3 here', and no transform repo does. It is also the only repo with real S3 tests — moto and boto3-stubs are in its dev group and nowhere else. Tagged v0.1.0 through v0.9.0, and the three releases since the last read are why the rail grew: <mark>fetch/</mark> is new — plan, execute and pin-check a batch of downloads — and it is what both working fetches on this map now run on. Main sits four commits past the v0.9.0 tag.",
 cond:"The interesting property of this package is still what it refuses to do. <mark>S3IO.upload</mark> will not clobber — it raises S3ObjectExistsError rather than overwrite — which is what makes 'version prefixes are immutable' a property of the code rather than a promise in a README. <mark>And the divergence this map drew here last time is closed.</mark> All three transforms are on v0.9.0. What closed it is worth naming because it is a mechanism rather than a tidy-up: a <mark>bump-consumers</mark> workflow in this repo opens a pull request against each of the three whenever a version tag lands, so the contract carries its own consumers forward. It fires on tags rather than on every merge to main, and it refuses to force-push over human commits on a bump branch — two decisions that read as somebody having already been bitten. The rail also stopped being a vocabulary and started being a library: the shared <mark>fetch</mark> is real code two repos now depend on, so a change here can break a transform in a way that renaming a constant never could.",
 kv:[["Repo","zeroshotbio/zsb-medallion"],["Version","v0.9.0 · main is on the tag"],["Pinned by all three","v0.9.0"],["Kept in step by","bump-consumers.yml, on version tags"],["Commits","83, sole author"],["Source","2,656 LOC"],["Shared fetch","used by bronze and silver"],["boto3","here only"]]},
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
   label:"publish · 3 releases", sub:"3 runs · 4.36 GiB"},
  {a:{n:"SGAP", s:"b"}, b:{n:"SILVER", s:"r", dy:2}, kind:"live"},

  /* silver → zsb-silver → gold */
  {a:{n:"SILVER", s:"r", dy:6}, b:{n:"SREPO", s:"l", dy:0}, kind:"cold",
   label:"fetch v2 · 1 of 3", sub:"pinned · not yet run"},
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
      "                           PRE minifin/",
      "                           PRE reference/",
      "2026-08-29 18:33:16          5 _east1test.txt",
      "2026-08-06 20:37:17          5 _writetest.txt",
      "",
      "Total Objects: 100545",
      "   Total Size: 7915871001136"
    ].join("\n"),
    note: "Read from the live bucket on 2026-08-31. The sixth read returned 710 objects / 3945652776463 bytes after a purge; this one is 75,673 / 6,384,376,942,776 — the tier nearly doubled by copy, not by neglect. Two Parse deliveries were unpacked into a six-stage layout beside the originals, because AGENTS.md forbids the delete half of a move. The fourth prefix, reference/, is new: 15 objects that were byte-identical in all three datasets, deduplicated into one."
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
    note: "Each pin re-checked against the live bucket on 2026-08-31 — the seventh read running, 8/8 on size and etag. The check is sound; what it checks is not what the pipeline should now be reading. Parse regenerated MiniFin as delivery a24cce10 and the canonical unfiltered matrix is 959,585,881 B, sixteen kilobytes lighter than the pinned object sitting untouched beside it. A pin proves the bucket has not drifted. It cannot prove the vendor has not."
  }),
  BPUB: () => ({
    title: "aws s3api head-object --bucket zsb-silver-warehouse \\\n    --key minifin/v3/minifin.h5ad",
    body: [
      "{",
      '    "AcceptRanges": "bytes",',
      '    "LastModified": "2026-08-28T21:09:52+00:00",',
      '    "ContentLength": 1559446470,',
      '    "ETag": "\\"c2bb2e2d8d77399000bb94031ed1f927-186\\"",',
      '    "ContentType": "binary/octet-stream",',
      '    "ServerSideEncryption": "AES256",',
      '    "Metadata": {}',
      "}",
      "",
      "# 186 parts. README and the rewritten ledger",
      "# followed at 21:10:14 — objects first, again.",
      "#",
      "# the README denied publishing this",
      "# policy until #49 merged, on the 29th."
    ].join("\n"),
    note: "This map once ran this command against a key that was not there, then against one the writing repo's own README denied publishing. #49 merged on the 29th and the README now records v3 — the key and the documentation finally agree."
  }),
  SGAP: () => ({
    title: "aws s3 ls s3://zsb-silver-warehouse/minifin/",
    body: [
      "2026-08-28       4270  CHANGELOG.md",
      "2026-08-09   12159345  ...disposition_ensembl99.parquet",
      "2026-08-09       5532  ...parquet.provenance.json",
      "2026-08-07   40307760  minifin_rebuild_ensembl99.h5ad",
      "2026-08-07      13166  ...ensembl99.h5ad.provenance.json",
      "2026-08-07   45190039  minifin_rebuild_lawson.h5ad",
      "2026-08-07      13044  ...lawson.h5ad.provenance.json",
      "2026-08-23      10109  v1/README.md",
      "2026-08-23 1561917184  v1/minifin.h5ad",
      "2026-08-28      12307  v2/README.md",
      "2026-08-28 1562792160  v2/minifin.h5ad",
      "2026-08-28      12705  v3/README.md",
      "2026-08-28 1559446470  v3/minifin.h5ad",
      "",
      "# the six flat keys are the old pipeline's, and stay.",
      "# three versions, three cell-calling policies,",
      "# one ledger above them naming all three."
    ].join("\n"),
    note: "The same listing this map ran twice and found six objects in, and once and found nine. The version prefixes are now most of the tile."
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

  state: `<mark>Two of the four hops have run, and the second one is now routine</mark> — three releases sit side by side in silver, the same barcodes called three different ways, none superseding another. <mark>One gate is left, not two.</mark> The gold key convention was settled on 2026-08-23 and this map carried it as open for two reads afterwards. What remains is the gold v1 QC sign-off — and it is no longer merely being waited on: zsb-silver has ported Trailmaker's QC steps and a real doublet scorer, though the step that would run them still raises. Gold still cannot be read from here at all.`,

  does: `<p>A plan of the medallion architecture, drawn straight down and read top to bottom.</p>
<p><mark>Down the left, the buckets</mark> — bronze, then silver, then gold, in tier order. That column is the data. <mark>Down the middle, the transforms</mark> — one repository per hop, each sitting in the gap between the two buckets it bridges, so a repo is always beside the seam it works on rather than beside a tier. <mark>Down the right, the contract</mark>: zsb-medallion, a single rail every transform taps and no bucket touches.</p>
<p>Each hop is two conduits and the pair is the whole shape of the map: out of a bucket's right wall into the repo (the <em>read</em>), then back out of the repo and down into the next bucket (the <em>write</em>).</p>
<p>This is a companion to <a href="/pipeline">/pipeline</a> and its opposite in two ways. That map is drawn on an isometric axonometric and is about <em>the platonic process</em> — how a zebrafish becomes an atlas, in general. This one is orthographic top-down and is about <em>the state of one system on one day</em>: what is in the buckets, what is in the repos, and where the two disagree.</p>
<p><mark>The reason it is worth drawing top down.</mark> Each bucket's contents are a squarified treemap by bytes, and area is the only honest encoding for a 466:1 ratio between bronze and silver. An isometric projection foreshortens one axis, so two tiles of equal area read as unequal depending on where they sit. Straight down, a square is a square everywhere on the canvas.</p>
<p><mark>How to read the conduits.</mark> A solid line with dots moving along it has carried bytes and can be shown to have. A dashed line is code that exists and has never run. Two of the four are solid, and the pair of them is one dataset going down and coming back out again.</p>`,
  built: `<p>Bronze, its companion bucket and all four repositories were read on <mark>2026-09-01</mark>; the silver and gold bucket panels are from <mark>2026-08-29</mark> and have not been re-read since. Everything comes from the live AWS account and from the four repositories at their current main commits — zsb-medallion 00b71e8, zsb-bronze d595a82, zsb-silver 560d34a, zsb-gold 513ca22. This is the fifth read of this map, and <mark>the first where both columns moved at once</mark>. The left column gained two releases; the repo column gained 1,900 lines in one repo and lost a gate in another. It is also the first read to correct the read before it: the fourth found nothing moved on either side, and was wrong about one thing it could have checked — see below.</p>
<p>Bucket totals are <mark>aws s3 ls --recursive --summarize</mark>. Tiles aggregate those objects two path segments deep. The eight bronze manifest pins were each re-checked with <mark>head-object</mark> and all eight matched size and etag, multipart etags included — <mark>five reads running</mark>. So did all three silver release objects that zsb-silver now pins. Both repos have a <mark>pins</mark> command that runs exactly these checks and neither could be used: this instance has no <mark>uv</mark> and no virtualenv, so the eleven pins were read out of the source and put to head-object by hand. Same comparison, and worth flagging rather than hiding — a check is only automated where the toolchain exists.</p>
<p>Repository figures are commit counts, author tallies and line counts taken from fresh clones, not from the READMEs. Lines are every <mark>.py</mark> under <mark>src/</mark> and <mark>tests/</mark>; the per-module figure is <mark>src/</mark> only.</p>
<p>Two things are on this map's edges and deliberately off it. The <mark>zsb-sandbox</mark> bucket — 706 objects, 64.6 GiB, mostly three STARsolo alignment arms — has no conduits in either direction by definition, so it is not a station here. And the pipeline that preceded these repos, whose output is the six unversioned objects still sitting beside the new release in silver's minifin/ tile, is described in that tile's own notes rather than drawn as a second lane.</p>`,
  cond: `<p class="cond"><mark>Bronze was restructured between the sixth read and this one, and the drift check did not notice.</mark> The tier nearly doubled — 75,673 objects and 5.81 TiB, up from 710 and 3.59 TiB — as two Parse deliveries were unpacked into a six-stage layout beside the originals, by copy, because <mark>AGENTS.md forbids deleting from this bucket</mark>. In the same window Parse regenerated the MiniFin delivery, and the eight manifest pins passed for the seventh read running because the objects they name were never touched. <mark>A pin proves the bucket has not drifted; it cannot prove the vendor has not.</mark> Repointing the manifest at <mark>3_DGE-unfiltered/combined/all-sample/</mark> is the outstanding code change.</p>
<p class="cond">The governing fact is unchanged — <mark>two of the four hops have run</mark> — but the second of them has stopped being an event. It ran once on 2026-08-23 and twice more on the 28th, and <mark>silver now holds three releases side by side</mark>: the same 2,743,021 barcodes called three different ways, published under v1, v2 and v3, with a ledger that names all three and ranks none. That is a real architectural statement. A version here is not a defect fixed, it is a question answered differently, and the tier is built to hold several answers at once rather than to converge on one.</p>
<p class="cond"><mark>The changelog problem is closed, and its mirror image has opened.</mark> For two reads this map's sharpest finding was a ledger indexing a release nobody had uploaded; it closed by the release being published rather than the note retracted. Now zsb-bronze's dataset README says the <mark>barcode-ranks</mark> policy is 'deliberately unpublished' and stops its version table at v2 — while <mark>minifin/v3/</mark> has been in the warehouse since the 28th, published under exactly that policy, recorded in the CHANGELOG committed in the same tree. A document denying an object that exists, where before an object was missing from a document that described it. Open PR #49 is the fix, and it names the distinction the README was reaching for: <em>publication is not promotion</em>. v3 exists and is not recommended; those are two sentences, and the README collapsed them into one.</p>
<p class="cond"><mark>The gate count is one, and the gate that closed had been closed for three days before this map noticed.</mark> Gold keys are <mark>&lt;dataset&gt;/&lt;recipe&gt;/&lt;version&gt;/</mark> — a recipe is a named hyperparameter set, a version one immutable build of it. That was written down on 2026-08-23 in zsb-gold's README, its AGENTS.md, and the docstring of the stub this map drew as blocked. The fourth read looked at that commit and recorded the gate as open. The lesson is a sharper version of the fourth read's own: <mark>a gate is a claim about a repo other than the one the panel is about</mark>, and re-reading the panel will never catch it. Go and read the repo the gate names.</p>
<p class="cond">What is left is the <mark>gold v1 QC sign-off</mark>, and it is still a question for a person — which QC thresholds this company is prepared to defend. But it has stopped being a thing that is merely waited on. zsb-silver tripled in six days and the new lines are aimed straight at it: Trailmaker's QC steps 3 and 4 ported and asserted against R, a doublet scorer calling real scDblFinder behind a swappable seam, and a recipe naming every dial. <mark>The step that would run them still raises</mark>, so it is still drawn dashed — the parts exist and the orchestrator does not.</p>
<p class="cond"><mark>And this map had the threshold source backwards.</mark> It recorded that gold's QC thresholds would come from Parse's recorded <mark>settings.txt</mark>. That investigation has since been done properly, and the recorded values turn out to be run-state noise: MegaFin Plate 1 through Trailmaker twice on identical input moved the mito threshold in 88 of 90 samples, the cell-size floor in 88 of 90, and the doublet threshold in 90 of 90. The vendor's <em>decisions</em> reproduce — its recorded thresholds applied to the reconstructed population reproduce its own step-4 count to 17 cells in 92,555 — so the repo ports the rules and re-derives every threshold from the sample it is filtering, keeping the recorded numbers as a cross-check it must never gate on. The pin in the bronze manifest stays, for a different reason than this page gave for it.</p>
<p class="cond"><mark>The contract divergence is closed, by a mechanism rather than a tidy-up.</mark> All three transforms are on v0.9.0. zsb-medallion now carries a <mark>bump-consumers</mark> workflow that opens a pull request against each consumer when a version tag lands — on tags, not on every merge, and refusing to force-push over human commits on a bump branch. The rail also stopped being a vocabulary and became a library: the shared <mark>fetch</mark> is real code that both working transforms depend on, so a change there can now break a transform in a way that renaming a constant never could. That is the thing to watch next.</p>
<p class="cond">One habit worth noting because it changes what this map is for, with a caveat this read earned. Both working repos have a <mark>pins</mark> command that checks their declared objects against the live bucket and exits non-zero on drift — eleven pins between them now, since zsb-silver pins all three releases and fetches one. Neither writes anything: the buckets are owned by people, so drift is a finding. <mark>The caveat is that neither command could be run here.</mark> This instance has no uv and no virtualenv, so the eleven pins were read out of the source and put to head-object by hand. All eleven matched. The check being a command is still an improvement, but it is an improvement on the machine that has the toolchain, and this map is read from one that does not.</p>
<p class="cond"><mark>One of the two standing unknowns is partly answered, and by a route around the closed door rather than through it.</mark> Every bucket-level Get call is still AccessDenied, so the configuration cannot be read — but a <mark>head-object</mark> on any key in bronze or silver returns a <mark>VersionId</mark> and <mark>ServerSideEncryption: AES256</mark>. Both buckets are versioned and encrypted at rest, which this map has recorded as unknown since it was drawn. Cross-region replication is still unconfirmed; no object carries a ReplicationStatus header, and that is suggestive rather than decisive, because the header only appears where a rule covers the object.</p>
<p class="cond">What still cannot be checked from this instance, and is marked rather than assumed: whether the gold bucket has contents at all, and whether any bucket has a lifecycle configuration. Gold refuses both ListBucket and HeadBucket to this role, so the map says <em>contents unknown</em> and never <em>empty</em> — they call for different next actions. <mark>zsb-gold's README now states that the library is empty today.</mark> That is recorded here and not adopted: it is a sentence in a source tree, not an observation of a bucket, and keeping those apart is most of what this page is for. It is very likely true, and it is still not something this map read.</p>
<p class="cond"><mark>The waste this map complained about for five reads is gone, and the shape of how it went is the finding.</mark> Bronze lost 3.45 TiB on 2026-08-29 — the legacy <mark>megafin/</mark> prefix and <mark>minifin/raw/fastq/</mark>, both purged at the version level by a person, exactly as the rule for this bucket requires. What settled the orphan question was not a fact in the bucket. This map had recorded that nothing on the instance could decide which minifin prefix was canonical, and that was true as far as it went: the older prefix was the original upload and the one every stage manifest named, which read as decisive evidence for keeping it. It was evidence for the opposite. Those manifests belong to a pipeline tree that has since been retired, so they record what a past run used rather than what anything now reads. <mark>A reference is only a dependency if something still runs</mark> — and a map drawn from a bucket and a source tree cannot see the difference. That takes asking whether the tree is alive.</p>
<p class="cond">One thing worth keeping in view rather than in a bucket. The 61 objects of the MegaFin-1 characterization set — our STARsolo output fingerprinted against Parse's deliverable — were the only content the legacy megafin/ prefix held uniquely, and were carried to <mark>megafin-1/archive/2026-08-mega1-characterization/</mark> before it was purged. They are byte-identical to the 61 already sitting in silver's <mark>megafin-1/characterization/</mark>, so they were never at risk, though the purge was conducted as though they were. The results in them are live: a cell-calling knee that moved from 1,769 to 232 minimum UMI between two of our runs, and two independent measurements of Parse's delivery at 93 samples and 540,946 cells.</p>`
};
