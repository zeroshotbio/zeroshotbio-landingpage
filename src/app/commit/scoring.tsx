// How it is scored — the page's centre of gravity now that the framing prose has collapsed into a
// disclosure under the masthead.
//
// Three things have to land: scoring reads IDENTIFIERS on the ontology graph rather than strings;
// credit is ASYMMETRIC, so being too specific and being too broad are different errors; and two
// judges run, one of which is not finalised. The diagram carries the first two, because the
// asymmetry is a fact about position in a tree and prose makes a meal of it.
//
// The worked term and its real ancestor chain come from the bundle, so the diagram is drawn on the
// same ontology fragment the output panel already showed rather than an invented one.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, PANEL, PANEL_BD, card } from "./theme";
import MENU from "./data/zfa_menu_preview.json";

const ANSWER = (MENU as any).example_answer ?? null;

// Outcome colours are STATUS, not categorical: they never carry identity alone — every one ships
// with its word ("full", "half", "zero") and an explicit position in the diagram.
const FULL = "#3f6b55";
const HALF = "#a16207";
const ZERO = "#9a3b3b";

const TIERS = [
  { key: "full", color: FULL, rule: "your term is a cell type sitting under the key's region",
    detail: "The evidence carried you further down the tree than the key went. Going deeper than the key is not penalised — a correct specific answer is still correct." },
  { key: "half", color: HALF, rule: "you name the region, the key names a cell type",
    detail: "Right neighbourhood, stopped short. This is the error the benchmark exists to catch: upward compression buys safety, so it has to cost something." },
  { key: "zero", color: ZERO, rule: "anything else",
    detail: "Siblings and over-broad answers are decided against gold label SETS rather than one string, so a defensible near-miss is judged against every acceptable answer, not just the printed one." },
];

// ── the asymmetry diagram ──────────────────────────────────────────────────
// A small ontology fragment: the key's term sits mid-tree; three candidate answers sit above it,
// under it, and beside it. Position IS the argument — the same distance in the tree scores
// differently depending on direction.
function AsymmetryDiagram() {
  const W = 660, H = 268;
  const cx = W / 2;

  const node = (x: number, y: number, w: number, label: string, sub: string,
                color: string, fill: string, strong = false) => (
    <g key={label + y}>
      <rect x={x - w / 2} y={y} width={w} height={38} rx={8}
            fill={fill} stroke={color} strokeWidth={strong ? 2 : 1.25} />
      <text x={x} y={y + 16} textAnchor="middle"
            style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6,
                     textTransform: "uppercase", fill: color }}>
        {sub}
      </text>
      <text x={x} y={y + 30} textAnchor="middle"
            style={{ fontSize: 11.5, fontWeight: strong ? 650 : 500, fill: INK }}>
        {label}
      </text>
    </g>
  );

  const edge = (x1: number, y1: number, x2: number, y2: number, dash = false) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8d3cd" strokeWidth={1.25}
          strokeDasharray={dash ? "3 3" : undefined} />
  );

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="An ontology fragment showing why credit is asymmetric: an answer below the key's term scores full, an answer above it scores half, an answer beside it scores zero."
           style={{ display: "block", overflow: "visible" }}>
        {/* spine */}
        {edge(cx, 46, cx, 104)}
        {edge(cx, 142, cx, 200)}
        {/* sibling branch */}
        {edge(cx, 123, cx + 170, 123, true)}
        {edge(cx + 170, 123, cx + 170, 200, true)}

        {node(cx, 8, 250, "a broader ancestor", "answer here → half", HALF, "#fdf8ec")}
        {node(cx, 104, 250, ANSWER?.term?.name ?? "the key's term", "the key", INK, "#f1efeb", true)}
        {node(cx, 200, 250, "a cell type beneath it", "answer here → full", FULL, "#f0f6f2")}
        {node(cx + 170, 200, 210, "a sibling elsewhere", "answer here → zero", ZERO, "#fbf1f1")}

        {/* direction annotations */}
        <text x={cx - 138} y={78} textAnchor="end"
              style={{ fontFamily: MONO, fontSize: 8.5, fill: FAINT }}>too broad</text>
        <text x={cx - 138} y={176} textAnchor="end"
              style={{ fontFamily: MONO, fontSize: 8.5, fill: FAINT }}>more specific</text>
      </svg>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
        The same one step, in two directions, is not the same answer. Down the tree you kept the
        key&apos;s meaning and added to it; up the tree you dropped part of what the key asserted.
        Only the second is a loss, so only the second is discounted.
      </div>
    </div>
  );
}

export default function ScoringSection() {
  return (
    <div>
      <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 660, marginBottom: 26 }}>
        <p style={{ margin: "0 0 17px" }}>
          Every answer is scored <strong>by identifier</strong>, against a key you never see. Both
          sides are resolved onto the anatomy ontology and compared as positions in a graph — not
          as text. A synonym is never punished for being a synonym, and a term spelled differently
          from the key is not wrong for that reason.
        </p>
        <p style={{ margin: 0 }}>
          Credit is <strong>asymmetric</strong>. Being too specific and being too broad are
          different mistakes, and the benchmark treats them differently on purpose.
        </p>
      </div>

      {/* the diagram */}
      <div style={{ ...card, padding: "24px 26px", marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                      textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
          why direction matters
        </div>
        <AsymmetryDiagram />
      </div>

      {/* the three outcomes */}
      <div style={{ background: PANEL, border: `1px solid ${PANEL_BD}`, borderRadius: 14,
                    padding: "20px 20px 8px", marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                      textTransform: "uppercase", color: MUTED, marginBottom: 14, paddingLeft: 2 }}>
          the three outcomes
        </div>
        {TIERS.map((t) => (
          <div key={t.key} style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                                    padding: "15px 17px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 13, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.9,
                             textTransform: "uppercase", color: t.color,
                             background: `${t.color}14`, border: `1px solid ${t.color}40`,
                             borderRadius: 999, padding: "3px 11px" }}>
                {t.key}
              </span>
              <span style={{ fontSize: 13.5, color: INK, fontWeight: 550 }}>{t.rule}</span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.6, paddingLeft: 2 }}>
              {t.detail}
            </div>
          </div>
        ))}
      </div>

      {/* the two judges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div style={{ ...card, padding: "19px 21px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        textTransform: "uppercase", color: ACCENT, marginBottom: 9 }}>
            judge A · ontology graph
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 600, marginBottom: 7 }}>
            Weighted distance on the ZFA graph
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Resolves your term and the key&apos;s term to ontology nodes and measures how far apart
            they sit. The fixed measuring stick — the same judge used across the other benchmark
            rows, so scores are comparable between them.
          </div>
        </div>

        <div style={{ ...card, padding: "19px 21px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        textTransform: "uppercase", color: MUTED, marginBottom: 9 }}>
            judge B · category rule
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 600, marginBottom: 7 }}>
            Full / half / zero, on region-vs-cell-type
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            The rule above, applied against gold label sets. Both judges render on the same
            answers, and neither is tuned to flatter the labeller.
          </div>
          <div style={{ fontSize: 11.5, color: FAINT, marginTop: 11, paddingTop: 11,
                        borderTop: `1px solid ${RULE}`, lineHeight: 1.55 }}>
            <strong style={{ color: MUTED }}>Not yet finalised.</strong> The shape of the credit is
            fixed and stated above; the exact weights, the region/cell-type membership test, and the
            sibling-set definitions are still to be published. They are deliberately not guessed
            here.
          </div>
        </div>
      </div>
    </div>
  );
}
