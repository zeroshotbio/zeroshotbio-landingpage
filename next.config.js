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
  async rewrites() {
    return [
      { source: '/zfa_mapping', destination: '/zfa_mapping.html' },
      { source: '/pipeline', destination: '/pipeline/index.html' },
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
    ]
  },
}

module.exports = nextConfig
