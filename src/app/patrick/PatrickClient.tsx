"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GTViz from "./GTViz";

/* ============================ proposal (our pre-filled baseline) ============================ */
type Tag = "constitutive" | "guidance";
type Panel = { constitutive: string[]; guidance: string[] };
const PROPOSAL: Record<string, Panel> = {
  endothelial: {
    constitutive: ["cdh5", "kdrl", "kdr", "fli1", "fli1a", "tie1", "flt4"],
    guidance: ["robo4", "dll4", "efnb2a", "notch1", "notch3"],
  },
  mural: {
    constitutive: ["pdgfrb", "rgs5a", "kcnj8", "abcc9"],
    guidance: ["cspg4", "notch3", "pdgfra"],
  },
  intestinal: {
    constitutive: ["cdx1b", "vil1", "fabp2"],
    guidance: ["cdh17", "epcam", "cdh1", "foxa3"],
  },
};
const RATIONALE: Record<string, string> = {
  cdh5: "VE-cadherin — endothelial adherens junction; definitional.",
  kdrl: "vegfr2 / flk1 — endothelial RTK; definitional.",
  kdr: "vegfr2 paralog — definitional endothelial.",
  fli1: "ETS master TF — constitutive in endothelium.",
  fli1a: "fli1 paralog — constitutive endothelial TF.",
  tie1: "angiopoietin receptor — endothelial-restricted.",
  flt4: "vegfr3 — endothelial, but venous/lymphatic-leaning (edge marker).",
  robo4: "angiogenic GUIDANCE receptor — also neural axon-guidance. The leaf-18 culprit.",
  dll4: "arterial Notch ligand — inducible / context.",
  efnb2a: "arterial ephrin — also neural / somite.",
  notch1: "Notch receptor — broadly expressed, not endothelial-specific.",
  notch3: "Notch receptor — pericyte AND radial-glia; promiscuous.",
  pdgfrb: "PDGFR-β — pericyte-defining.",
  rgs5a: "pericyte marker.",
  kcnj8: "pericyte K_ATP channel.",
  abcc9: "pericyte K_ATP (SUR2).",
  cspg4: "NG2 — pericyte AND OPC / NG2-glia AND progenitors. The leaf-0 anchor; promiscuous.",
  pdgfra: "generic mesenchyme.",
  cdx1b: "caudal master TF — intestine-defining.",
  vil1: "villin — enterocyte brush-border.",
  fabp2: "intestinal FABP — enterocyte.",
  cdh17: "cadherin-17 — shared GUT and PRONEPHROS. The leaf-134 culprit.",
  epcam: "generic epithelial — all epithelia.",
  cdh1: "E-cadherin — generic epithelial.",
  foxa3: "broad endoderm (liver + gut + pancreas).",
};
const CONTROL_LEAF: Record<string, string> = { endothelial: "93", mural: "0", intestinal: "120" };

/* ============================ tissue palette ============================ */
const TISSUE_COLOR: Record<string, string> = {
  CNS: "#6366f1", Retina: "#8b5cf6", Vascular: "#ef4444", Mesenchyme: "#a8a29e", Muscle: "#f59e0b",
  Heart: "#dc2626", Epidermis: "#10b981", Blood: "#be123c", Immune: "#f97316", Pigment: "#7c3aed",
  Notochord: "#14b8a6", PNS_glia: "#0ea5e9", Endoderm: "#eab308", Kidney: "#3b82f6", Lens: "#06b6d4",
  NC: "#ec4899", Hypochord: "#64748b", Stress: "#94a3b8", HatchingGland: "#84cc16", Ear: "#22d3ee",
  PNS_neuron: "#38bdf8", Cartilage: "#d6d3d1", Unresolved: "#3f3f46", Other: "#52525b",
};
const tcolor = (t: string) => TISSUE_COLOR[t] || "#52525b";

/* ============================ types ============================ */
type Cells = {
  n: number; x: number[]; y: number[]; leaf: number[];
  leafTissue: Record<string, string>; leafCall: Record<string, string>; leafN: Record<string, number>;
  note: string;
};
type Stat = { pct_in: number; pct_out: number; log2FC: number } | null;
type Stats = {
  pulledAt: string; source: string; leaves: Record<string, Record<string, Stat>>;
  noData: string[]; neural: string[];
};

const CONFUSION = [
  { leaf: "18", label: "leaf 18 — false vascular", tone: "#ef4444" },
  { leaf: "134", label: "leaf 134 — false enterocyte (cdh17)", tone: "#eab308" },
  { leaf: "93", label: "leaf 93 — clean vascular ✓", tone: "#22c55e" },
  { leaf: "0", label: "leaf 0 — defensible pericyte", tone: "#a8a29e" },
];

/* ============================ component ============================ */
export default function PatrickClient() {
  const [cells, setCells] = useState<Cells | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [contra, setContra] = useState<string[]>([]);
  const [screen, setScreen] = useState(1);
  const [section, setSection] = useState<"decisions" | "gtviz">("decisions");

  // decision state (initialised from proposal once data has shape)
  const [tags, setTags] = useState<Record<string, Record<string, Tag>>>(() => {
    const t: Record<string, Record<string, Tag>> = {};
    for (const [pn, p] of Object.entries(PROPOSAL)) {
      t[pn] = {};
      p.constitutive.forEach((g) => (t[pn][g] = "constitutive"));
      p.guidance.forEach((g) => (t[pn][g] = "guidance"));
    }
    return t;
  });
  const [flt4, setFlt4] = useState<"constitutive" | "guidance" | "exclude">("constitutive");
  const [etv2, setEtv2] = useState<"early_only_not_floor_sufficient" | "constitutive" | "guidance">(
    "early_only_not_floor_sufficient"
  );
  const [impl, setImpl] = useState<"reuse_archivist_present_call" | "defined_numeric_bar">(
    "reuse_archivist_present_call"
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/patrick/cells.json").then((r) => r.json()).then(setCells).catch(() => {});
    fetch("/patrick/stats.json").then((r) => r.json()).then(setStats).catch(() => {});
    fetch("/patrick/contradictions.json").then((r) => r.json()).then((d) => setContra(d.contradictions || [])).catch(() => {});
  }, []);

  const overrides = useMemo(() => {
    const out: string[] = [];
    for (const [pn, p] of Object.entries(PROPOSAL)) {
      const base: Record<string, Tag> = {};
      p.constitutive.forEach((g) => (base[g] = "constitutive"));
      p.guidance.forEach((g) => (base[g] = "guidance"));
      for (const g of Object.keys(base)) if (tags[pn]?.[g] !== base[g]) out.push(`${pn}.${g}: ${base[g]} → ${tags[pn][g]}`);
    }
    if (flt4 !== "constitutive") out.push(`edge.flt4: constitutive → ${flt4}`);
    if (etv2 !== "early_only_not_floor_sufficient") out.push(`edge.etv2: early_only → ${etv2}`);
    return out;
  }, [tags, flt4, etv2]);

  const exportJSON = useMemo(() => {
    const panels: Record<string, Record<string, Tag>> = {};
    for (const pn of Object.keys(PROPOSAL)) panels[pn] = { ...tags[pn] };
    return {
      annotator: "Patrick",
      timestamp: new Date().toISOString(),
      panels,
      edge_markers: { flt4, etv2 },
      implementation: impl,
      overrides_from_proposal: overrides,
      notes,
    };
  }, [tags, flt4, etv2, impl, overrides, notes]);

  const flip = (pn: string, g: string) =>
    setTags((t) => ({ ...t, [pn]: { ...t[pn], [g]: t[pn][g] === "constitutive" ? "guidance" : "constitutive" } }));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <header style={S.header}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {section === "decisions" ? "R4b · constitutive-anchor decision dashboard" : "Patrick GT × prediction · visual review"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            MiniFin recursive v2 · 94,616 cells / 151 leaves · {stats ? `:5007 stats pulled ${stats.pulledAt.slice(0, 16).replace("T", " ")}Z` : "loading…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setSection("decisions")} style={{ ...S.sectionBtn, ...(section === "decisions" ? S.sectionOn : {}) }}>R4b decisions</button>
          <button onClick={() => setSection("gtviz")} style={{ ...S.sectionBtn, ...(section === "gtviz" ? S.sectionOn : {}) }}>GT × prediction (6 views)</button>
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: "right", marginLeft: 10 }}>prototype · noindex<br />real data only — don&apos;t fill blanks</div>
        </div>
      </header>

      {section === "decisions" ? (
        <>
          <nav style={S.nav}>
            {["Overview", "The error", "Panels", "Edge markers", "Implementation", "Review & export"].map((t, i) => (
              <button key={t} onClick={() => setScreen(i + 1)} style={{ ...S.step, ...(screen === i + 1 ? S.stepOn : {}) }}>
                <span style={S.stepN}>{i + 1}</span> {t}
              </button>
            ))}
          </nav>

          <main style={S.main}>
            {screen === 1 && <Overview cells={cells} />}
            {screen === 2 && <TheError stats={stats} />}
            {screen === 3 && <Panels tags={tags} flip={flip} stats={stats} />}
            {screen === 4 && <Edge flt4={flt4} setFlt4={setFlt4} etv2={etv2} setEtv2={setEtv2} stats={stats} />}
            {screen === 5 && <Impl impl={impl} setImpl={setImpl} />}
            {screen === 6 && <Review json={exportJSON} overrides={overrides} contra={contra} notes={notes} setNotes={setNotes} />}
          </main>

          <footer style={S.footer}>
            <button style={S.navBtn} disabled={screen === 1} onClick={() => setScreen((s) => Math.max(1, s - 1))}>← back</button>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {overrides.length === 0 ? "no overrides yet — all proposal tags accepted" : `${overrides.length} override(s) from proposal`}
            </div>
            <button style={{ ...S.navBtn, ...S.navBtnPrimary }} disabled={screen === 6} onClick={() => setScreen((s) => Math.min(6, s + 1))}>
              {screen === 5 ? "review →" : "next →"}
            </button>
          </footer>
        </>
      ) : (
        <main style={S.main}><GTViz /></main>
      )}
    </div>
  );
}

/* ============================ S1 — overview UMAP ============================ */
function Overview({ cells }: { cells: Cells | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv || !cells) return;
    const W = cv.width, H = cv.height, ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0b0a12"; ctx.fillRect(0, 0, W, H);
    const xs = cells.x, ys = cells.y, lf = cells.leaf, n = cells.n;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++) { if (xs[i] < minx) minx = xs[i]; if (xs[i] > maxx) maxx = xs[i]; if (ys[i] < miny) miny = ys[i]; if (ys[i] > maxy) maxy = ys[i]; }
    const pad = 18, sx = (W - 2 * pad) / (maxx - minx), sy = (H - 2 * pad) / (maxy - miny);
    const fl = focus !== null ? parseInt(focus) : -2;
    for (let i = 0; i < n; i++) {
      const px = pad + (xs[i] - minx) * sx, py = H - (pad + (ys[i] - miny) * sy);
      const t = cells.leafTissue[String(lf[i])] || "Other";
      if (fl === -2) { ctx.fillStyle = tcolor(t); ctx.globalAlpha = 0.55; ctx.fillRect(px, py, 1.6, 1.6); }
      else if (lf[i] === fl) { ctx.fillStyle = tcolor(t); ctx.globalAlpha = 1; ctx.fillRect(px - 1, py - 1, 3, 3); }
      else { ctx.fillStyle = "#3a3a44"; ctx.globalAlpha = 0.18; ctx.fillRect(px, py, 1.2, 1.2); }
    }
    ctx.globalAlpha = 1;
  }, [cells, focus]);

  const tissues = useMemo(() => {
    if (!cells) return [];
    const set = new Set(Object.values(cells.leafTissue));
    return Array.from(set).sort();
  }, [cells]);

  return (
    <div>
      <H title="S1 · MiniFin recursive v2 overview" sub="Every cell coloured by tissue family. Click a flagged leaf to highlight its cells in place — these are the clusters the R4b decision is about." />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <canvas ref={ref} width={620} height={460} style={{ borderRadius: 10, border: "1px solid #26262e", background: "#0b0a12" }} />
          {!cells && <div style={S.loading}>rendering 94,616 cells…</div>}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={S.cardTitle}>flagged leaves</div>
          {CONFUSION.map((c) => (
            <button key={c.leaf} onClick={() => setFocus(focus === c.leaf ? null : c.leaf)}
              style={{ ...S.chip, borderColor: focus === c.leaf ? c.tone : "#2c2c36", background: focus === c.leaf ? c.tone + "22" : "transparent" }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: c.tone, display: "inline-block" }} />
              <span style={{ flex: 1, textAlign: "left" }}>{c.label}</span>
              <span style={{ opacity: 0.5, fontSize: 11 }}>{cells ? `${cells.leafN[c.leaf]?.toLocaleString()} cells` : ""}</span>
            </button>
          ))}
          {focus && cells && (
            <div style={S.focusBox}>
              <b>leaf {focus}</b> · {cells.leafTissue[focus]} · {cells.leafN[focus]?.toLocaleString()} cells<br />
              <span style={{ opacity: 0.7 }}>call: {cells.leafCall[focus]}</span>
            </div>
          )}
          <div style={{ ...S.cardTitle, marginTop: 16 }}>tissue families</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tissues.map((t) => (
              <span key={t} style={S.legend}><span style={{ width: 8, height: 8, borderRadius: 8, background: tcolor(t) }} />{t}</span>
            ))}
          </div>
          {cells && <div style={{ fontSize: 10, opacity: 0.4, marginTop: 12 }}>{cells.note}</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================ S2 — the worked error (anchor stack) ============================ */
function TheError({ stats }: { stats: Stats | null }) {
  if (!stats) return <div style={S.loading}>loading live stats…</div>;
  const panel = PROPOSAL.endothelial;
  const order = [...panel.constitutive, ...panel.guidance, ...stats.neural.filter((g) => !panel.constitutive.includes(g) && !panel.guidance.includes(g))];
  const classOf = (g: string) =>
    panel.constitutive.includes(g) ? "constitutive" : panel.guidance.includes(g) ? "guidance" : "neural";
  const barColor = { constitutive: "#2dd4bf", guidance: "#f59e0b", neural: "#a78bfa" } as Record<string, string>;

  const Stack = ({ leaf, title, tone }: { leaf: string; title: string; tone: string }) => (
    <div style={{ flex: 1, minWidth: 300 }}>
      <div style={{ fontWeight: 700, color: tone, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>leaf {leaf} · n={stats.leaves[leaf] ? "" : ""}{/* */}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 180, borderBottom: "1px solid #33333d", paddingBottom: 0 }}>
        {order.map((g) => {
          const s = stats.leaves[leaf]?.[g];
          const h = s ? Math.max(2, s.pct_in * 170) : 0;
          const cls = classOf(g);
          return (
            <div key={g} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              {s === null && <div style={{ fontSize: 8, opacity: 0.4, marginBottom: 2 }}>n/d</div>}
              <div title={s ? `${g}: ${(s.pct_in * 100).toFixed(0)}% in, log2FC ${s.log2FC}` : `${g}: no :5007 data`}
                style={{ width: "78%", height: h, background: barColor[cls], borderRadius: "3px 3px 0 0", opacity: s ? 1 : 0.15 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {order.map((g) => (
          <div key={g} style={{ flex: 1, textAlign: "center", fontSize: 8.5, color: barColor[classOf(g)], transform: "rotate(0deg)", whiteSpace: "nowrap", overflow: "hidden" }}>{g}</div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <H title="S2 · The worked error — why R4b" sub="Each bar = fraction of the leaf's cells expressing that marker (live :5007). Teal = constitutive endothelial · amber = guidance/promiscuous · violet = neural." />
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <Stack leaf="18" title="leaf 18 — labelled 'vascular endothelial'" tone="#ef4444" />
        <Stack leaf="93" title="leaf 93 — clean vascular control ✓" tone="#22c55e" />
      </div>
      <div style={S.ruleBox}>
        <b>The rule this motivates (R4b):</b> leaf 18 has every <span style={{ color: "#2dd4bf" }}>constitutive</span> bar flat (~0%) and one lone
        {" "}<span style={{ color: "#f59e0b" }}>guidance</span> bar tall (robo4) with <span style={{ color: "#a78bfa" }}>neural</span> markers high →
        it was mislabelled vascular on a promiscuous marker. Leaf 93 has every constitutive bar tall → real endothelium.
        <b> A positive call must rest on ≥1 constitutive marker; a guidance marker can corroborate but never satisfy the floor alone.</b>
      </div>
    </div>
  );
}

/* ============================ S3 — panel triage ============================ */
function Panels({ tags, flip, stats }: { tags: Record<string, Record<string, Tag>>; flip: (p: string, g: string) => void; stats: Stats | null }) {
  return (
    <div>
      <H title="S3 · Panel triage" sub="Each marker is pre-tagged with our proposal. Toggle any you disagree with. Evidence = enrichment in that lineage's clean control leaf (live :5007)." />
      {Object.entries(PROPOSAL).map(([pn]) => {
        const ctrl = CONTROL_LEAF[pn];
        const all = [...PROPOSAL[pn].constitutive, ...PROPOSAL[pn].guidance];
        return (
          <div key={pn} style={S.panelCard}>
            <div style={S.cardTitle}>{pn} <span style={{ opacity: 0.5, fontWeight: 400 }}>· evidence from control leaf {ctrl}</span></div>
            {all.map((g) => {
              const tag = tags[pn]?.[g];
              const s = stats?.leaves[ctrl]?.[g];
              return (
                <div key={g} style={S.markerRow}>
                  <button onClick={() => flip(pn, g)} style={{ ...S.tagBtn, background: tag === "constitutive" ? "#0d9488" : "#b45309" }}>
                    {tag === "constitutive" ? "constitutive" : "guidance"}
                  </button>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{g}</span>
                    <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>{RATIONALE[g]}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", minWidth: 130, textAlign: "right", opacity: s ? 0.85 : 0.35 }}>
                    {s === undefined ? "" : s === null ? "no :5007 data" : `${(s.pct_in * 100).toFixed(0)}% · log2FC ${s.log2FC > 0 ? "+" : ""}${s.log2FC}`}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ S4 — edge markers ============================ */
function Edge({ flt4, setFlt4, etv2, setEtv2, stats }: any) {
  const ev = (leaf: string, g: string) => {
    const s = stats?.leaves[leaf]?.[g];
    return s === undefined ? "—" : s === null ? "no data" : `${(s.pct_in * 100).toFixed(0)}% / log2FC ${s.log2FC}`;
  };
  return (
    <div>
      <H title="S4 · Edge markers" sub="Two genuinely ambiguous markers. More context, explicit accept or override." />
      <div style={S.panelCard}>
        <div style={S.cardTitle}>flt4 <span style={{ opacity: 0.5, fontWeight: 400 }}>(vegfr3)</span></div>
        <p style={S.edgeP}>vegfr3 is endothelial but <b>venous/lymphatic-leaning</b> — it can be low in arterial/cranial endothelium. In the clean control leaf 93 it reads <b>{ev("93", "flt4")}</b>; in leaf 18 <b>{ev("18", "flt4")}</b>. Proposed: <b>constitutive</b>, flagged. If it&apos;s patchy across real endothelial leaves, demoting it to guidance avoids over-tightening the floor.</p>
        <Radio value={flt4} set={setFlt4} opts={[["constitutive", "constitutive (proposed)"], ["guidance", "guidance"], ["exclude", "exclude from panel"]]} />
      </div>
      <div style={S.panelCard}>
        <div style={S.cardTitle}>etv2 <span style={{ opacity: 0.5, fontWeight: 400 }}>(etsrp)</span></div>
        <p style={S.edgeP}>etv2 is the angioblast specification master — but <b>transient</b>: it&apos;s on in early angioblasts and gone in differentiated endothelium. At 48 hpf it reads <b>{ev("93", "etv2")}</b> in the clean control. Proposed: <b>not floor-sufficient at 48 hpf</b> (it can corroborate early-EC but shouldn&apos;t alone license a call). Override to constitutive only if you want early-angioblast leaves to pass on etv2 alone.</p>
        <Radio value={etv2} set={setEtv2} opts={[["early_only_not_floor_sufficient", "early-only · not floor-sufficient (proposed)"], ["constitutive", "constitutive"], ["guidance", "guidance"]]} />
      </div>
    </div>
  );
}

/* ============================ S5 — implementation ============================ */
function Impl({ impl, setImpl }: { impl: string; setImpl: (v: any) => void }) {
  return (
    <div>
      <H title="S5 · Implementation" sub="How does R4b decide a constitutive marker is 'present'?" />
      <div style={S.panelCard}>
        <Radio value={impl} set={setImpl} opts={[
          ["reuse_archivist_present_call", "Reuse the Archivist's existing present/absent call (recommended)"],
          ["defined_numeric_bar", "Define a new numeric bar (e.g. pct_in ≥ 0.15 & log2FC ≥ 1)"],
        ]} />
        <p style={{ ...S.edgeP, marginTop: 12 }}>
          <b>Recommended:</b> the harness already classifies every probed marker present / absent / specific-positive (it logged
          {" "}<i>&quot;kdrl: absent here (%in 0.004)&quot;</i> on leaf 18). Keying R4b off that existing call introduces <b>no second tunable</b> —
          the floor stays consistent with the rest of the reasoner. A new numeric bar is a separate threshold to maintain and tune.
        </p>
      </div>
    </div>
  );
}

/* ============================ S6 — review & export ============================ */
function Review({ json, overrides, contra, notes, setNotes }: any) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(json, null, 2);
  const copy = () => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "patrick_r4b_decisions.json"; a.click();
  };
  return (
    <div>
      <H title="S6 · Review & export" sub="Your calls, ready to send back to Steven. Nothing is written server-side — copy or download the JSON." />
      {contra.length > 0 && (
        <div style={S.contraBox}>
          <b>⚠ live stats that contradict the proposed tags</b> (real signal — worth a look before you sign off):
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{contra.map((c: string, i: number) => <li key={i} style={{ fontSize: 12 }}>{c}</li>)}</ul>
        </div>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={S.cardTitle}>overrides from proposal ({overrides.length})</div>
          {overrides.length === 0
            ? <div style={{ opacity: 0.5, fontSize: 13 }}>none — all proposed tags accepted as-is.</div>
            : <ul style={{ paddingLeft: 18 }}>{overrides.map((o: string, i: number) => <li key={i} style={{ fontFamily: "monospace", fontSize: 12 }}>{o}</li>)}</ul>}
          <div style={{ ...S.cardTitle, marginTop: 16 }}>notes for Steven</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="free text — anything Steven should know…" style={S.textarea} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={copy} style={{ ...S.navBtn, ...S.navBtnPrimary }}>{copied ? "copied ✓" : "Copy JSON"}</button>
            <button onClick={download} style={S.navBtn}>Download .json</button>
          </div>
        </div>
        <pre style={S.jsonBox}>{text}</pre>
      </div>
    </div>
  );
}

/* ============================ small ui helpers ============================ */
function H({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3, maxWidth: 760 }}>{sub}</div>
    </div>
  );
}
function Radio({ value, set, opts }: { value: string; set: (v: any) => void; opts: [string, string][] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map(([v, label]) => (
        <button key={v} onClick={() => set(v)} style={{ ...S.radio, ...(value === v ? S.radioOn : {}) }}>
          <span style={{ ...S.radioDot, ...(value === v ? { background: "#2dd4bf", borderColor: "#2dd4bf" } : {}) }} />{label}
        </button>
      ))}
    </div>
  );
}

/* ============================ styles ============================ */
const S: Record<string, React.CSSProperties> = {
  page: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#08070d", color: "#e7e7ea", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #1c1c24" },
  nav: { display: "flex", gap: 4, padding: "10px 18px", borderBottom: "1px solid #1c1c24", overflowX: "auto" },
  step: { display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "#9a9aa3", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
  stepOn: { background: "#16161d", color: "#fff", border: "1px solid #2c2c36" },
  stepN: { display: "inline-flex", width: 18, height: 18, borderRadius: 18, background: "#2c2c36", color: "#cfcfd6", fontSize: 11, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, overflow: "auto", padding: "24px 26px" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px", borderTop: "1px solid #1c1c24" },
  navBtn: { padding: "9px 18px", borderRadius: 8, border: "1px solid #2c2c36", background: "#16161d", color: "#e7e7ea", fontSize: 13, cursor: "pointer" },
  navBtnPrimary: { background: "#0d9488", border: "1px solid #0d9488", color: "#fff", fontWeight: 600 },
  sectionBtn: { padding: "7px 13px", borderRadius: 8, border: "1px solid #2c2c36", background: "transparent", color: "#9a9aa3", fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" },
  sectionOn: { background: "#0d948822", border: "1px solid #0d9488", color: "#fff", fontWeight: 600 },
  cardTitle: { fontSize: 13, fontWeight: 700, textTransform: "capitalize", marginBottom: 10, letterSpacing: 0.3 },
  chip: { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px", marginBottom: 7, borderRadius: 8, border: "1px solid #2c2c36", color: "#e7e7ea", fontSize: 13, cursor: "pointer" },
  focusBox: { marginTop: 8, padding: 10, borderRadius: 8, background: "#16161d", fontSize: 12, lineHeight: 1.5 },
  legend: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.8 },
  loading: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, fontSize: 13 },
  ruleBox: { marginTop: 22, padding: "14px 16px", borderRadius: 10, background: "#101019", border: "1px solid #26263a", fontSize: 13.5, lineHeight: 1.6 },
  panelCard: { padding: "14px 16px", borderRadius: 10, background: "#101019", border: "1px solid #1f1f29", marginBottom: 14 },
  markerRow: { display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderTop: "1px solid #1a1a22" },
  tagBtn: { width: 104, padding: "5px 0", borderRadius: 6, border: "none", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  edgeP: { fontSize: 13, lineHeight: 1.6, opacity: 0.85, margin: "4px 0 12px" },
  radio: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #2c2c36", background: "transparent", color: "#e7e7ea", fontSize: 13, cursor: "pointer", textAlign: "left" },
  radioOn: { background: "#0d948822", border: "1px solid #0d9488" },
  radioDot: { width: 13, height: 13, borderRadius: 13, border: "2px solid #555", display: "inline-block" },
  contraBox: { padding: "12px 14px", borderRadius: 10, background: "#2a1c0a", border: "1px solid #facc1544", marginBottom: 16, fontSize: 13 },
  textarea: { width: "100%", minHeight: 80, background: "#0b0a12", border: "1px solid #2c2c36", borderRadius: 8, color: "#e7e7ea", padding: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical" },
  jsonBox: { flex: 1, minWidth: 320, maxHeight: 460, overflow: "auto", background: "#0b0a12", border: "1px solid #1f1f29", borderRadius: 10, padding: 14, fontSize: 11.5, fontFamily: "monospace", whiteSpace: "pre-wrap" },
};
const CSS = `button:hover{filter:brightness(1.15)} ::-webkit-scrollbar{height:8px;width:8px} ::-webkit-scrollbar-thumb{background:#2c2c36;border-radius:8px}`;
