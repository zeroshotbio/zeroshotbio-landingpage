/* Canvas dots must stay registered to SVG tracks when the map resizes without
   a window resize. All API requests are stubbed; no shared layouts are edited. */
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
const url=process.argv[2]||'http://127.0.0.1:8765/pipeline/index.html';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [name,options] of [['desktop',{viewport:{width:1600,height:1000},deviceScaleFactor:1.25}],['phone',devices['iPhone 13']]]){
  const p=await browser.newPage({...options,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/**',r=>r.fulfill({json:{}}));
  await p.addInitScript(()=>localStorage.setItem('pipeline.panels',JSON.stringify({gripL:0,gripR:0})));
  await p.goto(url);await p.waitForFunction(()=>typeof DOTS!=='undefined'&&DOTS.length>0);
  async function aligned(label){
   // Let ResizeObserver deliver the actual flexbox size before inspecting ink.
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const result=await p.evaluate(()=>{
    const box=dotCanvas.getBoundingClientRect(),svgBox=svg.getBoundingClientRect();
    const arcs=[],original=dotCtx.arc;
    dotCtx.arc=function(x,y,...rest){arcs.push({x,y});return original.call(this,x,y,...rest);};
    try{placeDots(0);paintDots(true);}finally{dotCtx.arc=original;}
    const matrix=dotCtx.getTransform();let maxError=0,checked=0;
    for(const arc of arcs){
     const dot=DOTS.find(r=>Math.abs(view.x+r.x*view.k-arc.x)<1e-5&&Math.abs(view.y+r.y*view.k-arc.y)<1e-5);
     const path=dot?.e.host?.querySelector('path');if(!path)continue;
     const point=path.getPointAtLength(dot.t*path.getTotalLength());
     const expected=new DOMPoint(point.x,point.y).matrixTransform(path.getScreenCTM());
     const actual=new DOMPoint(arc.x,arc.y).matrixTransform(matrix);
     const dx=box.left+actual.x*box.width/dotCanvas.width-expected.x;
     const dy=box.top+actual.y*box.height/dotCanvas.height-expected.y;
     maxError=Math.max(maxError,Math.hypot(dx,dy));checked++;
    }
    return {checked,maxError,cssWidth:svgBox.width,logicalWidth:dotW,cssHeight:svgBox.height,logicalHeight:dotH};
   });
   assert(Math.abs(result.cssWidth-result.logicalWidth)<.01,label+': stretched canvas width');
   assert(Math.abs(result.cssHeight-result.logicalHeight)<.01,label+': stretched canvas height');
   assert(result.checked>0,label+': no track dots checked');assert(result.maxError<.2,`${label}: dots ${result.maxError}px off SVG tracks`);
   console.log(`${name}: ${label}, ${result.checked} dots within ${result.maxError.toFixed(3)}px of tracks`);
  }
  await aligned('restored closed panels');
  if(name==='desktop'){
   await p.locator('#gripL').click();await aligned('open left panel');
   await p.locator('#gripR').click();await aligned('open right panel');
   const grip=await p.locator('#gripL').boundingBox();await p.mouse.move(grip.x+grip.width/2,grip.y+100);await p.mouse.down();await p.mouse.move(grip.x+100.5,grip.y+100,{steps:5});await p.mouse.up();await aligned('drag panel wider');
  }
  const point=await p.evaluate(()=>{
   anim=null;setMotion(false,false);const r=DOTS.find(r=>!r.hid&&r.e.host&&!r.faint);
   const rect=svg.getBoundingClientRect();view.k=2;view.x=rect.width/2-r.x*view.k;view.y=rect.height/2-r.y*view.k;applyView();
   return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  });
  await aligned('zoom and pan');
  await p.mouse.click(point.x,point.y);assert.equal(await p.locator('#read .eyebrow').textContent(),'In transit','Dot click must use map-local coordinates');
  await p.setViewportSize({width:name==='desktop'?1400:430,height:900});await aligned('window resize');
  assert.deepEqual(errors,[]);await p.close();
 }
}finally{await browser.close();}
