/* pt-terrain.js — Plate IV, the terrain.
 *
 * Time runs DOWN the page, 24 hpf at the top rule to 48 hpf at the bottom, after
 * /fate_map_wang_2026 Plate II. The horizontal axis is one axis of the wild-type
 * embedding, switchable, exactly as that plate switches between two spherical
 * coordinates.
 *
 * THE SURFACE IS DENSITY, INVERTED. Elevation is the within-hour RANK of
 * wild-type cell density, inverted, so the surface RISES where few cells are and
 * DIPS where many are. A rank because two attempts on the raw log density
 * rendered as ruled lines — the empty tails of each hour set the scale and the
 * structure disappeared. The transform is monotone, so every ordering claim
 * holds, but a valley twice as deep does not hold twice as many cells. Cells therefore sit in the valleys, which is the Waddington
 * convention and the reason the word "channel" means anything here: a channel is
 * a valley that persists down the page, and a state's route runs along its floor.
 *
 * IT IS AN INTERPRETIVE RENDERING AND NOT A MEASUREMENT OF ANYTHING PHYSICAL.
 * Not anatomy. Not a tracked lineage. No cell rolls down it, no cell crosses a
 * ridge, and the height of a ridge is not an energy, a barrier or a probability.
 * What is real underneath it is a count of cells per bin per hour, normalised
 * within the hour — nothing more.
 *
 * Drawn as a stack of 130 interpolated profiles, each one the real density curve
 * at its own moment, filled with paper so a nearer row occludes the one behind
 * and the stack reads as relief. Per PLATE_STYLE.md §1.1 the mass is one ink and
 * density does the work; the only colour spent is madder on the chosen thing.
 */
(function (global) {
  'use strict';

  const INK = '#2b2219', INK2 = '#5f5344', INK3 = '#8b7d69';
  const RULE = '#c3b6a0', RULE2 = '#d9cfbb', PAPER = '#f3ede1', SELECT = '#8f2d16';
  /* The top margin has to clear the relief itself: a profile rises by up to
   * AMP row-spacings above its own row, and at r = 0 that put the 24 hpf crest
   * off the canvas entirely. */
  const M = { l: 64, r: 26, t: 104, b: 34 };
  const NROWS = 130;            /* interpolated profiles between 24 and 48 hpf */
  const AMP = 7.0;              /* relief height, in row spacings              */

  function make(canvas, hold, T, onPick) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0;
    let axis = 'e1', sel = -1, drug = null, showShared = false, hour = null;

    const stages = T.stages;
    const NX = T.nx;

    /* Interpolate the 13 measured hours to NROWS drawing rows. Linear, and only
     * between real hours — nothing is extrapolated past 24 or 48. */
    function rows() {
      const f = T.fields[axis], E = f.elev;
      const out = new Array(NROWS);
      for (let r = 0; r < NROWS; r++) {
        const u = (r / (NROWS - 1)) * (stages.length - 1);
        const i = Math.min(stages.length - 2, Math.floor(u)), w = u - i;
        const a = E[i], b = E[i + 1], v = new Float32Array(NX);
        for (let j = 0; j < NX; j++) v[j] = a[j] * (1 - w) + b[j] * w;
        out[r] = v;
      }
      return out;
    }
    let R = rows();

    const plotW = () => W - M.l - M.r;
    const plotH = () => H - M.t - M.b;
    const rowY = (r) => M.t + (r / (NROWS - 1)) * plotH();
    const colX = (j) => M.l + (j / (NX - 1)) * plotW();
    /* world x (embedding units) -> screen */
    const wx = (v) => {
      const f = T.fields[axis];
      return M.l + ((v - f.lo) / (f.hi - f.lo)) * plotW();
    };
    const hourY = (h) => M.t + ((h - stages[0]) / (stages[stages.length - 1] - stages[0])) * plotH();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hold.clientWidth; H = hold.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; paint(); });
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);
      const rs = plotH() / (NROWS - 1), amp = rs * AMP * (NROWS / 130);

      /* ---- the relief ---------------------------------------------------
       * Far rows first. Each profile is filled with paper down to the next
       * row, so it hides the one behind it and the stack gains depth without
       * a single fabricated shadow. */
      for (let r = 0; r < NROWS; r++) {
        const v = R[r], y0 = rowY(r);
        ctx.beginPath();
        ctx.moveTo(colX(0), y0 - v[0] * amp);
        for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - v[j] * amp);
        const bottom = y0 + rs * 6;
        ctx.lineTo(colX(NX - 1), bottom);
        ctx.lineTo(colX(0), bottom);
        ctx.closePath();
        ctx.fillStyle = PAPER; ctx.globalAlpha = 1; ctx.fill();

        /* the profile itself. Every second row is inked a little darker so the
         * stack has a rhythm to it rather than reading as a solid wash. */
        ctx.beginPath();
        ctx.moveTo(colX(0), y0 - v[0] * amp);
        for (let j = 1; j < NX; j++) ctx.lineTo(colX(j), y0 - v[j] * amp);
        ctx.strokeStyle = INK;
        ctx.globalAlpha = (r % 5 === 0) ? 0.46 : 0.22;
        ctx.lineWidth = (r % 5 === 0) ? 0.8 : 0.55;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* ---- hachures: short strokes down the steep faces ------------------
       * The engraver's way of showing slope, and the whole texture budget of
       * this plate. Furniture-adjacent but computed from the field, never
       * jittered. */
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.16; ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let r = 2; r < NROWS; r += 2) {
        const v = R[r], y0 = rowY(r);
        for (let j = 2; j < NX - 2; j += 2) {
          const g = Math.abs(v[j + 2] - v[j - 2]);
          if (g < 0.045) continue;
          const len = Math.min(rs * 2.6, g * amp * 1.5);
          const x = colX(j), y = y0 - v[j] * amp;
          ctx.moveTo(x, y); ctx.lineTo(x, y + len);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* ---- wild-type channels -------------------------------------------
       * A state's route down the page: its centroid on this axis at each hour.
       * Drawn dotted for the same reason Plate III's trail is — it is not a
       * path anything travelled. */
      const useY = axis === 'e1' ? 0 : 1;
      ctx.setLineDash([2, 3]);
      T.channels.forEach((ch, ci) => {
        const on = sel === ci;
        ctx.strokeStyle = on ? SELECT : INK2;
        ctx.globalAlpha = on ? 0.95 : 0.34;
        ctx.lineWidth = on ? 1.5 : 0.7;
        ctx.beginPath();
        let started = false;
        ch.pts.forEach((p, ti) => {
          if (!p) return;
          const X = wx(p[useY]), Y = hourY(stages[ti]);
          started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          started = true;
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      if (sel >= 0) {
        const ch = T.channels[sel];
        ch.pts.forEach((p, ti) => {
          if (!p) return;
          ctx.beginPath();
          ctx.arc(wx(p[useY]), hourY(stages[ti]), 2.6, 0, Math.PI * 2);
          ctx.fillStyle = SELECT; ctx.globalAlpha = 1; ctx.fill();
        });
      }
      ctx.globalAlpha = 1;

      /* ---- the ChemFish layer -------------------------------------------
       * A drug does not move a cell across this terrain. It changes how many
       * cells sit in each basin, so it is drawn as deformation: a filled wedge
       * pointing down where a state is ENRICHED (its basin deepens) and an open
       * wedge pointing up where it is DEPLETED (its basin fills in). */
      if (drug) {
        const rows2 = T.chemfish.rows.filter((d) => d.drug === drug
          && (hour === null || d.hpf === hour));
        rows2.forEach((d) => {
          const X = wx(axis === 'e1' ? d.x_e1 : d.x_e2), Y = hourY(d.hpf);
          const mag = Math.min(1, Math.abs(d.lfc) / 2.5);
          if (mag < 0.06) return;
          const s = 3 + mag * 11, up = d.lfc < 0;
          ctx.beginPath();
          if (up) {                       /* depleted: open wedge, pointing up */
            ctx.moveTo(X, Y - s); ctx.lineTo(X - s * 0.55, Y); ctx.lineTo(X + s * 0.55, Y);
            ctx.closePath();
            ctx.strokeStyle = INK; ctx.globalAlpha = 0.75; ctx.lineWidth = 1; ctx.stroke();
          } else {                        /* enriched: filled wedge, pointing down */
            ctx.moveTo(X, Y + s); ctx.lineTo(X - s * 0.55, Y); ctx.lineTo(X + s * 0.55, Y);
            ctx.closePath();
            ctx.fillStyle = INK; ctx.globalAlpha = 0.72; ctx.fill();
          }
        });
        ctx.globalAlpha = 1;
      }

      /* ---- the shared axis ------------------------------------------------
       * One mark per state, at its position, sized by its score on the first
       * principal component of the drug-by-state response matrix. */
      if (showShared && T.chemfish.shared) {
        Object.entries(T.chemfish.shared).forEach(([h, s]) => {
          const Y = hourY(+h);
          Object.entries(s.state_scores).forEach(([name, v]) => {
            const p = T.place && T.place[name];
            const row = T.chemfish.rows.find((d) => d.state === name && d.hpf === +h);
            if (!row) return;
            const X = wx(axis === 'e1' ? row.x_e1 : row.x_e2);
            const mag = Math.min(1, Math.abs(v) / 3);
            ctx.beginPath();
            ctx.arc(X, Y, 1.6 + mag * 5.2, 0, Math.PI * 2);
            if (v >= 0) { ctx.fillStyle = SELECT; ctx.globalAlpha = 0.30 + mag * 0.4; ctx.fill(); }
            else { ctx.strokeStyle = SELECT; ctx.globalAlpha = 0.30 + mag * 0.5;
                   ctx.lineWidth = 1.1; ctx.stroke(); }
          });
        });
        ctx.globalAlpha = 1;
      }

      /* ---- furniture ------------------------------------------------------ */
      ctx.strokeStyle = RULE; ctx.lineWidth = 0.8; ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(M.l, M.t); ctx.lineTo(W - M.r, M.t);
      ctx.moveTo(M.l, H - M.b); ctx.lineTo(W - M.r, H - M.b);
      ctx.stroke();
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = INK3; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      stages.forEach((h) => {
        const Y = hourY(h);
        ctx.strokeStyle = RULE2; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(M.l - 6, Y); ctx.lineTo(M.l - 2, Y); ctx.stroke();
        ctx.globalAlpha = 1;
        if (h % 4 === 0 || h === stages[0] || h === stages[stages.length - 1]) {
          ctx.fillText(h + (h === stages[0] ? ' hpf' : ''), M.l - 10, Y);
        }
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = 'italic 11px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.fillText('high ground — few cells', M.l + 2, 8);
      ctx.textAlign = 'right';
      ctx.fillText('valley floor — where cells accumulate', W - M.r - 2, 8);
      ctx.textAlign = 'left';
    }

    /* nearest channel to the pointer, measured at the nearest hour */
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

    canvas.addEventListener('click', (ev) => {
      const r = canvas.getBoundingClientRect();
      const hit = pick(ev.clientX - r.left, ev.clientY - r.top);
      sel = (hit === sel) ? -1 : hit;
      onPick(sel);
      draw();
    });

    return {
      resize, draw,
      setAxis(a) { axis = a; R = rows(); draw(); },
      setDrug(d) { drug = d; draw(); },
      setHour(h) { hour = h; draw(); },
      setShared(on) { showShared = on; draw(); },
      select(i) { sel = i; draw(); },
      channels: T.channels,
    };
  }

  global.PTTerrain = { make };
})(window);
