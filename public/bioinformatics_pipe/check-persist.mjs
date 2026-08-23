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

const url = process.argv[2] || 'http://127.0.0.1:8731/bioinformatics_pipe';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };
const errs = [];

/* the stateful stand-in for the shared record */
let record = null;
const serve = async r => {
  if (r.request().method() === 'POST') {
    record = JSON.parse(r.request().postData() || '{}').offsets || null;
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, at: 1 }) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ offsets: record, at: record ? 1 : null }) });
};

const open = async () => {
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api/bpipe_edits', serve);
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
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
await p1.waitForTimeout(1800);
let d = drift(laid, await allOf(p1));
if (d.length) fail('same browser: the map came back different after a reload — ' + d.join(' ; '));

/* and again, because a base derived from something that moves creeps by the
   same amount every single time round rather than settling */
await p1.reload({ waitUntil: 'networkidle' });
await p1.waitForTimeout(1800);
d = drift(laid, await allOf(p1));
if (d.length) fail('same browser: still moving on the second reload — ' + d.join(' ; '));

/* applying the table again must not compose onto itself */
const twice = await p1.evaluate(() => {
  const o = JSON.parse(localStorage.getItem('bpipe.offsets') || '{}');
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
await grab(p3, 'c3', 150, -80);
const unsaved = await allOf(p3);
await p3.reload({ waitUntil: 'networkidle' });
await p3.waitForTimeout(2200);
d = drift(unsaved, await allOf(p3));
if (d.length) fail('an unsaved sitting was thrown away on reload — ' + d.join(' ; '));

/* ---- 5. and so does one made AFTER a save, which is what was reported --- */
await p3.locator('#btnEdit').click();
await p3.waitForTimeout(300);
await grab(p3, 'c5', -120, 60);
await p3.locator('#btnSave').click();
await p3.waitForTimeout(1100);
await grab(p3, 'c1', 90, 70);                       // moved AFTER the save
const later = await allOf(p3);
await p3.reload({ waitUntil: 'networkidle' });
await p3.waitForTimeout(2200);
d = drift(later, await allOf(p3));
if (d.length) fail('work done after a save was lost on reload — ' + d.join(' ; '));

/* ---- 6. but a record somebody ELSE published is still adopted ----------- */
const base = await p3.evaluate(() => NODES.find(n => n.id === 'c3')._ox);
record = { c3: { dx: 3.3, dy: -2.2 } };             // arrives from another browser
const p4 = await open();
const took = await posOf(p4, 'c3');
if (!took || Math.abs(took.x - (base + 3.3)) > 0.05 || Math.abs(took.y + 2.2) > 0.05)
  fail('a record published elsewhere was not adopted by a browser with nothing ' +
       `of its own — c3 opened at ${JSON.stringify(took)}, expected ${(base+3.3).toFixed(2)}, -2.2`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : 'persist: a drag saves and holds through a reload, opens that way in a browser that has ' +
    'never seen it, names only what was touched, re-applies without drifting, keeps unsaved work ' +
    'through a reload both before and after a save, and still adopts a record published elsewhere');
if (errs.length) console.log('page errors:', errs);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
