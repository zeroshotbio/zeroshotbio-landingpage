/* Published image viewer. No authoring scripts, SVG scene DOM, shared record,
   local editor state, polling, or continuous animation loop. */
(() => {
  'use strict';
  const stage=document.getElementById('stage'), image=document.getElementById('map');
  const status=document.getElementById('status'), panel=document.getElementById('index');
  const toggle=document.getElementById('stages'), themeButton=document.getElementById('theme');
  let manifest, theme='dark', loadToken=0, ready=false;
  let width=1,height=1,k=1,x=0,y=0,fitScale=1,pending=0,fitted=true;
  const pointers=new Map();let gesture=null;
  const controls=['fit','in','out','theme','stages'].map(id=>document.getElementById(id));
  controls.forEach(b=>b.disabled=true);
  function draw(){pending=0;image.style.transform=`translate3d(${x}px,${y}px,0) scale(${k})`;}
  function schedule(){if(!pending)pending=requestAnimationFrame(draw);}
  function fit(){if(!manifest)return;fitScale=Math.min((width-24)/manifest.bounds.width,(height-40)/manifest.bounds.height);k=fitScale;x=(width-manifest.bounds.width*k)/2;y=(height-manifest.bounds.height*k)/2;fitted=true;schedule();}
  function zoom(next,cx=width/2,cy=height/2){if(!ready)return;next=Math.max(fitScale*.65,Math.min(4,next));x=cx-(cx-x)*next/k;y=cy-(cy-y)*next/k;k=next;fitted=false;schedule();}
  function resize(){const r=stage.getBoundingClientRect(),oldW=width,oldH=height;width=r.width;height=r.height;if(fitted)fit();else{x+=(width-oldW)/2;y+=(height-oldH)/2;fitScale=Math.min((width-24)/manifest.bounds.width,(height-40)/manifest.bounds.height);schedule();}}
  function showPanel(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)document.getElementById('close').focus();else stage.focus({preventScroll:true});}
  toggle.onclick=()=>showPanel(panel.hidden);document.getElementById('close').onclick=()=>showPanel(false);
  document.getElementById('fit').onclick=fit;document.getElementById('in').onclick=()=>zoom(k*1.4);document.getElementById('out').onclick=()=>zoom(k/1.4);
  async function loadTheme(next){
    const token=++loadToken;themeButton.disabled=true;
    try{
      const preloaded=new Image();preloaded.src=manifest.themes[next];await preloaded.decode();
      if(token!==loadToken)return;
      image.src=preloaded.src;theme=next;document.body.classList.toggle('light',next==='light');
      themeButton.textContent=next==='light'?'Dark':'Light';image.style.visibility='visible';status.textContent='';ready=true;
      try{localStorage.setItem('pipeline.viewer.theme',next);}catch{}
    }catch{status.textContent='The map image could not load. Please reload to try again.';}
    finally{themeButton.disabled=false;}
  }
  themeButton.onclick=()=>loadTheme(theme==='dark'?'light':'dark');
  function local(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function startGesture(){const p=[...pointers.values()];if(p.length>=2){const a=p[0],b=p[1];gesture={count:2,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x,y,k};}else if(p.length)gesture={count:1,cx:p[0].x,cy:p[0].y,x,y,k};else gesture=null;stage.classList.toggle('dragging',p.length>0);}
  stage.addEventListener('pointerdown',e=>{if(!ready||e.button>0)return;e.preventDefault();stage.focus({preventScroll:true});stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));startGesture();});
  stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,local(e));const p=[...pointers.values()],g=gesture;if(p.length>=2&&g.count===2){const a=p[0],b=p[1],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;const next=Math.max(fitScale*.65,Math.min(4,g.k*Math.hypot(a.x-b.x,a.y-b.y)/g.d));x=cx-(g.cx-g.x)*next/g.k;y=cy-(g.cy-g.y)*next/g.k;k=next;}else{x=g.x+p[0].x-g.cx;y=g.y+p[0].y-g.cy;}fitted=false;schedule();});
  function end(e){if(pointers.delete(e.pointerId))startGesture();}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,end);
  stage.addEventListener('wheel',e=>{if(!ready)return;e.preventDefault();const p=local(e),unit=e.deltaMode===1?16:e.deltaMode===2?height:1;zoom(k*Math.exp(-Math.max(-300,Math.min(300,e.deltaY*unit))*.0016),p.x,p.y);},{passive:false});
  stage.addEventListener('dblclick',e=>{const p=local(e);zoom(k*1.8,p.x,p.y);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!panel.hidden){showPanel(false);return;}
    if(e.target!==stage&&e.target!==document.body)return;
    if(!ready)return;
    if(['Home','0'].includes(e.key))fit();else if(['+','='].includes(e.key))zoom(k*1.4);else if(e.key==='-')zoom(k/1.4);else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){x+=e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0;y+=e.key==='ArrowUp'?80:e.key==='ArrowDown'?-80:0;fitted=false;schedule();}else return;e.preventDefault();
  });
  async function init(){
    try{
      const r=await fetch('/pipeline/published/current.json',{cache:'no-cache'});if(!r.ok)throw Error('manifest');manifest=await r.json();
      if(manifest.format!==1||!manifest.bounds?.width||!manifest.themes?.dark)throw Error('format');
      image.width=manifest.bounds.width;image.height=manifest.bounds.height;
      document.title=manifest.title||'Aquarium to Atlas';
      const list=document.getElementById('list');let group;
      for(const s of manifest.stages){if(group!==s.group){group=s.group;const h=document.createElement('h2');h.textContent=group;list.append(h);}const entry=document.createElement('div');entry.className='entry';const b=document.createElement('button');b.textContent=`${s.key} · ${s.name}`;b.onclick=()=>{k=Math.max(fitScale,Math.min(.9,width/500));x=width/2-s.x*k;y=height/2-s.y*k;fitted=false;schedule();showPanel(false);};entry.append(b);const p=document.createElement('p');p.textContent=s.description;entry.append(p);list.append(entry);}
      resize();new ResizeObserver(resize).observe(stage);
      try{theme=localStorage.getItem('pipeline.viewer.theme')==='light'?'light':'dark';}catch{}
      await loadTheme(theme);controls.forEach(b=>b.disabled=!ready);
    }catch{status.textContent='The map could not load. Please reload to try again.';}
  }
  init();
})();
