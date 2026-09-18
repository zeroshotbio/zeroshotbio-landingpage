/* Exercise real mouse/touch gestures; all shared-state reads/writes are stubbed.
   node public/pipeline/check-group-select.mjs <editor URL> */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({args:['--no-sandbox']});
try {
  for(const touch of [false,true]){
    const context=await browser.newContext({viewport:touch?{width:1180,height:820}:{width:1700,height:1000},hasTouch:touch});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let saved=null, at=0;
    await page.route('**/api/pipeline_edits',r=>{
      if(r.request().method()==='POST'){
        saved=JSON.parse(r.request().postData()); at+=1000;
        return r.fulfill({json:{ok:true,at}});
      }
      return r.fulfill({json:{offsets:null,text:null,at:null}});
    });
    await page.route('**/api/pipeline_prompts*',r=>r.fulfill({json:{}}));
    await page.goto(process.argv[2]||'http://127.0.0.1:8765/pipeline/index.html',{waitUntil:'networkidle'});
    await page.waitForTimeout(3200);
    const button=page.locator('#btnGroup');
    assert.equal(await button.isVisible(),false,'tool is edit-only');
    await page.locator('#btnEdit').click();
    assert.equal(await button.isVisible(),true);
    await page.evaluate(()=>{
      anim=null; playing=false;
      const q=P(byId.c3.x,byId.c3.y,0), r=svg.getBoundingClientRect();
      view={k:.55,x:r.width/2-q[0]*.55,y:r.height/2-q[1]*.55}; applyView();
    });
    const cdp=touch?await context.newCDPSession(page):null;
    const contact=async(type,p)=>{
      if(touch) return cdp.send('Input.dispatchTouchEvent',{
        type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],
        touchPoints:type==='up'||type==='cancel'?[]:[{x:p.x,y:p.y,id:1}],
      });
      if(type==='down'){await page.mouse.move(p.x,p.y);await page.mouse.down();}
      else if(type==='move') await page.mouse.move(p.x,p.y,{steps:8});
      else await page.mouse.up();
    };
    const screen=xyz=>page.evaluate(([x,y,z=0])=>{
      const q=P(x,y,z), p=new DOMPoint(...q).matrixTransform(world.getScreenCTM());
      return {x:p.x,y:p.y};
    },xyz);
    const bounds=await page.evaluate(()=>[
      [byId.c1.x-1,byId.c1.y-1], [byId.c4.x+1,byId.c4.y+1],
    ]);
    const chosen=()=>page.evaluate(()=>NODES.filter(n=>nodeEls[n.id].classList.contains('chosen')).map(n=>n.id).sort());
    const positions=()=>page.evaluate(()=>Object.fromEntries(NODES.map(n=>[n.id,[n.x,n.y]])));
    const camera=()=>page.evaluate(()=>({...view}));
    const before=await positions(), cam=await camera();
    const ids=['c1','c3','c4'];
    await button.click();
    await contact('down',await screen(bounds[0]));
    await contact('move',await screen(bounds[1]));
    assert.deepEqual(await chosen(),ids,'box selects the three nodes on one diagonal row');
    const points=await page.locator('.group-marquee').evaluate(e=>Array.from(e.points,p=>[p.x,p.y]));
    for(let i=0;i<4;i++){
      const a=points[i], b=points[(i+1)%4];
      assert.ok(Math.abs(Math.abs((b[1]-a[1])/(b[0]-a[0]))-1/Math.sqrt(3))<.002,'each edge follows a grid axis');
    }
    // Keep a visual artifact of the live diagonal marquee for review.
    if(!touch) await page.screenshot({path:'/tmp/pipeline-group-select.png'});
    await contact('up');
    assert.equal(await button.getAttribute('aria-pressed'),'false','release returns to group moving');
    assert.deepEqual(await camera(),cam,'selecting cannot pan the camera');
    assert.deepEqual(await positions(),before,'selecting cannot move a node');
    assert.equal(saved,null,'selecting does not save anything');

    // Reverse the gesture at another camera scale and translation.
    await page.evaluate(()=>{
      const r=svg.getBoundingClientRect();
      view.k*=.8;view.x=r.width/2-(r.width/2-view.x)*.8+37;
      view.y=r.height/2-(r.height/2-view.y)*.8+25;applyView();
    });
    await button.click();
    await contact('down',await screen(bounds[1]));
    await contact('move',await screen(bounds[0]));
    await contact('up');
    assert.deepEqual(await chosen(),ids,'reverse drag works after pan/zoom');

    // A cancelled gesture restores the previous selection, on touch as well.
    await button.click();
    await contact('down',await screen(bounds[0]));
    await contact('move',await screen([bounds[0][0]+2,bounds[1][1]]));
    assert.deepEqual(await chosen(),['c1']);
    if(touch) await contact('cancel');
    else {await page.keyboard.press('Escape');await contact('up');}
    assert.deepEqual(await chosen(),ids,'cancellation restores the selection');
    assert.equal(await page.locator('.group-marquee').isVisible(),false);

    // Move the selected group through the existing editor gesture.
    const roof=await page.evaluate(()=>[byId.c1.x,byId.c1.y,topOf(byId.c1)]);
    const q=await screen(roof);
    await contact('down',q);
    await contact('move',{x:q.x+75,y:q.y+35});
    await contact('up');
    const after=await positions(), delta=after.c1.map((v,i)=>v-before.c1[i]);
    assert.ok(Math.hypot(...delta)>.2,'group actually moves');
    for(const id of Object.keys(before)){
      const expected=ids.includes(id)?delta:[0,0];
      for(let i=0;i<2;i++) assert.ok(Math.abs(after[id][i]-before[id][i]-expected[i])<1e-9,`${id} retains its relative position`);
    }
    await page.locator('#btnSave').click();
    await page.waitForTimeout(1800);
    for(const id of ids) assert.ok(saved?.offsets?.[id],`${id}'s offset is saved`);

    // Shift adds another box; hidden/deleted nodes cannot enter a selection.
    if(!touch){
      const extra=await page.evaluate(()=>[byId.c5.x,byId.c5.y]);
      await button.click();await page.keyboard.down('Shift');
      await contact('down',await screen(extra.map(v=>v-1)));
      await contact('move',await screen(extra.map(v=>v+1)));
      await contact('up');await page.keyboard.up('Shift');
      assert.deepEqual(await chosen(),[...ids,'c5']);
      await page.evaluate(()=>{byId.c5.gone=true;nodeEls.c5.setAttribute('display','none');});
      await button.click();
      await contact('down',await screen(extra.map(v=>v-1)));
      await contact('move',await screen(extra.map(v=>v+1)));
      await contact('up');
      assert.deepEqual(await chosen(),[],'deleted nodes are excluded');
    }
    await button.click();await page.locator('#btnEdit').click();
    assert.equal(await button.getAttribute('aria-pressed'),'false');
    assert.deepEqual(await chosen(),[],'leaving edit clears the tool and selection');
    assert.equal(await page.evaluate(()=>svg.classList.contains('group-select')),false);
    assert.deepEqual(errors,[]);
    console.log(`${touch?'Touch':'Mouse'}: diagonal selection, camera transforms, cancellation, group spacing and saving passed`);
    await context.close();
  }
} finally { await browser.close(); }
