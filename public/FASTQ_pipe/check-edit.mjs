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

   THE FLOATING ANNOTATIONS ARE NOT TESTED HERE, because this map has none:
   they belong to the roof charts, and this page draws no roofs. The editor
   still handles them — the code is shared with /bioinformatics_pipe — so if a
   roof ever lands on this row, lift that section of this file back from that
   map's copy rather than writing a new one.

   A MOVER is the third case: the band's own name. It belongs to no building,
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
await p.route('**/api/fqpipe_edits',r=>r.fulfill({status:200,
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
const before=await state('E4');
let q=await at('E4','node');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x+140,q.y+40,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const afterN=await state('E4');
if(Math.abs(afterN.x-before.x)<0.2 && Math.abs(afterN.y-before.y)<0.2)
  fail(`dragging the building did not move it (x ${before.x}->${afterN.x})`);
if(afterN.lx!==before.lx || afterN.ly!==before.ly)
  fail('dragging the building also moved its name offset');

/* drag a NAME on its own */
const b2=await state('E6');
q=await at('E6','label');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x-120,q.y-70,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const a2=await state('E6');
if(Math.abs(a2.lx-b2.lx)<0.2 && Math.abs(a2.ly-b2.ly)<0.2)
  fail(`dragging the name did not move it (lx ${b2.lx}->${a2.lx}, ly ${b2.ly}->${a2.ly})`);
if(Math.abs(a2.x-b2.x)>0.001 || Math.abs(a2.y-b2.y)>0.001)
  fail('dragging the name moved the building too');

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

   TWO THINGS ARE ASSERTED THAT LOOK LIKE PLUMBING AND ARE NOT.

   The corner is ANCHORED AT ITS OPPOSITE, so the far corner must hold still
   while the near one moves; a resize that drifts the whole object is a move
   wearing a resize's clothes.

   And THE TICKER COUNT MUST NOT GROW. A resize is the only edit that redraws a
   shape, and a shape that animates pushes into TICKERS every time it draws.
   Recording those only in the redraw was not enough — the first draw's ticker
   was never on the books, so one resize left two, both running over elements
   the other had thrown away. It is invisible on screen and it compounds. */
const sizeOf=id=>p.evaluate(i=>{ const n=NODES.find(m=>m.id===i);
  return [n.w,n.d,n.h,n.x,n.y].map(v=>+v.toFixed(2)); },id);
const cornerAt=(id,k)=>p.evaluate(([i,kk])=>{
  const n=NODES.find(m=>m.id===i), hw=n.w/2, hd=n.d/2, h=topOf(n);
  const q=kk===4?P(n.x,n.y,h)
    :P(n.x+((kk===1||kk===2)?hw:-hw), n.y+((kk===2||kk===3)?hd:-hd), h);
  const world=document.querySelector('#svg > g'), m=world.getScreenCTM();
  return {x:m.a*q[0]+m.c*q[1]+m.e, y:m.b*q[0]+m.d*q[1]+m.f};
},[id,k]);

const RSZ='E4';
const tickersBefore=await p.evaluate(()=>TICKERS.length);
let hit=await cornerAt(RSZ,4);   /* the top-face CENTRE, and without travelling: a corner may be off the drawn shape, and a press that misses drags whatever is under it */
await p.mouse.move(hit.x,hit.y); await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(300);
if(await p.evaluate(()=>document.querySelectorAll('svg.editing .sizer').length)!==5)
  fail('picking a node did not put five resize handles on it');

const sz0=await sizeOf(RSZ);
const far0=await cornerAt(RSZ,0);                    /* the corner opposite the one dragged */
hit=await cornerAt(RSZ,2);
await p.mouse.move(hit.x,hit.y); await p.mouse.down();
await p.mouse.move(hit.x+80,hit.y+46,{steps:14}); await p.mouse.up();
await p.waitForTimeout(300);
const sz1=await sizeOf(RSZ);
if(sz1[0]<=sz0[0]) fail(`dragging a corner out did not widen it (${sz0[0]} -> ${sz1[0]})`);
const far1=await cornerAt(RSZ,0);
if(Math.hypot(far1.x-far0.x,far1.y-far0.y)>3)
  fail('resizing from one corner moved the opposite one — that is a move, not a resize');

hit=await cornerAt(RSZ,4);
await p.mouse.move(hit.x,hit.y); await p.mouse.down();
await p.mouse.move(hit.x,hit.y-50,{steps:12}); await p.mouse.up();
await p.waitForTimeout(300);
const sz2=await sizeOf(RSZ);
if(sz2[2]<=sz1[2]) fail(`dragging the height handle up did not raise it (${sz1[2]} -> ${sz2[2]})`);
if(await p.evaluate(()=>TICKERS.length)!==tickersBefore)
  fail("a resize leaked a ticker — the redraw did not remove the shape's old one");

/* THE BAND: A BORDER THAT MOVES IT AND A CORNER THAT RESHAPES IT.

   This one is checked harder than the rest because it is the only object on the
   map whose geometry is DERIVED — the polygon is drawn from x0/y0/x1/y1 rather
   than from a coordinate of its own, which is the exact shape of the bug that
   made Save look broken for two builds on /bioinformatics_pipe: the record was
   right, the model was right, and the picture was wrong. So this asserts the
   RECT AFTER A RELOAD, not the record.

   And it asserts the two are independent: a corner must move two extents and
   leave the other two alone, or dragging one edge quietly drifts the opposite
   one. */
const rectOf=pg=>pg.evaluate(()=>BOXES[0].rect().map(v=>+v.toFixed(2)));
const bandBefore=await rectOf(p);

const corner=await p.evaluate(()=>{
  const r=BOXES[0].corners[2].getBoundingClientRect();
  return {x:r.x+r.width/2,y:r.y+r.height/2};
});
await p.mouse.move(corner.x,corner.y); await p.mouse.down();
await p.mouse.move(corner.x-120,corner.y-70,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const bandCorner=await rectOf(p);
if(bandCorner[0]!==bandBefore[0] || bandCorner[1]!==bandBefore[1])
  fail(`dragging the far corner moved the near one too (${bandBefore} -> ${bandCorner})`);
if(bandCorner[2]===bandBefore[2] && bandCorner[3]===bandBefore[3])
  fail('dragging a band corner did not reshape it');

const edge=await p.evaluate(()=>{
  const pp=BOXES[0].hit.getAttribute('points').split(' ').map(q=>q.split(',').map(Number));
  const world=document.querySelector('#svg > g'), m=world.getScreenCTM();
  const mid=[(pp[1][0]+pp[2][0])/2,(pp[1][1]+pp[2][1])/2];
  return {x:m.a*mid[0]+m.c*mid[1]+m.e, y:m.b*mid[0]+m.d*mid[1]+m.f};
});
await p.mouse.move(edge.x,edge.y); await p.mouse.down();
await p.mouse.move(edge.x+60,edge.y+40,{steps:12}); await p.mouse.up();
await p.waitForTimeout(250);
const bandMoved=await rectOf(p);
const shifted=bandMoved.map((v,i)=>+(v-bandCorner[i]).toFixed(2));
if(!shifted[0] || shifted.some(v=>Math.abs(v-shifted[0])>0.001 && Math.abs(v-shifted[1])>0.001))
  fail(`dragging the band border did not move it rigidly (${shifted})`);

/* it is remembered, and it prints a block to paste */
/* the stored record is {offsets, at}: the table, and when it was last touched */
const rec=JSON.parse(await p.evaluate(()=>localStorage.getItem('fqpipe.offsets'))||'{}');
const stored=rec.offsets;
if(!stored || !stored[RSZ] || !stored[RSZ].dw || !stored[RSZ].dh)
  fail('the resize was not written to local storage: '+JSON.stringify(rec.offsets&&rec.offsets[RSZ]));
if(!stored || !stored["bandbox:0"])
  fail('the band box was not written to local storage: '+JSON.stringify(rec));
if(!stored || !stored.E4 || !stored.E6)
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

/* AND THE BAND COMES BACK DRAWN WHERE IT WAS LEFT — the record being right is
   not evidence that the picture is. */
await p.reload({waitUntil:'networkidle'});
await p.waitForTimeout(2200);
const bandBack=await rectOf(p);
/* to ONE ROUNDING UNIT: the saved table is r2'd, so a value that was 21.255
   live comes back 21.26, and demanding more than the record can hold would be
   a check failing on its own storage format rather than on the map. */
const szBack=await sizeOf(RSZ);
if(szBack.some((v,i)=>Math.abs(v-sz2[i])>0.011))
  fail(`the resize saved and reloaded at a different size — left ${sz2}, came back ${szBack}`);
if(bandBack.some((v,i)=>Math.abs(v-bandMoved[i])>0.001))
  fail(`the band saved and reloaded somewhere else — left at ${bandMoved}, came back at ${bandBack}`);
await p.locator('#btnEdit').click();
await p.waitForTimeout(300);

/* and the mode gets out of the way again */
await p.locator('#btnEdit').click();
await p.waitForTimeout(250);
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.ehandle')).display)!=='none')
  fail('handles still showing after leaving the mode');

console.log(bad?`\n${bad} FAILURE(S)`
 :'edit positions: buildings drag and resize from a corner and by height, names drag '+
  'on their own, the band name drags, '+
  'the band box moves rigidly and reshapes by a corner and comes back where it was '+
  'left, all remembered, block prints');
if(errs.length) console.log('page errors:',errs);
await b.close(); process.exit(bad||errs.length?1:0);
