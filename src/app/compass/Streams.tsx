"use client";
/**
 * Branching streams — a strict tree of thin currents on black.
 *
 * DATA (data/delta.json, ChemFish CHEM10): per condition and landmark (36/48/72 hpf) the mean
 * per-embryo share of cells in each cell type. The flotilla is ten dots: at 72 hpf they occupy the
 * ten largest streams of the condition, and TAKEN is each dot's whole route back to the dock (blue).
 * Streams drawn: every stream any condition ever takes, plus up to three potential streams per
 * tissue (largest shares); a stream forks off its tissue trunk at the landmark where any condition
 * first puts >= 0.25% of cells in it (never-used streams: deterministic pseudo-random landmark).
 * The tree is laid out so the river only widens at forks and no branch ever crosses another:
 * bundles keep a fixed order at every landmark, the trunk sits centred, children fan outward with the
 * outermost forking earliest, and slots are wider than any stroke.
 * Drug side: a newly taken branch is coloured by the Phase-5 program the drug engages most in that
 * tissue (largest |gene-space loading|, data/flotilla.json); tissues without program data are amber.
 * 24 hpf is a schematic landmark (no ChemFish data before 36 hpf).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/delta.json";
import flot from "./data/flotilla.json";

type Node = { id: string; label: string; level: "tissue" | "celltype"; parent?: string; pooled?: number; share: Record<string, Record<string, number>> };
type Delta = { stages: number[]; used: number; conds: string[]; n_embryos: Record<string, Record<string, number>>; nodes: Node[] };
const D = raw as unknown as Delta; const S = D.stages; const USED = D.used; const TOPN = 10; const LAST = S[S.length - 1];
const FL = flot as unknown as { program_order: string[]; programs: Record<string, { label: string; tissues: string[] }>; responses: Record<string, Record<string, { loading: Record<string, number> }>> };
const PROG_COLOR: Record<string, string> = { neural: "#35c4b5", mesenchymal: "#b794f4", module3: "#d6b26a", epithelial: "#f472b6", "fast-muscle": "#f59e0b" };
const PROG_LABEL: Record<string, string> = { neural: "neural differentiation", mesenchymal: "mesenchymal arrest", module3: "module 3 (provisional)", epithelial: "epithelial / fin-fold", "fast-muscle": "fast-muscle stress" };
const AMBER = "#c98a3a";
const PHI = 25 * Math.PI / 180, CP = Math.cos(PHI), SP_ = Math.sin(PHI);
const iso = (u: number, v: number, z = 0) => { const x = u * CP - v * SP_, y = u * SP_ + v * CP; return [(x - y) * 0.866, (x + y) * 0.5 - z] as const; };
const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");
const BLUE = "#4f9fe6", GREY = "#333b47", INK = "#c7d0da", MUTED = "#6e7a88";
const L = 120, XK = [18, 40, 76, 118], WK = [26, 62, 96, 128];
const XLM: Record<number, number> = { 24: 18, 36: 40, 48: 76, 72: 118 };
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
const widthAt = (x: number) => { if (x <= 0) return 4; if (x <= XK[0]) return 4 + (x / XK[0]) * (WK[0] - 4); for (let i = 1; i < XK.length; i++) if (x <= XK[i]) return WK[i - 1] + ((x - XK[i - 1]) / (XK[i] - XK[i - 1])) * (WK[i] - WK[i - 1]); return WK[3]; };

type Stream = { id: string; label: string; tissue: string; pooled?: number; fork: number; share: Record<string, Record<string, number>>; y: number[]; pts: [number, number][]; trunk: boolean };
const topOf = (c: string, pool: Node[]) => new Set(pool.slice().sort((a, b) => (b.share[c]?.[String(LAST)] ?? 0) - (a.share[c]?.[String(LAST)] ?? 0)).slice(0, TOPN).map((n) => n.id));
function build() {
  const cts = D.nodes.filter((n) => n.level === "celltype");
  const everTaken = new Set<string>(); D.conds.forEach((c) => topOf(c, cts).forEach((id) => everTaken.add(id)));
  const tissues = D.nodes.filter((n) => n.level === "tissue").filter((t) => (t.share.wildtype["36"] ?? 0) >= 0.004 || cts.some((k) => k.parent === t.id && everTaken.has(k.id)));
  const leaves: Stream[] = [];
  for (const t of tissues) {
    const kids = cts.filter((k) => k.parent === t.id);
    const keep = new Set<string>(kids.filter((k) => everTaken.has(k.id) || k.id.endsWith(":other")).map((k) => k.id));
    kids.filter((k) => !keep.has(k.id)).sort((a, b) => Math.max(...Object.values(b.share).flatMap((v) => Object.values(v))) - Math.max(...Object.values(a.share).flatMap((v) => Object.values(v)))).slice(0, 3).forEach((k) => keep.add(k.id));
    for (const k of kids.filter((k) => keep.has(k.id))) {
      const first = S.find((s) => D.conds.some((c) => (k.share[c]?.[String(s)] ?? 0) >= USED));
      const fork = k.id.endsWith(":other") ? 36 : first ?? [36, 48, 72][Math.floor(hash(k.id) * 3)];
      leaves.push({ id: k.id, label: k.label, tissue: t.label, pooled: k.pooled, fork, share: k.share, y: [], pts: [], trunk: false });
    }
  }
  const torder = tissues.map((t) => t.label).sort((a, b) => hash(a) - hash(b));
  for (const t of torder) { const ls = leaves.filter((l) => l.tissue === t); const tr = ls.find((l) => l.id.endsWith(":other")) ?? ls.slice().sort((a, b) => a.fork - b.fork || (b.share.wildtype["36"] ?? 0) - (a.share.wildtype["36"] ?? 0))[0]; if (tr) { tr.trunk = true; tr.fork = 36; } }
  const SP = 1.3;
  const arrange = (ls: Stream[]) => { const tr = ls.find((l) => l.trunk); const kids = ls.filter((l) => !l.trunk).sort((a, b) => a.fork - b.fork || hash(a.id) - hash(b.id)); const left: Stream[] = [], right: Stream[] = []; kids.forEach((k, i) => (i % 2 ? right : left).push(k)); return [...left.reverse(), ...(tr ? [tr] : []), ...right]; };
  XK.forEach((_, ki) => {
    const W = WK[ki];
    if (ki === 0) { torder.forEach((t, i) => { const y = -W / 2 + ((i + 0.5) / torder.length) * W; leaves.filter((l) => l.tissue === t).forEach((l) => (l.y[0] = y)); }); return; }
    const stage = [36, 48, 72][ki - 1];
    const vis = torder.map((t) => arrange(leaves.filter((l) => l.tissue === t && l.fork <= stage)));
    const nVis = vis.reduce((a, v) => a + v.length, 0); const gap = Math.max(2.0, (W - nVis * SP) / Math.max(1, torder.length - 1));
    let y = 0;
    vis.forEach((ls, ti) => { ls.forEach((l, i) => { l.y[ki] = y + (i + 0.5) * SP; }); y += ls.length * SP + gap * (0.6 + 0.8 * hash(torder[ti] + ki)); });
    const all = vis.flat(); const lo = Math.min(...all.map((l) => l.y[ki])), hi = Math.max(...all.map((l) => l.y[ki]));
    all.forEach((l) => { l.y[ki] = -W / 2 + ((l.y[ki] - lo) / Math.max(1e-6, hi - lo)) * W; });
    leaves.filter((l) => l.fork > stage).forEach((l) => { const tr = leaves.find((q) => q.tissue === l.tissue && q.trunk); l.y[ki] = tr ? tr.y[ki] : l.y[ki - 1]; });
  });
  // schematic 1 -> 4 -> tissues upstream (no data before 36 hpf); groups are consecutive quarters of the bundle order
  const groups = 4; const groupOf = (t: string) => Math.floor((torder.indexOf(t) / torder.length) * groups);
  const gy = (g: number) => -6 + ((g + 0.5) / groups) * 12;
  for (const l of leaves) {
    const tr = leaves.find((q) => q.tissue === l.tissue && q.trunk) ?? l; const ki = XK.indexOf(XLM[l.fork]);
    const pts: [number, number][] = [[6, 0], [11, gy(groupOf(l.tissue))], [XK[0], l.y[0]]];
    for (let k = 1; k < XK.length; k++) {
      if (k < ki) pts.push([XK[k], tr.y[k]]);
      else if (k === ki && l !== tr) { const sib = leaves.filter((q) => q.tissue === l.tissue && q.fork <= [36, 48, 72][k - 1]); const spread = Math.max(...sib.map((q) => Math.abs(q.y[k] - tr.y[k])), 1e-6); const outer = Math.abs(l.y[k] - tr.y[k]) / spread;
        const fx = XK[k] - 4 - outer * 14; const f = (fx - XK[k - 1]) / (XK[k] - XK[k - 1]); pts.push([fx, tr.y[k - 1] + (tr.y[k] - tr.y[k - 1]) * f], [XK[k], l.y[k]]); }
      else pts.push([XK[k], l.y[k]]);
    }
    l.pts = pts;
  }
  return { leaves, tissues: torder, groups, gy, groupOf };
}
function centerPath(xs: number[], ys: number[]) {
  let d = ""; xs.forEach((x, i) => { const [px, py] = iso(x, ys[i]); if (i === 0) { d += `M${px.toFixed(2)},${py.toFixed(2)}`; return; }
    const dx = (x - xs[i - 1]) / 2.2; const [c1x, c1y] = iso(xs[i - 1] + dx, ys[i - 1]), [c2x, c2y] = iso(x - dx, ys[i]); d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`; });
  return d;
}
const yAt = (pts: [number, number][], x: number) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const f = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f; } return pts[pts.length - 1][1]; };
const slicePts = (pts: [number, number][], x0: number, x1: number): [number, number][] => { const out: [number, number][] = [[x0, yAt(pts, x0)]]; for (const p of pts) if (p[0] > x0 + 1e-6 && p[0] < x1 - 1e-6) out.push(p); out.push([x1, yAt(pts, x1)]); return out; };

export default function Streams({ cond, title, subtitle, children }: { cond: string; title: string; subtitle: string; children?: React.ReactNode }) {
  const { leaves, tissues, groups, gy } = useMemo(build, []);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const isWT = cond === "wildtype";
  const top = useMemo(() => ({ wt: topOf("wildtype", leaves as unknown as Node[]), cond: topOf(cond, leaves as unknown as Node[]) }), [leaves, cond]);
  // program a drug engages most in a tissue (largest |loading|), or null when the tissue has no Phase-5 data
  const programOf = (tissue: string) => { const r = FL.responses[cond]?.[tissue]; if (!r) return null; return Object.entries(r.loading).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0]; };
  const routeStatus = (l: Stream, s: number) => { const carries = (set: Set<string>) => leaves.some((q) => set.has(q.id) && (q.id === l.id || (l.trunk && q.tissue === l.tissue && q.fork > s)));
    const w = carries(top.wt), d = carries(top.cond); return isWT ? (w ? "taken" : "open") : d && !w ? "new" : d ? "taken" : "open"; };
  const colorOf = (l: Stream, st: string) => (st === "taken" ? BLUE : st === "new" ? (PROG_COLOR[programOf(l.tissue) ?? ""] ?? AMBER) : GREY);
  const tissueTaken = (tissue: string) => leaves.some((l) => l.tissue === tissue && top.cond.has(l.id));
  const tissueNew = (tissue: string) => !isWT && tissueTaken(tissue) && !leaves.some((l) => l.tissue === tissue && top.wt.has(l.id));
  const engaged = useMemo(() => isWT ? [] : Array.from(new Set(leaves.filter((l) => routeStatus(l, LAST) === "new").map((l) => programOf(l.tissue) ?? "none"))), [leaves, top, cond]);   // eslint-disable-line react-hooks/exhaustive-deps

  const corners = [iso(0, -4), iso(L, -WK[3] / 2 - 3), iso(L, WK[3] / 2 + 8), iso(0, 4), iso(XLM[36], -WK[1] / 2 - 4)];
  const minX = Math.min(...corners.map((c) => c[0])) - 6, maxX = Math.max(...corners.map((c) => c[0])) + 14, minY = Math.min(...corners.map((c) => c[1])) - 9, maxY = Math.max(...corners.map((c) => c[1])) + 6;
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
      <path d={centerPath([0, 6], [0, 0])} stroke={BLUE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {Array.from({ length: groups }, (_, g) => { const tk = tissues.some((tn, i) => Math.floor((i / tissues.length) * groups) === g && tissueTaken(tn));
        return <path key={g} d={centerPath([6, 11], [0, gy(g)])} stroke={tk ? BLUE : GREY} strokeWidth={tk ? 1.2 : 0.35} fill="none" strokeLinecap="round" />; })}
      {tissues.map((tn) => { const tr = leaves.find((q) => q.tissue === tn && q.trunk); if (!tr) return null; const tk = tissueTaken(tn); const nw = tissueNew(tn); const sp = slicePts(tr.pts, 11, XK[1]);
        return <path key={tn} d={centerPath(sp.map((p) => p[0]), sp.map((p) => p[1]))} stroke={nw ? (PROG_COLOR[programOf(tn) ?? ""] ?? AMBER) : tk ? BLUE : GREY} strokeWidth={tk ? 1.0 : 0.32} fill="none" strokeLinecap="round" />; })}
      {leaves.map((l) => [1, 2, 3].map((ki) => { const s = [36, 48, 72][ki - 1]; if (l.fork > s) return null; const st = routeStatus(l, s); const on = hover === l.id; const sp = slicePts(l.pts, XK[ki - 1], XK[ki]);
        return <path key={`${l.id}-${ki}`} d={centerPath(sp.map((p) => p[0]), sp.map((p) => p[1]))} stroke={on ? "#e8eef4" : colorOf(l, st)} strokeWidth={st === "open" ? 0.32 : 1.0} fill="none" strokeLinecap="round"
          onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }} />; }))}
      {leaves.filter((l) => top.cond.has(l.id) && !l.trunk).map((l) => { const fp = l.pts.find((p, i) => i > 2 && !XK.includes(p[0])) ?? l.pts[2]; const [cx, cy] = iso(fp[0], fp[1], 0.2); return <circle key={l.id} cx={cx} cy={cy} r={0.5} fill="#0e1116" stroke={colorOf(l, routeStatus(l, LAST))} strokeWidth={0.3} />; })}
    </g>
  ), [leaves, tissues, top, hover, cond]);   // eslint-disable-line react-hooks/exhaustive-deps

  const ROW_T = 4.4, TRAVEL = 22; const rows: number[] = [];
  for (let k = 0; k <= Math.ceil(TRAVEL / ROW_T); k++) { const x = (((t / ROW_T) % 1 + k) / (TRAVEL / ROW_T)) * (L + 8) - 4; if (x > -2 && x < L + 1) rows.push(x); }

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
        {[24, 36, 48, 72].map((s) => { const x = XLM[s], w = widthAt(x) / 2 + 2; const a = iso(x, -w), b = iso(x, w), lb = iso(x, -w - 3.5);
          return <g key={s}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8eef4" strokeOpacity={0.18} strokeWidth={0.3} strokeDasharray="0.8 1" /><text x={lb[0]} y={lb[1] + 1} fontSize={2.9} fill={MUTED} textAnchor="middle" letterSpacing={0.2}>{s} hpf{s === 24 ? " ·" : ""}</text>{s === 24 && <text x={lb[0]} y={lb[1] + 4.2} fontSize={2.0} fill={MUTED} textAnchor="middle" fontStyle="italic">schematic</text>}</g>; })}
        <polygon points={P([iso(-1, -2.5, 1), iso(1.5, -2.5, 1), iso(1.5, 2.5, 1), iso(-1, 2.5, 1)])} fill="#2b3442" />
        {/* flotillas: ten dots, one per taken stream, each following its own route */}
        {rows.map((x, ri) => {
          if (x < 6) { const [cx, cy] = iso(Math.max(0.3, x), 0, 0.2); return <circle key={ri} cx={cx} cy={cy} r={0.55} fill="#e8eef4" />; }
          return leaves.filter((l) => top.cond.has(l.id)).map((l, i) => { const [cx, cy] = iso(x, yAt(l.pts, x), 0.2 + 0.12 * Math.sin(t * 2 + i)); return <circle key={`${ri}-${l.id}`} cx={cx} cy={cy} r={0.5} fill="#e8eef4" stroke={colorOf(l, routeStatus(l, LAST))} strokeWidth={0.28} />; });
        })}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const p = iso(L + 2, l.y[3], 8);
          const pct = (c: string, s: number) => `${((l.share[c]?.[String(s)] ?? 0) * 100).toFixed(2)}%`;
          const lines = [l.pooled ? `${l.label} (${l.pooled} rarer types)` : l.label, `tissue: ${l.tissue} · forks at ${l.fork} hpf`, `wild type ${pct("wildtype", 36)} · ${pct("wildtype", 48)} · ${pct("wildtype", 72)}`];
          if (isWT) lines.push(`route: ${top.wt.has(l.id) ? "taken by the wild-type flotilla" : "potential"}`);
          else { const st = routeStatus(l, LAST); lines.push(`${cond} ${pct(cond, 36)} · ${pct(cond, 48)} · ${pct(cond, 72)} → ${st}`); if (st === "new") { const pr = programOf(l.tissue); lines.push(pr ? `dominant program in ${l.tissue}: ${PROG_LABEL[pr]} (loading ${FL.responses[cond][l.tissue].loading[pr].toFixed(2)})` : `no Phase-5 program data for ${l.tissue}`); } }
          const w = Math.max(...lines.map((q) => q.length)) * 1.4 + 3; const px = Math.min(p[0], vb.x + vb.w - w - 2);
          return <g pointerEvents="none"><rect x={px - 1} y={p[1] - 3 - lines.length * 2.9} width={w} height={lines.length * 2.9 + 1.8} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={px + 0.6} y={p[1] - 1.2 - (lines.length - 1 - i) * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
