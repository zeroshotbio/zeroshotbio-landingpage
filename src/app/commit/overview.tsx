// The one-glance version, directly under the masthead stats: what goes in, what comes out.
//
// Deliberately the plainest thing on the page. It borrows the masthead's own vocabulary — the
// monospace uppercase micro-label over a short line of content, the same hairline rules and warm
// card — so it reads as part of the header rather than as the first figure. Everything it says is
// expanded somewhere below; nothing is only here.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, FILE, SC_FULL, SC_HALF, SC_ZERO, nfmt } from "./theme";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

function Box({ side, color, lines }: { side: string; color: string; lines: string[] }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                  padding: "18px 20px", minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
                    textTransform: "uppercase", color, marginBottom: 12 }}>
        {side}
      </div>
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

      {/* the rule, at a glance — same box vocabulary, one row per outcome */}
      <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10,
                    padding: "18px 20px", marginTop: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
                      textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>
          how it is scored
        </div>
        {[
          { k: "Full", c: SC_FULL, t: "you match the key, or name a cell type inside the region it names" },
          { k: "Half", c: SC_HALF, t: "the key names a cell type and you name the region containing it" },
          { k: "Zero", c: SC_ZERO, t: "everything else" },
        ].map((o, i) => (
          <div key={o.k} style={{ display: "flex", gap: 12, alignItems: "baseline",
                                  padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid #f2efeb" }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7,
                           textTransform: "uppercase", color: o.c, minWidth: 38 }}>
              {o.k}
            </span>
            <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{o.t}</span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10, lineHeight: 1.55 }}>
          Your identifier against the key&apos;s, on the pinned ontology — synonyms resolve,
          spelling is never the error. Strict exact-match accuracy is reported alongside.
        </div>
      </div>
    </div>
  );
}
