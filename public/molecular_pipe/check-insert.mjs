/* check-insert.mjs — "Add a module": choosing a gap, and what gets sent.
   Run: node check-insert.mjs <url>            (needs playwright)

   THE GAP IS THE WHOLE FEATURE. Every other tool on this page acts on
   something you can select; a station that does not exist yet cannot be
   selected, so the index grows a slot between every pair and the slot IS the
   answer to "where". Two things follow, and both are asserted here:

     the slots have to describe real gaps. A slot that names the wrong
       neighbours sends the worker to the wrong place in the row, and the
       request reads perfectly right the whole way — the mistake only shows up
       as a station in the wrong place, minutes later, live;
     and the request has to carry the gap, not just the words. kind:"insert"
       plus afterId/beforeId is what makes the worker do the data-file work —
       the node, the two edges, the room. Send it as a plain visual request and
       the worker draws a shape nothing wears.

   Also asserted: that ordinary "Edit visual" still sends what it always sent.
   The two share one dialogue, and the whole risk of sharing it is that one job
   quietly starts sending the other's payload.
*/
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8731/molecular_pipe/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let bad = 0; const ok = (c, m) => c ? console.log('  ok    ' + m) : (bad++, console.log('  FAIL  ' + m));

const posts = [];
await p.route('**/api/**', r => {
  const u = new URL(r.request().url());
  if (r.request().method() === 'POST') {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch {}
    posts.push({ path: u.pathname, body });
    if (u.pathname.endsWith('molecular_prompts'))
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, prompt: { id: 'p' + posts.length, status: 'queued' }, queued: 1 }) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{"prompts":[],"ok":true}' });
});

await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(800);

// ---- the button ----
const bar = await p.$$eval('header .controls .ctl', b => b.map(x => x.textContent.trim()));
ok(bar.includes('Add a module'), 'the button is in the top bar  [' + bar.join(' | ') + ']');
ok(await p.isVisible('#btnAdd'), 'and is visible without entering edit mode');
ok((await p.$$('#aside .slot')).length === 0, 'no slots until the mode is on');

// ---- entering the mode ----
const rows = await p.$$eval('#aside .row', e => e.map(x => x.dataset.id));
await p.click('#btnAdd');
await p.waitForTimeout(250);
ok(await p.evaluate(() => document.body.classList.contains('inserting')), 'clicking it enters insert mode');
ok(await p.getAttribute('#btnAdd', 'aria-pressed') === 'true', 'the button reads as pressed');
ok(await p.isVisible('#aside .insertsay'), 'the panel says what to do');

const slots = await p.$$eval('#aside .slot', e => e.map(x => ({
  after: x.dataset.after, before: x.dataset.before || null, text: x.textContent.trim() })));
ok(slots.length === rows.length, `one slot per station (${slots.length} slots, ${rows.length} stations)`);

// ---- the slots describe REAL gaps ----
const wantAfter = rows;
const wantBefore = rows.slice(1).concat([null]);
ok(slots.map(s => s.after).join() === wantAfter.join(), 'each slot follows the station it sits under');
ok(slots.map(s => s.before).join() === wantBefore.join(), 'and names the station it sits above');
ok(slots[slots.length - 1].before === null, 'the last slot is the end of the row');
ok(/end/i.test(slots[slots.length - 1].text), 'and says so  ("' + slots[slots.length - 1].text + '")');

// no slot before the first station — the row opens on its anchor
const firstChild = await p.evaluate(() => {
  const a = document.getElementById('aside');
  for (const el of a.children) { if (el.classList.contains('slot')) return 'slot';
    if (el.classList.contains('row')) return 'row'; }
  return 'none';
});
ok(firstChild !== 'slot', 'nothing offers to insert before the opening station');

// ---- the stations stop competing for the click ----
ok(await p.$eval('#aside .row', e => getComputedStyle(e).pointerEvents === 'none'),
   'a station cannot be selected while a gap is what you are choosing');

// ---- clicking a slot ----
const midIdx = 3;
const mid = slots[midIdx];
await p.click(`#aside .slot[data-after="${mid.after}"]`);
await p.waitForTimeout(300);
ok(await p.isVisible('#ask'), 'clicking a slot opens the request window');
const title = await p.textContent('#askWhat');
ok(/^A new module between /.test(title), 'titled as a new module, not a redraw  ("' + title + '")');
const nameOf = id => p.$eval(`#aside .row[data-id="${id}"] .nm`, e => e.textContent);
ok(title.includes(await nameOf(mid.after)) && title.includes(await nameOf(mid.before)),
   'and it names both neighbours');
ok(/row grows|make room/i.test(await p.textContent('#askHint')), 'the hint says the row will grow');

// ---- what gets sent ----
posts.length = 0;
await p.fill('#askIn', 'a magnetic rack with six tubes, beads pulled to the wall');
await p.click('#askGo');
await p.waitForTimeout(500);
ok(posts.length === 1, 'one request sent');
const sent = posts[0].body;
ok(posts[0].path === '/api/molecular_prompts', "to THIS map's queue");
ok(sent.kind === 'insert', 'carrying kind:"insert"  (' + sent.kind + ')');
ok(sent.insert && sent.insert.afterId === mid.after && sent.insert.beforeId === mid.before,
   `and the gap it was clicked on (${sent.insert && sent.insert.afterId} -> ${sent.insert && sent.insert.beforeId})`);
ok(!!(sent.insert.afterLabel && sent.insert.beforeLabel), 'with the labels that were on screen');
ok(sent.text.includes('magnetic rack'), 'and the words that were typed');

// ---- and the mode gets out of the way ----
ok(!await p.evaluate(() => document.body.classList.contains('inserting')),
   'sending leaves insert mode');
ok((await p.$$('#aside .slot')).length === 0, 'the slots are gone');
ok(!await p.isVisible('#aside .insertsay'), 'and so is the say-so');
ok(await p.isVisible('#works .work'), 'the wait for it is stacked in the corner like any other');
ok(/new module/.test(await p.textContent('#works .work')), 'and reads as a new module');

// ---- EDIT VISUAL STILL SENDS WHAT IT ALWAYS SENT ----
await p.click('#aside .row[data-id="' + rows[2] + '"]');
await p.waitForTimeout(200);
posts.length = 0;
await p.click('#btnVisual');
await p.waitForTimeout(250);
ok(/^New drawing for /.test(await p.textContent('#askWhat')), 'Edit visual is a redraw again, not a module');
await p.fill('#askIn', 'thicker outset lines');
await p.click('#askGo');
await p.waitForTimeout(400);
const v = posts[0].body;
ok(v.kind === undefined && v.insert === undefined, 'a redraw sends no kind and no insert');
ok(v.target && v.target.id === rows[2], 'just the selected node, as before');

// ---- leaving the mode by hand, and by Escape ----
await p.click('#btnAdd'); await p.waitForTimeout(200);
ok((await p.$$('#aside .slot')).length > 0, 'the mode can be entered again');
await p.click('#btnAdd'); await p.waitForTimeout(200);
ok((await p.$$('#aside .slot')).length === 0 && !await p.isVisible('#aside .insertsay'),
   'clicking the button again leaves no residue');

await p.click('#btnAdd'); await p.waitForTimeout(200);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok(!await p.evaluate(() => document.body.classList.contains('inserting')), 'Escape leaves the mode');

/* Escape belongs to the request window while it is up — leaving the mode out
   from under it would shut the slots and leave the dialogue floating */
await p.click('#btnAdd'); await p.waitForTimeout(200);
await p.click(`#aside .slot[data-after="${slots[1].after}"]`); await p.waitForTimeout(250);
await p.keyboard.press('Escape'); await p.waitForTimeout(250);
ok(!await p.isVisible('#ask'), 'Escape in the window closes the window');
ok(await p.evaluate(() => document.body.classList.contains('inserting')),
   'and leaves the mode standing, so another gap can be chosen');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok(!await p.evaluate(() => document.body.classList.contains('inserting')), 'a second Escape leaves the mode');

ok(errs.length === 0, 'no page errors  ' + errs.slice(0, 2).join(' / '));
console.log(bad ? `\n${bad} FAILED` : '\nadd a module: all checks pass');
await b.close();
process.exit(bad ? 1 : 0);
