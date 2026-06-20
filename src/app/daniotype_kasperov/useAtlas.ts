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
    const namesUrl = dataUrl.replace(/umap\.json($|\?)/, "names.json$1");
    // names.json is optional + best-effort; a miss must never break atlas load.
    Promise.all([
      fetch(dataUrl).then((r) => {
        if (!r.ok) throw new Error(`asset ${r.status}`);
        return r.json();
      }),
      fetch(namesUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([d, names]: [any, any]) => {
        if (!alive) return;
        // GUARD: overlay names ONLY when the names artifact is bound to THIS exact
        // partition (partitionId === assignmentSha256). Mismatch/absence -> generic
        // labels, surface nothing — never decorate the wrong clustering.
        const atlasPid = d.partitionId ?? null;
        const namesPid = names?.partitionId ?? null;
        const namesOk = !!names && !!atlasPid && !!namesPid && namesPid === atlasPid && !!names.names;
        const n = d.clusters.length;
        const cs: Cluster[] = d.clusters.map((c: any, i: number) => ({
          id: c.id,
          label: namesOk && names.names[c.id] ? names.names[c.id] : c.label,
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
        for (const [x, y, ci] of (Array.isArray(d.points) ? d.points : []) as [number, number, number][]) {
          const c = cs[ci];
          if (!c) continue;
          c.points.push({ x, y });
          if (x < c.bounds.minx) c.bounds.minx = x;
          if (x > c.bounds.maxx) c.bounds.maxx = x;
          if (y < c.bounds.miny) c.bounds.miny = y;
          if (y > c.bounds.maxy) c.bounds.maxy = y;
        }
        // Partitions that ship only cluster centroids (no per-cell point cloud, e.g. daniocell_native):
        // render one dot per cluster at its centroid so the map reflects the clustering instead of blanking.
        if (!Array.isArray(d.points) || d.points.length === 0) {
          for (const c of cs) {
            if (typeof c.cx === "number" && typeof c.cy === "number") {
              c.points.push({ x: c.cx, y: c.cy });
              c.bounds = { minx: c.cx, maxx: c.cx, miny: c.cy, maxy: c.cy };
            }
          }
        }
        setClusters(cs);
        setMeta({
          source: d.source, totalCells: d.totalCells, nClusters: n,
          fullDatasetCells: d.fullDatasetCells,
          pointsShown: Array.isArray(d.points) ? d.points.length : undefined,
          partitionId: atlasPid,
          namesApplied: namesOk,
          namesRunId: namesOk ? names?.source?.runId ?? null : null,
        });
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [dataUrl]);

  return { clusters, meta, error };
}
