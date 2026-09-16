import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), config=require('../next.config.js');
const rewrites=await config.rewrites();
const routes=rewrites.beforeFiles;
assert(Array.isArray(routes),'Pipeline rewrites must precede Vercel directory-index matching');
assert(routes.some(r=>r.source==='/pipeline'&&r.destination==='/pipeline/viewer.html'));
assert(routes.some(r=>r.source==='/pipeline_edit'&&r.destination==='/pipeline/index.html'));
const base=process.argv[2]||'http://127.0.0.1:8765';
const viewerURL=base+(process.argv.includes('--routes')?'/pipeline':'/pipeline/viewer.html');
const manifest=JSON.parse(await readFile(new URL('../public/pipeline/published/current.json',import.meta.url)));
const published=new URL(`../public/pipeline/published/${manifest.version}/`,import.meta.url);
const provenance=JSON.parse(await readFile(new URL('layout.json',published)));
for(const [file,hash] of Object.entries(provenance.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../public/'+file,import.meta.url))).digest('hex'),hash,`Published source differs: ${file}`);
assert.equal(provenance.state.at,manifest.savedAt);
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const [name,options] of [['desktop',{viewport:{width:1600,height:1000}}],['phone',devices['iPhone 13']],['tablet',devices['iPad Pro 11']]]){
  const ctx=await browser.newContext(options),p=await ctx.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.addInitScript(()=>localStorage.setItem('pipeline.edits',JSON.stringify({offsets:{AQ:{del:true}},at:9999999999999})));
  await p.goto(viewerURL);await p.waitForFunction(()=>document.querySelector('#map').style.visibility==='visible');
  assert.equal(await p.locator('svg').count(),0);assert.equal(await p.locator('#btnEdit').count(),0);
  const matrix=()=>p.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById('map')).transform);return {k:m.a,x:m.e,y:m.f};});
  const initial=await matrix();
  // Tiny wheel movement must not jump to the old editor's .15 zoom floor.
  await p.locator('#stage').hover();await p.mouse.wheel(0,-1);await p.waitForTimeout(100);
  const nudged=await matrix();assert(nudged.k>initial.k&&nudged.k<initial.k*1.02);
  await p.locator('#fit').click();await p.waitForTimeout(70);
  assert(Math.abs((await matrix()).k-initial.k)<1e-5);
  await p.locator('#in').click();await p.waitForTimeout(70);assert((await matrix()).k>initial.k*1.3);
  const r=await p.locator('#stage').boundingBox();const x=r.x+r.width*.5,y=r.y+r.height*.5;
  const before=await matrix();await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+60,y+45,{steps:8});await p.mouse.up();await p.waitForTimeout(80);
  const after=await matrix();assert(Math.abs(after.x-before.x-60)<2);assert(Math.abs(after.y-before.y-45)<2);
  if(name!=='desktop'){
   await p.locator('#fit').click();await p.waitForTimeout(60);const beforePinch=await matrix();
   const cdp=await ctx.newCDPSession(p);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-41,y,id:1},{x:x+41,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);
   const pinched=await matrix();assert(pinched.k>beforePinch.k&&pinched.k<beforePinch.k*1.06);
  }
  await p.locator('#theme').click();await p.waitForFunction(()=>document.body.classList.contains('light'));assert((await p.locator('#map').getAttribute('src')).endsWith('/light.svg'));
  const lightCamera=await matrix();await p.locator('#theme').click();await p.waitForFunction(()=>!document.body.classList.contains('light'));assert.deepEqual(await matrix(),lightCamera);
  await p.locator('#stages').click();assert.equal(await p.locator('#list .entry').count(),manifest.stages.length);
  await p.locator('#list .entry button').first().click();assert(await p.locator('#index').isHidden());assert((await matrix()).k>initial.k);
  await p.locator('#stage').press('Home');await p.waitForTimeout(80);assert(Math.abs((await matrix()).k-initial.k)<1e-5);
  assert(!requests.some(u=>/\/api\/|pipeline-(?:data|view|shapes|fqshapes|iso)\.js/.test(u)),'Viewer loaded authoring code or state');
  const snapshot=await p.request.get(base+manifest.themes.dark);const xml=await snapshot.text();
  assert(!xml.includes('var(--'));assert(!xml.includes('class="ehandle'));assert(!xml.includes('<script'));assert(!xml.includes('foreignObject'));
  const structure=await p.evaluate(xml=>{const doc=new DOMParser().parseFromString(xml,'image/svg+xml');const world=[...doc.documentElement.children].find(e=>e.tagName==='g');return {bad:!!doc.querySelector('parsererror'),camera:world.getAttribute('transform'),viewBox:doc.documentElement.getAttribute('viewBox')};},xml);
  assert.equal(structure.bad,false);assert.equal(structure.camera,null,'Snapshot baked the editor camera into the scene');
  assert.equal(structure.viewBox,`${manifest.bounds.x} ${manifest.bounds.y} ${manifest.bounds.width} ${manifest.bounds.height}`);
  assert.deepEqual(errors,[]);console.log(`${name}: fit, wheel, pan, pinch, themes, stage navigation, published-state isolation OK`);await ctx.close();
 }
 // Failure is visible and controls cannot manipulate an unloaded scene.
 const p=await browser.newPage();await p.route('**/published/current.json',r=>r.fulfill({status:503,body:'Unavailable'}));await p.goto(viewerURL);await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('could not load'));assert(await p.locator('#fit').isDisabled());
 console.log('Manifest failure is reported; publication source hashes and saved state match.');
}finally{await browser.close();}
