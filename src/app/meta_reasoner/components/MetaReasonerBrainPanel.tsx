"use client";
// MetaReasonerBrainPanel — the Phase-2 takeover UI. Runs the boundary brain
// (/api/meta_reasoner) over the assembled GT-blind input, renders its reasoning +
// structured decision + guardrail state, and bubbles the result to the parent for
// logging. The parent owns the human "Continue / confirm" button (it controls the
// advance), so this component is a drop-in for BOTH the /meta_reasoner replay
// boundary AND the live-sweep MetaReasonerStub without touching control flow.
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BrainLedger, BrainDecision } from "../brain";

export type BrainResult = {
  ok: boolean;
  input: any;
  prompt?: { system: string; user: string };
  reasoning?: string;
  decision?: BrainDecision;
  guardrails?: { gtBlind: boolean; capApplied?: boolean; capNote?: string | null };
  usage?: any;
  error?: string;
  detail?: string;
};

const ACTION_STYLE: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  consolidate: { bg: "#dcfce7", fg: "#15803d", icon: "⤵", label: "consolidate" },
  descend: { bg: "#eef2ff", fg: "#4338ca", icon: "⤓", label: "descend" },
  not_found_accept: { bg: "#fff7ed", fg: "#9a3412", icon: "∅", label: "not_found_accept" },
};

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };

export function MetaReasonerBrainPanel({
  ledger,
  priorDescentAttempts,
  model,
  onResult,
}: {
  ledger: BrainLedger;
  priorDescentAttempts?: Record<string, number>;
  model?: string;
  onResult?: (r: BrainResult) => void;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "err">("idle");
  const [result, setResult] = useState<BrainResult | null>(null);

  async function run() {
    setState("running");
    try {
      const r = await fetch("/api/meta_reasoner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ledger, priorDescentAttempts: priorDescentAttempts ?? {}, model }),
      });
      const data: BrainResult = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      setResult(data);
      setState(data.ok ? "done" : "err");
      onResult?.(data);
    } catch (e: any) {
      const data: BrainResult = { ok: false, input: null, error: String(e?.message ?? e).slice(0, 160) };
      setResult(data);
      setState("err");
      onResult?.(data);
    }
  }

  const d = result?.decision;
  const as = d ? ACTION_STYLE[d.action] ?? ACTION_STYLE.not_found_accept : null;

  return (
    <div style={{ ...CARD, borderColor: "#e0d3f7", background: "#fdfbff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5 }}>🧠 Meta-Reasoner brain · Phase 2</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, padding: "1px 8px" }}>🔒 GT-blind</span>
        {state === "idle" && (
          <button onClick={run} style={{ marginLeft: "auto", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Run meta-reasoner ▶</button>
        )}
        {state === "running" && <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#7c3aed", fontStyle: "italic" }}>reasoning over the ledger…</span>}
        {(state === "done" || state === "err") && (
          <button onClick={run} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #d8cdE9", color: "#7c3aed", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ re-run</button>
        )}
      </div>

      {state === "err" && result && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: result.error === "no_openai_key" ? "#9a3412" : "#b91c1c", lineHeight: 1.5 }}>
          {result.error === "no_openai_key"
            ? "No OPENAI_API_KEY on this environment — the brain didn't run, but the GT-blind input + prompt below are exactly what it would receive."
            : `Brain error: ${result.error}${result.detail ? ` — ${result.detail}` : ""}`}
        </div>
      )}

      {/* the decision */}
      {d && as && (
        <div style={{ marginTop: 12, border: `1px solid ${as.fg}44`, borderLeft: `3px solid ${as.fg}`, borderRadius: 10, background: "#fff", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: as.fg, background: as.bg, borderRadius: 99, padding: "3px 12px" }}>{as.icon} {as.label}</span>
            {d.target ? <span style={{ fontSize: 13.5, fontWeight: 700, color: "#333" }}>{d.target}</span> : null}
            {result?.guardrails?.capApplied ? (
              <span title={result.guardrails.capNote ?? ""} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 8px" }}>⛔ cap applied → not_found_accept</span>
            ) : null}
          </div>
          {d.rationale ? <div style={{ fontSize: 13, color: "#444", marginTop: 8, lineHeight: 1.5 }}>{d.rationale}</div> : null}
          {d.expected_still_missing?.length ? (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9a948c", textTransform: "uppercase", letterSpacing: 0.4 }}>still missing:</span>
              {d.expected_still_missing.map((t, i) => (
                <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 9px" }}>{t}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* the reasoning prose */}
      {result?.reasoning ? (
        <details open style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", cursor: "pointer" }}>reasoning</summary>
          <div style={{ fontSize: 13, color: "#3a352f", lineHeight: 1.55, marginTop: 6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.reasoning}</ReactMarkdown>
          </div>
        </details>
      ) : null}

      {/* transparency: the EXACT GT-blind object sent to the brain */}
      {result?.input ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11.5, fontWeight: 700, color: "#9a948c", cursor: "pointer" }}>exact input sent to the brain (GT-blind)</summary>
          <pre style={{ fontSize: 11, background: "#f7f5f2", border: "1px solid #e5e1dc", borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 320, marginTop: 6 }}>
            {JSON.stringify(result.input, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
