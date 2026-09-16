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
assert.equal(provenance.state.at,manifest.savedAt);assert.equal(manifest.format,3);
assert.equal(new Set(manifest.sections.flatMap(s=>s.nodes)).size,manifest.sections.flatMap(s=>s.nodes).length);
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [name,options] of [['desktop',{viewport:{width:1600,height:1000}}],['phone',devices['iPhone 13']],['tablet',devices['iPad Pro 11']]]){
  const context=await browser.newContext(options),p=await context.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.addInitScript(()=>localStorage.setItem('pipeline.edits',JSON.stringify({offsets:{AQ:{del:true}},at:9999999999999})));
  await p.goto(url);await p.waitForFunction(()=>window.pipelineViewerDiag?.().ready);
  await p.waitForTimeout(100);
  const diag=()=>p.evaluate(()=>pipelineViewerDiag());
  const initial=await diag();assert.equal(initial.phase,'overview');assert(initial.sections.every(s=>s.visible));
  assert(initial.sections.every(s=>s.ticks.every(t=>t.runs===0)));
  assert.equal(await p.locator('#map img,#map image,#stages,#btnEdit').count(),0,'Scene must use original vector geometry');
  assert(await p.locator('#map path').count()>500);
  const still=await p.locator('#map').innerHTML();await p.waitForTimeout(180);
  assert.equal(await p.locator('#map').innerHTML(),still);assert.equal((await diag()).frames,initial.frames,'Overview must have no idle animation loop');
  await p.locator('#map').hover();await p.mouse.wheel(0,-400);await p.locator('#stage').press('+');
  const box=await p.locator('#stage').boundingBox(),x=box.width*.5,y=box.y+box.height*.5;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+55,y+30,{steps:5});await p.mouse.up();
  if(name!=='desktop'){
   const cdp=await context.newCDPSession(p);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  assert.deepEqual((await diag()).view,initial.view,'Overview camera must stay locked');
  // Every section selector must be reachable, including the small-screen layout.
  for(const button of await p.locator('.section-button').all()){
   assert(await button.isVisible());
   const reachable=await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));});
   assert(reachable,'Section selectors overlap or leave the viewport');
  }
  if(name==='desktop'){
   const point=await p.locator('[data-node="AQ"] .node-hit').evaluate(el=>{const b=el.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};});
   await p.mouse.click(point.x,point.y);
  }else await p.locator('[data-section-button="0"]').tap();
  const during=await diag();assert.equal(during.phase,'transition');assert(during.sections.every(s=>s.ticks.every(t=>t.runs===0)),'Animation began before the zoom finished');
  await p.waitForFunction(()=>pipelineViewerDiag().phase==='section');
  await p.waitForFunction(()=>pipelineViewerDiag().elapsed>.55);
  const early=await diag(),first=early.sections[0];
  const upstream=first.ticks.find(t=>t.node==='AQ'),downstream=first.ticks.find(t=>t.node==='FX');
  assert(upstream.speed>0&&upstream.speed<1);assert(upstream.time>0&&upstream.time<early.elapsed,'Virtual clock must run slower during acceleration');
  assert.equal(downstream.runs,0);assert.equal(downstream.time,0);
  assert(early.sections.slice(1).every(s=>!s.visible&&s.ticks.every(t=>t.runs===0)));
  const hiddenBefore=await p.locator('#map [data-node="RCY"]').first().innerHTML();
  await p.waitForFunction(()=>pipelineViewerDiag().elapsed>6);
  const full=await diag();assert(full.sections[0].ticks.every(t=>t.speed===1&&t.runs>0));
  assert.equal(await p.locator('#map [data-node="RCY"]').first().innerHTML(),hiddenBefore,'Inactive drawings changed');
  await p.locator('#motion').click();const paused=await diag();await p.waitForTimeout(120);assert.equal((await diag()).elapsed,paused.elapsed);
  await p.locator('#stage').focus();for(let i=0;i<12;i++)await p.keyboard.press('+');
  assert((await diag()).view.k>5,'Detailed sections must not retain the old 4x/5x zoom cap');
  await p.locator('#fit').click();await p.waitForTimeout(50);
  await p.locator('#map [data-node="AQ"][role="button"]').focus();await p.keyboard.press('Enter');
  assert(await p.locator('#reader').isVisible());assert.equal(await p.locator('#read .title').textContent(),'The aquarium');
  const reader=await p.locator('#reader').boundingBox();assert(Math.abs(reader.x+reader.width-options.viewport.width)<2);
  const expected=await p.evaluate(()=>document.querySelector('iframe').contentWindow.pipelinePresentation.readNode('AQ'));
  assert.equal(await p.locator('#read').innerHTML(),expected);
  await p.locator('#close-reader').click();await p.locator('#fit').click();
  await p.locator('#theme').click();assert.equal(await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--water').trim()),'#3a6ea8');await p.locator('#theme').click();
  await p.locator('#motion').click();
  for(let index=1;index<manifest.sections.length;index++){
   const previous=(await diag()).sections[index-1].ticks.map(t=>t.time);
   assert(await p.locator('#next').isVisible());await p.locator('#next').click();
   await p.waitForFunction(i=>{const d=pipelineViewerDiag();return d.active===i&&d.phase==='section';},index);
   await p.waitForFunction(()=>pipelineViewerDiag().elapsed>.4);
   const d=await diag();assert(d.sections.every((s,i)=>s.visible===(i===index)));
   // A final frame can happen before the click is dispatched; compare after arrival.
   const old=d.sections[index-1].ticks.map(t=>t.time);await p.waitForTimeout(80);
   assert.deepEqual((await diag()).sections[index-1].ticks.map(t=>t.time),old);
   assert(d.sections[index].ticks.filter(t=>t.progress===0).every(t=>t.runs>0));
   assert(previous.every((t,i)=>t<=old[i]));
  }
  await p.locator('#next').click();await p.waitForFunction(()=>pipelineViewerDiag().phase==='overview');
  const returned=await diag();assert.equal(returned.active,null);assert(returned.sections.every(s=>s.visible));
  await p.waitForTimeout(100);assert.deepEqual((await diag()).sections,returned.sections,'Overview kept animating after returning');
  await p.locator('[data-section-button="0"]').click();await p.locator('#overview').click();
  await p.waitForFunction(()=>pipelineViewerDiag().phase==='overview');assert.equal((await diag()).active,null);
  assert.deepEqual((await diag()).errors,[]);assert.deepEqual(errors,[]);
  assert(!requests.some(u=>/\/api\//.test(u)),'Presentation contacted editor APIs');
  console.log(`${name}: still locked overview, selectable sections, zoom then progressive clocks, inactive sections frozen, vector deep zoom, right reader, full next-section sequence, return/cancel and themes OK`);
  await context.close();
 }
 const p=await browser.newPage({reducedMotion:'reduce'});await p.goto(url);await p.waitForFunction(()=>window.pipelineViewerDiag?.().ready);
 await p.locator('[data-section-button="0"]').click();await p.waitForFunction(()=>pipelineViewerDiag().phase==='section');
 assert.equal((await p.evaluate(()=>pipelineViewerDiag())).playing,false);await p.locator('#motion').click();await p.waitForFunction(()=>pipelineViewerDiag().elapsed>.2);await p.close();
 const failure=await browser.newPage();await failure.route('**/published/current.json',r=>r.fulfill({status:503,body:'Unavailable'}));await failure.goto(url);await failure.waitForFunction(()=>document.querySelector('#status').textContent.includes('could not load'));assert(await failure.locator('#theme').isDisabled());
 console.log('Publication provenance, reduced-motion control and manifest error handling OK.');
}finally{await browser.close();}
