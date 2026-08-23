/* ============================================================
   bp-tiles.js — the six tiles.

   THE CASCADE
   Computed once, at load, and it is a real cascade: each stage filters the
   survivors of the one before it, not the ground-truth population. So the
   mito filter sees the few ambient barcodes the knee let through, and the
   doublet scorer sees whatever the complexity band left. That is what the
   pipeline would do, and it is why the ledger numbers add up.

   EVERY TILE'S CULL GESTURE IS DIFFERENT, and the difference carries meaning:
     02  barcodes below the knee RAIN downward      — they were never cells
     03  dying cells RISE off the top and fade      — they are leaking
     04  under-amplified SHRINK, over-amplified SWELL AND BURST
     05  doublets PULL APART into their two halves  — they were always two
   Six identical fades would make the sequence read as one animation on a
   loop. Do not reuse a gesture.

   Load order: pop -> draw -> tiles -> data -> view
   ============================================================ */

const SIM = (function () {
  const barcodes = makeBarcodes();

  const knee = kneeOf(barcodes.map(b => b.umi));
  const s1 = barcodes.filter(b => b.umi >= knee);

  const mito = mitoCut(s1);
  const s2 = s1.filter(c => c.mitoPct <= mito.cut);

  const band = cubicBand(s2);
  const resid = c => Math.log10(c.genes) - band.fit(Math.log10(c.umi));
  const s3 = s2.filter(c => Math.abs(resid(c)) <= band.half);

  const ds = doubletScores(s3, mulberry32(0x9e37));
  const scoreOf = new Map(s3.map((c, i) => [c.id, ds.scores[i]]));
  const s4 = s3.filter(c => scoreOf.get(c.id) < ds.cut);

  /* plot ranges, from the data rather than from round numbers */
  const umis = barcodes.map(b => b.umi);
  const loU = Math.log10(Math.min(...umis)), hiU = Math.log10(Math.max(...umis));
  const gs = s1.map(c => c.genes);
  const loG = Math.log10(Math.min(...gs)), hiG = Math.log10(Math.max(...gs));

  return {
    barcodes, knee, s1, mito, s2, band, resid, s3, ds, scoreOf, s4,
    loU, hiU, loG, hiG,
    /* the ledger, in the order the map reads */
    lost: {
      knee: barcodes.length - s1.length,
      mito: s1.length - s2.length,
      complexity: s2.length - s3.length,
      doublet: s3.length - s4.length
    }
  };
})();

/* Scale from a real MiniFin figure to the drawn sample and back. One drawn
   dot stands for this many real barcodes. */
const REAL_BARCODES = 2743021;
const SCALE = REAL_BARCODES / SIM.barcodes.length;
const toReal = n => Math.round(n * SCALE);

/* membership, built once — see the ghosts loop in tile 06 */
const KEPT_IDS = new Set(SIM.s4.map(c => c.id));

/* ============================================================
   DOT BATCHING
   14,000 dots a frame, several tiles visible at once. One arc()+fill() per
   dot is the entire frame budget; these quantise alpha into a few buckets and
   emit one path per bucket, which is roughly 40x cheaper and visually
   identical.
   ============================================================ */
function batch(c, items, colourOf, BUCKETS = 5, count) {
  const { ctx } = c;
  const N = count === undefined ? items.length : count;
  const bins = Array.from({ length: BUCKETS }, () => []);
  for (let k = 0; k < N; k++) {
    const it = items[k];
    if (it.a <= 0.01) continue;
    bins[Math.min(BUCKETS - 1, Math.floor(it.a * BUCKETS))].push(it);
  }
  bins.forEach((bin, i) => {
    if (!bin.length) return;
    ctx.globalAlpha = (i + 0.5) / BUCKETS;
    const byCol = new Map();
    for (const it of bin) {
      const col = colourOf(it);
      if (!byCol.has(col)) byCol.set(col, []);
      byCol.get(col).push(it);
    }
    for (const [col, list] of byCol) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const it of list) {
        ctx.moveTo(it.x + it.r, it.y);
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

/* ---- reusable buffers -----------------------------------------------------
   Both the raw field and the filtered matrix draw the whole population every
   frame. These keep that from allocating. */
let _scratch = [];
function scratch(n) {
  while (_scratch.length < n) _scratch.push({ x: 0, y: 0, r: 0, a: 0, big: false });
  return _scratch;
}
/* log-transcript position per barcode, computed once */
const LU = (() => {
  const a = new Float64Array(SIM.barcodes.length);
  for (const b of SIM.barcodes) a[b.id] = (Math.log10(b.umi) - SIM.loU) / (SIM.hiU - SIM.loU);
  return a;
})();
/* the static ghost layer of tile 06, cached per tile size */
let _ghosts = null, _ghostS = -1;
function ghostsFor(c) {
  if (_ghostS === c.S) return _ghosts;
  _ghostS = c.S; _ghosts = [];
  for (const b of SIM.barcodes) {
    if (KEPT_IDS.has(b.id)) continue;
    _ghosts.push({ x: c.L + (0.02 + b.x * 0.96) * c.w,
                   y: c.T + (0.02 + b.y * 0.96) * c.h,
                   r: 0.5 * c.u, a: 0.10 });
  }
  return _ghosts;
}

const TILES = {};

/* ============================================================
   01 · RAW FIELD — unfiltered_dge

   A field, not a plot, so it gets a plain hairline boundary instead of the L.
   Radius and opacity both map to transcript count, which is what makes the
   ratio physical: 96.6% of what is here is a haze of nothing, and the real
   cells are a sparse constellation inside it. Nothing is culled. The tile's
   only job is to make the viewer feel that ratio before anything is cut.
   ============================================================ */
TILES.raw = (c, t) => {
  const { u, P } = c;
  const fadeIn = ease.out(beat(t, 0, 0.14));
  const pulse = beat(t, 0.62, 0.80);
  const pulseAmt = pulse > 0 && pulse < 1 ? Math.sin(pulse * Math.PI) : 0;

  frameBox(c);

  /* one scratch array, refilled in place: a fresh 14,000-object array every
     frame is pure GC pressure on the heaviest tile of six */
  const items = scratch(SIM.barcodes.length);
  let n = 0;
  for (const b of SIM.barcodes) {
    const lu = LU[b.id];
    const drift = 1.1 * u;
    const ph = t * Math.PI * 2 * b.sp + b.ph;
    const x = c.L + (0.02 + b.x * 0.96) * c.w + Math.cos(ph) * drift * b.jx;
    const y = c.T + (0.02 + b.y * 0.96) * c.h + Math.sin(ph) * drift * b.jy;
    const big = b.umi >= SIM.knee;
    /* CONTRAST CARRIES THE RATIO, NOT SIZE.
       14,000 dots in a 270px square is one per 5 square pixels. The first
       version gave the ambient barcodes r=0.8u and they merged into a solid
       mat; the second made them nearly invisible and the tile read as a field
       of cells with no haze at all. Both lost the one thing this tile exists
       to show.

       What works is a fine dark stipple for the 96.6% and a small, fully
       saturated point for the 3.4%: the haze covers most of the area at low
       alpha, the cells are discrete and bright, and the eye separates them by
       contrast rather than by area. Cells stay SMALL — a blob reads as a
       crowd, a point reads as a constellation. */
    /* The reveal is by SUBTRACTION: the haze fades back and the constellation
       is left standing, rather than the cells swelling into it. Growing them
       was the first attempt and it merged every neighbouring pair into a
       blob — the exact opposite of "the constellation was there all along",
       since what you saw was a new, denser crowd. Taking the ground away
       cannot crowd anything. */
    const it = items[n++];
    it.x = x; it.y = y;
    it.r = (big ? 0.62 + lu * 0.38 + pulseAmt * 0.18 : 0.30) * u;
    it.a = (big ? 0.85 + lu * 0.15
                : (0.14 + lu * 0.14) * (1 - pulseAmt * 0.86)) * fadeIn;
    it.big = big;
  }
  batch(c, items, it => (it.big ? P.keep : P.dim), 5, n);

  tileTitle(c, "01", "RAW FIELD");
  bigNumber(c, fmtInt(REAL_BARCODES), "barcodes in · nothing cut", P.ink);

  /* Annotations live in the bottom margin, stacked, NOT on the field. A tile
     that is uniformly covered by design has no empty quadrant, so the only
     open space is outside the boundary — and the two lines must not share a
     baseline or they collide at any width. */
  if (t > 0.20) {
    const a = Math.min(1, (t - 0.20) * 7);
    c.ctx.save(); c.ctx.globalAlpha = a;
    tracked(c, "floor: 10 transcripts, dropped upstream",
      c.L, c.B + 6.0 * u, "tick", P.dim, "left", c.w);
    c.ctx.restore();
  }
  if (t > 0.62) {
    const a = Math.min(1, (t - 0.62) * 7);
    c.ctx.save(); c.ctx.globalAlpha = a;
    tracked(c, "3.45% are cells", c.L, c.B + 12.4 * u, "label", P.keep, "left", c.w);
    c.ctx.restore();
  }
};

/* ============================================================
   02 · THE KNEE — knee_threshold

   Rank curve in log-log, drawn left to right, threshold locking at the point
   of steepest descent. The tail desaturates, breaks into points and rains off
   the bottom: these barcodes were never cells, so they fall out of the plot
   rather than being lifted out of it.

   This is the one cull on the page whose METHOD exists in code — zsb-bronze's
   `barcode_ranks`, a port of the DropletUtils search. It is not the shipping
   policy. See bp-data.js.
   ============================================================ */
TILES.knee = (c, t) => {
  const { ctx, u, P } = c;
  const draw = ease.io(beat(t, 0.02, 0.34));
  const lock = beat(t, 0.36, 0.50);
  const rain = ease.in_(beat(t, 0.52, 0.84));

  frameL(c, "BARCODE RANK", "TRANSCRIPTS");

  const sorted = SIM.barcodes.map(b => b.umi).sort((a, b) => b - a);
  const n = sorted.length;
  const rx = i => Math.log10(i + 1) / Math.log10(n);
  const ry = v => (Math.log10(v) - SIM.loU) / (SIM.hiU - SIM.loU);

  ticksX(c, [[rx(9), 10], [rx(999), 1000], [rx(n - 1), n]], v => fmtLog(v * SCALE));
  ticksY(c, [[ry(10), 10], [ry(300), 300], [ry(10000), 10000]], fmtLog);

  const kneeIdx = sorted.findIndex(v => v < SIM.knee);
  const kneeT = rx(kneeIdx < 0 ? n - 1 : kneeIdx);

  /* the curve, in two pieces so the tail can leave on its own */
  const step = Math.max(1, Math.floor(n / 900));
  ctx.lineWidth = W.curve * u; ctx.lineJoin = "round"; ctx.lineCap = "round";

  ctx.strokeStyle = P.keep; ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i += step) {
    const tx = rx(i); if (tx > draw) break;
    if (tx > kneeT) break;
    const X = c.px(tx), Y = c.py(ry(sorted[i]));
    started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), started = true);
  }
  ctx.stroke();

  /* the tail: a line while it is still a curve, points once it breaks up */
  if (draw > kneeT) {
    if (rain <= 0) {
      ctx.strokeStyle = P.cull; ctx.beginPath(); started = false;
      for (let i = 0; i < n; i += step) {
        const tx = rx(i); if (tx > draw || tx < kneeT) continue;
        const X = c.px(tx), Y = c.py(ry(sorted[i]));
        started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), started = true);
      }
      ctx.stroke();
    } else {
      const items = [];
      for (let i = 0; i < n; i += step) {
        const tx = rx(i); if (tx < kneeT) continue;
        const seed = ((i * 2654435761) >>> 0) / 4294967296;
        const lag = seed * 0.45;
        const f = Math.max(0, Math.min(1, (rain - lag) / (1 - lag)));
        items.push({
          x: c.px(tx) + (seed - 0.5) * 3 * u * f,
          y: c.py(ry(sorted[i])) + f * f * (c.S - c.py(ry(sorted[i])) + 12 * u),
          r: (1.05 - 0.5 * f) * u,
          a: (1 - f) * 0.9
        });
      }
      batch(c, items, () => P.cull);
    }
  }

  if (lock > 0) {
    threshLine(c, "v", kneeT, null, ease.out(lock));
    if (t > 0.52) {
      const a = Math.min(1, (t - 0.52) * 6);
      ctx.save(); ctx.globalAlpha = a;
      /* Bottom-left, which is the empty quadrant on this tile: the curve runs
         top-left to bottom-right, so everything under it is clear. Placed to
         the RIGHT of the threshold it ran straight off the canvas — the knee
         sits at about 72% of the width and a two-line label needs a third of
         it. Find the empty quadrant; do not hope there is room. */
      annotate(c, ["steepest descent", "on the smoothed curve"],
        c.L + 2.5 * u, c.B - 15 * u, c.px(kneeT), c.py(ry(SIM.knee)), P.accent);
      ctx.restore();
    }
  }

  tileTitle(c, "02", "THE KNEE");
  bigNumber(c, fmtInt(SIM.knee), "transcript cutoff · modelled", P.accent);
};

/* ============================================================
   03 · MITO % — mito_filter

   Density silhouette over mitochondrial read percentage. The median lands,
   a gold span measures three MADs rightward from it, and the cutoff locks
   where the span ends. The arithmetic is shown because it is short enough to
   check by eye, which is the entire argument for preferring it to a round
   number somebody liked.

   Cells beyond the cutoff RISE off the top and fade — they are leaking, and
   the gesture says so.
   ============================================================ */
TILES.mito = (c, t) => {
  const { ctx, u, P } = c;
  const grow = ease.out(beat(t, 0.02, 0.26));
  const medT = ease.out(beat(t, 0.28, 0.40));
  const spanT = ease.io(beat(t, 0.42, 0.58));
  const lock = beat(t, 0.58, 0.66);
  const leave = ease.in_(beat(t, 0.66, 0.90));

  frameL(c, "MITOCHONDRIAL %", "CELLS");

  const MAXX = Math.max(30, SIM.mito.cut * 2.6);
  const fx = v => Math.min(1, v / MAXX);

  /* kernel density, cheap and adequate: a fixed-width gaussian on a grid */
  const BINS = 96, bw = 1.5;
  const dens = new Float64Array(BINS);
  for (const cell of SIM.s1) {
    const at = fx(cell.mitoPct) * (BINS - 1);
    const lo = Math.max(0, Math.floor(at - bw * 3)), hi = Math.min(BINS - 1, Math.ceil(at + bw * 3));
    for (let i = lo; i <= hi; i++) dens[i] += Math.exp(-0.5 * ((i - at) / bw) ** 2);
  }
  const dmax = Math.max(...dens);
  /* capped at 70% height so the annotations always have somewhere to live.
     Annotation space is not negotiable; the data yields. */
  const CAP = 0.70;

  ctx.beginPath();
  ctx.moveTo(c.px(0), c.py(0));
  for (let i = 0; i < BINS; i++)
    ctx.lineTo(c.px(i / (BINS - 1)), c.py(dens[i] / dmax * CAP * grow));
  ctx.lineTo(c.px(1), c.py(0));
  ctx.closePath();
  ctx.fillStyle = P.keep; ctx.globalAlpha = 0.20; ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = P.keep; ctx.lineWidth = W.curve * u; ctx.stroke();

  ticksX(c, [[fx(0), 0], [fx(MAXX / 2), MAXX / 2], [fx(MAXX), MAXX]], v => Math.round(v) + "%");

  /* the cells that leave, rising off the top */
  if (leave > 0) {
    const items = [];
    for (const cell of SIM.s1) {
      if (cell.mitoPct <= SIM.mito.cut) continue;
      const seed = ((cell.id * 40503) >>> 0) / 4294967296;
      const f = Math.max(0, Math.min(1, (leave - seed * 0.35) / 0.65));
      items.push({
        x: c.px(fx(cell.mitoPct)) + (seed - 0.5) * 2 * u,
        y: c.py(0.06 + seed * 0.10) - f * (c.h * 0.85 + 10 * u),
        r: 1.15 * u, a: (1 - f) * 0.95
      });
    }
    batch(c, items, () => P.cull);
  }

  /* EVERYTHING TEXTUAL LIVES ABOVE THE CAP.
     The density is capped at 70% height, so the band from 0.74 upward is
     guaranteed clear whatever the data does. Putting the median label on the
     peak and the span across the curve's flank — the first attempt — meant
     both sat on the silhouette at every zoom. The span is drawn up here
     instead, between two reference lines raised to meet it, which is how a
     measured interval is drawn on paper anyway. */
  const SPAN_Y = 0.76;

  if (medT > 0) {
    ctx.save(); ctx.globalAlpha = medT;
    ctx.strokeStyle = P.ink; ctx.lineWidth = W.stroke * u;
    ctx.beginPath();
    ctx.moveTo(c.px(fx(SIM.mito.med)), c.py(0));
    ctx.lineTo(c.px(fx(SIM.mito.med)), c.py(SPAN_Y));
    ctx.stroke();
    tracked(c, "median", c.px(fx(SIM.mito.med)) - 2.0 * u, c.py(SPAN_Y + 0.04),
      "label", P.ink, "right");
    ctx.restore();
  }

  /* the 3-MAD span, measured rightward from the median, in the clear band */
  if (spanT > 0) {
    const x0 = c.px(fx(SIM.mito.med));
    const x1 = c.px(fx(SIM.mito.med + 3 * SIM.mito.mad * spanT));
    const y = c.py(SPAN_Y);
    ctx.save();
    ctx.strokeStyle = P.accent; ctx.lineWidth = W.stroke * u;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    ctx.moveTo(x0, y - 1.8 * u); ctx.lineTo(x0, y + 1.8 * u);
    ctx.moveTo(x1, y - 1.8 * u); ctx.lineTo(x1, y + 1.8 * u);
    ctx.stroke();
    /* Left-aligned from the median line, NOT centred on the span. Centring
       pushes half the label to the LEFT of x0, straight into "median" coming
       the other way — the span between median and cutoff is only about 13u
       wide and "3 MAD" is wider than that. Anchored at x0 the two labels
       cannot meet whatever the data does to the span. */
    tracked(c, "3 MAD", x0 + 1.2 * u, y - 2.8 * u, "label", P.accent, "left", c.w * 0.5);
    ctx.restore();
  }

  if (lock > 0) threshLine(c, "v", fx(SIM.mito.cut), null, ease.out(lock));

  /* the arithmetic, spelled out, hard right in the clear band so it cannot
     meet the span label coming the other way */
  if (t > 0.60) {
    const a = Math.min(1, (t - 0.60) * 6);
    ctx.save(); ctx.globalAlpha = a;
    tracked(c, `${SIM.mito.med.toFixed(1)} + 3 x ${SIM.mito.mad.toFixed(2)} = ${SIM.mito.cut.toFixed(1)}%`,
      c.R, c.py(0.94), "label", P.accent, "right", c.w * 0.62);
    ctx.restore();
  }

  tileTitle(c, "03", "MITO %");
  bigNumber(c, fmtPct(SIM.mito.cut), "cutoff · modelled", P.accent);
};

/* ============================================================
   04 · COMPLEXITY — complexity_filter

   Genes against transcripts, log-log. A least-squares cubic draws through the
   cloud, then a prediction band opens outward from it.

   BOTH TAILS LEAVE, FOR OPPOSITE REASONS, and the tile must not read as
   one-sided: above the band, under-amplified cells SHRINK to nothing; below
   it, over-amplified cells SWELL AND BURST. Two annotations, diagonally
   opposed, so neither tail can be mistaken for the only one.
   ============================================================ */
TILES.complexity = (c, t) => {
  const { ctx, u, P } = c;
  const show = ease.out(beat(t, 0.02, 0.20));
  const fit = ease.io(beat(t, 0.22, 0.42));
  const open = ease.out(beat(t, 0.44, 0.60));
  const go = ease.io(beat(t, 0.62, 0.88));

  frameL(c, "TRANSCRIPTS", "GENES");

  const gx = v => (Math.log10(v) - Math.log10(SIM.knee)) / (SIM.hiU - Math.log10(SIM.knee));
  const gy = v => (Math.log10(v) - SIM.loG) / (SIM.hiG - SIM.loG);

  ticksX(c, [[gx(SIM.knee), SIM.knee], [gx(2000), 2000], [gx(20000), 20000]], fmtLog);
  ticksY(c, [[gy(100), 100], [gy(1000), 1000], [gy(6000), 6000]], fmtLog);

  /* the band, opening outward from the fitted cubic */
  if (open > 0) {
    const N = 44;
    ctx.save(); ctx.globalAlpha = 0.16 * open; ctx.fillStyle = P.accent;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const tx = i / N, lx = Math.log10(SIM.knee) + tx * (SIM.hiU - Math.log10(SIM.knee));
      const y = SIM.band.fit(lx) + SIM.band.half * open;
      i ? ctx.lineTo(c.px(tx), c.py(gy(Math.pow(10, y)))) : ctx.moveTo(c.px(tx), c.py(gy(Math.pow(10, y))));
    }
    for (let i = N; i >= 0; i--) {
      const tx = i / N, lx = Math.log10(SIM.knee) + tx * (SIM.hiU - Math.log10(SIM.knee));
      const y = SIM.band.fit(lx) - SIM.band.half * open;
      ctx.lineTo(c.px(tx), c.py(gy(Math.pow(10, y))));
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* the points */
  const items = [];
  for (const cell of SIM.s2) {
    const r = SIM.resid(cell), out = Math.abs(r) > SIM.band.half;
    const seed = ((cell.id * 2246822519) >>> 0) / 4294967296;
    let x = c.px(gx(cell.umi)), y = c.py(gy(cell.genes)), rad = 1.05 * u, alpha = 0.85 * show;

    if (out && go > 0) {
      const f = Math.max(0, Math.min(1, (go - seed * 0.30) / 0.70));
      if (r > 0) {
        /* under-amplified: shrinks to nothing and drifts up */
        rad = 1.05 * u * (1 - f);
        y -= f * 9 * u;
        alpha *= (1 - f);
      } else {
        /* over-amplified: swells, then bursts */
        const sw = f < 0.62 ? f / 0.62 : 1;
        const burst = f < 0.62 ? 0 : (f - 0.62) / 0.38;
        rad = 1.05 * u * (1 + sw * 2.6) * (1 - burst);
        alpha *= (1 - burst);
        if (burst > 0) {
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * Math.PI * 2 + seed * 6;
            items.push({
              x: x + Math.cos(ang) * burst * 7 * u,
              y: y + Math.sin(ang) * burst * 7 * u,
              r: 0.7 * u * (1 - burst), a: (1 - burst) * 0.8, cull: true
            });
          }
        }
      }
    }
    items.push({ x, y, r: Math.max(0, rad), a: Math.max(0, alpha), cull: out });
  }
  batch(c, items, it => (it.cull ? P.cull : P.keep));

  /* the fitted cubic, drawn through the cloud */
  if (fit > 0) {
    ctx.save();
    ctx.strokeStyle = P.ink; ctx.lineWidth = W.curve * u; ctx.lineCap = "round";
    ctx.beginPath();
    const N = 60;
    for (let i = 0; i <= N * fit; i++) {
      const tx = i / N, lx = Math.log10(SIM.knee) + tx * (SIM.hiU - Math.log10(SIM.knee));
      const X = c.px(tx), Y = c.py(gy(Math.pow(10, SIM.band.fit(lx))));
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.stroke(); ctx.restore();
  }

  /* two annotations, diagonally opposed — the tile's whole argument */
  if (t > 0.64) {
    const a = Math.min(1, (t - 0.64) * 6);
    ctx.save(); ctx.globalAlpha = a;
    const midT = 0.42, lx = Math.log10(SIM.knee) + midT * (SIM.hiU - Math.log10(SIM.knee));
    annotate(c, ["under-amplified", "thin out"],
      c.L + 3 * u, c.T + 7 * u,
      c.px(midT), c.py(gy(Math.pow(10, SIM.band.fit(lx) + SIM.band.half * 1.5))), P.cull);
    const t2 = 0.66, lx2 = Math.log10(SIM.knee) + t2 * (SIM.hiU - Math.log10(SIM.knee));
    /* Right-ALIGNED at the frame edge, not left-aligned at a guessed offset.
       "swell and burst" is 15 characters, which at label size is 41u wide —
       wider than the 32u of margin the first version left it, so it ran off
       the canvas. Anchoring to the edge cannot overflow whatever the string. */
    annotate(c, ["over-amplified", "swell and burst"],
      c.R, c.B - 13 * u,
      c.px(t2), c.py(gy(Math.pow(10, SIM.band.fit(lx2) - SIM.band.half * 1.5))), P.cull, "right");
    ctx.restore();
  }

  tileTitle(c, "04", "COMPLEXITY");
  bigNumber(c, "± " + SIM.band.K.toFixed(1) + " σ", "robust band · modelled", P.accent);
};

/* ============================================================
   05 · DOUBLETS — doublet_filter

   Two panels sharing the frame, split vertically.

   LEFT, top-down: pairs of real cells FROM DIFFERENT NEIGHBOURHOODS slide
   together, fuse, and drop into a reference pile. This is the part of
   scDblFinder nobody pictures — the classifier's training set being
   manufactured out of the data it will then be run against — and it gets half
   the runtime.

   RIGHT: the score distribution built from that reference, with the threshold
   where the singlets top out.

   Then back to the left panel, where flagged cells PULL APART into their two
   halves and drift in opposite directions. The gesture is separation, and it
   is unique to this tile: they were always two things.
   ============================================================ */
TILES.doublet = (c, t) => {
  const { ctx, u, P } = c;
  const MID = c.L + c.w * 0.52;

  const fuse = beat(t, 0.04, 0.50);        /* half the runtime, as briefed */
  const hist = ease.out(beat(t, 0.52, 0.68));
  const lock = beat(t, 0.68, 0.76);
  const split = ease.io(beat(t, 0.78, 0.95));

  ctx.save();
  ctx.strokeStyle = P.grid; ctx.lineWidth = W.hair * u;
  ctx.beginPath(); ctx.moveTo(MID, c.T); ctx.lineTo(MID, c.B); ctx.stroke();
  ctx.restore();

  /* ---- left: the embedding, and the manufacture of the reference ----
     The clusters are deliberately given LESS height than the panel has. A
     label must never sit on the thing it labels, and an embedding stretched
     to fill its panel leaves nowhere for one to go — the first version put
     "synthetic pairs from different neighbourhoods" straight across two
     clusters. Annotation space is not negotiable; the data yields. */
  const ex = v => c.L + 2 * u + v * (MID - c.L - 5 * u);
  const ey = v => c.T + 12 * u + v * (c.h - 24 * u);

  const flagged = SIM.s3.filter(cc => SIM.scoreOf.get(cc.id) >= SIM.ds.cut);
  const pts = [];
  for (const cell of SIM.s3) {
    const isFlag = SIM.scoreOf.get(cell.id) >= SIM.ds.cut;
    let x = ex(cell.ex), y = ey(cell.ey), a = 0.8, r = 0.95 * u;
    if (isFlag && split > 0) {
      /* pull apart: the two halves go opposite ways along the parent chord */
      const A = TYPES[cell.t1], Bt = TYPES[cell.t2 >= 0 ? cell.t2 : cell.t1];
      const dx = (Bt.ex - A.ex), dy = (Bt.ey - A.ey);
      const L2 = Math.hypot(dx, dy) || 1;
      const off = split * 7 * u;
      pts.push({ x: x - dx / L2 * off, y: y - dy / L2 * off, r: r * (1 - split * 0.45),
                 a: (1 - split) * 0.9, k: "cull" });
      pts.push({ x: x + dx / L2 * off, y: y + dy / L2 * off, r: r * (1 - split * 0.45),
                 a: (1 - split) * 0.9, k: "cull" });
      continue;
    }
    pts.push({ x, y, r, a, k: isFlag && lock > 0 ? "cull" : "keep" });
  }

  /* the pairs being fused, and the pile they fall into */
  const SHOW = 7;
  if (fuse > 0 && fuse < 1) {
    for (let i = 0; i < SHOW; i++) {
      const pr = SIM.ds.pairs[i * 13 % SIM.ds.pairs.length];
      if (!pr) continue;
      const local = Math.max(0, Math.min(1, (fuse * SHOW - i) / 1.6));
      if (local <= 0) continue;
      const [A, Bc] = pr;
      const meet = ease.io(Math.min(1, local * 1.7));
      const mx = ex((A.ex + Bc.ex) / 2), my = ey((A.ey + Bc.ey) / 2);
      const ax = ex(A.ex) + (mx - ex(A.ex)) * meet, ay = ey(A.ey) + (my - ey(A.ey)) * meet;
      const bx = ex(Bc.ex) + (mx - ex(Bc.ex)) * meet, by = ey(Bc.ey) + (my - ey(Bc.ey)) * meet;

      ctx.save();
      ctx.strokeStyle = P.accent; ctx.globalAlpha = 0.45 * (1 - meet * 0.5);
      ctx.lineWidth = W.hair * u;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();

      if (local < 1) {
        pts.push({ x: ax, y: ay, r: 1.5 * u, a: 0.95, k: "acc" });
        pts.push({ x: bx, y: by, r: 1.5 * u, a: 0.95, k: "acc" });
      } else {
        /* fused, and dropping into the reference pile along the foot */
        const drop = Math.min(1, (local - 1) * 2.5 + 0.001);
        const tx = c.L + 4 * u + ((i * 37) % 100) / 100 * (MID - c.L - 9 * u);
        pts.push({
          x: mx + (tx - mx) * ease.io(drop),
          y: my + (c.B - 3.5 * u - my) * ease.in_(drop),
          r: 1.7 * u, a: 0.95, k: "acc"
        });
      }
    }
  }
  /* the pile persists once built */
  if (fuse >= 1 || t > 0.50) {
    for (let i = 0; i < 22; i++) {
      const tx = c.L + 4 * u + ((i * 37) % 100) / 100 * (MID - c.L - 9 * u);
      pts.push({ x: tx, y: c.B - 3.5 * u - (i % 3) * 1.6 * u, r: 1.5 * u, a: 0.8, k: "acc" });
    }
  }

  batch(c, pts, it => (it.k === "cull" ? P.cull : it.k === "acc" ? P.accent : P.keep));

  /* ---- right: the score distribution ---- */
  const hx = v => MID + 5 * u + v * (c.R - MID - 7 * u);
  const BINS = 26, h = new Float64Array(BINS);
  SIM.ds.scores.forEach(s => h[Math.min(BINS - 1, Math.floor(s * BINS))]++);
  const hmax = Math.max(...h);
  if (hist > 0) {
    const bw = (c.R - MID - 7 * u) / BINS;
    for (let i = 0; i < BINS; i++) {
      const v = h[i] / hmax * hist;
      const above = (i + 0.5) / BINS >= SIM.ds.cut;
      ctx.fillStyle = above && lock > 0 ? P.cull : P.keep;
      ctx.globalAlpha = 0.75;
      const H = v * (c.h - 26 * u);
      ctx.fillRect(hx(i / BINS), c.B - 3 * u - H, bw * 0.82, H);
    }
    ctx.globalAlpha = 1;
    tracked(c, "DOUBLET SCORE", (MID + c.R) / 2, c.B + 4.6 * u, "axis", P.dim, "center", c.R - MID);
  }
  if (lock > 0) {
    ctx.save(); ctx.globalAlpha = ease.out(lock);
    ctx.strokeStyle = P.accent; ctx.lineWidth = W.stroke * u;
    ctx.setLineDash([2.2 * u, 1.8 * u]);
    const x = hx(SIM.ds.cut);
    ctx.beginPath(); ctx.moveTo(x, c.T + 6 * u); ctx.lineTo(x, c.B - 3 * u); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* Both annotations are confined to their own panel's width. A label
     right-aligned at the tile edge is 40u wide and would reach back across
     the divider into the other panel, which reads as one caption for two
     unrelated pictures. */
  if (t > 0.20 && t < 0.56) {
    const a = Math.min(1, (t - 0.20) * 6) * Math.min(1, (0.56 - t) * 6);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    annotate(c, ["synthetic pairs", "from different", "neighbourhoods"],
      c.L + 1.5 * u, c.T + 2.5 * u, ex(0.45), ey(0.18), P.accent);
    ctx.restore();
  }
  if (t > 0.80) {
    const a = Math.min(1, (t - 0.80) * 6);
    ctx.save(); ctx.globalAlpha = a;
    annotate(c, ["expected rate", "is technology-", "dependent"],
      c.R, c.T + 2.5 * u, hx(SIM.ds.cut), c.B - 16 * u, P.dim, "right");
    ctx.restore();
  }

  tileTitle(c, "05", "DOUBLETS");
  bigNumber(c, (100 * flagged.length / SIM.s3.length).toFixed(1) + "%",
    "flagged · modelled", P.accent);
};

/* ============================================================
   06 · FILTERED DGE — filtered_dge

   Survivors settle out of the drifting field into a regular cell-by-gene
   grid: rows resolve, sparse counts fade up as small marks. Everything culled
   sits behind at very low opacity, so the attrition stays legible rather than
   being quietly disappeared.

   The stacked bar breaks the losses out by reason, in the same four positions
   every time — knee, mito, complexity, doublets — so the bar can be read
   against the sequence above it.
   ============================================================ */
TILES.filtered = (c, t) => {
  const { ctx, u, P } = c;
  const settle = ease.io(beat(t, 0.04, 0.46));
  const fill = ease.out(beat(t, 0.44, 0.70));
  const barT = ease.out(beat(t, 0.62, 0.80));

  frameBox(c);

  /* The ghosts of everything culled, behind. They do not move and they do not
     change, so the list is built once per tile SIZE and cached — 13,600 fresh
     objects every frame was the single biggest allocation on the page, and
     KEPT_IDS replaced an `SIM.s4.includes(b)` that was 5.4 million
     comparisons per frame on top of it. */
  batch(c, ghostsFor(c), () => P.cull);

  /* the survivors settling into a matrix */
  const keep = SIM.s4;
  const COLS = Math.ceil(Math.sqrt(keep.length * 1.9));
  const ROWS = Math.ceil(keep.length / COLS);
  const gw = (c.w - 6 * u) / COLS, gh = (c.h - 22 * u) / ROWS;

  const items = [];
  keep.forEach((cell, i) => {
    const r = Math.floor(i / COLS), col = i % COLS;
    const gxp = c.L + 3 * u + (col + 0.5) * gw;
    const gyp = c.T + 3 * u + (r + 0.5) * gh;
    const fx0 = c.L + (0.02 + cell.x * 0.96) * c.w;
    const fy0 = c.T + (0.02 + cell.y * 0.96) * c.h;
    /* rows resolve in order, so the matrix assembles rather than snapping */
    const lag = (r / Math.max(ROWS - 1, 1)) * 0.45;
    const f = ease.io(Math.max(0, Math.min(1, (settle - lag) / (1 - lag))));
    items.push({
      x: fx0 + (gxp - fx0) * f, y: fy0 + (gyp - fy0) * f,
      r: (1.0 - 0.25 * f) * u, a: 0.55 + 0.45 * f
    });
  });
  batch(c, items, () => P.keep);

  /* sparse counts fading up inside the resolved matrix */
  if (fill > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * fill; ctx.fillStyle = P.keep;
    for (let i = 0; i < 220; i++) {
      const s = ((i * 2654435761) >>> 0) / 4294967296;
      const col = Math.floor(s * COLS), r = Math.floor((s * 977 % 1) * ROWS);
      ctx.fillRect(c.L + 3 * u + col * gw, c.T + 3 * u + r * gh, gw * 0.55, gh * 0.55);
    }
    ctx.restore();
  }

  /* THE LOSS BAR IS OVER THE CELLS, NOT OVER THE BARCODES.

     Including the knee in it made the bar 97% one segment with three
     invisible slivers after it, and the caption named four reasons you could
     not see. Worse, it conflated two different denominators: the knee removes
     EMPTY DROPLETS — things that were never cells — while mito, complexity
     and doublets remove cells. Putting them in one bar says they are the same
     kind of loss, and they are not.

     So the bar is the QC attrition over what the knee kept, where all three
     reasons are visible, and the knee's own cull stays where it belongs — as
     the headline of tile 02. */
  if (barT > 0) {
    const entered = SIM.s1.length;
    const parts = [["mito", SIM.lost.mito], ["cplx", SIM.lost.complexity],
                   ["dbl", SIM.lost.doublet]];
    const bx = c.L + 3 * u, by = c.B - 7 * u, bw = c.w - 6 * u, bh = 3.0 * u;
    let at = 0;
    ctx.save();
    parts.forEach(([, v], i) => {
      const wpx = v / entered * bw;
      ctx.fillStyle = P.cull; ctx.globalAlpha = barT * (0.90 - i * 0.20);
      ctx.fillRect(bx + at, by, Math.max(wpx - 0.4 * u, 0.4 * u), bh);
      at += wpx;
    });
    ctx.globalAlpha = barT;
    ctx.fillStyle = P.keep;
    ctx.fillRect(bx + at, by, Math.max(bw - at, 1), bh);
    tracked(c, "mito · cplx · dbl", bx, by - 2.2 * u, "tick", P.dim, "left", bw * 0.55);
    tracked(c, "of what the knee kept", bx + bw, by - 2.2 * u, "tick", P.keep, "right", bw * 0.42);
    ctx.restore();
  }

  if (t > 0.82) {
    const a = Math.min(1, (t - 0.82) * 6);
    ctx.save(); ctx.globalAlpha = a;
    tracked(c, "input to normalisation, not the end",
      c.L + 3 * u, c.B + 5.0 * u, "label", P.dim, "left", c.w);
    ctx.restore();
  }

  tileTitle(c, "06", "FILTERED DGE");
  bigNumber(c, fmtInt(toReal(SIM.s4.length)), "cells retained · modelled", P.keep);
};

const TILE_ORDER = ["raw", "knee", "mito", "complexity", "doublet", "filtered"];
