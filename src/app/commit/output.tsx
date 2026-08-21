// The answer figure: what a labeller must hand back, per cluster.
//
// This was an input→output pair; the input half folded into §01, where the file-window styling
// carries it better than a second set of grey boxes did. What remains describes an ANSWER — the
// identifier, the two axes, the chain, the rubric — and nothing about the files.
//
// Every concrete value traces to src/app/commit/data/, and where a value is the contestant's to
// define the example shows the SHAPE with the slots marked, never an invented number.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, PANEL, PANEL_BD, nfmt } from "./theme";
import MENU from "./data/zfa_menu_preview.json";

const ANSWER = (MENU as any).example_answer ?? null;
const IND_1 = 19;   // the answer part's own left edge
const IND_2 = 19;   // detail stepping in beneath it

function ColHead({ side, title, sub }: { side: string; title?: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16, paddingLeft: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase",
                    color: ACCENT }}>
        {side}
      </div>
      {title && <div style={{ fontSize: 16, fontWeight: 650, color: INK, marginTop: 5, letterSpacing: -0.2 }}>{title}</div>}
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: title ? 3 : 7, lineHeight: 1.5 }}>{sub}</div>
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

// An example value, given the same treatment wherever one appears — so "this is a concrete
// instance" reads identically in every box rather than only in the first.
function Example({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9,
                    textTransform: "uppercase", color: "#7fa8b5", marginBottom: 4 }}>
        For Example
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
export default function OutputFigure() {
  return (
    <section aria-label="What a labeller must return for each cluster">
      <div style={{ background: PANEL, border: `1px solid ${PANEL_BD}`, borderRadius: 14,
                    padding: "20px 20px 8px" }}>
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
                For Example
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
    </section>
  );
}
