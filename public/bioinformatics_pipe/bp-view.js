/* ============================================================
   bp-view.js — assembly and interaction.
   Grid, ruler, bands, plinths, labels, edges, dots, camera, reader, index.

   This is /pipeline's view with the three authoring modes removed, and
   nothing else changed. It has to be: this page IS row 3 of that map, so a
   step has to draw, label, highlight and read the same way in both places or
   the two stop being one account of one pipeline. What is NOT here — Edit
   positions, Edit text, Edit visual —
   is out because those write to a single fixed record keyed to the /pipeline
   map, and a second page pointing at it would silently overwrite that map's
   saved state. If this page ever needs them, it needs its own record first.
   ============================================================ */

/* Fail loudly and usefully if the scripts loaded out of order or one 404'd. */
(function requires(){
  const need={ "bp-iso.js":["P","paint","installDefs","layoutRows","roofFrame","TICKERS"],
               "bp-pop.js":["makeBarcodes","kneeOf","mitoCut","cubicBand","doubletScores"],
               "bp-shapes.js":["DRAW","SKIN","topOf","MODEL"],
               "bp-data.js":["NODES","EDGES","LANES","BANDS","CARRIES","SNIPPETS","OVERVIEW"] };
  const missing=[];
  for(const file in need)
    for(const sym of need[file])
      if(typeof window[sym]==="undefined" && typeof eval(`typeof ${sym}`)==="undefined")
        missing.push(`${sym} (from ${file})`);
  if(missing.length){
    const msg="bioinformatics_pipe: scripts missing or out of order — "+missing.join(", ");
    document.body.innerHTML=`<pre style="padding:20px;font:13px ui-monospace">${msg}
Expected load order:
  bp-iso.js
  bp-pop.js
  bp-shapes.js
  bp-data.js
  bp-view.js
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
const GRID={x0:-6,x1:29,y0:-11,y1:14};

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

/* row bands — the name runs along the band's bottom-right edge */
BANDS.forEach(b=>{
  const c=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];
  gBand.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":".025",stroke:"var(--fg)","stroke-opacity":".22",
    "stroke-width":"1","stroke-dasharray":"14 9"}));
  const [px,py]=P(b.x1,(b.y0+b.y1)/2,0);
  const g=el("g",{transform:`translate(${px},${py}) rotate(-30)`});
  const t=el("text",{x:0,y:17,"text-anchor":"middle","font-size":"16","letter-spacing":"4",
    fill:"var(--fg3)"});
  t.textContent=b.name.toUpperCase(); g.appendChild(t);
  gLabel.appendChild(g);
});

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
EDGES.forEach(e=>{
  const rec={...e,host:gEdge.appendChild(el("g")),
             fromName:byId[e.a].name,toName:byId[e.b].name};
  const pp=routeOf(rec);
  const faint = rec.kind==="drop"||rec.kind==="soup";
  const path=el("path",{d:"M "+pp.map(p=>p.join(" ")).join(" L "),fill:"none",stroke:"var(--edge)",
    "stroke-width":faint?"1":"1.3","stroke-opacity":faint?".35":".7"});
  if(rec.dash) path.setAttribute("stroke-dasharray","5 4");
  rec.host.appendChild(path);
  pp.slice(1,-1).forEach(c=>rec.host.appendChild(el("rect",
    {x:c[0]-2.4,y:c[1]-2.4,width:4.8,height:4.8,transform:`rotate(45 ${c[0]} ${c[1]})`,
     fill:"var(--edge)","fill-opacity":".5"})));
  const g=makeGeom(pp); rec.segs=g.segs; rec.len=g.len;
  edgeGeom.push(rec);
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

/* ============================================================
   NODES
   ============================================================ */
const nodeEls={};
NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(n=>{
  const g=el("g",{tabindex:"0",role:"button","aria-label":n.name});
  g.style.cursor="pointer";
  DRAW[n.shape](g,n);
  if(!TOUCH){
    g.addEventListener("mouseenter",()=>show(n.id,false));
    g.addEventListener("mouseleave",unhover);
  }
  g.addEventListener("focus",()=>show(n.id,false));
  g.addEventListener("blur",unhover);
  g.addEventListener("click",ev=>{ev.stopPropagation(); show(n.id,true);});
  gNode.appendChild(g); nodeEls[n.id]=g;
});

/* ============================================================
   OCCLUSION
   A track and the dot on it must vanish wherever a building stands. One clip
   path — a huge rectangle with every silhouette punched out of it by the
   even-odd rule — applied to the edge and dot layers only. Grid and bands are
   untouched, so they still show through translucent artwork.
   ============================================================ */
(function occlude(){
  const sil=n=>{
    const hw=n.w/2, hd=n.d/2, h=topOf(n);
    return [P(n.x-hw,n.y-hd,h), P(n.x+hw,n.y-hd,h), P(n.x+hw,n.y+hd,h),
            P(n.x+hw,n.y+hd,0), P(n.x-hw,n.y+hd,0), P(n.x-hw,n.y-hd,0)];
  };
  const R=40000;
  let d=`M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`;
  NODES.forEach(n=>{ d+=" M "+sil(n).map(p=>p.join(" ")).join(" L ")+" Z"; });
  const cp=el("clipPath",{id:"nodeclip",clipPathUnits:"userSpaceOnUse"});
  cp.appendChild(el("path",{d,"clip-rule":"evenodd"}));
  defs.appendChild(cp);
  gEdge.setAttribute("clip-path","url(#nodeclip)");
  gDot .setAttribute("clip-path","url(#nodeclip)");
})();

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
const MOTION_KEY="bpipe.motion";
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
      console.error("bioinformatics_pipe: a roof's animation threw and was dropped — the map keeps running.",err);
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
    if(playing && view.k>=MOTION_MIN) runTickers(dt,now);
  }catch(err){
    if(!lastErr) console.error("bioinformatics_pipe: a frame threw — the loop keeps running.",err);
    lastErr=err;
  }
  requestAnimationFrame(frame);
}
/* one line to paste back when the map looks stuck */
window.bpipeDiag=()=>({
  moving: playing && view.k>=MOTION_MIN,
  playing, choice:motionChoice||"(system)", systemAsksForReduce:!!mqReduce.matches,
  zoom:+(view.k||0).toFixed(3), frames, dots:DOTS.length,
  tickers:TICKERS.length, droppedTickers:DROPPED.length,
  cells:MODEL.cells.length, band:+MODEL.band.half.toFixed(3),
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
    (n.modelled?`<div class="unver">modelled — every other figure on this page is real</div>`:"")+
    `<h4>What it does</h4><p>${n.does}</p>`+
    `<h4>How it is built</h4><p>${n.built}</p>`+
    `<h4>Condition</h4><p class="cond">${n.cond}</p>`+
    (n.kv?`<h4>Record</h4>`+n.kv.map(([k,v])=>
      `<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`).join(""):"")+
    `<h4>On the map</h4>`+
    `<dl class="kv"><dt>Feeds</dt><dd>${esc(feeds)}</dd></dl>`+
    `<dl class="kv"><dt>Fed by</dt><dd>${esc(fedBy)}</dd></dl>`;
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
}
/* Hovering is a preview and nothing more. Only a click pins, and only a click
   on empty space or on the pinned item releases it. */
function unhover(){ if(pinned) return; current=null; renderOverview(); paintIndex(); }
function release(){ pinned=null; current=null; renderOverview(); paintIndex(); }
svg.addEventListener("mouseleave",unhover);

const aside=document.getElementById("aside");
(function buildIndex(){
  let html="",g=null;
  NODES.forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<div class="grp${n.groupMark?" mark":""}">${esc(g)}</div>`;}
    html+=`<button class="row${n.anchor?" anchor":""}" data-id="${n.id}"><span class="key">${esc(n.key)}</span>`+
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
svg.addEventListener("click",()=>{ if(moved<8) release(); });

/* ============================================================
   START THE MAP
   Deliberately before every optional feature below. A browser holding a stale
   index.html against fresh scripts will not find an element one of them
   wants, and that single null would otherwise take the whole tail of the file
   with it — including this loop. The symptom is a map that draws, lists and
   highlights perfectly and then sits frozen.
   ============================================================ */
placeDots(0); fit(); last=performance.now(); requestAnimationFrame(frame);

/* Each block below is a feature, not a dependency. One that cannot find what
   it needs says so and stands down; the map keeps working. */
function feature(name,fn){
  try{ fn(); }
  catch(err){ console.error(`bioinformatics_pipe: "${name}" did not start — the map is fine, that feature is not.`,err); }
}

/* ============================================================
   THE SIDE COLUMNS
   Both are draggable shut. Drag the grip to resize, drag far enough and it
   snaps closed, or just click it. What is left is the grip: a full-height
   sliver carrying an arrow that points the way back, so a closed panel reads
   as folded away rather than as missing. Widths persist.
   ============================================================ */
feature("side columns",function(){
  const PANEL_KEY="bpipe.panels";
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
  function store(){
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
