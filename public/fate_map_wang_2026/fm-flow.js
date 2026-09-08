/* /fate_map_wang_2026 — Plate II, the passage.
 *
 * Time runs DOWN the page, 5.5 hpf at the top rule to 11.3 hpf at the bottom.
 * The horizontal axis is one spherical coordinate of the cell, switchable:
 *
 *   animal -> vegetal   x = latitude 0..180. Epiboly is motion to the right,
 *                       so the sheet visibly spreads over the yolk.
 *   dorsal <-> ventral  x = longitude -180..180 about the fitted dorsal
 *                       meridian, dorsal at centre. Convergence is motion
 *                       toward the middle.
 *
 * Every stroke is one unbranched run of one tracked nucleus. A run is joined to
 * its parent's last sample, so a division reads as a fork rather than as two
 * unrelated lines starting at the same height.
 *
 * The longitude view has a seam: a lineage that crosses ±180 would otherwise
 * draw a horizontal streak straight across the plate. Any step wider than half
 * the axis lifts the pen instead — see WRAP below.
 */
'use strict';

const WRAP = 0.5;              // world-space step that means "we crossed the seam"
const MARGIN = { l: 62, r: 26, t: 34, b: 30 };

const flow = {
  cv: null, ctx: null, hold: null,
  W: 0, H: 0, dpr: 1,
  k: 1, tx: 0, ty: 0,          // view: screen = margin + world * content * k + pan
  axis: 'lat',
  segTerr: null,
  xs: null, ys: null,          // world coords per sample, rebuilt when axis flips
  hover: -1,
  quality: 1,                  // 1 = every sample, 2 = every other while moving
  raf: 0,
};

function flowInit(canvas, hold, state) {
  flow.cv = canvas; flow.hold = hold; flow.ctx = canvas.getContext('2d');
  const f = FM.flow, fd = FM.founders;
  flow.segTerr = new Uint8Array(f.nSeg);
  for (let i = 0; i < f.nSeg; i++) flow.segTerr[i] = fd.dom[f.founder[i]];
  flowSetAxis('lat');
  flowResize(state);
}

/* World coordinates for every sample. y is the time grid; x is whichever
 * angle is selected, normalised to 0..1. */
function flowSetAxis(which) {
  flow.axis = which;
  const f = FM.flow, n = f.nSamp;
  const nG = FM.meta.window.grid.length;
  if (!flow.xs) { flow.xs = new Float32Array(n); flow.ys = new Float32Array(n); }
  const src = which === 'lat' ? f.lat : f.lon;
  const scale = which === 'lat' ? 1 / 18000 : 1 / 36000;
  const shift = which === 'lat' ? 0 : 0.5;
  for (let i = 0; i < n; i++) flow.xs[i] = src[i] * scale + shift;
  for (let s = 0; s < f.nSeg; s++) {
    const o = f.off[s], L = f.len[s], g0 = f.g0[s];
    for (let j = 0; j < L; j++) flow.ys[o + j] = (g0 + j) / (nG - 1);
  }
}

function flowResize(state) {
  const c = flow.cv, hold = flow.hold;
  flow.dpr = Math.min(window.devicePixelRatio || 1, 2);
  flow.W = hold.clientWidth; flow.H = hold.clientHeight;
  c.width = Math.round(flow.W * flow.dpr);
  c.height = Math.round(flow.H * flow.dpr);
  c.style.height = flow.H + 'px';
  flow.ctx.setTransform(flow.dpr, 0, 0, flow.dpr, 0, 0);
  flowDraw(state);
}

function contentBox() {
  return { w: flow.W - MARGIN.l - MARGIN.r, h: flow.H - MARGIN.t - MARGIN.b };
}
function sx(wx) { const b = contentBox(); return MARGIN.l + flow.tx + wx * b.w * flow.k; }
function sy(wy) { const b = contentBox(); return MARGIN.t + flow.ty + wy * b.h * flow.k; }

function flowReset(state) { flow.k = 1; flow.tx = 0; flow.ty = 0; flowDraw(state); }

function flowZoom(factor, px, py, state) {
  const k0 = flow.k;
  const k1 = Math.max(1, Math.min(60, k0 * factor));
  if (k1 === k0) return;
  // keep the world point under the cursor fixed
  const b = contentBox();
  const wx = (px - MARGIN.l - flow.tx) / (b.w * k0);
  const wy = (py - MARGIN.t - flow.ty) / (b.h * k0);
  flow.k = k1;
  flow.tx = px - MARGIN.l - wx * b.w * k1;
  flow.ty = py - MARGIN.t - wy * b.h * k1;
  flowClamp();
  flowDraw(state);
}

function flowClamp() {
  const b = contentBox();
  const overW = b.w * (flow.k - 1), overH = b.h * (flow.k - 1);
  flow.tx = Math.max(-overW, Math.min(0, flow.tx));
  flow.ty = Math.max(-overH, Math.min(0, flow.ty));
}

function flowPan(dx, dy, state) {
  flow.tx += dx; flow.ty += dy; flowClamp(); flowDraw(state);
}

function drawFurniture(state) {
  const ctx = flow.ctx, m = FM.meta;
  const css = getComputedStyle(document.body);
  const rule = css.getPropertyValue('--rule').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const ink2 = css.getPropertyValue('--ink-2').trim();
  const paper = css.getPropertyValue('--paper').trim();
  const grid = m.window.grid, nG = grid.length;
  const h0 = grid[0], h1 = grid[nG - 1];
  const toY = (hpf) => sy((hpf - h0) / (h1 - h0));

  // vertical guides
  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.l, 0, flow.W - MARGIN.l - MARGIN.r, flow.H);
  ctx.clip();
  ctx.strokeStyle = rule2; ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  const ticks = flow.axis === 'lat'
    ? [0, 30, 60, 90, 120, 150, 180].map(d => ({ w: d / 180, t: d + '°' }))
    : [-180, -90, 0, 90, 180].map(d => ({ w: (d + 180) / 360, t: d + '°' }));
  ctx.beginPath();
  for (const tk of ticks) { const x = sx(tk.w); ctx.moveTo(x, MARGIN.t); ctx.lineTo(x, flow.H - MARGIN.b); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // horizontal: every half hour faint, every stage named
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, MARGIN.t - 1, flow.W, flow.H - MARGIN.t - MARGIN.b + 2);
  ctx.clip();
  ctx.strokeStyle = rule2; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  ctx.beginPath();
  for (let t = Math.ceil(h0 * 2) / 2; t <= h1; t += 0.5) {
    const y = toY(t); ctx.moveTo(MARGIN.l, y); ctx.lineTo(flow.W - MARGIN.r, y);
  }
  ctx.stroke(); ctx.setLineDash([]);

  // hour labels, pinned to the left gutter
  ctx.fillStyle = ink3;
  ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let t = Math.ceil(h0); t <= h1; t += 1) {
    const y = toY(t);
    if (y < MARGIN.t - 4 || y > flow.H - MARGIN.b + 4) continue;
    ctx.fillText(t.toFixed(0) + ' h', MARGIN.l - 9, y);
  }

  // named stages. A stage that begins just before the window (50% epiboly, at
  // 5.25 hpf against a 5.5 hpf start) is pinned to the top rule rather than
  // dropped — the window opens inside it, and saying so is the point.
  for (const st of m.stages) {
    // A stage that opened just before the window is pinned to its first
    // visible row rather than dropped: 50% epiboly begins at 5.25 hpf and the
    // window opens inside it, which is worth saying on the plate.
    let y = st.hpf < h0 ? Math.max(sy(0), MARGIN.t + 9) : toY(st.hpf);
    if (y < MARGIN.t - 1 || y > flow.H - MARGIN.b) continue;
    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(MARGIN.l, y); ctx.lineTo(flow.W - MARGIN.r, y); ctx.stroke();
    const label = st.name;
    ctx.font = 'italic 12px Georgia,serif';
    const wpx = ctx.measureText(label).width;
    ctx.fillStyle = paper;
    ctx.fillRect(flow.W - MARGIN.r - wpx - 12, y - 8, wpx + 10, 16);
    ctx.fillStyle = ink2;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(label, flow.W - MARGIN.r - 5, y);
  }
  ctx.restore();

  // frame
  ctx.strokeStyle = rule; ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.l + .5, MARGIN.t + .5,
                 flow.W - MARGIN.l - MARGIN.r - 1, flow.H - MARGIN.t - MARGIN.b - 1);

  // x-axis tick labels along the top rule
  ctx.fillStyle = ink3;
  ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const tk of ticks) {
    const x = sx(tk.w);
    if (x < MARGIN.l - 2 || x > flow.W - MARGIN.r + 2) continue;
    ctx.fillText(tk.t, x, MARGIN.t - 6);
  }
  ctx.textAlign = 'left';
  ctx.fillText(flow.axis === 'lat' ? 'animal pole' : 'ventral', MARGIN.l, flow.H - 8);
  ctx.textAlign = 'right';
  ctx.fillText(flow.axis === 'lat' ? 'vegetal pole' : 'ventral', flow.W - MARGIN.r, flow.H - 8);
  if (flow.axis === 'lon') {
    ctx.textAlign = 'center';
    ctx.fillText('dorsal', sx(0.5), flow.H - 8);
  }
}

/* Stroke one segment, entering from its parent's last sample so divisions fork. */
function pathSegment(ctx, s, step) {
  const f = FM.flow;
  const o = f.off[s], L = f.len[s];
  let px = null, py = null;
  const p = f.parent[s];
  if (p >= 0) {
    const po = f.off[p] + f.len[p] - 1;
    px = flow.xs[po]; py = flow.ys[po];
    ctx.moveTo(sx(px), sy(py));
  }
  for (let j = 0; j < L; j += step) {
    const i = o + j, x = flow.xs[i], y = flow.ys[i];
    if (px !== null && Math.abs(x - px) > WRAP) ctx.moveTo(sx(x), sy(y));
    else if (px === null) ctx.moveTo(sx(x), sy(y));
    else ctx.lineTo(sx(x), sy(y));
    px = x; py = y;
  }
  // always land the final sample so a run never stops short of its division
  if ((L - 1) % step !== 0) {
    const i = o + L - 1, x = flow.xs[i], y = flow.ys[i];
    if (px !== null && Math.abs(x - px) > WRAP) ctx.moveTo(sx(x), sy(y));
    else ctx.lineTo(sx(x), sy(y));
  }
}

function flowDraw(state) {
  if (flow.raf) return;
  flow.raf = requestAnimationFrame(() => { flow.raf = 0; flowPaint(state); });
}

function flowPaint(state) {
  const ctx = flow.ctx, f = FM.flow;
  const css = getComputedStyle(document.body);
  ctx.clearRect(0, 0, flow.W, flow.H);
  drawFurniture(state);

  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.l, MARGIN.t, flow.W - MARGIN.l - MARGIN.r, flow.H - MARGIN.t - MARGIN.b);
  ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const step = flow.quality;
  const chosen = state.segs;                     // Set or null
  const dim = chosen && chosen.size ? 0.10 : 1;
  const nT = FM.meta.territories.length;
  const iso = state.iso;
  const lw = Math.min(1.5, 0.5 + (flow.k - 1) * 0.05);

  if (!iso.size) {
    // Nothing isolated: one ink for everything. Nineteen thousand tinted
    // strokes at this density average to grey and say nothing; as a single
    // ink the same strokes read as tone, and the shape of epiboly comes out.
    ctx.strokeStyle = css.getPropertyValue('--ink').trim();
    ctx.globalAlpha = 0.13 * dim;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let s = 0; s < f.nSeg; s++) {
      if (chosen && chosen.has(s)) continue;
      pathSegment(ctx, s, step);
    }
    ctx.stroke();
  } else {
    // Ghost everything else, then lay the isolated territories over it.
    ctx.strokeStyle = css.getPropertyValue('--ink').trim();
    ctx.globalAlpha = 0.05 * dim;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let s = 0; s < f.nSeg; s++) {
      if (iso.has(flow.segTerr[s])) continue;
      if (chosen && chosen.has(s)) continue;
      pathSegment(ctx, s, step);
    }
    ctx.stroke();
    for (let tt = 0; tt < nT; tt++) {
      if (!iso.has(tt)) continue;
      ctx.strokeStyle = css.getPropertyValue('--t' + tt).trim();
      ctx.globalAlpha = 0.42 * dim;
      ctx.lineWidth = Math.max(lw, 0.7);
      ctx.beginPath();
      for (let s = 0; s < f.nSeg; s++) {
        if (flow.segTerr[s] !== tt) continue;
        if (chosen && chosen.has(s)) continue;
        pathSegment(ctx, s, step);
      }
      ctx.stroke();
    }
  }

  // the chosen lineage, over the top, in one ink
  if (chosen && chosen.size) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = css.getPropertyValue('--select').trim();
    ctx.lineWidth = Math.max(1.6, lw * 2.4);
    ctx.beginPath();
    for (const s of chosen) pathSegment(ctx, s, 1);
    ctx.stroke();
    // mark the divisions on it
    ctx.fillStyle = ctx.strokeStyle;
    for (const s of chosen) {
      if (f.kidOff[s + 1] - f.kidOff[s] < 2) continue;
      const i = f.off[s] + f.len[s] - 1;
      ctx.beginPath(); ctx.arc(sx(flow.xs[i]), sy(flow.ys[i]), 2.6, 0, 7); ctx.fill();
    }
  }

  // hover feedback, light
  if (flow.hover >= 0 && (!chosen || !chosen.has(flow.hover))) {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = css.getPropertyValue('--ink').trim();
    ctx.lineWidth = 1.3;
    ctx.beginPath(); pathSegment(ctx, flow.hover, 1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* Nearest sample to a point, returned as its segment index. Brute force over
 * every sample: ~570k distance tests, a few ms, and it needs no index to keep
 * in step with the axis flip. */
function flowPick(px, py) {
  const f = FM.flow;
  let best = -1, bd = 12 * 12;
  const b = contentBox();
  const kx = b.w * flow.k, ky = b.h * flow.k;
  const ox = MARGIN.l + flow.tx, oy = MARGIN.t + flow.ty;
  for (let s = 0; s < f.nSeg; s++) {
    const o = f.off[s], L = f.len[s];
    for (let j = 0; j < L; j++) {
      const i = o + j;
      const x = ox + flow.xs[i] * kx - px;
      if (x > 12 || x < -12) continue;
      const y = oy + flow.ys[i] * ky - py;
      if (y > 12 || y < -12) continue;
      const dd = x * x + y * y;
      if (dd < bd) { bd = dd; best = s; }
    }
  }
  return best;
}
