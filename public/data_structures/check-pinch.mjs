/* check-pinch.mjs — the camera under a two-finger pinch, the way an iPad drives it.
   Run: node check-pinch.mjs <url>          (needs playwright)

   Emulates touch in Chromium (CDP Input.dispatchTouchEvent, two touch points) at an iPad-sized
   viewport and reads the camera straight off the root <g>'s transform. Checks, 2026-09-11:
     - a pinch-out whose fingers spread 3x zooms exactly 3x, about the point between the fingers
     - moving both fingers together pans and does not zoom
     - a heavy wheel zoom-out stops at MIN_ZOOM_OF_FIT x the fit zoom
     - no <text> is hidden at that floor, and nothing sets svg.coarse
   Before the pointer rewrite, each finger's pointermove also dragged the camera, and the pinch
   scaled about the canvas corner; at this viewport the fit zoom (~0.21) was already below the old
   fine-tier cut-off (0.25), so small labels were hidden before the reader touched anything.
*/
import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(900);
const cam = () => p.evaluate(() => {
  const g = document.querySelector('#svg > g');
  const m = g.getAttribute('transform').match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/);
  return { x: +m[1], y: +m[2], z: +m[3] };
});
const box = await p.evaluate(() => { const r = document.getElementById('svg').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const fit = await cam();
const cx = box.l + box.w * 0.4, cy = box.t + box.h * 0.5;
const model = c => ({ x: (cx - box.l - c.x) / c.z, y: (cy - box.t - c.y) / c.z });
const cdp = await ctx.newCDPSession(p);
const tp = (d, sx = 0, sy = 0) => [{ x: cx - d + sx, y: cy + sy, id: 1 }, { x: cx + d + sx, y: cy + sy, id: 2 }];
// pinch out, fingers 120px -> 360px apart, midpoint fixed
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(60) });
for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(60 + i * 12) }); await p.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(250);
const a1 = await cam(), m0 = model(fit), m1 = model(a1);
console.log(`pinch-out: z ${fit.z.toFixed(4)} -> ${a1.z.toFixed(4)}, ratio ${(a1.z / fit.z).toFixed(3)} (fingers 3.000x)`);
console.log(`model point under the pinch midpoint moved ${Math.hypot(m1.x - m0.x, m1.y - m0.y).toFixed(3)} model units (0 = anchored)`);
// two-finger pan: both fingers move 100px right together, spread unchanged
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(80) });
for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(80, i * 10, 0) }); await p.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(250);
const a2 = await cam();
console.log(`two-finger pan: dx ${(a2.x - a1.x).toFixed(1)}px (expect ~100), dz ${(a2.z / a1.z).toFixed(3)} (expect 1)`);
// heavy zoom-out with the wheel: must stop at the floor
await p.mouse.move(box.l + box.w / 2, box.t + box.h / 2);
for (let i = 0; i < 40; i++) await p.mouse.wheel(0, 400);
await p.waitForTimeout(400);
const f = await cam();
console.log(`heavy zoom-out: z ${f.z.toFixed(4)} = ${(f.z / fit.z).toFixed(3)} x fit (floor 0.600)`);
const vis = await p.evaluate(() => {
  const t = [...document.querySelectorAll('#svg text')];
  return { total: t.length, hidden: t.filter(x => { const s = getComputedStyle(x); return s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0; }).length,
           coarseClass: document.getElementById('svg').classList.contains('coarse') };
});
console.log(`text at the floor: ${vis.hidden} of ${vis.total} hidden; svg.coarse set: ${vis.coarseClass}`);
console.log(`page errors: ${errs.length}${errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
