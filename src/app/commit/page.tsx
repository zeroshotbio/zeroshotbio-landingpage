// /commit — the ZSCAPE Commit Gold challenge page.
//
// Written from the CONTESTANT's side of the table: this is the brief plus a real window into each
// input file, as received. It is not the internal benchmark row — the answer key, the ZSCAPE label
// tiers the key was translated from, and the excluded-cluster vocabulary are all held back, and
// the page names what is held back without showing any of it.
//
// Everything numeric renders from src/app/commit/data/, the build-time bundle emitted by
// scripts/build_commit_challenge_asset.py. That script reads the benchmark row read-only, never
// touches _HELDOUT/, and fails its own build if a withheld string reaches the bundle. So nothing
// on this page is hand-typed from the data, and a rebuild moves the page.
//
// Gated by src/middleware.ts (Basic Auth), same as /daniotype_kasperov.
import React from "react";
import { PAPER, INK, ACCENT, MONO, RULE, MUTED, FAINT, card, nfmt } from "./theme";
import { MenuCompositionFigure } from "./figures";
import ScoringSection from "./scoring";
import InputOutputFigure from "./inputoutput";
import { GoldFeaturesWindow, ZfaMenuWindow, H5adWindow } from "./windows";
import MANIFEST from "./data/manifest.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

export const metadata = {
  title: "The Commit Challenge · ZSCAPE Commit Gold",
  description:
    "112 frozen clusters of 48 hpf zebrafish. Markers in, one ZFA identifier out, from a frozen 3,107-term menu. Scored on the ontology graph against a held-out key.",
};

const B = (MANIFEST as any).benchmark;
const INCL = (H5AD as any).inclusion_rule;

// ── small parts ────────────────────────────────────────────────────────────
function SectionHead({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: ACCENT }}>
        {n}
      </div>
      <h2 style={{ fontSize: 23, fontWeight: 650, color: INK, margin: "8px 0 0", letterSpacing: -0.35 }}>{title}</h2>
      {lede && <p style={{ fontSize: 14.5, color: MUTED, margin: "9px 0 0", lineHeight: 1.62, maxWidth: 660 }}>{lede}</p>}
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED }}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 4, letterSpacing: -0.4 }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const section: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "0 24px" };
const rule: React.CSSProperties = { border: "none", borderTop: `1px solid ${RULE}`, margin: "62px 0" };

export default function CommitChallengePage() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh", paddingBottom: 90,
                   fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ── masthead ──────────────────────────────────────────────────── */}
      <header style={{ borderBottom: `1px solid ${RULE}`, padding: "58px 0 44px", marginBottom: 54 }}>
        <div style={section}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: ACCENT }}>
            ZSCAPE Commit Gold · benchmark row
          </div>
          <h1 style={{ fontSize: 43, fontWeight: 680, margin: "16px 0 0", letterSpacing: -1.1, lineHeight: 1.1 }}>
            The Commit Challenge
          </h1>
          <div style={{ maxWidth: 660, marginTop: 17 }}>
            <p style={{ fontSize: 17.5, color: "#5a544c", margin: 0, lineHeight: 1.58 }}>
              {nfmt(B.clusters)} clusters of 48-hour zebrafish from ZSCAPE.
            </p>
            <p style={{ fontSize: 15.5, color: "#5a544c", margin: "15px 0 0", lineHeight: 1.62 }}>
              Each input cluster arrives as three DEG marker lists, per-cluster QC, and the full
              expression matrix — no names, no annotations.
            </p>
            <p style={{ fontSize: 15.5, color: "#5a544c", margin: "15px 0 0", lineHeight: 1.62 }}>
              Each output answer should leave as a single ontology identifier picked from a{" "}
              {nfmt((MENU as any).n_terms)} menu of ZFA-derived terms. Each answer should carry both
              axis terms — what the cells are and where they sit anatomically, plus the ancestor
              chain and a confidence tier.
            </p>
          </div>


          {/* The framing prose is real but not everyone needs it first. Native <details> so it
              works without client JS and stays keyboard- and screen-reader-navigable. */}
          <details style={{ marginTop: 22, maxWidth: 660 }}>
            <summary style={{ cursor: "pointer", fontFamily: MONO, fontSize: 11, fontWeight: 700,
                              letterSpacing: 0.7, textTransform: "uppercase", color: ACCENT,
                              listStyle: "none", display: "inline-flex", gap: 8, alignItems: "center",
                              border: `1px solid ${RULE}`, background: "#fffefd",
                              borderRadius: 8, padding: "9px 14px" }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>▸</span> The challenge, stated
            </summary>
            <div style={{ fontSize: 14.5, lineHeight: 1.72, color: "#3f3a34", marginTop: 16,
                          paddingLeft: 15, borderLeft: `2px solid ${RULE}` }}>
              <p style={{ margin: "0 0 15px" }}>The set is ZSCAPE&apos;s published gold partition of the 48 hpf control arm:{" "}
            <strong>{nfmt(B.clusters)} clusters</strong> covering{" "}
            <strong>{nfmt((H5AD as any).shape.cells)} cells</strong>, every cluster clearing a{" "}
            {INCL.threshold_from_file}-cell floor. {INCL.excluded_upstream} smaller clusters were
            dropped upstream before the set was cut.</p>
              <p style={{ margin: "0 0 15px" }}><strong>The clustering is given.</strong> You do not re-cluster it, and you do not
            re-filter it — ZSCAPE&apos;s quality thresholds are already applied, and applying your
            own on top is a failure mode, not a refinement. The partition is the one thing both
            sides hold fixed, so that a disagreement is about biology rather than about where the
            boundaries fell.</p>
              <p style={{ margin: "0 0 15px" }}>For each cluster you return <strong>one ZFA identifier</strong>, selected from a frozen
            menu of {nfmt((MENU as any).n_terms)} terms. Selected, not written: an answer is an
            identifier, and a term that is not on the menu is not an answer. Both sides draw from
            the same list, and the list&apos;s content hash is how that parity is proven.</p>
              <p style={{ margin: "0 0 15px" }}>Each answer carries three things beyond the identifier itself — <strong>both axis
            terms</strong> (what the cells are, and where they are), the <strong>ancestor
            chain</strong> back up the ontology, and a <strong>confidence score and tier</strong>
            from a rubric you define and publish. The chain is what makes a near-miss legible
            instead of merely wrong, and the rubric is what lets a reader weigh a call rather than
            take it.</p>
              <p style={{ margin: "0" }}>And alongside all of it, <strong>the references used</strong> and an{" "}
            <strong>evidentiary statement citing only retrieved evidence</strong>. That is the part
            that makes the rest auditable: without it a label is an assertion, and the difference
            between a method that reasoned and a method that guessed well is invisible.</p>
            </div>
          </details>

          <div style={{ display: "flex", gap: 38, flexWrap: "wrap", marginTop: 36 }}>
            <Stat k="clusters" v={nfmt(B.clusters)} sub="given · frozen" />
            <Stat k="cells" v={nfmt((H5AD as any).shape.cells)} sub={`${B.timepoint_hpf} hpf · ${B.arm} arm`} />
            <Stat k="genes" v={nfmt((H5AD as any).shape.genes)} sub="full width, not subset" />
            <Stat k="answer space" v={nfmt((MENU as any).n_terms)} sub="ZFA terms, frozen" />
          </div>

        </div>

        {/* The figure breaks out of the 900px measure — it is two tall columns, and at the body
            width they crush. 2.2x the section, still centred, still gutter-padded, and it collapses
            to one column under 980px where the extra width stops helping. */}
        <div style={{ maxWidth: 2000, margin: "38px auto 0", padding: "0 24px" }}>
          <InputOutputFigure />
        </div>
      </header>

      {/* ── 01 the files ──────────────────────────────────────────────── */}
      <div style={section}>
        <SectionHead
          n="01"
          title="The three files"
          lede="Each window below shows a file as it ships — its size, its content hash, its real shape, and a live slice of what is inside it."
        />
        <H5adWindow />
        <GoldFeaturesWindow />
        <ZfaMenuWindow />
      </div>

      <div style={section}><hr style={rule} /></div>

      {/* ── 04 the answer space ─────────────────────────────────────── */}
      <div style={section}>
        <SectionHead n="02" title="The answer space" lede="What the 3,107 terms are made of." />
        <div style={{ ...card, padding: "26px 28px" }}>
          <MenuCompositionFigure />
        </div>
      </div>

      <div style={section}><hr style={rule} /></div>

      {/* ── 05 how it is scored ──────────────────────────────────────── */}
      <div style={section}>
        <SectionHead n="03" title="How it is scored" />
        <ScoringSection />
      </div>

      {/* ── footer ────────────────────────────────────────────────────── */}
      <div style={section}>
        <hr style={rule} />
        <div style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.65, maxWidth: 660 }}>
          <p style={{ margin: "0 0 11px" }}>
            <strong style={{ color: MUTED }}>On the key&apos;s provenance.</strong> The gold labels
            for this row were authored in-house, by translating ZSCAPE&apos;s published annotations
            onto the frozen ZFA menu. They are blind to a contestant, but they are not an
            independent standard, and a score against them is a ceiling check rather than a
            neutral benchmark. Stated here because it changes what a number from this row means.
          </p>
          <p style={{ margin: 0, fontFamily: MONO, fontSize: 10.5, wordBreak: "break-all" }}>
            menu {(MENU as any).menu_version_hash.slice(0, 16)}… · ZFA {(MENU as any).source.release} ·{" "}
            {nfmt(B.clusters)} clusters · {B.timepoint_hpf} hpf · clustering {B.clustering}
          </p>
        </div>
      </div>
    </main>
  );
}
