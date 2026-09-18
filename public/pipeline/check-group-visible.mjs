/* Select the visible roofs in the saved layout, then drag both artwork and
   labels. All API requests are stubbed; this never changes the shared layout.
   Usage: node check-group-visible.mjs <editor URL> [saved-record.json] */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const fixture=JSON.parse(fs.readFileSync(process.argv[3]||new URL('./published/7543c2ae2e582d1a8cc9/layout.json',import.meta.url)));
const state=fixture.state||fixture;
const browser=await chromium.launch({args:['--no-sandbox']});
try{
  for(const touch of [false,true]){
    const context=await browser.newContext({viewport:{width:1700,height:1000},hasTouch:touch});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let saved=null;
    await page.route('**/api/pipeline_edits',r=>{
      if(r.request().method()==='POST'){
        saved=JSON.parse(r.request().postData());
        return r.fulfill({json:{ok:true,at:state.at+1000}});
      }
      return r.fulfill({json:state});
    });
    await page.route('**/api/pipeline_prompts*',r=>r.fulfill({json:{}}));
    await page.goto(process.argv[2]||'http://127.0.0.1:8765/pipeline/index.html',{waitUntil:'networkidle'});
    await page.waitForTimeout(3500);
    await page.locator('#btnEdit').click();
    const cdp=touch?await context.newCDPSession(page):null;
    async function drag(a,b){
      if(touch){
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
        for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{
        await page.mouse.move(a.x,a.y);await page.mouse.down();
        await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
      }
    }
    const chosen=()=>page.evaluate(()=>NODES.filter(n=>nodeEls[n.id].classList.contains('chosen')).map(n=>n.id));
    const positions=()=>page.evaluate(()=>Object.fromEntries(NODES.map(n=>[n.id,[n.x,n.y,n._lx,n._ly]])));
    const focus=async(id,label=false)=>page.evaluate(({id,label})=>{
      anim=null; playing=false;
      const n=byId[id], q=P(n.x,n.y,topOf(n));
      if(label){
        const e=labelEls[id].querySelector('.ehit'), r=e.getBBox();
        const t=new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(world.getScreenCTM().inverse().multiply(e.getScreenCTM()));
        q[0]=t.x;q[1]=t.y;
      }
      const r=svg.getBoundingClientRect();
      view={k:.7,x:r.width/2-q[0]*.7,y:r.height/2-q[1]*.7};applyView();
    },{id,label});
    const roofBox=id=>page.evaluate(id=>{
      const n=byId[id], m=world.getScreenCTM();
      return [-.3,.3].map(d=>{
        const q=P(n.x+d,n.y+d,topOf(n)), p=new DOMPoint(...q).matrixTransform(m);
        return {x:p.x,y:p.y};
      });
    },id);

    // The box visibly covers a roof, but never touches its ground-plane centre.
    await focus('FQ');await page.locator('#btnGroup').click();
    let ends=await roofBox('FQ');await drag(...ends);
    assert.ok((await chosen()).includes('FQ'),'a box over the visible roof must select FQ');
    assert.equal(saved,null,'selection alone must not save');
    await focus('E2');await page.locator('#btnGroup').click();
    await page.keyboard.down('Shift');
    ends=await roofBox('E2');
    // Touch modifier support is not needed: gather a second node by tapping it.
    if(touch){
      await page.locator('#btnGroup').click();
      const a={x:(ends[0].x+ends[1].x)/2,y:(ends[0].y+ends[1].y)/2};
      await page.touchscreen.tap(a.x,a.y);
    }else await drag(...ends);
    await page.keyboard.up('Shift');
    const ids=await chosen();
    assert.ok(ids.includes('FQ')&&ids.includes('E2'),'both objects remain selected');
    const initial=await positions();

    for(const label of [false,true]){
      await focus('FQ',label);
      const q=await page.evaluate(label=>{
        let p;
        if(label){const e=labelEls.FQ.querySelector('.ehit'), r=e.getBBox();
          p=new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(e.getScreenCTM());
          if(!labelEls.FQ.contains(document.elementFromPoint(p.x,p.y))) throw Error('label gesture must hit the visible label');
        }else{const n=byId.FQ;p=new DOMPoint(...P(n.x,n.y,topOf(n))).matrixTransform(world.getScreenCTM());}
        return {x:p.x,y:p.y};
      },label);
      const before=await positions();await drag(q,{x:q.x+65,y:q.y+25});
      const after=await positions(), d=after.FQ.slice(0,2).map((v,i)=>v-before.FQ[i]);
      assert.ok(Math.hypot(...d)>.2,`${label?'label':'artwork'} drag must move the group`);
      for(const id of Object.keys(before)){
        for(let i=0;i<2;i++) assert.ok(Math.abs(after[id][i]-before[id][i]-(ids.includes(id)?d[i]:0))<1e-9,`${id}: preserve group spacing and spare outsiders`);
        assert.deepEqual(after[id].slice(2),before[id].slice(2),'group movement must not detach labels');
      }
    }
    // Reselect the moved roof: hit geometry must follow transforms.
    await focus('FQ');await page.locator('#btnGroup').click();
    ends=await roofBox('FQ');await drag(...ends);
    assert.ok((await chosen()).includes('FQ'),'moved artwork stays selectable');
    await page.locator('#btnSave').click();await page.waitForTimeout(1000);
    const final=await positions();
    for(const id of ids){
      for(const [i,key] of ['dx','dy'].entries()){
        const expected=Math.round(((state.offsets[id]?.[key]||0)+final[id][i]-initial[id][i])*100)/100;
        assert.ok(Math.abs((saved?.offsets?.[id]?.[key]||0)-expected)<.001,`${id} ${key} saves the actual group movement`);
      }
    }
    assert.deepEqual(errors,[]);
    console.log(`${touch?'Touch':'Mouse'}: saved-layout roofs select; artwork and labels drag the group; moved nodes reselect and save`);
    await context.close();
  }
}finally{await browser.close();}
