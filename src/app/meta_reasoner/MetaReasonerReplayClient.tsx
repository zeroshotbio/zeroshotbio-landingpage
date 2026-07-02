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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentMode } from "../daniotype_kasperov/types";
import { PAPER, INK, ACCENT, THEME, btnGhost, btnPrimary } from "../daniotype_kasperov/theme";
import { AgentMessage } from "../daniotype_kasperov/components/ChatMessage";
import { META_REASONER_CONTEXT } from "./metaReasonerContext";
import { ledgerFromReplay } from "./brain";
import { MetaReasonerBrainPanel, type BrainResult } from "./components/MetaReasonerBrainPanel";

const ASSET_BASE = "https://zscape.zeroshot.bio/daniotype_data";
const REPLAY_DIR = `${ASSET_BASE}/meta_reasoner_replay`;
const INDEX_URL = `${REPLAY_DIR}/index.json`;

// one entry in the runs manifest (index.json) shown on the landing page.
type RunMeta = {
  id: string; file: string; label: string; date?: string;
  dataset?: string; model?: string; leaves?: number; compartments?: number;
  boundaries?: number; cost_usd?: number; metaDecisions?: number; hasBrain?: boolean;
};

// a recorded Phase-2 meta-reasoner decision (from a run that had the brain).
type RecordedDecision = {
  boundary_after_compartmentIndex: number; next_compartmentIndex?: number | null;
  action?: string; target?: string; rationale?: string; expected_still_missing?: string[];
  cap_applied?: boolean; gt_blind?: boolean; gt_leak_check?: any; reasoning?: string;
  usage?: any; cost_usd?: number; model?: string;
};

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
  boundaries: Boundary[]; leaves: ReplayLeaf[]; metaDecisions?: RecordedDecision[];
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
  const [runs, setRuns] = useState<RunMeta[] | null>(null);
  const [runsErr, setRunsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RunMeta | null>(null);
  const [asset, setAsset] = useState<ReplayAsset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // ⚖️🧠 Phase-2 brain decisions, keyed by the boundary's just-finished compartmentIndex.
  const [decisions, setDecisions] = useState<Record<number, BrainResult>>({});
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "ok" | "err"; msg?: string }>({ status: "idle" });

  // descent budget already spent (per expected tissue) by decisions at EARLIER
  // boundaries — feeds the cap guardrail so a later boundary can't re-descend.
  function priorAttemptsFor(compIndex: number): Record<string, number> {
    const acc: Record<string, number> = {};
    for (const [k, r] of Object.entries(decisions)) {
      if (Number(k) >= compIndex) continue;
      const d = r?.decision;
      if (d?.action === "descend" && d.target) { const key = d.target.trim().toLowerCase(); acc[key] = (acc[key] || 0) + 1; }
    }
    return acc;
  }

  // load the runs manifest once
  useEffect(() => {
    let alive = true;
    fetch(INDEX_URL)
      .then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.json(); })
      .then((d) => { if (alive) setRuns(Array.isArray(d?.runs) ? d.runs : []); })
      .catch((e) => { if (alive) setRunsErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, []);

  // load the selected run's asset (and reset the session)
  useEffect(() => {
    if (!selected) { setAsset(null); return; }
    let alive = true;
    setAsset(null); setErr(null); setPos(0); setNotes({}); setDecisions({}); setSaveState({ status: "idle" });
    fetch(`${REPLAY_DIR}/${selected.file}`)
      .then((r) => { if (!r.ok) throw new Error(`asset ${r.status}`); return r.json(); })
      .then((d) => { if (alive) setAsset(d); })
      .catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [selected]);

  // recorded meta-reasoner decisions from the asset, keyed by just-finished compartment
  const recordedByComp = useMemo(() => {
    const m = new Map<number, RecordedDecision>();
    (asset?.metaDecisions ?? []).forEach((d) => m.set(d.boundary_after_compartmentIndex, d));
    return m;
  }, [asset]);

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
  const nDecisions = Object.values(decisions).filter((r) => r?.decision).length;

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

  // structured brain decisions → logged with the run the SAME way judgements are.
  function buildMetaDecisions() {
    const ts = new Date().toISOString();
    return Object.entries(decisions)
      .filter(([, r]) => r?.decision)
      .map(([compIndex, r]) => ({
        boundary_after_compartmentIndex: Number(compIndex),
        action: r.decision!.action,
        target: r.decision!.target,
        rationale: r.decision!.rationale,
        expected_still_missing: r.decision!.expected_still_missing,
        cap_applied: !!r.guardrails?.capApplied,
        cap_note: r.guardrails?.capNote ?? null,
        gt_blind: !!r.guardrails?.gtBlind,
        reasoning_excerpt: (r.reasoning || "").slice(0, 600),
        model: r.usage?.model ?? asset?.model,
        ts,
      }));
  }

  // save into the SAME run store the live wizard uses → shows in Load Previous Run.
  async function logJudgements() {
    if (!asset) return;
    const judgements = buildJudgements();
    const metaDecisions = buildMetaDecisions();
    // mirror each brain decision as a judgement-style entry so RunViewer surfaces
    // it (readback proof), while the structured form lives in metaDecisions[].
    const decisionJudgements: Judgement[] = metaDecisions.map((m) => ({
      cluster_id: `boundary:${m.boundary_after_compartmentIndex}`,
      cluster_label: `Meta-Reasoner decision · after Compartment ${m.boundary_after_compartmentIndex}`,
      step_index: 0,
      mode: "meta_decision",
      content_excerpt: `${m.action}${m.target ? ` · ${m.target}` : ""} — ${m.rationale}`.slice(0, 240),
      note: m.rationale,
      ts: m.ts,
    }));
    const allJudgements = [...judgements, ...decisionJudgements];
    if (!allJudgements.length && !metaDecisions.length) { setSaveState({ status: "err", msg: "No notes or decisions to log yet." }); return; }
    const exportedAt = new Date().toISOString();
    const run = {
      datasetId: asset.datasetId || "zscape_recursive",
      dataset: asset.dataset,
      model: asset.model,
      exportedAt,
      note: `⚖️🧠 Meta-Reasoner replay — ${asset.source ?? "trimmed"} · ${judgements.length} note(s) · ${metaDecisions.length} decision(s)`,
      source: "meta_reasoner_replay",
      replayOf: asset.schema,
      judgementMode: true,
      judgements: allJudgements,
      metaDecisions,
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
    const payload = { schema: "daniotype_kasperov_judgements/v1", replayOf: asset.schema, dataset: asset.dataset, model: asset.model, exportedAt: new Date().toISOString(), judgements: buildJudgements(), metaDecisions: buildMetaDecisions() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meta_reasoner_judgements_${(asset.dataset || "run").replace(/[^\w]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // download the ENTIRE conversation — every leaf's chat steps, every boundary +
  // recorded meta-reasoner decision, plus any judgements/decisions from this session.
  function downloadFullRun() {
    if (!asset) return;
    const payload = { schema: "meta_reasoner_full_run/v1", run: selected?.id ?? asset.source, exportedAt: new Date().toISOString(),
      asset, judgements: buildJudgements(), liveDecisions: buildMetaDecisions() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meta_reasoner_run_${(selected?.id || asset.dataset || "run").replace(/[^\w]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- landing: pick a run ----
  if (!selected) return <Shell><RunPicker runs={runs} err={runsErr} onPick={setSelected} /></Shell>;
  if (err) return <Shell><div style={{ ...CARD, color: "#b91c1c" }}>Failed to load run <code>{selected.file}</code> ({err}). <button onClick={() => setSelected(null)} style={{ ...btnGhost, marginLeft: 8 }}>← back to runs</button></div></Shell>;
  if (!asset || !node) return <Shell><div style={{ ...CARD, color: "#888" }}>Loading {selected.label}…</div></Shell>;

  const atEnd = pos >= nodes.length - 1;

  return (
    <Shell>
      {/* header */}
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setSelected(null)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}>← Runs</button>
          <span style={{ fontSize: 18, fontWeight: 800 }}>🧠 {selected.label}</span>
          <span style={{ fontSize: 12.5, color: "#666" }}>
            {asset.dataset} · {asset.model} · {asset.leaves.length} leaves · {asset.calls} calls · ~${Number(asset.cost_usd).toFixed(2)}
            {recordedByComp.size ? ` · ${recordedByComp.size} meta-decisions` : ""}
          </span>
          {nJudged ? <span style={{ fontSize: 10.5, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "1px 8px" }}>⚖️ {nJudged} note{nJudged === 1 ? "" : "s"}</span> : null}
          <button onClick={downloadFullRun} style={{ ...btnGhost, marginLeft: "auto", padding: "5px 11px", fontSize: 12 }}>⬇ Download full run (.json)</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 6, lineHeight: 1.5 }}>
          Replaying a completed headless run — no model is called. Step through each cluster&apos;s recorded chat and each compartment boundary (with its recorded meta-reasoner decision); leave a judgement note anywhere. Notes save to the same store as the live wizard (⚖️ in Load Previous Run). Use <b>← / →</b> to move.
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
            <BoundaryView
              node={node}
              asset={asset}
              note={notes[node.key] || ""}
              onNote={(v) => setNotes((m) => ({ ...m, [node.key]: v }))}
              recorded={recordedByComp.get(node.compIndex) ?? null}
              decision={decisions[node.compIndex] ?? null}
              priorDescentAttempts={priorAttemptsFor(node.compIndex)}
              onDecision={(r) => setDecisions((m) => ({ ...m, [node.compIndex]: r }))}
            />
          )}

          {/* nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button onClick={() => setPos((p) => Math.max(0, p - 1))} disabled={pos === 0} style={{ ...btnGhost, opacity: pos === 0 ? 0.4 : 1 }}>← Prev</button>
            <span style={{ fontSize: 12, color: "#9a948c" }}>{pos + 1} / {nodes.length}</span>
            <button onClick={() => setPos((p) => Math.min(nodes.length - 1, p + 1))} disabled={atEnd} style={{ ...btnPrimary, opacity: atEnd ? 0.4 : 1 }}>Next →</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={downloadJudgements} style={btnGhost}>⬇ Download notes</button>
              <button onClick={logJudgements} style={btnPrimary}>⚖️🧠 Log ({nJudged} note{nJudged === 1 ? "" : "s"} · {nDecisions} decision{nDecisions === 1 ? "" : "s"})</button>
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

// ---- a compartment boundary: ledger + the Phase-2 brain + the system context ----
function BoundaryView({ node, asset, note, onNote, recorded, decision, priorDescentAttempts, onDecision }: {
  node: Extract<Node, { kind: "boundary" }>;
  asset: ReplayAsset;
  note: string;
  onNote: (v: string) => void;
  recorded: RecordedDecision | null;
  decision: BrainResult | null;
  priorDescentAttempts: Record<string, number>;
  onDecision: (r: BrainResult) => void;
}) {
  const b = node.boundary;
  const rows = Object.entries(b.per_compartment).sort((a, b2) => Number(a[0]) - Number(b2[0]));
  const ctx = META_REASONER_CONTEXT;
  const ledger = React.useMemo(() => ledgerFromReplay(asset, b), [asset, b]);
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
          {recorded
            ? "The meta-reasoner reasoned over the ledger below and emitted the recorded decision (next). Judge whether it read the compartment right."
            : "This is where the Phase-2 brain decides which remaining compartments to descend into vs. leave consolidated. Judge the ledger it saw and the context (below) it would reason with."}
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

      {/* RECORDED meta-reasoner decision from this run — the chat history to judge */}
      {recorded ? <RecordedDecisionCard rec={recorded} /> : null}

      {/* PHASE 2 (live): re-run the brain over this ledger. Secondary when a decision
          was already recorded (you're here to judge the recorded one). */}
      {recorded ? (
        <details style={{ ...CARD, borderColor: "#e0d3f7", background: "#fdfbff", padding: "10px 14px" }}>
          <summary style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", cursor: "pointer" }}>↻ re-run the meta-reasoner live on this ledger (optional)</summary>
          <div style={{ marginTop: 10 }}>
            <MetaReasonerBrainPanel ledger={ledger} priorDescentAttempts={priorDescentAttempts} model={asset.model} onResult={onDecision} />
          </div>
        </details>
      ) : (
        <MetaReasonerBrainPanel ledger={ledger} priorDescentAttempts={priorDescentAttempts} model={asset.model} onResult={onDecision} />
      )}
      {decision?.decision ? (
        <div style={{ fontSize: 11.5, color: "#15803d", fontWeight: 700 }}>✓ re-run decision captured — will be logged with your judgements ({decision.decision.action}{decision.decision.target ? ` · ${decision.decision.target}` : ""})</div>
      ) : null}

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

// ---- landing page: pick which recorded run to inspect ----
function RunPicker({ runs, err, onPick }: { runs: RunMeta[] | null; err: string | null; onPick: (r: RunMeta) => void }) {
  if (err) return <div style={{ ...CARD, color: "#b91c1c" }}>Couldn&apos;t load the runs list ({err}). Expected at <code>{INDEX_URL}</code>.</div>;
  if (!runs) return <div style={{ ...CARD, color: "#888" }}>Loading runs…</div>;
  if (!runs.length) return <div style={{ ...CARD, color: "#888" }}>No recorded runs yet.</div>;
  return (
    <div>
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🧠 Meta-Reasoner — recorded runs</div>
        <div style={{ fontSize: 12.5, color: "#7a746c", marginTop: 6, lineHeight: 1.5 }}>
          Pick a completed headless run to inspect. You&apos;ll step through every cluster&apos;s chat and every compartment boundary&apos;s meta-reasoner decision as chat history — judge any step, and download the whole conversation as JSON.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {runs.map((r) => (
          <div key={r.id} onClick={() => onPick(r)}
            style={{ ...CARD, cursor: "pointer", transition: "border-color .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = ACCENT)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e1dc")}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{r.label}</span>
              {r.hasBrain
                ? <span style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", background: "#f3e8ff", borderRadius: 99, padding: "1px 8px" }}>🧠 {r.metaDecisions} meta-decisions</span>
                : <span style={{ fontSize: 10, fontWeight: 700, color: "#9a948c", background: "#f1ede8", borderRadius: 99, padding: "1px 8px" }}>ledger only (no brain)</span>}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6, lineHeight: 1.6 }}>
              {r.dataset} · {r.model}<br />
              <b>{r.leaves}</b> leaves · <b>{r.compartments}</b> compartments · {r.boundaries} boundaries
              {r.cost_usd != null ? <> · ~${Number(r.cost_usd).toFixed(2)}</> : null}
            </div>
            {r.date ? <div style={{ fontSize: 11, color: "#9a948c", marginTop: 6 }}>{r.date}</div> : null}
            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: ACCENT }}>Inspect →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const REC_ACTION: Record<string, { bg: string; fg: string; icon: string }> = {
  consolidate: { bg: "#dcfce7", fg: "#15803d", icon: "⤵" },
  descend: { bg: "#eef2ff", fg: "#4338ca", icon: "⤓" },
  not_found_accept: { bg: "#fff7ed", fg: "#9a3412", icon: "∅" },
};

// The recorded meta-reasoner decision, rendered as a read-only chat-history block.
function RecordedDecisionCard({ rec }: { rec: RecordedDecision }) {
  const a = REC_ACTION[rec.action || ""] ?? REC_ACTION.not_found_accept;
  return (
    <div style={{ ...CARD, borderColor: "#e0d3f7", background: "#fdfbff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5 }}>🧠 Meta-Reasoner decision (recorded)</span>
        {rec.gt_blind ? <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, padding: "1px 8px" }}>🔒 GT-blind</span> : null}
        {rec.cap_applied ? <span style={{ fontSize: 11, fontWeight: 800, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 8px" }}>⛔ cap applied</span> : null}
        {rec.model ? <span style={{ marginLeft: "auto", fontSize: 11, color: "#9a948c" }}>{rec.model}</span> : null}
      </div>
      {/* the brain's reasoning as chat prose */}
      {rec.reasoning ? (
        <div style={{ fontSize: 13, color: "#3a352f", lineHeight: 1.55, marginTop: 10 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripControlBlocks(rec.reasoning)}</ReactMarkdown>
        </div>
      ) : null}
      {/* the structured decision */}
      <div style={{ marginTop: 10, border: `1px solid ${a.fg}44`, borderLeft: `3px solid ${a.fg}`, borderRadius: 10, background: "#fff", padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: a.fg, background: a.bg, borderRadius: 99, padding: "3px 12px" }}>{a.icon} {rec.action}</span>
          {rec.target ? <span style={{ fontSize: 13.5, fontWeight: 700, color: "#333" }}>{rec.target}</span> : null}
        </div>
        {rec.rationale ? <div style={{ fontSize: 13, color: "#444", marginTop: 8, lineHeight: 1.5 }}>{rec.rationale}</div> : null}
        {rec.expected_still_missing?.length ? (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9a948c", textTransform: "uppercase", letterSpacing: 0.4 }}>still missing:</span>
            {rec.expected_still_missing.map((t, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 99, padding: "1px 9px" }}>{t}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
