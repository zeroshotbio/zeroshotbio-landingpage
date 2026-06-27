import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gate the DanioType wizard AND the /patrick R4b decision dashboard — their pages,
// API routes, and data-asset routes — behind HTTP Basic Auth. Every other route on
// the site stays public. One shared password, env-var'd (KASPEROV_BASIC_PASSWORD);
// the username is ignored (leave it blank). After one browser login the same URL
// works normally; the public can reach neither the pages nor their JSONs. The
// autopilot worker authenticates with the same Basic password.
export const config = {
  matcher: [
    "/daniotype_kasperov",
    "/daniotype_kasperov/:path*",
    "/api/kasperov_agent/:path*",
    "/api/kasperov_confidence/:path*",
    "/api/kasperov_score/:path*",
    "/api/kasperov_runs/:path*",
    "/api/kasperov_autopilot/:path*",
    "/patrick",
    "/patrick/:path*",
  ],
};

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="DanioType", charset="UTF-8"' },
  });
}

// constant-time string compare (edge runtime — no node:crypto)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function middleware(req: NextRequest) {
  const expected = process.env.KASPEROV_BASIC_PASSWORD || "";
  // Fail closed: with no password configured the wizard is fully locked.
  if (!expected) return unauthorized();
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try { decoded = atob(header.slice(6)); } catch { decoded = ""; }
    const i = decoded.indexOf(":");
    const pass = i >= 0 ? decoded.slice(i + 1) : "";
    if (pass && safeEqual(pass, expected)) return NextResponse.next();
  }
  return unauthorized();
}
