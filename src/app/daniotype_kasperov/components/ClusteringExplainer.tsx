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

// ZSCAPE "1. Clustering" — the single textbook-intro paragraph beneath the UMAP.
// Leaf count keyed to the live atlas (nLeaves), never a baked literal.
export function ZscapeClusteringExplainer({ nLeaves }: { nLeaves?: number }) {
  const n = nLeaves && nLeaves > 0 ? nLeaves : 250;
  return (
    <div style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "11px 16px", maxWidth: 820, margin: "8px auto 0", textAlign: "left" }}>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "#33312e", margin: 0 }}>
        ZSCAPE is clustered in <b>two recursive stages</b>. First, all <b>~813,000 cells from the 48-hour stage</b>{" "}
        (a single developmental age, so young and old cells are never blended) are grouped into a handful of broad{" "}
        <b>compartments</b>. Then the method goes <b>inside each compartment and recomputes which genes vary most locally</b>{" "}
        before clustering again — this local re-derivation of marker genes is what lets rare tissues like{" "}
        <b>blood, pancreas, and liver</b> surface, where a single global pass would bury them under the dominant cell types.{" "}
        <b>Every cell is used to build the clusters.</b> Each resulting cluster is then given its tissue name by a{" "}
        <b>vote that counts only the non-perturbed control cells</b>, so drug-induced shifts don&apos;t bias the labels —{" "}
        to be explicit: <i>all cells are clustered; only control cells vote on the names.</i> The result is{" "}
        <b>{n} fine clusters</b> spanning the embedding. This two-stage structure — broad{" "}
        <b>compartments</b> that each contain finer <b>leaf clusters</b> — is exactly what the new{" "}
        <b>v2.0 labelling harness descends top-down</b>: it names each compartment&apos;s umbrella first, then dives only{" "}
        into the branches where an expected tissue or cell type is still missing. One honest limit: blood, pancreas,{" "}
        and intestine come out cleanly and liver is named, but at 48 hpf{" "}
        <b>liver, gut, and pancreas still share a strong common endoderm program</b>, so they remain partly blended —{" "}
        the liver cluster is a <b>plurality call</b>, not a pure one.
      </p>
    </div>
  );
}
