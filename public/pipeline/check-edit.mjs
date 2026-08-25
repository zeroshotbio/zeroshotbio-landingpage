/* check-edit.mjs — /pipeline's Edit positions mode.
   Run: node check-edit.mjs <url>            (needs playwright)

   Two things here that nothing else catches.

   THE FLOATING LABELS DRAG ONE AT A TIME. Under-amplified and over-amplified
   are two labels on one roof naming two different tails of one cloud, and
   where each can go depends on what is under it. They are not laid out from
   world coordinates — their own shape re-places them every frame — so "moved"
   cannot mean "the element is somewhere else": the next frame puts it back.
   What moves is the nudge that placement is offset by. And the leader has to
   follow: its label end must move further than the end naming the point,
   which is the whole reason a label like this is worth being able to move.
   (Further, not "while the other stays put" — the point it names is a mark on
   an animating chart and is entitled to drift.)

   THE DOUBLE PRESS OFFERS A ✕. It is deliberately not a `dblclick` listener,
   and this check uses two separate clicks rather than mouse.dblclick for the
   same reason: the mode is built on pointer capture and preventDefault on
   pointerdown suppresses the whole compatibility mouse-event chain, `click`
   and `dblclick` included. A dblclick handler here is wired to the right
   element and never fires. Measured, after shipping one.

   Deleting asks, and Cancel is asserted as hard as Delete: it is the one
   action in this mode that does not undo itself by dragging back, and the
   saved state is shared.
*/
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1700,height:1000}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let rec=null, at=0;
await p.route('**/api/pipeline_edits',r=>{
  if(r.request().method()==='POST'){ rec=JSON.parse(r.request().postData()||'{}'); at+=1000;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,at})}); }
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({offsets:null,text:null,at:null})});});
await p.route('**/api/pipeline_prompts*',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
/* THE URL IS AN ARGUMENT, like every other check beside this one. It was
   hardcoded to production, which means it tested the deployed page and quietly
   ignored whatever was on disk — a check that cannot see your change is a
   check that passes for the wrong reason. Production stays the default. */
const url = process.argv[2] || 'https://www.zeroshot.bio/pipeline';
await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(3200);
let bad=0; const fail=m=>{bad++;console.log('  FAIL '+m);};
await p.locator('#btnEdit').click(); await p.waitForTimeout(600);

/* --- a picked node resizes: four corners for w and d, one handle for h ---

   THIS RUNS FIRST, BEFORE ANYTHING HAS BEEN DRAGGED. The annotations below get
   moved a hundred-odd pixels, and a label that lands over the node this section
   wants to pick swallows the press — the pick silently does not happen, the
   handles never appear, and the corner drag becomes a drag of whatever was
   under it. Which is exactly what it did.

   THE TARGET IS AN ANIMATED SHAPE ON PURPOSE. A resize is the only edit that
   redraws a shape, and a shape that animates pushes into TICKERS every time it
   is drawn — so a redraw that cannot say which tickers were its own leaves the
   old one running over elements that have been thrown away. The count must
   come back where it started; the failure is invisible on screen and it
   compounds. The corner is also anchored at its opposite: a resize that drifts
   the whole object is a move wearing a resize's clothes. */
const RSZ='c1';
const rszSize=id=>p.evaluate(i=>{const n=NODES.find(m=>m.id===i);
  return [n.w,n.d,n.h].map(v=>+v.toFixed(2));},id);
const rszCorner=(id,k)=>p.evaluate(([i,kk])=>{
  const n=NODES.find(m=>m.id===i), hw=n.w/2, hd=n.d/2, h=topOf(n);
  const t=kk===4?P(n.x,n.y,h)
    :P(n.x+((kk===1||kk===2)?hw:-hw), n.y+((kk===2||kk===3)?hd:-hd), h);
  const g=document.querySelector('#svg > g'), m=g.getScreenCTM();
  return {x:m.a*t[0]+m.c*t[1]+m.e, y:m.b*t[0]+m.d*t[1]+m.f};},[id,k]);

const tick0=await p.evaluate(()=>TICKERS.length);
let rp=await rszCorner(RSZ,4);   /* the top-face CENTRE: a corner may be off the drawn shape, and a press that misses is a drag on whatever is under it */
await p.mouse.click(rp.x,rp.y); await p.waitForTimeout(120);
await p.mouse.click(rp.x,rp.y); await p.waitForTimeout(400);
if(await p.evaluate(()=>document.querySelectorAll('svg.editing .sizer').length)!==5)
  fail('picking a node did not put five resize handles on it');
const rs0=await rszSize(RSZ), rfar0=await rszCorner(RSZ,0);
rp=await rszCorner(RSZ,2);
await p.mouse.move(rp.x,rp.y); await p.mouse.down();
await p.mouse.move(rp.x+70,rp.y+40,{steps:14}); await p.mouse.up(); await p.waitForTimeout(350);
const rs1=await rszSize(RSZ);
if(rs1[0]<=rs0[0]) fail(`dragging a corner out did not widen it (${rs0[0]} -> ${rs1[0]})`);
const rfar1=await rszCorner(RSZ,0);
if(Math.hypot(rfar1.x-rfar0.x,rfar1.y-rfar0.y)>3)
  fail('resizing from one corner moved the opposite one — that is a move, not a resize');
rp=await rszCorner(RSZ,4);
await p.mouse.move(rp.x,rp.y); await p.mouse.down();
await p.mouse.move(rp.x,rp.y-45,{steps:12}); await p.mouse.up(); await p.waitForTimeout(350);
if((await rszSize(RSZ))[2]<=rs1[2]) fail('dragging the height handle up did not raise it');
if(await p.evaluate(()=>TICKERS.length)!==tick0)
  fail("a resize leaked a ticker — the redraw did not remove the shape's old one");
console.log(`resize     ${RSZ} ${rs0.join(' ')} -> ${(await rszSize(RSZ)).join(' ')}`);

/* --- drag UNDER-AMPLIFIED and OVER-AMPLIFIED separately --- */
const st=k=>p.evaluate(key=>{const a=ANNOTATIONS.find(x=>x.key===key);
  return a?{dx:a.off.dx,dy:a.off.dy,x1:+a.line.getAttribute('x1'),y1:+a.line.getAttribute('y1'),
            x2:+a.line.getAttribute('x2'),y2:+a.line.getAttribute('y2')}:null;},k);
const box=k=>p.evaluate(key=>{const a=ANNOTATIONS.find(x=>x.key===key);
  const r=a.hit.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};},k);
for(const [k,dx,dy] of [['c4:under',-110,50],['c4:over',130,-40]]){
  const A=await st(k); if(!A){ fail(k+' does not exist'); continue; }
  const q=await box(k);
  await p.mouse.move(q.x,q.y); await p.mouse.down();
  await p.mouse.move(q.x+dx,q.y+dy,{steps:14}); await p.mouse.up(); await p.waitForTimeout(300);
  const B=await st(k);
  if(Math.abs(B.dx-A.dx)<10 && Math.abs(B.dy-A.dy)<10) fail(`${k} did not move`);
  if(Math.hypot(B.x1-A.x1,B.y1-A.y1)<8) fail(`${k}'s leader did not follow the label`);
  if(Math.hypot(B.x1-A.x1,B.y1-A.y1) <= Math.hypot(B.x2-A.x2,B.y2-A.y2)) fail(`${k}'s label end moved no more than the end that names the point`);
  console.log(`${k.padEnd(10)} dx ${A.dx}->${B.dx}  dy ${A.dy}->${B.dy}`);
}
const u=await st('c4:under'), o=await st('c4:over');
if(u.dx===o.dx && u.dy===o.dy) fail('the two labels moved together — they must be independent');

/* --- double click -> X -> ask -> cancel -> delete --- */
const q=await p.evaluate(()=>{const n=NODES.find(m=>m.id==='c3'),g=document.querySelector('#svg > g');
  const m=g.getScreenCTM(),t=P(n.x,n.y,topOf(n));return{x:m.a*t[0]+m.c*t[1]+m.e,y:m.b*t[0]+m.d*t[1]+m.f};});
await p.mouse.click(q.x,q.y); await p.waitForTimeout(120); await p.mouse.click(q.x,q.y); await p.waitForTimeout(400);
if(!await p.locator('#delX').isVisible()) fail('double-clicking an object did not offer a ✕');
await p.locator('#delX').click(); await p.waitForTimeout(300);
if(!await p.locator('#delAsk.on').isVisible()) fail('the ✕ did not ask first');
await p.locator('#delAskNo').click(); await p.waitForTimeout(300);
if(await p.evaluate(()=>!!NODES.find(n=>n.id==='c3').gone)) fail('Cancel deleted it anyway');
await p.locator('#delX').click(); await p.waitForTimeout(250);
await p.locator('#delAskGo').click(); await p.waitForTimeout(400);
if(!await p.evaluate(()=>!!NODES.find(n=>n.id==='c3').gone)) fail('Delete did not remove it');

/* --- and it all saves --- */
await p.locator('#btnSave').click(); await p.waitForTimeout(500);
await p.locator('#svGo').click(); await p.waitForTimeout(1400);
const off=(rec&&rec.offsets)||{};
if(!off['c3'] || !off['c3'].del) fail('the deletion was not saved: '+JSON.stringify(Object.keys(off)));
if(!off[RSZ] || !off[RSZ].dw || !off[RSZ].dh) fail('the resize was not saved: '+JSON.stringify(off[RSZ]));
if(!off['c4:under'] || !off['c4:over']) fail('the annotation nudges were not saved: '+JSON.stringify(Object.keys(off)));
console.log('saved keys:', Object.keys(off).join(' '));
console.log(bad?`\n${bad} FAILURE(S)`:'edit: annotations drag one at a time with their leaders, a picked node resizes from a corner and by height, double-click offers a ✕, it asks, Cancel spares it, Delete removes it, and all of it saves');
if(errs.length) console.log('page errors:',errs.slice(0,3));
await b.close(); process.exit(bad||errs.length?1:0);
