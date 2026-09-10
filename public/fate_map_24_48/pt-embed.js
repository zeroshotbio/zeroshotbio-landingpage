/* pt-embed.js — Plate III, the transcriptomic landscape with a scrubber.
 *
 * 844,825 wild-type ZSCAPE cells at 24, 26 … 48 hpf, drawn in one ink, with a
 * slider that moves a window over developmental time rather than moving any
 * cell.
 *
 * THE CLAIM THIS PLATE MUST NOT MAKE. Nothing here is tracked. ZSCAPE is 1,860
 * separate embryos fixed at separate hours; two cells at 24 and 26 hpf are
 * different cells from different animals. When a state's trail moves across the
 * plate, that is its expression changing, not a population travelling. The
 * caption, the toolbar hint and the notes all say so, and the trail is drawn as
 * a dotted line for the same reason — a solid line would look like a path.
 *
 * The embedding is the authors' own 3D UMAP under a fixed principal projection
 * (83.9% of its variance). UMAP distance is not a quantity: two populations far
 * apart are not "more different" by any stated amount.
 *
 * Following PLATE_STYLE.md §1.1: the mass is one ink and density does the work;
 * colour lifts exactly one thing out of it at a time.
 */
(function (global) {
  'use strict';

  const INK = '#2b2219', INK3 = '#8b7d69', RULE = '#c3b6a0', SELECT = '#8f2d16';
  const PAD = 22;
  /* Displacements are TINY against the embedding — a median arrow is about 0.6%
   * of the plate's width, six pixels, invisible. Vector fields are conventionally
   * drawn magnified; the honest requirement is that the factor is stated and a
   * true-length scale bar is drawn beside it, both of which happen below. */
  const ARROW_MAG = 8;

  function decode(buf) {
    if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'ZCEL')
      throw new Error('cells.bin: bad magic');
    const h = new Uint32Array(buf, 4, 3);
    if (h[0] !== 1) throw new Error('cells.bin: version ' + h[0]);
    const n = h[1];
    let o = 16;
    const x = new Int16Array(buf, o, n); o += 2 * n;
    const y = new Int16Array(buf, o, n); o += 2 * n;
    const c = new Uint16Array(buf, o, n); o += 2 * n;
    const t = new Uint8Array(buf, o, n); o += n;
    const s = new Uint8Array(buf, o, n);
    return { n, x, y, c, t, s };
  }

  function make(canvas, hold, D, onPick) {
    const ctx = canvas.getContext('2d');
    const { cells, meta, states } = D;
    const SC = meta.xy_scale;
    let W = 0, H = 0, dpr = 1, k = 1, ox = 0, oy = 0;
    let stage = 0, iso = null, sel = -1, arrows = null, showArrows = false, target = null;
    let raf = 0;

    /* stage index per cell, precomputed as offsets so a draw never scans all
     * 845k rows to find the ones at this hour */
    const order = new Uint32Array(cells.n);
    const start = new Uint32Array(meta.stages.length + 1);
    {
      const cnt = new Uint32Array(meta.stages.length);
      for (let i = 0; i < cells.n; i++) cnt[cells.t[i]]++;
      for (let s2 = 0; s2 < cnt.length; s2++) start[s2 + 1] = start[s2] + cnt[s2];
      const fill = start.slice();
      for (let i = 0; i < cells.n; i++) order[fill[cells.t[i]]++] = i;
    }

    function fit() {
      const b = meta.bounds;
      k = Math.min((W - 2 * PAD) / (b.x1 - b.x0), (H - 2 * PAD) / (b.y1 - b.y0));
      ox = W / 2 - ((b.x0 + b.x1) / 2) * k;
      oy = H / 2 + ((b.y0 + b.y1) / 2) * k;
    }
    const px = (i) => ox + (cells.x[i] / SC) * k;
    const py = (i) => oy - (cells.y[i] / SC) * k;
    const wx = (v) => ox + v * k;
    const wy = (v) => oy - v * k;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hold.clientWidth; H = hold.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit(); draw();
    }
    function draw() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; paint(); });
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);

      /* 1. the whole window as ground — the shape the reader keeps while
       *    looking at one hour of it */
      ctx.fillStyle = INK; ctx.globalAlpha = 0.035;
      for (let i = 0; i < cells.n; i += 3) ctx.fillRect(px(i), py(i), 1, 1);

      /* 2. this hour, inked in. Isolation dims rather than hides. */
      const a = start[stage], b = start[stage + 1];
      /* 0.16 at 1.3px, not 0.5 at 1.6px. The first version drew 202,388 cells at
       * half opacity and every cluster came out a solid black blob — technically
       * correct, and it said nothing about where the cells actually pile up.
       * PLATE_STYLE.md §1.1: draw the mass in one ink and let density do the work. */
      ctx.globalAlpha = 0.16; ctx.fillStyle = INK;
      for (let j = a; j < b; j++) {
        const i = order[j];
        if (iso !== null && cells.s[i] !== iso) continue;
        if (sel >= 0 && cells.c[i] === sel) continue;
        ctx.fillRect(px(i) - 0.5, py(i) - 0.5, 1.3, 1.3);
      }
      if (iso !== null) {
        ctx.globalAlpha = 0.05;
        for (let j = a; j < b; j++) {
          const i = order[j];
          if (cells.s[i] === iso) continue;
          ctx.fillRect(px(i), py(i), 1.1, 1.1);
        }
      }

      /* 3. the chosen state: its cells at this hour, and its trail across all
       *    thirteen. Dotted, because a solid line would read as a path. */
      if (sel >= 0) {
        const st = states[sel];
        ctx.globalAlpha = 0.62; ctx.fillStyle = SELECT;
        for (let j = a; j < b; j++) {
          const i = order[j];
          if (cells.c[i] === sel) ctx.fillRect(px(i) - 0.8, py(i) - 0.8, 2.1, 2.1);
        }
        const tr = st.trail;
        ctx.globalAlpha = 1; ctx.strokeStyle = SELECT; ctx.lineWidth = 1;
        ctx.setLineDash([2.5, 3]);
        ctx.beginPath();
        let started = false;
        tr.forEach((p) => {
          if (!p) return;
          const X = wx(p[0]), Y = wy(p[1]);
          started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          started = true;
        });
        ctx.stroke(); ctx.setLineDash([]);
        tr.forEach((p, ti) => {
          if (!p) return;
          const X = wx(p[0]), Y = wy(p[1]);
          ctx.beginPath();
          ctx.arc(X, Y, ti === stage ? 4.2 : 2.1, 0, Math.PI * 2);
          ctx.fillStyle = ti === stage ? SELECT : '#f3ede1';
          ctx.strokeStyle = SELECT; ctx.lineWidth = 1;
          ctx.fill(); ctx.stroke();
        });
      }

      /* 4. perturbation arrows for one target at this hour */
      if (showArrows && arrows && target) {
        const list = arrows.arrows.filter((r) => r.target === target && r.hpf === meta.stages[stage]
          && (sel < 0 || r.state === states[sel].name));
        /* Arrows that run AGAINST the shared response axis are the interesting
         * minority — 82% of all displacements lie along it — so they get the
         * madder and everything else stays one ink. */
        [true, false].forEach((along) => {
          const g = list.filter((r) => (r.p === undefined ? true : (r.p >= 0) === along));
          if (!g.length) return;
          ctx.globalAlpha = along ? 0.8 : 0.95;
          ctx.strokeStyle = along ? INK : SELECT;
          ctx.lineWidth = along ? 1.1 : 1.3;
          ctx.beginPath();
          g.forEach((r) => {
            ctx.moveTo(wx(r.x0), wy(r.y0));
            ctx.lineTo(wx(r.x0 + (r.x1 - r.x0) * ARROW_MAG),
                       wy(r.y0 + (r.y1 - r.y0) * ARROW_MAG));
          });
          ctx.stroke();
        });
        ctx.strokeStyle = INK;
        list.forEach((r) => {
          ctx.strokeStyle = (r.p !== undefined && r.p < 0) ? SELECT : INK;
          const X0 = wx(r.x0), Y0 = wy(r.y0);
          const X1 = wx(r.x0 + (r.x1 - r.x0) * ARROW_MAG);
          const Y1 = wy(r.y0 + (r.y1 - r.y0) * ARROW_MAG);
          const ang = Math.atan2(Y1 - Y0, X1 - X0), L = 5;
          ctx.beginPath();
          ctx.moveTo(X1, Y1);
          ctx.lineTo(X1 - L * Math.cos(ang - 0.42), Y1 - L * Math.sin(ang - 0.42));
          ctx.moveTo(X1, Y1);
          ctx.lineTo(X1 - L * Math.cos(ang + 0.42), Y1 - L * Math.sin(ang + 0.42));
          ctx.stroke();
          ctx.beginPath(); ctx.arc(X0, Y0, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = (r.p !== undefined && r.p < 0) ? SELECT : INK; ctx.fill();
        });
        ctx.globalAlpha = 1;

        /* the shared axis itself, as a reference bar in the corner */
        if (arrows.axis) {
          const ax = arrows.axis.direction, L = 46;
          /* H - 52 put the scale bar at H + 8, off the canvas entirely. The
           * reference block is four rows tall; it has to start that far up. */
          const cxp = W - 160, cyp = H - 136;
          ctx.strokeStyle = INK3; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cxp - ax[0] * L, cyp + ax[1] * L);
          ctx.lineTo(cxp + ax[0] * L, cyp - ax[1] * L);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cxp + ax[0] * L, cyp - ax[1] * L, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = INK3; ctx.fill();
          ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('SHARED RESPONSE AXIS', cxp, cyp + 26);
          ctx.font = 'italic 10px "Iowan Old Style", Palatino, Georgia, serif';
          ctx.fillText((arrows.axis.var_explained_centred * 100).toFixed(0) +
                       '% of displacement', cxp, cyp + 38);

          /* Two bars, stacked: what a 0.1 displacement really is, and what it
           * looks like once magnified. Drawing only the true one produced a
           * five-pixel tick that read as a typo; drawing only the magnified one
           * would hide the magnification. Showing both IS the statement. */
          const med = 0.1;
          const barPx = med * k * ARROW_MAG;
          const bx = cxp - barPx / 2, by = cyp + 60;
          ctx.strokeStyle = INK3; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by);
          ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by + 3);
          ctx.moveTo(bx + barPx, by - 3); ctx.lineTo(bx + barPx, by + 3);
          ctx.stroke();
          const truePx = med * k;
          ctx.beginPath();
          ctx.moveTo(cxp - truePx / 2, by + 9); ctx.lineTo(cxp + truePx / 2, by + 9);
          ctx.moveTo(cxp - truePx / 2, by + 6); ctx.lineTo(cxp - truePx / 2, by + 12);
          ctx.moveTo(cxp + truePx / 2, by + 6); ctx.lineTo(cxp + truePx / 2, by + 12);
          ctx.stroke();
          ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
          ctx.fillText('ARROWS DRAWN \u00d7' + ARROW_MAG, cxp, by + 16);
          ctx.font = 'italic 10px "Iowan Old Style", Palatino, Georgia, serif';
          ctx.fillText('upper bar: a 0.1 displacement as drawn', cxp, by + 28);
          ctx.fillText('lower bar: the same displacement, true size', cxp, by + 40);
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        }
      }

      /* the hour, set into the plate itself */
      ctx.globalAlpha = 1;
      ctx.font = 'italic 26px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.fillStyle = INK3; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(meta.stages[stage] + ' hpf', PAD, PAD - 6);
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText((meta.cells_per_stage[meta.stages[stage]] || 0).toLocaleString() +
                   ' wild-type cells', PAD + 1, PAD + 26);
    }

    function pick(mx, my) {
      const a = start[stage], b = start[stage + 1];
      let best = -1, bd = 18 * 18;
      for (let j = a; j < b; j++) {
        const i = order[j];
        if (iso !== null && cells.s[i] !== iso) continue;
        const dx = px(i) - mx, dy = py(i) - my, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      return best < 0 ? -1 : cells.c[best];
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
      setStage(i) { stage = i; draw(); },
      getStage() { return stage; },
      setIso(i) { iso = i; draw(); },
      select(i) { sel = i; draw(); },
      selected() { return sel; },
      setArrows(a) { arrows = a; draw(); },
      showArrows(on, tg) { showArrows = on; target = tg; draw(); },
    };
  }

  global.PTEmbed = { decode, make };
})(window);
