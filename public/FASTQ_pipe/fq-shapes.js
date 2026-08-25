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

  /* A ROOF LEAVES FROM ITS NEAREST CORNER, NOT FROM ITS MIDDLE.

     These two are the largest footprints on the map, and an edge drawn from the
     centre of one spends its whole length inside the object's own occlusion
     silhouette: GRCz11's line to the index was 136 pixels long and every one of
     them was underneath GRCz11. The track was there, the dot was travelling it,
     and the node read as unconnected.

     The corner is chosen by which one is nearest the far end, so the line
     leaves on the side it is going — no per-edge bookkeeping, and it stays
     right if either object is dragged or resized. */
  karyotype:(n,which,B)=>roofCorner(n,B),
  locus    :(n,which,B)=>roofCorner(n,B),
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
