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
    LANES.forEach(L=>{
      const on=NODES.filter(n=>n.lane===L.id && !n.follow).sort((a,b)=>a.x-b.x);
      if(!on.length) return;
      on.forEach(n=>n.y=L.y);
      let cur=L.x0+on[0].w/2; on[0].x=cur;
      if(on.length<2) return;
      let sw=on[0].w; const gaps=[];
      for(let i=1;i<on.length;i++){
        gaps.push((big(on[i])||big(on[i-1]))?GAP_MAJOR:GAP_MINOR); sw+=on[i].w;
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
    if(L && L.dir===-1) n.x = MIRROR - n.x;
  });
}
