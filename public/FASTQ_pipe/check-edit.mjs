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
const before=await state('AL');
let q=await at('AL','node');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x+140,q.y+40,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const afterN=await state('AL');
if(Math.abs(afterN.x-before.x)<0.2 && Math.abs(afterN.y-before.y)<0.2)
  fail(`dragging the building did not move it (x ${before.x}->${afterN.x})`);
if(afterN.lx!==before.lx || afterN.ly!==before.ly)
  fail('dragging the building also moved its name offset');

/* drag a NAME on its own */
const b2=await state('UM');
q=await at('UM','label');
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x-120,q.y-70,{steps:14}); await p.mouse.up();
await p.waitForTimeout(250);
const a2=await state('UM');
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

/* it is remembered, and it prints a block to paste */
/* the stored record is {offsets, at}: the table, and when it was last touched */
const rec=JSON.parse(await p.evaluate(()=>localStorage.getItem('fqpipe.offsets'))||'{}');
const stored=rec.offsets;
if(!stored || !stored.AL || !stored.UM)
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

/* and the mode gets out of the way again */
await p.locator('#btnEdit').click();
await p.waitForTimeout(250);
if(await p.evaluate(()=>getComputedStyle(document.querySelector('.ehandle')).display)!=='none')
  fail('handles still showing after leaving the mode');

console.log(bad?`\n${bad} FAILURE(S)`
 :'edit positions: buildings drag, names drag on their own, the band name drags, '+
  'all three remembered, block prints');
if(errs.length) console.log('page errors:',errs);
await b.close(); process.exit(bad||errs.length?1:0);
