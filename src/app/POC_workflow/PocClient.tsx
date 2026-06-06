"use client";
// Mode-1 POC wizard (v2) — wired to the static JSON in /public/POC_workflow/.
// Renders precomputed JSON only: no live modeling, no live UMAP. Both 2D regimes (phenotype +
// chemistry) are precomputed. The through-line is MoA as the explicit bridge: two routes
// (chemistry-predicted vs phenotype-neighbor mechanism) and whether they agree.
// Honest cell-line (NOT tissue) + projection labeling throughout.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelectableTargets, TargetSelect, BindingBand, AnchorPrior, rankTargets, ProteinCanvas, SuitabilityBox } from "./TargetAware";

/* Make an RDKit SVG fill its container without distortion: keep the viewBox (so the aspect ratio is
   preserved and lines never stretch), drop the fixed px width/height so it scales to the wrapper. */
function fitSvg(svg: string, w: number, h: number): string {
  // drop RDKit's opaque white background rect → transparent, so it sits on the card's own color in
  // either theme (no darker inverted box behind the molecule in dark mode).
  svg = svg.replace(/<rect\b[^>]*?(?:fill:#FFFFFF|fill=['"]#FFFFFF['"])[^>]*?(?:\/>|>\s*<\/rect>)/i, "");
  if (!/viewBox=/.test(svg)) svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}"`);
  svg = svg
    .replace(/(<svg\b[^>]*?)\swidth=(['"])[\d.]+(?:px)?\2/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight=(['"])[\d.]+(?:px)?\2/, "$1")
    .replace(/<svg\b/, `<svg preserveAspectRatio="xMidYMid meet" width="100%" height="100%"`);
  return svg;
}

type Gene = { gene: string; lfc: number; support?: number };
type SharedGene = { gene: string; lfc_query: number; lfc_neighbor: number };
// Step-3 response-fingerprint view payloads (precomputed in gen_poc_json_v3.py)
type VolcanoPt = { g: string; x: number; y: number; t: number };
type Volcano = { points: VolcanoPt[]; n_lines: number; n_top: number; axis: string };
type ProgHit = { g: string; lfc: number; sup: number };
type Program = { name: string; score: number; n: number; hits: ProgHit[] };
type Programs = { programs: Program[]; basis: string };
type Organ = { system: string; intensity: number; raw?: number; drivers?: string[] };
type TargetPDB = { pdb: string; target: string; ligand: string };
// neighbor effects → assumed effect (Step 4 atlas)
type EffProgram = { name: string; score: number; n: number };
type NeighborProfile = { id: string; moa_fine: string; programs: EffProgram[]; organs: Organ[] };
type NeighborEffects = { neighbors: NeighborProfile[]; assumed_organs: Organ[];
  assumed_programs: { name: string; score: number; k: number }[]; subject_organs: Organ[]; basis: string;
  confidence?: number; narrative?: string[] };
type Dossier = { target: string; indication: string; moa: string; findings: string[]; zebrafish: string; source: string };
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
  moa_fine: string; moa_broad: string; targets: string[]; drug_class: string;
  step1_structure: { smiles: string; svg: string; source: string;
    mol3d: string | null; target_pdb: TargetPDB | null };
  step2_fingerprint: { basis: string; n_cell_lines: number; dose_uM: number; control: string;
    n_genes_tested: number; top_up: Gene[]; top_down: Gene[];
    volcano?: Volcano; programs: Programs; organs: Organ[]; organ_basis: string };
  step3_embedding: { coords2d: [number, number]; chem2d: [number, number];
    neighbors: Neighbor[]; chem_neighbors: Neighbor[]; projection: string; chem_projection: string };
  step4_mechanism: { moa_fine: string; targets: string[]; neighbor_overlap: Overlap[];
    routes: Routes; pheno_consensus: Consensus; chem_consensus: Consensus; why: Why;
    neighbor_effects: NeighborEffects };
  step5_reliability: { nn_id: string; nn_similarity: number; nn_distance: number;
    horizon_band: string; metric: string; basis: string };
  step6_report: { headline: string; mechanism_text: string; confidence_text: string;
    bridge_text: string; caveat: string };
  is_guest?: boolean; dossier?: Dossier;
};
type Manifest = {
  honesty_label: string; pca_var_explained: number[]; chem_var_explained: number[];
  n_reference_drugs: number; knn: number; nn_dist_tertiles: number[]; ref_nn_dist: number[];
  moa_retrieval_note: string; organ_systems?: string[]; n_programs?: number;
  classes?: string[]; dataset?: string;
};
type Data = { manifest: Manifest; drugs: Drug[] };
type CPoint = { id: string; moa_fine: string; drug_class?: string; coords2d: [number, number]; chem2d: [number, number]; is_demo: boolean };
type Const = { points: CPoint[] };
// Broad Drug Repurposing Hub (precomputed offline — see /tmp/hub/build_hub.py)
type HubNN = { id: string; sim: number };
type HubDrug = { name: string; smiles: string; inchikey: string; moa: string; target: string; phase: string;
  measured: boolean; atlas_id: string | null; nn: HubNN[]; chem2d: [number, number] };
type Hub = { meta: Record<string, any>; measured_index: Record<string, string>; drugs: HubDrug[] };

/* lazy-load the self-hosted RDKit MinimalLib (6.9 MB wasm) — only when we must render an arbitrary
   structure or canonicalize a typed SMILES to an InChIKey. */
let _rdkitP: Promise<any> | null = null;
function loadRDKit(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.RDKit) return Promise.resolve(w.RDKit);
  if (_rdkitP) return _rdkitP;
  _rdkitP = new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = "/POC_workflow/lib/RDKit_minimal.js"; s.async = true;
    s.onload = () => (w.initRDKitModule)({ locateFile: () => "/POC_workflow/lib/RDKit_minimal.wasm" })
      .then((R: any) => { w.RDKit = R; resolve(R); }).catch(reject);
    s.onerror = () => reject(new Error("rdkit load failed"));
    document.head.appendChild(s);
  });
  return _rdkitP;
}
function smilesToInchiKey(R: any, smiles: string): string | null {
  let mol: any = null;
  try {
    mol = R.get_mol(smiles);
    if (!mol || (mol.is_valid && !mol.is_valid())) return null;
    const inchi = mol.get_inchi();
    if (!inchi) return null;
    return R.get_inchikey_for_inchi(inchi) || null;
  } catch { return null; } finally { try { mol?.delete(); } catch { /* noop */ } }
}
// lazy single fetch of the compact Hub file (~2.5 MB, gzipped over the wire)
let _hubP: Promise<Hub> | null = null;
function loadHub(): Promise<Hub> {
  if (!_hubP) _hubP = fetch("/POC_workflow/repurposing_hub.json").then((r) => r.json());
  return _hubP;
}
/* Render an arbitrary SMILES to SVG client-side via RDKit (no baked depictions for the 6k Hub). */
function RDKitDepiction({ smiles, w = 320, h = 240, fill = false }: { smiles: string; w?: number; h?: number; fill?: boolean }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancel = false; setErr(false); // keep the previous depiction visible until the new one is ready
    loadRDKit().then((R) => {
      if (cancel) return;
      let mol: any = null;
      try {
        mol = R.get_mol(smiles);
        if (!mol || (mol.is_valid && !mol.is_valid())) { setErr(true); return; }
        // render at 2× the display size for crisp, fine bond lines (RDKit's line width is ~constant in
        // device px, so a larger canvas → proportionally thinner strokes), then fit to the box.
        const RW = Math.round(w * 2), RH = Math.round(h * 2);
        let s = "";
        try { s = mol.get_svg_with_highlights(JSON.stringify({ width: RW, height: RH, bondLineWidth: 1 })); }
        catch { /* older MinimalLib — fall back to the plain renderer */ }
        if (!s) s = mol.get_svg(RW, RH);
        if (!cancel) setSvg(fitSvg(s, RW, RH));
      } catch { if (!cancel) setErr(true); } finally { try { mol?.delete(); } catch { /* noop */ } }
    }).catch(() => { if (!cancel) setErr(true); });
    return () => { cancel = true; };
  }, [smiles, w, h]);
  // fill mode: occupy the whole parent (which must be `relative`) with a small inset, so the molecule
  // scales up to nearly fill its box instead of sitting tiny in the middle.
  const box = fill ? "absolute inset-[6px] flex items-center justify-center" : "flex items-center justify-center";
  const style = fill ? undefined : { width: w, height: h };
  if (err) return <div className={`roboto-slab-regular text-xs text-gray-400 ${box}`} style={style ?? { minHeight: h }}>Could not render this structure.</div>;
  if (!svg) return <div className={`roboto-slab-regular text-xs text-gray-400 ${box}`} style={style ?? { minHeight: h }}>Rendering structure…</div>;
  return <div aria-label={`2D structure of ${smiles}`} className={box} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const STEPS = ["Submit compound", "Wet-lab exposure", "Response fingerprint",
  "Project into atlas", "Contextualized results", "Atlas report"];
const STEPS_SHORT = ["Submit", "Exposure", "Fingerprint", "Atlas", "Inference", "Report"];

function moaColor(moa: string): string {
  if (!moa || moa.toLowerCase() === "unclear") return "#cfcfcf";
  let h = 0; for (let i = 0; i < moa.length; i++) h = (h * 31 + moa.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 58%)`;
}
const BAND_LABEL: Record<string, string> = {
  "in-domain": "In-domain", "near-edge": "Near edge", "out-of-domain": "Out-of-domain",
};

/* ---- organ-intensity heat color (gray → amber → red) ---- */
function lerp(a: number[], b: number[], t: number) { return a.map((x, i) => Math.round(x + (b[i] - x) * t)); }
function organColor(t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const rgb = clamp < 0.5 ? lerp([229, 231, 235], [245, 158, 11], clamp / 0.5)
    : lerp([245, 158, 11], [220, 38, 38], (clamp - 0.5) / 0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/* ---- zebrafish anatomy: organ regions keyed by system; fill by intensity (illustrative stand-in) ---- */
const FISH_ORGANS: { sys: string; el: "ellipse" | "rect" | "path"; attrs: any; label: [number, number] }[] = [
  { sys: "Brain / CNS", el: "ellipse", attrs: { cx: 92, cy: 84, rx: 19, ry: 14 }, label: [92, 84] },
  { sys: "Eye / retina", el: "ellipse", attrs: { cx: 64, cy: 90, rx: 7, ry: 7 }, label: [64, 90] },
  { sys: "Heart", el: "path", attrs: { d: "M120 108 q8 -12 16 0 q-8 12 -16 0 Z" }, label: [128, 108] },
  { sys: "Liver", el: "ellipse", attrs: { cx: 168, cy: 112, rx: 22, ry: 13 }, label: [168, 112] },
  { sys: "Intestine / gut", el: "rect", attrs: { x: 196, y: 110, width: 108, height: 12, rx: 6 }, label: [250, 116] },
  { sys: "Kidney (pronephros)", el: "rect", attrs: { x: 150, y: 70, width: 150, height: 9, rx: 4 }, label: [225, 74] },
  { sys: "Skeletal muscle", el: "path", attrs: { d: "M150 86 q70 -18 150 6 q-70 22 -150 -6 Z" }, label: [250, 92] },
  { sys: "Blood / immune", el: "ellipse", attrs: { cx: 352, cy: 104, rx: 15, ry: 9 }, label: [352, 104] },
  { sys: "Vasculature", el: "rect", attrs: { x: 130, y: 98, width: 245, height: 5, rx: 2.5 }, label: [255, 100] },
];
function ZebrafishSVG({ organs, height = 200, onHover }:
  { organs: Organ[]; height?: number; onHover?: (o: Organ | null, x: number, y: number) => void }) {
  const bySys = new Map(organs.map((o) => [o.system, o]));
  const body = "M30 95 C42 70 72 58 122 56 L300 60 C342 62 366 70 384 80 L432 54 L408 95 L432 138 L384 110 C366 120 342 128 300 130 L122 134 C72 132 42 120 30 95 Z";
  return (
    <svg width="100%" viewBox="0 0 460 200" role="img" aria-label="zebrafish organ-system involvement" style={{ maxHeight: height }}>
      <path d={body} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
      <path d="M384 80 L432 54 L408 95 L432 138 L384 110 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1} />
      {FISH_ORGANS.map((o) => {
        const od = bySys.get(o.sys); const t = od ? od.intensity : 0;
        const common = {
          fill: organColor(t), stroke: "#94a3b8", strokeWidth: 0.8, opacity: 0.95, style: { cursor: "pointer" },
          onMouseEnter: (e: any) => onHover?.(od ?? { system: o.sys, intensity: t }, e.nativeEvent.offsetX, e.nativeEvent.offsetY),
          onMouseLeave: () => onHover?.(null, 0, 0),
        };
        if (o.el === "ellipse") return <ellipse key={o.sys} {...o.attrs} {...common} />;
        if (o.el === "rect") return <rect key={o.sys} {...o.attrs} {...common} />;
        return <path key={o.sys} {...o.attrs} {...common} />;
      })}
      <circle cx={60} cy={90} r={2} fill="#475569" />
    </svg>
  );
}
function OrganIntensityList({ organs }: { organs: Organ[] }) {
  const sorted = [...organs].sort((a, b) => b.intensity - a.intensity);
  return (
    <div className="space-y-1">
      {sorted.map((o) => (
        <div key={o.system} className="flex items-center gap-2">
          <span className="roboto-slab-regular text-[11px] text-gray-600 w-36 truncate text-right" title={o.system}>{o.system}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
            <div className="h-3 rounded" style={{ width: `${Math.round(o.intensity * 100)}%`, background: organColor(o.intensity) }} />
          </div>
          {o.drivers && o.drivers.length > 0 && (
            <span className="roboto-slab-regular text-[10px] text-gray-400 w-40 truncate" title={o.drivers.join(", ")}>{o.drivers[0]}</span>
          )}
        </div>
      ))}
    </div>
  );
}

type Modality = "mab" | "rna" | "smol" | null;

/* ---------------- Modality sprites ----------------
   High-res cel-shaded pixel-art sprites (procedurally generated — see public/POC_workflow/sprites/gen.py).
   Rendered with image-rendering:pixelated so they stay crisp when scaled up. */
function Sprite({ src, label }: { src: string; label: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} width={120} height={120}
      style={{ imageRendering: "pixelated", width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
  );
}

const MODALITIES: { id: Exclude<Modality, null>; title: string; blurb: string; img: string }[] = [
  {
    id: "mab", title: "Monoclonal Antibody",
    blurb: "A targeted biologic. Push an mAb through whole-organism phenotype screening to read its organism-scale response.",
    img: "/POC_workflow/sprites/mab.png",
  },
  {
    id: "rna", title: "RNA Therapeutic",
    blurb: "siRNA, ASO, or mRNA. Trace a nucleic-acid payload's phenotype signature across the atlas.",
    img: "/POC_workflow/sprites/rna.png",
  },
  {
    id: "smol", title: "Small Molecule",
    blurb: "A classic drug-like compound. Pick from the 94-compound MegaFin atlas — or submit a novel SMILES string.",
    img: "/POC_workflow/sprites/smol.png",
  },
];

export default function PocClient() {
  const [data, setData] = useState<Data | null>(null);
  const [cloud, setCloud] = useState<Const | null>(null);
  const [modality, setModality] = useState<Modality>(null);
  const [selId, setSelId] = useState("");
  const [novel, setNovel] = useState(false);    // selected compound is an interpolated candidate
  const [unknown, setUnknown] = useState(false); // submitted SMILES matched nothing (truly novel/unknown)
  const [candidate, setCandidate] = useState<HubDrug | null>(null); // unmeasured Hub drug → chemistry-only path
  const [hub, setHub] = useState<Hub | null>(null);
  const [hubBusy, setHubBusy] = useState(false);
  const [revealPhase, setRevealPhase] = useState<"input" | "preview" | "reveal" | "ready">("input"); // Step-1 cinematic
  const [leaving, setLeaving] = useState(false);
  const [typeTarget, setTypeTarget] = useState(""); // full SMILES being typewritten during preview
  const [smiles, setSmiles] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    fetch("/POC_workflow/drugs.json").then((r) => r.json()).then(setData).catch(() => setNote("Could not load demo data."));
    fetch("/POC_workflow/constellation.json").then((r) => r.json()).then(setCloud).catch(() => {});
    try { if (localStorage.getItem("poc-theme") === "dark") setDark(true); } catch { /* no-op */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("poc-theme", dark ? "dark" : "light"); } catch { /* no-op */ } }, [dark]);
  const themeClass = dark ? "dark poc-dark" : "";

  const sel = useMemo(() => data?.drugs.find((d) => d.id === selId) || null, [data, selId]);
  // target-aware submission: curated zebrafish-gated dropdown + the chosen target
  const selectableTargets = useSelectableTargets();
  const [selTarget, setSelTarget] = useState("");
  const drugByName = useMemo(() => new Map((data?.drugs || []).map((d) => [d.id, d])), [data]);
  // rank the target dropdown by chemical similarity of the submitted molecule to each target's anchors
  // (ECFP4 Tanimoto, in-browser RDKit). Debounced so the typewriter/paste doesn't thrash the wasm.
  const [targetScores, setTargetScores] = useState<Map<string, number> | null>(null);
  const [atlasProximity, setAtlasProximity] = useState(0); // max Tanimoto of candidate to any anchor
  useEffect(() => {
    if (!smiles.trim() || !selectableTargets || !data) { setTargetScores(null); setAtlasProximity(0); return; }
    let cancel = false;
    const id = setTimeout(() => {
      loadRDKit().then((R) => {
        if (cancel) return;
        const sb = new Map(data.drugs.map((d) => [d.id, d.step1_structure.smiles]));
        const scores = rankTargets(R, smiles, selectableTargets, sb);
        setTargetScores(scores);
        setAtlasProximity(scores.size ? Math.max(...Array.from(scores.values())) : 0);
      }).catch(() => {});
    }, 350);
    return () => { cancel = true; clearTimeout(id); };
  }, [smiles, selectableTargets, data]);
  const honesty = data?.manifest.honesty_label ??
    "Illustrative proof-of-concept on the 94-compound MegaFin zebrafish atlas.";

  function loadDrug(id: string) {
    const d = data?.drugs.find((x) => x.id === id);
    setSelId(id); setNovel(false); setUnknown(false); setCandidate(null); setSmiles(d ? d.step1_structure.smiles : ""); setNote(""); setRevealed(false);
  }
  // A Hub drug: if it overlaps the measured atlas (by InChIKey) run the full measured path; otherwise
  // it's an unmeasured candidate → the honest chemistry-only path (no fabricated phenotype).
  function pickHubDrug(d: HubDrug) {
    if (d.measured && d.atlas_id && data?.drugs.some((x) => x.id === d.atlas_id)) { loadDrug(d.atlas_id); return; }
    setSelId(""); setNovel(false); setUnknown(false); setCandidate(d); setSmiles(d.smiles); setNote(""); setRevealed(false);
  }
  async function ensureHub(): Promise<Hub | null> {
    if (hub) return hub;
    setHubBusy(true);
    try { const h = await loadHub(); setHub(h); return h; } catch { setNote("Could not load the repurposing library."); return null; }
    finally { setHubBusy(false); }
  }
  // Auto-detect what the submitted SMILES is, by RDKit-canonical InChIKey: measured atlas compound,
  // Broad Repurposing Hub drug (measured or not), or genuinely novel/unknown.
  async function analyzeSmiles() {
    const q = smiles.trim();
    if (!q || !data) { setNote("Paste a SMILES string, or use one of the buttons below."); return; }
    // fast path: exact canonical-SMILES match against a measured atlas compound (no wasm needed)
    const exact = data.drugs.find((d) => !d.is_guest && d.step1_structure.smiles.trim() === q);
    if (exact) { loadDrug(exact.id); return; }
    setNote("Canonicalizing structure…");
    try {
      const R = await loadRDKit();
      const ik = smilesToInchiKey(R, q);
      if (!ik) { setNote(""); setSelId(""); setCandidate(null); setNovel(false); setUnknown(true); return; }
      const h = await ensureHub();
      const atlasId = h?.measured_index[ik];
      if (atlasId && data.drugs.some((d) => d.id === atlasId)) { setNote(""); loadDrug(atlasId); return; }
      const hd = h?.drugs.find((d) => d.inchikey === ik);
      setNote("");
      if (hd) { pickHubDrug(hd); return; }
      setSelId(""); setCandidate(null); setNovel(false); setUnknown(true);
    } catch { setNote(""); setSelId(""); setCandidate(null); setUnknown(true); }
  }
  function go(n: number) { if (n >= 1 && n <= 6 && (sel || candidate || n === 1)) setStep(n); }
  function reset() { setSelId(""); setNovel(false); setUnknown(false); setCandidate(null); setSmiles(""); setTypeTarget(""); setNote(""); setStep(1); setRevealed(false); setRevealPhase("input"); setLeaving(false); }
  function chooseModality(m: Exclude<Modality, null>) { setModality(m); reset(); }
  function backToStart() { setModality(null); reset(); }

  // ---- Step-1 cinematic ----------------------------------------------------------------
  // A random pick lands in the "preview" beat: its SMILES is typewritten, the input cluster eases up,
  // and a single box shows the structure. Nothing else happens until Submit → the full atlas reveal.
  function beginPreview(targetSmiles: string) {
    loadRDKit().catch(() => {}); // warm the wasm so the structure pops fast
    setUnknown(false); setSmiles(""); setTypeTarget(targetSmiles); setNote(""); setRevealed(false); setRevealPhase("preview");
  }
  async function pickHubReveal() {
    setRevealPhase("preview"); setSmiles(""); setTypeTarget("");
    const h = await ensureHub();
    if (!h || !h.drugs.length) { setRevealPhase("input"); return; }
    const d = h.drugs[Math.floor(Math.random() * h.drugs.length)];
    if (d.measured && d.atlas_id && data?.drugs.some((x) => x.id === d.atlas_id)) {
      const ad = data.drugs.find((x) => x.id === d.atlas_id)!;
      setSelId(ad.id); setNovel(false); setCandidate(null); beginPreview(ad.step1_structure.smiles);
    } else {
      setSelId(""); setNovel(false); setCandidate(d); beginPreview(d.smiles);
    }
  }
  function pickNovelReveal() {
    if (!data) return;
    const scored = data.drugs.filter((d) => !d.is_guest).map((d) => ({
      d, s: d.step3_embedding.neighbors.slice(0, 3).reduce((a, n) => a + n.similarity, 0) / 3,
    })).sort((a, b) => b.s - a.s);
    if (!scored.length) return;
    const anchor = scored.slice(0, 25)[Math.floor(Math.random() * Math.min(25, scored.length))].d; // densest = high-confidence
    setSelId(anchor.id); setNovel(true); setCandidate(null); beginPreview(mutateSmiles(anchor.step1_structure.smiles));
  }
  // Refresh the novel reveal in place with a new candidate that lands in the dense (green) interpolation
  // zone — ranked by the SAME chem2d KDE density the coverage heatmap shows, excluding the current pick.
  function pickNovelInterpolation() {
    if (!data) return;
    const meas = data.drugs.filter((d) => !d.is_guest);
    if (!meas.length) return;
    const pts = meas.map((d) => d.step3_embedding.chem2d);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const inv = 1 / (2 * Math.pow(0.085 * span || 1, 2));
    const scored = meas.map((d, i) => {
      let s = 0; const [px, py] = pts[i];
      for (const [qx, qy] of pts) { const dx = px - qx, dy = py - qy; s += Math.exp(-(dx * dx + dy * dy) * inv); }
      return { d, s };
    }).filter((x) => x.d.id !== selId).sort((a, b) => b.s - a.s);
    const pool = scored.slice(0, 18); // densest chem2d KDE = green interpolation core
    const anchor = pool[Math.floor(Math.random() * pool.length)].d;
    // update content only — keep the current reveal phase so the boxes/heatmap stay in place
    setSelId(anchor.id); setNovel(true); setCandidate(null); setUnknown(false);
    setSmiles(mutateSmiles(anchor.step1_structure.smiles)); setTypeTarget(""); setNote("");
  }
  function submitStep1() {
    if (revealPhase === "preview") { if (sel || candidate) setRevealPhase("reveal"); return; } // already resolved
    if (!smiles.trim()) return;
    setRevealPhase("reveal"); analyzeSmiles();
  }
  function refineStep1() {
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setSelId(""); setNovel(false); setUnknown(false); setCandidate(null); setSmiles(""); setTypeTarget(""); setNote(""); setRevealed(false); setRevealPhase("input"); }, 430);
  }
  // direct reset to the input screen (NovelReveal plays its own exit animation first)
  function backToSearch() { setSelId(""); setNovel(false); setUnknown(false); setCandidate(null); setSmiles(""); setTypeTarget(""); setNote(""); setRevealed(false); setRevealPhase("input"); }
  // typewriter: advance the visible SMILES one char at a time while it's still a prefix of the target
  useEffect(() => {
    if (revealPhase !== "preview" || !typeTarget) return;
    if (smiles.length >= typeTarget.length || !typeTarget.startsWith(smiles)) return;
    const t = setTimeout(() => setSmiles(typeTarget.slice(0, smiles.length + 1)), 26);
    return () => clearTimeout(t);
  }, [revealPhase, typeTarget, smiles]);
  // once the selection resolves during the full reveal, hold ~5s past the unfold, then show the controls
  const resolved = !!sel || !!candidate || unknown;
  useEffect(() => {
    if (revealPhase !== "reveal" || !resolved) return;
    const hold = (sel && novel) ? 4200 : 9500; // novel heatmap blooms fast; the staggered atlas needs longer
    const t = setTimeout(() => setRevealPhase("ready"), hold);
    return () => clearTimeout(t);
  }, [revealPhase, resolved, sel, novel]);

  const Logo = (
    <div className="w-full max-w-3xl mb-4 flex items-center justify-between">
      <button onClick={backToStart} title="Back to start" aria-label="Back to start"
        className="inline-flex items-center gap-2 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/zeroshot_bio_gritty.png" alt="zeroshot bio" className="h-8 w-auto" />
        <span className="roboto-slab-medium text-sm text-gray-400 group-hover:text-gray-800 transition">workflow</span>
      </button>
      <button onClick={() => setDark((d) => !d)} title="Toggle dark mode" aria-label="Toggle dark mode"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 hover:bg-gray-100">
        <span className="text-sm leading-none">{dark ? "🌙" : "☀️"}</span>
        <span className="roboto-slab-regular text-[11px] text-gray-500">{dark ? "Dark" : "Light"}</span>
      </button>
    </div>
  );
  const Banner = (
    <div className="w-full max-w-3xl mb-6">
      <div className="rounded-md border border-gray-300 bg-gray-100 px-4 py-3 text-center">
        <p className="roboto-slab-regular text-xs sm:text-sm text-gray-700 leading-snug">
          Proof-of-concept workflow for drug discovery customers generating scRNA results with the Zeroshot Zebrafish
          Phenotype Screening Service. This workflow focuses on the non-AI value-add of the 94-drug MegaFin Atlas.
        </p>
      </div>
    </div>
  );
  // POC-scoped dark theme (reuses the site's global `.dark` bg/border overrides; adds text + accent tints
  // under `.poc-dark` so it doesn't touch globals.css or other pages).
  const DarkStyle = (
    <style dangerouslySetInnerHTML={{ __html: `
      .poc-dark{background:#0a0a0a;color-scheme:dark}
      .poc-dark .text-gray-900{color:#f1f5f9}.poc-dark .text-gray-800{color:#e2e8f0}
      .poc-dark .text-gray-700{color:#cbd5e1}.poc-dark .text-gray-600{color:#aab4c2}
      .poc-dark .text-gray-500{color:#94a3b8}.poc-dark .text-gray-400{color:#7c8595}
      .poc-dark .text-gray-300{color:#5b6573}
      .poc-dark .bg-amber-50{background:#3a2e12}.poc-dark .text-amber-800{color:#fcd34d}
      .poc-dark .border-amber-200,.poc-dark .border-amber-100{border-color:#5a4a1a}
      .poc-dark .bg-violet-50,.poc-dark .bg-violet-50\\/40{background:#241b3a}
      .poc-dark .text-violet-900,.poc-dark .text-violet-800,.poc-dark .text-violet-700{color:#c4b5fd}
      .poc-dark .border-violet-200,.poc-dark .border-violet-100{border-color:#3b2d63}
      .poc-dark .bg-teal-50,.poc-dark .bg-teal-50\\/40,.poc-dark .bg-teal-50\\/60{background:#0c2b2b}
      .poc-dark .text-teal-900,.poc-dark .text-teal-800,.poc-dark .text-teal-700{color:#5eead4}
      .poc-dark .border-teal-200,.poc-dark .border-teal-100{border-color:#155e5e}
      .poc-dark .bg-sky-50,.poc-dark .bg-sky-50\\/60{background:#0c2433}
      .poc-dark .text-sky-900,.poc-dark .text-sky-300{color:#7dd3fc}.poc-dark .border-sky-200{border-color:#155e75}
      .poc-dark .bg-emerald-50{background:#0c2b1d}.poc-dark .text-emerald-800,.poc-dark .text-emerald-700{color:#6ee7b7}
      .poc-dark .border-emerald-100,.poc-dark .border-emerald-200{border-color:#14532d}
      .poc-dark .bg-rose-50{background:#3a1620}.poc-dark .text-rose-800,.poc-dark .text-rose-700{color:#fda4af}
      .poc-dark img[alt="zeroshot bio"]{filter:invert(1) hue-rotate(180deg)}
      /* light bonds on the dark card: invert flips black↔white, hue-rotate(180) restores heteroatom
         colors (O red, N blue stay true) so the drawing blends instead of floating on a white patch */
      .poc-dark [aria-label^="2D structure"] svg{filter:invert(1) hue-rotate(180deg)}
      @keyframes pocRise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
      @keyframes pocFade{from{opacity:0}to{opacity:1}}
      @keyframes pocPop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
      @keyframes pocCollapse{from{opacity:1;transform:none}to{opacity:0;transform:translateY(10px) scale(.98)}}
      @keyframes pocSlideUp{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
      .poc-slideup{animation:pocSlideUp .8s cubic-bezier(.22,.61,.36,1) both}
      @keyframes pocSlideDown{from{opacity:1;transform:none}to{opacity:0;transform:translateY(44px) scale(.97)}}
      .poc-slidedown{animation:pocSlideDown .55s cubic-bezier(.55,.06,.68,.19) forwards}
      .poc-rise{animation:pocRise .7s cubic-bezier(.22,.61,.36,1) both}
      .poc-fade{animation:pocFade .6s ease both}
      .poc-slide{transition:transform .95s cubic-bezier(.45,.05,.2,1)}
      .poc-collapse{animation:pocCollapse .42s ease forwards}
      .poc-pt{transform-box:fill-box;transform-origin:center;animation:pocPop .5s ease both}
    ` }} />
  );

  // ---- intro: choose a therapeutic modality ----
  if (!modality) {
    return (
      <main className={`min-h-screen w-full flex flex-col items-center px-6 py-10 ${themeClass}`}>
        {DarkStyle}
        {Logo}
        {Banner}
        <div className="w-full max-w-3xl">
          <h1 className="roboto-slab-medium text-2xl sm:text-3xl text-gray-900 mb-1">Zeroshot compound workflow</h1>
          <p className="roboto-slab-regular text-sm text-gray-500 mb-6">How do you want to start? Choose a therapeutic modality to run through the MegaFin screening workflow.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MODALITIES.map((m) => (
              <button key={m.id} onClick={() => chooseModality(m.id)}
                className="group text-left rounded-lg border border-gray-300 bg-white overflow-hidden hover:border-gray-700 hover:shadow-md transition">
                <div className="aspect-square w-full p-4 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)" }}>
                  <div className="w-full h-full transition-transform duration-200 group-hover:scale-105">
                    <Sprite src={m.img} label={m.title} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="roboto-slab-medium text-gray-900 mb-1">{m.title}</div>
                  <p className="roboto-slab-regular text-sm text-gray-500">{m.blurb}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="roboto-slab-regular text-xs text-gray-400 mt-8 text-center max-w-3xl">{honesty}</p>
      </main>
    );
  }

  // ---- modalities whose workflow isn't wired yet ----
  if (modality !== "smol") {
    const m = MODALITIES.find((x) => x.id === modality)!;
    return (
      <main className={`min-h-screen w-full flex flex-col items-center px-6 py-10 ${themeClass}`}>
        {DarkStyle}
        {Logo}
        <div className="w-full max-w-3xl">
          <button onClick={() => setModality(null)} className="roboto-slab-regular text-xs text-gray-400 hover:text-gray-700 mb-3">
            ◂ Choose a different modality
          </button>
          <div className="rounded-lg border border-gray-300 bg-white p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-40 h-40 shrink-0 rounded-md p-3 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)" }}>
              <Sprite src={m.img} label={m.title} />
            </div>
            <div>
              <h1 className="roboto-slab-medium text-2xl text-gray-900 mb-1">{m.title}</h1>
              <p className="roboto-slab-regular text-sm text-gray-600 mb-2">{m.blurb}</p>
              <p className="roboto-slab-regular text-sm text-gray-500">
                The {m.title.toLowerCase()} workflow is coming soon. The small-molecule vertical slice is live today —
                switch modalities to walk through it end to end.
              </p>
            </div>
          </div>
        </div>
        <p className="roboto-slab-regular text-xs text-gray-400 mt-8 text-center max-w-3xl">{honesty}</p>
      </main>
    );
  }

  // ---- small-molecule workflow (unified molecule input, no secondary path picker) ----
  return (
    <main className={`min-h-screen w-full flex flex-col items-center px-6 py-10 ${themeClass}`}>
      {DarkStyle}
      {Logo}
      <div className="w-full max-w-3xl">
        <h1 className="roboto-slab-medium text-2xl sm:text-3xl text-gray-900">Small-molecule workflow</h1>
        <button onClick={() => setModality(null)} className="roboto-slab-regular text-xs text-gray-400 hover:text-gray-700 mb-3">
          ◂ Small Molecule — change modality
        </button>

        {/* Step indicator — hidden on the minimal Step-1 input / preview screens */}
        {!(step === 1 && (revealPhase === "input" || revealPhase === "preview")) && (
          <div className="flex flex-nowrap items-center gap-1.5 mb-7 overflow-x-auto poc-fade">
            {STEPS_SHORT.map((s, i) => {
              const n = i + 1; const active = n === step; const avail = n === 1 || !!sel || !!candidate;
              return (
                <button key={s} onClick={() => go(n)} disabled={!avail} title={STEPS[i]}
                  className={`roboto-slab-regular text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition ${
                    active ? "border-gray-700 bg-gray-800 text-gray-50"
                    : avail ? "border-gray-300 text-gray-600 hover:bg-gray-100" : "border-gray-200 text-gray-300 cursor-not-allowed"}`}>
                  {n}. {s}
                </button>
              );
            })}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 min-h-[420px]">
          {step === 1 && <Step1 {...{ data, cloud, sel, candidate, novel, unknown, hubBusy, smiles, setSmiles, note, typeTarget, revealPhase, leaving, dark, submitStep1, pickHubReveal, pickNovelReveal, pickNovelInterpolation, refineStep1, backToSearch, selectableTargets, selTarget, setSelTarget, targetScores, atlasProximity, onNext: () => go(2) }} />}
          {/* measured atlas path */}
          {step === 2 && sel && <Step2 sel={sel} novel={novel || !!sel.is_guest} onNext={() => { setRevealed(true); go(3); }} />}
          {step === 3 && sel && <Step3 sel={sel} />}
          {step === 4 && sel && <Step4 sel={sel} cloud={cloud} manifest={data?.manifest} />}
          {step === 5 && sel && <Step5 sel={sel} manifest={data?.manifest} selTarget={selTarget} selectableTargets={selectableTargets} smiles={smiles} drugByName={drugByName} />}
          {step === 6 && sel && <Step6 sel={sel} honesty={honesty} />}
          {/* unmeasured Hub candidate path — chemistry-only, never a fabricated phenotype */}
          {step >= 2 && !sel && candidate && <CandidateStep step={step} candidate={candidate} data={data} cloud={cloud} />}
          {step > 1 && !sel && !candidate && <p className="roboto-slab-regular text-sm text-gray-400">Submit a compound in Step 1 first.</p>}
        </section>

        {/* Nav — Step 1 has its own in-reveal Next / Refine, so the chrome nav is hidden there */}
        {step > 1 && (
          <div className="flex justify-between mt-5">
            <button onClick={() => go(step - 1)}
              className="roboto-slab-regular rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-100">◂ Back</button>
            <button onClick={() => go(step + 1)} disabled={step === 6 || (!sel && !candidate)}
              className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700">Next ▸</button>
          </div>
        )}

        {step > 1 && <p className="roboto-slab-regular text-xs text-gray-400 mt-8 text-center">{honesty}</p>}
      </div>
    </main>
  );
}

/* ---------------- Step 1 — Molecule input ----------------
   Minimal SMILES box → on submit the placement unfolds piece by piece (chemistry manifold for novel /
   Hub candidates, phenotype manifold for measured), then Next / Refine fade in. */
function Step1({ data, cloud, sel, candidate, novel, unknown, hubBusy, smiles, setSmiles, typeTarget,
  revealPhase, leaving, dark, submitStep1, pickHubReveal, pickNovelReveal, pickNovelInterpolation, refineStep1, backToSearch,
  selectableTargets, selTarget, setSelTarget, targetScores, atlasProximity, onNext }: any) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // auto-grow the SMILES box to fit waterfalling text; shrink back when it gets shorter.
  // keyed on `smiles` so it tracks both typing/paste and programmatic fills (Random buttons, typewriter).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";                 // collapse so scrollHeight reflects true content height
    el.style.height = `${el.scrollHeight}px`;  // grow to fit — CSS transition animates the change
  }, [smiles, revealPhase]);
  const captureAndSubmit = submitStep1;
  // staged input flow: Submit reveals the molecule vis + the (optional) target step IN PLACE; the
  // whole-organism atlas reveal only fires from the explicit "Run" button below.
  const [staged, setStaged] = useState(false);
  useEffect(() => { if (!smiles) setStaged(false); }, [smiles]);

  // ---------- input + preview: one clean box that eases up and reveals the picked structure ----------
  if (revealPhase === "input" || revealPhase === "preview") {
    const preview = revealPhase === "preview";
    const previewName = candidate?.name ?? (novel ? "novel candidate" : sel?.display_name ?? "");
    const showStaged = staged || preview;          // molecule vis + target appear after Submit (or a Random pick)
    const visSmiles = typeTarget || smiles;
    const stage = () => { if (smiles.trim() || typeTarget) setStaged(true); };
    return (
      <div className="relative min-h-[400px] pb-8">
        {/* input cluster — eases upward (slow accel / slow settle) once a molecule is staged */}
        <div className="poc-slide w-full max-w-xl mx-auto" style={{ transform: showStaged ? "translateY(0)" : "translateY(110px)" }}>
          <h2 className="roboto-slab-medium text-xl text-gray-800 text-center mb-1">Submit a molecule</h2>
          <p className="roboto-slab-regular text-xs text-gray-400 text-center mb-6">A SMILES string — matched by InChIKey to the measured atlas or the Broad Repurposing Hub.</p>
          <div className="flex items-start gap-2">
            <textarea ref={inputRef} value={smiles} onChange={(e) => setSmiles(e.target.value)} placeholder="paste a SMILES string…"
              rows={1} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); stage(); } }} autoFocus
              className="roboto-slab-regular flex-1 resize-none overflow-hidden break-all leading-relaxed rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 font-mono shadow-sm focus:border-gray-700 focus:outline-none transition-[height,border-color] duration-200 ease-out" />
            <button onClick={stage}
              className="roboto-slab-medium rounded-xl bg-gray-900 text-gray-50 px-7 py-3 text-sm hover:bg-gray-700 transition">Submit</button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-5 text-[11px]">
            <button onClick={pickHubReveal} disabled={hubBusy}
              className="roboto-slab-regular text-gray-400 hover:text-gray-800 underline decoration-dotted underline-offset-2 disabled:opacity-50 transition">
              {hubBusy ? "loading Hub…" : "Random Drug-Repurposing candidate (Broad Hub)"}
            </button>
            <span className="text-gray-300">·</span>
            <button onClick={pickNovelReveal}
              className="roboto-slab-regular text-gray-400 hover:text-gray-800 underline decoration-dotted underline-offset-2 transition">
              Random novel SMILES
            </button>
          </div>
        </div>

        {/* molecule vis — pops in right below the input once submitted */}
        {showStaged && visSmiles && (
          <div className="w-full max-w-xl mx-auto mt-6 poc-fade" style={{ animationDelay: "120ms" }}>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
                {visSmiles ? <RDKitDepiction smiles={visSmiles} w={300} h={210} /> : <span className="roboto-slab-regular text-xs text-gray-400">resolving…</span>}
              </div>
              {previewName && <div className="text-center roboto-slab-medium text-sm text-gray-700 mt-1">{previewName}</div>}
            </div>
          </div>
        )}

        {/* intended-target step — only after a molecule has been submitted */}
        {showStaged && (
          <div className="mt-12 poc-fade" style={{ animationDelay: "260ms" }}>
            <TargetSelect targets={selectableTargets} value={selTarget} onChange={setSelTarget} scores={targetScores} dark={dark} />
          </div>
        )}

        {/* proceed to the whole-organism screen (the atlas cinematic) */}
        {showStaged && (
          <div className="w-full max-w-xl mx-auto mt-8 flex justify-center poc-fade" style={{ animationDelay: "320ms" }}>
            <button onClick={captureAndSubmit}
              className="roboto-slab-medium rounded-xl bg-gray-900 text-gray-50 px-8 py-3 text-sm hover:bg-gray-700 transition">Calculate Zebrafish Screen Suitability</button>
          </div>
        )}
      </div>
    );
  }

  // ---------- reveal / ready phase ----------
  const ready = revealPhase === "ready";
  const resolved = sel || candidate || unknown;

  // novel candidate gets the dedicated coverage-heatmap layout (no key — a refresh updates content in place)
  if (sel && novel) {
    return <NovelReveal sel={sel} smiles={smiles} data={data} ready={ready} dark={dark} onBack={backToSearch} onInterpolation={pickNovelInterpolation} onNext={onNext}
      selTarget={selTarget} selectableTargets={selectableTargets} targetScores={targetScores} atlasProximity={atlasProximity} />;
  }

  return (
    <div className={leaving ? "poc-collapse" : ""}>
      {!resolved && (
        <div className="flex items-center justify-center min-h-[360px] gap-2 text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="roboto-slab-regular text-sm">Resolving structure…</span>
        </div>
      )}

      {resolved && (
        <div className="flex flex-col gap-4">
          {/* structure box */}
          {sel && <div className="poc-rise" style={{ animationDelay: "0ms" }}><StructureCard sel={sel} novel={novel} smiles={smiles} /></div>}
          {candidate && <div className="poc-rise" style={{ animationDelay: "0ms" }}><CandidateStructureCard candidate={candidate} /></div>}
          {unknown && <div className="poc-rise"><UnknownCard smiles={smiles} /></div>}

          {/* placement box — the atlas unfolds piece by piece */}
          {candidate && <div className="poc-rise" style={{ animationDelay: "150ms" }}>
            <RevealManifoldBox title="Chemistry manifold — placement vs the MegaFin Atlas" subtitle="ECFP4 · nearest measured neighbors">
              <ChemManifold data={data} mark={candidate.chem2d} markLabel={candidate.name} markColor="#7c3aed" neighbors={candidate.nn} animate />
            </RevealManifoldBox>
          </div>}
          {sel && !novel && <div className="poc-rise" style={{ animationDelay: "150ms" }}><InterpolationHeatmap data={data} cloud={cloud} sel={sel} novel={false} /></div>}

          {/* live literature research for any real, named compound */}
          {sel && !novel && <div className="poc-rise" style={{ animationDelay: "320ms" }}>
            <AgenticResearch idKey={sel.id} name={sel.display_name} smiles={sel.step1_structure.smiles} moa={sel.moa_fine} targets={sel.targets} drugClass={sel.drug_class} fallback={sel.dossier ?? null} />
          </div>}
          {candidate && <div className="poc-rise" style={{ animationDelay: "320ms" }}>
            <AgenticResearch idKey={candidate.inchikey} name={candidate.name} smiles={candidate.smiles} moa={candidate.moa} targets={candidate.target ? candidate.target.split("|") : []} drugClass={candidate.moa} fallback={null} />
          </div>}
        </div>
      )}

      {ready && (
        <div className="poc-fade flex items-center justify-center gap-3 mt-6">
          <button onClick={refineStep1}
            className="roboto-slab-regular rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 transition">↺ Refine</button>
          {(sel || candidate) && (
            <button onClick={onNext}
              className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-900 text-gray-50 px-6 py-2 text-sm hover:bg-gray-700 transition">Next ▸ Exposure</button>
          )}
        </div>
      )}
    </div>
  );
}

function RevealManifoldBox({ title, subtitle, children }: { title: string; subtitle: string; children: JSX.Element }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="roboto-slab-medium text-sm text-gray-700">{title}</div>
        <div className="roboto-slab-regular text-[11px] text-gray-400">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function UnknownCard({ smiles }: { smiles: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
      <div className="roboto-slab-medium text-sm text-amber-900 mb-2">Novel / unrecognized structure</div>
      <div className="rounded bg-white/60 border border-amber-100 px-3 py-2 mb-2 font-mono text-[11px] text-amber-800 break-all">{smiles}</div>
      <p className="roboto-slab-regular text-xs text-amber-800">
        This structure isn&apos;t in the measured atlas or the Broad Hub — genuinely unknown. The honest next move is the wet lab.
      </p>
    </div>
  );
}

/* SMILES preview that matches the search box (font-mono, left-aligned, waterfalling) but auto-shrinks
   its font so even a very long string fits the fixed box height without scrolling. */
function SmilesFit({ smiles }: { smiles: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current, span = spanRef.current;
    if (!box || !span) return;
    let fs = 14; // start at text-sm, matching the search box; shrink only if it overflows
    span.style.fontSize = `${fs}px`;
    while (fs > 8 && span.scrollHeight > box.clientHeight) { fs -= 0.5; span.style.fontSize = `${fs}px`; }
  }, [smiles]);
  return (
    <div ref={boxRef} className="flex-1 overflow-hidden">
      <span ref={spanRef} className="block font-mono leading-snug text-gray-700 break-all">{smiles}</span>
    </div>
  );
}

/* ============ Novel-candidate reveal: 3 symmetric top boxes + the coverage heatmap ============ */
function NovelReveal({ sel, smiles, data, ready, dark, onBack, onInterpolation, onNext, selTarget, selectableTargets, targetScores, atlasProximity }:
  { sel: Drug; smiles: string; data: Data | null; ready: boolean; dark: boolean; onBack: () => void; onInterpolation: () => void; onNext: () => void;
    selTarget?: string; selectableTargets?: any[] | null; targetScores?: Map<string, number> | null; atlasProximity?: number }) {
  const mark = sel.step3_embedding.chem2d;
  const [exiting, setExiting] = useState(false);
  const tgt = selTarget && selectableTargets ? selectableTargets.find((t) => t.human_gene === selTarget) : null;

  // reverse: boxes slide back down/out, then return to the bare search screen
  function handleBack() { setExiting(true); setTimeout(onBack, 560); }

  return (
    <div className={exiting ? "poc-slidedown" : ""}>
      {/* quiet controls */}
      <div className="flex items-center justify-end gap-3 mb-2 text-[11px]">
        <button onClick={handleBack} className="roboto-slab-regular text-gray-400 hover:text-gray-800 underline decoration-dotted underline-offset-2 transition">New search</button>
        <span className="text-gray-300">·</span>
        <button onClick={onInterpolation} className="roboto-slab-regular text-gray-400 hover:text-gray-800 underline decoration-dotted underline-offset-2 transition">Generate within interpolation zone</button>
      </div>

      {/* three visuals — SMILES · molecule · target protein */}
      <div className="grid grid-cols-3 gap-3">
        <div className="poc-rise rounded-xl border border-gray-200 bg-white p-3 h-44 overflow-hidden flex flex-col" style={{ animationDelay: "0ms" }}>
          <div className="roboto-slab-regular text-[10px] uppercase tracking-wide text-gray-400 mb-1">SMILES</div>
          <SmilesFit smiles={smiles} />
        </div>
        <div className="poc-rise relative rounded-xl border border-gray-200 bg-white h-44" style={{ animationDelay: "90ms" }}>
          <div className="absolute left-3 top-2 roboto-slab-regular text-[10px] uppercase tracking-wide text-gray-400 z-10">Candidate</div>
          <RDKitDepiction smiles={smiles} w={300} h={300} fill />
        </div>
        <div className="poc-rise rounded-xl border border-gray-200 bg-white h-44 flex flex-col items-center justify-center p-2" style={{ animationDelay: "180ms" }}>
          <div className="self-start roboto-slab-regular text-[10px] uppercase tracking-wide text-gray-400 mb-1">Target protein</div>
          {tgt ? (
            <>
              <ProteinCanvas gene={tgt.human_gene} ortholog={tgt.zfin_ortholog} w={150} h={120} />
              <div className="roboto-slab-regular text-[10px] text-gray-500 mt-0.5">{tgt.human_gene} → {tgt.zfin_ortholog}</div>
            </>
          ) : (
            <div className="roboto-slab-regular text-[11px] text-gray-400 text-center px-3">No target selected — chemistry-only triage.</div>
          )}
        </div>
      </div>

      {/* suitability composite */}
      <div className="mt-3 poc-rise" style={{ animationDelay: "240ms" }}>
        <SuitabilityBox target={tgt || null} targetScore={(targetScores && selTarget && targetScores.get(selTarget)) || 0} atlasProximity={atlasProximity || 0} dark={dark} />
      </div>

      {/* the atlas — candidate is the focal point; field + anchors are intentionally muted */}
      <div className="mt-3 poc-slideup" style={{ animationDelay: "300ms" }}>
        <ChemHeatmap data={data} mark={mark} markLabel="Your Candidate" dark={dark} />
      </div>

      {ready && !exiting && (
        <div className="poc-fade flex items-center justify-center mt-5">
          <button onClick={onNext}
            className="roboto-slab-medium rounded-md border border-gray-700 bg-gray-900 text-gray-50 px-6 py-2 text-sm hover:bg-gray-700 transition">Next ▸ Exposure</button>
        </div>
      )}
    </div>
  );
}

/* Atlas-similarity colormap (single continuous scientific ramp, no rainbow): deep indigo/purple at the
   cold edges → blue → teal → green → yellow → orange-red hotspots at the warmest (closest-to-atlas) cores. */
const ATLAS_STOPS: [number, [number, number, number]][] = [
  [0.00, [49, 34, 102]], [0.18, [40, 53, 147]], [0.38, [21, 101, 168]], [0.55, [38, 139, 139]],
  [0.70, [86, 161, 70]], [0.84, [214, 184, 38]], [0.93, [232, 132, 31]], [1.00, [217, 45, 32]],
];
function atlasColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < ATLAS_STOPS.length; i++) {
    if (t <= ATLAS_STOPS[i][0]) {
      const [t0, c0] = ATLAS_STOPS[i - 1], [t1, c1] = ATLAS_STOPS[i];
      const u = (t - t0) / (t1 - t0 || 1);
      const c = [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * u));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(217,45,32)";
}
function smoothstep(a: number, b: number, x: number): number {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return u * u * (3 - 2 * u);
}
const FIG_FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/* "MegaFin Atlas: From Anchors to Exploration" — a clean 16:9 scientific infographic on white.
   An organic heat island (KDE similarity field) anchored by the 94 measured drugs, dusted with
   theoretical molecules, plus a minimalist legend + colorbar. The submitted candidate is highlighted
   and glides to a new position on an interpolation refresh. */
function ChemHeatmap({ data, mark, markLabel, dark }:
  { data: Data | null; mark: [number, number]; markLabel: string; dark?: boolean }) {
  // ink palette — the card bg is dark in dark mode (.dark .bg-white → #0a0a0a), so the dark figure text
  // must flip to light. The heat-island colormap and white markers read fine on either background.
  const ink = dark ? "#f1f5f9" : "#0f172a";       // title / candidate strokes & label
  const ink2 = dark ? "#cbd5e1" : "#334155";      // legend labels & anchor outline
  const halo = dark ? "#0a0a0a" : "#ffffff";      // text halo, matches the bg
  const dotFill = dark ? "#94a3b8" : "#64748b";   // theoretical-molecule dusting + muted anchors
  const barStroke = dark ? "#334155" : "#e5e7eb";
  const cand = "#e11d48";                          // candidate accent — reads on both light & dark
  const W = 1280, H = 720;
  const IX0 = 40, IX1 = 842, IY0 = 152, IY1 = 596; // organic-island region (left two-thirds)
  const field = useMemo(() => {
    const meas = (data?.drugs ?? []).filter((d) => !d.is_guest);
    if (!meas.length) return null;
    const pts = meas.map((d) => d.step3_embedding.chem2d);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const mx = (xmax - xmin) * 0.16 || 1, my = (ymax - ymin) * 0.16 || 1;
    const x0 = xmin - mx, x1 = xmax + mx, y0 = ymin - my, y1 = ymax + my;
    const spanx = x1 - x0, spany = y1 - y0;
    const cols = 104, rows = Math.round(104 * (IY1 - IY0) / (IX1 - IX0));
    const h = 0.085 * Math.max(spanx, spany), inv = 1 / (2 * h * h);
    const grid: number[][] = []; let maxd = 0;
    for (let r = 0; r < rows; r++) {
      const gy = y1 - ((r + 0.5) / rows) * spany; const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const gx = x0 + ((c + 0.5) / cols) * spanx; let d = 0;
        for (const p of pts) { const dx = gx - p[0], dy = gy - p[1]; d += Math.exp(-(dx * dx + dy * dy) * inv); }
        row.push(d); if (d > maxd) maxd = d;
      }
      grid.push(row);
    }
    const sampleN = (x: number, y: number) => {
      const c = Math.min(cols - 1, Math.max(0, Math.floor(((x - x0) / spanx) * cols)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor((1 - (y - y0) / spany) * rows)));
      return grid[r][c] / (maxd || 1);
    };
    // theoretical molecules — a deterministic dusting that lands inside the island (warm and cold)
    let seed = 99173; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const dots: [number, number][] = [];
    for (let i = 0; i < 1400 && dots.length < 240; i++) {
      const x = x0 + rnd() * spanx, y = y0 + rnd() * spany;
      if (sampleN(x, y) > 0.05) dots.push([x, y]);
    }
    return { grid, maxd, x0, y0, spanx, spany, cols, rows, pts, dots };
  }, [data]);

  const heatLayer = useMemo(() => {
    if (!field) return null;
    const cw = (IX1 - IX0) / field.cols, ch = (IY1 - IY0) / field.rows;
    const cells: JSX.Element[] = [];
    for (let r = 0; r < field.rows; r++) for (let c = 0; c < field.cols; c++) {
      const t = field.grid[r][c] / (field.maxd || 1);
      const a = smoothstep(0.03, 0.13, t) * 0.4; // muted field — keep the candidate the focal point
      if (a < 0.02) continue;
      cells.push(<rect key={`${r}-${c}`} x={IX0 + c * cw} y={IY0 + r * ch} width={cw + 1} height={ch + 1} fill={atlasColor(t)} opacity={a} />);
    }
    return <g filter="url(#atlasblur)">{cells}</g>;
  }, [field]);

  if (!field) return <div className="rounded-xl border border-gray-100 bg-white p-8 text-center" style={{ fontFamily: FIG_FONT, color: "#94a3b8", fontSize: 13 }}>Loading atlas…</div>;

  const sx = (x: number) => IX0 + ((x - field.x0) / field.spanx) * (IX1 - IX0);
  const sy = (y: number) => IY1 - ((y - field.y0) / field.spany) * (IY1 - IY0);
  const cx = sx(mark[0]), cy = sy(mark[1]);
  const glide = { transition: "cx .65s cubic-bezier(.4,0,.2,1), cy .65s cubic-bezier(.4,0,.2,1)" } as any;
  const glideXY = { transition: "x .65s cubic-bezier(.4,0,.2,1), y .65s cubic-bezier(.4,0,.2,1)" } as any;
  // legend geometry
  const LGX = 904, barX = 912, barY = 330, barW = 18, barH = 210;

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="MegaFin Atlas: from anchors to exploration"
        style={{ fontFamily: FIG_FONT }}>
        <defs>
          <filter id="atlasblur" x="-6%" y="-6%" width="112%" height="112%"><feGaussianBlur stdDeviation={8} /></filter>
          <linearGradient id="atlasbar" x1="0" y1="1" x2="0" y2="0">
            {ATLAS_STOPS.map(([pos]) => <stop key={pos} offset={pos} stopColor={atlasColor(pos)} />)}
          </linearGradient>
        </defs>

        {/* title block (top-left) */}
        <text x={40} y={64} fontSize={34} fontWeight={700} fill={ink}>MegaFin Atlas: From Anchors to Exploration</text>
        <text x={42} y={96} fontSize={17} fill="#9aa6b6">Similarity to Atlas (Higher = Closer)</text>

        {/* organic heat island */}
        {heatLayer}
        {/* theoretical molecules — a very faint dusting */}
        {field.dots.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={1.6} fill={dotFill} opacity={0.16} />)}
        {/* 94 anchor drugs — muted so they recede behind the candidate */}
        {field.pts.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3} fill={dotFill} opacity={0.4} />)}

        {/* the submitted candidate — the focal point: bold accent + concentric rings + halo label */}
        <circle cx={cx} cy={cy} r={26} fill="none" stroke={cand} strokeWidth={1.4} opacity={0.3} style={glide} />
        <circle cx={cx} cy={cy} r={16} fill="none" stroke={cand} strokeWidth={1.8} opacity={0.5} style={glide} />
        <circle cx={cx} cy={cy} r={8.5} fill={cand} stroke={halo} strokeWidth={3} style={glide} />
        <text x={cx} y={cy - 28} textAnchor="middle" fontSize={19} fontWeight={700} fill={cand}
          style={{ paintOrder: "stroke", stroke: halo, strokeWidth: 5, ...glideXY }}>{markLabel}</text>

        {/* legend + colorbar (right) */}
        <circle cx={LGX + 9} cy={168} r={7} fill={cand} stroke={halo} strokeWidth={2.4} />
        <text x={LGX + 28} y={173} fontSize={16} fontWeight={700} fill={ink}>Your Candidate</text>
        <circle cx={LGX + 9} cy={200} r={3.4} fill={dotFill} opacity={0.5} />
        <text x={LGX + 28} y={205} fontSize={15} fill={ink2}>94 MegaFin Drugs (Anchors)</text>
        <circle cx={LGX + 9} cy={232} r={2.4} fill={dotFill} opacity={0.3} />
        <text x={LGX + 28} y={237} fontSize={14} fill="#94a3b8">Theoretical Molecules (Exploration)</text>

        <text x={LGX} y={310} fontSize={15} fill={ink2}>Similarity to Atlas</text>
        <rect x={barX} y={barY} width={barW} height={barH} fill="url(#atlasbar)" rx={3} stroke={barStroke} strokeWidth={1} />
        <text x={barX + barW + 10} y={barY + 8} fontSize={13} fill="#b9533a">High (Closer)</text>
        <text x={barX + barW + 10} y={barY + barH} fontSize={13} fill="#5b5f97">Low (Farther)</text>

        {/* quiet caption (bottom center of the island) */}
        <text x={(IX0 + IX1) / 2} y={652} textAnchor="middle" fontSize={16} fill="#9aa6b6">Anchored in 94 known drugs. Exploring the vast space of what could be next.</text>
      </svg>
    </div>
  );
}

/* Agentic literature research: hits a real (cheap) Claude call via /api/agentic_dossier, shows a live
   "what the agent is doing" loader, then renders the dossier. Falls back to the precomputed dossier on error. */
const RESEARCH_STEPS = [
  "Searching PubMed & ChEMBL…",
  "Reading abstracts and label data…",
  "Extracting target & mechanism of action…",
  "Assessing zebrafish phenotype relevance…",
  "Synthesizing dossier…",
];
function AgenticResearch({ idKey, name, smiles, moa, targets, drugClass, fallback }:
  { idKey: string; name: string; smiles: string; moa: string; targets: string[]; drugClass: string; fallback?: Dossier | null }) {
  const [status, setStatus] = useState<"loading" | "done" | "fallback">("loading");
  const [doc, setDoc] = useState<Dossier | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading"); setDoc(null); setStepIdx(0); setLive(true);
    const tick = setInterval(() => setStepIdx((i) => Math.min(i + 1, RESEARCH_STEPS.length - 1)), 1100);
    fetch("/api/agentic_dossier", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, smiles, moa_fine: moa, targets, drug_class: drugClass }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (cancelled) return; setDoc(j.dossier as Dossier); setLive(true); setStatus("done"); })
      .catch(() => { if (cancelled) return; setDoc(fallback ?? null); setLive(false); setStatus(fallback ? "fallback" : "done"); })
      .finally(() => clearInterval(tick));
    return () => { cancelled = true; clearInterval(tick); };
  }, [idKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="animate-spin h-4 w-4 text-sky-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="roboto-slab-medium text-sm text-sky-900">Agentic literature research — {name}</div>
        </div>
        <ul className="space-y-1">
          {RESEARCH_STEPS.map((s, i) => (
            <li key={s} className={`roboto-slab-regular text-xs flex items-center gap-2 ${i < stepIdx ? "text-gray-400" : i === stepIdx ? "text-sky-800" : "text-gray-300"}`}>
              <span className="w-3 inline-block">{i < stepIdx ? "✓" : i === stepIdx ? "▸" : "·"}</span>{s}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!doc) return null;
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🔎</span>
          <div className="roboto-slab-medium text-sm text-sky-900">Agentic literature research — {name}</div>
        </div>
        <span className={`roboto-slab-regular text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${live ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {live ? "live · agent" : "offline cache"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2">
        <div className="roboto-slab-regular text-xs text-gray-600"><span className="text-gray-400">Target:</span> {doc.target}</div>
        <div className="roboto-slab-regular text-xs text-gray-600"><span className="text-gray-400">Indication:</span> {doc.indication}</div>
      </div>
      <p className="roboto-slab-regular text-xs text-gray-700 mb-2"><span className="text-gray-400">Mechanism:</span> {doc.moa}</p>
      <ul className="roboto-slab-regular text-xs text-gray-700 space-y-1 mb-2 list-disc pl-5">
        {doc.findings.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      <p className="roboto-slab-regular text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mb-2">
        🐟 Zebrafish relevance: {doc.zebrafish}
      </p>
      <p className="roboto-slab-regular text-[11px] text-gray-400">
        {doc.source}. These findings prime the downstream interpretation — in production they reweight the atlas-neighbor consensus.
      </p>
    </div>
  );
}

/* ============ Unmeasured Broad-Hub candidate: chemistry-only, honestly labeled ============ */
function nnInfo(data: Data | null, id: string) {
  const d = data?.drugs.find((x) => x.id === id);
  return { display: d?.display_name ?? id, moa: d?.moa_fine ?? "—", chem2d: d?.step3_embedding.chem2d ?? null };
}
// chemistry distance to the nearest measured drug = the honest reliability horizon
function horizonBand(sim: number) {
  if (sim >= 0.55) return { key: "in", label: "in-domain", cls: "text-emerald-700", bar: "#059669",
    note: "Chemically close to measured drugs — a chemistry-anchored read-out is a reasonable prior." };
  if (sim >= 0.35) return { key: "edge", label: "borderline", cls: "text-amber-700", bar: "#d97706",
    note: "On the edge of the measured atlas — treat any inference as a weak prior, not a result." };
  return { key: "out", label: "out-of-domain", cls: "text-rose-700", bar: "#e11d48",
    note: "Chemically far from anything we've measured — this is extrapolation. Best treated purely as a wet-lab candidate." };
}

function CandidateStructureCard({ candidate }: { candidate: HubDrug }) {
  const sim = candidate.nn[0]?.sim ?? 0;
  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <div className="roboto-slab-medium text-xs text-gray-500 mb-2">2D structure (RDKit · illustrative)</div>
          <div className="flex-1 flex items-center justify-center" style={{ minHeight: 240 }}>
            <RDKitDepiction smiles={candidate.smiles} w={300} h={230} />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1.5">
          <div className="roboto-slab-medium text-gray-800 text-lg">{candidate.name}</div>
          <div className="roboto-slab-regular text-xs text-gray-600"><span className="text-gray-400">Hub MoA:</span> {candidate.moa || "—"}</div>
          <div className="roboto-slab-regular text-xs text-gray-600"><span className="text-gray-400">Target(s):</span> {candidate.target ? candidate.target.replace(/\|/g, ", ") : "—"}</div>
          <div className="roboto-slab-regular text-xs text-gray-600"><span className="text-gray-400">Clinical phase:</span> {candidate.phase || "—"}</div>
          <div className="roboto-slab-regular text-[11px] text-gray-400 font-mono break-all"><span className="font-sans">InChIKey:</span> {candidate.inchikey}</div>
          <div className="mt-1 rounded bg-amber-50 border border-amber-100 px-2 py-1 roboto-slab-regular text-[11px] text-amber-800">
            Not measured in the atlas. Chemistry nearest neighbor at Tanimoto {sim.toFixed(2)} — full placement in Step 4.
          </div>
        </div>
      </div>
    </div>
  );
}

/* Chemistry scatter on the ECFP/RDKit-descriptor manifold (chem2d). Places a marker by chemistry and draws
   its nearest measured neighbors. `animate` makes the atlas points unfold left-to-right, then the marker. */
function ChemManifold({ data, mark, markLabel, markColor, neighbors, animate }:
  { data: Data | null; mark: [number, number]; markLabel: string; markColor: string; neighbors: { id: string; sim: number }[]; animate?: boolean }) {
  const W = 620, H = 360, pad = 16, STAG = 4200;
  const meas = (data?.drugs ?? []).filter((d) => !d.is_guest);
  if (!meas.length) return null;
  const xs = meas.map((d) => d.step3_embedding.chem2d[0]), ys = meas.map((d) => d.step3_embedding.chem2d[1]);
  const allx = xs.concat(mark[0]), ally = ys.concat(mark[1]);
  const xmin = Math.min(...allx), xmax = Math.max(...allx), ymin = Math.min(...ally), ymax = Math.max(...ally);
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);
  const cx = sx(mark[0]), cy = sy(mark[1]);
  const nnSet = new Set(neighbors.map((n) => n.id));
  // left-to-right unfold order
  const rank = new Map<string, number>();
  meas.map((d) => d).sort((a, b) => a.step3_embedding.chem2d[0] - b.step3_embedding.chem2d[0]).forEach((d, r) => rank.set(d.id, r));
  const N = meas.length || 1;
  const ptDelay = (id: string) => (animate ? ((rank.get(id) ?? 0) / N) * STAG : 0);
  return (
    <div className="rounded overflow-hidden border border-gray-100" style={{ background: "#0a0c23" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ECFP chemistry scatter">
        {meas.map((d) => {
          const isn = nnSet.has(d.id);
          return <circle key={d.id} className={animate ? "poc-pt" : undefined} style={animate ? { animationDelay: `${ptDelay(d.id)}ms` } : undefined}
            cx={sx(d.step3_embedding.chem2d[0])} cy={sy(d.step3_embedding.chem2d[1])}
            r={isn ? 4 : 2.3} fill={moaColor(d.moa_fine)} opacity={isn ? 1 : 0.45}
            stroke={isn ? "#fff" : "none"} strokeWidth={isn ? 1 : 0} />;
        })}
        <g className={animate ? "poc-fade" : undefined} style={animate ? { animationDelay: `${STAG + 200}ms` } : undefined}>
          {neighbors.map((n) => { const c = nnInfo(data, n.id).chem2d; if (!c) return null;
            return <line key={n.id} x1={cx} y1={cy} x2={sx(c[0])} y2={sy(c[1])} stroke="#a78bfa" strokeWidth={1} strokeDasharray="3 3" opacity={0.85} />; })}
          <circle cx={cx} cy={cy} r={11} fill="none" stroke={markColor} strokeWidth={1.5} opacity={0.6} />
          <circle cx={cx} cy={cy} r={5.5} fill={markColor} stroke="#fff" strokeWidth={1.2} />
          <text x={cx + 10} y={cy + 4} fontSize={12} className="roboto-slab-medium" fill="#fff"
            style={{ paintOrder: "stroke", stroke: "#0a0c23", strokeWidth: 3 } as any}>{markLabel}</text>
        </g>
        <text x={pad} y={H - 6} fontSize={9} fill="#7c8595" className="roboto-slab-regular">ECFP chemistry space · PCA(2) of RDKit descriptors · {meas.length} measured drugs</text>
      </svg>
    </div>
  );
}

function CandidateStep({ step, candidate, data }: { step: number; candidate: HubDrug; data: Data | null; cloud: Const | null }) {
  const nn0 = candidate.nn[0];
  const near = nnInfo(data, nn0?.id ?? "");
  const sim = nn0?.sim ?? 0;
  const band = horizonBand(sim);

  if (step === 2 || step === 3) {
    return (
      <div>
        <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step {step} — {step === 2 ? "Whole-organism exposure" : "Response fingerprint"}</h2>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
          <div className="roboto-slab-medium text-sm text-amber-900 mb-2">Not measured — nothing to show here</div>
          <p className="roboto-slab-regular text-sm text-amber-800 mb-2">
            <strong>{candidate.name}</strong> has never been run through the zebrafish screen, so there is no exposure
            and no measured {step === 3 ? "expression fingerprint" : "phenotype"} to display. This is exactly the compound
            you&apos;d send to the wet lab.
          </p>
          <p className="roboto-slab-regular text-xs text-amber-700">
            We do not fabricate a measured read-out. What we <em>can</em> do is place it relative to what we have measured —
            by chemistry. Continue to Step 4.
          </p>
        </div>
      </div>
    );
  }
  if (step === 4) {
    return (
      <div>
        <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 4 — Chemistry placement</h2>
        <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
          With no phenotype, we place <strong>{candidate.name}</strong> by structure: its ECFP4 nearest neighbors among the
          measured atlas. This is a chemistry prior, not a measured result.
        </p>
        <ChemManifold data={data} mark={candidate.chem2d} markLabel={candidate.name} markColor="#7c3aed" neighbors={candidate.nn} />
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="roboto-slab-medium text-xs text-gray-500 mb-1">MoA — from the Hub annotation</div>
            <div className="roboto-slab-regular text-sm text-gray-800">{candidate.moa || "—"}</div>
            <div className="roboto-slab-regular text-[11px] text-gray-400 mt-1">target(s): {candidate.target ? candidate.target.replace(/\|/g, ", ") : "—"}</div>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
            <div className="roboto-slab-medium text-xs text-violet-700 mb-1">MoA — via nearest measured neighbor</div>
            <div className="roboto-slab-regular text-sm text-violet-900">{near.moa}</div>
            <div className="roboto-slab-regular text-[11px] text-violet-500 mt-1">{near.display} · Tanimoto {sim.toFixed(2)}</div>
          </div>
        </div>
        <ul className="mt-2 roboto-slab-regular text-xs text-gray-500 list-disc pl-5">
          {candidate.nn.map((n) => { const i = nnInfo(data, n.id); return <li key={n.id}>{i.display} — {i.moa} <span className="text-gray-400">(Tanimoto {n.sim.toFixed(2)})</span></li>; })}
        </ul>
      </div>
    );
  }
  if (step === 5) {
    const dist = (1 - sim);
    return (
      <div>
        <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 5 — Reliability horizon</h2>
        <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
          How far is this candidate from anything we&apos;ve actually measured? That chemistry distance is the honest ceiling
          on what the atlas can say.
        </p>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="roboto-slab-medium text-sm text-gray-800">Nearest measured drug: {near.display}</div>
            <div className={`roboto-slab-medium text-xs uppercase tracking-wide ${band.cls}`}>{band.label}</div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden mb-1">
            <div className="h-full rounded-full" style={{ width: `${Math.round(sim * 100)}%`, background: band.bar }} />
          </div>
          <div className="roboto-slab-regular text-[11px] text-gray-500 mb-2">Tanimoto similarity {sim.toFixed(2)} · chemistry distance {dist.toFixed(2)}</div>
          <p className={`roboto-slab-regular text-sm ${band.cls}`}>{band.note}</p>
        </div>
      </div>
    );
  }
  // step 6 — chemistry-only report (deterministic)
  const dist = (1 - sim);
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 6 — Chemistry-only report</h2>
      <div className="rounded-md border border-gray-200 bg-white p-5">
        <div className="roboto-slab-medium text-base text-gray-900 mb-2">
          {candidate.name}: chemistry-only prediction for an <span className="text-rose-700">unmeasured</span> candidate
        </div>
        <p className="roboto-slab-regular text-sm text-gray-700 mb-2">
          <span className="text-gray-400">Mechanism (Broad Hub):</span> {candidate.moa || "unannotated"}{candidate.target ? ` · targets ${candidate.target.replace(/\|/g, ", ")}` : ""}.
        </p>
        <p className="roboto-slab-regular text-sm text-gray-700 mb-2">
          <span className="text-gray-400">Chemistry placement:</span> nearest measured atlas drug is <strong>{near.display}</strong> (a {near.moa})
          at Tanimoto {sim.toFixed(2)} (distance {dist.toFixed(2)}).
        </p>
        <p className={`roboto-slab-regular text-sm mb-2 ${band.cls}`}>
          <span className="text-gray-400">Reliability:</span> {band.label} — {band.note}
        </p>
        <p className="roboto-slab-regular text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded px-3 py-2">
          Honesty: <strong>{candidate.name}</strong> was not measured in the MegaFin atlas. No phenotype, cell-line response, or
          fingerprint was observed — everything above is a chemistry-only placement against measured reference drugs. Run it
          through the zebrafish screen to obtain a real read-out. 2D depiction is illustrative.
        </p>
      </div>
    </div>
  );
}

/* Illustrative novel analog of a SMILES — grafts a methyl onto the first aliphatic carbon. */
function mutateSmiles(s: string): string {
  const m = s.match(/C(?!l)/);
  if (!m || m.index === undefined) return s + "C";
  const i = m.index;
  return s.slice(0, i + 1) + "(C)" + s.slice(i + 1);
}

/* inferno-style perceptual ramp: low (deep navy) → high (pale yellow) interpolation confidence */
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0.0, [10, 12, 35]], [0.22, [48, 18, 92]], [0.45, [120, 28, 109]],
  [0.65, [190, 48, 96]], [0.82, [240, 132, 82]], [1.0, [250, 246, 184]],
];
function interpColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    if (t <= HEAT_STOPS[i][0]) {
      const [t0, c0] = HEAT_STOPS[i - 1], [t1, c1] = HEAT_STOPS[i];
      const u = (t - t0) / (t1 - t0 || 1);
      const c = [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * u));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(250,246,184)";
}

/* High-fidelity heat-map of the phenotype manifold: a KDE density field over the 94 measured atlas
   compounds = interpolation-confidence strength. The submitted/generated molecule is dropped on top. */
function InterpolationHeatmap({ data, cloud, sel, novel }: { data: Data | null; cloud: Const | null; sel: Drug | null; novel: boolean }) {
  const W = 620, H = 360, pad = 14;
  const field = useMemo(() => {
    const pts = cloud?.points ?? [];
    if (!pts.length) return null;
    const xs = pts.map((p) => p.coords2d[0]), ys = pts.map((p) => p.coords2d[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const mx = (xmax - xmin) * 0.06 || 1, my = (ymax - ymin) * 0.06 || 1; // small margin
    const x0 = xmin - mx, x1 = xmax + mx, y0 = ymin - my, y1 = ymax + my;
    const spanx = x1 - x0, spany = y1 - y0;
    const cols = 80, rows = Math.round(80 * (H - 2 * pad) / (W - 2 * pad));
    const h = 0.075 * Math.max(spanx, spany); const inv2h2 = 1 / (2 * h * h);
    const grid: number[][] = []; let maxd = 0;
    for (let r = 0; r < rows; r++) {
      const gy = y1 - ((r + 0.5) / rows) * spany; const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const gx = x0 + ((c + 0.5) / cols) * spanx; let d = 0;
        for (const p of pts) { const dx = gx - p.coords2d[0], dy = gy - p.coords2d[1]; d += Math.exp(-(dx * dx + dy * dy) * inv2h2); }
        row.push(d); if (d > maxd) maxd = d;
      }
      grid.push(row);
    }
    return { grid, maxd, x0, y0, spanx, spany, cols, rows, pts };
  }, [cloud]);

  const heatLayer = useMemo(() => {
    if (!field) return null;
    const cw = (W - 2 * pad) / field.cols, ch = (H - 2 * pad) / field.rows;
    const cells: JSX.Element[] = [];
    for (let r = 0; r < field.rows; r++) for (let c = 0; c < field.cols; c++) {
      const t = field.grid[r][c] / (field.maxd || 1);
      cells.push(<rect key={`${r}-${c}`} x={pad + c * cw} y={pad + r * ch} width={cw + 0.6} height={ch + 0.6} fill={interpColor(t)} />);
    }
    return <g filter="url(#heatblur)">{cells}</g>;
  }, [field]);

  if (!field) return <div className="rounded-md border border-gray-200 bg-white p-6 text-center roboto-slab-regular text-xs text-gray-400">Loading atlas manifold…</div>;

  const sx = (x: number) => pad + ((x - field.x0) / field.spanx) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - field.y0) / field.spany) * (H - 2 * pad);
  const sampleT = (x: number, y: number) => {
    const c = Math.min(field.cols - 1, Math.max(0, Math.floor(((x - field.x0) / field.spanx) * field.cols)));
    const r = Math.min(field.rows - 1, Math.max(0, Math.floor((1 - (y - field.y0) / field.spany) * field.rows)));
    return field.grid[r][c] / (field.maxd || 1);
  };
  const coordById = (id: string) => data?.drugs.find((d) => d.id === id)?.step3_embedding.coords2d;

  const mark = sel?.step3_embedding.coords2d ?? null;
  const neighbors = sel ? sel.step3_embedding.neighbors.slice(0, 5) : [];
  const localT = mark ? sampleT(mark[0], mark[1]) : null;
  const conf = sel ? Math.round(Math.min(0.99, sel.step3_embedding.neighbors[0]?.similarity ?? 0) * 100) : null;
  const markColor = sel ? (novel ? "#7c3aed" : sel.is_guest ? "#0284c7" : "#059669") : "#7c3aed";
  const markLabel = sel ? (novel ? "novel candidate" : sel.display_name) : "";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="roboto-slab-medium text-sm text-gray-700">Interpolation-confidence field — phenotype manifold</div>
        <div className="roboto-slab-regular text-[11px] text-gray-400">KDE over {field.pts.length} measured compounds · PCA(2)</div>
      </div>
      <p className="roboto-slab-regular text-[11px] leading-snug text-gray-500 mb-2">
        Every measured drug sits somewhere in &ldquo;phenotype space&rdquo; — how the whole organism responds to it. Bright regions
        are crowded with reference drugs, so a new molecule landing there can be read off its close neighbors with confidence;
        dark regions are uncharted, where a prediction is really a guess. For a discovery team this is the go/no-go map: it tells
        you up-front whether the atlas can actually speak to your compound. <strong>Nearest-neighbor similarity</strong> is the headline number —
        ~50% is a loose match (hypothesis-generating, treat with caution), while readouts have historically been dependable above ~65–70%,
        where the nearest analog behaves enough like your molecule to trust the inference.
      </p>
      <div className="rounded overflow-hidden border border-gray-100" style={{ background: "#0a0c23" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="interpolation-confidence heat-map">
          <defs>
            <filter id="heatblur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={4.2} /></filter>
          </defs>
          {heatLayer}
          {/* measured atlas compounds */}
          {field.pts.map((p) => (
            <circle key={p.id} cx={sx(p.coords2d[0])} cy={sy(p.coords2d[1])} r={2.1} fill="#ffffff" opacity={0.55} />
          ))}
          {/* placed molecule + its nearest atlas neighbors */}
          {mark && neighbors.map((n) => { const c = coordById(n.id); if (!c) return null;
            return <line key={n.id} x1={sx(mark[0])} y1={sy(mark[1])} x2={sx(c[0])} y2={sy(c[1])} stroke={markColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.85} />; })}
          {mark && <>
            <circle cx={sx(mark[0])} cy={sy(mark[1])} r={11} fill="none" stroke={markColor} strokeWidth={1.5} opacity={0.6} />
            <circle cx={sx(mark[0])} cy={sy(mark[1])} r={5} fill={markColor} stroke="#fff" strokeWidth={1.2} />
            <text x={sx(mark[0]) + 10} y={sy(mark[1]) + 4} fontSize={12} className="roboto-slab-medium" fill="#fff"
              style={{ paintOrder: "stroke", stroke: "#0a0c23", strokeWidth: 3 } as any}>{markLabel}</text>
          </>}
          {/* legend */}
          {Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x={W - pad - 132 + i * 5.2} y={H - pad - 14} width={6} height={7} fill={interpColor(i / 23)} />
          ))}
          <text x={W - pad - 132} y={H - pad - 18} fontSize={9} fill="#cbd5e1" className="roboto-slab-regular">low</text>
          <text x={W - pad - 18} y={H - pad - 18} fontSize={9} fill="#cbd5e1" textAnchor="end" className="roboto-slab-regular">high confidence</text>
        </svg>
      </div>
      {sel ? (
        <div className="roboto-slab-regular text-xs text-gray-600 mt-2">
          {novel ? <>Dropped into a <strong className="text-violet-700">{localT !== null && localT > 0.66 ? "high" : localT !== null && localT > 0.33 ? "moderate" : "sparse"}-density</strong> region · interpolation confidence <strong className="text-violet-700">{conf}%</strong> — nearest atlas neighbors {neighbors.slice(0, 3).map((n) => n.id).join(", ")}.</>
            : <><strong>{sel.display_name}</strong> sits in a {localT !== null && localT > 0.66 ? "densely" : localT !== null && localT > 0.33 ? "moderately" : "sparsely"}-covered region · nearest-neighbor similarity <strong>{conf}%</strong>.</>}
        </div>
      ) : (
        <p className="roboto-slab-regular text-xs text-gray-400 mt-2">Brighter regions are densely covered by measured compounds — where interpolation is most reliable. Submit or generate a molecule to place it on the field.</p>
      )}
    </div>
  );
}

/* For a truly novel structure there is no measured identity — no name, target, MoA, or PubChem entry.
   The only thing we can show is the submitted SMILES and the nearest measured analog (for reference). */
function NovelStructureCard({ sel, smiles }: { sel: Drug; smiles?: string }) {
  const ns = sel.step3_embedding.neighbors;
  const sim = Math.round(Math.min(0.99, ns[0]?.similarity ?? 0) * 100);
  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-white p-4">
      <div className="roboto-slab-medium text-sm text-violet-900 mb-2">Submitted structure — novel / unknown</div>
      <div className="rounded bg-gray-50 border border-gray-200 px-3 py-2 mb-3 font-mono text-[11px] text-gray-700 break-all">{smiles || "(generated SMILES)"}</div>
      <p className="roboto-slab-regular text-xs text-gray-600 mb-3">
        Not in any database — no name, target, mechanism, or PubChem entry. Nothing here is &ldquo;known&rdquo; about the molecule itself.
        Everything downstream is inferred purely from <strong>where it lands in the atlas</strong> — its {ns.length} nearest measured
        neighbors (kNN interpolation), nothing more.
      </p>
      <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
        <div className="roboto-slab-medium text-xs text-gray-500 mb-2">
          Nearest measured analog — {sel.display_name} <span className="text-gray-400">· {sim}% similarity, shown for reference only</span>
        </div>
        <div className="flex items-center justify-center" style={{ minHeight: 200 }}
          aria-label={`2D structure of nearest analog ${sel.display_name}`} dangerouslySetInnerHTML={{ __html: sel.step1_structure.svg }} />
      </div>
    </div>
  );
}

/* 2D depiction + lightweight self-contained 3D conformer, shown side-by-side. */
function StructureCard({ sel, novel, smiles }: { sel: Drug; novel?: boolean; smiles?: string }) {
  if (novel) return <NovelStructureCard sel={sel} smiles={smiles} />;
  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <div className="roboto-slab-medium text-xs text-gray-500 mb-2">2D structure</div>
          <div className="flex-1 flex items-center justify-center" style={{ minHeight: 260 }}
            aria-label={`2D structure of ${sel.display_name}`} dangerouslySetInnerHTML={{ __html: sel.step1_structure.svg }} />
        </div>
        <div className="flex flex-col items-center border-t md:border-t-0 md:border-l border-gray-100 md:pl-4 pt-4 md:pt-0">
          <div className="roboto-slab-medium text-xs text-gray-500 mb-2">3D {sel.step1_structure.target_pdb ? "structure / target complex" : "conformer"}</div>
          <Mol3DViewer sel={sel} />
        </div>
      </div>
      <div className="text-center mt-3 border-t border-gray-100 pt-3">
        <div className="roboto-slab-medium text-gray-800">{sel.display_name}</div>
        <div className="roboto-slab-regular text-sm text-gray-500">{sel.moa_fine}{sel.targets.length ? ` · target(s): ${sel.targets.join(", ")}` : ""}</div>
        {sel.pubchem_cid && <div className="roboto-slab-regular text-xs text-gray-400 mt-1">PubChem CID {sel.pubchem_cid} · {sel.step1_structure.source}</div>}
      </div>
    </div>
  );
}

/* ---- self-contained 3D molecular viewer: parses the embedded conformer / PDB and renders
   ball-and-stick on a 2D canvas with its own rotation. No WebGL, no external library. ---- */
const ELEM: Record<string, [string, number]> = {
  H: ["#cfd4da", 0.30], C: ["#404652", 0.40], N: ["#3b5bdb", 0.40], O: ["#e03131", 0.40],
  S: ["#e0b020", 0.52], P: ["#e07b1a", 0.50], F: ["#37b24d", 0.36], CL: ["#2f9e44", 0.52],
  BR: ["#a0522d", 0.58], I: ["#9c36b5", 0.64], NA: ["#7048e8", 0.5], FE: ["#d9480f", 0.5],
};
const elemInfo = (el: string) => ELEM[el.toUpperCase()] || ["#9c6ade", 0.44];
type V3 = { x: number; y: number; z: number };
function rotV(p: V3, rx: number, ry: number): V3 {
  const x1 = p.x * Math.cos(ry) + p.z * Math.sin(ry), z1 = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
  const y2 = p.y * Math.cos(rx) - z1 * Math.sin(rx), z2 = p.y * Math.sin(rx) + z1 * Math.cos(rx);
  return { x: x1, y: y2, z: z2 };
}
function centerScale(pts: V3[]) {
  const n = pts.length || 1; let cx = 0, cy = 0, cz = 0;
  for (const p of pts) { cx += p.x; cy += p.y; cz += p.z; } cx /= n; cy /= n; cz /= n;
  let r = 0.001; for (const p of pts) { const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz; r = Math.max(r, Math.hypot(dx, dy, dz)); }
  return { c: { x: cx, y: cy, z: cz }, s: 1 / r };
}
function parseMolBlock(mol: string) {
  const L = mol.split("\n"); if (L.length < 4) return null;
  const na = parseInt(L[3].slice(0, 3)), nb = parseInt(L[3].slice(3, 6)); if (!na) return null;
  const atoms: (V3 & { el: string })[] = [];
  for (let i = 0; i < na; i++) { const r = L[4 + i] || ""; atoms.push({ x: +r.slice(0, 10), y: +r.slice(10, 20), z: +r.slice(20, 30), el: (r.slice(31, 34) || "C").trim() }); }
  const bonds: [number, number][] = [];
  for (let i = 0; i < nb; i++) { const r = L[4 + na + i] || ""; bonds.push([parseInt(r.slice(0, 3)) - 1, parseInt(r.slice(3, 6)) - 1]); }
  const { c, s } = centerScale(atoms);
  atoms.forEach((a) => { a.x = (a.x - c.x) * s; a.y = (a.y - c.y) * s; a.z = (a.z - c.z) * s; });
  return { kind: "mol" as const, atoms, bonds };
}
function parsePdbScene(txt: string, ligand: string) {
  const chains: Record<string, V3[]> = {}; const lig: (V3 & { el: string })[] = [];
  for (const r of txt.split("\n")) {
    const rec = r.slice(0, 6);
    if (rec === "ATOM  ") { if (r.slice(12, 16).trim() === "CA") { const ch = r[21]; (chains[ch] = chains[ch] || []).push({ x: +r.slice(30, 38), y: +r.slice(38, 46), z: +r.slice(46, 54) }); } }
    else if (rec === "HETATM" && r.slice(17, 20).trim() === ligand) { lig.push({ x: +r.slice(30, 38), y: +r.slice(38, 46), z: +r.slice(46, 54), el: (r.slice(76, 78).trim() || r.slice(12, 14).trim().replace(/[0-9]/g, "") || "C") }); }
  }
  const traces = Object.values(chains); const all: V3[] = [...lig, ...traces.flat()];
  if (!all.length) return null;
  const { c, s } = centerScale(all);
  const ap = (p: V3) => { p.x = (p.x - c.x) * s; p.y = (p.y - c.y) * s; p.z = (p.z - c.z) * s; };
  traces.forEach((t) => t.forEach(ap)); lig.forEach(ap);
  const lb: [number, number][] = [];
  for (let i = 0; i < lig.length; i++) for (let j = i + 1; j < lig.length; j++) { const d = Math.hypot(lig[i].x - lig[j].x, lig[i].y - lig[j].y, lig[i].z - lig[j].z); if (d < 1.9 * s) lb.push([i, j]); }
  return { kind: "pdb" as const, traces, lig, lb };
}
type MolScene = NonNullable<ReturnType<typeof parseMolBlock>>;
type PdbScene = NonNullable<ReturnType<typeof parsePdbScene>>;
function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, sc: MolScene | PdbScene, rx: number, ry: number) {
  const S = Math.min(W, H) * 0.4, cx = W / 2, cy = H / 2;
  const proj = (p: V3) => { const r = rotV(p, rx, ry); return { px: cx + r.x * S, py: cy - r.y * S, z: r.z }; };
  if (sc.kind === "mol") {
    const P = sc.atoms.map(proj);
    ctx.lineCap = "round";
    for (const [i, j] of sc.bonds) { // bonds as depth-shaded sticks
      if (P[i] === undefined || P[j] === undefined) continue;
      const zc = (P[i].z + P[j].z) / 2, sh = 0.55 + 0.45 * (zc + 1) / 2;
      ctx.strokeStyle = `rgba(120,128,140,${0.55 + 0.4 * sh})`; ctx.lineWidth = Math.max(1.5, S * 0.05);
      ctx.beginPath(); ctx.moveTo(P[i].px, P[i].py); ctx.lineTo(P[j].px, P[j].py); ctx.stroke();
    }
    sc.atoms.map((a, i) => ({ a, p: P[i] })).sort((u, v) => u.p.z - v.p.z).forEach(({ a, p }) => {
      const [col, rad] = elemInfo(a.el); if (a.el === "H") return; // hide H for clarity
      const sh = 0.45 + 0.55 * (p.z + 1) / 2, R = Math.max(2, rad * S * 0.42);
      const g = ctx.createRadialGradient(p.px - R * 0.3, p.py - R * 0.3, R * 0.2, p.px, p.py, R);
      g.addColorStop(0, mix(col, "#ffffff", 0.45 * sh)); g.addColorStop(1, mix(col, "#000000", 0.35 * (1 - sh)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.px, p.py, R, 0, 7); ctx.fill();
    });
  } else {
    for (const t of sc.traces) { // Cα backbone trace
      ctx.strokeStyle = "rgba(45,160,170,0.7)"; ctx.lineWidth = 1.6; ctx.beginPath();
      t.forEach((p, k) => { const q = proj(p); if (k === 0) ctx.moveTo(q.px, q.py); else ctx.lineTo(q.px, q.py); }); ctx.stroke();
    }
    const LP = sc.lig.map(proj);
    for (const [i, j] of sc.lb) { ctx.strokeStyle = "#c026d3"; ctx.lineWidth = Math.max(2, S * 0.045); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(LP[i].px, LP[i].py); ctx.lineTo(LP[j].px, LP[j].py); ctx.stroke(); }
    sc.lig.map((a, i) => ({ a, p: LP[i] })).sort((u, v) => u.p.z - v.p.z).forEach(({ a, p }) => {
      const R = Math.max(2.5, elemInfo(a.el)[1] * S * 0.4); ctx.fillStyle = a.el.toUpperCase() === "C" ? "#a21caf" : elemInfo(a.el)[0];
      ctx.beginPath(); ctx.arc(p.px, p.py, R, 0, 7); ctx.fill();
    });
  }
}
function mix(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return `rgb(${pa.map((x, i) => Math.round(x + (pb[i] - x) * t)).join(",")})`;
}
function Mol3DViewer({ sel }: { sel: Drug }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tpdb = sel.step1_structure.target_pdb;
  const [mode, setMode] = useState<"molecule" | "complex">("molecule");
  const [status, setStatus] = useState("");
  const rot = useRef({ x: 0.35, y: 0, auto: true });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const scene = useRef<MolScene | PdbScene | null>(null);

  useEffect(() => {
    let cancelled = false; scene.current = null;
    if (mode === "molecule") {
      const m = sel.step1_structure.mol3d ? parseMolBlock(sel.step1_structure.mol3d) : null;
      scene.current = m; setStatus(m ? "" : "3D conformer unavailable");
    } else if (tpdb) {
      setStatus(`loading ${tpdb.pdb}…`);
      fetch(`/POC_workflow/pdb/${tpdb.pdb}.pdb`).then((r) => r.text()).then((txt) => {
        if (cancelled) return; const s = parsePdbScene(txt, tpdb.ligand); scene.current = s; setStatus(s ? "" : `could not parse ${tpdb.pdb}`);
      }).catch(() => setStatus(`could not load ${tpdb.pdb}`));
    }
    rot.current.auto = true;
    return () => { cancelled = true; };
  }, [sel.id, mode, tpdb]);

  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const sc = scene.current;
      if (sc) { if (rot.current.auto) rot.current.y += 0.009; drawScene(ctx, cv.width, cv.height, sc, rot.current.x, rot.current.y); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; rot.current.auto = false; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; rot.current.y += (e.clientX - drag.current.x) * 0.012; rot.current.x += (e.clientY - drag.current.y) * 0.012; drag.current = { x: e.clientX, y: e.clientY }; };
  const onUp = () => { drag.current = null; };

  return (
    <div className="w-full flex flex-col items-center">
      {tpdb && (
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden mb-2">
          <button onClick={() => setMode("molecule")} className={`roboto-slab-regular text-[11px] px-2.5 py-1 ${mode === "molecule" ? "bg-teal-700 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>Molecule</button>
          <button onClick={() => setMode("complex")} className={`roboto-slab-regular text-[11px] px-2.5 py-1 ${mode === "complex" ? "bg-teal-700 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>Target complex</button>
        </div>
      )}
      <div className="relative rounded border border-gray-100 bg-white" style={{ width: "100%", maxWidth: 360 }}>
        <canvas ref={ref} width={360} height={280} className="block w-full touch-none" style={{ cursor: "grab" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
        {status && <div className="absolute inset-0 flex items-center justify-center roboto-slab-regular text-xs text-gray-400 pointer-events-none">{status}</div>}
      </div>
      <p className="roboto-slab-regular text-[11px] text-gray-400 mt-2 text-center">
        {mode === "complex" && tpdb
          ? <>Experimental structure <strong>PDB {tpdb.pdb}</strong> — {sel.display_name} (magenta) bound to {tpdb.target}. Auto-rotates; drag to spin.</>
          : <>3D conformer (RDKit ETKDG, illustrative geometry). Auto-rotates; drag to spin.{tpdb ? " Switch to “Target complex” for the binding interface." : ""}</>}
      </p>
    </div>
  );
}

/* ---------------- Step 2 — split-flap .h5ad acquisition board ---------------- */
function heatColor(t: number) { // viridis-ish: deep indigo → teal → yellow
  const stops = [[13, 8, 35], [59, 28, 140], [33, 144, 140], [180, 222, 44], [253, 231, 37]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1); const i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
/* Step 2 — a customer-facing pitch for the wet-lab exposure: the run that converts the chemistry
   prediction into a measured whole-organism readout and unlocks the rest of the workflow. */
function Step2({ sel, novel, onNext }: { sel: Drug; novel?: boolean; onNext: () => void }) {
  const compound = novel ? "your candidate" : sel.display_name;
  const OFFER = [
    { big: "$20,000", label: "per compound", sub: "fixed price · all-in" },
    { big: "~2 months", label: "ship → readout", sub: "dose · sequence · analyze" },
    { big: "1 vertebrate", label: "whole-organism scRNA", sub: "every tissue · single-cell" },
  ];
  const TEASE = [
    { n: 3, title: "Response fingerprint", body: "The cell × gene perturbation matrix — exactly which gene programs and cell types move." },
    { n: 4, title: "Atlas placement", body: "Your measured point among the 94 reference drugs — observed, not interpolated." },
    { n: 5, title: "Mechanism & context", body: "Most-likely mechanism of action, nearest measured neighbors, off-target & tox signals." },
    { n: 6, title: "Decision report", body: "A decision-grade summary you can take straight to the next go / no-go." },
  ];
  return (
    <div className="poc-fade">
      {/* hero */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 mb-3">
          <span className="text-base leading-none">🐟</span>
          <span className="roboto-slab-medium text-[10px] uppercase tracking-wide text-teal-700">Zeroshot Zebrafish Phenotype Screening</span>
        </div>
        <h2 className="roboto-slab-medium text-2xl sm:text-3xl text-gray-900 mb-2">Turn the prediction into a measurement.</h2>
        <p className="roboto-slab-regular text-sm text-gray-500 max-w-xl mx-auto">
          Everything up to here is chemistry — where <strong>{compound}</strong> <em>probably</em> sits. One wet-lab run replaces the
          guess with a real vertebrate readout, and turns the rest of this workflow from prediction into evidence.
        </p>
      </div>

      {/* offer band */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {OFFER.map((o) => (
          <div key={o.big} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="roboto-slab-medium text-2xl text-gray-900">{o.big}</div>
            <div className="roboto-slab-medium text-xs text-teal-700 mt-0.5">{o.label}</div>
            <div className="roboto-slab-regular text-[11px] text-gray-400 mt-0.5">{o.sub}</div>
          </div>
        ))}
      </div>

      {/* the deliverable — the 3 sentences */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <div className="roboto-slab-medium text-xs uppercase tracking-wide text-gray-400 mb-3">What comes back</div>
        <ol className="space-y-3">
          {[
            <>We dose live zebrafish with your compound and run <strong>whole-organism single-cell RNA-seq</strong> — a directly measured transcriptional response spanning every major tissue and cell type of an intact vertebrate, at single-cell resolution.</>,
            <>That measured fingerprint anchors your molecule in the <strong>94-drug MegaFin Atlas by observation</strong> rather than interpolation — placing it among reference compounds whose mechanism and in-vivo effects are already known.</>,
            <>From there the rest of this workflow stops predicting and starts <strong>reporting</strong>: the gene programs and tissues your compound actually perturbs, its most-likely mechanism and nearest measured neighbors, and developmental / organ-level liabilities — a decision-grade readout from a real vertebrate, months before a mouse study would tell you anything.</>,
          ].map((body, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-teal-600 text-white text-[11px] roboto-slab-medium flex items-center justify-center">{i + 1}</span>
              <p className="roboto-slab-regular text-sm text-gray-700 leading-snug">{body}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* teaser of the rest of the workflow */}
      <div className="mb-6">
        <div className="roboto-slab-medium text-xs uppercase tracking-wide text-gray-400 mb-2 text-center">…which unlocks the rest of this workflow</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TEASE.map((t) => (
            <div key={t.n} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="roboto-slab-regular text-[10px] text-gray-400 mb-0.5">Step {t.n}</div>
              <div className="roboto-slab-medium text-[13px] text-gray-800 mb-1">{t.title}</div>
              <div className="roboto-slab-regular text-[11px] text-gray-500 leading-snug">{t.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button onClick={onNext}
          className="roboto-slab-medium rounded-md border border-teal-700 bg-teal-700 text-white px-7 py-2.5 text-sm hover:bg-teal-800 transition">
          See what the readout unlocks ▸
        </button>
        <p className="roboto-slab-regular text-[11px] text-gray-400 mt-3">Illustrative customer preview — pricing, timeline and copy are a mock-up for this POC.</p>
      </div>
    </div>
  );
}

// log-fold-change → diverging color: positive (up) red, negative (down) blue, ~0 white
function lfcColor(lfc: number): string {
  const t = Math.max(-1, Math.min(1, lfc / 2.5));
  if (t >= 0) { const c = Math.round(255 - 165 * t); return `rgb(255,${c},${c})`; }
  const tt = -t; const c = Math.round(255 - 165 * tt); return `rgb(${c},${c},255)`;
}

type Tip = { title: string; sub: string; x: number; y: number } | null;
const FP_VIEWS = [
  { key: "zebrafish", label: "Zebrafish organs" }, { key: "programs", label: "Pathways" },
] as const;
type FpView = typeof FP_VIEWS[number]["key"];

function Step3({ sel }: { sel: Drug }) {
  const fp = sel.step2_fingerprint;
  const [view, setView] = useState<FpView>("zebrafish");
  return (
    <div>
      <h2 className="roboto-slab-medium text-lg text-gray-800 mb-1">Step 3 — Response fingerprint</h2>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
        The {sel.display_name} response, projected onto a whole organism (zebrafish organ systems) and lifted to mechanism (transcriptional pathways).
      </p>
      <div className="inline-flex flex-wrap rounded-md border border-gray-300 overflow-hidden mb-3">
        {FP_VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`roboto-slab-regular text-xs px-3 py-1.5 border-r border-gray-200 last:border-r-0 ${
              view === v.key ? "bg-gray-800 text-gray-50" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
            {v.label}
          </button>
        ))}
      </div>
      {view === "programs" && <ProgramsView fp={fp} />}
      {view === "zebrafish" && <ZebrafishView fp={fp} sel={sel} />}
    </div>
  );
}

/* Zebrafish — illustrative whole-organism projection: organ systems light by inferred involvement */
function ZebrafishView({ fp, sel }: { fp: Drug["step2_fingerprint"]; sel: Drug }) {
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
        <p className="roboto-slab-regular text-[11px] text-amber-800">
          <strong>Stand-in for the product vision.</strong> We aren&apos;t running zebrafish yet — organ involvement here is
          <em> inferred</em> from {sel.display_name}&apos;s molecular programs via a curated pathway→organ map. In production this
          panel is read directly from whole-organism zebrafish single-cell data.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="relative">
          <ZebrafishSVG organs={fp.organs} height={210}
            onHover={(o, x, y) => setTip(o ? { title: o.system, sub: `involvement ${Math.round(o.intensity * 100)}%${o.drivers && o.drivers.length ? " · " + o.drivers.join(", ") : ""}`, x, y } : null)} />
          {tip && <FpTip tip={tip} />}
        </div>
        <div>
          <div className="roboto-slab-medium text-xs text-gray-600 mb-2">Inferred organ-system involvement <span className="text-gray-400 font-normal">— click a system for detail</span></div>
          <OrganDetailList organs={fp.organs} drug={sel.display_name} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="roboto-slab-regular text-[11px] text-gray-500">low</span>
        <div className="h-3 w-40 rounded" style={{ background: "linear-gradient(90deg,#e5e7eb,#f59e0b,#dc2626)" }} />
        <span className="roboto-slab-regular text-[11px] text-gray-500">high</span>
      </div>
      <p className="roboto-slab-regular text-xs text-gray-400 mt-2">{fp.organ_basis}.</p>
    </div>
  );
}

/* developer-relevant detail per organ system (what high involvement implies + how you'd follow up) */
const ORGAN_DETAIL: Record<string, { what: string; assay: string }> = {
  "Brain / CNS": { what: "Neuro-activity, behavioral, and neurotoxicity risk — relevant to therapeutic window and CNS penetrance.", assay: "Zebrafish locomotor (startle / optomotor) assays, seizure-liability readouts, neuronal markers (elavl3, sox2)." },
  "Eye / retina": { what: "Ocular developmental or phototoxicity effects; eyes are a sensitive, easily-imaged organ in zebrafish.", assay: "Eye-size morphometry, retinal lamination, opsin/rhodopsin (opn1, rho) markers." },
  "Heart": { what: "Cardiac involvement is a top dose-limiting-toxicity flag (e.g. anthracycline-like cardiotoxicity).", assay: "Heart-rate & ejection-fraction video, pericardial-edema scoring; markers myh6, tnnt2, nppa/nppb." },
  "Liver": { what: "Hepatic metabolism, lipid handling, clearance, and drug-induced-liver-injury (DILI) risk — informs PK.", assay: "Liver-size, neutral-lipid (oil-red-O / fluorescent), hepatocyte markers (fabp10a); metabolite profiling." },
  "Intestine / gut": { what: "Effects on the rapidly-dividing gut epithelium — a proliferation / GI-toxicity readout.", assay: "Gut morphology & motility, proliferation (pcna), enterocyte markers (fabp2)." },
  "Kidney (pronephros)": { what: "Nephrotoxicity and fluid-balance liability — edema is an easily-scored zebrafish phenotype.", assay: "Pronephros morphology, glomerular filtration (FITC-dextran clearance), pax2a / nphs markers." },
  "Skeletal muscle": { what: "Myotoxicity or metabolic load on muscle; somite integrity is birefringence-visible.", assay: "Muscle birefringence, somite boundaries, markers myod1, actc1; touch-evoked movement." },
  "Blood / immune": { what: "Haematopoietic suppression or immunomodulation — myelosuppression and inflammation liabilities.", assay: "gata1 / pu.1 reporters, neutrophil (lcp1) counts, tail-wound inflammation assay." },
  "Vasculature": { what: "Central to anti-angiogenic intent and vascular toxicity; vessels are live-imaged in transgenic lines.", assay: "Intersegmental-vessel sprouting in kdrl/fli1:GFP reporters, vessel-patterning & perfusion." },
};
function OrganDetailList({ organs, drug }: { organs: Organ[]; drug: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...organs].sort((a, b) => b.intensity - a.intensity);
  return (
    <div className="space-y-1">
      {sorted.map((o) => {
        const det = ORGAN_DETAIL[o.system]; const isOpen = open === o.system;
        return (
          <div key={o.system} className="rounded border border-transparent hover:border-gray-200">
            <button onClick={() => setOpen(isOpen ? null : o.system)} className="w-full flex items-center gap-2 py-0.5 text-left">
              <span className="roboto-slab-regular text-[11px] text-gray-600 w-36 truncate text-right">{o.system}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                <div className="h-3 rounded" style={{ width: `${Math.round(o.intensity * 100)}%`, background: organColor(o.intensity) }} />
              </div>
              <span className="roboto-slab-regular text-[10px] text-gray-400 w-8 text-right">{Math.round(o.intensity * 100)}%</span>
              <span className="roboto-slab-regular text-[10px] text-gray-300">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && det && (
              <div className="ml-2 mb-2 mt-1 rounded bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="roboto-slab-regular text-[11px] text-gray-700 leading-relaxed mb-1"><strong>What it means:</strong> {det.what}</p>
                <p className="roboto-slab-regular text-[11px] text-gray-600 leading-relaxed mb-1"><strong>How we&apos;d confirm in zebrafish:</strong> {det.assay}</p>
                {o.drivers && o.drivers.length > 0 && (
                  <p className="roboto-slab-regular text-[11px] text-gray-500"><strong>Why it lit up for {drug}:</strong> driven by the {o.drivers.join(", ")} program{o.drivers.length > 1 ? "s" : ""}.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Pathways — canonical transcriptional-program signature scores (diverging bars) */
function ProgramsView({ fp }: { fp: Drug["step2_fingerprint"] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ps = fp.programs.programs;
  const m = Math.max(0.5, ...ps.map((p) => Math.abs(p.score)));
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex justify-between roboto-slab-regular text-[10px] text-gray-400 mb-1 px-1">
        <span className="ml-auto mr-auto">← repressed&nbsp;&nbsp;|&nbsp;&nbsp;induced →</span>
        <span>{ps.length} programs</span>
      </div>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {ps.map((p) => {
          const pct = (Math.abs(p.score) / m) * 50; const up = p.score >= 0;
          return (
            <div key={p.name}>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOpen(open === p.name ? null : p.name)}>
                <div className="roboto-slab-regular text-xs text-gray-700 w-44 truncate text-right" title={p.name}>{p.name}</div>
                <div className="relative flex-1 h-5 bg-gray-50 rounded">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300" />
                  <div className="absolute top-0.5 bottom-0.5 rounded" style={{
                    [up ? "left" : "right"]: "50%", width: `${pct}%`,
                    background: up ? "#10b981" : "#f43f5e" } as any} />
                  <div className={`absolute top-0 h-5 flex items-center roboto-slab-medium text-[11px] ${up ? "text-emerald-800" : "text-rose-800"}`}
                    style={{ [up ? "left" : "right"]: `calc(50% + ${pct}% + 4px)` } as any}>{p.score > 0 ? "+" : ""}{p.score.toFixed(2)}</div>
                </div>
                <div className="roboto-slab-regular text-[10px] text-gray-400 w-12">n={p.n}</div>
              </div>
              {open === p.name && (
                <div className="ml-44 mt-1 mb-2 flex flex-wrap gap-1">
                  {p.hits.map((hh) => (
                    <span key={hh.g} title={`log₂FC ${hh.lfc} · support ${hh.sup}`}
                      className="roboto-slab-regular text-[11px] px-1.5 py-0.5 rounded border"
                      style={{ borderColor: "#e5e7eb", background: lfcColor(hh.lfc) }}>{hh.g}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="roboto-slab-regular text-xs text-gray-400 mt-3">
        {fp.programs.basis}. Click a program to see its member genes. This lifts the per-gene fingerprint to the
        mechanism level — the same MoA story Steps 4–5 build on.
      </p>

      {/* pathway diagrams for the most-affected programs */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="roboto-slab-medium text-sm text-gray-700 mb-2">Pathway diagrams — top affected programs</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ps.slice(0, 3).map((p) => <PathwayDiagram key={p.name} p={p} />)}
        </div>
        <p className="roboto-slab-regular text-[11px] text-gray-400 mt-2">
          Each diagram shows the program&apos;s regulatory output: the pathway node drives its member genes up (red ▲) or down (blue ▼). Direction and magnitude are from the signature above.
        </p>
      </div>
    </div>
  );
}

/* A compact pathway diagram: pathway node → its strongest induced/repressed member genes. */
function PathwayDiagram({ p }: { p: Program }) {
  const W = 220, H = 150;
  const up = p.hits.filter((h) => h.lfc > 0).slice(0, 3);
  const dn = p.hits.filter((h) => h.lfc < 0).slice(0, 3);
  const hubY = H / 2, hubX = 30;
  const node = (g: ProgHit, x: number, y: number, dir: "up" | "down") => (
    <g key={g.g}>
      <line x1={hubX + 18} y1={hubY} x2={x - 24} y2={y} stroke={dir === "up" ? "#fca5a5" : "#93c5fd"} strokeWidth={1.2} />
      <rect x={x - 24} y={y - 9} width={48} height={18} rx={4} fill={lfcColor(g.lfc)} stroke="#e5e7eb" />
      <text x={x} y={y + 1} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#1f2937" className="roboto-slab-medium">{g.g}</text>
      <text x={x + 28} y={y + 3} fontSize={9} fill={dir === "up" ? "#dc2626" : "#2563eb"}>{dir === "up" ? "▲" : "▼"}</text>
    </g>
  );
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.name} pathway diagram`}>
        {up.map((g, i) => node(g, 150, 26 + i * 22, "up"))}
        {dn.map((g, i) => node(g, 150, H - 26 - i * 22, "down"))}
        <circle cx={hubX} cy={hubY} r={18} fill={p.score >= 0 ? "#ecfdf5" : "#fef2f2"} stroke={p.score >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={1.5} />
        <text x={hubX} y={hubY + 1} fontSize={8} textAnchor="middle" dominantBaseline="middle" fill="#374151" className="roboto-slab-medium">path</text>
      </svg>
      <div className="roboto-slab-medium text-[11px] text-gray-700 truncate text-center" title={p.name}>{p.name}</div>
      <div className={`roboto-slab-regular text-[10px] text-center ${p.score >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{p.score > 0 ? "+" : ""}{p.score} · n={p.n}</div>
    </div>
  );
}

function FpTip({ tip }: { tip: NonNullable<Tip> }) {
  return (
    <div className="pointer-events-none absolute z-10 rounded bg-gray-900/90 px-2 py-1 text-[11px] text-gray-50"
      style={{ left: tip.x + 12, top: tip.y + 12 }}>
      <div className="roboto-slab-medium">{tip.title}</div>
      <div className="text-gray-300">{tip.sub}</div>
    </div>
  );
}

/* ---------------- Step 4 — interactive atlas (pan/zoom/hover/click, regime toggle, MoA overlay) -------- */
type Regime = "phenotype" | "chemistry";
function coordOf(p: CPoint, r: Regime): [number, number] { return r === "phenotype" ? p.coords2d : p.chem2d; }
function qCoord(sel: Drug, r: Regime): [number, number] { return r === "phenotype" ? sel.step3_embedding.coords2d : sel.step3_embedding.chem2d; }
function regimeNeighbors(sel: Drug, r: Regime): Neighbor[] { return r === "phenotype" ? sel.step3_embedding.neighbors : sel.step3_embedding.chem_neighbors; }

function fieldColor(t: number): [number, number, number, number] { // uncertain (indigo) → confident (amber)
  const stops = [[55, 48, 163], [20, 184, 166], [245, 158, 11]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1); const i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f), Math.round(35 + 165 * t)];
}
function Step4({ sel, cloud, manifest }: { sel: Drug; cloud: Const | null; manifest?: Manifest }) {
  const [regime, setRegime] = useState<Regime>("phenotype");
  const [colorByMoa, setColorByMoa] = useState(true);
  const [showField, setShowField] = useState(true);
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

  // interpolation-confidence field: KDE of atlas density over the manifold → warm where we can interpolate
  const fieldUrl = useMemo(() => {
    if (typeof document === "undefined" || !pts.length) return null;
    const GW = 128, GH = Math.round((GW * H) / W);
    const cnv = document.createElement("canvas"); cnv.width = GW; cnv.height = GH;
    const ctx = cnv.getContext("2d"); if (!ctx) return null;
    const pos = pts.map((p) => { const c = coordOf(p, regime); return [(base.sx(c[0]) * GW) / W, (base.sy(c[1]) * GH) / H] as [number, number]; });
    const h = 8.5, dens = new Float32Array(GW * GH); let max = 0;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      let s = 0; for (let k = 0; k < pos.length; k++) { const dx = gx - pos[k][0], dy = gy - pos[k][1]; s += Math.exp(-(dx * dx + dy * dy) / (2 * h * h)); }
      dens[gy * GW + gx] = s; if (s > max) max = s;
    }
    const img = ctx.createImageData(GW, GH);
    for (let i = 0; i < GW * GH; i++) { const [r, g, b, a] = fieldColor(dens[i] / (max || 1)); img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a; }
    ctx.putImageData(img, 0, 0);
    return cnv.toDataURL();
  }, [pts, regime, base]);

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
        {sel.display_name} (◆) placed among the {pts.length}-compound atlas. The <strong>heat field</strong> is the
        interpolation-confidence landscape — warm where the atlas is dense (we can interpolate well), cool in the gaps.
        Toggle phenotype vs chemistry space; drag to pan, scroll to zoom, click a point to inspect.
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
        <button onClick={() => setShowField((s) => !s)}
          className="roboto-slab-regular text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100">
          Confidence field: {showField ? "on" : "off"}
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
          {/* interpolation-confidence field (pans/zooms with the plot) */}
          {showField && fieldUrl && (
            <image href={fieldUrl} x={view.tx} y={view.ty} width={view.k * W} height={view.k * H}
              preserveAspectRatio="none" opacity={0.8} style={{ imageRendering: "auto" }} />
          )}
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
      {showField && (
        <div className="flex items-center gap-2 mt-2">
          <span className="roboto-slab-regular text-[11px] text-gray-500">interpolation confidence:</span>
          <span className="roboto-slab-regular text-[11px] text-gray-400">low</span>
          <div className="h-3 w-32 rounded" style={{ background: "linear-gradient(90deg,rgb(55,48,163),rgb(20,184,166),rgb(245,158,11))" }} />
          <span className="roboto-slab-regular text-[11px] text-gray-400">high</span>
        </div>
      )}
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

      <NeighborEffects ne={sel.step4_mechanism.neighbor_effects} sel={sel} />
    </div>
  );
}

/* Neighbor effects → assumed effect: the atlas premise made visual. The subject is assumed to behave
   like its nearest characterized neighbors; their effects synthesize into its inferred profile. */
function NeighborEffects({ ne, sel }: { ne: NeighborEffects; sel: Drug }) {
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="mt-6">
      <h3 className="roboto-slab-medium text-base text-gray-800 mb-1">What we infer {sel.display_name} does — from its neighbors</h3>
      <p className="roboto-slab-regular text-sm text-gray-500 mb-3">
        Each nearest neighbor is a <strong>characterized</strong> compound. Their measured effects are the evidence;
        their consensus is the effect we <strong>assume</strong> for {sel.display_name}.
      </p>

      {/* neighbor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
        {ne.neighbors.map((nb) => {
          const top = [...nb.organs].sort((a, b) => b.intensity - a.intensity).slice(0, 3);
          return (
            <div key={nb.id} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="roboto-slab-medium text-sm text-gray-800 truncate" title={nb.id}>{nb.id}</div>
              <div className="roboto-slab-regular text-[11px] mb-1.5" style={{ color: moaColor(nb.moa_fine) }}>{nb.moa_fine}</div>
              <div className="space-y-1">
                {top.map((o) => (
                  <div key={o.system} className="flex items-center gap-1.5">
                    <span className="roboto-slab-regular text-[10px] text-gray-500 w-28 truncate text-right">{o.system}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden"><div className="h-2" style={{ width: `${Math.round(o.intensity * 100)}%`, background: organColor(o.intensity) }} /></div>
                  </div>
                ))}
              </div>
              <div className="roboto-slab-regular text-[10px] text-gray-400 mt-1.5 truncate" title={nb.programs.map((p) => p.name).join(", ")}>
                {nb.programs.slice(0, 2).map((p) => `${p.name.split(" /")[0]} ${p.score > 0 ? "+" : ""}${p.score}`).join(" · ")}
              </div>
            </div>
          );
        })}
      </div>

      {/* assumed effect */}
      <div className="rounded-md border border-teal-200 bg-teal-50/40 p-4">
        <div className="roboto-slab-medium text-sm text-teal-900 mb-2">⮕ Assumed effect for {sel.display_name} (neighbor consensus)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="relative">
            <ZebrafishSVG organs={ne.assumed_organs} height={180}
              onHover={(o, x, y) => setTip(o ? { title: o.system, sub: `assumed involvement ${Math.round(o.intensity * 100)}%`, x, y } : null)} />
            {tip && <FpTip tip={tip} />}
          </div>
          <div>
            <div className="roboto-slab-regular text-xs text-gray-600 mb-1">Consensus programs</div>
            <div className="flex flex-wrap gap-1">
              {ne.assumed_programs.map((p) => (
                <span key={p.name} className="roboto-slab-regular text-[11px] px-2 py-0.5 rounded-full border"
                  style={{ borderColor: p.score >= 0 ? "#99f6e4" : "#fecdd3", background: p.score >= 0 ? "#f0fdfa" : "#fff1f2",
                    color: p.score >= 0 ? "#0f766e" : "#be123c" }}>
                  {p.name.split(" /")[0]} {p.score > 0 ? "+" : ""}{p.score}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="roboto-slab-regular text-xs text-gray-400 mt-3">{ne.basis}.</p>
      </div>

      {/* the interpretation layer — explanatory prose for each inferred effect */}
      {ne.narrative && ne.narrative.length > 0 && (
        <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="roboto-slab-medium text-sm text-gray-800">Reading the inference</div>
            {typeof ne.confidence === "number" && (
              <span className="roboto-slab-medium text-[11px] px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">{ne.confidence}% interpolation confidence</span>
            )}
          </div>
          <div className="space-y-2">
            {ne.narrative.map((s, i) => (
              <p key={i} className={`roboto-slab-regular text-sm leading-relaxed ${i === 0 ? "text-gray-700 font-medium" : "text-gray-600"}`}>
                {i > 0 && i < ne.narrative!.length - 1 && <span className="text-teal-600 mr-1">›</span>}{s}
              </p>
            ))}
          </div>
        </div>
      )}
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
function Step5({ sel, manifest, selTarget, selectableTargets, smiles, drugByName }:
  { sel: Drug; manifest?: Manifest; selTarget?: string; selectableTargets?: any[] | null; smiles?: string; drugByName?: Map<string, any> }) {
  const tgt = selTarget && selectableTargets ? selectableTargets.find((t) => t.human_gene === selTarget) : null;
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

      {/* target-aware panels: binding plausibility (Boltz-2) + grounded anchor prior */}
      {tgt && (
        <div className="flex flex-col gap-3 mb-5">
          {smiles ? <BindingBand smiles={smiles} gene={tgt.human_gene} /> : null}
          <AnchorPrior target={tgt} drugByName={drugByName || new Map()} />
        </div>
      )}

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
