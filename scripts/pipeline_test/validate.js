/* Structural validation of the pipeline tree: loads iso + shapes + data the way
   the browser does (classic scripts sharing one scope), stubs the DOM only far
   enough for the shape functions to run, then renders every node and checks the
   graph. Catches: unknown shapes, dangling edges, bad follow targets, missing
   SNIPPETS kinds, missing required fields, NaN geometry, row overflow. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const DIR = path.resolve(__dirname, "../../public/pipeline");

let elCount = 0;
const fakeEl = () => ({ appendChild(){ elCount++; }, setAttribute(){}, style:{} });
const sandbox = {
  console,
  Math, JSON, Object, Array, String, Number, Boolean, Set, Map, Error,
  document: { createElementNS: () => fakeEl(), createElement: () => fakeEl() },
  window: {},
  performance: { now: () => 0 },
};
vm.createContext(sandbox);
for (const f of ["pipeline-iso.js", "pipeline-shapes.js", "pipeline-data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), sandbox, { filename: f });
}

/* top-level const in a classic script lands in the context's global lexical
   scope, not on the sandbox object — reach it the way the browser would */
const G = vm.runInContext(
  "({NODES,EDGES,BANDS,CARRIES,SNIPPETS,OVERVIEW,ROWS,LANES,MIRROR,DRAW,UNVERIFIED,layoutRows})",
  sandbox);
const { NODES, EDGES, BANDS, CARRIES, SNIPPETS, OVERVIEW, ROWS, LANES, MIRROR, DRAW, UNVERIFIED } = G;
sandbox.layoutRows = G.layoutRows;
const fail = [], warn = [];
const byId = Object.fromEntries(NODES.map(n => [n.id, n]));

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
NODES.forEach(n => { if (!touched.has(n.id)) fail.push(`${n.id}: orphan — in no edge`); });

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
  try { DRAW[n.shape](fakeEl(), n); }
  catch (err) { fail.push(`${n.id} (${n.shape}) threw while drawing: ${err.message}`); }
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

console.log(`\n${NODES.length} nodes, ${EDGES.length} edges, ${Object.keys(SNIPPETS).length} payload kinds, ${elCount} SVG elements emitted`);
console.log(`UNVERIFIED: ${[...UNVERIFIED].join(" ")}`);
warn.forEach(w => console.log("WARN  " + w));
if (fail.length) { console.log("\nFAIL"); fail.forEach(f => console.log("  " + f)); process.exit(1); }
console.log("\nall structural checks pass");
