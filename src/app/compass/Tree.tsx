"use client";
/**
 * Branching tree — tidy dendrogram with orthogonal edges (every line horizontal or vertical), drawn
 * top-down: siblings evenly spaced and tight, tissues further apart, groups furthest; parents centred
 * over their children; forks are horizontal bars at each landmark.
 *
 * LAYOUT RULE: leaves are placed left-to-right with spacing set by how high up two neighbours diverge
 * (1.0 within a split, 1.9 within a tissue, 4.5 between tissues, 9 between groups); internal nodes sit
 * at the midpoint of their children. Edges are drawn only downward and sideways at landmarks, so
 * nothing can cross. Nothing exists before it forks.
 *
 * TREE (data/delta.json, ChemFish CHEM10):
 *   dock → 4 groups (schematic, ~gastrulation) → tissues (fork at 24 hpf, schematic: no ChemFish data
 *   before 36 hpf) → cell types, forking at the landmark (36/48/72 hpf) where any condition first puts
 *   ≥0.25% of cells in them; a tissue's later-forking cell types travel together in a "rest" stream
 *   until their landmark. Streams drawn per tissue: every cell type any condition ever takes + the
 *   three largest potential ones + the pooled remainder.
 * FLOTILLA: ten dots = the ten largest streams at 72 hpf for the condition; TAKEN (blue) is each
 *   dot's whole route back to the dock. Drug side: a route the drug takes that wild type does not is
 *   coloured by the Phase-5 program the drug engages most in that tissue (flotilla.json loadings).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/delta.json";
import flot from "./data/flotilla.json";

type Node = { id: string; label: string; level: "tissue" | "celltype"; parent?: string; pooled?: number; share: Record<string, Record<string, number>> };
type Delta = { stages: number[]; used: number; conds: string[]; n_embryos: Record<string, Record<string, number>>; nodes: Node[] };
const D = raw as unknown as Delta; const S = D.stages; const USED = D.used; const TOPN = 10; const LAST = S[S.length - 1];
const FL = flot as unknown as { program_order: string[]; programs: Record<string, { label: string }>; responses: Record<string, Record<string, { loading: Record<string, number> }>> };
const PROG_COLOR: Record<string, string> = { neural: "#35c4b5", mesenchymal: "#b794f4", module3: "#d6b26a", epithelial: "#f472b6", "fast-muscle": "#f59e0b" };
const PROG_LABEL: Record<string, string> = { neural: "neural differentiation", mesenchymal: "mesenchymal arrest", module3: "module 3 (provisional)", epithelial: "epithelial / fin-fold", "fast-muscle": "fast-muscle stress" };
const AMBER = "#c98a3a", BLUE = "#4f9fe6", GREY = "#3f4956", INK = "#c7d0da", MUTED = "#6e7a88";
// orthographic, top-down: no perspective, no foreshortening — time runs straight down, width across
const iso = (u: number, v: number, _z = 0) => [v, u] as const;
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

/* river geometry: fork positions and width */
const L = 258, XF = { groups: 17, t24: 38, s36: 84, s48: 160, s72: 236 };
const XLM: Record<number, number> = { 24: XF.t24, 36: XF.s36, 48: XF.s48, 72: XF.s72 };
const WPTS: [number, number][] = [[0, 3], [XF.groups, 14], [XF.t24, 42], [XF.s36, 78], [XF.s48, 108], [XF.s72, 130], [L, 134]];
const widthAt = (_x: number) => WPTS[WPTS.length - 1][1];   // width is set by the tidy layout, not by a river profile
const TRANS = 4.5;                                // short diagonal elbow: a child leaves its parent's centre almost at once
const smooth = (t: number) => Math.max(0, Math.min(1, t));   // linear: straight elbow, no easing

type T = { id: string; label: string; kind: "root" | "group" | "tissue" | "rest" | "leaf"; xf: number; children: T[]; parent?: T; a: number; b: number; x: number; tissue?: string; data?: Node; nLeaves: number };
const topOf = (c: string, pool: Node[]) => new Set(pool.slice().sort((a, b) => (b.share[c]?.[String(LAST)] ?? 0) - (a.share[c]?.[String(LAST)] ?? 0)).slice(0, TOPN).map((n) => n.id));

function build() {
  const cts = D.nodes.filter((n) => n.level === "celltype");
  const everTaken = new Set<string>(); D.conds.forEach((c) => topOf(c, cts).forEach((id) => everTaken.add(id)));
  const tissues = D.nodes.filter((n) => n.level === "tissue").filter((t) => (t.share.wildtype["36"] ?? 0) >= 0.004 || cts.some((k) => k.parent === t.id && everTaken.has(k.id)))
    .sort((a, b) => hash(a.label) - hash(b.label));
  const root: T = { id: "root", label: "", kind: "root", xf: 0, children: [], a: 0, b: 1, x: 0, nLeaves: 0 };
  const groups: T[] = Array.from({ length: 4 }, (_, g) => ({ id: `g${g}`, label: "", kind: "group" as const, xf: XF.groups, children: [], parent: root, a: 0, b: 1, x: 0, nLeaves: 0 }));
  root.children = groups;
  const drawn: Node[] = [];
  tissues.forEach((t, ti) => {
    const kids = cts.filter((k) => k.parent === t.id);
    const keep = new Set<string>(kids.filter((k) => everTaken.has(k.id) || k.id.endsWith(":other")).map((k) => k.id));
    kids.filter((k) => !keep.has(k.id)).sort((a, b) => Math.max(...Object.values(b.share).flatMap((v) => Object.values(v))) - Math.max(...Object.values(a.share).flatMap((v) => Object.values(v)))).slice(0, 3).forEach((k) => keep.add(k.id));
    const leaves = kids.filter((k) => keep.has(k.id)).map((k) => { const first = S.find((s) => D.conds.some((c) => (k.share[c]?.[String(s)] ?? 0) >= USED)); const stage = k.id.endsWith(":other") ? 36 : first ?? [36, 48, 72][Math.floor(hash(k.id) * 3)]; drawn.push(k); return { k, stage }; })
      .sort((a, b) => hash(a.k.id) - hash(b.k.id));
    const tn: T = { id: t.id, label: t.label, kind: "tissue", xf: XF.t24, children: [], a: 0, b: 1, x: 0, tissue: t.label, data: t, nLeaves: 0 };
    const g = groups[Math.floor((ti / tissues.length) * 4)]; tn.parent = g; g.children.push(tn);
    // chain of splits: at each landmark the current node splits into the leaves forking there (+ a "rest" carrying the later ones)
    let cur = tn;
    [36, 48, 72].forEach((s, si) => {
      const now = leaves.filter((l) => l.stage === s), later = leaves.filter((l) => l.stage > s);
      if (!now.length) return;
      const kidsT: T[] = now.map(({ k }) => ({ id: k.id, label: k.label, kind: "leaf" as const, xf: XLM[s], children: [], parent: cur, a: 0, b: 1, x: 0, tissue: t.label, data: k, nLeaves: 1 }));
      if (later.length) { const rest: T = { id: `${t.id}:rest${s}`, label: "", kind: "rest", xf: XLM[s], children: [], parent: cur, a: 0, b: 1, x: 0, tissue: t.label, nLeaves: 0 }; kidsT.splice(Math.floor(kidsT.length / 2), 0, rest); cur.children = kidsT; cur = rest; }
      else cur.children = kidsT;
      void si;
    });
  });
  const count = (n: T): number => (n.nLeaves = n.kind === "leaf" ? 1 : Math.max(1, n.children.reduce((a, c) => a + count(c), 0)));
  count(root);
  // tidy dendrogram: leaves left-to-right with spacing set by how high up neighbours diverge; parents centred over children
  const all: T[] = []; const walk = (n: T) => { all.push(n); n.children.forEach(walk); }; walk(root);
  const leavesL = all.filter((n) => !n.children.length);
  const depth = (n: T) => { let d = 0; let q: T | undefined = n; while (q?.parent) { d++; q = q.parent; } return d; };
  const lca = (a: T, b: T) => { const A = new Set<string>(); let q: T | undefined = a; while (q) { A.add(q.id); q = q.parent; } q = b; while (q && !A.has(q.id)) q = q.parent; return q!; };
  const SEP: Record<string, number> = { root: 12, group: 6, tissue: 2.4, rest: 2.4, leaf: 1.3 };
  let x = 0; leavesL.forEach((l, i) => { if (i) { const anc = lca(leavesL[i - 1], l); x += SEP[anc.kind]; } l.x = x; }); void depth;
  const place = (n: T): number => { if (!n.children.length) return n.x; const xs = n.children.map(place); n.x = (Math.min(...xs) + Math.max(...xs)) / 2; return n.x; };
  place(root); const shift = root.x; all.forEach((n) => (n.x -= shift));
  return { root, all, drawn };
}
const centre = (n: T, _x: number) => n.x;
const splitX = (n: T) => (n.children.length ? n.children[0].xf : L);
/* orthogonal edge for a node: horizontal bar at its fork from the parent's x to its own x, then a vertical drop to its split */
const polyline = (n: T) => `M${(n.parent ? n.parent.x : n.x).toFixed(2)},${n.xf.toFixed(2)} H${n.x.toFixed(2)} V${splitX(n).toFixed(2)}`;
/* route position of a dot at time y: the deepest ancestor that exists, sliding across the bar over TRANS units */
const routeV = (leaf: T, y: number): number => { let n: T = leaf; while (n.parent && n.xf > y) n = n.parent; if (!n.parent) return n.x; const f = smooth((y - n.xf) / TRANS); return n.parent.x + (n.x - n.parent.x) * f; };

export default function Tree({ cond, title, subtitle, children }: { cond: string; title: string; subtitle: string; children?: React.ReactNode }) {
  const { all, drawn } = useMemo(build, []);
  const leaves = useMemo(() => all.filter((n) => n.kind === "leaf"), [all]);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const isWT = cond === "wildtype";
  const routes = useMemo(() => { const f = (c: string) => { const tops = topOf(c, drawn); const on = new Set<string>(); leaves.filter((l) => tops.has(l.id)).forEach((l) => { let n: T | undefined = l; while (n) { on.add(n.id); n = n.parent; } }); return { tops, on }; }; return { wt: f("wildtype"), cond: f(cond) }; }, [leaves, drawn, cond]);
  const programOf = (tissue?: string) => { const r = tissue ? FL.responses[cond]?.[tissue] : undefined; if (!r) return null; return Object.entries(r.loading).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0]; };
  const status = (n: T) => { const w = routes.wt.on.has(n.id), d = routes.cond.on.has(n.id); return isWT ? (w ? "taken" : "open") : d && !w ? "new" : d ? "taken" : "open"; };
  const colorOf = (n: T) => { const st = status(n); return st === "taken" ? BLUE : st === "new" ? (PROG_COLOR[programOf(n.tissue) ?? ""] ?? AMBER) : GREY; };
  const engaged = useMemo(() => isWT ? [] : Array.from(new Set(all.filter((n) => status(n) === "new").map((n) => programOf(n.tissue) ?? "none"))), [all, routes, cond]);   // eslint-disable-line react-hooks/exhaustive-deps
  const taken = useMemo(() => leaves.filter((l) => routes.cond.tops.has(l.id)), [leaves, routes]);

  const xs = all.map((n) => n.x); const minX = Math.min(...xs) - 40, maxX = Math.max(...xs) + 10, minY = -8, maxY = L + 10;
  const home = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  const box = useRef(home); const [vb, setVb] = useState(box.current);
  const svgRef = useRef<SVGSVGElement>(null); const drag = useRef<{ x: number; y: number } | null>(null);
  const toUser = (cx: number, cy: number) => { const r = svgRef.current!.getBoundingClientRect(); const b = box.current; const k = Math.min(r.width / b.w, r.height / b.h); const ox = (r.width - b.w * k) / 2, oy = (r.height - b.h * k) / 2; return [b.x + (cx - r.left - ox) / k, b.y + (cy - r.top - oy) / k, k] as const; };
  useEffect(() => { const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const [ux, uy] = toUser(e.clientX, e.clientY); const f = Math.exp(e.deltaY * 0.0012); const b = box.current; const nw = Math.min(Math.max(b.w * f, 20), 4 * home.w); const nh = nw * (b.h / b.w);
      box.current = { x: ux - (ux - b.x) * (nw / b.w), y: uy - (uy - b.y) * (nh / b.h), w: nw, h: nh }; setVb(box.current); };
    el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => { if (!drag.current) return; const k = toUser(0, 0)[2]; const b = box.current; box.current = { ...b, x: b.x - (e.clientX - drag.current.x) / k, y: b.y - (e.clientY - drag.current.y) / k }; drag.current = { x: e.clientX, y: e.clientY }; setVb(box.current); };
  const onUp = () => { drag.current = null; };

  const streams = useMemo(() => (
    <g>
      {all.filter((n) => n.parent).sort((a, b) => (status(a) === "open" ? 0 : 1) - (status(b) === "open" ? 0 : 1)).map((n) => { const st = status(n); const on = hover === n.id;
        return <path key={n.id} d={polyline(n)} fill="none" stroke={on ? "#e8eef4" : colorOf(n)} strokeWidth={st === "open" ? 0.5 : 1.7} strokeLinecap="round" strokeLinejoin="round"
          onMouseEnter={() => n.kind === "leaf" && setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: n.kind === "leaf" ? "default" : undefined }} />; })}
      {/* fork markers where a taken route branches */}
      {all.filter((n) => n.parent && n.kind !== "rest" && status(n) !== "open" && n.xf >= XF.t24).map((n) => <circle key={`f-${n.id}`} cx={n.x} cy={n.xf} r={1.0} fill="#0e1116" stroke={colorOf(n)} strokeWidth={0.45} />)}
    </g>
  ), [all, routes, hover, cond]);   // eslint-disable-line react-hooks/exhaustive-deps

  const ROW_T = 4.4, TRAVEL = 22; const rows: number[] = [];
  for (let k = 0; k <= Math.ceil(TRAVEL / ROW_T); k++) { const x = (((t / ROW_T) % 1 + k) / (TRAVEL / ROW_T)) * (L + 6) - 3; if (x > 0.3 && x < L) rows.push(x); }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: 16, zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>{title}</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>{subtitle}</p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}><span style={{ color: BLUE, fontWeight: 600 }}>■</span> taken <span style={{ color: "#4a5563", fontWeight: 600, marginLeft: 8 }}>■</span> potential</p>
        {!isWT && (
          <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>
            <div style={{ color: INK, marginBottom: 3 }}>new branches, coloured by the program {cond} engages most there</div>
            {FL.program_order.map((p) => <div key={p} style={{ opacity: engaged.includes(p) ? 1 : 0.35 }}><span style={{ color: PROG_COLOR[p], fontWeight: 600 }}>■</span> {PROG_LABEL[p]}</div>)}
            <div style={{ opacity: engaged.includes("none") ? 1 : 0.35 }}><span style={{ color: AMBER, fontWeight: 600 }}>■</span> no program data for that tissue</div>
          </div>
        )}
      </div>
      {children}
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onDoubleClick={() => { box.current = home; setVb(box.current); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "grab" }}>
        {streams}
        {[24, 36, 48, 72].map((s) => { const y = XLM[s]; const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2;
          return <g key={s}><line x1={x0} y1={y} x2={x1} y2={y} stroke="#e8eef4" strokeOpacity={0.14} strokeWidth={0.5} strokeDasharray="1.6 2" /><text x={x0 - 3} y={y + 2} fontSize={5.6} fill={MUTED} textAnchor="end">{s} hpf</text>{s === 24 && <text x={x0 - 3} y={y + 8} fontSize={3.8} fill={MUTED} textAnchor="end" fontStyle="italic">schematic</text>}</g>; })}
        <rect x={-4} y={-3} width={8} height={3} fill="#2b3442" />
        {rows.map((x, ri) => taken.map((l) => { const [cx, cy] = iso(x, routeV(l, x)); return <circle key={`${ri}-${l.id}`} cx={cx} cy={cy} r={1.05} fill="#e8eef4" stroke={colorOf(l)} strokeWidth={0.45} />; }))}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const d = l.data!; const p = [l.x + 2, L + 4] as const;
          const pct = (c: string, s: number) => `${((d.share[c]?.[String(s)] ?? 0) * 100).toFixed(2)}%`;
          const lines = [d.pooled ? `${d.label} (${d.pooled} rarer types)` : d.label, `tissue: ${l.tissue} · forks at ${Object.entries(XLM).find(([, v]) => v === l.xf)?.[0]} hpf`, `wild type ${pct("wildtype", 36)} · ${pct("wildtype", 48)} · ${pct("wildtype", 72)}`];
          if (isWT) lines.push(`route: ${routes.wt.tops.has(l.id) ? "taken by the wild-type flotilla" : "potential"}`);
          else { const st = status(l); lines.push(`${cond} ${pct(cond, 36)} · ${pct(cond, 48)} · ${pct(cond, 72)} → ${st}`); if (st === "new") { const pr = programOf(l.tissue); lines.push(pr ? `dominant program in ${l.tissue}: ${PROG_LABEL[pr]} (loading ${FL.responses[cond][l.tissue!].loading[pr].toFixed(2)})` : `no Phase-5 program data for ${l.tissue}`); } }
          const w = Math.max(...lines.map((q) => q.length)) * 2.6 + 6; const px = Math.min(Math.max(p[0], vb.x + 4), vb.x + vb.w - w - 4); const py = Math.min(p[1], vb.y + vb.h - lines.length * 5.6 - 8);
          return <g pointerEvents="none"><rect x={px - 2} y={py} width={w} height={lines.length * 5.6 + 3.5} rx={1.5} fill="#0e1116" stroke="#273140" strokeWidth={0.5} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={px + 1} y={py + 5 + i * 5.6} fontSize={i ? 4.4 : 5.2} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
