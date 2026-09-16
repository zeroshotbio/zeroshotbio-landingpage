/* Guided navigation over the editor's original SVG, with section-local clocks.
   No animation loop runs in the overview. Inactive sections never tick. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),stage=$('stage'),svg=$('map');
  const canvas=$('dots'),ctx=canvas.getContext('2d'),reader=$('reader');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),NS='http://www.w3.org/2000/svg';
  const WAVE_SECONDS=4,RAMP_SECONDS=1.8,TRANSITION_MS=650;
  let engine,ready=false,active=null,selected=null,transition=null,phase='loading';
  let width=1,height=1,view={x:0,y:0,k:1},fitted=true,dirty=true;
  let raf=0,last=0,elapsed=0,cursor=0,frames=0,playing=!reduced.matches,manualMotion=false;
  const clocks=new Map(),buttons=[],errors=[],pointers=new Map();
  let gesture=null,tap=null;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function speed(progress){return smooth((elapsed-progress*WAVE_SECONDS)/RAMP_SECONDS);}
  function requestDraw(){if(!raf)raf=requestAnimationFrame(frame);}
  function changed(){dirty=true;requestDraw();}
  function target(index){
    const b=index===null?engine.overviewBounds:engine.sections[index].bounds;
    const mobile=width<=700;
    const left=index===null&&!mobile?130:26,right=26,top=32;
    const bottom=index===null?(mobile?230:42):100;
    const k=Math.min(Math.max(20,width-left-right)/b.width,Math.max(20,height-top-bottom)/b.height);
    return {k,x:left+(width-left-right-b.width*k)/2-b.x*k,y:top+(height-top-bottom-b.height*k)/2-b.y*k};
  }
  function fit(){if(!ready)return;transition=null;view=target(active);fitted=true;phase=active===null?'overview':'section';changed();}
  function closeReader(){
    if(selected)engine.nodeEls[selected].style.filter='';
    selected=null;reader.hidden=true;
  }
  function showNode(id){
    if(active===null||phase!=='section')return;
    closeReader();selected=id;
    $('read').innerHTML=engine.readNode(id);$('read').scrollTop=0;reader.hidden=false;
    engine.nodeEls[id].style.filter='drop-shadow(0 0 4px var(--signal)) drop-shadow(0 0 11px var(--signal)) brightness(1.08)';
  }
  function updateControls(){
    const overview=active===null;
    document.body.classList.toggle('detail',!overview);
    for(const id of ['overview','fit','motion'])$(id).hidden=overview;
    $('fit').disabled=phase==='transition';
    $('motion').disabled=phase==='transition';
    $('motion').textContent=playing?'Pause motion':'Play motion';
    $('motion').setAttribute('aria-pressed',String(!playing));
    $('section-title').textContent=overview?'Choose a section':`${active+1} / ${engine.sections.length} · ${engine.sections[active].name}`;
    $('hint').textContent=overview?'Choose a section to follow its production line':'Drag to pan · Scroll or pinch to zoom · Click a node to read';
    $('section-buttons').hidden=!overview||!!transition;
    stage.setAttribute('aria-label',overview?'Pipeline overview. Choose a section.':`${engine.sections[active].name}. Drag to pan, scroll or pinch to zoom, click a node to read.`);
  }
  function enter(index){
    if(!ready)return;
    closeReader();active=index;elapsed=0;cursor=0;last=0;fitted=true;
    pointers.clear();gesture=null;tap=null;stage.classList.remove('dragging');
    engine.setSection(index);
    // Discard undelivered work so revisiting a section starts with a new ramp.
    for(const clock of clocks.values())clock.delivered=clock.time;
    const to=target(index);
    phase='transition';transition={from:{...view},to,start:performance.now(),duration:reduced.matches?0:TRANSITION_MS};
    if(index!==null){const next=engine.sections[index+1];$('next').textContent=next?`Next: ${next.name} →`:'Return to all sections ↗';}
    $('next').hidden=true;updateControls();changed();
  }
  function animateCamera(now){
    if(!transition)return;
    const p=transition.duration?Math.min(1,(now-transition.start)/transition.duration):1;
    const t=smooth(p),a=transition.from,b=transition.to;
    // Interpolate world focus and geometric scale, as in the editor camera.
    const k=a.k*Math.pow(b.k/a.k,t);
    const fx=(width/2-a.x)/a.k*(1-t)+(width/2-b.x)/b.k*t;
    const fy=(height/2-a.y)/a.k*(1-t)+(height/2-b.y)/b.k*t;
    view={k,x:width/2-fx*k,y:height/2-fy*k};dirty=true;
    if(p===1){transition=null;phase=active===null?'overview':'section';elapsed=0;last=now;updateControls();}
  }
  function resize(){
    const r=stage.getBoundingClientRect(),oldW=width,oldH=height;
    width=r.width;height=r.height;
    const dpr=Math.min(1.5,devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    if(!ready)return;
    if(transition){transition.from={...view};transition.to=target(active);transition.start=performance.now();}
    else if(fitted)view=target(active);
    else{view.x+=(width-oldW)/2;view.y+=(height-oldH)/2;}
    changed();
  }
  function zoom(next,cx=width/2,cy=height/2){
    if(active===null||transition||!Number.isFinite(next))return;
    next=Math.max(target(active).k*.35,next);
    view.x=cx-(cx-view.x)*next/view.k;view.y=cy-(cy-view.y)*next/view.k;view.k=next;
    fitted=false;changed();
  }
  function positionControls(){
    const project=([x,y])=>({x:view.x+x*view.k,y:view.y+y*view.k});
    buttons.forEach((button,i)=>{
      const p=project(engine.sections[i].entry);
      button.style.left=Math.max(button.offsetWidth+8,Math.min(width-8,p.x-12))+'px';
      button.style.top=Math.max(26,Math.min(height-40,p.y))+'px';
    });
    if(active!==null&&!transition){
      const p=project(engine.sections[active].end),next=$('next');
      next.hidden=p.x<0||p.x>width||p.y<0||p.y>height;
      const half=next.offsetWidth/2+10;
      next.style.left=Math.max(half,Math.min(width-half,p.x))+'px';
      next.style.top=Math.max(8,Math.min(height-next.offsetHeight-34,p.y+32))+'px';
    }else $('next').hidden=true;
  }
  function drawDots(dt){
    ctx.clearRect(0,0,width,height);
    const palette=getComputedStyle(document.body);ctx.strokeStyle=palette.getPropertyValue('--bg').trim();
    const dots=active===null?engine.dots:engine.sections[active].dots;
    for(const r of dots){
      const progress=active===null?0:(engine.sections[active].progress[r.e.a]??1);
      if(dt)r.t=(r.t+r.speed*dt*speed(progress))%1;
      const want=r.t*r.e.len;
      const seg=r.e.segs.find(s=>want<=s.at+s.l)||r.e.segs.at(-1);
      const f=seg.l?(want-seg.at)/seg.l:0,wx=seg.from[0]+seg.dx*f,wy=seg.from[1]+seg.dy*f;
      if(r.hidden||engine.insideSil(wx,wy))continue;
      const x=view.x+wx*view.k,y=view.y+wy*view.k;
      if(x<-6||x>width+6||y<-6||y>height+6)continue;
      ctx.globalAlpha=r.e.carry?(r.e.carry==='out'?1-r.t:r.t):1;
      ctx.fillStyle=r.rgb||palette.getPropertyValue('--signal').trim();ctx.lineWidth=.5*view.k;
      ctx.beginPath();ctx.arc(x,y,(r.faint?1.5:1.75)*view.k,0,Math.PI*2);ctx.fill();
      if(.5*view.k>.35)ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  function tick(dt){
    const section=engine.sections[active],ticks=section.ticks;
    elapsed+=dt;
    for(const fn of ticks){const clock=clocks.get(fn);clock.speed=speed(section.progress[fn.__n.id]||0);clock.time+=dt*clock.speed;}
    const started=performance.now();
    for(let i=0;i<ticks.length;i++){
      const fn=ticks[cursor%ticks.length];cursor=(cursor+1)%ticks.length;
      const clock=clocks.get(fn),delta=clock.time-clock.delivered;
      if(delta<=0||clock.error)continue;
      try{fn(Math.min(.25,delta),clock.time*1000,1);clock.runs++;clock.delivered=clock.time;}
      catch(e){clock.error=String(e);errors.push(String(e));console.error(e);}
      if(performance.now()-started>=7)break;
    }
  }
  function frame(now){
    raf=0;if(!ready)return;frames++;
    const dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
    const wasTransition=!!transition;animateCamera(now);
    const moving=active!==null&&!transition&&!wasTransition&&playing&&!document.hidden;
    if(moving)tick(dt);
    if(dirty){engine.world.setAttribute('transform',`translate(${view.x},${view.y}) scale(${view.k})`);positionControls();}
    if(dirty||moving)drawDots(moving?dt:0);
    dirty=false;
    if(transition||(active!==null&&playing&&!document.hidden))requestDraw();
  }
  function local(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function startGesture(){
    const p=[...pointers.values()];
    if(p.length>=2){const [a,b]=p;gesture={count:2,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),...view};if(tap)tap.moved=true;}
    else if(p.length)gesture={count:1,cx:p[0].x,cy:p[0].y,...view};
    else gesture=null;
    stage.classList.toggle('dragging',p.length>0&&active!==null);
  }
  stage.addEventListener('pointerdown',e=>{
    if(!ready||transition||e.button>0||e.target.closest('button'))return;
    e.preventDefault();stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);
    const p=local(e),target=e.target.closest('[data-section]');
    if(!pointers.size)tap={...p,section:target?Number(target.dataset.section):null,node:e.target.closest('[data-node]')?.dataset.node,moved:false};
    pointers.set(e.pointerId,p);startGesture();
  });
  stage.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    const p=local(e);if(tap&&Math.hypot(p.x-tap.x,p.y-tap.y)>6)tap.moved=true;
    pointers.set(e.pointerId,p);if(active===null)return;
    const points=[...pointers.values()],g=gesture;
    if(points.length>=2&&g.count===2){
      const [a,b]=points,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      const k=Math.max(target(active).k*.35,g.k*Math.hypot(a.x-b.x,a.y-b.y)/g.d);
      view={k,x:cx-(g.cx-g.x)*k/g.k,y:cy-(g.cy-g.y)*k/g.k};
    }else view={k:g.k,x:g.x+points[0].x-g.cx,y:g.y+points[0].y-g.cy};
    fitted=false;changed();
  });
  function endGesture(e){
    if(!pointers.delete(e.pointerId))return;
    const action=!pointers.size&&tap&&!tap.moved&&e.type==='pointerup'?tap:null;
    if(!pointers.size)tap=null;startGesture();
    if(action){if(active===null&&action.section!==null)enter(action.section);else if(action.node)showNode(action.node);}
  }
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,endGesture);
  stage.addEventListener('wheel',e=>{
    if(e.target.closest('button'))return;e.preventDefault();
    const p=local(e),unit=e.deltaMode===1?16:e.deltaMode===2?height:1;
    zoom(view.k*Math.exp(-Math.max(-300,Math.min(300,e.deltaY*unit))*.0016),p.x,p.y);
  },{passive:false});
  document.addEventListener('keydown',e=>{
    if(!ready)return;
    if(e.key==='Escape'){if(!reader.hidden)closeReader();else enter(null);return;}
    const node=e.target.closest('[data-node]');
    if(node&&['Enter',' '].includes(e.key)){
      e.preventDefault();if(active===null)enter(Number(node.dataset.section));else showNode(node.dataset.node);return;
    }
    if(e.target!==stage&&e.target!==document.body)return;
    if(['Home','0'].includes(e.key))enter(null);
    else if(active!==null&&!transition){
      if(['+','='].includes(e.key))zoom(view.k*1.4);
      else if(e.key==='-')zoom(view.k/1.4);
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        view.x+=e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0;
        view.y+=e.key==='ArrowUp'?80:e.key==='ArrowDown'?-80:0;fitted=false;changed();
      }else return;
    }else return;
    e.preventDefault();
  });
  $('overview').onclick=()=>enter(null);$('fit').onclick=fit;
  $('next').onclick=()=>enter(active+1<engine.sections.length?active+1:null);
  $('close-reader').onclick=()=>{closeReader();stage.focus({preventScroll:true});};
  $('motion').onclick=()=>{manualMotion=true;playing=!playing;last=0;updateControls();requestDraw();};
  $('theme').onclick=()=>{
    const light=document.body.classList.toggle('light');engine.setTheme(light);
    $('theme').textContent=light?'Dark':'Light';changed();
  };
  $('read').addEventListener('click',async e=>{
    const button=e.target.closest('.copybtn');if(!button)return;
    try{await navigator.clipboard.writeText(engine.payload(button.dataset.copy).replace(/^\n+/,''));button.querySelector('.tx').textContent='Copied to clipboard';}
    catch{button.querySelector('.tx').textContent='Clipboard unavailable';}
  });
  reduced.addEventListener('change',()=>{if(!manualMotion){playing=!reduced.matches;last=0;if(ready)updateControls();requestDraw();}});
  document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)requestDraw();});
  async function init(){
    try{
      const response=await fetch('/pipeline/published/current.json',{cache:'no-cache'});
      if(!response.ok)throw Error('manifest');const manifest=await response.json();
      if(manifest.format!==3)throw Error('snapshot format');
      await new Promise((resolve,reject)=>{
        const link=document.createElement('link');link.rel='stylesheet';link.href=manifest.appearance;link.onload=resolve;link.onerror=reject;document.head.append(link);
      });
      const iframe=document.createElement('iframe');iframe.className='engine-frame';iframe.tabIndex=-1;
      iframe.setAttribute('aria-hidden','true');iframe.title='Published drawing engine';
      await new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=reject;iframe.src=manifest.engine;document.body.append(iframe);});
      engine=iframe.contentWindow.pipelinePresentation;if(!engine)throw Error('drawing engine');
      svg.append(document.adoptNode(engine.definitions),document.adoptNode(engine.world));
      for(const n of engine.nodes){
        const g=engine.nodeEls[n.id];
        if(n.scenery){g.removeAttribute('tabindex');g.removeAttribute('role');continue;}
        const hit=document.createElementNS(NS,'polygon');hit.classList.add('node-hit');
        hit.setAttribute('points',engine.silhouette(n).map(p=>p.join(',')).join(' '));g.append(hit);
      }
      engine.tickers.forEach(fn=>clocks.set(fn,{time:0,delivered:0,runs:0,speed:0,error:null}));
      engine.sections.forEach((s,i)=>{
        const button=document.createElement('button');button.className='section-button';button.dataset.sectionButton=String(i);
        const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');
        button.append(number,document.createTextNode(s.name+' →'));button.onclick=()=>enter(i);
        $('section-buttons').append(button);buttons.push(button);
      });
      engine.setTheme(false);ready=true;phase='overview';$('status').textContent='';$('theme').disabled=false;
      updateControls();resize();new ResizeObserver(resize).observe(stage);requestDraw();
    }catch(e){errors.push(String(e));console.error(e);$('status').textContent='The map could not load. Please reload to try again.';}
  }
  window.pipelineViewerDiag=()=>({ready,phase,active,selected,playing,elapsed,frames,view:{...view},
    sections:engine?.sections.map(s=>({name:s.name,nodes:s.nodes.map(n=>n.id),visible:s.elements.some(r=>r.element.style.display!=='none'),
      ticks:s.ticks.map(fn=>({node:fn.__n.id,progress:s.progress[fn.__n.id],...clocks.get(fn)}))})),errors:[...errors]});
  init();
})();
