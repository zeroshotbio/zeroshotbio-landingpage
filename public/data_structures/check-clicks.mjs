/* check-clicks.mjs — every station must select ITSELF on a real click.
   Run: node check-clicks.mjs <url>          (needs playwright)

   WHY THIS FILE EXISTS
   Selection broke once and shipped, because the test that was supposed to
   cover it dispatched `new MouseEvent('click')` straight at a station's <g>.
   That path always works. The path that was broken is the real one: a browser
   click is pointerdown -> pointerup -> click, and the <svg> was calling
   setPointerCapture() on pointerdown. Pointer capture RETARGETS the
   compatibility click event to the capturing element, so the click was
   delivered to the <svg> instead of the station, the station's handler never
   ran, its stopPropagation never happened, and the background handler cleared
   the selection. Every click on the map read as a click on nothing.

   So: only p.mouse.click() here. Never dispatchEvent. A synthetic event is
   not evidence about a real one.

   The hit point for each station is chosen by elementFromPoint rather than by
   assuming the centre is clickable — stations NEST (cells sit inside a repo
   floor), so a floor's centre legitimately belongs to a cell.
*/
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node check-clicks.mjs <url>'); process.exit(2); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const title = () => page.evaluate(() =>
  document.querySelector('#read .title')?.textContent || '(none)');

const points = await page.evaluate(() => {
  const out = [];
  for (const g of document.querySelectorAll('#svg g[role=button]')) {
    const label = g.getAttribute('aria-label'), r = g.getBoundingClientRect();
    let at = null;
    for (const [fx, fy] of [[.5, .5], [.5, .08], [.12, .5], [.88, .5], [.5, .92], [.25, .2]]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy;
      const owner = document.elementFromPoint(x, y)?.closest('g[role=button]');
      if (owner === g) { at = { x, y }; break; }
    }
    out.push({ label, ...(at || {}) });
  }
  return out;
});

let bad = 0;
for (const s of points) {
  if (s.x == null) { console.log(`  skip  ${s.label} — no unobstructed point`); continue; }
  await page.mouse.click(s.x, s.y);
  await page.waitForTimeout(140);
  const t = await title();
  if (t !== s.label) { bad++; console.log(`  FAIL  "${s.label}" -> reader showed "${t}"`); }
}

/* the background must still clear, and a pan must NOT be read as a click */
const empty = await page.evaluate(() => {
  const r = document.getElementById('svg').getBoundingClientRect();
  for (let y = r.y + 20; y < r.y + r.height - 60; y += 17)
    for (let x = r.x + 20; x < r.x + r.width - 20; x += 17) {
      const e = document.elementFromPoint(x, y);
      if (e?.closest('#svg') && !e.closest('g[role=button]')) return { x, y };
    }
  return null;
});
if (empty) {
  await page.mouse.click(empty.x, empty.y); await page.waitForTimeout(220);
  const t = await title();
  if (t !== 'Data Structures') { bad++; console.log(`  FAIL  background click -> "${t}", expected the overview`); }
}

const first = points.find(s => s.x != null);
await page.mouse.click(first.x, first.y); await page.waitForTimeout(180);
const held = await title();
await page.mouse.move(900, 500); await page.mouse.down();
await page.mouse.move(1060, 565, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(220);
if (await title() !== held) { bad++; console.log(`  FAIL  a pan cleared the selection`); }

const n = points.filter(s => s.x != null).length;
console.log(bad
  ? `${n} stations clicked; ${bad} FAILURES`
  : `${n} stations clicked; each selects itself; background clears; a pan does not`);
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
