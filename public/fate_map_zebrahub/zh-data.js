/* /fate_map_zebrahub — data layer.
 *
 * Decodes what scripts/build_fate_map_zebrahub.py writes. Both binaries put
 * their WIDEST elements first after a 16- or 20-byte header, so every typed
 * array view lands on a legal offset whatever the row count.
 *
 * cells.bin   ZHCL  x i16, y i16, cluster u16, timepoint u8, class u8, fish u8, axial u8
 * tracks.bin  ZHTR  start u32, parent i32, len u16, then x/y/z/t as u16 per sample
 */
'use strict';

const ZH = { meta: null, cells: null, tracks: null, embryos: null };

const magic4 = (buf, o) => String.fromCharCode(...new Uint8Array(buf, o, 4));

function zhDecodeCells(buf) {
  if (magic4(buf, 0) !== 'ZHCL') throw new Error('cells.bin: bad magic');
  const h = new Uint32Array(buf, 4, 3);
  if (h[0] !== 1) throw new Error('cells.bin: version ' + h[0]);
  const n = h[1];
  let o = 16;
  const x = new Int16Array(buf, o, n); o += 2 * n;
  const y = new Int16Array(buf, o, n); o += 2 * n;
  const cluster = new Uint16Array(buf, o, n); o += 2 * n;
  const t = new Uint8Array(buf, o, n); o += n;
  const cls = new Uint8Array(buf, o, n); o += n;
  const fish = new Uint8Array(buf, o, n); o += n;
  const axial = new Uint8Array(buf, o, n);
  return { n, x, y, cluster, t, cls, fish, axial };
}

function zhDecodeTracks(buf) {
  if (magic4(buf, 0) !== 'ZHTR') throw new Error('tracks.bin: bad magic');
  const h = new Uint32Array(buf, 4, 4);
  if (h[0] !== 1) throw new Error('tracks.bin: version ' + h[0]);
  const nT = h[1], nS = h[2], nF = h[3];
  let o = 20;
  o += (4 - (o % 4)) % 4;                       // u32 view needs a 4-aligned start
  const start = new Uint32Array(buf, o, nT); o += 4 * nT;
  const parent = new Int32Array(buf, o, nT); o += 4 * nT;
  const len = new Uint16Array(buf, o, nT); o += 2 * nT;
  const x = new Uint16Array(buf, o, nS); o += 2 * nS;
  const y = new Uint16Array(buf, o, nS); o += 2 * nS;
  const z = new Uint16Array(buf, o, nS); o += 2 * nS;
  const t = new Uint16Array(buf, o, nS);
  return { nT, nS, nF, start, parent, len, x, y, z, t };
}

async function zhLoad() {
  const get = async (p, json) => {
    const r = await fetch(p, { cache: 'no-cache' });
    if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
    return json ? r.json() : r.arrayBuffer();
  };
  const base = '/fate_map_zebrahub/';
  const [meta, cellsB, embryos, tracksB] = await Promise.all([
    get(base + 'meta.json', true),
    get(base + 'cells.bin'),
    get(base + 'embryos.json', true),
    get(base + 'tracks.bin'),
  ]);
  ZH.meta = meta;
  ZH.cells = zhDecodeCells(cellsB);
  ZH.embryos = embryos;
  ZH.tracks = zhDecodeTracks(tracksB);

  const c = meta.counts;
  if (ZH.cells.n !== c.cells || ZH.tracks.nT !== c.tracks ||
      ZH.embryos.length !== c.timepoints) {
    throw new Error('asset set is inconsistent with meta.json — a stale file is cached');
  }

  // bounds of the embedding and of the tracked volume
  const q = ZH.cells;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < q.n; i++) {
    if (q.x[i] < x0) x0 = q.x[i]; if (q.x[i] > x1) x1 = q.x[i];
    if (q.y[i] < y0) y0 = q.y[i]; if (q.y[i] > y1) y1 = q.y[i];
  }
  ZH.bounds = { x0, x1, y0, y1 };

  const T = ZH.tracks;
  const bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (let i = 0; i < T.nS; i++) {
    if (T.x[i] < bb.x0) bb.x0 = T.x[i]; if (T.x[i] > bb.x1) bb.x1 = T.x[i];
    if (T.y[i] < bb.y0) bb.y0 = T.y[i]; if (T.y[i] > bb.y1) bb.y1 = T.y[i];
    if (T.z[i] < bb.z0) bb.z0 = T.z[i]; if (T.z[i] > bb.z1) bb.z1 = T.z[i];
  }
  ZH.tbounds = bb;

  // For each sampled frame, the sample indices present in it. Built once; the
  // scrubber and the pick both need it and rebuilding per frame is what makes
  // a scrubber feel heavy.
  ZH.byFrame = new Array(T.nF);
  const count = new Uint32Array(T.nF);
  for (let i = 0; i < T.nS; i++) count[T.t[i]]++;
  const off = new Uint32Array(T.nF + 1);
  for (let i = 0; i < T.nF; i++) off[i + 1] = off[i] + count[i];
  const flat = new Uint32Array(T.nS);
  const cur = off.slice(0, T.nF);
  for (let i = 0; i < T.nS; i++) flat[cur[T.t[i]]++] = i;
  ZH.frameOff = off; ZH.frameIdx = flat;

  // sample -> track, so a picked point can name its track
  ZH.trackOf = new Int32Array(T.nS);
  for (let k = 0; k < T.nT; k++) {
    const a = T.start[k], b = a + T.len[k];
    for (let i = a; i < b; i++) ZH.trackOf[i] = k;
  }
  return ZH;
}

/* ---------------------------------------------------------------------------
 * Canvas sizing. A backing store is 4 bytes a pixel and WebKit caps how much of
 * it a document may hold, then blanks canvases rather than failing loudly — the
 * lesson from /fate_map_daniocell, where four plates at dpr 2 asked for ~96 MB
 * and a reader lost a plate that rendered perfectly well in Chrome. Take the
 * largest scale that keeps one canvas under ZH_MAX_PX, never below 1.
 * ------------------------------------------------------------------------- */
const ZH_MAX_PX = 4.0e6;

function zhSizeCanvas(cv, cssW, cssH) {
  const want = Math.min(window.devicePixelRatio || 1, 2);
  const cap = Math.sqrt(ZH_MAX_PX / Math.max(1, cssW * cssH));
  const dpr = Math.max(1, Math.min(want, cap));
  cv.width = Math.max(1, Math.round(cssW * dpr));
  cv.height = Math.max(1, Math.round(cssH * dpr));
  cv.style.height = cssH + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr };
}

/* Fill many small squares without building one enormous path. Half a million
 * rect() calls in a single path renders in Chrome and draws nothing in engines
 * that give up past an internal limit; chunking removes the question. */
function zhFillPoints(ctx, emit, size) {
  const CHUNK = 16384;
  let k = 0;
  ctx.beginPath();
  emit((x, y) => {
    ctx.rect(x, y, size, size);
    if (++k % CHUNK === 0) { ctx.fill(); ctx.beginPath(); }
  });
  ctx.fill();
}

/* Stroke many short polylines, chunked for the same reason. */
function zhStrokeChunked(ctx, emit) {
  const CHUNK = 4096;
  let k = 0;
  ctx.beginPath();
  emit(
    (x, y) => ctx.moveTo(x, y),
    (x, y) => { ctx.lineTo(x, y); },
    () => { if (++k % CHUNK === 0) { ctx.stroke(); ctx.beginPath(); } }
  );
  ctx.stroke();
}

function zhRepaintOnView(el, paint) {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) paint();
  }, { rootMargin: '200px' }).observe(el);
}
