"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Menu } from "./types";

// A horizontal (left→right) tidy-tree of the schema: MiniFin → germ layer → tissue →
// lineage → (optionally) grounded ZFA term. Dot nodes + smooth cubic-bezier branches,
// fine horizontal text labels. Pan freely (scroll both axes); pinch-to-zoom on the
// trackpad (ctrl+wheel, cursor-anchored). No snapping.

const GERM_ORDER = ["ectoderm", "neural crest", "mesoderm", "endoderm", "germline"];
const GERM_HUE: Record<string, number> = { ectoderm: 245, "neural crest": 300, mesoderm: 5, endoderm: 45, germline: 175 };
const BUCKET_HUE: Record<string, number> = {
  anatomical_system: 350, anatomical_system_subtype: 25, organ: 45, multi_tissue_structure: 270, tissue: 205, cell: 150,
};
const bucketHue = (b: string) => BUCKET_HUE[b] ?? 220;

type N = {
  id: string; label: string; kind: "root" | "germ" | "tissue" | "lineage" | "term";
  hue?: number; sub?: string; children: N[]; x: number; y: number; leaf: boolean;
};

export default function SchemaTree({ menu }: { menu: Menu }) {
  const [deep, setDeep] = useState(false);
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ left: number; top: number } | null>(null);

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

    const X = [10, 120, 250, 470, 700]; // depth → x
    const gap = deep ? 12 : 20;         // vertical spacing between leaves
    let leaf = 0;
    const place = (n: N, depth: number): number => {
      n.x = X[Math.min(depth, X.length - 1)];
      if (!n.children.length) { n.y = leaf * gap + 24; leaf++; return n.y; }
      const ys = n.children.map((c) => place(c, depth + 1));
      n.y = (ys[0] + ys[ys.length - 1]) / 2;
      return n.y;
    };
    place(root, 0);

    const nodes: N[] = []; const links: { a: N; b: N }[] = [];
    const walk = (n: N) => { nodes.push(n); for (const c of n.children) { links.push({ a: n, b: c }); walk(c); } };
    walk(root);
    const W = (deep ? 700 : 470) + 340;   // node span + room for the right-hand labels
    const H = leaf * gap + 48;
    return { nodes, links, W, H };
  }, [menu, deep]);

  // apply the cursor-anchored scroll after a pinch-zoom re-render
  useLayoutEffect(() => {
    if (pending.current && wrapRef.current) {
      wrapRef.current.scrollLeft = pending.current.left;
      wrapRef.current.scrollTop = pending.current.top;
      pending.current = null;
    }
  }, [zoom]);

  // trackpad pinch = ctrl+wheel; keep the point under the cursor fixed. Plain wheel pans natively.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
      setZoom((old) => {
        const nz = Math.min(4, Math.max(0.3, old * Math.exp(-e.deltaY * 0.01)));
        const baseX = (el.scrollLeft + vx) / old, baseY = (el.scrollTop + vy) / old;
        pending.current = { left: baseX * nz - vx, top: baseY * nz - vy };
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const link = (a: N, b: N) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };
  const fill = (n: N) =>
    n.kind === "root" ? "#8a847b" : n.hue != null ? `hsl(${n.hue} 55% 50%)` : n.kind === "tissue" ? "#b0a89e" : "#6b6b6b";
  const rad = (n: N) => (n.kind === "root" ? 4 : n.kind === "germ" ? 3.4 : n.kind === "term" ? 1.6 : 2.4);
  const fs = (n: N) => (n.kind === "root" ? 11 : n.kind === "germ" ? 10 : n.kind === "tissue" ? 8.5 : n.kind === "lineage" ? 8 : 6.5);

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          schema tree <span className="normal-case text-slate-400">— germ layer → tissue → lineage{deep ? " → ZFA term" : ""}</span>
        </h2>
        <button onClick={() => setDeep((d) => !d)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
          {deep ? "collapse to lineages" : "expand to ZFA terms"}
        </button>
      </div>
      <div ref={wrapRef} className="h-[80vh] overflow-auto overscroll-contain rounded-lg border border-slate-200 bg-[hsl(40,30%,99%)] dark:border-slate-700 dark:bg-slate-950">
        <svg viewBox={`0 0 ${W} ${H}`} width={W * zoom} height={H * zoom} className="block" style={{ minWidth: W * zoom }}>
          {links.map((l, i) => (
            <path key={i} d={link(l.a, l.b)} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth={0.8} opacity={0.9} />
          ))}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={rad(n)} fill={fill(n)} />
              <text x={n.x + rad(n) + 4} y={n.y + fs(n) * 0.34} fontSize={fs(n)} className="fill-slate-700 dark:fill-slate-200" style={{ fontWeight: n.kind === "root" || n.kind === "germ" ? 700 : n.kind === "tissue" ? 600 : 400 }}>
                {n.label}
                {n.kind === "lineage" && n.sub ? <tspan className="fill-slate-400"> · {n.sub}</tspan> : null}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {deep ? "leaves are grounded ZFA terms (colored by structural bucket)" : "lineage leaves show grounded-term counts"} · scroll to pan both axes · pinch (trackpad) to zoom.
      </p>
    </section>
  );
}
