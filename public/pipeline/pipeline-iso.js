/* ============================================================
   pipeline-iso.js — the isometric primitives.
   Owned by the rendering side. Nothing here knows what a zebrafish is.
   Load order: iso -> shapes -> data -> view
   ============================================================ */

/* ============================================================
   PROJECTION
   ============================================================ */
const S=42, CZ=0.76, C30=Math.cos(Math.PI/6);
const P=(x,y,z)=>[ (x-y)*S*C30, (x+y)*S*0.5 - (z||0)*S*CZ ];
const pts=a=>a.map(p=>p.join(",")).join(" ");
const rng=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};

function faces(x,y,w,d,h){
  const hw=w/2,hd=d/2;
  const c=[[x-hw,y-hd],[x+hw,y-hd],[x+hw,y+hd],[x-hw,y+hd]];
  return {
    top:pts(c.map(p=>P(p[0],p[1],h))),
    right:pts([P(c[1][0],c[1][1],h),P(c[2][0],c[2][1],h),P(c[2][0],c[2][1],0),P(c[1][0],c[1][1],0)]),
    left:pts([P(c[3][0],c[3][1],h),P(c[2][0],c[2][1],h),P(c[2][0],c[2][1],0),P(c[3][0],c[3][1],0)])
  };
}


/* SVG helpers */
const NS="http://www.w3.org/2000/svg";
const el=(t,at)=>{const e=document.createElementNS(NS,t);for(const k in at)e.setAttribute(k,at[k]);return e;};

function paint(g,x,y,w,d,h,s,hatch){
  const f=faces(x,y,w,d,h);
  ["left","right","top"].forEach(k=>g.appendChild(el("polygon",
    {points:f[k],fill:s[k],"fill-opacity":s.fo||1,stroke:"var(--stroke)","stroke-width":s.sw||1,"stroke-opacity":s.so||1})));
  if(hatch){
    g.appendChild(el("polygon",{points:f.left,fill:"url(#hL)"}));
    g.appendChild(el("polygon",{points:f.right,fill:"url(#hR)"}));
    g.appendChild(el("polygon",{points:f.top,fill:"url(#hT)"}));
  }
  return f;
}

/* Hatch patterns, referenced by shapes as url(#hL) etc. Call once per <svg>. */
function installDefs(svg){
  const defs=el("defs");
  [["hL",".24"],["hR",".32"],["hT",".14"]].forEach(([id,op])=>{
    const p=el("pattern",{id,patternUnits:"userSpaceOnUse",width:"5",height:"5",patternTransform:"rotate(30)"});
    p.appendChild(el("line",{x1:"0",y1:"0",x2:"0",y2:"5",stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":op}));
    defs.appendChild(p);
  });
  svg.appendChild(defs);
  return defs;
}

/* Anything that animates registers here. The single frame loop in the view
   calls each ticker with (dt, now, zoom). Never start your own loop: tickers
   inherit pause, trace-one-step and prefers-reduced-motion for free. */
const TICKERS=[];

/* Lay each LANE out from its own contents, then mirror the lanes that run
   right-to-left so the map snakes. Mutates NODES.x and NODES.y in place; call
   once before anything is drawn.

   A lane is {id, y, x0, x1, dir}. Membership is explicit — a node opts in with
   lane:"<id>" — because a row can carry more than one lane at once. Row 1 forks
   into a biology lane above the centreline and a chemistry lane below it, and
   inferring membership from y would interleave the two. Side structures (the
   ones with follow{}) belong to no lane: they keep their authored y and take
   their x from whatever they follow, after the lanes are placed. */
function layoutRows(NODES, LANES, MIRROR){
  /* Lay each lane out from its own contents: steps within a cluster sit close
     together, and a landmark always stands well clear of the cluster either side
     of it. Gaps are then scaled so the lane fills its own span. */
  const M={}; NODES.forEach(n=>M[n.id]=n);
  const byLane={}; LANES.forEach(L=>byLane[L.id]=L);
  (function place(){
    const GAP_MINOR=0.6, GAP_MAJOR=1.5;
    const big=n=>n.anchor||n.shape==="works"||n.shape==="machine";
    /* a node may set gap:<constant> to override the space BEFORE it, for the
       case where the major/minor rule pushes two things apart that belong
       together. The lane still scales it with everything else. */
    /* A LANE MAY ASK FOR EQUAL GAPS. The major/minor rule gives a landmark
       room to stand clear of the cluster either side of it, which is right on
       a row that is mostly small steps with two big things in it. On a row
       whose objects are all landmarks, or all the same size, it does the
       opposite: it invents a rhythm out of nothing and the row reads as
       clustered when nothing about it is. `even:true` on the lane says the
       spacing carries no meaning here, so make every gap the same. A node's
       own `gap` still wins — that is an explicit statement about one pair. */
    const gapFor=(a,b,L)=> b.gap!==undefined ? b.gap
                       : L.even ? 1
                       : ((big(a)||big(b)) ? GAP_MAJOR : GAP_MINOR);
    LANES.forEach(L=>{
      const on=NODES.filter(n=>n.lane===L.id && !n.follow).sort((a,b)=>a.x-b.x);
      if(!on.length) return;
      on.forEach(n=>n.y=L.y);
      let cur=L.x0+on[0].w/2; on[0].x=cur;
      if(on.length<2) return;
      let sw=on[0].w; const gaps=[];
      for(let i=1;i<on.length;i++){
        gaps.push(gapFor(on[i-1],on[i],L)); sw+=on[i].w;
      }
      const k=Math.max(0.25,(L.x1-L.x0-sw)/gaps.reduce((a,b)=>a+b,0));
      for(let i=1;i<on.length;i++){
        cur+=on[i-1].w/2 + gaps[i-1]*k + on[i].w/2; on[i].x=cur;
      }
    });
    NODES.filter(n=>n.follow).forEach(n=>{
      const A=M[n.follow.a], B=n.follow.b?M[n.follow.b]:null;
      n.x = B ? (A.x+B.x)/2 : A.x + (n.follow.dx||0);
    });
  })();
  /* mirror after follow{} resolves, so a side structure flips with the lane it
     tracks rather than against it */
  NODES.forEach(n=>{
    const id = n.lane || (n.follow && M[n.follow.a] ? M[n.follow.a].lane : null);
    const L = id ? byLane[id] : null;
    /* A LANE MAY SET ITS OWN MIRROR AXIS. Row 3 is longer than the others —
       its four roofed culls each carry a chart and need the room — so row 4
       has to turn back from where row 3 actually ends rather than from the
       map's default axis, or the snake does not close. */
    if(L && L.dir===-1) n.x = (L.mirror===undefined?MIRROR:L.mirror) - n.x;
  });
}

/* ---- NOTHING IS BORN AT THE ORIGIN ---------------------------------------

   An SVG element created with style attributes and no geometry sits at 0,0 —
   a long way from any node. It is invisible if its opacity is zero, so nothing
   looks wrong; but the selection halo is a CSS filter whose region is the
   group's bounding box, so one loose element stretches that halo from the node
   across the whole map. validate.js has failed on this rule for a long time.

   IT IS NOT A MISTAKE IN THE SHAPES THAT DO IT. Row 3's belts and fields
   create every read's polygons up front and give them coordinates when that
   read comes round — which is the right way to animate a hundred of anything,
   and it means an element legitimately exists for a moment before it has a
   position. Fifteen hundred of them across three shapes.

   So the invariant is enforced ONCE, here, rather than at fifteen hundred
   creation sites where the next new shape would forget it anyway: after a node
   is drawn, anything still lacking geometry is given a zero-extent one at that
   node's own centre. It is where the element belongs until it is told
   otherwise, it costs nothing to draw, and the halo never leaves the building.
   A shape that sets its own geometry, or places itself with a transform, is
   untouched. */
const GEOM_NEEDS={circle:["cx","cy"],ellipse:["cx","cy"],rect:["x","y"],
  line:["x1","y1","x2","y2"],path:["d"],polygon:["points"],polyline:["points"],
  text:["x","y"],image:["x","y"]};
function groundLoose(g,n){
  const c=P(n.x,n.y,topOf(n)||0), cx=c[0].toFixed(1), cy=c[1].toFixed(1);
  (function walk(e){
    for(const k of e.children||[]){
      const need=GEOM_NEEDS[k.tagName];
      if(need && !k.getAttribute("transform") &&
         !need.every(a=>{const v=k.getAttribute(a); return v!==null && v!=="";})){
        if(k.tagName==="path")                       k.setAttribute("d",`M ${cx} ${cy}`);
        else if(/^poly/.test(k.tagName))             k.setAttribute("points",`${cx},${cy}`);
        else if(k.tagName==="line"){ k.setAttribute("x1",cx); k.setAttribute("y1",cy);
                                     k.setAttribute("x2",cx); k.setAttribute("y2",cy); }
        else if(/^(circle|ellipse)$/.test(k.tagName)){ k.setAttribute("cx",cx); k.setAttribute("cy",cy); }
        else { k.setAttribute("x",cx); k.setAttribute("y",cy); }
      }
      walk(k);
    }
  })(g);
}
