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
/* DELETIONS COME FIRST, because everything downstream — the lane solve, the
   edges, the index, the occlusion clip — has to be computed over what is
   actually on the map rather than over what once was. A node removed here
   never existed as far as the rest of this file is concerned. */
/* ============================================================
   WHICH MAP THIS IS. One engine, more than one map.

   This file draws /pipeline and it also draws /molecular_pipe, which is row 2
   on its own for someone to develop that section out. The two differ only in
   their data file, their saved record and their paper — so those three are the
   only things parameterised, and every one of them defaults to /pipeline's, so
   the big map keeps working with nothing set at all.

   A PAGE SETS window.MAP_CONFIG BEFORE LOADING THIS FILE. What it carries:

     ns    the localStorage namespace. NEVER share one: two maps under one
           namespace means each browser's copy of one silently overwrites the
           other's, with no way to tell which happened.
     api   the shared-record endpoint. The same rule one level up and worse,
           because that record is shared between people rather than between
           tabs. /FASTQ_pipe carries a whole paragraph about this, because
           getting it wrong is silent and costs somebody else's afternoon.
     grid  the paper. It is drawn, and it is what check-rows measures the
           drawing against, so a map a fifth the size wants a fifth the sheet.
   ============================================================ */
const MAP = (typeof MAP_CONFIG!=="undefined" && MAP_CONFIG) ? MAP_CONFIG : {};
const MAP_NS   = MAP.ns  || "pipeline";
const EDIT_API = MAP.api || "/api/pipeline_edits";
/* AND THE PROMPT QUEUE SPLITS THE SAME WAY. Edit visual posts "draw me a shape
   for this station" to a queue somebody works through on the instance. Two maps
   sharing one queue would not erase each other the way two maps sharing one
   offsets record would — it is a list, not a document — but the person working
   it could not tell which map a request came from, which is the same failure
   wearing a milder face. */
const PROMPT_API = MAP.prompts || "/api/pipeline_prompts";

const GONE=new Set();
(function readDeletions(){
  try{
    const raw=localStorage.getItem(MAP_NS+".edits");
    const o=raw ? (JSON.parse(raw).offsets||{}) : ((typeof OFFSETS!=="undefined")?OFFSETS:{});
    Object.keys(o).forEach(k=>{ if(o[k] && o[k].del) GONE.add(k); });
  }catch(err){}
})();
if(GONE.size){
  for(let i=NODES.length-1;i>=0;i--) if(GONE.has(NODES[i].id)) NODES.splice(i,1);
  const live=new Set(NODES.map(n=>n.id));
  for(let i=EDGES.length-1;i>=0;i--) if(!live.has(EDGES[i].a)||!live.has(EDGES[i].b)) EDGES.splice(i,1);
  NODES.forEach(n=>{ if(n.follow){
    if(!live.has(n.follow.a)) delete n.follow;
    else if(n.follow.b && !live.has(n.follow.b)) delete n.follow.b; } });
}

/* CARRIED-IN CLONES are expanded before anything else looks at NODES, so the
   rest of this file — the lane engine, the index, the occlusion clip, Edit
   positions — sees them as ordinary nodes and needs to know nothing about
   them. Everything except identity is taken from the source, so the two
   cannot disagree about what they are. */
if(typeof CARRIED!=="undefined") CARRIED.forEach(c=>{
  const src=NODES.find(n=>n.id===c.carried);
  if(!src) return;
  const n=Object.assign({},src,c);
  n.id=c.id; n.follow=undefined; n.gap=undefined;
  /* it is a restatement, not a stage, so it is not in the sequence the arrow
     keys walk and not in the index — both of those are the reading order, and
     reading the same object twice is not a step */
  n.skipIndex=true;
  NODES.push(n);
});

const byId={}; NODES.forEach(n=>byId[n.id]=n);
layoutRows(NODES, LANES, MIRROR);

/* ============================================================
   EDITS
   Two committed tables live in the data file — OFFSETS for fine positioning
   on top of the lane engine, TEXT for wording. Anything changed in the page's
   own edit modes is held under one local-storage key and WINS OVER the
   committed tables while it is being tuned, so the two never stack: once a
   session has been baked back into the file the local copy is identical to it
   and clearing it changes nothing.
   ============================================================ */
const EDIT_KEY=MAP_NS+".edits";
const BAKED = (typeof OFFSETS!=="undefined") ? OFFSETS : {};
const BAKED_TEXT = (typeof TEXT!=="undefined") ? TEXT : {};
const EDITS = (()=>{
  const base={offsets:BAKED, text:BAKED_TEXT};
  try{
    const s=localStorage.getItem(EDIT_KEY);
    if(s){ const j=JSON.parse(s); return {offsets:j.offsets||{}, text:j.text||{}, at:j.at}; }
    /* the first cut of this tool stored positions alone under its own key */
    const old=localStorage.getItem(MAP_NS+".offsets");
    if(old) return {offsets:JSON.parse(old), text:BAKED_TEXT};
  }catch(err){}
  return base;
})();
const LIVE = EDITS.offsets||{};
const LIVE_TEXT = EDITS.text||{};

/* wording overrides land on the data objects before anything is drawn, so the
   map, the index, the strip and the reader all pick them up for free */
Object.entries(LIVE_TEXT.nodes||{}).forEach(([id,f])=>{ if(byId[id]) Object.assign(byId[id],f); });
Object.entries(LIVE_TEXT.bands||{}).forEach(([i,v])=>{ if(BANDS[i]) BANDS[i].name=v; });
Object.entries(LIVE_TEXT.overview||{}).forEach(([k,v])=>{ OVERVIEW[k]=v; });

NODES.forEach(n=>{
  const o=LIVE[n.id];
  if(o){
    n.x+=o.dx||0; n.y+=o.dy||0;
    /* AND ITS SIZE. An object can be resized in the editor now, so w/d/h are
       part of the saved arrangement exactly as x and y are. */
    if(o.dw) n.w=Math.max(0.05,(n.w||0)+o.dw);
    if(o.dd) n.d=Math.max(0.05,(n.d||0)+o.dd);
    if(o.dh) n.h=Math.max(0.01,(n.h||0)+o.dh);
    if(o.ldx||o.ldy) n.lab={dx:((n.lab&&n.lab.dx)||0)+(o.ldx||0),
                            dy:((n.lab&&n.lab.dy)||0)+(o.ldy||0)};
  }
  /* where this node was actually drawn, and how far it has been dragged since */
  n._px=n.x; n._py=n.y; n._lx=0; n._ly=0;
  n._pw=n.w; n._pd=n.d; n._ph=n.h;
});

/* SCENERY SPANS OTHER OBJECTS, so it is resolved after they have settled: the
   attrition band has to reach the buildings where they actually ended up.

   Its BASE, though, is the lane's own answer — `_px` on the building it starts
   from, not that building's current x. The band's span is derived from the
   buildings it covers, and deriving its base from them too makes the base a
   function of the very table being applied: drag the first matrix a unit left
   and the band's zero goes with it, on top of the nudge it already carries.
   That cost /bioinformatics_pipe two builds of a Save that looked broken. Two
   different questions, two different answers.

   And its own nudge goes into its GEOMETRY, not just into r.x. Every other
   object is drawn at n.x, so a saved dx is in the picture the moment the page
   loads; this one is drawn from x0/x1/yBase, so a dx that only moved r.x
   reached the screen as a translate measured from where it was drawn — which
   is zero at load, by construction. It saved, it reloaded, it read back
   correctly, and it drew in the old place. */
NODES.filter(n=>n.shape==="attritionstaircase").forEach(r=>{
  const A=byId[r.from], B=byId[r.to];
  if(!A||!B||typeof MODEL==="undefined") return;
  if(r._yBase===undefined) r._yBase=r.yBase;
  const mx=r.x-r._px, my=r.y-r._py;
  r.x0=A.x-A.w/2-0.4+mx; r.x1=B.x+B.w/2+0.4+mx;
  r.yBase=r._yBase+my;
  r.ledger=JSON.parse(JSON.stringify(MODEL.ledger));
  /* a station whose cull has been deleted has nothing to stand under, so it
     leaves the band */
  r.ledger.steps=r.ledger.steps.filter(st=>byId[st.id]);
  r.ledger.steps.forEach(st=>{ st.x=byId[st.id].x+mx; });
});
/* every object the editors can pick up */
const plinthEls={}, labelEls={}, textEls={};

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
/* THE GRID IS THE PAPER, so it has to be bigger than everything drawn on it.
   The map has grown twice since these numbers were first set — row 3's culls
   went to 4.2 units each, then the bioinformatics row split in two — and a
   grid that stops short of the drawing reads as the drawing having fallen off
   the edge of the sheet. These bounds are deliberately generous: the fit
   camera measures the CONTENT, not the grid (see contentBox), so extending the
   paper costs nothing but the lines. */
/* THE PAPER, AND IT HAS TO REACH PAST EVERY BAND. Row 6 carries /FASTQ_pipe at
   its own size — 72 units long and reaching to y 104 — so the sheet is a good
   deal bigger than it was. A map that has outgrown its grid reads as having
   fallen off the edge of the page, and the fit camera hides it by framing the
   CONTENT: check-rows asserts these bounds against the drawing for that reason. */
const GRID = MAP.grid || {x0:-8,x1:78,y0:-8,y1:102};

(()=>{const {x0,x1,y0,y1}=GRID;
  for(let x=Math.ceil(x0);x<=x1;x++){const a=P(x,y0,0),b=P(x,y1,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
  for(let y=Math.ceil(y0);y<=y1;y++){const a=P(x0,y,0),b=P(x1,y,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
})();

/* THE COORDINATE RULER IS GONE. It was numbers along the two outer edges so
   any position could be named in the same x and y the data file is authored
   in — a working tool for whoever was placing objects by hand. Edit positions
   replaced that job: you drag a thing and the offset is written down for you,
   so nobody reads a coordinate off an edge any more. What was left was two
   long rules and forty numbers around a drawing that had outgrown them.

   `gAxis` is kept as an empty layer rather than removed, because the layer
   order is the z order and renumbering it is the kind of change that moves
   something else by accident. */

/* row bands — name runs along the band's bottom-right edge */
/* THE FOUR PADS, and each is three things that move independently.

   A band is the ground a row stands on. It was authored geometry and nothing
   else: a rectangle computed from two constants, drawn once. It is now an
   object with a position, a size and a name, and all three can be tuned in
   Edit positions like everything else on this map — because the rows they
   sit under have different lengths and different amounts of side structure
   hanging off them, and no formula gets four of those right at once.

   Its committed state lives in the same offsets table under `band:<i>`:
     dx/dy    move the whole pad
     sw/sh    grow or shrink it, from the far corner
     ldx/ldy  move its name

   `_b0` is the pad as the data file authored it, captured once, so every
   nudge is measured from one base — the same rule the buildings follow. */
const BANDEL=[];
BANDS.forEach((b,i)=>{
  const key="band:"+i;
  b._b0={x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1};
  const o=LIVE[key]||{};
  const pad=gBand.appendChild(el("polygon",{
    fill:"var(--fg)","fill-opacity":".025",stroke:"var(--fg)","stroke-opacity":".22",
    "stroke-width":"1","stroke-dasharray":"14 9"}));
  const g=gLabel.appendChild(el("g"));
  const t=el("text",{x:0,y:17,"text-anchor":"middle","font-size":"16","letter-spacing":"4",
    fill:"var(--fg3)"});
  t.textContent=b.name.toUpperCase(); g.appendChild(t);
  textEls[key]=t;

  const rec={key,b,pad,g,t,lx:o.ldx||0,ly:o.ldy||0,hide:!!o.del,
    grip:null,gripHit:null,padHit:null};
  rec.reflow=()=>{
    const c=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];
    const q=c.map(p=>P(p[0],p[1],0));
    pad.setAttribute("points",pts(q));
    if(rec.padHit) rec.padHit.setAttribute("points",pts(q));
    const [px,py]=P(b.x1+rec.lx, (b.y0+b.y1)/2+rec.ly, 0);
    g.setAttribute("transform",`translate(${px},${py}) rotate(-30)`);
    /* the resize grip sits on the far corner — the one that moves when the
       pad grows, so dragging it means what it looks like it means */
    if(rec.grip){
      const [gx,gy]=P(b.x1,b.y1,0);
      [rec.grip,rec.gripHit].forEach(e=>{ e.setAttribute("cx",gx.toFixed(1)); e.setAttribute("cy",gy.toFixed(1)); });
    }
  };
  rec.apply=nudge=>{
    const u=nudge||{};
    b.x0=b._b0.x0+(u.dx||0);            b.y0=b._b0.y0+(u.dy||0);
    b.x1=b._b0.x1+(u.dx||0)+(u.sw||0);  b.y1=b._b0.y1+(u.dy||0)+(u.sh||0);
    rec.lx=u.ldx||0; rec.ly=u.ldy||0;
    const gone=!!u.del;
    if(gone!==rec.hide){ rec.hide=gone;
      [pad,g].forEach(e=>gone?e.setAttribute("display","none"):e.removeAttribute("display")); }
    rec.reflow();
  };
  rec.apply(o);
  BANDEL.push(rec);
});
/* what a pad currently differs from its authored self by */
function bandOffset(rec){
  const b=rec.b, r=v=>Math.round(v*100)/100, out={};
  if(rec.hide) return {del:true};
  const dx=r(b.x0-b._b0.x0), dy=r(b.y0-b._b0.y0);
  const sw=r((b.x1-b._b0.x1)-dx), sh=r((b.y1-b._b0.y1)-dy);
  if(dx) out.dx=dx; if(dy) out.dy=dy;
  if(sw) out.sw=sw; if(sh) out.sh=sh;
  if(r(rec.lx)) out.ldx=r(rec.lx); if(r(rec.ly)) out.ldy=r(rec.ly);
  return out;
}

/* WHERE A NAME HANGS, IN ONE PLACE. It is derived from the node's own size —
   the far edge of the footprint, at the height the object reaches — so a
   resize has to be able to ask for it again. Computing it twice, once at build
   time and once in the editor, is how a name ends up floating off a building
   that has been made smaller. The two branches are the two the map already
   has: a landmark, which may also be flipped to its front edge with
   labelBelow, and a step. */
const LANDMARK=n=>n.anchor||n.shape==="works"||n.shape==="machine";
function labelBase(n){
  const lo=n.lab||{}, ex=n.x+(lo.dx||0);
  if(LANDMARK(n)){
    const [px,py]= n.labelBelow ? P(ex, n.y+n.d/2+(lo.dy||0), 0)
                                : P(ex, n.y-n.d/2+(lo.dy||0), topOf(n));
    return `translate(${px},${py}) rotate(-30)`;
  }
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;
  const [bx,by] = below ? P(ex, n.y+n.d/2+(lo.dy||0), n.h) : P(ex, n.y-n.d/2+(lo.dy||0), n.h);
  return `translate(${bx},${by}) rotate(-30)`;
}

/* plinths; landmark names run along the landmark's bottom-left edge */
NODES.filter(LANDMARK).forEach(n=>{
  const isA=!!n.anchor, pad=isA?0.55:0.4, hw=n.w/2+pad, hd=n.d/2+pad;
  const c=[[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],[n.x+hw,n.y+hd],[n.x-hw,n.y+hd]];
  plinthEls[n.id]=gPlinth.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
    fill:"var(--fg)","fill-opacity":isA?".05":".03",stroke:"var(--fg)",
    "stroke-opacity":isA?".4":".28","stroke-width":"1","stroke-dasharray":isA?"6 4":"2 3"}));
  /* el() writes every key it is handed, so a null lands as the string
     "null" — the opacity goes on afterwards or not at all */
  /* labelBelow moves a landmark's name off its top-back edge and onto its
     front edge, running down-left instead of up-right — for a landmark whose
     usual placement collides with whatever is above it */
  const lb = !!n.labelBelow;
  /* lab:{dx,dy} applies here exactly as it does to a step name. It did not,
     once, and a landmark's name silently snapped back to its computed place on
     every reload while the offset sat in the store looking saved. */
  const g=el("g",{transform:labelBase(n)});
  const lx = (isA?14:11) * (lb?-1:1), la = lb?"end":"start";
  const t=el("text",{x:lx,y:-3,"text-anchor":la,"font-size":isA?"20":"13",
    "letter-spacing":isA?"2.5":"1.6",fill:isA?"var(--fg)":"var(--fg2)"});
  t.textContent=n.name.toUpperCase(); g.appendChild(t); textEls[n.id+":name"]=t;
  const t2=el("text",{x:lx,y:isA?12:10,"text-anchor":la,
    "font-size":isA?"11":"9",  "letter-spacing":".8",fill:"var(--fg2)"});
  t2.textContent=n.stat; g.appendChild(t2); textEls[n.id+":stat"]=t2;
  /* THE LABEL GROUP CARRIES ITS NODE'S ID. It lives in its own layer rather
     than inside the building's group, so nothing in the DOM said which object
     a name belonged to — which meant check-text could not attribute a single
     name label and quietly tested none of them against anything. data-id is
     what it keys off; nothing else reads it. */
  g.setAttribute("data-id", n.id);
  gLabel.appendChild(g); labelEls[n.id]=g;
});

/* every step emits its name from its top-right corner, running up and to the right
   at −30°: parallel to the band titles, perpendicular to the flow of the dots */
NODES.filter(n=>!LANDMARK(n)).forEach(n=>{
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;                       // sits under its row: name goes down-left
  /* lab:{dx,dy} nudges the emission point in world units without touching the
     orientation — for a name that lands on top of something. Absent, nothing
     changes. */
  const g=el("g",{transform:labelBase(n)});
  const t=el("text",{x:below?-9:9,y:-1,"text-anchor":below?"end":"start","font-size":"8.6",
    "letter-spacing":".35",fill:"var(--fg2)"});
  t.textContent=n.key+" · "+n.name; g.appendChild(t);
  g.setAttribute("data-id", n.id);          /* see above */
  gLabel.appendChild(g);
  labelEls[n.id]=g; textEls[n.id+":name"]=t;
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
/* A TRACK RUNS WALL TO WALL, NOT CENTRE TO CENTRE.

   It was authored centre to centre, which is the obvious thing and was fine
   while every object on a row was under a unit across: the part of the track
   buried inside the two objects was short, and the occlusion clip — which
   punches every silhouette out of the edge layer — took a sliver off each end
   that nobody noticed.

   Then row 4 got 4.2-unit culls with 2.5-unit matrices beside them, and the
   arithmetic turned over: from the unfiltered matrix to the knee is 5.1 units
   of which 3.35 are inside one building or the other. Two thirds of that
   track is clipped, so the dot on it is invisible for two thirds of its
   journey and the two objects read as unconnected. The track was always
   there; you could not see it move.

   So each end is pulled back to the object's own wall before anything is
   projected. The whole of what is drawn is now in the open, and a dot is
   visible for the whole of its journey. `PORT` is the small gap left between
   the wall and the start of the line, so a track reads as arriving at a
   building rather than as growing out of it. */
const PORT=0.18;

/* AND IT NEVER TRIMS A TRACK BELOW MIN_RUN, which is the half of this that I
   left out and immediately regretted.

   Trimming to the walls is right when the two objects are far apart. When they
   are close — and most of rows 1 and 2 is objects almost touching — it takes
   the whole track away: seventeen runs went under 40px and two went to 2px.
   A dot's speed is a constant 52px per second, so `t` wraps once per 52px of
   track: on a 2px run that is TWENTY-ONE LAPS A SECOND, and two dots strobing
   in place is what the reader saw. The old centre-to-centre routing paced
   those correctly by accident, because the buried part of the track counted
   toward the length even though the clip hid it.

   So the trim has a budget: whatever is left after MIN_RUN is protected, split
   between the two ends in proportion to what each asked for. Far apart, both
   get their full step and the track runs wall to wall. Close together, the
   budget is nothing and the route is centre to centre, exactly as it was.
   MIN_RUN is 1.25 world units — about 52px, which is the shortest track this
   map had before any of this and reads as one dot crossing once a second. */
const MIN_RUN=1.25;
function trimEnds(raw, A, B){
  const leg=(n, p, q)=>{                    /* how far n would like to step out */
    const dx=q[0]-p[0], dy=q[1]-p[1];
    return Math.abs(dx)>=Math.abs(dy)
      ? {ax:0, want:(n.w||0)/2+PORT, dir:Math.sign(dx)||1}
      : {ax:1, want:(n.d||0)/2+PORT, dir:Math.sign(dy)||1};
  };
  const a=leg(A, raw[0], raw[1]);
  const b=leg(B, raw[raw.length-1], raw[raw.length-2]);
  /* the run this leg has to spend, along the axis each end steps on */
  const spanA=Math.abs(raw[1][a.ax]-raw[0][a.ax]);
  const spanB=Math.abs(raw[raw.length-2][b.ax]-raw[raw.length-1][b.ax]);
  const total=Math.min(spanA,spanB)===0 ? Math.max(spanA,spanB) : Math.min(spanA,spanB);
  const budget=Math.max(0, (a.ax===b.ax ? Math.abs(raw[raw.length-1][a.ax]-raw[0][a.ax]) : total) - MIN_RUN);
  const asked=a.want+b.want;
  const k=asked>0 ? Math.min(1, budget/asked) : 0;
  const step=(n,l,p)=>{ const q=[p[0],p[1]]; q[l.ax]+=l.dir*l.want*k; return q; };
  raw[0]=step(A,a,raw[0]);
  raw[raw.length-1]=step(B,b,raw[raw.length-1]);
  return raw;
}
function routeOf(e){
  const A=byId[e.a],B=byId[e.b], mx=(A.x+B.x)/2;

  /* ---- A PORTED EDGE LEAVES FROM A NAMED POINT, NOT FROM A CENTRE ----------
     Ported from /FASTQ_pipe with row 3's objects. The reference figures on that
     row are the largest footprints on this map, and an edge drawn from the
     centre of one spends its whole length inside the object's own occlusion
     silhouette: the line is there, the dot is travelling it, and the node reads
     as unconnected. PORTS is keyed by SHAPE — a port is a property of the
     drawing, not of the node — and answers names like "tr" and "bl", the two
     footprint edges anybody would point at under this projection.

     portB does the same at the arrival end, for the same reason one object
     further along.

     TRIMENDS IS DELIBERATELY NOT APPLIED TO A PORTED EDGE. It pulls a route
     back out of the boxes at either end, which is right for a centre-to-centre
     line and wrong for this one: a port is already ON the object's edge, so
     trimming it again lifts the line off the thing it is supposed to leave. */
  const endAt = (e.portB && typeof PORTS!=="undefined" && PORTS[B.shape])
    ? PORTS[B.shape](B,e.portB,A) : null;
  if(e.port && typeof PORTS!=="undefined" && PORTS[A.shape]){
    const p0=PORTS[A.shape](A,e.port,B);
    /* A STRAIGHT PORTED EDGE IS TWO POINTS. The lane-entry route below is for a
       track that has to join a lane; a reference line has no lane to join — it
       has to leave from somewhere visible and arrive. */
    if(e.straight) return [p0, endAt || P(B.x,B.y,0.02)];
    if(endAt) return [p0, endAt];          /* the port IS the arrival */
    const PORT_LEAD=2.0;
    return [p0, P(B.x-PORT_LEAD,B.y,0.02), P(B.x,B.y,0.02)];
  }

  /* straight:true forces a direct run even across lanes — for a fork or a
     merge, where the elbow reads as a detour rather than as routing */
  const raw = (e.straight || Math.abs(A.y-B.y)<0.05)
    ? [[A.x,A.y],[B.x,B.y]]
    : [[A.x,A.y],[mx,A.y],[mx,B.y],[B.x,B.y]];
  const pp=trimEnds(raw, A, B).map(p=>P(p[0],p[1],0.02));
  if(endAt) pp[pp.length-1]=endAt;
  return pp;
}
function paintEdge(rec){
  const host=rec.host;
  [...(host.children||[])].forEach(c=>host.removeChild(c));
  const pp=routeOf(rec);
  const faint = rec.kind==="drop"||rec.kind==="score";
  /* A TRACK IS A ROAD, NOT A HIGHLIGHT. It is the most repeated mark on the
     map — forty-seven of them — so anything it has that it does not need is
     paid for forty-seven times. Thinner and greyer than the objects it joins,
     so the eye reads the buildings first and the wiring second; the dots on
     it carry the signal colour and are the thing meant to be noticed. */
  /* AND A TRACK MAY NAME ITS OWN INK. `tone` came across with row 3, where the
     reference edges are drawn in a neutral grey that is neither read's colour —
     the material owns the accents and nothing else on that row may borrow them.
     A toned track is also drawn a shade heavier and brighter than the default:
     it is naming itself, so it should be legible as the thing it names. */
  const path=el("path",{d:"M "+pp.map(p=>p.join(" ")).join(" L "),fill:"none",
    stroke:rec.tone||"var(--fg3)",
    "stroke-width":faint?".7":(rec.tone?"1.1":".9"),
    "stroke-opacity":faint?".3":(rec.tone?".62":".5")});
  if(rec.dash) path.setAttribute("stroke-dasharray","5 4");
  host.appendChild(path);
  /* the corner marks go with the track they belong to */
  pp.slice(1,-1).forEach(c=>host.appendChild(el("rect",
    {x:c[0]-1.7,y:c[1]-1.7,width:3.4,height:3.4,transform:`rotate(45 ${c[0]} ${c[1]})`,
     fill:rec.tone||"var(--fg3)","fill-opacity":".45"})));
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

const nodeEls={};
NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(n=>{
  const g=el("g",{tabindex:"0",role:"button","aria-label":n.name});
  g.style.cursor="pointer";
  /* Scenery spans a whole row and is painted after some of what stands on it,
     so without this it swallows their clicks and their drags. It is still in
     the index and still selectable from there. */
  if(n.scenery) g.style.pointerEvents="none";
  /* A CARRIED-IN CLONE IS DRAWN AT FULL WEIGHT. It was faded once, on the
     reasoning that a restatement should not be mistaken for a second object —
     and faded, it stopped reading as an object at all: the track leaving it
     and the dots on that track looked like they came from nowhere, because the
     thing they came from was a ghost. An object a row inherits is the most
     solid thing on that row, not the least.

     What says it is a restatement is where it sits and what the reader says
     about it, not how faint it is. See renderNode. */
  /* WHAT THIS NODE'S SHAPE REGISTERED. A resize redraws the shape, and a
     redraw that cannot say which tickers were its own leaves the old one
     running over elements that have been thrown away. */
  const t0=TICKERS.length;
  DRAW[n.shape](g,n);
  groundLoose(g,n);
  n._ticks=TICKERS.slice(t0);
  if(!TOUCH){
    g.addEventListener("mouseenter",()=>{ if(!editing) show(n.id,false); });
    g.addEventListener("mouseleave",()=>{ if(!editing) unhover(); });
  }
  g.addEventListener("focus",()=>{ if(!editing) show(n.id,false); });
  g.addEventListener("blur",()=>{ if(!editing) unhover(); });
  g.addEventListener("click",ev=>{ev.stopPropagation(); if(!editing) show(n.id,true);});
  gNode.appendChild(g); nodeEls[n.id]=g;
});

/* Committed nudges and deletions for the floating annotations. They are keyed
   "<node>:<which>" and live in the same table as the objects, because they are
   the same kind of thing: a hand-placed position that has to survive the row
   being re-spaced. Applied here rather than in the shape, because the shape
   has already drawn by now. */
if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
  const o=LIVE[a.key];
  if(o && o.del){ a.hide=true; [a.line,a.dot,a.t1,a.box,a.hit]
    .forEach(e=>e&&e.setAttribute("display","none")); return; }
  if(o){ a.off.dx=o.adx||0; a.off.dy=o.ady||0; a.reflow(); }
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
  /* THE OUTLINE OF A BOX IS A HEXAGON, AND ITS VERTICAL SIDES ARE AT THE LEFT
     AND RIGHT CORNERS — not at the near and far ones.

     This went far-top, right-top, NEAR-top, near-bottom, left-bottom,
     FAR-bottom. On a square footprint the near and far corners share a screen
     x, so two of those edges are the same vertical line travelled in opposite
     directions: the outline crosses itself and the region between cancels out.
     A box a unit or so tall hides it in a few pixels; a tall one draws as a bow
     tie with a hole through the middle — and that hole is the occlusion clip
     and the drag handle both. Nothing on this map was tall enough to show it
     until a picked object could be resized.

     Far top, right top, right bottom, near bottom, left bottom, LEFT TOP. The
     last point is (-hw, +hd) and not (-hw, -hd): written with -hd it repeats
     the first and the outline closes from the bottom-left back to the far
     corner, slicing the top-left off the shape. Square, the slice is small
     enough that the middle of the top face is still inside it; give a node a w
     far from its d and that middle falls outside and its clicks go through to
     the canvas. Convex at any height and any aspect. */
  return [P(n.x-hw,n.y-hd,h), P(n.x+hw,n.y-hd,h), P(n.x+hw,n.y-hd,0),
          P(n.x+hw,n.y+hd,0), P(n.x-hw,n.y+hd,0), P(n.x-hw,n.y+hd,h)];
};
const clipPathEl=el("path",{"clip-rule":"evenodd"});
function rebuildClip(){
  const R=40000;
  let d=`M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`;
  /* SCENERY IS PAINTED ON THE GROUND, so punching it out of the clip would
     erase every track and dot that crosses it — which on the attrition band
     is most of row 4. It is a floor, not a building.

     AND noclip IS FOR AN OBJECT THAT IS NOT A SOLID AT ALL — ported from
     /FASTQ_pipe with row 3. The fragment glyph is a flat diagram floating in
     the air; the reference figures are flat cards. A track passing under one
     should be visible passing under it, and the tracks that leave a node's own
     ends have to be visible from those ends. Punch the box out of the clip and
     they disappear at the edge of a solid that is not there. Such a node is
     still painted after gEdge, so a line genuinely behind the card is still
     hidden by the card itself — which is the honest occluder. */
  NODES.filter(n=>!n.scenery && !n.noclip)
       .forEach(n=>{ d+=" M "+nodeSil(n).map(p=>p.join(" ")).join(" L ")+" Z"; });
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
/* HOW FAST A DOT GOES, AND HOW MANY ARE ON A TRACK.

   Both numbers are here rather than inline because they are the two halves of
   one thing: how often a dot passes any given point. Two dots at 52px/s and
   one dot at 35px/s are different maps to sit in front of — the first reads as
   traffic, the second as material moving through a plant.

   SPEED is in pixels of track per second and is the same on every track, which
   is what makes a long run take longer to cross than a short one. It is not
   "cross this track in N seconds": that would make a dot on a short hop crawl
   and a dot on a long one race, and the length of a track would stop meaning
   anything.

   COUNT is per track. Halving it halves both the number of dots on screen and
   how often one passes a point, because they are evenly spaced around the
   loop — the two are the same knob. A track already down to one dot stays at
   one: below that there is no dot, and the dots are the only thing on this map
   that show direction. */
const DOT_PX_PER_S=35, DOT_PX_PER_S_FAINT=17;
const DOTS_PER_TRACK=1;

const DOTS=[];
edgeGeom.forEach(e=>{
  const faint = e.kind==="drop"||e.kind==="score";
  const count = (faint||e.carry)?1:DOTS_PER_TRACK;
  for(let i=0;i<count;i++){
    const g=el("g"); g.style.cursor="pointer";
    /* THE HIT TARGET DOES NOT SHRINK WITH THE DOT. The mark is 1.75px and a
       1.75px target cannot be hit by a hand on a moving object; the invisible
       circle round it is what makes a dot clickable at all, and it is sized
       for a finger rather than for the drawing. */
    g.appendChild(el("circle",{r:"10",fill:"transparent"}));
    /* dotTone is separate from tone so a track can be quiet and its dots not.
       A reference edge on row 3 is grey because it is not carrying material,
       but the thing moving along it still has to read as a thing moving. */
    g.appendChild(el("circle",{r:faint?1.5:1.75,
      fill:e.dotTone||e.tone||(faint?"var(--drop)":"var(--signal)"),
      stroke:"var(--stroke)","stroke-width":".5"}));
    gDot.appendChild(g);
    const rec={e,t:(i/count)+Math.random()*0.1,
               speed:(faint?DOT_PX_PER_S_FAINT:DOT_PX_PER_S)/e.len,node:g};
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
   The map used to read this preference once, at load, into a variable nothing
   could ever set back — the Pause control that could have was dropped from the
   toolbar when the header became a strip. Anyone whose browser answers "reduce"
   therefore got a map that draws, lists, highlights and edits perfectly and
   never moves again, with nothing on the page saying why or offering a way
   back. And the answer is not fixed for the life of a machine: a laptop
   entering battery saver flips it mid-session on several browsers, which is
   exactly the "frozen every other refresh" this is being written for.

   So: the system preference is the DEFAULT, not the verdict. It is re-read
   whenever it changes, a person can override it either way, and the override
   is remembered. Motion off is a state the page admits to rather than a state
   it sits in silently.
   ============================================================ */
const MOTION_KEY=MAP_NS+".motion";
const mqReduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)"))
              || {matches:false};
let motionChoice=null; try{ motionChoice=localStorage.getItem(MOTION_KEY); }catch(err){}
let onMotion=null;                       // the toolbar button follows this
let playing = motionChoice ? motionChoice==="on" : !mqReduce.matches;
function setMotion(on,remember){
  playing=!!on;
  if(remember){
    motionChoice = on?"on":"off";
    try{ localStorage.setItem(MOTION_KEY,motionChoice); }catch(err){}
  }
  if(onMotion) onMotion();
}
if(mqReduce.addEventListener)
  mqReduce.addEventListener("change",()=>{ if(!motionChoice) setMotion(!mqReduce.matches,false); });
else if(mqReduce.addListener)
  mqReduce.addListener(()=>{ if(!motionChoice) setMotion(!mqReduce.matches,false); });

let last=performance.now();
/* below this the map is a thumbnail and motion is not legible anyway. The
   manual zoom floor is 0.15, so in practice this only bites on a fit view in a
   very small window. */
const MOTION_MIN=0.10;
/* Everything shape-authored that moves runs from here. The zoom gate is
   central: each shape ships its own `if(k<0.7) return`, written when the map
   was a third of its present size — at today's extent the whole map fits at
   k≈0.4 on a desktop and 0.12 on a phone, so every one of those gates was
   firing at the DEFAULT view and the map arrived frozen. Handing the tickers a
   value that never trips their own test moves the decision here, to one number.

   A ticker that throws is dropped rather than allowed to take the frame with
   it. One shape going wrong should cost that shape, not the whole map. */
const DROPPED=[];
function runTickers(dt,now){
  for(let i=0;i<TICKERS.length;i++){
    try{ TICKERS[i](dt,now,1); }
    catch(err){
      console.error(`pipeline: a shape's animation threw and was dropped — the map keeps running.`,err);
      /* WHAT IT DIED ON, not just that it died. A ticker's inputs are dt, now
         and the motion factor, and a shape that throws on frame 1 with a NaN dt
         is a different bug from one that throws on frame 900 with good inputs.
         Without these three the only evidence was a message and a line number,
         and the first diagnosis off that evidence was wrong. */
      DROPPED.push({i,err:String((err&&err.message)||err),dt,now,frames});
      TICKERS.splice(i,1); i--;
    }
  }
}
/* started at the end of the file, once the camera exists */
let frames=0, lastErr=null;
function frame(now){
  /* dt IS CLAMPED AT ZERO, AND THAT IS NOT BELT AND BRACES.

     requestAnimationFrame hands the callback the timestamp of the START OF THE
     FRAME, and that instant can PRECEDE the performance.now() captured when the
     loop was armed a moment earlier. So on the first frame `now - last` is
     sometimes negative — about -5ms, on maybe one load in three.

     A negative dt is not a small error, it is a sign error, and JS's % keeps
     the sign of its dividend: a shape that advances `t=(t+dt)%LOOP` from zero
     lands on t = -0.005, and Math.floor(-0.0005) is -1, so an index derived
     from it is -1 rather than 0. bay[-1] is undefined, the ticker throws on
     frame 1, and runTickers drops it — which is why the sequencer and the thaw
     would simply never start on roughly every fourth refresh while everything
     else on the map animated normally.

     Clamping here fixes every shape at once and is the honest place for it:
     time does not run backwards, so a negative dt means the clock reference is
     wrong, not that the animation should rewind. */
  const dt=Math.max(0,Math.min((now-last)/1000,.05)); last=now; frames++;
  /* NOTHING in here may stop the loop being scheduled again. A throw used to
     end the animation for the rest of the session, which is indistinguishable
     from a frozen map and impossible to get back without a refresh. */
  try{
    stepCamera(now);
    placeDots(playing?dt:0);
    /* the ✕ rides the camera, so it stays on its object through a pan or a
       zoom rather than sliding off it */
    if(editing && window.placeDeleteX) window.placeDeleteX();
    if(playing && view.k >= MOTION_MIN) runTickers(dt,now);
  }catch(err){
    if(!lastErr) console.error("pipeline: a frame threw — the loop keeps running.",err);
    lastErr=err;
  }
  requestAnimationFrame(frame);
}
/* one line to paste back when the map looks stuck */
window.pipelineDiag=()=>({
  moving: playing && view.k>=MOTION_MIN,
  playing, choice:motionChoice||"(system)", systemAsksForReduce:!!mqReduce.matches,
  zoom:+(view.k||0).toFixed(3), motionFloor:MOTION_MIN,
  frames, dots:DOTS.length, tickers:TICKERS.length, droppedTickers:DROPPED.length,
  lastError:lastErr?String(lastErr.message||lastErr):null
});

/* ============================================================
   PAN AND ZOOM
   ============================================================ */
let view={k:1,x:0,y:0}, anim=null;
const applyView=()=>world.setAttribute("transform",`translate(${view.x},${view.y}) scale(${view.k})`);
const centre=()=>{const r=svg.getBoundingClientRect();return [r.width/2,r.height/2];};

/* FIT THE DRAWING, NOT THE SHEET.

   world.getBBox() includes the ground grid and the coordinate ruler, and both
   deliberately run wider than the map — the grid is graph paper, and the ruler
   sits outside it by design. Fitting to that box parked the whole four-row
   sequence in the middle of the canvas at roughly half the zoom it deserved,
   which is what "why does it open zoomed out" means. The bands, the buildings
   and their names are the map; everything else is the paper it is drawn on. */
function contentBox(){
  const bs=[gBand,gNode,gLabel].map(g=>g.getBBox()).filter(b=>b.width||b.height);
  if(!bs.length) return world.getBBox();
  const x0=Math.min(...bs.map(b=>b.x)),          y0=Math.min(...bs.map(b=>b.y));
  const x1=Math.max(...bs.map(b=>b.x+b.width)),  y1=Math.max(...bs.map(b=>b.y+b.height));
  return {x:x0,y:y0,width:x1-x0,height:y1-y0};
}
function fitTarget(){
  const bb=contentBox(), r=svg.getBoundingClientRect();
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

/* The pan deliberately does NOT take pointer capture. Capturing on the <svg>
   root routes the click that ends the gesture to the root as well, so every
   listener on an SVG child — pin a node, inspect a dot, open a name for
   editing — silently never fires. Tracking the gesture on the window instead
   keeps panning working past the edge of the canvas and leaves clicks alone. */
svg.addEventListener("pointerdown",e=>{
  anim=null; moved=0;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2) startPinch(); else startDrag();
});
window.addEventListener("pointermove",e=>{
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
let revealReader=()=>{}, restoreReader=()=>{}, keepReader=()=>{};

let pinned=null, current=null;
const esc=s=>s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

const TF=(id,f)=>`data-tid="${id}" data-tf="${f}"`;
function renderOverview(){
  const o=OVERVIEW, O="__overview__";
  read.innerHTML=`<div class="eyebrow" ${TF(O,"eyebrow")}>${o.eyebrow}</div>`+
    `<div class="title big" ${TF(O,"title")}>${o.title}</div>`+
    `<div class="sub" ${TF(O,"sub")}>${o.sub}</div>`+
    `<h4>The story</h4><div ${TF(O,"does")}>${o.does}</div>`+
    `<h4>How to read it</h4>`+
    /* A MAP MAY SAY ITS OWN. This paragraph counts landmarks and names the
       one fading line, and both are facts about /pipeline rather than about
       the engine — /molecular_pipe has one landmark and no fade. Absent, the
       big map's own wording stands, so nothing changes for it. */
    (o.howto || `<p>Eight landmarks sit on dashed plinths and carry their names on the ground. Hatching means the stage destroys data. The one line that fades to nothing is at the very end, past the handoff, where this map stops being the right way to look at it.</p>`);
}
/* ------------------------------------------------------------------
   THE COPY PAYLOAD

   A node may carry `copy:"<element id>"`, naming a <script type="text/plain">
   block in index.html. If that block is present the reader grows a button
   that puts its contents on the clipboard.

   The payload lives in the HTML rather than in a JS string because the thing
   it holds is source code — backticks, ${...}, the lot — and escaping several
   hundred lines of that into a template literal is a bug waiting to happen.
   textContent returns it byte for byte. It is regenerated from the real
   source by sync-copy-payload.mjs; never hand-edit it.
   ------------------------------------------------------------------ */
function copyBlock(n){
  if(!n.copy) return "";
  const src=document.getElementById(n.copy);
  if(!src) return "";                       // payload absent: no dead button
  const kb=Math.round(src.textContent.length/1024);
  return `<button class="copybtn" data-copy="${n.copy}">`+
         `<span class="ic"></span><span class="tx">${esc(n.copyLabel||"Copy the source")}</span>`+
         `<span class="sz">${kb} KB</span></button>`;
}

/* THE ARITHMETIC BEHIND A ROOF, and the word that has to travel with it.

   Four culls on row 3 carry their decision on their own roof, and every
   threshold drawn there is MODELLED — computed from a simulated population
   that matches the worked example's shape, not read off an artefact. A
   modelled figure that has lost that word is a figure claiming a result
   nobody produced, so the reader states it before the numbers rather than
   after them. FIGURES comes from /culls/culls-draw.js, keyed by shape.

   Every other node on this map is unaffected: no FIGURES entry, no block. */
function roofFigures(n){
  const mk = typeof FIGURES!=="undefined" && FIGURES[n.shape];
  if(!mk) return "";
  const f=mk();
  return `<h4>What the roof shows</h4>`+
    (n.modelled?`<div class="unver">modelled, not measured</div>`:"")+
    `<div class="figure">${esc(f.head)}</div>`+
    f.rows.map(([k,v])=>`<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`).join("")+
    (f.real?`<dl class="kv"><dt>${esc(f.real[0])}</dt><dd>${esc(f.real[1])}</dd></dl>`:"")+
    (n.pipelineName?`<p class="note">Drawn here as one policy. This map's own name for the `+
      `stage — which has to cover every policy the corpus uses for it — is `+
      `<mark>${esc(n.pipelineName)}</mark>.</p>`:"");
}

function renderNode(id){
  const n=byId[id];
  /* A CLONE SENDS THE READER TO THE ORIGINAL, with one line saying why it is
     here twice. It holds no prose of its own — see CARRIED in the data file —
     so there is one place to change any of it and no way for the two to
     disagree. */
  if(n.carried){
    const src=byId[n.carried];
    read.innerHTML=
      `<div class="eyebrow">${esc(n.group)}</div>`+
      `<div class="title big">${esc(n.name)}</div>`+
      `<div class="sub">${esc(n.sub||"")}</div>`+
      `<p class="note">Drawn again at the start of this row. It is the same object `+
      `the row above ends with, not a second one — nothing is drawn between rows, `+
      `so each row opens with what it inherits.</p>`+
      (src?`<h4>What it does</h4><p>${src.does}</p>`:"")+
      `<dl class="kv"><dt>Feeds</dt><dd>${EDGES.filter(e=>e.a===id).map(e=>byId[e.b]&&byId[e.b].name).filter(Boolean).join(", ")||"—"}</dd></dl>`;
    return;
  }
  read.innerHTML=`<div class="eyebrow" ${TF(id,"group")}>${esc(n.group)}${n.tier?" · "+n.tier+" tier":""}</div>`+
    `<div class="title${n.anchor?" big":""}" ${TF(id,"name")}>${esc(n.name)}</div>`+
    `<div class="sub" ${TF(id,"sub")}>${esc(n.sub)}</div>`+
    (UNVERIFIED.has(n.key)?`<div class="unver">unverified with Patrick</div>`:"")+
    `<h4>What it does</h4><p ${TF(id,"does")}>${n.does}</p>`+
    roofFigures(n)+
    `<dl class="kv"><dt>Feeds</dt><dd>${EDGES.filter(e=>e.a===id).map(e=>byId[e.b].name).join(", ")||"—"}</dd></dl>`+
    `<dl class="kv"><dt>Fed by</dt><dd>${EDGES.filter(e=>e.b===id).map(e=>byId[e.a].name).join(", ")||"—"}</dd></dl>`+
    copyBlock(n);
}

/* Delegated, because renderNode replaces read.innerHTML wholesale and a
   handler bound to the button would go with it on the next hover. */
read.addEventListener("click", async e=>{
  const b=e.target.closest(".copybtn");
  if(!b) return;
  const src=document.getElementById(b.dataset.copy);
  if(!src) return;
  /* the <script> block's own leading newline is not part of the payload */
  const text=src.textContent.replace(/^\n+/,"").replace(/\n*$/,"\n");
  let ok=false;
  try{
    /* The async clipboard API needs a secure context AND permission, and
       fails on http:// and inside some embeds. The textarea+execCommand path
       is deprecated and still the only thing that works everywhere, so it
       stays as the fallback rather than as the primary. */
    await navigator.clipboard.writeText(text); ok=true;
  }catch(_){
    try{
      const ta=document.createElement("textarea");
      ta.value=text;
      ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0,text.length);
      ok=document.execCommand("copy");
      document.body.removeChild(ta);
    }catch(__){ ok=false; }
  }
  const tx=b.querySelector(".tx"), was=tx.textContent;
  tx.textContent = ok ? "Copied to clipboard" : "Press Ctrl+C / Cmd+C";
  b.classList.toggle("done", ok);
  if(!ok){                                   /* leave it selected to copy by hand */
    const r=document.createRange(); r.selectNodeContents(src);
    src.style.cssText="position:fixed;left:-9999px;white-space:pre";
    const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  setTimeout(()=>{ tx.textContent=was; b.classList.remove("done"); }, 2200);
});
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
  /* a hover is a preview and does not disturb the columns; only a click,
     which is the thing that means "tell me about this one" */
  if(pin){ if(pinned) revealReader(); else restoreReader(); }
}
/* Hovering is a preview and nothing more: the moment the pointer leaves the
   thing it was over, the map goes back to nothing selected. Only a click pins,
   and only a click on empty space or on the pinned item releases it. */
function unhover(){ if(pinned) return; current=null; renderOverview(); paintIndex(); }
function release(){ pinned=null; current=null; renderOverview(); paintIndex(); restoreReader(); }
svg.addEventListener("mouseleave",unhover);

const aside=document.getElementById("aside");
(function buildIndex(){
  let html="",g=null;
  /* the index is the READING ORDER, and reading the same object twice is not
     a step — a carried-in clone is a restatement, so it is not listed */
  NODES.filter(n=>!n.skipIndex).forEach(n=>{
    if(n.group!==g){g=n.group;html+=`<div class="grp${n.groupMark?" mark":""}">${esc(g)}</div>`;}
    html+=`<button class="row${n.anchor?" anchor":""}" data-id="${n.id}"><span class="key">${n.key}</span>`+
          `<span class="nm">${esc(n.name)}</span>` +
          /* HATCHING MEANS THE STAGE DESTROYS DATA. Whether what it destroys is
             a CELL is what separates a cull from a drop, and the index has to
             say which: row 4 removes cells, and rows 3 and 6 remove READS —
             a quarter of them carry no valid barcode, and unmapped and
             multimapping reads go after the alignment — but no cell is removed
             on those rows at all, and their own prose says so twice. Printing
             "cull" against them was this map asserting the opposite. */
          `<span class="n">${n.hatch ? (n.drops ? "drops" : "cull") : ""}</span></button>`;
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

/* the flow runs unless the machine asks it not to — there is no longer a
   button for it, and nothing else turns it off */
/* no button for this any more — scroll and pinch do the zooming, and stepping
   through the sequence re-centres. Home is the way back to the whole map. */
const resetView=()=>{pinned=null;current=null;renderOverview();paintIndex();glideTo(fitTarget(),1100);};
document.getElementById("btnStages").onclick=()=>aside.classList.toggle("open");
/* Fit the map. Home and 0 have always done this; the button is here because a
   keyboard shortcut nobody is told about is not a control. It also clears the
   selection, so it is the one move that puts the page back to how it opened. */
{ const b=document.getElementById("btnHome"); if(b) b.onclick=resetView; }
document.getElementById("btnTheme").onclick=e=>{
  document.body.classList.toggle("light");
  e.target.textContent=document.body.classList.contains("light")?"Dark":"Light";
};
svg.addEventListener("click",()=>{ if(moved<8 && !editing) release(); });

/* ============================================================
   START THE MAP
   Deliberately before every optional feature below. A browser holding a stale
   index.html against fresh scripts will not find an element one of them wants,
   and until this line moved up here that single null took the whole tail of the
   file with it — including this loop. The symptom was a map that drew, listed
   and highlighted perfectly and then sat frozen, with the camera refusing to
   move, which reads as anything but a missing button.
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

/* Each block below is a feature, not a dependency. One that cannot find what it
   needs says so and stands down; the map and everything else keep working. */
function feature(name, fn){
  try{ fn(); }
  catch(err){
    console.error(`pipeline: "${name}" did not start — the map is fine, that feature is not.`, err);
  }
}

/* ============================================================
   THE SIDE COLUMNS
   Both are draggable shut. Drag the grip to resize, drag it far enough and
   it snaps closed, or just click it. What is left is the grip: a full-height
   sliver with an arrow pointing the way back, so a closed panel reads as
   folded away rather than as missing. Widths persist.
   ============================================================ */
feature("side columns", function(){
  const PANEL_KEY=MAP_NS+".panels";
  const root=document.body;
  const P_=[{grip:"gripL", el:aside,  varn:"--aside-w",  def:238, min:150, max:460, side:1, open:"‹", shut:"›"},
            {grip:"gripR", el:reader, varn:"--reader-w", def:352, min:220, max:620, side:-1, open:"›", shut:"‹"}];
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
      from={x:ev.clientX, w:p.w, moved:0};
    });
    p.node.addEventListener("pointermove",ev=>{
      if(!from) return;
      const d=(ev.clientX-from.x)*p.side;
      from.moved=Math.max(from.moved,Math.abs(ev.clientX-from.x));
      /* below the minimum it does not squeeze, it shuts */
      const want=from.w+d;
      p.w = want < p.min*0.6 ? 0 : Math.max(p.min, Math.min(p.max, want));
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
      ev.preventDefault();
      p.w = p.w ? 0 : p.def; apply(p); store();
    });
  });

  function apply(p){
    root.style.setProperty(p.varn, p.w+"px");
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
  /* the reader is showing something that is not a preview — a save panel, a
     payload — so it must not fold itself away on the next click elsewhere */
  keepReader=()=>{ auto=false; };

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
   order, so stepping is just moving through that array. Arrow keys on a
   desktop, two round buttons on anything — a phone has no keyboard and the
   strip is a scroll rather than a walk.
   ============================================================ */
feature("walk the sequence", function(){
const next=document.getElementById("stNext"), prev=document.getElementById("stPrev");
if(next) next.onclick=()=>stepBy(1);
if(prev) prev.onclick=()=>stepBy(-1);
window.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  /* never while something is being typed into — the text editor owns its keys */
  const t=e.target, tag=t&&t.tagName;
  if(tag==="INPUT"||tag==="TEXTAREA"||(t&&t.isContentEditable)) return;
  if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); stepBy(1); }
  else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); stepBy(-1); }
  else if(e.key==="Escape"){
    /* in Select many, Escape empties the set rather than clearing the reader:
       an accidental gather is the thing you want to undo first, and the reader
       is not showing anything in that mode anyway */
    if(window.pipelineClearChosen) window.pipelineClearChosen();
    release();
  }
  else if(e.key==="Home"||e.key==="0"){ e.preventDefault(); resetView(); }
  /* THE MOTION ESCAPE HATCH, now that the toolbar button is gone. It matters
     for one reader in particular: somebody whose browser asks for reduced
     motion gets a still map, and without a way to turn it on they never see
     that four of the culls draw their own decision. A key is a smaller thing
     than a button in a toolbar and it keeps the door open. The hint says so
     whenever motion is off. */
  else if(e.key==="m"||e.key==="M"){ e.preventDefault(); if(setMotion) setMotion(!playing,true); }
});
});

function goTo(id){
  const n=byId[id]; if(!n) return;
  pinned=id; current=id;                       // always land on it, never toggle off
  renderNode(id); paintIndex(); focusNode(id);
}
function stepBy(d){
  /* same reason as the index: the arrow keys walk the sequence, and a
     carried-in clone is not a step in it */
  const WALK=NODES.filter(n=>!n.skipIndex);
  if(!WALK.length) return;
  /* nothing selected yet: forward starts at the first, back at the last */
  const at = current ? WALK.findIndex(n=>n.id===current) : (d>0 ? -1 : 0);
  const to = ((at+d)%WALK.length + WALK.length) % WALK.length;
  goTo(WALK[to].id);
}


/* ============================================================
   SAVING
   One store for both modes. Confirming writes it to the shared back end so it
   becomes the default for everyone; local storage always holds a copy, so an
   edit survives a refresh whether or not the back end is reachable.
   ============================================================ */
let editing=false, texting=false, setPosMode=null, setTextMode=null, dirty=false;
const r2=v=>Math.round(v*100)/100;

/* the committed table plus this session */
function totalOffset(n){
  const b=LIVE[n.id]||{}, o={};
  const dx=r2((b.dx||0)+(n.x-n._px)), dy=r2((b.dy||0)+(n.y-n._py));
  const ldx=r2((b.ldx||0)+n._lx),     ldy=r2((b.ldy||0)+n._ly);
  if(dx) o.dx=dx; if(dy) o.dy=dy; if(ldx) o.ldx=ldx; if(ldy) o.ldy=ldy;
  const dw=r2((b.dw||0)+((n.w||0)-(n._pw||0)));
  const dd=r2((b.dd||0)+((n.d||0)-(n._pd||0)));
  const dh=r2((b.dh||0)+((n.h||0)-(n._ph||0)));
  if(dw) o.dw=dw; if(dd) o.dd=dd; if(dh) o.dh=dh;
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
    if(a.hide){ out[a.key]={del:true}; return; }
    const adx=r2g(a.off.dx), ady=r2g(a.off.dy);
    if(adx||ady) out[a.key]={...(adx?{adx}:{}),...(ady?{ady}:{})};
  });
  BANDEL.forEach(rec=>{ const o=bandOffset(rec); if(Object.keys(o).length) out[rec.key]=o; });
  return out;
}
const r2g=v=>Math.round(v*100)/100;
/* Wording is recorded as it is changed rather than diffed afterwards — the
   originals are gone the moment an override is applied on load, so there is
   nothing left to diff against. Seeded with whatever was already in force. */
const SESSION_TEXT={ nodes:JSON.parse(JSON.stringify(LIVE_TEXT.nodes||{})),
                     bands:JSON.parse(JSON.stringify(LIVE_TEXT.bands||{})),
                     overview:JSON.parse(JSON.stringify(LIVE_TEXT.overview||{})) };
/* WHAT THIS SITTING ACTUALLY CHANGED, as opposed to what it merely holds.
   SESSION_TEXT is seeded with everything already in force, so it cannot tell
   the two apart — and the difference is the whole of the merge on the way out:
   only a field somebody typed in this browser is allowed to land on top of the
   shared copy. Everything else defers to whatever is there when we write. */
const TOUCHED={ nodes:{}, bands:{}, overview:{} };
/* an object counts as moved here only if it has left where it was drawn */
const movedHere = n => !!(n && ((n.x-n._px) || (n.y-n._py) || n._lx || n._ly));
/* objects whose local nudge was never published — see seedUnpublished */
const HELD={};
const ours = n => movedHere(n) || !!HELD[n.id];
/* an annotation or a deletion is ours the moment this sitting touched it */
const OURKEYS=new Set();
/* Work this browser is holding that the shared copy has never seen. It arrives
   from local storage as part of the state the page loads with, so it is
   indistinguishable from everything else in force until the shared copy is
   read — at which point whatever DIFFERS is, by definition, ours and unsent.
   Marking it touched is what keeps a change made before a refresh from being
   quietly dropped by the merge on the next save. Fields we hold identical to
   the shared copy stay untouched, so somebody else editing them later still
   wins. */
const differs=(a,b)=>JSON.stringify(a===undefined?null:a)!==JSON.stringify(b===undefined?null:b);
function seedUnpublished(doc){
  const rt=doc.text||{}, ro=doc.offsets||{};
  Object.entries(SESSION_TEXT.nodes).forEach(([id,f])=>Object.entries(f).forEach(([k,v])=>{
    if(differs(v,((rt.nodes||{})[id]||{})[k])) (TOUCHED.nodes[id]=TOUCHED.nodes[id]||{})[k]=1; }));
  Object.entries(SESSION_TEXT.bands).forEach(([i,v])=>{
    if(differs(v,(rt.bands||{})[i])) TOUCHED.bands[i]=1; });
  Object.entries(SESSION_TEXT.overview).forEach(([k,v])=>{
    if(differs(v,(rt.overview||{})[k])) TOUCHED.overview[k]=1; });
  Object.keys(LIVE).forEach(id=>{ if(differs(LIVE[id],ro[id])) HELD[id]=1; });
}
function recordText(scope,key,field,value){
  if(scope==="band"){ SESSION_TEXT.bands[key]=value; TOUCHED.bands[key]=1; }
  else if(scope==="overview"){ SESSION_TEXT.overview[field]=value; TOUCHED.overview[field]=1; }
  else { (SESSION_TEXT.nodes[key]=SESSION_TEXT.nodes[key]||{})[field]=value;
         (TOUCHED.nodes[key]=TOUCHED.nodes[key]||{})[field]=1; }
}
function collectText(){
  const out={};
  ["nodes","bands","overview"].forEach(k=>{
    if(Object.keys(SESSION_TEXT[k]).length) out[k]=SESSION_TEXT[k];
  });
  return out;
}
function payload(){ return {offsets:collectOffsets(), text:collectText()}; }
function stash(){
  try{ localStorage.setItem(EDIT_KEY,JSON.stringify({...payload(),at:Date.now()})); }catch(err){}
}
function markDirty(){ dirty=true; stash(); syncSaveBar(); }
/* take the shared copy's own timestamp after a successful write, so the next
   load does not read its own save as somebody else's and reload over it */
function adoptStamp(at){
  if(!at) return;
  try{ const j=JSON.parse(localStorage.getItem(EDIT_KEY)||"{}");
       j.at=at; localStorage.setItem(EDIT_KEY,JSON.stringify(j)); }catch(err){}
}
function syncSaveBar(){
  const on = editing || texting || dirty;
  document.body.classList.toggle("haschanges", on);
}
/* a short confirmation, in the corner of the map */
const toastEl=document.getElementById("toast");
let toastT=null;
function toast(msg,warn,ms){
  if(!toastEl) return;
  /* LIFT IT OVER WHATEVER IS ALREADY AT THE BOTTOM. The queue rows and the
     new-version bar sit in the same corner of the same box, and both change
     height — a row per request, wrapping to two or three lines each. A fixed
     offset clears one of those situations and not the others, so the offset is
     measured off the things themselves, every time the toast is raised. */
  try{
    let lift=0;
    for(const sel of ["#works",".newver.on"]){
      const e=document.querySelector(sel);
      if(!e) continue;
      const r=e.getBoundingClientRect();
      if(r.height>0) lift=Math.max(lift, r.height+10);
    }
    toastEl.style.setProperty("--toast-lift", lift+"px");
  }catch(err){}
  toastEl.textContent=msg;
  toastEl.classList.toggle("warn",!!warn);
  toastEl.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove("on"), ms||3400);
}
/* what to say when the save landed on top of somebody else's work rather than
   over it — the count is fields of theirs this write carried through unharmed */
function mergeNote(msg,res){
  if(!res || !res.kept) return msg;
  return msg + ` Someone else saved ${res.kept} change${res.kept===1?"":"s"} while you `
       + `were working — kept, not overwritten. Refresh to see them.`;
}

/* the shared back end. A read failure is silent — the map falls back to the
   tables baked into the data file. A write failure is not: the whole point of
   Confirm is being told whether it stuck. No key: this is a preview space, and
   Confirm is meant to be one click.

   TWO PEOPLE EDIT THIS MAP AT ONCE, so a save is a merge, never a replacement.
   The record is one document and the write is a whole-document Put, which used
   to mean the second person to press Save silently flattened the first. Now
   every save reads the shared copy first and lays only the fields THIS sitting
   touched on top of it. Somebody else's rename of a different step, or drag of
   a different object, survives our write untouched — and if it was the same
   field, the later save wins, which is the only sane answer for one field.

   A read failure aborts the write. Keeping a change in this browser is
   recoverable — it is still in local storage and still on screen — while
   overwriting somebody else's sitting is not. */
function mergeOnto(doc){
  const mine=payload();
  const rt=doc.text||{};
  const out={ offsets:{...(doc.offsets||{})},
              text:{ nodes:{...(rt.nodes||{})}, bands:{...(rt.bands||{})},
                     overview:{...(rt.overview||{})} } };
  /* how much of theirs a blind write would have thrown away */
  const same=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
  let kept=0;
  Object.entries(out.offsets).forEach(([id,o])=>{
    if(!ours(byId[id]||{id}) && !same(o,(mine.offsets||{})[id])) kept++; });
  const mt=mine.text||{};
  Object.entries(out.text.nodes).forEach(([id,f])=>Object.entries(f).forEach(([k,v])=>{
    if(!(TOUCHED.nodes[id]&&TOUCHED.nodes[id][k]) && !same(v,((mt.nodes||{})[id]||{})[k])) kept++; }));
  Object.entries(out.text.bands).forEach(([i,v])=>{
    if(!TOUCHED.bands[i] && !same(v,(mt.bands||{})[i])) kept++; });
  Object.entries(out.text.overview).forEach(([k,v])=>{
    if(!TOUCHED.overview[k] && !same(v,(mt.overview||{})[k])) kept++; });
  /* now ours, and only the parts of ours somebody actually authored here */
  NODES.forEach(n=>{
    if(!ours(n)) return;
    const o=(mine.offsets||{})[n.id];
    if(o) out.offsets[n.id]=o; else delete out.offsets[n.id];
  });
  /* deletions and annotation nudges are keyed by things that are not nodes —
     a deleted id is gone from NODES, and an annotation key is "<node>:<which>"
     — so the walk above cannot reach them. Anything this sitting touched
     wins; anything it did not is left exactly as the record has it. */
  OURKEYS.forEach(k=>{
    const o=(mine.offsets||{})[k];
    if(o) out.offsets[k]=o; else delete out.offsets[k];
  });
  GONE.forEach(k=>{ out.offsets[k]={del:true}; });
  Object.entries(TOUCHED.nodes).forEach(([id,fs])=>Object.keys(fs).forEach(f=>{
    (out.text.nodes[id]=out.text.nodes[id]||{})[f]=SESSION_TEXT.nodes[id][f]; }));
  Object.keys(TOUCHED.bands).forEach(i=>{ out.text.bands[i]=SESSION_TEXT.bands[i]; });
  Object.keys(TOUCHED.overview).forEach(f=>{ out.text.overview[f]=SESSION_TEXT.overview[f]; });
  ["nodes","bands","overview"].forEach(k=>{ if(!Object.keys(out.text[k]).length) delete out.text[k]; });
  return {body:out, kept};
}
/* after a merged write this browser is behind the store by whatever it just
   inherited, so keep the merged document rather than our half of it */
function adoptMerged(body,at){
  try{ localStorage.setItem(EDIT_KEY,JSON.stringify(
    {offsets:body.offsets||{}, text:body.text||{}, at:at||Date.now()})); }catch(err){}
}
function put(body){
  return fetch(EDIT_API,{method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(body)})
    .then(r=>r.json().then(j=>({...j,status:r.status})))
    .catch(err=>({ok:false,error:"unreachable"}));
}
function pushRemote(){
  if(typeof fetch!=="function") return Promise.resolve({ok:false,error:"unreachable"});
  return fetch(EDIT_API,{cache:"no-store"})
    .then(r=>r.json()).catch(()=>null)
    .then(doc=>{
      if(!doc || doc.error) return {ok:false,error:"unreachable"};
      if(!doc.at) return put(payload());          // nothing shared yet: publish ours whole
      const m=mergeOnto(doc);
      return put(m.body).then(res=>{
        if(res && res.ok && m.kept) adoptMerged(m.body,res.at);
        return {...res, kept:m.kept};
      });
    });
}

/* The motion control. The map is allowed to be still — what it is not allowed
   to be is still with no explanation and no way back. */
feature("motion", function(){
  /* THE PAUSE BUTTON IS GONE AND THE MACHINERY IS NOT. `playing`, setMotion()
     and MOTION_MIN still run: the map still stops for prefers-reduced-motion,
     still stops below the zoom where a chart is smaller than a postage stamp,
     and a ticker that throws is still dropped. What went is one more control
     in a toolbar for something almost nobody reached for — and `btn` being
     absent is handled everywhere below rather than assumed away. */
  const btn=document.getElementById("btnMotion");
  const hint=document.querySelector(".hint"), hint0=hint?hint.textContent:"";
  onMotion=()=>{
    if(btn) btn.textContent = playing ? "Pause motion" : "Play motion";
    if(btn) btn.setAttribute("aria-pressed", playing?"false":"true");
    if(hint && !texting && !editing)
      hint.textContent = playing ? hint0
        : (mqReduce.matches && motionChoice!=="off"
            ? "Motion is paused because this browser asks for reduced motion — press M to run it anyway"
            : "Motion is paused — press M to start it");
  };
  if(btn) btn.onclick=()=>setMotion(!playing,true);
  onMotion();
});

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
feature("edit positions", function(){
  const btnEdit=document.getElementById("btnEdit");
  if(!btnEdit) return;                       // the page can ship without the tool
  const hint=document.querySelector(".hint");
  const hint0=hint?hint.textContent:"";
  const SNAP=0.05, r2=v=>Math.round(v*100)/100;
  /* A FLOOR ON WIDTH AND DEPTH, AND IT IS NOT ARBITRARY. A shape derives what
     it draws from its own size — how many wells, how many cells, how many
     groups — and squeezed far enough some of them produce nothing at all, at
     which point their own animation reads an empty array and throws. The frame
     loop drops a throwing ticker and keeps going, which is the designed
     behaviour and not a crash; the shape simply stops moving until it is
     redrawn. Resizing it back does that. The floor makes it hard to reach by
     accident rather than impossible to reach at all — no single number can
     know what every shape needs. */
  const MINWD=0.3;

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

  /* ============================================================
     REDRAW ONE NODE, WHICH IS WHAT A RESIZE COSTS

     Every other edit is a translate on a group already drawn — nothing
     re-renders and no ticker is disturbed. A resize is not: w, d and h are
     read by the shape at draw time, so the only way to see a new size is to
     draw it again. The tickers a shape registered are removed before it is
     redrawn and recorded again after; the plinth and the name come from the
     same numbers and are rebuilt with it; the editor's own handle goes back on
     top, because clearing the group threw it away with everything else.
     ============================================================ */
  function redrawNode(n){
    const g=nodeEls[n.id];
    if(!g || !DRAW[n.shape]) return;
    if(n._ticks) n._ticks.forEach(fn=>{ const i=TICKERS.indexOf(fn); if(i>=0) TICKERS.splice(i,1); });
    const before=TICKERS.length;
    while(g.firstChild) g.removeChild(g.firstChild);
    DRAW[n.shape](g,n);
    groundLoose(g,n);
    n._ticks=TICKERS.slice(before);
    if(editing) g.appendChild(el("polygon",{points:pts(nodeSil(n)),class:"ehandle"}));
    const pl=plinthEls[n.id];
    if(pl){
      const pad=n.anchor?0.55:0.4, hw=n.w/2+pad, hd=n.d/2+pad;
      pl.setAttribute("points",pts([[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],
        [n.x+hw,n.y+hd],[n.x-hw,n.y+hd]].map(q=>P(q[0],q[1],0))));
    }
    const L=labelEls[n.id];
    if(L) L.dataset.base=labelBase(n);
    reposition(n);
  }

  /* a label group already carries its own translate+rotate; keep it so the
     drag transform can be composed in front of it */
  Object.entries(labelEls).forEach(([id,L])=>{ L.dataset.base=L.getAttribute("transform")||""; });

  /* ---- DOUBLE-CLICK TO PICK, THEN ✕ TO DELETE -------------------------
     A single click on this map already means something — it pins a station
     and fills the reader — and a press that does not travel is how a drag
     ends, so neither is free to mean "offer to delete this". A double click
     is: nothing else on the map uses it, and it cannot be arrived at by
     accident in the middle of dragging.

     The ✕ is an HTML button in the stage rather than an SVG one, for two
     reasons: it must not shear with the projection, and it must not live
     inside the group it is offering to delete — a control that vanishes with
     its own target cannot be pressed a second time. It rides the camera from
     the frame loop so it stays on its object through a pan.

     And it asks. Everything else in this mode undoes itself by dragging back;
     this does not, and the saved state is shared, so a mis-click would take an
     object off the map for everybody. */
  const xbtn=document.getElementById("delX");
  const askBox=document.getElementById("delAsk");
  let picked=null;
  function askDelete(title,body,onYes){
    if(!askBox){ if(confirm(title)) onYes(); return; }
    askBox.querySelector("#delAskTitle").textContent=title;
    askBox.querySelector("#delAskBody").textContent=body||"";
    askBox.classList.add("on");
    const go=askBox.querySelector("#delAskGo"), no=askBox.querySelector("#delAskNo");
    const close=()=>{ askBox.classList.remove("on"); go.onclick=null; no.onclick=null; };
    go.onclick=()=>{ close(); onYes(); };
    no.onclick=close;
  }
  function placeX(){
    if(!xbtn) return;
    if(!picked || !editing){ xbtn.style.display="none"; return; }
    let sx,sy;
    if(picked.kind==="node"){
      const n=picked.n, q=P(n.x, n.y-(n.d||0)/2, topOf(n));
      sx=view.x+q[0]*view.k; sy=view.y+q[1]*view.k;
    }else if(picked.kind==="band"){
      const b=picked.rec.b, q=P(b.x1,b.y0,0);
      sx=view.x+q[0]*view.k; sy=view.y+q[1]*view.k;
    }else{
      const t=picked.a.hit, r0=svg.getBoundingClientRect();
      if(!t){ xbtn.style.display="none"; return; }
      const b=t.getBoundingClientRect();
      sx=b.x+b.width-r0.left; sy=b.y-r0.top;
    }
    xbtn.style.display="grid";
    xbtn.style.left=(sx+8)+"px";
    xbtn.style.top=(sy-30)+"px";
  }
  /* ---- AND A PICKED NODE CAN BE RESIZED ---------------------------------
     The ✕ appears on a pick because deleting is the one thing that cannot be
     undone by dragging back. Resizing appears there too, and for the opposite
     reason: it can, but it needs handles, and four corners on every object at
     once would bury this map — nineteen objects in one row of four — under its
     own tooling. One object at a time, and it is the one you just picked.

     FOUR CORNERS ON THE TOP FACE AND ONE IN THE MIDDLE. The corners take w and
     d; the middle one takes h and is dragged up the screen. They are SVG rects
     inside `world`, so they ride the camera for free and cannot shear — the
     world group carries a translate and a scale and nothing else.

     A CORNER IS ANCHORED AT ITS OPPOSITE. Drag one and the other three hold
     still, which is what a rectangle anywhere does — so the drag writes dw/dd
     AND dx/dy, because w and d are measured from a centre and the centre has
     to move to keep the far corner where it was. */
  const gResize=world.appendChild(el("g"));
  const RH=[];
  for(let k=0;k<5;k++)
    RH.push(gResize.appendChild(el("rect",{class:"ehandle sizer"+(k===4?" tall":""),
      width:"13",height:"13"})));
  const sizerAt=(n,k)=>{
    const hw=(n.w||0)/2, hd=(n.d||0)/2, h=topOf(n);
    if(k===4) return P(n.x,n.y,h);
    return P(n.x+((k===1||k===2)?hw:-hw), n.y+((k===2||k===3)?hd:-hd), h);
  };
  function placeResize(){
    const on = picked && picked.kind==="node" && editing && !picked.n.gone;
    RH.forEach((e,k)=>{
      if(!on){ e.setAttribute("display","none"); return; }
      e.removeAttribute("display");
      const q=sizerAt(picked.n,k);
      e.setAttribute("x",(q[0]-6.5).toFixed(1));
      e.setAttribute("y",(q[1]-6.5).toFixed(1));
    });
  }
  RH.forEach((e,k)=>{
    e.addEventListener("pointerdown",ev=>{
      if(!editing || !picked || picked.kind!=="node") return;
      ev.stopPropagation(); ev.preventDefault();
      if(e.setPointerCapture) e.setPointerCapture(ev.pointerId);
      const n=picked.n;
      grab={n,mode:"size",corner:k,px:ev.clientX,py:ev.clientY,moved:0,
            ow:n.w,od:n.d,oh:n.h,ox:n.x,oy:n.y};
      e.classList.add("picked");
    });
    e.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>e.addEventListener(t,ev=>{
      e.classList.remove("picked"); end(ev);
    }));
  });

  window.placeDeleteX=()=>{ placeX(); placeResize(); };
  const pick=w=>{ picked=w; placeX(); placeResize(); };
  const unpick=()=>{ picked=null; placeX(); placeResize(); };

  /* WHY THIS IS NOT A `dblclick` LISTENER, which is what it obviously should
     be. This mode is built on pointer capture, and begin() calls
     preventDefault() on pointerdown to stop the browser turning the drag into
     a text selection. preventDefault on pointerdown suppresses the whole
     compatibility mouse-event chain — click and dblclick included — so a
     dblclick handler on a node group in this mode never fires once. It looks
     right, it is wired to the right element, and it is dead.

     So the double press is measured from the presses. A press that did not
     travel is a candidate; two of them on the same target inside DBL_MS is a
     double click. Same rule a browser uses, applied one layer down. */
  /* ---- SELECT MANY, AND MOVE THEM AS ONE ------------------------------
     A map is arranged in groups more often than one object at a time: a row
     shifts, a cluster of side structures moves off something it collides
     with, four culls slide together. Doing that one drag at a time works and
     loses the spacing — every object you move is measured by eye against the
     one you moved last, and the errors add up.

     So: turn the mode on, click objects to gather them, drag any one of them
     and the whole set moves by the same world delta. Nothing is scaled and
     nothing is re-spaced; the set keeps its own arrangement exactly, which is
     the only reason to move things together rather than in turn.

     WHY IT IS ITS OWN MODE rather than a modifier key. Shift-click is the
     obvious answer and it is wrong here: this map's Edit positions is driven
     by pointer capture with preventDefault on pointerdown, so the browser's
     own notion of a click never arrives, and a modifier would have to be read
     off the pointer event and remembered across a capture. A mode is one
     boolean and it is visible in the toolbar, which matters more — a
     selection you did not know you were building is a selection you will move
     by accident.

     A press that does not travel TOGGLES membership. Dragging something that
     is not in the set clears the set and drags that one alone, which is what
     every other drawing program does and the only behaviour nobody has to be
     told about. */
  const CHOSEN=new Set();
  let multi=false;
  const btnMulti=document.getElementById("btnMulti");
  function markChosen(){
    NODES.forEach(n=>{ const g=nodeEls[n.id];
      if(g) g.classList.toggle("chosen", CHOSEN.has(n.id)); });
  }
  function clearChosen(){ CHOSEN.clear(); markChosen(); sayChosen(); }
  function toggleChosen(id){
    if(CHOSEN.has(id)) CHOSEN.delete(id); else CHOSEN.add(id);
    markChosen(); sayChosen();
  }
  function sayChosen(){
    if(!hint || !multi) return;
    hint.textContent = CHOSEN.size
      ? `${CHOSEN.size} selected — drag any one of them to move them all · click to add or remove · Esc to clear`
      : "Select many: click objects to gather them, then drag any one to move them all as a unit";
  }
  function setMulti(on){
    multi=on;
    if(!on) clearChosen();
    document.body.classList.toggle("multi",on);
    if(btnMulti){ btnMulti.textContent=on?"Done selecting":"Select many";
                  btnMulti.setAttribute("aria-pressed",String(on)); }
    if(on){ unpick(); sayChosen(); } else say(null);
  }
  if(btnMulti) btnMulti.onclick=()=>{
    /* it only means anything inside Edit positions, so it turns that on
       rather than doing nothing and looking broken */
    if(!editing) setMode(true);
    setMulti(!multi);
  };
  window.pipelineClearChosen=()=>{ if(multi) clearChosen(); };

  const DBL_MS=420;
  let lastTap={key:null,t:0};
  function tapped(key,what){
    const now=performance.now();
    const isDouble = lastTap.key===key && (now-lastTap.t)<DBL_MS;
    lastTap = isDouble ? {key:null,t:0} : {key,t:now};
    if(isDouble) pick(what);
    else if(picked) unpick();          // a single press elsewhere puts the ✕ away
  }

  function removeNode(n){
    n.gone=true;
    [nodeEls[n.id],plinthEls[n.id],labelEls[n.id]].forEach(e=>{ if(e) e.setAttribute("display","none"); });
    edgeGeom.forEach(rec=>{ if(rec.host && (rec.a===n.id||rec.b===n.id)) rec.host.setAttribute("display","none"); });
    DOTS.forEach(d=>{ if(d.e && (d.e.a===n.id||d.e.b===n.id)) d.node.setAttribute("display","none"); });
    OURKEYS.add(n.id);
    rebuildClip();
  }
  function removeBand(rec){
    rec.hide=true;
    [rec.pad,rec.g,rec.padHit,rec.grip,rec.gripHit].forEach(e=>e&&e.setAttribute("display","none"));
    OURKEYS.add(rec.key);
  }
  function removeAnn(a){
    a.hide=true;
    [a.line,a.dot,a.t1,a.box,a.hit].forEach(e=>e&&e.setAttribute("display","none"));
    OURKEYS.add(a.key);
  }
  if(xbtn) xbtn.onclick=()=>{
    if(!picked) return;
    const what=picked;
    const name = what.kind==="node" ? (what.n.key?what.n.key+" · ":"")+what.n.name
               : what.kind==="band" ? what.rec.b.name+" (the pad)"
               : what.a.key;
    askDelete("Delete "+name+"?",
      "It comes off the map for anyone who opens the page once you save. "+
      "Everything else in this mode undoes itself by dragging back; this does not.",
      ()=>{ if(what.kind==="node") removeNode(what.n);
            else if(what.kind==="band") removeBand(what.rec);
            else removeAnn(what.a);
            unpick(); markDirty(); });
  };

  let grab=null;
  function begin(ev,n,mode){
    if(!editing) return;
    ev.stopPropagation(); ev.preventDefault();
    const el0=ev.currentTarget;
    if(el0.setPointerCapture) el0.setPointerCapture(ev.pointerId);
    grab={n,mode,px:ev.clientX,py:ev.clientY,moved:0,
          ox:n.x,oy:n.y,olx:n._lx,oly:n._ly,el:el0,
          /* the whole set's starting positions, so every one of them is
             measured from where it was rather than from where it is now.
             Accumulating deltas frame by frame drifts, and the drift is
             different for each member, which is exactly the spacing this
             tool exists to preserve. */
          /* the set travels only if the thing being dragged is IN it. A press
             on anything else is either a tap that gathers, or a drag of that
             one object — and which of the two it is cannot be known until it
             has either travelled or not, so nothing is cleared here. */
          set: (multi && mode==="node" && CHOSEN.has(n.id) && CHOSEN.size)
                 ? [...CHOSEN].filter(id=>byId[id]).map(id=>({n:byId[id],ox:byId[id].x,oy:byId[id].y}))
                 : null};
    (mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.add("picked");
  }
  function move(ev){
    if(!grab) return;
    grab.moved=Math.max(grab.moved,Math.hypot(ev.clientX-grab.px,ev.clientY-grab.py));
    /* IT HAS TRAVELLED, so it is a drag rather than a tap. Dragging something
       outside the set means the set is not what you meant: clear it and drag
       this one alone, the way every drawing program behaves. Done here rather
       than on pointerdown because on pointerdown a press is still ambiguous —
       doing it there emptied the set on every click, so only ever one thing
       could be gathered. */
    if(multi && grab.moved>4 && !grab.set && grab.mode==="node" && CHOSEN.size && !CHOSEN.has(grab.n.id))
      clearChosen();
    if(grab.mode==="size"){
      const n=grab.n, q=v=>Math.round(v/SNAP)*SNAP;
      if(grab.corner===4){
        /* HEIGHT IS SCREEN-VERTICAL AND NOTHING ELSE. z is the one axis this
           projection draws straight up, so a height drag divides by S*CZ and
           never touches the ground-plane inverse. */
        n.h=Math.max(0.02, r2(grab.oh + q(-(ev.clientY-grab.py)/view.k/(S*CZ))));
      } else {
        const [dx,dy]=toWorld((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
        const sx=(grab.corner===1||grab.corner===2)?1:-1;
        const sy=(grab.corner===2||grab.corner===3)?1:-1;
        n.w=Math.max(MINWD, r2(grab.ow+q(dx)*sx)); n.d=Math.max(MINWD, r2(grab.od+q(dy)*sy));
        /* the opposite corner holds still, so the centre takes half the growth */
        n.x=r2(grab.ox+(n.w-grab.ow)*sx/2); n.y=r2(grab.oy+(n.d-grab.od)*sy/2);
      }
      redrawNode(n); refresh(n.id); placeResize(); placeX();
      if(hint) hint.textContent=`${n.key} · ${n.name} — w ${n.w.toFixed(2)}`+
        `  d ${n.d.toFixed(2)}  h ${n.h.toFixed(2)}`;
      return;
    }
    if(grab.mode && grab.mode.startsWith("band-")){
      const rec=grab.rec, b=rec.b;
      const [dx,dy]=toWorld((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
      const q=v=>Math.round(v/SNAP)*SNAP;
      if(grab.mode==="band-move"){
        b.x0=r2(grab.ox+q(dx)); b.y0=r2(grab.oy+q(dy));
        b.x1=r2(b.x0+grab.ow);  b.y1=r2(b.y0+grab.oh);
      }else if(grab.mode==="band-size"){
        /* a pad may not be dragged inside out: below a floor it stops rather
           than flipping, which is what a negative width would draw */
        b.x1=r2(Math.max(b.x0+2, grab.ox+grab.ow+q(dx)));
        b.y1=r2(Math.max(b.y0+1.2, grab.oy+grab.oh+q(dy)));
      }else{
        rec.lx=r2(grab.olx+q(dx)); rec.ly=r2(grab.oly+q(dy));
      }
      rec.reflow();
      if(hint) hint.textContent=`${b.name} — x ${b.x0.toFixed(1)}..${b.x1.toFixed(1)} `+
        `y ${b.y0.toFixed(1)}..${b.y1.toFixed(1)}`;
      return;
    }
    if(grab.mode==="ann"){
      /* an annotation is screen-space, not world-space: it is not on the
         ground plane, so its nudge is measured in the units it is drawn in
         and only the camera scale divides out */
      const a=grab.ann;
      a.off.dx=Math.round(grab.ox+(ev.clientX-grab.px)/view.k);
      a.off.dy=Math.round(grab.oy+(ev.clientY-grab.py)/view.k);
      a.reflow();
      if(hint) hint.textContent=`${a.key} — adx ${a.off.dx} ady ${a.off.dy}`;
      return;
    }
    const [dx,dy]=toWorld((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
    const q=v=>Math.round(v/SNAP)*SNAP;
    const n=grab.n;
    if(grab.mode==="label"){ n._lx=r2(grab.olx+q(dx)); n._ly=r2(grab.oly+q(dy)); }
    else if(grab.set){
      /* ONE DELTA, APPLIED TO EVERY MEMBER FROM ITS OWN START. The set keeps
         its arrangement exactly — nothing is scaled, nothing re-spaced — which
         is the whole reason to move things together rather than in turn. */
      /* QUANTISE THE DELTA, NEVER THE RESULT. r2() on each member's new
         position rounds every one of them independently, and the lane engine
         does not put objects on tidy coordinates — so three objects moved by
         one drag came out 0.005 apart from each other. Small, and it is
         exactly the spacing this tool exists to preserve, and it compounds
         every time a set is moved. The delta is snapped once; adding it
         leaves every gap between members bit-identical. */
      const ddx=q(dx), ddy=q(dy);
      grab.set.forEach(m=>{ m.n.x=m.ox+ddx; m.n.y=m.oy+ddy; reposition(m.n); });
      refresh(null);
      if(hint) hint.textContent=`${grab.set.length} selected — moved dx ${ddx.toFixed(2)} dy ${ddy.toFixed(2)}`;
      return;
    }
    else { n.x=r2(grab.ox+q(dx)); n.y=r2(grab.oy+q(dy)); }
    reposition(n);
    if(grab.mode!=="label") refresh(n.id);
    say(n);
  }
  function end(){
    if(!grab) return;
    if(grab.mode==="size"){
      const n=grab.n, travelled=grab.moved>4;
      grab=null;
      if(travelled){
        OURKEYS.add(n.id);
        refresh(null);
        NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y))
             .forEach(m=>gNode.appendChild(nodeEls[m.id]));
        markDirty();
      }
      return;
    }
    if(grab.mode && grab.mode.startsWith("band-")){
      const rec=grab.rec, travelled=grab.moved>4;
      rec.g.classList.remove("picked"); rec.pad.classList.remove("picked");
      grab=null;
      if(!travelled) return tapped("band:"+rec.key,{kind:"band",rec});
      OURKEYS.add(rec.key); markDirty(); return;
    }
    if(grab.mode==="ann"){
      const a=grab.ann, travelled=grab.moved>4;
      a.box.classList.remove("picked");
      grab=null;
      if(!travelled) return tapped("ann:"+a.key,{kind:"ann",a});
      OURKEYS.add(a.key); markDirty(); return;
    }
    const travelled=grab.moved>4;
    const n=grab.n;
    (grab.mode==="label"?labelEls[n.id]:nodeEls[n.id]).classList.remove("picked");
    const wasSet=grab.set;
    grab=null;
    if(!travelled){
      /* in this mode a tap gathers rather than offers a ✕ — the two would
         fight over the same gesture, and gathering is what the mode is for */
      if(multi) { toggleChosen(n.id); return; }
      return tapped("node:"+n.id,{kind:"node",n});
    }
    refresh(null);
    /* painter order is (x+y); something dragged far enough changes places */
    NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(m=>gNode.appendChild(nodeEls[m.id]));
    markDirty();
  }
  function say(n){
    if(!hint) return;
    const o=n?totalOffset(n):{};
    hint.textContent = n
      ? `${n.key} · ${n.name} — x ${n.x.toFixed(2)}  y ${n.y.toFixed(2)}`+
        `   ·   offset dx ${(o.dx||0).toFixed(2)} dy ${(o.dy||0).toFixed(2)}`+
        (o.ldx||o.ldy?`   ·   name ldx ${(o.ldx||0).toFixed(2)} ldy ${(o.ldy||0).toFixed(2)}`:"")
      : "Drag any object, any name or any floating label · double-click one to offer a ✕ · Save all changes when done";
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

  /* ---- THE FOUR PADS: move, resize, and their names -------------------
     A pad is the ground a row stands on and it is the biggest object on the
     map, so it cannot take a press the way a building does — press anywhere
     inside one and you would be dragging the floor instead of the thing
     standing on it. Its handle is therefore its EDGE: an outline with no fill
     and a fat invisible stroke, so the pad picks up only where it is drawn.

     Its size handle is a grip on the FAR CORNER — the corner that moves when
     the pad grows — so dragging it means what it looks like it means. Its
     name has its own nudge, like every other name on this map.

     All three are inert until the mode is on, and none of them exists in the
     DOM in a way that can eat a click before then. */
  BANDEL.forEach(rec=>{
    const outline=el("polygon",{class:"ehandle padedge","pointer-events":"none"});
    gBand.appendChild(outline);
    rec.padHit=outline;
    const grip=el("circle",{r:7,class:"ehandle padgrip","pointer-events":"none"});
    const gripHit=el("circle",{r:13,class:"ehit padgriphit"});
    gBand.appendChild(grip); gBand.appendChild(gripHit);
    rec.grip=grip; rec.gripHit=gripHit;
    /* a box round the name, because glyphs are mostly holes */
    let bb; try{ bb=rec.g.getBBox(); }catch(err){ bb=null; }
    if(bb && bb.width){
      const pd=5, box={x:bb.x-pd,y:bb.y-pd,width:bb.width+pd*2,height:bb.height+pd*2};
      rec.g.appendChild(el("rect",{...box,class:"ehandle lab"}));
      rec.nameHit=rec.g.appendChild(el("rect",{...box,class:"ehit"}));
    }
    rec.reflow();

    const wire=(target,mode)=>{
      if(!target) return;
      target.addEventListener("pointerdown",ev=>{
        if(!editing) return;
        ev.stopPropagation(); ev.preventDefault();
        if(target.setPointerCapture) target.setPointerCapture(ev.pointerId);
        grab={rec,mode:"band-"+mode,px:ev.clientX,py:ev.clientY,moved:0,
              ox:rec.b.x0,oy:rec.b.y0,ow:rec.b.x1-rec.b.x0,oh:rec.b.y1-rec.b.y0,
              olx:rec.lx,oly:rec.ly};
        (mode==="name"?rec.g:rec.pad).classList.add("picked");
      });
      target.addEventListener("pointermove",move);
      ["pointerup","pointercancel"].forEach(t=>target.addEventListener(t,end));
    };
    wire(outline,"move"); wire(gripHit,"size"); wire(rec.nameHit,"name");
  });

  /* ---- THE FLOATING ANNOTATIONS, one at a time ------------------------
     UNDER-AMPLIFIED and OVER-AMPLIFIED are two labels on one roof and they
     are dragged separately, because they name two different tails of the same
     cloud and where each can go depends on what is under it.

     They are not laid out from world coordinates at all: their own shape
     re-places them from scratch EVERY FRAME, so moving the element is
     pointless — the next frame puts it back. What is draggable is `off`, a
     nudge in world-SVG units that placeAnn() adds to whatever the shape asked
     for. The shape keeps owning where the label starts; the editor owns where
     it ends up. And because placeAnn recomputes the leader from the moved
     text to the UNMOVED target, the line follows the label, which is the whole
     reason a label like this is worth being able to move. */
  if(typeof ANNOTATIONS!=="undefined") ANNOTATIONS.forEach(a=>{
    if(!a.hit) return;
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

  /* In this mode every annotation is held at full opacity. They only exist for
     part of each roof's loop, and a label you cannot see is a label you cannot
     pick up — the handle would be an empty dashed box hovering over nothing. */
  function holdAnnotations(on){
    if(typeof ANNOTATIONS==="undefined") return;
    ANNOTATIONS.forEach(a=>{ a.forceShow=on; a.reflow(); });
  }

  setPosMode=setMode;
  function setMode(on){
    if(on && texting) setTextMode(false);
    editing=on;
    svg.classList.toggle("editing",on);
    document.body.classList.toggle("editing",on);
    btnEdit.textContent=on?"Done moving":"Edit positions";
    syncSaveBar();
    holdAnnotations(on);
    if(!on){ unpick(); setMulti(false); } else placeX();
    if(on){ release(); say(null); }
    else if(onMotion) onMotion();
    else if(hint) hint.textContent=hint0;
  }
  btnEdit.onclick=()=>setMode(!editing);
});

/* ============================================================
   EDIT TEXT
   Every string on the page comes from a field on a data object, so editing
   one is: change the field, then repaint the few places that render it. One
   popover does the typing, anchored to whatever was clicked — on the map, or
   in the reader, or on a band title.
   ============================================================ */
feature("edit text", function(){
  const btnText=document.getElementById("btnText");
  if(!btnText) return;
  const pop=document.getElementById("tedit"), inp=document.getElementById("teIn"),
        what=document.getElementById("teWhat"), teHint=document.getElementById("teHint");
  const LONG={does:1};
  const FIELD={name:"Name",sub:"Subtitle",stat:"Landmark line",group:"Group",
               does:"What it does",title:"Title",eyebrow:"Eyebrow",band:"Row title"};
  let open=null;

  const bandName=i=>BANDS[i]?BANDS[i].name:"";
  function valueOf(t){
    if(t.kind==="band") return bandName(t.i);
    if(t.id==="__overview__") return OVERVIEW[t.f]||"";
    return byId[t.id]?(byId[t.id][t.f]||""):"";
  }
  /* write the field, then repaint only what renders it */
  function commit(t,v){
    v=v.replace(/\s+$/,"");
    if(!v || v===valueOf(t)) return false;
    if(t.kind==="band"){
      BANDS[t.i].name=v; recordText("band",t.i,null,v);
      if(textEls["band:"+t.i]) textEls["band:"+t.i].textContent=v.toUpperCase();
    }else if(t.id==="__overview__"){
      OVERVIEW[t.f]=v; recordText("overview",null,t.f,v); if(!current) renderOverview();
    }else{
      recordText("node",t.id,t.f,v);
      const n=byId[t.id]; n[t.f]=v;
      const el0=textEls[t.id+":"+t.f];
      if(el0) el0.textContent = t.f==="stat" ? v
              : (n.anchor||n.shape==="works"||n.shape==="machine") ? v.toUpperCase()
              : n.key+" · "+v;
      if(t.f==="name"){
        const row=aside.querySelector(`.row[data-id="${t.id}"] .nm`);   if(row) row.textContent=v;
        const chip=strip.querySelector(`.chip[data-id="${t.id}"] .nm`); if(chip) chip.textContent=v;
        nodeEls[t.id].setAttribute("aria-label",v);
      }
      if(current===t.id) renderNode(t.id);
    }
    markDirty();
    return true;
  }

  /* ============================================================
     THE POPOVER IS A WINDOW
     Fixed to the viewport, not to the map — the same box has to reach a band
     title out on the canvas and a paragraph over in the reader. Until it is
     touched it behaves as before, opening next to whatever was clicked and
     sized to the field. The moment it is dragged or pulled bigger it stops
     following: a box you placed yourself is furniture, and having it jump on
     every click is the thing that made long prose hard to work on.

     Geometry is per-browser furniture, never content, so it lives under its own
     key and is not part of the edits payload — resizing the editor must not
     look like an unsaved change or reach the shared copy.
     ============================================================ */
  const BOX_KEY=MAP_NS+".tedit.box", MINW=280, MINH=140;
  let box=null;
  try{ box=JSON.parse(localStorage.getItem(BOX_KEY)||"null"); }catch(err){}
  if(box && !(box.w>0 && box.h>0)) box=null;
  const saveBox=()=>{ try{ localStorage.setItem(BOX_KEY,JSON.stringify(box)); }catch(err){} };
  function clamp(b){
    const W=window.innerWidth||1200, H=window.innerHeight||800;
    b.w=Math.max(MINW,Math.min(b.w,W-20));
    b.h=Math.max(MINH,Math.min(b.h,H-20));
    b.x=Math.max(10,Math.min(b.x,W-b.w-10));
    b.y=Math.max(10,Math.min(b.y,H-b.h-10));
    return b;
  }
  function applyBox(b){
    pop.style.left=b.x+"px"; pop.style.top=b.y+"px";
    pop.style.width=b.w+"px"; pop.style.height=b.h+"px";
  }
  function place(rect,long){
    pop.classList.add("on");
    if(box){ applyBox(clamp(box)); return; }          // where you left it
    const W=window.innerWidth||1200, H=window.innerHeight||800;
    const w=Math.min(430,W-24), h=Math.min(long?330:186,H-40);
    let x=rect.left+rect.width/2-w/2, y=rect.bottom+10;
    if(y+h>H-10) y=Math.max(10,rect.top-h-10);
    applyBox(clamp({x,y,w,h}));
  }

  /* Drag by the head, resize by the corner. Pointer capture rather than
     window listeners, so a fast drag that leaves the 18px grip does not drop
     the gesture, and one code path covers mouse, pen and touch. */
  (function furniture(){
    const head=pop.querySelector(".tehead"), grip=document.getElementById("teGrip");
    let mode=null, sx=0, sy=0, s0=null;
    /* what we set is what we read back — style first, measurement only as a
       fallback for the first gesture after an open that did not size it */
    const here=()=>({x:parseFloat(pop.style.left)||0, y:parseFloat(pop.style.top)||0,
                     w:parseFloat(pop.style.width)||pop.offsetWidth||MINW,
                     h:parseFloat(pop.style.height)||pop.offsetHeight||MINH});
    function start(ev,m){
      if(ev.button!==undefined && ev.button!==0) return;
      mode=m; sx=ev.clientX; sy=ev.clientY; s0=here();
      ev.preventDefault(); ev.stopPropagation();
      try{ ev.currentTarget.setPointerCapture(ev.pointerId); }catch(err){}
    }
    function move(ev){
      if(!mode) return;
      ev.preventDefault();
      const dx=ev.clientX-sx, dy=ev.clientY-sy;
      box=clamp(mode==="move" ? {x:s0.x+dx, y:s0.y+dy, w:s0.w, h:s0.h}
                              : {x:s0.x, y:s0.y, w:s0.w+dx, h:s0.h+dy});
      applyBox(box);
    }
    function end(ev){
      if(!mode) return;
      mode=null; saveBox();
      try{ ev.currentTarget.releasePointerCapture(ev.pointerId); }catch(err){}
    }
    function wire(elm,m){
      if(!elm) return;
      elm.addEventListener("pointerdown",ev=>{
        if(m==="move" && ev.target.closest && ev.target.closest("button")) return;
        start(ev,m);
      });
      elm.addEventListener("pointermove",move);
      ["pointerup","pointercancel"].forEach(t=>elm.addEventListener(t,end));
    }
    wire(head,"move"); wire(grip,"size");
    /* double-click the head to hand it back to the map */
    if(head) head.addEventListener("dblclick",ev=>{
      if(ev.target.closest && ev.target.closest("button")) return;
      box=null; try{ localStorage.removeItem(BOX_KEY); }catch(err){}
      toast("The editor will follow what you click again, at its own size.");
    });
    window.addEventListener("resize",()=>{
      if(box && pop.classList.contains("on")) applyBox(clamp(box));
    });
  })();
  function edit(t,rect){
    open=t;
    const long=!!LONG[t.f];
    what.textContent = (t.kind==="band" ? "Row title"
      : (t.id==="__overview__" ? "Overview" : byId[t.id].key+" · "+byId[t.id].name))
      + " — " + (FIELD[t.kind==="band"?"band":t.f]||t.f);
    inp.value=valueOf(t);
    inp.rows = long?9:1;
    teHint.textContent = long ? "Shift-Enter for a new line · Enter to save · Esc to cancel"
                              : "Enter to save · Esc to cancel";
    place(rect,long);
    inp.focus(); inp.select();
  }
  /* Save on the popover goes all the way through: write the field, keep it in
     this browser, push it to the shared copy, and say which of those happened.
     There is no separate step to remember. */
  function close(save){
    const t=open, v=inp.value;
    open=null; pop.classList.remove("on");
    if(!t || !save) return;
    if(!commit(t,v)) return;
    stash();
    pushRemote().then(res=>{
      if(res && res.ok){
        adoptStamp(res.at);
        dirty=false; syncSaveBar();
        toast(mergeNote("Saved — this is the new default now. It will still be here after a refresh.",res),
              false, res.kept?8000:0);
      }else{
        toast("Kept in this browser only — the shared store could not be reached.",true,6000);
      }
    });
  }
  inp.addEventListener("keydown",e=>{
    if(e.key==="Escape"){ e.preventDefault(); close(false); }
    else if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); close(true); }
  });
  document.getElementById("teOk").onclick=()=>close(true);
  document.getElementById("teX").onclick=()=>close(false);

  const targetFor=key => key.startsWith("band:")
    ? {kind:"band",i:+key.slice(5),f:"band"}
    : {kind:"node",id:key.split(":")[0],f:key.split(":")[1]};

  /* Every string on the map gets a box, not just its glyphs. A step name is
     8.6px tall, so hit-testing the letters themselves meant landing the pointer
     on an actual stroke — which read as the mode not working at all. The box is
     drawn behind the text in the same group, so it inherits the rotation and
     lines up with the words; in text mode it lights up on hover and is what you
     actually click. */
  Object.entries(textEls).forEach(([key,e])=>{
    const host=e.parentNode;
    let bb=null; try{ bb=e.getBBox(); }catch(err){}
    if(host && bb && bb.width){
      const px=4, py=2;
      const box=el("rect",{x:bb.x-px,y:bb.y-py,width:bb.width+px*2,height:bb.height+py*2,
                           class:"thandle"});
      host.insertBefore(box,e);
      box.addEventListener("pointerdown",ev=>{
        if(!texting) return;
        ev.stopPropagation(); ev.preventDefault();
        edit(targetFor(key), box.getBoundingClientRect());
      });
    }
    /* the glyphs stay clickable too, for anything with no measurable box */
    e.style.pointerEvents="all";
    e.addEventListener("pointerdown",ev=>{
      if(!texting) return;
      ev.stopPropagation(); ev.preventDefault();
      edit(targetFor(key), e.getBoundingClientRect());
    });
  });
  /* and every tagged block in the reader */
  read.addEventListener("click",ev=>{
    if(!texting) return;
    const host=ev.target.closest?ev.target.closest("[data-tf]"):null;
    if(!host) return;
    ev.stopPropagation();
    edit({kind:"node",id:host.dataset.tid,f:host.dataset.tf}, host.getBoundingClientRect());
  });

  const hint=document.querySelector(".hint"), hint0=hint?hint.textContent:"";
  setTextMode=on=>{
    if(on && editing) setPosMode(false);
    texting=on;
    svg.classList.toggle("texting",on);
    document.body.classList.toggle("texting",on);
    btnText.textContent=on?"Done editing text":"Edit text";
    syncSaveBar();
    if(hint && on)
      hint.textContent="Click any name, row title or paragraph to rewrite it · select a step first to reach its prose";
    else if(onMotion) onMotion();
    else if(hint) hint.textContent=hint0;
    if(!on) close(false);
  };
  btnText.onclick=()=>setTextMode(!texting);
});

/* ============================================================
   SAVE ALL CHANGES
   ONE STEP. The button saves.

   It used to be two: the first click rendered a preview into the reader with a
   Confirm button under it, and nothing left the browser until that second
   click. The preview is worth keeping and it is still shown — what it is NOT
   worth is standing between somebody and the thing the button is named after.
   A control called "Save all changes" that does not save is a control people
   press twice by reflex and then wonder about.

   WHAT REPLACES THE SECOND CLICK IS A CONFIRMATION THAT IS ACTUALLY CHECKED.
   The old one appeared as soon as the POST resolved ok, which says the write
   was accepted, not that it is what a reload will find. This one writes, then
   READS THE RECORD BACK and compares the stamp before it says anything — so
   "this is the default now, after a reload" is a statement about the store
   rather than a hope about it. A write that lands and a read-back that
   disagrees says so instead.
   ============================================================ */
feature("saving", function(){
  const btnSave=document.getElementById("btnSave"), btnDrop=document.getElementById("btnDiscard");
  if(!btnSave) return;

  const asSource=(o,name)=>{
    const rows=Object.entries(o).map(([k,v])=>
      `  ${/^[A-Za-z_$][\w$]*$/.test(k)?k:JSON.stringify(k)}: ${JSON.stringify(v)},`);
    return `const ${name} = {\n`+rows.join("\n")+(rows.length?"\n":"")+"};";
  };
  const countText=t=>Object.keys(t.nodes||{}).reduce((a,id)=>a+Object.keys(t.nodes[id]).length,0)
                    +Object.keys(t.bands||{}).length+Object.keys(t.overview||{}).length;

  /* THE RECEIPT. Only ever drawn after a save has landed, so it has one state
     and no longer takes one — a `state` parameter with a single possible value
     is an invitation to wonder what the other one did. */
  /* THE SAVE DOES NOT TAKE OVER THE READER ANY MORE.

     It used to render a receipt into the right-hand panel: the counts, a
     sentence about what had happened, and the two blocks to paste back into
     the data file. That made sense while saving was two steps and the panel
     was where the Confirm button lived — the panel WAS the interaction. With
     one click and a confirmation that is checked against a read, the toast
     already says the only thing a person needs at that moment, and throwing
     away whatever they were reading to tell them again is the tool taking the
     page away from them.

     THE BLOCKS ARE NOT LOST, because they are the one thing here that is not
     transient: they are how a layout stops living only in the store and starts
     living in the repo. They go to the console, which is where somebody baking
     them into the data file is working anyway. */
  function receipt(){
    const p=payload(), nMove=Object.keys(p.offsets).length, nWord=countText(p.text);
    if(typeof console==="undefined" || !console.log) return;
    console.log(`%cSaved — ${nMove} object${nMove===1?"":"s"} moved, `+
      `${nWord} string${nWord===1?"":"s"} rewritten. Paste these into `+
      `${MAP_NS==="pipeline"?"pipeline-data.js":"this map's data file"} to bake them in.`,
      "font-weight:bold");
    if(nMove) console.log(asSource(p.offsets,"OFFSETS"));
    if(nWord) console.log(asSource(p.text,"TEXT"));
    console.log("Positions are nudges relative to what the lane engine computed, never "+
      "absolute coordinates, so they survive a row being re-solved or a step being inserted.");
  }

  /* Did the store actually take it? Read back and compare the stamp the write
     returned. A POST that resolves ok has been ACCEPTED; only a read proves it
     is what the next person to open the page will get. */
  function verify(at){
    if(typeof fetch!=="function") return Promise.resolve(false);
    return fetch(EDIT_API,{cache:"no-store"}).then(r=>r.json())
      .then(doc=>!!doc && doc.at===at).catch(()=>false);
  }

  let saving=false;
  function confirmSave(){
    if(saving) return;
    const p=payload();
    if(!Object.keys(p.offsets).length && !countText(p.text)){
      toast("Nothing to save — no position and no wording differs from the file.", false, 3400);
      return;
    }
    saving=true;
    const label=btnSave.textContent;
    btnSave.textContent="Saving…"; btnSave.disabled=true;
    stash();                                   // this browser, immediately
    pushRemote().then(res=>{
      if(!(res && res.ok)){
        const why = res && res.error==="too_large" ? "it is too big for one record"
          : res && res.error==="write_failed" ? "the shared store rejected the write"
          : "the shared store could not be reached";
        toast("NOT saved to the shared copy — "+why+". Your changes are still here in "+
              "this browser, so nothing is lost; try again.", true, 8000);
        return;
      }
      adoptStamp(res.at);
      dirty=false; syncSaveBar(); receipt();
      return verify(res.at).then(ok=>{
        toast(mergeNote(ok
          ? "Saved. Read back from the shared copy and confirmed — this is the default now, "+
            "for every browser, and it will still be here after a reload."
          : "Saved, but the read-back did not match yet. It is very likely fine — the store is "+
            "eventually consistent — but reload before trusting it.", res),
          !ok, res.kept?9000:6500);
      });
    }).then(()=>{
      saving=false; btnSave.textContent=label; btnSave.disabled=false;
    });
  }

  btnSave.onclick=confirmSave;
  btnDrop.onclick=()=>{
    if(!confirm("Throw away every change since the last confirmed save?")) return;
    try{ localStorage.removeItem(EDIT_KEY); localStorage.removeItem(MAP_NS+".offsets"); }catch(err){}
    location.reload();
  };
});

/* The shared copy is the default for everyone, so pull it after first paint
   and take it if this browser has nothing newer of its own. A failure here is
   silent: the map is already drawn from the tables in the data file. */
feature("shared copy", function(){
  if(typeof fetch!=="function") return;
  const mine=EDITS.at||0;
  fetch(EDIT_API,{cache:"no-store"}).then(r=>r.json()).then(doc=>{
    if(!doc || doc.error || !doc.at) return;
    /* keeping ours: mark whatever the shared copy has never seen, so the merge
       on the way out carries it rather than deferring to the store */
    if(doc.at<=mine || dirty) return seedUnpublished(doc);
    try{ localStorage.setItem(EDIT_KEY,JSON.stringify(
      {offsets:doc.offsets||{}, text:doc.text||{}, at:doc.at})); }catch(err){}
    toast("A newer shared version is available — reloading.");
    setTimeout(()=>location.reload(), 900);
  }).catch(()=>{});
});

/* ============================================================
   EDIT VISUAL
   The map's shapes are hand-written code, so this one cannot be done in the
   page. What it does instead is queue the request: describe the drawing you
   want, send it, and the instance picks it up, writes the shape and marks it
   done. The page watches its own request and reloads itself the moment that
   happens — so the loop closes here rather than in a chat window.
   ============================================================ */
feature("edit visual", function(){
  const btn=document.getElementById("btnVisual"), box=document.getElementById("ask");
  if(!btn||!box) return;
  const inp=document.getElementById("askIn"), what=document.getElementById("askWhat"),
        go=document.getElementById("askGo"), hint=document.getElementById("askHint");
  /* the dialogue's own spinner is gone: it was the wait living inside the thing
     that started it, which is exactly what the corner stack replaced */
  /* ============================================================
     WAITING FOR SEVERAL AT ONCE
     A drawing is minutes of work on the instance, so the sensible way to use
     this is to fire off three or four and carry on reading the map. They queue
     there and are drawn one at a time, in the order they arrived — so each one
     gets its own row in the corner, numbered by its place in that queue, and
     the rows survive the dialogue closing and the page reloading.

     Nothing here cancels anything. Once a request is on the queue the instance
     owns it; a row's × stops WATCHING it, which is a different thing, and says
     so rather than implying the work stopped.
     ============================================================ */
  const WATCH_KEY=MAP_NS+".pending";
  const works=document.getElementById("works");
  let watching=[];                 // [{id, since, label}]
  let rows={};                     // id -> the queue row last seen
  let poll=null, clock=null;

  /* how long one of these actually takes, learned from the queue's own history
     rather than asserted. Anything absurd is an abandoned row, not a drawing. */
  let etaMin=6;                    // until the queue has enough history to say
  function learnEta(list){
    const done=list.filter(p=>p.status==="done" && p.updated>p.at)
                   .map(p=>(p.updated-p.at)/60000).filter(m=>m>0.5 && m<30).slice(0,10);
    if(done.length>=2) etaMin=Math.max(2,Math.round(done.reduce((a,b)=>a+b,0)/done.length));
  }
  const DEPLOY_MIN=2;              // Vercel, after the push

  (function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(WATCH_KEY)||"null");
      if(Array.isArray(raw)) watching=raw;
      else if(raw && raw.id) watching=[raw];        // the one-at-a-time format
    }catch(err){}
    /* a wait older than six hours is somebody's abandoned tab */
    watching=watching.filter(w=>w && w.id && Date.now()-(w.since||0) < 6*3600*1000);
  })();
  const save=()=>{ try{ localStorage.setItem(WATCH_KEY,JSON.stringify(watching)); }catch(err){} };

  const mins=m=>m<1?"under a minute":(m===1?"about a minute":`about ${m} minutes`);
  const age=t=>{ const s=Math.max(0,Math.round((Date.now()-t)/1000));
                 return s<60 ? s+"s" : Math.floor(s/60)+"m "+String(s%60).padStart(2,"0")+"s"; };

  /* the open queue, oldest first — that IS the order the instance works in, so
     it is also the numbering people see */
  function openOrder(){
    return Object.values(rows).filter(p=>p.status==="queued"||p.status==="working")
                              .sort((a,b)=>a.at-b.at);
  }
  function render(){
    if(!works) return;
    works.innerHTML="";
    const order=openOrder().map(p=>p.id);
    const mine=watching.slice().sort((a,b)=>{
      const ia=order.indexOf(a.id), ib=order.indexOf(b.id);
      return (ia<0?99:ia)-(ib<0?99:ib);
    });
    mine.forEach(w=>{
      const p=rows[w.id], pos=order.indexOf(w.id), ahead=pos<0?0:pos;
      const working = p && p.status==="working";
      const row=document.createElement("div");
      row.className="work"+(working?"":" queued");
      row.dataset.id=w.id;
      const label=w.label?`<b>${esc(w.label)}</b> · `:"";
      const said = working
        ? `${label}drawing now — ${mins(etaMin)}`
        : ahead>0 ? `${label}waiting · ${ahead} ahead — starts in ${mins(ahead*etaMin)}`
                  : `${label}queued — picked up within seconds`;
      row.innerHTML =
        `<span class="worknum">${pos<0?"·":pos+1}</span>`+
        `<span class="workbar"><span></span></span>`+
        `<span class="worktext">${said}</span>`+
        `<span class="workage">${age(w.since)}</span>`+
        `<button aria-label="Stop watching this request">×</button>`;
      const x=row.querySelector("button");
      if(x) x.onclick=()=>{
        forget(w.id);
        toast("Not watching that one any more — it is still being drawn, and the map will say when it lands.",false,7000);
      };
      works.appendChild(row);
    });
    if(!clock && watching.length) clock=setInterval(render,1000);
    if(clock && !watching.length){ clearInterval(clock); clock=null; }
  }
  function begin(id,label){
    watching.push({id,since:Date.now(),label:label||""});
    save(); render(); ensurePoll(); baseline();
  }
  function forget(id){
    watching=watching.filter(w=>w.id!==id);
    save(); render();
    if(!watching.length && poll){ clearInterval(poll); poll=null; }
  }

  /* ---- what "ready" means ----
     The queue says done the moment the commit is pushed, but the page you are
     looking at is served by Vercel, which needs a minute or two more to build
     and go live. Refreshing in that window shows the OLD drawing and reads as
     the request having failed — so say the wait out loud, and then check for
     the deploy rather than guessing: the asset carries an ETag, and when it
     changes the new drawing is genuinely live. */
  let baseTag=null, deployT=null;
  const SHAPES="/pipeline/pipeline-shapes.js";
  function baseline(){
    if(baseTag || typeof fetch!=="function") return;
    fetch(SHAPES,{method:"HEAD",cache:"no-store"})
      .then(r=>{ baseTag=r.headers.get("etag")||r.headers.get("last-modified")||"none"; })
      .catch(()=>{});
  }
  function bar(msg,go){
    const el0=document.getElementById("newver"), what0=document.getElementById("newverWhat");
    if(!el0||!what0){ toast(msg,false,9000); return; }
    what0.textContent=msg;
    const b=document.getElementById("newverGo");
    if(b) b.textContent = go || "Refresh";
    el0.classList.add("on");
  }
  function landed(p){
    forget(p.id);
    const n=(p.note||"").trim();
    bar(`Drawing pushed${n?" — "+n:""}. It goes live ${mins(DEPLOY_MIN)} after this; refresh then.`,
        "Refresh anyway");
    watchDeploy();
  }
  /* poll the asset itself until it changes, then upgrade the message. Give up
     after five minutes rather than saying "nearly there" forever. */
  function watchDeploy(){
    if(deployT || typeof fetch!=="function") return;
    const gaveUp=Date.now()+5*60*1000;
    deployT=setInterval(()=>{
      fetch(SHAPES,{method:"HEAD",cache:"no-store"}).then(r=>{
        const tag=r.headers.get("etag")||r.headers.get("last-modified")||"none";
        if(baseTag && tag===baseTag){
          if(Date.now()>gaveUp){ clearInterval(deployT); deployT=null;
            bar("Your new drawing should be live — refresh to see it."); }
          return;
        }
        clearInterval(deployT); deployT=null; baseTag=tag;
        bar("Your new drawing is live — refresh to see it.");
      }).catch(()=>{});
    }, 10000);
  }

  function ensurePoll(){
    if(poll || typeof fetch!=="function") return;
    const beat=()=>{
      fetch(PROMPT_API,{cache:"no-store"}).then(r=>r.json()).then(j=>{
        const list=j.prompts||[];
        learnEta(list);
        rows={}; list.forEach(p=>rows[p.id]=p);
        watching.slice().forEach(w=>{
          const p=rows[w.id];
          if(!p) return;
          if(p.status==="done") landed(p);
          else if(p.status==="dropped"){
            forget(w.id);
            toast("That request was dropped"+(p.note?": "+p.note:"")+".",true,9000);
          }
        });
        render();
      }).catch(()=>{});
    };
    beat();
    poll=setInterval(beat,4000);
  }

  const targetOf=()=>{
    const n=current&&byId[current];
    return n?{id:n.id,key:n.key,name:n.name,shape:n.shape}:null;
  };
  function open(){
    const t=targetOf();
    what.textContent = t ? `New drawing for ${t.key} · ${t.name}  (shape "${t.shape}")`
                         : "New drawing — nothing selected, so say which step you mean";
    /* say the cost before the request, not after: this is minutes of work on
       the instance, and knowing that is what makes queueing several of them the
       obvious move rather than a surprise */
    if(hint) hint.textContent =
      `Drawn on the instance in ${mins(etaMin)}, live ${mins(DEPLOY_MIN)} after that · `+
      `send as many as you like — they queue up and stack in the corner`;
    box.classList.add("on"); inp.focus();
  }
  function close(){ box.classList.remove("on"); }
  btn.onclick=open;
  document.getElementById("askX").onclick=close;
  document.getElementById("askHide").onclick=close;
  box.addEventListener("pointerdown",ev=>{ if(ev.target===box) close(); });
  inp.addEventListener("keydown",ev=>{
    if(ev.key==="Escape"){ ev.preventDefault(); close(); }
    else if(ev.key==="Enter" && (ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); send(); }
  });

  function send(){
    const text=inp.value.trim();
    if(!text){ inp.focus(); return; }
    if(typeof fetch!=="function"){ toast("No connection — nothing was sent.",true,5000); return; }
    const t=targetOf();
    go.disabled=true; go.textContent="Sending…";
    fetch(PROMPT_API,{method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({text,target:t})})
      .then(r=>r.json())
      .then(j=>{
        go.disabled=false; go.textContent="Send";
        if(!j || !j.ok){ toast("Could not send that — the queue did not take it.",true,6000); return; }
        inp.value="";
        /* out of the way immediately: the dialogue is for writing requests, and
           the next one can be written the moment this one is on the queue */
        close();
        begin(j.prompt.id, t?t.key+" · "+t.name:"");
        toast(`Queued. Drawing takes ${mins(etaMin)}, plus ${mins(DEPLOY_MIN)} to go live — `+
              `send more if you want, they stack in the corner.`,false,8000);
      })
      .catch(()=>{ go.disabled=false; go.textContent="Send";
                   toast("Could not reach the queue — nothing was sent.",true,6000); });
  }
  go.onclick=send;

  /* Every open copy of the page, not just the one that asked. When a request
     is finished the map has changed underneath anyone reading it, so say so —
     and let them choose the moment, since an unannounced reload under someone
     mid-sentence is worse than a stale map. The page that made the request is
     the exception: it asked, so it reloads itself. */
  (function others(){
    if(typeof fetch!=="function") return;
    const bar=document.getElementById("newver");
    if(!bar) return;
    const since=Date.now();
    let told=false;
    document.getElementById("newverGo").onclick=()=>location.reload();
    document.getElementById("newverNo").onclick=()=>bar.classList.remove("on");
    setInterval(()=>{
      if(told) return;
      fetch(PROMPT_API,{cache:"no-store"}).then(r=>r.json()).then(j=>{
        let fresh=(j.prompts||[]).filter(p=>p.status==="done" && p.updated>since);
        if(!fresh.length) return;
        /* the pages that asked handle their own, above — including the deploy
           wait, which this bar knows nothing about */
        if(fresh.every(p=>watching.some(w=>w.id===p.id))) return;
        fresh=fresh.filter(p=>!watching.some(w=>w.id===p.id));
        told=true;
        document.getElementById("newverWhat").textContent =
          fresh.length===1 && fresh[0].note
            ? "The map has been updated — "+fresh[0].note
            : "The map has been updated"+(fresh.length>1?` (${fresh.length} changes)`:"")+".";
        bar.classList.add("on");
      }).catch(()=>{});
    }, 45000);
  })();

  /* pick the waits back up after a refresh — all of them, with their original
     clocks, because the queue kept working while the page was gone */
  (function resume(){
    if(!watching.length) return;
    save(); render(); ensurePoll(); baseline();
  })();
});

