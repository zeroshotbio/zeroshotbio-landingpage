"use client";
// ConfidencePanel — the always-on four-tier "Tier Confidence" HUD with smoothly
// tweened bars. Extracted verbatim from KasperovClient.tsx; presentational,
// props-only. Shared by the live wizard and the Phase 2 read-only run viewer.
import React from "react";
import { type ClusterConf, CONF_TIERS } from "../types";
import { Typewriter } from "./Typewriter";
import { useTween } from "../useTween";

// one tier's prediction + a smoothly-tweened confidence bar (greyscale — colour
// is reserved for personalities)
function TierConfRow({ label, pred, pct, celebrate }: { label: string; pred: string; pct: number; celebrate?: boolean }) {
  const shown = useTween(pct); // easeInOutQuad — accelerates then decelerates toward the new value
  const barColor = celebrate ? "#15803d" : "#6b6660";
  return (
    <div style={{ marginBottom: 11, borderRadius: 6, padding: celebrate ? "3px 5px" : 0, margin: celebrate ? "0 -5px 8px" : "0 0 11px", animation: celebrate ? "krowglow 1.6s ease-out forwards" : "none" }}>
      {/* row 1: tier name + the % */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span style={{ color: celebrate ? "#15803d" : "#999", fontWeight: celebrate ? 700 : 600, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 10 }}>{label}</span>
        <span style={{ color: celebrate ? "#15803d" : "#2b2b2b", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontSize: 14, textAlign: "right" }}>{shown.toFixed(0)}%</span>
      </div>
      {/* row 2: the label gets its OWN full-width line (names can be long) */}
      <Typewriter text={pred || "—"} style={{ display: "block", color: celebrate ? "#14532d" : "#2b2b2b", fontWeight: celebrate ? 700 : 500, fontSize: 12.5, lineHeight: 1.3, margin: "1px 0 3px", wordBreak: "break-word" }} />
      {/* row 3: the confidence bar */}
      <div style={{ height: 7, background: "#e8e4df", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${shown}%`, height: "100%", background: barColor, transition: "background .3s ease" }} />
      </div>
    </div>
  );
}

// Always-on TIER CONFIDENCE HUD. Renders the four tiers even before the first
// assessment (placeholder "—" / 0%), then the numbers tween up/down each turn.
// `celebrate` lights up the settled four-tier call when an auto-pilot job finishes.
export function ConfidenceContent({ conf, busy, celebrate }: { conf?: ClusterConf; busy?: boolean; celebrate?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: celebrate ? "#15803d" : busy ? "#6b6660" : "#aaa", fontWeight: celebrate ? 700 : 400, marginBottom: 7 }}>
        {(busy || celebrate) && <span style={{ width: 6, height: 6, borderRadius: 99, background: celebrate ? "#15803d" : "#6b6660", animation: "kpulse 1.1s infinite", flexShrink: 0 }} />}
        <span>{celebrate ? "✓ Cell type labelled — four-tier call settled." : busy ? "Re-scoring all four tiers…" : conf ? "Goal: drive every tier's confidence up." : "Awaiting evidence — confidences update every turn."}</span>
      </div>
      {CONF_TIERS.map((t) => {
        const tp = conf?.[t.key];
        return <TierConfRow key={t.key} label={t.label} pred={tp?.prediction ?? ""} pct={tp?.pct ?? 0} celebrate={celebrate} />;
      })}
      {conf?.why && <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.45, marginTop: 4 }}><Typewriter text={conf.why} /></div>}
    </div>
  );
}
