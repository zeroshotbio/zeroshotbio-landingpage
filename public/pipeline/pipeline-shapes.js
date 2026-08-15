/* ============================================================
   pipeline-shapes.js — the visual vocabulary.
   One function per shape. Contract:
     draw(g, n)  appends SVG to group g for node n
     reads only  n.x n.y n.w n.d n.h plus its own custom fields
     colours     always var(--token), never a hex literal (light mode)
     motion      push to TICKERS, never setInterval
   Adding a shape = one draw function + one key in DRAW. Nothing else changes.
   ============================================================ */

const V=n=>`var(--${n})`;

const SKIN={
  tile:{top:V("t-top"),left:V("t-left"),right:V("t-right"),sw:1,so:.6},
  anchor:{top:V("a-top"),left:V("a-left"),right:V("a-right"),sw:1.7,so:1},
  works:{top:V("k-top"),left:V("k-left"),right:V("k-right"),sw:1.4,so:1},
  monolith:{top:V("m-top"),left:V("m-left"),right:V("m-right"),sw:1.7,so:1},
  glass:{top:V("g-top"),left:V("g-left"),right:V("g-right"),sw:1.2,so:1,fo:.75},
  cold:{top:V("c-top"),left:V("c-left"),right:V("c-right"),sw:1.3,so:1},
  sA:{top:V("sa-top"),left:V("sa-left"),right:V("sa-right"),sw:1.5,so:1},
  sB:{top:V("sb-top"),left:V("sb-left"),right:V("sb-right"),sw:1.5,so:1},
  sC:{top:V("sc-top"),left:V("sc-left"),right:V("sc-right"),sw:1.5,so:1},
};


/* the height a structure actually reaches, for anything drawn on top of it */
const topOf = n => n.shape==="works"   ? n.h*0.96
                 : n.shape==="tankrack"? 1.4
                 : n.shape==="machine" ? 1.42
                 : n.shape==="vials"   ? 0.82 : n.h;


const drawTile =(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile,n.hatch);
const drawPylon=(g,n)=>paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);
const drawDish =(g,n)=>{
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile);
  const f=faces(n.x,n.y,n.w*0.72,n.d*0.72,n.h);
  g.appendChild(el("polygon",{points:f.top,fill:"var(--voxel)","fill-opacity":".16",
    stroke:"var(--stroke)","stroke-opacity":".4","stroke-width":".8"}));
};
/* ------------------------------------------------------------------
   ① THE AQUARIUM
   A 2x2 block of tall glass tanks, sharing walls, glass on every side,
   only the edges opaque.

   Three passes, in this order, and the order is the whole illusion:
     1. STRUCTURE  floor, gravel, plants, far walls, surface, near walls
     2. EDGES      the wireframe, deduplicated so shared walls draw once
     3. FISH       every school in the block, drawn last, on top of it all
                   and unclipped, so no wall can ever cut one in half

   The fish are the subject, so nothing is allowed to cover them — not the
   glass of their own tank and not the tank in front. They are still kept
   inside their box by their swim bounds, so none of them swims out
   through a wall.
   ------------------------------------------------------------------ */
let UID = 0;

/* the six-point outline of a box, for clipping */
function silhouette(x,y,w,d,h){
  const hw=w/2, hd=d/2;
  return pts([ P(x-hw,y-hd,h), P(x+hw,y-hd,h), P(x+hw,y+hd,h),
               P(x+hw,y+hd,0), P(x-hw,y+hd,0), P(x-hw,y-hd,0) ]);
}

/* one fish: nose at +x, drawn flat then rotated onto the grid axis */
function fishSprite(scale){
  const col  = "var(--fish, var(--fg))";
  const wrap = el("g",{transform:`scale(${scale})`});
  const body = el("g",{});
  const tail = el("g",{});
  tail.appendChild(el("path",{d:"M -5.5 0 L -10 -3.4 L -10 3.4 Z",fill:col,"fill-opacity":".72"}));
  body.appendChild(tail);
  body.appendChild(el("path",{d:"M -6 0 Q -1.5 -3.3 4.5 0 Q -1.5 3.3 -6 0 Z",
    fill:col,"fill-opacity":".95"}));
  body.appendChild(el("path",{d:"M -1 -1.7 L 1.6 -3.6 L 2.6 -1.2 Z",fill:col,"fill-opacity":".6"}));
  body.appendChild(el("circle",{cx:"2.6",cy:"-.7",r:".75",fill:"var(--bg)","fill-opacity":".9"}));
  wrap.appendChild(body);
  return {node:wrap, tail};
}

/* one tank. Returns its edges and its school for the later passes. */
function buildTank(cx, cy, tw, td, th, seed, school){
  const r=rng(seed), hw=tw/2, hd=td/2;
  const floor=th*0.045, water=th*0.82;
  const quad=(a,b,c,d)=>pts([a,b,c,d]);
  const structure=el("g",{});

  /* floor */
  structure.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,0),P(cx+hw,cy-hd,0),
    P(cx+hw,cy+hd,0),P(cx-hw,cy+hd,0)),
    fill:"var(--gravel, var(--fg2))","fill-opacity":".3"}));

  /* far walls, tinted as the body of water */
  const farTint={fill:"var(--water, var(--signal))","fill-opacity":".17"};
  structure.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx+hw,cy-hd,water),
    P(cx+hw,cy-hd,0),P(cx-hw,cy-hd,0)), ...farTint}));
  structure.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx-hw,cy+hd,water),
    P(cx-hw,cy+hd,0),P(cx-hw,cy-hd,0)), ...farTint}));

  /* scenery, clipped to the tank */
  const cid=`tank${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("polygon",{points:silhouette(cx,cy,tw,td,th)}));
  structure.appendChild(cp);
  const scene=el("g",{"clip-path":`url(#${cid})`});
  scene.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,floor),P(cx+hw,cy-hd,floor),
    P(cx+hw,cy+hd,floor),P(cx-hw,cy+hd,floor)),
    fill:"var(--gravel, var(--fg2))","fill-opacity":".55"}));
  for(let i=0;i<4;i++){
    const px=cx-hw+0.16+r()*(tw-0.32), py=cy-hd+0.14+r()*(td-0.28);
    const [ax,ay]=P(px,py,floor), hgt=(0.3+r()*0.42)*th*S*CZ, lean=(r()-0.5)*12;
    scene.appendChild(el("path",{d:`M ${ax} ${ay} q ${lean} ${-hgt*0.6} ${lean*1.9} ${-hgt}`,
      fill:"none",stroke:"var(--plant, var(--fg2))","stroke-width":"1.7",
      "stroke-opacity":".55","stroke-linecap":"round"}));
  }
  structure.appendChild(scene);

  /* surface, then the near glass */
  structure.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx+hw,cy-hd,water),
    P(cx+hw,cy+hd,water),P(cx-hw,cy+hd,water)),
    fill:"var(--water, var(--signal))","fill-opacity":".24",
    stroke:"var(--water, var(--signal))","stroke-width":".9","stroke-opacity":".55"}));
  const nearTint={fill:"var(--water, var(--signal))","fill-opacity":".08"};
  structure.appendChild(el("polygon",{points:quad(P(cx+hw,cy-hd,th),P(cx+hw,cy+hd,th),
    P(cx+hw,cy+hd,0),P(cx+hw,cy-hd,0)), ...nearTint}));
  structure.appendChild(el("polygon",{points:quad(P(cx-hw,cy+hd,th),P(cx+hw,cy+hd,th),
    P(cx+hw,cy+hd,0),P(cx-hw,cy+hd,0)), ...nearTint}));

  /* the twelve edges, handed up for deduplication */
  const C=[[cx-hw,cy-hd],[cx+hw,cy-hd],[cx+hw,cy+hd],[cx-hw,cy+hd]];
  const edges=[];
  for(let i=0;i<4;i++){
    edges.push([C[i],C[(i+1)%4],0,0,1,.5]);      // base
    edges.push([C[i],C[(i+1)%4],th,th,1.5,.9]);  // rim
    edges.push([C[i],C[i],0,th,1.2,.75]);        // upright
  }

  /* the school. Deliberately NOT clipped: the swim bounds below keep every
     fish well inside its tank, and a clip path would slice a sprite in half
     the moment it passed near a wall. */
  const swimmers=el("g",{});
  const fish=[];
  for(let i=0;i<school;i++){
    const {node,tail}=fishSprite(0.7+r()*0.35);
    fish.push({node,tail,u:r(),v:r(),wz:0.16+r()*0.62,
               dir:r()<0.5?-1:1, speed:0.15+r()*0.2, phase:r()*6.28});
  }
  fish.sort((a,b)=>a.v-b.v).forEach(f=>swimmers.appendChild(f.node));

  const bx=cx-hw+0.26, bw=tw-0.52, by=cy-hd+0.22, bd=td-0.44;
  const swim=(dt,now)=>{
    fish.forEach(f=>{
      f.u += f.dir*f.speed*dt;
      if(f.u>1){f.u=1;f.dir=-1;} else if(f.u<0){f.u=0;f.dir=1;}
      const bob=Math.sin(now/1000*1.5+f.phase)*0.02;
      const [px,py]=P(bx+f.u*bw, by+f.v*bd, floor+0.16+f.wz*(water-floor-0.34)+bob);
      f.node.setAttribute("transform",
        `translate(${px},${py}) rotate(30) scale(${f.dir},1)`);
      f.tail.setAttribute("transform",`rotate(${Math.sin(now/1000*7+f.phase)*17} -5.5 0)`);
    });
  };
  swim(0, performance.now());
  return {structure, edges, swimmers, swim};
}

function drawTankRack(g,n){
  const tw=n.w/2, td=n.d/2, th=1.35;        // four tanks, walls touching
  const cells=[];
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)
    cells.push([n.x-n.w/2+tw*(i+0.5), n.y-n.d/2+td*(j+0.5), i, j]);
  cells.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]));   // far tanks first

  const built=cells.map(([cx,cy,i,j])=>buildTank(cx,cy,tw,td,th,11+i*17+j*7,4));

  /* pass 1 — structure */
  built.forEach(b=>g.appendChild(b.structure));

  /* pass 2 — edges, each shared wall drawn exactly once */
  const seen=new Set();
  built.forEach(b=>b.edges.forEach(([p,q,z1,z2,wid,op])=>{
    const a=[p[0].toFixed(3),p[1].toFixed(3),z1.toFixed(3)].join(),
          c=[q[0].toFixed(3),q[1].toFixed(3),z2.toFixed(3)].join();
    const k=a<c?a+"|"+c:c+"|"+a;
    if(seen.has(k)) return;
    seen.add(k);
    const A=P(p[0],p[1],z1), B=P(q[0],q[1],z2);
    g.appendChild(el("line",{x1:A[0],y1:A[1],x2:B[0],y2:B[1],stroke:"var(--stroke)",
      "stroke-width":wid,"stroke-opacity":op,"stroke-linecap":"round"}));
  }));

  /* pass 3 — the fish, over everything */
  built.forEach(b=>g.appendChild(b.swimmers));

  built.forEach(b=>TICKERS.push((dt,now,k)=>{ if(k<0.7) return; b.swim(dt,now); }));
}
function drawPlate(g,n,skin){
  paint(g,n.x,n.y,n.w,n.d,n.h,skin);
  const C=n.cols,R=n.rows,x0=n.x-n.w/2,y0=n.y-n.d/2,sx=n.w/C,sy=n.d/R;
  for(let i=0;i<C;i++)for(let j=0;j<R;j++){
    const cx=x0+(i+0.5)*sx, cy=y0+(j+0.5)*sy, r=Math.min(sx,sy)*0.33;
    const first=i===0&&j===0;
    g.appendChild(el("polygon",{points:pts([P(cx-r,cy-r,n.h),P(cx+r,cy-r,n.h),P(cx+r,cy+r,n.h),P(cx-r,cy+r,n.h)]),
      fill:first?"var(--signal)":"var(--voxel)","fill-opacity":first?".9":".38",stroke:"none"}));
  }
}
const drawPlate96=(g,n)=>drawPlate(g,n,SKIN.anchor);
const drawMiniplate=(g,n)=>drawPlate(g,n,SKIN.tile);
function drawVials(g,n){
  paint(g,n.x,n.y,n.w,n.d,0.2,SKIN.works);
  const v=[];
  for(let i=0;i<4;i++)for(let j=0;j<2;j++) v.push({x:n.x-n.w/2+0.35+i*0.38,y:n.y-n.d/2+0.42+j*0.66});
  v.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  v.forEach(t=>{const gg=el("g",{transform:`translate(0,${-0.2*S*CZ})`});
    paint(gg,t.x,t.y,0.22,0.22,0.62,SKIN.cold); g.appendChild(gg);});
}
function drawMachine(g,n){
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);
  const gg=el("g",{transform:`translate(0,${-n.h*S*CZ})`});
  paint(gg,n.x-0.45,n.y-0.2,1.0,0.7,0.42,SKIN.monolith); g.appendChild(gg);
  const f=faces(n.x+0.5,n.y+n.d/2,0.7,0.02,0.5);
  g.appendChild(el("polygon",{points:f.left,fill:"var(--signal)","fill-opacity":".7",
    stroke:"var(--stroke)","stroke-width":"1"}));
}
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
function drawMonolith(g,n){
  let z=0;
  [[n.w,n.h*0.34],[n.w*0.8,n.h*0.36],[n.w*0.58,n.h*0.30]].forEach(([w,h])=>{
    const gg=el("g",{transform:`translate(0,${-z*S*CZ})`});
    paint(gg,n.x,n.y,w,w,h,SKIN.monolith); g.appendChild(gg); z+=h;});
}
function drawStrata(g,n){
  const r=rng(31),layers=8,hh=n.h/layers; let z=0;
  for(let i=0;i<layers;i++){
    const w=n.w*(0.62+r()*0.38);
    const gg=el("g",{transform:`translate(0,${-z*S*CZ})`});
    paint(gg,n.x,n.y,w,w,hh*0.92,(i===2||i===5)?SKIN.sC:(i%2?SKIN.sA:SKIN.sB));
    g.appendChild(gg); z+=hh;}
}
function drawWorks(g,n){
  paint(g,n.x,n.y,n.w,n.d,0.32,SKIN.works);
  [[-0.5,-0.42,1.5],[0.42,-0.28,1.15],[-0.05,0.46,0.85]]
    .sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]))
    .forEach(([dx,dy,h])=>{const gg=el("g",{transform:`translate(0,${-0.32*S*CZ})`});
      paint(gg,n.x+dx,n.y+dy,0.55,0.55,h,SKIN.monolith); g.appendChild(gg);});
}
function drawGhost(g,n){
  const f=faces(n.x,n.y,n.w,n.d,n.h);
  ["left","right","top"].forEach(k=>g.appendChild(el("polygon",
    {points:f[k],fill:"none",stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".5","stroke-dasharray":"4 3"})));
}


/* the registry — a node opts in with shape:"<key>" */
const DRAW={heap:drawHeap,matrix:drawMatrix,monolith:drawMonolith,strata:drawStrata,works:drawWorks,
  ghost:drawGhost,pylon:drawPylon,tile:drawTile,tankrack:drawTankRack,plate96:drawPlate96,
  miniplate:drawMiniplate,vials:drawVials,machine:drawMachine,dish:drawDish};
