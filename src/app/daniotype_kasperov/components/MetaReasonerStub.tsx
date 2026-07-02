"use client";
// MetaReasonerStub — Phase 1 STUB. Full-screen takeover fired at each compartment
// boundary of the autopilot sweep. It assembles a READ-ONLY ledger from run state
// and offers a single "Continue →" that resumes the sweep into the next compartment.
// NO reasoning, NO descend/consolidate decisions, NO LLM call — Phase 2 adds the brain.
import React from "react";
import type { Cluster, ClusterConf } from "../types";
import { overallConf } from "../types";
import { ACCENT } from "../theme";
import { CompartmentMap } from "./CompartmentMap";
import { ledgerFromLive } from "../../meta_reasoner/brain";
import { MetaReasonerBrainPanel, type BrainResult } from "../../meta_reasoner/components/MetaReasonerBrainPanel";

type CompRow = {
  index: number;
  label: string;
  total: number;
  labelled: number;
  abstained: number;
  remaining: number;
  status: "done" | "next" | "pending";
  avgConf: number | null;
};

export function MetaReasonerStub({
  justFinished,
  nextUp,
  clusters,
  labels,
  confidence,
  onContinue,
  model,
  priorDescentAttempts,
  onDecision,
}: {
  justFinished: number; // compartmentIndex just completed (1-based)
  nextUp: number | null; // next compartmentIndex to resume into
  clusters: Cluster[];
  labels: Record<string, string>;
  confidence: Record<string, ClusterConf>;
  onContinue: () => void;
  // ⚖️🧠 Phase 2: run the boundary brain over a GT-blind ledger; the decision is
  // emitted + logged, it does NOT steer the sweep queue this phase. All optional so
  // Phase-1 callers keep working unchanged.
  model?: string;
  priorDescentAttempts?: Record<string, number>;
  onDecision?: (r: BrainResult) => void;
}) {
  const brainLedger = React.useMemo(
    () => ledgerFromLive({ clusters, labels, confidence, justFinished, nextUp, overallConf }),
    [clusters, labels, confidence, justFinished, nextUp],
  );
  // --- assemble the ledger (pure read-only aggregation of run state) ---
  const byComp = new Map<number, Cluster[]>();
  for (const c of clusters) {
    if (typeof c.compartmentIndex !== "number") continue;
    if (!byComp.has(c.compartmentIndex)) byComp.set(c.compartmentIndex, []);
    byComp.get(c.compartmentIndex)!.push(c);
  }
  const indices = Array.from(byComp.keys()).sort((a, b) => a - b);
  const isAbstain = (lab: string) => /abstain/i.test(lab || "");

  const rows: CompRow[] = indices.map((idx) => {
    const arr = byComp.get(idx)!;
    const labelledArr = arr.filter((c) => labels[c.id]);
    const abst = labelledArr.filter((c) => isAbstain(labels[c.id]));
    const confs = arr.map((c) => overallConf(confidence[c.id])).filter((x): x is number => typeof x === "number");
    return {
      index: idx,
      label: arr[0]?.compartmentLabel?.split(" · ")[0] ?? `Compartment ${idx}`,
      total: arr.length,
      labelled: labelledArr.length,
      abstained: abst.length,
      remaining: arr.length - labelledArr.length,
      status: idx <= justFinished ? "done" : idx === nextUp ? "next" : "pending",
      avgConf: confs.length ? Math.round(confs.reduce((s, x) => s + x, 0) / confs.length) : null,
    };
  });

  const doneComps = rows.filter((r) => r.status === "done").length;
  const totalLeaves = rows.reduce((s, r) => s + r.total, 0);
  const totalLabelled = rows.reduce((s, r) => s + r.labelled, 0);
  const totalAbstained = rows.reduce((s, r) => s + r.abstained, 0);

  // confidence distribution across everything labelled so far
  const allConfs = clusters
    .filter((c) => labels[c.id])
    .map((c) => overallConf(confidence[c.id]))
    .filter((x): x is number => typeof x === "number");
  const buckets = [
    { name: "high ≥75", n: allConfs.filter((x) => x >= 75).length, color: "#15803d" },
    { name: "med 50–74", n: allConfs.filter((x) => x >= 50 && x < 75).length, color: "#a16207" },
    { name: "low <50", n: allConfs.filter((x) => x < 50).length, color: "#b91c1c" },
  ];

  const chip = (bg: string, fg: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: fg, borderRadius: 99, padding: "3px 11px", fontSize: 12, fontWeight: 800 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,16,12,0.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(920px, 96vw)", maxHeight: "92vh", overflow: "auto", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,.35)", padding: "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={chip("#f3e8ff", "#7c3aed")}>🧠 META-REASONER · Phase 1 stub</span>
          <span style={{ fontSize: 11.5, color: "#9a938a", fontWeight: 700 }}>no reasoning yet — boundary checkpoint only</span>
        </div>
        <h2 style={{ fontSize: 23, fontWeight: 800, margin: "12px 0 2px" }}>Compartment {justFinished} complete</h2>
        <p style={{ color: "#6b6b6b", fontSize: 14, margin: "0 0 16px", lineHeight: 1.5 }}>
          The sweep paused at a <b>hierarchy boundary</b>. Below is the running ledger. In Phase 2 this screen will decide which
          remaining compartments to descend into vs. leave consolidated — for now it just resumes.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span style={chip("#eef2ff", "#4338ca")}>{doneComps}/{rows.length} compartments done</span>
          <span style={chip("#dcfce7", "#15803d")}>{totalLabelled}/{totalLeaves} leaves labelled</span>
          <span style={chip("#fffbeb", "#a16207")}>{totalAbstained} abstained</span>
          {buckets.map((b) => (
            <span key={b.name} style={chip("#f5f3f0", b.color)}>{b.name}: {b.n}</span>
          ))}
        </div>

        {/* compartment islands — spotlight the just-finished (✓) + next-up (→) compartments */}
        <div style={{ border: "1px solid #e5e1dc", borderRadius: 12, background: "#fffdfb", padding: 8, marginBottom: 14, overflow: "auto" }}>
          <CompartmentMap
            clusters={clusters}
            activeId={null}
            validated={new Set(clusters.filter((c) => labels[c.id]).map((c) => c.id))}
            width={Math.min(852, (typeof window !== "undefined" ? window.innerWidth : 900) - 96)}
            height={300}
            dimUnfocused
            focusCompartments={[justFinished, ...(nextUp != null ? [nextUp] : [])]}
            nextCompartment={nextUp}
            doneThrough={justFinished}
          />
        </div>

        <div style={{ border: "1px solid #e5e1dc", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f3f0ec", color: "#555", textAlign: "left" }}>
                {["Compartment", "Status", "Leaves", "Labelled", "Abstained", "Remaining", "Avg conf"].map((h) => (
                  <th key={h} style={{ padding: "7px 10px", fontWeight: 700, borderBottom: "1px solid #e5e1dc" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index} style={{ background: r.status === "done" ? "#fbfffb" : r.status === "next" ? "#faf5ff" : "#fff" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700 }}>{r.label}</td>
                  <td style={{ padding: "6px 10px" }}>
                    {r.status === "done" ? <span style={{ color: "#15803d", fontWeight: 700 }}>✓ done</span>
                      : r.status === "next" ? <span style={{ color: "#7c3aed", fontWeight: 700 }}>→ next</span>
                      : <span style={{ color: "#9a938a" }}>pending</span>}
                  </td>
                  <td style={{ padding: "6px 10px" }}>{r.total}</td>
                  <td style={{ padding: "6px 10px" }}>{r.labelled}</td>
                  <td style={{ padding: "6px 10px" }}>{r.abstained}</td>
                  <td style={{ padding: "6px 10px" }}>{r.remaining}</td>
                  <td style={{ padding: "6px 10px" }}>{r.avgConf == null ? "—" : `${r.avgConf}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PHASE 2: the brain reasons over the ledger + rules + priors and emits a
            decision. Emitted + logged this phase; it does NOT prune the queue yet.
            The human still confirms via Continue below (watch before it drives). */}
        <div style={{ marginBottom: 16 }}>
          <MetaReasonerBrainPanel ledger={brainLedger} priorDescentAttempts={priorDescentAttempts} model={model} onResult={onDecision} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onContinue} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
            Continue →{nextUp != null ? ` (resume into Compartment ${nextUp})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
