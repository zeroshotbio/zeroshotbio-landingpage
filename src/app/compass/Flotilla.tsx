"use client";
/**
 * ChemFish biological flotilla — one isometric river scene, SVG.
 *
 * DATA → SCENE MAPPING (metaphorical, deterministic, documented):
 *   river lanes            = the five frozen Phase-5 program axes; the selected one is the highlighted current
 *   boat                   = one real tissue response of the selected drug (12 powered tissues)
 *   downstream distance    ∝ loading r·u on the selected program (gene space; signed, negative = upstream)
 *   lateral drift          ∝ residual √(‖r‖²−(r·u)²) — everything orthogonal to the program
 *   drift direction        = toward the lane of the tissue's strongest OTHER program (a reading aid, not data)
 *   ghost boat             = where the boat would be if the shared current were the whole story
 *   scale                  = per program, so its largest mover in the panel reaches the far reach of the river
 * No coordinates come from the data; only loadings, norms, residuals and membership do.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/flotilla.json";

type Resp = { norm: number; loading: Record<string, number>; residual: Record<string, number>; n_strata: number };
type Data = {
  drugs: { id: string; pathway: string }[]; program_order: string[];
  programs: Record<string, { label: string; tissues: string[] }>; tissues: string[];
  responses: Record<string, Record<string, Resp>>;
};
const D = raw as unknown as Data;

/* ---------------- isometric world ---------------- */
const L = 120, LANE = 9, NL = D.program_order.length, W = LANE * NL, DOCK = 8;
const iso = (x: number, y: number, z = 0) => [(x - y) * 0.866, (x + y) * 0.5 - z] as const;
const P = (pts: (readonly [number, number])[]) => pts.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");
const poly = (xy: [number, number, number?][]) => P(xy.map(([x, y, z]) => iso(x, y, z ?? 0)));
const laneY = (i: number) => (i + 0.5) * LANE;
const ease = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

const GOLD = "#f5c542", CORAL = "#ff6b81", INK = "#c7d0da", MUTED = "#6e7a88", BG = "#0e1116";

type Boat = {
  tissue: string; member: boolean; loading: number; residual: number; norm: number; frac: number;
  x0: number; y0: number; xg: number; yg: number; xa: number; ya: number; otherLane: string;
};

function layout(drug: string, program: string): Boat[] {
  const s = D.program_order.indexOf(program);
  const rs = D.responses[drug];
  // per-program scales so the panel's largest mover spans the river (see header)
  let maxL = 0, maxR = 0;
  for (const d of D.drugs) for (const t of D.tissues) { const r = D.responses[d.id]?.[t]; if (!r) continue;
    maxL = Math.max(maxL, Math.abs(r.loading[program])); maxR = Math.max(maxR, r.residual[program]); }
  const Xs = (L - DOCK - 14) / maxL, Ys = (2.1 * LANE) / maxR;
  const members = D.programs[program].tissues;
  const tissues = D.tissues.filter((t) => rs[t]).sort((a, b) => Math.abs(rs[b].loading[program]) - Math.abs(rs[a].loading[program]));
  const n = tissues.length;
  const laneCount: Record<number, number> = {};
  return tissues.map((t, rank) => {
    const r = rs[t]; const lo = r.loading[program], re = r.residual[program];
    const member = members.includes(t);
    const other = D.program_order.filter((p) => p !== program).sort((a, b) => Math.abs(r.loading[b]) - Math.abs(r.loading[a]))[0];
    const dir = Math.sign(D.program_order.indexOf(other) - s) || (rank % 2 ? 1 : -1);
    // launch: members form up in the selected lane; every other boat waits at the dock in the lane
    // of its own strongest program (a reading aid so the dock does not pile up)
    const home = member ? s : D.program_order.indexOf(D.program_order.slice().sort((a, b) => Math.abs(r.loading[b]) - Math.abs(r.loading[a]))[0]);
    const k = (laneCount[home] = (laneCount[home] ?? 0) + 1);
    const spread = ((k % 2 ? 1 : -1) * Math.ceil((k - 1) / 2)) * 1.05;
    const y0 = laneY(home) + spread, x0 = DOCK + 2 + ((k - 1) % 3) * 1.1;
    const xg = Math.max(2, Math.min(L - 3, x0 + lo * Xs));
    // residual drift is drawn for members only; non-members simply move by their (small) loading
    const ya = member ? Math.max(1.4, Math.min(W - 1.4, y0 + dir * re * Ys)) : y0;
    return { tissue: t, member, loading: lo, residual: re, norm: r.norm, frac: (lo * lo) / (r.norm * r.norm),
             x0, y0, xg, yg: y0, xa: xg, ya, otherLane: other };
  }).concat([]).slice(0, n);
}

/* ---------------- boat glyph ---------------- */
function BoatGlyph({ x, y, z, member, ghost, program, sel }: { x: number; y: number; z: number; member: boolean; ghost?: boolean; program: string; sel: boolean }) {
  const hull: [number, number][] = [[-2.6, -1.15], [1.0, -1.15], [2.9, 0], [1.0, 1.15], [-2.6, 1.15]];
  const at = (h: number) => hull.map(([dx, dy]) => [x + dx, y + dy, z + h] as [number, number, number]);
  const deck = poly(at(0.9)), base = at(0), top = at(0.9);
  const side = P([iso(...base[3]), iso(...base[4]), iso(...top[4]), iso(...top[3])]);            // +y face
  const bow = P([iso(...base[2]), iso(...base[3]), iso(...top[3]), iso(...top[2])]);              // bow face
  const [mx, my] = iso(x - 0.4, y, z + 0.9), [tx, ty] = iso(x - 0.4, y, z + 4.6);
  const [px, py] = iso(x + 2.2, y, z + 3.6);
  if (ghost) return <polygon points={deck} fill="none" stroke={GOLD} strokeWidth={0.35} strokeDasharray="0.9 0.7" opacity={0.85} />;
  const light = member ? "#e8eef4" : "#5d6773", mid = member ? "#a6b3c1" : "#3f4853", dark = member ? "#7c8a99" : "#30383f";
  return (
    <g style={{ filter: sel ? "drop-shadow(0 0 1.2px rgba(245,197,66,.9))" : undefined }}>
      <polygon points={side} fill={mid} /><polygon points={bow} fill={dark} /><polygon points={deck} fill={light} />
      <line x1={mx} y1={my} x2={tx} y2={ty} stroke={member ? INK : "#5d6773"} strokeWidth={0.32} />
      {member && <polygon points={`${tx},${ty} ${px},${py} ${tx},${ty + 1.7}`} fill={GOLD} opacity={0.95} />}
    </g>
  );
}

/* ---------------- scene ---------------- */
export default function Flotilla({ fontClass }: { fontClass: string }) {
  const [drug, setDrug] = useState("LY411575");
  const [program, setProgram] = useState("neural");
  const [showResid, setShowResid] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0); const t0 = useRef(performance.now()); const clock = useRef(0);
  useEffect(() => { t0.current = performance.now(); }, [drug, program]);
  useEffect(() => {
    let id = 0; const loop = (now: number) => { setT((now - t0.current) / 1000); clock.current = now / 1000; id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id);
  }, []);
  const boats = useMemo(() => layout(drug, program), [drug, program]);
  const s = D.program_order.indexOf(program);
  const fShared = ease((t - 0.25) / 1.1), fResid = ease((t - 1.15) / 0.9);
  const lead = boats.find((b) => b.member) ?? boats[0];
  // viewBox from the river's isometric bounding box (+ margins for labels)
  const corners = [iso(0, 0), iso(L, 0), iso(0, W), iso(L, W)];
  const minX = Math.min(...corners.map((c) => c[0])) - 14, maxX = Math.max(...corners.map((c) => c[0])) + 30;
  const minY = Math.min(...corners.map((c) => c[1])) - 18, maxY = Math.max(...corners.map((c) => c[1])) + 10;
  const drugMeta = D.drugs.find((d) => d.id === drug)!;

  return (
    <div className={fontClass} style={{ position: "fixed", inset: 0, background: BG, color: INK, overflow: "hidden" }}>
      <style>{`
        @keyframes flow { to { stroke-dashoffset: -32; } }
        .flow { animation: flow 6s linear infinite; } .flow.hot { animation-duration: 2.2s; }
        .ui select{background:#141a22;color:${INK};border:1px solid #273140;border-radius:4px;padding:4px 8px;font:inherit;font-size:12px}
        .ui label{display:flex;gap:6px;align-items:center;font-size:12px;color:${MUTED};cursor:pointer}
        .ui{position:absolute;right:18px;top:16px;display:flex;gap:10px;align-items:center;z-index:2}
        .ttl{position:absolute;left:22px;top:16px;z-index:2}
        .ttl h1{margin:0;font-size:15px;font-weight:600;letter-spacing:.01em;color:#e8eef4}
        .ttl p{margin:3px 0 0;font-size:12px;color:${MUTED}}
        .ttl .now{margin-top:10px;font-size:12px;color:${INK}} .ttl .now b{color:${GOLD};font-weight:600}
        text{font-family:inherit}
      `}</style>
      <div className="ttl">
        <h1>ChemFish shared response programs</h1>
        <p>Drug responses as a biological flotilla</p>
        <div className="now"><b>{drug}</b> <span style={{ color: MUTED }}>{drugMeta.pathway} ·</span> current: <b>{D.programs[program].label.toLowerCase()}</b></div>
      </div>
      <div className="ui">
        <select aria-label="drug" value={drug} onChange={(e) => setDrug(e.target.value)}>{D.drugs.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.pathway}</option>)}</select>
        <select aria-label="program" value={program} onChange={(e) => setProgram(e.target.value)}>{D.program_order.map((p) => <option key={p} value={p}>{D.programs[p].label}</option>)}</select>
        <label><input type="checkbox" checked={showResid} onChange={(e) => setShowResid(e.target.checked)} /> residuals</label>
      </div>

      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <marker id="ah-gold" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={GOLD} /></marker>
          <marker id="ah-coral" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={CORAL} /></marker>
          <marker id="ah-dim" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#3b5468" /></marker>
        </defs>
        {/* banks */}
        <polygon points={poly([[-4, -6], [L + 6, -6], [L + 6, W + 6], [-4, W + 6]])} fill="#131821" />
        {/* lanes */}
        {D.program_order.map((p, i) => {
          const sel = i === s;
          return (
            <g key={p}>
              <polygon points={poly([[0, i * LANE], [L, i * LANE], [L, (i + 1) * LANE], [0, (i + 1) * LANE]])}
                fill={sel ? "rgba(245,197,66,0.10)" : i % 2 ? "#152131" : "#172535"} stroke={sel ? GOLD : "#203040"} strokeWidth={sel ? 0.5 : 0.25} strokeOpacity={sel ? 0.75 : 1} />
              {sel && <polygon points={poly([[0, i * LANE], [L, i * LANE], [L, (i + 1) * LANE], [0, (i + 1) * LANE]])} fill="none" stroke={GOLD} strokeWidth={1.4} opacity={0.35} filter="url(#glow)" />}
              {[0.25, 0.5, 0.75].map((f) => {
                const y = (i + f) * LANE; const a = iso(1.5, y), b = iso(L - 1.5, y);
                return <line key={f} className={`flow${sel ? " hot" : ""}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={sel ? GOLD : "#2a3c50"} strokeOpacity={sel ? 0.55 : 0.6} strokeWidth={sel ? 0.42 : 0.3} strokeDasharray="5 11" />;
              })}
              <text x={iso(L + 3.5, laneY(i))[0]} y={iso(L + 3.5, laneY(i))[1] + 1} fontSize={3.2} fill={sel ? GOLD : MUTED} fontWeight={sel ? 600 : 400}>{D.programs[p].label.replace(" program", "").replace(" (provisional)", "")}</text>
            </g>
          );
        })}
        {/* dock */}
        <polygon points={poly([[0, -1.5, 1.1], [DOCK, -1.5, 1.1], [DOCK, W + 1.5, 1.1], [0, W + 1.5, 1.1]])} fill="#2b3442" />
        <polygon points={P([iso(0, W + 1.5, 1.1), iso(DOCK, W + 1.5, 1.1), iso(DOCK, W + 1.5, 0), iso(0, W + 1.5, 0)])} fill="#1e2530" />
        <text x={iso(DOCK / 2, -3)[0]} y={iso(DOCK / 2, -3)[1] - 1} fontSize={2.8} fill={MUTED} textAnchor="middle" letterSpacing={0.3}>VEHICLE</text>

        {/* shared-current arrows (drawn first, under boats) */}
        {boats.map((b) => {
          const xe = b.x0 + (b.xg - b.x0) * fShared; if (Math.abs(xe - b.x0) < 0.6) return null;
          const a = iso(b.x0, b.y0, 0.15), e = iso(xe, b.y0, 0.15);
          return <line key={b.tissue} x1={a[0]} y1={a[1]} x2={e[0]} y2={e[1]} stroke={b.member ? GOLD : "#3b5468"} strokeWidth={b.member ? 0.55 : 0.3} opacity={b.member ? 0.95 : 0.7} markerEnd={b.member ? "url(#ah-gold)" : "url(#ah-dim)"} />;
        })}
        {/* ghosts + residual connectors */}
        {showResid && boats.map((b) => {
          if (!b.member) return null;
          const ye = b.y0 + (b.ya - b.y0) * fResid; const g = iso(b.xg, b.y0, 0.15), e = iso(b.xa, ye, 0.15);
          return (
            <g key={b.tissue} opacity={fShared > 0.98 ? 1 : 0}>
              {fResid > 0.02 && <line x1={g[0]} y1={g[1]} x2={e[0]} y2={e[1]} stroke={CORAL} strokeWidth={b.member ? 0.45 : 0.3} strokeDasharray="1.1 0.8" opacity={b.member ? 0.95 : 0.55} markerEnd="url(#ah-coral)" />}
              {fResid > 0.02 && <BoatGlyph x={b.xg} y={b.y0} z={0} member={b.member} ghost program={program} sel={false} />}
            </g>
          );
        })}
        {/* boats */}
        {boats.map((b, i) => {
          const x = b.x0 + (b.xg - b.x0) * fShared, y = b.y0 + (showResid ? (b.ya - b.y0) * fResid : 0);
          const bob = 0.18 * Math.sin(clock.current * 1.7 + i * 1.3);
          const lab = iso(x + 3.6, y, 0.9);
          return (
            <g key={b.tissue} onMouseEnter={() => setHover(b.tissue)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              <BoatGlyph x={x} y={y} z={bob} member={b.member} program={program} sel={hover === b.tissue} />
              {(b.member || hover === b.tissue) && <text x={lab[0]} y={lab[1] + 0.9} fontSize={2.6} fill={b.member ? INK : MUTED} opacity={b.member ? 0.95 : 0.8}>{b.tissue}</text>}
            </g>
          );
        })}
        {/* the two tiny concept labels, anchored to the lead member boat */}
        {lead && lead.xg - lead.x0 > 10 && fShared > 0.6 && (() => {
          const m = iso((lead.x0 + lead.xg) / 2, lead.y0 - 2.6, 0); return <text x={m[0]} y={m[1]} fontSize={2.7} fill={GOLD} letterSpacing={0.35} fontWeight={600} opacity={ease((fShared - 0.6) / 0.4)}>SHARED CURRENT</text>;
        })()}
        {lead && showResid && lead.xg - lead.x0 > 10 && fResid > 0.5 && (() => {
          const m = iso(lead.xa, (lead.y0 + lead.ya) / 2, 0); return <text x={m[0] - 3} y={m[1] - 2.2} textAnchor="end" fontSize={2.7} fill={CORAL} letterSpacing={0.35} fontWeight={600} opacity={ease((fResid - 0.5) / 0.5)}>RESIDUAL</text>;
        })()}
        {/* hover card */}
        {hover && (() => {
          const b = boats.find((q) => q.tissue === hover)!; const x = b.x0 + (b.xg - b.x0) * fShared, y = b.y0 + (showResid ? (b.ya - b.y0) * fResid : 0);
          const [cx, cy] = iso(x, y, 7);
          const lines = [b.tissue, `loading on ${program}  ${b.loading.toFixed(2)}`, `shared ${(b.frac * 100).toFixed(0)}% · residual ‖${b.residual.toFixed(2)}‖`, b.member ? "member of this program" : `not a member · strongest other: ${b.otherLane}`];
          return (
            <g pointerEvents="none">
              <rect x={cx - 1} y={cy - 12.5} width={Math.max(...lines.map((l) => l.length)) * 1.45 + 3} height={12.2} rx={0.8} fill="#0e1116" stroke="#273140" strokeWidth={0.25} opacity={0.96} />
              {lines.map((l, i) => <text key={i} x={cx + 0.6} y={cy - 9.6 + i * 2.9} fontSize={i === 0 ? 2.7 : 2.3} fontWeight={i === 0 ? 600 : 400} fill={i === 0 ? "#e8eef4" : i === 3 ? MUTED : INK}>{l}</text>)}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
