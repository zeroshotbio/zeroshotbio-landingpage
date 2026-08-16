/* Executes pipeline-view.js end to end against a stubbed DOM. The structural
   validator never loads view.js, so assembly, edge routing, dot placement, the
   reader panel and the index went untested. This catches runtime errors there,
   and reports the layer order and a few things worth asserting. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const DIR = path.resolve(__dirname, "../../public/pipeline");

let nodeSeq = 0;
function mkEl(tag){
  const e = {
    tag, id: ++nodeSeq, children: [], attrs: {}, _txt: "",
    style: { _p:{}, setProperty(k,v){ this._p[k]=v; }, getPropertyValue(k){ return this._p[k]||""; } },
    appendChild(c){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1);
                    this.children.push(c); c.parent = this; return c; },
    insertBefore(c, ref){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1);
                          const j=this.children.indexOf(ref);
                          this.children.splice(j<0?this.children.length:j, 0, c);
                          c.parent = this; return c; },
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; },
    setAttribute(k,v){ this.attrs[k] = String(v); },
    getAttribute(k){ return this.attrs[k]; },
    _ls:null,
    addEventListener(t,fn){ (this._ls=this._ls||{}); (this._ls[t]=this._ls[t]||[]).push(fn); },
    fire(t,ev){ const e=Object.assign(
      {currentTarget:this,target:this,stopPropagation(){},preventDefault(){}}, ev);
      ((this._ls||{})[t]||[]).forEach(fn=>fn(e));
      if(typeof this["on"+t]==="function") this["on"+t](e); },
    getBBox(){ return this.tag==="text" ? {x:0,y:-8,width:90,height:11}
                                       : {x:0,y:0,width:1000,height:800}; },
    getBoundingClientRect(){ return {width:1200,height:800,left:0,top:0}; },
    setPointerCapture(){ this._captured=true; }, releasePointerCapture(){ this._captured=false; },
    classList:(()=>{const set=new Set();return{
      add(c){set.add(c);}, remove(c){set.delete(c);},
      toggle(c,on){ if(on===undefined) set.has(c)?set.delete(c):set.add(c);
                    else on?set.add(c):set.delete(c); },
      contains(c){return set.has(c);} };})(),
    get firstChild(){ return this.children[0]||null; },
    get parentNode(){ return this.parent||null; },
    offsetWidth:420, offsetHeight:150,
    querySelectorAll(sel){ const out=[];
      (function walk(e){ (e.children||[]).forEach(c=>{
        const cls=(c.attrs&&c.attrs.class)||"";
        if(sel.split(",").some(t=>{t=t.trim();
          return t.startsWith(".") ? cls.split(/\s+/).includes(t.slice(1)) : c.tag===t;})) out.push(c);
        walk(c); }); })(this); return out; },
    querySelector(sel){ const a=this.querySelectorAll(sel); return a[0]||null; },
    scrollIntoView(){}, focus(){}, select(){},
    closest(sel){ let e=this; while(e){ if(sel==="[data-tf]" && e.dataset && e.dataset.tf) return e;
                                        e=e.parent; } return null; },
    get textContent(){ return this._txt; },
    set textContent(v){ this._txt = v; (this._log = this._log || []).push(v); },
    get innerHTML(){ return this._html||""; }, set innerHTML(v){ this._html = v; },
    dataset: {},
  };
  return e;
}
const byIdEl = {};
["svg","read","aside","strip","reader","sheetClose","btnPlay","btnStep","btnTheme","btnReset",
  "btnStages","btnAxes","btnEdit","btnSave","btnDiscard","stPrev","stNext",
  "gripL","gripR","btnVisual","ask","askIn","askWhat","askGo","askWait","askState","askHint",
  "askX","askHide"]
  .forEach(id => byIdEl[id] = mkEl(id));
mkEl("stage").appendChild(byIdEl["svg"]);
["gripL","gripR"].forEach(id=>byIdEl[id].appendChild(mkEl("span")));          // the svg always has a parent in the page

const sandbox = {
  console,
  Math, JSON, Object, Array, String, Number, Boolean, Set, Map, Error, Date, RegExp,
  document: {
    createElementNS: (ns,t) => mkEl(t),
    createElement: t => mkEl(t),
    getElementById: id => (byIdEl[id] = byIdEl[id] || mkEl(id)),
    querySelectorAll: () => [],
    querySelector: sel => (byIdEl[sel] = byIdEl[sel] || mkEl(sel)),
    body: mkEl("body"),
    addEventListener(){},
  },
  window: { matchMedia: q => ({matches: /coarse|max-width/.test(q) ? false : false, media:q}),
            innerWidth: 1400, innerHeight: 800,
            _ls:{}, addEventListener(t,fn){ (this._ls[t]=this._ls[t]||[]).push(fn); },
            fire(t,ev){ (this._ls[t]||[]).forEach(fn=>fn(Object.assign(
              {stopPropagation(){},preventDefault(){}}, ev))); } },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  /* SEED_EDITS makes this a RELOAD: the page comes up with a saved table
     already in the store, which is the only way to catch an override that is
     honoured while you drag and dropped when you come back. */
  localStorage: { _m: process.env.SEED_EDITS ? {"pipeline.edits":process.env.SEED_EDITS} : {},
                  getItem(k){ return k in this._m ? this._m[k] : null; },
                  setItem(k,v){ this._m[k]=String(v); }, removeItem(k){ delete this._m[k]; } },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  location: { reload(){} },
  confirm: () => false,
  prompt: () => "test-key",
  setTimeout: (fn,ms) => { queueMicrotask(fn); return 0; },
  clearTimeout: () => {},
  fetch: () => Promise.reject(new Error("no network in the harness")),
  Promise, queueMicrotask,
  setInterval: () => 0, clearInterval: () => {}, encodeURIComponent,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

const files = ["pipeline-iso.js","pipeline-shapes.js","pipeline-data.js","pipeline-view.js"];
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.join(DIR,f),"utf8"), sandbox, {filename:f}); }
  catch (err) { console.log(`FAIL — ${f} threw: ${err.message}\n${err.stack.split("\n").slice(0,4).join("\n")}`); process.exit(1); }
}
console.log("all four scripts executed without throwing");

const G = vm.runInContext("({world,gGrid,gAxis,gBand,gPlinth,gEdge,gDot,gNode,gLabel,GRID,NODES,nodeEls,DOTS,edgeGeom,paintIndex,show,unhover,release})", sandbox);

const order = G.world.children.map(c => {
  for (const k of ["gGrid","gAxis","gBand","gPlinth","gEdge","gDot","gNode","gLabel"]) if (G[k]===c) return k;
  return "?";
});
console.log("layer order (back to front):", order.join(" -> "));
const iDot = order.indexOf("gDot"), iNode = order.indexOf("gNode"), iLabel = order.indexOf("gLabel"), iEdge = order.indexOf("gEdge");
if (!(iEdge < iDot && iDot < iNode && iNode < iLabel))
  console.log("FAIL — tracks/dots are not behind the solid world");

// occlusion is a clip on the track layers now, not a painted patch. No node
// may open with an opaque background polygon — that was the visible slab.
let patched = [];
G.NODES.forEach(n => {
  const first = G.nodeEls[n.id].children[0];
  if (first && first.tag === "polygon" && first.attrs.fill === "var(--bg)"
      && first.attrs["fill-opacity"] === undefined) patched.push(n.id);
});
const clipE = G.gEdge.attrs["clip-path"], clipD = G.gDot.attrs["clip-path"];
console.log(`occlusion: edge clip ${clipE||"NONE"}, dot clip ${clipD||"NONE"}; painted patches ${patched.length}`);
if (patched.length) console.log("FAIL — a node still paints an opaque patch: " + patched.join(" "));
if (!clipE || !clipD) console.log("FAIL — the track layers are not clipped");

// hover is a preview: it haloes, and leaving clears it again
const haloed_ = () => Object.entries(G.nodeEls).filter(([,g]) => (g.style.filter||"").includes("drop-shadow")).map(([id])=>id);
G.show("KAS", false);
const onHover = haloed_();
G.unhover();
const afterLeave = haloed_();
console.log(`hover: haloes [${onHover.join(",")}], after leaving [${afterLeave.join(",")||"none"}]`);
if (onHover.length !== 1 || afterLeave.length) console.log("FAIL — hover does not clear on leave");

// a click pins: leaving must NOT clear it
G.show("KAS", true);
const pinnedHalo = haloed_();
G.unhover();
const stillPinned = haloed_();
console.log(`click: haloes [${pinnedHalo.join(",")}], still there after leaving [${stillPinned.join(",")||"none"}]`);
if (stillPinned.length !== 1) console.log("FAIL — a click does not survive the pointer leaving");

// clicking empty space releases it
G.release();
if (haloed_().length) console.log("FAIL — empty-space click does not clear a pin");
console.log("empty-space click clears:", haloed_().length === 0);

// selection must halo, never dim
G.show("KAS", true);
const dimmed = Object.entries(G.nodeEls).filter(([,g]) => g.style.opacity && +g.style.opacity < 1);
const haloed = Object.entries(G.nodeEls).filter(([,g]) => (g.style.filter||"").includes("drop-shadow"));
console.log("with KAS selected — dimmed:", dimmed.length, " haloed:", haloed.map(([id])=>id).join(",") || "none");
if (dimmed.length) console.log("FAIL — something dims on selection");
if (haloed.length !== 1 || haloed[0][0] !== "KAS") console.log("FAIL — halo not on the selected node alone");

// straight edges must be two-point runs
const straights = G.edgeGeom.filter(e => e.straight);
console.log("straight edges:", straights.map(e => `${e.a}->${e.b}(${e.segs.length}seg)`).join(" "));
if (straights.some(e => e.segs.length !== 1)) console.log("FAIL — a straight edge still has an elbow");


// the key must be gone from the artwork and present in the label text
const gL = vm.runInContext("gLabel", sandbox);
const labelText = [];
(function walk(e){ if(e._txt) labelText.push(e._txt); (e.children||[]).forEach(walk); })(gL);
// steps carry their key in the label; landmarks and apparatus carry none
const isBig = n => n.anchor || n.shape === "works" || n.shape === "machine";
const steps = G.NODES.filter(n => !isBig(n)), marks = G.NODES.filter(isBig);
const keyed = steps.filter(n => labelText.some(t => t.startsWith(n.key + " · ")));
const markKeyed = marks.filter(n => labelText.some(t => t.startsWith(n.key + " · ")));
console.log("steps with key in label:", keyed.length, "/", steps.length,
            " landmarks carrying a key (want 0):", markKeyed.length);
if (markKeyed.length) console.log("FAIL — a landmark label still carries its key");
let onArt = [];
G.NODES.forEach(n => {
  const g = G.nodeEls[n.id];
  (function walk(e){ if(e._txt === n.key) onArt.push(n.id); (e.children||[]).forEach(walk); })(g);
});
console.log("keys still drawn on the artwork:", onArt.length ? onArt.join(" ") : "none");
if (keyed.length !== steps.length) console.log("FAIL — a step key is missing from the labels");
if (onArt.length) console.log("FAIL — a key is still on the artwork");


// the ruler must exist, and must sit clear of every plinth
const axisNums = [];
(function walk(e){ if(e._txt) axisNums.push(e._txt); (e.children||[]).forEach(walk); })(G.gAxis);
const xs = axisNums.filter(t => /^-?\d+$/.test(t)).map(Number);
console.log(`ruler: ${axisNums.length} labels, range ${Math.min(...xs)}..${Math.max(...xs)}, axis names ${axisNums.filter(t=>t==="X"||t==="Y").join("")}`);
const pad = n => n.anchor ? 0.55 : 0.4;
const minX = Math.min(...G.NODES.map(n => n.x - n.w/2 - pad(n)));
const minY = Math.min(...G.NODES.map(n => n.y - n.d/2 - pad(n)));
console.log(`content starts at x=${minX.toFixed(2)} y=${minY.toFixed(2)}; rulers at x=${G.GRID.x0} y=${G.GRID.y0}`);
if (minX <= G.GRID.x0 || minY <= G.GRID.y0) console.log("FAIL — content overruns a ruler edge");
if (!axisNums.includes("X") || !axisNums.includes("Y")) console.log("FAIL — an axis name is missing");


// Drive every ticker through several full cycles. Animation code has branches
// that only run mid-cycle — reparenting, wrap-around, end-of-loop resets — and
// none of it had ever been executed by a test before.
const TICKERS = vm.runInContext("TICKERS", sandbox);
let ticked = 0, tickErr = null, now = 0;
try {
  for (let i = 0; i < 2400; i++) {           // 2400 x 40ms = 96 simulated seconds
    now += 40;
    TICKERS.forEach(f => f(0.04, now, 1));   // zoom 1, above the 0.7 gate
    ticked++;
  }
} catch (err) { tickErr = err; }
console.log(`tickers: ${TICKERS.length} registered, ${ticked} frames driven (${(ticked*0.04).toFixed(0)}s simulated)`);
if (tickErr) console.log("FAIL — a ticker threw: " + tickErr.message + "\n  " + tickErr.stack.split("\n")[1]);


// The map must not arrive frozen. Every shape carries its own zoom gate; the
// frame loop is what decides, and it has to still be moving at the fit view.
(function motion(){
  const k=vm.runInContext("view.k",sandbox);
  const min=vm.runInContext("MOTION_MIN",sandbox);
  console.log(`fit view sits at zoom ${k.toFixed(2)}, motion stops below ${min}`);
  if(k<min) console.log("FAIL — the map is frozen at the view it opens at");
  // and the per-shape gates must not be able to override it
  let ran=0;
  const T=vm.runInContext("TICKERS",sandbox);
  const probe=(dt,now,z)=>{ if(z<0.7) return; ran++; };
  T.push(probe);
  /* the stub reports one fixed bbox, so drive the real zooms by hand: what a
     desktop and a phone actually open at, and a genuine thumbnail */
  const at=k=>{ ran=0; vm.runInContext(`view.k=${k}`,sandbox);
                vm.runInContext("frame(1000)",sandbox); return ran===1; };
  const desktop=at(0.44), phone=at(0.12), tiny=at(0.05);
  T.pop();
  console.log(`moving at desktop fit (0.44): ${desktop} · phone fit (0.12): ${phone} · thumbnail (0.05): ${tiny}`);
  if(!desktop) console.log("FAIL — frozen at the zoom a desktop opens at");
  if(!phone)   console.log("FAIL — frozen at the zoom a phone opens at");
  if(tiny)     console.log("FAIL — still animating when the map is a thumbnail");
})();

// the mobile strip must carry the same sequence as the left index
const stripEl = byIdEl["strip"];
console.log(`strip: innerHTML ${stripEl._html ? stripEl._html.length + " chars" : "EMPTY"}, ` +
            `chips ${(stripEl._html||"").split('class="chip').length - 1} for ${G.NODES.length} nodes`);
if (((stripEl._html||"").split('class="chip').length - 1) !== G.NODES.length)
  console.log("FAIL — the strip does not carry every node");

console.log(`\n${G.DOTS.length} dots on ${G.edgeGeom.length} tracks`);
console.log("done");


/* ============================================================
   EDIT POSITIONS — drive a real drag through the real handlers.
   The projection is affine, so a pointer moved N screen pixels must come back
   as exactly the world delta that projects to N pixels. That is the whole
   correctness claim of the mode, so assert it rather than eyeball it.
   ============================================================ */
/* ============================================================
   WALKING THE SEQUENCE — arrow keys and the two round buttons
   ============================================================ */
/* ============================================================
   PANELS and EDIT VISUAL
   ============================================================ */
(function panelsAndAsk(){
  if(process.env.SEED_EDITS) return;
  const body=sandbox.document.body;
  const w=()=>[body.style.getPropertyValue("--aside-w"), body.style.getPropertyValue("--reader-w")];
  console.log("panel widths at rest:", w().join("  "));
  if(w()[0]!=="238px"||w()[1]!=="352px") console.log("FAIL — panels did not take their default widths");

  const g=byIdEl["gripL"];
  g.fire("pointerdown",{pointerId:31,clientX:240});
  g.fire("pointerup",{pointerId:31});
  console.log("click the grip ->", w()[0], "sliver marked:", g.classList.contains("shut"));
  if(w()[0]!=="0px") console.log("FAIL — clicking the grip did not close the panel");
  if(!g.classList.contains("shut")) console.log("FAIL — a closed panel left no sliver marked");
  g.fire("pointerdown",{pointerId:32,clientX:0});
  g.fire("pointerup",{pointerId:32});
  console.log("click the sliver ->", w()[0]);
  if(w()[0]==="0px") console.log("FAIL — clicking the sliver did not bring the panel back");

  g.fire("pointerdown",{pointerId:33,clientX:238});
  g.fire("pointermove",{pointerId:33,clientX:338});
  console.log("drag 100px out ->", w()[0]);
  if(w()[0]!=="338px") console.log("FAIL — dragging the grip does not resize");
  g.fire("pointermove",{pointerId:33,clientX:60});
  console.log("drag past the minimum ->", w()[0]);
  if(w()[0]!=="0px") console.log("FAIL — dragging past the minimum did not shut it");
  g.fire("pointerup",{pointerId:33});

  /* answer the prompt queue only — everything else keeps failing, so the save
     tests further down still exercise the offline path */
  let posted=null;
  const realFetch=sandbox.fetch;
  sandbox.fetch=(url,opt)=>{
    if(String(url).indexOf("pipeline_prompts")<0) return realFetch(url,opt);
    if(opt&&opt.method==="POST"){ posted=JSON.parse(opt.body);
      return Promise.resolve({json:()=>Promise.resolve({ok:true,prompt:{id:"p1"}})}); }
    return Promise.resolve({json:()=>Promise.resolve({prompts:[]})});
  };
  vm.runInContext("goTo(NODES[0].id)",sandbox);
  byIdEl["btnVisual"].fire("click",{});
  console.log("dialogue open:", byIdEl["ask"].classList.contains("on"),
              " titled:", JSON.stringify((byIdEl["askWhat"]._txt||"").slice(0,44)));
  if(!byIdEl["ask"].classList.contains("on")) console.log("FAIL — Edit visual did not open");
  byIdEl["askIn"].value="give the aquarium a heater with bubbles";
  byIdEl["askGo"].fire("click",{});
  Promise.resolve().then().then().then().then(()=>{
    console.log("queued:", JSON.stringify(posted));
    if(!posted||!posted.text) console.log("FAIL — Send posted nothing");
    if(!posted||!posted.target||!posted.target.shape)
      console.log("FAIL — the selected step was not attached to the prompt");
    const pend=sandbox.localStorage.getItem("pipeline.pending");
    console.log("watching after send:", pend);
    if(!pend) console.log("FAIL — the page is not watching its own request");
    console.log("panels and edit visual ok");
  });
})();

(function walk(){
  if(process.env.SEED_EDITS) return;
  const G3=vm.runInContext("({NODES,release})",sandbox);
  const cur=()=>vm.runInContext("current",sandbox);
  const ids=G3.NODES.map(n=>n.id);
  G3.release();

  const key=k=>sandbox.window.fire("keydown",{key:k,target:{tagName:"BODY"}});
  key("ArrowRight");
  console.log(`from nothing, next -> ${cur()} (want ${ids[0]})`);
  if(cur()!==ids[0]) console.log("FAIL — next from a clear map did not start at the beginning");
  key("ArrowRight"); key("ArrowRight");
  console.log(`three forward -> ${cur()} (want ${ids[2]})`);
  if(cur()!==ids[2]) console.log("FAIL — arrow keys do not walk the sequence");
  key("ArrowLeft");
  if(cur()!==ids[1]) console.log("FAIL — back does not walk the other way");
  byIdEl["stNext"].fire("click",{});
  if(cur()!==ids[2]) console.log("FAIL — the next button does not step");
  byIdEl["stPrev"].fire("click",{});
  if(cur()!==ids[1]) console.log("FAIL — the previous button does not step");

  /* the ends wrap, so a tour never dead-ends */
  G3.release(); key("ArrowLeft");
  console.log(`from nothing, back -> ${cur()} (want ${ids[ids.length-1]})`);
  if(cur()!==ids[ids.length-1]) console.log("FAIL — back from a clear map did not start at the end");
  key("ArrowRight");
  if(cur()!==ids[0]) console.log("FAIL — the sequence does not wrap at the end");

  /* pinned, not previewed: leaving the map must not clear it */
  vm.runInContext("unhover()",sandbox);
  if(cur()!==ids[0]) console.log("FAIL — a stepped-to item is not pinned");

  /* and the keys belong to the text editor while it is typing */
  const before=cur();
  sandbox.window.fire("keydown",{key:"ArrowRight",target:{tagName:"TEXTAREA"}});
  if(cur()!==before) console.log("FAIL — arrow keys steal focus from a text field");
  key("Escape");
  if(cur()) console.log("FAIL — Escape did not clear the selection");
  console.log("sequence walk ok — keys, buttons, wrap, and no theft from a text field");
})();

(function reloaded(){
  if(!process.env.SEED_EDITS) return;
  const seed=JSON.parse(process.env.SEED_EDITS).offsets;
  const G2=vm.runInContext("({byId,labelEls,nodeEls,P,topOf})",sandbox);
  let bad=0;
  Object.entries(seed).forEach(([id,o])=>{
    const n=G2.byId[id]; if(!n) return;
    const big=n.anchor||n.shape==="works"||n.shape==="machine";
    /* the object itself */
    if(o.dx||o.dy){
      const t=(G2.nodeEls[id].attrs.transform||"");
      if(t) { console.log(`FAIL — ${id} carries a leftover drag transform on reload`); bad++; }
    }
    /* and its name: recompute where the anchor SHOULD be with lab applied */
    if(o.ldx||o.ldy){
      const lo=n.lab||{};
      const want = big
        ? (n.labelBelow ? G2.P(n.x+(lo.dx||0), n.y+n.d/2+(lo.dy||0), 0)
                        : G2.P(n.x+(lo.dx||0), n.y-n.d/2+(lo.dy||0), G2.topOf(n)))
        : null;
      const got=(G2.labelEls[id].attrs.transform||"").match(/translate\(([-\d.]+),([-\d.]+)\)/);
      if(!got){ console.log(`FAIL — ${id} label has no placement`); bad++; return; }
      const has=[+got[1],+got[2]];
      if(want && Math.hypot(has[0]-want[0],has[1]-want[1])>0.5){
        console.log(`FAIL — ${id} (landmark) name ignored its saved offset: `+
                    `drawn at ${has.map(v=>v.toFixed(0))}, saved says ${want.map(v=>v.toFixed(0))}`);
        bad++;
      }
      console.log(`${id} name offset ldx ${o.ldx||0} ldy ${o.ldy||0} -> lab ${JSON.stringify(n.lab)}`+
                  (want?`  drawn ${has.map(v=>v.toFixed(0))} want ${want.map(v=>v.toFixed(0))}`:""));
    }
  });
  Object.entries(seed).forEach(([id,o])=>{
    if(!o.dx && !o.dy) return;
    const n=G2.byId[id];
    console.log(`${id} at x ${n.x.toFixed(2)} y ${n.y.toFixed(2)} (offset ${o.dx||0}, ${o.dy||0})`);
  });
  console.log(bad?`RELOAD CHECK FAILED (${bad})`:"reload applies every saved offset");
})();

(function editMode(){
  if(process.env.SEED_EDITS) return;
  const S=42, C30=Math.cos(Math.PI/6);
  const body=sandbox.document.body, svgEl=byIdEl["svg"];
  const edit=byIdEl["btnEdit"], save=byIdEl["btnSave"], read=byIdEl["read"];
  const E=vm.runInContext("({nodeEls,labelEls,plinthEls,byId,editing})", sandbox);
  const store=sandbox.localStorage;

  if(!(edit._ls&&edit._ls.click) && typeof edit.onclick!=="function"){
    console.log("FAIL — Edit positions has no click handler"); return; }
  // the handles must exist and must be inert with the mode off
  const handles=[], hits=[];
  Object.values(E.nodeEls).forEach(g=>(function w(e){
    if((e.attrs.class||"").includes("ehandle")) handles.push(e);
    (e.children||[]).forEach(w); })(g));
  Object.values(E.labelEls).forEach(g=>(function w(e){
    if((e.attrs.class||"")==="ehit") hits.push(e);
    (e.children||[]).forEach(w); })(g));
  console.log(`edit handles: ${handles.length} footprints, ${hits.length} name boxes ` +
              `for ${vm.runInContext("NODES.length",sandbox)} nodes`);
  if(handles.length !== vm.runInContext("NODES.length",sandbox))
    console.log("FAIL — not every node got a drag footprint");

  edit.fire("click",{});
  if(!vm.runInContext("editing",sandbox)) console.log("FAIL — Edit positions did not arm the mode");

  // hovering a node must not select it while editing
  const before=vm.runInContext("current",sandbox);
  E.nodeEls["KAS"].fire("mouseenter",{});
  if(vm.runInContext("current",sandbox)!==before) console.log("FAIL — editing still selects on hover");

  // ---- drag a node 100px right, 40px down ----
  const n=E.byId["A5"], x0=n.x, y0=n.y;
  const g=E.nodeEls["A5"];
  g.fire("pointerdown",{pointerId:1,clientX:0,clientY:0});
  g.fire("pointermove",{pointerId:1,clientX:100,clientY:40});
  g.fire("pointerup",{pointerId:1});
  const dx=n.x-x0, dy=n.y-y0;
  // invert the projection by hand and compare
  const k=vm.runInContext("view.k",sandbox);        // a drag is in screen px, so undo the zoom
  const a=(100/k)/(S*C30), b=(40/k)/(S*0.5);
  const wx=(a+b)/2, wy=(b-a)/2;
  console.log(`node drag: 100px,40px at zoom ${k.toFixed(2)} -> dx ${dx.toFixed(2)} dy ${dy.toFixed(2)} ` +
              `(exact ${wx.toFixed(2)}, ${wy.toFixed(2)})`);
  if(Math.abs(dx-wx)>0.05 || Math.abs(dy-wy)>0.05) console.log("FAIL — node drag is not the world delta");
  if(!(g.attrs.transform||"").startsWith("translate")) console.log("FAIL — the node group did not move");
  if(!(E.labelEls["A5"].attrs.transform||"").includes("rotate"))
    console.log("FAIL — the name lost its own transform when the node moved");

  // the routes off that node must have been rebuilt against the new position
  const geom=vm.runInContext("edgeGeom",sandbox);
  const rec=geom.find(r=>r.a==="A5"||r.b==="A5");
  const A=E.byId[rec.a], B=E.byId[rec.b];
  const end=rec.segs[rec.segs.length-1];
  const tip=[end.from[0]+end.dx, end.from[1]+end.dy];
  const want=[(B.x-B.y)*S*C30, (B.x+B.y)*S*0.5-0.02*S*0.76];
  console.log(`route ${rec.a}->${rec.b} ends at ${tip.map(v=>v.toFixed(0))} (node at ${want.map(v=>v.toFixed(0))})`);
  if(Math.hypot(tip[0]-want[0],tip[1]-want[1])>1) console.log("FAIL — an edge did not follow the node");

  // ---- drag a name only ----
  const L=E.labelEls["FX"];
  L.fire("pointerdown",{pointerId:2,clientX:0,clientY:0});
  L.fire("pointermove",{pointerId:2,clientX:-60,clientY:30});
  L.fire("pointerup",{pointerId:2});
  const fx=E.byId["FX"];
  console.log(`name drag: FX ldx ${fx._lx.toFixed(2)} ldy ${fx._ly.toFixed(2)}, node still at x ${fx.x.toFixed(2)}`);
  if(!fx._lx && !fx._ly) console.log("FAIL — dragging a name moved nothing");
  if(fx.x !== fx._px) console.log("FAIL — dragging a name moved the object too");

  // a drag alone must already be durable — no Save needed to survive a refresh
  const afterDrag=JSON.parse(store.getItem("pipeline.edits")||"{}");
  console.log("auto-stashed after drag:", JSON.stringify(afterDrag.offsets||{}));
  if(!afterDrag.offsets || !afterDrag.offsets.A5 || !afterDrag.offsets.FX)
    console.log("FAIL — a drag did not persist without pressing Save");
  if(afterDrag.offsets.FX && (afterDrag.offsets.FX.dx||afterDrag.offsets.FX.dy))
    console.log("FAIL — a name-only drag leaked into the object offset");

  edit.fire("click",{});                                    // leave position mode

  // ---- edit text ----
  const text=byIdEl["btnText"], inp=byIdEl["teIn"], pop=byIdEl["tedit"];
  text.fire("click",{});
  if(!vm.runInContext("texting",sandbox)) console.log("FAIL — Edit text did not arm the mode");
  if(vm.runInContext("editing",sandbox)) console.log("FAIL — the two edit modes are both on at once");

  const bandT=vm.runInContext("textEls",sandbox)["band:0"];
  const bandBox=(bandT.parent.children||[]).find(c=>(c.attrs.class||"")==="thandle");
  if(!bandBox) console.log("FAIL — a band title has no box");
  bandBox.fire("pointerdown",{pointerId:8,clientX:10,clientY:10});
  inp.value="THE WET LAB";
  inp.fire("keydown",{key:"Enter",shiftKey:false});
  const BND=vm.runInContext("BANDS",sandbox);
  console.log(`band rename: "${BND[0].name}" -> drawn as "${bandT._txt}"`);
  if(BND[0].name!=="THE WET LAB") console.log("FAIL — the band name did not change");
  if(bandT._txt!=="THE WET LAB") console.log("FAIL — the drawn band title did not follow");

  // a string is clicked by its BOX, which is what the mode actually presents
  const nameT=vm.runInContext("textEls",sandbox)["A5:name"];
  const boxes=[]; (function w(e){ if((e.attrs.class||"")==="thandle") boxes.push(e);
    (e.children||[]).forEach(w); })(vm.runInContext("gLabel",sandbox));
  console.log(`text boxes: ${boxes.length} for ${Object.keys(vm.runInContext("textEls",sandbox)).length} strings`);
  if(boxes.length < Object.keys(vm.runInContext("textEls",sandbox)).length)
    console.log("FAIL — some strings have no clickable box");
  const nameBox=(nameT.parent.children||[]).find(c=>(c.attrs.class||"")==="thandle");
  if(!nameBox) console.log("FAIL — a step name has no box");
  // the pan must not take pointer capture — capturing on the root retargets the
  // click that ends the gesture and kills every listener on an SVG child
  if(byIdEl["svg"]._captured) console.log("FAIL — the pan still captures the pointer");
  nameBox.fire("pointerdown",{pointerId:9,clientX:10,clientY:10});
  if(vm.runInContext("drag",sandbox))
    console.log("FAIL — opening a name for editing also started a pan");
  console.log("popover opened:", pop.classList.contains("on"),
              " prefilled with:", JSON.stringify(inp.value));
  if(!pop.classList.contains("on")) console.log("FAIL — clicking a box did not open the editor");
  if(inp.value!==E.byId["A5"].name) console.log("FAIL — the editor did not prefill the current text");
  inp.value="Hold at 28.5 C";
  inp.fire("keydown",{key:"Enter",shiftKey:false});
  if(pop.classList.contains("on")) console.log("FAIL — the editor stayed open after saving");
  const a5=E.byId["A5"];
  console.log(`node rename: A5 -> "${a5.name}", label reads "${nameT._txt}"`);
  if(a5.name!=="Hold at 28.5 C") console.log("FAIL — the node name did not change");
  if(nameT._txt!=="A5 · Hold at 28.5 C") console.log("FAIL — a step label lost its key");

  // Enter saves through: local copy written, shared write attempted, result said
  // the fetch rejection walks a few microtasks before the toast is set
  Promise.resolve().then().then().then().then().then(()=>{
    const kept=JSON.parse(store.getItem("pipeline.edits")||"{}");
    const ok=kept.text&&kept.text.nodes&&kept.text.nodes.A5;
    const said=(byIdEl["toast"]._log||[]).join(" | ");
    console.log("save-through from the popover — stored:", !!ok,
                " reported:", JSON.stringify((byIdEl["toast"]._txt||"").slice(0,48)));
    if(!ok) console.log("FAIL — Enter did not persist the edit");
    if(!/browser only/i.test(said)) console.log("FAIL — offline save was not reported as such");
  });

  // Escape must abandon, not commit
  nameT.fire("click",{});
  inp.value="nonsense";
  inp.fire("keydown",{key:"Escape"});
  if(a5.name!=="Hold at 28.5 C") console.log("FAIL — Escape committed the edit anyway");
  console.log("escape abandons:", a5.name==="Hold at 28.5 C");

  // ---- Save is two steps: show, then confirm ----
  save.fire("click",{});
  const shown=read._html||"";
  console.log("save panel offers confirm:", shown.includes("Confirm and set as default"),
              " lists both tables:", shown.includes("const OFFSETS")&&shown.includes("const TEXT"));
  if(!shown.includes("Confirm and set as default")) console.log("FAIL — Save committed with no confirm step");

  byIdEl["svGo"].fire("click",{});
  // the harness has no network, so the shared write must fail LOUDLY and the
  // local copy must still be intact
  setTimeout(()=>{
    const kept=JSON.parse(store.getItem("pipeline.edits")||"{}");
    const t=kept.text||{};
    console.log("after confirm — local copy:",
      Object.keys(kept.offsets||{}).length,"moved,",
      Object.keys(t.nodes||{}).length,"nodes reworded,",
      Object.keys(t.bands||{}).length,"bands reworded");
    if(!t.bands || t.bands[0]!=="THE WET LAB") console.log("FAIL — the band rename was not saved");
    if(!t.nodes || !t.nodes.A5 || t.nodes.A5.name!=="Hold at 28.5 C")
      console.log("FAIL — the node rename was not saved");
    const msg=(byIdEl["toast"]._log||[]).join(" | ");
    console.log("offline confirm says:", JSON.stringify((byIdEl["toast"]._txt||"").slice(0,64)));
    if(!/browser only/i.test(msg)) console.log("FAIL — an unreachable back end was reported as success");
    console.log("save round-trip ok");
  },0);

  // panning must still work now that it is tracked on the window rather than
  // held by pointer capture
  const vx=vm.runInContext("view.x",sandbox);
  svgEl.fire("pointerdown",{pointerId:21,clientX:400,clientY:300});
  sandbox.window.fire("pointermove",{pointerId:21,clientX:470,clientY:330});
  const panned=vm.runInContext("view.x",sandbox)-vx;
  sandbox.window.fire("pointerup",{pointerId:21});
  console.log(`pan: 70px right moved the world ${panned.toFixed(0)}px; released:`,
              !vm.runInContext("drag",sandbox));
  if(Math.abs(panned-70)>1) console.log("FAIL — panning broke without pointer capture");
  if(vm.runInContext("drag",sandbox)) console.log("FAIL — the pan did not end on pointerup");

  console.log("edit mode round-trip ok");
})();
