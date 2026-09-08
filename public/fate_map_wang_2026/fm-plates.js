/* /fate_map_wang_2026 — Plates I and III.
 *
 * Both plates are the SAME projection at the SAME scale: an azimuthal
 * equidistant map of the fitted sphere seen down the animal pole, radius
 * proportional to latitude, so the animal pole is the centre, the equator is
 * the half-radius circle and the vegetal pole is the rim.
 *
 * Keeping the scale identical between the two plates is the point of the pair.
 * At 5.5 hpf the blastoderm is a cap that stops at the equator and fills only
 * the inner half of the disc; by 11.3 hpf it has closed over the whole sphere.
 * Rescaling Plate I to fill its frame would look tidier and would throw that
 * away, so don't.
 *
 * Dorsal (lon 0) is drawn to the right. The two flanks at lon ±90 are labelled
 * "flank" and never "left" / "right": which is which cannot be recovered from
 * the deposited coordinates, and guessing would be an invented fact.
 */
'use strict';

const PLATE_PAD = 62;          // gutter: the cardinal labels live outside the disc

/* Both plates use the SAME degrees-per-pixel. Plate I only needs to reach a
 * little past the equator, so its canvas is drawn SMALLER rather than its
 * projection drawn larger — the growth of the sheet between the plates is then
 * a real change in size on the page instead of a rescaling that hides it. */
const PLATE_I_LAT = 108;

/* A circle drawn as a pen would draw it: a closed polyline whose radius carries
 * a small, deterministic wobble. Furniture only — never a data mark. */
function penCircle(ctx, cx, cy, r, seed) {
  const N = 220;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const w = 1 + 0.0030 * Math.sin(3 * t + seed) + 0.0020 * Math.sin(7 * t + seed * 2.3);
    const rr = r * w;
    const x = cx + rr * Math.cos(t), y = cy + rr * Math.sin(t);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function plateGeom(canvas, latMax) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const col = canvas.parentElement.clientWidth || 520;
  const Rfull = col / 2 - PLATE_PAD;            // radius of a full 0..180 disc
  const R = Rfull * (latMax / 180);
  const side = Math.round(2 * (R + PLATE_PAD));
  canvas.width = Math.round(side * dpr);
  canvas.height = Math.round(side * dpr);
  canvas.style.width = side + 'px';
  canvas.style.height = side + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: side, h: side, cx: side / 2, cy: side / 2, R: Rfull, latMax };
}

/* lat/lon in hundredths of a degree (as stored) -> screen */
function project(g, latH, lonH) {
  const r = (latH / 18000) * g.R;
  const t = (lonH / 100) * Math.PI / 180;
  return [g.cx + r * Math.cos(t), g.cy + r * Math.sin(t)];
}

function drawGraticule(g, opts) {
  const { ctx, cx, cy, R } = g;
  const css = getComputedStyle(document.body);
  const rule = css.getPropertyValue('--rule').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();

  ctx.lineWidth = 1;
  // meridians every 30 degrees, faint
  const Redge = R * (g.latMax / 180);
  ctx.strokeStyle = rule2;
  ctx.beginPath();
  for (let d = 0; d < 360; d += 30) {
    const t = d * Math.PI / 180;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Redge * Math.cos(t), cy + Redge * Math.sin(t));
  }
  ctx.stroke();

  // latitude circles every 30 degrees, out to this plate's edge
  for (let lat = 30; lat <= g.latMax; lat += 30) {
    const r = (lat / 180) * R;
    const equator = lat === 90;
    ctx.strokeStyle = equator ? rule : rule2;
    ctx.setLineDash(equator ? [] : [2, 4]);
    ctx.lineWidth = equator ? 1.1 : 1;
    penCircle(ctx, cx, cy, r, lat);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Cardinal labels, pinned to the CANVAS EDGE. Placing them relative to the
  // rim makes their fit depend on their own rendered width, which clipped at
  // every plate size; the gutter is sized for them instead.
  ctx.save();
  ctx.fillStyle = ink3;
  ctx.font = '500 10.5px ui-sans-serif,system-ui,sans-serif';
  ctx.letterSpacing = '0.16em';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right'; ctx.fillText('DORSAL', g.w - 2, cy);
  ctx.textAlign = 'left';  ctx.fillText('VENTRAL', 2, cy);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';    ctx.fillText('FLANK', cx, 2);
  ctx.textBaseline = 'bottom'; ctx.fillText('FLANK', cx, g.h - 2);
  ctx.restore();

  // the equator, named for what it is at 5.5 hpf
  if (opts && opts.marginLabel) {
    ctx.font = 'italic 11.5px Georgia,serif';
    const wpx = ctx.measureText(opts.marginLabel).width;
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper').trim();
    ctx.fillRect(cx - wpx / 2 - 5, cy - (R / 2) - 18, wpx + 10, 15);
    ctx.fillStyle = ink3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(opts.marginLabel, cx, cy - (R / 2) - 5);
  }
  // animal pole tick
  ctx.fillStyle = ink3;
  ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, 7); ctx.fill();
}

/* Plate I — every cell at 5.5 hpf. Cells whose lineage survives to the last
 * frame are tinted by the territory their descendants end in; the rest are
 * left as bare ink, so the reader can see how much of the sheet the map
 * actually covers. */
function drawFirstPlate(canvas, state) {
  const g = plateGeom(canvas, PLATE_I_LAT);
  const { ctx } = g;
  const d = FM.first, fd = FM.founders;
  const css = getComputedStyle(document.body);
  ctx.clearRect(0, 0, g.w, g.h);
  drawGraticule(g, { marginLabel: 'blastoderm margin' });

  const inkFaint = 'rgba(43,34,25,.20)';
  // untraced cells first, as ground
  ctx.fillStyle = inkFaint;
  ctx.beginPath();
  for (let i = 0; i < d.n; i++) {
    if (d.founder[i] >= 0) continue;
    const [x, y] = project(g, d.lat[i], d.lon[i]);
    ctx.moveTo(x + 1.5, y); ctx.arc(x, y, 1.5, 0, 7);
  }
  ctx.fill();

  // traced founders, batched one path per territory. With nothing isolated
  // every territory is tinted; isolate one and the others drop back to ink, so
  // the plate can be read either as a whole map or one fate at a time.
  const nT = FM.meta.territories.length;
  const iso = state.iso;
  for (let t = 0; t < nT; t++) {
    const on = !iso.size || iso.has(t);
    ctx.fillStyle = on ? css.getPropertyValue('--t' + t).trim() : 'rgba(43,34,25,1)';
    ctx.globalAlpha = on ? 0.88 : 0.10;
    ctx.beginPath();
    for (let i = 0; i < d.n; i++) {
      const fi = d.founder[i];
      if (fi < 0 || fd.dom[fi] !== t) continue;
      const [x, y] = project(g, d.lat[i], d.lon[i]);
      // area with descendant count, gently — a founder of twelve is a bigger
      // contribution than a founder of one and the plate should say so
      const rr = 1.7 + Math.min(2.2, Math.sqrt(fd.count[fi]) * 0.55);
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 7);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // the chosen lineage's founder
  if (state.founder >= 0) {
    for (let i = 0; i < d.n; i++) {
      if (d.founder[i] !== state.founder) continue;
      const [x, y] = project(g, d.lat[i], d.lon[i]);
      ctx.strokeStyle = css.getPropertyValue('--select').trim();
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      break;
    }
  }
  state.geomFirst = g;
}

/* Plate III — every cell at 11.3 hpf, tinted by the territory it is in. */
function drawFinalPlate(canvas, state) {
  const g = plateGeom(canvas, 180);
  const { ctx } = g;
  const d = FM.final;
  const css = getComputedStyle(document.body);
  ctx.clearRect(0, 0, g.w, g.h);
  drawGraticule(g, {});

  const nT = FM.meta.territories.length;
  const iso = state.iso;
  for (let t = 0; t < nT; t++) {
    const on = !iso.size || iso.has(t);
    ctx.fillStyle = on ? css.getPropertyValue('--t' + t).trim() : 'rgba(43,34,25,1)';
    ctx.globalAlpha = on ? 0.9 : 0.10;
    ctx.beginPath();
    for (let i = 0; i < d.n; i++) {
      if (d.terr[i] !== t) continue;
      const [x, y] = project(g, d.lat[i], d.lon[i]);
      ctx.moveTo(x + 1.45, y); ctx.arc(x, y, 1.45, 0, 7);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Name each territory on the plate. Without this the hard angular cuts read
  // as a pie chart of the build script's rules; lettered, the same drawing
  // reads as what it is — a key to the destinations.
  //
  // Placement is the median latitude and the CIRCULAR mean longitude, not the
  // centroid of the projected points: three of these territories wrap the whole
  // way round, and the centroid of a ring is its centre, which piled every such
  // label on top of the animal pole.
  ctx.font = '600 10px ui-sans-serif,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const placed = [];
  for (let t = 0; t < nT; t++) {
    const lats = [];
    let sc = 0, ss = 0, k = 0;
    for (let i = 0; i < d.n; i++) {
      if (d.terr[i] !== t) continue;
      lats.push(d.lat[i]);
      const a = (d.lon[i] / 100) * Math.PI / 180;
      sc += Math.cos(a); ss += Math.sin(a); k++;
    }
    if (k < 200) continue;
    lats.sort((a, b) => a - b);
    const latH = lats[lats.length >> 1];
    const lonH = Math.atan2(ss / k, sc / k) * 180 / Math.PI * 100;
    const label = FM.meta.territories[t].label.toUpperCase();
    const wpx = ctx.measureText(label).width;

    // Search outward along the meridian and to either side of it until the
    // label clears everything already written; give up rather than overprint.
    let box = null;
    search:
    for (let bump = 0; bump <= 5 && !box; bump++) {
      for (const lonOff of [0, 2200, -2200, 4400, -4400]) {
        const [x, y] = project(g, Math.min(17600, latH + bump * 1500), lonH + lonOff);
        const b = { x: x - wpx / 2 - 4, y: y - 7, w: wpx + 8, h: 14, cx: x, cy: y };
        if (b.x < 2 || b.x + b.w > g.w - 2) continue;
        if (!placed.some(q => b.x < q.x + q.w && b.x + b.w > q.x &&
                              b.y < q.y + q.h && b.y + b.h > q.y)) { box = b; break search; }
      }
    }
    if (!box) continue;
    placed.push(box);
    ctx.fillStyle = css.getPropertyValue('--paper').trim();
    ctx.globalAlpha = 0.84;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = css.getPropertyValue('--ink').trim();
    ctx.fillText(label, box.cx, box.cy);
  }

  // descendants of the chosen lineage
  if (state.tipLat && state.tipLat.length) {
    ctx.fillStyle = css.getPropertyValue('--select').trim();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < state.tipLat.length; i++) {
      const [x, y] = project(g, state.tipLat[i], state.tipLon[i]);
      ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill(); ctx.stroke();
    }
  }
  state.geomFinal = g;
}

/* Nearest founder to a click on Plate I, or -1. */
function pickFounder(state, mx, my) {
  const g = state.geomFirst; if (!g) return -1;
  const d = FM.first;
  let best = -1, bd = 14 * 14;
  for (let i = 0; i < d.n; i++) {
    if (d.founder[i] < 0) continue;
    const [x, y] = project(g, d.lat[i], d.lon[i]);
    const dd = (x - mx) * (x - mx) + (y - my) * (y - my);
    if (dd < bd) { bd = dd; best = d.founder[i]; }
  }
  return best;
}
