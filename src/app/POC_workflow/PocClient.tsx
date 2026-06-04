"use client";
// Mode-1 POC wizard — Steps 1–6 wired to the approved static JSON (/public/POC_workflow/).
// Renders approved JSON only: no new modeling. Honest cell-line + projection labeling throughout.
import { useEffect, useMemo, useState } from "react";

type Gene = { gene: string; lfc: number };
type Neighbor = { id: string; display: string; similarity: number; rank: number; moa_fine: string };
type Overlap = { id: string; shared_moa: boolean; shared_targets: string[] };
type Drug = {
  id: string; display_name: string; pubchem_cid: number | null;
  moa_fine: string; moa_broad: string; targets: string[];
  step1_structure: { smiles: string; svg: string; source: string };
  step2_fingerprint: { basis: string; n_cell_lines: number; dose_uM: number; control: string;
    n_genes_tested: number; top_up: Gene[]; top_down: Gene[] };
  step3_embedding: { coords2d: [number, number]; neighbors: Neighbor[]; projection: string };
  step4_mechanism: { moa_fine: string; targets: string[]; neighbor_overlap: Overlap[] };
  step5_reliability: { nn_id: string; nn_similarity: number; nn_distance: number;
    horizon_band: string; metric: string; basis: string };
  step6_report: { headline: string; mechanism_text: string; confidence_text: string; caveat: string };
};
type Manifest = { honesty_label: string; pca_var_explained: number[]; n_reference_drugs: number };
type Data = { manifest: Manifest; drugs: Drug[] };
type CPoint = { id: string; moa_fine: string; coords2d: [number, number]; is_demo: boolean };
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
          {step === 4 && sel && <Step4 sel={sel} cloud={cloud} varexp={data?.manifest.pca_var_explained} />}
          {step === 5 && sel && <Step5 sel={sel} />}
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

/* ---------------- Step 4 ---------------- */
function Step4({ sel, cloud, varexp }: { sel: Drug; cloud: Const | null; varexp?: number[] }) {
  const W = 620, H = 420, pad = 30;
  const pts = cloud?.points ?? [];
  const xs = pts.map((p) => p.coords2d[0]), ys = pts.map((p) => p.coords2d[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);
  const q = sel.step3_embedding.coords2d;
  const nbrIds = new Set(sel.step3_embedding.neighbors.map((n) => n.id));
  const coordOf = (id: string) => pts.find((p) => p.id === id)?.coords2d;
  const vexp = varexp ? `${((varexp[0] + varexp[1]) * 100).toFixed(1)}%` : "low";
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 4 — Project into the atlas</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
        {sel.display_name} (◆) placed among the {pts.length}-compound reference cloud, colored by mechanism. Lines mark its phenotype neighbors.
      </p>
      <div className="rounded-md border border-gray-200 bg-white p-2 overflow-x-auto">
        <svg width={W} height={H} role="img" aria-label="atlas projection">
          {/* neighbor links */}
          {sel.step3_embedding.neighbors.map((n) => {
            const c = coordOf(n.id); if (!c) return null;
            return <line key={n.id} x1={sx(q[0])} y1={sy(q[1])} x2={sx(c[0])} y2={sy(c[1])} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />;
          })}
          {/* reference cloud */}
          {pts.map((p) => {
            const isQ = p.id === sel.id, isN = nbrIds.has(p.id);
            if (isQ) return null;
            return <circle key={p.id} cx={sx(p.coords2d[0])} cy={sy(p.coords2d[1])} r={isN ? 5 : 3}
              fill={moaColor(p.moa_fine)} opacity={isN ? 1 : 0.55} stroke={isN ? "#1f2937" : "none"} strokeWidth={isN ? 1.5 : 0} />;
          })}
          {/* query */}
          <rect x={sx(q[0]) - 6} y={sy(q[1]) - 6} width={12} height={12} transform={`rotate(45 ${sx(q[0])} ${sy(q[1])})`} fill="#111827" />
          <text x={sx(q[0]) + 10} y={sy(q[1]) + 4} className="roboto-slab-medium" fontSize={12} fill="#111827">{sel.display_name}</text>
        </svg>
      </div>
      <p className="roboto-slab-regular text-xs text-gray-400 mt-3">
        Honest note: this 2D layout is a <strong>low-variance PCA projection</strong> (PC1+PC2 ≈ {vexp} of variance) for visualization only.
        Nearest neighbors are computed in the <strong>full phenotype space</strong>, not from these 2D distances.
      </p>
    </div>
  );
}

/* ---------------- Step 5 ---------------- */
function Step5({ sel }: { sel: Drug }) {
  const rel = sel.step5_reliability;
  const m = rel.basis.match(/p33=([0-9.]+) p66=([0-9.]+)/);
  const p33 = m ? parseFloat(m[1]) : 0.56, p66 = m ? parseFloat(m[2]) : 0.67;
  const ov = new Map(sel.step4_mechanism.neighbor_overlap.map((o) => [o.id, o]));
  const pos = Math.max(0, Math.min(1, rel.nn_distance)); // distance 0..1 → gauge
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 5 — Contextualized results</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-4">Phenotype neighbors and how reliable this region of the atlas is.</p>

      <div className="rounded-md border border-gray-200 bg-white p-4 mb-5">
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
      </div>

      {/* reliability gauge */}
      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="roboto-slab-medium text-sm text-gray-700 mb-2">Reliability horizon — <span className="text-gray-900">{BAND_LABEL[rel.horizon_band]}</span></div>
        <div className="relative h-6 rounded overflow-hidden flex">
          <div className="bg-emerald-200" style={{ width: `${p33 * 100}%` }} />
          <div className="bg-amber-200" style={{ width: `${(p66 - p33) * 100}%` }} />
          <div className="bg-rose-200" style={{ width: `${(1 - p66) * 100}%` }} />
          <div className="absolute top-0 h-6 w-0.5 bg-gray-900" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="flex justify-between roboto-slab-regular text-[10px] text-gray-400 mt-1">
          <span>in-domain</span><span>near edge</span><span>out-of-domain</span>
        </div>
        <p className="roboto-slab-regular text-xs text-gray-500 mt-3">
          Nearest reference: <strong>{rel.nn_id}</strong> · distance <strong>{rel.nn_distance.toFixed(3)}</strong> ({rel.metric}).
          Bands are tertiles of the reference&apos;s nearest-neighbor distances.
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
