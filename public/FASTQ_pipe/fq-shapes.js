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

/* A REFERENCE IS NOT A STATION, AND MUST NOT LOOK LIKE ONE. Same geometry, the
   other skin — SKIN.works, which this page has no other user for. The genome
   and the whitelists are chosen rather than measured and built once rather than
   per run, and the edges leaving them are already drawn still; a reference that
   wears the station skin undoes half of that at a glance. No new colour: the
   k-* face triple is one /pipeline already carries. */
const drawRef=(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works,n.hatch);

DRAW.tile=drawTile;
DRAW.ref=drawRef;
DRAW.heap=drawHeap;
DRAW.matrix=drawMatrix;


/* ============================================================
   THE READS — the two shapes this page has of its own.

   A swarming pool, and one fragment opened up. TWO NODES: E1 is the pool and
   E2 is the fragment, because the fork is at E2 and a transition that splits
   the segment into two independent problems is a node rather than an arrow.
   One drawing all the same, held together by the leaders — see the note above
   drawFragment().

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
   the map — not a flat scatter pretending.

   THE FRAGMENT IS NOT IN THE ISOMETRIC AT ALL, and it is the only thing on the
   page that is not. Everything else belongs to the world and shears with it.
   This is a diagram OF a molecule rather than a thing standing somewhere on
   the map, and a diagram read at -30 degrees is a diagram read at -30 degrees:
   it is laid out in plain screen axes, square to the reader, with nothing
   beneath it. An earlier build had it painted flat on a
   rectangular pad — correct by the map's grammar, and worse: the pad was a
   solid claiming the reads sit somewhere, and it dragged the diagram round to
   the map's own angle for no gain.

   Which is why neither shape uses roofFrame(): there is no surface to lie on
   and no shear to take. NEITHER NODE IS A SOLID, so n.h is not the height of
   any object on either — it is where the name hangs, and the box the
   silhouette and the drag handle are cut from.

   COLOUR, AND IT IS ONE TRAIL EACH. The original of this drawing had five hues.
   This map has three tokens and a rule against a fourth, so the two halves of
   the molecule take two of them and hold them the whole way:

     R1 · the cDNA   --cull    /pipeline's orange
     R2 · the barcodes  --accent

   --cull means "this is being dropped" on the other two maps, and here it does
   not, because NOTHING IN THIS SEGMENT IS A CULL — the token has no other job
   on this page and the third distinction this page does need is the fork. That
   is the trade, and it is only safe while that stays true: if anything on this
   map ever starts dropping cells, the R1 trail has to move off this token.

   The trail is unbroken and that is the point: the hero read's cDNA half in the
   pool, the cDNA block in the glyph, the R1 bracket and its name, the R1 track
   and the dots on it — all one colour, from the pool to the moment it re-merges
   with R2 at the join. The barcode half is the same story in accent. The dashed
   leaders are NOT part of either trail and are grey: they magnify, they do not
   carry.

   The one distinction the two tokens cannot carry is made by ENCODING instead:
   the UMI is the same accent as a barcode, drawn as an OUTLINE rather than a
   fill, because it is the one tag on the molecule that is not a barcode.

   THE ARROWHEADS SIT 15% IN FROM THE ENDS THEY POINT AT. On the end an arrow
   reads as a terminus — the place the read stops — and it means the opposite:
   the direction the read travels. Set back inside its own bracket it is
   unmistakably a heading.

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
  /* 620 RATHER THAN 380, because the pill is three times the volume of the
     ball it replaced and the same crowd in it reads as a thin haze. Density is
     the thing being held constant, not the count. */
  const rnd=mulberry32(READ_SEED), reads=[];
  for(let i=0;i<620;i++){
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
const R1TONE="var(--cull)", R2TONE="var(--accent)";

const FRAG=[
  {k:"cdna", w:76, tone:"r1",    lab:"cDNA"},
  {k:"gap",  w:62, tone:"ghost", lab:"never sequenced"},
  {k:"bc1",  w:13, tone:"r2",    lab:"BC1"},
  {k:"l1",   w:26, tone:"link",  lab:""},
  {k:"bc2",  w:13, tone:"r2",    lab:"BC2"},
  {k:"l2",   w:26, tone:"link",  lab:""},
  {k:"bc3",  w:13, tone:"r2",    lab:"BC3"},
  {k:"umi",  w:48, tone:"umi",   lab:"UMI"},
];

/* ---------------------------------------------------------------------------
   TWO NODES, ONE DRAWING.

   E1 is the pool and E2 is the fragment, and they are separate nodes because
   the fork is at E2: one molecule sequenced from both ends, R1 leaving for the
   genome and R2 for the whitelists. A transition that splits the segment into
   two independent problems is a node, not an arrow.

   They still read as one picture, and the leaders are what make them one — a
   magnification frustum from the ring in the pool down to the two ends of the
   opened fragment. Those are drawn by the POOL, because the pool owns the read
   the ring is around and that read moves every frame; and they are aimed at the
   FRAGMENT, wherever it currently is.

   Which is the one place on this page where a shape reads another node.
   crossGroup() below is what makes that safe.
   --------------------------------------------------------------------------- */

/* Where a point drawn in node B's group currently appears, expressed in node
   A's group.

   Both groups carry a translate the editor put there — the difference between
   where the node is now and where it was drawn — so a line drawn in A that has
   to land on B needs the difference of the two, and nothing else. Get this
   wrong and the leaders detach the moment either half is dragged, which is the
   same class of bug as the pool that dragged twice: a coordinate taken from
   the wrong frame. */
function crossGroup(A,B,p){
  const dx=(B.x-B._px)-(A.x-A._px), dy=(B.y-B._py)-(A.y-A._py);
  return [p[0]+(dx-dy)*S*C30, p[1]+(dx+dy)*S*0.5];
}

/* The node's box as a transparent silhouette: painted, so it takes pointer
   events, and invisible, so it draws nothing.

   NEITHER OF THESE TWO NODES IS A SOLID, and a node still has to be clickable
   at the projected centre of its own footprint — which is where a person aims
   and where check-clicks.mjs presses, and on both of them that point is empty
   air. It goes in FIRST, behind everything, so it can never occlude a mark.

   IT IS ALSO WHAT check-drawn.mjs MEASURES, via data-fixed. Pure geometry, no
   text, no stroke: its box is an exact transform of the node's own coordinates,
   so pushing its centre back through the camera returns that coordinate
   whatever the camera is doing. The alternatives both fail — the whole group is
   mostly a turning ball whose box changes every frame, and the diagram is
   mostly text, whose box is a font metric rather than a coordinate and lands a
   fraction differently at a different zoom.

   The hexagon is nodeSil()'s, in the same order and for the same reason. */
function hitBox(g,n){
  const hw=n.w/2, hd=n.d/2;
  g.appendChild(el("polygon",{"data-fixed":"1",fill:"transparent",stroke:"none",points:pts([
    P(n.x-hw,n.y-hd,n.h), P(n.x+hw,n.y-hd,n.h), P(n.x+hw,n.y-hd,0),
    P(n.x+hw,n.y+hd,0),   P(n.x-hw,n.y+hd,0),   P(n.x-hw,n.y+hd,n.h)])}));
}

const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

/* ============================================================
   E2 — ONE FRAGMENT, SQUARE TO THE VIEWER

   THIS IS THE ONE THING ON THE PAGE NOT DRAWN IN THE ISOMETRIC. Everything
   else belongs to the world and shears with it. This is a diagram OF a molecule
   rather than a thing standing somewhere on the map, and a diagram read at -30
   degrees is a diagram read at -30 degrees: plain screen axes, square to the
   reader, hanging just above the node's ground point so the tracks that arrive
   and leave pass under it rather than through it.

   Its geometry is a function rather than a block of locals because the pool
   needs the two ends of the bar to aim its leaders at.
   ============================================================ */
/* THE WHOLE DIAGRAM IS TURNED TO THE MAP'S OWN DIAGONAL, and that is a
   ROTATION rather than a shear.

   Drawn flat and level it was the one horizontal thing on a page where every
   other line runs at 30 degrees, and it read as pasted on. Turned -30 it lies
   along the world Y axis — the same line the step names, the band title and
   every other string on the map read at — while staying a rigid, undistorted
   drawing of a molecule. That is the difference from lying it on the ground
   plane, which is what roofFrame() would do: a roof SHEARS its contents and a
   circle on it becomes an ellipse. This does not. It is square to the reader,
   just not level with the reader.

   And it puts the molecule's own axis on the two lanes: the cDNA end now
   points down-left, which is where R1 goes, and the barcode end up-right,
   which is where R2 goes. The departures stopped needing an explanation.

   Everything below is laid out level and the group carries one rotate(), so
   the arithmetic here is still the arithmetic of a flat strip. rot() is for
   the two callers that need a FINAL screen point — the ports, and the pool's
   leaders — because those live outside the rotated group. */
const FRAG_TURN=-30;
function fragGeom(x,y){
  const p=P(x,y,0), X0=p[0], Y0=p[1];
  /* THE READS ARE BRACKETED FROM UNDERNEATH, BELOW EVEN THE BARCODE NAMES, and
     the unsequenced middle is called out from above. That is not symmetry for
     its own sake: the two tracks leave from the bracket ends, so the brackets
     have to be on the side the tracks go, and everything that leaves this glyph
     leaves downward. The one label that names an ABSENCE is the one thing that
     points back INTO the molecule, from the other side. */
  const FW=400, FX0=X0-FW/2, FX1=X0+FW/2, BH=17;
  const BT=Y0-52, BB=BT+BH, BMID=BT+BH/2;
  const NSQ=BT-16;                       /* "never sequenced", above the bar */
  const ROW1=BB+25;                      /* BC1 BC2 BC3 UMI, below it */
  const YB=ROW1+24, LBL=YB+24;           /* the two brackets, below those */
  const ROW2=ROW1, CTOP=NSQ-16;
  /* the turn is about the bar's own midpoint, so the diagram pivots where it
     sits rather than swinging off its node */
  const px=X0, py=BMID;
  const a=FRAG_TURN*Math.PI/180, c=Math.cos(a), sn=Math.sin(a);
  const rot=q=>[px+(q[0]-px)*c-(q[1]-py)*sn, py+(q[0]-px)*sn+(q[1]-py)*c];

  /* where each segment starts and how wide it is — computed here rather than in
     drawFragment because the PORTS need the two BRACKET SPANS, and a port that
     works out its own idea of the layout is a port that drifts off the drawing
     the first time a width changes. */
  const total=FRAG.reduce((t,q)=>t+q.w,0);
  const wOf=q=>(q.w/total)*FW;
  const xs=[]; let cx=FX0;
  FRAG.forEach(q=>{ xs.push(cx); cx+=wOf(q); });
  const gi=FRAG.findIndex(q=>q.k==="gap");
  /* THE MIDDLE OF EACH BRACKET, WHICH IS WHERE ITS TRACK LEAVES. At the end it
     left from under its own name and the two overlapped; from the middle the
     name has the end to itself and the line has clear air. */
  const r1Port=[(FX0+xs[gi])/2, YB];
  const r2Port=[(xs[gi]+wOf(FRAG[gi])+FX1)/2, YB];

  return {X0,Y0,FW,FX0,FX1,BH,NSQ,ROW1,ROW2,BB,BT,BMID,YB,LBL,CTOP,
          px,py,rot,total,wOf,xs,gi,r1Port,r2Port};
}

function drawFragment(g,n){
  hitBox(g,n);
  const F=fragGeom(n.x,n.y);
  /* one rotate on the group; everything inside is laid out level */
  g=g.appendChild(el("g",{transform:`rotate(${FRAG_TURN} ${F.px} ${F.py})`}));
  const {FX0,FX1,FW,BT,BB,BH,BMID,NSQ,ROW1,ROW2,YB,LBL}=F;
  const SEG=13, SUB=11, HEAD=16;

  const {wOf,xs,gi}=F;

  const text=(str,x,y,size,fill,weight)=>{
    const t=el("text",{x,y,"text-anchor":"middle","font-size":size,
      "font-family":MONO,"letter-spacing":(size*0.02).toFixed(2),fill,
      "font-weight":weight||"400"});
    t.textContent=str; g.appendChild(t); return t;
  };
  const tick=(x,y0,y1,col)=>g.appendChild(el("line",{x1:x,y1:y0,x2:x,y2:y1,
    stroke:col,"stroke-width":".8","stroke-opacity":".55"}));

  FRAG.forEach((s,i)=>{
    const x=xs[i], w=wOf(s), mid=x+w/2;
    if(s.k==="gap"){
      /* the unsequenced middle. An outline rather than a block, because there
         is nothing in it — and its name goes on the second label row, where
         its fifteen characters have the room they need. */
      g.appendChild(el("rect",{x,y:BT,width:w,height:BH,fill:"none",
        stroke:"var(--fg3)","stroke-width":"1","stroke-dasharray":"3.4 3.4"}));
      tick(mid,NSQ+5,BT,"var(--fg3)");
      text(s.lab,mid,NSQ,SUB,"var(--fg3)");
      return;
    }
    if(s.tone==="link"){
      g.appendChild(el("rect",{x,y:BT+3.4,width:w-0.9,height:BH-6.8,
        fill:"var(--fg3)","fill-opacity":".30"}));
      return;
    }
    if(s.tone==="umi"){
      /* SAME COLOUR AS A BARCODE, DIFFERENT ENCODING. The UMI is not a
         barcode — it names the molecule, not the cell — and this map does not
         get a fourth hue to say so. Outline against fill says it instead.
         Its label drops to the second row: on the first it would sit on BC3's,
         because nothing separates the two on the molecule. */
      g.appendChild(el("rect",{x,y:BT,width:w-0.9,height:BH,
        fill:R2TONE,"fill-opacity":".16",
        stroke:R2TONE,"stroke-width":"1.5"}));
      /* labelled exactly like a barcode, on the same row: at three times the
         length it has the room, and the outline is already carrying the one
         thing that distinguishes it. */
      tick(mid,BB,ROW1-12,R2TONE);
      text(s.lab,mid,ROW1,SEG,R2TONE,"600");
      return;
    }
    /* EVERY NAMED SEGMENT IS LABELLED THE SAME WAY, on the same row, on a tick.
       cDNA sat inside its own block, which is the one place a name can go that
       says "this one is different" without meaning it — the block is wide
       enough to hold the word and none of the others are, so the layout was
       being decided by the width of a bar rather than by what it names. */
    const col=s.tone==="r1"?R1TONE:R2TONE;
    g.appendChild(el("rect",{x,y:BT,width:w-0.9,height:BH,fill:col,"fill-opacity":".9"}));
    tick(mid,BB,ROW1-12,col); text(s.lab,mid,ROW1,SEG,col,"600");
  });

  /* ---- the two reads, bracketed over what each one covers ---------------
     R1 runs into the insert from the cDNA end; R2 runs inward from the far
     end, which is why its arrow points back along the molecule. The gap
     between the brackets is the part neither read reaches — and the two
     brackets are the fork: everything downstream of this node is two
     independent problems until they meet again at the deduplication.

     THE ARROWHEAD SITS 15% IN FROM THE END IT POINTS AT, not on it. On the end
     it reads as a terminus — the place the read stops — and it is the opposite:
     the direction the read travels. */
  /* The two names stand over the OUTER end of each bracket — the end its track
     leaves from — so the line emerges from under its own name. They take no
     turn of their own any more: the whole group is turned, so they arrive at
     the map's angle like every other string on it. */
  const bracket=(xa,xb,col,label,dir)=>{
    g.appendChild(el("path",{fill:"none",stroke:col,"stroke-width":"1.4","stroke-opacity":".9",
      d:`M ${xa} ${YB-6} L ${xa} ${YB} L ${xb} ${YB} L ${xb} ${YB-6}`}));
    const a=4.2, back=0.15*(xb-xa), ax=(dir>0?xb-back:xa+back);
    g.appendChild(el("polygon",{fill:col,
      points:`${ax+dir*a*1.7},${YB} ${ax},${YB-a} ${ax},${YB+a}`}));
    const at=dir>0?xa:xb;                      /* the outer end: R1 left, R2 right */
    const t=el("text",{x:0,y:0,"text-anchor":dir>0?"start":"end","font-size":HEAD,
      "font-family":MONO,"letter-spacing":"1.4",fill:col,"font-weight":"600",
      transform:`translate(${at},${LBL})`});
    t.textContent=label; g.appendChild(t);
  };
  bracket(FX0,xs[gi],R1TONE,"R1",1);
  bracket(xs[gi]+wOf(FRAG[gi]),FX1,R2TONE,"R2",-1);
}
DRAW.fragment=drawFragment;

/* NAMED POINTS ON A SHAPE, for an edge to leave from rather than the centre.
   The glyph's two ends are the fork itself — cDNA at the left, barcodes at the
   right — so an edge that leaves from one of them has already said which read
   it carries. See routeOf() in fq-view.js. Keyed by SHAPE rather than by node
   id, because a port is a property of the drawing. */
const PORTS={
  /* THE MIDDLE OF THE BRACKET THAT NAMES THE TRACK — see fragGeom. */
  fragment:(n,which)=>{ const F=fragGeom(n.x,n.y);
    return F.rot(which==="L" ? F.r1Port : F.r2Port); },

  /* A ROOF LEAVES FROM ITS NEAREST CORNER, NOT FROM ITS MIDDLE.

     These two are the largest footprints on the map, and an edge drawn from the
     centre of one spends its whole length inside the object's own occlusion
     silhouette: GRCz11's line to the index was 136 pixels long and every one of
     them was underneath GRCz11. The track was there, the dot was travelling it,
     and the node read as unconnected.

     The corner is chosen by which one is nearest the far end, so the line
     leaves on the side it is going — no per-edge bookkeeping, and it stays
     right if either object is dragged or resized. */
  karyotype :(n,which,B)=>roofCorner(n,B),
  locus     :(n,which,B)=>roofCorner(n,B),
  whitelists:(n,which,B)=>roofCorner(n,B),
  /* THE YARD'S OWN ENDS, AT DECK HEIGHT — not a roof corner, because it has no
     roof. "head" is where the eight lanes start, which is what an arriving read
     should be aimed at; "tail" is where the fan leaves. Anything else falls back
     to the corner, which is the right answer for W1 overhead. */
  sortingyard:(n,which,B)=>{
    const M=yardMetrics(n);
    /* "head" IS ON THE LANE, JUST INSIDE THE YARD AND SHORT OF THE FIRST ARCH.

       Not the far end of the run-in and not the footprint edge, for one reason
       that is pure projection: at this y, everything within about a unit of the
       yard's left edge lies along -30 degrees from the R2 bracket — which is
       the angle the bracket itself is drawn at. Aimed there the track leaves
       the port and lies down exactly on top of the bracket, invisible. A point
       a little further along the lane puts the line near horizontal, so it
       reads as a track running forward into the yard, which is what it is. */
    if(which==="head") return P(M.x0+(M.A.TRK-M.A.x0)*M.K, M.cy, M.base);
    if(which==="tail") return P(M.x1, M.cy, M.base);
    return roofCorner(n,B);
  },
};
function roofCorner(n,B){
  const hw=n.w/2, hd=n.d/2;
  let best=null, bd=Infinity;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
    const x=n.x+sx*hw, y=n.y+sy*hd;
    const d=(x-B.x)*(x-B.x)+(y-B.y)*(y-B.y);
    if(d<bd){ bd=d; best=[x,y]; }
  });
  return P(best[0],best[1],topOf(n));
}

/* ============================================================
   E1 — THE POOL

   Screen-space, so a read stays a straight line of even weight however the
   ball turns.

   ONE ORIGIN, TAKEN ONCE, AND EVERYTHING IS AN OFFSET FROM IT. An earlier
   version placed the reads by projecting n.x + offset every frame — so a drag
   moved the pool TWICE, once through the group's own translate and again
   through the recomputed projection. Nothing below reads n.x or n.y after the
   line that takes the origin; the group translate is then the only thing that
   moves it.

   A SPHERE PROJECTS TO AN ELLIPSE, and the affine map is the page's own: the
   image of a vector (a,b,c) is ((a-b)*S*C30, (a+b)*S/2 - c*S*CZ), so the
   semi-axes of the silhouette are RB*hypot(S*C30,S*C30) across and
   RB*hypot(S/2,S/2,S*CZ) down. The second is what clearance is measured
   against — not the radius, which is smaller.
   ============================================================ */
function drawPool(g,n){
  hitBox(g,n);
  const [X0,Y0]=P(n.x,n.y,0);
  /* A PILL, NOT A BALL — and the stretch happens AFTER the turn, not before.

     The reads are still sampled uniformly through a unit sphere and still
     turned by a real rotation, so the swarm churns exactly as it did. What
     changed is the last step: the turned y is multiplied out before it is
     projected. Stretch the SOURCE points instead and the pill tumbles end over
     end, which is a different object entirely — a rotating capsule rather than
     a still one with a crowd moving inside it.

     The long axis is world y, which projects to -30 degrees: the same line the
     name FASTQ POOL reads on, and the same line the fragment below it lies
     along. n.d / n.w is the ratio, so the shape is authored in the data file
     and the drawing just obeys it. */
  const RB=n.w*0.70;                      /* the short semi-axis, world units */
  const RBY=RB*(n.d/n.w);                 /* the long one, along y */
  const ZC=n.ballZ;                       /* it hovers; nothing here sits */
  const BX=X0, BY=Y0-ZC*S*CZ;             /* the pill's centre, on screen */
  const UU=RB*S*C30/32;                   /* the original's unit: R was 32 of them */

  const NB=4, pools=[];
  for(let b=0;b<NB;b++){
    const d=(b+0.5)/NB;
    pools.push({node:g.appendChild(el("path",{fill:"none",stroke:"var(--fg3)",
        "stroke-linecap":"butt",
        "stroke-width":(0.85*UU*(0.72+d*0.5)).toFixed(2),
        "stroke-opacity":(0.14+d*0.46).toFixed(3)})),
      sc:0.72+d*0.5, d:""});
  }
  /* the leaders first, so they run UNDER the ring and the hero rather than
     across them */
  /* THE HERO IS MARKED, NOT LIT.

     There was a candle here for a build: a depth-sorted halo, moths crossing in
     front of the light. It worked and it is gone — a light source is a claim
     about a physical scene, and this is a diagram of a file. What is left is
     what the original drawing said: the hero is GEOMETRICALLY IDENTICAL to
     every other read, same length, same weight, same wander, and only its
     colour and its ring say it is the one.

     So the ring does the work and it does it harder than it did: brighter,
     heavier, and with a second faint ring outside it, which reads as a mark on
     a drawing rather than as a glow. The rest of the pool is a shade dimmer to
     let the two coloured halves carry.

     The hero is drawn LAST and stays on top. It is the subject and the two
     leaders point at it; a subject you can lose behind the crowd is a subject
     the reader has to hunt for. */
  const ring=g.appendChild(el("circle",{fill:"none",stroke:"var(--fg)",
    "stroke-opacity":".28","stroke-width":"0.8"}));      /* the outer companion */
  const ring2=g.appendChild(el("circle",{fill:"none",stroke:"var(--fg)",
    "stroke-opacity":".85","stroke-width":"1.5"}));
  const h1=g.appendChild(el("line",{stroke:R1TONE,"stroke-linecap":"butt"}));
  const h2=g.appendChild(el("line",{stroke:R2TONE,"stroke-linecap":"butt"}));

  /* THE LEADERS ARE GREY, AND THEY ARE NOT A TRACK. They say "this fragment is
     that read, magnified" — a magnification frustum, one leg to each end of the
     glyph. Nothing travels them and nothing is routed along them, so they take
     neither of the two read colours: those belong to the tracks, which start at
     the glyph. Colouring these made the pool look like the head of two
     pipelines, and it is the head of neither. */
  const mkLead=()=>g.appendChild(el("path",{fill:"none",stroke:"var(--fg)",
    "stroke-opacity":".45","stroke-width":"1.7","stroke-dasharray":"6 4.5",
    "pointer-events":"none"}));
  const lead1=mkLead(), lead2=mkLead();

  /* the fragment this pool is magnified into — the one cross-node reference on
     the page, and it is resolved every frame rather than captured, so the
     leaders follow whichever half is dragged */
  const FRAGNODE=(typeof NODES!=="undefined") && NODES.find(m=>m.id===n.aims);

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
         which is the same key everything else on the page is sorted by. It is
         taken AFTER the stretch, because the world is what the pill lives in —
         measured on the unit sphere it would sort the crowd by where each read
         WOULD have been. */
      const a=x1*RB, b=y2*RBY, c=z2*RB;
      const dep=Math.max(0,Math.min(1,((a+b)/(RB+RBY)+1)/2));
      seen.push({i,rd,d:dep,
        px:BX+(a-b)*S*C30, py:BY+(a+b)*S*0.5-c*S*CZ});
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
      pools[b].d+="M"+(s.px-ca*(L+gp)).toFixed(1)+" "+(s.py-sa*(L+gp)).toFixed(1)+
                  "L"+(s.px-ca*gp).toFixed(1)+" "+(s.py-sa*gp).toFixed(1)+
                  "M"+(s.px+ca*gp).toFixed(1)+" "+(s.py+sa*gp).toFixed(1)+
                  "L"+(s.px+ca*(L+gp)).toFixed(1)+" "+(s.py+sa*(L+gp)).toFixed(1);
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
      const R=8.2*UU+Math.sin(T*1.6)*0.5*UU;
      for(const [e,k] of [[ring2,1],[ring,1.42]]){
        e.setAttribute("cx",hero.px.toFixed(1)); e.setAttribute("cy",hero.py.toFixed(1));
        e.setAttribute("r",(R*k).toFixed(1));
      }
      /* two leaders, off the ring's shoulders to the two ends of the opened
         fragment — a magnification frustum rather than a single pointer */
      if(FRAGNODE){
        const F=fragGeom(FRAGNODE._px,FRAGNODE._py);
        const a1=crossGroup(n,FRAGNODE,F.rot([F.FX0,F.BMID]));
        const a2=crossGroup(n,FRAGNODE,F.rot([F.FX1,F.BMID]));
        lead1.setAttribute("d",
          `M${(hero.px-R).toFixed(1)} ${hero.py.toFixed(1)}L${a1[0].toFixed(1)} ${a1[1].toFixed(1)}`);
        lead2.setAttribute("d",
          `M${(hero.px+R).toFixed(1)} ${hero.py.toFixed(1)}L${a2[0].toFixed(1)} ${a2[1].toFixed(1)}`);
      }
    }
  }
  render();
  /* One frame loop drives this page. A shape must never start its own: a
     ticker inherits Pause motion and prefers-reduced-motion for free, and one
     that throws is dropped without taking the map with it. */
  TICKERS.push(dt=>{ T+=dt; render(); });
}
DRAW.pool=drawPool;


/* ============================================================
   THE TWO REFERENCE FIGURES — GRCz11 and Ensembl 99.

   The genome lane is two files and two decisions. These are what those files
   actually contain: the assembly says which bases are where, the annotation
   says which stretches are a gene, which parts survive splicing, which get
   translated, and which way it is read.

   THEY ARE BUILDINGS WITH THEIR CONTENT PAINTED ON THE ROOF, which is
   /bioinformatics_pipe's own idiom and the reason roofFrame was lifted into
   fq-iso.js in the first place. An earlier build had them as flat cards turned
   to the map's diagonal, like the fragment. That was wrong for these two and
   right for that one, and the difference is worth stating: the fragment is a
   diagram OF a molecule, which is nowhere; an index is a FILE THAT SITS
   SOMEWHERE and feeds the aligner, and the map already has a way of drawing a
   thing that sits somewhere and feeds something. A short flat prism feeding
   another prism reads as a pipeline. A card floating beside one does not.

   THE ROOF IS NOT SQUARE, and roofPanel() is why. Twenty-five ideograms in a
   row and a gene model laid end to end both want a roof much longer than it is
   deep; the aspect comes from n.w and n.d and the drawing reflows to it.

   TEXT ON THE ROOF FOLLOWS THE ROOF. At turn 0 an unrotated string advances at
   -30 degrees, the angle every other name on this map reads at, so nothing in
   here is rotated by hand. Single lines only — a block of text on a roof fans,
   because chart x and chart y are the two roof diagonals.

   NO COLOUR OF THEIR OWN. Chromosome bodies take the reference skin's own face
   (--k-top) and the bands are punched out in --bg. The window and its frustum
   are grey — the same grey the pool's leaders use, and for the same reason: a
   magnification is not a track. Coding sequence and UTR are one token at two
   weights, which is the UMI's trick again. The fork owns orange and blue and
   nothing here borrows them.

   HONEST NOTE ON THE BANDS, carried over from the original. The chromosome
   LENGTHS are the real GRCz11 primary assembly in Mb. The banding and the
   centromere positions are NOT — zebrafish has no standard cytoband table of
   the kind that exists for human, so both are generated from a seed. They are
   there to make the shapes read as chromosomes, not to be counted. If a real
   band table ever lands, replace CHR_LAYOUT and LOCUS_BANDS and nothing else
   changes.
   ============================================================ */

/* the low prism the chart is painted on: the reference skin, then its own top
   face again, inset and darker, so the drawing has something to be legible
   against. Same trick building() uses on the culls page. */
function refBuilding(g,n){
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);
  /* THE ROOF IS THE BACKGROUND TOKEN, not the tile's own face. --t-top sits
     only a shade under the chromosome bodies drawn on it, and the drawing read
     as a texture rather than as a figure. --bg is the darkest thing the page
     has, and the bands punched out of the chromosomes are drawn in it too — so
     a band is the roof showing through, which is what a band is. */
  g.appendChild(el("polygon",{points:faces(n.x,n.y,n.w*0.965,n.d*0.985,n.h).top,
    fill:"var(--bg)","fill-opacity":".93",stroke:"var(--stroke)",
    "stroke-width":".8","stroke-opacity":".5"}));
}

/* the word the roof is about, large, in its own clear space */
function roofTitle(F,str,x,y,size){
  const t=el("text",{x,y,"text-anchor":"start","font-size":size,
    "font-family":MONO,"font-weight":"700","letter-spacing":(size*0.03).toFixed(2),
    fill:"var(--fg)","fill-opacity":".92"});
  t.textContent=str; F.g.appendChild(t); return t;
}

/* an ideogram arm: rounded at the telomere, square at the centromere */
const armPath=(x,y,w,h,rt,rb)=>
  `M${x} ${y+rt}A${rt} ${rt} 0 0 1 ${x+rt} ${y}H${x+w-rt}A${rt} ${rt} 0 0 1 ${x+w} ${y+rt}`+
  `V${y+h-rb}A${rb} ${rb} 0 0 1 ${x+w-rb} ${y+h}H${x+rb}A${rb} ${rb} 0 0 1 ${x} ${y+h-rb}Z`;

/* ---- GRCz11: 25 chromosomes as ideograms, ordered by length --------------- */
const CHR=[59.58,59.64,62.63,78.09,72.50,60.27,74.08,54.99,56.99,45.30,
           45.31,49.19,51.75,51.99,47.79,55.02,53.36,51.14,48.29,55.35,
           45.61,39.30,46.30,42.36,37.50];

const CHR_LAYOUT=(()=>{
  const rnd=mulberry32(0x5eedf15);
  return CHR.map(mb=>{
    const cen=0.34+rnd()*0.16;                 /* metacentric to submetacentric */
    const arm=frac=>{
      const out=[]; const n=3+Math.floor(rnd()*4); let acc=0;
      for(let i=0;i<n;i++){
        const gapw=0.06+rnd()*0.10, bandw=0.05+rnd()*0.12;
        acc+=gapw;
        if(acc+bandw>0.94) break;
        out.push([acc,bandw]); acc+=bandw;
      }
      return out.map(([a,b])=>[a*frac,b*frac]);
    };
    return {mb,cen,p:arm(cen),q:arm(1-cen).map(([a,b])=>[a+cen,b])};
  }).sort((a,b)=>b.mb-a.mb);
})();

function drawKaryotype(g,n){
  refBuilding(g,n);
  const F=roofPanel(g,n,n.h,176), {CW,CH,u}=F;
  const margin=5*u, slot=(CW-margin*2)/CHR_LAYOUT.length;
  const bw=Math.min(4.6*u, slot*0.60);
  const top=34*u, maxH=56*u, maxMb=Math.max(...CHR), waist=1.0*u;

  roofTitle(F,"GRCz11",margin,22*u,17*u);

  /* ---- AND A DOUBLE HELIX TURNING BESIDE THE WORD -----------------------
     So that a glance says DNA before the caption does. It lies along the same
     line the title reads on — local +x, which is -30 degrees on screen — so it
     belongs to the word rather than sitting next to it.

     TWO STRANDS AND A LADDER, and the ladder is what turns. The strands are
     two sines half a period apart, redrawn each frame at a moving phase; the
     rungs between them shorten as the pair comes edge-on and lengthen again,
     which is the whole of the illusion. Their WEIGHT AND OPACITY follow the
     same cosine, so the near side of the turn is heavier than the far side —
     depth without a second projection. */
  /* SMALL AND QUIET. It was long enough and bright enough to compete with the
     twenty-five ideograms that are the actual figure — a mark that says "DNA"
     only has to be read once, and it is beside a word that already says it. */
  const HX0=margin+65*u, HL=32*u, HYC=15.8*u, HA=3.6*u, HK=Math.PI*2/(HL/2.2);
  const sA=F.g.appendChild(el("polyline",{fill:"none",stroke:"var(--fg3)",
    "stroke-opacity":".5","stroke-width":(0.9*u).toFixed(2),"stroke-linecap":"round"}));
  const sB=F.g.appendChild(el("polyline",{fill:"none",stroke:"var(--fg3)",
    "stroke-opacity":".5","stroke-width":(0.9*u).toFixed(2),"stroke-linecap":"round"}));
  const RUNGS=[];
  for(let i=0;i<9;i++)
    RUNGS.push(F.g.appendChild(el("line",{stroke:"var(--fg3)","stroke-linecap":"round"})));
  let hp=0;
  const spin=()=>{
    const N=64, a=[], b=[];
    for(let i=0;i<=N;i++){
      const x=HX0+HL*i/N, th=HK*(x-HX0)+hp;
      a.push([x.toFixed(1),(HYC+HA*Math.sin(th)).toFixed(1)].join(","));
      b.push([x.toFixed(1),(HYC-HA*Math.sin(th)).toFixed(1)].join(","));
    }
    sA.setAttribute("points",a.join(" ")); sB.setAttribute("points",b.join(" "));
    RUNGS.forEach((r,i)=>{
      const x=HX0+HL*(i+0.5)/RUNGS.length, th=HK*(x-HX0)+hp;
      const y1=HYC+HA*Math.sin(th), y2=HYC-HA*Math.sin(th);
      const near=(Math.cos(th)+1)/2;          /* 1 nearest the eye, 0 furthest */
      r.setAttribute("x1",x.toFixed(1)); r.setAttribute("y1",y1.toFixed(1));
      r.setAttribute("x2",x.toFixed(1)); r.setAttribute("y2",y2.toFixed(1));
      r.setAttribute("stroke-width",((0.4+near*0.55)*u).toFixed(2));
      r.setAttribute("stroke-opacity",(0.09+near*0.26).toFixed(3));
    });
  };
  spin();
  TICKERS.push(dt=>{ hp-=dt*1.7; spin(); });

  CHR_LAYOUT.forEach((ch,i)=>{
    const cx=margin+slot*(i+0.5), h=(ch.mb/maxMb)*maxH;
    const yc=top+h*ch.cen, x=cx-bw/2;
    const r=bw/2, sq=bw*0.16;

    [[top, yc-waist/2, r, sq, ch.p],
     [yc+waist/2, top+h, sq, r, ch.q]].forEach(([y0,y1,rt,rb,bands])=>{
      const d=armPath(x,y0,bw,y1-y0,rt,rb);
      F.g.appendChild(el("path",{d,fill:"var(--k-top)","fill-opacity":".95"}));
      bands.forEach(([a,b])=>{
        const by=Math.max(top+a*h,y0), bh=Math.min(top+(a+b)*h,y1)-by;
        if(bh>0) F.g.appendChild(el("rect",{x,y:by,width:bw,height:bh,
          fill:"var(--bg)","fill-opacity":".85"}));
      });
      F.g.appendChild(el("path",{d,fill:"none",stroke:"var(--stroke)",
        "stroke-opacity":".7","stroke-width":(0.5*u).toFixed(2)}));
    });

    /* the constriction, marked on both flanks */
    F.g.appendChild(el("path",{fill:"none",stroke:"var(--fg3)",
      "stroke-width":(0.5*u).toFixed(2),
      d:`M${x-0.6*u} ${yc}H${x+bw*0.22}M${x+bw*0.78} ${yc}H${x+bw+0.6*u}`}));
  });
}
DRAW.karyotype=drawKaryotype;

/* ---- Ensembl 99: one chromosome, one window, one locus -------------------
   Structure is real in kind; the coordinates are not.

   THE MODEL IS A 3'-BIASED GENE, WHICH IS THE ONLY KIND THIS PAGE IS ABOUT.
   Transcription runs 5' to 3': the 5' UTR is the front of the first exon, the
   coding sequence runs from there through the internal exons, and the 3' UTR is
   the tail of the LAST one — and in a real gene it is most of that exon, which
   is why it gets its own block and its own name here rather than a note off the
   end. Every assay on this map primes with oligo-dT, so the reads land in that
   block. It is also the one whose zebrafish annotation is incomplete in both
   Ensembl and RefSeq, which is the 3' UTR problem the reference nodes keep
   naming and the reason a 46% transcriptome mapping rate is not a failure. */
const LOCUS_BANDS=(()=>{
  const rnd=mulberry32(0x5eedf15^0x99), out=[]; let acc=0.03;
  while(acc<0.94){
    const gap=0.03+rnd()*0.06, w=0.025+rnd()*0.07;
    acc+=gap; if(acc+w>0.94) break;
    out.push([acc,w]); acc+=w;
  }
  return out;
})();

/* BOTH UNTRANSLATED ENDS ARE LONGER THAN THEY WERE, and pushed outward: the 5'
   further left, the 3' further right. They were short enough to read as trim on
   the first and last exon rather than as regions of their own, and on this map
   they are the regions that matter — the 3' UTR is where every read lands and
   the one whose zebrafish annotation is incomplete. Each still leaves a visible
   run of coding sequence in its own exon, which is what says it is a PART of
   that exon and not a separate block.

   THE 5' UTR IS LONG ENOUGH TO BE ITS OWN GROUND. It was a stub at the front of
   the first exon, close enough to that exon's coding block that its name and
   the exon's name had to share the same stretch of roof. Given a real run of
   its own — a low block with clear space to its left before anything else
   starts — both names have somewhere to be. The model runs nearly the full
   width of the roof now to pay for it; where a schematic sits is not a claim,
   so that costs nothing. */
const GENE={inset:[0.07,0.95],
  exons:[[0,0.165],[0.235,0.295],[0.355,0.415],[0.475,0.535],[0.595,0.655],[0.745,1.0]],
  utr5:[0,0.115],          /* the front of exon 1, and a long one */
  utr3:[0.80,1.0]};        /* the tail of exon 6, and most of it */

function drawLocus(g,n){
  refBuilding(g,n);
  const F=roofPanel(g,n,n.h,176), {CW,CH,u}=F;
  const G=F.g, LAB=4.3*u;

  roofTitle(F,"Ensembl 99",5*u,15*u,13*u);

  /* ---- the chromosome, laid on its side ---- */
  const kx0=18*u, kx1=CW-18*u, ky=24*u, kh=5.0*u, kw=kx1-kx0, cen=0.38, waist=1.0*u;
  const cxCen=kx0+kw*cen, r=kh/2, sq=kh*0.16;
  [[kx0,cxCen-waist/2,r,sq],[cxCen+waist/2,kx1,sq,r]].forEach(([a,b,rl,rr])=>{
    const d=`M${a} ${ky+rl}A${rl} ${rl} 0 0 1 ${a+rl} ${ky}H${b-rr}`+
            `A${rr} ${rr} 0 0 1 ${b} ${ky+rr}V${ky+kh-rr}`+
            `A${rr} ${rr} 0 0 1 ${b-rr} ${ky+kh}H${a+rl}`+
            `A${rl} ${rl} 0 0 1 ${a} ${ky+kh-rl}Z`;
    G.appendChild(el("path",{d,fill:"var(--k-top)","fill-opacity":".95"}));
    LOCUS_BANDS.forEach(([p,wd])=>{
      const s0=Math.max(kx0+p*kw,a), s1=Math.min(kx0+(p+wd)*kw,b);
      if(s1>s0) G.appendChild(el("rect",{x:s0,y:ky,width:s1-s0,height:kh,
        fill:"var(--bg)","fill-opacity":".85"}));
    });
    G.appendChild(el("path",{d,fill:"none",stroke:"var(--stroke)",
      "stroke-opacity":".7","stroke-width":(0.5*u).toFixed(2)}));
  });
  G.appendChild(el("path",{fill:"none",stroke:"var(--fg3)","stroke-width":(0.5*u).toFixed(2),
    d:`M${cxCen} ${ky-0.7*u}V${ky+kh*0.22}M${cxCen} ${ky+kh*0.78}V${ky+kh+0.7*u}`}));

  /* ---- the window, and the frustum down onto the locus ---- */
  const wx0=kx0+kw*0.470, wx1=kx0+kw*0.530;
  G.appendChild(el("rect",{x:wx0,y:ky-1.8*u,width:wx1-wx0,height:kh+3.6*u,
    fill:"none",stroke:"var(--fg)","stroke-opacity":".6","stroke-width":(0.9*u).toFixed(2)}));

  const lx0=6*u, lx1=CW-6*u, lw=lx1-lx0;
  const [gi0,gi1]=GENE.inset;
  const X=f=>lx0+(gi0+(gi1-gi0)*f)*lw;
  const gx0=X(0), gx1=X(1);
  const y=64*u, CDSH=8.0*u, UTRH=4.4*u, lTop=46*u;

  G.appendChild(el("path",{fill:"none",stroke:"var(--fg)","stroke-opacity":".38",
    "stroke-width":(0.6*u).toFixed(2),"stroke-dasharray":`${(2.4*u).toFixed(1)} ${(2.6*u).toFixed(1)}`,
    d:`M${wx0} ${ky+kh+1.8*u}L${gx0} ${lTop}M${wx1} ${ky+kh+1.8*u}L${gx1} ${lTop}`}));

  /* ---- the model: a line, chevrons for the introns, blocks for the exons ---- */
  G.appendChild(el("line",{x1:gx0,y1:y,x2:gx1,y2:y,stroke:"var(--fg3)",
    "stroke-width":(0.8*u).toFixed(2)}));
  const inExon=f=>GENE.exons.some(([a,b])=>f>a&&f<b);
  let chev="";
  for(let f=0.006;f<1;f+=0.022){
    if(inExon(f)) continue;
    const x=X(f), a=1.6*u;
    chev+=`M${(x-a*0.6).toFixed(1)} ${(y-a).toFixed(1)}L${(x+a*0.6).toFixed(1)} ${y.toFixed(1)}`+
          `L${(x-a*0.6).toFixed(1)} ${(y+a).toFixed(1)}`;
  }
  G.appendChild(el("path",{d:chev,fill:"none",stroke:"var(--fg3)",
    "stroke-width":(0.55*u).toFixed(2)}));

  /* CODING AND UNTRANSLATED ARE ONE TOKEN AT TWO WEIGHTS, which is the UMI's
     trick: a distinction the palette has no colour left for, made by fill. */
  GENE.exons.forEach(([a,b])=>{
    const parts=[];
    const push=(rg,h,op)=>{ const s0=Math.max(a,rg[0]), s1=Math.min(b,rg[1]);
      if(s1>s0) parts.push([s0,s1,h,op]); };
    push(GENE.utr5,UTRH,".42"); push(GENE.utr3,UTRH,".42");
    const cs=GENE.utr5[1]>a&&GENE.utr5[1]<b?GENE.utr5[1]:a;
    const ce=GENE.utr3[0]>a&&GENE.utr3[0]<b?GENE.utr3[0]:b;
    if(ce>cs) parts.push([cs,ce,CDSH,".95"]);
    parts.forEach(([s0,s1,h,op])=>{
      G.appendChild(el("rect",{x:X(s0),y:y-h/2,width:X(s1)-X(s0),height:h,
        fill:"var(--keep)","fill-opacity":op,
        stroke:"var(--t-top)","stroke-width":(0.4*u).toFixed(2)}));
    });
  });

  /* ---- EVERY EXON AND EVERY INTRON IS NAMED, on two rows so the two sets
     never have to share a line, and the UTRs get a third of their own. Six
     exons above and five introns below is eleven labels on a roof; they fit
     because they alternate, and because a name only ever has its own row's
     neighbours to clear. */
  const lab=(str,x,ty,anchor)=>{
    const t=el("text",{x,y:ty,"text-anchor":anchor||"middle","font-size":LAB,
      "font-family":MONO,fill:"var(--fg3)"});
    t.textContent=str; G.appendChild(t); return t;
  };
  const tick=(x,y0,y1)=>G.appendChild(el("line",{x1:x,y1:y0,x2:x,y2:y1,
    stroke:"var(--fg3)","stroke-width":(0.5*u).toFixed(2),"stroke-opacity":".7"}));

  /* EVERY NAME IS BELOW THE MODEL AND EVERY NAME IS ANGLED, and the two go
     together. Exons above and introns below kept them apart by putting them on
     opposite sides, which spends the whole drawing on the labelling; below the
     line they interleave, and eleven horizontal words on one row would collide.
     Turned, each trails off down-left from its own tick and its neighbours run
     parallel to it — the standard trick for a crowded categorical axis, and it
     works here for the same reason it works there. Anchored `end` so the word
     finishes at its tick rather than starting there.

     ABOVE THE LINE IS LEFT EMPTY FOR THE ARCHES. */
  const angled=(str,x,ty)=>{
    const t=el("text",{x:0,y:0,"text-anchor":"end","font-size":LAB,
      "font-family":MONO,fill:"var(--fg3)",
      transform:`translate(${x},${ty}) rotate(-38)`});
    t.textContent=str; G.appendChild(t); return t;
  };
  const ROW=y+CDSH/2+5.4*u;
  /* THE LAST EXON IS NOT LABELLED "exon", and that is a correction rather than
     an omission. A label sits at the centre of what it names, and the centre of
     that exon is inside the 3' UTR — so the word pointed at the untranslated
     tail and said the wrong thing about it. What the block needs saying is
     already said, on the row below, by "3' UTR". Every other exon is a coding
     block and keeps its name. */
  GENE.exons.slice(0,-1).forEach(([a,b])=>{
    const x=(X(a)+X(b))/2;
    tick(x, y+CDSH/2+1.0*u, ROW-1.4*u);
    angled("exon", x+1.2*u, ROW+1.4*u);
  });
  for(let i=0;i<GENE.exons.length-1;i++){
    const x=(X(GENE.exons[i][1])+X(GENE.exons[i+1][0]))/2;
    tick(x, y+1.0*u, ROW-1.4*u);
    angled("intron", x+1.2*u, ROW+1.4*u);
  }

  /* ---- TWO SPLICED READS, ARCHING THE INTRONS THEY CROSS -----------------
     The same object the belts at E4 draw, in the same orange, on the node that
     explains why it exists: a read from spliced mRNA covers the end of one exon
     and the start of the next, so it lands in two halves with nothing over the
     intron between them. Drawn here it says what the annotation is FOR — the
     assembly alone cannot place these, and this is the file that can.

     Above the line, because that is the side the labels left empty. */
  const arch=(i)=>{
    const ja=X(GENE.exons[i][1]), jb=X(GENE.exons[i+1][0]);
    const top=y-CDSH/2, HALF=(jb-ja)*0.55, lift=6.2*u+(jb-ja)*0.09;
    G.appendChild(el("line",{x1:ja-HALF,y1:top-1.6*u,x2:ja,y2:top-1.6*u,
      stroke:R1TONE,"stroke-width":(1.5*u).toFixed(2),"stroke-linecap":"butt"}));
    G.appendChild(el("line",{x1:jb,y1:top-1.6*u,x2:jb+HALF,y2:top-1.6*u,
      stroke:R1TONE,"stroke-width":(1.5*u).toFixed(2),"stroke-linecap":"butt"}));
    const path=[];
    for(let k=0;k<=22;k++){
      const f=k/22;
      path.push(`${(ja+(jb-ja)*f).toFixed(1)},${(top-1.6*u-Math.sin(Math.PI*f)*lift).toFixed(1)}`);
    }
    G.appendChild(el("polyline",{points:path.join(" "),fill:"none",stroke:R1TONE,
      "stroke-width":(0.9*u).toFixed(2),"stroke-linecap":"round","stroke-opacity":".9"}));
  };
  arch(0); arch(3);

  /* THE UTRs GET THEIR OWN ROW AND THEIR OWN TICK, pointing at the block they
     name. The 3' UTR is most of the last exon and it is where every read on
     this map lands, so it is a section of the drawing rather than a note off
     the end. */
  /* EACH UTR NAME SITS AT ITS OWN OUTER END rather than at the block's centre —
     the 5' one pulled left, the 3' one pushed right. At the centre the 5' label
     sat directly under the first angled "exon", which trails down-left from its
     tick and lands exactly there. The tick still rises to the block, so the
     name is still ON its section and not off beside the model. */
  [[GENE.utr5,"5′ UTR",0,-1],[GENE.utr3,"3′ UTR",1,1]].forEach(([rg,str,end,dir])=>{
    const xt=X(rg[end]);
    tick(xt, y+UTRH/2+1.2*u, y+CDSH/2+17.6*u);
    lab(str, xt+dir*9.0*u, y+CDSH/2+22.4*u);
  });
}
DRAW.locus=drawLocus;


/* ============================================================
   E4 · ALIGN R1 — CONVEYOR BELTS

   THE INDEX IS NOT A STEP READS PASS THROUGH, IT IS A SURFACE THEY LAND ON,
   and that is the whole reason this station is drawn rather than labelled.
   Four narrow belts run in parallel along the lane's own direction. Genes ride
   ON the belts — annotated models that enter at one end, cross, and leave at
   the other, exons standing proud with introns flat between them. Reads fly in
   from off-map, chase a moving target, drop onto it, and then RIDE ALONG with
   the gene until it goes.

   EVERYTHING SHARES ONE VELOCITY: slats, genes and landed reads. That is what
   makes it a machine rather than three animations in a trench coat.

   THE AGGREGATE IS THE ARGUMENT. Every read lands on an exon and none on an
   intron. One worked example reads as a fact about that read; three hundred of
   them reads as a fact about the ANNOTATION — which is the half of the index
   the FASTA cannot supply, and the thing G1 and G2 are two separate nodes to
   say.

   And a few cannot land in one piece. They came from spliced mRNA and cover the
   end of one exon and the start of the next, so they arrive as two halves with
   an arc between them that never touches down over the intron. Those are the
   reads the sequence alone could not place.

   COLOUR: THE READS ARE R1's OWN. They are --cull, the same orange the track
   into this station carries and the same the cDNA block wears in the fragment,
   so the trail does not break at the moment it lands. The SPLICED reads are
   that colour too — a distinction the palette has no token left for, made by
   ENCODING instead: two halves and an arc is unmistakable, and a fourth hue
   would say "a different kind of read" when it is the same read.

   EVERY ABSOLUTE LENGTH IS SCALED BY THE NODE. The original was authored
   against a fixed 9.2-unit span; K and KZ carry that onto whatever w and h the
   editor leaves behind, so this shape survives being resized like every other.
   ============================================================ */
/* A BOX CARRIED BY THE BELT — ALL THREE FACES THIS PROJECTION CAN SEE, rebuilt
   per frame.

   It was two, top and the long near side, on the reasoning that nothing on a
   belt is seen from its far side. True of the far side and not of the LEADING
   END, which is square to the eye and was simply missing: every exon read as an
   open trough with its front wall knocked out. The eye is at +x +y, so top,
   the +y flank and the +x end are the three that face it — which is exactly
   what paint() draws for a static box, done here per frame instead. */
function boxNodes(g,fill,side,sw){
  return {
    top :g.appendChild(el("polygon",{fill,stroke:"var(--stroke)","stroke-width":sw,"stroke-opacity":".75"})),
    near:g.appendChild(el("polygon",{fill:side,stroke:"var(--stroke)","stroke-width":sw,"stroke-opacity":".55"})),
    end :g.appendChild(el("polygon",{fill:side,stroke:"var(--stroke)","stroke-width":sw,"stroke-opacity":".55"})),
  };
}
function setBox(nd,x0,x1,y,d,z0,z1,op){
  const yb=y-d/2, yf=y+d/2;
  nd.top.setAttribute("points",pts([P(x0,yb,z1),P(x1,yb,z1),P(x1,yf,z1),P(x0,yf,z1)]));
  nd.near.setAttribute("points",pts([P(x0,yf,z1),P(x1,yf,z1),P(x1,yf,z0),P(x0,yf,z0)]));
  nd.end.setAttribute("points",pts([P(x1,yb,z1),P(x1,yf,z1),P(x1,yf,z0),P(x1,yb,z0)]));
  ["top","near","end"].forEach(k=>{
    nd[k].setAttribute("fill-opacity",op);
    nd[k].setAttribute("stroke-opacity",((k==="top"?0.42:0.28)*op).toFixed(3));
  });
}
const easeOut=x=>1-Math.pow(1-x,2.2);
const clamp01=x=>(x<0?0:x>1?1:x);

function drawBelts(g,n){
  hitBox(g,n);
  const rnd=mulberry32(0x5eedf15^0x53);
  const NB=n.belts||4;
  const x0=n.x-n.w/2, x1=n.x+n.w/2, span=x1-x0;
  const pitch=n.d/NB, y0=n.y-n.d/2+pitch/2;
  const BW=pitch*0.52;
  const base=n.h*0.245, geneH=n.h*0.19, exonH=n.h*0.565;
  const K=span/9.2, KZ=n.h/0.53;              /* the original's own units */
  const v=(n.v||1.05)*K;
  const GPB=4;                                 /* tiled end to end, no gaps */
  const PAD=7*K;                               /* enough to enter and leave off-map */
  const LOOP=span+PAD*2;

  const belts=[];
  for(let b=0;b<NB;b++){
    const y=y0+b*pitch;
    const grp=g.appendChild(el("g"));

    /* THE TRACK IS SCENERY AND SHOULD READ AS SCENERY. It was as solid as the
       genes riding it, so four belts competed with the sixteen gene models and
       three hundred reads that are the actual subject. Dropped back toward the
       ground it still carries the motion — the slats are what makes it a belt
       — without asking to be looked at. */
    grp.appendChild(el("polygon",{points:pts([P(x0,y-BW/2,base),P(x1,y-BW/2,base),
      P(x1,y+BW/2,base),P(x0,y+BW/2,base)]),
      fill:"var(--t-right)","fill-opacity":".55",stroke:"var(--stroke)",
      "stroke-width":"0.9","stroke-opacity":".11"}));
    grp.appendChild(el("polygon",{points:pts([P(x0,y+BW/2,base),P(x1,y+BW/2,base),
      P(x1,y+BW/2,0),P(x0,y+BW/2,0)]),
      fill:"var(--t-right)","fill-opacity":".7",stroke:"var(--stroke)",
      "stroke-width":"0.9","stroke-opacity":".11"}));

    const slats=[];
    for(let k=0;k<30;k++)
      slats.push(grp.appendChild(el("line",{stroke:"var(--stroke)",
        "stroke-width":"1","stroke-opacity":".09"})));

    const genes=[];
    for(let i=0;i<GPB;i++){
      const len=LOOP/GPB;
      const ex=[];
      let f=0.015+rnd()*0.03;
      while(f<0.93){
        const w=0.055+rnd()*0.10;
        if(f+w>0.955) break;
        ex.push([f,f+w]);
        f+=w+0.05+rnd()*0.085;
      }
      const ggrp=grp.appendChild(el("g"));
      const gn={grp:ggrp,len,ex,pos:0,
        /* EVERY GENE THE SAME TONE, AND IT IS THE QUIET ONE. They alternated
           between two, which made every other model on the belt look like a
           different kind of object — the variation said something, and there
           was nothing for it to say. */
        body:boxNodes(ggrp,"var(--t-left)","var(--t-right)",0.8),
        exons:ex.map(()=>boxNodes(ggrp,"var(--k-top)","var(--k-left)",1.0)),
        reads:[], spl:[]};
      const NR=19+Math.floor(rnd()*8);
      for(let k=0;k<NR;k++){
        const e=ex[Math.floor(rnd()*ex.length)];
        const RL=0.048;
        const lo=e[0]+0.003, hi2=Math.max(lo,e[1]-RL-0.003);
        gn.reads.push({f:lo+rnd()*(hi2-lo), len:RL,
          dy:(rnd()-0.5)*BW*0.46,
          u0:0.198+rnd()*0.062,                 /* lands in the first third */
          fx0:(5.2+rnd()*3.4)*K,                /* comes in from a long way up-belt */
          fz:(2.3+rnd()*1.5)*KZ,                /* a shallow slant, not a vertical drop */
          /* HALF THE WEIGHT. Three hundred reads at three pixels is a mass;
             at one and a half it is three hundred reads. */
          ln:ggrp.appendChild(el("line",{stroke:"var(--cull)","stroke-width":"1.5",
            "stroke-linecap":"butt","stroke-opacity":"0"}))});
      }
      for(let k=0;k<ex.length-1;k++){
        if(rnd()<0.5) continue;
        gn.spl.push({j:[ex[k][1],ex[k+1][0]],
          dy:(rnd()-0.5)*BW*0.30,
          u0:0.204+rnd()*0.056,
          fx0:(5.4+rnd()*3.0)*K, fz:(2.5+rnd()*1.3)*KZ,
          a:ggrp.appendChild(el("line",{stroke:"var(--cull)","stroke-width":"1.7","stroke-opacity":"0"})),
          c:ggrp.appendChild(el("line",{stroke:"var(--cull)","stroke-width":"1.7","stroke-opacity":"0"})),
          arc:ggrp.appendChild(el("polyline",{fill:"none",stroke:"var(--cull)",
            "stroke-width":"0.9","stroke-linecap":"round","stroke-opacity":"0"}))});
      }
      genes.push(gn);
    }
    /* Uniform length, tiled nose to tail, and each belt phase-shifted by a
       QUARTER OF A GENE against the one behind it. Four belts, four quarters:
       an entry happens somewhere every quarter-gene, so the picture never has a
       lull and no two belts are ever at the same point in the cycle. */
    const GL=LOOP/GPB;
    genes.forEach((gn,i)=>{ gn.len=GL; gn.pos=((b*GL)/NB+i*GL)%LOOP; });
    belts.push({y,slats,genes,v});
  }

  const zGene=base+geneH, zExon=base+geneH+exonH, zRead=zExon+0.03*KZ;

  let t=0;
  const run=dt=>{
    t+=dt;
    for(const belt of belts){
      const y=belt.y, scroll=t*belt.v;

      const gap=span/belt.slats.length;
      belt.slats.forEach((s,k)=>{
        const x=x0+(((k*gap+scroll)%span)+span)%span;
        const a=P(x,y-BW/2,base), b=P(x,y+BW/2,base);
        s.setAttribute("x1",a[0].toFixed(1)); s.setAttribute("y1",a[1].toFixed(1));
        s.setAttribute("x2",b[0].toFixed(1)); s.setAttribute("y2",b[1].toFixed(1));
      });

      for(const gn of belt.genes){
        const gx=x0-PAD+(((gn.pos+scroll)%LOOP)+LOOP)%LOOP;
        const gxe=gx+gn.len;
        const u=clamp01((gx-(x0-PAD))/LOOP);
        /* THE GENE IS ONLY DRAWN ONCE IT IS TWO THIRDS ONTO THE BELT, and it
           goes again the moment it drops back under that. No half-genes at the
           ends, and no blink: the fade is on the overlap rather than on x. */
        const overlap=Math.max(0,Math.min(gxe,x1)-Math.max(gx,x0));
        const op=clamp01((overlap/gn.len-0.60)/0.14);
        /* the group stays alive well before that, because its inbound reads are
           already falling from up-belt and the trail is most of the picture */
        const live=gxe>x0-11*K && gx<x1+1.4*K;
        if(!live){
          if(gn.shown!==false){ gn.grp.setAttribute("display","none"); gn.shown=false; }
          continue;
        }
        if(gn.shown===false){ gn.grp.removeAttribute("display"); gn.shown=true; }
        /* Reads may show BEFORE the body does — the inbound trail is the point —
           but they must never outlive it. On the way out they fade on exactly
           the same measure, so nothing is left floating on nothing. */
        const opRead=gxe>x1?op:1;
        const GX=f=>gx+f*gn.len;

        /* THE LADDER, DARK TO LIGHT: track, gene body, exon, read. Each rung
           is a step and the reads are the top of it — everything below them is
           there to be landed ON, and the moment two rungs sit at the same
           brightness the eye has to be told what to look at instead of being
           shown. */
        setBox(gn.body,gx,gxe,y,BW*0.62,base,zGene,(op*0.55).toFixed(3));
        gn.ex.forEach(([a,c],i)=>
          setBox(gn.exons[i],GX(a),GX(c),y,BW*0.52,zGene,zExon,(op*0.7).toFixed(3)));

        for(const r of gn.reads){
          const tx=GX(r.f), tx2=GX(r.f+r.len);
          let x,z,ro;
          /* A LANDED READ IS OPAQUE. It was drawn at 0.62 so it would sit into
             the surface rather than on it — which was the right instinct while
             the exons were bright and the wrong one now that they are not. The
             reads are the only saturated thing on this station and the only
             thing a viewer is meant to count; nothing is served by making them
             argue with the box underneath. */
          if(u<r.u0){ x=0; z=0; ro=0; }
          else if(u<r.u0+0.058){
            const k=(u-r.u0)/0.058, ke=easeOut(k);
            x=tx-r.fx0*(1-ke);
            z=r.fz*Math.pow(1-k,1.25);
            ro=Math.min(1,k*4);
          } else { x=tx; z=0; ro=1; }
          const zz=zRead+z;
          const a=P(x,y+r.dy,zz), b=P(x+(tx2-tx),y+r.dy,zz);
          r.ln.setAttribute("x1",a[0].toFixed(1)); r.ln.setAttribute("y1",a[1].toFixed(1));
          r.ln.setAttribute("x2",b[0].toFixed(1)); r.ln.setAttribute("y2",b[1].toFixed(1));
          r.ln.setAttribute("stroke-opacity",(ro*opRead).toFixed(3));
        }

        for(const sp of gn.spl){
          const ja=GX(sp.j[0]), jb=GX(sp.j[1]), HL=0.30*K;
          let off,z,so;
          if(u<sp.u0){ off=0; z=0; so=0; }
          else if(u<sp.u0+0.062){
            const k=(u-sp.u0)/0.062, ke=easeOut(k);
            off=-sp.fx0*(1-ke);
            z=sp.fz*Math.pow(1-k,1.25);
            so=Math.min(1,k*4);
          } else { off=0; z=0; so=1; }
          const zz=zRead+z, yy=y+sp.dy, oo=(so*opRead).toFixed(3);
          const seg=(node,u0,u1)=>{
            const a=P(u0+off,yy,zz), b=P(u1+off,yy,zz);
            node.setAttribute("x1",a[0].toFixed(1)); node.setAttribute("y1",a[1].toFixed(1));
            node.setAttribute("x2",b[0].toFixed(1)); node.setAttribute("y2",b[1].toFixed(1));
            node.setAttribute("stroke-opacity",oo);
          };
          seg(sp.a,ja-HL,ja);
          seg(sp.c,jb,jb+HL);
          const N=20, path=[];
          const lift=(0.26+(jb-ja)*0.10)*KZ;
          for(let i=0;i<=N;i++){
            const k=i/N;
            path.push(P(ja+(jb-ja)*k+off,yy,zz+Math.sin(Math.PI*k)*lift));
          }
          sp.arc.setAttribute("points",pts(path));
          sp.arc.setAttribute("stroke-opacity",oo);
        }
      }
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.belts=drawBelts;


/* ============================================================
   W1 · BARCODE WHITELISTS — where the lists come from

   Three plates in the sizes the chemistry actually uses:

     BC1   48 wells  ->  96 barcodes
     BC2   96 wells  ->  96 barcodes
     BC3   96 wells  ->  96 barcodes

   ALL THREE SHARE A WELL PITCH, because real 48- and 96-well plates have the
   same wells — the 48 is simply a smaller plate. So BC1's plate is visibly two
   thirds the width of the others and still yields 96, because each of its wells
   holds two RT primers, an oligo-dT and a random hexamer, carrying different
   barcodes. Barcodes rise from that plate IN PAIRS and singly from the other
   two. Same count, half the wells, two per well — visible in the motion rather
   than asserted in a caption.

   EACH RISER IS EXACTLY EIGHT BASES, and that is arithmetic rather than
   decoration: the dash pattern is fixed in screen pixels and the riser's world
   length is derived from it, so eight dashes and seven gaps land on the line
   exactly. Scale the plates and the barcode stays eight bases long and stays
   legible; scale the dashes with everything else and it would dissolve.

   It climbs to the registry overhead and is written in; the registry fills
   continuously, in order, and never empties.

   THE BARCODES ARE `--fg`, THE PAGE'S OWN INK, AND THEY ARE MEANT TO BE WHITE.
   These are the whitelists. It is the one place on the map where the brightest
   token is spent on something that is neither a read nor a name, and the pun is
   the reason. --fg follows the theme, so in light mode the "white" list is the
   darkest ink on the page — which is the same joke told the other way up.
   ============================================================ */
const sstep=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

/* paint() builds from the ground; the registry hangs in the air, so this is the
   same three faces with a floor under them. */
function slabAt(g,x,y,w,d,h,sk,z0,op){
  const hw=w/2, hd=d/2;
  const c=[[x-hw,y-hd],[x+hw,y-hd],[x+hw,y+hd],[x-hw,y+hd]];
  const f={
    top  :pts(c.map(p=>P(p[0],p[1],z0+h))),
    right:pts([P(c[1][0],c[1][1],z0+h),P(c[2][0],c[2][1],z0+h),P(c[2][0],c[2][1],z0),P(c[1][0],c[1][1],z0)]),
    left :pts([P(c[3][0],c[3][1],z0+h),P(c[2][0],c[2][1],z0+h),P(c[2][0],c[2][1],z0),P(c[3][0],c[3][1],z0)]),
  };
  const o=(op===undefined?1:op);
  ["left","right","top"].forEach(k=>g.appendChild(el("polygon",
    {points:f[k],fill:sk[k],"fill-opacity":o.toFixed(2),stroke:"var(--stroke)",
     "stroke-width":"0.9","stroke-opacity":(0.6*Math.min(1,o*2.2)).toFixed(3)})));
  return f;
}

const ROUNDS=[
  {key:"BC1", cols:8,  rows:6, perWell:2, risers:13},
  {key:"BC2", cols:12, rows:8, perWell:1, risers:20},
  {key:"BC3", cols:12, rows:8, perWell:1, risers:20},
];

function drawWhitelists(g,n){
  hitBox(g,n);
  const rnd=mulberry32(0x5eedf15^0x1B);
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

  /* the layout is authored in its own units and scaled onto the node: K across
     the ground, KZ up. The dashes are NOT scaled — see the header. */
  const PITCH0=0.34, WELLR0=0.105, GAP0=3.3, PH0=0.30, ZR0=8.2, REGH0=0.07;
  const NATW=ROUNDS.reduce((t,R)=>t+R.cols*PITCH0,0)+GAP0*(ROUNDS.length-1);
  const K=n.w/NATW, KZ=n.h/(ZR0+REGH0);
  const PITCH=PITCH0*K, WELL_R=WELLR0*K, gap=GAP0*K, h=PH0*KZ, ZR=ZR0*KZ;
  const y=n.y;

  const DASH=2.5, GAP=1.35, BC_LEN=(8*DASH+7*GAP)/(S*CZ);
  const PLATE={top:"var(--t-top)",left:"var(--t-left)",right:"var(--t-right)"};
  const REG  ={top:"var(--t-left)",left:"var(--t-right)",right:"var(--t-right)"};

  const plates=[];
  let cx=0;
  ROUNDS.forEach(R=>{
    const w=R.cols*PITCH, d=R.rows*PITCH;
    plates.push({R,px:cx+w/2,w,d});
    cx+=w+gap;
  });
  plates.forEach(p=>{ p.px+=n.x-(cx-gap)/2; });

  /* ---- plates, wells, risers ---- */
  plates.forEach(pl=>{
    const {R,px,w,d}=pl;
    const grp=g.appendChild(el("g"));
    slabAt(grp,px,y,w+0.30*K,d+0.30*K,h,PLATE,0);

    const wells=[], wellNodes=[], wellLit=[];
    for(let r=0;r<R.rows;r++) for(let c=0;c<R.cols;c++){
      const wx=px-w/2+(c+0.5)*PITCH, wy=y-d/2+(r+0.5)*PITCH;
      wells.push([wx,wy]);
      const e=ellipseAt(wx,wy,h,WELL_R);
      grp.appendChild(el("ellipse",{cx:e.x,cy:e.y,rx:e.rx,ry:e.ry,
        fill:"var(--bg)","fill-opacity":".55",stroke:"var(--stroke)",
        "stroke-width":".55","stroke-opacity":".5"}));
      wellNodes.push(grp.appendChild(el("ellipse",{cx:e.x,cy:e.y,
        rx:(e.rx*0.82).toFixed(2),ry:(e.ry*0.82).toFixed(2),
        fill:"var(--fg)","fill-opacity":"0"})));
      wellLit.push(-99);
    }

    const risers=[];
    const PERIOD=4.6+rnd()*0.5;
    for(let k=0;k<R.risers;k++){
      const lines=[];
      for(let s=0;s<R.perWell;s++)
        lines.push(grp.appendChild(el("line",{stroke:"var(--fg)","stroke-width":"2.7",
          "stroke-linecap":"butt","stroke-dasharray":DASH+" "+GAP,"stroke-opacity":"0"})));
      risers.push({lines,per:PERIOD,ph:k/R.risers,wi:0,slot0:0,lastU:1,armed:false});
    }
    Object.assign(pl,{wells,wellNodes,wellLit,risers,grp,seq:0});
  });

  /* ---- the registry: one panel per round, over its own plate.
     BUILT LAST ON PURPOSE. DOM order is paint order, so the panels sit on top
     of the risers and a climbing barcode passes UP AND BEHIND its register
     rather than stopping short of it. */
  const SLOT_P=0.42*K;
  plates.forEach(pl=>{
    const rw=pl.w+0.7*K, rd=pl.d+1.15*K;
    slabAt(g,pl.px,y,rw,rd,REGH0*KZ,REG,ZR);
    const cols=Math.max(1,Math.round(rw/SLOT_P)), rows=Math.max(1,Math.round(rd/SLOT_P));
    const slots=[];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const sx=pl.px-rw/2+((c+0.5)*rw)/cols, sy=y-rd/2+((r+0.5)*rd)/rows;
      const a=P(sx,sy-0.10*K,ZR+REGH0*KZ+0.005), b=P(sx,sy+0.10*K,ZR+REGH0*KZ+0.005);
      slots.push({node:g.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
        x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg)",
        "stroke-width":"1.9","stroke-linecap":"butt","stroke-opacity":"0.05"})),lit:-99});
    }
    Object.assign(pl,{rw,rd,slots,ptr:0});
  });

  /* ---- the names, lying along the edges they belong to --------------------
     Both edges at constant y — the far one and the near one — run at +30 on
     screen, so a register's name rides its far edge and a plate's rides its
     near one and the two share an angle. That is +30 rather than the map's own
     -30 on purpose: these are not names OF an object on the map, they are
     writing ON one, and writing on a surface takes the surface's angle. */
  const place=(wx,wy,wz,rows,firstDy,startX)=>{
    const a=P(wx,wy,wz);
    const t=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(30)`,
      "text-anchor":"start","font-family":MONO});
    rows.forEach(([str,fill,size,weight,ls,op],i)=>{
      const sp=el("tspan",{x:startX,y:firstDy+i*17*K,fill,"font-size":size,
        "font-weight":weight,"letter-spacing":ls,"fill-opacity":op});
      sp.textContent=str; t.appendChild(sp);
    });
    g.appendChild(t);
  };
  /* ONE SIZE FOR ALL THREE, taken from the shortest edge — BC1's plate is the
     small one, and three sibling labels at three different sizes would read as
     a mistake rather than as a fit. */
  const CH=0.68, mainText=pl=>pl.R.key+" — 96 BARCODES";
  const FIT=Math.max(6.5,Math.min(...plates.map(pl=>
    ((pl.d+0.30*K)*S)/(mainText(pl).length*CH))));
  plates.forEach(pl=>{
    place(pl.px-pl.rw/2, y-pl.rd/2-0.40*K, ZR+REGH0*KZ,
      [[pl.R.key+" WHITELIST","var(--fg)",(FIT*0.95).toFixed(1),"600",(FIT*0.11).toFixed(2),"1"]],
      0, 12*K);
    const rows=[[mainText(pl),"var(--fg)",FIT.toFixed(1),"600",(FIT*0.08).toFixed(2),".92"]];
    if(pl.R.perWell===2)
      rows.push(["two primers per well","var(--fg3)",(FIT*0.84).toFixed(1),"400","0",".9"]);
    place(pl.px-(pl.w+0.30*K)/2, y+(pl.d+0.30*K)/2+0.42*K, h, rows, 15*K, 14*K);
  });

  const CLIMB=0.72;                          /* fraction of the cycle spent rising */
  const TOP=(ZR+1.15*KZ-h)*0.80;             /* ends short of the register */
  /* the head crosses the register underside at climb 0.825; the row is taken
     just after, so the arrival reads as cause and the write as effect */
  const WRITE=0.88;
  let t=0;
  const run=dt=>{
    t+=dt;
    for(const pl of plates){
      const {R,wells,risers}=pl;
      risers.forEach(rs=>{
        const raw=t/rs.per+rs.ph, u=raw-Math.floor(raw);
        /* a new cycle takes the NEXT well and the NEXT rows of the register, so
           wells fire in the same order the register fills */
        if(u<rs.lastU){
          rs.wi=pl.seq%wells.length;
          rs.slot0=(pl.seq*R.perWell)%pl.slots.length;
          pl.wellLit[rs.wi]=t; pl.seq++; rs.armed=true;
        }
        rs.lastU=u;
        const [wx,wy]=wells[rs.wi];
        const climb=Math.min(1,u/CLIMB), e=1-Math.pow(1-climb,1.9);
        const zb=h+TOP*e;
        /* dark at the mouth of the well, bright across the middle, gone by 80% */
        const op=Math.min(sstep(0,0.20,climb),1-sstep(0.58,0.80,climb))*0.92;
        rs.lines.forEach((ln,si)=>{
          const off=R.perWell===2?(si===0?-0.08*K:0.08*K):0;
          const a=P(wx+off,wy+off*0.6,zb), b=P(wx+off,wy+off*0.6,zb+BC_LEN);
          ln.setAttribute("x1",a[0].toFixed(1)); ln.setAttribute("y1",a[1].toFixed(1));
          ln.setAttribute("x2",b[0].toFixed(1)); ln.setAttribute("y2",b[1].toFixed(1));
          ln.setAttribute("stroke-opacity",Math.max(0,op).toFixed(3));
        });
        if(rs.armed && climb>=WRITE){
          for(let si=0;si<R.perWell;si++)
            pl.slots[(rs.slot0+si)%pl.slots.length].lit=t;
          rs.armed=false;
        }
      });
      pl.wellNodes.forEach((nd,i)=>{
        const age=t-pl.wellLit[i];
        nd.setAttribute("fill-opacity",age<0?"0":(0.85*Math.exp(-age/0.55)).toFixed(3));
      });
      for(const sl of pl.slots){
        const age=t-sl.lit;
        sl.node.setAttribute("stroke-opacity",(age<0?0.05:0.05+0.9*Math.exp(-age/3.0)).toFixed(3));
      }
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.whitelists=drawWhitelists;


/* ============================================================
   E3 · MATCH R2 BARCODES — the sorting yard

   Eight lanes of raw R2 fragments enter. Three reader gantries stand across
   them, one per barcoding round, each holding its whitelist overhead.

     SCAN  a fragment crosses a gantry and that round's barcode is checked
           against the whitelist — exact, or one mismatch corrected
     BIN   it merges into the lane for what it matched. Eight lanes become
           four, then two, then one
     DUMP  no hit within one mismatch and it veers off to the reject lane,
           which runs the length of the yard and ends in a bin

   By the far end the survivors are on ONE lane, and that lane opens again into
   the distinct cell identities the triplets actually name. The funnel and the
   fan are the same movement twice: many things becoming one thing, and one
   validated thing standing for many.

   THE REJECT LANE IS DRAWN ON PURPOSE. A picture where everything matches is a
   picture of transport, not of matching. The rate is tuned for legibility and
   is much worse than a real run — the dump lane has to be visibly busy to read
   at all, and the node's own prose carries the real figure: 75.7% of reads
   carry a valid barcode combination.

   COLOUR, AND ONE THING IT DELIBERATELY DOES NOT DO. The barcode blocks are
   `--accent`, R2's own token, because that is what this whole branch is: dim
   until a gantry has read them, bright after. The ticks are `--fg` so a verdict
   sits legibly on top of the block it judges.

   THE REJECTS ARE NOT `--cull`. That would be the obvious choice — it is the
   page's inherited "this is being dropped" token — and on THIS map it is R1's
   trail, orange from the fragment's cDNA end all the way to the join. Spending
   it here would put R1's colour inside R2's station. So a reject is dim rather
   than differently coloured, and the CROSS carries the verdict: the same rule
   the UMI outline and the splice arc already follow. (HANDOFF's palette note
   warned this trade would come due the moment something on this map started
   dropping things. This is that moment, and this is the answer.)
   ============================================================ */

/* Three squares per fragment, one per barcode. R2 also carries a UMI, but the
   UMI is never matched against anything — it rides through untouched — so it
   is drawn in the fragment anatomy at E2 and left out of the matching yard,
   where a fourth block would only muddy the triplet. */
const YARD_ROUNDS=[
  /* gz/pgap are the gantry: how high the beam rides and how far the scanner
     face sits above it. They are here rather than inline because NATZ is built
     from them — lower the arch without lowering NATZ and n.h stops meaning the
     height of the thing. IN, PAD and LANDX are the approach, in the same
     authored units: the track starts at IN, a fragment is born at PAD, and it
     touches down at LANDX — just past the start of the track, so the landing
     happens ON it and not halfway to the first scanner. */
  {x0:0, x1:19.4, cy:-1.1, base:0.14, gx:[3.9,7.5,11.1], MZ:1.5, REJ:3.6,
   binX:14.6, v:1.25, fanX:13.4, MZ2:2.6, OUTN:6, OUTP:0.86, VALX:17.7,
   gz:0.66, pgap:0.40, IN:-3.0, PAD:-7.4, LANDX:-2.5, TRK:2.8},
][0];

/* the handful of numbers both drawSortingYard and PORTS.sortingyard need */
function yardMetrics(n){
  const A=YARD_ROUNDS, K=n.w/(A.x1-A.x0), KZ=n.h/(A.base+A.gz+A.pgap+0.07);
  return {A,K,KZ, x0:n.x-n.w/2, x1:n.x+n.w/2, cy:n.y+A.cy*K, base:A.base*KZ};
}

function drawSortingYard(g,n){
  hitBox(g,n);
  const rnd=mulberry32(0x5eedf15^0xE3);
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

  /* authored in its own units and scaled onto the node: K across the ground,
     KZ up. Everything below is in scaled world units. */
  const M=yardMetrics(n), A=M.A, K=M.K, KZ=M.KZ;
  const SC=q=>q*K;
  const x0=M.x0, x1=M.x1;
  const XX=q=>x0+(q-A.x0)*K;                   /* authored x -> world x */
  const cy=M.cy;
  const base=M.base, REJ=n.y+SC(A.REJ), binX=XX(A.binX), fanX=XX(A.fanX);
  const gx=A.gx.map(XX), MZ=SC(A.MZ), MZ2=SC(A.MZ2), OUTP=SC(A.OUTP);
  const VALX=XX(A.VALX), v=A.v*K, OUTN=A.OUTN;
  const SEG_W=SC(0.32), LINK=SC(0.19);
  const SPREAD=[0,SEG_W+LINK,2*(SEG_W+LINK)], PACKED=SPREAD;

  const DECK={top:"var(--t-top)",left:"var(--t-left)",right:"var(--t-right)"};
  const GAN ={top:"var(--k-top)",left:"var(--k-left)",right:"var(--k-right)"};
  /* the bin takes the reject colour too — it is where the crosses end up, and
     a neutral box at the end of a brown lane reads as a different story. Half
     opacity, because it is a terminus and not a destination. */
  const BIN ={top:"var(--rej)",left:"var(--rej)",right:"var(--rej)"};

  const COUNTS=[8,4,2,1], PITCH=[SC(0.80),SC(1.05),SC(1.45),0];
  const laneY=(st,i)=>cy+(i-(COUNTS[st]-1)/2)*PITCH[st];
  const laneAt=(o,st)=>Math.floor(o/Math.pow(2,st));
  const outY=j=>cy+(j-(OUTN-1)/2)*OUTP;
  const yFan=(x,j)=>laneY(3,0)+(outY(j)-laneY(3,0))*sstep(fanX,fanX+MZ2,x);

  /* one continuous y for a fragment: its lane, blended through each merge */
  const yMain=(x,o)=>{
    let yv=laneY(0,o);
    for(let s=0;s<3;s++){
      const k=sstep(gx[s],gx[s]+MZ,x);
      yv+=(laneY(s+1,laneAt(o,s+1))-laneY(s,laneAt(o,s)))*k;
    }
    return yv;
  };
  const yOf=(x,o,fail,out)=>{
    const funnel=yMain(x,o);
    const main=funnel+(yFan(x,out)-laneY(3,0))*sstep(fanX-SC(0.1),fanX+SC(0.1),x);
    if(fail<0) return main;
    const hit=gx[fail]-SPREAD[fail]-SEG_W/2;   /* where that block was read */
    return main+(REJ-main)*sstep(hit+SC(0.10),hit+SC(2.0),x);
  };

  /* ---- THE DECK IS ALMOST NOT THERE ----------------------------------
     It was a solid floor, and a solid floor under a yard whose whole subject is
     eight thin lanes and what travels them is a large bright rectangle
     competing with all of it. What the yard needs from a floor is the fact that
     the gantry legs stand on something; the lanes themselves draw the ground.
     So it is kept and dropped to a tenth, which reads as a surface at a glance
     and as nothing at all a moment later. */
  const dTop=laneY(0,0)-SC(1.0), dBot=REJ+SC(0.9);
  const xIn=XX(A.IN);                        /* where the lanes actually begin */
  slabAt(g,(xIn+x1)/2,(dTop+dBot)/2,x1-xIn,dBot-dTop,base,DECK,0,0.10);

  /* ---- lane guides, drawn from the same functions the fragments follow ---- */
  const guide=(fn,op,w,xa,xb)=>{
    const p=[];
    for(let i=0;i<=90;i++){ const x=xa+((xb-xa)*i)/90; p.push(P(x,fn(x),base)); }
    g.appendChild(el("polyline",{points:pts(p),fill:"none",stroke:"var(--fg3)",
      "stroke-width":w,"stroke-opacity":op,"stroke-linecap":"round"}));
  };
  /* THE EIGHT LANES RUN BACK PAST THE YARD'S OWN START, because a fragment
     has to have somewhere to land. It comes down out of the air onto bare
     track, runs a little way on it, and only then reaches the first gantry —
     which is the difference between arriving and simply appearing. */
  /* ONE POLYLINE PER LANE, FROM THE APPROACH STRAIGHT THROUGH THE YARD. The
     approach was briefly drawn as its own dimmer segment, which made it read as
     a second set of tracks that happened to meet the first — the join showed and
     the shading disagreed. It is one track. */
  for(let o=0;o<8;o++) guide(x=>yMain(x,o),0.30,"1.5",xIn,fanX);
  for(let j=0;j<OUTN;j++) guide(x=>yFan(x,j),0.30,"1.5",gx[2],x1);
  for(let s=0;s<3;s++)
    guide(x=>{
      if(x<gx[s]) return REJ;
      return laneY(s,0)+(REJ-laneY(s,0))*sstep(gx[s]+SC(0.10),gx[s]+SC(2.0),x);
    },0.18,"1.2",x0,binX);

  /* ---- fragments ---- */
  const zR=base+0.05*KZ, NF=48, frags=[];
  for(let i=0;i<NF;i++){
    const grp=g.appendChild(el("g"));
    const mk=fill=>grp.appendChild(el("polygon",{fill,stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".45","fill-opacity":"0"}));
    /* THE BODY IS ONE BAR, NOT TWO CONNECTORS. It is the same glyph E2 draws
       up the lane — three blocks on a strand — so the thing that lands here is
       recognisably the thing that was named there. Built before the blocks:
       DOM order is paint order, and the bar belongs underneath them. */
    frags.push({origin:i%8, ph:i/NF,
      fail:rnd()<0.34?Math.floor(rnd()*3):-1,
      out:i%OUTN, grp,
      body:mk("var(--fg3)"),
      bc:[mk("var(--accent)"),mk("var(--accent)"),mk("var(--accent)")],
      flash:[-99,-99,-99], px:undefined});
  }

  /* ---- verdict marks. Built after the fragments and BEFORE the gantries, so a
     tick or cross rides above its block but passes UNDER the scanner. ---- */
  const TICK="M -4.2 0.4 L -1.4 3.4 L 4.6 -4.2";
  const CROSS="M -3.8 -3.8 L 3.8 3.8 M 3.8 -3.8 L -3.8 3.8";
  const BIGTICK="M -8.4 0.8 L -2.8 6.8 L 9.2 -8.4";
  frags.forEach(fr=>{
    fr.big=g.appendChild(el("path",{d:BIGTICK,fill:"none",stroke:"var(--ok)",
      "stroke-width":"2.6","stroke-linecap":"round","stroke-linejoin":"round",
      "stroke-opacity":"0"}));
    fr.marks=[0,1,2].map(i=>g.appendChild(el("path",{
      d:fr.fail===i?CROSS:TICK, fill:"none",
      stroke:fr.fail===i?"var(--rej)":"var(--ok)",
      "stroke-width":"2.0","stroke-linecap":"round","stroke-linejoin":"round",
      "stroke-opacity":"0"})));
  });

  /* ---- gantries with their whitelists overhead.
     Built AFTER the fragments: DOM order is paint order, so a barcode passing
     under a scanner is hidden by it. ---- */
  const gz=A.gz*KZ, panelZ=gz+A.pgap*KZ;
  const stations=gx.map((sx,i)=>{
    const grp=g.appendChild(el("g"));
    const halfSpan=(COUNTS[i]-1)*PITCH[i]/2+SC(0.75);
    [-1,1].forEach(sgn=>slabAt(grp,sx,cy+sgn*halfSpan,SC(0.18),SC(0.18),gz,GAN,base));
    slabAt(grp,sx,cy,SC(0.34),halfSpan*2,0.16*KZ,GAN,base+gz);
    /* THE PANEL SPANS THE WHOLE ARCH. It was 78% of it, centred — which is
       centred, and does not look it: a slab narrower than the legs it sits on,
       floating above them, reads as slipped rather than as inset. Full width
       and the two agree, and the arch reads as one object with a lid. */
    slabAt(grp,sx,cy,SC(1.45),halfSpan*2,0.07*KZ,GAN,base+panelZ);
    const slots=[];
    for(let c=0;c<20;c++){
      const px=sx-SC(0.6)+(c/19)*SC(1.2), hw=halfSpan-SC(0.22);
      const a=P(px,cy-hw,base+panelZ+0.075*KZ), b=P(px,cy+hw,base+panelZ+0.075*KZ);
      slots.push({node:grp.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
        x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg)",
        "stroke-width":"1.7","stroke-opacity":"0.06"})),lit:-99});
    }
    return {sx,i,halfSpan,slots,ptr:0};
  });

  /* ---- the bin, built last and OPAQUE: a discarded triplet slides behind it
     and is gone. Translucent, it was a box you could watch things vanish inside,
     which is a different and much worse idea — the point is that the far side of
     it is out of the story. ---- */
  const BINW=SC(1.5);
  slabAt(g,binX,REJ,BINW,BINW,0.62*KZ,BIN,base);

  /* ---- the names, along the edges they belong to ---- */
  const lab=(wx,wy,wz,str,size,fill,op,rot,anchor,dy)=>{
    const a=P(wx,wy,wz);
    const t=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(${rot})`,
      "text-anchor":anchor||"start","font-family":MONO,fill,"font-size":size,
      "font-weight":"600","letter-spacing":(size*0.10).toFixed(2),"fill-opacity":op});
    if(dy) t.setAttribute("y",dy);
    t.textContent=str; g.appendChild(t);
  };
  const FS=Math.max(6,13.5*K);
  /* CLEAR OF THE PANEL, NOT ON IT. The name sat at 0.78 of the half-span, which
     was outside a panel that stopped at 0.78 and is inside one that runs the
     full width. It hangs just past the far end now, where there is nothing. */
  stations.forEach((st,i)=>
    lab(st.sx-SC(0.68), cy-st.halfSpan-SC(0.95), base+panelZ+0.07*KZ,
        `BC${i+1} WHITELIST`, FS.toFixed(1), "var(--fg)", "1", 30));
  /* and this one down at the bin's foot, out from under the tracks that reach it */
  lab(binX-SC(0.75), REJ+SC(2.20), base, "NO MATCH",
      (FS*0.96).toFixed(1), "var(--rej)", "1", 30);
  /* the point of the whole yard, named along its near edge, which runs at -30 */
  lab(x1+SC(0.55), outY(OUTN-1)+SC(0.55), base, "VALIDATED TRIPLETS",
      (FS*1.1).toFixed(1), "var(--ok)", "1", -30, "end");
  lab(x1+SC(0.55), outY(OUTN-1)+SC(0.55), base, "putative cell barcodes",
      (FS*0.92).toFixed(1), "var(--fg3)", ".9", -30, "end", (FS*1.33).toFixed(1));

  const quad=(node,xa,xb,yy,zz,op,fill,hd)=>{
    const q=hd===undefined?SC(0.10):hd;
    node.setAttribute("points",pts([P(xa,yy-q,zz),P(xb,yy-q,zz),
      P(xb,yy+q,zz),P(xa,yy+q,zz)]));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
    node.setAttribute("stroke-opacity",(clamp01(op)*0.5).toFixed(3));
    if(fill) node.setAttribute("fill",fill);
  };

  /* THE FALLING THING IS THE FRAGMENT ITSELF, not a stand-in for it.

     E4's reads fall as plain lines because a read at that station IS a plain
     line — a stretch of cDNA on a gene model. Here the object that matters is
     the triplet: three blocks on a body, exactly as it will look for the rest
     of its run. So the whole thing descends and lands and keeps going, rather
     than a line landing and a triplet appearing where it stopped. There is no
     moment where one becomes the other, because there is only ever one.

     It also puts them UNDER the scanners for free: the fragments are built
     before the gantries, and DOM order is paint order. */
  const PAD=-SC(A.PAD), LOOP=(x1-x0)+PAD*2;
  const LANDX=XX(A.LANDX), FALLX=SC(4.0), FALLZ=2.6*KZ;
  let t=0;
  const run=dt=>{
    t+=dt;
    for(const fr of frags){
      const u=((t*v/LOOP+fr.ph)%1+1)%1;
      const fx=x0-PAD+u*LOOP;
      /* a new lap is a new fragment: clear its verdicts, or it comes back in
         still wearing the cross it earned last time round */
      if(fr.px!==undefined && fx<fr.px){ fr.flash=[-99,-99,-99]; fr.valAt=undefined; }
      const yy=yOf(fx,fr.origin,fr.fail,fr.out);
      const pack=sstep(gx[2]+SC(0.5),gx[2]+SC(2.1),fx);

      /* the descent: 1 in the air at the far end of the run-in, 0 on the track */
      const air=Math.pow(1-clamp01((fx-(x0-PAD))/(LANDX-(x0-PAD))),1.6);
      const zAir=FALLZ*air, xAir=-FALLX*air;

      let vis=Math.min(sstep(x0-PAD,x0-PAD+SC(0.4),fx),1-sstep(x1-SC(0.8),x1+SC(0.2),fx));
      /* SWALLOWED — and the cut happens while it is completely hidden.

         The bin is 1.5 units of footprint and the triplet is 1.34, so there is
         a narrow window where the whole fragment is inside the box's silhouette
         and nothing else. Take it to zero there and the fragment is at full
         strength right up to the moment it goes behind the box, and simply
         never comes out the other side. Fade it anywhere wider and you watch it
         dissolve in the open, which is a different and much sadder story than
         being thrown away. */
      if(fr.fail>=0) vis*=1-sstep(binX-BINW*0.48,binX-BINW*0.39,fx);

      const blockX=(i,atX,pk)=>atX+SPREAD[i]+(PACKED[i]-SPREAD[i])*pk+SEG_W/2;

      /* IT ARRIVES BLUE AND IS DEMOTED, RATHER THAN FADING IN.

         A read falling out of the sky is R2 — blue is that branch's identity the
         whole length of the map, and the thing that lands has to be readable as
         one of those. What it is NOT yet is checked. So it stays R2's colour
         down the run-in, and the instant the first scanner reads block one the
         other two go dim: the fragment has stopped being a read and become a
         candidate with two claims outstanding, which it then earns back one
         gantry at a time. The change is a snap and wants to be — it is an
         event, not a transition, and it happens under the first arch where the
         eye is already looking. */
      const first=blockX(0,fx,pack)>gx[0];
      fr.bc.forEach((node,i)=>{
        const sx2=fx+xAir+SPREAD[i]+(PACKED[i]-SPREAD[i])*pack;
        /* once it has failed it is off the line — later gantries never see it */
        const reachable=fr.fail<0||i<=fr.fail;
        const scanned=blockX(i,fx,pack)>gx[i]&&reachable;
        const bad=fr.fail===i&&scanned;
        const fl=Math.max(0,1-(t-fr.flash[i])/0.38);
        const valid=fr.fail<0&&fx>VALX;
        /* unread blocks are dim AND a different token; read ones snap to R2's */
        const op=vis*(bad?0.7:scanned?0.95:first?0.55:0.90)*(1+fl*0.30);
        quad(node,sx2,sx2+SEG_W,yy,zR+zAir,op,
          bad?"var(--rej)":(scanned||valid||!first)?"var(--accent)":"var(--fg3)");
      });
      quad(fr.body,fx+xAir,fx+xAir+SPREAD[2]+SEG_W,yy,zR+zAir,vis*0.26,
        undefined,SC(0.045));

      stations.forEach((st,i)=>{
        const prev=fr.px===undefined?fx:fr.px;
        const stillOnLine=fr.fail<0||i<=fr.fail;
        /* the block, not the fragment, is what crosses the scanner */
        if(blockX(i,prev,pack)<=st.sx && blockX(i,fx,pack)>st.sx && stillOnLine){
          fr.flash[i]=t;                       /* the verdict, either way */
          if(fr.fail!==i){ st.slots[st.ptr%st.slots.length].lit=t; st.ptr++; }
        }
      });
      /* the whole triplet passes, once, on the far side of the hourglass */
      if(fr.px!==undefined && fr.px<=VALX && fx>VALX && fr.fail<0) fr.valAt=t;
      const bigAge=t-(fr.valAt===undefined?-99:fr.valAt);
      if(bigAge>=0 && bigAge<0.95){
        const c=fx+SPREAD[1]+(PACKED[1]-SPREAD[1])*pack+SEG_W/2;
        const a=P(c,yy,zR+0.72*KZ);
        const pop=bigAge<0.13?0.5+1.15*(bigAge/0.13):1.65-0.25*Math.min(1,(bigAge-0.13)/0.16);
        const bop=bigAge<0.09?bigAge/0.09:1-sstep(0.58,0.95,bigAge);
        fr.big.setAttribute("transform",
          `translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) scale(${pop.toFixed(2)})`);
        /* subtle: it is a confirmation, not an announcement */
        fr.big.setAttribute("stroke-opacity",(bop*vis*0.62).toFixed(3));
      } else fr.big.setAttribute("stroke-opacity","0");

      fr.marks.forEach((mk,i)=>{
        /* EVERY VERDICT HOLDS. A cross rides to the bin; a tick rides until the
           big check at the end takes over for all three at once. */
        const age=t-fr.flash[i];
        if(fr.flash[i]<0||age<0){ mk.setAttribute("stroke-opacity","0"); return; }
        const relieved=fr.valAt===undefined?0:sstep(0.05,0.30,t-fr.valAt);
        const sx2=fx+SPREAD[i]+(PACKED[i]-SPREAD[i])*pack+SEG_W/2;
        const a=P(sx2,yy,zR+0.5*KZ);
        const pop=age<0.11?0.55+1.0*(age/0.11):1.15-0.15*Math.min(1,(age-0.11)/0.14);
        const op=(age<0.08?age/0.08:1)*(1-relieved);
        mk.setAttribute("transform",
          `translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) scale(${pop.toFixed(2)})`);
        mk.setAttribute("stroke-opacity",(op*vis*0.9).toFixed(3));
      });
      fr.px=fx;
    }
    for(const st of stations) for(const sl of st.slots){
      const age=t-sl.lit;
      sl.node.setAttribute("stroke-opacity",(age<0?0.06:0.06+0.85*Math.exp(-age/1.7)).toFixed(3));
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.sortingyard=drawSortingYard;
