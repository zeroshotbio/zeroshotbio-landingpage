/** @type {import('next').NextConfig} */
const nextConfig = {
  // The wizard data lives in daniotype_data/ (out of public/). Force-bundle it into
  // the serverless functions that read it from disk at runtime (Vercel only traces
  // statically-referenced files otherwise).
  outputFileTracingIncludes: {
    "/api/kasperov_asset/[...slug]": ["./daniotype_data/**/*"],
    "/api/kasperov_agent": ["./daniotype_data/**/*"],
    "/api/kasperov_confidence": ["./daniotype_data/**/*"],
  },
}

module.exports = nextConfig
