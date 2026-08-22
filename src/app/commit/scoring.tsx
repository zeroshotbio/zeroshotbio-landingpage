// §04 — Evaluation, written the way §01–§03 are written.
//
// This replaced a grey panel of white outcome cards, a card holding two tinted case panels each
// holding two more white node boxes, and two further cards for what is reported. Five surfaces
// deep for a rule with three outcomes. Prose carries it now; the one mono block showing the two
// directional cases is the only bordered thing in the section.
//
// ONE rule, stated once. An earlier version described a two-judge setup whose first judge was our
// internal weighted-ZFA-graph judge (:5011). Commit is not scored on that and has not agreed to
// it, so it has no place on a page addressed to a contestant.
//
// The full-credit case is narrow and the narrowness is the point. Answering a cluster more
// specifically than the key earns full credit ONLY where the key names a specific anatomical
// region and the answer names a cell type contained in it. Where the key already names a cell
// type, a narrower cell type is zero — "deeper is free" is not the rule and must not be implied.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, SC_FULL, SC_HALF, SC_ZERO } from "./theme";

const prose: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 700 };

const OUTCOMES = [
  {
    key: "Full", color: SC_FULL,
    body: "The identifier your labeller returned for the cluster matches the one the key holds for it, or any term in that key's accepted set. Also full where the key names a specific anatomical region for the cluster and your labeller correctly names a cell type contained in it — answering more precisely than the key, in that one direction, is not punished.",
  },
  {
    key: "Half", color: SC_HALF,
    body: "The key names a cell type for the cluster and your labeller named the region containing it. Right neighbourhood, wrong grain. Retreating up the ontology buys safety on a hard cluster, so it has to cost something.",
  },
  {
    key: "Zero", color: SC_ZERO,
    body: "Everything else, including a cell type narrower than the key's own cell type for that cluster. Depth on its own earns nothing, and a sibling term — however close on the tree — scores exactly as an unrelated one does.",
  },
];

export default function ScoringSection() {
  return (
    <>
      <p style={{ ...prose, margin: "0 0 15px" }}>
        Clusters are scored one at a time. The identifier your labeller returned for a cluster is
        compared against the identifier the key holds for that same cluster, both normalised on the
        pinned ontology. Synonyms resolve to the same term, so spelling is never the error.
      </p>
      <p style={{ ...prose, margin: 0 }}>
        Credit is <strong>asymmetric</strong>, and narrowly so. Answering a cluster more
        specifically than the key did is sometimes free and sometimes worth nothing — which of the
        two depends on what kind of term the key holds for that cluster.
      </p>

      {/* the three outcomes, as a list rather than a stack of cards */}
      <dl style={{ margin: "30px 0 0", maxWidth: 760 }}>
        {OUTCOMES.map((o, i) => (
          <div key={o.key} style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap",
                                    padding: "13px 0",
                                    borderTop: i === 0 ? `1px solid ${RULE}` : "1px solid #f2efeb" }}>
            <dt style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8,
                         textTransform: "uppercase", color: o.color, flex: "0 0 70px" }}>
              {o.key}
            </dt>
            <dd style={{ margin: 0, fontSize: 14, color: "#3f3a34", lineHeight: 1.65,
                         flex: "1 1 340px", minWidth: 0 }}>
              {o.body}
            </dd>
          </div>
        ))}
      </dl>

      <p style={{ ...prose, margin: "30px 0 0" }}>
        The two directions are not symmetric because the key holds a different kind of term in each
        case. Set side by side, that is the whole of it:
      </p>

      <div style={{ marginTop: 14, border: `1px solid ${RULE}`, borderRadius: 8, background: "#fdfcfb",
                    padding: "16px 18px", fontFamily: MONO, fontSize: 12, lineHeight: 1.9,
                    color: INK, maxWidth: 700, overflowX: "auto" }}>
        <div>
          <span style={{ color: SC_FULL, fontWeight: 700 }}>FULL</span>
          <span style={{ color: FAINT }}> — the key stopped at a region</span>
        </div>
        <div style={{ paddingLeft: 18, color: MUTED }}>the key &nbsp;· a specific anatomical region</div>
        <div style={{ paddingLeft: 18, color: FAINT }}>↓ contains</div>
        <div style={{ paddingLeft: 18 }}>your call · a cell type inside it</div>

        <div style={{ marginTop: 14 }}>
          <span style={{ color: SC_HALF, fontWeight: 700 }}>HALF</span>
          <span style={{ color: FAINT }}> — the key went all the way down</span>
        </div>
        <div style={{ paddingLeft: 18 }}>your call · the region containing it</div>
        <div style={{ paddingLeft: 18, color: FAINT }}>↓ contains</div>
        <div style={{ paddingLeft: 18, color: MUTED }}>the key &nbsp;· a cell type</div>
      </div>

      <p style={{ ...prose, margin: "22px 0 0" }}>
        So where the key already names a cell type for a cluster, answering with a narrower cell
        type beneath it is <strong>zero</strong>, not full. There is no general credit for going
        deeper.
      </p>

      <h3 style={{ fontSize: 17, fontWeight: 650, color: INK, margin: "40px 0 12px", letterSpacing: -0.2 }}>
        What is reported alongside
      </h3>
      <p style={{ ...prose, margin: "0 0 15px" }}>
        The graded score is never published on its own. <strong>Strict exact-match accuracy</strong>,
        cluster by cluster — no partial credit, no containment — is reported beside it, so the
        graded number cannot quietly carry the result.
      </p>
      <p style={{ ...prose, margin: 0 }}>
        Every cluster also carries a <strong>scoring flag</strong> —{" "}
        <code style={{ fontFamily: MONO, fontSize: 13.5 }}>contested</code>,{" "}
        <code style={{ fontFamily: MONO, fontSize: 13.5 }}>evidence-ambiguous</code> or{" "}
        <code style={{ fontFamily: MONO, fontSize: 13.5 }}>removed</code> — and that flag decides
        whether the answer for it is scored at all. Which clusters were excluded, and under which
        flag, is reported with the score.
      </p>

      <p style={{ ...prose, fontSize: 14, color: MUTED, margin: "30px 0 0", paddingTop: 18,
                  borderTop: `1px solid ${RULE}` }}>
        <strong style={{ color: INK }}>Not yet finalised.</strong> The shape of the credit is fixed
        and stated above. Still to be published: the exact weights, what counts as a region that is{" "}
        <em>not overly broad</em>, the containment test that decides whether one term sits inside
        another, and the definition of the accepted answer sets. They are deliberately not guessed
        here.
      </p>
    </>
  );
}
