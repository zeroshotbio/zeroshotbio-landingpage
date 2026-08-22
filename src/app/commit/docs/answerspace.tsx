// §05 — what the menu is made of.
//
// The bar survives from the old figure because it says something a list cannot: that the branch a
// term sits in is lopsided, and that most of the menu is not cell types. Everything around it went
// — the figure caption block, the card wrapper, the legend swatches, the bordered breakdown strip.
// Prose, one bar, one list.
//
// Colour still follows the dataviz method: three identities in fixed order from the validated
// palette, each segment direct-labelled and named again in the list beneath, so identity is never
// carried by colour alone.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, CAT, nfmt } from "../theme";
import MENU from "../data/zfa_menu_preview.json";

const prose: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 700 };

export default function AnswerSpaceSection() {
  const branches = (MENU as any).branches;
  const total = (MENU as any).n_terms as number;
  const sub = branches.anatomical_structure.breakdown as Record<string, number>;

  const segs = [
    { key: "cell", label: "cell", n: branches.cell.n, color: CAT[0],
      note: "Terms naming a cell type." },
    { key: "anatomical_structure", label: "anatomical structure", n: branches.anatomical_structure.n, color: CAT[1],
      note: `Tissue, multi-tissue structure and organ together — ${Object.entries(sub).map(([k, v]) => `${k.replace(/_/g, " ")} ${nfmt(v)}`).join(", ")}.` },
    { key: "neither", label: "neither", n: branches.neither.n, color: CAT[2],
      note: "Terms above the CARO roots, belonging to neither branch. Where an over-broad answer tends to land." },
  ];

  const W = 720, H = 40;
  let x = 0;
  const placed = segs.map((s) => {
    const w = (s.n / total) * W;
    const seg = { ...s, x, w };
    x += w;
    return seg;
  });

  return (
    <>
      <p style={{ ...prose, margin: "0 0 15px" }}>
        Every answer, yours and the key&apos;s, is one of {nfmt(total)} terms. They are not evenly
        distributed across the ontology: roughly one term in five names a cell type, and the rest
        name structures or sit above the CARO roots entirely.
      </p>
      <p style={{ ...prose, margin: 0 }}>
        That imbalance is worth knowing before you start, because it is what makes the two answer
        axes separable — the cell-type axis draws from one branch, the anatomical axis from another.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label={`Composition of the ${total}-term menu: ${segs.map((s) => `${s.label} ${s.n}`).join(", ")}`}
           style={{ display: "block", marginTop: 26, maxWidth: 760 }}>
        {placed.map((s) => (
          <g key={s.key}>
            {/* 2px surface gap between segments */}
            <rect x={s.x + 1} y={0} width={Math.max(0, s.w - 2)} height={H} rx={3} ry={3} fill={s.color}>
              <title>{`${s.label} — ${nfmt(s.n)} terms (${((s.n / total) * 100).toFixed(1)}%)`}</title>
            </rect>
            {s.w > 92 && (
              <text x={s.x + 12} y={H / 2 + 4.5}
                    style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, fill: "#fff",
                             fontVariantNumeric: "tabular-nums" }}>
                {nfmt(s.n)}
              </text>
            )}
          </g>
        ))}
      </svg>

      <dl style={{ margin: "22px 0 0", maxWidth: 760 }}>
        {placed.map((s, i) => (
          <div key={s.key} style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap",
                                    padding: "11px 0",
                                    borderTop: i === 0 ? `1px solid ${RULE}` : "1px solid #f2efeb" }}>
            <dt style={{ display: "flex", gap: 9, alignItems: "baseline", flex: "0 0 210px", minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 650, color: INK }}>{s.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>
                {nfmt(s.n)} · {((s.n / total) * 100).toFixed(1)}%
              </span>
            </dt>
            <dd style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.6,
                         flex: "1 1 320px", minWidth: 0 }}>
              {s.note}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
