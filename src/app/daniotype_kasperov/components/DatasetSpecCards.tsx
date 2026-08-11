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
import DatasetProfileCard, { hasProfile } from "./DatasetProfileCard";

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

// A value that points somewhere — accession, repo. Same monospace weight as a plain value so the
// fact table stays even; the accent and underline carry the affordance.
function Linked({ text, href }: { text: string; href?: string }) {
  if (!href) return <Value v={text} />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: ACCENT,
        textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "#a9d3de",
      }}
    >
      {text}
    </a>
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
        fontFamily: MONO, fontSize: 9.5, fontWeight: on ? 700 : 600,
        fontVariantNumeric: "tabular-nums", borderRadius: 99, padding: "1.5px 7px",
        whiteSpace: "nowrap",
        // 48 hpf is nudged forward, not shouted: a light tint and a coloured rule, no solid fill.
        color: on ? "#0e6a80" : MUTED,
        background: on ? "#e6f2f5" : "#f3f0ec",
        border: `1px solid ${on ? "#a9d3de" : RULE}`,
      }}
    >
      {v}{unit ? ` ${unit}` : ""}
    </span>
  );
}

// Full timepoint vector, read from obs — every stage the atlas actually contains, wrapped
// rather than truncated. 48 hpf (if present) is the only filled pill.
function TimepointPills({ tp }: { tp: { unit?: string; values: string[]; highlight?: string; highlightTitle?: string; status?: string } }) {
  const vals = tp.values || [];
  if (!vals.length) {
    return <span style={{ fontSize: 11, fontStyle: "italic", color: FAINT }}>{tp.status || TBD}</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "baseline" }}>
      {vals.map((v) => (
        <TimePill key={v} v={v} on={v === tp.highlight} title={v === tp.highlight ? tp.highlightTitle : undefined} />
      ))}
    </div>
  );
}

// The atlas's OWN label hierarchy, with the real column names. Deliberately not normalised to a
// common tier: ChemFish's 348 cell_type and ZSCAPE's 99 cell_type_broad are different kinds of
// number, and flattening them to one "CELL TYPES" row hid that.
// Emphasis sits on the tier NAMES — the shape of the vocabulary is the point; the counts are
// supporting detail, so they ride small and muted beside each name.
function SchemaInline({ schema }: { schema: any }) {
  const names: string[] | null = schema?.tierNames || null;
  const tiers: any[] | null = schema?.tiers || null;
  const arrow = <span style={{ color: FAINT, fontSize: 11, margin: "0 1px" }}>→</span>;
  if (!names && !tiers) {
    return <span style={{ fontSize: 11, fontStyle: "italic", color: FAINT }}>{schema?.status || TBD}</span>;
  }
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 5px" }}>
      {(names || tiers!.map((t: any) => t.col)).map((nm: string, i: number) => (
        <React.Fragment key={nm}>
          {i > 0 && arrow}
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK }}>{nm}</span>
            {tiers && (
              <span style={{ fontFamily: MONO, fontSize: 9, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                {tiers[i].n}
              </span>
            )}
          </span>
        </React.Fragment>
      ))}
      {schema?.source && (
        <span style={{ fontSize: 9.5, fontStyle: "italic", color: FAINT, marginLeft: 4 }}>
          {schema.source}
          {schema.note ? ` · ${schema.note}` : ""}
        </span>
      )}
    </span>
  );
}

// The ZFA vocabulary, sized. Its own row on the atlases we label into ZFA.
function VocabRow({ v }: { v: any }) {
  const cell = (n: string, cap: string) => (
    <span key={cap} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{n}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", color: MUTED }}>{cap}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 16px" }}>
      {cell(v.terms, "terms")}
      {cell(v.synonyms, "synonyms")}
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, color: MUTED }}>
        {cell(v.strings, "strings")}
        <span style={{ color: FAINT, fontSize: 11 }}>→</span>
        {cell(v.concepts, "concepts")}
      </span>
    </div>
  );
}

function SectionHead({ label, summary }: { label: string; summary: string }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7, color: MUTED, margin: "13px 0 7px" }}>
      <span style={{ textTransform: "uppercase" }}>{label}</span>
      {/* NOT uppercased — the summaries are already written in caps, and transforming them would
          mangle the unit symbol in "1 µM & 5 µM" into "1 MM & 5 MM". */}
      <span style={{ color: isTbd(summary) ? FAINT : "#6b655d" }}> — {summary}</span>
    </div>
  );
}

// Perturbation chip — tinted by the card's perturbation class, or by its own hue when the card
// keys colour per drug.
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

// Dose chips: both doses of one compound share a hue, and the hue walks a little between
// compounds — so a pair reads as a pair without turning the block into a rainbow. Hue is keyed to
// the compound's position in the sorted list, so it's stable across renders.
type Dosed = { drug: string; dose: string | null };
const isDosed = (x: unknown): x is Dosed => !!x && typeof x === "object" && "drug" in (x as any);

function doseTint(i: number, n: number): Tint {
  const h = 150 + (n > 1 ? (i / (n - 1)) * 128 : 0); // teal → indigo, staying in the cool family
  return { bg: `hsl(${h} 44% 94%)`, fg: `hsl(${h} 52% 31%)`, bd: `hsl(${h} 36% 83%)` };
}

function DoseChips({ items }: { items: Dosed[] }) {
  const drugs = Array.from(new Set(items.map((d) => d.drug)));
  const hueOf = new Map(drugs.map((d, i) => [d, doseTint(i, drugs.length)]));
  return (
    <div style={chipWrap}>
      {items.map((d, i) => {
        const t = hueOf.get(d.drug) || NEUTRAL;
        return (
          <span
            key={i}
            title={d.dose ? `${d.drug} — ${d.dose}` : d.drug}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.3, borderRadius: 99, padding: "2px 8px",
              color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap",
            }}
          >
            {d.drug}
            {d.dose && (
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, opacity: 0.75 }}> {d.dose}</span>
            )}
          </span>
        );
      })}
    </div>
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

// Perturbation sub-groups (ZSCAPE: single vs double knockout, crispant vs stable mutant).
// Separated by a hairline and a small caption, each group on its own hue — enough to read as
// three kinds of thing without fragmenting the block into three separate sections.
const GROUP_TINT: Tint[] = [
  { bg: "#fdf6e3", fg: "#8a6410", bd: "#ecd9a4" }, // single-gene crispant
  { bg: "#f6f0e6", fg: "#7a5c2e", bd: "#e0d0b4" }, // double-gene crispant
  { bg: "#f2eee9", fg: "#6b6153", bd: "#ddd4c6" }, // stable mutant line
];

function PertGroups({ groups }: { groups: { label: string; items: string[] }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {groups.map((g, gi) => (
        <div
          key={g.label}
          style={{ paddingTop: gi === 0 ? 0 : 7, borderTop: gi === 0 ? "none" : `1px solid #efeae3` }}
        >
          <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: FAINT, marginBottom: 5 }}>
            {g.label}
          </div>
          <div style={chipWrap}>
            {g.items.map((t) => <PertChip key={t} text={t} tint={GROUP_TINT[gi % GROUP_TINT.length]} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── card ───────────────────────────────────────────────────────────────────
function DatasetSpecCard({ id }: { id: string }) {
  const c = CARDS[id];
  const f = FACTS[id] || {};
  if (!c) return null;
  const tint = tintFor(c.perturbationClass);
  const perts: any[] = c.perturbations?.items || [];
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
      {/* Two explicit columns rather than a row-major grid, so what-the-data-IS (cells, genes and
          the reference it was built against) stacks down the left, and how-it-was-MADE stacks down
          the right. Row-major fill couldn't express that. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 30px", marginTop: 14 }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <FactCell label="Cells" value={c.cells || nfmt(f.cells)} sub={c.workingSlice} />
          <FactCell label="Genes" value={c.genes} />
          <FactCell label="Genome" value={c.genome} />
          <FactCell label="Annotation" value={c.annotation} />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          {/* c.method is an override for datasets with no dataset_facts.json row (ZCL 2.0). */}
          <FactCell label="Method" value={c.method || f.platform || TBD} />
          <FactCell label="Capture" value={c.capture} />
          {c.line && <FactCell label="Line" value={c.line} />}
          {c.replicates && <FactCell label="Replicates" value={c.replicates} />}
        </div>
      </div>

      {/* How the authors got from raw FASTQ to the object we hold. Sits directly under the
          reference block because genome → annotation → raw processing → downstream object is one
          provenance chain, and the reader should be able to follow it in order. */}
      {c.pipeline && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 30 }}>
          <FactCell label="Raw processing" value={c.pipeline.raw} />
          <FactCell label="Downstream object" value={c.pipeline.downstream} />
          {c.pipeline.accession && (
            <FactCell label="Accession">
              <Linked text={c.pipeline.accession} href={c.pipeline.accessionHref} />
            </FactCell>
          )}
          {c.pipeline.code && (
            <FactCell label="Code">
              <Linked text={c.pipeline.code} href={c.pipeline.codeHref} />
            </FactCell>
          )}
        </div>
      )}

      {/* Reference build — the exact files and transforms behind the feature universe. Only
          present where we've actually pinned it, so it never renders as a row of TBDs. */}
      {c.reference && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 30 }}>
            <FactCell label="FASTA" value={c.reference.fasta} />
            <FactCell label="GTF" value={c.reference.gtf} />
            <FactCell label="Reference processing" value={c.reference.processing} />
            <FactCell label="Feature universe" value={c.reference.features} />
          </div>
          <FactCell label="3′ extension" value={c.reference.extension} />
          <FactCell label="Gene filtering" value={c.reference.filter} />
          <div
            style={{
              margin: "10px 0 2px", background: "#f2f7f5", border: "1px solid #d6e6df",
              borderRadius: 8, padding: "7px 9px", fontSize: 10.5, lineHeight: 1.45, color: "#3f6b55",
            }}
          >
            <strong style={{ letterSpacing: 0.3 }}>REFERENCE CONFIRMED</strong> — {c.reference.confidence}
          </div>
        </>
      )}

      {/* full-width rows — the vocabulary and the time axes */}
      <div>
        <FactCell label="Native schema" stack={!!c.schema?.tierNames}>
          <SchemaInline schema={c.schema} />
        </FactCell>
        {c.vocabulary && (
          <FactCell label="ZFA vocabulary" stack>
            <VocabRow v={c.vocabulary} />
          </FactCell>
        )}
        {c.timepoints && (
          <FactCell label={`Timepoints (${(c.timepoints.values || []).length})`} stack>
            <TimepointPills tp={c.timepoints} />
          </FactCell>
        )}
        {(c.dosing || c.collection) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 30 }}>
            {c.dosing && (
              <FactCell label={`Dosing timepoints (${(c.dosing.values || []).length})`} stack>
                <TimepointPills tp={c.dosing} />
              </FactCell>
            )}
            {c.collection && (
              <FactCell label={`Collection timepoints (${(c.collection.values || []).length})`} stack>
                <TimepointPills tp={c.collection} />
              </FactCell>
            )}
          </div>
        )}
      </div>

      {/* what was done to the animals */}
      <SectionHead label="Perturbations" summary={c.perturbations?.summary || TBD} />
      {c.perturbations?.groups ? (
        <PertGroups groups={c.perturbations.groups} />
      ) : perts.length ? (
        isDosed(perts[0])
          ? <DoseChips items={perts as unknown as Dosed[]} />
          : <div style={chipWrap}>{(perts as string[]).map((p, i) => <PertChip key={i} text={p} tint={tint} />)}</div>
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
        {/* One card per row. Where an expanded technical profile exists, it follows immediately
            after that dataset's concise card — fast orientation first, then the deep reference.
            The concise cards themselves are untouched. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {ids.map((id) => (
            <React.Fragment key={id}>
              <DatasetSpecCard id={id} />
              {hasProfile(id) && <DatasetProfileCard id={id} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
