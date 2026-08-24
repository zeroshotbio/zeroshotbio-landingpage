/* ============================================================
   fq-shapes.js — this page's own visual vocabulary, which is three shapes.

   All three are LIFTED VERBATIM FROM /pipeline's pipeline-shapes.js, down to
   the seed drawMatrix uses for its sparsity, because a station here must be
   the same object as the station there. A box that looks different is telling
   a reader they are looking at two different things.

     SKIN     the three skins its objects wear, copied from /pipeline
     topOf    every object on this page is a box, so it is just n.h
     drawHeap / drawTile / drawMatrix   the FASTQ heap, the six stations, the cube

   THIS PAGE DRAWS NO ROOF CHARTS AND LOADS NO POPULATION. The four roofed
   culls live in /culls/culls-draw.js, shared between /pipeline and
   /bioinformatics_pipe; nothing on this stretch of the row has a decision with
   a chart behind it, so neither of those files is loaded here. roofFrame() is
   still in fq-iso.js and still works — it is part of the shared vocabulary,
   not a dependency of this map.

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

/* THE ONE DEVIATION FROM /pipeline'S COPY, AND IT IS A HIT TARGET RATHER THAN
   A MARK. A heap is twenty-two loose boxes of random height, so most of the
   volume its silhouette encloses is air — including, on this page, the exact
   centre of the footprint at full height, which is where a person aims and
   where check-clicks.mjs presses. The click went straight through the heap to
   the canvas behind it and cleared the selection.

   So the footprint is laid down first as a transparent silhouette: painted, so
   it takes pointer events, and invisible, so it changes nothing on screen. It
   goes in FIRST, behind every box, so it can never occlude one. Everything
   below this is /pipeline's drawHeap, verbatim. */
function drawHeap(g,n){
  const hw=n.w/2, hd=n.d/2;
  g.appendChild(el("polygon",{fill:"transparent",stroke:"none",points:pts([
    P(n.x-hw,n.y-hd,n.h), P(n.x+hw,n.y-hd,n.h), P(n.x+hw,n.y+hd,n.h),
    P(n.x+hw,n.y+hd,0),   P(n.x-hw,n.y+hd,0),   P(n.x-hw,n.y-hd,0)])}));

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

