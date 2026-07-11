"use client";

import React, { useMemo, useState } from "react";
import type { Menu } from "./types";

// A scrollable tidy-tree of the whole schema: MiniFin → germ layer → tissue → lineage
// → (optionally) grounded ZFA term. Dot nodes + smooth cubic-bezier branches, fine text,
// warm muted palette — matching the dataset-screen provenance visuals.

const GERM_ORDER = ["ectoderm", "neural crest", "mesoderm", "endoderm", "germline"];
const GERM_HUE: Record<string, number> = { ectoderm: 245, "neural crest": 300, mesoderm: 5, endoderm: 45, germline: 175 };
const BUCKET_HUE: Record<string, number> = {
  anatomical_system: 350, anatomical_system_subtype: 25, organ: 45, multi_tissue_structure: 270,
  tissue: 205, cell: 150,
};
const bucketHue = (b: string) => BUCKET_HUE[b] ?? 220;

type N = {
  id: string; label: string; kind: "root" | "germ" | "tissue" | "lineage" | "term";
  hue?: number; sub?: string; children: N[]; x: number; y: number;
};

export default function SchemaTree({ menu }: { menu: Menu }) {
  const [deep, setDeep] = useState(false); // false = to lineage; true = to ZFA term

  const { root, width, height, leafGap } = useMemo(() => {
    // term lookup per lineage (bucket-ordered), for the deep mode
    const termsOf = (pname: string): N[] => {
      const p = menu.panels[pname];
      const out: N[] = [];
      for (const b of menu.bucket_order) {
        for (const t of p.sub_by_bucket[b] ?? [])
          out.push({ id: `${pname}:${t.zfa}`, label: t.name, kind: "term", hue: bucketHue(b), children: [], x: 0, y: 0 });
      }
      return out;
    };

    const germs: N[] = GERM_ORDER.filter((g) => menu.tiers.germ_layer.includes(g)).map((g) => {
      const tissues = Object.entries(menu.tissue_germ).filter(([, gg]) => gg === g).map(([t]) => t).sort();
      const tNodes: N[] = tissues.map((tissue) => {
        const lins = menu.tiers.cell_type_broad.filter((n) => menu.panels[n].tissue === tissue).sort();
        const lNodes: N[] = lins.map((name) => ({
          id: name, label: name, kind: "lineage", sub: `${menu.panels[name].n_sub}`,
          children: deep ? termsOf(name) : [], x: 0, y: 0,
        }));
        return { id: `t:${tissue}`, label: tissue, kind: "tissue", children: lNodes, x: 0, y: 0 };
      });
      return { id: `g:${g}`, label: g, kind: "germ", hue: GERM_HUE[g], children: tNodes, x: 0, y: 0 };
    });
    const root: N = { id: "root", label: "MiniFin", kind: "root", children: germs, x: 0, y: 0 };

    // layout: x by depth, y tidy (leaves sequential, parents = mean of children)
    const X = [10, 120, 250, 470, deep ? 700 : 700];
    const gap = deep ? 11 : 20;
    let leaf = 0;
    const place = (n: N, depth: number): number => {
      n.x = X[Math.min(depth, X.length - 1)];
      if (!n.children.length) { n.y = leaf * gap + 24; leaf++; return n.y; }
      const ys = n.children.map((c) => place(c, depth + 1));
      n.y = (ys[0] + ys[ys.length - 1]) / 2;
      return n.y;
    };
    place(root, 0);
    const leafCount = leaf;
    const width = (deep ? 700 : 470) + 320;
    const height = leafCount * gap + 48;
    return { root, width, height, leafGap: gap };
  }, [menu, deep]);

  // flatten for rendering
  const nodes: N[] = [];
  const links: { a: N; b: N }[] = [];
  const walk = (n: N) => { nodes.push(n); for (const c of n.children) { links.push({ a: n, b: c }); walk(c); } };
  walk(root);

  const link = (a: N, b: N) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };
  const fill = (n: N) =>
    n.kind === "root" ? "#8a847b"
      : n.hue != null ? `hsl(${n.hue} 55% 50%)`
      : n.kind === "tissue" ? "#b0a89e" : "#6b6b6b";
  const fs = (n: N) => (n.kind === "root" ? 11 : n.kind === "germ" ? 10 : n.kind === "tissue" ? 8.5 : n.kind === "lineage" ? 8 : leafGap < 14 ? 6 : 7.5);

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          schema tree <span className="normal-case text-slate-400">— germ layer → tissue → lineage{deep ? " → ZFA term" : ""} (scroll to explore)</span>
        </h2>
        <button
          onClick={() => setDeep((d) => !d)}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {deep ? "collapse to lineages" : "expand to ZFA terms"}
        </button>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-200 bg-[hsl(40,30%,99%)] dark:border-slate-700 dark:bg-slate-950">
        <svg width={width} height={height} className="block" style={{ minWidth: width }}>
          {links.map((l, i) => (
            <path key={i} d={link(l.a, l.b)} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth={0.8} opacity={0.9} />
          ))}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={n.kind === "root" ? 4 : n.kind === "germ" ? 3.4 : n.kind === "term" ? 1.6 : 2.4} fill={fill(n)} />
              <text
                x={n.x + (n.kind === "root" ? 7 : 5)}
                y={n.y + fs(n) * 0.34}
                fontSize={fs(n)}
                className="fill-slate-700 dark:fill-slate-200"
                style={{ fontWeight: n.kind === "root" || n.kind === "germ" ? 700 : n.kind === "tissue" ? 600 : 400 }}
              >
                {n.label}
                {n.kind === "lineage" && n.sub ? <tspan className="fill-slate-400" style={{ fontWeight: 400 }}> · {n.sub}</tspan> : null}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {deep ? "leaves are grounded ZFA terms (colored by structural bucket)" : "lineage nodes show grounded-term counts"} · pan by scrolling the panel.
      </p>
    </section>
  );
}
