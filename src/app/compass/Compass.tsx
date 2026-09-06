"use client";
import { useState } from "react";
import Tree from "./Tree";
import delta from "./data/delta.json";

const DL = delta as unknown as { conds: string[]; n_embryos: Record<string, Record<string, number>> };
const PATHWAY: Record<string, string> = { LY411575: "Notch", SB505124: "TGFb", A8301: "TGFb", DMH1: "BMP", SU5402: "FGF", WntC59: "Wnt", Cyclopamine: "Shh", DEAB: "RA" };
const DRUGS = DL.conds.filter((c) => c !== "wildtype");

// The same branching delta twice: wild type on the left, the selected drug on the right.
// The network never changes; only which streams the ten boats take.
export default function Compass({ fontClass }: { fontClass: string }) {
  const [drug, setDrug] = useState("LY411575");
  return (
    <div className={fontClass} style={{ position: "fixed", inset: 0, background: "#0e1116", color: "#c7d0da", display: "grid", gridTemplateColumns: "1fr 1px 1fr", overflow: "hidden" }}>
      <style>{`text{font-family:inherit} .ui select{background:#141a22;color:#c7d0da;border:1px solid #273140;border-radius:4px;padding:4px 8px;font:inherit;font-size:12px}`}</style>
      <Tree cond="wildtype" title="Wild-type development" subtitle={`ChemFish vehicle embryos, n = ${DL.n_embryos.wildtype["48"]} per landmark · a flotilla of ten`} />
      <div style={{ background: "#232b36" }} />
      <Tree cond={drug} title="Drug-treated development" subtitle={`${drug} · ${PATHWAY[drug]} · same delta, n = ${DL.n_embryos[drug]?.["48"]} per landmark`}>
        <div className="ui" style={{ position: "absolute", right: 18, top: 16, zIndex: 2 }}>
          <select aria-label="drug" value={drug} onChange={(e) => setDrug(e.target.value)}>{DRUGS.map((d) => <option key={d} value={d}>{d} · {PATHWAY[d]}</option>)}</select>
        </div>
      </Tree>
    </div>
  );
}
