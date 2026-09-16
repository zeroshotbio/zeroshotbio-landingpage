import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), config=require('../next.config.js');
const routes=(await config.rewrites()).beforeFiles;
assert(Array.isArray(routes),'Pipeline rewrites must precede Vercel directory-index matching');
assert(routes.some(r=>r.source==='/pipeline'&&r.destination==='/pipeline/viewer.html'));
assert(routes.some(r=>r.source==='/pipeline_edit'&&r.destination==='/pipeline/index.html'));
const base=process.argv[2]||'http://127.0.0.1:8765';
const viewerURL=base+(process.argv.includes('--routes')?'/pipeline':'/pipeline/viewer.html');
const manifest=JSON.parse(await readFile(new URL('../public/pipeline/published/current.json',import.meta.url)));
const published=new URL(`../public/pipeline/published/${manifest.version}/`,import.meta.url);
const provenance=JSON.parse(await readFile(new URL('layout.json',published)));
for(const [file,hash] of Object.entries(provenance.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../public/'+file,import.meta.url))).digest('hex'),hash,`Published source differs: ${file}`);
assert.equal(createHash('sha256').update(await readFile(new URL('./publish_pipeline.mjs',import.meta.url))).digest('hex'),provenance.publisherHash);
assert.equal(provenance.state.at,manifest.savedAt);assert.equal(manifest.format,2);
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [name,options] of [['desktop',{viewport:{width:1600,height:1000}}],['phone',devices['iPhone 13']],['tablet',devices['iPad Pro 11']]]){
  const ctx=await browser.newContext({...options,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.addInitScript(()=>{
   localStorage.setItem('pipeline.edits',JSON.stringify({offsets:{AQ:{del:true}},at:9999999999999}));
   // Compare actual computed paint/font properties before and after adoption.
   // Paired elements are the very same original drawings, including SVG defs.
   const original=Document.prototype.adoptNode;window.appearanceChecks=[];
   Document.prototype.adoptNode=function(node){
    const props=['fill','stroke','fill-opacity','stroke-opacity','opacity','font-family','font-size','font-weight'];
    if(node.tagName==='g')for(const el of [node,...node.querySelectorAll('*')]){
     if(el.closest('.ehandle,.ehit,.thandle'))continue;
     const css=node.ownerDocument.defaultView.getComputedStyle(el);
     window.appearanceChecks.push({el,values:props.map(k=>[k,css.getPropertyValue(k)])});
    }
    return original.call(this,node);
   };
  });
  await p.goto(viewerURL);await p.waitForFunction(()=>window.pipelineViewerDiag?.().ready);
  const visual=await p.evaluate(()=>{

   return appearanceChecks.flatMap(({el,values})=>{const css=getComputedStyle(el);return values.filter(([k,v])=>css.getPropertyValue(k)!==v).map(([k,v])=>({tag:el.tagName,key:k,was:v,now:css.getPropertyValue(k)}));});
  });
  assert.deepEqual(visual,[],'Paint/font differs from original drawing engine');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.waitForFunction(()=>pipelineViewerDiag().minimumTickerRuns>=3);
  const diag=await p.evaluate(()=>pipelineViewerDiag());
  assert(diag.zoom<.6);assert(diag.playing);assert.equal(diag.tickers,diag.animatedTickers);assert(diag.tickers>40);assert.deepEqual(diag.errors,[]);
  assert.equal(await p.locator('#btnEdit,#stages,#index').count(),0);
  assert.equal(await p.locator('svg.node').count(),manifest.nodes.length);
  await p.locator('#motion').click();await p.waitForTimeout(100);
  const art=await p.locator('#nodes').innerHTML();await p.waitForTimeout(150);assert.equal(await p.locator('#nodes').innerHTML(),art,'Paused drawings kept moving');
  const matrix=()=>p.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById('node-camera')).transform);return {k:m.a,x:m.e,y:m.f};});
  const initial=await matrix();
  await p.locator('#stage').hover();await p.mouse.wheel(0,-1);await p.waitForTimeout(100);
  const nudged=await matrix();assert(nudged.k>initial.k&&nudged.k<initial.k*1.02);
  await p.locator('#fit').click();await p.waitForTimeout(70);assert(Math.abs((await matrix()).k-initial.k)<1e-5);
  await p.locator('#in').click();await p.waitForTimeout(70);assert((await matrix()).k>initial.k*1.3);
  const r=await p.locator('#stage').boundingBox();const x=r.x+r.width*.5,y=r.y+r.height*.5;
  const before=await matrix();await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+60,y+45,{steps:8});await p.mouse.up();await p.waitForTimeout(80);
  const after=await matrix();assert(Math.abs(after.x-before.x-60)<2);assert(Math.abs(after.y-before.y-45)<2);assert.equal((await p.evaluate(()=>pipelineViewerDiag())).selected,null);
  if(name!=='desktop'){
   await p.locator('#fit').click();await p.waitForTimeout(60);const beforePinch=await matrix();
   const cdp=await ctx.newCDPSession(p);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-41,y,id:1},{x:x+41,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);
   const pinched=await matrix();assert(pinched.k>beforePinch.k&&pinched.k<beforePinch.k*1.06);assert.equal((await p.evaluate(()=>pipelineViewerDiag())).selected,null);
  }
  await p.locator('#fit').click();await p.waitForTimeout(70);
  // Find painted aquarium geometry, rather than an SVG island's empty corner.
  const point=await p.evaluate(()=>{const el=document.querySelector('[data-node="AQ"]'),b=el.querySelector('.node-hit').getBoundingClientRect();const x=b.left+b.width/2,y=b.top+b.height/2;return document.elementFromPoint(x,y)?.closest('[data-node]')===el?{x,y}:null;});
  assert(point,'Aquarium must be hit-testable at the fitted view');
  if(name==='desktop')await p.mouse.click(point.x,point.y);else await p.touchscreen.tap(point.x,point.y);
  await p.waitForFunction(()=>pipelineViewerDiag().selected==='AQ');assert(await p.locator('#reader').isVisible());assert.equal(await p.locator('#read .title').textContent(),'The aquarium');
  const reader=await p.locator('#reader').boundingBox();assert(Math.abs(reader.x+reader.width-options.viewport.width)<2,'Reader must be on the right');
  const originalHTML=await p.evaluate(()=>document.querySelector('iframe').contentWindow.pipelinePresentation.readNode('AQ'));assert.equal(await p.locator('#read').innerHTML(),originalHTML);
  await p.locator('#close-reader').click();await p.locator('[data-node="c1"]').focus();await p.keyboard.press('Enter');assert(await p.locator('#reader').isVisible());assert((await p.locator('#read').textContent()).includes('modelled, not measured'));
  await p.locator('#theme').click();await p.waitForFunction(()=>document.body.classList.contains('light'));assert((await p.locator('#background').getAttribute('src')).endsWith('/light-background.svg'));
  assert.equal(await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--water').trim()),'#3a6ea8');
  const lightCamera=await matrix();await p.locator('#theme').click();await p.waitForFunction(()=>!document.body.classList.contains('light'));assert.deepEqual(await matrix(),lightCamera);
  const runs=(await p.evaluate(()=>pipelineViewerDiag())).minimumTickerRuns;
  await p.locator('#motion').click();await p.waitForFunction(n=>pipelineViewerDiag().minimumTickerRuns>n+2,runs);
  assert.notEqual(await p.locator('#nodes').innerHTML(),art);assert.deepEqual((await p.evaluate(()=>pipelineViewerDiag())).errors,[]);
  assert(!requests.some(u=>/\/api\//.test(u)),'Viewer contacted editing/prompt API');
  assert(!requests.some(u=>/\/pipeline\/pipeline-(?:data|view|shapes|fqshapes|iso)\.js/.test(u)),'Viewer loaded unversioned shape code');
  const snapshot=await p.request.get(base+manifest.themes.dark.background);const xml=await snapshot.text();
  assert(!xml.includes('var(--'));assert(!xml.includes('class="ehandle'));assert(!xml.includes('<script'));assert(!xml.includes('foreignObject'));
  const structure=await p.evaluate(xml=>{const doc=new DOMParser().parseFromString(xml,'image/svg+xml');const world=[...doc.documentElement.children].find(e=>e.tagName==='g');return {bad:!!doc.querySelector('parsererror'),camera:world.getAttribute('transform'),viewBox:doc.documentElement.getAttribute('viewBox')};},xml);
  assert.equal(structure.bad,false);assert.equal(structure.camera,null);assert.equal(structure.viewBox,`${manifest.bounds.x} ${manifest.bounds.y} ${manifest.bounds.width} ${manifest.bounds.height}`);
  assert.deepEqual(errors,[]);console.log(`${name}: all ${diag.tickers} animations below old zoom cutoff, original paint/fonts and reader, tap/click, pause/resume, pan/pinch, themes, published-state isolation OK`);await ctx.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(viewerURL);await reduced.waitForFunction(()=>window.pipelineViewerDiag?.().ready);assert.equal((await reduced.evaluate(()=>pipelineViewerDiag())).playing,false);await reduced.locator('#motion').click();await reduced.waitForFunction(()=>pipelineViewerDiag().minimumTickerRuns>0);await reduced.close();
 const p=await browser.newPage();await p.route('**/published/current.json',r=>r.fulfill({status:503,body:'Unavailable'}));await p.goto(viewerURL);await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('could not load'));assert(await p.locator('#fit').isDisabled());
 console.log('Reduced-motion preference and explicit Play work; manifest failure is reported; publication source hashes and saved state match.');
}finally{await browser.close();}
