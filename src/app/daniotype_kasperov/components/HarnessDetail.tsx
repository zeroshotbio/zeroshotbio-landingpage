"use client";
// HarnessDetail — the "what the harness actually does" panel: the three
// personalities (expandable), the loop between them, and the harness's design
// principles + judge/score-channel notes. Shared by the new-run "2. Model &
// Harness" step and the run viewer's "2. Model & Harness" tab.
import React from "react";
import type { AgentMode } from "../types";
import { THEME } from "../theme";
import HARNESS_REGISTRY from "../harness_registry.json";

// A saved run stamps only {id, version, name, gitCommit, stampedAt}; the full
// design/summary/scoreChannel live in the registry. Merge them in by id so the
// viewer shows the same detail as the live picker.
function enrich(harness: any): any {
  const reg: any = HARNESS_REGISTRY;
  const full = (reg.harnesses || []).find((h: any) => h.id === harness?.id || h.version === harness?.version);
  return { ...(full || {}), ...(harness || {}) };
}

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 10px" };

const PERSONAS: { mode: AgentMode; role: string; inLoop: string }[] = [
  {
    mode: "research",
    role: "Searches the literature — ZFIN curated expression, ZFA anatomy, and GO — for grounded, cited evidence, tying every claim to a specific record. Two Researchers run as independent proposers so the call isn't anchored on one read.",
    inLoop: "① Two proposers each draft an identity from the markers, citing records.",
  },
  {
    mode: "archivist",
    role: "Pulls the raw, dataset-native numbers live from the :5007 stats service — DEGs, log₂FC, %-expressing, specificity, p-values, co-expression. It reports what the data says, not what the literature says, and is the grounding check on the proposers.",
    inLoop: "② Verifies the proposers against THIS dataset's own marker stats (grounding guard checks alignment before any spend).",
  },
  {
    mode: "reason",
    role: "Your partner and the loop's driver. Synthesises the evidence, dispatches the Researcher and Archivist where more is needed, judges when the call is settled, and concludes an (identity, state) at the deepest ontology tier the evidence actually supports — abstaining when a cluster is under-powered rather than forcing a guess.",
    inLoop: "③ Reasons over everything, dispatches follow-ups, then concludes — or abstains.",
  },
];

function Persona({ mode, role, inLoop }: { mode: AgentMode; role: string; inLoop: string }) {
  const th = THEME[mode];
  return (
    <details style={{ borderLeft: `3px solid ${th.color}`, background: th.bg, borderRadius: 8, padding: "8px 11px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, color: th.color, fontSize: 13.5, listStyle: "none", display: "flex", alignItems: "center", gap: 7 }}>
        <span>{th.icon}</span> {th.name}
        <span style={{ fontWeight: 400, color: "#7a746c", fontSize: 12 }}>· {inLoop}</span>
      </summary>
      <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.55, marginTop: 7 }}>{role}</div>
    </details>
  );
}

export function HarnessDetail({ harness: raw }: { harness: any }) {
  const harness = enrich(raw);
  return (
    <div style={CARD}>
      <div style={SEC}>The three personalities &amp; the loop</div>

      {/* loop flow */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        <span style={{ color: THEME.research.color }}>🔬 Researcher ×2</span>
        <span style={{ color: "#bbb" }}>→</span>
        <span style={{ color: THEME.archivist.color }}>🗄 Archivist (live :5007)</span>
        <span style={{ color: "#bbb" }}>→</span>
        <span style={{ color: THEME.reason.color }}>🧠 Reasoner</span>
        <span style={{ color: "#bbb" }}>→</span>
        <span style={{ color: "#15803d" }}>conclude / abstain</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {PERSONAS.map((p) => <Persona key={p.mode} {...p} />)}
      </div>

      {harness?.summary ? (
        <p style={{ fontSize: 12.5, color: "#555", lineHeight: 1.6, margin: "14px 0 0" }}>{harness.summary}</p>
      ) : null}

      {Array.isArray(harness?.design) && harness.design.length ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...SEC, marginBottom: 6 }}>Design principles</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {harness.design.map((d: string, i: number) => (
              <li key={i} style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {harness?.scoreChannel?.judge ? (
        <div style={{ marginTop: 12, fontSize: 11.5, color: "#7a746c", lineHeight: 1.55, borderTop: "1px solid #efece7", paddingTop: 10 }}>
          <b>Judge:</b> {harness.scoreChannel.judge}
          {harness.scoreChannel.observedVariance ? <> <b>Variance:</b> {harness.scoreChannel.observedVariance}</> : null}
        </div>
      ) : null}
    </div>
  );
}
