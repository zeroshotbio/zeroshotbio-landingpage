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
const TARGET = 'c4';   // Complexity — a building in the middle of the row

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
const after = await posOf(p1, TARGET);
if (Math.abs(after.x - dragged.x) > 0.01 || Math.abs(after.y - dragged.y) > 0.01)
  fail(`same browser: reverted on reload — put at ${JSON.stringify(dragged)}, came back at ${JSON.stringify(after)}`);

/* applying the table again must not compose onto itself */
const twice = await p1.evaluate(() => {
  const o = JSON.parse(localStorage.getItem('bpipe.offsets') || '{}');
  applyOffsets(o); applyOffsets(o);
  const n = NODES.find(m => m.id === 'c4');
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

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : 'persist: a drag saves to the shared record, holds through a reload, opens that way in a ' +
    'browser that has never seen it, names only what was touched, and re-applies without drifting');
if (errs.length) console.log('page errors:', errs);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
