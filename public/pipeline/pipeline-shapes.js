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
function drawReverseTranscription(g,n){
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

  /* A WELL'S COLOUR is rampHue's, above — hoisted the moment B3 had to draw
     this same plate, because two copies of the walk would be two plates. */
  const HUE=k=>rampHue(k,NW);

  /* GREEN IS THE LIP AND THE SKIRT, NOT THE DECK, and that is skirtSlab's job
     now: B3 receives this plate and has to draw the same green plastic, so the
     lip, the deck and the notch are one function rather than two copies that
     would drift. It hands back the deck, which is what the wells are laid on. */
  const deck=skirtSlab(g,plate,pth,"var(--ch5)");

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
    drawWell(g,w,false);
    const rx=(w.e.rx*0.86).toFixed(2), ry=(w.e.ry*0.86).toFixed(2);
    g.appendChild(el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,
      fill:"var(--fg3)","fill-opacity":".3"}));
    const e=el("ellipse",{cx:w.e.x,cy:w.e.y,rx,ry,fill:HUE(k),"fill-opacity":DIM});
    g.appendChild(e); dots.push(e); shown.push("");
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
    g.appendChild(el("ellipse",{cx:s.x,cy:s.y,rx:(s.rx*2.1).toFixed(2),
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
    const src=wells[sk].e, col=HUE(sk);
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
   ROUND TWO · LIGATION
   The same compartment as B2, one round later, so it is deliberately the
   same drawing: same envelope, same five transcripts stacked in lanes. What
   has changed is the state of the molecule and what is being done to it.
   B2 carries the plate its barcode came out of and the pores that let it in,
   because round one is where the boundary has to be argued for; by here the
   reader has been told the reaction is in-cell and the second telling would
   only crowd the one bond this node is about.

   ROUND ONE IS OVER, so every strand is already a finished duplex — two
   rails and the rungs between them, end to end — and the round-one barcode
   is the dim stub still sitting at its foot. It is dim on purpose: it is no
   longer the news, and the map has to be able to show a molecule
   accumulating barcodes without every one of them shouting.

   WHAT THIS STEP WRITES IS THE SECOND BARCODE, so that is the bright part.
   A short double-stranded barcode drifts down onto the head of the cDNA,
   settles into line with it, and stops with a visible nick between the two.
   A ligase lands on that nick, and when it lifts off the gap is gone and
   the barcode is simply the end of the strand. The nick closing IS the
   step — ligation is the making of one bond — so it is the only thing in
   the drawing that moves toward anything.

   NOTHING ELSE MOVES, and that is the other half of the claim: this is
   in-situ chemistry in a fixed cell, the transcripts are held where they
   are, and only the reagent arrives. B2's compartment churns because a
   polymerase is walking; this one is still because nothing is.

   The join then fades and another approach begins. Same licence B2 takes
   with its unzip: a lane showing the reaction again, not a claim that a
   ligated barcode falls back off.

   Requires ellipseAt() and arcPts() from the A2 clutch block.
   ------------------------------------------------------------------ */
function drawLigation(g,n){
  const r=rng(1487);
  const th=n.h, R=Math.min(n.w,n.d)/2*0.98;
  const floor=ellipseAt(n.x,n.y,0,R*0.93),
        rim  =ellipseAt(n.x,n.y,th,R),
        inner=ellipseAt(n.x,n.y,th,R*0.9);

  /* the envelope, built exactly as B2 builds it — the two nodes are the
     same cell at two moments and any difference here would read as a
     different compartment */
  g.appendChild(el("ellipse",{cx:floor.x,cy:floor.y,rx:floor.rx,ry:floor.ry,
    fill:"var(--g-right)","fill-opacity":".65",stroke:"none"}));
  g.appendChild(el("polygon",{points:pts([...arcPts(rim,0,Math.PI,26),
                                          ...arcPts(floor,Math.PI,0,26)]),
    fill:"var(--g-top)","fill-opacity":".5",stroke:"none"}));
  g.appendChild(el("ellipse",{cx:inner.x,cy:inner.y,rx:inner.rx,ry:inner.ry,
    fill:"var(--fg)","fill-opacity":".05",stroke:"var(--stroke)",
    "stroke-width":".7","stroke-opacity":".4"}));
  g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,
    fill:"none",stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".85"}));

  const PRIMER=0.17;      // the round-one barcode still sitting at the foot
  const BC=0.24;          // the round-two barcode, as a fraction of the cDNA
  const FIT=R*0.72;       // no strand, and no barcode above one, leaves the envelope
  const OFF=R*0.064;      // half the width of a duplex
  const TIGHT=0.35;       // a duplex is a rod: the wobble is nearly damped out
  /* s=0 is the foot and s=1 the head, but the barcode lands BEYOND the head,
     so the strand is hung off-centre — its midpoint is at SMID, not a half —
     and the room that buys goes to the approach. */
  const SMID=0.68, GAP0=0.30, GAPD=0.10;
  const DROP=-R*S*0.55;   // how far above the strand a barcode starts, in px
  const N=5;

  /* LANES, NOT SCATTER, for the reason B2 gives: five strands this long in a
     compartment this small cross each other if they are placed at random, and
     a crossing reads as one strand. Shorter than B2's, because here the head
     end has to have somewhere for a barcode to come down. */
  const strands=[];
  for(let i=0;i<N;i++){
    const v=(i-(N-1)/2)*(FIT*2*0.92/N);
    const half=Math.sqrt(Math.max(0.02,FIT*FIT-v*v))*0.86;
    const ang=(r()-0.5)*0.42;
    strands.push({cx:n.x+(r()-0.5)*half*0.2, cy:n.y+v,
      ca:Math.cos(ang), sa:Math.sin(ang), L:half*2*0.55,
      amp:R*(0.056+r()*0.031), k:1.4+r()*0.9, ph:r()*6.283,
      rest:0.4+r()*2.6, t:r()*6});
  }

  /* a point on one strand: s runs 0..1 foot to head and past 1 for whatever
     is docking on the head, off steps sideways onto the other rail, dy lifts
     it off the strand in screen space while it is still in the air */
  const at=(st,s,off,dy)=>{
    const t=(s-SMID)*st.L,
          w=Math.sin(s*st.k*6.283+st.ph)*st.amp*TIGHT+off;
    const p=P(st.cx+t*st.ca-w*st.sa, st.cy+t*st.sa+w*st.ca, th);
    return [p[0], p[1]+(dy||0)];
  };
  const pathOf=(st,s0,s1,off,steps,dy)=>{
    let d="";
    for(let i=0;i<=steps;i++){
      const p=at(st,s0+(s1-s0)*i/steps,off,dy);
      d+=(i?" L ":"M ")+p[0].toFixed(2)+" "+p[1].toFixed(2);
    }
    return d;
  };

  /* Built in the state the cycle starts from — barcode still in the air, well
     clear of the head — so every element is born where it belongs and the
     ticker only has to move it. */
  strands.sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy)).forEach(st=>{
    const stroke=(d,col,w,op)=>{
      const e=el("path",{d,fill:"none",stroke:col,"stroke-width":w,
        "stroke-opacity":op,"stroke-linecap":"round"});
      g.appendChild(e); return e;
    };
    /* the finished round-one duplex: rails first, then rungs, then the stub */
    stroke(pathOf(st,0,1,-OFF,16),"var(--fg)","1",".7");
    stroke(pathOf(st,0,1, OFF,16),"var(--fg)","1",".7");
    for(let i=0;i<10;i++){
      const s=0.04+i*(0.92/9);
      const a=at(st,s,-OFF), b=at(st,s,OFF);
      g.appendChild(el("line",{x1:a[0].toFixed(2),y1:a[1].toFixed(2),
        x2:b[0].toFixed(2),y2:b[1].toFixed(2),
        stroke:"var(--fg)","stroke-width":".6","stroke-opacity":".35"}));
    }
    stroke(pathOf(st,0,PRIMER,OFF,4),"var(--signal)","1.6",".45");

    /* the arriving barcode, drawn as the duplex it is so that it reads as a
       block joining the strand rather than a stray line across it */
    const bc=el("g",{"stroke-opacity":"0"});
    const bstroke=(d,w)=>{
      const e=el("path",{d,fill:"none",stroke:"var(--signal)","stroke-width":w,
        "stroke-linecap":"round"});
      bc.appendChild(e); return e;
    };
    st.bcA=bstroke(pathOf(st,1+GAP0,1+GAP0+BC,-OFF,6,DROP),"1.2");
    st.bcB=bstroke(pathOf(st,1+GAP0,1+GAP0+BC, OFF,6,DROP),"1.7");
    st.bcR=[];
    for(let i=0;i<3;i++){
      const s=1+GAP0+BC*(0.2+i*0.3);
      const a=at(st,s,-OFF,DROP), b=at(st,s,OFF,DROP);
      const e=el("line",{x1:a[0].toFixed(2),y1:a[1].toFixed(2),
        x2:b[0].toFixed(2),y2:b[1].toFixed(2),
        stroke:"var(--signal)","stroke-width":".7","stroke-opacity":".7"});
      bc.appendChild(e); st.bcR.push({node:e,s:BC*(0.2+i*0.3)});
    }
    g.appendChild(bc); st.bc=bc;

    /* the ligase is placed by a transform, so it is drawn once in its own
       coordinates and turned to lie across the nick it is closing */
    const a=at(st,0.4,0), b=at(st,0.6,0);
    st.deg=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    const lig=el("g",{});
    lig.appendChild(el("ellipse",{cx:"0",cy:"0",
      rx:(R*S*0.16).toFixed(2),ry:(R*S*0.115).toFixed(2),
      fill:"var(--a-top)","fill-opacity":".95",stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".8"}));
    lig.appendChild(el("ellipse",{cx:(R*S*-0.055).toFixed(2),cy:(R*S*-0.06).toFixed(2),
      rx:(R*S*0.085).toFixed(2),ry:(R*S*0.067).toFixed(2),
      fill:"var(--a-left)","fill-opacity":".9"}));
    g.appendChild(lig); st.lig=lig;
  });

  const FLOAT=2.2, SEAL=1.3, HOLD=1.4, FADE=0.8;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const run=(dt,now)=>{
    const T=now/1000;
    strands.forEach(st=>{
      st.t=(st.t+dt)%(FLOAT+SEAL+HOLD+FADE+st.rest);
      const t=st.t;
      let gap=GAP0, dy=DROP, op=0, lig=0;
      if(t<FLOAT){ const u=ease(t/FLOAT);
        gap=GAP0+(GAPD-GAP0)*u; dy=DROP*(1-u); op=Math.min(1,t/(FLOAT*0.35)); }
      else if(t<FLOAT+SEAL){ const v=(t-FLOAT)/SEAL;
        /* the bond, and the only easing that is the subject rather than the
           staging: the last of the gap goes slowly and then all at once */
        gap=GAPD*(1-ease(v)); dy=0; op=1; lig=Math.min(1,v/0.22); }
      else if(t<FLOAT+SEAL+HOLD){ gap=0; dy=0; op=1;
        lig=Math.max(0,1-(t-FLOAT-SEAL)/(HOLD*0.4)); }
      else if(t<FLOAT+SEAL+HOLD+FADE){ gap=0; dy=0;
        op=1-(t-FLOAT-SEAL-HOLD)/FADE; }

      const s0=1+gap;
      st.bcA.setAttribute("d",pathOf(st,s0,s0+BC,-OFF,6,dy));
      st.bcB.setAttribute("d",pathOf(st,s0,s0+BC, OFF,6,dy));
      st.bcR.forEach(g2=>{
        const a=at(st,s0+g2.s,-OFF,dy), b=at(st,s0+g2.s,OFF,dy);
        g2.node.setAttribute("x1",a[0].toFixed(2)); g2.node.setAttribute("y1",a[1].toFixed(2));
        g2.node.setAttribute("x2",b[0].toFixed(2)); g2.node.setAttribute("y2",b[1].toFixed(2));
      });
      st.bc.setAttribute("stroke-opacity",op.toFixed(2));

      /* it comes down onto the nick and lifts straight off it, and while it is
         working it never quite holds still */
      const p=at(st,1+gap*0.5,0), jig=Math.sin(T*9+st.ph)*0.45;
      st.lig.setAttribute("transform",
        `translate(${p[0].toFixed(2)},${(p[1]+jig-(1-lig)*7).toFixed(2)}) rotate(${st.deg.toFixed(1)})`);
      st.lig.setAttribute("opacity",lig.toFixed(2));
    });
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
}
DRAW.ligation = drawLigation;


/* ------------------------------------------------------------------
   ROUND THREE · LIGATION — B4's drawing, one round later.

   Deliberately the same drawing as B4, for the reason B4 is the same
   drawing as B2: same compartment, same five transcripts held in lanes,
   same reagent coming down onto the head, same ligase closing the same
   nick. Rounds two and three are one operation done twice, and any
   difference in the glassware would read as a different operation.

   WHAT HAS CHANGED IS WHAT IS ALREADY ON THE STRAND. B4 shows one dim
   stub at the foot; this shows that stub AND round two's barcode welded
   onto the head, both in the same dim ink, with the bright block landing
   beyond them. Once the nick closes the chain carries THREE linked
   segments, which is the whole claim of split-pool barcoding — the
   address is never written anywhere, it is accumulated one round at a
   time, and only the newest round is news.

   AND THE MULTIPLICATION IS WRITTEN DOWN, under the compartment. It is
   the one fact on this row that is arithmetic rather than chemistry, and
   no upstream box can carry it: each plate on its own is just another
   plate, and only here are there three of them to multiply. The figure
   is the node's own — 48 wells in round one, 96 in each ligation — not
   96 cubed, so the callout and the built text cannot drift apart.

   Requires ellipseAt() and arcPts() from the A2 clutch block.
   ------------------------------------------------------------------ */
function drawLigation3(g,n){
  const r=rng(2311);
  const th=n.h, R=Math.min(n.w,n.d)/2*0.98;
  const floor=ellipseAt(n.x,n.y,0,R*0.93),
        rim  =ellipseAt(n.x,n.y,th,R),
        inner=ellipseAt(n.x,n.y,th,R*0.9);

  /* the envelope, built exactly as B2 and B4 build it */
  g.appendChild(el("ellipse",{cx:floor.x,cy:floor.y,rx:floor.rx,ry:floor.ry,
    fill:"var(--g-right)","fill-opacity":".65",stroke:"none"}));
  g.appendChild(el("polygon",{points:pts([...arcPts(rim,0,Math.PI,26),
                                          ...arcPts(floor,Math.PI,0,26)]),
    fill:"var(--g-top)","fill-opacity":".5",stroke:"none"}));
  g.appendChild(el("ellipse",{cx:inner.x,cy:inner.y,rx:inner.rx,ry:inner.ry,
    fill:"var(--fg)","fill-opacity":".05",stroke:"var(--stroke)",
    "stroke-width":".7","stroke-opacity":".4"}));
  g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,
    fill:"none",stroke:"var(--stroke)","stroke-width":"1.2","stroke-opacity":".85"}));

  const PRIMER=0.17;      // the round-one barcode, still at the foot
  const BC=0.24;          // one barcode, as a fraction of the cDNA
  const FIT=R*0.72;       // no strand, and no barcode above one, leaves the envelope
  const OFF=R*0.064;      // half the width of a duplex
  const TIGHT=0.35;       // a duplex is a rod: the wobble is nearly damped out
  const SMID=0.68, GAP0=0.30, GAPD=0.10;
  const DROP=-R*S*0.55;   // how far above the strand a barcode starts, in px
  const N=5;

  const strands=[];
  for(let i=0;i<N;i++){
    const v=(i-(N-1)/2)*(FIT*2*0.92/N);
    const half=Math.sqrt(Math.max(0.02,FIT*FIT-v*v))*0.86;
    const ang=(r()-0.5)*0.42;
    strands.push({cx:n.x+(r()-0.5)*half*0.2, cy:n.y+v,
      ca:Math.cos(ang), sa:Math.sin(ang), L:half*2*0.55,
      amp:R*(0.056+r()*0.031), k:1.4+r()*0.9, ph:r()*6.283,
      rest:0.4+r()*2.6, t:r()*6});
  }

  const at=(st,s,off,dy)=>{
    const t=(s-SMID)*st.L,
          w=Math.sin(s*st.k*6.283+st.ph)*st.amp*TIGHT+off;
    const p=P(st.cx+t*st.ca-w*st.sa, st.cy+t*st.sa+w*st.ca, th);
    return [p[0], p[1]+(dy||0)];
  };
  const pathOf=(st,s0,s1,off,steps,dy)=>{
    let d="";
    for(let i=0;i<=steps;i++){
      const p=at(st,s0+(s1-s0)*i/steps,off,dy);
      d+=(i?" L ":"M ")+p[0].toFixed(2)+" "+p[1].toFixed(2);
    }
    return d;
  };

  strands.sort((a,b)=>(a.cx+a.cy)-(b.cx+b.cy)).forEach(st=>{
    const stroke=(d,col,w,op)=>{
      const e=el("path",{d,fill:"none",stroke:col,"stroke-width":w,
        "stroke-opacity":op,"stroke-linecap":"round"});
      g.appendChild(e); return e;
    };
    stroke(pathOf(st,0,1,-OFF,16),"var(--fg)","1",".7");
    stroke(pathOf(st,0,1, OFF,16),"var(--fg)","1",".7");
    for(let i=0;i<10;i++){
      const s=0.04+i*(0.92/9);
      const a=at(st,s,-OFF), b=at(st,s,OFF);
      g.appendChild(el("line",{x1:a[0].toFixed(2),y1:a[1].toFixed(2),
        x2:b[0].toFixed(2),y2:b[1].toFixed(2),
        stroke:"var(--fg)","stroke-width":".6","stroke-opacity":".35"}));
    }
    /* SEGMENT ONE — the barcoded primer, where B4 leaves it */
    stroke(pathOf(st,0,PRIMER,OFF,4),"var(--signal)","1.6",".45");
    /* SEGMENT TWO — last round's block, now simply the end of the strand.
       Same ink and the same dimness as segment one: a barcode stops being
       the news the moment the next one lands on it, and if every round
       stayed bright the strand would end up shouting in three places. The
       two rail widths are B4's, so the near rail still reads as near. */
    stroke(pathOf(st,1-BC,1,-OFF,5),"var(--signal)","1.2",".45");
    stroke(pathOf(st,1-BC,1, OFF,5),"var(--signal)","1.6",".45");
    for(let i=0;i<3;i++){
      const s=1-BC+BC*(0.2+i*0.3);
      const a=at(st,s,-OFF), b=at(st,s,OFF);
      g.appendChild(el("line",{x1:a[0].toFixed(2),y1:a[1].toFixed(2),
        x2:b[0].toFixed(2),y2:b[1].toFixed(2),
        stroke:"var(--signal)","stroke-width":".7","stroke-opacity":".32"}));
    }

    /* SEGMENT THREE — the one this box writes, and the only bright thing */
    const bc=el("g",{"stroke-opacity":"0"});
    const bstroke=(d,w)=>{
      const e=el("path",{d,fill:"none",stroke:"var(--signal)","stroke-width":w,
        "stroke-linecap":"round"});
      bc.appendChild(e); return e;
    };
    st.bcA=bstroke(pathOf(st,1+GAP0,1+GAP0+BC,-OFF,6,DROP),"1.2");
    st.bcB=bstroke(pathOf(st,1+GAP0,1+GAP0+BC, OFF,6,DROP),"1.7");
    st.bcR=[];
    for(let i=0;i<3;i++){
      const s=1+GAP0+BC*(0.2+i*0.3);
      const a=at(st,s,-OFF,DROP), b=at(st,s,OFF,DROP);
      const e=el("line",{x1:a[0].toFixed(2),y1:a[1].toFixed(2),
        x2:b[0].toFixed(2),y2:b[1].toFixed(2),
        stroke:"var(--signal)","stroke-width":".7","stroke-opacity":".7"});
      bc.appendChild(e); st.bcR.push({node:e,s:BC*(0.2+i*0.3)});
    }
    g.appendChild(bc); st.bc=bc;

    const a=at(st,0.4,0), b=at(st,0.6,0);
    st.deg=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    const lig=el("g",{});
    lig.appendChild(el("ellipse",{cx:"0",cy:"0",
      rx:(R*S*0.16).toFixed(2),ry:(R*S*0.115).toFixed(2),
      fill:"var(--a-top)","fill-opacity":".95",stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".8"}));
    lig.appendChild(el("ellipse",{cx:(R*S*-0.055).toFixed(2),cy:(R*S*-0.06).toFixed(2),
      rx:(R*S*0.085).toFixed(2),ry:(R*S*0.067).toFixed(2),
      fill:"var(--a-left)","fill-opacity":".9"}));
    g.appendChild(lig); st.lig=lig;
  });

  /* The callout sits off the FRONT face rather than under the compartment,
     because the lane's own track runs down-right through the node centre and
     anything hung straight below it lands on the track at the right-hand end.
     Everything here is measured off R and n.d, so it moves and resizes with
     the node the way the rest of the drawing does. */
  const base=P(n.x, n.y+n.d/2+R*1.3, 0), FS=R*S*0.44;
  const MONO='ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,monospace';
  const say=(dy,txt,col,weight)=>{
    const t=el("text",{x:base[0].toFixed(1),y:(base[1]+dy).toFixed(1),
      "text-anchor":"middle","font-family":MONO,"font-size":FS.toFixed(2),
      "letter-spacing":(FS*0.04).toFixed(2),fill:col,"font-weight":weight});
    t.textContent=txt; g.appendChild(t);
  };
  say(0,           "48 × 96 × 96","var(--fg3)","500");
  say(FS*1.35,"= 442,368 paths","var(--fg2)","600");

  const FLOAT=2.2, SEAL=1.3, HOLD=1.4, FADE=0.8;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const run=(dt,now)=>{
    const T=now/1000;
    strands.forEach(st=>{
      st.t=(st.t+dt)%(FLOAT+SEAL+HOLD+FADE+st.rest);
      const t=st.t;
      let gap=GAP0, dy=DROP, op=0, lig=0;
      if(t<FLOAT){ const u=ease(t/FLOAT);
        gap=GAP0+(GAPD-GAP0)*u; dy=DROP*(1-u); op=Math.min(1,t/(FLOAT*0.35)); }
      else if(t<FLOAT+SEAL){ const v=(t-FLOAT)/SEAL;
        gap=GAPD*(1-ease(v)); dy=0; op=1; lig=Math.min(1,v/0.22); }
      else if(t<FLOAT+SEAL+HOLD){ gap=0; dy=0; op=1;
        lig=Math.max(0,1-(t-FLOAT-SEAL)/(HOLD*0.4)); }
      else if(t<FLOAT+SEAL+HOLD+FADE){ gap=0; dy=0;
        op=1-(t-FLOAT-SEAL-HOLD)/FADE; }

      const s0=1+gap;
      st.bcA.setAttribute("d",pathOf(st,s0,s0+BC,-OFF,6,dy));
      st.bcB.setAttribute("d",pathOf(st,s0,s0+BC, OFF,6,dy));
      st.bcR.forEach(g2=>{
        const a=at(st,s0+g2.s,-OFF,dy), b=at(st,s0+g2.s,OFF,dy);
        g2.node.setAttribute("x1",a[0].toFixed(2)); g2.node.setAttribute("y1",a[1].toFixed(2));
        g2.node.setAttribute("x2",b[0].toFixed(2)); g2.node.setAttribute("y2",b[1].toFixed(2));
      });
      st.bc.setAttribute("stroke-opacity",op.toFixed(2));

      const p=at(st,1+gap*0.5,0), jig=Math.sin(T*9+st.ph)*0.45;
      st.lig.setAttribute("transform",
        `translate(${p[0].toFixed(2)},${(p[1]+jig-(1-lig)*7).toFixed(2)}) rotate(${st.deg.toFixed(1)})`);
      st.lig.setAttribute("opacity",lig.toFixed(2));
    });
  };
  run(0,0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt,now); });
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
   in them, one per barcode, drawn by the same rampHue walk. It
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
/* LIP is {src, dst} — the plate this station empties and the plate it
   fills, each in its own round's colour. It is the entire difference
   between the two stations that wear this bench. */
function poolSplitBench(g,n,LIP){
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
  const gid=`tiedye${++UID}`, grad=el("radialGradient",{id:gid});
  for(let i=0;i<=12;i++) grad.appendChild(el("stop",{
    offset:`${(i*100/12).toFixed(1)}%`,"stop-color":`var(--ch${i%12+1})`}));
  g.appendChild(grad);
  const MIX={fill:`url(#${gid})`, op:0.7};
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
     liquid, because that is the thing the head takes away. */
  const deckSrc=skirtSlab(g,src,th,LIP.src);
  const WOP=0.85;              // full-strength: a tip's worth of it has to show
  const from=plateGrid(deckSrc,th,COLS,ROWS).map((w,k)=>{
    drawWell(g,w,false);
    const hue=rampHue(k,COLS*ROWS);
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:hue,"fill-opacity":WOP});
    g.appendChild(fill);
    return {e:w.e, hue, fill, rx:w.e.rx*0.86, ry:w.e.ry*0.86};
  });

  /* THE TUBE, on the floor between the two plates. It is conicalTube's, and it
     stands twice as tall as this shape's own first attempt at one: a 15 ml
     conical is a long thin thing and the old one read as a stubby vial. The
     height is also what the rising column needs, because ninety-six wells going
     into a short tube is a level that barely moves per trip. */
  const T=conicalTube(g, n.x-n.w*0.40, n.y+n.d*0.50, n.w, n.h);
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
  const deckDst=skirtSlab(g,dst,th,LIP.dst);
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
   royal blue one. */
function drawPoolSplit(g,n){
  poolSplitBench(g,n,{src:"var(--ch5)", dst:"var(--ch9)"});
}
DRAW.poolsplit = drawPoolSplit;

/* B5 · THE SAME BENCH ONE ROUND ON, and same is the claim: this station used
   to be drawn as three static beats with a flow fan between them, which said
   the second pooling was a different KIND of thing from the first. It is not —
   it is the identical operation, and the row only reads as split-pool
   barcoding if a viewer registers it as one procedure repeated. So it is the
   twelve-channel, the conical and the row-order sweep again, and the plates
   advance one round: the royal blue plate B3 dealt into, which round two has
   since ligated, is emptied into round three's yellow one. */
function drawPoolSplit96(g,n){
  poolSplitBench(g,n,{src:"var(--ch9)", dst:"var(--ch3)"});
}
DRAW.poolsplit96 = drawPoolSplit96;


/* ==================================================================
   B7 · COUNT AGAIN, SPLIT, LYSE
   The pool is counted a second time, divided into eight sublibraries,
   and only then are the cells opened.

   THREE THINGS HAPPEN HERE AND ONLY TWO OF THEM ARE NEW. The middle one
   is a pool and split, which this row has already drawn twice, so it is
   deliberately the same figure and not a variation on it: the conical
   out of conicalTube with a fan converging into its mouth and a fan
   leaving it again. Nothing about the split mechanic is re-invented. The
   one thing swapped is what it deals INTO — a rack of eight tubes rather
   than a plate, because eight sublibraries are what leave this station
   and a ninth well would be a claim about the chemistry that is false.

   THE COLOUR RUNS THE OTHER WAY ROUND FROM B5'S. There twelve hues
   arrive and one pool leaves, because twelve barcoded columns become one
   suspension. That has already happened by the time material reaches
   here, so one pool arrives — and EIGHT hues leave, because from this
   step on the sublibrary is a real identity: it becomes a first-class
   obs field and it survives all the way to the matrix. The eight are
   spread across the same twelve-stop ramp rather than taking the first
   eight of it, so they read as eight of a kind rather than as a
   truncated copy of the station two boxes back.

   THE COUNT IS ITS OWN BEAT AND IT IS THE FIRST ONE ON THE MAP. Two
   stations count on a haemocytometer — the thaw and this one — and
   neither has ever drawn the instrument. A drop goes from the pool onto
   the ruled chamber and the squares are then worked one at a time, which
   is what counting actually is: not a number appearing, but somebody
   going square by square. It sits BETWEEN the two halves of the split
   rather than beside them because that is where it belongs causally —
   the number it produces is the one the sublibrary table divides by.

   AND LYSIS IS ITS OWN BEAT BECAUSE NOTHING UPSTREAM SHOWS IT. Every
   step before this one happens inside a cell that stays shut; this is
   the one where it opens and three rounds of accumulated barcoded
   material go into solution. So it is drawn as a magnification standing
   over the rack, at a size nothing else on this map is drawn at, and it
   breaks: the membrane parts into arcs, the contents leave and drift
   apart. Folding that into the reused split icon would have said the
   last moment anything here is a cell silently.

   Reuses plateSlab / plateGrid / drawWell from the plate set,
   conicalTube and flowFan / setFanLine from the bench kit, and
   ellipseAt / arcPts from the clutch block. The haemocytometer, the rack
   and the bursting cell are the only new drawings.

   Like B5 this shape spends --ch1..12 and --pool, which are declared on
   /molecular_pipe. It is the only page that carries a node wearing it.
   ================================================================== */

/* THE EIGHT SUBLIBRARY HUES, and they are not B7's alone. B7 makes the eight
   and C2 indexes them, so a second copy of this one line is where the two
   stations would start disagreeing about what colour Sublib3 is — which is the
   one thing the colour is for. Spread across the twelve-stop ramp rather than
   taken in order, so they read as eight of a kind rather than as a truncated
   copy of B5's twelve. */
const CH=i=>`var(--ch${i%12+1})`;
const SUBHUE=(k,n)=>CH(Math.round(k*11/((n||8)-1)));

function drawCountSplitLyse(g,n){
  const SC=n.w/0.6;
  /* the plate this station empties is round three's, and round three is 96
     wells. It is not read off the node the way B5 reads it, because the plate
     is not this station's own object — it is the one it inherits, and B6 next
     door is the record of what it was. */
  const COLS=12, ROWS=8, NSUB=8;
  const GREY={fill:"var(--fg)", op:0.34};
  const POOLED={fill:"var(--pool)", op:GREY.op};
  const SUB=k=>SUBHUE(k,NSUB);

  /* ---- EVERY OFFSET IS A FRACTION OF THE NODE -----------------------------
     w, d and h are read at draw time because those are what a resize changes,
     and a redraw is the only reason this function is running again. Absolute
     coordinates draw correctly at the size the node happens to be authored and
     come apart the moment anybody drags a corner. Composed at w .85, d .85,
     h .55 — this station is the widest tile on the row and the composition is
     laid out against that, not against B5's smaller box.

     THE BEATS RUN ALONG y. The stations either side are a plate and a tile and
     both are close; y is the only axis on this row with room in it, and
     back-to-front puts the source low and left on screen and the rack high and
     right, so the sequence still reads the way the row does.

     THE HAEMOCYTOMETER SITS BEHIND THE TUBE RATHER THAN IN FRONT OF IT, which
     is the one placement here that is not about the order of the beats. In
     front it has to share the near ground with a 96-well plate, and the two
     of them at a size where the ruling is still legible leave four pixels
     between the slide and the station on the right. Behind, it stands in the
     empty screen wedge between the tube, the rack and B8, with room on every
     side of it. The line from the mouth is what says when the drop was taken;
     which side of the tube it landed on says nothing at all.

     AND THE SOURCE PLATE IS THROWN NO FURTHER THAN IT HAS TO BE. A fan wants a
     long run — climbing to the mouth from close in, twelve lines arrive near
     vertical and read as a bundle standing up rather than as a flow — but past
     about two node-depths the chevrons at the middle of those lines come down
     on top of B6's plate, and a marker belonging to this station sitting on
     that one's plastic is worse than a steep fan. Two depths is where both are
     true: the chevrons clear B6 and only the tail of each curve crosses the
     corner of it, which is thin lines over plastic and is the same cost B5
     pays and writes down. */
  const PW=n.w*1.30, PD=n.d*0.90, th=n.h*0.60;
  const src  ={x:n.x+n.w*0.55, y:n.y+n.d*2.00, w:PW, d:PD};
  const rack ={x:n.x-n.w*0.15, y:n.y-n.d*2.75, w:n.w*1.55, d:n.d*0.62, h:n.h*0.50};
  const slide={x:n.x+n.w*0.10, y:n.y-n.d*1.50, w:n.w*1.15, d:n.d*0.58, h:n.h*0.16};
  const TX=n.x+n.w*0.05, TY=n.y-n.d*0.10;

  /* ---- BEAT 3, BUILT FIRST ------------------------------------------------
     It stands furthest back, and on an isometric grid the order things are
     appended in is the order they occlude in.

     THE RACK IS EIGHT TUBES AND THAT NUMBER IS THE KIT'S. Evercode WT splits
     into eight sublibraries; the Mega kit would be sixteen, and the rack would
     then be the same drawing with another row in it — which is the whole
     reason the tubes are laid out from a count rather than placed one by one. */
  paint(g, rack.x, rack.y, rack.w, rack.d, rack.h, SKIN.works);
  const RC=4, RR=2, RT=n.w*0.13, RH=n.h*2.05;
  const tubes=[];
  for(let j=0;j<RR;j++)for(let i=0;i<RC;i++){
    const cx=rack.x-rack.w/2+(i+0.5)*rack.w/RC,
          cy=rack.y-rack.d/2+(j+0.5)*rack.d/RR;
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
      fill:SUB(j*RC+i),"fill-opacity":"0"});
    g.appendChild(liq);
    g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
      "stroke-width":".9","stroke-opacity":".7"}));
    g.appendChild(el("ellipse",{cx:rim.x,cy:rim.y,rx:rim.rx,ry:rim.ry,fill:"none",
      stroke:"var(--stroke)","stroke-width":"1","stroke-opacity":".8"}));
    tubes.push({liq, cx, cy, inner, mouth:[rim.x, rim.y-1.2*SC]});
  }
  const LIQ=0.55;
  const setTube=(t,f,op)=>{
    /* it fills to a shoulder, not to the rim, and the bore widens on the way
       up, so the surface has to walk the taper or it draws outside the wall */
    const fr=Math.max(0.0008,Math.min(1,f))*0.86;
    const surf=ellipseAt(t.cx,t.cy,rack.h+fr*RH,RT*(0.42+0.52*fr));
    t.liq.setAttribute("points",pts([...arcPts(surf,2*Math.PI,Math.PI,10),
                                     ...arcPts(t.inner,Math.PI,0,8)]));
    t.liq.setAttribute("fill-opacity",(f>0.004?op:0).toFixed(2));
  };
  const tf=new Array(NSUB).fill(-1);
  const setAllTubes=(f)=>{ for(let k=0;k<NSUB;k++){ tf[k]=f; setTube(tubes[k],f,LIQ); } };
  const fillTube=(k,f)=>{ if(Math.abs(f-tf[k])<0.004) return; tf[k]=f; setTube(tubes[k],f,LIQ); };

  /* ---- THE MAGNIFIED CELL, standing over the rack -------------------------
     It is not an object on the floor, so it is not drawn on one: it hangs in
     the air above the tubes with two leaders running down to the one it is a
     magnification of, which is the idiom /FASTQ_pipe already uses for a read
     drawn larger than life. Everything inside it is in the group's own frame,
     and the group is placed by transform — so the burst can push seven arcs
     and ten strands outward by writing one attribute each. */
  const [KX,KY]=P(rack.x-rack.w*0.06, rack.y+rack.d*0.10, rack.h+RH*2.35);
  const R=n.w*S*0.42;
  const cell=el("g",{transform:`translate(${KX.toFixed(1)},${KY.toFixed(1)})`});
  g.appendChild(cell);
  const anchor=tubes[RC+1];
  const leaders=[[-R*0.86, R*0.62],[R*0.72, R*0.78]].map(p=>{
    const l=el("line",{x1:(KX+p[0]).toFixed(1),y1:(KY+p[1]).toFixed(1),
      x2:anchor.mouth[0].toFixed(1),y2:anchor.mouth[1].toFixed(1),
      stroke:"var(--fg2)","stroke-width":".8","stroke-opacity":".25",
      "stroke-dasharray":"3 3"});
    g.appendChild(l); return l;
  });
  const body=el("circle",{cx:"0",cy:"0",r:(R*0.97).toFixed(1),
    fill:"var(--fg)","fill-opacity":".10"});
  cell.appendChild(body);
  const nuc=el("circle",{cx:(-R*0.20).toFixed(1),cy:(R*0.10).toFixed(1),
    r:(R*0.30).toFixed(1),fill:"var(--fg)","fill-opacity":".22"});
  cell.appendChild(nuc);
  /* the membrane is seven arcs from the start rather than a circle that turns
     into arcs when it breaks: a shape that swaps one element for another at
     the moment of the event has to be right about the swap, and this one only
     has to be right about where seven pieces go */
  const ringPts=(rad,a0,a1)=>{ const o=[];
    for(let i=0;i<=7;i++){ const a=a0+(a1-a0)*i/7;
      o.push([rad*Math.cos(a), rad*Math.sin(a)]); } return o; };
  const SEG=7, seg=[];
  for(let i=0;i<SEG;i++){
    const a0=(i/SEG)*2*Math.PI+0.09, a1=((i+1)/SEG)*2*Math.PI-0.09, am=(a0+a1)/2;
    const p=el("polyline",{points:pts(ringPts(R,a0,a1)),fill:"none",
      stroke:"var(--fg)","stroke-width":"1.5","stroke-opacity":".85",
      "stroke-linecap":"round"});
    cell.appendChild(p);
    seg.push({p, a:am, mid:[R*Math.cos(am), R*Math.sin(am)], spin:(i%2?1:-1)*(24+i*7)});
  }
  /* the contents: short strands, each carrying three coloured ticks, because
     three rounds of in-cell barcoding are what this material has on it and
     that is the only reason any of it is worth releasing */
  const rc=rng(71), strands=[];
  for(let i=0;i<10;i++){
    const L=R*0.44, s=el("g",{});
    s.appendChild(el("path",{d:`M ${(-L*0.5).toFixed(1)} 0 `+
      `q ${(L*0.3).toFixed(1)} ${(-L*0.34).toFixed(1)} ${(L*0.5).toFixed(1)} 0 `+
      `q ${(L*0.2).toFixed(1)} ${(L*0.30).toFixed(1)} ${(L*0.5).toFixed(1)} 0`,
      fill:"none",stroke:"var(--fg2)","stroke-width":"1.1","stroke-opacity":".9",
      "stroke-linecap":"round"}));
    [0,1,2].forEach(k=>s.appendChild(el("circle",{
      cx:(-L*0.30+k*L*0.30).toFixed(1), cy:(-L*0.10+k*L*0.10).toFixed(1),
      r:(R*0.10).toFixed(2), fill:CH(i*3+k), "fill-opacity":".95"})));
    cell.appendChild(s);
    strands.push({s, a:rc()*2*Math.PI, rad:Math.sqrt(rc())*R*0.58,
                  ang:(rc()-0.5)*90, out:0.95+rc()*1.05});
  }
  const burst=(f)=>{
    seg.forEach(s=>{
      /* each arc leaves along its own radius and turns about its own middle:
         turning about the centre of the cell would only slide it round the
         ring it is still part of */
      s.p.setAttribute("transform",
        `translate(${(Math.cos(s.a)*R*0.55*f).toFixed(1)},`+
        `${(Math.sin(s.a)*R*0.55*f).toFixed(1)}) `+
        `rotate(${(s.spin*f).toFixed(1)},${s.mid[0].toFixed(1)},${s.mid[1].toFixed(1)})`);
      s.p.setAttribute("stroke-opacity",(0.85-0.62*f).toFixed(2));
    });
    body.setAttribute("fill-opacity",(0.10*(1-f)).toFixed(2));
    nuc.setAttribute("fill-opacity",(0.22*(1-0.75*f)).toFixed(2));
    strands.forEach(st=>{
      const rad=st.rad+(R*st.out*1.85-st.rad)*f;
      st.s.setAttribute("transform",
        `translate(${(Math.cos(st.a)*rad).toFixed(1)},${(Math.sin(st.a)*rad).toFixed(1)}) `+
        `rotate(${(st.ang*(1+2*f)).toFixed(1)})`);
      st.s.setAttribute("opacity",(0.92-0.5*f).toFixed(2));
    });
    leaders.forEach(l=>l.setAttribute("stroke-opacity",(0.18+0.32*f).toFixed(2)));
  };

  /* ---- THE HAEMOCYTOMETER, and it is behind the tube ----------------------
     A ruled glass chamber on the bench. Sixteen squares rather than the
     Neubauer's full ruling: at this size the real grid is a grey smear, and
     what has to be legible is that somebody works them ONE AT A TIME. The
     cells sit where the seeded scatter put them, dim until the sweep reaches
     their square and bright after it — so the count is a thing being done
     rather than a number appearing. */
  paint(g, slide.x, slide.y, slide.w, slide.d, slide.h, SKIN.glass);
  const GC=4, chW=slide.w*0.54, chD=slide.d*0.64, grid=[];
  for(let j=0;j<GC;j++)for(let i=0;i<GC;i++){
    const x0=slide.x-chW/2+i*chW/GC, x1=x0+chW/GC,
          y0=slide.y-chD/2+j*chD/GC, y1=y0+chD/GC;
    const q=pts([P(x0,y0,slide.h),P(x1,y0,slide.h),P(x1,y1,slide.h),P(x0,y1,slide.h)]);
    g.appendChild(el("polygon",{points:q,fill:"none",stroke:"var(--stroke)",
      "stroke-width":".6","stroke-opacity":".45"}));
    grid.push(q);
  }
  const sweep=el("polygon",{points:grid[0],fill:"var(--signal)","fill-opacity":"0",
    stroke:"var(--signal)","stroke-width":"1.2","stroke-opacity":"0"});
  g.appendChild(sweep);
  /* twenty-two of them, in a chamber forty pixels across. The real square
     holds far more and a real count is far longer; what has to survive here is
     one dot being distinguishable from the next, because a count of a smear is
     not a count of anything. */
  const rs=rng(37), spots=[];
  for(let i=0;i<22;i++){
    const u=rs(), v=rs();
    const p=P(slide.x-chW/2+u*chW, slide.y-chD/2+v*chD, slide.h);
    const c=el("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),
      r:(n.w*S*0.040).toFixed(2),fill:"var(--fg)","fill-opacity":"0"});
    g.appendChild(c);
    spots.push({c, k:Math.min(GC-1,Math.floor(v*GC))*GC+Math.min(GC-1,Math.floor(u*GC))});
  }

  /* ---- BEAT 2 — the vessel, and it belongs to beats 1 and 3 both ----------
     One conical, with a fan converging into its mouth and a fan leaving it
     again. Drawing a second tube for the split would say the pool had been
     decanted into something else, which is not what happens.

     ITS HEIGHT IS NOT n.h. A 15 ml conical is a fixed shape — a long thin
     thing — so the height that goes into it has to keep its own proportion
     against its bore. This node stands nearly twice as tall as B5's, and
     handing conicalTube n.h raw gives a tube half a screen high. */
  const T=conicalTube(g, TX, TY, n.w*0.75, n.h*0.62);
  const mouth=[T.rim.x, T.rim.y-2.5*SC];

  /* ---- BEAT 1's plate, in front of the tube and therefore over it --------- */
  plateSlab(g,src,th,SKIN.tile,1);
  const from=plateGrid(src,th,COLS,ROWS).map(w=>{
    drawWell(g,w,false);
    const fill=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:GREY.fill,"fill-opacity":String(GREY.op)});
    g.appendChild(fill);
    return {e:w.e, fill, rx:w.e.rx*0.86, ry:w.e.ry*0.86};
  });

  /* the three flows, drawn last so no plate can bury one. The inward fan hangs
     off the row of the plate nearest the tube, so no line has to cross the
     plate it comes from. The sample line is a single line with the same
     chevron and bead as the fans: it is the same kind of event — material
     leaving the pool — and one drop is one line. */
  const IN  =flowFan(g, Array.from({length:COLS},(_,i)=>
    [from[i].e.x, from[i].e.y-1.5*SC]), mouth, true, ()=>POOLED.fill, SC);
  const OUT =flowFan(g, tubes.map(t=>t.mouth), mouth, false, SUB, SC);
  const SAMP=flowLine(g, mouth,
    [P(slide.x,slide.y,slide.h)[0], P(slide.x,slide.y,slide.h)[1]-3*SC],
    POOLED.fill, SC);

  /* ---- TIMING -------------------------------------------------------------
     Five beats, and the count is not the short one. It is a slow bench step
     that gates everything after it, and a sweep quick enough to read as a
     flash would say the opposite. WIN is how much of a beat one column's or
     one tube's transfer occupies — a third, so several are in flight at once
     and a fan reads as a fan rather than as twelve things taking turns. */
  const POOL=2.6, COUNT=2.4, SPLIT=2.4, LYSE=2.8, REST=1.2;
  const t1=POOL, t2=t1+COUNT, t3=t2+SPLIT, t4=t3+LYSE, t5=t4+REST;
  const WIN=0.34, clamp=x=>Math.max(0,Math.min(1,x));
  const phase=(i,k)=>i*(1-WIN)/(k-1);

  const cf=new Array(COLS).fill(-1);
  const setCol=(c,f)=>{ for(let j=0;j<ROWS;j++){ const w=from[j*COLS+c];
    w.fill.setAttribute("fill-opacity",(GREY.op*f).toFixed(2));
    w.fill.setAttribute("rx",(w.rx*(0.55+0.45*f)).toFixed(2));
    w.fill.setAttribute("ry",(w.ry*(0.55+0.45*f)).toFixed(2)); } };
  /* ninety-six wells times three attributes is a lot of DOM to touch on a
     frame where the column has not actually moved */
  const advanceCol=(c,f)=>{ if(Math.abs(f-cf[c])>0.003){ setCol(c,1-f); cf[c]=f; } };
  const allCols=(v)=>{ for(let c=0;c<COLS;c++){ setCol(c,v); cf[c]=-1; } };

  /* the deal order: shuffled, so the rack does not fill left to right — the
     sublibraries are volumes off one pool and nothing distinguishes their
     order */
  const deal=(()=>{ const a=[...Array(NSUB).keys()], r=rng(19);
    for(let i=NSUB-1;i>0;i--){ const j=Math.floor(r()*(i+1)); const s=a[i]; a[i]=a[j]; a[j]=s; }
    return a; })();

  const count=(u)=>{
    const vis=clamp((u-0.22)/0.16), walk=clamp((u-0.34)/0.60)*GC*GC;
    const k=Math.min(GC*GC-1,Math.floor(walk));
    sweep.setAttribute("points",grid[k]);
    sweep.setAttribute("fill-opacity",(vis*(0.10+0.12*Math.sin(Math.PI*(walk-k)))).toFixed(2));
    sweep.setAttribute("stroke-opacity",(vis*0.7).toFixed(2));
    spots.forEach(s=>s.c.setAttribute("fill-opacity",
      (vis*(s.k<=k?0.85:0.28)).toFixed(2)));
  };

  let t=0, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before. A frame long enough to skip a beat — a tab coming
     back, a step in trace mode — must not leave the plate it skipped standing
     half full, and stating it outright is cheaper than reasoning about which
     transitions are possible. */
  const enter=(m)=>{
    mode=m;
    allCols(m===0?1:0);
    setAllTubes(m>=3?1:0);
    cell.setAttribute("opacity", m===0?"0":"1");
    burst(m>=3?1:0);
    sweep.setAttribute("fill-opacity","0"); sweep.setAttribute("stroke-opacity","0");
    spots.forEach(s=>s.c.setAttribute("fill-opacity", m>=2?".85":"0"));
    IN  .forEach(L=>setFanLine(L, m===0?0.20:0.08, 0));
    OUT .forEach(L=>setFanLine(L, m===2?0.20:0.08, 0));
    setFanLine(SAMP, m===1?0.22:0.05, 0);
  };
  const run=(dt)=>{
    t=(t+dt)%t5;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : t<t4?3 : 4;
    if(m!==mode) enter(m);

    if(m===0){                                  // POOL — ninety-six into one
      const u=t/POOL; let lvl=0;
      IN.forEach((L,i)=>{ const f=clamp((u-phase(i,COLS))/WIN);
        advanceCol(i,f); setFanLine(L,0.20,f); lvl+=f; });
      T.setLevel(lvl/COLS, POOLED, 1);
      /* the magnification arrives with the material it magnifies */
      cell.setAttribute("opacity",clamp(u/0.16).toFixed(2));
      return;
    }

    if(m===1){                                  // COUNT — a drop, then square by square
      const u=(t-t1)/COUNT;
      setFanLine(SAMP,0.22,clamp(u/0.30));
      /* the pool is a little shorter afterwards, because a count costs a drop */
      T.setLevel(1-0.05*clamp((u-0.10)/0.20), POOLED, 1);
      count(u);
      return;
    }

    if(m===2){                                  // SPLIT — one out into eight
      const u=(t-t2)/SPLIT; let done=0;
      deal.forEach((k,i)=>{ const f=clamp((u-phase(i,NSUB))/WIN);
        setFanLine(OUT[k],0.20,f); fillTube(k,f); done+=f; });
      T.setLevel(0.95*(1-done/NSUB), POOLED, 1);
      return;
    }

    if(m===3){                                  // LYSE — the one cell that opens
      const u=(t-t3)/LYSE;
      burst(clamp((u-0.18)/0.62));
      /* fifteen minutes at 65C, and it happens in all eight at once — the
         eight keep their own colour through it, because the sublibrary is an
         identity from here on and lysis does not take it away */
      const warm=(LIQ+0.10*Math.sin(Math.PI*clamp((u-0.15)/0.7))).toFixed(2);
      tubes.forEach(tb=>tb.liq.setAttribute("fill-opacity",warm));
      return;
    }

    /* held: eight loaded tubes, an opened cell, and both fans left standing so
       the station still says what it does when nothing is moving */
    T.setLevel(0,null,0);
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.countsplitlyse = drawCountSplitLyse;


/* ==================================================================
   B8 · CAPTURE, TEMPLATE SWITCH, AMPLIFY
   The biotin ligated in round three is finally used as a handle:
   streptavidin beads take the barcoded cDNA, a magnet holds the beads
   while the debris of eight lysates is washed off, an adapter is put on
   the far end, and the whole thing is amplified.

   TWO COMPONENTS ARRIVE HERE AND NEITHER OF THEM IS B8'S ALONE. A
   magnetic rack and a thermal cycler are the two objects the rest of
   this row is built out of — C2 is a cycler, and every bead cleanup
   between here and the sequencer is a rack — so they are written as
   components that take their own geometry and hand back handles, rather
   than as parts of one station's drawing. That is the rule conicalTube
   and flowFan are already here under, applied one station earlier,
   because this time the second caller is visible from where it is
   written and a copy would start drifting the moment it was made.

   THE BEATS RUN ALONG y, the way B7's do and for the same reason: the
   stations either side sit about 1.3 apart in x and there is no room
   there, while y is empty. Capture is at the front and the cycler
   stands behind it, so the sequence reads front-left to back-right,
   which is the direction B7 next door already established for a bench
   with more than one beat on it.

   THE MIDDLE WORD IS NOT DRAWN AS A MOLECULE, and that is a decision
   about this neighbourhood rather than about the chemistry. A template
   switch is an adapter arriving on the 3-prime end; at tube scale it is
   a tube that does not change, so it wants the magnification idiom —
   and the airspace a magnification needs here is already spoken for.
   B7's haemocytometer sits directly over this tube, B7's own lysing
   cell stands over the ground behind it, and the diagonal above and to
   the right is where this station's name runs. A magnification put
   anywhere that is left would land on one of the three. So the beat is
   drawn as the two things that are true of it at the bench: the debris
   has gone, and what the beads are released into is a fresh reaction
   rather than the lysate they were captured out of. That is also the
   honest limit of the record — nothing was archived from this step.

   Reuses ellipseAt / arcPts from the clutch block and flowLine /
   setFanLine from the fan. Spends --pool and --ch6, which are declared
   on /molecular_pipe, the only page carrying a node that wears this
   shape.
   ================================================================== */

/* THE MAGNETIC RACK. A block with a row of sockets, a magnet bar down its far
   flank, and one tube standing in the middle socket.

   THE MAGNET IS ON THE FAR SIDE, and that placement is the only reason the
   pellet can be seen at all: beads collect against the wall nearest the magnet,
   and the far wall is the one you are looking THROUGH rather than the one you
   are looking at. On the near side the pellet would sit behind the glass edge
   and read as a smudge on the outside of the tube.

   NOTHING HERE SWITCHES ON. A rack's magnet is a lump of neodymium; what
   changes at the bench is that the tube is set down on it. But a tube hopping
   in and out of a socket every few seconds reads as a glitch rather than as a
   step, so the tube stays put and the field over the bar is what says which of
   the two states it is in.

   `r` is {x,y,w,d,h} for the block plus bore, rise, beads and seed for the tube
   it carries. Returns the mouth a flow can be aimed at and the three things
   only a magnet does to a tube: a level that can be drawn off, a bead cloud
   that can be pulled to a wall, and the field that says which. */
function magnetRack(g, r){
  const SOCK=3, B=r.bore, ZT=r.h+r.rise, ZL=ZT-r.rise*0.20;

  /* the magnet first, because it stands behind everything it acts on and the
     order things are appended in is the order they occlude in */
  const mw=r.w*0.86, md=r.d*0.28, mh=r.h*1.35, my=r.y-r.d*0.5-md*0.55;
  paint(g, r.x, my, mw, md, mh, SKIN.monolith);
  const field=el("polygon",{points:faces(r.x,my,mw,md,mh).top,
    fill:"var(--signal)","fill-opacity":"0"});
  g.appendChild(field);

  paint(g, r.x, r.y, r.w, r.d, r.h, SKIN.works);

  /* the sockets, so the block reads as a rack rather than as a plinth. Three,
     and only the middle one is worked: the empty two are what say the object
     is a stand and not a plug the tube grew out of. */
  const socks=[];
  for(let i=0;i<SOCK;i++){
    const sx=r.x-r.w/2+(i+0.5)*r.w/SOCK, e=ellipseAt(sx,r.y,r.h,B*1.16);
    socks.push(sx);
    g.appendChild(el("ellipse",{cx:e.x.toFixed(1),cy:e.y.toFixed(1),
      rx:e.rx.toFixed(2),ry:e.ry.toFixed(2),fill:"var(--bg)","fill-opacity":".45",
      stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".5"}));
  }

  /* the tube. A screw-cap 2 ml: straight wall, a flared collar, and the cone
     below the rack top where it is inside the block and cannot be seen. */
  const tx=socks[(SOCK-1)/2], ty=r.y;
  const collar=ellipseAt(tx,ty,ZT,B*1.10), neck=ellipseAt(tx,ty,ZT-r.rise*0.07,B),
        foot=ellipseAt(tx,ty,r.h,B*0.94), inner=ellipseAt(tx,ty,r.h,B*0.88);
  const silh=pts([[collar.x+collar.rx,collar.y],[neck.x+neck.rx,neck.y],
    ...arcPts(foot,0,Math.PI,10),[neck.x-neck.rx,neck.y],[collar.x-collar.rx,collar.y],
    ...arcPts(collar,Math.PI,2*Math.PI,14)]);
  g.appendChild(el("polygon",{points:silh,fill:"var(--g-top)","fill-opacity":".38"}));

  /* born with a real floor rather than empty, so the ticker only ever restates
     a surface — an element with no points sits at the origin and drags the
     selection halo out across the map */
  const liq=el("polygon",{points:pts(arcPts(inner,Math.PI,0,10)),
    fill:"var(--pool)","fill-opacity":"0"});
  g.appendChild(liq);

  const rb=rng(r.seed||29), beads=[];
  for(let i=0;i<(r.beads||16);i++){
    const a=rb()*2*Math.PI, u=Math.sqrt(rb())*0.66;
    const free=P(tx+Math.cos(a)*u*B, ty+Math.sin(a)*u*B, r.h+(0.10+rb()*0.72)*(ZL-r.h));
    /* held: against the far wall, in a band rather than a dot — a pellet on a
       rack is a streak up the side of the tube, not a bead at the bottom */
    const held=P(tx+(rb()-0.5)*B*0.70, ty-B*0.62, r.h+(0.16+rb()*0.30)*(ZL-r.h));
    const c=el("circle",{cx:free[0].toFixed(1),cy:free[1].toFixed(1),
      r:(B*S*0.16).toFixed(2),fill:"var(--fg)","fill-opacity":".8"});
    g.appendChild(c);
    beads.push({c,free,held,ph:rb()*6.28});
  }

  g.appendChild(el("polygon",{points:silh,fill:"none",stroke:"var(--stroke)",
    "stroke-width":"1","stroke-opacity":".8"}));
  g.appendChild(el("ellipse",{cx:collar.x.toFixed(1),cy:collar.y.toFixed(1),
    rx:collar.rx.toFixed(2),ry:collar.ry.toFixed(2),fill:"none",stroke:"var(--stroke)",
    "stroke-width":"1.2","stroke-opacity":".85"}));

  const T={mouth:P(tx,ty,ZT+r.rise*0.45)};
  T.setLevel=(f,col,op)=>{
    const k=Math.max(0.0006,Math.min(1,f));
    const surf=ellipseAt(tx,ty,r.h+k*(ZL-r.h),B*0.88);
    liq.setAttribute("points",pts([...arcPts(surf,2*Math.PI,Math.PI,12),
                                   ...arcPts(inner,Math.PI,0,10)]));
    if(col) liq.setAttribute("fill",col);
    liq.setAttribute("fill-opacity",(f>0.004?(op||0.34):0).toFixed(2));
  };
  T.setLevel(0,null,0);
  /* `ph` is a turn the caller keeps, so the wobble of a suspension is the
     caller's clock and not a second one running in here */
  T.pull=(f,ph,vis)=>{
    const k=Math.max(0,Math.min(1,f)), wob=(1-k)*B*S*0.20;
    beads.forEach(b=>{
      b.c.setAttribute("cx",(b.free[0]+(b.held[0]-b.free[0])*k+Math.cos(ph+b.ph)*wob).toFixed(1));
      b.c.setAttribute("cy",(b.free[1]+(b.held[1]-b.free[1])*k+Math.sin(ph*0.7+b.ph)*wob*0.6).toFixed(1));
      b.c.setAttribute("fill-opacity",(0.8*(vis===undefined?1:vis)).toFixed(2));
    });
  };
  T.setField=f=>field.setAttribute("fill-opacity",(0.5*Math.max(0,Math.min(1,f))).toFixed(2));
  return T;
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
   well, and the things the machine does. */
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
  const SC=n.w/0.72;
  /* what arrives is the hue B7's rack held, so the material is recognisably
     the thing the station before it made; what the beads are released into
     after the wash is a fresh reaction rather than a lysate, so it changes
     colour once — there — and never again on this bench */
  const LYSATE="var(--pool)", MIX="var(--ch6)";

  /* ---- EVERY OFFSET IS A FRACTION OF THE NODE -----------------------------
     w, d and h are read at draw time because those are what a resize changes
     and a redraw is the only reason this function is running again. Composed
     at w .72, d .72, h .44.

     NEITHER INSTRUMENT IS THROWN AS FAR AS B7 THROWS ITS FURNITURE, and that
     is the constraint the whole layout is under. This box has 1.3 of clear x
     either side and a very full screen: B7's source plate comes forward to
     y +2.1 on the left, its own eight-tube rack stands behind at y -2.7, and
     B9 is the next tile along. Going out as far as B7 does in y would put this
     station's rack on that one's plate and this cycler under that one's tubes.
     So the rack goes forward barely one node-depth and well to the right of
     the tube it has to clear, and the cycler goes back under two — which puts
     the whole of it in the wedge of empty screen between B7's rack above and
     B9's tile below, with about ten pixels at each edge and no more. */
  const rack={x:n.x+n.w*0.55, y:n.y+n.d*1.15, w:n.w*1.30, d:n.d*0.62, h:n.h*0.46,
              bore:n.w*0.26, rise:n.h*2.35, beads:16, seed:29};
  const cyc ={x:n.x+n.w*0.34, y:n.y-n.d*1.70, w:n.w*1.42, d:n.d*0.82, h:n.h*0.42,
              cols:4, rows:2};

  /* back to front, because on an isometric grid the order things are appended
     in is the order they occlude in */
  const M=thermalCycler(g, cyc);
  const T=magnetRack(g, rack);

  /* ---- THE TWO FLOWS, drawn last so no vessel can bury one ----------------
     THE WASTE LINE ENDS IN NOTHING, and it is the only flow on this map that
     does. What leaves is the debris of ninety-five thousand lysed cells and it
     goes down the sink; giving it a vessel would put the sink on the bench and
     invite the reader to ask what is in it. It leaves to the front-left rather
     than straight down because the tube is in the way of straight down — this
     curve bows, and a bowed line between two points either side of a tube
     passes through the tube. */
  const WASTE=flowLine(g, T.mouth,
    P(n.x+n.w*0.77, n.y+n.d*3.35, 0), LYSATE, SC);
  const TOPCR=flowLine(g, T.mouth, M.port, MIX, SC);

  /* ---- TIMING -------------------------------------------------------------
     Capture is the long beat. It is twenty minutes of binding at the bench and
     it is the step the station is named for; the wash after it is the quick
     one, because that is also what it is. */
  const CAPT=2.8, WASH=1.6, SWITCH=2.2, AMP=3.4, REST=1.2;
  const t1=CAPT, t2=t1+WASH, t3=t2+SWITCH, t4=t3+AMP, t5=t4+REST;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const CYCLES=6;

  let t=0, mode=-1, ph=0;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before, so a frame long enough to skip one — a tab coming
     back, a step in trace mode — cannot leave the lid half open */
  const enter=m=>{
    mode=m;
    T.setLevel(m===0?1:m===1?0.06:m<4?0.82:0, m>=2?MIX:LYSATE, 0.34);
    T.pull(m===0?0:m>=2?0.15:1, ph, m===4?0.35:1);
    T.setField(m===1?1:0);
    M.setLid(m>=3?1:0);
    M.setTemp(0,0);
    M.setWells(m>=4?1:0);
    M.setPips(m>=4?CYCLES:0);
    setFanLine(WASTE, m===1?0.20:0.05, 0);
    setFanLine(TOPCR, m===3?0.20:0.06, 0);
  };
  const run=dt=>{
    t=(t+dt)%t5; ph+=dt*2.2;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : t<t4?3 : 4;
    if(m!==mode) enter(m);

    if(m===0){                                  // CAPTURE — the beads go to the wall
      const u=t/CAPT;
      T.setField(clamp((u-0.14)/0.18));
      T.pull(clamp((u-0.22)/0.62), ph, 1);
      return;
    }

    if(m===1){                                  // WASH — the debris leaves, the pellet holds
      const u=(t-t1)/WASH;
      setFanLine(WASTE,0.20,clamp(u/0.75));
      T.setLevel(1-0.94*clamp((u-0.06)/0.62), LYSATE, 0.34);
      T.pull(1, ph, 1);
      return;
    }

    if(m===2){                                  // TEMPLATE SWITCH — released into a fresh reaction
      const u=(t-t2)/SWITCH;
      /* the mix goes in first and the magnet lets go after it: the beads have
         to be back in suspension for anything to reach what is on them, and
         letting go into an empty tube would drop the pellet onto the cone */
      T.setLevel(0.06+0.76*clamp(u/0.34), MIX, 0.34);
      T.setField(1-clamp((u-0.24)/0.26));
      T.pull(1-0.85*clamp((u-0.28)/0.34), ph, 1);
      return;
    }

    if(m===3){                                  // AMPLIFY — into the block, lid down, cycles
      const u=(t-t3)/AMP, move=clamp(u/0.26);
      setFanLine(TOPCR,0.20,move);
      T.setLevel(0.82*(1-move), MIX, 0.34);
      /* the beads dim with the level rather than staying behind on the wall.
         Whether they ride into the reaction is a detail of the kit that the
         record on this instance does not settle, and a pellet left standing in
         an emptied tube would settle it. */
      T.pull(0.15, ph, 1-0.65*move);
      M.setWells(move);
      M.setLid(clamp((u-0.20)/0.16));
      const done=clamp((u-0.34)/0.60)*CYCLES;
      M.setTemp(0.5+0.5*Math.sin(2*Math.PI*done-Math.PI/2), clamp((u-0.30)/0.10));
      M.setPips(Math.min(CYCLES,Math.floor(done)));
      return;
    }

    /* held: a loaded block under a closed lid, and six pips of a band that
       goes to eight */
    M.setTemp(0,0);
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.capture = drawCapture;

/* ==================================================================
   THE QC BENCH, AS TWO COMPONENTS — because two stations run it.

   B9 and C3 are the same instrument. Section 2.5 and section 3.6 are the same
   two measurements — Qubit for concentration, a tape or a chip for size — three
   sections apart, on material that has changed in between. Drawing them as two
   different objects would say the lab owns two of everything, which is not what
   the manual describes, and it would hide the one thing that IS different: what
   is in the tube and what comes off it.

   So the machine and the display are components, the way B8's thermal cycler is
   a component C2 calls. Each caller owns its own material, its own trace and its
   own clock, and nothing else.

   NEITHER CALLER LETS A NUMBER LAND, and that is a coincidence of the record
   rather than a property of the component: B9's concentration set the cycle
   count and is gone, C3's trace was never filed at all. So the readout cells are
   handed back rather than driven from here — refusing is the caller's claim to
   make, and a third caller with an archived number should be able to fill them.

   Requires ellipseAt() and arcPts() from the A2 clutch block.
   ================================================================== */

/* THE MACHINE: body, read port, the one tube standing in it, and the readout
   strip on the front face. Composed at w .72, d .72, h .4, and every offset is
   a fraction of the node — a caller on a wider tile gets a wider machine rather
   than a stranded one. */
function qcBench(g,n,o){
  o=o||{};
  const SC=n.w/0.72, hue=o.fill||"var(--ch6)";

  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  /* the read port, and the one tube in it. Drawn as a recess rather than a
     socket on the surface: the tube has to sit IN the machine for the box to
     read as measuring it instead of carrying it. */
  const tr=Math.min(n.w,n.d)*0.105, tx=n.x-n.w*0.22, ty=n.y+n.d*0.06;
  const port=ellipseAt(tx,ty,n.h,tr*1.9);
  g.appendChild(el("ellipse",{cx:port.x.toFixed(1),cy:port.y.toFixed(1),
    rx:port.rx.toFixed(2),ry:port.ry.toFixed(2),fill:"var(--fg)","fill-opacity":".14",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".5"}));
  const foot=ellipseAt(tx,ty,n.h,tr),
        lvl =ellipseAt(tx,ty,n.h+n.h*0.44,tr),
        rim =ellipseAt(tx,ty,n.h+n.h*0.82,tr);
  g.appendChild(el("polygon",{points:pts([...arcPts(rim,0,Math.PI,12),
    ...arcPts(foot,Math.PI,0,12)]),fill:"var(--g-top)","fill-opacity":".4",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".45"}));
  const liquid=el("polygon",{points:pts([...arcPts(lvl,0,Math.PI,12),
    ...arcPts(foot,Math.PI,0,12)]),fill:hue,"fill-opacity":".5"});
  g.appendChild(liquid);
  g.appendChild(el("ellipse",{cx:rim.x.toFixed(1),cy:rim.y.toFixed(1),
    rx:rim.rx.toFixed(2),ry:rim.ry.toFixed(2),fill:"var(--bg)","fill-opacity":".35",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".55"}));

  /* the readout, a hair proud of the front face so the face cannot swallow it */
  const fy=n.y+n.d/2+0.002;
  const fq=(x0,x1,z0,z1)=>pts([P(x0,fy,z1),P(x1,fy,z1),P(x1,fy,z0),P(x0,fy,z0)]);
  const rx0=n.x-n.w*0.32, rx1=n.x+n.w*0.32, rz0=n.h*0.24, rz1=n.h*0.60, rw=rx1-rx0;
  g.appendChild(el("polygon",{points:fq(rx0,rx1,rz0,rz1),fill:"var(--bg)",
    "fill-opacity":".8",stroke:"var(--stroke)","stroke-width":".8","stroke-opacity":".7"}));
  const lamp=el("polygon",{points:fq(rx0+rw*0.07,rx0+rw*0.17,
    rz0+(rz1-rz0)*0.28,rz1-(rz1-rz0)*0.28),fill:hue,"fill-opacity":".15"});
  g.appendChild(lamp);
  const cells=[];
  for(let i=0;i<3;i++){
    const cx0=rx0+rw*(0.34+i*0.20), cx1=cx0+rw*0.14, cz=(rz0+rz1)/2;
    const a=P(cx0,fy,cz), b=P(cx1,fy,cz);
    const d=el("line",{x1:a[0].toFixed(1),y1:a[1].toFixed(1),
      x2:b[0].toFixed(1),y2:b[1].toFixed(1),stroke:"var(--fg2)",
      "stroke-width":(1.1*SC).toFixed(2),"stroke-opacity":".3","stroke-linecap":"round"});
    g.appendChild(d); cells.push(d);
  }
  return {SC,
    /* what is in the tube can change between runs — the lamp goes with it,
       because a machine showing one colour while holding another is two claims */
    setFill :c=>{ liquid.setAttribute("fill",c); lamp.setAttribute("fill",c); },
    setLamp :v=>lamp.setAttribute("fill-opacity",v.toFixed(2)),
    setCells:v=>cells.forEach(d=>d.setAttribute("stroke-opacity",v.toFixed(2)))};
}

/* THE DISPLAY: the plinth it stands on, the bezel, the screen and the baseline.
   at(u,v) is the screen's own frame — u across, v up, both 0 to 1 — with the top
   margin a trace needs already inside it, so no caller has to remember it. */
function qcScreen(g,n){
  const pl={x:n.x+n.w*0.80, y:n.y-n.d*1.62, w:n.w*1.46, d:n.d*0.34, h:n.h*0.20};
  paint(g,pl.x,pl.y,pl.w,pl.d,pl.h,SKIN.tile);

  /* the screen is one plane at constant y, which in this projection is the same
     rhombus a machine's front panel is — so it reads as a face of the apparatus
     rather than a chart floating over the bench */
  const sy=pl.y-pl.d*0.10;
  const sq=(x0,x1,z0,z1)=>pts([P(x0,sy,z1),P(x1,sy,z1),P(x1,sy,z0),P(x0,sy,z0)]);
  const px0=pl.x-pl.w*0.46, px1=pl.x+pl.w*0.46, pw=px1-px0;
  const pz0=pl.h+n.h*0.10, pz1=pl.h+n.h*1.50, ph=pz1-pz0;
  const bx=pl.w*0.035, bz=n.h*0.09;
  g.appendChild(el("polygon",{points:sq(px0-bx,px1+bx,pz0-bz,pz1+bz),
    fill:"var(--fg)","fill-opacity":".1",stroke:"var(--stroke)",
    "stroke-width":"1","stroke-opacity":".7"}));
  g.appendChild(el("polygon",{points:sq(px0,px1,pz0,pz1),fill:"var(--bg)",
    "fill-opacity":".85",stroke:"none"}));

  const at=(u,v)=>P(px0+u*pw, sy, pz0+v*ph*0.92);
  const base0=at(0,0), base1=at(1,0);
  g.appendChild(el("line",{x1:base0[0].toFixed(1),y1:base0[1].toFixed(1),
    x2:base1[0].toFixed(1),y2:base1[1].toFixed(1),stroke:"var(--fg2)",
    "stroke-width":".8","stroke-opacity":".35"}));
  return {at, sq, px0, pw, pz0, pz1, base0, base1};
}

/* ------------------------------------------------------------------
   B9 · QUANTIFY THE cDNA — an instrument, and the trace it draws.

   NOTHING MOVES AT THIS STATION and that is the whole composition. B7 splits,
   B8 captures and cycles, C1 fragments; this box only looks at what B8 handed
   over. So there is no plate here and no flow line: one aliquot standing in the
   read port, and the trace that comes off it. A vessel going anywhere would be
   claiming work the step does not do.

   THE SAMPLE IS DRAWN IN B8's COLOUR. What is in the port is the same amplified
   cDNA the station before it released into a fresh reaction, and the trace on
   the screen is a measurement OF that material rather than a graphic about it —
   so both wear --ch6 and the bench reads as one tube travelling, not two.

   WHERE THE DISPLAY STANDS IS FORCED. B8 throws its cycler back of this tile
   and its magnet rack forward of it, and C1 is the next tile along at row
   level; the wedge past the cycler's far corner and above C1 is the only clear
   screen a display this size fits into. Hence the odd-looking offsets below —
   they are not composition, they are the gap.

   THE READOUT NEVER RESOLVES. The concentration measured here is what sets the
   cycle count in the indexing PCR two boxes along, and it was not archived, so
   the cells stay dashes however long the instrument runs. Same refusal as B8's
   hollow pips and for the same reason: the row can show that a measurement
   happened and still decline to invent what it said.

   The machine and the display are qcBench and qcScreen — see their header. What
   is left here is this station's own: the trace, and the clock it runs on.
   ------------------------------------------------------------------ */
function drawQuantify(g,n){
  const CDNA="var(--ch6)";
  const clamp=x=>Math.max(0,Math.min(1,x));

  const M=qcBench(g,n), SC=M.SC;
  const SCR=qcScreen(g,n);

  /* THE TRACE IS THE ONE A cDNA TAPE ACTUALLY GIVES: two sharp marker peaks
     from the ladder at either end of the run, and the broad smear between them
     that is the library. Three gaussians rather than a drawn squiggle, because
     the shape of the middle peak — wide, not sharp — is the whole reading. */
  const PEAKS=[[0.10,0.024,0.78],[0.55,0.110,0.95],[0.92,0.026,0.68]];
  const sig=u=>{ let v=0.04;
    PEAKS.forEach(([m,s,a])=>{ v+=a*Math.exp(-((u-m)*(u-m))/(2*s*s)); });
    return v; };
  const N=120;
  let peak=0; for(let i=0;i<=N;i++) peak=Math.max(peak,sig(i/N));
  const PT=(u,v)=>SCR.at(u, v/peak);
  const base0=SCR.base0, base1=SCR.base1;

  const tp=[]; for(let i=0;i<=N;i++){ const u=i/N; tp.push(PT(u,sig(u))); }
  const fill=el("polygon",{points:pts([...tp,base1,base0]),
    fill:CDNA,"fill-opacity":"0"});
  g.appendChild(fill);
  /* the sweep is a dash offset rather than a rewritten point list: the curve is
     born whole and complete, and the only thing the ticker owns is how much of
     it has been drawn yet */
  let len=0;
  for(let i=1;i<tp.length;i++)
    len+=Math.hypot(tp[i][0]-tp[i-1][0], tp[i][1]-tp[i-1][1]);
  const trace=el("polyline",{points:pts(tp),fill:"none",stroke:CDNA,
    "stroke-width":(1.5*SC).toFixed(2),"stroke-linecap":"round",
    "stroke-linejoin":"round","stroke-dasharray":`${len.toFixed(1)} ${len.toFixed(1)}`,
    "stroke-dashoffset":len.toFixed(1)});
  g.appendChild(trace);

  const sTop=PT(0,peak);
  const scan=el("line",{x1:base0[0].toFixed(1),y1:base0[1].toFixed(1),
    x2:sTop[0].toFixed(1),y2:sTop[1].toFixed(1),stroke:"var(--signal)",
    "stroke-width":".9","stroke-opacity":"0"});
  g.appendChild(scan);
  const pen=el("circle",{cx:tp[0][0].toFixed(1),cy:tp[0][1].toFixed(1),
    r:(2*SC).toFixed(2),fill:CDNA,"fill-opacity":"0"});
  g.appendChild(pen);

  /* ---- timing ------------------------------------------------------------
     A tape run is minutes and the hold afterwards is as long as somebody looks
     at it, so neither number here is the bench's. What the beats have to keep
     is the order: the trace cannot be complete before the run is, and the
     readout cannot be blank until the instrument has finished and had nothing
     to write. */
  const RUN=3.4, HOLD=2.6, CLEAR=0.8, T=RUN+HOLD+CLEAR;
  let t=0;
  const run=dt=>{
    t=(t+dt)%T;
    const running=t<RUN, u=clamp(t/RUN);
    trace.setAttribute("stroke-dashoffset",(len*(1-u)).toFixed(1));
    trace.setAttribute("stroke-opacity",
      (t<RUN+HOLD ? 1 : 1-clamp((t-RUN-HOLD)/CLEAR)).toFixed(2));
    const i=Math.min(N,Math.round(u*N));
    const b=PT(i/N,0), c=PT(i/N,peak);
    scan.setAttribute("x1",b[0].toFixed(1)); scan.setAttribute("y1",b[1].toFixed(1));
    scan.setAttribute("x2",c[0].toFixed(1)); scan.setAttribute("y2",c[1].toFixed(1));
    scan.setAttribute("stroke-opacity",running?".5":"0");
    pen.setAttribute("cx",tp[i][0].toFixed(1)); pen.setAttribute("cy",tp[i][1].toFixed(1));
    pen.setAttribute("fill-opacity",running?".9":"0");
    fill.setAttribute("fill-opacity",
      (t<RUN ? 0 : 0.16*(t<RUN+HOLD ? clamp((t-RUN)/0.5) : 1-clamp((t-RUN-HOLD)/CLEAR))).toFixed(2));
    M.setLamp(running ? 0.35+0.55*Math.abs(Math.sin(t*3.2)) : 0.15);
    /* the dashes come UP when the run ends. Nothing lands in them — that is the
       point — but they have to be legible at the moment a number would be. */
    M.setCells(running?0.3:0.75);
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.quantify = drawQuantify;

/* ------------------------------------------------------------------
   C1 · FRAGMENT, END-PREP, LIGATE ADAPTERS — two beats, and they stay two.

   THE STATION IS A TUBE, so it is not drawn as an instrument. Everything C1
   does happens in one tube in a block: nothing is loaded, nothing leaves, and
   there is no vessel to move. The body therefore stays the plain tile the rest
   of the C row stands on, with the reaction recessed into it, and the chemistry
   hangs in front at a size where it can be read — on the two grey leaders the
   map already uses for a thing drawn larger than life. Grey because a
   magnification is not a track: nothing travels down those lines.

   WHERE IT HANGS IS FORCED. B9 throws its display back of this tile and C2 is
   the next tile along at row level, so the near ground in front is the only
   empty screen this bench has. It is also the one place a drawing cannot land
   on the name, which is pinned to the back edge.

   THE MATERIAL IS IN B8's COLOUR because it IS B8's material — the amplified
   cDNA B9 measured and did not touch. What this step adds is the adapter and
   nothing else, so the adapter is the only --signal on the bench: the same rule
   B4 uses for the barcode it ligates.

   WHY TWO BEATS AND NOT ONE ICON. A strand wearing adapters is the product, and
   a product says nothing about how it was made. The cut is what MAKES the ends,
   and the ends are what the adapters need — draw them together and the box is a
   picture of a library rather than of a step. So: the strand breaks, and only
   then does anything dock on it.

   THE STAGGERED ENDS ARE THE END-PREP. An enzymatic cut leaves the two rails
   stopping at different places, and end repair and A-tailing make them flush.
   It is two pixels of overhang retracting and it is the only thing in the
   drawing that shows the middle third of this node's name doing any work.

   ONE ADAPTER PER FRAGMENT, ON ONE END. This kit ligates the TruSeq Read 1
   adapter to the 5-prime end; the far end already carries what the template
   switch put there back in B8. Forks on both ends would be the generic
   library-prep cartoon and not this protocol.

   AND THE CYCLE RESETS BY FADING. Adapters do not fall off. Same licence B4
   takes with its barcode and for the same reason: what repeats is the lane
   showing the reaction, not the molecule undoing it.

   Requires ellipseAt() from the A2 clutch block.
   ------------------------------------------------------------------ */
function drawFragmentLigate(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE. w, d and h are read at draw time
     because a resize is the only reason this function runs again. Composed at
     w .72, d .72, h .4 — the same tile B9 and C2 stand on. */
  const PX=n.w*S, SC=n.w/0.72;
  const CDNA="var(--ch6)", ADPT="var(--signal)";
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease =x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;

  /* ---- the bench, and the one tube the whole step happens in -------------- */
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile);
  const wr=Math.min(n.w,n.d)*0.13, wx=n.x-n.w*0.06, wy=n.y+n.d*0.12;
  const bore=ellipseAt(wx,wy,n.h,wr*1.55), lvl=ellipseAt(wx,wy,n.h,wr);
  g.appendChild(el("ellipse",{cx:bore.x.toFixed(1),cy:bore.y.toFixed(1),
    rx:bore.rx.toFixed(2),ry:bore.ry.toFixed(2),fill:"var(--fg)","fill-opacity":".16",
    stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".5"}));
  g.appendChild(el("ellipse",{cx:lvl.x.toFixed(1),cy:lvl.y.toFixed(1),
    rx:lvl.rx.toFixed(2),ry:lvl.ry.toFixed(2),fill:CDNA,"fill-opacity":".5"}));

  /* ---- the magnification, and the frustum that ties it to the tube -------- */
  const [SX,SY]=P(n.x-n.w*0.18, n.y+n.d*2.00, n.h*1.55);
  const HL=PX*1.20, OFF=PX*0.085, RUNG=PX*0.14;
  const mouth=[bore.x, bore.y-PX*0.06];
  [-HL,HL].forEach(e=>g.appendChild(el("line",{
    x1:(SX+e).toFixed(1),y1:SY.toFixed(1),
    x2:mouth[0].toFixed(1),y2:mouth[1].toFixed(1),
    stroke:"var(--fg2)","stroke-width":".8","stroke-opacity":".22",
    "stroke-dasharray":"3 3"})));

  /* the strand runs flat across the screen, which on this grid is the world
     diagonal — the one direction with no neighbour in it */
  const stage=el("g",{transform:`translate(${SX.toFixed(1)},${SY.toFixed(1)})`});
  g.appendChild(stage);

  /* the cuts are not four even quarters. A nuclease cuts where it lands, and
     four equal pieces read as a ruler rather than as chemistry. */
  const r=rng(613), NF=4, edge=[-HL];
  for(let i=1;i<NF;i++) edge.push(-HL+2*HL*(i/NF+(r()-0.5)*0.14));
  edge.push(HL);

  /* BUILT WHOLE, because that is the state the cycle starts from: the rails
     meet end to end, the stagger is zero and the forks are already in the wings
     with real coordinates. The ticker then owns nothing but four transforms and
     two rail ends per fragment. */
  const GAP=PX*0.11, ST=PX*0.17, AX=PX*0.24, AY=PX*0.17;
  const frags=edge.slice(0,NF).map((x0,k)=>{
    const x1=edge[k+1];
    const grp=el("g",{transform:"translate(0,0)"});
    stage.appendChild(grp);
    const rail=y=>{
      const e=el("line",{x1:x0.toFixed(1),y1:y.toFixed(1),
        x2:x1.toFixed(1),y2:y.toFixed(1),stroke:CDNA,
        "stroke-width":(1.2*SC).toFixed(2),"stroke-opacity":".9",
        "stroke-linecap":"round"});
      grp.appendChild(e); return e;
    };
    const top=rail(-OFF), bot=rail(OFF);
    for(let x=x0+RUNG*0.5;x<x1-RUNG*0.25;x+=RUNG)
      grp.appendChild(el("line",{x1:x.toFixed(1),y1:(-OFF).toFixed(1),
        x2:x.toFixed(1),y2:OFF.toFixed(1),stroke:CDNA,
        "stroke-width":(0.7*SC).toFixed(2),"stroke-opacity":".45"}));

    /* the adapter is a Y: a short duplex stem that ligates, and the two arms
       that never pair and are what the flow cell reads off */
    const ad=el("g",{transform:`translate(${(x0-GAP-PX*0.42).toFixed(1)},${(PX*0.62).toFixed(1)})`,
      opacity:"0"});
    const arm=(ax,ay,bx,by,w)=>ad.appendChild(el("line",{
      x1:ax.toFixed(1),y1:ay.toFixed(1),x2:bx.toFixed(1),y2:by.toFixed(1),
      stroke:ADPT,"stroke-width":(w*SC).toFixed(2),"stroke-opacity":".95",
      "stroke-linecap":"round"}));
    arm(0,-OFF,-ST,-OFF,1.2); arm(0,OFF,-ST,OFF,1.2);
    arm(-ST,-OFF,-ST-AX,-OFF-AY,1.2); arm(-ST,OFF,-ST-AX,OFF+AY,1.2);
    arm(-ST*0.5,-OFF,-ST*0.5,OFF,0.7);
    grp.appendChild(ad);

    /* the pieces drift apart along the strand rather than scattering: they came
       off one molecule and the break is the news, so the gap has to be wide
       enough to be a gap at this size and no wider */
    return {grp, top, bot, ad, x0, x1,
            spread:(k-(NF-1)/2)*PX*0.14, rise:(r()-0.5)*PX*0.14,
            ov:PX*(0.07+r()*0.05)};
  });

  /* the cut marks stay where the cut was, not where the pieces went: they are
     the map pointing at a break, so they are grey like the leaders */
  const ticks=edge.slice(1,NF).map(x=>{
    const e=el("line",{x1:x.toFixed(1),y1:(-OFF*3).toFixed(1),
      x2:x.toFixed(1),y2:(OFF*3).toFixed(1),stroke:"var(--fg2)",
      "stroke-width":(1.1*SC).toFixed(2),"stroke-opacity":"0",
      "stroke-linecap":"round"});
    stage.appendChild(e); return e;
  });

  /* ---- TIMING -------------------------------------------------------------
     Fragmentation and end-prep are one reaction on the bench and ligation is
     another, so the middle beat is short: it is not a station of its own, it is
     the thing that has to have happened before a fork will stick. */
  const WHOLE=1.6, CUT=1.3, PREP=0.9, DOCK=2.0, HOLD=1.5, FADE=0.8;
  const t1=WHOLE, t2=t1+CUT, t3=t2+PREP, t4=t3+DOCK, t5=t4+HOLD, t6=t5+FADE;
  /* THE CLOCK DOES NOT START AT ZERO, because zero is inside the fade the wrap
     needs and a browser asking for reduced motion never advances it: the shape
     would then stand there as a bare tile with an invisible magnification over
     it. Starting mid-way through the first beat makes the resting state a whole
     strand, which is the right thing to be looking at when nothing is running. */
  let t=WHOLE*0.5;
  const run=dt=>{
    t=(t+dt)%t6;
    const cut = t<t1?0 : t<t2?ease((t-t1)/CUT) : 1;
    const prep= t<t2?0 : t<t3?ease((t-t2)/PREP): 1;
    const dock= t<t3?0 : t<t4?ease((t-t3)/DOCK): 1;
    stage.setAttribute("opacity",
      Math.min(clamp(t/0.45), t<t5?1:clamp(1-(t-t5)/FADE)).toFixed(2));
    frags.forEach(f=>{
      f.grp.setAttribute("transform",
        `translate(${(f.spread*cut).toFixed(1)},${(f.rise*cut).toFixed(1)})`);
      /* one rail runs long at each end and the neighbour's runs long the other
         way, which is what a staggered cut leaves; end-prep pulls both back */
      const ov=f.ov*cut*(1-prep);
      f.top.setAttribute("x2",(f.x1+ov).toFixed(1));
      f.bot.setAttribute("x1",(f.x0-ov).toFixed(1));
      /* the fork arrives first and the last of the gap closes after it has
         stopped moving, so the nick is visible for a beat before it is not —
         ligation is the making of one bond and it should be legible as one */
      const away=1-dock, gap=GAP*(1-clamp((dock-0.72)/0.28));
      f.ad.setAttribute("transform",
        `translate(${(f.x0-ov-gap-PX*0.42*away).toFixed(1)},${(PX*0.62*away).toFixed(1)})`);
      f.ad.setAttribute("opacity",clamp(dock/0.35).toFixed(2));
    });
    const u=(t-t1)/CUT;
    ticks.forEach(e=>e.setAttribute("stroke-opacity",
      (t>=t1&&t<t2 ? 0.7*Math.sin(Math.PI*u) : 0).toFixed(2)));
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.fragmentligate = drawFragmentLigate;

/* ------------------------------------------------------------------
   C2 · ROUND 4 — INDEXING PCR — a plate of indexes and the machine that
   attaches them.

   THE NAME IS THE TRAP AND THE DRAWING HAS TO DISARM IT. "Round 4" echoes
   rounds one to three, and those are drawn on this row as barcodes written
   INSIDE a cell — a chain of coloured ticks on a strand, built up by surviving
   three plates in a known order. This round is none of that. It is bulk PCR on
   a tube, ninety-five thousand cells after the last of them was lysed, and the
   thing it identifies is the sublibrary rather than the sample. So the barcode
   chain that says "combinatorial" is deliberately absent here: borrowing it
   would put this step inside the 48 x 96 x 96 that makes a cell identity, and
   the whole difficulty of this station is that it is NOT in that arithmetic.
   What is drawn instead is the two objects a bench actually has for it — an
   index plate and a thermal cycler.

   THE CYCLER IS B8's, AS A COMPONENT. B8's own header names C2 as the second
   caller it was written as a component for, so this is that call: same chassis,
   same block, same lid, and the same refusal on the readout. What differs is
   the band — B8 runs six cycles to eight, this one seven to thirteen off the
   cDNA concentration B9 measured and did not archive — so thirteen pips are
   drawn and seven fill. The floor of the band is all the record supports.

   THE EIGHT HUES ARE B7's AND THAT IS THE CLAIM. Eight libraries go into the
   block wearing B8's cDNA colour, because until this moment they ARE
   interchangeable — same chemistry, same adapters, nothing to tell them apart
   in a tube. One index lands in each and they come out as eight distinguishable
   things in the eight colours the sublibrary has worn since B7 made it. That is
   the __s1..__s8 suffix on every cell id, and it is the one part of this whole
   library prep that can be checked after the fact.

   NOTHING ON THE PLATE IS DRAWN SPENT. The wells are never reused, so a real
   plate accumulates a history — but which wells this run took is not on this
   instance, and shading in a block of used ones would be inventing how much of
   the plate had already gone. Eight are taken out of ninety-six and the other
   eighty-eight are left alone: the rule, not a history. They are taken as one
   column because eight sublibraries and eight rows is what the plastic offers,
   and it is the column nearest the machine so that no line has to cross the
   plate it comes from — B7's rule for a fan, and the same reason.

   WHERE THE TWO OBJECTS STAND IS FORCED, the way it is for every station in
   this stretch. C1 throws its magnification into the near ground to the left,
   C3 is the next tile along, and this station's own name runs up and to the
   right off its back edge. The plate goes forward and right of C1's stage; the
   cycler tucks in just under the diagonal the name runs on, which is where B8
   puts its own and is the only clear screen back there.

   Reuses thermalCycler from B8, plateSlab / plateGrid / drawWell from the plate
   set and flowLine / setFanLine from the fan. Spends --ch1..12, which are
   declared on /molecular_pipe — the only page carrying a node wearing this.
   ------------------------------------------------------------------ */
function drawIndexPcr(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE. w, d and h are read at draw time
     because a resize is the only reason this function runs again. Composed at
     w .72, d .72, h .42 — the same tile C1 and C3 stand on. */
  const SC=n.w/0.72;
  const CDNA="var(--ch6)";                  // what B8 made, B9 measured, C1 cut
  const clamp=x=>Math.max(0,Math.min(1,x));
  const NSUB=8, COLS=12, ROWS=8, CYCLES=7;

  const plate={x:n.x+n.w*0.60, y:n.y+n.d*1.45, w:n.w*1.25, d:n.d*0.85};
  const th=n.h*0.55;
  const cyc  ={x:n.x+n.w*0.64, y:n.y-n.d*2.20, w:n.w*1.42, d:n.d*0.82,
               h:n.h*0.44, cols:4, rows:2, pips:13, lit:CYCLES};

  /* back to front, because on an isometric grid the order things are appended
     in is the order they occlude in */
  const M=thermalCycler(g, cyc);

  /* the bench itself stays the plain tile the rest of the C row stands on.
     Everything this station does happens in the block, so there is nothing on
     the ground to draw and a prop invented to fill it would be a claim. */
  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.tile);

  /* ---- THE UDI PLATE ------------------------------------------------------ */
  plateSlab(g,plate,th,SKIN.tile,1);
  const TAKEN=COLS-1;                       // the column nearest the machine
  const idx=[];
  plateGrid(plate,th,COLS,ROWS).forEach(w=>{
    drawWell(g,w,false);
    if(w.i!==TAKEN) return;
    /* born with the well's own geometry and no colour: the ticker owns one
       opacity per well and never has to work out where a well was */
    const f=el("ellipse",{cx:w.e.x,cy:w.e.y,rx:(w.e.rx*0.86).toFixed(2),
      ry:(w.e.ry*0.86).toFixed(2),fill:SUBHUE(idx.length,NSUB),"fill-opacity":"0"});
    g.appendChild(f);
    idx.push({fill:f, mouth:[w.e.x, w.e.y-1.5*SC]});
  });

  /* ---- EIGHT LINES, AND THEY DO NOT MEET ---------------------------------
     The fan figure this row uses elsewhere converges on one mouth, because
     elsewhere many things become one thing. Here they emphatically do not: each
     index goes to its own reaction and stays there, and eight lines drawn into
     a single port would say the indexes were pooled — the exact misreading this
     station spends the rest of its drawing avoiding. So they run in parallel,
     well to well, and never touch. */
  const IDX=idx.map((w,k)=>flowLine(g, w.mouth, M.slots[k], SUBHUE(k,NSUB), SC));

  /* ---- TIMING -------------------------------------------------------------
     The transfers are the long beat and the PCR is the longer one; the two
     short ones are the lid, which is a second at the bench and should not read
     as an event. WIN is how much of the take beat one transfer occupies — a
     little under half, so several are in the air at once and eight pipettings
     read as a task rather than as eight things taking turns. */
  const TAKE=2.8, SEAL=0.8, RUN=3.6, HOLD=1.7, CLEAR=1.0, WIN=0.42;
  const t1=TAKE, t2=t1+SEAL, t3=t2+RUN, t4=t3+HOLD, t5=t4+CLEAR;
  const DIM=0.05, LIVE=0.16;

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader —
     and zero is the instant before the first transfer, which is a plate with
     nothing on it. Two thirds of the way through the take beat is the frame
     worth holding: three wells indexed, five in the air, and the difference
     between an indexed reaction and a plain one legible in one look. */
  let t=TAKE*0.62, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before, so a frame long enough to skip one — a tab coming
     back, a step in trace mode — cannot leave the lid half open. B8's rule,
     and it is here for the reason it is there. */
  const enter=m=>{
    mode=m;
    M.setLid(m>=2?1:0);
    M.setTemp(0,0);
    M.setPips(m>=3?CYCLES:0);
    for(let k=0;k<NSUB;k++){
      const done=m>=1;
      M.setWell(k, done?SUBHUE(k,NSUB):CDNA, 1);
      idx[k].fill.setAttribute("fill-opacity",done?".90":"0");
      setFanLine(IDX[k], m===0?LIVE:DIM, done?1:0);
    }
  };
  const run=dt=>{
    t=(t+dt)%t5;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : t<t4?3 : 4;
    if(m!==mode) enter(m);

    if(m===0){                                // TAKE — eight wells, one at a time
      const u=t/TAKE;
      for(let k=0;k<NSUB;k++){
        const f=clamp((u-k*(1-WIN)/(NSUB-1))/WIN);
        setFanLine(IDX[k],LIVE,f);
        idx[k].fill.setAttribute("fill-opacity",(0.90*clamp(f/0.18)).toFixed(2));
        /* the well in the block was full before its index reached it. What
           changes on arrival is WHICH of the eight it is, not that anything is
           in it — the library was made three stations ago. */
        M.setWell(k, f>0.86?SUBHUE(k,NSUB):CDNA, 1);
      }
      return;
    }
    if(m===1){ M.setLid(clamp((t-t1)/SEAL)); return; }

    if(m===2){                                // RUN — the cycles, up to the floor
      const u=(t-t2)/RUN;
      const done=clamp((u-0.10)/0.78)*CYCLES;
      M.setTemp(0.5+0.5*Math.sin(2*Math.PI*done-Math.PI/2), clamp(u/0.10));
      M.setPips(Math.min(CYCLES,Math.floor(done)));
      return;
    }
    if(m===4){                                // CLEAR — the plate goes away
      const u=clamp((t-t4)/CLEAR);
      M.setLid(1-clamp(u/0.5));
      for(let k=0;k<NSUB;k++){
        idx[k].fill.setAttribute("fill-opacity",(0.90*(1-u)).toFixed(2));
        M.setWell(k,null,1-u);
      }
      return;
    }
    /* held: a sealed block, eight indexed reactions in it, and seven pips of a
       band that goes to thirteen */
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.indexpcr = drawIndexPcr;

/* ------------------------------------------------------------------
   C3 · QUANTIFY AND SIZE-CHECK — B9's instrument, run eight times.

   IT IS THE SAME BENCH AND IT IS DRAWN AS THE SAME BENCH. Section 3.6 sends the
   same tube to the same Qubit and the same tape as section 2.5 did four boxes
   back, so this station calls qcBench and qcScreen rather than inventing a
   second machine. The repetition is the claim: the last check before the
   sequencer is not a new capability, it is the one the row already has, pointed
   at material that is no longer cDNA.

   IT LEAVES THE C ROW's TILE, and that is the one thing it does not share with
   C1 and C2 either side of it. Those two are reactions in a tube standing on a
   bench; this is a measurement taken inside a machine, which is what --works is
   for and what B9 established. A tile here would say the size check happens on
   the bench top, and the tube would have nowhere to be.

   EIGHT RUNS, NOT ONE, AND THAT IS THE DIFFERENCE FROM B9. B9 measured one
   pooled cDNA; by this point C2 has made eight distinguishable libraries, so the
   instrument is loaded eight times and the tube in the port changes colour with
   each — B7's eight hues, the same ones C2 indexes them into. Eight tubes drawn
   at once would be four pixels each on a tile this size and would read as grit;
   one tube eight times reads as eight runs, which is what the bench does.

   THE WINDOW IS THE ONLY THING ON THE SCREEN THAT IS RECORDED. Appendix B wants
   a single peak between 400 and 500 base pairs, so the band is drawn as a gate
   on the glass, and the trace is drawn landing in it. That is the protocol's
   expectation and not this run's result — cond says no electropherogram was
   archived, so nothing here is a measurement. What keeps the drawing honest is
   the same refusal B9 makes: the readout cells stay dashes, the screen wipes
   clean at the end of the eighth run, and nothing is left behind that could be
   mistaken for a record.

   ONE GHOST, NOT EIGHT. The library before last is held at a fifth opacity while
   the current one draws, because two curves in the same window say the eight
   agree with each other and eight curves stacked in fifteen pixels of screen say
   nothing at all.
   ------------------------------------------------------------------ */
function drawSizeCheck(g,n){
  const NSUB=8, N=90;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const r=rng(937);

  const M=qcBench(g,n,{fill:SUBHUE(0,NSUB)}), SC=M.SC;
  const SCR=qcScreen(g,n);

  /* ---- THE 400 TO 500 bp GATE -------------------------------------------
     Drawn under the traces and never animated: it is printed on the glass, not
     measured. The screen carries no axis because a scale would invite the
     number off it, and the number is exactly what this station does not have. */
  const W0=0.44, W1=0.62;
  g.appendChild(el("polygon",{
    points:SCR.sq(SCR.px0+W0*SCR.pw, SCR.px0+W1*SCR.pw, SCR.pz0, SCR.pz1),
    fill:"var(--fg2)","fill-opacity":".10",stroke:"var(--fg2)",
    "stroke-width":".6","stroke-opacity":".4"}));

  /* ---- EIGHT TRACES, EACH BORN WHOLE -------------------------------------
     Same three gaussians B9 uses and the same two ladder markers, but the middle
     peak is narrow here rather than broad: a size-selected library is a band,
     and B9's smear was un-fragmented cDNA. The jitter is per-library and seeded,
     so the eight are not identical — which is true of any eight tubes — while
     carrying no claim about which was which. */
  const LIBS=[];
  for(let k=0;k<NSUB;k++){
    const pk=[[0.10,0.024,0.72],
              [(W0+W1)/2+(r()-0.5)*0.045, 0.038+r()*0.014, 0.92+r()*0.20],
              [0.92,0.026,0.62]];
    LIBS.push({hue:SUBHUE(k,NSUB), sig:u=>{ let v=0.04;
      pk.forEach(([m,s,a])=>{ v+=a*Math.exp(-((u-m)*(u-m))/(2*s*s)); });
      return v; }});
  }
  /* one normalisation across all eight, not one each: normalising per trace
     would flatten them to the same height and say the concentrations matched */
  let peak=0;
  LIBS.forEach(L=>{ for(let i=0;i<=N;i++) peak=Math.max(peak,L.sig(i/N)); });

  LIBS.forEach(L=>{
    L.pt=[]; for(let i=0;i<=N;i++){ const u=i/N; L.pt.push(SCR.at(u, L.sig(u)/peak)); }
    let len=0;
    for(let i=1;i<L.pt.length;i++)
      len+=Math.hypot(L.pt[i][0]-L.pt[i-1][0], L.pt[i][1]-L.pt[i-1][1]);
    L.len=len;
    /* the sweep is a dash offset rather than a rewritten point list — B9's rule.
       The curve exists whole from the first frame and the ticker owns only how
       much of it has been drawn yet. */
    L.line=el("polyline",{points:pts(L.pt),fill:"none",stroke:L.hue,
      "stroke-width":(1.4*SC).toFixed(2),"stroke-linecap":"round",
      "stroke-linejoin":"round","stroke-opacity":"0",
      "stroke-dasharray":`${len.toFixed(1)} ${len.toFixed(1)}`,
      "stroke-dashoffset":len.toFixed(1)});
    g.appendChild(L.line);
  });

  const b0=SCR.at(0,0), c0=SCR.at(0,1);
  const scan=el("line",{x1:b0[0].toFixed(1),y1:b0[1].toFixed(1),
    x2:c0[0].toFixed(1),y2:c0[1].toFixed(1),stroke:"var(--signal)",
    "stroke-width":".9","stroke-opacity":"0"});
  g.appendChild(scan);
  const pen=el("circle",{cx:LIBS[0].pt[0][0].toFixed(1),cy:LIBS[0].pt[0][1].toFixed(1),
    r:(1.9*SC).toFixed(2),fill:LIBS[0].hue,"fill-opacity":"0"});
  g.appendChild(pen);

  /* ---- TIMING -------------------------------------------------------------
     Eight runs have to fit in a loop somebody will watch the whole of, so each
     one is a beat rather than a run: what the order has to keep is that a
     library's trace cannot exist before its tube is in the port, and the dashes
     cannot come up until the eighth has finished and left nothing behind. */
  const RUN=1.15, GAP=0.14, HOLD=2.0, WIPE=1.0;
  const STEP=RUN+GAP, SEQ=NSUB*STEP, T=SEQ+HOLD+WIPE;
  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader —
     and zero is an empty screen. Part-way through the third run is the frame
     worth holding: one curve finished, one drawing, and both inside the gate. */
  let t=STEP*2+RUN*0.55, lit=-1;
  const run=dt=>{
    t=(t+dt)%T;
    const seq=t<SEQ;
    const k=seq?Math.min(NSUB-1,Math.floor(t/STEP)):NSUB-1;
    const u=seq?clamp((t-k*STEP)/RUN):1;
    const running=seq && u<1;
    const wipe=t<SEQ+HOLD ? 0 : clamp((t-SEQ-HOLD)/WIPE);

    LIBS.forEach((L,i)=>{
      const op = i===k ? 1 : (seq && i===k-1) ? 0.20 : 0;
      L.line.setAttribute("stroke-opacity",(op*(1-wipe)).toFixed(2));
      L.line.setAttribute("stroke-dashoffset",
        (i<k ? 0 : i===k ? L.len*(1-u) : L.len).toFixed(1));
    });

    const j=Math.min(N,Math.round(u*N));
    const b=SCR.at(j/N,0), c=SCR.at(j/N,1);
    scan.setAttribute("x1",b[0].toFixed(1)); scan.setAttribute("y1",b[1].toFixed(1));
    scan.setAttribute("x2",c[0].toFixed(1)); scan.setAttribute("y2",c[1].toFixed(1));
    scan.setAttribute("stroke-opacity",running?".5":"0");
    const p=LIBS[k].pt[j];
    pen.setAttribute("cx",p[0].toFixed(1)); pen.setAttribute("cy",p[1].toFixed(1));
    pen.setAttribute("fill-opacity",running?".9":"0");

    /* the tube and the lamp only change when the library does — a machine told
       its own colour sixty times a second is sixty claims that it changed */
    if(k!==lit){ lit=k; M.setFill(LIBS[k].hue); pen.setAttribute("fill",LIBS[k].hue); }
    M.setLamp(running ? 0.35+0.55*Math.abs(Math.sin(t*3.2)) : 0.15);
    /* the dashes come up after the eighth run, and stay dashes. Eight libraries
       were measured and not one of the numbers is on this instance. */
    M.setCells(seq?0.3:0.75);
  };
  run(0);
  TICKERS.push((dt,now,k)=>{ if(k<0.7) return; run(dt); });
}
DRAW.sizecheck = drawSizeCheck;

/* ------------------------------------------------------------------
   C4 · BASECALL AND DEMULTIPLEX — one run folder, eight pairs of files.

   THIS IS THE ONE STATION ON THE ROW WITH NOTHING IN A TUBE, and the drawing
   has to say so before it says anything else. Every box to the left of it is
   material being moved, cut or copied; this one is a directory of per-cycle
   base calls being read and written back out under eight names. So it stands
   on --works rather than on the C row's bench tile, and nothing on it is a
   vessel: the only round thing in the whole figure would be a lie about where
   the reads are.

   THE SHEETS ARE THE RUN FOLDER AND THEY ARE DELIBERATELY UNCOLOURED. What the
   instrument leaves behind is one undifferentiated pile — every sublibrary's
   reads interleaved, cycle by cycle, with the index read sitting in it unread.
   Colouring the stack would put the eight apart before the step that tells them
   apart, which is the whole content of this station. They are fanned rather
   than squared up because a squared stack at this size is one thick sheet.

   THE FAN RUNS OUTWARD, AND IT IS B5's FAN. Everywhere else on this row that
   figure collects many into one; here it is the exact reverse, one into eight,
   which is what the same curve drawn the other way is for. Each line carries
   B7's hue for its sublibrary — the same colour C2 indexed it into three boxes
   back — because the i5/i7 pair C2 attached is precisely what this step reads
   to decide which file a read goes in. A ninth line for the reads whose index
   matched nothing is NOT drawn: no conversion report survives, so how big that
   pile was is not something this map can show, and drawing it at any size at
   all would be picking a number.

   EIGHT SLOTS ARE DRAWN EMPTY FROM THE FIRST FRAME. Eight files is the shape of
   the output rather than an event in the loop, so the outlines are there before
   anything lands in them — the same reason C2 draws ninety-six wells and fills
   eight.

   Reuses flowLine / setFanLine from the bench fan and SUBHUE from B7. Spends
   --ch1..12, which are declared on /molecular_pipe — the only page carrying a
   node wearing this.
   ------------------------------------------------------------------ */
function drawDemux(g,n){
  /* EVERY OFFSET IS A FRACTION OF THE NODE. w, d and h are read at draw time
     because a resize is the only reason this function runs again. Composed at
     w .95, d .95, h .40 — C3's tile, so the two ends of the handoff match. */
  const NSUB=8, SHEETS=6, COLS=4, SC=n.w/0.95;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const topAt=(x,y,w,d,z)=>pts([[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]]
    .map(p=>P(p[0],p[1],z)));

  paint(g,n.x,n.y,n.w,n.d,n.h,SKIN.works);

  /* ---- THE RUN FOLDER ----------------------------------------------------
     Each sheet gets a base in the neutral the map draws data in and a second
     copy in --signal held at zero, so the read-through beat animates one
     opacity per sheet and never has to decide what colour a sheet is.

     IT FANS FORWARD AND LEFT, which is not a taste decision. A step emits its
     name from the middle of its back edge at the height it reaches, and a
     stack fanned the other way puts its topmost sheet exactly under the first
     letter of "C4 · Basecall and demultiplex". Leaning it into the open ground
     the other way clears the name by the width of a sheet. */
  const x0=n.x-n.w*0.06, y0=n.y+n.d*0.06;
  const dx=-n.w*0.045, dy=n.d*0.045, dz=n.h*0.14, Z0=n.h*1.05;
  const lit=[];
  for(let k=0;k<SHEETS;k++){
    const pt=topAt(x0+k*dx, y0+k*dy, n.w*0.50, n.d*0.50, Z0+k*dz);
    g.appendChild(el("polygon",{points:pt,fill:"var(--fg2)","fill-opacity":".14",
      stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":".5"}));
    const L=el("polygon",{points:pt,fill:"var(--signal)","fill-opacity":"0"});
    g.appendChild(L); lit.push(L);
  }
  const mouth=P(x0+(SHEETS-1)*dx, y0+(SHEETS-1)*dy, Z0+(SHEETS-1)*dz+n.h*0.30);

  /* ---- EIGHT FILES, IN FRONT ---------------------------------------------
     Two rows of four on the near ground, which is the only clear screen this
     station has: the row ends here, so there is nothing to the right, and the
     name runs off the back edge the way every station's does. */
  const file=[];
  for(let k=0;k<NSUB;k++){
    const i=k%COLS, j=(k/COLS)|0;
    const c={x:n.x+(i-(COLS-1)/2)*n.w*0.44, y:n.y+n.d*(1.20+j*0.44),
             w:n.w*0.30, d:n.d*0.24, h:n.h*0.22};
    const f=faces(c.x,c.y,c.w,c.d,c.h);
    g.appendChild(el("polygon",{points:f.top,fill:"none",stroke:"var(--stroke)",
      "stroke-width":".7","stroke-opacity":".45"}));
    /* born with the slot's own geometry and no colour: the ticker owns one
       opacity per file and never has to work out where a file was */
    const parts=["left","right","top"].map(kk=>{
      const p=el("polygon",{points:f[kk],fill:SUBHUE(k,NSUB),"fill-opacity":"0",
        stroke:"var(--stroke)","stroke-width":".7","stroke-opacity":"0"});
      g.appendChild(p); return p;
    });
    file.push({parts, top:P(c.x,c.y,c.h)});
  }
  const FAN=file.map((f,k)=>flowLine(g,mouth,f.top,SUBHUE(k,NSUB),SC));

  /* ---- TIMING -------------------------------------------------------------
     Reading the folder is one long beat and writing the eight is a longer one;
     WIN is how much of the write beat one file occupies, a little under half,
     so several are in the air at once and eight writes read as one pass rather
     than as eight things taking turns. */
  const CONV=1.7, SPLIT=2.6, HOLD=1.9, CLEAR=0.9, WIN=0.40;
  const t1=CONV, t2=t1+SPLIT, t3=t2+HOLD, t4=t3+CLEAR;
  const DIM=0.05, LIVE=0.16;
  const setFile=(k,v)=>file[k].parts.forEach(p=>{
    p.setAttribute("fill-opacity",(0.92*v).toFixed(2));
    p.setAttribute("stroke-opacity",(0.50*v).toFixed(2)); });

  /* THE CLOCK DOES NOT START AT ZERO. A browser asking for reduced motion never
     advances it, so whatever t begins at is the whole station for that reader —
     and zero is a stack nobody has opened yet. Half way through the write beat
     is the frame worth holding: four files down, four in the air, and one pile
     visibly becoming eight in a single look. */
  let t=CONV+SPLIT*0.55, mode=-1;
  /* every entry states the whole world it is entering rather than the delta
     from the beat before, so a frame long enough to skip one — a tab coming
     back, a step in trace mode — cannot leave the stack lit over empty slots. */
  const enter=m=>{
    mode=m;
    lit.forEach(L=>L.setAttribute("fill-opacity",m===0?"0":".42"));
    for(let k=0;k<NSUB;k++){ setFile(k, m===2?1:0); setFanLine(FAN[k], m===1?LIVE:DIM, 0); }
  };
  const run=dt=>{
    t=(t+dt)%t4;
    const m = t<t1?0 : t<t2?1 : t<t3?2 : 3;
    if(m!==mode) enter(m);

    if(m===0){                          // READ — bottom sheet to top, in order
      const u=t/CONV;
      for(let k=0;k<SHEETS;k++)
        lit[k].setAttribute("fill-opacity",
          (0.42*clamp((u-k*0.90/(SHEETS-1))/0.34)).toFixed(2));
      return;
    }
    if(m===1){                          // WRITE — one line per index, staggered
      const u=(t-t1)/SPLIT;
      for(let k=0;k<NSUB;k++){
        const f=clamp((u-k*(1-WIN)/(NSUB-1))/WIN);
        setFanLine(FAN[k],LIVE,f);
        /* the file appears as its line lands, not as it leaves: a slot filling
           before anything has reached it says the split was decided elsewhere */
        setFile(k, clamp((f-0.72)/0.28));
      }
      return;
    }
    if(m===3){                          // CLEAR
      const u=clamp((t-t3)/CLEAR);
      for(let k=0;k<NSUB;k++) setFile(k,1-u);
      lit.forEach(L=>L.setAttribute("fill-opacity",(0.42*(1-u)).toFixed(2)));
      return;
    }
    /* held: one folder read, eight files written, and not one figure anywhere
       on this instance saying how the reads divided between them */
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
