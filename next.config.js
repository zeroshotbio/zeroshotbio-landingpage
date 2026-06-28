/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wizard data (daniotype_data/, ~340MB+) is served statically by nginx and fetched
  // over HTTP by the kasperov_agent/confidence routes + the browser — it is NO LONGER
  // bundled into the serverless functions (that exceeded Vercel's 250MB function cap and
  // dropped the newest datasets). See DANIOTYPE_ASSET_BASE in the kasperov routes.

  // /steven_judgement is a Python critique-capture service on the EC2 box (zscape.zeroshot.bio
  // :5009 behind nginx) — it can't run on Vercel, so the homepage proxies to it. The Basic-Auth
  // gate is enforced by middleware.ts (password 'danio_lover'); the EC2 nginx layer requires the
  // same Basic creds and injects the upstream API token.
  async rewrites() {
    return [
      { source: "/steven_judgement", destination: "https://zscape.zeroshot.bio/steven_judgement/" },
      { source: "/steven_judgement/:path*", destination: "https://zscape.zeroshot.bio/steven_judgement/:path*" },
    ];
  },
}

module.exports = nextConfig
