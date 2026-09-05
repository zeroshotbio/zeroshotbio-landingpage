"use client";
/**
 * The developmental river — one engine for both panels.
 *
 * GEOMETRY: time flows downstream. Channels are the ZSCAPE wild-type tree (germ layer → tissue →
 * cell type); a channel's width at each stage is its share of cells in control embryos, so a child
 * channel opens at the decision point (stage line) where it first reaches share, and until then it
 * is drawn as a thin grey current — an option the flotilla has not taken yet. Boats float downstream
 * in aligned rows; when a row crosses a decision point the boats split into the channels that are
 * used there. The river itself is identical in both panels.
 *
 * mode "wt": boats and colours from wild-type shares.
 * mode "drug": same river; boat sizes from the drug's own tissue shares (ChemFish, 36/48/72 hpf);
 * channel colour = log2(drug share / matched-vehicle share) — warm over-used, cool under-used;
 * channels of the selected program's member tissues carry the gold shared current, and their boats
 * a gold tow ∝ program loading and a coral residual tick (flotilla.json, gene-space quantities).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import river from "./data/river.json";
import flot from "./data/flotilla.json";

type Node = { id: string; label: string; level: "layer" | "tissue" | "celltype"; parent: string; layer: string; share: Record<string, number>; own?: Record<string, number>; emerge?: number | null; pooled?: string[] };
type River = { stages: number[]; used: number; nodes: Node[]; drugs: string[]; drug: Record<string, Record<string, Record<string, { share: number; vehicle: number; log2: number }>>>; programs: Record<string, string[]>; n_control_embryos: number };
const R = river as unknown as River;
const FL = flot as unknown as { programs: Record<string, { label: string; tissues: string[] }>; responses: Record<string, Record<string, { norm: number; loading: Record<string, number>; residual: Record<string, number> }>>; program_order: string[] };
const TISSUE_TO_Z: Record<string, string> = { "CNS other": "Central Nervous System", forebrain: "Central Nervous System", midbrain: "Central Nervous System", hindbrain: "Central Nervous System", "spinal cord": "Central Nervous System", retina: "Eye", "fast muscle": "Muscle", muscle: "Muscle", epithelium: "Epidermis", "head mesenchyme": "Connective Tissue", "lpm derivatives": "Connective Tissue", "head mesenchyme neural crest": "Cranial NC" };

const S = R.stages, L = 120, W = 45, X18 = 22, TMAX = 96;
const PHI = 25 * Math.PI / 180, CP = Math.cos(PHI), SP = Math.sin(PHI);
const iso = (u: number, v: number, z = 0) => { const x = u * CP - v * SP, y = u * SP + v * CP; return [(x - y) * 0.866, (x + y) * 0.5 - z] as const; };
const xOf = (t: number) => X18 + ((t - 18) / (TMAX - 18)) * (L - X18);
const XS = S.map(xOf);
const INK = "#c7d0da", MUTED = "#6e7a88", GOLD = "#f5c542", CORAL = "#ff6b81", UNUSED = "#262d37";
const LAYER_FILL: Record<string, [string, string]> = { ectoderm: ["#1d3a5c", "#244a74"], mesoderm: ["#4a2f3f", "#5d3a4f"], endoderm: ["#1f4a44", "#276056"] };
const LAYER_INK: Record<string, string> = { ectoderm: "#7fb3ff", mesoderm: "#ff9db1", endoderm: "#6fdcc6" };
const OVER = "#e9954f", UNDER = "#4f9fe6";
const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");

/* ---- leaves in drawing order: layer → tissue own channel → its cell-type children ---- */
type Leaf = { id: string; label: string; layer: string; tissue: string; level: "tissue" | "celltype"; w: number[]; top: number[]; bot: number[]; emerge: number | null; parentRow?: number };
function buildLeaves(): Leaf[] {
  const leaves: Leaf[] = [];
  for (const layer of ["ectoderm", "mesoderm", "endoderm"]) {
    const tissues = R.nodes.filter((n) => n.level === "tissue" && n.layer === layer).sort((a, b) => Math.max(...Object.values(b.share)) - Math.max(...Object.values(a.share)));
    for (const t of tissues) {
      const kids = R.nodes.filter((n) => n.level === "celltype" && n.parent === t.id);
      leaves.push({ id: t.id, label: t.label, layer, tissue: t.label, level: "tissue", w: S.map((s) => (t.own ?? t.share)[String(s)] * W), top: [], bot: [], emerge: t.emerge ?? 18 });
      for (const k of kids) leaves.push({ id: k.id, label: k.label, layer, tissue: t.label, level: "celltype", w: S.map((s) => k.share[String(s)] * W), top: [], bot: [], emerge: k.emerge ?? null });
    }
  }
  S.forEach((_, i) => { const tot = leaves.reduce((a, l) => a + l.w[i], 0) || 1; let y = 0; leaves.forEach((l) => { const w = (l.w[i] / tot) * W; l.top[i] = y; l.bot[i] = y + w; y += w; }); });
  return leaves;
}
function ribbon(xs: number[], top: number[], bot: number[]) {
  const seg = (ys: number[], rev: boolean) => { const idx = ys.map((_, i) => i); if (rev) idx.reverse(); let d = "";
    idx.forEach((i, k) => { const [px, py] = iso(xs[i], ys[i]); if (k === 0) { d += `${rev ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`; return; }
      const j = idx[k - 1], dx = (xs[i] - xs[j]) / 2.2; const [c1x, c1y] = iso(xs[j] + dx, ys[j]), [c2x, c2y] = iso(xs[i] - dx, ys[i]);
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${px.toFixed(2)},${py.toFixed(2)}`; });
    return d; };
  return seg(top, false) + " " + seg(bot, true) + " Z";
}
const lerpAt = (arr: number[], x: number) => { if (x <= XS[0]) return arr[0]; for (let i = 1; i < XS.length; i++) if (x <= XS[i]) { const f = (x - XS[i - 1]) / (XS[i] - XS[i - 1]); return arr[i - 1] + (arr[i] - arr[i - 1]) * f; } return arr[XS.length - 1]; };
const stageAt = (x: number) => { for (let i = S.length - 1; i >= 0; i--) if (x >= XS[i] - 0.01) return S[i]; return S[0]; };
const nearestDrugStage = (s: number) => (s <= 36 ? 36 : s <= 48 ? 48 : 72);

function Boat({ x, y, z, size, color, tow, resid }: { x: number; y: number; z: number; size: number; color: string; tow?: number; resid?: number }) {
  const s = size; const hull: [number, number][] = [[-2.6 * s, -1.15 * s], [1.0 * s, -1.15 * s], [2.9 * s, 0], [1.0 * s, 1.15 * s], [-2.6 * s, 1.15 * s]];
  const at = (h: number) => hull.map(([dx, dy]) => iso(x + dx, y + dy, z + h));
  const base = at(0), top = at(0.9 * s);
  const [mx, my] = iso(x - 0.4 * s, y, z + 0.9 * s), [tx, ty] = iso(x - 0.4 * s, y, z + 4.2 * s), [px, py] = iso(x + 2 * s, y, z + 3.3 * s);
  const t0 = iso(x + 3 * s, y, 0.2), t1 = iso(x + 3 * s + (tow ?? 0), y, 0.2), r1 = iso(x + 3 * s + (tow ?? 0), y + (resid ?? 0), 0.2);
  return (<g>
    {tow ? <line x1={t0[0]} y1={t0[1]} x2={t1[0]} y2={t1[1]} stroke={GOLD} strokeWidth={0.5} opacity={0.95} /> : null}
    {tow && resid ? <line x1={t1[0]} y1={t1[1]} x2={r1[0]} y2={r1[1]} stroke={CORAL} strokeWidth={0.4} strokeDasharray="0.9 0.6" /> : null}
    <polygon points={P([base[3], base[4], top[4], top[3]])} fill="#8a97a6" /><polygon points={P([base[2], base[3], top[3], top[2]])} fill="#5f6b78" /><polygon points={P(top)} fill="#e8eef4" />
    <line x1={mx} y1={my} x2={tx} y2={ty} stroke={INK} strokeWidth={0.3 * Math.max(s, 0.6)} /><polygon points={`${tx},${ty} ${px},${py} ${tx},${ty + 1.5 * s}`} fill={color} />
  </g>);
}

export type RiverProps = { mode: "wt" | "drug"; drug?: string; program?: string; title: string; subtitle: string; children?: React.ReactNode };
export default function River({ mode, drug = "LY411575", program = "neural", title, subtitle, children }: RiverProps) {
  const leaves = useMemo(buildLeaves, []);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const loop = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id); }, []);
  const corners = [iso(0, 0), iso(L, 0), iso(0, W), iso(L, W)];
  const minX = Math.min(...corners.map((c) => c[0])) - 8, maxX = Math.max(...corners.map((c) => c[0])) + 28;
  const minY = Math.min(...corners.map((c) => c[1])) - 9, maxY = Math.max(...corners.map((c) => c[1])) + 6;

  /* drug usage helpers */
  const usage = (leaf: Leaf, stage: number) => { if (mode !== "drug") return null; const d = R.drug[drug]?.[String(nearestDrugStage(stage))]?.[leaf.tissue]; return d ?? null; };
  const memberZ = new Set((R.programs[program] ?? []));
  const loadingFor = (z: string) => { const ts = Object.entries(TISSUE_TO_Z).filter(([, v]) => v === z).map(([k]) => k); const rs = FL.responses[drug]; if (!rs) return null;
    const vals = ts.filter((k) => rs[k] && FL.programs[program].tissues.includes(k)).map((k) => [rs[k].loading[program], rs[k].residual[program]] as const); if (!vals.length) return null;
    return [vals.reduce((a, v) => a + v[0], 0) / vals.length, vals.reduce((a, v) => a + v[1], 0) / vals.length] as const; };
  const maxLoad = useMemo(() => Math.max(...Object.values(FL.responses).flatMap((rs) => Object.values(rs).flatMap((r) => Object.values(r.loading).map(Math.abs)))), []);

  const fillFor = (leaf: Leaf, i: number, stageIdx: number) => {
    const s = S[stageIdx]; const usedHere = leaf.w[stageIdx] / W >= R.used;
    if (!usedHere) return UNUSED;
    if (mode === "drug" && s >= 36) { const u = usage(leaf, s); if (u) { const a = Math.min(1, Math.abs(u.log2) / 1.0); const c = u.log2 > 0 ? OVER : UNDER; return a > 0.25 ? c : LAYER_FILL[leaf.layer][i % 2]; } }
    return LAYER_FILL[leaf.layer][i % 2];
  };
  /* rows of boats */
  const ROW_T = 2.4, TRAVEL = 20, rows: number[] = [];
  for (let k = 0; k < Math.ceil(TRAVEL / ROW_T) + 1; k++) { const x = (((t / ROW_T) % 1 + k) / (TRAVEL / ROW_T)) * (L + 8) - 4; if (x > -3 && x < L + 2) rows.push(x); }
  const pre = ["ectoderm", "mesoderm", "endoderm"].map((l, li) => { const lay = leaves.filter((q) => q.layer === l); const y0 = lay[0].top[0], y1 = lay[lay.length - 1].bot[0];
    const r0 = W / 2 - 3.5 + (li * 7) / 3, r1 = r0 + 7 / 3; return { l, y0, y1, d: ribbon([0, 9, X18], [r0, (r0 + y0) / 2, y0], [r1, (r1 + y1) / 2, y1]) }; });
  const drugStage = (x: number) => nearestDrugStage(stageAt(x));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: 16, zIndex: 2 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e8eef4" }}>{title}</h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>{subtitle}</p>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: INK }}>
          {mode === "wt" ? <>{["ectoderm", "mesoderm", "endoderm"].map((l) => <span key={l} style={{ marginRight: 12 }}><span style={{ color: LAYER_INK[l], fontWeight: 600 }}>■</span> {l}</span>)}<span style={{ color: UNUSED, fontWeight: 600 }}>■</span> <span style={{ color: MUTED }}>current not yet taken · width = share of cells</span></>
            : <><span style={{ color: OVER, fontWeight: 600 }}>■</span> over-used vs vehicle <span style={{ color: UNDER, fontWeight: 600, marginLeft: 8 }}>■</span> under-used <span style={{ color: GOLD, fontWeight: 600, marginLeft: 8 }}>■</span> shared current · <span style={{ color: CORAL }}>residual</span> <span style={{ color: MUTED, marginLeft: 8 }}>ChemFish 36 / 48 / 72 hpf</span></>}
        </p>
      </div>
      {children}
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <polygon points={P([iso(-4, -6), iso(L + 6, -6), iso(L + 6, W + 6), iso(-4, W + 6)])} fill="#131821" />
        {pre.map((p) => <path key={p.l} d={p.d} fill={LAYER_FILL[p.l][0]} stroke={LAYER_INK[p.l]} strokeOpacity={0.35} strokeWidth={0.25} strokeDasharray="1.2 1" />)}
        {/* channels: one segment per stage interval so colour can change at decision points */}
        {leaves.map((leaf, i) => S.slice(0, -1).map((_, k) => {
          const fill = fillFor(leaf, i, k + 1); const on = hover === leaf.id;
          const isMember = mode === "drug" && memberZ.has(leaf.tissue) && S[k + 1] >= 36;
          return <path key={`${leaf.id}-${k}`} d={ribbon(XS.slice(k, k + 2), leaf.top.slice(k, k + 2), leaf.bot.slice(k, k + 2))} fill={on ? LAYER_INK[leaf.layer] : fill} fillOpacity={on ? 0.55 : 1}
            stroke={isMember ? GOLD : fill === UNUSED ? "#3a4350" : fill} strokeWidth={isMember ? 0.45 : 0.25} strokeDasharray={fill === UNUSED ? "0.8 0.6" : undefined} strokeOpacity={isMember ? 0.8 : 1}
            onMouseEnter={() => setHover(leaf.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }} />;
        }))}
        {/* decision points: where a channel first becomes used */}
        {leaves.map((leaf) => { const i = S.findIndex((s) => leaf.w[S.indexOf(s)] / W >= R.used); if (i <= 0) return null;
          const [cx, cy] = iso(XS[i], (leaf.top[i] + leaf.bot[i]) / 2, 0.3);
          return <g key={`dp-${leaf.id}`}><polygon points={`${cx},${cy - 1.1} ${cx + 0.9},${cy} ${cx},${cy + 1.1} ${cx - 0.9},${cy}`} fill="#0e1116" stroke={LAYER_INK[leaf.layer]} strokeWidth={0.3} /></g>; })}
        {S.map((s) => { const a = iso(xOf(s), -1.5), b = iso(xOf(s), W + 1.5), l = iso(xOf(s), -4);
          return <g key={s}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#e8eef4" strokeOpacity={0.22} strokeWidth={0.3} strokeDasharray="0.8 0.8" /><text x={l[0]} y={l[1]} fontSize={2.8} fill={MUTED} textAnchor="middle" letterSpacing={0.2}>{s} hpf</text></g>; })}
        {(() => { const l = iso(2, -4); return <text x={l[0]} y={l[1]} fontSize={2.8} fill={MUTED} textAnchor="middle">0 hpf</text>; })()}
        {(() => { const l = iso(X18 + 1.5, W + 3.5); return <text x={l[0]} y={l[1]} fontSize={2.3} fill={MUTED} fontStyle="italic">← gastrulation · no single-cell data before 18 hpf{mode === "drug" ? " · ChemFish data from 36 hpf" : ""}</text>; })()}
        <polygon points={P([iso(0, -1.5, 1.1), iso(4, -1.5, 1.1), iso(4, W + 1.5, 1.1), iso(0, W + 1.5, 1.1)])} fill="#2b3442" />
        {leaves.filter((l) => l.bot[S.length - 1] - l.top[S.length - 1] > 1.6).map((l, k) => { const y = (l.top[S.length - 1] + l.bot[S.length - 1]) / 2; const p = iso(L + 3 + (k % 2) * 6.5, y);
          return <text key={l.id} x={p[0]} y={p[1] + 0.9} fontSize={2.4} fill={hover === l.id ? LAYER_INK[l.layer] : INK} opacity={0.9}>{l.label.length > 24 ? l.label.slice(0, 23) + "…" : l.label}</text>; })}
        {/* rows of boats */}
        {rows.map((x, ri) => {
          if (x < X18) { const boats = x < 9 ? [W / 2] : pre.map((p) => (p.y0 + p.y1) / 2 * (x - 9) / (X18 - 9) + (W / 2) * (1 - (x - 9) / (X18 - 9))); return boats.map((y, k) => <Boat key={`${ri}-${k}`} x={Math.max(1, x)} y={y} z={0.15 * Math.sin(t * 2 + k)} size={0.95} color={x < 9 ? "#e8eef4" : LAYER_INK[pre[k].l]} />); }
          const st = stageAt(x), si = S.indexOf(st);
          return leaves.map((leaf, i) => {
            const w = lerpAt(leaf.bot, x) - lerpAt(leaf.top, x); if (w < 0.55 || leaf.w[si] / W < R.used) return null;
            let size = Math.max(0.35, Math.min(1, Math.sqrt(w / W) * 1.6)); let color = LAYER_INK[leaf.layer]; let tow: number | undefined, resid: number | undefined;
            if (mode === "drug") { const u = usage(leaf, st); if (u && st >= 36) { size = Math.max(0.3, Math.min(1.1, size * Math.sqrt((u.share + 1e-3) / (u.vehicle + 1e-3)))); color = Math.abs(u.log2) > 0.25 ? (u.log2 > 0 ? OVER : UNDER) : color; }
              if (memberZ.has(leaf.tissue) && st >= 36) { color = GOLD; const lr = loadingFor(leaf.tissue); if (lr) { tow = 2 + 9 * Math.max(0, lr[0]) / maxLoad; resid = Math.min(3.5, 0.35 * lr[1]); } } }
            return <Boat key={`${ri}-${i}`} x={x} y={(lerpAt(leaf.top, x) + lerpAt(leaf.bot, x)) / 2} z={0.15 * Math.sin(t * 2 + i)} size={size} color={color} tow={tow} resid={resid} />;
          });
        })}
        {hover && (() => { const l = leaves.find((q) => q.id === hover)!; const p = iso(L + 3, (l.top[S.length - 1] + l.bot[S.length - 1]) / 2, 9);
          const f = (i: number) => `${((l.bot[i] - l.top[i]) / W * 100).toFixed(1)}%`;
          const lines = [l.level === "celltype" ? `${l.label} · ${l.tissue}` : l.label, `${l.layer} · opens by ${l.emerge ?? "—"} hpf`, `wild type share 24 hpf ${f(1)} · 48 hpf ${f(3)} · 72 hpf ${f(4)}`];
          if (mode === "drug") { const u = R.drug[drug]?.["48"]?.[l.tissue]; lines.push(u ? `${drug} 48 hpf ${(u.share * 100).toFixed(1)}% vs vehicle ${(u.vehicle * 100).toFixed(1)}% (log2 ${u.log2.toFixed(2)})` : `${drug}: no ChemFish counterpart`); }
          return <g pointerEvents="none"><rect x={p[0] - 1} y={p[1] - 3 - lines.length * 2.9} width={Math.max(...lines.map((q) => q.length)) * 1.4 + 3} height={lines.length * 2.9 + 1.8} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
            {lines.map((q, i) => <text key={i} x={p[0] + 0.6} y={p[1] - 1.2 - (lines.length - 1 - i) * 2.9} fontSize={i ? 2.3 : 2.7} fontWeight={i ? 400 : 600} fill={i ? INK : "#e8eef4"}>{q}</text>)}</g>; })()}
      </svg>
    </div>
  );
}
