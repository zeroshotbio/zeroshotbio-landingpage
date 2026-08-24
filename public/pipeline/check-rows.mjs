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

   AND THAT AN `even` LANE IS ACTUALLY EVEN. The lane engine's default is a
   major/minor rule: a landmark gets room to stand clear of the cluster either
   side of it, which is right on a row that is mostly small steps with two big
   things in it. On a row whose objects are all comparable it does the
   opposite — it invents a rhythm out of nothing and the row reads as
   clustered when nothing about it is. `even:true` says the spacing carries no
   meaning here. A node's own `gap` still overrides, which is the one way this
   can be true in the data and false on screen, so it is measured rather than
   assumed. The run is also checked to sit centred in the dotted mat under it:
   a row hard against one end of its own band reads as having slipped.

   AND THAT NO TRACK IS TOO SHORT FOR THE DOTS ON IT. A dot moves at a
   constant speed in pixels of track per second, so `t` wraps once per that
   many pixels — which means a track's LENGTH sets how often its dots restart.
   On a 2px run that was twenty-one laps a second, and two dots strobing in
   place is what it looks like. Not hypothetical: trimming tracks back to their
   objects' walls did exactly that to seventeen runs on rows 1 and 2, where the
   objects almost touch, and the map went from reading correctly to broken.

   THE MEASURE IS LAPS PER SECOND, read off the dots themselves rather than
   computed from a speed written down here. The first version of this hardcoded
   the pixel speed and a matching pixel floor, and both went stale the moment
   the dots were slowed down — a check that has to be edited whenever the thing
   it checks is tuned is a check that will one day be edited wrongly. Laps per
   second is the quantity that reads as a flicker, whatever the speed is.

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
  /* even lanes: every gap the same, and the run centred in its own band */
  const uneven = [], offcentre = [];
  LANES.filter(L => L.even).forEach(L => {
    const on = NODES.filter(n => n.lane === L.id && !n.follow).sort((a, b) => a.x - b.x);
    if (on.length < 2) return;
    const gaps = [];
    for (let i = 1; i < on.length; i++)
      gaps.push((on[i].x - on[i].w / 2) - (on[i - 1].x + on[i - 1].w / 2));
    const spread = Math.max(...gaps) - Math.min(...gaps);
    if (spread > 0.02) uneven.push(`${L.id} gaps vary by ${spread.toFixed(2)}`);
    const band = BANDS.find(b => Math.abs((b.y0 + b.y1) / 2 - L.y) < 1);
    if (band) {
      const l = (on[0].x - on[0].w / 2) - band.x0;
      const r = band.x1 - (on[on.length - 1].x + on[on.length - 1].w / 2);
      if (Math.abs(l - r) > 0.5)
        offcentre.push(`${L.id} sits ${l.toFixed(1)} from the left of its mat and ${r.toFixed(1)} from the right`);
    }
  });

  /* every track slow enough that its dots read as travelling rather than
     strobing — see the note at the top. `speed` IS laps per second: the dot
     advances t by speed*dt and t wraps at 1. */
  const MAX_LAPS = 1.1;
  const strobing = DOTS
    .filter(d => d.speed > MAX_LAPS)
    .map(d => `${d.e.a || d.e.fromName}->${d.e.b || d.e.toName} restarts ` +
              `${d.speed.toFixed(1)} times a second on ${Math.round(d.e.len)}px of track`);

  const short = [];
  if (GRID.x0 > x0) short.push(`left by ${(GRID.x0 - x0).toFixed(1)}`);
  if (GRID.x1 < x1) short.push(`right by ${(x1 - GRID.x1).toFixed(1)}`);
  if (GRID.y0 > y0) short.push(`top by ${(GRID.y0 - y0).toFixed(1)}`);
  if (GRID.y1 < y1) short.push(`bottom by ${(y1 - GRID.y1).toFixed(1)}`);
  return { cross, onCross, dirs, wrong, short, uneven, offcentre, strobing };
}, ROW_GAP);

if (found.cross.length)
  fail(`${found.cross.length} edge(s) span two rows: ${found.cross.join(', ')}`);
if (found.onCross)
  fail(`${found.onCross} dot(s) are travelling on a row-to-row track`);
if (found.wrong.length)
  fail(`these lanes do not read left to right: ${found.wrong.join(', ')} — ` +
       `all four rows read the same way, and a flipped one says so nowhere on screen`);

[...new Set(found.strobing)].forEach(m => fail(`a dot is strobing — ${m}. A dot moves at a ` +
  `constant speed, so a track's length sets how often its dots restart; much above once a ` +
  `second they stop reading as travel and start reading as a flicker.`));
found.uneven.forEach(m => fail(`an even lane is not even — ${m}. A node's own \`gap\` overrides ` +
  `\`even\`, which is how this stays true in the data and false on screen.`));
found.offcentre.forEach(m => fail(`${m} — an even row should sit centred in its own mat`));

if (found.short.length)
  fail(`the grid falls short of the drawing — ${found.short.join(', ')}. The map has ` +
       `outgrown its paper, and the fit camera measures content so nothing else looks wrong.`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `rows: nothing is drawn between them, no dot is travelling between them, all ` +
    `${found.dirs.length} lanes read left to right, the three even ones are even and centred in ` +
    `their mats, no track is short enough for its dots to strobe, and the grid covers ` +
    `everything drawn on it`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
