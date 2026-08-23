/* check-clicks.mjs — every tile must load its own entry on a real click.
   Run: node check-clicks.mjs <url>          (needs playwright)

   The cards here are HTML buttons rather than SVG groups, so this is simpler
   than /data_structures' equivalent — but the rule that produced it is the
   same and is worth restating, because ignoring it shipped a broken page once:

     USE page.mouse.click, NEVER dispatchEvent.

   A synthetic click dispatched straight at an element takes a path the browser
   never takes. The bug it hid on /data_structures was pointer capture
   retargeting the compatibility click event away from its target, which a
   dispatched MouseEvent cannot reproduce because it skips pointer events
   entirely. A synthetic event is not evidence about a real one.

   Also checks the left index, the keyboard walk, and both column borders.
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
await page.waitForTimeout(1200);

const title = () => page.evaluate(() =>
  document.querySelector('#read .title')?.textContent?.trim() || '(none)');
const width = sel => page.evaluate(s => {
  const e = document.querySelector(s);
  return e ? Math.round(e.getBoundingClientRect().width) : null;
}, sel);

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };

/* the reader opens on the overview */
if (!/Unfiltered/.test(await title())) fail(`initial reader entry was "${await title()}"`);

/* every card, clicked for real */
const ids = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.id));
const names = await page.evaluate(() =>
  Object.fromEntries(STAGES.map(s => [s.id, s.name])));

for (const id of ids) {
  await page.locator(`.card[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.locator(`.card[data-id="${id}"]`).click();
  await page.waitForTimeout(250);
  const t = await title();
  if (t !== names[id]) fail(`card "${id}" -> reader showed "${t}", expected "${names[id]}"`);
}

/* the left index, also clicked for real */
for (const id of ids) {
  await page.locator(`aside .row[data-id="${id}"]`).click();
  await page.waitForTimeout(220);
  const t = await title();
  if (t !== names[id]) fail(`index row "${id}" -> reader showed "${t}"`);
}

/* escape returns to the overview */
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
if (!/Unfiltered/.test(await title())) fail(`Escape did not return to the overview`);

/* the column borders: drag resizes, a click collapses, a click restores */
for (const [grip, panel, def] of [['gripL', 'aside', 238], ['gripR', '.reader', 360]]) {
  const tap = async () => {
    const b = await page.locator('#' + grip).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 300);
    await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(220);
  };
  if (await width(panel) !== def) fail(`${panel} started at ${await width(panel)}, expected ${def}`);
  await tap();
  if (await width(panel) !== 0) fail(`clicking ${grip} did not collapse ${panel}`);
  await tap();
  if (await width(panel) !== def) fail(`clicking ${grip} again did not restore ${panel}`);

  const b = await page.locator('#' + grip).boundingBox();
  const dx = grip === 'gripL' ? 90 : -90;
  await page.mouse.move(b.x + b.width / 2, b.y + 300);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + 300, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(220);
  if (Math.abs(await width(panel) - (def + 90)) > 8)
    fail(`dragging ${grip} resized ${panel} to ${await width(panel)}, expected ~${def + 90}`);
}

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `${ids.length} tiles + ${ids.length} index rows clicked; reader follows; both borders drag and collapse`);
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
