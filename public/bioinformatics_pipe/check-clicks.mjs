/* check-clicks.mjs — every building must load its own entry on a real click.
   Run: node check-clicks.mjs <url>          (needs playwright)

   USE page.mouse.click, NEVER dispatchEvent.

   A synthetic click dispatched straight at an element takes a path the
   browser never takes. The bug it hid on /data_structures was pointer capture
   retargeting the compatibility click event away from its target, which a
   dispatched MouseEvent cannot reproduce because it skips pointer events
   entirely. A synthetic event is not evidence about a real one — and this map
   pans on pointerdown, so the interaction it has to survive is precisely a
   press, a small drag, and a release.

   The buildings are SVG groups rather than HTML buttons, so the click has to
   land somewhere that is actually the building: the centre of its ROOF,
   projected to the screen through the live camera. The centre of the group's
   bounding box is not good enough — a group carries its own airborne cells
   and annotations, which stretch that box well past the walls and, for a
   couple of them, over a neighbour.

   Also checked: the left index, the keyboard walk, Escape, the dot payloads,
   and both column borders.
*/
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node check-clicks.mjs <url>'); process.exit(2); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };
const title = () => page.evaluate(() =>
  document.querySelector('#read .title')?.textContent?.trim() || '(none)');
const width = sel => page.evaluate(s => {
  const e = document.querySelector(s);
  return e ? Math.round(e.getBoundingClientRect().width) : null;
}, sel);

/* the reader opens on the overview. The expected string is read off OVERVIEW
   rather than written here — a hardcoded title in a checker is a second place
   to remember to change, and it silently passed for one build after the page
   had been renamed. */
const overviewTitle = await page.evaluate(() => OVERVIEW.title);
if (await title() !== overviewTitle)
  fail(`initial reader entry was "${await title()}", expected "${overviewTitle}"`);

const meta = await page.evaluate(() =>
  NODES.map(n => ({ id: n.id, name: n.name })));

/* where the centre of a building's roof is, right now, on screen */
const roofPoint = id => page.evaluate(i => {
  const n = NODES.find(m => m.id === i);
  const world = document.querySelector('#svg > g'), m = world.getScreenCTM();
  const p = P(n.x, n.y, topOf(n));
  return { x: m.a * p[0] + m.c * p[1] + m.e, y: m.b * p[0] + m.d * p[1] + m.f };
}, id);

/* every building, clicked for real */
for (const { id, name } of meta) {
  await page.keyboard.press('Home');            // back to the fitted view
  await page.waitForTimeout(1300);
  const p = await roofPoint(id);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(350);
  const t = await title();
  if (t !== name) fail(`building "${id}" -> reader showed "${t}", expected "${name}"`);
}

/* every index row, also clicked for real */
await page.keyboard.press('Escape');
for (const { id, name } of meta) {
  await page.locator(`aside .row[data-id="${id}"]`).click();
  await page.waitForTimeout(260);
  const t = await title();
  if (t !== name) fail(`index row "${id}" -> reader showed "${t}"`);
}

/* the keyboard walks the sequence in NODES order */
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1300);
if (await title() !== meta[0].name)
  fail(`ArrowRight from nothing selected showed "${await title()}", expected "${meta[0].name}"`);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1300);
if (await title() !== meta[1].name)
  fail(`a second ArrowRight showed "${await title()}", expected "${meta[1].name}"`);

/* escape returns to the overview */
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
if (await title() !== overviewTitle) fail('Escape did not return to the overview');

/* the dots carry payloads, and every edge kind must have one. Clicking one is
   fiddly to do reliably against a moving target, so the payload itself is
   exercised directly — what is being checked is that no edge kind on the map
   is missing from SNIPPETS, which would give a dead dot. */
const missing = await page.evaluate(() => {
  const kinds = new Set(EDGES.map(e => e.kind).concat(CARRIES.map(c => c.kind)));
  return [...kinds].filter(k => typeof SNIPPETS[k] !== 'function');
});
if (missing.length) fail(`edge kinds with no payload: ${missing.join(', ')}`);

/* every payload actually builds, and says which of its figures are real */
const payloadTrouble = await page.evaluate(() => {
  const out = [];
  for (const k in SNIPPETS) {
    try {
      const s = SNIPPETS[k]();
      if (!s || !s.text || !s.label) out.push(k + ': incomplete');
      if (!s.note) out.push(k + ': no note');
    } catch (e) { out.push(k + ': threw ' + e.message); }
  }
  return out;
});
for (const t of payloadTrouble) fail('payload ' + t);

/* the column borders: a click collapses, a click restores, a drag resizes */
for (const [grip, panel, def] of [['gripL', 'aside', 238], ['gripR', '.reader', 360]]) {
  const tap = async () => {
    const b = await page.locator('#' + grip).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 300);
    await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(240);
  };
  if (await width(panel) !== def) fail(`${panel} started at ${await width(panel)}, expected ${def}`);
  await tap();
  /* "collapsed" is not "exactly zero". Both columns carry a 1px border and
     box-sizing is border-box, so a panel set to width 0 still reports 1: the
     border cannot be narrower than itself. Asserting === 0 fails on a panel
     that is perfectly, visibly shut. */
  if (await width(panel) > 2) fail(`clicking ${grip} did not collapse ${panel}`);
  await tap();
  if (await width(panel) !== def) fail(`clicking ${grip} again did not restore ${panel}`);

  const b = await page.locator('#' + grip).boundingBox();
  const dx = grip === 'gripL' ? 90 : -90;
  await page.mouse.move(b.x + b.width / 2, b.y + 300);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + 300, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(240);
  if (Math.abs(await width(panel) - (def + 90)) > 8)
    fail(`dragging ${grip} resized ${panel} to ${await width(panel)}, expected ~${def + 90}`);
}

/* and nothing froze while all that was going on */
const diag = await page.evaluate(() => window.bpipeDiag());
if (!diag.moving) fail('the map is not animating');
if (diag.droppedTickers) fail(`${diag.droppedTickers} roof animation(s) threw and were dropped`);
if (diag.lastError) fail('a frame threw: ' + diag.lastError);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `${meta.length} buildings + ${meta.length} index rows clicked; reader follows; ` +
    `keyboard walks; every edge kind has a payload; both borders drag and collapse; ` +
    `${diag.tickers} roofs animating`);
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
