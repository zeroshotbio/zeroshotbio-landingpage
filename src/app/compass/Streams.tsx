"use client";
/**
 * Branching streams — the delta as a network of thin currents on black.
 *
 * DATA (data/delta.json, ChemFish CHEM10): 226 cell-type streams under 38 tissues; per condition and
 * landmark (36/48/72 hpf) the mean per-embryo share of cells in each. The flotilla has TEN boats.
 * At each landmark the boats take the ten largest streams by that condition's share — those streams
 * are TAKEN (blue); every other stream is a potential path (grey). A stream forks off its tissue at
 * the landmark where any condition first puts >= 0.25% of cells in it; streams no condition ever uses
 * fork at a deterministic pseudo-random landmark (their timing carries no data). The network is built
 * from wild type + drugs jointly and is IDENTICAL in both panels; only boats and colours differ.
 * Drug side: streams the drug takes that wild type does not are orange.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/delta.json";

type Node = { id: string; label: string; level: "tissue" | "celltype"; parent?: string; pooled?: number; share: Record<string, Record<string, number>> };
type Delta = { stages: number[]; used: number; conds: string[]; n_embryos: Record<string, Record<string, number>>; nodes: Node[] };
const D = raw as unknown as Delta; const S = D.stages; const USED = D.used; const TOPN = 10;
const PHI = 25 * Math.PI / 180, CP = Math.cos(PHI), SP = Math.sin(PHI);
const iso = (u: number, v: number, z = 0) => { const x = u * CP - v * SP, y = u * SP + v * CP; return [(x - y) * 0.866, (x + y) * 0.5 - z] as const; };
const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");
const BLUE = "#4f9fe6", GREY = "#333b47", ORANGE = "#e9954f", INK = "#c7d0da", MUTED = "#6e7a88";
const L = 120, XK = [18, 40, 76, 118], WK = [30, 76, 112, 150];                 // knots: tissue fork (schematic), 36, 48, 72 hpf
const XLM: Record<number, number> = { 36: 40, 48: 76, 72: 118 };
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
const widthAt = (x: number) => { if (x <= 0) return 6; if (x <= XK[0]) return 6 + (x / XK[0]) * (WK[0] - 6); for (let i = 1; i < XK.length; i++) if (x <= XK[i]) return WK[i - 1] + ((x - XK[i - 1]) / (XK[i] - XK[i - 1])) * (WK[i] - WK[i - 1]); return WK[3]; };
const stageAt = (x: number) => (x < XLM[48] ? 36 : x < XLM[72] ? 48 : 72);

type Stream = { id: string; label: string; tissue: string; pooled?: number; fork: number; share: Record<string, Record<string, number>>; y: number[]; pts: [number, number][]; trunk: boolean };
function build() {
  const tissues = D.nodes.filter((n) => n.level === "tissue");
  const leaves: Stream[] = [];
  for (const t of tissues) {
    const kids = D.nodes.filter((n) => n.level === "celltype" && n.parent === t.id);
    for (const k of kids) {
      const first = S.find((s) => D.conds.some((c) => (k.share[c]?.[String(s)] ?? 0) >= USED));
      const fork = k.id.endsWith(":other") ? 36 : first ?? [36, 48, 72][Math.floor(hash(k.id) * 3)];
      leaves.push({ id: k.id, label: k.label, tissue: t.label, pooled: k.pooled, fork, share: k.share, y: [], pts: [], trunk: false });
    }
  }
  // tissue order: by wild-type share, then scrambled a little so the delta reads organic
  const torder = tissues.map((t) => t.label).sort((a, b) => hash(a) - hash(b));
  leaves.sort((a, b) => torder.indexOf(a.tissue) - torder.indexOf(b.tissue) || a.fork - b.fork || hash(a.id) - hash(b.id));
  // one trunk stream per tissue (its pooled ":other" stream, else its largest 36-hpf stream)
  for (const t of torder) { const ls = leaves.filter((l) => l.tissue === t); const tr = ls.find((l) => l.id.endsWith(":other")) ?? ls.slice().sort((a, b) => a.fork - b.fork || (b.share.wildtype["36"] ?? 0) - (a.share.wildtype["36"] ?? 0))[0]; if (tr) { tr.trunk = true; tr.fork = 36; } }
  // y at each knot: tissue BUNDLES with dark gaps between them; streams not yet forked ride their trunk
  const SP = 0.5;
  // bundle order: trunk in the middle, children alternating outward, earliest fork outermost
  const arrange = (ls: Stream[]) => { const tr = ls.find((l) => l.trunk); const kids = ls.filter((l) => !l.trunk).sort((a, b) => a.fork - b.fork || hash(a.id) - hash(b.id)); const left: Stream[] = [], right: Stream[] = []; kids.forEach((k, i) => (i % 2 ? right : left).push(k)); return [...left.reverse(), ...(tr ? [tr] : []), ...right]; };
  XK.forEach((_, ki) => {
    const W = WK[ki];
    if (ki === 0) { torder.forEach((t, i) => { const y = -W / 2 + ((i + 0.5) / torder.length) * W + (hash(t) - 0.5) * 0.8; leaves.filter((l) => l.tissue === t).forEach((l) => (l.y[0] = y)); }); return; }
    const stage = [36, 48, 72][ki - 1];
    const vis = torder.map((t) => arrange(leaves.filter((l) => l.tissue === t && l.fork <= stage)));
    const nVis = vis.reduce((a, v) => a + v.length, 0); const gap = Math.max(1.5, (W - nVis * SP) / Math.max(1, torder.length - 1));
    let y = -W / 2;
    vis.forEach((ls, ti) => { ls.forEach((l, i) => { l.y[ki] = y + (i + 0.5) * SP + (hash(l.id + ki) - 0.5) * 0.08; }); y += ls.length * SP + gap * (0.5 + 1.0 * hash(torder[ti] + ki)); });
    // normalise the randomised stack so it spans exactly [-W/2, W/2]
    const all = vis.flat(); const lo = Math.min(...all.map((l) => l.y[ki])), hi = Math.max(...all.map((l) => l.y[ki]));
    all.forEach((l) => { l.y[ki] = -W / 2 + ((l.y[ki] - lo) / Math.max(1e-6, hi - lo)) * W; });
    leaves.filter((l) => l.fork > stage).forEach((l) => { const tr = leaves.find((q) => q.tissue === l.tissue && q.trunk); l.y[ki] = tr ? tr.y[ki] : l.y[ki - 1]; });
  });
  // knot list per stream: trunk points up to its fork, a staggered fork point a little before the landmark, then its own course
  for (const l of leaves) {
    const tr = leaves.find((q) => q.tissue === l.tissue && q.trunk) ?? l; const ki = XK.indexOf(XLM[l.fork]);
    const pts: [number, number][] = [[8, 0], [XK[0], l.y[0]]];
    for (let k = 1; k < XK.length; k++) {
      if (k < ki) pts.push([XK[k], tr.y[k]]);
      else if (k === ki && l !== tr) { const sib = leaves.filter((q) => q.tissue === l.tissue && q.fork <= [36, 48, 72][k - 1]); const spread = Math.max(...sib.map((q) => Math.abs(q.y[k] - tr.y[k])), 1e-6); const outer = Math.abs(l.y[k] - tr.y[k]) / spread;
        const fx = XK[k] - 3 - outer * 12; const f = (fx - XK[k - 1]) / (XK[k] - XK[k - 1]); pts.push([fx, tr.y[k - 1] + (tr.y[k] - tr.y[k - 1]) * f], [XK[k], l.y[k]]); }
      else pts.push([XK[k], l.y[k]]);
    }
    l.pts = pts;
  }
  return { leaves, tissues: torder };
}
function centerPath(xs: number[], ys: number[]) {
  let d = ""; xs.forEach((x, i) => { const [px, py] = iso(x, ys[i]); if (i === 0) { d += `M${px.toFixed(2)},${py.toFixed(2)}`; return; }
    const dx = (x - xs[i - 1]) / 2.2; const [c1x, c1y] = iso(xs[i - 1] + dx, ys[i - 1]), [c2x, c2y] = iso(x - dx, ys[i]); d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`; });
  return d;
}
const yAt = (pts: [number, number][], x: number) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const f = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f; } return pts[pts.length - 1][1]; };
const slicePts = (pts: [number, number][], x0: number, x1: number): [number, number][] => { const out: [number, number][] = [[x0, yAt(pts, x0)]]; for (const p of pts) if (p[0] > x0 + 1e-6 && p[0] < x1 - 1e-6) out.push(p); out.push([x1, yAt(pts, x1)]); return out; };
function Boat({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  const s = 0.9; const hull: [number, number][] = [[-2.6 * s, -1.15 * s], [1.0 * s, -1.15 * s], [2.9 * s, 0], [1.0 * s, 1.15 * s], [-2.6 * s, 1.15 * s]];
  const at = (h: number) => hull.map(([dx, dy]) => iso(x + dx, y + dy, z + h)); const base = at(0), top = at(0.9 * s);
  const [mx, my] = iso(x - 0.4 * s, y, z + 0.9 * s), [tx, ty] = iso(x - 0.4 * s, y, z + 4.2 * s), [px, py] = iso(x + 2 * s, y, z + 3.3 * s);
  return (<g><polygon points={P([base[3], base[4], top[4], top[3]])} fill="#8a97a6" /><polygon points={P([base[2], base[3], top[3], top[2]])} fill="#5f6b78" /><polygon points={P(top)} fill="#e8eef4" />
    <line x1={mx} y1={my} x2={tx} y2={ty} stroke={INK} strokeWidth={0.28} /><polygon points={`${tx},${ty} ${px},${py} ${tx},${ty + 1.4}`} fill={color} /></g>);
}

export default function Streams({ cond, title, subtitle, children }: { cond: string; title: string; subtitle: string; children?: React.ReactNode }) {
  const { leaves, tissues } = useMemo(build, []);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const isWT = cond === "wildtype";
  // the ten streams the flotilla takes at each landmark, per condition
  // the ten boats = the ten largest streams at the final landmark; a boat's route is that stream plus
  // its tissue trunk upstream of the fork, so "taken" is a whole path from dock to mouth
  const LAST = S[S.length - 1];
  const top = useMemo(() => { const f = (c: string) => new Set(leaves.slice().sort((a, b) => (b.share[c]?.[String(LAST)] ?? 0) - (a.share[c]?.[String(LAST)] ?? 0)).slice(0, TOPN).map((l) => l.id)); return { wt: f("wildtype"), cond: f(cond) }; }, [leaves, cond]);
  const routeStatus = (l: Stream, s: number) => {   // status of stream l's segment ending at landmark s
    const carries = (set: Set<string>) => leaves.some((q) => set.has(q.id) && (q.id === l.id || (l.trunk && q.tissue === l.tissue && q.fork > s)));
    const w = carries(top.wt), d = carries(top.cond); return isWT ? (w ? "taken" : "open") : d && !w ? "new" : d ? "taken" : "open"; };
  const status = routeStatus;
  const colorOf = (st: string) => (st === "taken" ? BLUE : st === "new" ? ORANGE : GREY);
  const tissueTaken = (tissue: string) => leaves.some((l) => l.tissue === tissue && top.cond.has(l.id));

  const corners = [iso(0, -5), iso(L, -WK[3] / 2 - 3), iso(L, WK[3] / 2 + 8), iso(0, 5), iso(L + 6, 0), iso(XLM[36], -WK[1] / 2 - 4)];
  const minX = Math.min(...corners.map((c) => c[0])) - 6, maxX = Math.max(...corners.map((c) => c[0])) + 14, minY = Math.min(...corners.map((c) => c[1])) - 9, maxY = Math.max(...corners.map((c) => c[1])) + 6;
  // wheel = zoom about the cursor, drag = pan (viewBox transform; preserveAspectRatio "meet" mapping)
  const Z0 = 0.8; const home = { x: minX + ((maxX - minX) * (1 - Z0)) / 2, y: minY + ((maxY - minY) * (1 - Z0)) / 2 + 4, w: (maxX - minX) * Z0, h: (maxY - minY) * Z0 };   // open a little zoomed in
  const box = useRef(home); const [vb, setVb] = useState(box.current);
  const svgRef = useRef<SVGSVGElement>(null); const drag = useRef<{ x: number; y: number } | null>(null);
  const toUser = (cx: number, cy: number) => { const r = svgRef.current!.getBoundingClientRect(); const b = box.current; const k = Math.min(r.width / b.w, r.height / b.h); const ox = (r.width - b.w * k) / 2, oy = (r.height - b.h * k) / 2; return [b.x + (cx - r.left - ox) / k, b.y + (cy - r.top - oy) / k, k] as const; };
  useEffect(() => { const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const [ux, uy] = toUser(e.clientX, e.clientY); const f = Math.exp(e.deltaY * 0.0012); const b = box.current; const nw = Math.min(Math.max(b.w * f, 20), 4 * (maxX - minX)); const nh = nw * (b.h / b.w);
      box.current = { x: ux - (ux - b.x) * (nw / b.w), y: uy - (uy - b.y) * (nh / b.h), w: nw, h: nh }; setVb(box.current); };
    el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => { if (!drag.current) return; const k = toUser(0, 0)[2]; const b = box.current; box.current = { ...b, x: b.x - (e.clientX - drag.current.x) / k, y: b.y - (e.clientY - drag.current.y) / k }; drag.current = { x: e.clientX, y: e.clientY }; setVb(box.current); };
  const onUp = () => { drag.current = null; };

  /* static geometry, memoized per condition */
  const streams = useMemo(() => (
    <g>
      {/* trunk and tissue streams (schematic reach) */}
      <path d={centerPath([0, 8], [0, 0])} stroke={BLUE} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {tissues.map((tn) => { const tr = leaves.find((q) => q.tissue === tn && q.trunk); if (!tr) return null; const tk = tissueTaken(tn); const nw = !isWT && tk && !leaves.some((l) => l.tissue === tn && top.wt.has(l.id)); const sp = slicePts(tr.pts, 8, XK[1]);
        return <path key={tn} d={centerPath(sp.map((p) => p[0]), sp.map((p) => p[1]))} stroke={nw ? ORANGE : tk ? BLUE : GREY} strokeWidth={tk ? 1.4 : 0.45} fill="none" strokeLinecap="round" />; })}
      {/* cell-type streams: one segment per landmark interval so the colour can flip at a fork */}
      {leaves.map((l) => [1, 2, 3].map((ki) => { const s = [36, 48, 72][ki - 1]; if (l.fork > s || (l.trunk && ki === 1 && false)) return null; const st = status(l, s); const on = hover === l.id;
        const sp = slicePts(l.pts, XK[ki - 1], XK[ki]);
        return <path key={`${l.id}-${ki}`} d={centerPath(sp.map((p) => p[0]), sp.map((p) => p[1]))} stroke={on ? "#e8eef4" : colorOf(st)} strokeWidth={st === "open" ? 0.45 : 1.5} fill="none" strokeLinecap="round"
          onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }} />; }))}
      {/* fork markers where a stream becomes taken */}
      {leaves.filter((l) => top.cond.has(l.id) && !l.trunk).map((l) => { const fp = l.pts.find((p, i) => i > 0 && !XK.includes(p[0])) ?? l.pts[1]; const [cx, cy] = iso(fp[0], fp[1], 0.2); return <circle key={l.id} cx={cx} cy={cy} r={0.55} fill="#0e1116" stroke={colorOf(status(l, LAST))} strokeWidth={0.35} />; })}
    </g>
  ), [leaves, tissues, top, hover, cond]);   // eslint-disable-line react-hooks/exhaustive-deps

  const ROW_T = 4.4, TRAVEL = 22; const rows: number[] = [];
  for (let k = 0; k <= Math.ceil(TRAVEL / ROW_T); k++) { const x = (((t / ROW_T) % 1 + k) / (TRAVEL / ROW_T)) * (L + 8) - 4; if (x > -3 && x < L + 1) rows.push(x); }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: 16, zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>{title}</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>{subtitle}</p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}><span style={{ color: BLUE, fontWeight: 600 }}>■</span> taken{!isWT && <> <span style={{ color: ORANGE, fontWeight: 600, marginLeft: 8 }}>■</span> newly taken</>} <span style={{ color: "#4a5563", fontWeight: 600, marginLeft: 8 }}>■</span> potential</p>
      </div>
      {children}
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onDoubleClick={() => { box.current = home; setVb(box.current); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "grab" }}>
        {streams}
        {S.map((s) => { const x = XLM[s], w = widthAt(x) / 2 + 2; const a = iso(x, -w), b = iso(x, w), lb = iso(x, -w - 3.5);
          return <g key={s}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8eef4" strokeOpacity={0.18} strokeWidth={0.3} strokeDasharray="0.8 1" /><text x={lb[0]} y={lb[1] + 1} fontSize={2.9} fill={MUTED} textAnchor="middle" letterSpacing={0.2}>{s} hpf</text></g>; })}
        <polygon points={P([iso(-1, -3.5, 1), iso(2, -3.5, 1), iso(2, 3.5, 1), iso(-1, 3.5, 1)])} fill="#2b3442" />
        {/* flotillas: ten boats, one per taken stream */}
        {rows.map((x, ri) => {
          if (x < 8) return <Boat key={ri} x={Math.max(0.5, x)} y={0} z={0.15 * Math.sin(t * 2)} color={BLUE} />;
          return leaves.filter((l) => top.cond.has(l.id)).map((l, i) => <Boat key={`${ri}-${l.id}`} x={x - (i % 3) * 1.1} y={yAt(l.pts, x)} z={0.15 * Math.sin(t * 2 + i)} color={colorOf(status(l, LAST))} />);
        })}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const p = iso(L + 2, l.y[3], 8);
          const pct = (c: string, s: number) => `${((l.share[c]?.[String(s)] ?? 0) * 100).toFixed(2)}%`;
          const lines = [l.pooled ? `${l.label} (${l.pooled} rarer types)` : l.label, `tissue: ${l.tissue} · forks at ${l.fork} hpf`, `wild type ${pct("wildtype", 36)} · ${pct("wildtype", 48)} · ${pct("wildtype", 72)}`];
          lines.push(isWT ? `route: ${top.wt.has(l.id) ? "taken by the wild-type flotilla" : "potential"}` : `${cond} ${pct(cond, 36)} · ${pct(cond, 48)} · ${pct(cond, 72)} → ${status(l, LAST)}`);
          const w = Math.max(...lines.map((q) => q.length)) * 1.4 + 3; const px = Math.min(p[0], maxX - w - 2);
          return <g pointerEvents="none"><rect x={px - 1} y={p[1] - 3 - lines.length * 2.9} width={w} height={lines.length * 2.9 + 1.8} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={px + 0.6} y={p[1] - 1.2 - (lines.length - 1 - i) * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
