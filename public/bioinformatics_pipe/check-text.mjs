/* check-text.mjs — no label may leave its tile, at any frame.
   Run: node check-text.mjs <url>            (needs playwright)

   WHY THIS FILE EXISTS
   Canvas text leaves no DOM behind, so /data_structures' trick of walking
   <text> nodes and comparing getBBox() does not transfer. Without something
   like this the only check is looking at it, and looking at it missed the same
   class of bug three times: a label sized against a GUESSED character advance
   (0.6 em) drawn with a font whose real advance was 0.93 em, running off the
   right edge of three different tiles.

   bp-draw.js's tracked() pushes every string it draws to window.__BP_TEXTLOG
   when that array exists. This walks all six tiles across the whole loop and
   asserts two things:

     1. every drawn string lies inside its own tile
     2. no two strings drawn in the same frame overlap each other

   Failures print the tile, the time, and the string, because the frame matters
   — most of these bugs only appear during one beat.
*/
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node check-text.mjs <url>'); process.exit(2); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

/* Two sizes: the column size and the preview size. A label that fits at 420px
   can still overflow at 190px, because type shrinks with u but the shrink-to-
   fit floor does not. */
const SIZES = [190, 420];
const TIMES = Array.from({ length: 24 }, (_, i) => +(i / 24).toFixed(3));

const findings = await page.evaluate(({ SIZES, TIMES }) => {
  const out = [];
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');

  for (const S of SIZES) {
    cv.width = S; cv.height = S;
    for (const name of TILE_ORDER) {
      for (const t of TIMES) {
        window.__BP_TEXTLOG = [];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, S, S);
        try { TILES[name](tileCtx(ctx, S, 'dark'), t); }
        catch (e) { out.push({ kind: 'throw', tile: name, S, t, s: String(e) }); continue; }

        const log = window.__BP_TEXTLOG;
        for (const b of log) {
          if (b.x < -0.5 || b.x + b.w > S + 0.5 || b.y < -0.5 || b.y + b.h > S + 0.5)
            out.push({ kind: 'outside', tile: name, S, t, s: b.s,
                       at: [Math.round(b.x), Math.round(b.y)], w: Math.round(b.w) });
        }
        for (let i = 0; i < log.length; i++)
          for (let j = i + 1; j < log.length; j++) {
            const a = log[i], b = log[j];
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - 1;
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - 1;
            if (ox > 0 && oy > 0)
              out.push({ kind: 'overlap', tile: name, S, t, s: a.s + '  ><  ' + b.s });
          }
      }
    }
  }
  window.__BP_TEXTLOG = null;
  return out;
}, { SIZES, TIMES });

/* One report line per distinct (kind, tile, string) — the same label usually
   fails on many consecutive frames and listing each is noise. */
const seen = new Map();
for (const f of findings) {
  const key = f.kind + '|' + f.tile + '|' + f.s;
  if (!seen.has(key)) seen.set(key, { ...f, n: 0 });
  seen.get(key).n++;
}
const rows = [...seen.values()].sort((a, b) => b.n - a.n);
rows.forEach(f => console.log(
  `  ${f.kind.toUpperCase().padEnd(7)} ${f.tile.padEnd(11)} S=${String(f.S).padEnd(4)} ` +
  `${f.n} frame(s)  "${String(f.s).slice(0, 64)}"`));

const nT = SIZES.length * TIMES.length * 6;
console.log(rows.length
  ? `\n${rows.length} distinct text problem(s) over ${nT} tile-frames`
  : `${nT} tile-frames checked; every label inside its tile, none overlapping`);
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(rows.length || errors.length ? 1 : 0);
