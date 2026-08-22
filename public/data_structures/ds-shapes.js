/* ============================================================
   ds-shapes.js — the plan-view vocabulary.
   Owned by the rendering side. One draw function per shape.

   THE SHAPE CONTRACT (same as /pipeline's, restated for a plan)
     DRAW.myShape = (g, n) => { append SVG to g };
   - reads only n.x n.y n.w n.h plus its own custom fields. There is no n.d
     and no n.h-as-elevation here: h is the footprint's second dimension.
   - knows nothing about neighbours, the spine, or the map
   - colours are ALWAYS var(--token), never a hex literal, or light mode breaks
   - anything that moves pushes to TICKERS; never setInterval
   - a node opts in with shape:"myShape"

   Because the projection is orthographic top-down, shapes NEST. A vault draws
   a floor and tiles inside its own wall; a repo floor draws a wall and lets
   separately-addressable cell nodes sit inside it. On the isometric map that
   would need a depth sort; here there is no depth to sort.
   ============================================================ */

const DRAW = {};

/* Tier accents, so a shape asks for "the bronze one" rather than naming a
   token and getting it wrong. */
const TIER = {
  bronze: { ink: "var(--bz)", fill: "var(--bz-f)" },
  silver: { ink: "var(--sv)", fill: "var(--sv-f)" },
  gold:   { ink: "var(--gd)", fill: "var(--gd-f)" },
  code:   { ink: "var(--cd)", fill: "var(--cd-f)" },
  side:   { ink: "var(--fg3)", fill: "var(--panel2)" }
};
const inkOf = n => (TIER[n.tier] || TIER.side).ink;
const fillOf = n => (TIER[n.tier] || TIER.side).fill;

/* A title bar along the top wall of any enclosure. Returns the y of the
   floor below it, so the caller can lay contents out under it. */
function titlebar(g, n, text, right) {
  const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2, BH = 0.86;
  plate(g, n.x, y0 + BH / 2, n.w, BH, { fill: inkOf(n), fo: 0.13, stroke: inkOf(n), sw: 1, so: 0.5 });
  label(g, x0 + 0.32, y0 + BH / 2, text, { size: 10.5, anchor: "start", fill: inkOf(n), ls: 0.09, upper: true });
  if (right) label(g, x0 + n.w - 0.32, y0 + BH / 2, right, { size: 9, anchor: "end", fill: "var(--fg3)", ls: 0.06 });
  return y0 + BH;
}

/* ============================================================
   VAULT — an S3 bucket, seen from above.

   The wall is doubled because a bucket is the one thing on this map with a
   real boundary: everything else is code, and code has an interface rather
   than a perimeter. Inside, the bucket's top-level prefixes are a squarified
   treemap by bytes — which is the whole reason this map is worth drawing top
   down. Fort Knox's 7.7 TB against the warehouse's 16.6 GB is a 466x ratio,
   and area is the only encoding that shows it without a log scale.

   n.tiles: [{key, value, objs, note}]  value in bytes
   n.doors: sides that carry a conduit, marked as a gap in the outer wall
   ============================================================ */
DRAW.vault = (g, n) => {
  const ink = inkOf(n);
  /* outer wall, then inner wall a hair inside it */
  plate(g, n.x, n.y, n.w, n.h, { fill: "var(--panel)", fo: 0.55, stroke: ink, sw: 1.9, so: 0.85 });
  plate(g, n.x, n.y, n.w - 0.24, n.h - 0.24, { fill: "none", stroke: ink, sw: 0.7, so: 0.35 });
  const top = titlebar(g, n, n.bucket, n.right);

  /* the floor tick, so the empty part of a bucket still reads as surveyed */
  const fx = n.x - n.w / 2 + 0.42, fy = top + 0.28;
  const fw = n.w - 0.84, fh = (n.y + n.h / 2) - fy - 0.42;
  plate(g, n.x, fy + fh / 2, fw, fh, { fill: "url(#pD)", stroke: "none" });

  /* A vault with no tiles. Deliberately NOT the pX cross-hatch the empty bay
     uses: that pattern means "this should be here and is not", and the only
     bucket that lands here is the gold library, whose contents are not known
     to be absent — they are not known at all. A plain hatch and a sentence
     saying which of the two it is. */
  if (!n.tiles || !n.tiles.length) {
    plate(g, n.x, fy + fh / 2, fw, fh, { fill: "url(#pHl)", stroke: "none" });
    label(g, n.x, fy + fh / 2 - 0.30, n.emptyHead || "no objects observed",
      { size: 10, fill: ink, ls: 0.08, upper: true });
    (n.emptyLines || []).forEach((L, i) =>
      label(g, n.x, fy + fh / 2 + 0.12 + i * 0.36, L, { size: 8.6, fill: "var(--fg3)" }));
  }

  if (n.tiles && n.tiles.length) {
    const laid = squarify(n.tiles, fx, fy, fw, fh);
    const max = Math.max(...n.tiles.map(t => t.value));
    laid.forEach(L => {
      const it = L.item;
      /* opacity carries a second channel — object count density — so two
         tiles of equal bytes are still distinguishable when one is a single
         16 GB zip and the other is 256 FASTQs */
      const heat = 0.10 + 0.30 * Math.sqrt(it.value / max);
      plate(g, L.x, L.y, L.w - 0.07, L.h - 0.07, { fill: ink, fo: heat, stroke: ink, sw: 0.9, so: 0.6 });

      /* A stale tile — content that does not belong to the current
         architecture — is restroked in the drop colour and always names
         itself, because honest area encoding buries exactly the tile the map
         is about. The warehouse's minifin/ is 0.59% of its bucket: at true
         area that is a hairline about two pixels thick, and it is the single
         most important thing in there. So the rule is area for the size and
         a forced callout for the meaning, rather than a fudged minimum area
         that would lie about both. */
      if (it.stale) {
        plate(g, L.x, L.y, L.w - 0.07, L.h - 0.07, { fill: "url(#pHl)", stroke: "none" });
        plate(g, L.x, L.y, L.w - 0.07, Math.max(L.h - 0.07, 0.1),
          { fill: "none", stroke: "var(--drop)", sw: 1.6, so: 0.95 });
        /* A sliver can be thin in either axis depending on which way the
           squarifier laid its strip, so test both. A thin-and-tall tile gets
           its callout set to the LEFT and anchored end, reading back into the
           neighbour; a short-and-wide one gets it centred. */
        const thin = L.w < 2.6, short = L.h < 1.0;
        if (thin || short) {
          const txt = `${it.key}  ${fmtBytes(it.value)} · ${it.objs} obj`;
          if (thin) label(g, L.x - L.w / 2 - 0.24, L.y, txt,
            { size: 9, anchor: "end", fill: "var(--drop)", ls: 0.03 });
          else label(g, L.x, L.y, txt, { size: 9, fill: "var(--drop)", ls: 0.03 });
          return;
        }
      }

      /* label only where it fits; a clipped label is worse than none */
      if (L.w > 1.5 && L.h > 0.62) {
        label(g, L.x, L.y - (L.h > 1.0 ? 0.20 : 0), it.key, { size: Math.min(10.5, 7 + L.w), fill: "var(--fg)", ls: 0.03 });
        if (L.h > 1.0) {
          label(g, L.x, L.y + 0.16, fmtBytes(it.value), { size: 9, fill: "var(--fg2)" });
          if (L.h > 1.5) label(g, L.x, L.y + 0.46, fmtCount(it.objs) + " obj", { size: 8.2, fill: "var(--fg3)" });
        }
      }
    });
  }

  /* doors: a break in the outer wall where a conduit lands, drawn as two
     stubs rather than a gap so the wall still closes visually */
  (n.doors || []).forEach(side => {
    const half = 0.55, sw = 2.6;
    const at = { l: [n.x - n.w / 2, n.y], r: [n.x + n.w / 2, n.y], t: [n.x, n.y - n.h / 2], b: [n.x, n.y + n.h / 2] }[side];
    const vert = side === "l" || side === "r";
    const a = vert ? [[at[0], at[1] - half], [at[0], at[1] + half]] : [[at[0] - half, at[1]], [at[0] + half, at[1]]];
    add(g, "line", {
      x1: P(a[0][0], a[0][1])[0], y1: P(a[0][0], a[0][1])[1],
      x2: P(a[1][0], a[1][1])[0], y2: P(a[1][0], a[1][1])[1],
      stroke: "var(--bg)", "stroke-width": sw
    });
    add(g, "line", {
      x1: P(a[0][0], a[0][1])[0], y1: P(a[0][0], a[0][1])[1],
      x2: P(a[1][0], a[1][1])[0], y2: P(a[1][0], a[1][1])[1],
      stroke: ink, "stroke-width": 1, "stroke-dasharray": "2 3", "stroke-opacity": 0.7
    });
  });
};

/* ============================================================
   FLOOR — a git repository, seen from above.

   Drawn as a machine floor rather than a container: single wall, hatched
   margin, and a rail along the bottom carrying the commands the repo
   exposes. The cells inside are their own nodes so each one can be read.

   A repo with nothing implemented gets the dashed wall — the plan of a
   building that has been surveyed but not built.
   ============================================================ */
DRAW.floor = (g, n) => {
  const ink = inkOf(n), stub = n.state === "stub";
  plate(g, n.x, n.y, n.w, n.h, {
    fill: "var(--panel)", fo: 0.5, stroke: ink, sw: 1.6, so: 0.9, dash: stub ? "7 4" : "none"
  });
  /* the hatched margin: the part of the floor that is repo furniture —
     AGENTS.md, the Makefile, the lockfile — rather than pipeline code */
  plate(g, n.x, n.y, n.w - 0.3, n.h - 0.3, { fill: "url(#pHl)", stroke: ink, sw: 0.6, so: 0.28 });
  const top = titlebar(g, n, n.repo, n.right);

  /* the command rail */
  if (n.rail && n.rail.length) {
    const ry = n.y + n.h / 2 - 0.55;
    plate(g, n.x, ry, n.w - 0.84, 0.7, { fill: "var(--bg)", fo: 0.7, stroke: ink, sw: 0.8, so: 0.45 })
      .classList.add("fine");
    const x0 = n.x - n.w / 2 + 0.55, span = (n.w - 1.1) / n.rail.length;
    n.rail.forEach((c, i) => {
      const cx = x0 + span * (i + 0.5);
      label(g, cx, ry, c, { size: 8.8, fill: stub ? "var(--fg3)" : "var(--fg)", ls: 0.05 });
      if (i) add(g, "line", {
        x1: P(x0 + span * i, ry - 0.3)[0], y1: P(x0 + span * i, ry - 0.3)[1],
        x2: P(x0 + span * i, ry + 0.3)[0], y2: P(x0 + span * i, ry + 0.3)[1],
        stroke: ink, "stroke-width": 0.7, "stroke-opacity": 0.35
      }).classList.add("fine");
    });
  }
  return top;
};

/* ============================================================
   CELL — one module inside a repo floor.

   state:"live"  implemented and exercised
   state:"stub"  a function that raises, with its gating reason
   ============================================================ */
DRAW.cell = (g, n) => {
  const ink = inkOf(n), stub = n.state === "stub";
  plate(g, n.x, n.y, n.w, n.h, {
    fill: stub ? "var(--bg)" : ink, fo: stub ? 0.55 : 0.16,
    stroke: ink, sw: 1.1, so: stub ? 0.55 : 0.95, dash: stub ? "5 3" : "none"
  });
  if (stub) plate(g, n.x, n.y, n.w, n.h, { fill: "url(#pX)", stroke: "none" });
  label(g, n.x, n.y - (n.note ? 0.20 : 0), n.cellName || n.name, { size: 10, fill: "var(--fg)", ls: 0.04 });
  if (n.note) label(g, n.x, n.y + 0.20, n.note, { size: 8.4, fill: stub ? "var(--drop)" : "var(--fg2)" });
  /* the lamp: filled when the step has actually run against the real bucket */
  const [lx, ly] = P(n.x + n.w / 2 - 0.24, n.y - n.h / 2 + 0.24);
  add(g, "circle", {
    cx: lx, cy: ly, r: 3.1,
    fill: stub ? "none" : "var(--signal)", stroke: stub ? "var(--drop)" : "var(--signal)", "stroke-width": 1.2
  });
};

/* ============================================================
   BUS — zsb-medallion, the shared contract, running under the repos.

   Drawn as a bar with tap stubs rising into each floor it serves, because
   that is what it is: not a stage in the flow, but the thing all three
   stages import their vocabulary from. It has no bucket and moves no bytes.
   ============================================================ */
DRAW.bus = (g, n) => {
  const ink = inkOf(n);
  plate(g, n.x, n.y, n.w, n.h, { fill: ink, fo: 0.13, stroke: ink, sw: 1.5, so: 0.9 });
  plate(g, n.x, n.y, n.w - 0.2, n.h - 0.2, { fill: "none", stroke: ink, sw: 0.6, so: 0.3 });
  label(g, n.x - n.w / 2 + 0.42, n.y - 0.24, n.repo, { size: 11, anchor: "start", fill: ink, ls: 0.1, upper: true });
  label(g, n.x - n.w / 2 + 0.42, n.y + 0.26, n.sub, { size: 8.8, anchor: "start", fill: "var(--fg2)" });

  /* the exported names, spaced along the bar — the actual contract */
  if (n.exports) {
    const x0 = n.x - n.w / 2 + 5.6, span = (n.w - 6.3) / n.exports.length;
    n.exports.forEach((e, i) => {
      const cx = x0 + span * (i + 0.5);
      /* the chip is a frame around a word: at the coarse zoom the word is
         gone, and an empty frame reads as a component rather than as a label
         that could not fit. So it carries the fine tier too. */
      plate(g, cx, n.y, Math.min(span - 0.14, 2.5), 0.62,
        { fill: "var(--bg)", fo: 0.62, stroke: ink, sw: 0.7, so: 0.5 }).classList.add("fine");
      label(g, cx, n.y, e, { size: 8.6, fill: "var(--fg)" });
    });
  }
  /* Tap risers. The bus sits BETWEEN the two rows, so it is tapped from both
     sides: the bronze repo hangs above it and reaches down, the silver and
     gold repos sit below it and reach up. dir is -1 for a riser going up out
     of the bar, +1 for one going down. */
  (n.taps || []).forEach(t => {
    const dir = t.dir, y0 = n.y + dir * n.h / 2, y1 = y0 + dir * (n.tapLen || 4.5);
    add(g, "path", {
      d: path([[t.x, y0], [t.x, y1]]),
      stroke: ink, "stroke-width": 1.2, "stroke-opacity": 0.5, "stroke-dasharray": "3 3", fill: "none"
    });
    const [cx, cy] = P(t.x, y1);
    add(g, "circle", { cx, cy, r: 2.8, fill: "var(--bg)", stroke: ink, "stroke-width": 1.1 });
    label(g, t.x, y0 + dir * 1.2, "imports", { size: 8, fill: "var(--fg3)", anchor: "middle" });
  });
};

/* ============================================================
   BAY — a place a thing is meant to be, and is not.

   The one shape on this map that draws an absence. Cross-hatched in the drop
   colour, dashed wall, and it names the key that would be there.
   ============================================================ */
DRAW.bay = (g, n) => {
  plate(g, n.x, n.y, n.w, n.h, { fill: "var(--bg)", fo: 0.5, stroke: "var(--drop)", sw: 1.3, so: 0.8, dash: "6 4" });
  plate(g, n.x, n.y, n.w, n.h, { fill: "url(#pX)", stroke: "none" });
  label(g, n.x, n.y - 0.30, n.headline, { size: 9.6, fill: "var(--drop)", ls: 0.05, upper: true });
  (n.lines || []).forEach((L, i) => label(g, n.x, n.y + 0.02 + i * 0.34, L, { size: 9, fill: "var(--fg2)" }));
};

/* ============================================================
   RACK — the named-key manifest.

   Eight rows, one per pinned object, each with its size bar and a tick. This
   is the shape that earns the plan view a second time: the manifest is a
   list, and a list drawn from directly overhead is just a list — legible,
   in order, no foreshortening on the far rows.
   ============================================================ */
DRAW.rack = (g, n) => {
  const ink = inkOf(n);
  plate(g, n.x, n.y, n.w, n.h, { fill: "var(--panel2)", fo: 0.75, stroke: ink, sw: 1.3, so: 0.85 });
  const top = titlebar(g, n, n.headline, n.right);
  const rows = n.rows || [];
  const rh = ((n.y + n.h / 2) - top - 0.30) / Math.max(rows.length, 1);
  const max = Math.max(...rows.map(r => r.bytes));
  rows.forEach((r, i) => {
    const ry = top + 0.16 + rh * (i + 0.5);
    const x0 = n.x - n.w / 2 + 0.34;
    /* the size bar, log-scaled: the manifest spans 7,563 B to 959 MB, and on
       a linear bar every row but the first is invisible */
    const k = Math.log(r.bytes) / Math.log(max);
    plate(g, x0 + (n.w - 0.68) * k / 2, ry, Math.max((n.w - 0.68) * k, 0.05), rh * 0.74,
      { fill: ink, fo: 0.18, stroke: "none" });
    label(g, x0, ry, r.name, { size: 8.6, anchor: "start", fill: "var(--fg)" });
    label(g, n.x + n.w / 2 - 0.98, ry, fmtBytes(r.bytes), { size: 8.2, anchor: "end", fill: "var(--fg2)" });
    const [tx, ty] = P(n.x + n.w / 2 - 0.52, ry);
    add(g, "path", {
      d: `M${tx - 3.2},${ty} l2.4,2.6 l4.4,-5.6`,
      stroke: "var(--ok)", "stroke-width": 1.5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round"
    });
  });
};

/* ============================================================
   STACK — a group of objects that are not a treemap's business.
   A short pile of plates, offset down-right, with a count.
   ============================================================ */
DRAW.stack = (g, n) => {
  const ink = inkOf(n), N = Math.min(n.depth || 3, 5);
  for (let i = N - 1; i >= 0; i--) {
    plate(g, n.x + i * 0.11, n.y + i * 0.11, n.w, n.h, {
      fill: i ? "var(--bg)" : "var(--panel2)", fo: i ? 0.7 : 0.95,
      stroke: ink, sw: i ? 0.7 : 1.2, so: i ? 0.4 : 0.85, dash: n.state === "stub" ? "5 3" : "none"
    });
  }
  label(g, n.x, n.y - 0.22, n.headline, { size: 10, fill: "var(--fg)", ls: 0.04 });
  (n.lines || []).forEach((L, i) => label(g, n.x, n.y + 0.06 + i * 0.32, L, { size: 8.4, fill: "var(--fg2)" }));
};

/* ============================================================
   MARK — a labelled point with no enclosure. Used for the things that are
   true of the map rather than located on it.
   ============================================================ */
DRAW.mark = (g, n) => {
  const ink = inkOf(n);
  const [cx, cy] = P(n.x, n.y);
  add(g, "circle", { cx, cy, r: 4, fill: "none", stroke: ink, "stroke-width": 1.3 });
  add(g, "circle", { cx, cy, r: 1.5, fill: ink });
  label(g, n.x, n.y + 0.42, n.name, { size: 9.2, fill: "var(--fg2)" });
};

/* The map's own north-and-scale block. A plan without a scale is a diagram;
   with one it is a drawing of something. */
DRAW.scalebar = (g, n) => {
  const [x0, y0] = P(n.x - n.w / 2, n.y);
  const [x1] = P(n.x + n.w / 2, n.y);
  add(g, "line", { x1: x0, y1: y0, x2: x1, y2: y0, stroke: "var(--fg3)", "stroke-width": 1 });
  [x0, x1].forEach(x => add(g, "line", { x1: x, y1: y0 - 4, x2: x, y2: y0 + 4, stroke: "var(--fg3)", "stroke-width": 1 }));
  label(g, n.x, n.y - 0.34, n.headline, { size: 8.4, fill: "var(--fg3)", ls: 0.1, upper: true });
  label(g, n.x, n.y + 0.36, n.sub, { size: 8.4, fill: "var(--fg3)" });
};
