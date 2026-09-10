/* pt-terrain.js — Plate IV, the terrain, over ChemFish's own window.
 *
 * Time runs DOWN the page, 36 hpf at the top rule to 72 at the bottom, after
 * /fate_map_wang_2026 Plate II. The horizontal axis is one axis of the wild-type
 * embedding, switchable, exactly as that plate switches between two spherical
 * coordinates — the two are the first and second principal directions of the
 * SAME projection, so they are two cuts through one space, not two spaces.
 *
 * THE AXIS IS BROKEN, ON PURPOSE. ZSCAPE samples 36, 38, 40, 42, 44, 46, 48 and
 * then nothing until 72. So the plate draws a continuous range from 36 to 48, a
 * labelled BREAK across twenty-four hours nobody sampled, and then the single
 * far ridge of 72 hpf. Nothing is interpolated across the gap.
 *
 * THE SURFACE IS DENSITY, INVERTED. Elevation blends the within-hour RANK of
 * wild-type cell density with the within-hour normalised density, so the surface
 * RISES where few cells are and DIPS where many are. A rank because two attempts
 * on the raw log density rendered as ruled lines; the density term because a rank
 * alone is uniform by construction and gave every valley the same depth. Both
 * terms fall as density rises, so the blend is monotone and every ordering claim
 * holds, but a valley twice as deep does not hold twice as many cells. Cells sit
 * in the valleys, which is the Waddington convention and the reason the word
 * "channel" means anything here.
 *
 * IT IS AN INTERPRETIVE RENDERING AND NOT A MEASUREMENT OF ANYTHING PHYSICAL.
 * Not anatomy. Not a tracked lineage. No cell rolls down it, no cell crosses a
 * ridge, and the height of a ridge is not an energy, a barrier or a probability.
 * What is real underneath it is a count of cells per bin per hour, normalised
 * within the hour — nothing more.
 *
 * THREE LAYERS SIT ON THE SURFACE, drawn as landscape rather than as marks on
 * top of landscape, because the metaphor is the argument:
 *
 *   channels     dotted routes: a state's centroid on this axis at each hour.
 *   water        the valleys below the waterline are tinted by how hard ANY drug
 *                moves that basin. The tint comes from the eight drug arms; the
 *                terrain under it is wild type and knows nothing about it.
 *   deformation  when one drug is chosen, the hours ChemFish measures are re-cut:
 *                the profile is displaced by the log ratio of drug and vehicle
 *                occupancy along the axis, wild type left behind as a ghost.
 *
 * Per PLATE_STYLE.md §1.1 the mass is one ink and density does the work. The
 * colour budget is spent in exactly one place — the water — and madder stays
 * reserved for the channel you chose.
 */
(function (global) {
  'use strict';

  const INK = '#2b2219', INK2 = '#5f5344', INK3 = '#8b7d69';
  const RULE = '#c3b6a0', RULE2 = '#d9cfbb', PAPER = '#f3ede1', SELECT = '#8f2d16';
  /* The top margin has to clear the relief itself: a profile rises by up to
   * AMP row-spacings above its own row. The bottom margin carries the keys. */
  const M = { l: 66, r: 92, t: 104, b: 58 };
  const NROWS = 112;            /* interpolated profiles across the sampled run */
  const AMP = 11.0;             /* relief height, in row spacings               */
  /* Aerial perspective: the near ridges are inked harder than the far ones. It
   * is a drawing convention and carries no number — the data is entirely in the
   * shape of the profiles, which are all drawn at the same scale. */
  const FAR = 0.14, NEAR = 0.34;

  /* The broken axis, as fractions of the plot height. */
  const SEG_A = 0.70;           /* the continuously sampled run, top to bottom  */
  const Y_LATE = 0.97;          /* where the single late ridge sits             */

  /* Water. The elevation field is a rank blended with a normalised density, so a
   * waterline at 0.38 is close to "the densest 38% of the axis at this hour" and
   * needs no calibration. */
  const WATERLINE = 0.38;

  /* Deformation. One log2 fold of compositional change displaces the surface by
   * DEF_PER_LOG2 elevation units; beyond DEF_CLIP the displacement saturates so
   * a single thin state cannot punch through the relief. */
  const DEF_PER_LOG2 = 0.26, DEF_CLIP = 1.8;
  /* ChemFish measures at whole hours. The deformation is applied to a band
   * BAND_HPF either side of a measured hour and to nothing else, with a short
   * feather for the antialiasing only. The hard edge is deliberate: it is where
   * the measurement is. */
  const BAND_HPF = 0.9, FEATHER_HPF = 0.35;

  /* The diverging ramp, drawn from PLATE_STYLE.md's categorical set: paper-deep
   * through verdigris to indigo on the cool side, through ochre to the madder
   * TINT (t0) on the warm side. --select itself is not in it. */
  const RAMP_WARM = [[234, 226, 210], [176, 128, 44], [168, 68, 42]];
  const RAMP_COOL = [[234, 226, 210], [61, 111, 104], [87, 104, 138]];

  /* t in [-1, 1]; alpha given explicitly so the caller can fade the colour out
   * with the depth of the valley it is sitting in. */
  function ramp(t, alpha) {
    const a = Math.min(1, Math.abs(t)), R = t >= 0 ? RAMP_WARM : RAMP_COOL;
    const u = a * 2, i = u < 1 ? 0 : 1, w = u < 1 ? u : Math.min(1, u - 1);
    const c0 = R[i], c1 = R[i + 1];
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * w);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * w);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * w);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, alpha).toFixed(3) + ')';
  }
  const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function make(canvas, hold, T, onPick) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, anim = 0;
    let axis = 'e1', sel = -1, drug = null, showShared = true, hour = null;
    /* the view: a scale about the plot's top-left plus a pan, both in screen px.
     * Current and target are separate so the wheel can ease rather than jump. */
    let k = 1, panX = 0, panY = 0;
    let kT = 1, panXT = 0, panYT = 0;
    let dragging = false;

    const stages = T.stages;
    const NX = T.nx;
    const GAP = T.gap || null;                       /* [48, 72] */
    /* the continuously sampled run is everything up to the gap */
    const RUN = GAP ? stages.filter((h) => h <= GAP[0]) : stages.slice();
    const LATE = GAP ? stages.filter((h) => h > GAP[0]) : [];
    const H0 = RUN[0], H1 = RUN[RUN.length - 1];
    const CFH = (T.chemfish && T.chemfish.hours) || [];

    /* Interpolate the sampled hours of the run to NROWS drawing rows, then add
     * one row per late hour. Linear, and only between real hours — nothing is
     * extrapolated and nothing crosses the gap. */
    function rows() {
      const E = T.fields[axis].elev;
      const out = [];
      for (let r = 0; r < NROWS; r++) {
        const u = (r / (NROWS - 1)) * (RUN.length - 1);
        const i = Math.min(RUN.length - 2, Math.floor(u)), w = u - i;
        const a = E[i], b = E[i + 1], v = new Float32Array(NX);
        for (let j = 0; j < NX; j++) v[j] = a[j] * (1 - w) + b[j] * w;
        out.push({ hpf: H0 + (r / (NROWS - 1)) * (H1 - H0), v: v, late: false, i: r });
      }
      LATE.forEach((h) => {
        out.push({ hpf: h, v: Float32Array.from(E[stages.indexOf(h)]), late: true, i: out.length });
      });
      return out;
    }
    let R = rows();

    const plotW = () => W - M.l - M.r;
    const plotH = () => H - M.t - M.b;

    /* layout coordinates, before the view transform. The y map is PIECEWISE:
     * linear across the sampled run, then a break, then the late ridge. */
    const lHourY = (h) => {
      if (h <= H1) return M.t + ((h - H0) / (H1 - H0)) * SEG_A * plotH();
      return M.t + Y_LATE * plotH();
    };
    const lColX = (j) => M.l + (j / (NX - 1)) * plotW();
    const lWx = (v) => {
      const f = T.fields[axis];
      return M.l + ((v - f.lo) / (f.hi - f.lo)) * plotW();
    };
    /* view transform. Applied to positions only — never to a line width, so the
     * engraving keeps its weight at every zoom. */
    const tx = (x) => M.l + (x - M.l) * k + panX;
    const ty = (y) => M.t + (y - M.t) * k + panY;
    const colX = (j) => tx(lColX(j));
    const hourY = (h) => ty(lHourY(h));
    const wx = (v) => tx(lWx(v));

    function clampTarget() {
      const pw = plotW(), ph = plotH();
      panXT = clamp(panXT, pw * (1 - kT), 0);
      panYT = clamp(panYT, ph * (1 - kT), 0);
    }
    /* Ease toward the target rather than snapping to it. The first cut applied
     * the wheel straight to the scale, which at one notch per 22% was both too
     * coarse and visibly steppy. */
    function tick() {
      const dk = kT - k, dx = panXT - panX, dy = panYT - panY;
      if (Math.abs(dk) < 0.0015 && Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
        k = kT; panX = panXT; panY = panYT; anim = 0; paint(); return;
      }
      k += dk * 0.26; panX += dx * 0.26; panY += dy * 0.26;
      paint();
      anim = requestAnimationFrame(tick);
    }
    function run() { if (!anim) anim = requestAnimationFrame(tick); }

    function zoomTo(nk, mx, my) {
      nk = clamp(nk, 1, 9);
      /* keep the point under the cursor fixed, measured against the TARGET */
      const lx = (mx - M.l - panXT) / kT, ly = (my - M.t - panYT) / kT;
      kT = nk;
      panXT = mx - M.l - lx * kT;
      panYT = my - M.t - ly * kT;
      clampTarget(); run();
    }
    function resetView() { kT = 1; panXT = 0; panYT = 0; run(); }

    /* ---- the ChemFish fields, as functions of hour and column ------------- */
    const F = () => T.fields[axis] || {};
    function sharedHours() {
      const sf = F().sfield;
      return sf ? Object.keys(sf).map(Number).sort((a, b) => a - b) : [];
    }
    /* a per-hour field, interpolated between the measured hours and NOT extended
     * above the first of them */
    function fieldAt(obj, h) {
      const hs = sharedHours();
      if (!obj || !hs.length) return null;
      if (h < hs[0] - 1e-9) return null;
      if (h >= hs[hs.length - 1]) return obj[String(hs[hs.length - 1])];
      for (let i = 0; i < hs.length - 1; i++) {
        if (h >= hs[i] && h <= hs[i + 1]) {
          const a = obj[String(hs[i])], b = obj[String(hs[i + 1])];
          if (!a || !b) return null;
          const w = (h - hs[i]) / (hs[i + 1] - hs[i]);
          const out = new Float32Array(NX);
          for (let j = 0; j < NX; j++) out[j] = a[j] * (1 - w) + b[j] * w;
          return out;
        }
      }
      return null;
    }
    /* ChemFish covers well under half this axis. Where it does not, the valley
     * is left DRY rather than flooded with a neutral colour, so the water's
     * footprint is the measurement's footprint and nothing more. */
    const COV_MIN = 0.02;

    /* the strength scale for the tint: the 98th percentile of |score| over every
     * measured hour, so the ramp uses its full range without one outlier state
     * setting it. */
    let SREF = 1;
    function calcSref() {
      const sf = F().sfield;
      if (!sf) { SREF = 1; return; }
      const all = [];
      Object.values(sf).forEach((v) => v.forEach((x) => all.push(Math.abs(x))));
      all.sort((a, b) => a - b);
      SREF = Math.max(0.3, all.length ? all[Math.floor(all.length * 0.98)] : 1);
    }
    calcSref();

    function bandWeight(h) {
      let best = 0, bh = null;
      for (let i = 0; i < CFH.length; i++) {
        const d = Math.abs(h - CFH[i]);
        let w = 0;
        if (d <= BAND_HPF) w = 1;
        else if (d <= BAND_HPF + FEATHER_HPF) {
          w = 0.5 + 0.5 * Math.cos(Math.PI * (d - BAND_HPF) / FEATHER_HPF);
        }
        if (w > best) { best = w; bh = CFH[i]; }
      }
      return { w: best, hour: bh };
    }
    function deformAt(h) {
      if (!drug) return null;
      const df = F().dfield;
      if (!df || !df[drug]) return null;
      const bw = bandWeight(h);
      if (bw.w <= 0.001 || bw.hour === null) return null;
      if (hour !== null && bw.hour !== hour) return null;
      const L = df[drug][String(bw.hour)];
      if (!L) return null;
      const out = new Float32Array(NX);
      for (let j = 0; j < NX; j++) {
        const c = clamp(L[j], -DEF_CLIP, DEF_CLIP);
        /* enriched (L > 0) means MORE cells, and more cells is LOWER ground */
        out[j] = -c * DEF_PER_LOG2 * bw.w;
      }
      return out;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hold.clientWidth; H = hold.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clampTarget(); k = kT; panX = panXT; panY = panYT;
      draw();
    }
    function draw() {
      if (raf || anim) return;
      raf = requestAnimationFrame(() => { raf = 0; paint(); });
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);
      const rs = (SEG_A * plotH() / (NROWS - 1)) * k, amp = rs * AMP;
      const sHours = sharedHours();
      /* the drawing rows that land on a measured ChemFish hour. Only these carry
       * the ghost line and the inked sliver; the rest of the band is displaced
       * but drawn plainly, or eleven identical slivers stack into an opaque
       * block and the plate loses its relief exactly where it matters. */
      const keyRows = {};
      CFH.forEach((mh) => {
        let bi = -1, bd = 1e9;
        R.forEach((row, i) => {
          const d = Math.abs(row.hpf - mh);
          if (d < bd) { bd = d; bi = i; }
        });
        if (bi >= 0 && bd < 1.5) keyRows[bi] = true;
      });

      ctx.save();
      ctx.beginPath();
      ctx.rect(M.l - 1, 24, plotW() + 2, H - M.b - 24 + 1);
      ctx.clip();

      /* ---- the relief ----------------------------------------------------
       * Far rows first. Each profile is filled with paper down to the next row,
       * so it hides the one behind it and the stack gains depth without a single
       * fabricated shadow. */
      for (let r = 0; r < R.length; r++) {
        const row = R[r], v = row.v, h = row.hpf, y0 = hourY(h);
        if (y0 < 24 - amp * 1.3 || y0 > H - M.b + rs * 9) continue;
        const dz = deformAt(h);
        const keyRow = (dz && keyRows[r]) ? r : -1;
        const vd = dz ? new Float32Array(NX) : v;
        if (dz) for (let j = 0; j < NX; j++) vd[j] = clamp(v[j] + dz[j], 0, 1.2);
        const bottom = y0 + rs * (row.late ? 10 : 6);

        ctx.beginPath();
        ctx.moveTo(colX(0), y0 - vd[0] * amp);
        for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - vd[j] * amp);
        ctx.lineTo(colX(NX - 1), bottom);
        ctx.lineTo(colX(0), bottom);
        ctx.closePath();
        ctx.fillStyle = PAPER; ctx.globalAlpha = 1; ctx.fill();

        /* ---- water -------------------------------------------------------
         * Tint the ground below the waterline by the shared drug response.
         *
         * Filled over the SAME polygon as the paper above, and for the same
         * reason: the nearer rows then paint over all of it but the strip that
         * belongs to this row, so the colour survives as a ribbon hugging the
         * surface instead of as a stack of overlapping bands. Masked by the
         * gradient's own ALPHA rather than by clipping — cutting the fill at a
         * threshold gave hard vertical edges and the tint read as a rectangular
         * stain rather than as something lying in a valley. */
        if (showShared && sHours.length) {
          const S = fieldAt(F().sfield, h), CV = fieldAt(F().cov, h);
          if (S && CV) {
            const grad = ctx.createLinearGradient(colX(0), 0, colX(NX - 1), 0);
            for (let q = 0; q <= 80; q++) {
              const j = Math.round((q / 80) * (NX - 1));
              const depth = smooth((WATERLINE - vd[j]) / (WATERLINE * 0.75));
              const covF = smooth((CV[j] - COV_MIN) / 0.06);
              const str = Math.min(1, Math.abs(S[j]) / SREF);
              grad.addColorStop(q / 80, ramp(S[j] / SREF, (0.16 + 0.78 * str) * depth * covF));
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(colX(0), y0 - vd[0] * amp);
            for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - vd[j] * amp);
            ctx.lineTo(colX(NX - 1), bottom);
            ctx.lineTo(colX(0), bottom);
            ctx.closePath();
            ctx.globalAlpha = 1; ctx.fill();
          }
        }

        /* ---- deformation -------------------------------------------------
         * The wild-type line is left behind as a ghost and the sliver between
         * the two is inked, so the AREA between them is the size of the change.
         * Deepening gets hachures as well, which is the engraver's way of
         * saying a face was cut. */
        if (keyRow === r) {
          ctx.beginPath();
          ctx.moveTo(colX(0), y0 - v[0] * amp);
          for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - v[j] * amp);
          for (let j = NX - 1; j >= 0; j--) ctx.lineTo(colX(j), y0 - vd[j] * amp);
          ctx.closePath();
          ctx.fillStyle = INK; ctx.globalAlpha = 0.17; ctx.fill();

          ctx.beginPath();
          ctx.moveTo(colX(0), y0 - v[0] * amp);
          for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - v[j] * amp);
          ctx.strokeStyle = INK2; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.7;
          ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);

          if (!dragging) {
            ctx.beginPath();
            for (let j = 1; j < NX; j += 2) {
              if (dz[j] >= -0.012) continue;              /* only where it deepens */
              ctx.moveTo(colX(j), y0 - v[j] * amp);
              ctx.lineTo(colX(j), y0 - vd[j] * amp);
            }
            ctx.strokeStyle = INK; ctx.globalAlpha = 0.34; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }

        /* the profile itself. Every fifth row is inked a little darker so the
         * stack has a rhythm to it rather than reading as a solid wash. */
        ctx.beginPath();
        ctx.moveTo(colX(0), y0 - vd[0] * amp);
        for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - vd[j] * amp);
        ctx.strokeStyle = INK;
        const near = FAR + (NEAR - FAR) * (r / (R.length - 1));
        ctx.globalAlpha = row.late ? 0.62 : (near + ((r % 5 === 0) ? 0.18 : 0));
        ctx.lineWidth = row.late ? 1.0 : ((r % 5 === 0) ? 0.85 : 0.6);
        ctx.stroke();

        /* The measured profile is inked hard, but ONLY across the part of the
         * axis ChemFish actually reached. Run bold from edge to edge it claimed
         * a measurement everywhere. */
        if (keyRow === r) {
          const CVk = fieldAt(F().cov, h);
          ctx.strokeStyle = INK; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.2;
          ctx.beginPath();
          let go = false;
          for (let j = 0; j < NX; j++) {
            if (CVk && CVk[j] < COV_MIN) { go = false; continue; }
            const X = colX(j), Y = y0 - vd[j] * amp;
            go ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
            go = true;
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      /* ---- hachures: short strokes down the steep faces -------------------
       * The engraver's way of showing slope, and the whole texture budget of
       * this plate. Furniture-adjacent but computed from the field, never
       * jittered. Dropped mid-drag, where they cost more than they say. */
      if (!dragging) {
        ctx.strokeStyle = INK; ctx.globalAlpha = 0.15; ctx.lineWidth = 0.5;
        ctx.beginPath();
        const hstep = Math.max(1, Math.round(2 / Math.sqrt(k)));
        for (let r = 0; r < R.length; r += hstep) {
          const row = R[r], v = row.v, y0 = hourY(row.hpf);
          if (y0 < 24 - amp * 1.3 || y0 > H - M.b + rs * 9) continue;
          for (let j = 2; j < NX - 2; j += hstep) {
            const g = Math.abs(v[j + 2] - v[j - 2]);
            if (g < 0.040) continue;
            const len = Math.min(rs * 2.8, g * amp * 1.1);
            const x = colX(j), y = y0 - v[j] * amp;
            ctx.moveTo(x, y); ctx.lineTo(x, y + len);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* ---- wild-type channels --------------------------------------------
       * A state's route down the page: its centroid on this axis at each hour.
       * Drawn dotted for the same reason Plate III's trail is — it is not a path
       * anything travelled. The line BREAKS at the gap; joining 48 to 72 would
       * draw a route through twenty-four unsampled hours. */
      const useY = axis === 'e1' ? 0 : 1;
      ctx.setLineDash([2, 3]);
      T.channels.forEach((ch, ci) => {
        const on = sel === ci;
        ctx.strokeStyle = on ? SELECT : INK2;
        ctx.globalAlpha = on ? 0.95 : 0.30;
        ctx.lineWidth = on ? 1.5 : 0.7;
        ctx.beginPath();
        let go = false;
        ch.pts.forEach((p, ti) => {
          const h = stages[ti];
          if (!p) { go = false; return; }
          if (GAP && h > GAP[0] && go) go = false;      /* break across the gap */
          const X = wx(p[useY]), Y = hourY(h);
          go ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          go = true;
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      if (sel >= 0) {
        T.channels[sel].pts.forEach((p, ti) => {
          if (!p) return;
          ctx.beginPath();
          ctx.arc(wx(p[useY]), hourY(stages[ti]), 2.6, 0, Math.PI * 2);
          ctx.fillStyle = SELECT; ctx.globalAlpha = 1; ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* ---- the break ------------------------------------------------------
       * Twenty-four hours ZSCAPE never sampled, drawn rather than hidden. */
      if (LATE.length) {
        const yA = hourY(H1) + rs * 1.5, yB = hourY(LATE[0]) - amp * 1.15;
        if (yB > yA + 14) {
          ctx.strokeStyle = RULE2; ctx.lineWidth = 0.8; ctx.globalAlpha = 1;
          [yA, yB].forEach((Y) => {
            ctx.beginPath();
            for (let x = M.l; x < W - M.r; x += 9) {
              ctx.moveTo(x, Y + 3); ctx.lineTo(x + 5, Y - 3);
            }
            ctx.stroke();
          });
          ctx.font = 'italic 11px "Iowan Old Style", Palatino, Georgia, serif';
          ctx.fillStyle = INK3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(GAP[0] + ' to ' + GAP[1] + ' hpf — ' + (GAP[1] - GAP[0])
            + ' hours ZSCAPE does not sample', (M.l + W - M.r) / 2, (yA + yB) / 2);
          ctx.textAlign = 'left';
        }
      }

      /* ---- furniture ------------------------------------------------------ */
      ctx.strokeStyle = RULE; ctx.lineWidth = 0.8; ctx.globalAlpha = 1;
      ctx.beginPath();
      [H0, H1].concat(LATE).forEach((h) => {
        const Y = hourY(h);
        if (Y < M.t - 0.5 || Y > H - M.b + 0.5) return;
        ctx.moveTo(M.l, Y); ctx.lineTo(W - M.r, Y);
      });
      ctx.stroke();
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = INK3; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      stages.forEach((h) => {
        const Y = hourY(h);
        if (Y < M.t - 2 || Y > H - M.b + 2) return;
        ctx.strokeStyle = RULE2; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(M.l - 6, Y); ctx.lineTo(M.l - 2, Y); ctx.stroke();
        ctx.globalAlpha = 1;
        if (h % 4 === 0 || h === H0 || h === stages[stages.length - 1]) {
          ctx.fillText(h + (h === H0 ? ' hpf' : ''), M.l - 10, Y);
        }
      });
      /* the measured bands, bracketed in the margin where the deformation is */
      if (drug) {
        ctx.strokeStyle = INK2; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2;
        CFH.forEach((mh) => {
          const a = clamp(hourY(mh - BAND_HPF), M.t, H - M.b);
          const b = clamp(hourY(mh + BAND_HPF), M.t, H - M.b);
          if (b - a < 1.5) return;
          ctx.beginPath();
          ctx.moveTo(M.l - 3, a); ctx.lineTo(M.l - 6, a);
          ctx.lineTo(M.l - 6, b); ctx.lineTo(M.l - 3, b);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }

      /* ---- the diversity gauge, in the right margin -----------------------
       * The range does NOT widen with time, and this is why: x is a fixed
       * embedding coordinate, so the width of the plate is fixed by
       * construction. What could have grown is the number of distinct states,
       * so it is measured and drawn here instead of stretched into the relief.
       * The effective count — exp(Shannon entropy) of the state fractions — is
       * the honest one; the raw count rises with sampling depth as much as with
       * biology. */
      if (T.diversity && T.diversity.length) {
        const maxE = Math.max.apply(null, T.diversity.map((d) => d.effective_states));
        const gx = W - M.r + 12, gw = M.r - 46;
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = INK3; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('states', gx, M.t - 16);
        ctx.fillText('(effective)', gx, M.t - 6);
        ctx.textBaseline = 'middle';
        T.diversity.forEach((d) => {
          const Y = hourY(d.hpf);
          if (Y < M.t - 2 || Y > H - M.b + 2) return;
          const w2 = (d.effective_states / maxE) * gw;
          ctx.fillStyle = INK2; ctx.globalAlpha = 0.30;
          ctx.fillRect(gx, Y - 2.2, w2, 4.4);
          ctx.globalAlpha = 1;
        });
        const first = T.diversity[0], last = T.diversity[T.diversity.length - 1];
        ctx.fillStyle = INK3;
        [first, last].forEach((d) => {
          const Y = hourY(d.hpf);
          if (Y < M.t - 2 || Y > H - M.b + 2) return;
          ctx.fillText(Math.round(d.effective_states), gx + gw + 3, Y);
        });
      }

      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = 'italic 11px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.fillStyle = INK3;
      ctx.fillText('high ground — few cells', M.l + 2, 8);
      ctx.textAlign = 'right';
      ctx.fillText('valley floor — where cells accumulate', W - M.r - 2, 8);

      /* ---- the keys, along the bottom margin ------------------------------ */
      const kyT = H - M.b + 13;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      let kx = M.l;
      if (showShared && sHours.length) {
        const bw = 84, by = kyT + 6;
        ctx.fillStyle = INK3; ctx.textAlign = 'right';
        ctx.fillText('loses cells', kx + 56, by);
        ctx.textAlign = 'left';
        const gx = kx + 62;
        const g2 = ctx.createLinearGradient(gx, 0, gx + bw, 0);
        for (let q = 0; q <= 20; q++) {
          const t = (q / 10) - 1;
          g2.addColorStop(q / 20, ramp(t, 0.16 + 0.78 * Math.abs(t)));
        }
        ctx.fillStyle = g2; ctx.fillRect(gx, by - 5, bw, 10);
        ctx.strokeStyle = RULE2; ctx.lineWidth = 0.6; ctx.strokeRect(gx, by - 5, bw, 10);
        ctx.fillStyle = INK3;
        ctx.fillText('gains cells', gx + bw + 6, by);
        ctx.font = 'italic 10.5px "Iowan Old Style", Palatino, Georgia, serif';
        ctx.fillStyle = INK2;
        ctx.fillText('valley floors, tinted by the shared drug response', kx, by + 17);
        kx += 300;
      }
      if (drug) {
        const dy = kyT + 6, hgt = Math.min(DEF_PER_LOG2 * amp, 12);
        ctx.strokeStyle = INK; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(kx + 6, dy - hgt / 2); ctx.lineTo(kx + 6, dy + hgt / 2);
        ctx.moveTo(kx, dy - hgt / 2); ctx.lineTo(kx + 12, dy - hgt / 2);
        ctx.moveTo(kx, dy + hgt / 2); ctx.lineTo(kx + 12, dy + hgt / 2);
        ctx.stroke(); ctx.globalAlpha = 1;
        ctx.font = 'italic 10.5px "Iowan Old Style", Palatino, Georgia, serif';
        ctx.fillStyle = INK2;
        ctx.fillText('one log₂ fold of displacement · inked area is the size of the change · '
          + 'ghost line is wild type', kx + 20, dy);
      }
      ctx.textAlign = 'right'; ctx.fillStyle = INK3;
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(k > 1.01 ? ('×' + k.toFixed(1) + ' — drag to move · double-click to reset')
        : 'scroll to zoom · drag to move', W - M.r, kyT + 10);
      ctx.textAlign = 'left';
    }

    /* nearest channel to the pointer. wx/hourY already carry the view transform,
     * so this needs no undoing. */
    function pick(mx, my) {
      const useY = axis === 'e1' ? 0 : 1;
      let best = -1, bd = 22 * 22;
      T.channels.forEach((ch, ci) => {
        ch.pts.forEach((p, ti) => {
          if (!p) return;
          const dx = wx(p[useY]) - mx, dy = hourY(stages[ti]) - my;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = ci; }
        });
      });
      return best;
    }

    /* ---- zoom and pan -----------------------------------------------------
     * Scroll zooms about the cursor, eased. The step is taken from the event's
     * own delta and normalised across the three deltaMode units, so a trackpad
     * and a notched wheel feel the same. When the plate is already fully zoomed
     * out, a further scroll-out is NOT swallowed — it falls through to the page,
     * so the reader can never be trapped inside the figure. */
    canvas.addEventListener('wheel', (ev) => {
      let d = ev.deltaY;
      if (ev.deltaMode === 1) d *= 16;
      else if (ev.deltaMode === 2) d *= 400;
      if (d > 0 && kT <= 1.0001) return;
      ev.preventDefault();
      const r = canvas.getBoundingClientRect();
      const f = clamp(Math.exp(-d * 0.0016), 0.72, 1.38);
      zoomTo(kT * f, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });

    let down = null;
    canvas.addEventListener('pointerdown', (ev) => {
      const r = canvas.getBoundingClientRect();
      down = { x: ev.clientX, y: ev.clientY, px: panX, py: panY, moved: 0,
               cx: ev.clientX - r.left, cy: ev.clientY - r.top };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!down) return;
      const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      down.moved = Math.max(down.moved, Math.abs(dx) + Math.abs(dy));
      if (down.moved < 4) return;
      if (!dragging) { dragging = true; hold.classList.add('dragging'); }
      panXT = down.px + dx; panYT = down.py + dy;
      clampTarget(); panX = panXT; panY = panYT;
      if (anim) { cancelAnimationFrame(anim); anim = 0; }
      draw();
    });
    function endDrag(ev) {
      if (!down) return;
      const wasDrag = down.moved >= 4, c = down;
      down = null;
      if (dragging) { dragging = false; hold.classList.remove('dragging'); draw(); }
      if (!wasDrag) { const hit = pick(c.cx, c.cy); sel = (hit === sel) ? -1 : hit; onPick(sel); draw(); }
      if (ev && ev.pointerId !== undefined && canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('dblclick', (ev) => { ev.preventDefault(); resetView(); });

    return {
      resize, draw, resetView,
      setAxis(a) { axis = a; R = rows(); calcSref(); draw(); },
      setDrug(d) { drug = d; draw(); },
      setHour(h) { hour = h; draw(); },
      setShared(on) { showShared = on; draw(); },
      select(i) { sel = i; draw(); },
      channels: T.channels,
    };
  }

  global.PTTerrain = { make };
})(window);
