/* check-culls.mjs — the four roofed culls have to work HERE too.
   Run: node check-culls.mjs <url>           (needs playwright)

   The knee, mito, complexity and doublet roofs were written for
   /bioinformatics_pipe and are drawn on this map from the same file, in
   /culls/. That is the point of sharing them — two hand-maintained accounts
   of one pipeline drift — but it also means this page now depends on code
   whose other consumer is a page with different buildings, a different
   palette and a different reader. Every difference below is one that has
   already gone wrong once:

     THE BUILDINGS ARE SMALLER. A cull is 4.2 units there because that page is
     only this row; here it is 1.5, one object in one of four rows. Everything
     about an annotation scales with its roof for that reason, and the first
     version did not — the labels sat a building and a half away with leaders
     running off the bottom of the map.

     THE PALETTE HAS TO CARRY --keep / --cull / --accent. They are aliases
     onto tokens this page already had, and without them every mark on every
     roof renders black, which is what an undefined CSS variable looks like
     and is easy to mistake for a deliberate choice.

     THE READER HAS TO CARRY THE WORD "MODELLED". Every threshold on these
     roofs is computed from a simulated population, and a modelled figure that
     has lost that word claims a result nobody produced.

   And the roofs must ANIMATE: they register tickers on the page's single
   frame loop, and a roof that draws but never moves means the loop is not
   reaching it.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8732/pipeline';
const ROOFS = { c1: 'kneeroof', c3: 'mitoroof', c4: 'complexityroof', c5: 'doubletroof' };

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => {
  if (m.type() === 'error' && !/pipeline_edits|pipeline_prompts/.test(m.text()))
    errs.push('console: ' + m.text());
});
/* the authoring endpoints are stubbed: what is under test is this page, not
   DynamoDB, and a check that fails when a table is unreachable gets ignored */
await page.route('**/api/pipeline_*', r => r.fulfill({ status: 200,
  contentType: 'application/json', body: '{"offsets":null,"text":null,"at":null}' }));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };

/* THE MAP HAS AN OPENING SHOT NOW: it lands on the aquarium, holds, then pulls
   back to the fitted view. Anything that measures geometry has to let that
   finish first, exactly as a reader would — otherwise the camera moves between
   measuring a thing and touching it. */
async function cameraSettled(page, ms = 9000) {
  const t0 = Date.now();
  let last = null, stable = 0;
  while (Date.now() - t0 < ms) {
    const k = await page.evaluate(() => (typeof view !== 'undefined')
      ? [view.k, view.x, view.y, !!anim] : null);
    if (k && !k[3] && last && k[0] === last[0] && k[1] === last[1] && k[2] === last[2]) {
      if (++stable >= 2) return true;
    } else stable = 0;
    last = k;
    await page.waitForTimeout(250);
  }
  return false;
}

await cameraSettled(page);


/* ---- 1. the shared files loaded and the shapes are registered ----------- */
const wired = await page.evaluate(shapes => ({
  model: typeof MODEL !== 'undefined' && !!MODEL.cells,
  figures: typeof FIGURES !== 'undefined',
  missing: shapes.filter(s => !(typeof DRAW !== 'undefined' && DRAW[s])),
}), Object.values(ROOFS));
if (!wired.model) fail('MODEL is not defined — /culls/culls-pop.js or culls-draw.js did not load');
if (!wired.figures) fail('FIGURES is not defined — the reader cannot show a threshold');
if (wired.missing.length) fail('shapes not registered in DRAW: ' + wired.missing.join(', '));

/* ---- 2. every mark colour resolves ------------------------------------- */
for (const tok of ['--keep', '--cull', '--accent']) {
  const v = await page.evaluate(t => getComputedStyle(document.body).getPropertyValue(t).trim(), tok);
  if (!v) fail(`${tok} is not defined — every mark on every roof renders black`);
}

/* ---- 3. each roof draws, and moves ------------------------------------- */
const shot = () => page.evaluate(ids => {
  const out = {};
  ids.forEach(id => {
    const n = NODES.find(m => m.id === id);
    const g = [...document.querySelectorAll('#svg g[role=button]')]
      .find(g => g.getAttribute('aria-label') === (n && n.name));
    out[id] = g ? [...g.querySelectorAll('path,polyline,circle,line')]
      .map(e => (e.getAttribute('d') || '') + (e.getAttribute('points') || '') +
                (e.getAttribute('cx') || '') + (e.getAttribute('fill-opacity') || '')).join('~')
      : null;
  });
  return out;
}, Object.keys(ROOFS));
/* SAMPLE ACROSS A WHOLE LOOP, not across a moment. Each roof runs an eight
   or nine second sequence with deliberate still beats in it — a fit is drawn,
   then it sits while the band opens — so a 1.5s window lands inside one of
   those often enough to fail a roof that is working perfectly. Take a series
   and ask whether anything ever changed. */
/* WATCH THEM FROM WHERE A READER WATCHES THEM. The map is a still picture
   below MOTION_MIN (0.30) on purpose now — a phone opens at 0.057 and a laptop
   at about 0.16, and nothing mutates there, which is what makes a phone run at
   60fps. So this check has to zoom in before it can ask whether a roof moves,
   or it is asserting against a deliberately frozen map.

   AND FAR ENOUGH OUT THAT ALL FOUR ARE ON SCREEN AT ONCE: a shape off screen
   is skipped by design, so focusing one roof would freeze the other three and
   fail them. Row 4 is about forty units long, which fits at 0.4. */
await page.evaluate(() => {
  const roofs = ['c1','c3','c4','c5'].map(id => NODES.find(n => n.id === id)).filter(Boolean);
  const mx = roofs.reduce((a,n) => a + n.x, 0) / roofs.length;
  const my = roofs.reduce((a,n) => a + n.y, 0) / roofs.length;
  view.k = 0.7;                       /* above MOTION_MIN, which is 0.55 now */
  const q = P(mx, my, 0);
  view.x = innerWidth / 2 - q[0] * view.k;
  view.y = innerHeight / 2 - q[1] * view.k;
  document.querySelector('#svg > g').setAttribute('transform',
    `translate(${view.x},${view.y}) scale(${view.k})`);
});
await page.waitForTimeout(1500);
const frames = [await shot()];
for (let i = 0; i < 10; i++) { await page.waitForTimeout(1000); frames.push(await shot()); }
for (const id of Object.keys(ROOFS)) {
  if (frames[0][id] === null) { fail(`${id} did not draw at all`); continue; }
  if (frames.every(f => f[id] === frames[0][id]))
    fail(`${id} drew but never moved in 10s at zoom 0.7 — the frame loop is not reaching its ` +
         `ticker (the map is still below ${'0.60'} by design, so this is measured above it)`);
}

/* ---- 4. the annotations are near the roof they belong to ---------------- */
/* the failure this catches is the one that shipped: a fixed pixel offset,
   measured against a building 2.8x bigger, putting the label off the map */
const strays = await page.evaluate(() => {
  const out = [];
  if (typeof ANNOTATIONS === 'undefined') return out;
  ANNOTATIONS.forEach(a => {
    const host = NODES.find(n => a.key.startsWith(n.id + ':'));
    if (!host) return;
    const r = a.t1.getBBox();
    const q = P(host.x, host.y, host.h || 0);
    const d = Math.hypot(r.x + r.width / 2 - q[0], r.y + r.height / 2 - q[1]);
    /* MEASURED AGAINST THE ROOF'S OWN SIZE, in projected pixels, not in grid
       units. A label deliberately floats clear of its roof and points back at
       it — below the row, which in this projection is a long way in grid terms
       for a short way on screen, because down-screen is +x and +y at once.
       Grid distance flagged a label sitting exactly where it was put. What
       this is for is a label five buildings away, so the bound is a multiple
       of the building it belongs to. */
    const across = (host.w || 1) * S * Math.cos(Math.PI / 6) * 2;
    if (d > 3.2 * across)
      out.push(`${a.key} is ${(d / across).toFixed(1)} roof-widths from ${host.id}`);
  });
  return out;
});
strays.forEach(s => fail('an annotation drifted: ' + s));

/* ---- 5. the reader states that the figures are modelled ---------------- */
for (const id of Object.keys(ROOFS)) {
  await page.locator(`aside .row[data-id="${id}"]`).click();
  await page.waitForTimeout(220);
  const txt = await page.evaluate(() => document.querySelector('#read').textContent || '');
  if (!/What the roof shows/.test(txt)) fail(`${id}'s reader entry has no roof figures`);
  if (!/modelled/i.test(txt)) fail(`${id}'s reader entry does not say its threshold is modelled`);
}

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : 'culls: the shared roofs load, register, draw, animate, keep their annotations, resolve every '
    + 'mark colour, and say in the reader that their thresholds are modelled');
if (errs.length) console.log('page errors:', errs);
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
