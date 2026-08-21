// The input→output figure: what a labeller is handed, and what it must hand back.
//
// The glanceable version of the masthead subtitle — the shape of the task without reading §1. The
// middle is deliberately empty: what happens between the two columns is the contest.
//
// Every concrete value traces to src/app/commit/data/. The worked cluster is looked up by id
// rather than by row position, and if a field is missing the label renders without an example
// instead of inventing one — the 5x5 matrix corner simply does not render if the builder could not
// read it.
//
// Responsive behaviour needs real media queries, which inline styles cannot express, so this one
// component carries a scoped <style> block (all class names prefixed `cio-`). Everything else on
// /commit stays inline, matching the rest of the repo.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, nfmt } from "./theme";
import FEATURES from "./data/gold_features_preview.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

// The worked cluster. C001 is the first row, but its family list is byte-identical to its enriched
// list (true for 56 of 112 clusters), which would render two of the three signals as the same four
// chips. C004 is the first preview row where all three lists are full and genuinely distinct.
// Kept in lockstep with EXAMPLE_CLUSTER in scripts/build_commit_challenge_asset.py, which cuts the
// matrix corner from the same cluster.
const EXAMPLE_CLUSTER = "C004";

const ROWS = (FEATURES as any).rows as any[];
const EX = ROWS.find((r) => r.cluster_id === EXAMPLE_CLUSTER) ?? null;
const ANSWER = (MENU as any).example_answer ?? null;
const WINDOW = (H5AD as any).matrix_window ?? null;

const CONF_TIERS = ["Germ layer", "Tissue", "Cell type — broad", "Cell type — sub"];

// The three ranked lists, in plain English. What each one IS, not how it was computed — the
// divergence reading on `family` is the one documented in the row's own merging SPEC.
const LISTS: { col: string; tag: string; blurb: string }[] = [
  { col: "top_50_markers", tag: "enriched",
    blurb: "Turned up here more than anywhere else in the set: the cluster's positive signature." },
  { col: "bottom_50_markers", tag: "depleted",
    blurb: "Expressed across the rest of the set but not here — absence used as evidence." },
  { col: "family_50_markers", tag: "family",
    blurb: "The same ranking against near-neighbour clusters. Matching enriched means no separable sibling structure; diverging means there is." },
];

// ── atoms ──────────────────────────────────────────────────────────────────

// A code-set identifier — a column or layer name, the thing that actually arrives. Boxed so the
// name is the emphasis of its row and the prose reads as annotation on it.
function Code({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <code style={{
      fontFamily: MONO, fontSize: strong ? 12 : 11,
      fontWeight: 700, color: INK,
      background: "#f4f2ef", border: `1px solid ${RULE}`, borderRadius: 5,
      padding: strong ? "4px 8px" : "2px 6px", whiteSpace: "nowrap",
    }}>
      {children}
    </code>
  );
}

function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "15px 0", borderTop: `1px solid ${RULE}` }}>
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: 9 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: FAINT, minWidth: 11 }}>{n}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED }}>
          {label}
        </span>
      </div>
      <div style={{ paddingLeft: 20 }}>{children}</div>
    </div>
  );
}

// The bundle's `more_label` counts from the 8 genes it previews; this figure shows 4, so the
// remainder is recomputed from n_total rather than reused — otherwise 4 chips + "+42 more" would
// claim 46 genes for a 50-gene list.
function Chips({ list, show }: { list: { shown: string[]; n_total: number }; show: number }) {
  const genes = list.shown.slice(0, show);
  const more = list.n_total - genes.length;
  if (!genes.length) return <span style={{ fontSize: 12, color: FAINT, fontStyle: "italic" }}>none for this cluster</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {genes.map((g) => (
        <span key={g} style={{ fontFamily: MONO, fontSize: 10.5, background: "#f1efeb", color: "#5a544c",
                               border: `1px solid ${RULE}`, borderRadius: 4, padding: "2px 6px" }}>
          {g}
        </span>
      ))}
      {more > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>+{more} more</span>}
    </span>
  );
}

function SubItem({ tag, note, children }: { tag: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: INK }}>{tag}</span>
        {note && <span style={{ fontSize: 11, color: FAINT }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

function ColHead({ side, title, sub }: { side: string; title?: string; sub: string }) {
  const isOut = side === "output";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase",
                    color: isOut ? ACCENT : MUTED }}>
        {side}
      </div>
      {title && <div style={{ fontSize: 16, fontWeight: 650, color: INK, marginTop: 5, letterSpacing: -0.2 }}>{title}</div>}
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: title ? 3 : 7, lineHeight: 1.5 }}>{sub}</div>
    </div>
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
    <div style={{ marginTop: 11, display: "inline-block", border: `1px solid ${RULE}`, borderRadius: 8, overflow: "hidden", background: "#fdfcfb" }}>
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

// ── the figure ─────────────────────────────────────────────────────────────
export default function InputOutputFigure() {
  const matrix = `${nfmt((H5AD as any).shape.cells)} × ${nfmt((H5AD as any).shape.genes)}`;

  return (
    <section className="cio-wrap" aria-label="What a labeller is given, and what it must return">
      <style
        // scoped to this figure; inline styles cannot carry media queries
        dangerouslySetInnerHTML={{
          __html: `
.cio-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:0;align-items:stretch}
.cio-mid{display:flex;align-items:center;justify-content:center;padding:0 22px}
.cio-arrow{color:${FAINT};font-size:19px;line-height:1;transform:none}
.cio-col{padding:24px 26px;min-width:0}
.cio-col--in{border-right:1px solid ${RULE}}
@media (max-width: 820px){
  .cio-grid{grid-template-columns:1fr}
  .cio-col--in{border-right:none;border-bottom:1px solid ${RULE}}
  .cio-mid{padding:14px 0}
  .cio-arrow{transform:rotate(90deg)}
}`,
        }}
      />

      <div className="cio-grid" style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, overflow: "hidden" }}>

        {/* ── INPUT ─────────────────────────────────────────────────── */}
        <div className="cio-col cio-col--in">
          <ColHead side="input" sub={`Using Cluster ${EXAMPLE_CLUSTER.replace(/^C/, "")} as an example:`} />

          <Row n={1} label="three ranked gene lists">
            {LISTS.map((l) => (
              <div key={l.col} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 5 }}>
                  <Code strong>{l.col}</Code>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: MUTED }}>
                    {l.tag}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginBottom: 6 }}>{l.blurb}</div>
                {EX ? <Chips list={EX[l.col]} show={4} /> : null}
              </div>
            ))}
          </Row>

          <Row n={2} label="qc statistics">
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {EX
                ? ([["mean UMI", EX.mean_umi], ["mean genes", EX.mean_genes_expressed], ["% mito", EX.pct_mitochondrial]] as [string, number][])
                    .map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: FAINT }}>{k}</div>
                        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
                      </div>
                    ))
                : <div style={{ fontSize: 12.5, color: MUTED }}>mean UMI · mean genes expressed · % mitochondrial</div>}
            </div>
          </Row>

          <Row n={3} label="cluster identity">
            <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
              <Code strong>{EX?.cluster_id ?? "cluster_id"}</Code>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                {EX ? `${nfmt(EX.n_cells)} cells` : "n_cells"}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>
              The id is opaque — it carries no ordering and no meaning beyond identity.
            </div>
          </Row>

          <Row n={4} label="the full expression matrix">
            <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
              <Code strong>{(WINDOW as any)?.layer ?? "layers['counts']"}</Code>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                {matrix}
              </span>
            </div>
            <MatrixWindow />
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8, lineHeight: 1.5 }}>
              {WINDOW
                ? <>Five cells of {EXAMPLE_CLUSTER} against its own top five markers — real counts, mostly zero. That sparsity is the problem: the whole matrix is {matrix}, and it is there if you would rather compute your own evidence than take ours.</>
                : <>Raw counts and log1p CP10k, for every cluster at once — there if you would rather compute your own evidence than take ours.</>}
            </div>
          </Row>
        </div>

        {/* ── the empty middle ──────────────────────────────────────── */}
        <div className="cio-mid" aria-hidden="true">
          <span className="cio-arrow">→</span>
        </div>

        {/* ── OUTPUT ────────────────────────────────────────────────── */}
        <div className="cio-col">
          <ColHead side="output" title="What you must return" sub="Per cluster. One answer, four parts." />

          <Row n={1} label="one zfa identifier">
            {ANSWER ? (
              <div style={{ display: "inline-flex", gap: 9, alignItems: "baseline", flexWrap: "wrap",
                            background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7, padding: "7px 11px" }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT }}>{ANSWER.term.id}</span>
                <span style={{ fontSize: 12.5, color: INK }}>{ANSWER.term.name}</span>
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 7, lineHeight: 1.5 }}>
              Selected from the frozen {nfmt((MENU as any).n_terms)}-term menu, not written. A term
              that is not on the menu is not an answer.
            </div>
          </Row>

          <Row n={2} label="both axis terms">
            <SubItem tag="cell-type axis" note="what the cells are">
              <span style={{ fontSize: 12.5, color: FAINT, fontStyle: "italic" }}>
                null — evidence did not support a call
              </span>
            </SubItem>
            <SubItem tag="anatomical axis" note="where they sit">
              {ANSWER ? (
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: INK }}>
                  {ANSWER.term.id} <span style={{ fontFamily: "inherit", color: MUTED }}>{ANSWER.term.name}</span>
                </span>
              ) : null}
            </SubItem>
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2, lineHeight: 1.5 }}>
              Either axis may be null. Saying so is an answer; guessing is not.
            </div>
          </Row>

          <Row n={3} label="ancestor chain">
            {ANSWER ? (
              <div>
                {ANSWER.ancestor_chain.map((node: any, i: number) => (
                  <div key={node.id} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: FAINT, minWidth: 18 }}>d{node.depth}</span>
                    <span style={{ color: "#ddd8d1", fontSize: 11 }}>{i === 0 ? "•" : "↑"}</span>
                    <span style={{ fontSize: 12.5, color: i === 0 ? INK : MUTED, fontWeight: i === 0 ? 600 : 400 }}>
                      {node.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>
              The path back toward the root. It is what makes a near-miss legible instead of merely
              wrong.
            </div>
          </Row>

          <Row n={4} label="confidence tier">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {CONF_TIERS.map((t, i) => (
                <span key={t} style={{ fontFamily: MONO, fontSize: 10, color: i === 3 ? INK : MUTED,
                                       background: i === 3 ? "#f1efeb" : "transparent",
                                       border: `1px solid ${i === 3 ? "#ddd8d1" : RULE}`,
                                       borderRadius: 999, padding: "3px 9px" }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 7, lineHeight: 1.5 }}>
              A closed list. Conclude at the deepest tier the evidence supports — abstention is
              credited at the tier you reached, so stopping early costs less than overreaching.
            </div>
          </Row>
        </div>
      </div>
    </section>
  );
}
