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
    P(n.x+hw,n.y+hd,0),   P(n.x-hw,n.y+hd,0),   P(n.x-hw,n.y-hd,n.h)])}));
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
};

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
  const RB=n.w*0.70;                      /* ball radius, world units */
  const ZC=n.ballZ;                       /* it hovers; nothing here sits */
  const BX=X0, BY=Y0-ZC*S*CZ;             /* the ball's centre, on screen */
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
         which is the same key everything else on the page is sorted by. */
      const dep=Math.max(0,Math.min(1,((x1+y2)/Math.SQRT2+1)/2));
      const a=x1*RB, b=y2*RB, c=z2*RB;
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

   The genome lane is two files and two decisions, and until now it was two
   labelled cubes. These are what those files actually contain: the assembly
   says which bases are where, the annotation says which stretches are a gene,
   which parts survive splicing, which get translated, and which way it is
   read. Ported from two canvas drawings into this page's idiom.

   THEY ARE PANELS, AND THEY ARE TURNED LIKE THE FRAGMENT. Flat, square to the
   reader, rotated -30 onto the map's own diagonal — a rotation and not a shear,
   so the drawing inside stays undistorted. Same reasoning as the fragment: a
   diagram OF a file is not a thing standing somewhere in the world, and a
   diagram read at -30 is a diagram read at -30.

   THEY CARRY A CARD. The fragment does not, because nothing passes behind it;
   these are fed by reference edges that arrive at the node's own point, which
   is the middle of the panel. A faint plate hides the last stretch of that
   edge, so a line arrives at the figure rather than through it.

   COLOUR: NONE OF THEIR OWN. The chromosome bodies take the reference skin's
   own face (--k-top), the bands are punched out in --bg, and the window and its
   frustum are grey — the same grey the pool's leaders use, and for the same
   reason: a magnification is not a track. Coding sequence and UTR are the same
   token at two weights, which is the UMI's trick again. The fork owns orange
   and blue and nothing here borrows them.

   HONEST NOTE ON THE BANDS, carried over from the original and worth keeping:
   the chromosome LENGTHS are the real GRCz11 primary assembly in Mb. The
   banding and the centromere positions are NOT — zebrafish has no standard
   cytoband table of the kind that exists for human, so both are generated from
   a seed. They are there to make the shapes read as chromosomes, not to be
   counted. If a real band table ever lands, replace CHR_LAYOUT and nothing
   else changes.
   ============================================================ */

/* A flat panel, turned to the map's diagonal and centred on its node's own
   ground point. Everything inside is laid out in plain 0..W by 0..H local
   coordinates, exactly as it was on a canvas. */
function panel(g,n,PW){
  const p=P(n.x,n.y,0), X0=p[0], Y0=p[1];
  const PH=PW*9/16, x0=X0-PW/2, y0=Y0-PH/2;
  const host=g.appendChild(el("g",
    {transform:`rotate(${FRAG_TURN} ${X0} ${Y0}) translate(${x0} ${y0})`}));
  host.appendChild(el("rect",{x:0,y:0,width:PW,height:PH,
    fill:"var(--panel)","fill-opacity":".72",
    stroke:"var(--rule)","stroke-opacity":".55","stroke-width":"1"}));
  return {g:host, W:PW, H:PH, u:PH/100};
}

/* the word the panel is about, large and bold in its own white space */
function panelTitle(F,str,x,y,size){
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
  hitBox(g,n);
  const F=panel(g,n,n.pw||330), {W,H,u}=F;
  const margin=6*u, slot=(W-margin*2)/CHR_LAYOUT.length;
  const bw=Math.min(4.2*u, slot*0.56);
  const top=30*u, maxH=58*u, maxMb=Math.max(...CHR), waist=0.9*u;

  panelTitle(F,"GRCz11",margin,20*u,15*u);

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
        "stroke-opacity":".7","stroke-width":(0.45*u).toFixed(2)}));
    });

    /* the constriction, marked on both flanks */
    F.g.appendChild(el("path",{fill:"none",stroke:"var(--fg3)",
      "stroke-width":(0.45*u).toFixed(2),
      d:`M${x-0.5*u} ${yc}H${x+bw*0.22}M${x+bw*0.78} ${yc}H${x+bw+0.5*u}`}));
  });
}
DRAW.karyotype=drawKaryotype;

/* ---- Ensembl 99: one chromosome, one window, one locus -------------------
   Structure is real in kind; the coordinates are not. */
const LOCUS_BANDS=(()=>{
  const rnd=mulberry32(0x5eedf15^0x99), out=[]; let acc=0.03;
  while(acc<0.94){
    const gap=0.03+rnd()*0.06, w=0.025+rnd()*0.07;
    acc+=gap; if(acc+w>0.94) break;
    out.push([acc,w]); acc+=w;
  }
  return out;
})();

const GENE={inset:[0.10,0.90],
  exons:[[0,0.075],[0.135,0.20],[0.28,0.355],[0.44,0.505],[0.60,0.675],[0.79,1.0]],
  utr5:[0,0.042], utr3:[0.945,1.0]};

function drawLocus(g,n){
  hitBox(g,n);
  const F=panel(g,n,n.pw||330), {W,H,u}=F;
  const G=F.g, LAB=5.2*u;

  panelTitle(F,"Ensembl 99",6*u,14*u,11*u);

  /* ---- the chromosome, laid on its side ---- */
  const kx0=20*u, kx1=W-20*u, ky=28*u, kh=4.6*u, kw=kx1-kx0, cen=0.38, waist=0.9*u;
  const cxCen=kx0+kw*cen, r=kh/2, sq=kh*0.16;
  [[kx0,cxCen-waist/2,r,sq],[cxCen+waist/2,kx1,sq,r]].forEach(([a,b,rl,rr])=>{
    /* the arm helper runs vertically; on its side the radii swap axes, so the
       path is built by hand from the same two corner sizes */
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
      "stroke-opacity":".7","stroke-width":(0.45*u).toFixed(2)}));
  });
  G.appendChild(el("path",{fill:"none",stroke:"var(--fg3)","stroke-width":(0.45*u).toFixed(2),
    d:`M${cxCen} ${ky-0.6*u}V${ky+kh*0.22}M${cxCen} ${ky+kh*0.78}V${ky+kh+0.6*u}`}));

  /* ---- the window, and the frustum down onto the locus ----
     GREY, LIKE THE POOL'S LEADERS. A magnification is not a track: nothing
     travels it, so it takes neither read's colour. */
  const wx0=kx0+kw*0.470, wx1=kx0+kw*0.530;
  G.appendChild(el("rect",{x:wx0,y:ky-1.6*u,width:wx1-wx0,height:kh+3.2*u,
    fill:"none",stroke:"var(--fg)","stroke-opacity":".6","stroke-width":(0.8*u).toFixed(2)}));

  const lx0=8*u, lx1=W-8*u, lw=lx1-lx0;
  const [gi0,gi1]=GENE.inset;
  const X=f=>lx0+(gi0+(gi1-gi0)*f)*lw;
  const gx0=X(0), gx1=X(1);
  const y=68*u, CDSH=7.6*u, UTRH=4.0*u, lTop=50*u;

  G.appendChild(el("path",{fill:"none",stroke:"var(--fg)","stroke-opacity":".38",
    "stroke-width":(0.55*u).toFixed(2),"stroke-dasharray":`${(2.4*u).toFixed(1)} ${(2.6*u).toFixed(1)}`,
    d:`M${wx0} ${ky+kh+1.6*u}L${gx0} ${lTop}M${wx1} ${ky+kh+1.6*u}L${gx1} ${lTop}`}));

  /* ---- the model: a line, chevrons for the introns, blocks for the exons ---- */
  G.appendChild(el("line",{x1:gx0,y1:y,x2:gx1,y2:y,stroke:"var(--fg3)",
    "stroke-width":(0.75*u).toFixed(2)}));
  const inExon=f=>GENE.exons.some(([a,b])=>f>a&&f<b);
  let chev="";
  for(let f=0.006;f<1;f+=0.020){
    if(inExon(f)) continue;
    const x=X(f), a=1.5*u;
    chev+=`M${(x-a*0.6).toFixed(1)} ${(y-a).toFixed(1)}L${(x+a*0.6).toFixed(1)} ${y.toFixed(1)}`+
          `L${(x-a*0.6).toFixed(1)} ${(y+a).toFixed(1)}`;
  }
  G.appendChild(el("path",{d:chev,fill:"none",stroke:"var(--fg3)",
    "stroke-width":(0.5*u).toFixed(2)}));

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
        stroke:"var(--panel)","stroke-width":(0.35*u).toFixed(2)}));
    });
  });

  /* ---- ONE label per kind, not one per feature ----
     The original named every exon and every intron. Six "exon"s and five
     "intron"s is a pattern stated eleven times; one of each teaches the shape,
     and the room that buys goes into making them legible at map scale. */
  const lab=(str,x,ty,anchor)=>{
    const t=el("text",{x,y:ty,"text-anchor":anchor||"middle","font-size":LAB,
      "font-family":MONO,fill:"var(--fg3)"});
    t.textContent=str; G.appendChild(t); return t;
  };
  const tick=(x,y0,y1)=>G.appendChild(el("line",{x1:x,y1:y0,x2:x,y2:y1,
    stroke:"var(--fg3)","stroke-width":(0.45*u).toFixed(2),"stroke-opacity":".7"}));

  const e0=GENE.exons[0], e1=GENE.exons[1];
  const ex=(X(e0[0])+X(e0[1]))/2, ix=(X(e0[1])+X(e1[0]))/2;
  tick(ex, y-CDSH/2-1.3*u, y-CDSH/2-6.4*u); lab("exon", ex, y-CDSH/2-7.8*u);
  tick(ix, y+CDSH/2+1.3*u, y+CDSH/2+5.0*u); lab("intron", ix, y+CDSH/2+9.4*u);

  const utrLab=(x,str,anchor,dir)=>{
    G.appendChild(el("line",{x1:x,y1:y,x2:x+dir*2.6*u,y2:y,stroke:"var(--fg3)",
      "stroke-width":(0.45*u).toFixed(2),"stroke-opacity":".7"}));
    lab(str, x+dir*3.6*u, y+LAB*0.36, anchor);
  };
  utrLab(gx0,"5′ UTR","end",-1);
  utrLab(gx1,"3′ UTR","start",1);
}
DRAW.locus=drawLocus;
