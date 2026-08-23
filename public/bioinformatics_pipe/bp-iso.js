/* ============================================================
   bp-iso.js — the isometric primitives.

   Owned by the rendering side. Nothing here knows what a barcode is.
   This is pipeline-iso.js's vocabulary, kept deliberately identical so a
   shape written for /pipeline drops into this page and vice versa — plus
   the two things a page made of ROOF CHARTS needs and /pipeline does not:
   ellipseAt() and roofFrame().

   Load order: iso -> pop -> shapes -> data -> view
   ============================================================ */

/* ============================================================
   PROJECTION
   A 2:1 DIMETRIC, not a true 30-degree isometric. Everything on the page —
   layout, label angles, painter ordering, the camera, and every roof matrix
   below — derives from P(). Swapping it is not a refactor, it is a rewrite.
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

/* A circle on a horizontal surface is an ELLIPSE, and these are its radii.
   Drawing it as a circle is the commonest tell of a fake isometric.

   NOTHING ON THIS PAGE CALLS THIS, and that is worth a sentence rather than a
   deletion. Every ellipse here — the painted cells, and the shadows the
   airborne ones cast — comes out of the roof matrix for free, because a
   circle drawn in chart space is already an ellipse by the time it reaches
   the screen. This is kept because it is part of the vocabulary shared with
   /pipeline: a shape ported from that map arrives expecting it, and any
   element drawn on the GROUND rather than on a roof needs it. */
function ellipseAt(cx,cy,z,R){
  const [x,y]=P(cx,cy,z);
  return {x,y,rx:R*S*C30*Math.SQRT2, ry:R*S*0.5*Math.SQRT2};
}

/* ============================================================
   THE ROOF MATRIX — the trick the whole page is built on.

   A cull is a two-dimensional argument: a curve with a cut on it, a cloud
   with a band through it. Rebuilding those in three dimensions would occlude
   the very thing they exist to show, and a chart you have to orbit to read is
   not a chart. So the chart is NOT rebuilt in 3D. It is drawn in ordinary,
   flat, boring 2D — axes, ticks, polylines, circles — and then the whole
   drawing is laid onto the horizontal roof of a building by ONE
   transform="matrix()" built from three projected corners.

   Everything follows from that:

     - a circle painted in chart space becomes the correct ELLIPSE, correctly
       oriented, for free. No per-mark trigonometry anywhere.
     - the chart cannot be occluded by anything, because it is the top face.
     - the element still sits in the isometric world, so a building can stand
       next to another building and the map reads as one place.

   And it hands the page its grammar, which is worth stating once because
   every cull obeys it:

       PAINTED things are ELLIPSES.  AIRBORNE things are CIRCLES.

   A cell that is still under consideration is painted on the roof. A cell
   that is leaving lifts OFF the surface and becomes a circle — a sphere, in
   effect — with a shadow on the roof beneath it. That is why each cull's
   gesture can be different and still mean the same thing: leaving.

   roofFrame() returns everything a chart needs and nothing it does not:

     g        the group to draw the flat chart into. Draw in chart space.
     CW       chart space is CW x CW, origin top-left, y down. Like an <svg>.
     toScreen(lx,ly)   chart space -> screen, for labels that must NOT be
                       sheared (a leader line, an annotation that stays
                       upright and legible over the roof)
     toWorld(lx,ly)    chart space -> world x,y at roof height, for anything
                       that is about to leave the surface and needs a real
                       position in the isometric world to leave FROM
     toLocal(sdx,sdy)  a screen delta -> a chart-space delta, the inverse

   Note toWorld's axis swap at turn 0: chart x runs along decreasing world y
   and chart y along increasing world x. That is what makes the axis titles
   come out readable rather than upside down. It is not arbitrary and it is
   not a bug — and see TURN below for when to lay the chart the other way.
   ============================================================ */
/* TURN — which roof edge the chart's x-axis runs along, and it is not
   cosmetic. Chart x and chart y map to the two roof diagonals, one going
   up-right and one going down-right. A chart whose data trends diagonally
   therefore has its trend mapped onto the SUM or the DIFFERENCE of those two
   directions — which is to say onto the horizontal or onto the VERTICAL.

   The complexity roof is the case that forced this. Genes against transcripts
   is a straight diagonal in log-log, and at turn 0 its cloud came out as a
   near-vertical sliver: geometrically correct, and useless. Turned a quarter,
   the same cloud lies along the roof. Nothing about the data changed; only
   which edge it was laid against.

   The rule for a new roof: if the data trends up-and-right in chart space,
   turn it. If it trends down-and-right — a rank curve, a histogram — leave
   it. Both orientations keep a positive determinant, so text is never
   mirrored; it only changes which of the two diagonals it reads along, and
   the map already reads at both. */
function roofFrame(g,n,H,CW,inset,turn){
  const ch=n.w*(inset===undefined?0.92:inset);
  const x0=n.x-ch/2, x1=n.x+ch/2, y0=n.y-ch/2, y1=n.y+ch/2;

  const c00=turn?P(x0,y0,H):P(x0,y1,H);   /* chart origin */
  const cX =turn?P(x1,y0,H):P(x0,y0,H);   /* chart (CW,0) */
  const cY =turn?P(x0,y1,H):P(x1,y1,H);   /* chart (0,CW) */
  const Ux=(cX[0]-c00[0])/CW, Uy=(cX[1]-c00[1])/CW;
  const Vx=(cY[0]-c00[0])/CW, Vy=(cY[1]-c00[1])/CW;
  const det=Ux*Vy-Vx*Uy;

  const host=g.appendChild(el("g",
    {transform:`matrix(${Ux} ${Uy} ${Vx} ${Vy} ${c00[0]} ${c00[1]})`}));

  return {
    g:host, CW, x0, x1, y0, y1, turn:!!turn,
    toScreen:(lx,ly)=>[c00[0]+lx*Ux+ly*Vx, c00[1]+lx*Uy+ly*Vy],
    toWorld :turn ? (lx,ly)=>[x0+(lx/CW)*(x1-x0), y0+(ly/CW)*(y1-y0)]
                  : (lx,ly)=>[x0+(ly/CW)*(x1-x0), y1-(lx/CW)*(y1-y0)],
    toLocal :(sdx,sdy)=>[(Vy*sdx-Vx*sdy)/det, (-Uy*sdx+Ux*sdy)/det]
  };
}

/* Hatch patterns, referenced by shapes as url(#hL) etc. Call once per <svg>.
   Hatching means one thing on this page and it is the same thing it means on
   /pipeline: THE STAGE DESTROYS DATA. All four culls carry it. */
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
   inherit pause and prefers-reduced-motion for free, and six buildings with
   six clocks drift apart until the sequence stops being a sequence. */
const TICKERS=[];

/* Lay each LANE out from its own contents, then mirror the lanes that run
   right-to-left so the map snakes. Mutates NODES.x and NODES.y in place; call
   once before anything is drawn.

   A lane is {id, y, x0, x1, dir}. Membership is explicit — a node opts in
   with lane:"<id>" — because a row can carry more than one lane at once, and
   inferring membership from y would interleave them. Side structures (the
   ones with follow{}) belong to no lane: they keep their authored y and take
   their x from whatever they follow, after the lanes are placed. */
function layoutRows(NODES, LANES, MIRROR){
  const M={}; NODES.forEach(n=>M[n.id]=n);
  const byLane={}; LANES.forEach(L=>byLane[L.id]=L);
  (function place(){
    const GAP_MINOR=0.6, GAP_MAJOR=1.5;
    const big=n=>n.anchor||n.shape==="works";
    /* a node may set gap:<constant> to override the space BEFORE it, for the
       case where the major/minor rule pushes two things apart that belong
       together. The lane still scales it with everything else. */
    const gapFor=(a,b)=> b.gap!==undefined ? b.gap
                       : ((big(a)||big(b)) ? GAP_MAJOR : GAP_MINOR);
    LANES.forEach(L=>{
      const on=NODES.filter(n=>n.lane===L.id && !n.follow).sort((a,b)=>a.x-b.x);
      if(!on.length) return;
      on.forEach(n=>n.y=L.y);
      let cur=L.x0+on[0].w/2; on[0].x=cur;
      if(on.length<2) return;
      let sw=on[0].w; const gaps=[];
      for(let i=1;i<on.length;i++){ gaps.push(gapFor(on[i-1],on[i])); sw+=on[i].w; }
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
  /* mirror after follow{} resolves, so a side structure flips with the lane
     it tracks rather than against it */
  NODES.forEach(n=>{
    const id = n.lane || (n.follow && M[n.follow.a] ? M[n.follow.a].lane : null);
    const L = id ? byLane[id] : null;
    if(L && L.dir===-1) n.x = MIRROR - n.x;
  });
}
