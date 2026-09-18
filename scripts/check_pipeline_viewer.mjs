import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),config=require('../next.config.js');
const routes=(await config.rewrites()).beforeFiles;
assert(routes.some(r=>r.source==='/pipeline'&&r.destination==='/pipeline/viewer.html'));
assert(routes.some(r=>r.source==='/pipeline_edit'&&r.destination==='/pipeline/index.html'));
const base=process.argv[2]||'http://127.0.0.1:8765';
const url=base+(process.argv.includes('--routes')?'/pipeline':'/pipeline/viewer.html');
const manifest=JSON.parse(await readFile(new URL('../public/pipeline/published/current.json',import.meta.url)));
const published=new URL(`../public/pipeline/published/${manifest.version}/`,import.meta.url);
const provenance=JSON.parse(await readFile(new URL('layout.json',published)));
for(const [file,hash] of Object.entries(provenance.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../public/'+file,import.meta.url))).digest('hex'),hash,`Published source differs: ${file}`);
assert.equal(createHash('sha256').update(await readFile(new URL('./publish_pipeline.mjs',import.meta.url))).digest('hex'),provenance.publisherHash);
assert.equal(provenance.state.at,manifest.savedAt);assert.equal(manifest.format,4);
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [name,options] of [['desktop',{viewport:{width:1600,height:1000}}],['phone',devices['iPhone 13']],['tablet',devices['iPad Pro 11']]]){
  const context=await browser.newContext(options),p=await context.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.addInitScript(()=>localStorage.setItem('pipeline.edits',JSON.stringify({offsets:{AQ:{del:true}},at:9999999999999})));
  await p.goto(url);await p.waitForFunction(()=>window.pipelineViewerDiag?.().ready);
  const frame=p.frames().find(f=>f!==p.mainFrame()),map=frame.locator('#svg');
  const diag=()=>p.evaluate(()=>pipelineViewerDiag());
  // Mobile Chromium scales synthetic wheel deltas. Follow the measured camera
  // rather than assuming a single dispatch reaches a specific magnification.
  async function wheelTo(target){
   for(let i=0;i<16&&(await diag()).view.k<target*.98;i++){
    await p.mouse.wheel(0,-Math.log(target/(await diag()).view.k)/.0016);
    await p.waitForTimeout(60);
   }
  }
  assert.equal(await frame.locator('button:visible,aside:visible,.reader:visible,header:visible,.hint:visible,.strip:visible').count(),0);
  assert.equal(await p.locator('button').count(),0);
  const rect=await map.boundingBox();assert.equal(rect.x,0);assert.equal(rect.y,0);
  assert.equal(rect.width,options.viewport.width);assert.equal(rect.height,options.viewport.height);
  assert.equal((await diag()).nodes,manifest.nodes.length);assert.equal((await diag()).hiddenNodes,0);
  assert(await map.locator('path').count()>500);assert.equal(await map.locator('image').count(),0);
  const initial=(await diag()).view;
  await p.mouse.move(rect.width/2,rect.height/2);await p.mouse.down();await p.mouse.move(rect.width/2+63,rect.height/2+37,{steps:6});await p.mouse.up();
  const panned=(await diag()).view;assert(Math.abs(panned.x-initial.x-63)<1);assert(Math.abs(panned.y-initial.y-37)<1);
  await p.mouse.wheel(0,-1);await p.waitForTimeout(80);const nudged=(await diag()).view;
  assert(nudged.k>panned.k&&nudged.k<panned.k*1.02,'First wheel must zoom continuously, without a minimum-zoom jump');
  if(name!=='desktop'){
   const cdp=await context.newCDPSession(p),x=rect.width/2,y=rect.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert((await diag()).view.k>nudged.k*1.4,'Pinch did not zoom');
  }
  await map.focus();await p.keyboard.press('Home');await p.waitForTimeout(50);
  const point=await frame.evaluate(()=>{const n=byId.AQ,q=P(n.x,n.y,topOf(n)/2);const m=world.getScreenCTM();return new DOMPoint(...q).matrixTransform(m).toJSON();});
  await p.mouse.move(point.x,point.y);
  await wheelTo(.45);
  assert.equal((await diag()).motionFloor,.42,'Public animation starts at a 30% lower zoom scale');
  await p.waitForFunction(()=>pipelineViewerDiag().moving&&pipelineViewerDiag().tickersRanLastFrame>0);
  const before=await frame.evaluate(()=>nodeEls.AQ.innerHTML);await p.waitForTimeout(200);
  assert.notEqual(await frame.evaluate(()=>nodeEls.AQ.innerHTML),before,'Original aquarium animation did not run');
  for(const [k,moving] of [[.419,false],[.42,true]]){
   await frame.evaluate(k=>{
    const n=byId.AQ,q=P(n.x,n.y,topOf(n)/2),r=svg.getBoundingClientRect();
    view.k=k;view.x=r.width/2-q[0]*k;view.y=r.height/2-q[1]*k;applyView();
   },k);
   await p.waitForTimeout(100);
   assert.equal((await diag()).moving,moving,`Animation gate at zoom ${k}`);
   const artwork=await frame.evaluate(()=>nodeEls.AQ.innerHTML);await p.waitForTimeout(200);
   assert.equal((await frame.evaluate(()=>nodeEls.AQ.innerHTML))!==artwork,moving,`Actual artwork motion at zoom ${k}`);
  }
  assert.equal(await frame.locator('button:visible,.reader:visible').count(),0);
  await map.focus();await p.keyboard.press('m');assert.equal((await diag()).playing,false);
  const paused=await frame.evaluate(()=>nodeEls.AQ.innerHTML);await p.waitForTimeout(100);assert.equal(await frame.evaluate(()=>nodeEls.AQ.innerHTML),paused);
  await p.keyboard.press('m');await p.waitForFunction(()=>pipelineViewerDiag().moving);
  await wheelTo(6);
  assert((await diag()).view.k>5,'Public zoom should preserve unrestricted vector detail');
  await map.focus();await p.keyboard.press('Home');await p.waitForTimeout(100);
  assert.equal((await diag()).hiddenNodes,0);
  await p.setViewportSize({width:options.viewport.width-40,height:options.viewport.height-80});
  await p.waitForTimeout(100);const resized=await map.boundingBox();assert.equal(resized.width,options.viewport.width-40);assert.equal(resized.height,options.viewport.height-80);
  assert.equal(await frame.evaluate(()=>Math.abs(dotW-svg.getBoundingClientRect().width)<.01),true);
  assert(!requests.some(u=>/\/api\//.test(u)),'Public surface contacted authoring APIs');
  assert.equal((await diag()).droppedTickers,0);assert.equal((await diag()).lastError,null);assert.deepEqual(errors,[]);
  console.log(`${name}: full-window original SVG, no peripheral UI, immediate pan/wheel/pinch, original animation, deep zoom, keyboard fit/motion, resize and draft/API isolation OK`);
  await context.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(url);await reduced.waitForFunction(()=>window.pipelineViewerDiag?.().ready);assert.equal((await reduced.evaluate(()=>pipelineViewerDiag())).playing,false);await reduced.close();
 const failure=await browser.newPage();await failure.route('**/published/current.json',r=>r.fulfill({status:503,body:'Unavailable'}));await failure.goto(url);await failure.waitForFunction(()=>document.querySelector('#status').textContent.includes('could not load'));
 console.log('Publication provenance, reduced-motion default and visible load failure OK.');
}finally{await browser.close();}
