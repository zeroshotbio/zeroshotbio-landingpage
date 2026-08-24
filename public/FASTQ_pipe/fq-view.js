/* ============================================================
   fq-view.js — assembly and interaction.
   Grid, ruler, bands, plinths, labels, edges, dots, camera, reader, index.

   This is /pipeline's view, and nothing about how a step draws, labels,
   highlights or reads has been changed. It has to be: this page IS row 3 of
   that map, so a step has to behave the same way in both places or the two
   stop being one account of one pipeline.

   Edit positions is here, and it has its own record — /api/fqpipe_edits,
   ITEM_ID "FASTQ_pipe::edits". Never /pipeline's. One record between
   two maps means whichever saved last erases the other, silently, with no way
   to tell which happened. Edit text and Edit visual are NOT here, and inherit
   that same constraint if they ever are.
   ============================================================ */

/* Fail loudly and usefully if the scripts loaded out of order or one 404'd. */
(function requires(){
  const need={ "fq-iso.js":["P","paint","installDefs","layoutRows","roofFrame","TICKERS"],
               "fq-shapes.js":["DRAW","SKIN","topOf"],
               "fq-data.js":["NODES","EDGES","LANES","BANDS","CARRIES","SNIPPETS","OVERVIEW"] };
  const missing=[];
  for(const file in need)
    for(const sym of need[file])
      if(typeof window[sym]==="undefined" && typeof eval(`typeof ${sym}`)==="undefined")
        missing.push(`${sym} (from ${file})`);
  if(missing.length){
    const msg="FASTQ_pipe: scripts missing or out of order — "+missing.join(", ");
    document.body.innerHTML=`<pre style="padding:20px;font:13px ui-monospace">${msg}
Expected load order:
  fq-iso.js
  fq-shapes.js
  fq-data.js
  fq-view.js
Check the script paths resolve (a route without a trailing slash will 404 them).</pre>`;
    throw new Error(msg);
  }
})();

/* Phones get a different shape: no side panels, the map takes almost the
   whole canvas, the index becomes a strip along the bottom, and the reader
   rises as a sheet only when something is selected. Layout is CSS; this flag
   is only for the behaviour CSS cannot express. */
const TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
const PHONE = () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches;

const svg=document.getElementById("svg");
const byId={}; NODES.forEach(n=>byId[n.id]=n);
layoutRows(NODES, LANES, MIRROR);

/* ============================================================
   OFFSETS
   Fine positioning on top of whatever the lane engine computed. Everything in
   the table is a NUDGE — dx/dy for the object, ldx/ldy for its name — never
   an absolute coordinate, so re-solving the lane or inserting a step carries
   them along instead of fighting them.

   Two sources, and the local one wins while it is being tuned: the committed
   table in fq-data.js, and whatever this browser is holding from the page's
   own Edit positions mode. Once a sitting has been baked back into the file
   the two are identical and clearing the local copy changes nothing.
   ============================================================ */
/* THE STORED RECORD IS `{offsets, at}`, NOT A BARE TABLE, and the `at` is the
   whole of how this page decides who is ahead.

   This is /pipeline's scheme, ported here because it is the one that has been
   in daily use and demonstrably keeps a sitting. Every drag stamps the local
   record with the time; a successful save replaces that stamp with the SERVER'S
   own, so the next load cannot read its own save as somebody else's. On load
   the shared copy wins only if it is STRICTLY NEWER. Anything else is this
   browser holding work the record has not seen, and it is left alone.

   Two attempts before this one got it wrong in opposite directions. The first
   applied the shared copy on any difference, which threw away every drag that
   had not been published yet. The second compared JSON strings against a
   remembered copy, which is a two-way comparison dressed up as a three-way one
   and had a fall-through that adopted when the marker was missing — which is
   every browser that had edits before it shipped. A timestamp is one number
   and it is monotonic. */
const EDIT_KEY="fqpipe.offsets";
const remember=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(err){} };
const forget  =k=>{ try{ localStorage.removeItem(k); }catch(err){} };

const BAKED=(typeof OFFSETS!=="undefined")?OFFSETS:{};
const EDITS=(()=>{
  try{
    const raw=localStorage.getItem(EDIT_KEY);
    if(raw){
      const j=JSON.parse(raw);
      /* the format before the stamp: a bare table of nudges. It is adopted
         with at:0, so the first shared copy that turns up supersedes it —
         which is right, because that copy is this browser's own last save. */
      if(j && j.offsets) return {offsets:j.offsets||{}, at:j.at||0};
      return {offsets:j||{}, at:0};
    }
  }catch(err){}
  return {offsets:BAKED, at:0};
})();
const LIVE=EDITS.offsets||{};
/* DELETIONS come first, because everything downstream — the lane solve, the
   edges, the index, the occlusion clip — has to be computed over what is
   actually on the map rather than over what once was. A node removed here
   never existed as far as the rest of this file is concerned. */
const GONE=new Set(Object.keys(LIVE).filter(k=>LIVE[k] && LIVE[k].del));
if(GONE.size){
  for(let i=NODES.length-1;i>=0;i--) if(GONE.has(NODES[i].id)) NODES.splice(i,1);
  for(let i=EDGES.length-1;i>=0;i--) if(GONE.has(EDGES[i].a)||GONE.has(EDGES[i].b)) EDGES.splice(i,1);
  Object.keys(byId).forEach(k=>{ if(GONE.has(k)) delete byId[k]; });
}

/* WHERE THE LANE ENGINE PUT EVERYTHING, before any nudge. Every offset in
   the table is measured from here.

   The first version measured "what the committed table said, plus how far it
   has been dragged since the page loaded", which is two quantities to keep in
   step and one of them is invisible. It also meant the derived position of the
   attrition band — computed after that baseline was taken — read as a nudge of
   twelve units that got written into every save. One base, taken once, in one
   place. */
NODES.forEach(n=>{ n._ox=n.x; n._oy=n.y; n._lx=0; n._ly=0; });

function applyNudge(n,o){
  o=o||{};
  n.x=n._ox+(o.dx||0); n.y=n._oy+(o.dy||0);
  n._lx=o.ldx||0; n._ly=o.ldy||0;
}
NODES.filter(n=>!n.scenery).forEach(n=>applyNudge(n,LIVE[n.id]));

/* NO SCENERY ON THIS PAGE.

   /bioinformatics_pipe carries one piece — the attrition band, painted flat on
   the ground behind its row — and resolving it took a whole function, because
   a thing whose span is derived from the buildings it covers must take its
   BASE from where the lane put them (`_ox`) rather than from where they ended
   up (`x`), or its own saved nudge compounds every time the table is applied.
   Nothing here is drawn that way: every object on this page is drawn at its
   own coordinate, so a saved dx is in the picture the moment the page loads.

   If ground scenery is ever added here, lift that function from the other
   map rather than re-deriving it — the bug it exists for looks exactly like a
   save that did not take, and it was reported twice before it was found. */

/* and where each object was actually DRAWN, which is what a translate is
   measured against */
NODES.forEach(n=>{ n._px=n.x; n._py=n.y; });

const labelEls={}, plinthEls={};
const defs=installDefs(svg);

/* ============================================================
   RENDER
   ============================================================ */
const world=el("g"); svg.appendChild(world);
const gGrid=el("g"),gAxis=el("g"),gBand=el("g"),gPlinth=el("g"),gEdge=el("g"),
      gDot=el("g"),gNode=el("g"),gLabel=el("g");
/* paint order is the z order. The tracks and the dots on them sit behind the
   solid world absolutely: anything they pass under occludes them. */
[gGrid,gAxis,gBand,gPlinth,gEdge,gDot,gNode,gLabel].forEach(g=>world.appendChild(g));

/* the extent of the ground plane, and of the ruler drawn around it */
const GRID={x0:-5,x1:37,y0:-15,y1:10};

(()=>{const {x0,x1,y0,y1}=GRID;
  for(let x=Math.ceil(x0);x<=x1;x++){const a=P(x,y0,0),b=P(x,y1,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
  for(let y=Math.ceil(y0);y<=y1;y++){const a=P(x0,y,0),b=P(x1,y,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
})();

/* ============================================================
   COORDINATE RULER
   Numbers along the two outer edges that meet at the top corner, so any
   position can be named. These are the SAME x and y that NODES and LANES are
   authored in — read a number off the edge and it is the value to put in the
   file. Ticks every unit, numbers every two.
   ============================================================ */
(function ruler(){
  const T=0.34, LBL=1.0;
  const tick=(a,b,op)=>gAxis.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
    stroke:"var(--fg)","stroke-opacity":op,"stroke-width":"1"}));
  const num=(p,txt,rot,big)=>{
    const g=el("g",{transform:`translate(${p[0]},${p[1]}) rotate(${rot})`});
    const t=el("text",{x:0,y:3,"text-anchor":"middle","font-size":big?"10":"8",
      "letter-spacing":big?"1.5":".4",fill:"var(--fg)","fill-opacity":big?".5":".38"});
    t.textContent=txt; g.appendChild(t); gAxis.appendChild(g);
  };
  tick(P(GRID.x0,GRID.y0,0), P(GRID.x1,GRID.y0,0), ".2");
  tick(P(GRID.x0,GRID.y0,0), P(GRID.x0,GRID.y1,0), ".2");
  for(let x=Math.ceil(GRID.x0);x<=GRID.x1;x++){
    const on=x%2===0;
    tick(P(x,GRID.y0,0), P(x,GRID.y0-(on?T:T*0.5),0), on?".28":".16");
    if(on) num(P(x,GRID.y0-LBL,0), String(x), 30);
  }
  for(let y=Math.ceil(GRID.y0);y<=GRID.y1;y++){
    const on=y%2===0;
    tick(P(GRID.x0,y,0), P(GRID.x0-(on?T:T*0.5),y,0), on?".28":".16");
    if(on) num(P(GRID.x0-LBL,y,0), String(y), -30);
  }
  num(P(GRID.x1+1.5,GRID.y0-LBL,0), "X", 30, true);
  num(P(GRID.x0-LBL,GRID.y1+1.5,0), "Y", -30, true);
})();

/* Row bands — the name runs along the band's bottom-right edge.

   THE NAME IS A MOVER. It belongs to no building, so nothing in the nudge
   table reached it and it was the one piece of type on the map that could not
   be got out of the way of anything. It is placed from world coordinates like
   everything else, so it takes the same world-unit nudge a building's name
   takes, under its own key. */
const MOVERS=[];
BANDS.forEach((b,i)=>{
  const c=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];
  gBand.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":".025",stroke:"var(--fg)","stroke-opacity":".22",
    "stroke-width":"1","stroke-dasharray":"14 9"}));
  const bx=b.x1, by=(b.y0+b.y1)/2;
  const g=gLabel.appendChild(el("g"));
  const t=el("text",{x:0,y:17,"text-anchor":"middle","font-size":"16","letter-spacing":"4",
    fill:"var(--fg3)"});
  t.textContent=b.name.toUpperCase(); g.appendChild(t);
  const m={key:"band:"+i, name:b.name, g, lx:0, ly:0, hide:false,
    reflow(){
      const [px,py]=P(bx+m.lx, by+m.ly, 0);
      g.setAttribute("transform",`translate(${px},${py}) rotate(-30)`);
    }};
  m.reflow();
  MOVERS.push(m);
});
function applyMover(m,o){
  o=o||{};
  m.lx=o.ldx||0; m.ly=o.ldy||0;
  if(o.del && !m.hide){ m.hide=true; m.g.setAttribute("display","none"); }
  if(!o.del && m.hide){ m.hide=false; m.g.removeAttribute("display"); }
  m.reflow();
}
MOVERS.forEach(m=>applyMover(m,LIVE[m.key]));

/* plinths under the two landmarks; their names run along the bottom-left edge */
NODES.filter(n=>n.anchor).forEach(n=>{
  const pad=0.55, hw=n.w/2+pad, hd=n.d/2+pad;
  const c=[[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],[n.x+hw,n.y+hd],[n.x-hw,n.y+hd]];
  plinthEls[n.id]=gPlinth.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":".05",stroke:"var(--fg)",
    "stroke-opacity":".4","stroke-width":"1","stroke-dasharray":"6 4"}));
  const lo=n.lab||{}, ex=n.x+(lo.dx||0);
  const [px,py]=P(ex, n.y-n.d/2+(lo.dy||0), topOf(n));
  const g=el("g",{transform:`translate(${px},${py}) rotate(-30)`});
  const t=el("text",{x:14,y:-3,"text-anchor":"start","font-size":"20","letter-spacing":"2.5",
    fill:"var(--fg)"});
  t.textContent=n.name.toUpperCase(); g.appendChild(t);
  const t2=el("text",{x:14,y:12,"text-anchor":"start","font-size":"11","letter-spacing":".8",
    fill:"var(--fg2)"});
  t2.textContent=n.stat||""; g.appendChild(t2);
  gLabel.appendChild(g); labelEls[n.id]=g;
});

/* every other object emits its name from its top-right corner, running up and
   to the right at −30°: parallel to the band titles, perpendicular to the
   flow of the dots. A side structure sitting below its row emits down-left
   instead, so its name never lands on the row it hangs from. */
NODES.filter(n=>!n.anchor).forEach(n=>{
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;
  const lo=n.lab||{}, ex=n.x+(lo.dx||0);
  const [bx,by] = below ? P(ex, n.y+n.d/2+(lo.dy||0), n.h) : P(ex, n.y-n.d/2+(lo.dy||0), n.h);
  const g=el("g",{transform:`translate(${bx},${by}) rotate(-30)`});
  const t=el("text",{x:below?-9:9,y:-1,"text-anchor":below?"end":"start","font-size":"8.6",
    "letter-spacing":".35",fill:"var(--fg2)"});
  t.textContent=n.key+" · "+n.name; g.appendChild(t);
  /* ONE node on this page carries a modelled figure and the rest do not, so
     the word rides under its name on the map as well as on its roof and in
     the reader. A modelled figure that has lost the word is a figure claiming
     a result nobody has produced. */
  if(n.modelled){
    const t2=el("text",{x:below?-9:9,y:10,"text-anchor":below?"end":"start","font-size":"8",
      "letter-spacing":"1",fill:"var(--accent)"});
    t2.textContent="MODELLED"; g.appendChild(t2);
  }
  gLabel.appendChild(g); labelEls[n.id]=g;
});

/* A label group carries its own translate+rotate; the base is kept so a nudge
   can be composed in front of it rather than replacing it. */
Object.keys(labelEls).forEach(id=>{
  labelEls[id].dataset.base=labelEls[id].getAttribute("transform")||""; });


/* ============================================================
   EDGES
   ============================================================ */
const edgeGeom=[];
function makeGeom(pp){
  let len=0; const segs=[];
  for(let k=1;k<pp.length;k++){
    const ddx=pp[k][0]-pp[k-1][0],ddy=pp[k][1]-pp[k-1][1],l=Math.hypot(ddx,ddy);
    segs.push({from:pp[k-1],dx:ddx,dy:ddy,l,at:len}); len+=l;}
  return {segs,len};
}
function routeOf(e){
  const A=byId[e.a],B=byId[e.b], mx=(A.x+B.x)/2;
  const raw = (e.straight || Math.abs(A.y-B.y)<0.05)
    ? [[A.x,A.y],[B.x,B.y]]
    : [[A.x,A.y],[mx,A.y],[mx,B.y],[B.x,B.y]];
  return raw.map(p=>P(p[0],p[1],0.02));
}
/* One <g> per edge so a route can be redrawn on its own when the editor moves
   a node — the number of elbows changes when two objects come level, so the
   run is rebuilt rather than patched. */
function paintEdge(rec){
  const host=rec.host;
  [...(host.children||[])].forEach(c=>host.removeChild(c));
  const pp=routeOf(rec);
  const faint = rec.kind==="drop";
  const path=el("path",{d:"M "+pp.map(p=>p.join(" ")).join(" L "),fill:"none",stroke:"var(--edge)",
    "stroke-width":faint?"1":"1.3","stroke-opacity":faint?".35":".7"});
  if(rec.dash) path.setAttribute("stroke-dasharray","5 4");
  host.appendChild(path);
  pp.slice(1,-1).forEach(c=>host.appendChild(el("rect",
    {x:c[0]-2.4,y:c[1]-2.4,width:4.8,height:4.8,transform:`rotate(45 ${c[0]} ${c[1]})`,
     fill:"var(--edge)","fill-opacity":".5"})));
  const g=makeGeom(pp); rec.segs=g.segs; rec.len=g.len;
}
EDGES.forEach(e=>{
  const rec={...e,host:gEdge.appendChild(el("g")),
             fromName:byId[e.a].name,toName:byId[e.b].name};
  paintEdge(rec);
  edgeGeom.push(rec);
});

/* carries — fade to and from nothing.

   Each one runs along the row from the edge of the building it serves, so it
   is re-derived from that building rather than drawn once: dragging the
   matrix carries its own track with it. The gradient is in user space, so it
   has to be moved too — a path that moves under a fixed gradient fades in the
   wrong place, which looks like a rendering bug and is in fact a stale
   coordinate. */
const CARRY=[];
CARRIES.forEach((c,i)=>{
  const gid=`fade${i}`;
  const lg=defs.appendChild(el("linearGradient",{id:gid,gradientUnits:"userSpaceOnUse"}));
  const o1=c.fade==="out"?".7":"0", o2=c.fade==="out"?"0":".7";
  lg.appendChild(el("stop",{offset:"0","stop-color":"var(--edge)","stop-opacity":o1}));
  lg.appendChild(el("stop",{offset:"1","stop-color":"var(--edge)","stop-opacity":o2}));
  const path=gEdge.appendChild(el("path",{fill:"none",stroke:`url(#${gid})`,"stroke-width":"1.3"}));
  const rec={kind:c.kind,carry:c.fade,fromName:c.from,toName:c.to};
  edgeGeom.push(rec);
  const place=()=>{
    const n=byId[c.node];
    if(!n || n.gone){ path.setAttribute("display","none"); return; }
    path.removeAttribute("display");
    /* the near end sits off the building's own face; the far end runs on out
       of the map, along the row */
    const edge=n.x+(c.side==="out"?+1:-1)*(n.w/2+c.gap);
    const away=edge+(c.side==="out"?+1:-1)*c.len;
    const near=P(edge,n.y,0.02), far=P(away,n.y,0.02);
    /* a carry always FADES OUTWARD, so the solid end is the one at the
       building whichever side it is on */
    const a=c.fade==="out"?near:far, b=c.fade==="out"?far:near;
    lg.setAttribute("x1",a[0]); lg.setAttribute("y1",a[1]);
    lg.setAttribute("x2",b[0]); lg.setAttribute("y2",b[1]);
    path.setAttribute("d",`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`);
    Object.assign(rec,makeGeom([a,b]));
  };
  place();
  CARRY.push({node:c.node,place});
});

/* ============================================================
   NODES
   ============================================================ */
const nodeEls={};
NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(n=>{
  const g=el("g",{tabindex:"0",role:"button","aria-label":n.name});
  g.style.cursor="pointer";
  DRAW[n.shape](g,n);
  if(!TOUCH){
    g.addEventListener("mouseenter",()=>{ if(!editing) show(n.id,false); });
    g.addEventListener("mouseleave",()=>{ if(!editing) unhover(); });
  }
  g.addEventListener("focus",()=>{ if(!editing) show(n.id,false); });
  g.addEventListener("blur",()=>{ if(!editing) unhover(); });
  g.addEventListener("click",ev=>{ev.stopPropagation(); if(!editing) show(n.id,true);});
  gNode.appendChild(g); nodeEls[n.id]=g;
});

/* AND NOW PUT THE SAVED NAME NUDGES INTO THE PICTURE.

   A building is DRAWN at n.x, so its saved dx is on screen the instant the
   page loads. Its NAME is not: the label is drawn from n.x and n.lab, and
   ldx/ldy reach it only through reposition() — which, on the load path, used
   to be reached only via applyOffsets(), and applyOffsets() left the load path
   when adopting a shared copy became a reload. Nothing called it any more.

   So every name offset saved perfectly, read back perfectly, and drew in the
   old place. Move a name, save, reload, and it is back — while the building
   next to it, which is drawn at its own coordinate, stays put. That is exactly
   the shape of "some of them stick and some of them do not", and no amount of
   looking at the record would have shown it, because the record was right.

   One line, and it also makes the two paths agree: a load now ends in the same
   state a drag leaves the map in. It has to run down here rather than beside
   the labels, because reposition() touches the node and plinth groups too and
   those do not exist until this loop has run. */
NODES.forEach(n=>reposition(n));

/* Committed nudges for the floating annotations. They are keyed
   "<node>:<which>" and live in the same OFFSETS table as the buildings,
   because they are the same kind of thing: a hand-placed position that has
   to survive the row being re-spaced. Applied here rather than in the shape
   because the shape has already drawn by now. */
if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
  const o=LIVE[a.key];
  if(o && o.del){ a.hide=true; [a.line,a.dot,a.t1,a.box,a.hit]
    .forEach(e=>e.setAttribute("display","none")); return; }
  if(o){ a.off.dx=o.adx||0; a.off.dy=o.ady||0; a.reflow(); }
});

/* ============================================================
   OCCLUSION
   A track and the dot on it must vanish wherever a building stands. One clip
   path — a huge rectangle with every silhouette punched out of it by the
   even-odd rule — applied to the edge and dot layers only. Grid and bands are
   untouched, so they still show through translucent artwork.
   ============================================================ */
const nodeSil=n=>{
  const hw=n.w/2, hd=n.d/2, h=topOf(n);
  return [P(n.x-hw,n.y-hd,h), P(n.x+hw,n.y-hd,h), P(n.x+hw,n.y+hd,h),
          P(n.x+hw,n.y+hd,0), P(n.x-hw,n.y+hd,0), P(n.x-hw,n.y-hd,0)];
};
const clipPathEl=el("path",{"clip-rule":"evenodd"});
function rebuildClip(){
  const R=40000;
  let d=`M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`;
  /* scenery is painted ON the ground, so punching it out of the clip would
     cut a hole in the very layer it belongs to */
  NODES.filter(n=>!n.scenery).forEach(n=>{
    d+=" M "+nodeSil(n).map(p=>p.join(" ")).join(" L ")+" Z"; });
  clipPathEl.setAttribute("d",d);
}
(function occlude(){
  rebuildClip();
  const cp=el("clipPath",{id:"nodeclip",clipPathUnits:"userSpaceOnUse"});
  cp.appendChild(clipPathEl);
  defs.appendChild(cp);
  gEdge.setAttribute("clip-path","url(#nodeclip)");
  gDot .setAttribute("clip-path","url(#nodeclip)");
})();

/* ============================================================
   MOVING THINGS AFTER THEY ARE DRAWN
   The projection is affine, so a world delta is a translate on the group the
   object was drawn into — nothing is re-rendered and no ticker is disturbed.
   These live out here rather than inside the editor because the shared copy
   has to be able to apply a whole table at load, without a reload.
   ============================================================ */
/* A world delta as an SVG translate. A function declaration rather than a
   const arrow so it is hoisted: the load path repositions everything the
   moment the node groups exist, which is above this line. */
function shift(dx,dy){
  return `translate(${((dx-dy)*S*C30).toFixed(2)},${((dx+dy)*S*0.5).toFixed(2)})`;
}
function reposition(n){
  const dx=n.x-n._px, dy=n.y-n._py;
  const t=(dx||dy)?shift(dx,dy):"";
  if(nodeEls[n.id]) nodeEls[n.id].setAttribute("transform",t);
  if(plinthEls[n.id]) plinthEls[n.id].setAttribute("transform",t);
  const L=labelEls[n.id];
  if(L) L.setAttribute("transform",
    (dx||dy||n._lx||n._ly) ? shift(dx+n._lx, dy+n._ly)+" "+(L.dataset.base||"") : (L.dataset.base||""));
}
function refresh(id){
  rebuildClip();
  edgeGeom.forEach(rec=>{ if(rec.host && (!id || rec.a===id || rec.b===id)) paintEdge(rec); });
  /* a carry has no host, but it is anchored to a building, so it moves when
     that building does */
  CARRY.forEach(c=>{ if(!id || c.node===id) c.place(); });
  placeDots(0);
}
/* Apply a whole table of nudges to a map that has already been drawn.

   NOTHING ON THE LOAD PATH CALLS THIS ANY MORE, and that is deliberate: it
   re-runs only a SUBSET of what a load does. It moves the objects and repaints
   the edges; it does not re-derive the attrition band's span, re-solve the
   lane, rebuild the index or recompute the occlusion clip. Using it to adopt a
   shared copy produced a picture no reload reproduced, which from the outside
   is indistinguishable from a layout that did not take. The shared copy
   reloads now. This is kept because it is exactly what a test needs to assert
   that applying a table twice lands where applying it once does — the property
   the _ox base exists to guarantee. */
function applyOffsets(o){
  NODES.forEach(n=>{ applyNudge(n,o[n.id]); reposition(n); });
  if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
    const w=o[a.key]||{}; a.off.dx=w.adx||0; a.off.dy=w.ady||0; a.reflow(); });
  MOVERS.forEach(m=>applyMover(m,o[m.key]));
  NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(m=>gNode.appendChild(nodeEls[m.id]));
  refresh(null);
}

/* ============================================================
   DOTS
   ============================================================ */
const DOTS=[];
edgeGeom.forEach(e=>{
  const faint = e.kind==="drop"||e.kind==="soup";
  const count = (faint||e.carry)?1:2;
  for(let i=0;i<count;i++){
    const g=el("g"); g.style.cursor="pointer";
    g.appendChild(el("circle",{r:"10",fill:"transparent"}));
    g.appendChild(el("circle",{r:faint?3:3.5,fill:faint?"var(--drop)":"var(--signal)",
      stroke:"var(--stroke)","stroke-width":"1"}));
    gDot.appendChild(g);
    const rec={e,t:(i/count)+Math.random()*0.1,speed:(faint?26:52)/e.len,node:g};
    g.addEventListener("click",ev=>{ev.stopPropagation();inspect(rec);});
    DOTS.push(rec);
  }
});
function placeDots(dt){
  DOTS.forEach(r=>{
    if(dt) r.t=(r.t+r.speed*dt)%1;
    const want=r.t*r.e.len; let s=r.e.segs[r.e.segs.length-1];
    for(const seg of r.e.segs){ if(want<=seg.at+seg.l){s=seg;break;} }
    const f=s.l?(want-s.at)/s.l:0;
    r.node.setAttribute("transform",`translate(${s.from[0]+s.dx*f},${s.from[1]+s.dy*f})`);
    if(r.e.carry) r.node.setAttribute("opacity", r.e.carry==="out" ? (1-r.t).toFixed(2) : r.t.toFixed(2));
  });
}

/* ============================================================
   MOTION
   The system preference is the DEFAULT, not the verdict. It is re-read
   whenever it changes, a person can override it either way, and the override
   is remembered — a laptop entering battery saver flips it mid-session on
   several browsers, and a map that silently stops moving is indistinguishable
   from a broken one.
   ============================================================ */
const MOTION_KEY="fqpipe.motion";
const mqReduce=(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)"))||{matches:false};
let motionChoice=null; try{ motionChoice=localStorage.getItem(MOTION_KEY); }catch(err){}
let onMotion=null;
let playing = motionChoice ? motionChoice==="on" : !mqReduce.matches;
function setMotion(on,remember){
  playing=!!on;
  if(remember){ motionChoice=on?"on":"off";
    try{ localStorage.setItem(MOTION_KEY,motionChoice); }catch(err){} }
  if(onMotion) onMotion();
}
if(mqReduce.addEventListener)
  mqReduce.addEventListener("change",()=>{ if(!motionChoice) setMotion(!mqReduce.matches,false); });
else if(mqReduce.addListener)
  mqReduce.addListener(()=>{ if(!motionChoice) setMotion(!mqReduce.matches,false); });

let last=performance.now();
const MOTION_MIN=0.10;
/* A ticker that throws is dropped rather than allowed to take the frame with
   it. One roof going wrong should cost that roof, not the whole map. */
const DROPPED=[];
function runTickers(dt,now){
  for(let i=0;i<TICKERS.length;i++){
    try{ TICKERS[i](dt,now,1); }
    catch(err){
      console.error("FASTQ_pipe: a roof's animation threw and was dropped — the map keeps running.",err);
      DROPPED.push({i,err:String((err&&err.message)||err)});
      TICKERS.splice(i,1); i--;
    }
  }
}
let frames=0,lastErr=null;
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now; frames++;
  /* NOTHING in here may stop the loop being scheduled again. */
  try{
    stepCamera(now);
    placeDots(playing?dt:0);
    /* the ✕ rides the camera, so it stays on its object through a pan or a
       zoom rather than sliding off it */
    if(editing && window.placeDeleteX) window.placeDeleteX();
    if(playing && view.k>=MOTION_MIN) runTickers(dt,now);
  }catch(err){
    if(!lastErr) console.error("FASTQ_pipe: a frame threw — the loop keeps running.",err);
    lastErr=err;
  }
  requestAnimationFrame(frame);
}
/* one line to paste back when the map looks stuck */
window.fqpipeDiag=()=>({
  moving: playing && view.k>=MOTION_MIN,
  playing, choice:motionChoice||"(system)", systemAsksForReduce:!!mqReduce.matches,
  zoom:+(view.k||0).toFixed(3), frames, dots:DOTS.length,
  tickers:TICKERS.length, droppedTickers:DROPPED.length,
  lastError:lastErr?String(lastErr.message||lastErr):null
});

/* ============================================================
   PAN AND ZOOM
   ============================================================ */
let view={k:1,x:0,y:0}, anim=null;
const applyView=()=>world.setAttribute("transform",`translate(${view.x},${view.y}) scale(${view.k})`);
const centre=()=>{const r=svg.getBoundingClientRect();return [r.width/2,r.height/2];};

/* Fit the DRAWING, not the sheet. world.getBBox() includes the ground grid
   and the coordinate ruler, both of which deliberately run wider than the
   map — so fitting to it parked the whole sequence in the middle third of
   the canvas at roughly half the zoom it deserved. The bands, the buildings
   and their names are the map; everything else is graph paper. */
function contentBox(){
  const bs=[gBand,gNode,gLabel].map(g=>g.getBBox()).filter(b=>b.width||b.height);
  if(!bs.length) return world.getBBox();
  const x0=Math.min(...bs.map(b=>b.x)),      y0=Math.min(...bs.map(b=>b.y));
  const x1=Math.max(...bs.map(b=>b.x+b.width)), y1=Math.max(...bs.map(b=>b.y+b.height));
  return {x:x0,y:y0,width:x1-x0,height:y1-y0};
}
function fitTarget(){
  const bb=contentBox(), r=svg.getBoundingClientRect();
  return {fx:bb.x+bb.width/2, fy:bb.y+bb.height/2,
          k:Math.min((r.width-40)/bb.width,(r.height-52)/bb.height,1.4)};
}
function setFocus(t){
  const [cx,cy]=centre();
  view.k=t.k; view.x=cx-t.fx*t.k; view.y=cy-t.fy*t.k; applyView();
}
function fit(){ anim=null; setFocus(fitTarget()); }
/* glide: interpolate the focus point linearly and the zoom geometrically,
   which keeps the apparent motion even through a big scale change */
function glideTo(target, ms=1200){
  const [cx,cy]=centre();
  anim={t0:performance.now(), ms,
        from:{fx:(cx-view.x)/view.k, fy:(cy-view.y)/view.k, k:view.k}, to:target};
}
function stepCamera(now){
  if(!anim) return;
  const p=Math.min(1,(now-anim.t0)/anim.ms);
  const e=p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  const f=anim.from, t=anim.to;
  setFocus({fx:f.fx+(t.fx-f.fx)*e, fy:f.fy+(t.fy-f.fy)*e, k:f.k*Math.pow(t.k/f.k,e)});
  if(p>=1) anim=null;
}
function focusNode(id){
  const n=byId[id]; if(!n) return;
  const r=svg.getBoundingClientRect();
  const [wx,wy]=P(n.x,n.y,(n.h||0.5)/2);
  const span=Math.max(70,(n.w+n.d)*S*C30);
  /* stop well short of filling the frame — a building should arrive with its
     neighbours still in view, so the sequence stays legible */
  const k=Math.max(0.5,Math.min(1.4, Math.min(r.width,r.height)*0.46/span));
  glideTo({fx:wx, fy:wy, k});
}

/* One pointer pans, two pinch. The pan deliberately does NOT take pointer
   capture: capturing on the <svg> root routes the click that ends the gesture
   to the root as well, so every listener on an SVG child silently never
   fires. `moved` exists so the click at the end of a pan does not read as a
   click on empty canvas and throw away the selection. */
let drag=null, pinch=null, moved=0;
const pointers=new Map();
const localMid=()=>{
  const [a,b]=[...pointers.values()], r=svg.getBoundingClientRect();
  return {d:Math.hypot(a.x-b.x,a.y-b.y), mx:(a.x+b.x)/2-r.left, my:(a.y+b.y)/2-r.top};
};
const startPinch=()=>{ const m=localMid();
  pinch={...m,k:view.k,x:view.x,y:view.y}; drag=null; svg.classList.remove("drag"); };
const startDrag=()=>{ const [p]=[...pointers.values()];
  drag={x:p.x,y:p.y,vx:view.x,vy:view.y}; svg.classList.add("drag"); };

svg.addEventListener("pointerdown",e=>{
  anim=null; moved=0;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2) startPinch(); else startDrag();
});
window.addEventListener("pointermove",e=>{
  if(!pointers.has(e.pointerId)) return;
  const was=pointers.get(e.pointerId);
  moved+=Math.hypot(e.clientX-was.x,e.clientY-was.y);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2 && pinch){
    const now=localMid();
    const nk=Math.max(.15,Math.min(5, pinch.k*(now.d/Math.max(1,pinch.d))));
    const wx=(pinch.mx-pinch.x)/pinch.k, wy=(pinch.my-pinch.y)/pinch.k;
    view.k=nk; view.x=now.mx-wx*nk; view.y=now.my-wy*nk; applyView();
  } else if(drag){
    view.x=drag.vx+(e.clientX-drag.x); view.y=drag.vy+(e.clientY-drag.y); applyView();
  }
});
["pointerup","pointercancel"].forEach(t=>window.addEventListener(t,e=>{
  if(!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if(pointers.size>=2) startPinch();
  else if(pointers.size===1) startDrag();
  else { drag=null; pinch=null; svg.classList.remove("drag"); }
}));
svg.addEventListener("wheel",e=>{
  e.preventDefault(); anim=null;
  const r=svg.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const nk=Math.max(.15,Math.min(5,view.k*Math.exp(-e.deltaY*.0016)));
  view.x=mx-(mx-view.x)*(nk/view.k);view.y=my-(my-view.y)*(nk/view.k);view.k=nk;applyView();
},{passive:false});

/* ============================================================
   READER
   ============================================================ */
const read=document.getElementById("read");
/* THE READER OPENS ITSELF WHEN YOU PICK SOMETHING, IF IT WAS TUCKED AWAY.

   Both side columns fold shut, and a folded reader is the natural way to read
   the map — the drawing gets the whole window. But then clicking a building
   filled a panel nobody could see, and the map answered a question silently
   into a closed drawer. So a selection reveals the reader, and clearing the
   selection folds it back.

   ONLY IF WE WERE THE ONES WHO OPENED IT. If the reader was already open, a
   click on empty space must not shut it — that would take away a column the
   reader deliberately left up. The `feature` below tracks that; these two are
   the handles it fills in, and they are no-ops until it does, so a page that
   ships without the side columns still works. */
let revealReader=()=>{}, restoreReader=()=>{};

let pinned=null, current=null;
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

function renderOverview(){
  const o=OVERVIEW;
  read.innerHTML=`<div class="eyebrow">${o.eyebrow}</div>`+
    `<div class="title big">${o.title}</div>`+
    `<div class="sub">${o.sub}</div>`+
    `<h4>What this is</h4>${o.does}`+
    `<h4>How the numbers are made</h4>${o.built}`+
    `<h4>Real and modelled</h4>${o.cond}`;
}

function renderNode(id){
  const n=byId[id];
  const feeds=EDGES.filter(e=>e.a===id).map(e=>byId[e.b].name).join(", ")||"—";
  const fedBy=EDGES.filter(e=>e.b===id).map(e=>byId[e.a].name).join(", ")||"—";
  read.innerHTML=
    `<div class="eyebrow">${esc(n.group)}${n.tier?" · "+esc(n.tier)+" tier":""}</div>`+
    `<div class="title${n.anchor?" big":""}">${esc(n.name)}</div>`+
    `<div class="sub">${esc(n.sub)}</div>`+
    (n.modelled?`<div class="unver">figures on this roof are modelled</div>`:"")+
    /* three of the four culls are named differently here than on /pipeline,
       because this page draws ONE policy per roof and that map has to cover
       every policy the corpus uses for the stage. Carrying the original
       through means the two can still be matched up. */
    (n.pipelineName && n.pipelineName!==n.name
      ? `<p class="alias">On <a href="/pipeline">/pipeline</a> this node is `+
        `<mark>${esc(n.pipelineName)}</mark> — same stage, broader name.</p>` : "")+
    `<h4>What it does</h4><p>${n.does}</p>`+
    `<h4>How it is built</h4><p>${n.built}</p>`+
    `<h4>Condition</h4><p class="cond">${n.cond}</p>`+
    /* Everything above this line is lifted verbatim from /pipeline. Anything
       this page has to say for itself goes below it, under its own heading,
       so a reader can tell which map is talking. */
    (n.added?`<h4>Drawn here</h4><p class="added">${n.added}</p>`:"")+
    figuresOf(n)+
    (n.kv?`<h4>Record</h4>`+n.kv.map(([k,v])=>
      `<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`).join(""):"")+
    `<h4>On the map</h4>`+
    `<dl class="kv"><dt>Feeds</dt><dd>${esc(feeds)}</dd></dl>`+
    `<dl class="kv"><dt>Fed by</dt><dd>${esc(fedBy)}</dd></dl>`;
}

/* The numbers that used to float in a box on the diagram. They belong here:
   the map has no room for a paragraph, and the requirement the box existed to
   satisfy — a modelled figure carries the word wherever it is shown — is met
   by the badge above and by the word under the name on the map. */
function figuresOf(n){
  const mk = typeof FIGURES!=="undefined" && FIGURES[n.shape];
  if(!mk) return "";
  const f=mk();
  return `<h4>What the roof shows</h4>`+
    `<div class="figure">${esc(f.head)}</div>`+
    f.rows.map(([k,v])=>`<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`).join("")+
    (f.real?`<dl class="kv real"><dt>${esc(f.real[0])}</dt>`+
            `<dd>${esc(f.real[1])}</dd></dl>`:"");
}

function inspect(r){
  const mk=SNIPPETS[r.e.kind];
  if(!mk) return;
  const s=mk();
  pinned=null;current=null;paintIndex();
  read.innerHTML=`<div class="eyebrow">In transit</div><div class="title">${esc(s.label)}</div>`+
    `<div class="sub">${esc(r.e.fromName)} → ${esc(r.e.toName)}</div>`+
    `<h4>Payload</h4><div class="snip">${esc(s.text)}</div>`+
    (s.flag?`<h4>Flag</h4><p class="cond">${esc(s.flag)}</p>`:"")+
    `<h4>Note</h4><p>${esc(s.note)}</p>`;
}
function show(id,pin){
  if(pinned&&!pin&&pinned!==id) return;      // a pinned selection outranks a hover
  if(pin) pinned = pinned===id ? null : id;
  current = pinned || id;
  current?renderNode(current):renderOverview(); paintIndex();
  /* a hover is a preview and does not disturb the columns; only a click,
     which is the thing that means "tell me about this one" */
  if(pin){ if(pinned) revealReader(); else restoreReader(); }
}
/* Hovering is a preview and nothing more. Only a click pins, and only a click
   on empty space or on the pinned item releases it. */
function unhover(){ if(pinned) return; current=null; renderOverview(); paintIndex(); }
function release(){ pinned=null; current=null; renderOverview(); paintIndex(); restoreReader(); }
svg.addEventListener("mouseleave",unhover);

const aside=document.getElementById("aside");
(function buildIndex(){
  let html="",g=null;
  NODES.forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<div class="grp${n.groupMark?" mark":""}">${esc(g)}</div>`;}
    html+=`<button class="row${n.anchor?" anchor":""}" data-id="${n.id}"><span class="key">${esc(n.key)}</span>`+
          `<span class="nm">${esc(n.name)}</span><span class="n">${n.hatch?"drops":""}</span></button>`;
  });
  aside.innerHTML=html;
  aside.addEventListener("mouseleave",unhover);
  aside.querySelectorAll(".row").forEach(b=>{
    if(!TOUCH){
      b.addEventListener("mouseenter",()=>show(b.dataset.id,false));
      b.addEventListener("mouseleave",unhover);
    }
    b.addEventListener("click",()=>{
      show(b.dataset.id,true); focusNode(b.dataset.id);
      if(window.innerWidth<=900) aside.classList.remove("open");
    });
  });
})();

/* the strip: the same sequence as the left index, laid along the bottom */
const strip=document.getElementById("strip");
(function buildStrip(){
  let html="",g=null;
  NODES.forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<span class="sgrp">${esc(g)}</span>`;}
    html+=`<button class="chip${n.groupMark?" mark":""}" data-id="${n.id}">`+
          `<span class="k">${esc(n.key)}</span><span class="n">${esc(n.name)}</span></button>`;
  });
  strip.innerHTML=html;
  strip.querySelectorAll(".chip").forEach(b=>{
    b.addEventListener("click",()=>{ show(b.dataset.id,true); focusNode(b.dataset.id); });
  });
})();

const reader=document.getElementById("reader");
/* on a phone the reader is a sheet: up when something is selected, gone
   otherwise, so the map keeps the canvas */
function syncSheet(){
  const open = !!current && PHONE();
  reader.classList.toggle("open",open);
  strip.classList.toggle("mini",open);
}
document.getElementById("sheetClose").addEventListener("click",release);
window.addEventListener("resize",syncSheet);

function paintIndex(){
  aside.querySelectorAll(".row").forEach(b=>b.classList.toggle("on",b.dataset.id===current));
  strip.querySelectorAll(".chip").forEach(b=>b.classList.toggle("on",b.dataset.id===current));
  const chip=current && strip.querySelector(`.chip[data-id="${current}"]`);
  if(chip && chip.scrollIntoView) chip.scrollIntoView({block:"nearest",inline:"center"});
  syncSheet();
  /* Nothing ever dims. Every object stays at full opacity at all times, which
     is what keeps the tracks hidden behind them; the selected one is picked
     out by a halo instead of by everything else fading. */
  Object.entries(nodeEls).forEach(([id,g])=>{
    g.style.filter = (current===id)
      ? "drop-shadow(0 0 4px var(--signal)) drop-shadow(0 0 11px var(--signal)) brightness(1.08)"
      : "";
  });
}
renderOverview();

/* ============================================================
   CONTROLS
   ============================================================ */
const resetView=()=>{pinned=null;current=null;renderOverview();paintIndex();glideTo(fitTarget(),1100);};
document.getElementById("btnStages").onclick=()=>aside.classList.toggle("open");
/* the ruler is a working tool, not part of the picture — one click hides it */
let axes=!PHONE();
const btnAxes=document.getElementById("btnAxes");
const syncAxes=()=>{ gAxis.style.display=axes?"":"none";
                     btnAxes.textContent=axes?"Hide axes":"Show axes"; };
btnAxes.onclick=()=>{ axes=!axes; syncAxes(); }; syncAxes();

const btnMotion=document.getElementById("btnMotion");
onMotion=()=>{ btnMotion.textContent=playing?"Pause motion":"Play motion";
               btnMotion.setAttribute("aria-pressed",String(!playing)); };
btnMotion.onclick=()=>setMotion(!playing,true); onMotion();

document.getElementById("btnTheme").onclick=e=>{
  document.body.classList.toggle("light");
  e.target.textContent=document.body.classList.contains("light")?"Dark":"Light";
};
document.getElementById("btnHome").onclick=resetView;
svg.addEventListener("click",()=>{ if(moved<8 && !editing) release(); });

/* ============================================================
   START THE MAP
   Deliberately before every optional feature below. A browser holding a stale
   index.html against fresh scripts will not find an element one of them
   wants, and that single null would otherwise take the whole tail of the file
   with it — including this loop. The symptom is a map that draws, lists and
   highlights perfectly and then sits frozen.
   ============================================================ */
/* FIT TWICE, AND THE SECOND ONE IS THE ONE THAT COUNTS.

   The first fit runs before anything has moved. Several things on this map
   place themselves in their first frame rather than at build time — a floating
   annotation is re-placed from its shape every frame, a ticker's marks start
   at nothing and swell — so the content box measured at t=0 is not the content
   box a second later, and the map opened a few percent off the fit the button
   gives. Small, but it is the difference between "this is the view" and "this
   is nearly the view", and the button was the only way to get the first one.

   The second fit is deferred to the frame after the tickers have run once. It
   is skipped if the reader has already been touched, so it can never yank the
   camera out from under somebody who clicked straight into a station. */
placeDots(0); fit(); last=performance.now(); requestAnimationFrame(frame);
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!pinned && !current && !anim) fit();
}));

/* Each block below is a feature, not a dependency. One that cannot find what
   it needs says so and stands down; the map keeps working. */
function feature(name,fn){
  try{ fn(); }
  catch(err){ console.error(`FASTQ_pipe: "${name}" did not start — the map is fine, that feature is not.`,err); }
}

/* ============================================================
   THE SIDE COLUMNS
   Both are draggable shut. Drag the grip to resize, drag far enough and it
   snaps closed, or just click it. What is left is the grip: a full-height
   sliver carrying an arrow that points the way back, so a closed panel reads
   as folded away rather than as missing. Widths persist.
   ============================================================ */
feature("side columns",function(){
  const PANEL_KEY="fqpipe.panels";
  const root=document.body;
  const P_=[{grip:"gripL", el:aside,  varn:"--aside-w",  def:238, min:150, max:460, side:1,  shut:"›"},
            {grip:"gripR", el:reader, varn:"--reader-w", def:360, min:220, max:620, side:-1, shut:"‹"}];
  let saved={}; try{ saved=JSON.parse(localStorage.getItem(PANEL_KEY)||"{}"); }catch(err){}

  P_.forEach(p=>{
    p.node=document.getElementById(p.grip);
    if(!p.node) return;
    p.arrow=p.node.querySelector("span") || p.node.appendChild(document.createElement("span"));
    p.w = typeof saved[p.grip]==="number" ? saved[p.grip] : p.def;
    apply(p);
    let from=null;
    p.node.addEventListener("pointerdown",ev=>{
      ev.preventDefault();
      if(p.node.setPointerCapture) p.node.setPointerCapture(ev.pointerId);
      from={x:ev.clientX,w:p.w,moved:0};
    });
    p.node.addEventListener("pointermove",ev=>{
      if(!from) return;
      const d=(ev.clientX-from.x)*p.side;
      from.moved=Math.max(from.moved,Math.abs(ev.clientX-from.x));
      const want=from.w+d;
      /* below the minimum it does not squeeze, it shuts */
      p.w = want < p.min*0.6 ? 0 : Math.max(p.min,Math.min(p.max,want));
      apply(p);
    });
    ["pointerup","pointercancel"].forEach(t=>p.node.addEventListener(t,()=>{
      if(!from) return;
      /* a press that did not travel is a toggle */
      if(from.moved<4) p.w = p.w ? 0 : (typeof saved[p.grip+"_last"]==="number"?saved[p.grip+"_last"]:p.def);
      from=null; apply(p); store();
    }));
    p.node.addEventListener("keydown",ev=>{
      if(ev.key!=="Enter" && ev.key!==" ") return;
      ev.preventDefault(); p.w = p.w ? 0 : p.def; apply(p); store();
    });
  });
  function apply(p){
    root.style.setProperty(p.varn,p.w+"px");
    const shut=!p.w;
    p.node.classList.toggle("shut",shut);
    p.arrow.textContent = shut ? p.shut : "";
    p.node.setAttribute("aria-label",(shut?"Show ":"Hide ")+(p.side>0?"the index":"the reader"));
  }
  /* ---- opening the reader on a selection, and only then ----------------
     `auto` is true only while the reader is open BECAUSE something is
     selected. A person opening or closing it themselves clears the flag, so
     from that moment the column is theirs and a click on empty space leaves
     it exactly where they put it.

     Neither of these calls store(): the shut state is a preference, and a
     selection is not the user changing their mind about it. Fold the reader
     away, click through six stations, click on nothing, reload — it is still
     folded away. */
  const R=P_.find(p=>p.grip==="gripR");
  let auto=false;
  revealReader=()=>{
    if(!R || !R.node || R.w) return;               // already open: leave it
    R.w = (typeof saved.gripR_last==="number" && saved.gripR_last) || R.def;
    auto=true; apply(R);
  };
  restoreReader=()=>{
    if(!R || !R.node || !auto) return;             // it was open before us
    R.w=0; auto=false; apply(R);
  };

  function store(){
    auto=false;                                    // a deliberate change: it is theirs now
    const out={};
    P_.forEach(p=>{ out[p.grip]=p.w; if(p.w) out[p.grip+"_last"]=p.w; });
    saved=Object.assign(saved,out);
    try{ localStorage.setItem(PANEL_KEY,JSON.stringify(saved)); }catch(err){}
  }
});

/* ============================================================
   WALKING THE SEQUENCE
   The index and the strip are both in NODES order, which is the reading
   order, so stepping is moving through that array. Arrow keys on a desktop,
   two round buttons on anything — a phone has no keyboard and the strip is a
   scroll rather than a walk.
   ============================================================ */
function goTo(id){
  const n=byId[id]; if(!n) return;
  pinned=id; current=id;                       // always land on it, never toggle off
  renderNode(id); paintIndex(); focusNode(id);
}
function stepBy(d){
  if(!NODES.length) return;
  const at = current ? NODES.findIndex(n=>n.id===current) : (d>0?-1:0);
  const to = ((at+d)%NODES.length + NODES.length) % NODES.length;
  goTo(NODES[to].id);
}
feature("walk the sequence",function(){
  const next=document.getElementById("stNext"), prev=document.getElementById("stPrev");
  if(next) next.onclick=()=>stepBy(1);
  if(prev) prev.onclick=()=>stepBy(-1);
  window.addEventListener("keydown",e=>{
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const t=e.target, tag=t&&t.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||(t&&t.isContentEditable)) return;
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); stepBy(1); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); stepBy(-1); }
    else if(e.key==="Escape"){ release(); }
    else if(e.key==="Home"||e.key==="0"){ e.preventDefault(); resetView(); }
  });
});


/* ============================================================
   EDIT POSITIONS
   A tuning mode, ported from /pipeline. Everything the map draws is placed
   from world coordinates and the projection is affine, so dragging is exact
   rather than approximate: a screen delta divides straight back into a world
   delta, and moving an object is a translate on the group it was drawn into.
   Nothing is re-rendered and no ticker is disturbed.

   BOTH THE BUILDING AND ITS NAME ARE DRAGGABLE, and separately. A name is
   not attached to its building by anything but convention — it floats above
   and to one side, and where it can go depends on what its neighbours are
   doing. So it gets its own handle and its own pair of nudges (ldx/ldy), and
   moving the building carries the name with it while moving the name leaves
   the building where it is.

   What comes out is a table of NUDGES, not coordinates — dx/dy relative to
   whatever layoutRows() computed. Paste it into OFFSETS in fq-data.js and it
   survives re-solving the lane or inserting a step.

   Unlike /pipeline this writes to local storage only. That map's Save posts
   to a shared record keyed pipeline_map::edits; a second page writing there
   would overwrite it. Here the block to paste is printed in the reader and
   the browser holds a copy until it is baked into the file.
   ============================================================ */
let editing=false, dirty=false;
const r2=v=>Math.round(v*100)/100;

/* the committed table plus this sitting */
function totalOffset(n){
  const o={};
  const dx=r2(n.x-n._ox), dy=r2(n.y-n._oy), ldx=r2(n._lx), ldy=r2(n._ly);
  if(dx) o.dx=dx; if(dy) o.dy=dy; if(ldx) o.ldx=ldx; if(ldy) o.ldy=ldy;
  return o;
}
function annOffset(a){
  if(a.hide) return {del:true};
  const o={};
  const adx=r2(a.off.dx), ady=r2(a.off.dy);
  if(adx) o.adx=adx; if(ady) o.ady=ady;
  return o;
}
function collectOffsets(){
  const out={};
  /* deletions are carried forward whether or not the object is still on the
     map: GONE was applied before NODES existed in its present form, so those
     ids are not in NODES to be walked */
  GONE.forEach(id=>{ out[id]={del:true}; });
  NODES.forEach(n=>{ if(n.gone){ out[n.id]={del:true}; return; }
    const o=totalOffset(n); if(Object.keys(o).length) out[n.id]=o; });
  if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
    const o=annOffset(a); if(Object.keys(o).length) out[a.key]=o; });
  MOVERS.forEach(m=>{
    if(m.hide){ out[m.key]={del:true}; return; }
    const ldx=r2(m.lx), ldy=r2(m.ly);
    if(ldx||ldy) out[m.key]={...(ldx?{ldx}:{}),...(ldy?{ldy}:{})};
  });
  return out;
}
/* ---- the two bits of chrome the editing mode needs ----------------------
   ask()  a yes/no the caller cannot proceed past by accident
   note() a confirmation that says what happened and then gets out of the way

   Both are plain DOM in the stage rather than anything in the SVG: they must
   not shear with the projection, must not be inside whatever they are talking
   about, and must sit above everything. */
function ask(title,body,onYes){
  const box=document.getElementById("ask");
  if(!box){ if(confirm(title)) onYes(); return; }
  box.querySelector("#askTitle").textContent=title;
  box.querySelector("#askBody").textContent=body||"";
  box.classList.add("on");
  const go=box.querySelector("#askGo"), no=box.querySelector("#askNo");
  const close=()=>{ box.classList.remove("on"); go.onclick=null; no.onclick=null; };
  go.onclick=()=>{ close(); onYes(); };
  no.onclick=close;
}
let noteTimer=0;
function note(title,body,ms){
  const box=document.getElementById("note");
  if(!box) return;
  box.querySelector("#noteTitle").textContent=title;
  box.querySelector("#noteBody").innerHTML=body||"";
  box.classList.add("on");
  clearTimeout(noteTimer);
  /* it goes away on its own. A confirmation that needs dismissing is a second
     thing to do after the thing you actually wanted to do. */
  noteTimer=setTimeout(()=>box.classList.remove("on"), ms||5000);
}

/* WHAT THIS SITTING TOUCHED, as opposed to what is in force. The saved table
   is the whole arrangement rather than a diff, so it cannot answer "what did I
   just move" — and a confirmation that answers the wrong question reads as a
   confirmation of something you did not do. It is also half of who owns what
   when a save merges; see `ours`. */
const touched=new Set();

/* THE OTHER HALF: work this browser is holding that the shared copy has never
   seen. It arrives from local storage as part of the state the page loads
   with, so it is indistinguishable from everything else in force until the
   record is read — at which point whatever DIFFERS is, by definition, ours and
   unsent. Marking it is what keeps a change made before a refresh from being
   quietly dropped by the merge on the way out. Keys we hold identical to the
   record stay unmarked, so somebody else editing them later still wins. */
const HELD={};
const ours=k=>touched.has(k)||!!HELD[k];
const differs=(a,b)=>JSON.stringify(a===undefined?null:a)!==JSON.stringify(b===undefined?null:b);
function seedUnpublished(doc){
  const ro=(doc&&doc.offsets)||{};
  const mine=collectOffsets();
  Object.keys(mine).forEach(k=>{ if(differs(mine[k],ro[k])) HELD[k]=1; });
}

function stash(){
  remember(EDIT_KEY,JSON.stringify({offsets:collectOffsets(),at:Date.now()}));
}
/* Take the record's OWN timestamp after a successful write. Stamping it with
   this browser's clock instead means the next load compares two clocks, and a
   browser a few seconds fast reads its own save as somebody else's and
   reloads over it. */
function adoptStamp(at){
  if(!at) return;
  try{
    const j=JSON.parse(localStorage.getItem(EDIT_KEY)||"{}");
    j.at=at; localStorage.setItem(EDIT_KEY,JSON.stringify(j));
  }catch(err){}
}
function markDirty(id){
  dirty=true;
  if(id) touched.add(id);
  document.body.classList.add("haschanges");
  stash();
}

/* A SAVE IS A MERGE, NEVER A REPLACEMENT. The record is one document and the
   write is a whole-document Put, so a blind write means the second person to
   press Save silently flattens the first — and, less obviously, means a browser
   holding a stale copy of somebody else's work republishes it. Every save reads
   the record first and lays only the keys THIS sitting owns on top of it.

   A READ FAILURE ABORTS THE WRITE. Keeping a change in this browser is
   recoverable — it is still in local storage and still on screen. Overwriting
   somebody else's sitting is not. */
function mergeOnto(doc){
  const mine=collectOffsets(), theirs=(doc&&doc.offsets)||{};
  const out={...theirs};
  let kept=0;
  Object.keys(theirs).forEach(k=>{
    if(!ours(k) && differs(theirs[k],mine[k])) kept++; });
  new Set([...Object.keys(mine),...Object.keys(theirs)]).forEach(k=>{
    if(!ours(k)) return;
    if(mine[k]) out[k]=mine[k]; else delete out[k];
  });
  return {body:{offsets:out}, kept};
}
function put(body){
  return fetch("/api/fqpipe_edits",{method:"POST",
      headers:{"content-type":"application/json"},body:JSON.stringify(body)})
    .then(r=>r.json()).catch(()=>({ok:false,error:"unreachable"}));
}
function pushRemote(){
  if(typeof fetch!=="function") return Promise.resolve({ok:false,error:"unreachable"});
  return fetch("/api/fqpipe_edits",{cache:"no-store"})
    .then(r=>r.json()).catch(()=>null)
    .then(doc=>{
      if(!doc || doc.error) return {ok:false,error:"unreachable"};
      if(!doc.at) return put({offsets:collectOffsets()});   // nothing shared yet
      const m=mergeOnto(doc);
      return put(m.body).then(res=>{
        /* what went out is not what is on screen if the merge carried
           somebody else's work through, so keep the merged document */
        if(res && res.ok && m.kept)
          remember(EDIT_KEY,JSON.stringify({offsets:m.body.offsets,at:res.at||Date.now()}));
        return {...res, kept:m.kept};
      });
    });
}

feature("edit positions", function(){
  const btnEdit=document.getElementById("btnEdit");
  if(!btnEdit) return;                       // the page can ship without the tool
  const hint=document.querySelector(".hint");
  const hint0=hint?hint.textContent:"";
  const SNAP=0.05;

  /* screen pixels -> world units on the ground plane. The exact inverse of P,
     which is what makes a drag land where the pointer is rather than near it. */
  const toWorldD=(dsx,dsy)=>{
    const a=dsx/(S*C30), b=dsy/(S*0.5);
    return [(a+b)/2, (b-a)/2];
  };

  /* A dashed footprint on every building and a box round every name, so the
     whole map reads as pick-up-able the moment the mode is on. The name box
     is what makes a floating label a target at all: the glyphs themselves are
     a few hundred square pixels of ink and mostly holes. */
  NODES.forEach(n=>{
    nodeEls[n.id].appendChild(el("polygon",{points:pts(nodeSil(n)),class:"ehandle"}));
    const L=labelEls[n.id];
    if(!L) return;
    let bb; try{ bb=L.getBBox(); }catch(err){ bb=null; }
    if(!bb || !bb.width) return;
    const pad=4;
    const box={x:bb.x-pad,y:bb.y-pad,width:bb.width+pad*2,height:bb.height+pad*2};
    L.appendChild(el("rect",Object.assign({},box,{class:"ehandle lab"})));
    L.appendChild(el("rect",Object.assign({},box,{class:"ehit","data-id":n.id})));
  });
  /* the band's own name gets the same box, for the same reason: glyphs are a
     few hundred square pixels of ink and mostly holes */
  MOVERS.forEach(m=>{
    let bb; try{ bb=m.g.getBBox(); }catch(err){ bb=null; }
    if(!bb || !bb.width) return;
    const pad=6;
    const box={x:bb.x-pad,y:bb.y-pad,width:bb.width+pad*2,height:bb.height+pad*2};
    m.handle=m.g.appendChild(el("rect",Object.assign({},box,{class:"ehandle lab"})));
    m.hit=m.g.appendChild(el("rect",Object.assign({},box,{class:"ehit"})));
  });
  /* ---- PICK, AND THE ✕ ------------------------------------------------
     A press that does not travel is a pick rather than a drag, and a picked
     object gets a ✕ floating at its top corner. The ✕ is an HTML button in
     the stage, not an SVG one, for two reasons: it must not shear with the
     projection, and it must not be inside the group it is offering to
     delete — a control that vanishes with its own target is a control you
     cannot press twice.

     Deleting asks first. Every other action in this mode is a drag, which
     undoes itself by dragging back; this one does not, and the saved state
     is shared, so a mis-click would take an object off the map for everybody. */
  const xbtn=document.getElementById("delX");
  let picked=null;
  function placeX(){
    if(!xbtn) return;
    if(!picked || !editing){ xbtn.style.display="none"; return; }
    const r=svg.getBoundingClientRect();
    let sx,sy;
    if(picked.kind==="node"){
      const n=picked.n, p=P(n.x, n.y-n.d/2, topOf(n));
      sx=view.x+p[0]*view.k; sy=view.y+p[1]*view.k;
    } else {
      const t=picked.kind==="ann" ? picked.a.hit : picked.m.hit;
      if(!t){ xbtn.style.display="none"; return; }
      const b=t.getBoundingClientRect();
      sx=b.x+b.width-r.left; sy=b.y-r.top;
    }
    xbtn.style.display="grid";
    xbtn.style.left=(sx+8)+"px";
    xbtn.style.top=(sy-30)+"px";
  }
  window.placeDeleteX=placeX;
  function pick(what){ picked=what; placeX(); }
  function unpick(){ picked=null; placeX(); }

  function removeNode(n){
    n.gone=true;
    [nodeEls[n.id],plinthEls[n.id],labelEls[n.id]].forEach(e=>{ if(e) e.setAttribute("display","none"); });
    edgeGeom.forEach(rec=>{ if(rec.host && (rec.a===n.id||rec.b===n.id)) rec.host.setAttribute("display","none"); });
    DOTS.forEach(d=>{ if(d.e.a===n.id||d.e.b===n.id) d.node.setAttribute("display","none"); });
    rebuildClip();
  }
  function removeAnn(a){
    a.hide=true;
    [a.line,a.dot,a.t1,a.box,a.hit].forEach(e=>e.setAttribute("display","none"));
  }
  if(xbtn) xbtn.onclick=()=>{
    if(!picked) return;
    const what=picked;
    const name=what.kind==="node" ? what.n.key+" · "+what.n.name
             : what.kind==="ann"  ? what.a.key
             : what.m.name;
    ask("Delete "+name+"?",
        "It comes off the map for anyone who opens the page once you save. "+
        "Everything else in this mode undoes itself by dragging back; this does not.",
        ()=>{
          if(what.kind==="node") removeNode(what.n);
          else if(what.kind==="ann") removeAnn(what.a);
          else { what.m.hide=true; what.m.g.setAttribute("display","none"); }
          unpick();
          markDirty(what.kind==="node"?what.n.id:what.kind==="ann"?what.a.key:what.m.key);
        });
  };

  let grab=null;
  function begin(ev,n,mode){
    if(!editing) return;
    ev.stopPropagation(); ev.preventDefault();
    const el0=ev.currentTarget;
    if(el0.setPointerCapture) el0.setPointerCapture(ev.pointerId);
    grab={n,mode,px:ev.clientX,py:ev.clientY,moved:0,
          ox:n.x,oy:n.y,olx:n._lx,oly:n._ly};
    (mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.add("picked");
  }
  function move(ev){
    if(!grab) return;
    grab.moved=Math.max(grab.moved,Math.hypot(ev.clientX-grab.px,ev.clientY-grab.py));
    if(grab.mode==="ann"){
      /* an annotation is screen-space, not world-space: it is not on the
         ground plane, so its nudge is measured in the same units it is drawn
         in, and only the camera scale divides out. */
      const a=grab.ann;
      a.off.dx=Math.round(grab.ox+(ev.clientX-grab.px)/view.k);
      a.off.dy=Math.round(grab.oy+(ev.clientY-grab.py)/view.k);
      a.reflow();
      if(hint) hint.textContent=`${a.key} — adx ${a.off.dx} ady ${a.off.dy}`;
      return;
    }
    const [dx,dy]=toWorldD((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
    const q=v=>Math.round(v/SNAP)*SNAP;
    if(grab.mode==="mover"){
      const m=grab.m;
      m.lx=r2(grab.ox+q(dx)); m.ly=r2(grab.oy+q(dy));
      m.reflow();
      if(hint) hint.textContent=`${m.name} — ldx ${m.lx.toFixed(2)} ldy ${m.ly.toFixed(2)}`;
      return;
    }
    const n=grab.n;
    if(grab.mode==="label"){ n._lx=r2(grab.olx+q(dx)); n._ly=r2(grab.oly+q(dy)); }
    else { n.x=r2(grab.ox+q(dx)); n.y=r2(grab.oy+q(dy)); }
    reposition(n);
    if(grab.mode!=="label") refresh(n.id);
    say(n);
  }
  function end(){
    if(!grab) return;
    const travelled=grab.moved>4;
    if(grab.mode==="ann"){
      grab.ann.box.classList.remove("picked");
      const k=grab.ann.key;
      if(!travelled) pick({kind:"ann",a:grab.ann});
      const moved=travelled; grab=null;
      if(moved) markDirty(k);
      return;
    }
    if(grab.mode==="mover"){
      grab.m.g.classList.remove("picked");
      const k=grab.m.key;
      if(!travelled) pick({kind:"mover",m:grab.m});
      const moved=travelled; grab=null;
      if(moved) markDirty(k);
      return;
    }
    const n=grab.n;
    (grab.mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.remove("picked");
    if(!travelled) pick({kind:"node",n});
    grab=null;
    refresh(null);
    /* painter order is (x+y); something dragged far enough changes places */
    NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(m=>gNode.appendChild(nodeEls[m.id]));
    markDirty(n.id);
  }
  function say(n){
    if(!hint) return;
    const o=n?totalOffset(n):{};
    hint.textContent = n
      ? `${n.key} · ${n.name} — x ${n.x.toFixed(2)}  y ${n.y.toFixed(2)}`+
        `   ·   offset dx ${(o.dx||0).toFixed(2)} dy ${(o.dy||0).toFixed(2)}`+
        (o.ldx||o.ldy?`   ·   name ldx ${(o.ldx||0).toFixed(2)} ldy ${(o.ldy||0).toFixed(2)}`:"")
      : "Drag to move · click to pick, then × to delete · Save positions when done";
  }

  /* THE FLOATING ANNOTATIONS. Same drag, different target: what moves is the
     nudge the shape's own placement is offset by, so the next frame keeps it
     rather than putting the label back. The leader redraws from the moved
     text to the unmoved point it names, which is the whole reason a label
     like this is worth being able to move at all. */
  if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
    a.hit.addEventListener("pointerdown",ev=>{
      if(!editing) return;
      ev.stopPropagation(); ev.preventDefault();
      if(a.hit.setPointerCapture) a.hit.setPointerCapture(ev.pointerId);
      grab={ann:a,mode:"ann",px:ev.clientX,py:ev.clientY,moved:0,ox:a.off.dx,oy:a.off.dy};
      a.box.classList.add("picked");
    });
    a.hit.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>a.hit.addEventListener(t,end));
  });

  /* THE BAND'S NAME. World units, like a building's name — it is placed from
     world coordinates, so it can be nudged in them. */
  MOVERS.forEach(m=>{
    if(!m.hit) return;
    m.hit.addEventListener("pointerdown",ev=>{
      if(!editing) return;
      ev.stopPropagation(); ev.preventDefault();
      if(m.hit.setPointerCapture) m.hit.setPointerCapture(ev.pointerId);
      grab={m,mode:"mover",px:ev.clientX,py:ev.clientY,moved:0,ox:m.lx,oy:m.ly};
      m.g.classList.add("picked");
    });
    m.hit.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>m.hit.addEventListener(t,end));
  });

  NODES.forEach(n=>{
    const N=nodeEls[n.id];
    N.addEventListener("pointerdown",ev=>begin(ev,n,"node"));
    N.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>N.addEventListener(t,end));
    const L=labelEls[n.id]; if(!L) return;
    L.addEventListener("pointerdown",ev=>begin(ev,n,"label"));
    L.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>L.addEventListener(t,end));
  });

  function setMode(on){
    editing=on;
    if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{ a.forceShow=on; a.reflow(); });
    svg.classList.toggle("editing",on);
    document.body.classList.toggle("editing",on);
    btnEdit.textContent=on?"Done moving":"Edit positions";
    if(on){ release(); say(null); }
    else { unpick(); if(hint) hint.textContent=hint0; }
  }
  btnEdit.onclick=()=>setMode(!editing);
});

/* ============================================================
   SAVING
   Prints the block to paste into OFFSETS in fq-data.js. The browser already
   holds a copy — every release writes one — so this is about getting the
   sitting into the repo rather than about keeping it.
   ============================================================ */
feature("saving", function(){
  const btnSave=document.getElementById("btnSave"), btnDrop=document.getElementById("btnDiscard");
  if(!btnSave) return;
  const asSource=(o,name)=>{
    const rows=Object.entries(o).map(([k,v])=>
      `  ${/^[A-Za-z_$][\w$]*$/.test(k)?k:JSON.stringify(k)}: ${JSON.stringify(v)},`);
    return `const ${name} = {\n`+rows.join("\n")+(rows.length?"\n":"")+"};";
  };

  btnSave.onclick=()=>{
    const o=collectOffsets(), n=Object.keys(o).length;
    const moved=Object.values(o).filter(v=>!v.del).length;
    const gone=Object.values(o).filter(v=>v.del).length;
    /* WHAT WAS MOVED JUST NOW, as distinct from what is in force. The table
       is cumulative — it is the whole arrangement, not a diff — so counting it
       and calling the answer "moved" tells someone who nudged one label that
       they moved eleven things. */
    const mine=touched.size;
    const body=`${mine} moved this sitting · ${moved} placement${moved===1?"":"s"} `+
      `in force${gone?` · ${gone} deleted`:""} — this is what the page opens `+
      `with now, for every browser.`;
    /* the browser first, because that never fails and is what the person in
       front of it is about to reload into */
    stash();

    /* then the shared copy, which is what makes it the default for everyone.
       Its own record, never /pipeline's — one record shared between two maps
       means whichever saved last erases the other, silently. */
    pushRemote().then(res=>{
      if(res && res.ok){
        /* the record's own stamp, so the next load does not read this save as
           somebody else's and reload over it */
        adoptStamp(res.at);
        note("Saved as the default",body+
          (res.kept?` Someone else saved ${res.kept} change${res.kept===1?"":"s"} `+
                    `while you were working — kept, not overwritten. Refresh to see them.`:""));
      }
      else note("Saved in this browser only",
        "The shared copy could not be written, so the map opens this way here "+
        "and nowhere else. The block in the panel still works.");
    });

    /* and the block to paste, so a sitting can be baked into the repo */
    pinned=null; current=null; paintIndex();
    read.innerHTML=
      `<div class="eyebrow">Positions</div>`+
      `<div class="title">${moved} moved${gone?` · ${gone} deleted`:""}</div>`+
      `<div class="sub">everything currently in force, not just this sitting</div>`+
      (n?`<div class="snip">${esc(asSource(o,"OFFSETS"))}</div>`
        :`<p>Nothing differs from what the lane engine computed.</p>`)+
      `<h4>What this did</h4>`+
      `<p>Written to this browser and to the shared copy, so the page opens `+
      `this way for anyone. Paste the block into <mark>OFFSETS</mark> in `+
      `<mark>fq-data.js</mark> to put it in the repo, where it survives the `+
      `store being cleared.</p>`+
      `<p>These are <mark>nudges</mark> relative to what the lane engine computed, `+
      `never absolute coordinates, so they survive the lane being re-solved or a `+
      `step being inserted. <mark>dx/dy</mark> move a building and take its name `+
      `along, <mark>ldx/ldy</mark> move the name alone, <mark>adx/ady</mark> a `+
      `floating label, and <mark>del</mark> takes an object off the map.</p>`;
  };

  if(btnDrop) btnDrop.onclick=()=>ask("Discard every change?",
    "Positions and deletions both, back to what the file says. The shared copy "+
    "is left alone until the next save.",
    /* the stamp goes with the table: this browser stops claiming to hold
       anything, so the next load takes the record whole */
    ()=>{ forget(EDIT_KEY); location.reload(); });
});

/* ============================================================
   THE SHARED COPY
   Read after the map has drawn, never before it: a page that waits on a
   network round trip to show anything is a page that shows nothing when the
   network is slow. If the shared copy differs from what this browser opened
   with, the offsets are applied in place — no reload, no flash — and the
   ✕ button is told to catch up.
   ============================================================ */
feature("shared copy", function(){
  if(typeof fetch!=="function") return;
  const mine=EDITS.at||0;
  fetch("/api/fqpipe_edits",{cache:"no-store"}).then(r=>r.json()).then(doc=>{
    if(!doc || doc.error || !doc.at) return;

    /* KEEPING OURS is the common case, and it is the one two previous attempts
       got wrong. The record is only taken if it is STRICTLY NEWER than what
       this browser is holding. Otherwise every key we hold that the record has
       not seen is marked, so the merge on the way out carries it rather than
       deferring to the store — that is what stops a change made before a
       refresh from being quietly dropped by the next save. */
    if(doc.at<=mine || dirty) return seedUnpublished(doc);

    /* AND TAKING THEIRS IS A RELOAD, not an in-place application. Applying a
       table to a drawn map re-runs a subset of what a load does — it moves the
       objects and repaints the edges, and it does NOT re-derive the attrition
       band's span, re-solve the lane, rebuild the index or recompute the
       occlusion clip. The result is a picture no reload reproduces, which is
       indistinguishable from a layout that did not take. A reload is
       unambiguous, and this path is rare by construction: it only runs when
       somebody else has actually published something newer. */
    remember(EDIT_KEY,JSON.stringify({offsets:doc.offsets||{},at:doc.at}));
    /* AND ONLY RELOAD IF THE STORE ACTUALLY TOOK IT. A browser that cannot
       write local storage — private mode, storage disabled, quota — comes back
       holding at:0, reads the record as newer again, and reloads again, for
       ever. Check the write landed before acting on it. */
    let held=false;
    try{ held=JSON.parse(localStorage.getItem(EDIT_KEY)||"{}").at===doc.at; }catch(err){}
    if(!held){
      note("A newer shared layout is available",
        "This browser cannot remember it, so the page is not reloading — it "+
        "would come back to exactly here and reload again.",9000);
      return;
    }
    note("A newer shared layout arrived","Someone else saved. Loading it.",2000);
    setTimeout(()=>location.reload(), 900);
  }).catch(()=>{});
});
