/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wizard data (daniotype_data/, ~340MB+) is served statically by nginx and fetched
  // over HTTP by the kasperov_agent/confidence routes + the browser — it is NO LONGER
  // bundled into the serverless functions (that exceeded Vercel's 250MB function cap and
  // dropped the newest datasets). See DANIOTYPE_ASSET_BASE in the kasperov routes.

  // /zfa_mapping is a self-contained static viz in public/zfa_mapping.html
  async rewrites() {
    return [{ source: '/zfa_mapping', destination: '/zfa_mapping.html' }]
  },
}

module.exports = nextConfig
