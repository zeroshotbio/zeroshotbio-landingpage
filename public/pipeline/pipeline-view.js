/* ============================================================
   pipeline-view.js — assembly and interaction.
   Grid, bands, labels, edges, dots, camera, reader panel, index.
   Shared surface: change with a reason.
   ============================================================ */

/* Fail loudly and usefully if the scripts loaded out of order or one 404'd.
   Required order: pipeline-iso.js -> pipeline-shapes.js -> pipeline-data.js -> this file. */
(function requires(){
  const need={ "pipeline-iso.js":["P","paint","installDefs","layoutRows","TICKERS"],
               "pipeline-shapes.js":["DRAW","SKIN","topOf"],
               "pipeline-data.js":["NODES","EDGES","LANES","BANDS","CARRIES","SNIPPETS","OVERVIEW"] };
  const missing=[];
  for(const file in need)
    for(const sym of need[file])
      if(typeof window[sym]==="undefined" && typeof eval(`typeof ${sym}`)==="undefined")
        missing.push(`${sym} (from ${file})`);
  if(missing.length){
    const msg="pipeline: scripts missing or out of order — "+missing.join(", ");
    document.body.innerHTML=`<pre style="padding:20px;font:13px ui-monospace">${msg}
Expected load order:
  pipeline-iso.js
  pipeline-shapes.js
  pipeline-data.js
  pipeline-view.js
Check the script paths resolve (a route without a trailing slash will 404 them).</pre>`;
    throw new Error(msg);
  }
})();

/* Phones get a different shape: no side panels, the map takes almost the whole
   canvas, the step index becomes a strip along the bottom, and the reader
   rises as a sheet only when something is selected. Layout is CSS; this flag
   is only for the behaviour that CSS cannot express. */
const TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
const PHONE = () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches;

const svg=document.getElementById("svg");
const byId={}; NODES.forEach(n=>byId[n.id]=n);
layoutRows(NODES, LANES, MIRROR);

/* Fine positioning on top of the lane engine. OFFSETS in the data file is the
   committed table; anything dragged in Edit positions mode is held in local
   storage and wins over it while it is being tuned, so the two never stack —
   once a session is pasted back into OFFSETS the local copy is identical to it
   and clearing it changes nothing. */
const BAKED = (typeof OFFSETS!=="undefined") ? OFFSETS : {};
const LIVE = (()=>{ try{ const s=localStorage.getItem("pipeline.offsets");
                         return s?JSON.parse(s):BAKED; }catch(err){ return BAKED; } })();
NODES.forEach(n=>{
  const o=LIVE[n.id];
  if(o){
    n.x+=o.dx||0; n.y+=o.dy||0;
    if(o.ldx||o.ldy) n.lab={dx:((n.lab&&n.lab.dx)||0)+(o.ldx||0),
                            dy:((n.lab&&n.lab.dy)||0)+(o.ldy||0)};
  }
  /* where this node was actually drawn, and how far it has been dragged since */
  n._px=n.x; n._py=n.y; n._lx=0; n._ly=0;
});
/* every object the editor can pick up, keyed by node */
const plinthEls={}, labelEls={};

const defs=installDefs(svg);

/* ============================================================
   RENDER
   ============================================================ */

const world=el("g"); svg.appendChild(world);
const gGrid=el("g"),gAxis=el("g"),gBand=el("g"),gPlinth=el("g"),gEdge=el("g"),gDot=el("g"),gNode=el("g"),gLabel=el("g");
/* paint order is the z order. The tracks and the dots on them sit behind the
   solid world absolutely: anything they pass under occludes them. */
[gGrid,gAxis,gBand,gPlinth,gEdge,gDot,gNode,gLabel].forEach(g=>world.appendChild(g));

/* the extent of the ground plane, and of the ruler drawn around it */
const GRID={x0:-6,x1:25,y0:-5.5,y1:45};

(()=>{const {x0,x1,y0,y1}=GRID;
  for(let x=Math.ceil(x0);x<=x1;x++){const a=P(x,y0,0),b=P(x,y1,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
  for(let y=Math.ceil(y0);y<=y1;y++){const a=P(x0,y,0),b=P(x1,y,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
})();

/* ============================================================
   COORDINATE RULER
   Numbers along the two outer edges that meet at the top corner, so any
   position on the map can be named. These are the SAME x and y that NODES
   and LANES are authored in — read a number off the edge and it is the
   value to put in the file. Ticks every unit, numbers every two.
   Both rulers sit outside all content: the leftmost thing on the map is at
   x = -1.85 and the topmost at y = -3.55, against edges at -6 and -5.5.
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
  /* the axis lines themselves */
  tick(P(GRID.x0,GRID.y0,0), P(GRID.x1,GRID.y0,0), ".2");
  tick(P(GRID.x0,GRID.y0,0), P(GRID.x0,GRID.y1,0), ".2");
  /* X runs down-right along y = y0; its numbers lie along that direction */
  for(let x=Math.ceil(GRID.x0);x<=GRID.x1;x++){
    const on=x%2===0;
    tick(P(x,GRID.y0,0), P(x,GRID.y0-(on?T:T*0.5),0), on?".28":".16");
    if(on) num(P(x,GRID.y0-LBL,0), String(x), 30);
  }
  /* Y runs down-left along x = x0; numbers stay upright by reading up-right */
  for(let y=Math.ceil(GRID.y0);y<=GRID.y1;y++){
    const on=y%2===0;
    tick(P(GRID.x0,y,0), P(GRID.x0-(on?T:T*0.5),y,0), on?".28":".16");
    if(on) num(P(GRID.x0-LBL,y,0), String(y), -30);
  }
  num(P(GRID.x1+1.5,GRID.y0-LBL,0), "X", 30, true);
  num(P(GRID.x0-LBL,GRID.y1+1.5,0), "Y", -30, true);
})();

/* row bands — name runs along the band's bottom-right edge */
BANDS.forEach(b=>{
  const c=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];
  gBand.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":".025",stroke:"var(--fg)","stroke-opacity":".22",
    "stroke-width":"1","stroke-dasharray":"14 9"}));
  const [px,py]=P(b.x1, (b.y0+b.y1)/2, 0);
  const g=el("g",{transform:`translate(${px},${py}) rotate(-30)`});
  const t=el("text",{x:0,y:17,"text-anchor":"middle","font-size":"16","letter-spacing":"4",
    fill:"var(--fg3)"});
  t.textContent=b.name.toUpperCase(); g.appendChild(t);
  gLabel.appendChild(g);
});

/* plinths; landmark names run along the landmark's bottom-left edge */
NODES.filter(n=>n.anchor||n.shape==="works"||n.shape==="machine").forEach(n=>{
  const isA=!!n.anchor, pad=isA?0.55:0.4, hw=n.w/2+pad, hd=n.d/2+pad;
  const c=[[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],[n.x+hw,n.y+hd],[n.x-hw,n.y+hd]];
  plinthEls[n.id]=gPlinth.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":isA?".05":".03",stroke:"var(--fg)",
    "stroke-opacity":isA?".4":".28","stroke-width":"1","stroke-dasharray":isA?"6 4":"2 3"}));
  /* labelBelow moves a landmark's name off its top-back edge and onto its
     front edge, running down-left instead of up-right — for a landmark whose
     usual placement collides with whatever is above it */
  const lb = !!n.labelBelow;
  const [px,py]= lb ? P(n.x, n.y+n.d/2, 0) : P(n.x, n.y-n.d/2, topOf(n));
  const g=el("g",{transform:`translate(${px},${py}) rotate(-30)`});
  const lx = (isA?14:11) * (lb?-1:1), la = lb?"end":"start";
  const t=el("text",{x:lx,y:-3,"text-anchor":la,"font-size":isA?"20":"13",
    "letter-spacing":isA?"2.5":"1.6",fill:isA?"var(--fg)":"var(--fg2)"});
  t.textContent=n.name.toUpperCase(); g.appendChild(t);
  const t2=el("text",{x:lx,y:isA?12:10,"text-anchor":la,
    "font-size":isA?"11":"9",  "letter-spacing":".8",fill:"var(--fg2)"});
  t2.textContent=n.stat; g.appendChild(t2);
  gLabel.appendChild(g); labelEls[n.id]=g;
});

/* every step emits its name from its top-right corner, running up and to the right
   at −30°: parallel to the band titles, perpendicular to the flow of the dots */
NODES.filter(n=>!n.anchor && n.shape!=="works" && n.shape!=="machine").forEach(n=>{
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;                       // sits under its row: name goes down-left
  /* lab:{dx,dy} nudges the emission point in world units without touching the
     orientation — for a name that lands on top of something. Absent, nothing
     changes. */
  const lo = n.lab || {}, ex = n.x+(lo.dx||0);
  const [bx,by] = below ? P(ex, n.y+n.d/2+(lo.dy||0), n.h) : P(ex, n.y-n.d/2+(lo.dy||0), n.h);
  const g=el("g",{transform:`translate(${bx},${by}) rotate(-30)`});
  const t=el("text",{x:below?-9:9,y:-1,"text-anchor":below?"end":"start","font-size":"8.6",
    "letter-spacing":".35",fill:"var(--fg2)"});
  t.textContent=n.key+" · "+n.name; g.appendChild(t); gLabel.appendChild(g);
  labelEls[n.id]=g;
});

/* edges */
const edgeGeom=[];
function makeGeom(pp){
  let len=0; const segs=[];
  for(let k=1;k<pp.length;k++){
    const dx=pp[k][0]-pp[k-1][0],dy=pp[k][1]-pp[k-1][1],l=Math.hypot(dx,dy);
    segs.push({from:pp[k-1],dx,dy,l,at:len}); len+=l;}
  return {segs,len};
}
/* One <g> per edge so a route can be redrawn on its own when the editor moves
   a node — the number of elbows changes when two nodes come level, so the run
   is rebuilt rather than patched. */
function routeOf(e){
  const A=byId[e.a],B=byId[e.b], mx=(A.x+B.x)/2;
  /* straight:true forces a direct run even across lanes — for a fork or a
     merge, where the elbow reads as a detour rather than as routing */
  const raw = (e.straight || Math.abs(A.y-B.y)<0.05)
    ? [[A.x,A.y],[B.x,B.y]]
    : [[A.x,A.y],[mx,A.y],[mx,B.y],[B.x,B.y]];
  return raw.map(p=>P(p[0],p[1],0.02));
}
function paintEdge(rec){
  const host=rec.host;
  [...(host.children||[])].forEach(c=>host.removeChild(c));
  const pp=routeOf(rec);
  const faint = rec.kind==="drop"||rec.kind==="score";
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
  paintEdge(rec); edgeGeom.push(rec);
});

/* carries — fade to and from nothing */
CARRIES.forEach((c,i)=>{
  const a=P(c.x0,c.y0,0.02), b=P(c.x1,c.y1,0.02);
  const gid=`fade${i}`;
  const lg=el("linearGradient",{id:gid,gradientUnits:"userSpaceOnUse",x1:a[0],y1:a[1],x2:b[0],y2:b[1]});
  const o1=c.fade==="out"?".7":"0", o2=c.fade==="out"?"0":".7";
  lg.appendChild(el("stop",{offset:"0","stop-color":"var(--edge)","stop-opacity":o1}));
  lg.appendChild(el("stop",{offset:"1","stop-color":"var(--edge)","stop-opacity":o2}));
  defs.appendChild(lg);
  gEdge.appendChild(el("path",{d:`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`,fill:"none",
    stroke:`url(#${gid})`,"stroke-width":"1.3"}));
  edgeGeom.push({kind:c.kind,carry:c.fade,...makeGeom([a,b]),fromName:c.from,toName:c.to});
});

/* nodes */

/* declared here because the node listeners close over it */
let editing=false;
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

/* ============================================================
   OCCLUSION
   A track and the dot on it must vanish wherever a node stands. Painting an
   opaque patch behind each node did that, but the patch was a solid
   background-coloured hexagon sitting on top of the grid and bands, so every
   object with translucent artwork wore a visible slab underneath it.

   This does the same job by removing nothing and painting nothing: one
   clip path, a huge rectangle with every node's silhouette punched out of it
   by the even-odd rule, applied to the edge and dot layers only. Grid and
   bands are untouched and show through translucent shapes again, exactly as
   they did before the patch existed.
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
  NODES.forEach(n=>{ d+=" M "+nodeSil(n).map(p=>p.join(" ")).join(" L ")+" Z"; });
  clipPathEl.setAttribute("d",d);
}
(function occlude(){
  const cp=el("clipPath",{id:"nodeclip",clipPathUnits:"userSpaceOnUse"});
  rebuildClip();
  cp.appendChild(clipPathEl);
  defs.appendChild(cp);
  gEdge.setAttribute("clip-path","url(#nodeclip)");
  gDot .setAttribute("clip-path","url(#nodeclip)");
})();

/* ============================================================
   DOTS
   ============================================================ */
const DOTS=[];
edgeGeom.forEach(e=>{
  const faint = e.kind==="drop"||e.kind==="score";
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
let playing=!window.matchMedia("(prefers-reduced-motion: reduce)").matches, last=performance.now();
/* started at the end of the file, once the camera exists */
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  stepCamera(now);
  placeDots(playing?dt:0);
  /* everything shape-authored that moves lives here; it gets pause and zoom for free */
  if(playing) TICKERS.forEach(f=>f(dt, now, view.k));
  requestAnimationFrame(frame);
}

/* ============================================================
   PAN AND ZOOM
   ============================================================ */
let view={k:1,x:0,y:0}, anim=null;
const applyView=()=>world.setAttribute("transform",`translate(${view.x},${view.y}) scale(${view.k})`);
const centre=()=>{const r=svg.getBoundingClientRect();return [r.width/2,r.height/2];};

function fitTarget(){
  const bb=world.getBBox(), r=svg.getBoundingClientRect();
  return {fx:bb.x+bb.width/2, fy:bb.y+bb.height/2,
          k:Math.min((r.width-48)/bb.width,(r.height-64)/bb.height,1.4)};
}
function setFocus(t){
  const [cx,cy]=centre();
  view.k=t.k; view.x=cx-t.fx*t.k; view.y=cy-t.fy*t.k; applyView();
}
function fit(){ anim=null; setFocus(fitTarget()); }

/* glide the camera: interpolate the focus point linearly and the zoom
   geometrically, which keeps the apparent motion even through a big scale change */
function glideTo(target, ms=1200){
  const [cx,cy]=centre();
  anim={t0:performance.now(), ms,
        from:{fx:(cx-view.x)/view.k, fy:(cy-view.y)/view.k, k:view.k},
        to:target};
}
function stepCamera(now){
  if(!anim) return;
  const p=Math.min(1,(now-anim.t0)/anim.ms);
  /* quadratic in/out rather than cubic: same shape, much less punch at the ends */
  const e=p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  const f=anim.from, t=anim.to;
  setFocus({fx:f.fx+(t.fx-f.fx)*e, fy:f.fy+(t.fy-f.fy)*e, k:f.k*Math.pow(t.k/f.k,e)});
  if(p>=1) anim=null;
}
function focusNode(id){
  const n=byId[id]; if(!n) return;
  const r=svg.getBoundingClientRect();
  const [wx,wy]=P(n.x, n.y, (n.h||0.5)/2);
  const span=Math.max(70,(n.w+n.d)*S*C30);
  /* stop well short of filling the frame — a step should arrive with its
     neighbours still in view, so the sequence stays legible */
  const k=Math.max(0.6, Math.min(1.5, Math.min(r.width,r.height)*0.34/span));
  glideTo({fx:wx, fy:wy, k});
}
/* One pointer pans, two pinch. Pointer events cover mouse, pen and touch, so
   this is the same code path on a phone as on a desktop — the only thing the
   device changes is how many pointers show up. `moved` exists so that the
   click at the end of a pan does not read as a click on empty canvas and
   throw away the selection. */
let drag=null, pinch=null, moved=0;
const pointers=new Map();
const localMid=()=>{
  const [a,b]=[...pointers.values()], r=svg.getBoundingClientRect();
  return {d:Math.hypot(a.x-b.x,a.y-b.y),
          mx:(a.x+b.x)/2-r.left, my:(a.y+b.y)/2-r.top};
};
const startPinch=()=>{ const m=localMid();
  pinch={...m, k:view.k, x:view.x, y:view.y}; drag=null; svg.classList.remove("drag"); };
const startDrag=()=>{ const [p]=[...pointers.values()];
  drag={x:p.x,y:p.y,vx:view.x,vy:view.y}; svg.classList.add("drag"); };

svg.addEventListener("pointerdown",e=>{
  anim=null; moved=0;
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2) startPinch(); else startDrag();
});
svg.addEventListener("pointermove",e=>{
  if(!pointers.has(e.pointerId)) return;
  const was=pointers.get(e.pointerId);
  moved+=Math.hypot(e.clientX-was.x, e.clientY-was.y);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2 && pinch){
    const now=localMid();
    const nk=Math.max(.15,Math.min(5, pinch.k*(now.d/Math.max(1,pinch.d))));
    /* hold the world point that was under the first midpoint, and let the
       midpoint carry it — so two fingers zoom and pan in one gesture */
    const wx=(pinch.mx-pinch.x)/pinch.k, wy=(pinch.my-pinch.y)/pinch.k;
    view.k=nk; view.x=now.mx-wx*nk; view.y=now.my-wy*nk; applyView();
  } else if(drag){
    view.x=drag.vx+(e.clientX-drag.x); view.y=drag.vy+(e.clientY-drag.y); applyView();
  }
});
["pointerup","pointercancel"].forEach(t=>svg.addEventListener(t,e=>{
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
const zoomBy=f=>{const r=svg.getBoundingClientRect(),mx=r.width/2,my=r.height/2;
  const nk=Math.max(.15,Math.min(5,view.k*f));
  view.x=mx-(mx-view.x)*(nk/view.k);view.y=my-(my-view.y)*(nk/view.k);view.k=nk;applyView();};
document.getElementById("zin").onclick=()=>zoomBy(1.25);
document.getElementById("zout").onclick=()=>zoomBy(.8);

/* ============================================================
   READER
   ============================================================ */
const read=document.getElementById("read");
let tab="does", pinned=null, current=null;
const esc=s=>s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

function renderOverview(){
  const o=OVERVIEW;
  read.innerHTML=`<div class="eyebrow">${o.eyebrow}</div><div class="title big">${o.title}</div><div class="sub">${o.sub}</div>`+
    (tab==="does" ? `<h4>The story</h4>${o.does}<h4>Condition</h4>${o.cond}`
      : `<h4>How it's built</h4>${o.built}<h4>How to read it</h4><p>Eight landmarks sit on dashed plinths and carry their names on the ground. Hatching means the stage destroys data. The one line that fades to nothing is at the very end, past the handoff, where this map stops being the right way to look at it.</p>`);
}
function renderNode(id){
  const n=byId[id];
  read.innerHTML=`<div class="eyebrow">${esc(n.group)}${n.tier?" · "+n.tier+" tier":""}</div>`+
    `<div class="title${n.anchor?" big":""}">${esc(n.name)}</div><div class="sub">${esc(n.sub)}</div>`+
    (UNVERIFIED.has(n.key)?`<div class="unver">unverified with Patrick</div>`:"")+
    (tab==="does" ? `<h4>What it does</h4><p>${n.does}</p><h4>Condition</h4><p class="cond">${n.cond}</p>`
      : `<h4>How it's built</h4><p>${n.built}</p>`+
        `<dl class="kv"><dt>Marker</dt><dd>${n.key}</dd></dl>`+
        `<dl class="kv"><dt>Feeds</dt><dd>${EDGES.filter(e=>e.a===id).map(e=>byId[e.b].name).join(", ")||"—"}</dd></dl>`+
        `<dl class="kv"><dt>Fed by</dt><dd>${EDGES.filter(e=>e.b===id).map(e=>byId[e.a].name).join(", ")||"—"}</dd></dl>`);
}
function inspect(r){
  const s=SNIPPETS[r.e.kind]();
  pinned=null;current=null;paintIndex();
  read.innerHTML=`<div class="eyebrow">In transit</div><div class="title">${s.label}</div>`+
    `<div class="sub">${esc(r.e.fromName)} → ${esc(r.e.toName)}</div>`+
    `<h4>Payload</h4><div class="snip">${esc(s.text)}</div>`+
    (s.flag?`<h4>Flag</h4><p class="cond">${esc(s.flag)}</p>`:"")+
    `<h4>Note</h4><p>${s.note||"Real record, read off the stage output on the instance."}</p>`;
}
function show(id,pin){
  if(pinned&&!pin&&pinned!==id) return;      // a pinned selection outranks a hover
  if(pin) pinned = pinned===id ? null : id;
  current = pinned || id;
  current?renderNode(current):renderOverview(); paintIndex();
}
/* Hovering is a preview and nothing more: the moment the pointer leaves the
   thing it was over, the map goes back to nothing selected. Only a click pins,
   and only a click on empty space or on the pinned item releases it. */
function unhover(){ if(pinned) return; current=null; renderOverview(); paintIndex(); }
function release(){ pinned=null; current=null; renderOverview(); paintIndex(); }
svg.addEventListener("mouseleave",unhover);

const aside=document.getElementById("aside");
(function buildIndex(){
  let html="",g=null;
  NODES.forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<div class="grp${n.groupMark?" mark":""}">${esc(g)}</div>`;}
    html+=`<button class="row${n.anchor?" anchor":""}" data-id="${n.id}"><span class="key">${n.key}</span>`+
          `<span class="nm">${esc(n.name)}</span><span class="n">${n.hatch?"cull":""}</span></button>`;
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
          `<span class="k">${esc(n.key)}</span><span class="nm n">${esc(n.name)}</span></button>`;
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
  reader.classList.toggle("open", open);
  /* the strip shrinks to a rule of keys so the reader gets the height */
  strip.classList.toggle("mini", open);
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
     is what keeps the tracks hidden behind them; the selected one is picked out
     by a halo instead of by everything else fading. */
  Object.entries(nodeEls).forEach(([id,g])=>{
    g.style.filter = (current===id)
      ? "drop-shadow(0 0 4px var(--signal)) drop-shadow(0 0 11px var(--signal)) brightness(1.08)"
      : "";
  });
}
renderOverview();

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
  t.classList.add("on");tab=t.dataset.tab;current?renderNode(current):renderOverview();
});
const btnPlay=document.getElementById("btnPlay");
const syncPlay=()=>btnPlay.textContent=playing?"Pause the flow":"Resume the flow";
btnPlay.onclick=()=>{playing=!playing;syncPlay();}; syncPlay();
document.getElementById("btnStep").onclick=()=>{playing=false;syncPlay();placeDots(.35);};
const resetView=()=>{pinned=null;current=null;renderOverview();paintIndex();glideTo(fitTarget(),1100);};
document.getElementById("btnReset").onclick=resetView;
document.getElementById("zfit").onclick=resetView;
document.getElementById("btnStages").onclick=()=>aside.classList.toggle("open");
/* the ruler is a working tool, not part of the picture — one click hides it */
let axes=!PHONE();     /* the ruler earns its space on a desktop, not a phone */
const btnAxes=document.getElementById("btnAxes");
const syncAxes=()=>{ gAxis.style.display=axes?"":"none";
                     btnAxes.textContent=axes?"Hide axes":"Show axes"; };
btnAxes.onclick=()=>{ axes=!axes; syncAxes(); }; syncAxes();
document.getElementById("btnTheme").onclick=e=>{
  document.body.classList.toggle("light");
  e.target.textContent=document.body.classList.contains("light")?"Dark":"Light";
};
svg.addEventListener("click",()=>{ if(moved<8 && !editing) release(); });

/* ============================================================
   EDIT POSITIONS
   A tuning mode. Everything the map draws is placed from world coordinates,
   and the projection is affine, so dragging is exact rather than approximate:
   a screen delta divides straight back into a world delta, and moving an
   object is a translate on the group it was drawn into. Nothing is
   re-rendered and no ticker is disturbed.

   What comes out is a table of NUDGES, not coordinates — dx/dy relative to
   whatever layoutRows() computed. Paste it into OFFSETS in the data file and
   it survives re-solving a lane or inserting a step.
   ============================================================ */
(function editor(){
  const btnEdit=document.getElementById("btnEdit");
  const btnSave=document.getElementById("btnSave");
  const btnDrop=document.getElementById("btnDiscard");
  if(!btnEdit) return;                       // the page can ship without the tool
  const hint=document.querySelector(".hint");
  const hint0=hint?hint.textContent:"";
  const SNAP=0.05, r2=v=>Math.round(v*100)/100;

  /* screen pixels -> world units, on the ground plane. Inverse of P. */
  const toWorld=(dsx,dsy)=>{
    const a=dsx/(S*C30), b=dsy/(S*0.5);
    return [(a+b)/2, (b-a)/2];
  };
  const shift=(dx,dy)=>`translate(${((dx-dy)*S*C30).toFixed(2)},${((dx+dy)*S*0.5).toFixed(2)})`;

  /* a dashed footprint on every node and a box round every name, so the whole
     map reads as pick-up-able the moment the mode is on */
  NODES.forEach(n=>{
    const o=el("polygon",{points:pts(nodeSil(n)),class:"ehandle"});
    nodeEls[n.id].appendChild(o);
    const L=labelEls[n.id];
    if(!L) return;
    let bb; try{ bb=L.getBBox(); }catch(err){ bb=null; }
    if(!bb || !bb.width) return;
    const pad=3;
    const box={x:bb.x-pad,y:bb.y-pad,width:bb.width+pad*2,height:bb.height+pad*2};
    L.appendChild(el("rect",{...box,class:"ehandle lab"}));
    L.appendChild(el("rect",{...box,class:"ehit","data-id":n.id}));
  });

  /* redraw whatever a moved node touches. Mid-drag only its own routes are
     rebuilt; the full pass runs once on release. */
  function refresh(id){
    rebuildClip();
    /* carries have no host: they run to and from off-map and are authored in
       absolute coordinates, so no node move can change them */
    edgeGeom.forEach(rec=>{ if(rec.host && (!id || rec.a===id || rec.b===id)) paintEdge(rec); });
    placeDots(0);
  }
  function reposition(n){
    const dx=n.x-n._px, dy=n.y-n._py;
    const t=(dx||dy)?shift(dx,dy):"";
    nodeEls[n.id].setAttribute("transform",t);
    if(plinthEls[n.id]) plinthEls[n.id].setAttribute("transform",t);
    if(labelEls[n.id])  labelEls[n.id].setAttribute("transform",
      (dx||dy||n._lx||n._ly) ? shift(dx+n._lx, dy+n._ly)+" "+labelEls[n.id].dataset.base
                             : labelEls[n.id].dataset.base);
  }

  /* a label group already carries its own translate+rotate; keep it so the
     drag transform can be composed in front of it */
  Object.entries(labelEls).forEach(([id,L])=>{ L.dataset.base=L.getAttribute("transform")||""; });

  let grab=null;
  function begin(ev,n,mode){
    if(!editing) return;
    ev.stopPropagation(); ev.preventDefault();
    const el0=ev.currentTarget;
    if(el0.setPointerCapture) el0.setPointerCapture(ev.pointerId);
    grab={n,mode,px:ev.clientX,py:ev.clientY,
          ox:n.x,oy:n.y,olx:n._lx,oly:n._ly,el:el0};
    (mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.add("picked");
  }
  function move(ev){
    if(!grab) return;
    const [dx,dy]=toWorld((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
    const q=v=>Math.round(v/SNAP)*SNAP;
    const n=grab.n;
    if(grab.mode==="label"){ n._lx=r2(grab.olx+q(dx)); n._ly=r2(grab.oly+q(dy)); }
    else { n.x=r2(grab.ox+q(dx)); n.y=r2(grab.oy+q(dy)); }
    reposition(n);
    if(grab.mode!=="label") refresh(n.id);
    say(n);
  }
  function end(){
    if(!grab) return;
    const n=grab.n;
    (grab.mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.remove("picked");
    grab=null;
    refresh(null);
    /* painter order is (x+y); something dragged far enough changes places */
    NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(m=>gNode.appendChild(nodeEls[m.id]));
    stash();
  }
  function say(n){
    if(!hint) return;
    const o=n?total(n):{};
    hint.textContent = n
      ? `${n.key} · ${n.name} — x ${n.x.toFixed(2)}  y ${n.y.toFixed(2)}`+
        `   ·   offset dx ${(o.dx||0).toFixed(2)} dy ${(o.dy||0).toFixed(2)}`+
        (o.ldx||o.ldy?`   ·   name ldx ${(o.ldx||0).toFixed(2)} ldy ${(o.ldy||0).toFixed(2)}`:"")
      : "Drag any object or any name · release to keep · Save positions when done";
  }

  NODES.forEach(n=>{
    nodeEls[n.id].addEventListener("pointerdown",ev=>begin(ev,n,"node"));
    nodeEls[n.id].addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>nodeEls[n.id].addEventListener(t,end));
    const L=labelEls[n.id]; if(!L) return;
    L.addEventListener("pointerdown",ev=>begin(ev,n,"label"));
    L.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>L.addEventListener(t,end));
  });

  /* the committed table plus this session, which is what gets pasted back */
  function total(n){
    const b=LIVE[n.id]||{}, o={};
    const dx=r2((b.dx||0)+(n.x-n._px)), dy=r2((b.dy||0)+(n.y-n._py));
    const ldx=r2((b.ldx||0)+n._lx),     ldy=r2((b.ldy||0)+n._ly);
    if(dx) o.dx=dx; if(dy) o.dy=dy; if(ldx) o.ldx=ldx; if(ldy) o.ldy=ldy;
    return o;
  }
  function collect(){
    const out={};
    NODES.forEach(n=>{ const o=total(n); if(Object.keys(o).length) out[n.id]=o; });
    return out;
  }
  function stash(){
    try{ localStorage.setItem("pipeline.offsets",JSON.stringify(collect())); }catch(err){}
  }
  function asSource(o){
    const rows=Object.entries(o).map(([id,v])=>
      `  ${id}:{${Object.entries(v).map(([k,x])=>k+":"+x).join(",")}},`);
    return "const OFFSETS = {\n"+rows.join("\n")+(rows.length?"\n":"")+"};";
  }

  function setMode(on){
    editing=on;
    svg.classList.toggle("editing",on);
    document.body.classList.toggle("editing",on);
    btnEdit.textContent=on?"Done editing":"Edit positions";
    if(on){ release(); say(null); }
    else if(hint) hint.textContent=hint0;
  }
  btnEdit.onclick=()=>setMode(!editing);

  btnSave.onclick=()=>{
    const o=collect(), src=asSource(o);
    stash();
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(src).catch(()=>{});
    console.log(src);
    pinned=null; current=null; paintIndex();
    read.innerHTML=`<div class="eyebrow">Edit positions</div>`+
      `<div class="title">${Object.keys(o).length} object${Object.keys(o).length===1?"":"s"} moved</div>`+
      `<div class="sub">copied to the clipboard, and kept in this browser until it is baked in</div>`+
      `<h4>Paste this over OFFSETS in pipeline-data.js</h4><div class="snip">${esc(src)}</div>`+
      `<h4>Note</h4><p>These are nudges relative to what the lane engine computed, not absolute `+
      `coordinates, so they survive a row being re-solved or a step being inserted. `+
      `Discard throws away everything not yet baked in.</p>`;
  };
  btnDrop.onclick=()=>{
    if(!confirm("Throw away every position moved since the last bake-in?")) return;
    try{ localStorage.removeItem("pipeline.offsets"); }catch(err){}
    location.reload();
  };
})();

placeDots(0); fit(); last=performance.now(); requestAnimationFrame(frame);
