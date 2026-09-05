"use client";
import { useState } from "react";
import type { ProgramsFile, DrugLoadingsFile } from "../types";
import { PATHWAY_COLOR, TIER_SHORT, TIER_CLASS, SHORT_LABEL, fmt } from "../types";

type Props = {
  programs: ProgramsFile; loadings: DrugLoadingsFile; drug: string; program: string;
  onDrug: (d: string) => void; onProgram: (p: string) => void;
};

// diverging fill: blue positive, red negative, scaled to the largest |loading| in the matrix
function cellStyle(v: number, vmax: number) {
  const a = Math.min(1, Math.abs(v) / vmax);
  const rgb = v >= 0 ? "37,89,124" : "157,56,60";
  return { background: `rgba(${rgb},${(0.06 + 0.9 * a).toFixed(3)})`, color: a > 0.55 ? "#fff" : undefined };
}

export default function Heatmap({ programs, loadings, drug, program, onDrug, onProgram }: Props) {
  const [hover, setHover] = useState<{ d: string; p: string } | null>(null);
  const vmax = Math.max(...loadings.drugs.flatMap((d) => programs.order.map((p) => Math.abs(d.loadings[p]?.beta ?? 0))));
  const cross = programs.programs.filter((p) => p.cross_tissue).length;
  const hov = hover && loadings.drugs.find((d) => d.id === hover.d)?.loadings[hover.p];
  const hovP = hover && programs.programs.find((p) => p.id === hover.p);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate text-[12px]" style={{ borderSpacing: "3px 2px" }}>
          <thead>
            <tr>
              <th />
              <th colSpan={cross} className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">cross-tissue axes</th>
              <th colSpan={programs.order.length - cross} className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">single-tissue coordinates</th>
            </tr>
            <tr>
              <th className="text-left text-[10px] font-normal text-gray-500">drug · pathway</th>
              {programs.programs.map((p, i) => (
                <th key={p.id}
                  onClick={() => onProgram(p.id)}
                  className={`cursor-pointer px-1 pb-1 text-center align-bottom text-[11px] font-medium leading-tight ${i === cross ? "border-l-2 border-gray-300 dark:border-gray-600" : ""} ${program === p.id ? "text-sky-700 underline dark:text-sky-300" : ""}`}
                  title={`${p.label} — ${p.tier} (${p.score}/16) — click to select`}>
                  {SHORT_LABEL[p.id] ?? p.label}<br />
                  <span className={`rounded px-1 font-mono text-[9px] ${TIER_CLASS(p.tier)}`}>{TIER_SHORT(p.tier)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadings.drugs.map((d) => (
              <tr key={d.id} className={drug === d.id ? "outline outline-2 outline-sky-500" : ""}>
                <td onClick={() => onDrug(d.id)}
                  className={`cursor-pointer whitespace-nowrap pr-2 font-medium ${drug === d.id ? "text-sky-700 dark:text-sky-300" : ""}`}>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: PATHWAY_COLOR[d.pathway] }} />
                  {d.id} <span className="text-[10px] text-gray-500">{d.pathway}</span>
                </td>
                {programs.order.map((p, i) => {
                  const L = d.loadings[p];
                  return (
                    <td key={p}
                      onClick={() => { onDrug(d.id); onProgram(p); }}
                      onMouseEnter={() => setHover({ d: d.id, p })} onMouseLeave={() => setHover(null)}
                      className={`h-8 w-[76px] cursor-pointer rounded text-center font-mono ${i === cross ? "border-l-2 border-gray-300 dark:border-gray-600" : ""} ${program === p ? "ring-1 ring-sky-400" : ""}`}
                      style={cellStyle(L?.beta ?? 0, vmax)}>
                      {L ? L.beta.toFixed(2) : "—"}{L && !L.sign_consistent ? <span title="sign not consistent across the 3 strata">°</span> : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 min-h-[60px] rounded bg-gray-100 p-2 text-[11px] leading-snug dark:bg-gray-700">
        {hover && hov && hovP ? (
          <div>
            <b>{hover.d}</b> on <b>{hovP.label}</b>: loading <b>{fmt(hov.beta)}</b>
            {" · "}per stratum {hov.strata.map((s) => `${s.exposure_h}h ${s.beta.toFixed(2)} [${s.ci_lo.toFixed(2)}, ${s.ci_hi.toFixed(2)}]`).join(" · ")}
            {" · "}fraction of module-tissue response captured {fmt(hov.frac_captured, 3)}
            {" · "}supporting tissues {hov.n_tissues} ({hovP.tissues.join(", ")}) · embryos ≈{hov.n_embryos}
            {" · "}CHEM10 loading {fmt(hov.chem10_beta)}
            <br />program: {hovP.tier} ({hovP.score}/16) · CHEM11 loading conservation r={fmt(hovP.loading_conservation_chem11, 3)} · CHEM10 loading transfer r={fmt(hovP.loading_transfer_chem10, 3)} · direction repro {fmt(hovP.evidence.dense_reproducibility)} dense / {fmt(hovP.evidence.sparse_reproducibility)} sparse · LODO {fmt(hovP.evidence.lodo_worst)} ({hovP.evidence.lodo_culprit})
          </div>
        ) : (
          <span className="text-gray-500">hover a cell for uncertainty, supporting tissues, tier and conservation · ° = sign not consistent across strata · rows fixed in Phase-2 reproducibility order, columns fixed cross-tissue first</span>
        )}
      </div>
    </div>
  );
}
