"use client";
import type { TissuesFile, Program } from "../types";
import { TIER_SHORT, TIER_CLASS, fmt } from "../types";

export default function ProgramTissues({ tissues, program, drug }: { tissues: TissuesFile; program: Program; drug: string }) {
  const member = new Set(program.tissues);
  return (
    <div>
      <div className="mb-2 text-[11px] text-gray-600 dark:text-gray-400">
        <b>{program.label}</b> spans <b>{program.tissues.length}</b> tissue{program.tissues.length > 1 ? "s" : ""}: {program.tissues.join(", ")}.
        {" "}cross-stratum {fmt(program.evidence.dense_reproducibility)} dense / {fmt(program.evidence.sparse_reproducibility)} sparse
        {" · "}LODO {fmt(program.evidence.lodo_worst)} (drops most without <b>{program.evidence.lodo_culprit}</b>)
        {program.evidence.leave_one_tissue_out != null && <> · leave-one-tissue-out {fmt(program.evidence.leave_one_tissue_out)}</>}
        {program.evidence.heldout_stratum_recurrence != null && <> · held-out-stratum recurrence {fmt(program.evidence.heldout_stratum_recurrence)}</>}
        {" · "}CHEM10: direction {fmt(program.evidence.direction_transfer_chem10)}, loading r={fmt(program.loading_transfer_chem10)}
        {program.caveat && <div className="mt-1 text-amber-700 dark:text-amber-300">⚠ {program.caveat}</div>}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {tissues.groups.map((g) => {
          const ts = tissues.tissues.filter((t) => t.group === g);
          if (!ts.length) return null;
          return (
            <div key={g} className="rounded border border-gray-200 p-2 dark:border-gray-700">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{g}</div>
              <div className="flex flex-wrap gap-1">
                {ts.map((t) => {
                  const inMod = member.has(t.name);
                  const cos = t.cos_to_axis?.[program.id];
                  const dl = t.drug_loading_on_axis?.[drug]?.[program.id];
                  if (!t.powered) return (
                    <div key={t.name} className="rounded border border-dashed border-gray-300 px-1.5 py-1 text-[10px] text-gray-400 dark:border-gray-600" title="not powered for cross-drug work (<5 of 7 drugs in every CHEM11 stratum)">{t.name}</div>
                  );
                  return (
                    <div key={t.name}
                      className={`w-full rounded border px-2 py-1 text-[11px] ${inMod ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "border-gray-300 dark:border-gray-600"}`}
                      title={`${t.name}: module ${t.module} (${t.module_program}); ${t.tier}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{inMod ? "● " : "○ "}{t.name}</span>
                        <span className={`rounded px-1 font-mono text-[9px] ${TIER_CLASS(t.tier ?? "")}`}>{TIER_SHORT(t.tier ?? "")}</span>
                      </div>
                      <div className="mt-0.5 grid grid-cols-2 gap-x-2 font-mono text-[10px] text-gray-600 dark:text-gray-300">
                        <span>cos→axis <b className={Math.abs(cos ?? 0) >= 0.3 ? "text-sky-700 dark:text-sky-300" : ""}>{fmt(cos)}</b></span>
                        <span>{drug} here <b>{fmt(dl)}</b></span>
                        <span>repro {fmt(t.dense_reproducibility)}/{fmt(t.sparse_reproducibility)}</span>
                        <span>LODO {fmt(t.lodo_worst)} <span className="text-gray-400">{t.lodo_culprit}</span></span>
                      </div>
                      {t.parent && !inMod && <div className="text-[9px] text-gray-400">child of {t.parent}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">● member of the selected program · ○ powered tissue outside it · dashed = not powered · anatomical grouping is presentational only (never used in analysis) · repro = dense/sparse cross-stratum cosine of the tissue&apos;s own direction</div>
    </div>
  );
}
