"use client";

import React, { useMemo, useState } from "react";
import type { Menu, Panel } from "./types";

// CARO structural ladder, COARSE -> FINE. A term's rung is its nearest is_a ancestor
// among these five CARO roots; a cluster is named at the deepest (finest) rung its
// markers reach. "Cell" is the deepest; "Other" = reaches no CARO root.
const RUNGS = [
  "Anatomical system",
  "Compound organ",
  "Multi-tissue structure",
  "Portion of tissue",
  "Cell",
  "Other",
] as const;

const RUNG: Record<string, { dot: string; chip: string; caro: string; zfa: string }> = {
  "Anatomical system": { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200", caro: "CARO:0000011", zfa: "ZFA:0001439" },
  "Compound organ": { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200", caro: "CARO:0000024", zfa: "ZFA:0000496" },
  "Multi-tissue structure": { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200", caro: "CARO:0000055", zfa: "ZFA:0001488" },
  "Portion of tissue": { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200", caro: "CARO:0000043", zfa: "ZFA:0001477" },
  Cell: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200", caro: "CARO:0000013", zfa: "ZFA:0009000" },
  Other: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", caro: "—", zfa: "—" },
};

// germ_layer is panels.yaml's top tier: the 3 canonical germ layers + neural crest
// (zlabel files pigment + cartilage under it) + germline. Order = developmental-ish.
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

function RungBar({ p }: { p: Panel }) {
  const counts = rungCounts(p);
  const total = p.n_sub || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {RUNGS.map((r) =>
        counts[r] ? <div key={r} className={RUNG[r].dot} style={{ width: `${(counts[r] / total) * 100}%` }} title={`${r}: ${counts[r]}`} /> : null
      )}
    </div>
  );
}

// One lineage (= cell_type_broad panel). Click expands to its grounded ZFA sub-terms,
// grouped + colored by CARO rung — the single drill-in layer.
function LineageRow({ name, panel, query }: { name: string; panel: Panel; query: string }) {
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const rungs = RUNGS.filter((r) => (panel.sub_by_tier[r]?.length ?? 0) > 0);
  return (
    <div className="border-t border-slate-100 first:border-0 dark:border-slate-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[1fr_1.4fr_auto] items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="text-slate-300 dark:text-slate-600">{open ? "▾" : "▸"}</span>
          {name}
        </span>
        <RungBar p={panel} />
        <span className="w-10 text-right text-xs tabular-nums text-slate-400">{panel.n_sub}</span>
      </button>
      {open && (
        <div className="bg-slate-50/60 px-3 pb-3 pt-1 dark:bg-slate-900/40">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span><b className="text-slate-600 dark:text-slate-300">lineage:</b> {panel.lineage}</span>
            <span><b className="text-slate-600 dark:text-slate-300">anchor:</b> {panel.anchors.map((a) => `${a.name} (${a.zfa}·${a.tier})`).join(", ")}</span>
            <span className="font-mono"><b className="font-sans text-slate-600 dark:text-slate-300">markers:</b> {panel.markers.slice(0, 12).join(", ")}</span>
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
                      <span key={t.zfa} title={t.zfa} className={`rounded px-1.5 py-0.5 text-[11px] ${RUNG[r].chip}`}>{t.name}</span>
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

  // Real nesting: germ_layer -> tissue -> lineage(panel). tissue->germ is a clean 1:1
  // rollup in panels.yaml, so this tree is faithful, not an imposed grouping.
  const tree = useMemo(() => {
    const t: Record<string, Record<string, string[]>> = {};
    for (const name of menu.tiers.cell_type_broad) {
      if (!matches(name)) continue;
      const p = menu.panels[name];
      ((t[p.germ_layer] ||= {})[p.tissue] ||= []).push(name);
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, germ, q]);

  const nShown = Object.values(tree).reduce((a, ts) => a + Object.values(ts).reduce((b, ps) => b + ps.length, 0), 0);
  const totalSub = Object.values(menu.panels).reduce((a, p) => a + p.n_sub, 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">MiniFin · label schema &amp; menu</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Four nested tiers: <b>germ layer → tissue → lineage → cell type</b>. Germ layer, tissue and lineage come
          from zlabel&apos;s <code className="font-mono text-[13px]">panels.yaml</code>; the fine cell-type vocabulary is
          the ZFA ontology grounded to ZFIN expression, placed on the CARO ladder — a cluster is named at the deepest
          rung its markers support.
        </p>
        <p className="mt-1.5 max-w-3xl text-[11px] text-slate-400">
          Note: the top tier is panels.yaml&apos;s <code className="font-mono">germ_layer</code> field — the three
          canonical germ layers (ecto/meso/endoderm) plus <i>neural crest</i> (zlabel files pigment + cartilage under
          it) and <i>germline</i>. Each tissue rolls up into exactly one germ layer.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{menu.stage}</span>
          <span>menu <span className="font-mono">{menu.menu_sha}</span></span>
          <span>{menu.tiers.germ_layer.length} germ layers · {menu.tiers.tissue.length} tissues · {menu.tiers.cell_type_broad.length} lineages · {totalSub} grounded terms</span>
        </div>
      </header>

      {/* CARO ladder legend — canonical, coarse -> fine (deepest = Cell) */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          CARO ladder — cell_type_sub depth axis (coarse → fine; a term&apos;s rung = its nearest is_a ancestor here)
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {(["Anatomical system", "Compound organ", "Multi-tissue structure", "Portion of tissue", "Cell"] as const).map((r, i) => (
            <React.Fragment key={r}>
              {i > 0 && <span className="px-0.5 text-slate-300 dark:text-slate-600">⊃</span>}
              <span className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full ${RUNG[r].dot}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{r}</span>
                <span className="font-mono text-[9px] text-slate-400">{RUNG[r].caro}</span>
              </span>
            </React.Fragment>
          ))}
          <span className="ml-2 flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${RUNG.Other.dot}`} />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Other (no CARO root)</span>
          </span>
        </div>
      </div>

      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setGerm(null)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${germ === null ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>all</button>
          {GERM_ORDER.filter((g) => menu.tiers.germ_layer.includes(g)).map((g) => (
            <button key={g} onClick={() => setGerm(germ === g ? null : g)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${germ === g ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
              <span className={`h-2 w-2 rounded-full ${GERM[g]}`} />{g}
            </button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search tissue, lineage, marker, ZFA term…" className="w-60 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900" />
      </div>

      {/* nested tree: germ band -> tissue -> lineages */}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {GERM_ORDER.filter((g) => tree[g] && Object.keys(tree[g]).length).map((g) => (
          <div key={g}>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className={`h-2.5 w-2.5 rounded-full ${GERM[g]}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{g}</span>
            </div>
            {Object.keys(tree[g]).sort().map((tissue) => (
              <div key={tissue} className="grid grid-cols-[9.5rem_1fr] border-t border-slate-100 dark:border-slate-800">
                <div className="border-r border-slate-100 bg-slate-50/50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                  {tissue}
                </div>
                <div>
                  {tree[g][tissue].sort().map((name) => (
                    <LineageRow key={name} name={name} panel={menu.panels[name]} query={query} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        {nShown === 0 && <p className="py-10 text-center text-sm text-slate-400">nothing matches “{query}”.</p>}
      </div>

      {/* state panels */}
      <div className="mt-5">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          state panels <span className="normal-case text-slate-400">— orthogonal to identity (no germ/tissue/anchor)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {menu.state_panels.map((s) => (
            <span key={s.panel} className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <b className="font-mono">{s.panel}</b> <span className="font-mono text-slate-500 dark:text-slate-400">{s.markers.join(", ")}</span>
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
