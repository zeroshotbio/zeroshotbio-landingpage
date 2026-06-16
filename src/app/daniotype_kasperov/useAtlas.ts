"use client";
// useAtlas — loads + shapes a dataset's UMAP atlas asset (umap.json) into
// Cluster[] + AtlasMeta. Extracted verbatim from KasperovClient.tsx so the live
// wizard and the read-only run viewer load atlases the same way.
import { useEffect, useState } from "react";
import type { Cluster, AtlasMeta } from "./types";

export function paletteColor(i: number, n: number) {
  const h = Math.round((i * 360) / n + (i % 2 ? 180 / n : 0)) % 360;
  const s = 60 + (i % 3) * 9;
  const l = 46 + (i % 2) * 9;
  return `hsl(${h} ${s}% ${l}%)`;
}

export function useAtlas(dataUrl: string | null) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [meta, setMeta] = useState<AtlasMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataUrl) return;
    setClusters(null);
    setMeta(null);
    setError(null);
    let alive = true;
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`asset ${r.status}`);
        return r.json();
      })
      .then((d: any) => {
        if (!alive) return;
        const n = d.clusters.length;
        const cs: Cluster[] = d.clusters.map((c: any, i: number) => ({
          id: c.id,
          label: c.label,
          nCells: c.nCells,
          color: paletteColor(i, n),
          cx: c.cx,
          cy: c.cy,
          degsUp: c.degsUp ?? [],
          markers: c.markers ?? [],
          markersDown: c.markersDown ?? [],
          points: [],
          bounds: { minx: Infinity, maxx: -Infinity, miny: Infinity, maxy: -Infinity },
        }));
        for (const [x, y, ci] of d.points as [number, number, number][]) {
          const c = cs[ci];
          if (!c) continue;
          c.points.push({ x, y });
          if (x < c.bounds.minx) c.bounds.minx = x;
          if (x > c.bounds.maxx) c.bounds.maxx = x;
          if (y < c.bounds.miny) c.bounds.miny = y;
          if (y > c.bounds.maxy) c.bounds.maxy = y;
        }
        setClusters(cs);
        setMeta({ source: d.source, totalCells: d.totalCells, nClusters: n, fullDatasetCells: d.fullDatasetCells, pointsShown: Array.isArray(d.points) ? d.points.length : undefined });
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [dataUrl]);

  return { clusters, meta, error };
}
