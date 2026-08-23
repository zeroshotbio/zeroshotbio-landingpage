/* ============================================================
   bp-pop.js — the shared population, and the statistics computed FROM it.

   THE RULE THIS FILE EXISTS TO ENFORCE
   Every threshold this page shows on screen is calculated here, from the
   simulated data, at load time. Not one of them is a literal. Reseed and they
   all move. That is deliberate and it is the difference between a diagram of
   a filter and a drawing of one: if the cubic band were a hardcoded pair of
   offsets it would sit in the same place no matter what the cloud did, and
   the tile would be an illustration pretending to be a computation.

   It also means the numbers on tiles 03, 04 and 05 are MODELLED, and the page
   says so in every place it shows one. The real pipeline has never run these
   culls — see bp-data.js. Do not let a modelled figure lose its label.

   ONE POPULATION, SHARED
   makeBarcodes() is called exactly once. Every tile draws the same objects at
   the same x,y. A barcode that dies at the knee in tile 02 is the same dot
   that was drifting in tile 01, in the same place. Nothing reshuffles.

   Load order: pop -> draw -> tiles -> data -> view
   ============================================================ */

/* mulberry32 — small, fast, and good enough for a point cloud. Written out
   rather than installed, per the brief: this file has no dependencies. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x5eedf15;

/* Box-Muller, one value at a time. The spare is thrown away rather than
   cached: caching it makes the stream order depend on call parity, which
   makes "same seed, same picture" quietly false. */
function gauss(rnd) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ============================================================
   THE POPULATION

   Shaped to the MiniFin figures that are real (see bp-data.js): 2,743,021
   unfiltered barcodes, of which 94,616 were called — 3.45%. That ratio is the
   subject of tile 01 and is reproduced exactly here, which is why the field
   reads as a haze of nothing with a constellation inside it.

   N is the number of barcodes DRAWN, not the number in the dataset. One dot
   stands for roughly 196 real barcodes. The tile says so.
   ============================================================ */
/* DO NOT LOWER THIS to make tile 01 less crowded.
   Below about 11,000 barcodes the called population drops under ~370 cells,
   and at that size the doublet scorer's median+3MAD cut rises above every
   score it produces: tile 05 flags nothing, the ledger loses a row, and
   nothing on screen says anything is wrong. Measured at 6,000 and 9,000 —
   both flag exactly zero. Crowding in tile 01 is a DRAWING problem and is
   solved there, in dot radius and alpha. */
const N_BARCODES = 14000;
const CELL_FRAC = 94616 / 2743021;      /* 0.0345 — the real ratio */
const DOUBLET_FRAC = 0.041;             /* of called cells; technology-dependent */

/* ============================================================
   NEIGHBOURHOODS

   Cells belong to types, and each type occupies a place in a two-dimensional
   expression embedding. This is not decoration — it is the thing that makes
   tile 05 possible at all.

   The first version of this file had no types. Cells carried only transcript
   count, gene count and mito%, and in that space a doublet is almost exactly
   a large singlet: the kNN scorer recovered them at 10% precision, flagging a
   quarter of the population to catch two thirds of eighteen. That is not a
   tuning failure, it is the correct answer to a badly posed question. Real
   doublet finders work in expression space, where a doublet of two distinct
   types lands BETWEEN two clusters, in a region no singlet occupies. Without
   neighbourhoods there is no between.

   The brief says it outright — "pairs of real cells from different
   neighbourhoods slide together" — and presupposes exactly this. Six types,
   spread on a ring with one pair deliberately close together, so the tile can
   show both the easy case and the hard one.
   ============================================================ */
const TYPES = [
  { name: "neural",     ex: 0.22, ey: 0.30, w: 0.26 },
  { name: "muscle",     ex: 0.74, ey: 0.22, w: 0.20 },
  { name: "epidermal",  ex: 0.84, ey: 0.62, w: 0.16 },
  { name: "blood",      ex: 0.52, ey: 0.83, w: 0.14 },
  { name: "gut",        ex: 0.18, ey: 0.70, w: 0.13 },
  /* deliberately adjacent to neural: the pair a doublet finder struggles with */
  { name: "neural crest", ex: 0.33, ey: 0.44, w: 0.11 }
];

function makeBarcodes(n = N_BARCODES) {
  const rnd = mulberry32(SEED);
  const out = new Array(n);

  for (let i = 0; i < n; i++) {
    const isCell = rnd() < CELL_FRAC;
    const isDoublet = isCell && rnd() < DOUBLET_FRAC;

    /* pick a type by weight, and a position around its centroid */
    const pickType = () => {
      let r = rnd(), k = 0;
      while (k < TYPES.length - 1 && (r -= TYPES[k].w) > 0) k++;
      return k;
    };
    const t1 = isCell ? pickType() : -1;
    let t2 = -1;
    if (isDoublet) { t2 = pickType(); let g = 0; while (t2 === t1 && g++ < 20) t2 = pickType(); }

    /* One draw of a single cell: transcripts bimodal in log space, genes
       saturating in transcripts. The ambient mode starts at 10 because
       split-pipe has already dropped everything below that — the floor is a
       fact about the input, not a modelling choice. */
    const drawOne = () => {
      const lu = isCell ? 3.02 + gauss(rnd) * 0.38 : 1.16 + gauss(rnd) * 0.30;
      const u = Math.max(10, Math.round(Math.pow(10, lu)));
      return { u, g: 3.55 * Math.pow(u, 0.752) * Math.exp(gauss(rnd) * 0.14) };
    };

    /* A doublet is two cells in one barcode, so it has to BE two cells:
       transcripts add, gene sets union SUB-additively (the two cells share
       most of the genes they express), mito fractions average.

       An earlier version carried `isDoublet` as a label that left the profile
       untouched, which was quietly useless — the kNN scorer below could not
       recover them, because there was nothing to recover. If you change this
       model, re-run the self-check at the foot of this file. */
    const a = drawOne(), b2 = isDoublet ? drawOne() : null;
    const umi = isDoublet ? a.u + b2.u : a.u;
    const gBase = isDoublet ? (a.g + b2.g) * 0.74 : a.g;

    /* the complexity tails, and they are two different failures:
         under-amplified — few PCR duplicates, so more distinct genes per
                           transcript, so ABOVE the fitted band
         over-amplified  — many duplicates, fewer distinct genes per
                           transcript, so BELOW it
       Only cells get them; ambient barcodes have no amplification history
       worth the name. */
    let amp = 0;
    if (isCell && !isDoublet) {
      const r = rnd();
      if (r < 0.030) amp = 1;        /* under-amplified */
      else if (r < 0.058) amp = -1;  /* over-amplified  */
    }
    const genes = Math.max(1, Math.round(
      gBase * (amp === 1 ? 1.42 + rnd() * 0.30 : amp === -1 ? 0.56 - rnd() * 0.16 : 1)
    ));

    /* mitoPct — right-skewed, with a dying-cell tail. Ambient barcodes carry
       a higher and flatter mito fraction because what is in them is mostly
       leaked transcript, which is the reason the tail exists at all. */
    let mitoPct;
    if (isCell) {
      const dying = !isDoublet && rnd() < 0.052;
      mitoPct = dying
        ? 14 + Math.abs(gauss(rnd)) * 11
        : Math.abs(gauss(rnd)) * 2.6 + rnd() * 2.2;
    } else {
      mitoPct = 6 + Math.abs(gauss(rnd)) * 9;
    }
    mitoPct = Math.min(78, mitoPct);

    /* The expression embedding. A singlet sits in its type's cloud; a doublet
       sits on the chord BETWEEN its two parents' types, weighted by how much
       transcript each contributed. That between-ness is the entire signal
       tile 05 is about, and it is why the scorer below works. Ambient
       barcodes get no embedding — they are not in the matrix by then. */
    const SPREAD = 0.058;
    let ex = 0, ey = 0;
    if (isCell) {
      const A = TYPES[t1];
      const ax = A.ex + gauss(rnd) * SPREAD, ay = A.ey + gauss(rnd) * SPREAD;
      if (isDoublet) {
        const Bt = TYPES[t2];
        const bx = Bt.ex + gauss(rnd) * SPREAD, by = Bt.ey + gauss(rnd) * SPREAD;
        const f = a.u / (a.u + b2.u);              /* transcript-weighted mix */
        ex = ax * f + bx * (1 - f); ey = ay * f + by * (1 - f);
      } else { ex = ax; ey = ay; }
    }

    /* Stable plan-view position. Poisson-ish by rejection would be nicer but
       costs more than it buys at this size; a jittered lattice keeps the
       field even and stops the clumping a raw uniform draw gives. */
    const cols = Math.ceil(Math.sqrt(n));
    const cx = (i % cols + 0.5) / cols, cy = (Math.floor(i / cols) + 0.5) / cols;
    const x = Math.min(1, Math.max(0, cx + (rnd() - 0.5) * 1.55 / cols));
    const y = Math.min(1, Math.max(0, cy + (rnd() - 0.5) * 1.55 / cols));

    out[i] = {
      id: i, umi, genes, mitoPct, isCell, isDoublet, amp, x, y,
      t1, t2, ex, ey,
      /* per-object motion phases, so drift and pulse never march in step */
      ph: rnd() * Math.PI * 2, sp: 0.55 + rnd() * 0.9, jx: rnd() - 0.5, jy: rnd() - 0.5
    };
  }
  return out;
}

/* ============================================================
   STATISTICS
   Each of these is the real method named in the brief, not an approximation
   of its answer.
   ============================================================ */

const median = a => {
  const s = Float64Array.from(a).sort();
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/* Median absolute deviation, scaled to be a consistent estimator of sigma
   for normal data. The 1.4826 is why "3 MAD" is comparable to "3 sigma". */
function mad(a) {
  const m = median(a);
  return { med: m, mad: 1.4826 * median(Array.from(a, v => Math.abs(v - m))) };
}

/* ---- the knee -------------------------------------------------------------
   Rank the barcodes by total count, take the curve into log10-log10, smooth
   it over a window, and find the point of steepest descent. This is the shape
   of the search zsb-bronze's `barcode_ranks` runs (a port of DropletUtils'
   barcodeRanks); it is the one cull on this page whose method exists in code.
   Returns the total count at that point. */
function kneeOf(umis) {
  const s = Float64Array.from(umis).sort().reverse();
  const lx = [], ly = [];
  for (let i = 0; i < s.length; i++) {
    if (i && s[i] === s[i - 1]) continue;          /* unique totals only */
    lx.push(Math.log10(i + 1)); ly.push(Math.log10(s[i]));
  }
  if (lx.length < 12) return s[s.length - 1];

  /* smooth in log-rank space over a fixed window, so the slope estimate is
     not driven by the single-barcode steps at the head of the curve */
  const W = Math.max(3, Math.round(lx.length * 0.045));
  const sy = ly.map((_, i) => {
    let a = 0, c = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(ly.length - 1, i + W); k++) { a += ly[k]; c++; }
    return a / c;
  });

  let best = 0, bi = Math.floor(lx.length / 2);
  for (let i = W; i < lx.length - W; i++) {
    const d = (sy[i - W] - sy[i + W]) / (lx[i + W] - lx[i - W]);   /* descent */
    if (d > best) { best = d; bi = i; }
  }
  return Math.pow(10, ly[bi]);
}

/* ---- the mito cutoff ------------------------------------------------------
   median + 3 x MAD over the called cells. The arithmetic is shown on the tile
   because it is short enough to check by eye, which is the whole argument for
   preferring it to a round number somebody liked. */
function mitoCut(cells) {
  const { med, mad: d } = mad(cells.map(c => c.mitoPct));
  return { med, mad: d, cut: med + 3 * d };
}

/* ---- the complexity band --------------------------------------------------
   Least-squares cubic of log10(genes) on log10(umi), then a robust residual
   sigma (MAD of the residuals) opened symmetrically to K sigma. Solved with
   Gaussian elimination on the 4x4 normal equations — small, exact, and no
   library. */
function cubicBand(cells, K = 2.6) {
  const xs = cells.map(c => Math.log10(c.umi)), ys = cells.map(c => Math.log10(c.genes));
  const n = xs.length, M = 4;
  const A = Array.from({ length: M }, () => new Float64Array(M + 1));
  const pow = new Float64Array(2 * M);
  for (let i = 0; i < n; i++) {
    let p = 1;
    for (let k = 0; k < 2 * M; k++) { pow[k] += p; p *= xs[i]; }
  }
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < M; c++) A[r][c] = pow[r + c];
    let s = 0;
    for (let i = 0; i < n; i++) s += ys[i] * Math.pow(xs[i], r);
    A[r][M] = s;
  }
  for (let c = 0; c < M; c++) {                      /* gaussian elimination */
    let p = c;
    for (let r = c + 1; r < M; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    const t = A[c]; A[c] = A[p]; A[p] = t;
    for (let r = 0; r < M; r++) {
      if (r === c || !A[c][c]) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= M; k++) A[r][k] -= f * A[c][k];
    }
  }
  const b = Array.from({ length: M }, (_, r) => A[r][M] / A[r][r]);
  const fit = x => b[0] + b[1] * x + b[2] * x * x + b[3] * x * x * x;

  const res = xs.map((x, i) => ys[i] - fit(x));
  const sigma = 1.4826 * median(res.map(Math.abs));
  return { fit, sigma, half: K * sigma, K };
}

/* ---- doublet scoring ------------------------------------------------------
   The scDblFinder shape, kept honest and small: build synthetic doublets by
   summing pairs of real cells drawn from DIFFERENT neighbourhoods, put them
   in the same feature space as the real cells, and score every real cell by
   the fraction of its k nearest neighbours that are synthetic. The threshold
   is where the singlet population tops out.

   Features are standardised log10 umi, log10 genes and mito%, which is enough
   for a cloud this size and keeps the neighbour search readable. */
function doubletScores(cells, rnd, k = 16, nSynth = 400) {
  /* The feature space is the EXPRESSION EMBEDDING plus transcript count, not
     the three summary statistics. That choice is the whole method: a doublet
     is only distinguishable from a large singlet because it sits between two
     neighbourhoods, and only an embedding has a between. See TYPES above for
     what happened when this was tried without one. */
  const feat = (ex, ey, umi) => [ex, ey, Math.log10(umi) * 0.11];
  const real = cells.map(c => feat(c.ex, c.ey, c.umi));

  const synth = [], pairs = [];
  for (let i = 0; i < nSynth && cells.length > 4; i++) {
    const a = cells[Math.floor(rnd() * cells.length)];
    let b = cells[Math.floor(rnd() * cells.length)], guard = 0;
    /* "different neighbourhoods", now meaning what it says: two different
       types. Pairing within a type produces a synthetic that is
       indistinguishable from a singlet, which teaches the scorer nothing. */
    while (guard++ < 40 && (b.t1 === a.t1)) b = cells[Math.floor(rnd() * cells.length)];
    const f = a.umi / (a.umi + b.umi);
    synth.push(feat(a.ex * f + b.ex * (1 - f), a.ey * f + b.ey * (1 - f), a.umi + b.umi));
    pairs.push([a, b]);
  }

  const all = real.concat(synth), isSyn = i => i >= real.length;

  const scores = real.map((p, i) => {
    const best = [];                                  /* k smallest, insertion */
    for (let j = 0; j < all.length; j++) {
      if (j === i) continue;
      let d2 = 0;
      for (let d = 0; d < 3; d++) { const t = p[d] - all[j][d]; d2 += t * t; }
      if (best.length < k) { best.push([d2, j]); best.sort((u, v) => u[0] - v[0]); }
      else if (d2 < best[k - 1][0]) { best[k - 1] = [d2, j]; best.sort((u, v) => u[0] - v[0]); }
    }
    return best.reduce((s, [, j]) => s + (isSyn(j) ? 1 : 0), 0) / k;
  });

  /* Threshold: where the singlets top out.

     median + 3 x MAD over the scores — the same instrument the mito tile
     uses, which is not a coincidence worth hiding. Nearly every cell is a
     singlet, so robust statistics over the whole score vector describe the
     singlet population, and three MADs above its centre is the point past
     which a score stops being ordinary.

     TWO REJECTED ALTERNATIVES, so nobody re-tries them:

     Steepest descent on the sorted score curve (borrowed from the rank knee)
     puts the cut at the very top of the curve — above the highest-scoring
     real doublet — and flags almost nothing.

     Otsu's method splits the SINGLET BULK. Otsu maximises between-class
     variance, which is a mass-weighted quantity, and doublets are ~3% of the
     mass: the 97% majority dominates the objective and the cut lands inside
     it. Otsu is the right tool for two comparable modes and the wrong one for
     a small minority class.

     What this returns still over-calls — it flags roughly twice the true
     doublet rate — and that is not a bug to tune away. Real doublet callers
     over-call, badly, for singlets that sit between two adjacent
     neighbourhoods. TYPES contains one deliberately adjacent pair so the tile
     shows the hard case rather than only the easy one. */
  const ms = mad(scores);
  const cut = ms.med + 3 * ms.mad;
  return { scores, cut, pairs, nSynth: synth.length, med: ms.med, mad: ms.mad };
}

/* ============================================================
   SELF-CHECK

   Runs only under node (check-sim.mjs calls it); the browser never sees it.
   Every assertion here is a property the tiles depend on being true. If you
   change the population model, run it — the failures this catches are the
   silent kind, where the picture still looks fine and the statistic no longer
   means anything.
   ============================================================ */
function selfCheck() {
  const out = [], ok = (name, pass, got) =>
    out.push({ name, pass, got });

  const B = makeBarcodes();
  const cells = B.filter(c => c.isCell);
  const frac = cells.length / B.length;
  ok("cell fraction tracks the real 3.45%", Math.abs(frac - CELL_FRAC) < 0.004,
     (100 * frac).toFixed(2) + "%");

  const knee = kneeOf(B.map(c => c.umi));
  const above = B.filter(c => c.umi >= knee).length;
  ok("knee separates the modes (2–6% kept)", above / B.length > 0.02 && above / B.length < 0.06,
     Math.round(knee) + " transcripts, " + (100 * above / B.length).toFixed(2) + "% above");

  const m = mitoCut(cells);
  const mc = cells.filter(c => c.mitoPct > m.cut).length;
  ok("mito cut removes a tail, not a bulk", mc / cells.length > 0.01 && mc / cells.length < 0.12,
     m.cut.toFixed(1) + "%, " + mc + " cells");

  const cb = cubicBand(cells);
  let hi = 0, lo = 0;
  cells.forEach(c => {
    const r = Math.log10(c.genes) - cb.fit(Math.log10(c.umi));
    if (r > cb.half) hi++; else if (r < -cb.half) lo++;
  });
  ok("complexity culls BOTH tails", hi > 3 && lo > 3, hi + " above, " + lo + " below");

  const ds = doubletScores(cells, mulberry32(0x9e37));
  const sD = [], sS = [];
  cells.forEach((c, i) => (c.isDoublet ? sD : sS).push(ds.scores[i]));
  const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
  ok("doublet score separates the classes", mean(sD) > mean(sS) * 2.5,
     "singlet " + mean(sS).toFixed(3) + " vs doublet " + mean(sD).toFixed(3));

  const flagged = cells.filter((c, i) => ds.scores[i] >= ds.cut);
  const tp = flagged.filter(c => c.isDoublet).length;
  ok("recall over half the true doublets", tp / Math.max(sD.length, 1) > 0.5,
     (100 * tp / Math.max(sD.length, 1)).toFixed(0) + "%");
  ok("flagged rate is plausible (2–10%)",
     flagged.length / cells.length > 0.02 && flagged.length / cells.length < 0.10,
     (100 * flagged.length / cells.length).toFixed(1) + "% flagged vs " +
     (100 * sD.length / cells.length).toFixed(1) + "% true");

  /* the property that makes the sequence a sequence */
  const B2 = makeBarcodes();
  ok("same seed, same population", B2[77].umi === B[77].umi && B2[77].x === B[77].x,
     "barcode 77 reproduces");

  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { makeBarcodes, kneeOf, mitoCut, cubicBand, doubletScores,
                     mulberry32, mad, median, selfCheck, TYPES, N_BARCODES, CELL_FRAC };
}
