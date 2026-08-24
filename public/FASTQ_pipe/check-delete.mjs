/* check-delete.mjs — pick, ✕, confirm, delete, and Save saying so out loud.
   Run: node check-delete.mjs <url>          (needs playwright)

   Deleting is the one action in Edit positions that does not undo itself by
   dragging back, and the saved state is shared — so a mis-click takes an
   object off the map for everybody. That is why it asks, and why Cancel is
   asserted here as hard as Delete is.

   The confirmation is asserted BOTH ways: that it appears, and that it goes
   away on its own. A notice that needs dismissing is a second thing to do
   after the thing you actually wanted to do, and one that never leaves is
   indistinguishable from a stuck page.

   The API is stubbed. What is under test is the page's behaviour, not
   DynamoDB's — and a check that fails when a table is unreachable is a check
   that gets ignored.
*/
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1700,height:1000}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.route('**/api/fqpipe_edits',r=>r.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify({ok:true,offsets:null,at:null})}));
await p.goto(process.argv[2]||'http://127.0.0.1:8731/FASTQ_pipe/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(1400);
let bad=0; const fail=m=>{bad++;console.log('  FAIL  '+m);};

await p.locator('#btnEdit').click(); await p.waitForTimeout(300);
const at=id=>p.evaluate(i=>{const n=NODES.find(m=>m.id===i);
  const w=document.querySelector('#svg > g'),m=w.getScreenCTM(),q=P(n.x,n.y,topOf(n));
  return {x:m.a*q[0]+m.c*q[1]+m.e,y:m.b*q[0]+m.d*q[1]+m.f};},id);

/* a press that does not travel is a pick */
let q=await at('E4');
await p.mouse.click(q.x,q.y); await p.waitForTimeout(300);
if(!await p.locator('#delX').isVisible()) fail('clicking an object did not offer a delete');

/* ✕ asks first */
await p.locator('#delX').click(); await p.waitForTimeout(250);
if(!await p.locator('#ask.on').isVisible()) fail('delete did not ask for confirmation');
await p.locator('#askNo').click(); await p.waitForTimeout(250);
if(await p.evaluate(()=>!!NODES.find(n=>n.id==='E4').gone)) fail('Cancel deleted it anyway');

/* and then does it */
await p.locator('#delX').click(); await p.waitForTimeout(200);
await p.locator('#askGo').click(); await p.waitForTimeout(300);
if(!await p.evaluate(()=>!!NODES.find(n=>n.id==='E4').gone)) fail('Delete did not remove it');
if(await p.evaluate(()=>document.querySelector('#svg g[aria-label="Align R1"]').getAttribute('display'))!=='none')
  fail('the deleted object is still drawn');

/* Save says what happened, and stops saying it */
await p.locator('#btnSave').click(); await p.waitForTimeout(600);
if(!await p.locator('#note.on').isVisible()) fail('Save gave no confirmation');
const txt=await p.locator('#noteTitle').textContent();
if(!/Saved/.test(txt)) fail(`the confirmation said "${txt}"`);
const rec=JSON.parse(await p.evaluate(()=>localStorage.getItem('fqpipe.offsets'))||'{}');
const stored=rec.offsets||{};
if(!stored.E4 || !stored.E4.del) fail('the deletion was not saved: '+JSON.stringify(rec));
await p.waitForTimeout(5400);
if(await p.locator('#note.on').isVisible()) fail('the confirmation never went away');

/* and it survives a reload */
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200);
if(await p.evaluate(()=>NODES.some(n=>n.id==='E4'))) fail('the deletion did not survive a reload');
if(await p.evaluate(()=>EDGES.some(e=>e.a==='E4'||e.b==='E4'))) fail('an edge to the deleted object survived');

console.log(bad?`\n${bad} FAILURE(S)`
 :'delete: pick shows the ✕, ✕ asks, Cancel spares it, Delete removes it, Save confirms and self-dismisses, and it survives a reload');
if(errs.length) console.log('page errors:',errs);
await b.close(); process.exit(bad||errs.length?1:0);
