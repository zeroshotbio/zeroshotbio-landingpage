// How it is scored.
//
// ONE rule, stated once. An earlier version of this section described a two-judge setup, the first
// of which was our internal weighted-ZFA-graph judge (:5011). Commit is not scored on that and has
// not agreed to it, so it does not belong on a page addressed to a contestant. What remains is the
// comparison rule the contract actually specifies: identifier match against accepted answer sets.
//
// The full-credit case is narrow and the narrowness is the point. Going deeper than the key earns
// full credit ONLY where the key names a specific anatomical region and the answer names a cell
// type contained in it. Where the key already names a cell type, a narrower cell type is zero —
// "deeper is free" is not the rule and must not be implied.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, PANEL, PANEL_BD, card,
         SC_FULL as FULL, SC_HALF as HALF, SC_ZERO as ZERO } from "./theme";

const OUTCOMES = [
  {
    key: "full", color: FULL,
    rule: "your identifier matches the key's for that cluster, or any term in its accepted set",
    extra: "Also full where the key names a specific anatomical region for the cluster and your labeller correctly names a cell type contained in it.",
  },
  {
    key: "half", color: HALF,
    rule: "the key names a cell type for that cluster and your labeller names the region containing it",
    extra: "Right neighbourhood, wrong grain. Retreating up the ontology buys safety on a hard cluster, so it has to cost something.",
  },
  {
    key: "zero", color: ZERO,
    rule: "everything else",
    extra: "Including a cell type narrower than the key's own cell type for that cluster. Depth alone earns nothing, and a sibling term scores like a stranger.",
  },
];

// ── the two cases where direction matters ─────────────────────────────────
// Two panels rather than one tree, because the full case and the half case have DIFFERENT kinds of
// term in the key. A single tree with one key node cannot show both without misstating one.
function CaseDiagram() {
  const cases = [
    {
      badge: "full", color: FULL, bg: "#f0f6f2", bd: "#cfe0d6",
      top: { role: "the key", text: "a specific anatomical region", muted: false },
      bottom: { role: "your answer", text: "a cell type inside it", muted: false },
      note: "The key stopped at the region; you named what is in it and were right. That is not penalised.",
    },
    {
      badge: "half", color: HALF, bg: "#fdf8ec", bd: "#eddcbb",
      top: { role: "your answer", text: "the region containing it", muted: false },
      bottom: { role: "the key", text: "a cell type", muted: false },
      note: "You named the container instead of the thing. Right neighbourhood, and only half of it.",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(272px, 1fr))", gap: 18 }}>
      {cases.map((c) => (
        <div key={c.badge} style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 11,
                                    padding: "17px 19px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        textTransform: "uppercase", color: c.color, marginBottom: 14 }}>
            {c.badge}
          </div>

          {[c.top, c.bottom].map((n, i) => (
            <div key={n.role}>
              {i === 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0 5px 9px" }}>
                  <span style={{ color: c.color, fontSize: 13, lineHeight: 1 }}>↓</span>
                  <span style={{ fontFamily: MONO, fontSize: 8.5, color: FAINT, letterSpacing: 0.5 }}>
                    contains
                  </span>
                </div>
              )}
              <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 8,
                            padding: "9px 12px" }}>
                <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.7,
                              textTransform: "uppercase", color: MUTED }}>
                  {n.role}
                </div>
                <div style={{ fontSize: 12.5, color: INK, marginTop: 3 }}>{n.text}</div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55, marginTop: 13 }}>{c.note}</div>
        </div>
      ))}
    </div>
  );
}

export default function ScoringSection() {
  return (
    <div>
      <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 660, marginBottom: 26 }}>
        <p style={{ margin: "0 0 17px" }}>
          Clusters are scored one at a time. The identifier your labeller returned for a cluster is
          compared against the identifier the key holds for that same cluster, both normalised on
          the pinned ontology. Synonyms resolve to the same term, so spelling is never the error.
        </p>
        <p style={{ margin: 0 }}>
          Credit is <strong>asymmetric</strong>, and narrowly so. Answering a cluster more
          specifically than the key did is sometimes free and sometimes worth nothing — it depends
          on what kind of term the key holds for that cluster.
        </p>
      </div>

      {/* the three outcomes */}
      <div style={{ background: PANEL, border: `1px solid ${PANEL_BD}`, borderRadius: 14,
                    padding: "20px 20px 8px", marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                      textTransform: "uppercase", color: MUTED, marginBottom: 14, paddingLeft: 2 }}>
          the rule
        </div>
        {OUTCOMES.map((t) => (
          <div key={t.key} style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                                    padding: "15px 17px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 13, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.9,
                             textTransform: "uppercase", color: t.color,
                             background: `${t.color}14`, border: `1px solid ${t.color}40`,
                             borderRadius: 999, padding: "3px 11px" }}>
                {t.key}
              </span>
              <span style={{ fontSize: 13.5, color: INK, fontWeight: 550 }}>{t.rule}</span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.6, paddingLeft: 2 }}>
              {t.extra}
            </div>
          </div>
        ))}
      </div>

      {/* the two directional cases */}
      <div style={{ ...card, padding: "24px 26px", marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                      textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
          the two cases where direction matters
        </div>
        <CaseDiagram />
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 16, lineHeight: 1.6, maxWidth: 700 }}>
          The same one step, in two directions, is not the same answer for a cluster — and only
          because the key holds a different kind of term in each case. Where the key already names
          a cell type, answering with a narrower cell type beneath it is <strong>zero</strong>, not
          full. There is no general credit for going deeper.
        </div>
      </div>

      {/* what is reported alongside */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div style={{ ...card, padding: "19px 21px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        textTransform: "uppercase", color: ACCENT, marginBottom: 9 }}>
            reported alongside
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 600, marginBottom: 7 }}>
            Strict exact-match accuracy
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            The graded score is not reported on its own. Exact identifier match, cluster by cluster
            — no partial credit, no containment — is published beside it, so the graded number can
            never quietly carry the result.
          </div>
        </div>

        <div style={{ ...card, padding: "19px 21px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        textTransform: "uppercase", color: ACCENT, marginBottom: 9 }}>
            per-cluster flag
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 600, marginBottom: 9 }}>
            Whether a cluster is scored at all
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 9 }}>
            {["contested", "evidence-ambiguous", "removed"].map((f) => (
              <span key={f} style={{ fontFamily: MONO, fontSize: 10, color: MUTED,
                                     background: "#f1efeb", border: `1px solid ${RULE}`,
                                     borderRadius: 999, padding: "3px 9px" }}>
                {f}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            Every cluster carries a scoring flag, and that flag decides whether the answer for it
            counts at all. Which clusters were excluded, and under which flag, is reported with the
            score.
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: "17px 21px", marginTop: 18, borderLeft: `3px solid ${FAINT}` }}>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>Not yet finalised.</strong> The shape of the credit is
          fixed and stated above. Still to be published: the exact weights, what counts as a
          region that is <em>not overly broad</em>, the containment test that decides whether one
          term sits inside another, and the definition of the accepted answer sets. They are
          deliberately not guessed here.
        </div>
      </div>
    </div>
  );
}
