"use client";
import { useMemo, useState } from "react";
import programsRaw from "./data/programs.json";
import loadingsRaw from "./data/drug_loadings.json";
import tissuesRaw from "./data/tissues.json";
import residualsRaw from "./data/drug_residuals.json";
import compressionRaw from "./data/compression_results.json";
import metadataRaw from "./data/metadata.json";
import type { ProgramsFile, DrugLoadingsFile, TissuesFile, ResidualsFile, CompressionFile, MetadataFile } from "./types";
import Heatmap from "./components/Heatmap";
import ProgramTissues from "./components/ProgramTissues";
import DrugInspector from "./components/DrugInspector";
import Decomposition from "./components/Decomposition";
import Compression from "./components/Compression";
import Warnings from "./components/Warnings";

const programs = programsRaw as unknown as ProgramsFile;
const loadings = loadingsRaw as unknown as DrugLoadingsFile;
const tissues = tissuesRaw as unknown as TissuesFile;
const residuals = residualsRaw as unknown as ResidualsFile;
const compression = compressionRaw as unknown as CompressionFile;
const metadata = metadataRaw as unknown as MetadataFile;

export default function CompassClient() {
  const [drug, setDrug] = useState<string>("LY411575");
  const [program, setProgram] = useState<string>("neural");
  // bitmask over programs.order — which biological coordinates are included in the decomposition
  const [enabled, setEnabled] = useState<boolean[]>(programs.order.map(() => true));

  const selectedProgram = useMemo(() => programs.programs.find((p) => p.id === program)!, [program]);
  const selectedDrug = useMemo(() => loadings.drugs.find((d) => d.id === drug)!, [drug]);
  const selectedResidual = useMemo(() => residuals.drugs.find((d) => d.id === drug)!, [drug]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[1400px] px-4 py-6 font-sans">
        <header className="mb-4 border-b border-gray-300 pb-3 dark:border-gray-700">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">ChemFish · response atlas · V0</div>
          <h1 className="mt-1 text-2xl font-semibold">Compass — biological coordinates of whole-organism drug response</h1>
          <p className="mt-1 max-w-4xl text-sm text-gray-600 dark:text-gray-400">
            Click a <b>drug</b> or a <b>program</b>. Every value is read from frozen Phase 3–5 results
            (CHEM11 discovery regime, placebo-corrected); nothing is recomputed in the browser. Not a demo — an
            intuition tool. Selected: <b>{drug}</b> × <b>{selectedProgram.label}</b>.
          </p>
        </header>

        <Warnings warnings={metadata.warnings} selectedProgram={program} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section className="rounded border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <PanelTitle n={1} title="Drug × biological program" sub={`signed loading, mean of 3 CHEM11 strata · global loading conservation r = ${programs.global_loading_conservation_chem11.toFixed(3)}`} />
            <Heatmap programs={programs} loadings={loadings} drug={drug} program={program} onDrug={setDrug} onProgram={setProgram} />
          </section>

          <section className="rounded border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <PanelTitle n={2} title={`Cross-tissue view — ${selectedProgram.label}`} sub="membership, direction cosine, reproducibility, LODO; loading of the selected drug in each tissue" />
            <ProgramTissues tissues={tissues} program={selectedProgram} drug={drug} />
          </section>

          <section className="rounded border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <PanelTitle n={3} title={`Response decomposition — ${drug}`} sub="observed response = biological-coordinate component + drug-specific residual (frozen depth-corrected axes; toggle coordinates)" />
            <Decomposition programs={programs} residual={selectedResidual} enabled={enabled} setEnabled={setEnabled} program={program} onProgram={setProgram} />
          </section>

          <section className="rounded border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <PanelTitle n={4} title="Compression — what survives" sub="leak-free same-drug retrieval across CHEM11 strata vs representation dimension (chance 0.143)" />
            <Compression data={compression} drug={drug} />
          </section>
        </div>

        <section className="mt-4 rounded border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <PanelTitle n={0} title={`Inspector — ${drug} and ${selectedProgram.label}`} sub="selected drug's program profile + Phase-3/4 organism-level residual; selected program's defining genes, evidence and rubric" />
          <DrugInspector drug={selectedDrug} residual={selectedResidual} program={selectedProgram} programs={programs} />
        </section>

        <footer className="mt-6 text-[11px] text-gray-500">
          Data: {programs.source} · {loadings.source} · {tissues.source} · generated {metadata.generated}. Traceability: /data/experiments/chemfish_response_atlas/DATA_MAP.md
        </footer>
      </div>
    </main>
  );
}

function PanelTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 border-b border-gray-200 pb-1 dark:border-gray-700">
      {n > 0 && <span className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">PANEL {n}</span>}
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-[11px] text-gray-500">{sub}</span>
    </div>
  );
}
