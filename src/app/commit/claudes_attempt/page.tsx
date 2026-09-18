// /commit/claudes_attempt — how a fresh Claude agent scored on the challenge, overnight 2026-09-18.
//
// Aggregate numbers only. Per-cluster outcomes would tell a reader what the key says (a cluster the
// agent got right reveals its answer), so none are shown and the page is gated with the rest of the
// internal /commit pages in src/middleware.ts. data/summary.json is copied from the benchmark row's
// test_results/attempt_summary_blind_v0.json, which holds counts only. The "had / did not have" lists
// come from the agent's audited SOURCES_LOG.md and its tool-call record.
import React from "react";
import Link from "next/link";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, CARD, FILE, SERIES, SC_FULL, SC_HALF, SC_ZERO } from "../theme";
import S from "./data/summary.json";

export const metadata = {
  title: "Claude's attempt · The Commit Challenge",
  description: "A fresh Claude agent attempted the Commit Challenge blind: 0.549 graded, 40 of 112 exact.",
};

// What the agent had, grouped so the box reads at a glance: name in mono, one short spec, and a tag
// saying where it came from. The delivery files were checked byte-identical to /commit/draft_files.
type Item = { name: string; spec: string; tag?: "draft" | "pinned" | "extra" | "replaced" };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Data · the draft delivery", items: [
    { name: "zscape_gold_48hpf.v0.h5ad", spec: "209,639 cells × 32,031 genes, 48 hpf; 112 unnamed clusters", tag: "draft" },
    { name: "gold_features.v1.csv", spec: "top, bottom and family 50 markers per cluster; its family lists were later found defective", tag: "replaced" },
    { name: "zfa_menu.v1", spec: "3,107 allowed ZFA answers", tag: "draft" },
  ] },
  { title: "References", items: [
    { name: "ZFA", spec: "release 2026-06-02", tag: "pinned" },
    { name: "ZFIN wild-type expression", spec: "2026-06-21 dump, 24–72 hpf records", tag: "pinned" },
    { name: "Daniocell", spec: "Sur et al. 2023, 36–60 hpf cells; fetched it itself", tag: "extra" },
  ] },
  { title: "Reasoning", items: [
    { name: "Claude Opus 5", spec: "its own marker knowledge" },
    { name: "6.3 hours, alone", spec: "32 CPU cores, no GPU" },
  ] },
];
const TAG = {
  draft: { label: "same file as /draft_files", color: SC_FULL },
  pinned: { label: "pinned in sources.v0.json", color: SC_FULL },
  extra: { label: "not in the delivery", color: SC_HALF },
  replaced: { label: "since replaced by v2", color: SC_HALF },
};
const OFF = ["the answer key", "ZSCAPE's labels, paper or GEO data", "anything else on our server",
             "other model calls (no API credit)", "its score or a second try"];

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
          A fresh Claude agent with no knowledge of how the key was built. It worked from the{" "}
          <Link href="/commit/draft_files" style={{ color: ACCENT }}>/draft_files</Link> delivery as it stood on
          18 September and the pinned references, plus one public atlas it fetched itself, which Commit has not been
          given.
        </p>

        {/* ── what it had ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 24 }}>
          {GROUPS.map((g) => (
            <div key={g.title} style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, padding: "14px 16px",
                                        borderTop: `3px solid ${SC_FULL}` }}>
              <div style={{ ...micro, color: SC_FULL, marginBottom: 10 }}>{g.title}</div>
              {g.items.map((it) => (
                <div key={it.name} style={{ marginBottom: 11 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: FILE, overflowWrap: "anywhere" }}>{it.name}</div>
                  <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45, marginTop: 2 }}>{it.spec}</div>
                  {it.tag && (
                    <span style={{ display: "inline-block", marginTop: 4, fontFamily: MONO, fontSize: 9.5, fontWeight: 700,
                                   letterSpacing: 0.4, textTransform: "uppercase", color: TAG[it.tag].color,
                                   border: `1px solid ${TAG[it.tag].color}`, borderRadius: 4, padding: "1px 5px" }}>
                      {TAG[it.tag].label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }}>
          <span style={{ ...micro, color: SC_ZERO, marginRight: 4 }}>Off limits</span>
          {OFF.map((o) => (
            <span key={o} style={{ fontSize: 12.5, color: SC_ZERO, border: `1px solid ${SC_ZERO}`, borderRadius: 999,
                                   padding: "3px 10px", whiteSpace: "nowrap" }}>✕ {o}</span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: FAINT, margin: "8px 0 0" }}>Every file it read was audited afterwards.</p>

        {/* ── amendment ───────────────────────────────────────────── */}
        <div style={{ marginTop: 22, padding: "12px 16px", borderRadius: 10, border: `1px solid ${RULE}`,
                      borderLeft: `3px solid ${ACCENT}`, background: CARD }}>
          <div style={{ ...micro, color: ACCENT, marginBottom: 6 }}>Amended after the audit · answers unchanged</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13, color: "var(--cm-prose)", lineHeight: 1.5 }}>
            <span><strong>{S.amendment.ancestor_chains_full}/112</strong> ancestor chains now list every ancestor, as the docs require</span>
            <span><strong>{S.amendment.traceable_before} → {S.amendment.traceable_after}/112</strong> answers traceable to cited evidence ({S.amendment.untraceable} still not)</span>
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
