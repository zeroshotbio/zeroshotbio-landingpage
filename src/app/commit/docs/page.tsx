// /commit/docs — the reference.
//
// /commit is the glance: what goes in, what comes out, how it is scored, in boxes. This is
// everything behind it, laid out as documentation — a sticky contents rail, numbered sections with
// stable anchors, and no disclosure of any kind. The landing page links straight to the anchor for
// whichever box you clicked, so "read the detail" and "get back" are both one step.
//
// Server-rendered apart from the contents rail, which tracks which section you are reading; every
// number comes from src/app/commit/data/, the build-time bundle emitted by
// scripts/build_commit_challenge_asset.py.
//
// Gated by src/middleware.ts (Basic Auth) via the /commit/:path* matcher.
import React from "react";
import Link from "next/link";
import DocsRail from "./rail";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, card, nfmt } from "../theme";
import { GoldFeaturesWindow, ZfaMenuWindow, H5adWindow } from "../windows";
import { MenuCompositionFigure } from "../figures";
import OutputFigure from "../output";
import ScoringSection from "../scoring";
import MANIFEST from "../data/manifest.json";
import MENU from "../data/zfa_menu_preview.json";
import H5AD from "../data/h5ad_summary.json";

export const metadata = {
  title: "Documentation · The Commit Challenge",
  description:
    "Full reference for the ZSCAPE Commit Gold challenge: the task, the three delivered files, the required answer, and the scoring rule.",
};

const B = (MANIFEST as any).benchmark;
const INCL = (H5AD as any).inclusion_rule;

const SECTIONS = [
  { id: "challenge", n: "01", title: "The challenge", blurb: "What the task is, in full." },
  { id: "input", n: "02", title: "The input — three files", blurb: "Every column and field you receive." },
  { id: "output", n: "03", title: "The output — one answer", blurb: "The four parts of a returned answer." },
  { id: "scoring", n: "04", title: "How it is scored", blurb: "The rule, and what is reported." },
  { id: "answer-space", n: "05", title: "The answer space", blurb: "What the menu is made of." },
];

function Section({ id, n, title, children }: {
  id: string; n: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 26, marginBottom: 64 }}>
      <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 13, marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.9,
                      textTransform: "uppercase", color: ACCENT }}>
          {n}
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 650, color: INK, margin: "7px 0 0", letterSpacing: -0.5 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const prose: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 700 };

export default function CommitDocsPage() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh",
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.doc-grid{display:grid;grid-template-columns:236px minmax(0,1fr);gap:44px;
  max-width:1240px;margin:0 auto;padding:34px 24px 90px}
.doc-rail{position:sticky;top:24px;align-self:start}
.doc-link{display:block;padding:7px 10px;border-radius:7px;text-decoration:none;
  border-left:2px solid transparent}
.doc-link:hover{background:#fffefd;border-left-color:${ACCENT}}
@media (max-width: 900px){
  .doc-grid{grid-template-columns:1fr;gap:26px}
  .doc-rail{position:static}
}`,
        }}
      />

      <div className="doc-grid">
        <DocsRail
          sections={SECTIONS}
          stats={[
            `${nfmt(B.clusters)} clusters`,
            `${B.timepoint_hpf} hpf · ${B.arm} arm`,
            `${nfmt((MENU as any).n_terms)} ZFA terms`,
            `menu ${(MENU as any).menu_version_hash.slice(0, 12)}…`,
          ]}
        />

        {/* ── the reference ─────────────────────────────────────────── */}
        <article style={{ minWidth: 0 }}>
          <header style={{ marginBottom: 46 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
                          textTransform: "uppercase", color: ACCENT }}>
              ZSCAPE Commit Gold · documentation
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 680, margin: "14px 0 0", letterSpacing: -0.9, lineHeight: 1.12 }}>
              The Commit Challenge, in full
            </h1>
            <p style={{ ...prose, marginTop: 14 }}>
              Everything behind the overview: what the task is, what each delivered file contains,
              what an answer has to look like, and how it is judged.
            </p>
          </header>

          <Section id="challenge" n="01" title="The challenge">
            <div style={prose}>
              <p style={{ margin: "0 0 15px" }}>
                The set is ZSCAPE&apos;s published gold partition of the 48 hpf control arm:{" "}
                <strong>{nfmt(B.clusters)} clusters</strong> covering{" "}
                <strong>{nfmt((H5AD as any).shape.cells)} cells</strong>, every cluster clearing a{" "}
                {INCL.threshold_from_file}-cell floor. {INCL.excluded_upstream} smaller clusters
                were dropped upstream before the set was cut.
              </p>
              <p style={{ margin: "0 0 15px" }}>
                <strong>The clustering is given.</strong> You do not re-cluster it, and you do not
                re-filter it — ZSCAPE&apos;s quality thresholds are already applied, and applying
                your own on top is a failure mode, not a refinement. The partition is the one thing
                both sides hold fixed, so that a disagreement is about biology rather than about
                where the boundaries fell.
              </p>
              <p style={{ margin: "0 0 15px" }}>
                For each cluster you return <strong>one ZFA identifier</strong>, selected from a
                frozen menu of {nfmt((MENU as any).n_terms)} terms. Selected, not written: an answer
                is an identifier, and a term that is not on the menu is not an answer. Both sides
                draw from the same list, and the list&apos;s content hash is how that parity is
                proven.
              </p>
              <p style={{ margin: "0 0 15px" }}>
                Each answer carries three things beyond the identifier itself — <strong>both axis
                terms</strong> (what the cells are, and where they are), the <strong>ancestor
                chain</strong> back up the ontology, and a <strong>confidence score and tier</strong>{" "}
                from a rubric you define and publish. The chain is what makes a near-miss legible
                instead of merely wrong, and the rubric is what lets a reader weigh a call rather
                than take it.
              </p>
              <p style={{ margin: 0 }}>
                And alongside all of it, <strong>the references used</strong> and an{" "}
                <strong>evidentiary statement citing only retrieved evidence</strong>. That is the
                part that makes the rest auditable: without it a label is an assertion, and the
                difference between a method that reasoned and a method that guessed well is
                invisible.
              </p>
            </div>
          </Section>

          <Section id="input" n="02" title="The input — three files">
            <p style={{ ...prose, margin: "0 0 24px" }}>
              Each window shows a file as it ships — its size, its content hash, its real shape, and
              a live slice of what is inside it.
            </p>
            <H5adWindow />
            <GoldFeaturesWindow />
            <ZfaMenuWindow />
          </Section>

          <Section id="output" n="03" title="The output — one answer">
            <OutputFigure />
          </Section>

          <Section id="scoring" n="04" title="How it is scored">
            <ScoringSection />
          </Section>

          <Section id="answer-space" n="05" title="The answer space">
            <p style={{ ...prose, margin: "0 0 24px" }}>
              What the {nfmt((MENU as any).n_terms)} selectable terms are made of.
            </p>
            <div style={{ ...card, padding: "26px 28px" }}>
              <MenuCompositionFigure />
            </div>
          </Section>

          <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 18 }}>
            <p style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.65, maxWidth: 700, margin: "0 0 16px" }}>
              <strong style={{ color: MUTED }}>On the key&apos;s provenance.</strong> The gold labels
              for this row were authored in-house, by translating ZSCAPE&apos;s published annotations
              onto the frozen ZFA menu. They are blind to a contestant, but they are not an
              independent standard, and a score against them is a ceiling check rather than a
              neutral benchmark.
            </p>
            <Link href="/commit"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                           fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7,
                           textTransform: "uppercase", color: ACCENT, border: `1px solid ${RULE}`,
                           background: "#fffefd", borderRadius: 8, padding: "10px 14px" }}>
              ← Back to the overview
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
