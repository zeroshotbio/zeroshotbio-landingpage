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
  // It is the PLAN-VIEW companion to /pipeline's isometric — five stations of
  // the medallion architecture drawn straight down, with bucket contents as a
  // treemap by bytes. Contract + ownership split: public/data_structures/HANDOFF.md
  // SOURCE: read on-instance from the live S3 buckets and the four zsb-* repos.
  async rewrites() {
    return [
      { source: '/zfa_mapping', destination: '/zfa_mapping.html' },
      { source: '/pipeline', destination: '/pipeline/index.html' },
      { source: '/data_structures', destination: '/data_structures/index.html' },
      { source: '/grcz12', destination: '/grcz12.html' },
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
    ]
  },
}

module.exports = nextConfig
