// The input→output figure: the files we hand to Commit, and the answer they must come back with.
//
// The glanceable version of the masthead subtitle — the shape of the task without reading §1. The
// middle is deliberately empty: what happens there is the contest.
//
// ORGANISED BY FILE, not by topic. Every section is led by the artefact that supplies it, because
// "what is actually delivered" is the thing this figure exists to answer. Two colour rules carry
// the hierarchy: a FILE wears rust and sits flush left with the section number; a COLUMN inside
// that file stays neutral ink and sits one step in. Content indents again past that, so the eye
// reads file → field → value as a waterfall.
//
// Every concrete value traces to src/app/commit/data/. If a field is missing the label renders
// without an example rather than inventing one — the 5x5 matrix corner simply does not render if
// the builder could not read it.
//
// Responsive behaviour needs real media queries, which inline styles cannot express, so this one
// component carries a scoped <style> block (all class names prefixed `cio-`). Everything else on
// /commit stays inline, matching the rest of the repo.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, FILE, FILE_BG, FILE_BD, PANEL, PANEL_BD, nfmt } from "./theme";
import MANIFEST from "./data/manifest.json";
import FEATURES from "./data/gold_features_preview.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

// The worked cluster, used only for the matrix corner now that the per-cluster gene chips are
// gone. Kept in lockstep with EXAMPLE_CLUSTER in scripts/build_commit_challenge_asset.py, which
// cuts that corner from the same cluster.
const EXAMPLE_CLUSTER = "C004";

const FILES: Record<string, any> = Object.fromEntries(
  (MANIFEST as any).files.map((f: any) => [f.file, f])
);
const ANSWER = (MENU as any).example_answer ?? null;
const WINDOW = (H5AD as any).matrix_window ?? null;

// The three ranked lists, in plain English. What each one IS, not how it was computed — the
// divergence reading on `family` is the one documented in the row's own merging SPEC.
const LISTS: { col: string; blurb: string }[] = [
  { col: "top_50_markers",
    blurb: "DEGs up-expressed here more than anywhere else in the set — the cluster's positive signature." },
  { col: "bottom_50_markers",
    blurb: "DEGs down-expressed here relative to the rest of the set. Absence used as evidence: what a cluster conspicuously lacks narrows it as much as what it has." },
  { col: "family_50_markers",
    blurb: "The same ranking recomputed against a contrast group of related clusters rather than against the whole set." },
];

// The QC columns, each on its own row. What the number measures, not a value — a single cluster's
// figure taught nothing, and the file window in §3 already shows real rows.
const QC: { col: string; blurb: string }[] = [
  { col: "mean_umi",
    blurb: "Average transcript molecules counted per cell. Sequencing depth — low means less evidence per cell, and a thinner basis for any call." },
  { col: "mean_genes_expressed",
    blurb: "Average distinct genes detected per cell. Library complexity, which separates transcriptionally rich cells from sparse ones." },
  { col: "pct_mitochondrial",
    blurb: "Share of counts coming from mitochondrial genes. A stress and viability signal; elevated values often mark dying or damaged cells." },
];

// ── indentation scale — the waterfall ──────────────────────────────────────
const IND_1 = 19;   // section descriptor, under the file name
const IND_2 = 19;   // column name, under the descriptor
const IND_3 = 15;   // values, under the column name

// ── atoms ──────────────────────────────────────────────────────────────────

// A file that actually ships. Flush left with the section number, rust, and the only element at
// this level — so scanning the left edge alone enumerates the delivery.
function FileName({ name, shape }: { name: string; shape?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
      <code style={{
        fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: FILE,
        background: FILE_BG, border: `1px solid ${FILE_BD}`, borderRadius: 5,
        padding: "4px 9px", whiteSpace: "nowrap",
      }}>
        {name}
      </code>
      {shape && (
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
          {shape}
        </span>
      )}
    </div>
  );
}

// A field WITHIN a file — neutral, so it never competes with the file above it.
function ColName({ children }: { children: React.ReactNode }) {
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

function FileSection({ n, name, shape, blurb, children, window: win }: {
  n: number; name: string; shape?: string; blurb?: React.ReactNode;
  children: React.ReactNode; window?: React.ReactNode;
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                  padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: FAINT, minWidth: 11 }}>{n}</span>
        <FileName name={name} shape={shape} />
      </div>
      <div style={{ paddingLeft: IND_1 + 11 }}>
        {blurb && (
          <div style={{ fontSize: 12, color: MUTED, margin: "7px 0 12px", lineHeight: 1.5, maxWidth: 720 }}>
            {blurb}
          </div>
        )}
        {win ? (
          <div className="cio-split" style={{ marginTop: blurb ? 0 : 11 }}>
            <div>{children}</div>
            <div>{win}</div>
          </div>
        ) : (
          <div style={{ marginTop: blurb ? 0 : 11 }}>{children}</div>
        )}
      </div>
    </div>
  );
}

function OutRow({ n, label, children }: {
  n: number; label: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                  padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ACCENT, minWidth: 13 }}>{n}</span>
        <span style={{ fontSize: 15.5, fontWeight: 650, color: INK, letterSpacing: -0.2 }}>{label}</span>
      </div>
      <div style={{ paddingLeft: IND_1 + 13, marginTop: 11 }}>{children}</div>
    </div>
  );
}

function ColHead({ side, title, sub }: { side: string; title?: string; sub: string }) {
  const isOut = side === "output";
  return (
    <div style={{ marginBottom: 16, paddingLeft: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase",
                    color: isOut ? ACCENT : FILE }}>
        {side}
      </div>
      {title && <div style={{ fontSize: 16, fontWeight: 650, color: INK, marginTop: 5, letterSpacing: -0.2 }}>{title}</div>}
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: title ? 3 : 7, lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

// A row of fields, each in its own small box. Used where a file groups columns that belong
// together — the three ranked lists, the three QC statistics, the menu's three term fields — so
// the grouping is visible instead of implied by reading order.
function FieldRow({ items, min = 190 }: { items: { col: string; blurb: string }[]; min?: number }) {
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

// One field of a file: the column name, then what it is. No restated label in between — the
// sentence already says what the column holds, and a heading above it only said it twice.
function Field({ col, blurb }: { col: string; blurb: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <ColName>{col}</ColName>
      <div style={{ paddingLeft: IND_2 }}>
        <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 6 }}>{blurb}</div>
      </div>
    </div>
  );
}

// A window into a delimited file: real head rows, an elision that states how many rows it stands
// for, then the real last rows. The footer carries the file's true extent, so nothing about the
// window implies the file is only this big.
function FileWindow({ cols, rows, elided, footer, elideLabel = "..." }: {
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
function GoldFeaturesWindow() {
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
function ZfaMenuWindow() {
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
function MatrixWindow() {
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

// An example value, given the same treatment wherever one appears — so "this is a concrete
// instance" reads identically in every box rather than only in the first.
function Example({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9,
                    textTransform: "uppercase", color: "#7fa8b5", marginBottom: 4 }}>
        For example
      </div>
      <div style={{ display: "inline-flex", gap: 9, alignItems: "baseline", flexWrap: "wrap",
                    background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7,
                    padding: "7px 11px",
                    fontFamily: mono ? MONO : undefined, fontSize: mono ? 11.5 : 12.5, color: INK }}>
        {children}
      </div>
    </div>
  );
}

// One axis / one part, with its own left edge; detail steps in and down beneath it.
function OutField({ label, note, children, blurb }: {
  label: string; note?: string; children?: React.ReactNode; blurb?: string;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: INK }}>{label}</span>
        {note && <span style={{ fontSize: 11, color: FAINT }}>· {note}</span>}
      </div>
      <div style={{ paddingLeft: IND_2, marginTop: 6 }}>
        {children}
        {blurb && (
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: children ? 6 : 0 }}>
            {blurb}
          </div>
        )}
      </div>
    </div>
  );
}

// ── the figure ─────────────────────────────────────────────────────────────
export default function InputOutputFigure() {
  const gf = FILES["gold_features.csv"];
  const h5 = FILES["zscape_gold_48hpf.h5ad"];
  const menuFile = FILES["artifacts/zfa_menu.v1.json"];
  const matrix = `${nfmt((H5AD as any).shape.cells)} × ${nfmt((H5AD as any).shape.genes)}`;

  return (
    <section className="cio-wrap" aria-label="The files delivered for the challenge, and the answer required">
      <style
        // scoped to this figure; inline styles cannot carry media queries
        dangerouslySetInnerHTML={{
          __html: `
.cio-grid{display:block}
.cio-mid{display:flex;align-items:center;justify-content:center;padding:14px 0}
.cio-arrow{color:${FAINT};font-size:24px;line-height:1;transform:rotate(90deg)}
.cio-panel{background:${PANEL};border:1px solid ${PANEL_BD};border-radius:14px;padding:20px 20px 8px;min-width:0}
/* Inside a file box: what the columns ARE on the left, the window into the file on the right.
   Side by side because stacking them made the input panel taller than the output twice over. */
.cio-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:22px;align-items:start}
@media (max-width: 1100px){ .cio-split{grid-template-columns:1fr;gap:14px} }`,
        }}
      />

      <div className="cio-grid">

        {/* ── INPUT — the three evidence files, matrix first ───────── */}
        <div className="cio-panel">
          <ColHead side="input" sub="Three files. The matrix, the features derived from it, and the menu every answer is drawn from." />

          <FileSection n={1} name="zscape_gold_48hpf.h5ad" shape={h5?.shape}
                       blurb="The expression matrix. Every cell, every gene — compute your own evidence from it if you would rather not take ours."
                       window={<>
                         <MatrixWindow />
                         <div style={{ fontSize: 11, color: FAINT, marginTop: 8, lineHeight: 1.55 }}>
                           {WINDOW
                             ? <>Five cells against five genes — Cluster {EXAMPLE_CLUSTER.replace(/^C0*/, "")} as an example. Real counts, and mostly zero.</>
                             : null}
                         </div>
                       </>}>
            <FieldRow min={200} items={[
              { col: (WINDOW as any)?.layer ?? "layers['counts']",
                blurb: "Raw integer counts, exactly as sequenced. log1p CP10k sits alongside it in X, and ZSCAPE's published embedding in obsm." },
            ]} />
            <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55 }}>
              Sparsity is the problem this file poses: most gene-by-cell entries are zero, across
              all {matrix} of it.
            </div>
          </FileSection>

          <FileSection n={2} name="gold_features.csv" window={<GoldFeaturesWindow />}
                       blurb={<>One row per cluster. Differentially expressed genes — <strong>DEGs</strong>, the genes whose expression separates this cluster from others — ranked three ways, plus the quality statistics behind them.</>}>

            <FieldRow items={LISTS} min={165} />
            <FieldRow items={QC} min={165} />
          </FileSection>

          <FileSection n={3} name="zfa_menu.v1.json" shape={`${nfmt((MENU as any).n_terms)} terms`}
                       blurb="The answer space. Every label you return must be one of these terms, so this file is as much an input as the evidence is."
                       window={<ZfaMenuWindow />}>
            <FieldRow min={200} items={[
              { col: "id", blurb: "The ZFA identifier you actually submit. An answer is this string; a term that is not on the menu is not an answer." },
              { col: "name", blurb: "The anatomy term the identifier stands for. Scoring reads the identifier, so a synonym is never punished for being one." },
              { col: "caro", blurb: "Which branch the term sits in — cell, anatomical structure, or above the roots. This is what makes the two answer axes separable." },
            ]} />
            <div style={{ paddingLeft: 0, marginTop: 4, fontSize: 11.5, color: FAINT, lineHeight: 1.55 }}>
              Frozen against ZFA {(MENU as any).source?.release?.replace("releases/", "")}. Both
              sides select from this exact list; matching its content hash is how that parity is
              proven.
            </div>
          </FileSection>
        </div>

        {/* ── the empty middle ──────────────────────────────────────── */}
        <div className="cio-mid" aria-hidden="true">
          <span className="cio-arrow">→</span>
        </div>

        {/* ── OUTPUT ────────────────────────────────────────────────── */}
        <div className="cio-panel">
          <ColHead side="output" title="What you must return" sub="Per cluster. One answer, four parts." />

          <OutRow n={1} label="One ZFA identifier">
            {ANSWER ? (
              <Example>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT }}>{ANSWER.term.id}</span>
                <span>{ANSWER.term.name}</span>
              </Example>
            ) : null}
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>
              Selected from the {nfmt((MENU as any).n_terms)}-term menu on the left, not written. It
              must be a term from the candidate evidence, or an ancestor of one.
            </div>
          </OutRow>

          <OutRow n={2} label="Both axis terms">
            <OutField label="cell-type axis" note="what the cells are">
              <Example mono>
                <span style={{ color: FAINT, fontStyle: "italic" }}>null</span>
                <span style={{ color: MUTED }}>— evidence did not support a call</span>
              </Example>
            </OutField>
            <OutField label="anatomical axis" note="where they sit">
              {ANSWER ? (
                <Example mono>
                  <span style={{ fontWeight: 700, color: ACCENT }}>{ANSWER.term.id}</span>
                  <span style={{ color: MUTED }}>{ANSWER.term.name}</span>
                </Example>
              ) : null}
            </OutField>
            <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55 }}>
              Either axis may be null. Saying so is an answer; guessing is not.
            </div>
          </OutRow>

          <OutRow n={3} label="Ancestor chain">
            {ANSWER ? (
              <Example mono>
                <div>
                  {ANSWER.ancestor_chain.map((node: any, i: number) => (
                    <div key={node.id} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "2px 0" }}>
                      <span style={{ fontSize: 9, color: FAINT, minWidth: 18 }}>d{node.depth}</span>
                      <span style={{ color: "#c9d9de" }}>{i === 0 ? "•" : "↑"}</span>
                      <span style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 12.5,
                                     color: i === 0 ? INK : MUTED, fontWeight: i === 0 ? 600 : 400 }}>
                        {node.name}
                      </span>
                    </div>
                  ))}
                </div>
              </Example>
            ) : null}
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>
              The full <code style={{ fontFamily: MONO, fontSize: 10.5 }}>is_a</code> and{" "}
              <code style={{ fontFamily: MONO, fontSize: 10.5 }}>part_of</code> path, including
              multi-parent terms. It records whether the answer generalised, and how far.
            </div>
          </OutRow>

          <OutRow n={4} label="Confidence score and tier">
            <div style={{ fontSize: 12, color: INK, lineHeight: 1.6, marginBottom: 12 }}>
              A numeric score plus a tier from a closed list, both derived from a documented rubric.
            </div>
            <OutField
              label="the rubric"
              note="yours to define and publish"
              blurb="The signals it scores, their weights, and where the tier boundaries fall are the contestant's to specify. Signals are expected to be citable — marker coherence, reference corroboration, ontology convergence."
            />
            <OutField
              label="per-signal values"
              note="returned with every answer"
              blurb="Each answer carries the individual signal values alongside the tier, so the score can be audited rather than taken on faith."
            />
            {/* The rubric is the contestant's deliverable, so no weights, boundaries or scores
                are invented here. What CAN be shown is the shape the answer has to arrive in —
                every slot the contestant fills marked as theirs. */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9,
                            textTransform: "uppercase", color: "#7fa8b5", marginBottom: 4 }}>
                For example — the shape, not the values
              </div>
              <div style={{ background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7,
                            padding: "11px 13px", fontFamily: MONO, fontSize: 11, lineHeight: 1.7,
                            color: INK, overflowX: "auto" }}>
                <div><span style={{ color: MUTED }}>score</span> : <span style={{ color: FAINT }}>&lt;your scale&gt;</span></div>
                <div><span style={{ color: MUTED }}>tier</span> &nbsp;: <span style={{ color: FAINT }}>&lt;one of your closed list&gt;</span></div>
                <div style={{ color: MUTED }}>signals :</div>
                <div style={{ paddingLeft: 14 }}>
                  <div><span style={{ color: MUTED }}>marker_coherence</span> &nbsp; : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
                  <div><span style={{ color: MUTED }}>reference_corroboration</span> : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
                  <div><span style={{ color: MUTED }}>ontology_convergence</span> &nbsp; : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: FAINT, marginTop: 7, lineHeight: 1.55 }}>
                Slot names follow the signals named above; the scale, the tier list and the
                weighting are yours. Nothing here is a suggested value — it is a working rubric,
                not a calibrated probability.
              </div>
            </div>
          </OutRow>
        </div>
      </div>
    </section>
  );
}
