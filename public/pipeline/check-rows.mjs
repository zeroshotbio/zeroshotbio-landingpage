/* check-rows.mjs — the rows do not connect to each other, and that is on purpose.
   Run: node check-rows.mjs <url>            (needs playwright)

   Every row reads left to right and the rows are stacked in the order things
   happen, so "this row feeds the next" is already said by where they sit.
   Drawing it as well meant a track running the entire length of a row
   backwards, three times, to state something no reader was in doubt about —
   and a track is the loudest thing on this map after the objects themselves.

   Every track that is left says something position does not: which of two
   forks a thing took, that a reference feeds a step it is not beside, that a
   cull drops into a ledger. A row-to-row track said nothing of the sort, so
   a row now simply ends.

   THIS IS EASY TO UNDO BY ACCIDENT. Adding an edge is one line in the data
   file and the obvious line to add is the one joining two rows — it is what
   the prose describes, after all. So it is asserted rather than left to
   memory: NO EDGE MAY SPAN TWO ROWS, and no dot may be travelling on one.

   If you ever do want them back, they need routing that goes AROUND rather
   than across: a straight run between two rows cuts diagonally through every
   object on the row it is leaving. git has the version that did.

   Also checked: every lane runs the same direction, because the whole reason
   the returns became long enough to be a problem is that all four were turned
   to read the same way. A lane quietly flipped back is a row that reads
   against its neighbours with nothing on screen saying so.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8732/pipeline';
const ROW_GAP = 6;          // grid units: more than this apart is a different row

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.route('**/api/pipeline_*', r => r.fulfill({ status: 200,
  contentType: 'application/json', body: '{"offsets":null,"text":null,"at":null}' }));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };

const found = await page.evaluate(gap => {
  const byId = {}; NODES.forEach(n => byId[n.id] = n);
  const cross = EDGES.filter(e => {
    const A = byId[e.a], B = byId[e.b];
    return A && B && Math.abs(A.y - B.y) > gap;
  }).map(e => `${e.a} -> ${e.b}`);
  const onCross = DOTS.filter(d => d.e && byId[d.e.a] && byId[d.e.b] &&
    Math.abs(byId[d.e.a].y - byId[d.e.b].y) > gap).length;
  const dirs = LANES.map(L => `${L.id}:${L.dir}`);
  const wrong = LANES.filter(L => L.dir !== 1).map(L => L.id);
  return { cross, onCross, dirs, wrong };
}, ROW_GAP);

if (found.cross.length)
  fail(`${found.cross.length} edge(s) span two rows: ${found.cross.join(', ')}`);
if (found.onCross)
  fail(`${found.onCross} dot(s) are travelling on a row-to-row track`);
if (found.wrong.length)
  fail(`these lanes do not read left to right: ${found.wrong.join(', ')} — ` +
       `all four rows read the same way, and a flipped one says so nowhere on screen`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `rows: nothing is drawn between them, no dot is travelling between them, and all ` +
    `${found.dirs.length} lanes read left to right`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
