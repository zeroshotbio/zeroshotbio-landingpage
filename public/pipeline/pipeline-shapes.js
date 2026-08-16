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
                 : n.shape==="vials"   ? n.h  : n.h;


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
/* ------------------------------------------------------------------
   FIXED MATERIAL
   The plate is filled, the cells stop moving, and it goes into the freezer.

   Requires ellipseAt() from the clutch block and PLATE_BANDS / PLATE_ROWS /
   plateWells() / plateSlab() / drawWell() from the plate set, so the same
   plastic carries through from the Echo to here.

   The plate stays opaque and is hidden by the DOOR, never by a fade. Cells
   stop dead behind the tip rather than easing to a halt — fixation is not a
   deceleration. The shell (top face, right flank, front frame) draws over the
   plate once it starts moving in, which is done by reparenting the cart on
   that state change rather than every frame.
   ------------------------------------------------------------------ */
function drawVials(g,n){
  const r=rng(59);
  const pw=n.w*0.58, pd=pw*0.79;
  /* the plate stands well clear of the freezer at rest — it is drawn in front
     of the shell until it is stowed, so any shared ground cuts into the door */
  const plate={x:n.x-n.w*0.15, y:n.y+n.d*0.50, w:pw, d:pd};
  const th=0.3;
  const frz={x:n.x+n.w*0.08, y:n.y-n.d*0.42, w:n.w*0.82, d:n.d*0.62, h:n.h};

  const snowflake=(host,pt2,R,op)=>{
    const fl=el("g",{});
    const line=(a,b,w,o)=>{
      const p=pt2(a[0],a[1]), q=pt2(b[0],b[1]);
      fl.appendChild(el("line",{x1:p[0],y1:p[1],x2:q[0],y2:q[1],
        stroke:"var(--fg)","stroke-width":w,"stroke-opacity":o,"stroke-linecap":"round"}));
    };
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3, dx=Math.cos(a), dy=Math.sin(a);
      line([0,0],[dx*R,dy*R],1.5,op);
      [[0.5,0.3],[0.78,0.2]].forEach(([f,len])=>{
        const bx=dx*R*f, by=dy*R*f;
        [0.62,-0.62].forEach(sw=>{
          const ca=Math.cos(a+sw), sa=Math.sin(a+sw);
          line([bx,by],[bx+ca*R*len, by+sa*R*len],1.1,op*0.9);
        });
      });
    }
    const hex=[];
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      hex.push(pt2(Math.cos(a)*R*0.16, Math.sin(a)*R*0.16));
    }
    fl.appendChild(el("polygon",{points:pts(hex),fill:"var(--fg)","fill-opacity":op*0.8}));
    host.appendChild(fl);
    return fl;
  };

  const interiorG=el("g",{}); g.appendChild(interiorG);

  const doorY=frz.y+frz.d/2;
  const D=(xv,zv)=>P(xv,doorY,zv);
  const hwF=frz.w/2;
  const dx0=frz.x-hwF+0.04, dx1=frz.x+hwF-0.04;
  const dz0=frz.h*0.08, dz1=frz.h*0.9;
  interiorG.appendChild(el("polygon",{
    points:pts([D(dx0,dz1),D(dx1,dz1),D(dx1,dz0),D(dx0,dz0)]),
    fill:"var(--bg)","fill-opacity":".95"}));
  const inside=P(frz.x, frz.y, frz.h*0.42);

  const cart=el("g",{});
  g.appendChild(cart);
  const pc=P(plate.x,plate.y,th*0.5);
  plateSlab(cart,plate,th,SKIN.anchor,1.6);
  const wells=plateWells(plate,th);
  wells.forEach(w=>drawWell(cart,w,true));

  const groups=wells.map(w=>{
    const cells=[];
    for(let k=0;k<7;k++){
      const a=r()*6.283, rad=Math.sqrt(r())*w.e.rx*0.5;
      const cx=w.e.x+Math.cos(a)*rad, cy=w.e.y+Math.sin(a)*rad*0.6;
      const node=el("circle",{cx:cx,cy:cy,r:0.8,fill:"var(--fg)","fill-opacity":".8"});
      cart.appendChild(node);
      cells.push({node,cx,cy,ph:r()*6.283,ph2:r()*6.283,
                  rate:1.6+r()*1.6, rate2:3.2+r()*2.6, amp:0.45+r()*0.4});
    }
    return {w,cells,order:w.i*PLATE_ROWS+w.j};
  });
  groups.sort((a,b)=>a.order-b.order);
  if(!groups.length) return;

  const shellG=el("g",{});
  const ff=faces(frz.x,frz.y,frz.w,frz.d,frz.h);
  ["right","top"].forEach(k=>shellG.appendChild(el("polygon",
    {points:ff[k],fill:SKIN.cold[k],stroke:"var(--stroke)","stroke-width":"1.3"})));
  snowflake(shellG,(u,v)=>P(frz.x+u, frz.y+v, frz.h), Math.min(frz.w,frz.d)*0.3, .5);
  snowflake(shellG,(u,v)=>P(frz.x+hwF, frz.y+u, frz.h*0.55+v),
            Math.min(frz.d,frz.h)*0.26, .45);

  const F=(a,b,c,d)=>shellG.appendChild(el("polygon",{points:pts([D(a,d),D(b,d),D(b,c),D(a,c)]),
    fill:SKIN.cold.left,stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".8"}));
  F(frz.x-hwF, frz.x+hwF, 0,   dz0);
  F(frz.x-hwF, frz.x+hwF, dz1, frz.h);
  F(frz.x-hwF, dx0,       dz0, dz1);
  F(dx1,       frz.x+hwF, dz0, dz1);

  const pip=el("g",{});
  const skin={fill:"var(--t-top)","fill-opacity":".95",stroke:"var(--stroke)",
              "stroke-width":".8","stroke-opacity":".85"};
  const tilt=el("g",{transform:"rotate(-15)"});
  tilt.appendChild(el("path",{d:"M -.8 -1.5 L .8 -1.5 L 2.2 -12 L -2.2 -12 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -2.2 -12 L 2.2 -12 L 1.7 -40 L -1.7 -40 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -3.4 -40 L 3.4 -40 L 2.8 -56 L -2.8 -56 Z", ...skin}));
  pip.appendChild(tilt); cart.appendChild(pip);

  g.appendChild(shellG);

  const door=el("polygon",{points:"0,0",fill:"var(--c-left)","fill-opacity":"1",
    stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".9"});
  g.appendChild(door);
  const flake=el("g",{opacity:"0"}); g.appendChild(flake);
  snowflake(flake,(u,v)=>D((dx0+dx1)/2+u,(dz0+dz1)/2+v),
            Math.min(dx1-dx0,dz1-dz0)*0.3, .85);
  const handle=el("line",{x1:D(dx1-0.05,frz.h*0.36)[0],y1:D(dx1-0.05,frz.h*0.36)[1],
    x2:D(dx1-0.05,frz.h*0.62)[0],y2:D(dx1-0.05,frz.h*0.62)[1],
    stroke:"var(--stroke)","stroke-width":"2.4","stroke-opacity":"0",
    "stroke-linecap":"round"});
  g.appendChild(handle);

  const STEP=0.5;                 // same pace as the tip on the arraying step
  const FILL=groups.length*STEP;
  const SETTLE=0.6, SHRINK=1.8, CLOSE=0.9, HOLD=1.6, OPEN=0.7;
  const CYCLE=FILL+SETTLE+SHRINK+CLOSE+HOLD+OPEN;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  let t=0, stowed=null;
  const run=(dt)=>{
    t=(t+dt)%CYCLE;
    const head=Math.floor(t/STEP);

    const goingIn = t>FILL+SETTLE;
    if(goingIn!==stowed){
      stowed=goingIn;
      if(goingIn) g.insertBefore(cart, shellG);
      else        g.appendChild(cart);
    }

    groups.forEach((grp,i)=>{
      const fixed = t>=FILL || i<head;
      grp.cells.forEach(c=>{
        if(fixed){
          c.node.setAttribute("cx",c.cx); c.node.setAttribute("cy",c.cy);
          c.node.setAttribute("fill-opacity",".28");
          c.node.setAttribute("stroke","var(--fg)");
          c.node.setAttribute("stroke-width",".55");
          c.node.setAttribute("stroke-opacity",".9");
        }else{
          const jx=Math.sin(t*c.rate+c.ph)+0.6*Math.sin(t*c.rate2+c.ph2);
          const jy=Math.cos(t*c.rate*0.83+c.ph2)+0.6*Math.cos(t*c.rate2*1.17+c.ph);
          c.node.setAttribute("cx",(c.cx+jx*c.amp).toFixed(2));
          c.node.setAttribute("cy",(c.cy+jy*c.amp*0.62).toFixed(2));
          c.node.setAttribute("fill-opacity",".8");
          c.node.setAttribute("stroke-opacity","0");
        }
      });
    });

    if(t<FILL){
      const cur=groups[Math.min(head,groups.length-1)].w.e,
            prev=groups[Math.max(0,head-1)].w.e,
            f=ease(Math.min(1,(t-head*STEP)/(STEP*0.55)));
      pip.setAttribute("opacity","1");
      pip.setAttribute("transform",
        `translate(${prev.x+(cur.x-prev.x)*f},${prev.y+(cur.y-prev.y)*f-5-Math.sin(f*Math.PI)*12})`);
    } else pip.setAttribute("opacity","0");

    const SC_END=Math.max(0.12,((dx1-dx0)*0.5)/plate.w);
    let sc=1, e=0;
    if(t>FILL+SETTLE){
      e=ease(Math.min(1,(t-FILL-SETTLE)/SHRINK));
      sc=1-(1-SC_END)*e;
    }
    const aimX=pc[0]+(inside[0]-pc[0])*e, aimY=pc[1]+(inside[1]-pc[1])*e;
    cart.setAttribute("transform",
      `translate(${(aimX-pc[0]*sc).toFixed(2)},${(aimY-pc[1]*sc).toFixed(2)}) scale(${sc.toFixed(3)})`);

    let dq=0;
    const tClose=FILL+SETTLE+SHRINK;
    if(t>tClose && t<=tClose+CLOSE) dq=ease((t-tClose)/CLOSE);
    else if(t>tClose+CLOSE && t<=tClose+CLOSE+HOLD) dq=1;
    else if(t>tClose+CLOSE+HOLD) dq=1-ease((t-tClose-CLOSE-HOLD)/OPEN);
    const edge=dx0+(dx1-dx0)*dq;
    door.setAttribute("points",pts([D(dx0,dz1),D(edge,dz1),D(edge,dz0),D(dx0,dz0)]));
    door.setAttribute("fill-opacity",(0.85*Math.min(1,dq*4)).toFixed(2));
    flake.setAttribute("opacity",(dq>0.75?(dq-0.75)/0.25:0).toFixed(2));
    handle.setAttribute("stroke-opacity",(dq>0.85?0.9:0).toFixed(2));
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
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


/* ------------------------------------------------------------------
   A1 · PAIR SET IN THE EVENING
   A small breeding tank with the divider still in: one fish each side,
   nosing at the partition they will be let through at first light.

   Same three-pass rule as the aquarium — structure, edges, then fish on
   top, unclipped. The divider is drawn with the structure, so both fish
   stay visible in front of it; they sit on opposite sides of it along the
   grid x axis, so in this projection they barely overlap it anyway.

   Reuses fishSprite() and silhouette() from the aquarium block, which
   must already be present in this file.
   ------------------------------------------------------------------ */
function drawBreedingTank(g,n){
  const r=rng(23), hw=n.w/2, hd=n.d/2, th=n.h;
  const floor=th*0.05, water=th*0.8;
  const quad=(a,b,c,d)=>pts([a,b,c,d]);
  const cx=n.x, cy=n.y;

  /* floor */
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,0),P(cx+hw,cy-hd,0),
    P(cx+hw,cy+hd,0),P(cx-hw,cy+hd,0)),
    fill:"var(--gravel, var(--fg2))","fill-opacity":".3"}));

  /* far walls */
  const farTint={fill:"var(--water, var(--signal))","fill-opacity":".15"};
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx+hw,cy-hd,water),
    P(cx+hw,cy-hd,0),P(cx-hw,cy-hd,0)), ...farTint}));
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx-hw,cy+hd,water),
    P(cx-hw,cy+hd,0),P(cx-hw,cy-hd,0)), ...farTint}));

  /* gravel */
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,floor),P(cx+hw,cy-hd,floor),
    P(cx+hw,cy+hd,floor),P(cx-hw,cy+hd,floor)),
    fill:"var(--gravel, var(--fg2))","fill-opacity":".5"}));

  /* evening: the room lights are off */
  g.appendChild(el("polygon",{points:silhouette(cx,cy,n.w,n.d,th),
    fill:"var(--bg)","fill-opacity":".22"}));

  /* THE DIVIDER — a plate across the middle, with a tab to pull it by */
  const dz=th*1.16;
  g.appendChild(el("polygon",{points:quad(P(cx,cy-hd,dz),P(cx,cy+hd,dz),
    P(cx,cy+hd,0),P(cx,cy-hd,0)),
    fill:"var(--t-top)","fill-opacity":".9",stroke:"var(--stroke)",
    "stroke-width":"1","stroke-opacity":".85"}));
  const tabA=P(cx,cy-hd*0.34,dz), tabB=P(cx,cy+hd*0.34,dz);
  g.appendChild(el("line",{x1:tabA[0],y1:tabA[1]-6,x2:tabB[0],y2:tabB[1]-6,
    stroke:"var(--stroke)","stroke-width":"2.4","stroke-opacity":".9","stroke-linecap":"round"}));

  /* surface and near glass */
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy-hd,water),P(cx+hw,cy-hd,water),
    P(cx+hw,cy+hd,water),P(cx-hw,cy+hd,water)),
    fill:"var(--water, var(--signal))","fill-opacity":".2",
    stroke:"var(--water, var(--signal))","stroke-width":".8","stroke-opacity":".5"}));
  const nearTint={fill:"var(--water, var(--signal))","fill-opacity":".07"};
  g.appendChild(el("polygon",{points:quad(P(cx+hw,cy-hd,th),P(cx+hw,cy+hd,th),
    P(cx+hw,cy+hd,0),P(cx+hw,cy-hd,0)), ...nearTint}));
  g.appendChild(el("polygon",{points:quad(P(cx-hw,cy+hd,th),P(cx+hw,cy+hd,th),
    P(cx+hw,cy+hd,0),P(cx-hw,cy+hd,0)), ...nearTint}));

  /* edges */
  const C=[[cx-hw,cy-hd],[cx+hw,cy-hd],[cx+hw,cy+hd],[cx-hw,cy+hd]];
  const edge=(p,q,z1,z2,wid,op)=>{
    const a=P(p[0],p[1],z1), b=P(q[0],q[1],z2);
    g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"var(--stroke)",
      "stroke-width":wid,"stroke-opacity":op,"stroke-linecap":"round"}));
  };
  for(let i=0;i<4;i++){
    edge(C[i],C[(i+1)%4],0,0,1,.5);
    edge(C[i],C[(i+1)%4],th,th,1.4,.9);
    edge(C[i],C[i],0,th,1.1,.75);
  }

  /* one fish each side, unclipped and drawn last */
  const school=el("g",{}); g.appendChild(school);
  const gap=n.w*0.09, margin=n.w*0.17;
  const lanes=[
    {x0:cx-hw+margin, x1:cx-gap},      // her side
    {x0:cx+gap,       x1:cx+hw-margin} // his side
  ];
  const fish=lanes.map((L,i)=>{
    const {node,tail}=fishSprite(0.5+r()*0.12);
    school.appendChild(node);
    return {node,tail,L,u:r(),v:0.3+r()*0.4,wz:0.3+r()*0.35,
            dir:i?-1:1, speed:0.1+r()*0.1, phase:r()*6.28};
  });
  const by=cy-hd+n.d*0.3, bd=n.d*0.4;
  const swim=(dt,now)=>{
    fish.forEach(f=>{
      f.u += f.dir*f.speed*dt;
      if(f.u>1){f.u=1;f.dir=-1;} else if(f.u<0){f.u=0;f.dir=1;}
      const bob=Math.sin(now/1000*1.3+f.phase)*0.015;
      const [px,py]=P(f.L.x0+f.u*(f.L.x1-f.L.x0), by+f.v*bd,
                      floor+0.1*th+f.wz*(water-floor-0.3*th)+bob);
      f.node.setAttribute("transform",
        `translate(${px},${py}) rotate(30) scale(${f.dir},1)`);
      f.tail.setAttribute("transform",`rotate(${Math.sin(now/1000*6+f.phase)*15} -5.5 0)`);
    });
  };
  swim(0, performance.now());
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; swim(dt,now); });
}
DRAW.breedingtank = drawBreedingTank;


/* ------------------------------------------------------------------
   A2 · THE CLUTCH
   A round dish of one morning's eggs.

   A circle on the ground plane projects to an axis-aligned ellipse in
   this system — semi-axes R·S·cos30·√2 and R·S·0.5·√2 — so the dish is
   drawn with real ellipses rather than faceted polygons. The near wall
   is the lower half of the rim ellipse swept down to the lower half of
   the floor ellipse.

   Most eggs are clear with a dark embryo inside. A few are flat opaque
   white: those are the unfertilised ones, and they are what gets picked
   out by hand at the next step.
   ------------------------------------------------------------------ */
function ellipseAt(cx,cy,z,R){
  const [x,y]=P(cx,cy,z);
  return {x,y,rx:R*S*C30*Math.SQRT2, ry:R*S*0.5*Math.SQRT2};
}
function arcPts(e,from,to,n){
  const out=[];
  for(let i=0;i<=n;i++){
    const f=from+(to-from)*(i/n);
    out.push([e.x+e.rx*Math.cos(f), e.y+e.ry*Math.sin(f)]);
  }
  return out;
}

function drawClutch(g,n){
  const r=rng(41), R=Math.min(n.w,n.d)/2*0.94, th=n.h;
  const floor=ellipseAt(n.x,n.y,0,R);
  const med  =ellipseAt(n.x,n.y,th*0.72,R*0.985);
  const rim  =ellipseAt(n.x,n.y,th,R);

  /* the dish itself: floor, then the near wall as a swept band */
  g.appendChild(el("ellipse",{cx:floor.x,cy:floor.y,rx:floor.rx,ry:floor.ry,
    fill:"var(--g-right)","fill-opacity":".8",stroke:"var(--stroke)",
    "stroke-width":".8","stroke-opacity":".45"}));
  g.appendChild(el("polygon",{
    points:pts([...arcPts(rim,0,Math.PI,26), ...arcPts(floor,Math.PI,0,26)]),
    fill:"var(--g-top)","fill-opacity":".5",stroke:"none"}));

  /* the eggs, drawn back to front */
  const eggs=[];
  for(let i=0;i<52;i++){
    const a=r()*6.283, rad=Math.sqrt(r())*R*0.8;
    const ex=n.x+Math.cos(a)*rad, ey=n.y+Math.sin(a)*rad;
    eggs.push({ex,ey,z:th*(0.06+r()*0.1),size:1.3+r()*0.35,
               dead:r()<0.11, ang:r()*6.283});
  }
  /* every egg gets its own slow drift — a clutch in medium is never still */
  const drift=[];
  eggs.map(e=>({e,p:P(e.ex,e.ey,e.z)}))
      .sort((a,b)=>a.p[1]-b.p[1])
      .forEach(({e,p})=>{
    const node=el("g",{});
    if(e.dead){
      /* unfertilised: flat and opaque */
      node.appendChild(el("circle",{cx:p[0],cy:p[1],r:e.size,
        fill:"var(--fg)","fill-opacity":".82"}));
    }else{
      node.appendChild(el("circle",{cx:p[0],cy:p[1],r:e.size,
        fill:"var(--fg)","fill-opacity":".16",
        stroke:"var(--fg)","stroke-width":".7","stroke-opacity":".55"}));
      /* the embryo, curled against one side of the chorion */
      node.appendChild(el("circle",{
        cx:p[0]+Math.cos(e.ang)*e.size*0.34, cy:p[1]+Math.sin(e.ang)*e.size*0.34,
        r:e.size*0.44, fill:"var(--fg)","fill-opacity":".9"}));
    }
    g.appendChild(node);
    drift.push({node, ax:0.5+r()*0.9, ay:0.35+r()*0.6,
                r1:0.45+r()*0.7, r2:0.6+r()*0.9, p1:r()*6.283, p2:r()*6.283});
  });
  let ct=0;
  const runClutch=(dt)=>{
    ct+=dt;
    drift.forEach(d=>{
      const x=Math.sin(ct*d.r1+d.p1)+0.5*Math.sin(ct*d.r2*1.7+d.p2);
      const y=Math.cos(ct*d.r2+d.p2)+0.5*Math.cos(ct*d.r1*1.9+d.p1);
      d.node.setAttribute("transform",
        `translate(${(x*d.ax).toFixed(2)},${(y*d.ay).toFixed(2)})`);
    });
  };
  runClutch(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; runClutch(dt); });

  /* medium above them, then the rim */
  g.appendChild(el("ellipse",{cx:med.x,cy:med.y,rx:med.rx,ry:med.ry,
    fill:"var(--water, var(--signal))","fill-opacity":".16"}));
  g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,
    fill:"none",stroke:"var(--stroke)","stroke-width":"1.4","stroke-opacity":".9"}));
}
DRAW.clutch = drawClutch;


/* ------------------------------------------------------------------
   A3 · CULL THE UNFERTILISED
   The same dish as A2, under a pipette that keeps picking the opaque
   eggs out one at a time. The first cull on the whole map, done by hand.

   The loop: descend, take one, lift, slide to the next. When the last
   dead egg is gone the dish refills and it starts again — a repeating
   demonstration rather than a state that runs out.

   Requires ellipseAt() and arcPts() from the A2 clutch block.
   ------------------------------------------------------------------ */
function drawCullDish(g,n){
  const r=rng(53), R=Math.min(n.w,n.d)/2*0.94, th=n.h;
  const floorE=ellipseAt(n.x,n.y,0,R),
        medE  =ellipseAt(n.x,n.y,th*0.72,R*0.985),
        rimE  =ellipseAt(n.x,n.y,th,R);

  g.appendChild(el("ellipse",{cx:floorE.x,cy:floorE.y,rx:floorE.rx,ry:floorE.ry,
    fill:"var(--g-right)","fill-opacity":".8",stroke:"var(--stroke)",
    "stroke-width":".8","stroke-opacity":".45"}));
  g.appendChild(el("polygon",{
    points:pts([...arcPts(rimE,0,Math.PI,26), ...arcPts(floorE,Math.PI,0,26)]),
    fill:"var(--g-top)","fill-opacity":".5"}));

  /* eggs — a handful of them dead, and those are the ones that get taken */
  const eggs=[], dead=[];
  for(let i=0;i<40;i++){
    const a=r()*6.283, rad=Math.sqrt(r())*R*0.78;
    eggs.push({ex:n.x+Math.cos(a)*rad, ey:n.y+Math.sin(a)*rad,
               z:th*(0.06+r()*0.1), size:1.3+r()*0.35, dead:i<6, ang:r()*6.283});
  }
  /* same drift as the clutch — it is the same dish one step later. The pipette
     keeps aiming at each egg's home point, not its drifted one; at this
     amplitude the difference is under a pixel. */
  const drift=[];
  eggs.map(e=>({e,p:P(e.ex,e.ey,e.z)}))
      .sort((a,b)=>a.p[1]-b.p[1])
      .forEach(({e,p})=>{
    const node=el("g",{});
    if(e.dead){
      const c=el("circle",{cx:p[0],cy:p[1],r:e.size,fill:"var(--fg)","fill-opacity":".82"});
      node.appendChild(c);
      /* a duller, warmer twin sits over it, hidden until the pipette takes
         this one — it's what lets a culled egg read as culled instead of
         just gone. Reuses --drop, the same tone the map already uses for
         everything discarded upstream. */
      const warn=el("circle",{cx:p[0],cy:p[1],r:e.size,fill:"var(--drop)","fill-opacity":"0"});
      node.appendChild(warn);
      dead.push({node:c,warn,p,size:e.size});
    }else{
      node.appendChild(el("circle",{cx:p[0],cy:p[1],r:e.size,fill:"var(--fg)",
        "fill-opacity":".16",stroke:"var(--fg)","stroke-width":".7","stroke-opacity":".55"}));
      node.appendChild(el("circle",{cx:p[0]+Math.cos(e.ang)*e.size*0.34,
        cy:p[1]+Math.sin(e.ang)*e.size*0.34, r:e.size*0.44,
        fill:"var(--fg)","fill-opacity":".9"}));
    }
    g.appendChild(node);
    drift.push({node, ax:0.5+r()*0.9, ay:0.35+r()*0.6,
                r1:0.45+r()*0.7, r2:0.6+r()*0.9, p1:r()*6.283, p2:r()*6.283});
  });

  g.appendChild(el("ellipse",{cx:medE.x,cy:medE.y,rx:medE.rx,ry:medE.ry,
    fill:"var(--water, var(--signal))","fill-opacity":".16"}));
  g.appendChild(el("ellipse",{cx:rimE.x,cy:rimE.y,rx:rimE.rx,ry:rimE.ry,
    fill:"none",stroke:"var(--stroke)","stroke-width":"1.4","stroke-opacity":".9"}));

  /* the pipette, drawn in screen space: tip at the origin, pointing down */
  const pip=el("g",{});
  const skin={fill:"var(--t-top)","fill-opacity":".95",stroke:"var(--stroke)",
              "stroke-width":".9","stroke-opacity":".85"};
  const tilt=el("g",{transform:"rotate(-15)"});
  tilt.appendChild(el("path",{d:"M -1 -2 L 1 -2 L 2.6 -15 L -2.6 -15 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -2.6 -15 L 2.6 -15 L 2 -52 L -2 -52 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -4.2 -52 L 4.2 -52 L 3.4 -72 L -3.4 -72 Z", ...skin}));
  const caught=el("circle",{cx:"0",cy:"-26",r:"1.4",fill:"var(--fg)",
    "fill-opacity":"0"});
  tilt.appendChild(caught);
  pip.appendChild(tilt);
  g.appendChild(pip);

  /* the loop */
  const HIGH=38, CYCLE=3.0, ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  let i=0, t=0, ct=0;
  const swim=(dt)=>{
    t+=dt; ct+=dt;
    drift.forEach(d=>{
      const x=Math.sin(ct*d.r1+d.p1)+0.5*Math.sin(ct*d.r2*1.7+d.p2);
      const y=Math.cos(ct*d.r2+d.p2)+0.5*Math.cos(ct*d.r1*1.9+d.p1);
      d.node.setAttribute("transform",
        `translate(${(x*d.ax).toFixed(2)},${(y*d.ay).toFixed(2)})`);
    });
    if(t>CYCLE){
      t-=CYCLE;
      dead[i].node.setAttribute("fill-opacity","0");
      dead[i].warn.setAttribute("fill-opacity","0");
      i=(i+1)%dead.length;
      if(i===0) dead.forEach(d=>{
        d.node.setAttribute("fill-opacity",".82");
        d.warn.setAttribute("fill-opacity","0");
      });
    }
    const p=t/CYCLE, here=dead[i].p, next=dead[(i+1)%dead.length].p;
    let lift=HIGH, x=here[0], y=here[1], grab=0;
    if(p<0.3)        lift=HIGH*(1-ease(p/0.3));
    else if(p<0.42){ lift=0; grab=(p-0.3)/0.12; }
    else if(p<0.78){ lift=HIGH*ease((p-0.42)/0.36); grab=1; }
    else {
      const f=ease((p-0.78)/0.22);
      x=here[0]+(next[0]-here[0])*f; y=here[1]+(next[1]-here[1])*f;
      grab=1-f;
    }
    /* the egg at rest turns before it lifts: fg drains out while --drop
       rises and falls under it, so the last thing seen at that spot is a
       duller, warmer dot rather than a healthy one just switching off. */
    if(p>=0.3){
      const fp=Math.min(1,(p-0.3)/0.48);
      dead[i].node.setAttribute("fill-opacity",(0.82*(1-fp)).toFixed(2));
      dead[i].warn.setAttribute("fill-opacity",(Math.sin(fp*Math.PI)*0.42).toFixed(2));
    }
    pip.setAttribute("transform",`translate(${x},${y-lift})`);
    caught.setAttribute("fill-opacity", (grab*0.85).toFixed(2));
    caught.setAttribute("cy", (-20-grab*14).toFixed(1));
  };
  swim(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; swim(dt); });
}
DRAW.culldish = drawCullDish;


/* ==================================================================
   THE PLATE SET — Echo dispense, the dosed plate, arraying into it.

   Corrected causal order. Compound goes into an EMPTY 48-well plate by
   acoustic dispensing from an Echo cherry-picking layout. The plate then
   sits dosed. Embryos are added at 24 hpf, into wells that already
   contain the compound. There is no separate "dosing" step after the
   fish are in the plate — the fish arrive into the dose.

   All three shapes share PLATE_BANDS and the 8 x 6 = 48 geometry, so the
   same plastic is recognisable across the three nodes.

   Requires ellipseAt() from the A2 clutch block.
   ================================================================== */

/* two columns each: vehicle, positive control, unknown, unknown */
const PLATE_BANDS = [
  {fill:"var(--fg)",                   op:.16},   // 0.1% DMSO vehicle
  {fill:"var(--drop)",                 op:.5 },   // sorafenib, anti-angiogenic
  {fill:"var(--water, var(--signal))", op:.5 },   // orlistat
  {fill:"var(--plant, var(--fg2))",    op:.55},   // dapagliflozin
];
const PLATE_COLS=8, PLATE_ROWS=6;

/* the well grid of any plate on this map */
function plateWells(n, th){
  const hw=n.w/2, hd=n.d/2, sx=n.w/PLATE_COLS, sy=n.d/PLATE_ROWS;
  const R=Math.min(sx,sy)*0.38, out=[];
  for(let j=0;j<PLATE_ROWS;j++)for(let i=0;i<PLATE_COLS;i++)
    out.push({i,j,band:PLATE_BANDS[Math.floor(i/2)],
              e:ellipseAt(n.x-hw+(i+0.5)*sx, n.y-hd+(j+0.5)*sy, th, R)});
  return out;
}
function plateSlab(g,n,th,skin,sw){
  const f=faces(n.x,n.y,n.w,n.d,th);
  ["left","right","top"].forEach(k=>g.appendChild(el("polygon",
    {points:f[k],fill:skin[k],stroke:"var(--stroke)","stroke-width":sw})));
  const inner=faces(n.x,n.y,n.w-0.1,n.d-0.1,th);
  g.appendChild(el("polygon",{points:inner.top,fill:"var(--bg)","fill-opacity":".2",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".45"}));
  const nk=[P(n.x-n.w/2,n.y-n.d/2,th),P(n.x-n.w/2+0.18,n.y-n.d/2,th),
            P(n.x-n.w/2,n.y-n.d/2+0.18,th)];
  g.appendChild(el("polygon",{points:pts(nk),fill:"var(--stroke)","fill-opacity":".55"}));
}
function drawWell(g,w,dosed){
  g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx,ry:w.e.ry,
    fill:"var(--bg)","fill-opacity":".6",stroke:"var(--stroke)",
    "stroke-width":".6","stroke-opacity":".55"}));
  if(dosed){
    g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx*0.86,ry:w.e.ry*0.86,
      fill:w.band.fill,"fill-opacity":w.band.op}));
    g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx*0.86,ry:w.e.ry*0.86,
      fill:"none",stroke:"var(--fg)","stroke-width":".5","stroke-opacity":".3"}));
  }
}

/* ------------------------------------------------------------------
   ECHO 650 DISPENSE
   Acoustic dispensing, well by well, fast.

   The destination plate hangs INVERTED above the source and droplets are
   fired upward into it — no tip ever touches the liquid. The transducer
   works one well at a time at a few hundred drops a second, so what you
   see is a wave: the firing ring sweeps column by column, a dozen
   droplets are in the air at once at different heights, and the plate
   above fills with colour behind the wave as each well takes its dose.

   Because the sweep runs column by column and the compounds are laid out
   in vertical bands, the wave changes colour four times on its way
   across. That is the treatment axis of the entire dataset being written,
   in order, in about two seconds.
   ------------------------------------------------------------------ */
function drawEchoDispense(g,n){
  const th=0.1, gap=1.55, CH=0.34;
  const lift=CH*S*CZ;                       // the deck sits on the chassis
  const src={x:n.x,y:n.y,w:n.w,d:n.d}, dst={x:n.x,y:n.y,w:n.w,d:n.d};

  /* THE INSTRUMENT. The source is not a second plate sitting in mid-air: it is
     a microplate recessed into the deck of a machine, with the transducer
     under it. Draw the chassis first so the whole node reads as apparatus. */
  paint(g,n.x,n.y,n.w*1.16,n.d*1.34,CH,SKIN.works);
  const lipT=faces(n.x,n.y,n.w*1.04,n.d*1.16,CH);
  g.appendChild(el("polygon",{points:lipT.top,fill:"var(--bg)","fill-opacity":".5",
    stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".6"}));
  /* a panel on the near face, with a light that pulses as it fires */
  const py=n.y+n.d*0.67, pf=(xv,zv)=>P(xv,py,zv);
  const px0=n.x-n.w*0.42, px1=n.x-n.w*0.06;
  g.appendChild(el("polygon",{
    points:pts([pf(px0,CH*0.78),pf(px1,CH*0.78),pf(px1,CH*0.24),pf(px0,CH*0.24)]),
    fill:"var(--bg)","fill-opacity":".6",stroke:"var(--stroke)",
    "stroke-width":".7","stroke-opacity":".6"}));
  const lamps=[0,1,2].map(i=>{
    const c=pf(px0+0.07+i*0.1, CH*0.51);
    const e2=el("circle",{cx:c[0],cy:c[1],r:"1.7",fill:"var(--fg)","fill-opacity":".3"});
    g.appendChild(e2); return e2;
  });

  /* the source plate, recessed into the deck */
  const deck=el("g",{transform:`translate(0,${-lift})`});
  plateSlab(deck,src,th,SKIN.tile,1);
  const swells=plateWells(src,th);
  swells.forEach(w=>drawWell(deck,w,true));
  g.appendChild(deck);

  /* where the transducer is aimed */
  const ring=el("ellipse",{rx:"1",ry:"1",fill:"none",stroke:"var(--fg)",
    "stroke-width":"1.3","stroke-opacity":"0"});
  g.appendChild(ring);

  /* droplets in flight */
  const rise=(th+gap)*S*CZ, POOL=26;
  const flying=[];
  for(let i=0;i<POOL;i++){
    const d=el("ellipse",{rx:"1.9",ry:"2.5",fill:"var(--fg)","fill-opacity":"0"});
    g.appendChild(d); flying.push(d);
  }

  /* destination plate, inverted above, filling as the wave passes */
  const above=el("g",{transform:`translate(0,${-(lift+(th+gap)*S*CZ)})`});
  plateSlab(above,dst,th,SKIN.tile,1);
  const dwells=plateWells(dst,th).map(w=>{
    above.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx,ry:w.e.ry,
      fill:"var(--bg)","fill-opacity":".5",stroke:"var(--stroke)",
      "stroke-width":".5","stroke-opacity":".45"}));
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx*0.86,ry:w.e.ry*0.86,
      fill:w.band.fill,"fill-opacity":"0"});
    above.appendChild(fill);
    return {w,fill,rx:w.e.rx*0.86,ry:w.e.ry*0.86};
  });
  g.appendChild(above);

  /* fire order: column by column, so the wave crosses the four bands */
  const order=swells.map((w,i)=>i)
    .sort((a,b)=> (swells[a].i-swells[b].i) || (swells[a].j-swells[b].j));
  const slot=[]; order.forEach((wellIdx,pos)=>slot[wellIdx]=pos);

  /* LEAD: the well starts taking its colour this long BEFORE the droplet
     formally expires, and the droplet dissolves across the same window, so
     arrival reads as a merge rather than a hand-off with a gap in it. */
  const STEP=0.042, LIFE=0.72, LEAD=0.45, POP=0.14, PAUSE=1.1;
  const TOTAL=order.length*STEP+LIFE+PAUSE;
  let t=0;
  const run=(dt)=>{
    t=(t+dt)%TOTAL;
    const head=Math.floor(t/STEP);

    /* the wave */
    flying.forEach((node,k)=>{
      const idx=head-k;
      if(idx<0||idx>=order.length){ node.setAttribute("fill-opacity","0"); return; }
      const age=t-idx*STEP;
      if(age<0||age>LIFE){ node.setAttribute("fill-opacity","0"); return; }
      const w=swells[order[idx]], f=age/LIFE;
      node.setAttribute("cx",w.e.x);
      node.setAttribute("cy",(w.e.y-lift-rise*(1-(1-f)*(1-f))).toFixed(1));
      node.setAttribute("fill",w.band.fill);
      const fadeIn=f<0.06?f/0.06:1;
      const merge=age>LIFE-LEAD ? Math.max(0,1-(age-(LIFE-LEAD))/LEAD) : 1;
      node.setAttribute("fill-opacity",(fadeIn*merge).toFixed(2));
    });

    /* the plate above, filling behind it */
    dwells.forEach((d,i)=>{
      const pos=slot[i];
      if(pos===undefined){ d.fill.setAttribute("fill-opacity","0"); return; }
      const since=t-(pos*STEP+LIFE-LEAD);
      if(since<0){ d.fill.setAttribute("fill-opacity","0"); return; }
      const ramp=Math.min(1,since/LEAD);
      const after=since-LEAD;
      const pop=(after>=0&&after<POP) ? 1-after/POP : 0;
      d.fill.setAttribute("rx",(d.rx*(1+0.4*pop)).toFixed(2));
      d.fill.setAttribute("ry",(d.ry*(1+0.4*pop)).toFixed(2));
      d.fill.setAttribute("fill-opacity",(d.w.band.op*ramp*(1+0.8*pop)).toFixed(2));
    });

    /* the transducer, under whichever well is firing */
    if(head>=0&&head<order.length){
      const w=swells[order[head]];
      ring.setAttribute("cx",w.e.x); ring.setAttribute("cy",w.e.y-lift);
      ring.setAttribute("rx",(w.e.rx*1.5).toFixed(1));
      ring.setAttribute("ry",(w.e.ry*1.5).toFixed(1));
      ring.setAttribute("stroke-opacity",".75");
      lamps.forEach((L,i)=>L.setAttribute("fill-opacity",
        ((head+i)%3===0 ? 0.9 : 0.25).toFixed(2)));
    } else { ring.setAttribute("stroke-opacity","0");
             lamps.forEach(L=>L.setAttribute("fill-opacity",".2")); }
  };
  run(0);
  TICKERS.push((dt,now,z)=>{ if(z<0.7) return; run(dt); });
}
DRAW.echodispense = drawEchoDispense;

/* ------------------------------------------------------------------
   ② THE TREATMENT PLATE
   48 wells, dosed and empty. Four vertical bands of twelve replicates.
   No embryos: at this point in the story there are none in it yet.

   MARK_DEFECT brackets the fourth band, where the compound is spelled
   two different ways in two different columns of the deposited object.
   ------------------------------------------------------------------ */
const MARK_DEFECT = true;

function drawTreatmentPlate(g,n){
  const th=n.h, sx=n.w/PLATE_COLS, hw=n.w/2, hd=n.d/2;
  plateSlab(g,n,th,SKIN.anchor,1.6);
  plateWells(n,th).forEach(w=>drawWell(g,w,true));
  if(MARK_DEFECT){
    const x0=n.x-hw+6*sx, x1=n.x-hw+8*sx;
    const b=[[x0+0.02,n.y-hd+0.03],[x1-0.02,n.y-hd+0.03],
             [x1-0.02,n.y+hd-0.03],[x0+0.02,n.y+hd-0.03]];
    g.appendChild(el("polygon",{points:pts(b.map(p=>P(p[0],p[1],th))),
      fill:"none",stroke:"var(--drop)","stroke-width":"1.1","stroke-opacity":".85",
      "stroke-dasharray":"4 3"}));
  }
}
DRAW.treatmentplate = drawTreatmentPlate;

/* ------------------------------------------------------------------
   ARRAY INTO THE DOSED PLATE, AT 24 HPF
   The same 48 wells, already coloured, filling with six embryos each.
   The fish arrive into the dose; nothing is added to them afterwards.

   MARK_MISSING rings a few wells in the discard colour: 48 wells are
   loaded and 43 samples reach the object, and nothing explains the
   difference. Set it to 0 to drop the claim.
   ------------------------------------------------------------------ */
const MARK_MISSING = 5;

function drawArrayPlate(g,n){
  const r=rng(67), th=n.h;
  plateSlab(g,n,th,SKIN.tile,1);
  const wells=plateWells(n,th);

  const missing=new Set();
  while(missing.size<MARK_MISSING) missing.add(Math.floor(r()*wells.length));

  const broods=[];
  wells.forEach((w,idx)=>{
    drawWell(g,w,true);
    if(missing.has(idx))
      g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:w.e.rx*1.5,ry:w.e.ry*1.5,
        fill:"none",stroke:"var(--drop)","stroke-width":"1","stroke-opacity":".8",
        "stroke-dasharray":"2.5 2"}));
    const brood=el("g",{opacity:"0"});
    const kids=[];
    for(let k=0;k<6;k++){
      const a=k*1.047+r()*0.35;
      const c=el("circle",{cx:w.e.x+Math.cos(a)*w.e.rx*0.44,
        cy:w.e.y+Math.sin(a)*w.e.ry*0.44, r:Math.max(.55,w.e.rx*0.17),
        fill:"var(--fg)","fill-opacity":".85"});
      brood.appendChild(c);
      kids.push({c, ax:0.35+r()*0.5, ay:0.25+r()*0.35,
                 r1:0.5+r()*0.8, r2:0.7+r()*1.0, p1:r()*6.283, p2:r()*6.283});
    }
    g.appendChild(brood);
    broods.push({brood,kids,e:w.e,order:w.i*PLATE_ROWS+w.j});
  });
  broods.sort((a,b)=>a.order-b.order);

  /* the tip that carries them in */
  const pip=el("g",{});
  const skin={fill:"var(--t-top)","fill-opacity":".95",stroke:"var(--stroke)",
              "stroke-width":".8","stroke-opacity":".85"};
  const tilt=el("g",{transform:"rotate(-15)"});
  tilt.appendChild(el("path",{d:"M -.8 -1.5 L .8 -1.5 L 2.2 -12 L -2.2 -12 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -2.2 -12 L 2.2 -12 L 1.7 -40 L -1.7 -40 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -3.4 -40 L 3.4 -40 L 2.8 -56 L -2.8 -56 Z", ...skin}));
  pip.appendChild(tilt); g.appendChild(pip);

  /* slowed from the incoming 0.1/1.4: at 0.1 the tip blurred across the
     plate. 0.5 s a well is ~26 s a sweep, which reads as pipetting. */
  const STEP=0.5, HOLD=2.5, ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  let k=0, t=0, resting=0, ct=0;
  const run=(dt)=>{
    /* six live embryos in a well are never still */
    ct+=dt;
    broods.forEach(b=>b.kids.forEach(d=>{
      const x=Math.sin(ct*d.r1+d.p1)+0.5*Math.sin(ct*d.r2*1.6+d.p2);
      const y=Math.cos(ct*d.r2+d.p2)+0.5*Math.cos(ct*d.r1*1.8+d.p1);
      d.c.setAttribute("transform",
        `translate(${(x*d.ax).toFixed(2)},${(y*d.ay).toFixed(2)})`);
    }));
    if(resting>0){
      resting-=dt;
      if(resting<=0){ broods.forEach(b=>b.brood.setAttribute("opacity","0")); k=0; t=0; }
      return;
    }
    t+=dt;
    while(t>STEP && k<broods.length){
      broods[k].brood.setAttribute("opacity","1");
      k++; t-=STEP;
      if(k>=broods.length){ resting=HOLD; return; }
    }
    const cur=broods[Math.min(k,broods.length-1)].e,
          prev=broods[Math.max(0,k-1)].e, f=ease(Math.min(1,t/STEP));
    pip.setAttribute("transform",
      `translate(${prev.x+(cur.x-prev.x)*f},${prev.y+(cur.y-prev.y)*f-6-Math.sin(f*Math.PI)*13})`);
  };
  run(0);
  TICKERS.push((dt,now,z)=>{ if(z<0.7) return; run(dt); });
}
DRAW.arrayplate = drawArrayPlate;


/* ------------------------------------------------------------------
   THE COMPOUNDS · COMPOUND SELECTION
   Three people at a board, arguing about it.

   The board is drawn as a quad in a constant-y plane, so anything written
   on it is placed with P(x, yPlane, z) and lands on the surface correctly.
   The four entries carry the PLATE_BANDS colours, so the same four things
   are recognisable here, on the Echo source plate, and in the wells.

   Most of the board is empty on purpose. The artefact this step leaves
   behind is four values in one column; the reasoning behind them is not
   recorded anywhere, and the picture should not pretend otherwise.

   Requires PLATE_BANDS from the plate set block.
   ------------------------------------------------------------------ */
const MARK_ERASED = true;

/* a person; the arm is returned separately so it can be moved */
function personSprite(x, y, scale, flip){
  const outer=el("g",{transform:`translate(${x},${y}) scale(${scale*(flip?-1:1)},${scale})`});
  outer.appendChild(el("path",{
    d:"M -3.7 0 L 3.7 0 L 2.7 -11 Q 2.7 -12.6 1.2 -12.9 L -1.2 -12.9 Q -2.7 -12.6 -2.7 -11 Z",
    fill:"var(--fg)","fill-opacity":".72"}));
  const arm=el("g",{});
  arm.appendChild(el("path",{d:"M 0 0 L 9.4 -1.4 L 9.7 0.6 L 0 2.0 Z",
    fill:"var(--fg)","fill-opacity":".72"}));
  const armPivot=el("g",{transform:"translate(2.4,-11.6)"});
  armPivot.appendChild(arm);
  outer.appendChild(armPivot);
  outer.appendChild(el("circle",{cx:"0",cy:"-16.4",r:"3.3",
    fill:"var(--fg)","fill-opacity":".8"}));
  return {node:outer, arm};
}

function drawWhiteboard(g,n){
  const bw=n.w*0.72, yP=n.y-n.d/2, z0=0.34, z1=n.h;
  const x0=n.x-bw/2-n.w*0.1, x1=x0+bw;
  const quad=(a,b,c,d)=>pts([a,b,c,d]);

  /* legs */
  [x0+0.12,x1-0.12].forEach(lx=>{
    const a=P(lx,yP,0), b=P(lx,yP,z0+0.04);
    g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      stroke:"var(--stroke)","stroke-width":"1.6","stroke-opacity":".8"}));
  });

  /* the board */
  g.appendChild(el("polygon",{points:quad(P(x0,yP,z1),P(x1,yP,z1),P(x1,yP,z0),P(x0,yP,z0)),
    fill:"var(--bg)","fill-opacity":".6",stroke:"var(--stroke)",
    "stroke-width":"1.4","stroke-opacity":".9"}));

  /* what was considered and dropped, and is recorded nowhere */
  if(MARK_ERASED){
    const r2=rng(131);
    for(let i=0;i<7;i++){
      const sx=x0+0.14+r2()*(bw-0.28), sz=z0+0.1+r2()*(z1-z0-0.2);
      const a=P(sx,yP,sz), b=P(sx+0.1+r2()*0.22,yP,sz+(r2()-0.5)*0.04);
      g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
        stroke:"var(--fg)","stroke-width":"2.6","stroke-opacity":".07",
        "stroke-linecap":"round"}));
    }
  }

  /* four entries, one column, in the colours they keep downstream */
  const rows=PLATE_BANDS.length, top=z1-0.16, step=(top-z0-0.14)/(rows-1);
  for(let i=0;i<rows;i++){
    const z=top-i*step, gx=x0+0.16, c=P(gx,yP,z);
    const hex=[];
    for(let k=0;k<6;k++){
      const a=k*Math.PI/3+Math.PI/6;
      hex.push([c[0]+Math.cos(a)*4.0, c[1]+Math.sin(a)*4.0]);
    }
    g.appendChild(el("polygon",{points:pts(hex),fill:PLATE_BANDS[i].fill,
      "fill-opacity":Math.max(.45,PLATE_BANDS[i].op),stroke:"var(--fg)",
      "stroke-width":".7","stroke-opacity":".6"}));
    const a=P(gx+0.14,yP,z), b=P(gx+0.14+bw*0.5,yP,z);
    g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      stroke:"var(--fg)","stroke-width":"1.8","stroke-opacity":".55",
      "stroke-linecap":"round"}));
  }

  /* three people, back to front, arms moving */
  const r=rng(149), arms=[];
  [{dx:-0.62,dy:0.42,flip:false,ph:0.0},
   {dx: 0.06,dy:0.86,flip:false,ph:2.1},
   {dx: 0.72,dy:0.34,flip:true, ph:4.0}]
    .sort((a,b)=>a.dy-b.dy)
    .forEach(f=>{
      const p=P(n.x+f.dx, n.y+n.d/2*f.dy, 0);
      const {node,arm}=personSprite(p[0],p[1],2.1+r()*0.3,f.flip);
      g.appendChild(node);
      arms.push({arm,ph:f.ph,rate:1.7+r()*1.1,span:46+r()*26});
    });

  /* gesturing, and the screen breathing very slightly */
  let t=0;
  const run=(dt)=>{
    t+=dt;
    arms.forEach(a=>{
      const s=Math.sin(t*a.rate+a.ph)+0.35*Math.sin(t*a.rate*2.3+a.ph*1.7);
      a.arm.setAttribute("transform",`rotate(${(-18+s*a.span).toFixed(1)})`);
    });
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.whiteboard = drawWhiteboard;




/* ------------------------------------------------------------------
   THE LIBRARY
   A wall of compounds, four of which come off the shelf.

   The wall is a constant-y plane, so shelves and spines are placed with
   P(x, yWall, z) and sit flat on it. Molecules travel in +y, toward the
   viewer, gaining opacity and scale as they come forward. Most fade
   before they get far; four make it the whole way, keep their
   PLATE_BANDS colour and pick up a check.

   The skeletal structures are schematic. They are NOT depictions of
   sorafenib, orlistat or dapagliflozin — an approximate structure
   labelled with a real compound name would be worse than a generic one.
   Real skeletons need a proper depiction toolchain.

   Requires PLATE_BANDS from the plate set block.
   ------------------------------------------------------------------ */
function moleculeGlyph(seed, fill){
  const r=rng(seed), g=el("g",{});
  const R=6.5;
  const ring=(cx,cy)=>{
    const pt=[];
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+0.2;
      pt.push([cx+Math.cos(a)*R, cy+Math.sin(a)*R]);
    }
    g.appendChild(el("polygon",{points:pts(pt),fill:"none",stroke:fill,
      "stroke-width":"1.3","stroke-linejoin":"round"}));
    if(r()<0.6){
      const i=Math.floor(r()*6), a=pt[i], b=pt[(i+1)%6];
      const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
      g.appendChild(el("line",{x1:a[0]*0.82+mx*0.18,y1:a[1]*0.82+my*0.18,
        x2:b[0]*0.82+mx*0.18,y2:b[1]*0.82+my*0.18,
        stroke:fill,"stroke-width":"1"}));
    }
    return pt;
  };
  const p1=ring(0,0);
  if(r()<0.65){
    const dx=R*1.72*(r()<0.5?1:-1), dy=(r()-0.5)*R*0.8;
    ring(dx,dy);
    g.appendChild(el("line",{x1:0,y1:0,x2:dx,y2:dy,stroke:fill,"stroke-width":"1.1"}));
  }
  const tails=1+Math.floor(r()*2);
  for(let k=0;k<tails;k++){
    const i=Math.floor(r()*6), a=p1[i];
    const ex=a[0]*1.9+(r()-0.5)*4, ey=a[1]*1.9+(r()-0.5)*4;
    g.appendChild(el("line",{x1:a[0],y1:a[1],x2:ex,y2:ey,stroke:fill,
      "stroke-width":"1.1","stroke-linecap":"round"}));
    g.appendChild(el("circle",{cx:ex,cy:ey,r:1.5,fill:fill}));
  }
  return g;
}

function drawLibrary(g,n){
  const r=rng(307);
  const yW=n.y-n.d*0.46;
  const x0=n.x-n.w*0.46, x1=n.x+n.w*0.46;
  const z0=0.04, z1=n.h;
  const W=(xv,zv)=>P(xv,yW,zv);
  const quad=(a,b,c,d)=>pts([a,b,c,d]);

  g.appendChild(el("polygon",{points:quad(W(x0,z1),W(x1,z1),W(x1,z0),W(x0,z0)),
    fill:"var(--bg)","fill-opacity":".7",stroke:"var(--stroke)",
    "stroke-width":"1.2","stroke-opacity":".8"}));

  const shelves=5, sh=(z1-z0)/shelves;
  for(let s2=0;s2<shelves;s2++){
    const base=z0+s2*sh;
    const a=W(x0,base), b=W(x1,base);
    g.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      stroke:"var(--stroke)","stroke-width":"1.4","stroke-opacity":".75"}));
    let bx=x0+0.03;
    while(bx<x1-0.04){
      const bw=0.022+r()*0.03, bh=sh*(0.55+r()*0.38), lean=r()<0.07;
      const tint=r();
      const fill = tint<0.1 ? PLATE_BANDS[Math.floor(r()*PLATE_BANDS.length)].fill
                            : "var(--fg)";
      const op   = tint<0.1 ? 0.5 : 0.14+r()*0.24;
      const top=base+0.012+bh, bot=base+0.012;
      const sk=lean?0.012:0;
      g.appendChild(el("polygon",{
        points:quad(W(bx+sk,top),W(bx+bw+sk,top),W(bx+bw,bot),W(bx,bot)),
        fill:fill,"fill-opacity":op,stroke:"var(--stroke)",
        "stroke-width":".5","stroke-opacity":".45"}));
      bx+=bw+0.006+r()*0.008;
    }
  }

  /* they come a long way off the wall: the far end is what sells "picked" */
  const yFar=n.y+n.d*1.04, span=yFar-yW;
  const picks=[];
  for(let i=0;i<26;i++){
    const chosen=i<PLATE_BANDS.length;
    const fill=chosen?PLATE_BANDS[i].fill:"var(--fg)";
    const node=el("g",{opacity:"0"});
    const mol=el("g",{});
    mol.appendChild(moleculeGlyph(311+i*13, fill));
    node.appendChild(mol);
    const tick=el("polyline",{points:"-4,0 -1,3.4 5,-4.2",fill:"none",
      stroke:"var(--ok, #5aa46b)","stroke-width":"2.2","stroke-linecap":"round",
      "stroke-linejoin":"round",opacity:"0",transform:"translate(11,-9)"});
    node.appendChild(tick);
    g.appendChild(node);
    picks.push({node,tick,chosen,
      x:(r()-0.5)*n.w*0.8, z:z0+0.12+r()*(z1-z0-0.24),
      drop:(r()-0.4)*0.35,
      reach: chosen ? 1 : 0.55+r()*0.4,
      speed: chosen ? 0.13+r()*0.035 : 0.22+r()*0.2,
      scale: 0.55+r()*0.25, spin:(r()-0.5)*26, p:r()});
  }

  const run=(dt)=>{
    picks.forEach(m=>{
      m.p+=m.speed*dt;
      if(m.p>=1) m.p-=1;
      const e=m.p*m.reach;
      const p=P(n.x+m.x, yW+span*e, m.z+m.drop*e);
      const near=e/Math.max(0.001,m.reach);
      const grow=m.scale*(0.72+0.6*e);
      let op;
      if(m.chosen) op=Math.min(1,e/0.62)*(near>0.94?Math.max(0,(1-near)/0.06):1);
      else op=Math.min(0.55,e/0.3)*Math.max(0,1-Math.max(0,(near-0.55)/0.45));
      m.node.setAttribute("opacity",op.toFixed(2));
      m.node.setAttribute("transform",
        `translate(${p[0]},${p[1]}) rotate(${(m.spin*e).toFixed(1)}) scale(${grow.toFixed(3)})`);
      m.tick.setAttribute("opacity",
        (m.chosen && near>0.72 ? Math.min(1,(near-0.72)/0.12) : 0).toFixed(2));
    });
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.library = drawLibrary;


/* ------------------------------------------------------------------
   INCUBATE TO 48 HPF
   One dosed well, twenty-four hours in, with nobody watching.

   APPLY BEFORE DISSOCIATE. That node uses larvaSix(), larvaSwim(),
   larvaPut() and larvaBeat() from here and does not redefine them, and
   it seeds larvaSix() with the same 401, so the two wells are literally
   identical at rest. Their nodes must also carry the same w and d or the
   match breaks.

   larvaSix() lays out six larvae from one seed, each on its own slow
   orbit of the well; larvaSwim() moves a fish along that orbit and turns
   it to face where it is going; larvaPut() maps body coordinates — t
   along the spine, u across it — to grid coordinates with a travelling
   sine whose amplitude grows toward the tail, which is how a fish
   actually swims. Orbits differ in radius, direction and speed, so the
   six drift apart and past each other instead of holding formation; the
   ow term in larvaSix sets that pace.

   WHAT THIS DELIBERATELY DOES NOT CLAIM. The molecules drift on their own
   paths and are not attached to the animals. Internal exposure was never
   measured, and the arraying step makes the same point by leaving its
   embryos untinted. Do not brighten the molecules that happen to overlap
   a body — that would assert absorption the experiment did not record,
   and the two nodes have to stay consistent.

   Requires moleculeGlyph() from the library block, PLATE_BANDS from the
   plate set, and ellipseAt() from the clutch block.
   ------------------------------------------------------------------ */
function larvaSix(n, seed){
  const r=rng(seed), wellR=Math.min(n.w*0.5, n.d*0.62), out=[];
  for(let i=0;i<6;i++){
    const L=n.w*0.3*(0.85+r()*0.3);
    out.push({L,
      orb: wellR*(0.3+0.48*((i+r()*0.8)/6)),      // spread across the well
      oph: (i/6)*6.283+r()*0.6,
      ow : (0.055+r()*0.06)*(r()<0.5?-1:1),        // slow, either way round
      bob: 0.05+r()*0.05,
      rate:1.8+r()*1.4, ph:r()*6.283,
      w0:L*0.2, amp:L*0.13, cx:n.x, cy:n.y, head:0});
  }
  return out;
}
/* one slow lap of the well; the body is turned to face where it is going */
function larvaSwim(f, n, T){
  const th=f.oph+T*f.ow;
  const rad=f.orb*(1+f.bob*Math.sin(T*0.23+f.oph));
  f.cx=n.x+Math.cos(th)*rad;
  f.cy=n.y+Math.sin(th)*rad*0.72;
  f.head=th+Math.sign(f.ow)*Math.PI/2-Math.PI;
}
/* body coordinates -> grid coordinates. t runs head to tail, u across. */
function larvaPut(f,t,u,beat){
  const ca=Math.cos(f.head), sa=Math.sin(f.head);
  const bend=(0.05+0.95*Math.pow(t,1.7))*f.amp*Math.sin(t*7-beat);
  const hw = t<0.2 ? f.w0*0.85 : Math.max(f.L*0.012, f.w0*Math.pow(1-t,0.8));
  const lx=(t-0.5)*f.L, ly=bend+u*hw;
  return [f.cx+lx*ca-ly*sa, f.cy+(lx*sa+ly*ca)*0.72];
}
const larvaBeat=(f,T)=>T*f.rate*2.4+f.ph;

function drawIncubate(g,n){
  const r=rng(9001);
  const band=PLATE_BANDS[(n.band!==undefined?n.band:1)];
  const wellR=Math.min(n.w*0.5, n.d*0.62);

  const vessel=ellipseAt(n.x,n.y,0,wellR);
  g.appendChild(el("ellipse",{cx:vessel.x,cy:vessel.y,rx:vessel.rx,ry:vessel.ry,
    fill:"var(--water, var(--signal))","fill-opacity":".08",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".35"}));

  const fish=larvaSix(n,401).map(f=>{
    const body=el("polygon",{fill:"var(--fg)","fill-opacity":".4",
      stroke:"var(--fg)","stroke-width":".7","stroke-opacity":".7"});
    const yolk=el("ellipse",{rx:(f.L*0.09*S*C30*1.4).toFixed(1),
      ry:(f.L*0.09*S*0.5*1.4).toFixed(1),fill:"var(--fg)","fill-opacity":".28"});
    const eye=el("circle",{r:(f.L*0.055*S*0.9).toFixed(1),fill:"var(--fg)","fill-opacity":".95"});
    g.appendChild(body); g.appendChild(yolk); g.appendChild(eye);
    return {...f, body, yolk, eye};
  });

  const M=9, mols=[];
  for(let i=0;i<M;i++){
    const a=(i/M)*6.283+r()*0.45, rad=(0.32+0.55*((i%3)/2))*wellR;
    const node=el("g",{opacity:".78"});
    node.appendChild(moleculeGlyph(409+i*23, band.fill));
    g.appendChild(node);
    mols.push({node, cx:n.x+Math.cos(a)*rad, cy:n.y+Math.sin(a)*rad*0.72,
      ph:r()*6.283, rate:0.32+r()*0.3, span:0.05+r()*0.05,
      sc:0.34+r()*0.1, spin:(r()-0.5)*26});
  }

  const N=30;
  const run=(dt,now)=>{
    const T=now/1000;
    fish.forEach(f=>{
      larvaSwim(f,n,T);
      const beat=larvaBeat(f,T);
      const up=[], dn=[];
      for(let i=0;i<=N;i++){
        const t=i/N;
        const a=larvaPut(f,t, 1,beat), b=larvaPut(f,t,-1,beat);
        up.push(P(a[0],a[1],0.02)); dn.push(P(b[0],b[1],0.02));
      }
      f.body.setAttribute("points",pts([...up,...dn.reverse()]));
      const y=larvaPut(f,0.22,0.45,beat), yp=P(y[0],y[1],0.02);
      f.yolk.setAttribute("cx",yp[0]); f.yolk.setAttribute("cy",yp[1]);
      const e2=larvaPut(f,0.09,-0.4,beat), ep=P(e2[0],e2[1],0.02);
      f.eye.setAttribute("cx",ep[0]); f.eye.setAttribute("cy",ep[1]);
    });
    mols.forEach(m=>{
      const p=P(m.cx+Math.sin(T*m.rate+m.ph)*m.span,
                m.cy+Math.cos(T*m.rate*0.83+m.ph)*m.span*0.7, 0.02);
      m.node.setAttribute("transform",
        `translate(${p[0]},${p[1]}) rotate(${(Math.sin(T*0.5+m.ph)*m.spin).toFixed(1)}) scale(${m.sc})`);
    });
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
}
DRAW.incubate = drawIncubate;


/* ------------------------------------------------------------------
   DISSOCIATE
   The same well, one step later, coming apart.

   REQUIRES the incubate block above for larvaSix(), larvaSwim(),
   larvaPut() and larvaBeat(). Same seed, same w and d, so at rest this
   node is the incubation well minus the compound — identical bodies in
   identical poses. Digestion crossfades the bodies out and a cloud of
   dots in; the dots sit in body coordinates, so they start exactly inside
   the silhouette they came from.

   Dispersal is radial. Each dot travels outward from the centre of the
   well along its own bearing, and its final radius is drawn
   area-uniformly with a bias toward where it started — so a dot near the
   middle stays near the middle, one near the edge ends up further out,
   and the cloud covers the dish evenly instead of crossing over itself.

   The larvae swim their orbits until digestion starts; at that instant
   both the tail beat and the orbit freeze. Nothing moves after that
   except a small Brownian jitter in the cloud. If the tail wave or the
   drift reappears in the dispersed cells, the freeze has been lost.

   TWO THINGS TO PRESERVE. The eye dots let go last — pigmented retina is
   the toughest structure in the larva, and that asymmetry is the
   condition: cell types survive digestion unequally, so atlas composition
   is partly a report on how tough each tissue is. And a few clumps never
   disperse; they move about a sixth of the way and stop.

   Ordering, confirmed against Parse's protocol: Evercode fixation begins
   with a single cell suspension, so dissociation is the enzymatic
   digestion and it comes FIRST. Fixation is the landmark downstream.
   ------------------------------------------------------------------ */
function drawDissociate(g,n){
  const r=rng(211);
  const wellR=Math.min(n.w*0.5, n.d*0.62);

  const vessel=ellipseAt(n.x,n.y,0,wellR);
  g.appendChild(el("ellipse",{cx:vessel.x,cy:vessel.y,rx:vessel.rx,ry:vessel.ry,
    fill:"var(--fg)","fill-opacity":".03",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".3"}));

  const fish=larvaSix(n,401).map(f=>{
    const body=el("polygon",{fill:"var(--fg)","fill-opacity":".4",
      stroke:"var(--fg)","stroke-width":".7","stroke-opacity":".7"});
    const yolk=el("ellipse",{rx:(f.L*0.09*S*C30*1.4).toFixed(1),
      ry:(f.L*0.09*S*0.5*1.4).toFixed(1),fill:"var(--fg)","fill-opacity":".28"});
    const eye=el("circle",{r:(f.L*0.055*S*0.9).toFixed(1),fill:"var(--fg)","fill-opacity":".95"});
    g.appendChild(body); g.appendChild(yolk); g.appendChild(eye);
    const o={...f, body, yolk, eye, frozen:0};
    larvaSwim(o,n,0);
    return o;
  });

  const dots=[];
  fish.forEach(f=>{
    const add=(t,u,size,delay,op)=>{
      const home=larvaPut(f,t,u,0);
      const dx=home[0]-n.x, dy=(home[1]-n.y)/0.72;
      const ang=Math.atan2(dy,dx), hr=Math.min(1,Math.hypot(dx,dy)/wellR);
      const q=Math.min(1, hr*0.4 + 0.6*r());
      const R2=wellR*1.04*Math.sqrt(q);
      const a2=ang+(r()-0.5)*1.05;
      const node=el("circle",{r:size,fill:"var(--fg)","fill-opacity":op,opacity:"0"});
      g.appendChild(node);
      dots.push({node,f,t,u,delay,stuck:false,
        ax:n.x+Math.cos(a2)*R2, ay:n.y+Math.sin(a2)*R2*0.72,
        jr:0.024+r()*0.03, jp:r()*6.283, js:1.7+r()*2.4});
    };
    for(let k=0;k<76;k++) add(Math.pow(r(),0.8), r()*2-1, 0.27+r()*0.16, r()*0.42, 0.42+r()*0.5);
    for(let k=0;k<18;k++) add(0.18+r()*0.1, 0.2+r()*0.7, 0.3+r()*0.15, 0.1+r()*0.18, 0.45+r()*0.4);
    for(let k=0;k<16;k++) add(0.07+r()*0.05, -0.55+r()*0.35, 0.3+r()*0.13, 0.6+r()*0.14, 0.75+r()*0.25);
    for(let k=0;k<6;k++){ add(0.3+r()*0.45, r()*2-1, 0.32+r()*0.13, 0, 0.45+r()*0.35);
                          dots[dots.length-1].stuck=true; }
  });

  const HOLD=2.2, GO=2.0, CLOUD=1.7, BACK=2.2;
  const CYCLE=HOLD+GO+CLOUD+BACK;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  let t=0, live=true;

  const run=(dt,now)=>{
    t=(t+dt)%CYCLE;
    const T=now/1000, intact=t<HOLD;

    if(intact!==live){
      live=intact;
      if(!intact) fish.forEach(f=>f.frozen=larvaBeat(f,T));
    }
    /* they swim until digestion starts, then everything about the pose holds */
    fish.forEach(f=>{
      if(intact) larvaSwim(f,n,T);
      f.beat = intact ? larvaBeat(f,T) : f.frozen;
    });

    const solid = t<HOLD ? 1
      : t<HOLD+GO ? Math.max(0,1-(t-HOLD)/(GO*0.3))
      : t<HOLD+GO+CLOUD ? 0
      : Math.min(1,Math.max(0,(t-HOLD-GO-CLOUD-BACK*0.6)/(BACK*0.4)));

    const N=30;
    fish.forEach(f=>{
      f.body.setAttribute("opacity",solid.toFixed(2));
      f.yolk.setAttribute("opacity",solid.toFixed(2));
      f.eye.setAttribute("opacity",solid.toFixed(2));
      if(solid<=0.01) return;
      const up=[], dn=[];
      for(let i=0;i<=N;i++){
        const tt=i/N;
        const a=larvaPut(f,tt, 1,f.beat), b=larvaPut(f,tt,-1,f.beat);
        up.push(P(a[0],a[1],0.02)); dn.push(P(b[0],b[1],0.02));
      }
      f.body.setAttribute("points",pts([...up,...dn.reverse()]));
      const y=larvaPut(f,0.22,0.45,f.beat), yp=P(y[0],y[1],0.02);
      f.yolk.setAttribute("cx",yp[0]); f.yolk.setAttribute("cy",yp[1]);
      const e2=larvaPut(f,0.09,-0.4,f.beat), ep=P(e2[0],e2[1],0.02);
      f.eye.setAttribute("cx",ep[0]); f.eye.setAttribute("cy",ep[1]);
    });

    dots.forEach(d=>{
      let e;
      if(t<HOLD) e=0;
      else if(t<HOLD+GO)       e=ease(Math.max(0,Math.min(1,(t-HOLD-d.delay*0.5)/(GO*0.68))));
      else if(t<HOLD+GO+CLOUD) e=1;
      else e=1-ease(Math.max(0,Math.min(1,(t-HOLD-GO-CLOUD-d.delay*0.25)/(BACK*0.62))));
      if(d.stuck) e*=0.16;
      const home=larvaPut(d.f,d.t,d.u,d.f.beat);
      /* Brownian jitter, and it is the point: once they are loose they never
         stop moving until something fixes them */
      const jx=e*d.jr*(Math.sin(T*d.js+d.jp)+0.6*Math.sin(T*d.js*2.7+d.jp*1.3));
      const jy=e*d.jr*(Math.cos(T*d.js*0.9+d.jp)+0.6*Math.cos(T*d.js*2.3+d.jp*0.7));
      const p=P(home[0]+(d.ax-home[0])*e+jx, home[1]+(d.ay-home[1])*e+jy, 0.02);
      d.node.setAttribute("cx",p[0].toFixed(2));
      d.node.setAttribute("cy",p[1].toFixed(2));
      d.node.setAttribute("opacity",(1-solid).toFixed(2));
    });
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
}
DRAW.dissociate = drawDissociate;


/* ------------------------------------------------------------------
   FIXATION
   The same well as dissociation, at its last moment, and then it stops.

   This is the dissociated cloud — loose cells jittering hard, because
   that is what a fresh suspension does — under a pipette that comes down,
   releases fixative, and ends it. The jitter decays to nothing over about
   a second and every cell picks up an outline: the same "fixed" reading
   the plate uses one step later.

   The stillness is the content. Everything upstream of here is a live
   thing changing while you watch it; everything downstream is a
   measurement of something that has stopped. This is the boundary.

   Requires ellipseAt() from the clutch block.
   ------------------------------------------------------------------ */
function drawFixation(g,n){
  const r=rng(613);
  const wellR=Math.min(n.w*0.5, n.d*0.62);

  const vessel=ellipseAt(n.x,n.y,0,wellR);
  g.appendChild(el("ellipse",{cx:vessel.x,cy:vessel.y,rx:vessel.rx,ry:vessel.ry,
    fill:"var(--fg)","fill-opacity":".03",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".3"}));

  /* the suspension, spread area-uniformly across the dish */
  const cells=[];
  for(let i=0;i<420;i++){
    const a=r()*6.283, rad=Math.sqrt(r())*wellR*1.02;
    const home=P(n.x+Math.cos(a)*rad, n.y+Math.sin(a)*rad*0.72, 0.02);
    const node=el("circle",{cx:home[0],cy:home[1],r:(0.28+r()*0.16).toFixed(2),
      fill:"var(--fg)","fill-opacity":(0.42+r()*0.45).toFixed(2)});
    g.appendChild(node);
    cells.push({node,hx:home[0],hy:home[1],
      jr:1.5+r()*2.2, jp:r()*6.283, js:1.7+r()*2.4});
  }

  /* the pipette, and the drop it lets go of */
  const pip=el("g",{});
  const skin={fill:"var(--t-top)","fill-opacity":".95",stroke:"var(--stroke)",
              "stroke-width":".8","stroke-opacity":".85"};
  const tilt=el("g",{transform:"rotate(-15)"});
  tilt.appendChild(el("path",{d:"M -.8 -1.5 L .8 -1.5 L 2.2 -12 L -2.2 -12 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -2.2 -12 L 2.2 -12 L 1.7 -40 L -1.7 -40 Z", ...skin}));
  tilt.appendChild(el("path",{d:"M -3.4 -40 L 3.4 -40 L 2.8 -56 L -2.8 -56 Z", ...skin}));
  pip.appendChild(tilt); g.appendChild(pip);
  const centre=P(n.x,n.y,0.02);
  const drop=el("circle",{r:"2.6",fill:"var(--c-top)","fill-opacity":"0"});
  g.appendChild(drop);
  /* the fixative spreading out from where it landed */
  const wash=el("ellipse",{cx:centre[0],cy:centre[1],rx:"0",ry:"0",
    fill:"none",stroke:"var(--c-top)","stroke-width":"1.4","stroke-opacity":"0"});
  g.appendChild(wash);

  const IN=1.6, FALL=0.6, SET=1.1, STILL=2.4, OUT=0.9;
  const CYCLE=IN+FALL+SET+STILL+OUT;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  /* HIGH is where the tip enters from, LOW where it stops — it never comes
     down onto the cells, it stands off and lets go. TIP is the mouth of the
     dropper at rest, which is where the drop has to be born. */
  const HIGH=76, LOW=27, TIP=LOW+1.5;
  let t=0;
  const run=(dt,now)=>{
    t=(t+dt)%CYCLE;
    const T=now/1000;

    /* how alive the suspension still is: 1 before the drop lands, 0 after */
    let live=1, dq=0;
    if(t<IN) live=1;
    else if(t<IN+FALL) live=1;
    else if(t<IN+FALL+SET){ const f=(t-IN-FALL)/SET; live=1-ease(f); dq=ease(f); }
    else if(t<IN+FALL+SET+STILL){ live=0; dq=1; }
    else { const f=(t-IN-FALL-SET-STILL)/OUT; live=ease(f); dq=1-ease(f); }

    cells.forEach(c=>{
      const jx=live*c.jr*(Math.sin(T*c.js+c.jp)+0.6*Math.sin(T*c.js*2.7+c.jp*1.3));
      const jy=live*c.jr*(Math.cos(T*c.js*0.9+c.jp)+0.6*Math.cos(T*c.js*2.3+c.jp*0.7));
      c.node.setAttribute("cx",(c.hx+jx).toFixed(2));
      c.node.setAttribute("cy",(c.hy+jy*0.72).toFixed(2));
      c.node.setAttribute("stroke", dq>0.05 ? "var(--fg)" : "none");
      c.node.setAttribute("stroke-width",".45");
      c.node.setAttribute("stroke-opacity",(dq*0.85).toFixed(2));
    });

    /* the tip comes down, lets go, and lifts away */
    let lift=HIGH, dropOp=0, dropY=0;
    if(t<IN) lift=HIGH*(1-ease(t/IN));
    else if(t<IN+FALL){
      const f=(t-IN)/FALL;
      lift=0; dropOp=f<0.9?0.9:0; dropY=f*f*TIP;   // leaves the mouth, accelerates in
    } else if(t<IN+FALL+SET+STILL) lift=0;
    else lift=HIGH*ease((t-IN-FALL-SET-STILL)/OUT);
    pip.setAttribute("transform",`translate(${centre[0]},${centre[1]-lift-LOW})`);
    pip.setAttribute("opacity",(1-0.9*(lift/HIGH)).toFixed(2));
    drop.setAttribute("cx",centre[0]);
    drop.setAttribute("cy",(centre[1]-TIP+dropY).toFixed(1));
    drop.setAttribute("fill-opacity",dropOp.toFixed(2));

    const wr = dq<1 ? dq : Math.max(0,1-(t-IN-FALL-SET)/STILL);
    wash.setAttribute("rx",(vessel.rx*Math.min(1,dq*1.3)).toFixed(1));
    wash.setAttribute("ry",(vessel.ry*Math.min(1,dq*1.3)).toFixed(1));
    wash.setAttribute("stroke-opacity",(dq<1?0.5*dq:Math.max(0,0.5*wr)).toFixed(2));
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
}
DRAW.fixation = drawFixation;
