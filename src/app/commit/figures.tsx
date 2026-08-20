// The two figures on /commit. Both are server-rendered inline SVG — no chart library, no client
// JS. Hover detail rides on native <title> elements, which gives every mark a tooltip without
// making the page a client component.
//
// Colour follows the dataviz method: the composition bar is CATEGORICAL (three identities, fixed
// order, validated palette in theme.ts); the histogram is a SINGLE series, so it takes one hue and
// carries no legend — its title names it.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, CAT, SERIES, nfmt } from "./theme";
import DIST from "./data/cluster_size_distribution.json";
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

// ── figure 1 — cluster size distribution ───────────────────────────────────
// Log-spaced bins. Sizes span 55 → 17,491 with a median of 688, so linear bins would put ~100 of
// the 112 clusters in one column and say nothing. Counts stay on a linear axis from zero — the
// bars still encode magnitude honestly; only the bin EDGES are log.
const BIN_EDGES = [50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];

export function ClusterSizeFigure() {
  const sizes: number[] = (DIST as any).sizes_sorted_desc;
  const stats = (DIST as any).stats;

  const bins = BIN_EDGES.slice(0, -1).map((lo, i) => {
    const hi = BIN_EDGES[i + 1];
    const count = sizes.filter((s) => s >= lo && s < hi).length;
    return { lo, hi, count };
  });
  const maxCount = Math.max(...bins.map((b) => b.count));

  // geometry
  const W = 720, H = 250;
  const padL = 34, padR = 12, padT = 16, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const bw = plotW / bins.length;
  const yOf = (c: number) => padT + plotH - (c / maxCount) * plotH;

  const ticks = [0, Math.round(maxCount / 2), maxCount];
  const kfmt = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));

  return (
    <Figure
      n="Figure 1"
      title="Cluster sizes are steeply skewed"
      subtitle="112 clusters, binned by cell count. Bin edges double; counts are linear from zero."
      note={`Every cluster clears the 50-cell floor. Half sit under ${nfmt(stats.median)} cells, and the largest holds ${nfmt(stats.max)} — 318× the smallest. A method tuned on the big clusters will still be wrong about most of the set.`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label={`Histogram of cluster sizes across 112 clusters, from ${stats.min} to ${stats.max} cells`}
           style={{ display: "block", overflow: "visible" }}>
        {/* recessive gridlines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} stroke={RULE} strokeWidth={1} />
            <text x={padL - 8} y={yOf(t) + 3.5} textAnchor="end"
                  style={{ fontFamily: MONO, fontSize: 9.5, fill: FAINT }}>{t}</text>
          </g>
        ))}

        {bins.map((b, i) => {
          const h = (b.count / maxCount) * plotH;
          const x = padL + i * bw + 1;      // +1/-2 = the 2px surface gap between adjacent bars
          const w = bw - 2;
          return (
            <g key={b.lo}>
              {b.count > 0 && (
                <rect x={x} y={yOf(b.count)} width={w} height={h} rx={4} ry={4} fill={SERIES}>
                  <title>{`${nfmt(b.lo)}–${nfmt(b.hi - 1)} cells — ${b.count} cluster${b.count === 1 ? "" : "s"}`}</title>
                </rect>
              )}
              {/* square off the baseline end: the 4px radius belongs to the data end only */}
              {b.count > 0 && h > 4 && (
                <rect x={x} y={yOf(b.count) + h - 4} width={w} height={4} fill={SERIES} />
              )}
              {b.count > 0 && (
                <text x={x + w / 2} y={yOf(b.count) - 6} textAnchor="middle"
                      style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, fill: INK }}>
                  {b.count}
                </text>
              )}
              <text x={x + w / 2} y={padT + plotH + 15} textAnchor="middle"
                    style={{ fontFamily: MONO, fontSize: 9, fill: MUTED }}>
                {kfmt(b.lo)}
              </text>
            </g>
          );
        })}

        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="#d8d3cd" strokeWidth={1} />
        <text x={padL} y={H - 12} style={{ fontFamily: MONO, fontSize: 9, fill: FAINT }}>
          CELLS PER CLUSTER (BIN LOWER EDGE)
        </text>
        <text x={padL - 8} y={padT - 5} textAnchor="end" style={{ fontFamily: MONO, fontSize: 9, fill: FAINT }}>
          n
        </text>
      </svg>

      {/* the five-number summary, as a table view of the same data */}
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
        {[
          ["min", nfmt(stats.min)], ["p25", nfmt(stats.p25)], ["median", nfmt(stats.median)],
          ["p75", nfmt(stats.p75)], ["max", nfmt(stats.max)], ["total cells", nfmt((DIST as any).total_cells)],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </Figure>
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
      n="Figure 2"
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
