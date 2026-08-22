/* ============================================================
   ds-plan.js — the plan-view primitives.
   Sibling of /pipeline's pipeline-iso.js, and deliberately its opposite:
   that map is drawn on an isometric axonometric, this one is drawn straight
   down. There is no z here at all. A thing that is "taller" on the pipeline
   map is, here, a thing with a heavier wall or a denser fill.

   Owned by the rendering side. Nothing in this file knows what a bucket is.
   Load order: plan -> shapes -> data -> view
   ============================================================ */

/* ============================================================
   PROJECTION

   P is the whole argument of this page. On /pipeline it is
   ((x-y)*S*cos30, (x+y)*S/2 - z*S*0.76) — a 2:1 dimetric that trades a
   readable footprint for the sense that the map is an object sitting in a
   room. Here it is x*S, y*S: an orthographic plan, camera straight overhead,
   no foreshortening on either axis and no elevation term to carry.

   The consequence worth knowing before you draw anything: a square in model
   space is a square on screen, at every position on the canvas, at every
   zoom. Nothing occludes anything. There is no painter's order to respect
   and no "front" — which is why the shapes in ds-shapes.js are free to nest
   (a vault holds tiles, a floor holds cells) in a way the isometric shapes
   never could without a depth sort.
   ============================================================ */
const S = 30;
const P = (x, y) => [x * S, y * S];
const pts = a => a.map(p => p.join(",")).join(" ");
const rng = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

/* SVG helpers — same shape as the pipeline's, so a shape function moves
   between the two files with only its geometry rewritten. */
const NS = "http://www.w3.org/2000/svg";
const el = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
const add = (g, t, at) => { const e = el(t, at); g.appendChild(e); return e; };

/* A plan rectangle, centred on (x,y) and measured in grid units. Everything
   on this map is ultimately one of these; the shapes differ in what they put
   inside and how heavy the wall is. */
function plate(g, x, y, w, h, s) {
  const [px, py] = P(x - w / 2, y - h / 2);
  return add(g, "rect", {
    x: px, y: py, width: w * S, height: h * S,
    fill: s.fill || "none", "fill-opacity": s.fo === undefined ? 1 : s.fo,
    stroke: s.stroke || "var(--stroke)", "stroke-width": s.sw === undefined ? 1 : s.sw,
    "stroke-opacity": s.so === undefined ? 1 : s.so,
    "stroke-dasharray": s.dash || "none"
  });
}

/* ============================================================
   TYPE

   One scale factor for every string on the map. Sizes are still authored in
   the readable 8-to-10.5 range so a shape's code says what it means, and
   label() multiplies at the point of use.

   It exists because the first two versions of this map were laid out for
   labels that were, in effect, footnotes: legible only once you had zoomed
   into a station. Tripling the type makes the whole plan readable at
   fit-to-stage, which is what a plan is for. Everything downstream of that —
   title-bar heights, line spacing, the fit-or-lead decision on a treemap
   tile — is sized against TYPE rather than against a pixel constant, so this
   is the one number to change.
   ============================================================ */
const TYPE = 3;

/* The fine tier, in final pixels. ds-view tags anything below this and hides
   it at low zoom; shapes opt out simply by asking for a larger size. */
const FINE_PX = 9.5 * TYPE;

/* Rough advance width for the monospace stack, in final pixels. Good to a few
   percent, which is all the fit-or-lead decision needs — and cheap, where
   measuring for real would mean laying out every candidate string twice. */
const textW = (str, size) => String(str).length * size * TYPE * 0.6;

/* Line pitch for a stack of labels, in grid units. */
const lineH = size => size * TYPE * 1.45 / S;

/* Text in plan view is always horizontal. On the isometric map labels are
   raked to +30 / -30 to sit along the flow and naming axes; here the axes are
   the screen axes, so a raked label would be pure decoration and would cost
   legibility for nothing. */
function label(g, x, y, str, s) {
  const [px, py] = P(x, y);
  const t = add(g, "text", {
    x: px, y: py, fill: s.fill || "var(--fg)",
    "font-size": (s.size || 10) * TYPE, "text-anchor": s.anchor || "middle",
    "dominant-baseline": s.base || "middle",
    "letter-spacing": s.ls === undefined ? 0.02 : s.ls,
    "fill-opacity": s.fo === undefined ? 1 : s.fo
  });
  t.textContent = str;
  if (s.upper) t.setAttribute("style", "text-transform:uppercase");
  return t;
}

/* Hatch and stipple, referenced by shapes as url(#pH) etc. Called once per
   <svg>. The hatch runs at 45 deg because in a plan every real edge is at 0
   or 90, so a 45 fill never reads as a wall. */
function installDefs(svg) {
  const defs = el("defs");
  [["pH", "3.2", ".30"], ["pHl", "3.2", ".14"]].forEach(([id, gap, op]) => {
    const p = el("pattern", { id, patternUnits: "userSpaceOnUse", width: gap, height: gap, patternTransform: "rotate(45)" });
    p.appendChild(el("line", { x1: "0", y1: "0", x2: "0", y2: gap, stroke: "var(--stroke)", "stroke-width": "1", "stroke-opacity": op }));
    defs.appendChild(p);
  });
  /* the empty-bay fill: a cross-hatch, for a place a thing is meant to be
     and is not */
  const x = el("pattern", { id: "pX", patternUnits: "userSpaceOnUse", width: "7", height: "7" });
  x.appendChild(el("path", { d: "M0,0 l7,7 M7,0 l-7,7", stroke: "var(--drop)", "stroke-width": "0.7", "stroke-opacity": ".38" }));
  defs.appendChild(x);
  /* the vault floor: a fine square tick, so a bucket reads as a surveyed
     area rather than a filled box */
  const d = el("pattern", { id: "pD", patternUnits: "userSpaceOnUse", width: "9", height: "9" });
  d.appendChild(el("circle", { cx: "1", cy: "1", r: "0.65", fill: "var(--stroke)", "fill-opacity": ".22" }));
  defs.appendChild(d);
  svg.appendChild(defs);
  return defs;
}

/* ============================================================
   TREEMAP

   A bucket's contents are drawn as area. This is the squarified algorithm
   (Bruls, Huizing, van Wijk) at its simplest: take items biggest-first, keep
   adding to the current strip while the worst aspect ratio in the strip
   improves, then lay the strip down and start another across the remaining
   space. It matters that it is squarified rather than sliced, because a
   sliced treemap of this data draws megafin's 3.5 TB as a hairline the full
   height of the vault and minifin's 600 GB as a slab — the eye reads the
   slab as the bigger one.

   Returns [{item, x, y, w, h}] in grid units, centres not corners, so the
   result feeds straight into plate().
   ============================================================ */
function squarify(items, x0, y0, w, h) {
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total) return [];
  const scaled = items.map(it => ({ it, v: it.value / total * w * h }))
    .sort((a, b) => b.v - a.v);
  const out = [];
  let X = x0, Y = y0, W = w, H = h, i = 0;

  const worst = (row, side) => {
    const sum = row.reduce((a, b) => a + b.v, 0);
    const mx = Math.max(...row.map(r => r.v)), mn = Math.min(...row.map(r => r.v));
    const s2 = sum * sum, w2 = side * side;
    return Math.max(w2 * mx / s2, s2 / (w2 * mn));
  };

  while (i < scaled.length) {
    const vertical = W >= H;          // lay the strip along the shorter side
    const side = vertical ? H : W;
    const row = [scaled[i++]];
    while (i < scaled.length && worst(row, side) >= worst(row.concat(scaled[i]), side)) row.push(scaled[i++]);
    const sum = row.reduce((a, b) => a + b.v, 0);
    const thick = sum / side;
    let at = vertical ? Y : X;
    row.forEach(r => {
      const len = r.v / thick;
      const rx = vertical ? X : at, ry = vertical ? at : Y;
      const rw = vertical ? thick : len, rh = vertical ? len : thick;
      out.push({ item: r.it, x: rx + rw / 2, y: ry + rh / 2, w: rw, h: rh });
      at += len;
    });
    if (vertical) { X += thick; W -= thick; } else { Y += thick; H -= thick; }
    if (W <= 0.001 || H <= 0.001) break;
  }
  return out;
}

/* ============================================================
   ROUTING

   Flows between stations are orthogonal, because everything else on a plan
   is. A diagonal line across a floor plan reads as a mistake — or worse, as
   a thing that is physically there, cutting the corner off two rooms.

   route() takes two ports and returns a polyline of grid points. A port is
   {x, y, side} where side is one of l r t b — the wall the conduit leaves
   from. The dogleg is placed at the midpoint between the two ports unless
   `at` is given, which is how two conduits sharing a bay are kept apart.
   ============================================================ */
function route(a, b, at) {
  const A = [a.x, a.y], B = [b.x, b.y];
  const horiz = (a.side === "l" || a.side === "r");
  if (horiz && (b.side === "l" || b.side === "r")) {
    if (Math.abs(A[1] - B[1]) < 0.02) return [A, B];        // straight run
    const mx = at === undefined ? (A[0] + B[0]) / 2 : at;
    return [A, [mx, A[1]], [mx, B[1]], B];
  }
  if (!horiz && (b.side === "t" || b.side === "b")) {
    if (Math.abs(A[0] - B[0]) < 0.02) return [A, B];
    const my = at === undefined ? (A[1] + B[1]) / 2 : at;
    return [A, [A[0], my], [B[0], my], B];
  }
  /* one horizontal, one vertical: a single elbow, turned at the corner that
     keeps the run inside both ports' own half */
  return horiz ? [A, [B[0], A[1]], B] : [A, [A[0], B[1]], B];
}

const path = poly => poly.map((p, i) => (i ? "L" : "M") + P(p[0], p[1]).join(",")).join(" ");

/* Total run length in grid units, so a dot can be advanced at a constant
   speed across conduits of different lengths rather than a constant fraction
   (which makes short hops look frantic next to long ones). */
function runLength(poly) {
  let L = 0;
  for (let i = 1; i < poly.length; i++) L += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
  return L;
}
function pointAt(poly, t) {
  const L = runLength(poly); let d = t * L;
  for (let i = 1; i < poly.length; i++) {
    const seg = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    if (d <= seg) {
      const k = seg ? d / seg : 0;
      return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * k,
              poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * k];
    }
    d -= seg;
  }
  return poly[poly.length - 1];
}

/* Anything that animates registers here. The single frame loop in the view
   calls each ticker with (dt, now, zoom). Never start your own loop: tickers
   inherit pause and prefers-reduced-motion for free. */
const TICKERS = [];

/* ============================================================
   FORMATTING
   Bytes are the unit of this map, so they are formatted in one place.
   Binary prefixes, because that is what S3 reports against and what the
   repos' own console helpers print.
   ============================================================ */
const fmtBytes = n => {
  if (n < 1024) return n + " B";
  const u = ["KiB", "MiB", "GiB", "TiB"]; let i = -1;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n)) + " " + u[i];
};
const fmtCount = n => n.toLocaleString("en-US");
