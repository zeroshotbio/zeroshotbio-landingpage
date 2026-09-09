/* pt-graph.js — draw the state graph on a canvas, and hit-test it.
 *
 * The one encoding decision that carries the page: an edge's LITERATURE VERDICT
 * is in its stroke. A reader who lands mid-page and never reads a word of prose
 * should still be able to see that a quarter of the arrows are struck through.
 *
 * Everything else is restraint. Nodes are a single ink at one size; the only
 * colour spent is madder on the selection and plum on the rejected edges, and
 * plum is a dashed line so the distinction survives greyscale and colour
 * blindness both. Per PLATE_STYLE.md §1.1 the mass is one ink and the reader
 * gets a control that lifts one class out of it.
 */
(function (global) {
  'use strict';

  const INK = '#2b2219', INK2 = '#5f5344', INK3 = '#8b7d69';
  const RULE = '#c3b6a0', RULE2 = '#d9cfbb', PAPER = '#f3ede1';
  const SELECT = '#8f2d16', PLUM = '#6d4665';

  /* draw order is least-believed first, so the believed arrows sit on top */
  const STYLE = {
    'FALSE':     { stroke: PLUM, w: 1.0, dash: [5, 3], label: 'rejected',      rank: 0 },
    'EXCLUDE':   { stroke: PLUM, w: 1.0, dash: [2, 3], label: 'excluded',      rank: 1 },
    'UNKNOWN':   { stroke: INK3, w: 0.9, dash: [1, 3], label: 'unknown',       rank: 2 },
    '':          { stroke: RULE, w: 0.8, dash: [],     label: 'unadjudicated', rank: 3 },
    'PLAUSIBLE': { stroke: INK2, w: 1.0, dash: [],     label: 'plausible',     rank: 4 },
    'TRUE':      { stroke: INK,  w: 1.5, dash: [],     label: 'supported',     rank: 5 },
  };

  const PAD = { l: 26, r: 26, t: 20, b: 20 };
  const R = 3.1;               /* node radius at zoom 1 */
  const LABEL_ZOOM = 1.55;     /* state names appear above this zoom */

  function make(canvas, graph, onPick) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let k = 1, tx = 0, ty = 0;            /* view transform */
    let sel = -1, hover = -1, isolate = null, winOnly = false;
    let raf = 0, painting = false;

    const ext = graph.extent;
    const spanX = (ext.x1 - ext.x0) || 1;
    const spanY = (ext.y1 - ext.y0) || 1;

    function fit() {
      const kx = (W - PAD.l - PAD.r) / spanX;
      const ky = (H - PAD.t - PAD.b) / spanY;
      k = Math.min(kx, ky);
      tx = PAD.l - ext.x0 * k;
      ty = PAD.t - ext.y0 * k;
    }
    const sx = (x) => x * k + tx;
    const sy = (y) => y * k + ty;

    function resize() {
      const hold = canvas.parentElement;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hold.clientWidth; H = hold.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit(); request();
    }

    function request() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; if (!painting) paint(); });
    }

    /* Which nodes are lit right now: the selection and everything one hop from
     * it. Isolating an edge class lights that class's endpoints instead. */
    const crests = (n) => n.peak != null
      && n.peak > graph.window[0] && n.peak <= graph.window[1];

    function litSet() {
      if (sel >= 0) {
        const s = new Set([sel]);
        graph.parents[sel].forEach((p) => s.add(p.n));
        graph.children[sel].forEach((c) => s.add(c.n));
        return s;
      }
      if (isolate !== null) {
        const s = new Set();
        graph.edges.forEach((e) => {
          if ((e.support || '') === isolate) { s.add(e.s); s.add(e.t); }
        });
        if (winOnly) [...s].forEach((i) => { if (!crests(graph.nodes[i])) s.delete(i); });
        return s;
      }
      if (winOnly) return new Set(graph.nodes.filter(crests).map((n) => n.i));
      return null;
    }

    /* An edge is lit when BOTH ends are — a half-lit arrow would suggest a
     * transition into the ghosted population, which is not what the filter
     * means. */
    function edgeLit(e) {
      if (sel >= 0) return e.s === sel || e.t === sel;
      if (isolate !== null && (e.support || '') !== isolate) return false;
      if (winOnly) return crests(graph.nodes[e.s]) && crests(graph.nodes[e.t]);
      return true;
    }

    function paint() {
      painting = true;
      ctx.clearRect(0, 0, W, H);

      /* Component boxes — furniture, so they may be soft. Each of the 26
       * disconnected pieces gets a baseline and a count at its left edge,
       * because "not one tree" is a fact about this graph that is invisible
       * without them. */
      ctx.save();
      ctx.strokeStyle = RULE2; ctx.lineWidth = 0.5;
      ctx.beginPath();
      graph.bands.forEach((b) => {
        const y = sy(b.y1) + 12, xa = sx(b.x0) - 12, xb = sx(b.x1) + 12;
        if (y < -8 || y > H + 8 || xb < 0 || xa > W) return;
        ctx.moveTo(xa, y); ctx.lineTo(xb, y);
      });
      ctx.stroke();
      if (k > 0.5) {
        ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
        ctx.fillStyle = RULE;
        graph.bands.forEach((b) => {
          const x = sx(b.x0) - 16, y = (sy(b.y0) + sy(b.y1)) / 2;
          if (x < 4 || x > W || y < 0 || y > H) return;
          ctx.fillText(String(b.n), x, y);
        });
        ctx.textAlign = 'left';
      }
      ctx.restore();

      const lit = litSet();
      const ghost = lit !== null;

      /* Edges, batched by ink. One beginPath per style per lit-state; a
       * per-edge style change would not hold a frame. */
      const order = Object.keys(STYLE).sort((a, b) => STYLE[a].rank - STYLE[b].rank);
      [false, true].forEach((wantLit) => {
        order.forEach((key) => {
          const st = STYLE[key];
          const batch = graph.edges.filter((e) => (e.support || '') === key
            && (!ghost || edgeLit(e) === wantLit));
          if (!batch.length) return;
          ctx.save();
          ctx.setLineDash(st.dash.map((d) => d * Math.min(1.8, Math.max(0.7, k))));
          ctx.lineWidth = Math.min(2.4, st.w * (0.75 + 0.25 * k));
          ctx.strokeStyle = st.stroke;
          ctx.globalAlpha = !ghost ? 0.9 : (wantLit ? 1 : 0.10);
          ctx.beginPath();
          batch.forEach((e) => {
            const a = graph.nodes[e.s], b = graph.nodes[e.t];
            const x1 = sx(a.x), y1 = sy(a.y), x2 = sx(b.x), y2 = sy(b.y);
            /* A flat cubic: leaves its parent horizontally and arrives at its
             * child horizontally, so the reading direction is unmistakable
             * without drawing 173 arrowheads. */
            const dx = Math.max(18, (x2 - x1) * 0.45);
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
          });
          ctx.stroke();
          ctx.restore();
        });
      });

      /* An edge that runs backwards against the abundance evidence gets a tick
       * through it. Six do. */
      ctx.save();
      ctx.strokeStyle = SELECT; ctx.lineWidth = 1.1; ctx.globalAlpha = ghost ? 0.25 : 0.75;
      ctx.beginPath();
      graph.edges.filter((e) => e.retro).forEach((e) => {
        const a = graph.nodes[e.s], b = graph.nodes[e.t];
        const mx = (sx(a.x) + sx(b.x)) / 2, my = (sy(a.y) + sy(b.y)) / 2;
        ctx.moveTo(mx - 3.2, my - 3.2); ctx.lineTo(mx + 3.2, my + 3.2);
      });
      ctx.stroke();
      ctx.restore();

      /* Nodes. One ink, one size. A hollow ring for a state with no timing
       * evidence — ten of them — so a reader can see the holes in the record. */
      const r = Math.min(6.2, R * (0.72 + 0.28 * k));
      graph.nodes.forEach((n) => {
        const x = sx(n.x), y = sy(n.y);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
        const on = !ghost || lit.has(n.i);
        ctx.globalAlpha = on ? 1 : 0.13;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        if (n.abund) {
          ctx.fillStyle = n.i === sel ? SELECT : INK; ctx.fill();
        } else {
          ctx.strokeStyle = n.i === sel ? SELECT : INK; ctx.lineWidth = 1.2; ctx.stroke();
        }
        if (n.i === sel || n.i === hover) {
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(x, y, r + 3.4, 0, Math.PI * 2);
          ctx.strokeStyle = SELECT; ctx.lineWidth = 1.1; ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      /* Names, once there is room for them. Paint a paper backing first — canvas
       * text over marks is unreadable without one. */
      if (k >= LABEL_ZOOM || sel >= 0 || hover >= 0) {
        ctx.font = 'italic 11.5px "Iowan Old Style", Palatino, Georgia, serif';
        ctx.textBaseline = 'middle';
        const show = graph.nodes.filter((n) => {
          if (n.i === sel || n.i === hover) return true;
          if (k < LABEL_ZOOM) return false;
          if (ghost && !lit.has(n.i)) return false;
          const x = sx(n.x), y = sy(n.y);
          return x > -60 && x < W + 60 && y > -14 && y < H + 14;
        });
        show.forEach((n) => {
          const x = sx(n.x) + r + 5, y = sy(n.y);
          const t = n.name.length > 46 ? n.name.slice(0, 44) + '…' : n.name;
          const w = ctx.measureText(t).width;
          ctx.fillStyle = PAPER; ctx.globalAlpha = 0.82;
          ctx.fillRect(x - 2, y - 7.5, w + 4, 15);
          ctx.globalAlpha = 1;
          ctx.fillStyle = (n.i === sel) ? SELECT : INK;
          ctx.fillText(t, x, y);
        });
      }

      painting = false;
    }

    function pick(px, py) {
      const rr = Math.max(9, Math.min(14, 6 * k));
      let best = -1, bd = rr * rr;
      graph.nodes.forEach((n) => {
        const dx = sx(n.x) - px, dy = sy(n.y) - py;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = n.i; }
      });
      return best;
    }

    /* ---- interaction ------------------------------------------------- */
    let drag = null;
    canvas.addEventListener('pointerdown', (ev) => {
      const b = canvas.getBoundingClientRect();
      drag = { x: ev.clientX, y: ev.clientY, tx, ty, moved: false,
               px: ev.clientX - b.left, py: ev.clientY - b.top };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      const b = canvas.getBoundingClientRect();
      const px = ev.clientX - b.left, py = ev.clientY - b.top;
      if (drag) {
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        tx = drag.tx + dx; ty = drag.ty + dy; request();
        return;
      }
      const h = pick(px, py);
      if (h !== hover) { hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : 'crosshair'; request(); }
    });
    canvas.addEventListener('pointerup', (ev) => {
      const wasDrag = drag && drag.moved;
      if (drag) canvas.releasePointerCapture(ev.pointerId);
      const d = drag; drag = null;
      if (wasDrag || !d) return;
      const hit = pick(d.px, d.py);
      sel = (hit === sel) ? -1 : hit;
      onPick(sel);
      request();
    });
    canvas.addEventListener('pointerleave', () => { hover = -1; request(); });
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const b = canvas.getBoundingClientRect();
      const px = ev.clientX - b.left, py = ev.clientY - b.top;
      const f = Math.exp(-ev.deltaY * 0.0016);
      const nk = Math.max(0.35, Math.min(9, k * f));
      tx = px - (px - tx) * (nk / k); ty = py - (py - ty) * (nk / k);
      k = nk; request();
    }, { passive: false });

    return {
      resize,
      reset() { fit(); request(); },
      select(i) { sel = i; request(); },
      selected() { return sel; },
      isolateClass(c) { isolate = c; request(); },
      windowOnly(on) { winOnly = !!on; request(); },
      STYLE,
    };
  }

  global.PTGraph = { make, STYLE };
})(window);
