"use client";

import React, { useMemo, useState } from "react";
import type { Menu, Panel } from "./types";

// CARO structural ladder, coarse -> fine, plus the "Other" residual. Each rung gets a
// color that reads in both light and dark. This is the depth axis for cell_type_sub.
const RUNGS = [
  "Anatomical system",
  "Compound organ",
  "Multi-tissue structure",
  "Portion of tissue",
  "Cell",
  "Other",
] as const;

const RUNG_STYLE: Record<string, string> = {
  "Anatomical system": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800",
  "Compound organ": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  "Multi-tissue structure": "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 border-violet-300 dark:border-violet-800",
  "Portion of tissue": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 border-sky-300 dark:border-sky-800",
  Cell: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  Other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
};

const CARO_ROOT: Record<string, string> = {
  "Anatomical system": "ZFA:0001439 · CARO:0000011",
  "Compound organ": "ZFA:0000496 · CARO:0000024",
  "Multi-tissue structure": "ZFA:0001512 · CARO:0000055",
  "Portion of tissue": "ZFA:0001477 · CARO:0000043",
  Cell: "ZFA:0009000 · CARO:0000013",
  Other: "— (reaches no CARO root)",
};

const GERM_STYLE: Record<string, string> = {
  ectoderm: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  mesoderm: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  endoderm: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  "neural crest": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  germline: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
};

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function PanelCard({ panel, name, query }: { panel: Panel; name: string; query: string }) {
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const rungs = RUNGS.filter((r) => (panel.sub_by_tier[r]?.length ?? 0) > 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>
          <Pill className={`${GERM_STYLE[panel.germ_layer] ?? ""} border-transparent`}>{panel.germ_layer}</Pill>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {panel.tissue} · {panel.lineage}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-slate-400">{panel.n_sub} sub-terms</span>
          <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">anchors:</span>{" "}
              {panel.anchors.map((a) => (
                <span key={a.zfa} className="mr-2 whitespace-nowrap">
                  {a.name} <span className="font-mono text-slate-400">({a.zfa}, {a.tier})</span>
                </span>
              ))}
            </span>
          </div>
          <div className="mb-3">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">markers: </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{panel.markers.join(", ")}</span>
          </div>

          <div className="space-y-2">
            {rungs.map((r) => {
              let terms = panel.sub_by_tier[r] ?? [];
              if (q) terms = terms.filter((t) => t.name.toLowerCase().includes(q));
              if (q && terms.length === 0) return null;
              return (
                <div key={r} className="flex gap-3">
                  <div className="w-40 shrink-0">
                    <Pill className={RUNG_STYLE[r]}>{r}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {terms.map((t) => (
                      <span
                        key={t.zfa}
                        title={t.zfa}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchemaMenuBrowser({ menu }: { menu: Menu }) {
  const [query, setQuery] = useState("");
  const [germFilter, setGermFilter] = useState<string | null>(null);

  const panelNames = menu.tiers.cell_type_broad;
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return panelNames.filter((name) => {
      const p = menu.panels[name];
      if (!p) return false;
      if (germFilter && p.germ_layer !== germFilter) return false;
      if (!q) return true;
      if (name.toLowerCase().includes(q)) return true;
      if (p.tissue.toLowerCase().includes(q) || p.lineage.toLowerCase().includes(q)) return true;
      if (p.markers.some((m) => m.toLowerCase().includes(q))) return true;
      return RUNGS.some((r) => (p.sub_by_tier[r] ?? []).some((t) => t.name.toLowerCase().includes(q)));
    });
  }, [panelNames, menu.panels, germFilter, q]);

  const totalSub = Object.values(menu.panels).reduce((a, p) => a + p.n_sub, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900 dark:text-slate-100">
      {/* header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">MiniFin — label schema &amp; menu</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          The native menu used by the MiniFin cell-labelling pipeline. Tiers{" "}
          <strong>germ_layer / tissue / cell_type_broad</strong> come from zlabel&apos;s{" "}
          <code className="font-mono">panels.yaml</code>; <strong>cell_type_sub</strong> is the ZFA anatomy
          ontology grounded to ZFIN wildtype expression, placed on the CARO structural ladder. Depth is
          earned — the pipeline names a cluster at the deepest CARO rung its markers support, abstaining
          deeper otherwise.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>stage: {menu.stage}</span>
          <span>menu sha: <span className="font-mono">{menu.menu_sha}</span></span>
          <span>panels: {panelNames.length} identity + {menu.state_panels.length} state</span>
          <span>grounded sub-terms: {totalSub}</span>
          <span>source: {menu.source.panels}</span>
        </div>
      </header>

      {/* CARO ladder legend */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold">CARO structural ladder (the cell_type_sub depth axis)</h2>
        <div className="flex flex-wrap gap-2">
          {RUNGS.map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <Pill className={RUNG_STYLE[r]}>{r}</Pill>
              <span className="font-mono text-[10px] text-slate-400">{CARO_ROOT[r]}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          A term&apos;s rung is its nearest <code className="font-mono">is_a</code> ancestor among the five CARO
          roots. &ldquo;Other&rdquo; = anatomy that reaches none (e.g. regions like retina/cornea) — kept, but
          flagged for curation.
        </p>
      </section>

      {/* top-tier menus */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-2 text-sm font-semibold">germ_layer <span className="text-slate-400">({menu.tiers.germ_layer.length})</span></h2>
          <div className="flex flex-wrap gap-1.5">
            {menu.tiers.germ_layer.map((g) => (
              <button key={g} onClick={() => setGermFilter(germFilter === g ? null : g)}>
                <Pill className={`${GERM_STYLE[g] ?? "bg-slate-100 dark:bg-slate-800"} border ${germFilter === g ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900" : "border-transparent"}`}>
                  {g}
                </Pill>
              </button>
            ))}
          </div>
          {germFilter && (
            <button onClick={() => setGermFilter(null)} className="mt-2 text-xs text-slate-500 underline">
              clear germ_layer filter
            </button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-2 text-sm font-semibold">tissue <span className="text-slate-400">({menu.tiers.tissue.length})</span></h2>
          <div className="flex flex-wrap gap-1.5">
            {menu.tiers.tissue.map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* search + panels (cell_type_broad + cell_type_sub) */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            cell_type_broad <span className="text-slate-400">({visible.length}/{panelNames.length} panels)</span>
          </h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search panel, tissue, marker, or ZFA term…"
            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="space-y-2">
          {visible.map((name) => (
            <PanelCard key={name} name={name} panel={menu.panels[name]} query={query} />
          ))}
          {visible.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">no panels match “{query}”.</p>
          )}
        </div>
      </section>

      {/* state panels */}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">
          state panels <span className="text-slate-400">(orthogonal to identity — no germ/tissue/anchor)</span>
        </h2>
        <div className="flex flex-wrap gap-3">
          {menu.state_panels.map((s) => (
            <div key={s.panel} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <span className="font-mono text-sm font-semibold">{s.panel}</span>
              <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400">{s.markers.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400 dark:border-slate-800">
        Derived from zlabel panels.yaml + ZFA (zfin-grounded). Menu {menu.menu_sha}. This page is static and
        calls no model.
      </footer>
    </main>
  );
}
