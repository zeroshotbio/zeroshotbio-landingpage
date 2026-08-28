/* check-link.mjs — Connect two items, end to end.
   Run: node check-link.mjs <url>            (needs playwright)

   WHAT THIS IS FOR. Connect is the one edit on this page that ADDS something
   rather than moving it, and it is the only one whose result has to survive
   three hops to be worth anything: onto the map, into the record, and back out
   again in a browser that has never seen it. Every one of those was broken at
   some point while it was being built, and none of the three shows up in a
   screenshot.

   USE page.mouse.click, NEVER dispatchEvent — for the reason check-clicks
   gives, and for one more that is specific to this tool. The bug that took
   longest here was that the drag machinery calls preventDefault and captures
   the pointer on the way down, so no `click` was ever delivered while the mode
   was on: the button lit, the cursor changed, and nothing happened. A synthetic
   click would have sailed straight past that and the check would have passed on
   a tool that did not work.

   THE ENDPOINT IS A STATEFUL STUB. A constant cannot catch a save that never
   carried the links — the same reason check-persist stands one up. */
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node check-link.mjs <url>'); process.exit(2); }

let store = { offsets: null, links: null, at: null };
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

await page.route('**/api/fqpipe_edits*', async r => {
  if (r.request().method() === 'POST') {
    const body = JSON.parse(r.request().postData() || '{}');
    store = { ...body, at: Date.now() };
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, at: store.at }) });
  }
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store) });
});

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };
page.on('pageerror', e => fail('pageerror: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);

const btn = id => page.locator('#' + id);
const links = () => page.evaluate(() => LIVELINKS.length);

/* ---- 1. the tool is not reachable from the reading view ------------------ */
if (await btn('btnLink').isVisible())
  fail('the Connect button is visible outside the editor');

await btn('btnEdit').click();
await page.waitForTimeout(200);
if (!(await btn('btnLink').isVisible()))
  fail('the Connect button did not appear with the editor');

/* ---- 2. two clicks join two objects -------------------------------------- */
await btn('btnLink').click();
await page.waitForTimeout(150);

/* the projected centre of the roof, the way check-clicks aims: a node's
   bounding box is mostly air and a click into it lands on the canvas */
const roof = id => page.evaluate(i => {
  const n = byId[i], world = document.querySelector('#svg > g'), m = world.getScreenCTM();
  const q = P(n.x, n.y, topOf(n));
  return { x: m.a * q[0] + m.c * q[1] + m.e, y: m.b * q[0] + m.d * q[1] + m.f };
}, id);

/* THE FIXTURE PAIR HAS TO BE ONE THE DATA FILE HAS NOT ALREADY JOINED, and it
   stopped being G4/E4 the day the aligner was wired into the row: the tool
   refused the duplicate, correctly, and six of this check's seven assertions
   failed downstream of the one that mattered. G2b is the spare annotation card
   — placed unconnected, for exactly this — and nothing authored runs between it
   and the index. If a future edge ever joins them, move this pair again rather
   than teaching the tool to allow duplicates. */
const A = await roof('G2b'), B = await roof('G3');
await page.mouse.click(A.x, A.y); await page.waitForTimeout(150);
await page.mouse.click(B.x, B.y); await page.waitForTimeout(250);
if (await links() !== 1) fail(`two clicks made ${await links()} links, expected 1`);

/* ---- 3. and the same pair cannot be joined twice ------------------------- */
await page.mouse.click(A.x, A.y); await page.waitForTimeout(120);
await page.mouse.click(B.x, B.y); await page.waitForTimeout(200);
if (await links() !== 1) fail('the same pair was joined twice');

/* ---- 4. it is a painted track with white dots ---------------------------- */
const drawn = await page.evaluate(() => {
  const rec = edgeGeom.find(e => e.link);
  const dot = DOTS.find(d => d.e && d.e.link);
  return { edge: !!rec, path: !!(rec && rec.host && rec.host.querySelector('path')),
           dots: DOTS.filter(d => d.e && d.e.link).length,
           fill: dot ? dot.node.querySelectorAll('circle')[1].getAttribute('fill') : null };
});
if (!drawn.edge || !drawn.path) fail('the link has no painted track');
if (!drawn.dots) fail('the link carries no dots');
if (drawn.fill !== 'var(--fg)') fail('the dots are not white: ' + drawn.fill);

/* ---- 5. Save positions carries it into the record ------------------------ */
await btn('btnSave').click();
await page.waitForTimeout(900);
if (!store.links || store.links.length !== 1)
  fail('the save did not carry the link: ' + JSON.stringify(store.links));
if (!store.offsets) fail('the save dropped the offsets while carrying links');

/* ---- 6. and it comes back in a browser that has never seen it ------------ */
const fresh = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
fresh.on('pageerror', e => fail('pageerror on the fresh load: ' + e.message));
await fresh.route('**/api/fqpipe_edits*', r => r.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify(store) }));
await fresh.goto(url, { waitUntil: 'networkidle' });
await fresh.waitForTimeout(1500);
const back = await fresh.evaluate(() => ({
  live: LIVELINKS.length,
  edges: EDGES.filter(e => e.link).length,
  painted: edgeGeom.filter(e => e.link && e.host).length,
}));
if (back.live !== 1 || back.edges !== 1 || back.painted !== 1)
  fail('the link did not come back: ' + JSON.stringify(back));

await browser.close();
if (bad) { console.log(`\n${bad} problem${bad === 1 ? '' : 's'}`); process.exit(1); }
console.log('connect: hidden outside the editor, two clicks join two objects, a pair ' +
  'cannot double, the track paints with white dots, Save carries it into the record, ' +
  'and it comes back in a browser that has never seen it');
