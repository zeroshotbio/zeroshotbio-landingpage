/* /fate_map_daniocell — Plate I, the transcriptional landscape.
 *
 * One fixed 2D projection of all 489,686 cells, drawn in one ink. The scrubber
 * does not move the cells; it moves a WINDOW over developmental time, and the
 * cells collected at or before that stage are the ones inked in. Everything
 * else stays as a faint ground so the reader can see the shape of the whole
 * atlas while looking at one moment of it.
 *
 * The embedding is a UMAP. Distance in it is not a quantity: two populations
 * far apart are not "more different" by any stated amount, and a population
 * that seems to move between stages is a population whose expression changed,
 * not one that travelled. The caption says so; keep it saying so.
 */
'use strict';

const land = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, dpr: 1,
  mode: 'time',          // 'time' | 'tissue'
  stage: 0,              // index into meta.stages; the right edge of the window
  held: -1,              // a cluster index the reader clicked
  raf: 0, sx: 1, sy: 1, ox: 0, oy: 0,
};

function landInit(cv, hold) {
  land.cv = cv; land.hold = hold; land.ctx = cv.getContext('2d');
  land.stage = DC.meta.stages.length - 1;
  landResize();
}

function landResize() {
  land.dpr = Math.min(window.devicePixelRatio || 1, 2);
  land.W = land.hold.clientWidth; land.H = land.hold.clientHeight;
  land.cv.width = Math.round(land.W * land.dpr);
  land.cv.height = Math.round(land.H * land.dpr);
  land.cv.style.height = land.H + 'px';
  land.ctx.setTransform(land.dpr, 0, 0, land.dpr, 0, 0);
  const b = DC.bounds, pad = 26;
  const k = Math.min((land.W - 2 * pad) / (b.x1 - b.x0), (land.H - 2 * pad) / (b.y1 - b.y0));
  land.sx = k; land.sy = -k;                       // flip y: canvas grows downward
  land.ox = land.W / 2 - ((b.x0 + b.x1) / 2) * k;
  land.oy = land.H / 2 + ((b.y0 + b.y1) / 2) * k;
  landDraw();
}

const landX = (i) => land.ox + DC.cells.x[i] * land.sx;
const landY = (i) => land.oy + DC.cells.y[i] * land.sy;

function landDraw() {
  if (land.raf) return;
  land.raf = requestAnimationFrame(() => { land.raf = 0; landPaint(); });
}

function landPaint() {
  const ctx = land.ctx, C = DC.cells, css = getComputedStyle(document.body);
  ctx.clearRect(0, 0, land.W, land.H);

  const ink = css.getPropertyValue('--ink').trim();
  const iso = state.iso;                       // isolated tissue indices
  const upto = land.stage;

  // 1. the whole atlas as ground — this is the shape the reader keeps
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.055;
  ctx.beginPath();
  for (let i = 0; i < C.n; i++) {
    const x = landX(i), y = landY(i);
    ctx.rect(x, y, 0.8, 0.8);
  }
  ctx.fill();

  // 2. the cells collected at or before the scrubbed stage
  if (!iso.size) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.30;
    ctx.beginPath();
    for (let i = 0; i < C.n; i++) {
      if (C.t[i] > upto) continue;
      ctx.rect(landX(i), landY(i), 1.0, 1.0);
    }
    ctx.fill();
  } else {
    // isolated tissues get their wash; everything else in the window stays ink
    ctx.fillStyle = ink; ctx.globalAlpha = 0.10;
    ctx.beginPath();
    for (let i = 0; i < C.n; i++) {
      if (C.t[i] > upto || iso.has(C.s[i])) continue;
      ctx.rect(landX(i), landY(i), 0.9, 0.9);
    }
    ctx.fill();
    let k = 0;
    for (const t of iso) {
      ctx.fillStyle = css.getPropertyValue('--t' + (k++ % 7)).trim();
      ctx.globalAlpha = 0.68;
      ctx.beginPath();
      for (let i = 0; i < C.n; i++) {
        if (C.t[i] > upto || C.s[i] !== t) continue;
        ctx.rect(landX(i), landY(i), 1.3, 1.3);
      }
      ctx.fill();
    }
  }

  // 3. the newest stage, picked out — this is what "appearing" looks like
  if (land.mode === 'time' && upto > 0) {
    ctx.fillStyle = css.getPropertyValue('--select').trim();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < C.n; i++) {
      if (C.t[i] !== upto) continue;
      ctx.rect(landX(i), landY(i), 1.5, 1.5);
    }
    ctx.fill();
  }

  // 4. a held state, across all of time
  if (land.held >= 0) {
    const idx = DC.cellsOfCluster(land.held);
    ctx.fillStyle = css.getPropertyValue('--select').trim();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      ctx.rect(landX(i) - 0.5, landY(i) - 0.5, 2.2, 2.2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  landFurniture(ctx, css);
}

function landFurniture(ctx, css) {
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const paper = css.getPropertyValue('--paper').trim();
  const st = DC.meta.stages;
  ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  ctx.fillStyle = ink3;
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  const label = land.mode === 'time'
    ? `${st[land.stage]} hpf — ${DC.stageCount[land.stage].toLocaleString()} cells collected at this stage`
    : `all ${DC.cells.n.toLocaleString()} cells`;
  const w = ctx.measureText(label).width;
  ctx.fillStyle = paper; ctx.fillRect(10, land.H - 24, w + 12, 16);
  ctx.fillStyle = ink3; ctx.fillText(label, 16, land.H - 10);
}

/* Nearest cell to a pointer, returned as its CLUSTER index. Brute force over
 * 489,686 points with a cheap bounding reject: a few ms, and it needs no index
 * that could fall out of step with the transform. */
function landPick(px, py) {
  const C = DC.cells;
  let best = -1, bd = 10 * 10;
  for (let i = 0; i < C.n; i++) {
    if (C.t[i] > land.stage) continue;
    const dx = landX(i) - px;
    if (dx > 10 || dx < -10) continue;
    const dy = landY(i) - py;
    if (dy > 10 || dy < -10) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = C.c[i]; }
  }
  return best;
}
