"use client";
/**
 * The delta — a river that widens at every landmark and offers far more currents than the flotilla uses.
 *
 * DATA (data/delta.json, ChemFish CHEM10): every cell type under a tissue is a potential current.
 * A current is USED by a condition at a landmark (36 / 48 / 72 hpf) if that condition's embryos put
 * ≥ 0.25% of their cells in it. Wild type = vehicle embryos. The map (channel geometry) is built from
 * wild type only and is IDENTICAL in both panels; the drug side changes nothing but which currents
 * carry boats: grey → coloured = a path the drug pushed above threshold, coloured → dark = a path it
 * depleted. Upstream of 36 hpf there is no ChemFish data; that reach is schematic.
 * Program-member tissues (Phase 5) carry the gold shared current; their boats a tow ∝ gene-space loading.
 */
import { useEffect, useMemo, useState } from "react";
import raw from "./data/delta.json";
import flot from "./data/flotilla.json";

type Node = { id: string; label: string; level: "tissue" | "celltype"; parent?: string; pooled?: number; share: Record<string, Record<string, number>> };
type Delta = { stages: number[]; used: number; conds: string[]; n_embryos: Record<string, Record<string, number>>; nodes: Node[] };
const D = raw as unknown as Delta;
const FL = flot as unknown as { program_order: string[]; programs: Record<string, { label: string; tissues: string[] }>; responses: Record<string, Record<string, { loading: Record<string, number>; residual: Record<string, number> }>> };
const S = D.stages, USED = D.used;
const ECTO = new Set(["forebrain", "midbrain", "hindbrain", "spinal cord", "CNS other", "rhombomeres", "floor plate", "motor neuron", "retina", "eye", "lens", "olfactory", "ear", "cranial sensory ganglia", "neural crest", "head mesenchyme neural crest", "pigment", "epiderm", "periderm", "ionocytes", "epithelium"]);
const ENDO = new Set(["intestine", "pancreas", "endoderm"]);
const layerOf = (t: string) => (ECTO.has(t) ? "ectoderm" : ENDO.has(t) ? "endoderm" : "mesoderm");
const LAYERS = ["ectoderm", "mesoderm", "endoderm"];
const LAYER_FILL: Record<string, [string, string]> = { ectoderm: ["#1d3a5c", "#244a74"], mesoderm: ["#4a2f3f", "#5d3a4f"], endoderm: ["#1f4a44", "#276056"] };
const LAYER_INK: Record<string, string> = { ectoderm: "#7fb3ff", mesoderm: "#ff9db1", endoderm: "#6fdcc6" };
const INK = "#c7d0da", MUTED = "#6e7a88", GOLD = "#f5c542", CORAL = "#ff6b81", UNUSED = "#262d37", NEW = "#e9954f", LOST = "#3d6c99";
const PHI = 25 * Math.PI / 180, CP = Math.cos(PHI), SP = Math.sin(PHI);
const iso = (u: number, v: number, z = 0) => { const x = u * CP - v * SP, y = u * SP + v * CP; return [(x - y) * 0.866, (x + y) * 0.5 - z] as const; };
const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");

/* landmarks along the river and the widening width function */
const L = 120, XK = [22, 40, 76, 118], WK = [22, 40, 58, 78], THREAD = 0.42;      // knots: schematic tissue split, 36, 48, 72 hpf
const XLM: Record<number, number> = { 36: 40, 48: 76, 72: 118 };
const widthAt = (x: number) => { if (x <= 0) return 8; if (x <= 8) return 8 + (x / 8) * 6; if (x <= 22) return 14 + ((x - 8) / 14) * 8; for (let i = 1; i < XK.length; i++) if (x <= XK[i]) return WK[i - 1] + ((x - XK[i - 1]) / (XK[i] - XK[i - 1])) * (WK[i] - WK[i - 1]); return WK[WK.length - 1]; };
const stageAt = (x: number) => (x < XLM[48] ? 36 : x < XLM[72] ? 48 : 72);

type Leaf = { id: string; label: string; tissue: string; layer: string; pooled?: number; share: Record<string, Record<string, number>>; top: number[]; bot: number[] };
type Band = { tissue: string; layer: string; top: number[]; bot: number[]; share: Record<string, Record<string, number>> };
function build() {
  const tissues = D.nodes.filter((n) => n.level === "tissue").sort((a, b) => LAYERS.indexOf(layerOf(a.label)) - LAYERS.indexOf(layerOf(b.label)) || Math.max(...Object.values(b.share.wildtype)) - Math.max(...Object.values(a.share.wildtype)));
  const leaves: Leaf[] = [], bands: Band[] = [];
  for (const t of tissues) {
    const kids = D.nodes.filter((n) => n.level === "celltype" && n.parent === t.id);
    bands.push({ tissue: t.label, layer: layerOf(t.label), top: [], bot: [], share: t.share });
    for (const k of kids) leaves.push({ id: k.id, label: k.label, tissue: t.label, layer: layerOf(t.label), pooled: k.pooled, share: k.share, top: [], bot: [] });
  }
  // stack per knot; knot 0 (schematic) reuses 36-hpf proportions at the schematic width
  XK.forEach((_, ki) => {
    const s = String(ki === 0 ? 36 : [36, 48, 72][ki - 1]); const W = WK[ki];
    const usedW = leaves.map((l) => (l.share.wildtype[s] >= USED ? l.share.wildtype[s] : 0));
    const nUnused = usedW.filter((w) => w === 0).length; const room = Math.max(W * 0.55, W - nUnused * THREAD); const tot = usedW.reduce((a, b) => a + b, 0) || 1;
    const thread = (W - room) / Math.max(1, nUnused);
    let y = -W / 2;
    for (const b of bands) { b.top[ki] = y; leaves.filter((l) => l.tissue === b.tissue).forEach((l) => { const i = leaves.indexOf(l); const w = usedW[i] > 0 ? (usedW[i] / tot) * room : thread; l.top[ki] = y; l.bot[ki] = y + w; y += w; }); b.bot[ki] = y; }
  });
  return { leaves, bands };
}
function ribbon(xs: number[], top: number[], bot: number[]) {
  const seg = (ys: number[], rev: boolean) => { const idx = ys.map((_, i) => i); if (rev) idx.reverse(); let d = "";
    idx.forEach((i, k) => { const [px, py] = iso(xs[i], ys[i]); if (k === 0) { d += `${rev ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`; return; }
      const j = idx[k - 1], dx = (xs[i] - xs[j]) / 2.2; const [c1x, c1y] = iso(xs[j] + dx, ys[j]), [c2x, c2y] = iso(xs[i] - dx, ys[i]);
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`; });
    return d; };
  return seg(top, false) + " " + seg(bot, true) + " Z";
}
const lerpAt = (arr: number[], x: number) => { if (x <= XK[0]) return arr[0]; for (let i = 1; i < XK.length; i++) if (x <= XK[i]) { const f = (x - XK[i - 1]) / (XK[i] - XK[i - 1]); return arr[i - 1] + (arr[i] - arr[i - 1]) * f; } return arr[XK.length - 1]; };
function Boat({ x, y, z, size, color, tow, resid }: { x: number; y: number; z: number; size: number; color: string; tow?: number; resid?: number }) {
  const s = size; const hull: [number, number][] = [[-2.6 * s, -1.15 * s], [1.0 * s, -1.15 * s], [2.9 * s, 0], [1.0 * s, 1.15 * s], [-2.6 * s, 1.15 * s]];
  const at = (h: number) => hull.map(([dx, dy]) => iso(x + dx, y + dy, z + h)); const base = at(0), top = at(0.9 * s);
  const [mx, my] = iso(x - 0.4 * s, y, z + 0.9 * s), [tx, ty] = iso(x - 0.4 * s, y, z + 4.2 * s), [px, py] = iso(x + 2 * s, y, z + 3.3 * s);
  const t0 = iso(x + 3 * s, y, 0.2), t1 = iso(x + 3 * s + (tow ?? 0), y, 0.2), r1 = iso(x + 3 * s + (tow ?? 0), y + (resid ?? 0), 0.2);
  return (<g>
    {tow ? <line x1={t0[0]} y1={t0[1]} x2={t1[0]} y2={t1[1]} stroke={GOLD} strokeWidth={0.5} /> : null}
    {tow && resid ? <line x1={t1[0]} y1={t1[1]} x2={r1[0]} y2={r1[1]} stroke={CORAL} strokeWidth={0.4} strokeDasharray="0.9 0.6" /> : null}
    <polygon points={P([base[3], base[4], top[4], top[3]])} fill="#8a97a6" /><polygon points={P([base[2], base[3], top[3], top[2]])} fill="#5f6b78" /><polygon points={P(top)} fill="#e8eef4" />
    <line x1={mx} y1={my} x2={tx} y2={ty} stroke={INK} strokeWidth={0.3 * Math.max(s, 0.6)} /><polygon points={`${tx},${ty} ${px},${py} ${tx},${ty + 1.5 * s}`} fill={color} />
  </g>);
}

export default function Delta({ cond, program = "neural", title, subtitle, children }: { cond: string; program?: string; title: string; subtitle: string; children?: React.ReactNode }) {
  const { leaves, bands } = useMemo(build, []);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const isWT = cond === "wildtype"; const members = new Set(isWT ? [] : FL.programs[program]?.tissues ?? []);
  const used = (l: Leaf, s: number, c = cond) => (l.share[c]?.[String(s)] ?? 0) >= USED;
  const status = (l: Leaf, s: number) => { const w = used(l, s, "wildtype"), d = used(l, s); return isWT ? (w ? "used" : "unused") : d && w ? "used" : d && !w ? "new" : !d && w ? "lost" : "unused"; };
  const fillFor = (l: Leaf, i: number, s: number) => { const st = status(l, s); return st === "unused" ? UNUSED : st === "new" ? NEW : st === "lost" ? LOST : LAYER_FILL[l.layer][i % 2]; };
  const maxLoad = useMemo(() => Math.max(...Object.values(FL.responses).flatMap((rs) => Object.values(rs).flatMap((r) => Object.values(r.loading).map(Math.abs)))), []);
  // bank outline from the width function
  const bankPts: [number, number][] = []; for (let x = 0; x <= L; x += 4) bankPts.push([x, -widthAt(x) / 2 - 3]); for (let x = L; x >= 0; x -= 4) bankPts.push([x, widthAt(x) / 2 + 3]);
  const corners = [iso(0, -6), iso(L, -WK[3] / 2 - 4), iso(L, WK[3] / 2 + 4), iso(0, 6), iso(L + 30, 0)];
  const minX = Math.min(...corners.map((c) => c[0])) - 6, maxX = Math.max(...corners.map((c) => c[0])) + 6, minY = Math.min(...corners.map((c) => c[1])) - 9, maxY = Math.max(...corners.map((c) => c[1])) + 6;
  // schematic upstream: dock → germ layers (x 0→8→22) using 36-hpf band sums
  const layerSpan = LAYERS.map((ly) => { const bs = bands.filter((b) => b.layer === ly); return { ly, y0: Math.min(...bs.map((b) => b.top[0])), y1: Math.max(...bs.map((b) => b.bot[0])) }; });
  const rows: number[] = []; const ROW_T = 2.2, TRAVEL = 22; for (let k = 0; k <= Math.ceil(TRAVEL / ROW_T); k++) { const x = (((t / ROW_T) % 1 + k) / (TRAVEL / ROW_T)) * (L + 8) - 4; if (x > -3 && x < L + 1) rows.push(x); }
  const flips = isWT ? [] : leaves.flatMap((l) => S.filter((s) => status(l, s) === "new").map((s) => ({ l, s })));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: 16, zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>{title}</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>{subtitle}</p>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: INK }}>
          {LAYERS.map((l) => <span key={l} style={{ marginRight: 10 }}><span style={{ color: LAYER_INK[l], fontWeight: 600 }}>■</span> {l}</span>)}
          <span style={{ color: "#4a5563", fontWeight: 600 }}>■</span> <span style={{ color: MUTED, marginRight: 10 }}>potential, unused</span>
          {!isWT && <><span style={{ color: NEW, fontWeight: 600 }}>■</span> newly used <span style={{ color: LOST, fontWeight: 600, marginLeft: 8 }}>■</span> abandoned <span style={{ color: GOLD, fontWeight: 600, marginLeft: 8 }}>■</span> shared current</>}
        </p>
      </div>
      {children}
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <polygon points={P(bankPts.map(([x, y]) => iso(x, y)))} fill="#131821" />
        {/* schematic upstream */}
        <path d={ribbon([0, 8], [-4, -7], [4, 7])} fill="#1a2433" stroke="#33405a" strokeWidth={0.25} strokeDasharray="1.2 1" />
        {layerSpan.map((ls, i) => <path key={ls.ly} d={ribbon([8, 22], [-7 + (i * 14) / 3, ls.y0], [-7 + ((i + 1) * 14) / 3, ls.y1])} fill={LAYER_FILL[ls.ly][0]} stroke={LAYER_INK[ls.ly]} strokeOpacity={0.35} strokeWidth={0.25} strokeDasharray="1.2 1" />)}
        {/* currents: one segment per landmark interval so status can change at each landmark */}
        {leaves.map((l, i) => XK.slice(0, -1).map((_, k) => { const s = [36, 36, 48, 72][k + 1]; const f = fillFor(l, i, s); const on = hover === l.id; const mem = members.has(l.tissue);
          return <path key={`${l.id}-${k}`} d={ribbon(XK.slice(k, k + 2), l.top.slice(k, k + 2), l.bot.slice(k, k + 2))} fill={on ? LAYER_INK[l.layer] : f} fillOpacity={on ? 0.6 : 1}
            stroke={f === UNUSED ? "#3a4350" : f} strokeWidth={0.25} strokeDasharray={f === UNUSED ? "0.8 0.7" : undefined} onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }} />; }))}
        {/* program-member tissue bands: gold shared current */}
        {bands.filter((b) => members.has(b.tissue)).map((b) => <path key={b.tissue} d={ribbon(XK.slice(1), b.top.slice(1), b.bot.slice(1))} fill="none" stroke={GOLD} strokeWidth={0.6} strokeOpacity={0.9} />)}
        {/* landmarks */}
        {S.map((s) => { const x = XLM[s], w = widthAt(x) / 2 + 1.5; const a = iso(x, -w), b = iso(x, w), l = iso(x, -w - 3);
          return <g key={s}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8eef4" strokeOpacity={0.25} strokeWidth={0.3} strokeDasharray="0.8 0.8" /><text x={l[0]} y={l[1]} fontSize={2.9} fill={INK} textAnchor="middle" letterSpacing={0.2}>{s} hpf</text></g>; })}
        {(() => { const l = iso(2, -8.5); return <text x={l[0]} y={l[1]} fontSize={2.8} fill={MUTED} textAnchor="middle">0 hpf</text>; })()}
        {(() => { const l = iso(11, widthAt(11) / 2 + 4); return <text x={l[0]} y={l[1]} fontSize={2.2} fill={MUTED} fontStyle="italic">schematic · no ChemFish data before 36 hpf</text>; })()}
        {/* decision points: where a current first becomes used (drug side: where the drug lights a wild-type-dark path) */}
        {(isWT ? leaves.flatMap((l) => { const s = S.find((s) => used(l, s)); return s ? [{ l, s }] : []; }) : flips).map(({ l, s }) => { const ki = XK.indexOf(XLM[s]); const [cx, cy] = iso(XLM[s], (l.top[ki] + l.bot[ki]) / 2, 0.3);
          return <polygon key={`${l.id}-${s}`} points={`${cx},${cy - 1} ${cx + 0.8},${cy} ${cx},${cy + 1} ${cx - 0.8},${cy}`} fill="#0e1116" stroke={isWT ? LAYER_INK[l.layer] : NEW} strokeWidth={0.3} />; })}
        <polygon points={P([iso(0, -5.5, 1.1), iso(3, -5.5, 1.1), iso(3, 5.5, 1.1), iso(0, 5.5, 1.1)])} fill="#2b3442" />
        {/* tissue labels at the mouth */}
        {bands.filter((b) => b.bot[3] - b.top[3] > 2.2).map((b, k) => { const p = iso(L + 3 + (k % 2) * 7, (b.top[3] + b.bot[3]) / 2); return <text key={b.tissue} x={p[0]} y={p[1] + 0.9} fontSize={2.4} fill={members.has(b.tissue) ? GOLD : INK} opacity={0.9}>{b.tissue}</text>; })}
        {/* rows of boats */}
        {rows.map((x, ri) => {
          if (x < 8) return <Boat key={ri} x={Math.max(1, x)} y={0} z={0.15 * Math.sin(t * 2)} size={1.0} color="#e8eef4" />;
          if (x < 22) return layerSpan.map((ls, i) => { const f = (x - 8) / 14; const y = (-7 + ((i + 0.5) * 14) / 3) * (1 - f) + ((ls.y0 + ls.y1) / 2) * f; return <Boat key={`${ri}-${i}`} x={x} y={y} z={0.15 * Math.sin(t * 2 + i)} size={0.9} color={LAYER_INK[ls.ly]} />; });
          if (x < XLM[36]) return bands.filter((b) => b.share.wildtype["36"] >= 0.005).map((b, i) => <Boat key={`${ri}-${i}`} x={x} y={(lerpAt(b.top, x) + lerpAt(b.bot, x)) / 2} z={0.15 * Math.sin(t * 2 + i)} size={Math.max(0.35, Math.min(0.9, Math.sqrt(b.share.wildtype["36"]) * 1.6))} color={LAYER_INK[b.layer]} />);
          const s = stageAt(x);
          return leaves.map((l, i) => { if (!used(l, s)) return null; const sh = l.share[cond][String(s)]; const st = status(l, s);
            let color = st === "new" ? NEW : LAYER_INK[l.layer]; let tow: number | undefined, resid: number | undefined;
            if (!isWT && members.has(l.tissue)) { color = GOLD; const r = FL.responses[cond]?.[l.tissue]; if (r) { tow = 2 + 9 * Math.max(0, r.loading[program]) / maxLoad; resid = Math.min(3, 0.3 * r.residual[program]); } }
            return <Boat key={`${ri}-${i}`} x={x} y={(lerpAt(l.top, x) + lerpAt(l.bot, x)) / 2} z={0.15 * Math.sin(t * 2 + i)} size={Math.max(0.32, Math.min(0.95, Math.sqrt(sh) * 2.2))} color={color} tow={tow} resid={resid} />; });
        })}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const p = iso(L + 3, (l.top[3] + l.bot[3]) / 2, 9);
          const pct = (c: string, s: number) => `${((l.share[c]?.[String(s)] ?? 0) * 100).toFixed(2)}%`;
          const lines = [l.pooled ? `${l.label} (${l.pooled} rarer types)` : l.label, `tissue: ${l.tissue} · ${l.layer}`, `wild type ${pct("wildtype", 36)} · ${pct("wildtype", 48)} · ${pct("wildtype", 72)} at 36/48/72 hpf`];
          if (!isWT) lines.push(`${cond} ${pct(cond, 36)} · ${pct(cond, 48)} · ${pct(cond, 72)} → ${S.map((s) => status(l, s)).join(" / ")}`);
          return <g pointerEvents="none"><rect x={p[0] - 1} y={p[1] - 3 - lines.length * 2.9} width={Math.max(...lines.map((q) => q.length)) * 1.4 + 3} height={lines.length * 2.9 + 1.8} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={p[0] + 0.6} y={p[1] - 1.2 - (lines.length - 1 - i) * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
