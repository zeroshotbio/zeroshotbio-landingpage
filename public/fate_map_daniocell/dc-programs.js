/* /fate_map_daniocell — Plate III, the shared programs.
 *
 * The nineteen tissue subsets sit on a ring. Each SHARED gene expression
 * program is drawn as a constellation: a closed figure through the tissues that
 * deploy it. A program used by four unrelated tissues is a four-sided figure
 * spanning the ring, and the plate's argument is the pile of them — development
 * assembles very different cells out of a small reusable vocabulary.
 *
 * What the edges are, exactly: the authors' own curated annotation of each
 * module ("Tissue(s) expressed" in Table S5), normalised onto the nineteen
 * subsets by the build script. They are a careful human reading of where a
 * module is expressed, NOT a computed module-by-cell-type matrix — the binary
 * heatmap behind the paper's Figure 3A is not in the deposit. Some modules the
 * authors described only in prose ("lots of tissues"); those carry a BROAD mark
 * and no edges, because inventing nineteen edges for them would be a fiction
 * that looked like data.
 */
'use strict';

const prog = {
  cv: null, ctx: null, hold: null, W: 0, H: 0, dpr: 1,
  sel: -1, hover: -1, raf: 0, nodes: [],
};

function progInit(cv, hold) {
  prog.cv = cv; prog.hold = hold; prog.ctx = cv.getContext('2d');
  progResize();
}

function progResize() {
  prog.W = prog.hold.clientWidth; prog.H = prog.hold.clientHeight;
  const r = dcSizeCanvas(prog.cv, prog.W, prog.H);
  prog.ctx = r.ctx; prog.dpr = r.dpr;

  // Tissues on a ring, in the atlas's own order so neighbours on the ring are
  // neighbours in the atlas's own grouping rather than in an arbitrary one.
  const keys = DC.meta.tissues.map(t => t.key).filter(k => k !== 'cephalic');
  const cx = prog.W / 2, cy = prog.H / 2;
  const R = Math.min(prog.W, prog.H) / 2 - 86;
  prog.nodes = keys.map((k, i) => {
    const a = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    return { key: k, a, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  prog.nodeIx = {};
  prog.nodes.forEach((n, i) => { prog.nodeIx[n.key] = i; });
  prog.cx = cx; prog.cy = cy; prog.R = R;
  progDraw();
}

function progDraw() {
  if (prog.raf) return;
  prog.raf = requestAnimationFrame(() => { prog.raf = 0; progPaint(); });
}

/* A constellation: through its tissues, bowed toward the centre so that many
 * of them overlaid read as density rather than as a scribble of chords. */
function progPath(ctx, mod, bow) {
  const pts = mod.tissues.map(t => prog.nodes[prog.nodeIx[t]]).filter(Boolean);
  if (pts.length < 2) return 0;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(prog.cx + (mx - prog.cx) * bow, prog.cy + (my - prog.cy) * bow, b.x, b.y);
    if (pts.length === 2) break;            // a pair is one arc, not a loop
  }
  return pts.length;
}

function progPaint() {
  const ctx = prog.ctx, css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim();
  const ink3 = css.getPropertyValue('--ink-3').trim();
  const rule2 = css.getPropertyValue('--rule-2').trim();
  const sel = css.getPropertyValue('--select').trim();
  const paper = css.getPropertyValue('--paper').trim();
  ctx.clearRect(0, 0, prog.W, prog.H);

  const shared = DC.programs.filter(m => m.shared && m.tissues.length >= 2);

  // the ring
  ctx.strokeStyle = rule2; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(prog.cx, prog.cy, prog.R, 0, 7); ctx.stroke();

  // every shared program, one ink — the pile IS the argument
  ctx.strokeStyle = ink; ctx.lineWidth = 0.6;
  ctx.globalAlpha = prog.sel >= 0 ? 0.05 : 0.17;
  ctx.beginPath();
  for (const m of shared) { if (DC.programs.indexOf(m) !== prog.sel) progPath(ctx, m, 0.42); }
  ctx.stroke();

  // the chosen program
  if (prog.sel >= 0) {
    const m = DC.programs[prog.sel];
    ctx.globalAlpha = 1; ctx.strokeStyle = sel; ctx.lineWidth = 1.8;
    ctx.beginPath(); progPath(ctx, m, 0.42); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // nodes + labels
  for (const n of prog.nodes) {
    const lit = prog.sel >= 0 && DC.programs[prog.sel].tissues.includes(n.key);
    ctx.fillStyle = lit ? sel : ink;
    ctx.beginPath(); ctx.arc(n.x, n.y, lit ? 4.2 : 2.4, 0, 7); ctx.fill();
    const out = 14;
    const lx = n.x + Math.cos(n.a) * out, ly = n.y + Math.sin(n.a) * out;
    ctx.font = lit ? '600 11px ui-sans-serif,system-ui,sans-serif'
                   : '500 10.5px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = lit ? sel : ink3;
    const right = Math.cos(n.a) > 0.15, left = Math.cos(n.a) < -0.15;
    ctx.textAlign = right ? 'left' : left ? 'right' : 'center';
    ctx.textBaseline = Math.sin(n.a) > 0.6 ? 'top' : Math.sin(n.a) < -0.6 ? 'bottom' : 'middle';
    const w = ctx.measureText(n.key).width;
    ctx.save();
    ctx.fillStyle = paper; ctx.globalAlpha = 0.8;
    const bx = ctx.textAlign === 'left' ? lx - 2 : ctx.textAlign === 'right' ? lx - w - 2 : lx - w / 2 - 2;
    ctx.fillRect(bx, ly - 7, w + 4, 14);
    ctx.restore();
    ctx.fillStyle = lit ? sel : ink3;
    ctx.fillText(n.key, lx, ly);
  }

  // the chosen program, written in the middle of its own constellation
  if (prog.sel >= 0) {
    const m = DC.programs[prog.sel];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 14px Georgia,serif';
    const t1 = m.desc || m.id;
    const t2 = m.broad ? 'also described as broadly deployed'
                       : `${m.tissues.length} tissues`;
    const w = Math.max(ctx.measureText(t1).width, 150);
    ctx.fillStyle = paper; ctx.globalAlpha = 0.9;
    ctx.fillRect(prog.cx - w / 2 - 10, prog.cy - 22, w + 20, 44);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink; ctx.fillText(t1, prog.cx, prog.cy - 6);
    ctx.font = '500 10.5px ui-sans-serif,system-ui,sans-serif';
    ctx.fillStyle = ink3; ctx.fillText(t2, prog.cx, prog.cy + 12);
  }
}
