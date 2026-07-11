"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { CategoryDetail, JudgeNode, MiniNode, Tier } from "../details";

const PAPER = "#f6f4f2", INK = "#2b2b2b", MUTE = "#8a847b", LINE = "#e7e1d9", CARD = "#fffdfb";
const TIER_ORDER = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"] as const;
const TIER_LABEL: Record<string, string> = { germ_layer: "Germ layer", tissue: "Tissue", cell_type_broad: "Cell type · broad", cell_type_sub: "Cell type · sub" };
const TIER_SHORT: Record<string, string> = { germ_layer: "germ layer", tissue: "tissue", cell_type_broad: "broad cell type", cell_type_sub: "cell-type sub" };
const TISSUE_BG = "#f2fafd";

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
    <div>
      <div style={{ fontWeight: 800, fontSize: 11.5, color: ok ? "#15803d" : "#b91c1c" }}>{ok ? "✓ match" : "✗ miss"}</div>
      {t.note && <div style={{ fontSize: 11.5, color: "#5a544c", lineHeight: 1.4, fontStyle: "italic", marginTop: 2 }}>“{t.note}”</div>}
    </div>
  );
}

function ConfBadge({ c }: { c?: number | null }) {
  if (c == null) return null;
  const h = heat(c);
  return <span style={{ marginLeft: 4, fontSize: 9.5, fontWeight: 800, color: h.fg, background: h.bg, borderRadius: 99, padding: "0 5px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c}%</span>;
}

// ── one node, transposed: rows are the info layers, columns are the ontology tiers ──
function JudgeCard({ n }: { n: JudgeNode }) {
  const [membersOpen, setMembersOpen] = useState(false);
  const sm = scoredMatch(n);
  const tiers = TIER_ORDER.filter((t) => n.gt[t] || n.menu[t] || n.dn[t] || n.mx[t] || n.dnPred?.[t]);
  const rowHdr: CSSProperties = { textAlign: "left", padding: "7px 10px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap", verticalAlign: "top", borderBottom: `1px solid ${LINE}` };
  const cell: CSSProperties = { padding: "7px 10px", borderBottom: `1px solid ${LINE}`, borderLeft: `1px solid ${LINE}`, fontSize: 12.5, verticalAlign: "top", lineHeight: 1.4 };
  const kindCol = n.kind === "merge" ? { c: "#0e7490", bg: "#e0f2f7", t: "MERGED" } : { c: "#a16207", bg: "#fdf3d6", t: "REBEL LEAF" };
  const hasPred = !!n.dnPred && tiers.some((t) => n.dnPred?.[t]?.val);
  return (
    <div style={{ border: `1px solid ${LINE}`, borderLeft: `4px solid ${sm == null ? "#d8d3cd" : sm ? "#22c55e" : "#ef4444"}`, borderRadius: 10, background: CARD, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 13, fontFamily: "ui-monospace, monospace", color: "#0e7490" }}>{n.id}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: kindCol.c, background: kindCol.bg, borderRadius: 99, padding: "1px 7px", letterSpacing: 0.4 }}>{kindCol.t}{n.leaves ? ` · ${n.leaves} ${n.leaves === 1 ? "leaf" : "leaves"}` : ""}</span>
        {n.purity != null && <span style={{ fontSize: 11, color: MUTE }}>purity {Number(n.purity).toFixed(2)}</span>}
        {n.ssmp != null && <span style={{ fontSize: 11, color: MUTE }}>ssmp {Number(n.ssmp).toFixed(2)}</span>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 132 }} />{tiers.map((t) => <col key={t} />)}</colgroup>
          <thead>
            <tr>
              <th style={{ ...rowHdr, color: MUTE, background: "#faf8f5" }} />
              {tiers.map((t) => (
                <th key={t} style={{ ...rowHdr, background: t === "tissue" ? TISSUE_BG : "#faf8f5", color: "#4a453f", borderLeft: `1px solid ${LINE}` }}>
                  {TIER_LABEL[t]}{t === "tissue" && <span title="Drives the summary's correct-call rate" style={{ marginLeft: 4, fontSize: 8, fontWeight: 800, color: "#0e7490", background: "#d3ebf2", borderRadius: 99, padding: "1px 4px" }}>SCORED</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 1 · ground truth */}
            <tr>
              <th style={{ ...rowHdr, color: "#3f3a34", background: "#f1ede6" }}>Ground truth</th>
              {tiers.map((t) => <td key={t} style={{ ...cell, background: t === "tissue" ? TISSUE_BG : undefined, fontWeight: 700, color: n.gt[t] ? INK : "#c4bdb1" }}>{n.gt[t] || "—"}</td>)}
            </tr>
            {/* 2 · de-novo prediction — the wizard's full 4-tier free-form call (val + confidence),
                 recovered from a representative member leaf's transcript. Falls back to the consolidated
                 identity phrase where the 4-tier couldn't be parsed. */}
            <tr>
              <th style={{ ...rowHdr, color: "#0e7490", background: "#ecfeff" }}>De-novo pred</th>
              {hasPred
                ? tiers.map((t) => {
                    const p = n.dnPred?.[t];
                    return <td key={t} style={{ ...cell, background: t === "tissue" ? "#eefaff" : "#f6feff", fontWeight: 600, color: p?.val ? "#134e5a" : "#c4bdb1" }}>{p?.val ? <>{p.val}<ConfBadge c={p.conf} /></> : "—"}</td>;
                  })
                : <td colSpan={tiers.length} style={{ ...cell, background: "#f6feff", color: "#134e5a", fontWeight: 600 }}>{n.identity || "—"}<span style={{ display: "block", fontWeight: 400, fontStyle: "italic", color: "#6b8990", marginTop: 3, fontSize: 11 }}>4-tier de-novo not parseable for this node — showing the consolidated call{n.dnTier ? `, resolved to ${TIER_SHORT[n.dnTier] || n.dnTier}` : ""}</span></td>}
            </tr>
            {/* caption: consolidated identity + source leaf */}
            <tr>
              <td colSpan={tiers.length + 1} style={{ padding: "5px 10px", borderBottom: `1px solid ${LINE}`, background: "#f9fdff", fontSize: 11, color: "#6b8990", fontStyle: "italic" }}>
                consolidated de-novo identity: <b style={{ color: "#134e5a", fontStyle: "normal" }}>{n.identity || "—"}</b>{n.dnTier ? ` · resolved to ${TIER_SHORT[n.dnTier] || n.dnTier}` : ""}{hasPred && n.dnPredLeaf ? ` · 4-tier shown from representative leaf ${n.dnPredLeaf}${n.members && n.members.length ? ` of ${n.members.length}` : ""}` : ""}
              </td>
            </tr>
            {/* 3 · de-novo verdict */}
            <tr>
              <th style={{ ...rowHdr, color: "#0e7490", background: "#ecfeff" }}>De-novo verdict</th>
              {tiers.map((t) => <td key={t} style={{ ...cell, background: t === "tissue" ? TISSUE_BG : undefined }}><Verdict t={n.dn[t]} /></td>)}
            </tr>
            {/* 4 · menu-exposed prediction (with the representative leaf's confidence) */}
            <tr>
              <th style={{ ...rowHdr, color: "#6b655d", background: "#f4f2ee" }}>Menu pred</th>
              {tiers.map((t) => <td key={t} style={{ ...cell, background: t === "tissue" ? TISSUE_BG : undefined, color: n.menu[t] ? "#4a453f" : "#c4bdb1", fontWeight: n.menu[t] ? 600 : 400 }}>{n.menu[t] || "—"}{n.menu[t] && <ConfBadge c={n.menuRep?.[t]?.conf} />}</td>)}
            </tr>
            {/* 5 · menu-exposed verdict */}
            <tr>
              <th style={{ ...rowHdr, color: "#6b655d", background: "#f4f2ee" }}>Menu-exposed verdict</th>
              {tiers.map((t) => <td key={t} style={{ ...cell, background: t === "tissue" ? TISSUE_BG : undefined, opacity: 0.85 }}><Verdict t={n.mx[t]} /></td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {/* merges: audit every member leaf's own 4-tier de-novo call */}
      {n.members && n.members.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setMembersOpen((o) => !o)} style={{ background: membersOpen ? "#eef2f6" : "#fff", border: `1px solid ${LINE}`, borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "#0e7490", cursor: "pointer" }}>
            {membersOpen ? "▾ Hide" : "▸ Show"} all {n.members.length} member-leaf de-novo calls
          </button>
          {membersOpen && (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, fontSize: 11.5 }}>
                <thead><tr>
                  <th style={{ ...rowHdr, fontSize: 9.5, background: "#faf8f5", color: MUTE }}>Leaf</th>
                  {tiers.map((t) => <th key={t} style={{ ...rowHdr, fontSize: 9.5, background: t === "tissue" ? TISSUE_BG : "#faf8f5", color: "#4a453f", borderLeft: `1px solid ${LINE}` }}>{TIER_LABEL[t]}</th>)}
                </tr></thead>
                <tbody>
                  {n.members.map((m) => (
                    <tr key={m.id} style={{ background: m.id === n.dnPredLeaf ? "#f2fafd" : undefined }}>
                      <td style={{ ...cell, fontFamily: "ui-monospace, monospace", color: "#0e7490", fontWeight: 700 }}>{m.id}{m.id === n.dnPredLeaf ? " ★" : ""}</td>
                      {tiers.map((t) => <td key={t} style={{ ...cell, color: m.dn?.[t]?.val ? "#134e5a" : "#c4bdb1" }}>{m.dn?.[t]?.val ? <>{m.dn[t].val}<ConfBadge c={m.dn[t].conf} /></> : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DatasetSection({ ds, nodes }: { ds: string; nodes: JudgeNode[] }) {
  const [open, setOpen] = useState(false);
  const merges = nodes.filter((n) => n.kind === "merge");
  const rebels = nodes.filter((n) => n.kind !== "merge");
  const primary = merges.length ? merges : rebels;
  const extra = merges.length ? rebels : [];
  const matched = nodes.filter((n) => scoredMatch(n) === true).length;
  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, borderBottom: `2px solid ${LINE}`, paddingBottom: 6, marginBottom: 14 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{ds}</h2>
        <span style={{ fontSize: 12.5, color: MUTE }}>
          {matched}/{nodes.length} matched at the tissue tier (de-novo) · fuzzy LLM judge
          {merges.length ? ` · ${merges.length} merged node${merges.length === 1 ? "" : "s"} shown` : " · no merges — showing leaves"}
          {extra.length ? ` · ${extra.length} rebel ${extra.length === 1 ? "leaf" : "leaves"} collapsed` : ""}
        </span>
      </div>
      {primary.map((n) => <JudgeCard key={n.id} n={n} />)}
      {extra.length > 0 && (
        <div>
          <button onClick={() => setOpen((o) => !o)} style={{ background: open ? "#eef2f6" : "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, color: "#0e7490", cursor: "pointer" }}>
            {open ? "▾ Hide" : "▸ Show"} {extra.length} individual rebel {extra.length === 1 ? "leaf" : "leaves"} (not folded into a merge)
          </button>
          {open && <div style={{ marginTop: 12 }}>{extra.map((n) => <JudgeCard key={n.id} n={n} />)}</div>}
        </div>
      )}
    </section>
  );
}

function MiniSection({ nodes }: { nodes: MiniNode[] }) {
  const sorted = [...nodes].sort((a, b) => (b.nCells ?? 0) - (a.nCells ?? 0));
  const CAP = 12;
  const [open, setOpen] = useState(false);
  const shown = open ? sorted : sorted.slice(0, CAP);
  const hidden = sorted.length - shown.length;
  const th: CSSProperties = { textAlign: "left", padding: "7px 9px", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: MUTE, borderBottom: `2px solid ${LINE}`, whiteSpace: "nowrap" };
  const td: CSSProperties = { padding: "8px 9px", borderBottom: `1px solid ${LINE}`, fontSize: 12.5, verticalAlign: "top" };
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, borderBottom: `2px solid ${LINE}`, paddingBottom: 6, marginBottom: 6 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>MiniFin</h2>
        <span style={{ fontSize: 12.5, color: MUTE }}>{nodes.length} GT-covered leaves · expert-GT crosswalk (Patrick)</span>
      </div>
      <p style={{ fontSize: 12, color: "#6b655d", margin: "0 0 12px", lineHeight: 1.5, maxWidth: 760 }}>
        MiniFin is <em>not</em> scored by the fuzzy judge — it&apos;s a 4-bucket crosswalk against Patrick&apos;s expert answer key (leaf-level, no merges), so there are no per-tier notes. <b>Lenient</b> is the cell-weighted match that feeds the summary; <b>strict</b> demands exact sub-type; <b>bucket</b> is whether the call landed in-ontology, off-ontology, or abstained.
      </p>
      <div style={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 10, background: CARD }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead><tr>
            <th style={th}>Leaf</th><th style={th}>GT term</th><th style={{ ...th, width: "38%" }}>Wizard call</th>
            <th style={th}>Bucket</th><th style={th} title="Lenient match (drives the score)">Lenient</th><th style={th}>Strict</th><th style={th}>Purity</th><th style={{ ...th, textAlign: "right" }}>Cells</th>
          </tr></thead>
          <tbody>
            {shown.map((n) => {
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
      {hidden > 0 && (
        <button onClick={() => setOpen(true)} style={{ marginTop: 10, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, color: "#0e7490", cursor: "pointer" }}>
          ▸ Show {hidden} more {hidden === 1 ? "leaf" : "leaves"}
        </button>
      )}
    </section>
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
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "#5a544c", maxWidth: 800, margin: "0 0 8px" }}>
          The rolled-up <b>merged</b> nodes whose ground truth falls in this category — individual <b>rebel leaves</b> (not folded
          into a merge) are collapsed per dataset. Each node&apos;s table reads top-to-bottom: <b>ground truth</b>, the wizard&apos;s
          <b> de-novo</b> prediction and the judge&apos;s verdict, then its <b>menu-exposed</b> prediction and verdict — laid out so
          you can compare the same tier down a column. The <b>Tissue</b> column (marked <b>SCORED</b>) drives the summary&apos;s
          correct-call rate; read the judge&apos;s note and decide for yourself whether each match is legitimate.
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6b655d", maxWidth: 820, margin: "0 0 20px", background: "#faf7f0", border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 12px" }}>
          <b>De-novo vs menu-exposed:</b> the <b>de-novo</b> row is the wizard&apos;s full 4-tier free-form call with its own
          confidences, recovered from the representative member leaf&apos;s chat transcript (the scored artifact only kept the
          consolidated phrase, so these are re-parsed from the leaf). The <b>menu-exposed</b> row is the same call forced to the
          closest option in the GT menu at each tier. For a <b>merged</b> node, expand <em>&ldquo;member-leaf de-novo calls&rdquo;</em>
          under the card to see every leaf&apos;s own 4-tier prediction (★ = the one shown above). A handful of nodes whose leaves
          used an unparseable format fall back to the consolidated identity phrase.
        </p>

        {fuzzyDs.map((d) => <DatasetSection key={d} ds={d} nodes={byDataset[d]} />)}
        {mf.length > 0 && <MiniSection nodes={mf} />}
      </div>
    </div>
  );
}
