"use client";
import { useState } from "react";
import River from "./River";
import river from "./data/river.json";
import flot from "./data/flotilla.json";

const R = river as unknown as { drugs: string[]; n_control_embryos: number };
const FL = flot as unknown as { program_order: string[]; programs: Record<string, { label: string }>; drugs: { id: string; pathway: string }[] };
const PATHWAY: Record<string, string> = Object.fromEntries(FL.drugs.map((d) => [d.id, d.pathway]));

// Two copies of the same developmental river: wild type on the left, the selected drug's flotilla
// on the right. Same channels, same decision points; only the boats and the current colours differ.
export default function Compass({ fontClass }: { fontClass: string }) {
  const [drug, setDrug] = useState("LY411575");
  const [program, setProgram] = useState("neural");
  return (
    <div className={fontClass} style={{ position: "fixed", inset: 0, background: "#0e1116", color: "#c7d0da", display: "grid", gridTemplateColumns: "1fr 1px 1fr", overflow: "hidden" }}>
      <style>{`text{font-family:inherit} .ui select{background:#141a22;color:#c7d0da;border:1px solid #273140;border-radius:4px;padding:4px 8px;font:inherit;font-size:12px}`}</style>
      <River mode="wt" title="Wild-type development" subtitle={`the normal flotilla, 0 → 96 hpf · ZSCAPE control embryos, n = ${R.n_control_embryos}`} />
      <div style={{ background: "#232b36" }} />
      <River mode="drug" drug={drug} program={program} title="Drug-treated development" subtitle={`${drug} · ${PATHWAY[drug] ?? "TGFb"} · same river, this drug's flotilla · shared current: ${FL.programs[program]?.label.toLowerCase()}`}>
        <div className="ui" style={{ position: "absolute", right: 18, top: 16, display: "flex", gap: 10, zIndex: 2 }}>
          <select aria-label="drug" value={drug} onChange={(e) => setDrug(e.target.value)}>{R.drugs.map((d) => <option key={d} value={d}>{d} · {PATHWAY[d] ?? "TGFb"}</option>)}</select>
          <select aria-label="program" value={program} onChange={(e) => setProgram(e.target.value)}>{FL.program_order.map((p) => <option key={p} value={p}>{FL.programs[p].label}</option>)}</select>
        </div>
      </River>
    </div>
  );
}
