"use client";

import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { DATA, catSlug, type Row, type PerDs } from "./data";

// ── design tokens ────────────────────────────────────────────────────────────
const PAPER = "#f6f4f2", INK = "#2b2b2b", MUTE = "#8a847b", LINE = "#e7e1d9", CARD = "#fffdfb";
const DS_ORDER = ["ZSCAPE", "ChemFish", "DanioCell", "MiniFin"] as const;
const DS_LETTER: Record<string, string> = { ZSCAPE: "Z", ChemFish: "C", DanioCell: "D", MiniFin: "M" };

// red → amber → green heat for a 0-100 score; every use also prints the number (never colour-only).
function heat(pct: number | null): { bg: string; fg: string } {
  if (pct == null) return { bg: "#ece8e2", fg: "#b7b0a6" };
  const p = Math.max(0, Math.min(100, pct));
  const h = (p / 100) * 130; // 0 = red, 130 = green
  return { bg: `hsl(${h} 68% 90%)`, fg: `hsl(${h} 60% 26%)` };
}

const TIERS: Record<string, { label: string; blurb: string; color: string; bg: string }> = {
  S: { label: "Annotate anywhere", blurb: "Correct and high-purity in all four datasets — safe to trust the wizard's call.", color: "#15803d", bg: "#f0fdf4" },
  A: { label: "Reliable", blurb: "Strong across three or more datasets; occasional sub-type slips.", color: "#0e7490", bg: "#ecfeff" },
  B: { label: "Context-dependent", blurb: "Right roughly half to two-thirds of the time — worth a human glance.", color: "#a16207", bg: "#fef9c3" },
  C: { label: "Hard / inconsistent", blurb: "Frequently mislabelled or low-purity somewhere — needs an expert.", color: "#b91c1c", bg: "#fef2f2" },
};

function Bar({ pct, label }: { pct: number | null; label: string }) {
  const { bg, fg } = heat(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 108 }}>
      <div style={{ position: "relative", flex: 1, height: 8, background: "#efeae3", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct ?? 0}%`, background: fg, opacity: 0.55, borderRadius: 99 }} />
      </div>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 12.5, color: fg, minWidth: 34, textAlign: "right" }}>{label}</span>
    </div>
  );
}

function DsDots({ row }: { row: Row }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {DS_ORDER.map((d) => {
        const v: PerDs = row.perDataset[d];
        const { bg, fg } = heat(v ? v.acc : null);
        const tip = v
          ? `${d} — ${v.n} node${v.n === 1 ? "" : "s"} · ${v.acc}% correct · purity ${v.pur ?? "—"}`
          : `${d} — this category not present in the ground truth`;
        return (
          <span key={d} title={tip}
            style={{ width: 20, height: 20, borderRadius: 5, background: bg, color: v ? fg : "#c4bdb1",
              border: `1px solid ${v ? "transparent" : "#e2ddd5"}`, fontSize: 10.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "help", fontVariantNumeric: "tabular-nums" }}>
            {DS_LETTER[d]}
          </span>
        );
      })}
    </div>
  );
}

function RowCells({ row }: { row: Row }) {
  const eh = heat(row.ease);
  return (
    <>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`/cell_labelling_hierarchy/${catSlug(row.category)}`} title="Audit the individual judge calls behind this category" style={{ color: "#0e7490", textDecoration: "none", borderBottom: "1px solid #bfe3ea" }}>
            {row.category}
          </Link>
          {row.thin && <span title="Thin evidence — fewer than 4 judged nodes total" style={{ fontSize: 9.5, fontWeight: 700, color: "#92600a", background: "#fdf0d0", borderRadius: 99, padding: "1px 6px", letterSpacing: 0.3 }}>THIN</span>}
        </div>
        {row.examples.length > 0 && (
          <div style={{ fontSize: 11, color: MUTE, marginTop: 3, lineHeight: 1.35 }}>
            e.g. {row.examples.slice(0, 4).join(" · ")}
          </div>
        )}
      </td>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}`, textAlign: "center" }}>
        <span title="Ease index — correct-call rate blended with cluster purity" style={{ display: "inline-block", minWidth: 40, padding: "4px 9px", borderRadius: 8, background: eh.bg, color: eh.fg, fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{row.ease}</span>
      </td>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}><Bar pct={row.accuracy} label={`${row.accuracy}%`} /></td>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}><Bar pct={Math.round(row.purity * 100)} label={row.purity.toFixed(2)} /></td>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}><DsDots row={row} /></td>
      <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTE, fontSize: 12.5 }}>{row.n}</td>
    </>
  );
}

const TH: CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: MUTE, borderBottom: `2px solid ${LINE}`, whiteSpace: "nowrap" };

export default function CellLabellingHierarchyClient() {
  const { main, aside, meta } = DATA;
  const tiersPresent = ["S", "A", "B", "C"].filter((t) => main.some((r) => r.tier === t));
  const nEasy = main.filter((r) => r.tier === "S" || r.tier === "A").length;

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 1080, width: "100%", padding: "64px 24px 72px" }}>

        {/* header */}
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#0e7490", fontWeight: 700 }}>daniotype · internal preview</div>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: "10px 0 8px", lineHeight: 1.1 }}>Cell-Labelling Hierarchy</h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "#5a544c", maxWidth: 760, margin: "0 0 20px" }}>
          Which cell &amp; tissue types the labelling wizard nails <strong>correctly and with high confidence</strong> — ranked by
          how <strong>consistently</strong> they score well across every ground-truth dataset. Each biological category pools the
          judged nodes whose ground truth falls in it; a category rises when the wizard gets it right in <em>every</em> dataset it appears in.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "#0e7490", fontWeight: 600, margin: "0 0 20px" }}>
          → Click any cell / tissue type to hand-audit the individual fuzzy-judge calls behind it, per dataset.
        </p>

        {/* stat strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 26 }}>
          <Stat big={String(meta.totalNodes)} small="GT-judged nodes" />
          <Stat big={String(main.length + aside.length)} small="cross-dataset categories" />
          <Stat big={`${nEasy}`} small="rated “easy” (tier S/A)" />
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {DS_ORDER.map((d) => (
              <span key={d} style={{ fontSize: 12, fontWeight: 600, color: "#4a453f", background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px" }}>
                <b style={{ color: "#0e7490" }}>{DS_LETTER[d]}</b>&nbsp; {d} · {meta.datasets[d]}
              </span>
            ))}
          </div>
        </div>

        {/* tier legend */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginBottom: 20 }}>
          {(["S", "A", "B", "C"] as const).map((t) => (
            <div key={t} style={{ background: TIERS[t].bg, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: TIERS[t].color }}>Tier {t} — {TIERS[t].label}</div>
              <div style={{ fontSize: 11, color: "#6b655d", lineHeight: 1.35, marginTop: 2 }}>{TIERS[t].blurb}</div>
            </div>
          ))}
        </div>

        {/* main table */}
        <div style={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 12, background: CARD }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: "34%" }}>Cell / tissue type</th>
                <th style={{ ...TH, textAlign: "center" }} title="Correct-call rate blended with purity">Ease</th>
                <th style={TH}>Correct-call rate</th>
                <th style={TH} title="Mean cluster purity — how clean the underlying signal is">Purity</th>
                <th style={TH}>Consistency (Z·C·D·M)</th>
                <th style={{ ...TH, textAlign: "right" }}>Nodes</th>
              </tr>
            </thead>
            <tbody>
              {tiersPresent.map((t) => (
                <Fragment key={t}>
                  <tr>
                    <td colSpan={6} style={{ padding: "8px 12px", background: TIERS[t].bg, borderBottom: `1px solid ${LINE}`, borderTop: `1px solid ${LINE}` }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, color: TIERS[t].color, textTransform: "uppercase" }}>Tier {t} · {TIERS[t].label}</span>
                    </td>
                  </tr>
                  {main.filter((r) => r.tier === t).map((r) => (
                    <tr key={r.category}><RowCells row={r} /></tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* aside: single-dataset */}
        {aside.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#6b655d", marginBottom: 6 }}>Seen in only one dataset — can’t judge consistency</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {aside.map((r) => {
                const d = DS_ORDER.find((x) => r.perDataset[x]);
                return (
                  <Link key={r.category} href={`/cell_labelling_hierarchy/${catSlug(r.category)}`} style={{ fontSize: 12, color: "#0e7490", background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", textDecoration: "none" }}>
                    {r.category} <span style={{ color: MUTE }}>· {d} only · {r.accuracy}% · n={r.n}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* methodology */}
        <div style={{ marginTop: 30, fontSize: 12, color: "#6b655d", lineHeight: 1.6, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
          <div style={{ fontWeight: 800, color: "#4a453f", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10.5 }}>How this is computed</div>
          Pooled from the four golden runs’ ground-truth scorecards — ZSCAPE (fuzzy LLM judge vs Classic GT), ChemFish &amp; DanioCell
          (fuzzy judge vs sealed GT), and MiniFin (Patrick expert-GT, the GT-covered leaves only). Every judged node is bucketed by its
          <em> ground-truth</em> label into a shared canonical vocabulary. <b>Correct-call rate</b> = fraction of nodes whose de-novo call
          matched GT at the tissue tier (MiniFin uses lenient ≥ 0.5). <b>Purity</b> = mean cluster purity, our proxy for how clean the
          signal is. <b>Ease</b> = 0.65·accuracy + 0.35·purity. Tiers additionally require breadth of coverage. Cross-dataset naming was
          normalized by hand, so treat small-n (“thin”) rows as indicative only. MegaFin is excluded — it has no promoted ground truth.
        </div>
      </div>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 14px", minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{big}</div>
      <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>{small}</div>
    </div>
  );
}
