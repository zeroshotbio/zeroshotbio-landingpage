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

/* LEFT TO RIGHT ALONG THE MOLECULE, AND `w` IS BASE PAIRS.

   Not schematic and not proportionate-ish: these are the real numbers, measured
   off MegaFin 1's own FASTQs on 2026-08-26 rather than read off a config, since
   no run folder and no split-pipe config for that run exist on this instance.

     R1  64 bp   the cDNA insert
     R2  58 bp   UMI[0:10] bc3[10:18] bc2[30:38] bc1[50:58]
                 -> UMI 10, three barcodes of 8, two linkers of 12

   Two proportions were wrong before and both were wrong in a way that told a
   story. R2 was drawn LONGER than R1; it is shorter, 58 against 64, and the two
   are nearly equal. And the linkers were drawn at twice a barcode when they are
   one and a half times it — 12 against 8 — which made the barcodes look like
   small marks on a long spacer instead of most of what read 2 is.

   THE ORDER IS THE MOLECULE'S, NOT R2's, and that stays. BC1 sits nearest the
   cDNA because reverse transcription attached it first; the UMI rides on the
   round-3 oligo at the far end. R2 sequences inward from that end, which is why
   it meets the UMI first and reaches round 1 last. Drawn truthfully, the
   reversal explains itself.

   THE GAP IS THE ONE ENTRY WHOSE `w` IS NOT A LENGTH, AND THE ONE FIGURE ON
   THIS GLYPH THAT IS NOT MEASURED.

   It cannot be. Read 2's 58 bases are barcode, linker and UMI end to end — not
   one base of cDNA — so the two reads never overlap and no paired-end inference
   is possible. What the FASTQs DO settle is that the middle is never short:
   0.37% of read 1s carry a run of 12+ A and those are spread flat across all
   positions, so they are A-rich sequence rather than a polyA junction. Read 1
   essentially never runs off the end of its insert. The middle is longer than
   64 bp and that is all the reads will say.

   So `approx` is an ORDER OF MAGNITUDE from the protocol's expected library
   size — final library minus the Illumina adapters, minus read 2's block, minus
   the oligo-dT scaffold, minus the 64 read 1 already has. It is drawn with a
   tilde and it is the only figure here with a unit on it, because it is not
   part of the 58 the others sum to.

   AND THE SEGMENT IS DRAWN WITH AN AXIS BREAK. At ~250 against a molecule whose
   whole sequenced length is 122, to scale it would be twice everything else put
   together and the barcodes would vanish. `w` is therefore a token, and the two
   slashes across it are the standard "not to scale" glyph — which is a much
   better statement than a quietly shortened bar, because it says the shortening
   is deliberate rather than leaving the reader to assume it is not there. */
const R1TONE="var(--cull)", R2TONE="var(--accent)";

const FRAG=[
  {k:"cdna", w:64, tone:"r1",    lab:"cDNA"},
  {k:"gap",  w:32, tone:"ghost", lab:"never sequenced", approx:250},  /* token width; see above */
  {k:"bc1",  w:8,  tone:"r2",    lab:"BC1"},
  {k:"l1",   w:12, tone:"link",  lab:""},
  {k:"bc2",  w:8,  tone:"r2",    lab:"BC2"},
  {k:"l2",   w:12, tone:"link",  lab:""},
  {k:"bc3",  w:8,  tone:"r2",    lab:"BC3"},
  {k:"umi",  w:10, tone:"umi",   lab:"UMI"},
];
const FRAG_R1BP=64, FRAG_R2BP=58;   /* = sum of the segments on either side */

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
  /* TWO REGISTERS, ONE ON EACH SIDE OF THE BAR.

     Above it: the measurements. Every base-pair figure, and nothing else — grey,
     small, no words. Below it: the names, the ones a person reads to find out
     what this molecule is made of. cDNA, the three barcodes, the UMI, and what
     the middle is; then the brackets and the two reads.

     They were interleaved before — the middle's name above, the figures below,
     the segment names in between — and the eye had to sort measurement from
     nomenclature on every row. Split by side and there is nothing to sort: one
     glance for what it IS, another for how long. */
  const BPROW=BT-8;                      /* every bp figure, above the bar */
  const ROW1=BB+18;                      /* cDNA BC1 BC2 BC3 UMI, below it */
  const ROW2=ROW1+15;                    /* "never sequenced", on its own row */
  const YB=ROW2+16, LBL=YB+20;           /* the brackets, then R1 and R2 */
  const NSQ=BPROW, CTOP=BPROW-14;
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

  return {X0,Y0,FW,FX0,FX1,BH,NSQ,ROW1,ROW2,BPROW,BB,BT,BMID,YB,LBL,CTOP,
          px,py,rot,total,wOf,xs,gi,r1Port,r2Port};
}

function drawFragment(g,n){
  hitBox(g,n);
  const F=fragGeom(n.x,n.y);
  /* one rotate on the group; everything inside is laid out level */
  g=g.appendChild(el("g",{transform:`rotate(${FRAG_TURN} ${F.px} ${F.py})`}));
  const {FX0,FX1,FW,BT,BB,BH,BMID,NSQ,ROW1,ROW2,BPROW,YB,LBL}=F;
  const SEG=13, SUB=11, HEAD=16, BP=9, RDBP=11.5;

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
      /* THE AXIS BREAK, at the middle: two parallel slashes, which is what a
         chart draws when an axis is interrupted. The name and its leader step
         to the left of them so the three marks do not stack on one point. */
      [-3.1,3.1].forEach(dx=>g.appendChild(el("line",{
        x1:mid+dx-3.2, y1:BB+3.4, x2:mid+dx+3.2, y2:BT-3.4,
        stroke:"var(--fg3)","stroke-width":"1.2","stroke-linecap":"round"})));
      /* THE NAME DROPS TO ITS OWN ROW BELOW. Fifteen characters centred on a
         32-unit token would run into BC1 on the names row; a row of its own
         costs 15px and buys the whole clearance. Its leader passes down through
         the names row at a point where there is no name — the gap's midpoint is
         166px from cDNA and 52 from BC1 — so nothing has to move for it. */
      tick(mid,BB,ROW2-10,"var(--fg3)");
      text(s.lab,mid,ROW2,SUB,"var(--fg3)");
      /* the tilde carries the whole claim: approximately, and from the protocol
         rather than from these reads */
      text(`~${s.approx} bp`,mid,BPROW,BP,"var(--fg3)");
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
      /* ITS NAME DROPS TO THE SECOND ROW, and now that there IS a second row it
         actually does. At the true 10 bp the UMI is 26px wide against BC3's 21
         and their centres are 23 apart, so two four-character names on one row
         run together — "BC3UMI" — because nothing separates the two on the
         molecule either. The row below is empty out here: the only other thing
         on it is the middle's name, 180px away. */
      tick(mid,BB,ROW2-12,R2TONE);
      text(s.lab,mid,ROW2,SEG,R2TONE,"600");
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

  /* ---- THE LENGTHS, AND THEY ARE MEANT TO BE FOUND RATHER THAN READ.

     A bare figure over every segment of read 2 — no unit, because the "58 bp"
     under the bracket has already given it, and no colour, because a
     measurement is not a party to the thing it measures. Six of them, and they
     add to the 58: the drawing can be checked against itself.

     NOT UNDER THE cDNA. Its figure is the 64 under the R1 bracket and printing
     it twice would make it look like two facts. And NOT UNDER THE GAP: insert
     size varies per fragment and the FASTQ cannot tell us, so the one segment
     with no number is the one whose length is genuinely unknown. That silence
     is doing work, which is why nothing is allowed to fill it. */
  for(let i=gi+1;i<FRAG.length;i++){
    const x=xs[i], w=wOf(FRAG[i]);
    text(String(FRAG[i].w), x+w/2, BPROW, BP, "var(--fg3)");
  }

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
    /* THE ARROWHEAD SITS 20% IN FROM THE OUTER END — the end the read STARTS
       at, next to its own name — and not 15% in from the inner one. Both
       brackets meet at the gap, so an arrow near each inner end put the two of
       them within a few pixels of each other in the middle of the drawing,
       where they read as one symmetrical ornament rather than as two reads
       going opposite ways. Out at the ends, each arrow sits under its own name
       and points away from it, which is what the read does. */
    const a=4.2, back=0.20*(xb-xa), ax=(dir>0?xa+back:xb-back);
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

  /* the two read lengths, centred under their own brackets — the name at the
     outer end says WHICH read, the figure in the middle says how much of the
     molecule it covers. Neutral ink on purpose: 64 against 58 is the one
     proportion on this glyph a reader is meant to weigh, and it weighs better
     without either read's colour arguing for it. */
  text(`${FRAG_R1BP} bp`, (FX0+xs[gi])/2, LBL, RDBP, "var(--fg2)");
  text(`${FRAG_R2BP} bp`, (xs[gi]+wOf(FRAG[gi])+FX1)/2, LBL, RDBP, "var(--fg2)");
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
  /* the belts are 6.4 units along the lane and the edge before them arrives
     head-on; without this it lands in the middle of the machine */
  belts     :(n,which,B)=>roofCorner(n,B),
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
    const FL=M.A.FLEN*M.K;
    if(which==="head") return P(M.x0+(M.A.TRK-M.A.x0)*M.K, M.cy, M.base);
    /* THE NEAR RAIL, not the centre line. VALIDATED TRIPLETS is parked just past
       the mouth of the belt, and an edge leaving from the centre came out from
       underneath the words. */
    if(which==="tail") return P(M.x1, M.cy+FL/2, M.base);
    /* the far rail at the middle arch: where a whitelist actually feeds */
    if(which==="mid")  return P(M.x0+(M.A.gx[1]-M.A.x0)*M.K, M.cy-FL/2, M.base);
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
  /* A BALL. It was stretched into a pill along world y for a while and is not
     any more — the pool is a population, not a shape with an axis, and giving
     it one implied an ordering along the molecule's own direction that a bag of
     unsorted reads does not have.

     The machinery that made the pill is gone rather than set to 1: the stretch
     was applied AFTER the turn, which meant the depth key had to be taken after
     it too, and a spare multiply left in the hot loop is a spare thing to get
     wrong the next time this is edited. */
  const RB=n.w*0.70;                      /* the ball's radius, world units */
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
         which is the same key everything else on the page is sorted by. */
      const a=x1*RB, b=y2*RB, c=z2*RB;
      const dep=Math.max(0,Math.min(1,((a+b)/(RB*2)+1)/2));
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

/* a box laid ACROSS the belt: long in y, thin in x. setBox's twin — same three
   faces, same roles, transposed. */
function setBoxY(nd,xc,w,ya,yb,z0,z1,op){
  const xl=xc-w/2, xr=xc+w/2, y0=Math.min(ya,yb), y1=Math.max(ya,yb);
  nd.top .setAttribute("points",pts([P(xl,y0,z1),P(xr,y0,z1),P(xr,y1,z1),P(xl,y1,z1)]));
  nd.near.setAttribute("points",pts([P(xl,y1,z1),P(xr,y1,z1),P(xr,y1,z0),P(xl,y1,z0)]));
  nd.end .setAttribute("points",pts([P(xr,y0,z1),P(xr,y1,z1),P(xr,y1,z0),P(xr,y0,z0)]));
  ["top","near","end"].forEach(k=>{
    nd[k].setAttribute("fill-opacity",op);
    nd[k].setAttribute("stroke-opacity",((k==="top"?0.42:0.28)*op).toFixed(3));
  });
}

function drawBelts(g,n){
  hitBox(g,n);
  const rnd=mulberry32(0x5eedf15^0x53);

  /* ONE BELT, AND THE GENE LIES ACROSS IT — the same turn E3 just made, for
     the same reason and with the opposite subject.

     At E3 the molecule lay broadside so three scanners could each read a
     different part of it. Here the molecule lands broadside so its cDNA half
     can lie ALONG a gene: the read's orange end is the part being placed, and
     laying the gene across the belt is what gives that end somewhere to be
     placed. Four belts of models running down-track could only ever show reads
     landing ON something; one gene turned across the track shows reads landing
     SOMEWHERE ON it, which is the whole of what an aligner decides.

     AND THE BARCODE END DOES NOT LAND. It has no genome to match — it is a
     synthetic tag, and the aligner has nothing to do with it — so it lifts off
     the surface and rides at an angle, still attached, still visible, doing
     nothing. That is the honest picture of a 3' read: two thirds of the
     molecule is the reason it can be counted and none of it aligns. */
  const x0=n.x-n.w/2, x1=n.x+n.w/2, span=x1-x0, cy=n.y;
  const K=span/9.2, KZ=n.h/0.53;              /* the original's own units */
  const base=n.h*0.245, geneH=n.h*0.19, exonH=n.h*0.565;
  const GL=n.d*0.70;                          /* the gene, across the belt */
  const BW=GL+K*1.0;                          /* the belt, a shade wider than its load */
  const GW=K*0.30;                            /* a gene's thickness along the belt */
  const RW=GW*0.40;                           /* and a read's */
  const v=(n.v||1.05)*K;
  const NG=10, PAD=7*K, LOOP=span+PAD*2;
  const yOf=f=>cy+GL/2-f*GL;                  /* f=0 at +y, the gene's near end */

  /* the read, in the same base pairs as everywhere else, as a fraction of the
     gene it lands on: 64 of cDNA that aligns, then 32 of unsequenced middle and
     58 of barcode that do not */
  const RTOT=0.145, RL=RTOT*64/154, RG=RTOT*32/154, RB=RTOT*58/154;
  /* THE LIFT IS SMALL ON PURPOSE. At 1.55 x n.h the blue tails stood up like
     flags and the gene disappeared under a hedge of them — which inverted the
     station: the subject here is where the ORANGE lands. The tail has to be
     visibly off the surface and visibly not aligned, and nothing more than
     that. */
  const LIFT=n.h*0.52;

  /* ---- the belt: scenery, and it should read as scenery ------------------ */
  g.appendChild(el("polygon",{points:pts([P(x0,cy-BW/2,base),P(x1,cy-BW/2,base),
    P(x1,cy+BW/2,base),P(x0,cy+BW/2,base)]),
    fill:"var(--t-right)","fill-opacity":".55",stroke:"var(--stroke)",
    "stroke-width":"0.9","stroke-opacity":".11"}));
  g.appendChild(el("polygon",{points:pts([P(x0,cy+BW/2,base),P(x1,cy+BW/2,base),
    P(x1,cy+BW/2,0),P(x0,cy+BW/2,0)]),
    fill:"var(--t-right)","fill-opacity":".7",stroke:"var(--stroke)",
    "stroke-width":"0.9","stroke-opacity":".11"}));
  const NSL=34, slats=[];
  for(let k=0;k<NSL;k++)
    slats.push(g.appendChild(el("line",{stroke:"var(--stroke)",
      "stroke-width":"1","stroke-opacity":".09"})));

  /* ---- the genes, and the reads that land on them ------------------------ */
  const genes=[];
  for(let i=0;i<NG;i++){
    const ggrp=g.appendChild(el("g"));
    /* more exons and smaller ones than the down-track version had: a read is
       0.145 of the gene now, and an exon has to have somewhere to put two or
       three of them */
    const ex=[]; let f=0.015+rnd()*0.025;
    while(f<0.95){
      const w=0.055+rnd()*0.085;
      if(f+w>0.965) break;
      ex.push([f,f+w]); f+=w+0.035+rnd()*0.055;
    }
    const gn={grp:ggrp, pos:0, ex,
      body:boxNodes(ggrp,"var(--t-left)","var(--t-right)",0.8),
      exons:ex.map(()=>boxNodes(ggrp,"var(--k-top)","var(--k-left)",1.0)),
      reads:[]};
    /* MORE OF THEM THAN THE BELT BEFORE THIS ONE DELIVERS, on purpose. Every
       fragment that clears the whitelists arrives here, and the pile-up on one
       gene is the point: a read is one observation and a gene model covered in
       them is a count. */
    const NR=11+Math.floor(rnd()*5);
    for(let k=0;k<NR;k++){
      const e=ex[Math.floor(rnd()*ex.length)];
      const lo=e[0]+0.004, hi=Math.max(lo,e[1]-RL-0.004);
      gn.reads.push({f:lo+rnd()*(hi-lo),
        dx:(rnd()-0.5)*GW*1.7,
        u0:0.17+rnd()*0.11,                   /* lands in the first third */
        fx0:(4.6+rnd()*3.2)*K,                /* in from a long way up-belt */
        fz:(2.2+rnd()*1.4)*KZ,                /* a slant, not a vertical drop */
        cd:ggrp.appendChild(el("polygon",{fill:"var(--cull)","fill-opacity":"0",
          stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":"0"})),
        ad:ggrp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
          "stroke-opacity":"0","stroke-dasharray":"2.2 2.2","stroke-linecap":"butt"})),
        bc:ggrp.appendChild(el("polygon",{fill:"var(--accent)","fill-opacity":"0",
          stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":"0"}))});
    }
    genes.push(gn);
  }

  const quadY=(node,xc,w,ya,za,yb,zb,op)=>{
    node.setAttribute("points",pts([P(xc-w/2,ya,za),P(xc+w/2,ya,za),
                                    P(xc+w/2,yb,zb),P(xc-w/2,yb,zb)]));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
    node.setAttribute("stroke-opacity",(clamp01(op)*0.45).toFixed(3));
  };
  const seg=(node,xa,ya,za,xb,yb,zb,op)=>{
    const a=P(xa,ya,za), b=P(xb,yb,zb);
    node.setAttribute("x1",a[0].toFixed(1)); node.setAttribute("y1",a[1].toFixed(1));
    node.setAttribute("x2",b[0].toFixed(1)); node.setAttribute("y2",b[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
  };

  let t=0;
  const run=dt=>{
    t+=dt;
    const scroll=((t*v)%(span/NSL*2)+span/NSL*2)%(span/NSL*2);
    slats.forEach((ln,k)=>{
      const sx=x0+((k*(span/NSL*2)+scroll)%span);
      const a=P(sx,cy-BW/2,base), b=P(sx,cy+BW/2,base);
      ln.setAttribute("x1",a[0].toFixed(1)); ln.setAttribute("y1",a[1].toFixed(1));
      ln.setAttribute("x2",b[0].toFixed(1)); ln.setAttribute("y2",b[1].toFixed(1));
    });

    genes.forEach((gn,i)=>{
      const u=((t*v/LOOP+i/NG)%1+1)%1;
      const gxp=x0-PAD+u*LOOP;
      gn.pos=gxp;
      const vis=Math.min(sstep(x0-K*0.4,x0+K*0.5,gxp),1-sstep(x1-K*0.9,x1-K*0.1,gxp));
      const exTop=base+exonH;

      /* THE BODY HAS TO CARRY, or the gene reads as a staircase of unrelated
         blocks rather than as one model with exons standing proud of it. It is
         the thing that says these blocks belong to each other. */
      setBoxY(gn.body,gxp,GW*0.58,yOf(0),yOf(1),base,base+geneH,(vis*0.80).toFixed(3));
      gn.ex.forEach((e,k)=>
        setBoxY(gn.exons[k],gxp,GW,yOf(e[0]),yOf(e[1]),base,exTop,(vis*0.42).toFixed(3)));

      for(const rd of gn.reads){
        const kk=clamp01((u-(rd.u0-0.17))/0.17);
        const air=Math.pow(1-kk,1.7);
        const rx=gxp+rd.dx-rd.fx0*air, z0=exTop+rd.fz*air;
        const op=vis*(1-0.25*air);
        const ya=yOf(rd.f), yb=yOf(rd.f+RL);
        const yc2=yOf(rd.f+RL+RG), yd=yOf(rd.f+RL+RG+RB);
        /* the cDNA lies flat on the exon — the only part of this molecule the
           aligner has anything to say about */
        quadY(rd.cd,rx,RW,ya,z0,yb,z0,op*0.95);
        /* and everything past it lifts away from the surface */
        seg(rd.ad,rx,yb,z0,rx,yc2,z0+LIFT*0.40,op*0.65);
        quadY(rd.bc,rx,RW*0.75,yc2,z0+LIFT*0.40,yd,z0+LIFT,op*0.88);
      }
    });
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
  /* ONE TRACK, AND WHAT TRAVELS IT IS THE MOLECULE FROM E2, EDGE FIRST.

     The eight merging lanes are gone. They drew a funnel, and a funnel is what
     this station is not: nothing is being combined here, each fragment is
     simply asked three questions in turn. One belt says that; eight lanes
     narrowing to one said something else, and said it three times.

     THE FRAGMENT LIES ACROSS THE BELT. Its long axis is world y and it travels
     in world x, so the whole molecule — cDNA, the dotted middle, the three
     barcodes with their linkers, the UMI — presents itself broadside to every
     scanner it passes under. Which is the truth of the operation: all three
     barcodes are on one read and every gantry can see all of them. What makes
     gantry i a different question from gantry j is WHICH ONE IT CHECKS, and
     because the barcodes sit at different y the three verdicts land at three
     different places on the same object. That is the whole reason for turning
     it: travelling lengthwise, the three checks stacked on one point.

     gz/pgap are the gantry: how high the beam rides and how far the scanner
     face sits above it. They are here rather than inline because NATZ is built
     from them. IN, PAD and LANDX are the approach: the track starts at IN, a
     fragment is born at PAD, and it touches down at LANDX. FLEN is the
     molecule's length across the belt.

     THE SCANNER IS NOT AS WIDE AS THE BELT, AND THAT IS THE POINT. It used to
     be an arch spanning FLEN plus a margin each side, on two legs, with a
     cross-beam under the face. But this station reads R2 and nothing else: the
     cDNA half of the molecule has no business here and no scanner is pointed at
     it. So the face covers the R2 block alone — the three barcodes and the UMI,
     bp 96 to 154 — and it is cantilevered from a SINGLE pillar at its far tip,
     out past the UMI end where the whitelist plates are. TIP is how far past
     that end the face runs before the pillar takes it; LIP is how far back over
     the unsequenced middle it laps, so the near edge covers bc1 rather than
     stopping exactly on it. */
  {x0:0, x1:19.4, cy:-3.0, base:0.14, gx:[3.4,7.4,11.4], MZ:3.0, REJ:5.0,
   binX:17.4, v:2.6, VALX:18.9,
   gz:0.66, pgap:0.40, IN:-3.0, PAD:-7.4, LANDX:-2.5, TRK:2.8,
   FLEN:5.0, TIP:0.55, LIP:0.22, THK:0.34},
][0];

/* THE SAME MOLECULE AS E2, IN THE SAME UNITS: base pairs, cDNA end first.
   FRAG itself cannot be reused — it carries screen-space widths and labels for
   a diagram square to the reader — but the numbers are the same measured
   numbers, so they are written once more rather than approximated into a
   decoration. 154 bp end to end; see FRAG at the top of this file. */
const YARD_MOL=[
  {k:"cdna", bp:64}, {k:"gap", bp:32},
  {k:"bc1", bp:8}, {k:"l1", bp:12},
  {k:"bc2", bp:8}, {k:"l2", bp:12},
  {k:"bc3", bp:8}, {k:"umi", bp:10},
];
const YARD_MOL_BP=154;

/* the handful of numbers both drawSortingYard and PORTS.sortingyard need */
function yardMetrics(n){
  const A=YARD_ROUNDS, K=n.w/(A.x1-A.x0), KZ=n.h/(A.base+A.gz+A.pgap+0.07);
  return {A,K,KZ, x0:n.x-n.w/2, x1:n.x+n.w/2, cy:n.y+A.cy*K, base:A.base*KZ};
}

function drawSortingYard(g,n){
  hitBox(g,n);
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

  const M=yardMetrics(n), A=M.A, K=M.K, KZ=M.KZ;
  const SC=q=>q*K;
  const x0=M.x0, x1=M.x1;
  const XX=q=>x0+(q-A.x0)*K;                   /* authored x -> world x */
  const cy=M.cy, base=M.base;
  const REJ=n.y+SC(A.REJ), binX=XX(A.binX), VALX=XX(A.VALX);
  const gx=A.gx.map(XX), MZ=SC(A.MZ), v=A.v*K;
  const FL=SC(A.FLEN), THK=SC(A.THK);

  const DECK={top:"var(--t-top)",left:"var(--t-left)",right:"var(--t-right)"};
  const GAN ={top:"var(--k-top)",left:"var(--k-left)",right:"var(--k-right)"};
  const BIN ={top:"var(--rej)",left:"var(--rej)",right:"var(--rej)"};
  const R1T="var(--cull)", R2T="var(--accent)";

  /* ---- where each part of the molecule sits ACROSS the belt ---------------
     bp 0 is the outer cDNA end and it lies at +y, the near side; the UMI end is
     at -y, the far side, which is the side the whitelists are on. So the three
     barcodes face the plates that judge them. */
  const uBP=FL/YARD_MOL_BP;
  const cuts=[]; { let a=0; for(const q of YARD_MOL){ cuts.push([a,a+q.bp,q.k]); a+=q.bp; } }
  const yBP=(yc,bp)=>yc+FL/2-bp*uBP;
  const segAt=k=>cuts.find(c=>c[2]===k);
  const BCBP=["bc1","bc2","bc3"].map(k=>{const c=segAt(k); return (c[0]+c[1])/2;});

  /* ---- THE R2 BLOCK, which is the only part of the molecule this station
     looks at. bp 96 (the start of bc1) to bp 154 (the end of the UMI) — the
     blue stretch, and every scanner face, light curtain and beam on this belt
     is measured off it rather than off the belt's own width. SCN_F is the far
     tip, at -y, up-right, on the side the whitelist plates are; SCN_N is the
     near edge, lapping a little way back over the unsequenced middle. */
  const R2A=segAt("bc1")[0], R2B=segAt("umi")[1];
  const SCN_F=yBP(cy,R2B)-SC(A.TIP), SCN_N=yBP(cy,R2A)+SC(A.LIP);
  const SCN_MID=(SCN_F+SCN_N)/2, SCN_LEN=SCN_N-SCN_F;

  /* ---- the deck, almost not there --------------------------------------- */
  const dTop=cy-FL/2-SC(0.9), dBot=REJ+FL/2+SC(0.9);
  const xIn=XX(A.IN);
  slabAt(g,(xIn+x1)/2,(dTop+dBot)/2,x1-xIn,dBot-dTop,base,DECK,0,0.10);

  /* ---- ONE BELT, and the three sidings that leave it --------------------- */
  const guide=(fn,op,w,xa,xb)=>{
    const p=[];
    for(let i=0;i<=90;i++){ const x=xa+((xb-xa)*i)/90; p.push(P(x,fn(x),base)); }
    g.appendChild(el("polyline",{points:pts(p),fill:"none",stroke:"var(--fg3)",
      "stroke-width":w,"stroke-opacity":op,"stroke-linecap":"round"}));
  };
  /* the belt is drawn as its two rails plus a centre line, so that a thing
     lying ACROSS it reads as being on something rather than floating over a
     single stripe */
  [-FL/2,0,FL/2].forEach((off,i)=>
    guide(()=>cy+off, i===1?0.14:0.42, i===1?"1.1":"1.8", xIn, x1));
  const rejY=(x,i)=>cy+(REJ-cy)*sstep(gx[i]+SC(0.9),gx[i]+MZ,x);
  for(let i=0;i<3;i++) guide(x=>rejY(x,i),0.18,"1.2",gx[i],binX);

  /* ---- SLATS, so the belt is a belt ------------------------------------
     Two rails and a centre line draw a track; what makes it a conveyor is that
     the surface moves. The slats scroll at exactly the speed the fragments
     travel, which is the claim: nothing here is pulled along by anything of its
     own, the floor is carrying it. Built before the fragments, so they ride on
     top of it. */
  const SLAT_P=SC(0.62), SLAT_RUN=x1-xIn, NSLAT=Math.ceil(SLAT_RUN/SLAT_P)+1;
  const slats=[];
  for(let k=0;k<NSLAT;k++)
    slats.push(g.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
      "stroke-opacity":"0.30","stroke-linecap":"butt"})));

  /* ---- the fragments ----------------------------------------------------- */
  /* WHO FAILS IS NOT A COIN FLIP, IT IS THE FIGURE.

     A per-fragment random draw gave whatever it gave: at NF=12 and p=0.30 this
     seed's first twelve draws all came up pass, so the reject siding ran empty
     and the bin was scenery. Worse, it would have been a different picture at a
     different NF — an aggregate that changes when you re-space the belt is not
     saying anything.

     3 of 12 is 25%, against the worked example's measured 24.3% of reads
     carrying no valid barcode combination. The three are spread down the belt
     so they do not clump, and they fail at three DIFFERENT rounds, so every
     gantry is seen to reject somebody and none of them is decoration. */
  const FAILAT={2:0, 6:2, 9:1};
  const zR=base+0.05*KZ, NF=12, frags=[];
  for(let i=0;i<NF;i++){
    const grp=g.appendChild(el("g"));
    const poly=fill=>grp.appendChild(el("polygon",{fill,stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".45","fill-opacity":"0"}));
    frags.push({ph:i/NF, fail:FAILAT[i]===undefined?-1:FAILAT[i], grp,
      /* build order IS paint order: backbone, then what sits on it */
      bone:grp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
        "stroke-opacity":"0","stroke-linecap":"round"})),
      mid:grp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.3",
        "stroke-opacity":"0","stroke-dasharray":"2.6 2.6","stroke-linecap":"butt"})),
      cdna:poly(R1T),
      bc:[poly(R2T),poly(R2T),poly(R2T)],
      umi:grp.appendChild(el("polygon",{fill:R2T,"fill-opacity":"0",
        stroke:R2T,"stroke-width":"1.2","stroke-opacity":"0"})),
      flash:[-99,-99,-99], px:undefined});
  }

  /* ---- verdict marks: after the fragments, BEFORE the gantries, so a tick
     rides above its block and still passes under the scanner ---- */
  const TICK="M -4.2 0.4 L -1.4 3.4 L 4.6 -4.2";
  const CROSS="M -3.8 -3.8 L 3.8 3.8 M 3.8 -3.8 L -3.8 3.8";
  frags.forEach(fr=>{
    fr.marks=[0,1,2].map(i=>g.appendChild(el("path",{
      d:fr.fail===i?CROSS:TICK, fill:"none",
      stroke:fr.fail===i?"var(--rej)":"var(--ok)",
      "stroke-width":"2.0","stroke-linecap":"round","stroke-linejoin":"round",
      "stroke-opacity":"0"})));
  });

  /* ---- three identical scanners, each over the R2 block and nothing else --- */
  const gz=A.gz*KZ, panelZ=gz+A.pgap*KZ;
  const PANW=SC(0.72);                 /* half of what it was, along the belt */
  const stations=gx.map((sx,i)=>{
    const grp=g.appendChild(el("g"));
    /* ONE PILLAR, AT THE FAR TIP, AND IT GOES ALL THE WAY UP TO THE FACE.
       Two legs and a cross-beam under the panel drew a gantry standing over the
       whole belt, which is a claim about what is being read: everything that
       passes beneath it. It is not — the cDNA half goes under nothing. So the
       second leg is gone, the beam under the face is gone (it was a solid
       repeating the panel's own outline one step lower), and what is left is a
       single post out past the UMI end carrying a face that reaches back over
       the barcodes. It stands on the side the whitelist plates are on, which is
       where the answer comes from. Its top is flush with the panel's underside,
       so the post carries the face rather than stopping short of it. */
    slabAt(grp,sx,SCN_F+SC(0.09),SC(0.18),SC(0.18),panelZ,GAN,base);
    /* THE LIGHT CURTAIN — a plane hanging from the scanner face to the deck.
       It is what makes the scanner a scanner rather than a shelf: a shelf has a
       top and nothing underneath it. It spans the face, so it now falls across
       the R2 block alone and the cDNA end passes through open air. Built before
       the panel so the panel's own face paints over the top edge of it. */
    grp.appendChild(el("polygon",{fill:"var(--fg)","fill-opacity":"0.035",stroke:"none",
      points:pts([P(sx,SCN_F,base+panelZ),P(sx,SCN_N,base+panelZ),
                  P(sx,SCN_N,base),P(sx,SCN_F,base)])}));
    /* AND THE PANEL IS TRANSLUCENT. Opaque and 1.45 wide it was a bench top: it
       hid the fragment for a long stretch of belt, and the one moment this
       station exists to show happened underneath it. Half as wide and see
       through, and the read happens in view. */
    slabAt(grp,sx,SCN_MID,PANW,SCN_LEN,0.07*KZ,GAN,base+panelZ,0.62);
    const slots=[];
    for(let c=0;c<14;c++){
      const px=sx-PANW*0.42+(c/13)*PANW*0.84, hw=SCN_LEN/2-SC(0.16);
      const a=P(px,SCN_MID-hw,base+panelZ+0.075*KZ), b=P(px,SCN_MID+hw,base+panelZ+0.075*KZ);
      slots.push({node:grp.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
        x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg)",
        "stroke-width":"1.7","stroke-opacity":"0.07"})),lit:-99});
    }
    return {sx,i,slots,ptr:0,sw:-1,swY:cy};
  });

  /* ---- THE SCAN ITSELF, built after the arches so it reads as light ------
     A beam dropped from the scanner face to the deck, sweeping ALONG the
     fragment as it passes under — which is what a barcode reader does, and what
     the old slot-flicker only implied. It travels the R2 block, bc1 out to the
     UMI, so the sweep and the thing being swept are the same object seen twice.

     IT USED TO TRAVEL THE WHOLE MOLECULE, cDNA end to UMI end, and that was the
     face's fault rather than the beam's: a scanner spanning the belt has to be
     shown reading across the belt. With the face over R2 alone the beam has
     exactly R2 to sweep, and it can no longer be seen reading a stretch of cDNA
     that nothing at this station has an opinion about. */
  stations.forEach(st=>{
    st.beam=g.appendChild(el("line",{stroke:"var(--fg)","stroke-width":"1.5",
      "stroke-opacity":"0","stroke-linecap":"round"}));
    st.spot=g.appendChild(el("ellipse",{fill:"var(--fg)","fill-opacity":"0",
      rx:(SC(0.34)*S*C30).toFixed(1), ry:(SC(0.34)*S*0.30).toFixed(1)}));
  });

  /* ---- the bin, built last and opaque, and AS WIDE AS THE BELT ------------
     A cube would have been narrower than the thing going into it, so a
     rejected fragment would have stuck out either side of it and never gone
     away. It is a hopper across the siding instead. */
  const BINX=SC(1.6), BINY=FL+SC(0.9);
  slabAt(g,binX,REJ,BINX,BINY,0.62*KZ,BIN,base);

  /* ---- names ------------------------------------------------------------- */
  const lab=(wx,wy,wz,str,size,fill,op,rot,anchor,dy)=>{
    const a=P(wx,wy,wz);
    const t=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(${rot})`,
      "text-anchor":anchor||"start","font-family":MONO,fill,"font-size":size,
      "font-weight":"600","letter-spacing":(size*0.10).toFixed(2),"fill-opacity":op});
    if(dy) t.setAttribute("y",dy);
    t.textContent=str; g.appendChild(t);
  };
  const FS=Math.max(6,13.5*K);
  /* THE ROUND IS THE NAME AND THE REST IS THE NOUN. "BC1 WHITELIST" set as one
     string made the three arches read as three instances of one label with a
     digit buried in it; what a reader needs at a glance is WHICH ROUND. BC1 goes
     to twice the size and WHITELIST drops underneath — the same two-line
     treatment every other named thing on this map gets. */
  /* AND THE NAME IS CENTRED ON THE FACE'S OWN TIP EDGE. Anchored start and
     nudged off a corner, it was a label parked beside a wide arch and it read
     as one; the face is now a short cantilever and it has an end, so the name
     sits square over that end. Both edges of the face at constant y run at +30
     on screen, which is the angle the two lines are already set at, so a middle
     anchor at the scanner's own x puts the centre of the text on the centre of
     the tip edge and the two run parallel. Offsetting in -y — up and to the
     right — carries it clear of the panel without moving it off that line. */
  stations.forEach((st,i)=>{
    const lx=st.sx, ly=SCN_F-SC(0.95), lz=base+panelZ+0.07*KZ;
    lab(lx,ly,lz, `BC${i+1}`, (FS*2).toFixed(1), "var(--fg)", "1", 30, "middle");
    /* dy is measured from BC1's baseline and BC1 is twice the size, so the
       1.35 that works under a normal name puts WHITELIST inside the big
       glyph's box — 23% overlap, which check-text caught. */
    lab(lx,ly,lz, "WHITELIST", FS.toFixed(1), "var(--fg2)", ".85", 30, "middle",
        (FS*1.85).toFixed(1));
  });
  lab(binX-SC(0.75), REJ+FL/2+SC(1.55), base, "NO MATCH",
      (FS*1.25).toFixed(1), "var(--rej)", "1", 30);
  /* PAST THE MOUTH OF THE BELT, not alongside it. Between the near rail and the
     reject siding there are 1.4 authored units and the siding's own fragments
     use most of them; the clear ground is beyond the end, which is also where
     the thing being named actually goes.

     AND OFF THE FAR RAIL, because the track out of this station leaves from the
     NEAR one. On the belt's centre line the two were parallel and on top of each
     other, and the orange line read as something coming out of the words. */
  const VLY=cy-FL/2-SC(0.35);
  lab(x1+SC(0.6), VLY, base, "VALIDATED TRIPLETS",
      (FS*1.1).toFixed(1), "var(--ok)", "1", -30);
  lab(x1+SC(0.6), VLY, base, "putative cell barcodes",
      (FS*0.92).toFixed(1), "var(--fg3)", ".9", -30, "start", (FS*1.33).toFixed(1));

  /* ---- one lap ----------------------------------------------------------- */
  const PAD=-SC(A.PAD), LOOP=(x1-x0)+PAD*2;
  const LANDX=XX(A.LANDX), FALLX=SC(4.0), FALLZ=2.6*KZ;

  /* a bar lying across the belt: fixed thickness in x, spanning ya..yb in y */
  const bar=(node,xc,ya,yb,zz,op,hw)=>{
    const h=hw===undefined?THK/2:hw;
    node.setAttribute("points",pts([P(xc-h,ya,zz),P(xc+h,ya,zz),
      P(xc+h,yb,zz),P(xc-h,yb,zz)]));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
    node.setAttribute("stroke-opacity",(clamp01(op)*0.5).toFixed(3));
  };
  const rail=(node,xc,ya,yb,zz,op)=>{
    const a=P(xc,ya,zz), b=P(xc,yb,zz);
    node.setAttribute("x1",a[0].toFixed(1)); node.setAttribute("y1",a[1].toFixed(1));
    node.setAttribute("x2",b[0].toFixed(1)); node.setAttribute("y2",b[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
  };

  /* ---- THE SWEEP AND THE VERDICT ARE ONE EVENT ---------------------------
     The mark used to fire at a fixed point past the panel's downstream edge
     while the beam ran on its own clock, so the tick and the moment the beam
     crossed the block it is about were two different instants — the drawing
     said "read here, answered there" and meant "read, and answered, here".

     Now the beam's position IS the clock. It sweeps the R2 block once per pass,
     bc1 first because bc1 is the block nearest the belt's near rail, and each
     station fires the moment the beam crosses the barcode THAT station checks.
     So FIREAT[i] is not a constant offset: it is where the sweep has got to
     when it reaches barcode i, and station i answers there and nowhere else.

     The window is deliberately lopsided — a little upstream of the face, a good
     deal downstream — so that every one of the three crossings lands at or past
     the arch and none of them lands after the reject siding has begun to peel
     away at gx + 0.9. Read on the way through, answered on the block. */
  const SW_IN=SC(0.35), SW_OUT=SC(1.25), SW_W=SW_IN+SW_OUT;
  const FIREAT=BCBP.map(bp=>-SW_IN+((bp-R2A)/(R2B-R2A))*SW_W);
  let t=0;
  const run=dt=>{
    t+=dt;
    for(const st of stations) st.sw=-1;
    for(const fr of frags){
      const u=((t*v/LOOP+fr.ph)%1+1)%1;
      const fx=x0-PAD+u*LOOP;
      if(fr.px!==undefined && fx<fr.px) fr.flash=[-99,-99,-99];

      /* the descent, exactly as before: it is the fragment that falls */
      const air=Math.pow(1-clamp01((fx-(x0-PAD))/(LANDX-(x0-PAD))),1.6);
      const zAir=FALLZ*air, xAir=-FALLX*air, cx=fx+xAir, cz=zR+zAir;
      const yc=fr.fail<0?cy:rejY(fx,fr.fail);   /* the siding starts after the arch */

      let vis=Math.min(sstep(x0-PAD,x0-PAD+SC(0.4),fx),1-sstep(x1-SC(0.8),x1+SC(0.2),fx));
      /* swallowed while wholly inside the hopper's silhouette */
      if(fr.fail>=0) vis*=1-sstep(binX-BINX*0.42,binX-BINX*0.30,fx);

      /* the backbone runs the length of the barcode block; the middle is a
         dotted line because there is nothing in it to draw */
      const gapS=segAt("gap"), bcS=segAt("bc1"), umiS=segAt("umi");
      rail(fr.bone,cx,yBP(yc,bcS[0]),yBP(yc,umiS[1]),cz,vis*0.30);
      rail(fr.mid ,cx,yBP(yc,gapS[0]),yBP(yc,gapS[1]),cz,vis*0.45);

      /* the cDNA is two fifths of the molecule and it is not what this station
         is about. Drawn at full strength it was the loudest thing on the belt
         and the barcodes read as trim on the end of an orange bar — so it is
         held back, present and in proportion but not the subject. */
      const cd=segAt("cdna");
      bar(fr.cdna,cx,yBP(yc,cd[0]),yBP(yc,cd[1]),cz,vis*0.55);

      fr.bc.forEach((node,i)=>{
        const c=segAt(`bc${i+1}`);
        const reachable=fr.fail<0||i<=fr.fail;
        const scanned=fx>gx[i]+FIREAT[i]&&reachable;
        const bad=fr.fail===i&&scanned;
        const fl=Math.max(0,1-(t-fr.flash[i])/0.38);
        node.setAttribute("fill",bad?"var(--rej)":R2T);
        bar(node,cx,yBP(yc,c[0]),yBP(yc,c[1]),cz,
            vis*(bad?0.78:scanned?0.95:0.50)*(1+fl*0.30));
      });
      bar(fr.umi,cx,yBP(yc,umiS[0]),yBP(yc,umiS[1]),cz,0);
      fr.umi.setAttribute("fill-opacity",(clamp01(vis*0.16)).toFixed(3));
      fr.umi.setAttribute("stroke-opacity",(clamp01(vis*0.8)).toFixed(3));

      /* THE VERDICT FIRES WHERE THE BEAM CROSSES THE BLOCK IT IS ABOUT. The
         mark is built before the gantries, so it passes under the scanner and
         the face is see-through: a tick struck beneath the panel is read
         through the glass, which is what the panel was narrowed and thinned
         for. See FIREAT above for why each station's offset differs. */
      stations.forEach((st,i)=>{
        const prev=fr.px===undefined?fx:fr.px;
        const stillOnLine=fr.fail<0||i<=fr.fail;
        if(prev<=st.sx+FIREAT[i] && fx>st.sx+FIREAT[i] && stillOnLine){
          fr.flash[i]=t;
          if(fr.fail!==i){ st.slots[st.ptr%st.slots.length].lit=t; st.ptr++; }
        }
      });

      /* EVERY VERDICT HOLDS, ALL THE WAY OUT. There is no summarising check at
         the end any more: three ticks earned one at a time and still riding at
         the far edge of the yard say more than one big one that replaces them,
         because they say WHICH three, and they stay attached to the blocks they
         are about. */
      fr.marks.forEach((mk,i)=>{
        const age=t-fr.flash[i];
        if(fr.flash[i]<0||age<0){ mk.setAttribute("stroke-opacity","0"); return; }
        const a=P(cx,yBP(yc,BCBP[i]),cz+0.5*KZ);
        const pop=age<0.11?0.55+1.0*(age/0.11):1.15-0.15*Math.min(1,(age-0.11)/0.14);
        const op=(age<0.08?age/0.08:1);
        mk.setAttribute("transform",
          `translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) scale(${pop.toFixed(2)})`);
        mk.setAttribute("stroke-opacity",(op*vis*0.9).toFixed(3));
      });
      stations.forEach((st,i)=>{
        if(vis>0.5 && (fr.fail<0||i<=fr.fail) && fx>st.sx-SW_IN && fx<st.sx+SW_OUT){
          st.sw=(fx-(st.sx-SW_IN))/SW_W; st.swY=yc;
        }
      });
      fr.px=fx;
    }

    for(const st of stations){
      if(st.sw<0){ st.beam.setAttribute("stroke-opacity","0");
                   st.spot.setAttribute("fill-opacity","0"); continue; }
      /* the beam lands ON the R2 block, in the block's own base pairs */
      const yb=yBP(st.swY, R2A+(R2B-R2A)*st.sw);
      const a=P(st.sx,yb,base+panelZ), b=P(st.sx,yb,base);
      st.beam.setAttribute("x1",a[0].toFixed(1)); st.beam.setAttribute("y1",a[1].toFixed(1));
      st.beam.setAttribute("x2",b[0].toFixed(1)); st.beam.setAttribute("y2",b[1].toFixed(1));
      /* fades in and out over the pass rather than snapping on */
      const k=Math.sin(Math.PI*clamp01(st.sw));
      st.beam.setAttribute("stroke-opacity",(0.52*k).toFixed(3));
      st.spot.setAttribute("cx",b[0].toFixed(1)); st.spot.setAttribute("cy",b[1].toFixed(1));
      st.spot.setAttribute("fill-opacity",(0.38*k).toFixed(3));
    }
    const scroll=((t*v)%SLAT_P+SLAT_P)%SLAT_P;
    slats.forEach((ln,k)=>{
      const sx2=xIn+((k*SLAT_P+scroll)%SLAT_RUN);
      const a=P(sx2,cy-FL/2,base), b2=P(sx2,cy+FL/2,base);
      ln.setAttribute("x1",a[0].toFixed(1)); ln.setAttribute("y1",a[1].toFixed(1));
      ln.setAttribute("x2",b2[0].toFixed(1)); ln.setAttribute("y2",b2[1].toFixed(1));
    });
    for(const st of stations) for(const sl of st.slots){
      const age=t-sl.lit;
      sl.node.setAttribute("stroke-opacity",(age<0?0.06:0.06+0.85*Math.exp(-age/1.7)).toFixed(3));
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.sortingyard=drawSortingYard;
