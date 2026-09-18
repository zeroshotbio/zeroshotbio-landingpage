/* The attrition grip belongs on the visible 100% label, not RIVER's nominal
   node centre. Browser gestures use a saved layout; all API writes are stubbed.
   node check-attrition-handle.mjs <editor URL> [saved-record.json] */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Pin the starting layout where 100% is unobstructed by neighbouring nodes.
const fixture=JSON.parse(fs.readFileSync(process.argv[3]||new URL('./published/598573f68d24b394588d/layout.json',import.meta.url)));
const state=fixture.state||fixture;
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const touch of [false,true]){
  const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:touch});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let saved=null,record=state;
  await page.route('**/api/pipeline_edits',r=>{
   if(r.request().method()==='POST'){
    saved=JSON.parse(r.request().postData());record={...state,...saved,at:state.at+1000};
    return r.fulfill({json:{ok:true,at:record.at}});
   }
   return r.fulfill({json:record});
  });
  await page.route('**/api/pipeline_prompts*',r=>r.fulfill({json:{}}));
  await page.goto(process.argv[2]||'http://127.0.0.1:8765/pipeline/index.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(3500);
  await page.evaluate(()=>{
   anim=null;playing=false;
   const e=nodeEls.RIVER.querySelector('[data-edit-anchor]'),b=e.getBBox();
   const p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(world.getCTM().inverse().multiply(e.getCTM()));
   const r=svg.getBoundingClientRect();view={k:.8,x:r.width/2-p.x*.8,y:r.height/2-p.y*.8};applyView();
  });
  const handle=page.locator('[aria-label="Attrition"] > .ehandle');
  assert.equal(await handle.isVisible(),false,'grip is hidden outside edit mode');
  await page.locator('#btnEdit').click();assert.equal(await handle.isVisible(),true);
  const locate=()=>page.evaluate(()=>{
   const g=nodeEls.RIVER,e=g.querySelector('[data-edit-anchor]'),b=e.getBBox();
   const p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(e.getScreenCTM());
   return {x:p.x,y:p.y,hitsGrip:document.elementFromPoint(p.x,p.y)===g.querySelector(':scope > .ehandle')};
  });
  const start=await locate();assert.equal(start.hitsGrip,true,'the 100% text is inside the actual drag target');
  if(!touch) await page.screenshot({path:'/tmp/pipeline-attrition-grip.png'});
  const before=await page.evaluate(()=>Object.fromEntries(NODES.map(n=>[n.id,[n.x,n.y]])));
  if(touch){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});
   for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+65*i/8,y:start.y+35*i/8,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(start.x+65,start.y+35,{steps:10});await page.mouse.up();
  }
  const end=await locate();assert.equal(end.hitsGrip,true,'grip follows the 100% label after dragging');
  assert.ok(Math.abs(end.x-start.x-65)<2&&Math.abs(end.y-start.y-35)<2,`dragging 100% moves the drawing (actual delta ${end.x-start.x}, ${end.y-start.y})`);
  const after=await page.evaluate(()=>Object.fromEntries(NODES.map(n=>[n.id,[n.x,n.y]])));
  for(const id of Object.keys(before)) if(id!=='RIVER') assert.deepEqual(after[id],before[id],`${id} does not move`);
  await page.locator('#btnGroup').click();
  await page.mouse.move(end.x-12,end.y-12);await page.mouse.down();
  await page.mouse.move(end.x+12,end.y+12,{steps:5});await page.mouse.up();
  assert.equal(await page.evaluate(()=>nodeEls.RIVER.classList.contains('chosen')),true,'group selection finds the new grip');
  const drawing=()=>page.evaluate(()=>{
   const e=nodeEls.RIVER.querySelector('[data-edit-anchor]'),b=e.getBBox();
   const p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(world.getCTM().inverse().multiply(e.getCTM()));
   return [p.x,p.y];
  });
  const placed=await drawing();
  await page.locator('#btnSave').click();await page.waitForTimeout(1000);
  for(const [i,key] of ['dx','dy'].entries()){
   const expected=Math.round(((state.offsets.RIVER?.[key]||0)+after.RIVER[i]-before.RIVER[i])*100)/100;
   assert.equal(saved?.offsets?.RIVER?.[key],expected,'the drag saves the expected offset');
  }
  await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(3500);
  const restored=await drawing();
  assert.ok(Math.hypot(restored[0]-placed[0],restored[1]-placed[1])<.6,'the drawing stays where it was placed after save and reload');
  assert.deepEqual(errors,[]);
  console.log(`${touch?'Touch':'Mouse'}: 100% grip moves the diagram, follows it, group-selects, saves and restores the actual drawing`);
  await page.close();
 }
}finally{await browser.close();}
