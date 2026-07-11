"use client";

import React, { useMemo, useState } from "react";
import type { Menu } from "./types";

// A vertical (top-down) tidy-tree of the schema: MiniFin → germ layer → tissue → lineage
// → (optionally) grounded ZFA term. Dot nodes + smooth cubic-bezier branches, fine text,
// warm muted palette. Leaf labels hang vertically; pan both axes; snap-zoom slider.

const GERM_ORDER = ["ectoderm", "neural crest", "mesoderm", "endoderm", "germline"];
const GERM_HUE: Record<string, number> = { ectoderm: 245, "neural crest": 300, mesoderm: 5, endoderm: 45, germline: 175 };
const BUCKET_HUE: Record<string, number> = {
  anatomical_system: 350, anatomical_system_subtype: 25, organ: 45, multi_tissue_structure: 270, tissue: 205, cell: 150,
};
const bucketHue = (b: string) => BUCKET_HUE[b] ?? 220;
const ZOOM = [0.4, 0.55, 0.7, 0.85, 1, 1.25, 1.5, 2, 3];

type N = {
  id: string; label: string; kind: "root" | "germ" | "tissue" | "lineage" | "term";
  hue?: number; sub?: string; children: N[]; x: number; y: number; leaf: boolean;
};

export default function SchemaTree({ menu }: { menu: Menu }) {
  const [deep, setDeep] = useState(false);
  const [zi, setZi] = useState(4); // index into ZOOM (1×)
  const z = ZOOM[zi];

  const { nodes, links, W, H } = useMemo(() => {
    const termsOf = (pname: string): N[] => {
      const p = menu.panels[pname];
      const out: N[] = [];
      for (const b of menu.bucket_order)
        for (const t of p.sub_by_bucket[b] ?? [])
          out.push({ id: `${pname}:${t.zfa}`, label: t.name, kind: "term", hue: bucketHue(b), children: [], x: 0, y: 0, leaf: true });
      return out;
    };
    const germs: N[] = GERM_ORDER.filter((g) => menu.tiers.germ_layer.includes(g)).map((g) => {
      const tissues = Object.entries(menu.tissue_germ).filter(([, gg]) => gg === g).map(([t]) => t).sort();
      const tNodes: N[] = tissues.map((tissue) => {
        const lins = menu.tiers.cell_type_broad.filter((n) => menu.panels[n].tissue === tissue).sort();
        const lNodes: N[] = lins.map((name) => ({
          id: name, label: name, kind: "lineage", sub: `${menu.panels[name].n_sub}`,
          children: deep ? termsOf(name) : [], x: 0, y: 0, leaf: !deep,
        }));
        return { id: `t:${tissue}`, label: tissue, kind: "tissue", children: lNodes, x: 0, y: 0, leaf: false };
      });
      return { id: `g:${g}`, label: g, kind: "germ", hue: GERM_HUE[g], children: tNodes, x: 0, y: 0, leaf: false };
    });
    const root: N = { id: "root", label: "MiniFin", kind: "root", children: germs, x: 0, y: 0, leaf: false };

    // top-down: depth -> y (rows), leaf order -> x (columns)
    const LY = deep ? { root: 22, germ: 74, tissue: 150, lineage: 250, term: 380 } : { root: 22, germ: 78, tissue: 168, lineage: 280, term: 0 };
    const gap = deep ? 12 : 46;
    const padX = 30;
    let col = 0;
    const place = (n: N, depth: number): number => {
      n.y = [LY.root, LY.germ, LY.tissue, LY.lineage, LY.term][Math.min(depth, 4)];
      if (!n.children.length) { n.x = col * gap + padX; col++; return n.x; }
      const xs = n.children.map((c) => place(c, depth + 1));
      n.x = (xs[0] + xs[xs.length - 1]) / 2;
      return n.x;
    };
    place(root, 0);

    const nodes: N[] = []; const links: { a: N; b: N }[] = [];
    const walk = (n: N) => { nodes.push(n); for (const c of n.children) { links.push({ a: n, b: c }); walk(c); } };
    walk(root);
    const leafLabelPx = deep ? 200 : 130;
    const W = col * gap + padX * 2;
    const H = (deep ? LY.term : LY.lineage) + leafLabelPx;
    return { nodes, links, W, H };
  }, [menu, deep]);

  // vertical cubic-bezier branch (top -> down)
  const link = (a: N, b: N) => {
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  };
  const fill = (n: N) =>
    n.kind === "root" ? "#8a847b" : n.hue != null ? `hsl(${n.hue} 55% 50%)` : n.kind === "tissue" ? "#b0a89e" : "#6b6b6b";
  const r = (n: N) => (n.kind === "root" ? 4 : n.kind === "germ" ? 3.4 : n.kind === "term" ? 1.6 : 2.4);
  const fs = (n: N) => (n.kind === "root" ? 11 : n.kind === "germ" ? 10 : n.kind === "tissue" ? 8.5 : n.kind === "lineage" ? 8 : 6);

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          schema tree <span className="normal-case text-slate-400">— germ layer → tissue → lineage{deep ? " → ZFA term" : ""}</span>
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            zoom
            <input type="range" min={0} max={ZOOM.length - 1} step={1} value={zi} onChange={(e) => setZi(Number(e.target.value))} className="w-28 accent-slate-500" />
            <span className="w-8 tabular-nums">{z}×</span>
          </label>
          <button onClick={() => setDeep((d) => !d)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
            {deep ? "collapse to lineages" : "expand to ZFA terms"}
          </button>
        </div>
      </div>
      <div className="max-h-[78vh] overflow-auto rounded-lg border border-slate-200 bg-[hsl(40,30%,99%)] dark:border-slate-700 dark:bg-slate-950">
        <svg viewBox={`0 0 ${W} ${H}`} width={W * z} height={H * z} className="block" style={{ minWidth: W * z }}>
          {links.map((l, i) => (
            <path key={i} d={link(l.a, l.b)} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth={0.8} opacity={0.9} />
          ))}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r(n)} fill={fill(n)} />
              {n.leaf ? (
                <text x={n.x} y={n.y + r(n) + 3} fontSize={fs(n)} transform={`rotate(90 ${n.x} ${n.y + r(n) + 3})`} className="fill-slate-600 dark:fill-slate-300" style={{ fontWeight: n.kind === "lineage" ? 500 : 400 }}>
                  {n.label}{n.kind === "lineage" && n.sub ? ` · ${n.sub}` : ""}
                </text>
              ) : (
                <text x={n.x} y={n.y - r(n) - 3} fontSize={fs(n)} textAnchor="middle" className="fill-slate-700 dark:fill-slate-200" style={{ fontWeight: n.kind === "root" || n.kind === "germ" ? 700 : 600 }}>
                  {n.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {deep ? "leaves are grounded ZFA terms (colored by structural bucket); scroll both axes to explore" : "lineage leaves show grounded-term counts"} · use the zoom slider to snap in/out.
      </p>
    </section>
  );
}
