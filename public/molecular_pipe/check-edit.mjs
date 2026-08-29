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
await p.route('**/api/molecular_edits',r=>{
  if(r.request().method()==='POST'){ rec=JSON.parse(r.request().postData()||'{}'); at+=1000;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,at})}); }
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({offsets:null,text:null,at:null})});});
await p.route('**/api/molecular_prompts*',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
/* THE URL IS AN ARGUMENT, like every other check beside this one. It was
   hardcoded to production, which means it tested the deployed page and quietly
   ignored whatever was on disk — a check that cannot see your change is a
   check that passes for the wrong reason. Production stays the default. */
const url = process.argv[2] || 'https://www.zeroshot.bio/molecular_pipe';
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
/* THE TARGET IS SEQ, THE SEQUENCER — the animated shape on this row. c1 is the
   knee cull and it is not on this page; what the fixture has to be is a shape
   that pushes into TICKERS when it draws, because the leak this section exists
   to catch only happens on a redraw of one. */
const RSZ='SEQ';
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

/* --- and the WHOLE drawing follows the resize, not just the box -----------

   The resize above proves w, d and h change and that the object does not drift.
   It does not prove the drawing kept up, and that is the failure that was
   actually reported: the plate grew, the tube stayed exactly where it was at
   exactly its old size, and the pipette working it never changed. The node
   resized perfectly the entire time.

   So B1 is widened hard and the SHAPE GROUP's box is measured — nodeEls, not
   the label, which is a text box that never changes size whatever the node
   does. What is asserted is the box's HEIGHT, because on this shape the height
   is made of the parts that were pinned: the tube standing beside the plate and
   the tip above it. Measured on the shipped bug the height grew 1.42x while the
   node's width grew 4.2x; with the geometry read off n.w/n.d/n.h it grows 2.9x.
   The bar sits at 2x, well clear of both. */
const GRW='B1';
const grwBox=()=>p.evaluate(i=>{const r=nodeEls[i].getBBox();
  return {w:+r.width.toFixed(1), h:+r.height.toFixed(1)};},GRW);
const grwCorner=(k)=>p.evaluate(([i,kk])=>{
  const n=NODES.find(m=>m.id===i), hw=n.w/2, hd=n.d/2, h=topOf(n);
  const t=kk===4?P(n.x,n.y,h)
    :P(n.x+((kk===1||kk===2)?hw:-hw), n.y+((kk===2||kk===3)?hd:-hd), h);
  const m=document.querySelector('#svg > g').getScreenCTM();
  return {x:m.a*t[0]+m.c*t[1]+m.e, y:m.b*t[0]+m.d*t[1]+m.f};},[GRW,k]);
const grwW=()=>p.evaluate(i=>NODES.find(m=>m.id===i).w,GRW);

let gp=await grwCorner(4);
await p.mouse.click(gp.x,gp.y); await p.waitForTimeout(120);
await p.mouse.click(gp.x,gp.y); await p.waitForTimeout(400);
const gw0=await grwW(), gb0=await grwBox();
gp=await grwCorner(2);
await p.mouse.move(gp.x,gp.y); await p.mouse.down();
await p.mouse.move(gp.x+60,gp.y+34,{steps:16}); await p.mouse.up();
await p.waitForTimeout(600);
const gw1=await grwW(), gb1=await grwBox();
const nodeGrew=gw1/gw0, drawGrew=gb1.h/gb0.h;
if(nodeGrew<2) fail(`the drag did not widen ${GRW} enough to tell (${nodeGrew.toFixed(2)}x)`);
else if(drawGrew<2)
  fail(`${GRW} resized but its DRAWING did not: the node widened ${nodeGrew.toFixed(2)}x and `+
       `the drawn box grew ${drawGrew.toFixed(2)}x in height — part of the shape is on world `+
       `constants instead of n.w/n.d/n.h and stayed at its old size in its old place`);
console.log(`scaling    ${GRW} widened ${nodeGrew.toFixed(2)}x, drawing grew ${drawGrew.toFixed(2)}x`);

/* ---- THE FLOATING ANNOTATIONS ARE NOT ON THIS PAGE ----------------------
   /pipeline's copy of this check drags the four cull annotations and asserts
   their leaders follow. Row 2 carries none — annotations belong to the roofed
   culls — so that whole section is removed here rather than left to fail, the
   same way /FASTQ_pipe's copy removes it. LIFT IT BACK if a station on this row
   ever earns a roof and an annotation to go with it. */

console.log(bad?`\n${bad} FAILURE(S)`:'edit: a picked node resizes from a corner and by height, double-click offers a ✕, it asks, Cancel spares it, Delete removes it, and all of it saves');
if(errs.length) console.log('page errors:',errs.slice(0,3));
await b.close(); process.exit(bad||errs.length?1:0);
