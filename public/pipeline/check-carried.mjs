/* check-carried.mjs — each row opens with the object it inherits, drawn again.
   Run: node check-carried.mjs <url>         (needs playwright)

   Nothing is drawn between the rows, which is right — they are stacked in the
   order things happen, so one feeding the next is already said by where they
   sit. But "already said" is doing a lot of work at the LEFT edge of a row,
   which is where a reader's eye lands first and is furthest from the thing
   the row above ended with. So each row after the first opens with the object
   it inherits: `carried:"<id>"` in the data file.

   THE FAILURE THIS EXISTS FOR IS A READER COUNTING TWO OF SOMETHING. There is
   one unfiltered matrix on this map and it appears twice, and everything
   below is about keeping those two facts from contradicting each other:

     SAME OBJECT   same shape, same size, same name as its source. A clone
                   that has drifted from what it clones is a second claim.

     FULL WEIGHT   and this is the reverse of where it started. The clones
                   were faded once, on the reasoning that a restatement should
                   not be mistaken for a second object. Faded, they stopped
                   reading as objects at all: the track leaving one and the
                   dots on that track looked like they came from nowhere,
                   because the thing they came from was a ghost. An object a
                   row inherits is the most solid thing on that row, not the
                   least. What says "restatement" is where it sits and what
                   the reader says about it.

     NOT A STEP    absent from the index and from the arrow-key walk. Both are
                   the reading order, and reading the same object twice is not
                   a step in it.

     NO PROSE      it holds no `does` of its own; the reader shows the
                   source's. One place to change it, no way for the two to
                   disagree.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8732/pipeline';
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

const found = await page.evaluate(() => {
  const out = { list: [], problems: [], indexed: [], walked: [] };
  const clones = NODES.filter(n => n.carried);
  clones.forEach(n => {
    const src = NODES.find(m => m.id === n.carried);
    if (!src) return out.problems.push(`${n.id} clones ${n.carried}, which is not on the map`);
    if (n.shape !== src.shape) out.problems.push(`${n.id} is a ${n.shape}, ${src.id} is a ${src.shape}`);
    if (n.w !== src.w || n.d !== src.d || n.h !== src.h)
      out.problems.push(`${n.id} is not the size of ${src.id}`);
    if (n.name !== src.name) out.problems.push(`${n.id} is called "${n.name}", ${src.id} is "${src.name}"`);
    /* nothing about it may be faded — see the note at the top */
    const g = [...document.querySelectorAll('#svg g[role=button]')]
      .find(e => e.getAttribute('aria-label') === n.name && e.getAttribute('transform') !== null) ||
      [...document.querySelectorAll('#svg g[role=button]')]
      .find(e => e.getAttribute('aria-label') === n.name);
    const ops = { box: g && g.getAttribute('opacity'),
                  name: labelEls[n.id] && labelEls[n.id].getAttribute('opacity'),
                  plinth: plinthEls[n.id] && plinthEls[n.id].getAttribute('opacity') };
    Object.entries(ops).forEach(([k, v]) => {
      if (v !== null && v !== undefined && parseFloat(v) < 0.99)
        out.problems.push(`${n.id}'s ${k} is drawn at ${v} — a row's inherited object is the ` +
          `most solid thing on that row, and faded it reads as a ghost the track comes out of`);
    });
    /* and it must be connected like everything else */
    const wired = EDGES.some(e => e.a === n.id || e.b === n.id);
    const dots = DOTS.filter(d => d.e && (d.e.a === n.id || d.e.b === n.id)).length;
    if (!wired) out.problems.push(`${n.id} has no track at all — it must join its row like any other object`);
    else if (!dots) out.problems.push(`${n.id}'s track carries no dots`);
    /* and it must carry no prose of its own */
    const own = Object.prototype.hasOwnProperty.call(
      (typeof CARRIED !== 'undefined' ? (CARRIED.find(c => c.id === n.id) || {}) : {}), 'does');
    if (own) out.problems.push(`${n.id} has a does of its own — a clone must not be a second claim`);
    out.list.push(`${n.id} = ${src.id} (${src.name})`);
  });
  const ids = new Set(clones.map(n => n.id));
  out.indexed = [...document.querySelectorAll('aside .row')]
    .map(r => r.dataset.id).filter(id => ids.has(id));
  return out;
});

if (!found.list.length) fail('no carried-in clones on this map at all');
found.problems.forEach(fail);
if (found.indexed.length)
  fail(`the index lists ${found.indexed.join(', ')} — a restatement is not a step in the reading order`);

/* the arrow keys must not stop on one either */
const walked = await page.evaluate(async () => {
  const seen = new Set();
  document.body.focus();
  for (let i = 0; i < NODES.length + 4; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise(r => setTimeout(r, 12));
    if (typeof current !== 'undefined' && current) seen.add(current);
  }
  return NODES.filter(n => n.carried).map(n => n.id).filter(id => seen.has(id));
});
if (walked.length) fail(`the arrow keys stop on ${walked.join(', ')} — a restatement is not a step`);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `carried: ${found.list.join(', ')} — each the same shape, size and name as its source, drawn `
    + `at full weight, wired into its row with dots, and in neither the index nor the walk`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
