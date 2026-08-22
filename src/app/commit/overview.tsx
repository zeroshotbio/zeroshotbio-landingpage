// The one-glance version, directly under the masthead stats: what goes in, what comes out.
//
// Deliberately the plainest thing on the page. It borrows the masthead's own vocabulary — the
// monospace uppercase micro-label over a short line of content, the same hairline rules and warm
// card — so it reads as part of the header rather than as the first figure. Everything it says is
// expanded somewhere below; nothing is only here.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, FILE, SCORE, SC_FULL, SC_HALF, SC_ZERO, nfmt } from "./theme";
import { IconInput, IconOutput, IconScore } from "./icons";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

// One shared header for all three boxes: glyph, then the side's name in its own colour. The glyph
// is what separates them at a glance; the colour only reinforces it.
function Head({ side, color, icon }: { side: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color, marginBottom: 12 }}>
      {icon}
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
                     textTransform: "uppercase" }}>
        {side}
      </span>
    </div>
  );
}

function Box({ side, color, icon, lines }: {
  side: string; color: string; icon: React.ReactNode; lines: string[];
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                  padding: "18px 20px", minWidth: 0 }}>
      <Head side={side} color={color} icon={icon} />
      {lines.map((l, i) => (
        <div key={l} style={{ fontSize: 13, color: INK, lineHeight: 1.5,
                              padding: "6px 0",
                              borderTop: i === 0 ? "none" : "1px solid #f2efeb" }}>
          {l}
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const cells = nfmt((H5AD as any).shape.cells);
  const terms = nfmt((MENU as any).n_terms);

  return (
    <div style={{ marginTop: 34 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.cov-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:0;align-items:stretch}
.cov-mid{display:flex;align-items:center;justify-content:center;padding:0 18px}
.cov-arrow{color:${FAINT};font-size:20px;line-height:1}
@media (max-width: 720px){
  .cov-grid{grid-template-columns:1fr}
  .cov-mid{padding:12px 0}
  .cov-arrow{transform:rotate(90deg)}
}`,
        }}
      />
      <div className="cov-grid">
        <Box
          side="the input"
          color={FILE}
          icon={<IconInput />}
          lines={[
            "Three ranked DEG lists per cluster",
            "Per-cluster QC statistics",
            `The full expression matrix — ${cells} cells`,
            "No names, no annotations",
          ]}
        />
        <div className="cov-mid" aria-hidden="true">
          <span className="cov-arrow">→</span>
        </div>
        <Box
          side="the output"
          color={ACCENT}
          icon={<IconOutput />}
          lines={[
            `One ZFA identifier, from ${terms}`,
            "Both axis terms — the cell type, and the structure it sits in",
            "The ancestor chain back to the root",
            "A confidence score and tier",
          ]}
        />
      </div>
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 12, lineHeight: 1.55, maxWidth: 660 }}>
        Per cluster, 112 times. What happens between the two boxes is the contest.
      </div>

      {/* the rule, at a glance — same header treatment as the two boxes above, its own colour */}
      <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                    padding: "18px 20px", marginTop: 16 }}>
        <Head side="evaluation" color={SCORE} icon={<IconScore />} />

        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginBottom: 14, maxWidth: 720 }}>
          Clusters are scored one at a time. The identifier your labeller returns for a cluster is
          compared against the one the key holds for it, on the pinned ontology — synonyms resolve,
          so spelling is never the error.
        </div>

        {[
          {
            k: "Full", c: SC_FULL,
            lead: "Your identifier matches the key's for that cluster, or any term in its accepted set.",
            more: "Also full where the key names a specific anatomical region and your labeller correctly names a cell type contained in it. Answering more precisely than the key is not punished, in that one direction.",
          },
          {
            k: "Half", c: SC_HALF,
            lead: "The key names a cell type for that cluster and your labeller names the region containing it.",
            more: "Right neighbourhood, wrong grain. Retreating up the ontology buys safety on a hard cluster, so it has to cost something.",
          },
          {
            k: "Zero", c: SC_ZERO,
            lead: "Everything else, including a cell type narrower than the key's own cell type for that cluster.",
            more: "Depth on its own earns nothing. A sibling term, however close, scores the same as an unrelated one.",
          },
        ].map((o, i) => (
          <div key={o.k} style={{ padding: "11px 0", borderTop: i === 0 ? `1px solid ${RULE}` : "1px solid #f2efeb" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8,
                             textTransform: "uppercase", color: o.c, minWidth: 40, flexShrink: 0 }}>
                {o.k}
              </span>
              <span style={{ fontSize: 13, color: INK, lineHeight: 1.5, fontWeight: 550 }}>{o.lead}</span>
            </div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 5, paddingLeft: 52 }}>
              {o.more}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 13, paddingTop: 12,
                      borderTop: `1px solid ${RULE}`, lineHeight: 1.6 }}>
          Strict exact-match accuracy, cluster by cluster, is reported beside the graded score, so
          the graded number never carries the result on its own. Every cluster also carries a flag
          — contested, evidence-ambiguous or removed — which decides whether its answer is scored
          at all.
        </div>
      </div>
    </div>
  );
}
