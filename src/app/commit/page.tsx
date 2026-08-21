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
import { ClusterSizeFigure, MenuCompositionFigure } from "./figures";
import InputOutputFigure from "./inputoutput";
import { GoldFeaturesWindow, ClusterPublicWindow, ZfaMenuWindow, H5adWindow } from "./windows";
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
              {nfmt(B.clusters)} clusters of 48-hour zebrafish, already partitioned and frozen.
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

          <div style={{ marginTop: 38 }}>
            <InputOutputFigure />
          </div>
        </div>
      </header>

      {/* ── 01 the challenge ──────────────────────────────────────────── */}
      <div style={section}>
        <SectionHead n="01" title="The challenge, stated" />

        <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 660 }}>
          <p style={{ margin: "0 0 17px" }}>
            The set is ZSCAPE&apos;s published gold partition of the 48 hpf control arm:{" "}
            <strong>{nfmt(B.clusters)} clusters</strong> covering{" "}
            <strong>{nfmt((H5AD as any).shape.cells)} cells</strong>, every cluster clearing a{" "}
            {INCL.threshold_from_file}-cell floor. {INCL.excluded_upstream} smaller clusters were
            dropped upstream before the set was cut.
          </p>
          <p style={{ margin: "0 0 17px" }}>
            <strong>The clustering is given.</strong> You do not re-cluster it, and you do not
            re-filter it — ZSCAPE&apos;s quality thresholds are already applied, and applying your
            own on top is a failure mode, not a refinement. The partition is the one thing both
            sides hold fixed, so that a disagreement is about biology rather than about where the
            boundaries fell.
          </p>
          <p style={{ margin: "0 0 17px" }}>
            For each cluster you return <strong>one ZFA identifier</strong>, selected from a frozen
            menu of {nfmt((MENU as any).n_terms)} terms. Selected, not written: an answer is an
            identifier, and a term that is not on the menu is not an answer. Both sides draw from
            the same list, and the list&apos;s content hash is how that parity is proven.
          </p>
          <p style={{ margin: 0 }}>
            Each answer carries three things beyond the identifier itself — <strong>both axis
            terms</strong> (what the cells are, and where they are), the <strong>ancestor
            chain</strong> back up the ontology, and a <strong>confidence tier</strong>. The chain
            is what makes a near-miss legible instead of merely wrong, and the tier is where you say
            so when the evidence will not carry you to a leaf.
          </p>
        </div>

        {/* scoring callout */}
        <div style={{ ...card, marginTop: 30, padding: "22px 24px", background: "#fbfaf8" }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED }}>
            how it is scored
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#3f3a34", margin: "11px 0 18px", maxWidth: 640 }}>
            By identifier, against a key you never see, resolved on the anatomy ontology and
            measured as graph distance — <strong>not</strong> string match. A synonym is not
            punished for being a synonym. Credit is <strong>asymmetric</strong>: being too specific
            and being too broad are not the same error.
          </p>

          <div style={{ display: "grid", gap: 1, background: RULE, border: `1px solid ${RULE}`, borderRadius: 9, overflow: "hidden" }}>
            {[
              ["full", "#3f6b55", "your term is a cell type sitting under the key's region", "The evidence took you further down than the key went. You are not penalised for it."],
              ["half", "#a16207", "you name the region, the key names a cell type", "Right neighbourhood, stopped short. Upward compression is the error this benchmark is built to catch."],
              ["zero", "#9a3b3b", "anything else", "Sibling and over-broad cases are decided against label sets, not one string."],
            ].map(([tier, color, claim, note]) => (
              <div key={tier as string} style={{ background: "#fffefd", padding: "13px 17px", display: "flex", gap: 15, alignItems: "flex-start" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase",
                               color: color as string, minWidth: 42, paddingTop: 2 }}>
                  {tier}
                </span>
                <div>
                  <div style={{ fontSize: 13.5, color: INK, fontWeight: 550 }}>{claim}</div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{note}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: FAINT, marginTop: 14, lineHeight: 1.55 }}>
            The exact weights of the external rule are a versioned placeholder — the shape of the
            credit is fixed, the numbers are not yet published, and they are deliberately not
            guessed here.
          </div>
        </div>
      </div>

      <div style={section}><hr style={rule} /></div>

      {/* ── 02 sees / does not see ────────────────────────────────────── */}
      <div style={section}>
        <SectionHead
          n="02"
          title="What you are given, and what you are not"
          lede="The withheld fields are all ZSCAPE's own annotations. They are held back for one reason, and it is worth stating plainly."
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(292px, 1fr))", gap: 20 }}>
          {/* given */}
          <div style={{ ...card, padding: "20px 22px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#3f6b55", marginBottom: 15 }}>
              ✓ given to you
            </div>
            {[
              ["gold_features.csv", "Three ordered 50-gene marker lists per cluster — enriched, depleted, and family-level — plus UMI, gene-count and mitochondrial QC."],
              ["inputs/cluster_public.csv", "The roster: which clusters exist and how big each one is."],
              ["artifacts/zfa_menu.v1.json", `The full ${nfmt((MENU as any).n_terms)}-term answer space, with each term's CARO stratum and synonym count.`],
              ["zscape_gold_48hpf.h5ad", "The whole matrix — raw counts, log1p CP10k, PCA, and ZSCAPE's published embedding. Compute whatever else you want."],
            ].map(([f, d]) => (
              <div key={f as string} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK }}>{f}</div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>

          {/* withheld */}
          <div style={{ ...card, padding: "20px 22px", background: "#fbfaf8" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#9a3b3b", marginBottom: 15 }}>
              ✕ withheld
            </div>
            {[
              ["four ZSCAPE label columns",
               "zscape_sub_cell_type · zscape_broad_cell_type · zscape_tissue · germ_layer",
               "Present in our copy of the roster file, stripped from yours. The key was translated from these columns, so handing them over would hand over the answer."],
              ["zscape_published_markers",
               "a tenth column of gold_features.csv",
               "ZSCAPE's own marker calls for each cluster. Downstream of the annotations the key came from, so it is downstream of the key."],
              ["the excluded-cluster names",
               "uns['dropped_clusters']",
               `The ${INCL.excluded_upstream} sub-threshold clusters are keyed by ZSCAPE label name. They are not answers to anything scored, but they are ZSCAPE's label vocabulary, so they go too.`],
              ["the key itself",
               "gold_labels.csv",
               "Quarantined at ingest. Only the scoring stage ever reads it."],
            ].map(([f, sub, d]) => (
              <div key={f as string} style={{ marginBottom: 15 }}>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: INK }}>{f}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT, marginTop: 3, wordBreak: "break-word" }}>{sub}</div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 5, lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, marginTop: 20, padding: "18px 22px", borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "#3f3a34" }}>
            <strong>Why any of this is withheld.</strong> Not to make the task harder for its own
            sake. A method that reads ZSCAPE&apos;s existing annotations is not doing the thing
            being measured — and it does not survive contact with the datasets this is meant to
            generalise to. MiniFin and MegaFin have no equivalent field. Nothing to match against,
            no published marker list, no label tier to fall back on. If a method only works where
            someone has already done the labelling, it does not work.
          </div>
        </div>
      </div>

      <div style={section}><hr style={rule} /></div>

      {/* ── 03 the files ──────────────────────────────────────────────── */}
      <div style={section}>
        <SectionHead
          n="03"
          title="The files"
          lede="Each window below shows the file as it ships — its size, its content hash, its real shape, and a live slice of what is inside it."
        />
        <GoldFeaturesWindow />
        <ClusterPublicWindow />
        <ZfaMenuWindow />
        <H5adWindow />
      </div>

      <div style={section}><hr style={rule} /></div>

      {/* ── 04 figures ────────────────────────────────────────────────── */}
      <div style={section}>
        <SectionHead n="04" title="The shape of the problem" lede="Two things worth knowing before you start." />
        <div style={{ ...card, padding: "26px 28px", marginBottom: 22 }}>
          <ClusterSizeFigure />
        </div>
        <div style={{ ...card, padding: "26px 28px" }}>
          <MenuCompositionFigure />
        </div>
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
