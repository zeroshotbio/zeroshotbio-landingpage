/* ============================================================
   bp-draw.js — the tile drawing vocabulary.

   ONE UNIT GOVERNS EVERYTHING
   Every tile computes u = S/100 where S is its square side, and every size on
   it — type, stroke, tick length, dot radius, dash gap, padding — is a
   multiple of u. There is not one fixed pixel value in this file or the next.
   The tiles are small in the column and large in the preview and must read
   identically in both; a single hardcoded 12px breaks that everywhere at once
   and is invisible at the size you happened to be looking at.

   Load order: pop -> draw -> tiles -> data -> view
   ============================================================ */

/* ---- palette --------------------------------------------------------------
   keep = survives.  cull = leaving.  accent = the threshold and its number.
   Nothing else on a tile gets colour: if a third hue appears, one of these
   three has stopped meaning what it says. */
const PAL = {
  dark:  { bg: "#0E1418", grid: "#1F2A31", ink: "#DCE6EB", dim: "#7C8D95",
           keep: "#79D2BE", cull: "#8C7150", accent: "#DCC584" },
  light: { bg: "#ECEEE9", grid: "#D6DAD3", ink: "#1B2422", dim: "#6E7A75",
           keep: "#1F8069", cull: "#8A6B42", accent: "#8A6A24" }
};

/* ---- settled geometry — do not re-derive ---------------------------------- */
const PAD = { l: 20, r: 6, t: 22, b: 19 };        /* in u */
const TYPE_ = {
  title: { s: 5.6, w: 600, ls: 0.10 },
  axis:  { s: 4.4, w: 600, ls: 0.22 },            /* caps */
  label: { s: 4.6, w: 600, ls: 0.14 },
  tick:  { s: 4.0, w: 400, ls: 0.02 },
  big:   { s: 7.0, w: 600, ls: 0.02 }
};
const W = { stroke: 1.0, curve: 1.5, hair: 0.6 };

const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace';

/* ---- easing ---------------------------------------------------------------
   A cull is a physical event, so it gets a physical curve. Linear motion
   reads as a slideshow. */
const ease = {
  io:   t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  out:  t => 1 - Math.pow(1 - t, 3),
  in_:  t => t * t * t,
  back: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
};
/* map a global 0..1 loop position onto one beat's own 0..1, clamped */
const beat = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* ============================================================
   A TILE CONTEXT
   Everything a draw function needs, computed once per frame. `u` is the unit;
   px()/py() map plot coordinates in 0..1 to canvas pixels inside the frame.
   ============================================================ */
function tileCtx(ctx, S, theme) {
  const u = S / 100, P = PAL[theme] || PAL.dark;
  const L = PAD.l * u, R = S - PAD.r * u, T = PAD.t * u, B = S - PAD.b * u;
  return {
    ctx, S, u, P, L, R, T, B, w: R - L, h: B - T,
    px: t => L + t * (R - L),
    py: t => B - t * (B - T)          /* 0 at the axis, 1 at the top */
  };
}

function font(c, k) {
  const t = TYPE_[k];
  c.ctx.font = `${t.w} ${t.s * c.u}px ${MONO}`;
  return t;
}

/* ============================================================
   TEXT THAT CANNOT OVERFLOW

   NEVER estimate a string's width from a character count. The advance of the
   monospace stack is not a constant across machines: it is 0.60 em with SF
   Mono on a Mac and 0.93 em with the default monospace in headless Chromium,
   a 55% difference. Layouts here were first sized against a guessed 0.6 and
   three of the six tiles ran their annotations off the canvas on a box that
   resolved the font differently. Measure, then place. Everything below goes
   through ctx.measureText and nothing guesses.

   `max` shrinks the type to fit rather than letting it spill, down to a floor
   where it would stop being legible; past that the caller has asked for
   something that does not fit and should shorten the string instead.
   ============================================================ */
const MIN_SIZE = 3.4;                       /* in u — below this, unreadable */

function measure(c, str, size, ls) {
  const chars = String(str).split("");
  return chars.reduce((s, ch) => s + c.ctx.measureText(ch).width + ls, 0) - ls;
}

/* Letterspacing by hand. `ctx.letterSpacing` exists in Chrome and nowhere
   reliable, and this text is short, so it is drawn a glyph at a time. */
function tracked(c, str, x, y, k, colour, align = "left", max) {
  const t = TYPE_[k];
  let size = t.s, ls = t.ls * c.u, wid;
  c.ctx.font = `${t.w} ${size * c.u}px ${MONO}`;
  wid = measure(c, str, size, ls);
  if (max && wid > max) {
    size = Math.max(MIN_SIZE, size * (max / wid));
    ls = t.ls * c.u * (size / t.s);
    c.ctx.font = `${t.w} ${size * c.u}px ${MONO}`;
    wid = measure(c, str, size, ls);
  }
  let cx = align === "left" ? x : align === "right" ? x - wid : x - wid / 2;

  /* Instrumentation for check-text.mjs. Canvas text leaves no DOM to inspect,
     so the only way to test that a label stays inside its tile — the bug that
     shipped three times while I checked by eye — is to record it as it is
     drawn. Off unless a checker turns it on; costs nothing when off.

     The box is mapped through the CURRENT transform before it is logged,
     because the rotated y-axis titles are drawn at the origin of a rotated
     frame: logging their raw coordinates reported every one of them as
     hanging off the left edge, which is a false alarm the checker would then
     train you to ignore. */
  if (typeof window !== "undefined" && window.__BP_TEXTLOG) {
    const h = size * c.u, top = y - h * 0.78;
    const m = c.ctx.getTransform ? c.ctx.getTransform() : null;
    const map = (px, py) => m
      ? { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f }
      : { x: px, y: py };
    const pts = [map(cx, top), map(cx + wid, top), map(cx, top + h), map(cx + wid, top + h)];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    window.__BP_TEXTLOG.push({
      s: String(str),
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      S: c.S, size
    });
  }

  c.ctx.fillStyle = colour;
  c.ctx.textBaseline = "alphabetic";
  for (const ch of String(str)) {
    c.ctx.fillText(ch, cx, y);
    cx += c.ctx.measureText(ch).width + ls;
  }
  return wid;
}
function trackedWidth(c, str, k) {
  const t = font(c, k);
  return measure(c, str, t.size, t.ls * c.u);
}

/* ============================================================
   THE FRAME — a bold L with a filled arrowhead on each open end.

   Not a box. A box implies the data is bounded on all four sides, which is
   false for every plot here: the rank curve runs off to the right and the
   scatter runs off the top. An L with arrows says "these two axes, and they
   keep going", which is the truth.
   ============================================================ */
function frameL(c, xTitle, yTitle) {
  const { ctx, u, P, L, R, T, B } = c;
  ctx.strokeStyle = P.ink; ctx.lineWidth = W.stroke * u; ctx.lineCap = "butt";
  const head = 2.4 * u;
  ctx.beginPath();
  ctx.moveTo(L, T + head); ctx.lineTo(L, B); ctx.lineTo(R - head, B);
  ctx.stroke();

  ctx.fillStyle = P.ink;                                    /* arrowheads */
  ctx.beginPath();
  ctx.moveTo(L, T); ctx.lineTo(L - head * 0.52, T + head); ctx.lineTo(L + head * 0.52, T + head);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(R, B); ctx.lineTo(R - head, B - head * 0.52); ctx.lineTo(R - head, B + head * 0.52);
  ctx.closePath(); ctx.fill();

  if (yTitle) {
    ctx.save();
    ctx.translate(5.5 * u, (T + B) / 2);
    ctx.rotate(-Math.PI / 2);
    tracked(c, yTitle, 0, 0, "axis", P.dim, "center");
    ctx.restore();
  }
  if (xTitle) tracked(c, xTitle, (L + R) / 2, c.S - 4.5 * u, "axis", P.dim, "center");
}

/* A plain hairline boundary, for tile 01 — a field is not a plot and must not
   be given axes it does not have. */
function frameBox(c) {
  const { ctx, u, P, L, R, T, B } = c;
  ctx.strokeStyle = P.grid; ctx.lineWidth = W.hair * u;
  ctx.strokeRect(L, T, R - L, B - T);
}

/* Three ticks per axis maximum, labelled as plain numbers. Never superscript
   powers — at tile size they turn to mush. */
function ticksX(c, vals, fmt) {
  const { ctx, u, P, B } = c;
  ctx.strokeStyle = P.dim; ctx.lineWidth = W.hair * u;
  vals.forEach(([t, v]) => {
    const x = c.px(t);
    ctx.beginPath(); ctx.moveTo(x, B); ctx.lineTo(x, B + 1.6 * u); ctx.stroke();
    tracked(c, fmt(v), x, B + 6.2 * u, "tick", P.dim, "center");
  });
}
function ticksY(c, vals, fmt) {
  const { ctx, u, P, L } = c;
  ctx.strokeStyle = P.dim; ctx.lineWidth = W.hair * u;
  vals.forEach(([t, v]) => {
    const y = c.py(t);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L - 1.6 * u, y); ctx.stroke();
    tracked(c, fmt(v), L - 3.0 * u, y + 1.4 * u, "tick", P.dim, "right");
  });
}

/* ============================================================
   ANNOTATION

   A label never sits on the thing it labels. It goes in open space and a
   hairline leader runs back to the referent, ending in a small filled dot.
   The leader is 0.6u — deliberately thinner than anything it points at — so
   it reads as annotation rather than as data.

   lines: array of strings, stacked. Stack rather than shrink: a two-line
   label at full size is legible, a one-line label at 3u is not.
   ============================================================ */
function annotate(c, lines, lx, ly, tx, ty, colour, align = "left") {
  const { ctx, u, S } = c;
  const col = colour || c.P.dim;

  /* Clamp the label block inside the tile BEFORE drawing the leader, so the
     leader lands on the text it actually points at. The margin is the same
     1.5u on both sides; the block's own width is measured, never assumed. */
  const M = 1.5 * u;
  const wid = Math.max(...lines.map(s => trackedWidth(c, s, "label")));
  const avail = S - 2 * M;
  if (align === "left")  lx = Math.max(M, Math.min(lx, S - M - Math.min(wid, avail)));
  else if (align === "right") lx = Math.min(S - M, Math.max(lx, M + Math.min(wid, avail)));
  else lx = Math.max(M + wid / 2, Math.min(lx, S - M - wid / 2));

  ctx.strokeStyle = col; ctx.lineWidth = W.hair * u;
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(tx, ty, 0.85 * u, 0, Math.PI * 2); ctx.fill();
  lines.forEach((s, i) => tracked(c, s, lx, ly + i * 5.4 * u, "label", col, align, avail));
}

/* The number the step produces — the largest thing on the tile, top-right,
   above the frame so it never lands on data. */
function bigNumber(c, str, sub, colour) {
  const { u, P, R, S } = c;
  tracked(c, str, R, 12.5 * u, "big", colour || P.accent, "right", S * 0.52);
  if (sub) tracked(c, sub, R, 17.6 * u, "tick", P.dim, "right", S * 0.58);
}

function tileTitle(c, n, name) {
  const { u, P } = c;
  const wid = tracked(c, n, 5.5 * u, 9.4 * u, "title", P.dim, "left");
  tracked(c, name, 5.5 * u + wid + 2.6 * u, 9.4 * u, "title", P.ink, "left", c.S * 0.40);
}

/* ---- dots -----------------------------------------------------------------
   One call, because every tile draws thousands of them and the per-dot
   save/restore of a naive version is the whole frame budget. */
function dot(c, x, y, r, colour, alpha) {
  const { ctx } = c;
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* A dashed rule at a threshold, in the accent colour, with its value. This is
   the one mark that means "the cut" and it looks the same on every tile. */
function threshLine(c, kind, t, label, alpha = 1) {
  const { ctx, u, P, L, R, T, B } = c;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = P.accent; ctx.lineWidth = W.stroke * u;
  ctx.setLineDash([2.2 * u, 1.8 * u]);
  ctx.beginPath();
  if (kind === "v") { const x = c.px(t); ctx.moveTo(x, T); ctx.lineTo(x, B); }
  else { const y = c.py(t); ctx.moveTo(L, y); ctx.lineTo(R, y); }
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    if (kind === "v") tracked(c, label, c.px(t) + 1.8 * u, T + 4.4 * u, "label", P.accent, "left");
    else tracked(c, label, R, c.py(t) - 1.8 * u, "label", P.accent, "right");
  }
  ctx.restore();
}

/* ---- formatting ----------------------------------------------------------- */
const fmtInt = n => Math.round(n).toLocaleString("en-US");
/* plain numbers on axes: 100, 1k, 10k — never 10^4 */
const fmtLog = v => {
  if (v >= 1e6) return (v / 1e6 >= 10 ? Math.round(v / 1e6) : +(v / 1e6).toFixed(1)) + "M";
  if (v >= 1000) return (v / 1000 >= 10 ? Math.round(v / 1000) : +(v / 1000).toFixed(1)) + "k";
  return String(Math.round(v));
};
const fmtPct = v => v.toFixed(v < 10 ? 1 : 0) + "%";
