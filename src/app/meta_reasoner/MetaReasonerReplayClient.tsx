"use client";
// MetaReasonerReplayClient — a fork of the daniotype_kasperov chat + judgement
// interface that REPLAYS a previously-run headless run instead of calling any LLM.
// You step through each cluster's recorded chat steps (Researcher → Reasoner →
// menu-binning) and pause at each compartment boundary, dropping a judgement note
// at any step. Notes persist through the same /api/kasperov_runs → EBS path the
// live wizard uses, so they land in "Load Previous Run" with the ⚖️ badge.
//
// Source data: a static replay asset built by scripts/build_meta_reasoner_replay.py
// (nginx-served alongside the other daniotype_data assets). No streaming, no tools.
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMode } from "../daniotype_kasperov/types";
import { PAPER, INK, ACCENT, THEME, btnGhost, btnPrimary } from "../daniotype_kasperov/theme";
import { AgentMessage } from "../daniotype_kasperov/components/ChatMessage";
import { META_REASONER_CONTEXT } from "./metaReasonerContext";

const ASSET_BASE = "https://zscape.zeroshot.bio/daniotype_data";
const REPLAY_URL = `${ASSET_BASE}/meta_reasoner_replay/trimmed_37.json`;

// ---- shapes of the replay asset ----
type ReplayStep = {
  step: string; title: string; mode: AgentMode; menuExposed?: boolean;
  request: string; response: string; thinking: string; statuses: string[];
  elapsed_s?: number; usage?: any; cost_usd?: number;
};
type ReplayLeaf = {
  id: string; label: string; compartmentIndex: number; nCells?: number;
  finalLabel?: string; concluded?: boolean; did_archivist?: boolean;
  n_reason_rounds?: number; cost_usd?: number; elapsed_s?: number; steps: ReplayStep[];
};
type Boundary = {
  at_boundary_after_compartmentIndex: number; next_compartmentIndex: number | null;
  per_compartment: Record<string, { total: number; labelled: number; abstained: number }>;
  leaves_labelled: number; leaves_abstained: number; cost_so_far_usd: number; calls_so_far: number; ts?: string;
};
type ReplayAsset = {
  schema: string; source?: string; dataset: string; datasetId: string; model: string;
  started?: string; finished?: string; calls?: number; cost_usd?: number;
  compartments: { index: number; label: string; leafIds: string[] }[];
  boundaries: Boundary[]; leaves: ReplayLeaf[];
};

// judgement record — matches the live wizard's shape so RunViewer renders it.
type Judgement = {
  cluster_id: string; cluster_label: string; step_index: number;
  mode: string; content_excerpt: string; note: string; ts: string;
};

// flat, sweep-ordered navigation node
type Node =
  | { kind: "step"; leaf: ReplayLeaf; step: ReplayStep; stepIndex: number; withinComp: number; compIndex: number; key: string }
  | { kind: "boundary"; boundary: Boundary; compIndex: number; key: string };

// Strip the hidden ```kasperov-*``` control blocks so the transcript reads clean
// (mirrors RunViewer.stripControlBlocks).
function stripControlBlocks(s: string): string {
  return String(s || "")
    .replace(/```+\s*kasperov-\w+[\s\S]*?```+/g, "")
    .replace(/kasperov-\w+\s*(\[[\s\S]*?\]|\{[\s\S]*?\})/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 8px" };

// The recorded search trail for a Researcher step — collapsed by default.
function StatusTrail({ statuses }: { statuses: string[] }) {
  if (!statuses?.length) return null;
  return (
    <details style={{ marginBottom: 8 }}>
      <summary style={{ fontSize: 11.5, fontWeight: 700, color: THEME.research.color, cursor: "pointer" }}>
        🔎 search trail · {statuses.length} step{statuses.length === 1 ? "" : "s"}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
        {statuses.map((s, i) => (
          <div key={i} style={{ fontSize: 11.5, color: "#7a746c", fontFamily: "ui-monospace, monospace", lineHeight: 1.45 }}>· {s}</div>
        ))}
      </div>
    </details>
  );
}

// The judgement note box shown under every node.
function NoteBox({ value, onChange, saved }: { value: string; onChange: (v: string) => void; saved?: boolean }) {
  return (
    <div style={{ marginTop: 12, border: "1px solid #ece2fb", borderLeft: "3px solid #7c3aed", background: "#faf7ff", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        ⚖️ judgement note{saved ? <span style={{ color: "#15803d", marginLeft: 8 }}>· captured</span> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What did this step get right / wrong? What should the meta-reasoner do differently here?"
        rows={3}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e5e1dc", borderRadius: 6, padding: "8px 10px", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", background: "#fff" }}
      />
    </div>
  );
}

export default function MetaReasonerReplayClient() {
  const [asset, setAsset] = useState<ReplayAsset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "ok" | "err"; msg?: string }>({ status: "idle" });

  useEffect(() => {
    let alive = true;
    fetch(REPLAY_URL)
      .then((r) => { if (!r.ok) throw new Error(`asset ${r.status}`); return r.json(); })
      .then((d) => { if (alive) setAsset(d); })
      .catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, []);

  // leaf lookup + within-compartment index
  const leafById = useMemo(() => {
    const m = new Map<string, ReplayLeaf>();
    asset?.leaves.forEach((l) => m.set(l.id, l));
    return m;
  }, [asset]);

  // build the flat, sweep-ordered node list: each compartment's leaves (3 steps
  // each) followed by that compartment's boundary node, in compartmentIndex order.
  const nodes = useMemo<Node[]>(() => {
    if (!asset) return [];
    const out: Node[] = [];
    const boundaryByComp = new Map<number, Boundary>();
    asset.boundaries.forEach((b) => boundaryByComp.set(b.at_boundary_after_compartmentIndex, b));
    const comps = [...asset.compartments].sort((a, b) => a.index - b.index);
    for (const comp of comps) {
      comp.leafIds.forEach((lid, wi) => {
        const leaf = leafById.get(lid);
        if (!leaf) return;
        leaf.steps.forEach((step, si) => {
          out.push({ kind: "step", leaf, step, stepIndex: si, withinComp: wi + 1, compIndex: comp.index, key: `${lid}:${si}` });
        });
      });
      const b = boundaryByComp.get(comp.index);
      if (b) out.push({ kind: "boundary", boundary: b, compIndex: comp.index, key: `boundary:${comp.index}` });
    }
    return out;
  }, [asset, leafById]);

  const node = nodes[pos] ?? null;
  const nJudged = Object.values(notes).filter((v) => v.trim()).length;

  // keyboard: ← / → step through
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return; // don't hijack typing
      if (e.key === "ArrowRight") setPos((p) => Math.min(nodes.length - 1, p + 1));
      if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes.length]);

  // derive the persisted Judgement[] from the note map (self-contained excerpts).
  function buildJudgements(): Judgement[] {
    if (!asset) return [];
    const out: Judgement[] = [];
    const ts = new Date().toISOString();
    for (const n of nodes) {
      const note = (notes[n.key] || "").trim();
      if (!note) continue;
      if (n.kind === "step") {
        out.push({
          cluster_id: n.leaf.id,
          cluster_label: `Compartment ${n.compIndex} · Cluster ${n.withinComp} · ${n.leaf.label}`,
          step_index: n.stepIndex,
          mode: n.step.step, // e.g. "research#1" / "reason#r0" / "reason#binning"
          content_excerpt: stripControlBlocks(n.step.response).slice(0, 240),
          note, ts,
        });
      } else {
        const b = n.boundary;
        out.push({
          cluster_id: `boundary:${b.at_boundary_after_compartmentIndex}`,
          cluster_label: `Meta-Reasoner boundary · Compartment ${b.at_boundary_after_compartmentIndex}${b.next_compartmentIndex ? ` → ${b.next_compartmentIndex}` : " (end)"}`,
          step_index: 0,
          mode: "meta",
          content_excerpt: `ledger: ${b.leaves_labelled} leaves labelled, ${b.leaves_abstained} abstained, ${b.calls_so_far} calls, $${b.cost_so_far_usd?.toFixed?.(2) ?? b.cost_so_far_usd}`,
          note, ts,
        });
      }
    }
    return out;
  }

  // save into the SAME run store the live wizard uses → shows in Load Previous Run.
  async function logJudgements() {
    if (!asset) return;
    const judgements = buildJudgements();
    if (!judgements.length) { setSaveState({ status: "err", msg: "No notes to log yet." }); return; }
    const exportedAt = new Date().toISOString();
    const run = {
      datasetId: asset.datasetId || "zscape_recursive",
      dataset: asset.dataset,
      model: asset.model,
      exportedAt,
      note: `⚖️ Meta-Reasoner replay judgement — ${asset.source ?? "trimmed"} · ${judgements.length} note(s)`,
      source: "meta_reasoner_replay",
      replayOf: asset.schema,
      judgementMode: true,
      judgements,
      hasJudgement: true,
      // minimal clusters[] so /api/kasperov_runs accepts the run and RunViewer can list it
      clusters: asset.leaves.map((l) => ({ id: l.id, label: l.label, finalLabel: l.finalLabel, validated: false })),
    };
    setSaveState({ status: "saving" });
    try {
      const r = await fetch("/api/kasperov_runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(run) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.error) throw new Error(data?.error || `HTTP ${r.status}`);
      setSaveState({ status: "ok", msg: `Saved as run ${data.runId ?? "?"} — open it in daniotype_kasperov → Load Previous Run (⚖️).` });
    } catch (e: any) {
      setSaveState({ status: "err", msg: `Save failed: ${String(e?.message ?? e).slice(0, 160)}. Use “Download” to keep your notes.` });
    }
  }

  function downloadJudgements() {
    if (!asset) return;
    const payload = { schema: "daniotype_kasperov_judgements/v1", replayOf: asset.schema, dataset: asset.dataset, model: asset.model, exportedAt: new Date().toISOString(), judgements: buildJudgements() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meta_reasoner_judgements_${(asset.dataset || "run").replace(/[^\w]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (err) return <Shell><div style={{ ...CARD, color: "#b91c1c" }}>Failed to load the replay asset ({err}).<br />Expected at <code>{REPLAY_URL}</code>.</div></Shell>;
  if (!asset || !node) return <Shell><div style={{ ...CARD, color: "#888" }}>Loading replay…</div></Shell>;

  const atEnd = pos >= nodes.length - 1;

  return (
    <Shell>
      {/* header */}
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>🧠 Meta-Reasoner replay</span>
          <span style={{ fontSize: 12.5, color: "#666" }}>
            {asset.dataset} · {asset.model} · {asset.leaves.length} leaves · {asset.calls} calls · ~${Number(asset.cost_usd).toFixed(2)}
          </span>
          {nJudged ? <span style={{ fontSize: 10.5, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "1px 8px" }}>⚖️ {nJudged} note{nJudged === 1 ? "" : "s"}</span> : null}
        </div>
        <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 6, lineHeight: 1.5 }}>
          Replaying a completed headless run — no model is called. Step through each cluster&apos;s recorded chat and each compartment boundary; leave a judgement note anywhere. Notes save to the same store as the live wizard (⚖️ in Load Previous Run). Use <b>← / →</b> to move.
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* left rail: compartment → leaf jump list */}
        <div style={{ width: 210, flexShrink: 0, ...CARD, padding: 10, maxHeight: "76vh", overflow: "auto", position: "sticky", top: 12 }}>
          {[...asset.compartments].sort((a, b) => a.index - b.index).map((comp) => (
            <div key={comp.index} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Compartment {comp.index}</div>
              {comp.leafIds.map((lid, wi) => {
                const isCur = node.kind === "step" && node.leaf.id === lid;
                const firstIdx = nodes.findIndex((n) => n.kind === "step" && n.leaf.id === lid);
                const hasNote = leafById.get(lid)?.steps.some((_, si) => (notes[`${lid}:${si}`] || "").trim());
                return (
                  <div key={lid} onClick={() => firstIdx >= 0 && setPos(firstIdx)}
                    style={{ fontSize: 12, padding: "3px 7px", borderRadius: 6, cursor: "pointer", color: isCur ? "#fff" : "#555", background: isCur ? ACCENT : "transparent", fontWeight: isCur ? 700 : 500, display: "flex", justifyContent: "space-between", gap: 4 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>C{comp.index}·{wi + 1} {leafById.get(lid)?.label}</span>
                    {hasNote ? <span style={{ color: isCur ? "#fff" : "#7c3aed" }}>⚖️</span> : null}
                  </div>
                );
              })}
              {(() => {
                const bIdx = nodes.findIndex((n) => n.kind === "boundary" && n.compIndex === comp.index);
                if (bIdx < 0) return null;
                const isCur = node.kind === "boundary" && node.compIndex === comp.index;
                const hasNote = (notes[`boundary:${comp.index}`] || "").trim();
                return (
                  <div onClick={() => setPos(bIdx)} style={{ fontSize: 11.5, padding: "3px 7px", borderRadius: 6, cursor: "pointer", marginTop: 2, color: isCur ? "#fff" : "#7c3aed", background: isCur ? "#7c3aed" : "#faf7ff", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                    <span>🧠 boundary</span>{hasNote ? <span>⚖️</span> : null}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

        {/* main pane */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {node.kind === "step" ? (
            <StepView node={node} note={notes[node.key] || ""} onNote={(v) => setNotes((m) => ({ ...m, [node.key]: v }))} />
          ) : (
            <BoundaryView node={node} note={notes[node.key] || ""} onNote={(v) => setNotes((m) => ({ ...m, [node.key]: v }))} />
          )}

          {/* nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button onClick={() => setPos((p) => Math.max(0, p - 1))} disabled={pos === 0} style={{ ...btnGhost, opacity: pos === 0 ? 0.4 : 1 }}>← Prev</button>
            <span style={{ fontSize: 12, color: "#9a948c" }}>{pos + 1} / {nodes.length}</span>
            <button onClick={() => setPos((p) => Math.min(nodes.length - 1, p + 1))} disabled={atEnd} style={{ ...btnPrimary, opacity: atEnd ? 0.4 : 1 }}>Next →</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={downloadJudgements} style={btnGhost}>⬇ Download notes</button>
              <button onClick={logJudgements} style={btnPrimary}>⚖️ Log judgements ({nJudged})</button>
            </div>
          </div>
          {saveState.status !== "idle" && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: saveState.status === "ok" ? "#15803d" : saveState.status === "err" ? "#b91c1c" : "#666" }}>
              {saveState.status === "saving" ? "Saving…" : saveState.msg}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 22px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <a href="/daniotype_kasperov" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>← daniotype_kasperov</a>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>Meta-Reasoner · replay + judgement</div>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#999", fontFamily: "ui-monospace, monospace" }}>replay · no LLM</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- one recorded chat step ----
function StepView({ node, note, onNote }: { node: Extract<Node, { kind: "step" }>; note: string; onNote: (v: string) => void }) {
  const { leaf, step, withinComp, compIndex } = node;
  const th = THEME[step.mode] ?? THEME.reason;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={CARD}>
        <div style={{ fontSize: 11, color: "#9a948c", fontWeight: 700 }}>COMPARTMENT {compIndex} · CLUSTER {withinComp} · {leaf.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: th.color }}>{th.icon} {step.title}</span>
          {step.menuExposed ? <span style={{ fontSize: 11, fontWeight: 800, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 9px" }}>menu-exposed · GT menu shown AFTER de-novo lock</span> : null}
          {leaf.finalLabel ? <span style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>final: <b>{leaf.finalLabel}</b></span> : null}
        </div>
      </div>

      {/* the user turn that drove this step */}
      {step.request ? (
        <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: "#eef2f6", border: "1px solid #dfe6ee", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, color: "#334", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {stripControlBlocks(step.request)}
        </div>
      ) : null}

      {/* recorded search trail (Researcher steps) */}
      <StatusTrail statuses={step.statuses} />

      {/* the personality's recorded answer, rendered exactly like the live wizard */}
      <AgentMessage content={stripControlBlocks(step.response)} mode={step.mode} thinking={step.thinking || undefined} />

      <NoteBox value={note} onChange={onNote} saved={!!note.trim()} />
    </div>
  );
}

// ---- a compartment boundary: ledger + the (draft) meta-reasoner system context ----
function BoundaryView({ node, note, onNote }: { node: Extract<Node, { kind: "boundary" }>; note: string; onNote: (v: string) => void }) {
  const b = node.boundary;
  const rows = Object.entries(b.per_compartment).sort((a, b2) => Number(a[0]) - Number(b2[0]));
  const ctx = META_REASONER_CONTEXT;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "3px 11px" }}>🧠 META-REASONER · compartment boundary</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 2px" }}>
          Compartment {b.at_boundary_after_compartmentIndex} complete{b.next_compartmentIndex ? ` → Compartment ${b.next_compartmentIndex}` : " (end of sweep)"}
        </h2>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
          This is where the Phase-2 brain WOULD decide which remaining compartments to descend into vs. leave consolidated. Judge the ledger it saw and the context (below) it would reason with.
        </div>
        {/* ledger */}
        <div style={{ marginTop: 12, border: "1px solid #e5e1dc", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ background: "#f3f0ec", color: "#555", textAlign: "left" }}>
              {["Compartment", "Leaves", "Labelled", "Abstained"].map((h) => <th key={h} style={{ padding: "7px 10px", fontWeight: 700, borderBottom: "1px solid #e5e1dc" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(([ci, v]) => (
                <tr key={ci}><td style={{ padding: "6px 10px", fontWeight: 700 }}>Compartment {ci}</td><td style={{ padding: "6px 10px" }}>{v.total}</td><td style={{ padding: "6px 10px" }}>{v.labelled}</td><td style={{ padding: "6px 10px" }}>{v.abstained}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12 }}>
          <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>{b.leaves_labelled} labelled</span>
          <span style={{ background: "#fffbeb", color: "#a16207", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>{b.leaves_abstained} abstained</span>
          <span style={{ background: "#eef2ff", color: "#4338ca", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>{b.calls_so_far} calls</span>
          <span style={{ background: "#f5f3f0", color: "#555", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>${b.cost_so_far_usd?.toFixed?.(2) ?? b.cost_so_far_usd}</span>
        </div>
      </div>

      {/* the DRAFT system context — rules + experiential knowledge — to judge */}
      <div style={{ ...CARD, borderColor: "#e0d3f7", background: "#fdfbff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ ...SEC, margin: 0, color: "#7c3aed" }}>Meta-Reasoner system context</div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 8px" }}>{ctx.status}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#5a544c", lineHeight: 1.55, marginBottom: 10 }}>{ctx.intro}</div>

        <ContextGroup title="Descent rules" items={ctx.rules} color="#7c3aed" />
        <ContextGroup title="Ground-truth discipline" items={ctx.gtDiscipline} color="#0d9488" />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#a16207", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Experiential priors (general biology only)</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {ctx.experientialPriors.map((p, i) => <li key={i} style={{ fontSize: 12.5, color: "#5a544c", lineHeight: 1.5 }}>{p}</li>)}
          </ul>
        </div>
      </div>

      <NoteBox value={note} onChange={onNote} saved={!!note.trim()} />
    </div>
  );
}

function ContextGroup({ title, items, color }: { title: string; items: { title: string; body: string }[]; color: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((r, i) => (
          <div key={i} style={{ fontSize: 12.5, color: "#4a4540", lineHeight: 1.5 }}>
            <b style={{ color: "#333" }}>{r.title}.</b> {r.body}
          </div>
        ))}
      </div>
    </div>
  );
}
