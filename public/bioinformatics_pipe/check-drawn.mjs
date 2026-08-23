/* check-drawn.mjs — a saved position has to be in the PICTURE, not just in the
   record.
   Run: node check-drawn.mjs <url>           (needs playwright)

   THIS EXISTS BECAUSE check-persist.mjs PASSED WHILE THE MAP WAS VISIBLY
   WRONG. That check compares NODES.x — the model — and the model was correct
   the whole time: the name offsets saved, read back and applied to the node
   objects exactly as intended. They just never reached the screen. Two ways,
   both of which look like "it did not save" and neither of which any amount of
   staring at the record would reveal:

     A NAME is not drawn at a coordinate of its own. Its group is built from
     n.x and n.lab, and ldx/ldy reach it only through reposition(). On the load
     path that used to be called only via applyOffsets(), so the moment
     adopting a shared copy became a reload, nothing called it at all.

     THE ATTRITION BAND is drawn from x0/x1/yBase, derived from the buildings
     it spans, and its own dx reached the screen only as a translate measured
     from where it was drawn — which is zero at load, by construction.

   The rule this file enforces: WHERE A THING DRAWS AFTER A RELOAD IS WHERE IT
   WAS LEFT. Nothing about how it is stored, nothing about NODES.x. It measures
   the bounding box of the drawn group and pushes the centre back through the
   world CTM, because the camera re-fits after a drag and raw screen
   coordinates would compare two different cameras.

   It drags by the EDIT HANDLE, never the group's bbox centre: the band spans
   half the map, so its centre lands on a building, and pressing there drags
   the building instead — the band then reads as "unmoved" for entirely the
   wrong reason. That is a real false pass this check had before it was fixed.
*/
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8731/bioinformatics_pipe';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

let record = null, stamp = 0;
await p.route('**/api/bpipe_edits', r => {
  if (r.request().method() === 'POST') {
    record = JSON.parse(r.request().postData() || '{}').offsets; stamp += 1000;
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, at: stamp }) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ offsets: record, at: record ? stamp : null }) });
});

let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };
const go = async () => { await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2400); };

/* the bbox centre of a drawn group, in world coordinates */
const drawnAt = (id, kind) => p.evaluate(([i, k]) => {
  const el = k === 'node' ? nodeEls[i] : labelEls[i];
  if (!el) return null;
  const world = document.querySelector('#svg > g');
  const wm = world.getScreenCTM().inverse();
  const r = el.getBoundingClientRect();
  const pt = new DOMPoint(r.x + r.width / 2, r.y + r.height / 2).matrixTransform(wm);
  return [+pt.x.toFixed(1), +pt.y.toFixed(1)];
}, [id, kind]);

const handle = (id, kind) => p.evaluate(([i, k]) => {
  const host = k === 'node' ? nodeEls[i] : labelEls[i];
  const h = host.querySelector('.ehandle') || host;
  const r = h.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, [id, kind]);

async function trial(label, id, kind, dx, dy) {
  await go();
  await p.locator('#btnEdit').click();
  await p.waitForTimeout(400);
  const was = await drawnAt(id, kind);
  const t = await handle(id, kind);
  await p.mouse.move(t.x, t.y); await p.mouse.down();
  await p.mouse.move(t.x + dx, t.y + dy, { steps: 16 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const put = await drawnAt(id, kind);
  if (!was || !put) return fail(`${label}: nothing drawn to measure`);
  if (Math.hypot(put[0] - was[0], put[1] - was[1]) < 8)
    return fail(`${label}: the drag did not move the drawing — the rest proves nothing`);

  await p.locator('#btnSave').click(); await p.waitForTimeout(1400);
  await go();
  const back = await drawnAt(id, kind);
  const off = Math.hypot(back[0] - put[0], back[1] - put[1]);
  if (off > 0.6)
    fail(`${label}: saved, reloaded, and drew somewhere else — left at ` +
         `${JSON.stringify(put)}, came back at ${JSON.stringify(back)}, off by ${off.toFixed(1)}`);
}

await trial('a building',            'c4',    'node',  120, -60);
await trial("a building's name",     'c4',    'name',   70, -80);
await trial('"UNFILTERED MATRIX"',   'UD',    'name',   80, -70);
await trial('"FILTERED MATRIX"',     'FD',    'name',  -80,  70);
await trial('the attrition band',    'RIVER', 'node',  110,  60);
await trial("the band's name",       'RIVER', 'name',  -60, -60);

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : 'drawn: buildings, their names, both matrix names, the attrition band and its name all ' +
    'come back drawn where they were left');
if (errs.length) console.log('page errors:', errs);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
