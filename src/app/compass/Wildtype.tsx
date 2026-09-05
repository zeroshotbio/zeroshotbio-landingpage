"use client";
/**
 * Wild-type reference river — normal zebrafish development as a branching delta.
 *
 * DATA → SCENE: time flows downstream. For every ZSCAPE control-embryo stage (18–96 hpf) the river's
 * cross-section is stacked from the mean per-embryo fraction of cells in each tissue, so channel
 * width = tissue share and a channel branches off its germ layer at the first stage it exists.
 * 0–18 hpf has no single-cell data: that reach is drawn schematically (one channel splitting into
 * the three germ layers) and marked as such. Vertical order (ectoderm / mesoderm / endoderm, then by
 * size) is a fixed reading aid. Boats ride channel centrelines on a loop and appear at branch points.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/wildtype.json";

type WT = { stages: number[]; n_embryos: Record<string, number>; tissues: { name: string; germ_layer: string; fraction: Record<string, number> }[] };
const D = raw as unknown as WT;
const L = 120, W = 45, X18 = 24, TMAX = 96, INK = "#c7d0da", MUTED = "#6e7a88";
const PHI = 25 * Math.PI / 180, CP = Math.cos(PHI), SP = Math.sin(PHI);
// world rotated by PHI about z before the isometric map, so the river runs steeply and fills a tall panel
const iso = (u: number, v: number, z = 0) => { const x = u * CP - v * SP, y = u * SP + v * CP; return [(x - y) * 0.866, (x + y) * 0.5 - z] as const; };
const LAYER = (g: string) => (g.includes("endoderm") ? "endoderm" : g.includes("mesoderm") ? "mesoderm" : "ectoderm");
const LAYER_ORDER = ["ectoderm", "mesoderm", "endoderm"];
const LAYER_COLOR: Record<string, [string, string]> = { ectoderm: ["#1d3a5c", "#244a74"], mesoderm: ["#4a2f3f", "#5d3a4f"], endoderm: ["#1f4a44", "#276056"] };
const LAYER_INK: Record<string, string> = { ectoderm: "#7fb3ff", mesoderm: "#ff9db1", endoderm: "#6fdcc6" };
const xOf = (t: number) => X18 + ((t - 18) / (TMAX - 18)) * (L - X18);
const MIN_SHOW = 0.01, MAJOR = [18, 24, 36, 48, 72, 96];
const GEO = MAJOR;   // ribbon geometry uses the six best-replicated stages (>=65 embryos each); 2-h stages are noisy

type Channel = { name: string; layer: string; top: number[]; bot: number[]; emerge: number; final: number; frac: Record<string, number> };
function buildChannels(): { channels: Channel[]; layerSums: Record<string, number[]> } {
  const S = GEO;
  const shown = D.tissues.filter((t) => Math.max(...Object.values(t.fraction)) >= MIN_SHOW);
  const rows = shown.map((t) => ({ name: t.name, layer: LAYER(t.germ_layer), frac: t.fraction }));
  for (const layer of LAYER_ORDER) {                   // pool the small tissues of each layer into "other"
    const small = D.tissues.filter((t) => LAYER(t.germ_layer) === layer && Math.max(...Object.values(t.fraction)) < MIN_SHOW);
    if (small.length) rows.push({ name: `other ${layer}`, layer, frac: Object.fromEntries(S.map((s) => [String(s), small.reduce((a, t) => a + t.fraction[String(s)], 0)])) });
  }
  rows.sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer) || Math.max(...Object.values(b.frac)) - Math.max(...Object.values(a.frac)));
  const layerSums: Record<string, number[]> = Object.fromEntries(LAYER_ORDER.map((l) => [l, S.map(() => 0)]));
  const channels: Channel[] = rows.map((r) => ({ ...r, top: [], bot: [], emerge: Infinity, final: 0 }));
  S.forEach((s, i) => {
    const tot = rows.reduce((a, r) => a + r.frac[String(s)], 0) || 1;
    let y = 0;
    channels.forEach((c) => {
      const w = (c.frac[String(s)] / tot) * W; c.top[i] = y; c.bot[i] = y + w; y += w;
      layerSums[c.layer][i] += w;
      if (w > 0.15 && c.emerge === Infinity) c.emerge = s;
    });
    channels.forEach((c) => (c.final = c.bot[S.length - 1] - c.top[S.length - 1]));
  });
  return { channels, layerSums };
}
// affine iso projection preserves Béziers, so smooth in world space then project
function ribbon(xs: number[], top: number[], bot: number[]) {
  const seg = (ys: number[], rev: boolean) => {
    const idx = ys.map((_, i) => i); if (rev) idx.reverse();
    let d = "";
    idx.forEach((i, k) => {
      const [px, py] = iso(xs[i], ys[i]);
      if (k === 0) { d += `${rev ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`; return; }
      const j = idx[k - 1]; const dx = (xs[i] - xs[j]) / 2.2;
      const [c1x, c1y] = iso(xs[j] + dx, ys[j]), [c2x, c2y] = iso(xs[i] - dx, ys[i]);
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`;
    });
    return d;
  };
  return seg(top, false) + " " + seg(bot, true) + " Z";
}
function centerAt(c: Channel, xs: number[], x: number) {           // channel centreline y at river position x
  if (x <= xs[0]) return (c.top[0] + c.bot[0]) / 2;
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    const t = c.top[i - 1] + (c.top[i] - c.top[i - 1]) * f, b = c.bot[i - 1] + (c.bot[i] - c.bot[i - 1]) * f; return [(t + b) / 2, b - t] as const; }
  return [(c.top[xs.length - 1] + c.bot[xs.length - 1]) / 2, c.final] as const;
}
function Boat({ x, y, z, size, color }: { x: number; y: number; z: number; size: number; color: string }) {
  const s = size; const hull: [number, number][] = [[-2.6 * s, -1.15 * s], [1.0 * s, -1.15 * s], [2.9 * s, 0], [1.0 * s, 1.15 * s], [-2.6 * s, 1.15 * s]];
  const at = (h: number) => hull.map(([dx, dy]) => iso(x + dx, y + dy, z + h));
  const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");
  const base = at(0), top = at(0.9 * s);
  const [mx, my] = iso(x - 0.4 * s, y, z + 0.9 * s), [tx, ty] = iso(x - 0.4 * s, y, z + 4.2 * s), [px, py] = iso(x + 2 * s, y, z + 3.3 * s);
  return (<g>
    <polygon points={P([base[3], base[4], top[4], top[3]])} fill="#8a97a6" /><polygon points={P([base[2], base[3], top[3], top[2]])} fill="#5f6b78" /><polygon points={P(top)} fill="#e8eef4" />
    <line x1={mx} y1={my} x2={tx} y2={ty} stroke={INK} strokeWidth={0.3 * Math.max(s, 0.6)} /><polygon points={`${tx},${ty} ${px},${py} ${tx},${ty + 1.5 * s}`} fill={color} />
  </g>);
}

export default function Wildtype() {
  const { channels, layerSums } = useMemo(buildChannels, []);
  const xs = useMemo(() => GEO.map(xOf), []);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const PERIOD = 16;
  const corners = [iso(0, 0), iso(L, 0), iso(0, W), iso(L, W)];
  const minX = Math.min(...corners.map((c) => c[0])) - 8, maxX = Math.max(...corners.map((c) => c[0])) + 30;
  const minY = Math.min(...corners.map((c) => c[1])) - 9, maxY = Math.max(...corners.map((c) => c[1])) + 6;
  // schematic 0–18 hpf: one channel from the dock fanning into the three germ layers
  const pre = LAYER_ORDER.map((l, li) => {
    const y0 = LAYER_ORDER.slice(0, li).reduce((a, k) => a + layerSums[k][0], 0), y1 = y0 + layerSums[l][0];
    const root0 = W / 2 - 3.5 + (li * 7) / 3, root1 = root0 + 7 / 3;
    return { l, d: ribbon([0, 9, X18], [root0, (root0 + y0) / 2, y0], [root1, (root1 + y1) / 2, y1]) };
  });
  const phase = (t % PERIOD) / PERIOD;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: 16, zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>Wild-type development</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>the normal flotilla, 0 → 96 hpf · ZSCAPE control embryos, n = {Object.values(D.n_embryos).reduce((a, b) => a + b, 0)}</p>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: INK }}>{LAYER_ORDER.map((l) => <span key={l} style={{ marginRight: 12 }}><span style={{ color: LAYER_INK[l], fontWeight: 600 }}>■</span> {l}</span>)}<span style={{ color: MUTED }}>channel width = share of cells</span></p>
      </div>
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <polygon points={[iso(-4, -6), iso(L + 6, -6), iso(L + 6, W + 6), iso(-4, W + 6)].map(([a, b]) => `${a},${b}`).join(" ")} fill="#131821" />
        {pre.map((p) => <path key={p.l} d={p.d} fill={LAYER_COLOR[p.l][0]} stroke={LAYER_INK[p.l]} strokeOpacity={0.35} strokeWidth={0.25} strokeDasharray="1.2 1" />)}
        {channels.map((c, i) => {
          const on = hover === c.name, tint = LAYER_COLOR[c.layer][i % 2];
          return <path key={c.name} d={ribbon(xs, c.top, c.bot)} fill={on ? LAYER_INK[c.layer] : tint} fillOpacity={on ? 0.55 : 1} stroke={on ? LAYER_INK[c.layer] : "#0e1116"} strokeWidth={on ? 0.4 : 0.22}
            onMouseEnter={() => setHover(c.name)} onMouseLeave={() => setHover(null)} style={{ cursor: "default", transition: "fill-opacity .2s" }} />;
        })}
        {/* stage ticks */}
        {MAJOR.map((s) => { const a = iso(xOf(s), -1.5), b = iso(xOf(s), W + 1.5), l = iso(xOf(s), -4);
          return <g key={s}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8eef4" strokeOpacity={0.22} strokeWidth={0.3} strokeDasharray="0.8 0.8" /><text x={l[0]} y={l[1]} fontSize={2.8} fill={MUTED} textAnchor="middle" letterSpacing={0.2}>{s} hpf</text></g>; })}
        {(() => { const l = iso(2, -4); return <text x={l[0]} y={l[1]} fontSize={2.8} fill={MUTED} textAnchor="middle" letterSpacing={0.2}>0 hpf</text>; })()}
        {(() => { const l = iso(X18 / 2, W + 5); return <text x={l[0]} y={l[1]} fontSize={2.3} fill={MUTED} textAnchor="middle" fontStyle="italic">gastrulation · no single-cell data before 18 hpf</text>; })()}
        {/* dock */}
        <polygon points={[iso(0, -1.5, 1.1), iso(4, -1.5, 1.1), iso(4, W + 1.5, 1.1), iso(0, W + 1.5, 1.1)].map(([a, b]) => `${a},${b}`).join(" ")} fill="#2b3442" />
        {/* channel labels downstream */}
        {channels.filter((c) => c.final > 1.8).map((c) => { const y = (c.top[xs.length - 1] + c.bot[xs.length - 1]) / 2; const p = iso(L + 3, y);
          return <text key={c.name} x={p[0]} y={p[1] + 0.9} fontSize={2.5} fill={hover === c.name ? LAYER_INK[c.layer] : INK} opacity={0.9}>{c.name}</text>; })}
        {/* the normal flotilla: one boat per channel, appearing at its branch point */}
        {[0, 0.5].map((off) => { const px = (((phase + off) % 1) * (L + 6)) - 3; return px < X18 && px > 0 ? <Boat key={off} x={px} y={W / 2} z={0.15 * Math.sin(t * 2 + off)} size={1.05} color="#e8eef4" /> : null; })}
        {channels.filter((c) => c.final >= 0.9).flatMap((c, i) => [0, 0.5].map((off) => {
          const px = (((phase + off + i * 0.137) % 1) * (L + 6)) - 3;
          if (px < X18 || px < xOf(c.emerge) || px > L - 1) return null;
          const [cy, w] = centerAt(c, xs, px) as [number, number];
          if (w < 0.5) return null;
          return <Boat key={`${c.name}-${off}`} x={px} y={cy} z={0.15 * Math.sin(t * 2 + i)} size={Math.max(0.35, Math.min(1, Math.sqrt(w / W) * 1.6))} color={LAYER_INK[c.layer]} />;
        }))}
        {hover && (() => { const c = channels.find((q) => q.name === hover)!; const p = iso(L + 3, (c.top[xs.length - 1] + c.bot[xs.length - 1]) / 2, 9);
          const f = (s: number) => `${(c.frac[String(s)] * 100).toFixed(1)}%`;
          const lines = [c.name, `${c.layer} · appears by ${isFinite(c.emerge) ? c.emerge : "—"} hpf`, `share 24 hpf ${f(24)} · 48 hpf ${f(48)} · 72 hpf ${f(72)}`];
          return <g pointerEvents="none"><rect x={p[0] - 1} y={p[1] - 9.5} width={Math.max(...lines.map((l) => l.length)) * 1.45 + 3} height={9.6} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((l, i) => <text key={i} x={p[0] + 0.6} y={p[1] - 6.6 + i * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{l}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
