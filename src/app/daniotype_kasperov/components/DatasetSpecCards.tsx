// DatasetSpecCards — a reference grid of per-dataset spec cards, rendered at the bottom of
// /daniotype_kasperov (the slot the file-upload dropzone used to occupy).
//
// Pure reference: no state, no fetch, no interaction — it never touches the wizard's stage
// machine or any run store, so it stays a server component.
//
// Data comes from TWO files, joined on the dataset `id`:
//   dataset_facts.json — already the source of truth for CELLS + METHOD (platform). Not duplicated.
//   dataset_cards.json — the biology/design fields (genes, tissues, timing, perturbations, …).
// Anything the repo doesn't state is the literal string "TBD" in dataset_cards.json and renders
// as a muted TBD here. Nothing on this card is inferred or estimated.
import React from "react";
import { PAPER, INK, ACCENT } from "../theme";
import DATASET_FACTS from "../dataset_facts.json";
import DATASET_CARDS from "../dataset_cards.json";

const FACTS: Record<string, any> = DATASET_FACTS as any;
const CARDS: Record<string, any> = (DATASET_CARDS as any).cards;
const ORDER: string[] = (DATASET_CARDS as any).order;

const TBD = "TBD";
const isTbd = (v: unknown) => v === TBD;

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const RULE = "#e5e1dc";
const MUTED = "#8a847b";
const FAINT = "#b0a89e";

const nfmt = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-US") : TBD);

// Perturbation class → chip tint. Same pill idiom as HarnessBadge (KasperovClient.tsx:168):
// tinted background, darker text, 1px matching border, fully-rounded.
type Tint = { bg: string; fg: string; bd: string };
const CLASS_TINT: Record<string, Tint> = {
  DRUG: { bg: "#e2f1f4", fg: "#0e6a80", bd: "#bfdfe7" },
  "GENETIC KO": { bg: "#fef3c7", fg: "#92400e", bd: "#fcd34d" },
  "CONTROL ARM": { bg: "#f1efeb", fg: "#6b655d", bd: "#ddd8d1" },
  UNPERTURBED: { bg: "#f0f4f2", fg: "#4a6b5c", bd: "#d3e0d9" },
};
const NEUTRAL: Tint = { bg: "#f3f0ec", fg: FAINT, bd: "#e5e1dc" };
const tintFor = (cls: string): Tint => CLASS_TINT[cls] || NEUTRAL;

// ── atoms ──────────────────────────────────────────────────────────────────
function Value({ v }: { v: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11.5,
        fontWeight: isTbd(v) ? 600 : 700,
        color: isTbd(v) ? FAINT : INK,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: isTbd(v) ? 0.6 : 0,
        textAlign: "right",
      }}
    >
      {v}
    </span>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        padding: "6px 0",
        borderBottom: last ? "none" : `1px solid ${RULE}`,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED }}>
        {label}
      </span>
      <Value v={value} />
    </div>
  );
}

function SectionHead({ label, summary }: { label: string; summary: string }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: MUTED, margin: "13px 0 7px" }}>
      {label}
      <span style={{ color: isTbd(summary) ? FAINT : "#6b655d" }}> — {summary}</span>
    </div>
  );
}

// Perturbation chip — tinted by the card's perturbation class.
function PertChip({ text, tint }: { text: string; tint: Tint }) {
  const blank = isTbd(text);
  const t = blank ? NEUTRAL : tint;
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.3, borderRadius: 99, padding: "2px 8px",
        color: t.fg, background: t.bg, border: `1px solid ${t.bd}`,
        fontStyle: blank ? "italic" : "normal", whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

// Control chip — outlined + italic + muted, deliberately quieter than a perturbation.
function CtrlChip({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.3, borderRadius: 99, padding: "2px 8px",
        color: isTbd(text) ? FAINT : "#6b655d", background: "transparent",
        border: `1px solid ${isTbd(text) ? "#e5e1dc" : "#d8d3cd"}`,
        fontStyle: "italic", whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };

// ── card ───────────────────────────────────────────────────────────────────
function DatasetSpecCard({ id }: { id: string }) {
  const c = CARDS[id];
  const f = FACTS[id] || {};
  if (!c) return null;
  const tint = tintFor(c.perturbationClass);
  const perts: string[] = c.perturbations?.items || [];
  const ctrls: string[] = c.controls?.items || [];

  return (
    <div
      style={{
        background: "#fffdfb",
        border: `1px solid ${RULE}`,
        borderRadius: 12,
        padding: "15px 17px 16px",
        color: INK,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* header — serif name left, perturbation-class badge right */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{c.name}</span>
        <span
          title={`Perturbation class — ${c.perturbationClass}`}
          style={{
            flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap",
            color: tint.fg, background: "transparent", border: `1px solid ${tint.bd}`,
          }}
        >
          {c.perturbationClass}
        </span>
      </div>

      {/* stat table — CELLS + METHOD read from dataset_facts.json; the rest from dataset_cards.json */}
      <div style={{ marginTop: 11 }}>
        <StatRow label="Cells" value={nfmt(f.cells)} />
        <StatRow label="Genes" value={c.genes} />
        <StatRow label="Tissues" value={c.tissues} />
        <StatRow label="Cell types" value={c.cellTypes} />
        <StatRow label="Method" value={f.platform || TBD} />
        <StatRow label="Capture" value={c.capture} />
        {(c.timing || []).map((t: any, i: number) => (
          <StatRow key={t.label} label={t.label} value={t.value} last={i === (c.timing || []).length - 1} />
        ))}
      </div>

      <SectionHead label="Perturbations" summary={c.perturbations?.summary || TBD} />
      {perts.length ? (
        <div style={chipWrap}>{perts.map((p, i) => <PertChip key={i} text={p} tint={tint} />)}</div>
      ) : (
        <div style={{ fontSize: 11, color: FAINT, fontStyle: "italic" }}>None — nothing applied.</div>
      )}

      <SectionHead label="Controls" summary={c.controls?.summary || TBD} />
      <div style={chipWrap}>{ctrls.map((x, i) => <CtrlChip key={i} text={x} />)}</div>

      <div
        style={{
          marginTop: "auto", paddingTop: 13, fontSize: 11, fontStyle: "italic", lineHeight: 1.45,
          color: isTbd(c.footer) ? FAINT : MUTED,
        }}
      >
        {isTbd(c.footer) ? "Pathways / targets — TBD" : c.footer}
      </div>
    </div>
  );
}

// ── summary strip ──────────────────────────────────────────────────────────
// Every numeral here is summed straight from dataset_facts.json — nothing estimated.
function SummaryStrip({ ids }: { ids: string[] }) {
  const rows = ids.map((id) => FACTS[id]).filter(Boolean);
  const cells = rows.reduce((s, f) => s + (typeof f.cells === "number" ? f.cells : 0), 0);
  const clusters = rows.reduce((s, f) => s + (typeof f.clusters === "number" ? f.clusters : 0), 0);
  const gt = rows.filter((f) => f.role === "gt").length;
  const items = [
    { n: String(rows.length), cap: "atlases" },
    { n: cells.toLocaleString("en-US"), cap: "cells profiled" },
    { n: clusters.toLocaleString("en-US"), cap: "clusters" },
    { n: String(gt), cap: "with published labels" },
  ];
  return (
    <div
      style={{
        marginTop: 16, borderTop: `1px solid ${RULE}`, paddingTop: 16,
        display: "flex", flexWrap: "wrap", gap: 34, alignItems: "flex-end",
      }}
    >
      {items.map((it) => (
        <div key={it.cap} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
            {it.n}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: MUTED, fontVariant: "all-small-caps" }}>
            {it.cap}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── section ────────────────────────────────────────────────────────────────
export default function DatasetSpecCards() {
  const ids = ORDER.filter((id) => CARDS[id]);
  return (
    <section style={{ background: PAPER, color: INK, padding: "34px 20px 60px", borderTop: `1px solid ${RULE}` }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", marginBottom: 4 }}>
          ▤ Dataset specs
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 720 }}>
          What each atlas actually is — design, perturbations, controls. Fields we haven&rsquo;t sourced yet read{" "}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: FAINT, letterSpacing: 0.6 }}>TBD</span>{" "}
          rather than a guess.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {ids.map((id) => <DatasetSpecCard key={id} id={id} />)}
        </div>
        <SummaryStrip ids={ids} />
      </div>
    </section>
  );
}
