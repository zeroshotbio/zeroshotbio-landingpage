/* check-history.mjs — the "View prompt history" panel.
   Run: node check-history.mjs <url>            (needs playwright)

   The panel is the only part of this page that claims to be a RECORD, and the
   claim is the whole product: somebody reads it to answer "what have I already
   asked for?" before writing the next request. So the things asserted here are
   the things that would make it lie or lose you —

     it reads the WHOLE record (?all=1), not the recent window the map polls
       for. Point it at the plain endpoint and it silently shows the newest
       forty, looking exactly like a complete history;
     it is read-only. No POST may leave this panel, ever — a record you can
       change from the window you read it in is not one;
     every row that came back is on screen, in newest-first order;
     the long ones open rather than being cut off with no way to see the rest;
     and its keys do not reach the map behind it. Escape and the arrows are the
       map's own — a history you scroll while the map silently walks through
       stations behind you is how you lose your place in both.
*/
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8731/molecular_pipe/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };
const ok = (c, m) => c ? console.log('  ok    ' + m) : fail(m);

/* a record with the shapes that actually turn up: a live one, a dropped one,
   one with no target, one long enough to need opening, and enough of them to
   prove the panel is not reading a 40-row window */
const LONG = 'Redesign the pooling panel.\n\n' + 'the pipette comes down, and then '.repeat(40);
const rows = [
  { id:'p1', text:'I want to add another module after the last step', target:null,
    status:'working', at:Date.UTC(2026,8,3,17,48), updated:Date.UTC(2026,8,3,17,48) },
  { id:'p2', text:LONG, target:{id:'n5',key:'B5',name:'Pool and split',shape:'plate'},
    status:'done', at:Date.UTC(2026,8,3,15,53), updated:Date.UTC(2026,8,3,16,10),
    note:'B5 pools with a twelve-channel' },
  { id:'p3', text:'make it look likea cowboy hat', target:null,
    status:'dropped', at:Date.UTC(2026,8,1,18,58), updated:Date.UTC(2026,8,1,18,59) },
];
for (let i = 0; i < 120; i++)
  rows.push({ id:'b'+i, text:'bulk request '+i, target:{id:'n1',key:'B1',name:'Thaw',shape:'box'},
              status:'done', at:Date.UTC(2026,7,29,20,0) - i*60000,
              updated:Date.UTC(2026,7,29,20,0) - i*60000 });

/* handed back deliberately out of order */
rows.sort(() => Math.random() - 0.5);

const calls = [];
await p.route('**/api/**', r => {
  const u = new URL(r.request().url());
  calls.push(r.request().method() + ' ' + u.pathname + u.search);
  if (u.pathname.endsWith('molecular_prompts') && r.request().method() === 'GET')
    return r.fulfill({ status:200, contentType:'application/json',
                       body: JSON.stringify({ prompts: rows, total: rows.length, pages: 2 }) });
  return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":true}' });
});

await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(700);

// ---- the button is in the top bar, next to Edit visual ----
const bar = await p.$$eval('header .controls .ctl', b => b.map(x => x.textContent.trim()));
ok(bar.includes('View prompt history'), 'the button is in the top bar');
ok(bar.indexOf('View prompt history') === bar.indexOf('Edit visual') + 1,
   'and it sits next to Edit visual  [' + bar.join(' | ') + ']');
ok(await p.isVisible('#btnHistory'), 'it is visible without entering edit mode');
ok(!await p.isVisible('#hist'), 'the panel starts closed');

// ---- it opens, and reads the WHOLE record ----
calls.length = 0;
await p.click('#btnHistory');
await p.waitForTimeout(500);
ok(await p.isVisible('#hist'), 'clicking it opens the panel');
const got = calls.filter(c => c.includes('molecular_prompts'));
ok(got.length === 1, 'one call to the queue (' + got.join(', ') + ')');
ok(got[0].includes('all=1'), 'and it asks for the whole record, not the recent window');
ok(got[0].startsWith('GET /api/molecular_prompts'), 'against THIS map\'s endpoint, not /pipeline\'s');

// ---- every row is on screen, newest first ----
const shown = await p.$$('#histList .hrow');
ok(shown.length === rows.length, `all ${rows.length} rows rendered (got ${shown.length})`);
/* asserted as a property, not against a literal date: the panel sorts what it
   was given, and a record that came back out of order still has to read in
   order. The fixture is deliberately shuffled to prove the sort is the panel's
   and not the server's. */
const order = await p.$$eval('#histList .hrow .htext', e => e.map(x => x.textContent.slice(0,40)));
const want = rows.slice().sort((a,b) => b.at - a.at).map(r => r.text.slice(0,40));
ok(order.join('|') === want.join('|'), 'newest first, all the way down');
const meta0 = await p.textContent('#histList .hrow:first-child .hmeta');
ok(/3 Sep 2026/.test(meta0), 'and dates read plainly (' + meta0.trim() + ')');
const first = await p.textContent('#histList .hrow:first-child .htext');
ok(first.includes('add another module'), 'the top row shows its prompt text');

// ---- status, target and the note ----
const stats = await p.$$eval('#histList .hrow .hstat', e => e.slice(0,3).map(x => x.textContent.trim()));
ok(stats[0] === 'drawing' && stats[1] === 'done' && stats[2] === 'dropped',
   'each row is labelled with its status [' + stats.join(', ') + ']');
ok((await p.textContent('#histList .hrow:nth-child(2) .hmeta')).includes('Pool and split'),
   'the step it was aimed at leads the line');
ok((await p.textContent('#histList .hrow:first-child .hmeta')).includes('no step selected'),
   'and a request sent with nothing selected says so');

// ---- a long prompt is clamped, and opens ----
const row2 = '#histList .hrow:nth-child(2)';
const clamped = await p.$eval(row2 + ' .htext', e => e.scrollHeight > e.clientHeight + 2);
ok(clamped, 'a long prompt is cut down to a couple of lines');
ok(!await p.isVisible(row2 + ' .hnote'), 'and its note is folded away with it');
await p.click(row2);
await p.waitForTimeout(150);
ok(await p.$eval(row2 + ' .htext', e => e.scrollHeight <= e.clientHeight + 2), 'clicking it opens it in full');
ok(await p.isVisible(row2 + ' .hnote'), 'and shows what was done about it');
await p.click(row2);
ok(await p.$eval(row2 + ' .htext', e => e.scrollHeight > e.clientHeight + 2), 'clicking again folds it back');

// ---- READ ONLY ----
calls.length = 0;
await p.click(row2); await p.click(row2);
await p.click('#histList .hrow:first-child');
await p.waitForTimeout(200);
ok(calls.filter(c => c.startsWith('POST')).length === 0,
   'nothing in the panel writes anything back  [' + (calls.join(', ') || 'no calls') + ']');

// ---- the keys do not reach the map behind it ----
const where = () => p.evaluate(() => {
  const w = document.querySelector('#world, svg > g');
  return (w && w.getAttribute('transform')) || '';
});
const before = await where();
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
await p.keyboard.press('Home');
await p.waitForTimeout(400);
ok(await where() === before, 'the arrows and Home do not walk the map behind the panel');
ok(await p.isVisible('#hist'), 'and the panel is still open');

// ---- and it closes, three ways ----
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok(!await p.isVisible('#hist'), 'Escape closes it');
await p.click('#btnHistory'); await p.waitForTimeout(300);
await p.click('#histX'); await p.waitForTimeout(150);
ok(!await p.isVisible('#hist'), 'the × closes it');
await p.click('#btnHistory'); await p.waitForTimeout(300);
await p.click('#hist', { position: { x: 8, y: 8 } }); await p.waitForTimeout(150);
ok(!await p.isVisible('#hist'), 'clicking outside the box closes it');

// ---- an empty record, and a broken one, say so rather than showing nothing ----
rows.length = 0;
await p.click('#btnHistory'); await p.waitForTimeout(400);
ok((await p.textContent('#histList')).includes('Nothing has been asked'),
   'an empty record says so');

ok(errs.length === 0, 'no page errors  ' + errs.slice(0,2).join(' / '));
console.log(bad ? `\n${bad} FAILED` : '\nprompt history: all checks pass');
await b.close();
process.exit(bad ? 1 : 0);
