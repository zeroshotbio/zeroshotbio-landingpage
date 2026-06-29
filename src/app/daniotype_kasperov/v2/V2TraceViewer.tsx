"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdFor } from "../components/ChatMessage";
import { THEME } from "../theme";
import type { AgentMode } from "../types";

// ── tiny shared bits ────────────────────────────────────────────────────────────
const PAPER = "#fbf9f6", INK = "#2b2620", PURPLE = "#7c3aed";
const stripFences = (s: string) => (s || "").replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim();
function RichMD({ children, mode = "reason" }: { children: string; mode?: AgentMode }) {
  return <div style={{ fontSize: 12.5, color: "#3f3a33", lineHeight: 1.55 }}><ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode) as any}>{children || "_(empty)_"}</ReactMarkdown></div>;
}
function Collapsible({ title, badge, accent = "#8a847b", defaultOpen = false, children }: { title: React.ReactNode; badge?: React.ReactNode; accent?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e8e3dd", borderRadius: 10, marginBottom: 8, overflow: "hidden", background: "#fff" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: open ? "#faf8f6" : "#fff", border: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}>
        <span style={{ fontSize: 10, color: accent, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform .15s" }}>▶</span>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#2a2620" }}>{title}</span>
        {badge != null ? <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#9a938a" }}>{badge}</span> : null}
      </button>
      {open ? <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #f0ece7" }}>{children}</div> : null}
    </div>
  );
}
const callBadge = (call: any) => {
  const ok = call?.decision === "assign";
  return <span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#15803d" : "#b45309", background: ok ? "#dcfce7" : "#fef3c7", borderRadius: 99, padding: "2px 9px" }}>{ok ? "✓ assign" : "⊘ " + (call?.decision || "—")} · {call?.identity ?? "?"}{call?.confidence != null ? ` · ${call.confidence}` : ""}</span>;
};
const chip = (text: string, bg: string, fg: string) => <span style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 99, padding: "2px 9px", marginRight: 6, marginBottom: 6, display: "inline-block" }}>{text}</span>;

// ── viewer ──────────────────────────────────────────────────────────────────────
export default function V2TraceViewer() {
  const [trace, setTrace] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [judge, setJudge] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/daniotype_kasperov/v2/trace", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || d?.error || ("HTTP " + r.status));
      setTrace(d);
    } catch (e: any) { setErr(String(e?.message ?? e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setNote = (k: string, v: string) => setNotes((n) => ({ ...n, [k]: v }));
  const nNotes = useMemo(() => Object.values(notes).filter((v) => v.trim()).length, [notes]);
  const copyNotes = () => {
    const out = Object.entries(notes).filter(([, v]) => v.trim()).map(([k, v]) => ({ step: k, note: v.trim() }));
    navigator.clipboard?.writeText(JSON.stringify({ harness: "v2.0", judgements: out }, null, 2)).catch(() => {});
  };

  function StepNote({ k, hint }: { k: string; hint: string }) {
    if (!judge) return null;
    return <textarea value={notes[k] ?? ""} onChange={(e) => setNote(k, e.target.value)} placeholder={hint} style={{ width: "100%", boxSizing: "border-box", minHeight: 56, marginTop: 8, border: `1px solid ${notes[k]?.trim() ? PURPLE : "#e5e1dc"}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />;
  }

  function Turns({ baseKey, turns }: { baseKey: string; turns: any[] }) {
    return (
      <>
        {turns.map((t, i) => {
          const meta = THEME[t.mode as AgentMode] ?? { name: t.mode, icon: "•", color: "#666" };
          return (
            <Collapsible key={i} accent={meta.color} title={<span><span style={{ color: meta.color }}>{meta.icon} {meta.name}</span></span>} badge={`step ${i}`}>
              <div style={{ fontSize: 11, color: "#9a938a", marginBottom: 6, fontStyle: "italic", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>prompt: {t.prompt}</div>
              <RichMD mode={(t.mode as AgentMode) ?? "reason"}>{stripFences(t.text)}</RichMD>
              <StepNote k={`${baseKey}/turn${i}`} hint={`Judge what the ${meta.name} did here…`} />
            </Collapsible>
          );
        })}
      </>
    );
  }

  function ClusterCard({ kind, id, sub, markers, call, turns, framingNote }: { kind: string; id: string; sub?: string; markers: string[]; call: any; turns: any[]; framingNote?: string }) {
    return (
      <div style={{ border: "1px solid #e2ded8", borderRadius: 12, padding: "12px 14px", marginBottom: 12, background: "#fffdfb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: INK }}>{kind} {id}</span>
          {sub ? <span style={{ fontSize: 11, color: "#9a938a" }}>{sub}</span> : null}
          <span style={{ marginLeft: "auto" }}>{callBadge(call)}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11.5, color: "#6a635a" }}><b>markers:</b> {markers.join(", ")}</div>
        {framingNote ? <div style={{ marginTop: 6, fontSize: 11.5, color: PURPLE, background: "rgba(124,58,237,0.06)", borderRadius: 6, padding: "6px 9px", lineHeight: 1.5 }}>{framingNote}</div> : null}
        <div style={{ marginTop: 8 }}><Turns baseKey={`${kind}:${id}`} turns={turns} /></div>
        <StepNote k={`${kind}:${id}/call`} hint="Judge the overall call for this cluster…" />
      </div>
    );
  }

  if (loading) return <Shell><div style={{ color: "#9a938a" }}>Loading trace…</div></Shell>;
  if (err) return <Shell><div style={{ color: "#8a5a00", background: "#fff7e6", border: "1px solid #f0dca8", borderRadius: 8, padding: "12px 14px" }}>Trace not available yet: {err}<div style={{ marginTop: 8 }}><button onClick={load} style={btn}>↻ Retry</button></div><div style={{ marginTop: 8, fontSize: 12, color: "#9a938a" }}>The orchestrator writes incrementally — if a run is in progress, retry shortly.</div></div></Shell>;

  const t = trace;
  return (
    <Shell>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: PURPLE }}>v2.0 harness · staging trace</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 2px" }}>Top-down expectation-guided recursion</h1>
          <div style={{ fontSize: 12.5, color: "#6a635a", lineHeight: 1.5 }}>{t.meta?.note}</div>
          <div style={{ fontSize: 11.5, color: "#9a938a", marginTop: 4 }}>{t.meta?.dataset} · {t.meta?.model} · coarse {t.coarse?.length ?? 0} · recursion {(t.recursion ?? []).reduce((s: number, r: any) => s + (r.leaves?.length ?? 0), 0)} leaves</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "#6a635a", display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} /> judgement mode</label>
          <button onClick={copyNotes} style={btn}>⚖️ copy notes ({nNotes})</button>
          <button onClick={load} style={btn}>↻ refresh</button>
        </div>
      </div>

      {/* expected checklist */}
      <Section n="" title="Expected-tissue checklist (ZSCAPE 48 hpf)">
        <div>{(t.expectedTissues ?? []).map((x: string) => chip(x, "#eef2ff", "#3730a3"))}</div>
        <div style={{ fontSize: 11.5, color: "#9a938a", marginTop: 4 }}>Hand-authored from the experiential bank. The gap check below compares these against what the coarse pass actually named.</div>
      </Section>

      {/* coarse */}
      <Section n="1" title="Coarse-first labelling">
        {(t.coarse ?? []).map((c: any) => (
          <ClusterCard key={c.compartmentId} kind="compartment" id={c.compartmentId} sub={`n=${c.nCells} · ${c.nLeaves} leaves · matched→ ${c.matchedTissue ?? "(none)"}`} markers={c.markers} call={c.call} turns={c.turns} />
        ))}
        {!(t.coarse ?? []).length ? <div style={{ color: "#9a938a", fontSize: 12 }}>No coarse calls yet — run in progress?</div> : null}
      </Section>

      {/* gap */}
      {t.gap ? (
        <Section n="2" title="Expected-tissue gap check">
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>Found</div>
          <div>{(t.gap.found ?? []).map((f: any) => chip(`${f.tissue} ← ${f.comps.join("/")}`, "#dcfce7", "#15803d"))}{!(t.gap.found ?? []).length ? <span style={{ color: "#9a938a", fontSize: 12 }}>none</span> : null}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309", margin: "10px 0 4px" }}>Unfound → candidates for selective recursion</div>
          <div>{(t.gap.unfound ?? []).map((x: string) => chip(x, "#fef3c7", "#b45309"))}</div>
          <StepNote k="gap" hint="Judge the gap check — right tissues expected? right found/unfound split?" />
        </Section>
      ) : null}

      {/* routing */}
      {(t.routing ?? []).length ? (
        <Section n="3" title="Selective recursion routing (GT-blind — keyed off the coarse calls)">
          {(t.routing ?? []).map((r: any, i: number) => (
            <div key={i} style={{ border: "1px solid #e2ded8", borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#fffdfb" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "#b45309" }}>{r.tissue}</span>
                <span style={{ fontSize: 12, color: "#6a635a" }}>→ recurse into</span>
                {(r.chosen ?? []).map((c: string) => chip(c, "#ede9fe", PURPLE))}
              </div>
              <div style={{ fontSize: 11.5, color: "#6a635a", marginTop: 5, lineHeight: 1.5 }}><b>rationale:</b> {r.rationale}</div>
              <div style={{ fontSize: 11.5, color: "#9a938a", marginTop: 3 }}><b>experiential hints:</b> {(r.hints ?? []).join(", ")} · <b>look for:</b> {r.lookFor}</div>
              <StepNote k={`routing:${r.tissue}`} hint="Judge this routing decision…" />
            </div>
          ))}
        </Section>
      ) : null}

      {/* recursion */}
      {(t.recursion ?? []).length ? (
        <Section n="4" title="Selective recursion — sub-leaf labelling with top-down context">
          {(t.recursion ?? []).map((rec: any) => (
            <div key={rec.compartmentId} style={{ border: `1px solid ${PURPLE}33`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, background: "rgba(124,58,237,0.025)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>↳ {rec.compartmentId} · confirmed umbrella: <span style={{ color: PURPLE }}>“{rec.umbrella}”</span></div>
              <div style={{ fontSize: 11.5, color: "#6a635a", marginTop: 3 }}>hunting {(rec.targetedFor ?? []).join(", ")} · top-down prior + experiential hints injected into each leaf prompt</div>
              <div style={{ marginTop: 10 }}>
                {(rec.leaves ?? []).map((lf: any) => (
                  <ClusterCard key={lf.leafId} kind="leaf" id={lf.leafId} sub={`n=${lf.nCells} · matched→ ${lf.matchedTissue ?? "(none)"}`} markers={lf.markers} call={lf.call} turns={lf.turns} framingNote={`top-down: “this is confirmed ${rec.umbrella} (the labeller's own prior, not GT) — which subtype?”`} />
                ))}
                {!(rec.leaves ?? []).length ? <div style={{ color: "#9a938a", fontSize: 12 }}>leaves pending…</div> : null}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      <div style={{ height: 60 }} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "26px 22px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}><div style={{ maxWidth: 940, margin: "0 auto" }}>{children}</div></div>;
}
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 800, color: "#2b2b2b", margin: "0 0 10px", paddingBottom: 6, borderBottom: `2px solid ${PURPLE}33` }}>{n ? <span style={{ color: PURPLE }}>{n} · </span> : null}{title}</h2>
      {children}
    </section>
  );
}
const btn: React.CSSProperties = { background: "#fff", border: "1px solid #e2ded8", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#4a443c", cursor: "pointer" };
