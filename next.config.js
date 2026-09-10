/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wizard data (daniotype_data/, ~340MB+) is served statically by nginx and fetched
  // over HTTP by the kasperov_agent/confidence routes + the browser — it is NO LONGER
  // bundled into the serverless functions (that exceeded Vercel's 250MB function cap and
  // dropped the newest datasets). See DANIOTYPE_ASSET_BASE in the kasperov routes.

  // /zfa_mapping is a self-contained static viz in public/zfa_mapping.html.
  // SOURCE + how to rebuild/redeploy: /data/scratch/zlabel/ZFA_MAPPING_README.md
  // (built by /data/scratch/zlabel/build_zfa_parallel.py; copy its output here + push).
  // /pipeline is a self-contained static viz in public/pipeline/ (index.html +
  // four classic scripts, no build step). Its <script src> attributes are
  // ABSOLUTE (/pipeline/pipeline-iso.js) because this route has no trailing
  // slash — relative paths would resolve against / and 404.
  // Contract + ownership split: public/pipeline/HANDOFF.md
  // /grcz12 is a self-contained static page in public/grcz12.html — inline CSS and
  // one inline script, no assets, no build step, so it needs no absolute-path care
  // the way /pipeline does. It is a provenance page: the built GRCz11/Ensembl-99 arm
  // beside the staged GRCz12tu/Ensembl-2025_12 arm, borrowing /pipeline's tokens.
  // SOURCE: regenerated on-instance from the s3-bronze stage manifests + decisions
  // log; every figure is read from an artefact, and unrecoverable ones are marked
  // rather than inferred. Re-copy its output here and push to redeploy.
  // /data_structures is a self-contained static viz in public/data_structures/
  // (index.html + four classic scripts, no build step), built the same way as
  // /pipeline and sharing its palette and shell. Same absolute-<script src>
  // rule applies, and for the same reason: no trailing slash on the route.
  // It is the PLAN-VIEW companion to /pipeline's isometric — the medallion
  // architecture drawn straight down and read top to bottom: the bronze, silver
  // and gold buckets in a column, the repo that performs each hop beside it, and
  // zsb-medallion as a rail to their right. Bucket contents are a treemap by
  // bytes. Contract + ownership split: public/data_structures/HANDOFF.md
  // SOURCE: read on-instance from the live S3 buckets and the four zsb-* repos.
  // /bioinformatics_pipe is a self-contained static viz in public/bioinformatics_pipe/
  // (index.html + five classic scripts, no build step), built the same way as
  // /pipeline and /data_structures and sharing their shell. Same absolute-<script
  // src> rule applies, same reason: no trailing slash on the route.
  // It is one LEG of the medallion map at higher resolution — the culls between
  // the unfiltered DGE split-pipe produces and the filtered matrix normalisation
  // expects. It is an isometric SVG map in /pipeline's own world, sharing its
  // projection: each cull is a BUILDING with its two-dimensional decision
  // painted flat on the roof by a single transform="matrix()". Painted marks
  // come out as ellipses, airborne ones as circles, and that is the grammar.
  // Every threshold on those roofs is COMPUTED at load from a seeded simulation
  // in bp-pop.js; none is a literal. That matters because only one of the four
  // culls drawn has code that has ever run, so the page marks every figure real
  // or modelled and must keep doing so.
  // Contract + ownership split: public/bioinformatics_pipe/HANDOFF.md
  // /FASTQ_pipe is the OTHER HALF of that same row, built the same way from the
  // same shell: public/FASTQ_pipe/ (index.html + four classic scripts, no build
  // step), same absolute-<script src> rule, same reason. It draws everything
  // between the reads and the first matrix — barcode parse, genome index,
  // alignment, gene assignment, UMI deduplication, matrix build — where
  // /bioinformatics_pipe draws everything after it. Nothing on it is modelled
  // and it loads no /culls files: there is no threshold on this stretch that
  // has to be invented to be drawn. Its saved layout has its OWN record,
  // /api/fqpipe_edits, id "FASTQ_pipe::edits" — never the neighbouring map's,
  // or whichever saved last would erase the other silently.
  // The contract and the reasoning behind every shape live in the file headers
  // of public/FASTQ_pipe/*.js — fq-data.js for what the map is about, and each
  // draw* block for why it is drawn that way.
  // SCAFFOLDING — delete this whole redirects() block when the /fate_map index
  // page is built. /fate_map was live for a few hours pointing at the Wang map,
  // so this keeps that link working. It is 307 (permanent: false) on purpose:
  // a 308 would be cached by browsers and would shadow the real index page for
  // anyone who had visited before it shipped.
  async redirects() {
    return [
      { source: '/fate_map', destination: '/fate_map_wang_2026', permanent: false },
    ]
  },

  async rewrites() {
    return [
      { source: '/zfa_mapping', destination: '/zfa_mapping.html' },
      { source: '/pipeline', destination: '/pipeline/index.html' },
      { source: '/data_structures', destination: '/data_structures/index.html' },
      { source: '/bioinformatics_pipe', destination: '/bioinformatics_pipe/index.html' },
      { source: '/FASTQ_pipe', destination: '/FASTQ_pipe/index.html' },
      // Row 2 on its own, for developing that section out. It is NOT a second
      // copy of the map code: it loads /pipeline's iso, shapes and view
      // unchanged and differs only in its data file, its saved record
      // (/api/molecular_edits) and its grid, all three set in MAP_CONFIG.
      { source: '/molecular_pipe', destination: '/molecular_pipe/index.html' },
      { source: '/grcz12', destination: '/grcz12.html' },
      // /dev_tree is a self-contained static viz in public/dev_tree/ (index.html,
      // one classic script, one JSON, no build step) — same shape as /pipeline,
      // same absolute-<script src> rule and the same reason: no trailing slash
      // on the route, so a relative src would resolve against /.
      // It is a 0-48 hpf zebrafish developmental tidy tree: the DanioCell
      // cluster-annotation hierarchy laid out left-to-right with hpf on x,
      // one panned diagram with the detail on hover.
      // The tree's edges are ANNOTATION CONTAINMENT, not lineage — see
      // public/dev_tree/NOTES.md before changing anything that could read as a
      // lineage claim. SOURCE + rebuild: scripts/build_dev_tree.py.
      { source: '/dev_tree', destination: '/dev_tree/index.html' },
      // FATE MAPS. One page per published source, named fate_map_<author>_<year>;
      // /fate_map itself is RESERVED for the index that will gather them and is
      // deliberately not a page yet — do not rewrite it to any single map.
      //
      // /fate_map_wang_2026 is a self-contained static viz in
      // public/fate_map_wang_2026/ (index.html, four classic scripts, four binary
      // assets, no build step) — same shape as /pipeline and /dev_tree, same
      // absolute-<script src> rule and the same reason: no trailing slash on the
      // route, so a relative src would resolve against /.
      // It is a 5.5-11.3 hpf zebrafish cell-fate map built from the ITEC
      // whole-embryo lineage reconstruction (Wang et al. 2026, CC-BY).
      // Unlike /dev_tree, the edges here ARE lineage — one tracked nucleus per
      // stroke. What is NOT lineage is the TERRITORY each lineage ends in:
      // those are geometric regions of a fitted sphere, because the authors'
      // organ segmentation is not in the public deposit. The page says so and
      // must keep saying so.
      // SOURCE + rebuild: scripts/build_fate_map_wang_2026.py (--fetch pulls the
      // 1.2 GB of source CSVs from Mendeley doi 10.17632/tg55phtk4r.1).
      // Read public/fate_map_wang_2026/NOTES.md before changing anything that
      // could read as an anatomical claim. Its look is the plate style —
      // PLATE_STYLE.md at the repo root.
      { source: '/fate_map_wang_2026', destination: '/fate_map_wang_2026/index.html' },
      // /fate_map_daniocell is the sister page, same shape and same plate style,
      // built from the DanioCell atlas (Sur et al. 2023).
      // It draws TRANSCRIPTIONAL IDENTITY, not ancestry: DanioCell dissociates
      // and reads each cell once and carries no lineage tracing at all. The
      // Wang page's vocabulary — descends from, ancestor, lineage — is banned
      // here, and Plate IV's URD trajectory is INFERRED from expression, never
      // observed. Read public/fate_map_daniocell/NOTES.md before touching
      // anything that could read as a lineage claim.
      // SOURCE + rebuild: scripts/build_fate_map_daniocell.py, with the
      // embeddings extracted once by scripts/extract_daniocell_seurat.R.
      { source: '/fate_map_daniocell', destination: '/fate_map_daniocell/index.html' },
      // /fate_map_zebrahub is the third, and the only one that must hold BOTH
      // vocabularies at once: its single-cell plates are transcriptional
      // identity (no lineage, like /fate_map_daniocell) while its light-sheet
      // plate IS lineage (like /fate_map_wang_2026) — and they are DIFFERENT
      // EMBRYOS, so nothing registers one to the other. Plate IV may say
      // "divides"; Plates I-III may not. RNA velocity is deliberately absent:
      // the authors' velocity inputs were never deposited. Read
      // public/fate_map_zebrahub/NOTES.md before touching any of that.
      // SOURCE + rebuild: scripts/build_fate_map_zebrahub.py
      { source: '/fate_map_zebrahub', destination: '/fate_map_zebrahub/index.html' },
      // /fate_map_24_48 is the fourth, and the first NOT named for a source. The
      // siblings each draw one published dataset's own picture of itself; this one
      // draws a SKELETON for a time window — the Trapnell v2.2.1 inferred state
      // graph over 24-48 hpf — that ZSCAPE, ZMAP, DanioCell and the spatial layers
      // are meant to hang on next. Hence the window in the name rather than an
      // author and a year.
      // Everything on it is INFERRED: the corpus contains no observed cell division
      // between 24 and 48 hpf, and the page says so in the dek, the caution, the
      // caption and the notes, because a reader landing mid-page must not be able
      // to acquire the wrong belief.
      // Same shape as the siblings: index.html + three classic scripts, no build
      // step at serve time, absolute <script src> because the route has no
      // trailing slash.
      // SOURCE + rebuild: scripts/build_fate_map_24_48.py, reading
      // combined_state_graphs.rds, edge_lit_evidence.tsv and the control arm of the
      // lmx1b contrast table from s3://zsb-silver-warehouse/platt/v2.2.1/.
      // The click panel's quantitative half comes from a SECOND pass,
      // scripts/build_fate_map_24_48_enrich.py, which opens the 1,220,178-cell
      // reference CDS and joins it to ZSCAPE on the shared cell barcodes. That
      // script has a heavy prerequisite (the CDS extraction) and writes enrich.json
      // here plus reusable crosswalk tables to /data/fate_map/ on the analysis
      // instance. enrich.json is OPTIONAL at runtime: without it the page degrades
      // to the first-pass panel rather than failing.
      // A THIRD pass, scripts/build_fate_map_24_48_zmap.py, adds the ZMAP block to
      // the panel. ZMAP shares NO cells with Platt, so unlike the ZSCAPE crosswalk
      // it is matched by expression profile (Spearman over 2,251 HVGs) and is
      // weaker evidence — the panel and the tables say so on every row. Its
      // prerequisites are two pseudobulk passes whose scripts ship beside the page
      // (pseudobulk_platt.py, pseudobulk_zmap.py). zmap.json is optional too.
      // Plate III is the LANDSCAPE: 844,825 wild-type ZSCAPE cells on a time
      // scrubber, plus control-vs-perturbed centroid arrows and one shared
      // response axis. Built by build_fate_map_24_48_embed.py (cells.bin,
      // states.json, embed_meta.json), _perturb.py (perturb.json) and _axis.py,
      // in that order — the perturbation pass REUSES the projection stored in
      // embed_meta.json rather than recomputing it, or every arrow shifts.
      // Nothing on it is tracked and the plate says so three ways; do not make
      // the trail a solid line.
      // Plate IV is the TERRAIN: time down the page 24->48 hpf, the surface the
      // within-hour RANK of wild-type cell density (not the raw log — two
      // attempts on that rendered as ruled lines), plus a ChemFish drug layer.
      // Built by build_fate_map_24_48_terrain.py, which needs Plate III's
      // cells.bin and the Platt-ZSCAPE crosswalk. It sets HDF5_USE_FILE_LOCKING
      // off because minifin_query serves the same chemfish.h5ad and h5py blocks
      // for ever on the open otherwise. The terrain is an INTERPRETIVE rendering
      // of transcriptomic state space; the plate says so in the caption, the
      // panel and the notes. Do not let it be described as anatomy or lineage.
      // Plate II is the PROVENANCE stack — fourteen sources on one developmental
      // axis, with only the two that actually feed the page drawn filled. Its
      // record is sources.json, written by scripts/build_fate_map_24_48_sources.py,
      // and it is optional at runtime too. Citations there are verbatim from the
      // silver READMEs; do not "improve" one without checking the README it came
      // from — Platt genuinely has no DOI and the page says so.
      // Read public/fate_map_24_48/NOTES.md before changing the encoding of an
      // edge — the literature verdict in the stroke is the whole argument.
      { source: '/fate_map_24_48', destination: '/fate_map_24_48/index.html' },
    ]
  },

  // The /pipeline shell and its four scripts are ONE unit: the HTML names the
  // elements the scripts reach for. Cache them independently and a browser can
  // end up running today's scripts against last week's HTML, which is not a
  // degraded page — a script that cannot find an element it wants stops, and
  // everything after that point in the file never runs. Revalidate every load;
  // they are small and 304s are cheap.
  async headers() {
    return [
      {
        source: '/pipeline/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/pipeline',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // Same shell-and-scripts coupling as /pipeline, same reason.
      {
        source: '/data_structures/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/data_structures',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // Same shell-and-scripts coupling again, and one more reason here: every
      // threshold the roofs draw is derived in bp-shapes.js from the population
      // in bp-pop.js, so a stale script pairs today's drawing code with
      // yesterday's statistics and the cuts stop matching the clouds.
      {
        source: '/bioinformatics_pipe/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/bioinformatics_pipe',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // Same shell-and-scripts coupling once more: index.html names the
      // elements the four scripts reach for, and a script that cannot find an
      // element it wants stops dead, taking everything after it in the file.
      {
        source: '/FASTQ_pipe/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/FASTQ_pipe',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // and the same shell-and-script coupling for the developmental tree:
      // index.html names the elements tree.js reaches for, and tree.js is
      // written against the exact field set build_dev_tree.py emits into
      // tree.json — a stale pairing of any two of the three draws a tree that
      // is quietly wrong rather than visibly broken.
      {
        source: '/dev_tree/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/dev_tree',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // and the same shell-and-scripts coupling for the fate map: index.html
      // names the elements the four scripts reach for, and fm-data.js is
      // written against the exact binary layouts build_fate_map_wang_2026.py
      // emits. A
      // stale pairing of any two of the three would draw a plausible, wrong
      // picture rather than fail — which is why fmLoad() also cross-checks
      // every header count against meta.json and refuses to draw on mismatch.
      // same shell-and-scripts coupling, same reason, for the third fate map
      {
        source: '/fate_map_zebrahub/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/fate_map_zebrahub',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // same shell-and-scripts coupling, same reason, for the 24-48 hpf skeleton
      {
        source: '/fate_map_24_48/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/fate_map_24_48',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // same shell-and-scripts coupling, same reason, for the sister page
      {
        source: '/fate_map_daniocell/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/fate_map_daniocell',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/fate_map_wang_2026/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/fate_map_wang_2026',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      // and the same for the molecular bench
      {
        source: '/molecular_pipe/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
      {
        source: '/molecular_pipe',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ]
  },
}

module.exports = nextConfig
