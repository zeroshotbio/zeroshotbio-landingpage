/* check-edit.mjs — Edit positions must move things, and a NAME must move on
   its own.
   Run: node check-edit.mjs <url>            (needs playwright)

   Two things this catches that nothing else does.

   A name is not attached to its building by anything but convention. It
   floats above and to one side, and where it can go depends on what its
   neighbours are doing — so it has its own handle and its own pair of nudges
   (ldx/ldy). The two failure modes are symmetrical and both look fine in a
   screenshot: dragging the building silently moving the name offset too, and
   dragging the name silently dragging the building with it. Both are asserted
   here in both directions.

   The FLOATING annotations are a third case again. They are not laid out from
   world coordinates at all — their own shape re-places them from scratch every
   frame — so "moved" cannot mean "the element is somewhere else": the next
   frame would put it back. What moves is the nudge the shape's placement is
   offset by. And the leader line has to follow: its label end must move with
   the text while the end that names a point on the chart must not budge, which
   is the entire reason a label like this is worth being able to move.

   A MOVER is the fourth case: the band's own name. It belongs to no building,
   so nothing in the nudge table reached it and it was the only string on the
   map that could not be got out of the way of anything else. Both halves are
   asserted — the nudge changing, and the type actually going with it.

   And REAL MOUSE PRESSES ONLY. The mode is built on pointer capture, which a
   dispatched MouseEvent skips entirely — a synthetic drag would pass against
   an implementation that cannot actually be driven by a hand.
*/
import { chromium } from 'playwright';
const url=process.argv[2];
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1700,height:1000}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
await p.route('**/api/bpipe_edits',r=>r.fulfill({status:200,
  contentType:'application/json',body:JSON.stringify({offsets:null,at:null})}));
await p.goto(url,{waitUntil:'networkidle'});
await p.waitForTimeout(1400);
let bad=0; const fail=m=>{bad++;console.log('  FAIL  '+m);};

const at = (id,what) => p.evaluate(([i,w])=>{
  const n=NODES.find(m=>m.id===i);
  const world=document.querySelector('#svg > g'), m=world.getScreenCTM();
  if(w==='node'){ const q=P(n.x,n.y,topOf(n));
    return {x:m.a*q[0]+m.c*q[1]+m.e, y:m.b*q[0]+m.d*q[1]+m.f}; }
  const L=[...document.querySelectorAll('#svg g')].find(g=>g.dataset && g.dataset.base!==undefined
    && g.textContent.indexOf(n.name)>=0);
  const r=L.getBoundingClientRect();
  return {x:r.x+r.width/2, y:r.y+r.height/2};
},[id,what]);
const state = id => p.evaluate(i=>{ const n=NODES.find(m=>m.id===i);
  return {x:n.x,y:n.y,lx:n._lx,ly:n._ly}; }, id);

/* handles must be inert until the mode is on */
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.ehandle')).display)!=='none')
  fail('handles are visible before the mode is on');

await p.locator('#btnEdit').click();
await p.waitForTimeout(300);
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.ehandle')).display)==='none')
  fail('handles still hidden after turning the mode on');

/* drag a BUILDING */
const before=await state('c3');
let q=await at('c3','node');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x+140,q.y+40,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const afterN=await state('c3');
if(Math.abs(afterN.x-before.x)<0.2 && Math.abs(afterN.y-before.y)<0.2)
  fail(`dragging the building did not move it (x ${before.x}->${afterN.x})`);
if(afterN.lx!==before.lx || afterN.ly!==before.ly)
  fail('dragging the building also moved its name offset');

/* drag a NAME on its own */
const b2=await state('c5');
q=await at('c5','label');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x-120,q.y-70,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const a2=await state('c5');
if(Math.abs(a2.lx-b2.lx)<0.2 && Math.abs(a2.ly-b2.ly)<0.2)
  fail(`dragging the name did not move it (lx ${b2.lx}->${a2.lx}, ly ${b2.ly}->${a2.ly})`);
if(Math.abs(a2.x-b2.x)>0.001 || Math.abs(a2.y-b2.y)>0.001)
  fail('dragging the name moved the building too');

/* drag a FLOATING ANNOTATION, and check the leader follows it */
const annKey = await p.evaluate(() => ANNOTATIONS[0].key);
const annState = () => p.evaluate(k => {
  const a = ANNOTATIONS.find(x => x.key === k);
  return { dx: a.off.dx, dy: a.off.dy,
           /* x1,y1 is the leader's label end; x2,y2 the point it names */
           x1: +a.line.getAttribute('x1'), y1: +a.line.getAttribute('y1'),
           x2: +a.line.getAttribute('x2'), y2: +a.line.getAttribute('y2') };
}, annKey);
const b3 = await annState();
const box = await p.evaluate(k => {
  const r = ANNOTATIONS.find(x => x.key === k).hit.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, annKey);
await p.mouse.move(box.x, box.y); await p.mouse.down();
await p.mouse.move(box.x - 90, box.y + 60, { steps: 14 }); await p.mouse.up();
await p.waitForTimeout(300);
const a3 = await annState();
if (Math.abs(a3.dx - b3.dx) < 10 && Math.abs(a3.dy - b3.dy) < 10)
  fail(`dragging "${annKey}" did not move it (dx ${b3.dx}->${a3.dx}, dy ${b3.dy}->${a3.dy})`);
if (Math.hypot(a3.x1 - b3.x1, a3.y1 - b3.y1) < 8)
  fail('the leader line did not follow the label it is attached to');
if (Math.hypot(a3.x2 - b3.x2, a3.y2 - b3.y2) > 2)
  fail('the leader line let go of the point it names');

/* drag THE BAND'S OWN NAME — a mover: type that belongs to no building.
   It was the one string on the map the nudge table could not reach, so it was
   also the only one that could not be got out of the way of anything else. */
const movKey = await p.evaluate(() => MOVERS.length ? MOVERS[0].key : null);
if (!movKey) fail('the band name is not a mover — nothing to drag');
else {
  const mstate = () => p.evaluate(k => {
    const m = MOVERS.find(x => x.key === k);
    const r = m.g.getBoundingClientRect();
    return { lx: m.lx, ly: m.ly, sx: r.x + r.width / 2, sy: r.y + r.height / 2 };
  }, movKey);
  const b4 = await mstate();
  await p.mouse.move(b4.sx, b4.sy); await p.mouse.down();
  await p.mouse.move(b4.sx - 130, b4.sy - 50, { steps: 14 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const a4 = await mstate();
  if (Math.abs(a4.lx - b4.lx) < 0.2 && Math.abs(a4.ly - b4.ly) < 0.2)
    fail(`dragging the band name did not move it (ldx ${b4.lx}->${a4.lx}, ldy ${b4.ly}->${a4.ly})`);
  /* and the type itself has to have gone with the nudge — the nudge is what
     is saved, but the nudge moving while the glyphs stay put is exactly the
     failure the floating labels had */
  if (Math.hypot(a4.sx - b4.sx, a4.sy - b4.sy) < 20)
    fail('the band name nudge moved but the type did not');
}

/* A PICKED NODE RESIZES — four corners for w and d, one handle for h.

   THE TARGET IS A ROOFED CULL ON PURPOSE. It is the only kind of object here
   that ANIMATES, and a resize is the only edit that redraws a shape: a shape
   that animates pushes into TICKERS every time it is drawn, so a redraw that
   cannot say which tickers were its own leaves the old one running over
   elements that have been thrown away. The count must come back where it
   started. It is invisible on screen and it compounds.

   The corner is also ANCHORED AT ITS OPPOSITE — a resize that drifts the whole
   object is a move wearing a resize's clothes. */
const RSZ='c3';
const sizeOf=id=>p.evaluate(i=>{ const n=NODES.find(m=>m.id===i);
  return [n.w,n.d,n.h].map(v=>+v.toFixed(2)); },id);
const cornerAt=(id,k)=>p.evaluate(([i,kk])=>{
  const n=NODES.find(m=>m.id===i), hw=n.w/2, hd=n.d/2, h=topOf(n);
  const q=kk===4?P(n.x,n.y,h)
    :P(n.x+((kk===1||kk===2)?hw:-hw), n.y+((kk===2||kk===3)?hd:-hd), h);
  const world=document.querySelector('#svg > g'), m=world.getScreenCTM();
  return {x:m.a*q[0]+m.c*q[1]+m.e, y:m.b*q[0]+m.d*q[1]+m.f};
},[id,k]);

const tick0=await p.evaluate(()=>TICKERS.length);
/* THE FAR CORNER, NOT THE CENTRE. On this map the middle of a roof is covered
   by the roof's own floating annotation, whose hit box takes the press first —
   the pick then lands on the annotation, the node is never picked, and the
   drag that follows moves whatever was under it. The corner is clear of it. */
let hp=await cornerAt(RSZ,0);
await p.mouse.move(hp.x,hp.y); await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(300);
if(await p.evaluate(()=>document.querySelectorAll('svg.editing .sizer').length)!==5)
  fail('picking a node did not put five resize handles on it');
const rs0=await sizeOf(RSZ), far0=await cornerAt(RSZ,0);
hp=await cornerAt(RSZ,2);
await p.mouse.move(hp.x,hp.y); await p.mouse.down();
await p.mouse.move(hp.x+70,hp.y+40,{steps:14}); await p.mouse.up();
await p.waitForTimeout(300);
const rs1=await sizeOf(RSZ);
if(rs1[0]<=rs0[0]) fail(`dragging a corner out did not widen it (${rs0[0]} -> ${rs1[0]})`);
const far1=await cornerAt(RSZ,0);
if(Math.hypot(far1.x-far0.x,far1.y-far0.y)>3)
  fail('resizing from one corner moved the opposite one — that is a move, not a resize');
hp=await cornerAt(RSZ,4);
await p.mouse.move(hp.x,hp.y); await p.mouse.down();
await p.mouse.move(hp.x,hp.y-45,{steps:12}); await p.mouse.up();
await p.waitForTimeout(300);
if((await sizeOf(RSZ))[2]<=rs1[2]) fail('dragging the height handle up did not raise it');
if(await p.evaluate(()=>TICKERS.length)!==tick0)
  fail("a resize leaked a ticker — the redraw did not remove the shape's old one");

/* it is remembered, and it prints a block to paste */
/* the stored record is {offsets, at}: the table, and when it was last touched */
const rec=JSON.parse(await p.evaluate(()=>localStorage.getItem('bpipe.offsets'))||'{}');
const stored=rec.offsets;
if(!stored || !stored[RSZ] || !stored[RSZ].dw || !stored[RSZ].dh)
  fail('the resize was not written to local storage: '+JSON.stringify(stored&&stored[RSZ]));
if(!stored || !stored.c3 || !stored.c5 || !stored[annKey])
  fail('offsets were not written to local storage: '+JSON.stringify(rec));
if(movKey && stored && !stored[movKey])
  fail('the band name offset was not written to local storage: '+JSON.stringify(rec));
if(!rec.at) fail('the stored record carries no timestamp — reconciliation needs one');
if(!await p.locator('#btnSave').isVisible()) fail('Save positions never appeared');
await p.locator('#btnSave').click();
await p.waitForTimeout(250);
const snip=await p.evaluate(()=>document.querySelector('#read .snip')?.textContent||'');
if(!/const OFFSETS = \{/.test(snip)) fail('Save did not print an OFFSETS block');
if(!/ldx|ldy/.test(snip)) fail('the printed block has no name offset in it');
if(!/adx|ady/.test(snip)) fail('the printed block has no annotation offset in it');

/* and the mode gets out of the way again */
await p.locator('#btnEdit').click();
await p.waitForTimeout(250);
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.ehandle')).display)!=='none')
  fail('handles still showing after leaving the mode');

console.log(bad?`\n${bad} FAILURE(S)`
 :'edit positions: buildings drag and resize from a corner and by height, names drag on their own, floating labels drag '+
  'and their leaders follow, the band name drags, all four remembered, block prints');
if(errs.length) console.log('page errors:',errs);
await b.close(); process.exit(bad||errs.length?1:0);
