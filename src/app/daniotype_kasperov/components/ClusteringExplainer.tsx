"use client";
// ClusteringExplainer + ZscapeClusteringExplainer — the "How we clustered" prose
// blocks shown on the "1. Clustering" stage. Extracted from KasperovClient so BOTH
// the live New Run wizard AND the completed-run viewer render the identical stage
// (the viewer imports these directly; importing them back from KasperovClient would
// be circular since KasperovClient imports RunViewer).
import React from "react";

export function ClusteringExplainer() {
  const card: React.CSSProperties = { flex: "1 1 300px", minWidth: 270, background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" };
  const head: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: "0 0 2px", color: "#2b2b2b" };
  const body: React.CSSProperties = { fontSize: 12.5, color: "#5a544c", lineHeight: 1.55, margin: 0 };
  return (
    <div style={{ maxWidth: 760, margin: "10px auto 2px" }}>
      <p style={{ textAlign: "center", fontSize: 13.5, color: "#777", margin: "0 0 14px", lineHeight: 1.5 }}>
        Grouping cells into clusters comes down to two knobs. We tune them so each cluster is a real cell population — fine enough to be specific, clean enough to trust.
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={card}>
          <div style={head}>Resolution — how finely we split</div>
          <svg viewBox="0 0 280 64" width="100%" height="60" style={{ margin: "6px 0 6px" }} aria-hidden="true">
            <text x="55" y="10" fontSize="8.5" fill="#9a948c" textAnchor="middle">LOW · few broad groups</text>
            <circle cx="34" cy="40" r="16" fill="#15803d" opacity="0.5" />
            <circle cx="76" cy="42" r="14" fill="#2563eb" opacity="0.5" />
            <text x="140" y="44" fontSize="15" fill="#b0a89e" textAnchor="middle">→</text>
            <text x="224" y="10" fontSize="8.5" fill="#9a948c" textAnchor="middle">HIGH · many fine groups</text>
            <circle cx="190" cy="34" r="7" fill="#15803d" opacity="0.7" />
            <circle cx="210" cy="48" r="7" fill="#16a34a" opacity="0.7" />
            <circle cx="228" cy="33" r="7" fill="#2563eb" opacity="0.7" />
            <circle cx="248" cy="46" r="7" fill="#7c3aed" opacity="0.7" />
            <circle cx="206" cy="28" r="7" fill="#a16207" opacity="0.7" />
            <circle cx="246" cy="29" r="7" fill="#0e7490" opacity="0.7" />
          </svg>
          <p style={body}>Turn it low → a few broad groups; turn it high → the same cells split into many fine ones. We raise it until clusters are specific, then stop before real populations start fracturing into noise.</p>
        </div>
        <div style={card}>
          <div style={head}>Coherence — how clean each cluster is</div>
          <svg viewBox="0 0 280 64" width="100%" height="60" style={{ margin: "6px 0 6px" }} aria-hidden="true">
            <text x="60" y="10" fontSize="8.5" fill="#15803d" textAnchor="middle">COHERENT · tight + separated</text>
            <g fill="#15803d" opacity="0.75"><circle cx="30" cy="38" r="3.4" /><circle cx="38" cy="44" r="3.4" /><circle cx="34" cy="50" r="3.4" /><circle cx="43" cy="39" r="3.4" /><circle cx="26" cy="45" r="3.4" /></g>
            <g fill="#2563eb" opacity="0.75"><circle cx="86" cy="36" r="3.4" /><circle cx="94" cy="43" r="3.4" /><circle cx="90" cy="50" r="3.4" /><circle cx="99" cy="38" r="3.4" /><circle cx="82" cy="44" r="3.4" /></g>
            <text x="222" y="10" fontSize="8.5" fill="#b45309" textAnchor="middle">INCOHERENT · smeared</text>
            <g opacity="0.65"><circle cx="184" cy="44" r="3.4" fill="#15803d" /><circle cx="200" cy="38" r="3.4" fill="#2563eb" /><circle cx="194" cy="50" r="3.4" fill="#15803d" /><circle cx="210" cy="45" r="3.4" fill="#2563eb" /><circle cx="219" cy="39" r="3.4" fill="#15803d" /><circle cx="205" cy="52" r="3.4" fill="#2563eb" /><circle cx="229" cy="47" r="3.4" fill="#15803d" /><circle cx="236" cy="41" r="3.4" fill="#2563eb" /></g>
          </svg>
          <p style={body}>Coherence asks whether a cluster&apos;s cells truly belong together — tight and well-separated (good) or smeared into their neighbours (bad). We keep the resolution that maximises coherence, so every group is one population, not a blur of several.</p>
        </div>
      </div>
    </div>
  );
}

// NATIVE-SCHEMA "1. Clustering" — for runs that labelled the authors' OWN published
// finest cell groups (NOT de-novo re-clustered). Renders the honest native story and
// carries NONE of the de-novo narrative (no resolution sweep, no marker re-derivation,
// no two-stage recursive re-clustering, no cell-sample). nGroups/tiers are the RUN's own
// numbers, never the illustrative atlas's leaf count.
export function NativeClusteringExplainer({ nGroups, tiers, lab, derivation, datasetName }: {
  nGroups?: number; tiers?: Record<string, number> | null; lab?: string | null; derivation?: string | null; datasetName?: string;
}) {
  const tierStr = tiers && typeof tiers === "object"
    ? Object.entries(tiers).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(" → ")
    : null;
  const name = datasetName || "this atlas";
  return (
    <div style={{ background: "#faf7ff", border: "1px solid #e6dcf5", borderRadius: 12, padding: "11px 16px", maxWidth: 820, margin: "8px auto 0", textAlign: "left" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#7c3aed", marginBottom: 4 }}>Native-schema · authors&apos; published groups</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "#33312e", margin: 0 }}>
        This run does <b>not re-cluster {name}</b>. It takes the{lab ? <> authors&apos;{" "}<b>({lab})</b></> : " authors'"}{" "}
        <b>own published finest cell groups</b> in their native ontology, exactly as released, and labels those directly —{" "}
        <b>{derivation || "the published finest cell groups, NOT de-novo re-clustered"}</b>.{" "}
        {nGroups ? <>The grouping is <b>{nGroups} groups</b>{tierStr ? <>, nested <b>{tierStr}</b></> : null}. </> : null}
        There is <b>no resolution sweep, no local marker re-derivation, and no two-stage recursive re-clustering</b> — the
        groups are the authors&apos;; only the <b>names</b> are ours. Because we label the published ontology directly, the calls
        are scored against the very same tiers they came from.
      </p>
    </div>
  );
}

// NEUTRAL "1. Clustering" — for runs whose clustering basis carries NO positive stamp
// (older / superseded / unattributed clusterings). Makes NO de-novo OR native claim; it
// defers to the run's own provenance block for whatever was actually captured.
export function NeutralClusteringExplainer({ nLeaves, datasetName }: { nLeaves?: number; datasetName?: string }) {
  const name = datasetName || "this atlas";
  return (
    <div style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "11px 16px", maxWidth: 820, margin: "8px auto 0", textAlign: "left" }}>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "#5a544c", margin: 0 }}>
        The clusters below are the fine-grained groups this run labelled in {name}{nLeaves ? <> (<b>{nLeaves} groups</b>)</> : null}.
        The clustering <b>basis for this run isn&apos;t recorded</b>, so we don&apos;t characterise the method here — see the run&apos;s
        own provenance for exactly what was captured.
      </p>
    </div>
  );
}

// ZSCAPE "1. Clustering" — the single textbook-intro paragraph beneath the UMAP.
// Leaf count keyed to the live atlas (nLeaves), never a baked literal.
// DE-NOVO ONLY: gate its render on the run's real basis, never on atlasId (a native-schema
// zscape run must NOT get this recursive-de-novo story — see RunViewer §1 fix).
export function ZscapeClusteringExplainer({ nLeaves }: { nLeaves?: number }) {
  const n = nLeaves && nLeaves > 0 ? nLeaves : 250;
  const S = { fontSize: 13, lineHeight: 1.55, color: "#33312e", margin: "0 0 12px" };
  const H = { fontWeight: 700 as const, color: "#2b2620" };
  return (
    <div style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 18px", maxWidth: 820, margin: "10px auto 0", textAlign: "left" }}>
      <p style={S}>
        <span style={H}>Step 1 — Coarse pass: find the broad compartments.</span> All ~813,000 cells are grouped at{" "}
        <b>Leiden res 0.1</b> into a handful of broad <b>compartments</b>. This is deliberately low-resolution: it
        establishes the major territories before any fine splitting.
      </p>
      <p style={S}>
        <span style={H}>Step 2 — Local recompute: let rare tissues surface.</span> The method then goes inside each
        compartment (≥500 cells) and <b>recomputes the 2,000 most-variable genes locally</b> before clustering again at{" "}
        <b>Leiden res 0.8</b>. This local re-derivation is the load-bearing step: a single global HVG pass is dominated by
        the most abundant cell types and buries rare tissues like <b>blood, pancreas, and liver</b> — recomputing
        per-compartment is what lets them surface. Result: <b>{n} fine leaf clusters</b>.
      </p>
      <p style={S}>
        <span style={H}>Step 3 — Naming: control cells vote.</span> Every cell is used to build the clusters, but only the{" "}
        <b>non-perturbed control cells</b> (<code>gene_target ctrl-*</code>) vote on each cluster&apos;s tissue name
        (all-cells vote as secondary). At this stage the labeller hasn&apos;t run yet — the name is a{" "}
        <b>provisional scaffold</b> inherited from ZSCAPE&apos;s own annotations. Restricting the vote to controls keeps
        drug-induced transcriptional shifts from biasing that scaffold.
      </p>
      <p style={S}>
        <span style={H}>Why two stages.</span> This broad-compartments-containing-leaf-clusters structure is exactly what
        the <b>v2.0 harness descends top-down</b>: it names each compartment&apos;s umbrella first, then dives only into
        branches where an expected tissue or cell type is still missing.
      </p>
      <p style={{ ...S, marginBottom: 0 }}>
        <span style={H}>One honest limit.</span> Blood, pancreas, and intestine come out cleanly and liver is named — but
        at 48 hpf, <b>liver, gut, and pancreas still share a strong common endoderm program</b>, so they remain partly
        blended. The liver cluster is a <b>plurality call</b>, not a pure one.
      </p>
      <div style={{ borderTop: "1px solid #eee7df", paddingTop: 11, marginTop: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#8a847b", marginBottom: 5 }}>
          The technical recipe (813,782 cells → {n} fine leaf clusters)
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#5a544c", margin: 0 }}>
          <b>Two-stage recursive Leiden.</b> ① coarse Leiden 0.1 → broad compartments. ② per-compartment (≥500 cells):
          recompute 2,000 HVG (seurat) → local Leiden 0.8, kNN 15. GT names: control-vote primary, all-cells secondary.
          <br />
          <span style={{ fontFamily: "ui-monospace, monospace", color: "#9a948c" }}>recipe: scratch/bench/build_zscape_recursive_ctrlvote_res08.py</span>
        </p>
      </div>
    </div>
  );
}
