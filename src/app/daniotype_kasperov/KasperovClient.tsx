"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ATLAS,
  TIER_LADDER,
  type AtlasNode,
  type Tier,
  type CellState,
} from "./atlas";

// ---------------------------------------------------------------------------
// Judge verdicts. The human renders one of these per node; the wizard is done
// when every node carries a verdict.
// ---------------------------------------------------------------------------
type VerdictKind = "approve" | "relabel" | "abstain" | "flag";

interface Verdict {
  kind: VerdictKind;
  // populated only for relabel
  relabelTier?: Tier;
  relabelName?: string;
  relabelState?: CellState;
  note?: string;
  ts: number;
}

type VerdictMap = Record<string, Verdict>;

const STORAGE_KEY = "daniotype_kasperov_v1";

// Warm-paper palette to match the rest of the site.
const PAPER = "#f6f4f2";
const INK = "#2b2b2b";
const ACCENT = "#0e7490"; // cyan-700
const ACCENT_SOFT = "#e0f2f7";

const VERDICT_META: Record<VerdictKind, { label: string; color: string; bg: string }> = {
  approve: { label: "Approved", color: "#15803d", bg: "#dcfce7" },
  relabel: { label: "Relabelled", color: "#b45309", bg: "#fef3c7" },
  abstain: { label: "Abstained", color: "#6b7280", bg: "#e5e7eb" },
  flag: { label: "Flagged", color: "#b91c1c", bg: "#fee2e2" },
};

const STATES: CellState[] = ["progenitor", "cycling", "quiescent", "mature", "stress", null];

// Build the parent-chain breadcrumb (coarse → this node) for a node id.
function ancestry(nodeId: string): AtlasNode[] {
  const byId = new Map(ATLAS.map((n) => [n.id, n]));
  const chain: AtlasNode[] = [];
  let cur: AtlasNode | undefined = byId.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return chain;
}

function confColor(c: number): string {
  if (c >= 0.8) return "#15803d";
  if (c >= 0.6) return "#b45309";
  return "#b91c1c";
}

export default function KasperovClient() {
  const [stage, setStage] = useState<"intro" | "wizard" | "summary">("intro");
  const [idx, setIdx] = useState(0);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [loaded, setLoaded] = useState(false);

  // hydrate from localStorage (POC persistence; swaps to /api later)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setVerdicts(parsed.verdicts ?? {});
        if (typeof parsed.idx === "number") setIdx(parsed.idx);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ verdicts, idx }));
    } catch {
      /* ignore */
    }
  }, [verdicts, idx, loaded]);

  const node = ATLAS[idx];
  const nDecided = Object.keys(verdicts).length;
  const total = ATLAS.length;

  function record(v: Omit<Verdict, "ts">) {
    setVerdicts((prev) => ({ ...prev, [node.id]: { ...v, ts: Date.now() } }));
  }

  function next() {
    if (idx < total - 1) setIdx(idx + 1);
    else setStage("summary");
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }

  function resetAll() {
    if (!confirm("Clear all judgements and start over?")) return;
    setVerdicts({});
    setIdx(0);
    setStage("intro");
  }

  if (stage === "intro") return <Intro onStart={() => setStage("wizard")} nDecided={nDecided} total={total} />;
  if (stage === "summary")
    return <Summary verdicts={verdicts} onBack={() => setStage("wizard")} onReset={resetAll} />;

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <TopBar nDecided={nDecided} total={total} onSummary={() => setStage("summary")} onReset={resetAll} />
      <div style={{ display: "flex", maxWidth: 1320, margin: "0 auto", gap: 24, padding: "20px 24px 80px" }}>
        <Sidebar idx={idx} verdicts={verdicts} onJump={setIdx} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <NodeScreen
            node={node}
            verdict={verdicts[node.id]}
            onRecord={record}
            onNext={next}
            onPrev={prev}
            isFirst={idx === 0}
            isLast={idx === total - 1}
            position={idx + 1}
            total={total}
          />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------
function Intro({ onStart, nDecided, total }: { onStart: () => void; nDecided: number; total: number }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 760, padding: "80px 28px" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>
          daniotype · kasperov
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.1 }}>
          Human-in-the-loop cell-type labelling
        </h1>
        <p style={{ fontSize: 18, color: "#555", lineHeight: 1.6, marginTop: 14 }}>
          The strongest systems are human–AI hybrids. Here the{" "}
          <strong>daniotype descent</strong> does the legwork — it sub-clusters the zebrafish atlas
          and, for every cluster, serves grounded, tool-verified evidence: differential markers →
          where they express in vivo (ZFIN) → ZFA anatomy → a proposed{" "}
          <code style={{ background: ACCENT_SOFT, padding: "1px 6px", borderRadius: 4 }}>
            (identity, state)
          </code>{" "}
          name. <strong>You are the judge.</strong>
        </p>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.6, marginTop: 14 }}>
          You walk the atlas tree top-down, screen by screen — coarse germ layers first, then the
          clusters within clusters. On each node you decide: is the AI on track? Approve it,
          relabel it, abstain, or flag it for re-clustering. When you reach the leaves, the whole
          atlas is labelled.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            border: "1px solid #e6c200",
            background: "#fffbe6",
            borderRadius: 8,
            fontSize: 14,
            color: "#7a5c00",
          }}
        >
          <strong>POC skeleton.</strong> The {total} clusters below carry illustrative sample
          evidence shaped exactly like real descent output. Wiring this to a live{" "}
          <code>runs/&lt;run&gt;/hierarchy.json</code> + decision log is the next refinement step.
        </div>

        <button
          onClick={onStart}
          style={{
            marginTop: 28,
            background: ACCENT,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "14px 28px",
            fontSize: 17,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {nDecided > 0 ? `Resume — ${nDecided}/${total} judged →` : "Begin the descent →"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar + progress
// ---------------------------------------------------------------------------
function TopBar({
  nDecided,
  total,
  onSummary,
  onReset,
}: {
  nDecided: number;
  total: number;
  onSummary: () => void;
  onReset: () => void;
}) {
  const pct = Math.round((nDecided / total) * 100);
  return (
    <div style={{ borderBottom: "1px solid #e5e1dc", background: "#fffdfb", position: "sticky", top: 0, zIndex: 10 }}>
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          daniotype <span style={{ color: ACCENT }}>· kasperov</span>
        </div>
        <div style={{ flex: 1, height: 8, background: "#ece8e3", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, transition: "width .3s" }} />
        </div>
        <div style={{ fontSize: 13, color: "#666", whiteSpace: "nowrap" }}>
          {nDecided}/{total} judged
        </div>
        <button onClick={onSummary} style={btnGhost}>
          Summary
        </button>
        <button onClick={onReset} style={{ ...btnGhost, color: "#b91c1c" }}>
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar mini-tree
// ---------------------------------------------------------------------------
function Sidebar({ idx, verdicts, onJump }: { idx: number; verdicts: VerdictMap; onJump: (i: number) => void }) {
  return (
    <aside style={{ width: 250, flexShrink: 0 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>
        Atlas tree
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ATLAS.map((n, i) => {
          const v = verdicts[n.id];
          const active = i === idx;
          const meta = v ? VERDICT_META[v.kind] : null;
          return (
            <button
              key={n.id}
              onClick={() => onJump(i)}
              title={n.decision.name}
              style={{
                textAlign: "left",
                border: "none",
                background: active ? ACCENT_SOFT : "transparent",
                borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                padding: "7px 8px",
                paddingLeft: 8 + n.depth * 14,
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: INK,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: meta ? meta.color : "#cfcac4",
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.decision.name}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// The per-node screen — the heart of the wizard
// ---------------------------------------------------------------------------
function NodeScreen({
  node,
  verdict,
  onRecord,
  onNext,
  onPrev,
  isFirst,
  isLast,
  position,
  total,
}: {
  node: AtlasNode;
  verdict?: Verdict;
  onRecord: (v: Omit<Verdict, "ts">) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  position: number;
  total: number;
}) {
  const d = node.decision;
  const chain = ancestry(node.id);
  const [relabelOpen, setRelabelOpen] = useState(false);
  const [rName, setRName] = useState(d.name);
  const [rTier, setRTier] = useState<Tier>(d.tier);
  const [rState, setRState] = useState<CellState>(d.state);
  const [note, setNote] = useState(verdict?.note ?? "");

  // reset local relabel form when the node changes
  useEffect(() => {
    setRelabelOpen(verdict?.kind === "relabel");
    setRName(verdict?.relabelName ?? d.name);
    setRTier(verdict?.relabelTier ?? d.tier);
    setRState(verdict?.relabelState ?? d.state);
    setNote(verdict?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <div>
      {/* breadcrumb */}
      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
        Cluster {position} of {total} &nbsp;·&nbsp;{" "}
        {chain.map((c, i) => (
          <span key={c.id}>
            {i > 0 && <span style={{ color: "#c8c2bb" }}> › </span>}
            <span style={{ color: i === chain.length - 1 ? INK : "#888", fontWeight: i === chain.length - 1 ? 600 : 400 }}>
              {c.decision.name}
            </span>
          </span>
        ))}
      </div>

      {/* AI proposal header */}
      <div
        style={{
          border: "1px solid #e5e1dc",
          borderRadius: 12,
          background: "#fffdfb",
          padding: "18px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: ACCENT, fontWeight: 600 }}>
              AI proposes · {d.tier}
              {d.decision === "abstain" && " · ABSTAINED"}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
              {d.name}
              {d.state && (
                <span style={{ fontSize: 18, fontWeight: 500, color: "#b45309" }}> · {d.state}</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              {node.n_cells.toLocaleString()} cells · depth {node.depth} · panel agreement{" "}
              {(d.k_vote_agreement * 100).toFixed(0)}%
              {d.lineage_broken && (
                <span style={{ color: "#b91c1c", fontWeight: 600 }}> · ⚠ lineage broken</span>
              )}
            </div>
          </div>
          <Gauge value={d.confidence} />
        </div>
        <p style={{ fontSize: 15, color: "#444", lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>
          {d.rationale}
        </p>
      </div>

      {/* placeholder UMAP + sibling contrast */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <UmapPlaceholder node={node} />
        <div style={{ flex: 1 }}>
          <SectionTitle>Discriminating contrast vs siblings</SectionTitle>
          <div style={{ ...card, fontSize: 14, color: "#444", lineHeight: 1.5 }}>{node.sibling_contrast}</div>
          <SectionTitle style={{ marginTop: 14 }}>Cite-discipline</SectionTitle>
          <div style={{ ...card, fontSize: 13, color: "#555" }}>
            <CiteRow label="Cited markers" items={d.cited_markers} />
            <CiteRow label="Cited absent" items={d.cited_absent_markers} muted />
            <CiteRow label="Cited ontology ids" items={d.cited_ids} mono />
          </div>
        </div>
      </div>

      {/* evidence: markers */}
      <SectionTitle>Differential markers (the candidate evidence)</SectionTitle>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <MarkerTable node={node} />
      </div>

      {/* evidence: ZFIN expression + GO */}
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <SectionTitle>ZFIN in-vivo expression (marker → anatomy)</SectionTitle>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>gene</Th>
                  <Th>ZFA anatomy</Th>
                  <Th>id</Th>
                  <Th>stage</Th>
                </tr>
              </thead>
              <tbody>
                {node.expression.map((e, i) => (
                  <tr key={i}>
                    <Td mono>{e.gene}</Td>
                    <Td>{e.zfa_term}</Td>
                    <Td>
                      <ZfaLink id={e.zfa_id} />
                    </Td>
                    <Td muted>{e.stage}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <SectionTitle>GO annotations (function)</SectionTitle>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>gene</Th>
                  <Th>GO term</Th>
                  <Th>aspect</Th>
                </tr>
              </thead>
              <tbody>
                {node.go.map((g, i) => (
                  <tr key={i}>
                    <Td mono>{g.gene}</Td>
                    <Td>
                      <GoLink id={g.go_id} /> {g.go_term}
                    </Td>
                    <Td muted>{g.aspect}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* proposer panel */}
      <SectionTitle style={{ marginTop: 16 }}>Proposer panel ({node.votes.length} votes)</SectionTitle>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {node.votes.map((v, i) => (
          <div key={i} style={{ ...card, flex: "1 1 280px", minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "#888" }}>{v.member}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: confColor(v.confidence) }}>
                {(v.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
              {v.name}
              {v.state && <span style={{ color: "#b45309", fontWeight: 500 }}> · {v.state}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {v.tier} · {v.decision}
            </div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 6, lineHeight: 1.4 }}>{v.rationale}</div>
          </div>
        ))}
      </div>

      {/* JUDGE BAR */}
      <div
        style={{
          marginTop: 24,
          border: `2px solid ${ACCENT}`,
          borderRadius: 12,
          background: ACCENT_SOFT,
          padding: "18px 20px",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Your judgement</div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
          Is the AI on track? Approve its label, correct it, abstain when the evidence is too thin,
          or flag the cluster for re-clustering.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <JudgeBtn
            active={verdict?.kind === "approve"}
            color="#15803d"
            onClick={() => {
              setRelabelOpen(false);
              onRecord({ kind: "approve", note });
            }}
          >
            ✓ Approve AI label
          </JudgeBtn>
          <JudgeBtn active={verdict?.kind === "relabel"} color="#b45309" onClick={() => setRelabelOpen((o) => !o)}>
            ✎ Relabel
          </JudgeBtn>
          <JudgeBtn
            active={verdict?.kind === "abstain"}
            color="#6b7280"
            onClick={() => {
              setRelabelOpen(false);
              onRecord({ kind: "abstain", note });
            }}
          >
            ∅ Abstain (too thin)
          </JudgeBtn>
          <JudgeBtn
            active={verdict?.kind === "flag"}
            color="#b91c1c"
            onClick={() => {
              setRelabelOpen(false);
              onRecord({ kind: "flag", note });
            }}
          >
            ⚑ Flag for re-clustering
          </JudgeBtn>
        </div>

        {relabelOpen && (
          <div style={{ marginTop: 14, padding: 14, background: "#fffdfb", borderRadius: 8, border: "1px solid #e5e1dc" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={fieldLabel}>
                Tier
                <select value={rTier} onChange={(e) => setRTier(e.target.value as Tier)} style={inputStyle}>
                  {TIER_LADDER.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...fieldLabel, flex: 1, minWidth: 180 }}>
                Identity name
                <input value={rName} onChange={(e) => setRName(e.target.value)} style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                State
                <select
                  value={rState ?? ""}
                  onChange={(e) => setRState((e.target.value || null) as CellState)}
                  disabled={rTier !== "cell_type_state"}
                  style={{ ...inputStyle, opacity: rTier !== "cell_type_state" ? 0.5 : 1 }}
                >
                  {STATES.map((s) => (
                    <option key={s ?? "none"} value={s ?? ""}>
                      {s ?? "— none —"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() =>
                  onRecord({
                    kind: "relabel",
                    relabelTier: rTier,
                    relabelName: rName,
                    relabelState: rTier === "cell_type_state" ? rState : null,
                    note,
                  })
                }
                style={{ ...btnPrimary, marginBottom: 0 }}
              >
                Save relabel
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
              State is only valid at the <code>cell_type_state</code> tier (identity × state model).
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (verdict) onRecord({ ...verdict, note });
          }}
          placeholder="Optional note — your reasoning, a marker the AI missed, a caveat…"
          style={{
            marginTop: 12,
            width: "100%",
            minHeight: 56,
            padding: 10,
            border: "1px solid #d8d3cd",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            background: "#fffdfb",
          }}
        />

        {verdict && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Recorded:{" "}
            <span
              style={{
                background: VERDICT_META[verdict.kind].bg,
                color: VERDICT_META[verdict.kind].color,
                padding: "2px 8px",
                borderRadius: 99,
                fontWeight: 600,
              }}
            >
              {VERDICT_META[verdict.kind].label}
              {verdict.kind === "relabel" && verdict.relabelName ? ` → ${verdict.relabelName}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* nav */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
        <button onClick={onPrev} disabled={isFirst} style={{ ...btnGhost, opacity: isFirst ? 0.4 : 1 }}>
          ← Previous cluster
        </button>
        <button onClick={onNext} style={btnPrimary}>
          {isLast ? "Finish & review →" : verdict ? "Next cluster →" : "Skip for now →"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
function Summary({
  verdicts,
  onBack,
  onReset,
}: {
  verdicts: VerdictMap;
  onBack: () => void;
  onReset: () => void;
}) {
  const counts = useMemo(() => {
    const c: Record<VerdictKind, number> = { approve: 0, relabel: 0, abstain: 0, flag: 0 };
    Object.values(verdicts).forEach((v) => (c[v.kind] += 1));
    return c;
  }, [verdicts]);

  // export shape mirrors the existing /api/minifin_annotation state contract:
  // { lastIndex, decisions: { nodeId: {...} } }
  const exportState = useMemo(() => {
    const decisions: Record<string, any> = {};
    ATLAS.forEach((n) => {
      const v = verdicts[n.id];
      if (!v) return;
      const finalName = v.kind === "relabel" ? v.relabelName : n.decision.name;
      decisions[n.id] = {
        ai_tier: n.decision.tier,
        ai_name: n.decision.name,
        ai_state: n.decision.state,
        ai_confidence: n.decision.confidence,
        verdict: v.kind,
        final_name: finalName,
        final_tier: v.kind === "relabel" ? v.relabelTier : n.decision.tier,
        final_state: v.kind === "relabel" ? v.relabelState : n.decision.state,
        note: v.note ?? "",
        ts: v.ts,
      };
    });
    return { lastIndex: 0, decisions };
  }, [verdicts]);

  function download() {
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daniotype_kasperov_decisions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>Atlas review summary</h1>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
          {(Object.keys(counts) as VerdictKind[]).map((k) => (
            <div key={k} style={{ ...card, flex: "1 1 160px", textAlign: "center" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: VERDICT_META[k].color }}>{counts[k]}</div>
              <div style={{ fontSize: 13, color: "#777" }}>{VERDICT_META[k].label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>cluster</Th>
                <Th>AI label</Th>
                <Th>verdict</Th>
                <Th>final label</Th>
              </tr>
            </thead>
            <tbody>
              {ATLAS.map((n) => {
                const v = verdicts[n.id];
                const meta = v ? VERDICT_META[v.kind] : null;
                const finalName = v?.kind === "relabel" ? v.relabelName : n.decision.name;
                return (
                  <tr key={n.id}>
                    <Td>
                      <span style={{ paddingLeft: n.depth * 12, color: "#999" }}>{n.depth > 0 ? "› " : ""}</span>
                      {n.id}
                    </Td>
                    <Td>
                      {n.decision.name}
                      {n.decision.state ? ` · ${n.decision.state}` : ""}
                    </Td>
                    <Td>
                      {meta ? (
                        <span style={{ background: meta.bg, color: meta.color, padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                          {meta.label}
                        </span>
                      ) : (
                        <span style={{ color: "#bbb" }}>—</span>
                      )}
                    </Td>
                    <Td>{v ? (v.kind === "abstain" ? <em style={{ color: "#888" }}>abstained</em> : finalName) : <span style={{ color: "#bbb" }}>—</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button onClick={onBack} style={btnGhost}>
            ← Back to wizard
          </button>
          <button onClick={download} style={btnPrimary}>
            ↓ Export decisions (JSON)
          </button>
          <button onClick={onReset} style={{ ...btnGhost, color: "#b91c1c", marginLeft: "auto" }}>
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function Gauge({ value }: { value: number }) {
  const color = confColor(value);
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div style={{ fontSize: 30, fontWeight: 700, color }}>{(value * 100).toFixed(0)}%</div>
      <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>confidence</div>
    </div>
  );
}

function MarkerTable({ node }: { node: AtlasNode }) {
  const max = Math.max(...node.markers.map((m) => Math.abs(m.log2fc)), 1);
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <Th>gene</Th>
          <Th>dir</Th>
          <Th>log2FC</Th>
          <Th>pct in / out</Th>
          <Th>cited?</Th>
        </tr>
      </thead>
      <tbody>
        {node.markers.map((m, i) => {
          const cited =
            node.decision.cited_markers.includes(m.gene) ||
            node.decision.cited_absent_markers.includes(m.gene);
          const w = (Math.abs(m.log2fc) / max) * 100;
          const up = m.direction === "up";
          return (
            <tr key={i}>
              <Td mono>{m.gene}</Td>
              <Td>
                <span style={{ color: up ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{up ? "▲ up" : "▼ down"}</span>
              </Td>
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 70, height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${w}%`, height: "100%", background: up ? "#15803d" : "#b91c1c" }} />
                  </div>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{m.log2fc.toFixed(1)}</span>
                </div>
              </Td>
              <Td muted>
                {(m.pct_in * 100).toFixed(0)}% / {(m.pct_out * 100).toFixed(0)}%
              </Td>
              <Td>
                {cited ? (
                  <span style={{ color: ACCENT, fontWeight: 600 }}>● cited</span>
                ) : (
                  <span style={{ color: "#ccc" }}>—</span>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UmapPlaceholder({ node }: { node: AtlasNode }) {
  // Deterministic pseudo-scatter so the panel feels alive without real coords.
  const pts = useMemo(() => {
    let seed = node.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd(), hot: rnd() > 0.62 }));
  }, [node.id]);
  return (
    <div style={{ width: 240, flexShrink: 0 }}>
      <SectionTitle>Cluster on UMAP</SectionTitle>
      <div style={{ ...card, padding: 8 }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: 180, display: "block" }}>
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 96 + 2}
              cy={p.y * 96 + 2}
              r={p.hot ? 1.7 : 1}
              fill={p.hot ? ACCENT : "#d6d0c9"}
              opacity={p.hot ? 0.9 : 0.5}
            />
          ))}
        </svg>
        <div style={{ fontSize: 11, color: "#999", textAlign: "center" }}>
          highlighted = this cluster (sample layout)
        </div>
      </div>
    </div>
  );
}

function CiteRow({ label, items, muted, mono }: { label: string; items: string[]; muted?: boolean; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: "#999", fontSize: 12 }}>{label}: </span>
      {items.length === 0 ? (
        <span style={{ color: "#ccc" }}>none</span>
      ) : (
        items.map((it, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              margin: "2px 4px 2px 0",
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 12,
              fontFamily: mono ? "ui-monospace, monospace" : "inherit",
              background: muted ? "#f0eeec" : ACCENT_SOFT,
              color: muted ? "#999" : ACCENT,
              border: muted ? "1px dashed #ccc" : "none",
            }}
          >
            {it}
          </span>
        ))
      )}
    </div>
  );
}

function ZfaLink({ id }: { id: string }) {
  if (id.startsWith("ZFA:"))
    return (
      <a
        href={`https://www.ebi.ac.uk/ols4/ontologies/zfa/classes?obo_id=${id}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: ACCENT, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
      >
        {id}
      </a>
    );
  return <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{id}</span>;
}

function GoLink({ id }: { id: string }) {
  return (
    <a
      href={`https://www.ebi.ac.uk/QuickGO/term/${id}`}
      target="_blank"
      rel="noreferrer"
      style={{ color: ACCENT, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
    >
      {id}
    </a>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#999",
        margin: "0 0 7px",
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function JudgeBtn({
  children,
  onClick,
  active,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: `1.5px solid ${color}`,
        background: active ? color : "#fffdfb",
        color: active ? "#fff" : color,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 12px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: "#999",
        borderBottom: "1px solid #ece8e3",
        fontWeight: 600,
        background: "#faf8f6",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "7px 12px",
        fontSize: 13,
        borderBottom: "1px solid #f3f0ec",
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        color: muted ? "#999" : INK,
      }}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// shared style objects
// ---------------------------------------------------------------------------
const card: React.CSSProperties = {
  border: "1px solid #e5e1dc",
  borderRadius: 10,
  background: "#fffdfb",
  padding: "12px 14px",
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };

const btnPrimary: React.CSSProperties = {
  background: ACCENT,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #d8d3cd",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  color: INK,
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "#777",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d8d3cd",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
};
