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


/* How far a pyramid rises above its own tile, as a fraction of its width. It
   lives up here rather than inside the shape because topOf() has to agree with
   the drawing: the silhouette punched out for the occlusion clip is also the
   click target, so a solid that stands taller than its silhouette is a solid
   you cannot pick up by its own body. */
const PYRAMID_RISE=0.58;

/* the height a structure actually reaches, for anything drawn on top of it */
const topOf = n => n.shape==="works"   ? n.h*0.96
                 : n.shape==="tankrack"? 1.4
                 : n.shape==="machine" ? 1.42
                 : n.shape==="pyramid" ? n.h+n.w*PYRAMID_RISE
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

  /* ---- THE RIME, and it is the thaw's only moving part -----------------
     Only `thaw:true` grows it. What comes out of the freezer is fixed,
     cross-linked, cryopreserved material: nothing biological happens in this
     step, so nothing biological may be seen to move in it. The one thing on
     the object that is allowed to change is the ice, and it changes by
     LEAVING — the crystals clear from the rim inward as the plastic warms,
     which is the picture of preserved material coming back to temperature
     rather than of a process starting.

     The crystals are scattered rather than laid one per well because rime
     forms on the plate, not in the chemistry, and a crystal per well would
     read as something happening in the wells. Their arms are built in world
     space and projected, so they lie flat on the top face and foreshorten
     with it instead of being a screen-space star pasted on the plate. */
  const frost=el("g",{}), rime=[];
  let sheet=null;
  if(n.thaw){
    const hw=plate.w/2, hd=plate.d/2;
    const cw=Math.min(plate.w/PLATE_COLS, plate.d/PLATE_ROWS);
    sheet=el("polygon",{points:faces(plate.x,plate.y,plate.w-0.06,plate.d-0.06,th).top,
      fill:"var(--c-top)","fill-opacity":".3",stroke:"none"});
    frost.appendChild(sheet);
    for(let i=0;i<groups.length;i++){
      const u=(r()*1.84-0.92)*hw, v=(r()*1.84-0.92)*hd, R=cw*(0.2+r()*0.24);
      let d="";
      for(let a=0;a<3;a++){
        const ang=a*Math.PI/3+r()*0.35;
        const p0=P(plate.x+u-Math.cos(ang)*R, plate.y+v-Math.sin(ang)*R, th);
        const p1=P(plate.x+u+Math.cos(ang)*R, plate.y+v+Math.sin(ang)*R, th);
        d+=`M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} L ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `;
      }
      const node=el("path",{d:d,fill:"none",stroke:"var(--c-top)","stroke-width":"1.1",
        "stroke-opacity":".85","stroke-linecap":"round"});
      frost.appendChild(node);
      rime.push({node, far:Math.hypot(u/hw, v/hd)});
    }
    rime.sort((a,b)=>b.far-a.far);   // outermost first: an edge warms first
    cart.appendChild(frost);
    /* the sample is inert for the whole step, so it is styled frozen once
       here and the ticker never touches it again */
    groups.forEach(grp=>grp.cells.forEach(c=>{
      c.node.setAttribute("fill-opacity",".28");
      c.node.setAttribute("stroke","var(--fg)");
      c.node.setAttribute("stroke-width",".55");
      c.node.setAttribute("stroke-opacity",".9");
    }));
  }

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

  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- TWO SCHEDULES OVER ONE SET OF PARTS ----------------------------
     Everything above draws a freezer, a plate, cells in its wells, a door and
     a pipette. What makes this object FIXING or THAWING is only the order
     those move in, so the geometry is built once and the timeline is chosen
     here rather than the shape being written twice.

     FIXING (the default, and the last step of the biology row): the tip works
     across the wells, each settling as it is fixed; the plate then shrinks
     into the freezer and the door shuts on it.

     THAWING (`thaw:true`, the first step of the chemistry row): the reverse —
     and NOT the same animation run backwards, which is the tempting version
     and the wrong one: a reversed tip is un-pipetting, and nothing is being
     added to a thaw. The door opens, the plate comes out and grows, and the
     frost on it recedes. The material inside does not move at all, which is
     the honest reading of the step: it is cross-linked and it is coming back
     to a working temperature, not coming back to life. */
  const STEP=0.5;                 // same pace as the tip on the arraying step
  const FILL=groups.length*STEP;
  const SETTLE=0.6, SHRINK=1.8, CLOSE=0.9, HOLD=1.6, OPEN=0.7;
  const RIME_STEP=0.34, RIME=groups.length*RIME_STEP;
  const CYCLE = n.thaw ? (HOLD+OPEN+SHRINK+RIME+SETTLE+CLOSE)
                       : (FILL+SETTLE+SHRINK+CLOSE+HOLD+OPEN);

  let t=0, stowed=null;
  const run=(dt)=>{
    t=(t+dt)%CYCLE;
    if(n.thaw) return runThaw();
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

  /* THE THAW. Phases, in order: the plate sits in the shut freezer; the door
     opens; the plate slides out and grows; the frost on it recedes crystal by
     crystal from the rim inward; a beat; and the door shuts again on an empty
     freezer, which is the loop closing rather than anything happening. */
  function runThaw(){
    const tOpen=HOLD, tOut=tOpen+OPEN, tWarm=tOut+SHRINK, tRest=tWarm+RIME;
    let dq;
    if(t<tOpen) dq=1;
    else if(t<tOut) dq=1-ease((t-tOpen)/OPEN);
    else if(t<tRest+SETTLE) dq=0;
    else dq=ease((t-tRest-SETTLE)/CLOSE);
    let e;
    if(t<tOut) e=1;
    else if(t<tWarm) e=1-ease((t-tOut)/SHRINK);
    else e=0;
    /* in front of the shell once it has left, behind it while it is inside */
    const inFreezer = t<tWarm;
    if(inFreezer!==stowed){
      stowed=inFreezer;
      if(inFreezer) g.insertBefore(cart, shellG); else g.appendChild(cart);
    }
    /* the ice, and nothing else. It holds while the plate is still cold and
       still inside, then clears crystal by crystal once the plate is out; the
       glaze thins across the whole window so the plastic looks wet before it
       looks dry. The cells were styled frozen at build and stay that way. */
    const gone = t<tWarm ? 0 : (t-tWarm)/RIME_STEP;
    rime.forEach((c,i)=>
      c.node.setAttribute("stroke-opacity",(0.85*(1-Math.max(0,Math.min(1,gone-i)))).toFixed(2)));
    if(sheet) sheet.setAttribute("fill-opacity",
      (0.3*(t<tWarm?1:Math.max(0,1-(t-tWarm)/RIME))).toFixed(2));
    pip.setAttribute("opacity","0");        /* nothing is being added */

    const SC_END=Math.max(0.12,((dx1-dx0)*0.5)/plate.w);
    const sc=1-(1-SC_END)*e;
    const aimX=pc[0]+(inside[0]-pc[0])*e, aimY=pc[1]+(inside[1]-pc[1])*e;
    cart.setAttribute("transform",
      `translate(${(aimX-pc[0]*sc).toFixed(2)},${(aimY-pc[1]*sc).toFixed(2)}) scale(${sc.toFixed(3)})`);

    const edge=dx0+(dx1-dx0)*dq;
    door.setAttribute("points",pts([D(dx0,dz1),D(edge,dz1),D(edge,dz0),D(dx0,dz0)]));
    door.setAttribute("fill-opacity",(0.85*Math.min(1,dq*4)).toFixed(2));
    flake.setAttribute("opacity",(dq>0.75?(dq-0.75)/0.25:0).toFixed(2));
    handle.setAttribute("stroke-opacity",(dq>0.85?0.9:0).toFixed(2));
  }

  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
/* ------------------------------------------------------------------
   THE SEQUENCER
   A chassis with the deck of a liquid handler on it, because that is what
   sequencing by synthesis is: a fluidics robot that flows one base in,
   photographs the flow cell, washes it off and does it again. One turn of
   the animation is four such cycles — the gantry fetches a different
   reagent each time and the clusters image in that reagent's colour, which
   is the four-colour chemistry and the only reason there are four bottles.

   Every level, tint and lamp here is a pure function of t modulo four
   cycles, so nothing accumulates. That matters more than it sounds: this
   ticker runs for as long as the page is open, and a drifting reagent
   level would end up either empty or through the roof.

   paint() builds a box from the floor up and everything on a machine sits
   on the deck, so the boxes go through prism(), which is the same three
   faces lifted to an arbitrary z. The moving parts are built once at their
   home position and then translated: the gantry only ever travels one axis
   at a time, so a screen-space translate is exact, not an approximation.
   ------------------------------------------------------------------ */
function drawMachine(g,n){
  const r=rng(907);
  const X=f=>n.x+f*n.w, Y=f=>n.y+f*n.d, deck=n.h;
  /* topOf() promises a machine reaches 1.42 and both the label anchor and
     the occlusion clip believe it, so the tower is sized to land there */
  const towerH=Math.max(0.24,1.42-deck);
  /* the four reagents, in the order the run calls for them */
  const BASE=["var(--signal)","var(--drop)","var(--ok)","var(--c-top)"];

  const boxAt=(x,y,w,d,z0,z1)=>{
    const hw=w/2,hd=d/2;
    return {top:pts([P(x-hw,y-hd,z1),P(x+hw,y-hd,z1),P(x+hw,y+hd,z1),P(x-hw,y+hd,z1)]),
            right:pts([P(x+hw,y-hd,z1),P(x+hw,y+hd,z1),P(x+hw,y+hd,z0),P(x+hw,y-hd,z0)]),
            left:pts([P(x-hw,y+hd,z1),P(x+hw,y+hd,z1),P(x+hw,y+hd,z0),P(x-hw,y+hd,z0)])};
  };
  const prism=(gg,x,y,w,d,z0,z1,s)=>{
    const b=boxAt(x,y,w,d,z0,z1);
    ["left","right","top"].forEach(k=>gg.appendChild(el("polygon",{points:b[k],fill:s[k],
      "fill-opacity":s.fo||1,stroke:"var(--stroke)","stroke-width":s.sw||1,"stroke-opacity":s.so||1})));
    return b;
  };
  /* appendChild is not obliged to hand the node back and the structural
     validator's DOM stub does not, so every reference kept here goes through
     this rather than through the return value */
  const add=(gg,e)=>{ gg.appendChild(e); return e; };
  const DX=dx=>`translate(${(dx*S*C30).toFixed(2)},${(dx*S*0.5).toFixed(2)})`;
  const DY=dy=>`translate(${(-dy*S*C30).toFixed(2)},${(dy*S*0.5).toFixed(2)})`;
  const DZ=dz=>`translate(0,${(-dz*S*CZ).toFixed(2)})`;

  /* ---- chassis, and the lit vent along its front ---- */
  paint(g,n.x,n.y,n.w,n.d,deck,SKIN.works);
  const vent=add(g,el("polygon",
    {points:faces(X(0.23),n.y+n.d/2,n.w*0.32,0.02,deck*0.5).left,
     fill:"var(--signal)","fill-opacity":".7",stroke:"var(--stroke)","stroke-width":"1"}));

  /* ---- optics tower, back left, carrying the run readout and the lamp ---- */
  const tx=X(-0.205), ty=Y(-0.143), tw=n.w*0.455, td=n.d*0.5, tz=deck+towerH;
  prism(g,tx,ty,tw,td,deck,tz,SKIN.monolith);
  /* the readout lives a hair proud of the tower's front face, so it can never
     be swallowed by the face it is painted on */
  const fy0=ty+td/2+0.002;
  const quad=(x0,x1,z0,z1)=>pts([P(x0,fy0,z1),P(x1,fy0,z1),P(x1,fy0,z0),P(x0,fy0,z0)]);
  const qx0=tx-tw*0.34, qx1=tx+tw*0.36, qz0=deck+towerH*0.36, qz1=deck+towerH*0.68;
  g.appendChild(el("polygon",{points:quad(qx0,qx1,qz0,qz1),fill:"var(--bg)","fill-opacity":".8",
    stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
  const bx0=qx0+(qx1-qx0)*0.08, bx1=qx1-(qx1-qx0)*0.08;
  const bz0=qz0+(qz1-qz0)*0.22, bz1=qz1-(qz1-qz0)*0.22;
  g.appendChild(el("polygon",{points:quad(bx0,bx1,bz0,bz1),fill:"var(--fg)","fill-opacity":".12"}));
  const bar=add(g,el("polygon",{points:quad(bx0,bx0,bz0,bz1),fill:"var(--signal)",
    "fill-opacity":".75"}));
  /* the lamp's glow is a gradient rather than a flat disc, because a flat disc
     at this size reads as a second, larger lamp. installDefs() lives in the
     projection and is called once per <svg>, so this one carries its own — a
     gradient is legal wherever it is declared, and the id is uniqued the same
     way the tank clip paths are. */
  const lp=P(tx+tw*0.31,ty+td*0.26,tz), gid=`lamp${++UID}`;
  const grad=el("radialGradient",{id:gid});
  const stops=[["0%",".9"],["55%",".35"],["100%","0"]].map(([o,a])=>{
    const s=el("stop",{offset:o,"stop-color":"var(--signal)","stop-opacity":a});
    grad.appendChild(s); return s;
  });
  g.appendChild(grad);
  const halo=add(g,el("circle",{cx:lp[0].toFixed(1),cy:lp[1].toFixed(1),r:"4",
    fill:`url(#${gid})`,"fill-opacity":".05"}));
  const lamp=add(g,el("circle",{cx:lp[0].toFixed(1),cy:lp[1].toFixed(1),r:"2.3",
    fill:"var(--signal)","fill-opacity":".3",stroke:"var(--stroke)","stroke-width":".6",
    "stroke-opacity":".6"}));

  /* ---- reagent bay, back right: four bottles with a level that can move ----
     Open-necked on purpose: there is 0.42 of headroom under the height topOf()
     promises, the bridge and the tip have to pass over this row inside it, and
     a cap is the one thing here the tip would have to go through. */
  const bay=[], bw=n.w*0.075, bd=n.d*0.11, bh=0.20;
  for(let i=0;i<4;i++){
    const bx=X(0.075+i*0.113), by=Y(-0.30);
    prism(g,bx,by,bw,bd,deck,deck+bh,SKIN.glass);
    /* the liquid is drawn after the glass and carries no stroke, so it reads
       as being seen through the bottle rather than painted on it */
    const liq=["left","right","top"].map(()=>add(g,el("polygon",
      {fill:BASE[i],"fill-opacity":".55"})));
    /* and a label band, so the bay still reads as four different reagents
       when the one in use is nearly drained */
    const ly=by+bd/2+0.002;
    g.appendChild(el("polygon",{points:pts([P(bx-bw*0.4,ly,deck+0.15),P(bx+bw*0.4,ly,deck+0.15),
      P(bx+bw*0.4,ly,deck+0.115),P(bx-bw*0.4,ly,deck+0.115)]),fill:BASE[i],"fill-opacity":".8"}));
    bay.push({x:bx,y:by,liq});
  }

  /* ---- flow cell, front centre: the glass, the wash, and the clusters ----
     Kept to the right of the tower's footprint rather than centred on the
     deck: overlapping footprints in this projection means one object growing
     out of the other, and there is no depth sort here to save it. */
  const fx=X(0.21), fy=Y(0.22), fw=n.w*0.38, fd=n.d*0.34, fz=deck+0.055;
  prism(g,fx,fy,fw,fd,deck,fz,SKIN.glass);
  const tint=add(g,el("polygon",{points:boxAt(fx,fy,fw*0.9,fd*0.86,fz,fz).top,
    fill:BASE[0],"fill-opacity":"0"}));
  const cl=[];
  for(let a=0;a<7;a++)for(let b=0;b<4;b++){
    const u=(a+0.5)/7-0.5, v=(b+0.5)/4-0.5;
    const p=P(fx+u*fw*0.84, fy+v*fd*0.78, fz+0.002);
    cl.push({u:u+0.5, k:0.45+r()*0.55,
      node:add(g,el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),
        r:(0.9+r()*0.5).toFixed(1),fill:"var(--fg)","fill-opacity":"0"}))});
  }
  /* the camera pass — built at the left edge of the cell and driven across it */
  const scan=el("g",{opacity:"0"}); g.appendChild(scan);
  const sx=fx-fw*0.44, span=fw*0.88;
  scan.appendChild(el("polygon",{points:boxAt(sx,fy,n.w*0.05,fd*1.04,fz,fz+0.001).top,
    fill:"var(--signal)","fill-opacity":".45"}));
  prism(scan,sx,fy,n.w*0.028,fd*1.04,fz,fz+0.10,SKIN.sC);

  /* ---- the gantry: a bridge that travels in x, a head that rides it in y ----
     Dimensioned off the 0.42 of headroom: beam clear of the bottles, tip clear
     of the beam, and the top of it still under the 1.42 the rest of the map
     has been told this machine reaches. */
  const gan=el("g",{}); g.appendChild(gan);
  const gx=X(0.055), pz=deck+0.31;
  [Y(-0.46),Y(0.46)].forEach(py=>prism(gan,gx,py,n.w*0.035,n.d*0.05,deck,pz,SKIN.works));
  prism(gan,gx,n.y,n.w*0.045,n.d*0.95,pz,pz+0.075,SKIN.monolith);
  const head=el("g",{}); gan.appendChild(head);
  prism(head,gx,n.y,n.w*0.075,n.d*0.11,pz-0.055,pz+0.02,SKIN.monolith);
  const tip=el("g",{}); head.appendChild(tip);
  prism(tip,gx,n.y,n.w*0.03,n.d*0.045,pz-0.095,pz-0.04,SKIN.works);
  const mouth=P(gx,n.y,pz-0.10);
  const charge=add(tip,el("circle",{cx:mouth[0].toFixed(1),cy:mouth[1].toFixed(1),
    r:"1.4",fill:BASE[0],"fill-opacity":"0"}));
  /* The drop is not on the gantry: it is let go of, and after that the arm's
     motion is none of its business. It is still born at the mouth rather than
     nowhere — an element with no cx/cy sits at the SVG origin, and since the
     selection halo is a CSS filter whose region is this group's bounding box,
     one loose circle there stretched the halo from here to the origin. */
  const drop=add(g,el("circle",{cx:mouth[0].toFixed(1),cy:mouth[1].toFixed(1),
    r:"2",fill:BASE[0],"fill-opacity":"0"}));

  const HOME=0.7, REACH=1.3, DIP=1.1, MOVE=1.4, POUR=0.9, IMG=2.6, WASH=1.5;
  const t1=HOME, t2=t1+REACH, t3=t2+DIP, t4=t3+MOVE, t5=t4+POUR, t6=t5+IMG;
  const CYCLE=t6+WASH, LOOP=CYCLE*4;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const c01=x=>Math.max(0,Math.min(1,x));
  /* down, hold, up — the tip in a bottle and the tip over the flow cell are
     the same move at two depths */
  const dive=f=> f<0.3 ? ease(f/0.3) : f<0.7 ? 1 : 1-ease((f-0.7)/0.3);
  const hx=X(0.055), hy=Y(0.40);            // where the arm parks between cycles
  const inX=fx-fw*0.20, inY=fy-fd*0.28;     // the inlet it dispenses into

  let t=0;
  const run=(dt,now)=>{
    t=(t+dt)%LOOP;
    const i=Math.floor(t/CYCLE)%4, u=t%CYCLE, col=BASE[i], T=now/1000;
    const b=bay[i];

    /* park -> reagent -> inlet -> clear of the camera -> park */
    const KF=[[0,hx,hy],[t1,hx,hy],[t2,b.x,b.y],[t3,b.x,b.y],[t4,inX,inY],[t5,inX,inY],
              [t5+IMG*0.3,inX,Y(-0.36)],[t6,inX,Y(-0.36)],[CYCLE,hx,hy]];
    let px=hx, py=hy;
    for(let k=1;k<KF.length;k++){
      if(u<=KF[k][0]){
        const a=KF[k-1], c=KF[k], f=ease(c01((u-a[0])/Math.max(1e-6,c[0]-a[0])));
        px=a[1]+(c[1]-a[1])*f; py=a[2]+(c[2]-a[2])*f; break;
      }
    }
    gan.setAttribute("transform",DX(px-gx));
    head.setAttribute("transform",DY(py-n.y));

    /* into the bottle far enough to touch what is in it; over the flow cell it
       only nods, because a dispense is made from a standoff and the drop has
       to have somewhere to fall from */
    let down=0;
    if(u>=t2&&u<t3)      down=dive((u-t2)/DIP)*0.105;
    else if(u>=t4&&u<t5) down=dive((u-t4)/POUR)*0.035;
    tip.setAttribute("transform",DZ(-down));

    const held = u<t2 ? 0
      : u<t3 ? ease(c01((u-t2)/(DIP*0.7)))
      : u<t4 ? 1
      : u<t5 ? 1-ease(c01((u-t4)/(POUR*0.6))) : 0;
    charge.setAttribute("fill",col);
    charge.setAttribute("fill-opacity",(held*0.9).toFixed(2));

    /* only the bottle in use moves, and it is back where it started before the
       next cycle asks for it */
    bay.forEach((o,j)=>{
      const gone = (j!==i||u<=t2) ? 0
        : u<t3 ? ease(c01((u-t2)/(DIP*0.7)))
        : 1-ease(c01((u-t3)/(MOVE+POUR+IMG)));
      const q=boxAt(o.x,o.y,bw*0.78,bd*0.78,deck+0.012,deck+0.012+bh*(0.62-0.2*gone));
      o.liq[0].setAttribute("points",q.left);
      o.liq[1].setAttribute("points",q.right);
      o.liq[2].setAttribute("points",q.top);
    });

    let dop=0;
    if(u>=t4+POUR*0.25&&u<t4+POUR*0.72){
      const f=c01((u-t4-POUR*0.25)/(POUR*0.47));
      const z0=pz-0.135, p=P(inX,inY,z0+(fz+0.008-z0)*f*f);   // the tip's mouth, mid-nod
      drop.setAttribute("cx",p[0].toFixed(1)); drop.setAttribute("cy",p[1].toFixed(1));
      dop=0.9;
    }
    drop.setAttribute("fill",col);
    drop.setAttribute("fill-opacity",dop.toFixed(2));

    const wet = u<t4+POUR*0.55 ? 0
      : u<t6 ? ease(c01((u-t4-POUR*0.55)/0.6))
      : 1-ease(c01((u-t6)/(WASH*0.8)));
    tint.setAttribute("fill",col);
    tint.setAttribute("fill-opacity",(wet*0.3).toFixed(2));

    /* imaging: the camera crosses once and each cluster reads out as it goes
       past, then the wash takes the whole field back down to nothing */
    const shot=u>=t5&&u<t6, s=shot?c01((u-t5)/(IMG*0.86)):0;
    scan.setAttribute("opacity",shot?"1":"0");
    scan.setAttribute("transform",DX(s*span));
    const fade = u<t6 ? 1 : 1-ease(c01((u-t6)/(WASH*0.9)));
    cl.forEach(c=>{
      const on = shot ? c01((s-c.u)*7) : (u>=t6?1:0);
      c.node.setAttribute("fill",col);
      c.node.setAttribute("fill-opacity",(on*fade*c.k).toFixed(2));
    });

    /* the lamp is the only thing on this map that blinks, so it is kept rare:
       two short pulses as a cycle starts, then a steady breath while the
       camera is actually running */
    const beat=Math.max(u<0.16||(u>0.3&&u<0.46)?1:0, shot?(0.5+0.5*Math.sin(T*5))*0.8:0);
    const lit=shot?col:"var(--signal)";
    lamp.setAttribute("fill",lit);
    lamp.setAttribute("fill-opacity",(0.28+0.72*beat).toFixed(2));
    stops.forEach(s=>s.setAttribute("stop-color",lit));
    halo.setAttribute("r",(4+8*beat).toFixed(1));
    halo.setAttribute("fill-opacity",(0.06+0.5*beat).toFixed(2));
    vent.setAttribute("fill-opacity",(0.5+0.28*beat).toFixed(2));
    bar.setAttribute("points",quad(bx0,bx0+(bx1-bx0)*(u/CYCLE),bz0,bz1));
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
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

/* the well grid of any plate on this map. THE GRID IS A PARAMETER because the
   compound plate and the in-situ barcoding plates are the same plastic with a
   different number of wells punched in it — 8 x 6 down in row 1, 12 x 8 in the
   barcoding rounds — and a second grid builder would be a second answer to
   where a well is. The four treatment bands stay four however many columns
   there are, so a band is a quarter of the plate rather than two columns. */
function plateGrid(n, th, cols, rows){
  const hw=n.w/2, hd=n.d/2, sx=n.w/cols, sy=n.d/rows;
  const R=Math.min(sx,sy)*0.38, out=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)
    out.push({i,j,band:PLATE_BANDS[Math.floor(i*PLATE_BANDS.length/cols)],
              e:ellipseAt(n.x-hw+(i+0.5)*sx, n.y-hd+(j+0.5)*sy, th, R)});
  return out;
}
function plateWells(n, th){ return plateGrid(n, th, PLATE_COLS, PLATE_ROWS); }
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
/* THE SAME SLAB WITH A COLOURED LIP, which is how a semi-skirted plate is told
   apart from every other piece of plastic on the bench: the rim and the skirt
   carry the colour and the deck inside does not. The hue goes on as a TINT over
   the ordinary lit skin rather than as its own three faces — the map's solids
   are lit top-brightest, and a flat hue on all three turns the plate into a
   coloured card lying on the grid. Lip, notch and deck are all cut from the
   plate's own w and d. Returns the DECK, because the wells belong on it: grid
   the plate itself and the outer column sits up on the rim. */
function skirtSlab(g,n,th,hue){
  const f=faces(n.x,n.y,n.w,n.d,th);
  ["left","right"].forEach(k=>{
    g.appendChild(el("polygon",{points:f[k],fill:SKIN.tile[k],
      stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".7"}));
    g.appendChild(el("polygon",{points:f[k],fill:hue,
      "fill-opacity":k==="right"?".38":".5"}));
  });
  g.appendChild(el("polygon",{points:f.top,fill:hue,"fill-opacity":".6",
    stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".8"}));
  const LIP=n.w*0.039;
  const deck={x:n.x, y:n.y, w:n.w-LIP*2, d:n.d-LIP*2};
  g.appendChild(el("polygon",{points:faces(deck.x,deck.y,deck.w,deck.d,th).top,
    fill:"var(--bg)","fill-opacity":".9",stroke:"var(--stroke)",
    "stroke-width":".7","stroke-opacity":".45"}));
  /* the A1 notch, same corner every plate on this map cuts it */
  const NOTCH=n.w*0.10;
  g.appendChild(el("polygon",{points:pts([P(n.x-n.w/2,n.y-n.d/2,th),
    P(n.x-n.w/2+NOTCH,n.y-n.d/2,th),P(n.x-n.w/2,n.y-n.d/2+NOTCH,th)]),
    fill:"var(--stroke)","fill-opacity":".55"}));
  return deck;
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

  /* Anything the ticker will move still has to be BORN somewhere. An element
     with no cx/cy sits at the SVG origin, which is nowhere near this machine —
     invisible, because these start at zero opacity, but not absent: the
     selection halo is a CSS filter and its region is the group's bounding box,
     so a couple of dozen droplets parked at the origin stretched that box
     across the map. Home is over the first source well, where the wave starts. */
  const home=swells[0].e, homeY=(home.y-lift).toFixed(1);

  /* where the transducer is aimed */
  const ring=el("ellipse",{cx:home.x.toFixed(1),cy:homeY,rx:"1",ry:"1",
    fill:"none",stroke:"var(--fg)","stroke-width":"1.3","stroke-opacity":"0"});
  g.appendChild(ring);

  /* droplets in flight */
  const rise=(th+gap)*S*CZ, POOL=26;
  const flying=[];
  for(let i=0;i<POOL;i++){
    const d=el("ellipse",{cx:home.x.toFixed(1),cy:homeY,rx:"1.9",ry:"2.5",
      fill:"var(--fg)","fill-opacity":"0"});
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

  /* ONE compound, drawn nine times. The seed is fixed rather than stepped per
     molecule because a well holds a single compound: nine different structures
     in one well said the opposite of what the step is about, and this is the
     dose the fish are sitting in. Size and rotation still vary — that is the
     same molecule at a different distance and angle, not a different molecule.
     432 is one of the structures that was already in this well: two rings, a
     double bond in each, two tails. Colour still comes from the plate band, so
     it stays the compound's own colour wherever this well is drawn. */
  const COMPOUND=432;
  const M=9, mols=[];
  for(let i=0;i<M;i++){
    const a=(i/M)*6.283+r()*0.45, rad=(0.32+0.55*((i%3)/2))*wellR;
    const node=el("g",{opacity:".78"});
    node.appendChild(moleculeGlyph(COMPOUND, band.fill));
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


/* ------------------------------------------------------------------
   B1 · THE THAW — a vial, a bath, and the coldest corner of the map.

   NO NODE WEARS THIS AT THE MOMENT. /molecular_pipe's B1 was asked from the
   page for the freezer reading instead and now draws `thawplate`, below. This
   stays in the vocabulary because it is the other true half of section 1.1 —
   the bath the vial goes into — and because the reading below borrows its
   rules: nothing biological moves, and the only thing that changes is the cold
   leaving.

   THIS STEP STILL HAS NO ENERGY OF ITS OWN AND MUST NOT BE DRAWN AS IF IT HAD
   ANY. The material in the tube was formaldehyde-fixed and permeabilised in a
   prior protocol: it is cross-linked, chemically locked and inert, and warming
   it does not restart it. Every station after this one has something happening
   inside the vessel — a strand extending, a barcode landing, a pool being
   split — and this one is the quiet before that.

   WHAT MOVES HERE IS THEREFORE THE COLD LEAVING, NOT THE BIOLOGY WAKING. The
   frost on the outside of the glass dissolves upward one tick at a time, and
   that is the only decisive gesture in the frame: it is a state the tube
   brought with it from the -80 being spent, and spending it takes nothing from
   the sample. Meanwhile the blue inside does almost nothing — a luminance
   drift of a few percent over the whole loop, no swirl, no rising meniscus, no
   flow. Stirring, not moving. If a later edit gives the contents a direction,
   a current or a glow, it has turned the quietest station on the row into
   another reaction and the reading is gone.

   THE HEAT IS STILL OUTSIDE THE TUBE. Three hairline arcs swell out of the
   bath and fade as they grow — transfer across a wall, where the bath is what
   is at 37 °C and the sample is not. So they never touch the vial and they
   never enter it, and that distinction is the whole content of the drawing.

   The loop closes by re-frosting, which is not a claim that the sample refreezes
   — it is how a station on a map that runs forever says "this is what happens
   here" rather than "this happened once". Every period below divides the 9.4 s
   cycle exactly so the seam is invisible.

   The frame is deliberately close to empty. The manual also has a haemocytometer
   count here and the record says so, but a second object and a second number
   would fill a frame whose emptiness is the reading.

   Requires ellipseAt() and arcPts() from the A2 clutch block: the vial is built
   the same way the pool-and-split conical is, out of stacked ground-plane
   circles and the two arcs that join them, so the glassware on this row is all
   drawn by one construction.
   ------------------------------------------------------------------ */
function drawThawVial(g,n){
  const r=rng(59);
  /* composed at w 2.52, d 1.82, h 0.665. Anything authored in screen pixels —
     a frost tick, a dash length, a type size — cannot grow by reading w, so it
     grows by being multiplied by this. */
  const SC=n.w/2.52;

  /* WHERE THE TWO OBJECTS STAND, and the order is the row's own. B2 is at
     greater x, so downstream is +x and the bath sits on that side: the vial
     reads as coming off the bench, into the water, and on toward round one.
     It stands BESIDE the bath rather than in it — the step is the whole
     immersion, and a vial drawn already submerged has no before. */
  const bath={x:n.x+n.w*0.24, y:n.y-n.d*0.06, w:n.w*0.46, d:n.d*0.52, h:n.h*0.32};
  const VR=n.w*0.052, vx=n.x-n.w*0.32, vy=n.y+n.d*0.10;

  /* ---- THE GROUND MARKS, first, so everything else stands on them ---------
     A dashed rectangle under each cluster, set the same distance beyond both
     silhouettes. The offset is a fraction of n.w rather than a pixel count, so
     it opens out with the object it rings instead of tightening onto it. */
  const FP=n.w*0.09;
  const foot=(cx,cy,hw,hd)=>g.appendChild(el("polygon",{
    points:pts([[cx-hw,cy-hd],[cx+hw,cy-hd],[cx+hw,cy+hd],[cx-hw,cy+hd]]
      .map(p=>P(p[0],p[1],0))),
    fill:"none",stroke:"var(--fg)","stroke-opacity":".26",
    "stroke-width":(1*SC).toFixed(2),
    "stroke-dasharray":`${(2*SC).toFixed(1)} ${(6*SC).toFixed(1)}`}));
  foot(bath.x,bath.y,bath.w/2+FP,bath.d/2+FP);
  foot(vx,vy,VR+FP,VR+FP);

  /* the arcs. Near half only: carried all the way round they would close into a
     ring, and a ring drawn on the floor under a tank reads as the tank's own
     base rather than as something leaving it.

     They travel now rather than standing at three fixed radii. The outer radius
     is the same one the static set stopped at, because that clearance is what
     keeps warmth from ever reaching the vial — an arc allowed to grow past it
     would cross the gap and say the sample is being heated directly. Each is
     born at its own point in the sweep, so the three read as a train leaving a
     source rather than as one line blinking. */
  const A_IN=n.w*0.20, A_OUT=n.w*0.46, ARCS=3;
  const arcs=[0,1,2].map(i=>({phase:i/ARCS,
    node:g.appendChild(el("polyline",{
      points:pts(arcPts(ellipseAt(bath.x,bath.y,0,A_IN+(A_OUT-A_IN)*(i/ARCS)),0,Math.PI,26)),
      fill:"none",stroke:"var(--fg2)","stroke-width":(1*SC).toFixed(2),
      "stroke-opacity":"0","stroke-linecap":"round"}))}));

  /* ---- THE BATH ----------------------------------------------------------
     Apparatus, so charcoal on every face like the rest of the bench. The water
     in it is deliberately colourless: the only blue in this frame belongs to
     what is inside the vial, and tinting the bath would hand the sample's
     colour to the heat source. Two insets are what turn a block into a vessel
     under this projection — the mouth, dark, and the surface sitting just
     below the rim. */
  paint(g,bath.x,bath.y,bath.w,bath.d,bath.h,SKIN.tile);
  const IW=bath.w*0.82, ID=bath.d*0.74;
  g.appendChild(el("polygon",{points:faces(bath.x,bath.y,IW,ID,bath.h).top,
    fill:"var(--bg)"}));
  /* the water sits on the SAME footprint as the mouth and lower down, never on
     a smaller one: an inset that shrinks as it drops is a funnel, and the gap
     between the two outlines is the only thing here that reads as wall */
  g.appendChild(el("polygon",{points:faces(bath.x,bath.y,IW,ID,bath.h*0.58).top,
    fill:"var(--fg)","fill-opacity":".10",stroke:"var(--stroke)",
    "stroke-width":(0.8*SC).toFixed(2),"stroke-opacity":".35"}));

  /* ---- THE VIAL ----------------------------------------------------------
     A skirted cryovial: straight wall, a small foot it can stand on, and a
     screw cap, which is the one feature that tells it apart from every other
     tube on this row. Every radius is a multiple of n.w and every height a
     multiple of n.h, so the whole thing grows with the node. */
  const ZS=n.h*0.16, ZB=n.h*1.55, ZT=n.h*1.82;
  const BR=VR*0.66, IR=VR*0.86, CR=VR*1.18;
  const rim  = ellipseAt(vx,vy,ZT,CR),
        col  = ellipseAt(vx,vy,ZB,CR),
        sho  = ellipseAt(vx,vy,ZB,VR),
        shl  = ellipseAt(vx,vy,ZS,VR),
        shIn = ellipseAt(vx,vy,ZS,IR),
        base = ellipseAt(vx,vy,0,BR),
        basIn= ellipseAt(vx,vy,0,BR*0.86);
  const silh=pts([[sho.x+sho.rx,sho.y],[shl.x+shl.rx,shl.y],
    ...arcPts(base,0,Math.PI,10),[shl.x-shl.rx,shl.y],[sho.x-sho.rx,sho.y],
    ...arcPts(sho,Math.PI,2*Math.PI,18)]);
  g.appendChild(el("polygon",{points:silh,fill:"var(--t-right)","fill-opacity":".9"}));

  /* THE CONTENTS ARE THE ONLY COLOUR IN THE FRAME, and this has to be the most
     desaturated blue in the piece — every later station's sample is warmer than
     this one, and if the coldest reads as the most saturated the row's whole
     temperature gradient runs backwards. There is no washed-out blue custom
     property to reach for and a hex is not allowed in a shape, so the blue is
     desaturated the way a real thin sample is: the same --c-* as everywhere
     else, carried at low fill-opacity over the charcoal glass already painted
     underneath, which pulls it toward neutral without inventing a colour.

     The body and the disc are drawn once and then only breathed on — the
     ticker moves nothing here but opacity, so the level, the meniscus and the
     silhouette are all as fixed as they were when this step held perfectly
     still. */
  const surf=ellipseAt(vx,vy,ZS+(ZB-ZS)*0.50,IR);
  const bodyFill=g.appendChild(el("polygon",{points:pts([...arcPts(surf,2*Math.PI,Math.PI,14),
    [shIn.x-shIn.rx,shIn.y],...arcPts(basIn,Math.PI,0,10),[shIn.x+shIn.rx,shIn.y]]),
    fill:"var(--c-left)","fill-opacity":".60"}));
  const surfFill=g.appendChild(el("ellipse",{cx:surf.x.toFixed(1),cy:surf.y.toFixed(1),
    rx:surf.rx.toFixed(2),ry:surf.ry.toFixed(2),fill:"var(--c-top)",
    "fill-opacity":".66"}));

  g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
    "stroke-width":(1*SC).toFixed(2),"stroke-opacity":".8"}));

  /* FROST, AND IT IS ON THE OUTSIDE OF THE WALL — so it goes on after the
     outline rather than under it. Densest at the foot and thinning upward,
     which is the gradient a tube out of a -80 actually carries, and it is the
     only mark in the frame that says the material arrived cold.

     Every tick is drawn at full opacity here and at its final place. The melt
     is a fade in the ticker, never a move: frost sublimes off the glass where
     it sits, and a tick that slid would read as a droplet running.

     Sorted by height so the melt front can walk up the wall in order. The base
     is where the ticks are dense, so most of them go in the first part of the
     sweep and the front slows as it thins out near the shoulder — which is the
     right way round, and comes free from spacing the departures evenly rather
     than spacing the heights evenly.

     Colour is var(--fg) rather than anything literally white, because frost is
     a mark like every other mark on the map and has to invert with the theme;
     on the dark theme this reads as the near-white the request asks for. */
  const frost=[];
  for(let i=0;i<34;i++){
    /* never below ZS: under the shoulder the wall is already tapering in to the
       foot, and a tick at full radius down there hangs off the silhouette as a
       leg rather than sitting on the glass */
    frost.push({z:ZS+(ZB-ZS)*Math.pow(r(),2.6), a:0.10*Math.PI+r()*0.80*Math.PI});
  }
  frost.sort((p,q)=>p.z-q.z);
  frost.forEach(f=>{
    const e=ellipseAt(vx,vy,f.z,VR*0.94), L=VR*S*0.18;
    const px=e.x+e.rx*Math.cos(f.a), py=e.y+e.ry*Math.sin(f.a);
    f.node=g.appendChild(el("line",{x1:px.toFixed(1),y1:(py-L).toFixed(1),
      x2:px.toFixed(1),y2:(py+L).toFixed(1),stroke:"var(--fg)",
      "stroke-width":(1*SC).toFixed(2),"stroke-opacity":".5","stroke-linecap":"round"}));
  });

  /* the cap, drawn last because it is the near top of the object */
  g.appendChild(el("polygon",{points:pts([...arcPts(rim,2*Math.PI,Math.PI,14),
    ...arcPts(col,Math.PI,0,12)]),fill:"var(--t-right)",stroke:"var(--stroke)",
    "stroke-width":(1*SC).toFixed(2),"stroke-opacity":".8"}));
  g.appendChild(el("ellipse",{cx:rim.x.toFixed(1),cy:rim.y.toFixed(1),
    rx:rim.rx.toFixed(2),ry:rim.ry.toFixed(2),fill:"var(--t-top)",
    stroke:"var(--stroke)","stroke-width":(1*SC).toFixed(2),"stroke-opacity":".85"}));
  /* two ridges, which is all the knurling that survives at this size */
  [0.34,0.66].forEach(f=>g.appendChild(el("polyline",{
    points:pts(arcPts(ellipseAt(vx,vy,ZB+(ZT-ZB)*f,CR),0,Math.PI,12)),fill:"none",
    stroke:"var(--stroke)","stroke-width":(0.8*SC).toFixed(2),"stroke-opacity":".45"})));

  /* ---- THE ONE NUMBER ----------------------------------------------------
     Laid on the ground plane along the flow axis: +x on this row projects to
     30 degrees, so the type runs down the lane rather than across it. It sits
     in the gap between the two objects, which is the only part of the
     footprint with nothing standing on it and nothing radiating through it. */
  /* the stack is B6's, repeated rather than hoisted: every map's scripts share
     one global scope, and a top-level MONO here collides with the one
     culls-draw.js already declares. */
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const FS=n.w*4.2;                          // ~10.6px at the authored width
  const [tx,ty]=P(n.x-n.w*0.12, n.y+n.d*0.48, 0);
  const t=el("text",{x:tx.toFixed(1),y:ty.toFixed(1),
    transform:`rotate(30,${tx.toFixed(1)},${ty.toFixed(1)})`,
    "font-family":MONO,"font-size":FS.toFixed(2),
    "letter-spacing":(FS*0.08).toFixed(2),fill:"var(--fg2)","font-weight":"500"});
  t.textContent="37 °C"; g.appendChild(t);

  /* ---- THE CLOCK ---------------------------------------------------------
     9.4 s end to end, and every span below is either measured in that or
     divides it, so the loop closes on itself with no seam to notice.

     STEP is the request's own 40 ms: the ticks leave one at a time, and the
     interval is what makes it read as an exhalation rather than as a dissolve
     filter over the whole scatter. FADE overlaps them slightly so the wall is
     never a row of hard on/off switches.

     The bare stretch is what is left after the other three, not a number of its
     own — it is the part of the loop where nothing happens except the drift and
     the arcs, and it has to be the longest span here or the station stops being
     the quiet one. The re-frost is a plain fade with no order to it, deliberately
     unlike the melt: the melt is the gesture, and a mirror-image return would
     make the loop a two-part animation instead of one event and a reset. */
  const CYCLE=9.4, STEP=0.04, FADE=0.28;
  const HOLD=1.7, MELT=(frost.length-1)*STEP+FADE, BACK=1.5;
  const BARE=CYCLE-HOLD-MELT-BACK;
  const ARCP=CYCLE/4;                        // four passes per loop
  const DRIFTP=CYCLE/2;                      // two slow breaths per loop
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  let clk=0;

  const run=dt=>{
    clk=(clk+dt)%CYCLE;

    /* the melt front, then the return */
    frost.forEach((f,i)=>{
      let op;
      if(clk<HOLD) op=1;
      else if(clk<HOLD+MELT) op=1-clamp((clk-HOLD-i*STEP)/FADE);
      else if(clk<HOLD+MELT+BARE) op=0;
      else op=ease(clamp((clk-HOLD-MELT-BARE)/BACK));
      f.node.setAttribute("stroke-opacity",(0.5*op).toFixed(3));
    });

    /* each arc swells and thins together — the fade is tied to the radius, not
       to a separate clock, so an arc is faint because it has travelled */
    arcs.forEach(A=>{
      const u=((clk/ARCP)+A.phase)%1;
      A.node.setAttribute("points",
        pts(arcPts(ellipseAt(bath.x,bath.y,0,A_IN+(A_OUT-A_IN)*ease(u)),0,Math.PI,26)));
      /* the short rise stops it appearing at full strength on top of the tank
         wall; after that it is only ever losing */
      A.node.setAttribute("stroke-opacity",
        (0.32*Math.min(1,u/0.12)*Math.pow(1-u,1.3)).toFixed(3));
    });

    /* THE BIOLOGY STIRRING RATHER THAN MOVING. A few percent of luminance, and
       it must stay a few percent: this is the one thing in the frame that is
       the sample itself, and anything large enough to be watched directly would
       claim the fixed material had woken up. */
    const d=Math.sin(2*Math.PI*clk/DRIFTP);
    bodyFill.setAttribute("fill-opacity",(0.60+0.035*d).toFixed(3));
    surfFill.setAttribute("fill-opacity",(0.66+0.025*d).toFixed(3));
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.thawvial = drawThawVial;


/* ------------------------------------------------------------------
   B1 · THE THAW, AS THE -80 GIVING SOMETHING BACK.
   Asked for from this map's own "Edit visual" button, and it replaces the vial
   in the water bath on B1 rather than standing beside it — one station wears
   one drawing. The vial is left in the vocabulary above.

   THE TWO READINGS OF THIS STEP, AND WHY THIS ONE. Section 1.1 is a vial in a
   37 C bath; the station's own does line is "fixed material comes back out of
   the freezer". Both are the same ten minutes. The bath is what the bench does
   and the freezer is what the material is, and the request asks for the second
   — so what is drawn is the cold store opening and a plate coming out of it,
   with the bath left out entirely rather than shrunk into a corner. Nothing
   else is in the frame, which is the same emptiness the vial had.

   NOTHING BIOLOGICAL MOVES, AND THAT IS THE CONTENT. The material is
   formaldehyde-fixed and permeabilised: warming it restarts nothing. So the
   wells never stir and the cell in the inset never moves. The only things that
   change are the plate's position and the frost on it, and the frost goes by
   FADING rather than melting — no drips, no cracks, no puddle. A drip would be
   liquid water leaving the sample, which is a loss; a fade is a state the plate
   brought with it from the -80 being spent.

   THE FROST IS TWO LAYERS OVER THE PLATE, NOT A TINT ON IT. A snowflake on an
   opaque shell, and the shell over the plastic. They clear in that order, so
   the mark that says "cold" is gone before the thing that hides the plate is,
   and the plate is revealed by an absence rather than by a fill changing
   colour. The shell goes OUTSIDE-IN — a rim warms before a middle does, and
   the last frost anywhere is the middle of the slab — and it goes quickly,
   because a plate that arrives after six seconds of fade arrives into a beat
   the eye has already left. Under it the wells come up in row-waves, which is
   the eight rows of a 96-well plate saying what they are as they appear.

   THE INSET IS WHAT THE WELLS ARE TOO SMALL TO SAY. Ninety-six wells on an
   object this size are two pixels each; the one claim that matters about their
   contents — a cell whose membrane is holed, cross-linked and still standing —
   cannot survive at that scale. So it is magnified out to one well, and it
   arrives last, once there is a plate to point at. Its frame is a thin
   UNBROKEN ellipse and the membrane inside it is broken, and that split is
   load-bearing across this whole map: a solid ring means "magnified view", a
   broken ring means "porous membrane", and no drawing here may use one to mean
   the other.

   THE LOOP CUTS. Every phase is a pure function of t, so the wrap re-freezes
   everything in one frame rather than running the thaw backwards. Frost
   re-forming on material that has been thawed would be a claim about the
   sample; a cut is the map saying "this is what happens here".

   THE FREEZER STANDS UP, AND IT HAS BEEN ASKED FOR BOTH WAYS. It was spun by
   a wrapper rotate() once and tipped a quarter turn about the map's x axis
   once, and the page has now asked for the box back on its feet: snowflakes on
   the top and right faces, the door on the left face, and that door going
   straight up the page. A turned frame cannot give the last of those — tip the
   box and the door's travel is the image of a world-height axis, which points
   into the picture rather than up it, so a shutter reads as sliding away
   instead of rising. So the drawing is back on the map's own projection, with
   nothing between it and P: every dimension below is the one it was always
   authored with, because the two turns only ever moved the frame.

   Requires plateGrid() from the plate set for the well positions, so the wells
   on this plate are placed by the same code as every other plate on the site.
   ------------------------------------------------------------------ */
function drawThawPlate(g,n){
  const r=rng(1607);
  /* composed at w 2.52, d 1.82, h 0.665. A snowflake arm, a dash, a stroke
     width and the whole of the inset are authored in screen pixels and cannot
     grow by reading w, so they grow by being multiplied by this. */
  const SC=n.w/2.52;
  /* the plate is the one the round-one split is dealt into, so the grid is the
     node's own fact where it states one and 12 x 8 where it does not */
  const COLS=n.cols||12, ROWS=n.rows||8;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* WHERE THE TWO OBJECTS STAND. The freezer sits back and downstream, the
     plate forward and upstream of it, so the travel runs out of the door and
     toward the viewer — and toward B2, which is where the material goes next.
     Every dimension is a fraction of the node's own box: the plate has to pass
     through the doorway at any size, so both are cut from n.w. */
  const frz={x:n.x+n.w*0.16, y:n.y-n.d*0.24, w:n.w*0.62, d:n.d*0.52, h:n.h*1.90};
  const th=n.h*0.30;                       // the plastic's own depth
  const plate={x:n.x-n.w*0.20, y:n.y+n.d*0.25, w:n.w*0.56, d:n.w*0.56*0.62};
  const doorY=frz.y+frz.d/2, hwF=frz.w/2;
  const dx0=frz.x-hwF+frz.w*0.03, dx1=frz.x+hwF-frz.w*0.03;
  const dz0=frz.h*0.10, dz1=frz.h*0.86, shelf=frz.h*0.28;
  const D=(xv,zv)=>P(xv,doorY,zv);

  /* A FLAKE IS BUILT IN THE PLANE IT LIES ON. pt2 maps a point on a face to the
     page, so the arms foreshorten with the face they sit on instead of being a
     screen-space star pasted over it. /pipeline's own freezer builds its flakes
     this way and this is a copy rather than a shared helper: that one is a
     closure inside the shape the big map ships, and hoisting it out would edit
     a drawing this request was not about. */
  const snowflake=(host,pt2,R,op)=>{
    const fl=el("g",{});
    const line=(a,b,w,o)=>{
      const p=pt2(a[0],a[1]), q=pt2(b[0],b[1]);
      fl.appendChild(el("line",{x1:p[0].toFixed(1),y1:p[1].toFixed(1),
        x2:q[0].toFixed(1),y2:q[1].toFixed(1),stroke:"var(--fg)",
        "stroke-width":(w*SC).toFixed(2),"stroke-opacity":o,"stroke-linecap":"round"}));
    };
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3, dx=Math.cos(a), dy=Math.sin(a);
      line([0,0],[dx*R,dy*R],1.5,op);
      [[0.5,0.3],[0.78,0.2]].forEach(([f,len])=>{
        const bx=dx*R*f, by=dy*R*f;
        [0.62,-0.62].forEach(sw=>line([bx,by],
          [bx+Math.cos(a+sw)*R*len, by+Math.sin(a+sw)*R*len],1.1,op*0.9));
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

  /* the ground mark first, so everything else stands on it. It stays put while
     the plate is still inside, which is what makes the rest position a place
     the plate is going rather than wherever it stopped. */
  const FP=n.w*0.045;
  g.appendChild(el("polygon",{
    points:pts([[plate.x-plate.w/2-FP,plate.y-plate.d/2-FP],
                [plate.x+plate.w/2+FP,plate.y-plate.d/2-FP],
                [plate.x+plate.w/2+FP,plate.y+plate.d/2+FP],
                [plate.x-plate.w/2-FP,plate.y+plate.d/2+FP]].map(p=>P(p[0],p[1],0))),
    fill:"none",stroke:"var(--fg)","stroke-opacity":".26",
    "stroke-width":(1*SC).toFixed(2),
    "stroke-dasharray":`${(2*SC).toFixed(1)} ${(6*SC).toFixed(1)}`}));

  /* the dark the door stands open on, behind everything else on that wall. It
     is the page's own void colour rather than anything literally black: every
     mark here inverts with the theme, so "dark interior" is the paper showing
     through on the light one and a hole in the light on the dark one. */
  const interiorG=el("g",{}); g.appendChild(interiorG);
  interiorG.appendChild(el("polygon",{
    points:pts([D(dx0,dz1),D(dx1,dz1),D(dx1,dz0),D(dx0,dz0)]),
    fill:"var(--bg)","fill-opacity":".95"}));

  /* ---- THE PLATE, AND EVERYTHING THAT TRAVELS WITH IT --------------------
     One group, built at the rest position and translated: the shell and the
     flake are over the same plastic wherever it is, so they cannot be allowed
     to drift out of register while it moves. */
  const cart=el("g",{}); g.appendChild(cart);

  const pf=faces(plate.x,plate.y,plate.w,plate.d,th);
  ["left","right"].forEach(k=>cart.appendChild(el("polygon",{points:pf[k],
    fill:SKIN.tile[k],stroke:"var(--stroke)","stroke-width":(1.2*SC).toFixed(2)})));
  /* charcoal body, green rim: the skirt is the bench's own dark plastic and the
     top face is the anchor green this map keeps for its landmarks, with the
     well field punched back to charcoal so 96 pale wells have something dark to
     sit in */
  cart.appendChild(el("polygon",{points:pf.top,fill:"var(--a-top)",
    stroke:"var(--stroke)","stroke-width":(1.2*SC).toFixed(2)}));
  const RIM=Math.min(plate.w,plate.d)*0.085;
  const field={x:plate.x,y:plate.y,w:plate.w-RIM*2,d:plate.d-RIM*2};
  cart.appendChild(el("polygon",{points:faces(field.x,field.y,field.w,field.d,th).top,
    fill:"var(--t-top)",stroke:"var(--stroke)",
    "stroke-width":(0.7*SC).toFixed(2),"stroke-opacity":".5"}));

  /* one group per row, because the reveal is a row-wave: a well is either in
     the row that has arrived or in one that has not, and grouping them is what
     makes that one attribute instead of ninety-six */
  const wells=plateGrid(field, th, COLS, ROWS);
  const rowsG=[];
  for(let j=0;j<ROWS;j++) rowsG.push(cart.appendChild(el("g",{opacity:"0"})));
  wells.forEach(w=>rowsG[w.j].appendChild(el("ellipse",{
    cx:w.e.x.toFixed(1),cy:w.e.y.toFixed(1),
    rx:w.e.rx.toFixed(2),ry:w.e.ry.toFixed(2),
    fill:"var(--c-top)","fill-opacity":".62",stroke:"var(--stroke)",
    "stroke-width":(0.5*SC).toFixed(2),"stroke-opacity":".35"})));

  /* the shell: the same cold blue as the freezer on a box the shape of the
     plate, opaque and a shade proud of it on every axis, so no edge of plastic
     shows through the frost it is supposed to be under.

     IT IS BUILT AS NESTED SLABS BECAUSE FROST LEAVES FROM THE EDGES. A rim
     warms before a middle does, so the shell clears outside-in rather than all
     at once, and the way to draw that without a mask is concentric opaque tops
     stacked largest first: when the outermost fades it uncovers the plate's
     rim, and the one under it is still holding the centre. The overlap never
     shows, because the slab beneath a fading slab is at full strength and the
     same colour. Only the outermost carries the box's sides and its outline —
     the inner ones are the frost that is left, not boxes of their own. */
  const shellH=th*1.35, over=plate.w*0.012;
  const BANDS=5, bands=[];
  for(let i=0;i<BANDS;i++){
    const f=1-i/BANDS;
    const bf=faces(plate.x,plate.y,(plate.w+over*2)*f,(plate.d+over*2)*f,shellH);
    const bg=el("g",{});
    const at={points:bf.top,fill:SKIN.cold.top};
    if(i===0){
      ["left","right"].forEach(k=>bg.appendChild(el("polygon",{points:bf[k],
        fill:SKIN.cold[k],stroke:"var(--stroke)","stroke-width":(1.3*SC).toFixed(2)})));
      at.stroke="var(--stroke)"; at["stroke-width"]=(1.3*SC).toFixed(2);
    }
    bg.appendChild(el("polygon",at));
    cart.appendChild(bg); bands.push(bg);
  }
  const shellFlake=el("g",{}); cart.appendChild(shellFlake);
  snowflake(shellFlake,(u,v)=>P(plate.x+u,plate.y+v,shellH),
            Math.min(plate.w,plate.d)*0.30,.85);

  /* ---- THE FREEZER -------------------------------------------------------
     Two faces and the flakes on them, then the front wall built as a frame
     around the doorway rather than as one panel with a hole in it — the frame
     is what the plate passes behind on its way out. */
  const shellG=el("g",{}); g.appendChild(shellG);
  const ff=faces(frz.x,frz.y,frz.w,frz.d,frz.h);
  ["right","top"].forEach(k=>shellG.appendChild(el("polygon",{points:ff[k],
    fill:SKIN.cold[k],stroke:"var(--stroke)","stroke-width":(1.3*SC).toFixed(2)})));
  snowflake(shellG,(u,v)=>P(frz.x+u, frz.y+v, frz.h), Math.min(frz.w,frz.d)*0.30,.5);
  snowflake(shellG,(u,v)=>P(frz.x+hwF, frz.y+u, frz.h*0.55+v),
            Math.min(frz.d,frz.h)*0.26,.45);
  const F=(a,b,c,d)=>shellG.appendChild(el("polygon",{
    points:pts([D(a,d),D(b,d),D(b,c),D(a,c)]),fill:SKIN.cold.left,
    stroke:"var(--stroke)","stroke-width":(1*SC).toFixed(2),"stroke-opacity":".8"}));
  F(frz.x-hwF, frz.x+hwF, 0,   dz0);
  F(frz.x-hwF, frz.x+hwF, dz1, frz.h);
  F(frz.x-hwF, dx0,       dz0, dz1);
  F(dx1,       frz.x+hwF, dz0, dz1);

  /* THE DOOR IS A SHUTTER, NOT A LEAF. It rises in the plane of the doorway and
     rolls up into the head above it, the way the roll-up front of a cold store
     does, so an open door is not an object standing in the path the plate has
     to take. A hinged leaf has to be swung to the side the plate does not use;
     a shutter has no side. It never shuts again — the loop cuts.

     IT IS ITS OWN CLIP. The top edge stays pinned to the head and only the
     bottom edge climbs, so the part that has gone up is simply not drawn: no
     clip path to keep in register with a moving panel, and the leaf is exactly
     as tall as the hole it still has left to cover. The ribs are fixed to the
     leaf, so they climb with it and go out one at a time under the head, which
     is what makes the motion read as rolling away rather than shrinking. */
  const doorG=el("g",{}); g.appendChild(doorG);
  const DH=dz1-dz0, INSET_X=(dx1-dx0)*0.06;
  const doorLeaf=el("polygon",{points:pts([D(dx0,dz1),D(dx1,dz1),D(dx1,dz0),D(dx0,dz0)]),
    fill:SKIN.cold.left,stroke:"var(--stroke)","stroke-width":(1.2*SC).toFixed(2)});
  doorG.appendChild(doorLeaf);
  const bar=(a,b,zv,w,o)=>{
    const p=D(a,zv), q=D(b,zv);
    return doorG.appendChild(el("line",{x1:p[0].toFixed(1),y1:p[1].toFixed(1),
      x2:q[0].toFixed(1),y2:q[1].toFixed(1),stroke:"var(--stroke)",
      "stroke-width":(w*SC).toFixed(2),"stroke-opacity":o,"stroke-linecap":"round"}));
  };
  const ribs=[1,2,3].map(k=>bar(dx0+INSET_X,dx1-INSET_X,dz0+DH*k/4,1,".55"));
  const handle=bar(frz.x-(dx1-dx0)*0.14,frz.x+(dx1-dx0)*0.14,dz0+DH*0.12,2.2,".9");
  /* everything on the leaf is placed off the bottom edge, so one number moves
     the whole door and nothing can drift out of register with the panel */
  const setDoor=zb=>{
    doorLeaf.setAttribute("points",pts([D(dx0,dz1),D(dx1,dz1),D(dx1,zb),D(dx0,zb)]));
    const put=(node,a,b,zv)=>{
      const p=D(a,zv), q=D(b,zv);
      node.setAttribute("x1",p[0].toFixed(1)); node.setAttribute("y1",p[1].toFixed(1));
      node.setAttribute("x2",q[0].toFixed(1)); node.setAttribute("y2",q[1].toFixed(1));
      node.setAttribute("opacity",zv<dz1?"1":"0");
    };
    ribs.forEach((rb,k)=>put(rb,dx0+INSET_X,dx1-INSET_X,zb+DH*(k+1)/4));
    put(handle,frz.x-(dx1-dx0)*0.14,frz.x+(dx1-dx0)*0.14,zb+DH*0.12);
  };

  /* ---- THE INSET ---------------------------------------------------------
     A magnification, not a third object on the bench: it is drawn flat, in
     screen pixels, over one well it is tied to. What is in it is the one thing
     the whole row depends on and no plate at this size can show — a cell that
     is holed, held together by cross-links, and still a cell. */
  const insetG=el("g",{opacity:"0"}); g.appendChild(insetG);
  const src=wells.find(w=>w.i===Math.round(COLS*0.58)&&w.j===Math.round(ROWS*0.30))||wells[0];
  const [ix,iy]=P(plate.x-plate.w*0.34, plate.y-plate.d*0.06, n.h*3.3);
  const IR=34, MR=20;                       // inset and membrane radii, at SC 1
  insetG.appendChild(el("ellipse",{cx:src.e.x.toFixed(1),cy:src.e.y.toFixed(1),
    rx:(src.e.rx*2.4).toFixed(2),ry:(src.e.ry*2.4).toFixed(2),fill:"none",
    stroke:"var(--fg2)","stroke-width":(0.9*SC).toFixed(2),"stroke-opacity":".7"}));
  [0.30*Math.PI, 0.74*Math.PI].forEach(a=>{
    const ex=ix+IR*SC*Math.cos(a), ey=iy+IR*SC*0.88*Math.sin(a);
    insetG.appendChild(el("line",{x1:src.e.x.toFixed(1),y1:src.e.y.toFixed(1),
      x2:ex.toFixed(1),y2:ey.toFixed(1),stroke:"var(--fg2)",
      "stroke-width":(0.8*SC).toFixed(2),"stroke-opacity":".4"}));
  });
  const lens=el("g",{transform:`translate(${ix.toFixed(1)},${iy.toFixed(1)}) scale(${SC.toFixed(4)})`});
  insetG.appendChild(lens);
  /* THE LENS RING IS SOLID AND THIN, AND THAT IS A RULE NOW. It used to be
     dashed, which put two broken rings inside each other meaning two unrelated
     things — the outer one "this is magnified", the inner one "this wall has
     holes in it". A reader has no way to tell those apart. So the frame is one
     unbroken line: a solid ring is a magnified view, a broken ring is a porous
     membrane, and the only dashed circle left in the inset is the cell. */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:IR,ry:(IR*0.88).toFixed(1),
    fill:"var(--bg)","fill-opacity":".92",stroke:"var(--fg2)","stroke-width":"1.4",
    "stroke-opacity":".8"}));
  /* the same pale blue the wells hold, so the magnification is plainly of one
     of them rather than a second sample */
  lens.appendChild(el("circle",{cx:"0",cy:"0",r:MR,fill:"var(--c-top)","fill-opacity":".10"}));

  /* THE MEMBRANE IS DRAWN AS WHAT IS LEFT OF IT. Nine arcs with irregular gaps
     between them: a wall with holes in it, which is permeabilisation, rather
     than a dashed circle, which reads as a boundary that is not there. */
  let a0=r()*6.283;
  const seg=6.283/9;
  for(let i=0;i<9;i++){
    const len=seg*(0.62+r()*0.24);
    const p0=[Math.cos(a0)*MR, Math.sin(a0)*MR],
          p1=[Math.cos(a0+len)*MR, Math.sin(a0+len)*MR];
    lens.appendChild(el("path",{
      d:`M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${MR} ${MR} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`,
      fill:"none",stroke:"var(--fg)","stroke-width":"1.6","stroke-opacity":".8",
      "stroke-linecap":"round"}));
    a0+=seg;
  }

  /* the cross-links, faint: what holds a fixed cell in shape once its membrane
     is full of holes is the chemistry, not the wall. The knots sit on two
     jittered rings rather than at random — scattered, a dozen points in a disc
     this small clump, and a clump joined up reads as one dense object in the
     middle of the cell instead of as a mesh through the whole of it. */
  const knots=[[0,0]];
  [[5,0.44],[8,0.78]].forEach(([count,rad])=>{
    for(let i=0;i<count;i++){
      const a=(i+0.5+(r()-0.5)*0.5)*6.283/count;
      const rr=MR*rad*(0.88+r()*0.24);
      knots.push([Math.cos(a)*rr, Math.sin(a)*rr]);
    }
  });
  knots.forEach((p,i)=>knots.slice(i+1).forEach(q=>{
    if(Math.hypot(p[0]-q[0],p[1]-q[1])>MR*0.52) return;
    lens.appendChild(el("line",{x1:p[0].toFixed(1),y1:p[1].toFixed(1),
      x2:q[0].toFixed(1),y2:q[1].toFixed(1),stroke:"var(--fg2)",
      "stroke-width":".8","stroke-opacity":".26"}));
  }));

  /* and the strands, pale and few: the transcripts are the reason the cell is
     kept whole, and they are the only blue inside the wall */
  for(let i=0;i<4;i++){
    const v=(i-1.5)*MR*0.42, half=Math.sqrt(Math.max(1,MR*MR*0.62-v*v));
    let d=`M ${(-half).toFixed(1)} ${v.toFixed(1)}`;
    for(let s=1;s<=8;s++){
      const x=-half+2*half*(s/8);
      d+=` L ${x.toFixed(1)} ${(v+Math.sin(s*0.9+i*1.7)*MR*0.10).toFixed(1)}`;
    }
    lens.appendChild(el("path",{d:d,fill:"none",stroke:"var(--c-top)",
      "stroke-width":"1.2","stroke-opacity":".55","stroke-linecap":"round"}));
  }

  /* A PADLOCK, BESIDE THE CELL AND NOT ON IT. The holes in the wall and the
     mesh inside it show the cell is permeable and still standing; neither says
     that its contents are chemically fixed in place and cannot move or react.
     That is the whole reason warming this plate restarts nothing, and it is the
     one claim the drawing has no way to make by drawing the sample. So it is
     made by a mark instead — set outside the membrane, clear of it, so it reads
     as a note about the cell rather than as an organelle in it. */
  const LKX=IR*0.79;
  lens.appendChild(el("path",{
    d:`M ${(LKX-2.6).toFixed(1)} -0.5 L ${(LKX-2.6).toFixed(1)} -2.2`
      +` A 2.6 2.6 0 0 1 ${(LKX+2.6).toFixed(1)} -2.2 L ${(LKX+2.6).toFixed(1)} -0.5`,
    fill:"none",stroke:"var(--fg)","stroke-width":"1.2","stroke-opacity":".75"}));
  lens.appendChild(el("rect",{x:(LKX-4.2).toFixed(1),y:"-0.5",width:"8.4",height:"7.5",
    rx:"1.4",fill:"var(--fg2)","fill-opacity":".18",stroke:"var(--fg)",
    "stroke-width":"1.2","stroke-opacity":".75"}));
  lens.appendChild(el("circle",{cx:LKX.toFixed(1),cy:"3.2",r:"0.9",
    fill:"var(--fg)","fill-opacity":".7"}));

  /* ---- THE CLOCK ---------------------------------------------------------
     Thirteen seconds. The door and the slide keep their pace, because that is
     the freezer giving something up and it should take an effort; the frost
     does not, because it used to take six seconds to leave and the plate was
     arriving into a beat that had already gone slack. It now clears in half
     that, outside-in, and the plate is there while the eye is still on it. The
     last three are the hold — a plate at working temperature with nothing left
     to do, which is the state the next station inherits.

     Every phase reads t directly, so the wrap is a cut: the door is shut, the
     frost is back and the plate is back inside on one frame, and nothing is
     ever seen to re-freeze or to close. */
  const CYCLE=13.0;
  const T_DOOR=0.15, DOOR=1.25;
  const T_SLIDE=1.5, SLIDE=3.7;
  const T_FLAKE=5.4, FLAKE=1.1;
  const T_SHELL=6.3, SHELL=1.9;
  /* the bands go outermost first, spread over SHELL, each taking a little over
     half of it: they have to overlap or the frost retreats in visible steps */
  const BAND_FADE=SHELL*0.56, BAND_STEP=(SHELL-BAND_FADE)/(BANDS-1);
  const T_ROW=6.6, ROW_STEP=SHELL*0.62/ROWS, ROW_FADE=SHELL*0.34;
  const T_INSET=8.3, INSET=1.4;

  const [rx0,ry0]=P(plate.x,plate.y,0), [rx1,ry1]=P(frz.x,frz.y,shelf);
  const dxIn=rx1-rx0, dyIn=ry1-ry0;
  /* the frame the plate stops being behind the freezer and starts being in
     front of it: read off the geometry, so it is still right if either object
     is moved */
  const eClear=(plate.y-doorY)/(plate.y-frz.y);

  let t=0, ahead=null;
  const run=dt=>{
    t=(t+dt)%CYCLE;
    setDoor(dz0+(dz1-dz0)*ease(clamp((t-T_DOOR)/DOOR)));
    const e = t<T_SLIDE ? 1 : 1-ease(clamp((t-T_SLIDE)/SLIDE));
    cart.setAttribute("transform",
      `translate(${(dxIn*e).toFixed(2)},${(dyIn*e).toFixed(2)})`);
    const front = e<eClear;
    if(front!==ahead){
      ahead=front;
      g.insertBefore(cart, front?insetG:shellG);
    }
    shellFlake.setAttribute("opacity",(1-clamp((t-T_FLAKE)/FLAKE)).toFixed(3));
    bands.forEach((bg,i)=>bg.setAttribute("opacity",
      (1-clamp((t-T_SHELL-i*BAND_STEP)/BAND_FADE)).toFixed(3)));
    rowsG.forEach((rg,j)=>
      rg.setAttribute("opacity",clamp((t-T_ROW-j*ROW_STEP)/ROW_FADE).toFixed(3)));
    insetG.setAttribute("opacity",clamp((t-T_INSET)/INSET).toFixed(3));
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.thawplate = drawThawPlate;


/* THE ROUND ONE PLATE'S COLOUR WALK — one well, one colour, ninety-six of them
   mixed out of the twelve declared stops of the --ch ramp. It is hoisted out of
   the shape that first drew it because the pool and split next door has to draw
   the SAME plate: that station receives this plastic, and a second copy of the
   walk is a second plate that only looks like it.

   The stride has to stay coprime with the well count or the set stops closing
   and wells start sharing a colour — 37 and 96 share no factor. Stepping in
   order would lay a smooth gradient across the plate, and a gradient reads as
   an axis; these wells are a set of labels and are in no order at all.

   Spends --ch1..12, which are declared on /molecular_pipe and nowhere else. */
const RAMP_STRIDE=37;
const rampHue=(k,nw)=>{
  const u=((k*RAMP_STRIDE)%nw)*12/nw, a=Math.floor(u)%12, f=u-Math.floor(u);
  return f<0.005 ? `var(--ch${a+1})`
    : `color-mix(in oklab, var(--ch${(a+1)%12+1}) ${(f*100).toFixed(0)}%, var(--ch${a+1}))`;
};

/* BUT 96 HUES ON A 12-STOP RAMP ARE AN EIGHTH OF A STOP APART, and at four
   pixels a well an eighth of a stop is no difference at all: the plate read as
   twelve colours dealt eight times, which is a plate of repeated barcodes. So
   each well also takes one of eight lightnesses, pulled towards --bg or --fg by
   up to 40%. The level is the hue sub-step times three mod eight, so the eight
   wells that share a stop and sit side by side in hue land at least three
   lightness levels apart — the second axis separates exactly the wells the
   first one cannot. Hoisted when B4 was asked for 96 colours too, for the
   reason rampHue was: two copies of the walk would be two plates. rampHue is
   left as it is, because the other plates on the row still walk hue alone. */
const rampShade=(k,nw)=>{
  const m=(k*RAMP_STRIDE)%nw, l=(Math.floor(m*8*12/nw)%8*3)%8;
  const t=(l-3.5)/3.5, pct=(Math.abs(t)*40).toFixed(0);
  return `color-mix(in oklab, ${t<0?"var(--bg)":"var(--fg)"} ${pct}%, ${rampHue(k,nw)})`;
};

/* ------------------------------------------------------------------
   ROUND ONE · REVERSE TRANSCRIPTION
   A plate on the bench, and three of its wells opened up at once.

   THE PLATE IS THE OBJECT ON THE GRID and it is drawn at the size of one: a
   green semi-skirted 96-well plate, so the lip and the skirt carry the green
   and the deck inside it does not. It was smaller than its own magnification
   once, and a magnification wider than the thing it magnifies stops reading as
   a magnification and starts reading as the subject. The insets are small
   above it now, and the plate is what the eye lands on.

   Every well holds its own colour and no two wells share one — 96 values, not
   twelve repeated eight times. That is not decoration. Sample identity is
   written into the cDNA here and nowhere else on the map, in a barcode that
   belongs to a well, so a plate whose colours repeated would be a plate whose
   barcodes repeated.

   The hues are points on the twelve-stop ramp rather than stops on it, and the
   walk across them strides by a step coprime with 96: consecutive wells land
   nearly half a ramp apart, and the set still closes on all 96 exactly once.
   Stepping through in order would lay a smooth gradient across the plate, and
   a gradient reads as an axis — round one's wells are a set of labels, and
   they are in no order at all.

   THE WELLS CARRY THE BENCH-SCALE MOTION, now that no pipette does. Each sits
   dull and desaturated until its own barcode has been written, and then comes
   up to full strength: the three tethered wells first, each in time with the
   chip landing in its own inset, and the rest of the plate after them in a
   scattered wave. A head filling wells was the part of the step a reader
   already understood; a well holding colour only once its barcode exists is
   the part this drawing is actually claiming.

   THE STEP ITSELF HAPPENS ABOVE, in three solid ellipses tethered to three
   different wells. One inset can only say that a barcode is added; the fact of
   round one is that a DIFFERENT barcode is added in every well, so it takes
   three of them, running slightly out of step, with three chips in the three
   wells' exact colours. The difference between them is the content of the step.

   Each is a magnification, so it is drawn in screen space and not on the grid:
   flat marks, no isometry, nothing standing on anything. Inside is one fixed
   cell, its membrane pocked with the holes permeabilisation left — the
   boundary is intact and things cross it, which is the whole argument for
   doing this in situ rather than in a tube.

   Several transcripts lie in it, wavy and each ending in a short AAA, but only
   one is brought forward — a cell holds thousands and a frame that gives them
   all the same weight has no subject, so the rest stay small and faint behind
   it.

   THE BARCODE COMES FIRST. A hard-cornered rectangle in the exact colour of
   the well the inset is tethered to arrives at the AAA end with a small
   overshoot, and only then does the enzyme land and the copy start running out
   of it. That is the order the chemistry happens in — the barcode is carried
   ON the primer, so it is what the poly-A tail is found BY, not something
   stuck on afterwards — and it was drawn the other way round. WAVY MEANS
   NATIVE, HARD CORNERS MEAN ADDED: the RNA wanders and the chip does not, and
   every synthetic sequence added downstream inherits those corners.

   Then a reverse transcriptase walks the template and a bright cDNA is drawn
   growing behind it, back from the chip — the copy is written while you watch,
   because the writing IS the step. That beat is the longest thing in the loop
   by a wide margin; everything else is staging for it.

   Requires plateGrid / drawWell from the plate set, which in turn want
   ellipseAt() from the A2 clutch block. It spends --ch1..12, which are
   declared on /molecular_pipe and
   nowhere else; this shape is worn by that page alone.
   ------------------------------------------------------------------ */
function drawReverseTranscription(g0,n){
  /* everything is drawn into one group so the whole bench can be slid onto
     the centre of its own box at the end of the layout — see CENTRED, below */
  const g=g0.appendChild(el("g",{transform:"translate(0,0)"}));
  const r=rng(823);
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- THE PLATE ---------------------------------------------------
     Thrown forward of the node's own centre: behind is where the view hangs
     the name label, and a 96-well deck is wide enough to reach it. Every
     dimension is a fraction of the node, so a drag on a corner rescales the
     whole bench rather than pulling the wells out of the plastic.

     IT IS THE SETTING, NOT THE SUBJECT, and it was drawn at one and a half
     node widths, which made it the loudest thing on the row. All the plate has
     to say is "96 wells, and each one a different colour"; the step itself is
     in the lenses. So it comes in well under half the size it was — the well
     pitch and the well radius are both cut from the deck, so the grid packs
     exactly as it did and simply reads smaller. The lip and the notch are cut
     from the PLATE and not from the node, or they stay at their old size on a
     plate that no longer has room for them.

     IT IS B1'S PLATE, AND THE NUMBERS SAY SO RATHER THAN NEARLY SAY SO. B1
     draws n.w*1.72 on a 0.6-wide tile and takes its depth from the grid, and
     0.712 of this tile's 1.45 with the same depth rule lands on the same
     1.032 x 0.688 and the same 62.6 x 45.7 px. It is literally the same piece
     of plastic — the round-one plate is what B1 is handed — so anything but
     the same size across the two tiles is a second plate.

     THE DEPTH IS COMPUTED FROM THE GRID, not authored, for the reason B1
     computes its own: square well pitch is the whole requirement, and it is
     just depth = width x rows / cols. Authored depth was what let the two
     drift to different aspects while both still looked like plates.

     THE THICKNESS IS B1'S TOO — 0.714 of this tile's h is its 0.3 — which
     reads chunkier against a plate this narrow than the old 0.46 did against
     a wide one. That is the profile B1 has, and the two being the same object
     matters more here than this one staying as thin as it was. */
  const COLS=n.cols||12, ROWS=n.rows||8, NW=COLS*ROWS;
  const PW=n.w*0.712;
  const plate={x:n.x, y:n.y+n.d*0.30, w:PW, d:PW*ROWS/COLS};
  const pth=n.h*0.714;

  /* A WELL'S COLOUR is rampShade's, above: a hue off the ramp and a lightness
     on top of it, because 96 hues alone read as twelve colours dealt eight
     times — the repeated-barcode plate the header says this must not be. */
  const HUE=k=>rampShade(k,NW);

  /* GREEN IS THE LIP AND THE SKIRT, NOT THE DECK, and that is skirtSlab's job
     now: B3 receives this plate and has to draw the same green plastic, so the
     lip, the deck and the notch are one function rather than two copies that
     would drift. It hands back the deck, which is what the wells are laid on. */
  /* the plate and everything on it get a group of their own, because the
     plate is centred on the node's outline separately from the lens row —
     see ON ITS OWN, below */
  const gp=g.appendChild(el("g",{transform:"translate(0,0)"}));
  const deck=skirtSlab(gp,plate,pth,"var(--ch5)");

  /* ---- THE WELLS ----------------------------------------------------
     TWO DISCS PER WELL, not one. Dull-to-full is animated as a single
     opacity over a grey that never changes: fading the colour alone would
     leave a hole in the plastic, and fading it towards grey properly would
     mean rewriting 96 colour strings a frame for a change the reader only
     ever sees as brightness.

     THE LIQUID SITS AT 0.86 OF THE WELL, which is B1's inset and drawWell's
     own. The ring of plastic left showing IS the well wall, so a well drawn at
     0.88 here and 0.86 there is two different plates seen a tile apart — the
     one difference in the plastic that survives once the outline matches. */
  const DIM=.14;
  const wells=plateGrid(deck,pth,COLS,ROWS);
  const dots=[], shown=[];
  wells.forEach((w,k)=>{
    drawWell(gp,w,false);
    const rx=(w.e.rx*0.86).toFixed(2), ry=(w.e.ry*0.86).toFixed(2);
    gp.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,
      fill:"var(--fg3)","fill-opacity":".3"}));
    const e=el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,fill:HUE(k),"fill-opacity":DIM});
    gp.appendChild(e); dots.push(e); shown.push("");
  });

  /* THE THREE OPENED WELLS. Three different rows and three different columns,
     because two wells from one row would let a reader read the pair as a row
     effect; and taken in screen order left to right, so the tethers fan out to
     their own insets instead of crossing on the way up.

     THEY ARE ALSO A THIRD OF THE RAMP APART EACH, which is the furthest three
     of these 96 can be. The point being made is that the barcode differs by
     well, and it is made ENTIRELY by the three chips being three colours. Wells
     picked for where they sit and not for what colour they are came out half a
     stop apart on the first try — two chips of nearly the same orange, side by
     side, quietly unmaking the only claim the drawing has. */
  const SRC=[{i:2,j:7},{i:6,j:4},{i:10,j:1}]
    .map(p=>Math.min(NW-1, p.j*COLS+p.i))
    .sort((a,b)=>wells[a].e.x-wells[b].e.x);
  SRC.forEach(k=>{
    const s=wells[k].e;
    gp.appendChild(el("ellipse",{cx:s.x,cy:s.y,rx:(s.rx*2.1).toFixed(2),
      ry:(s.ry*2.1).toFixed(2),fill:"none",stroke:"var(--fg)",
      "stroke-width":".9","stroke-opacity":".8"}));
  });

  /* ---- THE CLOCK ----------------------------------------------------
     Declared before anything is built because the wells need it too: what a
     well waits for is the chip landing in its own inset, and that time is a
     sum of these. LAND is first now, so the plate finishes dealing its
     barcodes about when the last copy finishes running — the two halves of the
     frame end together instead of the plate waiting on the lenses. COPY is
     still more than half a pass because the thing this drawing is for is
     watching the copy get written. */
  const LAND=0.5, ARRIVE=0.55, COPY=3.4, HOLD=1.5, CLEAR=0.7;
  const SEQ=LAND+ARRIVE+COPY+HOLD+CLEAR, STAGGER=0.85;
  const RISE=0.45, PFADE=0.8, CYC=SEQ+2*STAGGER+1.1;

  /* ---- THREE INSETS, SIDE BY SIDE -----------------------------------
     Small against the plate on purpose, and spaced by rather more than their
     own width so the three read as a row of three rather than as one wide
     panel — they were nearly touching, and three lenses with a hairline
     between them is one strip that happens to be scalloped. Each is solid,
     because it is a magnification and not a window: the grid behind it is at a
     different scale and showing through would make the two read as one space.

     THE WHOLE LENS IS DRAWN AGAINST IN, NOT AGAINST SC. Everything inside one
     — cell, pores, strands, enzyme, chip, the letters on it — is authored in
     proportion to the lens and has to shrink with it, so the row shrinks by
     shrinking its unit rather than by twenty-odd numbers being retuned one at
     a time. It is still cut from n.w, so it grows on a resize like the rest.

     THE ROW SITS LOWER THAN IT DID for the same reason the plate is smaller:
     the lenses are the subject, and they were hanging forty pixels clear of a
     deck that had shrunk out from under them. The height is the one number
     here tuned against the plate rather than against the lens, so it moved
     when the plate did. */
  const IN=n.w*0.54;
  const c0=P(n.x,n.y,n.h);
  const IRX=23*IN, IRY=20*IN, IDX=58*IN, IY=c0[1]-60*IN;

  /* CENTRED, AS ASKED. The plate thrown forward and the lenses hung over it
     left the drawing up and to the left of the box it belongs to. So the
     layout above keeps every distance it had inside itself, and the whole of
     it is slid as one until the middle of what it draws — lens tops to the
     plate's near corner, and the plate's own screen x, which the lens row is
     centred on — sits on the middle of the node's box. Every term is read off
     n, so the centring holds at any size a corner is dragged to. */
  const pc=P(plate.x,plate.y,0);
  const low=P(plate.x+plate.w/2,plate.y+plate.d/2,0)[1];
  const mid=P(n.x,n.y,n.h/2);
  const TX=mid[0]-pc[0], TY=mid[1]-(IY-IRY+low)/2;
  g.setAttribute("transform",`translate(${TX.toFixed(2)},${TY.toFixed(2)})`);

  /* ON ITS OWN, AS ASKED NEXT. Slid with the lenses, the plate landed low in
     the node's dashed outline, hanging out of the bottom of the box it belongs
     to. So the lens row keeps the place the slide above gives it — that slide
     is still reckoned from where the plate WAS thrown, so nothing over the
     plate moves — and the plate alone is carried on until the middle of its
     slab sits on the middle of the outline. A flat translate of an isometric
     drawing is a move along the ground, so it is the same plate, only
     somewhere else; PX/PY are what a tether adds to a well to find it. */
  const pm=P(plate.x,plate.y,pth/2);
  const PX=mid[0]-TX-pm[0], PY=mid[1]-TY-pm[1];
  gp.setAttribute("transform",`translate(${PX.toFixed(2)},${PY.toFixed(2)})`);
  const OFFCD=2.4*IN;                   // the cDNA rail, below the template
  const BHW=6.3*IN;                     // half the chip, which the stub stops at
  /* s runs 0 at the far end to 1 at the AAA tail; off steps onto the cDNA rail */
  const at=(st,s,off)=>[st.ax+(st.bx-st.ax)*s,
                        st.y0+Math.sin(s*st.k*6.283+st.ph)*st.amp+(off||0)];
  const pathOf=(st,s0,s1,off,steps)=>{
    const p0=at(st,s0,off);
    if(Math.abs(s1-s0)<0.004) return `M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)}`;
    let d="";
    for(let i=0;i<=steps;i++){
      const p=at(st,s0+(s1-s0)*i/steps,off);
      d+=(i?" L ":"M ")+p[0].toFixed(2)+" "+p[1].toFixed(2);
    }
    return d;
  };
  const strand=(ax,bx,y0,amp,k)=>({ax,bx,y0,amp,k,ph:r()*6.283});
  /* the poly-A is spelled out rather than drawn: three bumps on a wavy line
     are three bumps, and the whole reason this end matters is that the
     barcoded primer is an oligo dT that finds it */
  const tail=(st,size,fill,op)=>{
    const t=at(st,1,0);
    const a=el("text",{x:(t[0]+0.8*IN).toFixed(2),y:(t[1]-size*0.55).toFixed(2),
      "font-size":size.toFixed(1),"letter-spacing":".3",fill,"fill-opacity":op});
    a.textContent="AAA"; g.appendChild(a);
  };

  const insets=SRC.map((sk,idx)=>{
    const src={x:wells[sk].e.x+PX, y:wells[sk].e.y+PY}, col=HUE(sk);
    /* centred on the PLATE's own screen centre, not the node's. The plate is
       thrown forward of the tile, which in this projection moves it left; a row
       hung off the tile centre leans off the far end of the deck it magnifies */
    const ix=P(plate.x,plate.y,pth)[0]+(idx-1)*IDX;

    /* THE TETHER. One line, in the well's own colour, stopping ON the ellipse
       rather than running under it: the inset is opaque and would hide the
       overrun, but a line that ends where it is supposed to end survives
       somebody making the inset translucent later. */
    const tdx=ix-src.x, tdy=IY-src.y;
    const tk=1/Math.hypot(tdx/IRX, tdy/IRY);
    g.appendChild(el("line",{x1:src.x.toFixed(2),y1:src.y.toFixed(2),
      x2:(ix-tdx*tk).toFixed(2),y2:(IY-tdy*tk).toFixed(2),
      stroke:col,"stroke-width":".9","stroke-opacity":".7"}));

    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:IRX.toFixed(2),ry:IRY.toFixed(2),fill:"var(--bg)","fill-opacity":"1",
      stroke:"var(--stroke)","stroke-width":"1.3","stroke-opacity":".9"}));
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:(IRX-2*IN).toFixed(2),ry:(IRY-2*IN).toFixed(2),fill:"var(--fg)",
      "fill-opacity":".04",stroke:"var(--stroke)","stroke-width":".5",
      "stroke-opacity":".3"}));

    /* THE CELL, AND THE HOLES IN IT. A dashed boundary would say the wall is
       not there; a solid wall with holes punched through it says the wall is
       there and things get across it, which is what permeabilisation is and
       the reason a barcoded primer can reach an mRNA that never left the
       cell. */
    const cy0=IY+1.2*IN, crx=IRX*0.80, cry=IRY*0.78;
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:cy0.toFixed(2),
      rx:crx.toFixed(2),ry:cry.toFixed(2),fill:"var(--g-top)","fill-opacity":".55",
      stroke:"var(--stroke)","stroke-width":"1.8","stroke-opacity":".75"}));
    const PORES=9;
    for(let i=0;i<PORES;i++){
      const a=(i+0.35+idx*0.3)*2*Math.PI/PORES;
      g.appendChild(el("circle",{cx:(ix+Math.cos(a)*crx).toFixed(2),
        cy:(cy0+Math.sin(a)*cry).toFixed(2),r:((0.9+r()*0.35)*IN).toFixed(2),
        fill:"var(--bg)",stroke:"var(--stroke)","stroke-width":".5",
        "stroke-opacity":".55"}));
    }

    /* THE TRANSCRIPTS THAT ARE NOT THE SUBJECT. Laid in lanes rather than
       scattered — at this size wandering strands placed at random cross each
       other more often than not, and a crossing reads as one strand — and kept
       thin and pale, because they are here to say the cell is full of RNA and
       not to be followed. */
    [[-11,-12.5,-3],[-6.5,-8,3],[7,-11.5,-1],[11,-6,3]].forEach(([vy,x0,x1])=>{
      const st=strand(ix+x0*IN, ix+x1*IN, cy0+vy*IN, 0.9*IN, 2.1);
      g.appendChild(el("path",{d:pathOf(st,0,1,0,16),fill:"none",stroke:"var(--fg)",
        "stroke-width":".8","stroke-opacity":".26","stroke-linecap":"round"}));
      tail(st,3.2*IN,"var(--fg3)",".7");
    });

    /* THE ONE THAT GETS COPIED comes forward: longer, darker, drawn over the
       rest. It still stops short of the membrane, because the chip has to have
       somewhere inside the cell to land. */
    const W=strand(ix-15.5*IN, ix+0.5*IN, cy0-1.5*IN, 1.9*IN, 1.5);
    g.appendChild(el("path",{d:pathOf(W,0,1,0,22),fill:"none",stroke:"var(--fg)",
      "stroke-width":"1.5","stroke-opacity":".5","stroke-linecap":"round"}));
    tail(W,4.6*IN,"var(--fg2)","1");

    /* THE COPY, AND WHAT WRITES IT. Born at the tail with nothing copied yet,
       so every element has a real position before the ticker touches it. */
    const cdna=el("path",{d:pathOf(W,1,1,OFFCD,2),fill:"none",stroke:"var(--signal)",
      "stroke-width":"1.8","stroke-opacity":".95","stroke-linecap":"round"});
    g.appendChild(cdna);
    const e0=at(W,1,OFFCD*0.5);
    const enz=el("g",{transform:`translate(${e0[0].toFixed(2)},${e0[1].toFixed(2)})`,
      opacity:"0"});
    enz.appendChild(el("ellipse",{cx:"0",cy:"0",rx:(3*IN).toFixed(2),
      ry:(2.3*IN).toFixed(2),fill:"var(--a-top)","fill-opacity":".95",
      stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".85"}));
    enz.appendChild(el("ellipse",{cx:(-0.9*IN).toFixed(2),cy:(-0.9*IN).toFixed(2),
      rx:(1.5*IN).toFixed(2),ry:(1.1*IN).toFixed(2),fill:"var(--a-left)",
      "fill-opacity":".9"}));
    g.appendChild(enz);

    /* THE BARCODE. Hard corners against the wandering line, and the well's
       exact colour against everything else in the frame — the chip is the one
       thing here that is not this cell's own, and both of those say so. Three
       insets means three of these, and no two of them are the same colour.
       It seats at the AAA end, which is where the loop now opens: the copy is
       written out of it rather than onto it. */
    const bcEnd=at(W,1,OFFCD);
    const BX=bcEnd[0]+10.5*IN, BY=bcEnd[1]+0.3*IN;
    const bc=el("g",{transform:`translate(${BX.toFixed(2)},${BY.toFixed(2)})`,
      opacity:"0"});
    bc.appendChild(el("rect",{x:(-BHW).toFixed(2),y:(-3.4*IN).toFixed(2),
      width:(BHW*2).toFixed(2),height:(6.8*IN).toFixed(2),fill:col,
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".9"}));
    const bt=el("text",{x:"0",y:(1.4*IN).toFixed(2),"text-anchor":"middle",
      "font-size":(4.2*IN).toFixed(1),"letter-spacing":".3",fill:"var(--bg)"});
    bt.textContent="BC1"; bc.appendChild(bt);
    g.appendChild(bc);
    /* the short stub joining chip to copy, so the two are one molecule */
    const link=el("line",{x1:bcEnd[0].toFixed(2),y1:bcEnd[1].toFixed(2),
      x2:(BX-BHW).toFixed(2),y2:BY.toFixed(2),stroke:col,
      "stroke-width":"1.8","stroke-opacity":"0","stroke-linecap":"round"});
    g.appendChild(link);

    return {W,cdna,enz,bc,link,BX,BY,delay:idx*STAGGER};
  });

  /* ---- WHEN EACH WELL COMES UP --------------------------------------
     The three tethered ones are pinned to the instant their own chip lands, so
     the inset and the well are one event seen at two scales. The other 93 come
     after all three, on a diagonal sweep with enough jitter on it to break the
     front: barcoding is not dealt across a plate in an order, and a tidy line
     crossing the wells would claim it is. */
  const onAt=wells.map(w=>LAND+STAGGER*2 +
    (w.i/COLS + w.j/ROWS)/2*1.4 + r()*0.8);
  SRC.forEach((k,i)=>{ onAt[k]=i*STAGGER+LAND; });

  /* ---- THE LOOP -----------------------------------------------------
     One clock, three insets reading it at their own offsets. They are out of
     step by less than a phase each, which is enough for a reader to catch that
     the three are separate events and not enough for any of them to be over
     before the eye gets there. */
  let T=r()*CYC;

  const run=(dt)=>{
    T=(T+dt)%CYC;

    /* THE PLATE. What has been written stays written until the end of the
       cycle and then goes out together: a well dimming on its own would read
       as its barcode coming back off. */
    const fade = T>CYC-PFADE ? 1-(T-(CYC-PFADE))/PFADE : 1;
    dots.forEach((e,k)=>{
      const o=(DIM+(1-DIM)*clamp((T-onAt[k])/RISE)*fade).toFixed(2);
      if(o!==shown[k]){ shown[k]=o; e.setAttribute("fill-opacity",o); }
    });

    insets.forEach(ins=>{
      const t=T-ins.delay;
      let u=1, op=0, bo=0, bu=0;
      if(t<0||t>SEQ)                  { u=1; op=0; }
      else if(t<LAND){
        bo=Math.min(1,t/(LAND*0.25));
        /* a short overshoot and settle: it arrives past its seat and comes
           back, which is what "locks on" looks like at this size */
        const v=t/LAND;
        bu = v<0.68 ? ease(v/0.68)*1.14 : 1.14-0.14*ease((v-0.68)/0.32);
      }
      /* the enzyme comes to a chip that is already seated, and the copy runs
         out from under it — u stays at 1 through ARRIVE, so the cDNA is a
         point at the primer until there is something to write */
      else if(t<LAND+ARRIVE){ bo=1; bu=1; op=(t-LAND)/ARRIVE; }
      else if(t<LAND+ARRIVE+COPY){
        bo=1; bu=1; op=1; u=1-(t-LAND-ARRIVE)/COPY;
      }
      else if(t<LAND+ARRIVE+COPY+HOLD){ u=0; op=1; bo=1; bu=1; }
      else{
        const v=(t-LAND-ARRIVE-COPY-HOLD)/CLEAR;
        u=0; op=1-v; bo=1-v; bu=1;
      }

      ins.cdna.setAttribute("d",pathOf(ins.W,1,u,OFFCD,20));
      ins.cdna.setAttribute("stroke-opacity",(0.95*op).toFixed(2));
      const p=at(ins.W,u,OFFCD*0.5);
      ins.enz.setAttribute("transform",
        `translate(${p[0].toFixed(2)},${p[1].toFixed(2)})`);
      ins.enz.setAttribute("opacity",op.toFixed(2));
      /* it comes in from up and to the right of its seat, so the landing reads
         as an arrival rather than as a fade-in */
      const bx=ins.BX+(1-bu)*9*IN, by=ins.BY-(1-bu)*8*IN;
      ins.bc.setAttribute("transform",`translate(${bx.toFixed(2)},${by.toFixed(2)})`);
      ins.bc.setAttribute("opacity",bo.toFixed(2));
      ins.link.setAttribute("x2",(bx-BHW).toFixed(2));
      ins.link.setAttribute("y2",by.toFixed(2));
      ins.link.setAttribute("stroke-opacity",
        (bo*Math.min(1,Math.max(0,bu-0.6)/0.4)).toFixed(2));
    });
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.reversetranscription = drawReverseTranscription;


/* ------------------------------------------------------------------
   ROUND TWO · LIGATION — the plate, and three of its wells opened up.

   B2'S COMPOSITION, AND NOW B6'S: a plate on the grid with lenses tethered
   to its wells. That arrangement is how this page says "the same thing
   happens in every well, and here is the one thing that happens", and with
   rounds one and three both drawn that way a compartment floating on its own
   in the middle read as a different KIND of step rather than as the middle of
   three.

   THREE CELLS, NOT ONE, AND THE THREE ARE AN ARGUMENT. One lens can show a
   bond forming; it cannot show why anybody would run a second round. Three
   can: the left two came out of the SAME round-one well and carry the same
   green BC1, so round one alone cannot tell them apart, and this round deals
   them into different wells and hands them different BC2s, so they are told
   apart from here on. The BC1 column repeats down the row. Every ROW of it
   is unique, and that is the whole of what combining barcodes buys.

   THREE LENSES, THREE WELLS, as asked. Every one of the 96 wells is a
   barcode of its own, and a BC2 colour repeated down the row read as two
   wells that shared one — the one thing this plate never does. So no two
   lenses are tethered to the same ring.

   THE PLASTIC IS BLUE. Round one is green, round three is yellow, and the
   colour lives on the lip and the skirt because that is where a semi-skirted
   plate carries it — skirtSlab takes the hue and the deck inside stays
   plastic. Same 1.032 x 0.688 plate and the same 96 wells as the other two,
   because it is the same piece of plastic in a third colour, and all of it
   is cut from this node's own w.

   LIGATION IS NOT TRANSCRIPTION, and the drawing has to say so on its own or
   the row reads as the same beat three times. B2 writes a copy: an enzyme
   walks a template and a new strand is drawn growing behind it, and the
   length of that growth IS the step. Nothing here is copied and no new
   strand is written. Two ends that already exist are joined — so nothing in
   this frame ever extends, and the motion is a piece coming in, two
   overhangs finding each other, and a gap closing.

   THE OVERHANGS ARE WHY THE GAP IS WIDE. A chip that slides up to another
   chip is two objects touching; single-stranded ends reaching across the
   space between them, bases on the fixed one pointing down and bases on the
   arriving one pointing up so the two interleave, are two ends that are
   complementary — which is the only reason this reaction is specific at all.
   The ligase comes down onto that overlap, and the gap closes UNDER it: the
   chips are pulled tight by the thing spanning them rather than by drifting
   the last of the way on their own.

   WHICH IS WHY THE SEAM IS DRAWN. Two blocks that end up touching read as
   one block slid alongside another; a mark left standing at the join says
   two pieces were sealed. It appears as the gap closes and it stays,
   because the bond stays, and it is the same tick B6 leaves at its own join
   so a reader who has seen one recognises the other. The overhangs go out
   with the ligase — they are what the bond was made of.

   THE CHIPS ARE DIFFERENT COLOURS AND THAT MISMATCH IS THE POINT. BC1 came
   out of a round-one well, the cells were pooled and dealt again, and BC2
   comes out of whichever well this cell landed in. A BC1 tinted from this
   plate's ramp would quietly say the two came from the same place, which is
   the one thing that is never true after a pool. So the BC1s are flat and
   cool — --ch5 for the two cells that share a round-one well, which is B6's
   first old chip so the same molecule seen two stations apart carries the
   same green, and --ch10 for the cell that does not — and the three wells
   this plate is read at are all warm, which keeps every chip on the row readable
   as "from this plate" or "from the last one" before its colour is compared
   to anything.

   WAVY MEANS NATIVE, HARD CORNERS MEAN ADDED — B2's rule, inherited. The
   RNA wanders, the cDNA copied off it wanders, and everything bolted on
   since sits on a level line and has corners. The overhangs are the one
   thing drawn between the two: level, because they are synthetic, but bare
   line and bases rather than a block, because they are not sealed yet.

   ONE PLATE, THREE LENSES, THREE JOINS a beat apart, and a long hold on the
   finished pairs. The step is a single bond; the frame the reader is here
   for is the one after all three have closed and the row of six chips can be
   read down.

   Requires skirtSlab / plateGrid / drawWell from the plate set, rampHue from
   the round-one plate, and ellipseAt() from the A2 clutch block. It spends
   --ch1..12, which are declared on /molecular_pipe and nowhere else; this
   shape is worn by that page alone.
   ------------------------------------------------------------------ */
function drawLigation(g0,n){
  /* one group, so the whole bench can be slid onto its box the way B2's is —
     see ON B2'S SCALE, below */
  const g=g0.appendChild(el("g",{transform:"translate(0,0)"}));
  const r=rng(1487);
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- THE PLATE ---------------------------------------------------
     Thrown forward of the node's own centre the way B2 and B6 throw theirs:
     behind is where the view hangs the name label, and a 96-well deck is
     wide enough to reach it. Depth comes off the grid rather than being
     authored, because square well pitch is the whole requirement and it is
     just width x rows / cols.

     B2'S FRACTIONS, NOT JUST B2'S PLATE. The tile is B2's size now, and the
     plate is cut from it with the same 0.712 and 0.714 B2 cuts its own with,
     so the two land on the same plastic at the same place on the same box. */
  const COLS=n.cols||12, ROWS=n.rows||8, NW=COLS*ROWS;
  const PW=n.w*0.712;
  const plate={x:n.x, y:n.y+n.d*0.30, w:PW, d:PW*ROWS/COLS};
  const pth=n.h*0.714;
  /* 96 wells, 96 colours, as asked: hue alone puts eight wells on every
     ramp stop, so this plate takes B2's lightness walk as well — rampShade,
     above — and a well here is the colour its twin is there */
  const HUE=k=>rampShade(k,NW);
  /* the plate and everything on it get a group of their own, because the
     plate is centred on the node's outline separately from the lens row —
     see ON ITS OWN, below, which is B2's move made again here */
  const gp=g.appendChild(el("g",{transform:"translate(0,0)"}));
  const deck=skirtSlab(gp,plate,pth,"var(--ch8)");

  /* ---- THE WELLS ----------------------------------------------------
     Two discs each, as the other two rounds lay them: a grey that never
     moves and the well's own colour over it at an opacity the ticker
     drives. Dull to full is then one number per well per frame, and a well
     that has not reacted yet reads as dim rather than as missing — there is
     ligase mix in all 96 from the start, and what changes is whether it has
     been spent.

     DIM IS HALF-LIT HERE, NOT B2's .14. Every well lights for barely two
     seconds of the cycle, and at .14 over the grey the difference between
     two neighbours falls to a fifth of what rampShade gave it: the plate sat
     as 96 of one grey for most of the loop, however unique the colours
     underneath. The BC2 in a well is there before any ligation, so its colour
     is honest at rest; spent is still the step from half to full. */
  const DIM=.5;
  const wells=plateGrid(deck,pth,COLS,ROWS);
  const dots=[], shown=[];
  wells.forEach((w,k)=>{
    drawWell(gp,w,false);
    const rx=(w.e.rx*0.86).toFixed(2), ry=(w.e.ry*0.86).toFixed(2);
    gp.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,
      fill:"var(--fg3)","fill-opacity":".3"}));
    const e=el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,fill:HUE(k),"fill-opacity":DIM});
    gp.appendChild(e); dots.push(e); shown.push("");
  });

  /* ---- THE THREE CELLS, AND THE THREE WELLS THEY CAME OUT OF --------
     Wells are named by row and column rather than by index, so ring, tether
     and BC2 chip cannot drift apart: all three read HUE() of the same number
     and there is one answer to what colour a well is.

     WHICH wells is not free. All three have to sit clear of the deck edges
     or a tether crawls across the plate to reach its lens, they have to lie
     left to right on screen in lens order or the tethers cross on the way
     up, and all three have to land warm on the ramp for the reason the
     header gives — and far enough apart on it that three BC2 chips read as
     three. Screen x on this plate is column minus row. Column four of row
     four sits at 0 and lands between --ch1 and --ch2, a salmon; column five
     of row two sits at 3 and lands on --ch3 flat, a gold; column ten of row
     five sits at 5 and lands on --ch12 leaning to --ch1 and lifted pale, a
     rose, which sits apart from the salmon both in hue and in lightness.

     The order of this list is the order the lenses sit in left to right, and
     it is the argument: same BC1 then different BC2, then a different BC1
     as well. */
  const WA=Math.min(NW-1, 3*COLS+3), WB=Math.min(NW-1, 1*COLS+4),
        WC=Math.min(NW-1, 4*COLS+9);
  const CELLS=[{well:WA, first:"var(--ch5)"},
               {well:WB, first:"var(--ch5)"},
               {well:WC, first:"var(--ch10)"}];
  CELLS.forEach(c=>{
    const s=wells[c.well].e;
    gp.appendChild(el("ellipse",{cx:s.x,cy:s.y,rx:(s.rx*2.1).toFixed(2),
      ry:(s.ry*2.1).toFixed(2),fill:"none",stroke:"var(--fg)",
      "stroke-width":".9","stroke-opacity":".8"}));
  });

  /* ---- THE CLOCK ----------------------------------------------------
     Slow, and most of it is the hold. Declared before anything is built
     because the plate needs it too: what a well waits for is the instant
     its own join closes. STAGGER is what keeps the three lenses from being
     one event drawn three times — under a phase apart each, which is enough
     for a reader to catch that they are separate and not enough for the
     first to be over before the eye gets to it. */
  const DRIFT=2.6, DOCK=0.9, SEAL=1.1, LIFT=0.8, HOLD=4.6, CLEAR=1.0;
  const SEALT=DRIFT+DOCK+SEAL, SEQ=SEALT+LIFT+HOLD+CLEAR;
  const STAGGER=0.9, END=SEQ+2*STAGGER;
  const RISE=0.5, CYC=END+0.6;

  /* ---- THE LENS ROW -------------------------------------------------
     Everything inside a lens is authored against IN and against nothing
     else, so the whole magnification resizes by one number instead of by
     forty tuned by hand; IN is cut from n.w, so it grows with the node.
     Three of them cost each one its old width, and the width they give up is
     the EMPTY part: the single lens was drawn a third wider than the molecule
     in it, and three of those reach far enough either side of this tile to
     land on the two pool-and-splits it sits between. So the glass is cropped
     to what it magnifies and the contents are left the size they were — the
     row now spans about twice the plate, which is the span B2's row of three
     takes, and everything inside a lens is bigger against its rim than it was
     when there was one. The spacing is B2's proportion too — about a fifth of
     a lens between two of them, which is what stops three lenses reading as
     one scalloped strip.

     ON B2'S SCALE, AS ASKED. The rounds sit side by side on one row, and a
     second lens row at its own size and height read as a different bench.
     So the unit, the glass and the spacing are B2's numbers exactly — which
     also makes a chip here the same size as a chip there — and the molecule,
     authored in IN, simply has a little more glass round it than it did. The
     whole drawing is then slid the way B2's is, until the middle of what it
     draws sits on the middle of the box; every term is read off n. */
  const IN=n.w*0.54;
  const c0=P(n.x,n.y,n.h);
  const IRX=23*IN, IRY=20*IN, IDX=58*IN, IY=c0[1]-60*IN;
  const cxp=P(plate.x,plate.y,pth)[0];
  const pc=P(plate.x,plate.y,0);
  const low=P(plate.x+plate.w/2,plate.y+plate.d/2,0)[1];
  const mid=P(n.x,n.y,n.h/2);
  const TX=mid[0]-pc[0], TY=mid[1]-(IY-IRY+low)/2;
  g.setAttribute("transform",`translate(${TX.toFixed(2)},${TY.toFixed(2)})`);

  /* ON ITS OWN, AS ASKED OF B2 AND THEN OF THIS BENCH. Slid with the lenses,
     the plate landed in the bottom corner of the node's dashed outline. The
     lens row keeps the place the slide above gives it — that slide is still
     reckoned from where the plate WAS thrown, so nothing over the plate moves
     — and the plate alone is carried on until the middle of its slab sits on
     the middle of the outline. A flat translate of an isometric drawing is a
     move along the ground, so it is the same plate, only somewhere else;
     PX/PY are what a tether adds to a well to find it. */
  const pm=P(plate.x,plate.y,pth/2);
  const PX=mid[0]-TX-pm[0], PY=mid[1]-TY-pm[1];
  gp.setAttribute("transform",`translate(${PX.toFixed(2)},${PY.toFixed(2)})`);

  /* ---- THE MOLECULE'S OWN RULER -------------------------------------
     x runs in IN from a lens centre, so every length below reads as a length
     in the drawing and the whole molecule is laid out in one vocabulary;
     only the emit converts to screen. Same helper B6 keeps: a wandering
     backbone with hard-cornered blocks bolted along it. */
  const mk=(ix,y,amp,k)=>({ix,y,amp,k,ph:r()*6.283});
  const at=(st,x)=>[st.ix+x*IN, st.y+Math.sin(x*st.k+st.ph)*st.amp*IN];
  const pathOf=(st,a,b,steps)=>{
    let d="";
    for(let i=0;i<=steps;i++){
      const p=at(st,a+(b-a)*i/steps);
      d+=(i?" L ":"M ")+p[0].toFixed(2)+" "+p[1].toFixed(2);
    }
    return d;
  };

  /* WHERE EVERY PIECE SITS, in IN along the level line. The gap is much
     wider than a hairline because the overhangs have to be legible inside
     it, and the chip pitch is what the two ends measure out to once it has
     closed. The whole molecule sits left of the lens centre, because the right
     of the lens is not spare: it is the run the adapter needs to come in
     through the membrane on. */
  const RNA0=-15.5, CDNA0=-9.8, CHIP0=-6.0;
  const CHW=3.6, CHP=7.6;                 // chip half-width, and chip to chip
  const bcx=k=>CHIP0+CHW+k*CHP;           // the centre of chip k, k = 0,1
  const BCR=bcx(0)+CHW;                   // BC1's far edge, where its end is
  const JOIN=BCR+0.2;                     // where the new end is welded on
  const AL=bcx(1)-CHW;                    // the adapter's near edge, seated
  const GAP=6.0;                          // how far short the adapter stops
  const OV=1.1;                           // how far past the midline each reaches

  /* a chip is drawn in its own coordinates and placed by a transform, so one
     description of a barcode serves all six of them */
  const chip=(host,cx,fill,label,sw)=>{
    const c=el("g",{transform:`translate(${cx.toFixed(2)},0)`});
    c.appendChild(el("rect",{x:(-CHW*IN).toFixed(2),y:(-3.2*IN).toFixed(2),
      width:(CHW*2*IN).toFixed(2),height:(6.4*IN).toFixed(2),fill,
      stroke:"var(--stroke)","stroke-width":sw,"stroke-opacity":".9"}));
    if(label){
      const t=el("text",{x:"0",y:(1.2*IN).toFixed(2),"text-anchor":"middle",
        "font-size":(3.1*IN).toFixed(2),"letter-spacing":".2",fill:"var(--bg)"});
      t.textContent=label; c.appendChild(t);
    }
    host.appendChild(c); return c;
  };

  /* AN OVERHANG: a backbone with a few bases hanging off it, drawn from a
     chip's edge outward. Which way the bases point is the entire content —
     down from the end that is waiting, up from the end that arrives, so the
     two interleave where they overlap instead of lying on top of each other,
     and a reader sees ends that FIT rather than ends that meet. Rebuilt
     every frame because its length is the animation. */
  const TEETH=3;
  const comb=(x0,dir,len,y,td)=>{
    let d=`M ${x0.toFixed(2)} ${y.toFixed(2)} `+
          `L ${(x0+dir*len).toFixed(2)} ${y.toFixed(2)}`;
    for(let i=0;i<TEETH;i++){
      const t=x0+dir*len*(i+0.4)/TEETH;
      d+=` M ${t.toFixed(2)} ${y.toFixed(2)}`+
         ` L ${t.toFixed(2)} ${(y+td*2.6*IN).toFixed(2)}`;
    }
    return d;
  };

  const insets=CELLS.map((cell,idx)=>{
    const src={x:wells[cell.well].e.x+PX, y:wells[cell.well].e.y+PY},
      col=HUE(cell.well);
    /* centred on the PLATE's own screen centre, not the node's. The plate is
       thrown forward of the tile, which in this projection moves it left; a
       row hung off the tile centre leans off the far end of the deck it
       magnifies. */
    const ix=cxp+(idx-1)*IDX;

    /* THE TETHER, in the well's own colour and stopping ON the ellipse
       rather than running under it: the lens is opaque and would hide an
       overrun, but a line that ends where it should survives somebody making
       the lens translucent later. */
    const tdx=ix-src.x, tdy=IY-src.y;
    const tk=1/Math.hypot(tdx/IRX, tdy/IRY);
    g.appendChild(el("line",{x1:src.x.toFixed(2),y1:src.y.toFixed(2),
      x2:(ix-tdx*tk).toFixed(2),y2:(IY-tdy*tk).toFixed(2),
      stroke:col,"stroke-width":".9","stroke-opacity":".7"}));

    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:IRX.toFixed(2),ry:IRY.toFixed(2),fill:"var(--bg)","fill-opacity":"1",
      stroke:"var(--stroke)","stroke-width":"1.1","stroke-opacity":".9"}));
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:(IRX-2*IN).toFixed(2),ry:(IRY-2*IN).toFixed(2),fill:"var(--fg)",
      "fill-opacity":".04",stroke:"var(--stroke)","stroke-width":".5",
      "stroke-opacity":".3"}));

    /* THE CELL, AND THE HOLES IN IT. B2's argument, still load-bearing a
       round later: a solid wall with holes punched through it says the wall
       is there and things get across it, which is why an adapter can reach a
       transcript that never left the cell. A dashed boundary would say the
       wall had gone, and it has not — the cell is fixed, it is intact, and
       it is the reason this is in-situ chemistry rather than a tube
       reaction. */
    const cy0=IY+1.0*IN, crx=IRX*0.86, cry=IRY*0.76;
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:cy0.toFixed(2),
      rx:crx.toFixed(2),ry:cry.toFixed(2),fill:"var(--g-top)",
      "fill-opacity":".55",stroke:"var(--stroke)","stroke-width":"1.8",
      "stroke-opacity":".75"}));
    const PORES=10;
    for(let i=0;i<PORES;i++){
      const a=(i+0.6+idx*0.3)*2*Math.PI/PORES;
      g.appendChild(el("circle",{cx:(ix+Math.cos(a)*crx).toFixed(2),
        cy:(cy0+Math.sin(a)*cry).toFixed(2),r:((0.85+r()*0.3)*IN).toFixed(2),
        fill:"var(--bg)",stroke:"var(--stroke)","stroke-width":".5",
        "stroke-opacity":".55"}));
    }

    /* THE TRANSCRIPTS THAT ARE NOT THE SUBJECT — laid in lanes rather than
       scattered, because at this size strands placed at random cross more
       often than not and a crossing reads as one strand. Thin and pale: they
       are here to say the cell is full of RNA, not to be followed. */
    [[-8.0,-12,-3],[-5.6,2,11],[7.2,-12,0],[9.2,3,10]].forEach(([vy,a,b])=>{
      const st=mk(ix, cy0+vy*IN, 0.85, 0.42);
      g.appendChild(el("path",{d:pathOf(st,a,b,18),fill:"none",stroke:"var(--fg)",
        "stroke-width":".8","stroke-opacity":".22","stroke-linecap":"round"}));
    });

    /* ---- THE ONE THIS IS ABOUT --------------------------------------
       Forward, longer and darker than the rest, and read left to right it is
       what round one left behind: native RNA, the copy that was written off
       it, and one chip on the end. THE WAVE STOPS AT THE CHIP. Only the RNA
       and the copy wander; from there on the backbone is level, because
       everything on it is synthetic and a hard-cornered block riding a sine
       reads as a block that has come loose. */
    const M=mk(ix, cy0+2.0*IN, 1.6, 0.40);
    const BY=at(M,CHIP0)[1];              // the level line the blocks sit on

    g.appendChild(el("path",{d:pathOf(M,RNA0,CDNA0,16),fill:"none",
      stroke:"var(--fg)","stroke-width":"1.6","stroke-opacity":".5",
      "stroke-linecap":"round"}));
    /* the copy round one wrote. It is finished and it is not touched here —
       this step happens on its far end and nothing is added to its length */
    g.appendChild(el("path",{d:pathOf(M,CDNA0,CHIP0,14),fill:"none",
      stroke:"var(--signal)","stroke-width":"2","stroke-opacity":".95",
      "stroke-linecap":"round"}));

    /* BC1, already on the end and going nowhere again, so it is drawn
       straight onto the level line rather than into a group of its own. It
       is LABELLED now, which it was not when there was one lens: with two
       different BC1s down the row a reader has to be able to say which round
       a chip came from before comparing its colour to the one beside it. */
    const old=el("g",{transform:`translate(${ix.toFixed(2)},${BY.toFixed(2)})`});
    chip(old,bcx(0)*IN,cell.first,"BC1",".8");
    g.appendChild(old);

    /* ---- THE ADAPTER ------------------------------------------------
       One chip and nothing else. Round three's adapter is worth a group of
       three parts because it carries three; this one carries a barcode, and
       drawing it as anything more would spend B6's beat a station early.

       Born out at its drift start with real coordinates, so the ticker only
       ever has to move it and nothing here is created at the origin. */
    const adapt=el("g",{transform:`translate(${ix.toFixed(2)},${BY.toFixed(2)})`,
      opacity:"0"});
    chip(adapt,bcx(1)*IN,col,"BC2","1");
    g.appendChild(adapt);

    /* THE TWO ENDS THAT HAVE TO FIND EACH OTHER. Each in its own chip's
       colour, so a reader can see which end belongs to which barcode while
       they are still apart, and both born at zero length on the edge they
       grow out of. */
    const fixed=el("path",{d:comb(ix+BCR*IN,1,0,BY,1),fill:"none",
      stroke:cell.first,"stroke-width":".65","stroke-opacity":"0",
      "stroke-linecap":"round"});
    g.appendChild(fixed);
    const free=el("path",{d:comb(ix+(AL+GAP)*IN,-1,0,BY,-1),fill:"none",
      stroke:col,"stroke-width":".65","stroke-opacity":"0",
      "stroke-linecap":"round"});
    g.appendChild(free);

    /* THE SEAM. A bond between two synthetic blocks is not invisible and the
       drawing must not pretend it is: without a mark left at the join, two
       chips that end up touching read as one chip that slid alongside
       another. It stands slightly proud of both, it arrives with the last of
       the gap, and it stays — the bond stays. It is B6's tick to the number:
       one unit wide and 4.2 either side, so the mark at round two's join and
       the mark at round three's are the same mark. */
    const seam=el("line",{x1:(ix+JOIN*IN).toFixed(2),y1:(BY-4.2*IN).toFixed(2),
      x2:(ix+JOIN*IN).toFixed(2),y2:(BY+4.2*IN).toFixed(2),stroke:"var(--fg)",
      "stroke-width":"1","stroke-opacity":"0","stroke-linecap":"round"});
    g.appendChild(seam);

    /* THE LIGASE, last so it sits over everything. It comes down ONTO the
       overlap rather than fading in on it, works while the gap closes, and
       lifts straight off — the arrival and the departure are what make it an
       agent rather than a decoration. It rides above the line instead of
       across it so the pair of ends it is working on is never hidden by the
       thing working on them, and it is deliberately small: one enzyme making
       one bond, against B2's polymerase which is drawn walking a whole
       template. */
    const lig=el("g",{opacity:"0",
      transform:`translate(${(ix+JOIN*IN).toFixed(2)},${(BY-4.8*IN).toFixed(2)})`});
    lig.appendChild(el("ellipse",{cx:"0",cy:"0",rx:(3.4*IN).toFixed(2),
      ry:(2.6*IN).toFixed(2),fill:"var(--a-top)","fill-opacity":".95",
      stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".85"}));
    lig.appendChild(el("ellipse",{cx:(-1.0*IN).toFixed(2),cy:(-1.0*IN).toFixed(2),
      rx:(1.7*IN).toFixed(2),ry:(1.2*IN).toFixed(2),fill:"var(--a-left)",
      "fill-opacity":".9"}));
    g.appendChild(lig);

    return {ix,BY,adapt,fixed,free,seam,lig,delay:idx*STAGGER};
  });

  /* ---- WHEN EACH WELL COMES UP --------------------------------------
     A tethered well is pinned to the instant its own join closes, so the
     well and the lens are one event seen at two scales. The other wells
     follow all three on a diagonal wash with enough jitter to break the
     front — ligation is not dealt across a plate in an order, and a tidy
     line would claim it is. */
  const onAt=wells.map(w=>SEALT+2*STAGGER+0.4+(w.i/COLS+w.j/ROWS)/2*1.6+r()*0.8);
  CELLS.forEach((c,i)=>{ onAt[c.well]=SEALT+i*STAGGER; });

  /* ---- THE LOOP -----------------------------------------------------
     One pass per lens, a beat apart: the adapter drifts in through the
     membrane and stops short, both ends reach out into the space between
     them, the ligase comes down on the overlap, the gap goes — slowly and
     then all at once, because that is what a bond forming looks like — the
     seam is left behind, the ligase lifts with the overhangs it spent, and
     then nothing moves for four and a half seconds. The hold IS the point:
     three cells, six chips, and no two rows the same. */
  let T=r()*CYC;
  const run=(dt)=>{
    T=(T+dt)%CYC;

    /* what has been written stays written until CLEAR and then the whole
       plate goes out with the lenses, on the same second: a well dimming on
       its own would read as its barcode coming back off */
    const fade=clamp(1-(T-(END-CLEAR))/CLEAR);
    dots.forEach((e,k)=>{
      const o=(DIM+(1-DIM)*clamp((T-onAt[k])/RISE)*fade).toFixed(2);
      if(o!==shown[k]){ shown[k]=o; e.setAttribute("fill-opacity",o); }
    });

    insets.forEach(ins=>{
      const t=T-ins.delay;
      let op=0, u=1, gap=GAP, lg=0, sm=0, rch=0;
      if(t<0||t>SEQ){ /* born, seated, and waiting its turn */ }
      else if(t<DRIFT){
        op=Math.min(1,t/(DRIFT*0.30));
        /* it arrives past its seat and comes back, which is what drifting up
           against something looks like at this size */
        const v=t/DRIFT;
        u = v<0.72 ? ease(v/0.72)*1.05 : 1.05-0.05*ease((v-0.72)/0.28);
        /* the ends only reach once there is something to reach for */
        rch=clamp((v-0.45)/0.50);
      }
      else if(t<DRIFT+DOCK){ op=1; rch=1; lg=clamp((t-DRIFT)/(DOCK*0.7)); }
      else if(t<SEALT){
        op=1; lg=1; rch=1;
        const v=(t-DRIFT-DOCK)/SEAL;
        gap=GAP*(1-ease(v)); sm=clamp((v-0.55)/0.45);
      }
      else if(t<SEALT+LIFT){
        const v=(t-SEALT)/LIFT; op=1; gap=0; sm=1; lg=1-ease(v); rch=1-v;
      }
      else if(t<SEQ-CLEAR){ op=1; gap=0; sm=1; }
      else { const v=(t-(SEQ-CLEAR))/CLEAR; op=1-v; gap=0; sm=1-v; }

      const dx=gap*IN+(1-u)*4.5*IN, dy=-(1-u)*5*IN;
      ins.adapt.setAttribute("transform",
        `translate(${(ins.ix+dx).toFixed(2)},${(ins.BY+dy).toFixed(2)})`);
      ins.adapt.setAttribute("opacity",op.toFixed(2));
      ins.seam.setAttribute("stroke-opacity",(sm*0.75).toFixed(2));

      /* EACH END REACHES TO THE MIDLINE AND A HAIR PAST IT, so the two
         overlap by the same amount whatever the gap is doing — the overlap
         is the thing being sealed, and it has to survive the gap closing
         under it rather than being squeezed out at the last moment. They
         wander while they are free and go still once the ligase is on
         them. */
      const half=(gap*IN)/2+OV*IN;
      const wag=Math.sin((T+ins.delay)*6.5)*0.6*IN*(1-lg);
      ins.fixed.setAttribute("d",
        comb(ins.ix+BCR*IN,1,half*rch,ins.BY+wag,1));
      ins.free.setAttribute("d",
        comb(ins.ix+(AL*IN+dx),-1,half*rch,ins.BY+dy-wag,-1));
      const ro=(rch*op*0.9).toFixed(2);
      ins.fixed.setAttribute("stroke-opacity",ro);
      ins.free.setAttribute("stroke-opacity",ro);

      /* it tracks the join while the join is still moving, and never quite
         holds still while it is working */
      const jig=Math.sin(T*11)*0.5*IN*lg;
      ins.lig.setAttribute("transform",
        `translate(${(ins.ix+(JOIN+gap*0.5)*IN).toFixed(2)},`+
        `${(ins.BY-4.8*IN+jig-(1-lg)*7*IN).toFixed(2)})`);
      ins.lig.setAttribute("opacity",(lg*op).toFixed(2));
    });
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.ligation = drawLigation;


/* ------------------------------------------------------------------
   ROUND THREE · LIGATION — the plate, and three of its wells opened up.

   IT IS B4'S DRAWING WITH A THIRD CHIP ON IT. Rounds two and three are one
   operation run twice, and a reader who has just watched B4 should not be
   able to find a difference that is not a difference in the chemistry. So
   everything that is not round three's own business is B4's number and not
   a near miss: the same lens radii, spacing and height over the deck, the
   same cell at the same fraction of its lens, the same ten pores, the same
   four background transcripts, the same RNA wandering at the same rate and
   going level at the first chip, the same pair of overhangs, the same
   ligase, the same seam at 4.2 either side of the join. What is left over
   is what round three actually adds, and that is all this shape gets to
   spend on being itself.

   THE PLASTIC IS YELLOW, and that is the one thing here deliberately not
   matched. Round one is green, round two is blue, round three is yellow —
   the same 1.032 x 0.688 semi-skirted plate and the same 96 wells all three
   times, because it is the same piece of plastic in a third colour. The
   colour lives on the lip and the skirt because that is where a plate
   carries it, so skirtSlab takes --ch3 and the deck inside stays plastic;
   B5 deals into "round three's yellow one" and says so in its own code. The
   yellow is a TINT over lit plastic and never a flat fill: the one
   saturated warm thing in this frame is the biotin.

   THREE LENSES ON THREE WELLS, AS B4 HAS. B4's three cells are an argument
   about what a pair of chips separates that one chip cannot. Round three's
   is simpler: the barcode DIFFERS by well, and three cells that pooled
   together and split apart carry the same first two chips and leave with
   three different third ones. 48 x 96 x 96 is a number written on the deck;
   this is what that number looks like from inside a cell, and it is not a
   claim one example or one well can make.

   SO BC1 AND BC2 ARE THE SAME IN ALL THREE, AND MUTED. They are history — a
   barcode stops being the news the moment the next lands on it — and a
   reader comparing three lenses has to be able to see at a glance that only
   the last block changes. Their hues belong to no plate on screen, because
   those plates are two and four stations back.

   WHAT ARRIVES IS ONE PIECE CARRYING THREE THINGS, which is the reason this
   step is worth its own drawing rather than a second run of B4's. The
   adapter brings the third barcode, the Illumina Read 2 sequence behind it,
   and a biotin at the very end — one bond, three consequences, two of them
   spent stations later. So they drift in inside ONE group under ONE
   transform and never move relative to each other; the Read 2 bar and the
   tag then draw themselves OUTWARD from the sealed join, after the ligase
   has lifted, because there is no room to bring them in through the
   membrane at full length and because what they are is what the bond just
   bought.

   THE BIOTIN IS THE ONLY WARM COLOUR INSIDE A CELL, on purpose. A magnetic
   bead closes on this exact tag at B8, and if it does not register here that
   capture reads as arbitrary. That is what picks the three wells: all three
   are on the cool side of the ramp, so no chip in any lens competes with the
   tag. See the well-picking block for why that is a statement about
   diagonals.

   THE OVERHANGS ARE WHY THE GAP IS WIDE — B4's reasoning, and it does not
   stop being true a round later. A chip that slides up to another chip is
   two objects touching; single-stranded ends reaching across the space
   between them, bases on the fixed one pointing down and bases on the
   arriving one pointing up so the two interleave, are two ends that are
   complementary, which is the only reason this reaction is specific at all.
   The ligase comes down onto that overlap and the gap closes UNDER it, and
   the overhangs go out with the ligase because they are what the bond was
   made of. The gap here is shorter than B4's for one reason: this molecule
   already carries two chips, so the run of lens left to the right of the
   join is the run the adapter has to arrive on, and it is a chip narrower.

   WAVY MEANS NATIVE, HARD CORNERS MEAN ADDED — B2's rule, inherited. The RNA
   wanders; everything stuck to it since sits on a level line and has corners.
   The overhangs are the one thing drawn between the two: level, because they
   are synthetic, but bare line and bases rather than a block, because they
   are not sealed yet.

   AND THE MULTIPLICATION IS WRITTEN DOWN, off the front of the plate. It is
   the one fact on this row that is arithmetic rather than chemistry, and no
   upstream box can carry it: each plate on its own is just another plate, and
   only here are there three of them to multiply.

   Requires skirtSlab / plateGrid / drawWell from the plate set, rampHue from
   the round-one plate, pooledMix from the pool-and-split bench, and
   ellipseAt() from the A2 clutch block. It spends
   --ch1..12, which are declared on /molecular_pipe and nowhere else; this
   shape is worn by that page alone.
   ------------------------------------------------------------------ */
function drawLigation3(g0,n){
  /* one group, so the whole bench can be slid onto its box the way B4's is —
     see ON B4'S SCALE, below */
  const g=g0.appendChild(el("g",{transform:"translate(0,0)"}));
  const r=rng(2311);
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- THE PLATE ---------------------------------------------------
     Thrown forward of the node's own centre the way B2 throws its own:
     behind is where the view hangs the name label, and a 96-well deck is
     wide enough to reach it. Depth comes off the grid rather than being
     authored, because square well pitch is the entire requirement and it is
     just width x rows / cols.

     B5'S RECEIVING PLATE, SIZE AND LIP. This is the plate B5 deals into,
     and the page asked for it to arrive at the size it left: B5 draws it at
     1.72 of its own 1.5 wide, which is 1.7793 of this tile's 1.45, and at
     B5's h — 0.714 of this one's. The lip was already B5's --ch3; at the old
     0.712 it was too thin a rim to read as the same yellow, and at this
     size it does. Still cut from w, so a resize carries it.

     THAT SEAT IS NOW AN ANCHOR AND NOT WHERE THE PLATE IS DRAWN. The
     bench's slide was composed off it, and the page asked for the plate
     alone to move — into the middle of the node's own box, where it had
     sat in the bottom corner. So the seat keeps fixing the slide, and the
     plate is placed afterwards, once the slide is known, as whatever world
     position puts its centre on the box's centre on screen. The lens row
     and the callout are then hung off the PLATE, because at B5's size it
     reaches past everything the seat used to leave room for. IN and the
     lens radii come up here with it, because the slide is cut from them. */
  const COLS=n.cols||12, ROWS=n.rows||8, NW=COLS*ROWS;
  const PW=n.w*1.7793;
  const seat={x:n.x, y:n.y+n.d*0.30, w:PW, d:PW*ROWS/COLS};
  const pth=n.h*0.714;
  const HUE=k=>rampHue(k,NW);
  const IN=n.w*0.54;
  const IRX=23*IN, IRY=20*IN, IDX=58*IN;
  const c0=P(n.x,n.y,n.h), IY0=c0[1]-60*IN;
  const mid=P(n.x,n.y,n.h/2);
  const TX=mid[0]-P(seat.x,seat.y,0)[0];
  const TY=mid[1]-(IY0-IRY+P(seat.x+seat.w/2,seat.y+seat.d/2,0)[1])/2;
  g.setAttribute("transform",`translate(${TX.toFixed(2)},${TY.toFixed(2)})`);
  /* the screen miss between the seat's centre and the box's, turned back
     into world x and y by undoing P — sx is x-y, sy is x+y */
  const pm=P(seat.x,seat.y,pth/2);
  const su=(mid[0]-TX-pm[0])/(S*C30), sv=(mid[1]-TY-pm[1])/(S*0.5);
  const plate={x:seat.x+(su+sv)/2, y:seat.y+(sv-su)/2, w:seat.w, d:seat.d};
  const deck=skirtSlab(g,plate,pth,"var(--ch3)");
  /* the lens row stands just clear of the plate's far corner. The lenses are
     opaque, and a row left at the height the small plate allowed would sit
     on the back three rows of wells — two of the tethered ones among them */
  const IY=P(plate.x-plate.w/2,plate.y-plate.d/2,pth)[1]-IRY-3*IN;

  /* ---- THE WELLS ----------------------------------------------------
     Two discs each: B5's pooled mixture, which never moves, and the well's
     own colour over it at an opacity the ticker drives. THE MIXTURE IS B5'S
     PAINT AT B5'S STRENGTH, because this is the plate B5 dealt into and it
     has to arrive looking the way B5 left it — every well the same blend,
     none of them placed yet. Unreacted to ligated is then one number per
     well per frame, starting from nothing: what changes is not whether a
     well has liquid in it but whether that liquid has a third barcode. */
  const DIM=0;
  const MIX=pooledMix(g);
  const wells=plateGrid(deck,pth,COLS,ROWS);
  const dots=[], shown=[];
  wells.forEach((w,k)=>{
    drawWell(g,w,false);
    const rx=(w.e.rx*0.86).toFixed(2), ry=(w.e.ry*0.86).toFixed(2);
    g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,
      fill:MIX.fill,"fill-opacity":MIX.op}));
    const e=el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,fill:HUE(k),"fill-opacity":DIM});
    g.appendChild(e); dots.push(e); shown.push("");
  });

  /* THE THREE OPENED WELLS, named by row and column rather than by index, so
     that a ring, a tether and a third chip cannot drift apart: all three read
     HUE(k) and there is one answer to what colour a well is.

     WHICH THREE IS NOT A FREE CHOICE, twice over. They have to be cool, or a
     chip goes warm and the biotin stops being the only warm thing in its own
     lens. And they have to be far apart on the ramp, or two of the three
     third barcodes come out nearly the same colour and the drawing quietly
     unmakes the only claim it is making. On this walk a well's hue is set by
     i - j — the whole diagonal shifts by one twelfth of a stop per step — so
     both of those are demands about WHICH DIAGONAL: -6 lands on violet, +4
     on blue, +9 on teal. Three rows and three columns, none repeated, then
     spread them across the deck, and taken in screen order the tethers fan
     out instead of crossing on the way up. */
  const SRC=[{i:0,j:6},{i:8,j:4},{i:11,j:2}]
    .map(p=>Math.min(NW-1, p.j*COLS+p.i))
    .sort((a,b)=>wells[a].e.x-wells[b].e.x);
  SRC.forEach(k=>{
    const s=wells[k].e;
    g.appendChild(el("ellipse",{cx:s.x,cy:s.y,rx:(s.rx*2.1).toFixed(2),
      ry:(s.ry*2.1).toFixed(2),fill:"none",stroke:"var(--fg)",
      "stroke-width":".9","stroke-opacity":".8"}));
  });

  /* ---- THE CLOCK ----------------------------------------------------
     B4's beats to the number, with round three's two extra ones taken out of
     the hold rather than added to the pass: the two shapes run the same
     length, so the row does not have one station visibly slower than the one
     beside it. Declared before anything is built because the wells need it
     too — what a well waits for is the instant its own join closes. */
  const DRIFT=2.6, DOCK=0.9, SEAL=1.1, LIFT=0.8;
  const EXTEND=0.8, TAG=0.4, HOLD=3.4, CLEAR=1.0;
  const SEALT=DRIFT+DOCK+SEAL, LIFTT=SEALT+LIFT;
  const EXTT=LIFTT+EXTEND, TAGT=EXTT+TAG, SEQ=TAGT+HOLD+CLEAR;
  const STAGGER=0.9, END=SEQ+2*STAGGER;
  const RISE=0.5, CYC=END+0.6;

  /* ---- THE MOLECULE, MEASURED ONCE ----------------------------------
     x runs in IN from a lens centre, so every length below reads as a length
     in the drawing and the whole molecule is laid out in one vocabulary;
     only the emit converts to screen. All three lenses hold the same
     molecule, so it is measured out here rather than three times inside the
     loop.

     THE LENS IS B4'S, RIM AND ALL. B4 cropped its glass to what it magnifies
     when it went to three, and a lens here that stayed at B2's radius would
     make the same figure two sizes on two neighbouring tiles. So IN, the
     radii, the spacing and the height over the deck are copied across, and
     what gives instead is the molecule: the chips are narrower than B4's
     because three of them and a tail have to live where two did.

     THE RIGHT-HAND END IS THE BINDING CONSTRAINT and not the left. The tag
     has to land INSIDE the membrane — it is what a bead grabs at B8, and a
     tag drawn on the wall would say the cell had already gone — and at 17.1
     against a cell half-width of 18.1 it clears by about a base. Everything
     to the right of the join is measured backwards from that.

     ON B4'S SCALE, AS ASKED. B4 has since taken B2's unit, glass, spacing
     and row height, and a lens row left on the old numbers read as a
     smaller bench beside it. So those are B4's numbers exactly again, the
     molecule — authored in IN — just has a little more glass round it, and
     the whole drawing is slid onto the middle of its box the way B4's is.
     Those numbers and the slide are set up with the plate's seat, above. */
  const RNA0=-15.6, CDNA0=-11.5, CHIP0=-7.0;
  const CHW=3.0, CHP=6.4, CHH=3.2;        // chip half-width, pitch, half-height
  const bcx=k=>CHIP0+CHW+k*CHP;           // the centre of chip k, k = 0,1,2
  const BCR=bcx(1)+CHW;                   // BC2's far edge, where its end is
  const JOIN=BCR+0.2;                     // where the adapter is welded on
  const AL=bcx(2)-CHW;                    // the adapter's near edge, seated
  const GAP=4.5;                          // how far short the adapter stops
  const OV=1.1;                           // how far past the midline each reaches
  const BAR0=bcx(2)+CHW, BARL=3.6;        // Read 2, drawn out of the sealed join
  const TAGX=BAR0+BARL+0.7, TAGR=1.1;
  const GOLD="color-mix(in oklab, var(--ch2) 45%, var(--ch3))";
  /* THE TWO ALREADY ON THE STRAND. Mixed towards --fg3 rather than drawn at
     full strength: they are the same in all three lenses, and three lenses
     differing in one block out of three is a comparison a reader can only
     make if the other two step back.

     BC1 IS B4'S BC1. B4 draws the chip a cell brought out of round one as
     flat --ch5, so the same molecule seen two stations apart carries the same
     green and only the strength moves. BC2 is the one hue that cannot follow
     B4: there it is the round-two well's own colour, and all three of those
     wells are warm — which is fine on a tile with no biotin in it and not fine
     here, where a warm block in the lens would take the tag's job. So it
     keeps a cool --ch7 and stands for "the chip from the last plate" rather
     than for a particular well of it. */
  const OLD=["color-mix(in oklab, var(--ch5) 62%, var(--fg3))",
             "color-mix(in oklab, var(--ch7) 62%, var(--fg3))"];

  /* B4's helper, signature and all: a wandering backbone with hard-cornered
     blocks bolted along it, the state carrying its own lens centre */
  const mk=(ix,y,amp,k)=>({ix,y,amp,k,ph:r()*6.283});
  const at=(st,x)=>[st.ix+x*IN, st.y+Math.sin(x*st.k+st.ph)*st.amp*IN];
  const pathOf=(st,a,b,steps)=>{
    let d="";
    for(let i=0;i<=steps;i++){
      const p=at(st,a+(b-a)*i/steps);
      d+=(i?" L ":"M ")+p[0].toFixed(2)+" "+p[1].toFixed(2);
    }
    return d;
  };
  /* a chip is drawn in its own coordinates and placed by a transform, so one
     description of a barcode serves all nine of them. It is B4's block to the
     height — only the width gives, because three have to stand where two do */
  const chip=(host,cx,fill,label,sw)=>{
    const c=el("g",{transform:`translate(${cx.toFixed(2)},0)`});
    c.appendChild(el("rect",{x:(-CHW*IN).toFixed(2),y:(-CHH*IN).toFixed(2),
      width:(CHW*2*IN).toFixed(2),height:(CHH*2*IN).toFixed(2),fill,
      stroke:"var(--stroke)","stroke-width":sw,"stroke-opacity":".9"}));
    const t=el("text",{x:"0",y:(1.0*IN).toFixed(2),"text-anchor":"middle",
      "font-size":(2.6*IN).toFixed(2),"letter-spacing":".2",fill:"var(--bg)"});
    t.textContent=label; c.appendChild(t);
    host.appendChild(c); return c;
  };

  /* AN OVERHANG, B4's exactly: a backbone with a few bases hanging off it,
     drawn from a chip's edge outward. Which way the bases point is the entire
     content — down from the end that is waiting, up from the end that
     arrives, so the two interleave where they overlap instead of lying on top
     of each other, and a reader sees ends that FIT rather than ends that
     meet. Rebuilt every frame because its length is the animation. */
  const TEETH=3;
  const comb=(x0,dir,len,y,td)=>{
    let d=`M ${x0.toFixed(2)} ${y.toFixed(2)} `+
          `L ${(x0+dir*len).toFixed(2)} ${y.toFixed(2)}`;
    for(let i=0;i<TEETH;i++){
      const t=x0+dir*len*(i+0.4)/TEETH;
      d+=` M ${t.toFixed(2)} ${y.toFixed(2)}`+
         ` L ${t.toFixed(2)} ${(y+td*2.6*IN).toFixed(2)}`;
    }
    return d;
  };

  /* ---- THREE LENSES, SIDE BY SIDE -----------------------------------
     Solid, because each is a magnification and not a window: what is behind
     it is at a different scale, and showing through would make the two read
     as one space. Centred on the PLATE's own screen centre and not the
     node's — the plate is thrown forward of the tile, which in this
     projection moves it left, and a row hung off the tile centre leans off
     the far end of the deck it magnifies. */
  const insets=SRC.map((sk,idx)=>{
    const src=wells[sk].e, col=HUE(sk);
    const ix=P(seat.x,seat.y,pth)[0]+(idx-1)*IDX;

    /* THE TETHER, in the well's own colour and stopping ON the ellipse
       rather than running under it: the lens is opaque and would hide an
       overrun, but a line that ends where it should survives somebody making
       the lens translucent later. */
    const tdx=ix-src.x, tdy=IY-src.y;
    const tk=1/Math.hypot(tdx/IRX, tdy/IRY);
    g.appendChild(el("line",{x1:src.x.toFixed(2),y1:src.y.toFixed(2),
      x2:(ix-tdx*tk).toFixed(2),y2:(IY-tdy*tk).toFixed(2),
      stroke:col,"stroke-width":".9","stroke-opacity":".7"}));

    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:IRX.toFixed(2),ry:IRY.toFixed(2),fill:"var(--bg)","fill-opacity":"1",
      stroke:"var(--stroke)","stroke-width":"1.1","stroke-opacity":".9"}));
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:IY.toFixed(2),
      rx:(IRX-2*IN).toFixed(2),ry:(IRY-2*IN).toFixed(2),fill:"var(--fg)",
      "fill-opacity":".04",stroke:"var(--stroke)","stroke-width":".5",
      "stroke-opacity":".3"}));

    /* THE CELL, AND THE HOLES IN IT. Round one's argument, still
       load-bearing two rounds later: a solid wall with holes punched through
       it says the wall is there and things get across it, which is why an
       adapter can reach a transcript that never left the cell. A dashed
       boundary would say the wall had gone, and this is the last step before
       it does. B4's proportions and B4's ten pores — the cell is the one
       thing on this row that has no business changing between rounds. */
    const cy0=IY+1.0*IN, crx=IRX*0.86, cry=IRY*0.76;
    g.appendChild(el("ellipse",{cx:ix.toFixed(2),cy:cy0.toFixed(2),
      rx:crx.toFixed(2),ry:cry.toFixed(2),fill:"var(--g-top)",
      "fill-opacity":".55",stroke:"var(--stroke)","stroke-width":"1.8",
      "stroke-opacity":".75"}));
    const PORES=10;
    for(let i=0;i<PORES;i++){
      const a=(i+0.6+idx*0.3)*2*Math.PI/PORES;
      g.appendChild(el("circle",{cx:(ix+Math.cos(a)*crx).toFixed(2),
        cy:(cy0+Math.sin(a)*cry).toFixed(2),r:((0.85+r()*0.3)*IN).toFixed(2),
        fill:"var(--bg)",stroke:"var(--stroke)","stroke-width":".5",
        "stroke-opacity":".55"}));
    }

    /* THE TRANSCRIPTS THAT ARE NOT THE SUBJECT — laid in lanes rather than
       scattered, because at this size strands placed at random cross more
       often than not and a crossing reads as one strand. Thin and pale: they
       are here to say the cell is full of RNA, not to be followed. */
    [[-8.0,-12,-3],[-5.6,2,11],[7.2,-12,0],[9.2,3,10]].forEach(([vy,a,b])=>{
      const st=mk(ix, cy0+vy*IN, 0.85, 0.42);
      g.appendChild(el("path",{d:pathOf(st,a,b,18),fill:"none",
        stroke:"var(--fg)","stroke-width":".8","stroke-opacity":".22",
        "stroke-linecap":"round"}));
    });

    /* ---- THE ONE THAT IS FINISHED -----------------------------------
       Forward, longer and darker than the rest, and read left to right it is
       the history of this cell in one line: native RNA, the copy round one
       wrote, then one chip per round. THE WAVE STOPS AT THE FIRST CHIP. Only
       the RNA and the copy wander; from there on the backbone is level,
       because everything on it is synthetic and a hard-cornered block riding
       a sine reads as a block that has come loose.

       Its phase is drawn per lens, so the three read as three cells rather
       than as one cell printed three times. */
    const M=mk(ix, cy0+2.0*IN, 1.6, 0.40);
    const BY=at(M,CHIP0)[1];                // the level line the blocks sit on

    g.appendChild(el("path",{d:pathOf(M,RNA0,CDNA0,16),fill:"none",
      stroke:"var(--fg)","stroke-width":"1.6","stroke-opacity":".5",
      "stroke-linecap":"round"}));
    /* the copy round one wrote — the only other bright thing on the line */
    g.appendChild(el("path",{d:pathOf(M,CDNA0,CHIP0,14),fill:"none",
      stroke:"var(--signal)","stroke-width":"2","stroke-opacity":".95",
      "stroke-linecap":"round"}));

    /* the two already on the end, drawn on the level line rather than inside
       a group of their own: they are not going anywhere again */
    const old=el("g",{transform:`translate(${ix.toFixed(2)},${BY.toFixed(2)})`});
    chip(old,bcx(0)*IN,OLD[0],"BC1",".8");
    chip(old,bcx(1)*IN,OLD[1],"BC2",".8");
    g.appendChild(old);

    /* ---- THE ADAPTER, WHICH IS ONE PIECE ----------------------------
       Chip, bar and tag live in ONE group under ONE transform. That is the
       claim the group exists to make: they are not three things that happen
       to land at the same moment, they are three parts of a single oligo,
       and a reader who sees them arrive separately has been told something
       untrue. Born out at its drift start with real coordinates, so the
       ticker only ever has to move it and nothing here starts at the origin. */
    const adapt=el("g",{transform:`translate(${ix.toFixed(2)},${BY.toFixed(2)})`,
      opacity:"0"});

    /* the Read 2 sequence: plain, grey, unlabelled and thinner than a chip,
       because that is what it is — a fixed handle every fragment will carry
       rather than an address. Its width is what EXTEND drives, out of zero,
       so it never has to be flown in through a membrane it would not fit
       through; by the time it draws, the ligase that shares its grey has
       already lifted. */
    const bar=el("rect",{x:(BAR0*IN).toFixed(2),y:(-1.5*IN).toFixed(2),
      width:"0",height:(3.0*IN).toFixed(2),fill:"var(--a-top)",
      "fill-opacity":".9",stroke:"var(--stroke)","stroke-width":".7",
      "stroke-opacity":".8"});
    adapt.appendChild(bar);
    chip(adapt,bcx(2)*IN,col,"BC3","1");

    /* THE BIOTIN. Small, warm, and the last thing that moves. Drawn as a
       drop with its tip lying back along the bar, so it hangs off the end
       instead of sitting on it; the circle behind it is the flash and fades
       within half a second of landing. */
    const R=TAGR*IN;
    const drop=el("g",{transform:`translate(${(TAGX*IN).toFixed(2)},0)`,
      opacity:"0"});
    const flash=el("circle",{cx:"0",cy:"0",r:(R*2.6).toFixed(2),
      fill:"var(--ch2)","fill-opacity":"0"});
    drop.appendChild(flash);
    drop.appendChild(el("path",{d:
      `M ${(-2.05*R).toFixed(2)} 0 `+
      `C ${(-0.9*R).toFixed(2)} ${(-0.95*R).toFixed(2)} `+
        `${(-0.2*R).toFixed(2)} ${(-R).toFixed(2)} ${(0.25*R).toFixed(2)} ${(-0.72*R).toFixed(2)} `+
      `C ${(0.9*R).toFixed(2)} ${(-0.42*R).toFixed(2)} `+
        `${(0.9*R).toFixed(2)} ${(0.42*R).toFixed(2)} ${(0.25*R).toFixed(2)} ${(0.72*R).toFixed(2)} `+
      `C ${(-0.2*R).toFixed(2)} ${R.toFixed(2)} `+
        `${(-0.9*R).toFixed(2)} ${(0.95*R).toFixed(2)} ${(-2.05*R).toFixed(2)} 0 Z`,
      fill:GOLD,stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".7"}));
    adapt.appendChild(drop);
    g.appendChild(adapt);

    /* THE TWO ENDS THAT HAVE TO FIND EACH OTHER. Each in its own chip's
       colour — the waiting one in BC2's muted green, because that is the
       chip it grows out of, and the arriving one in this well's own — and
       both born at zero length on the edge they grow out of. */
    const fixed=el("path",{d:comb(ix+BCR*IN,1,0,BY,1),fill:"none",
      stroke:OLD[1],"stroke-width":".65","stroke-opacity":"0",
      "stroke-linecap":"round"});
    g.appendChild(fixed);
    const free=el("path",{d:comb(ix+(AL+GAP)*IN,-1,0,BY,-1),fill:"none",
      stroke:col,"stroke-width":".65","stroke-opacity":"0",
      "stroke-linecap":"round"});
    g.appendChild(free);

    /* THE SEAM. A bond between two synthetic blocks is not invisible and the
       drawing should not pretend it is: the join stays marked once it
       closes, one tick standing slightly proud of the chips either side of
       it, so the reader can see where round two ends and round three
       begins. It is B4's tick to the number — one unit wide and 4.2 either
       side — so the mark at round two's join and the mark at round three's
       are the same mark. */
    const seam=el("line",{x1:(ix+JOIN*IN).toFixed(2),y1:(BY-4.2*IN).toFixed(2),
      x2:(ix+JOIN*IN).toFixed(2),y2:(BY+4.2*IN).toFixed(2),stroke:"var(--fg)",
      "stroke-width":"1","stroke-opacity":"0","stroke-linecap":"round"});
    g.appendChild(seam);

    /* THE LIGASE, last so it sits over everything, and B4's enzyme unchanged:
       it comes down ONTO the overlap rather than fading in on it, works while
       the gap closes, and lifts straight off. It rides above the line so the
       pair of ends it is working on is never hidden by the thing working on
       them, and it leaves before the Read 2 bar draws — one enzyme, one bond,
       and then the consequences. */
    const lig=el("g",{opacity:"0",
      transform:`translate(${(ix+JOIN*IN).toFixed(2)},${(BY-4.8*IN).toFixed(2)})`});
    lig.appendChild(el("ellipse",{cx:"0",cy:"0",rx:(3.4*IN).toFixed(2),
      ry:(2.6*IN).toFixed(2),fill:"var(--a-top)","fill-opacity":".95",
      stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".85"}));
    lig.appendChild(el("ellipse",{cx:(-1.0*IN).toFixed(2),cy:(-1.0*IN).toFixed(2),
      rx:(1.7*IN).toFixed(2),ry:(1.2*IN).toFixed(2),fill:"var(--a-left)",
      "fill-opacity":".9"}));
    g.appendChild(lig);

    return {ix,BY,adapt,bar,drop,flash,fixed,free,seam,lig,delay:idx*STAGGER};
  });

  /* ---- WHEN EACH WELL COMES UP --------------------------------------
     The three tethered ones are pinned to the instant their own join closes,
     so a lens and its well are one event seen at two scales. The other 93
     follow all three, on a diagonal wash with enough jitter to break the
     front — ligation is not dealt across a plate in an order, and a tidy
     line crossing the wells would claim it is. */
  const onAt=wells.map(w=>SEALT+2*STAGGER+0.4+(w.i/COLS+w.j/ROWS)/2*1.6+r()*0.8);
  SRC.forEach((k,i)=>{ onAt[k]=SEALT+i*STAGGER; });

  /* ---- THE CALLOUT --------------------------------------------------
     Off the front of the plate rather than under the node's centre: the
     lane's own track runs down-right through the middle of the tile, and
     anything hung straight below it lands on the track. Measured off the
     PLATE and not the seat: at B5's size the seat's old spot is under B5's
     own receiving plate, and the one clear ground left is just in front of
     this plate's nearest corner, between that plate and the track. */
  const base=P(plate.x+plate.w*0.45, plate.y+plate.d, 0), FS=6.6*IN;
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const say=(dy,txt,col,weight)=>{
    const t=el("text",{x:base[0].toFixed(1),y:(base[1]+dy).toFixed(1),
      "text-anchor":"middle","font-family":MONO,"font-size":FS.toFixed(2),
      "letter-spacing":(FS*0.04).toFixed(2),fill:col,"font-weight":weight});
    t.textContent=txt; g.appendChild(t);
  };
  say(0,           "48 × 96 × 96","var(--fg3)","500");
  say(FS*1.35,"= 442,368 paths","var(--fg2)","600");

  /* ---- THE LOOP -----------------------------------------------------
     One clock, three lenses reading it at their own offsets, and B4's pass
     with a tail on it: the adapter drifts in through the membrane and stops
     short, both ends reach out into the space between them, the ligase comes
     down on the overlap, the gap goes — slowly and then all at once, because
     that is what a bond forming looks like — the seam is left behind and the
     ligase lifts with the overhangs it spent. Only then does round three
     collect on the bond: the Read 2 bar draws out of the sealed join and the
     tag lands and flashes. Then nothing moves for three and a half seconds,
     and that hold is the point — all three up at once, and only the last
     block differing. */
  let T=r()*CYC;
  const run=(dt)=>{
    T=(T+dt)%CYC;

    /* what has been written stays written until CLEAR and then the whole
       plate goes out with the lenses, on the same second: a well dimming on
       its own would read as its barcode coming back off */
    const fade=clamp(1-(T-(END-CLEAR))/CLEAR);
    dots.forEach((e,k)=>{
      const o=(DIM+(1-DIM)*clamp((T-onAt[k])/RISE)*fade).toFixed(2);
      if(o!==shown[k]){ shown[k]=o; e.setAttribute("fill-opacity",o); }
    });

    insets.forEach(ins=>{
      const t=T-ins.delay;
      let op=0, u=1, gap=GAP, lg=0, sm=0, rch=0, ext=0, tag=0, fl=0;
      if(t<0||t>SEQ){ /* born, seated, and waiting its turn */ }
      else if(t<DRIFT){
        op=Math.min(1,t/(DRIFT*0.30));
        /* it arrives past its seat and comes back, which is what drifting up
           against something looks like at this size */
        const v=t/DRIFT;
        u = v<0.72 ? ease(v/0.72)*1.05 : 1.05-0.05*ease((v-0.72)/0.28);
        /* the ends only reach once there is something to reach for */
        rch=clamp((v-0.45)/0.50);
      }
      else if(t<DRIFT+DOCK){ op=1; rch=1; lg=clamp((t-DRIFT)/(DOCK*0.7)); }
      else if(t<SEALT){
        op=1; lg=1; rch=1;
        const v=(t-DRIFT-DOCK)/SEAL;
        gap=GAP*(1-ease(v)); sm=clamp((v-0.55)/0.45);
      }
      else if(t<LIFTT){
        const v=(t-SEALT)/LIFT; op=1; gap=0; sm=1; lg=1-ease(v); rch=1-v;
      }
      else if(t<EXTT){ op=1; gap=0; sm=1; ext=ease((t-LIFTT)/EXTEND); }
      else if(t<TAGT){
        op=1; gap=0; sm=1; ext=1;
        const v=(t-EXTT)/TAG; tag=Math.min(1,v/0.35); fl=1-v;
      }
      else if(t<SEQ-CLEAR){ op=1; gap=0; sm=1; ext=1; tag=1; }
      else { const v=(t-(SEQ-CLEAR))/CLEAR;
        op=1-v; gap=0; sm=1-v; ext=1; tag=1-v; }

      /* one transform for the whole adapter: chip, bar and tag never move
         relative to each other, which is the claim the group exists to make */
      const dx=gap*IN+(1-u)*3.0*IN, dy=-(1-u)*5*IN;
      ins.adapt.setAttribute("transform",
        `translate(${(ins.ix+dx).toFixed(2)},${(ins.BY+dy).toFixed(2)})`);
      ins.adapt.setAttribute("opacity",op.toFixed(2));
      ins.bar.setAttribute("width",(BARL*ext*IN).toFixed(2));
      ins.drop.setAttribute("opacity",tag.toFixed(2));
      ins.flash.setAttribute("fill-opacity",(clamp(fl)*0.55).toFixed(2));
      ins.seam.setAttribute("stroke-opacity",(sm*0.75).toFixed(2));

      /* EACH END REACHES TO THE MIDLINE AND A HAIR PAST IT, so the two
         overlap by the same amount whatever the gap is doing — the overlap is
         the thing being sealed, and it has to survive the gap closing under
         it rather than being squeezed out at the last moment. They wander
         while they are free and go still once the ligase is on them. */
      const half=(gap*IN)/2+OV*IN;
      const wag=Math.sin((T+ins.delay)*6.5)*0.6*IN*(1-lg);
      ins.fixed.setAttribute("d",
        comb(ins.ix+BCR*IN,1,half*rch,ins.BY+wag,1));
      ins.free.setAttribute("d",
        comb(ins.ix+(AL*IN+dx),-1,half*rch,ins.BY+dy-wag,-1));
      const ro=(rch*op*0.9).toFixed(2);
      ins.fixed.setAttribute("stroke-opacity",ro);
      ins.free.setAttribute("stroke-opacity",ro);

      /* it tracks the join while the join is still moving, and never quite
         holds still while it is working */
      const jig=Math.sin(T*11)*0.5*IN*lg;
      ins.lig.setAttribute("transform",
        `translate(${(ins.ix+(JOIN+gap*0.5)*IN).toFixed(2)},`+
        `${(ins.BY-4.8*IN+jig-(1-lg)*7*IN).toFixed(2)})`);
      ins.lig.setAttribute("opacity",(lg*op).toFixed(2));
    });
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.ligation3 = drawLigation3;


/* ==================================================================
   THE POOL-AND-SPLIT BENCH KIT — a conical and a pipette, shared.

   Two stations on this row are the same operation at two moments, so
   they have to be the same glassware: a difference in the tube between
   B3 and B5 would read as a different vessel rather than the same one
   used twice. Both were drawn inside B3 first; they are lifted out here
   the moment a second station needed them, rather than copied, because
   a copy is where the two would start to drift.

   Requires ellipseAt / arcPts from the clutch block.
   ================================================================== */

/* A 15 ml conical, which is what the protocol actually pools into. Straight
   wall for most of its length, a short cone under it, a threaded collar at the
   top and a small flat foot instead of a point — a tube that tapers to nothing
   has to be drawn either balancing on its tip or half-buried in a rack, and a
   rack would hide the first transfers, which are the ones worth seeing.
   Every radius is a multiple of `w` and every height a multiple of `h`, so the
   whole tube grows with the node that owns it. Returns the group, the rim and
   foot the caller has to aim at, and the two things only the inside of a tube
   can do: carry a level, and be swirled. */
function conicalTube(g, tx, ty, w, h){
  const TR=w*0.20, IR=TR*0.88, BR=TR*0.30, CR=TR*1.16,
        ZC=h*2.0, ZN=h*7.9, ZT=h*8.4;
  /* the whole tube is one group so the swirl can lean it about its foot;
     nothing outside it — the plates, the tip — moves with it */
  const tube=el("g",{}); g.appendChild(tube);
  const rim  =ellipseAt(tx,ty,ZT,CR),
        col  =ellipseAt(tx,ty,ZN,CR),
        neck =ellipseAt(tx,ty,ZN,TR),
        sh   =ellipseAt(tx,ty,ZC,TR),
        shIn =ellipseAt(tx,ty,ZC,IR),
        base =ellipseAt(tx,ty,0,BR),
        baseIn=ellipseAt(tx,ty,0,BR*0.85);
  const silh=pts([[rim.x+rim.rx,rim.y],[col.x+col.rx,col.y],[neck.x+neck.rx,neck.y],
    [sh.x+sh.rx,sh.y],...arcPts(base,0,Math.PI,10),[sh.x-sh.rx,sh.y],
    [neck.x-neck.rx,neck.y],[col.x-col.rx,col.y],[rim.x-rim.rx,rim.y],
    ...arcPts(rim,Math.PI,2*Math.PI,18)]);
  tube.appendChild(el("polygon",{points:silh,fill:"var(--g-top)","fill-opacity":".38"}));

  const liquid=el("polygon",{points:pts(arcPts(baseIn,Math.PI,0,10)),
    fill:"var(--fg)","fill-opacity":".24"});
  tube.appendChild(liquid);
  const men=el("ellipse",{cx:rim.x,cy:rim.y,rx:"0",ry:"0",
    fill:"var(--fg)","fill-opacity":"0"});
  tube.appendChild(men);

  const ZMAX=ZT-h*0.85;                     // it fills to the last graduation, not the collar
  const T={tube, rim, base, ZT, surfY:base.y};
  let surf0=null;                           // where the meniscus sits before any slosh
  let liqOp=".24";                          // the column's opacity, which setTint may replace
  T.setLevel=(f,band,fresh)=>{
    const z=Math.max(0.0005,Math.min(1,f)*ZMAX);
    const rAt=z>=ZC ? IR : BR*0.85+(IR-BR*0.85)*(z/ZC);
    const surf=ellipseAt(tx,ty,z,rAt);
    /* the top edge is the FAR side of the surface ellipse, so the body of the
       liquid contains the whole disc you are looking down onto; the meniscus
       below only tints it */
    const top=arcPts(surf,2*Math.PI,Math.PI,14), bot=arcPts(baseIn,Math.PI,0,10);
    liquid.setAttribute("points",pts(z<=ZC
      ? [...top,...bot]
      : [...top,[shIn.x-shIn.rx,shIn.y],...bot,[shIn.x+shIn.rx,shIn.y]]));
    liquid.setAttribute("fill-opacity",f>0.004?liqOp:"0");
    men.setAttribute("cx",surf.x.toFixed(1)); men.setAttribute("cy",surf.y.toFixed(1));
    men.setAttribute("rx",surf.rx.toFixed(2)); men.setAttribute("ry",surf.ry.toFixed(2));
    /* the surface carries the colour of whatever went in last, and loses it
       into the mixture within half a second — the pool is not four things */
    if(band) men.setAttribute("fill",band.fill);
    men.setAttribute("fill-opacity",(band?0.1+0.45*fresh:0).toFixed(2));
    T.surfY=surf.y; surf0=surf;
  };
  /* WHAT IS IN THE TUBE IS THE CALLER'S BUSINESS, not the glassware's. The same
     conical stands at three stations here and what it holds is not the same
     thing each time: a grey suspension at one, ninety-six barcoded populations
     at another. The default is what every caller drew before this existed, so
     one that never asks is unchanged. */
  T.setTint=(fill,op)=>{ liqOp=op.toFixed(2); liquid.setAttribute("fill",fill);
    if(liquid.getAttribute("fill-opacity")!=="0")
      liquid.setAttribute("fill-opacity",liqOp); };
  T.setLevel(0,null,0);

  /* GRADUATIONS, up the near side. A column of liquid rising inside a plain
     cylinder reads as a colour change; the same column against a scale reads
     as a volume, which is the thing every transfer is adding up to. They are
     drawn over the liquid, because they are marks on the wall you are looking
     through. Twelve of them rather than six, because the wall they are marking
     is twice as long and six would leave them a finger apart. */
  for(let i=1;i<=12;i++){
    const z=ZC+(ZMAX-ZC)*(i/12), maj=i%2===0;
    tube.appendChild(el("polyline",{
      points:pts(arcPts(ellipseAt(tx,ty,z,TR),0.04*Math.PI,(maj?0.42:0.20)*Math.PI,5)),
      fill:"none",stroke:"var(--stroke)","stroke-width":maj?".9":".7",
      "stroke-opacity":maj?".6":".4"}));
  }

  tube.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
    "stroke-width":"1","stroke-opacity":".8"}));
  tube.appendChild(el("polyline",{points:pts(arcPts(col,0,Math.PI,12)),fill:"none",
    stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".55"}));
  tube.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,fill:"none",
    stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".85"}));

  /* THE SWIRL. `a` is an envelope the caller starts and ends at zero so nothing
     snaps when the mixing begins or stops, and `ph` is the turn. The tube leans
     about its foot: a real hand swirls the top round a small circle, and in this
     projection the sideways half of that circle is all you would see anyway, so
     a lean is an honest reading of it and keeps the tube standing on the floor.
     The surface then trails the wall by a fifth of a turn, which is the part
     that reads as liquid — but as an offset of the meniscus disc only, a
     fraction of its own radius. Leaning the liquid separately from the tube
     would swing its edge straight through the wall it is meant to be inside. */
  const SW_LEAN=5;
  T.swirl=(a,ph)=>{
    tube.setAttribute("transform",`rotate(${(a*SW_LEAN*Math.cos(ph)).toFixed(2)},`+
      `${base.x.toFixed(1)},${base.y.toFixed(1)})`);
    if(!a || !surf0) return;                // at rest the meniscus is wherever setLevel put it
    /* sideways it may travel about a fifth of its own radius and no more: the
       bore is only a tenth wider than the surface, so a bigger offset shows the
       disc through the glass rather than under it */
    men.setAttribute("cx",(surf0.x-a*0.22*surf0.rx*Math.cos(ph-0.9)).toFixed(1));
    men.setAttribute("cy",(surf0.y-a*0.30*surf0.ry*Math.sin(ph-0.9)).toFixed(1));
  };
  return T;
}

/* the plastic, hoisted out of the single-channel the moment the twelve-channel
   below wanted the same skin: two tools off one bench have to be one colour */
const TIP_SKIN={fill:"var(--t-top)","fill-opacity":".95",stroke:"var(--stroke)",
                "stroke-width":".8","stroke-opacity":".85"};

/* THE TIP IS DRAWN IN SCREEN PIXELS, so it cannot scale by reading w — it
   scales by being scaled. `sc` is the owning node's size against the size this
   glyph was drawn for, which is 1 at the authored width and grows with the
   object like everything else. Without it the plate doubles and the tip working
   it stays the same size, which is what "the pipette didn't grow" was.
   Returns the group the caller places by transform, and the column of liquid
   inside it, which is the only part of a pipette that has anything to say. */
function pipetteGlyph(g, sc){
  const pip=el("g",{}), tilt=el("g",{transform:`rotate(-15) scale(${sc.toFixed(3)})`});
  /* leading zeros on every coordinate, because the checkers read a `d` with a
     regex and "-.55" parses as 55 — a phantom point a long way from the tip */
  tilt.appendChild(el("path",{d:"M -0.55 -1 L 0.55 -1 L 1.5 -7 L -1.5 -7 Z", ...TIP_SKIN}));
  tilt.appendChild(el("path",{d:"M -1.5 -7 L 1.5 -7 L 2.1 -17.5 L -2.1 -17.5 Z", ...TIP_SKIN}));
  tilt.appendChild(el("path",{d:"M -2.7 -17.5 L 2.7 -17.5 L 2.2 -27 L -2.2 -27 Z", ...TIP_SKIN}));
  const load=el("path",{d:"M -0.85 -2.6 L 0.85 -2.6 L 1.6 -7.6 L -1.6 -7.6 Z",
    fill:"var(--fg)","fill-opacity":"0"});
  tilt.appendChild(load);
  pip.appendChild(tilt); g.appendChild(pip);
  return {pip, load};
}

/* THE TWELVE-CHANNEL — the tool a pool and split is actually done with. Same
   plastic and the same screen pixels as the single-channel above, so the two
   read as one bench; what it adds is the comb and the manifold across the top
   of it.

   `step` IS THE PLATE'S OWN WELL PITCH, handed in as the screen vector from one
   well of a row to the next. It has to be handed in rather than authored: a
   comb built on a constant lands in twelve wells at the size it was drawn for
   and between them at every other size, which is the same failure as a tip that
   does not grow. It also carries the direction — on this projection a row runs
   down-screen to the right rather than across, so the head has to lean along
   it. The comb is centred on the group's origin, so placing the head over the
   middle of a row puts every tip in its own well and the caller never has to
   aim a channel.

   EVERYTHING ABOVE THE TIPS IS DRAWN IN THE TIPS' OWN TILTED FRAME — the same
   rotation applied to body coordinates as to tip ones — because a manifold that
   does not lean with the plastic hanging off it reads as two tools.
   Returns the group the caller places, and one liquid column per channel. */
function multiGlyph(g, sc, nch, step){
  const pip=el("g",{}), half=(nch-1)/2, loads=[];
  for(let i=0;i<nch;i++){
    const o=i-half;
    const ch=el("g",{transform:
      `translate(${(o*step[0]).toFixed(2)},${(o*step[1]).toFixed(2)})`});
    const tilt=el("g",{transform:`rotate(-15) scale(${sc.toFixed(3)})`});
    /* one disposable tip: the cone and the shank that grips the nose. Slimmer
       and shorter than the single-channel's, and it has to be — at a plate's
       pitch a dozen tips of that width is one wedge of plastic rather than
       twelve tips. Leading zeros for the same reason as above. */
    tilt.appendChild(el("path",{d:"M -0.40 -1 L 0.40 -1 L 0.95 -6 L -0.95 -6 Z",
      ...TIP_SKIN}));
    tilt.appendChild(el("path",{d:"M -0.95 -6 L 0.95 -6 L 1.30 -15 L -1.30 -15 Z",
      ...TIP_SKIN}));
    const load=el("path",{d:"M -0.60 -2.4 L 0.60 -2.4 L 1.05 -6.8 L -1.05 -6.8 Z",
      fill:"var(--fg)","fill-opacity":"0"});
    tilt.appendChild(load);
    ch.appendChild(tilt); pip.appendChild(ch); loads.push(load);
  }
  /* `k` is in channel units along the comb, dx and dy in tilted-frame pixels
     across and up it, so the body is stated in the units each part is really
     measured in: the nose plate spans channels, the barrel spans plastic. */
  const A=-15*Math.PI/180, CA=Math.cos(A), SA=Math.sin(A);
  const at=(k,dx,dy)=>{ const X=dx*sc, Y=dy*sc;
    return [(k*step[0]+X*CA-Y*SA).toFixed(2), (k*step[1]+X*SA+Y*CA).toFixed(2)]; };
  const quad=(...p)=>pip.appendChild(el("polygon",{points:pts(p),...TIP_SKIN}));
  /* the nose plate, overhanging the end tips the way a real one does */
  quad(at(-half-0.7,0,-14.6), at(half+0.7,0,-14.6),
       at( half+0.7,0,-18.6), at(-half-0.7,0,-18.6));
  /* the barrel and the plunger over it, which is what makes the silhouette a
     multichannel rather than a rake. A real one stands half again as tall as
     its comb is wide; this one is nowhere near that, on purpose — the comb here
     is already two thirds of the plate it works, and an honestly proportioned
     body would be the tallest thing on the row and read as a prop rather than
     as the tool doing the work. */
  quad(at(0,-3.8,-18.2), at(0,3.8,-18.2), at(0,3.3,-30.0), at(0,-3.3,-30.0));
  quad(at(0,-1.5,-30.0), at(0,1.5,-30.0), at(0,1.5,-35.5), at(0,-1.5,-35.5));
  g.appendChild(pip);
  return {pip, loads};
}

/* ---- THE FLOW FAN --------------------------------------------------------
   A bundle of curved lines running between a bank of vessels and the mouth of
   one tube: the figure that says "all of this goes into that", or "that goes
   back out into all of this". B5 invented it for its own three beats and B7
   wants the same figure with different endpoints, so it is lifted out here
   the moment the second station needed it rather than copied — the same rule
   conicalTube above is here for, and for the same reason.

   THE ENDPOINTS ARE HANDED IN, not a plate. B5's are the wells of a row and
   B7's are the mouths of eight tubes, and the fan has no business knowing
   which; all it owns is the curve, the chevron and the bead.

   The curve bows upward, which is what makes an inward fan read as collection
   into a mouth rather than as a dozen wires crossing. The chevron sits at the
   middle of its own line rather than at the end: a dozen arrowheads meeting at
   one mouth are a blot, and a mark halfway along says which way the line runs
   without crowding either end of it. `hue` is per line, because the two halves
   of a pool and split say different things about their own colour — many
   channels arriving and one pool leaving, or the exact reverse. */
const fanBez=(A,C,B,t)=>{ const u=1-t;
  return [u*u*A[0]+2*u*t*C[0]+t*t*B[0], u*u*A[1]+2*u*t*C[1]+t*t*B[1]]; };

function flowLine(g, A, B, col, SC){
  const C=[(A[0]+B[0])/2, (A[1]+B[1])/2-10*SC];
  const line=el("path",{d:`M ${A[0].toFixed(1)} ${A[1].toFixed(1)} `+
    `Q ${C[0].toFixed(1)} ${C[1].toFixed(1)} ${B[0].toFixed(1)} ${B[1].toFixed(1)}`,
    fill:"none",stroke:col,"stroke-width":"1",
    "stroke-opacity":"0","stroke-linecap":"round"});
  g.appendChild(line);
  const m=fanBez(A,C,B,0.55), m2=fanBez(A,C,B,0.63);
  const chev=el("path",{d:"M -3.4 -2.7 L 0 0 L -3.4 2.7",fill:"none",
    stroke:col,"stroke-width":"1.1","stroke-opacity":"0",
    "stroke-linecap":"round","stroke-linejoin":"round",
    transform:`translate(${m[0].toFixed(1)},${m[1].toFixed(1)}) `+
      `rotate(${(Math.atan2(m2[1]-m[1],m2[0]-m[0])*180/Math.PI).toFixed(1)}) `+
      `scale(${SC.toFixed(3)})`});
  g.appendChild(chev);
  const bead=el("ellipse",{cx:A[0].toFixed(1),cy:A[1].toFixed(1),
    rx:(1.6*SC).toFixed(2),ry:(1.6*SC).toFixed(2),
    fill:col,"fill-opacity":"0"});
  g.appendChild(bead);
  return {A,C,B,line,chev,bead,f:-1};
}
function flowFan(g, ends, mouth, inward, hue, SC){
  return ends.map((end,i)=>{
    const A=inward?end:mouth, B=inward?mouth:end;
    const L=flowLine(g,A,B,hue(i),SC); L.end=end; return L;
  });
}
/* `dim` is what the line is worth when nothing is travelling on it: a fan
   stays faintly drawn all the way round the cycle, because the funnel is a
   fact about the station and not only about the moment it is being used. */
function setFanLine(L,dim,f){
  const c=Math.max(0,Math.min(1,f)), lit=Math.sin(Math.PI*c);
  L.line.setAttribute("stroke-opacity",(dim+0.62*lit).toFixed(2));
  L.chev.setAttribute("stroke-opacity",(dim*1.7+0.35*lit).toFixed(2));
  const p=fanBez(L.A,L.C,L.B,c);
  L.bead.setAttribute("cx",p[0].toFixed(1)); L.bead.setAttribute("cy",p[1].toFixed(1));
  L.bead.setAttribute("fill-opacity",(f>0.002&&f<0.998?0.95:0).toFixed(2));
}

/* ------------------------------------------------------------------
   POOL AND SPLIT · POOL THE PLATE, THEN DEAL IT BACK OUT
   Ninety-six wells emptied into one tube by a twelve-channel head, and
   then that tube dealt back out across ninety-six fresh ones. Both
   halves are drawn, because the second one is where the claim lives.

   THE TOOL IS A TWELVE-CHANNEL AND THE PLATE IS LAID OUT FOR IT. The
   grid is read off the node — cols x rows, the way B5 reads its own —
   so a row is twelve wells wide and one head spans it, and the number
   of rows is a fact about the round rather than about the drawing. This
   shape used to draw its wells as eight across and six back, which is
   the compound plate's grid from row 1, and a twelve-channel over that
   is a tool that does not fit the plastic: either four tips hang off
   the edge or the comb is pitched to something that is not a well. This
   way the tool and the plate agree, and one dip is one row.

   THE COLOURS ARE THE WHOLE POINT, and they are the DONOR PLATE'S OWN.
   What arrives here is the plate the round before handed over, wearing
   that round's lip: ninety-six wells and ninety-six different colours
   in them, one per barcode, drawn by the same rampShade walk. It
   wore four treatment bands once, and four bands said the material was
   four things when it is ninety-six. Twelve tips lift twelve different
   colours a trip, the tube ends up holding every one of them, and every
   well of the second plate gets that identical mixture. That is the
   claim the node makes — after this, well position carries no
   information — drawn rather than asserted.

   THE MIXTURE IS RAINBOW AND HOMOGENEOUS AT THE SAME TIME, which is the
   only honest way to draw it: one shared gradient through the whole ramp
   painted into the tube and into all ninety-six wells, so what is in
   each well is unmistakably a blend of everything and unmistakably the
   SAME blend. A flat grey said the barcodes were lost in the pooling;
   they are not lost, they are unplaced, and only the barcode written in
   the round before still knows which well a cell came from.

   THE TWO PLATES TAKE DIFFERENT LIPS. Two plates of the same plastic at
   two moments of one operation are hard to tell apart at a glance, and
   which one the head is standing over is the difference between pooling
   and dealing. The lip is also what says WHICH ROUND'S plate it is, so
   it comes in from the caller rather than being written here.

   THE BENCH IS SHARED WITH B5, WHICH IS THIS SAME OPERATION A ROUND
   LATER. The row pools twice, and a reader has to register the second
   station as the first one repeated rather than as a new trick — so the
   two are ONE drawing rather than two that look alike, because two
   copies diverge the first time either is tuned. Everything below is
   therefore common, and the only thing the round changes is the pair of
   lips: B3 pools round one's green into round two's royal blue, B5
   pools that same royal blue into round three's yellow. The plate a
   station empties is the plate the station before it filled, which is
   how the plastic can be followed down the row.

   A TRIP IS A ROW AND THE PLATE HAS A BUDGET. A single tip needed a
   whole scheme here — bench speed for the first row, then a geometric
   run-up with a floor under it — because ninety-six honest transfers is
   the best part of a minute nobody watches and an unlimited
   acceleration turns the tail into a flicker. A head that empties a row
   a trip has as many transfers as there are rows, so the trip length is
   a plate-sweep budget divided by them, with a floor under it so a
   deeper plate quickens the hand rather than blurring it. Eight rows
   land on that floor and the whole cycle still comes in around twelve
   seconds.

   BETWEEN THE HALVES THE TUBE IS SWIRLED. Ninety-six wells go in as
   ninety-six colours and come out as one mixture, and mixing is the step
   that makes that true; a tube that just stands there full asserts the pooling
   rather than shows it. It leans about its own foot the way a hand rocks
   a conical, and the surface rides the wall a beat behind the lean.

   The plates are drawn wider than the node's own 0.6 footprint: ninety-
   six wells at that size would be a smear of plastic with no wells in
   it. They stand diagonally apart — one back, one forward — so neither
   overlaps the stations either side, with the tube on the floor between
   them. Going from four rows to eight doubles their depth, and the
   extra is spent OUTWARD, away from the tube: the edge each plate turns
   toward the vessel stays exactly where it was composed, so the
   clearance around the tube and the diagonal read of the pair survive a
   change of grid.

   Reuses plateGrid / skirtSlab / drawWell from the plate set, rampHue
   from round one, ellipseAt / arcPts from the clutch block, and
   conicalTube / multiGlyph from the bench kit above, so the plastic and
   the round glassware match everything else on the map. It spends
   --ch1..12 through rampHue, which are declared on /molecular_pipe and
   nowhere else; both shapes below are worn by that page alone.
   ------------------------------------------------------------------ */
/* OPT is {src, dst, tubeW, tubeH} — the plate this station empties and
   the plate it fills, each in its own round's colour, and the glassware's
   proportions against the node. The lips are what the two stations differ
   in chemically; the tube factors default to 1 so a caller that says
   nothing gets the conical this bench was composed with. */
/* The pooled mixture's paint, shared with B6 because B6's plate IS the one
   this bench deals into and has to arrive holding the same thing. One
   definition rather than two, for the reason the bench itself is one. */
function pooledMix(g){
  const gid=`tiedye${++UID}`, grad=el("radialGradient",{id:gid});
  for(let i=0;i<=12;i++) grad.appendChild(el("stop",{
    offset:`${(i*100/12).toFixed(1)}%`,"stop-color":`var(--ch${i%12+1})`}));
  g.appendChild(grad);
  return {fill:`url(#${gid})`, op:0.7};
}
function poolSplitBench(g,n,OPT){
  const th=n.h;
  /* ---- EVERYTHING HERE IS A FRACTION OF THE NODE, NOT A WORLD CONSTANT -----
     A shape has to read w, d and h at draw time, because those are what a
     resize changes and a redraw is the only reason the shape is being run
     again. Absolute coordinates draw correctly at the size the node happens to
     be authored and come apart the moment anybody drags a corner — the plate
     grows and the tube beside it stays exactly where it was. Every ratio below
     is against the size this was composed at: w 0.6, d 0.6, h 0.3. */
  /* THE POOLED SUSPENSION IS ONE THING AND IT IS NOT GREY. Grey said the
     pooling threw the barcodes away; what it actually throws away is POSITION,
     and every one of the ninety-six identities that went in is still in the
     tube. So the mixture is painted with a single gradient through the whole
     --ch ramp — rings of every colour that went in — and the tube and all
     ninety-six wells it is dealt into share that one paint. Same object in
     every well is what homogeneous means; that it is rainbow rather than flat
     is what says the well is a blend and not a colour.
     Declared here rather than in installDefs because a gradient is legal
     wherever it sits, and the id is uniqued the way the tank clips are — the
     shape is drawn more than once whenever a checker sizes it twice. */
  const MIX=pooledMix(g);
  /* THE GRID IS THE ROUND'S OWN FACT and it is read off the node, the way B5
     reads its own: twelve columns by eight rows is the 96-well plastic these
     rounds are run on, and not plateWells' 8 x 6, which belongs to the compound
     plate a row up. It matters to the drawing rather than only to the record,
     because the head working it has twelve channels and a row is what one dip
     is. */
  const COLS=n.cols||12, ROWS=n.rows||8;

  /* THE FOOTPRINT IS THE GRID'S SHAPE, so the depth is COMPUTED from it rather
     than authored. Square pitch is the whole requirement — twelve wells crammed
     across a footprint drawn for eight is a row of slots, and four rows spread
     over a deep one is three empty bands of plastic — and square pitch is just
     depth = width x rows / cols. Twelve by eight lands on the 3:2 a real
     96-well plate has; twelve by four gives the long shallow strip this was
     first composed at. Either way the head's comb, which is pitched off the
     first two wells, fits the plastic.
     THE EXTRA DEPTH IS SPENT OUTWARD. Each plate is placed by the edge it turns
     toward the tube — the far edge of the near plate, the near edge of the far
     one — so a deeper grid grows back and front into the empty ground this row
     has, and leaves the clearance around the vessel exactly as composed. */
  const PW=n.w*1.72, PD=PW*ROWS/COLS;
  const src={x:n.x-n.w*0.4167, y:n.y-n.d*0.6167-PD/2, w:PW, d:PD};
  const dst={x:n.x+n.w*0.25,   y:n.y+n.d*0.95  +PD/2, w:PW, d:PD};

  /* THE DONOR IS THE PLATE THE STEP BEFORE HANDS OVER, drawn as that plate and
     not as anonymous plastic: the previous round's semi-skirted 96 in its own
     lip, with that round's ninety-six one-per-well colours still in it. Four
     treatment bands said what arrives here is four things; what arrives is
     ninety-six barcoded populations, and losing their POSITION while keeping
     their identity is the only claim this station makes.
     plateGrid runs row-major, so a slice of the list is a row of the plate and
     one trip of the head, and the map index is the same k round one walked the
     ramp with — same well, same colour. Each well keeps a handle on its own
     liquid, because that is the thing the head takes away.
     THE WALK IS rampShade, NOT rampHue, because that is what B2 and B4 now fill
     their plates with: a donor left on hue alone was a different plate from the
     one it claims to be, twelve colours dealt eight times beside a tile showing
     ninety-six. Asked from the page for B3; B5 follows for free, since its donor
     is B4's plate and B4 walks the same shade.
     AND THE PAINT IS LAID DOWN THE WAY B2 LAYS IT: the colour at full strength
     over a grey disc at .3. The same colour at .85 straight onto the plastic
     came out a paler plate beside B2's lit one, which is the same mismatch by
     another road. The grey stays behind when the head drains a well, and that
     is what an emptied well should look like. */
  const deckSrc=skirtSlab(g,src,th,OPT.src);
  /* B2's lit well by default: a tip's worth of it has to show. The caller may
     hand in the strength its own donor is seen at the station before — see B5 */
  const WOP=OPT.wop||1;
  const from=plateGrid(deckSrc,th,COLS,ROWS).map((w,k)=>{
    drawWell(g,w,false);
    g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:"var(--fg3)","fill-opacity":".3"}));
    const hue=rampShade(k,COLS*ROWS);
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:hue,"fill-opacity":WOP});
    g.appendChild(fill);
    return {e:w.e, hue, fill, rx:w.e.rx*0.86, ry:w.e.ry*0.86};
  });

  /* THE TUBE, on the floor between the two plates. It is conicalTube's, and it
     stands twice as tall as this shape's own first attempt at one: a 15 ml
     conical is a long thin thing and the old one read as a stubby vial. The
     height is also what the rising column needs, because ninety-six wells going
     into a short tube is a level that barely moves per trip.
     WHICH CONICAL IS THE CALLER'S. conicalTube cuts every radius from the w it
     is handed and every height from the h, so a different format is a different
     pair of numbers and nothing here has to know which one it got: the rim, the
     foot and the level all come back off T. */
  const T=conicalTube(g, n.x-n.w*0.40, n.y+n.d*0.50,
                      n.w*(OPT.tubeW||1), n.h*(OPT.tubeH||1));
  /* the column carries the mixture's own paint rather than the glassware's
     default grey — what is standing in the tube is every colour that went in */
  T.setTint(MIX.fill, 0.5);

  /* THE SECOND PLATE, forward of the tube so the split runs towards the
     viewer. It is fresh plastic and it is a DIFFERENT plate, so it takes the
     next round's lip against the donor's: the two are the same object at two
     moments otherwise, and a reader has to be able to tell at a glance which
     one the head is standing over. Its wells are born at full size and
     invisible: the ticker only has to open them, and an element with no
     coordinates would drag the selection halo across the map. */
  const deckDst=skirtSlab(g,dst,th,OPT.dst);
  const into=plateGrid(deckDst,th,COLS,ROWS).map(w=>{
    drawWell(g,w,false);
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:MIX.fill,"fill-opacity":"0"});
    g.appendChild(fill);
    return {e:w.e, fill, rx:w.e.rx*0.86, ry:w.e.ry*0.86};
  });

  /* THE HEAD IS AS MANY CHANNELS AS THE PLATE HAS COLUMNS, at the plate's own
     pitch, measured off the first two wells rather than authored — the comb has
     to be the plastic's spacing at every node size, not just at this one. It
     stands about thirty-five pixels over the plate against the single-channel's
     twenty-seven, because a twelve-channel is the bigger tool and a comb forty
     pixels wide under a stub of a body reads as a rake. */
  const SC=n.w/0.6;
  const STEP=[from[1].e.x-from[0].e.x, from[1].e.y-from[0].e.y];
  const {pip,loads}=multiGlyph(g,SC,COLS,STEP);

  /* one drop per channel, born over the mouth they all first fall into. Twelve
     rather than one, because pooling is twelve streams converging on a tube and
     the split is twelve landing in twelve wells; a single drop could only ever
     be one of them, and the eye reads it as a tool with one tip. */
  const drops=loads.map(()=>{
    const d=el("ellipse",{cx:T.rim.x.toFixed(1),cy:T.rim.y.toFixed(1),
      rx:(1.0*SC).toFixed(2),ry:(1.3*SC).toFixed(2),
      fill:"var(--fg)","fill-opacity":"0"});
    g.appendChild(d); return d;
  });

  /* ---- TIMING -------------------------------------------------------------
     A TRIP IS A ROW, so there are as many a plate as the grid has rows and they
     can all run at the same speed — see the header for what that replaced. What
     is fixed is the SWEEP, not the trip: a plate gets about five seconds and the
     rows divide it, which is why eight rows do not take twice as long to watch
     as four did. The floor is what stops that dividing into a flicker — it is
     the shortest out-sit-return a hand reads as a movement — and at eight rows
     the sweep is already down on it. The dealing trip is shorter throughout
     because a hover is quicker than a dip. MID is not a pause but how long the
     swirl lasts, and three turns of it want the best part of two seconds to
     read as a hand rather than a twitch. END stands and looks at the dealt
     plate. One cycle is about twelve seconds at either grid. */
  const TRIP=Math.max(0.62, 4.6/ROWS), DEAL=Math.max(0.55, 4.0/ROWS);
  const MID=1.8, END=1.6, SW_TURNS=3;
  const T1=ROWS*TRIP, T2=T1+MID, T3=T2+ROWS*DEAL, T4=T3+END;
  /* which trip a half is on, and how far through it — named tripAt rather than
     at(), which is the strand helper further up this file */
  const tripAt=(t0,len)=>{ const k=Math.min(ROWS-1,Math.floor(t0/len));
    return [k, Math.max(0,Math.min(1,(t0-k*len)/len))]; };

  /* where each trip is, as a fraction of its own length. Pooling goes out,
     draws twelve wells up, comes back and lets go into the tube; the split
     draws up first, carries it out and lets go over the row — which is why the
     comb dips into the first plate and hovers over the second. */
  const GO=0.28, SIT=0.52, RET=0.80;
  const SUP=0.20, SGO=0.48, SDIS=0.72;

  /* THE DEAL RUNS IN ROW ORDER, A then B then C, and it used to be shuffled.
     The shuffle was carrying the claim in the wrong place: the randomisation
     happens in the TUBE, not in the hand. What leaves it is one homogeneous
     suspension — the same mixture in every tip — so where any given cell lands
     is already random however tidily the plate is filled, and a hand skipping
     about said the trick was in the dealing while making the sweep hard to
     read. Filling front to back is also what somebody at the bench does. */

  const rowOf=(plate,j)=>plate.slice(j*COLS,(j+1)*COLS);
  /* the head is aimed by the middle of the row it is working, and that is all
     the aiming there is: the comb is centred on its own group and pitched to
     the plate, so a middle on a middle puts every channel in its own well */
  const midOf=row=>[(row[0].e.x+row[COLS-1].e.x)/2,
                    (row[0].e.y+row[COLS-1].e.y)/2];

  const LIFT=10*SC, mouth=[T.rim.x, T.rim.y-2*SC];
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  /* the head anchor is kept, not just written to the transform: anything
     leaving a channel starts at that channel's tip, and a tip is the anchor
     plus its own offset along the comb */
  let hx=mouth[0], hy=mouth[1];
  const place=(x,y)=>{ hx=x; hy=y;
    pip.setAttribute("transform",`translate(${x.toFixed(1)},${y.toFixed(1)})`); };
  const hop=(a,b,f0)=>{ const f=ease(Math.max(0,Math.min(1,f0)));
    place(a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f-Math.sin(f*Math.PI)*LIFT); };
  const tipAt=i=>{ const o=i-(COLS-1)/2;
    return [hx+o*STEP[0], hy+o*STEP[1]]; };
  /* A COLOUR MAY BE PER CHANNEL. Pooling, twelve tips hold twelve different
     wells and one colour across the comb would say the row was one thing;
     dealing, all twelve hold the same mixture. So both the load and the drop
     take either a string or a function of the channel index. */
  const hueAt=(c,i)=>typeof c==="function"?c(i):c;
  /* `to` is per channel too, because the two halves let go at different
     targets: twelve streams into one mouth, or twelve into twelve wells */
  const fall=(colour,to,f,vis)=>drops.forEach((d,i)=>{
    const a=tipAt(i), b=to(i);
    d.setAttribute("fill",hueAt(colour,i));
    d.setAttribute("cx",(a[0]+(b[0]-a[0])*f).toFixed(1));
    d.setAttribute("cy",(a[1]+(b[1]-a[1])*f).toFixed(1));
    d.setAttribute("fill-opacity",(vis*(1-f*0.6)).toFixed(2));
  });
  const dry=()=>drops.forEach(d=>d.setAttribute("fill-opacity","0"));
  const carry=(colour,op)=>loads.forEach((l,i)=>{
    l.setAttribute("fill",hueAt(colour,i));
    l.setAttribute("fill-opacity",op.toFixed(2)); });
  const setLevel=T.setLevel, swirl=T.swirl;

  /* a long frame must not leave a row behind full, or a fresh one behind
     empty — the sweep is the claim, so both halves catch up rather than skip */
  const wet=(w,op,k)=>{ w.fill.setAttribute("fill-opacity",op.toFixed(2));
    w.fill.setAttribute("rx",(w.rx*k).toFixed(2));
    w.fill.setAttribute("ry",(w.ry*k).toFixed(2)); };
  let t=0, poured=0, dealt=0;
  const emptyTo=k=>{ while(poured<k) rowOf(from,poured++)
    .forEach(w=>w.fill.setAttribute("fill-opacity","0")); };
  const fillTo=k=>{ while(dealt<k) rowOf(into,dealt++)
    .forEach(w=>wet(w,MIX.op,1)); };
  const park=()=>{ dry(); carry(MIX.fill,0); place(mouth[0],mouth[1]); };
  const reset=()=>{
    t=0; poured=0; dealt=0;
    from.forEach(w=>wet(w,WOP,1));
    into.forEach(w=>w.fill.setAttribute("fill-opacity","0"));
    setLevel(0,null,0); park(); swirl(0,0);
  };

  const run=(dt)=>{
    t+=dt;
    if(t>=T4){ reset(); return; }
    if(t<T1||t>=T2) swirl(0,0);         // upright everywhere except between the halves

    if(t<T1){                                       // POOL: row by row into one
      const [k,u]=tripAt(t,TRIP), row=rowOf(from,k);
      emptyTo(k);
      const e=u<GO?0:Math.min(1,(u-GO)/(SIT-GO));   // the row empties as the comb sits in it
      row.forEach(w=>wet(w,WOP*(1-e),1-0.3*e));

      const dis=u>RET ? (u-RET)/(1-RET) : 0;         // the tube takes it, one row at a time
      const fresh=dis>0 ? 1 : Math.max(0,1-u*2);
      /* the surface flashes the colour of what just went in, and a row is
         twelve colours against one meniscus — so it takes the middle well's,
         which is the one the eye was following the head across */
      const last=(dis>0?k:Math.max(0,k-1))*COLS+(COLS>>1);
      setLevel((k+dis)/ROWS, (k||dis)?{fill:from[last].hue}:null, fresh);

      const m=midOf(row), wp=[m[0], m[1]-1*SC];
      if(u<GO)       hop(mouth,wp,u/GO);
      else if(u<SIT) place(wp[0],wp[1]);
      else if(u<RET) hop(wp,mouth,(u-SIT)/(RET-SIT));
      else           place(mouth[0],mouth[1]);

      /* what the channels are carrying, and what they let go of — EACH ITS OWN
         WELL'S COLOUR. Held at a floor of 0.45: a column inside a plastic tip
         two pixels across is not there at much less than that. */
      const vis=Math.max(0.45,WOP);
      carry(i=>row[i].hue,
        u<GO ? 0 : u<SIT ? vis*e : dis>0 ? vis*(1-dis) : vis);
      /* twelve channels empty into one mouth, so the streams converge rather
         than run parallel — which is the one moment this shape says out loud
         that the head is what does the pooling */
      if(dis>0) fall(i=>row[i].hue, ()=>[T.rim.x,T.surfY], dis, vis);
      else dry();
      return;
    }

    if(t<T2){                                       // pooled: one tube, swirled
      const m=(t-T1)/MID, env=Math.sin(Math.PI*m);
      emptyTo(ROWS); setLevel(1,MIX,0);             // a surface to slosh, tinted with the mixture
      swirl(env, m*SW_TURNS*2*Math.PI);
      /* the head stands off while the tube is being mixed, because a pipette
         hanging in the mouth of a tube somebody is swirling is a broken one */
      dry(); carry(MIX.fill,0);
      place(mouth[0]+env*13*SC, mouth[1]-env*3*SC);
      return;
    }

    if(t<T3){                                       // SPLIT: one back out, row by row
      const [k,u]=tripAt(t-T2,DEAL), row=rowOf(into,k);
      emptyTo(ROWS); fillTo(k);
      const up=Math.min(1,u/SUP);
      setLevel(1-(k+up)/ROWS,null,0);

      const dis=u<SGO ? 0 : u<SDIS ? (u-SGO)/(SDIS-SGO) : 1;
      row.forEach(w=>wet(w,MIX.op*dis,0.55+0.45*dis));

      const m=midOf(row), wp=[m[0], m[1]-6*SC];     // it hovers to deal, it does not dip
      if(u<SUP)       place(mouth[0],mouth[1]);
      else if(u<SGO)  hop(mouth,wp,(u-SUP)/(SGO-SUP));
      else if(u<SDIS) place(wp[0],wp[1]);
      else            hop(wp,mouth,(u-SDIS)/(1-SDIS));

      /* every tip holds the same thing on the way out — that is what makes the
         deal a randomisation rather than twelve separate transfers */
      carry(MIX.fill,
        u<SUP ? 0.8*up : u<SGO ? 0.8 : u<SDIS ? 0.8*(1-dis) : 0);
      if(u>=SGO && u<SDIS) fall(MIX.fill, i=>[row[i].e.x,row[i].e.y], dis, 0.75);
      else dry();
      return;
    }

    fillTo(ROWS); setLevel(0,null,0); park();       // dealt: an empty tube and a full plate
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
/* B3 · the first pool: round one's green plate emptied into round two's
   blue one. The receiving plate is B4's --ch8 rather than a blue of its
   own, because it IS B4's plate — the one round two ligates next — and a
   reader following the row should see the same plastic arrive there. */
function drawPoolSplit(g,n){
  poolSplitBench(g,n,{src:"var(--ch5)", dst:"var(--ch8)"});
}
DRAW.poolsplit = drawPoolSplit;

/* B5 · THE SAME BENCH ONE ROUND ON, and same is the claim: this station used
   to be drawn as three static beats with a flow fan between them, which said
   the second pooling was a different KIND of thing from the first. It is not —
   it is the identical operation, and the row only reads as split-pool
   barcoding if a viewer registers it as one procedure repeated. So it is the
   twelve-channel, the conical and the row-order sweep again, and the plates
   advance one round: the royal blue plate B3 dealt into, which round two has
   since ligated, is emptied into round three's yellow one.

   THE TUBE IS B3'S SIZE. It was drawn once as a true-bore 50 ml — 30/17 of
   B3's width at 115/120 of its height — and was then asked from the page to
   match B3's scale and size. So it takes the conical's default proportions
   against the node, and since the two benches
   are authored at one size the tubes now come out identical; the plates are
   the one difference left between the stations.

   THE DONOR PLATE IS B4'S --ch8, as asked from the page. It is the plate B3
   dealt into and B4 ligated, so it now wears the blue it wore at both of
   those stations rather than a --ch9 of its own.

   AND ITS WELLS WEAR B4'S PAINT, as asked from the page. The colours were
   already B4's well for well — same rampShade, same row-major index — but
   B4 rests at half strength over the grey for most of its loop, and the
   donor laid the same colours at full, so it arrived here a louder plate
   than the one beside it. It now takes B4's resting DIM; if that changes,
   this .5 has to change with it. */
function drawPoolSplit96(g,n){
  poolSplitBench(g,n,{src:"var(--ch8)", dst:"var(--ch3)", wop:.5});
}
DRAW.poolsplit96 = drawPoolSplit96;


/* ==================================================================
   B7 · POOL, AND THE MOMENT THE CELL OPENS
   Round three's plate is emptied into one conical, the conical is
   dealt into two PCR strips, and above the strips a cell comes apart.

   THREE OBJECTS IN ONE FRAME, AND THE ORDER THEY STAND IN IS THE ORDER
   THE MATERIAL MOVES. The plate is low and left, the conical in the
   middle, the rack high and right — which is back-to-front along y
   rather than along x, because the stations either side of this one are
   close and y is the only axis on this row with room in it. On this
   projection back-to-front reads left-to-right on screen, so the beats
   run the way the row does without borrowing width from B6 or B8.

   THE COLOURS CONVERGE RATHER THAN CUTTING. Ninety-six wells go into
   the tube as ninety-six hues and what stands in it at the end is one.
   That is drawn as a gradient whose twelve stops walk from their own
   --ch colour to --pool while the level rises, so the loss of
   distinction is something you watch happen; a tube that fills grey
   from the first row would assert it instead. Losing distinction is the
   whole content of a pool — position stops meaning anything here — and
   it is the reason the sixteen tubes it is dealt into are all one
   colour rather than sixteen.

   THE RUPTURE IS THE THING THE EYE IS MEANT TO LAND ON. Everything
   upstream of this station happens inside a cell that stays shut and
   everything downstream happens in a tube, so the pivot is drawn at a
   size nothing else here is drawn at: a magnification hanging over the
   rack inside a thin solid ellipse, tethered to the one strip tube it
   is a magnification of. The membrane is arcs with gaps in them from
   the start — that is what porous means, and it is also why the break
   only has to move seven pieces rather than swap one element for
   another at the moment it matters.

   AND THE MEMBRANE IS THE ONLY THING ON THIS BENCH THAT ACCELERATES.
   Every other motion here eases to a stop, because every other motion
   is somebody's hand arriving somewhere; the arcs go out on f squared
   and never come back. The strand crosses out of the broken ring into
   open solution and brightens as it goes, and then the beat HOLDS —
   the cell does not reassemble, the loop cuts and starts over. A cycle
   that ran backwards would say lysis is reversible, which is the one
   claim this station exists to deny.

   THE COUNT IS NOT DRAWN HERE ANY MORE. This composition was asked for
   as pooling and lysis in three beats, and a haemocytometer standing
   between them was a fourth. The node's prose still carries the count.

   Reuses skirtSlab / plateGrid / drawWell from the plate set, rampHue
   from round one, conicalTube / multiGlyph / flowFan / setFanLine from
   the bench kit, and ellipseAt / arcPts from the clutch block. The
   strips, the lens and the bursting cell are the only new drawings.

   Spends --ch1..12 and --pool, which are declared on /molecular_pipe.
   It is the only page that carries a node wearing this shape.
   ================================================================== */

/* THE EIGHT SUBLIBRARY HUES. B7 no longer paints with them — what leaves this
   station is one suspension divided by volume, and sixteen coloured tubes would
   put the identity back that the pool just took away. But the eight ARE an
   identity from the next station on: C2 indexes them, C4 sizes them and C6
   hands them over, and a second copy of this one line is where those three
   would start disagreeing about what colour Sublib3 is. So it stays declared
   here, at the station that creates the sublibraries, and is spent downstream.
   Spread across the twelve-stop ramp rather than taken in order, so they read
   as eight of a kind rather than as a truncated copy of B5's twelve. */
const CH=i=>`var(--ch${i%12+1})`;
const SUBHUE=(k,n)=>CH(Math.round(k*11/((n||8)-1)));

function drawCountSplitLyse(g,n){
  const SC=n.w/0.6;
  /* the plate this station empties is round three's, and round three is 96
     wells. It is not read off the node the way B5 reads its own, because the
     plate is not this station's object — it is the one it inherits, and B6 next
     door is the record of what it was. */
  const COLS=12, ROWS=8;
  /* two 8-tube strips, which is the plastic a pooled lysate is actually put
     into for the -80. The count is laid out as strips x per-strip rather than
     as sixteen, so the moulded web that makes eight tubes one strip has a row
     to span and a kit with a different strip length is a change of one number. */
  const STRIPS=2, PER=8, NTUBE=STRIPS*PER;
  const POOLED={fill:"var(--pool)", op:0.62};

  /* ---- EVERY OFFSET IS A FRACTION OF THE NODE -----------------------------
     w, d and h are read at draw time because those are what a resize changes,
     and a redraw is the only reason this function is running again. Absolute
     coordinates draw correctly at the size the node happens to be authored and
     come apart the moment anybody drags a corner. Composed at w .85, d .85,
     h .55 — this station is the widest tile on the row and the composition is
     laid out against that, not against B5's smaller box.

     THE TWO ENDS SIT ON THE SIDES THEY WERE ASKED FOR: strips near-left, plate
     far-right, tube between them. The material therefore runs right to left
     across the tile, and what it buys is the near corner — the strips and the
     opening cell they hold are the thing to look at here, and on this side they
     stand in front of the row instead of behind it.

     NEITHER END IS THROWN FURTHER THAN IT HAS TO BE. The perpendicular axis is
     the only free one on a single-lane map — the neighbours run down-right — so
     both throws spend themselves across it, and each stays under three node
     depths so the head working the plate never comes down on somebody else's
     plastic. The rack spends its extra on WIDTH, because going from eight tubes
     to sixteen is two strips laid side by side rather than a deeper block.

     THE PLATE IS B6'S PLATE, AS ASKED. It was matched to B4's once, and B6
     has since grown its plate to B5's receiving size — so the yellow plate
     B6 ligates in and the yellow plate this station empties read as two
     sizes of one piece of plastic side by side. B6 cuts 1.45 x 1.7793 wide
     and 0.42 x 0.714 thick, and these two fractions are those lengths over
     this tile's own .85 and .55 — B6's plate at B6's scale while this tile
     stays authored at its own size, and still read off n, so a resize
     carries it. It no longer keeps its centre: at nearly three times the
     width, a plate grown about its old centre reaches forward onto B6's own
     deck. So it is placed by the edge it turns toward the tube, the way B5
     places its plates — that edge stays where it was, the tube's clearance
     is unchanged, and the extra depth goes backward into empty ground. */
  const th=n.h*0.5452;
  const PW=n.w*3.0353, PD=PW*ROWS/COLS;
  const src ={x:n.x+n.w*0.48, y:n.y-n.d*1.5452-PD/2, w:PW, d:PD};
  const rack={x:n.x-n.w*0.15, y:n.y+n.d*2.75, w:n.w*1.70, d:n.d*0.66, h:n.h*0.50};
  const TX=n.x+n.w*0.05, TY=n.y-n.d*0.10;

  /* THE MIXTURE'S OWN PAINT, and the thing that makes the pooling watchable.
     One radial gradient through the whole --ch ramp, with every stop able to
     walk to --pool: at the first row it is rings of every colour that went in,
     at the last it is flat pool, and the walk between them is the animation.
     Declared here rather than in installDefs because a gradient is legal
     wherever it sits, and the id is uniqued the way the tank clips are — the
     shape is drawn more than once whenever a checker sizes it twice. */
  const gid=`lysemix${++UID}`, grad=el("radialGradient",{id:gid});
  const stops=[];
  for(let i=0;i<=12;i++){
    const s=el("stop",{offset:`${(i*100/12).toFixed(1)}%`,
      "stop-color":`var(--ch${i%12+1})`});
    grad.appendChild(s); stops.push(s);
  }
  g.appendChild(grad);
  /* quantised to fortieths: thirteen colour strings a frame for a shift the eye
     cannot see is the same waste as repainting a well that has not moved */
  let blended=-1;
  const blend=(b)=>{
    const q=Math.round(Math.max(0,Math.min(1,b))*40)/40;
    if(q===blended) return; blended=q;
    stops.forEach((s,i)=>s.setAttribute("stop-color",
      q<0.004 ? `var(--ch${i%12+1})`
      : q>0.996 ? "var(--pool)"
      : `color-mix(in oklab, var(--pool) ${(q*100).toFixed(0)}%, var(--ch${i%12+1}))`));
  };

  /* ---- BEAT 1's plate, FURTHEST BACK AND THEREFORE BUILT FIRST ------------
     On an isometric grid the order things are appended in is the order they
     occlude in, and the plate is now the far object rather than the near one —
     so it goes down before the tube it empties into.

     Round three's plastic, which is the plate B6 next door has just ligated in,
     so it wears round three's yellow lip and ninety-six one-per-well colours
     walked by the same rampHue every other plate on this row is walked by. */
  const deck=skirtSlab(g,src,th,"var(--ch3)");
  const WOP=0.85;
  const from=plateGrid(deck,th,COLS,ROWS).map((w,k)=>{
    drawWell(g,w,false);
    const hue=rampHue(k,COLS*ROWS);
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:hue,"fill-opacity":String(WOP)});
    g.appendChild(fill);
    return {e:w.e, hue, fill, rx:w.e.rx*0.86, ry:w.e.ry*0.86};
  });

  /* ---- BEAT 2 — the vessel, and it belongs to beats 1 and 3 both ----------
     One conical, filled by the head and emptied by a fan. Drawing a second tube
     for the deal would say the pool had been decanted into something else,
     which is not what happens.

     ITS HEIGHT IS NOT n.h. A 15 ml conical is a fixed shape — a long thin thing
     with graduations up the near side — so the height that goes into it has to
     keep its own proportion against its bore. This node stands nearly twice as
     tall as B5's, and handing conicalTube n.h raw gives a tube half a screen
     high. */
  const T=conicalTube(g, TX, TY, n.w*0.75, n.h*0.62);
  T.setTint(`url(#${gid})`, 0.62);
  const mouth=[T.rim.x, T.rim.y-2.2*SC];

  /* ---- BEAT 3, NEAREST THE VIEWER -----------------------------------------
     The rack stands in front of the tube and the plate both, so it is appended
     after them. */
  paint(g, rack.x, rack.y, rack.w, rack.d, rack.h, SKIN.works);
  const RT=n.w*0.076, RH=n.h*1.05;
  const CZ1=rack.h+RH*0.88, CZ0=CZ1-n.h*0.13;
  const tubes=[];
  for(let j=0;j<STRIPS;j++){
    const cy=rack.y-rack.d/2+(j+0.5)*rack.d/STRIPS;
    const xA=rack.x-rack.w/2+0.5*rack.w/PER-RT,
          xB=rack.x-rack.w/2+(PER-0.5)*rack.w/PER+RT;
    /* THE WEB IS WHAT MAKES EIGHT TUBES A STRIP. Without it this is sixteen
       loose tubes standing in a block, which is a different consumable and a
       different claim about how the lysate is stored. Near face then top, so
       the eight tubes drawn after it stand in front of their own moulding. */
    g.appendChild(el("polygon",{points:pts([P(xA,cy+RT,CZ1),P(xB,cy+RT,CZ1),
      P(xB,cy+RT,CZ0),P(xA,cy+RT,CZ0)]),fill:"var(--t-right)","fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
    g.appendChild(el("polygon",{points:pts([P(xA,cy-RT,CZ1),P(xB,cy-RT,CZ1),
      P(xB,cy+RT,CZ1),P(xA,cy+RT,CZ1)]),fill:"var(--t-top)","fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
    for(let i=0;i<PER;i++){
      const cx=rack.x-rack.w/2+(i+0.5)*rack.w/PER;
      const rim  =ellipseAt(cx,cy,rack.h+RH,RT),
            foot =ellipseAt(cx,cy,rack.h,RT*0.50),
            inner=ellipseAt(cx,cy,rack.h,RT*0.42);
      const silh=pts([[rim.x+rim.rx,rim.y],...arcPts(foot,0,Math.PI,8),
                      [rim.x-rim.rx,rim.y],...arcPts(rim,Math.PI,2*Math.PI,12)]);
      g.appendChild(el("polygon",{points:silh,fill:"var(--g-top)","fill-opacity":".38"}));
      /* the liquid is born empty but with real geometry: the ticker only ever
         has to restate its surface, and an element with no points sits at the
         origin and drags the selection halo out across the map */
      const liq=el("polygon",{points:pts(arcPts(inner,Math.PI,0,8)),
        fill:POOLED.fill,"fill-opacity":"0"});
      g.appendChild(liq);
      g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
        "stroke-width":".9","stroke-opacity":".7"}));
      g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,fill:"none",
        stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".8"}));
      tubes.push({liq, cx, cy, inner, rim, mouth:[rim.x, rim.y-1.2*SC]});
    }
  }
  const setTube=(t,f,op)=>{
    /* it fills to a shoulder, not to the rim, and the bore widens on the way
       up, so the surface has to walk the taper or it draws outside the wall */
    const fr=Math.max(0.0008,Math.min(1,f))*0.86;
    const surf=ellipseAt(t.cx,t.cy,rack.h+fr*RH,RT*(0.42+0.52*fr));
    t.liq.setAttribute("points",pts([...arcPts(surf,2*Math.PI,Math.PI,10),
                                     ...arcPts(t.inner,Math.PI,0,8)]));
    t.liq.setAttribute("fill-opacity",(f>0.004?op:0).toFixed(2));
  };
  const tf=new Array(NTUBE).fill(-1);
  const setAllTubes=(f)=>{ for(let k=0;k<NTUBE;k++){ tf[k]=f; setTube(tubes[k],f,POOLED.op); } };
  const fillTube=(k,f)=>{ if(Math.abs(f-tf[k])<0.004) return; tf[k]=f;
    setTube(tubes[k],f,POOLED.op); };

  /* the head is as many channels as the plate has columns, at the plate's own
     pitch measured off the first two wells rather than authored — a comb built
     on a constant lands in twelve wells at the size it was drawn for and
     between them at every other size */
  const STEP=[from[1].e.x-from[0].e.x, from[1].e.y-from[0].e.y];
  const {pip,loads}=multiGlyph(g,SC,COLS,STEP);
  const drops=loads.map(()=>{
    const d=el("ellipse",{cx:T.rim.x.toFixed(1),cy:T.rim.y.toFixed(1),
      rx:(0.9*SC).toFixed(2),ry:(1.2*SC).toFixed(2),
      fill:"var(--fg)","fill-opacity":"0"});
    g.appendChild(d); return d;
  });

  /* the deal out, drawn after every piece of plastic so none of them can bury
     a line — the lens below is still built after it, because an inset is in
     front of the scene rather than in it, but now that the glass hangs clear
     of the rack there is nothing left for it to cover. Every line carries the
     pool's own colour and not sixteen different ones: what leaves the tube is
     one suspension divided by volume, and that is the whole reason the gradient
     was made to converge on the way in. */
  const OUT=flowFan(g, tubes.map(t=>t.mouth), mouth, false, ()=>POOLED.fill, SC);

  /* ---- THE MAGNIFICATION, HUNG OFF THE NEAR FOOT OF THE RACK -------------
     A thin solid ellipse with two leaders running back to the strip tube it
     belongs to: the idiom /FASTQ_pipe already uses for a read drawn larger
     than life, given a boundary here because what is inside it comes apart
     and the pieces have to stay somewhere that is plainly not the bench.

     IT IS STILL BUILT LAST, AFTER THE HEAD AND THE FAN, BUT IT NO LONGER
     STANDS ON THE STRIPS. It did, and it buried the near half of the front
     strip on purpose — and that was reported from the page as the tubes and
     the inset overlapping, which is the right report. An inset drawn ON the
     plastic it magnifies has no edge anybody can find: the glass and the
     tubes stop being a scene and a close-up of it and become one confused
     object, and the close-up loses because it is the thinner drawing.

     So it hangs off the rack's near foot instead, down and to the left, into
     the one piece of airspace on this tile no plastic reaches — and it is now
     the biggest thing here, which is what it means for the inset to be the
     panel's subject. THE OFFSET IS MEASURED IN THE LENS'S OWN RADII, not in
     world units: what has to survive a resize is the CLEARANCE between glass
     and plastic, and a gap stated as a fraction of the thing being cleared is
     the same gap at every size. Hanging past the front edge of the mat is not
     a cost — an inset is not standing on the bench, and the one place it can
     say so is the one place the bench has run out.

     THE BOUNDARY IS SIZED BY WHAT LEAVES THE CELLS, not by what is in them at
     rest: the arcs drift half a radius outward and the molecules travel a
     cell radius further than that, and either poking out through the line
     would say the magnification had lost its edge rather than that the cells
     had. */
  const R=n.w*S*0.488, LRX=n.w*S*2.05, LRY=n.w*S*1.64;
  const [AX,AY]=P(rack.x, rack.y+rack.d/2, 0);   // the rack's near foot
  const KX=AX-LRX*0.82, KY=AY+LRY*1.00;
  /* the tether names ONE tube, so it takes the nearest one — the near strip's
     near end, which is the tube the glass now sits beside instead of on */
  const anchor=tubes[(STRIPS-1)*PER];
  /* the tether is drawn before the lens so the lens's own backing covers where
     the two leaders would otherwise run in across the magnification. Both
     start ON the boundary — a leader beginning inside it crosses its own line
     — and where they start is the ray to the tube's own rim rather than a
     fixed angle, so glass that has moved or grown still aims at the plastic. */
  [-1,1].forEach(s=>{
    const tx=anchor.rim.x+s*anchor.rim.rx, ty=anchor.rim.y;
    const vx=tx-KX, vy=ty-KY, t=1/Math.hypot(vx/LRX, vy/LRY);
    g.appendChild(el("line",{x1:(KX+vx*t).toFixed(1),y1:(KY+vy*t).toFixed(1),
      x2:tx.toFixed(1),y2:ty.toFixed(1),
      stroke:"var(--fg2)","stroke-width":".8","stroke-opacity":".4"}));
  });
  const lens=el("g",{transform:`translate(${KX.toFixed(1)},${KY.toFixed(1)})`});
  g.appendChild(lens);
  /* the backing stays nearly opaque now that what is under it is the mat and
     the ground grid rather than plastic: glass you can read the paper through
     is a hole in the drawing, not a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LRX.toFixed(1),ry:LRY.toFixed(1),
    fill:"var(--bg)","fill-opacity":".9"}));

  /* ---- THE MOLECULE, WHICH IS B6'S AT THE MOMENT B6 FINISHES -------------
     What floats out of these cells is not a decorated strand, it is the exact
     thing the tile next door has just finished building: native RNA, the copy
     round one wrote, three chips, the TruSeq Read 2 sequence, and the biotin
     hanging off the end. So the layout is ligation3's, unit for unit, with
     only two changes. It is recentred on its own middle, because here the
     strand is placed by a transform that also spins it and a figure spun
     about a point outside itself swings. And the lettering is gone: B6 sets
     BC1/BC2/BC3 in two-pixel type inside a lens that holds one molecule, and
     nine of those would be nine grey smudges. The block colours carry it, and
     B6 next door is where the letters are. */
  const MU=R/18;                          // this molecule's unit, as IN is B6's
  const MID=1.4;                          // B6's span is not centred; this centres it
  const RNA0=-15.6-MID, CD0=-11.5-MID, CH0=-7.0-MID;
  const CW=3.0, CP=6.4, CHH=3.2;          // chip half-width, pitch, half-height
  const bx=k=>CH0+CW+k*CP;                // the centre of chip k, k = 0,1,2
  const BAR0=bx(2)+CW, BARL=3.6;          // Read 2, off the end of the third chip
  const TAGX=BAR0+BARL+0.7, TAGR=1.1;
  const GOLD="color-mix(in oklab, var(--ch2) 45%, var(--ch3))";
  /* BC1 AND BC2 ARE THE SAME BLOCK IN ALL THREE CELLS, which is B6's choice
     and B6's reason. Three cells differ in all three rounds really; drawing
     that gives nine colours and no comparison. One block moving while two
     stand still is what makes the third round legible as the round that just
     happened.

     THEY ARE FLAT --ch5 AND --ch7, WHICH IS B4's TREATMENT AND NOT B6's. B6
     mixes both towards --fg3, because over there the two old chips have to
     step back so three lenses can be compared on the third. There is nothing
     to compare here — this is one drawing of one lysate — and muted blocks in
     a lens this small came back from the page as barcodes you could not tell
     from each other or from the station before. So the chips carry the same
     green and the same cyan they were ligated in, at the strength B4 draws
     them: a barcode is the same colour at every station it survives. */
  const OLD=["var(--ch5)","var(--ch7)"];
  /* and it is BC3 that moves, because split-pool gives a cell one third-round
     well and these are three different cells. The indices are ligation3's own
     three opened wells on the same 96-well ramp, so the cell you watched take
     its third barcode one station ago is one of the three you now watch come
     apart. If SRC over there ever moves, move these with it. */
  const BC3=[72,56,35].map(k=>rampHue(k,COLS*ROWS));

  /* only the RNA and the copy wander; from the first chip on, the backbone is
     level, because everything past it is synthetic and a hard-cornered block
     riding a sine reads as a block that has come loose. The wave is written
     to land on zero at CH0 so the chips can sit at the group's own origin. */
  const wave=(host,a,b,ph,stroke,sw,op)=>{
    let d="";
    for(let i=0;i<=10;i++){
      const x=a+(b-a)*i/10;
      d+=(i?" L ":"M ")+(x*MU).toFixed(2)+" "+
         ((Math.sin(x*0.40+ph)-Math.sin(CH0*0.40+ph))*1.6*MU).toFixed(2);
    }
    host.appendChild(el("path",{d,fill:"none",stroke,"stroke-width":sw,
      "stroke-opacity":op,"stroke-linecap":"round"}));
  };
  const molecule=(host,bc3,ph)=>{
    wave(host,RNA0,CD0,ph,"var(--fg)","1",".5");
    wave(host,CD0,CH0,ph,"var(--signal)","1.4",".95");
    [OLD[0],OLD[1],bc3].forEach((fill,k)=>
      host.appendChild(el("rect",{x:((bx(k)-CW)*MU).toFixed(2),
        y:(-CHH*MU).toFixed(2),width:(CW*2*MU).toFixed(2),
        height:(CHH*2*MU).toFixed(2),fill,stroke:"var(--stroke)",
        "stroke-width":".6","stroke-opacity":".85"})));
    /* the Read 2 sequence: plain, grey, unlabelled and thinner than a chip,
       because that is what it is — a fixed handle every fragment will carry
       rather than an address */
    host.appendChild(el("rect",{x:(BAR0*MU).toFixed(2),y:(-1.5*MU).toFixed(2),
      width:(BARL*MU).toFixed(2),height:(3.0*MU).toFixed(2),fill:"var(--a-top)",
      "fill-opacity":".9",stroke:"var(--stroke)","stroke-width":".5",
      "stroke-opacity":".8"}));
    /* THE BIOTIN, and the only warm thing in the glass. It is why B8 works at
       all, so it survives the wall: drawn as a drop lying back along the bar,
       hanging off the end rather than sitting on it. */
    const TR=TAGR*MU, dg=el("g",{transform:`translate(${(TAGX*MU).toFixed(2)},0)`});
    dg.appendChild(el("path",{d:
      `M ${(-2.05*TR).toFixed(2)} 0 `+
      `C ${(-0.9*TR).toFixed(2)} ${(-0.95*TR).toFixed(2)} `+
        `${(-0.2*TR).toFixed(2)} ${(-TR).toFixed(2)} ${(0.25*TR).toFixed(2)} ${(-0.72*TR).toFixed(2)} `+
      `C ${(0.9*TR).toFixed(2)} ${(-0.42*TR).toFixed(2)} `+
        `${(0.9*TR).toFixed(2)} ${(0.42*TR).toFixed(2)} ${(0.25*TR).toFixed(2)} ${(0.72*TR).toFixed(2)} `+
      `C ${(-0.2*TR).toFixed(2)} ${TR.toFixed(2)} `+
        `${(-0.9*TR).toFixed(2)} ${(0.95*TR).toFixed(2)} ${(-2.05*TR).toFixed(2)} 0 Z`,
      fill:GOLD,stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".7"}));
    host.appendChild(dg);
  };

  /* A STRAND INSIDE A CELL IS SMALLER THAN A STRAND IN SOLUTION — not because
     the molecule changes size, but because the drawing changes subject. While
     the wall is up the cell is what you are looking at and nine strands drawn
     at their full span read as nine things straining against three membranes;
     the molecule at full size is a claim about scale that only becomes worth
     making once there is nothing else left in the glass to compare it to. So
     the strand is born at SMALL and reaches its authored span exactly as the
     debris goes faint, which is the whole handover this station is about. It
     scales about the group's own origin, which is why the layout above was
     recentred on its middle: a figure scaled about a point outside itself
     walks, and this one is already travelling. */
  const SMALL=0.56;
  const setStrand=(s,e)=>{
    const rad=s.r0+(s.r1-s.r0)*e;
    s.g.setAttribute("transform",
      `translate(${(Math.cos(s.a)*rad).toFixed(1)},${(Math.sin(s.a)*rad).toFixed(1)}) `+
      `rotate(${(s.rot+22*e).toFixed(1)}) `+
      `scale(${(SMALL+(1-SMALL)*e).toFixed(3)})`);
    s.g.setAttribute("opacity",(0.62+0.36*e).toFixed(2));
  };

  /* ---- THREE CELLS, IN A TRIANGLE ----------------------------------------
     One cell coming apart is an incident; three coming apart together is a
     lysis, and a lysis is what the step is. A TRIANGLE AND NOT A ROW because
     a row has a first and a last and these three are in no order — and
     because the gaps a triangle leaves are on the inside, which is where the
     strands end up, so the glass fills with loose barcoded DNA instead of
     three tidy haloes that never meet. Both offsets are fractions of the
     lens, so the figure survives a resize the way everything else here does.

     THE MEMBRANE IS ARCS WITH GAPS IN THEM FROM THE START. A fixed cell is a
     permeabilised one — reagents have been walking in and out of it for three
     rounds — so the gaps are the drawing being right about the chemistry
     before they are the drawing being ready to break. The pores are marked on
     the gaps rather than invented somewhere else, for the same reason.

     THE CELL IS DRAWN AS A WISP, AND WHAT IS LEFT OF IT IS FAINTER STILL.
     Every one of these four numbers used to be roughly twice what it is, and
     at that strength the wreckage of three membranes was the loudest thing in
     the glass — a lens full of grey arcs with the barcoded molecules picking
     their way between them. It is the molecules that survive this station and
     the cell that does not, so the cell is drawn at the weight of something
     already on its way out, and the burst takes it most of the way to
     nothing. Named here because the birth and the burst both spend them, and
     a debris opacity written twice is a debris opacity that drifts.

     BUT NOT ALL THE WAY. The burst used to erase the membranes outright, and
     an empty lens says the cell was removed from the tube; it was not. What
     the wash at B8 has to carry away is still in there with the molecules,
     floating, and the drawing can say so at a weight that costs the strands
     nothing. REST is the fraction of its own birth strength each piece of the
     cell keeps once the beat is over — low enough that the molecules are
     plainly the subject, high enough that the debris is still there to be
     washed off next door. */
  const WALL=0.46, PORE=0.26, CYTO=0.06, NUCO=0.13, REST=0.24;
  const TRI=[[-0.34,-0.30],[0.34,-0.30],[0,0.34]];
  const SEG=7, NSTR=3, RAD0=R*0.30;
  const ringPts=(rad,a0,a1)=>{ const o=[];
    for(let i=0;i<=7;i++){ const a=a0+(a1-a0)*i/7;
      o.push([rad*Math.cos(a), rad*Math.sin(a)]); } return o; };
  const cells=TRI.map(([fx,fy],ci)=>{
    const cg=el("g",{transform:
      `translate(${(fx*LRX).toFixed(1)},${(fy*LRY).toFixed(1)})`});
    lens.appendChild(cg);
    const body=el("circle",{cx:"0",cy:"0",r:(R*0.97).toFixed(1),
      fill:"var(--fg)","fill-opacity":CYTO.toFixed(2)});
    cg.appendChild(body);
    const nuc=el("circle",{cx:(-R*0.22).toFixed(1),cy:(R*0.12).toFixed(1),
      r:(R*0.30).toFixed(1),fill:"var(--fg)","fill-opacity":NUCO.toFixed(2)});
    cg.appendChild(nuc);
    const seg=[], pore=[];
    for(let i=0;i<SEG;i++){
      /* the ring is rolled a little per cell: three identical membranes read
         as one drawing stamped three times, which is the one thing three
         cells must not look like */
      const roll=ci*0.31;
      const a0=(i/SEG)*2*Math.PI+0.13+roll, a1=((i+1)/SEG)*2*Math.PI-0.13+roll,
            am=(a0+a1)/2;
      const p=el("polyline",{points:pts(ringPts(R,a0,a1)),fill:"none",
        stroke:"var(--fg)","stroke-width":"1",
        "stroke-opacity":WALL.toFixed(2),"stroke-linecap":"round"});
      cg.appendChild(p);
      seg.push({p, a:am, mid:[R*Math.cos(am), R*Math.sin(am)],
                spin:(i%2?1:-1)*(26+i*8)});
      const gp=a1+0.13;
      pore.push(cg.appendChild(el("circle",{
        cx:(R*Math.cos(gp)).toFixed(1), cy:(R*Math.sin(gp)).toFixed(1),
        r:(R*0.085).toFixed(2), fill:"none", stroke:"var(--fg)",
        "stroke-width":".7","stroke-opacity":PORE.toFixed(2)})));
    }
    /* WHAT SPILLS IS A HANDFUL PER CELL, NOT ONE AND NOT FIFTY. One molecule
       crossing a wall reads as an incident; three read as the contents of a
       cell, and nine in the glass read as a lysate. Past a handful each the
       chips stop resolving and the whole thing becomes a cloud.

       THEY LEAVE OUTWARD FROM THE MIDDLE OF THE LENS, each cell's fan swung
       to face away from the centre, so the three bursts open outward instead
       of firing into each other — but the fan is most of a turn wide, so the
       inside gaps fill too. */
    const EXIT=Math.atan2(fy*LRY, fx*LRX);
    const strands=[];
    for(let k=0;k<NSTR;k++){
      const a=EXIT-0.42*Math.PI+k*(0.92*Math.PI/(NSTR-1));
      const s={a, r0:RAD0*(0.62+0.19*k), r1:R*(0.86+0.06*(k%3)),
               rot:a*180/Math.PI+(k%2?12:-14), g:el("g",{})};
      molecule(s.g, BC3[ci], (ci*2.1+k*1.7));
      cg.appendChild(s.g);
      strands.push(s);
    }
    strands.forEach(s=>setStrand(s,0));
    return {seg, pore, body, nuc, strands};
  });
  /* the boundary last, so nothing inside is drawn over its line */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LRX.toFixed(1),ry:LRY.toFixed(1),
    fill:"none",stroke:"var(--fg2)","stroke-width":"1","stroke-opacity":".55"}));

  const easeOut=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
  const burst=(f0)=>{
    const F=Math.max(0,Math.min(1,f0));
    cells.forEach((C,ci)=>{
      /* a tenth of the beat between them, and the window shortened to match so
         the last one still finishes ON the beat: three cells going off in
         unison is one cell drawn three times, and three cells strung out over
         the whole beat is a queue */
      const f=Math.max(0,Math.min(1,(F-ci*0.10)/0.80)), a=f*f;
      C.seg.forEach(s=>{
        /* each arc leaves along its own radius and turns about its own middle:
           turning about the centre of the cell would only slide it round the
           ring it is still part of */
        s.p.setAttribute("transform",
          `translate(${(Math.cos(s.a)*R*0.48*a).toFixed(1)},`+
          `${(Math.sin(s.a)*R*0.48*a).toFixed(1)}) `+
          `rotate(${(s.spin*a).toFixed(1)},${s.mid[0].toFixed(1)},${s.mid[1].toFixed(1)})`);
        /* the arcs dim to REST and stop there: what is held at the end of this
           beat is nine molecules in solution and the wreckage they are in
           solution WITH, drifting and nearly out of the picture but not out of
           the tube — the wash that finally removes it is B8's, not this beat's */
        s.p.setAttribute("stroke-opacity",(WALL*(1-(1-REST)*f)).toFixed(2));
      });
      /* the pores go first and fastest — a hole in a wall stops meaning
         anything once the wall is in pieces — but they stop where the wall
         stops, because one rule for the debris is what keeps it one object */
      C.pore.forEach(p=>p.setAttribute("stroke-opacity",
        (PORE*Math.max(REST,1-f*1.8)).toFixed(2)));
      C.body.setAttribute("fill-opacity",(CYTO*Math.max(REST,1-f)).toFixed(2));
      C.nuc.setAttribute("fill-opacity",(NUCO*(1-(1-REST)*0.9*f)).toFixed(2));
      /* the strands are the one thing that eases to a stop inside the burst:
         they are not thrown out, they diffuse out, and they brighten because
         they are now in open solution rather than behind a wall */
      const e=easeOut(f);
      C.strands.forEach(s=>setStrand(s,e));
    });
  };

  /* ---- TIMING -------------------------------------------------------------
     A TRIP IS A ROW, so there are as many as the grid has rows. What is fixed
     is the sweep rather than the trip — a plate gets about five seconds and the
     rows divide it — with a floor under it, which is the shortest out-sit-
     return a hand reads as a movement. The deal is shorter because a fan has no
     hand in it. HOLD is not a pause: it is the beat the whole shape is for, and
     it is long enough that the opened cell is what you are left looking at. */
  const TRIP=Math.max(0.62, 5.0/ROWS), DEAL=2.8, LYSE=2.8, HOLD=1.9;
  const T1=ROWS*TRIP, T2=T1+DEAL, T3=T2+LYSE, T4=T3+HOLD;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const GO=0.28, SIT=0.52, RET=0.80;
  const WIN=0.34, phase=(i,k)=>i*(1-WIN)/(k-1);

  const rowOf=j=>from.slice(j*COLS,(j+1)*COLS);
  const midOf=row=>[(row[0].e.x+row[COLS-1].e.x)/2,
                    (row[0].e.y+row[COLS-1].e.y)/2];
  const wet=(w,op,k)=>{ w.fill.setAttribute("fill-opacity",op.toFixed(2));
    w.fill.setAttribute("rx",(w.rx*k).toFixed(2));
    w.fill.setAttribute("ry",(w.ry*k).toFixed(2)); };

  const LIFT=10*SC;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  let hx=mouth[0], hy=mouth[1];
  const place=(x,y)=>{ hx=x; hy=y;
    pip.setAttribute("transform",`translate(${x.toFixed(1)},${y.toFixed(1)})`); };
  const hop=(a,b,f0)=>{ const f=ease(clamp(f0));
    place(a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f-Math.sin(f*Math.PI)*LIFT); };
  const tipAt=i=>{ const o=i-(COLS-1)/2; return [hx+o*STEP[0], hy+o*STEP[1]]; };
  /* twelve tips hold twelve DIFFERENT wells on the way in, so both the load and
     the drop take a function of the channel: one colour across the comb would
     say the row was one thing, which is exactly what it is not yet */
  const carry=(hue,op)=>loads.forEach((l,i)=>{
    l.setAttribute("fill",hue(i)); l.setAttribute("fill-opacity",op.toFixed(2)); });
  const fall=(hue,f,vis)=>drops.forEach((d,i)=>{
    const a=tipAt(i), b=[T.rim.x, T.surfY];
    d.setAttribute("fill",hue(i));
    d.setAttribute("cx",(a[0]+(b[0]-a[0])*f).toFixed(1));
    d.setAttribute("cy",(a[1]+(b[1]-a[1])*f).toFixed(1));
    d.setAttribute("fill-opacity",(vis*(1-f*0.6)).toFixed(2));
  });
  const dry=()=>drops.forEach(d=>d.setAttribute("fill-opacity","0"));
  const park=()=>{ dry(); carry(()=>POOLED.fill,0); place(mouth[0],mouth[1]); };

  let poured=0;
  const emptyTo=k=>{ while(poured<k) rowOf(poured++)
    .forEach(w=>w.fill.setAttribute("fill-opacity","0")); };

  let t=0, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before. A frame long enough to skip a beat — a tab coming
     back, a step in trace mode — must not leave the plate it skipped standing
     half full, and stating it outright is cheaper than reasoning about which
     transitions are possible. It is also what makes the loop CUT: mode 0
     restores a whole cell and a full plate in one frame rather than running the
     burst backwards, and nothing here ever reassembles. */
  const enter=(m)=>{
    mode=m;
    poured=m===0?0:ROWS;
    from.forEach(w=>wet(w, m===0?WOP:0, 1));
    setAllTubes(m>=2?1:0);
    blend(m===0?0:1);
    T.setLevel(m===1?1:0, null, 0);
    burst(m>=3?1:0);
    park();
    OUT.forEach(L=>setFanLine(L, m===1?0.18:0.07, 0));
  };
  const run=(dt)=>{
    t=(t+dt)%T4;
    const m = t<T1?0 : t<T2?1 : t<T3?2 : 3;
    if(m!==mode) enter(m);

    if(m===0){                                  // POOL — ninety-six into one
      const k=Math.min(ROWS-1,Math.floor(t/TRIP)), u=clamp((t-k*TRIP)/TRIP);
      const row=rowOf(k);
      emptyTo(k);
      const e=u<GO?0:Math.min(1,(u-GO)/(SIT-GO));   // the row empties as the comb sits
      row.forEach(w=>wet(w,WOP*(1-e),1-0.3*e));

      const dis=u>RET ? easeOut((u-RET)/(1-RET)) : 0;
      const lvl=(k+dis)/ROWS;
      /* the surface flashes the colour of what just went in, and a row is
         twelve colours against one meniscus — so it takes the middle well's,
         which is the one the eye was following the head across */
      const last=(dis>0?k:Math.max(0,k-1))*COLS+(COLS>>1);
      T.setLevel(lvl, (k||dis)?{fill:from[last].hue}:null,
                 dis>0?1:Math.max(0,1-u*2));
      /* the convergence is tied to the LEVEL, not to the clock: what makes the
         hues one is more of them being in the same tube */
      blend(lvl*1.12);

      const mid=midOf(row), wp=[mid[0], mid[1]-1*SC];
      if(u<GO)       hop(mouth,wp,u/GO);
      else if(u<SIT) place(wp[0],wp[1]);
      else if(u<RET) hop(wp,mouth,(u-SIT)/(RET-SIT));
      else           place(mouth[0],mouth[1]);

      const vis=Math.max(0.45,WOP), hue=i=>row[i].hue;
      carry(hue, u<GO ? 0 : u<SIT ? vis*e : dis>0 ? vis*(1-dis) : vis);
      if(dis>0) fall(hue,dis,vis); else dry();
      return;
    }

    if(m===1){                                  // DEAL — one tube into sixteen
      const u=(t-T1)/DEAL; let done=0;
      for(let k=0;k<NTUBE;k++){
        /* eased per tube, so each one arrives and settles rather than ramping
           at a constant rate into a stop */
        const f=easeOut((u-phase(k,NTUBE))/WIN);
        setFanLine(OUT[k],0.18,clamp((u-phase(k,NTUBE))/WIN));
        fillTube(k,f); done+=f;
      }
      T.setLevel(clamp(1-done/NTUBE), null, 0);
      return;
    }

    if(m===2){                                  // LYSE — the one cell that opens
      burst(clamp(((t-T2)/LYSE-0.16)/0.62));
      return;
    }

    /* held: sixteen loaded tubes, an opened cell, and a membrane that is not
       coming back. The fan is left faintly standing so the station still says
       what it does when nothing is moving. */
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.countsplitlyse = drawCountSplitLyse;


/* ==================================================================
   B8 · CAPTURE, TEMPLATE SWITCH, AMPLIFY
   The biotin ligated in round three is finally used as a handle:
   streptavidin beads take hold of the barcoded cDNA by that biotin, a
   magnet holds the beads against one wall, and everything that was
   never on a bead is drained off.

   ONE OBJECT ON THE BENCH, AND THE ARGUMENT ONE SCALE UP. This station
   used to draw a rack, a thermal cycler and two flows between them —
   three beats laid out along y. None of the three is where the claim
   lives. What matters here is which molecules a bead takes and which
   it leaves, and that is invisible at tube scale no matter how many
   tubes are drawn. So the bench is now the single instrument the step
   is named for, and the selection is made in a magnification over it,
   where it can actually be watched. The block still amplifies; it is
   the sentence in the reader that says so, because a closed lid at
   this size says nothing the reader does not already say better.

   THE GLASS HANGS FORWARD AND DOWN RATHER THAN ABOVE, and that is
   forced by the neighbours, not chosen. Everything over this tube is
   spoken for: B7's counting plate stands directly above it, B7's own
   name runs across the airspace to the upper left, and the diagonal up
   and to the right is where this station's name runs. The one empty
   quarter of the screen is the floor in front and to the right,
   between B7's rack and B9's bench, so the glass hangs there and two
   leaders run back up to the tube it magnifies. It is the idiom B7
   next door already uses, for the same reason and in the same
   direction.

   THE THERMAL CYCLER STAYS IN THIS FILE. C2 draws one and calls it as
   a component, which is why it was written as one in the first place;
   what has gone is this station's use of it, not the machine.

   Reuses ellipseAt / arcPts from the clutch block. Spends --pool,
   --ch3 and three of the --ch ramp, all declared on /molecular_pipe,
   the only page carrying a node that wears this shape.
   ================================================================== */

/* THE MAGNETIC RACK. A charcoal block with strips of 0.2 ml tubes standing in
   it, and the magnets showing as pale insets in the near wall.

   THE MAGNETS ARE IN THE WALL, NOT BESIDE IT. A rack's magnets are buried in
   the block. Standing a bar next to the plastic makes the magnet a second
   object on the bench and invites the reader to ask what holds it there; three
   pale plates set into the face say the same thing about one object.

   NOTHING HERE SWITCHES ON. A rack's magnet is a lump of neodymium, and what
   changes at the bench is that the tubes are set down on it. But a strip
   hopping in and out of a block every few seconds reads as a glitch rather than
   as a step, so the plastic stays put and the wash over the magnets is what
   says which of the two states the tube is in.

   `r` is {x,y,w,d,h} for the block plus `tubes` per strip and `strips` across
   its depth — laid out that way rather than as a flat total so the moulded web
   that makes eight tubes one strip has a row to span, and so a kit with a
   different strip length is a change of one number. Returns the rim of every
   tube, the index of the near strip's first, and the field. */
function magnetRack(g, r){
  const N=r.tubes||8, STRIPS=r.strips||1;
  /* --t-* is this page's charcoal in the mode it opens in and its opposite in
     the other, which is the bargain every skin on this map makes. What has to
     survive the flip is that the magnets read as a different material from the
     wall they are set in, and --t-* against --m-top does in both. */
  paint(g, r.x, r.y, r.w, r.d, r.h,
        {top:V("t-top"),left:V("t-left"),right:V("t-right"),sw:1.4,so:.9});

  /* a hair proud of the near face, so the face cannot swallow its own inset */
  const fy=r.y+r.d/2+0.002;
  const quad=(x0,x1,z0,z1)=>pts([P(x0,fy,z1),P(x1,fy,z1),P(x1,fy,z0),P(x0,fy,z0)]);
  const mags=[];
  for(let i=0;i<3;i++){
    const cx=r.x-r.w/2+(i+0.5)*r.w/3, hw=r.w*0.115, z0=r.h*0.22, z1=r.h*0.78;
    /* r.mag lets one bench give its plates a hue of their own without every
       other rack on the map inheriting it */
    g.appendChild(el("polygon",{points:quad(cx-hw,cx+hw,z0,z1),fill:r.mag||"var(--m-top)",
      "fill-opacity":r.mag?".9":".5",stroke:"var(--stroke)","stroke-width":r.mag?"1.1":".8",
      "stroke-opacity":r.mag?".8":".55"}));
    /* the field rides on its own copy of the plate rather than on the plate's
       own fill, so lighting it never has to remember what colour it was */
    const f=el("polygon",{points:quad(cx-hw,cx+hw,z0,z1),fill:"var(--signal)",
      "fill-opacity":"0"});
    g.appendChild(f); mags.push(f);
  }

  const RT=r.w*0.042, RH=r.h*1.60;
  const wz1=r.h+RH*0.86, wz0=wz1-r.h*0.30;
  const xA=r.x-r.w/2+0.5*r.w/N-RT, xB=r.x-r.w/2+(N-0.5)*r.w/N+RT;

  const rims=[];
  /* BACK STRIP FIRST. On this grid the order things are appended in is the
     order they occlude in, and a near strip standing behind the one it is in
     front of is the one way two rows of identical plastic read as wrong. */
  for(let j=0;j<STRIPS;j++){
    const cy=r.y-r.d/2+(j+0.5)*r.d/STRIPS;
    /* THE WEB IS WHAT MAKES EIGHT TUBES A STRIP. Without it this is sixteen
       loose tubes standing in a block, which is a different consumable and a
       different claim about how a sublibrary is handled. Near face then top, so
       the tubes drawn after it stand in front of their own moulding. */
    g.appendChild(el("polygon",{points:pts([P(xA,cy+RT,wz1),P(xB,cy+RT,wz1),
      P(xB,cy+RT,wz0),P(xA,cy+RT,wz0)]),fill:"var(--t-right)","fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
    g.appendChild(el("polygon",{points:pts([P(xA,cy-RT,wz1),P(xB,cy-RT,wz1),
      P(xB,cy+RT,wz1),P(xA,cy+RT,wz1)]),fill:"var(--t-top)","fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));

    for(let i=0;i<N;i++){
      const cx=r.x-r.w/2+(i+0.5)*r.w/N;
      const rim  =ellipseAt(cx,cy,r.h+RH,RT),
            foot =ellipseAt(cx,cy,r.h,RT*0.46),
            inner=ellipseAt(cx,cy,r.h,RT*0.40),
            surf =ellipseAt(cx,cy,r.h+RH*0.44,RT*0.70);
      const silh=pts([[rim.x+rim.rx,rim.y],...arcPts(foot,0,Math.PI,8),
                      [rim.x-rim.rx,rim.y],...arcPts(rim,Math.PI,2*Math.PI,12)]);
      g.appendChild(el("polygon",{points:silh,fill:"var(--g-top)","fill-opacity":".38"}));
      /* every tube carries the same lysate at the same level and stays that way.
         Eight tubes at this pitch are four pixels wide each: anything that
         changed in one of them would be a flicker, not a reading. */
      g.appendChild(el("polygon",{points:pts([...arcPts(surf,2*Math.PI,Math.PI,10),
                                              ...arcPts(inner,Math.PI,0,8)]),
        fill:"var(--pool)","fill-opacity":".45"}));
      g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
        "stroke-width":".9","stroke-opacity":".7"}));
      g.appendChild(el("ellipse",{cx:rim.x.toFixed(1),cy:rim.y.toFixed(1),
        rx:rim.rx.toFixed(2),ry:rim.ry.toFixed(2),fill:"none",stroke:"var(--stroke)",
        "stroke-width":"1","stroke-opacity":".8"}));
      rims.push(rim);
    }
  }
  return {rims, near:(STRIPS-1)*N,
    setField:f=>{ const v=(0.42*Math.max(0,Math.min(1,f))).toFixed(2);
                  mags.forEach(m=>m.setAttribute("fill-opacity",v)); }};
}

/* THE THERMAL CYCLER. A chassis, a heated block with a well for every tube in
   the run, a lid that comes down on it, and a row of pips on the front.

   THE LID COMES DOWN RATHER THAN SWINGING. A hinge in this projection is a
   rotation about the block's back edge, which needs a lid drawn as faces that
   all shear as it turns and reads as a lid tearing rather than opening. A
   heated lid also genuinely clamps — the whole point of it is the pressure it
   puts on the caps — so a prism travelling down its own axis is both one
   transform and the honest reading of the machine.

   THE PIP ROW COUNTS EIGHT AND ONLY EVER FILLS SIX. The cycle count comes off
   a table keyed on cells per sublibrary and RNA content — six cycles for
   high-RNA material, eight for low, seven for nuclei — and no run-specific
   record of which was used survives on this instance. So the two pips past the
   floor of that band are drawn hollow and stay hollow: the row says the band
   and refuses to say the number, which is the state of the record.

   THE BAND IS THE STATION'S, THOUGH, NOT THE COMPONENT'S. C2 runs the same
   machine off a different table — seven cycles to thirteen — so the count and
   the floor are handed in, and the same window is divided by however many
   arrive rather than a second readout being drawn beside the first.

   `c` is {x,y,w,d,h} plus cols/rows for the block and, optionally, pips/lit for
   the readout. Returns the port a flow can be aimed at, one aiming point per
   well, and the things the machine does.

   NOBODY WEARS IT AT THE MOMENT. B8a, C1 and C2 were each asked from the page
   to take their machine off the bench and leave the magnification, and C2 was
   the last of the three. It is kept whole rather than deleted because what
   those requests rejected was a shut instrument standing on a tile with
   nothing to show, not the component — a station that ever has to draw a
   cycler being loaded still wants this one. */
function thermalCycler(g, c){
  const COLS=c.cols||4, ROWS=c.rows||2;
  const PIPS=c.pips||8, LIT=c.lit===undefined?6:c.lit;
  /* PK is 1 at the eight this row was composed for, so B8 lays out exactly
     where it always did and a longer band squeezes rather than overflows */
  const PK=8/PIPS;
  /* a box that does not stand on the floor. faces() draws from z 0 and the
     projection is a pure translation in z, so lifting one is a transform on a
     group rather than a second set of face maths beside the first. */
  const lifted=(gg,x,y,w,d,z0,z1,s)=>{
    const gr=el("g",{transform:`translate(0,${(-z0*S*CZ).toFixed(2)})`});
    gg.appendChild(gr); paint(gr,x,y,w,d,z1-z0,s); return gr;
  };
  paint(g, c.x, c.y, c.w, c.d, c.h, SKIN.works);

  /* the readout, a hair proud of the front face so the face can never swallow
     it, with the pips laid along it */
  const fy=c.y+c.d/2+0.002;
  const quad=(x0,x1,z0,z1)=>pts([P(x0,fy,z1),P(x1,fy,z1),P(x1,fy,z0),P(x0,fy,z0)]);
  const rx0=c.x-c.w*0.36, rx1=c.x+c.w*0.36, rz0=c.h*0.30, rz1=c.h*0.68;
  g.appendChild(el("polygon",{points:quad(rx0,rx1,rz0,rz1),fill:"var(--bg)",
    "fill-opacity":".8",stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
  const pips=[];
  for(let i=0;i<PIPS;i++){
    const px0=rx0+(rx1-rx0)*(0.05+i*0.1175*PK), px1=px0+(rx1-rx0)*0.075*PK;
    const known=i<LIT;
    g.appendChild(el("polygon",{points:quad(px0,px1,rz0+(rz1-rz0)*0.22,rz1-(rz1-rz0)*0.22),
      fill:"none",stroke:"var(--fg2)","stroke-width":".7",
      "stroke-opacity":known?".55":".35","stroke-dasharray":known?"none":"2 2"}));
    if(known) pips.push(el("polygon",{points:quad(px0,px1,rz0+(rz1-rz0)*0.22,rz1-(rz1-rz0)*0.22),
      fill:"var(--signal)","fill-opacity":"0"}));
  }
  pips.forEach(p=>g.appendChild(p));

  /* the block, and the two tints on its top face. Two polygons rather than one
     with a colour that gets rewritten: a block on the way from 98C to 65C is
     both for a moment, and one fill can only ever be at one end of that. */
  const bx=c.x-c.w*0.02, by=c.y-c.d*0.10, bw=c.w*0.74, bd=c.d*0.62,
        bz=c.h, bt=c.h+c.h*0.55;
  lifted(g,bx,by,bw,bd,bz,bt,SKIN.monolith);
  const face=faces(bx,by,bw*0.92,bd*0.88,bt).top;
  const cold=el("polygon",{points:face,fill:"var(--signal)","fill-opacity":"0"});
  const hot =el("polygon",{points:face,fill:"var(--drop)","fill-opacity":"0"});
  g.appendChild(cold); g.appendChild(hot);

  const wells=[], slots=[];
  const wr=Math.min(bw/COLS,bd/ROWS)*0.30;
  for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
    const wx=bx-bw*0.44+(i+0.5)*bw*0.88/COLS,
          wy=by-bd*0.40+(j+0.5)*bd*0.80/ROWS;
    slots.push(P(wx,wy,bt+c.h*0.9));
    const e=ellipseAt(wx,wy,bt,wr);
    g.appendChild(el("ellipse",{cx:e.x.toFixed(1),cy:e.y.toFixed(1),
      rx:e.rx.toFixed(2),ry:e.ry.toFixed(2),fill:"var(--bg)","fill-opacity":".55",
      stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".5"}));
    const f=el("ellipse",{cx:e.x.toFixed(1),cy:e.y.toFixed(1),
      rx:(e.rx*0.82).toFixed(2),ry:(e.ry*0.82).toFixed(2),
      fill:"var(--ch6)","fill-opacity":"0"});
    g.appendChild(f); wells.push(f);
  }

  /* the lid is BUILT CLOSED and lifted by its group, so the geometry in it is
     the geometry of the machine at rest and the animation owns nothing but one
     attribute */
  const LIFT=c.h*1.15;
  const lid=el("g",{}); g.appendChild(lid);
  lifted(lid,bx,by,bw*1.10,bd*1.16,bt,bt+c.h*0.42,SKIN.sB);
  const handle=faces(bx,by+bd*0.30,bw*0.42,bd*0.12,bt+c.h*0.42).top;
  lid.appendChild(el("polygon",{points:handle,fill:"var(--fg)","fill-opacity":".18",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".6"}));

  const M={port:P(bx,by,bt+c.h*0.9), slots};
  M.setLid=f=>lid.setAttribute("transform",
    `translate(0,${(-LIFT*S*CZ*(1-Math.max(0,Math.min(1,f)))).toFixed(1)})`);
  M.setLid(0);
  /* `t` is where the block is between anneal and denature and `amt` is whether
     it is running at all: a cycler at rest is a cold lump of aluminium and
     should not be sitting there tinted blue */
  M.setTemp=(t,amt)=>{
    const k=Math.max(0,Math.min(1,t)), a=Math.max(0,Math.min(1,amt));
    hot .setAttribute("fill-opacity",(0.55*a*k).toFixed(2));
    cold.setAttribute("fill-opacity",(0.40*a*(1-k)).toFixed(2));
  };
  M.setWells=f=>{ const k=Math.max(0,Math.min(1,f));
    wells.forEach(w=>w.setAttribute("fill-opacity",(0.75*k).toFixed(2))); };
  /* setWells is the block as one thing, which is what a station running one
     reaction wants. C2 runs eight that stop being interchangeable partway
     through, so it needs each well to be able to say something the seven
     beside it do not. */
  M.setWell=(k,col,f)=>{ const w=wells[k]; if(!w) return;
    if(col) w.setAttribute("fill",col);
    w.setAttribute("fill-opacity",(0.75*Math.max(0,Math.min(1,f))).toFixed(2)); };
  M.setPips=k=>pips.forEach((p,i)=>
    p.setAttribute("fill-opacity",(i<k?0.85:0).toFixed(2)));
  return M;
}

function drawCapture(g,n){
  const SC=n.w/0.72, clamp=x=>Math.max(0,Math.min(1,x));
  const ease=u=>u*u*(3-2*u);
  const r=rng(83);

  /* ---- EVERY OFFSET IS A FRACTION OF THE NODE -----------------------------
     w, d and h are read at draw time because those are what a resize changes
     and a redraw is the only reason this function is running again. Composed
     at w .72, d .72, h .44.

     THE GLASS IS THE ANCHOR: its centre is the node's own ground point, so a
     drag on the node moves the glass first.

     THE RACK STANDS ON B7's LINE, NOT LEVEL ON SCREEN. Asked for from the
     page: B7 sets its strips and its plate down along the tile's depth, near-
     left to far-right, and this pair now runs parallel to that instead of
     straight across. The rack's centre is on the glass's own y axis, on the
     near side, the way B7's strips are. It was three units clear of the glass
     measured level; three units along this axis puts it on B7's lens, so the
     gap is now what fits between B7's rack and the glass's left magnet bar.
     Both are still solved off n, so a resize keeps the pair on its line.

     TWO STRIPS OF EIGHT, WHICH IS WHAT B7 NEXT DOOR SET DOWN. The eight
     sublibraries are split into sixteen tubes there and nothing between the
     two stations recombines them, so a single strip here quietly halved the
     plastic on its way across the tile. The two rows straddle where the one
     row stood — the block keeps its own footprint, and the near row is still
     well inside the near face. */
  const LX=53, LY=42, MG=2.6, MW=6.2, MH=27;
  const [KX,KY]=P(n.x, n.y, 0);
  /* THE GAP IS MEASURED ALONG THE LINE, from the ring to the rack's back face.
     A world unit of y is S pixels on screen down this diagonal, so the ring's
     radius along it, found in pixels, divides straight back into units.
     Asked for from the page: more room between the two. 0.65 read as the
     rack crowding the glass's magnet bar; 0.95 still leaves the rack well
     clear of B7's lens, because the extra slides it down the line beside
     B7's rack rather than towards it. */
  const GAP=n.w*0.95/0.72;
  const rw=n.w*1.55, rd=n.d*0.56, rh=n.h*0.50;
  const RU=SC/Math.hypot(C30/LX, 0.5/LY);
  const rack={x:n.x, y:n.y+RU/S+GAP+rd/2,
              w:rw, d:rd, h:rh, tubes:8, strips:2,
              mag:"var(--ch1)"};
  const T=magnetRack(g, rack);

  /* ---- THE HANDOVER -------------------------------------------------------
     Asked for from the page: a connection to the next module. The lane's track
     cannot be it — it runs ground to ground from under the block, and what
     goes on is what is in the tubes. What B8′ draws first is a strip of tubes standing at a shoulder, which
     its own note calls what B8 hands over, and it stands just up the page
     from this rack. So one arc runs from the back strip's nearest tube into
     that strip: the same line and chevron B8′ and the pool-and-split benches use
     for a transfer, so it reads as material moving rather than as wiring.

     THE FAR END IS A FRACTION OF THIS NODE, not a read of B8′'s — C4 reaches
     back to Sa's lid the same way. A resize here moves both ends with the
     rack; B8′ moving on its own would leave this one pointing where it was,
     and that is the bargain every cross-tile reach on this row makes.

     Neutral ink, and lit only once the wash has cleared the glass: what goes
     on is the held cDNA, not the lysate, so the bead cannot leave before the
     debris does. The line stays faintly drawn the rest of the loop, because
     the connection is a fact about the station and not only about that beat.

     ASKED FOR AGAIN — "draw a connector to the next step" — BECAUSE IT WAS
     NOT BEING SEEN. The ends are right: laid out, the far end lands on B8′'s
     strip to within half a pixel. The weight was wrong. At 0.22 and a hair
     stroke, an arc this short reads as a scratch among the rims of sixteen
     tubes, so it rests at REST and draws heavier, scaled with the node — the
     same answer B8a's handover got for the same complaint. */
  const REST=0.55;
  /* from the back strip's LAST tube, now the rack stands left of the glass:
     B8′'s strip is up and to the right, and the first would throw the arc
     back across every rim in the strip to get there */
  const from=T.rims[rack.tubes-1];
  const hand=flowLine(g, [from.x, from.y-from.ry],
    P(n.x-n.w*0.57, n.y-n.d*0.94, n.h*0.62), "var(--fg2)", SC);
  hand.line.setAttribute("stroke-width",(1.6*SC).toFixed(2));
  /* the chevron already carries scale(SC), so its width is written unscaled */
  hand.chev.setAttribute("stroke-width","1.6");
  setFanLine(hand, REST, 0);

  /* ---- THE MAGNIFICATION --------------------------------------------------
     A thin solid ellipse with two leaders back to one tube: the idiom this map
     uses everywhere for a view drawn larger than life. A solid ring means
     "magnified"; nothing else on this bench is allowed to be one.

     THE GLASS IS SIZED IN SCREEN PIXELS AND SCALED BY BEING SCALED. What is
     inside it is a molecule, not a piece of the grid, so it has no world size
     to be authored in — it goes in a group carrying scale(n.w / .72) and every
     coordinate under it is written for the size this node happens to be
     authored at. A resize moves the glass and grows it, and everything in it
     travels with the transform rather than with a number somebody has to
     remember to change. */
  /* the glass's centre, KX KY, is set with the rack at the top of this
     function: it is the anchor and the rack is solved from it */
  /* the leaders name ONE tube — the back strip's right-hand one, now the glass
     stands behind the rack on its line: a leader to the near strip would run
     up across the back strip to get there — and they start ON the boundary
     rather than inside it, aimed at that tube's own rim, so glass that has
     moved or grown still points at the plastic */
  const anchor=T.rims[rack.tubes-1];
  [-1,1].forEach(s=>{
    const tx=anchor.x+s*anchor.rx, ty=anchor.y;
    const vx=tx-KX, vy=ty-KY, u=1/Math.hypot(vx/(LX*SC), vy/(LY*SC));
    g.appendChild(el("line",{x1:(KX+vx*u).toFixed(1),y1:(KY+vy*u).toFixed(1),
      x2:tx.toFixed(1),y2:ty.toFixed(1),stroke:"var(--fg2)",
      "stroke-width":(0.8*SC).toFixed(2),"stroke-opacity":".4"}));
  });

  const lens=el("g",{transform:
    `translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in the
     drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,
    fill:"var(--bg)","fill-opacity":".92"}));

  /* THE WALL THE BEADS END UP ON. A magnification of a volume has no landmark
     in it at all unless one is drawn, and the one that matters here is which
     side the magnets are behind — the whole event is a sweep to that side. It
     carries the same pale as the plates in the block, so the two read as one
     fact seen at two scales rather than as two decorations. */
  /* TWO WALLS, ONE EACH SIDE. Asked for from the page: three strands land on
     one side and three on the other, so the tube is drawn sitting between two
     plates and the sweep splits rather than all going one way.

     THE PLATES ARE STRAIGHT, SOLID AND STAND OFF THE RING. Asked for from the
     page again: pale arcs stroked on the ring itself read as a thickening of
     the glass, not as a magnet beside the tube. A straight bar cannot be
     mistaken for a piece of an ellipse, the gap says it is a separate object,
     and --ch1 is a hue nothing else in the glass wears — the plates on the
     rack take the same, so the two still read as one fact at two scales. */
  [-1,1].forEach(s=>lens.appendChild(el("rect",{
    x:(s<0 ? -LX-MG-MW : LX+MG).toFixed(1), y:(-MH).toFixed(1),
    width:MW.toFixed(1), height:(2*MH).toFixed(1), rx:"1.4",
    fill:"var(--ch1)","fill-opacity":".95",
    stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".7"})));

  /* the debris leaves the field of view, which means it has to be able to go
     past the boundary and stop existing there rather than at the edge of the
     screen. Uniqued the way the tank clips are: a checker draws this shape
     twice, at two sizes, into one document. */
  const cid=`capglass${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY}));
  lens.appendChild(cp);
  const stage=el("g",{"clip-path":`url(#${cid})`,opacity:"0"});
  lens.appendChild(stage);

  /* ---- WHAT IS IN THE TUBE ------------------------------------------------
     Six barcoded strands and a dozen pieces of debris, and the difference
     between them is the entire step. A strand carries three chips — the three
     rounds of in-situ barcoding — and one gold drop at its tip, which is the
     biotin round three put there. The debris carries neither. Nothing else in
     this glass is gold, because gold is the only thing a bead can hold, and a
     second use of it would make the selection look arbitrary.

     THE DEBRIS IS FORMLESS ON PURPOSE. It is what is left of ninety-five
     thousand lysed cells, and any shape given to it — a fragment, a coil, a
     smaller strand — would be a claim about what it is. A blob with no
     features says only that it is not the thing being kept. */
  const HL=15, TIP=HL+5.4;
  const CHIP=["var(--ch8)","var(--ch11)","var(--ch4)"];
  const spine=k=>{ let d=`M ${-HL} 0`;
    for(let s=1;s<=10;s++)
      d+=` L ${(-HL+2*HL*(s/10)).toFixed(1)} ${(Math.sin(s*0.86+k)*2.1).toFixed(1)}`;
    return d; };

  /* the first three point right, meet beads coming in from the right and are
     swept to the left wall; the last three are the same event mirrored. Free,
     the six are a tangle; held, they are two columns of three tip-to-wall, so
     what the wash leaves behind reads as sorted rather than merely left over. */
  const FREE=[[8,-24,-12],[18,2,16],[-2,24,-8],
              [-12,-12,196],[-20,8,168],[22,19,174]];
  const HELD=[[-18,-14,188],[-17,1,178],[-19,13,194],
              [18,-14,352],[17,1,362],[19,13,346]];
  const strands=FREE.map((f,i)=>{
    const sg=el("g",{transform:`translate(${f[0]},${f[1]}) rotate(${f[2]})`});
    stage.appendChild(sg);
    sg.appendChild(el("path",{d:spine(i*1.9),fill:"none",stroke:"var(--c-top)",
      "stroke-width":"1.5","stroke-opacity":".75","stroke-linecap":"round"}));
    CHIP.forEach((c,k)=>sg.appendChild(el("rect",{x:(-8.4+k*6.2).toFixed(1),y:"-1.9",
      width:"4.6",height:"3.8",rx:"1.1",fill:c,"fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"})));
    sg.appendChild(el("path",{d:`M ${HL-0.6} 0 C ${HL+1.4} -3.3 ${TIP} -2.2 ${TIP} 0 `+
      `C ${TIP} 2.2 ${HL+1.4} 3.3 ${HL-0.6} 0 Z`,fill:"var(--ch3)","fill-opacity":".95",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"}));
    return {g:sg, free:f, held:HELD[i], ph:r()*6.283};
  });

  /* ENOUGH OF IT TO GET IN THE WAY. Asked for from the page: the debris should
     partly obscure the strands, so there is more of it, some of it larger, and
     it sits over the strands in the stacking order with a sum of pale it is
     hard to read through. Each piece has its own density — a lysate is not an
     even haze, and one flat opacity over twenty blobs reads as a filter laid
     on the glass rather than as stuff in the tube. The eight added pieces lie
     over where the strands start and where the two columns end up, so the
     wash is what uncovers them.

     AND THEN MORE. Asked for from the page a second time: the strands should
     be hard to make out at all until the wash. So sixteen more pieces go down
     over the strands' whole range, every piece is larger, and the thinnest
     of them is denser than the old average — the chips still show through
     here and there, which is enough to say something is under there without
     letting it be read. The beads stay above it all in the stacking order:
     they find their strands by chemistry, not by sight, and the viewer has
     to be able to watch them do it. */
  const debris=[[-34,-14],[-38,6],[-26,24],[-12,-30],[-5,-2],[6,12],
                [18,-18],[32,-12],[38,4],[10,33],[-14,35],[30,-28],
                [-20,-8],[-15,15],[14,-4],[20,12],[0,-18],[-2,20],
                [-28,-24],[26,24],
                [-8,-20],[4,-10],[12,24],[-24,16],[24,-6],[-6,8],
                [16,-28],[-18,-22],[28,14],[-30,-2],[8,4],[-10,26],
                [22,-20],[-22,28],[34,-18],[-36,-8]].map(p=>{
    const dg=el("g",{transform:`translate(${p[0]},${p[1]})`});
    stage.appendChild(dg);
    const q=[], sz=1.1+r()*0.9;
    for(let k=0;k<9;k++){ const a=k*6.283/9, rr=(2.8+r()*2.8)*sz;
      q.push(`${(Math.cos(a)*rr).toFixed(1)},${(Math.sin(a)*rr*0.8).toFixed(1)}`); }
    const den=r();
    dg.appendChild(el("polygon",{points:q.join(" "),fill:"var(--fg3)",
      "fill-opacity":(0.42+0.45*den).toFixed(2),stroke:"var(--fg3)",
      "stroke-width":".8","stroke-opacity":(0.35+0.35*den).toFixed(2)}));
    return {g:dg, at:p, ph:r()*6.283, dl:r()*0.3};
  });

  /* A BEAD IS A FILLED CIRCLE WITH A HOOK CUT OUT OF IT. Streptavidin is a
     pocket, and the one thing the drawing has to be able to say is that the
     pocket shuts on something — so the hook is an arc whose gap closes rather
     than a mark that fades in. Cut in --bg, so it is a hole in the bead and
     not an ornament on it. */
  const HR=3.9;
  const setHook=(b,c)=>{ const a=(52-36*clamp(c))*Math.PI/180;
    b.hook.setAttribute("d",
      `M ${(HR*Math.cos(-a)).toFixed(1)} ${(HR*Math.sin(-a)).toFixed(1)} `+
      `A ${HR} ${HR} 0 1 0 ${(HR*Math.cos(a)).toFixed(1)} ${(HR*Math.sin(a)).toFixed(1)}`);
  };
  [[57,-15],[60,3],[56,17],[-57,-17],[-60,1],[-56,15]].forEach((e,i)=>{
    const bg=el("g",{transform:`translate(${e[0]},${e[1]})`,opacity:"0"});
    stage.appendChild(bg);
    bg.appendChild(el("circle",{cx:"0",cy:"0",r:"5.2",fill:"var(--fg)",
      "fill-opacity":".82",stroke:"var(--stroke)","stroke-width":".6",
      "stroke-opacity":".5"}));
    const hook=el("path",{d:"",fill:"none",stroke:"var(--bg)","stroke-width":"1.7",
      "stroke-linecap":"round"});
    bg.appendChild(hook);
    strands[i].b={g:bg, hook, entry:e};
    setHook(strands[i].b, 0);
  });

  /* the ring last, over everything, so nothing inside can soften its own edge */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,fill:"none",
    stroke:"var(--fg2)","stroke-width":"1.5","stroke-opacity":".85"}));

  /* ---- TIMING -------------------------------------------------------------
     Capture is the long beat — twenty minutes of binding at the bench, and the
     step the station is named for — so the beads take their time coming in and
     arrive one after another rather than together. The pull is quick, because
     a rack clears in under a minute and because six things splitting to two
     walls at once is the only moment on this bench that reads as an event.

     PLACEMENT IS A PURE FUNCTION OF THE CLOCK. Every element is stated from t
     alone rather than nudged from where it was, so a frame long enough to skip
     a whole beat — a tab coming back, a step in trace mode — cannot leave a
     bead halfway to a strand it has already left. */
  /* THE SORT FINISHES BEFORE THE WASH BEGINS. Asked for from the page: the
     strands are in their two columns and still under the debris, and only
     then does the debris go. Overlapping the two made the columns look like
     what was left when the rubbish fell away, rather than something the
     magnet had already done. */
  const T_IN=1.8, CAPD=1.1, STAG=0.26, T_PULL=3.7, PULLD=2.0;
  const T_WASH=T_PULL+PULLD+0.5, WASHD=1.8, HOLD=1.5, CLEAR=0.7;
  const TOT=T_WASH+WASHD+HOLD+CLEAR;
  const rot=(a,x)=>[x*Math.cos(a), x*Math.sin(a)];

  const place=(t,ph)=>{
    const pull=ease(clamp((t-T_PULL)/PULLD));
    stage.setAttribute("opacity",
      Math.min(clamp(t/0.4), 1-clamp((t-(TOT-CLEAR))/CLEAR)).toFixed(2));
    /* the jostle stops when the field comes on, which is the one thing a
       magnet visibly does to a suspension */
    const jig=(1-pull)*1.5;
    strands.forEach((sd,i)=>{
      const px=sd.free[0]+(sd.held[0]-sd.free[0])*pull+Math.cos(ph*0.8+sd.ph)*jig;
      const py=sd.free[1]+(sd.held[1]-sd.free[1])*pull+Math.sin(ph*0.6+sd.ph)*jig;
      const ang=sd.free[2]+(sd.held[2]-sd.free[2])*pull;
      sd.g.setAttribute("transform",
        `translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${ang.toFixed(1)})`);
      /* the bead settles just past the gold rather than on top of it: a bead
         parked over the biotin hides the reason it is there */
      const c=ease(clamp((t-T_IN-i*STAG)/CAPD));
      const tp=rot(ang*Math.PI/180, TIP+4.6);
      const bx=sd.b.entry[0]+(px+tp[0]-sd.b.entry[0])*c;
      const by=sd.b.entry[1]+(py+tp[1]-sd.b.entry[1])*c;
      sd.b.g.setAttribute("transform",
        `translate(${bx.toFixed(1)},${by.toFixed(1)}) rotate(${(ang+180).toFixed(1)})`);
      sd.b.g.setAttribute("opacity",(0.95*clamp(c/0.22)).toFixed(2));
      setHook(sd.b, (c-0.62)/0.38);
    });
    /* THE DEBRIS IS NEVER TOUCHED AND THEN IT IS GONE. No bead goes near it,
       nothing about it changes while the beads work, and when the magnet comes
       on and the strands have been sorted it drains straight down and out of
       the glass. That sequence is the claim the whole station rests on. Each
       piece leaves on its own small delay, so it goes as a wash rather than as
       one slab dropping, and the held columns come out from under it. */
    debris.forEach(d=>{
      const out=ease(clamp(((t-T_WASH)/WASHD-d.dl)/0.7));
      const dx=d.at[0]+Math.cos(ph*0.7+d.ph)*jig*1.2;
      const dy=d.at[1]+Math.sin(ph*0.5+d.ph)*jig*1.2+out*(LY+26);
      d.g.setAttribute("transform",`translate(${dx.toFixed(1)},${dy.toFixed(1)})`);
      d.g.setAttribute("opacity",(1-clamp((out-0.35)/0.5)).toFixed(2));
    });
    T.setField(clamp((t-T_PULL+0.3)/0.5)*(1-clamp((t-(TOT-CLEAR))/CLEAR)));
    /* the handover runs through the hold, when the held columns are all that
       is left in the glass */
    setFanLine(hand, REST, (t-T_WASH-WASHD)/HOLD);
  };

  let t=0, ph=0;
  const run=dt=>{ t=(t+dt)%TOT; ph+=dt*1.7; place(t,ph); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.capture = drawCapture;

/* ------------------------------------------------------------------
   B8′ · TURN THE cDNA INTO A LIBRARY — three quiet objects on the bench,
   and the whole molecule once, under glass.

   ASKED FOR FROM THE PAGE, from "Add a module", and the request set the
   proportions itself: the bench objects are small and anchor the frame, the
   magnification is the subject. So the strip, the cycler and the plate carry
   no animation of their own. Nothing on the bench is the event; the glass is.

   THE BENCH STANDS BEHIND WHERE THE TRACK ENDS — there is no tile of its
   own to stand on; see below — not on that point. The ground either side is
   spoken for: B8a's glass sits centred on the next tile along and its left
   rim reaches back over this one, and B8's rack stands forward-left. Behind
   is the only clear ground, so the three objects stand in a screen-level row
   there — which is also what "in a row, left to right" means on an isometric
   grid, where a line along x runs down the page. The track and the dot
   still arrive at the node's own x, y.

   THE PLATE IS VIOLET AND HALF FULL BECAUSE THE REQUEST SAID SO, and the
   violet is --ch10 because that is the colour this row already gives a UDI:
   C2's construct wears it at both ends. The two UDI blocks in the glass
   share it, so the plate and the index read as one thing at two scales.

   SCORE, PART, CLOSE, ASSEMBLE, HOLD. The cut and the rounding-off are one
   eased parameter, as on C1, because the request put them in one breath —
   "the pieces separate, their cut ends rounding off as they part". Every
   free end gets a Y: the request said the free ends, not one end. Then the
   three plain pieces leave and the one carrying the chips moves to the
   middle, and the construct is laid over it left to right, P5 first, each
   block sliding in from the empty side with its name arriving with it.

   THE CHIPS ARE THE BARCODING ROUNDS' COLOURS. --ch8, --ch11 and --ch4 are
   what this row gives the three in-situ rounds wherever it draws a strand —
   B8's glass, B8a's, C2's construct — so BC1, BC2 and BC3 are the same three
   chips on the strand before the cut and in the bar after it. P5, P7, R1 and
   R2 are grey: none of them identifies anything, and colour on this row
   means identity.

   THE HOLD IS THE LONGEST BEAT AND THE RESTING STATE. The request asked for
   the complete construct to be held, so the clock starts inside the hold: a
   reader with motion turned off sees the whole molecule and nothing else.

   Reuses skirtSlab / plateGrid / drawWell from the plate set, flowLine /
   setFanLine from the fan and ellipseAt / arcPts from the clutch block.
   Spends --ch4, --ch6, --ch8, --ch10 and --ch11, declared on /molecular_pipe —
   the only page carrying a node that wears this.
   ------------------------------------------------------------------ */
function drawLibraryPrep(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w .72, d .72, h .40 — the tile B8a
     and B9 stand on. */
  const SC=n.w/0.72;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);
  const r=rng(241);
  const CDNA="var(--ch6)", UDI="var(--ch10)", ADPT="var(--fg2)", FLOW="var(--fg3)";
  const CHIP=["var(--ch8)","var(--ch11)","var(--ch4)"];

  /* a box that starts above the ground, which paint() cannot draw: the lid
     sits on the cycler rather than growing out of the floor */
  const slab=(x,y,w,d,z0,z1,skin)=>{
    const hw=w/2, hd=d/2;
    const c=[[x-hw,y-hd],[x+hw,y-hd],[x+hw,y+hd],[x-hw,y+hd]];
    const q=(i,z)=>P(c[i][0],c[i][1],z);
    [["left",[q(3,z1),q(2,z1),q(2,z0),q(3,z0)]],
     ["right",[q(1,z1),q(2,z1),q(2,z0),q(1,z0)]],
     ["top",[q(0,z1),q(1,z1),q(2,z1),q(3,z1)]]].forEach(([k,p])=>
      g.appendChild(el("polygon",{points:pts(p),fill:skin[k],
        stroke:"var(--stroke)","stroke-width":skin.sw,"stroke-opacity":skin.so})));
  };

  /* ---- THE BENCH, ONE SCREEN-LEVEL ROW BEHIND THE TILE --------------------
     BACK is how far behind; the two spans are how far either side of the
     cycler the strip and the plate stand. Walking +x and -y by the same amount
     is walking straight across the page, so the three sit level with each
     other and read left to right. */
  const BACK=1.60, LEFT=0.66, RIGHT=0.80;
  const cx=n.x-n.w*BACK, cy=n.y-n.d*BACK;

  /* the strip, in a low block. The web is what makes eight tubes a strip
     rather than eight loose tubes — C2's old strip's reasoning, smaller */
  const rack={x:cx-n.w*LEFT, y:cy+n.d*LEFT, w:n.w*0.62, d:n.d*0.22, h:n.h*0.22};
  paint(g,rack.x,rack.y,rack.w,rack.d,rack.h,SKIN.works);
  const PER=8, RT=n.w*0.030, RH=n.h*0.42;
  const WZ1=rack.h+RH*0.88, WZ0=WZ1-n.h*0.10;
  const xA=rack.x-rack.w/2+0.5*rack.w/PER-RT, xB=rack.x+rack.w/2-0.5*rack.w/PER+RT;
  g.appendChild(el("polygon",{points:pts([P(xA,rack.y+RT,WZ1),P(xB,rack.y+RT,WZ1),
    P(xB,rack.y+RT,WZ0),P(xA,rack.y+RT,WZ0)]),fill:"var(--t-right)","fill-opacity":".9",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".6"}));
  for(let i=0;i<PER;i++){
    const tx=rack.x-rack.w/2+(i+0.5)*rack.w/PER;
    const rim=ellipseAt(tx,rack.y,rack.h+RH,RT), foot=ellipseAt(tx,rack.y,rack.h,RT*0.5);
    const silh=pts([[rim.x+rim.rx,rim.y],...arcPts(foot,0,Math.PI,6),
                    [rim.x-rim.rx,rim.y],...arcPts(rim,Math.PI,2*Math.PI,8)]);
    g.appendChild(el("polygon",{points:silh,fill:"var(--g-top)","fill-opacity":".38"}));
    /* barcoded cDNA, standing at a shoulder — what B8 hands over */
    const lvl=ellipseAt(tx,rack.y,rack.h+RH*0.5,RT*0.72);
    g.appendChild(el("polygon",{points:pts([...arcPts(lvl,2*Math.PI,Math.PI,6),
      ...arcPts(foot,Math.PI,0,6)]),fill:CDNA,"fill-opacity":".6"}));
    g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".7"}));
    g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,fill:"none",
      stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".8"}));
  }

  /* the cycler: a works-skin body, a lid in the tile skin sitting on it, and
     one lamp. Unlit apart from that — a closed block is not where anything is
     seen happening, and the glass above it is */
  const cyc={x:cx, y:cy, w:n.w*0.60, d:n.d*0.52, h:n.h*0.50};
  paint(g,cyc.x,cyc.y,cyc.w,cyc.d,cyc.h,SKIN.works);
  const lidTop=cyc.h+n.h*0.14;
  slab(cyc.x,cyc.y-cyc.d*0.06,cyc.w*0.88,cyc.d*0.78,cyc.h,lidTop,SKIN.tile);
  const lamp=P(cyc.x-cyc.w*0.30,cyc.y+cyc.d/2,cyc.h*0.55);
  g.appendChild(el("ellipse",{cx:lamp[0].toFixed(1),cy:lamp[1].toFixed(1),
    rx:(1.5*SC).toFixed(2),ry:(1.1*SC).toFixed(2),fill:"var(--signal)","fill-opacity":".8"}));

  /* the plate: 96 wells, the left six columns filled and the right six drawn
     empty, which is the one thing about it a reader can check by counting */
  const plate={x:cx+n.w*RIGHT, y:cy-n.d*RIGHT, w:n.w*0.78, d:n.d*0.52};
  const pth=n.h*0.30;
  const deck=skirtSlab(g,plate,pth,UDI);
  const wet=[];
  plateGrid(deck,pth,12,8).forEach(w=>{
    drawWell(g,w,false);
    if(w.i<6) wet.push(el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:UDI,"fill-opacity":".9"}));
  });
  /* after every well, because drawWell lays a --bg disc in each socket and a
     fill appended as its well is built ends up under the next one's plastic */
  wet.forEach(f=>g.appendChild(f));

  /* two short flows, strip to cycler and cycler to plate, drawn dim and left
     still: they say the three belong to one bench, not that anything is
     moving along them at this scale */
  [[P(rack.x+rack.w/2,rack.y-rack.d/2,rack.h+RH*0.6), P(cyc.x-cyc.w/2,cyc.y+cyc.d/2,cyc.h*0.7)],
   [P(cyc.x+cyc.w/2,cyc.y-cyc.d/2,cyc.h*0.7),        P(plate.x-plate.w/2,plate.y+plate.d/2,pth)]]
    .forEach(([A,B])=>setFanLine(flowLine(g,A,B,FLOW,SC),0.34,0));

  /* NO TILE. There was one here, the plain box the track arrives at, and it
     was asked away from "Edit visual", as B8′a's was: with the bench and the
     glass drawn, a grey block in front of them reads as a second, empty
     module. The track still ends at n.x, n.y; the bench behind it is what it
     arrives at. */

  /* ---- THE MAGNIFICATION --------------------------------------------------
     A thin solid ellipse with two leaders down to the cycler's lid: the idiom
     this map uses everywhere for a view drawn larger than life. It hangs
     straight above the cycler because the request put it above the three, and
     it hangs HIGH because low is taken: a glass this wide on short leaders
     lands on B7's plate and tube behind this bench and in the middle of the
     names B6, B7 and B8 run up the sky. So it goes above where those names
     run out, the way C2's does, and to the left of C2's own glass, which is
     the only other thing hanging at that height in this stretch.

     WHAT IS INSIDE IT IS SIZED IN SCREEN PIXELS AND SCALED BY BEING SCALED —
     a group carrying scale(n.w / .72) — so a resize moves the glass, grows it,
     and takes the molecule along. */
  const LX=100, LY=42;
  const TOP=P(cyc.x,cyc.y,lidTop);
  const KX=TOP[0], KY=TOP[1]-(LY+116)*SC;
  [P(cyc.x-cyc.w*0.44,cyc.y+cyc.d*0.33,lidTop), P(cyc.x+cyc.w*0.44,cyc.y-cyc.d*0.45,lidTop)]
    .forEach(([tx,ty])=>{
      const vx=tx-KX, vy=ty-KY, u=1/Math.hypot(vx/(LX*SC), vy/(LY*SC));
      g.appendChild(el("line",{x1:(KX+vx*u).toFixed(1),y1:(KY+vy*u).toFixed(1),
        x2:tx.toFixed(1),y2:ty.toFixed(1),stroke:"var(--fg2)",
        "stroke-width":(0.8*SC).toFixed(2),"stroke-opacity":".4"}));
    });
  const lens=el("g",{transform:
    `translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in the
     drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,
    fill:"var(--bg)","fill-opacity":".92"}));
  /* blocks slide in from past the rim and have to stop existing at it. Uniqued:
     a checker draws this shape twice, at two sizes, into one document */
  const cid=`libglass${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY}));
  lens.appendChild(cp);
  const stage=el("g",{"clip-path":`url(#${cid})`});
  lens.appendChild(stage);
  const mol=el("g",{opacity:"1"});
  stage.appendChild(mol);

  /* ---- THE STRAND AND WHERE IT IS CUT -------------------------------------
     Pale and wandering up to the first chip and level from there, C1's
     grammar for a strand whose far end is synthetic. The cuts are not even
     quarters, and the last one is forced left of the chips: split the barcode
     chain across two pieces and the fragment that is meant to carry it does
     not exist. */
  const HL=50, C0=28, CP=7, CW=3;           // half-length, first chip, pitch, half-width
  const XLEV=C0-CW;
  const waveY=v=>v>=XLEV?0:(Math.sin((v-XLEV)*0.21+0.7)-Math.sin(0.7))*2.0;
  const cuts=[-26,-2,18].map(v=>v+(r()-0.5)*3);
  cuts[2]=Math.min(cuts[2],XLEV-4);
  const edge=[-HL,...cuts,HL], NF=4;
  /* GAPO has to clear two facing Ys, the two caps under them and a little
     daylight, or the adapters land across the neighbouring piece and four
     fragments read as one strand with hardware along it */
  const GAPO=21, CAPR=1.9, ST=3, AX=3.5, AY=3, GAPA=0.8;

  const frags=edge.slice(0,NF).map((a,k)=>{
    const b=edge[k+1];
    const grp=el("g",{transform:"translate(0,0)"});
    mol.appendChild(grp);
    const N=Math.max(4,Math.round((b-a)/2.5));
    let d="";
    for(let i=0;i<=N;i++){ const v=a+(b-a)*i/N;
      d+=(i?" L ":"M ")+v.toFixed(2)+" "+waveY(v).toFixed(2); }
    grp.appendChild(el("path",{d,fill:"none",stroke:CDNA,"stroke-width":"1.6",
      "stroke-opacity":".6","stroke-linecap":"round","stroke-linejoin":"round"}));
    if(k===NF-1) CHIP.forEach((fill,j)=>grp.appendChild(el("rect",{
      x:(C0+j*CP-CW).toFixed(1),y:"-2.6",width:(CW*2).toFixed(1),height:"5.2",rx:"1",
      fill,"fill-opacity":".9",stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".6"})));

    /* a cut end: the fray the cut leaves and the round end that replaces it,
       both on the part parameter. The molecule's own two termini were never
       cut and do not get either. */
    const ends=[], ads=[];
    [[a,-1,k>0],[b,1,k<NF-1]].forEach(([v,dir,cut])=>{
      const y=waveY(v);
      if(cut){
        const fr=el("path",{d:`M ${v.toFixed(2)} ${y.toFixed(2)}`,fill:"none",stroke:CDNA,
          "stroke-width":"1.1","stroke-opacity":"0","stroke-linecap":"butt"});
        const cap=el("circle",{cx:v.toFixed(2),cy:y.toFixed(2),r:(CAPR*0.3).toFixed(2),
          fill:CDNA,"fill-opacity":"0"});
        grp.appendChild(fr); grp.appendChild(cap);
        ends.push(f=>{
          const L=3.4*(1-f);
          let d2=`M ${v.toFixed(2)} ${y.toFixed(2)} L ${(v+dir*L).toFixed(2)} ${y.toFixed(2)}`;
          for(let i=0;i<2;i++){ const tx=v+dir*L*(i+0.4)/2;
            d2+=` M ${tx.toFixed(2)} ${y.toFixed(2)} L ${tx.toFixed(2)} ${(y+(i?1:-1)*L*0.8).toFixed(2)}`; }
          fr.setAttribute("d",d2);
          fr.setAttribute("stroke-opacity",(0.8*(1-f)*clamp(f/0.08)).toFixed(2));
          cap.setAttribute("r",(CAPR*(0.3+0.7*f)).toFixed(2));
          cap.setAttribute("fill-opacity",(0.92*f).toFixed(2));
        });
      }
      /* THE Y. Straight lines and a solid stem against a strand that wanders,
         because it is manufactured oligo and has to look it. Born out at its
         travel start with real coordinates; the ticker only moves it. */
      const at=v+dir*(cut?CAPR:0.8);
      const ad=el("g",{transform:`translate(${(at+dir*10).toFixed(2)},${(y-8).toFixed(2)})`,
        opacity:"0"});
      ad.appendChild(el("path",{d:`M 0 0 L ${dir*ST} 0`,fill:"none",stroke:ADPT,
        "stroke-width":"1.8","stroke-opacity":".95","stroke-linecap":"butt"}));
      ad.appendChild(el("path",{d:`M ${dir*ST} 0 L ${dir*(ST+AX)} ${-AY} `+
        `M ${dir*ST} 0 L ${dir*(ST+AX)} ${AY}`,fill:"none",stroke:ADPT,
        "stroke-width":"1.2","stroke-opacity":".95","stroke-linecap":"butt",
        "stroke-linejoin":"miter"}));
      grp.appendChild(ad);
      ads.push({ad, at, dir, y});
    });
    return {grp, ends, ads, mid:(a+b)/2,
            open:(k-(NF-1)/2)*GAPO, rise:(r()-0.5)*6};
  });

  /* the score marks stay where the cut was, not where the pieces went: they
     are the drawing pointing at a break, so they are grey like the leaders */
  const ticks=cuts.map(v=>{
    const y=waveY(v);
    const e=el("line",{x1:v.toFixed(2),y1:(y-5).toFixed(2),x2:v.toFixed(2),
      y2:(y+5).toFixed(2),stroke:"var(--fg2)","stroke-width":"1.1","stroke-opacity":"0"});
    mol.appendChild(e); return e;
  });

  /* ---- THE CONSTRUCT, IN THE REQUEST'S ORDER ------------------------------
     Ten blocks laid out from one running total, so block and label are read
     off one ruler. Wide enough that each name fits over its own block on a
     single row; the insert is the widest block because it is the longest
     thing in the molecule and the one part that differs from read to read. */
  const SEG=[["P5",7,"var(--fg3)"],["UDI",6.5,UDI],["R1",7,ADPT],
             ["cDNA insert",20,CDNA],
             ["BC1",6,CHIP[0]],["BC2",6,CHIP[1]],["BC3",6,CHIP[2]],
             ["R2",7,ADPT],["UDI",6.5,UDI],["P7",7,"var(--fg3)"]];
  const SPAN=SEG.reduce((s,q)=>s+q[1],0);
  const BW=170, U=BW/SPAN, BY=-4.5, BH=9, SLIDE=16;

  /* ---- TIMING -------------------------------------------------------------
     Seven beats. The strand whole long enough to be seen as one; the score;
     the part, carrying the rounding-off with it; the Ys closing; the three
     plain pieces leaving while the barcoded one comes to the middle; the
     build, a block at a time; and the hold, the longest of them, because the
     request asked for the complete construct to be the frame that stays.

     PLACEMENT IS A PURE FUNCTION OF THE CLOCK, so a frame long enough to skip
     a beat — a tab coming back, a step in trace mode — cannot leave a block
     halfway into a bar it has already joined. */
  const WHOLE=1.4, SCORE=0.5, PART=1.4, DOCK=1.5, GATHER=1.0,
        STEP=0.34, ARR=0.5, HOLD=3.6, CLEAR=0.4;
  const t1=WHOLE, t2=t1+SCORE, t3=t2+PART, t4=t3+DOCK, t5=t4+GATHER,
        t6=t5+(SEG.length-1)*STEP+ARR, t7=t6+HOLD, T=t7+CLEAR;

  const parts=[]; let run0=0;
  SEG.forEach(([name,wid,fill],k)=>{
    const x0=run0*U-BW/2, ww=wid*U; run0+=wid;
    const p=el("g",{transform:`translate(${SLIDE},0)`,opacity:"0"});
    stage.appendChild(p);
    p.appendChild(el("rect",{x:x0.toFixed(2),y:BY.toFixed(1),width:ww.toFixed(2),
      height:BH,rx:"1.2",fill,"fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".55"}));
    const t=el("text",{x:(x0+ww/2).toFixed(2),y:(BY-2.6).toFixed(1),"text-anchor":"middle",
      "font-size":"4.8","letter-spacing":".2",fill:"var(--fg2)",opacity:"0"});
    t.textContent=name; p.appendChild(t);
    parts.push({g:p, lab:t, at:t5+k*STEP});
  });
  /* where the barcoded piece has to end up: under the insert-to-BC3 run of
     the bar, which is what it is about to be drawn as */
  const b0=SEG.slice(0,3).reduce((s,q)=>s+q[1],0)*U-BW/2,
        b1=SEG.slice(0,7).reduce((s,q)=>s+q[1],0)*U-BW/2;
  const last=frags[NF-1], home=(b0+b1)/2-(last.mid+last.open);

  /* the ring last, over everything, so nothing inside can soften its own edge */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,fill:"none",
    stroke:"var(--fg2)","stroke-width":"1.2","stroke-opacity":".8"}));

  const place=t=>{
    const part=ease(clamp((t-t2)/PART)), dock=ease(clamp((t-t3)/DOCK)),
          gath=ease(clamp((t-t4)/GATHER)), gone=clamp((t-t7)/CLEAR);
    /* the loop cuts rather than rewinding: adapters do not fall off and pieces
       do not rejoin, so the strand fades back in whole at the top */
    mol.setAttribute("opacity",clamp(t/0.3).toFixed(2));
    const tk = t<t1 ? 0 : t<t2 ? clamp((t-t1)/(SCORE*0.6)) : clamp(1-part/0.45);
    ticks.forEach(e=>e.setAttribute("stroke-opacity",(0.75*tk).toFixed(2)));
    frags.forEach((f,k)=>{
      const mine=k===NF-1;
      f.grp.setAttribute("transform",
        `translate(${(f.open*part+(mine?home*gath:0)).toFixed(2)},`+
        `${(f.rise*part*(mine?1-gath:1)).toFixed(2)})`);
      /* the barcoded piece gives way as the insert lands on top of it; the
         other three are gone before the build starts */
      f.grp.setAttribute("opacity",(mine ? 1-clamp((t-parts[3].at)/ARR) : 1-gath).toFixed(2));
      f.ends.forEach(setEnd=>setEnd(part));
      /* the fork arrives and the last of the gap closes after it has stopped
         moving, so the nick shows for a beat before it is not there */
      const away=1-dock, gap=GAPA*(1-clamp((dock-0.72)/0.28));
      f.ads.forEach(a=>{
        a.ad.setAttribute("transform",
          `translate(${(a.at+a.dir*(gap+10*away)).toFixed(2)},${(a.y-8*away).toFixed(2)})`);
        a.ad.setAttribute("opacity",clamp(dock/0.3).toFixed(2));
      });
    });
    parts.forEach(p=>{
      const u=ease(clamp((t-p.at)/ARR));
      p.g.setAttribute("transform",`translate(${(SLIDE*(1-u)).toFixed(2)},0)`);
      p.g.setAttribute("opacity",(u*(1-gone)).toFixed(2));
      p.lab.setAttribute("opacity",clamp((u-0.55)/0.4).toFixed(2));
    });
  };

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader,
     and the request named the frame that has to be: the complete construct. */
  let t=t6+HOLD*0.5;
  const run=dt=>{ t=(t+dt)%T; place(t); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.libraryprep = drawLibraryPrep;

/* ------------------------------------------------------------------
   B8′a · CAPTURE THE BARCODED cDNA AND AMPLIFY IT — the tag selects,
   and what it selected is copied.

   ASKED FOR FROM THE PAGE, from "Add a module", and the request set the
   proportions: two small bench objects anchor the frame and one large
   magnification is the subject. So nothing on the bench is the event. The
   rack's magnets wash and the cycler's screen lights, each once and in step
   with the glass, so the bench says where each half of it is happening.

   THE BENCH STANDS JUST BEHIND WHERE THE TRACK ENDS — there is no tile of
   its own to stand on; see below — and not far behind. Forward is
   where B8a's glass comes down — it is centred on the next tile along and
   its rim reaches back over most of this one — and further back is B8′'s own
   bench, whose plate stands just behind and between these two. So the pair
   sit on a screen-level row in the strip between, close enough to this
   tile's back corner to read as this station's.

   NO LEADERS. The glass is a view of both objects — capture in one, copying
   in the other — and a pair of leaders can only name one of them; the one
   path down to the rack also runs straight across B8′'s plate. The flow line
   and the two lights carry the address instead.

   THE GLASS HANGS IN THE ONE CLEAR AIR THERE IS: above B8′'s plate and below
   B8′'s own glass, thrown right of the bench so B8′'s leaders pass its rim.

   THE STRAND IS B8's, ENTIRE — half-length, wobble, three chips, gold tip —
   because B8 and B8a either side of this draw the molecule that way, and a
   third drawing makes the reader ask which one it is. The copies wear the
   gold too, on B8a's terms: it marks the molecule, not a claim about which
   end-tags survive into a copy.

   A BEAD ENCLOSES; IT DOES NOT TOUCH. The request was specific, so the bead
   here is not B8's hook-cut disc: it is a filled circle with a pocket in it
   and a mouth into the pocket, it comes to rest centred on the gold, and the
   mouth narrows to the width of the strand. The drop ends up inside with
   daylight all round it. No bead goes near a chip or a piece of debris.

   ONE, TWO, FOUR, AND THEN A CUT. Each generation is drawn under the last and
   fainter. The return to the start does not rewind: a copy does not un-copy
   and a bead does not let go on camera, so the state is a pure function of
   the clock and the wrap puts the free strands back in one frame.

   ASKED FOR A SECOND TIME, from "Edit visual": once the beads are pulled to
   the side, float them to the middle of the glass, smaller, and show the
   polymerases binding and then copying. So the field drops when the hand-off
   starts — a bead leaves the wall because the magnet let go, not because it
   chose to — and the three held strands drift in together and shrink, which
   is what clears the room for the copies. The enzyme is B8a's, glyph and
   gait: it comes in from outside the field, lands on the free end, walks
   toward the bead and the copy fills in beside it as it goes. One enzyme,
   then two, because the second generation copies the copy too; still one,
   two, four, and still the count the record's prose makes.

   Reuses magnetRack from B8's bench and flowLine / setFanLine from the fan.
   Spends --ch3, --ch4, --ch8, --ch11 and --c-top, all declared on
   /molecular_pipe — the only page carrying a node that wears this.
   ------------------------------------------------------------------ */
/* the polymerase, one glyph for both glasses it works in — B8′a's and B8a's.
   Hoisted rather than copied so the two can never drift into two enzymes. */
const POLYMERASE_D=`M -5.4 -1.4 C -5.4 -7.2 5.4 -7.2 5.4 -1.4 L 5.4 1.6 `+
  `C 5.4 3.6 3.0 4.0 2.4 2.2 C 1.5 -0.4 -1.5 -0.4 -2.4 2.2 `+
  `C -3.0 4.0 -5.4 3.6 -5.4 1.6 Z`;

/* THE CASED CYCLER — rounded pale body, angled front screen. B8′a's bench
   and C1's both stand one, and a request that says "same style as elsewhere"
   is asking for the same object, so it is hoisted rather than copied. cyc is a
   footprint in world units and rise is how far the screen's back edge stands
   above the lid; both are read off the caller's node. Returns the screen's lit
   overlay, born dark, and the corner radius so callers can land leaders on
   the curve rather than on a corner that is not there.

   ROUNDED, SO IT IS NOT paint(). The footprint is a rounded rectangle walked
   once; each side segment facing the viewer is a quad, and on a convex
   footprint those quads tile the silhouette without overlapping, so no sort
   is needed. */
function casedCycler(g,cyc,rise){
  const RR=Math.min(cyc.w,cyc.d)*0.28;
  const ring=[];
  [[1,-1],[1,1],[-1,1],[-1,-1]].forEach(([sx,sy],k)=>{
    const ox=cyc.x+sx*(cyc.w/2-RR), oy=cyc.y+sy*(cyc.d/2-RR);
    for(let i=0;i<=6;i++){ const a=(-90+90*k+15*i)*Math.PI/180;
      ring.push([ox+RR*Math.cos(a), oy+RR*Math.sin(a)]); }
  });
  let s0=-1, s1=-1;
  for(let i=0;i<ring.length;i++){
    const p=ring[i], q=ring[(i+1)%ring.length];
    const nx=q[1]-p[1], ny=p[0]-q[0];
    if(nx+ny<=0) continue;
    if(s0<0) s0=i; s1=i;
    g.appendChild(el("polygon",{points:pts([P(p[0],p[1],cyc.h),P(q[0],q[1],cyc.h),
      P(q[0],q[1],0),P(p[0],p[1],0)]),fill:ny>nx?"var(--m-left)":"var(--m-right)"}));
  }
  /* the seams between those quads are not edges of anything, so the outline
     is drawn once round the band they make rather than round each of them */
  const band=ring.slice(s0,s1+2);
  g.appendChild(el("polygon",{points:pts([...band.map(p=>P(p[0],p[1],cyc.h)),
    ...band.slice().reverse().map(p=>P(p[0],p[1],0))]),fill:"none",
    stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".8"}));
  g.appendChild(el("polygon",{points:pts(ring.map(p=>P(p[0],p[1],cyc.h))),
    fill:"var(--m-top)",stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".8"}));

  /* the angled screen: a wedge on the front of the top, its sloped face turned
     up toward the reader. Only the sloped face and the +x cheek can be seen */
  const wx0=cyc.x-cyc.w*0.32, wx1=cyc.x+cyc.w*0.32,
        wy0=cyc.y+cyc.d*0.30, wy1=cyc.y-cyc.d*0.08, wz=cyc.h+rise;
  g.appendChild(el("polygon",{points:pts([P(wx1,wy0,cyc.h),P(wx1,wy1,cyc.h),P(wx1,wy1,wz)]),
    fill:"var(--m-right)",stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".7"}));
  const slope=[P(wx0,wy0,cyc.h),P(wx1,wy0,cyc.h),P(wx1,wy1,wz),P(wx0,wy1,wz)];
  g.appendChild(el("polygon",{points:pts(slope),fill:"var(--m-left)",
    stroke:"var(--stroke)","stroke-width":".9","stroke-opacity":".7"}));
  const lerp=(A,B,u)=>[A[0]+(B[0]-A[0])*u, A[1]+(B[1]-A[1])*u];
  const on=(u,v)=>lerp(lerp(slope[0],slope[1],u), lerp(slope[3],slope[2],u), v);
  const face=pts([on(.14,.2),on(.86,.2),on(.86,.8),on(.14,.8)]);
  g.appendChild(el("polygon",{points:face,fill:"var(--bg)","fill-opacity":".85",
    stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".6"}));
  const lit=el("polygon",{points:face,fill:"var(--signal)","fill-opacity":"0"});
  g.appendChild(lit);
  return {lit, RR};
}

function drawTagCapture(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w .72, d .72, h .40. */
  const SC=n.w/0.72;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);
  const r=rng(173);

  /* ---- THE BENCH ----------------------------------------------------------
     BACK is how far behind the tile; SP is how far either side of that point
     the two stand. Walking +x and -y by the same amount is walking straight
     across the page, so rack and cycler sit level and read left to right. */
  const BACK=1.35, SP=0.36;
  const bx=n.x-n.w*BACK, by=n.y-n.d*BACK;

  /* one strip, not B8's two: the request asked for a strip, and at this size
     a second row of tubes is noise rather than a fact */
  const rack={x:bx-n.w*SP, y:by+n.d*SP, w:n.w*0.70, d:n.d*0.24, h:n.h*0.28,
              tubes:8, strips:1};
  const T=magnetRack(g, rack);

  /* pale because the request said pale — --m-* is the skin the rack's magnets
     are set in, so the two pale things on this bench are one material */
  const cyc={x:bx+n.w*SP, y:by-n.d*SP, w:n.w*0.46, d:n.d*0.42, h:n.h*0.42};
  const {lit}=casedCycler(g,cyc,n.h*0.20);

  /* one short flow, rack to cycler. Faint while nothing is on it; a bead runs
     it once, between the pull and the first copy, which is the moment the
     held cDNA changes hands */
  const RH=rack.h*1.60;
  const flow=flowLine(g,
    P(rack.x+rack.w/2, rack.y-rack.d/2, rack.h+RH*0.6),
    P(cyc.x-cyc.w/2, cyc.y+cyc.d/2, cyc.h*0.7), "var(--fg3)", SC);
  setFanLine(flow,0.34,0);

  /* NO TILE. There was one here, the plain box the track arrives at, and it
     was asked away from "Edit visual": with the bench and the glass drawn,
     a grey block in front of them reads as a second, empty module. The
     track still ends at n.x, n.y; the bench behind it is what it arrives at. */

  /* ---- THE MAGNIFICATION --------------------------------------------------
     A thin solid ellipse, the idiom this map uses everywhere for a view drawn
     larger than life. Sized in screen pixels and scaled by being scaled: what
     is inside it is a molecule, which has no world size to be authored in, so
     it goes in a group carrying scale(n.w / .72) and a resize takes it along.
     Centred off the bench's own top through n.x, n.y and n.h. */
  const LX=62, LY=40;
  const TOP=P(bx,by,cyc.h+n.h*0.20);
  const KX=TOP[0]+40*SC, KY=TOP[1]-(LY+48)*SC;
  const lens=el("g",{transform:
    `translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in the
     drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,
    fill:"var(--bg)","fill-opacity":".92"}));
  /* the wall the held strands are pulled to, in the magnets' pale, so the
     inset on the rack and the side of the glass read as one fact at two
     scales. It stays after they leave it: it is where the magnet is */
  const wall=a=>[(LX*Math.cos(a)).toFixed(1),(LY*Math.sin(a)).toFixed(1)];
  lens.appendChild(el("path",{d:`M ${wall(2.36).join(" ")} `+
    `A ${LX} ${LY} 0 0 1 ${wall(3.93).join(" ")}`,fill:"none",
    stroke:"var(--m-top)","stroke-width":"3.4","stroke-opacity":".45"}));
  /* debris drains past the rim and beads arrive from beyond it, so both have
     to stop existing at the boundary. Uniqued: a checker draws this shape
     twice, at two sizes, into one document */
  const cid=`tagglass${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY}));
  lens.appendChild(cp);
  const stage=el("g",{"clip-path":`url(#${cid})`});
  lens.appendChild(stage);
  /* back to front: debris, copies, beads, strands, enzymes. The beads sit
     under the strands so the gold is drawn inside the pocket rather than
     behind it; the enzymes go over everything because they sit ON a strand */
  const L_DEB=el("g",{}), L_FLD=el("g",{}), L_CPY=el("g",{}), L_BEAD=el("g",{}),
        L_STR=el("g",{}), L_POL=el("g",{});
  [L_DEB,L_FLD,L_CPY,L_BEAD,L_STR,L_POL].forEach(l=>stage.appendChild(l));

  /* ---- THE STRAND, B8's WAY ---------------------------------------------- */
  const HL=15, TIP=HL+5.4, DROP=HL+2.4;
  const CHIP=["var(--ch8)","var(--ch11)","var(--ch4)"];
  const spine=k=>{ let d=`M ${-HL} 0`;
    for(let s=1;s<=10;s++)
      d+=` L ${(-HL+2*HL*(s/10)).toFixed(1)} ${(Math.sin(s*0.86+k)*2.1).toFixed(1)}`;
    return d; };
  const strand=(parent,k,tr,op)=>{
    const sg=el("g",{transform:tr,opacity:op});
    parent.appendChild(sg);
    sg.appendChild(el("path",{d:spine(k),fill:"none",stroke:"var(--c-top)",
      "stroke-width":"1.5","stroke-opacity":".75","stroke-linecap":"round"}));
    CHIP.forEach((c,i)=>sg.appendChild(el("rect",{x:(-8.4+i*6.2).toFixed(1),y:"-1.9",
      width:"4.6",height:"3.8",rx:"1.1",fill:c,"fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"})));
    sg.appendChild(el("path",{d:`M ${HL-0.6} 0 C ${HL+1.4} -3.3 ${TIP} -2.2 ${TIP} 0 `+
      `C ${TIP} 2.2 ${HL+1.4} 3.3 ${HL-0.6} 0 Z`,fill:"var(--ch3)","fill-opacity":".95",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"}));
    return sg;
  };
  const tr=(x,y,a,s=1)=>`translate(${x.toFixed(1)},${y.toFixed(1)}) `+
    `rotate(${a.toFixed(1)})`+(s===1?"":` scale(${s.toFixed(3)})`);
  const rot=(a,x,y)=>[x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a)];

  /* free, the gold turned toward the side the beads come from; held, swung
     round so the bead leads and the gold is at the wall; then off the wall
     into the middle at FS, squared up, so the four being counted line up.
     The column sits a little left of centre because the copies need the
     right: taken together the two columns are what is centred */
  const FREE=[[10,-20,-12],[22,6,16],[-6,18,-6]];
  const HELD=[[-28,-16,186],[-28,0,180],[-28,16,174]];
  const FS=0.62, ANG=180, MIDS=[[-6,-16,ANG],[-6,0,ANG],[-6,16,ANG]];
  const COPIER=1;
  const strands=FREE.map((f,i)=>({g:strand(L_STR,i*1.9,tr(f[0],f[1],f[2]),"1"),
    free:f, held:HELD[i], mid:MIDS[i], ph:r()*6.283}));

  /* THE DEBRIS IS FORMLESS ON PURPOSE, B8's reasoning: any shape given to it
     would be a claim about what it is, and all it is is not the thing kept */
  const debris=[[-36,-6],[-12,0],[44,-12],[34,26]].map(p=>{
    const q=[];
    for(let k=0;k<9;k++){ const a=k*6.283/9, rr=4.4+r()*3.4;
      q.push(`${(Math.cos(a)*rr).toFixed(1)},${(Math.sin(a)*rr*0.8).toFixed(1)}`); }
    const dg=el("g",{transform:`translate(${p[0]},${p[1]})`});
    L_DEB.appendChild(dg);
    dg.appendChild(el("polygon",{points:q.join(" "),fill:"var(--fg3)",
      "fill-opacity":".3",stroke:"var(--fg3)","stroke-width":".8","stroke-opacity":".5"}));
    return {g:dg, at:p, ph:r()*6.283};
  });

  /* THE BEAD: a ring of body round a pocket, with a mouth from the pocket to
     the outside. The mouth faces +x here and the bead is turned to face the
     strand. What closes is the mouth — from wider than the drop to the width
     of the strand — so the drop is shut in without anything meeting it. */
  const BR=7.4, PR=3.6;
  const setBead=(b,c)=>{
    const hw=3.3-2.4*clamp(c);
    const a=Math.asin(hw/BR), q=Math.asin(hw/PR);
    const o=t=>`${(BR*Math.cos(t)).toFixed(2)} ${(BR*Math.sin(t)).toFixed(2)}`;
    const i=t=>`${(PR*Math.cos(t)).toFixed(2)} ${(PR*Math.sin(t)).toFixed(2)}`;
    b.body.setAttribute("d",`M ${o(a)} A ${BR} ${BR} 0 1 1 ${o(-a)} `+
      `L ${i(-q)} A ${PR} ${PR} 0 1 0 ${i(q)} Z`);
  };
  [[LX+8,-14],[LX+8,4],[LX+8,20]].forEach((e,i)=>{
    const bg=el("g",{transform:`translate(${e[0]},${e[1]}) rotate(180)`,opacity:"0"});
    L_BEAD.appendChild(bg);
    const body=el("path",{d:"",fill:"var(--fg)","fill-opacity":".82",
      stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".5"});
    bg.appendChild(body);
    strands[i].b={g:bg, body, entry:e};
    setBead(strands[i].b,0);
  });

  /* THE COPIES: one, then two more, each generation under the last and
     fainter, landing in a column right of the held strands. Each fills in
     BESIDE its template while an enzyme walks it, on the side it will leave
     by, and then slides to its place — `side` is which side that is, so the
     third copy peels off its template downward rather than across it. Born
     beside their template with real coordinates; the clock only moves them.
     The enzymes are born outside the rim where they come in from. */
  const T0=MIDS[COPIER];
  const COPY=[{from:T0,     to:[26,-2],  side: 1, op:0.68, gen:0, enter:[30,52]},
              {from:T0,     to:[26,-18], side: 1, op:0.42, gen:1, enter:[-20,-52]},
              {from:[26,-2],to:[26,14],  side:-1, op:0.42, gen:1, enter:[70,-24]}];
  const A0=ANG*Math.PI/180;
  COPY.forEach(c=>{
    const al=rot(A0,0,6*c.side*FS);
    c.beside=[c.from[0]+al[0], c.from[1]+al[1]];
  });
  /* appended in reverse so the youngest are furthest back */
  COPY.slice().reverse().forEach(c=>{
    c.g=strand(L_CPY,COPIER*1.9,tr(c.beside[0],c.beside[1],ANG,FS),"0");
  });
  COPY.forEach(c=>{
    c.pol=el("g",{transform:tr(c.enter[0],c.enter[1],ANG,FS),opacity:"0"});
    L_POL.appendChild(c.pol);
    c.pol.appendChild(el("path",{d:POLYMERASE_D,fill:"var(--fg)","fill-opacity":".82",
      stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".5"}));
  });

  /* ---- AND THEN IT DOES NOT STOP -----------------------------------------
     ASKED FOR A THIRD TIME: more amplification, fill the whole circle. So
     after the two generations an enzyme walks out, the doubling carries on
     without one — eight, sixteen, thirty-two — too fast to follow copy by
     copy, which is the fact being drawn. Each new copy is born on the copy
     nearest its slot and slides out to it, so the fill spreads from the
     column of four rather than appearing. The slots are rows on the three
     copies' own pitch; each row is cut by the rim, the held strands and
     their beads, and the copies already there, and every stretch left over
     is packed as full as it goes and centred in itself. A grid would leave
     the ends of every row empty, and the ends are most of an ellipse. */
  const CL=TIP*FS, CR=HL*FS, CY=3.2*FS, PAD=1.5, GAP=2.4;
  const CW=CL+CR+GAP, CH=8, X0=COPY[0].to[0], Y0=COPY[0].to[1];
  const HX0=MIDS[0][0]-(DROP+BR)*FS-PAD, HX1=MIDS[0][0]+CR+PAD,
        HY=Math.max(...MIDS.map(m=>Math.abs(m[1])))+BR*FS+PAD;
  const slots=[];
  for(let j=-8;j<=8;j++){
    const y=Y0+j*CH, e=(Math.abs(y)+CY)/(LY-2);
    if(e>=1) continue;
    const a=(LX-2)*Math.sqrt(1-e*e);
    /* what is already on this row, as [left, right] of the space it takes */
    const cut=COPY.filter(c=>Math.abs(c.to[1]-y)<CH*0.9)
      .map(c=>[c.to[0]-CL-GAP, c.to[0]+CR+GAP]);
    if(Math.abs(y)-CY<HY) cut.push([HX0,HX1]);
    cut.sort((p,q)=>p[0]-q[0]);
    let x0=-a;
    [...cut,[a,a]].forEach(([l,rr])=>{
      const run=Math.min(l,a)-x0, k=Math.floor((run+GAP)/CW);
      const lead=(run-(k*CW-GAP))/2;
      for(let i=0;i<k;i++) slots.push([x0+lead+CL+i*CW, y]);
      x0=Math.max(x0,rr);
    });
  }
  /* nearest the four first, so each wave is a ring round the last one */
  const far=s=>Math.hypot(s[0]-X0,(s[1]-Y0)*1.5);
  slots.sort((a,b)=>far(a)-far(b));
  const placed=[T0,...COPY.map(c=>c.to)], FLOOD=[];
  let NW=0;
  for(let i=0;i<slots.length;NW++){
    /* a wave is as many copies as there are molecules to copy: doubling */
    const wave=slots.slice(i,i+placed.length); i+=wave.length;
    wave.forEach((s,k)=>{
      const d=p=>Math.hypot(p[0]-s[0],p[1]-s[1]);
      FLOOD.push({to:s, from:placed.reduce((m,p)=>d(p)<d(m)?p:m),
        wave:NW, lag:k/wave.length, op:Math.max(0.24,0.38-0.05*NW)});
    });
    placed.push(...wave);
  }
  /* youngest furthest back, as with the three above */
  FLOOD.slice().reverse().forEach(f=>{
    f.g=strand(L_FLD,COPIER*1.9,tr(f.from[0],f.from[1],ANG,FS),"0");
  });

  /* the ring last, over everything, so nothing inside can soften its own edge */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,fill:"none",
    stroke:"var(--fg2)","stroke-width":"1.3","stroke-opacity":".85"}));

  /* ---- TIMING -------------------------------------------------------------
     The beads take their time and arrive one after another; the pull is quick
     and the three held things move together, which is the one moment on the
     bench that reads as an event. Then the hand-off along the flow, with the
     field dropping and the held three drifting in to the middle; then the
     two generations, each an enzyme landing, a walk and a peel; then the
     flood, a wave a beat; and a hold on a full glass.

     PLACEMENT IS A PURE FUNCTION OF THE CLOCK, so a frame long enough to skip
     a whole beat cannot leave a bead halfway to a strand it has already left. */
  const T_IN=1.3, STAG=0.3, CAPD=1.2, T_PULL=3.4, PULLD=1.6,
        T_FLOW=5.0, FLOWD=0.8, T_FLOAT=5.3, FLOATD=1.4,
        BINDD=0.7, SYND=1.1, MOVD=0.7, GEN=BINDD+SYND+MOVD,
        T_G1=7.0, T_G2=T_G1+GEN+0.2, T_FL=T_G2+GEN+0.1, WAVE=0.8, FLD=0.6,
        HOLD=2.6;
  const TOT=T_FL+NW*WAVE+0.3+HOLD;
  FLOOD.forEach(f=>{ f.t0=T_FL+f.wave*WAVE+f.lag*0.3; });

  const place=(t,ph)=>{
    const pull=ease(clamp((t-T_PULL)/PULLD));
    const jig=(1-pull)*1.4;
    const fl=ease(clamp((t-T_FLOAT)/FLOATD)), sc=1+(FS-1)*fl;
    /* once copying starts the other two held strands step back, so the four
       being counted are the brightest thing in the glass */
    const back=1-0.5*ease(clamp((t-T_G1+0.5)/0.5));
    strands.forEach((sd,i)=>{
      const hx=sd.free[0]+(sd.held[0]-sd.free[0])*pull+Math.cos(ph*0.8+sd.ph)*jig;
      const hy=sd.free[1]+(sd.held[1]-sd.free[1])*pull+Math.sin(ph*0.6+sd.ph)*jig;
      const ha=sd.free[2]+(sd.held[2]-sd.free[2])*pull;
      const px=hx+(sd.mid[0]-hx)*fl, py=hy+(sd.mid[1]-hy)*fl,
            ang=ha+(sd.mid[2]-ha)*fl;
      const dim=i===COPIER?1:back;
      sd.g.setAttribute("transform",tr(px,py,ang,sc));
      sd.g.setAttribute("opacity",dim.toFixed(2));
      const c=ease(clamp((t-T_IN-i*STAG)/CAPD));
      const a=ang*Math.PI/180;
      const tx=px+Math.cos(a)*DROP*sc, ty=py+Math.sin(a)*DROP*sc;
      sd.b.g.setAttribute("transform",tr(sd.b.entry[0]+(tx-sd.b.entry[0])*c,
        sd.b.entry[1]+(ty-sd.b.entry[1])*c, ang+180, sc));
      sd.b.g.setAttribute("opacity",(0.95*clamp(c/0.2)*dim).toFixed(2));
      setBead(sd.b,(c-0.6)/0.4);
    });
    /* THE DEBRIS IS NEVER TAKEN. Nothing goes near it while the beads work,
       and when the field comes on it drains straight down out of the glass */
    const out=ease(clamp((pull-0.18)/0.72));
    debris.forEach(d=>{
      const dx=d.at[0]+Math.cos(ph*0.7+d.ph)*jig*1.2;
      const dy=d.at[1]+Math.sin(ph*0.5+d.ph)*jig*1.2+out*(LY+26);
      d.g.setAttribute("transform",`translate(${dx.toFixed(1)},${dy.toFixed(1)})`);
      d.g.setAttribute("opacity",(1-clamp((out-0.35)/0.5)).toFixed(2));
    });
    /* THE ENZYME LANDS ON THE FREE END AND WALKS TOWARD THE BEAD, the way a
       copy is written, and stops short of it so the pocket stays readable.
       The copy fills in as it walks, and when the walk is done the copy
       slides off to its place and the enzyme lifts away on its own side */
    COPY.forEach(c=>{
      const g0=c.gen?T_G2:T_G1;
      const b=ease(clamp((t-g0)/BINDD)), s=ease(clamp((t-g0-BINDD)/SYND)),
            m=ease(clamp((t-g0-BINDD-SYND)/MOVD));
      c.g.setAttribute("transform",tr(c.beside[0]+(c.to[0]-c.beside[0])*m,
        c.beside[1]+(c.to[1]-c.beside[1])*m, ANG, FS));
      c.g.setAttribute("opacity",(c.op*s).toFixed(2));
      const on=rot(A0,(-HL+3+(2*HL-11)*s)*FS,(-1.6-8*m)*c.side*FS);
      const ex=c.enter[0]+(c.from[0]+on[0]-c.enter[0])*b,
            ey=c.enter[1]+(c.from[1]+on[1]-c.enter[1])*b;
      c.pol.setAttribute("transform",tr(ex,ey,ANG+(c.side>0?0:180),FS));
      c.pol.setAttribute("opacity",(0.9*clamp(b/0.25)*(1-m)).toFixed(2));
    });
    FLOOD.forEach(f=>{
      const u=ease(clamp((t-f.t0)/FLD));
      f.g.setAttribute("transform",tr(f.from[0]+(f.to[0]-f.from[0])*u,
        f.from[1]+(f.to[1]-f.from[1])*u, ANG, FS));
      f.g.setAttribute("opacity",(f.op*clamp(u*2)).toFixed(2));
    });
    /* the bench, in step: the field is on from the pull until the beads
       leave the wall, and the screen is lit from the hand-off, brightest as
       each generation lands */
    T.setField(clamp((t-T_PULL+0.3)/0.5)*(1-clamp((t-T_FLOAT)/0.4)));
    setFanLine(flow,0.34,(t-T_FLOW)/FLOWD);
    const pulse=(g0,D)=>Math.sin(Math.PI*clamp((t-g0)/D));
    let hi=Math.max(pulse(T_G1,GEN),pulse(T_G2,GEN));
    for(let w=0;w<NW;w++) hi=Math.max(hi,pulse(T_FL+w*WAVE,WAVE));
    lit.setAttribute("fill-opacity",(t<T_FLOW+FLOWD*0.7 ? 0 :
      0.35+0.35*hi).toFixed(2));
  };

  /* THE CLOCK DOES NOT START AT ZERO. A reader asking for reduced motion never
     sees it advance, so the frame it starts on is the whole station for them,
     and the one that carries both halves is the hold: beads shut and in the
     middle, debris gone, the glass full of copies */
  let t=TOT-HOLD*0.5, ph=0;
  const run=dt=>{ t=(t+dt)%TOT; ph+=dt*1.7; place(t,ph); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.tagcapture = drawTagCapture;

/* ------------------------------------------------------------------
   B8a · PCR AMPLIFICATION — the doubling under glass, and nothing else.

   ASKED FOR FROM THE PAGE, from the map's own "Add a module" button, and what
   it asked for is one object and one event: a thermal cycler with its lid down
   and one lamp lit, and tethered over it a magnification in which a single
   barcoded molecule becomes two and then four.

   ASKED FOR A SECOND TIME, from "Edit visual", and the second request replaces
   what is in the glass. It said three things: draw the strands the way B8 next
   door draws them; start with two or three of them and show the polymerase
   binding and copying; and end on a cloud, because the thing the reader is
   meant to come away with is that there is now an enormous amount of this
   molecule. So the glass now runs three strands, three enzymes and three
   copies, and then fills.

   ASKED FOR A THIRD TIME, and that request went the other way: make the block
   look more like a PCR machine, and make the glass bigger. It got a heated
   lid, a clamp bar, a grille and a console, and the glass got the ZOOM factor
   it still carries.

   ASKED FOR A FOURTH TIME, AND THE MACHINE IS GONE. "I don't think the pcr
   machine needs to be there. The image can just be black circle showing the
   pcr amplification." So the chassis, the heated lid, the clamp bar, the
   grille, the lamp, the console and the connector in from B8's rack have all
   come out, and the station is the glass. That is a subtraction this drawing
   had coming. A shut block cannot show its own event — nothing about an
   amplification is visible from outside a machine — which is why each earlier
   request kept adding RECOGNITION to it, a lid, a console, a slot, and never
   once added meaning; and all the while the thing beside it carried the whole
   step. Two objects on one tile where one of them says nothing is one object
   too many, and the one that goes is the one that says nothing.

   NOTHING IS LEFT ON THE BENCH. The two leaders that used to run from the ring
   down to this node's back corners are gone at the fifth request: with the
   block already taken away there was no object under them to point at, so all
   they tethered the glass to was bare ground, and two lines to nothing read as
   clutter rather than as an address. What still names the station is the track,
   the dot and the name, which all arrive at that footprint anyway — the glass
   sits on its own tile and the reader is not being asked to find it twice.
   The bench is bare on purpose: this step is free DNA in a closed tube, and
   there was never anything about it to see at bench scale.

   IT IS NOT A PLATE AND IT IS NOT ONE OF THE HEATED BLOCKS. Rounds one to
   three are chemistry inside an intact cell and this row draws them as plates
   with a lens over one well. This is bulk PCR on free DNA in a tube, ninety-five
   thousand cells after the last of them was lysed, so there is no plastic in
   the glass, no well, no cell outline and nothing holding the strands: they
   float in a volume, which is the difference the request asked to be kept.

   THE THREE CHIPS ARE B8's THREE, AND THAT IS THE CLAIM. --ch8, --ch11 and
   --ch4 are the three in-situ rounds wherever this row draws a strand, so what
   is under this glass is recognisably the molecule the beads let go one
   station back rather than a new one — and what copies here copies WITH them,
   which is the only reason an amplified library still knows which cell it came
   from. THE STRAND IS B8's ENTIRE, gold tip included, because that is what the
   second request asked for and because two neighbouring glasses that draw the
   same molecule two ways make the reader ask which one it is. The gold marks
   the molecule; it is not a claim that a tag survives into every copy, and the
   record says so.

   THE ENZYME IS DRAWN THE WAY B8 DRAWS ITS BEAD — a solid pale body in --fg
   with a hole cut in it in --bg — because a protein that grips something is
   already an idiom on this bench and a second one would read as a second kind
   of object. Where the bead's hole is a pocket that shuts, this one is a
   channel the strand runs through, and it is the channel travelling the length
   of the template that is the copying.

   THE CLOUD IS THE POINT AND THE ENZYMES MAKE ALL OF IT. It used to arrive in
   three faded waves once the countable copies were done, which said the mass
   existed without saying where it came from; since the ninth request every
   strand in it is written by a polymerase, off a strand that was itself
   written, until the glass is full. What it says is still the only number
   this station is allowed: not eight, not four, more than can be counted.
   AND THE RETURN TO THREE IS A CUT. Playing an amplification backwards shows copies merging and
   that is the one thing a PCR never does; so the state is a pure function of
   the clock and the wrap puts three strands back on the stage in one frame.

   ASKED FOR A SIXTH TIME, AND THE GLASS CAME DOWN ONTO THE TILE. "This is the
   whole image. Move its position to where the module box is." For three
   requests it hung high in the air, and the height was not arbitrary: a
   magnification is a view OF something, the something was a cycler standing on
   the ground below it, and the air it hung in was the only clear air there is —
   every station's name leaves its own back edge running up and to the right at
   −30°, so the sky over any tile is striped with the names of the stations to
   its LEFT, about one every forty-five pixels, and a glass this size fits above
   all of them or between none of them. That clearance survived the fourth
   request and the fifth because what pinned it up there was the names, not the
   object. It does not survive this one, and it should not: A VIEW OF NOTHING IS
   NOT A VIEW. With the bench bare the glass is not a view of the station, it is
   the station, and a station stands on its own box. So the ring is centred on
   the middle of the node's own box and the sky argument leaves with it — the
   names now cross the ring instead of fencing it out, which is what every other
   object on this row already lives with.

   WHAT IT COSTS IS DEPTH ORDER, and that is the price of standing on the
   ground. B9's tile is drawn after this one, so B9's instrument paints over the
   lower right of the glass exactly as it would over any object standing here.
   Up in the air the glass overlapped nothing; on the tile it is in the scene,
   and being in the scene is what was asked for.

   Borrows nothing but the idioms. Spends --ch4, --ch8 and --ch11 for the chips
   and --c-top for a strand, all declared on /molecular_pipe — the only page
   carrying a node that wears this shape.
   ------------------------------------------------------------------ */
function drawPcrAmplify(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w .72, d .72, h .40 — B9's tile, and
     B8's but for the height. */
  const SC=n.w/0.72;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);
  const r=rng(97);

  /* ---- THE MAGNIFICATION, WHICH IS NOW THE WHOLE STATION ------------------
     A thin solid ellipse with two leaders back to the tile: the idiom this map
     uses everywhere for a view drawn larger than life, and a solid ring is the
     only thing on this tile allowed to be one — which is easier to hold to now
     that it is the only thing on this tile at all.

     WHAT IS INSIDE IT IS SIZED IN SCREEN PIXELS AND SCALED BY BEING SCALED. A
     molecule has no world size to be authored in, so it goes in a group
     carrying scale(n.w / .72) and every coordinate under it is written for the
     size this node happens to be authored at. A resize moves the glass, grows
     it, and takes everything in it along.

     THE THIRD REQUEST ASKED FOR IT BIGGER, and bigger means the whole glass
     and everything under it — a wider ring around the same small strands would
     be a bigger empty frame, not a bigger view. So the enlargement is one factor
     on the group's scale and nothing inside is touched. IT NOW GROWS ABOUT THE
     CENTRE. While the glass hung in the sky the extra radius had to go upward,
     because what was below it was the station names it had to clear; centred on
     the tile there is nothing to clear, and a ring that stays centred on the
     box at any ZOOM is the one that keeps saying which box it belongs to. */
  const LX=52, LY=40, ZOOM=1.32, GS=SC*ZOOM;
  /* ON THE TILE, NOT OVER IT. The clearance this glass used to hang at was
     tuned against the station names striping the sky, back when a machine
     stood on the tile and the glass was a view of it; with the machine gone
     the glass IS the station, and a station stands on its own box. So the
     centre is the middle of the node's own box — through n.x, n.y and n.h, so
     the three dimensions a resize changes still move the drawing together. */
  const MID=P(n.x,n.y,n.h/2);
  const KX=MID[0], KY=MID[1];

  /* No leaders, and now nothing for them to span either: they pointed at empty
     ground once the block went, and the ring has since come down onto that
     ground. A line from a thing to itself is not an address. */

  const lens=el("g",{transform:
    `translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${GS.toFixed(4)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in the
     drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,
    fill:"var(--bg)","fill-opacity":".92"}));

  /* the cloud grows out past the ring and has to stop existing there rather
     than at the edge of the screen. Uniqued the way B8's glass is: a checker
     draws this shape twice, at two sizes, into one document. */
  const cid=`ampglass${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY}));
  lens.appendChild(cp);
  const stage=el("g",{"clip-path":`url(#${cid})`});
  lens.appendChild(stage);

  /* ---- THE STRAND IS B8's, BUILT B8's WAY ---------------------------------
     Same half-length, same wobble, same three chips in the middle, same gold
     drop at the tip — see the header. One builder, used for the templates, for
     the copies and for every strand in the cloud, because the moment there are
     two ways of drawing this molecule on this bench the reader has to work out
     whether the difference means anything. */
  const HL=15, TIP=HL+5.4, CHIP=["var(--ch8)","var(--ch11)","var(--ch4)"];
  const spine=k=>{ let d=`M ${-HL} 0`;
    for(let s=1;s<=10;s++)
      d+=` L ${(-HL+2*HL*(s/10)).toFixed(1)} ${(Math.sin(s*0.86+k)*2.1).toFixed(1)}`;
    return d; };
  const strand=(parent,k,tr,op)=>{
    const sg=el("g",{transform:tr,opacity:op});
    parent.appendChild(sg);
    sg.appendChild(el("path",{d:spine(k),fill:"none",stroke:"var(--c-top)",
      "stroke-width":"1.5","stroke-opacity":".75","stroke-linecap":"round"}));
    CHIP.forEach((c,i)=>sg.appendChild(el("rect",{x:(-8.4+i*6.2).toFixed(1),
      y:"-1.9",width:"4.6",height:"3.8",rx:"1.1",fill:c,"fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"})));
    sg.appendChild(el("path",{d:`M ${HL-0.6} 0 C ${HL+1.4} -3.3 ${TIP} -2.2 ${TIP} 0 `+
      `C ${TIP} 2.2 ${HL+1.4} 3.3 ${HL-0.6} 0 Z`,fill:"var(--ch3)",
      "fill-opacity":".95",stroke:"var(--stroke)","stroke-width":".5",
      "stroke-opacity":".5"}));
    return sg;
  };

  /* ---- A LINEAGE, SCHEDULED BEFORE IT RUNS --------------------------------
     ASKED FOR A SEVENTH TIME: "show the actual replication as the polymerase
     travels down the strand, then new polymerases add to the new strands and
     it amplifies like that." So a copy is WRITTEN: its backbone grows out of
     the enzyme's channel as the enzyme walks, each chip lands as the enzyme
     passes the chip it is copying, and the gold arrives last, at the end of
     the walk. Then the pair comes apart and both are templates — the whole of
     why PCR is exponential and not merely repeated: a copy is a template the
     moment it exists.

     ASKED FOR A NINTH TIME: "keep the polymerases attaching and replicating
     until the whole circle is filled", and "the orientations of the strands
     can be more random and dispersed." Until now two generations were
     written and then a faded cloud was dropped in over them, so the enzymes
     stopped at twelve strands and the other thirty-six came from nowhere; and
     the twelve stood in three tidy columns, which is a figure's order and not
     a tube's. So there is no longer a cloud and no longer a column. Every
     strand, the moment its own copy peels off, waits a seeded moment and
     takes an enzyme again, and so does the copy, until the glass holds N.
     Each copy peels away to a home of its own near its parent — the emptiest
     of a dozen seeded candidates, so the fill spreads rather than piles — and
     turns as it goes to an angle of its own, so the full glass is a scatter
     in every direction. It keeps its parent's wobble, because it is the same
     sequence.

     ASKED FOR A TENTH TIME: "make it about 20% less chaotic." So every knob
     that makes the scatter a scatter is turned down by about a fifth and none
     is turned off — the ninth request still stands. A fifth fewer strands, so
     the full glass has room between them; headings drawn from four-fifths of
     the circle about a shared axis rather than all of it, so the crowd leans
     one way without lining up; a fifth less spread in when each copy starts;
     and a fifth less drift. Still more than can be counted.

     ASKED FOR AN ELEVENTH TIME: "I don't like this weird flip thing the
     strands are doing. Once replicated the strands should separate in the
     space." The flip was the peel: a copy swung from its parent's heading to
     a fresh random one, up to half a turn, and its home could lie on the far
     side of the parent, so it crossed back over the strand it came off. So a
     copy's home is now chosen on the side it was written on, it slides
     straight out that way, and it turns by no more than a few degrees — the
     dispersion the ninth request asked for now builds up down the lineage,
     a little per generation, instead of arriving as a spin.

     THE WHOLE LINEAGE IS WORKED OUT HERE, before anything is drawn, as a
     queue of strands ordered by when each is next free to be copied. Every
     strand is born at its final place and every enzyme at the point it flies
     in from, and the ticker states a place, an opacity and how much of a copy
     is written from the clock alone, and builds nothing mid-flight — which is
     also what keeps thirty-odd invisible strands from dragging the selection halo
     across the map. Templates first, so everything written lands over what it
     was written from, and every enzyme over every strand. */
  const FS=0.66, SIDE=5.5*FS, N=38;
  const T_G1=0.9, BINDD=0.5, SYND=1.3, MOVD=0.7, GEN=BINDD+SYND+MOVD,
        ASYNC=1.12, JIT=0.48, GAP=0.1, HOLD=3.0, DRIFT=0.8;
  /* a heading anywhere within four-fifths of the circle either side of flat */
  const head=()=>(r()-0.5)*288;
  /* how far a copy may turn off its parent's heading as it separates: a
     drift, never a flip */
  const TWIST=36;
  const L_STR=el("g",{}), L_POL=el("g",{});
  stage.appendChild(L_STR); stage.appendChild(L_POL);
  const tr=(x,y,a)=>`translate(${x.toFixed(1)},${y.toFixed(1)}) `+
    `rotate(${a.toFixed(1)}) scale(${FS})`;
  const rot=(a,x,y)=>[x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a)];

  /* a copy's home: near its parent, inside the ring by enough that most of it
     shows, and as far from every home already handed out as a dozen tries
     can find. The three templates are placed the same way across the middle
     of the glass, so they start apart. */
  const S=[];
  const inside=(x,y,e)=>(x/LX)*(x/LX)+(y/LY)*(y/LY)<=e*e;
  const home=(near,side)=>{
    let best=null, bs=-1;
    for(let c=0;c<12;c++){
      /* a copy's candidates all lie out on its own side of the parent, so
         separating never means passing back across it */
      const a=near ? near.a*Math.PI/180+side*Math.PI/2+(r()-0.5)*2.2 : r()*6.283,
            d=r();
      const x=near ? near.x+Math.cos(a)*(10+24*d) : Math.cos(a)*LX*0.6*Math.sqrt(d);
      const y=near ? near.y+Math.sin(a)*(10+24*d) : Math.sin(a)*LY*0.6*Math.sqrt(d);
      if(!inside(x,y,0.86)) continue;
      const s=S.reduce((m,o)=>Math.min(m,Math.hypot(o.x-x,o.y-y)),1e9);
      if(s>bs){ bs=s; best={x,y}; }
    }
    if(best) return best;
    const a=r()*6.283, d=0.86*Math.sqrt(r());
    return {x:Math.cos(a)*LX*d, y:Math.sin(a)*LY*d};
  };
  for(let i=0;i<3;i++){ const h=home(null);
    S.push({x:h.x, y:h.y, a:head(), k:i*1.9, ph:r()*6.283, par:null}); }
  const queue=S.map(s=>({s, at:T_G1+r()*ASYNC}));
  while(S.length<N){
    let mi=0; queue.forEach((e,i)=>{ if(e.at<queue[mi].at) mi=i; });
    const {s:p, at}=queue.splice(mi,1)[0];
    const side=r()<0.5?1:-1, h=home(p,side);
    /* the enzyme comes in from the far side of its template, the side its
       body will sit on, rather than across the glass from the rim */
    const ein=rot(p.a*Math.PI/180, 0, -side*26);
    const c={x:h.x, y:h.y, a:p.a+(r()-0.5)*TWIST, k:p.k, ph:r()*6.283, par:p, t0:at, side,
             ex:p.x+ein[0], ey:p.y+ein[1]};
    S.push(c);
    const free=at+GEN+GAP;
    queue.push({s:p, at:free+r()*JIT}, {s:c, at:free+r()*JIT});
  }
  const T_FULL=Math.max(...S.map(s=>s.par ? s.t0+GEN : 0)), TOT=T_FULL+HOLD;

  /* the backbone is revealed by a dash measured in pathLength, so how much of
     a copy exists is one number the clock sets rather than a path rebuilt */
  S.forEach(s=>{
    if(!s.par){ s.g=strand(L_STR,s.k,tr(s.x,s.y,s.a),"1"); return; }
    s.g=strand(L_STR,s.k,tr(s.x,s.y,s.a),"0");
    s.parts=[...s.g.childNodes];
    s.parts[0].setAttribute("pathLength","1");
    s.parts[0].setAttribute("stroke-dasharray","1 1");
    s.parts[0].setAttribute("stroke-dashoffset","1");
  });
  /* the enzyme: B8's bead grammar — solid pale body, hole cut in --bg — but
     the hole is a channel rather than a pocket, and the two feet either side of
     it are what makes it sit ON the strand instead of beside it. Born at the
     point it comes in from. */
  S.forEach(s=>{ if(!s.par) return;
    s.pol=el("g",{transform:tr(s.ex,s.ey,0),opacity:"0"});
    L_POL.appendChild(s.pol);
    s.pol.appendChild(el("path",{d:POLYMERASE_D,fill:"var(--fg)","fill-opacity":".82",
      stroke:"var(--stroke)","stroke-width":".6","stroke-opacity":".5"}));
  });

  /* the ring last, over everything, so nothing inside can soften its own edge */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,fill:"none",
    stroke:"var(--fg2)","stroke-width":"1.5","stroke-opacity":".85"}));

  /* ---- THE HANDOVER -------------------------------------------------------
     Asked for from the page: a connection to the next module. The lane's track
     already joins the two dots, but it runs ground to ground, and what is
     handed on is what is in this glass. B9 opens on a strip of tubes, the
     thing it loads from, and on screen that strip stands inside this ring's
     lower right. So one arc runs from the middle of the glass into the strip's
     back tube, the one B9 loads first — the flowLine and chevron B8 draws its
     own handover with, so the row says "goes on to" one way.

     THE FAR END IS A FRACTION OF THIS NODE, not a read of B9's — the bargain B8
     and C4 already make. The lane stands B9 about 1.69 of this width along, and
     its strip sits 0.27 of B9's width back from its centre. A resize here
     carries both ends; B9 moving on its own would leave this pointing where it
     was.

     It lives in this group, so B9's tile, painted after, stands over its end
     and the line goes into the tube rather than across it. Lit through the
     hold on the full glass — what goes on is the amplified library, so the
     bead cannot leave before the cloud is made — and faint the rest of the
     loop, because the connection is a fact about the station.

     ASKED FOR AGAIN — "draw a connector to the next step" — BECAUSE IT WAS
     NOT BEING SEEN. The ends were right and still are (B9 stands 1.687 of
     this width along); the weight was wrong. The 0.22 the other handovers
     rest at is read against bare ground, and this one lies across a glass
     full of strands, and the opaque glass hides the lane's own track from
     here to B9, so for most of the loop nothing on screen joined the two. So
     this one rests at REST rather than 0.22, and its stroke is heavier and
     scaled with the node like everything else on the tile. */
  const REST=0.55;
  const hand=flowLine(g, MID, P(n.x+n.w*1.42, n.y-n.d*0.227, n.h*0.6),
    "var(--fg2)", SC);
  hand.line.setAttribute("stroke-width",(1.6*SC).toFixed(2));
  /* the chevron already carries scale(SC), so its width is written unscaled */
  hand.chev.setAttribute("stroke-width","1.6");
  setFanLine(hand, REST, 0);

  /* ---- TIMING -------------------------------------------------------------
     Three strands adrift long enough to be counted; then copy after copy,
     each an enzyme landing, a walk that writes the copy, and a peel, until
     the glass is full; then a hold on the full glass. The walk is the slow
     part and it is linear — an enzyme that eased in and out along a strand
     would read as sliding into place rather than travelling.

     ASKED FOR AN EIGHTH TIME: "make the replication a bit faster, and it can
     be asynchronous — different strands can amplify at slightly different
     times." So the beats are short and every start is a seeded moment of its
     own. The only order kept is the one the chemistry keeps: a strand is not
     copied before it exists, and a strand is not copied twice at once.

     PLACEMENT IS A PURE FUNCTION OF THE CLOCK. Everything is stated from t
     alone rather than nudged from where it was, so a frame long enough to skip
     a whole beat — a tab coming back, a step in trace mode — cannot leave an
     enzyme halfway down a template it has already finished. Thirty-eight
     strands is a few hundred attributes a frame, so each is written only when
     its value changes, and a finished copy costs one transform. */
  const CHIPX=CHIP.map((c,i)=>-8.4+i*6.2);
  const set=(e,a,v)=>{ const key="_amp_"+a;
    if(e[key]!==v){ e[key]=v; e.setAttribute(a,v); } };
  const turn=(a,b)=>((b-a)%360+540)%360-180;

  const place=(t,ph)=>{
    /* parents come before their copies in S, so a parent's place this frame
       is known by the time a copy being written off it asks */
    S.forEach(s=>{
      const dx=Math.cos(ph*0.8+s.ph)*DRIFT, dy=Math.sin(ph*0.6+s.ph)*DRIFT;
      if(!s.par){ s.cx=s.x+dx; s.cy=s.y+dy; s.ca=s.a;
        set(s.g,"transform",tr(s.cx,s.cy,s.a)); return; }
      const p=s.par, t0=s.t0, A=p.ca*Math.PI/180;
      const b=ease(clamp((t-t0)/BINDD)), w=clamp((t-t0-BINDD)/SYND),
            m=ease(clamp((t-t0-BINDD-SYND)/MOVD));
      /* written in register alongside its parent, then peeled off to its own
         home, turning to its own angle on the way */
      const al=rot(A,0,s.side*SIDE);
      const bx=p.cx+al[0], by=p.cy+al[1];
      s.cx=bx+(s.x+dx-bx)*m; s.cy=by+(s.y+dy-by)*m; s.ca=p.ca+turn(p.ca,s.a)*m;
      /* a dash of zero length still draws its round cap, so an unwritten
         copy is switched off rather than left as a dot */
      set(s.g,"opacity",clamp(w*20).toFixed(2));
      if(w>0) set(s.g,"transform",tr(s.cx,s.cy,s.ca));
      const xe=-HL+2*HL*w;
      set(s.parts[0],"stroke-dashoffset",(1-w).toFixed(3));
      CHIPX.forEach((x0,ci)=>set(s.parts[1+ci],"opacity",
        clamp((xe-x0)/4.6).toFixed(2)));
      set(s.parts[4],"opacity",clamp((w-0.9)/0.1).toFixed(2));
      /* the enzyme rides its template's own frame at the growing end of the
         copy, feet either side of the template and its body on the far side
         from the copy; when the walk is done it lifts off that side */
      const vis=0.9*clamp(b/0.25)*(1-m);
      set(s.pol,"opacity",vis.toFixed(2));
      if(vis>0){
        const on=rot(A, xe*FS, (-1.6-8*m)*s.side*FS);
        const tx=p.cx+on[0], ty=p.cy+on[1];
        set(s.pol,"transform",tr(s.ex+(tx-s.ex)*b, s.ey+(ty-s.ey)*b,
          p.ca+(s.side>0?0:180)));
      }
    });
  };

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader,
     and for this one it has to be the full glass — the frame the request asks
     the figure to end on. */
  let t=T_FULL+HOLD*0.5, ph=0;
  const run=dt=>{ t=(t+dt)%TOT; ph+=dt*1.7; place(t,ph);
    setFanLine(hand, REST, (t-T_FULL)/HOLD); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.pcramplify = drawPcrAmplify;

/* ------------------------------------------------------------------
   B9 · QUANTIFY THE cDNA — a strip loaded into a cassette, and run.

   REBUILT FROM "EDIT VISUAL", NOT EDITED. The request named three objects and
   their arrangement and nothing else: a strip of PCR tubes, a flat cassette
   with a row of narrow lanes across it, and two thin electrode pins over one
   lane. So the machine, the display and the trace that stood here are gone
   rather than rearranged. C3 has since followed onto B9a's bench, so the
   machine and display components they shared are gone as well.

   ANIMATED FROM "EDIT VISUAL" A SECOND TIME, with the arrangement kept: a
   drop, the pins down, the run, a trace. It is B9a's sequence written out
   again rather than called, because a part shared with the station next door
   would bring that station's layout with it.

   AND A THIRD TIME, which moved more than the second did. Every lane is loaded
   now, not one, so there are as many lanes as tubes and each tube stands level
   with its own lane. Each tube has its own colour, and the colour follows the
   sample into its well, along its lane and onto its trace: it says which tube
   a lane came from, not that the tubes hold different things. The pins became
   two electrodes laid across the whole cassette, − over the wells and + at the
   far end, because a pin over one lane cannot drive eight, and a sign is what
   says an electrode is an electrode. The trace is written while the run goes,
   not after it, and it stands to the right of the cassette rather than over
   it, so nothing has to dim to make room.

   THE STRIP STANDS BEHIND AND THE WELLS FACE IT. Tubes along y at the back of
   the tile, lanes along x so a lane reads left to right the way the row does,
   and every well at the end nearest the strip. So every drop is one straight
   hop along x, and none crosses a lane to get to its own.

   Composed at w .72, d .72, h .40; every position is a fraction of the node
   and every stroke is scaled with it.
   ------------------------------------------------------------------ */
function drawQuantify(g,n){
  const SC=n.w/0.72;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  /* one ink per tube, spread round the wheel so neighbours never share a hue.
     --ch8 sits out: in the dark theme it is --signal, and --signal is kept
     for the electrodes touching down */
  const INK=["--ch1","--ch2","--ch3","--ch5","--ch6","--ch9","--ch10","--ch11"]
    .map(v=>`var(${v})`);
  const NL=INK.length;

  /* the cassette's footprint and its lanes come first, because the strip is
     laid out off them: tube j stands level with lane j */
  const cas={x:n.x+n.w*0.10, y:n.y+n.d*0.01, w:n.w*0.50, d:n.d*0.64, h:n.h*0.14};
  const lx0=cas.x-cas.w*0.42, lx1=cas.x+cas.w*0.43, lhw=cas.d*0.028, WW=cas.w*0.09;
  const laneY=j=>cas.y-cas.d/2+cas.d*(0.13+j*0.74/(NL-1));
  const sx0=lx0+WW*0.5, run=lx1-sx0;

  /* ---- THE STRIP ----------------------------------------------------------
     Eight tubes on the web that makes them one strip, drawn back to front so
     each tube stands in front of the one behind it. Tapered, because a PCR
     tube is. */
  const tx=n.x-n.w*0.27, tr=n.d*0.027, th=n.h*0.55;
  g.appendChild(el("polygon",{points:pts([P(tx-tr*1.1,laneY(0),th),P(tx+tr*1.1,laneY(0),th),
    P(tx+tr*1.1,laneY(NL-1),th),P(tx-tr*1.1,laneY(NL-1),th)]),fill:"var(--g-top)",
    "fill-opacity":".5",stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),
    "stroke-opacity":".5"}));
  for(let i=0;i<NL;i++){
    const ty=laneY(i);
    const foot=ellipseAt(tx,ty,0,tr*0.55), lvl=ellipseAt(tx,ty,th*0.36,tr*0.72),
          rim=ellipseAt(tx,ty,th,tr);
    g.appendChild(el("polygon",{points:pts([...arcPts(rim,0,Math.PI,10),
      ...arcPts(foot,Math.PI,0,8)]),fill:"var(--g-top)","fill-opacity":".45",
      stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".5"}));
    g.appendChild(el("polygon",{points:pts([...arcPts(lvl,0,Math.PI,10),
      ...arcPts(foot,Math.PI,0,8)]),fill:INK[i],"fill-opacity":".7"}));
    g.appendChild(el("ellipse",{cx:rim.x.toFixed(1),cy:rim.y.toFixed(1),
      rx:rim.rx.toFixed(2),ry:rim.ry.toFixed(2),fill:"var(--bg)","fill-opacity":".35",
      stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".55"}));
  }

  /* ---- THE CASSETTE -------------------------------------------------------
     Low and flat, in front of the strip. No lane is picked out any more:
     every one is loaded, so every one is drawn the same. */
  paint(g,cas.x,cas.y,cas.w,cas.d,cas.h,SKIN.tile);
  const top=(x0,x1,y0,y1)=>pts([P(x0,y0,cas.h),P(x1,y0,cas.h),P(x1,y1,cas.h),P(x0,y1,cas.h)]);
  const wells=[];
  for(let j=0;j<NL;j++){
    const ly=laneY(j);
    g.appendChild(el("polygon",{points:top(lx0,lx1,ly-lhw,ly+lhw),
      fill:"var(--bg)","fill-opacity":".7",stroke:"var(--stroke)",
      "stroke-width":(0.5*SC).toFixed(2),"stroke-opacity":".55"}));
    g.appendChild(el("polygon",{points:top(lx0,lx0+WW,ly-lhw*1.4,ly+lhw*1.4),
      fill:"var(--bg)","fill-opacity":".9",stroke:"var(--stroke)",
      "stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".6"}));
    const w=el("polygon",{points:top(lx0,lx0+WW,ly-lhw*1.4,ly+lhw*1.4),
      fill:INK[j],"fill-opacity":"0"});
    g.appendChild(w); wells.push(w);
  }

  /* the fragments: three sizes, and smaller goes further in the same three
     seconds, which is the whole of the physics asked for and all of it this
     figure claims. How many of each size a lane carries is drawn per lane —
     one to three — and COUNT keeps it, because the lane's trace is built off
     the same numbers: a peak is as tall as its group is numerous. */
  const SIZES=[{r:0.4,far:0.92},{r:0.6,far:0.58},{r:0.85,far:0.30}];
  const rr=rng(911), dots=[], COUNT=[];
  for(let j=0;j<NL;j++){
    const ly=laneY(j);
    COUNT.push(SIZES.map(G=>{
      const m=1+Math.floor(rr()*3);
      for(let i=0;i<m;i++){
        const D={far:G.far*(0.95+rr()*0.10), y:ly+(rr()-0.5)*lhw*1.1};
        const p=P(sx0,D.y,cas.h);
        D.e=el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:(G.r*SC).toFixed(2),
          fill:INK[j],"fill-opacity":"0"});
        g.appendChild(D.e); dots.push(D);
      }
      return m;
    }));
  }
  const dotsAt=(f,op)=>dots.forEach(D=>{
    const p=P(sx0+run*D.far*f, D.y, cas.h);
    D.e.setAttribute("cx",p[0].toFixed(1)); D.e.setAttribute("cy",p[1].toFixed(1));
    D.e.setAttribute("fill-opacity",op.toFixed(2));
  });

  /* ---- THE DROPS ----------------------------------------------------------
     One per tube, each into the well level with it, one after another and
     quick — loading is a pipette going down a row, not eight pipettes. A hop
     rather than a line, as before. Each is born on its own tube's rim. */
  const hop=n.h*0.35;
  const drops=INK.map((ink,j)=>{
    const ly=laneY(j);
    const at=u=>P(tx+(sx0-tx)*u, ly, th+(cas.h-th)*u+hop*Math.sin(Math.PI*u));
    const p=at(0);
    const e=el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:(1.2*SC).toFixed(2),
      fill:ink,"fill-opacity":"0"});
    g.appendChild(e);
    return {at,e};
  });

  /* ---- THE ELECTRODES -----------------------------------------------------
     Two bars laid across every lane: one over the wells and one over the far
     ends, the two places a run is driven between. DNA is negative and runs to
     the positive, so the wells get − and the far end +, and the sign rides on
     each stem so the reader is told what the bars are rather than left to
     guess. Under each, a faint drop to the cassette, because in this
     projection a bar hanging over the lanes and a bar lying on the ones behind
     draw in the same place; it shortens as the bar comes down. Contact is
     --signal. Born raised; `down` is 0 to 1. */
  const UP=n.h*0.45, PL=n.h*0.6;
  const ey0=laneY(0)-lhw*2.4, ey1=laneY(NL-1)+lhw*2.4, ym=(ey0+ey1)/2;
  const rods=[[sx0,"−"],[lx1-cas.w*0.05,"+"]].map(([px,sign])=>{
    const s=P(px,ym,cas.h), z=cas.h+UP, a0=P(px,ey0,z), a1=P(px,ey1,z),
          m=P(px,ym,z), tp=P(px,ym,z+PL);
    const Q={px,
      guide:el("line",{x1:s[0].toFixed(1),y1:s[1].toFixed(1),x2:m[0].toFixed(1),
        y2:m[1].toFixed(1),stroke:"var(--fg3)","stroke-width":(0.6*SC).toFixed(2),
        "stroke-opacity":".6","stroke-dasharray":`${(1.2*SC).toFixed(2)} ${(1.6*SC).toFixed(2)}`}),
      bar:el("line",{x1:a0[0].toFixed(1),y1:a0[1].toFixed(1),x2:a1[0].toFixed(1),
        y2:a1[1].toFixed(1),stroke:"var(--fg2)","stroke-width":(1.6*SC).toFixed(2),
        "stroke-linecap":"round"}),
      stem:el("line",{x1:m[0].toFixed(1),y1:m[1].toFixed(1),x2:tp[0].toFixed(1),
        y2:tp[1].toFixed(1),stroke:"var(--fg2)","stroke-width":(0.9*SC).toFixed(2),
        "stroke-linecap":"round"}),
      sign:el("text",{x:tp[0].toFixed(1),y:(tp[1]-1.2*SC).toFixed(1),"text-anchor":"middle",
        "font-family":MONO,"font-size":(5*SC).toFixed(2),"font-weight":"700",
        fill:"var(--fg2)"})};
    Q.sign.textContent=sign;
    g.appendChild(Q.guide); g.appendChild(Q.bar); g.appendChild(Q.stem); g.appendChild(Q.sign);
    return Q;
  });
  const rodsAt=(down,lit)=>rods.forEach(Q=>{
    const z=cas.h+UP*(1-down);
    const a0=P(Q.px,ey0,z), a1=P(Q.px,ey1,z), m=P(Q.px,ym,z), tp=P(Q.px,ym,z+PL);
    Q.guide.setAttribute("x2",m[0].toFixed(1)); Q.guide.setAttribute("y2",m[1].toFixed(1));
    Q.bar.setAttribute("x1",a0[0].toFixed(1));  Q.bar.setAttribute("y1",a0[1].toFixed(1));
    Q.bar.setAttribute("x2",a1[0].toFixed(1));  Q.bar.setAttribute("y2",a1[1].toFixed(1));
    Q.stem.setAttribute("x1",m[0].toFixed(1));  Q.stem.setAttribute("y1",m[1].toFixed(1));
    Q.stem.setAttribute("x2",tp[0].toFixed(1)); Q.stem.setAttribute("y2",tp[1].toFixed(1));
    Q.sign.setAttribute("x",tp[0].toFixed(1));  Q.sign.setAttribute("y",(tp[1]-1.2*SC).toFixed(1));
    const ink=lit?"var(--signal)":"var(--fg2)";
    Q.bar.setAttribute("stroke",ink); Q.sign.setAttribute("fill",ink);
  });

  /* ---- THE GRAPH ----------------------------------------------------------
     Screen-space and scaled by being scaled, as B9a's is: a chart on a plane of
     the projection shears its type thirty degrees. Axis origin at the group's
     own 0,0, x to the right and intensity up, on a backing panel so the traces
     are read against their own axes and not the ground grid. One trace per
     lane in its tube's colour, one peak per fragment size, small to large from
     the left; the axes carry names and no units because no request gave a
     size range.

     IT STANDS RIGHT OF THE CASSETTE, hung off the cassette's far corner, in
     the wedge between B9's own name — which leaves the tile's back edge and
     climbs up-right — and B9a's tile and graph below it. That wedge is why it
     is smaller than B9a's. */
  const GW=26, GH=10, FS=2.6;
  const anc=P(cas.x+cas.w/2, cas.y-cas.d/2, cas.h);
  const KX=anc[0]+21*SC, KY=anc[1]-11*SC;
  const gr=el("g",{transform:`translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`,
    opacity:"0"});
  g.appendChild(gr);
  const PT0=-GH-FS-3.5, PB=FS+2.5;
  gr.appendChild(el("rect",{x:"-3",y:PT0.toFixed(1),width:(GW+6).toString(),
    height:(PB-PT0).toFixed(1),rx:"1.2",fill:"var(--bg)","fill-opacity":".9",
    stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"}));
  gr.appendChild(el("polyline",{points:`0,${-GH} 0,0 ${GW},0`,fill:"none",
    stroke:"var(--fg2)","stroke-width":".5","stroke-opacity":".7"}));
  const xl=el("text",{x:(GW/2).toString(),y:(FS+1.2).toFixed(1),"text-anchor":"middle",
    "font-family":MONO,"font-size":FS.toFixed(2),fill:"var(--fg2)"});
  xl.textContent="size"; gr.appendChild(xl);
  const yl=el("text",{x:"-0.4",y:(-GH-1.4).toFixed(1),"text-anchor":"start",
    "font-family":MONO,"font-size":FS.toFixed(2),fill:"var(--fg2)"});
  yl.textContent="intensity"; gr.appendChild(yl);
  const MU=[0.2,0.5,0.8], SD=0.028, N=120;
  const curves=COUNT.map(ms=>{
    const c=[];
    for(let i=0;i<=N;i++){ const u=i/N; let v=0.06;
      ms.forEach((m,k)=>{ v+=m*Math.exp(-((u-MU[k])*(u-MU[k]))/(2*SD*SD)); });
      c.push([u,v]); }
    return c;
  });
  /* one scale for every lane, so a tall peak is tall against its neighbours
     and not only against itself */
  let peak=0; curves.forEach(c=>c.forEach(p=>{ peak=Math.max(peak,p[1]); }));
  const traces=curves.map((c,j)=>{
    const p=c.map(([u,v])=>(u*GW).toFixed(2)+","+(-(v/peak)*GH*0.9).toFixed(2));
    const e=el("polyline",{points:p.join(" "),fill:"none",stroke:INK[j],
      "stroke-width":".55","stroke-opacity":".85","stroke-linecap":"round",
      "stroke-linejoin":"round"});
    gr.appendChild(e);
    return {p,e};
  });
  /* WRITTEN AS FAR AS THE RUN HAS GOT. Born whole; the ticker cuts each trace
     at the run's own fraction, so the small end — the fragments that have gone
     furthest — is on the page first and the large end arrives with the slow
     ones. Cut by x rather than by dash length: a dash reveals by arc length,
     and a trace's arc length is almost all peaks, so it would stall on each. */
  let shown=N;
  const traceAt=f=>{
    const k=Math.max(1,Math.round(f*N));
    if(k===shown) return;
    shown=k;
    traces.forEach(T=>T.e.setAttribute("points",T.p.slice(0,k+1).join(" ")));
  };

  /* ---- TIMING -------------------------------------------------------------
     Loading is quick, as asked: a drop every fifth of a second, each under
     half a second in the air. Then the electrodes come down and hold, the run
     takes three seconds with the graph drawn alongside it, the electrodes lift
     as it ends, and the finished traces hold before the loop clears — a loop
     that snaps from a finished graph to a bare cassette reads as a glitch
     rather than a restart. */
  const DR=0.45, STAG=0.2, LOAD=STAG*(NL-1)+DR, LOWER=0.35, HOLD1=0.65,
        RUNT=3, HOLD2=3, CLEAR=0.8, FADE=0.6;
  const t1=LOAD, t2=t1+LOWER, t3=t2+HOLD1, t4=t3+RUNT, t5=t4+HOLD2, T=t5+CLEAR;
  const place=t=>{
    drops.forEach((D,j)=>{
      const u=clamp((t-j*STAG)/DR), q=D.at(ease(u));
      D.e.setAttribute("cx",q[0].toFixed(1)); D.e.setAttribute("cy",q[1].toFixed(1));
      D.e.setAttribute("fill-opacity",(t<t1 ? 0.9*clamp(u/0.1)*(1-clamp((u-0.9)/0.1)) : 0).toFixed(2));
      wells[j].setAttribute("fill-opacity",(t<t3 ? 0.75*clamp((u-0.9)/0.1) :
        t<t5 ? 0.75-0.5*clamp((t-t3)/RUNT) : 0.25*(1-clamp((t-t5)/CLEAR))).toFixed(2));
    });
    rodsAt(t<t1 ? 0 : t<t2 ? ease((t-t1)/LOWER) : t<t4 ? 1 : 1-ease(clamp((t-t4)/FADE)),
      t>=t2 && t<t4);
    /* constant speed in the lane: a run is a field, not an ease */
    const f=clamp((t-t3)/RUNT);
    dotsAt(f, t<t3 ? 0 : t<t5 ? 0.85*clamp((t-t3)/0.2) : 0.85*(1-clamp((t-t5)/CLEAR)));
    gr.setAttribute("opacity",(t<t3 ? 0 : t<t5 ? clamp((t-t3)/0.3)
      : 1-clamp((t-t5)/CLEAR)).toFixed(2));
    traceAt(f);
  };

  /* THE CLOCK DOES NOT START AT ZERO. Reduced motion never advances it, so
     the frame it starts on is the whole station for that reader — and the
     frame that says what the station is for is the finished graph beside the
     run lanes, with the electrodes raised. */
  let t=t4+HOLD2*0.5;
  const tick=dt=>{ t=(t+dt)%T; place(t); };
  tick(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; tick(dt); });
}
DRAW.quantify = drawQuantify;

/* ------------------------------------------------------------------
   B9a · MEASURE THE SIZE DISTRIBUTION — a readout, and nothing else.

   ASKED FOR FROM THE PAGE, from "Add a module", and the request set both the
   objects and their order: a strip of PCR tubes, a flat cassette with a row of
   narrow lanes, electrodes over it, a run and a trace.

   AND AGAIN FROM "EDIT VISUAL", with B9's third request word for word, so it
   gets B9's answer in B9a's own layout. Every lane is loaded, quickly and
   before the electrodes come down, so there are as many lanes as tubes and
   each tube stands level with its own lane. Each tube has its own colour, and
   the colour follows the sample into its well, along its lane and onto its
   trace: it says which tube a lane came from, not that the tubes hold
   different things. The electrodes are two bars across the whole cassette,
   − over the wells and + at the far end, because a sign is what says an
   electrode is an electrode. The trace is written while the run goes, not
   after it, and it stands to the right of the cassette rather than over it,
   so the cassette no longer steps back to make room.

   NOTHING IS MADE HERE, and the drawing is built so it cannot say otherwise.
   Nothing leaves the station: the only new thing at the end of the loop is
   the traces, and a trace is its lane read a second way rather than a
   material.

   THE PEAKS ARE THE LANE'S, COUNTED. Fragments come in three sizes, and how
   many of each a lane carries is drawn per lane; its trace has one peak per
   size, small to large from the left, each as tall as its group is numerous.
   That is the one relation the figure asserts, and it is not a claim about any
   real library: no request gave a size range, so the axes carry names and no
   units.

   THE GRAPH IS SCREEN-SPACE, AND SCALED BY BEING SCALED. A chart on a plane
   of the projection shears its type thirty degrees, so it sits in a group
   carrying scale(n.w / .95), hung off the cassette's far corner, and a resize
   takes it along.

   C3 RUNS ON THIS BENCH TOO, and says so through `o`: which sizes a lane
   carries, how many at least, how wide a peak is, and a printed window on
   the size axis. Left out, every one of them is B9a's, so B9a is drawn
   exactly as it was before C3 asked to match it.

   Composed at w .95, d .95, h .40; every position is a fraction of the node
   and every stroke is scaled with it.
   ------------------------------------------------------------------ */
function drawSizeRun(g,n,o){
  o=o||{};
  const SC=n.w/0.95;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  /* B9's inks in B9's order, so tube j reads the same on both benches. --ch8
     sits out: in the dark theme it is --signal, kept for contact */
  const INK=["--ch1","--ch2","--ch3","--ch5","--ch6","--ch9","--ch10","--ch11"]
    .map(v=>`var(${v})`);
  const NL=INK.length;

  /* the cassette's footprint and its lanes come first, because the strip is
     laid out off them: tube j stands level with lane j */
  const cas={x:n.x+n.w*0.14, y:n.y-n.d*0.14, w:n.w*0.46, d:n.d*0.46, h:n.h*0.14};
  const lx0=cas.x-cas.w*0.42, lx1=cas.x+cas.w*0.43, lhw=cas.d*0.028, WW=cas.w*0.09;
  const laneY=j=>cas.y-cas.d/2+cas.d*(0.13+j*0.74/(NL-1));
  const sx0=lx0+WW*0.5, run=lx1-sx0;

  /* ---- THE STRIP ----------------------------------------------------------
     Eight tubes on the web that makes them one strip, drawn back to front so
     each tube stands in front of the one behind it. Tapered, because a PCR
     tube is. */
  const tx=n.x-n.w*0.30, tr=n.d*0.02, th=n.h*0.55;
  g.appendChild(el("polygon",{points:pts([P(tx-tr*1.1,laneY(0),th),P(tx+tr*1.1,laneY(0),th),
    P(tx+tr*1.1,laneY(NL-1),th),P(tx-tr*1.1,laneY(NL-1),th)]),fill:"var(--g-top)",
    "fill-opacity":".5",stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),
    "stroke-opacity":".5"}));
  for(let i=0;i<NL;i++){
    const ty=laneY(i);
    const foot=ellipseAt(tx,ty,0,tr*0.55), lvl=ellipseAt(tx,ty,th*0.36,tr*0.72),
          rim=ellipseAt(tx,ty,th,tr);
    g.appendChild(el("polygon",{points:pts([...arcPts(rim,0,Math.PI,10),
      ...arcPts(foot,Math.PI,0,8)]),fill:"var(--g-top)","fill-opacity":".45",
      stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".5"}));
    g.appendChild(el("polygon",{points:pts([...arcPts(lvl,0,Math.PI,10),
      ...arcPts(foot,Math.PI,0,8)]),fill:INK[i],"fill-opacity":".7"}));
    g.appendChild(el("ellipse",{cx:rim.x.toFixed(1),cy:rim.y.toFixed(1),
      rx:rim.rx.toFixed(2),ry:rim.ry.toFixed(2),fill:"var(--bg)","fill-opacity":".35",
      stroke:"var(--stroke)","stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".55"}));
  }

  /* ---- THE CASSETTE -------------------------------------------------------
     Low and flat, in front of the strip. Every lane is loaded, so every one
     is drawn the same. */
  paint(g,cas.x,cas.y,cas.w,cas.d,cas.h,SKIN.tile);
  const top=(x0,x1,y0,y1)=>pts([P(x0,y0,cas.h),P(x1,y0,cas.h),P(x1,y1,cas.h),P(x0,y1,cas.h)]);
  const wells=[];
  for(let j=0;j<NL;j++){
    const ly=laneY(j);
    g.appendChild(el("polygon",{points:top(lx0,lx1,ly-lhw,ly+lhw),
      fill:"var(--bg)","fill-opacity":".7",stroke:"var(--stroke)",
      "stroke-width":(0.5*SC).toFixed(2),"stroke-opacity":".55"}));
    g.appendChild(el("polygon",{points:top(lx0,lx0+WW,ly-lhw*1.4,ly+lhw*1.4),
      fill:"var(--bg)","fill-opacity":".9",stroke:"var(--stroke)",
      "stroke-width":(0.6*SC).toFixed(2),"stroke-opacity":".6"}));
    const w=el("polygon",{points:top(lx0,lx0+WW,ly-lhw*1.4,ly+lhw*1.4),
      fill:INK[j],"fill-opacity":"0"});
    g.appendChild(w); wells.push(w);
  }

  /* ---- THE CURRENT --------------------------------------------------------
     ASKED FOR FROM "EDIT VISUAL": the current was only a change of colour on
     two bars, and the request wanted a shock across the plate from − to +
     before anything moves. So once the bars are down, bolts crack from the −
     bar to the + bar with a visible front, the plate flashes as they arrive,
     and only then do the fragments set off. While the run lasts the bolts stay
     on, faint and crackling, because the field is what is moving them.
     They lie under the fragments so a lane is never hidden by its own field.
     Born whole along their own lines; the ticker cuts and re-jitters them. */
  const RX=[sx0, lx1-cas.w*0.05];
  const ey0=laneY(0)-lhw*2.4, ey1=laneY(NL-1)+lhw*2.4, ym=(ey0+ey1)/2;
  const flash=el("polygon",{points:top(lx0,lx1,ey0,ey1),fill:"var(--signal)",
    "fill-opacity":"0"});
  g.appendChild(flash);
  const NB=3, NS=14, JA=(ey1-ey0)*0.07, zb=cas.h+n.h*0.02, rb=rng(311);
  const bolts=Array.from({length:NB},(_,i)=>{
    const B={y:ey0+(ey1-ey0)*(i+0.5)/NB, j:[]};
    B.glow=el("polyline",{fill:"none",stroke:"var(--signal)","stroke-width":(2.6*SC).toFixed(2),
      "stroke-opacity":"0","stroke-linejoin":"round","stroke-linecap":"round"});
    B.core=el("polyline",{fill:"none",stroke:"var(--signal)","stroke-width":(0.8*SC).toFixed(2),
      "stroke-opacity":"0","stroke-linejoin":"round","stroke-linecap":"round"});
    g.appendChild(B.glow); g.appendChild(B.core);
    return B;
  });
  /* the ends are pinned to the bars; only the middle wanders */
  const jitter=()=>bolts.forEach(B=>{
    B.j=Array.from({length:NS+1},(_,i)=>i===0||i===NS ? 0 : (rb()-0.5)*2*JA); });
  const boltsAt=(f,op)=>{
    const k=Math.round(clamp(f)*NS);
    bolts.forEach(B=>{
      const p=[];
      for(let i=0;i<=Math.max(1,k);i++)
        p.push(P(RX[0]+(RX[1]-RX[0])*i/NS, B.y+B.j[i], zb));
      const s=pts(p);
      B.core.setAttribute("points",s); B.glow.setAttribute("points",s);
      B.core.setAttribute("stroke-opacity",op.toFixed(2));
      B.glow.setAttribute("stroke-opacity",(op*0.3).toFixed(2));
    });
  };
  jitter(); boltsAt(1,0);

  /* the fragments: smaller goes further in the same three seconds, which is
     the whole of the physics asked for and all of it this figure claims.
     COUNT keeps how many of each size a lane carries, because the lane's
     trace is built off the same numbers. */
  const SIZES=o.sizes||[{r:0.4,far:0.92,mu:0.2},{r:0.6,far:0.58,mu:0.5},
    {r:0.85,far:0.30,mu:0.8}];
  const rr=rng(o.seed||907), dots=[], COUNT=[], M0=o.least||1;
  for(let j=0;j<NL;j++){
    const ly=laneY(j);
    COUNT.push(SIZES.map(G=>{
      const m=M0+Math.floor(rr()*3);
      for(let i=0;i<m;i++){
        const D={far:G.far*(0.95+rr()*0.10), y:ly+(rr()-0.5)*lhw*1.1};
        const p=P(sx0,D.y,cas.h);
        D.e=el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:(G.r*SC).toFixed(2),
          fill:INK[j],"fill-opacity":"0"});
        g.appendChild(D.e); dots.push(D);
      }
      return m;
    }));
  }
  const dotsAt=(f,op)=>dots.forEach(D=>{
    const p=P(sx0+run*D.far*f, D.y, cas.h);
    D.e.setAttribute("cx",p[0].toFixed(1)); D.e.setAttribute("cy",p[1].toFixed(1));
    D.e.setAttribute("fill-opacity",op.toFixed(2));
  });

  /* ---- THE DROPS ----------------------------------------------------------
     One per tube, each into the well level with it, one after another and
     quick — loading is a pipette going down a row. Each is born on its own
     tube's rim. */
  const hop=n.h*0.35;
  const drops=INK.map((ink,j)=>{
    const ly=laneY(j);
    const at=u=>P(tx+(sx0-tx)*u, ly, th+(cas.h-th)*u+hop*Math.sin(Math.PI*u));
    const p=at(0);
    const e=el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:(1.2*SC).toFixed(2),
      fill:ink,"fill-opacity":"0"});
    g.appendChild(e);
    return {at,e};
  });

  /* ---- THE ELECTRODES -----------------------------------------------------
     B9's pair: a bar across every lane over the wells and one over the far
     ends. DNA is negative and runs to the positive, so the wells get − and
     the far end +, and the sign rides on each stem so the reader is told what
     the bars are. The dashed drop under each says where a bar hanging over
     the lanes will land, which this projection would otherwise leave to a
     guess. Contact is --signal. Born raised; `down` is 0 to 1. */
  const UP=n.h*0.45, PL=n.h*0.6;
  const rods=[[RX[0],"−"],[RX[1],"+"]].map(([px,sign])=>{
    const s=P(px,ym,cas.h), z=cas.h+UP, a0=P(px,ey0,z), a1=P(px,ey1,z),
          m=P(px,ym,z), tp=P(px,ym,z+PL);
    const Q={px,
      guide:el("line",{x1:s[0].toFixed(1),y1:s[1].toFixed(1),x2:m[0].toFixed(1),
        y2:m[1].toFixed(1),stroke:"var(--fg3)","stroke-width":(0.6*SC).toFixed(2),
        "stroke-opacity":".6","stroke-dasharray":`${(1.2*SC).toFixed(2)} ${(1.6*SC).toFixed(2)}`}),
      bar:el("line",{x1:a0[0].toFixed(1),y1:a0[1].toFixed(1),x2:a1[0].toFixed(1),
        y2:a1[1].toFixed(1),stroke:"var(--fg2)","stroke-width":(1.6*SC).toFixed(2),
        "stroke-linecap":"round"}),
      stem:el("line",{x1:m[0].toFixed(1),y1:m[1].toFixed(1),x2:tp[0].toFixed(1),
        y2:tp[1].toFixed(1),stroke:"var(--fg2)","stroke-width":(0.9*SC).toFixed(2),
        "stroke-linecap":"round"}),
      sign:el("text",{x:tp[0].toFixed(1),y:(tp[1]-1.2*SC).toFixed(1),"text-anchor":"middle",
        "font-family":MONO,"font-size":(5*SC).toFixed(2),"font-weight":"700",
        fill:"var(--fg2)"})};
    Q.sign.textContent=sign;
    g.appendChild(Q.guide); g.appendChild(Q.bar); g.appendChild(Q.stem); g.appendChild(Q.sign);
    return Q;
  });
  const rodsAt=(down,lit)=>rods.forEach(Q=>{
    const z=cas.h+UP*(1-down);
    const a0=P(Q.px,ey0,z), a1=P(Q.px,ey1,z), m=P(Q.px,ym,z), tp=P(Q.px,ym,z+PL);
    Q.guide.setAttribute("x2",m[0].toFixed(1)); Q.guide.setAttribute("y2",m[1].toFixed(1));
    Q.bar.setAttribute("x1",a0[0].toFixed(1));  Q.bar.setAttribute("y1",a0[1].toFixed(1));
    Q.bar.setAttribute("x2",a1[0].toFixed(1));  Q.bar.setAttribute("y2",a1[1].toFixed(1));
    Q.stem.setAttribute("x1",m[0].toFixed(1));  Q.stem.setAttribute("y1",m[1].toFixed(1));
    Q.stem.setAttribute("x2",tp[0].toFixed(1)); Q.stem.setAttribute("y2",tp[1].toFixed(1));
    Q.sign.setAttribute("x",tp[0].toFixed(1));  Q.sign.setAttribute("y",(tp[1]-1.2*SC).toFixed(1));
    const ink=lit?"var(--signal)":"var(--fg2)";
    Q.bar.setAttribute("stroke",ink); Q.sign.setAttribute("fill",ink);
  });

  /* ---- THE HANDOVER -------------------------------------------------------
     Only when a caller passes `hand`, because B9a's claim is that nothing
     leaves its bench. C3 is the other case: it is the last check before the
     sequencer, and what goes on is what is in the tubes. One arc runs from the
     back tube's rim — the one standing nearest the sequencer on screen — to
     the point `hand` names, the flowLine and chevron B8 and B8a draw their own
     handovers with, so the row says "goes on to" one way.

     `hand` is three fractions of THIS node, not a read of the next one's —
     the bargain B8 and B8a already make. A resize here carries both ends. */
  let hand=null;
  if(o.hand){
    const rim=ellipseAt(tx,laneY(0),th,tr);
    hand=flowLine(g, [rim.x, rim.y-rim.ry],
      P(n.x+n.w*o.hand[0], n.y+n.d*o.hand[1], n.h*o.hand[2]), "var(--fg2)", SC);
    setFanLine(hand, 0.22, 0);
  }

  /* ---- THE GRAPH ----------------------------------------------------------
     Axis origin at the group's own 0,0, x to the right and intensity up, on a
     backing panel so the traces are read against their own axes and not the
     ground grid. One trace per lane in its tube's colour.

     IT STANDS RIGHT OF THE CASSETTE, hung off the cassette's far corner, in
     the pocket between this station's own name — which leaves the tile's back
     edge and climbs up-right — and C1's name and block below it. That pocket
     is about the cassette's own size at the authored scale, and the panel is
     cut to it. */
  const GW=24, GH=9, FS=2.6;
  const anc=P(cas.x+cas.w/2, cas.y-cas.d/2, cas.h);
  const KX=anc[0]+10.6*SC, KY=anc[1]-9.8*SC;
  const gr=el("g",{transform:`translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`,
    opacity:"0"});
  g.appendChild(gr);
  const PT0=-GH-FS-3.5, PB=FS+2.5;
  gr.appendChild(el("rect",{x:"-3",y:PT0.toFixed(1),width:(GW+6).toString(),
    height:(PB-PT0).toFixed(1),rx:"1.2",fill:"var(--bg)","fill-opacity":".9",
    stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".5"}));
  gr.appendChild(el("polyline",{points:`0,${-GH} 0,0 ${GW},0`,fill:"none",
    stroke:"var(--fg2)","stroke-width":".5","stroke-opacity":".7"}));
  /* a window is printed before the traces so they are drawn landing in it,
     and its label stands in for "size": a range in bp already says the axis
     is size, and says it with the only numbers a caller was given */
  const WIN=o.window, XL=WIN ? GW*(WIN[0]+WIN[1])/2 : GW/2;
  if(WIN) gr.appendChild(el("rect",{x:(WIN[0]*GW).toFixed(2),y:(-GH).toString(),
    width:((WIN[1]-WIN[0])*GW).toFixed(2),height:GH.toString(),fill:"var(--fg2)",
    "fill-opacity":".12",stroke:"none"}));
  const xl=el("text",{x:XL.toFixed(2),y:(FS+1.2).toFixed(1),"text-anchor":"middle",
    "font-family":MONO,"font-size":FS.toFixed(2),fill:"var(--fg2)"});
  xl.textContent=WIN ? WIN[2] : "size"; gr.appendChild(xl);
  const yl=el("text",{x:"-0.4",y:(-GH-1.4).toFixed(1),"text-anchor":"start",
    "font-family":MONO,"font-size":FS.toFixed(2),fill:"var(--fg2)"});
  yl.textContent="intensity"; gr.appendChild(yl);
  const SD=o.sd||0.028, N=120;
  const curves=COUNT.map(ms=>{
    const c=[];
    for(let i=0;i<=N;i++){ const u=i/N; let v=0.06;
      ms.forEach((m,k)=>{ const d=u-SIZES[k].mu; v+=m*Math.exp(-(d*d)/(2*SD*SD)); });
      c.push([u,v]); }
    return c;
  });
  /* one scale for every lane, so a tall peak is tall against its neighbours
     and not only against itself */
  let peak=0; curves.forEach(c=>c.forEach(p=>{ peak=Math.max(peak,p[1]); }));
  const traces=curves.map((c,j)=>{
    const p=c.map(([u,v])=>(u*GW).toFixed(2)+","+(-(v/peak)*GH*0.9).toFixed(2));
    const e=el("polyline",{points:p.join(" "),fill:"none",stroke:INK[j],
      "stroke-width":".55","stroke-opacity":".85","stroke-linecap":"round",
      "stroke-linejoin":"round"});
    gr.appendChild(e);
    return {p,e};
  });
  /* WRITTEN AS FAR AS THE RUN HAS GOT. Born whole; the ticker cuts each trace
     at the run's own fraction, so the small end — the fragments that have gone
     furthest — is on the page first and the large end arrives with the slow
     ones. Cut by x rather than by dash length: a dash reveals by arc length,
     and a trace's arc length is almost all peaks, so it would stall on each. */
  let shown=N;
  const traceAt=f=>{
    const k=Math.max(1,Math.round(f*N));
    if(k===shown) return;
    shown=k;
    traces.forEach(T=>T.e.setAttribute("points",T.p.slice(0,k+1).join(" ")));
  };

  /* ---- TIMING -------------------------------------------------------------
     Loading is quick, as asked: a drop every fifth of a second, each under
     half a second in the air, and all of it done before the electrodes move.
     Then they come down, the shock crosses the plate and flashes as it lands,
     and only after the flash does the run start — the order is the cause.
     The run takes three seconds with the graph written alongside it, the
     electrodes lift as it ends, and the finished traces hold before the loop
     clears — a loop that snaps from a finished graph to a bare cassette reads
     as a glitch rather than a restart. */
  const DR=0.45, STAG=0.2, LOAD=STAG*(NL-1)+DR, LOWER=0.35, ARC0=0.1, ARCT=0.4,
        ARCH=0.3, HOLD1=ARC0+ARCT+ARCH, RUNT=3, HOLD2=3, CLEAR=0.8, FADE=0.6, CRACK=0.06;
  const t1=LOAD, t2=t1+LOWER, t3=t2+HOLD1, t4=t3+RUNT, t5=t4+HOLD2, T=t5+CLEAR;
  const ta=t2+ARC0, tb=ta+ARCT;
  let crack=-1;
  const place=t=>{
    /* a bolt that holds still is a wire; re-draw its wander a few times a
       second, and only while it is on the page */
    const on=t>=ta && t<t4;
    if(on && Math.floor(t/CRACK)!==crack){ crack=Math.floor(t/CRACK); jitter(); }
    boltsAt(t<tb ? (t-ta)/ARCT : 1,
      !on ? 0 : t<tb ? 1 : t<t3 ? 1-0.6*clamp((t-tb)/ARCH) : 0.22+0.2*rb());
    flash.setAttribute("fill-opacity",(t<tb || t>=t4 ? 0 :
      0.35*(1-clamp((t-tb)/(ARCH+0.2)))).toFixed(2));
    drops.forEach((D,j)=>{
      const u=clamp((t-j*STAG)/DR), q=D.at(ease(u));
      D.e.setAttribute("cx",q[0].toFixed(1)); D.e.setAttribute("cy",q[1].toFixed(1));
      D.e.setAttribute("fill-opacity",(t<t1 ? 0.9*clamp(u/0.1)*(1-clamp((u-0.9)/0.1)) : 0).toFixed(2));
      wells[j].setAttribute("fill-opacity",(t<t3 ? 0.75*clamp((u-0.9)/0.1) :
        t<t5 ? 0.75-0.5*clamp((t-t3)/RUNT) : 0.25*(1-clamp((t-t5)/CLEAR))).toFixed(2));
    });
    rodsAt(t<t1 ? 0 : t<t2 ? ease((t-t1)/LOWER) : t<t4 ? 1 : 1-ease(clamp((t-t4)/FADE)),
      t>=t2 && t<t4);
    /* constant speed in the lane: a run is a field, not an ease */
    const f=clamp((t-t3)/RUNT);
    dotsAt(f, t<t3 ? 0 : t<t5 ? 0.85*clamp((t-t3)/0.2) : 0.85*(1-clamp((t-t5)/CLEAR)));
    gr.setAttribute("opacity",(t<t3 ? 0 : t<t5 ? clamp((t-t3)/0.3)
      : 1-clamp((t-t5)/CLEAR)).toFixed(2));
    traceAt(f);
    /* lit through the hold on the finished graph: the library goes on once
       it has been seen to peak, not before */
    if(hand) setFanLine(hand, 0.22, (t-t4)/HOLD2);
  };

  /* THE CLOCK DOES NOT START AT ZERO. Reduced motion never advances it, so
     the frame it starts on is the whole station for that reader — and the
     frame that says what the station is for is the finished graph beside the
     run lanes, with the electrodes raised. */
  let t=t4+HOLD2*0.5;
  const tick=dt=>{ t=(t+dt)%T; place(t); };
  tick(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; tick(dt); });
}
DRAW.sizerun = drawSizeRun;

/* ------------------------------------------------------------------
   C1 · FRAGMENT AND END-PREP — one strand in, three blunt A-tailed pieces
   out, and nothing added yet.

   THE BENCH IS BARE AGAIN, AT A REQUEST FROM THE PAGE: remove the white
   chip, make the fragments the focus. The white chip was B8′a's cased
   cycler, put back under the glass by an earlier request; it went the way
   B8a's machine and C2's bench went, because nothing on this station can be
   seen from outside a shut lid and the glass already tells all of it.

   THE ADAPTERS ARE GONE ON PURPOSE. The request says this step does not attach
   anything new to the strand yet, and it is right about the picture: a fork
   drawn here would be the next station's news told early. The station's name
   still says "ligate adapters" because /pipeline owns the record; the drawing
   stops at the end the adapter will grip.

   SO THE GLASS CAME DOWN ONTO THE TILE, B8a's reasoning verbatim: a view of
   nothing is not a view. It used to hang off the near front corner on two
   grey leaders to the cycler, placed to clear the name above; with the
   cycler gone the glass is the station, and a station stands on its own box.
   The leaders went with the thing they pointed at.

   A CUT, THEN A REPAIR, THEN A BASE — THREE BEATS, BECAUSE THE REQUEST ASKED
   FOR THREE. The cut is staggered: at each break the two strands part at
   different points, so every new end has one strand standing proud of its
   partner, which is what an enzymatic cut leaves and why end-prep exists.
   Then each end squares up to its bottom strand: where the top strand stands
   proud it is trimmed back to it, where it falls short it is filled out to
   it, so both kinds of repair are on screen and every end finishes flat. The
   cap is a rung across the pair, drawn once the two strands end together.

   THE BLUE DOT IS ONE BASE, NOT A PART. It sits on the 3-prime strand of each
   end — the top strand on a right end, the bottom on a left — because that is
   where an A-tail is, and it is the only colour at the ends of the pieces
   so the eye goes to the thing the next station needs. It shares --ch8 with
   the first chip and is kept apart from it by shape and by distance: a round
   dot at an end, never a rounded block in the middle. It is labelled once, outside the rim,
   on the far-left end where nothing else on the map is reaching.

   THE STRAND IS CARRIED OVER, NOT DRAWN AGAIN. Asked for a fourth time, and
   this time the request said the strand should be the one the previous
   panel left — so the duplex runs on B8's spine, the wobble B8a's glass
   fills with, in B8's --c-top, stretched to the glass's width. B9 and B9a
   between here and there draw no strand, so there is no nearer one to match.
   ASKED FOR A FIFTH TIME: "make the DNA look like the barcoded ones in B8a.
   Its the same DNA being used. But make the strand from the barcode longer."
   So the chips and the gold come on — B8a's three, B8a's size against the
   strand, B8a's drop at the tip — and the arm running away from the barcode
   is drawn out to about three times B8a's, on the same wobble carried on
   past where B8a's strand stops, so the stretch B8a draws is still sample
   for sample the stretch here. The length is what gives the cuts somewhere
   to land: both fall in that arm, so the barcode stays whole on one piece,
   because a cut through a chip would be a claim about which piece keeps the
   barcode and the request makes none. The gold end gets no rung and no
   dot — it was never cut, and it is already capped by the drop.

   AND THE LOOP CUTS RATHER THAN UNDOING ITSELF: a strand does not re-anneal,
   so the pieces fade and the whole strand comes back.

   Spends --ch8 and --c-top, declared on /molecular_pipe; this shape is worn
   by that page's C1 alone.
   ------------------------------------------------------------------ */
function drawFragmentLigate(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE. Q is the one ruler the inset is
     written in, so the glass and everything in it grows with the tile by one
     number. Composed at w .72, d .72, h .4 — the tile C2 and B9 stand on. */
  const Q=n.w*S, SC=n.w/0.72;
  const DNA="var(--c-top)", ATAIL="var(--ch8)";
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const clamp=x=>x<0?0:x>1?1:x;
  const ease =x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- THE MAGNIFICATION, WHICH IS NOW THE WHOLE STATION ------------------
     A thin solid ellipse, this map's idiom for a view drawn larger than life,
     centred on the middle of the node's own box — through n.x, n.y and n.h,
     so the three dimensions a resize changes still move it together.

     THE RING IS B8a's RING, AT A REQUEST FROM THE PAGE: "make this a circle
     like in B8a." It used to be a flat lozenge cut to the strand's length,
     which read as a different instrument two stations on from B8a's glass.
     So the radii are B8a's own — 52 by 40 at its zoom of 1.32, through SC so a
     resize still grows it — and so are the line's weight and ink. The strand
     is untouched and sits in the middle with room above and below it, which
     is what B8a's rounder glass has around its own strands. */
  const LRX=52*1.32*SC, LRY=40*1.32*SC;
  const [KX,KY]=P(n.x, n.y, n.h/2);
  const lens=el("g",{transform:`translate(${KX.toFixed(1)},${KY.toFixed(1)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in
     the drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LRX.toFixed(1),ry:LRY.toFixed(1),
    fill:"var(--bg)","fill-opacity":".92"}));

  /* ---- THE MOLECULE, written in B8a's own strand units --------------------
     One unit is what B8a's builder calls a pixel, so HL, the chips and the
     gold are B8a's numbers verbatim; U turns a unit into Q, which keeps every
     one of them a fraction of the node. The strand runs from -L to HL and
     then the drop; MIDV is the middle of that, set on the lens centre. GAP is
     how far each outer piece steps off the middle one, D is half the spacing
     of the pair — the two strands follow one wave, because a duplex is one
     thing that bends — and OV is half the stagger at a cut. */
  const U=Q/25.5;
  const HL=15, L=52, TIP=HL+5.4, MIDV=(TIP-L)/2;
  const GAP=3.3, D=1.4, OV=2.0, DR=1.65;
  const CHIP=["var(--ch8)","var(--ch11)","var(--ch4)"];
  /* B8's spine, carried on: a sample every three units at sin(s·0.86)·2.1,
     s counted from B8a's first point, straight between. On -15..15 that is
     B8a's strand exactly; left of it the same wave keeps going, which is
     what the same molecule with a longer arm has to look like */
  const waveY=v=>{
    const u=(v+HL)/3, s=Math.floor(u), f=u-s;
    return Math.sin(s*0.86)*2.1*(1-f)+Math.sin((s+1)*0.86)*2.1*f;
  };
  const EX=v=>((v-MIDV)*U).toFixed(2), EY=v=>(v*U).toFixed(2),
        LW=px=>(px*SC).toFixed(2);
  const rail=(a,b,off)=>{
    const N=Math.max(2,Math.ceil(Math.abs(b-a)));
    let d="";
    for(let i=0;i<=N;i++){ const v=a+(b-a)*i/N;
      d+=(i?" L ":"M ")+EX(v)+" "+EY(waveY(v)+off); }
    return d;
  };
  const mol=el("g",{});
  lens.appendChild(mol);

  /* NOT EVEN THIRDS — a nuclease cuts where it lands, and equal pieces read
     as a ruler. Both breaks are in the long arm, clear of the first chip at
     -8.4. The stagger flips between the two cuts so the top strand is proud
     on one side of each break and short on the other. */
  const r=rng(613);
  const cuts=[-37,-21].map(v=>v+(r()-0.5)*3);
  const brk=cuts.map((c,j)=>{ const s=j?-1:1; return {c, top:c+s*OV, bot:c-s*OV}; });
  const ends=[{top:-L,bot:-L}, ...brk, {top:HL,bot:HL}];

  /* ---- THE PIECES --------------------------------------------------------
     Built whole: the three meet end to end, each strand's break against its
     neighbour's, so before the cut it is one duplex. Every cap, dot and the
     label is born at its finished place behind an opacity of zero; the ticker
     moves groups and rewrites the two top rails' ends and creates nothing. */
  const pieces=[0,1,2].map(k=>{
    const A=ends[k], B=ends[k+1];
    const grp=el("g",{transform:"translate(0,0)"});
    mol.appendChild(grp);
    /* the bottom strand never moves: it is where every end squares up to */
    grp.appendChild(el("path",{d:rail(A.bot,B.bot,D),fill:"none",stroke:DNA,
      "stroke-width":LW(1.2),"stroke-opacity":".75","stroke-linecap":"butt"}));
    const top=el("path",{d:rail(A.top,B.top,-D),fill:"none",stroke:DNA,
      "stroke-width":LW(1.2),"stroke-opacity":".75","stroke-linecap":"butt"});
    grp.appendChild(top);
    /* the barcode rides the last piece: B8a's three chips over the pair and
       its gold drop at the tip, each sat on the wave where it falls */
    if(k===2){
      CHIP.forEach((c,i)=>{ const x0=-8.4+i*6.2, y=waveY(x0+2.3);
        grp.appendChild(el("rect",{x:EX(x0),y:EY(y-1.9),width:EY(4.6),
          height:EY(3.8),rx:EY(1.1),fill:c,"fill-opacity":".9",
          stroke:"var(--stroke)","stroke-width":LW(.5),"stroke-opacity":".5"})); });
      const y0=waveY(HL), yy=v=>EY(y0+v);
      grp.appendChild(el("path",{d:`M ${EX(HL-0.6)} ${yy(0)} C ${EX(HL+1.4)} ${yy(-3.3)} `+
        `${EX(TIP)} ${yy(-2.2)} ${EX(TIP)} ${yy(0)} C ${EX(TIP)} ${yy(2.2)} `+
        `${EX(HL+1.4)} ${yy(3.3)} ${EX(HL-0.6)} ${yy(0)} Z`,fill:"var(--ch3)",
        "fill-opacity":".95",stroke:"var(--stroke)","stroke-width":LW(.5),
        "stroke-opacity":".5"}));
    }
    const caps=[], dots=[];
    /* every end but the gold one, which this station never cut */
    [[A.bot,-1],[B.bot,1]].filter(([e])=>e<HL).forEach(([e,dir])=>{
      const y=waveY(e);
      const cap=el("line",{x1:EX(e),y1:EY(y-D),x2:EX(e),y2:EY(y+D),stroke:DNA,
        "stroke-width":LW(1.3),"stroke-opacity":"0","stroke-linecap":"butt"});
      /* on the 3-prime strand: top on a right end, bottom on a left */
      const dot=el("circle",{cx:EX(e+dir*DR),cy:EY(y+(dir>0?-D:D)),
        r:(DR*U).toFixed(2),fill:ATAIL,"fill-opacity":"0"});
      grp.appendChild(cap); grp.appendChild(dot);
      caps.push(cap); dots.push(dot);
    });
    return {grp, top, caps, dots, A, B,
            /* apart along the molecule, because the break is the news; the
               small rise stops three pieces on one axis reading as a dash */
            open:(k-1)*GAP, rise:(r()-0.5)*2.5};
  });

  /* the cut marks follow the stagger — a step, not a slice — and stay where
     the cut was rather than riding off with a piece. Grey like the leaders:
     they are the drawing pointing, not part of the molecule */
  const ticks=brk.map(b=>{
    const y=waveY(b.c);
    const e=el("path",{d:`M ${EX(b.top)} ${EY(y-D-3.3)} L ${EX(b.top)} ${EY(y)}`+
      ` L ${EX(b.bot)} ${EY(y)} L ${EX(b.bot)} ${EY(y+D+3.3)}`,fill:"none",
      stroke:"var(--fg2)","stroke-width":LW(1),"stroke-opacity":"0"});
    mol.appendChild(e); return e;
  });

  /* THE ONE LABEL, inside the rim beside the far-left dot, with a hair leader
     so it names that dot rather than the glass. It used to stand just
     outside the rim, and a leader crossing the boundary read as the A-tail
     itself poking out of the lens: "make sure the strands fit inside the
     circle." The gap between that dot and the rim is room enough for a
     short leader and the letter, so everything the glass shows stays in it. */
  const p0=pieces[0], ly=waveY(p0.A.bot)+D+p0.rise;
  const lx=p0.A.bot-DR*2+p0.open;
  const tag=el("g",{opacity:"0"});
  tag.appendChild(el("line",{x1:EX(lx),y1:EY(ly),x2:(-LRX+0.34*Q).toFixed(2),
    y2:EY(ly),stroke:"var(--fg2)","stroke-width":LW(.7),"stroke-opacity":".6"}));
  const lb=el("text",{x:(-LRX+0.30*Q).toFixed(2),y:EY(ly+2.3),"text-anchor":"end",
    "font-family":MONO,"font-size":(0.26*Q).toFixed(2),fill:ATAIL});
  lb.textContent="A"; tag.appendChild(lb);
  lens.appendChild(tag);

  /* the boundary last, so nothing inside is drawn over its line */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LRX.toFixed(1),ry:LRY.toFixed(1),
    fill:"none",stroke:"var(--fg2)","stroke-width":"1.5","stroke-opacity":".85"}));

  /* ---- TIMING — the request's own: cut 2, ragged hold 2, repair 2, base 1,
     finished hold 3. WHOLE is a breath of uncut strand so the cut has
     something to happen to; BACK is the fade the loop needs. */
  const WHOLE=0.9, CUT=2.0, RAG=2.0, TRIM=2.0, DOT=1.0, HOLD=3.0, BACK=0.35;
  const t1=WHOLE, t2=t1+CUT, t3=t2+RAG, t4=t3+TRIM, t5=t4+DOT, t6=t5+HOLD,
        T=t6+BACK;
  const place=t=>{
    const part=ease(clamp((t-t1-0.4)/(CUT-0.4)));
    const f=ease(clamp((t-t3)/TRIM));
    const dt=ease(clamp((t-t4)/DOT));
    mol.setAttribute("opacity",
      (t<t6 ? clamp(t/0.3) : clamp(1-(t-t6)/BACK)).toFixed(2));
    pieces.forEach(p=>{
      p.grp.setAttribute("transform",
        `translate(${EY(p.open*part)},${EY(p.rise*part)})`);
      p.top.setAttribute("d",rail(p.A.top+(p.A.bot-p.A.top)*f,
                                  p.B.top+(p.B.bot-p.B.top)*f,-D));
      /* the rung arrives as the two strands come level, not before */
      p.caps.forEach(c=>c.setAttribute("stroke-opacity",(0.85*clamp((f-0.7)/0.3)).toFixed(2)));
      p.dots.forEach(c=>{
        c.setAttribute("r",(DR*U*(0.3+0.7*dt)).toFixed(2));
        c.setAttribute("fill-opacity",(0.95*clamp(dt/0.4)).toFixed(2));
      });
    });
    const tk=t<t1 ? 0 : clamp((t-t1)/0.3)*clamp(1-part/0.5);
    ticks.forEach(e=>e.setAttribute("stroke-opacity",(0.75*tk).toFixed(2)));
    tag.setAttribute("opacity",(clamp((t-t4-0.3)/0.5)*
      (t<t6?1:clamp(1-(t-t6)/BACK))).toFixed(2));
  };
  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion
     never advances it, so the starting frame is the whole station for that
     reader — the finished hold: three blunt pieces, five blue ends, one A. */
  let t=t5+HOLD*0.5;
  const run=dt=>{ t=(t+dt)%T; place(t); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.fragmentligate = drawFragmentLigate;

/* ------------------------------------------------------------------
   C2 · ROUND 4 — INDEXING PCR — the only look this map ever gets at the
   whole molecule, and nothing else.

   THE NAME IS THE TRAP AND THE DRAWING HAS TO DISARM IT. "Round 4" echoes
   rounds one to three, and those are drawn on this row as barcodes written
   INSIDE a cell — a plate, a lens over one well, a chain of coloured chips
   growing on a strand as the cell survives another deal. This round is none
   of that. It is bulk PCR on free DNA in a tube, ninety-five thousand cells
   after the last of them was lysed, and what it names is the SUBLIBRARY
   rather than the sample: one index per tube, not one well per cell. So the
   growing-chain motif is deliberately absent, and so is any figure that
   would put this step inside the 48 x 96 x 96 that makes a cell identity.
   What is drawn instead is the finished construct, under glass.

   THE BENCH CAME OFF IN TWO REQUESTS FROM THE PAGE. The first took the
   cycler, the third of its kind on this row after B8a's and C1's: remove the
   machine, keep the barcoding in the black inset. The second took everything
   the first had left standing — the half-filled UDI plate, the strip on its
   rack, the tile under them and the one transfer between plate and tube —
   and asked for the inset to be the focus. Nothing it lost was the only
   telling of anything: the index that well delivered is still here, as the
   two violet blocks the construct grows at its ends, and the order and the
   arithmetic of the plate are in the record for anyone counting.

   THE GLASS IS THE POINT. Every other lens on this row shows a piece of the
   molecule — the chips, a fragment, an adapter arriving. This is the first
   and only place the whole thing is visible, so it is drawn as a construct
   map and not as a strand: a horizontal labelled bar laid out in READ ORDER,
   which is what makes thirteen blocks legible as one sentence rather than as
   thirteen decorations. The three barcode chips keep
   --ch8, --ch11 and --ch4, the three this row gives the in-situ rounds
   wherever it draws a strand; the two UDI blocks wear --ch10, a violet no
   barcoding plate wears, and are the same index read from both ends —
   a fourth round in a third round's colour is the misreading this station
   exists to avoid; everything structural — P5,
   P7, the two TruSeq reads, the linkers and the polyN — is grey, because
   none of it identifies anything and colour on this row means identity.
   The complementary strand arrives only once the top one is complete: a
   duplex drawn while the top strand is still being assembled would say the
   second strand was being built alongside the first, which is not what a
   PCR does.

   IT DOES NOT ARRIVE IN READ ORDER, BECAUSE IT IS NOT BUILT HERE. What is in
   the tube when this station starts is the seven middle blocks — the insert
   and the three barcodes the in-situ rounds already put on it — so they are
   under the glass from the top of the loop, alone for as long as the
   pipetting used to take. The six that flank them arrive after, growing
   outward from the junction a pair at a time, each half from its own end of
   the field: P5-UDI-R1 on one side and R2-UDI-P7 on the other, which is the
   two indexed primers and nothing else. A bar that assembled left to right
   said this station made the whole molecule. It inherits most of it and adds
   the ends.

   THE GLASS SITS ON ITS OWN BOX. It hung high in the sky for as long as a
   bench stood under it, and stayed there after the bench went because a bar
   212 px across, centred on this tile, reaches over C1's glass on one side
   and C3's bench on the other. Asked for from "Edit visual" as "move the
   inset to the rectangular prism", it came down anyway, centred on
   P(n.x, n.y, n.h/2) as C1's and B8a's are: a glass floating a tile's
   height clear of the box the editor outlines reads as belonging to
   whatever is under it, which here is nothing. The overlap with the
   neighbours is the price, and it was asked for. The leaders went with
   the ground: they ran to a tube that is no longer drawn.

   Spends --ch4, --ch6, --ch8, --ch10 and --ch11, which are declared on
   /molecular_pipe — the only page carrying a node wearing this.
   ------------------------------------------------------------------ */
function drawIndexPcr(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w .72, d .72, h .42 — the same tile
     C1 and C3 stand on. */
  const SC=n.w/0.72;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=u=>u*u*(3-2*u);

  const CDNA ="var(--ch6)";                 // what B8 made, B9 measured, C1 cut
  const UDI  ="var(--ch10)";                // the index, at both ends
  const ADPT ="var(--fg2)", SPCR="var(--fg3)";

  /* ---- THE MAGNIFICATION --------------------------------------------------
     A thin solid ellipse: the idiom this map uses everywhere for a view drawn
     larger than life, and with the bench gone it is the whole station.

     WHAT IS INSIDE IT IS SIZED IN SCREEN PIXELS AND SCALED BY BEING SCALED. A
     molecule has no world size to be authored in, so it goes in a group
     carrying scale(n.w / .72) and every coordinate under it is written for the
     size this node happens to be authored at. A resize moves the glass, grows
     it, and takes the whole construct along.

     THE RING IS B8a's RING, AT A REQUEST FROM THE PAGE: "make this a circle
     like in B8a." It was a flat lozenge cut to the bar's length, which read
     as a different instrument from the round glasses at B8a and C1 two and
     one stations back. So the radii are B8a's own — 52 by 40 at its zoom of
     1.32 — as C1's are. The bar is wider than that ring, so it is set in
     at FIT below rather than the ring being stretched back out to meet it. */
  const LX=52*1.32, LY=40*1.32;
  const MID=P(n.x,n.y,n.h/2);
  const KX=MID[0], KY=MID[1];
  const lens=el("g",{transform:
    `translate(${KX.toFixed(1)},${KY.toFixed(1)}) scale(${SC.toFixed(4)})`});
  g.appendChild(lens);
  /* nearly opaque: glass you can read the ground grid through is a hole in the
     drawing rather than a lens over it */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,
    fill:"var(--bg)","fill-opacity":".92"}));
  /* a block slides in from off one end of the field or the other and has to stop
     existing at the ring rather than at the edge of the screen. Uniqued as the tank
     clips are: a checker draws this shape twice, at two sizes, into one page. */
  const cid=`udiglass${++UID}`;
  const cp=el("clipPath",{id:cid});
  cp.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY}));
  lens.appendChild(cp);
  const stage=el("g",{"clip-path":`url(#${cid})`});
  lens.appendChild(stage);

  /* ---- THE CONSTRUCT, LAID OUT IN READ ORDER AND BUILT IN REACTION ORDER ---
     Thirteen blocks, each a width, a colour and an ARRIVAL RANK, laid out from
     one running total so the bar is described once and every coordinate in it
     — block, label, tick, complement — is read off the same ruler. Rank 0 is
     what came in the tube; a signed rank is a piece the primers bring on, its
     magnitude counting outward from the insert and its sign saying which end.
     The rank rides on the block rather than on the clock because which pieces
     were already there is a fact about the molecule, and an index into SEG
     stated somewhere else goes stale the first time somebody edits this list. */
  const SEG=[["P5",7,ADPT,-3],        ["UDI",6.5,UDI,-2],
             ["R1",7,ADPT,-1],        ["cDNA insert",18,CDNA,0],
             ["BC1",6,"var(--ch8)",0],["linker",4,SPCR,0],
             ["BC2",6,"var(--ch11)",0],["linker",4,SPCR,0],
             ["BC3",6,"var(--ch4)",0],["polyN",6.5,SPCR,0],
             ["R2",7,ADPT,1],         ["UDI",6.5,UDI,2],
             ["P7",7,ADPT,3]];
  const SPAN=SEG.reduce((a,s)=>a+s[1],0);
  const BW=164, U=BW/SPAN, BY=-2.5, BH=10, SLIDE=14;
  /* THE LABELS ALTERNATE BETWEEN TWO ROWS. "cDNA insert" is four times the
     width of the block it names and "linker" is three times its own, so one
     row of thirteen names is a row of overlapping names. Two rows give every
     label its neighbour's width as well as its own, and each carries a tick
     down to the block so the pairing survives the stagger. */

  /* THE BEATS ARE DECLARED BEFORE THE BAR, and the first two are resolved here,
     because when a block arrives is written into the block below: the starting
     product is under the glass from the top of the loop and the ends cannot be
     placed without knowing when the pipetting finished. SCAN and TAKE are the
     plate's sweep and the transfer, kept at their lengths after both came off,
     because the request was to lose the bench and not to retime the glass. The
     rest of the clock, and the reasoning for all of it, is at TIMING. */
  const SCAN=1.9, TAKE=1.2, STEP=0.42, LAG=0.06, PAUSE=0.45,
        COMP=0.7, HOLD=2.6, CLEAR=0.7;
  const t1=SCAN, t2=t1+TAKE;

  /* THE BAR IS SET IN, NOT CUT DOWN. It is read off its own extent — the
     complement's outer corners, which reach furthest — against the ring less
     a margin, so the thirteen blocks keep their widths against each other and
     one number shrinks the lot. Inside the clip rather than around it, so the
     ring still stops a sliding block at the ring's edge and not at the bar's. */
  const EDGE=6, FIT=1/Math.hypot((BW/2)/(LX-EDGE), (BY+BH+9)/(LY-EDGE));
  const bar=el("g",{transform:`scale(${FIT.toFixed(4)})`}); stage.appendChild(bar);
  const comp=el("g",{opacity:"0"}); bar.appendChild(comp);
  const parts=[]; let run0=0, core=0;
  SEG.forEach(([name,wid,fill,arm],k)=>{
    const x0=run0*U-BW/2, ww=wid*U; run0+=wid;
    /* what came in the tube does not travel — it is already assembled, and a
       slide would say it was being delivered — so it fades up where it lies,
       just far enough apart to read as a molecule and not as a stamp. What the
       primers add comes in from its own end of the field, after the index has
       gone into the tube. */
    const sl=Math.sign(arm)*SLIDE;
    const at=arm ? t2+PAUSE+(Math.abs(arm)-1)*STEP : core++*LAG;
    const p=el("g",{transform:`translate(${sl},0)`,opacity:"0"});
    bar.appendChild(p);
    p.appendChild(el("rect",{x:x0.toFixed(2),y:BY.toFixed(1),
      width:ww.toFixed(2),height:BH,rx:"1.2",fill,"fill-opacity":".9",
      stroke:"var(--stroke)","stroke-width":".5","stroke-opacity":".55"}));
    const cx=x0+ww/2, far=k%2===1, ly=BY-(far?12:4);
    p.appendChild(el("line",{x1:cx.toFixed(2),y1:(ly+1.4).toFixed(1),
      x2:cx.toFixed(2),y2:BY.toFixed(1),stroke:"var(--fg3)",
      "stroke-width":".5","stroke-opacity":".55"}));
    const t=el("text",{x:cx.toFixed(2),y:ly.toFixed(1),"text-anchor":"middle",
      "font-size":"4.4","letter-spacing":".2",fill:"var(--fg2)",opacity:"0"});
    t.textContent=name; p.appendChild(t);
    /* the complement is the same duplex seen from the other strand, so it is
       drawn block for block under the top one rather than as a second figure:
       what it adds is that the molecule is double-stranded, and nothing else */
    comp.appendChild(el("rect",{x:x0.toFixed(2),y:(BY+BH+2.5).toFixed(1),
      width:ww.toFixed(2),height:"6.5",rx:"1",fill,"fill-opacity":".45",
      stroke:"var(--stroke)","stroke-width":".4","stroke-opacity":".3"}));
    parts.push({g:p, lab:t, sl, at});
  });

  /* the ring last, over everything, so nothing inside can soften its own edge */
  lens.appendChild(el("ellipse",{cx:"0",cy:"0",rx:LX,ry:LY,fill:"none",
    stroke:"var(--fg2)","stroke-width":"1.5","stroke-opacity":".85"}));

  /* ---- TIMING -------------------------------------------------------------
     Five beats. The starting product settles under the glass first and sits
     there alone through the time the plate and the transfer used to take —
     that wait is the claim: the insert and its three barcodes are what the
     tube held before this station touched it. Then the ends, a pair at a
     time growing outward, so the reader
     sees the index arrive and then sees what it arrived as; then the complement,
     a beat of its own so that "and it is double-stranded" lands after "and this
     is what it is" rather than with it.

     PLACEMENT IS A PURE FUNCTION OF THE CLOCK. Everything is stated from t
     alone rather than nudged from where it was, so a frame long enough to skip
     a whole beat — a tab coming back, a step in trace mode — cannot leave a
     block halfway into a bar it has already joined.

     The end of the build is read back off the blocks rather than counted out
     again here: the arrival ranks decide how many steps there are, so a block
     added to or taken out of SEG moves the complement with it. */
  const t3=parts.reduce((m,p)=>Math.max(m,p.at),0)+STEP*1.6,
        t4=t3+COMP, t5=t4+HOLD, T=t5+CLEAR;

  const place=t=>{
    const gone=clamp((t-t5)/CLEAR);
    parts.forEach(p=>{
      const u=ease(clamp((t-p.at)/(STEP*1.6)));
      p.g.setAttribute("transform",`translate(${(p.sl*(1-u)).toFixed(2)},0)`);
      p.g.setAttribute("opacity",(u*(1-gone)).toFixed(2));
      p.lab.setAttribute("opacity",clamp((u-0.55)/0.4).toFixed(2));
    });
    comp.setAttribute("opacity",(ease(clamp((t-t3)/COMP))*(1-gone)).toFixed(2));
  };

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader,
     and for this one it has to be the finished molecule: thirteen labelled
     blocks under the glass with the complement beneath them. */
  let t=t4+HOLD*0.5;
  const run=dt=>{ t=(t+dt)%T; place(t); };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.indexpcr = drawIndexPcr;

/* ------------------------------------------------------------------
   C3 · QUANTIFY AND SIZE-CHECK — B9a's bench, and one peak.

   ASKED FOR FROM "EDIT VISUAL" as "match B9a", with the 400 to 500 bp peak
   kept because it is the point of the station. So this is B9a's drawing
   called, not copied: the strip, the cassette, the eight lanes, the current
   and the graph beside the run are all B9a's, and a later edit to that bench
   lands here too. Section 3.6 is the same kind of measurement section 2.5
   made, and two stations drawn alike say so.

   WHAT DIFFERS IS WHAT IS IN THE LANES. The eight tubes are now the eight
   indexed sublibraries, and each carries one size of fragment rather than
   B9a's three — C1 cut the cDNA and section 3.7 size-selected it twice — so
   every trace is a single peak, and all eight fall in the same place.

   THE 400 TO 500 bp WINDOW IS PRINTED, NOT MEASURED. Appendix B expects a
   single peak in that band, so the band is drawn on the graph and labelled,
   and the traces are drawn landing in it. cond says no electropherogram was
   archived; the traces show where the peak should be, not what one was.

   AND A CONNECTOR TO THE NEXT STEP, asked for from "Edit visual". The lane's
   track runs ground to ground and leaves from under the cassette, not from
   the tubes that go on. So `hand` names where S's chassis meets its top on
   the near side, level with its flow cell: the lane stands S's near edge
   1.37 of this width along, its deck 2.94 of this height up, and the flow
   cell 0.42 of this depth forward. S is painted after this node, so the arc
   stops at its rim rather than crossing the deck.
   ------------------------------------------------------------------ */
function drawSizeCheck(g,n){
  drawSizeRun(g,n,{sizes:[{r:0.7,far:0.55,mu:0.52}], least:2, sd:0.036,
    window:[0.44,0.60,"400–500 bp"], seed:523, hand:[1.37,0.42,2.94]});
}
DRAW.sizecheck = drawSizeCheck;

/* ------------------------------------------------------------------
   Sa · THE READ CYCLE — the flow cell, loaded into its housing.

   REBUILT FROM "EDIT VISUAL" a fourth time. The pane before this lay bare on
   the grid and read as a surface rather than as an instrument; this puts it
   back in the charcoal box the first version stood in — white edges, a soft
   glow, a dashed footprint, like the other apparatus on the row — with the
   pane dropped into a shallow well in the lid, the way a slide sits loaded.
   Still no arm and no moving parts: whatever character it has comes from the
   housing and the lights on its front, not from anything moving over it.

   ONE CYCLE IS FOUR BEATS — scan, hold, dim, dark. A sixth request turned
   the field's single flash into a stadium of flashbulbs: each cluster goes
   off as the scan's line reaches it, a little late by a lag of its own, so
   the flashes pop in a scatter behind the line rather than as a wipe. The
   lags are drawn once and kept, so every cycle fires the same pattern.
   A later request took the line itself away and kept the flashes, so the
   sweep is now only the order they go off in — nothing is drawn crossing.

   EACH CYCLE READS ANOTHER BASE, so while the field is dark every cluster is
   recoloured, always to a base other than the one it just showed — the same
   flashes go off next time, each in a colour it did not flash last time.

   THE DIMMING IS STILL ONE GROUP'S OPACITY. The status lights used to
   share it and go out with the field; a later request asked them to keep
   flashing, so they now run a clock of their own — first a C A T G chase,
   now each at random and never stopping, through the dark between rounds
   as well. They have since moved off the wall's right half and onto the
   touchscreen on side 3, flaring as they did. Only the
   going-off is per cluster, because only the going-off was asked to be.

   A FIFTH REQUEST made it read as a flow chip: the cell is an ellipse
   rather than a pane, its grid is the lattice the clusters sit in and drawn
   to be seen, and the lights hold their colours between flashes. What the
   cell puts out is drawn by C4 — the strands leave from above this box and
   the cloud they build is that station's.
   ------------------------------------------------------------------ */
function drawReadCycle(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC, since
     a resize is the only reason this runs again. Composed at w 1.60, d 1.30,
     h .68 — the height is the housing's, and the well is a fraction of it.
     It was .46 until the front wall was asked to be bigger for its lights
     and letters; the well's fraction shrank with it, so the glass sits as
     deep as it did. */
  const SC=n.w/1.60;
  const X=f=>n.x+f*n.w, Y=f=>n.y+f*n.d;
  const r=rng(52817);
  /* FOUR PURE HUES, ONE PER BASE — blue, green, red, yellow, the trace
     colours a reader already knows (C, A, T, G). The map's own accents put
     two blues side by side here and no yellow, so the field read as three
     colours; these are the page's --nt-* and belong to this drawing alone. */
  const BASE=["var(--nt-c)","var(--nt-a)","var(--nt-t)","var(--nt-g)"], NT="CATG";
  const add=(gg,e)=>{ gg.appendChild(e); return e; };
  const f1=v=>v.toFixed(1), f2=v=>v.toFixed(2);
  const quad=(a,b,c,d)=>pts([a,b,c,d]);
  const face=(points,fill,o)=>add(g,el("polygon",{points,fill,"fill-opacity":o||1}));
  /* a white line, not the map's usual --stroke, so the edges read white
     against the charcoal the way the first version's did */
  const edge=(ps,o,wd)=>add(g,el("polyline",{points:pts(ps),fill:"none",stroke:"var(--fg)",
    "stroke-width":f2(wd*SC),"stroke-opacity":o,"stroke-linejoin":"round","stroke-linecap":"round"}));

  const h=n.h, x0=X(-0.5), x1=X(0.5), y0=Y(-0.5), y1=Y(0.5);
  /* THE CHIP IS AN ELLIPSE, asked for from the page as "a bit more
     elliptical", with a rim of about a twelfth of the node at its narrowest
     and a floor a ninth of the way down. Everything on the glass is placed in
     the unit disk and mapped out to it, so the grid, the clusters and the
     scan are clipped by arithmetic rather than by a clipPath — a clip needs
     an id, and a node that redraws on every resize would mint a new one. */
  const ex=0.42*n.w, ey=0.40*n.d, zc=h*0.89;
  const at=(u,v,z)=>P(n.x+u*ex, n.y+v*ey, z===undefined?zc:z);
  const ring=z=>{ const a=[]; for(let i=0;i<56;i++){ const t=i/56*Math.PI*2;
    a.push(at(Math.cos(t),Math.sin(t),z)); } return a; };
  const rimH=ring(h), rimC=ring(zc);

  /* ---- EVERY EDGE IS ROUNDED, asked for from the page of both boxes, the
     housing and the module behind it: the corners in plan, and each lid's
     rim by a quarter-round stepped up in MK bands, each band the plan outline
     inset and raised a step. box() returns those outlines, the floor first
     and the flat top last, and paint() fills the strip between two of them. */
  const MK=3, SIL=10;
  /* a rounded rectangle in plan, seven points a corner whatever the radius,
     so the outlines of every band line up point for point. Corners run back
     left, back right, front right, front left; index 10 is the back right
     round at forty-five degrees, where a wall turns away from the viewer. */
  const plan=(xa,xb,ya,yb,rs)=>{ const a=[];
    [[xa,ya,1,1],[xb,ya,-1,1],[xb,yb,-1,-1],[xa,yb,1,-1]].forEach(([cx,cy,sx,sy],c)=>{
      const r=rs[c]; for(let i=0;i<=6;i++){ const t=Math.PI*(1+c/2)+i/6*Math.PI/2;
        a.push([cx+sx*r+r*Math.cos(t), cy+sy*r+r*Math.sin(t)]); } });
    return a; };
  const rrect=(xa,xb,ya,yb,rs,z)=>plan(xa,xb,ya,yb,rs).map(q=>P(q[0],q[1],z));
  const box=(xa,xb,ya,yb,r,top,f)=>{ const R=[{pl:plan(xa,xb,ya,yb,[r,r,r,r]),z:0}];
    for(let j=0;j<=MK;j++){ const th=j/MK*Math.PI/2, s=f*(1-Math.cos(th)), rs=Math.max(r-s,0);
      R.push({pl:plan(xa+s,xb-s,ya+s,yb-s,[rs,rs,rs,rs]), z:top-f+f*Math.sin(th)}); }
    R.forEach(q=>{ q.p=q.pl.map(v=>P(v[0],v[1],q.z)); });
    return R; };
  const ring2d=ps=>ps.map(p=>`${f1(p[0])} ${f1(p[1])}`).join("L");
  /* THE STRIP BETWEEN TWO OUTLINES is the region one covers and not both,
     which on the screen is the band's own outline, so it goes down as one
     even-odd path with no seam through it; the band behind is hidden later
     by the bands above it and the lid. Over it, segment by segment where the
     wall faces the viewer, the front's skin comes in as the outline turns
     from the right side round the corner, and last the lid's skin at a, so
     the rim reads as turning from wall to top. */
  const paint=(A,B,a)=>{
    add(g,el("path",{d:`M${ring2d(A.p)}Z M${ring2d(B.p)}Z`,fill:SKIN.works.right,"fill-rule":"evenodd"}));
    const N=A.pl.length; let run=null;
    const flush=()=>{ if(run) face(pts([...run.a,...run.b.reverse()]),SKIN.works.left,run.t); run=null; };
    for(let i=0;i<N;i++){
      const k=(i+1)%N, dx=A.pl[k][0]-A.pl[i][0], dy=A.pl[k][1]-A.pl[i][1], L=Math.hypot(dx,dy);
      if(L<1e-9) continue;
      const nx=dy/L, ny=-dx/L, t=+Math.min(1,Math.max(0,(1+ny-nx)/2)).toFixed(2);
      if(nx+ny<=1e-6 || t<0.01){ flush(); continue; }
      if(run && run.t===t){ run.a.push(A.p[k]); run.b.push(B.p[k]); continue; }
      flush(); run={t, a:[A.p[i],A.p[k]], b:[B.p[i],B.p[k]]};
    }
    flush();
    if(a) add(g,el("path",{d:`M${ring2d(A.p)}Z M${ring2d(B.p)}Z`,fill:SKIN.works.top,
      "fill-opacity":f2(a),"fill-rule":"evenodd"}));
  };
  const rim=R=>{ for(let j=1;j<=MK;j++) paint(R[j],R[j+1],(j-0.5)/MK); };
  /* the outline of a convex box on the screen is the hull of its outlines */
  const hull=ps=>{ const a=ps.slice().sort((p,q)=>p[0]-q[0]||p[1]-q[1]), lo=[], up=[];
    const cr=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
    a.forEach(p=>{ while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); });
    a.reverse().forEach(p=>{ while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); });
    const o=lo.slice(0,-1).concat(up.slice(0,-1)); return [...o,o[0]]; };
  const every=R=>R.flatMap(q=>q.p);

  /* THE BACK MODULE stands against the face c1, c2 and c7 bound, the side
     the housing turns away from the viewer, as wide as the housing so it
     meets all three, and — asked for from the page — taller than it, by
     over half again, so it reads as the instrument's tower and the housing
     as the bench in front of it. Its front corners are rounded too, now
     that the part above the lid is free. */
  const md=n.d*0.30, mr=Math.min(n.w,n.d)*0.10, hm=h*1.6, ym0=y0-md;
  const MB=box(x0,x1,ym0,y0,mr,hm,h*0.12);
  /* the housing's corners are rounder than a hair and tighter than the
     module's, so the touchscreen and the lights on its walls keep flat
     ground under them, and its rim is rounded above the screen's top */
  const hf=h*0.12, HB=box(x0,x1,y0,y1,Math.min(n.w,n.d)*0.05,h,hf);

  /* ---- FOOTPRINT AND GLOW, both under the box ----------------------------
     The glow is the silhouette stroked wide and faint three times rather than
     a blur filter: the selection halo is already a CSS filter on this group,
     and a second one inside it is a second thing to go wrong on a phone. */
  const m=0.07;
  add(g,el("polygon",{points:quad(P(X(-0.5-m),Y(-0.5-m),0),P(X(0.5+m),Y(-0.5-m),0),
    P(X(0.5+m),Y(0.5+m),0),P(X(-0.5-m),Y(0.5+m),0)),fill:"none",stroke:"var(--fg)",
    "stroke-width":f2(SC),"stroke-opacity":".45",
    "stroke-dasharray":`${f1(4*SC)} ${f1(3*SC)}`}));
  const sil=pts(hull([...every(MB),...every(HB)]));
  [[16,".035"],[10,".05"],[5,".07"]].forEach(([wd,o])=>add(g,el("polygon",{points:sil,
    fill:"none",stroke:"var(--fg)","stroke-width":f2(wd*SC),"stroke-opacity":o,
    "stroke-linejoin":"round"})));

  /* the module, whole, before the housing that stands in front of it */
  paint(MB[0],MB[1]); rim(MB);
  face(pts(MB[MK+1].p),SKIN.works.top);
  edge([...MB[MK+1].p,MB[MK+1].p[0]],".35",0.7);
  edge(hull(every(MB)),".9",1.2);

  /* THE PAD on its top, a touchscreen raised a hair off it in the left two
     thirds, inside the rim's rounding. A rounded tablet: its near rim is the
     outline from the back-right round's turn to the front-left's, and its
     glass glows by the housing's wide faint strokes rather than a filter. */
  const pdh=h*0.04, pdr=md*0.14, px0=X(-0.42), px1=X(0.20), py0=ym0+md*0.26, py1=y0-md*0.26;
  const padB=rrect(px0,px1,py0,py1,[pdr,pdr,pdr,pdr],hm), padT=rrect(px0,px1,py0,py1,[pdr,pdr,pdr,pdr],hm+pdh);
  face(pts([...padB.slice(SIL,25),...padT.slice(SIL,25).reverse()]),SKIN.works.left);
  face(pts(padT),SKIN.works.top); face(pts(padT),"var(--bg)",.35);
  const pdi=md*0.07, pdg=pdr-pdi, padG=pts(rrect(px0+pdi,px1-pdi,py0+pdi,py1-pdi,[pdg,pdg,pdg,pdg],hm+pdh));
  [[6,".06"],[3,".1"]].forEach(([wd,o])=>add(g,el("polygon",{points:padG,fill:"none",
    stroke:SKIN.glass.top,"stroke-width":f2(wd*SC),"stroke-opacity":o,"stroke-linejoin":"round"})));
  face(padG,"var(--bg)"); face(padG,SKIN.glass.top,.7); face(padG,"var(--fg)",.1);
  edge([...padT,padT[0]],".85",0.8);

  /* ---- THE STATUS LIGHTS, on the pad's glass, asked for from the page off
     side 3's screen and onto this raised one, and to light only while the
     wells do. From the front the pad is a thin strip, far shallower than
     the wall's screen was tall, so the lights run along it with each
     letter beside its light rather than under it. Each socket holds its
     colour while the field is dark, and the letter stays as the key; the
     flare — bloom, core and a hot white centre — is one group the cycle
     fades up and down with the chip's own field, so they flash together. */
  const pz=hm+pdh, pcy=(py0+py1)/2, lc=(px0+px1)/2, lsp=(px1-px0)*0.23, lamp=el("g",{opacity:"0"});
  BASE.forEach((c,i)=>{
    const lx=lc+(i-1.62)*lsp, p=P(lx,pcy,pz), cx=f1(p[0]), cy=f1(p[1]);
    add(g,el("circle",{cx,cy,r:f2(1.5*SC),fill:c,"fill-opacity":".3",
      stroke:"var(--fg)","stroke-width":f2(0.4*SC),"stroke-opacity":".5"}));
    add(lamp,el("circle",{cx,cy,r:f2(4.0*SC),fill:c,"fill-opacity":".22"}));
    add(lamp,el("circle",{cx,cy,r:f2(2.6*SC),fill:c,"fill-opacity":".4"}));
    add(lamp,el("circle",{cx,cy,r:f2(1.45*SC),fill:c}));
    add(lamp,el("circle",{cx,cy,r:f2(0.55*SC),fill:"var(--fg)","fill-opacity":".85"}));
    const q=P(lx+lsp*0.36,pcy,pz);
    const t=add(g,el("text",{x:f1(q[0]),y:f1(q[1]+1.1*SC),"text-anchor":"middle",
      "font-size":f2(3.0*SC),"font-weight":"700",fill:c,stroke:"var(--bg)",
      "stroke-width":f2(0.6*SC),"stroke-opacity":".7","paint-order":"stroke"}));
    t.textContent=NT[i];
  });
  g.appendChild(lamp);

  /* ---- THE HOUSING'S WALLS. The rim and the lid go on after everything in
     the well, so they can simply cover the front of the floor rather than
     every piece in the well having to stop at the rim. */
  paint(HB[0],HB[1]);

  /* the well: the opening filled in the housing's skin under a wash of the
     page ground, which is its wall in shadow wherever the floor, dropped
     below it, does not cover it */
  face(pts(rimH),SKIN.works.left); face(pts(rimH),"var(--bg)",.35);

  /* ---- THE GLASS, on the well's floor, laid on the page ground so the
     wall's skin does not tint it. The one pale thing on the box, so it reads
     as the chip loaded in it. */
  face(pts(rimC),"var(--bg)");
  face(pts(rimC),SKIN.glass.top,.6);

  /* THE GRID IS THE CHIP'S LATTICE, and it was asked to be obvious: one line
     per column and row of clusters, so every cluster sits in a cell of its
     own the way a patterned flow cell's wells do. One path, clipped to the
     ellipse by solving each line's half-length in the unit disk. */
  const NU=16, NV=13, seg=(a,b)=>`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
  let gd="";
  for(let i=1;i<NU;i++){ const u=-1+2*i/NU, s=Math.sqrt(1-u*u); gd+=seg(at(u,-s),at(u,s)); }
  for(let j=1;j<NV;j++){ const v=-1+2*j/NV, s=Math.sqrt(1-v*v); gd+=seg(at(-s,v),at(s,v)); }
  add(g,el("path",{d:gd,fill:"none",stroke:"var(--fg)","stroke-width":f2(0.6*SC),"stroke-opacity":".32"}));
  add(g,el("polygon",{points:pts(rimC),fill:"none",stroke:"var(--fg)",
    "stroke-width":f2(0.8*SC),"stroke-opacity":".45"}));

  /* the reflection: two diagonal strips of faint light, which is what makes
     a flat pale shape read as glass rather than as paper. Each is the band
     between two parallel chords of the disk, so it ends on the chip's edge. */
  const strip=(s0,s1,o)=>{ const N=[0.8,0.6], T=[0.6,-0.8];
    const c=(s,g)=>{ const q=g*Math.sqrt(1-s*s); return at(s*N[0]+q*T[0],s*N[1]+q*T[1]); };
    face(pts([c(s0,1),c(s1,1),c(s1,-1),c(s0,-1)]),"var(--fg)",o); };
  strip(-0.34,-0.12,.06); strip(0.02,0.09,.045);

  /* ---- TIMING: asked from the page to be "almost a continuous cycle", so
     the scan crosses in under a second and the gap between rounds is only
     long enough to see that one has ended — a tenth of a second held, a
     fifth dimming, a beat of dark. LAG is the most any cluster trails the
     sweep, FLARE how long a bulb takes to die back to its dot. A request
     once cut both to a thin band riding the line; the next asked for the
     scatter back, so these are the values from before it. */
  const SCAN=0.9, LAG=0.2, FLARE=0.28, HOLD=0.1, DIM=0.2, DARK=0.12;
  const CYC=SCAN+LAG+HOLD+DIM+DARK;

  /* THE SWEEP'S DIRECTION, which outlived the line that used to draw it:
     the sweep is level ON THE SCREEN, which on this plane is a line of
     constant x + y, and in the unit disk that is a chord at distance d from
     the centre along (ex, ey). A cluster at (u, v) is reached when d passes
     u·NN + v·NN. */
  const L=Math.hypot(ex,ey), NN=[ex/L,ey/L];

  /* ---- THE CLUSTERS ---------------------------------------------------------
     One to a grid cell, jittered a little inside it, and only the cells that
     lie wholly inside the ellipse. Each is drawn three times at the same
     point: a dim grey dot that is always there, and in the lit group its
     coloured twin, which comes on when it fires, and a wide bloom of the same
     colour under it, which is the flashbulb and dies back as it fades. */
  const rest=el("g",{}), lit=el("g",{opacity:"0"}), bloom=el("g",{}), dot=[];
  g.appendChild(rest);
  /* a faint wash over the whole cell, so the flash is the surface lighting
     and not only its dots */
  add(lit,el("polygon",{points:pts(rimC),fill:"var(--fg)","fill-opacity":".05"}));
  lit.appendChild(bloom);
  g.appendChild(lit);
  /* the lags come off a stream of their own, so the clusters' places and
     first colours are the ones they always had */
  const rl=rng(7193);
  for(let a=0;a<NU;a++)for(let b=0;b<NV;b++){
    const u=-1+2*(a+0.5+(r()-0.5)*0.3)/NU, v=-1+2*(b+0.5+(r()-0.5)*0.3)/NV, k=Math.floor(r()*4);
    if(u*u+v*v>0.86) continue;
    const p=at(u,v), cx=f1(p[0]), cy=f1(p[1]);
    add(rest,el("circle",{cx,cy,r:f2(0.85*SC),fill:"var(--fg)","fill-opacity":".18"}));
    const flare=add(bloom,el("circle",{cx,cy,r:f2(3.6*SC),fill:BASE[k],"fill-opacity":".55",opacity:"0"}));
    /* a hair of the page ground round each lit dot, so yellow still has an
       edge on the pale glass of the light theme */
    const node=add(lit,el("circle",{cx,cy,r:f2(1.45*SC),fill:BASE[k],opacity:"0",
      stroke:"var(--bg)","stroke-width":f2(0.35*SC),"stroke-opacity":".6"}));
    dot.push({k, node, flare, on:"0", fl:"0",
      due:SCAN*(u*NN[0]+v*NN[1]+1)/2 + LAG*rl()});
  }

  /* ---- THE RIM AND THE LID, the lid one path with the ellipse cut out of
     it by even-odd, laid over the well so they hide the front of the
     dropped floor */
  rim(HB);
  add(g,el("path",{d:`M${ring2d(HB[MK+1].p)}Z M${ring2d(rimH)}Z`,
    fill:SKIN.works.top,"fill-rule":"evenodd"}));

  /* ---- THE TOUCHSCREEN, on side 3, asked for from the page: a third of the
     wall's width in its left half. Its lights moved up to the pad. Recessed by
     showing the pocket's shadow along its top and left, the two reveals a
     viewer looking down from the front-left can see into; the glass is
     inset from them and glows by the housing's own trick of faint wide
     strokes, not a filter. */
  const sx0=X(-0.44), sx1=X(-0.11), sz0=h*0.24, sz1=h*0.80;
  const rv=n.w*0.012, rz=h*0.035;
  face(quad(P(sx0,y1,sz1),P(sx1,y1,sz1),P(sx1,y1,sz0),P(sx0,y1,sz0)),"var(--bg)",.55);
  const scr=quad(P(sx0+rv,y1,sz1-rz),P(sx1,y1,sz1-rz),P(sx1,y1,sz0),P(sx0+rv,y1,sz0));
  [[7,".05"],[3.5,".08"]].forEach(([wd,o])=>add(g,el("polygon",{points:scr,fill:"none",
    stroke:SKIN.glass.top,"stroke-width":f2(wd*SC),"stroke-opacity":o,"stroke-linejoin":"round"})));
  face(scr,"var(--bg)"); face(scr,SKIN.glass.top,.6); face(scr,"var(--fg)",.07);
  edge([P(sx0,y1,sz1),P(sx1,y1,sz1),P(sx1,y1,sz0),P(sx0,y1,sz0),P(sx0,y1,sz1)],".5",0.7);

  /* ---- THE CARTRIDGE SLOT, on side 4, in the wall's back half so the door
     keeps the front: a seam level in the world, with the recess under it
     drawn as a darker strip and a faint lower lip. Nothing is shown in it. */
  const ky0=Y(-0.44), ky1=Y(-0.06), kz=h*0.56, kd=h*0.07;
  face(quad(P(x1,ky0,kz),P(x1,ky1,kz),P(x1,ky1,kz-kd),P(x1,ky0,kz-kd)),"var(--bg)",.45);
  edge([P(x1,ky0,kz-kd),P(x1,ky1,kz-kd)],".3",0.6);
  edge([P(x1,ky0,kz),P(x1,ky1,kz)],".85",0.9);

  /* ---- THE EDGES, over everything they bound. A rounded edge has no line
     of its own, so what is drawn is the outline and, fainter, where the
     flat lid meets the rim; the well's rim is fainter than the box's. */
  edge(hull(every(HB)),".9",1.2);
  edge([...HB[MK+1].p,HB[MK+1].p[0]],".35",0.7);
  edge([...rimH,rimH[0]],".75",1);

  /* ---- THE SLIDING COVER, asked for from the page: a translucent pane that
     runs out across the lid from its left edge, c4-c1, until it reaches the
     right, c3-c2, so the chip and its flashes are seen through it. It rests
     closed, draws back and runs out again, on a clock of its own. It lies on
     the lid's flat, inside the rim's rounding, with its own corners rounded
     like everything else on the box. Born closed, so a reader with motion
     off sees the station covered; only xl, its leading edge, ever moves. */
  /* ASKED NEXT TO READ MORE PLAINLY AS A LID: a lip stands up along the
     leading edge, the part a hand would push, and the pane is ribbed across
     like a tambour's slats, so a closed cover reads as closed rather than as
     a tint over the chip. The ribs are counted back from the lip, so they
     travel with the edge instead of being uncovered by it. */
  const cth=h*0.05, czt=h+cth, lw=n.w*0.035, lzt=czt+h*0.05;
  const cx0=x0+hf, cx1=x1-hf, cy0=y0+hf, cy1=y1-hf, crr=Math.min(n.w,n.d)*0.03;
  const pitch=(cx1-cx0)/13;
  const cTop=add(g,el("polygon",{points:"",fill:SKIN.glass.top,"fill-opacity":".28"}));
  const cSheen=add(g,el("polygon",{points:"",fill:"var(--fg)","fill-opacity":".05"}));
  const cRib=add(g,el("path",{d:"",fill:"none",stroke:"var(--fg)","stroke-width":f2(0.7*SC),
    "stroke-opacity":".22","stroke-linecap":"round"}));
  const cSide=add(g,el("polygon",{points:"",fill:SKIN.glass.top,"fill-opacity":".4"}));
  const cRim=add(g,el("path",{d:"",fill:"none",stroke:"var(--fg)","stroke-width":f2(0.8*SC),
    "stroke-opacity":".6","stroke-linejoin":"round"}));
  const lSide=add(g,el("polygon",{points:"",fill:SKIN.works.left}));
  const lTop=add(g,el("polygon",{points:"",fill:SKIN.works.top}));
  const lRim=add(g,el("path",{d:"",fill:"none",stroke:"var(--fg)","stroke-width":f2(0.8*SC),
    "stroke-opacity":".85","stroke-linejoin":"round"}));
  let coverX="";
  const setCover=xl=>{
    const k=f1(xl*S); if(k===coverX) return; coverX=k;
    const rc=Math.min(crr,(xl-cx0)/2), R=[rc,rc,rc,rc];
    const lo=rrect(cx0,xl,cy0,cy1,R,h), hi=rrect(cx0,xl,cy0,cy1,R,czt), top=pts(hi);
    cTop.setAttribute("points",top); cSheen.setAttribute("points",top);
    cSide.setAttribute("points",pts([...lo.slice(SIL,25),...hi.slice(SIL,25).reverse()]));
    cRim.setAttribute("d",`M${ring2d(hi)}Z M${ring2d(lo.slice(SIL,25))}`);
    let rd="";
    for(let x=xl-lw-pitch; x>cx0+pitch*0.3; x-=pitch)
      rd+=seg(P(x,cy0+crr,czt),P(x,cy1-crr,czt));
    cRib.setAttribute("d",rd);
    /* the lip is square where it meets the pane and rounded where the pane
       is, so its ends follow the cover's own corners */
    const lx=Math.max(cx0,xl-lw), lr=Math.min(rc,(xl-lx)/2), LR=[0,lr,lr,0];
    const llo=rrect(lx,xl,cy0,cy1,LR,h), lhi=rrect(lx,xl,cy0,cy1,LR,lzt);
    lSide.setAttribute("points",pts([...llo.slice(SIL,25),...lhi.slice(SIL,25).reverse()]));
    lTop.setAttribute("points",pts(lhi));
    lRim.setAttribute("d",`M${ring2d(lhi)}Z M${ring2d(llo.slice(SIL,25))}`);
  };
  setCover(cx1);
  /* slide out, rest closed, slide back, rest open — the clock starts at the
     rest, so the first thing a reader sees is the pane already across. The
     closed rest is NR rounds of the read and a settle of SET either side.
     It was five rounds, asked for as "close, flash five times, open"; it was
     then asked to last as long as the cloud takes to grow, so NR is however
     many whole rounds fill GROW, and the cloud below fills over exactly
     those rounds — empty as the lid closes, full as it opens. */
  const GROW=18, SET=0.15, NR=Math.round((GROW-2*SET)/CYC), CSL=2.2, CHC=2*SET+NR*CYC, CHO=1.6, CCY=2*CSL+CHC+CHO;
  let cc=CSL;

  /* ---- THE DOOR, on the right wall, asked for so the reads have somewhere
     to come out of. It stands on the ground in the wall's front half, the
     half turned away from C4, so nothing of C4's box is painted over it.
     A doorway rather than a door: the opening in shadow with a haze of the
     reads' grey in it, and its back jamb — the one reveal the viewer can see
     into — cut off where the lintel hides it. The strands themselves are
     C4's, drawn from this opening; see A in drawDemux. */
  const ya=Y(0.04), yb=Y(0.30), hd=h*0.78, dep=n.w*0.06;
  const door=quad(P(x1,ya,0),P(x1,yb,0),P(x1,yb,hd),P(x1,ya,hd));
  face(door,"var(--bg)",.9); face(door,"var(--fg2)",.12);
  face(quad(P(x1,ya,0),P(x1-dep,ya,0),P(x1,ya+dep,hd),P(x1,ya,hd)),SKIN.works.left);
  edge([P(x1,ya,0),P(x1,ya,hd),P(x1,yb,hd),P(x1,yb,0)],".9",1.1);

  /* ---- THE READS LEAVING, asked for from the page: grey strands out of the
     door in a single line, gathering into a rotating cloud, with the
     distance labelled. The line is this station's rather than C4's, so the
     door feeds one line and not two.

     IT LEAVES STRAIGHT OUT, square to the wall and level, and the cloud is a
     sphere — both asked for in place of a line running down the screen into
     a flat disc. Two units was asked for first, then five, then ten; LEN
     is ten at the authored width and a fraction of it at any other, so a
     resize carries the cloud with it, and the label prints what LEN
     actually is. The sphere is centred on the line, at every size. */
  const LEN=n.w*10/1.60, dir=[1,0], za=h*0.66, ym=Y(0.17);
  const RS=n.w*0.28, xc=x1+dir[0]*LEN;
  const A=P(x1,ym,za), C=P(xc,ym,za);
  /* the line stops a little inside the sphere's near side, so the strands
     are seen to arrive rather than to vanish under the haze; as the sphere
     grows, grow() below pulls the end back to follow its surface */
  const E=P(xc-RS*0.8,ym,za);
  const line=`M${f1(A[0])} ${f1(A[1])}L${f1(E[0])} ${f1(E[1])}`;
  const wire=add(g,el("path",{d:line,fill:"none",stroke:"var(--fg2)","stroke-width":f2(0.8*SC),"stroke-opacity":".25"}));
  /* one dashed path whose offset moves, as C4's stream was: a train of
     strands for one attribute a frame, each dash a read's own bar */
  const BW=9.0, BH=2.4, SPc=5.0, VEL=56;
  const flow=add(g,el("path",{d:line,fill:"none",stroke:"var(--fg2)","stroke-width":f2(BH*SC),
    "stroke-opacity":".75","stroke-dasharray":`${f2(BW*SC)} ${f2(SPc*SC)}`,"stroke-dashoffset":"0"}));

  /* THE DISTANCE, on the ground: from the door's threshold out to the point
     under the cloud, set off toward the front so it is not hidden under the
     stream, with a tick at each end the way a drawing office dimensions a
     run. */
  const off=n.w*0.19, pr=[0,1];
  const g0=[x1+pr[0]*off, ym+pr[1]*off], g1=[g0[0]+dir[0]*LEN, g0[1]+dir[1]*LEN];
  const tk=n.w*0.05, at0=(p,s)=>P(p[0]+pr[0]*tk*s, p[1]+pr[1]*tk*s, 0);
  add(g,el("path",{d:`M${f1(P(x1,ym,0)[0])} ${f1(P(x1,ym,0)[1])}L${f1(at0(g0,1)[0])} ${f1(at0(g0,1)[1])}`+
    `M${f1(P(g0[0],g0[1],0)[0])} ${f1(P(g0[0],g0[1],0)[1])}L${f1(P(g1[0],g1[1],0)[0])} ${f1(P(g1[0],g1[1],0)[1])}`+
    `M${f1(at0(g0,-1)[0])} ${f1(at0(g0,-1)[1])}L${f1(at0(g0,1)[0])} ${f1(at0(g0,1)[1])}`+
    `M${f1(at0(g1,-1)[0])} ${f1(at0(g1,-1)[1])}L${f1(at0(g1,1)[0])} ${f1(at0(g1,1)[1])}`,
    fill:"none",stroke:"var(--fg2)","stroke-width":f2(0.7*SC),"stroke-opacity":".7"}));
  const lp=P(g0[0]+dir[0]*LEN*0.30+pr[0]*off*0.9, g0[1]+dir[1]*LEN*0.30+pr[1]*off*0.9, 0);
  const dim=add(g,el("text",{x:f1(lp[0]),y:f1(lp[1]),"font-size":f2(4.6*SC),"font-weight":"700",
    fill:"var(--fg2)",stroke:"var(--bg)","stroke-width":f2(1.1*SC),"stroke-opacity":".85",
    "paint-order":"stroke","stroke-linejoin":"round"}));
  dim.textContent=`${+LEN.toFixed(1)} units from the door`;

  /* ---- THE CLOUD, a sphere in world units, so the projection shapes it
     the way it shapes the boxes. The haze is three faint discs of the
     sphere's own outline — which under this projection is an ellipse, its
     axes read straight off P's two rows — nested so no edge reads as drawn.
     In it the reads sit through the ball, packed toward its shell, and the
     ball turns about the vertical; each read is a short bar laid along its
     orbit, and the near side is drawn a little heavier and brighter than
     the far, which is what makes a ring of bars read as a solid turning
     rather than a flat one swinging. */
  const HX=RS*S*C30*Math.SQRT2, HY=RS*S*Math.sqrt(0.5+CZ*CZ);
  const haze=[[1.12,".06"],[0.85,".08"],[0.5,".11"]].map(([a,o])=>({a,
    e:add(g,el("ellipse",{cx:f1(C[0]),cy:f1(C[1]),rx:f1(HX*a),ry:f1(HY*a),
      fill:"var(--fg2)","fill-opacity":o}))}));
  /* asked to be denser with reads: 240 bars were spread through a ball ten
     times RS across, and this one stops at five, so the same volume holds
     far more of them. Asked again, so 420 became 960: the bars join in
     draw order, so the full ball is simply denser at every stage of its
     growth, and the seed is unchanged so the first 420 sit where they did */
  const rn=rng(90417), neb=[], BL=n.w*0.045, NB=960;
  for(let i=0;i<NB;i++){
    const rad=RS*Math.pow(0.15+0.85*rn(),0.4), cz=2*rn()-1, th=rn()*Math.PI*2;
    const bar=add(g,el("line",{x1:f1(C[0]),y1:f1(C[1]),x2:f1(C[0]+1),y2:f1(C[1]),
      stroke:"var(--fg2)","stroke-width":f2(BH*SC),"stroke-linecap":"round","stroke-opacity":"0"}));
    neb.push({bar, rad, cz, th, o:""});
  }

  /* THE CLOUD GROWS, asked for so the picture shows the run's reads
     piling up. It fills over the rounds of one closed rest, holds full
     while the cover is open, and the next closed rest starts it empty — a
     run to a lid, which is why the rest is as long as GROW. The ball's volume follows the count, so its radius
     goes as the cube root, and bars join it one by one in the order they
     were drawn; the counter over it prints the count the fill stands for.
     A figure, not a readout: the rate is the picture's, not an instrument's.

     IT GROWS TO FIVE TIMES, asked for from the page after ten proved too
     much: GR is the full ball's radius over RS, and it starts as small as
     it always did. Its centre stays on the stream's line, asked for in
     place of a centre that rose to keep the ball off the ground, so the
     strands run into its middle and its lower part passes below the floor
     the way the projection draws anything there.

     IT COUNTS TO 3,655,719,111, asked for from the page in place of a round
     three billion, and prints every digit so the held figure is that exact
     number, not a rounded "3.66 billion". Grouped by hand rather than by
     toLocaleString, so the separator is a comma in every browser locale. */
  const READS=3655719111, GR=5;
  const tally=add(g,el("text",{x:f1(C[0]),y:f1(C[1]),"text-anchor":"middle",
    "font-size":f2(4.6*SC),"font-weight":"700",fill:"var(--fg2)",stroke:"var(--bg)",
    "stroke-width":f2(1.1*SC),"stroke-opacity":".85","paint-order":"stroke","stroke-linejoin":"round"}));
  let gr=1, shown=NB, tallyS="";
  const grow=acc=>{
    gr=GR*Math.cbrt(Math.max(acc,0.004/(GR*GR*GR))); shown=Math.ceil(acc*NB);
    const R=RS*gr;
    haze.forEach(H=>{ H.e.setAttribute("rx",f1(HX*H.a*gr)); H.e.setAttribute("ry",f1(HY*H.a*gr)); });
    const Ep=P(xc-R*0.8,ym,za), d=`M${f1(A[0])} ${f1(A[1])}L${f1(Ep[0])} ${f1(Ep[1])}`;
    wire.setAttribute("d",d); flow.setAttribute("d",d);
    const cnt=P(xc,ym,za+R);
    tally.setAttribute("x",f1(cnt[0])); tally.setAttribute("y",f1(cnt[1]-3*SC));
    const nr=acc*READS;
    const s=`${String(Math.round(nr)).replace(/\B(?=(\d{3})+(?!\d))/g,",")} reads`;
    if(s!==tallyS){ tallyS=s; tally.textContent=s; }
  };
  const SPIN=Math.PI*2/12;
  const turn=ph=>neb.forEach((R,i)=>{
    if(i>=shown){ if(R.o!=="0"){ R.o="0"; R.bar.setAttribute("stroke-opacity","0"); } return; }
    const rr=R.rad*gr, a=R.th+ph, c=Math.cos(a), s=Math.sin(a), q=rr*Math.sqrt(1-R.cz*R.cz);
    const x=xc+c*q, y=ym+s*q, z=za+rr*R.cz;
    const p0=P(x+s*BL,y-c*BL,z), p1=P(x-s*BL,y+c*BL,z);
    /* the viewer looks down the x + y diagonal, so that is nearness */
    const dep=((c+s)*Math.SQRT1_2*q/(RS*gr)+1)/2;
    R.bar.setAttribute("x1",f1(p0[0])); R.bar.setAttribute("y1",f1(p0[1]));
    R.bar.setAttribute("x2",f1(p1[0])); R.bar.setAttribute("y2",f1(p1[1]));
    const o=(0.25+0.55*dep).toFixed(2);
    if(o!==R.o){ R.o=o; R.bar.setAttribute("stroke-opacity",o);
      R.bar.setAttribute("stroke-width",f2(BH*SC*(0.7+0.5*dep))); }
  });

  /* ---- SURFACE TAGS, asked for from the page so a later request can name a
     face by number rather than by describing it. Each sits on the face it
     names, drawn last so no part of the box covers it, and haloed in the page
     ground so it stays legible over the dots. The underside cannot be seen,
     so BOTTOM is tagged on the footprint the box stands in; the well's wall
     is only a sliver, so its tag sits on the glass with a leader up to it. */
  const tag=(p,txt,anchor)=>{ const t=add(g,el("text",{x:f1(p[0]),y:f1(p[1]+1.2*SC),
    "text-anchor":anchor||"middle","font-size":f2(3.4*SC),"font-weight":"700",
    fill:"var(--fg)",stroke:"var(--bg)","stroke-width":f2(1.1*SC),"stroke-opacity":".85",
    "paint-order":"stroke","stroke-linejoin":"round"})); t.textContent=txt; };
  tag(P(X(-0.40),Y(-0.40),h),"1 TOP");
  tag(P(X(0.5+m),Y(0.5+m),0).map((v,i)=>v+(i?4.5*SC:0)),"2 BOTTOM");
  tag(P(X(0.25),y1,h*0.5),"3 LEFT");        // in the half the lights left, clear of the screen
  tag(P(x1,Y(-0.36),h*0.25),"4 RIGHT");     // low and back, clear of the door and its strands
  const wa=at(-0.62,-0.78,(h+zc)/2), wt=at(-0.40,-0.42);
  add(g,el("line",{x1:f1(wa[0]),y1:f1(wa[1]),x2:f1(wt[0]),y2:f1(wt[1]-2.2*SC),
    stroke:"var(--fg)","stroke-width":f2(0.6*SC),"stroke-opacity":".8"}));
  tag(wt,"5 WELL WALL");
  tag(at(0.15,0.35),"6 GLASS");

  /* ---- CORNER TAGS, asked for from the page for the same reason: so a
     request can name a corner of the housing rather than describe it. The
     seven the viewer can see, round the lid from the back and then along the
     ground; the eighth, back and low, is behind the box and left unnamed.
     Lower-case c, so a corner never reads as a face's number or a base's
     letter. Each is a dot on the corner and its tag pushed off it in screen
     pixels, outward where the corner is on the outline; the front top one is
     inside the outline, so its tag sits on the lid. The front bottom one goes
     left, since BOTTOM's tag is under it. */
  [[x0,y0,h, 0,-4.2,"middle"],[x1,y0,h, 3.2,0.4,"start"],[x1,y1,h, 0,-4.0,"middle"],
   [x0,y1,h,-3.2,0,"end"],[x0,y1,0,-3.2,0.8,"end"],[x1,y1,0,-2.4,2.6,"end"],
   [x1,y0,0, 3.2,0.8,"start"]].forEach(([x,y,z,dx,dy,an],i)=>{
    const p=P(x,y,z);
    add(g,el("circle",{cx:f1(p[0]),cy:f1(p[1]),r:f2(1.0*SC),fill:"var(--fg)",
      stroke:"var(--bg)","stroke-width":f2(0.6*SC),"stroke-opacity":".85"}));
    tag([p[0]+dx*SC,p[1]+dy*SC],`c${i+1}`,an);
  });

  /* ---- THE CYCLE. The field comes up over the scan's first moment and
     goes down together after the hold; inside it, each cluster is written
     only when it changes — on when it fires, and its bloom while it dies
     back — so a frame touches the handful going off, not all of them. The
     scan is linear because a camera's pass is. */
  const ease=u=>u<0.5?2*u*u:1-2*(1-u)*(1-u);
  /* THE READ WAITS FOR THE LID, asked for from the page: the NR rounds run
     back to back on a cover that has closed and settled for SET, so nothing
     on the chip or the pad lights while the pane is moving or open. They
     are counted off the cover's own clock rather than started frame by
     frame, so a slow frame cannot cost the last round its place. Outside
     them the field is dark with t parked at CYC. */
  let t=CYC, round=-1, litO="0", fo=0, ph=0, fq=0, fqS="";
  /* THE READS LEAVE ONLY WHILE THEY ARE BEING READ, asked for from the page:
     the strands start once the cover has closed and the wells are lighting,
     run through the dark between rounds, and stop when the last round ends,
     so the cover never moves over a stream. The cloud grows only while they
     feed it; it keeps turning in between, since the file is still there. */
  grow(0); turn(0); flow.setAttribute("stroke-opacity","0");
  const run=dt=>{
    const dq=Math.min(dt,0.1);
    cc=(cc+dq)%CCY;
    const cu=cc<CSL ? ease(cc/CSL) : cc<CSL+CHC ? 1 : cc<2*CSL+CHC ? 1-ease((cc-CSL-CHC)/CSL) : 0;
    setCover(cx0+(cx1-cx0)*cu);
    const tc=cc-CSL-SET, rd=tc>=0&&tc<NR*CYC ? Math.min(NR-1,Math.floor(tc/CYC)) : -1;
    fq=Math.max(0,Math.min(1,fq+(rd>=0?dq:-dq)/0.25));
    const qs=(0.75*fq).toFixed(2);
    if(qs!==fqS){ fqS=qs; flow.setAttribute("stroke-opacity",qs); }
    if(rd>=0){
      fo=(fo+VEL*dq)%(BW+SPc); flow.setAttribute("stroke-dashoffset",f2(-fo*SC));
      grow(Math.min(1,tc/(NR*CYC)));
    }
    ph=(ph+SPIN*dq)%(Math.PI*2); turn(ph);
    /* each round reads another base, so the clusters change colour in the
       dark as one round gives way to the next or to the open cover */
    if(rd!==round){
      if(round>=0) dot.forEach(d=>{ d.k=(d.k+1+Math.floor(r()*3))%4;
        d.node.setAttribute("fill",BASE[d.k]); d.flare.setAttribute("fill",BASE[d.k]); });
      round=rd;
    }
    t=rd<0 ? CYC : tc-rd*CYC;
    const e=SCAN+LAG+HOLD;
    const o = t<e ? Math.min(1,t/0.1) : t<e+DIM ? 1-ease((t-e)/DIM) : 0;
    const os=o.toFixed(2);
    if(os!==litO){ litO=os; lit.setAttribute("opacity",os); lamp.setAttribute("opacity",os); }
    dot.forEach(d=>{
      const a=t-d.due, on=a<0?"0":"1";
      const fl=a<0||a>=FLARE ? "0" : ((1-a/FLARE)*(1-a/FLARE)).toFixed(2);
      if(on!==d.on){ d.on=on; d.node.setAttribute("opacity",on); }
      if(fl!==d.fl){ d.fl=fl; d.flare.setAttribute("opacity",fl); }
    });
  };
  /* THE FIRST FRAME IS MID-SCAN. A reader with motion off never advances the
     clock, so this is the whole station for them: the cover closed, the
     sweep partway across, the clusters above it lit and the ones it has just
     reached still going off. It is the LAST round of the rest, so the cloud
     beside it is nearly full; the cover's clock is set straight there rather
     than run there, since every step turns all NB bars. */
  cc+=SET+(NR-1)*CYC;
  for(let i=0;i<30;i++) run(SCAN*0.55/30);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.readcycle = drawReadCycle;

/* ------------------------------------------------------------------
   C4 · BASECALL AND DEMULTIPLEX — signal off the instrument, resolving into
   a cloud of reads.

   ASKED FOR FROM THE PAGE, from the map's own "Edit visual" button, and what
   it asked for is the END OF THE ROW rather than the mechanics of the step.
   Everything to the left of here is material somebody could pipette; from
   here on it is a file. So this is the last object on the row that is drawn
   as a thing happening, and what it has to leave the reader with is the
   output — a cloud of reads, and nothing you can do with a pipette.

   THE SEQUENCER IS NOT REDRAWN. It stands one gap back at 2.2 across and it
   is already the biggest object on the row; a second one here would be the
   same instrument twice. What crosses into this frame is a connector out of
   its right face, and the line starts a hair clear of that face rather than
   inside it — this node is drawn after the machine, so anything overlapping
   it is painted on top of it and reads as part of it.

   THE STREAM IS CONTINUOUS AND THE CLOUD IS A SPHERE. A request from Sa's
   own "Edit visual" asked for exactly this: the output running down the path
   as an unbroken line of grey strands, piling up some way off into a
   rotating cloud that keeps on building. So the connector is now the stream
   itself — dashes moving along it, one arriving every quarter second — and it
   starts at the door in Sa's right wall, which is where A has been since a
   request asked for the strands to come out of one. Where it ends, E, is still the only place
   a read ever appears: each one leaves E as a strand arrives, already
   moving, and eases out to its place in the sphere while the sphere turns
   under it. Innermost places fill first, so the cloud is seen to thicken
   from the core outward. The source says only that the reads came out of
   the machine's line — every read leaves the same point, so the stream
   still says nothing about which read is which.

   THE READS ARE ANONYMOUS, AND THAT IS THE CLAIM. This station used to draw
   the run folder splitting into eight coloured files, which put the
   sublibraries apart in the picture at the moment a FASTQ carries nothing
   that tells them apart: a read here is sequence and quality scores, and what
   is in it is read out rows away from here. So every fragment is the same
   neutral grey at the same opacity, the same size, with no detail on it and
   no light behind it — not even the machine's --signal, which an earlier cut
   flashed each read in and which spent colour the step does not earn. The
   eight are still what the record says came out; the drawing stops short of
   the point where a picture would have to say which read went into which.

   THE LABEL STAYS "FASTQ". A request once raised that the instrument's direct
   output is base calls, not FASTQ, and that is right of the instrument — but
   this station is the conversion AND the split, so what leaves it is exactly
   the FASTQ the name says. Relabel it only if the station stops including
   the demultiplex.

   IT ENDS ON THE CLOUD. The build runs for nearly the whole loop — the
   stream never stops — then a beat of the full sphere, and nothing leaves
   the frame: no files written, no handoff, no next object. The short fade
   at the end is the loop's seam and not an event — the reads do not go
   anywhere, the figure simply starts again.

   THE CLOUD SITS IN THE MAP'S CORRIDOR, and that is not a taste decision
   either. The free sky here is a band about a hundred and thirty pixels
   wide, running up and to the right at −30° between the sequencer's name
   and this station's own. The ellipse this replaced lay along it because a
   round cloud as long as that ellipse lands on one name or the other; the
   sphere is instead sized to the band's width, ninety-odd pixels across,
   and turns rather than spreads — the spin and the shading from back to
   front are what make it read as a volume at that size. Every offset that
   keeps it there is a screen length times SC, so the clearances survive a
   resize.

   The shape key is still `demux` — it is the node's, and this node wears it
   alone. Spends no hue: --fg2 for a read and for everything else.
   ------------------------------------------------------------------ */
function drawDemux(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w .95, d .95, h .40 — C5's and C6's
     tile, so the three stations at the end of this row keep one size. */
  const SC=n.w/0.95;
  const clamp=x=>x<0?0:x>1?1:x;
  const NREAD=80;
  const r=rng(48211);
  const f1=v=>v.toFixed(1);

  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  /* ---- WHERE THE CLOUD HANGS ---------------------------------------------
     In the corridor between the two names — see the note above — measured from
     this tile's own top so it rides the box at any size. RS is the sphere's
     radius in unscaled pixels. */
  const TOP=P(n.x,n.y,n.h);
  const CU=[C30,-0.5];                       // along the corridor
  const CDX=34, CUP=91, RS=46;
  const C=[TOP[0]+CDX*SC, TOP[1]-CUP*SC];

  /* ---- THE STREAM ---------------------------------------------------------
     Held well above the ground: the lane's own track already draws the run
     from station to station, and a second line beside it on the floor would
     say the reads came by two routes. A is 1.80 tiles back and up, over Sa's
     lid; E is on the sphere's near side, 0.55 of the way from its centre back
     toward A, where the packing the radius power gives it starts to tell.

     ONE PATH, DASHED, AND THE DASH OFFSET IS WHAT MOVES — a continuous train
     of strands for one attribute a frame, and never a strand created or
     destroyed. The dash is a read's own bar, BW by BH, so a strand in flight
     and a read in the cloud are visibly the same thing. The path bows a
     little either side of the straight line so it reads as flow rather than
     as a dashed rule, and a faint undashed rail under it keeps the route on
     screen between strands. The dot at E makes the end a mouth rather than a
     line that ran out. */
  /* A IS SA'S DOOR. A later request cut a doorway in Sa's right wall for
     the strands to come out of, so the stream now leaves from its threshold
     rather than from the air over Sa's lid: Sa's right wall stands 1.02 of
     this tile back, the door's middle 0.23 of it forward, and the strand
     leaves a little under half way up the opening. Like the lid it replaced,
     it is placed off this tile at the row's authored layout — a shape draws
     only its own node — so a resize of Sa alone moves the door off it. */
  /* THE STREAM HAS MOVED TO SA. A request from Sa's "Edit visual" asked
     for the door to put out a single straight line of strands, five grid
     units long, into a nebula of its own, and one door feeding two lines
     would say the reads went two ways. So Sa draws that line now, and this
     drops its own: the reads still leave E one per GAP, the beat the
     stream used to set. */
  const E=[C[0]-CU[0]*RS*0.55*SC, C[1]-CU[1]*RS*0.55*SC];
  const BW=9.0, BH=2.4, GAP=0.25;

  /* one group for everything in the air, so the end of the cycle is a single
     opacity rather than eighty of them */
  const sky=el("g",{}); g.appendChild(sky);

  /* ---- THE NEBULA, asked for with the door: the reads gather into "a
     nebula of fastq files", so behind the sphere hangs a haze of the same
     grey — three faint ellipses, off-centre and turned against each other so
     no edge reads as drawn. It thickens as the cloud builds and goes with
     it at the seam. No larger than the sphere's own width, so the corridor
     between the two names still holds it. */
  const haze=el("g",{opacity:"0"}); sky.appendChild(haze);
  [[-6,3,1.15,0.80,-20,".07"],[5,-4,0.95,0.70,25,".09"],[0,1,0.60,0.50,-5,".12"]]
    .forEach(([ox,oy,a,b,rot,o])=>{
      const cx=f1(C[0]+ox*SC), cy=f1(C[1]+oy*SC);
      haze.appendChild(el("ellipse",{cx,cy,rx:(RS*a*SC).toFixed(1),ry:(RS*b*SC).toFixed(1),
        transform:`rotate(${rot} ${cx} ${cy})`,fill:"var(--fg2)","fill-opacity":o}));
    });

  /* ---- THE READS ----------------------------------------------------------
     Each has a home in a unit ball, y its spin axis, with the radius filled
     at a power under a half so the middle packs harder than the rim: a cloud
     uniform to its own edge reads as a shape somebody cut, and this one is
     meant to read as weather. Born on the centre with real coordinates, so
     the ticker only ever moves something that already knows where it is. The
     bar is authored in screen pixels — a read at this size is a glyph and
     cannot be cut from a world width — and it grows by being scaled: every
     group carries scale(SC) times its depth, SC being n.w over the width it
     was drawn for. Square-cornered, because a rounded bar reads as a pill. */
  const at=(x,y,a,s)=>`translate(${x.toFixed(1)},${y.toFixed(1)}) `+
    `rotate(${a.toFixed(1)}) scale(${(SC*s).toFixed(4)})`;
  const read=[];
  for(let i=0;i<NREAD;i++){
    const zz=r()*2-1, th=r()*Math.PI*2, rad=Math.pow(r(),0.62), q=Math.sqrt(1-zz*zz);
    const ang=(r()*2-1)*30;                    // no two lie the same way
    const grp=el("g",{transform:at(C[0],C[1],ang,1)});
    const bar=el("rect",{x:(-BW/2).toFixed(2),y:(-BH/2).toFixed(2),
      width:BW.toFixed(2),height:BH.toFixed(2),
      fill:"var(--fg2)","fill-opacity":"0"});
    grp.appendChild(bar); sky.appendChild(grp);
    read.push({g:grp, bar, p:[Math.cos(th)*q*rad, zz*rad, Math.sin(th)*q*rad], ang, rad, o:null});
  }
  /* INNERMOST FIRST, so the sphere is seen to thicken from its core outward
     rather than fill a side at a time. Sorted after the draws, so the scatter
     is the same whatever the order. */
  read.sort((a,b)=>a.rad-b.rad);

  /* ---- THE SPIN -----------------------------------------------------------
     A turn every fourteen seconds about an axis leaning back a fifth of a
     radian, so the poles are not edge-on. Depth is spent on size and
     opacity — the far side smaller and fainter — which is all that makes a
     disc of bars read as a ball; nothing is re-sorted, because at this
     opacity no reader can tell which bar is painted over which. */
  const SPIN=Math.PI*2/14, TILT=0.35, cT=Math.cos(TILT), sT=Math.sin(TILT);
  const home=(R,ph)=>{
    const [x,y,z]=R.p, c=Math.cos(ph), s=Math.sin(ph);
    const xr=x*c+z*s, zr=z*c-x*s, yr=y*cT-zr*sT, zd=y*sT+zr*cT;
    return [C[0]+xr*RS*SC, C[1]+yr*RS*SC, (zd+1)/2];
  };
  /* each read's flight is timed off its distance so every one leaves E at
     the same speed — a near read given a far one's flight would crawl out,
     and the stream would look like it stuttered. V0 is that launch speed in
     unscaled pixels a second; distance is divided back by SC, so the timing
     is the same at any size. */
  const V0=80, FMIN=0.35;
  for(const R of read){
    const H=home(R,0);
    R.fly=Math.max(FMIN, 2*Math.hypot(H[0]-E[0],H[1]-E[1])/SC/V0);
  }

  /* ---- THE LABEL ----------------------------------------------------------
     Authored in screen pixels and sized off SC, the way C7's is: type cut from
     a world width shrinks with the tile and stops being legible long before
     the drawing does. It sits under the cloud, in the wedge between the
     sphere, the stream and this station's own emission point, which is empty
     at every zoom and directly under what it names. Since the stream came
     to leave from Sa's door it rises through the wedge's left side, so the
     word sits nine pixels further right than it did, off the strands. */
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const FS=7.0*SC;
  const cap=el("text",{x:(TOP[0]-2*SC).toFixed(1),y:(TOP[1]-32*SC).toFixed(1),
    "text-anchor":"middle","font-family":MONO,"font-size":FS.toFixed(2),
    "letter-spacing":(FS*0.12).toFixed(2),fill:"var(--fg2)","fill-opacity":".8"});
  cap.textContent="FASTQ"; sky.appendChild(cap);

  /* ---- TIMING -------------------------------------------------------------
     GAP is the stream's beat: one read out of E per strand arriving, so the
     cloud grows at the rate the line feeds it. BUILD runs until the last and
     outermost read has settled, so the build is most of the loop; HOLD is the
     finished sphere for a beat, and FADE is the seam, kept short enough not to
     read as a beat of its own. The stream and the spin run through all three —
     the request asked that the line never stop. */
  const HOLD=1.5, FADE=0.6, DIM=0.75;
  let BUILD=0;
  read.forEach((R,i)=>{ R.t0=i*GAP; BUILD=Math.max(BUILD,R.t0+R.fly); });
  const t1=BUILD, t2=t1+HOLD, t3=t2+FADE;
  /* Below zero is "not yet out": parked invisibly on the source, so nothing
     is ever seen anywhere but E before it has flown. A parked read is not
     rewritten; every read that is out has to be, because the sphere turns. */
  const put=(R,f,ph)=>{
    if(f<0){ if(R.o==="0") return; R.o="0";
      R.bar.setAttribute("fill-opacity","0");
      R.g.setAttribute("transform",at(E[0],E[1],R.ang,1)); return; }
    const H=home(R,ph), e=1-(1-f)*(1-f);        // eases out, so it settles rather than stops
    R.g.setAttribute("transform",at(E[0]+(H[0]-E[0])*e,E[1]+(H[1]-E[1])*e,R.ang,0.8+0.35*H[2]));
    /* already moving when it appears, so it cannot also fade up for long —
       a few frames, just enough that it does not pop */
    const o=(DIM*(0.4+0.6*H[2])*clamp(f*R.fly/0.08)).toFixed(2);
    if(o!==R.o){ R.o=o; R.bar.setAttribute("fill-opacity",o); }
  };

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader —
     and for this one that has to be the finished cloud, which is the frame the
     request asks the row to end on. Half way through the hold. */
  let t=t1+HOLD*0.45, ph=0, skyO="1", hazeO="0";
  const run=dt=>{
    t=(t+dt)%t3; ph=(ph+dt*SPIN)%(Math.PI*2);
    const so=(t<t2 ? 1 : 1-clamp((t-t2)/FADE)).toFixed(3);   // nothing leaves — it dims where it is
    if(so!==skyO){ skyO=so; sky.setAttribute("opacity",so); }
    const ho=clamp(t/t1).toFixed(2);
    if(ho!==hazeO){ hazeO=ho; haze.setAttribute("opacity",ho); }
    for(const R of read) put(R, t<t1 ? (t<R.t0 ? -1 : clamp((t-R.t0)/R.fly)) : 1, ph);
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.demux = drawDemux;

/* ------------------------------------------------------------------
   C5 · HAND OFF THE READS — eight files on one side of a line, a path on
   the other.

   THIS STATION IS A BOUNDARY, NOT AN APPARATUS. Nothing is made here and
   nothing is consumed: eight pairs of files already exist when the step
   begins, and all the step does is decide who can reach them. So the figure
   is a line drawn across the ground and two sides of it, and the only motion
   that matters is which of the things on the far side gets over it.

   THE EIGHT DO NOT CROSS, AND THAT IS THE WHOLE CLAIM. Each pile sends a
   thread at the line and each thread stops dead on it — the reads stayed in
   the vendor's bucket, and drawing even one of them arriving here would say
   the opposite of what this instance holds. What does cross is one thin card:
   a path to the files, plus the report written about them. It is drawn in the
   neutral the map uses for a record rather than in a sublibrary hue, because
   it is a description of the eight and not one of them.

   THE LINE IS DASHED because the edge of an instance is not a wall. Nobody
   refused the transfer; it simply never happened, and a solid barrier would
   make an absence look like a decision.

   THE PILES KEEP B7's HUES, the ones C2 indexed and C4 split them into, so a
   reader following one colour off the sequencer can see exactly where it got
   to. Reuses flowLine / setFanLine from the bench fan and SUBHUE from B7.
   ------------------------------------------------------------------ */
function drawHandoff(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE — w, d and h are read at draw time,
     because a resize is the only reason this function runs again. Composed at
     w .95, d .95, h .40, which is C4's tile: the two ends of the handoff are
     the same size because one is the other's output. */
  const NSUB=8, COLS=2, SC=n.w/0.95;
  const clamp=x=>Math.max(0,Math.min(1,x));

  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  /* The transfer is drawn on the near ground rather than on the tile, the way
     C4 draws its files: the row ends here, so the front is the only clear
     screen this station has, and the name still runs off the back edge. The
     pile is kept narrow — two files across rather than four — because C4's own
     figure reaches this far and two stacks of eight files should not touch. */
  const yc=n.y+n.d*1.30, bx=n.x+n.w*0.06;

  /* ---- THE EIGHT, ON THE FAR SIDE OF THE LINE ----------------------------
     Drawn back row first so the near ones overlap them, and born with their
     own geometry and no colour: the ticker owns one opacity per pile and never
     has to work out where a pile was. */
  const file=[];
  for(let k=0;k<NSUB;k++){
    const i=k%COLS, j=(k/COLS)|0;
    const c={x:n.x-n.w*0.45+i*n.w*0.21, y:yc+(j-1.5)*n.d*0.30,
             w:n.w*0.15, d:n.d*0.20, h:n.h*0.24};
    const f=faces(c.x,c.y,c.w,c.d,c.h);
    g.appendChild(el("polygon",{points:f.top,fill:"none",stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".45"}));
    const parts=["left","right","top"].map(kk=>{
      const p=el("polygon",{points:f[kk],fill:SUBHUE(k,NSUB),"fill-opacity":"0",
        stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":"0"});
      g.appendChild(p); return p;
    });
    file.push({parts, top:P(c.x,c.y,c.h), stop:P(bx,c.y,0)});
  }

  /* ---- THE LINE ----------------------------------------------------------
     One dash pattern, scaled with the node, so the line reads as the same kind
     of edge whatever size the station is dragged to. */
  const bA=P(bx,yc-n.d*0.62,0), bB=P(bx,yc+n.d*0.62,0);
  g.appendChild(el("line",{x1:bA[0].toFixed(1),y1:bA[1].toFixed(1),
    x2:bB[0].toFixed(1),y2:bB[1].toFixed(1),stroke:"var(--fg2)",
    "stroke-width":"1.1","stroke-opacity":".55",
    "stroke-dasharray":`${(4.5*SC).toFixed(1)} ${(3.5*SC).toFixed(1)}`}));

  /* ---- WHAT ACTUALLY CROSSES --------------------------------------------
     A card, not a file: flat where the piles are solid, and ruled, because
     what came over was a path and a report about the reads rather than the
     reads. It is outlined from the first frame — the record exists whether or
     not anybody has looked at it — and only its fill is animated. */
  const card={x:n.x+n.w*0.54, y:yc, w:n.w*0.26, d:n.d*0.34, h:n.h*0.06};
  const cf=faces(card.x,card.y,card.w,card.d,card.h);
  const cardFill=el("polygon",{points:cf.top,fill:"var(--fg2)","fill-opacity":"0"});
  g.appendChild(cardFill);
  g.appendChild(el("polygon",{points:cf.top,fill:"none",stroke:"var(--stroke)",
    "stroke-width":".8","stroke-opacity":".55"}));
  const rule=[0.30,0.62].map(u=>{
    const a=P(card.x-card.w*0.30, card.y+card.d*(u-0.5), card.h),
          b=P(card.x+card.w*0.30, card.y+card.d*(u-0.5), card.h);
    const L=el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
      x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg)",
      "stroke-width":".9","stroke-opacity":"0"});
    g.appendChild(L); return L;
  });

  /* eight threads that stop on the line, and one that goes over it */
  const STOP=file.map((f,k)=>flowLine(g,f.top,f.stop,SUBHUE(k,NSUB),SC));
  const CROSS=flowLine(g,P(bx,yc,0),P(card.x,card.y,card.h),"var(--fg2)",SC);

  /* ---- TIMING -------------------------------------------------------------
     Four beats: the files are there, the eight push at the line, one record
     crosses, and then the two sides sit and face each other. The hold is the
     longest of them because the held frame IS the station. */
  const FILL=1.4, PUSH=1.7, OVER=1.2, HOLD=2.1, CLEAR=0.9, WIN=0.45;
  const t1=FILL, t2=t1+PUSH, t3=t2+OVER, t4=t3+HOLD, t5=t4+CLEAR;
  const DIM=0.05, LIVE=0.16;
  const setFile=(k,v)=>file[k].parts.forEach(p=>{
    p.setAttribute("fill-opacity",(0.92*v).toFixed(2));
    p.setAttribute("stroke-opacity",(0.50*v).toFixed(2)); });
  const setCard=v=>{
    cardFill.setAttribute("fill-opacity",(0.55*v).toFixed(2));
    rule.forEach(L=>L.setAttribute("stroke-opacity",(0.45*v).toFixed(2))); };

  /* THE CLOCK DOES NOT START AT ZERO. A reader who asks for reduced motion
     never advances it, so whatever t begins at is the whole station for them —
     and that has to be the frame that carries the claim: eight piles standing
     on the far side of the line, and one card on this one. */
  let t=t3+HOLD*0.5, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before, so a frame long enough to skip one — a tab coming
     back, a step in trace mode — cannot leave a card lit over an empty bench. */
  const enter=m=>{
    mode=m;
    for(let k=0;k<NSUB;k++){
      setFile(k, m===0?0:1);
      setFanLine(STOP[k], m===1?LIVE:DIM, 0);
    }
    setFanLine(CROSS, m===2?LIVE:DIM, 0);
    setCard(m>=3?1:0);
  };
  const run=dt=>{
    t=(t+dt)%t5;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : t<t4?3 : 4;
    if(m!==mode) enter(m);

    if(m===0){                          // the conversion's output, arriving
      const u=t/FILL;
      for(let k=0;k<NSUB;k++) setFile(k, clamp((u-k*0.72/(NSUB-1))/0.28));
      return;
    }
    if(m===1){                          // eight threads at the line, staggered
      const u=(t-t1)/PUSH;
      for(let k=0;k<NSUB;k++)
        setFanLine(STOP[k], LIVE, clamp((u-k*(1-WIN)/(NSUB-1))/WIN));
      return;
    }
    if(m===2){                          // the one thing that gets over
      const u=clamp((t-t2)/OVER);
      setFanLine(CROSS, LIVE, u);
      /* the card fills as the bead lands on it, not as it sets off: a record
         that exists before the crossing says the crossing was not the point */
      setCard(clamp((u-0.70)/0.30));
      return;
    }
    if(m===4){                          // CLEAR
      const u=clamp((t-t4)/CLEAR);
      for(let k=0;k<NSUB;k++) setFile(k,1-u);
      setCard(1-u);
      return;
    }
    /* held: the reads on one side, a path to them on the other, and no figure
       anywhere on this instance saying what the transfer weighed */
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.handoff = drawHandoff;

/* ------------------------------------------------------------------
   C6 · PYRAMID — a block, and nothing claimed past the block.

   THE REQUEST WAS FIVE WORDS: draw a block, a pyramid. Every other figure in
   this file draws a step somebody can describe, and the drawing is an argument
   about that step — the plate is dealt because the split is the point, the run
   folder fans into eight because the split is the point. There is no step here
   to argue about yet, so this is the solid and only the solid: a square base
   standing on the station's own tile, four faces meeting over its centre.

   IT DOES NOT MOVE, AND THAT IS THE HONEST VERSION. Motion on this map says
   what a station DOES, so inventing a beat for a shape nobody has explained
   would be inventing the explanation with it. If the station is ever given a
   job, the figure can earn one then.

   TWO FACES ARE DRAWN, NOT FOUR, because two is what an isometric viewer can
   see; they take the tile's own left and right skin so the solid is lit the
   same way as the box it stands on. The apex is a fraction of the WIDTH rather
   than of n.h: h on this row is the thickness of the tile, and a pyramid that
   took its height from it would flatten to a lid the moment the box was
   dragged thinner. topOf() reads the same PYRAMID_RISE — see the note there.
   ------------------------------------------------------------------ */
function drawPyramid(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE — w, d and h are read at draw time,
     because a resize is the only reason this function runs again. Composed at
     w .95, d .95, h .40, which is C4's and C5's tile: the end of the row keeps
     one size across the three stations that were added to it. */
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  const hw=n.w*0.34, hd=n.d*0.34, z0=n.h, zT=n.h+n.w*PYRAMID_RISE;
  const A=P(n.x-hw,n.y-hd,z0), B=P(n.x+hw,n.y-hd,z0),
        C=P(n.x+hw,n.y+hd,z0), D=P(n.x-hw,n.y+hd,z0), T=P(n.x,n.y,zT);

  /* the base goes down first so the two faces overlap it rather than the other
     way round: all that shows of it is the two back edges, which is exactly
     what says the solid is sitting on the tile and not hovering over it */
  g.appendChild(el("polygon",{points:pts([A,B,C,D]),fill:"none",
    stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".45"}));
  [[B,C,SKIN.works.right],[C,D,SKIN.works.left]].forEach(([p,q,fill])=>{
    g.appendChild(el("polygon",{points:pts([p,q,T]),fill,stroke:"var(--stroke)",
      "stroke-width":SKIN.works.sw,"stroke-opacity":SKIN.works.so}));
  });
}
DRAW.pyramid = drawPyramid;

/* ------------------------------------------------------------------
   C7 · GROUP THE READS BACK INTO CELLS — a stream sorted into piles, and a
   cell drawn over each pile.

   THE BLOCK IS DELIBERATELY DULL. Every other object on this row is something
   you could pick up in a lab — a plate, a cycler, a tube, a sequencer — and
   this one is not: it is a low charcoal solid in the works skin C4, C5 and C6
   already stand in, with nothing on top of it. No plates, no tubes, no cycler.
   Whatever happens here happens to numbers, and a figure that gave it a lid or
   a rack would put it back on the bench it has just left.

   THE SORTING IS THE WHOLE FIGURE. Reads come in along the connector unsorted
   and in no order, cross the block, and spread out over the ground in front of
   it; then reads carrying the same four chips draw together into a pile and the
   piles pull away from each other. That beat is the longest one by a distance
   and the hold after it is the second longest, because this is the last station
   on the row and it should land rather than hand on.

   FOUR CHIPS, AND THEY ARE THE ONES THAT WERE INSTALLED. Chip one is a well on
   round one's 48-well ramp, chips two and three are wells on rounds two and
   three's 96-well ramp, and chip four is the sublibrary hue SUBHUE gives C2, C4
   and C5 — the same walks, so a colour here is the colour that barcode was
   ligated or indexed in and a reader can carry one back to the plate it came
   off. The wells are named outright rather than drawn at random for the reason
   B6 names its three: a colour that changes between reloads is a colour nobody
   can follow across two stations.

   SIX COMBINATIONS RATHER THAN FORTY-TWO, and that is a drawing's compromise,
   not a claim. A combination carried by one read cannot be shown to gather, so
   the stream is six combinations dealt into each other rather than a distinct
   one per read; what arrives still reads as scattered, because arrival order is
   the deal and not the sort.

   THE CELL COMES BACK WHOLE. B7 is where the cell stops being a cell, and the
   outline that fades in over a finished pile is plain, round and unbroken —
   nothing is left of the object, and what is drawn is the identity that
   survived it. It is the only closed round thing on the row after B7.

   Reuses rampHue from the round-one plate and SUBHUE from B7. Spends --ch1..12,
   which are declared on /molecular_pipe and nowhere else; this shape is worn by
   that page alone.
   ------------------------------------------------------------------ */
function drawRegroup(g,n){
  /* EVERY OFFSET IS EITHER A FRACTION OF THE NODE OR A SCREEN LENGTH TIMES SC,
     and w, d and h are read at draw time because a resize is the only reason
     this function runs again. Composed at w 1.30, d 1.30, h .40 — WIDER than
     C4, C5 and C6, which share a .95 tile. Six piles of seven reads with a cell
     drawn round each is what was asked for, and on their tile a chip comes out
     under four pixels and the four stop being four. The extra width was paid
     for at the end of the lane the way B2 paid for its own — see the note above
     LANES — so no gap already on the row moved. */
  const SC=n.w/1.30;
  const clamp=x=>x<0?0:x>1?1:x;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const mix=(a,b,f)=>[a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
  const NCL=6, PER=7, NREAD=NCL*PER;
  const r=rng(90731);

  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  /* ---- THE FOUR CHIPS EACH PILE WEARS ------------------------------------
     Wells on the three plates' own ramps plus a sublibrary, picked so that no
     two chips inside one read land on the same twelve-hue step and no two piles
     wear the same four. Nothing about WHICH wells is a fact about the run:
     these are six legible combinations, not six cells off this instance. */
  const WELL=[[20, 8,64,0],[36,32, 8,3],[ 4,56,32,6],
              [28,80,16,5],[12,40, 0,4],[40,16,48,7]];
  const COMBO=WELL.map(w=>[rampHue(w[0],48),rampHue(w[1],96),
                           rampHue(w[2],96),SUBHUE(w[3],8)]);

  /* ---- WHERE THE SORTING HAPPENS -----------------------------------------
     On the near ground and thrown forward and right, which is the only clear
     screen this station has: the row ends here so there is nothing to the
     right, the name runs off the back edge the other way, and the pyramid one
     tile back sits high enough that the top row of piles clears it. The grid is
     three across and two down so several piles are visibly forming at once
     rather than one after another. */
  const F=P(n.x+n.w*0.30, n.y+n.d*1.35, 0);
  const CDX=56, CDY=58, PITCH=5.4, CR=23;
  const CX=[], CY=[];
  for(let c=0;c<NCL;c++){
    CX.push(F[0]+((c%3)-1)*CDX*SC);
    CY.push(F[1]+(((c/3)|0)-0.5)*CDY*SC);
  }

  /* ---- THE CONNECTOR ------------------------------------------------------
     A stub into the gap behind rather than a line all the way to the sequencer:
     the lane's own track already draws the run from station to station, and a
     second line beside it would say the reads came by two routes. What this one
     is for is the stream — it is the thing the reads are on, and it ends on the
     block because that is where they go.

     IT COMES IN HIGH AND FROM BEHIND, not low and from the left, and that is
     the pyramid's fault rather than a taste. C6 stands one gap back at .95 and
     a feed drawn straight along the row runs into its right face; going back as
     well as left, and holding above the tile until it lands, clears the whole
     solid by putting the near end of the line on the far side of C6's widest
     screen point. Both offsets are fractions of this node, so the clearance is
     kept when either box is resized. */
  const A   =P(n.x-n.w*0.962, n.y-n.d*0.538, n.h*0.90);
  const MIN =P(n.x-n.w*0.30, n.y-n.d*0.02, n.h*1.00);
  const MOUT=P(n.x+n.w*0.16, n.y+n.d*0.44, n.h*1.00);
  g.appendChild(el("line",{x1:A[0].toFixed(1),y1:A[1].toFixed(1),
    x2:MIN[0].toFixed(1),y2:MIN[1].toFixed(1),stroke:"var(--fg2)",
    "stroke-width":(1.7*SC).toFixed(2),"stroke-opacity":".45",
    "stroke-linecap":"round"}));

  /* ---- THE READS ----------------------------------------------------------
     One group per read, born at the mouth of the connector with real
     coordinates and zero opacity, so the ticker only ever moves something that
     already knows where it is. The bar is authored in screen pixels — a chip is
     a glyph and cannot be cut from a world width — and it grows by being
     scaled: every group carries scale(SC), which is n.w over the width it was
     drawn for. */
  const BW=30, BH=2.4, CW=6.0, CG=0.5, CHH=5.8;
  const chipX=k=>-BW/2+2+k*(CW+CG)+CW/2;
  const at=(x,y)=>`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${SC.toFixed(4)})`;
  const read=[];
  for(let i=0;i<NREAD;i++){
    const c=i%NCL, j=(i/NCL)|0;                 // dealt, so arrival order is a shuffle
    const grp=el("g",{transform:at(A[0],A[1]),opacity:"0"});
    grp.appendChild(el("rect",{x:(-BW/2).toFixed(2),y:(-BH/2).toFixed(2),
      width:BW.toFixed(2),height:BH.toFixed(2),rx:(BH/2).toFixed(2),
      fill:"var(--fg3)","fill-opacity":".6"}));
    COMBO[c].forEach((fill,k)=>grp.appendChild(el("rect",{
      x:(chipX(k)-CW/2).toFixed(2),y:(-CHH/2).toFixed(2),
      width:CW.toFixed(2),height:CHH.toFixed(2),fill,stroke:"var(--stroke)",
      "stroke-width":".45","stroke-opacity":".75"})));
    g.appendChild(grp);
    read.push({g:grp, c,
      /* where it lands unsorted: wider than the grid of piles, because the
         whole point of the next beat is that it has somewhere to come from */
      S:[F[0]+(r()*2-1)*CDX*1.45*SC, F[1]+(r()*2-1)*CDY*0.85*SC],
      T:[CX[c], CY[c]+(j-(PER-1)/2)*PITCH*SC]});
  }

  /* ---- THE CELLS ----------------------------------------------------------
     Appended after the reads so the outline is over the pile rather than under
     it, and outlined rather than filled: the object is gone and this is its
     identity, so the faint wash inside is as much body as it is entitled to. */
  const cell=[];
  for(let c=0;c<NCL;c++){
    const body=el("circle",{cx:CX[c].toFixed(1),cy:CY[c].toFixed(1),
      r:(CR*SC).toFixed(2),fill:"var(--fg2)","fill-opacity":"0"});
    const ring=el("circle",{cx:CX[c].toFixed(1),cy:CY[c].toFixed(1),
      r:(CR*SC).toFixed(2),fill:"none",stroke:"var(--fg)",
      "stroke-width":(1.4*SC).toFixed(2),"stroke-opacity":"0"});
    g.appendChild(body); g.appendChild(ring);
    cell.push({body,ring});
  }

  /* ---- THE TWO LABELS -----------------------------------------------------
     Both authored in screen pixels and sized off SC, the way C3's caption is:
     type cut from a world width shrinks with the tile and stops being legible
     long before the drawing does. FASTQ sits over the connector because that is
     what is on it; the count sits under the piles and says what came out.

     FASTQ HANGS OFF THE TOP OF THE CONNECTOR AND RUNS RIGHT, rather than
     sitting centred over it: centred, its left half reaches back over the
     pyramid's corner, and a caption that lands on the station before it reads
     as that station's. */
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const FS=7.0*SC;
  const cap=el("text",{x:(A[0]+5*SC).toFixed(1),y:(A[1]-4*SC).toFixed(1),
    "text-anchor":"start",
    "font-family":MONO,"font-size":FS.toFixed(2),
    "letter-spacing":(FS*0.12).toFixed(2),fill:"var(--fg2)","fill-opacity":".8"});
  cap.textContent="FASTQ"; g.appendChild(cap);
  const cnt=el("text",{x:F[0].toFixed(1),
    y:(F[1]+(CDY*0.5+CR+17)*SC).toFixed(1),"text-anchor":"middle",
    "font-family":MONO,"font-size":FS.toFixed(2),
    "letter-spacing":(FS*0.06).toFixed(2),fill:"var(--fg2)","fill-opacity":"0",
    "font-weight":"600"});
  cnt.textContent="0 cells"; g.appendChild(cnt);

  /* ---- TIMING -------------------------------------------------------------
     SORT is the longest beat and HOLD the second longest, and that split is the
     request: the sorting is the motion budget and the finished frame is what
     the row ends on. AWIN is how much of the arrival one read occupies — about
     a third, so forty-two of them read as a stream that keeps coming rather
     than as forty-two things taking turns. SWIN is nearly the whole sort beat,
     because the piles are meant to form at once and not in sequence; the little
     left over is all that keeps six identical motions from reading as one
     motion drawn six times. */
  const ARRIVE=4.2, SORT=6.8, SETTLE=1.8, HOLD=5.6, CLEAR=1.2;
  const t1=ARRIVE, t2=t1+SORT, t3=t2+SETTLE, t4=t3+HOLD, t5=t4+CLEAR;
  const AWIN=0.34, SWIN=0.82, DIMV=0.30, STEP=0.42, RAMP=0.58;
  const setRead=(i,x,y,op)=>{
    read[i].g.setAttribute("transform",at(x,y));
    read[i].g.setAttribute("opacity",op.toFixed(3)); };
  const setCell=(c,v)=>{
    cell[c].body.setAttribute("fill-opacity",(0.10*v).toFixed(3));
    cell[c].ring.setAttribute("stroke-opacity",(0.85*v).toFixed(3)); };
  const setCount=(k,v)=>{
    cnt.textContent=`${k} ${k===1?"cell":"cells"}`;
    cnt.setAttribute("fill-opacity",(0.80*v).toFixed(3)); };
  /* how far a read has got along the connector, over the block, and out onto
     the ground — one function, so the route is stated once */
  const inflight=(i,f)=> f<0.44 ? mix(A,MIN,f/0.44)
                       : f<0.66 ? mix(MIN,MOUT,(f-0.44)/0.22)
                                : mix(MOUT,read[i].S,(f-0.66)/0.34);

  /* THE CLOCK DOES NOT START AT ZERO. A reader who asks for reduced motion
     never advances it, so whatever t begins at is the whole station for them,
     and for this one that has to be the arrival: six finished piles, a cell
     round each, and the count under them. Half way through the hold. */
  let t=t3+HOLD*0.5, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before, so a frame long enough to skip one — a tab coming
     back, a step in trace mode — cannot leave a cell drawn over an empty patch
     of ground. */
  const enter=m=>{
    mode=m;
    cap.setAttribute("fill-opacity", m===0?".8":".3");
    for(let i=0;i<NREAD;i++){
      const R=read[i];
      if(m===0)      setRead(i,A[0],A[1],0);
      else if(m===1) setRead(i,R.S[0],R.S[1],1);
      else           setRead(i,R.T[0],R.T[1], m===2?1:DIMV);
    }
    for(let c=0;c<NCL;c++) setCell(c, m>=3?1:0);
    setCount(m>=3?NCL:0, m>=3?1:0);
  };
  const run=dt=>{
    t=(t+dt)%t5;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : t<t4?3 : 4;
    if(m!==mode) enter(m);

    if(m===0){                          // the stream, unsorted, still arriving
      const u=t/ARRIVE;
      for(let i=0;i<NREAD;i++){
        const f=clamp((u-i*(1-AWIN)/(NREAD-1))/AWIN);
        const p=inflight(i,f);
        setRead(i,p[0],p[1],clamp(f/0.10));
      }
      return;
    }
    if(m===1){                          // THE SORT, and it is the whole budget
      const u=(t-t1)/SORT;
      for(let i=0;i<NREAD;i++){
        const R=read[i];
        const p=mix(R.S,R.T,ease(clamp((u-R.c*(1-SWIN)/(NCL-1))/SWIN)));
        setRead(i,p[0],p[1],1);
      }
      return;
    }
    if(m===2){                          // a pile completes, dims, becomes a cell
      const u=(t-t2)/SETTLE;
      const done=c=>clamp((u-c*STEP/(NCL-1))/RAMP);
      let k=0;
      for(let c=0;c<NCL;c++){ const v=done(c); setCell(c,v); if(v>=0.6) k++; }
      for(let i=0;i<NREAD;i++){
        const R=read[i];
        setRead(i,R.T[0],R.T[1], 1-(1-DIMV)*done(R.c));
      }
      setCount(k, clamp(u/0.5));
      return;
    }
    if(m===4){                          // CLEAR
      const u=clamp((t-t4)/CLEAR);
      for(let i=0;i<NREAD;i++){ const R=read[i]; setRead(i,R.T[0],R.T[1],DIMV*(1-u)); }
      for(let c=0;c<NCL;c++) setCell(c,1-u);
      setCount(NCL,1-u);
      return;
    }
    /* held: six piles, six cells, and nothing physical left of any of them */
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.regroup = drawRegroup;
