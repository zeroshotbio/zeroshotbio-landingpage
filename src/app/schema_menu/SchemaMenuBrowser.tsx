"use client";

import React, { useMemo, useState } from "react";
import type { Menu } from "./types";

// Bucket colors (Darien's structural scheme). Principal buckets get the ladder palette;
// secondary buckets are muted. Unknown buckets fall back to slate.
const COLOR: Record<string, { dot: string; chip: string }> = {
  anatomical_system: { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200" },
  anatomical_system_subtype: { dot: "bg-orange-500", chip: "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-200" },
  organ: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200" },
  multi_tissue_structure: { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200" },
  tissue: { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200" },
  cell: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200" },
};
const FALLBACK = { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
const col = (b: string) => COLOR[b] ?? FALLBACK;

type Term = { zfa: string; name: string; lineages: string[]; tissues: string[] };

export default function SchemaMenuBrowser({ menu }: { menu: Menu }) {
  const [query, setQuery] = useState("");
  const [openB, setOpenB] = useState<string | null>("cell");
  const q = query.trim().toLowerCase();

  // Aggregate grounded ZFA terms across all lineages, keyed by bucket then ZFA id.
  const byBucket = useMemo(() => {
    const m: Record<string, Map<string, Term>> = {};
    for (const b of menu.bucket_order) m[b] = new Map();
    for (const [pname, p] of Object.entries(menu.panels)) {
      for (const b of menu.bucket_order) {
        for (const t of p.sub_by_bucket[b] ?? []) {
          const e = m[b].get(t.zfa) ?? { zfa: t.zfa, name: t.name, lineages: [], tissues: [] };
          if (!e.lineages.includes(pname)) e.lineages.push(pname);
          if (!e.tissues.includes(p.tissue)) e.tissues.push(p.tissue);
          m[b].set(t.zfa, e);
        }
      }
    }
    return m;
  }, [menu]);

  const match = (t: Term) =>
    !q || t.name.toLowerCase().includes(q) || t.zfa.toLowerCase().includes(q) ||
    t.lineages.some((x) => x.toLowerCase().includes(q)) || t.tissues.some((x) => x.toLowerCase().includes(q));

  const rows = menu.bucket_order
    .map((b) => {
      const meta = menu.bucket_meta[b];
      const all = Array.from(byBucket[b].values()).sort((a, c) => a.name.localeCompare(c.name));
      return { b, meta, all, shown: q ? all.filter(match) : all };
    })
    .filter((r) => r.all.length > 0);

  const principal = rows.filter((r) => r.meta.principal);
  const secondary = rows.filter((r) => !r.meta.principal);
  const totalUnique = rows.reduce((a, r) => a + r.all.length, 0);
  const isOpen = (b: string, hits: number) => (q ? hits > 0 : openB === b);

  const Bucket = ({ r }: { r: (typeof rows)[number] }) => {
    const open = isOpen(r.b, r.shown.length);
    const dim = q && r.shown.length === 0;
    const c = col(r.b);
    return (
      <div className={`rounded-lg border border-slate-200 dark:border-slate-700 ${dim ? "opacity-40" : ""}`}>
        <button onClick={() => setOpenB(openB === r.b ? null : r.b)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
          <span className={`h-3 w-3 shrink-0 rounded-full ${c.dot}`} />
          <span className="font-semibold text-slate-800 dark:text-slate-100">{r.meta.display}</span>
          <span className="font-mono text-[10px] text-slate-400">{r.meta.zfa_root}{r.meta.caro !== "—" ? ` · ${r.meta.caro}` : ""}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs tabular-nums text-slate-400">{q ? `${r.shown.length} / ${r.all.length}` : r.all.length}</span>
            <span className="text-slate-300 dark:text-slate-600">{open ? "▾" : "▸"}</span>
          </span>
        </button>
        {open && r.shown.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
            {r.shown.map((t) => (
              <span key={t.zfa} title={`${t.zfa} · lineage: ${t.lineages.join(", ")} · tissue: ${t.tissues.join(", ")}`}
                className={`inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 text-[12px] ${c.chip}`}>
                {t.name}
                <span className="font-mono text-[9px] opacity-60">{t.lineages[0]}{t.lineages.length > 1 ? ` +${t.lineages.length - 1}` : ""}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">MiniFin · ZFA structural label menu</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          The MiniFin cell-type vocabulary, organized by <b>ZFA structural bucket</b> (Darien&apos;s scheme). Each grounded
          term is a ZFA anatomy class — grounded to ZFIN wildtype expression — assigned one exclusive structural bucket by
          its <code className="font-mono text-[13px]">is_a</code> ancestry. Six <b>principal</b> buckets form the depth ladder
          (system → subtype → organ → multi-tissue → tissue → cell); the rest are named <b>secondary</b> buckets. A cluster
          is named at the deepest bucket its markers support. Click a bucket to see its terms; each is tagged with its zlabel lineage(s).
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{menu.stage}</span>
          <span>menu <span className="font-mono">{menu.menu_sha}</span></span>
          <span>{totalUnique} unique grounded terms · {menu.tiers.cell_type_broad.length} lineages</span>
          <span className="italic">CARO xrefs historical only (deprecated → Uberon)</span>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">principal buckets: coarse → fine (deepest = Cell)</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search ZFA term, ZFA id, lineage, tissue…"
          className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900" />
      </div>

      <div className="space-y-2">
        {principal.map((r) => <Bucket key={r.b} r={r} />)}
      </div>

      {secondary.length > 0 && (
        <>
          <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            secondary buckets <span className="normal-case text-slate-400">— structural residue, previously lumped as “Other”</span>
          </div>
          <div className="space-y-2">
            {secondary.map((r) => <Bucket key={r.b} r={r} />)}
          </div>
        </>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
          <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Coarser tiers (zlabel panels.yaml)</div>
          <p className="text-slate-500 dark:text-slate-400">
            Above the structural bucket sit <b>germ layer → tissue → lineage</b> ({menu.tiers.germ_layer.length} /{" "}
            {menu.tiers.tissue.length} / {menu.tiers.cell_type_broad.length}) — panels.yaml&apos;s hand-authored fields, not ZFA.
            Each term above is tagged with its lineage.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
          <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">State panels (orthogonal to identity)</div>
          <div className="flex flex-wrap gap-2">
            {menu.state_panels.map((s) => (
              <span key={s.panel} className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-700">
                <b className="font-mono">{s.panel}</b> <span className="font-mono text-slate-500 dark:text-slate-400">{s.markers.slice(0, 4).join(", ")}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
        ZFA structural buckets (darien_ZFA.md) · zfin-grounded · lineages from zlabel panels.yaml · menu {menu.menu_sha} · static, no model.
      </footer>
    </main>
  );
}
