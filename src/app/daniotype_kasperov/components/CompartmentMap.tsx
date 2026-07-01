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
const kfmt = (n: number) => (n >= 1_000_000 ? (n / 1e6).toFixed(1) + "M" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n)); // compact cell count

export function CompartmentMap({
  clusters,
  activeId,
  validated,
  width,
  height,
  onPick,
  dimUnfocused,
  focusCompartments,
  nextCompartment,
  doneThrough,
}: {
  clusters: Cluster[];
  activeId: string | null;
  validated: Set<string>;
  width: number;
  height: number;
  onPick?: (id: string) => void;
  // focus/spotlight controls (labelling world map + Meta-Reasoner):
  dimUnfocused?: boolean; // desaturate + fade non-focused compartments
  focusCompartments?: number[]; // compartmentIndexes to spotlight (overrides activeId-derived focus)
  nextCompartment?: number | null; // styled as "next up" (Meta-Reasoner)
  doneThrough?: number | null; // compartmentIndex ≤ this renders with a "done" tint
}) {
  // the active leaf's compartment (world-map focus follows the cluster being labelled)
  const activeCompIndex = activeId != null ? clusters.find((c) => c.id === activeId)?.compartmentIndex ?? null : null;
  const focusSet = new Set<number>(focusCompartments ?? (activeCompIndex != null ? [activeCompIndex] : []));
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
    // labels live in a RESERVED band at the top of each cell — never over the dots.
    // Below a cell size they'd cramp (e.g. the tiny world-map panel), so drop them.
    const showLabels = cellW >= 78 && cellH >= 66;
    const labelBand = showLabels ? 30 : 4;
    const availH = cellH - labelBand; // room for the island below the labels
    const islandR = Math.max(9, Math.min(cellW, availH) * 0.42);

    // global dot-size scale (sqrt of nCells → radius)
    const maxCells = Math.max(...clusters.map((c) => c.nCells || 1), 1);
    const dotR = (n: number) => 2.2 + Math.sqrt((n || 1) / maxCells) * (islandR * 0.16);

    const islands = comps.map((ci, gi) => {
      const r = Math.floor(gi / cols);
      const c = gi % cols;
      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + labelBand + availH / 2; // island centred BELOW the label band
      const labelTop = r * cellH;
      const leaves = groups.get(ci)!.slice().sort((a, b) => (b.nCells || 0) - (a.nCells || 0));
      const compCells = leaves.reduce((s, l) => s + (l.nCells || 0), 0);
      const hue = Math.round((gi * 360) / nComp);
      const dots = leaves.map((leaf, i) => {
        // phyllotaxis inside the island disc
        const rad = islandR * 0.9 * Math.sqrt((i + 0.5) / leaves.length);
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
      return { ci, cx, cy, labelTop, islandR, hue, nLeaves: leaves.length, compCells, dots };
    });
    return { islands, cellH, cellW, showLabels };
  }, [clusters, width, height]);

  if (!layout) return <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a938a", fontSize: 13 }}>No compartment topology in this partition.</div>;

  const anyFocus = focusSet.size > 0;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", background: "#fffdfb", borderRadius: 10 }}>
      {layout.islands.map((isl) => {
        const isFocus = focusSet.has(isl.ci);
        const isNext = nextCompartment != null && isl.ci === nextCompartment;
        const isDone = doneThrough != null && isl.ci <= doneThrough && !isFocus;
        // dim only the PENDING compartments so the current/next/done ones stand out
        const dim = dimUnfocused && anyFocus && !isFocus && !isNext && !isDone;
        const haloStroke = isNext ? "#7c3aed" : isFocus ? `hsl(${isl.hue} 55% 55%)` : isDone ? "#86c99a" : `hsl(${isl.hue} 50% 82%)`;
        return (
          <g key={isl.ci} opacity={dim ? 0.22 : 1} style={{ transition: "opacity 240ms" }}>
            {/* island halo — thicker/coloured ring on the focused or next-up compartment */}
            <circle cx={isl.cx} cy={isl.cy} r={isl.islandR * 1.05} fill={`hsl(${isl.hue} 60% ${dim ? 97 : 96}%)`} stroke={haloStroke} strokeWidth={isFocus || isNext ? 2.5 : 1} strokeDasharray={isNext && !isFocus ? "5 4" : undefined} />
            {/* compartment labels — in the RESERVED band above the island (never over the dots) */}
            {layout.showLabels && (
              <>
                <text x={isl.cx} y={isl.labelTop + 13} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: isNext ? "#7c3aed" : `hsl(${isl.hue} 45% 36%)` }}>
                  Compartment {isl.ci}{isNext ? " →" : isDone ? " ✓" : ""}
                </text>
                <text x={isl.cx} y={isl.labelTop + 25} textAnchor="middle" style={{ fontSize: 9, fill: "#8a847b" }}>{kfmt(isl.compCells)} cells · {isl.nLeaves} leaves</text>
              </>
            )}
            {/* leaf dots */}
            {isl.dots.map((d) => {
              const isActive = d.id === activeId;
              const isVal = validated.has(d.id);
              return (
                <g key={d.id}>
                  {/* the active leaf gets an outer glow ring so it pops within its compartment */}
                  {isActive && <circle cx={d.x} cy={d.y} r={d.r + 5} fill="none" stroke="#111827" strokeWidth={1} opacity={0.35} />}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isActive ? d.r + 2 : d.r}
                    fill={d.fill}
                    stroke={isActive ? "#111827" : isVal ? "#15803d" : "rgba(255,255,255,0.7)"}
                    strokeWidth={isActive ? 2.5 : isVal ? 1.5 : 0.6}
                    style={{ cursor: onPick ? "pointer" : "default" }}
                    onClick={onPick ? () => onPick(d.id) : undefined}
                  >
                    <title>{`${d.leaf.compartmentLabel ?? d.leaf.label} · ${d.leaf.nCells.toLocaleString()} cells${isVal ? " · labelled" : ""}`}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
