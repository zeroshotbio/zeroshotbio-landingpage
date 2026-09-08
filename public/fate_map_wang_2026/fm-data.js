/* /fate_map_wang_2026 — data layer.
 *
 * Decodes the four binaries written by scripts/build_fate_map_wang_2026.py. Layouts are
 * fixed there and mirrored here; if you change one, change both, and bump the
 * version byte so a stale cached asset fails loudly instead of drawing noise.
 *
 * Angles are stored as int16 hundredths of a degree. Two spherical coordinates
 * do all the work on this page:
 *   lat  0..180   angle from the ANIMAL POLE. 90 is the equator, which at 5.5
 *                 hpf is where the blastoderm margin sits. Epiboly is latitude
 *                 increasing.
 *   lon  -180..180 angle about that axis, measured from the DORSAL meridian
 *                 that the build script fits to the data. 0 dorsal, ±180
 *                 ventral, ±90 the two flanks — and which flank is left and
 *                 which is right is NOT recoverable from this data, so the page
 *                 never says.
 */
'use strict';

const FM = {
  meta: null, flow: null, founders: null, final: null, first: null,
};

function magicOf(buf, off) {
  return String.fromCharCode(...new Uint8Array(buf, off, 4));
}

function decodeFlow(buf) {
  if (magicOf(buf, 0) !== 'FMFL') throw new Error('flow.bin: bad magic');
  const h = new Uint32Array(buf, 4, 3);
  const ver = h[0], nSeg = h[1], nSamp = h[2];
  if (ver !== 1) throw new Error('flow.bin: version ' + ver);
  let o = 16;
  const off = new Uint32Array(buf, o, nSeg); o += 4 * nSeg;
  const len = new Uint16Array(buf, o, nSeg); o += 2 * nSeg;
  const g0 = new Uint16Array(buf, o, nSeg); o += 2 * nSeg;
  const parent = new Int32Array(buf, o, nSeg); o += 4 * nSeg;
  const founder = new Int32Array(buf, o, nSeg); o += 4 * nSeg;
  const lat = new Int16Array(buf, o, nSamp); o += 2 * nSamp;
  const lon = new Int16Array(buf, o, nSamp); o += 2 * nSamp;
  return { nSeg, nSamp, off, len, g0, parent, founder, lat, lon };
}

/* Every header is 16 bytes and every file lists its WIDEST elements first, so
 * each typed-array view lands on a multiple of its element size whatever the
 * row count. Putting a 1-byte column ahead of a 2-byte one throws for odd n. */
function decodeFounders(buf, nTerr) {
  if (magicOf(buf, 0) !== 'FMFD') throw new Error('founders.bin: bad magic');
  const h = new Uint32Array(buf, 4, 3);
  const n = h[1];
  if (h[2] !== nTerr) throw new Error('founders.bin: territory count disagrees with meta.json');
  let o = 16;
  const lat = new Int16Array(buf, o, n); o += 2 * n;
  const lon = new Int16Array(buf, o, n); o += 2 * n;
  const count = new Uint16Array(buf, o, n); o += 2 * n;
  const purity = new Int16Array(buf, o, n); o += 2 * n;
  const hist = new Uint16Array(buf, o, n * nTerr); o += 2 * n * nTerr;
  const dom = new Int8Array(buf, o, n);
  return { n, lat, lon, count, dom, purity, hist, nTerr };
}

function decodeFinal(buf) {
  if (magicOf(buf, 0) !== 'FMFN') throw new Error('final.bin: bad magic');
  const n = new Uint32Array(buf, 4, 3)[1];
  let o = 16;
  const lat = new Int16Array(buf, o, n); o += 2 * n;
  const lon = new Int16Array(buf, o, n); o += 2 * n;
  const terr = new Int8Array(buf, o, n); o += n;
  const traced = new Uint8Array(buf, o, n);
  return { n, lat, lon, terr, traced };
}

function decodeFirst(buf) {
  if (magicOf(buf, 0) !== 'FMFR') throw new Error('first.bin: bad magic');
  const n = new Uint32Array(buf, 4, 3)[1];
  let o = 16;
  const founder = new Int32Array(buf, o, n); o += 4 * n;
  const lat = new Int16Array(buf, o, n); o += 2 * n;
  const lon = new Int16Array(buf, o, n);
  return { n, lat, lon, founder };
}

async function fmLoad() {
  const get = async (p, type) => {
    const r = await fetch(p, { cache: 'no-cache' });
    if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
    return type === 'json' ? r.json() : r.arrayBuffer();
  };
  const [meta, flowB, fdB, fnB, frB] = await Promise.all([
    get('/fate_map_wang_2026/meta.json', 'json'),
    get('/fate_map_wang_2026/flow.bin'),
    get('/fate_map_wang_2026/founders.bin'),
    get('/fate_map_wang_2026/final.bin'),
    get('/fate_map_wang_2026/first.bin'),
  ]);
  FM.meta = meta;
  FM.flow = decodeFlow(flowB);
  FM.founders = decodeFounders(fdB, meta.territories.length);
  FM.final = decodeFinal(fnB);
  FM.first = decodeFirst(frB);

  // Cross-check the header counts against what meta.json claims. These files
  // are written in one pass by one script, so a mismatch means a half-deployed
  // asset set — the exact failure the no-cache headers exist to prevent.
  const c = meta.counts;
  if (FM.flow.nSeg !== c.segments || FM.founders.n !== c.founders_with_descendants ||
      FM.final.n !== c.cells_last_frame || FM.first.n !== c.cells_first_frame) {
    throw new Error('asset set is inconsistent with meta.json — a stale file is cached');
  }

  // Walk each segment's parent chain once so a click can light a whole lineage
  // without re-walking. Segments are written parents-before-children.
  const f = FM.flow;
  f.depth = new Uint16Array(f.nSeg);
  for (let i = 0; i < f.nSeg; i++) {
    const p = f.parent[i];
    f.depth[i] = p < 0 ? 0 : f.depth[p] + 1;
  }
  // children index, for descending from a chosen segment
  const kidCount = new Uint8Array(f.nSeg);
  for (let i = 0; i < f.nSeg; i++) if (f.parent[i] >= 0) kidCount[f.parent[i]]++;
  f.kidOff = new Uint32Array(f.nSeg + 1);
  for (let i = 0; i < f.nSeg; i++) f.kidOff[i + 1] = f.kidOff[i] + kidCount[i];
  f.kids = new Int32Array(f.kidOff[f.nSeg]);
  const cur = f.kidOff.slice(0, f.nSeg);
  for (let i = 0; i < f.nSeg; i++) {
    const p = f.parent[i];
    if (p >= 0) f.kids[cur[p]++] = i;
  }
  // segments belonging to each founder, so the plates can select by founder
  f.byFounder = new Map();
  for (let i = 0; i < f.nSeg; i++) {
    const k = f.founder[i];
    let a = f.byFounder.get(k);
    if (!a) f.byFounder.set(k, a = []);
    a.push(i);
  }
  return FM;
}

/* The lineage of a segment: every ancestor up to the founder, plus every
 * descendant below it. Returned as a Set of segment indices. */
function fmLineageOf(seg) {
  const f = FM.flow, out = new Set();
  for (let s = seg; s >= 0; s = f.parent[s]) out.add(s);
  const stack = [seg];
  while (stack.length) {
    const s = stack.pop();
    for (let i = f.kidOff[s]; i < f.kidOff[s + 1]; i++) {
      const k = f.kids[i];
      if (!out.has(k)) { out.add(k); stack.push(k); }
    }
  }
  return out;
}

/* Every segment of a founder's tree — the same thing, entered from the plates. */
function fmFounderSegs(fi) {
  const a = FM.flow.byFounder.get(fi);
  return a ? new Set(a) : new Set();
}
