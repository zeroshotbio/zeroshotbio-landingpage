"use client";
import { useState } from "react";
import Delta from "./Delta";
import delta from "./data/delta.json";
import flot from "./data/flotilla.json";

const DL = delta as unknown as { conds: string[]; n_embryos: Record<string, Record<string, number>> };
const FL = flot as unknown as { program_order: string[]; programs: Record<string, { label: string }>; drugs: { id: string; pathway: string }[] };
const PATHWAY: Record<string, string> = { ...Object.fromEntries(FL.drugs.map((d) => [d.id, d.pathway])), A8301: "TGFb" };
const DRUGS = DL.conds.filter((c) => c !== "wildtype");

// The same delta twice: wild type (vehicle embryos) on the left, the selected drug's flotilla on the
// right. The map never changes; only which currents carry boats.
export default function Compass({ fontClass }: { fontClass: string }) {
  const [drug, setDrug] = useState("LY411575");
  const [program, setProgram] = useState("neural");
  const nwt = DL.n_embryos.wildtype["48"], nd = DL.n_embryos[drug]?.["48"];
  return (
    <div className={fontClass} style={{ position: "fixed", inset: 0, background: "#0e1116", color: "#c7d0da", display: "grid", gridTemplateColumns: "1fr 1px 1fr", overflow: "hidden" }}>
      <style>{`text{font-family:inherit} .ui select{background:#141a22;color:#c7d0da;border:1px solid #273140;border-radius:4px;padding:4px 8px;font:inherit;font-size:12px}`}</style>
      <Delta cond="wildtype" title="Wild-type development" subtitle={`the normal flotilla · ChemFish vehicle embryos, n = ${nwt} per landmark · 36 → 48 → 72 hpf`} />
      <div style={{ background: "#232b36" }} />
      <Delta cond={drug} program={program} title="Drug-treated development" subtitle={`${drug} · ${PATHWAY[drug]} · same delta, this drug's flotilla, n = ${nd} per landmark · shared current: ${FL.programs[program]?.label.toLowerCase()}`}>
        <div className="ui" style={{ position: "absolute", right: 18, top: 16, display: "flex", gap: 10, zIndex: 2 }}>
          <select aria-label="drug" value={drug} onChange={(e) => setDrug(e.target.value)}>{DRUGS.map((d) => <option key={d} value={d}>{d} · {PATHWAY[d]}</option>)}</select>
          <select aria-label="program" value={program} onChange={(e) => setProgram(e.target.value)}>{FL.program_order.map((p) => <option key={p} value={p}>{FL.programs[p].label}</option>)}</select>
        </div>
      </Delta>
    </div>
  );
}
