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

   AND THAT THE GRID STILL COVERS THE DRAWING. The grid is the paper; a map
   that has outgrown it reads as having fallen off the edge of the sheet. This
   has happened twice — once when row 3's culls went to 4.2 units each, once
   when that row split in two — and neither time did anything else look wrong,
   because the fit camera measures the CONTENT and quietly framed a drawing
   with no paper under half of it. Extending the paper costs nothing but the
   lines, so the bounds are generous and this asserts they stay that way.
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
  /* the paper, against everything drawn on it */
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  NODES.forEach(n => {
    const hw = (n.w || 0) / 2, hd = (n.d || 0) / 2;
    x0 = Math.min(x0, n.x - hw); x1 = Math.max(x1, n.x + hw);
    y0 = Math.min(y0, n.y - hd); y1 = Math.max(y1, n.y + hd);
  });
  BANDS.forEach(b => {
    x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1);
    y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1);
  });
  const short = [];
  if (GRID.x0 > x0) short.push(`left by ${(GRID.x0 - x0).toFixed(1)}`);
  if (GRID.x1 < x1) short.push(`right by ${(x1 - GRID.x1).toFixed(1)}`);
  if (GRID.y0 > y0) short.push(`top by ${(GRID.y0 - y0).toFixed(1)}`);
  if (GRID.y1 < y1) short.push(`bottom by ${(y1 - GRID.y1).toFixed(1)}`);
  return { cross, onCross, dirs, wrong, short };
}, ROW_GAP);

if (found.cross.length)
  fail(`${found.cross.length} edge(s) span two rows: ${found.cross.join(', ')}`);
if (found.onCross)
  fail(`${found.onCross} dot(s) are travelling on a row-to-row track`);
if (found.wrong.length)
  fail(`these lanes do not read left to right: ${found.wrong.join(', ')} — ` +
       `all four rows read the same way, and a flipped one says so nowhere on screen`);

if (found.short.length)
  fail(`the grid falls short of the drawing — ${found.short.join(', ')}. The map has ` +
       `outgrown its paper, and the fit camera measures content so nothing else looks wrong.`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `rows: nothing is drawn between them, no dot is travelling between them, all ` +
    `${found.dirs.length} lanes read left to right, and the grid covers everything drawn on it`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
