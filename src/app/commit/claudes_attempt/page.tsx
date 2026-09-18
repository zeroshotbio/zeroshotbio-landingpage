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
  ["zscape_gold_48hpf.v0.h5ad (461 MB)",
    "209,639 cells × 32,031 genes from ZSCAPE's 48 hpf wild-type control embryos: raw counts plus log1p counts-per-10k, "
    + "and the 112 given clusters as bare ids C001–C112, with no names"],
  ["gold_features.v1.csv",
    "per cluster, the top 50 up-regulated, bottom 50 down-regulated and 'family' 50 marker genes, with Ensembl ids, "
    + "plus cell count, UMIs, genes detected and % mitochondrial"],
  ["zfa_menu.v1 (3,107 terms, hash dec9f728)", "the only allowed answers, each with its parents, synonyms and stage window"],
  ["scoring_rules.v0.md, submission_format.v0.md, validate_submission.py", "how answers are scored, formatted and checked"],
  ["ZFA ontology, release 2026-06-02", "zfa.obo, for the term hierarchy and ZFS developmental stages"],
  ["ZFIN wild-type expression, downloaded 2026-06-21",
    "curated gene → anatomy → stage records; it used those between prim-5 and protruding-mouth (24–72 hpf) "
    + "and cites them by publication id in each answer"],
  ["Daniocell (Sur et al. 2023)",
    "a separate zebrafish atlas it downloaded from daniocell.nichd.nih.gov; it compared our clusters with Daniocell's "
    + "36–60 hpf cells"],
  ["Claude Opus 5's training knowledge", "of zebrafish marker genes and anatomy"],
];
const UNUSED = "Also given but not used: ZFIN's GO annotations (zfin.gaf, 2026-05-21) and the GO ontology, release 2026-05-19.";
const LACKED: [string, string][] = [
  ["The answer key", "and the source cell-type names behind it; its file reads were audited afterwards"],
  ["ZSCAPE's published annotations", "no GEO GSE202639 cell metadata, no Saunders et al. 2023 paper or supplements, no ZSCAPE web app"],
  ["Anything else on our server", "none of our other atlases, labeller code or earlier ZSCAPE work"],
  ["Second opinions from other model calls", "its Anthropic API calls failed because our API account had no credit"],
  ["A GPU", "it ran on 32 CPU cores and about 90 GB of RAM"],
  ["Any feedback", "it never saw its score and got no second attempt"],
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
        <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, padding: "18px 20px", marginTop: 24 }}>
          <div style={{ ...micro, color: SC_FULL, marginBottom: 10 }}>What it used</div>
          {HAD.map(([k, v]) => (
            <p key={k} style={{ ...small, fontSize: 13.5, marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700 }}>{k}</span>: {v}
            </p>
          ))}
          <p style={{ ...small, fontSize: 12.5, color: FAINT, marginTop: 4 }}>{UNUSED}</p>
          <div style={{ borderTop: `1px solid ${RULE}`, margin: "16px 0 14px" }} />
          <div style={{ ...micro, color: SC_ZERO, marginBottom: 10 }}>What it did not have</div>
          {LACKED.map(([k, v]) => (
            <p key={k} style={{ ...small, fontSize: 13.5, marginBottom: 8 }}><strong>{k}</strong>: {v}</p>
          ))}
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
