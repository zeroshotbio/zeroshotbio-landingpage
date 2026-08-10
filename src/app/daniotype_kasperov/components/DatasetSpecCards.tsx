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
  // Observational = no treatment arm at all. Deliberately green-leaning and distinct from
  // CONTROL ARM, which is a perturbation study's untreated wells — not the same thing.
  OBSERVATIONAL: { bg: "#eef4f0", fg: "#3f6b55", bd: "#cfe0d6" },
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
      }}
    >
      {v}
    </span>
  );
}

const rowLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
  textTransform: "uppercase", color: MUTED,
};

// One fact. The value sits immediately beside its label rather than flushed to a far edge, so a
// label/value pair reads as a unit and two columns can run side by side without the eye getting
// lost across a gap. `span` makes a fact take the full card width (schema, timepoints).
function FactCell({
  label, value, sub, span, highlight, stack, children,
}: {
  label: string; value?: string; sub?: string | null; span?: boolean;
  highlight?: boolean; stack?: boolean; children?: React.ReactNode;
}) {
  const body = children ?? (highlight && !isTbd(value || "") ? <TimePill v={value || ""} on /> : <Value v={value || TBD} />);
  return (
    <div style={{ gridColumn: span ? "1 / -1" : "auto", padding: "7px 0", borderBottom: `1px solid ${RULE}`, minWidth: 0 }}>
      <div
        style={
          stack
            ? { minWidth: 0 }
            : { display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", minWidth: 0 }
        }
      >
        <span style={{ ...rowLabel, ...(stack ? { display: "block", marginBottom: 6 } : null) }}>{label}</span>
        {body}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: 10, fontStyle: "italic", color: FAINT, lineHeight: 1.35 }}>{sub}</div>
      )}
    </div>
  );
}

// A single timepoint token. `on` = this atlas covers 48 hpf, our common join point across
// datasets — filled accent so a reader scanning all seven cards spots it without reading.
function TimePill({ v, on, unit, title }: { v: string; on?: boolean; unit?: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        fontFamily: MONO, fontSize: 9.5, fontWeight: on ? 800 : 600,
        fontVariantNumeric: "tabular-nums", borderRadius: 99, padding: "1.5px 7px",
        whiteSpace: "nowrap",
        color: on ? "#fff" : MUTED,
        background: on ? ACCENT : "#f3f0ec",
        border: `1px solid ${on ? ACCENT : RULE}`,
      }}
    >
      {v}{unit ? ` ${unit}` : ""}
    </span>
  );
}

// Full timepoint vector, read from obs — every stage the atlas actually contains, wrapped
// rather than truncated. 48 hpf (if present) is the only filled pill.
function TimepointPills({ tp }: { tp: { unit?: string; values: string[]; highlight?: string; highlightTitle?: string } }) {
  const vals = tp.values || [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "baseline" }}>
      {vals.map((v) => (
        <TimePill key={v} v={v} on={v === tp.highlight} title={v === tp.highlight ? tp.highlightTitle : undefined} />
      ))}
      <span style={{ marginLeft: 3, fontFamily: MONO, fontSize: 9.5, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
        {vals.length} · {tp.unit || ""}
      </span>
    </div>
  );
}

// The atlas's OWN label hierarchy, with the real column names. Deliberately not normalised to a
// common tier: ChemFish's 348 cell_type and ZSCAPE's 99 cell_type_broad are different kinds of
// number, and flattening them to one "CELL TYPES" row hid that.
function SchemaInline({ schema }: { schema: any }) {
  return (
    <>
      {schema?.tiers ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 5px" }}>
          {schema.tiers.map((t: any, i: number) => (
            <React.Fragment key={t.col}>
              {i > 0 && <span style={{ color: FAINT, fontSize: 11 }}>→</span>}
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{t.n}</span>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: MUTED }}>{t.col}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 11, fontStyle: "italic", color: FAINT }}>{schema?.status || TBD}</span>
      )}
    </>
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
        position: "relative",
        background: "#fffdfb",
        border: `1px solid ${RULE}`,
        borderRadius: 18,
        padding: "24px 28px 20px",
        // Landscape: wider than tall. minHeight is a floor, not a cap — the compound-heavy MegaFIN
        // pair grow past it to hold 46 chips rather than being cropped.
        minHeight: 430,
        color: INK,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* inset hairline frame — the playing-card border-within-a-border */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 9, border: "1px solid #f1ece5", borderRadius: 12, pointerEvents: "none" }}
      />

      {/* header — serif name left, perturbation-class badge right (the card's top index) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.2 }}>{c.name}</span>
        <span
          title={`Perturbation class — ${c.perturbationClass}`}
          style={{
            flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap",
            color: tint.fg, background: "transparent", border: `1px solid ${tint.bd}`,
          }}
        >
          {c.perturbationClass}
        </span>
      </div>

      {/* Described but deliberately unrunnable. Sits directly under the header so a reader hits it
          before the stats and reads the missing chooser row as intent, not breakage. */}
      {c.notRunnable && (
        <div
          style={{
            marginTop: 10, background: "#faf8f5", border: `1px solid #ece8e2`, borderRadius: 8,
            padding: "7px 9px", fontSize: 10.5, fontStyle: "italic", lineHeight: 1.45, color: MUTED,
          }}
        >
          {c.notRunnable}
        </div>
      )}

      {/* Headline facts in two columns. CELLS is the full published object (dataset_cards.json),
          falling back to dataset_facts.json; METHOD still comes from facts. A subsample never sits
          here unlabelled: where we work on a slice, workingSlice names it directly beneath. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 30, marginTop: 14 }}>
        <FactCell label="Cells" value={c.cells || nfmt(f.cells)} sub={c.workingSlice} />
        <FactCell label="Genes" value={c.genes} />
        <FactCell label="Method" value={f.platform || TBD} />
        <FactCell label="Capture" value={c.capture} />
        <FactCell label="Native schema" span>
          <SchemaInline schema={c.schema} />
        </FactCell>
        {c.timepoints && (
          <FactCell label="Timepoints" span stack>
            <TimepointPills tp={c.timepoints} />
          </FactCell>
        )}
        {(c.timing || []).map((t: any) => (
          <FactCell key={t.label} label={t.label} value={t.value} highlight={t.highlight} />
        ))}
      </div>

      {/* what was done to the animals */}
      <SectionHead label="Perturbations" summary={c.perturbations?.summary || TBD} />
      {perts.length ? (
        <div style={chipWrap}>{perts.map((p, i) => <PertChip key={i} text={p} tint={tint} />)}</div>
      ) : (
        <div style={{ fontSize: 11, color: FAINT, fontStyle: "italic" }}>None — nothing applied.</div>
      )}

      <SectionHead label="Controls" summary={c.controls?.summary || TBD} />
      {ctrls.length ? (
        <div style={chipWrap}>{ctrls.map((x, i) => <CtrlChip key={i} text={x} />)}</div>
      ) : (
        // N/A, not TBD: an observational atlas has no control arm because it has no treatment arm.
        <div style={{ fontSize: 11, color: FAINT, fontStyle: "italic" }}>
          {c.controls?.summary === "N/A" ? "No control arm — nothing to control against." : TBD}
        </div>
      )}

      {/* what this dataset is, in a breath — pinned to the foot of the card */}
      <div
        style={{
          marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${RULE}`,
          fontSize: 12.5, lineHeight: 1.55, color: "#5a544c",
        }}
      >
        {c.summary || TBD}
      </div>
    </div>
  );
}

// ── summary strip ──────────────────────────────────────────────────────────
// Every numeral here is summed from the cards — nothing estimated. Cells match what the cards
// show (full published objects), NOT dataset_facts.json's working-slice counts, so the strip and
// the grid above it can never disagree.
const cellsOf = (id: string): number => {
  const s = CARDS[id]?.cells;
  if (typeof s === "string") {
    const n = Number(s.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  const f = FACTS[id];
  return typeof f?.cells === "number" ? f.cells : 0;
};

function SummaryStrip({ ids }: { ids: string[] }) {
  const rows = ids.map((id) => FACTS[id]).filter(Boolean);
  const cells = ids.reduce((s, id) => s + cellsOf(id), 0);
  const clusters = rows.reduce((s, f) => s + (typeof f.clusters === "number" ? f.clusters : 0), 0);
  // role === "gt" means "we score against its published labels", NOT "has published labels" —
  // Zebrahub has 147 published ZFA classes but is a reference we never score, so the caption says
  // gt benchmarks. `clusters` is our de-novo partitions, not an atlas property, so it's captioned
  // as ours; Zebrahub contributes none (no `clusters` key) because we've cut no partition of it.
  const gt = rows.filter((f) => f.role === "gt").length;
  const items = [
    { n: String(rows.length), cap: "atlases" },
    { n: cells.toLocaleString("en-US"), cap: "cells profiled" },
    { n: clusters.toLocaleString("en-US"), cap: "clusters we cut" },
    { n: String(gt), cap: "gt benchmarks" },
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
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", marginBottom: 4 }}>
          ▤ Dataset specs
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 720 }}>
          What each atlas actually is — design, perturbations, controls. Fields we haven&rsquo;t sourced yet read{" "}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: FAINT, letterSpacing: 0.6 }}>TBD</span>{" "}
          rather than a guess.
        </p>
        {/* one card per row — each is its own object, not a cell in a grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {ids.map((id) => <DatasetSpecCard key={id} id={id} />)}
        </div>
        <SummaryStrip ids={ids} />
      </div>
    </section>
  );
}
