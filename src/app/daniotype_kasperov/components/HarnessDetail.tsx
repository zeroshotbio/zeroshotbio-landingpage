"use client";
// HarnessDetail — the three personalities of the SELECTED harness, each with its full
// system prompt (click to expand). The content updates with the chosen harness: v1.0/v1.1
// show the served Researcher→Archivist→Reasoner loop; v2.0 shows the multi-level
// (coarse → gated descent → escape-hatch) framing. Shown in the "2. Model & Harness" step.
import React from "react";
import type { AgentMode } from "../types";
import { THEME } from "../theme";
import { PERSONA_PROMPTS } from "../personas";

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 10px" };

type Persona = { mode: AgentMode; tagline: string; prompt: string };

// v1.0 / v1.1 — the served three-personality loop (one call per personality, per cluster).
const V1_PERSONAS: Persona[] = [
  { mode: "research", tagline: "Restricted web search over ZFIN / ZFA / GO — grounds the call in cited records. Two run as independent proposers per cluster.", prompt: PERSONA_PROMPTS.research },
  { mode: "archivist", tagline: "Answers only from the dataset's raw numbers, fetched live from :5007 — log₂FC, %-expressing, specificity, p-values, co-expression.", prompt: PERSONA_PROMPTS.archivist },
  { mode: "reason", tagline: "The driver: synthesises the two reads, dispatches follow-ups, and concludes (or abstains) at the deepest tier the evidence supports.", prompt: PERSONA_PROMPTS.reason },
];

// v2.0 — the same three personalities, re-orchestrated for the multi-level descent.
const V2_RESEARCH_PROMPT = [
  "You are the Researcher in the v2.0 MULTI-LEVEL harness.",
  "",
  "LEVEL 0 — COARSE: given a broad coarse compartment from the ZSCAPE 48 hpf atlas, name the BROAD germ-layer / tissue UMBRELLA it represents — NOT a fine subtype. Ground each claim in ZFIN / ZFA / GO; if genuinely ambiguous, give the deepest defensible umbrella, else abstain.",
  "",
  "LEVEL 1 — SUB-LEAF (top-down): given a sub-population WITHIN a compartment already called \"<umbrella>\" (the labeller's OWN prior call, NOT ground truth — a strong prior, not a fact), identify its SPECIFIC SUBTYPE. You are handed:",
  " • the confirmed parent umbrella as a top-down prior,",
  " • the expected CELL-TYPE checklist for that tissue — ATTEMPT the easy/expected types; the hard continuum / shared-program blends (e.g. endoderm) may be ABSTAINED, don't force a call,",
  " • experiential hints — adult markers are off at 48 hpf so ABSENCE ≠ evidence; promiscuous markers need a specific positive anchor,",
  " • any hidden-tissue hunt list for this branch.",
  "",
  "ESCAPE HATCH: if THIS leaf's markers STRONGLY and SPECIFICALLY contradict \"<umbrella>\" — a real lineage anchor, not a promiscuous gene — say so; the Reasoner may re-home it.",
  "If the markers don't confidently support a subtype, ABSTAIN and roll up to \"<umbrella>\".",
].join("\n");

const V2_REASON_PROMPT = [
  "You are the Reasoner — the driver of the v2.0 MULTI-LEVEL descent.",
  "",
  "GATE every dive: descend into a compartment's leaves ONLY where (a) the parent call was confident AND (b) the expected-tissue / cell-type checklist still lists something expected-and-unfound in that branch. Targeted-deep, not exhaustive-deep — skip confident branches with nothing left to find.",
  "",
  "CONCLUDE with a kasperov-conclude block: assign the umbrella (Level 0) or the subtype (Level 1) when grounded in the unit's OWN markers, else abstain and roll up to the deepest defensible tier.",
  "",
  "ESCAPE HATCH: if a sub-leaf's markers are a specific lineage anchor contradicting its parent umbrella, set \"rehomed\": true and \"rehomedTo\": \"<correct identity>\" — use sparingly; a promiscuous / low-specificity marker is not enough.",
  "",
  "Stay GT-blind — the parent umbrella is a prior, never ground truth.",
].join("\n");

const V2_PERSONAS: Persona[] = [
  { mode: "research", tagline: "Coarse-first: names each compartment's broad tissue umbrella, then — on the gated descent — proposes the sub-leaf subtype with the confirmed parent umbrella injected as a top-down prior plus the cell-type checklist and experiential hints.", prompt: V2_RESEARCH_PROMPT },
  { mode: "archivist", tagline: "Verifies the cited markers on the dataset's raw numbers — the same Archivist, queried per compartment and per leaf as the descent goes deeper.", prompt: PERSONA_PROMPTS.archivist },
  { mode: "reason", tagline: "Drives the multi-level descent: gates each dive (parent confident AND checklist non-empty), concludes the umbrella/subtype, and may use the escape hatch to re-home a sub-leaf whose markers specifically contradict its parent.", prompt: V2_REASON_PROMPT },
];

function personasFor(id?: string): Persona[] {
  return id === "v2.0" ? V2_PERSONAS : V1_PERSONAS;
}

// One personality: a coloured node that expands to its FULL system prompt.
function PersonaNode({ mode, tagline, prompt }: Persona) {
  const th = THEME[mode];
  return (
    <details open style={{ flex: "1 1 220px", minWidth: 220, border: `1px solid ${th.color}55`, borderTop: `3px solid ${th.color}`, background: th.bg, borderRadius: 10, padding: "10px 12px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 18 }}>{th.icon}</span>
        <span style={{ fontWeight: 800, color: th.color, fontSize: 14 }}>{th.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 99, padding: "1px 8px", whiteSpace: "nowrap" }}>▸ full prompt</span>
      </summary>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: "8px 0 8px" }}>{tagline}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", marginBottom: 4 }}>System prompt</div>
      <pre style={{ margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, lineHeight: 1.5, color: "#3f3a34", background: "#fff", border: "1px solid #ece8e2", borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {prompt}
      </pre>
    </details>
  );
}

export function HarnessDetail({ harness }: { harness: any }) {
  const personas = personasFor(harness?.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={CARD}>
        <div style={SEC}>The three personalities — click any to read its full system prompt</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {personas.map((p) => <PersonaNode key={p.mode} {...p} />)}
        </div>
      </div>
    </div>
  );
}
