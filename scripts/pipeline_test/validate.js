/* Structural validation of the pipeline tree: loads iso + shapes + data the way
   the browser does (classic scripts sharing one scope), stubs the DOM only far
   enough for the shape functions to run, then renders every node and checks the
   graph. Catches: unknown shapes, dangling edges, bad follow targets, missing
   SNIPPETS kinds, missing required fields, NaN geometry, row overflow. */
const fs = require("fs"), path = require("path"), vm = require("vm");
/* WHICH MAP, AND WHICH SCRIPTS. These files serve /pipeline and
   /molecular_pipe, which share the projection, the shapes and the view and
   differ only in their data file — so the verifier has to be able to load
   either. A shape written for one map lives in the file BOTH of them read,
   which is exactly why a change for the small map still has to be checked
   against the big one.

     node <this> --map pipeline          (the default)
     node <this> --map molecular_pipe

   THE LIST IS THE PAGE'S OWN SCRIPT LIST, not a shortened one. It used to name
   four files — iso, shapes, data, view — and that stopped being true when the
   four roofed culls moved to /culls and again when row 3's shapes moved to
   pipeline-fqshapes.js. Every cull then failed to draw with "DRAW[n.shape] is
   not a function", so all three verifiers failed on a tree nobody had touched;
   and the daemon behind "Edit visual" tells its agent to run them and not to
   commit failing work, which meant no request could ever ship. If a page gains
   a script, add it here in the same position. */
const P = (d) => path.resolve(__dirname, "../../public/" + d);
const MAP = (() => {
  const i = process.argv.indexOf("--map");
  const id = i >= 0 ? process.argv[i + 1] : "pipeline";
  if (id === "molecular_pipe")
    return { id, dir: P("molecular_pipe"), files: [
      P("pipeline/pipeline-iso.js"), P("pipeline/pipeline-shapes.js"),
      P("molecular_pipe/mol-data.js"), P("pipeline/pipeline-view.js") ] };
  return { id, dir: P("pipeline"), files: [
      P("pipeline/pipeline-iso.js"), P("pipeline/pipeline-shapes.js"),
      P("culls/culls-pop.js"), P("culls/culls-draw.js"),
      P("pipeline/pipeline-fqshapes.js"), P("pipeline/pipeline-data.js"),
      P("pipeline/pipeline-view.js") ] };
})();
const DIR = MAP.dir;
const BASENAME = (p) => p.split("/").pop();


let elCount = 0;
/* The stub records what a shape actually asked for. It used to throw the
   attributes away, which made it blind to the one thing a drawing can get
   wrong without erroring: emitting an element and never telling it where to
   go. An unplaced element sits at the SVG origin — a long way from any node —
   and the selection halo is a CSS filter, whose region is the group's bounding
   box, so one stray circle turns the halo into a box the size of the map and
   hands the browser a raster it will not keep repainting. That is what the
   sequencer's loose drop did. */
/* THE STUB HAS TO LOOK ENOUGH LIKE AN ELEMENT FOR THE SHAPES TO RUN. It grew
   `tag/attrs/kids` and the two accessors, which was every DOM feature the map
   used at the time. It is not any more: the thaw reaches for insertBefore, the
   dedup field keeps a base transform on dataset, and the roofed culls read
   children. Each of those threw "…is not a function" and the node was reported
   as a broken drawing when the drawing was fine and the harness was thin.
   tagName and children are aliases so code written against the real DOM — the
   groundLoose sweep below, for one — works here unchanged. */
const fakeEl = (tag) => ({
  tag, attrs: {}, kids: [], dataset: {}, style: {},
  get tagName(){ return this.tag; },
  get children(){ return this.kids; },
  get childNodes(){ return this.kids; },
  get firstChild(){ return this.kids[0] || null; },
  get parentNode(){ return this._parent || null; },
  appendChild(c){ elCount++; if (c && c.tag){ c._parent = this; this.kids.push(c); } return c; },
  insertBefore(c, ref){
    elCount++; if (!c || !c.tag) return c;
    c._parent = this;
    const i = ref ? this.kids.indexOf(ref) : -1;
    if (i >= 0) this.kids.splice(i, 0, c); else this.kids.push(c);
    return c;
  },
  removeChild(c){ const i = this.kids.indexOf(c); if (i >= 0) this.kids.splice(i, 1); return c; },
  remove(){ const p = this._parent; if (p) p.removeChild(this); },
  setAttribute(k, v){ this.attrs[k] = String(v); },
  getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; },
  removeAttribute(k){ delete this.attrs[k]; },
  hasAttribute(k){ return k in this.attrs; },
  addEventListener(){}, removeEventListener(){},
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  getBBox(){ return { x:0, y:0, width:0, height:0 }; },
  set textContent(v){ this._txt = String(v); }, get textContent(){ return this._txt || ""; },
});
const sandbox = {
  console,
  Math, JSON, Object, Array, String, Number, Boolean, Set, Map, Error,
  document: { createElementNS: (ns, t) => fakeEl(t), createElement: (t) => fakeEl(t) },
  window: {},
  performance: { now: () => 0 },
};
vm.createContext(sandbox);
for (const f of MAP.files.filter(x => !/pipeline-view\.js$/.test(x))) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: BASENAME(f) });
}

/* top-level const in a classic script lands in the context's global lexical
   scope, not on the sandbox object — reach it the way the browser would */
const G = vm.runInContext(
  /* MODEL and CARRIED belong to /pipeline: the culls model comes from
     culls-draw.js and the carried nodes from that map's data file. Neither is
     loaded for /molecular_pipe, and naming an undeclared const in a destructure
     is a ReferenceError rather than undefined — so they are asked for by typeof
     and default to nothing. */
  "({NODES,EDGES,BANDS,CARRIES,SNIPPETS,OVERVIEW,ROWS,LANES,MIRROR,DRAW,UNVERIFIED,layoutRows," +
  "groundLoose," +
  "CARRIED:(typeof CARRIED!==\"undefined\"?CARRIED:[])," +
  "MODEL:(typeof MODEL!==\"undefined\"?MODEL:null)})",
  sandbox);
const { NODES, EDGES, BANDS, CARRIES, SNIPPETS, OVERVIEW, ROWS, LANES, MIRROR, DRAW, UNVERIFIED } = G;
sandbox.layoutRows = G.layoutRows;
const fail = [], warn = [];
const CHECK_PLACEMENT = [];
/* CARRIED NODES ARE REAL NODES. UDc and FDc are the row above's object drawn
   again at the head of this one, and edges genuinely land on them — but they
   live in CARRIED rather than NODES, so an edge to one read as "unknown a". */
const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
(G.CARRIED || []).forEach(c => { if (!byId[c.id]) byId[c.id] = { ...byId[c.carried], ...c }; });

// required fields
const REQ = ["id","key","group","shape","name","x","y","w","d","h","sub","does","built","cond"];
NODES.forEach(n => {
  REQ.forEach(k => { if (n[k] === undefined || n[k] === "") fail.push(`${n.id}: missing ${k}`); });
  if (!DRAW[n.shape]) fail.push(`${n.id}: unknown shape "${n.shape}"`);
  const big = n.anchor || n.shape === "works" || n.shape === "machine";
  if (big && !n.stat) fail.push(`${n.id}: landmark/apparatus with no stat (renders "undefined")`);
  if (!big && n.stat) warn.push(`${n.id}: has stat but is not a landmark — never rendered`);
  if (n.shape === "plate96" || n.shape === "miniplate") {
    if (!n.cols || !n.rows) fail.push(`${n.id}: plate shape without cols/rows`);
  }
  if (n.shape === "matrix" && (!n.cells || n.fill === undefined)) fail.push(`${n.id}: matrix without cells/fill`);
});

// unique ids and keys
const seen = new Set(), keys = new Set();
NODES.forEach(n => {
  if (seen.has(n.id)) fail.push(`duplicate id ${n.id}`); seen.add(n.id);
  if (keys.has(n.key)) fail.push(`duplicate key ${n.key} (${n.id})`); keys.add(n.key);
});

// edges resolve, and every edge kind has a payload
EDGES.forEach((e, i) => {
  if (!byId[e.a]) fail.push(`EDGES[${i}]: unknown a "${e.a}"`);
  if (!byId[e.b]) fail.push(`EDGES[${i}]: unknown b "${e.b}"`);
  if (!SNIPPETS[e.kind]) fail.push(`EDGES[${i}] ${e.a}->${e.b}: no SNIPPETS["${e.kind}"]`);
});
CARRIES.forEach((c, i) => { if (!SNIPPETS[c.kind]) fail.push(`CARRIES[${i}]: no SNIPPETS["${c.kind}"]`); });

// follow targets
NODES.filter(n => n.follow).forEach(n => {
  if (!byId[n.follow.a]) fail.push(`${n.id}: follow.a "${n.follow.a}" not a node`);
  if (n.follow.b && !byId[n.follow.b]) fail.push(`${n.id}: follow.b "${n.follow.b}" not a node`);
});

// UNVERIFIED keys must exist (the badge is looked up by key, not id)
[...UNVERIFIED].forEach(k => { if (!keys.has(k)) fail.push(`UNVERIFIED key "${k}" matches no node`); });

// every node reachable from the edge list (an orphan draws but connects to nothing)
const touched = new Set();
EDGES.forEach(e => { touched.add(e.a); touched.add(e.b); });
/* SOME NODES ARE UNCONNECTED ON PURPOSE, and the difference between that and a
   node somebody forgot to wire is that the data file says so. `scenery` is a
   floor rather than a station — the attrition band is painted on the ground and
   belongs to no graph. `noedge` is the explicit one: the FASTQ pool and the
   fragment beside it have no tracks because a track means material moving from
   one object to another, and the fragment is not somewhere reads GO, it is one
   of them drawn larger. The two leaders between them already say that, and a
   track would double the claim and put dots on a magnification. */
NODES.forEach(n => {
  if (touched.has(n.id) || n.scenery || n.noedge) return;
  fail.push(`${n.id}: orphan — in no edge`);
});

// OVERVIEW shape
["eyebrow","title","sub","does","built","cond"].forEach(k => {
  if (!OVERVIEW[k]) fail.push(`OVERVIEW: missing ${k}`);
});

// layout, then geometry sanity + row overflow
sandbox.layoutRows(NODES, LANES, MIRROR);
NODES.forEach(n => { if (!Number.isFinite(n.x)) fail.push(`${n.id}: x is ${n.x} after layout`); });
LANES.forEach((L, ri) => {
  const on = NODES.filter(n => n.lane === L.id).sort((a,b) => a.x - b.x);
  if (!on.length) { fail.push(`lane ${L.id} is empty`); return; }
  const lo = Math.min(...on.map(n => n.x - n.w/2)), hi = Math.max(...on.map(n => n.x + n.w/2));
  let overlap = 0;
  for (let i = 1; i < on.length; i++) if (on[i].x - on[i].w/2 < on[i-1].x + on[i-1].w/2) overlap++;
  console.log(`lane ${L.id.padEnd(8)} y=${String(L.y).padEnd(5)} ${String(on.length).padStart(2)} nodes  span ${lo.toFixed(2)}..${hi.toFixed(2)}` +
              (overlap ? `  OVERLAPS: ${overlap}` : ""));
  if (overlap) fail.push(`lane ${L.id}: ${overlap} overlapping node pair(s)`);
});

// side structures sit off-row and get x from follow{}, so layoutRows never
// spaces them — check the ones sharing a y for overlap by hand
(function sideStructures(){
  const off = NODES.filter(n => n.follow);
  const byY = {};
  off.forEach(n => (byY[n.y] = byY[n.y] || []).push(n));
  Object.entries(byY).forEach(([y, ns]) => {
    ns.sort((a,b) => a.x - b.x);
    console.log(`side y=${y}: ${ns.map(n => `${n.id}@${n.x.toFixed(2)}`).join("  ")}`);
    for (let i = 1; i < ns.length; i++) {
      const gap = (ns[i].x - ns[i].w/2) - (ns[i-1].x + ns[i-1].w/2);
      if (gap < 0.15) fail.push(`side structures ${ns[i-1].id}/${ns[i].id} at y=${y} overlap or touch (gap ${gap.toFixed(2)})`);
    }
  });
})();

// every shape actually renders without throwing, and every payload builds
NODES.forEach(n => {
  const root = fakeEl("g");
  /* THE PAGE GROUNDS EVERY LOOSE ELEMENT AFTER A DRAW — see groundLoose in
     pipeline-iso.js. The checker has to do the same, or it measures a state the
     browser never shows and fails on shapes that are behaving. */
  /* SCENERY THAT READS THE MODEL IS FED THE WAY THE PAGE FEEDS IT. The
     attrition staircase draws a ledger the VIEW attaches — a deep copy of
     MODEL.ledger with each step placed at its own node's x. Without it the
     shape throws on `ledger.start`, and the checker reports a broken drawing
     when what is missing is the setup. */
  if (n.shape === "attritionstaircase" && G.MODEL && !n.ledger) {
    n.ledger = JSON.parse(JSON.stringify(G.MODEL.ledger));
    n.ledger.steps = n.ledger.steps.filter(st => byId[st.id]);
    n.ledger.steps.forEach(st => { st.x = byId[st.id].x; });
  }
  try { DRAW[n.shape](root, n);
        if (typeof G.groundLoose === "function") G.groundLoose(root, n);
        CHECK_PLACEMENT.push([n, root]); }
  catch (err) { fail.push(`${n.id} (${n.shape}) threw while drawing: ${err.message}` + (process.env.STACK ? "\n     " + String(err.stack).split("\n").slice(1,4).map(x=>x.trim()).join(" <- ") : "")); }
});
Object.keys(SNIPPETS).forEach(k => {
  for (let i = 0; i < 60; i++) {           // generators pick at random; exercise all branches
    let s;
    try { s = SNIPPETS[k](); }
    catch (err) { fail.push(`SNIPPETS.${k} threw: ${err.message}`); break; }
    if (!s || !s.label || !s.text) { fail.push(`SNIPPETS.${k}: missing label/text`); break; }
    if (/undefined|NaN|\[object/.test(s.text + s.label + (s.note||""))) {
      fail.push(`SNIPPETS.${k}: renders undefined/NaN -> ${JSON.stringify(s.text.slice(0,120))}`); break;
    }
  }
});

// the reader interpolates does/built/cond as HTML, sub/name/group escaped
NODES.forEach(n => {
  ["does","built","cond"].forEach(k => {
    if (/<(?!\/?(mark|em|strong|p|br)\b)/.test(n[k])) warn.push(`${n.id}.${k}: unexpected raw tag`);
  });
});

/* ---- every drawn element must know where it is ---- */
const NEEDS = { circle:["cx","cy"], ellipse:["cx","cy"], rect:["x","y"],
                line:["x1","y1","x2","y2"], path:["d"], polygon:["points"],
                polyline:["points"], text:["x","y"], image:["x","y"] };
const placed = (e) => {
  const need = NEEDS[e.tag];
  if (!need) return true;
  if (e.attrs.transform) return true;            // placed by its own transform
  if (!need.every(k => e.attrs[k] !== undefined && e.attrs[k] !== "")) return false;
  const p = e.attrs.points;
  if (p !== undefined && (!p.trim() || /^0[ ,]0$/.test(p.trim()))) return false;
  return true;
};
/* ---- A SHAPE MUST SCALE WITH ITS NODE -------------------------------------
   w, d and h are read at DRAW time and a resize is the one edit that redraws,
   so a shape that hardcodes a world constant draws correctly at the size it was
   authored and comes apart the moment anybody drags a corner: the plate grows
   and the tube beside it stays exactly where it was and exactly as big. That is
   not hypothetical — it shipped, and it was reported as "the vial didn't move
   and the pipette didn't grow".

   So each shape is drawn twice, once at its authored size and once at double,
   and what is measured is the spread of the coordinates it emits. A shape that
   scales grows its spread; one built on constants barely moves. The threshold
   is deliberately loose — 1.4x for a 2x node — because plenty of shapes have
   parts that legitimately do not scale (a stroke width, a fixed label) and the
   failure being caught here is a shape that scarcely moves at all. */
/* TRANSFORMS HAVE TO BE COMPOSED, not ignored. Half this map's detail is drawn
   in unit space inside a transform — the roof charts are a single matrix(), the
   pipette tip is a rotate() and a scale() — so reading the raw attributes says
   those parts never move at any size, and every one of them reads as a failure.
   Measuring raw attributes flagged 21 shapes here, nearly all of them fine.
   So each node is walked with its parent transform carried down. */
const MUL = (m, t) => [m[0]*t[0]+m[2]*t[1], m[1]*t[0]+m[3]*t[1],
                       m[0]*t[2]+m[2]*t[3], m[1]*t[2]+m[3]*t[3],
                       m[0]*t[4]+m[2]*t[5]+m[4], m[1]*t[4]+m[3]*t[5]+m[5]];
const parseT = (str) => {
  let m = [1,0,0,1,0,0];
  for (const [, fn, argstr] of String(str).matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = (argstr.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []).map(Number);
    if (fn === "matrix" && v.length >= 6) m = MUL(m, v);
    else if (fn === "translate") m = MUL(m, [1,0,0,1, v[0]||0, v[1]||0]);
    else if (fn === "scale") m = MUL(m, [v[0]||1, 0, 0, v.length>1?v[1]:(v[0]||1), 0, 0]);
    else if (fn === "rotate") { const r = (v[0]||0)*Math.PI/180, c = Math.cos(r), s2 = Math.sin(r);
      if (v.length >= 3) m = MUL(m, [1,0,0,1, v[1], v[2]]);
      m = MUL(m, [c, s2, -s2, c, 0, 0]);
      if (v.length >= 3) m = MUL(m, [1,0,0,1, -v[1], -v[2]]); }
  }
  return m;
};
const pointsOf = (root) => {
  const pts = [];
  const num = (v) => (String(v).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const put = (m, x, y) => pts.push([m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]]);
  (function walk(e, m){
    for (const k of e.kids || []) {
      const a = k.attrs, km = a.transform ? MUL(m, parseT(a.transform)) : m;
      if (a.points || a.d) { const v = num(a.points || a.d);
        for (let i = 0; i + 1 < v.length; i += 2) put(km, v[i], v[i+1]); }
      for (const [ax, ay] of [["cx","cy"],["x","y"],["x1","y1"],["x2","y2"]])
        if (a[ax] !== undefined && a[ay] !== undefined) put(km, +a[ax], +a[ay]);
      walk(k, km);
    }
  })(root, [1,0,0,1,0,0]);
  return pts;
};
const spreadOf = (root) => {
  const xs = [], ys = [];
  const num = (v) => (String(v).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const put = (m, x, y) => { xs.push(m[0]*x + m[2]*y + m[4]); ys.push(m[1]*x + m[3]*y + m[5]); };
  (function walk(e, m){
    for (const k of e.kids || []) {
      const a = k.attrs, km = a.transform ? MUL(m, parseT(a.transform)) : m;
      if (a.points || a.d) { const v = num(a.points || a.d);
        for (let i = 0; i + 1 < v.length; i += 2) put(km, v[i], v[i+1]); }
      for (const [ax, ay] of [["cx","cy"],["x","y"],["x1","y1"],["x2","y2"]])
        if (a[ax] !== undefined && a[ay] !== undefined) put(km, +a[ax], +a[ay]);
      walk(k, km);
    }
  })(root, [1,0,0,1,0,0]);
  if (xs.length < 2) return 0;
  return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
};
/* THESE ELEVEN ALREADY DID NOT SCALE when this check was written. They are a
   BASELINE, not an exemption: recorded so a new offender fails loudly instead
   of disappearing into a list that is red anyway, which is how a gate stops
   being read. Every one of them will misbehave if it is resized in Edit
   positions — the drawing keeps part of itself where it was. Delete a name from
   this list the moment its shape is fixed; the check will then hold it. The
   roofs (c1..c5) live in the shared culls-draw.js, so fixing those touches
   /bioinformatics_pipe too and wants its own pass. */
const KNOWN_UNSCALING = new Set(["A7","THW","E2","E3","E4","E5","c1","c3","c4","c5","KAS"]);
NODES.filter(n => DRAW[n.shape] && n.w && n.d && !KNOWN_UNSCALING.has(n.id)).forEach(n => {
  const draw = (mul) => {
    const k = { ...n, w: n.w*mul, d: n.d*mul, h: (n.h||0.1)*mul };
    const root = fakeEl("g");
    try { DRAW[n.shape](root, k); if (typeof G.groundLoose === "function") G.groundLoose(root, k); }
    catch { return null; }
    return { spread: spreadOf(root), pts: pointsOf(root) };
  };
  const one = draw(1), two = draw(2);
  if (!one || !two) return;
  const grew = two.spread / one.spread;
  /* THE SPREAD RATIO ALONE IS TOO COARSE and it let the reported bug through.
     poolsplit's plate scaled and its tube did not; the plate is the big part,
     so the overall drawing still nearly doubled and the check passed while the
     tube sat visibly detached. What identifies a pinned part is not that the
     shape grew too little — it is that some points came out at LITERALLY the
     same coordinates at both sizes. Nothing that reads w, d or h can do that. */
  const A = one.pts, B = two.pts;
  let pinned = 0;
  if (A.length === B.length) for (let i = 0; i < A.length; i++)
    if (Math.abs(A[i][0]-B[i][0]) < 1e-6 && Math.abs(A[i][1]-B[i][1]) < 1e-6) pinned++;
  const pinFrac = A.length === B.length && A.length ? pinned / A.length : 0;
  if (pinFrac > 0.04)
    fail.push(`${n.id} (${n.shape}): ${(pinFrac*100).toFixed(0)}% of its points drew at ` +
      `IDENTICAL coordinates at both sizes (${pinned} of ${A.length}) — that part is on ` +
      `world constants, not on n.w/n.d/n.h, and a resize leaves it behind.`);
  else if (grew < 1.4)
    fail.push(`${n.id} (${n.shape}): does not scale — doubling w, d and h grew the ` +
      `drawing ${grew.toFixed(2)}x. Its geometry is hardcoded rather than read off ` +
      `n.w/n.d/n.h, so a resize moves the box and leaves the drawing behind.`);
});

CHECK_PLACEMENT.forEach(([n, root]) => {
  const loose = [];
  (function walk(e){ (e.kids || []).forEach(c => { if (!placed(c)) loose.push(c.tag); walk(c); }); })(root);
  if (loose.length)
    fail.push(`${n.id} (${n.shape}): ${loose.length} element(s) drawn with no position — ` +
              `${[...new Set(loose)].join(", ")}. They sit at the origin and drag the ` +
              `selection halo out with them; give them a home in the build and let the ` +
              `ticker move them from there.`);
});

console.log(`\n${NODES.length} nodes, ${EDGES.length} edges, ${Object.keys(SNIPPETS).length} payload kinds, ${elCount} SVG elements emitted`);
console.log(`UNVERIFIED: ${[...UNVERIFIED].join(" ")}`);
warn.forEach(w => console.log("WARN  " + w));
if (fail.length) { console.log("\nFAIL"); fail.forEach(f => console.log("  " + f)); process.exit(1); }
console.log("\nall structural checks pass");
