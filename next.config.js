/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wizard data (daniotype_data/, ~340MB+) is served statically by nginx and fetched
  // over HTTP by the kasperov_agent/confidence routes + the browser — it is NO LONGER
  // bundled into the serverless functions (that exceeded Vercel's 250MB function cap and
  // dropped the newest datasets). See DANIOTYPE_ASSET_BASE in the kasperov routes.
}

module.exports = nextConfig
