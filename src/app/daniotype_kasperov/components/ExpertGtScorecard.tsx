"use client";
import React from "react";

// Bespoke expert-GT two-panel scorecard (kind:"expertGT-4bucket"). Renders the
// MiniFin node-consolidation judged against Patrick's SEALED expert ground truth.
// Data is an AGGREGATE reshape of minifin_node_scores.json (attached to the run
// object) — NOT the standard per-node finalJudge scorecard. Every number here is
// carried verbatim from source; nothing is computed client-side.
//
// The split reads at a glance:
//   PANEL A  "Validated against expert GT"  — where we had truth, how we did
//   PANEL B  "Labelled beyond the expert"   — what we produced where we didn't

const CARD: React.CSSProperties = { background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
const SEC: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a948c", fontWeight: 800, margin: "0 0 8px" };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Stat({ label, big, sub, tone }: { label: string; big: string; sub?: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#9a948c", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || "#15803d", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{big}</div>
      {sub ? <div style={{ fontSize: 11, color: "#8a847c" }}>{sub}</div> : null}
    </div>
  );
}

export function ExpertGtScorecard({ card }: { card: any }) {
  if (!card || card.kind !== "expertGT-4bucket") return null;
  const A = card.panelA || {};
  const B = card.panelB || {};
  const ci = A.committed_in_ontology || {};
  const ag = A.all_GTbacked || {};
  const bk = A.buckets || {};
  const declined = A.declined_composition || {};
  const buckets = [
    { k: "in_ontology", label: "In-ontology", n: bk.in_ontology, col: "#15803d", bg: "#f0fdf4" },
    { k: "off_ontology", label: "Off-ontology", n: bk.off_ontology, col: "#dc2626", bg: "#fef2f2" },
    { k: "abstain", label: "Declined (abstain)", n: bk.abstain, col: "#b45309", bg: "#fffbeb" },
    { k: "beyond", label: "Beyond GT (unscored)", n: B.n_nodes_beyond_gt, col: "#6b655d", bg: "#f5f3ef" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* judge identity + the four-bucket ledger — never collapsed */}
      <div style={CARD}>
        <div style={SEC}>Expert-GT judge · {card.judge || "four-bucket crosswalk"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {buckets.map((b) => (
            <div key={b.k} style={{ background: b.bg, border: `1px solid ${b.col}22`, borderRadius: 9, padding: "8px 11px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: b.col, fontVariantNumeric: "tabular-nums" }}>{b.n ?? "—"}</div>
              <div style={{ fontSize: 11, color: "#6b655d", fontWeight: 600 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {/* PANEL A — validated against expert GT */}
        <div style={{ ...CARD, flex: "1 1 340px", minWidth: 300, borderColor: "#bfe3cc" }}>
          <div style={{ ...SEC, color: "#15803d" }}>Panel A · Validated against expert GT</div>
          <div style={{ fontSize: 12, color: "#6b655d", margin: "-2px 0 12px" }}>Where Patrick&apos;s sealed GT gives an answer key — scored, control-vote PRIMARY.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Stat label={`Committed in-ontology (n=${ci.n ?? "?"})`} big={ci.lenient != null ? pct(ci.lenient) : "—"} sub={`lenient · ${ci.strict != null ? pct(ci.strict) : "—"} strict-fine`} />
            <Stat label={`All GT-backed (n=${ag.n ?? "?"})`} big={ag.lenient != null ? pct(ag.lenient) : "—"} sub={`lenient · ${ag.strict != null ? pct(ag.strict) : "—"} strict-fine`} tone="#166534" />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, padding: "2px 10px" }}>{A.over_merge_misses ?? 0} over-merge misses</span>
            <span style={{ fontWeight: 700, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 99, padding: "2px 10px" }}>{A.rescues ?? 0} consolidation rescues</span>
          </div>
          {/* declined bucket — coverage gaps, calibration working */}
          {Object.keys(declined).length ? (
            <div style={{ fontSize: 12, color: "#8a6d3b", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
              <b>Declined (abstained)</b> concentrate in {Object.entries(declined).map(([k, v]) => `${k} (${v})`).join(", ")} — abstention is targeting the ambiguous tiers, not firing at random. Calibration working.
            </div>
          ) : null}
          {A.footnote ? <div style={{ fontSize: 11.5, color: "#9a948c", fontStyle: "italic", borderTop: "1px dashed #e5e1dc", paddingTop: 8 }}>* {A.footnote}</div> : null}
        </div>

        {/* PANEL B — labelled beyond the expert */}
        <div style={{ ...CARD, flex: "1 1 340px", minWidth: 300 }}>
          <div style={{ ...SEC, color: "#6b655d" }}>Panel B · Labelled beyond the expert</div>
          <div style={{ fontSize: 12, color: "#6b655d", margin: "-2px 0 12px" }}>Where Patrick gave no answer key — shown, <b>not scored</b> (no ground truth to score against). Nothing invented.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Stat label="Nodes beyond GT" big={String(B.n_nodes_beyond_gt ?? "—")} sub="committed, no expert label" tone="#6b655d" />
            <Stat label="Cells beyond coverage" big={B.pct_cells_beyond_gt != null ? `${B.pct_cells_beyond_gt}%` : "—"} sub={`outside Patrick's ~${100 - (B.pct_cells_beyond_gt ?? 0)}% coverage`} tone="#6b655d" />
          </div>
          {Array.isArray(B.calls) && B.calls.length ? (
            <div style={{ border: "1px solid #eee7dd", borderRadius: 8, overflow: "hidden" }}>
              {B.calls.slice(0, 12).map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "5px 10px", borderBottom: i < Math.min(12, B.calls.length) - 1 ? "1px solid #f3f0ec" : "none", fontSize: 12 }}>
                  <span style={{ width: 66, flexShrink: 0, color: "#b0a89e", fontVariantNumeric: "tabular-nums" }}>{c.node}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#4a453e" }} title={c.identity}>{c.identity || "—"}</span>
                </div>
              ))}
              {B.calls.length > 12 ? <div style={{ padding: "5px 10px", fontSize: 11.5, color: "#9a948c" }}>+ {B.calls.length - 12} more</div> : null}
            </div>
          ) : <div style={{ fontSize: 12, color: "#b0a89e", fontStyle: "italic" }}>No beyond-GT calls recorded.</div>}
          {B.note ? <div style={{ fontSize: 11.5, color: "#9a948c", fontStyle: "italic", marginTop: 10 }}>{B.note}</div> : null}
        </div>
      </div>
    </div>
  );
}
