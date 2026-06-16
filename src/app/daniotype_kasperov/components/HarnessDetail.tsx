"use client";
// HarnessDetail — what the harness actually does: the loop between the three
// personalities (schematic), each personality's FULL system prompt (click to
// expand), the design principles, and the judge in its own section. Shared by
// the new-run "2. Model & Harness" step and the run viewer's matching tab.
import React from "react";
import type { AgentMode } from "../types";
import { THEME } from "../theme";
import { PERSONA_PROMPTS } from "../personas";
import HARNESS_REGISTRY from "../harness_registry.json";

function enrich(harness: any): any {
  const reg: any = HARNESS_REGISTRY;
  const full = (reg.harnesses || []).find((h: any) => h.id === harness?.id || h.version === harness?.version);
  return { ...(full || {}), ...(harness || {}) };
}

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "16px 18px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 10px" };

const PERSONAS: { mode: AgentMode; tagline: string }[] = [
  { mode: "research", tagline: "Restricted web search over ZFIN / ZFA / GO — grounds the call in cited records. Two run as independent proposers." },
  { mode: "archivist", tagline: "Answers only from the dataset's raw numbers, fetched live from :5007 — log₂FC, %-expressing, specificity, p-values, co-expression." },
  { mode: "reason", tagline: "The driver: synthesises, dispatches the other two, and concludes (or abstains) at the deepest tier the evidence supports." },
];

// One personality: a coloured loop node that expands to its FULL system prompt.
function PersonaNode({ mode, tagline }: { mode: AgentMode; tagline: string }) {
  const th = THEME[mode];
  return (
    <details style={{ flex: "1 1 220px", minWidth: 220, border: `1px solid ${th.color}55`, borderTop: `3px solid ${th.color}`, background: th.bg, borderRadius: 10, padding: "10px 12px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 18 }}>{th.icon}</span>
        <span style={{ fontWeight: 800, color: th.color, fontSize: 14 }}>{th.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 99, padding: "1px 8px", whiteSpace: "nowrap" }}>▸ full prompt</span>
      </summary>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: "8px 0 8px" }}>{tagline}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#9a948c", marginBottom: 4 }}>System prompt</div>
      <pre style={{ margin: 0, maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, lineHeight: 1.5, color: "#3f3a34", background: "#fff", border: "1px solid #ece8e2", borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {PERSONA_PROMPTS[mode]}
      </pre>
    </details>
  );
}

export function HarnessDetail({ harness: raw }: { harness: any }) {
  const harness = enrich(raw);
  const sc = harness?.scoreChannel;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* THE LOOP — schematic cycle */}
      <div style={CARD}>
        <div style={SEC}>The loop · three personalities</div>
        <div style={{ border: "1px dashed #cfcabf", borderRadius: 12, padding: "14px 14px 10px", position: "relative", background: "#fcfbf9" }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
            <Step n="①" label="Researcher ×2" sub="propose, cite" color={THEME.research.color} />
            <Arrow />
            <Step n="②" label="Archivist" sub="verify on live stats" color={THEME.archivist.color} />
            <Arrow />
            <Step n="③" label="Reasoner" sub="synthesise · dispatch" color={THEME.reason.color} />
            <Arrow />
            <Step n="✓" label="Conclude / abstain" sub="deepest defensible tier" color="#15803d" />
          </div>
          {/* the loop-back */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "#a16207", fontSize: 12, fontWeight: 700 }}>
            <span style={{ fontSize: 18 }}>↻</span>
            <span>repeats — the Reasoner dispatches the Researcher &amp; Archivist again until the evidence converges, then concludes. Grounding guard checks :5007 alignment before any spend.</span>
          </div>
        </div>
      </div>

      {/* THE PERSONALITIES — full system prompts on click */}
      <div style={CARD}>
        <div style={SEC}>The three personalities — click any to read its full system prompt</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {PERSONAS.map((p) => <PersonaNode key={p.mode} {...p} />)}
        </div>
      </div>

      {/* DESIGN PRINCIPLES */}
      {Array.isArray(harness?.design) && harness.design.length ? (
        <div style={CARD}>
          <div style={SEC}>Design principles</div>
          {harness?.summary ? <p style={{ fontSize: 12.5, color: "#555", lineHeight: 1.6, margin: "0 0 10px" }}>{harness.summary}</p> : null}
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {harness.design.map((d: string, i: number) => (
              <li key={i} style={{ fontSize: 12, color: "#555", lineHeight: 1.55 }}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* THE JUDGE — its own clear section */}
      {sc ? (
        <div style={{ ...CARD, borderLeft: "3px solid #a16207" }}>
          <div style={{ ...SEC, color: "#a16207" }}>The judge · ground-truth scoring</div>
          {sc.judge ? <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.55, marginBottom: 8 }}>{sc.judge}</div> : null}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 11.5, lineHeight: 1.5 }}>
            {sc.deterministic != null && (<><span style={{ fontWeight: 700, color: "#9a948c" }}>deterministic</span><span style={{ color: "#555" }}>{sc.deterministic ? "yes" : "no — a reasoning model; verdicts can vary slightly across identical re-scores"}</span></>)}
            {sc.observedVariance && (<><span style={{ fontWeight: 700, color: "#9a948c" }}>observed variance</span><span style={{ color: "#555" }}>{sc.observedVariance}</span></>)}
            {sc.comparisonRule && (<><span style={{ fontWeight: 700, color: "#9a948c" }}>comparison rule</span><span style={{ color: "#555" }}>{sc.comparisonRule}</span></>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Step({ n, label, sub, color }: { n: string; label: string; sub: string; color: string }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 120, background: "#fff", border: `1px solid ${color}55`, borderRadius: 10, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, color }}>{n}</span>
        <span style={{ fontWeight: 800, fontSize: 12.5, color: "#2b2b2b" }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, color: "#7a746c", lineHeight: 1.3 }}>{sub}</span>
    </div>
  );
}

function Arrow() {
  return <div style={{ display: "flex", alignItems: "center", color: "#c4bdb1", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>→</div>;
}
