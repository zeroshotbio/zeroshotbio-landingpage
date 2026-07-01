"use client";
// CompartmentMap — a hierarchy-aware alternative to the confetti UMAP. Instead of
// 813k per-cell dots, it draws each recursive-clustering COMPARTMENT as its own
// packed "island" of leaf-dots (one dot per leaf, sized by nCells, coloured by
// compartment). Deterministic phyllotaxis packing (no physics sim, no randomness).
// Drop-in-ish with UmapCanvas: same clusters/activeId/validated/onPick props.
// Requires clusters to carry compartmentIndex; callers gate on hasCompartments().
import React, { useMemo } from "react";
import type { Cluster } from "../types";

export function hasCompartments(clusters: Cluster[]): boolean {
  return clusters.some((c) => typeof c.compartmentIndex === "number");
}

export type MapView = "islands" | "umap";

// tiny segmented toggle — only worth showing when a partition actually has compartments.
export function MapViewSwitch({ view, setView, compact }: { view: MapView; setView: (v: MapView) => void; compact?: boolean }) {
  const btn = (v: MapView, label: string): React.CSSProperties => ({
    padding: compact ? "1px 7px" : "3px 10px",
    fontSize: compact ? 10 : 11.5,
    fontWeight: 800,
    border: "1px solid #e5e1dc",
    background: view === v ? "#7c3aed" : "#fff",
    color: view === v ? "#fff" : "#6b6b6b",
    cursor: "pointer",
  });
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden" }}>
      <button style={{ ...btn("islands", "Compartments"), borderRadius: "8px 0 0 8px" }} onClick={() => setView("islands")}>◉ Compartments</button>
      <button style={{ ...btn("umap", "UMAP"), borderRadius: "0 8px 8px 0", borderLeft: "none" }} onClick={() => setView("umap")}>◇ UMAP</button>
    </div>
  );
}

const GOLDEN = 2.399963229728653; // golden angle (rad) for even disc packing

export function CompartmentMap({
  clusters,
  activeId,
  validated,
  width,
  height,
  onPick,
}: {
  clusters: Cluster[];
  activeId: string | null;
  validated: Set<string>;
  width: number;
  height: number;
  onPick?: (id: string) => void;
}) {
  const layout = useMemo(() => {
    // group leaves by compartmentIndex
    const groups = new Map<number, Cluster[]>();
    for (const c of clusters) {
      if (typeof c.compartmentIndex !== "number") continue;
      if (!groups.has(c.compartmentIndex)) groups.set(c.compartmentIndex, []);
      groups.get(c.compartmentIndex)!.push(c);
    }
    const comps = Array.from(groups.keys()).sort((a, b) => a - b);
    const nComp = comps.length;
    if (!nComp) return null;

    // grid arrangement, aspect-aware
    const cols = Math.max(1, Math.round(Math.sqrt(nComp * (width / Math.max(1, height)))));
    const rows = Math.ceil(nComp / cols);
    const cellW = width / cols;
    const cellH = height / rows;
    const labelH = 18;
    const islandR = Math.max(10, Math.min(cellW, cellH - labelH) * 0.42);

    // global dot-size scale (sqrt of nCells → radius)
    const cellsArr = clusters.map((c) => c.nCells || 1);
    const maxCells = Math.max(...cellsArr, 1);
    const dotR = (n: number) => {
      const t = Math.sqrt((n || 1) / maxCells); // 0..1
      return 2.2 + t * (islandR * 0.16);
    };

    const islands = comps.map((ci, gi) => {
      const r = Math.floor(gi / cols);
      const c = gi % cols;
      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + (cellH - labelH) / 2 + labelH;
      const leaves = groups.get(ci)!.slice().sort((a, b) => (b.nCells || 0) - (a.nCells || 0));
      const hue = Math.round((gi * 360) / nComp);
      const dots = leaves.map((leaf, i) => {
        // phyllotaxis inside the island disc
        const rad = islandR * 0.92 * Math.sqrt((i + 0.5) / leaves.length);
        const theta = i * GOLDEN;
        return {
          id: leaf.id,
          x: cx + rad * Math.cos(theta),
          y: cy + rad * Math.sin(theta),
          r: dotR(leaf.nCells),
          fill: `hsl(${hue} 60% ${42 + (i % 5) * 5}%)`,
          leaf,
        };
      });
      return { ci, cx, cy, islandR, hue, dots };
    });
    return { islands, cellH, cellW };
  }, [clusters, width, height]);

  if (!layout) return <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a938a", fontSize: 13 }}>No compartment topology in this partition.</div>;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", background: "#fffdfb", borderRadius: 10 }}>
      {layout.islands.map((isl) => (
        <g key={isl.ci}>
          {/* island halo */}
          <circle cx={isl.cx} cy={isl.cy} r={isl.islandR * 1.05} fill={`hsl(${isl.hue} 60% 96%)`} stroke={`hsl(${isl.hue} 50% 82%)`} strokeWidth={1} />
          {/* compartment label */}
          <text x={isl.cx} y={isl.cy - isl.islandR - 4} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 800, fill: `hsl(${isl.hue} 45% 38%)` }}>
            Compartment {isl.ci}
          </text>
          <text x={isl.cx} y={isl.cy - isl.islandR + 8} textAnchor="middle" style={{ fontSize: 8.5, fill: "#9a938a" }}>
            {isl.dots.length} leaves
          </text>
          {/* leaf dots */}
          {isl.dots.map((d) => {
            const isActive = d.id === activeId;
            const isVal = validated.has(d.id);
            return (
              <circle
                key={d.id}
                cx={d.x}
                cy={d.y}
                r={isActive ? d.r + 2 : d.r}
                fill={d.fill}
                stroke={isActive ? "#111827" : isVal ? "#15803d" : "rgba(255,255,255,0.7)"}
                strokeWidth={isActive ? 2 : isVal ? 1.5 : 0.6}
                style={{ cursor: onPick ? "pointer" : "default" }}
                onClick={onPick ? () => onPick(d.id) : undefined}
              >
                <title>{`${d.leaf.compartmentLabel ?? d.leaf.label} · ${d.leaf.nCells.toLocaleString()} cells${isVal ? " · labelled" : ""}`}</title>
              </circle>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
