/* ============================================================
   ds-view.js — assembly and interaction.
   Grid, zones, nodes, conduits, dots, camera, index.
   Shared file: read the whole thing before changing any of it.
   Load order: plan -> shapes -> data -> view
   ============================================================ */
(function () {
"use strict";

const svg    = document.getElementById("svg");
const aside  = document.getElementById("aside");
const strip  = document.getElementById("strip");
const reader = document.getElementById("reader");
const readEl = document.getElementById("read");

const M = {}; NODES.forEach(n => M[n.id] = n);
const SEQ = NODES.filter(n => !n.noindex);

let picked = null, hovered = null, motion = true, axes = true;

/* ============================================================
   LAYERS
   Order is paint order. Unlike the isometric map there is no depth sort to
   respect — nothing occludes anything in a plan — so this order is purely
   about what should be readable over what.
   ============================================================ */
const root  = el("g");
const gGrid = el("g"), gBand = el("g"), gContent = el("g");
const gZone = el("g"), gWire = el("g"), gNode = el("g"), gLabel = el("g"), gDot = el("g");
[gZone, gWire, gNode, gLabel, gDot].forEach(g => gContent.appendChild(g));
/* gContent is separate from the grid and the registers so that fit() can
   frame the drawing rather than the paper it is drawn on. The grid runs well
   past the stations on every side on purpose — a plan whose grid stops at the
   last wall reads as a crop — and fitting to root.getBBox() would therefore
   shrink the map by about a third to show empty lattice. */
[gGrid, gBand, gContent].forEach(g => root.appendChild(g));
installDefs(svg);
svg.appendChild(root);

/* ============================================================
   GRID — a square lattice, which is the one grid a plan can have.
   /pipeline draws a diamond lattice because its projection turns squares
   into diamonds; here the model grid and the screen grid are the same grid,
   which is worth showing rather than hiding.
   ============================================================ */
(function grid() {
  const X0 = -6, X1 = 82, Y0 = -8, Y1 = 88;
  for (let x = X0; x <= X1; x += 2) {
    const major = x % 10 === 0;
    add(gGrid, "line", {
      x1: P(x, Y0)[0], y1: P(x, Y0)[1], x2: P(x, Y1)[0], y2: P(x, Y1)[1],
      stroke: "var(--grid)", "stroke-width": major ? 1 : 0.6,
      "stroke-opacity": major ? "var(--grid-op-major)" : "var(--grid-op)"
    });
  }
  for (let y = Y0; y <= Y1; y += 2) {
    const major = y % 10 === 0;
    add(gGrid, "line", {
      x1: P(X0, y)[0], y1: P(X0, y)[1], x2: P(X1, y)[0], y2: P(X1, y)[1],
      stroke: "var(--grid)", "stroke-width": major ? 1 : 0.6,
      "stroke-opacity": major ? "var(--grid-op-major)" : "var(--grid-op)"
    });
  }
})();

/* ============================================================
   ZONES

   The two systems the map spans, drawn as very translucent dotted enclosures
   behind everything else. Left: the S3 account. Right: the GitHub org — which
   takes in both the transform column and the contract rail, because
   zsb-medallion is a repository like the rest of them and only looks separate
   because it is not a hop.

   This is the distinction the map most needed and least had. Every station up
   to now looked like the same kind of object; in fact half of them are
   buckets somebody pays for by the terabyte-month and half are source trees.
   The conduits crossing the gap between the two boxes are, quite literally,
   the only places this architecture moves anything between the two.

   Deliberately faint. They are here to be noticed second, after the stations
   and before the wiring — a ground, not a frame.
   ============================================================ */
ZONES.forEach(Z => {
  const [x0, y0] = P(Z.x0, Z.y0), [x1, y1] = P(Z.x1, Z.y1);
  add(gZone, "rect", {
    x: x0, y: y0, width: x1 - x0, height: y1 - y0,
    fill: "var(--fg)", "fill-opacity": ".022",
    stroke: "var(--fg3)", "stroke-width": 1.4, "stroke-opacity": ".34",
    "stroke-dasharray": "9 8"
  });
  /* spaced off lineH like every other stack on the map, and set far enough
     inside the corner that the sub-line clears the first station's title bar */
  label(gZone, Z.x0 + 0.9, Z.y0 + 0.5 + lineH(11) / 2, Z.name,
    { size: 11, anchor: "start", fill: "var(--fg3)", ls: 0.18, upper: true });
  if (Z.sub) label(gZone, Z.x0 + 0.9, Z.y0 + 0.5 + lineH(11) + lineH(9) / 2, Z.sub,
    { size: 9, anchor: "start", fill: "var(--fg3)", fo: 0.75 });
});

/* ============================================================
   CONDUITS

   Two kinds, and the difference between them is the argument of the map:

     live   solid, full weight, dots moving       bytes have crossed this
     cold   dashed, half weight, no dots          written, never run

   There were four. The archived-generation lane and the deliberately-refused
   edge were retired when the map was simplified; what they said now lives in
   the reader text of the stations they were about.
   ============================================================ */
const WIRE = {
  /* A conduit is a track, not a highlight. The live one used to be a heavy
     blue rule, which made the ONE hop that works the loudest thing on the map
     — and the dots travelling it, the part that actually says "bytes moved",
     were smaller than the line they moved along. So the rails are quiet and
     the dots carry the signal colour. `ink` is kept separate from `stroke` so
     a caption stays readable when its rail deliberately is not.

     Dots run on EVERY conduit now, cold ones included. They are the only mark
     that shows direction, and a map where half the arrows are static reads as
     a map that is half broken rather than one that is half unbuilt. What
     separates the two states is the rail underneath: solid grey has carried
     bytes, dashed red is written and has never run. */
  live: { stroke: "var(--fg3)", w: 1.1, dash: "none", op: 0.5,  dots: true, ink: "var(--fg2)" },
  cold: { stroke: "var(--drop)", w: 1.5, dash: "7 5",  op: 0.72, dots: true, ink: "var(--drop)" }
};

function portOf(ref) {
  const n = M[ref.n], w = n.w, h = n.h;
  const p = { l: [n.x - w / 2, n.y], r: [n.x + w / 2, n.y],
              t: [n.x, n.y - h / 2], b: [n.x, n.y + h / 2] }[ref.s];
  return { x: p[0] + (ref.dx || 0), y: p[1] + (ref.dy || 0), side: ref.s };
}

const RUNS = [];
EDGES.forEach(E => {
  const st = WIRE[E.kind], poly = route(portOf(E.a), portOf(E.b), E.at);
  const d = path(poly);
  add(gWire, "path", {
    d, fill: "none", stroke: st.stroke, "stroke-width": st.w,
    "stroke-opacity": st.op, "stroke-dasharray": st.dash,
    "stroke-linejoin": "miter", "stroke-linecap": "butt"
  });

  /* the arrowhead, at the landing end, always axis-aligned */
  const tail = poly[poly.length - 2], head = poly[poly.length - 1];
  const dx = Math.sign(head[0] - tail[0]), dy = Math.sign(head[1] - tail[1]);
  const [hx, hy] = P(head[0], head[1]), A = 5;
  add(gWire, "polygon", {
    points: dx
      ? pts([[hx, hy], [hx - dx * A, hy - A * 0.62], [hx - dx * A, hy + A * 0.62]])
      : pts([[hx, hy], [hx - A * 0.62, hy - dy * A], [hx + A * 0.62, hy - dy * A]]),
    fill: st.stroke, "fill-opacity": st.op
  });

  /* edge labels ride above the run, centred on the longest straight segment
     so a label never sits on a corner */
  if (E.label) {
    let best = 0, bi = 1;
    for (let i = 1; i < poly.length; i++) {
      const L = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      if (L > best) { best = L; bi = i; }
    }
    const cx = (poly[bi][0] + poly[bi - 1][0]) / 2, cy = (poly[bi][1] + poly[bi - 1][1]) / 2;
    /* Which side to sit on depends on which way the segment runs. Now that
       the flow is vertical the longest segment is usually the corridor drop,
       and a horizontal caption centred on a vertical line lands ON the line —
       so a vertical run gets its label set out to the left instead, anchored
       at its end, and only a horizontal run gets the label above it.

       10px, above the fine threshold: what a conduit is doing is the point of
       the map, so it stays legible at the overview zoom. The qualifier is
       fine-tier and comes back when you zoom in. */
    const vertical = Math.abs(poly[bi][0] - poly[bi - 1][0]) < 0.02;
    const half = (lineH(10) + lineH(8.6)) / 2;
    if (vertical) {
      label(gLabel, cx - 0.55, cy - half + lineH(10) / 2, E.label,
        { size: 10, anchor: "end", fill: st.ink, ls: 0.05 });
      if (E.sub) label(gLabel, cx - 0.55, cy - half + lineH(10) + lineH(8.6) / 2, E.sub,
        { size: 8.6, anchor: "end", fill: "var(--fg3)" });
    } else {
      label(gLabel, cx, cy - half - 0.2 + lineH(10) / 2, E.label,
        { size: 10, fill: st.ink, ls: 0.05 });
      if (E.sub) label(gLabel, cx, cy - half - 0.2 + lineH(10) + lineH(8.6) / 2, E.sub,
        { size: 8.6, fill: "var(--fg3)" });
    }
  }

  if (st.dots) RUNS.push(poly);
});

/* the carry: the map runs out at the right edge */
CARRIES.forEach(C => {
  const poly = [[C.x0, C.y0], [C.x1, C.y1]];
  const g = add(gWire, "path", {
    d: path(poly), fill: "none", stroke: "var(--fg3)", "stroke-width": 1.2,
    "stroke-dasharray": "6 4", "stroke-opacity": 0.5
  });
  label(gLabel, C.x1, C.y1 + 0.75, "↓ " + C.to, { size: 8.6, fill: "var(--fg3)" });
});

/* ============================================================
   NODES
   Every node is a <g role=button> so the whole footprint is one target,
   with a hit rect underneath the drawing for the shapes that are mostly
   outline.
   ============================================================ */
NODES.forEach(n => {
  const g = el("g", n.noindex ? {} : { role: "button", tabindex: "0", "aria-label": n.name });
  gNode.appendChild(g);
  n._g = g;

  if (!n.noindex && n.w && n.h) {
    const [hx, hy] = P(n.x - n.w / 2, n.y - n.h / 2);
    add(g, "rect", { x: hx, y: hy, width: n.w * S, height: n.h * S, fill: "transparent" });
  }

  const draw = DRAW[n.shape];
  if (!draw) throw new Error(`no DRAW.${n.shape} for node ${n.id}`);
  draw(g, n);

  /* No free-floating name plates. Every station on this map carries its own
     name inside its own title bar, so an external label was always a second
     copy of a string that was already on screen — and it was the one thing
     here that could collide with anything, because it was the one thing not
     bounded by a box. The old "Fort Knox" label landing on the register rule
     behind it was exactly that failure. */

  if (n.noindex) return;

  /* the selection halo: a rule drawn just outside the wall, so picking a
     station never changes the station's own geometry */
  const [ox, oy] = P(n.x - n.w / 2 - 0.35, n.y - n.h / 2 - 0.35);
  n._halo = add(g, "rect", {
    x: ox, y: oy, width: (n.w + 0.7) * S, height: (n.h + 0.7) * S,
    fill: "none", stroke: "var(--signal)", "stroke-width": 2,
    "stroke-opacity": 0, "pointer-events": "none"
  });

  g.addEventListener("pointerenter", () => { if (!dragging) { hovered = n; mark(); } });
  g.addEventListener("pointerleave", () => { if (hovered === n) { hovered = null; mark(); } });
  g.addEventListener("click", e => { e.stopPropagation(); select(picked === n ? null : n); });
  g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n); } });
});

function mark() {
  const on = hovered || picked;
  NODES.forEach(n => {
    if (!n._halo) return;
    n._halo.setAttribute("stroke-opacity", n === on ? (n === picked ? 1 : 0.5) : 0);
  });
  [...aside.querySelectorAll(".row"), ...strip.querySelectorAll(".chip")].forEach(r => {
    r.classList.toggle("on", r.dataset.id === (on ? on.id : ""));
  });
}

/* ============================================================
   DOTS — on every conduit, live and cold alike.

   They carry direction, which nothing else on the map does: the arrowheads
   are small and sit only at the landing end. Whether a hop has actually run
   is said by the rail beneath them, not by whether they move.
   ============================================================ */
RUNS.forEach((poly, i) => {
  const N = 3, L = runLength(poly);
  const dots = Array.from({ length: N }, (_, k) => {
    /* Three times the old radius, with a halo in the page colour so a dot
       reads as travelling ON the rail rather than as a bead threaded through
       it. These are the only saturated marks left on the conduits. */
    const c = add(gDot, "circle", {
      r: 9, fill: "var(--signal)", stroke: "var(--bg)", "stroke-width": 3
    });
    return { c, t: k / N };
  });
  TICKERS.push(dt => {
    dots.forEach(d => {
      d.t = (d.t + dt * 1.1 / Math.max(L, 1)) % 1;
      const [x, y] = pointAt(poly, d.t), [px, py] = P(x, y);
      d.c.setAttribute("cx", px); d.c.setAttribute("cy", py);
    });
  });
});

let last = 0;
function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
  if (motion) TICKERS.forEach(t => t(dt, now, cam.z));
  labelTier();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ============================================================
   CAMERA — pan, zoom, fit, and fly-to.

   Straight 2D. There is no projection to invert, which is the one place a
   plan is unambiguously easier to build than an axonometric: a screen point
   is a model point divided by the zoom, and that is the whole of it.
   ============================================================ */
const cam = { x: 0, y: 0, z: 1 };
function apply() { root.setAttribute("transform", `translate(${cam.x},${cam.y}) scale(${cam.z})`); }

function contentBox() {
  const b = gContent.getBBox();
  /* extra room at the foot: the hint bar is an HTML overlay pinned to the
     bottom of the stage, and the carry stub trailing off the last station
     lands underneath it otherwise */
  return { x: b.x - 26, y: b.y - 26, w: b.width + 52, h: b.height + 26 + 62 };
}

/* ============================================================
   LABEL TIERS

   Anything below FINE_PX (9.5 * TYPE) is fine tier and is switched off below
   FINE_Z: sub-labels, tile figures and rail commands. Station names, bucket
   names, conduit captions and sliver callouts sit above it and stay up at
   every zoom. Decoration that exists only to frame a fine label — the repo
   command rails — carries the class explicitly, so an empty frame never
   survives its own caption.
   ============================================================ */
/* With the type tripled, fit-to-stage renders a 9px label at about 10 real
   pixels, so the whole plan is legible without zooming and the coarse tier
   only kicks in when somebody zooms a long way out. */
const FINE_Z = 0.25;
[...svg.querySelectorAll("text")].forEach(t => {
  if (parseFloat(t.getAttribute("font-size")) < FINE_PX) t.classList.add("fine");
});
let coarse = null;
/* Deliberately not a TICKER: tickers are paused by the motion toggle and by
   prefers-reduced-motion, and which words are on the page is not motion. */
function labelTier() {
  const want = cam.z < FINE_Z;
  if (want !== coarse) { coarse = want; svg.classList.toggle("coarse", want); }
}
function fit() {
  const r = svg.getBoundingClientRect(), b = contentBox();
  cam.z = Math.min(r.width / b.w, r.height / b.h);
  cam.x = (r.width - b.w * cam.z) / 2 - b.x * cam.z;
  cam.y = (r.height - b.h * cam.z) / 2 - b.y * cam.z;
  apply();
}
/* No fly-to. Selecting a station used to glide the camera onto it, which
   earned its keep back when the type was a third of this size and a station
   was unreadable until you were on top of it. At the current scale the whole
   plan reads at fit, so the camera move only took the rest of the map away
   from you. Selection now just marks; pan and zoom stay manual. */

/* PAN — and the one subtlety that makes clicking a station work at all.

   The pointer is captured LAZILY: not on pointerdown, but on the first move
   past PAN_SLOP. That ordering is load-bearing, and getting it wrong is what
   broke selection.

   Capturing on pointerdown retargets the compatibility `click` event to the
   capturing element. So a plain click on a station used to be delivered to
   the <svg>, not to the station's own <g> — the g's handler never ran, its
   stopPropagation never happened, and the background handler below fired
   instead and CLEARED the selection. Every click on the map read as a click
   on nothing.

   Capture is only needed once a drag is genuinely underway, to keep the pan
   alive when the cursor leaves the canvas. A click never travels far enough
   to take it, so a click reaches the shape it landed on. */
const PAN_SLOP = 3;
let dragging = false, dragged = false, px = 0, py = 0, ox = 0, oy = 0, capId = null;

svg.addEventListener("pointerdown", e => {
  dragging = true; dragged = false;
  px = ox = e.clientX; py = oy = e.clientY; capId = e.pointerId;
});
svg.addEventListener("pointermove", e => {
  if (!dragging) return;
  if (!dragged) {
    if (Math.abs(e.clientX - ox) + Math.abs(e.clientY - oy) <= PAN_SLOP) return;
    /* this is a pan, not a click — now it is safe to take the pointer */
    dragged = true;
    svg.classList.add("drag");
    try { svg.setPointerCapture(capId); } catch (_) { /* touch already has it */ }
  }
  cam.x += e.clientX - px; cam.y += e.clientY - py;
  px = e.clientX; py = e.clientY; apply();
});
["pointerup", "pointercancel"].forEach(k => svg.addEventListener(k, e => {
  dragging = false; svg.classList.remove("drag");
  if (capId !== null) {
    try { if (svg.hasPointerCapture(capId)) svg.releasePointerCapture(capId); } catch (_) {}
    capId = null;
  }
  /* `dragged` is read by the click handler, which fires after this one */
}));
/* Clicking the canvas itself clears the selection. A station's own handler
   calls stopPropagation, so this only sees clicks that hit no station — and
   only when the gesture was not a pan. */
svg.addEventListener("click", () => { if (!dragged) select(null); });
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = Math.exp(-e.deltaY * 0.0016), z = Math.max(0.08, Math.min(4, cam.z * k));
  cam.x = mx - (mx - cam.x) * (z / cam.z); cam.y = my - (my - cam.y) * (z / cam.z);
  cam.z = z; apply();
}, { passive: false });

/* pinch */
let pinch = null;
svg.addEventListener("touchstart", e => {
  if (e.touches.length === 2) pinch = { d: tdist(e), z: cam.z };
}, { passive: true });
svg.addEventListener("touchmove", e => {
  if (e.touches.length === 2 && pinch) {
    e.preventDefault();
    cam.z = Math.max(0.08, Math.min(4, pinch.z * tdist(e) / pinch.d)); apply();
  }
}, { passive: false });
svg.addEventListener("touchend", () => { pinch = null; }, { passive: true });
const tdist = e => Math.hypot(
  e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);

function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

/* ============================================================
   THE READER

   One entry per station: a title, one paragraph, and the figures.

   The paragraph is `n.brief` and is capped at a hundred words. That cap is
   the point of it. The first version of this panel rendered three long
   sections per station — what it is, what is there, its condition — which
   was a good record and a bad panel: nobody reads nine hundred words to find
   out what a box is. Those sections are still in ds-data.js, because they are
   where every number in the brief came from and the next person to refresh
   this page will need them. They are deliberately not rendered.

   The kv table is not prose and is not capped: it is the evidence, and a
   figure the reader can check is worth more than a sentence about it.
   ============================================================ */
function inspect(n) {
  if (!n) return overview();
  const H = [];
  H.push(`<div class="eyebrow">${esc(n.group || "")}</div>`);
  H.push(`<div class="title">${esc(n.name)}</div>`);
  if (n.sub) H.push(`<div class="sub">${esc(n.sub)}</div>`);
  if (n.thread) H.push(`<div class="thr">on the steel thread</div>`);
  if (UNVERIFIED.has(n.id)) H.push(`<div class="unver">not confirmable from here</div>`);
  if (n.brief) H.push(`<p>${n.brief}</p>`);

  const sn = SNIPPETS[n.id] && SNIPPETS[n.id]();
  if (sn) {
    H.push(`<h4>${esc(sn.title)}</h4><div class="snip">${esc(sn.body)}</div>`);
    if (sn.note) H.push(`<p class="note">${esc(sn.note)}</p>`);
  }
  if (n.kv && n.kv.length) {
    H.push(`<h4>Read on 2026-08-24</h4>`);
    n.kv.forEach(([k, v]) => H.push(`<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`));
  }
  readEl.innerHTML = H.join("");
  readEl.scrollTop = 0;
}

/* Nothing selected: the map's own argument, in the same hundred-word shape. */
function overview() {
  readEl.innerHTML =
    `<div class="eyebrow">${esc(OVERVIEW.eyebrow)}</div>` +
    `<div class="title big">${esc(OVERVIEW.title)}</div>` +
    `<div class="sub">${esc(OVERVIEW.sub)}</div>` +
    `<div class="thr">the steel thread</div>` +
    `<p>${OVERVIEW.brief}</p>` +
    `<h4>How to read it</h4><p>${OVERVIEW.how}</p>` +
    `<h4>Where it stands</h4><p>${OVERVIEW.state}</p>` +
    `<p class="note">Click any box for its own entry. Everything here was read from the live buckets and fresh clones on 2026-08-24, not from the READMEs.</p>`;
  readEl.scrollTop = 0;
}

function select(n) {
  picked = n; hovered = null;
  inspect(n); mark();
  /* On a phone the reader is a bottom sheet rather than a column, so
     selecting has to raise it and shrink the strip out of its way. */
  if (window.matchMedia("(max-width:900px)").matches) {
    reader.classList.toggle("open", !!n);
    strip.classList.toggle("mini", !!n);
  }
}

/* ============================================================
   THE INDEX — left column on a desktop, the strip on a phone.
   ============================================================ */
(function index() {
  let g = null;
  SEQ.forEach(n => {
    if (n.group !== g) {
      g = n.group;
      const h = document.createElement("div");
      h.className = "grp" + (n.groupMark ? " mark" : "");
      h.textContent = g; aside.appendChild(h);
      const sg = document.createElement("span");
      sg.className = "sgrp"; sg.textContent = g.replace(/^[①-⑩]\s*/, ""); strip.appendChild(sg);
    }
    const b = document.createElement("button");
    b.className = "row" + (n.anchor ? " anchor" : ""); b.dataset.id = n.id;
    b.innerHTML = `<span class="key">${esc(n.key)}</span><span class="nm">${esc(n.name)}</span>`;
    b.onclick = () => select(n);
    b.onpointerenter = () => { hovered = n; mark(); };
    b.onpointerleave = () => { hovered = null; mark(); };
    aside.appendChild(b);

    const c = document.createElement("button");
    c.className = "chip" + (n.anchor ? " mark" : ""); c.dataset.id = n.id;
    c.innerHTML = `<span class="k">${esc(n.key)}</span><span class="n">${esc(n.name)}</span>`;
    c.onclick = () => select(n);
    strip.appendChild(c);
  });
})();

/* ============================================================
   CONTROLS
   ============================================================ */
function step(d) {
  const i = picked ? SEQ.indexOf(picked) : -1;
  select(SEQ[(i + d + SEQ.length + (i < 0 && d < 0 ? 1 : 0)) % SEQ.length] || SEQ[0]);
}
document.getElementById("stNext").onclick = () => step(1);
document.getElementById("stPrev").onclick = () => step(-1);

addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
  else if (e.key === "Escape") select(null);
  else if (e.key === "Home") { e.preventDefault(); select(null); fit(); }
});

const bAxes = document.getElementById("btnAxes");
bAxes.onclick = () => {
  axes = !axes;
  gGrid.style.display = axes ? "" : "none";
  gBand.style.display = axes ? "" : "none";
  bAxes.textContent = axes ? "Hide grid" : "Show grid";
};
const bMot = document.getElementById("btnMotion");
bMot.onclick = () => {
  motion = !motion;
  bMot.textContent = motion ? "Pause motion" : "Resume motion";
  bMot.setAttribute("aria-pressed", String(!motion));
};
if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) bMot.click();

const bTheme = document.getElementById("btnTheme");
bTheme.onclick = () => {
  document.body.classList.toggle("light");
  bTheme.textContent = document.body.classList.contains("light") ? "Dark" : "Light";
};
document.getElementById("btnFit").onclick = () => { select(null); fit(); };
document.getElementById("btnStages").onclick = () => aside.classList.toggle("open");
/* the bottom sheet's own dismiss, phone only */
document.getElementById("sheetClose").onclick = () => select(null);

/* ============================================================
   THE COLUMN BORDERS

   Each border does two jobs, and which one you get is decided by whether the
   pointer moved:

     DRAG  resize that column, live, between 0 and 640px
     CLICK collapse it all the way to the edge — and click again to bring it
           back at the width it had

   The click case used to be a side effect: you could only shut a column by
   dragging it below a threshold, which meant the fastest way to get the map
   to full width was a careful drag to the wall. A border is the obvious thing
   to click when you want a panel gone, so clicking it now does that.

   What is left behind is the grip itself — a full-height sliver carrying an
   arrow pointing the way back — rather than nothing, because a panel that
   collapses to a truly invisible edge is a panel nobody finds again.
   ============================================================ */
const MOVED = 4;   /* px of travel that separates a drag from a click */

[["gripL", aside,  "--aside-w",  238, 1],
 ["gripR", reader, "--reader-w", 360, -1]].forEach(
  ([id, panel, varName, def, dir]) => {
    const grip = document.getElementById(id);
    let w = def, wOpen = def, drag = false, moved = false, x0 = 0, w0 = 0;
    const setW = v => { w = v; document.documentElement.style.setProperty(varName, v + "px"); };
    const shut = () => {
      if (w > 8) wOpen = w;            /* remember where to come back to */
      grip.classList.add("shut"); panel.style.display = "none"; setW(0); refresh();
    };
    const open = () => {
      grip.classList.remove("shut"); panel.style.display = "";
      setW(wOpen < 56 ? def : wOpen); refresh();
    };

    grip.addEventListener("pointerdown", e => {
      drag = true; moved = false; x0 = e.clientX; w0 = w;
      grip.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grip.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.abs(e.clientX - x0) > MOVED) moved = true;
      if (!moved || grip.classList.contains("shut")) return;
      setW(Math.max(0, Math.min(640, w0 + (e.clientX - x0) * dir)));
      refresh();
    });
    ["pointerup", "pointercancel"].forEach(k => grip.addEventListener(k, () => {
      if (!drag) return;
      drag = false;
      /* a click — no travel — toggles the column all the way, either way */
      if (!moved) return grip.classList.contains("shut") ? open() : shut();
      /* a drag that ended near the wall finishes the job */
      if (w < 56) shut();
      else { wOpen = w; refresh(); }
    }));
    grip.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      grip.classList.contains("shut") ? open() : shut();
    });
    grip.querySelector("span").textContent = dir > 0 ? "›" : "‹";
  });

/* The stage just changed width. Reframe only when nothing is selected — if
   somebody is reading a station, moving the map out from under them to gain
   forty pixels is not a favour. */
function refresh() { requestAnimationFrame(() => { if (!picked) fit(); }); }
addEventListener("resize", () => { if (!picked) fit(); });

/* ============================================================
   GO
   ============================================================ */
requestAnimationFrame(() => { fit(); mark(); overview(); });

})();
