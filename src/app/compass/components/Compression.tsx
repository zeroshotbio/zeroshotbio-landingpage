"use client";
import { useState } from "react";
import type { CompressionFile } from "../types";

const COLOR: Record<string, string> = { sparse: "#25597c", pca: "#96690f", biological: "#1f6b4d", hybrid: "#7a4fb6", full: "#4b4b4b" };

export default function Compression({ data, drug }: { data: CompressionFile; drug: string }) {
  const [sel, setSel] = useState<string>("all program axes (5)");
  const rows = data.results;
  const W = 620, H = 230, L = 46, R = 14, T = 14, B = 34;
  const x = (dim: number) => L + ((Math.log10(dim) - 0) / (Math.log10(24000) - 0)) * (W - L - R);
  const y = (a: number) => T + (1 - a) * (H - T - B);
  const cur = rows.find((r) => r.representation === sel);
  return (
    <div className="text-[12px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="retrieval accuracy versus representation dimension">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#d1d1d1" strokeWidth={0.5} />
            <text x={L - 4} y={y(v) + 3} fontSize={9} textAnchor="end" fill="#6e6e6e">{v.toFixed(2)}</text></g>
        ))}
        <line x1={L} x2={W - R} y1={y(data.chance)} y2={y(data.chance)} stroke="#9d383c" strokeDasharray="3 3" />
        <text x={W - R} y={y(data.chance) - 3} fontSize={9} textAnchor="end" fill="#9d383c">chance {data.chance.toFixed(3)}</text>
        {[1, 3, 10, 30, 100, 300, 1000, 3000, 24000].map((d) => (
          <text key={d} x={x(d)} y={H - B + 12} fontSize={9} textAnchor="middle" fill="#6e6e6e">{d >= 1000 ? `${d / 1000}k` : d}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} fontSize={9} textAnchor="middle" fill="#6e6e6e">representation dimension (log)</text>
        {(["sparse", "pca"] as const).map((fam) => {
          const pts = rows.filter((r) => r.family === fam).sort((a, b) => a.dim - b.dim);
          return <polyline key={fam} fill="none" stroke={COLOR[fam]} strokeWidth={1.5} points={pts.map((p) => `${x(p.dim)},${y(p.retrieval)}`).join(" ")} />;
        })}
        {rows.map((r) => {
          const isSel = r.representation === sel;
          const pd = r.per_drug[drug];
          return (
            <g key={r.representation} onClick={() => setSel(r.representation)} className="cursor-pointer">
              <circle cx={x(r.dim)} cy={y(r.retrieval)} r={isSel ? 7 : 4.5} fill={COLOR[r.family]} stroke={isSel ? "#000" : "none"} strokeWidth={1.5} opacity={0.9}>
                <title>{r.representation} · dim {r.dim} · retrieval {r.retrieval.toFixed(3)} · {drug}: {pd?.toFixed(2)}</title>
              </circle>
              {pd !== undefined && <circle cx={x(r.dim)} cy={y(r.retrieval)} r={1.6} fill={pd >= 0.75 ? "#fff" : pd <= 0.25 ? "#000" : "#bbb"} />}
            </g>
          );
        })}
      </svg>
      <div className="mb-1 flex flex-wrap gap-3 text-[10px] text-gray-600 dark:text-gray-400">
        {Object.entries(COLOR).map(([f, c]) => <span key={f}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: c }} />{f}</span>)}
        <span>· inner dot = {drug}&apos;s own retrieval (white ≥0.75, black ≤0.25)</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {rows.map((r) => (
          <button key={r.representation} onClick={() => setSel(r.representation)}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${sel === r.representation ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "border-gray-300 dark:border-gray-600"}`}>
            {r.representation} <span className="font-mono">{r.retrieval.toFixed(2)}</span>
          </button>
        ))}
      </div>
      {cur && (
        <div className="mt-2 rounded bg-gray-100 p-2 text-[11px] dark:bg-gray-700">
          <div className="mb-1"><b>{cur.representation}</b> — {cur.dim} dims — retrieval <b>{cur.retrieval.toFixed(3)}</b> · per drug: {Object.entries(cur.per_drug).map(([d, v]) => `${d} ${v.toFixed(2)}`).join(" · ")}</div>
          {cur.annotation ? (
            <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-gray-500">retained</dt><dd>{cur.annotation.retained}</dd>
              <dt className="text-gray-500">discarded</dt><dd>{cur.annotation.discarded}</dd>
              <dt className="text-gray-500">interpretable</dt><dd>{cur.annotation.interpretable}</dd>
              <dt className="text-gray-500">transfers</dt><dd>{cur.annotation.transfers}</dd>
              <dt className="text-gray-500">drug identity</dt><dd>{cur.annotation.identity}</dd>
            </dl>
          ) : <div className="text-gray-500">supporting point on the curve (no annotation)</div>}
        </div>
      )}
      <div className="mt-2 border-l-2 border-emerald-600 pl-2 text-[11px]"><b>Coarse-graining buys interpretability and transferability, not maximal information retention.</b> 100 sparse genes (0.881) beat the full transcriptome (0.738); 5 biological axes (0.500) trail PCA-5 (0.571) but are the only representation with a gene program, a tier, and a cross-batch transfer figure per coordinate.</div>
    </div>
  );
}
