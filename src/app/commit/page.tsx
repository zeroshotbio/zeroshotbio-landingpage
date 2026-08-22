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
import Link from "next/link";
import { IconDocs } from "./icons";
import Overview from "./overview";
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



          <div style={{ display: "flex", gap: 38, flexWrap: "wrap", marginTop: 36 }}>
            <Stat k="clusters" v={nfmt(B.clusters)} sub="given · frozen" />
            <Stat k="cells" v={nfmt((H5AD as any).shape.cells)} sub={`${B.timepoint_hpf} hpf · ${B.arm} arm`} />
            <Stat k="genes" v={nfmt((H5AD as any).shape.genes)} sub="full width, not subset" />
            <Stat k="answer space" v={nfmt((MENU as any).n_terms)} sub="ZFA terms, frozen" />
          </div>

          <Overview />

          {/* One way in, not four. The reference is a page; this says so plainly. */}
          <Link
            href="/commit/docs"
            style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none",
                     background: "#fffefd", border: `1px solid ${RULE}`, borderRadius: 11,
                     padding: "18px 22px", marginTop: 26 }}
          >
            <span style={{ display: "inline-flex", color: ACCENT, flexShrink: 0 }}>
              <IconDocs size={22} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 650, color: INK,
                             letterSpacing: -0.2 }}>
                Take me to the full documentation
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: MUTED, marginTop: 3,
                             lineHeight: 1.5 }}>
                The challenge stated in full, every field of the three files, the four parts of an
                answer, and the scoring rule.
              </span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, color: FAINT, flexShrink: 0 }}>→</span>
          </Link>

        </div>

      </header>

    </main>
  );
}
