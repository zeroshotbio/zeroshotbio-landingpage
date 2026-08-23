/* ============================================================
   bp-shapes.js — the visual vocabulary.

   THREE SHAPES COPIED, ONE ADDED.

   The three are lifted verbatim from /pipeline's pipeline-shapes.js, because
   this page IS row 3 of that map and its objects have to be the same objects:
   drawTile for every step and every cull, drawHeap for the FASTQs, drawMatrix
   for the two cubes at either end of the culls. If one of them changes there,
   change it here too — a step that looks different on the two maps is telling
   a reader they are looking at two different things.

   The one added is drawComplexityRoof, and it is the point of this page.

   WHY A ROOF
   Node D5, "Outliers off the trend", fits genes detected against total counts
   and removes points sitting too far off the fit. That is a two-dimensional
   argument. On the big map it is a 0.7-unit hatched box with the argument in
   the text, which is the right call there — it is one of nineteen objects in
   one of four rows. Here there is room to draw it.

   Rebuilding a scatter in three dimensions occludes the very thing it exists
   to show, and a chart you have to orbit to read is not a chart. So it is not
   rebuilt. It is drawn in ordinary flat 2D — axes, ticks, a polyline, circles,
   in a 176 x 176 chart space — and laid onto the horizontal roof of a building
   by one transform="matrix()". See roofFrame() in bp-iso.js.

   That hands it a grammar, and the grammar is what makes the animation read:

       PAINTED things are ELLIPSES.  AIRBORNE things are CIRCLES.

   A cell still under consideration is painted on the roof, and the matrix
   turns its circle into the correctly-oriented ellipse for free. A cell that
   is LEAVING lifts off the surface and becomes a true circle, with a shadow on
   the roof beneath it.

   BOTH TAILS GO, FOR OPPOSITE REASONS, and the two gestures are deliberately
   not each other's mirror: under-amplified cells PEEL OFF the surface,
   over-amplified ones SWELL where they lie and BURST. Reading this filter as
   one-sided is the common mistake, so the two annotations sit diagonally
   opposed and one of them never leaves the roof at all.

   ONE UNIT GOVERNS THE ROOF
   Chart space is CW x CW whatever the building's size, so every type size,
   tick, dot radius and pad below is in chart units. There is not one
   screen-pixel literal in the roof code.

   Load order: iso -> pop -> shapes -> data -> view
   ============================================================ */

const V=n=>`var(--${n})`;

/* Copied from /pipeline. tile and anchor are the skins its row 3 uses; works
   is the skin the added building wears, so it reads as a different KIND of
   object from the steps it hangs under rather than as another step. */
const SKIN={
  tile  :{top:V("t-top"), left:V("t-left"), right:V("t-right"), sw:1,   so:.6},
  anchor:{top:V("a-top"), left:V("a-left"), right:V("a-right"), sw:1.7, so:1},
  works :{top:V("k-top"), left:V("k-left"), right:V("k-right"), sw:1.4, so:1},
};

/* Every object on this page is a box, so the height a structure reaches is
   simply its height. On /pipeline this function has four special cases, all of
   them for shapes that live on other rows. The label anchor and the occlusion
   silhouette both read it. */
const topOf = n => n.h;

const MONO='ui-monospace,"SF Mono",Menlo,Consolas,monospace';

/* ============================================================
   THE DERIVED MODEL

   The one modelled thing on this page, and it exists because the real thing
   cannot be drawn: Parse Trailmaker fits a spline PER SAMPLE at a p-level
   spanning 6.9e-6 to 1e-3 across a single plate, so there is no single band
   that would be true of the run. What the roof shows is the SHAPE of the
   decision, computed at load from the population in bp-pop.js — a
   least-squares cubic and a robust residual sigma, both solved here, neither
   a literal. Reseed and the fit, the sigma and the band all move.

   That is not fussiness. A hardcoded band sits in the same place no matter
   what the cloud does, and the roof stops being a computation and becomes an
   illustration of one. It is invisible when right and obvious when wrong.

   It also means the figures on that roof are MODELLED and every other figure
   on this page is REAL. The roof says so, its label on the map says so, and
   the reader says so. Do not let it lose the word.

   bp-pop.js also computes the knee, the mito cutoff and the doublet
   threshold. Nothing here draws them — the culls on this row are /pipeline's
   own tiles — but check-sim.mjs still asserts the population supports them,
   because the population is the same population and a change that breaks one
   statistic has broken the model the band is fitted to.
   ============================================================ */
const MODEL=(()=>{
  const cells=makeBarcodes().filter(c=>c.isCell);
  const band=cubicBand(cells);
  const resid=c=>Math.log10(c.genes)-band.fit(Math.log10(c.umi));
  return {
    cells, band, resid,
    cplxHi:cells.filter(c=>resid(c)>band.half),    /* under-amplified */
    cplxLo:cells.filter(c=>resid(c)<-band.half),   /* over-amplified  */
  };
})();

/* ============================================================
   CHART SPACE
   Origin top-left, y down, exactly like an <svg> — because that is what it
   is, right up until the matrix picks it up and lays it on a roof.
   ============================================================ */
const CW=176, PAD={l:48,r:13,t:22,b:34};
const CX0=PAD.l, CY0=PAD.t, CWD=CW-PAD.l-PAD.r, CHT=CW-PAD.t-PAD.b;
const T_AXIS=12, T_TICK=10;

const cxOf=(v,d)=>CX0+((v-d[0])/(d[1]-d[0]))*CWD;      /* value -> chart x */
const cyOf=(v,d)=>CY0+CHT-((v-d[0])/(d[1]-d[0]))*CHT;  /* value -> chart y */

/* ------------------------------------------------------------------
   POOLS — batch(), the canvas trick, in SVG.

   Six roofs carrying thousands of marks between them cannot be thousands of
   elements: the cost is not the arithmetic, it is asking the browser to lay
   out and repaint one node per dot, every frame. So a whole cloud is ONE
   <path> whose `d` is a run of circle subpaths, rebuilt as a single string
   and written with one setAttribute. Alpha varies by having several pools
   rather than several thousand fill-opacity attributes.

   Two notes on the geometry:
   - a circle subpath drawn in CHART space comes out of the matrix as the
     correct ellipse; the same subpath drawn in SCREEN space comes out a
     circle. That is the painted/airborne grammar, for free, with no branch.
   ------------------------------------------------------------------ */
function pool(host,attrs){
  const p=host.appendChild(el("path",attrs));
  return {node:p, set(marks,r){
    let d="";
    for(let i=0;i<marks.length;i++){
      const m=marks[i], rr=(m[2]===undefined?r:m[2]);
      if(rr<=0) continue;
      d+="M"+m[0].toFixed(1)+" "+m[1].toFixed(1)+
         "m"+(-rr).toFixed(2)+" 0a"+rr.toFixed(2)+" "+rr.toFixed(2)+" 0 1 0 "+(2*rr).toFixed(2)+
         " 0a"+rr.toFixed(2)+" "+rr.toFixed(2)+" 0 1 0 "+(-2*rr).toFixed(2)+" 0";
    }
    p.setAttribute("d",d||"M0 0");
  }};
}

/* ------------------------------------------------------------------
   BEATS
   Every roof runs the same five-beat sentence — settle, draw the method,
   open the cut, mark the doomed, let them go — but on its own period, so
   the six buildings breathe near each other rather than in lockstep. Six
   things pulsing on one clock reads as one animation; six on their own
   reads as a place.
   ------------------------------------------------------------------ */
const seg=(t,[a,b])=>Math.max(0,Math.min(1,(t-a)/(b-a)));
const easeOut=x=>1-Math.pow(1-x,3);
const eio=x=>(x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2);
const beats=total=>({settle:[0.2,1.7],method:[1.6,2.7],cut:[2.6,3.4],
                     mark:[3.3,4.0],label:[3.8,4.6],exit:[5.3,7.0],total});

/* ------------------------------------------------------------------
   THE BUILDING
   Context first: one box turns a chart into a place. The roof slab is drawn
   very slightly inside the walls so the chart never bleeds over an edge.
   ------------------------------------------------------------------ */
function building(g,n,skin){
  paint(g,n.x,n.y,n.w,n.w,n.h,skin,n.hatch);
  const f=faces(n.x,n.y,n.w*0.985,n.w*0.985,n.h);
  g.appendChild(el("polygon",{points:f.top,fill:"var(--t-top)","fill-opacity":".82",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".6"}));
}
/* ------------------------------------------------------------------
   CHART FURNITURE
   An L of axis with an arrowhead on each open end, ticks, tick numbers and
   two titles. Drawn INSIDE the matrix on purpose: axes and their numbers are
   part of the surface, so they should be painted onto it and shear with it.
   Only the annotations further down stay upright, because a thing pointing
   AT the roof is not a thing on it.
   ------------------------------------------------------------------ */
function axesFrame(F,o){
  const g=F.g;
  g.appendChild(el("polyline",{points:pts([[CX0,CY0-5],[CX0,CY0+CHT],[CX0+CWD+5,CY0+CHT]]),
    fill:"none",stroke:"var(--fg)","stroke-width":"1.5"}));
  g.appendChild(el("polygon",{points:pts([[CX0,CY0-9],[CX0-2.5,CY0-3.4],[CX0+2.5,CY0-3.4]]),fill:"var(--fg)"}));
  g.appendChild(el("polygon",{points:pts([[CX0+CWD+9,CY0+CHT],[CX0+CWD+3.4,CY0+CHT-2.5],[CX0+CWD+3.4,CY0+CHT+2.5]]),fill:"var(--fg)"}));

  (o.xt||[]).forEach(([v,lab])=>{
    const x=cxOf(v,o.xd);
    g.appendChild(el("line",{x1:x,y1:CY0+CHT,x2:x,y2:CY0+CHT+3.4,stroke:"var(--fg)","stroke-width":"1.3"}));
    const t=g.appendChild(el("text",{x,y:CY0+CHT+14,"text-anchor":"middle",fill:"var(--fg2)",
      "font-size":T_TICK,"font-family":MONO})); t.textContent=lab;
  });
  (o.yt||[]).forEach(([v,lab])=>{
    const y=cyOf(v,o.yd);
    g.appendChild(el("line",{x1:CX0-3.4,y1:y,x2:CX0,y2:y,stroke:"var(--fg)","stroke-width":"1.3"}));
    const t=g.appendChild(el("text",{x:CX0-7,y:y+T_TICK*0.36,"text-anchor":"end",fill:"var(--fg2)",
      "font-size":T_TICK,"font-family":MONO})); t.textContent=lab;
  });

  const ax=g.appendChild(el("text",{x:CX0+CWD/2,y:CY0+CHT+29,"text-anchor":"middle",fill:"var(--fg)",
    "font-size":T_AXIS,"font-family":MONO,"font-weight":"600","letter-spacing":"1.2"}));
  ax.textContent=o.xlab;
  /* rotate(+90), NOT −90, and the sign is the whole difference between a
     legible label and an upside-down one. The matrix maps chart +x to screen
     up-right and chart +y to screen down-right. A y-axis title at −90 would
     advance along chart −y, which is screen UP-LEFT: it renders backwards,
     read from its own end. At +90 it advances down-right with its glyph tops
     pointing up-right — the same +30/−30 pair of reading directions the band
     titles and the step names on the map already use. */
  const ay=g.appendChild(el("text",{"text-anchor":"middle",fill:"var(--fg)","font-size":T_AXIS,
    "font-family":MONO,"font-weight":"600","letter-spacing":"1.2",
    transform:`translate(${CX0-40} ${CY0+CHT/2}) rotate(${F.turn?-90:90})`}));
  ay.textContent=o.ylab;

  /* Everything drawn into F.plot is CLIPPED to the plot rectangle.
     The domains below are robust quantiles, not min and max: a single cell at
     five sigma stretches a log axis until the entire population is a sliver
     two pixels wide, which is exactly what happened to the complexity roof
     the first time it was drawn. Robust limits mean a handful of marks fall
     off-scale, and off-scale is what the arrowheads on the axes are for. The
     counts in the panel are over the WHOLE population, not over what fitted
     on the roof, so nothing is quietly dropped from a number. */
  const cid="bpclip-"+(o.id||"x");
  const cp=el("clipPath",{id:cid,clipPathUnits:"userSpaceOnUse"});
  cp.appendChild(el("rect",{x:CX0-5,y:CY0-7,width:CWD+14,height:CHT+12}));
  g.appendChild(cp);
  F.plot=g.appendChild(el("g",{"clip-path":`url(#${cid})`}));
  return F.plot;
}

/* a domain that ignores its own tail. lo/hi are quantiles, pad is a fraction
   of the resulting span added at each end. */
function domainOf(vals,lo,hi,pad){
  const s=Float64Array.from(vals).sort();
  const at=q=>s[Math.max(0,Math.min(s.length-1,Math.round(q*(s.length-1))))];
  let a=at(lo), b=at(hi);
  if(!(b>a)){ a-=0.5; b+=0.5; }
  const m=(b-a)*(pad===undefined?0.06:pad);
  return [a-m,b+m];
}

/* ------------------------------------------------------------------
   THE THRESHOLD PANEL — upright, and off the roof.

   The arithmetic behind a computed threshold has to be on the tile, short
   enough to check by eye. Painting it INTO the chart space does not work and
   the reason is worth writing down: chart x and chart y map to the two roof
   diagonals, so a block of text grows right-down as it gets wider and
   left-down as it gets taller. It fans. A four-line readout anchored in the
   one empty corner sweeps across the roof and lands on the band by its last
   line, whichever corner you start from — three placements were tried and all
   three did it.

   So the panel stays upright and sits beside the building, the same way the
   two annotations do. It is still on the tile in the sense that matters: it
   is attached to the object, moves with it, and cannot be read as belonging
   to anything else.
   ------------------------------------------------------------------ */
function panel(g,head,tag,body){
  const lines=[head].concat(tag?[tag]:[]).concat(body||[]);
  const w=Math.max.apply(null,lines.map(L=>L.length))*8.2*0.62+15;
  const h=lines.length*13+11;
  const rect=g.appendChild(el("rect",{width:w,height:h,fill:"var(--panel)",
    "fill-opacity":".92",stroke:"var(--rule)","stroke-width":"1","opacity":"0"}));
  const texts=lines.map((L,i)=>{
    const isTag=tag&&i===1;
    const t=g.appendChild(el("text",{"font-size":i===0?9.6:8.2,"font-family":MONO,
      "letter-spacing":isTag?"1.3":".3","fill-opacity":"0",
      fill:i===0?"var(--accent)":isTag?"var(--cull)":"var(--fg3)"}));
    t.textContent=L; return t;
  });
  return {w,h,at(x,y,a){
    rect.setAttribute("x",x.toFixed(1)); rect.setAttribute("y",y.toFixed(1));
    rect.setAttribute("opacity",a.toFixed(3));
    texts.forEach((t,i)=>{ t.setAttribute("x",(x+8).toFixed(1));
      t.setAttribute("y",(y+16+i*13).toFixed(1));
      t.setAttribute("fill-opacity",a.toFixed(3)); });
  }};
}

/* ------------------------------------------------------------------
   ANNOTATIONS
   These stay upright and unsheared, floating above the roof and pointing
   down onto it: they are the reader's voice, not the surface's. The leader
   leaves from whichever edge of the text block faces its target, is trimmed
   a tenth at the text end, and stops short of the terminal dot.
   ------------------------------------------------------------------ */
function mkAnn(g,lines,tone){
  const col=tone||"var(--cull)";
  const line=g.appendChild(el("line",{stroke:col,"stroke-width":".9","stroke-linecap":"round","stroke-opacity":"0"}));
  const dot=g.appendChild(el("circle",{r:2,fill:col,"fill-opacity":"0"}));
  const t1=g.appendChild(el("text",{"text-anchor":"start",fill:col,"font-size":12.5,
    "font-family":MONO,"font-weight":"600","letter-spacing":"1","fill-opacity":"0"}));
  lines.forEach((L,i)=>{ const sp=el("tspan",{x:0,dy:i===0?0:14}); sp.textContent=L; t1.appendChild(sp); });
  return {line,dot,t1,lines,spans:[].slice.call(t1.childNodes)};
}
function placeAnn(ann,target,ax,ay,alpha){
  const w=Math.max.apply(null,ann.lines.map(L=>L.length))*12.5*0.6;
  const left=ax, right=ax+w, top=ay-12.5, bot=ay+(ann.lines.length-1)*14+4, GAP=6;
  let sx,sy;
  if(target[0]<left-3){ sx=left-GAP; sy=(top+bot)/2; }
  else if(target[0]>right+3){ sx=right+GAP; sy=(top+bot)/2; }
  else { sx=(left+right)/2; sy=target[1]>bot ? bot+GAP : top-GAP; }
  ann.spans.forEach(sp=>sp.setAttribute("x",ax));
  const ddx=target[0]-sx, ddy=target[1]-sy, L=Math.hypot(ddx,ddy)||1;
  const ux=ddx/L, uy=ddy/L;
  ann.line.setAttribute("x1",(sx+ux*L*0.10).toFixed(1)); ann.line.setAttribute("y1",(sy+uy*L*0.10).toFixed(1));
  ann.line.setAttribute("x2",(target[0]-ux*3.5).toFixed(1)); ann.line.setAttribute("y2",(target[1]-uy*3.5).toFixed(1));
  ann.dot.setAttribute("cx",target[0].toFixed(1)); ann.dot.setAttribute("cy",target[1].toFixed(1));
  ann.t1.setAttribute("x",ax); ann.t1.setAttribute("y",ay);
  const a=alpha.toFixed(3);
  ann.line.setAttribute("stroke-opacity",a);
  ann.dot.setAttribute("fill-opacity",a);
  ann.t1.setAttribute("fill-opacity",a);
}

/* every roof registers one ticker, and every ticker is gated on the zoom the
   view hands it — a chart smaller than a postage stamp is not worth a frame */
function everyFrame(run){ TICKERS.push((dt,now,k)=>{ run(dt); }); }

const DRAW={};


/* ============================================================
   THE THREE SHAPES COPIED FROM /pipeline
   Verbatim. A step on this page must be the same object as the step on that
   one, down to the seed drawMatrix uses for its sparsity.
   ============================================================ */

/* every step and every cull on this row. n.hatch means the stage destroys
   data, and all six culls carry it. */
const drawTile=(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile,n.hatch);

function drawHeap(g,n){
  const r=rng(19),boxes=[];
  for(let i=0;i<22;i++){const w=0.3+r()*0.5,d=0.3+r()*0.5;
    boxes.push({x:n.x+(r()-0.5)*(n.w-w),y:n.y+(r()-0.5)*(n.d-d),w,d,h:0.1+r()*n.h});}
  boxes.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  boxes.forEach(b=>paint(g,b.x,b.y,b.w,b.d,b.h,SKIN.anchor));
}

function drawMatrix(g,n){
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.anchor);
  const N=n.cells,r=rng(n.id==="UD"?5:11);
  const x0=n.x-n.w/2,y0=n.y-n.d/2,sx=n.w/N,sy=n.d/N,sz=n.h/N;
  const cell=(q,op)=>g.appendChild(el("polygon",{points:pts(q),fill:"var(--voxel)","fill-opacity":op,stroke:"none"}));
  const line=(a,b,op)=>g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
    stroke:"var(--stroke)","stroke-opacity":op,"stroke-width":".6"}));
  for(let i=0;i<N;i++)for(let j=0;j<N;j++) if(r()<n.fill)
    cell([P(x0+i*sx,y0+j*sy,n.h),P(x0+(i+1)*sx,y0+j*sy,n.h),P(x0+(i+1)*sx,y0+(j+1)*sy,n.h),P(x0+i*sx,y0+(j+1)*sy,n.h)],.62);
  for(let i=0;i<=N;i++){line(P(x0+i*sx,y0,n.h),P(x0+i*sx,y0+n.d,n.h),.3);
    line(P(x0,y0+i*sy,n.h),P(x0+n.w,y0+i*sy,n.h),.3);}
  const X=x0+n.w;
  for(let j=0;j<N;j++)for(let k=0;k<N;k++) if(r()<n.fill)
    cell([P(X,y0+j*sy,(k+1)*sz),P(X,y0+(j+1)*sy,(k+1)*sz),P(X,y0+(j+1)*sy,k*sz),P(X,y0+j*sy,k*sz)],.5);
  for(let i=0;i<=N;i++){line(P(X,y0+i*sy,0),P(X,y0+i*sy,n.h),.28);
    line(P(X,y0,i*sz),P(X,y0+n.d,i*sz),.28);}
  const Y=y0+n.d;
  for(let i=0;i<N;i++)for(let k=0;k<N;k++) if(r()<n.fill)
    cell([P(x0+i*sx,Y,(k+1)*sz),P(x0+(i+1)*sx,Y,(k+1)*sz),P(x0+(i+1)*sx,Y,k*sz),P(x0+i*sx,Y,k*sz)],.42);
  for(let i=0;i<=N;i++){line(P(x0+i*sx,Y,0),P(x0+i*sx,Y,n.h),.28);
    line(P(x0,Y,i*sz),P(x0+n.w,Y,i*sz),.28);}
}

DRAW.tile=drawTile;
DRAW.heap=drawHeap;
DRAW.matrix=drawMatrix;

/* ============================================================
   THE ONE SHAPE ADDED — D5's argument, drawn on a roof
   ============================================================ */
function drawComplexityRoof(g,n){
  building(g,n,SKIN.works);
  /* turned a quarter: see roofFrame(). A log-log genes-against-transcripts
     cloud is a straight diagonal, and at turn 0 it projects to a vertical
     sliver. */
  const F=roofFrame(g,n,n.h,CW,undefined,true);

  const us=MODEL.cells.map(c=>Math.log10(c.umi)), gs=MODEL.cells.map(c=>Math.log10(c.genes));
  /* Robust limits, not min and max. Transcript counts are log-normal with a
     long right tail and a doublet adds two draws together, so the largest
     cell in the population sits several sigma out on its own — and taking it
     as the axis limit compressed the entire cloud into a two-pixel sliver.
     It rendered, it was wrong, and nothing on screen said so. */
  const XD=domainOf(us,0.004,0.996,0.06);
  const YD=domainOf(gs,0.004,0.996,0.06);

  axesFrame(F,{id:n.id,xd:XD,yd:YD,xlab:"TRANSCRIPTS",ylab:"GENES",
    xt:[[2,"100"],[3,"1k"],[4,"10k"]],yt:[[2,"100"],[3,"1k"]]});

  const px=c=>[cxOf(Math.log10(c.umi),XD), cyOf(Math.log10(c.genes),YD)];

  /* the band, then the fit on top of it */
  const NS_=56, hi=[], lo=[], fitPts=[];
  for(let i=0;i<NS_;i++){
    const lx=XD[0]+((XD[1]-XD[0])*i)/(NS_-1), fy=MODEL.band.fit(lx);
    fitPts.push([cxOf(lx,XD),cyOf(fy,YD)]);
    hi.push([cxOf(lx,XD),cyOf(fy+MODEL.band.half,YD)]);
    lo.push([cxOf(lx,XD),cyOf(fy-MODEL.band.half,YD)]);
  }
  const bandFill=F.plot.appendChild(el("polygon",{fill:"var(--accent)","fill-opacity":"0"}));
  const railHi=F.plot.appendChild(el("polyline",{fill:"none",stroke:"var(--accent)","stroke-width":"1.1",
    "stroke-dasharray":"3.4 3","stroke-opacity":"0"}));
  const railLo=F.plot.appendChild(el("polyline",{fill:"none",stroke:"var(--accent)","stroke-width":"1.1",
    "stroke-dasharray":"3.4 3","stroke-opacity":"0"}));
  const fitLine=F.plot.appendChild(el("polyline",{fill:"none",stroke:"var(--keep)","stroke-width":"1.8",
    "stroke-linecap":"round","stroke-linejoin":"round"}));

  /* PAINTED: the bulk, and the over-amplified tail that stays to burst */
  const bulk=MODEL.cells.filter(c=>MODEL.resid(c)>=-MODEL.band.half && MODEL.resid(c)<=MODEL.band.half);
  const bulkPool=pool(F.plot,{fill:"var(--keep)","fill-opacity":".5"});
  bulkPool.set(bulk.map(px),1.5);

  const over=MODEL.cplxLo.map(c=>({c,p:px(c),ph:c.jy+0.5}));
  const overKeep=pool(F.plot,{fill:"var(--keep)","fill-opacity":"0"});
  const overCull=pool(F.plot,{fill:"var(--cull)","fill-opacity":"0"});
  const overRing=pool(F.plot,{fill:"none",stroke:"var(--cull)","stroke-width":"1","stroke-opacity":"0"});

  /* AIRBORNE: the under-amplified tail, born at its own site on the roof and
     never at the origin — an element with no cx sits at the SVG origin, which
     is nowhere near this building, and drags the selection halo's bounding
     box across the whole map */
  const under=MODEL.cplxHi.map(c=>{
    const p=px(c), w=F.toWorld(p[0],p[1]);
    return {c,p,wx:w[0],wy:w[1],ph:c.jx+0.5};
  });
  const underPool=pool(g,{fill:"var(--cull)","fill-opacity":".85"});
  const underShad=pool(F.plot,{fill:"var(--stroke)","fill-opacity":".3"});

  const pane=panel(g,
    "BAND  +/- "+MODEL.band.K.toFixed(1)+" x SIGMA","MODELLED",[
    "least-squares cubic through the cloud",
    "robust residual sigma  "+MODEL.band.sigma.toFixed(4),
    "band half-width        "+MODEL.band.half.toFixed(4),
    MODEL.cplxHi.length+" above the band, "+MODEL.cplxLo.length+" below"]);

  const annU=mkAnn(g,["UNDER-","AMPLIFIED"]);
  const annO=mkAnn(g,["OVER-","AMPLIFIED"]);

  const T=beats(8.8); let t=0;
  const run=dt=>{
    t=(t+dt)%T.total;
    const pSet=seg(t,T.settle), pFit=eio(seg(t,T.method)), pBand=easeOut(seg(t,T.cut));
    const pMark=easeOut(seg(t,T.mark)), pLab=easeOut(seg(t,T.label)), pExit=eio(seg(t,T.exit));

    const shown=Math.max(2,Math.floor(pFit*NS_));
    fitLine.setAttribute("points",pts(fitPts.slice(0,shown)));
    bulkPool.node.setAttribute("fill-opacity",(0.5*Math.min(1,pSet*1.4)).toFixed(3));
    if(pBand>0){
      bandFill.setAttribute("points",pts(hi.concat(lo.slice().reverse())));
      bandFill.setAttribute("fill-opacity",(0.13*pBand).toFixed(3));
      railHi.setAttribute("points",pts(hi)); railLo.setAttribute("points",pts(lo));
      railHi.setAttribute("stroke-opacity",(0.9*pBand).toFixed(3));
      railLo.setAttribute("stroke-opacity",(0.9*pBand).toFixed(3));
    }

    /* over-amplified: swell where they lie, then burst */
    const ok=[], oc=[], orr=[];
    for(const o of over){
      const k=Math.max(0,Math.min(1,(pExit-o.ph*0.28)/(1-o.ph*0.28)));
      const swell=k<0.55?k/0.55:1;
      const r=2*(1+0.28*pMark)*(1+swell*2.1);
      if(k<0.55||k<1){ ok.push([o.p[0],o.p[1],r]); oc.push([o.p[0],o.p[1],r]); }
      if(k>0.55) orr.push([o.p[0],o.p[1],r*1.9]);
    }
    overKeep.set(ok); overCull.set(oc); overRing.set(orr);
    const fade=v=>Math.max(0,v).toFixed(3);
    overKeep.node.setAttribute("fill-opacity",fade(Math.min(1,pSet*1.4)*(1-pMark)*0.95));
    overCull.node.setAttribute("fill-opacity",fade(Math.min(1,pSet*1.4)*pMark*(1-Math.pow(pExit,2))));
    overRing.node.setAttribute("stroke-opacity",fade(0.5*(1-pExit)));

    /* under-amplified: peel off the surface */
    const air=[], shad=[];
    for(const u of under){
      const k=Math.max(0,Math.min(1,(pExit-u.ph*0.28)/(1-u.ph*0.28)));
      const lift=k*1.15;
      const s=P(u.wx,u.wy,n.h+lift);
      air.push([s[0],s[1],2.4*(1+0.28*pMark)*(1-k*0.5)]);
      shad.push([u.p[0],u.p[1],2*(1-k*0.55)]);
    }
    underPool.set(air);
    underPool.node.setAttribute("fill-opacity",fade(0.85*Math.min(1,pSet*1.4)*(1-Math.pow(pExit,2.4))));
    underShad.set(shad);
    underShad.node.setAttribute("fill-opacity",fade(0.3*Math.min(1,pSet*1.4)*(1-pExit)));

    /* the two labels sit diagonally opposed, because the two failures are */
    const cen=(arr,f)=>{ if(!arr.length) return [0,0];
      const m=arr.reduce((a,c)=>{const s=f(c);return [a[0]+s[0],a[1]+s[1]];},[0,0]);
      return [m[0]/arr.length,m[1]/arr.length]; };
    const au=cen(under,u=>P(u.wx,u.wy,n.h));
    const ao=cen(over,o=>F.toScreen(o.p[0],o.p[1]));
    /* Above and below the band, the way the two failures are: too many genes
       for the transcripts, and too few. Both are pushed well out to the left
       of their targets rather than sitting directly over them — straight up
       from this roof is where D7's name runs, and the under-amplified label
       landed on it. The leader lines carry the association instead. */
    placeAnn(annU,au,au[0]-168,au[1]-116,pLab);
    placeAnn(annO,ao,ao[0]+74,ao[1]+92,pLab);
    /* the panel sits under the building, on open ground: this roof hangs
       below the cull row, so down is the one direction with nothing in it */
    const c0=F.toScreen(CX0+CWD/2,CY0+CHT/2);
    pane.at(c0[0]-pane.w*0.5+30, c0[1]+128, pLab);
  };
  run(0); everyFrame(run);
}
DRAW.complexityroof=drawComplexityRoof;
