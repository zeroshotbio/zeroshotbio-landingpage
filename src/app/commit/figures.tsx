// The menu composition bar, in the reference's §05. Server-rendered inline SVG — no chart library,
// no client JS; hover detail rides on native <title> elements.
//
// Colour follows the dataviz method: three identities in fixed order from the validated palette in
// theme.ts, a legend always present, and every segment direct-labelled so identity is never
// carried by colour alone.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, CAT, nfmt } from "./theme";
import MENU from "./data/zfa_menu_preview.json";

// ── shared figure chrome ───────────────────────────────────────────────────
function Figure({
  n, title, subtitle, children, note,
}: {
  n: string; title: string; subtitle: string; children: React.ReactNode; note?: string;
}) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED }}>
          {n}
        </div>
        <div style={{ fontSize: 15, fontWeight: 650, color: INK, marginTop: 5, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>
      </figcaption>
      {children}
      {note && (
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 12, lineHeight: 1.55 }}>{note}</div>
      )}
    </figure>
  );
}

// ── figure 2 — ZFA menu branch composition ─────────────────────────────────
export function MenuCompositionFigure() {
  const branches = (MENU as any).branches;
  const total = (MENU as any).n_terms as number;

  const segs = [
    { key: "cell", label: "cell", n: branches.cell.n, color: CAT[0],
      note: "terms naming a cell type" },
    { key: "anatomical_structure", label: "anatomical structure", n: branches.anatomical_structure.n, color: CAT[1],
      note: "tissue · multi-tissue structure · organ" },
    { key: "neither", label: "neither", n: branches.neither.n, color: CAT[2],
      note: "above the CARO roots" },
  ];

  const W = 720, BAR_H = 46;
  let x = 0;
  const placed = segs.map((s) => {
    const w = (s.n / total) * W;
    const seg = { ...s, x, w };
    x += w;
    return seg;
  });

  const sub = branches.anatomical_structure.breakdown as Record<string, number>;

  return (
    <Figure
      n="Figure"
      title="The answer space, by branch"
      subtitle={`All ${nfmt(total)} selectable ZFA terms, split by CARO stratum. Every answer — yours and the key's — is one of these.`}
      note="Roughly one term in five names a cell type. The rest name structures, or sit above the CARO roots entirely, which is where an over-broad answer tends to land."
    >
      <svg viewBox={`0 0 ${W} ${BAR_H}`} width="100%" role="img"
           aria-label={`Composition of the ${total}-term ZFA menu: ${segs.map((s) => `${s.label} ${s.n}`).join(", ")}`}
           style={{ display: "block" }}>
        {placed.map((s) => (
          <g key={s.key}>
            {/* 2px surface gap between segments */}
            <rect x={s.x + 1} y={0} width={Math.max(0, s.w - 2)} height={BAR_H} rx={3} ry={3} fill={s.color}>
              <title>{`${s.label} — ${nfmt(s.n)} terms (${((s.n / total) * 100).toFixed(1)}%)`}</title>
            </rect>
            {s.w > 96 && (
              <text x={s.x + 13} y={BAR_H / 2 + 4.5}
                    style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, fill: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {nfmt(s.n)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* legend — always present for >= 2 series, and direct-labelled */}
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginTop: 14 }}>
        {placed.map((s) => (
          <div key={s.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0, marginTop: 3 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: INK }}>
                {s.label}{" "}
                <span style={{ fontFamily: MONO, color: MUTED, fontWeight: 600 }}>
                  {nfmt(s.n)} · {((s.n / total) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 1 }}>{s.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, marginBottom: 7 }}>
          anatomical structure, broken out
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          {Object.entries(sub).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, color: MUTED }}>
              {k.replace(/_/g, " ")}{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{nfmt(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </Figure>
  );
}
