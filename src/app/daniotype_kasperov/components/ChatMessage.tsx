"use client";
// ChatMessage — the per-personality chat bubble (the "cluster-chat thread" unit)
// plus its markdown renderers and reasoning-trace dropdown. Extracted verbatim
// from KasperovClient.tsx; presentational, props-only. Shared by the live wizard
// and the Phase 2 read-only run viewer.
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentMode, SourceKey } from "../types";
import { ACCENT, INK, THEME } from "../theme";

function classifyHref(href: string): SourceKey | null {
  const h = href.toLowerCase();
  if (h.includes("zfin.org")) return "ZFIN";
  if (h.includes("/zfa") || (h.includes("ols") && h.includes("zfa"))) return "ZFA";
  if (h.includes("quickgo") || h.includes("geneontology") || h.includes("amigo")) return "GO";
  if (h.includes("uniprot")) return "UniProt";
  if (h.includes("ncbi.nlm.nih.gov")) return "NCBI";
  if (h.includes("ebi.ac.uk")) return "ZFA"; // OLS default → anatomy
  return null;
}
// pull the first href + any leading **SOURCE** token from a hast li node
function liSource(node: any): SourceKey | null {
  let href: string | null = null;
  const walk = (n: any) => {
    if (!n || href) return;
    if (n.tagName === "a" && n.properties?.href) href = String(n.properties.href);
    (n.children ?? []).forEach(walk);
  };
  (node?.children ?? []).forEach(walk);
  if (href) {
    const k = classifyHref(href);
    if (k) return k;
  }
  // fall back to a leading bold source word
  const txt = JSON.stringify(node ?? {});
  const m = txt.match(/\b(ZFIN|ZFA|GO|NCBI|UniProt)\b/);
  return (m?.[1] as SourceKey) ?? null;
}

const mdH: React.CSSProperties = { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, color: ACCENT, margin: "12px 0 6px", paddingTop: 8, borderTop: "1px solid #f0ece7" };
const baseMD = {
  h1: (p: any) => <div style={mdH}>{p.children}</div>,
  h2: (p: any) => <div style={mdH}>{p.children}</div>,
  h3: (p: any) => <div style={mdH}>{p.children}</div>,
  p: (p: any) => <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{p.children}</p>,
  ul: (p: any) => <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>{p.children}</ul>,
  ol: (p: any) => <ol style={{ margin: "0 0 8px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>{p.children}</ol>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#1f2937" }}>{p.children}</strong>,
  a: (p: any) => (
    <a href={p.href} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2 }}>{p.children}</a>
  ),
  blockquote: (p: any) => (
    <blockquote style={{ margin: "0 0 8px", padding: "4px 10px", borderLeft: `3px solid #e5e1dc`, color: "#777", background: "#faf8f6" }}>{p.children}</blockquote>
  ),
  code: (p: any) => <code style={{ background: "#f0eeec", padding: "1px 5px", borderRadius: 4, fontSize: 12.5 }}>{p.children}</code>,
  table: (p: any) => (
    <div style={{ border: "1px solid #d8d3cd", borderRadius: 8, overflow: "hidden", margin: "0 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{p.children}</table>
    </div>
  ),
  th: (p: any) => <th style={{ textAlign: "left", padding: "5px 8px", background: "#f3f0ec", borderBottom: "1px solid #e5e1dc", fontWeight: 700, color: "#555" }}>{p.children}</th>,
  td: (p: any) => <td style={{ padding: "5px 8px", borderBottom: "1px solid #f3f0ec" }}>{p.children}</td>,
};
// Markdown components for a personality. Every colour in an agent message is the
// PERSONALITY colour (headings, links, evidence); plain text stays neutral.
export function mdFor(mode: AgentMode) {
  const th = THEME[mode];
  const heading = (p: any) => <div style={{ ...mdH, color: th.color }}>{p.children}</div>;
  const base: any = {
    ...baseMD,
    h1: heading,
    h2: heading,
    h3: heading,
    a: (p: any) => (
      <a href={p.href} target="_blank" rel="noreferrer" style={{ color: th.color, textDecoration: "underline", textUnderlineOffset: 2 }}>
        {p.children}
      </a>
    ),
  };
  if (mode !== "research") return base; // archivist tables / reasoner prose render plain
  return {
    ...base,
    // each evidence item: a small source chip + plain text — no boxed section
    li: (p: any) => {
      const src = liSource(p.node);
      if (!src) return <li style={{ lineHeight: 1.45, listStyle: "disc", marginLeft: 18 }}>{p.children}</li>;
      return (
        <li style={{ listStyle: "none", display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.45, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: th.color, border: `1px solid ${th.color}55`, borderRadius: 4, padding: "0 4px", marginTop: 2, whiteSpace: "nowrap" }}>{src}</span>
          <span>{p.children}</span>
        </li>
      );
    },
  };
}

// Reasoning-trace dropdown shown in the CENTER chat. While the model is
// thinking (`collapsed=false`) it stays open and grows as the trace streams in;
// once the settled answer starts (`collapsed=true`) it compresses to a single
// line (with a teaser of the last thought) — re-expandable by clicking.
export function ThinkingTrace({ thinking, mode, collapsed }: { thinking: string; mode: AgentMode; collapsed: boolean }) {
  const th = THEME[mode] ?? THEME.reason;
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? !collapsed;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thinking, open]);
  const lastLine = thinking.replace(/\s+/g, " ").trim().slice(-140);
  return (
    <div style={{ marginBottom: 10, border: `1px solid ${th.color}33`, borderRadius: 8, background: th.bg, overflow: "hidden" }}>
      <button
        onClick={() => setOverride(!open)}
        style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "7px 10px", fontSize: 11, color: th.color, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span style={{ flexShrink: 0 }}>{th.icon} {th.trace}</span>
        {!open && lastLine && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>· {lastLine}</span>}
      </button>
      {open && (
        <div ref={bodyRef} style={{ maxHeight: 220, overflowY: "auto", padding: "0 10px 8px", fontSize: 11.5, color: "#888", lineHeight: 1.45 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={traceMD}>{thinking}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// Compact, grey, markdown-rendered reasoning trace.
const traceMD = {
  p: (p: any) => <p style={{ margin: "0 0 5px", lineHeight: 1.45 }}>{p.children}</p>,
  h1: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h2: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h3: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#555" }}>{p.children}</strong>,
  ul: (p: any) => <ul style={{ margin: "0 0 5px", paddingLeft: 16 }}>{p.children}</ul>,
  li: (p: any) => <li style={{ marginBottom: 2 }}>{p.children}</li>,
  a: (p: any) => <a href={p.href} target="_blank" rel="noreferrer" style={{ color: "#888" }}>{p.children}</a>,
  code: (p: any) => <code style={{ background: "#eee", padding: "0 3px", borderRadius: 3 }}>{p.children}</code>,
};

export function AgentMessage({ content, mode = "research", actions, thinking, thinkingCollapsed = true, pending = false }: { content: string; mode?: AgentMode; actions?: React.ReactNode; thinking?: string; thinkingCollapsed?: boolean; pending?: boolean }) {
  const m = content.match(/\*\*Verdict:\*\*\s*(.+)$/im);
  const verdict = m ? m[1].trim() : null;
  const body = (m ? content.slice(0, m.index) : content).trim();
  // confidence level is shown greyscale — colour encodes personality only
  const confLabel = verdict ? (/high/i.test(verdict) ? "high" : /med/i.test(verdict) ? "medium" : /low/i.test(verdict) ? "low" : null) : null;
  const verdictName = verdict ? verdict.replace(/—?\s*confidence\s+\w+\.?$/i, "").trim() : "";
  const th = THEME[mode];
  const badge = { color: th.color };
  const isArchivist = mode === "archivist";
  return (
    <div
      style={{
        fontSize: 13.5,
        color: INK,
        // every personality's response sits in its own colour-bordered section
        border: `1px solid ${badge.color}33`,
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 8,
        background: "#fffdfb",
        padding: "8px 10px",
      }}
    >
      {/* the personality's reasoning trace (e.g. RESEARCH LOG) lives INSIDE its
          own bubble, at the top — collapsed to one line once the answer is here */}
      {thinking && <ThinkingTrace thinking={thinking} mode={mode} collapsed={thinkingCollapsed} />}
      {isArchivist && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontStyle: "italic" }}>
          Values under “Raw facts” are read directly from the dataset; anything under “Read” is the model&apos;s inference.
        </div>
      )}
      {body ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode)}>
          {body}
        </ReactMarkdown>
      ) : pending ? (
        <div style={{ fontSize: 12.5, color: "#999", fontStyle: "italic" }}>{th.icon} drafting the answer…</div>
      ) : null}
      {verdict && (
        <div style={{ marginTop: 8, border: `1px solid ${badge.color}`, borderLeft: `3px solid ${badge.color}`, borderRadius: 10, background: "#fffdfb", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: badge.color, fontWeight: 700 }}>Verdict</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b", flex: 1 }}>{verdictName || verdict}</span>
            {confLabel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", background: "#ece8e3", padding: "2px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {confLabel}
              </span>
            )}
          </div>
        </div>
      )}
      {actions && <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div>}
    </div>
  );
}
