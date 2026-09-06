"use client";
/**
 * Branching tree — recursive space partition, drawn orthographically top-down with straight segments
 * and crisp elbows at each landmark (no perspective, no river curves).
 *
 * LAYOUT RULE (the whole point): every node owns a band [a,b] of the river's width. Its children
 * partition that band, with gaps between them, and each stream runs down the centre of its own band.
 * A stream can never leave its band, bands of different subtrees are disjoint, so crossings are
 * impossible by construction. Forks happen only at landmarks; nothing exists before it forks; the
 * river widens between forks so every band grows.
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
const AMBER = "#c98a3a", BLUE = "#4f9fe6", GREY = "#38414d", INK = "#c7d0da", MUTED = "#6e7a88";
// orthographic, top-down: no perspective, no foreshortening — time runs straight down, width across
const iso = (u: number, v: number, _z = 0) => [v, u] as const;
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

/* river geometry: fork positions and width */
const L = 122, XF = { groups: 8, t24: 18, s36: 40, s48: 76, s72: 112 };
const XLM: Record<number, number> = { 24: XF.t24, 36: XF.s36, 48: XF.s48, 72: XF.s72 };
const WPTS: [number, number][] = [[0, 3], [XF.groups, 14], [XF.t24, 42], [XF.s36, 78], [XF.s48, 108], [XF.s72, 130], [L, 134]];
const widthAt = (x: number) => { for (let i = 1; i < WPTS.length; i++) if (x <= WPTS[i][0]) { const [x0, w0] = WPTS[i - 1], [x1, w1] = WPTS[i]; return w0 + ((x - x0) / (x1 - x0)) * (w1 - w0); } return WPTS[WPTS.length - 1][1]; };
const TRANS = 2.2;                                // short diagonal elbow: a child leaves its parent's centre almost at once
const smooth = (t: number) => Math.max(0, Math.min(1, t));   // linear: straight elbow, no easing

type T = { id: string; label: string; kind: "root" | "group" | "tissue" | "rest" | "leaf"; xf: number; children: T[]; parent?: T; a: number; b: number; tissue?: string; data?: Node; nLeaves: number };
const topOf = (c: string, pool: Node[]) => new Set(pool.slice().sort((a, b) => (b.share[c]?.[String(LAST)] ?? 0) - (a.share[c]?.[String(LAST)] ?? 0)).slice(0, TOPN).map((n) => n.id));

function build() {
  const cts = D.nodes.filter((n) => n.level === "celltype");
  const everTaken = new Set<string>(); D.conds.forEach((c) => topOf(c, cts).forEach((id) => everTaken.add(id)));
  const tissues = D.nodes.filter((n) => n.level === "tissue").filter((t) => (t.share.wildtype["36"] ?? 0) >= 0.004 || cts.some((k) => k.parent === t.id && everTaken.has(k.id)))
    .sort((a, b) => hash(a.label) - hash(b.label));
  const root: T = { id: "root", label: "", kind: "root", xf: 0, children: [], a: 0, b: 1, nLeaves: 0 };
  const groups: T[] = Array.from({ length: 4 }, (_, g) => ({ id: `g${g}`, label: "", kind: "group" as const, xf: XF.groups, children: [], parent: root, a: 0, b: 1, nLeaves: 0 }));
  root.children = groups;
  const drawn: Node[] = [];
  tissues.forEach((t, ti) => {
    const kids = cts.filter((k) => k.parent === t.id);
    const keep = new Set<string>(kids.filter((k) => everTaken.has(k.id) || k.id.endsWith(":other")).map((k) => k.id));
    kids.filter((k) => !keep.has(k.id)).sort((a, b) => Math.max(...Object.values(b.share).flatMap((v) => Object.values(v))) - Math.max(...Object.values(a.share).flatMap((v) => Object.values(v)))).slice(0, 3).forEach((k) => keep.add(k.id));
    const leaves = kids.filter((k) => keep.has(k.id)).map((k) => { const first = S.find((s) => D.conds.some((c) => (k.share[c]?.[String(s)] ?? 0) >= USED)); const stage = k.id.endsWith(":other") ? 36 : first ?? [36, 48, 72][Math.floor(hash(k.id) * 3)]; drawn.push(k); return { k, stage }; })
      .sort((a, b) => hash(a.k.id) - hash(b.k.id));
    const tn: T = { id: t.id, label: t.label, kind: "tissue", xf: XF.t24, children: [], a: 0, b: 1, tissue: t.label, data: t, nLeaves: 0 };
    const g = groups[Math.floor((ti / tissues.length) * 4)]; tn.parent = g; g.children.push(tn);
    // chain of splits: at each landmark the current node splits into the leaves forking there (+ a "rest" carrying the later ones)
    let cur = tn;
    [36, 48, 72].forEach((s, si) => {
      const now = leaves.filter((l) => l.stage === s), later = leaves.filter((l) => l.stage > s);
      if (!now.length) return;
      const kidsT: T[] = now.map(({ k }) => ({ id: k.id, label: k.label, kind: "leaf" as const, xf: XLM[s], children: [], parent: cur, a: 0, b: 1, tissue: t.label, data: k, nLeaves: 1 }));
      if (later.length) { const rest: T = { id: `${t.id}:rest${s}`, label: "", kind: "rest", xf: XLM[s], children: [], parent: cur, a: 0, b: 1, tissue: t.label, nLeaves: 0 }; kidsT.splice(Math.floor(kidsT.length / 2), 0, rest); cur.children = kidsT; cur = rest; }
      else cur.children = kidsT;
      void si;
    });
  });
  const count = (n: T): number => (n.nLeaves = n.kind === "leaf" ? 1 : Math.max(1, n.children.reduce((a, c) => a + count(c), 0)));
  count(root);
  // recursive band partition with gaps between siblings
  const assign = (n: T, a: number, b: number) => { n.a = a; n.b = b; const k = n.children.length; if (!k) return; const G = k > 1 ? Math.min(0.28, 0.09 * (k - 1)) : 0; const gap = k > 1 ? ((b - a) * G) / (k - 1) : 0; let y = a;
    n.children.forEach((c) => { const w = (b - a) * (1 - G) * (c.nLeaves / n.nLeaves); assign(c, y, y + w); y += w + gap; }); };
  assign(root, 0, 1);
  const all: T[] = []; const walk = (n: T) => { all.push(n); n.children.forEach(walk); }; walk(root);
  return { root, all, drawn };
}
const centre = (n: T, x: number) => widthAt(x) * ((n.a + n.b) / 2 - 0.5);
const splitX = (n: T) => (n.children.length ? n.children[0].xf : L);
/* position of a node's stream at x, including the departure from its parent's centre */
const vAt = (n: T, x: number): number => { if (!n.parent) return 0; const own = centre(n, x); if (x >= n.xf + TRANS) return own; const p = vAt(n.parent, x); return p + (own - p) * smooth((x - n.xf) / TRANS); };
const routeV = (leaf: T, x: number): number => { let n: T = leaf; while (n.parent && n.xf > x) n = n.parent; return vAt(n, x); };
const polyline = (n: T) => { const x0 = n.xf, x1 = splitX(n); const xe = Math.min(x0 + TRANS, x1); const pts = [iso(x0, vAt(n, x0)), iso(xe, vAt(n, xe)), iso(x1, vAt(n, x1))]; return "M" + pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" L"); };

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

  const minX = -widthAt(L) / 2 - 24, maxX = widthAt(L) / 2 + 6, minY = -6, maxY = L + 8;
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
        return <path key={n.id} d={polyline(n)} fill="none" stroke={on ? "#e8eef4" : colorOf(n)} strokeWidth={st === "open" ? 0.32 : 1.05} strokeLinecap="round" strokeLinejoin="round"
          onMouseEnter={() => n.kind === "leaf" && setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: n.kind === "leaf" ? "default" : undefined }} />; })}
      {/* fork markers where a taken route branches */}
      {all.filter((n) => n.parent && n.kind !== "rest" && status(n) !== "open" && n.xf >= XF.t24).map((n) => { const [cx, cy] = iso(n.xf, vAt(n.parent!, n.xf), 0.2); return <circle key={`f-${n.id}`} cx={cx} cy={cy} r={0.55} fill="#0e1116" stroke={colorOf(n)} strokeWidth={0.3} />; })}
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
        {[24, 36, 48, 72].map((s) => { const y = XLM[s], w = widthAt(L) / 2 + 2;
          return <g key={s}><line x1={-w} y1={y} x2={w} y2={y} stroke="#e8eef4" strokeOpacity={0.14} strokeWidth={0.3} strokeDasharray="0.8 1" /><text x={-w - 1.5} y={y + 1} fontSize={2.9} fill={MUTED} textAnchor="end" letterSpacing={0.2}>{s} hpf</text>{s === 24 && <text x={-w - 1.5} y={y + 4} fontSize={2.0} fill={MUTED} textAnchor="end" fontStyle="italic">schematic</text>}</g>; })}
        <rect x={-2.2} y={-1.6} width={4.4} height={1.6} fill="#2b3442" />
        {rows.map((x, ri) => taken.map((l) => { const [cx, cy] = iso(x, routeV(l, x)); return <circle key={`${ri}-${l.id}`} cx={cx} cy={cy} r={0.55} fill="#e8eef4" stroke={colorOf(l)} strokeWidth={0.3} />; }))}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const d = l.data!; const p = [centre(l, L) + 1, L + 3] as const;
          const pct = (c: string, s: number) => `${((d.share[c]?.[String(s)] ?? 0) * 100).toFixed(2)}%`;
          const lines = [d.pooled ? `${d.label} (${d.pooled} rarer types)` : d.label, `tissue: ${l.tissue} · forks at ${Object.entries(XLM).find(([, v]) => v === l.xf)?.[0]} hpf`, `wild type ${pct("wildtype", 36)} · ${pct("wildtype", 48)} · ${pct("wildtype", 72)}`];
          if (isWT) lines.push(`route: ${routes.wt.tops.has(l.id) ? "taken by the wild-type flotilla" : "potential"}`);
          else { const st = status(l); lines.push(`${cond} ${pct(cond, 36)} · ${pct(cond, 48)} · ${pct(cond, 72)} → ${st}`); if (st === "new") { const pr = programOf(l.tissue); lines.push(pr ? `dominant program in ${l.tissue}: ${PROG_LABEL[pr]} (loading ${FL.responses[cond][l.tissue!].loading[pr].toFixed(2)})` : `no Phase-5 program data for ${l.tissue}`); } }
          const w = Math.max(...lines.map((q) => q.length)) * 1.4 + 3; const px = Math.min(Math.max(p[0], vb.x + 2), vb.x + vb.w - w - 2); const py = Math.min(p[1], vb.y + vb.h - lines.length * 2.9 - 4);
          return <g pointerEvents="none"><rect x={px - 1} y={py} width={w} height={lines.length * 2.9 + 1.8} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={px + 0.6} y={py + 2.6 + i * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
