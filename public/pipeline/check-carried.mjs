/* check-carried.mjs — what opens a row.
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

   ROW 2 OPENS DIFFERENTLY, and the difference is the point. Its first object
   is not a restatement of the fixed material — it is the THAW, which is that
   step undone: the same freezer, the same plate, the same cells, running the
   other way. It was a clone once and read wrong for a reason worth keeping
   written down: the animation was still the FIXING animation, so the map
   showed a sample being put into the freezer at the head of the row that
   takes it out.

   The check on it is the one thing that cannot be true of both. drawVials
   moves a pipette tip across the wells while it fixes them, and NOTHING IS
   BEING ADDED TO A THAW. A thaw showing a tip is the fixing schedule running
   under a new name, which is exactly what was reported.
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

/* the thaw is the fixing step undone, not the fixing step relabelled */
const thaw = await page.evaluate(() => {
  const tip = nm => {
    const g = [...document.querySelectorAll('#svg g[role=button]')]
      .find(e => e.getAttribute('aria-label') === nm);
    if (!g) return null;
    /* the pipette: a <g> whose only child is a <g> holding exactly 3 <path> */
    const c = [...g.querySelectorAll('g')].find(e =>
      e.children.length === 1 && e.children[0].tagName === 'g' &&
      e.children[0].querySelectorAll('path').length === 3);
    return c ? parseFloat(c.getAttribute('opacity') || '1') : null;
  };
  return { thawTip: tip('Thaw'), fixTip: tip('Fixed material') };
});
if (thaw.thawTip === null) fail('there is no Thaw at the head of the chemistry row');
else if (thaw.thawTip > 0.01)
  fail('the Thaw is showing a pipette tip — nothing is added to a thaw, so this is the ' +
       'fixing schedule running under a new name, which is the bug this exists for');
if (thaw.fixTip !== null && thaw.fixTip < 0.99)
  fail('Fixed material is not showing its tip — the two steps are meant to differ, ' +
       'and they cannot differ if neither pipettes');

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
    else {
      /* AND ENOUGH OF THAT TRACK HAS TO BE IN THE OPEN. The occlusion clip
         punches every object's silhouette out of the edge layer, so any part
         of a track inside its own two objects is not drawn and a dot
         travelling it is invisible. Authored centre to centre that was a
         sliver at each end; with a 4.2-unit cull beside a 2.5-unit matrix it
         became two thirds of the run, and the two objects read as
         unconnected — the track was there and you could not see it move.

         Tracks are routed wall to wall now. The bar is ABSOLUTE, not a share:
         what a reader needs is enough visible line for a dot to read as
         travelling, and that is a length. A share would fail half the objects
         on row 1, which are packed close on purpose and have always been
         fine. */
      const e = EDGES.find(x => x.a === n.id) || EDGES.find(x => x.b === n.id);
      const other = NODES.find(m => m.id === (e.a === n.id ? e.b : e.a));
      if (other) {
        const clear = Math.abs(other.x - n.x) - (n.w + other.w) / 2;
        if (clear < 0.8)
          out.problems.push(`${n.id}'s track has only ${clear.toFixed(2)} units of open run before ` +
            `${other.id} — its dots spend the journey inside one building or the other`);
        /* AND THE TRACK MUST NOT START AT THE CENTRE. The line above measures
           the layout; this measures the routing, and they fail for different
           reasons — a wall-to-wall route reverted to centre-to-centre leaves
           the layout untouched and buries the track anyway. The drawn
           polyline's first point is compared with the node's own projected
           centre: they must not be the same place. */
        const rec = edgeGeom.find(r => r.a === e.a && r.b === e.b);
        if (rec && rec.segs && rec.segs.length) {
          const start = rec.a === n.id ? rec.segs[0].from
                      : (sg => [sg.from[0] + sg.dx, sg.from[1] + sg.dy])(rec.segs[rec.segs.length - 1]);
          const c = P(n.x, n.y, 0.02);
          if (Math.hypot(start[0] - c[0], start[1] - c[1]) < 4)
            out.problems.push(`${n.id}'s track starts at its own centre — routed centre to centre, ` +
              `so the occlusion clip buries everything inside the two objects`);
        }
      }
    }
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
    + `at full weight, wired into its row with dots, and in neither the index nor the walk; `
    + `and the Thaw runs the fixing step backwards rather than relabelled`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
