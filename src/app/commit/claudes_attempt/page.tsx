// /commit/claudes_attempt — how a fresh Claude agent scored on the challenge, overnight 2026-09-18.
//
// Aggregate numbers only. Per-cluster outcomes would tell a reader what the key says (a cluster the
// agent got right reveals its answer), so none are shown and the page is gated with the rest of the
// internal /commit pages in src/middleware.ts. data/summary.json is copied from the benchmark row's
// test_results/attempt_summary_blind_v0.json, which holds counts only. The "had / did not have" lists
// come from the agent's audited SOURCES_LOG.md and its tool-call record.
import React from "react";
import Link from "next/link";
import { PAPER, INK, MONO, RULE, MUTED, FAINT, CARD, SC_FULL, SC_HALF, SC_ZERO } from "../theme";
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
const small: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "var(--cm-prose)", margin: 0 };

export default function ClaudesAttemptPage() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", padding: "56px 0 90px",
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div style={wrap}>
        <div style={micro}>Commit Challenge · overnight run · 18 Sep 2026</div>
        <h1 style={{ fontSize: 34, fontWeight: 680, margin: "12px 0 0", letterSpacing: -0.9, lineHeight: 1.1 }}>
          Claude&apos;s attempt
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: MUTED, margin: "10px 0 0" }}>
          A fresh Claude agent with no knowledge of how the key was built, working from the{" "}
          <Link href="/commit/draft_files" style={{ color: MUTED }}>draft delivery</Link> as it stood on 18 September.
        </p>

        {/* ── what it had: quiet, one card ───────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, padding: "16px 18px", marginTop: 22,
                      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px 24px" }}>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div style={{ ...micro, color: FAINT, marginBottom: 8 }}>{g.title}</div>
              {g.items.map((it) => (
                <div key={it.name} style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: INK, overflowWrap: "anywhere" }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: FAINT, lineHeight: 1.45, marginTop: 1 }}>
                    {it.spec}
                    {it.tag && (
                      <span style={{ color: it.tag === "extra" || it.tag === "replaced" ? SC_HALF : FAINT }}>
                        {" "}· {TAG[it.tag].label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: FAINT, margin: "10px 2px 0", lineHeight: 1.6 }}>
          Off limits: {OFF.join(" · ")}. Every file it read was audited.
        </p>

        {/* ── the two things that matter: the score, and how it compares ── */}
        <div style={{ marginTop: 44, display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 48, fontWeight: 700, letterSpacing: -1.5,
                         fontVariantNumeric: "tabular-nums" }}>{S.all.graded.toFixed(3)}</span>
          <span style={{ fontSize: 15, color: MUTED }}>graded · {S.all.exact} of 112 exactly right</span>
        </div>

        <section style={{ marginTop: 28 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
            {OUT.map((o) => (
              <span key={o.k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: FAINT }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: o.color }} />{o.k}
              </span>
            ))}
          </div>
          {ROWS.map((r) => (
            <div key={r.name} style={{ padding: "9px 0", borderTop: `1px solid ${RULE}`, opacity: r.bold ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: r.bold ? 650 : 400 }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  {r.s.graded.toFixed(3)}<span style={{ color: MUTED }}> · {r.s.exact} exact</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 2, height: r.bold ? 20 : 12 }}>
                {OUT.map((o) => {
                  const n = r.s[o.k];
                  return n > 0 ? (
                    <div key={o.k} title={`${r.name}: ${n} ${o.k}`}
                         style={{ flex: n, background: o.color, borderRadius: 4, display: "flex", alignItems: "center",
                                  paddingLeft: 7, minWidth: 0, color: "var(--cm-paper)", fontFamily: MONO, fontSize: 11,
                                  fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}>
                      {r.bold && n >= 8 ? n : ""}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 44 }}>
          <div style={{ ...micro, marginBottom: 14 }}>How it worked</div>
          <p style={{ ...small, color: MUTED, maxWidth: 660, marginBottom: 18 }}>
            It treated each of the 112 clusters like a mystery sample: collect clues about what the cells are, then
            pick the one ontology term that best fits them.
          </p>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", maxWidth: 660, display: "grid", gap: 16 }}>
            {[
              ["Profile every cluster",
               "For each cluster it worked out which genes are switched on, and in how many of its cells."],
              ["Look the genes up",
               "It checked ZFIN, the zebrafish database, for where each cluster's top genes are known to be active in the embryo at around this age."],
              ["Compare with another atlas",
               "It matched each cluster against Daniocell, a separate atlas whose clusters are already named by experts. This was its most useful clue."],
              ["Review every cluster by hand",
               "It read through all 112, checking the genes against known markers for each tissue and body region."],
              ["Pick the term, with the scoring in mind",
               "Where it was confident it named the cell type. Where it was unsure it named the tissue or organ instead, because that still earns half credit if the key wanted the cell type."],
            ].map(([t, d], i) => (
              <li key={t} style={{ display: "flex", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: FAINT, paddingTop: 2, flex: "0 0 16px" }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{t}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, marginTop: 2 }}>{d}</div>
                </div>
              </li>
            ))}
          </ol>
          <p style={{ ...small, color: MUTED, maxWidth: 660, marginTop: 18 }}>
            Every answer lists the ZFIN records, the Daniocell match and the genes it relied on, so each call can be checked.
          </p>
        </section>

        <p style={{ fontSize: 12, color: FAINT, marginTop: 36, lineHeight: 1.6 }}>
          Not blind to us: we wrote the key. The agent was not shown its score.
        </p>
      </div>
    </main>
  );
}
