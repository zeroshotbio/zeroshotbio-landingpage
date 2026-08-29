/* check-multi.mjs — Select many: gather, move as one, keep the spacing.
   Run: node check-multi.mjs <url>           (needs playwright)

   A map is arranged in groups more often than one object at a time. Doing that
   one drag at a time works and loses the spacing: every object you move is
   measured by eye against the one you moved last, and the errors add up. So
   the point of this tool is not that several things move — it is that they
   move by EXACTLY the same amount, and the assertion that matters is the one
   comparing their deltas to each other, not to zero.

   It caught a real drift the first time it ran. Each member's new position was
   being rounded to two decimals independently, and the lane engine does not
   put objects on tidy coordinates, so three objects moved by one drag came out
   0.005 apart. Small, compounding, and exactly the thing the tool exists to
   prevent. The delta is snapped once now and added; every gap stays
   bit-identical. Keep the tolerance at 0.001 — a looser one passes that bug.

   Also checked: the tool is offered only inside Edit positions (a selection
   you can build but not move is a trap), a second click removes a member, a
   drag does not disturb anything outside the set, Escape empties it, leaving
   Edit positions leaves this mode, and every member saves its own offset —
   the set is a way of moving, not a thing that gets saved.
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
await p.goto(process.argv[2]||'http://127.0.0.1:8732/pipeline',{waitUntil:'networkidle'}); await p.waitForTimeout(3200);
let bad=0; const fail=m=>{bad++;console.log('  FAIL '+m);};

const IDS=['c1','c3','c4'];
const pos=()=>p.evaluate(ids=>Object.fromEntries(ids.map(i=>{const n=NODES.find(m=>m.id===i);
  return [i,[+n.x.toFixed(3),+n.y.toFixed(3)]];})),IDS);
const at2=id=>p.evaluate(i=>{const n=NODES.find(m=>m.id===i),g=document.querySelector('#svg > g');
  const m=g.getScreenCTM(),t=P(n.x,n.y,topOf(n));return{x:m.a*t[0]+m.c*t[1]+m.e,y:m.b*t[0]+m.d*t[1]+m.f};},id);

/* the button is edit-only */
if(await p.locator('#btnMulti').isVisible()) fail('Select many is offered before Edit positions is on');
await p.locator('#btnEdit').click(); await p.waitForTimeout(500);
if(!await p.locator('#btnMulti').isVisible()) fail('Select many did not appear in Edit positions');
await p.locator('#btnMulti').click(); await p.waitForTimeout(400);

/* gather three */
for(const id of IDS){ const q=await at2(id); await p.mouse.click(q.x,q.y); await p.waitForTimeout(180); }
let n=await p.evaluate(()=>document.querySelectorAll('#svg g.chosen').length);
if(n!==3) fail(`clicked three objects, ${n} are marked as chosen`);

/* a second click removes one, and a third puts it back */
let q=await at2('c3'); await p.mouse.click(q.x,q.y); await p.waitForTimeout(200);
n=await p.evaluate(()=>document.querySelectorAll('#svg g.chosen').length);
if(n!==2) fail(`clicking a chosen object again left ${n} chosen, want 2`);
await p.mouse.click(q.x,q.y); await p.waitForTimeout(200);

/* move them as a unit */
const A=await pos();
q=await at2('c1');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x+150,q.y+80,{steps:16}); await p.mouse.up(); await p.waitForTimeout(400);
const B=await pos();
const d=IDS.map(i=>[ +(B[i][0]-A[i][0]).toFixed(3), +(B[i][1]-A[i][1]).toFixed(3) ]);
console.log('deltas:', JSON.stringify(Object.fromEntries(IDS.map((i,k)=>[i,d[k]]))));
if(Math.abs(d[0][0])<0.2 && Math.abs(d[0][1])<0.2) fail('nothing moved');
d.slice(1).forEach((v,k)=>{
  if(Math.abs(v[0]-d[0][0])>0.001||Math.abs(v[1]-d[0][1])>0.001)
    fail(`${IDS[k+1]} moved by ${JSON.stringify(v)} but ${IDS[0]} moved by ${JSON.stringify(d[0])} — the set did not keep its spacing`);
});
/* and nothing outside the set moved */
const other=await p.evaluate(()=>{const n=NODES.find(m=>m.id==='c5');return [+n.x.toFixed(3),+n.y.toFixed(3)];});
const other0=await p.evaluate(()=>{const n=NODES.find(m=>m.id==='c5');return [+n._px.toFixed(3),+n._py.toFixed(3)];});
if(Math.abs(other[0]-other0[0])>0.001) fail('an object outside the set moved with it');

/* Escape empties the set */
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
n=await p.evaluate(()=>document.querySelectorAll('#svg g.chosen').length);
if(n!==0) fail(`Escape left ${n} chosen`);

/* all three moves are saved, one offset each */
await p.locator('#btnSave').click(); await p.waitForTimeout(500);
/* SAVE IS ONE CLICK NOW. It used to render a preview with a Confirm button in
   it and nothing left the browser until that second click; the button saves
   directly, and what it draws afterwards is a receipt. Clicking #svGo here is
   clicking a button that no longer exists. */
await p.waitForTimeout(1500);
const off=(rec&&rec.offsets)||{};
IDS.forEach(i=>{ if(!off[i]) fail(`${i}'s move was not saved: ${JSON.stringify(Object.keys(off))}`); });
console.log('saved:', JSON.stringify(Object.fromEntries(IDS.filter(i=>off[i]).map(i=>[i,off[i]]))));

/* leaving edit mode leaves this mode */
await p.locator('#btnEdit').click(); await p.waitForTimeout(400);
if(await p.evaluate(()=>document.body.classList.contains('multi')))
  fail('leaving Edit positions left Select many on');

console.log(bad?`\n${bad} FAILURE(S)`
 :'multi: the tool is edit-only, a click gathers and un-gathers, a drag moves the whole set by one delta with its spacing intact, nothing outside it moves, Escape empties it, and every member saves its own offset');
if(errs.length) console.log('page errors:',errs.slice(0,3));
await b.close(); process.exit(bad||errs.length?1:0);
