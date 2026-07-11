"use client";

import React, { useMemo, useState } from "react";
import type { Menu, Panel } from "./types";

// CARO structural ladder, coarse -> fine (+ "Other" residual). This is the depth axis
// for cell_type_sub: a cluster is named at the deepest rung its markers support.
const RUNGS = [
  "Anatomical system",
  "Compound organ",
  "Multi-tissue structure",
  "Portion of tissue",
  "Cell",
  "Other",
] as const;

// One color per rung, legible in light + dark. `dot` = solid swatch (bars/legend),
// `chip` = soft background for term chips.
const RUNG: Record<string, { dot: string; chip: string; root: string }> = {
  "Anatomical system": { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200", root: "ZFA:0001439" },
  "Compound organ": { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200", root: "ZFA:0000496" },
  "Multi-tissue structure": { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200", root: "ZFA:0001512" },
  "Portion of tissue": { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200", root: "ZFA:0001477" },
  Cell: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200", root: "ZFA:0009000" },
  Other: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", root: "—" },
};

// Germ layers as colored bands; order follows a rough developmental grouping.
const GERM_ORDER = ["ectoderm", "neural crest", "mesoderm", "endoderm", "germline"];
const GERM: Record<string, string> = {
  ectoderm: "bg-indigo-500",
  "neural crest": "bg-fuchsia-500",
  mesoderm: "bg-red-500",
  endoderm: "bg-yellow-500",
  germline: "bg-teal-500",
};

function rungCounts(p: Panel): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of RUNGS) c[r] = p.sub_by_tier[r]?.length ?? 0;
  return c;
}

// A slim horizontal bar showing where a panel's grounded sub-terms sit on the ladder.
function RungBar({ p }: { p: Panel }) {
  const counts = rungCounts(p);
  const total = p.n_sub || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {RUNGS.map((r) =>
        counts[r] ? (
          <div
            key={r}
            className={RUNG[r].dot}
            style={{ width: `${(counts[r] / total) * 100}%` }}
            title={`${r}: ${counts[r]}`}
          />
        ) : null
      )}
    </div>
  );
}

function PanelRow({ name, panel, query }: { name: string; panel: Panel; query: string }) {
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const counts = rungCounts(panel);
  const rungs = RUNGS.filter((r) => counts[r] > 0);

  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[1.1fr_1fr_1.4fr_auto] items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="text-slate-300 dark:text-slate-600">{open ? "▾" : "▸"}</span>
          {name}
        </span>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{panel.tissue}</span>
        <RungBar p={panel} />
        <span className="w-10 text-right text-xs tabular-nums text-slate-400">{panel.n_sub}</span>
      </button>

      {open && (
        <div className="bg-slate-50/60 px-3 pb-3 pt-1 dark:bg-slate-900/40">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              <b className="text-slate-600 dark:text-slate-300">lineage:</b> {panel.lineage}
            </span>
            <span>
              <b className="text-slate-600 dark:text-slate-300">anchor:</b>{" "}
              {panel.anchors.map((a) => `${a.name} (${a.zfa}·${a.tier})`).join(", ")}
            </span>
            <span className="font-mono">
              <b className="font-sans text-slate-600 dark:text-slate-300">markers:</b> {panel.markers.slice(0, 12).join(", ")}
            </span>
          </div>
          <div className="space-y-1.5">
            {rungs.map((r) => {
              let terms = panel.sub_by_tier[r] ?? [];
              if (q) terms = terms.filter((t) => t.name.toLowerCase().includes(q));
              if (q && terms.length === 0) return null;
              return (
                <div key={r} className="flex items-start gap-2">
                  <span className="flex w-36 shrink-0 items-center gap-1.5 pt-0.5">
                    <span className={`h-2 w-2 rounded-full ${RUNG[r].dot}`} />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{r}</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {terms.map((t) => (
                      <span key={t.zfa} title={t.zfa} className={`rounded px-1.5 py-0.5 text-[11px] ${RUNG[r].chip}`}>
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
  const [germ, setGerm] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const matches = (name: string): boolean => {
    const p = menu.panels[name];
    if (!p) return false;
    if (germ && p.germ_layer !== germ) return false;
    if (!q) return true;
    if (name.toLowerCase().includes(q)) return true;
    if (p.tissue.toLowerCase().includes(q) || p.lineage.toLowerCase().includes(q)) return true;
    if (p.markers.some((m) => m.toLowerCase().includes(q))) return true;
    return RUNGS.some((r) => (p.sub_by_tier[r] ?? []).some((t) => t.name.toLowerCase().includes(q)));
  };

  // Panels grouped by germ layer (band order), each group sorted by tissue then name.
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const name of menu.tiers.cell_type_broad) {
      if (!matches(name)) continue;
      const layer = menu.panels[name].germ_layer;
      (g[layer] ||= []).push(name);
    }
    for (const layer of Object.keys(g)) {
      g[layer].sort((a, b) => {
        const pa = menu.panels[a], pb = menu.panels[b];
        return pa.tissue.localeCompare(pb.tissue) || a.localeCompare(b);
      });
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, germ, q]);

  const nShown = Object.values(grouped).reduce((a, v) => a + v.length, 0);
  const totalSub = Object.values(menu.panels).reduce((a, p) => a + p.n_sub, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-slate-100">
      {/* header */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold">MiniFin · label schema &amp; menu</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          The native menu for MiniFin cell labelling. <b>Germ layer</b> and <b>tissue</b> come from zlabel&apos;s{" "}
          <code className="font-mono text-[13px]">panels.yaml</code>; the fine <b>cell-type</b> vocabulary is the ZFA
          ontology grounded to ZFIN expression, placed on the CARO ladder — a cluster is named at the deepest rung its
          markers support.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{menu.stage}</span>
          <span>menu <span className="font-mono">{menu.menu_sha}</span></span>
          <span>{menu.tiers.cell_type_broad.length} lineages · {menu.tiers.tissue.length} tissues · {totalSub} grounded terms</span>
        </div>
      </header>

      {/* CARO ladder legend — the fine-tier depth key */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">CARO ladder (fine → coarse):</span>
        {[...RUNGS].map((r) => (
          <span key={r} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${RUNG[r].dot}`} />
            <span className="text-[11px] text-slate-600 dark:text-slate-300">{r}</span>
          </span>
        ))}
      </div>

      {/* controls: germ-layer tabs + search */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setGerm(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${germ === null ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            all
          </button>
          {GERM_ORDER.filter((g) => menu.tiers.germ_layer.includes(g)).map((g) => (
            <button
              key={g}
              onClick={() => setGerm(germ === g ? null : g)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${germ === g ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
            >
              <span className={`h-2 w-2 rounded-full ${GERM[g]}`} />
              {g}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search lineage, tissue, marker, ZFA term…"
          className="w-60 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      {/* grouped panel table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {GERM_ORDER.filter((g) => grouped[g]?.length).map((g) => (
          <div key={g}>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className={`h-2.5 w-2.5 rounded-full ${GERM[g]}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{g}</span>
              <span className="text-[11px] text-slate-400">{grouped[g].length}</span>
            </div>
            {grouped[g].map((name) => (
              <PanelRow key={name} name={name} panel={menu.panels[name]} query={query} />
            ))}
          </div>
        ))}
        {nShown === 0 && <p className="py-10 text-center text-sm text-slate-400">no lineages match “{query}”.</p>}
      </div>

      {/* state panels */}
      <div className="mt-5">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          state panels <span className="normal-case text-slate-400">— orthogonal to identity</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {menu.state_panels.map((s) => (
            <span key={s.panel} className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <b className="font-mono">{s.panel}</b>{" "}
              <span className="font-mono text-slate-500 dark:text-slate-400">{s.markers.join(", ")}</span>
            </span>
          ))}
        </div>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
        zlabel panels.yaml + ZFA (zfin-grounded) · menu {menu.menu_sha} · static, no model.
      </footer>
    </main>
  );
}
