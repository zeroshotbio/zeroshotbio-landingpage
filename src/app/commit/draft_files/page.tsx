// /commit/draft_files — the files Commit will work off, each with the reason it can be trusted.
//
// Written for Steven, going into the Commit meeting: download links, one line per file on what was
// checked, how the set answers Mukhtar's five asks, and the few things to raise. The full test
// output lives in the benchmark row (test_results/results.json); only its counts are shown here.
//
// Internal. Gated by src/middleware.ts (Basic Auth), downloads included. Data comes from
// data/bundle.json (scripts/build_commit_draft_files.py), which holds no answer-key content.
import React from "react";
import Link from "next/link";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, CARD, FILE, SC_FULL, SC_HALF } from "../theme";
import BUNDLE from "./data/bundle.json";

export const metadata = {
  title: "Draft files · The Commit Challenge",
  description: "The files Commit will work off, and why each one holds up.",
};

type FileRow = { name: string; audience: string; bytes: number | null; href: string | null; location: string | null };
const B = BUNDLE as unknown as {
  files: FileRow[]; results: { ran_at: string; counts: Record<string, number> };
};

// One line per file: what it is, then what was verified about it. Order = the order to read them in.
const WHY: [string, string, string][] = [
  ["README.md", "Start here.", "Explains every file, how the gene ids join, and how to check the menu hash."],
  ["zscape_gold_48hpf.v0.h5ad", "The expression matrix: 209,639 cells × 32,031 genes, the 112 clusters given.",
    "Opens on anndata 0.10 and 0.12. X was checked on real cells to equal log1p of counts-per-10k. The excluded clusters' names are gone."],
  ["gold_features.v1.csv", "The per-cluster evidence: three ranked marker lists and QC.",
    "All 15,642 marker entries map to exactly one gene, with an Ensembl id next to each. Clusters and cell counts match the matrix."],
  ["genes.tsv", "Gene order for the raw counts.", "Identical to the matrix order; one unique Ensembl id per gene."],
  ["zfa_menu.v1.enriched.json", "The 3,107-term answer space, with parents and synonyms.",
    "The hash recomputes to dec9f728, every parent resolves, and every answer in our key is on it."],
  ["zfa_menu.v1.tsv", "The same menu as a table.", ""],
  ["excluded_clusters.csv", "The 26 clusters dropped upstream, marked excluded.", "Not left blank; names held back."],
  ["sources.v0.json", "Pinned ZFA, ZFIN expression, ZFIN GO annotations and GO.", "Every file's checksum was verified against our copy."],
  ["scoring_rules.v0.md", "How each cluster is scored: full, half, zero.",
    "A reference scorer runs it: our key scores 112/112 against itself, and no blanket vague answer earns more than 4%."],
  ["submission_format.v0.md", "What Commit hands back.", ""],
  ["validate_submission.py", "Checks a submission before scoring.", "Accepts a valid submission and caught all 6 kinds of broken one."],
  ["MANIFEST.json", "Checksums of every file above.", ""],
];

const ASKS: [string, string, boolean][] = [
  ["Ground truth as ZFA ids, alternatives flagged, exclusions marked, gene ids confirmed",
    "Ready. The key goes after the run; gene ids are in the README.", true],
  ["The 3,107-term menu, hash dec9f728", "Ready to send now.", true],
  ["Pinned ZFA, ZFIN expression and GO", "sources.v0.json", true],
  ["Scoring rules in writing, including 'acceptably close'", "scoring_rules.v0.md: a full draft, needs your and Darien's sign-off.", false],
  ["Baseline score with the method named", "Only a no-model lookup exists: 16/112 exact. Our labeller hasn't run yet.", false],
];

const RAISE = [
  "The 112 clusters are ZSCAPE's own published cell types, and their labels are public on GEO, so this set can't prove a solution is agentic. Suggest it as the practice set and score the real run on unpublished clusters revealed on the day.",
  "Three key rows need a curator's look before the key is final.",
];

const size = (b: number | null) =>
  b == null ? "" : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(b >= 100 << 20 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const micro: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                                     textTransform: "uppercase", color: MUTED };
const h2: React.CSSProperties = { fontSize: 19, fontWeight: 650, letterSpacing: -0.3, margin: "0 0 14px" };

export default function DraftFilesPage() {
  const byName = Object.fromEntries(B.files.map((f) => [f.name, f]));
  const c = B.results.counts;
  const day = B.results.ran_at.slice(0, 10);

  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", padding: "56px 16px 90px",
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ ...micro, color: ACCENT, letterSpacing: 1.3 }}>Commit Challenge · draft v0</div>
        <h1 style={{ fontSize: 34, fontWeight: 680, margin: "12px 0 0", letterSpacing: -0.9, lineHeight: 1.12 }}>
          The files Commit will work off
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--cm-lede)", margin: "14px 0 0" }}>
          Everything Commit needs to start: the data, the answer space, the rules and a way to check its own
          submission. Each file below has been checked against the others and against what{" "}
          <Link href="/commit" style={{ color: ACCENT }}>/commit</Link> promises.
        </p>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: FAINT, marginTop: 12 }}>
          {c.pass + c.warn + c.fail} automated checks · {c.pass} pass · last run {day}
        </div>

        {/* ── files ───────────────────────────────────────────── */}
        <section style={{ marginTop: 40 }}>
          <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 12, overflow: "hidden" }}>
            {WHY.map(([name, what, checked], i) => {
              const f = byName[name];
              return (
                <div key={name} style={{ padding: "14px 18px", borderTop: i ? `1px solid ${RULE}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    {f?.href ? (
                      <a href={f.href} download style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: FILE,
                                                          overflowWrap: "anywhere" }}>{name}</a>
                    ) : (
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: FILE }}>{name}</span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT }}>
                      {size(f?.bytes ?? null)}{f?.location ? " · from S3" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: INK, marginTop: 4, lineHeight: 1.5 }}>{what}</div>
                  {checked && (
                    <div style={{ fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>
                      <span style={{ color: SC_FULL, fontWeight: 700 }}>✓ </span>{checked}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: FAINT, margin: "10px 2px 0", lineHeight: 1.55 }}>
            The answer key (112 ZFA ids, alternatives flagged) is ready and goes to Commit after the run. It is not
            on this page.
          </p>
        </section>

        {/* ── Mukhtar's asks ──────────────────────────────────── */}
        <section style={{ marginTop: 44 }}>
          <h2 style={h2}>Against Mukhtar&apos;s five asks</h2>
          {ASKS.map(([ask, answer, done], i) => (
            <div key={ask} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${RULE}` }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: done ? SC_FULL : SC_HALF,
                             flex: "0 0 22px" }}>{done ? "✓" : "~"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{i + 1}. {ask}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>{answer}</div>
              </div>
            </div>
          ))}
        </section>

        {/* ── to raise ────────────────────────────────────────── */}
        <section style={{ marginTop: 44 }}>
          <h2 style={h2}>Worth raising in the meeting</h2>
          {RAISE.map((r) => (
            <p key={r} style={{ fontSize: 14, lineHeight: 1.6, color: "var(--cm-prose)", margin: "0 0 12px",
                                paddingLeft: 14, borderLeft: `2px solid ${SC_HALF}` }}>{r}</p>
          ))}
        </section>
      </div>
    </main>
  );
}
