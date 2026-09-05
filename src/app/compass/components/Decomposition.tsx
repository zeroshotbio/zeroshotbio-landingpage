"use client";
import type { ProgramsFile, DrugResidual } from "../types";
import { fmt } from "../types";

type Props = {
  programs: ProgramsFile; residual: DrugResidual; enabled: boolean[]; setEnabled: (e: boolean[]) => void;
  program: string; onProgram: (p: string) => void;
};

export default function Decomposition({ programs, residual, enabled, setEnabled, program, onProgram }: Props) {
  const key = enabled.map((e) => (e ? "1" : "0")).join("");
  const sub = residual.subsets[key];
  const full = residual.subsets["11111"];
  const mag = residual.response_magnitude;
  const captured = sub.fraction_captured;
  const coefs = Object.entries(sub.coefficients).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return (
    <div className="text-[12px]">
      <div className="mb-2 flex flex-wrap gap-1">
        {programs.programs.map((p, i) => (
          <label key={p.id} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] ${enabled[i] ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "border-gray-300 dark:border-gray-600"} ${program === p.id ? "ring-1 ring-sky-400" : ""}`}>
            <input type="checkbox" checked={enabled[i]} onChange={() => { const n = [...enabled]; n[i] = !n[i]; setEnabled(n); }} />
            <span onClick={() => onProgram(p.id)}>{p.label.split(" ")[0]}</span>
            <span className="font-mono text-[10px] text-gray-500">c={fmt(residual.raw_coefficients[p.id])}</span>
          </label>
        ))}
        <button className="rounded border border-gray-300 px-2 text-[11px] dark:border-gray-600" onClick={() => setEnabled(programs.order.map(() => true))}>all</button>
        <button className="rounded border border-gray-300 px-2 text-[11px] dark:border-gray-600" onClick={() => setEnabled(programs.order.map(() => false))}>none</button>
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono">
        <Stat label="observed ‖response‖" value={mag.toFixed(2)} sub={`mean over ${residual.n_tissues} powered tissues`} />
        <Stat label="captured by enabled coordinates" value={`${(captured * 100).toFixed(1)}%`} sub={`all 5: ${(full.fraction_captured * 100).toFixed(1)}%`} hi />
        <Stat label="‖residual‖" value={sub.residual_magnitude.toFixed(2)} sub={`${((1 - captured) * 100).toFixed(1)}% of energy`} />
      </div>
      <div className="my-2 h-3 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700" title="share of response energy captured (least-squares projection onto the enabled axes)">
        <div className="h-full bg-sky-600" style={{ width: `${Math.max(0, Math.min(100, captured * 100))}%` }} />
      </div>
      {coefs.length > 0 && (
        <div className="mb-2 text-[11px]">
          <span className="text-gray-500">contributing coordinates (least-squares coefficients, enabled set): </span>
          {coefs.map(([p, c]) => <span key={p} className="mr-2 font-mono">{p} <b className={c >= 0 ? "text-sky-700 dark:text-sky-300" : "text-rose-700 dark:text-rose-300"}>{c.toFixed(2)}</b></span>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <GeneList title={`residual UP (${enabled.every((e) => !e) ? "= raw response" : "after enabled coordinates"})`} genes={sub.top_positive} pos />
        <GeneList title="residual DOWN" genes={sub.top_negative} />
      </div>
      <div className="mt-1 text-[10px] text-gray-500">Frozen depth-corrected axes; toggling recomputes nothing in-browser — all 32 subsets were precomputed by the export (DATA_MAP §Panel 3). The organism-level Phase-3/4 residual, where canonical targets were recovered, is in the Inspector below.</div>
    </div>
  );
}

function Stat({ label, value, sub, hi }: { label: string; value: string; sub: string; hi?: boolean }) {
  return (
    <div className={`rounded border p-2 ${hi ? "border-sky-400" : "border-gray-200 dark:border-gray-700"}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
}
export function GeneList({ title, genes, pos, n = 18 }: { title: string; genes: { symbol: string; loading: number }[]; pos?: boolean; n?: number }) {
  return (
    <div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${pos ? "text-sky-700 dark:text-sky-300" : "text-rose-700 dark:text-rose-300"}`}>{title}</div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px]">
        {genes.slice(0, n).map((g) => <span key={g.symbol} title={`loading ${g.loading}`}>{g.symbol}</span>)}
      </div>
    </div>
  );
}
