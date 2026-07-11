"use client";

import React, { useMemo, useState } from "react";
import type { Menu } from "./types";

// The CARO structural ladder IS the primary axis of this view. Coarse -> fine; a term's
// rung is its nearest is_a ancestor among these CARO roots. "Cell" is the deepest;
// "Other" = reaches no CARO root. A cluster is named at the deepest rung its markers reach.
const LADDER = [
  { rung: "Anatomical system", caro: "CARO:0000011", zfa: "ZFA:0001439", dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200", ring: "ring-rose-400" },
  { rung: "Compound organ", caro: "CARO:0000024", zfa: "ZFA:0000496", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200", ring: "ring-amber-400" },
  { rung: "Multi-tissue structure", caro: "CARO:0000055", zfa: "ZFA:0001488", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200", ring: "ring-violet-400" },
  { rung: "Portion of tissue", caro: "CARO:0000043", zfa: "ZFA:0001477", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200", ring: "ring-sky-400" },
  { rung: "Cell", caro: "CARO:0000013", zfa: "ZFA:0009000", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200", ring: "ring-emerald-400" },
  { rung: "Other", caro: "— (no CARO root)", zfa: "—", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", ring: "ring-slate-400" },
] as const;

type Term = { zfa: string; name: string; lineages: string[]; tissues: string[]; germs: string[] };

export default function SchemaMenuBrowser({ menu }: { menu: Menu }) {
  const [query, setQuery] = useState("");
  const [openRung, setOpenRung] = useState<string | null>("Cell");
  const q = query.trim().toLowerCase();

  // Aggregate every grounded ZFA term across all lineages, keyed by rung then ZFA id
  // (a term reachable from several panels is deduped; its lineage/tissue context is unioned).
  const byRung = useMemo(() => {
    const m: Record<string, Map<string, Term>> = {};
    for (const l of LADDER) m[l.rung] = new Map();
    for (const [pname, p] of Object.entries(menu.panels)) {
      for (const l of LADDER) {
        for (const t of p.sub_by_tier[l.rung] ?? []) {
          const e = m[l.rung].get(t.zfa) ?? { zfa: t.zfa, name: t.name, lineages: [], tissues: [], germs: [] };
          if (!e.lineages.includes(pname)) e.lineages.push(pname);
          if (!e.tissues.includes(p.tissue)) e.tissues.push(p.tissue);
          if (!e.germs.includes(p.germ_layer)) e.germs.push(p.germ_layer);
          m[l.rung].set(t.zfa, e);
        }
      }
    }
    return m;
  }, [menu]);

  const termMatch = (t: Term) =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    t.zfa.toLowerCase().includes(q) ||
    t.lineages.some((x) => x.toLowerCase().includes(q)) ||
    t.tissues.some((x) => x.toLowerCase().includes(q));

  const rows = LADDER.map((l) => {
    const all = Array.from(byRung[l.rung].values()).sort((a, b) => a.name.localeCompare(b.name));
    const shown = q ? all.filter(termMatch) : all;
    return { ...l, all, shown };
  });
  const totalUnique = rows.reduce((a, r) => a + r.all.length, 0);
  // when searching, auto-reveal any rung that has hits
  const isOpen = (rung: string, hasHits: boolean) => (q ? hasHits : openRung === rung);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">MiniFin · CARO label menu</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          The MiniFin cell-type vocabulary, organized by the <b>CARO structural ladder</b>. Each grounded term is a ZFA
          anatomy class (grounded to ZFIN wildtype expression) placed at its CARO rung — its nearest{" "}
          <code className="font-mono text-[13px]">is_a</code> ancestor. A cluster is named at the <i>deepest</i> rung its
          markers support. Click a rung to see its accepted terms; each term is tagged with the zlabel lineage(s) it belongs to.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{menu.stage}</span>
          <span>menu <span className="font-mono">{menu.menu_sha}</span></span>
          <span>{totalUnique} unique grounded terms across {menu.tiers.cell_type_broad.length} lineages</span>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">coarse → fine (deepest = Cell)</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search ZFA term, ZFA id, lineage, tissue…"
          className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      {/* the ladder — primary clickable structure */}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const open = isOpen(r.rung, r.shown.length > 0);
          const dim = q && r.shown.length === 0;
          return (
            <div key={r.rung} className={`rounded-lg border border-slate-200 dark:border-slate-700 ${dim ? "opacity-40" : ""}`}>
              <button
                onClick={() => setOpenRung(openRung === r.rung ? null : r.rung)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="w-4 text-center text-slate-400">{i < LADDER.length - 1 ? "" : ""}</span>
                <span className={`h-3 w-3 shrink-0 rounded-full ${r.dot}`} />
                <span className="font-semibold text-slate-800 dark:text-slate-100">{r.rung}</span>
                <span className="font-mono text-[10px] text-slate-400">{r.caro}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-400">
                    {q ? `${r.shown.length} / ${r.all.length}` : r.all.length}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">{open ? "▾" : "▸"}</span>
                </span>
              </button>

              {open && r.shown.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
                  {r.shown.map((t) => (
                    <span
                      key={t.zfa}
                      title={`${t.zfa} · lineage: ${t.lineages.join(", ")} · tissue: ${t.tissues.join(", ")}`}
                      className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 text-[12px] ${r.chip}`}
                    >
                      {t.name}
                      <span className="font-mono text-[9px] opacity-60">
                        {t.lineages[0]}
                        {t.lineages.length > 1 ? ` +${t.lineages.length - 1}` : ""}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {open && r.all.length === 0 && (
                <div className="border-t border-slate-100 px-3 py-3 text-xs text-slate-400 dark:border-slate-800">
                  no grounded terms at this rung.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* orthogonal context */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
          <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Coarser tiers (from zlabel panels.yaml)</div>
          <p className="text-slate-500 dark:text-slate-400">
            Above cell_type_sub sit <b>germ layer → tissue → lineage</b> ({menu.tiers.germ_layer.length} /{" "}
            {menu.tiers.tissue.length} / {menu.tiers.cell_type_broad.length}). Those are panels.yaml&apos;s hand-authored
            fields, not ZFA — each grounded term above is tagged with its lineage.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
          <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">State panels (orthogonal to identity)</div>
          <div className="flex flex-wrap gap-2">
            {menu.state_panels.map((s) => (
              <span key={s.panel} className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-700">
                <b className="font-mono">{s.panel}</b>{" "}
                <span className="font-mono text-slate-500 dark:text-slate-400">{s.markers.slice(0, 4).join(", ")}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
        ZFA (zfin-grounded) on the CARO ladder · lineages from zlabel panels.yaml · menu {menu.menu_sha} · static, no model.
      </footer>
    </main>
  );
}
