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
      // It is a 0-24 hpf zebrafish developmental tidy tree: the DanioCell
      // cluster-annotation hierarchy laid out left-to-right with hpf on x.
      // The tree's edges are ANNOTATION CONTAINMENT, not lineage — see
      // public/dev_tree/NOTES.md before changing anything that could read as a
      // lineage claim. SOURCE + rebuild: scripts/build_dev_tree.py.
      { source: '/dev_tree', destination: '/dev_tree/index.html' },
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
