/* /fate_map_daniocell — data layer.
 *
 * Decodes what scripts/build_fate_map_daniocell.py writes. Layouts are fixed
 * there and mirrored here; change one, change both.
 *
 * cells.bin — 16-byte header, then columns WIDEST ELEMENT FIRST so every typed
 * array view lands on a legal offset whatever the row count:
 *   x  int16   UMAP_1 * xy_scale
 *   y  int16   UMAP_2 * xy_scale
 *   c  uint16  index into clusters.json
 *   t  uint8   index into meta.stages   (the collected hpf, not a bin)
 *   s  uint8   index into meta.tissues  (the 19 subsets + cephalic)
 */
'use strict';

const DC = { meta: null, cells: null, clusters: null, programs: null, cascades: null };

function dcDecodeCells(buf) {
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'DCEL')
    throw new Error('cells.bin: bad magic');
  const h = new Uint32Array(buf, 4, 3);
  const ver = h[0], n = h[1], nStage = h[2];
  if (ver !== 1) throw new Error('cells.bin: version ' + ver);
  let o = 16;
  const x = new Int16Array(buf, o, n); o += 2 * n;
  const y = new Int16Array(buf, o, n); o += 2 * n;
  const c = new Uint16Array(buf, o, n); o += 2 * n;
  const t = new Uint8Array(buf, o, n); o += n;
  const s = new Uint8Array(buf, o, n);
  return { n, nStage, x, y, c, t, s };
}

async function dcLoad() {
  const get = async (p, json) => {
    const r = await fetch(p, { cache: 'no-cache' });
    if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
    return json ? r.json() : r.arrayBuffer();
  };
  const base = '/fate_map_daniocell/';
  const [meta, cellsB, clusters, programs, cascades] = await Promise.all([
    get(base + 'meta.json', true),
    get(base + 'cells.bin'),
    get(base + 'clusters.json', true),
    get(base + 'programs.json', true),
    get(base + 'cascades.json', true),
  ]);
  DC.meta = meta;
  DC.cells = dcDecodeCells(cellsB);
  DC.clusters = clusters;
  DC.programs = programs;
  DC.cascades = cascades;

  // A half-deployed asset set draws a plausible, wrong picture rather than
  // failing, which is exactly what the no-cache headers exist to prevent.
  // Check the counts against meta and refuse if they disagree.
  const c = meta.counts;
  if (DC.cells.n !== c.cells || DC.clusters.length !== c.clusters ||
      DC.programs.length !== c.programs || DC.cells.nStage !== c.stages) {
    throw new Error('asset set is inconsistent with meta.json — a stale file is cached');
  }

  // Derived indexes the plates all want.
  DC.tissueIx = {};
  meta.tissues.forEach((t, i) => { DC.tissueIx[t.key] = i; });
  DC.clusterIx = {};
  DC.clusters.forEach((cl, i) => { DC.clusterIx[cl.id] = i; });

  // Cells per (stage, cluster) is needed by Plate I's scrubber and by the
  // "follow this state through time" read-out. One pass, kept as counts.
  const nS = meta.stages.length, nC = DC.clusters.length;
  DC.stageCount = new Uint32Array(nS);
  for (let i = 0; i < DC.cells.n; i++) DC.stageCount[DC.cells.t[i]]++;

  // Bounds of the embedding, for the fit transform.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < DC.cells.n; i++) {
    const x = DC.cells.x[i], y = DC.cells.y[i];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  DC.bounds = { x0, x1, y0, y1 };
  return DC;
}

/* Cell indices belonging to one cluster — built lazily, cached. */
DC.cellsOfCluster = function (ci) {
  DC._byCluster = DC._byCluster || new Map();
  let a = DC._byCluster.get(ci);
  if (a) return a;
  const out = [];
  for (let i = 0; i < DC.cells.n; i++) if (DC.cells.c[i] === ci) out.push(i);
  a = Uint32Array.from(out);
  DC._byCluster.set(ci, a);
  return a;
};

/* Per-stage counts for one cluster — how a state's abundance moves in time. */
DC.stageProfile = function (ci) {
  const idx = DC.cellsOfCluster(ci);
  const out = new Uint32Array(DC.meta.stages.length);
  for (let k = 0; k < idx.length; k++) out[DC.cells.t[idx[k]]]++;
  return out;
};
