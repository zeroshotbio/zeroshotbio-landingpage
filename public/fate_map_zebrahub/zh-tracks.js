/* /fate_map_zebrahub — Plate IV, the other motion.
 *
 * A living embryo's tail under a light sheet: 101,676 nuclei followed across
 * 791 frames through 36,878 divisions. THIS plate is allowed the lineage
 * vocabulary the first three are not — a nucleus here really was watched
 * dividing, and both daughters really were followed afterwards.
 *
 * What it cannot say is what any of them was expressing. It is a different
 * embryo from the forty that were sequenced, and no registration between the
 * two exists or is attempted.
 *
 * The interaction is the authors' in-silico fate mapping done the short way:
 * rather than fit a radial regression to predict where a region goes, click a
 * place and the plate simply draws the tracks that were REALLY there, backward
 * to where those cells came from and forward to where they went. Observed
 * beats modelled when the observation exists.
 */
'use strict';

const tr = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, raf: 0,
  frame: 0, view: 'xy', sel: null, selTracks: null,   // frame set in trInit
  sx: 1, sy: 1, ox: 0, oy: 0,
};

function trInit(cv, hold) {
  tr.cv = cv; tr.hold = hold;
  // Open where the movie is fullest rather than at frame 0, which holds a
  // seventh of the nuclei and reads as a smudge in the corner.
  let best = 0, bn = -1;
  for (let f = 0; f < ZH.tracks.nF; f++) {
    const n = ZH.frameOff[f + 1] - ZH.frameOff[f];
    if (n > bn) { bn = n; best = f; }
  }
  tr.frame = Math.round(best * 0.6);
  trResize();
}

function trResize() {
  tr.W = tr.hold.clientWidth; tr.H = tr.hold.clientHeight;
  const r = zhSizeCanvas(tr.cv, tr.W, tr.H);
  tr.ctx = r.ctx;
  const b = ZH.tbounds, pad = 40;
  // side view is x against y; from above is x against z
  const w = b.x1 - b.x0;
  const h = (tr.view === 'xy') ? (b.y1 - b.y0) : (b.z1 - b.z0);
  const k = Math.min((tr.W - 2 * pad) / w, (tr.H - 2 * pad) / h);
  tr.sx = k; tr.sy = k;
  tr.ox = tr.W / 2 - ((b.x0 + b.x1) / 2) * k;
  tr.oy = tr.H / 2 + ((tr.view === 'xy' ? (b.y0 + b.y1) : (b.z0 + b.z1)) / 2) * k;
  trDraw();
}

const tX = (i) => tr.ox + ZH.tracks.x[i] * tr.sx;
const tY = (i) => tr.oy - (tr.view === 'xy' ? ZH.tracks.y[i] : ZH.tracks.z[i]) * tr.sy;

function trDraw() {
  if (tr.raf) return;
  tr.raf = requestAnimationFrame(() => { tr.raf = 0; trPaint(); });
}

function trPaint() {
  const ctx = tr.ctx, T = ZH.tracks, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const paper = css.getPropertyValue('--paper').trim();
  const past = css.getPropertyValue('--past').trim();
  const future = css.getPropertyValue('--future').trim();
  const sel = css.getPropertyValue('--select').trim();
  ctx.clearRect(0, 0, tr.W, tr.H);

  const f = tr.frame;
  const a = ZH.frameOff[f], b = ZH.frameOff[f + 1];

  // the nuclei present in this frame
  ctx.fillStyle = ink; ctx.globalAlpha = tr.selTracks ? 0.13 : 0.34;
  zhFillPoints(ctx, (pt) => {
    for (let k = a; k < b; k++) { const i = ZH.frameIdx[k]; pt(tX(i), tY(i)); }
  }, 1.5);
  ctx.globalAlpha = 1;

  // the chosen cells, drawn as their whole recorded path
  if (tr.selTracks && tr.selTracks.size) {
    ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const dir of ['past', 'future']) {
      ctx.strokeStyle = dir === 'past' ? past : future;
      ctx.globalAlpha = 0.5;
      zhStrokeChunked(ctx, (move, line, done) => {
        for (const k of tr.selTracks) {
          const s = T.start[k], e = s + T.len[k];
          let started = false;
          for (let i = s; i < e; i++) {
            const keep = dir === 'past' ? T.t[i] <= f : T.t[i] >= f;
            if (!keep) { started = false; continue; }
            if (!started) { move(tX(i), tY(i)); started = true; }
            else line(tX(i), tY(i));
          }
          done();
        }
      });
    }
    // where those cells are right now
    ctx.globalAlpha = 1; ctx.fillStyle = sel;
    zhFillPoints(ctx, (pt) => {
      for (let k = a; k < b; k++) {
        const i = ZH.frameIdx[k];
        if (tr.selTracks.has(ZH.trackOf[i])) pt(tX(i) - 0.6, tY(i) - 0.6);
      }
    }, 3.0);
    // and the ring the reader drew
    if (tr.sel) {
      ctx.strokeStyle = sel; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(tr.sel.px, tr.sel.py, tr.sel.r, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // furniture
  const mins = (f * ZH.meta.track_step) | 0;
  const label = `frame ${f * ZH.meta.track_step} of ${ZH.meta.counts.track_frames}` +
    `  ·  ${(b - a).toLocaleString()} nuclei in view`;
  ctx.font = '500 10px ui-sans-serif,system-ui,sans-serif';
  const w = ctx.measureText(label).width;
  ctx.fillStyle = paper; ctx.fillRect(10, tr.H - 24, w + 12, 16);
  ctx.fillStyle = ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(label, 16, tr.H - 10);

  ctx.textAlign = 'right';
  ctx.fillText(tr.view === 'xy' ? 'side view (x, y)' : 'from above (x, z)', tr.W - 14, tr.H - 10);
}

/* Everything within a radius of the click, at the CURRENT frame — the cells
 * that were really in that spot at that moment. */
function trSelect(px, py, radius) {
  const T = ZH.tracks, f = tr.frame;
  const a = ZH.frameOff[f], b = ZH.frameOff[f + 1];
  const out = new Set();
  const r2 = radius * radius;
  for (let k = a; k < b; k++) {
    const i = ZH.frameIdx[k];
    const dx = tX(i) - px, dy = tY(i) - py;
    if (dx * dx + dy * dy <= r2) out.add(ZH.trackOf[i]);
  }
  return out;
}

/* How far the selection reaches in time, and how many of its tracks have a
 * recorded parent — i.e. arose from a division inside the movie. */
function trStats(set) {
  const T = ZH.tracks;
  let t0 = Infinity, t1 = -Infinity, withParent = 0;
  for (const k of set) {
    const s = T.start[k], e = s + T.len[k];
    if (T.t[s] < t0) t0 = T.t[s];
    if (T.t[e - 1] > t1) t1 = T.t[e - 1];
    if (T.parent[k] >= 0) withParent++;
  }
  return { n: set.size, t0, t1, withParent };
}
