import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--no-sandbox','--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport:{ width:1700, height:950 } });
await p.goto(process.argv[2], { waitUntil:'networkidle' });
await p.waitForTimeout(1000);
// force every tier on: fine labels are display:none at the overview zoom and
// getBBox() reports 0x0 for those, which would silently skip most of the map
await p.evaluate(() => {
  document.getElementById('svg').classList.remove('coarse');
  const st = document.createElement('style');
  st.textContent = 'svg.coarse .fine{display:block!important}';
  document.head.appendChild(st);
});
await p.waitForTimeout(400);
const res = await p.evaluate(() => {
  const ts = [...document.querySelectorAll('#svg text')];
  const boxes = ts.map(t => {
    const b = t.getBBox();
    return { s: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height, fine: t.classList.contains('fine') };
  }).filter(b => b.w > 0 && b.s.trim());
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    // shrink by 1px each side: touching baselines are not a collision
    const ox = Math.min(a.x+a.w, c.x+c.w) - Math.max(a.x, c.x) - 2;
    const oy = Math.min(a.y+a.h, c.y+c.h) - Math.max(a.y, c.y) - 2;
    if (ox > 0 && oy > 0) hits.push({ a: a.s, b: c.s, ox: +ox.toFixed(1), oy: +oy.toFixed(1) });
  }
  return { count: boxes.length, hits };
});
console.log(`${res.count} text nodes; ${res.hits.length} overlapping pairs`);
res.hits.slice(0, 40).forEach(h =>
  console.log(`  [${h.ox}x${h.oy}px]  "${h.a.slice(0,44)}"  ><  "${h.b.slice(0,44)}"`));
await b.close();
