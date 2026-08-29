/* ============================================================
   pipeline-fqshapes.js — row 3's vocabulary, ported from /FASTQ_pipe.

   THIS FILE IS A PORT, NOT AN ORIGINAL. Every shape below is
   public/FASTQ_pipe/fq-shapes.js, and the two are meant to stay diffable: the
   deep-dive page and row 3 of this map draw the same fourteen objects, and a
   shape that drifts on one of them is two accounts of one pipeline again.
   Regenerate rather than hand-edit where you can, and if you must edit here,
   make the same edit there.

   WHAT WAS REMOVED, AND WHY EACH REMOVAL IS SAFE. fq-shapes.js is a whole
   page's vocabulary and this map already has most of it. Ten top-level names
   collided; eight were the same thing twice and are simply gone from this copy:

     V           identical, both `n=>var(--n)`            -> pipeline-shapes.js
     SKIN        this map's is a SUPERSET; tile/anchor/works are identical
     topOf       this map's special-cases works/tankrack/machine and falls
                 through to n.h. No ported shape is any of those, so it
                 returns n.h for every one of them, which is what fq's did.
     DRAW        the registry object. Its `DRAW.x=` lines below still apply.
     drawTile    identical
     drawHeap    identical
     drawMatrix  identical, down to the sparsity seed
     mulberry32  same algorithm, same constants, same stream  -> culls-pop.js

   TWO WERE GENUINELY DIFFERENT AND ARE RENAMED RATHER THAN DROPPED, because
   taking this map's version would silently change the drawings:

     fqEaseOut -> fqEaseOut   1-(1-x)^2.2 here; culls-draw.js's is 1-(1-x)^3
     FQ_MONO    -> FQ_MONO     fq's stack puts JetBrains Mono and IBM Plex Mono
                            ahead of Menlo. Type metrics are what check-text
                            measures, so the ported shapes keep their own.

   drawRef is kept: it is fq's own, and this map has no DRAW.ref.

   LOAD ORDER MATTERS. This file must come after pipeline-shapes.js (for V,
   SKIN, topOf, DRAW, paint, faces, pts, ellipseAt) and after culls-draw.js
   (for roofFrame and mulberry32 via culls-pop.js), and before pipeline-data.js.
   ============================================================ */


/* ============================================================
   THE SAME SHAPES AT TWO SCALES, AND THE ORIGINAL IS THE DEFAULT.

   /FASTQ_pipe's proportions are hard-won and they are the reference. A node
   that says nothing is drawn EXACTLY as that page draws it — every helper
   below is the identity when a node carries no scale fields, and that is the
   property to preserve if any of this is edited.

   A node may then ask to be drawn smaller, and say by how much:

     n.fqs     its geometric size against /FASTQ_pipe. 1/2.4 means this node's
               w, d, h and gd were divided by 2.4 in the data file.
     n.tb      the TYPE BOOST. Scale a belt by 2.4 and the belt is right; scale
               a gene name by 2.4 and it is a smudge, and half of what these
               shapes are for is the writing on them. sqrt(2.4) makes type
               shrink by 1.55 where the drawing shrinks by 2.4.
     n.tracks  how many rails the E6 field carries (default 10, as /FASTQ_pipe)
     n.lanes   how many lanes go into the E7 fork  (default 10, as /FASTQ_pipe)

   The last two are density rather than size, and they are node properties
   rather than arithmetic on tb because that is what they are: a statement that
   THIS drawing carries fewer of them, at a size where thirty would be a smear.

   TYPEof IS THE ONE THAT MATTERS. It takes the absolute pixel floor and the
   K-derived size exactly as /FASTQ_pipe writes them, works out what that page
   would have drawn, and brings it down by the geometry but not all the way.
   Leaving an absolute floor alone is what made the first attempt at this
   unreadable: below a certain K the K-derived term falls under the floor, the
   floor wins, and the type comes out twice the size the layout was drawn for.
   ============================================================ */
const FQSof  = n => (n && n.fqs) || 1;      /* geometry, against /FASTQ_pipe */
const TBof   = n => (n && n.tb)  || 1;      /* type, against the same */
const TYPEof = (n,floor,size) => {
  const S = FQSof(n), B = TBof(n);
  return Math.max(floor, size/S) * S * B;
};

/* ---- THE ONE PROJECTION HELPER THIS MAP DID NOT ALREADY HAVE ------------
   roofFrame lives in culls-draw.js and ellipseAt in pipeline-shapes.js, and
   both are byte-identical to fq-iso.js's copies, so the port simply uses
   them. roofPanel is fq's own — roofFrame is square by construction and the
   four reference figures on this row are not — so it comes across here,
   beside its only four callers, rather than into pipeline-iso.js. */

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


/* A REFERENCE IS NOT A STATION, AND MUST NOT LOOK LIKE ONE. Same geometry, the
   other skin — SKIN.works. The genome and the whitelists are chosen rather than
   measured and built once rather than per run; a reference wearing the station
   skin undoes that at a glance. No new colour: the k-* face triple is one this
   map already carries. */
const drawRef=(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works,n.hatch);
DRAW.ref=drawRef;


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

const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

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
      "font-family":FQ_MONO,"letter-spacing":(size*0.02).toFixed(2),fill,
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
      "font-family":FQ_MONO,"letter-spacing":"1.4",fill:col,"font-weight":"600",
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
/* A LABEL'S OWN FRAME, BROUGHT BACK TO THE SCREEN. Every name on this map is a
   translate to a projected point followed by a rotate, so an offset expressed
   the way the text is set — along the line it reads on, and up or down from its
   baseline — comes back through the same rotation and nothing else. That is
   what lets an edge land on the TOP of a string rather than at the point the
   string was hung from. */
const ROT30=(p,dx,dy)=>[p[0]+dx*C30-dy*0.5, p[1]+dx*0.5+dy*C30];
const BCN=w=>{ const m=/^bc([123])$/.exec(w||""); return m?+m[1]-1:-1; };

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
  /* THE BELT HAS A SIDE, AND THE INDEX FEEDS INTO IT. A corner-to-corner edge
     between E4 and G3 is two points a unit apart — the index sits just off the
     machine's own footprint, so the nearest corners of the two are nearly the
     same place and the track came out as a stub nobody could see was a track.
     "feed" lands on the belt's NEAR rail, a quarter of the way along it, which
     is a run with room for a dot and is also where a thing being consumed by a
     machine goes: into its side, not at its corner. */
  /* ---- TWO NAMED EDGES, AND THEY ARE THE TWO A READER CAN POINT AT --------
     These footprints are rectangles in the ground plane, and under this
     projection two of their four edges are the ones anybody would name:

       "tr"  the edge at MIN y — up-and-to-the-right, the top-right edge
       "bl"  the edge at MAX y — down-and-to-the-left, the bottom-left edge

     Both are returned at their CENTRE. A corner is where two edges meet and it
     belongs to neither; roofCorner is the right answer when a line just has to
     leave from the side it is going, and the wrong one when the drawing is
     meant to say THIS edge feeds THAT edge. The reference chain says exactly
     that — assembly and annotation into the index, index into the aligner — so
     it is drawn edge to edge. */
  /* THE BELT'S OWN NEAR RAIL, not the footprint's: the rail is what a reader
     sees as the machine's bottom-left edge, and it is a good half unit inside
     the box the layout gave it. `K` is derived exactly the way drawGeneBelt
     derives it — off the DEPTH — because a port that computes the rail its own
     way lands on a rail that is not where the rail is, and that is how this
     went wrong once already. Both belts answer it, because both have one. */
  belts     :(n,which,B)=>beltRail(n,which)||roofCorner(n,B),
  assign    :(n,which,B)=>beltRail(n,which)||roofCorner(n,B),
  karyotype :(n,which,B)=>edgePort(n,which)||roofCorner(n,B),
  aligner   :(n,which,B)=>edgePort(n,which)||roofCorner(n,B),
  locus     :(n,which,B)=>edgePort(n,which)||roofCorner(n,B),
  /* AND A WHITELIST LEAVES FROM UNDER ITS OWN NAME. One line from the corner of
     this node said "the lists feed the yard" and left a reader to work out
     which list feeds which scanner — which is the only thing about this pair
     worth drawing, since the three rounds are three independent questions. So
     there are three lines, and each starts at the bottom of its own plate's
     name: centred on it across, clear of it below, including clear of BC1's
     second row. `two primers per well` belongs to that label, so the line
     starts under the block rather than through it. */
  /* AND THE INDEX LEAVES FROM THE CORNER THAT FACES THE MACHINE'S NEAR SIDE,
     which is not the corner nearest it. roofCorner picks by distance to the
     destination's CENTRE, and E4's centre is straight up the belt from here —
     so it chose the corner at low y, and the track then ran the length of the
     deck to reach a rail on the deck's near edge. The belt is opaque and paints
     after the edges, so every pixel of it was covered. Leaving from -x/+y puts
     the whole run on open ground outside the belt and arriving at its side. */
  starindex :(n,which,B)=>edgePort(n,which)||roofCorner(n,B),
  whitelists:(n,which,B)=>{
    const i=BCN(which);
    if(i<0) return roofCorner(n,B);
    const L=wlLayout(n), pl=L.plates[i], K=L.K, FIT=L.FIT;
    const rows=pl.R.perWell===2?2:1;
    return ROT30(P(pl.px-(pl.w+0.30*K)/2, L.y+(pl.d+0.30*K)/2+0.42*K, L.h),
                 14*K+(L.mainText(pl).length*L.CH*FIT)/2,
                 15*K+(rows-1)*17*K+FIT*1.55);
  },
  /* THE YARD'S OWN ENDS, AT DECK HEIGHT — not a roof corner, because it has no
     roof. "head" is where the eight lanes start, which is what an arriving read
     should be aimed at; "tail" is where the fan leaves. Anything else falls back
     to the corner, which is the right answer for W1 overhead. */
  sortingyard:(n,which,B)=>{
    const M=yardMetrics(n);
    /* AND IT ARRIVES AT THE TOP OF THE SCANNER'S OWN NAME. The three whitelist
       lines come down from up-right, which is the side a name's ascenders face,
       so the line stops where the reading starts and never crosses a letter.
       Landing on the station itself was tried and is worse: three lines into
       three small machines is three lines you have to trace, where three lines
       into three big words is a sentence. */
    const b=BCN(which);
    if(b>=0) return ROT30(P(M.gx[b],M.labY,M.labZ), 0, -M.FS*2.15);
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
function beltRail(n,which){
  if(which!=="bl") return null;
  const K=n.d*0.1053, GL=n.d*0.70, BW=GL+K*1.0;
  return P(n.x, n.y+BW/2, n.h*0.245);
}
function edgePort(n,which){
  if(which==="tr") return P(n.x, n.y-n.d/2, topOf(n));
  if(which==="bl") return P(n.x, n.y+n.d/2, topOf(n));
  return null;
}
/* THE MIDDLE OF WHICHEVER EDGE FACES THE OTHER OBJECT, and never a corner.

   roofCorner picks the nearest CORNER, which is the right answer for a
   reference line that only has to leave on the side it is going. It is the
   wrong answer for a track somebody drew between two things: a corner belongs
   to neither of the edges that meet at it, so a line leaving one reads as
   escaping the box rather than as coming out of a face. All four midpoints are
   candidates and the nearest wins, so which face is used follows from where the
   other object is and needs no bookkeeping. Used by the Connect tool for both
   ends of every link — see routeOf. */
function faceMid(n,B){
  const c=[[n.x,n.y-n.d/2],[n.x,n.y+n.d/2],[n.x-n.w/2,n.y],[n.x+n.w/2,n.y]];
  let best=c[0], bd=Infinity;
  for(const q of c){ const d=(q[0]-B.x)*(q[0]-B.x)+(q[1]-B.y)*(q[1]-B.y);
    if(d<bd){ bd=d; best=q; } }
  return P(best[0],best[1],topOf(n));
}
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
    "font-family":FQ_MONO,"font-weight":"700","letter-spacing":(size*0.03).toFixed(2),
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


/* ============================================================
   THE ALIGNER — the same twenty-five chromosomes, with reads on them.

   IT IS G1's FIGURE READ THE OTHER WAY ROUND. GRCz11's roof draws the assembly
   as an object: this is what there is. This one draws the same object as a
   RESULT: this is where read 1 ended up on it. Same layout, same lengths, same
   ideograms — because the point is that they are the same object, and a second
   arrangement of chromosomes would be a second genome.

   THE STRIPES ARE NOT MEASURED AND MUST NOT BE LABELLED AS IF THEY WERE. There
   is no per-read alignment record on this instance — see E4's own note — so
   what is drawn is the SHAPE of an alignment: marks scattered along the
   assembly, more of them than one, in the read colour, appearing one at a time
   because that is what an aligner does with a file of reads. Nothing here says
   how many, or where.
   ============================================================ */
function drawAligner(g,n){
  refBuilding(g,n);
  const F=roofPanel(g,n,n.h,176), {CW,CH,u}=F;
  const rnd=mulberry32(0x5eedf15^0xA7);
  const margin=5*u, slot=(CW-margin*2)/CHR_LAYOUT.length;
  const bw=Math.min(4.6*u, slot*0.60);
  const top=34*u, maxH=56*u, maxMb=Math.max(...CHR), waist=1.0*u;

  /* 12u, not the karyotype's 17u. "STAR Aligner" is twelve characters against
     GRCz11's seven, and at 17 it ran off the end of its own roof — a roof title
     is set to the WORD, not to a house style. */
  roofTitle(F,"STAR Aligner",margin,21*u,12*u);

  const hits=[];
  CHR_LAYOUT.forEach((ch,i)=>{
    const cx=margin+slot*(i+0.5), h=(ch.mb/maxMb)*maxH;
    const yc=top+h*ch.cen, x=cx-bw/2;
    const r=bw/2, sq=bw*0.16;
    const arms=[[top, yc-waist/2, r, sq],[yc+waist/2, top+h, sq, r]];

    /* the body first, so the stripes lie ON the chromosome rather than beside
       it, and the outline last, so an arm still reads as one shape */
    arms.forEach(([y0,y1,rt,rb])=>
      F.g.appendChild(el("path",{d:armPath(x,y0,bw,y1-y0,rt,rb),
        fill:"var(--k-top)","fill-opacity":".95"})));

    /* THE STRIPES. Two to five an arm at seeded positions, the read colour,
       drawn ACROSS the chromosome because an alignment is a position on it and
       nothing else — not a length, not a direction, not a depth. */
    arms.forEach(([y0,y1])=>{
      const nS=2+Math.floor(rnd()*4);
      for(let k=0;k<nS;k++){
        const f=0.08+rnd()*0.84, sy=y0+(y1-y0)*f, sh=Math.max(0.9*u,1.5*u*rnd()+0.9*u);
        if(sy+sh>y1) continue;
        hits.push(F.g.appendChild(el("rect",{x,y:sy.toFixed(1),
          width:bw.toFixed(2),height:sh.toFixed(2),
          fill:"var(--cull)","fill-opacity":"0.20"})));
      }
    });

    arms.forEach(([y0,y1,rt,rb])=>
      F.g.appendChild(el("path",{d:armPath(x,y0,bw,y1-y0,rt,rb),fill:"none",
        stroke:"var(--stroke)","stroke-opacity":".7","stroke-width":(0.5*u).toFixed(2)})));

    F.g.appendChild(el("path",{fill:"none",stroke:"var(--fg3)",
      "stroke-width":(0.5*u).toFixed(2),
      d:`M${x-0.6*u} ${yc}H${x+bw*0.22}M${x+bw*0.78} ${yc}H${x+bw+0.6*u}`}));
  });

  /* ---- ONE AT A TIME, AND IN NO ORDER ------------------------------------
     A field of stripes all lit at once is a map of coverage, which is a claim
     about how many and where. Lit one at a time it is a machine PLACING them,
     which is a claim about what the step does — and the order is shuffled
     rather than swept, because reads arrive in the order the file has them and
     that has nothing to do with position on the genome. */
  const seq=hits.map((_,i)=>i);
  for(let i=seq.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1)); const q=seq[i]; seq[i]=seq[j]; seq[j]=q;
  }
  const lit=hits.map(()=>-99);
  let t=0, ptr=0, last=-99;
  const RATE=0.13;                          /* seconds between placements */
  const run=dt=>{
    t+=dt;
    while(t-last>RATE){ last=(last<0?t:last+RATE); lit[seq[ptr%seq.length]]=t; ptr++; }
    hits.forEach((h,i)=>{
      const age=t-lit[i];
      h.setAttribute("fill-opacity",(age<0?0.20:0.20+0.72*Math.exp(-age/1.15)).toFixed(3));
    });
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.aligner=drawAligner;

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
      "font-family":FQ_MONO,fill:"var(--fg3)"});
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
      "font-family":FQ_MONO,fill:"var(--fg3)",
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
   G3 · THE STAR INDEX — the third reference figure, and the only one that is
   not a file somebody downloaded.

   IT WAS A LABELLED CUBE, which is what the other two were before they were
   drawn. G1 says which bases are where and G2 says which stretches are a gene;
   the index is what you get when you BAKE THE SECOND INTO THE FIRST, and a
   cube said none of that — a reader had two drawn figures feeding an unlabelled
   box that fed the aligner, which reads as a step rather than as a thing built
   once and reused forever.

   A SHELF OF SPINES, because that is what the object is. STAR's index is a
   suffix array with the annotation compiled in: a structure whose whole purpose
   is that you can go straight to the entry you want without reading what comes
   before it. That is a library, and the visual idiom for one is a shelf. The
   lookup runs along it because an index is only interesting in use — nothing
   moves along a shelf, so the thing that moves is the reading.

   The spines are generated from the same seed every load, like every other
   arrangement on this page: real in kind, no real content. There is no claim
   here about how many entries a STAR index holds.
   ============================================================ */
function drawStarIndex(g,n){
  refBuilding(g,n);
  const F=roofPanel(g,n,n.h,176), {CW,CH,u}=F;
  const rnd=mulberry32(0x5eedf15^0x9C);
  const margin=5*u;

  roofTitle(F,"STAR index",margin,20*u,15*u);

  /* ---- the shelves, and the spines standing on them --------------------- */
  const ROWS=3, top=30*u, bot=CH-5*u, sh=(bot-top)/ROWS;
  const books=[];
  for(let r=0;r<ROWS;r++){
    const yb=top+sh*(r+1)-2.0*u;
    /* THE BOARD IS A RECT UNDER THE SPINES, NOT A LINE THROUGH THEIR FEET. As a
       line at the same y as the book bottoms it was hidden by every book and
       showed only in the gaps between them, which at this scale is nothing. A
       shelf you cannot see is a bar chart. */
    F.g.appendChild(el("rect",{x:margin.toFixed(1),y:yb.toFixed(1),
      width:(CW-margin*2).toFixed(1),height:(1.9*u).toFixed(1),
      fill:"var(--fg3)","fill-opacity":".55"}));
    let bx=margin+1.2*u;
    /* WIDER AND FEWER THAN THE FIRST ATTEMPT. At two units a spine the run read
       as a bar chart — bars are thin because their width means nothing, and a
       book's width is the first thing about it. The bottoms align on a visible
       board and the tops do not, which is the whole silhouette of a shelf. */
    while(bx<CW-margin-6.5*u){
      const bw=(3.4+rnd()*3.4)*u, bh=(9+rnd()*7.5)*u;
      /* two faces of one grey and a hair of lean on a few of them, so a run of
         spines reads as objects standing rather than as a bar chart */
      const lean=rnd()<0.10?(rnd()-0.5)*7:0;
      const at={x:bx.toFixed(1),y:(yb-bh).toFixed(1),
        width:bw.toFixed(1),height:bh.toFixed(1),
        fill:rnd()<0.5?"var(--k-top)":"var(--k-left)","fill-opacity":".72"};
      /* el() writes every key it is given, so an absent attribute has to be an
         absent KEY — a null value lands as the string "null" and the renderer
         rejects the whole transform */
      if(lean) at.transform=`rotate(${lean.toFixed(1)} ${bx.toFixed(1)} ${yb.toFixed(1)})`;
      books.push(F.g.appendChild(el("rect",at)));
      bx+=bw+0.7*u;
    }
  }

  /* ---- THE LOOKUP -------------------------------------------------------
     One spine at a time, brightened and then let go. An index is a thing you
     ADDRESS: what a shelf cannot show standing still is that you do not walk
     it, you arrive at one place on it. So the mark jumps rather than sweeps,
     and it jumps somewhere unrelated each time — a sweep would draw a scan,
     which is the one access pattern this structure exists to avoid. */
  const seq=books.map((_,i)=>i);
  for(let i=seq.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1)); const t=seq[i]; seq[i]=seq[j]; seq[j]=t;
  }
  let t=0, ptr=0, lit=-99;
  const HOLD=0.42;
  const run=dt=>{
    t+=dt;
    if(t-lit>HOLD){ lit=t; ptr=(ptr+1)%seq.length; }
    const age=(t-lit)/HOLD;
    books.forEach((b,i)=>{
      const on=i===seq[ptr];
      b.setAttribute("fill-opacity",(on?0.72+0.28*(1-age):0.72).toFixed(3));
      if(on) b.setAttribute("fill","var(--fg2)");
      else if(b.getAttribute("fill")==="var(--fg2)") b.setAttribute("fill","var(--k-top)");
    });
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.starindex=drawStarIndex;


/* ============================================================
   E4 · ALIGN R1 — CONVEYOR BELTS

   THE INDEX IS NOT A STEP READS PASS THROUGH, IT IS A SURFACE THEY LAND ON,
   and that is the whole reason this station is drawn rather than labelled.
   ONE belt runs along the lane's own direction and the genes lie ACROSS it —
   annotated models that enter at one end, cross, and leave at the other, exons
   standing proud with introns flat between them, each with its own name lying
   along the near rail. Reads rain in from up-belt and above, settle onto a
   moving target, and then RIDE ALONG with the gene until it goes.

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
const fqEaseOut=x=>1-Math.pow(1-x,2.2);
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
    /* QUIETER THAN setBox's, because everything drawn through this is opaque.
       An outline earns its keep on a translucent face, where it is the only
       thing saying where the box ends; on a solid one at full strength it is a
       second drawing of the same edge. */
    nd[k].setAttribute("stroke-opacity",((k==="top"?0.30:0.18)*op).toFixed(3));
  });
}

/* REAL ZEBRAFISH SYMBOLS ON GENERATED MODELS, and the pairing is not a claim.

   Every gene on this belt is a seeded arrangement of exons — real in kind, no
   real coordinates, the same deal LOCUS_BANDS is on. What the names add is the
   one thing the geometry cannot say: that these are zebrafish genes and that
   they are all different from each other. A row of unnamed models reads as one
   gene drawn ten times.

   So the symbols are real, because "realistic-sounding" invented ones are how
   you end up with a plausible string somebody looks up; but NO NAME HERE
   DESCRIBES THE MODEL UNDER IT, and if that ever needs to be true the models
   have to come from the annotation rather than from a seed. Thirty of them,
   picked with a stride coprime to the count so ten genes get ten names. */
const GENE_NAMES=[
  "sox19a","myod1","pax2a","shha","tbx16","gata1a","mylpfa","elavl3","foxd3",
  "sox10","mitfa","slc24a5","fabp10a","apoeb","mpx","runx1","kdrl","myl7",
  "tnnt2a","desma","her4.1","neurod1","olig2","gfap","mbpa","krt4","col2a1a",
  "fgf8a","wnt11","notch1a",
];

/* ONE FUNCTION, TWO MACHINES.

   Aligning and assigning are two steps and they are drawn as two objects. For a
   while assignment was the far end of the alignment belt, which is tidy and
   says the wrong thing twice over: that a read is carried between the two on
   one surface, and that the two are one machine somebody named in halves. They
   are not — the second reads the model, the first reads the assembly, and a
   reader who cannot see where one ends cannot see that there are two.

   SO THE GENES FADE OUT AT THE END OF ONE AND FADE IN AT THE START OF THE
   NEXT, which is the same not-quite-connected the rest of this page uses: E3's
   validated triplets fade at its mouth and fresh ones appear at E4. An
   imperfect join is honest here — nothing on this map claims to have followed
   one molecule from end to end, and a belt running unbroken between two
   stations would.

   What the two modes share is everything about a gene and a read: the models,
   the pile-up, the 3' bias, the aerial, the names. What they do not share is
   the rain (align only) and the sweep, the bin and the tracks (assign only). */
function drawGeneBelt(g,n,MODE){
  const ASSIGN=MODE==="assign";
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
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const x0=n.x-n.w/2, x1=n.x+n.w/2, span=x1-x0, cy=n.y;
  /* K COMES OFF THE DEPTH, NOT THE LENGTH, and that is what lets two belts of
     different lengths carry the same size of gene.

     It was span/9.2 with the 9.2 written into the divide, so widening a belt
     scaled the whole machine — longer belt, longer genes, bigger reads, no more
     room than before. Then it was span/BELTU, which fixed that at the cost of
     two numbers that had to be changed together. Depth is the right source:
     a gene lies ACROSS the belt, so what sets its size is how wide the belt is,
     and the length is then free. Give two belts the same d and they are the
     same machine at two lengths. */
  const K=n.d*0.1053, KZ=n.h/0.53;            /* the original's own units */
  /* THE MODEL IS LOW. exonH was 0.565 of n.h against a line 0.12 world units
     wide, which is a wall rather than a block: opaque and narrowed, the exons
     came out as a row of train cars standing on a rail. An exon is a THICKER
     PART OF A LINE. Give it a little over its own width in height and it reads
     as one, and a read landing on its top lands somewhere the eye can still
     see is part of the gene. */
  const base=n.h*0.245, geneH=n.h*0.09, exonH=n.h*0.24;
  const GL=n.d*0.70;                          /* the gene, across the belt */
  const BW=GL+K*1.0;                          /* the belt, a shade wider than its load */
  const GW=K*0.30;                            /* a gene's thickness along the belt */
  /* THINNER THAN IT WAS, AND THE TWO HALVES ARE NOT THE SAME THICKNESS.
     A read is one observation; at 0.40 of a gene's own thickness a few of them
     read as slats laid on the model rather than as a pile of separate
     measurements, and the pile is the argument.

     THEN A THIRD OF THAT AGAIN. At 0.28 a read still had a body, and thirty
     bodies on one model is a texture rather than a count — you could see that
     reads were there and not how many. At 0.093 a read is a LINE, which is what
     one observation looks like, and a hundred lines at slightly different
     offsets read as a hundred.

     AND THE AERIAL IS A QUARTER OF THE READ. The orange is the part with a
     position and the blue is the part that has none; they should not have equal
     say and they no longer have comparable weight. Below about a pixel a true
     quad stops being drawn at all rather than being drawn faintly, so the
     aerial goes through `barTo`, which floors its own half-width in SCREEN
     pixels — a legibility floor, and the only length on this shape that is not
     in world units. */
  const RW=GW*0.047, RWB=RW*0.42;
  const GWE=GW*0.58;                          /* the gene's line, body and exons alike */
  const ATICK="M -3.4 0.3 L -1.1 2.7 L 3.7 -3.4";
  const ACROSS="M -3.0 -3.0 L 3.0 3.0 M 3.0 -3.0 L -3.0 3.0";
  /* ONE POINT, NOT A LINE. Every read on a gene falls from the same place: up
     the belt by NOZX and above the exon tops by NOZZ, on the belt's centre
     line. The jitter that used to be in the source is gone — a spray whose
     source is itself spread out is a shower, and what this station does is
     three hundred reads leaving one stream and each finding its OWN place on
     one model. The fan is the landing sites, and nothing else. */
  const NOZX=5.4*K, NOZZ=3.2*KZ;
  const v=(n.v||1.05)*K;
  /* THE PITCH IS FIXED AND THE COUNT FOLLOWS. Ten genes was right for one belt
     of one length; with two belts it has to be the SPACING that is shared, or a
     short belt carries its models bunched and a long one carries them strung
     out, and the two stop looking like the same conveyor. */
  const PAD=7*K, LOOP=span+PAD*2;
  /* FEWER GENES ON THE BELT, because each one carries a name and the names
     are 1.55x larger relative to the belt than they were. 2.32 -> 3.5 takes
     ten models down to six or seven, which is still more than two on the
     belt at once — the thing the count exists to guarantee. */
  const NG=Math.max(4,Math.round(LOOP/(2.32*K*TBof(n))));
  const yOf=f=>cy+GL/2-f*GL;                  /* f=0 at +y, the gene's near end */

  /* the read, in the same base pairs as everywhere else, as a fraction of the
     gene it lands on: 64 of cDNA that aligns, then 32 of unsequenced middle and
     58 of barcode that do not */
  const RTOT=0.145, RL=RTOT*64/154, RG=RTOT*32/154, RB=RTOT*58/154;
  /* THE TAIL LEANS UP-BELT, LIKE AN AERIAL.

     It used to carry on along the gene's own axis as it rose, which put the one
     part of the molecule with NO position onto the axis that means position — a
     blue tail pointing along a gene reads as blue lying on the gene. Turned
     into -x it leaves that axis entirely: -x is up-and-to-the-left here, so the
     tail stands off the surface at about 47 degrees, across the direction of
     travel and across the gene both, and there is nowhere on the model it could
     be mistaken for being. Trailing behind the belt's own motion is what a mast
     on a moving thing does anyway.

     LIFT IS GONE AND THE LENGTH IS BASE PAIRS AGAIN. It was n.h * 0.52, a
     height with nothing behind it. The tail is 32 of unsequenced middle and 58
     of barcode against the 64 that aligned, so it is (RG+RB) of the gene long —
     half again the orange, which is the true ratio — laid along a fixed
     direction instead of along the model. TKNEE is where the dashes stop and
     the blue starts, and it is 32/90 for the same reason. */
  const TDIR=[-0.86,0.51];                    /* up and to the left, unit length */
  const TD3=[TDIR[0],TDIR[1]];                /* the same direction in x and z */
  const TAIL=(RG+RB)*GL, TKNEE=RG/(RG+RB);
  /* AND IT ARRIVES FLAT AND FLAPS UP ON THE WAY DOWN.
     A molecule in free air is a straight molecule: at the top of the fall the
     whole read is one flat line — cDNA, adapter, barcode end, in a row along
     the gene's own axis, at the height it is falling through. The aerial is not
     a shape the molecule HAS, it is a shape the descent puts it in, so the tail
     swings from that line up into TDIR as the read comes down, the way wind
     takes a streamer. `flap` is that swing, and the splice arch opens on the
     same number — a read that lands opens up in one motion. */
  const flapOf=kk=>fqEaseOut(clamp01((kk-0.12)/0.68));
  /* THE ARCH A SPLICED READ THROWS OVER THE INTRON IT CROSSES. Kept low: an
     intron here is a few hundredths of a gene wide, so an arch as tall as it is
     long draws a loop, and a loop reads as something the read does rather than
     as the something it does NOT do. What has to be legible is that the read is
     in two pieces and that nothing of it touches down between them. */
  const ARCH=n.h*0.26;
  /* smaller than every other name on this map, on purpose: it is an
     identification, not a heading, and there are ten of them moving */
  const GFS=TYPEof(n,6,10.4*K);
  /* ---- THE LAST THIRD IS THE ASSIGNMENT ----------------------------------
     Alignment answers WHERE on the assembly; assignment answers WHICH GENE, and
     they are different questions asked of the same read a moment apart. The
     extra belt is where the second one gets asked: a gene crosses ASSIGN0 with
     a pile of reads on it and leaves with every one of them marked.

     The sweep runs 5' to 3' along the model rather than firing all at once,
     because a verdict per read is a verdict per read — one mark appearing on
     thirty of them simultaneously is a decision about the gene, which is not
     what this step does. Each read's mark fires when the model has carried it
     past ASSIGN0 + f*ASSIGNL, so the marks travel the transcript. */
  /* THE SWEEP RUNS ACROSS THE MIDDLE OF THE ASSIGN BELT, not the far end of
     the align one. A gene arrives with its pile already on it, is claimed, and
     leaves marked — which needs run-in before it and run-out after. */
  const ASSIGN0=x0+span*0.30, ASSIGNL=span*0.32;
  /* WHERE A DECLINED READ ENDS UP: off the FAR rail, at −y.

     E3's bin is on the near side and this one is not, which is worth a line.
     The near side of this belt is where the whole reference row lives — the
     index, the aligner and the two annotations are all at +y — and a bin
     wedged between the rail and the STAR Aligner's footprint had 0.1 of a unit
     of clearance and a label that landed on somebody else's roof. The far side
     is empty for the whole length of this station. A discard has to be
     somewhere a reader can see it land, and that beats matching the other bin's
     side.

     TWO CONSTRAINTS AND THEY ARE BOTH ABOUT HEIGHT AND REACH. The lid must sit
     BELOW the height reads ride at (exTop, and a row higher for each one above
     it) or they climb into it; and the bin must be inside the belt's own
     visible span, because a shunted read is drawn in its gene's group and goes
     when the gene does. 0.86 leaves the last-declared read room to get there. */
  const BINX4=x0+span*0.82, BINY4=cy-BW/2-GL*0.18;
  /* THE SAME SHAPE AS E3's, WHICH IS A RATIO AND NOT A SIZE. That bin's slot is
     5.9 times as long as it is wide and its pail and head are 0.204 and 0.058
     of the slot's length; carry those three numbers and the two boxes are the
     same object at two scales. Left to itself this one came out nearly square,
     which is a different machine. */
  const SLOTX4=RL*GL*2.6, SLOTY4=SLOTX4/5.9;
  const BUCKH4=SLOTX4*0.204, HEADH4=SLOTX4*0.058;
  const MKL=RL*GL*S*0.62;                     /* how far left of its read a mark sits */
  /* the shower, the 3' bias and the stack — see the notes in the gene loop */
  const SHOWER_AT=0.402, SHOWER_W=0.040, FALL=0.052;
  const P3=0.55;                              /* share of reads primed at the tail */
  const RSTEP=n.h*0.105;                      /* one row of the pile */

  /* ---- the belt: scenery, and it should read as scenery -------------------
     OPAQUE, though. It was drawn through at 0.55 and 0.7, and a translucent
     deck is not quieter than a solid one — it is busier, because the grid and
     the ground plane read straight through it and every gene on it acquires a
     second set of lines nobody drew. Quiet is a colour close to the ground,
     not a hole in the floor. */
  g.appendChild(el("polygon",{points:pts([P(x0,cy-BW/2,base),P(x1,cy-BW/2,base),
    P(x1,cy+BW/2,base),P(x0,cy+BW/2,base)]),
    fill:"var(--t-right)","fill-opacity":"1",stroke:"var(--stroke)",
    "stroke-width":"0.9","stroke-opacity":".11"}));
  g.appendChild(el("polygon",{points:pts([P(x0,cy+BW/2,base),P(x1,cy+BW/2,base),
    P(x1,cy+BW/2,0),P(x0,cy+BW/2,0)]),
    fill:"var(--t-right)","fill-opacity":"1",stroke:"var(--stroke)",
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
    /* NO EXON SHORTER THAN A READ. The generator ran from 0.055 and a read is
       0.0602 of a gene, so the short half of the distribution could not hold
       one — and the placement, which clamps rather than rejects, put those
       reads at the exon's start and let them hang off the far end onto the
       intron beside it. On a model this is the only claim the station makes:
       every read on an exon, none on an intron. A model with somewhere a read
       cannot land is a model that will eventually be seen to break it. */
    const ex=[]; const intr=[]; let f=0.015+rnd()*0.025;
    while(f<0.95){
      const w=RL+0.012+rnd()*0.075;
      if(f+w>0.965) break;
      ex.push([f,f+w]);
      /* THE INTRONS GOT WIDER, and that is not a drawing preference. A read
         has to be able to land on one — see the note on where reads go — and
         the old 0.035..0.09 gap could not hold 0.0602 of a gene. */
      const gp=0.055+rnd()*0.085;
      intr.push([f+w,f+w+gp]);
      f+=w+gp;
    }
    intr.length=Math.max(0,ex.length-1);       /* no intron past the last exon */
    const gn={grp:ggrp, pos:0, ex, hid:false,
      /* THREE STEPS OF ONE GREY, DARKEST AT THE BOTTOM: the deck is --t-right,
         the gene's line is --t-top, the exons are --k-top. On a translucent
         deck the body could be --t-left and still be seen; on an opaque one it
         is within a shade of the floor it sits on and reads as an empty
         outlined box, because all that is left of it is its own stroke. */
      body:boxNodes(ggrp,"var(--t-top)","var(--t-left)",0.8),
      exons:ex.map(()=>boxNodes(ggrp,"var(--k-top)","var(--k-left)",1.0)),
      /* THE GENE LIGHTS UP, and it is one box rather than one per exon. A green
         copy of the whole model line, laid over it and under the reads: at ten
         genes and eight exons apiece the per-exon version is 240 more boxes to
         rewrite every frame for a difference nobody could see. What has to read
         is that THE MODEL has claimed something, not which part of it. */
      glow:boxNodes(ggrp,"var(--ok)","var(--ok)",0.8),
      reads:[]};
    /* ---- THE GENE'S NAME, LYING ALONG THE BELT'S NEAR EDGE ----------------
       Real zebrafish symbols on generated models — see GENE_NAMES. It rides at
       the gene's own x, just off the near rail, and it is set at -30 like the
       gene's own long axis, so the word runs parallel to the thing it names.
       Anchored `end`, so it finishes at the rail and trails away from the belt
       into empty ground rather than across it. */
    /* THE NAME IS ASSIGN'S, NOT ALIGN'S. An aligner does not know which gene it
       has hit — it reports a coordinate, and naming the model it landed on is
       the next station's whole job. A name on the alignment belt answers the
       question one step before it is asked; it is built into a loose group on
       that belt so every later line can go on setting it without a branch. */
    gn.lab=(ASSIGN?ggrp:el("g")).appendChild(el("text",{"text-anchor":"end","font-family":FQ_MONO,
      fill:"var(--fg3)","font-size":GFS.toFixed(1),"font-weight":"500",
      "letter-spacing":(GFS*0.06).toFixed(2),"fill-opacity":"0"}));
    gn.lab.textContent=GENE_NAMES[(i*7+3)%GENE_NAMES.length];
    /* ---- AND ITS TWO ENDS ARE NAMED ---------------------------------------
       Which way a transcript runs is not a detail on this belt, it is the
       reason the pile is where it is: transcription runs 5' to 3', the oligo-dT
       primes off the polyA tail, and the stack that builds at the far end of
       every model is the 3' UTR getting read over and over. Unlabelled, that
       stack is a lump at one end of a diagram and a reader has to be told what
       it means. Labelled, it says it. Same ink and a size below the name's,
       because these are two characters that only have to be found once. */
    gn.p5=ggrp.appendChild(el("text",{"text-anchor":"end","font-family":FQ_MONO,
      fill:"var(--fg3)","font-size":(GFS*0.82).toFixed(1),"font-weight":"500",
      "fill-opacity":"0"}));
    gn.p5.textContent="5′";
    gn.p3=ggrp.appendChild(el("text",{"text-anchor":"start","font-family":FQ_MONO,
      fill:"var(--fg3)","font-size":(GFS*0.82).toFixed(1),"font-weight":"500",
      "fill-opacity":"0"}));
    gn.p3.textContent="3′";
    /* MORE OF THEM THAN THE BELT BEFORE THIS ONE DELIVERS, on purpose. Every
       fragment that clears the whitelists arrives here, and the pile-up on one
       gene is the point: a read is one observation and a gene model covered in
       them is a count.

       AND THEY ARRIVE AS RAIN. They used to come down in one cohort inside a
       narrow band of the traverse, which drew a delivery — a batch handed over
       at a moment. Alignment is not a batch: reads arrive continuously, they
       are independent, and no two are aimed. So each one now has its own u0
       spread across most of the crossing, and they all fall from the SAME
       place — up-belt, high, a nozzle's width of jitter and no more — which is
       what makes the fan a fan. The spread you see is not the source spreading,
       it is 300 different landing sites pulling their own read out of one
       stream. */
    /* ---- WHERE THE READS LAND ------------------------------------------
       ONE SHOWER PER GENE, AND ONLY ONE AT A TIME. Every gene used to be
       rained on across most of its crossing, so three or four were being
       showered at once and the belt read as continuous weather. It is not
       weather: a gene is a target and a shower is the thing being aimed at it.
       The genes are evenly spaced 1/NG = 0.1 apart in u, so a shower whose
       whole airborne interval is NARROWER THAN 0.1 can only ever have one gene
       under it. SHOWER_AT + SHOWER_W + FALL is 0.092, which is that, with a
       little air either side. Change any of the three and check the sum.

       A gene therefore comes onto the belt bare at u = 0.30, is showered at
       0.35-0.45, and rides the rest of the way covered.

       THREE PRIME BIAS, AND IT IS A MIXTURE RATHER THAN A CLIFF. Every assay on
       this map primes with oligo-dT, which is why reads pile at the 3' end —
       but Evercode WT puts TWO primers in each BC1 well, an oligo-dT and a
       random hexamer (the reason BC1's plate is half the size and still yields
       96, drawn on W1), and the hexamer primes anywhere on the transcript. So
       the pile is a mixture: most of it at the tail, a real spread along the
       body, and neither of them zero.

       P3 IS THE SHAPE OF THAT BIAS AND NOT A MEASURED PROFILE, and it must not
       be labelled as one. Nothing on this page is modelled; this is a drawing
       decision with a stated reason, in the same class as the exon layout it
       lands on. A real coverage profile needs the alignments, and those are not
       on this instance. */
    const NR=24+Math.floor(rnd()*10);
    const fits=ex.filter(e=>e[1]-e[0]>=RL+0.006);
    const pool=fits.length?fits:[ex.reduce((a,b)=>(b[1]-b[0]>a[1]-a[0]?b:a))];
    for(let k=0;k<NR;k++){
      /* ONE IN SIX CROSSES A SPLICE JUNCTION, and lands in two pieces.
         It came from spliced mRNA, so it covers the end of one exon and the
         start of the next and there is nothing of it over the intron between —
         an arch, and no contact. Those are the reads the assembly alone cannot
         place, and the reason G2 is a node of its own. */
      const sp=ex.length>1 && rnd()<1/6;
      /* ---- AND SOME LAND ON INTRONS, WHICH IS WHAT ASSIGNMENT IS ABOUT -----
         The aggregate this belt used to assert was "every read on an exon,
         none on an intron", and it was the annotation's whole argument. It is
         also the reason the last third of the belt had nothing to decide: a
         pile in which every read is exonic is a pile every read of which is
         assigned, and a station where nothing is ever declined is not a
         station.

         Reads land where the SEQUENCE matches, and pre-mRNA is in the library.
         So a share of them land on introns, and those are the ones that get the
         cross — which is exactly the subject of the step this is drawing:
         whether an intronic read counts is `--include-introns`, A FLAG AND NOT
         A FACT, and the node that owns this step is named for it.

         THE SHARE IS TUNED FOR LEGIBILITY AND IS NOT A MEASUREMENT, the same
         way E3's reject rate is. There is no per-read assignment record on this
         instance; the real figures live in the prose. */
      const onIntron=!sp && intr.length>0 && rnd()<0.16;
      const rd={sp,bad:onIntron,
        /* ON THE MODEL, AND NOW BARELY OFF ITS CENTRE LINE. A read used to take
           the whole width of the line as jitter, which was right while they lay
           side by side and is wrong now that they stack: a column that wanders
           in x is not a column. What is left is enough to say these are
           separate objects. */
        dx:(rnd()-0.5)*(GWE-RW)*0.30,
        u0:SHOWER_AT+rnd()*SHOWER_W};
      if(sp){
        const kx=Math.floor(rnd()*(ex.length-1)), eA=ex[kx], eB=ex[kx+1];
        rd.rlA=RL*(0.34+rnd()*0.32); rd.rlB=RL-rd.rlA;
        rd.fA=Math.max(eA[0]+0.002, eA[1]-rd.rlA); rd.fB=eB[0]+0.002;
        rd.gap=[eA[1],eB[0]];
        rd.start=rd.fA; rd.end=rd.fB+rd.rlB;
      }else if(onIntron){
        const fits=intr.filter(e=>e[1]-e[0]>=RL+0.004);
        const e=(fits.length?fits:intr)[Math.floor(rnd()*(fits.length||intr.length))];
        const lo=e[0]+0.002, hi=Math.max(lo,e[1]-RL-0.002);
        rd.f=lo+rnd()*(hi-lo); rd.start=rd.f; rd.end=rd.f+RL;
      }else{
        /* aim at a position on the transcript first, then take the exon whose
           middle is nearest it — so the bias is a property of the transcript
           and the exon layout only decides where on it a read can sit */
        const tf = rnd()<P3 ? 1-Math.pow(rnd(),1.6)*0.20 : rnd();
        const e=pool.reduce((a,b)=>
          Math.abs((b[0]+b[1])/2-tf)<Math.abs((a[0]+a[1])/2-tf)?b:a);
        const lo=e[0]+0.003, hi=Math.max(lo,e[1]-RL-0.003);
        rd.f=lo+rnd()*(hi-lo); rd.start=rd.f; rd.end=rd.f+RL;
      }
      rd.ymid=yOf((rd.start+rd.end)/2);
      gn.reads.push(rd);
    }

    /* ---- AND THEY STACK, THE WAY A PILE-UP IN A GENOME BROWSER DOES --------
       Laid on one plane the pile turned into soup: thirty lines at the same
       height over the same stretch of exon are one orange smear, and the count
       — which is the whole argument of this station — is unreadable off it.
       Greedy interval packing, exactly what every read viewer does: walk the
       reads in start order and drop each into the lowest row whose last read
       ended before this one starts, with STACK_GAP of clear transcript between
       them so two reads in a row never touch end to end.

       The result is the 3' bias made visible as HEIGHT rather than as density.
       Where the oligo-dT reads pile up the stack is deep; along the body, where
       the hexamers put one read here and one there, it is a single layer. That
       is a fact about the chemistry drawn as a shape, and it is the one thing a
       flat pile could not say at all. */
    const STACK_GAP=RL*0.30;
    {
      /* A PYRAMID, NOT A STAIRCASE. Packed in START order the pile climbs from
         one end to the other: every row begins where the row below it left off,
         which draws a flight of steps. A pile-up is not a flight of steps — it
         is deep where the reads are and shallow where they are not, and the
         shape of it IS the coverage.

         So the order of insertion is by how contested a read's stretch is, not
         by where it starts. Count each read's overlaps first; place the loneliest
         ones first, so they take the ground floor and the ones in the thick of it
         are forced upward over everything they cross. The densest stretch ends
         up highest and the edges taper — which is the 3' peak drawn as a
         silhouette rather than as a slope. */
      gn.reads.forEach(rd=>{ rd.ov=0; });
      for(let a=0;a<gn.reads.length;a++) for(let b=a+1;b<gn.reads.length;b++){
        const A=gn.reads[a], B=gn.reads[b];
        if(A.start<B.end+STACK_GAP && B.start<A.end+STACK_GAP){ A.ov++; B.ov++; }
      }
      gn.reads.sort((a,b)=>(a.ov-b.ov)||(a.start-b.start));
      /* rows hold intervals rather than a high-water mark, because reads no
         longer arrive in start order and a single end is not enough to test */
      const rows=[];
      for(const rd of gn.reads){
        let r=0;
        for(;;r++){
          if(!rows[r]){ rows[r]=[]; break; }
          if(!rows[r].some(iv=>rd.start<iv[1]+STACK_GAP && iv[0]<rd.end+STACK_GAP)) break;
        }
        rows[r].push([rd.start,rd.end]); rd.row=r;
      }
      /* BUILT IN ROW ORDER, because DOM order is paint order and a stack has
         to paint from the bottom up. Sorting the records after the elements
         were made would have left the two orders unrelated. */
      gn.reads.sort((a,b)=>(a.row-b.row)||(a.start-b.start));
    }
    for(const rd of gn.reads){
      /* NO OUTLINE ON THE READ, now that a read is a line. A 0.6 stroke on a
         bar under a pixel wide is not an edge, it IS the bar, and it draws
         every read at the same width whatever the width is. */
      rd.cd=ggrp.appendChild(el("polygon",{fill:"var(--cull)","fill-opacity":"0",
        stroke:"none"}));
      if(rd.sp){
        rd.cd2=ggrp.appendChild(el("polygon",{fill:"var(--cull)","fill-opacity":"0",
          stroke:"none"}));
        /* AS SOLID AS THE TWO HALVES IT JOINS. It was 1.0 wide at 0.55, which
           is a sub-pixel stroke at map zoom held back on top of that — the arch
           came out looking like a shadow of a read rather than part of one. It
           is the same molecule as the blocks at its feet and it is drawn like
           it. */
        rd.arc=ggrp.appendChild(el("path",{fill:"none",stroke:"var(--cull)",
          "stroke-width":"1.5","stroke-opacity":"0","stroke-linecap":"round"}));
      }
      /* THE DASH PATTERN IS SET PER FRAME, FROM THE SEGMENT'S OWN LENGTH. The
         unsequenced middle is a few pixels long at map zoom and a few more at
         reading zoom, and a fixed 2.2/2.2 gave it one dash at one and three at
         the other — a dotted line that is three dots is a dotted line nobody
         reads as dotted. segDash divides whatever length it has into DASHN
         dashes, so it is the same line at every zoom. */
      rd.ad=ggrp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
        "stroke-opacity":"0","stroke-linecap":"butt"}));
      /* NO OUTLINE ON THE AERIAL. At a quarter of the read's width a 0.6 stroke
         is the whole bar again, and the two halves came out looking the same
         thickness — which is the one thing this pair is not. */
      rd.bc=ggrp.appendChild(el("polygon",{fill:"var(--accent)","fill-opacity":"0",
        stroke:"none"}));
      /* THE VERDICT, built after the read so it rides above it. Same two marks
         and the same two tokens as the sorting yard, because it is the same
         kind of event: a thing being checked against a list and kept or not. */
      rd.mk=ggrp.appendChild(el("path",{d:rd.bad?ACROSS:ATICK,fill:"none",
        stroke:rd.bad?"var(--rej)":"var(--ok)","stroke-width":"2.0",
        "stroke-linecap":"round","stroke-linejoin":"round","stroke-opacity":"0"}));
    }
    genes.push(gn);
  }

  const DASHN=7;                              /* dashes in the unsequenced middle */
  const seg=(node,xa,ya,za,xb,yb,zb,op)=>{
    const a=P(xa,ya,za), b=P(xb,yb,zb);
    node.setAttribute("x1",a[0].toFixed(1)); node.setAttribute("y1",a[1].toFixed(1));
    node.setAttribute("x2",b[0].toFixed(1)); node.setAttribute("y2",b[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
    /* DASHN dashes and DASHN-1 gaps, measured off the length it actually has,
       so the middle reads as dotted at every zoom instead of as one dash at
       map scale and three at reading scale */
    const d=Math.hypot(b[0]-a[0],b[1]-a[1])/(2*DASHN-1);
    node.setAttribute("stroke-dasharray",d.toFixed(2)+" "+d.toFixed(2));
  };
  /* A BAR BETWEEN TWO POINTS ANYWHERE, thin across, offset in the SCREEN plane.
     quadX and quadY were this shape's two axis-aligned bars, and between them
     they covered every direction a read used to run in. The aerial swings
     through a whole arc now, so it needs a bar that does not care which axis it
     is on — and once one existed there was no reason for the read to keep its
     own. A world extent in x or in y
     projects to exactly w*S — the two are equal under this projection — so
     that is the width used, and the bar is the same weight in any direction.

     THE FLOOR IS IN SCREEN PIXELS AND IT IS THE ONE PLACE THIS SHAPE LEAVES
     WORLD UNITS. A quarter of a read is under a pixel wide, and under a pixel
     an SVG polygon stops being drawn faintly and starts not being drawn. Half
     a pixel of half-width is the difference between "deliberately slight" and
     "missing", and there is nothing to be gained by being right about the
     width of something nobody can see.

     AND THE FLOOR HAS TO CLEAR A WHOLE PIXEL, not a fraction of one. At 0.42
     of a half-width a read is 0.84px across, and a sub-pixel shape is drawn at
     partial coverage — which looks exactly like a read with transparency on it,
     because that is what partial coverage is. Nothing in this shape is
     translucent; anything that looked it was being sampled rather than drawn.

     WHICH IS WHY THE READ GOES THROUGH HERE TOO, and why the floor is a
     parameter. The aligned half was a true quad and the aerial was floored, so
     at map zoom the part with no position was drawn WIDER than the part with
     one — the floor had quietly inverted the hierarchy the widths were set to
     make. Both are floored now, the read at twice the aerial's minimum, so the
     ratio survives all the way down to the zoom where the true widths stop
     meaning anything. */
  const barTo=(node,w,minHW,ax,ay,az,bx,by,bz,op)=>{
    const a=P(ax,ay,az), b=P(bx,by,bz);
    const dx=b[0]-a[0], dy2=b[1]-a[1], L=Math.hypot(dx,dy2)||1;
    const hw=Math.max(minHW,w*S/2), hx=-dy2/L*hw, hy=dx/L*hw;
    node.setAttribute("points",[[a[0]+hx,a[1]+hy],[b[0]+hx,b[1]+hy],
      [b[0]-hx,b[1]-hy],[a[0]-hx,a[1]-hy]]
      .map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" "));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
  };
  /* the arch over an intron: sampled in the gene's own f, so it lands on the
     two exon ends it belongs to however the model is scaled */
  /* ---- THE BIN, BUILT AFTER THE GENES so its lid does the disappearing ----
     Same object as E3's and from the same function, because a read declined
     here and a fragment declined there are the same kind of event one step
     apart. The name is the difference: it says which question was asked. */
  const BIN4=ASSIGN?shredBin(g,BINX4,BINY4,SLOTX4,SLOTY4,BUCKH4,HEADH4,
    {top:"var(--rej)",left:"var(--rej)",right:"var(--rej)"},
    {top:"var(--k-top)",left:"var(--k-left)",right:"var(--k-right)"}):{top:0,run(){}};
  if(ASSIGN){
    const a=P(BINX4+SLOTX4*0.34,BINY4-SLOTY4*1.7-GL*0.05,0);
    const t2=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(-30)`,
      "text-anchor":"start","font-family":FQ_MONO,fill:"var(--rej)",
      "font-size":(GFS*1.05).toFixed(1),"font-weight":"600",
      "letter-spacing":(GFS*0.10).toFixed(2),"fill-opacity":"1"});
    t2.textContent="NO GENE MATCH"; g.appendChild(t2);
  }
  let shred4=-99;

  const archPath=(node,xc,fa,fb,z0,dy,h,op)=>{
    const p=[];
    for(let s=0;s<=10;s++){
      const q=s/10;
      p.push(P(xc, yOf(fa+(fb-fa)*q)+dy, z0+h*Math.sin(Math.PI*q)));
    }
    node.setAttribute("d","M "+p.map(a=>a[0].toFixed(1)+" "+a[1].toFixed(1)).join(" L "));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
  };

  let t=0;
  const run=dt=>{
    t+=dt;
    BIN4.run(t, 1-(t-shred4)/0.5, K*3.4);
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
      /* TWO VISIBILITIES, AND THEY END IN DIFFERENT PLACES. `vis` is the gene
         MODEL: it fades out at the belt's own end, because that is where the
         model goes. `live` is the group: it has to outlast the model, because
         the reads the model kept run on down the lanes after it has gone, and
         they are drawn in its group. Keying gn.hid off vis put the lanes out
         with the gene that fed them. */
      /* THE JOIN IS A FADE AT BOTH ENDS AND IT IS DELIBERATELY SOFT. On the
         align belt a gene comes on at the mouth and goes out gently over the
         last fifth — it is not handed over, it stops being drawn. On the assign
         belt one appears over the first fifth, fresh, from the same general
         direction. Neither belt claims to be the other's continuation. */
      const vis=ASSIGN
        ? Math.min(sstep(x0-K*0.2,x0+span*0.17,gxp),1-sstep(x1-K*0.9,x1-K*0.1,gxp))
        : Math.min(sstep(x0-K*0.4,x0+K*0.5,gxp),1-sstep(x1-span*0.20,x1-K*0.1,gxp));
      /* THE GROUP AND THE MODEL END TOGETHER NOW. `live` outlasted `vis` while
         the kept reads ran on into tracks drawn by this same shape; the tracks
         are their own station, so there is nothing left to outlast. */
      const live=vis;
      const exTop=base+exonH;
      /* A GENE OFF THE BELT COSTS NOTHING. Ten models are on the loop and four
         are on the belt; with thirty reads apiece, walking the other six every
         frame was most of the work this shape does and none of the picture.
         Hide once, then skip until it comes back. */
      if(live<=0.002){
        if(!gn.hid){
          gn.hid=true; gn.grp.setAttribute("display","none");
        }
        return;
      }
      if(gn.hid){ gn.hid=false; gn.grp.removeAttribute("display"); }

      /* THE BODY HAS TO CARRY, or the gene reads as a staircase of unrelated
         blocks rather than as one model with exons standing proud of it. It is
         the thing that says these blocks belong to each other. */
      /* ONE LINE, AND THE EXONS ARE THE SAME LINE STANDING TALLER.
         The exons used to be WIDER than the body they sit on (GW against
         GW*0.58) and both were drawn through — 0.42 and 0.80 — so a gene came
         apart into a wide translucent staircase with a narrow strip showing
         between the treads, and the deck's own lines through all of it. A gene
         model is one line with thicker sections: same width, different height,
         both solid. What separates an exon from the intron beside it is that it
         stands up, and that is the only difference there should be. */
      /* IT ROLLS OFF THE EDGE. The model used to fade where the belt stops,
         which draws a thing being switched off; it drops instead, and the fade
         goes with it. z is the only axis this projection draws straight up, so
         a drop is the one movement that cannot be mistaken for anything else. */
      const roll=ASSIGN?sstep(x1-span*0.075,x1+span*0.010,gxp):0;
      const gz=-roll*roll*GL*0.34;
      setBoxY(gn.body,gxp,GWE,yOf(0),yOf(1),base+gz,base+geneH+gz,vis.toFixed(3));
      gn.ex.forEach((e,k)=>
        setBoxY(gn.exons[k],gxp,GWE,yOf(e[0]),yOf(e[1]),base+gz,exTop+gz,vis.toFixed(3)));
      /* and the whole line goes green as the sweep claims it */
      const glow=ASSIGN?sstep(ASSIGN0-span*0.03,ASSIGN0+span*0.07,gxp):0;
      setBoxY(gn.glow,gxp,GWE*1.02,yOf(0),yOf(1),base+gz,exTop*1.01+gz,
        (vis*glow*0.26).toFixed(3));

      /* the name rides with its gene, at the gene's own x, off the near rail;
         the two end marks ride the gene's own line, just past each end */
      {
        /* THE NAME IS THE ANSWER, so it becomes the answer's colour. Assignment
           does not produce a mark on a read and nothing else — what it produces
           is a GENE, and the gene's name is already on the belt beside it. It
           grows and turns --ok across the assign stretch, so the step reads as
           the model claiming its reads rather than as thirty separate ticks. */
        const g2=sstep(ASSIGN0-span*0.03,ASSIGN0+span*0.06,gxp);
        const put=(t,wy,op,sc)=>{ const a=P(gxp,wy,base);
          t.setAttribute("transform",
            `translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(-30)`
            +(sc&&sc!==1?` scale(${sc.toFixed(3)})`:""));
          t.setAttribute("fill-opacity",(vis*op).toFixed(3)); };
        gn.lab.setAttribute("fill",g2>0.5?"var(--ok)":"var(--fg3)");
        put(gn.lab,cy+BW/2+K*0.55,0.55+0.42*g2,1+0.55*g2);
        put(gn.p5 ,yOf(-0.055),0.45);
        put(gn.p3 ,yOf( 1.055),0.45);
      }

      for(const rd of gn.reads){
        /* LANDS GENTLY. air goes 1 to 0 over the fall and its slope goes to
           zero with it, so a read settles onto the exon rather than arriving
           at speed and stopping.

           AND IT IS NEVER PARKED. Before the window opened, kk was 0, air was
           1, and the read sat at the nozzle at three-quarter strength waiting
           its turn — thirty reads hanging motionless above every gene, which is
           the opposite of rain. It is now invisible until its own fall starts
           and fades in over the first tenth of it, so the first frame anybody
           sees of a read is a frame in which it is already moving. */
        /* NO RAIN ON THE ASSIGN BELT. Its genes arrive already covered: the
           reads landed one station back, and drawing them falling again would
           say the alignment happens twice. */
        const kk=ASSIGN?1:clamp01((u-(rd.u0-FALL))/FALL);
        const air=Math.pow(1-kk,2.2);
        const flap=flapOf(kk);
        /* one point: dx closes in as it lands, and y comes down off the belt's
           own centre line */
        /* z0 is the read's OWN row, not the exon roof: a stack sits on the
           thing under it, and the top of it is where the next read goes. */
        const rz=exTop+rd.row*RSTEP;
        /* ---- THE VERDICT, AND WHERE A DECLINED READ GOES ------------------
           It fires when the model has carried this read past its own point in
           the sweep, and it holds from there to the end of the belt: a mark
           that fades is a decision being forgotten.

           A CROSS IS ALSO AN EXIT. The read leaves the model it was sitting on,
           slides off the near rail and drops into a bin — the same movement and
           the same box as a fragment with no barcode, because it is the same
           kind of event one step later. */
        /* rd.start, never rd.f: a SPLICED read has fA and fB and no f at all,
           so reading f here put NaN into every coordinate of every read on the
           belt — and it did it through `shunt * (BINY4 - NaN)`, which is NaN
           even when shunt is zero. Multiplying by zero does not rescue an
           undefined; the every-read fields are start and end. */
        const fire=ASSIGN0+rd.start*ASSIGNL;
        const said=ASSIGN&&gxp>fire;
        /* every declined read converges on the same box, so the shunt is
           normalised between its OWN verdict and one shared arrival — the ones
           declared late simply travel faster, which is what happens when a
           machine has one chute */
        const shunt=(ASSIGN&&rd.bad)?sstep(fire+span*0.02,BINX4-span*0.02,gxp):0;
        if(rd.bad && shunt>0.55) shred4=t;
        const rmid=yOf((rd.start+rd.end)/2);
        const rxb=gxp+rd.dx*(1-air)-NOZX*air;
        const dyb=(cy-rd.ymid)*air;           /* the fan, closing as it lands */
        const rx=rxb+shunt*(BINX4-rxb);
        const dy=dyb+shunt*(BINY4-rmid-dyb);
        const z0=rz+NOZZ*air+shunt*shunt*(BIN4.top-rz);
        /* A SHUNTED READ OUTLIVES ITS OWN GENE'S FADE. It is drawn in the
           gene's group, and the gene is already dimming by the time the last of
           them reaches the bin — so once it is off the model it carries its own
           visibility. */
        const rvis=rd.bad?Math.max(vis,sstep(0.04,0.30,shunt)):vis;
        const op=rvis*sstep(0,0.10,kk)*(1-sstep(0.90,1,shunt));
        /* THE POSE IS THE GENE'S, AND ONLY THE GENE'S. The other pose — blue
           flat on a track with the orange standing off it — belongs to E6, and
           moved there with the tracks. What is left here is the molecule on a
           model: aligned end on the exon, barcode end in the air. */
        const Lo=RL*GL, Ta=TAIL*TKNEE;
        const PT=(gy)=>[rx,gy+dy,z0];
        const B2=(node,a,b,w,fl,o)=>barTo(node,w,fl,a[0],a[1],a[2],b[0],b[1],b[2],o);
        if(rd.sp){
          B2(rd.cd ,PT(yOf(rd.fA)),PT(yOf(rd.fA+rd.rlA)),RW,0.62,op);
          B2(rd.cd2,PT(yOf(rd.fB)),PT(yOf(rd.fB+rd.rlB)),RW,0.62,op);
          /* and nothing at all over the intron between them */
          archPath(rd.arc,rx,rd.gap[0],rd.gap[1],z0,dy,ARCH*flap,op*0.95);
        }else{
          B2(rd.cd,PT(yOf(rd.f)),PT(yOf(rd.f+RL)),RW,0.62,op);
        }
        const tail0=PT(yOf(rd.end));
        let ux=TDIR[0]*flap, uy=-(1-flap), uz=TDIR[1]*flap;
        const uL=Math.hypot(ux,uy,uz)||1; ux/=uL; uy/=uL; uz/=uL;
        const kg=[rx+ux*Ta,yOf(rd.end)+dy+uy*Ta,z0+uz*Ta];
        const tg=[rx+ux*TAIL,yOf(rd.end)+dy+uy*TAIL,z0+uz*TAIL];
        const knee=kg, tipp=tg;
        seg(rd.ad,tail0[0],tail0[1],tail0[2],knee[0],knee[1],knee[2],op*0.42);
        /* AND IT COMES UP ON THE TRACK. Still held back — on a belt this end
           has nothing to say and the gene is the subject — but not held back
           to a hairline. It is the piece that carries the cell barcode into
           E6 and the piece the read is about to land on, and a reader who
           cannot see it here cannot follow it there. */
        B2(rd.bc,knee,tipp,RWB,0.36,op*0.58);
        /* the mark rides above the read it is about, and pops the way E3's do */
        /* AND THE MARK GOES WITH THE GENE. A tick is about a read's place on a
           model; off the model there is no place for it to be about, and a
           verdict that follows the read into the next station is a verdict
           being restated. It fades out over the turn rather than blinking. */
        const mkOp=op;
        if(!said || mkOp<=0.02){ rd.mk.setAttribute("stroke-opacity","0"); }
        else{
          const age=(gxp-fire)/(span*0.02);
          const a=P(rx,rmid+dy,z0+n.h*0.34);
          /* PUSHED LEFT, IN SCREEN UNITS. The mark is about a read and the read
             is a line running up-right; sitting on top of it the two overlap
             and neither is legible. A world offset would have to pick an axis
             and every axis here is diagonal — the one direction that is
             unambiguously "off the read" on this projection is straight left. */
          const pop=(age<1?0.55+0.72*age:1.30-0.18*Math.min(1,(age-1)*1.2))*1.06;
          rd.mk.setAttribute("transform",
            `translate(${(a[0]-MKL).toFixed(1)},${a[1].toFixed(1)}) scale(${pop.toFixed(2)})`);
          rd.mk.setAttribute("stroke-opacity",(mkOp*0.92).toFixed(3));
        }
      }
    });
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.belts =(g,n)=>drawGeneBelt(g,n,"align");
DRAW.assign=(g,n)=>drawGeneBelt(g,n,"assign");


/* ============================================================
   E5 · THE SECOND HALF OF THE BELT.

   IT WAS A CUBE ON THE ROW AND THAT DREW THE WRONG THING. Assignment does not
   happen somewhere else: it happens to a read already lying on a gene, on the
   same machine, a moment after the alignment that put it there. A separate box
   downstream says the read gets picked up and carried to another station, which
   is exactly what does not happen.

   So it is an outline on the deck instead — the downstream part of E4's belt,
   with its own footprint, its own name and its own entry in the reader. Two
   named halves of one machine. It draws nothing but its own edge, because
   everything inside it is already being drawn by drawBelts; what it adds is
   WHERE ONE QUESTION STOPS AND THE NEXT BEGINS.

   ITS FOOTPRINT HAS TO MATCH ASSIGN0. The split is a number in drawBelts and a
   node position here, and they are the same line: move ASSIGN0 and move this,
   or the outline will say the sweep starts somewhere it does not.
   ============================================================ */
function drawBeltSeg(g,n){
  hitBox(g,n);
  const x0=n.x-n.w/2, x1=n.x+n.w/2, y0=n.y-n.d/2, y1=n.y+n.d/2, z=n.h;
  const corner=Math.min(n.w,n.d)*0.16;
  /* A BRACKET AT EACH CORNER RATHER THAN A CLOSED RECTANGLE. A full outline on
     a deck that already has rails reads as a third rail; four corners read as a
     region, which is what this is — and it leaves the long sides open where the
     genes cross them. */
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
    const cx=sx<0?x0:x1, cy2=sy<0?y0:y1;
    const a=P(cx-sx*corner,cy2,z), b=P(cx,cy2,z), c=P(cx,cy2-sy*corner,z);
    g.appendChild(el("polyline",{points:pts([a,b,c]),fill:"none",
      stroke:"var(--fg2)","stroke-width":"1.5","stroke-opacity":".55",
      "stroke-linecap":"round","stroke-linejoin":"round"}));
  });
  /* and the line the sweep starts on, which is the only edge of the four that
     is a claim rather than a boundary */
  g.appendChild(el("line",{...(()=>{const a=P(x0,y0,z),b=P(x0,y1,z);
    return {x1:a[0].toFixed(1),y1:a[1].toFixed(1),x2:b[0].toFixed(1),y2:b[1].toFixed(1)};})(),
    stroke:"var(--ok)","stroke-width":"1.4","stroke-opacity":".42",
    "stroke-dasharray":"4 4"}));
}
DRAW.beltseg=drawBeltSeg;


/* ============================================================
   E6 · BUCKET BY CELL — thirty tracks, and a read on each is a cell's read.

   IT IS ITS OWN MACHINE FOR THE SAME REASON E5 IS. Bucketing was the far end of
   the assign belt for a while, which drew the reads being carried from one step
   to the next on one surface. They are not carried: assignment ends with a read
   that has a gene, and bucketing begins with a read that has a barcode, and
   between those two facts there is no conveyor.

   SO THEY RAIN IN, the way they rained onto the models at E4. That is the join
   this page uses everywhere it does not want to claim continuity — fade out
   there, appear fresh here — and rain says something the fade alone does not:
   the reads arrive from a population, one at a time, in no order.

   AND THIS IS WHERE THE BLUE LEADS. On a gene the barcode end is the part with
   no position and it stands off every axis that means one. On a track there is
   no gene and nothing is being placed: what travels is the READ, and the thing
   that says which read it is is the barcode. So the blue lies along the track
   with its middle on it and the aligned end takes over the pose the blue has
   just given up. The two swap, and the swap is the whole content of the step.
   ============================================================ */
function drawTracks(g,n){
  hitBox(g,n);
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const rnd=mulberry32(0x5eedf15^0xC4);
  const x0=n.x-n.w/2, x1=n.x+n.w/2, span=x1-x0, cy=n.y;
  /* K COMES OFF n.gd, NOT n.d, AND THIS IS THE ONE STATION WHERE THEY DIFFER.

     On the belts the two are the same thing: a gene lies across the belt, so
     the belt's depth sets the fragment's size. Here there is no gene — the
     depth is the FIELD, thirty tracks wide, and it has to be wide enough to
     write two rows of type between neighbouring lines. Sizing the fragments off
     that would make them four times what they were one station back, and the
     one thing this read has to be is the same read. n.gd is the depth the
     fragments were sized against; n.d is how far the field spreads. */
  const K=(n.gd||n.d)*0.1053, KZ=n.h/0.53;
  const base=n.h*0.245, GL=(n.gd||n.d)*0.70;
  const RTOT=0.145, RL=RTOT*64/154, RG=RTOT*32/154, RB=RTOT*58/154;
  const GW=K*0.30, RW=GW*0.047, RWB=RW*0.62;
  const TDIR=[-0.86,0.51];
  const TAIL=(RG+RB)*GL, TKNEE=RG/(RG+RB);
  /* THE READ IS DRAWN LARGER HERE, AND IT IS THE SAME READ MAGNIFIED.

     Two of its three facts are written on it, and a label has to be able to sit
     over the segment it belongs to — the gene over the aligned end, the UMI's
     ten bases over the barcode end. At the size a read is on a belt the UMI
     alone is three times the blue it names. So the whole molecule is scaled,
     both halves together, which keeps the 64 : 90 the rest of this page draws.
     E2 does the same thing for the same reason: one read out of the pool, drawn
     big enough to carry writing.

     RS TRADES AGAINST HOW MANY READS FIT ON A TRACK. At 2.7 a fragment is 1.8
     units end to end and four of them fit a lap with room for their labels;
     push it further and the tracks thin out until the repetition stops being
     visible, which is the one thing this station is for. */
/* THE READ IS MAGNIFIED FURTHER ON THIS MAP, AND IT HAS TO BE. RS is what
     makes a fragment on a track big enough to write its gene and its UMI along
     its two halves — each label underlines the segment it came off, which is
     the whole reason no legend is needed. The drawing shrank by 2.4 and the
     type by only 1.55, so at the reading-scale RS the writing was half again
     longer than the molecule under it and the two labels ran into each other
     and into their neighbours. Carrying the same boost keeps a label the same
     fraction of its own segment as it is on /FASTQ_pipe. It costs reads per
     track, which is why the track count came down with it. */
  const RS=2.9*TBof(n);
  const Lo=RL*GL*RS, Ta=TAIL*TKNEE*RS, Lb=(TAIL-TAIL*TKNEE)*RS;
  const v=(n.v||1.05)*K;

  /* the track field: spacing off the type, exactly as before */
  /* THE SPACING IS SET BY THE TYPE, and here there are TWO rows of it between
     neighbouring tracks: the cell's name above its own line, and its reads'
     gene and UMI below. Half of S times TP is the clear air perpendicular, and
     it has to hold both — at the belts' 0.085 of a gene it held one, and the
     read tags collided with the next track's name fifty-seven times. */
  /* THE SPACING IS SET BY HOW FAR A FRAGMENT REACHES TOWARD THE TRACK ABOVE
     IT, not by the type alone. The aligned end stands up and up-belt, and on
     this projection that lands about 5.8 screen units per unit of length toward
     the previous track — times RS, plus the gene name sitting over it. What has
     to clear is that whole stack, and S * cos30 * TP is the clear air there.
     TWENTY TRACKS AT THIS SPACING is what fits between the row above and the
     band; more tracks means a narrower gap and a name over somebody else's
     line. */
  /* TEN, HALVED FROM TWENTY. E7 forks every one of these into two at the same
     pitch, so twenty here would be forty there — at half the spacing, with the
     split as the one thing on the page you could not see. The point about
     emptiness survives the halving: it is the RATIO of empty lanes that says
     it, not the count. */
  /* TEN TRACKS RATHER THAN THIRTY. Each carries a cell name along it and a
     read with a gene and a UMI written on its two halves; at this type size
     thirty of them is one blue smear. Ten still shows what the field is for
     — most of them empty, a few busy — which is the whole claim. */
  /* TEN, WHICH IS WHAT /FASTQ_pipe DRAWS. This defaulted to 30 for a build,
     taken from prose describing an earlier version of that page rather than
     from its code — so the copy of this field on row 6 drew three times the
     traffic the original does and its cell names collided all the way down.
     Read the shape, not the write-up. */
  const NT=n.tracks||10, TP=n.d*0.94/NT;
  const trackY=k=>cy+(k-(NT-1)/2)*TP;
  /* THREE SIZES, AND EACH IS SET BY WHAT IT HAS TO SIT OVER.
       CAP  the field's one caption, biggest, because it is read once
       CFS  a cell's name, over its own track
       LFS  a read's gene and UMI, over their own segments — bold, because at
            this size weight is the only thing that separates them from the
            grid they are drawn on. */
  const GFS=TYPEof(n,6,10.4*K);
  const LFS=Math.max(4.4*FQSof(n)*TBof(n),GFS*0.70), GLS=LFS*2, CFS=LFS*1.8, CAP=CFS*1.5;
  const lz=base+n.h*0.05;

  /* ---- WHICH CELL EACH TRACK IS, AND HOW LITTLE IS IN MOST OF THEM -------
     Three rounds of ligation address 96 x 96 x 96 = 884,736 cell barcodes per
     subpool. Thirty tracks is a window onto that, so they are LABELLED WITH
     THEIR PLACE IN IT rather than 1..30 — ascending, spread across the space,
     because sorting by cell is the whole of what this node does.

     AND MOST OF THEM ARE EMPTY. That is not a drawing convenience: the matrix
     this row ends at is every barcode by every gene, and the reason it is
     "unfiltered" is that the overwhelming majority of addressable barcodes were
     never a cell. An even sprinkle across thirty tracks would draw a machine
     working evenly, which is the one thing this stage is not.

     (Note for the count: W1 says 48 x 96 x 96 = 442,368 addressable WELL PATHS,
     which is a different quantity — BC1's 48 wells each hold two primers
     carrying different barcodes, so there are 96 BC1 barcodes and 884,736
     barcode combinations. Both numbers are right about different things and
     both are on the map; do not "fix" one to match the other.) */
  const CELLSPACE=884736;
  const lanes=[];
  { let c=Math.floor(rnd()*8000)+1;
    for(let k=0;k<NT;k++){
      /* empty, thin, or busy — and empty wins most of the time */
      const r=rnd();
      /* AND A BUSY TRACK IS CAPPED, because two reads on one line are two tags
         on one line: the cap is the loop divided by how long a tag is. It is a
         drawing limit and not a claim about depth — the pool below is what says
         a UMI repeats. */
      const m=r<0.50?0:(r<0.78?1+Math.floor(rnd()*2)
                              :2+Math.floor(Math.pow(rnd(),1.5)*3));
      lanes.push({cell:c,m,reads:[]});
      c+=Math.floor(1+rnd()*(CELLSPACE/NT*1.6));
    } }
  const fmt=v=>String(v).replace(/\B(?=(\d{3})+(?!\d))/g,",");

  const labs=[];
  for(let k=0;k<NT;k++){
    const a=P(x0,trackY(k),base), b=P(x1,trackY(k),base);
    g.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
      x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg3)",
      "stroke-width":"1.8","stroke-opacity":(lanes[k].m?".40":".22"),
      "stroke-linecap":"round"}));
    /* ROTATE 30, because a track runs along +x and +x goes DOWN and to the
       right on this projection. The name rides at a negative y in its own
       rotated frame, so the track is its underline. */
    const t2=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(30)`,
      x:(CFS*0.55).toFixed(1), y:(-CFS*0.38).toFixed(1),
      "text-anchor":"start","font-family":FQ_MONO,fill:"var(--fg3)",
      "font-size":CFS.toFixed(1),"font-weight":"500",
      "fill-opacity":(lanes[k].m?".62":".34")});
    t2.textContent="cell "+fmt(lanes[k].cell); labs.push(t2);
  }
  /* WHAT THE WINDOW IS A WINDOW ONTO, said once, in three short lines on the
     field's own bottom-left edge.

     THREE ROWS AND NOT ONE. As a single line it was wider than the field it
     belonged to, which meant it could not be both centred on the node and clear
     of the belt one station back — every placement that fixed one broke the
     other. Broken over three, the longest row is narrower than the edge it sits
     on and the whole problem goes away.

     THE EDGE, NOT THE CENTRE. The bottom-left edge of the footprint runs from
     the left vertex to the bottom one — the y = far-side edge, running in x, so
     on screen it lies at the tracks' own thirty degrees. The block is centred on
     its midpoint and set just outside it, which is why it reads as this field's
     caption and sits against the thing it is captioning instead of floating
     below in open ground. */
  {
    const a=P(n.x, n.y+n.d/2+0.95, base);
    const t3=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(30)`,
      "text-anchor":"middle","font-family":FQ_MONO,fill:"var(--fg3)",
      "font-size":CAP.toFixed(1),"font-weight":"600",
      "letter-spacing":(CAP*0.06).toFixed(2),"fill-opacity":".62"});
    [NT+" of "+fmt(CELLSPACE), "96 × 96 × 96", "most are empty"]
      .forEach((line,i)=>{
        /* the FIRST row is lifted a row, so the block's middle line sits on the
           anchor and the block as a whole is centred on the edge rather than
           hanging off it */
        const sp=el("tspan",{x:"0",dy:(i?CAP*1.22:-CAP*1.22).toFixed(1)});
        sp.textContent=line; t3.appendChild(sp); });
    labs.push(t3);
  }

  /* ---- THE READS, AND THE THREE FACTS EACH ONE CARRIES --------------------
     A read arriving here has three: the cell barcode it has carried since E3,
     the gene it was assigned at E5, and the UMI that came in on R2 at the very
     start and has not been used for anything yet.

     THE CELL IS THE BLUE BAR AND THE TRACK IT IS ON — it is not written on the
     read, because writing it thirty times over on one track is a caption for
     the track, and the track already has one. The gene and the UMI ride with
     the read as text, in the two tokens they belong to: --ok for the gene,
     because that verdict was struck one station back, and --accent for the UMI,
     because it is R2's and has been R2's since E2.

     AND THEY REPEAT, WHICH IS THE WHOLE SETUP FOR E7. A track carries one or
     two genes over and over — that is what depth on a cell looks like — and its
     UMIs are drawn from a pool smaller than the number of reads, so most are
     unique and some turn up two, five, a dozen times. If every read in a track
     looked distinct there would be nothing for deduplication to do and the next
     station would read as an empty gesture. */
  /* THE TWO ANGLES THE LABELS LIE AT, taken off the projection rather than
     written down, so a change to TDIR or to the camera carries into the type
     instead of leaving it beside the thing it names. Each is the direction that
     READS — the reverse of the segment's own, where the segment runs up-left,
     because text has to advance to the right. */
  const ANGB=(()=>{ const o=P(0,0,0), u=P(1,0,0);
    return (Math.atan2(u[1]-o[1],u[0]-o[0])*180/Math.PI).toFixed(2); })();
  const ANGO=(()=>{ const o=P(0,0,0), u=P(-TDIR[0],0,-TDIR[1]);
    return (Math.atan2(u[1]-o[1],u[0]-o[0])*180/Math.PI).toFixed(2); })();

  /* WHERE THEY COME FROM, AND HOW MUCH OF A FAN IT IS.

     They are meant to look like the spill off the end of the belt next door, so
     they start CLOSE — a little up-belt and a little above, not out of a nozzle
     halfway across the map. And they start SPREAD: at FAN = 1 every read in the
     air is over the field's centre line and the twenty tracks do all the
     spreading at the last moment, which draws a jet rather than a fall. At 0.34
     the fan in the air is already two thirds of the fan on the ground, so what
     closes on landing is a nudge onto a rail instead of a swerve across the
     field. */
  const NOZX=1.5*K, NOZZ=1.75*KZ, FAN=0.34;
  /* THE RUNWAY IS NOT SYMMETRIC, AND THAT IS THE POINT.

     A read has to be in the air, in E5's pose, travelling downstream, for long
     enough that a reader takes the shape in BEFORE anything happens to it. That
     is the whole of PADA: five gene-units of open sky upstream of the first
     track, flown level. Downstream there is nothing to establish, so PADB is
     almost nothing — a symmetric pad would spend the same distance again on an
     empty field after the last read has already faded. */
  const PADA=5.2*K, PADB=0.6*K, LOOP=span+PADA+PADB;
  /* FALL is how much of a lap the descent takes and UBASE is where the earliest
     of them may touch down. TOUCHING DOWN BEFORE THE TRACKS BEGIN IS THE BUG
     THIS FIXES: with the fall able to start before the lap did, a read whose
     u0 was smaller than the fall length appeared already a third of the way
     through it, which is what "it comes out of nowhere too close to the track"
     was. u0 is now measured from the runway's own end, so every read gets the
     whole of it. */
  /* AND IT TOUCHES DOWN BEFORE THE FIRST TRACK, NOT AFTER IT. The cell names
     live at the field's near end and run a unit and a half along their own
     lines; a read still turning as it crosses them puts a whole diagonal
     molecule through somebody's name. Landing a little upstream of x0 means the
     thing that passes through the names is a fragment lying flat on a rail,
     which is what a rail is for. */
  const FALL=0.30, UBASE=PADA/LOOP-0.075;
  const BASES="ACGT";
  const umiOf=()=>{ let q=""; for(let i=0;i<10;i++) q+=BASES[Math.floor(rnd()*4)]; return q; };
  const reads=[];
  lanes.forEach((ln,k)=>{
    if(!ln.m) return;
    /* one dominant gene and sometimes a second: a cell is not a survey */
    const gn1=GENE_NAMES[Math.floor(rnd()*GENE_NAMES.length)];
    const gn2=GENE_NAMES[Math.floor(rnd()*GENE_NAMES.length)];
    /* A POOL PER GENE, SMALLER THAN THE READ COUNT, sampled with a skew, so
       the duplicates land on a few of its entries rather than spreading evenly.

       PER GENE AND NOT PER TRACK, because what E7 collapses is cell AND gene
       AND UMI together. A repeated UMI carried by two different genes is not a
       duplicate molecule, it is a collision between two — and drawing one is
       drawing the next station a job it does not have. */
    const pools={};
    const umiFor=gn=>{ let q=pools[gn];
      if(!q){ q=pools[gn]=[]; const np=Math.max(1,Math.ceil(ln.m*0.45));
        for(let i=0;i<np;i++) q.push(umiOf()); }
      return q[Math.min(q.length-1,Math.floor(Math.pow(rnd(),1.8)*q.length))]; };
    for(let j=0;j<ln.m;j++){
      const grp=g.appendChild(el("g"));
      const gene=(rnd()<0.78?gn1:gn2);
      const umi=umiFor(gene);
      /* ONE LABEL PER SEGMENT, EACH LYING ALONG ITS OWN. The gene goes over the
         aligned end and the UMI over the barcode end, so the two pieces of the
         molecule ARE the two underlines and no legend is needed to say which
         fact came from which end of the read. Bold, because at this size
         against this grid weight is what makes them text. */
      const mk=(sz,col)=>el("text",{"text-anchor":"start","font-family":FQ_MONO,
        "font-size":sz.toFixed(1),"font-weight":"700",fill:col,
        "fill-opacity":"0"});
      /* THE GENE IS TWICE THE UMI, because they are not two labels of equal
         standing. The gene is the answer this row has been working toward since
         E4; the UMI is a serial number that means nothing until E7 counts it.
         The gene overhangs its orange at this size and that is the trade: the
         orange still says which end it came off, which is all the underline was
         ever doing. */
      const tg=mk(GLS,"var(--ok)"); tg.textContent=gene;
      const tu=mk(LFS,"var(--accent)"); tu.textContent=umi;
      reads.push({tk:k, ph:(j+0.5+(rnd()-0.5)*0.5)/ln.m, u0:UBASE+rnd()*0.10,
        cd:grp.appendChild(el("polygon",{fill:"var(--cull)","fill-opacity":"0",stroke:"none"})),
        ad:grp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
          "stroke-opacity":"0","stroke-linecap":"butt"})),
        bc:grp.appendChild(el("polygon",{fill:"var(--accent)","fill-opacity":"0",stroke:"none"})),
        tg, tu});
    }
  });
  /* the tags go on last, over the fragments, for the reason the track names do */
  reads.forEach(r=>{ labs.push(r.tg); labs.push(r.tu); });
  labs.forEach(t2=>g.appendChild(t2));

  const DASHN=7;
  const barTo2=(node,w,minHW,a,b,op)=>{
    const p1=P(a[0],a[1],a[2]), p2=P(b[0],b[1],b[2]);
    const dx=p2[0]-p1[0], dy=p2[1]-p1[1], L=Math.hypot(dx,dy)||1;
    const hw=Math.max(minHW,w*S/2), hx=-dy/L*hw, hy=dx/L*hw;
    node.setAttribute("points",[[p1[0]+hx,p1[1]+hy],[p2[0]+hx,p2[1]+hy],
      [p2[0]-hx,p2[1]-hy],[p1[0]-hx,p1[1]-hy]]
      .map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" "));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
  };
  const seg2=(node,a,b,op)=>{
    const p1=P(a[0],a[1],a[2]), p2=P(b[0],b[1],b[2]);
    node.setAttribute("x1",p1[0].toFixed(1)); node.setAttribute("y1",p1[1].toFixed(1));
    node.setAttribute("x2",p2[0].toFixed(1)); node.setAttribute("y2",p2[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
    const d=Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/(2*DASHN-1);
    node.setAttribute("stroke-dasharray",d.toFixed(2)+" "+d.toFixed(2));
  };

  let t=0;
  const run=dt=>{
    t+=dt;
    for(const rd of reads){
      const u=((t*v/LOOP+rd.ph)%1+1)%1;
      const gx=x0-PADA+u*LOOP;
      /* A LONGER FALL, because the pose has to be legible before it changes.
         At 0.09 of the lap the whole descent was over in about a second and the
         shape it arrives in never registered. */
      const kk=clamp01((u-(rd.u0-FALL))/FALL);
      const air=Math.pow(1-kk,1.8);
      const ty=trackY(rd.tk);
      const cx=gx-NOZX*air;
      /* the fan closes as it lands, but only part of the way: they come off the
         belt already spread, and the landing is the last third of it */
      const yy=ty+(cy-ty)*air*FAN, zz=lz+NOZZ*air;
      /* AND IT FADES UP OVER THE FIRST OF THE RUNWAY, not over the first of the
         fall: the whole point of the runway is to be seen flying along it. */
      const vis=Math.min(sstep(x0-PADA,x0-PADA+K*1.1,gx),
                         1-sstep(x1-span*0.14,x1-K*0.1,gx));
      /* IT ARRIVES IN E5'S POSE AND UNFOLDS INTO E6'S.

         THE TWO POSES ARE THE SAME MOLECULE HELD TWO WAYS. On a belt the
         ALIGNED end lies flat along the gene and the BARCODE end stands off it
         in TDIR: the gene is the subject and the barcode has nothing to say. On
         a rail it is the other way round — the BARCODE end lies flat along the
         track, because the track IS the barcode, and the aligned end stands off
         in TDIR carrying the gene's name. Same hinge, same angle, opposite
         arms. Landing is where the read stops being about a gene and starts
         being about a cell, and this is that sentence drawn.

         SO IT IS NOT A ROTATION, IT IS AN UNFOLD. Both arms swing about the one
         hinge and swap places: the orange comes off the ground and up onto the
         aerial while the blue comes down off the aerial onto the rail, and the
         adapter between them — J to J + TDIR * Ta — is the same segment in both
         poses and never moves relative to the hinge. That is what makes the two
         ends readable as the same molecule through the middle of the change.

         q IS 1 IN E5'S POSE AND 0 IN E6'S, and it HOLDS AT 1 for the first
         two fifths of the fall. The shape has to register before it changes, or
         the unfold is just a flicker. It reaches 0 as the read touches, not
         before: what lands is the pose the rail is drawn for. */
      /* q IS CLOCKED OFF kk AND NOT OFF air, and that is why the hold reads.
         air is kk raised to a power — it is the HEIGHT, and it falls away fast
         by design so the landing is soft. Clocking the unfold off it spent the
         hold in the first sixth of the descent and then whipped through the
         change. On kk the hold is what it says it is: E5's pose, flown level
         and then carried down unchanged, for the first two fifths of the fall,
         and the last of the turn arriving with the read on the rail. */
      const q=1-sstep(0.50,0.97,kk);
      const mix=(a,b)=>{ const v=[a[0]+(b[0]-a[0])*(1-q),
                                 a[1]+(b[1]-a[1])*(1-q),
                                 a[2]+(b[2]-a[2])*(1-q)];
        const L=Math.hypot(v[0],v[1],v[2])||1;
        return [v[0]/L,v[1]/L,v[2]/L]; };
      const dU=[TDIR[0],0,TDIR[1]];                 /* the hinge's own arm */
      const dB=mix(dU,[1,0,0]);                     /* barcode end: aerial -> rail */
      /* +y AND NOT -y, AND THIS IS THE WHOLE OF THE REVERSE L. The junction has
         to sit at the orange's RIGHT end so the adapter comes off that side and
         the barcode end follows it — which is how E5 draws it, the aligned end
         running down-left away from the hinge. With the sign the other way the
         same three pieces make the mirror image: a letter L instead of a
         reversed one, and the read stops looking like the one that left the
         belt. (Measuring this against E5 needs care: the two stations build
         their quads through different helpers with different corner orders, so
         comparing raw point lists compares nothing. Take the direction from the
         ADAPTER's junction to the far end of each strip.) */
      const dO=mix([0,1,0],dU);                     /* aligned end: gene -> aerial */
      /* the blue's MIDDLE is the thing that ends up on the track, so it is the
         thing the whole molecule is hung from */
      const bA=[cx-dB[0]*Lb/2, yy-dB[1]*Lb/2, zz-dB[2]*Lb/2];
      const bB=[cx+dB[0]*Lb/2, yy+dB[1]*Lb/2, zz+dB[2]*Lb/2];
      const J =[bA[0]-dU[0]*Ta*q, bA[1]-dU[1]*Ta*q, bA[2]-dU[2]*Ta*q];
      const kx=[J[0]+dU[0]*Ta, J[1]+dU[1]*Ta, J[2]+dU[2]*Ta];
      const oB=[J[0]+dU[0]*Ta*(1-q), J[1]+dU[1]*Ta*(1-q), J[2]+dU[2]*Ta*(1-q)];
      const oEnd=[oB[0]+dO[0]*Lo, oB[1]+dO[1]*Lo, oB[2]+dO[2]*Lo];
      /* AND ON THE RAIL THE BLUE IS THE HEAVIEST THING ON THE READ. It is the
         sort key here — the track it is lying on IS this segment — so it is
         floored wider than the aligned end that was the subject next door. */
      barTo2(rd.bc,RWB,0.44,bA,bB,vis*0.95);
      seg2(rd.ad,J,kx,vis*0.42);
      barTo2(rd.cd,RW,0.62,oB,oEnd,vis);
      /* THE TWO FACTS THAT ARE NOT ALREADY DRAWN, each lying along the piece of
         the molecule it came off. The gene sits over the ORANGE at the orange's
         own angle, so the aligned end underlines it; the UMI sits over the BLUE
         at the track's angle, so the barcode end underlines that. Both are set
         from the segment's far end and read back down it, because Latin type
         has to advance to the right and only one of each segment's two
         directions does that on this projection. */
      { const qo=P(oEnd[0],oEnd[1],oEnd[2]), qb=P(bA[0],bA[1],bA[2]);
        /* AND THEY STAY OFF UNTIL THE READ IS CLEAR OF THE CELL NAMES. Those
           sit at the field's near end and run about two units along their own
           tracks; a read that lands under one puts its gene and UMI through the
           name of the cell in the next lane. It is the one collision in this
           field that no amount of spacing fixes, because the two are on
           different lines going the same way. */
        /* AND THE GATE CARRIES THE TYPE BOOST TOO. This is the one collision in
           the field that no amount of spacing fixes, because a cell's name and
           a read's labels are on different lines going the same way — so a
           read's writing stays off until it is clear of the names at the near
           end. How far that is depends on how long a cell name is, and on this
           map a name is 1.55x longer relative to the field than at reading
           scale. Left alone the gate opened under the names and the text check
           reported four of them at once. */
        const op=(vis*0.86*sstep(x0+K*2.6*TBof(n)*TBof(n),x0+K*4.0*TBof(n)*TBof(n),gx)).toFixed(3);
        rd.tg.setAttribute("transform",
          `translate(${qo[0].toFixed(1)},${qo[1].toFixed(1)}) rotate(${ANGO})`);
        rd.tg.setAttribute("x",(GLS*0.20).toFixed(1));
        rd.tg.setAttribute("y",(-GLS*0.34).toFixed(1));
        rd.tg.setAttribute("fill-opacity",op);
        rd.tu.setAttribute("transform",
          `translate(${qb[0].toFixed(1)},${qb[1].toFixed(1)}) rotate(${ANGB})`);
        rd.tu.setAttribute("x",(LFS*0.25).toFixed(1));
        rd.tu.setAttribute("y",(-LFS*0.42).toFixed(1));
        rd.tu.setAttribute("fill-opacity",op); }
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.tracks=drawTracks;


/* ============================================================
   E7 · DEDUPLICATE UMIs — E6's field, forked

   IT IS E6's FIELD AND NOT A NEW ONE. Same lane pitch, same read at the same
   size, same three type sizes, same cell names on the same rails. A reader who
   has just understood E6 should not have to learn a second machine to read
   this one — the only new thing here is what happens at the fork, and every
   other difference would be noise competing with it.

   THE FORK DOUBLES THE FIELD. Ten lanes come in; twenty go out, at the same
   pitch, so the element is literally twice as wide downstream as upstream. Each
   lane splays into its own pair and the pair keeps the parent's place: the
   children of lane k straddle exactly twice k's offset from the centre line, so
   the fan is a doubling and not a reshuffle. That is why E6 dropped to ten
   lanes — twenty in would be forty out, at half the pitch, and the split would
   be the one thing on the page you could not see.

   AND THE TWENTY THEN FAN, PROPORTIONALLY FROM THE MIDDLE. They used to run
   parallel from the splay to the far end, which draws the fork as something
   that happens once and is then over — but what leaves this station is twice
   what arrived, and the field has to be seen making room for it. Each rail
   opens by a share of its OWN offset from the centre line, so the middle pair
   barely moves and the outermost pair moves most: one stream becoming many
   sub-streams, each taking more ground than the stream did. Spreading them all
   by the same distance instead translates the field outward in two halves with
   a hole down the middle, which is not a fan.

   THE ONLY MERGE ON THE MAP, AND IT MUST NOT LOOK LIKE A REJECT. E3 shreds
   reads whose barcode is on no whitelist and E5 shunts reads that landed on no
   gene; both use the cull colour and a chute. A duplicate is neither. It is one
   molecule photographed twice, so nothing here is binned and nothing is thrown
   away — the lane forks and both roads carry something true.

     READS      every observation, always
     MOLECULES  every distinct thing observed

   TWO TOKENS AND NO NEW HUE. The reads lane is --fg2, plain, because an
   observation carries no encoding: it is a count of things that happened. The
   molecules lane is --accent, which is the UMI's own colour and has been since
   E2 — and a molecule is distinct exactly when its UMI is. Neither is --ok or
   --cull, because neither road is a verdict.
   ============================================================ */
function drawDedup(g,n){
  hitBox(g,n);
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const rnd=mulberry32(0x5eedf15^0xD7);
  const x0=n.x-n.w/2, x1=n.x+n.w/2, span=x1-x0, cy=n.y;
  /* every one of these is E6's, unchanged */
  const K=(n.gd||n.d)*0.1053, KZ=n.h/0.53;
  const base=n.h*0.245, GL=(n.gd||n.d)*0.70;
  const RTOT=0.145, RL=RTOT*64/154, RG=RTOT*32/154, RB=RTOT*58/154;
  /* THE READ IS HEAVIER HERE THAN ON EITHER BELT, AND THAT IS NOT AN
     INCONSISTENCY. At E4 a read is one of a hundred lines piled on a gene and
     the count is the argument, so it is drawn as a line: 0.047 of a gene's own
     width, floored just over a pixel. This field carries two reads a lane, and
     what has to read is not how many lines there are but what the ONE object
     under the beam is made of — three parts, in the order they travel. At the
     belt's weight it was a hairline lying on a rail of very nearly the same
     weight, and the two came apart only when you went looking. Doubled, with
     the rails held back (see the fan below), the fragment is the brightest
     thing in its own lane, which is what this station is about. */
  const GW=K*0.30, RW=GW*0.095, RWB=RW*0.70;
  const FLOOR_O=1.05, FLOOR_B=0.85;   /* screen half-widths: orange, then blue */
  const TDIR=[-0.86,0.51];
  const TAIL=(RG+RB)*GL, TKNEE=RG/(RG+RB);
  /* A THIRD OF E6'S READ, LAID FLAT ALONG THE RAIL, AND CARRYING NO WRITING.

     E6's read stands its aligned end up in the air and writes a gene name and a
     UMI on itself, and that is right there: E6 is where a read acquires the
     three facts and they have to be legible. By the time it reaches this field
     the facts have been read. What E7 is about is HOW MANY — one number that
     stays and one that stops — and forty labelled molecules arriving at the
     fork buried that under its own evidence.

     So the molecule keeps its three parts and its proportions and loses
     everything else: aligned end, adapter, barcode end, all in a line on the
     track, in the order they travel. The WIDTHS are not scaled down with the
     length — they come off K, not RS — so a third-length fragment is a short
     solid bar rather than a hairline. */
  const RS=0.97;
  const Lo=RL*GL*RS, Ta=TAIL*TKNEE*RS, Lb=(TAIL-TAIL*TKNEE)*RS;
  const FT=Lo+Ta+Lb;
  const v=(n.v||1.62)*K;
  const GFS=TYPEof(n,6,10.4*K);
  /* THE ONE TYPE SIZE THAT IS NOT E6's. The gene name is twice the UMI there,
     which is right when a lane carries one read at a time. Here every lane's
     neighbour carries that read's own copy, so the gene names arrive in pairs
     one pitch apart and at double size they land on each other's rails. Read
     size, lane pitch, cell name and UMI are all E6's; this one is the price of
     the fork. */
  const LFS=Math.max(4.4*FQSof(n)*TBof(n),GFS*0.70), CFS=LFS*1.8, NFS=CFS*0.92;

  /* SIX LANES IN, TWELVE OUT. Ten in was twenty out, and twenty pairs of
     READS/MOLECULES counters at this type size ran into each other down the
     whole fanned end. Six still doubles visibly, which is what the fork is. */
  const NL=n.lanes||10, NO=NL*2;
  const lz=base+n.h*0.05;

  const LANE0=x0-0.8;
  const FORK=x0+span*0.24;
  const RAILEND=x1-2.9;
  const LOOP=(RAILEND-LANE0);

  /* ---- THE FAN: ONE CURVE FROM THE FORK, AND NOTHING BEFORE IT -------------
     THERE WAS AN ELBOW AND IT WAS THE WHOLE PROBLEM. The field used to be built
     in two legs: a straight splay from the fork out to a point a fifth of the
     way down the field, and then a second straight run from there to the end
     which carried the fan. Two straights meeting at an angle is a corner, and a
     corner a fifth of the way along said the lanes changed their minds — the
     split happened at the scanner, then stopped, then something else started.
     Nothing happens at that point. It was an artefact of building the splay and
     the fan as separate ideas.

     So there is one function now, from the fork to the far end, and every rail
     is a sampled curve rather than two segments. A lane leaves the beam and
     opens continuously for the whole rest of its run.

     fanE IS MOSTLY LINEAR WITH SOME EASE OUT. Pure linear draws a straight
     splay, which is honest but hard — twenty lines radiating from one point,
     and at the fork the outer ones leave almost across the field. Pure ease-out
     spends the whole opening in the first fifth and ends parallel, which is the
     old elbow again with the corner rounded off. The blend leaves the fork
     briskly (slope 1.35 of the average) and is still opening when it arrives
     (0.65), so the field never stops widening and never looks hinged.

     AND THE TWO CHILDREN OF A FORK STAY A PAIR. They leave the same point and
     end 2·PAIR apart, against a pair-to-pair pitch of 2·HALF/9 — about one to
     two, so the eye groups them without being told. That is what the station
     is: not twenty lanes, but ten lanes that each became two. Spread evenly
     across the same width they read as twenty unrelated rails and the fork
     stops being visible at the far end, which is the only end a reader looks
     at while the counters are climbing. */
  /* HALF IS PINNED BY THE MATRIX AND NOT BY TASTE. The outermost rail lands at
     HALF·(1+the pair's share), and the field's +y extreme projects DOWN-LEFT —
     straight into E8's cube, which stands immediately downstream and is the
     largest footprint on this half of the map. At 0.575 the bottom three pairs
     ran under it and two of their counters were occluded by it. Half the node's
     own depth is the ceiling, and the fan gets its width from the RATIO of the
     far end to the fork (SPREAD, 2.30 against the 1.62 this had before) rather
     than from reaching further out. If it ever has to be wider than this, the
     thing that moves is E8. */
  const HALF=n.d*0.500;                    /* the outermost PAIR CENTRE's offset */
  /* AND THE PAIR GAP CARRIES THE TYPE BOOST. The two rails of a pair have to be
     far enough apart to write READS above MOLECULES between them, so what sets
     this is the type and not the drawing — and the type on this map is 1.55x
     larger than a proportional shrink. Left at the reading-scale figure the two
     counters of every pair overlapped by about 30%, which is what the text
     check reported first. The pairing ratio drops from about 1:3.6 to 1:2.2 and
     still reads as ten pairs rather than twenty rails. */
  const PAIR=HALF*0.0240*TBof(n);               /* half the separation inside one pair */
  const SPREAD=2.30;                       /* far offset ÷ fork offset */
  const PIN=(HALF/SPREAD)/((NL-1)/2);      /* the incoming lane pitch */
  const TP=PIN/2;                          /* the unit the scanner and its caption use */
  const yIn=k=>cy+(k-(NL-1)/2)*PIN;
  /* j is 0 for the reads road and 1 for the molecules road, which keeps the
     reads side at the lower y it has always been on. */
  const yEnd=(k,j)=>cy+(k-(NL-1)/2)*PIN*SPREAD+(j?PAIR:-PAIR);
  /* THE PAIRING IS A RATIO AND THE RATIO IS WHAT DOES THE WORK. 2·PAIR against
     a pair-to-pair pitch of 2·HALF/9 is about one to two and a half. At one to
     one and a half — which is where it landed first — twenty rails at slightly
     uneven spacing read as twenty rails at uneven spacing, not as ten pairs.
     WIDENING THE FAN IS THE LEVER, NOT NARROWING THE PAIR: the gap inside a
     pair has to stay wide enough to write READS above MOLECULES between the two
     lines, so it is fixed by the type and the fan is what moves. */
  const fanE=u=>0.20*(1-(1-u)*(1-u))+0.80*u;
  /* WHERE LANE k's CHILD j IS AT ANY x, and the ONLY answer to that question.
     It is the identity upstream of the fork, so one expression covers the
     approach, the split and the run, and a read cannot come off its own rail at
     a join because there is no join. */
  const yRail=(k,j,gx)=>{
    const u=clamp01((gx-FORK)/((RAILEND-FORK)||1));
    return yIn(k)+(yEnd(k,j)-yIn(k))*fanE(u);
  };

  /* ---- ONE CYCLE, AND IT IS NOT A CONVEYOR ---------------------------------
     Everywhere else on this page a thing travels at one speed and something
     happens to it in passing. Here the machine has to be seen ASKING, so the
     read arrives, SLOWS, STOPS, is scanned along its barcode end, gets an
     answer, and only then leaves. A fragment that sails through a scanner at
     constant speed is a fragment nobody looked at.

     The fractions are of one lap. Nothing is tuned to taste: the dwell has to
     be shorter than the gap between two reads on a lane, or two of them are
     stopped under the beam at once and the queue reads as a pile-up. Two reads
     a lane puts them half a lap apart against a scanner neighbourhood of about
     0.30, which is the clearance the old three-or-four did not have. */
  const APP=0.40,      /* rolling in, decelerating into the stop */
        SCN=0.50,      /* stopped, the beam crossing the read once */
        VER=0.57,      /* stopped, the answer showing */
        /* there is no fourth mark: the run from the fork to the far end is ONE
           accelerating move, and the point that used to split it in two was the
           elbow the rails have just lost */
        END=0.96;      /* at the far end — where the count ticks */
  const ATICK="M -3.4 0.3 L -1.1 2.7 L 3.7 -3.4";
  const ACROSS="M -3.0 -3.0 L 3.0 3.0 M 3.0 -3.0 L -3.0 3.0";
  const COLR="var(--fg2)", COLM="var(--accent)";

  const line=(a,b,col,w,op,dash)=>{
    const p1=P(a[0],a[1],a[2]), p2=P(b[0],b[1],b[2]);
    const at={x1:p1[0].toFixed(1),y1:p1[1].toFixed(1),x2:p2[0].toFixed(1),
      y2:p2[1].toFixed(1),stroke:col,"stroke-width":w.toFixed(2),
      "stroke-opacity":op,"stroke-linecap":"round"};
    if(dash) at["stroke-dasharray"]=dash;
    return g.appendChild(el("line",at));
  };
  /* A RAIL IS SAMPLED, BECAUSE THE PROJECTION CANNOT BEND IT FOR US. P() is
     affine, so a straight world line is a straight screen line and a curve in
     world y against x has to be walked. Sixteen steps over a rail this length is
     under a pixel of chord error at reading zoom, and the whole run is one
     <path> rather than sixteen elements. */
  const RSTEPS=16;
  const rail=(k,j,col,w,op)=>{
    let d="";
    for(let i=0;i<=RSTEPS;i++){
      const gx=FORK+(RAILEND-FORK)*(i/RSTEPS);
      const q=P(gx,yRail(k,j,gx),lz);
      d+=(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)+" ";
    }
    return g.appendChild(el("path",{d,fill:"none",stroke:col,
      "stroke-width":w.toFixed(2),"stroke-opacity":op,
      "stroke-linecap":"round","stroke-linejoin":"round"}));
  };
  const labs=[];
  const fmt=q=>String(q).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const say=(x,y,txt,col,size,op,anchor,dy,wt)=>{
    const a=P(x,y,lz);
    const t2=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(30)`,
      y:(dy||0).toFixed(1),"text-anchor":anchor||"start","font-family":FQ_MONO,
      fill:col,"font-size":size.toFixed(1),"font-weight":String(wt||600),
      "fill-opacity":op});
    /* the base transform is kept so a pulse can multiply it without having to
       rebuild the string every frame */
    t2.dataset.base=`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(30)`;
    t2.textContent=txt; labs.push(t2); return t2;
  };

  /* ---- what is in each lane ---------------------------------------------- */
  const BASES="ACGT";
  const umiOf=()=>{ let q=""; for(let i=0;i<10;i++) q+=BASES[Math.floor(rnd()*4)]; return q; };
  const lanes=[];
  { let c=Math.floor(rnd()*9000)+1200;
    for(let k=0;k<NL;k++){
      /* TWO A LANE, AND THE STOP IS WHAT SETS IT.

         Six to eight fitted the TRACK — the fragment is short and the lap is
         long — but not the SCANNER, and three or four did not fit it either.
         The arithmetic that matters is not the 0.17 the read is stationary at
         FORK: it is how long it is anywhere NEAR the fork, which is the brake
         plus the stop plus the first of the splay. The brake starts at 0.70 of
         the approach (c = 0.28) and the read is still peeling away from the
         station at c = 0.60 — call it 0.30 of a lap in the scanner's own
         neighbourhood. At m = 4 the reads sit 0.25 apart and at m = 3 they sit
         0.333 apart, so BOTH were inside that window, which is why one fragment
         was arriving on top of the last one leaving however the phases were
         turned. Two a lane puts them half a lap apart and the beam is clear
         between every pair with room to spare.

         THE QUEUE IS THE CONSTRAINT, NOT THE RAIL. Anything that lengthens the
         stop — a longer scan, a longer look at the answer — has to come out of
         the traffic, and anything that adds traffic has to come out of the
         stop. Two is also the floor: the lane needs a repeat in it to have
         anything for the fork to be about, and a repeat needs a pair. */
      const m=2;
      const g1=GENE_NAMES[Math.floor(rnd()*GENE_NAMES.length)];
      const g2=GENE_NAMES[Math.floor(rnd()*GENE_NAMES.length)];
      const pools={};
      const umiFor=gn=>{ let q=pools[gn];
        if(!q){ q=pools[gn]=[]; const np=Math.max(1,Math.ceil(m*0.5));
          for(let i=0;i<np;i++) q.push(umiOf()); }
        return q[Math.min(q.length-1,Math.floor(Math.pow(rnd(),1.7)*q.length))]; };
      const seq=[];
      for(let j=0;j<m;j++){ const gn=(rnd()<0.72?g1:g2); seq.push({gn,umi:umiFor(gn)}); }
      /* ONE UMI ON TWO GENES, and at two reads a lane it is now a FIFTH of them
         rather than a third. Both are first sightings and both fork, so the lane
         is one where the two counters climb together — which is the difference
         between keying on three facts and keying on the UMI alone. At m = 3 or 4
         that case cost a lane one of several repeats; at m = 2 it costs the lane
         its ONLY repeat, so it has to be rarer or most of the field stops
         deduplicating anything. */
      let collide=false;
      if(rnd()<0.20 && g1!==g2){ seq[m-1]={gn:g2, umi:seq[0].umi}; collide=true; }
      const seen=new Set();
      for(const r of seq){ const key=r.gn+"|"+r.umi;
        r.first=!seen.has(key); seen.add(key); }
      /* AND EVERY OTHER LANE HAS AT LEAST ONE REPEAT. A lane whose two counters
         climb together draws a library with no duplication at all, which is not
         a thing that happens. A floor, not a thumb on the scale — and it has to
         SPARE the collision lanes, or it would quietly undo the case above
         every time: at m = 2 a collide lane is two first sightings, which is
         exactly the condition this floor fires on. */
      if(!collide && seq.every(r=>r.first) && seq.length>1)
        seq[seq.length-1]={gn:seq[0].gn, umi:seq[0].umi, first:false};
      lanes.push({cell:c, seq, m});
      c+=Math.floor(1+rnd()*90000);
    } }

  /* ---- the rails, the fan, and what each lane is called -------------------- */
  /* A RAIL IS THE GROUND A READ TRAVELS, NOT THE SUBJECT. It used to be drawn
     at very nearly the fragment's own weight, so a lane read as two parallel
     lines of equal standing and the eye had to be told which one was the read.
     Held back to about two thirds of what it was, the rail is still plainly
     there — it has to be, it is what says the fork went two ways — and the
     thing moving along it is the brightest object in the lane. */
  for(let k=0;k<NL;k++){
    line([LANE0,yIn(k),lz],[FORK,yIn(k),lz],"var(--fg3)",1.3,".26");
    rail(k,0,COLR,1.3,".30");
    rail(k,1,COLM,1.3,".30");
    /* NO CELL NAME HERE. E6 names every one of these lanes, at size, against
       884,736 — saying it again over the top of the fork is the same fact
       competing with the only new one. The lane is the same lane; it does not
       need introducing twice. */

  }

  /* ---- the scanner --------------------------------------------------------
     One question, asked once, of everything that passes. Built like E3's: a
     beam on a single post at the near end, cantilevered over the lanes.
     ITS CAPTION IS SET OUTBOARD OF THE POST and up, clear of the beam, of the
     lanes and of the fan — written over its own machine it was unreadable, and
     a question nobody can read is a question the drawing is not asking. */
  const yTop=yIn(0)-TP*1.5, yBot=yIn(NL-1)+TP*1.5;
  const BZ=lz+1.15;
  line([FORK,yTop,BZ],[FORK,yBot,BZ],"var(--fg2)",5.0,".62");
  line([FORK,yTop,BZ],[FORK,yTop,base],"var(--fg3)",3.2,".42");
  /* THE QUESTION IS THE STATION, SO IT IS SET LIKE THE STATION.
     It was a caption: small, grey, held back, anchored at its END so it ran
     backwards from a point and the leader met it at the '?'. Everything about
     that was the treatment a note gets, and this is not a note — every object
     in the field is downstream of the answer to it, and a reader who takes one
     thing away from E7 should take away the question.

     So: half again the size it was, in --fg, at full strength, and set close
     enough to the beam that the leader is a short tie rather than a tether.

     IT WAS BLUE FOR A BUILD AND IT IS WHITE NOW. --accent is the molecules
     road's own colour, and a question set in it reads as belonging to that
     road — as if the scanner were announcing the answer it is about to give,
     on one of the two roads out. It is not: it is asked of everything that
     passes, and both roads are answers to it. --fg is the page's brightest ink
     and carries no verdict, which is what a question needs. Still no new hue.

     AND IT IS SET ONCE, NOT TWICE. At three times the base it was the loudest
     object on the map and the field it belonged to read as its subtitle. Half
     that is still far larger than any other caption here, which is the standing
     it should have.

     AND THE LEADER LANDS ON THE 'U', NOT ON THE TAIL OF THE STRING. The text is
     anchored START at the point the hairline arrives at, so the line comes up
     off the beam and meets the first letter of the first word — which is where
     a reader's eye starts and the direction the sentence then runs. Anchored
     end, the leader arrived at the question mark and the sentence read
     backwards into the machine. The y offset drops the baseline by a third of
     the cap height IN THE TEXT'S OWN ROTATED FRAME, so the leader meets the
     glyph at its middle rather than at its foot. */
  { const CFS_Q=CFS*1.29;
    const capY=yTop-TP*1.5, capZ=BZ+1.0;
    const a=P(FORK,capY,capZ);
    const t2=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(-30)`,
      y:(CFS_Q*0.34).toFixed(1),
      "text-anchor":"start","font-family":FQ_MONO,fill:"var(--fg)",
      "font-size":CFS_Q.toFixed(1),"font-weight":"700",
      "letter-spacing":(CFS_Q*0.02).toFixed(2),"fill-opacity":".96"});
    t2.textContent="Unique Cell + Gene + UMI?"; labs.push(t2);
    /* the hairline from the beam up to that letter, so the question is attached
       to the machine that asks it rather than floating beside it. Heavier than
       it was: a 1.0 stroke under type this size reads as a stray mark. */
    line([FORK,yTop-TP*0.10,BZ],[FORK,capY,capZ],"var(--fg3)",1.6,".46"); }
  const lamps=[], scans=[];
  for(let k=0;k<NL;k++){
    lamps.push(line([FORK,yIn(k),BZ],[FORK,yIn(k),lz],"var(--fg)",1.6,"0"));
    /* ONE SCAN LINE PER LANE AND NOT PER READ. Only one read is ever stopped
       under the beam on a given lane — the dwell is shorter than the gap — so
       the lane can own the light and the fifty reads do not each carry one. */
    scans.push(g.appendChild(el("line",{stroke:"var(--fg)","stroke-width":"3.6",
      "stroke-opacity":"0","stroke-linecap":"round"})));
  }

  /* ---- the counters ------------------------------------------------------- */
  /* THE WORD AND THE NUMBER TOGETHER, PAST THE END OF THE RAIL, AND THE TWO
     ARE NOT OF EQUAL STANDING.

     Reads is the number that keeps going up and means less the higher it gets:
     it is how many times the sequencer looked, and past saturation another
     million of them buys almost nothing. Molecules is the number that stops,
     and where it stops is what this cell actually had. So reads is set small,
     light and faint — present, checkable, and clearly the lesser fact — and
     molecules is set large and solid. THE TYPOGRAPHY IS THE ARGUMENT: a reader
     who takes nothing else from this field should take away which of the two
     numbers is the one that matters.

     READS WAS SET TOO FAR BACK TO BE READ AT ALL. Lesser is not the same as
     illegible: a number a reader has to lean in for cannot do the job of being
     the fact the other number is measured against. It comes up to 0.92 of the
     name size at 0.72 — plainly there, plainly checkable — and MOLECULES stays
     a third bigger again, solid and at full strength. The hierarchy is intact
     and both ends of it are now on the page.

     BOTH SIT AT THE FANNED END OF THEIR OWN RAIL, which is the only thing they
     can do: yEnd() is where a rail actually arrives. */
  const cnt=[];
  for(let k=0;k<NL;k++)
    cnt.push({r:say(RAILEND+0.34,yEnd(k,0),"READS",COLR,NFS*0.92,".72","start",NFS*0.30,600),
              m:say(RAILEND+0.34,yEnd(k,1),"MOLECULES",COLM,NFS*1.22,".95","start",NFS*0.44,700)});

  /* ---- the reads ---------------------------------------------------------- */
  const body=mark=>{ const grp=g.appendChild(el("g"));
    const o={
      cd:grp.appendChild(el("polygon",{fill:"var(--cull)","fill-opacity":"0",stroke:"none"})),
      ad:grp.appendChild(el("line",{stroke:"var(--fg3)","stroke-width":"1.1",
        "stroke-opacity":"0","stroke-linecap":"butt"})),
      bc:grp.appendChild(el("polygon",{fill:"var(--accent)","fill-opacity":"0",stroke:"none"})),
    };
    /* THE TICK IS --ok AND THE CROSS IS GREY, NOT --rej.
       The two marks are E3's and E5's, because it is the same kind of event: a
       thing checked against a memory. The COLOURS are not. --rej on this page
       means thrown away, and a read the scanner has seen before is neither
       wrong nor discarded — it goes on down the reads road with everything
       else. Grey says "already counted", which is what actually happened. */
    if(mark) o.mk=grp.appendChild(el("path",{d:mark==="tick"?ATICK:ACROSS,
      fill:"none",stroke:mark==="tick"?"var(--ok)":"var(--fg3)",
      "stroke-width":"2.0","stroke-linecap":"round","stroke-linejoin":"round",
      "stroke-opacity":"0"}));
    return o; };
  const reads=[];
  lanes.forEach((ln,k)=>{
    ln.seq.forEach((r,j)=>{
      /* AND EACH LANE'S STREAM IS OFFSET FROM ITS NEIGHBOUR'S. Left to
         themselves the lanes fall into step — every lane the same handful of
         reads spread evenly round the same lap — and reads on neighbouring
         rails arrive abreast, which is exactly when one read's gene name lands
         on the next rail's UMI. A per-lane turn of the phase interleaves them,
         and 0.41 of a lap is far enough from a half and a third that ten lanes
         never come back into step. */
      /* PHASES EXACTLY EVEN, no jitter: the spacing between two reads on a lane
         is what keeps only one of them under the beam, so it is not a place for
         randomness. The per-lane turn of 0.41 of a lap is what keeps the ten
         lanes from stopping in unison. */
      reads.push({tk:k, ph:(j/ln.m + k*0.41)%1, first:r.first,
        A:body(r.first?null:"cross"), B:r.first?body("tick"):null});
    });
  });
  labs.forEach(t2=>g.appendChild(t2));

  const DASHN=7;
  const barTo2=(node,w,minHW,a,b,op)=>{
    const p1=P(a[0],a[1],a[2]), p2=P(b[0],b[1],b[2]);
    const dx=p2[0]-p1[0], dy=p2[1]-p1[1], L=Math.hypot(dx,dy)||1;
    const hw=Math.max(minHW,w*S/2), hx=-dy/L*hw, hy=dx/L*hw;
    node.setAttribute("points",[[p1[0]+hx,p1[1]+hy],[p2[0]+hx,p2[1]+hy],
      [p2[0]-hx,p2[1]-hy],[p1[0]-hx,p1[1]-hy]]
      .map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" "));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
  };
  const seg2=(node,a,b,op)=>{
    const p1=P(a[0],a[1],a[2]), p2=P(b[0],b[1],b[2]);
    node.setAttribute("x1",p1[0].toFixed(1)); node.setAttribute("y1",p1[1].toFixed(1));
    node.setAttribute("x2",p2[0].toFixed(1)); node.setAttribute("y2",p2[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
    const d=Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/(2*DASHN-1);
    node.setAttribute("stroke-dasharray",d.toFixed(2)+" "+d.toFixed(2));
  };
  /* THE THREE PARTS IN THE ORDER THEY TRAVEL: aligned end first, then the
     adapter, then the barcode end, all on the rail. Centred on gx so the
     fragment's middle is the thing following the track. */
  /* sc SCALES THE MOLECULE ABOUT ITS OWN MIDDLE, and it is how the two answers
     read differently without a second palette. A first sighting comes out of
     the fork slightly LARGER and at full strength — it is a new thing and the
     drawing says so. A repeat comes out smaller and dimmer, which on this
     background is what "greyer" means: it is still a real read, still counted,
     still travelling, just no longer news. */
  /* AND EVERY POINT OF IT TAKES ITS y FROM THE RAIL AT ITS OWN x, which is what
     keeps a fragment ALONG its rail rather than across it. Laid at one constant
     y the molecule was a level bar sitting on a line that was not level, and on
     the outer lanes — where the fan is steepest — it read as a read draped over
     the rail rather than travelling it. The three parts now hinge with the
     curve, which costs four evaluations of a function that is two multiplies. */
  const put=(bd,gx,yf,op,sc,mkOp)=>{
    const Y=typeof yf==="function"?yf:()=>yf;
    const L=FT*(sc||1), a=gx-L/2, lo=Lo*(sc||1), ta=Ta*(sc||1);
    const xb=a+lo, xc=a+lo+ta, xd=a+L;
    const oA=[a,Y(a),lz],   oB=[xb,Y(xb),lz];
    const kB=[xc,Y(xc),lz];
    const bB=[xd,Y(xd),lz];
    barTo2(bd.cd,RW*(sc||1),FLOOR_O*(sc||1),oA,oB,op);
    seg2(bd.ad,oB,kB,op*0.62);
    barTo2(bd.bc,RWB*(sc||1),FLOOR_B*(sc||1),kB,bB,op*0.95);
    if(bd.mk){
      const q=P(gx,Y(gx),lz+0.34);
      bd.mk.setAttribute("transform",
        `translate(${q[0].toFixed(1)},${q[1].toFixed(1)}) scale(${(0.9*(sc||1)).toFixed(2)})`);
      bd.mk.setAttribute("stroke-opacity",clamp01(mkOp||0).toFixed(3));
    }
  };
  /* ---- THE BEAM RUNS THE WHOLE READ, AND IT RUNS IT SEVERAL TIMES -----------
     It used to travel the barcode end alone, once, at the speed of the dwell.
     Both halves of that were wrong here, and E3 is why they looked right: at E3
     three scanners each check ONE square, and a beam that travelled a read
     there would be a beam reading all of it. THIS scanner's question is "cell +
     gene + UMI", which is the whole molecule — the gene came off the aligned
     end and the cell and the UMI off the barcode end — so a beam that stops
     short of the orange is a beam that cannot have asked it.

     ONE PASS, END TO END, OVER THE WHOLE DWELL. It went back and forth several
     times for a build, on the argument that a fast flicker is what says
     instrument. It is not what says READING: a head that crosses a thing three
     and a half times and then stops has been fidgeting, and the eye cannot tell
     which of the passes was the one that took. One traverse at the speed of the
     stop is a machine going over a thing once, carefully, which is what this
     station does — the read is held still for exactly as long as it takes.

     AND IT IS AIMED, WHICH IS WHAT MAKES IT A BEAM. It used to be a stub
     standing on the deck at the swept position — a short vertical mark sliding
     along under the read, which is a cursor rather than a light. It hangs from
     the gantry now and its FOOT does the sweeping, so the line leans left, comes
     upright over the middle of the fragment and leans right, the way a head on a
     rail actually tracks something held beneath it. Same idiom as E3's, one
     station along: the beam belongs to the machine at one end and to the thing
     being read at the other. */
  const scanAt=(node,gx,y,sc,u,op)=>{
    const L=FT*sc, a=gx-L/2;
    const px=a+L*u;
    const p1=P(FORK,y,BZ), p2=P(px,y,lz+0.10);
    node.setAttribute("x1",p1[0].toFixed(1)); node.setAttribute("y1",p1[1].toFixed(1));
    node.setAttribute("x2",p2[0].toFixed(1)); node.setAttribute("y2",p2[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
  };

  let t=0;
  const run=dt=>{
    t+=dt;
    const laps=t*v/LOOP;
    const R=new Array(NL).fill(0), M=new Array(NL).fill(0);
    /* TWO POPS AND NOT ONE. Every read lands on the reads road and only a first
       sighting lands on the molecules road, so the two counters cannot share a
       pulse: powM fires on firsts, powR on everything. */
    const lit=new Array(NL).fill(0);
    const powM=new Array(NL).fill(0), powR=new Array(NL).fill(0);
    for(const rd of reads){
      const c=((laps+rd.ph)%1+1)%1;
      const k=rd.tk;
      let gx, live=1;
      if(c<APP){
        /* ROLLING IN AT PACE, THEN BRAKING — and the braking is confined to the
           last fifth of the run.

           A single ease-out over the whole approach covers nine tenths of the
           distance in half the time, so every read spent most of its run-in
           already loitering by the beam and the first half of every rail was
           bare. What has to be true is both: EVEN SPACING down the open track,
           because that is what a lane of traffic looks like, and a real stop at
           the end, because that is what being scanned looks like. So: constant
           speed to four fifths of the way, then the brake. */
        const u=c/APP, KN=0.70, KD=0.82;
        const f=u<KN ? KD*u/KN
                     : KD+(1-KD)*(1-Math.pow(1-(u-KN)/(1-KN),2));
        gx=LANE0+(FORK-LANE0)*f;
      }else if(c<VER){
        gx=FORK;                                   /* stopped, being asked */
      }else if(c<END){
        /* AWAY FROM THE STOP IN ONE MOVE, ACCELERATING FROM REST. It used to be
           two legs — a squared ramp out to the old splay point and then a
           constant run to the end — and the speed jumped where they met, at the
           same x the rails had their elbow. Now the pace ramps linearly over the
           first KA of the run and holds, which is one continuous motion with no
           step in it: distance is the integral, so it is quadratic through the
           ramp and linear after, and V is chosen to make the whole run come out
           at exactly 1.

           Both bodies do this from the same point at the same moment, which is
           the whole reason the copy is not spawned off to the side. It is the
           same fragment until the fork and two fragments after it. */
        const u=(c-VER)/(END-VER), KA=0.30, V=1/(1-KA/2);
        gx=FORK+(RAILEND-FORK)*(u<KA ? V*u*u/(2*KA) : V*(KA/2+u-KA));
      }else{ gx=RAILEND; live=0; }
      /* IN AT THE VERY START OF THE TRACK. It used to fade up a way along, which
         made the fragments look posted onto the rail rather than arriving on it. */
      const vis=live*Math.min(sstep(0,0.020,c),1-sstep(END-0.035,END,c));

      /* THE READ'S y COMES OFF THE RAIL FUNCTION AND FROM NOWHERE ELSE, which is
         what guarantees it is ON its rail at every x rather than on a second
         reconstruction of one. yRail is the identity upstream of the fork, so
         the approach, the split and the run are one expression. */
      const yA=xx=>yRail(k,0,xx);
      if(rd.first){
        put(rd.A,gx,yA,vis,1.14,0);
        put(rd.B,gx,xx=>yRail(k,1,xx),vis,1.14,
            vis*sstep(VER-0.03,VER+0.02,c));
      }else{
        /* SMALLER AND DIMMER FROM THE ANSWER ONWARD, not from the start: it
           arrives the same as everything else, and it is the scanner that
           makes it old news. */
        /* DIMMED, NOT ERASED. Held back too far the reads road came out looking
           EMPTIER than the molecules road, which is the exact opposite of the
           fact this station exists to show: every read goes down it, and the
           repeats are most of them. */
        /* AND THE CROSS RIDES ALL THE WAY TO THE END. It used to fade out at
           the fork, on the argument that the verdict was spent once the roads
           had parted. They have not parted for the reader: a repeat and a first
           sighting are travelling adjacent rails at the same size, and with the
           mark gone the only thing separating them is a fifth of a step of
           brightness — so most of the reads road arrived at its counter looking
           exactly like the molecules road beside it, which is the one thing
           this field must not say. Carried the length of the rail, the cross is
           what makes the reads road legible as the road with the duplicates on
           it, and it is still grey: "already counted", not "thrown away". */
        const dim=sstep(VER-0.02,VER+0.05,c);
        put(rd.A,gx,yA,vis*(1-0.28*dim),1.14-0.22*dim,
            vis*sstep(VER-0.03,VER+0.02,c));
      }
      /* THE BEAM, AND THE LIGHT IT THROWS, WHILE THIS ONE IS UNDER IT. The read
         is stopped at the fork, so it is on its own incoming lane and yIn(k) is
         where the beam has to land. The lamp rises and falls over the dwell; the
         beam's foot crosses the fragment once, at the dwell's own pace. */
      if(c>=APP && c<VER){
        const uu=clamp01((c-APP)/(SCN-APP));
        lit[k]=Math.max(lit[k],1-Math.abs(uu*2-1)*0.4);
        scanAt(scans[k],FORK,yIn(k),1.14,uu,
               (c<SCN?1:1-(c-SCN)/(VER-SCN)));
      }
      /* THE COUNT TICKS WHERE THE FRAGMENT LANDS, not where it was judged. The
         number going up and the thing arriving have to be the same event, or
         the counter is just a number that changes on its own. */
      const cross=Math.floor(laps+rd.ph-END)+1;
      if(cross>0){ R[k]+=cross; if(rd.first) M[k]+=cross; }
      /* AND BOTH SIDES GET A POP, ON THE SIDE THE FRAGMENT ACTUALLY LANDS ON.
         Every read lands on the reads road, so READS pulses every time; only a
         first sighting reaches the molecules road, so MOLECULES pulses less
         often. That difference in RATE is the same fact the two numbers carry,
         drawn in time instead of in digits — and it is why the reads pop had to
         exist at all: a counter that climbs without moving reads as a number
         changing on its own rather than as a thing arriving. */
      const pop=c>=END
        ? Math.max(0,1-(c-END)/0.026)          /* struck, then decaying */
        : Math.max(0,1-(END-c)/0.012);         /* the last instant of the run */
      powR[k]=Math.max(powR[k],pop);
      if(rd.first) powM[k]=Math.max(powM[k],pop);
    }
    for(let k=0;k<NL;k++){
      /* the lamp is held back now that the beam is aimed: it says which lane is
         being served, and the beam says what is being looked at */
      lamps[k].setAttribute("stroke-opacity",(lit[k]*0.34).toFixed(3));
      if(!lit[k]) scans[k].setAttribute("stroke-opacity","0");
      cnt[k].r.textContent="READS "+fmt(R[k]);
      cnt[k].m.textContent="MOLECULES "+fmt(M[k]);
      /* A FAST ATTACK AND A SHORT TAIL. Eased both ways it read as a slow
         breathing of every number at once; what it has to read as is a thing
         landing. THE READS POP IS THE SMALLER OF THE TWO — 0.20 against 0.26 —
         because the typography is the argument and a pulse is typography: two
         equal pops would say the two arrivals are of equal standing. */
      const em=Math.pow(powM[k],0.55), sm=1+0.26*em;
      cnt[k].m.setAttribute("transform",cnt[k].m.dataset.base+" scale("+sm.toFixed(3)+")");
      cnt[k].m.setAttribute("fill-opacity",(0.95+0.05*em).toFixed(3));
      const er=Math.pow(powR[k],0.55), sr=1+0.20*er;
      cnt[k].r.setAttribute("transform",cnt[k].r.dataset.base+" scale("+sr.toFixed(3)+")");
      cnt[k].r.setAttribute("fill-opacity",(0.72+0.24*er).toFixed(3));
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.dedup=drawDedup;


/* ============================================================
   ② UNFILTERED DGE — the matrix as relief

   WHAT WAS WRONG WITH THE CUBE. It was a cube with some voxels lit: a picture
   of "a matrix, sparsely filled". True, and it says nothing that the words
   underneath it do not. The thing worth drawing about this object is not that
   it is sparse — it is HOW it is sparse, which has a shape, and the shape is
   the most recognisable artefact in the whole field.

   SO THE ROWS ARE SORTED AND THEIR HEIGHT IS THEIR COUNT. Every barcode gets a
   row, ordered by how many transcripts it carries, and the height of that row
   is that number. Sorted descending, the surface IS the barcode-rank curve —
   the knee plot, stood up as a physical relief instead of plotted on axes. A
   short tall ridge at the near edge, a cliff, and then a plain that runs away
   almost flat for as far as the object goes.

   THE CLIFF IS THE WHOLE POINT. To the near side of it are the barcodes that
   were cells. Beyond it are the ones that were never cells and never could
   have been — ambient RNA, sequencing error, combinations that simply never
   happened — and there are hundreds of thousands of them. NOTHING HERE IS
   CULLED: this object keeps every one of those rows on purpose, which is what
   makes it the unfiltered matrix and what makes it almost never shipped.

   AND THE SECOND AXIS IS GENES. The lit cells scattered on the tops of the
   rows are the genes actually detected in that barcode, and there are more of
   them on the tall rows than the short ones — which is not decoration, it is
   the same fact twice: a barcode with more transcripts has more distinct genes.

   Related: /bioinformatics_pipe's D lane starts from this same object, drawn
   there as the plain cube it used to be here. The two are the same matrix; only
   this page draws its shape.
   ============================================================ */
function drawDGE(g,n){
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const r=rng(5);
  const x0=n.x-n.w/2, x1=n.x+n.w/2, y0=n.y-n.d/2, y1=n.y+n.d/2;
  const BASE=n.h*0.055;
  /* THE FLOOR, AND IT IS PAINTED DOWN. The object needs a silhouette to be
     clipped and hit-tested against even where the rows are almost flat — but at
     the anchor skin's full strength its top face shows straight through the
     rows standing a few hundredths above it, and the whole plate came out
     looking like a bright solid table with specks on. Whatever is brightest
     here has to be the data. */
  paint(g,n.x,n.y,n.w,n.d,BASE,{...SKIN.anchor,fo:0.34});

  /* FORTY-FOUR ROWS FOR 884,736 BARCODES, which is the same window E6 and E7
     take onto the same space. What has to survive the sampling is the SHAPE,
     and the shape survives: the first few rows are the cells and everything
     after them is not. */
  const NR=44, LP=n.d/NR;
  const rowY=k=>[y1-(k+1)*LP, y1-k*LP];
  /* KNEE at about a seventh of the rows, and a hard one. rk is the classic
     rank curve: a plateau, a cliff, and a floor that never quite reaches zero
     because ambient RNA never quite does either. */
  const KN=7.0, SS=7.5, AMB=0.022;
  const jit=[]; for(let k=0;k<NR;k++) jit.push(0.74+r()*0.34);
  /* TWO FACTORS, AND BOTH ARE REAL. The first is the cliff — a hard sigmoid at
     the knee. The second is the SLOPE ACROSS THE PLATEAU: the biggest cell in a
     run carries several times what the smallest cell does, so the tops of the
     cell rows step down rather than sitting level. Without it the ridge came
     out as one solid wall, which draws a population where every cell is the
     same size — the one thing no population of cells has ever been. */
  const rk=k=>Math.max(AMB, (1/(1+Math.pow(k/KN,SS)))/(1+k*0.12))*jit[k];
  const hOf=k=>BASE+(n.h-BASE)*Math.min(1,rk(k));

  const TOP=V("a-top"), LEFT=V("a-left"), RIGHT=V("a-right");
  const poly=(p,fill,op,so)=>g.appendChild(el("polygon",{points:p,fill,
    "fill-opacity":op.toFixed(2),stroke:"var(--stroke)","stroke-width":"0.5",
    "stroke-opacity":so.toFixed(2)}));
  /* THE PLATE IS MOSTLY ZERO AND HAS TO LOOK IT. Painted at the anchor skin's
     full strength the empty rows came out as a solid bright table with a few
     specks on it — a piece of furniture, not a matrix. They are held down to a
     third, so the DATA is the bright thing and the object it sits in is the
     dark thing, which is the right way round for something this empty. The
     rows that are cells keep more of their strength: that difference is the
     cliff, said a second way. */
  const strength=k=>k<12?0.34+0.30*(1-k/12):0.26;

  /* FAR ROWS FIRST. Screen depth on this projection is x + y, so a row nearer
     the viewer is a row at larger y — and the tall ones are at the near edge,
     which means the ridge is in front of the plain it fell off. */
  const ticks=[];
  for(let k=NR-1;k>=0;k--){
    const [ya,yb]=rowY(k), h=hOf(k), cy=(ya+yb)/2;
    const f=faces((x0+x1)/2, cy, n.w, LP, h);
    const st=strength(k);
    poly(f.left ,LEFT ,st*1.25,0.16);
    poly(f.right,RIGHT,st*1.25,0.16);
    poly(f.top  ,TOP  ,st     ,0.20);
    /* THE GENES DETECTED IN THAT BARCODE. More of them on the tall rows, and
       the exponent is under one because the relationship is saturating: a cell
       with ten times the transcripts does not have ten times the genes. */
    const nt=Math.max(1,Math.round(34*Math.pow(rk(k),0.50)));
    for(let i=0;i<nt;i++){
      const gx=x0+(0.02+r()*0.96)*n.w, gw=n.w*0.012;
      const q=[P(gx,ya+LP*0.22,h),P(gx+gw,ya+LP*0.22,h),
               P(gx+gw,yb-LP*0.22,h),P(gx,yb-LP*0.22,h)];
      ticks.push({node:g.appendChild(el("polygon",{points:pts(q),fill:"var(--voxel)",
        "fill-opacity":"0.6",stroke:"none"})), gx, base:k<12?0.86:0.62});
    }
  }

  /* the gene axis, ruled faintly across the whole plate, so the long direction
     reads as a second axis and not just as length */
  for(let i=1;i<16;i++){
    const gx=x0+n.w*i/16, a=P(gx,y0,BASE), b2=P(gx,y1,BASE);
    g.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
      x2:b2[0].toFixed(1),y2:b2[1].toFixed(1),stroke:"var(--stroke)",
      "stroke-width":"0.5","stroke-opacity":".14"}));
  }

  /* ---- what the two axes are ---------------------------------------------
     Written on the edges they belong to and running along them, so neither
     needs the word "axis" to be understood as one. */
  const say=(x,y,z,txt,rot,anchor,size,op,wt,ls)=>{
    const a=P(x,y,z);
    const t=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(${rot})`,
      "text-anchor":anchor,"font-family":FQ_MONO,fill:"var(--fg2)",
      "font-size":size.toFixed(1),"font-weight":String(wt),
      "letter-spacing":(ls||0).toFixed(2),"fill-opacity":op});
    t.textContent=txt; g.appendChild(t); return t;
  };
  const FS=TYPEof(n,7,n.w*1.15);
  say(x0+n.w*0.04, y1+LP*1.5, 0, "32,520 genes", 30, "start", FS, ".72", 700, FS*0.06);
  say(x1+n.w*0.045, y1-LP*0.4, 0, "884,736 barcodes", -30, "start", FS, ".72", 700, FS*0.06);
  /* AND THE TWO SIDES OF THE CLIFF, NAMED. Everything this object is about is
     the difference between them, and it is a difference of about three orders
     of magnitude that the eye reads as "a ridge and a floor". */
  say(x1+n.w*0.10, y1+LP*2.6, n.h*1.02, "the cells", -30, "start", FS*1.0, ".88", 700, FS*0.05)
    .setAttribute("fill","var(--ok)");
  say(x1+n.w*0.045, y0+n.d*0.40, BASE, "never a cell · kept anyway",
      -30, "start", FS*0.92, ".62", 600, FS*0.05);
  say(x0+n.w*0.04, y1+LP*4.4, 0, "884,736 × 32,520 = 28.8 billion entries, almost every one a zero",
      30, "start", FS*0.86, ".60", 500, FS*0.04);

  /* ---- READ, AND READ AGAIN ----------------------------------------------
     This object is written once and read by every QC stage after it, and a
     matrix that just sits there does not say so. A soft band travels the gene
     axis and lifts whatever it passes over: the cheapest possible drawing of
     something being scanned, over and over, by things that are not on this map. */
  let t=0;
  const SWEEP=n.w*0.16;
  const run=dt=>{
    t+=dt;
    const px=x0-SWEEP+((t*0.55)%1)*(n.w+2*SWEEP);
    for(const q of ticks){
      const d=Math.abs(q.gx-px)/SWEEP;
      q.node.setAttribute("fill-opacity",
        (q.base+(1-Math.min(1,d))*0.34).toFixed(3));
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.dge=drawDGE;



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

/* ============================================================
   A SHREDDER BIN — a pail with a machine head across it.

   Two stations discard things now and both discard them the same way, so the
   box is one object rather than two that look alike. What a caller gives it is
   the SLOT, because the slot is the only part with a constraint: whatever drops
   through it has to fit lying flat, so it must be longer than that thing and
   wider than its bar. Everything else — the head, the pail — is derived
   outward. Sizing the box first and taking a fraction of it for the slot is
   what produced a mouth shorter than the thing going into it, and a whole pose
   of contortion to get around it.

   THE LID DOES THE DISAPPEARING. Build this AFTER whatever falls into it and a
   thing at the slot goes behind the machine's own top face and is gone.

   It returns the lid height and the cutters; the caller runs them, because each
   station has its own clock and its own idea of when something is going in. */
function shredBin(g,x,y,SLOTX,SLOTY,BUCKH,HEADH,PAIL,HEAD){
  const HEADX=SLOTX*1.27, HEADY=SLOTY*2.9;
  const BUCKX=HEADX*0.90, BUCKY=HEADY*0.84;
  slabAt(g,x,y,BUCKX,BUCKY,BUCKH,PAIL,0);
  slabAt(g,x,y,HEADX,HEADY,HEADH,HEAD,BUCKH);
  const top=BUCKH+HEADH;
  g.appendChild(el("polygon",{points:pts([
      P(x-SLOTX/2,y-SLOTY/2,top),P(x+SLOTX/2,y-SLOTY/2,top),
      P(x+SLOTX/2,y+SLOTY/2,top),P(x-SLOTX/2,y+SLOTY/2,top)]),
    fill:"var(--bg)","fill-opacity":".72",stroke:"none"}));
  const N=Math.max(6,Math.round(SLOTX/(SLOTY*0.34)));
  const blades=[];
  for(let b=0;b<N;b++)
    blades.push(g.appendChild(el("line",{stroke:"var(--rej)","stroke-width":"1.3",
      "stroke-linecap":"butt","stroke-opacity":"0"})));
  return {top,x,y,SLOTX,SLOTY,blades,
    /* `on` is 1 while something is going through and fades out after; the
       blades scroll, so the machine is turning rather than merely lit */
    run(t,on,speed){
      const bp=SLOTX/blades.length, roll=((t*speed)%bp+bp)%bp;
      blades.forEach((bl,k)=>{
        const bx=x-SLOTX/2+((k*bp+roll)%SLOTX);
        const a=P(bx,y-SLOTY*0.42,top+0.004), b=P(bx,y+SLOTY*0.42,top+0.004);
        bl.setAttribute("x1",a[0].toFixed(1)); bl.setAttribute("y1",a[1].toFixed(1));
        bl.setAttribute("x2",b[0].toFixed(1)); bl.setAttribute("y2",b[1].toFixed(1));
        bl.setAttribute("stroke-opacity",(0.10+0.72*clamp01(on)).toFixed(3));
      });
    }};
}

const ROUNDS=[
  {key:"BC1", cols:8,  rows:6, perWell:2, risers:13},
  {key:"BC2", cols:12, rows:8, perWell:1, risers:20},
  {key:"BC3", cols:12, rows:8, perWell:1, risers:20},
];

/* THE LAYOUT, DERIVED ONCE. drawWhitelists draws from it and PORTS.whitelists
   aims at it: the three lines to E3 leave from underneath each plate's own
   name, and a port that re-derives where a name is drifts off it the first time
   a plate width changes. Same rule fragGeom and yardMetrics live by. */
function wlLayout(n){
  const PITCH0=0.34, GAP0=3.3, PH0=0.30, ZR0=8.2, REGH0=0.07;
  const NATW=ROUNDS.reduce((t,R)=>t+R.cols*PITCH0,0)+GAP0*(ROUNDS.length-1);
  const K=n.w/NATW, KZ=n.h/(ZR0+REGH0);
  const PITCH=PITCH0*K, gap=GAP0*K, h=PH0*KZ, ZR=ZR0*KZ;
  const plates=[]; let cx=0;
  ROUNDS.forEach(R=>{
    const w=R.cols*PITCH, d=R.rows*PITCH;
    plates.push({R,px:cx+w/2,w,d});
    cx+=w+gap;
  });
  plates.forEach(p=>{
    p.px+=n.x-(cx-gap)/2; p.rw=p.w+0.7*K; p.rd=p.d+1.15*K;
  });
  /* ONE SIZE FOR ALL THREE, taken from the shortest edge — BC1's plate is the
     small one, and three sibling labels at three different sizes would read as
     a mistake rather than as a fit. */
  const CH=0.68, mainText=pl=>pl.R.key+" — 96 BARCODES";
  const FIT=TYPEof(n,6.5,Math.min(...plates.map(pl=>
    ((pl.d+0.30*K)*S)/(mainText(pl).length*CH))));
  return {K,KZ,PITCH,gap,h,ZR,REGH0,PH0,ZR0,plates,FIT,CH,mainText,y:n.y};
}

function drawWhitelists(g,n){
  hitBox(g,n);
  const rnd=mulberry32(0x5eedf15^0x1B);
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

  /* the layout is authored in its own units and scaled onto the node: K across
     the ground, KZ up. The dashes are NOT scaled — see the header. */
  const L=wlLayout(n);
  const WELLR0=0.105, REGH0=L.REGH0;
  const K=L.K, KZ=L.KZ, PITCH=L.PITCH, WELL_R=WELLR0*K, gap=L.gap, h=L.h, ZR=L.ZR;
  const y=n.y;

  const DASH=2.5, GAP=1.35, BC_LEN=(8*DASH+7*GAP)/(S*CZ);
  const PLATE={top:"var(--t-top)",left:"var(--t-left)",right:"var(--t-right)"};
  const REG  ={top:"var(--t-left)",left:"var(--t-right)",right:"var(--t-right)"};

  const plates=L.plates;

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
    const rw=pl.rw, rd=pl.rd;
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
    Object.assign(pl,{slots,ptr:0});
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
      "text-anchor":"start","font-family":FQ_MONO});
    rows.forEach(([str,fill,size,weight,ls,op],i)=>{
      const sp=el("tspan",{x:startX,y:firstDy+i*17*K,fill,"font-size":size,
        "font-weight":weight,"letter-spacing":ls,"fill-opacity":op});
      sp.textContent=str; t.appendChild(sp);
    });
    g.appendChild(t);
  };
  /* one size for all three — see wlLayout */
  const FIT=L.FIT, mainText=L.mainText;
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
   the UMI outline and the splice arc already follow. (The palette rule at the
   top of index.html warned this trade would come due the moment something on
   this map started dropping things. This is that moment, and this is the
   answer.)
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
  /* THE DECK IS A PLATFORM NOW, NOT A STAIN. base was 0.14 — a ghost of a
     surface, which was right while everything on this station stood ON it and
     nothing ever left. The reject path leaves it: fragments run to the near
     edge, tip over it and drop into a shredder standing on the floor below. You
     cannot fall off an edge that has no height, so base is 0.62 and n.h went
     1.6 -> 2.15 with it, which holds KZ (and therefore the gantries) where they
     were. Change one of those two and change the other. */
  {x0:0, x1:19.4, cy:-3.0, base:0.62, gx:[2.4,5.9,9.4], MZ:2.6, REJ:5.0,
   binX:18.4, v:2.6, VALX:18.9,
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

/* the handful of numbers both drawSortingYard and PORTS.sortingyard need.

   THE SCANNER GEOMETRY IS IN HERE RATHER THAN IN THE DRAW, because a port now
   has to land on a name: the three whitelist lines arrive at the top of each
   station's own label, and a port that works out its own idea of where a label
   is drifts off it the first time a width changes — the same rule fragGeom
   already lives by. One derivation, two callers. */
function yardMetrics(n){
  const A=YARD_ROUNDS, K=n.w/(A.x1-A.x0), KZ=n.h/(A.base+A.gz+A.pgap+0.07);
  const SC=q=>q*K, x0=n.x-n.w/2, cy=n.y+A.cy*K, base=A.base*KZ;
  const FL=SC(A.FLEN), uBP=FL/YARD_MOL_BP;
  /* the molecule's own cuts, in bp, and the R2 block inside them */
  const cuts=[]; { let a=0; for(const q of YARD_MOL){ cuts.push([a,a+q.bp,q.k]); a+=q.bp; } }
  const segAt=k=>cuts.find(c=>c[2]===k);
  const R2A=segAt("bc1")[0], R2B=segAt("umi")[1];
  const yAt=bp=>cy+FL/2-bp*uBP;
  const gz=A.gz*KZ, panelZ=gz+A.pgap*KZ;
  const SCN_F=yAt(R2B)-SC(A.TIP), SCN_N=yAt(R2A)+SC(A.LIP);
  return {A,K,KZ, x0, x1:n.x+n.w/2, cy, base, FL, uBP, cuts, segAt, R2A, R2B,
          BCBP:["bc1","bc2","bc3"].map(k=>{const c=segAt(k); return (c[0]+c[1])/2;}),
          gz, panelZ, SCN_F, SCN_N, SCN_MID:(SCN_F+SCN_N)/2, SCN_LEN:SCN_N-SCN_F,
          gx:A.gx.map(q=>x0+(q-A.x0)*K), FS:TYPEof(n,6,13.5*K),
          labZ:base+panelZ+0.07*KZ, labY:SCN_F-SC(0.95)};
}

function drawSortingYard(g,n){
  hitBox(g,n);
  const FQ_MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';

  const M=yardMetrics(n), A=M.A, K=M.K, KZ=M.KZ;
  const SC=q=>q*K;
  const x0=M.x0, x1=M.x1;
  const XX=q=>x0+(q-A.x0)*K;                   /* authored x -> world x */
  const cy=M.cy, base=M.base;
  const REJ=n.y+SC(A.REJ), binX=XX(A.binX), VALX=XX(A.VALX);
  const gx=A.gx.map(XX), MZ=SC(A.MZ), v=A.v*K;
  const FL=SC(A.FLEN), THK=SC(A.THK);

  /* THE SHREDDER'S NUMBERS ARE DERIVED HERE AND THE BOX IS DRAWN LATE.
     Painter order wants the bin built last; the reject siding, which stops at
     the deck's edge, needs to know where that edge is before it is drawn. The
     two are separated rather than reordered. */
  /* A PAIL WITH A SHREDDER HEAD ON IT, and the head is where the slot is. As
     one slab it was a skip: a box you throw things into, which is a picture of
     storage. The silhouette that says shredder is two boxes — a bin, and a
     machine sitting across the top of it, wider than the bin so the join reads
     as a lid rather than as a step. binTop IS that lid, and it has to stay
     BELOW the height fragments ride at on the deck, or they climb into it. */
  /* THE SLOT IS SIZED FIRST AND THE BOX AROUND IT SECOND, because the slot is
     the only part with a constraint: a fragment drops through it lying flat, so
     it has to be LONGER than the fragment and WIDER than the fragment's bar.
     Sizing the box first and taking a fraction of it for the slot gave a mouth
     shorter than the thing going into it — which is why the first version had
     to stand the fragment on end to get it in at all. */
  const SLOTX=FL*1.12, SLOTY=THK*2.8;
  const BUCKH=0.46*KZ, HEADH=0.13*KZ;
  const BY=REJ+SC(3.4), binTop=BUCKH+HEADH;
  const HOVER=binTop+FL*0.42;                 /* where it comes to rest before dropping */
  /* TIPB IS WHERE THE FRAGMENT COMES TO REST OVER THE SLOT. It only has to be
     far enough back that the crossing is not travelling backwards, and far
     enough forward that the last gantry's divert has finished first.

     THE HISTORY IS WORTH ONE LINE EACH, because two of the three drew nothing.
     Version one fed the fragment into the side of the bin and put TIPB a hair
     before the blades — every reject was eaten before its tip began. Version
     two moved TIPB to where the nose met the blades, which worked, and then
     stood the fragment on end to feed it through a slot too short to take it
     lying down. This one widens the slot instead and the fragment stays flat.
     Move any one of gx, MZ, binX or FLEN and RE-CHECK TIPA > gx[2] + MZ. */
  const TIPB=binX-FL/2, TIPA=TIPB-SC(1.2), DIVEND=TIPB+SC(2.6);

  const DECK={top:"var(--t-top)",left:"var(--t-left)",right:"var(--t-right)"};
  const GAN ={top:"var(--k-top)",left:"var(--k-left)",right:"var(--k-right)"};
  const BIN ={top:"var(--rej)",left:"var(--rej)",right:"var(--rej)"};
  const R1T="var(--cull)", R2T="var(--accent)";

  /* ---- where each part of the molecule sits ACROSS the belt ---------------
     bp 0 is the outer cDNA end and it lies at +y, the near side; the UMI end is
     at -y, the far side, which is the side the whitelists are on. So the three
     barcodes face the plates that judge them. */
  const uBP=M.uBP, segAt=M.segAt, BCBP=M.BCBP;
  const yBP=(yc,bp)=>yc+FL/2-bp*uBP;

  /* ---- THE R2 BLOCK, which is the only part of the molecule this station
     looks at. bp 96 (the start of bc1) to bp 154 (the end of the UMI) — the
     blue stretch, and every scanner face, light curtain and beam on this belt
     is measured off it rather than off the belt's own width. SCN_F is the far
     tip, at -y, up-right, on the side the whitelist plates are; SCN_N is the
     near edge, lapping a little way back over the unsequenced middle. All four
     come from yardMetrics, because PORTS reads them too. */
  const R2A=M.R2A, R2B=M.R2B;
  const SCN_F=M.SCN_F, SCN_N=M.SCN_N, SCN_MID=M.SCN_MID, SCN_LEN=M.SCN_LEN;

  /* ---- the deck, almost not there --------------------------------------- */
  /* the near edge is set by the shredder now that it is thin in y, not by a
     trough as deep as a fragment is long */
  /* the near edge sits just past the reject line: the siding runs along it and
     the fragments go over it */
  const dTop=cy-FL/2-SC(0.9), dBot=n.y+SC(A.REJ)+SC(0.9);
  const xIn=XX(A.IN);
  slabAt(g,(xIn+x1)/2,(dTop+dBot)/2,x1-xIn,dBot-dTop,base,DECK,0,0.32);

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
  /* THE TRACK ENDS AT THE EDGE. It used to run all the way to the bin, which
     drew a rail into a hopper on the same surface; there is no rail past the
     edge, there is a drop. */
  for(let i=0;i<3;i++) guide(x=>rejY(x,i),0.18,"1.2",gx[i],TIPA);

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
  const gz=M.gz, panelZ=M.panelZ;
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
    grp.appendChild(el("polygon",{fill:"var(--fg)","fill-opacity":"0.105",stroke:"none",
      points:pts([P(sx,SCN_F,base+panelZ),P(sx,SCN_N,base+panelZ),
                  P(sx,SCN_N,base),P(sx,SCN_F,base)])}));
    /* AND THE PANEL IS TRANSLUCENT. Opaque and 1.45 wide it was a bench top: it
       hid the fragment for a long stretch of belt, and the one moment this
       station exists to show happened underneath it. Half as wide and see
       through, and the read happens in view. */
    /* 0.78, UP FROM 0.62. Translucent enough to read a verdict through and no
       more: at 0.62 the face was a suggestion of a face and the deck's own
       lines came through it, which is the same mistake the belt at E4 was
       making. What has to stay visible through it is the mark, and a mark is a
       bright stroke on a dark ground — it survives 0.78 comfortably. */
    slabAt(grp,sx,SCN_MID,PANW,SCN_LEN,0.07*KZ,GAN,base+panelZ,0.78);
    const slots=[];
    for(let c=0;c<14;c++){
      const px=sx-PANW*0.42+(c/13)*PANW*0.84, hw=SCN_LEN/2-SC(0.16);
      const a=P(px,SCN_MID-hw,base+panelZ+0.075*KZ), b=P(px,SCN_MID+hw,base+panelZ+0.075*KZ);
      slots.push({node:grp.appendChild(el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
        x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg)",
        "stroke-width":"1.7","stroke-opacity":"0.07"})),lit:-99});
    }
    return {sx,i,slots,sw:-1,swP:[sx,cy,0]};
  });

  /* ---- THE LASER, built after the scanners so it reads as light ----------
     A beam dropped from the scanner face to the deck, AIMED AT ONE SQUARE: the
     station's own barcode and no other. BC1's laser points at bc1, BC2's at
     bc2, BC3's at bc3, and each is a fixed point on the machine — the fragment
     is what moves.

     IT USED TO SWEEP, first the whole molecule and then the whole R2 block, and
     both were the same mistake in different sizes: a beam that travels the
     length of a read is a beam reading all of it, and no station here reads
     more than one square. A fixed aim says which one, without a caption and
     without a colour, and it turns the pass into an event with an order —
     the square arrives, the laser fires on it, the answer follows. */
  stations.forEach(st=>{
    st.beam=g.appendChild(el("line",{stroke:"var(--fg)","stroke-width":"1.3",
      "stroke-opacity":"0","stroke-linecap":"round"}));
    st.spot=g.appendChild(el("ellipse",{fill:"var(--fg)","fill-opacity":"0",
      rx:(SC(0.26)*S*C30).toFixed(1), ry:(SC(0.26)*S*0.30).toFixed(1)}));
  });

  /* ---- the bin: A SHREDDER, TURNED NINETY DEGREES, ON THE NEAR EDGE -------

     It was a hopper lying ACROSS the siding, long in y, because what came down
     the siding was a fragment lying across the belt and the mouth had to be as
     wide as the thing entering it. Both have turned. A rejected fragment now
     swings round as it leaves the belt and arrives END ON, travelling along its
     own length, so the mouth it needs is a SLOT rather than a trough — long in
     x, thin in y, lying along the yard's near edge, which is the one edge on
     this deck with nothing else on it.

     AND IT SHREDS. A bin that swallows is a bin that stores, and nothing is
     stored here: 24.3% of reads carry no valid barcode combination and they
     are discarded with no record of which ones. The cutters run only while
     something is going through them, which is the honest picture — the machine
     is not busy, it is busy WHEN a fragment reaches it — and the flash of them
     turning is the one moment a reader can see the deletion happen. */
  /* OFF THE DECK AND ON THE FLOOR, so the deck's near edge is something a
     fragment goes OVER. Standing on the deck the bin was a bay at the end of a
     siding — a place on the same surface, which reads as sorting rather than as
     discarding. Beyond the edge and lower, the last thing a rejected fragment
     does is leave the machine's own floor. Its top has to sit BELOW the height
     the fragments ride at, or they would climb into it. */
  const BIN2=shredBin(g,binX,BY,SLOTX,SLOTY,BUCKH,HEADH,BIN,GAN);

  /* ---- names ------------------------------------------------------------- */
  const lab=(wx,wy,wz,str,size,fill,op,rot,anchor,dy)=>{
    const a=P(wx,wy,wz);
    const t=el("text",{transform:`translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) rotate(${rot})`,
      "text-anchor":anchor||"start","font-family":FQ_MONO,fill,"font-size":size,
      "font-weight":"600","letter-spacing":(size*0.10).toFixed(2),"fill-opacity":op});
    if(dy) t.setAttribute("y",dy);
    t.textContent=str; g.appendChild(t);
  };
  const FS=M.FS;
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
    const lx=st.sx, ly=M.labY, lz=M.labZ;
    lab(lx,ly,lz, `BC${i+1}`, (FS*2).toFixed(1), "var(--fg)", "1", 30, "middle");
    /* dy is measured from BC1's baseline and BC1 is twice the size, so the
       1.35 that works under a normal name puts WHITELIST inside the big
       glyph's box — 23% overlap, which check-text caught. */
    lab(lx,ly,lz, "WHITELIST", FS.toFixed(1), "var(--fg2)", ".85", 30, "middle",
        (FS*1.85).toFixed(1));
  });
  lab(binX-SC(1.5), BY+SLOTY*2.9/2+SC(0.85), 0, "NO MATCH",
      (FS*1.25).toFixed(1), "var(--rej)", "1", 30);
  /* PAST THE MOUTH OF THE BELT, not alongside it. Between the near rail and the
     reject siding there are 1.4 authored units and the siding's own fragments
     use most of them; the clear ground is beyond the end, which is also where
     the thing being named actually goes.

     AND OFF THE FAR RAIL, because the track out of this station leaves from the
     NEAR one. On the belt's centre line the two were parallel and on top of each
     other, and the orange line read as something coming out of the words.

     RIGHT OF THE END AND ABOVE IT, which is one move in world terms and two on
     screen: a little further along x carries it past the mouth, and a good way
     into -y lifts it clear of the belt entirely — -y is up-and-to-the-right
     here. Sitting a third of a fragment off the far rail it still read as a
     label ON the belt; up here it reads as what leaves it. */
  const VLY=cy-FL/2-SC(1.75);
  lab(x1+SC(1.05), VLY, base, "VALIDATED TRIPLETS",
      (FS*1.1).toFixed(1), "var(--ok)", "1", -30);
  lab(x1+SC(1.05), VLY, base, "putative cell barcodes",
      (FS*0.92).toFixed(1), "var(--fg3)", ".9", -30, "start", (FS*1.33).toFixed(1));

  /* ---- one lap ----------------------------------------------------------- */
  const PAD=-SC(A.PAD), LOOP=(x1-x0)+PAD*2;
  const LANDX=XX(A.LANDX), FALLX=SC(4.0), FALLZ=2.6*KZ;

  /* ---- A PIECE OF THE MOLECULE, AT WHATEVER ANGLE IT IS LYING AT ----------
     Every part of a fragment used to be placed by its base pairs in y at a
     fixed x, because a fragment on this belt only ever lay one way: broadside,
     long in y. A rejected one now TURNS as it leaves — see the note on the
     shredder — so a piece has to be a segment between two base pairs rather
     than a span of y, and `rot` carries it from one to the other.

       rot 0   long in y      the reading pose, broadside to the scanners
       rot 1   long in x      the discard pose, end on to the slot

     At rot 1 the cDNA end is at -x and the UMI end at +x, which is the
     broadside pose turned a quarter turn CLOCKWISE on screen: +y is down-left
     here and -x is up-left, so that is the way the near end swings. The
     fragment then travels along its own length, which is what lets the bin be
     a slot instead of a trough. */
  /* ---- THE POSE: WHERE A BASE PAIR IS, THIS FRAME --------------------------
     A fragment on this belt used to lie one way and one way only — broadside,
     long in y — so a piece of it was a span of y at a fixed x. It now has three
     poses and moves through all of them:

       broadside   long in +/-y      the reading pose, under the scanners
       end on      long in x         the discard pose, turned a quarter turn
       standing    long in z         going down through the shredder's slot

     So a piece is a segment between two base pairs along a direction, from an
     anchor. PBP is which base pair the anchor IS, and that matters: through the
     turn the fragment pivots about its MIDDLE, and going into the slot it
     pivots about its NOSE, because a thing being fed into a machine turns about
     the end that is already in it. */
  const HALFBP=YARD_MOL_BP/2;
  let PA=[0,0,0], PD=[0,-1,0], PBP=HALFBP;
  const ptOf=bp=>{ const k=(bp-PBP)*uBP;
    return [PA[0]+k*PD[0], PA[1]+k*PD[1], PA[2]+k*PD[2]]; };
  /* THE PER-BASE-PAIR CLIP IS GONE, and it is worth saying what it was for.
     While a rejected fragment was fed in END FIRST — through the side, and then
     stood on end through the lid — the honest way to draw it disappearing was
     to stop drawing the part that had already gone through: CUTBP was the base
     pair the blades had reached, and everything past it was not drawn. That is
     the right mechanism for a thing consumed progressively.

     It is not the right mechanism for a thing that DROPS IN. A fragment falling
     flat through a slot goes in all at once, the lid hides it, and that is the
     whole picture; a clip would be a second answer to a question the geometry
     already answers. If anything here is ever eaten from one end again, this is
     the shape of it. */
  /* the width runs ACROSS the molecule in the ground plane, and falls back to y
     when the molecule is standing on end and has no ground direction left */
  const across=h=>{ const nh=Math.hypot(PD[0],PD[1]);
    return nh>0.05?[-PD[1]/nh*h,PD[0]/nh*h]:[0,h]; };
  const bar=(node,bpA,bpB,op,hw)=>{
    if(bpA>=bpB){ node.setAttribute("fill-opacity","0");
                  node.setAttribute("stroke-opacity","0"); return; }
    const a=ptOf(bpA), b=ptOf(bpB), n=across(hw===undefined?THK/2:hw);
    node.setAttribute("points",pts([P(a[0]+n[0],a[1]+n[1],a[2]),P(b[0]+n[0],b[1]+n[1],b[2]),
      P(b[0]-n[0],b[1]-n[1],b[2]),P(a[0]-n[0],a[1]-n[1],a[2])]));
    node.setAttribute("fill-opacity",clamp01(op).toFixed(3));
    node.setAttribute("stroke-opacity",(clamp01(op)*0.5).toFixed(3));
  };
  const rail=(node,bpA,bpB,op)=>{
    if(bpA>=bpB){ node.setAttribute("stroke-opacity","0"); return; }
    const q=ptOf(bpA), r=ptOf(bpB), a=P(q[0],q[1],q[2]), b=P(r[0],r[1],r[2]);
    node.setAttribute("x1",a[0].toFixed(1)); node.setAttribute("y1",a[1].toFixed(1));
    node.setAttribute("x2",b[0].toFixed(1)); node.setAttribute("y2",b[1].toFixed(1));
    node.setAttribute("stroke-opacity",clamp01(op).toFixed(3));
  };

  /* ---- SCAN, THEN ANSWER, AND IN THAT ORDER ------------------------------
     The laser is lit while the fragment is within LASW of the station and is
     brightest at the instant its own square is directly beneath — that is what
     `sin(pi*u)` buys: the pulse arrives with the block and leaves with it.

     The verdict lands at FIREAT, which is deliberately OUTSIDE that window. The
     beam goes out, and a moment later the mark pops. Read, then answered — two
     events with a gap between them, in the order the machine does them, rather
     than one thing happening twice. Keep FIREAT > LASW or the two collapse back
     into a single flash; keep it under SC(0.9) or the answer arrives after the
     reject siding has already begun to peel the fragment away. */
  const LASW=SC(0.50), FIREAT=SC(0.62);
  const SCANHZ=21, SCANTRAIL=3.2;             /* slots per second, and the tail */
  let t=0, shredT=-99;
  const run=dt=>{
    t+=dt;
    for(const st of stations) st.sw=-1;
    for(const fr of frags){
      const u=((t*v/LOOP+fr.ph)%1+1)%1;
      const fx=x0-PAD+u*LOOP;
      if(fr.px!==undefined && fx<fr.px) fr.flash=[-99,-99,-99];

      /* the descent, exactly as before: it is the fragment that falls */
      const air=Math.pow(1-clamp01((fx-(x0-PAD))/(LANDX-(x0-PAD))),1.6);
      const zAir=FALLZ*air, xAir=-FALLX*air, cx=fx+xAir;
      let vis=Math.min(sstep(x0-PAD,x0-PAD+SC(0.4),fx),1-sstep(x1-SC(0.8),x1+SC(0.2),fx));

      if(fr.fail<0){
        PBP=HALFBP; PD=[0,-1,0]; PA=[cx,cy,zR+zAir];
      }else{
        /* IT TURNS ON THE SAME CURVE IT PEELS OFF ON. The divert and the
           quarter turn are one movement — a thing leaving a line swings round
           as it goes — so rot rides rejY's own sstep rather than having a
           schedule of its own, and the two can never come apart. */
        const rot=sstep(gx[fr.fail]+SC(0.9),gx[fr.fail]+MZ,fx);
        const tip=sstep(TIPA,TIPB,fx), yr=rejY(fx,fr.fail);
        /* ONE ANCHOR THE WHOLE WAY: its middle. The axis is NORMALISED —
           lerping the two components without it shortens the fragment to 71% at
           the halfway point, which reads as the molecule shrinking as it
           turns. */
        const rx=rot, ry=-(1-rot), L=Math.hypot(rx,ry)||1;
        PBP=HALFBP; PD=[rx/L,ry/L,0];
        if(tip<=0){
          PA=[cx,yr,zR+zAir];
        }else{
          /* OVER THE EDGE, THEN STRAIGHT DOWN. It stays flat and it stays
             end-on: the fragment crosses to sit above the slot, hangs there for
             the length of the crossing, and then drops in.

             IT USED TO STAND ON END TO GET IN, and that was a workaround for a
             slot too short to take it lying down. Widen the mouth and the
             molecule does not have to do anything clever — which is the honest
             picture as well, since nothing about a discarded read turns it
             upright. What is left is one translation down, and the lid does the
             rest: the bin is drawn after the fragments, so a thing at the slot
             goes behind the machine's own top face and is gone. */
          const drop=sstep(TIPB,DIVEND,fx), e=tip*tip;
          PA=[cx+(binX-cx)*tip, yr+(BY-yr)*tip,
              zR+(HOVER-zR)*e-(HOVER-(binTop-FL*0.10))*drop*drop];
          /* and it stops existing once it is through the lid */
          vis*=1-sstep(binTop,binTop-FL*0.16,PA[2]);
          if(PA[2]<HOVER*0.55+binTop*0.45) shredT=t;
        }
      }

      /* the backbone runs the length of the barcode block; the middle is a
         dotted line because there is nothing in it to draw */
      const gapS=segAt("gap"), bcS=segAt("bc1"), umiS=segAt("umi");
      rail(fr.bone,bcS[0],umiS[1],vis*0.30);
      rail(fr.mid ,gapS[0],gapS[1],vis*0.45);

      /* the cDNA is two fifths of the molecule and it is not what this station
         is about. Drawn at full strength it was the loudest thing on the belt
         and the barcodes read as trim on the end of an orange bar — so it is
         held back, present and in proportion but not the subject. */
      const cd=segAt("cdna");
      bar(fr.cdna,cd[0],cd[1],vis*0.55);

      fr.bc.forEach((node,i)=>{
        const c=segAt(`bc${i+1}`);
        const reachable=fr.fail<0||i<=fr.fail;
        const scanned=fx>gx[i]+FIREAT&&reachable;
        const bad=fr.fail===i&&scanned;
        const fl=Math.max(0,1-(t-fr.flash[i])/0.38);
        node.setAttribute("fill",bad?"var(--rej)":R2T);
        bar(node,c[0],c[1],vis*(bad?0.78:scanned?0.95:0.50)*(1+fl*0.30));
      });
      bar(fr.umi,umiS[0],umiS[1],0);
      fr.umi.setAttribute("fill-opacity",(clamp01(vis*0.16)).toFixed(3));
      fr.umi.setAttribute("stroke-opacity",(clamp01(vis*0.8)).toFixed(3));

      /* THE VERDICT FIRES WHERE THE BEAM CROSSES THE BLOCK IT IS ABOUT. The
         mark is built before the gantries, so it passes under the scanner and
         the face is see-through: a tick struck beneath the panel is read
         through the glass, which is what the panel was narrowed and thinned
         for. See LASW/FIREAT above for the order the two happen in. */
      stations.forEach((st,i)=>{
        const prev=fr.px===undefined?fx:fr.px;
        const stillOnLine=fr.fail<0||i<=fr.fail;
        if(prev<=st.sx+FIREAT && fx>st.sx+FIREAT && stillOnLine){
          fr.flash[i]=t;
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
        const q=ptOf(BCBP[i]);
        const a=P(q[0],q[1],q[2]+0.5*KZ);
        const pop=age<0.11?0.55+1.0*(age/0.11):1.15-0.15*Math.min(1,(age-0.11)/0.14);
        const op=(age<0.08?age/0.08:1);
        mk.setAttribute("transform",
          `translate(${a[0].toFixed(1)},${a[1].toFixed(1)}) scale(${pop.toFixed(2)})`);
        mk.setAttribute("stroke-opacity",(op*vis*0.9).toFixed(3));
      });
      stations.forEach((st,i)=>{
        if(vis>0.5 && (fr.fail<0||i<=fr.fail) && Math.abs(fx-st.sx)<LASW){
          st.sw=(fx-(st.sx-LASW))/(2*LASW); st.swP=ptOf(BCBP[i]);
        }
      });
      fr.px=fx;
    }

    for(const st of stations){
      if(st.sw<0){ st.beam.setAttribute("stroke-opacity","0");
                   st.spot.setAttribute("fill-opacity","0"); continue; }
      /* IT DROPS ON THE BLOCK, NOT ON THE STATION.
         Standing at the arch's own x the beam was only ON its target for the
         instant the fragment was exactly under the arch; either side of that it
         was landing on bare deck a bar's width away, and the whole lit window
         read as a zap that missed. The face is PANW wide, so a beam leaving any
         point on its underside is the same machine — aiming it at the block
         keeps it locked on for the whole pass, which is what a reader does.
         The mark still fires later, at FIREAT: scan, then answer.

         And it takes the block's POINT rather than a line and a lookup: the
         fragment's pose is only knowable while its own turn of the loop is
         running, so the aim is captured there. */
      const q=st.swP;
      const a=P(q[0],q[1],base+panelZ), b=P(q[0],q[1],base);
      st.beam.setAttribute("x1",a[0].toFixed(1)); st.beam.setAttribute("y1",a[1].toFixed(1));
      st.beam.setAttribute("x2",b[0].toFixed(1)); st.beam.setAttribute("y2",b[1].toFixed(1));
      /* BRIGHTEST WHEN THE SQUARE IS DIRECTLY BENEATH, which is what sin(pi*u)
         is doing here: the pulse arrives with the block and leaves with it, and
         a beam that snapped on would be a lamp rather than a reading. */
      const k=Math.sin(Math.PI*clamp01(st.sw));
      st.beam.setAttribute("stroke-opacity",(0.78*k).toFixed(3));
      st.spot.setAttribute("cx",b[0].toFixed(1)); st.spot.setAttribute("cy",b[1].toFixed(1));
      st.spot.setAttribute("fill-opacity",(0.50*k).toFixed(3));
    }
    /* ---- THE CUTTERS, RUNNING ONLY WHILE SOMETHING IS IN THEM -------------
       A machine that turns all the time is scenery; one that starts when a
       thing reaches it is a machine doing something to that thing. The blades
       scroll along the slot and fade out over RUNOUT once the last fragment is
       through, so it spins down rather than stopping dead. */
    BIN2.run(t, 1-(t-shredT)/0.55, SC(5.2));
    const scroll=((t*v)%SLAT_P+SLAT_P)%SLAT_P;
    slats.forEach((ln,k)=>{
      const sx2=xIn+((k*SLAT_P+scroll)%SLAT_RUN);
      const a=P(sx2,cy-FL/2,base), b2=P(sx2,cy+FL/2,base);
      ln.setAttribute("x1",a[0].toFixed(1)); ln.setAttribute("y1",a[1].toFixed(1));
      ln.setAttribute("x2",b2[0].toFixed(1)); ln.setAttribute("y2",b2[1].toFixed(1));
    });
    /* THE READOUT SCANS, AND IT SCANS ON ITS OWN CLOCK.
       Each slot used to be lit by a verdict and left to decay over 1.7 seconds,
       so the face changed about as often as a fragment passed — one line coming
       up bright every second or so, which reads as a light blinking rather than
       as a machine reading. A scanner's face is not a tally of what it has
       decided; it is the READING, and reading is fast. A head that crosses all
       fourteen slots in about two thirds of a second, with three slots of trail
       behind it, is the difference between a lamp and an instrument. */
    for(const st of stations){
      const n2=st.slots.length, head=(t*SCANHZ)%n2;
      st.slots.forEach((sl,i)=>{
        let d=head-i; if(d<0) d+=n2;                 /* slots behind the head */
        const trail=Math.max(0,1-d/SCANTRAIL);
        sl.node.setAttribute("stroke-opacity",(0.06+0.9*trail*trail).toFixed(3));
      });
    }
  };
  run(0);
  TICKERS.push(dt=>run(dt));
}
DRAW.sortingyard=drawSortingYard;
