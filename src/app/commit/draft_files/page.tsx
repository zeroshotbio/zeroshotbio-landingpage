// /commit/draft_files — the working draft of what Commit receives, and whether it holds up.
//
// Internal. Gated by src/middleware.ts (Basic Auth) together with the downloads under
// public/commit/draft_files/files/. Everything renders from data/bundle.json, written by
// scripts/build_commit_draft_files.py from the benchmark row. That script copies only answer-free
// files and counts-only test output. The answer key itself is listed by name and never published.
//
// The tests are the point of the page. They run against the delivered files, the answer key and
// the prose on /commit, and they are written so that a failure is a decision someone has to make.
import React from "react";
import Link from "next/link";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, CARD, FILE, SC_FULL, SC_HALF, SC_ZERO, nfmt } from "../theme";
import BUNDLE from "./data/bundle.json";

export const metadata = {
  title: "Draft files · The Commit Challenge",
  description: "Working draft of the Commit delivery: the files, the answer key in outline, and the test suite run against both.",
};

type Test = { id: string; group: string; title: string; why: string; status: "pass" | "warn" | "fail"; detail: string };
type FileRow = { name: string; audience: string; what: string; bytes: number | null; sha256: string | null; href: string | null; location: string | null };
const B = BUNDLE as unknown as {
  files: FileRow[]; results: { ran_at: string; counts: Record<string, number>; tests: Test[] };
  key_summary: Record<string, any>; row: string; menu_version_hash: string;
};

const GROUPS: Record<string, string> = {
  A: "Commit can load and join the files",
  B: "The answer key is consistent",
  C: "The /commit pages match the files",
  D: "The scoring rule can be computed, and not gamed",
  E: "The challenge forces an agentic solution",
  F: "Mukhtar's five asks are covered",
};

// What to do about each failing or amber test. Hand-written; keyed by test id.
const NEXT: Record<string, string> = {
  test_public_labels_cannot_be_joined:
    "All 112 clusters are ZSCAPE's own published cell types, and ZSCAPE's per-cell labels are public on GEO. Removing the cell ids doesn't help, because the raw counts alone identify the cells. Recommendation: keep this set as the practice set, and score the real run on unpublished clusters (MiniFin or MegaFin) that Commit only sees on the day, with a time limit.",
  test_shortcut_does_not_beat_biology:
    "This follows from the leak above. Matching the recovered public names to ZFA by plain string match already beats the marker-based lookup, and a model translating the names would do better still. The fix is the same.",
  test_axes_sit_in_the_right_branch:
    "One key row gives a cell type as its anatomy term. That breaks the key's own submission rule and the two-branch claim on /commit. A curator should replace it with the structure it sits in.",
  test_key_terms_exist_at_48hpf:
    "Two key answers are terms that, according to ZFA, stop existing before 48 hpf. A curator should either keep them (the cells may be persisting remnants) or switch to the later-stage term. The cluster ids are in the local test log.",
  test_retreat_within_cells_vs_to_region:
    "Under the rule as written, answering the parent cell type scores zero while answering the region scores half. Decide whether that ordering is intended before the rule goes to Commit.",
  test_precise_answer_clause_is_reachable:
    "The 'more precise than the key' full-credit clause can only apply where ZFA links a cell type to the region. The rule is not broken; it just seldom applies.",
  test_constant_answer_is_weak:
    "One cell type is the answer for a sixth of the key, so a single constant answer already scores 17% exact. Report exact accuracy per cell type as well as overall, or down-weight the repeated type.",
  test_set_is_too_big_to_hand_label:
    "A person can label 112 clusters by hand in a few days. A held-out set released at run time is what makes building an agent cheaper than hiring an annotator.",
  test_ask4_scoring_rules_written:
    "scoring_rules.v0.md is a complete draft, and the reference scorer implements it. It still needs sign-off, and after that the 'Not yet finalised' note on /commit can go.",
  test_ask5_baseline_named:
    "The only baseline is a script with no model: the ZFIN lookup. Our own labeller has not run on this set. Every number carries the not-blind caveat.",
};

const STATUS: Record<string, { label: string; color: string }> = {
  pass: { label: "pass", color: SC_FULL }, warn: { label: "warn", color: SC_HALF }, fail: { label: "fail", color: SC_ZERO },
};

const AUDIENCE: Record<string, string> = {
  before: "Goes to Commit before the run",
  after: "Goes to Commit after the run",
  internal: "Ours",
};

const size = (b: number | null) =>
  b == null ? "" : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

const wrap: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "0 16px" };
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 650, letterSpacing: -0.4, margin: "0 0 6px", color: INK };
const lede: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.65, color: "var(--cm-lede)", margin: "0 0 20px", maxWidth: 720 };
const micro: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED };

function Pill({ s }: { s: string }) {
  const st = STATUS[s];
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
                   color: st.color, border: `1px solid ${st.color}`, borderRadius: 5, padding: "2px 6px",
                   whiteSpace: "nowrap" }}>
      {st.label}
    </span>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div>
      <div style={micro}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: color ?? INK, marginTop: 4,
                    fontVariantNumeric: "tabular-nums" }}>{v}</div>
    </div>
  );
}

export default function DraftFilesPage() {
  const { results, files, key_summary: K } = B;
  const open = results.tests.filter((t) => t.status !== "pass");
  const fails = open.filter((t) => t.status === "fail");
  const warns = open.filter((t) => t.status === "warn");
  const ran = results.ran_at.replace("T", " ").replace("+00:00", " UTC");

  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", paddingBottom: 90,
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
.df-table{width:100%;border-collapse:collapse;font-size:13px}
.df-table td{padding:10px 8px;border-top:1px solid ${RULE};vertical-align:top}
.df-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
@media (max-width:640px){.df-hide{display:none}}` }} />

      <header style={{ borderBottom: `1px solid ${RULE}`, padding: "48px 0 36px", marginBottom: 44 }}>
        <div style={wrap}>
          <div style={{ ...micro, color: ACCENT, letterSpacing: 1.3 }}>ZSCAPE Commit Gold · draft v0 · not sent</div>
          <h1 style={{ fontSize: 38, fontWeight: 680, margin: "14px 0 0", letterSpacing: -1, lineHeight: 1.1 }}>
            The draft delivery
          </h1>
          <p style={{ ...lede, fontSize: 16, marginTop: 14 }}>
            This page holds the files we are preparing for Commit, the answer key in outline, and a test
            suite that checks both against each other and against what{" "}
            <Link href="/commit" style={{ color: ACCENT }}>/commit</Link> promises. A failing test means
            something needs a decision before this goes out.
          </p>
          <div style={{ display: "flex", gap: 34, flexWrap: "wrap", marginTop: 26 }}>
            <Stat k="tests passing" v={nfmt(results.counts.pass)} color={SC_FULL} />
            <Stat k="warnings" v={nfmt(results.counts.warn)} color={SC_HALF} />
            <Stat k="failing" v={nfmt(results.counts.fail)} color={SC_ZERO} />
            <Stat k="files" v={nfmt(files.length)} />
          </div>
          <div style={{ fontSize: 12, color: FAINT, marginTop: 14, fontFamily: MONO }}>
            tests last run {ran} · menu {B.menu_version_hash.slice(0, 12)}…
          </div>
        </div>
      </header>

      {/* ── decisions ─────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginBottom: 56 }}>
        <h2 style={h2}>Needs a decision</h2>
        <p style={lede}>
          The failing tests first, then the warnings. Each one comes with what the test found and what we
          suggest doing about it.
        </p>
        {[...fails, ...warns].map((t) => (
          <div key={t.id} style={{ borderTop: `1px solid ${RULE}`, padding: "16px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Pill s={t.status} />
              <span style={{ fontSize: 15.5, fontWeight: 620 }}>{t.title}</span>
              <span style={{ ...micro, color: FAINT }}>{t.group} · {GROUPS[t.group]}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--cm-detail)", margin: "8px 0 0", lineHeight: 1.6,
                          overflowWrap: "anywhere" }}>{t.detail}</div>
            {NEXT[t.id] && (
              <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--cm-prose)", margin: "8px 0 0", maxWidth: 760 }}>
                {NEXT[t.id]}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ── files ─────────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginBottom: 56 }}>
        <h2 style={h2}>The files</h2>
        <p style={lede}>
          Everything that goes to Commit before the run can be downloaded here, except the 460 MB matrix,
          which stays on the server. The answer key is listed but not published; it goes after the run.
        </p>
        {["before", "after", "internal"].map((aud) => (
          <div key={aud} style={{ marginBottom: 26 }}>
            <div style={{ ...micro, marginBottom: 6 }}>{AUDIENCE[aud]}</div>
            <div className="df-scroll" style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 10 }}>
              <table className="df-table">
                <tbody>
                  {files.filter((f) => f.audience === aud).map((f, i) => (
                    <tr key={f.name} style={i === 0 ? { borderTop: "none" } : undefined}>
                      <td style={{ width: "34%", borderTop: i === 0 ? "none" : undefined }}>
                        {f.href ? (
                          <a href={f.href} style={{ fontFamily: MONO, fontSize: 12.5, color: FILE, fontWeight: 700,
                                                    overflowWrap: "anywhere" }}>{f.name}</a>
                        ) : (
                          <span style={{ fontFamily: MONO, fontSize: 12.5, color: FILE, fontWeight: 700,
                                         overflowWrap: "anywhere" }}>{f.name}</span>
                        )}
                        <div style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT, marginTop: 3 }}>
                          {size(f.bytes)}{f.sha256 ? ` · ${f.sha256.slice(0, 10)}…` : ""}
                        </div>
                      </td>
                      <td style={{ color: "var(--cm-prose)", lineHeight: 1.55, borderTop: i === 0 ? "none" : undefined }}>
                        {f.what}
                        {f.location && (
                          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 4,
                                        overflowWrap: "anywhere" }}>on the server: {f.location}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* ── key outline ───────────────────────────────────────────── */}
      <section style={{ ...wrap, marginBottom: 56 }}>
        <h2 style={h2}>The answer key, in outline</h2>
        <p style={lede}>
          Counts only. The key stays in the quarantined folder on the server and is never copied into this
          site.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 1,
                      background: RULE, border: `1px solid ${RULE}`, borderRadius: 10, overflow: "hidden" }}>
          {[
            ["rows", `${K.rows}`, "one per cluster"],
            ["scored / ambiguous", `${K.status.scored} / ${K.status.scored_ambiguous}`, "ambiguous clusters are reported as their own slice"],
            ["answer is a cell / structure", `${K.primary_kind.cell} / ${K.primary_kind.structure}`, "the kind of the key's primary term"],
            ["distinct answers", `${K.distinct_primaries}`, `the most common one covers ${K.largest_primary_share} clusters`],
            ["multi-answer clusters", `${K.multi_answer}`, `${K.alternatives_proposed} alternatives proposed by reviewers, ${K.alternatives_by_verdict.accepted} accepted`],
            ["no ZFA term", `${K.identity_no_term} / ${K.anatomy_no_term}`, "identity / anatomy axis, written NO_ZFA_TERM rather than left blank"],
            ["pick is neither axis", `${K.pick_is_neither_axis}`, "a third, related term was chosen instead"],
            ["excluded upstream", `${K.excluded_upstream}`, "under 50 cells; not in the matrix, never scored"],
          ].map(([k, v, note]) => (
            <div key={k} style={{ background: CARD, padding: "14px 16px" }}>
              <div style={micro}>{k}</div>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>{note}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: FAINT, marginTop: 12, lineHeight: 1.6 }}>
          Columns: <span style={{ fontFamily: MONO }}>{K.columns.join(", ")}</span>
        </p>
      </section>

      {/* ── all tests ─────────────────────────────────────────────── */}
      <section style={{ ...wrap, marginBottom: 40 }}>
        <h2 style={h2}>Every test</h2>
        <p style={lede}>
          {results.tests.length} tests in six groups. They live with the answer key on the server
          (<span style={{ fontFamily: MONO, fontSize: 13 }}>_HELDOUT/tests/</span>), because some of them need to
          read it. This page only ever shows their counts.
        </p>
        {Object.entries(GROUPS).map(([g, title]) => (
          <div key={g} style={{ marginBottom: 28 }}>
            <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 10, marginBottom: 4, display: "flex", gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ACCENT }}>{g}</span>
              <span style={{ fontSize: 15, fontWeight: 650 }}>{title}</span>
            </div>
            {results.tests.filter((t) => t.group === g).map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${RULE}`,
                                       alignItems: "baseline" }}>
                <div style={{ flex: "0 0 44px" }}><Pill s={t.status} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{t.title}</div>
                  {t.why && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, marginTop: 2 }}>{t.why}</div>}
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--cm-detail)", marginTop: 4, lineHeight: 1.55,
                                overflowWrap: "anywhere" }}>{t.detail}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <Link href="/commit" style={{ display: "inline-block", marginTop: 10, fontFamily: MONO, fontSize: 10.5,
                                      fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: ACCENT,
                                      border: `1px solid ${RULE}`, background: CARD, borderRadius: 8,
                                      padding: "10px 14px", textDecoration: "none" }}>
          ← Back to the challenge
        </Link>
      </section>
    </main>
  );
}
