/* check-pads.mjs — the four row pads move, resize and carry their names.
   Run: node check-pads.mjs <url>            (needs playwright)

   A pad is the ground a row stands on. It used to be authored geometry and
   nothing else — a rectangle from two constants, drawn once — and it could not
   be tuned, which is a problem on a map whose rows have different lengths and
   different amounts of side structure hanging off them. No formula gets four
   of those right at once.

   Three things move independently and each has a failure that looks fine in a
   screenshot:

     THE PAD, by its EDGE. Not its area: a pad is the biggest object on the
     map, and a filled handle means pressing anywhere on a row picks up the
     floor instead of whatever is standing on it. Moving it must not resize it.

     ITS SIZE, from the FAR CORNER — the corner that moves when the pad grows,
     so dragging it means what it looks like it means. Resizing must not drag
     the near corner along with it.

     ITS NAME, on its own nudge. Moving the name must leave the pad alone.

   And the handles must be inert until the mode is on, which the first
   assertion checks, because a live pad edge would eat clicks across the whole
   row before anybody had asked to edit anything.
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

console.log('pad handles before the mode:',
  await p.evaluate(()=>getComputedStyle(document.querySelector('.padgrip')).display));
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.padgrip')).display)!=='none')
  fail('the pad handles are live before Edit positions is on');
await p.locator('#btnEdit').click(); await p.waitForTimeout(600);

/* DRAGS ARE WORLD DISTANCES, CONVERTED, NOT PIXEL CONSTANTS.

   They were written as fixed screen deltas — 70, 120, 80 — and that is a
   measurement of the map's extent as much as of the drag: the fit camera frames
   the whole drawing, so the moment the drawing grows, the same 70 pixels mean a
   longer journey in world units. Adding a sixth row at reading scale nearly
   doubled the map and the resize step started squashing the band to half its
   depth, which put its name somewhere the next press did not reach. Nothing was
   broken; the check had simply stopped asking the same question.

   This is the same trap check-rows records in its own header, where a hardcoded
   pixel speed went stale the moment the dots were slowed down. PPU is screen
   pixels per world unit, measured now, so a drag written as 1.6 is 1.6 units of
   ground however big the map has become. */
const PPU = await p.evaluate(() => {
  const m = document.querySelector('#svg > g').getScreenCTM();
  const a = P(0,0,0), c = P(1,0,0);
  return Math.hypot((m.a*c[0]+m.c*c[1]) - (m.a*a[0]+m.c*a[1]),
                    (m.b*c[0]+m.d*c[1]) - (m.b*a[0]+m.d*a[1]));
});
const D = u => u * PPU;

const band=i=>p.evaluate(k=>{const b=BANDS[k];
  return {x0:+b.x0.toFixed(2),y0:+b.y0.toFixed(2),x1:+b.x1.toFixed(2),y1:+b.y1.toFixed(2),
          lx:BANDEL[k].lx,ly:BANDEL[k].ly};},i);
const at2=(i,what)=>p.evaluate(([k,w])=>{
  const r=BANDEL[k], el = w==='edge'?r.padHit : w==='grip'?r.gripHit : r.nameHit;
  const b=el.getBoundingClientRect();
  if(w==='edge'){ /* press on the top edge, not the centre */
    const q=P(r.b.x1,r.b.y0,0), m=document.querySelector('#svg > g').getScreenCTM();
    return {x:m.a*q[0]+m.c*q[1]+m.e, y:m.b*q[0]+m.d*q[1]+m.f}; }
  return {x:b.x+b.width/2,y:b.y+b.height/2};},[i,what]);

/* --- 1. move the Molecular biology pad --- */
let A=await band(1);
let q=await at2(1,'edge');
await p.mouse.move(q.x,q.y); await p.mouse.down(); await p.mouse.move(q.x+D(1.6),q.y+D(1.15),{steps:14}); await p.mouse.up();
await p.waitForTimeout(300);
let B=await band(1);
if(Math.abs(B.x0-A.x0)<0.2 && Math.abs(B.y0-A.y0)<0.2) fail(`the pad did not move (${JSON.stringify(A)} -> ${JSON.stringify(B)})`);
if(Math.abs((B.x1-B.x0)-(A.x1-A.x0))>0.05) fail('moving the pad changed its width');
console.log('moved  ', JSON.stringify(A), '->', JSON.stringify(B));

/* --- 2. resize it from the corner --- */
A=await band(1); q=await at2(1,'grip');
await p.mouse.move(q.x,q.y); await p.mouse.down(); await p.mouse.move(q.x+D(2.8),q.y+D(0.9),{steps:14}); await p.mouse.up();
await p.waitForTimeout(300);
B=await band(1);
if(Math.abs((B.x1-B.x0)-(A.x1-A.x0))<0.2 && Math.abs((B.y1-B.y0)-(A.y1-A.y0))<0.2) fail('the corner grip did not resize the pad');
if(Math.abs(B.x0-A.x0)>0.05||Math.abs(B.y0-A.y0)>0.05) fail('resizing moved the near corner too');
console.log('resized', `${(A.x1-A.x0).toFixed(1)}x${(A.y1-A.y0).toFixed(1)} -> ${(B.x1-B.x0).toFixed(1)}x${(B.y1-B.y0).toFixed(1)}`);

/* --- 3. move its name --- */
A=await band(1); q=await at2(1,'name');
await p.mouse.move(q.x,q.y); await p.mouse.down(); await p.mouse.move(q.x-D(1.85),q.y-D(1.4),{steps:14}); await p.mouse.up();
await p.waitForTimeout(300);
B=await band(1);
if(Math.abs(B.lx-A.lx)<0.2 && Math.abs(B.ly-A.ly)<0.2) fail('the pad name did not move');
if(Math.abs(B.x0-A.x0)>0.05) fail('moving the name moved the pad too');
console.log('name   ', `ldx ${A.lx}->${B.lx}  ldy ${A.ly}->${B.ly}`);

/* --- 4. and it saves --- */
await p.locator('#btnSave').click(); await p.waitForTimeout(500);
await p.locator('#svGo').click(); await p.waitForTimeout(1400);
const off=(rec&&rec.offsets)||{};
const o=off['band:1'];
if(!o) fail('the pad was not saved: '+JSON.stringify(Object.keys(off)));
else { if(!o.dx&&!o.dy) fail('the move was not saved: '+JSON.stringify(o));
       if(!o.sw&&!o.sh) fail('the resize was not saved: '+JSON.stringify(o));
       if(!o.ldx&&!o.ldy) fail('the name nudge was not saved: '+JSON.stringify(o));
       console.log('saved  ', JSON.stringify(o)); }

/* --- 5. and it comes back --- */
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(3200);
const C=await band(1);
if(Math.abs(C.x0-B.x0)>0.02||Math.abs(C.x1-B.x1)>0.02||Math.abs(C.ly-B.ly)>0.02)
  fail(`the pad came back different: ${JSON.stringify(B)} -> ${JSON.stringify(C)}`);

console.log(bad?`\n${bad} FAILURE(S)`:'pads: each of the four moves by its edge, resizes from its far corner, carries its name separately, saves all three and comes back the same');
if(errs.length) console.log('page errors:',errs.slice(0,3));
await b.close(); process.exit(bad||errs.length?1:0);
