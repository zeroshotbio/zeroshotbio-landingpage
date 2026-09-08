/* /fate_map_zebrahub — Plate I, the atlas in transcriptional space.
 *
 * 120,444 cells in the authors' own UMAP. The scrubber does not move anything;
 * it selects a stage, and the plate inks either everything collected up to that
 * stage or only that stage's own cells.
 *
 * UMAP distance is not a quantity, and this embedding has a second caveat the
 * siblings do not: it was computed across ten timepoints that were integrated,
 * so some of what looks like continuity between stages is the integration
 * working, not cells moving. Nothing here is lineage.
 */
'use strict';

const atlas = {
  cv: null, ctx: null, hold: null, W: 0, H: 0,
  stage: 9, mode: 'cumul', held: -1, raf: 0,
  sx: 1, sy: 1, ox: 0, oy: 0,
};

function atlasInit(cv, hold) {
  atlas.cv = cv; atlas.hold = hold;
  atlas.stage = ZH.meta.timepoints.length - 1;
  atlasResize();
}

function atlasResize() {
  atlas.W = atlas.hold.clientWidth; atlas.H = atlas.hold.clientHeight;
  const r = zhSizeCanvas(atlas.cv, atlas.W, atlas.H);
  atlas.ctx = r.ctx;
  const b = ZH.bounds, pad = 26;
  const k = Math.min((atlas.W - 2 * pad) / (b.x1 - b.x0), (atlas.H - 2 * pad) / (b.y1 - b.y0));
  atlas.sx = k; atlas.sy = -k;
  atlas.ox = atlas.W / 2 - ((b.x0 + b.x1) / 2) * k;
  atlas.oy = atlas.H / 2 + ((b.y0 + b.y1) / 2) * k;
  atlasDraw();
}

const aX = (i) => atlas.ox + ZH.cells.x[i] * atlas.sx;
const aY = (i) => atlas.oy + ZH.cells.y[i] * atlas.sy;

function atlasDraw() {
  if (atlas.raf) return;
  atlas.raf = requestAnimationFrame(() => { atlas.raf = 0; atlasPaint(); });
}

function atlasPaint() {
  const ctx = atlas.ctx, C = ZH.cells, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const sel = css.getPropertyValue('--select').trim();
  ctx.clearRect(0, 0, atlas.W, atlas.H);

  const iso = state.iso, upto = atlas.stage, only = atlas.mode === 'only';
  const inWindow = (i) => only ? C.t[i] === upto : C.t[i] <= upto;

  // the whole atlas as ground, so the part being shown keeps its context
  ctx.fillStyle = ink; ctx.globalAlpha = 0.05;
  zhFillPoints(ctx, (pt) => { for (let i = 0; i < C.n; i++) pt(aX(i), aY(i)); }, 0.9);

  if (!iso.size) {
    ctx.fillStyle = ink; ctx.globalAlpha = 0.34;
    zhFillPoints(ctx, (pt) => {
      for (let i = 0; i < C.n; i++) if (inWindow(i)) pt(aX(i), aY(i));
    }, 1.1);
  } else {
    ctx.fillStyle = ink; ctx.globalAlpha = 0.10;
    zhFillPoints(ctx, (pt) => {
      for (let i = 0; i < C.n; i++) if (inWindow(i) && !iso.has(C.cls[i])) pt(aX(i), aY(i));
    }, 0.9);
    let k = 0;
    for (const t of iso) {
      ctx.fillStyle = css.getPropertyValue('--t' + (k++ % 7)).trim();
      ctx.globalAlpha = 0.72;
      zhFillPoints(ctx, (pt) => {
        for (let i = 0; i < C.n; i++) if (inWindow(i) && C.cls[i] === t) pt(aX(i), aY(i));
      }, 1.4);
    }
  }

  // a held cluster, across all of time
  if (atlas.held >= 0) {
    ctx.fillStyle = sel; ctx.globalAlpha = 1;
    zhFillPoints(ctx, (pt) => {
      for (let i = 0; i < C.n; i++)
        if (C.cluster[i] === (atlas.held & 0xffff) && C.t[i] === (atlas.held >> 16))
          pt(aX(i) - 0.5, aY(i) - 0.5);
    }, 2.4);
  }
  ctx.globalAlpha = 1;

  const ink3 = css.getPropertyValue('--ink-3').trim();
  const paper = css.getPropertyValue('--paper').trim();
  const tp = ZH.meta.timepoints[upto];
  const label = only
    ? `${tp.name} only — ${tp.cells.toLocaleString()} cells (${tp.stage})`
    : `up to ${tp.name} — ${ZH.meta.timepoints.slice(0, upto + 1)
        .reduce((a, b) => a + b.cells, 0).toLocaleString()} cells`;
  ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  const w = ctx.measureText(label).width;
  ctx.fillStyle = paper; ctx.fillRect(10, atlas.H - 24, w + 12, 16);
  ctx.fillStyle = ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(label, 16, atlas.H - 10);
}

/* Nearest cell, returned as (timepoint<<16 | cluster) — the per-timepoint
 * cluster ids are only unique within their own timepoint, which is the whole
 * reason there are 336 of them and not 51. */
function atlasPick(px, py) {
  const C = ZH.cells;
  const only = atlas.mode === 'only';
  let best = -1, bd = 10 * 10;
  for (let i = 0; i < C.n; i++) {
    if (only ? C.t[i] !== atlas.stage : C.t[i] > atlas.stage) continue;
    const dx = aX(i) - px; if (dx > 10 || dx < -10) continue;
    const dy = aY(i) - py; if (dy > 10 || dy < -10) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = (C.t[i] << 16) | C.cluster[i]; }
  }
  return best;
}
