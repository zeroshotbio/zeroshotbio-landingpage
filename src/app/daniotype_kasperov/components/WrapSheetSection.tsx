// WrapSheetSection — the MiniFin & MegaFin wrap sheet, rendered at the very bottom of
// /daniotype_kasperov, below the dataset spec cards and the paper drop zone.
//
// A reference, not a tool: no state, no fetch — a server component, so it sits behind the same
// Basic-Auth gate as the rest of the page instead of being a public file.
//
// Compiled 2026-09-11 from the S3 buckets (bronze fortknox, silver warehouse, gold library), the
// zsb-bronze / zsb-silver / zsb-gold repos, and the analysis instance. Every fact carries how sure
// we are of it: MEASURED (read from the data or Parse's own summaries), STATED (written in a design
// doc, recorded in no data object), INFERRED (derived, written nowhere), CONFLICT (sources disagree).
// The standalone version with the same content: claude.ai artifact "MiniFin & MegaFin Wrap Sheet".
import React from "react";
import { PAPER, INK, ACCENT } from "../theme";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const RULE = "#e5e1dc";
const MUTED = "#8a847b";
const FAINT = "#b0a89e";
const CARD = "#fffdfb";

type Conf = "m" | "s" | "i" | "x";
const CONF: Record<Conf, { label: string; bg: string; fg: string; bd: string }> = {
  m: { label: "measured", bg: "#e2f1f4", fg: "#0e6a80", bd: "#bfdfe7" },
  s: { label: "stated", bg: "#eaeff7", fg: "#3a5f8a", bd: "#cbd8ea" },
  i: { label: "inferred", bg: "#fef3c7", fg: "#92400e", bd: "#fcd34d" },
  x: { label: "conflict", bg: "#fbe6e2", fg: "#a33b30", bd: "#f1c3bb" },
};

// Plate-map inks. Conditions follow MiniFin's four arms; MegaFin wells encode dose row.
const INKS = { dmso: "#8a9893", dapa: "#3a78a8", orli: "#c08a22", sora: "#b04438", d5: ACCENT, d1: "#9fd0dc", empty: "#ece8e3" };

// ── atoms ──────────────────────────────────────────────────────────────────
function Chip({ c }: { c: Conf }) {
  const t = CONF[c];
  return (
    <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
      textTransform: "uppercase", padding: "2px 6px", borderRadius: 999, background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`, marginLeft: 6, verticalAlign: 1, whiteSpace: "nowrap" }}>{t.label}</span>
  );
}

function Src({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "block", fontFamily: MONO, fontSize: 10.5, color: FAINT, marginTop: 2, wordBreak: "break-word" }}>{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: MONO, fontSize: 11, background: "#efebe6", padding: "1px 4px", borderRadius: 3 }}>{children}</code>;
}

function H({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 10, marginTop: 30, marginBottom: 12 }}>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.1 }}>{children}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 8, padding: "14px 16px", display: "grid", gap: 10, alignContent: "start" }}>
      {title && <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>}
      {children}
    </div>
  );
}

const cellBase: React.CSSProperties = { padding: "7px 10px", borderBottom: `1px solid #efebe6`, textAlign: "left", verticalAlign: "top" };
const numCell: React.CSSProperties = { ...cellBase, textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const headCell: React.CSSProperties = { ...cellBase, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", background: "#f1eeea", borderBottom: `1px solid ${RULE}` };

function Table({ head, rows, numeric = [] }: { head: string[]; rows: React.ReactNode[][]; numeric?: number[] }) {
  return (
    <div style={{ overflowX: "auto", background: CARD, border: `1px solid ${RULE}`, borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...headCell, textAlign: numeric.includes(i) ? "right" : "left" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} style={numeric.includes(ci) ? numCell : ci === 0 ? { ...cellBase, color: "#5e5850", fontWeight: 600 } : cellBase}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "7px 14px", margin: 0, fontSize: 12.5 }}>
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt style={{ color: MUTED, fontWeight: 600 }}>{k}</dt>
          <dd style={{ margin: 0 }}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ── plate maps ─────────────────────────────────────────────────────────────
type WellStyle = { fill?: string; ring?: boolean; hatched?: boolean; title: string };
function Plate({ rows, cap, style }: { rows: string[]; cap: string; style: (r: string, c: number) => WellStyle }) {
  const cols = Array.from({ length: 12 }, (_, i) => i + 1);
  const ax: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, color: FAINT, textAlign: "center" };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>{cap}</div>
      <div style={{ display: "grid", gridTemplateColumns: "14px repeat(12, minmax(0, 1fr))", gap: 3, alignItems: "center" }}>
        <span />
        {cols.map((c) => <span key={c} style={ax}>{c}</span>)}
        {rows.map((r) => (
          <React.Fragment key={r}>
            <span style={ax}>{r}</span>
            {cols.map((c) => {
              const w = style(r, c);
              return (
                <span key={c} title={`${r}${c} · ${w.title}`} style={{
                  aspectRatio: "1", maxWidth: "100%", borderRadius: "50%", position: "relative",
                  background: w.hatched ? `repeating-linear-gradient(45deg, #b04438 0 2px, transparent 2px 5px)` : w.fill || INKS.empty,
                  boxShadow: w.hatched ? "inset 0 0 0 1.5px #b04438" : w.ring ? `inset 0 0 0 4px ${w.fill}, inset 0 0 0 9px ${CARD}` : undefined,
                }} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Key({ items }: { items: { fill?: string; label: string; ring?: boolean; hatched?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", fontSize: 11.5, color: MUTED }}>
      {items.map((k) => (
        <span key={k.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", flex: "0 0 auto",
            background: k.hatched ? "repeating-linear-gradient(45deg, #b04438 0 2px, transparent 2px 5px)" : k.fill,
            boxShadow: k.hatched ? "inset 0 0 0 1.5px #b04438" : k.ring ? `inset 0 0 0 2px ${k.fill}, inset 0 0 0 5px ${CARD}` : undefined }} />
          {k.label}
        </span>
      ))}
    </div>
  );
}

const DOUBLE_LOADED = new Set(["A2", "A6", "A7", "A8", "A11", "A12", "B2", "B6", "B9", "B12"]);
const miniWell = (r: string, c: number): WellStyle => {
  const left = c <= 6;
  const key = r === "A" || r === "C" ? (left ? "dmso" : "dapa") : left ? "orli" : "sora";
  const name = { dmso: "DMSO 0.1%", dapa: "Dapagliflozin 1 µM", orli: "Orlistat 1 µM", sora: "Sorafenib 1 µM" }[key];
  const dl = DOUBLE_LOADED.has(r + c);
  return { fill: INKS[key as keyof typeof INKS], ring: dl, title: name + (dl ? " · sample loaded into two wells" : "") };
};
const megaWell = (noVehicle: Set<string>) => (r: string, c: number): WellStyle => {
  if (noVehicle.has(r + c)) return { hatched: true, title: "ctrl_no_DMSO · planned drug never dispensed" };
  if (c === 1 && (r === "A" || r === "B")) return { fill: INKS.dmso, title: r === "A" ? "DMSO, 5 µM-matched" : "DMSO, 1 µM-matched" };
  const five = "ACEG".includes(r);
  return { fill: five ? INKS.d5 : INKS.d1, title: five ? "test drug, 5 µM" : "test drug, 1 µM" };
};

// ── content ────────────────────────────────────────────────────────────────
// Static table data. Each cell is one child of an already-keyed <td>, never a list React reorders,
// so the array-literal key rule does not apply here - scoped off for these three tables only.
/* eslint-disable react/jsx-key */
const GLANCE: [string, React.ReactNode, React.ReactNode][] = [
  ["Kit", <>Evercode WT, chemistry v3<Chip c="m" /></>, <>Evercode WT Mega, chemistry v3, on two plates (CP01, CP02)<Chip c="m" /></>],
  ["Round-1 plate", "one 48-well half plate (rows A–D × 12)", "two 96-well plates = 192 wells"],
  ["Samples", "43 Parse sample names on 48 wells — 5 double-loaded", "192 samples, one per well"],
  ["Sublibraries", "8", "16 per plate"],
  ["Fish · embryos", <>TU wild type · 6 per well, pooled<Chip c="s" /></>, <>TU wild type · 6 per well, pooled<Chip c="s" /><Chip c="x" /></>],
  ["Exposure", <>added to pre-dosed wells at 24 hpf, fixed and dissociated at 48 hpf<Chip c="s" /></>, <>24 → 48 hpf<Chip c="s" /></>],
  ["Conditions", "DMSO vehicle + 3 drugs", "91 drugs × 2 doses + dose-matched DMSO + 4 undispensed wells"],
  ["Doses", <>drugs 1 µM · DMSO 0.1%<Chip c="s" /></>, <>5 µM and 1 µM, in every sample name<Chip c="m" /></>],
  ["Replicates", <b>12 wells per condition</b>, <><b>1 well</b> per drug × dose · Sorafenib and DMSO 2 per dose (one per plate)</>],
  ["Reads", "3,655,719,111", "27,094,039,771 + 24,540,854,741"],
  ["Cells called by Parse", "94,615", "646,385 + 701,258 = 1,347,643"],
  ["Median UMIs / genes per cell", "3,198 / 1,618", "3,143 / 1,552 · 3,117 / 1,491"],
  ["Mean reads per cell · saturation", "38,638 · 0.424", "41,916 · 0.570 | 34,995 · 0.615"],
  ["Mito % (13 mt protein genes)", "0.141 median", "0.19 median · whole contig 8.16"],
  ["Current releases", "silver v1 · v2 · v3 / gold parse/v1 · zsb/v2", "silver v1 · v2 / gold parse/v1 · zsb/v1"],
];

const STAGES: React.ReactNode[][] = [
  ["Barcodes in the unfiltered matrix", "2,743,027", "", "", "24,693,556"],
  ["Called by Parse split-pipe", "94,615", "646,385", "701,258", "1,347,643"],
  [<>Silver <Code>parse-settings</Code> · MiniFin v1, MegaFin v1</>, "94,864", "638,985", "701,533", "1,340,518"],
  [<>Silver <Code>barcode-ranks</Code> · MiniFin v2 (refused for MegaFin)</>, "94,089", "—", "—", "—"],
  [<>Silver <Code>ambient-profile</Code> · MiniFin v3, MegaFin v2</>, "106,022", "683,063", "726,511", "1,409,574"],
  ["Parse Trailmaker, after QC", "84,696", "541,670", "599,075", "1,140,745"],
  [<>Gold <Code>parse/v1</Code></>, "86,052", "553,090", "608,213", "1,161,303"],
  [<>Gold <Code>zsb</Code> · MiniFin zsb/v2, MegaFin zsb/v1</>, "90,694", "610,199", "667,017", "1,277,216"],
];

const RELEASES: React.ReactNode[][] = [
  [<Code>silver minifin/v1/</Code>, "parse-settings · raw int32 CSR", "94,864", "1,562,739,920", "2026-09-04"],
  [<Code>silver minifin/v2/</Code>, "barcode-ranks, window 1.4", "94,089", "1,559,526,002", "2026-09-04"],
  [<Code>silver minifin/v3/</Code>, "ambient-profile", "106,022", "1,583,429,276", "2026-09-06"],
  [<Code>silver megafin/v1/</Code>, "parse-settings · int64 indices", "1,340,518", "30,056,743,318", "2026-09-06"],
  [<Code>silver megafin/v2/</Code>, "ambient-profile", "1,409,574", "30,247,519,894", "2026-09-06"],
  [<Code>gold minifin/parse/v1/</Code>, "from silver v1 · 34 clusters", "86,052", "2,608,202,160", "2026-09-04"],
  [<Code>gold minifin/zsb/v2/</Code>, "from silver v1 · 31 clusters (zsb/v1 superseded)", "90,694", "2,853,902,520", "2026-09-07"],
  [<Code>gold megafin/parse/v1/</Code>, "from silver v1 · 40 clusters", "1,161,303", "32,007,400,529", "2026-09-06"],
  [<Code>gold megafin/zsb/v1/</Code>, "from silver v1 · 41 clusters", "1,277,216", "54,976,420,856", "2026-09-06"],
];

/* eslint-enable react/jsx-key */

const CONFLICTS: [string, string][] = [
  ["Fish line", "TU wild type (both dataset READMEs, the bronze annotation note) vs Tg(fli1:egfp) or Tg(kdrl:egfp) in the PRISM planning spec."],
  ["How many MegaFin drugs", "91 in the delivered sample names (authoritative) · 94 anchors in megafin_smiles.json · 48 in 12 classes in the PRISM spec · 46 per plate (one plate, as on this page)."],
  ["MegaFin controls", "DMSO 0.01% / 0.05% comes from the design doc only; sample names label DMSO by the drug dose it matches (DMSO_5uM, DMSO_1uM). The “egg water” wells are undispensed drug wells: Ibuprofen lysine (CP01 G3/H3) and Gemcitabine HCl (CP02 E7/F7) are marked “Not dispensed” on the Echo cherry-pick sheet."],
  ["Which CP01 wells are missing", "The June Trailmaker objects on this page lack B11 (Vorinostat 1 µM), C3 (Romidepsin 5 µM) and E3 (Dinaciclib 5 µM); a write-up names B7 / B9 / G10. The bronze delivery sequenced all 96 wells on both plates — the three were dropped from that Trailmaker project, not from sequencing."],
  ["MiniFin delivered count", "94,616 (earlier SO11332 export — the object this page labels) vs 94,615 (canonical summary); Sorafenib_3b is 1,717 vs 1,716."],
  ["split-pipe versions", "MiniFin v1.7.1 (SO11332 export) vs v1.8.2 (canonical re-run); MegaFin v1.8.1 (June runs) vs v1.8.2. Per-well MegaFin counts are identical between the two."],
  ["Depth target", "The PRISM spec targeted > 4,000 UMIs per cell; delivered medians are 3,117–3,198."],
];

const NOWHERE: string[] = [
  "Embryos per well in any data object — 6 is from the design docs, and pooling at arraying means per-embryo identity cannot be recovered.",
  "Stage at dosing and exposure time in any bucket or repo — the releases say only “48 hpf”.",
  "MiniFin doses in any object (design doc only).",
  "Sequencer model for either dataset, and MegaFin read lengths.",
  "A MegaFin sample sheet or well map — the layout here is derived from sample names.",
  "Dissociation and fixation protocol details, and an explicit Ensembl release for Parse's reference (99 is inferred from the 32,520-gene count).",
];

export default function WrapSheetSection() {
  const two: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 };
  return (
    <section id="wrap-sheet" style={{ background: PAPER, color: INK, padding: "34px 20px 70px", borderTop: `1px solid ${RULE}` }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6b655d", marginBottom: 4 }}>
          ▤ MiniFin &amp; MegaFin wrap sheet
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, margin: "0 0 10px", maxWidth: 720 }}>
          Everything recorded about our two Parse Evercode chemical-perturbation datasets — design, biology, perturbations,
          sequencing, cell counts, QC and releases — gathered on 2026-09-11 from the S3 buckets (bronze, silver, gold), the
          zsb-bronze / zsb-silver / zsb-gold repos and the analysis instance. The MegaFin cards above describe plate CP01
          only; this sheet covers the whole two-plate experiment.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 11.5, color: MUTED }}>
          <span><Chip c="m" /> read from the data or Parse&rsquo;s own summaries</span>
          <span><Chip c="s" /> in a design doc, in no data object</span>
          <span><Chip c="i" /> derived, written nowhere</span>
          <span><Chip c="x" /> sources disagree — see below</span>
        </div>

        <H sub="Parse figures are the split-pipe v1.8.2 canonical runs">At a glance</H>
        <Table head={["", "MiniFin · pilot", "MegaFin · production"]} rows={GLANCE.map(([k, a, b]) => [k, a, b])} />

        <H sub="the ~100k-cell pilot that validated dissociation and Evercode barcoding on whole embryos">MiniFin</H>
        <div style={two}>
          <Panel>
            <Plate rows={["A", "B", "C", "D"]} cap="Round-1 plate · 4 × 12 · from run-proc-def.json" style={miniWell} />
            <Key items={[
              { fill: INKS.dmso, label: "DMSO 0.1%" }, { fill: INKS.dapa, label: "Dapagliflozin 1 µM" },
              { fill: INKS.orli, label: "Orlistat 1 µM" }, { fill: INKS.sora, label: "Sorafenib 1 µM (pos. ctrl)" },
              { fill: INKS.dmso, ring: true, label: "sample loaded into two wells" },
            ]} />
            <div style={{ fontSize: 11.5, color: MUTED }}>Double loads, split back to <Code>{"{sample}__{well}"}</Code> in silver: Ctrl_2 A2+A6 · Dapaglifozan_2 A7+A8 · Dapaglifozan_5 A11+A12 · Orlistat_2 B2+B6 · Sorafenib_3 B9+B12.</div>
          </Panel>
          <Panel title="Design and biology">
            <Facts items={[
              ["Stage", <>dosed 24 hpf, collected 48 hpf<Chip c="s" /><Src>MiniFin README · silver minifin/v*/README.md (48 hpf)</Src></>],
              ["Embryos", <>6 per well, TU wild type, pooled before dissociation<Chip c="s" /></>],
              ["Dispensing", <>Beckman Echo 650 into an empty 48-well plate, SPARC BioCentre (SickKids)<Chip c="s" /></>],
              ["Label fixes", <><Code>Ctrl</Code> → DMSO · <Code>Dapaglifozan</Code> → Dapagliflozin</>],
              ["Sequencing", <>8 sublibraries, one lane each (SO11332) · R1 64 nt, R2 58 nt · 209.5 GiB FASTQ · instrument not recorded</>],
              ["Pipeline", "split-pipe v1.8.2 canonical re-run 2026-08-13 feeds silver; the object labelled on this page is the earlier v1.7.1 export"],
            ]} />
          </Panel>
        </div>
        <div style={{ marginTop: 14 }}>
          <Table head={["Condition", "Dose", "Wells", "Sample names", "Cells · silver v1", "Median UMIs"]} numeric={[2, 3, 4, 5]} rows={[
            ["DMSO (vehicle)", "0.1%", "12", "11", "24,876", "3,197"],
            ["Dapagliflozin", "1 µM", "12", "10", "23,137", "3,283"],
            ["Orlistat", "1 µM", "12", "11", "23,534", "3,325.5"],
            ["Sorafenib · positive control", "1 µM", "12", "11", "23,317", "2,969"],
          ]} />
        </div>
        <div style={{ ...two, marginTop: 14 }}>
          <Panel title={<>Parse&rsquo;s own summary<Chip c="m" /></>}>
            <Facts items={[
              ["Cells per sample", "1,177 / 2,119 / 3,497 (min / median / max)"],
              ["Median UMIs per sample", "1,622 / 3,190 / 4,732"],
              ["Mapping", "valid barcodes 0.757 · transcriptome 0.461 · exonic 0.638"],
              ["Cell cutoff", "670.4 transcripts · Trailmaker minCellSize 330.8–900.8"],
            ]} />
          </Panel>
          <Panel title="Traps">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 6, listStyleType: "disc" }}>
              <li>The two exports number sublibraries differently — joining on cell id silently keeps ~3%.</li>
              <li><Code>combined/all-sample/</Code> is the run aggregate, not a 44th sample.</li>
              <li>Group QC on <Code>replicate</Code> (48 wells), not <Code>parse_sample</Code> (43 names).</li>
            </ul>
          </Panel>
        </div>

        <H sub="the production run — one experiment on two Evercode WT Mega plates">MegaFin</H>
        <div style={two}>
          <Panel><Plate rows={["A", "B", "C", "D", "E", "F", "G", "H"]} cap="CP01 · bronze megafin-1/ · run 2026-08-26 · “Part 1” on this page" style={megaWell(new Set(["G3", "H3"]))} /></Panel>
          <Panel><Plate rows={["A", "B", "C", "D", "E", "F", "G", "H"]} cap="CP02 · bronze megafin-2/ · run 2026-08-16" style={megaWell(new Set(["E7", "F7"]))} /></Panel>
        </div>
        <div style={{ marginTop: 8 }}>
          <Key items={[
            { fill: INKS.d5, label: "test drug, 5 µM (rows A C E G)" }, { fill: INKS.d1, label: "test drug, 1 µM (rows B D F H)" },
            { fill: INKS.dmso, label: "DMSO, dose-matched (A1, B1)" }, { hatched: true, label: "no vehicle — planned drug never dispensed" },
          ]} />
        </div>
        <div style={{ ...two, marginTop: 14 }}>
          <Panel title="Design and perturbations">
            <Facts items={[
              ["Drugs", <>91 — 45 test drugs per plate plus Sorafenib on both<Chip c="m" /><Src>192 sample names · bronze megafin-{"{1,2}"}/…/agg_sample_summary.csv</Src></>],
              ["Replicates", <><b>none</b> — one well per drug × dose; Sorafenib and DMSO 2 wells per dose, one per plate</>],
              ["No-vehicle wells", <>CP01 G3/H3, CP02 E7/F7: Ibuprofen lysine and Gemcitabine HCl planned, never dispensed<Chip c="m" /><Src>Zeroshot_ABFDA_Echo_Cherry-Picking.xlsx</Src></>],
              ["Echo volumes", <>100 nL and 20 nL — likely the 5 µM / 1 µM pair<Chip c="i" /></>],
              ["Stage, embryos", <>24 → 48 hpf · 6 per well · TU wild type<Chip c="s" /></>],
            ]} />
          </Panel>
          <Panel title="Traps">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "grid", gap: 6, listStyleType: "disc" }}>
              <li>Barcodes collide across plates — cell ids are <Code>CP0x:barcode</Code>.</li>
              <li>Each drug sits on one plate, so plate (the batch) is nested with drug.</li>
              <li>No drug has a replicate well: each effect rests on one well of ~6 pooled embryos.</li>
              <li>Both MegaFin atlases on this page are CP01 only (93 wells). Two-plate data exists only in the S3 releases.</li>
            </ul>
          </Panel>
        </div>
        <div style={{ marginTop: 14 }}>
          <Table head={["Parse summary", "CP01", "CP02"]} numeric={[1, 2]} rows={[
            ["Reads", "27,094,039,771", "24,540,854,741"],
            ["Cells", "646,385", "701,258"],
            ["Median UMIs / genes per cell", "3,143 / 1,552", "3,117 / 1,491"],
            ["Mean reads per cell · saturation", "41,916 · 0.570", "34,995 · 0.615"],
            ["Cells per well (min / median / max)", "496 / 6,786.5 / 19,620", "442 / 7,640.5 / 15,174"],
            ["Lowest-yield wells", "Erismodegib 1 µM · Ramipril 5 µM · H3", "Sorafenib 1 µM · DMSO 5 µM"],
          ]} />
        </div>

        <H sub="from raw barcodes to the gold artifacts">Cells, stage by stage</H>
        <Table head={["Stage", "MiniFin", "MegaFin CP01", "MegaFin CP02", "MegaFin total"]} numeric={[1, 2, 3, 4]} rows={STAGES} />

        <H sub="s3://zsb-silver-warehouse (raw counts) · s3://zsb-gold-library (analysis-ready)">Releases</H>
        <Table head={["Key", "What it is", "Cells", "Bytes", "Published"]} numeric={[2, 3, 4]} rows={RELEASES} />
        <div style={{ ...two, marginTop: 14 }}>
          <Panel title="Gold recipe · parse">
            <Facts items={[
              ["Mito", "MAD, n = 3, 0.5-point floor"],
              ["Doublets", "scDblFinder 1.24.0 · rate 0.034 (WT) / 0.064 (Mega)"],
              ["Integration", "1e4 · 2,000 HVG · 30 PCs · Harmony on replicate (MiniFin) or plate (MegaFin) · Leiden 0.8"],
            ]} />
          </Panel>
          <Panel title="Gold recipe · zsb">
            <Facts items={[["Mito", "fixed 2% cap"], ["Doublets", "rate 0.01"], ["Otherwise", "as parse"]]} />
          </Panel>
        </div>
        <div style={{ marginTop: 14, borderLeft: "3px solid #d97706", background: "#fef7e6", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 12.5 }}>
          <b>The mito gotcha.</b> Parse&rsquo;s gene table carries only the 13 protein-coding mitochondrial genes, so its <Code>percent.mt</Code> reads ~0.14–0.19%.
          The whole MT contig gives 8–9% (Parse reports 8.16% for MegaFin). Literature mito thresholds (5–30%) are meaningless on the delivered objects.
        </div>

        <H sub="resolve before citing any of these">Where the sources disagree</H>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 12.5, listStyleType: "decimal" }}>
          {CONFLICTS.map(([k, v]) => <li key={k}><b>{k}.</b> {v}</li>)}
        </ol>

        <H sub="looked for in all three buckets, four repos and the instance">Recorded nowhere</H>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 12.5, listStyleType: "disc" }}>
          {NOWHERE.map((t) => <li key={t}>{t}</li>)}
        </ul>

        <p style={{ marginTop: 26, paddingTop: 10, borderTop: `1px solid ${RULE}`, fontSize: 11, color: FAINT, lineHeight: 1.5 }}>
          Sources — S3: zsb-bronze-fortknox/{"{minifin,megafin-1,megafin-2}"}/ (agg_sample_summary.csv, settings.txt, split-pipe logs,
          run-proc-def.json) · zsb-silver-warehouse and zsb-gold-library READMEs, CHANGELOGs and h5ad .uns / obs. Repos: zsb-bronze
          (minifin/, megafin/, parse/), zsb-silver (recipes, docs/trailmaker-fidelity*.md), zsb-gold. Instance: dataset READMEs under
          /data/datasets/zebrafish/, the Echo cherry-pick sheet, per-well tables in /data/scratch/wrapsheet/. Compiled 2026-09-11.
        </p>
      </div>
    </section>
  );
}
