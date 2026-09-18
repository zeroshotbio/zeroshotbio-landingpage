// /commit/claudes_attempt — how a fresh Claude agent scored on the challenge, overnight 2026-09-18.
//
// Aggregate numbers only. Per-cluster outcomes would tell a reader what the key says (a cluster the
// agent got right reveals its answer), so none are shown and the page is gated with the rest of the
// internal /commit pages in src/middleware.ts. data/summary.json is copied from the benchmark row's
// test_results/attempt_summary_blind_v0.json, which holds counts only. The "had / did not have" lists
// come from the agent's audited SOURCES_LOG.md and its tool-call record.
import React from "react";
import Link from "next/link";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, CARD, SERIES, SC_FULL, SC_HALF, SC_ZERO } from "../theme";
import S from "./data/summary.json";

export const metadata = {
  title: "Claude's attempt · The Commit Challenge",
  description: "A fresh Claude agent attempted the Commit Challenge blind: 0.549 graded, 40 of 112 exact.",
};

const HAD: [string, string][] = [
  ["The delivery", "the matrix, the three marker lists, the 3,107-term menu, the rules and the validator: the same files Commit gets"],
  ["ZFA", "the pinned anatomy ontology, for term structure and stage windows"],
  ["ZFIN wild-type expression", "the pinned gene-to-anatomy records, cited per answer"],
  ["Daniocell", "a separate public atlas (Sur et al. 2023), which it downloaded itself as a reference"],
  ["Its own knowledge", "of zebrafish markers and anatomy"],
];
const LACKED = [
  "the answer key, or anything on our server beyond its workspace (audited)",
  "ZSCAPE's own labels, paper or GEO metadata",
  "model second opinions: its API calls failed because our API account had no credit",
  "a GPU (32 CPU cores only), and any feedback or second try",
];

type Split = { full: number; half: number; zero: number; graded: number; exact: number };
const zeros = (b: { full: number; half: number }) => 112 - b.full - b.half;
const ROWS: { name: string; s: Split; bold?: boolean }[] = [
  { name: "Claude, blind", s: S.all, bold: true },
  { name: "Copying ZSCAPE's public labels", s: { ...S.baselines.public_label_shortcut, zero: zeros(S.baselines.public_label_shortcut) } },
  { name: "ZFIN lookup script, no model", s: { ...S.baselines.zfin_lookup, zero: zeros(S.baselines.zfin_lookup) } },
];
const OUT = [
  { k: "full", color: SC_FULL }, { k: "half", color: SC_HALF }, { k: "zero", color: SC_ZERO },
] as const;

const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "0 16px" };
const micro: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                                     textTransform: "uppercase", color: MUTED };
const h2: React.CSSProperties = { fontSize: 19, fontWeight: 650, letterSpacing: -0.3, margin: "0 0 12px" };
const small: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "var(--cm-prose)", margin: 0 };

export default function ClaudesAttemptPage() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", padding: "56px 0 90px",
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div style={wrap}>
        <div style={{ ...micro, color: ACCENT, letterSpacing: 1.3 }}>Commit Challenge · overnight run · 18 Sep 2026</div>
        <h1 style={{ fontSize: 34, fontWeight: 680, margin: "12px 0 0", letterSpacing: -0.9, lineHeight: 1.1 }}>
          Claude&apos;s attempt
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--cm-lede)", margin: "12px 0 0" }}>
          A fresh Claude agent with no knowledge of how the key was built, working alone for {S.contestant.hours} hours.
        </p>

        {/* ── what it had ─────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, padding: "18px 20px", marginTop: 24,
                      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 22 }}>
          <div>
            <div style={{ ...micro, color: SC_FULL, marginBottom: 8 }}>What it used</div>
            {HAD.map(([k, v]) => (
              <p key={k} style={{ ...small, fontSize: 13.5, marginBottom: 7 }}><strong>{k}</strong>: {v}</p>
            ))}
          </div>
          <div>
            <div style={{ ...micro, color: SC_ZERO, marginBottom: 8 }}>What it did not have</div>
            {LACKED.map((v) => (
              <p key={v} style={{ ...small, fontSize: 13.5, marginBottom: 7 }}>{v.charAt(0).toUpperCase() + v.slice(1)}</p>
            ))}
          </div>
        </div>

        {/* ── score ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 36 }}>
          {[["graded score", S.all.graded.toFixed(3)], ["exactly right", `${S.all.exact}/112`],
            ["confident & right", `${S.by_confidence_tier.high.full}/${S.by_confidence_tier.high.n}`]].map(([k, v]) => (
            <div key={k}>
              <div style={micro}>{k}</div>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>

        <section style={{ marginTop: 40 }}>
          <h2 style={h2}>Against the baselines</h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            {OUT.map((o) => (
              <span key={o.k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: o.color }} />{o.k}
              </span>
            ))}
          </div>
          {ROWS.map((r) => (
            <div key={r.name} style={{ padding: "10px 0", borderTop: `1px solid ${RULE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: r.bold ? 700 : 500 }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  <strong>{r.s.graded.toFixed(3)}</strong><span style={{ color: MUTED }}> · {r.s.exact} exact</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 2, height: 20 }}>
                {OUT.map((o) => {
                  const n = r.s[o.k];
                  return n > 0 ? (
                    <div key={o.k} title={`${r.name}: ${n} ${o.k}`}
                         style={{ flex: n, background: o.color, borderRadius: 4, display: "flex", alignItems: "center",
                                  paddingLeft: 7, minWidth: 0, color: "var(--cm-paper)", fontFamily: MONO, fontSize: 11,
                                  fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}>
                      {n >= 8 ? n : ""}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 40 }}>
          <h2 style={h2}>Two things to fix before the run</h2>
          <p style={{ ...small, marginBottom: 12 }}>
            <strong>The rule rewards hedging.</strong> A structure earns half when the key wants a cell type, but a cell
            type earns nothing when the key wants a structure, so the agent named structures when unsure. One repeated
            hedge cost it {S.hedge_halves} half-credit answers; naming the cell type would have scored{" "}
            <span style={{ color: SERIES, fontWeight: 700 }}>{S.graded_if_hedge_named_cell.toFixed(3)}</span>.
          </p>
          <p style={small}>
            <strong>The public labels leak.</strong> Careful work only just beat copying ZSCAPE&apos;s published names,
            and a solver that translated them properly would win. Score the real run on unpublished clusters.
          </p>
        </section>

        <p style={{ fontSize: 12.5, color: FAINT, marginTop: 36, lineHeight: 1.6 }}>
          Not blind to us: we wrote the key. The agent was not shown its score. See{" "}
          <Link href="/commit/draft_files" style={{ color: ACCENT }}>the draft files</Link>.
        </p>
      </div>
    </main>
  );
}
