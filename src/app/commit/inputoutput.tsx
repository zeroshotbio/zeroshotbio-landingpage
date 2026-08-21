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
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, FILE, FILE_BG, FILE_BD, nfmt } from "./theme";
import MANIFEST from "./data/manifest.json";
import FEATURES from "./data/gold_features_preview.json";
import CLUSTER from "./data/cluster_public_preview.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

// The worked cluster. C001 is the first row, but its family list is byte-identical to its enriched
// list (true for 56 of 112 clusters), which would render two of the three signals as the same four
// chips. C004 is the first preview row where all three lists are full and genuinely distinct.
// Kept in lockstep with EXAMPLE_CLUSTER in scripts/build_commit_challenge_asset.py, which cuts the
// matrix corner from the same cluster.
const EXAMPLE_CLUSTER = "C004";

const FILES: Record<string, any> = Object.fromEntries(
  (MANIFEST as any).files.map((f: any) => [f.file, f])
);
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

function FileSection({ n, name, shape, blurb, children }: {
  n: number; name: string; shape?: string; blurb: string; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "17px 0", borderTop: `1px solid ${RULE}` }}>
      <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: FAINT, minWidth: 11 }}>{n}</span>
        <FileName name={name} shape={shape} />
      </div>
      <div style={{ paddingLeft: IND_1 + 11 }}>
        <div style={{ fontSize: 12, color: MUTED, margin: "7px 0 11px", lineHeight: 1.5 }}>{blurb}</div>
        {children}
      </div>
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

function OutRow({ n, label, file, children }: {
  n: number; label: string; file?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "15px 0", borderTop: `1px solid ${RULE}` }}>
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: FAINT, minWidth: 11 }}>{n}</span>
        {file ? <FileName name={file} /> : (
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED }}>
            {label}
          </span>
        )}
      </div>
      <div style={{ paddingLeft: IND_1 + 11 }}>
        {file && (
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED, margin: "8px 0 9px" }}>
            {label}
          </div>
        )}
        <div style={{ marginTop: file ? 0 : 9 }}>{children}</div>
      </div>
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

// ── the figure ─────────────────────────────────────────────────────────────
export default function InputOutputFigure() {
  const gf = FILES["gold_features.csv"];
  const cp = FILES["inputs/cluster_public.csv"];
  const h5 = FILES["zscape_gold_48hpf.h5ad"];
  const menuFile = FILES["artifacts/zfa_menu.v1.json"];
  const matrix = `${nfmt((H5AD as any).shape.cells)} × ${nfmt((H5AD as any).shape.genes)}`;

  return (
    <section className="cio-wrap" aria-label="The files delivered for the challenge, and the answer required">
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

        {/* ── INPUT — the three evidence files ──────────────────────── */}
        <div className="cio-col cio-col--in">
          <ColHead side="input" sub={`The files we deliver. Using Cluster ${EXAMPLE_CLUSTER.replace(/^C/, "")} as an example:`} />

          <FileSection n={1} name="gold_features.csv" shape={gf?.shape}
                       blurb="One row per cluster. The evidence file — three ranked gene lists and the QC behind them.">
            {LISTS.map((l) => (
              <div key={l.col} style={{ marginBottom: 14 }}>
                <ColName>{l.col}</ColName>
                <div style={{ paddingLeft: IND_2 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, margin: "6px 0 4px" }}>
                    {l.tag}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5, marginBottom: 7 }}>{l.blurb}</div>
                  <div style={{ paddingLeft: IND_3 }}>{EX ? <Chips list={EX[l.col]} show={4} /> : null}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {["mean_umi", "mean_genes_expressed", "pct_mitochondrial"].map((c) => (
                  <ColName key={c}>{c}</ColName>
                ))}
              </div>
              <div style={{ paddingLeft: IND_2 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, margin: "6px 0 6px" }}>
                  qc statistics
                </div>
                <div style={{ paddingLeft: IND_3, display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {EX
                    ? ([["mean UMI", EX.mean_umi], ["mean genes", EX.mean_genes_expressed], ["% mito", EX.pct_mitochondrial]] as [string, number][])
                        .map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: FAINT }}>{k}</div>
                            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
                          </div>
                        ))
                    : null}
                </div>
              </div>
            </div>
          </FileSection>

          <FileSection n={2} name="inputs/cluster_public.csv" shape={cp?.shape}
                       blurb="The roster — the authoritative list of which clusters exist. Both surviving columns also appear in gold_features.csv, so it adds no evidence; it fixes the set.">
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <ColName>cluster_id</ColName>
              <ColName>n_cells</ColName>
            </div>
            <div style={{ paddingLeft: IND_2 }}>
              <div style={{ paddingLeft: 0, marginTop: 8, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK }}>{EX?.cluster_id ?? "—"}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {EX ? `${nfmt(EX.n_cells)} cells` : ""}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>
                The id is opaque — no ordering, no meaning beyond identity. It is a handle to answer
                against, not a hint.
              </div>
            </div>
          </FileSection>

          <FileSection n={3} name="zscape_gold_48hpf.h5ad" shape={h5?.shape}
                       blurb="The matrix itself, if you would rather compute your own evidence than take ours.">
            <ColName>{(WINDOW as any)?.layer ?? "layers['counts']"}</ColName>
            <div style={{ paddingLeft: IND_2 }}>
              <MatrixWindow />
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8, lineHeight: 1.5 }}>
                {WINDOW
                  ? <>Five cells of {EXAMPLE_CLUSTER} against its own top five markers — real counts, mostly zero. That sparsity is the problem, and it runs the full {matrix}.</>
                  : <>Raw integer counts, alongside log1p CP10k in X.</>}
              </div>
            </div>
          </FileSection>
        </div>

        {/* ── the empty middle ──────────────────────────────────────── */}
        <div className="cio-mid" aria-hidden="true">
          <span className="cio-arrow">→</span>
        </div>

        {/* ── OUTPUT ────────────────────────────────────────────────── */}
        <div className="cio-col">
          <ColHead side="output" title="What you must return" sub="Per cluster. One answer, four parts." />

          <OutRow n={1} label="one zfa identifier" file="artifacts/zfa_menu.v1.json">
            {ANSWER ? (
              <div style={{ display: "inline-flex", gap: 9, alignItems: "baseline", flexWrap: "wrap",
                            background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7, padding: "7px 11px" }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT }}>{ANSWER.term.id}</span>
                <span style={{ fontSize: 12.5, color: INK }}>{ANSWER.term.name}</span>
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 7, lineHeight: 1.5 }}>
              The fourth delivered file is the answer space itself: {nfmt((MENU as any).n_terms)}{" "}
              frozen terms. Selected, not written — a term that is not on the menu is not an answer.
            </div>
          </OutRow>

          <OutRow n={2} label="both axis terms">
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
          </OutRow>

          <OutRow n={3} label="ancestor chain">
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
          </OutRow>

          <OutRow n={4} label="confidence tier">
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
          </OutRow>
        </div>
      </div>
    </section>
  );
}
