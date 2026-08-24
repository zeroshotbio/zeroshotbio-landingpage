/* ============================================================
   bp-shapes.js — this page's own visual vocabulary, which is three shapes.

   THE FOUR ROOFS USED TO LIVE HERE AND NOW LIVE IN /culls/culls-draw.js,
   because /pipeline draws them too. Two hand-maintained accounts of one
   pipeline drift, and the drift is invisible until somebody quotes the wrong
   one — the same reason this page's node prose is lifted from that map rather
   than re-typed. There is one knee chart, and both maps show it.

   What is left here is what is genuinely this page's:

     SKIN     the three skins its objects wear, copied from /pipeline
     topOf    every object on this page is a box, so it is just n.h
     drawTile / drawHeap / drawMatrix   lifted verbatim from /pipeline

   Those three are copied rather than shared on purpose. They are /pipeline's
   shapes, and that file is where they are maintained; if one of them changes
   there, lift it again. The roofs are the other way round — they were written
   here and /pipeline imports them — which is why they moved out rather than
   being copied over.

   Load order: iso -> shapes -> culls-pop -> culls-draw -> data -> view
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

