/* ============================================================
   bp-shapes.js — the visual vocabulary.

   THREE SHAPES COPIED, FOUR ROOFS ADDED.

   The three copied ones are lifted verbatim from /pipeline's
   pipeline-shapes.js: drawTile, drawHeap and drawMatrix. A step here has to
   be the same object as the step there, or a reader is being told they are
   looking at two different things.

   The four roofs are what this page is for. Each of the four culls between
   the unfiltered and the filtered matrix makes a two-dimensional decision,
   and on the big map each is a 0.7-unit hatched box with that decision
   described in prose. Here there is room to draw it:

     KNEE         a barcode-rank curve, log-log, cut at the steepest descent
     MITO %       a distribution, cut at median + 3 x MAD
     COMPLEXITY   a cloud with a cubic through it and a robust band
     DOUBLETS     an expression embedding, and the manufacture of its own
                  reference, thresholded against the expected collision rate

   WHY A ROOF
   A chart rebuilt in three dimensions occludes the very thing it exists to
   show, and a chart you have to orbit to read is not a chart. So none of
   these is rebuilt. Each is drawn in ordinary flat 2D — axes, ticks,
   polylines, circles, in a 176 x 176 chart space — and laid onto the
   horizontal roof of a building by one transform="matrix()". See roofFrame()
   in bp-iso.js.

   That hands the page its grammar, and all four obey it:

       PAINTED things are ELLIPSES.  AIRBORNE things are CIRCLES.

   A barcode still under consideration is painted on the roof, and the matrix
   turns its circle into the correctly-oriented ellipse for free. One that is
   LEAVING lifts off the surface and becomes a true circle, with a shadow on
   the roof beneath it. Leaving is visible from across the map, before a
   single label is readable.

   AND EACH CULL LEAVES DIFFERENTLY
     knee        barcodes below the cut RAIN off the near eaves — never cells
     mito        dying cells RISE straight up and fade — they are leaking
     complexity  under-amplified PEEL OFF; over-amplified SWELL AND BURST
     doublets    true doublets PULL APART into their two halves — always two
   Four identical fades would make the row read as one animation on a loop.
   Do not reuse a gesture.

   ONE UNIT GOVERNS EVERY ROOF
   Chart space is CW x CW whatever the building's size, so every type size,
   tick, dot radius and pad below is in chart units and a roof reads the same
   on any of them. There is not one screen-pixel literal in the roof code.

   Load order: iso -> pop -> shapes -> data -> view
   ============================================================ */

const V=n=>`var(--${n})`;

/* Copied from /pipeline. tile and anchor are the skins its row 3 uses; works
   is the skin the four roofed culls wear, so they read as opened-up versions
   of a step rather than as a different kind of thing. */
const SKIN={
  tile  :{top:V("t-top"), left:V("t-left"), right:V("t-right"), sw:1,   so:.6},
  anchor:{top:V("a-top"), left:V("a-left"), right:V("a-right"), sw:1.7, so:1},
  works :{top:V("k-top"), left:V("k-left"), right:V("k-right"), sw:1.4, so:1},
};

/* Every object on this page is a box, so the height a structure reaches is
   simply its height. The label anchor and the occlusion silhouette read it. */
const topOf = n => n.h;

const MONO='ui-monospace,"SF Mono",Menlo,Consolas,monospace';

/* ============================================================
   THE DERIVED MODEL

   Every threshold the four roofs draw is computed HERE, at load, from the one
   shared population in bp-pop.js. Not one of them is a literal. Reseed and
   they all move.

   That is not fussiness. A hardcoded cut sits in the same place no matter
   what the cloud does, and the roof stops being a computation and becomes an
   illustration of one. It is invisible when right and obvious when wrong.

   It also means every figure on these four roofs is MODELLED, and the page
   says so on each panel, under each name on the map, and in the reader. Of
   the four culls drawn, one has a method in code that has run and it is not
   the policy that ships; the other three are not written anywhere. A roof
   that showed a mitochondrial cutoff without saying it was invented would be
   claiming a result nobody has produced.

   ONE POPULATION, SHARED. A barcode keeps its identity across all four
   roofs, so the dot that dies at the knee is the dot that was in the cloud
   on the roof before it.

   THE ONE REAL NUMBER ON A ROOF is the expected collision rate on the
   doublet roof, and it is real because it is arithmetic over real figures
   rather than a draw from the simulation. See EXPECTED below.
   ============================================================ */
const MODEL=(()=>{
  const B=makeBarcodes();
  const cells=B.filter(c=>c.isCell);

  /* rank by transcript count, deepest first — the x axis of the knee roof */
  B.map((c,i)=>i).sort((a,b)=>B[b].umi-B[a].umi).forEach((idx,r)=>{ B[idx].rank=r+1; });

  const kneeCut=kneeOf(B.map(c=>c.umi));
  const kept=B.filter(c=>c.umi>=kneeCut);
  const lost=B.filter(c=>c.umi<kneeCut);

  const mito=mitoCut(cells);
  const mitoGone=cells.filter(c=>c.mitoPct>mito.cut);

  const band=cubicBand(cells);
  const resid=c=>Math.log10(c.genes)-band.fit(Math.log10(c.umi));

  const ds=doubletScores(cells,mulberry32(0x9e37));
  cells.forEach((c,i)=>{ c.score=ds.scores[i]; });
  const flagged=cells.filter(c=>c.score>=ds.cut);

  /* ---- the expected collision rate, and it is REAL ----------------------
     Three rounds of split-pool give 48 x 96 x 96 = 442,368 addressable paths
     (node B6 on /pipeline), the fourth barcode splits the run into 8
     sublibraries (B7), and 94,616 cells were called. Collisions can only
     happen WITHIN a sublibrary, because the sublibrary index distinguishes
     two cells that took the same path in different ones — which is why the
     denominator is cells-per-sublibrary and not the whole run. Get that
     wrong and the expected rate comes out eight times too high.

     Poisson over paths: of the paths that got at least one cell, the share
     that got two or more. Every input is a real figure; nothing here is
     drawn from the simulation. */
  const PATHS=48*96*96, SUBLIBS=8, CALLED=94616;
  const lam=(CALLED/SUBLIBS)/PATHS, e=Math.exp(-lam);
  const EXPECTED=(1-e-lam*e)/(1-e);

  /* ---- the ledger the staircase is drawn from --------------------------
     Four culls applied IN ORDER, each over what the one before it left, and
     all four measured against ONE denominator: every barcode that ever
     appeared. Subtracting four independent percentages would double-count
     every barcode two of them agree about, and two of them do — a doublet
     carries two cells' worth of transcripts and rather less than two cells'
     worth of distinct genes, so complexity reaches it before the scorer does.

     THE KNEE IS THE FIRST STATION, and it takes 96.7%. An earlier version of
     this band left it out on the grounds that a proportional ribbon including
     it is a cliff followed by three hairlines. It is — and that is the
     finding, not a drawing problem: on this dataset the knee is very nearly
     the whole cull and the three after it are a rounding. What makes the
     small ones still readable is that each station's own figure is a share of
     what REACHED it, so mito reads −5.8% whether its riser is forty pixels or
     one, and its tributary flares to a floor width so a small cull is still
     visibly a cull. The band carries the arithmetic; the labels carry the
     ones the band is too small to draw.

     One denominator throughout, so nothing here is a ratio between two
     different objects. Exactly one of the 468 barcodes past the knee is not
     a cell in the simulation, so the population the last three culls act on
     is the called cells in all but that one. */
  const afterKnee=kept;
  const afterMito=afterKnee.filter(c=>c.mitoPct<=mito.cut);
  const afterCplx=afterMito.filter(c=>Math.abs(resid(c))<=band.half);
  const afterDbl =afterCplx.filter(c=>!(c.isCell&&c.score>=ds.cut));
  const ledger={
    start:B.length,
    steps:[{id:"c1",name:"KNEE",       culled:B.length-afterKnee.length},
           {id:"c3",name:"MITO",       culled:afterKnee.length-afterMito.length},
           {id:"c4",name:"COMPLEXITY", culled:afterMito.length-afterCplx.length},
           {id:"c5",name:"DOUBLETS",   culled:afterCplx.length-afterDbl.length}],
    final:afterDbl.length,
  };

  return {
    B, cells, kneeCut, kept, lost, ledger,
    mito, mitoGone,
    band, resid,
    cplxHi:cells.filter(c=>resid(c)>band.half),    /* under-amplified */
    cplxLo:cells.filter(c=>resid(c)<-band.half),   /* over-amplified  */
    dbl:ds, flagged, expected:EXPECTED,
    flagRate:flagged.length/Math.max(1,cells.length),
  };
})();

/* ============================================================
   CHART SPACE
   Origin top-left, y down, exactly like an <svg> — because that is what it
   is, right up until the matrix picks it up and lays it on a roof.
   ============================================================ */
/* The bottom strip is deeper than the top one, and asymmetrically so on
   purpose: the "falling" layout puts BOTH the x ticks and the x title down
   there, and at equal pads they sat on each other. */
const CW=176, PAD={l:44,r:16,t:34,b:42};
const CX0=PAD.l, CY0=PAD.t, CWD=CW-PAD.l-PAD.r, CHT=CW-PAD.t-PAD.b;
const T_AXIS=12, T_TICK=10;

/* ------------------------------------------------------------------
   BEATS
   Every roof runs the same five-beat sentence — settle, draw the method,
   open the cut, mark the doomed, let them go — on its own period, so the
   four buildings breathe near each other rather than in lockstep. Four
   things pulsing on one clock reads as one animation; four on their own
   reads as a place.
   ------------------------------------------------------------------ */
const seg=(t,[a,b])=>Math.max(0,Math.min(1,(t-a)/(b-a)));
const easeOut=x=>1-Math.pow(1-x,3);
const eio=x=>(x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2);
const beats=total=>({settle:[0.2,1.7],method:[1.6,2.7],cut:[2.6,3.4],
                     mark:[3.3,4.0],label:[3.8,4.6],exit:[5.3,7.0],total});

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

function building(g,n,skin){
  paint(g,n.x,n.y,n.w,n.w,n.h,skin,n.hatch);
  const f=faces(n.x,n.y,n.w*0.985,n.w*0.985,n.h);
  g.appendChild(el("polygon",{points:f.top,fill:"var(--t-top)","fill-opacity":".82",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".6"}));
}
/* ------------------------------------------------------------------
   CHART FURNITURE, AND THE ONE DECISION THAT MATTERS ON A ROOF

   An L of axis with an arrowhead on each open end, ticks, tick numbers and
   two titles, drawn INSIDE the matrix on purpose: axes and their numbers are
   part of the surface, so they shear with it. Only the annotations and the
   panel stay upright, because a thing pointing AT a roof is not a thing on
   it.

   WHICH WAY THE Y AXIS RUNS IS NOT A CONVENTION HERE. IT IS FORCED.

   Chart x and chart y map to the two roof diagonals. So a chart's trend is
   projected onto their SUM or onto their DIFFERENCE — onto the horizontal,
   or onto the vertical. A trend that comes out vertical is a cloud squeezed
   into a two-pixel sliver: geometrically correct, and useless. Both happened
   during this build.

   The fix is to orient y so the trend is always a sum:

     trend "falling"  a rank curve. Transcripts DROP as rank rises, so y is
                      flipped the ordinary way (more is up-chart) and the
                      axis corner sits bottom-left, exactly like a flat
                      chart.
     trend "rising"   genes against transcripts. Both grow together, so y is
                      NOT flipped — both quantities grow away from the near
                      corner, like the corner of a room, and the corner sits
                      top-left.
     trend "none"     a histogram, an embedding. No diagonal to protect;
                      takes the ordinary orientation.

   So the knee roof and the complexity roof have their origins in different
   corners, and that is correct rather than sloppy: a roof has no up, and the
   only thing worth being consistent about is that the data lies ALONG it.

   NOTHING ON A ROOF IS ROTATED. An unrotated string advances along chart +x,
   which the matrix sends up-and-right at −30° — the same angle the step
   names, the landmark names and the band title all read at. Every word on
   every roof therefore lies the same way as every word on the map, and the
   eye never changes reading angle crossing between them. The cost is that an
   axis title cannot run parallel to its own axis, so both titles sit at the
   far END of their arm, past the arrowhead.
   ------------------------------------------------------------------ */
function axesFrame(F,o){
  const g=F.g, up=o.trend!=="rising";      /* up: more is toward the top */
  /* SQUAT — a plot shorter than the chart square, centred in it.

     This is the lever that lets a RISING trend keep the ordinary axis
     placement. The trend's screen direction is (0.874(a−b), −0.505(a+b))
     where a is how far the data runs across the plot and b how far it runs
     up it. At a ≈ b that is straight up: the vertical sliver. Shrink b — by
     making the plot short rather than by lying about the domain — and the
     direction swings toward −30°, which is the roof's own x edge and the
     angle everything on this page reads at.

     So the genes-against-transcripts cloud gets its x axis along the bottom
     like every other chart here, and still lies along the roof. What it costs
     is a band of empty roof above and below the plot, which the axis titles
     use anyway. */
  const H=CHT*(o.squat||1), TOP=CY0+(CHT-H)/2, BOT=TOP+H;
  F.X=v=>CX0+((v-o.xd[0])/(o.xd[1]-o.xd[0]))*CWD;
  F.Y=up ? v=>BOT-((v-o.yd[0])/(o.yd[1]-o.yd[0]))*H
         : v=>TOP+((v-o.yd[0])/(o.yd[1]-o.yd[0]))*H;
  F.plotTop=TOP; F.plotBot=BOT;

  /* the corner, and which way each arm leaves it */
  const cy = up ? BOT : TOP;               /* the x arm's chart y */
  const ySign = up ? -1 : +1;              /* the y arm's direction */
  const yEnd = up ? TOP : BOT;

  g.appendChild(el("polyline",{points:pts([
      [CX0, yEnd+ySign*5],[CX0,cy],[CX0+CWD+5,cy]]),
    fill:"none",stroke:"var(--fg)","stroke-width":"1.5"}));
  g.appendChild(el("polygon",{points:pts([
      [CX0+CWD+9,cy],[CX0+CWD+3.4,cy-2.5],[CX0+CWD+3.4,cy+2.5]]),fill:"var(--fg)"}));
  g.appendChild(el("polygon",{points:pts([
      [CX0,yEnd+ySign*9],[CX0-2.5,yEnd+ySign*3.4],[CX0+2.5,yEnd+ySign*3.4]]),fill:"var(--fg)"}));

  /* ticks sit OUTSIDE the L, on the far side of each arm from the plot */
  (o.xt||[]).forEach(([v,lab])=>{
    const x=F.X(v);
    g.appendChild(el("line",{x1:x,y1:cy,x2:x,y2:cy-ySign*3.4,stroke:"var(--fg)","stroke-width":"1.3"}));
    const t=g.appendChild(el("text",{x,y:cy-ySign*3.4+(up?9:-4),"text-anchor":"middle",
      fill:"var(--fg2)","font-size":T_TICK,"font-family":MONO})); t.textContent=lab;
  });
  (o.yt||[]).forEach(([v,lab])=>{
    const y=F.Y(v);
    g.appendChild(el("line",{x1:CX0-3.4,y1:y,x2:CX0,y2:y,stroke:"var(--fg)","stroke-width":"1.3"}));
    const t=g.appendChild(el("text",{x:CX0-7,y:y+T_TICK*0.36,"text-anchor":"end",
      fill:"var(--fg2)","font-size":T_TICK,"font-family":MONO})); t.textContent=lab;
  });

  /* Both titles are anchored START and sit inside the chart's own width.
     Anchored END they run leftward off chart x = 0, which on an eleven-letter
     title is most of the way off the building — "TRANSCRIPTS" and
     "EXPRESSION 2" both did it, and a five-letter "GENES" did not, so it
     looked like a one-off rather than the rule it is. */
  const ax=g.appendChild(el("text",{x:CX0+CWD,y:cy-ySign*28,"text-anchor":"end",fill:"var(--fg)",
    "font-size":T_AXIS,"font-family":MONO,"font-weight":"600","letter-spacing":"1.2"}));
  ax.textContent=o.xlab;
  const ay=g.appendChild(el("text",{x:CX0+4,y:yEnd+ySign*16,"text-anchor":"start",fill:"var(--fg)",
    "font-size":T_AXIS,"font-family":MONO,"font-weight":"600","letter-spacing":"1.2"}));
  ay.textContent=o.ylab;

  /* Everything drawn into F.plot is CLIPPED to the plot rectangle. The
     domains are robust quantiles, not min and max: a single barcode at five
     sigma stretches a log axis until the whole population is a sliver, which
     is exactly what happened to the complexity roof the first time. Robust
     limits mean a handful of marks fall off-scale, and off-scale is what the
     arrowheads are for. Every count in every panel is over the WHOLE
     population, never over what fitted on the roof. */
  const cid="bpclip-"+(o.id||"x");
  const cp=el("clipPath",{id:cid,clipPathUnits:"userSpaceOnUse"});
  cp.appendChild(el("rect",{x:CX0-5,y:TOP-5,width:CWD+14,height:H+10}));
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

/* ============================================================
   WHAT EACH ROOF SHOWS — as data, for the reader, not as a box on the map.

   Each roof used to carry a small floating panel with its threshold and the
   arithmetic behind it. It is gone. A panel is a paragraph pretending to be
   part of a drawing: it has to be placed, it has to be kept clear of its
   neighbours, it takes a click if you are not careful, and it says nothing
   the right-hand column could not say with more room and better type.

   What survives is the requirement it existed for — a modelled figure has to
   carry the word "modelled" wherever it is shown. So the numbers move to the
   reader, which is where prose already lives, and the map keeps the word
   under each building's name.

   Keyed by SHAPE, not by node id: a shape knows what it drew, and the data
   file should not have to restate it.
   ============================================================ */
const FIGURES={
  kneeroof:()=>({
    head:Math.round(MODEL.kneeCut).toLocaleString()+" transcripts",
    rows:[["Method","steepest descent on the smoothed log-log rank curve"],
          ["Fitted","per sample — not a chosen round number"],
          ["Kept",MODEL.kept.length.toLocaleString()+" of "+
                  MODEL.B.length.toLocaleString()+" barcodes ("+
                  (100*MODEL.kept.length/MODEL.B.length).toFixed(2)+"%)"]]}),
  mitoroof:()=>({
    head:MODEL.mito.cut.toFixed(1)+" % mitochondrial",
    rows:[["Method","median + 3 × MAD over the survivors"],
          ["Arithmetic","median "+MODEL.mito.med.toFixed(2)+" + 3 × MAD "+
                        MODEL.mito.mad.toFixed(2)+" = "+MODEL.mito.cut.toFixed(2)+"%"],
          ["Removed",MODEL.mitoGone.length+" of "+MODEL.cells.length+" cells"]]}),
  complexityroof:()=>({
    head:"± "+MODEL.band.K.toFixed(1)+" × robust sigma",
    rows:[["Method","least-squares cubic through the cloud, band opened to a robust residual sigma"],
          ["Sigma",MODEL.band.sigma.toFixed(4)+"  ·  band half-width "+MODEL.band.half.toFixed(4)],
          ["Above the band",MODEL.cplxHi.length+" cells — under-amplified"],
          ["Below the band",MODEL.cplxLo.length+" cells — over-amplified"]]}),
  doubletroof:()=>({
    head:(100*MODEL.flagRate).toFixed(1)+" % flagged",
    rows:[["Method","kNN against synthetic doublets built from pairs of real cells in different neighbourhoods"],
          ["Threshold","median + 3 × MAD over the scores, cut at "+MODEL.dbl.cut.toFixed(3)],
          ["Flagged",MODEL.flagged.length+" of "+MODEL.cells.length+" cells"]],
    /* the one figure on any roof that is not modelled */
    real:["Expected collision rate",(100*MODEL.expected).toFixed(2)+
          " % — Poisson over 442,368 paths, 8 sublibraries, 94,616 cells. "+
          "The denominator is cells per sublibrary, not per run: the fourth barcode "+
          "tells apart two cells that took the same path in different ones."]}),
};

/* Where an annotation goes, and it is the same rule on every roof.

   The row runs down-right across the screen at +30°. ANN_AT steps
   PERPENDICULAR to that — down and to the left — so every annotation lands
   in a line parallel to the row, evenly spaced, below it. Nothing is nudged
   by hand: a hand-nudged label is fine until the row is re-spaced, and this
   row has been re-spaced four times.

   (Its opposite number, PANEL_AT, is gone with the panels. Everything those
   carried is in the reader now — see FIGURES above.)
   ------------------------------------------------------------------ */
const ANN_AT=[-150,236];

/* ------------------------------------------------------------------
   ANNOTATIONS
   These stay upright and unsheared, floating above the roof and pointing
   down onto it: they are the reader's voice, not the surface's. The leader
   leaves from whichever edge of the text block faces its target, is trimmed
   a tenth at the text end, and stops short of the terminal dot.
   ------------------------------------------------------------------ */
/* Every annotation on the page registers here so the view's Edit positions
   mode can pick it up. A floating label is placed by ITS OWN SHAPE, every
   frame, from a base position the shape computes — so it cannot simply be
   moved: the next frame would put it back. What is draggable instead is
   `off`, a nudge in world-SVG units that placeAnn() adds to whatever the
   shape asked for. The shape keeps owning where the label starts; the editor
   owns where it ends up. */
const ANNOTATIONS=[];

function mkAnn(g,key,lines,tone){
  const col=tone||"var(--cull)";
  const NOHIT={"pointer-events":"none"};
  const line=g.appendChild(el("line",Object.assign({stroke:col,"stroke-width":".9",
    "stroke-linecap":"round","stroke-opacity":"0"},NOHIT)));
  const dot=g.appendChild(el("circle",Object.assign({r:2,fill:col,"fill-opacity":"0"},NOHIT)));
  const t1=g.appendChild(el("text",Object.assign({"text-anchor":"start",fill:col,"font-size":12.5,
    "font-family":MONO,"font-weight":"600","letter-spacing":"1","fill-opacity":"0"},NOHIT)));
  lines.forEach((L,i)=>{ const sp=el("tspan",{x:0,dy:i===0?0:14}); sp.textContent=L; t1.appendChild(sp); });
  /* the grab target, and the dashed box that shows it is one. Both are inert
     until the mode is on — see .ehit / .ehandle in index.html. The glyphs
     themselves are not a target: two short words at 12.5px are mostly holes. */
  const box=g.appendChild(el("rect",{class:"ehandle lab"}));
  const hit=g.appendChild(el("rect",{class:"ehit","data-ann":key}));
  const ann={key,line,dot,t1,lines,spans:[].slice.call(t1.childNodes),box,hit,
             off:{dx:0,dy:0},last:null};
  ann.reflow=()=>{ if(ann.last) placeAnn(ann,ann.last.target,ann.last.ax,ann.last.ay,ann.last.alpha); };
  ANNOTATIONS.push(ann);
  return ann;
}
function placeAnn(ann,target,bax,bay,alpha){
  /* the shape asks for bax/bay; the editor's nudge is added on top, and the
     leader is recomputed from the moved text to the UNMOVED target — which is
     what makes the line follow the label rather than the label leave it */
  ann.last={target,ax:bax,ay:bay,alpha};
  const ax=bax+ann.off.dx, ay=bay+ann.off.dy;
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
  /* In Edit positions every annotation is held at full opacity. They only
     exist for part of each roof's loop, and a label you cannot see is a label
     you cannot pick up — the handle would be an empty dashed box hovering
     over nothing. */
  const a=(ann.forceShow?1:alpha).toFixed(3);
  ann.line.setAttribute("stroke-opacity",a);
  ann.dot.setAttribute("fill-opacity",a);
  ann.t1.setAttribute("fill-opacity",a);
  /* the handle tracks the text, because the text moves every frame */
  const bx=left-5, by=top-4, bw=w+10, bh=(bot-top)+8;
  [ann.box,ann.hit].forEach(r=>{ r.setAttribute("x",bx.toFixed(1)); r.setAttribute("y",by.toFixed(1));
    r.setAttribute("width",bw.toFixed(1)); r.setAttribute("height",bh.toFixed(1)); });
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
   01 · THE KNEE
   Rank every barcode by transcript count, take the curve into log-log, and
   cut at the point of steepest descent — a hard transcript minimum, fitted
   per sample rather than chosen.

   The threshold is drawn VERTICALLY, at the rank where the knee falls, and
   everything to the right of it leaves. That is the right way round for this
   cull and not for any other on the page: the knee is a statement about how
   many barcodes are cells, and the transcript number is what that statement
   costs. Drawing it as a horizontal floor would say the opposite — that a
   number was picked and the count fell out of it.

   GESTURE: the barcodes below the cut RAIN off the near eaves. They do not
   fade in place; they come off the front of the building and fall past it,
   because they were never cells and the building is where the cells are.
   ============================================================ */
function drawKneeRoof(g,n){
  building(g,n,SKIN.works);
  const F=roofFrame(g,n,n.h,CW);

  const XD=[0,Math.log10(MODEL.B.length)+0.08];
  const YD=domainOf(MODEL.B.map(c=>Math.log10(c.umi)),0.0005,0.9995,0.05);
  axesFrame(F,{id:n.id,xd:XD,yd:YD,trend:"falling",
    xlab:"BARCODES, RANKED",ylab:"TRANSCRIPTS",
    xt:[[0,"1"],[2,"100"],[4,"10k"]],
    yt:[[1,"10"],[2,"100"],[3,"1k"]]});

  const px=c=>[F.X(Math.log10(c.rank)), F.Y(Math.log10(c.umi))];

  /* The curve IS the cloud: every barcode is one point on it, so the shoulder
     and the tail are the same object rather than a line drawn over a scatter. */
  const stride=Math.max(1,Math.ceil(MODEL.B.length/2400));
  const keptPts=[], lostPts=[];
  MODEL.B.forEach((c,i)=>{ if(i%stride) return;
    (c.umi>=MODEL.kneeCut?keptPts:lostPts).push(px(c)); });
  const tailPool=pool(F.plot,{fill:"var(--fg3)","fill-opacity":".34"});
  tailPool.set(lostPts,1.4);
  const keepPool=pool(F.plot,{fill:"var(--keep)","fill-opacity":".62"});
  keepPool.set(keptPts,1.6);

  /* the cut: vertical, at the rank the knee search landed on */
  const kx=F.X(Math.log10(MODEL.kept.length)), ky=F.Y(Math.log10(MODEL.kneeCut));
  const rail=F.plot.appendChild(el("line",{x1:kx,y1:CY0+CHT,x2:kx,y2:CY0+CHT,
    stroke:"var(--accent)","stroke-width":"1.5","stroke-dasharray":"4 3","stroke-opacity":"0"}));
  const knot=F.plot.appendChild(el("circle",{cx:kx,cy:ky,r:2.4,fill:"var(--accent)","fill-opacity":"0"}));


  /* the rain. A stable subsample of the doomed, each with its own phase, so
     the fall is weather rather than one synchronised dump. */
  const RAIN=150, rs=Math.max(1,Math.floor(MODEL.lost.length/RAIN));
  const drops=MODEL.lost.filter((c,i)=>i%rs===0).slice(0,RAIN).map(c=>{
    const p=px(c), w=F.toWorld(p[0],p[1]);
    return {p,wx:w[0],wy:w[1],ph:c.jx+0.5};
  });
  const fallPool=pool(g,{fill:"var(--cull)","fill-opacity":".8"});
  const shadPool=pool(F.plot,{fill:"var(--stroke)","fill-opacity":".26"});

  const T=beats(8.4); let t=0;
  const run=dt=>{
    t=(t+dt)%T.total;
    const pSet=seg(t,T.settle), pCut=easeOut(seg(t,T.cut)), pLab=easeOut(seg(t,T.label));
    const pExit=eio(seg(t,T.exit));
    keepPool.node.setAttribute("fill-opacity",(0.62*Math.min(1,pSet*1.4)).toFixed(3));
    /* the rail grows up out of the axis at the rank it just found */
    rail.setAttribute("y2",(CY0+CHT-(CHT*0.92)*pCut).toFixed(1));
    rail.setAttribute("stroke-opacity",(0.95*pCut).toFixed(3));
    knot.setAttribute("fill-opacity",(pCut>0.6?(pCut-0.6)/0.4:0).toFixed(3));

    const air=[], shad=[];
    for(const d of drops){
      const k=Math.max(0,Math.min(1,(pExit-d.ph*0.30)/(1-d.ph*0.30)));
      if(k<=0||k>=1) continue;
      /* off the near eaves: out toward the viewer as it goes down, so the
         fall clears the building instead of passing through it */
      const out=k*k*0.55;
      const s=P(d.wx+out,d.wy+out,n.h-k*(n.h+0.55));
      air.push([s[0],s[1],2.2*(1-k*0.35)]);
      if(k<0.25) shad.push([d.p[0],d.p[1],1.9]);
    }
    fallPool.set(air);
    fallPool.node.setAttribute("fill-opacity",(0.8*(1-Math.pow(pExit,3))).toFixed(3));
    shadPool.set(shad,1.9);
    tailPool.node.setAttribute("fill-opacity",(0.34*(1-pExit*0.75)).toFixed(3));

  };
  run(0); everyFrame(run);
}
DRAW.kneeroof=drawKneeRoof;

/* ============================================================
   02 · MITO %
   A cell leaking its cytoplasm keeps its mitochondria longest, so a high
   mitochondrial read fraction is the signature of one that was dying before
   it was fixed. The cut is median + 3 x MAD over the survivors, per sample —
   not a round number — and the arithmetic is on the panel because it is short
   enough to check by eye, which is the whole argument for preferring it.

   The axis stops a little past the cut rather than at the far end of the
   dying tail: a handful of cells at 40% would squash the entire singlet
   distribution into two bins and hide the shape the cut is made against.
   They are off-scale, and the count on the panel is over all of them anyway.

   GESTURE: dying cells RISE straight up off the roof and fade. They are
   leaking, so they leave upward, slowly, and their shadows shrink under them.
   ============================================================ */
function drawMitoRoof(g,n){
  building(g,n,SKIN.works);
  const F=roofFrame(g,n,n.h,CW);

  const XD=[0,Math.max(18,Math.ceil((MODEL.mito.cut*2.4)/5)*5)], YD=[0,1];
  const BINS=30, hist=new Array(BINS).fill(0);
  MODEL.cells.forEach(c=>{ const b=Math.floor(c.mitoPct/XD[1]*BINS);
    if(b>=0&&b<BINS) hist[b]++; });
  const hmax=Math.max.apply(null,hist)||1;

  axesFrame(F,{id:n.id,xd:XD,yd:YD,trend:"none",
    xlab:"MITOCHONDRIAL %",ylab:"CELLS",
    xt:[[0,"0"],[5,"5"],[10,"10"],[15,"15"]],yt:[]});

  /* A rectangle painted on a roof comes out of the matrix as a
     parallelogram, which is what a rectangle painted on a roof looks like. */
  const bw=CWD/BINS;
  const bars=hist.map((v,i)=>{
    const x=CX0+i*bw, h=(v/hmax)*CHT;
    return F.plot.appendChild(el("rect",{x:x+0.6,y:CY0+CHT-h,
      width:Math.max(0.6,bw-1.2),height:h,
      fill:(i+0.5)/BINS*XD[1]>MODEL.mito.cut?"var(--cull)":"var(--keep)","fill-opacity":"0"}));
  });

  const cx=F.X(MODEL.mito.cut);
  const rail=F.plot.appendChild(el("line",{x1:cx,y1:CY0-2,x2:cx,y2:CY0+CHT,
    stroke:"var(--accent)","stroke-width":"1.5","stroke-dasharray":"4 3","stroke-opacity":"0"}));


  /* the ones that go, spread over the tail rather than stacked on the axis */
  const risers=MODEL.mitoGone.map(c=>{
    const p=[F.X(Math.min(XD[1]*0.99,c.mitoPct)), CY0+CHT-6-(c.jy+0.5)*(CHT*0.42)];
    const w=F.toWorld(p[0],p[1]);
    return {p,wx:w[0],wy:w[1],ph:c.jx+0.5};
  });
  const restPool=pool(F.plot,{fill:"var(--cull)","fill-opacity":"0"});
  restPool.set(risers.map(r=>r.p),2.1);
  const airPool=pool(g,{fill:"var(--cull)","fill-opacity":".85"});
  const shadPool=pool(F.plot,{fill:"var(--stroke)","fill-opacity":".3"});

  const T=beats(9.1); let t=0;
  const run=dt=>{
    t=(t+dt)%T.total;
    const pM=eio(seg(t,T.method)), pCut=easeOut(seg(t,T.cut));
    const pMark=easeOut(seg(t,T.mark)), pLab=easeOut(seg(t,T.label)), pExit=eio(seg(t,T.exit));
    bars.forEach((b,i)=>{
      const app=Math.max(0,Math.min(1,(pM-(i/BINS)*0.5)/0.5));
      const over=(i+0.5)/BINS*XD[1]>MODEL.mito.cut;
      b.setAttribute("fill-opacity",(app*(over?0.32+0.5*pMark:0.6)).toFixed(3));
    });
    rail.setAttribute("stroke-opacity",(0.95*pCut).toFixed(3));

    const air=[], shad=[], rest=[];
    for(const r of risers){
      const k=Math.max(0,Math.min(1,(pExit-r.ph*0.32)/(1-r.ph*0.32)));
      if(k<=0){ rest.push([r.p[0],r.p[1],2.1]); continue; }
      const s=P(r.wx,r.wy,n.h+k*1.35);
      air.push([s[0],s[1],2.4*(1-k*0.45)]);
      shad.push([r.p[0],r.p[1],2.1*(1-k*0.7)]);
    }
    restPool.set(rest);
    restPool.node.setAttribute("fill-opacity",(0.8*pMark).toFixed(3));
    airPool.set(air);
    airPool.node.setAttribute("fill-opacity",(0.85*pMark*(1-pExit*pExit)).toFixed(3));
    shadPool.set(shad);
    shadPool.node.setAttribute("fill-opacity",(0.3*pMark*(1-pExit)).toFixed(3));

  };
  run(0); everyFrame(run);
}
DRAW.mitoroof=drawMitoRoof;

/* ============================================================
   04 · DOUBLETS
   Two cells in one barcode. scDblFinder finds them by MANUFACTURING ITS OWN
   REFERENCE: take pairs of real cells from different neighbourhoods, add them
   together, and score every real cell by how many of its nearest neighbours
   are one of those synthetics. A doublet lands BETWEEN two clusters, where no
   singlet lives.

   So the roof is the expression embedding rather than a histogram — because
   between-ness is the entire signal, and only an embedding has a between. The
   chords crossing it ARE the manufacture, which is the part nobody pictures.

   AND IT IS THRESHOLDED AGAINST THE EXPECTED COLLISION RATE, which is the one
   real number on any of these roofs: three barcode rounds give 442,368 paths,
   the fourth splits the run into 8 sublibraries, 94,616 cells were called,
   and Poisson over paths within a sublibrary says what share of recovered
   barcodes should hold two cells. The scorer's own rate is modelled and sits
   beside it. Where the two disagree is the interesting part and the page
   shows both rather than picking one.

   GESTURE, and it is the one gesture here that is an argument: TRUE doublets
   PULL APART into their two halves, each half travelling toward the
   neighbourhood it came from. Over-called singlets get a ring and fade where
   they sit. Pulling apart a cell that was only ever one cell would be the
   drawing telling a lie the method does not tell.
   ============================================================ */
function drawDoubletRoof(g,n){
  building(g,n,SKIN.works);
  const F=roofFrame(g,n,n.h,CW);

  const XD=[-0.04,1.04], YD=[-0.04,1.04];
  axesFrame(F,{id:n.id,xd:XD,yd:YD,trend:"none",
    xlab:"EXPRESSION 1",ylab:"EXPRESSION 2",xt:[],yt:[]});

  const px=c=>[F.X(c.ex), F.Y(c.ey)];

  /* the manufacture: a chord between two neighbourhoods with the synthetic
     it produced sitting on it, transcript-weighted */
  let chord=""; const synth=[];
  MODEL.dbl.pairs.slice(0,40).forEach(([a,b])=>{
    const pa=px(a), pb=px(b);
    chord+="M"+pa[0].toFixed(1)+" "+pa[1].toFixed(1)+"L"+pb[0].toFixed(1)+" "+pb[1].toFixed(1);
    const f=a.umi/(a.umi+b.umi);
    synth.push([pa[0]*f+pb[0]*(1-f), pa[1]*f+pb[1]*(1-f)]);
  });
  const chordEl=F.plot.appendChild(el("path",{d:chord||"M0 0",fill:"none",
    stroke:"var(--accent)","stroke-width":".8","stroke-opacity":"0"}));
  const synthPool=pool(F.plot,{fill:"none",stroke:"var(--accent)","stroke-width":"1","stroke-opacity":"0"});
  synthPool.set(synth,2.4);

  const bulkPool=pool(F.plot,{fill:"var(--keep)","fill-opacity":".48"});
  bulkPool.set(MODEL.cells.filter(c=>c.score<MODEL.dbl.cut).map(px),1.6);

  /* the score rail along the foot: where the cut falls in the distribution it
     was computed from, and where the expected rate would put it */
  const smax=MODEL.cells.reduce((m,c)=>Math.max(m,c.score),0)||1;
  const ry=CY0+CHT+2, sxv=v=>CX0+(v/smax)*CWD;
  F.g.appendChild(el("line",{x1:CX0,y1:ry,x2:CX0+CWD,y2:ry,
    stroke:"var(--fg3)","stroke-width":"1","stroke-opacity":".5"}));
  const rug=pool(F.g,{fill:"var(--fg2)","fill-opacity":".5"});
  rug.set(MODEL.cells.map(c=>[sxv(c.score),ry]),1.1);
  const cutX=sxv(MODEL.dbl.cut);
  const cutRail=F.g.appendChild(el("line",{x1:cutX,y1:ry-7,x2:cutX,y2:ry+5,
    stroke:"var(--accent)","stroke-width":"1.6","stroke-opacity":"0"}));
  /* where a cut set to the expected rate would fall: the score of the
     cell at that quantile from the top */
  const sorted=MODEL.cells.map(c=>c.score).sort((a,b)=>b-a);
  const expScore=sorted[Math.min(sorted.length-1,
    Math.max(0,Math.round(MODEL.expected*sorted.length)-1))];
  const expX=sxv(expScore);
  const expRail=F.g.appendChild(el("line",{x1:expX,y1:ry-7,x2:expX,y2:ry+5,
    stroke:"var(--keep)","stroke-width":"1.4","stroke-dasharray":"2 2","stroke-opacity":"0"}));

  const annS=mkAnn(g,n.id+":synth",["SYNTHETIC","REFERENCE"],"var(--accent)");

  const splits=MODEL.flagged.filter(c=>c.isDoublet&&c.t2>=0).map(c=>{
    const p=px(c), w=F.toWorld(p[0],p[1]);
    const A=TYPES[c.t1], Bt=TYPES[c.t2];
    const wa=F.toWorld(F.X(A.ex),F.Y(A.ey)), wb=F.toWorld(F.X(Bt.ex),F.Y(Bt.ey));
    return {p,wx:w[0],wy:w[1],ax:wa[0],ay:wa[1],bx:wb[0],by:wb[1],ph:c.jx+0.5};
  });
  const overcalls=MODEL.flagged.filter(c=>!c.isDoublet).map(c=>({p:px(c),ph:c.jy+0.5}));
  const halfPool=pool(g,{fill:"var(--cull)","fill-opacity":".85"});
  const shadPool=pool(F.plot,{fill:"var(--stroke)","fill-opacity":".28"});
  const ocPool=pool(F.plot,{fill:"var(--cull)","fill-opacity":"0"});
  const ocRing=pool(F.plot,{fill:"none",stroke:"var(--cull)","stroke-width":"1","stroke-opacity":"0"});

  const T=beats(9.6); let t=0;
  const run=dt=>{
    t=(t+dt)%T.total;
    const pSet=seg(t,T.settle), pMan=easeOut(seg(t,T.method)), pCut=easeOut(seg(t,T.cut));
    const pMark=easeOut(seg(t,T.mark)), pLab=easeOut(seg(t,T.label)), pExit=eio(seg(t,T.exit));
    bulkPool.node.setAttribute("fill-opacity",(0.48*Math.min(1,pSet*1.4)).toFixed(3));
    chordEl.setAttribute("stroke-opacity",(0.42*pMan*(1-pExit*0.7)).toFixed(3));
    synthPool.node.setAttribute("stroke-opacity",(0.75*pMan*(1-pExit*0.7)).toFixed(3));
    cutRail.setAttribute("stroke-opacity",(0.95*pCut).toFixed(3));
    expRail.setAttribute("stroke-opacity",(0.9*pCut).toFixed(3));

    /* true doublets: two halves, each going home */
    const halves=[], shad=[];
    for(const s of splits){
      const k=Math.max(0,Math.min(1,(pExit-s.ph*0.3)/(1-s.ph*0.3)));
      const lift=k*0.95, e=eio(k)*0.42, r=2.5*(1+0.25*pMark)*(k>0?0.72:1);
      if(k<=0){ const q=P(s.wx,s.wy,n.h); halves.push([q[0],q[1],2.5*(1+0.25*pMark)]); }
      else {
        const A=P(s.wx+(s.ax-s.wx)*e, s.wy+(s.ay-s.wy)*e, n.h+lift);
        const Bq=P(s.wx+(s.bx-s.wx)*e, s.wy+(s.by-s.wy)*e, n.h+lift);
        halves.push([A[0],A[1],r],[Bq[0],Bq[1],r]);
      }
      shad.push([s.p[0],s.p[1],2.2*(1-k*0.6)]);
    }
    halfPool.set(halves);
    halfPool.node.setAttribute("fill-opacity",Math.max(0,0.85*pMark*(1-Math.pow(pExit,2.2))).toFixed(3));
    shadPool.set(shad);
    shadPool.node.setAttribute("fill-opacity",Math.max(0,0.28*pMark*(1-pExit)).toFixed(3));

    /* over-calls: they were one cell, so they do not come apart */
    const oc=[], orr=[];
    for(const o of overcalls){
      const k=Math.max(0,Math.min(1,(pExit-o.ph*0.3)/(1-o.ph*0.3)));
      oc.push([o.p[0],o.p[1],2.2*(1+0.2*pMark)]);
      if(k>0) orr.push([o.p[0],o.p[1],2.2*(1+k*2.4)]);
    }
    ocPool.set(oc); ocRing.set(orr);
    ocPool.node.setAttribute("fill-opacity",Math.max(0,0.8*pMark*(1-pExit)).toFixed(3));
    ocRing.node.setAttribute("stroke-opacity",Math.max(0,0.45*(1-pExit)).toFixed(3));

    const mid=a=>a.length?[a.reduce((s,p)=>s+p[0],0)/a.length,
                           a.reduce((s,p)=>s+p[1],0)/a.length]:[CW/2,CW/2];
    const ts=F.toScreen.apply(null,mid(synth));
    const c1=F.toScreen(CX0+CWD/2,CY0+CHT/2);
    placeAnn(annS,ts,c1[0]+ANN_AT[0],c1[1]+ANN_AT[1],pLab*pMan);
  };
  run(0); everyFrame(run);
}
DRAW.doubletroof=drawDoubletRoof;

/* ============================================================
   03 · COMPLEXITY
   Genes detected against total counts, log-log, with a least-squares cubic
   through the cloud and a band opened to a robust residual sigma.

   BOTH TAILS GO, FOR OPPOSITE REASONS, which is the whole point of this
   roof: above the band are under-amplified cells, unusually many distinct
   genes per transcript; below it are over-amplified ones, the same
   transcripts read again and again. Reading this filter as one-sided is the
   common mistake, so the two annotations sit apart and the two gestures are
   deliberately not each other's mirror.

   This is the roof that forced trend:"rising" — see axesFrame(). Genes climb
   with transcripts, so an ordinary flipped y axis puts the trend on the
   DIFFERENCE of the two roof diagonals and the cloud comes out as a vertical
   sliver. Unflipped, both quantities grow away from the near corner and the
   cloud lies along the roof.

   GESTURE: under-amplified cells PEEL OFF the surface and become spheres.
   Over-amplified ones SWELL where they lie and BURST. One leaves the roof
   and one never does, which is the difference between having too many genes
   for your transcripts and too few.
   ============================================================ */
function drawComplexityRoof(g,n){
  building(g,n,SKIN.works);
  const F=roofFrame(g,n,n.h,CW);

  const us=MODEL.cells.map(c=>Math.log10(c.umi)), gs=MODEL.cells.map(c=>Math.log10(c.genes));
  /* Robust limits, not min and max. Transcript counts are log-normal with a
     long right tail and a doublet adds two draws together, so the largest
     cell in the population sits several sigma out on its own — and taking it
     as the axis limit compressed the entire cloud into a two-pixel sliver.
     It rendered, it was wrong, and nothing on screen said so. */
  const XD=domainOf(us,0.004,0.996,0.06);
  const YD=domainOf(gs,0.004,0.996,0.06);

  /* Ordinary placement — x along the bottom, y up the left — like every
     other chart on the page. It is a rising trend, so it needs a squat plot
     to stay off the vertical; see axesFrame(). */
  axesFrame(F,{id:n.id,xd:XD,yd:YD,trend:"none",squat:0.46,
    xlab:"TRANSCRIPTS",ylab:"GENES",
    xt:[[2,"100"],[3,"1k"],[4,"10k"]],yt:[[2,"100"],[3,"1k"]]});

  const px=c=>[F.X(Math.log10(c.umi)), F.Y(Math.log10(c.genes))];

  /* the band, then the fit on top of it */
  const NS_=56, hi=[], lo=[], fitPts=[];
  for(let i=0;i<NS_;i++){
    const lx=XD[0]+((XD[1]-XD[0])*i)/(NS_-1), fy=MODEL.band.fit(lx);
    fitPts.push([F.X(lx),F.Y(fy)]);
    hi.push([F.X(lx),F.Y(fy+MODEL.band.half)]);
    lo.push([F.X(lx),F.Y(fy-MODEL.band.half)]);
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


  const annU=mkAnn(g,n.id+":under",["UNDER-","AMPLIFIED"]);
  const annO=mkAnn(g,n.id+":over", ["OVER-","AMPLIFIED"]);

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
    /* The building stands IN the line now, so left and right are its
       neighbours and below is the cull ledger. What is open is above it and
       the ground either side of the ledger. */
    /* Up-left, above D4's name; and down-right, in the gap before G3. Those
       are the two clear zones: D4's box is directly left, G3's directly
       right, and the cull ledger sits under the near corner. */
    /* the two tails, below the row and apart from each other, because the
       one thing this roof must not do is let them look alike */
    const c1=F.toScreen(CX0+CWD/2,CY0+CHT/2);
    /* further out than ANN_AT on its own: the cull ledger hangs under this
       building and runs its own name down-left from there. */
    placeAnn(annU,au,c1[0]+ANN_AT[0]-104,c1[1]+ANN_AT[1]+96,pLab);
    placeAnn(annO,ao,c1[0]+ANN_AT[0]+96,c1[1]+ANN_AT[1]+52,pLab);
    /* Straight up, and centred. The panel is a FILLED rect, so wherever it
       lands it is a click target — and parked up-left it sat exactly over
       D4's roof, which meant clicking the mitochondrial cull selected this
       building instead. check-clicks.mjs caught it; nothing about the picture
       looked wrong. Directly above the line is the one place on this map with
       neither a neighbour nor the ledger under it. */
  };
  run(0); everyFrame(run);
}
DRAW.complexityroof=drawComplexityRoof;


/* ============================================================
   THE ATTRITION STAIRCASE — a ground-plane element, behind the row

   The cull ledger painted flat on the ground. ONE STRAIGHT EDGE runs the
   length of the lane; the opposite edge STAIRCASES down, one riser per
   station, and a tributary peels off each riser and drifts clear.

   WHY A STRAIGHT EDGE
   It gives the run a datum. Every step is read against one unmoving line
   instead of against a shape changing on both sides at once, and the
   staircase becomes the only thing moving — which is the point of the
   graphic. The symmetric version this replaces had neither edge holding
   still, so the eye had nothing to measure against.

   ORIENTATION
   On the ground plane, DECREASING y projects up and to the right. The datum
   sits at the band's larger-y edge and yBase is set just above the row, so
   the buildings land on the far side of that line and the band reads as
   lying behind them. The staircase descends toward the datum; tributaries
   leave up-right, away from the buildings.

   HOW IT SITS
   z = 0.002, a hair above the grid and far below the buildings. No ticker —
   a moving background behind four moving foregrounds is noise. And
   pointer-events:none: it spans the whole lane and is painted after some of
   what stands near it, so without that it swallows their clicks.

   SAME TRICK AS THE ROOFS. Drawn flat and wrapped in one transform="matrix()"
   built from three projected GROUND corners, so the steps and the painted
   numbers shear into the plane correctly and for free.

   IT OWNS NO DATA — counts arrive on the node as `ledger`.
   ============================================================ */
const smoothstep=t=>(t<=0?0:t>=1?1:t*t*(3-2*t));

function drawAttritionStaircase(g,n){
  const {x0,x1,yBase,width:WD,z:Z=0.002,ledger}=n;
  const flip=!!n.flip;

  /* local (0,0) is the far edge at the start; local y grows toward the datum */
  const yTopW=flip?yBase+WD:yBase-WD;
  const c00=P(x0,yTopW,Z), c10=P(x1,yTopW,Z), c01=P(x0,yBase,Z);
  const LW=Math.hypot(c10[0]-c00[0],c10[1]-c00[1]);
  const LH=Math.hypot(c01[0]-c00[0],c01[1]-c00[1]);
  const Ux=(c10[0]-c00[0])/LW, Uy=(c10[1]-c00[1])/LW;
  const Vx=(c01[0]-c00[0])/LH, Vy=(c01[1]-c00[1])/LH;

  const root=g.appendChild(el("g",{
    transform:"matrix("+Ux+" "+Uy+" "+Vx+" "+Vy+" "+c00[0]+" "+c00[1]+")",
    opacity:n.opacity!=null?n.opacity:0.8,
    "pointer-events":"none"}));

  const lxOf=wx=>((wx-x0)/(x1-x0))*LW;
  const wOf=count=>(count/ledger.start)*LH;

  let running=ledger.start;
  const st=ledger.steps.map(s=>{
    const into=running, out=running-s.culled;
    running=out;
    return {...s,into,out,lx:lxOf(s.x),pct:(s.culled/into)*100};
  });
  const final=running;

  const KEEP="var(--keep)", FLOW="var(--cull)";

  /* ---- tributaries first, so the band reads continuous over them ---- */
  const SEGS=18, reach=LW*0.13, drift=LH*0.70, MINW=LH*0.055;
  /* The departure curve is QUADRATIC, not a smoothstep. A smoothstep flattens
     at the far end and the stream settles into an S; t*t leaves the riser
     tangent to the band and keeps bending away, so it reads as barcodes still
     going rather than barcodes parked. It fades out before it stops. */
  const rise=t=>t*t;
  st.forEach(s=>{
    const th=wOf(s.into)-wOf(s.out);          /* exactly what this riser sheds */
    if(th<=0.01) return;
    const inner0=LH-wOf(s.out);               /* the edge AFTER the step */
    const outer0=LH-wOf(s.into);              /* the edge BEFORE it */
    for(let k=0;k<SEGS;k++){
      const a=k/SEGS, b=(k+1)/SEGS, pA=rise(a), pB=rise(b);
      /* The riser width is exactly proportional — that is where the claim is
         made. A thin stream then flares as it drifts clear, so a small cull is
         still visibly a cull. The staircase carries the arithmetic either way. */
      const eA=th<MINW?(MINW-th)*pA:0, eB=th<MINW?(MINW-th)*pB:0;
      const xa=s.lx+reach*a, xb=s.lx+reach*b;
      const iA=inner0-drift*pA, iB=inner0-drift*pB;
      const oA=outer0-drift*pA-eA, oB=outer0-drift*pB-eB;
      const fade=Math.pow(1-a,1.25);
      root.appendChild(el("polygon",{points:pts([[xa,iA],[xb,iB],[xb,oB],[xa,oA]]),
        fill:FLOW,"fill-opacity":(0.52*fade).toFixed(3)}));
      root.appendChild(el("line",{x1:xa,y1:oA,x2:xb,y2:oB,stroke:FLOW,
        "stroke-width":"1.2","stroke-opacity":(0.8*fade).toFixed(3)}));
      root.appendChild(el("line",{x1:xa,y1:iA,x2:xb,y2:iB,stroke:FLOW,
        "stroke-width":"1.2","stroke-opacity":(0.8*fade).toFixed(3)}));
    }
  });

  /* ---- the band: straight datum, staircased far edge ---- */
  const stair=[[0,LH-wOf(ledger.start)]];
  st.forEach(s=>{
    stair.push([s.lx,LH-wOf(s.into)]);        /* tread */
    stair.push([s.lx,LH-wOf(s.out)]);         /* riser */
  });
  stair.push([LW,LH-wOf(final)]);

  root.appendChild(el("polygon",{points:pts(stair.concat([[LW,LH],[0,LH]])),
    fill:KEEP,"fill-opacity":".18"}));
  root.appendChild(el("polyline",{points:pts(stair),fill:"none",stroke:KEEP,
    "stroke-width":"1.6","stroke-opacity":".8","stroke-linejoin":"miter"}));
  root.appendChild(el("line",{x1:0,y1:LH,x2:LW,y2:LH,stroke:KEEP,
    "stroke-width":"1.6","stroke-opacity":".8"}));

  /* ---- numbers ---- */
  const FS=LH*0.075;
  st.forEach(s=>{
    /* the figure rides its own departing stream */
    const pm=rise(0.45), th=wOf(s.into)-wOf(s.out);
    const flare=th<MINW?(MINW-th)*pm:0;
    const t=root.appendChild(el("text",{
      x:s.lx+reach*0.45+FS*0.3,
      y:LH-wOf(s.into)-drift*pm-flare-FS*0.45,
      fill:FLOW,"font-size":FS,"font-family":MONO,"font-weight":"600","fill-opacity":".95"}));
    t.textContent="\u2212"+s.pct.toFixed(1)+"%";
  });

  /* The running remainder sits INSIDE the band where the band is tall enough
     to hold it, and just outside the staircase edge where it is not. After
     the knee this band is 3.3% of its own height — a couple of pixels — so
     centring every figure in it, as the sandbox does, would stack four
     numbers on one line. Outside means AWAY from the buildings, on the same
     side the tributaries leave. */
  const edges=[0,...st.map(s=>s.lx),LW];
  const rem=[ledger.start,...st.map(s=>s.out)];
  rem.forEach((cnt,i)=>{
    const w=wOf(cnt), cx=(edges[i]+edges[i+1])/2;
    const inside=w>FS*1.9;
    const t=root.appendChild(el("text",{
      x:cx, y:inside ? LH-w/2+FS*0.34 : LH-w-FS*0.6,
      "text-anchor":"middle",fill:KEEP,"font-size":FS*0.92,"font-family":MONO,
      "font-weight":"600","letter-spacing":FS*0.09,"fill-opacity":".82"}));
    const pc=100*cnt/ledger.start;
    t.textContent=(pc>=10?pc.toFixed(0):pc.toFixed(2))+"%";
  });

  /* NO ticker, on purpose. */
}
DRAW.attritionstaircase=drawAttritionStaircase;
