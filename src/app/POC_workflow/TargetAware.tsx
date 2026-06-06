"use client";
/* Target-aware submission UI (additive). Three pieces, all driven by the data layer built in
   /data/drug_dev/tahoe_embedding/scores/target_aware/ and the Boltz-2 GPU service:

     useSelectableTargets()  -> loads /POC_workflow/target_dropdown.json (ChEMBL targets that
                                have a zebrafish ortholog expressed at 24-48hpf; ONLY these are
                                selectable). Each carries evidence depth (anchor count + names).
     <TargetSelect>          -> the curated dropdown + the selected target's ortholog/expression
                                /evidence detail (build steps 2 & 3).
     <BindingBand>           -> on submit, calls the Boltz-2 service for a CALIBRATED-BAND binding
                                plausibility check vs the zebrafish ortholog (build step 4).
     <AnchorPrior>           -> the anchor drugs sharing the selected target + their phenotype
                                signatures, as the grounded prior (build step 5).

   HARD LABEL throughout: binding plausibility != phenotypic effect. No extrapolation beyond the atlas. */
import { useEffect, useRef, useState } from "react";

const BIND_API = "https://zscape.zeroshot.bio/api/bind";

export type SelectableTarget = {
  human_gene: string;
  zfin_ortholog: string;
  zfin_id: string;
  expression_max_frac: number;
  expression_celltype: string;
  expression_timepoint: string;
  ortholog_evidence: string[];
  ortholog_n_pubs: number;
  binding_site_conservation: string;
  n_anchors: number;
  n_anchors_primary: number;
  anchors: string[];
};

export function useSelectableTargets() {
  const [targets, setTargets] = useState<SelectableTarget[] | null>(null);
  useEffect(() => {
    fetch("/POC_workflow/target_dropdown.json").then((r) => r.json()).then(setTargets).catch(() => setTargets([]));
  }, []);
  return targets;
}

/* ---- instant, self-contained schematic protein cartoon (no library, no fetch) ----
   Deterministic from the gene name so each target reads as a distinct fold. Clearly labelled
   illustrative — it is NOT the experimental/predicted structure of this specific protein. */
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function smoothPath(pts: number[][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
export function ProteinDepiction({ gene, w = 200, h = 170 }: { gene: string; w?: number; h?: number }) {
  const seed = hashStr(gene);
  const rng = mulberry32(seed);
  const hue = seed % 360, hue2 = (hue + 150) % 360;
  const N = 7, pad = 26;
  const pts: number[][] = Array.from({ length: N }, (_, i) => [
    pad + (i / (N - 1)) * (w - 2 * pad),
    pad + rng() * (h - 2 * pad),
  ]);
  const helixSegs = [[0, 1], [3, 4], [5, 6]];     // capsule "helices"
  const sheetSeg = [2, 3];                         // arrow "strand"
  const cap = (a: number[], b: number[], color: string) =>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={13} strokeLinecap="round" opacity={0.9} />;
  const s0 = pts[sheetSeg[0]], s1 = pts[sheetSeg[1]];
  const ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
  const ah = 9;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label={`schematic fold for ${gene}`}>
      <path d={smoothPath(pts)} fill="none" stroke="#9ca3af" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      {/* beta strand as a flat arrow */}
      {cap(s0, [s1[0] - Math.cos(ang) * ah, s1[1] - Math.sin(ang) * ah], `hsl(${hue2} 55% 60%)`)}
      <polygon points={`${s1[0]},${s1[1]} ${s1[0] - Math.cos(ang - 0.5) * ah * 1.6},${s1[1] - Math.sin(ang - 0.5) * ah * 1.6} ${s1[0] - Math.cos(ang + 0.5) * ah * 1.6},${s1[1] - Math.sin(ang + 0.5) * ah * 1.6}`} fill={`hsl(${hue2} 55% 55%)`} />
      {/* alpha helices as capsules */}
      {helixSegs.map(([i, j], k) => <g key={k}>{cap(pts[i], pts[j], `hsl(${hue} 60% 55%)`)}</g>)}
    </svg>
  );
}

/* ---- real protein structure: auto-rotating Cα backbone of the AlphaFold model (zebrafish
   ortholog), drawn on a plain 2D canvas (no WebGL). Falls back to the schematic if no model. ---- */
function parseCA(txt: string): number[][] {
  const pts: number[][] = [];
  for (const ln of txt.split("\n")) {
    if (ln.startsWith("ATOM") && ln.slice(12, 16).trim() === "CA") {
      const x = parseFloat(ln.slice(30, 38)), y = parseFloat(ln.slice(38, 46)), z = parseFloat(ln.slice(46, 54));
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) pts.push([x, y, z]);
    }
  }
  return pts;
}
export function ProteinCanvas({ gene, ortholog, w = 200, h = 170 }: { gene: string; ortholog?: string; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef<number[][] | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancel = false; setOk(null); pts.current = null;
    fetch(`/POC_workflow/protein_pdb/${gene}.pdb`).then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((txt) => { if (cancel) return; const p = parseCA(txt); if (p.length > 3) { pts.current = p; setOk(true); } else setOk(false); })
      .catch(() => { if (!cancel) setOk(false); });
    return () => { cancel = true; };
  }, [gene]);
  useEffect(() => {
    if (!ok || !pts.current || !ref.current) return;
    const P = pts.current, cv = ref.current, ctx = cv.getContext("2d");
    if (!ctx) return;
    const c = [0, 1, 2].map((k) => P.reduce((s, p) => s + p[k], 0) / P.length);
    let maxd = 1; for (const p of P) for (let k = 0; k < 3; k++) maxd = Math.max(maxd, Math.abs(p[k] - c[k]));
    const scale = (Math.min(w, h) * 0.42) / maxd;
    const hue = (hashStr(gene) % 360);
    let ang = 0, raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const proj = P.map((p) => { const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2]; return [w / 2 + (x * ca - z * sa) * scale, h / 2 - y * scale, x * sa + z * ca]; });
      const zr = proj.map((p) => p[2]); const zmin = Math.min(...zr), zmax = Math.max(...zr) || 1;
      for (let i = 0; i < proj.length - 1; i++) {
        const a = proj[i], b = proj[i + 1];
        const t = (((a[2] + b[2]) / 2) - zmin) / (zmax - zmin || 1);   // 0 far .. 1 near
        ctx.strokeStyle = `hsl(${hue} 62% ${78 - t * 42}%)`;
        ctx.lineWidth = 1.4 + t * 2.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ang += 0.006; raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ok, gene, w, h]);

  if (ok === false) return <ProteinDepiction gene={ortholog || gene} w={w} h={h} />;
  return <canvas ref={ref} width={w} height={h} aria-label={`AlphaFold structure for ${gene}`} />;
}

/* ---- chemical-compatibility ranking: ECFP4 Tanimoto of the candidate vs each target's anchors
   (max over anchors), computed in-browser with RDKit wasm. Used to rank the dropdown. ---- */
export function tanimotoBits(a: string, b: string) {
  let inter = 0, uni = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { const x = a[i] === "1", y = b[i] === "1"; if (x && y) inter++; if (x || y) uni++; }
  return uni ? inter / uni : 0;
}
function morganFp(R: any, smiles: string): string | null {
  let m: any = null;
  try { m = R.get_mol(smiles); } catch { return null; }
  if (!m) return null;
  let fp: string | null = null;
  try { fp = m.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 })); }
  catch { try { fp = m.get_morgan_fp(); } catch { fp = null; } }
  try { m.delete(); } catch { /* no-op */ }
  return fp || null;
}
export function rankTargets(R: any, candidateSmiles: string, targets: SelectableTarget[], smilesByDrug: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  const cfp = morganFp(R, candidateSmiles);
  if (!cfp) return out;
  const fpCache = new Map<string, string | null>();
  const fpOf = (name: string) => {
    if (fpCache.has(name)) return fpCache.get(name)!;
    const s = smilesByDrug.get(name); const f = s ? morganFp(R, s) : null; fpCache.set(name, f); return f;
  };
  for (const t of targets) {
    let best = 0;
    for (const a of t.anchors) { const f = fpOf(a); if (f) { const s = tanimotoBits(cfp, f); if (s > best) best = s; } }
    out.set(t.human_gene, best);
  }
  return out;
}

/* ---- curated dropdown (heading + selector + protein vis on selection) ----
   Mirrors the "Submit a molecule" heading style. The selector is meant to be revealed only
   after a molecule has been submitted (parent gates rendering). */
export function TargetSelect({ targets, value, onChange, scores }:
  { targets: SelectableTarget[] | null; value: string; onChange: (g: string) => void; scores?: Map<string, number> | null }) {
  const sel = targets?.find((t) => t.human_gene === value) || null;
  const ranked = !!(scores && scores.size);
  const ordered = (targets || []).slice().sort((a, b) => {
    if (ranked) {
      const d = (scores!.get(b.human_gene) || 0) - (scores!.get(a.human_gene) || 0);
      if (Math.abs(d) > 1e-6) return d;
    }
    return (b.n_anchors_primary - a.n_anchors_primary) || (b.n_anchors - a.n_anchors);
  });
  return (
    <div className="w-full max-w-xl mx-auto">
      <h2 className="roboto-slab-medium text-xl text-gray-800 text-center mb-1">Intended protein target</h2>
      <p className="roboto-slab-regular text-xs text-gray-400 text-center mb-4">
        Optional. Only human targets with a zebrafish ortholog expressed at 24–48hpf are selectable
        {ranked ? <>, <strong>ranked by chemical similarity of your molecule to each target&apos;s anchors</strong></> : null}.
      </p>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="roboto-slab-regular w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-gray-700 focus:outline-none">
        <option value="">— no target (chemistry-only triage) —</option>
        {ordered.map((t) => {
          const sc = scores?.get(t.human_gene) || 0;
          return (
            <option key={t.human_gene} value={t.human_gene}>
              {ranked ? `[sim ${sc.toFixed(2)}] ` : ""}{t.human_gene} → {t.zfin_ortholog}  ·  {t.n_anchors} anchor{t.n_anchors === 1 ? "" : "s"}
              {t.n_anchors_primary ? ` (${t.n_anchors_primary} on-MOA)` : ""}
            </option>
          );
        })}
      </select>
      {sel && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm poc-fade flex items-center gap-4">
          <div className="shrink-0 rounded-lg bg-gray-50 border border-gray-100 p-1">
            <ProteinCanvas gene={sel.human_gene} ortholog={sel.zfin_ortholog} />
            <div className="text-center roboto-slab-regular text-[9px] text-gray-400 -mt-1">AlphaFold model — zebrafish {sel.zfin_ortholog} (Cα, drag-free auto-spin)</div>
          </div>
          <div className="text-[11px] text-gray-600 roboto-slab-regular leading-relaxed">
            <div><strong>{sel.human_gene}</strong> → zebrafish <strong>{sel.zfin_ortholog}</strong> ({sel.zfin_id})</div>
            {ranked ? <div>Chemical similarity to its anchors: <strong>{(scores!.get(sel.human_gene) || 0).toFixed(2)}</strong> (max ECFP4 Tanimoto).</div> : null}
            <div>Expressed in <strong>{Math.round(sel.expression_max_frac * 100)}%</strong> of <em>{sel.expression_celltype}</em> cells at {sel.expression_timepoint}.</div>
            <div>Engaged by <strong>{sel.n_anchors}</strong> anchor drug{sel.n_anchors === 1 ? "" : "s"}{sel.n_anchors_primary ? `, ${sel.n_anchors_primary} as canonical MOA` : ""}: {sel.anchors.slice(0, 6).join(", ")}{sel.anchors.length > 6 ? "…" : ""}.</div>
            <div className="text-gray-400 mt-1">Ortholog evidence: {sel.ortholog_evidence.join("/")} ({sel.ortholog_n_pubs} pub{sel.ortholog_n_pubs === 1 ? "" : "s"}). Binding-site conservation: {sel.binding_site_conservation.replace(/_/g, " ")}.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- binding plausibility band (Boltz-2 GPU service) ---- */
type Band = { median: number; lo: number; hi: number; n: number };
type BindResult = {
  ok: boolean; gene?: string; zfish_ortholog?: string;
  binding_probability_band?: Band; pred_affinity_log_ic50_band?: Band;
  pose_confidence?: { ligand_iptm?: number; complex_plddt?: number; iptm?: number };
  calibration?: string; disclaimer?: string; error?: string;
};

export function BindingBand({ smiles, gene }: { smiles: string; gene: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<BindResult | null>(null);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!smiles || !gene) return;
    let cancelled = false;
    setStatus("running"); setResult(null); setErr("");

    const poll = (jobId: string) => {
      timer.current = setTimeout(async () => {
        try {
          const r = await fetch(`${BIND_API}/${jobId}`);
          const j = await r.json();
          if (cancelled) return;
          if (j.status === "done" && j.result) { setResult(j.result); setStatus(j.result.ok ? "done" : "error"); if (!j.result.ok) setErr(j.result.error || "binding failed"); }
          else if (j.status === "error") { setStatus("error"); setErr(j.error || "binding failed"); }
          else poll(jobId);
        } catch { if (!cancelled) { setStatus("error"); setErr("could not reach binding service"); } }
      }, 4000);
    };

    (async () => {
      try {
        const r = await fetch(BIND_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ smiles, gene }) });
        const j = await r.json();
        if (cancelled) return;
        if (j.status === "done" && j.result) { setResult(j.result); setStatus(j.result.ok ? "done" : "error"); }
        else if (j.job_id) poll(j.job_id);
        else { setStatus("error"); setErr(j.error || "binding service error"); }
      } catch { if (!cancelled) { setStatus("error"); setErr("could not reach binding service"); } }
    })();

    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [smiles, gene]);

  const pb = result?.binding_probability_band;
  // qualitative bucket only — this is a RAW Boltz-2 score with no reference frame, so we deliberately
  // avoid the word "confidence" / "probability" which would imply a calibrated number.
  const bucket = pb ? (pb.median >= 0.7 ? "docks well" : pb.median >= 0.4 ? "borderline" : "weak") : null;
  const accent = bucket === "docks well" ? "#0d9488" : bucket === "borderline" ? "#d97706" : "#9ca3af";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="roboto-slab-medium text-sm text-gray-700 mb-1">
        Binding plausibility vs {gene}{result?.zfish_ortholog ? ` (zebrafish ${result.zfish_ortholog})` : ""}
      </div>
      <p className="roboto-slab-regular text-[11px] text-amber-700 mb-3">
        Chemistry check only — <strong>does the molecule dock the pocket?</strong> This is <strong>not</strong> a prediction of phenotypic effect.
      </p>

      {status === "running" && (
        <div className="flex items-center gap-2 text-gray-400 py-3">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="roboto-slab-regular text-sm">Boltz-2 co-folding on GPU — a couple of minutes…</span>
        </div>
      )}
      {status === "error" && <p className="roboto-slab-regular text-sm text-gray-500 py-2">Binding check unavailable: {err}</p>}

      {status === "done" && pb && (
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="roboto-slab-medium text-2xl" style={{ color: accent }}>{pb.median.toFixed(2)}</span>
            <span className="roboto-slab-regular text-sm text-gray-500">raw Boltz-2 score</span>
            <span className="roboto-slab-regular text-xs px-2 py-0.5 rounded-full" style={{ background: accent + "22", color: accent }}>{bucket}</span>
          </div>
          {/* band bar — raw ensemble spread on a 0–1 scale, not a calibrated probability */}
          <div className="relative h-2 mt-2 rounded-full bg-gray-100">
            <div className="absolute h-2 rounded-full" style={{ left: `${pb.lo * 100}%`, width: `${Math.max(2, (pb.hi - pb.lo) * 100)}%`, background: accent + "55" }} />
            <div className="absolute h-2 w-[2px]" style={{ left: `${pb.median * 100}%`, background: accent }} />
          </div>
          <div className="roboto-slab-regular text-[11px] text-gray-500 mt-1">
            Raw ensemble band {pb.lo.toFixed(2)}–{pb.hi.toFixed(2)} (n={pb.n})
            {result?.pred_affinity_log_ic50_band ? `  ·  pred log-IC50 ${result.pred_affinity_log_ic50_band.median}` : ""}
            {result?.pose_confidence?.ligand_iptm != null ? `  ·  pose ligand-ipTM ${result.pose_confidence.ligand_iptm}` : ""}
          </div>
          <p className="roboto-slab-regular text-[10px] text-gray-400 mt-2">
            Raw Boltz-2 ensemble output — <strong>not yet calibrated</strong> against a reference set. Read it as a relative/qualitative signal, not an absolute binding probability.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---- grounded prior: anchors sharing the selected target + their phenotype signatures ---- */
export function AnchorPrior({ target, drugByName }:
  { target: SelectableTarget; drugByName: Map<string, any> }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="roboto-slab-medium text-sm text-gray-700 mb-1">Grounded prior — anchors engaging {target.human_gene}</div>
      <p className="roboto-slab-regular text-[11px] text-gray-400 mb-3">
        Characterized MegaFin anchors that hit this target. Their phenotype signatures are the empirical prior for what engaging {target.zfin_ortholog} looks like in the fish.
      </p>
      <table className="w-full text-sm">
        <thead><tr className="roboto-slab-medium text-gray-500 text-left text-xs">
          <th className="py-1">Anchor</th><th>Class</th><th>Top phenotype program (signed)</th>
        </tr></thead>
        <tbody>
          {target.anchors.map((name) => {
            const d = drugByName.get(name);
            const progs = d?.step2_fingerprint?.programs?.programs || [];
            const top = progs[0];
            return (
              <tr key={name} className="roboto-slab-regular text-gray-700 border-t border-gray-100">
                <td className="py-1.5">{d?.display_name || name}</td>
                <td className="text-gray-500">{d?.drug_class || "—"}</td>
                <td className="text-gray-500">
                  {top ? <>{top.score < 0 ? "▼ " : "▲ "}{top.name}</> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="roboto-slab-regular text-[10px] text-gray-400 mt-2">
        Phenotype signatures shown are the illustrative per-class placeholder pending the released MegaFin single-cell dataset — not yet measured per compound.
      </p>
    </div>
  );
}
