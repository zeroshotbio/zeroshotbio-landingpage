"use client";
/**
 * ChemFish response space — one fullscreen visualization.
 *
 * GEOMETRY (see export_space_json.py):
 *   - each point is a real drug × tissue response vector r in 23,993-gene space; origin = vehicle.
 *   - xyz = P r, where P is the uncentered rank-3 SVD loading of the 84 consensus responses.
 *   - for a frozen unit program axis u, the browser receives (r · u) per point and P u per axis.
 *       shared component in 3D  = (r · u) · (P u)          <- projection done in GENE space
 *       residual in 3D          = P r − (r · u) · (P u)
 *     Nothing here infers a projection from the 3D picture. A right angle in gene space is not
 *     generally a right angle after projection; that is expected.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
type OrbitControlsImpl = { addEventListener: (e: string, f: () => void) => void; removeEventListener: (e: string, f: () => void) => void };
import raw from "./data/space.json";

type Pt = { drug: string; tissue: string; stratum: string; xyz: number[]; norm: number; dot: Record<string, number> };
type Axis = { label: string; tissues: string[]; xyz: number[]; image_norm: number };
type Space = {
  extent: number; drugs: { id: string; pathway: string }[]; tissues: string[]; program_order: string[];
  axes: Record<string, Axis>; points: Pt[]; explained_variance: number[]; n_consensus: number; n_genes: number;
};
const DATA = raw as unknown as Space;
const SCALE = 10 / DATA.extent;                // cloud fits within ±10 world units
const BG = "#0b0e14";
const GOLD = "#ffd166", RESID = "#ff6b81", OBS = "#e8eef5";
const PATHWAY: Record<string, string> = { Notch: "#4fd1c5", TGFb: "#b794f4", BMP: "#a3e635", FGF: "#f472b6", Wnt: "#60a5fa", Shh: "#fb923c", RA: "#d6b26a" };
const drugColor = (d: string) => PATHWAY[DATA.drugs.find((x) => x.id === d)?.pathway ?? ""] ?? "#9aa4b2";
const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]).multiplyScalar(SCALE);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ fat line (imperative) */
function makeLine(color: string, width: number, opacity: number, dashed = false) {
  const geo = new LineGeometry(); geo.setPositions([0, 0, 0, 0, 0, 0]);
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: width, transparent: true, opacity, dashed, dashSize: 0.35, gapSize: 0.22, depthWrite: false });
  const line = new Line2(geo, mat); line.frustumCulled = false; return line;
}
function setLine(line: Line2, a: THREE.Vector3, b: THREE.Vector3, opacity: number) {
  line.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
  if ((line.material as LineMaterial).dashed) line.computeLineDistances();
  (line.material as LineMaterial).opacity = opacity; line.visible = opacity > 0.005;
}
function useResolution(lines: Line2[]) {
  const { size, viewport } = useThree();
  useEffect(() => { lines.forEach((l) => (l.material as LineMaterial).resolution.set(size.width * viewport.dpr, size.height * viewport.dpr)); }, [size, viewport.dpr, lines]);
}

/* ------------------------------------------------------------------ the point cloud */
type Sel = { drug: string; program: string; decomp: boolean };
function Cloud({ sel, hover, setHover, pinned, togglePin }: { sel: Sel; hover: number | null; setHover: (i: number | null) => void; pinned: Set<number>; togglePin: (i: number) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const n = DATA.points.length;
  const cur = useMemo(() => new Float32Array(n).fill(0.05), [n]);
  const members = new Set(DATA.axes[sel.program].tissues);
  const target = useMemo(() => DATA.points.map((p) => {
    const mine = p.drug === sel.drug;
    if (mine && members.has(p.tissue)) return p.stratum === "consensus" ? 1 : 0.55;
    if (mine) return 0.40;
    return p.stratum === "consensus" ? 0.10 : 0.05;
  }), [sel.drug, sel.program]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    DATA.points.forEach((p, i) => {
      const s = p.stratum === "consensus" ? 0.115 : 0.06;
      m.compose(v3(p.xyz), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); mesh.current.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6);
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const t = target[i] + (hover === i || pinned.has(i) ? 0.35 : 0);
      const v = cur[i] + (t - cur[i]) * k;
      if (Math.abs(v - cur[i]) > 1e-4) dirty = true;
      cur[i] = v;
      tmp.set(drugColor(DATA.points[i].drug)).multiplyScalar(0.03 + 1.05 * v);
      mesh.current.setColorAt(i, tmp);
    }
    if (dirty && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  const labelFor = (i: number) => `${DATA.points[i].drug} · ${DATA.points[i].tissue}`;
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, n]}
        onPointerMove={(e) => { e.stopPropagation(); setHover(e.instanceId ?? null); }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) togglePin(e.instanceId); }}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      {[...(hover !== null ? [hover] : []), ...Array.from(pinned)].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <Html key={i} position={v3(DATA.points[i].xyz)} style={{ pointerEvents: "none", transform: "translate(10px,-14px)" }}>
          <div className="lbl" style={{ color: drugColor(DATA.points[i].drug) }}>{labelFor(i)}</div>
        </Html>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ program axis + decomposition */
function ProgramGeometry({ sel, revealKey }: { sel: Sel; revealKey: number }) {
  const AXLEN = 11.5;
  const axisLine = useMemo(() => makeLine(GOLD, 2.2, 0.9), []);
  const cone = useRef<THREE.Mesh>(null!);
  const dir = useRef(new THREE.Vector3(1, 0, 0));
  const reveal = useRef(0);
  useEffect(() => { reveal.current = 0; }, [revealKey]);
  // one slot per tissue that can ever be a member of any program
  const slotNames = useMemo(() => Array.from(new Set(DATA.program_order.flatMap((p) => DATA.axes[p].tissues))), []);
  const slots = useMemo(() => slotNames.map(() => ({
    obs: makeLine(OBS, 1.4, 0), shared: makeLine(GOLD, 3.2, 0), resid: makeLine(RESID, 1.6, 0, true),
    tip: new THREE.Vector3(), foot: new THREE.Vector3(), alpha: 0,
  })), [slotNames]);
  const allLines = useMemo(() => [axisLine, ...slots.flatMap((s) => [s.obs, s.shared, s.resid])], [axisLine, slots]);
  useResolution(allLines);
  const [labels, setLabels] = useState<{ tissue: string; tip: THREE.Vector3; foot: THREE.Vector3; alpha: number; main: boolean }[]>([]);
  const frame = useRef(0);

  useFrame((_, dt) => {
    reveal.current += dt;
    const k = 1 - Math.exp(-dt * 5);
    const ax = DATA.axes[sel.program];
    const axImg = v3(ax.xyz);                       // P u, scaled to world units
    const targetDir = axImg.clone().normalize();
    dir.current.lerp(targetDir, k).normalize();
    const a = dir.current.clone().multiplyScalar(-AXLEN), b = dir.current.clone().multiplyScalar(AXLEN);
    setLine(axisLine, a, b, 0.85);
    cone.current.position.copy(b);
    cone.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.current);
    const t = reveal.current;
    const fObs = smooth(t / 0.6), fSh = smooth((t - 0.45) / 0.6), fRe = smooth((t - 0.95) / 0.6);
    const members = new Set(ax.tissues);
    let best = -1, bestDot = -1;
    slotNames.forEach((tissue, i) => {
      const s = slots[i];
      const p = DATA.points.find((q) => q.drug === sel.drug && q.tissue === tissue && q.stratum === "consensus");
      const active = !!p && members.has(tissue);
      const targetAlpha = active ? 1 : 0;
      s.alpha += (targetAlpha - s.alpha) * k;
      if (p) {
        const tip = v3(p.xyz);
        // shared component in 3D = (r·u) · (P u)  — dot product was computed in gene space
        const foot = axImg.clone().multiplyScalar(p.dot[sel.program]);
        s.tip.lerp(tip, k); s.foot.lerp(foot, k);
        if (active && Math.abs(p.dot[sel.program]) > bestDot) { bestDot = Math.abs(p.dot[sel.program]); best = i; }
      }
      const o = new THREE.Vector3();
      setLine(s.obs, o, s.tip.clone().multiplyScalar(fObs), s.alpha * 0.9);
      const dec = sel.decomp ? s.alpha : 0;
      setLine(s.shared, o, s.foot.clone().multiplyScalar(fSh), dec * 0.95);
      setLine(s.resid, s.foot, s.foot.clone().lerp(s.tip, fRe), dec * 0.9);   // residual: foot of the projection -> observed tip
    });
    if (++frame.current % 6 === 0) {
      setLabels(slotNames.map((tissue, i) => ({ tissue, tip: slots[i].tip.clone(), foot: slots[i].foot.clone(), alpha: slots[i].alpha * (i === best ? 1 : 1), main: i === best }))
        .filter((l) => l.alpha > 0.05));
    }
  });
  const ax = DATA.axes[sel.program];
  const tipLabel = dir.current.clone().multiplyScalar(AXLEN + 0.9);
  const fRe = smooth((reveal.current - 0.95) / 0.6), fSh = smooth((reveal.current - 0.45) / 0.6);
  return (
    <>
      <primitive object={axisLine} />
      <mesh ref={cone}><coneGeometry args={[0.2, 0.8, 16]} /><meshBasicMaterial color={GOLD} toneMapped={false} /></mesh>
      <Html position={tipLabel} style={{ pointerEvents: "none", transform: "translate(-50%,-140%)" }}><div className="lbl gold">{ax.label.toUpperCase()}</div></Html>
      {slots.map((s, i) => <group key={i}><primitive object={s.obs} /><primitive object={s.shared} /><primitive object={s.resid} /></group>)}
      {labels.map((l, i) => (
        <group key={l.tissue}>
          <Html position={l.tip} style={{ pointerEvents: "none", transform: `translate(9px,${-10 + 13 * ((i % 3) - 1)}px)`, opacity: l.alpha }}><div className="lbl dim">{l.tissue}</div></Html>
          <mesh position={l.foot} visible={sel.decomp && fSh > 0.2}><sphereGeometry args={[0.1, 10, 10]} /><meshBasicMaterial color={GOLD} toneMapped={false} /></mesh>
          {l.main && sel.decomp && (
            <>
              <Html position={l.foot.clone().multiplyScalar(0.5)} style={{ pointerEvents: "none", transform: "translate(-50%,12px)", opacity: l.alpha * fSh }}><div className="lbl gold">SHARED PROGRAM</div></Html>
              <Html position={l.foot.clone().lerp(l.tip, 0.5)} style={{ pointerEvents: "none", transform: "translate(10px,-50%)", opacity: l.alpha * fRe }}><div className="lbl resid">RESIDUAL</div></Html>
            </>
          )}
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ camera: ease to a view that shows the axis side-on */
function CameraRig({ sel, controls }: { sel: Sel; controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const touched = useRef(false);
  const target = useMemo(() => {
    const d = v3(DATA.axes[sel.program].xyz).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(d, up).normalize();
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    return side.multiplyScalar(19).add(up.clone().multiplyScalar(6.5)).add(d.clone().multiplyScalar(-2));
  }, [sel.program]);
  useEffect(() => {
    const c = controls.current; if (!c) return;
    const start = () => (touched.current = true);
    c.addEventListener("start", start); return () => c.removeEventListener("start", start);
  }, [controls]);
  useEffect(() => { touched.current = false; }, [sel.program]);
  useFrame((_, dt) => {
    if (touched.current) return;
    camera.position.lerp(target, 1 - Math.exp(-dt * 1.6));
    camera.lookAt(0, 0, 0);
  }, -1);
  return null;
}

/* ------------------------------------------------------------------ root */
export default function Space() {
  const [sel, setSel] = useState<Sel>({ drug: "LY411575", program: "neural", decomp: true });
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<Set<number>>(new Set());
  const [revealKey, setRevealKey] = useState(0);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const update = (patch: Partial<Sel>) => { setSel((s) => ({ ...s, ...patch })); if (patch.drug || patch.program) setRevealKey((k) => k + 1); };
  const togglePin = (i: number) => setPinned((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div style={{ position: "fixed", inset: 0, background: BG, overflow: "hidden", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
      <style>{`
        .lbl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:#dfe6ee;text-shadow:0 0 8px #0b0e14,0 0 2px #0b0e14}
        .lbl.gold{color:${GOLD}} .lbl.resid{color:${RESID}} .lbl.dim{color:#9aa4b2;letter-spacing:.06em;text-transform:none;font-size:11px}
        .ctl{position:absolute;left:14px;top:12px;display:flex;gap:8px;align-items:center;font-size:11px;color:#8b95a3;letter-spacing:.04em;z-index:10}
        .ctl select{background:#12161e;color:#dfe6ee;border:1px solid #232a36;border-radius:3px;padding:3px 6px;font:inherit;font-size:11px}
        .ctl label{display:flex;align-items:center;gap:5px;cursor:pointer}
        .cap{position:absolute;right:14px;bottom:10px;font-size:10px;color:#4f5968;letter-spacing:.04em;z-index:10}
        .cap b{color:#8b95a3;font-weight:500}
      `}</style>
      <div className="ctl">
        <select value={sel.drug} onChange={(e) => update({ drug: e.target.value })} aria-label="drug">
          {DATA.drugs.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.pathway}</option>)}
        </select>
        <select value={sel.program} onChange={(e) => update({ program: e.target.value })} aria-label="program">
          {DATA.program_order.map((p) => <option key={p} value={p}>{DATA.axes[p].label}</option>)}
        </select>
        <label><input type="checkbox" checked={sel.decomp} onChange={(e) => update({ decomp: e.target.checked })} /> projection</label>
      </div>
      <div className="cap"><b>{DATA.n_consensus}</b> drug × tissue responses · uncentered PCA of {DATA.n_genes.toLocaleString()} genes · <b>origin = vehicle</b> · projection computed in gene space</div>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }} camera={{ position: [19, 6.5, -2], fov: 40, near: 0.1, far: 400 }}
        onCreated={({ gl }) => gl.setClearColor(BG)} onPointerMissed={() => setPinned(new Set())}>
        <Grid position={[0, -0.01, 0]} args={[60, 60]} cellSize={1} cellThickness={0.5} cellColor="#182030" sectionSize={5} sectionThickness={0.9} sectionColor="#223044" fadeDistance={55} fadeStrength={1.6} infiniteGrid />
        <mesh><sphereGeometry args={[0.16, 16, 16]} /><meshBasicMaterial color="#c9d3dc" toneMapped={false} /></mesh>
        <Cloud sel={sel} hover={hover} setHover={setHover} pinned={pinned} togglePin={togglePin} />
        <ProgramGeometry sel={sel} revealKey={revealKey} />
        <CameraRig sel={sel} controls={controls} />
        <OrbitControls ref={controls as never} enableDamping dampingFactor={0.06} enablePan={false} minDistance={8} maxDistance={90} autoRotate autoRotateSpeed={0.25} />
      </Canvas>
    </div>
  );
}
