/* check-text.mjs — no label may leave its building, and no two may collide.
   Run: node check-text.mjs <url>            (needs playwright)

   The old version of this file measured canvas text, because the page used to
   be six canvas tiles. It is an SVG map now, so the measurement is different
   and the failure it catches is the same one: type that renders perfectly at
   the size you happened to be looking at and runs off the edge at every other
   size, or lands on top of something else.

   WHAT MAKES THIS PAGE PARTICULARLY EASY TO GET WRONG
   The added roof is drawn in a flat 176 x 176 chart space and then laid onto
   a building by one matrix. Inside that space nothing tells you how wide a
   string will be on the roof, or where it will end up: text does not wrap, it
   hangs off the side of the building into the sky, and a block of it fans as
   it grows because its two axes are the two roof diagonals. From the right
   angle at the right zoom both look deliberate.

   MEASURE THE ORIENTED BOX, NEVER THE AXIS-ALIGNED ONE.
   This is the whole reason the file is longer than it looks like it should
   be, and the first version of it was useless for exactly this reason. Roof
   text is SHEARED: it runs at ±30° across the screen. Its axis-aligned
   bounding box is therefore enormous and mostly empty, and two stacked lines
   of the same readout — which do not touch — report an 85% overlap. Every box
   here is the element's own getBBox() pushed through getScreenCTM(), giving
   the true rotated quadrilateral, and overlap is the real intersection area
   from clipping one convex quad against the other.

   The checks:
     1  no console warning at all from the drawing code. Anything that warns
        during a draw is a measurement the shape could not satisfy.
     2  roof text stays on its roof. Anything under a roof matrix is tested
        against that building's roof quad. Annotations are exempt by design —
        they float above the roof and point down onto it — and are identified
        by living outside the matrix group.
     3  nothing overlaps anything, by true intersection area.

   Checked at both zooms the map is read at: fitted, and walked one building
   at a time.
*/
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('usage: node check-text.mjs <url>'); process.exit(2); }

/* OVERLAP IS A SHARE, AND IT HAS A BLIND SPOT WORTH KNOWING ABOUT. Two strings
   that meet with almost no overlap at all still read as one word: "BC3" and
   "UMI" shipped as "BC3UMI" on E2's glyph once the barcode widths became true
   base pairs, and this rule never fired because their quads barely touched.

   A same-building minimum-gap rule was tried and backed out. Set at 3px it
   failed 121 times on the locus, whose exon/intron labels are small, angled and
   deliberately close — a check that fires that often on correct drawing is a
   check people learn to skip. So the gap is real: zero-overlap contact is
   caught by looking at the picture, not by this file. Look at the picture. */
const OVERLAP = 0.22;   // fraction of the smaller quad that counts as a collision
const ROOF_PAD = 14;    // px of slack around a roof quad, for descenders and stroke

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });

const warnings = [], errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push('console error: ' + m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});

/* The shared-copy endpoint is stubbed. What is under test is the page's
   behaviour, not DynamoDB's, and a check that fails when a table is
   unreachable — or when it is being run against a static preview server — is
   a check that gets ignored. */
await page.route('**/api/pipeline_*', r => r.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify({ offsets: null, text: null, at: null }) }));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

let bad = 0;
const fail = m => { bad++; console.log('  FAIL  ' + m); };

/* ---- 1. the drawing code must not warn ---------------------------------- */
for (const w of warnings) if (/^(fq-|pipeline-|culls-)/.test(w)) fail(w);

/* ---- convex polygon helpers, on the node side --------------------------- */
const area = q => {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], n = q[(i + 1) % q.length];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
};
/* Sutherland-Hodgman: clip subject against every edge of clipper. Both are
   convex quads here, so the result is convex and its area is exact. */
const clip = (subject, clipper) => {
  let out = subject;
  const cx = clipper.reduce((s, p) => s + p.x, 0) / clipper.length;
  const cy = clipper.reduce((s, p) => s + p.y, 0) / clipper.length;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const side = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const keep = Math.sign(side({ x: cx, y: cy })) || 1;
    const inside = p => Math.sign(side(p)) === keep || Math.abs(side(p)) < 1e-9;
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const P = out[j], Q = out[(j + 1) % out.length];
      const pi = inside(P), qi = inside(Q);
      if (pi) next.push(P);
      if (pi !== qi) {
        const sp = side(P), sq = side(Q), t = sp / (sp - sq);
        next.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t });
      }
    }
    out = next;
  }
  return out;
};
const grow = (q, pad) => {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length;
  const cy = q.reduce((s, p) => s + p.y, 0) / q.length;
  return q.map(p => {
    const dx = p.x - cx, dy = p.y - cy, L = Math.hypot(dx, dy) || 1;
    return { x: p.x + dx / L * pad, y: p.y + dy / L * pad };
  });
};

/* Every drawn string as its TRUE oriented quad, plus which building it
   belongs to and whether it is painted on that building's roof. */
const collect = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#svg text').forEach(t => {
    const s = (t.textContent || '').trim();
    if (!s) return;
    /* opacity 0 is a label mid-fade, not a label that is there */
    if (parseFloat(getComputedStyle(t).fillOpacity) < 0.08) return;
    const bb = t.getBBox(); if (!bb.width || !bb.height) return;
    const m = t.getScreenCTM(); if (!m) return;
    const pt = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    const quad = [pt(bb.x, bb.y), pt(bb.x + bb.width, bb.y),
                  pt(bb.x + bb.width, bb.y + bb.height), pt(bb.x, bb.y + bb.height)];
    let node = null, name = null, onRoof = false, e = t;
    while (e && e.tagName !== 'svg') {
      if (e.getAttribute && /^matrix\(/.test(e.getAttribute('transform') || '')) onRoof = true;
      /* A NAME LABEL LIVES IN ITS OWN LAYER, NOT INSIDE ITS BUILDING, so the
         role=button walk below never reaches it and every name on this map was
         going unattributed — which meant none of them was ever tested against
         a roof, and a name and its own sub read as two unrelated strings. The
         label group carries data-id for exactly this. */
      if (e.getAttribute && e.getAttribute('data-id') && !node) {
        node = e.getAttribute('data-id');
      }
      if (e.getAttribute && e.getAttribute('role') === 'button') {
        /* BY ID, NOT BY NAME. Two nodes may carry the same name — a second copy
           of a reference file — and keying a roof lookup off the name merges
           them, so one card's labels get tested against the other card's roof
           and come back 100% off it. That is a bug in this file, not in the
           page, and it shipped as a page failure for one build. */
        node = e.getAttribute('data-id') || e.getAttribute('aria-label');
        name = e.getAttribute('aria-label');
        break;
      }
      e = e.parentNode;
    }
    /* IS THIS STRING THE NODE'S OWN NAME, OR ITS OWN SUB? Those two are one
       label — the view draws every landmark as a name with its sub set tight
       underneath, deliberately — and the pair loop below has to know that
       before it reports the gap between two lines of one block as a collision. */
    const rec = node && NODES.find(n => n.id === node);
    /* THE SECOND LINE OF A LANDMARK IS ITS `stat`, NOT ITS `sub` — the sub goes
       to the reader panel and the stat goes on the map. Matching only name/sub
       looked right and skipped nothing, which is the worst kind of wrong. */
    /* CASE-INSENSITIVE, because a landmark's name is drawn UPPERCASED. Compared
       exactly, only the one landmark already written in capitals matched itself
       and the other six went on reporting. */
    const eq = (a, b) => !!a && !!b && a.toUpperCase() === b.toUpperCase();
    const part = !rec ? null
      : eq(s, rec.name) ? 'name'
      : eq(s, rec.stat) ? 'stat'
      : eq(s, rec.sub)  ? 'sub'
      : (rec.key && eq(s, rec.key + ' \u00b7 ' + rec.name)) ? 'name' : null;
    out.push({ s, node, name, onRoof, quad, part });
  });
  return out;
});

/* The surface each object's own text has to stay on, in screen coordinates.

   For a building that is its roof. For SCENERY it is the patch of ground the
   thing is painted on, which is nothing to do with w/d — the attrition river
   carries a placeholder footprint and spans half the map, so testing its
   percentages against a 0.9-unit box called every one of them off the roof.
   Its ground rectangle is grown a little because its tributary labels sit
   just outside the ribbon's edge by design. */
const roofs = () => page.evaluate(() => {
  const M = {}, world = document.querySelector('#svg > g'), m = world.getScreenCTM();
  const to = (x, y, z) => { const p = P(x, y, z);
    return { x: m.a * p[0] + m.c * p[1] + m.e, y: m.b * p[0] + m.d * p[1] + m.f }; };
  NODES.forEach(n => {
    if (n.scenery && n.x0 != null) {
      /* the ground patch it is painted on, grown for the tributaries that
         drift off the far edge by design */
      const lo = n.yBase - n.width * 1.9, hi = n.yBase + n.width * 0.15;
      M[n.id] = [to(n.x0, lo, n.z), to(n.x1, lo, n.z),
                 to(n.x1, hi, n.z), to(n.x0, hi, n.z)];
      return;
    }
    const h = topOf(n), hw = n.w / 2, hd = n.d / 2;
    M[n.id] = [to(n.x - hw, n.y - hd, h), to(n.x + hw, n.y - hd, h),
               to(n.x + hw, n.y + hd, h), to(n.x - hw, n.y + hd, h)];
  });
  return M;
});

async function pass(label) {
  const texts = await collect();
  const quads = await roofs();

  /* ---- 2. roof text stays on its roof ---------------------------------- */
  for (const t of texts) {
    if (!t.onRoof || !t.node || !quads[t.node]) continue;
    const roof = grow(quads[t.node], ROOF_PAD);
    const inside = area(clip(t.quad, roof));
    const own = area(t.quad);
    if (own && inside / own < 0.985)
      fail(`${label}: "${t.s}" hangs off the roof of ${t.name} (${t.node}) — ` +
           `${(100 * (1 - inside / own)).toFixed(0)}% of it is over the edge`);
  }

  /* ---- 3. nothing overlaps anything ------------------------------------ */
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    /* A NAME AND ITS OWN SUB ARE ONE LABEL, NOT TWO STRINGS THAT COLLIDE. Every
       landmark on this map is drawn that way and every one of them reported at
       23% — which is not seven bugs, it is one measurement asking the wrong
       question. Any OTHER pair on the same node is still checked: a plate's
       registry lines and a station's scanner names belong to one node too, and
       those genuinely must not touch. */
    if (a.node && a.node === b.node && a.part && b.part && a.part !== b.part) continue;
    const inter = area(clip(a.quad, b.quad));
    if (!inter) continue;
    const share = inter / Math.min(area(a.quad), area(b.quad));
    if (share > OVERLAP)
      fail(`${label}: "${a.s}" and "${b.s}" overlap by ${(share * 100).toFixed(0)}%`);
  }
  return texts.length;
}

/* fitted — the view the page opens on */
const nFit = await pass('fitted');

/* and walked, one building at a time, which is the reading zoom.
   A CARRIED NODE HAS NO INDEX ROW, by design — it is the row above's object
   drawn again at the head of this one, and check-carried asserts it appears in
   neither the index nor the walk. Asking the sidebar for it hangs for thirty
   seconds and then takes the whole check down with it. */
const ids = await page.evaluate(() =>
  NODES.filter(n => !n.carried).map(n => n.id));
let nWalk = 0;
for (const id of ids) {
  await page.locator(`aside .row[data-id="${id}"]`).click();
  await page.waitForTimeout(1500);
  nWalk += await pass('at ' + id);
}

console.log(bad
  ? `\n${bad} FAILURE(S)`
  : `${nFit} labels fitted + ${nWalk} across ${ids.length} buildings: all on their roofs, none overlapping`);
for (const e of errors) console.log('  ' + e);
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
