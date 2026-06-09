// src/app/api/kasperov_proxy/route.ts
//
// Read-only viewer proxy for the daniotype_kasperov "live activity" pane: fetches
// a research page (ZFIN / ZFA·EBI / GO / NCBI / UniProt) the Researcher cited,
// strips frame-blocking + CSP so it can be shown in an iframe, injects a <base>
// so the page's own CSS/images still load, and a small script that scrolls to and
// highlights the gene/term the Researcher is zeroing in on. Host-allowlisted (not
// an open proxy); the iframe is sandboxed without allow-same-origin, so the
// proxied page can't touch our origin.

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOW = [
  "zfin.org",
  "ebi.ac.uk",
  "geneontology.org",
  "amigo.geneontology.org",
  "ncbi.nlm.nih.gov",
  "uniprot.org",
  "wikipedia.org",
];

function allowed(host: string): boolean {
  return ALLOW.some((h) => host === h || host.endsWith("." + h));
}

function highlightScript(term: string): string {
  if (!term) return "";
  return `<script>(function(){try{
    var term=${JSON.stringify(term)};
    function esc(s){return s.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');}
    function run(){try{
      var re=new RegExp(esc(term),'i');
      var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
      while(n=w.nextNode()){
        var v=n.nodeValue; if(!v||v.length>4000) continue;
        var i=v.search(re);
        if(i>=0 && n.parentNode && !/SCRIPT|STYLE/.test(n.parentNode.nodeName)){
          var m=document.createElement('mark');
          m.style.background='#ffe98a'; m.style.color='#1f2937'; m.style.borderRadius='3px'; m.style.padding='0 2px';
          var mid=n.splitText(i); mid.splitText(term.length);
          m.appendChild(mid.cloneNode(true)); mid.parentNode.replaceChild(m,mid);
          m.scrollIntoView({behavior:'smooth',block:'center'});
          return;
        }
      }
    }catch(e){}}
    if(document.body) setTimeout(run,500); else window.addEventListener('DOMContentLoaded',function(){setTimeout(run,500);});
  }catch(e){}})();</script>`;
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const target = u.searchParams.get("url") || "";
  const highlight = (u.searchParams.get("highlight") || "").slice(0, 60);
  let t: URL;
  try {
    t = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (t.protocol !== "https:" || !allowed(t.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(t.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      // pass non-HTML (e.g. an image/PDF) straight through
      return new Response(r.body, { status: r.status, headers: { "content-type": ct, "cache-control": "no-store" } });
    }
    let html = await r.text();
    const baseHref = r.url || t.toString();
    // neutralise anything that would block embedding or our injected script
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
    html = html.replace(/<base\b[^>]*>/gi, "");
    const inject = `<base href="${baseHref}"><style>html{scroll-behavior:smooth}</style>${highlightScript(highlight)}`;
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, (m) => `${m}${inject}`);
    else html = inject + html;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
