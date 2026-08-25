/* ============================================================
   fq-iso.js — the isometric primitives.

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
   roofFrame — A FLAT DRAWING, LAID ONTO A HORIZONTAL SURFACE BY ONE MATRIX.

   LIFTED VERBATIM FROM /culls/culls-draw.js, where the four roofed culls both
   /pipeline and /bioinformatics_pipe draw keep it. It belongs in an iso file —
   it is projection, not subject matter — and this page's header has claimed it
   was here since the day the roofs moved out. It was not, and nothing noticed,
   because requires() cannot actually see a missing `const` (see the note at the
   top of fq-view.js).

   NOTHING ON THIS PAGE CALLS IT TODAY, which is the same footing ellipseAt is
   on above. drawReads briefly did, and stopped: its diagram is square to the
   reader rather than lying on a surface. It stays because a shape ported from
   either of the other two maps arrives expecting it, and because the next flat
   thing that does want to lie on a roof should not have to go and find it
   again.

   WHY IT EXISTS. A drawing rebuilt in three dimensions occludes the very thing
   it exists to show. So it is not rebuilt: it is drawn in ordinary flat 2D — in
   a CW x CW chart space — and one transform="matrix()" lays that space onto the
   horizontal plane at height H. Everything inside comes out sheared correctly
   for free, which is where this map's grammar comes from:

     PAINTED things are ELLIPSES.  AIRBORNE things are CIRCLES.

   A circle drawn in chart space arrives as the correctly-oriented ellipse; the
   same circle drawn in screen space arrives as a circle. No branch, no special
   case.

   ORIENTATION AT turn 0: local +x runs up and to the right at -30 degrees — the
   same angle the step names and the band titles read at — and local +y runs
   down and to the right at +30. So an unrotated string in here reads like every
   other string on the map, and a block of text FANS: it grows right-down as it
   gets wider and left-down as it gets taller. Single lines are fine. Paragraphs
   are not, and never will be.
   ============================================================ */
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


/* ============================================================
   roofPanel — THE SAME TRICK ON A RECTANGULAR ROOF.

   roofFrame above is SQUARE by construction: it takes one side from n.w and
   uses it for both axes, because every chart it was written for is square. The
   two reference figures on this page are not — a row of twenty-five ideograms
   and a gene model laid end to end both want a roof much longer than it is
   deep. So this takes the footprint from n.w AND n.d, and derives the chart's
   own height from them so nothing is stretched:

     local +x runs along the roof's d extent, 0..CW
     local +y runs along the roof's w extent, 0..CH,  CH = CW * w/d

   Which means CW is a resolution rather than a shape — pick it, and CH follows
   from the building. Change the footprint and the drawing rescales; change the
   ASPECT and the drawing reflows, which is the whole reason a figure gets to
   ask for a roof that is not square.

   roofFrame is left exactly as it was lifted. Two functions rather than one
   generalised one, because that file is /culls' and this one is ours.

   Same orientation rule at turn 0: local +x advances up and to the right at
   -30 degrees, the angle every string on this map reads at, so text laid in
   here follows the roof. Single lines only — a block still fans.
   ============================================================ */
function roofPanel(g,n,H,CW,inset){
  const ins=(inset===undefined?0.92:inset);
  const cw=n.w*ins, cd=n.d*ins, CH=CW*cw/cd;
  const x0=n.x-cw/2, x1=n.x+cw/2, y0=n.y-cd/2, y1=n.y+cd/2;

  const c00=P(x0,y1,H);                   /* chart (0,0)  */
  const cX =P(x0,y0,H);                   /* chart (CW,0) */
  const cY =P(x1,y1,H);                   /* chart (0,CH) */
  const Ux=(cX[0]-c00[0])/CW, Uy=(cX[1]-c00[1])/CW;
  const Vx=(cY[0]-c00[0])/CH, Vy=(cY[1]-c00[1])/CH;

  const host=g.appendChild(el("g",
    {transform:`matrix(${Ux} ${Uy} ${Vx} ${Vy} ${c00[0]} ${c00[1]})`}));

  return {g:host, CW, CH, u:CH/100,
    toScreen:(lx,ly)=>[c00[0]+lx*Ux+ly*Vx, c00[1]+lx*Uy+ly*Vy]};
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
