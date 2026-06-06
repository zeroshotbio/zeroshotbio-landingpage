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

/* ---- curated dropdown + selected-target detail ---- */
export function TargetSelect({ targets, value, onChange }:
  { targets: SelectableTarget[] | null; value: string; onChange: (g: string) => void }) {
  const sel = targets?.find((t) => t.human_gene === value) || null;
  return (
    <div className="mt-3">
      <label className="roboto-slab-regular block text-xs text-gray-500 mb-1">
        Intended protein target <span className="text-gray-400">(optional — only zebrafish-expressed orthologs are listed)</span>
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="roboto-slab-regular w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm focus:border-gray-700 focus:outline-none">
        <option value="">— no target (chemistry-only triage) —</option>
        {(targets || []).map((t) => (
          <option key={t.human_gene} value={t.human_gene}>
            {t.human_gene} → {t.zfin_ortholog}  ·  {t.n_anchors} anchor{t.n_anchors === 1 ? "" : "s"}
            {t.n_anchors_primary ? ` (${t.n_anchors_primary} on-MOA)` : ""}
          </option>
        ))}
      </select>
      {sel && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 roboto-slab-regular leading-relaxed">
          <div><strong>{sel.human_gene}</strong> → zebrafish <strong>{sel.zfin_ortholog}</strong> ({sel.zfin_id})</div>
          <div>Expressed in <strong>{Math.round(sel.expression_max_frac * 100)}%</strong> of <em>{sel.expression_celltype}</em> cells at {sel.expression_timepoint}.</div>
          <div>Engaged by <strong>{sel.n_anchors}</strong> anchor drug{sel.n_anchors === 1 ? "" : "s"}{sel.n_anchors_primary ? `, ${sel.n_anchors_primary} as canonical MOA` : ""}: {sel.anchors.slice(0, 6).join(", ")}{sel.anchors.length > 6 ? "…" : ""}.</div>
          <div className="text-gray-400">Ortholog evidence: {sel.ortholog_evidence.join("/")} ({sel.ortholog_n_pubs} pub{sel.ortholog_n_pubs === 1 ? "" : "s"}). Binding-site conservation: {sel.binding_site_conservation.replace(/_/g, " ")}.</div>
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
  const conf = pb ? (pb.median >= 0.7 ? "high" : pb.median >= 0.4 ? "moderate" : "low") : null;
  const accent = conf === "high" ? "#0d9488" : conf === "moderate" ? "#d97706" : "#9ca3af";

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
          <div className="flex items-baseline gap-2">
            <span className="roboto-slab-medium text-2xl" style={{ color: accent }}>{Math.round(pb.median * 100)}%</span>
            <span className="roboto-slab-regular text-sm text-gray-500">binding probability</span>
            <span className="roboto-slab-regular text-xs px-2 py-0.5 rounded-full" style={{ background: accent + "22", color: accent }}>{conf} confidence</span>
          </div>
          {/* band bar */}
          <div className="relative h-2 mt-2 rounded-full bg-gray-100">
            <div className="absolute h-2 rounded-full" style={{ left: `${pb.lo * 100}%`, width: `${Math.max(2, (pb.hi - pb.lo) * 100)}%`, background: accent + "55" }} />
            <div className="absolute h-2 w-[2px]" style={{ left: `${pb.median * 100}%`, background: accent }} />
          </div>
          <div className="roboto-slab-regular text-[11px] text-gray-500 mt-1">
            Ensemble band {Math.round(pb.lo * 100)}–{Math.round(pb.hi * 100)}% (n={pb.n})
            {result?.pred_affinity_log_ic50_band ? `  ·  pred log-IC50 ${result.pred_affinity_log_ic50_band.median}` : ""}
            {result?.pose_confidence?.ligand_iptm != null ? `  ·  pose ligand-ipTM ${result.pose_confidence.ligand_iptm}` : ""}
          </div>
          {result?.calibration && <p className="roboto-slab-regular text-[10px] text-gray-400 mt-2">{result.calibration}</p>}
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
