// Shared building blocks for /commit's file views.
//
// These moved out of the old input→output figure when the input half was folded into §01. The
// field boxes, the window chrome and the matrix corner all describe FILES, so they live with the
// file windows now; the output figure keeps only what describes an answer.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, nfmt } from "./theme";
import FEATURES from "./data/gold_features_preview.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

export const EXAMPLE_CLUSTER = "C004";
const WINDOW = (H5AD as any).matrix_window ?? null;

// ── column copy ────────────────────────────────────────────────────────────
// What each column IS, in plain English. The reading on `family` is the one documented in the
// row's own merging SPEC; nothing here claims how the columns were computed.
export const GF_FIELDS: { col: string; blurb: string }[] = [
  { col: "cluster_id", blurb: "The opaque handle for the cluster — C001 through C112, in order. No ordering meaning, no hint." },
  { col: "n_cells", blurb: "How many cells the cluster holds, and so how much evidence stands behind its row." },
  { col: "n_cells_used", blurb: "How many of those cells the marker ranking was actually computed over." },
  { col: "top_50_markers", blurb: "DEGs up-expressed here more than anywhere else in the set — the cluster's positive signature." },
  { col: "bottom_50_markers", blurb: "DEGs down-expressed here relative to the rest of the set. Absence used as evidence: what a cluster conspicuously lacks narrows it as much as what it has." },
  { col: "family_50_markers", blurb: "The same ranking recomputed against a contrast group of related clusters rather than against the whole set." },
  { col: "mean_umi", blurb: "Average transcript molecules counted per cell. Sequencing depth — low means less evidence per cell." },
  { col: "mean_genes_expressed", blurb: "Average distinct genes detected per cell. Library complexity, separating rich cells from sparse ones." },
  { col: "pct_mitochondrial", blurb: "Share of counts from mitochondrial genes. A stress and viability signal; elevated values often mark dying cells." },
];

export const MENU_FIELDS: { col: string; blurb: string }[] = [
  { col: "id", blurb: "The ZFA identifier you actually submit. An answer is this string; a term that is not on the menu is not an answer." },
  { col: "name", blurb: "The anatomy term the identifier stands for. Scoring reads the identifier, so a synonym is never punished for being one." },
  { col: "caro", blurb: "Which branch the term sits in — cell, anatomical structure, or above the roots. This is what makes the two answer axes separable." },
  { col: "n_synonyms", blurb: "How many alternative names the ontology records for the term." },
];

// A field WITHIN a file — neutral, so it never competes with the file above it.
export function ColName({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK,
      background: "#f4f2ef", border: `1px solid ${RULE}`, borderRadius: 4,
      padding: "2px 7px", whiteSpace: "nowrap",
    }}>
      {children}
    </code>
  );
}

// A row of fields, each in its own small box. Used where a file groups columns that belong
// together — the three ranked lists, the three QC statistics, the menu's three term fields — so
// the grouping is visible instead of implied by reading order.
export function FieldRow({ items, min = 190 }: { items: { col: string; blurb: string }[]; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
                  gap: 9, marginBottom: 12 }}>
      {items.map((f) => (
        <div key={f.col} style={{ background: "#faf8f5", border: `1px solid ${RULE}`, borderRadius: 8,
                                  padding: "11px 12px" }}>
          <ColName>{f.col}</ColName>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, marginTop: 7 }}>{f.blurb}</div>
        </div>
      ))}
    </div>
  );
}

export function FileWindow({ cols, rows, elided, footer, elideLabel = "..." }: {
  cols: string[];
  rows: (React.ReactNode[] | null)[];   // null marks the elision row
  elided: number;
  footer: string;
  elideLabel?: string;
}) {
  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ border: `1px solid ${RULE}`, borderRadius: 8, overflow: "hidden", background: "#fdfcfb" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} title={c}
                      style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: MUTED, textAlign: "left",
                               padding: "7px 9px", borderBottom: `1px solid ${RULE}`, whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) =>
                r === null ? (
                  // The elision is a ROW of the file, not a banner across it: the marker sits in
                  // the identifier column, exactly where the omitted ids would be.
                  <tr key={`gap-${i}`} title={`${nfmt(elided)} rows not shown`}>
                    {cols.map((c, j) => (
                      <td key={c}
                          style={{ fontFamily: MONO, fontSize: 11, color: FAINT, padding: "5px 9px",
                                   borderTop: "1px solid #f2efeb", letterSpacing: 1 }}>
                        {j === 0 ? elideLabel : ""}
                      </td>
                    ))}
                  </tr>
                ) : (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={cols[j]}
                          style={{ fontFamily: MONO, fontSize: 10, color: INK, padding: "5px 9px",
                                   borderTop: i === 0 ? "none" : "1px solid #f2efeb",
                                   whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* the file's extent is a fact ABOUT the table, so it sits outside it */}
      <div style={{ fontFamily: MONO, fontSize: 9, color: FAINT, marginTop: 7, lineHeight: 1.5 }}>
        {footer}
      </div>
    </div>
  );
}

// gold_features.csv — every shipped column, so the window shows the file's real organisation.
// Gene lists are cut to their first genes with the remainder counted, because a 50-gene cell would
// be the only thing on screen.
export function GoldFeaturesRows() {
  const w = (FEATURES as any).window;
  if (!w) return null;
  // An empty marker cell is a real property of the file (C003 has no depleted list), so it gets an
  // explicit em dash — a blank td reads as a rendering fault rather than as data.
  const cell = (c: any) => {
    if (c.text === "" ) return <span style={{ color: FAINT }}>—</span>;
    return c.more
      ? <>{c.text}<span style={{ color: FAINT }}>;…+{c.more}</span></>
      : <>{c.text}</>;
  };
  const mk = (r: any) => w.columns.map((c: string) => cell(r[c]));
  return (
    <FileWindow
      cols={w.columns}
      rows={[...w.head.map(mk), null, ...w.tail.map(mk)]}
      elided={w.elided_rows}
      footer={`${nfmt(w.total_rows)} rows × ${w.total_columns} columns · gene lists cut to the first ${w.genes_shown}, all 50 ship`}
    />
  );
}

// zfa_menu.v1.json — the terms array, in file order.
export function ZfaMenuRows() {
  const w = (MENU as any).window;
  if (!w) return null;
  const mk = (t: any) => [t.id, t.name, t.caro.replace(/_/g, " "), String(t.n_synonyms ?? "")];
  return (
    <FileWindow
      cols={w.fields}
      rows={[...w.head.map(mk), null, ...w.tail.map(mk)]}
      elided={w.elided_rows}
      footer={`${nfmt(w.total_rows)} terms · ${w.order}`}
    />
  );
}

// ── the 5x5 matrix corner ──────────────────────────────────────────────────
// A real slice, not a mock: the first five cells of the worked cluster against that cluster's own
// top five markers, as raw integer counts. Zeros stay muted so the sparsity is the visible fact.
export function MatrixWindow() {
  if (!WINDOW) return null;
  const { genes, cells, values } = WINDOW as { genes: string[]; cells: string[]; values: number[][] };
  const cellW = 42;

  return (
    <div style={{ marginTop: 10, display: "inline-block", border: `1px solid ${RULE}`, borderRadius: 8, overflow: "hidden", background: "#fdfcfb" }}>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ padding: "6px 8px", borderBottom: `1px solid ${RULE}`, borderRight: `1px solid ${RULE}` }} />
            {genes.map((g) => (
              <th key={g} title={g}
                  style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: MUTED, textAlign: "center",
                           padding: "6px 4px", borderBottom: `1px solid ${RULE}`, width: cellW, maxWidth: cellW,
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, i) => (
            <tr key={cells[i]}>
              <td title={cells[i]}
                  style={{ fontFamily: MONO, fontSize: 8.5, color: FAINT, padding: "4px 8px",
                           borderRight: `1px solid ${RULE}`, whiteSpace: "nowrap" }}>
                {cells[i].slice(0, 7)}…
              </td>
              {row.map((v, j) => (
                <td key={genes[j]}
                    style={{ fontFamily: MONO, fontSize: 11, textAlign: "center", padding: "4px 0",
                             fontVariantNumeric: "tabular-nums",
                             color: v === 0 ? "#d9d3cc" : INK, fontWeight: v === 0 ? 400 : 700,
                             background: v === 0 ? "transparent" : "#eef6f8" }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
