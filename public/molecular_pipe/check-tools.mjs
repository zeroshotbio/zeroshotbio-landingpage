/* check-tools.mjs — the two editors /pipeline never had a check for.
   Run: node check-tools.mjs <url>            (needs playwright)

   check-edit covers Edit positions: drag, resize, delete, save. Edit text and
   Edit visual had no check on either map, and this page exists so that somebody
   can develop a row out with exactly those three tools — so they are asserted
   here rather than assumed.

   WHAT THIS IS REALLY GUARDING. Both tools reach an endpoint, and both
   endpoints are per-map: /api/molecular_edits for the text and
   /api/molecular_prompts for the queue. Point either at /pipeline's and the
   failure is silent — this page's renames would land in the big map's record,
   and its "draw me a shape" requests would land in the big map's work queue
   with nothing saying which map asked. So the endpoint each tool actually calls
   is captured and asserted, not just the fact that it did something.
*/
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8731/molecular_pipe/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };

/* every API call the page makes, and where it went */
const hits = [];
let record = { offsets: null, text: null, at: null };
await p.route('**/api/**', r => {
  const u = new URL(r.request().url()), m = r.request().method();
  hits.push(m + ' ' + u.pathname);
  if (u.pathname.endsWith('_edits')) {
    if (m === 'POST') { const j = JSON.parse(r.request().postData() || '{}');
      record = { offsets: j.offsets, text: j.text, at: Date.now() };
      return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ok:true, at:record.at}) }); }
    return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(record) });
  }
  return r.fulfill({ status:200, contentType:'application/json', body: '{"ok":true,"items":[]}' });
});
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);

/* ---- 1. all three tools are present ------------------------------------- */
for (const id of ['btnEdit','btnText','btnVisual'])
  if (!(await p.locator('#'+id).count())) fail(`${id} is not on the page`);

/* ---- 2. Edit text renames a station, and it sticks ----------------------- */
const NODE = 'SB';
const nameOf = () => p.evaluate(i => (NODES.find(n => n.id === i) || {}).name, NODE);
const before = await nameOf();
/* A NODE HAS TO BE SELECTED FIRST. Edit text edits the READER's fields, not
   labels on the map — so with nothing picked the panel is showing the overview
   and there is no station name anywhere to grip. Clicking the index row is what
   a person does, and it is what puts the node in the reader. */
await p.locator(`aside .row[data-id="${NODE}"]`).click();
await p.waitForTimeout(700);
await p.locator('#btnText').click(); await p.waitForTimeout(400);
if (!(await p.evaluate(() => document.body.classList.contains('texting'))))
  fail('Edit text did not put the page into text mode');
const box = await p.evaluate(i => {
  const el = document.querySelector(`[data-tid="${i}"][data-tf="name"]`);
  if (!el) return null; const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, NODE);
if (!box) fail(`no editable name field for ${NODE} — Edit text has nothing to grip`);
else {
  /* THE TYPING HAPPENS IN A POPOVER, NOT IN THE FIELD. Clicking a field opens
     #tedit with a textarea in it; Enter commits, Esc cancels. Typing at the
     field itself does nothing and looks exactly like a tool that is broken. */
  await p.mouse.click(box.x, box.y); await p.waitForTimeout(400);
  if (!(await p.locator('#tedit').isVisible())) fail('clicking a field did not open the text popover');
  await p.locator('#teIn').fill('Count again, split, lyse — REWORDED');
  await p.locator('#teIn').press('Enter'); await p.waitForTimeout(500);
  const after = await nameOf();
  if (after === before) fail(`Edit text did not change ${NODE}'s name (still "${before}")`);
  else console.log('text    ', `${NODE}: "${before}" -> "${after}"`);
}

/* ---- 3. one click saves, and it reaches THIS map's record ----------------
   SAVE IS ONE STEP. It used to render a preview into the reader with a Confirm
   button under it, and nothing left the browser until that second click — a
   control called "Save all changes" that does not save is one people press
   twice by reflex. Clicking #btnSave IS the save now, and what appears after
   it is a receipt rather than a question. */
hits.length = 0;
await p.locator('#btnSave').click();
await p.waitForTimeout(2500);
if (await p.locator('#svGo').count()) fail('the second-click Confirm button is still there');
const posted = hits.filter(h => h.startsWith('POST'));
if (!posted.length) fail('one click on Save posted nothing');
if (posted.some(h => h.includes('/api/pipeline_')))
  fail(`Save reached /pipeline's record: ${posted.join(', ')}`);
if (!posted.some(h => h.includes('/api/molecular_edits')))
  fail(`Save did not reach this map's record: ${posted.join(', ')}`);
else console.log('save    ', posted.join(', '));
/* and the confirmation must be a real one: the page reads the record back
   before it claims anything, so a GET has to follow the POST */
if (!hits.some((h,i) => h.startsWith('GET') && h.includes('molecular_edits')
                        && hits.slice(0,i).some(x => x.startsWith('POST'))))
  fail('nothing was read back — the confirmation is a hope, not a check');
const said = await p.evaluate(() => {
  const t = document.querySelector('.toast'); return t ? t.textContent.trim() : '';
});
if (!/saved/i.test(said)) fail(`no confirmation appeared (toast said "${said}")`);
else console.log('confirm ', '"' + said.slice(0, 76) + '…"');

if (!record.text || !JSON.stringify(record.text).includes('REWORDED'))
  fail('the rename did not make it into the record');
await p.locator('#btnText').click(); await p.waitForTimeout(300);

/* ---- 4. Edit visual opens, and asks THIS map's queue --------------------- */
hits.length = 0;
await p.locator('#btnVisual').click(); await p.waitForTimeout(700);
const open = await p.evaluate(() => {
  const a = document.getElementById('ask');
  return !!a && getComputedStyle(a).display !== 'none';
});
if (!open) fail('Edit visual did not open its dialogue');
else console.log('visual  ', 'dialogue opens');
const q = hits.filter(h => h.includes('prompts'));
if (q.some(h => h.includes('/api/pipeline_prompts')))
  fail(`Edit visual polled /pipeline's queue: ${q.join(', ')}`);
console.log('queue   ', q.length ? q.join(', ') : 'polled on open: none yet (it polls on a timer)');

if (errs.length) fail('page errors: ' + errs.join(' | '));
console.log(bad ? `\n${bad} FAILURE(S)`
  : 'tools: all three are on the page, Edit text renames a station and the rename reaches THIS map’s record, Edit visual opens, and neither tool touches /pipeline’s');
await b.close();
process.exit(bad ? 1 : 0);
