# The plate style

The house style for **figure pages** on zeroshot.bio — pages whose job is to be
*read* rather than operated. `/fate_map` is the reference implementation; copy
from `public/fate_map/` and this document tells you which parts are the style
and which parts were that page's problem.

This is not the only style in the repo, and it is not a replacement for the
other one. Know which you are writing:

| | **plate** (this document) | **instrument** (`/pipeline`, `/data_structures`, `/bioinformatics_pipe`, `/FASTQ_pipe`, `/molecular_pipe`) |
|---|---|---|
| reads as | a page of a monograph | a panel you operate |
| ground | warm paper, light | near-black, dark |
| type | serif, book measure | monospace, dense |
| built for | one argument, read top to bottom | many parts, inspected |

A page that argues something wants a plate. A page that exposes machinery wants
an instrument. Choosing the plate style for a control surface will make it
precious and hard to use; choosing the instrument style for an argument will
make it look like telemetry.

---

## 1. The five rules that actually matter

Everything below is detail. These are the ones that decide whether it works.

### 1.1 One ink first. Colour is an instrument, not a coat of paint.

The single biggest lesson from `/fate_map`. Plate II draws 19,205 lineage
strokes. Tinted by category at 30% alpha they overlapped into a uniform grey —
technically correct, visually mud, and it said nothing. The same strokes in a
**single ink at 13% alpha** became a sepia engraving in which the shape of the
data was suddenly obvious.

So: **draw the mass in one ink; let density do the work.** Then give the reader
a control that lifts *one* category out of it in colour. The comparison between
the isolated thing and the ghosted mass is where the argument lives — not in
seeing all categories at once, which no one can do past about four.

```
default   : every mark  --ink at 0.10–0.15 alpha
isolated  : chosen      --t{n} at 0.42 alpha
            everything  --ink at 0.05 alpha
```

### 1.2 Isolate, do not hide.

Legend entries are **isolate** toggles, not visibility toggles. Hiding a
category removes information and changes the shape of what is left; isolating
keeps the whole population on the page as a ghost and lets the reader see the
part *against* the whole. Empty selection means "show everything normally".

### 1.3 The furniture may be hand-drawn. The data never is.

The plate borders, rules and graticule circles carry a small deterministic
wobble so they read as pen rather than as CSS. This is the entire "hand-drawn"
budget. **No data mark is ever jittered, softened, smoothed or nudged.** If you
add a wobble, add it in the frame code, never in the projection.

```js
/* A circle drawn as a pen would draw it. Furniture only. */
function penCircle(ctx, cx, cy, r, seed) {
  const N = 220;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const w = 1 + 0.0030 * Math.sin(3 * t + seed) + 0.0020 * Math.sin(7 * t + seed * 2.3);
    const x = cx + r * w * Math.cos(t), y = cy + r * w * Math.sin(t);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
```

### 1.4 Never rescale a comparison to fill its frame.

`/fate_map` Plates I and III share one degrees-per-pixel. Plate I's blastoderm
covers half the sphere, so its **canvas is drawn smaller** rather than its
projection drawn larger. Rescaling it to fill the column would have looked
tidier and would have destroyed the one thing the pair exists to show.

If two figures are meant to be compared, they share a scale, and the smaller one
is *smaller on the page*. Empty space that means something is not wasted space.

### 1.5 Say what the picture does not claim.

Every plate page carries a numbered **Notes on the plates** section stating the
limits of the thing just drawn, and a colophon naming the source, the build
script and the parameters. This is the repo's culture (see
`public/dev_tree/NOTES.md`), and on a plate it is also a design element — the
notes are part of the page, set in the same measure, not an apology in a footer.

Write the caveat where the claim is made, not only in the notes: `/fate_map`
says "territories are geometric, not anatomical" in the legend header, in the
caption, and in the notes, because a reader who lands mid-page must not be able
to acquire the wrong belief.

---

## 2. Tokens

Copy this block. The values are tuned together; changing one usually means
changing three.

```css
:root{
  --paper:#f3ede1;       /* warm ground. never pure white */
  --paper-deep:#eae2d2;  /* inset panels, code */
  --ink:#2b2219;         /* text and every data stroke */
  --ink-2:#5f5344;       /* captions, secondary prose */
  --ink-3:#8b7d69;       /* labels, axis type, eyebrows */
  --rule:#c3b6a0;        /* stated rules, borders */
  --rule-2:#d9cfbb;      /* graticule, half-hour guides */
  --select:#8f2d16;      /* madder. the CHOSEN thing, and nothing else */

  /* Hand-tinted washes. Muted enough to sit on paper without shouting,
     separated enough to tell apart. Never identify by colour alone —
     every one of these also carries a written label on the plate. */
  --t0:#a8442a;  /* madder      */
  --t1:#b0802c;  /* ochre       */
  --t2:#6d7a34;  /* olive       */
  --t3:#3d6f68;  /* verdigris   */
  --t4:#57688a;  /* indigo grey */
  --t5:#8a6c4e;  /* sepia       */
  --t6:#6d4665;  /* plum        */

  --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
}
```

**`--select` is reserved.** Madder means "this is the thing you chose". Do not
spend it on a data series, a warning, or a link.

The paper tooth is two repeating gradients and a highlight — no image asset:

```css
body{
  background:var(--paper);
  background-image:
    repeating-linear-gradient(90deg, rgba(120,100,70,.030) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(0deg,  rgba(120,100,70,.022) 0 1px, transparent 1px 4px),
    radial-gradient(120% 80% at 50% 0%, rgba(255,252,244,.65), transparent 60%);
}
```

### Type

- **Serif for everything the reader reads**: headings, prose, captions, notes,
  italic annotations on the plates.
- **Sans, small, wide-tracked, uppercase for machine furniture**: eyebrows,
  plate numbers, axis ticks, buttons, legend headers.
  `font-size:10–11px; letter-spacing:.2–.34em; text-transform:uppercase`.
- Body 16px / 1.62. Prose measure **660px**; captions 760px. Do not run body
  text the full width of a wide figure.
- Section openers may take a drop cap: `p.lead::first-letter{float:left;
  font-size:3.35em;line-height:.84}`.
- Plate titles are **italic serif**, plate numbers are sans small caps
  (`PLATE I`), stage/annotation labels on the canvas are italic serif.

### Structure

A plate page is a masthead, a short prose argument, numbered plates in order,
then notes. Give it room: `margin:96px auto 0` between plates, `104px` before
the notes. Centre everything at the text measure and let only the one tall
figure run wider:

```css
.sheet{max-width:none;margin:0;padding:0 40px 120px}
header.masthead,section.prose{max-width:1100px;margin-left:auto;margin-right:auto}
#stage>figure.plate,#stage>section.notes{max-width:1100px;margin-left:auto;margin-right:auto}
#stage>figure.plate.wide{max-width:1480px}
```

Cap each block rather than pulling the wide one out with a negative margin.
`margin-left:calc(50% - min(740px, 50vw - 32px))` is invalid CSS, gets dropped
silently, and the page then scrolls sideways — this cost a debugging round.

---

## 3. Canvas practice

- Size by `parentElement.clientWidth`, set `canvas.width = side * dpr` with
  `dpr = Math.min(devicePixelRatio, 2)`, then `ctx.setTransform(dpr,0,0,dpr,0,0)`
  and work in CSS pixels thereafter.
- **Batch by colour, not by mark.** One `beginPath()` per ink, every stroke of
  that ink added, one `stroke()`. Nineteen thousand segments draw in a handful
  of paths; per-segment style changes will not hold a frame rate.
- Redraw through a `requestAnimationFrame` gate with a re-entry guard, so pan
  and zoom coalesce to one paint per frame.
- Hairlines: `0.5–0.55px` at rest, widening gently with zoom, capped
  (`Math.min(1.5, 0.5 + (k-1) * 0.05)`).
- Stipple marks: `1.3–1.7px` radius, area scaled by weight where weight means
  something, `globalAlpha` around `0.88`.

### Labels on a canvas

Three rules, each learned by getting it wrong:

1. **Pin cardinal labels to the canvas edge, not to the drawing's rim.** A
   rim-relative position depends on the label's own rendered width and clips at
   some plate size. Size the gutter for the labels instead (`PLATE_PAD ≈ 62`).
2. **Place a region's label by median radius and *circular* mean angle** — never
   by the centroid of its projected points. The centroid of a ring is its
   centre, which piles every wrap-around region's label on the origin.
3. **Search, then give up.** Try the natural position, then bump outward and to
   either side; if it still collides with an already-placed label, skip it.
   Overprinted labels are worse than absent ones.

Always paint a `--paper` backing rect behind canvas text that sits over marks.

### Interaction

- Drag to pan, wheel to zoom about the pointer, an explicit **reset view**
  control. Zoom clamped (`1 … 60`) and pan clamped so content cannot leave.
- Let the gutters scroll the page: `if (px < MARGIN.l || px > W - MARGIN.r)
  return;` before `preventDefault()`. A figure that traps the scroll wheel over
  its own margins is hostile on a long page.
- Hit-test by brute force over the sample arrays with a cheap bounding reject
  first. ~570k points tests in a few milliseconds and needs no index to keep in
  step with an axis change.
- Selection lights the chosen thing across **every** plate at once. That linkage
  is most of the value of putting three plates on one page.

---

## 4. Traps that cost real time

- **Typed-array alignment.** A `Int16Array` view must start on an even byte
  offset. Put a 1-byte column before a 2-byte one in a binary and it throws for
  odd row counts and works for even ones. Fix by construction: 16-byte headers,
  and fields written **widest element first**.
- **Arrow glyphs.** `&rarr;` and `&harr;` are missing from the serif and system
  sans stacks in some environments and render as blank gaps. Use words or an
  en-dash. (`&ndash;` is safe.)
- **Absolute `<script src>`.** These routes have no trailing slash, so
  `src="fm-data.js"` resolves against `/` and 404s. Always `/<page>/<file>.js`.
- **Shell and scripts are one unit.** The HTML names the elements the scripts
  reach for; a script that cannot find an element stops dead and everything
  after it in the file never runs. Ship `no-cache, must-revalidate` headers for
  the whole directory in `next.config.js`, and have the loader cross-check the
  asset headers against `meta.json` so a half-deployed set fails loudly instead
  of drawing something plausible.
- **Never hard-code a figure into the prose.** Every number `/fate_map` prints
  is read from `meta.json`, which the build script writes in the same pass that
  writes the binaries. A retyped number goes stale silently.

---

## 5. Starting a new plate page

1. Copy `public/fate_map/index.html` and strip to the masthead, one `figure.plate`
   and the notes. Keep the `:root` block verbatim.
2. Split the JS the same way: `*-data.js` (decode + integrity checks),
   `*-plates.js` / `*-flow.js` (drawing), `*-main.js` (bootstrap, interaction,
   and all the written matter, read from `meta.json`).
3. Add the rewrite and the `no-cache` header pair to `next.config.js`, with a
   comment saying what the page is and where its data comes from.
4. Write `public/<page>/NOTES.md` before you think you need it: what the picture
   claims, what it does not, the inputs table, and the traps.
5. Add the page to `src/app/sitemap/page.tsx`.
6. Render it and look at it. Every real fault in `/fate_map` — clipped labels,
   colliding labels, grey mush, sideways scroll — was invisible in the code and
   obvious in a screenshot.
