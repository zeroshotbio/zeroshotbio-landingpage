// §03 — what one cluster's answer has to contain.
//
// Same treatment as §01 and §02: prose carries the meaning, and the only visual weight goes to the
// four worked examples. The previous version wrapped this in a grey panel holding four white cards,
// each holding a labelled example block — three nested surfaces for four short statements.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, nfmt } from "../theme";
import MENU from "../data/zfa_menu_preview.json";

const ANSWER = (MENU as any).example_answer ?? null;
const prose: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 700 };

function Part({ n, title, children, example }: {
  n: string; title: string; children: React.ReactNode; example?: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 40 }}>
      <h3 style={{ fontSize: 17, fontWeight: 650, color: INK, margin: "0 0 10px", letterSpacing: -0.2 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: FAINT, marginRight: 11 }}>
          {n}
        </span>
        {" "}{title}
      </h3>
      <div style={prose}>{children}</div>
      {example && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9,
                        textTransform: "uppercase", color: "#7fa8b5", marginBottom: 5 }}>
            For Example
          </div>
          {example}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", gap: 9, alignItems: "baseline", flexWrap: "wrap",
                  background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7,
                  padding: "8px 12px", fontSize: 13, color: INK }}>
      {children}
    </div>
  );
}

export default function OutputSection() {
  return (
    <>
      <p style={{ ...prose, margin: 0 }}>
        Your labeller works through the clusters one at a time, and returns one answer for each.
        Every answer has four parts, and all four are required — a cluster answered with an
        identifier alone is incomplete.
      </p>

      <Part
        n="01"
        title="One ZFA identifier"
        example={ANSWER ? (
          <Chip>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT }}>
              {ANSWER.term.id}
            </span>
            <span>{ANSWER.term.name}</span>
          </Chip>
        ) : null}
      >
        The single call your labeller commits to for that cluster, selected from the{" "}
        {nfmt((MENU as any).n_terms)}-term menu rather than written out. The identifier is the
        answer; the name beside it is for readers. It must be a term drawn from the evidence your
        labeller gathered for that cluster, or an ancestor of one. The key holds its own committed
        pick for every one of the 112 clusters, and that is what this is compared against.
      </Part>

      <Part
        n="02"
        title="Both axis terms"
        example={ANSWER ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <Chip>
              <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: 0.5 }}>
                cell-type axis
              </span>
              <span style={{ color: FAINT, fontStyle: "italic" }}>null — evidence did not support a call</span>
            </Chip>
            <Chip>
              <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: 0.5 }}>
                anatomical axis
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ACCENT }}>
                {ANSWER.term.id}
              </span>
              <span>{ANSWER.term.name}</span>
            </Chip>
          </div>
        ) : null}
      >
        Beneath the committed pick, a cluster is answered on two separate axes: what the cells in it
        are, and where in the animal they sit. These are genuinely distinct — in the key they differ
        on 111 of the 112 clusters — and the committed pick above is drawn from one axis or the
        other rather than being a third opinion. Either axis may be null where the evidence does not
        support a call; the key itself leaves the cell-type axis empty on 7 clusters and the
        anatomical axis on 2. Returning null is an answer, and a labeller that guesses to fill the
        slot is doing worse than one that declines.
      </Part>

      <Part
        n="03"
        title="Ancestor chain"
        example={ANSWER ? (
          <Chip>
            <div>
              {ANSWER.ancestor_chain.map((node: any, i: number) => (
                <div key={node.id} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "2px 0" }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: FAINT, minWidth: 18 }}>d{node.depth}</span>
                  <span style={{ color: "#c9d9de" }}>{i === 0 ? "•" : "↑"}</span>
                  <span style={{ color: i === 0 ? INK : MUTED, fontWeight: i === 0 ? 600 : 400 }}>
                    {node.name}
                  </span>
                </div>
              ))}
            </div>
          </Chip>
        ) : null}
      >
        The full <code style={{ fontFamily: MONO, fontSize: 13.5 }}>is_a</code> and{" "}
        <code style={{ fontFamily: MONO, fontSize: 13.5 }}>part_of</code> path from the term back
        toward the root, including terms with more than one parent. It records how far up the
        ontology your labeller had to generalise before it was willing to commit, which is what
        makes a near miss on that cluster legible instead of merely wrong.
      </Part>

      <Part
        n="04"
        title="Confidence score and tier"
        example={
          <div style={{ background: "#eef6f8", border: "1px solid #cfe4ea", borderRadius: 7,
                        padding: "12px 14px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.75,
                        color: INK, display: "inline-block", overflowX: "auto" }}>
            <div><span style={{ color: MUTED }}>score</span> : <span style={{ color: FAINT }}>&lt;your scale&gt;</span></div>
            <div><span style={{ color: MUTED }}>tier</span> &nbsp;: <span style={{ color: FAINT }}>&lt;one of your closed list&gt;</span></div>
            <div style={{ color: MUTED }}>signals :</div>
            <div style={{ paddingLeft: 16 }}>
              <div><span style={{ color: MUTED }}>marker_coherence</span> &nbsp; : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
              <div><span style={{ color: MUTED }}>reference_corroboration</span> : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
              <div><span style={{ color: MUTED }}>ontology_convergence</span> &nbsp; : <span style={{ color: FAINT }}>&lt;value&gt;</span></div>
            </div>
          </div>
        }
      >
        How much your labeller believes its own call on that cluster: a numeric score plus a tier
        from a closed list, both produced by a rubric you define and publish. The signals it scores,
        their weights and where the tier boundaries fall are yours to set, and they are expected to
        be citable — marker coherence, reference corroboration, ontology convergence. Each answer
        returns its per-signal values, so a reader can audit the number rather than take it. It is a
        working rubric, not a calibrated probability.
      </Part>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${RULE}` }}>
        <p style={{ ...prose, margin: 0 }}>
          Alongside the four parts, every cluster&apos;s answer carries{" "}
          <strong>the references used</strong> and an{" "}
          <strong>evidentiary statement citing only retrieved evidence</strong>. Without it a label
          is an assertion, and a labeller that reasoned cannot be told apart from one that guessed
          well.
        </p>
      </div>
    </>
  );
}
