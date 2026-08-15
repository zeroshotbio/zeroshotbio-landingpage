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
               "pipeline-data.js":["NODES","EDGES","BANDS","CARRIES","SNIPPETS","OVERVIEW"] };
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

const svg=document.getElementById("svg");
const byId={}; NODES.forEach(n=>byId[n.id]=n);
layoutRows(NODES, ROWS, MIRROR);

const defs=installDefs(svg);

/* ============================================================
   RENDER
   ============================================================ */

const world=el("g"); svg.appendChild(world);
const gGrid=el("g"),gBand=el("g"),gPlinth=el("g"),gEdge=el("g"),gNode=el("g"),gLabel=el("g"),gDot=el("g");
[gGrid,gBand,gPlinth,gEdge,gNode,gLabel,gDot].forEach(g=>world.appendChild(g));

(()=>{const x0=-6,x1=25,y0=-4.5,y1=43;
  for(let x=Math.ceil(x0);x<=x1;x++){const a=P(x,y0,0),b=P(x,y1,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
  for(let y=Math.ceil(y0);y<=y1;y++){const a=P(x0,y,0),b=P(x1,y,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
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
  gPlinth.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":isA?".05":".03",stroke:"var(--fg)",
    "stroke-opacity":isA?".4":".28","stroke-width":"1","stroke-dasharray":isA?"6 4":"2 3"}));
  const [px,py]=P(n.x, n.y-n.d/2, topOf(n));
  const g=el("g",{transform:`translate(${px},${py}) rotate(-30)`});
  const t=el("text",{x:isA?14:11,y:-3,"text-anchor":"start","font-size":isA?"20":"13",
    "letter-spacing":isA?"2.5":"1.6",fill:isA?"var(--fg)":"var(--fg2)"});
  t.textContent=n.name.toUpperCase(); g.appendChild(t);
  const t2=el("text",{x:isA?14:11,y:isA?12:10,"text-anchor":"start",
    "font-size":isA?"11":"9",  "letter-spacing":".8",fill:"var(--fg2)"});
  t2.textContent=n.stat; g.appendChild(t2);
  gLabel.appendChild(g);
});

/* every step emits its name from its top-right corner, running up and to the right
   at −30°: parallel to the band titles, perpendicular to the flow of the dots */
NODES.filter(n=>!n.anchor && n.shape!=="works" && n.shape!=="machine").forEach(n=>{
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;                       // sits under its row: name goes down-left
  const [bx,by] = below ? P(n.x, n.y+n.d/2, n.h) : P(n.x, n.y-n.d/2, n.h);
  const g=el("g",{transform:`translate(${bx},${by}) rotate(-30)`});
  const t=el("text",{x:below?-9:9,y:-1,"text-anchor":below?"end":"start","font-size":"8.6",
    "letter-spacing":".35",fill:"var(--fg2)"});
  t.textContent=n.name; g.appendChild(t); gLabel.appendChild(g);
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
EDGES.forEach(e=>{
  const A=byId[e.a],B=byId[e.b];
  const mx=(A.x+B.x)/2;
  const raw = Math.abs(A.y-B.y)<0.05 ? [[A.x,A.y],[B.x,B.y]] : [[A.x,A.y],[mx,A.y],[mx,B.y],[B.x,B.y]];
  const pp=raw.map(p=>P(p[0],p[1],0.02));
  const faint = e.kind==="drop"||e.kind==="score";
  const path=el("path",{d:"M "+pp.map(p=>p.join(" ")).join(" L "),fill:"none",stroke:"var(--edge)",
    "stroke-width":faint?"1":"1.3","stroke-opacity":faint?".35":".7"});
  if(e.dash) path.setAttribute("stroke-dasharray","5 4");
  gEdge.appendChild(path);
  pp.slice(1,-1).forEach(c=>gEdge.appendChild(el("rect",
    {x:c[0]-2.4,y:c[1]-2.4,width:4.8,height:4.8,transform:`rotate(45 ${c[0]} ${c[1]})`,
     fill:"var(--edge)","fill-opacity":".5"})));
  edgeGeom.push({...e,...makeGeom(pp),fromName:byId[e.a].name,toName:byId[e.b].name});
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
const nodeEls={};
NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(n=>{
  const g=el("g",{tabindex:"0",role:"button","aria-label":n.name});
  g.style.cursor="pointer";
  DRAW[n.shape](g,n);
  const [lx,ly]=P(n.x,n.y,topOf(n));
  const pale = n.shape==="monolith"||n.shape==="strata"||n.shape==="machine";
  const t=el("text",{x:lx,y:ly+4,"text-anchor":"middle","font-size":n.anchor?"13":"10",
    fill:pale?"var(--txt-mono)":"var(--txt-box)"});
  t.textContent=n.key; g.appendChild(t);
  g.addEventListener("mouseenter",()=>show(n.id,false));
  g.addEventListener("focus",()=>show(n.id,false));
  g.addEventListener("click",ev=>{ev.stopPropagation();show(n.id,true);});
  gNode.appendChild(g); nodeEls[n.id]=g;
});

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
function glideTo(target, ms=780){
  const [cx,cy]=centre();
  anim={t0:performance.now(), ms,
        from:{fx:(cx-view.x)/view.k, fy:(cy-view.y)/view.k, k:view.k},
        to:target};
}
function stepCamera(now){
  if(!anim) return;
  const p=Math.min(1,(now-anim.t0)/anim.ms);
  const e=p<0.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
  const f=anim.from, t=anim.to;
  setFocus({fx:f.fx+(t.fx-f.fx)*e, fy:f.fy+(t.fy-f.fy)*e, k:f.k*Math.pow(t.k/f.k,e)});
  if(p>=1) anim=null;
}
function focusNode(id){
  const n=byId[id]; if(!n) return;
  const r=svg.getBoundingClientRect();
  const [wx,wy]=P(n.x, n.y, (n.h||0.5)/2);
  const span=Math.max(70,(n.w+n.d)*S*C30);
  const k=Math.max(0.75, Math.min(2.4, Math.min(r.width,r.height)*0.5/span));
  glideTo({fx:wx, fy:wy, k});
}
let drag=null;
svg.addEventListener("pointerdown",e=>{anim=null;drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};svg.setPointerCapture(e.pointerId);svg.classList.add("drag");});
svg.addEventListener("pointermove",e=>{if(!drag)return;view.x=drag.vx+(e.clientX-drag.x);view.y=drag.vy+(e.clientY-drag.y);applyView();});
["pointerup","pointercancel"].forEach(t=>svg.addEventListener(t,()=>{drag=null;svg.classList.remove("drag");}));
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
  if(pinned&&!pin&&pinned!==id) return;
  if(pin) pinned = pinned===id ? null : id;
  current = pinned || id;
  current?renderNode(current):renderOverview(); paintIndex();
}
svg.addEventListener("mouseleave",()=>{if(!pinned){current=null;renderOverview();paintIndex();}});

const aside=document.getElementById("aside");
(function buildIndex(){
  let html="",g=null;
  NODES.forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<div class="grp${n.groupMark?" mark":""}">${esc(g)}</div>`;}
    html+=`<button class="row${n.anchor?" anchor":""}" data-id="${n.id}"><span class="key">${n.key}</span>`+
          `<span class="nm">${esc(n.name)}</span><span class="n">${n.hatch?"cull":""}</span></button>`;
  });
  aside.innerHTML=html;
  aside.querySelectorAll(".row").forEach(b=>{
    b.addEventListener("mouseenter",()=>show(b.dataset.id,false));
    b.addEventListener("click",()=>{
      show(b.dataset.id,true); focusNode(b.dataset.id);
      if(window.innerWidth<=900) aside.classList.remove("open");
    });
  });
})();
function paintIndex(){
  aside.querySelectorAll(".row").forEach(b=>b.classList.toggle("on",b.dataset.id===current));
  Object.entries(nodeEls).forEach(([id,g])=>{g.style.opacity=(current&&current!==id)?.4:1;});
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
document.getElementById("btnReset").onclick=()=>{pinned=null;current=null;renderOverview();paintIndex();glideTo(fitTarget(),820);};
document.getElementById("btnStages").onclick=()=>aside.classList.toggle("open");
document.getElementById("btnTheme").onclick=e=>{
  document.body.classList.toggle("light");
  e.target.textContent=document.body.classList.contains("light")?"Dark":"Light";
};
svg.addEventListener("click",()=>{if(pinned){pinned=null;current=null;renderOverview();paintIndex();}});
placeDots(0); fit(); last=performance.now(); requestAnimationFrame(frame);
