// src/app/api/kasperov_agent/route.ts
//
// Research-agent backend for the daniotype_kasperov labelling wizard.
//
// Given a cluster's top differential genes, it runs Claude with the web-search
// server tool restricted to the canonical zebrafish evidence resources (ZFIN,
// ZFA via EBI OLS, GO / QuickGO, NCBI Gene, UniProt) — the same evidence ladder
// the daniotype descent grounds on — and returns a concise, cited markdown
// dossier the human judge can accept or interrogate further via chat.
//
// Falls back to a deterministic dossier built from the sample atlas when no
// ANTHROPIC_API_KEY is present, so the preview always renders.

import "server-only";
export const runtime = "nodejs";
// 60s is the Vercel hobby-plan ceiling. If you upgrade to Pro you can raise this
// to 300 for deeper multi-search agent runs.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { ATLAS, type AtlasNode } from "../../daniotype_kasperov/atlas";

const MODEL = process.env.KASPEROV_AGENT_MODEL || "claude-opus-4-8";

// Canonical zebrafish evidence resources — the only places the agent may search.
const ALLOWED_DOMAINS = [
  "zfin.org",
  "www.ebi.ac.uk", // OLS (ZFA) + QuickGO
  "ebi.ac.uk",
  "geneontology.org",
  "amigo.geneontology.org",
  "www.ncbi.nlm.nih.gov",
  "www.uniprot.org",
];

type ChatMessage = { role: "user" | "assistant"; content: string };

function nodeById(id: string): AtlasNode | undefined {
  return ATLAS.find((n) => n.id === id);
}

function up(node: AtlasNode) {
  return node.markers.filter((m) => m.direction === "up").map((m) => m.gene);
}
function down(node: AtlasNode) {
  return node.markers.filter((m) => m.direction === "down").map((m) => m.gene);
}

function buildSystem(node: AtlasNode): string {
  const exprLines = node.expression
    .map((e) => `  - ${e.gene} → ${e.zfa_term} (${e.zfa_id}, ${e.stage})`)
    .join("\n");
  const goLines = node.go.map((g) => `  - ${g.gene} → ${g.go_term} (${g.go_id}, ${g.aspect})`).join("\n");
  return [
    "You are a zebrafish (Danio rerio) single-cell cell-type annotation research agent working alongside a human curator who makes the final call.",
    "Your job: from a cluster's differential markers, determine the most defensible cell-type identity by grounding it in canonical evidence — exactly as a curator does: markers → in-vivo expression (ZFIN) → ZFA anatomy → cell type, corroborated by GO function.",
    "",
    "RULES (cite-discipline):",
    "- Search ONLY the canonical resources available to you (ZFIN, ZFA via EBI OLS, GO/QuickGO, NCBI Gene, UniProt). Do not rely on unsourced memory for any anatomical or functional claim.",
    "- Ground every claim in one of the cluster's listed differential genes and a looked-up ZFA / GO id or a ZFIN expression record. Cite sources inline as markdown links.",
    "- Use the zebrafish (identity, state) model: identity is the lineage/cell-type name; state ∈ {progenitor, cycling, quiescent, mature, stress} only when the markers support it.",
    "- If the evidence cannot ground a confident name, say so and abstain — do not force-fit. The human will adjudicate.",
    "- Be concise and skimmable: short markdown. End with a final line: `**Verdict:** <name>[, <state>] — confidence <low|medium|high>`.",
    "",
    `CLUSTER CONTEXT (cluster id ${node.id}, ${node.n_cells.toLocaleString()} cells):`,
    `- Up-regulated markers: ${up(node).join(", ") || "(none)"}`,
    `- Conspicuously absent / down: ${down(node).join(", ") || "(none)"}`,
    `- The deterministic pipeline tentatively proposes: ${node.decision.name}${node.decision.state ? ` (${node.decision.state})` : ""} — verify or refute it; do not assume it is correct.`,
    "- Starting evidence already pulled by the pipeline's grounding tools (you may extend or challenge it):",
    exprLines || "  - (no ZFIN expression rows on file)",
    goLines || "  - (no GO rows on file)",
  ].join("\n");
}

// Deterministic offline dossier (no API key / upstream failure).
function fallbackDossier(node: AtlasNode): string {
  const exprBul = node.expression
    .map((e) => `- **${e.gene}** → ${e.zfa_term} ([${e.zfa_id}](https://www.ebi.ac.uk/ols4/ontologies/zfa/classes?obo_id=${e.zfa_id}), ${e.stage})`)
    .join("\n");
  const goBul = node.go
    .map((g) => `- **${g.gene}** → ${g.go_term} ([${g.go_id}](https://www.ebi.ac.uk/QuickGO/term/${g.go_id}), ${g.aspect})`)
    .join("\n");
  const state = node.decision.state ? `, ${node.decision.state}` : "";
  return [
    `*(Offline mode — no live research agent configured. Showing the pipeline's pre-pulled grounding evidence for cluster \`${node.id}\`.)*`,
    "",
    `**Up-regulated markers:** ${up(node).join(", ") || "—"}`,
    `**Absent / down:** ${down(node).join(", ") || "—"}`,
    "",
    "**ZFIN in-vivo expression**",
    exprBul || "_none on file_",
    "",
    "**GO annotations**",
    goBul || "_none on file_",
    "",
    node.decision.rationale,
    "",
    `**Verdict:** ${node.decision.name}${state} — confidence ${
      node.decision.confidence >= 0.8 ? "high" : node.decision.confidence >= 0.6 ? "medium" : "low"
    }`,
  ].join("\n");
}

function textFromContent(content: any[]): string {
  return (content || [])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const clusterId = String(body?.clusterId ?? "");
  const node = nodeById(clusterId);
  if (!node) return NextResponse.json({ error: "unknown_cluster" }, { status: 400 });

  const messages: ChatMessage[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
        .slice(-12)
    : [];
  if (messages.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ reply: fallbackDossier(node), model: "offline" });
  }

  const system = buildSystem(node);
  const tools = [
    {
      type: "web_search_20260209",
      name: "web_search",
      allowed_domains: ALLOWED_DOMAINS,
      max_uses: 6,
    },
  ];

  // Server-tool loop: the API runs web searches server-side and may return
  // stop_reason "pause_turn" between iterations — re-send to resume.
  const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }));
  try {
    let finalText = "";
    for (let i = 0; i < 4; i++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 55000);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 3000,
          system,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          tools,
          messages: convo,
        }),
      });
      clearTimeout(t);
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        // Graceful degrade to offline dossier on upstream failure.
        return NextResponse.json(
          { reply: fallbackDossier(node), model: "offline", upstream_error: detail.slice(0, 300) },
          { status: 200 }
        );
      }
      const data = await r.json();
      finalText = textFromContent(data?.content) || finalText;
      if (data?.stop_reason === "pause_turn") {
        // Resume: append the assistant turn verbatim and call again.
        convo.push({ role: "assistant", content: data.content });
        continue;
      }
      break;
    }
    return NextResponse.json({ reply: finalText || "_(no response)_", model: MODEL });
  } catch (e: any) {
    return NextResponse.json(
      { reply: fallbackDossier(node), model: "offline", exception: String(e?.message ?? e).slice(0, 200) },
      { status: 200 }
    );
  }
}
