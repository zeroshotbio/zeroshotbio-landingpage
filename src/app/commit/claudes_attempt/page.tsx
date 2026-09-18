// /commit/claudes_attempt — how a fresh Claude agent scored on the challenge, overnight 2026-09-18.
//
// Aggregate numbers only. Per-cluster outcomes would tell a reader what the key says (a cluster the
// agent got right reveals its answer), so none are shown and the page is gated with the rest of the
// internal /commit pages in src/middleware.ts. data/summary.json is copied from the benchmark row's
// test_results/attempt_summary_blind_v0.json, which holds counts only.
import React from "react";
import Link from "next/link";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, CARD, SERIES, SC_FULL, SC_HALF, SC_ZERO } from "../theme";
import S from "./data/summary.json";

export const metadata = {
  title: "Claude's attempt · The Commit Challenge",
  description: "A fresh Claude agent attempted the Commit Challenge blind: 0.549 graded, 40 of 112 exact.",
};

type Split = { full: number; half: number; zero: number; graded: number; exact: number };
const ROWS: { name: string; note: string; s: Split; highlight?: boolean }[] = [
  { name: "Claude, blind", note: "markers + ZFIN + Daniocell, reasoned per cluster", s: { ...S.all }, highlight: true },
  { name: "Public-label shortcut", note: "ZSCAPE's published names, string-matched", s: { ...S.baselines.public_label_shortcut, zero: 112 - S.baselines.public_label_shortcut.full - S.baselines.public_label_shortcut.half } },
  { name: "ZFIN lookup", note: "no model; top markers to most specific term", s: { ...S.baselines.zfin_lookup, zero: 112 - S.baselines.zfin_lookup.full - S.baselines.zfin_lookup.half } },
];
const OUT = [
  { k: "full", label: "full", color: SC_FULL },
  { k: "half", label: "half", color: SC_HALF },
  { k: "zero", label: "zero", color: SC_ZERO },
] as const;

const wrap: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "0 16px" };
const micro: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                                     textTransform: "uppercase", color: MUTED };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 650, letterSpacing: -0.3, margin: "0 0 6px" };
const lede: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.65, color: "var(--cm-lede)", margin: "0 0 18px", maxWidth: 680 };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div style={micro}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// One horizontal bar on a 0–1 scale, single series. 4px rounded data end, anchored at zero.
function Bar({ value, label, title, color = SERIES }: { value: number; label: string; title: string; color?: string }) {
  return (
    <div title={title} style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 14, background: "var(--cm-surf-3)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: "0 4px 4px 0" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, minWidth: 64, textAlign: "right",
                     fontVariantNumeric: "tabular-nums" }}>{label}</span>
    </div>
  );
}

export default function ClaudesAttemptPage() {
  const tiers = (["high", "medium", "low"] as const).map((t) => ({ t, ...S.by_confidence_tier[t] }));
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", padding: "56px 0 90px",
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div style={wrap}>
        <div style={{ ...micro, color: ACCENT, letterSpacing: 1.3 }}>Commit Challenge · overnight run · 18 Sep 2026</div>
        <h1 style={{ fontSize: 36, fontWeight: 680, margin: "12px 0 0", letterSpacing: -1, lineHeight: 1.1 }}>
          Claude&apos;s attempt
        </h1>
        <p style={{ ...lede, fontSize: 16, marginTop: 14 }}>
          A fresh Claude agent, with no memory of how the challenge or its key were built, got exactly the files
          Commit would get and was asked to do its best. It worked alone for {S.contestant.hours} hours, and every
          file it read was audited afterwards. The key was never visible to it.
        </p>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginTop: 26 }}>
          <Stat k="graded score" v={S.all.graded.toFixed(3)} sub={`it predicted ${S.contestant.self_predicted_graded.toFixed(2)}`} />
          <Stat k="exactly right" v={`${S.all.exact}/112`} sub={pct(S.all.exact_rate)} />
          <Stat k="clean / ambiguous" v={`${S.clean.graded.toFixed(2)} / ${S.ambiguous.graded.toFixed(2)}`} sub="81 and 31 clusters" />
        </div>
      </div>

      {/* ── 1: against the baselines ─────────────────────────────────── */}
      <section style={{ ...wrap, marginTop: 52 }}>
        <h2 style={h2}>Against the two baselines</h2>
        <p style={lede}>
          Each bar is the 112 clusters, split by the credit each one earned. A careful agent more than doubles a
          lookup script, but it only just beats copying ZSCAPE&apos;s public labels, the leak the draft files flag.
        </p>
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          {OUT.map((o) => (
            <span key={o.k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: o.color }} />{o.label}
            </span>
          ))}
        </div>
        {ROWS.map((r) => (
          <div key={r.name} style={{ padding: "12px 0", borderTop: `1px solid ${RULE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 7 }}>
              <span>
                <span style={{ fontSize: 14.5, fontWeight: r.highlight ? 700 : 600 }}>{r.name}</span>
                <span style={{ fontSize: 12.5, color: FAINT, marginLeft: 8 }}>{r.note}</span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                <strong>{r.s.graded.toFixed(3)}</strong><span style={{ color: MUTED }}> graded · {r.s.exact} exact</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 2, height: 22 }}>
              {OUT.map((o) => {
                const n = r.s[o.k];
                return n > 0 ? (
                  <div key={o.k} title={`${r.name}: ${n} ${o.label}`}
                       style={{ flex: n, background: o.color, borderRadius: 4, display: "flex", alignItems: "center",
                                paddingLeft: 7, minWidth: 0, color: "var(--cm-paper)", fontFamily: MONO,
                                fontSize: 11, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}>
                    {n >= 8 ? n : ""}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── 2: the hedge ──────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginTop: 52 }}>
        <h2 style={h2}>The scoring rule rewards hedging</h2>
        <p style={lede}>
          Naming a structure earns half credit when the key wants the cell type inside it, but naming a cell type
          earns nothing when the key wants the structure. So when unsure, the safe move is the structure. The agent
          worked this out and answered {S.structure_answers_on_cell_keyed} of the {S.cell_keyed} cell-type clusters
          with a structure. A single repeated hedge accounts for {S.hedge_halves} half-credit answers; had it named
          the cell type there, it would have scored {S.graded_if_hedge_named_cell.toFixed(3)}.
        </p>
        <div style={{ display: "grid", gap: 10, maxWidth: 620 }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>What it scored</div>
            <Bar value={S.all.graded} label={S.all.graded.toFixed(3)} title="graded score as submitted" />
          </div>
          <div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Naming the cell type on that one repeated call</div>
            <Bar value={S.graded_if_hedge_named_cell} label={S.graded_if_hedge_named_cell.toFixed(3)}
                 title="graded score if the repeated hedge had named the cell type" color={ACCENT} />
          </div>
        </div>
        <p style={{ fontSize: 13, color: FAINT, marginTop: 10 }}>
          To decide before the run: whether the region should keep half credit, or whether a parent cell type
          should earn something too.
        </p>
      </section>

      {/* ── 3: calibration ────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginTop: 52 }}>
        <h2 style={h2}>Its confidence meant something</h2>
        <p style={lede}>
          Every answer carries a confidence tier from the agent&apos;s own rubric. The share of full-credit answers
          falls with the tier, so a reader can trust the high-confidence calls more.
        </p>
        <div style={{ display: "grid", gap: 12, maxWidth: 620 }}>
          {tiers.map((x) => (
            <div key={x.t}>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>
                <span style={{ fontWeight: 650, color: INK, textTransform: "capitalize" }}>{x.t}</span> · {x.n} answers
              </div>
              <Bar value={x.full / x.n} label={`${x.full} of ${x.n}`} title={`${x.t}: ${x.full} of ${x.n} full credit`} />
            </div>
          ))}
        </div>
      </section>

      {/* ── what it means ─────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginTop: 52 }}>
        <h2 style={h2}>What this says about the challenge</h2>
        {[
          "The files work: a contestant with nothing else went from delivery to a valid, fully cited submission unaided.",
          "It is hard in the right way: careful reasoning scored 0.55, well above a lookup script at 0.21.",
          "Strict matching costs real biology: many zeros are defensible answers under a neighbouring name or one level off, and the rule scores them the same as a wrong answer.",
          "The public-label leak is still the main risk: an agent that looked up ZSCAPE's names and translated them properly would beat careful work.",
        ].map((t) => (
          <p key={t} style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--cm-prose)", margin: "0 0 10px",
                              paddingLeft: 14, borderLeft: `2px solid ${RULE}` }}>{t}</p>
        ))}
        <p style={{ fontSize: 12.5, color: FAINT, marginTop: 18, lineHeight: 1.6 }}>
          Not blind to us: we wrote the key. Sources the agent used: {S.contestant.sources.join(", ")}. The agent
          was not shown its score or allowed a second try. See also{" "}
          <Link href="/commit/draft_files" style={{ color: ACCENT }}>the draft files</Link>.
        </p>
      </section>
    </main>
  );
}
