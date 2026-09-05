"use client";
import type { Drug, DrugResidual, Program, ProgramsFile } from "../types";
import { PATHWAY_COLOR, TIER_CLASS, fmt, fmtP } from "../types";
import { GeneList } from "./Decomposition";

export default function DrugInspector({ drug, residual, program, programs }: { drug: Drug; residual: DrugResidual; program: Program; programs: ProgramsFile }) {
  const orr = residual.organism_residual;
  const prof = programs.order.map((p) => ({ p, ...drug.loadings[p] })).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
  return (
    <div className="grid grid-cols-1 gap-4 text-[12px] lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: PATHWAY_COLOR[drug.pathway] }} />{drug.id} · {drug.pathway} · vehicle {drug.vehicle}</h3>
        <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">Phase-2 organism cross-stratum reproducibility {fmt(drug.phase2_cross_stratum_reproducibility, 3)} · drug-specific residual program: <span className={`rounded px-1 font-mono text-[10px] ${TIER_CLASS(drug.residual_catalog.tier)}`}>{drug.residual_catalog.tier}</span> ({drug.residual_catalog.score}/16)</div>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">program-loading profile (|β| order)</div>
        <table className="mt-1 w-full font-mono text-[11px]">
          <tbody>{prof.map((r) => (
            <tr key={r.p} className={r.p === program.id ? "bg-sky-50 dark:bg-sky-950" : ""}>
              <td className="pr-2 font-sans">{r.p}</td>
              <td className={`pr-2 text-right ${r.beta >= 0 ? "text-sky-700 dark:text-sky-300" : "text-rose-700 dark:text-rose-300"}`}>{r.beta.toFixed(2)}</td>
              <td className="pr-2 text-gray-500">{r.strata.map((s) => s.beta.toFixed(1)).join(" / ")}</td>
              <td className="text-gray-500">{r.sign_consistent ? "sign ✓" : "sign ✗"} · captures {(r.frac_captured * 100).toFixed(0)}% · CHEM10 {fmt(r.chem10_beta, 1)}</td>
            </tr>))}</tbody>
        </table>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Phase-3/4 organism-level drug-specific residual (response − LODO shared component, consensus of {orr.n_strata} strata)</div>
        <div className="mt-1 text-[11px]">
          canonical {orr.canonical_pathway} targets down in <b>{orr.n_strata_coherent}/{orr.n_strata}</b> strata · MWU p={fmtP(orr.coherence_p)} · mean percentile {fmt(orr.coherence_percentile, 3)} · direction repro {fmt(orr.dense_reproducibility)} dense / {fmt(orr.sparse_reproducibility)} sparse · CHEM10 {fmt(orr.transfer_chem10)} · <span className={`rounded px-1 font-mono text-[10px] ${TIER_CLASS(orr.tier)}`}>{orr.tier}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px]">
          {orr.canonical_targets.map((t) => <span key={t.symbol} className={t.loading != null && t.loading < 0 ? "text-rose-700 dark:text-rose-300" : "text-gray-500"}>{t.symbol} {t.loading == null ? "—" : t.loading.toFixed(2)}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GeneList title="residual UP" genes={orr.top_positive} pos n={20} />
          <GeneList title="residual DOWN" genes={orr.top_negative} n={20} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">{program.label} <span className={`ml-1 rounded px-1 font-mono text-[10px] ${TIER_CLASS(program.tier)}`}>{program.tier} · {program.score}/16</span></h3>
        <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">{program.cross_tissue ? "cross-tissue axis" : "single-tissue coordinate"} · {program.tissues.join(", ")} · catalog {program.catalog_id}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(program.rubric).map(([k, v]) => <span key={k} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${v === 2 ? "bg-sky-600 text-white" : v === 1 ? "bg-sky-200 dark:bg-sky-800" : "bg-gray-200 text-gray-500 dark:bg-gray-700"}`}>{k} {v}</span>)}
        </div>
        <p className="mt-2 text-[11px]">{program.interpretation}</p>
        {program.caveat && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">⚠ {program.caveat}</p>}
        <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">confounders: cos(placebo) {fmt(program.cos_placebo)} · cos(depth) {fmt(program.cos_depth)} (axis defined after depth removal)</div>
        {program.enrichment.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">process enrichment (pre-specified sets, MWU)</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {program.enrichment.sort((a, b) => a.p - b.p).map((e) => <span key={e.process} className={`rounded border px-1.5 py-0.5 text-[10px] ${e.p < 1e-3 ? "border-sky-500" : e.p < 0.05 ? "border-gray-400" : "border-gray-200 text-gray-400 dark:border-gray-700"}`}>{e.process} {e.direction} p={fmtP(e.p)}</span>)}
            </div>
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GeneList title="axis UP (defining genes)" genes={program.top_positive} pos n={30} />
          <GeneList title="axis DOWN" genes={program.top_negative} n={30} />
        </div>
      </div>
    </div>
  );
}
