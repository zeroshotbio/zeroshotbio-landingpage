/* check-fit.mjs — type has to fit the thing it is drawn in.
   Run: node check-fit.mjs <url>             (needs playwright)

   WHY THIS IS A SEPARATE FILE FROM check-overlaps.mjs. That one compares text
   against text and it reported 0 overlapping pairs while the bay's contents
   hung off both its edges, a conduit caption lay across the silver treemap,
   and a cell's note filled 91% of its box. None of those is a text-on-text
   collision. Two strings can miss each other perfectly and still both be in
   the wrong place, because the thing they are colliding with is a RECTANGLE —
   a box, a bucket wall, a zone.

   Four assertions, in order of how badly each reads:

     1  CONTAINMENT. A string drawn inside a node's box stays inside it. This
        is the one the reader sees first: text bleeding off both edges of a
        box makes the box look like the wrong size, which it is.

     2  TRESPASS. A string does not lie across a node box that is not its
        host. A conduit caption is not inside any box, so containment cannot
        see it — but it can still land on a bucket's treemap, which is what
        "written · pinned · not yet run" did to the silver vault. It read as a
        label on the tiles.

     3  CROWDING. A string inside a box uses at most CROWD of the box's width.
        Not a collision at all — a caption at 91% touches both walls and looks
        like it barely got in, next to neighbours sitting at 55%. The number is
        a house style rather than a law, and it is here because the eye reads
        the odd one out as a mistake.

     4  STRADDLING A ZONE. A string is wholly inside one of the two dotted
        enclosures or wholly outside it, never half of each. The zones say
        which system a thing belongs to — an S3 bucket or a git repository —
        and that is the most important distinction on the map. A conduit
        caption with its tail inside the S3 box claims a repo-side action is
        something S3 does. It is the failure that survives all three checks
        above, because a caption in the corridor is inside no node box at all.

   Everything is measured in GRID UNITS — getBBox() in user space, divided by
   S — so one run covers every zoom, exactly like check-overlaps.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8731/data_structures';
const CROWD = 0.80;   // fraction of its box's width a string may use
const SLACK = 0.02;   // grid units of tolerance, for rounding

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

/* Fine labels are display:none at the overview zoom and would measure 0x0.
   Force every tier visible, the same way check-overlaps does. */
await page.evaluate(() => {
  document.querySelectorAll('#svg [data-tier]').forEach(e => (e.style.display = ''));
});
await page.waitForTimeout(300);

const found = await page.evaluate(({ CROWD, SLACK }) => {
  const out = [];
  /* every node's box, in grid units */
  const boxes = NODES.map(n => ({
    id: n.id, name: n.name,
    x0: n.x - n.w / 2, x1: n.x + n.w / 2,
    y0: n.y - n.h / 2, y1: n.y + n.h / 2, w: n.w
  }));
  /* a box a caption is allowed to lie across: the rail is tapped by captions
     that name the tap, and the two zones are grounds rather than objects */
  const OPEN = new Set(['MED']);

  document.querySelectorAll('#svg text').forEach(t => {
    const s = (t.textContent || '').trim();
    if (!s) return;
    if (parseFloat(getComputedStyle(t).fillOpacity || '1') < 0.08) return;
    const bb = t.getBBox();
    if (!bb.width || !bb.height) return;
    const x0 = bb.x / S, x1 = (bb.x + bb.width) / S;
    const y0 = bb.y / S, y1 = (bb.y + bb.height) / S;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0;

    /* THE BOXES NEST — a cell sits inside a repo floor, a treemap tile inside
       a vault — so "the box its centre falls in" is several boxes, and the one
       that owns the caption is the SMALLEST of them. Taking the first match
       instead made every cell's own text trespass on itself, which is the sort
       of finding that gets a check switched off. */
    const inside = boxes.filter(b => cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1);
    const area = b => (b.x1 - b.x0) * (b.y1 - b.y0);
    const host = inside.sort((a, b) => area(a) - area(b))[0];

    if (host) {
      const over = Math.max(0, host.x0 - x0) + Math.max(0, x1 - host.x1);
      if (over > SLACK)
        out.push({ kind: 'containment', s, host: host.id,
          msg: `"${s}" hangs ${over.toFixed(2)} grid units off the edges of ${host.id} ` +
               `(text ${w.toFixed(2)}, box ${host.w})` });
      else if (w / host.w > CROWD)
        out.push({ kind: 'crowding', s, host: host.id,
          msg: `"${s}" fills ${(100 * w / host.w).toFixed(0)}% of ${host.id}'s width ` +
               `(text ${w.toFixed(2)}, box ${host.w}) — the cap is ${(100 * CROWD).toFixed(0)}%` });
    }

    /* Straddling: half in a zone, half out. */
    (typeof ZONES === 'undefined' ? [] : ZONES).forEach(z => {
      const ox = Math.min(x1, z.x1) - Math.max(x0, z.x0);
      const oy = Math.min(y1, z.y1) - Math.max(y0, z.y0);
      if (oy <= SLACK) return;                       // not beside it at all
      if (ox > SLACK && ox < w - SLACK)
        out.push({ kind: 'zone', s, host: z.name,
          msg: `"${s}" straddles the ${z.name} boundary — ${ox.toFixed(2)} of its ` +
               `${w.toFixed(2)} is inside, the rest is out` });
    });

    /* Trespass: lying across a box the caption is NOT centred in. Anything
       containing the centre is an enclosure it legitimately sits inside, so
       the whole `inside` set is exempt rather than just the host. */
    boxes.forEach(b => {
      if (inside.includes(b) || OPEN.has(b.id)) return;
      const ox = Math.min(x1, b.x1) - Math.max(x0, b.x0);
      const oy = Math.min(y1, b.y1) - Math.max(y0, b.y0);
      if (ox > SLACK && oy > SLACK)
        out.push({ kind: 'trespass', s, host: b.id,
          msg: `"${s}" lies ${ox.toFixed(2)} x ${oy.toFixed(2)} across ${b.id}, ` +
               `which is not the box it belongs to` });
    });
  });
  return out;
}, { CROWD, SLACK });

for (const f of found) console.log(`  FAIL  [${f.kind}] ${f.msg}`);
console.log(found.length
  ? `\n${found.length} FAILURE(S)`
  : 'fit: every string is inside its own box, clear of every other box and of both zone '
    + `boundaries, and none fills more than ${(100 * CROWD).toFixed(0)}% of the box it is in`);
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(found.length || errs.length ? 1 : 0);
