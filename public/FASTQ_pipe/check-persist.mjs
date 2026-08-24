/* check-persist.mjs — a saved sitting is the default, in EVERY browser.
   Run: node check-persist.mjs <url>         (needs playwright)

   This one exists because of a bug that shipped and that all five other
   checks passed straight through. Save posted the table, DynamoDB took it,
   the confirmation said so — and the arrangement came back unmoved on the
   next load. The record was being fetched and written into local storage,
   and then the page merely offered "Layout updated — reload to see it". It
   never applied it. The author's own browser looked right because its store
   already held the sitting; every other browser rendered the default map and
   a notice about a layout it was not showing.

   A saved default that needs a second action to take effect is not a default.

   Unlike the other browser checks this one does NOT stub the endpoint away to
   a constant — a constant is exactly what cannot catch this. It stands a
   stateful record up in front of the page: a POST stores, a GET returns what
   was stored. That is the smallest thing that can tell "we wrote it" apart
   from "we read it back and did something with it".

   Three assertions, and the second is the one that broke:

     1  SAME BROWSER   drag, Save, reload -> still where it was put.
     2  FRESH BROWSER  a second context, empty local storage, the shared
                       record the only source -> the map opens on the sitting.
     3  NO PHANTOMS    the saved table names only what was actually touched.
                       The attrition band's position is DERIVED from the
                       buildings it spans, and while its base was captured
                       before that derivation it read as having been dragged
                       twelve units by a user who had never touched it. A
                       table with junk in it is a table nobody trusts.

   AND A LOCAL SITTING IS NOT THE SAME THING AS A STALE BROWSER. The third bug
   here threw away every drag that had not been published yet: the shared copy
   treated any difference between itself and this browser as itself being
   newer, so moving something, saving, moving something else and reloading lost
   the second move — and so did the ordinary habit of moving a few things and
   reloading to look at them before deciding to save. Telling "behind" from
   "ahead" needs a third quantity, the record this browser last agreed with,
   and scenarios 4 to 6 below are the transitions it exists to get right.

   EVERY OBJECT IS COMPARED, not the one that was dragged. The second bug
   here moved something the drag never touched: the band's base was derived
   from the buildings it spans, so nudging the first matrix a unit left moved
   the band's zero a unit left underneath the nudge it already carried — and
   by different amounts down the two paths a table can arrive by. It crept a
   unit further on every save-and-reload, while the building that was actually
   dragged sat perfectly still. Checking only the dragged object is how that
   survived a check written for exactly this.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8731/FASTQ_pipe/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };
const errs = [];

/* the stateful stand-in for the shared record */
/* The record carries a MONOTONIC `at`, because that is what the page
   reconciles on: the shared copy wins only if it is strictly newer than what
   the browser is holding. A stub with a constant stamp cannot tell a working
   reconciliation from one that always keeps local. */
let record = null, stamp = 0;
const publish = o => { record = o; stamp += 1000; return stamp; };
const serve = async r => {
  if (r.request().method() === 'POST') {
    const at = publish(JSON.parse(r.request().postData() || '{}').offsets || null);
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, at }) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ offsets: record, at: record ? stamp : null }) });
};

const open = async () => {
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api/fqpipe_edits', serve);
  await p.goto(url, { waitUntil: 'networkidle' });
  /* long enough for the shared copy to arrive AND for the reload it triggers
     when it is newer — adopting is a reload now, not an in-place apply */
  await p.waitForTimeout(3600);
  return p;
};

/* world position, not screen: the camera fits the map and a deletion or a
   drag moves the fit, so screen coordinates compare two different cameras */
const posOf = (p, id) => p.evaluate(i => {
  const n = NODES.find(m => m.id === i);
  return n ? { x: n.x, y: n.y } : null;
}, id);
/* EVERY object, every time — see the note at the top about what only shows up
   when you look at the ones the drag never touched. */
const allOf = p => p.evaluate(() => Object.fromEntries(
  NODES.map(n => [n.id, [+n.x.toFixed(3), +n.y.toFixed(3)]])));
const drift = (A, B) => Object.keys(A)
  .filter(k => !B[k] || Math.abs(A[k][0] - B[k][0]) > 0.011 || Math.abs(A[k][1] - B[k][1]) > 0.011)
  .map(k => `${k} ${JSON.stringify(A[k])} -> ${JSON.stringify(B[k] || null)}`);

/* UD, the first matrix, is deliberately the one that moves: the attrition
   band's span is derived from it, so dragging it is what tells a base apart
   from a derivation. */
const TARGET = 'UD';

/* ---- 1. the same browser, which is what was reported ------------------- */
const p1 = await open();
const before = await posOf(p1, TARGET);

await p1.locator('#btnEdit').click();
await p1.waitForTimeout(300);
const q = await p1.evaluate(i => {
  const n = NODES.find(m => m.id === i), w = document.querySelector('#svg > g');
  const m = w.getScreenCTM(), pt = P(n.x, n.y, topOf(n));
  return { x: m.a * pt[0] + m.c * pt[1] + m.e, y: m.b * pt[0] + m.d * pt[1] + m.f };
}, TARGET);
await p1.mouse.move(q.x, q.y);
await p1.mouse.down();
await p1.mouse.move(q.x + 160, q.y + 60, { steps: 16 });
await p1.mouse.up();
await p1.waitForTimeout(350);

const dragged = await posOf(p1, TARGET);
if (Math.abs(dragged.x - before.x) < 0.2 && Math.abs(dragged.y - before.y) < 0.2)
  fail('the drag did not move anything — the rest of this check proves nothing');
const laid = await allOf(p1);          /* the whole map, as it was left */

await p1.locator('#btnSave').click();
await p1.waitForTimeout(900);
if (!await p1.locator('#note.on').isVisible()) fail('Save gave no confirmation');
if (!record) fail('Save did not reach the shared record');

/* ---- 3. and it named only what was touched ----------------------------- */
const keys = Object.keys(record || {});
if (keys.length !== 1 || keys[0] !== TARGET)
  fail(`the saved table names ${JSON.stringify(keys)} — only ${TARGET} was touched`);

await p1.reload({ waitUntil: 'networkidle' });
await p1.waitForTimeout(3000);
let d = drift(laid, await allOf(p1));
if (d.length) fail('same browser: the map came back different after a reload — ' + d.join(' ; '));

/* and again, because a base derived from something that moves creeps by the
   same amount every single time round rather than settling */
await p1.reload({ waitUntil: 'networkidle' });
await p1.waitForTimeout(3000);
d = drift(laid, await allOf(p1));
if (d.length) fail('same browser: still moving on the second reload — ' + d.join(' ; '));

/* applying the table again must not compose onto itself */
const twice = await p1.evaluate(() => {
  /* the stored record is {offsets, at} — the table is inside it */
  const rec = JSON.parse(localStorage.getItem('fqpipe.offsets') || '{}');
  const o = rec.offsets || rec;
  applyOffsets(o); applyOffsets(o);
  const n = NODES.find(m => m.id === 'UD');
  return { x: n.x, y: n.y };
}).catch(() => null);
if (twice && (Math.abs(twice.x - dragged.x) > 0.01 || Math.abs(twice.y - dragged.y) > 0.01))
  fail(`applying the saved table twice moved it again: ${JSON.stringify(twice)} — the base is not fixed`);

/* ---- 2. a second browser, with nothing in its store -------------------- */
const p2 = await open();
const fresh = await posOf(p2, TARGET);
if (Math.abs(fresh.x - dragged.x) > 0.01 || Math.abs(fresh.y - dragged.y) > 0.01)
  fail(`fresh browser: the shared copy was not applied — opened at ${JSON.stringify(fresh)}, ` +
       `the saved default is ${JSON.stringify(dragged)}`);
d = drift(laid, await allOf(p2));
if (d.length) fail('fresh browser: opened on a different arrangement — ' + d.join(' ; '));

/* ---- 4. a sitting that has NOT been saved survives a reload ------------ */
const grab = async (page, id, dx, dy) => {
  const q = await page.evaluate(i => {
    const n = NODES.find(m => m.id === i), w = document.querySelector('#svg > g');
    const m = w.getScreenCTM(), t = P(n.x, n.y, topOf(n));
    return { x: m.a * t[0] + m.c * t[1] + m.e, y: m.b * t[0] + m.d * t[1] + m.f };
  }, id);
  await page.mouse.move(q.x, q.y); await page.mouse.down();
  await page.mouse.move(q.x + dx, q.y + dy, { steps: 16 }); await page.mouse.up();
  await page.waitForTimeout(350);
};
const p3 = await open();
await p3.locator('#btnEdit').click();
await p3.waitForTimeout(300);
await grab(p3, 'E4', 150, -80);
const unsaved = await allOf(p3);
await p3.reload({ waitUntil: 'networkidle' });
await p3.waitForTimeout(3000);
d = drift(unsaved, await allOf(p3));
if (d.length) fail('an unsaved sitting was thrown away on reload — ' + d.join(' ; '));

/* ---- 5. and so does one made AFTER a save, which is what was reported --- */
await p3.locator('#btnEdit').click();
await p3.waitForTimeout(300);
await grab(p3, 'E6', -120, 60);
await p3.locator('#btnSave').click();
await p3.waitForTimeout(1100);
await grab(p3, 'E3', 90, 70);                       // moved AFTER the save
const later = await allOf(p3);
await p3.reload({ waitUntil: 'networkidle' });
await p3.waitForTimeout(3000);
d = drift(later, await allOf(p3));
if (d.length) fail('work done after a save was lost on reload — ' + d.join(' ; '));

/* ---- 6. but a record somebody ELSE published is still adopted ----------- */
/* BOTH BASES ARE READ OFF THE NODE, never assumed to be zero. An offset is a
   nudge from wherever the lane engine put the thing, and not every node on
   this map sits on the row: the branches are off it by design, so a target
   whose _oy is not 0 is the normal case rather than the exception. */
const [base, baseY] = await p3.evaluate(() => {
  const n = NODES.find(m => m.id === 'E4'); return [n._ox, n._oy];
});
publish({ E4: { dx: 3.3, dy: -2.2 } });             // arrives from another browser
const p4 = await open();
const took = await posOf(p4, 'E4');
if (!took || Math.abs(took.x - (base + 3.3)) > 0.05 || Math.abs(took.y - (baseY - 2.2)) > 0.05)
  fail('a record published elsewhere was not adopted by a browser with nothing ' +
       `of its own — E4 opened at ${JSON.stringify(took)}, expected ` +
       `${(base+3.3).toFixed(2)}, ${(baseY-2.2).toFixed(2)}`);

/* ---- 7. a browser carrying the OLD bare-table local record ------------
   Every browser that edited this map before the stamp existed is holding one.
   It has no `at`, so it reads as 0, and the shared record — which is that same
   browser's own last save — supersedes it. What must NOT happen is the loader
   treating a bare table as `{offsets, at}`, finding no `offsets` key, and
   opening on an empty layout. */
const p5ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } });
const p5 = await p5ctx.newPage();
p5.on('pageerror', e => errs.push(e.message));
await p5.route('**/api/fqpipe_edits', serve);
await p5.goto(url, { waitUntil: 'domcontentloaded' });
await p5.evaluate(() => localStorage.setItem('fqpipe.offsets',
  JSON.stringify({ E6: { dx: -2.5, dy: 1.5 } })));      // the old shape, no stamp
await p5.reload({ waitUntil: 'networkidle' });
await p5.waitForTimeout(3600);
const legacy = await posOf(p5, 'E4');
if (!legacy || Math.abs(legacy.x - (base + 3.3)) > 0.05)
  fail('a browser holding the pre-stamp record did not take the shared copy — ' +
       `E4 opened at ${JSON.stringify(legacy)}`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : 'persist: a drag saves and holds through a reload, opens that way in a browser that has ' +
    'never seen it, names only what was touched, re-applies without drifting, keeps unsaved work ' +
    'through a reload both before and after a save, still adopts a record published elsewhere, ' +
    'and migrates a browser holding the pre-stamp record');
if (errs.length) console.log('page errors:', errs);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
