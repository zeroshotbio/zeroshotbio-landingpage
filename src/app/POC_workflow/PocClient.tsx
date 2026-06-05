"use client";
// Mode-1 POC wizard (v2) — wired to the static JSON in /public/POC_workflow/.
// Renders precomputed JSON only: no live modeling, no live UMAP. Both 2D regimes (phenotype +
// chemistry) are precomputed. The through-line is MoA as the explicit bridge: two routes
// (chemistry-predicted vs phenotype-neighbor mechanism) and whether they agree.
// Honest cell-line (NOT tissue) + projection labeling throughout.
import { useEffect, useMemo, useRef, useState } from "react";

type Gene = { gene: string; lfc: number };
type SharedGene = { gene: string; lfc_query: number; lfc_neighbor: number };
type Neighbor = { id: string; display: string; similarity: number; rank: number; moa_fine: string };
type Overlap = { id: string; shared_moa: boolean; shared_targets: string[] };
type Route = { nn_id: string; nn_similarity: number; nn_moa: string; predicted_moa: string; metric: string };
type Routes = {
  query_moa: string | null; chem_route: Route; pheno_route: Route;
  chem_route_matches_truth: boolean; pheno_route_matches_truth: boolean; routes_agree: boolean;
};
type Consensus = { moa: string | null; count: number; k: number; fraction: number };
type Why = { neighbor: string; shared_up: SharedGene[]; shared_down: SharedGene[]; basis: string };
type Drug = {
  id: string; display_name: string; pubchem_cid: number | null;
  moa_fine: string; moa_broad: string; targets: string[];
  step1_structure: { smiles: string; svg: string; source: string };
  step2_fingerprint: { basis: string; n_cell_lines: number; dose_uM: number; control: string;
    n_genes_tested: number; top_up: Gene[]; top_down: Gene[] };
  step3_embedding: { coords2d: [number, number]; chem2d: [number, number];
    neighbors: Neighbor[]; chem_neighbors: Neighbor[]; projection: string; chem_projection: string };
  step4_mechanism: { moa_fine: string; targets: string[]; neighbor_overlap: Overlap[];
    routes: Routes; pheno_consensus: Consensus; chem_consensus: Consensus; why: Why };
  step5_reliability: { nn_id: string; nn_similarity: number; nn_distance: number;
    horizon_band: string; metric: string; basis: string };
  step6_report: { headline: string; mechanism_text: string; confidence_text: string;
    bridge_text: string; caveat: string };
};
type Manifest = {
  honesty_label: string; pca_var_explained: number[]; chem_var_explained: number[];
  n_reference_drugs: number; knn: number; nn_dist_tertiles: number[]; ref_nn_dist: number[];
  moa_retrieval_note: string;
};
type Data = { manifest: Manifest; drugs: Drug[] };
type CPoint = { id: string; moa_fine: string; coords2d: [number, number]; chem2d: [number, number]; is_demo: boolean };
type Const = { points: CPoint[] };

const STEPS = ["Submit compound", "Wet-lab exposure", "Response fingerprint",
  "Project into atlas", "Contextualized results", "Atlas report"];
const QUICKSTART = "Panobinostat"; // genuine in-domain + MoA-matching win

function moaColor(moa: string): string {
  if (!moa || moa.toLowerCase() === "unclear") return "#cfcfcf";
  let h = 0; for (let i = 0; i < moa.length; i++) h = (h * 31 + moa.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 58%)`;
}
const BAND_LABEL: Record<string, string> = {
  "in-domain": "In-domain", "near-edge": "Near edge", "out-of-domain": "Out-of-domain",
};

export default function PocClient() {
  const [data, setData] = useState<Data | null>(null);
  const [cloud, setCloud] = useState<Const | null>(null);
  const [selId, setSelId] = useState("");
  const [smiles, setSmiles] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch("/POC_workflow/drugs.json").then((r) => r.json()).then(setData).catch(() => setNote("Could not load demo data."));
    fetch("/POC_workflow/constellation.json").then((r) => r.json()).then(setCloud).catch(() => {});
  }, []);

  const sel = useMemo(() => data?.drugs.find((d) => d.id === selId) || null, [data, selId]);
  const honesty = data?.manifest.honesty_label ??
    "Proof-of-concept on a public cell-line reference, Tahoe-100M, standing in for the zebrafish atlas.";

  function loadDrug(id: string) {
    const d = data?.drugs.find((x) => x.id === id);
    setSelId(id); setSmiles(d ? d.step1_structure.smiles : ""); setNote(""); setRevealed(false);
  }
  function loadFromSmiles() {
    const hit = data?.drugs.find((d) => d.step1_structure.smiles.trim() === smiles.trim());
    if (hit) { setSelId(hit.id); setNote(""); setRevealed(false); }
    else setNote("This proof-of-concept renders the curated demo set. Arbitrary-SMILES depiction comes in a later step — pick a demo or use Quick-Start.");
  }
  function quickStart() { loadDrug(QUICKSTART); setStep(1); }
  function go(n: number) { if (n >= 1 && n <= 6 && (sel || n === 1)) setStep(n); }

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl mb-6">
        <div className="rounded-md border border-gray-300 bg-gray-100 px-4 py-3 text-center">
          <p className="roboto-slab-regular text-xs sm:text-sm text-gray-700 leading-snug">{honesty}</p>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <h1 className="roboto-slab-medium text-2xl sm:text-3xl text-gray-900">Compound-insight workflow</h1>
          <button onClick={quickStart}
            className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-4 py-2 text-sm hover:bg-gray-700">
            Quick-Start ▸
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex flex-wrap gap-2 mb-7">
          {STEPS.map((s, i) => {
            const n = i + 1; const active = n === step; const avail = n === 1 || !!sel;
            return (
              <button key={s} onClick={() => go(n)} disabled={!avail}
                className={`roboto-slab-regular text-xs px-3 py-1 rounded-full border transition ${
                  active ? "border-gray-700 bg-gray-800 text-gray-50"
                  : avail ? "border-gray-300 text-gray-600 hover:bg-gray-100" : "border-gray-200 text-gray-300 cursor-not-allowed"}`}>
                {n}. {s}
              </button>
            );
          })}
        </div>

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 min-h-[420px]">
          {step === 1 && <Step1 {...{ data, sel, selId, loadDrug, smiles, setSmiles, loadFromSmiles, note, quickStart }} />}
          {step === 2 && sel && <Step2 sel={sel} revealed={revealed} setRevealed={setRevealed} />}
          {step === 3 && sel && <Step3 sel={sel} />}
          {step === 4 && sel && <Step4 sel={sel} cloud={cloud} manifest={data?.manifest} />}
          {step === 5 && sel && <Step5 sel={sel} manifest={data?.manifest} />}
          {step === 6 && sel && <Step6 sel={sel} honesty={honesty} />}
          {step > 1 && !sel && <p className="roboto-slab-regular text-sm text-gray-400">Select a compound in Step 1 (or Quick-Start) first.</p>}
        </section>

        {/* Nav */}
        <div className="flex justify-between mt-5">
          <button onClick={() => go(step - 1)} disabled={step === 1}
            className="roboto-slab-regular rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-100">◂ Back</button>
          <button onClick={() => go(step + 1)} disabled={step === 6 || !sel}
            className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700">Next ▸</button>
        </div>

        <p className="roboto-slab-regular text-xs text-gray-400 mt-8 text-center">{honesty}</p>
      </div>
    </main>
  );
}

/* ---------------- Step 1 ---------------- */
function Step1({ data, sel, selId, loadDrug, smiles, setSmiles, loadFromSmiles, note, quickStart }: any) {
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 1 — Submit compound</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-5">Pick a demo compound or paste its SMILES; we render the 2D structure.</p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1">
            <span className="roboto-slab-regular block text-xs text-gray-500 mb-1">Demo compound</span>
            <select value={selId} onChange={(e) => loadDrug(e.target.value)}
              className="roboto-slab-regular w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800">
              <option value="">— select —</option>
              {data?.drugs.map((d: Drug) => <option key={d.id} value={d.id}>{d.display_name} ({d.moa_fine})</option>)}
            </select>
          </label>
          <button onClick={quickStart}
            className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-4 py-2 text-sm hover:bg-gray-700">Quick-Start</button>
        </div>
        <label className="block">
          <span className="roboto-slab-regular block text-xs text-gray-500 mb-1">SMILES</span>
          <div className="flex gap-2">
            <input value={smiles} onChange={(e) => setSmiles(e.target.value)} placeholder="paste a SMILES string…"
              className="roboto-slab-regular flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 font-mono" />
            <button onClick={loadFromSmiles}
              className="roboto-slab-medium rounded-md border border-gray-400 bg-white text-gray-700 px-4 py-2 text-sm hover:bg-gray-100">Load</button>
          </div>
        </label>
        {note && <p className="roboto-slab-regular text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-md px-3 py-2">{note}</p>}
        <div className="mt-2 rounded-md border border-gray-200 bg-white p-4 flex flex-col items-center min-h-[260px] justify-center">
          {sel ? (
            <>
              <div aria-label={`2D structure of ${sel.display_name}`} dangerouslySetInnerHTML={{ __html: sel.step1_structure.svg }} />
              <div className="text-center mt-3">
                <div className="roboto-slab-medium text-gray-800">{sel.display_name}</div>
                <div className="roboto-slab-regular text-sm text-gray-500">{sel.moa_fine}{sel.targets.length ? ` · target(s): ${sel.targets.join(", ")}` : ""}</div>
                {sel.pubchem_cid && <div className="roboto-slab-regular text-xs text-gray-400 mt-1">PubChem CID {sel.pubchem_cid} · {sel.step1_structure.source}</div>}
              </div>
            </>
          ) : <span className="roboto-slab-regular text-sm text-gray-400">No compound selected — choose a demo or Quick-Start.</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 2 ---------------- */
function Step2({ sel, revealed, setRevealed }: { sel: Drug; revealed: boolean; setRevealed: (b: boolean) => void }) {
  const fp = sel.step2_fingerprint;
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 2 — Wet-lab exposure</h2>
      <p className="roboto-slab-regular text-sm text-gray-600 leading-relaxed mb-4">
        In production, this is the wet step: <strong>dose zebrafish embryos with {sel.display_name},
        then run whole-organism single-cell RNA-seq</strong> to read how every cell type responds.
      </p>
      <p className="roboto-slab-regular text-sm text-gray-500 leading-relaxed mb-5">
        For this proof-of-concept we skip the bench and reveal a <strong>pre-measured public signature</strong> as
        the stand-in readout — a perturbation profile from <strong>cancer cell lines</strong> (Tahoe-100M), not
        zebrafish tissues.
      </p>
      {!revealed ? (
        <button onClick={() => setRevealed(true)}
          className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-5 py-2 text-sm hover:bg-gray-700">
          Reveal the stand-in readout ▸
        </button>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white p-5">
          <div className="roboto-slab-medium text-gray-800 mb-2">Stand-in readout acquired</div>
          <ul className="roboto-slab-regular text-sm text-gray-600 space-y-1">
            <li>• Measured across <strong>{fp.n_cell_lines} cancer cell lines</strong> (not tissues)</li>
            <li>• Dose <strong>{fp.dose_uM} µM</strong> vs <strong>{fp.control}</strong></li>
            <li>• <strong>{fp.n_genes_tested.toLocaleString()}</strong> genes tested for differential response</li>
          </ul>
          <p className="roboto-slab-regular text-xs text-gray-400 mt-3">The per-gene fingerprint is shown in Step 3.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Step 3 ---------------- */
function GeneBar({ g, max, dir }: { g: Gene; max: number; dir: "up" | "down" }) {
  const w = Math.min(100, (Math.abs(g.lfc) / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="roboto-slab-regular text-xs text-gray-700 w-28 truncate" title={g.gene}>{g.gene}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded">
        <div className={`h-3 rounded ${dir === "up" ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${w}%` }} />
      </div>
      <span className="roboto-slab-regular text-xs text-gray-500 w-12 text-right">{g.lfc.toFixed(2)}</span>
    </div>
  );
}
function Step3({ sel }: { sel: Drug }) {
  const fp = sel.step2_fingerprint;
  const maxUp = Math.max(...fp.top_up.map((g) => Math.abs(g.lfc)), 0.1);
  const maxDn = Math.max(...fp.top_down.map((g) => Math.abs(g.lfc)), 0.1);
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 3 — Response fingerprint</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-4">
        Mean log₂ fold-change <strong>averaged across {fp.n_cell_lines} cancer cell lines</strong> ({fp.dose_uM} µM vs {fp.control}).
        Top named genes shown.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="roboto-slab-medium text-sm text-emerald-700 mb-2">Induced ▲</div>
          <div className="space-y-1.5">{fp.top_up.slice(0, 10).map((g) => <GeneBar key={g.gene} g={g} max={maxUp} dir="up" />)}</div>
        </div>
        <div>
          <div className="roboto-slab-medium text-sm text-rose-700 mb-2">Repressed ▼</div>
          <div className="space-y-1.5">{fp.top_down.slice(0, 10).map((g) => <GeneBar key={g.gene} g={g} max={maxDn} dir="down" />)}</div>
        </div>
      </div>
      <p className="roboto-slab-regular text-xs text-gray-400 mt-4">{fp.basis}</p>
    </div>
  );
}

/* ---------------- Step 4 — interactive atlas (pan/zoom/hover/click, regime toggle, MoA overlay) -------- */
type Regime = "phenotype" | "chemistry";
function coordOf(p: CPoint, r: Regime): [number, number] { return r === "phenotype" ? p.coords2d : p.chem2d; }
function qCoord(sel: Drug, r: Regime): [number, number] { return r === "phenotype" ? sel.step3_embedding.coords2d : sel.step3_embedding.chem2d; }
function regimeNeighbors(sel: Drug, r: Regime): Neighbor[] { return r === "phenotype" ? sel.step3_embedding.neighbors : sel.step3_embedding.chem_neighbors; }

function Step4({ sel, cloud, manifest }: { sel: Drug; cloud: Const | null; manifest?: Manifest }) {
  const [regime, setRegime] = useState<Regime>("phenotype");
  const [colorByMoa, setColorByMoa] = useState(true);
  const W = 640, H = 440, pad = 28;
  const pts = useMemo(() => cloud?.points ?? [], [cloud]);

  // base (untransformed) screen positions for the active regime
  const base = useMemo(() => {
    const xs = pts.map((p) => coordOf(p, regime)[0]), ys = pts.map((p) => coordOf(p, regime)[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
    const sy = (y: number) => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);
    return { sx, sy };
  }, [pts, regime]);

  // pan/zoom transform (precomputed coords only — no recompute of the embedding)
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  useEffect(() => { setView({ k: 1, tx: 0, ty: 0 }); }, [regime]); // reset view on regime switch
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState<{ id: string; moa: string; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const k = Math.min(12, Math.max(1, v.k * factor));
      const f = k / v.k;
      return { k, tx: mx - f * (mx - v.tx), ty: my - f * (my - v.ty) };
    });
  }
  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.x = e.clientX; drag.current.y = e.clientY;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }
  function onUp() { drag.current = null; }

  const tf = (x: number, y: number): [number, number] => [view.tx + view.k * x, view.ty + view.k * y];
  const q = qCoord(sel, regime);
  const qx = base.sx(q[0]), qy = base.sy(q[1]);
  const nbrs = regimeNeighbors(sel, regime);
  const nbrIds = new Set(nbrs.map((n) => n.id));
  const coordById = (id: string) => { const p = pts.find((pp) => pp.id === id); return p ? coordOf(p, regime) : null; };

  const vexpArr = regime === "phenotype" ? manifest?.pca_var_explained : manifest?.chem_var_explained;
  const vexp = vexpArr ? `${((vexpArr[0] + vexpArr[1]) * 100).toFixed(1)}%` : "low";
  const r0 = 3 / view.k, rN = 5 / view.k;

  // MoA legend: query + its neighbors in this regime
  const legend = useMemo(() => {
    const m = new Map<string, string>();
    m.set(sel.moa_fine, moaColor(sel.moa_fine));
    nbrs.forEach((n) => m.set(n.moa_fine, moaColor(n.moa_fine)));
    return Array.from(m.entries());
  }, [sel, nbrs]);

  const pickedPt = picked ? pts.find((p) => p.id === picked) : null;

  if (!pts.length) return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 4 — Project into the atlas</h2>
      <p className="roboto-slab-regular text-sm text-gray-400 mt-4">Loading the reference atlas…</p>
    </div>
  );

  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 4 — Project into the atlas</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
        {sel.display_name} (◆) placed among the {pts.length}-compound reference. Toggle the regime to see the
        <strong> two routes</strong>: who its neighbors are by <strong>phenotype</strong> vs by <strong>chemistry</strong>.
        Drag to pan, scroll to zoom, hover for identity, click a point to inspect.
      </p>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
          {(["phenotype", "chemistry"] as Regime[]).map((rg) => (
            <button key={rg} onClick={() => { setRegime(rg); setPicked(null); }}
              className={`roboto-slab-regular text-xs px-3 py-1.5 ${regime === rg ? "bg-gray-800 text-gray-50" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
              {rg === "phenotype" ? "Phenotype space" : "Chemistry space"}
            </button>
          ))}
        </div>
        <button onClick={() => setColorByMoa((c) => !c)}
          className="roboto-slab-regular text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100">
          Color: {colorByMoa ? "by MoA" : "neutral"}
        </button>
        <button onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
          className="roboto-slab-regular text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100">
          Reset view
        </button>
        <span className="roboto-slab-regular text-xs text-gray-400">zoom {view.k.toFixed(1)}×</span>
      </div>

      <div className="relative rounded-md border border-gray-200 bg-white overflow-hidden" style={{ touchAction: "none" }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="interactive atlas projection"
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { onUp(); setHover(null); }}
          style={{ cursor: drag.current ? "grabbing" : "grab", display: "block" }}>
          {/* neighbor links (this regime's route) */}
          {nbrs.map((n) => {
            const c = coordById(n.id); if (!c) return null;
            const [x1, y1] = tf(qx, qy); const [x2, y2] = tf(base.sx(c[0]), base.sy(c[1]));
            return <line key={n.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />;
          })}
          {/* reference cloud */}
          {pts.map((p) => {
            if (p.id === sel.id) return null;
            const c = coordOf(p, regime); const [cx, cy] = tf(base.sx(c[0]), base.sy(c[1]));
            const isN = nbrIds.has(p.id); const isPick = p.id === picked;
            const fill = colorByMoa ? moaColor(p.moa_fine) : (isN ? "#6b7280" : "#d1d5db");
            return <circle key={p.id} cx={cx} cy={cy} r={isN ? rN : r0}
              fill={fill} opacity={isN ? 1 : 0.5}
              stroke={isPick ? "#0d9488" : isN ? "#1f2937" : "none"} strokeWidth={(isPick ? 2 : isN ? 1.5 : 0) / view.k}
              onMouseEnter={(e) => { const rect = svgRef.current!.getBoundingClientRect(); setHover({ id: p.id, moa: p.moa_fine, x: e.clientX - rect.left, y: e.clientY - rect.top }); }}
              onMouseLeave={() => setHover(null)}
              onClick={() => { if (!drag.current?.moved) setPicked(p.id); }}
              style={{ cursor: "pointer" }} />;
          })}
          {/* query marker */}
          {(() => { const [x, y] = tf(qx, qy); const s = 6; return (
            <g>
              <rect x={x - s} y={y - s} width={2 * s} height={2 * s} transform={`rotate(45 ${x} ${y})`} fill="#111827" />
              <text x={x + 10} y={y + 4} className="roboto-slab-medium" fontSize={12} fill="#111827">{sel.display_name}</text>
            </g>); })()}
        </svg>

        {hover && (
          <div className="pointer-events-none absolute z-10 rounded bg-gray-900/90 px-2 py-1 text-[11px] text-gray-50"
            style={{ left: Math.min(hover.x + 10, W - 160), top: hover.y + 10 }}>
            <div className="roboto-slab-medium">{hover.id}</div>
            <div className="text-gray-300">{hover.moa}</div>
          </div>
        )}
      </div>

      {/* legend + picked readout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        {colorByMoa && legend.map(([moa, col]) => (
          <span key={moa} className="inline-flex items-center gap-1 roboto-slab-regular text-[11px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: col }} /> {moa}
          </span>
        ))}
      </div>
      {pickedPt && (
        <p className="roboto-slab-regular text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded px-3 py-2">
          Selected: <strong>{pickedPt.id}</strong> — {pickedPt.moa_fine}
          {nbrIds.has(pickedPt.id) ? ` · a ${regime} neighbor of ${sel.display_name}` : ""}
        </p>
      )}

      <p className="roboto-slab-regular text-xs text-gray-400 mt-3">
        Honest note: this 2D layout is an <strong>illustrative low-variance PCA projection</strong>
        {" "}(PC1+PC2 ≈ {vexp} of variance in {regime} space) for visualization only — both regimes are
        precomputed, nothing is recomputed live. Neighbors are computed in the{" "}
        <strong>{regime === "phenotype" ? "full phenotype space (HVG-2000 cosine)" : "full chemistry space (ECFP Tanimoto)"}</strong>,
        not from these 2D distances.
      </p>
    </div>
  );
}

/* ---------------- Step 5 — two routes, why-it-resembles, consensus, reliability histogram ------------- */
function AgreeBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`roboto-slab-regular text-[11px] px-2 py-0.5 rounded-full border ${
      ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-gray-50 text-gray-500"}`}>
      {ok ? "✓ " : "— "}{label}
    </span>
  );
}
function RouteCard({ title, route, matches, accent }: { title: string; route: Route; matches: boolean; accent: string }) {
  return (
    <div className="flex-1 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="roboto-slab-medium text-sm" style={{ color: accent }}>{title}</div>
        <AgreeBadge ok={matches} label="matches true MoA" />
      </div>
      <div className="roboto-slab-regular text-xs text-gray-400 mb-2">{route.metric}</div>
      <div className="roboto-slab-regular text-sm text-gray-700">
        Nearest anchor: <strong>{route.nn_id}</strong> <span className="text-gray-400">(sim {route.nn_similarity.toFixed(3)})</span>
      </div>
      <div className="roboto-slab-regular text-sm text-gray-600 mt-1">
        Predicted mechanism → <span className="roboto-slab-medium" style={{ color: moaColor(route.predicted_moa) }}>{route.predicted_moa}</span>
      </div>
    </div>
  );
}
function SharedGenes({ title, genes, dir }: { title: string; genes: SharedGene[]; dir: "up" | "down" }) {
  if (!genes.length) return (
    <div className="flex-1"><div className={`roboto-slab-medium text-xs mb-1 ${dir === "up" ? "text-emerald-700" : "text-rose-700"}`}>{title}</div>
      <div className="roboto-slab-regular text-xs text-gray-400">none in common</div></div>
  );
  return (
    <div className="flex-1">
      <div className={`roboto-slab-medium text-xs mb-1 ${dir === "up" ? "text-emerald-700" : "text-rose-700"}`}>{title}</div>
      <div className="flex flex-wrap gap-1">
        {genes.slice(0, 6).map((g) => (
          <span key={g.gene} title={`query ${g.lfc_query} · neighbor ${g.lfc_neighbor}`}
            className={`roboto-slab-regular text-[11px] px-1.5 py-0.5 rounded border ${
              dir === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {g.gene}
          </span>
        ))}
      </div>
    </div>
  );
}
function NNHistogram({ manifest, queryDist, band }: { manifest: Manifest; queryDist: number; band: string }) {
  const W = 600, H = 150, pad = 26;
  const vals = manifest.ref_nn_dist;
  const [p33, p66] = manifest.nn_dist_tertiles;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const NB = 28; const bins = new Array(NB).fill(0);
  vals.forEach((v) => { const i = Math.min(NB - 1, Math.floor(((v - lo) / (hi - lo || 1)) * NB)); bins[i]++; });
  const maxc = Math.max(...bins);
  const bx = (v: number) => pad + ((v - lo) / (hi - lo || 1)) * (W - 2 * pad);
  const bandColor = (v: number) => v <= p33 ? "#a7f3d0" : v <= p66 ? "#fde68a" : "#fecaca";
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="reference nearest-neighbor distance distribution">
      {bins.map((c, i) => {
        const v0 = lo + (i / NB) * (hi - lo), v1 = lo + ((i + 1) / NB) * (hi - lo);
        const x = bx(v0), w = bx(v1) - bx(v0) - 1, h = (c / maxc) * (H - 2 * pad);
        return <rect key={i} x={x} y={H - pad - h} width={Math.max(1, w)} height={h} fill={bandColor((v0 + v1) / 2)} />;
      })}
      {/* tertile dividers */}
      {[p33, p66].map((p) => <line key={p} x1={bx(p)} y1={pad - 6} x2={bx(p)} y2={H - pad} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />)}
      {/* query marker */}
      <line x1={bx(queryDist)} y1={4} x2={bx(queryDist)} y2={H - pad} stroke="#111827" strokeWidth={2} />
      <polygon points={`${bx(queryDist) - 5},4 ${bx(queryDist) + 5},4 ${bx(queryDist)},12`} fill="#111827" />
      <text x={bx(queryDist)} y={H - 8} textAnchor="middle" fontSize={10} fill="#111827" className="roboto-slab-medium">
        this drug {queryDist.toFixed(2)} ({BAND_LABEL[band]})
      </text>
      <text x={pad} y={H - 8} fontSize={9} fill="#9ca3af" className="roboto-slab-regular">closer</text>
      <text x={W - pad} y={H - 8} textAnchor="end" fontSize={9} fill="#9ca3af" className="roboto-slab-regular">farther</text>
    </svg>
  );
}
function Step5({ sel, manifest }: { sel: Drug; manifest?: Manifest }) {
  const rel = sel.step5_reliability;
  const mech = sel.step4_mechanism;
  const routes = mech.routes; const why = mech.why;
  const ov = new Map(mech.neighbor_overlap.map((o) => [o.id, o]));
  const consLine = (c: Consensus, route: string) =>
    c.moa ? `${c.count}/${c.k} of the top ${route} neighbors are ${c.moa} (${Math.round(c.fraction * 100)}%)` : "no consensus mechanism";

  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 5 — Contextualized results</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-4">
        A neighbor is a <strong>characterized anchor</strong> whose mechanism detail ports to {sel.display_name}.
        Mechanism (MoA) is the bridge — here are the two routes to it and whether they agree.
      </p>

      {/* TWO ROUTES */}
      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <RouteCard title="Chemistry route" route={routes.chem_route} matches={routes.chem_route_matches_truth} accent="#7c3aed" />
        <RouteCard title="Phenotype route" route={routes.pheno_route} matches={routes.pheno_route_matches_truth} accent="#0d9488" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="roboto-slab-regular text-xs text-gray-500">Query&apos;s annotated MoA: <strong>{routes.query_moa ?? "unclear"}</strong></span>
        <AgreeBadge ok={routes.routes_agree} label="the two routes agree with each other" />
      </div>
      <p className="roboto-slab-regular text-xs text-gray-400 mb-5">
        {manifest?.moa_retrieval_note}
      </p>

      {/* WHY IT RESEMBLES */}
      <div className="rounded-md border border-gray-200 bg-white p-4 mb-5">
        <div className="roboto-slab-medium text-sm text-gray-700 mb-1">Why {sel.display_name} resembles its phenotype neighbor ({why.neighbor})</div>
        <div className="flex flex-col sm:flex-row gap-4 mt-2">
          <SharedGenes title="Induced in both ▲" genes={why.shared_up} dir="up" />
          <SharedGenes title="Repressed in both ▼" genes={why.shared_down} dir="down" />
        </div>
        <p className="roboto-slab-regular text-[11px] text-gray-400 mt-2">{why.basis}.</p>
      </div>

      {/* NEIGHBOR TABLE + CONSENSUS */}
      <div className="rounded-md border border-gray-200 bg-white p-4 mb-5">
        <div className="roboto-slab-medium text-sm text-gray-700 mb-2">Top phenotype neighbors</div>
        <table className="w-full text-sm">
          <thead><tr className="roboto-slab-medium text-gray-500 text-left text-xs">
            <th className="py-1">Neighbor</th><th>Similarity</th><th>Mechanism</th><th>Shared MoA</th><th>Shared targets</th>
          </tr></thead>
          <tbody>
            {sel.step3_embedding.neighbors.map((n) => {
              const o = ov.get(n.id);
              return <tr key={n.id} className="roboto-slab-regular text-gray-700 border-t border-gray-100">
                <td className="py-1.5">{n.display}</td>
                <td>{n.similarity.toFixed(3)}</td>
                <td className="text-gray-500">{n.moa_fine}</td>
                <td>{o?.shared_moa ? <span className="text-emerald-600">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td className="text-gray-500">{o?.shared_targets.length ? o.shared_targets.join(", ") : "—"}</td>
              </tr>;
            })}
          </tbody>
        </table>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <div className="flex-1 rounded bg-violet-50 border border-violet-100 px-3 py-2 roboto-slab-regular text-xs text-violet-800">
            <strong>Chemistry consensus:</strong> {consLine(mech.chem_consensus, "chemistry")}
          </div>
          <div className="flex-1 rounded bg-teal-50 border border-teal-100 px-3 py-2 roboto-slab-regular text-xs text-teal-800">
            <strong>Phenotype consensus:</strong> {consLine(mech.pheno_consensus, "phenotype")}
          </div>
        </div>
      </div>

      {/* RELIABILITY HISTOGRAM */}
      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="roboto-slab-medium text-sm text-gray-700 mb-1">Reliability horizon — <span className="text-gray-900">{BAND_LABEL[rel.horizon_band]}</span></div>
        <p className="roboto-slab-regular text-xs text-gray-500 mb-2">
          Where {sel.display_name}&apos;s distance to its nearest reference drug falls within the distribution of
          all {manifest?.n_reference_drugs} reference drugs&apos; nearest-neighbor distances. Bands are tertiles.
        </p>
        {manifest && <NNHistogram manifest={manifest} queryDist={rel.nn_distance} band={rel.horizon_band} />}
        <p className="roboto-slab-regular text-xs text-gray-500 mt-2">
          Nearest reference: <strong>{rel.nn_id}</strong> · distance <strong>{rel.nn_distance.toFixed(3)}</strong> ({rel.metric}).
        </p>
      </div>
    </div>
  );
}

/* ---------------- Step 6 ---------------- */
function Step6({ sel, honesty }: { sel: Drug; honesty: string }) {
  const r = sel.step6_report;
  function download() {
    const txt = [
      `ATLAS-ANCHORED COMPOUND REPORT`,
      `==============================`,
      ``,
      r.headline,
      ``,
      `MECHANISM`,
      r.mechanism_text,
      ``,
      `TWO ROUTES TO MECHANISM`,
      r.bridge_text,
      ``,
      `CONFIDENCE`,
      r.confidence_text,
      ``,
      `CAVEAT`,
      r.caveat,
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${sel.id.replace(/[^a-z0-9]+/gi, "_")}_atlas_report.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 6 — Atlas-anchored report</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-4">Deterministic summary assembled from the steps above.</p>
      <div className="rounded-lg border border-gray-300 bg-white p-6">
        <div className="roboto-slab-medium text-xl text-gray-900 mb-4">{r.headline}</div>
        <div className="mb-4">
          <div className="roboto-slab-medium text-xs uppercase tracking-wide text-gray-400 mb-1">Mechanism</div>
          <p className="roboto-slab-regular text-sm text-gray-700 leading-relaxed">{r.mechanism_text}</p>
        </div>
        <div className="mb-4">
          <div className="roboto-slab-medium text-xs uppercase tracking-wide text-gray-400 mb-1">Two routes to mechanism</div>
          <p className="roboto-slab-regular text-sm text-gray-700 leading-relaxed">{r.bridge_text}</p>
        </div>
        <div className="mb-4">
          <div className="roboto-slab-medium text-xs uppercase tracking-wide text-gray-400 mb-1">Confidence</div>
          <p className="roboto-slab-regular text-sm text-gray-700 leading-relaxed">{r.confidence_text}</p>
        </div>
        <div className="border-t border-gray-200 pt-3">
          <p className="roboto-slab-regular text-xs text-gray-500 italic">{r.caveat}</p>
        </div>
      </div>
      <button onClick={download}
        className="roboto-slab-medium mt-4 rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-5 py-2 text-sm hover:bg-gray-700">
        ⤓ Download report
      </button>
    </div>
  );
}
