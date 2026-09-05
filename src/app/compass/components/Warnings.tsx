"use client";
import { useState } from "react";
import type { Warning } from "../types";

export default function Warnings({ warnings, selectedProgram }: { warnings: Warning[]; selectedProgram: string }) {
  const [open, setOpen] = useState(false);
  const pinned = warnings.filter((w) =>
    (selectedProgram === "neural" && w.id === "neural_notch") || (selectedProgram === "module3" && w.id === "module3"));
  const rest = warnings.filter((w) => !pinned.includes(w));
  return (
    <div className="mb-4 text-[11px]">
      {pinned.map((w) => <div key={w.id} className="mb-1 rounded border-l-4 border-amber-500 bg-amber-50 px-2 py-1 dark:bg-amber-950">⚠ {w.text}</div>)}
      <button onClick={() => setOpen(!open)} className="text-sky-700 underline dark:text-sky-300">{open ? "hide" : "show"} all scientific-safety notes ({warnings.length})</button>
      {open && <ul className="mt-1 list-disc space-y-0.5 pl-5">{rest.map((w) => <li key={w.id} className={w.level === "warn" ? "text-amber-800 dark:text-amber-300" : "text-gray-600 dark:text-gray-400"}>{w.text}</li>)}</ul>}
    </div>
  );
}
