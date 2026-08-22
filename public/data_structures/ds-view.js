/* ============================================================
   ds-view.js — assembly and interaction.
   Grid, registers, nodes, conduits, dots, camera, reader, index.
   Shared file: read the whole thing before changing any of it.
   Load order: plan -> shapes -> data -> view
   ============================================================ */
(function () {
"use strict";

const svg    = document.getElementById("svg");
const aside  = document.getElementById("aside");
const readEl = document.getElementById("read");
const strip  = document.getElementById("strip");
const reader = document.getElementById("reader");

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
const gWire = el("g"), gNode = el("g"), gLabel = el("g"), gDot = el("g");
[gWire, gNode, gLabel, gDot].forEach(g => gContent.appendChild(g));
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
  const X0 = -6, X1 = 70, Y0 = -6, Y1 = 84;
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
   COLUMN HEADERS

   This replaces the ruled bands the map used to carry. The bands were
   horizontal registers, which made sense when the flow ran left to right;
   with the flow running top to bottom they would cut across every column at
   once and say nothing. Three headers, one per column, and no rules.

   They are also the ONLY free-floating strings on the canvas. Every other
   label on this map now lives inside a box that owns it — a title bar, a
   cell, a treemap tile — which is what stops a station name from landing on
   top of whatever happens to be behind it.
   ============================================================ */
COLUMNS.forEach(C => {
  /* into gLabel, not gBand: gBand sits outside gContent and is excluded from
     fit(), so a header drawn there gets cropped off the top of the view. */
  label(gLabel, C.x, C.y, C.name,
    { size: 9.6, fill: "var(--fg3)", ls: 0.16, upper: true });
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
  live: { stroke: "var(--signal)", w: 2.0, dash: "none", op: 0.95, dots: true },
  cold: { stroke: "var(--drop)",   w: 1.5, dash: "7 5",  op: 0.72, dots: false }
};

function portOf(ref) {
  const n = M[ref.n], w = n.w, h = n.h;
  const p = { l: [n.x - w / 2, n.y], r: [n.x + w / 2, n.y],
              t: [n.x, n.y - h / 2], b: [n.x, n.y + h / 2] }[ref.s];
  return { x: p[0] + (ref.dx || 0), y: p[1] + (ref.dy || 0), side: ref.s };
}

const LIVE_RUNS = [];
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
    if (vertical) {
      label(gLabel, cx - 0.5, cy - 0.24, E.label,
        { size: 10, anchor: "end", fill: st.stroke, ls: 0.05 });
      if (E.sub) label(gLabel, cx - 0.5, cy + 0.42, E.sub,
        { size: 8.6, anchor: "end", fill: "var(--fg3)" });
    } else {
      label(gLabel, cx, cy - 0.44, E.label, { size: 10, fill: st.stroke, ls: 0.05 });
      if (E.sub) label(gLabel, cx, cy + 0.48, E.sub, { size: 8.6, fill: "var(--fg3)" });
    }
  }

  if (st.dots) LIVE_RUNS.push(poly);
});

/* the carry: the map runs out at the right edge */
CARRIES.forEach(C => {
  const poly = [[C.x0, C.y0], [C.x1, C.y1]];
  const g = add(gWire, "path", {
    d: path(poly), fill: "none", stroke: "var(--fg3)", "stroke-width": 1.2,
    "stroke-dasharray": "6 4", "stroke-opacity": 0.5
  });
  label(gLabel, C.x1, C.y1 + 0.5, "↓ " + C.to, { size: 8.6, fill: "var(--fg3)" });
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
     behind it was exactly that failure. The subtitle lives in the reader. */

  if (n.noindex) return;

  /* the selection halo: a rule drawn just outside the wall, so picking a
     station never changes the station's own geometry */
  const [ox, oy] = P(n.x - n.w / 2 - 0.22, n.y - n.h / 2 - 0.22);
  n._halo = add(g, "rect", {
    x: ox, y: oy, width: (n.w + 0.44) * S, height: (n.h + 0.44) * S,
    fill: "none", stroke: "var(--signal)", "stroke-width": 2,
    "stroke-opacity": 0, "pointer-events": "none"
  });

  g.addEventListener("pointerenter", () => { if (!dragging) { hovered = n; inspect(n); mark(); } });
  g.addEventListener("pointerleave", () => { if (hovered === n) { hovered = null; inspect(picked); mark(); } });
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
   DOTS — only on runs that have actually carried bytes.

   There is exactly one such run on this map. That is the point, and it is
   why the ticker is not parameterised: if a second solid conduit ever
   appears here it will be because a second hop ran, and that is worth a
   commit rather than a config flag.
   ============================================================ */
LIVE_RUNS.forEach((poly, i) => {
  const N = 3, L = runLength(poly);
  const dots = Array.from({ length: N }, (_, k) => {
    const c = add(gDot, "circle", { r: 2.6, fill: "var(--signal)" });
    return { c, t: k / N };
  });
  TICKERS.push(dt => {
    dots.forEach(d => {
      d.t = (d.t + dt * 0.55 / Math.max(L, 1)) % 1;
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
  return { x: b.x - 26, y: b.y - 26, w: b.width + 52, h: b.height + 52 };
}

/* ============================================================
   LABEL TIERS

   The map is about 115 grid units wide, so a fit-to-stage view sits near
   z = 0.3 — at which a 9px label is under 3px and every small string on the
   canvas turns into the same grey smear. Rather than pretend that is
   legible, the fine tier is switched off below a threshold: the overview
   shows walls, areas and wiring, and the words come back as you zoom toward
   a station. Anything under 9.5px is fine tier, which is every sub-label,
   tile figure, manifest row and rail command; station names and bucket names
   stay up at all zooms.
   ============================================================ */
const FINE_Z = 0.5;
[...svg.querySelectorAll("text")].forEach(t => {
  if (parseFloat(t.getAttribute("font-size")) < 9.5) t.classList.add("fine");
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
/* fly-to: centre a station at a zoom where its own labels are legible.
   The overview zoom on a map this wide is about 0.25, at which a 9px label
   is 2px — so selecting a station has to move the camera or the reader is
   describing something you cannot see. */
function focus(n) {
  if (!n || !n.w) return;
  const r = svg.getBoundingClientRect();
  const pad = 1.7;
  const z = Math.min(r.width / ((n.w + pad * 2) * S), r.height / ((n.h + pad * 2) * S), 1.5);
  const [cx, cy] = P(n.x, n.y);
  glide(r.width / 2 - cx * z, r.height / 2 - cy * z, z);
}
let anim = null;
function glide(tx, ty, tz) {
  if (anim) cancelAnimationFrame(anim);
  if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
    cam.x = tx; cam.y = ty; cam.z = tz; apply(); return;
  }
  const s = { ...cam }, t0 = performance.now(), D = 340;
  (function step(now) {
    const k = Math.min((now - t0) / D, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    cam.x = s.x + (tx - s.x) * e; cam.y = s.y + (ty - s.y) * e; cam.z = s.z + (tz - s.z) * e;
    apply(); if (k < 1) anim = requestAnimationFrame(step);
  })(t0);
}

let dragging = false, dragged = false, px = 0, py = 0;
svg.addEventListener("pointerdown", e => {
  dragging = true; dragged = false; px = e.clientX; py = e.clientY;
  svg.classList.add("drag"); svg.setPointerCapture(e.pointerId);
});
svg.addEventListener("pointermove", e => {
  if (!dragging) return;
  const dx = e.clientX - px, dy = e.clientY - py;
  if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
  cam.x += dx; cam.y += dy; px = e.clientX; py = e.clientY; apply();
});
["pointerup", "pointercancel"].forEach(k => svg.addEventListener(k, () => {
  dragging = false; svg.classList.remove("drag");
}));
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

/* ============================================================
   THE READER
   ============================================================ */
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function inspect(n) {
  if (!n) return overview();
  const S1 = [];
  S1.push(`<div class="eyebrow">${esc(n.group || "")}</div>`);
  S1.push(`<div class="title">${esc(n.name)}</div>`);
  if (n.sub) S1.push(`<div class="sub">${esc(n.sub)}</div>`);
  if (UNVERIFIED.has(n.id)) S1.push(`<div class="unver">not confirmable from here</div>`);
  if (n.does)  S1.push(`<h4>What it is</h4><p>${n.does}</p>`);
  if (n.built) S1.push(`<h4>What is there</h4><p>${n.built}</p>`);
  if (n.cond)  S1.push(`<h4>Condition</h4><p class="cond">${n.cond}</p>`);
  const sn = SNIPPETS[n.id] && SNIPPETS[n.id]();
  if (sn) {
    S1.push(`<h4>${esc(sn.title)}</h4><div class="snip">${esc(sn.body)}</div>`);
    if (sn.note) S1.push(`<p class="note">${esc(sn.note)}</p>`);
  }
  if (n.kv && n.kv.length) {
    S1.push(`<h4>Read on 2026-08-22</h4>`);
    n.kv.forEach(([k, v]) => S1.push(`<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`));
  }
  readEl.innerHTML = S1.join("");
  readEl.scrollTop = 0;
}

function overview() {
  readEl.innerHTML =
    `<div class="eyebrow">${esc(OVERVIEW.eyebrow)}</div>` +
    `<div class="title big">${esc(OVERVIEW.title)}</div>` +
    `<div class="sub">${esc(OVERVIEW.sub)}</div>` +
    `<h4>The map</h4>${OVERVIEW.does}` +
    `<h4>How it was read</h4>${OVERVIEW.built}` +
    `<h4>Condition</h4>${OVERVIEW.cond}`;
  readEl.scrollTop = 0;
}

function select(n) {
  picked = n; hovered = null;
  inspect(n); mark();
  if (n) focus(n);
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
    b.onpointerenter = () => { hovered = n; inspect(n); mark(); };
    b.onpointerleave = () => { hovered = null; inspect(picked); mark(); };
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
document.getElementById("sheetClose").onclick = () => select(null);

/* the two grips: either column can be dragged shut */
[["gripL", aside, "--aside-w", 238, 1], ["gripR", reader, "--reader-w", 360, -1]].forEach(
  ([id, panel, varName, def, dir]) => {
    const grip = document.getElementById(id);
    let w = def, drag = false, x0 = 0, w0 = 0;
    const setW = v => { w = v; document.documentElement.style.setProperty(varName, v + "px"); };
    grip.addEventListener("pointerdown", e => {
      if (grip.classList.contains("shut")) return;
      drag = true; x0 = e.clientX; w0 = w; grip.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grip.addEventListener("pointermove", e => {
      if (!drag) return;
      setW(Math.max(0, Math.min(520, w0 + (e.clientX - x0) * dir)));
    });
    grip.addEventListener("pointerup", () => {
      drag = false;
      if (w < 56) { grip.classList.add("shut"); panel.style.display = "none"; setW(0); refresh(); }
    });
    grip.addEventListener("click", () => {
      if (!grip.classList.contains("shut")) return;
      grip.classList.remove("shut"); panel.style.display = ""; setW(def); refresh();
    });
    grip.querySelector("span").textContent = dir > 0 ? "›" : "‹";
  });

function refresh() { requestAnimationFrame(() => { /* the stage resized under us */ }); }
addEventListener("resize", () => { if (!picked) fit(); });

/* ============================================================
   GO
   ============================================================ */
overview();
requestAnimationFrame(() => { fit(); mark(); });

})();
