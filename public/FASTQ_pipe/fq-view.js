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

/* Fail loudly and usefully if the scripts loaded out of order or one 404'd.

   IT DOES NOT ACTUALLY CATCH A MISSING `const`, and that is worth knowing
   before trusting it. A top-level `const` is not a property of `window`, so the
   first test never sees one; the fallback is
   `typeof eval("typeof " + sym) === "undefined"`, and `eval` there returns the
   STRING "undefined", whose typeof is "string". The condition can never be
   true. It catches a file that 404'd only through the symbols that happen to be
   `function` declarations, which do reach `window`.

   That is how this page ran for a build with `roofFrame` in the table below and
   nowhere in the source — it lives in /culls/culls-draw.js, which this map does
   not load. It is in fq-iso.js now, which is where this table always claimed it
   was. Left as it stands rather than fixed in passing, because the same block
   is in three maps and they should be changed together. */
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
      if(j && j.offsets) return {offsets:j.offsets||{}, links:j.links, at:j.at||0};
      return {offsets:j||{}, at:0};
    }
  }catch(err){}
  return {offsets:BAKED, links:undefined, at:0};
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

/* ============================================================
   HAND-DRAWN CONNECTIONS

   A track somebody put on the map with the Connect tool rather than one this
   page asserts about the pipeline. They are kept in their OWN list and not in
   the offsets table, because the two answer different questions — the table is
   "where is this object", the list is "what did somebody join to what" — and a
   list of pairs merged as if it were a table of keyed nudges would lose one of
   any two links a person drew in the same sitting.

   THEY ARE ORDINARY EDGES FROM HERE ON. Pushed into EDGES before anything reads
   it, so they route, paint, carry dots, get clipped and get repainted on a drag
   through exactly the same code as every authored edge. Nothing downstream
   knows the difference except that `link:true` is on them, which is how they
   are found again at save time.

   A GREY TRACK WITH WHITE DOTS, and the split is deliberate: `tone` colours the
   line, `dotTone` the dots. A white line would be the loudest thing on the map,
   and a hand-drawn connection is not a claim that outranks the drawn ones. */
const LIVELINKS=(EDITS.links||((typeof LINKS!=="undefined")?LINKS:[]))
  .filter(l=>l && byId[l.a] && byId[l.b] && !GONE.has(l.a) && !GONE.has(l.b));
const linkEdge=(a,b)=>({a,b,kind:"link",straight:true,port:"face",portB:"face",
  tone:"var(--fg2)",dotTone:"var(--fg)",link:true});
LIVELINKS.forEach(l=>EDGES.push(linkEdge(l.a,l.b)));

/* WHERE THE LANE ENGINE PUT EVERYTHING, before any nudge. Every offset in
   the table is measured from here.

   The first version measured "what the committed table said, plus how far it
   has been dragged since the page loaded", which is two quantities to keep in
   step and one of them is invisible. It also meant the derived position of the
   attrition band — computed after that baseline was taken — read as a nudge of
   twelve units that got written into every save. One base, taken once, in one
   place. */
/* THE BASE INCLUDES THE SIZE, and for the same reason it includes the
   position: an object can be resized in the editor, and a size that is stored
   as "whatever it is now" cannot be applied twice without growing. w, d and h
   are captured here beside x and y, and every saved dw/dd/dh is measured from
   these and from nothing else. */
NODES.forEach(n=>{ n._ox=n.x; n._oy=n.y; n._lx=0; n._ly=0;
                   n._ow=n.w; n._od=n.d; n._oh=n.h; });

function applyNudge(n,o){
  o=o||{};
  n.x=n._ox+(o.dx||0); n.y=n._oy+(o.dy||0);
  n._lx=o.ldx||0; n._ly=o.ldy||0;
  /* ONLY IF THERE IS ACTUALLY A DELTA. Clamping unconditionally reaches every
     node on every load, and one of them is authored h:0 — the attrition band,
     which is a patch of ground rather than a box. A floor applied to it turned
     0 into 0.02, which is a difference, which put it in the saved table as an
     object somebody had resized. Nobody had. A node with no dw/dd/dh keeps
     exactly the number the data file gave it. */
  if(o.dw) n.w=Math.max(0.05,n._ow+o.dw);
  if(o.dd) n.d=Math.max(0.05,n._od+o.dd);
  if(o.dh) n.h=Math.max(0.01,n._oh+o.dh);
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
const gGrid=el("g"),gBand=el("g"),gPlinth=el("g"),gEdge=el("g"),
      gDot=el("g"),gNode=el("g"),gLabel=el("g");
/* paint order is the z order. The tracks and the dots on them sit behind the
   solid world absolutely: anything they pass under occludes them. */
[gGrid,gBand,gPlinth,gEdge,gDot,gNode,gLabel].forEach(g=>world.appendChild(g));

/* the extent of the ground plane, and of the ruler drawn around it */
const GRID={x0:-5,x1:37,y0:-15,y1:10};

(()=>{const {x0,x1,y0,y1}=GRID;
  for(let x=Math.ceil(x0);x<=x1;x++){const a=P(x,y0,0),b=P(x,y1,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
  for(let y=Math.ceil(y0);y<=y1;y++){const a=P(x0,y,0),b=P(x1,y,0);
    gGrid.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--grid)","stroke-opacity":"var(--grid-op)","stroke-width":"1"}));}
})();

/* NO COORDINATE RULER, AND NO LAYER FOR ONE.

   There was one: ticks and numbers along the two outer edges, in the same x
   and y the data file is authored in, so a position could be read off the edge
   and typed straight into a node. It was a working tool rather than part of the
   picture, and it had a button to hide it — which is the tell. A control whose
   job is to remove something from the drawing is an admission that the thing
   should not have been in the drawing.

   Positions are authored by dragging in Edit positions and pasting the block
   back, which is how every layout on this map has actually been made for a
   while now. `gAxis` is gone with it; the layer list below is the picture.

   GRID below is still the extent of the ground plane, which is drawn. */

/* Row bands — the name runs along the band's bottom-right edge.

   THE NAME IS A MOVER. It belongs to no building, so nothing in the nudge
   table reached it and it was the one piece of type on the map that could not
   be got out of the way of anything. It is placed from world coordinates like
   everything else, so it takes the same world-unit nudge a building's name
   takes, under its own key. */
/* THE BAND IS AN OBJECT, NOT A BACKDROP.

   It is the one thing on the map that was drawn from constants and could not be
   touched — every building can be dragged and its name nudged, and the patch of
   ground they all stand on was fixed. It is also the thing the camera fits to,
   so getting it wrong costs the whole view.

   So it has the same two handles a rectangle anywhere has: DRAG THE BORDER to
   move it, DRAG A CORNER to reshape it. Its record is `bandbox:<i>` and carries
   dx/dy for the move and bx0/by0/bx1/by1 for the four extents, which is the
   smallest thing that can express both without the two interfering — a move
   leaves the extents alone and a corner leaves the move alone, so neither can
   quietly undo the other on a reload.

   ITS NAME RIDES ITS EDGE. The title is placed from the band's own bottom-right
   corner rather than from a remembered constant, so reshaping the band carries
   the title with it. It still has its own nudge on top (`band:<i>`); that is the
   same split a building and its name already have. */
const MOVERS=[], BOXES=[];
BANDS.forEach((b,i)=>{
  const poly=gBand.appendChild(el("polygon",{
    fill:"var(--fg)","fill-opacity":".025",stroke:"var(--fg)","stroke-opacity":".22",
    "stroke-width":"1","stroke-dasharray":"14 9"}));

  const g=gLabel.appendChild(el("g"));
  const t=el("text",{x:0,y:17,"text-anchor":"middle","font-size":"16","letter-spacing":"4",
    fill:"var(--fg3)"});
  t.textContent=b.name.toUpperCase(); g.appendChild(t);

  const box={key:"bandbox:"+i, name:b.name, b, poly, dx:0, dy:0, e:[0,0,0,0],
    hit:null, corners:[],
    rect(){ return [b.x0+box.dx+box.e[0], b.y0+box.dy+box.e[1],
                    b.x1+box.dx+box.e[2], b.y1+box.dy+box.e[3]]; },
    reflow(){
      const [x0,y0,x1,y1]=box.rect();
      const cs=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(q=>P(q[0],q[1],0));
      const d=pts(cs);
      poly.setAttribute("points",d);
      if(box.hit) box.hit.setAttribute("points",d);
      box.corners.forEach((h,k)=>{
        h.setAttribute("x",(cs[k][0]-7).toFixed(1));
        h.setAttribute("y",(cs[k][1]-7).toFixed(1));
      });
      m.reflow();
    }};
  BOXES.push(box);

  const m={key:"band:"+i, name:b.name, g, lx:0, ly:0, hide:false,
    reflow(){
      const [x0,y0,x1,y1]=box.rect();
      const [px,py]=P(x1+m.lx, (y0+y1)/2+m.ly, 0);
      g.setAttribute("transform",`translate(${px},${py}) rotate(-30)`);
    }};
  MOVERS.push(m);
  box.reflow();
});
function applyBox(box,o){
  o=o||{};
  box.dx=o.dx||0; box.dy=o.dy||0;
  box.e=[o.bx0||0,o.by0||0,o.bx1||0,o.by1||0];
  box.reflow();
}
BOXES.forEach(box=>applyBox(box,LIVE[box.key]));
function applyMover(m,o){
  o=o||{};
  m.lx=o.ldx||0; m.ly=o.ldy||0;
  if(o.del && !m.hide){ m.hide=true; m.g.setAttribute("display","none"); }
  if(!o.del && m.hide){ m.hide=false; m.g.removeAttribute("display"); }
  m.reflow();
}
MOVERS.forEach(m=>applyMover(m,LIVE[m.key]));

/* plinths under the landmarks; their names run along the bottom-left edge.

   A LANDMARK CAN DECLINE THE PLINTH with plinth:false, and one does. The
   plinth is a patch of ground saying "this object stands here", which is true
   of the matrix cube and untrue of the reads: that node is a pool in the air
   and a diagram hanging under it, and neither of them is on the floor. Drawn
   anyway it was an empty dashed square below the whole visual with a track
   running across it, which is exactly what it looks like — a footprint left by
   something that has gone. The name is not optional and is drawn either way. */
NODES.filter(n=>n.anchor).forEach(n=>{
  if(n.plinth!==false){
    const pad=0.55, hw=n.w/2+pad, hd=n.d/2+pad;
    const c=[[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],[n.x+hw,n.y+hd],[n.x-hw,n.y+hd]];
    plinthEls[n.id]=gPlinth.appendChild(el("polygon",{points:pts(c.map(p=>P(p[0],p[1],0))),
      fill:"var(--fg)","fill-opacity":".05",stroke:"var(--fg)",
      "stroke-opacity":".4","stroke-width":"1","stroke-dasharray":"6 4"}));
  }
  const g=el("g",{transform:labelBase(n)});
  const t=el("text",{x:14,y:-3,"text-anchor":"start","font-size":"20","letter-spacing":"2.5",
    fill:"var(--fg)"});
  t.textContent=n.name.toUpperCase(); g.appendChild(t);
  const t2=el("text",{x:14,y:12,"text-anchor":"start","font-size":"11","letter-spacing":".8",
    fill:"var(--fg2)"});
  t2.textContent=n.stat||""; g.appendChild(t2);
  /* A LANDMARK GETS ITS TAG TOO. It was only drawn on the plain nodes, so the
     matrix at the end of the branch rendered as one cube with nothing on it
     while every station feeding it said x 2 ARMS — which reads as the branch
     collapsing back into one object, and it does not. */
  if(n.tag){
    const t3=el("text",{x:14,y:26,"text-anchor":"start","font-size":"9",
      "letter-spacing":"1.4",fill:"var(--accent)"});
    t3.textContent=n.tag; g.appendChild(t3);
  }
  gLabel.appendChild(g); labelEls[n.id]=g;
});

/* WHERE A NAME HANGS, IN ONE PLACE. It is derived from the node's own size —
   the far edge of the footprint, at the height the object reaches — so a resize
   has to be able to ask for it again. Computing it twice, once here and once in
   the editor, is how a name ends up floating off a building that has been made
   smaller. */
function labelBase(n){
  if(n.anchor){
    const lo=n.lab||{}, ex=n.x+(lo.dx||0);
    const [px,py]=P(ex, n.y-n.d/2+(lo.dy||0), topOf(n));
    return `translate(${px},${py}) rotate(-30)`;
  }
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;
  const lo=n.lab||{}, ex=n.x+(lo.dx||0);
  const [bx,by] = below ? P(ex, n.y+n.d/2+(lo.dy||0), n.h) : P(ex, n.y-n.d/2+(lo.dy||0), n.h);
  return `translate(${bx},${by}) rotate(-30)`;
}

/* every other object emits its name from its top-right corner, running up and
   to the right at −30°: parallel to the band titles, perpendicular to the
   flow of the dots. A side structure sitting below its row emits down-left
   instead, so its name never lands on the row it hangs from. */
NODES.filter(n=>!n.anchor).forEach(n=>{
  let row=ROWS[0]; ROWS.forEach(r=>{ if(Math.abs(n.y-r)<Math.abs(n.y-row)) row=r; });
  const below = n.y-row > 1;
  const g=el("g",{transform:labelBase(n)});
  const t=el("text",{x:below?-9:9,y:-1,"text-anchor":below?"end":"start","font-size":"8.6",
    "letter-spacing":".35",fill:"var(--fg2)"});
  t.textContent=n.key+" · "+n.name; g.appendChild(t);
  /* A SECOND LINE UNDER THE NAME, when a node has a standing qualifier on it.

     Two of them exist. `modelled` is the one inherited from the other map — a
     figure that has lost that word is a figure claiming a result nobody has
     produced — and `tag` is anything else a node has to carry wherever it is
     drawn. Here that is "x 2 ARMS": every station from the alignment onward
     runs once per annotation arm, and a map that says so only in prose is a
     map where the second matrix arrives from nowhere. */
  const tag = n.tag || (n.modelled?"MODELLED":null);
  if(tag){
    const t2=el("text",{x:below?-9:9,y:10,"text-anchor":below?"end":"start","font-size":"8",
      "letter-spacing":"1",fill:"var(--accent)"});
    t2.textContent=tag; g.appendChild(t2);
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

  /* A PORTED EDGE LEAVES FROM A NAMED POINT ON ITS SOURCE, NOT FROM ITS CENTRE.

     Two edges leaving one node from the same place are two edges you cannot
     tell apart, and on this map the one that matters is the fork: the fragment
     glyph already puts the cDNA at its left end and the barcodes at its right,
     so the R1 track should leave the left end and the R2 track the right one.
     Then both journeys are followable with no labels at all.

     The route is: the port, then a straight run down to the destination's own
     lane, joining it a short way before the first stop, then along that lane.
     Two segments and no elbow — a track that drops out of one end of a
     molecule and lands on its own line, which is the whole claim, made in
     geometry rather than in a caption.

     PORT_LEAD is in world units along the lane, so the join scales with the
     lane rather than with the screen. Small enough that the run is a departure
     and not a second leg; large enough that the arrival is along the lane and
     not into the side of the first stop. */
  /* A DESTINATION PORT, for the same reason as a source one: these objects are
     large, and an edge that ends at the centre of one crosses the whole of it
     to get there. `portB` lands it on the near corner instead, so the line
     arrives AT the thing rather than through it. */
  /* A HAND-DRAWN LINK LEAVES AND ARRIVES AT THE MIDDLE OF AN EDGE, WHATEVER IT
     IS JOINING. It is resolved before PORTS is consulted on purpose: PORTS is
     keyed by SHAPE and most shapes on this page have no entry, so a link
     between two of those would have fallen through to a centre-to-centre line —
     which runs out of the middle of a box and through whatever is in the way.
     faceMid needs nothing but a footprint, which every node has. */
  if(e.port==="face" && typeof faceMid==="function")
    return [faceMid(A,B), faceMid(B,A)];
  const endAt = (e.portB && typeof PORTS!=="undefined" && PORTS[B.shape])
    ? PORTS[B.shape](B,e.portB,A) : null;
  if(e.port && typeof PORTS!=="undefined" && PORTS[A.shape]){
    const p0=PORTS[A.shape](A,e.port,B);
    /* A STRAIGHT PORTED EDGE IS TWO POINTS. The lane-entry route below is for
       a track that has to join a lane; a reference line has no lane to join,
       it just has to leave from somewhere visible and arrive. */
    if(e.straight) return [p0, endAt || P(B.x,B.y,0.02)];
    /* a destination port beats the lane-entry route: the port IS the arrival */
    if(endAt) return [p0, endAt];
    const PORT_LEAD=2.0;
    return [p0, P(B.x-PORT_LEAD,B.y,0.02), P(B.x,B.y,0.02)];
  }

  const raw = (e.straight || Math.abs(A.y-B.y)<0.05)
    ? [[A.x,A.y],[B.x,B.y]]
    : [[A.x,A.y],[mx,A.y],[mx,B.y],[B.x,B.y]];
  const pp=raw.map(p=>P(p[0],p[1],0.02));
  if(endAt) pp[pp.length-1]=endAt;
  return pp;
}
/* One <g> per edge so a route can be redrawn on its own when the editor moves
   a node — the number of elbows changes when two objects come level, so the
   run is rebuilt rather than patched. */
function paintEdge(rec){
  const host=rec.host;
  [...(host.children||[])].forEach(c=>host.removeChild(c));
  const pp=routeOf(rec);
  const faint = rec.kind==="drop";
  /* A REFERENCE EDGE IS CONNECTED BUT NOT CARRYING, and it has to look it.

     The genome and the whitelists are chosen once and reused forever; the
     reads are consumed. An index that animates material down it every run
     asserts a per-sample cost that does not exist — the same distinction
     /data_structures draws between "has carried bytes" and
     "written · never run". So a still edge is drawn thinner, dashed and
     dimmer, and no dot is ever put on it (see the DOTS block below). */
  const still = rec.still;
  /* AN EDGE CAN CARRY ITS OWN IDENTITY. The two branch lanes are tinted with
     the tokens the fragment glyph already uses for the two halves of the
     molecule — --keep for the cDNA, --accent for the barcodes — so the tracks
     are the same colour as the thing travelling them, and neither needs a
     label. No new colour: those are the two the page already has. */
  const path=el("path",{d:"M "+pp.map(p=>p.join(" ")).join(" L "),fill:"none",
    stroke:rec.tone||"var(--edge)",
    "stroke-width":(faint||still)?"1":(rec.tone?"1.5":"1.3"),
    "stroke-opacity":still?".3":(faint?".35":(rec.tone?".85":".7"))});
  if(rec.dash||still) path.setAttribute("stroke-dasharray","5 4");
  host.appendChild(path);
  pp.slice(1,-1).forEach(c=>host.appendChild(el("rect",
    {x:c[0]-2.4,y:c[1]-2.4,width:4.8,height:4.8,transform:`rotate(45 ${c[0]} ${c[1]})`,
     fill:rec.tone||"var(--edge)","fill-opacity":".5"})));
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
  /* data-id as well as the name, because NAME IS NOT IDENTITY. Two nodes may
     legitimately carry the same name — a second copy of a reference file, say —
     and anything that keys off the name silently merges them. check-text did
     exactly that: it matched each string to a building by aria-label and looked
     up that building's roof in a map keyed by name, so with two "Ensembl 99"s
     one card's labels were tested against the other card's roof and came back
     100% off it. */
  const g=el("g",{tabindex:"0",role:"button","aria-label":n.name,"data-id":n.id});
  g.style.cursor="pointer";
  /* WHAT THIS NODE'S SHAPE REGISTERED, recorded here and nowhere else. A
     resize redraws the shape, and a redraw that cannot say which tickers were
     its own leaves the old one running over elements that have been thrown
     away. Recording it only in redrawNode() was not enough: the FIRST draw's
     ticker was never on the books, so one resize left two. */
  const t0=TICKERS.length;
  DRAW[n.shape](g,n);
  n._ticks=TICKERS.slice(t0);
  if(!TOUCH){
    g.addEventListener("mouseenter",()=>{ if(!editing) show(n.id,false); });
    g.addEventListener("mouseleave",()=>{ if(!editing) unhover(); });
  }
  g.addEventListener("focus",()=>{ if(!editing) show(n.id,false); });
  g.addEventListener("blur",()=>{ if(!editing) unhover(); });
  g.addEventListener("click",ev=>{ev.stopPropagation();
    if(linking){ if(window.linkPick) window.linkPick(n); return; }
    if(!editing) show(n.id,true);});
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
/* THE OUTLINE OF A BOX IS A HEXAGON, AND ITS VERTICAL SIDES ARE AT THE LEFT
   AND RIGHT CORNERS — not at the near and far ones.

   The version this replaces went far-top, right-top, NEAR-top, near-bottom,
   left-bottom, FAR-bottom. On a square footprint the near and far corners
   share a screen x, so two of those edges are the same vertical line travelled
   in opposite directions: the outline crosses itself and the shape between them
   cancels out. On a box a unit or so tall the overlap is a few pixels and
   nobody sees it. On the FASTQ landmark, whose box is the height of the whole
   composition, it drew as a bow tie with a hole through the middle — and that
   hole is the occlusion clip and the drag handle both.

   Far top, right top, right bottom, near bottom, left bottom, left top.
   Convex at any height. */
const nodeSil=n=>{
  const hw=n.w/2, hd=n.d/2, h=topOf(n);
  /* THE LAST POINT IS THE LEFT corner AT THE TOP — (-hw, +hd), not (-hw, -hd).
     Written with -hd it repeats the first point and the outline closes from the
     bottom-left straight back to the far corner, cutting the top-left off the
     shape. On a SQUARE footprint the slice is small enough that the middle of
     the top face is still inside it, so every click landed and nothing showed;
     the first node with w far from d put that middle outside the shape and its
     clicks fell through to the canvas. check-clicks found it in one run. */
  return [P(n.x-hw,n.y-hd,h), P(n.x+hw,n.y-hd,h), P(n.x+hw,n.y-hd,0),
          P(n.x+hw,n.y+hd,0), P(n.x-hw,n.y+hd,0), P(n.x-hw,n.y+hd,h)];
};
const clipPathEl=el("path",{"clip-rule":"evenodd"});
function rebuildClip(){
  const R=40000;
  let d=`M ${-R} ${-R} H ${R} V ${R} H ${-R} Z`;
  /* scenery is painted ON the ground, so punching it out of the clip would
     cut a hole in the very layer it belongs to — and noclip is for an object
     that is not a solid at all. The fragment glyph is a flat diagram floating
     in the air: a track passing under it should be visible passing under it,
     and the two tracks that leave its own ends have to be visible from the
     ends. Punch its box out of the clip and both disappear. */
  NODES.filter(n=>!n.scenery && !n.noclip).forEach(n=>{
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
/* ============================================================
   REDRAW ONE NODE, WHICH IS WHAT A RESIZE COSTS

   Every other edit is a translate on a group that was already drawn — nothing
   re-renders and no ticker is disturbed. A resize is not: w, d and h are read
   by the shape at draw time, so the only way to see a new size is to draw it
   again.

   WHICH MEANS TICKERS HAVE TO BE ACCOUNTED FOR. A shape that animates pushes
   into TICKERS when it draws; draw it a second time and there are two, both
   holding the elements of the first. The count is taken before and after, the
   new ones are remembered on the node, and the next redraw removes them. A
   shape that registers nothing costs nothing here.

   The plinth and the name come from the same numbers and are rebuilt with it.
   The editor's own handle goes back on top, because clearing the group threw
   it away with everything else. */
function redrawNode(n){
  const g=nodeEls[n.id];
  if(!g || !DRAW[n.shape]) return;
  if(n._ticks) n._ticks.forEach(fn=>{ const i=TICKERS.indexOf(fn); if(i>=0) TICKERS.splice(i,1); });
  const before=TICKERS.length;
  while(g.firstChild) g.removeChild(g.firstChild);
  DRAW[n.shape](g,n);
  n._ticks=TICKERS.slice(before);
  if(editing) g.appendChild(el("polygon",{points:pts(nodeSil(n)),class:"ehandle"}));

  const pl=plinthEls[n.id];
  if(pl){
    const pad=0.55, hw=n.w/2+pad, hd=n.d/2+pad;
    pl.setAttribute("points",pts([[n.x-hw,n.y-hd],[n.x+hw,n.y-hd],
      [n.x+hw,n.y+hd],[n.x-hw,n.y+hd]].map(q=>P(q[0],q[1],0))));
  }
  const L=labelEls[n.id];
  if(L){ L.dataset.base=labelBase(n); }
  reposition(n);
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
  BOXES.forEach(box=>applyBox(box,o[box.key]));
  MOVERS.forEach(m=>applyMover(m,o[m.key]));
  NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(m=>gNode.appendChild(nodeEls[m.id]));
  refresh(null);
}

/* ============================================================
   DOTS
   ============================================================ */
const DOTS=[];
/* ONE FACTORY, because the Connect tool makes edges after this block has run
   and a second copy of this drifts from the first the day one of them changes.
   dotTone is separate from tone so a track can be quiet and its dots not. */
function makeDots(e){
  /* nothing travels a reference edge — see paintEdge */
  if(e.still) return;
  const faint = e.kind==="drop"||e.kind==="soup";
  const count = (faint||e.carry)?1:2;
  for(let i=0;i<count;i++){
    const g=el("g"); g.style.cursor="pointer";
    g.appendChild(el("circle",{r:"10",fill:"transparent"}));
    g.appendChild(el("circle",{r:faint?3:3.5,
      fill:e.dotTone||e.tone||(faint?"var(--drop)":"var(--signal)"),
      stroke:"var(--stroke)","stroke-width":"1"}));
    gDot.appendChild(g);
    const rec={e,t:(i/count)+Math.random()*0.1,speed:(faint?26:52)/e.len,node:g};
    g.addEventListener("click",ev=>{ev.stopPropagation();inspect(rec);});
    DOTS.push(rec);
  }
}
edgeGeom.forEach(makeDots);
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
/* THREE BUTTONS ARE GONE — Hide axes, Fit the map, Pause motion — and two of
   them took a feature with them.

   Hide axes went with the ruler it hid. Fit the map is still there as a KEY:
   Home (or 0) re-fits, the hint line says so, and check-clicks.mjs presses it
   between every building it clicks. What it is not any more is a control in a
   bar, because it is a way back rather than a thing to do.

   Pause motion is the one that cost something, and it is worth being honest
   about: prefers-reduced-motion is still read and still obeyed, and it is still
   re-read when it changes — so a machine asking for less motion gets less. What
   is gone is the OVERRIDE, in both directions. Nothing on this page moves far
   or fast; the whole of it is dots on tracks and a pool turning.

   setMotion() and the MOTION_KEY store stay, so putting the control back is one
   line in index.html and one here. */
const resetView=()=>{pinned=null;current=null;renderOverview();paintIndex();glideTo(fitTarget(),1100);};
document.getElementById("btnStages").onclick=()=>aside.classList.toggle("open");

document.getElementById("btnTheme").onclick=e=>{
  document.body.classList.toggle("light");
  e.target.textContent=document.body.classList.contains("light")?"Dark":"Light";
};
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

/* ---- CONNECT TWO ITEMS ---------------------------------------------------
   The one edit on this page that ADDS something rather than moving it, which
   is why it is a mode inside Edit positions rather than a click: a drag that
   sometimes creates a track is a drag nobody can predict. Press the button,
   click one object, click another.

   A link is created the same way a loaded one is — linkEdge(), an entry in
   edgeGeom, dots from the same factory — so from the first frame it is
   indistinguishable from an authored edge, and every later drag repaints it
   without knowing it was drawn by hand. */
let linking=false, linkA=null;
function linkExists(a,b){
  return LIVELINKS.some(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a)) ||
         EDGES.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
}
function addLink(a,b){
  if(a===b || !byId[a] || !byId[b] || linkExists(a,b)) return false;
  const e=linkEdge(a,b);
  LIVELINKS.push({a,b}); EDGES.push(e);
  const rec={...e,host:gEdge.appendChild(el("g")),
             fromName:byId[a].name,toName:byId[b].name};
  paintEdge(rec); edgeGeom.push(rec); makeDots(rec);
  return true;
}
function dropLink(a,b){
  const hit=(l)=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a);
  for(let i=LIVELINKS.length-1;i>=0;i--) if(hit(LIVELINKS[i])) LIVELINKS.splice(i,1);
  for(let i=EDGES.length-1;i>=0;i--) if(EDGES[i].link&&hit(EDGES[i])) EDGES.splice(i,1);
  for(let i=edgeGeom.length-1;i>=0;i--){
    const r=edgeGeom[i];
    if(r.link&&hit(r)){ if(r.host&&r.host.parentNode) r.host.parentNode.removeChild(r.host);
      for(let k=DOTS.length-1;k>=0;k--) if(DOTS[k].e===r||DOTS[k].e.link&&hit(DOTS[k].e)){
        if(DOTS[k].node.parentNode) DOTS[k].node.parentNode.removeChild(DOTS[k].node);
        DOTS.splice(k,1); }
      edgeGeom.splice(i,1); }
  }
}

/* the committed table plus this sitting */
function totalOffset(n){
  const o={};
  const dx=r2(n.x-n._ox), dy=r2(n.y-n._oy), ldx=r2(n._lx), ldy=r2(n._ly);
  if(dx) o.dx=dx; if(dy) o.dy=dy; if(ldx) o.ldx=ldx; if(ldy) o.ldy=ldy;
  const dw=r2(n.w-n._ow), dd=r2(n.d-n._od), dh=r2(n.h-n._oh);
  if(dw) o.dw=dw; if(dd) o.dd=dd; if(dh) o.dh=dh;
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
  BOXES.forEach(box=>{
    const o={}, [bx0,by0,bx1,by1]=box.e.map(r2);
    if(r2(box.dx)) o.dx=r2(box.dx);
    if(r2(box.dy)) o.dy=r2(box.dy);
    if(bx0) o.bx0=bx0; if(by0) o.by0=by0; if(bx1) o.bx1=bx1; if(by1) o.by1=by1;
    if(Object.keys(o).length) out[box.key]=o;
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
  remember(EDIT_KEY,JSON.stringify({offsets:collectOffsets(),links:LIVELINKS,at:Date.now()}));
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
  /* LINKS ARE UNIONED, NOT MERGED KEY BY KEY. They have no key to own — a
     pair is not a property of either end — so "whose is this" cannot be asked
     of one. Taking the union means two people drawing in the same sitting both
     keep their tracks, and the only thing it cannot express is a DELETION of
     somebody else's link. That is the right trade for a mark this cheap to
     redraw and this hard to lose accidentally. */
  const seen=new Set(), links=[];
  [...((doc&&doc.links)||[]), ...LIVELINKS].forEach(l=>{
    if(!l||!l.a||!l.b) return;
    const k=[l.a,l.b].sort().join("\u0000");
    if(seen.has(k)) return; seen.add(k); links.push({a:l.a,b:l.b});
  });
  return {body:{offsets:out,links}, kept};
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
      if(!doc.at) return put({offsets:collectOffsets(),links:LIVELINKS});   // nothing shared yet
      const m=mergeOnto(doc);
      return put(m.body).then(res=>{
        /* what went out is not what is on screen if the merge carried
           somebody else's work through, so keep the merged document */
        if(res && res.ok && m.kept)
          remember(EDIT_KEY,JSON.stringify({offsets:m.body.offsets,links:m.body.links,at:res.at||Date.now()}));
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
  /* ---- THE BAND: A BORDER TO MOVE IT BY, AND FOUR CORNERS TO RESHAPE IT ----
     THE BORDER RATHER THAN THE INTERIOR, and that is not a style choice. The
     band covers the whole map. Give it a filled hit target and in this mode
     every drag that misses a building — which is how you pan — grabs the band
     instead. `pointer-events:stroke` on a polygon with no fill takes presses on
     the outline and nowhere else, so the inside of the map stays what it was.

     They live in their own layer appended last, so a corner can never end up
     underneath something. They are inert until the mode is on, like every other
     handle here. */
  const gBandEdit=world.appendChild(el("g"));
  BOXES.forEach(box=>{
    /* ONE ELEMENT IS BOTH THE TARGET AND THE FEEDBACK. A separate dashed
       outline on top of this — the obvious way to show "grabbable" — sits on
       exactly the same geometry and, being an .ehandle, takes the press
       instead: two of the four edges were dead. The fat translucent stroke IS
       the affordance. */
    box.hit=gBandEdit.appendChild(el("polygon",{class:"ehit bandedge",fill:"none",
      stroke:"transparent","stroke-width":"16","pointer-events":"stroke"}));
    for(let k=0;k<4;k++)
      box.corners.push(gBandEdit.appendChild(
        el("rect",{class:"ehandle bandcorner",width:"14",height:"14"})));
    box.reflow();
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
  /* ---- AND A PICKED NODE CAN BE RESIZED ---------------------------------
     The ✕ appears on a pick because deleting is the one thing that cannot be
     undone by dragging back. Resizing appears there too, and for the opposite
     reason: it can, but it needs handles, and four corners on every object at
     once would bury the map under its own tooling. One object at a time is
     enough, and it is the object you just pointed at.

     FOUR CORNERS ON THE TOP FACE AND ONE IN THE MIDDLE. The corners take w and
     d; the middle one takes h and is dragged up the screen. They are SVG rects
     inside `world`, so they ride the camera for free and cannot shear — the
     world group carries a translate and a scale and nothing else. The ✕ has to
     be HTML for that same reason and cannot be, because it must also sit
     outside the group it offers to delete.

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
    const hw=n.w/2, hd=n.d/2, h=topOf(n);
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
  function pick(what){ picked=what; placeX(); placeResize(); }
  function unpick(){ picked=null; placeX(); placeResize(); }

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
    /* CONNECT MODE OWNS THE PRESS. preventDefault plus a pointer capture on the
       way down means no `click` is ever delivered, so leaving the drag armed
       while connecting swallows exactly the event the tool is listening for —
       the mode looked on, the cursor changed, and nothing happened. Taking
       pointer-events off the handles is not enough on its own: the press still
       lands on the node's own group, which is where this handler is. */
    if(linking) return;
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
    if(grab.mode==="size"){
      const n=grab.n, q=v=>Math.round(v/SNAP)*SNAP;
      if(grab.corner===4){
        /* HEIGHT IS SCREEN-VERTICAL AND NOTHING ELSE. z is the one axis this
           projection draws straight up, so a height drag divides by S*CZ and
           never touches the ground-plane inverse. */
        n.h=Math.max(0.02, r2(grab.oh + q(-(ev.clientY-grab.py)/view.k/(S*CZ))));
      } else {
        const [dx,dy]=toWorldD((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
        const sx=(grab.corner===1||grab.corner===2)?1:-1;
        const sy=(grab.corner===2||grab.corner===3)?1:-1;
        const gw=q(dx)*sx, gd=q(dy)*sy;
        n.w=Math.max(MINWD, r2(grab.ow+gw)); n.d=Math.max(MINWD, r2(grab.od+gd));
        /* the opposite corner holds still, so the centre takes half the growth */
        n.x=r2(grab.ox+(n.w-grab.ow)*sx/2); n.y=r2(grab.oy+(n.d-grab.od)*sy/2);
      }
      redrawNode(n); refresh(n.id); placeResize(); placeX();
      if(hint) hint.textContent=`${n.key} · ${n.name} — w ${n.w.toFixed(2)}`+
        `  d ${n.d.toFixed(2)}  h ${n.h.toFixed(2)}`;
      return;
    }
    const [dx,dy]=toWorldD((ev.clientX-grab.px)/view.k,(ev.clientY-grab.py)/view.k);
    const q=v=>Math.round(v/SNAP)*SNAP;
    if(grab.mode==="box" || grab.mode==="corner"){
      const box=grab.box;
      if(grab.mode==="box"){ box.dx=r2(grab.ox+q(dx)); box.dy=r2(grab.oy+q(dy)); }
      else {
        /* which extents this corner owns: 0=(x0,y0) 1=(x1,y0) 2=(x1,y1) 3=(x0,y1) */
        const xi=(grab.corner===1||grab.corner===2)?2:0;
        const yi=(grab.corner===2||grab.corner===3)?3:1;
        box.e=grab.oe.slice();
        box.e[xi]=r2(grab.oe[xi]+q(dx));
        box.e[yi]=r2(grab.oe[yi]+q(dy));
      }
      box.reflow();
      const [x0,y0,x1,y1]=box.rect();
      if(hint) hint.textContent=`${box.name} band — x ${x0.toFixed(2)}..${x1.toFixed(2)}`+
        `   y ${y0.toFixed(2)}..${y1.toFixed(2)}`;
      return;
    }
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
    if(grab.mode==="size"){
      const n=grab.n; const moved=travelled; grab=null;
      if(moved){ markDirty(n.id); refresh(null);
        NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y))
             .forEach(m=>gNode.appendChild(nodeEls[m.id])); }
      return;
    }
    if(grab.mode==="box" || grab.mode==="corner"){
      const k=grab.box.key; const moved=travelled; grab=null;
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
      : "Drag to move · click to pick, then drag a corner to resize or × to delete · Save positions when done";
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

  /* THE BAND ITSELF. Two grabs on one object: the border moves it, a corner
     reshapes it. A corner owns two of the four extents and touches no others,
     so dragging one never drifts the opposite edge. */
  BOXES.forEach(box=>{
    const start=(ev,mode,k)=>{
      if(!editing) return;
      ev.stopPropagation(); ev.preventDefault();
      const t=ev.currentTarget;
      if(t.setPointerCapture) t.setPointerCapture(ev.pointerId);
      grab={box,mode,corner:k,px:ev.clientX,py:ev.clientY,moved:0,
            ox:box.dx,oy:box.dy,oe:box.e.slice()};
      t.classList.add("picked");
    };
    const stop=ev=>{ if(ev.currentTarget) ev.currentTarget.classList.remove("picked"); end(ev); };
    box.hit.addEventListener("pointerdown",ev=>start(ev,"box"));
    box.hit.addEventListener("pointermove",move);
    ["pointerup","pointercancel"].forEach(t=>box.hit.addEventListener(t,stop));
    box.corners.forEach((h,k)=>{
      h.addEventListener("pointerdown",ev=>start(ev,"corner",k));
      h.addEventListener("pointermove",move);
      ["pointerup","pointercancel"].forEach(t=>h.addEventListener(t,stop));
    });
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

  /* ---- THE CONNECT MODE ------------------------------------------------
     It lives inside Edit positions and turns itself off when that does, for
     the same reason the ✕ does: a tool that can add a track to the map should
     not be reachable from the reading view.

     WHILE IT IS ON, THE DRAG HANDLES ARE INERT — `svg.linking` takes
     pointer-events off .ehandle and .ehit — so a press lands on the node's own
     group and comes back as a click. Leaving them live and trying to tell a
     click from a drag is the version that misfires every time somebody moves
     the mouse two pixels. */
  const btnLink=document.getElementById("btnLink");
  const hintLink="Connect: click one object, then another. Press the button "+
                 "again to stop. Save positions makes it the default.";
  function paintLinkA(){
    NODES.forEach(n=>{ const el2=nodeEls[n.id];
      if(el2) el2.classList.toggle("linkfrom", !!linkA && n.id===linkA); });
  }
  function setLinking(on){
    linking=on; linkA=null; paintLinkA();
    svg.classList.toggle("linking",on);
    document.body.classList.toggle("linking",on);
    if(btnLink) btnLink.textContent=on?"Stop connecting":"Connect two items";
    if(hint) hint.textContent = on ? hintLink : (editing?hint.textContent:hint0);
  }
  window.linkPick=n=>{
    if(!linking) return;
    if(!linkA){ linkA=n.id; paintLinkA();
      note("Connect",`From <mark>${esc(n.key+" · "+n.name)}</mark> — now click the other one.`,4000);
      return; }
    if(n.id===linkA){ linkA=null; paintLinkA(); return; }   /* clicking it again cancels */
    const from=linkA; linkA=null; paintLinkA();
    if(addLink(from,n.id)){
      dirty=true; touched.add("__links");
      note("Connected",`<mark>${esc(byId[from].key)}</mark> to `+
        `<mark>${esc(n.key)}</mark>. Press <mark>Save positions</mark> to make it `+
        `the default for everyone.`,6000);
    } else {
      note("Already joined","Those two are connected already.",3500);
    }
  };
  if(btnLink) btnLink.onclick=()=>setLinking(!linking);

  function setMode(on){
    editing=on;
    if(!on && linking) setLinking(false);
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
      (LIVELINKS.length?`<h4>Connections</h4><div class="snip">${
        esc("const LINKS = [\n"+LIVELINKS.map(l=>`  {a:${JSON.stringify(l.a)}, b:${JSON.stringify(l.b)}},`).join("\n")+"\n];")
      }</div>`:"")+
      `<h4>What this did</h4>`+
      `<p>Written to this browser and to the shared copy, so the page opens `+
      `this way for anyone. Paste the block into <mark>OFFSETS</mark> in `+
      `<mark>fq-data.js</mark> to put it in the repo, where it survives the `+
      `store being cleared.</p>`+
      (LIVELINKS.length?`<p>Connections are their own list because a pair is not `+
        `a property of either end. Paste it into <mark>LINKS</mark> in `+
        `<mark>fq-data.js</mark>.</p>`:"")+
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
    remember(EDIT_KEY,JSON.stringify({offsets:doc.offsets||{},links:doc.links||[],at:doc.at}));
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
