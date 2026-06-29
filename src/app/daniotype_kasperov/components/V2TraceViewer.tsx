"use client";

// v2.0 harness — multi-level run trace viewer, walkable in judgement mode. Surfaced inside
// the wizard when the v2.0 harness is selected (no standalone route). Renders the trace the
// v2 orchestrator (backend/v2_harness) produces, bundled here at build time.
import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdFor } from "./ChatMessage";
import { THEME } from "../theme";
import type { AgentMode } from "../types";
import TRACE from "./v2_trace.json";

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
const chip = (text: string, bg: string, fg: string) => <span key={text} style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 99, padding: "2px 9px", marginRight: 6, marginBottom: 6, display: "inline-block" }}>{text}</span>;
function CallBadge({ call }: { call: any }) {
  if (call?.rehomed) return <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: PURPLE, borderRadius: 99, padding: "2px 9px" }}>↗ re-home → {call.rehomedTo ?? call.identity}</span>;
  const ok = call?.decision === "assign";
  return <span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#15803d" : "#b45309", background: ok ? "#dcfce7" : "#fef3c7", borderRadius: 99, padding: "2px 9px" }}>{ok ? "✓ assign" : "⊘ " + (call?.decision || "—")} · {call?.identity ?? "?"}</span>;
}

export function V2TraceViewer({ onBack }: { onBack: () => void }) {
  const t: any = TRACE;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [judge, setJudge] = useState(true);
  const nNotes = useMemo(() => Object.values(notes).filter((v) => v.trim()).length, [notes]);
  const copyNotes = () => navigator.clipboard?.writeText(JSON.stringify({ harness: "v2.0", judgements: Object.entries(notes).filter(([, v]) => v.trim()).map(([k, v]) => ({ step: k, note: v.trim() })) }, null, 2)).catch(() => {});

  const StepNote = ({ k, hint }: { k: string; hint: string }) => judge ? (
    <textarea value={notes[k] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))} placeholder={hint}
      style={{ width: "100%", boxSizing: "border-box", minHeight: 54, marginTop: 8, border: `1px solid ${notes[k]?.trim() ? PURPLE : "#e5e1dc"}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }} />
  ) : null;

  const Turns = ({ baseKey, turns }: { baseKey: string; turns: any[] }) => (
    <>{(turns ?? []).map((tt, i) => {
      const meta = THEME[tt.mode as AgentMode] ?? { name: tt.mode, icon: "•", color: "#666" } as any;
      return (
        <Collapsible key={i} accent={meta.color} title={<span style={{ color: meta.color }}>{meta.icon} {meta.name}</span>} badge={`step ${i}`}>
          <div style={{ fontSize: 11, color: "#9a938a", marginBottom: 6, fontStyle: "italic", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>prompt: {tt.prompt}</div>
          <RichMD mode={(tt.mode as AgentMode) ?? "reason"}>{stripFences(tt.text)}</RichMD>
          <StepNote k={`${baseKey}/t${i}`} hint={`Judge the ${meta.name} step…`} />
        </Collapsible>
      );
    })}</>
  );

  const ClusterCard = ({ kind, id, sub, markers, call, turns, framingNote, escape }: any) => (
    <div style={{ border: `1px solid ${escape ? PURPLE + "66" : "#e2ded8"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12, background: escape ? "rgba(124,58,237,0.04)" : "#fffdfb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>{kind} {id}</span>
        {sub ? <span style={{ fontSize: 11, color: "#9a938a" }}>{sub}</span> : null}
        <span style={{ marginLeft: "auto" }}><CallBadge call={call} /></span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "#6a635a" }}><b>markers:</b> {(markers ?? []).join(", ")}</div>
      {framingNote ? <div style={{ marginTop: 6, fontSize: 11.5, color: PURPLE, background: "rgba(124,58,237,0.06)", borderRadius: 6, padding: "6px 9px", lineHeight: 1.5 }}>{framingNote}</div> : null}
      <div style={{ marginTop: 8 }}><Turns baseKey={`${kind}:${id}`} turns={turns} /></div>
      <StepNote k={`${kind}:${id}/call`} hint="Judge the overall call for this cluster…" />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "22px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <button onClick={onBack} style={btn}>← harness menu</button>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: PURPLE, marginTop: 10 }}>Harness v2.0 · multi-level run</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 2px" }}>Multi-level top-down expectation-guided recursion</h1>
            <div style={{ fontSize: 12.5, color: "#6a635a", lineHeight: 1.5 }}>{t.meta?.note}</div>
            <div style={{ fontSize: 11.5, color: "#9a938a", marginTop: 4 }}>{t.meta?.dataset} · {t.meta?.model} · L0 {t.level0_coarse?.length ?? 0} · descended {(t.descents ?? []).length} · skipped {(t.skipped ?? []).length} · escapes {(t.descents ?? []).reduce((n: number, d: any) => n + (d.escapes?.length ?? 0), 0)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#6a635a", display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} /> judgement</label>
            <button onClick={copyNotes} style={btn}>⚖️ copy notes ({nNotes})</button>
          </div>
        </div>

        <Section n="" title="Expected-tissue checklist (ZSCAPE 48 hpf)">
          <div>{(t.expectedTissues ?? []).map((x: string) => chip(x, "#eef2ff", "#3730a3"))}</div>
        </Section>

        <Section n="L0" title="Coarse pass + tissue-level checklist">
          {(t.level0_coarse ?? []).map((c: any) => (
            <ClusterCard key={c.compartmentId} kind="compartment" id={c.compartmentId} sub={`n=${c.nCells} · ${c.nLeaves} leaves · matched→ ${c.matchedTissue ?? "(none)"}${c.confident ? "" : " · NOT confident"}`} markers={c.markers} call={c.call} turns={c.turns} />
          ))}
          {t.tissueGap ? (
            <div style={{ border: "1px solid #e2ded8", borderRadius: 10, padding: "10px 12px", background: "#fffdfb" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>tissues found</div>
              <div>{(t.tissueGap.found ?? []).map((f: any) => chip(`${f.tissue} ← ${f.comps.join("/")}`, "#dcfce7", "#15803d"))}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309", margin: "10px 0 4px" }}>still unfound (candidates to hunt on descent)</div>
              <div>{(t.tissueGap.unfound ?? []).map((x: string) => chip(x, "#fef3c7", "#b45309"))}</div>
              <StepNote k="tissueGap" hint="Judge the tissue-level gap…" />
            </div>
          ) : null}
        </Section>

        <Section n="L1" title="Gated descent — cell-type checklist + top-down + escape hatch">
          {(t.descents ?? []).map((d: any) => (
            <div key={d.compartmentId} style={{ border: `1px solid ${PURPLE}33`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, background: "rgba(124,58,237,0.025)" }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>↳ descended {d.compartmentId} · umbrella <span style={{ color: PURPLE }}>“{d.umbrella}”</span></div>
              <div style={{ fontSize: 11.5, color: "#6a635a", marginTop: 4 }}><b>GATE passed because:</b></div>
              <ul style={{ margin: "3px 0 6px 16px", padding: 0, fontSize: 11.5, color: "#6a635a", lineHeight: 1.5 }}>{(d.descendReasons ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
              {d.cellTypeChecklist ? (
                <div style={{ fontSize: 11.5, color: "#6a635a", marginBottom: 4 }}>
                  cell-type checklist for <b>{d.cellTypeChecklist.tissue}</b> — attempt: {(d.cellTypeChecklist.easy ?? []).map((x: string) => chip(x, "#dcfce7", "#15803d"))} · hard (abstain ok): {(d.cellTypeChecklist.hard ?? []).map((x: string) => chip(x, "#fef3c7", "#b45309"))}
                </div>
              ) : null}
              {(d.huntUnfound ?? []).length ? <div style={{ fontSize: 11.5, color: "#b45309", marginBottom: 6 }}>also hunting hidden: {d.huntUnfound.join(", ")}</div> : null}
              <div style={{ marginTop: 8 }}>
                {(d.leaves ?? []).map((lf: any) => (
                  <ClusterCard key={lf.leafId} kind="leaf" id={lf.leafId} sub={`n=${lf.nCells}${lf.matchedCellType ? " · CT→ " + lf.matchedCellType : ""}`} markers={lf.markers} call={lf.call} turns={lf.turns} escape={lf.call?.rehomed}
                    framingNote={`top-down: “confirmed ${d.umbrella} (labeller's own prior, not GT) — which subtype?” + cell-type checklist + escape hatch`} />
                ))}
              </div>
              {d.cellTypeGap ? (
                <div style={{ fontSize: 11.5, color: "#6a635a", marginTop: 4 }}>
                  <b>cell-type gap:</b> found {(d.cellTypeGap.found ?? []).join(", ") || "—"} · still missing {(d.cellTypeGap.stillMissing ?? []).join(", ") || "none"}
                  <StepNote k={`descent:${d.compartmentId}/gap`} hint="Judge the cell-type checklist outcome + any escape-hatch re-homes…" />
                </div>
              ) : null}
            </div>
          ))}
          {(t.skipped ?? []).map((s: any) => (
            <div key={s.compartmentId} style={{ border: "1px dashed #d8d3cd", borderRadius: 10, padding: "10px 12px", marginBottom: 8, background: "#faf8f6" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#9a938a" }}>⊘ skipped {s.compartmentId}</span> <span style={{ fontSize: 11.5, color: "#6a635a" }}>“{s.umbrella}” — {s.reason}</span>
              <StepNote k={`skip:${s.compartmentId}`} hint="Judge this gate decision (targeted-deep, not exhaustive)…" />
            </div>
          ))}
        </Section>
        <div style={{ height: 50 }} />
      </div>
    </div>
  );
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
