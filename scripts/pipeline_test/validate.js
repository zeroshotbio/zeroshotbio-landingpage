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
