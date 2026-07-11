"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { CategoryDetail, JudgeNode, MiniNode, Tier } from "../details";

const PAPER = "#f6f4f2", INK = "#2b2b2b", MUTE = "#8a847b", LINE = "#e7e1d9", CARD = "#fffdfb";
const TIER_ORDER = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
const TIER_LABEL: Record<string, string> = { germ_layer: "Germ layer", tissue: "Tissue", cell_type_broad: "Cell type · broad", cell_type_sub: "Cell type · sub" };

function heat(pct: number | null): { bg: string; fg: string } {
  if (pct == null) return { bg: "#ece8e2", fg: "#b7b0a6" };
  const p = Math.max(0, Math.min(100, pct));
  const h = (p / 100) * 130;
  return { bg: `hsl(${h} 68% 90%)`, fg: `hsl(${h} 60% 26%)` };
}

// the tissue tier is what the summary's correct-call rate is scored on (falls back to broad)
const scoredMatch = (n: JudgeNode): boolean | null => n.dn?.tissue?.m ?? n.dn?.cell_type_broad?.m ?? null;

function Verdict({ t }: { t?: Tier }) {
  if (!t) return <span style={{ color: "#c4bdb1" }}>—</span>;
  const ok = t.m;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
      <span style={{ fontWeight: 800, fontSize: 12, color: ok ? "#15803d" : "#b91c1c", flexShrink: 0 }}>{ok ? "✓ match" : "✗ miss"}</span>
      {t.note && <span style={{ fontSize: 12, color: "#5a544c", lineHeight: 1.4, fontStyle: "italic" }}>“{t.note}”</span>}
    </div>
  );
}

function GtChip({ v }: { v: string | null }) {
  if (!v) return <span style={{ color: "#c4bdb1" }}>—</span>;
  return <span style={{ fontWeight: 600, color: INK }}>{v}</span>;
}

function JudgeCard({ n }: { n: JudgeNode }) {
  const sm = scoredMatch(n);
  return (
    <div style={{ border: `1px solid ${LINE}`, borderLeft: `4px solid ${sm == null ? "#d8d3cd" : sm ? "#22c55e" : "#ef4444"}`, borderRadius: 10, background: CARD, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "ui-monospace, monospace", color: "#0e7490" }}>{n.id}</span>
        {n.kind && <span style={{ fontSize: 11, color: MUTE }}>{n.kind}{n.leaves ? ` · ${n.leaves} leaves` : ""}</span>}
        {n.purity != null && <span style={{ fontSize: 11, color: MUTE }}>purity {Number(n.purity).toFixed(2)}</span>}
        {n.ssmp != null && <span style={{ fontSize: 11, color: MUTE }}>ssmp {Number(n.ssmp).toFixed(2)}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: "#3f3a34", marginBottom: 10, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 700, color: MUTE, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>Wizard de-novo call</span><br />
        {n.identity || <span style={{ color: MUTE }}>—</span>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620, fontSize: 12.5 }}>
          <thead>
            <tr>
              {["Tier", "Ground truth", "De-novo verdict", "Menu pred", "Menu-exposed verdict"].map((h, i) => (
                <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: MUTE, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", opacity: i >= 3 ? 0.75 : 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.filter((t) => n.gt[t] || n.dn[t] || n.menu[t]).map((t) => {
              const scored = t === "tissue";
              return (
                <tr key={t} style={{ background: scored ? "#f5fbff" : "transparent" }}>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", fontWeight: 700, color: "#4a453f" }}>
                    {TIER_LABEL[t]}{scored && <span title="This tier drives the summary's correct-call rate" style={{ marginLeft: 5, fontSize: 8.5, fontWeight: 800, color: "#0e7490", background: "#e0f2f7", borderRadius: 99, padding: "1px 5px", letterSpacing: 0.3 }}>SCORED</span>}
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}` }}><GtChip v={n.gt[t]} /></td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}` }}><Verdict t={n.dn[t]} /></td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}`, color: "#6b655d" }}><GtChip v={n.menu[t]} /></td>
                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}`, opacity: 0.82 }}><Verdict t={n.mx[t]} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniTable({ nodes }: { nodes: MiniNode[] }) {
  const th: CSSProperties = { textAlign: "left", padding: "7px 9px", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: MUTE, borderBottom: `2px solid ${LINE}`, whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: "8px 9px", borderBottom: `1px solid ${LINE}`, fontSize: 12.5, verticalAlign: "top" };
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 10, background: CARD }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
        <thead><tr>
          <th style={th}>Leaf</th><th style={th}>GT term</th><th style={{ ...th, width: "38%" }}>Wizard call</th>
          <th style={th}>Bucket</th><th style={th} title="Lenient match (drives the score)">Lenient</th><th style={th}>Strict</th><th style={th}>Purity</th><th style={{ ...th, textAlign: "right" }}>Cells</th>
        </tr></thead>
        <tbody>
          {nodes.map((n) => {
            const lh = heat(Math.round((n.lenient ?? 0) * 100)), sh = heat(Math.round((n.strict ?? 0) * 100));
            const bucketCol = n.category === "in_ontology" ? "#15803d" : n.category === "abstain" ? "#a16207" : "#b91c1c";
            return (
              <tr key={n.id}>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace", color: "#0e7490", fontWeight: 700 }}>{n.id}</td>
                <td style={{ ...td, fontWeight: 700, color: INK }}>{n.term}{n.dom_finest && n.dom_finest !== n.term ? <div style={{ fontSize: 10.5, color: MUTE, fontWeight: 400 }}>dom: {n.dom_finest}</div> : null}</td>
                <td style={{ ...td, color: "#3f3a34" }}>{n.call}</td>
                <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: bucketCol }}>{n.category}</span>{n.soft ? <div style={{ fontSize: 9.5, color: MUTE }}>soft</div> : null}</td>
                <td style={td}><span style={{ padding: "2px 7px", borderRadius: 6, background: lh.bg, color: lh.fg, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{(n.lenient ?? 0).toFixed(2)}</span></td>
                <td style={td}><span style={{ padding: "2px 7px", borderRadius: 6, background: sh.bg, color: sh.fg, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(n.strict ?? 0).toFixed(2)}</span></td>
                <td style={{ ...td, color: MUTE, fontVariantNumeric: "tabular-nums" }}>{n.purity != null ? Number(n.purity).toFixed(2) : "—"}</td>
                <td style={{ ...td, textAlign: "right", color: MUTE, fontVariantNumeric: "tabular-nums" }}>{n.nCells ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CategoryAuditClient({ detail }: { detail: CategoryDetail }) {
  const { category, byDataset } = detail;
  const fuzzyDs = (["ZSCAPE", "ChemFish", "DanioCell"] as const).filter((d) => byDataset[d].length);
  const mf = byDataset.MiniFin;

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 1000, width: "100%", padding: "48px 24px 72px" }}>

        <Link href="/cell_labelling_hierarchy" style={{ fontSize: 13, color: "#0e7490", textDecoration: "none", fontWeight: 600 }}>← Cell-Labelling Hierarchy</Link>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: MUTE, fontWeight: 700, marginTop: 18 }}>Fuzzy-judge audit</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "6px 0 10px", lineHeight: 1.12 }}>{category}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "#5a544c", maxWidth: 780, margin: "0 0 8px" }}>
          Every ground-truth node whose GT label falls in this category, with the judge&apos;s per-tier verdict and its written
          justification. The <b>de-novo</b> column judges the wizard&apos;s free-text call; the muted <b>menu-exposed</b> column
          judges its answer when handed the GT menu. The <b>Tissue</b> row (marked <b>SCORED</b>) is what the summary&apos;s
          correct-call rate is computed from — read the note and decide for yourself whether each match is legitimate.
        </p>

        {fuzzyDs.map((d) => {
          const nodes = byDataset[d];
          const matched = nodes.filter((n) => scoredMatch(n) === true).length;
          return (
            <section key={d} style={{ marginTop: 30 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, borderBottom: `2px solid ${LINE}`, paddingBottom: 6, marginBottom: 14 }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{d}</h2>
                <span style={{ fontSize: 12.5, color: MUTE }}>{nodes.length} judged node{nodes.length === 1 ? "" : "s"} · {matched}/{nodes.length} matched at the tissue tier (de-novo) · fuzzy LLM judge</span>
              </div>
              {nodes.map((n) => <JudgeCard key={n.id} n={n} />)}
            </section>
          );
        })}

        {mf.length > 0 && (
          <section style={{ marginTop: 34 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, borderBottom: `2px solid ${LINE}`, paddingBottom: 6, marginBottom: 6 }}>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>MiniFin</h2>
              <span style={{ fontSize: 12.5, color: MUTE }}>{mf.length} GT-covered leaves · expert-GT crosswalk (Patrick)</span>
            </div>
            <p style={{ fontSize: 12, color: "#6b655d", margin: "0 0 12px", lineHeight: 1.5, maxWidth: 760 }}>
              MiniFin is <em>not</em> scored by the fuzzy judge — it&apos;s a 4-bucket crosswalk against Patrick&apos;s expert answer key, so there are no per-tier notes. <b>Lenient</b> is the cell-weighted match that feeds the summary; <b>strict</b> demands exact sub-type; <b>bucket</b> is whether the call landed in-ontology, off-ontology, or abstained.
            </p>
            <MiniTable nodes={mf} />
          </section>
        )}
      </div>
    </div>
  );
}
