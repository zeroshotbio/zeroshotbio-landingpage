/* ============================================================
   fq-shapes.js — this page's visual vocabulary: three shapes borrowed and
   one of its own.

   The three borrowed are LIFTED VERBATIM FROM /pipeline's pipeline-shapes.js,
   down to the seed drawMatrix uses for its sparsity, because a station here
   must be the same object as the station there. A box that looks different is
   telling a reader they are looking at two different things.

     SKIN     the three skins its objects wear, copied from /pipeline
     topOf    every object on this page is a box, so it is just n.h
     drawTile / drawHeap / drawMatrix   the six stations, a heap, the cube
     drawReads                          THIS PAGE'S OWN — see the block below

   THIS PAGE LOADS NO POPULATION AND DERIVES NO STATISTIC. The four roofed
   culls live in /culls/culls-draw.js, shared between /pipeline and
   /bioinformatics_pipe; nothing on this stretch of the row has a decision with
   a chart behind it, so neither of those files is loaded here. What this page
   does need from that pair is roofFrame(), and it has been lifted into
   fq-iso.js where it belongs — it is projection, not subject matter.

   Load order: iso -> shapes -> data -> view
   ============================================================ */

const V=n=>`var(--${n})`;

/* Copied from /pipeline. tile is the skin its row-3 stations wear and anchor
   is the skin its landmarks wear; works is kept because it is part of the
   shared vocabulary, and because topOf() must keep treating it the same way
   in both files. */
const SKIN={
  tile  :{top:V("t-top"), left:V("t-left"), right:V("t-right"), sw:1,   so:.6},
  anchor:{top:V("a-top"), left:V("a-left"), right:V("a-right"), sw:1.7, so:1},
  works :{top:V("k-top"), left:V("k-left"), right:V("k-right"), sw:1.4, so:1},
};

/* Every object on this page is a box, so the height a structure reaches is
   simply its height. The label anchor and the occlusion silhouette read it. */
const topOf = n => n.h;


/* The registry every shape puts itself into. The view looks a node's shape up
   here by name, so a new shape is one function and one line at the bottom of
   this file. Nothing on this page derives a threshold, a population or a
   statistic: every figure it quotes is read off an artefact and lives in the
   prose, which is why there is no model between the shapes and the data. */
const DRAW={};

/* ============================================================
   THE THREE SHAPES COPIED FROM /pipeline
   Verbatim. A step on this page must be the same object as the step on that
   one, down to the seed drawMatrix uses for its sparsity.
   ============================================================ */

/* every station on this row. n.hatch means the stage destroys data, and five
   of the six carry it — the exception is the genome index, which decides what
   can be found and throws nothing away. */
const drawTile=(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile,n.hatch);

/* No user today — the FASTQ landmark is drawn by drawReads below, which opens
   one read up instead of piling the files. It stays because the shapes file is
   the shared vocabulary, not a list of what is on screen this week. */
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
   THE READS — the one shape this page has of its own.

   A swarming pool, and one fragment opened up.

   THE FRAGMENT IS DRAWN IN ITS OWN ORDER, NOT IN R2's ORDER. BC1 sits nearest
   the cDNA because RT attached it first; each ligation round adds the next one
   further out; the UMI rides on the round-3 oligo at the far end. R2 sequences
   inward from that end — which is why it meets the UMI first and reaches round
   1 last. Draw the molecule truthfully and the reversal explains itself.

   THE POOL IS A BALL, NOT A RECTANGLE: points distributed uniformly through a
   sphere, slowly turning on two axes, depth driving size and opacity. The one
   being magnified is geometrically identical to every other read — same length,
   same weight, same wander. Only its colour and its ring say it is the one.

   HOW IT SITS IN THIS WORLD. The ball is a REAL ball, in world coordinates,
   turned by a real rotation and projected through P() like everything else on
   the map — not a flat scatter pretending. The fragment is the opposite: flat
   2D, in a 176 x 176 chart space, laid onto the pad by one roofFrame() matrix.
   That is the page's own grammar and it falls out for free here:

     PAINTED things are ELLIPSES.  AIRBORNE things are CIRCLES.

   The reads are airborne, so they are drawn in screen space and stay circles
   and straight lines. The fragment is painted, so it shears with the surface.
   THE BALL IS DELIBERATELY NOT IN THE NODE'S SILHOUETTE — `topOf` is the pad,
   not the top of the ball — because the reads are not part of the building.

   COLOUR. The original of this drawing had five hues. This map has three tokens
   and a rule against a fourth, so the distinctions that survive are the ones
   the tokens already carry — cDNA is `--keep`, the barcodes are `--accent` —
   and the one they do not carry is made by ENCODING instead: the UMI is the
   same accent as a barcode, drawn as an OUTLINE rather than a fill, because it
   is the one tag on the molecule that is not a barcode. See HANDOFF.md.

   PERFORMANCE. 380 reads is 760 line segments a frame, which is far too many
   elements to move one attribute at a time. Each depth bucket is therefore ONE
   <path> whose `d` is a run of subpaths, rebuilt as a single string and written
   with one setAttribute — `pool()` on the other map, the same idea. Alpha and
   weight vary by having four buckets, not by having 760 attributes. The hero is
   the exception and is drawn as itself, because there is one of it.
   ============================================================ */

/* The population is built ONCE, at load, from a fixed seed — so the pool is the
   same pool on every reload and in every browser, and the hero is the same
   read. A swarm that reshuffles on refresh is a decoration; this one is a
   drawing of an object. */
const READ_SEED=0x5eedf15;
const mulberry32=(a)=>()=>{
  a|=0; a=(a+0x6d2b79f5)|0;
  let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
};

const READS=(()=>{
  const rnd=mulberry32(READ_SEED), reads=[];
  for(let i=0;i<380;i++){
    /* uniform THROUGH the ball: a direction on the sphere, and a radius by
       cube root. Taking a uniform radius instead piles the population into the
       centre and the ball reads as a fuzzy blob with a bright core. */
    let x,y,z,d2;
    do{ x=rnd()*2-1; y=rnd()*2-1; z=rnd()*2-1; d2=x*x+y*y+z*z; }
    while(d2>1||d2<1e-6);
    const r=Math.cbrt(rnd())/Math.sqrt(d2);
    reads.push({x:x*r, y:y*r, z:z*r,
      ph:rnd()*Math.PI*2, ph2:rnd()*Math.PI*2,
      sp:0.9+rnd()*1.5,               /* its own wander rate */
      amp:0.020+rnd()*0.045,          /* its own wander reach, in ball units */
      a0:rnd()*Math.PI, spin:(rnd()-0.5)*0.55});
  }
  return {reads, hero:118};
})();

/* left to right ALONG THE MOLECULE. Widths are schematic but proportionate:
   64 bases of insert, the unsequenced middle, then the three ligation barcodes
   with their linkers and the UMI on the far end. */
const FRAG=[
  {k:"cdna", w:76, tone:"keep",  lab:"cDNA"},
  {k:"gap",  w:62, tone:"ghost", lab:"never sequenced"},
  {k:"bc1",  w:13, tone:"bc",    lab:"BC1"},
  {k:"l1",   w:26, tone:"link",  lab:""},
  {k:"bc2",  w:13, tone:"bc",    lab:"BC2"},
  {k:"l2",   w:26, tone:"link",  lab:""},
  {k:"bc3",  w:13, tone:"bc",    lab:"BC3"},
  {k:"umi",  w:16, tone:"umi",   lab:"UMI"},
];

function drawReads(g,n){
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const PAD=n.h;                     /* the pad IS the node: topOf(n) is here */

  /* ---- the pad ----------------------------------------------------------
     IT IS A RECTANGLE, AND THE LONG SIDE IS THE MOLECULE. A square footprint
     projects to a diamond twice as wide as either of its diagonals, so a strip
     laid along one of them sits in the middle of a large empty plate. The pad
     is therefore long in d and narrow in w — n.d runs along the strip — and it
     reads as a bench with one thing laid out on it.

     The top face is then painted again, slightly inset and darker, so the two
     marks have something to be legible against: --keep and --accent on the
     anchor skin's own top is two greys apart. Same trick as building() on the
     culls page, same reason. */
  paint(g,n.x,n.y,n.w,n.d,PAD,SKIN.anchor);
  /* data-fixed MARKS THE ONE PART OF THIS OBJECT THAT DOES NOT MOVE ON ITS
     OWN, and check-drawn.mjs measures it instead of the whole group. That
     check asks "did this come back drawn where it was left", by comparing the
     centre of a group's bounding box across a reload — which is a sound
     question and a useless measurement here, because most of this group is a
     turning ball of reads and its silhouette is a different shape every frame.
     It reported sixty units of drift on a node nothing had touched. */
  g.appendChild(el("polygon",{points:faces(n.x,n.y,n.w*0.97,n.d*0.985,PAD).top,
    "data-fixed":"1",
    fill:"var(--t-top)","fill-opacity":".92",stroke:"var(--stroke)",
    "stroke-width":".8","stroke-opacity":".45"}));

  /* ================= the fragment, painted flat on the pad ================
     roofFrame is square by construction and takes its side from n.w. What is
     wanted here is a chart as long as the pad, so it is handed the pad's OWN
     long side — the frame is a projection helper and does not care which
     field the number came from. Local +x then runs along the molecule, up and
     to the right at -30 degrees, like every other string on the map. */
  const CW=176, F=roofFrame(g,{x:n.x,y:n.y,w:n.d},PAD,CW);
  const FX0=5, FX1=171, FW=FX1-FX0, BY=84, BH=11, BMID=BY+BH/2;
  const SEG=8, SUB=6.4, HEAD=9;

  const total=FRAG.reduce((s,x)=>s+x.w,0);
  const wOf=s=>(s.w/total)*FW;
  const xs=[]; let cx=FX0;
  FRAG.forEach(s=>{ xs.push(cx); cx+=wOf(s); });

  const text=(str,x,y,size,fill,weight)=>{
    const t=el("text",{x:0,y:0,"text-anchor":"middle","font-size":size,
      "font-family":MONO,"letter-spacing":(size*0.02).toFixed(2),fill,
      "font-weight":weight||"400",transform:`translate(${x},${y})`});
    t.textContent=str; F.g.appendChild(t); return t;
  };
  const tick=(x,y0,y1,col)=>F.g.appendChild(el("line",{x1:x,y1:y0,x2:x,y2:y1,
    stroke:col,"stroke-width":".8","stroke-opacity":".55"}));

  FRAG.forEach((s,i)=>{
    const x=xs[i], w=wOf(s), mid=x+w/2;
    if(s.k==="gap"){
      /* the unsequenced middle. An outline rather than a block, because there
         is nothing in it — and its name goes on the second label row, where it
         has the room its fifteen characters need. */
      F.g.appendChild(el("rect",{x,y:BY,width:w,height:BH,fill:"none",
        stroke:"var(--fg3)","stroke-width":"1","stroke-dasharray":"3.4 3.4"}));
      tick(mid,BY+BH,116,"var(--fg3)");
      text(s.lab,mid,122,SUB,"var(--fg3)");
      return;
    }
    if(s.tone==="link"){
      F.g.appendChild(el("rect",{x,y:BY+2.2,width:w-0.6,height:BH-4.4,
        fill:"var(--fg3)","fill-opacity":".30"}));
      return;
    }
    if(s.tone==="umi"){
      /* SAME COLOUR AS A BARCODE, DIFFERENT ENCODING. The UMI is not a
         barcode — it names the molecule, not the cell — and this map does not
         get a fourth hue to say so. Outline against fill says it instead.
         Its label goes ABOVE the bar: below, it would land on BC3's. */
      F.g.appendChild(el("rect",{x,y:BY,width:w-0.6,height:BH,
        fill:"var(--accent)","fill-opacity":".16",
        stroke:"var(--accent)","stroke-width":"1.2"}));
      tick(mid,BY-3,BY,"var(--accent)");
      text(s.lab,mid,BY-5.5,SEG,"var(--accent)","600");
      return;
    }
    const col=s.tone==="keep"?"var(--keep)":"var(--accent)";
    F.g.appendChild(el("rect",{x,y:BY,width:w-0.6,height:BH,fill:col,"fill-opacity":".9"}));
    if(s.tone==="keep") text(s.lab,mid,BMID+SEG*0.36,SEG,"var(--bg)","600");
    else { tick(mid,BY+BH,103,col); text(s.lab,mid,109,SEG,col,"600"); }
  });

  /* ---- the two reads, bracketed over what each one covers ---------------
     R1 runs into the insert from the cDNA end; R2 runs inward from the far
     end, which is why its arrow points back along the molecule. The gap
     between the brackets is the part neither read reaches. */
  const gi=FRAG.findIndex(s=>s.k==="gap");
  const bracket=(xa,xb,col,label,dir)=>{
    const yb=BY-17;
    F.g.appendChild(el("path",{fill:"none",stroke:col,"stroke-width":"1.1","stroke-opacity":".9",
      d:`M ${xa} ${yb+4} L ${xa} ${yb} L ${xb} ${yb} L ${xb} ${yb+4}`}));
    const a=2.4, ax=dir>0?xb:xa;
    F.g.appendChild(el("polygon",{fill:col,
      points:`${ax+dir*a*1.6},${yb} ${ax},${yb-a} ${ax},${yb+a}`}));
    text(label,(xa+xb)/2,yb-4.5,HEAD,col,"600");
  };
  bracket(FX0,xs[gi],"var(--keep)","R1",1);
  bracket(xs[gi]+wOf(FRAG[gi]),FX1,"var(--accent)","R2",-1);

  /* ================= the pool, airborne over the pad ====================== */
  /* Screen-space, so a read stays a straight line of even weight however the
     ball turns. Everything below is drawn into `g` rather than into F.g. */
  const RB=n.d*0.34;                      /* ball radius, world units */
  /* HIGH ENOUGH TO BE IN THE AIR. Lower, and the ball's lower half lands on
     the pad's far half and the two read as one object — which is the opposite
     of what the drawing is for. This clears the pad's back corner, and clears
     the node's own name, which is anchored at that corner. */
  const ZC=PAD+RB+3.2;
  const UU=RB*S*C30/32;                   /* the original's unit: R was 32 of them */

  const NB=4, pools=[];
  for(let b=0;b<NB;b++){
    const d=(b+0.5)/NB;
    pools.push({node:g.appendChild(el("path",{fill:"none",stroke:"var(--fg3)",
        "stroke-linecap":"butt",
        "stroke-width":(0.85*UU*(0.72+d*0.5)).toFixed(2),
        "stroke-opacity":(0.16+d*0.52).toFixed(3)})),
      sc:0.72+d*0.5, d:""});
  }
  /* the leaders first, so they run UNDER the ring and the hero rather than
     across them */
  const lead=g.appendChild(el("path",{fill:"none",stroke:"var(--fg)","stroke-opacity":".26",
    "stroke-width":"0.6","stroke-dasharray":"2.4 2.6","pointer-events":"none"}));
  const ring=g.appendChild(el("circle",{fill:"none",stroke:"var(--fg)",
    "stroke-opacity":".55","stroke-width":"0.9"}));
  const h1=g.appendChild(el("line",{stroke:"var(--keep)","stroke-linecap":"butt"}));
  const h2=g.appendChild(el("line",{stroke:"var(--accent)","stroke-linecap":"butt"}));

  const [LX,LY]=F.toScreen(FX0,BMID), [RX,RY]=F.toScreen(FX1,BMID);

  let T=0;
  const seen=[];
  function render(){
    const A=T*0.26, cosA=Math.cos(A), sinA=Math.sin(A);
    const B=T*0.11, cosB=Math.cos(B), sinB=Math.sin(B);
    seen.length=0;
    for(let i=0;i<READS.reads.length;i++){
      const rd=READS.reads[i];
      /* its own wander, then the ball's own turn on two axes */
      const wx=rd.x+Math.sin(T*rd.sp+rd.ph)*rd.amp;
      const wy=rd.y+Math.cos(T*rd.sp*0.83+rd.ph2)*rd.amp;
      const wz=rd.z+Math.sin(T*rd.sp*0.66+rd.ph*1.7)*rd.amp;
      const x1=wx*cosA-wy*sinA, y1=wx*sinA+wy*cosA;
      const y2=y1*cosB-wz*sinB, z2=y1*sinB+wz*cosB;
      /* DEPTH IS THE MAP'S OWN DEPTH, not a third coordinate of its own: in
         this projection what is nearer the eye is what has the greater x+y,
         which is the same key everything else on the page is sorted by. */
      const dep=Math.max(0,Math.min(1,((x1+y2)/Math.SQRT2+1)/2));
      const p=P(n.x+x1*RB, n.y+y2*RB, ZC+z2*RB);
      seen.push({i,rd,px:p[0],py:p[1],d:dep});
    }
    seen.sort((a,b)=>a.d-b.d);

    for(let b=0;b<NB;b++) pools[b].d="";
    let hero=null;
    for(let k=0;k<seen.length;k++){
      const s=seen[k];
      if(s.i===READS.hero){ hero=s; continue; }
      const b=Math.min(NB-1,Math.floor(s.d*NB)), sc=pools[b].sc;
      const a=s.rd.a0+T*s.rd.spin, ca=Math.cos(a), sa=Math.sin(a);
      const L=4.9*UU*sc, gp=1.35*UU*sc;
      const ax=s.px+ca*(L+gp), ay=s.py+sa*(L+gp);
      const bx=s.px+ca*gp,     by=s.py+sa*gp;
      pools[b].d+="M"+(s.px-ca*(L+gp)).toFixed(1)+" "+(s.py-sa*(L+gp)).toFixed(1)+
                  "L"+(s.px-ca*gp).toFixed(1)+" "+(s.py-sa*gp).toFixed(1)+
                  "M"+bx.toFixed(1)+" "+by.toFixed(1)+"L"+ax.toFixed(1)+" "+ay.toFixed(1);
    }
    for(let b=0;b<NB;b++) pools[b].node.setAttribute("d",pools[b].d||"M0 0");

    if(hero){
      /* geometrically identical to every other read — same length, same
         weight, same wander. Only its colour and its ring say it is the one. */
      const sc=0.72+hero.d*0.5, a=hero.rd.a0+T*hero.rd.spin;
      const ca=Math.cos(a), sa=Math.sin(a);
      const L=4.9*UU*sc, gp=1.35*UU*sc, w=(0.85*UU*sc).toFixed(2);
      h1.setAttribute("x1",(hero.px-ca*(L+gp)).toFixed(1)); h1.setAttribute("y1",(hero.py-sa*(L+gp)).toFixed(1));
      h1.setAttribute("x2",(hero.px-ca*gp).toFixed(1));     h1.setAttribute("y2",(hero.py-sa*gp).toFixed(1));
      h2.setAttribute("x1",(hero.px+ca*gp).toFixed(1));     h2.setAttribute("y1",(hero.py+sa*gp).toFixed(1));
      h2.setAttribute("x2",(hero.px+ca*(L+gp)).toFixed(1)); h2.setAttribute("y2",(hero.py+sa*(L+gp)).toFixed(1));
      h1.setAttribute("stroke-width",w); h2.setAttribute("stroke-width",w);
      const R=7.5*UU+Math.sin(T*1.6)*0.5*UU;
      ring.setAttribute("cx",hero.px.toFixed(1)); ring.setAttribute("cy",hero.py.toFixed(1));
      ring.setAttribute("r",R.toFixed(1));
      /* two leaders, off the ring's shoulders to the two ends of the opened
         fragment — a magnification frustum rather than a single pointer */
      lead.setAttribute("d",
        `M${(hero.px-R).toFixed(1)} ${hero.py.toFixed(1)}L${LX.toFixed(1)} ${LY.toFixed(1)}`+
        `M${(hero.px+R).toFixed(1)} ${hero.py.toFixed(1)}L${RX.toFixed(1)} ${RY.toFixed(1)}`);
    }
  }
  render();
  /* One frame loop drives this page. A shape must never start its own: a
     ticker inherits Pause motion and prefers-reduced-motion for free, and one
     that throws is dropped without taking the map with it. */
  TICKERS.push(dt=>{ T+=dt; render(); });
}
DRAW.reads=drawReads;

