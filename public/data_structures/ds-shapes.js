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
const BAR_H = 2.0;   /* title-bar height, sized for 10.5 * TYPE type */

function titlebar(g, n, text, right) {
  const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
  plate(g, n.x, y0 + BAR_H / 2, n.w, BAR_H, { fill: inkOf(n), fo: 0.13, stroke: inkOf(n), sw: 1, so: 0.5 });
  label(g, x0 + 0.5, y0 + BAR_H / 2, text, { size: 10.5, anchor: "start", fill: inkOf(n), ls: 0.09, upper: true });
  if (right) label(g, x0 + n.w - 0.5, y0 + BAR_H / 2, right, { size: 9, anchor: "end", fill: "var(--fg3)", ls: 0.06 });
  return y0 + BAR_H;
}


/* ============================================================
   VAULT — an S3 bucket, seen from above.

   The wall is doubled because a bucket is the one thing on this map with a
   real boundary: everything else is code, and code has an interface rather
   than a perimeter. Inside, the bucket's top-level prefixes are a squarified
   treemap by bytes — which is the whole reason this map is worth drawing top
   down. Bronze's 7.03 TiB against silver's 15.45 GiB is a 466x ratio, and
   area is the only encoding that shows it without a log scale.

   n.tiles: [{key, value, objs, stale, legacy, accent}]  bytes; `accent` outlines
   a split tile so one dataset reads as one object
   `legacy` is the share of `value` still in the pre-restructure folders;
   it is drawn as a grey band inside the tile.
   ============================================================ */
DRAW.vault = (g, n) => {
  const ink = inkOf(n);
  /* outer wall, then inner wall a hair inside it */
  plate(g, n.x, n.y, n.w, n.h, { fill: "var(--panel)", fo: 0.55, stroke: ink, sw: 1.9, so: 0.85 });
  plate(g, n.x, n.y, n.w - 0.24, n.h - 0.24, { fill: "none", stroke: ink, sw: 0.7, so: 0.35 });
  const top = titlebar(g, n, n.bucket, n.right);

  /* the floor tick, so the empty part of a bucket still reads as surveyed */
  const fx = n.x - n.w / 2 + 0.55, fy = top + 0.45;
  const fw = n.w - 1.1, fh = (n.y + n.h / 2) - fy - 0.55;
  plate(g, n.x, fy + fh / 2, fw, fh, { fill: "url(#pD)", stroke: "none" });

  /* A vault with no tiles. Deliberately NOT the pX cross-hatch the empty bay
     uses: that pattern means "this should be here and is not", and the only
     bucket that lands here is the gold tier, whose contents are not known
     to be absent — they are not known at all. A plain hatch and a sentence
     saying which of the two it is. */
  /* "no objects observed" means the bucket is empty, not that this branch forgot
     about grouped vaults — which is exactly what it did when groups arrived and
     it painted the hatch straight over silver's seven tiles. */
  if (!(n.tiles && n.tiles.length) && !(n.groups && n.groups.length)) {
    plate(g, n.x, fy + fh / 2, fw, fh, { fill: "url(#pHl)", stroke: "none" });
    label(g, n.x, fy + fh / 2 - 0.95, n.emptyHead || "no objects observed",
      { size: 10, fill: ink, ls: 0.08, upper: true });
    (n.emptyLines || []).forEach((L, i) =>
      label(g, n.x, fy + fh / 2 + 0.35 + i * lineH(8.6), L, { size: 8.6, fill: "var(--fg3)" }));
  }

  /* GROUPS. A bucket whose prefixes fall into two kinds draws them as two
     columns rather than one treemap, so the split is the first thing read and
     a dataset's neighbours mean something. Column WIDTHS stay proportional to
     the bytes in each group — the whole point of this map is that area encodes
     size, and a 50/50 split would quietly break that across the divide. */
  /* WIDE, NOT SQUARE. Squarify aims every tile at 1:1, which is the worst shape for a caption that
     is always set horizontally: a key like micdropseq/ shrinks to the tile's width while half its
     height goes unused. So lay out on a canvas stretched vertically by TILE_WIDE and squash the
     result back - every area is exactly what it was (area is still the encoding), but the layout now
     optimises for tiles TILE_WIDE times wider than tall. ?wide=<k> overrides it, for tuning. */
  /* Tile captions: one key size and one figure size for every tile in every vault, and a pitch
     tighter than lineH's 1.45 - a two-row caption is one object, not two lines of prose. */
  const CAP_KEY = 8.6, CAP_SIZE = 7.6;
  /* below this key size a tile's caption goes on ONE line, "key  size": stacked rows that small
     have glyph boxes taller than their pitch and collide at the overview zoom */
  const TWO_ROW_MIN = 7;
  const capH_ = size => size * TYPE * 1.22 / S;   /* 1.15 let glyph boxes touch by 0.2px */
  const TILE_WIDE = Math.max(1, parseFloat(new URLSearchParams(location.search).get("wide")) || 3);
  const layoutWide = (tiles, x0, y0, w0, h0) =>
    squarify(tiles, x0, 0, w0, h0 * TILE_WIDE)
      .map(L => ({ item: L.item, x: L.x, y: y0 + L.y / TILE_WIDE, w: L.w, h: L.h / TILE_WIDE }));

  /* TILE WALLS HOLD THEIR SCREEN WIDTH (2026-09-11). A wall used to be sw in grid units, so it
     scaled with the zoom: at fit a 4.2 outline was ~1.5px, but zoomed in on a small tile it grew
     until it covered the caption it framed. Walls are now non-scaling (sw in screen pixels) and
     sized by the tile's short side: `cap` px on a tile at least 1.8 grid units across, down to
     half a pixel on a sliver. Zooming in therefore makes every wall thinner relative to its tile,
     and the full caption of even the smallest dataset reads once you are close enough. */
  const wallPx = (w, h, cap) => Math.max(0.5, Math.min(cap, cap * Math.min(w, h) / 1.8));
  /* ONE RECTANGLE PER TILE (2026-09-11). The fill, the accent outline, a split tile's halves and the
     stale overlay all share it, so the coloured border IS the box's edge. The accent used to sit 0.15
     inside a grey edge; the old 4.2-unit stroke hid the gap, and once walls went thin it showed as a
     coloured frame drifting away from its box. EDGE is the gap between neighbouring datasets. */
  const EDGE = 0.10;

  const drawTiles = (tiles, x0, y0, w0, h0, max) => {
    layoutWide(tiles, x0, y0, w0, h0).forEach(L => {
      const it = L.item;
      /* opacity carries a second channel — object count density — so two
         tiles of equal bytes are still distinguishable when one is a single
         16 GB zip and the other is 256 FASTQs */
      const heat = 0.10 + 0.30 * Math.sqrt(it.value / max);
      const tw = L.w - EDGE, th = L.h - EDGE;
      /* a tile that gets a coloured (or dashed) outline below draws no grey edge of its own */
      const outlined = !!it.accent || it.legacy > 0;
      plate(g, L.x, L.y, tw, th,
        { fill: ink, fo: heat, stroke: outlined ? "none" : ink, sw: wallPx(L.w, L.h, 0.6), so: 0.6, nss: true });

      /* A tile may be split: the part of a prefix that belongs to the
         aspirational six-stage layout, and the part still in the legacy
         folders. Each half is captioned in place and the whole tile is
         outlined in its own accent, so a dataset reads as one object with a
         visible internal boundary rather than as two tiles that happen to
         sit together. */
      if (it.legacy > 0 && it.legacy < it.value) {
        const frac = it.legacy / it.value;
        const w = tw, h = th;   /* the tile's own rect: halves and outline share its edge */
        const horiz = w >= h;
        const lw = horiz ? w * frac : w;
        const lh = horiz ? h : h * frac;
        const lx = horiz ? L.x + w / 2 - lw / 2 : L.x;
        const ly = horiz ? L.y : L.y + h / 2 - lh / 2;
        /* dashed, like a wholly-legacy tile's outline: one vocabulary for
           "retained, not what to build on" whichever bucket you are looking at,
           and it survives the accent rule being drawn over the pair below. */
        plate(g, lx, ly, lw, lh,
          { fill: "var(--fg3)", fo: 0.20, stroke: "var(--fg3)", sw: wallPx(lw, lh, 1.1), so: 0.75, dash: "4 3", nss: true });

        /* the aspirational half is whatever the band does not cover */
        const aw = horiz ? w - lw : w;
        const ah = horiz ? h : h - lh;
        const ax = horiz ? L.x - w / 2 + aw / 2 : L.x;
        const ay = horiz ? L.y : L.y - h / 2 + ah / 2;

        const cap = (cx, cy, cw, ch, kind, short, bytes, col) => {
          /* Three rows, always: what the half is called, what kind of half it
             is, and how big it is. Earlier this degraded by dropping rows —
             first the size, then the kind word — which is how the aspirational
             half came to carry no figure and the legacy half no label at all.
             A half is now sized on its longest row and the whole stack scaled
             by one factor, with no floor, so it shrinks rather than sheds. */
          const availPx = Math.max((cw - 0.50) * S, 1);
          const availH = Math.max(ch - 0.28, 0.01);
          const base = [
            { t: it.key, z: CAP_KEY, c: col },
            { t: kind, z: CAP_SIZE, c: col },
            { t: fmtBytes(bytes), z: CAP_SIZE, c: "var(--fg3)" }
          ];
          let k = 1;
          for (const r of base) k = Math.min(k, availPx / textW(r.t, r.z));
          k = Math.min(k, availH / base.reduce((a, b) => a + capH_(b.z), 0));
          const rows = base.map(r => ({ t: r.t, z: r.z * k, c: r.c }));
          const tot = rows.reduce((a, b) => a + capH_(b.z), 0);
          let y = cy - tot / 2;
          rows.forEach(r => {
            y += capH_(r.z) / 2;
            label(g, cx, y, r.t, { size: r.z, fill: r.c, ls: 0.03 });
            y += capH_(r.z) / 2;
          });
        };
        cap(ax, ay, aw, ah, "aspirational", null, it.value - it.legacy, "var(--fg)");
        cap(lx, ly, lw, lh, "legacy", null, it.legacy, "var(--fg3)");

        /* the dataset's own outline, drawn last so it sits over both halves */
        plate(g, L.x, L.y, w, h,
          { fill: "none", stroke: it.accent || ink, sw: wallPx(w, h, 1.6), so: 1, nss: true });
        return;   /* both halves captioned; skip the single-caption path */
      }

      /* A stale tile — content that does not belong to the current
         architecture — is restroked in the drop colour so it reads even at a
         hairline width. */
      if (it.stale) {
        plate(g, L.x, L.y, tw, th, { fill: "url(#pHl)", stroke: "none" });
        plate(g, L.x, L.y, Math.max(tw, 0.1), Math.max(th, 0.1),
          { fill: "none", stroke: "var(--drop)", sw: wallPx(L.w, L.h, 1.2), so: 0.95, nss: true });
      }

      /* FIT, ALWAYS.
         Nothing is captioned outside the enclosure. A caption that has been
         led out to open ground is wrong at every zoom; a caption shrunk to
         two points is merely small at overview and exact once you are in,
         and this map zooms. So the whole stack — key, bytes, objects — is
         scaled by one factor until it fits the tile on both axes, and the
         factor has no floor. Keep the three rows together: a tile captioned
         with a key and no figure answers none of the question the treemap
         exists to ask. */
      /* Padding, not just fitting. The accent outline is inset 0.15 from the
         tile edge and strokes 4.2px about that line, so text clearing only the
         tile would still sit on the rule. Reserve 0.31 a side horizontally and
         0.17 vertically: clear of the outline, and visibly clear of it. */
      /* Padding scales with the tile (2026-09-11). It was a flat 0.31 a side across and 0.17 down, to
         clear the old 4.2-unit outline; on a sliver that ate nearly all of the tile and left its
         caption a speck in an empty box. Walls are hairlines now, so small tiles give their text
         nearly all their own room, and large tiles keep the old margins. */
      /* padding shrinks with the tile so the smallest captions get the room (2026-09-11: 8%/10% -> 5%/6%) */
      const padX = Math.min(0.31, Math.max(0.03, 0.05 * tw));
      const padY = Math.min(0.17, Math.max(0.02, 0.06 * th));
      const availPx = Math.max((tw - 2 * padX) * S, 1);
      const availH = Math.max(th - 2 * padY, 0.01);
      /* WHOLLY LEGACY. `legacy` is a byte count, and the split-tile path above
         handles a prefix that is part legacy. When it covers the whole prefix
         there is no boundary to draw — the tile itself is the legacy thing —
         and it should not read as "here is a live dataset" in a dataset
         accent. It takes the reader panel's legacy vocabulary instead: dashed
         rule, no accent, captions receded a step. */
      const wholly = it.value > 0 && it.legacy >= it.value;
      /* TWO ROWS, ONE SIZE. A caption is the key and its size - the object count lives in the reader
         panel, not on the tile. Every tile starts from the same CAP_KEY / CAP_SIZE and only shrinks
         when it must; a big tile no longer gets big type, so the eye reads the tiles' AREAS, which
         are the data, rather than their lettering. */
      const base = [
        { t: it.key, z: CAP_KEY, c: wholly ? "var(--fg3)" : "var(--fg)" },
        /* the size is grey so the dataset's name stands out (2026-09-11) */
        { t: fmtBytes(it.value) + (wholly ? " · legacy" : ""), z: CAP_SIZE, c: "var(--fg3)" }
      ];
      /* SHRINK, THEN SHED ONE ROW — and only one. The rule above is that a
         caption shrinks rather than sheds, because a tile with a key and no
         figure answers nothing. That holds until the tile is small enough that
         three rows land at four pixels, where the glyph box is taller than the
         line pitch and the rows genuinely overlap: wagner/ is 0.9% of this
         bucket and put "1.59 GiB" 11px into "6 obj". Below the legibility
         floor the object count goes and the SIZE STAYS, so the tile still says
         what it is and how big — which was the whole point of not shedding. */
      const fit = rows => {
        let k = 1;
        for (const r of rows) k = Math.min(k, availPx / textW(r.t, r.z));
        return Math.min(k, availH / rows.reduce((a, b) => a + capH_(b.z), 0));
      };
      let k = fit(base);
      /* Shed one row at a time until what is left clears the legibility floor.
         Three rows down to two covers a tile at 1% of a bucket; at 0.06% —
         tomoseq/ is 641 KiB against 211 GiB — even two rows overlap, and the
         honest end of the ladder is the key alone. A one-line tile is a swatch
         saying "something is here, and the panel will tell you what", which is
         a better answer than two unreadable lines on top of each other. */
      /* No shedding any more (2026-09-11). Rows used to be dropped once the key fell below 6pt at
         draw time, so a small tile kept only its key - and zooming in could never bring its size
         back. Now walls hold their screen width and the map is meant to be zoomed into, so every
         tile keeps its key AND its size. A tile too small for two readable rows sets them on one
         line instead: one line cannot collide with itself, and wide tiles suit it. */
      /* ONE LINE: one <text> holding two <tspan>s - the key in the key colour, the size in grey -
         so each keeps its own colour while the line stays a single object that centres as one and
         cannot collide with itself (two side-by-side labels touched on the tiniest tiles, where
         real glyphs run wider than the width estimate). Scaled until it fits on both axes. Used
         only when two rows would fall under the floor AND one line sets bigger type - a narrow,
         tall tile (farrell/, human/nadig/) reads larger stacked than strung out. Whichever sets the
         bigger key wins. (At the overview Chrome rounds 1-3px glyph boxes up a pixel, so stacked specks
         there can "touch"; zoomed in they clear - check-overlaps skips pairs under 4px.) */
      const kt = base[0].t, st = base[1].t, GAP = "  ";
      let z = Math.min(CAP_KEY, CAP_KEY * availPx / Math.max(textW(kt + GAP + st, CAP_KEY), 1));
      z = Math.min(z, availH / (TYPE * 1.05 / S));   /* one line has no row below it to clear: 1.05, not capH_'s 1.22 */
      if (base[0].z * k < TWO_ROW_MIN && z >= base[0].z * k) {
        const t = label(g, L.x, L.y, "", { size: z, fill: it.stale ? "var(--drop)" : base[0].c, ls: 0.03 });
        add(t, "tspan", {}).textContent = kt;
        add(t, "tspan", { fill: it.stale ? "var(--drop)" : base[1].c }).textContent = GAP + st;
      } else {
        const rows = base.map(r => ({ t: r.t, z: r.z * k, c: r.c }));
        const total = rows.reduce((a, b) => a + capH_(b.z), 0);
        let cy = L.y - total / 2;
        rows.forEach(r => {
          cy += capH_(r.z) / 2;
          label(g, L.x, cy, r.t, { size: r.z, fill: it.stale ? "var(--drop)" : r.c, ls: 0.03 });
          cy += capH_(r.z) / 2;
        });
      }

      /* the dataset's own outline, in its category colour, drawn over the fill
         so a tile reads as the same kind of thing the reader's tree calls it */
      if (it.accent || wholly) {
        plate(g, L.x, L.y, tw, th,
          wholly
            ? { fill: "none", stroke: "var(--fg3)", sw: wallPx(L.w, L.h, 1.2), so: 0.8, dash: "4 3", nss: true }
            : { fill: "none", stroke: it.accent, sw: wallPx(L.w, L.h, 1.6), so: 1, nss: true });
      }
    });
  };

  if (n.groups && n.groups.length) {
    const tilesOf = gr => gr.sub ? gr.sub.flatMap(sg => sg.tiles) : gr.tiles;
    const all = n.groups.flatMap(tilesOf);
    const max = Math.max(...all.map(t => t.value));
    const totals = n.groups.map(gr => tilesOf(gr).reduce((a, t) => a + t.value, 0));
    const sum = totals.reduce((a, b) => a + b, 0);
    const capH = 1.0;
    /* A GUTTER, NOT JUST AN EDGE. The two columns met at a single tile border,
       which reads as one treemap with an accident in the middle rather than as
       two kinds of thing. The gap is taken off the top and the remainder split
       by bytes, so each column is still proportional to what it holds and
       cross-column area comparison still means what it did. */
    const GUTTER = 1.1;
    const usable = fw - GUTTER * (n.groups.length - 1);
    let gx = fx;
    n.groups.forEach((gr, gi) => {
      const gw = usable * totals[gi] / sum;
      /* FIT THE CAPTION TO ITS COLUMN. The first pair of these ran into each
         other across the divide, which reads as one long broken word. Same
         treatment the tile captions get: shrink until it fits, no floor. */
      /* An unlabelled group draws no caption and keeps no row for one: the open-source vault is one
         kind of thing throughout, and a column caption there would only repeat the vault's name. */
      const ch = gr.label ? capH : 0;
      if (gr.label) {
        const capZ = Math.min(8.2, 8.2 * ((gw - 0.6) * S) / Math.max(textW(gr.label.toUpperCase(), 8.2), 1));
        label(g, gx + gw / 2, fy + capH / 2, gr.label,
          { size: capZ, fill: "var(--fg3)", ls: 0.1, upper: true });
      }
      if (gr.sub) {
        /* SUB-SECTIONS, STACKED. A column whose contents are several kinds of
           data splits into bands, one per kind, captioned. Band heights are
           proportional to bytes EXCEPT that each gets a floor: anatomy volumes
           are 0.28% of this bucket and a truthfully-scaled band for them would
           be a tenth of a grid unit — invisible, and a section nobody can see
           is not a section. The floor is declared rather than hidden: a band
           sitting on it is captioned "(not to scale)". Within every band the
           tiles are exact, and the two top-level columns are exact. */
        /* BAND_GAP: air between categories (2026-09-11), taken off before bytes share out the rest */
        const FLOOR = 2.1, SUBCAP = 0.85, BAND_GAP = 0.6;
        const inner = fh - ch - BAND_GAP * (gr.sub.length - 1);
        const subT = gr.sub.map(sg => sg.tiles.reduce((a, t) => a + t.value, 0));
        const subSum = subT.reduce((a, b) => a + b, 0);
        const wanted = subT.map(v => inner * v / subSum);
        const floored = wanted.map(v => v < FLOOR);
        const slack = inner - floored.reduce((a, f, i) => a + (f ? FLOOR : 0), 0);
        const freeSum = subT.reduce((a, v, i) => a + (floored[i] ? 0 : v), 0);
        let sy = fy + ch;
        gr.sub.forEach((sg, si) => {
          const sh = floored[si] ? FLOOR : slack * subT[si] / freeSum;
          /* Scale a band caption to its band, exactly as the column captions and
             the tile captions are. Left unscaled, the longer ones hung a grid
             unit off the side of the vault. */
          /* No "~" on a floored band any more (2026-09-11): the reader asked for the category
             names alone. The floor itself still applies; only the marker is gone. */
          const stxt = sg.label;
          /* Band captions are drawn exactly as written (2026-09-11): "ZEBRAFISH scRNA-Seq" must keep
             its lower-case "sc", so no forced caps here; the data carries the capitals it wants. */
          const sz = Math.min(7.2, 7.2 * ((gw - 0.5) * S) / Math.max(textW(stxt, 7.2), 1));
          label(g, gx + gw / 2, sy + SUBCAP / 2, stxt,
            { size: sz, fill: "var(--fg3)", ls: 0.06 });
          drawTiles(sg.tiles, gx, sy + SUBCAP, gw, sh - SUBCAP, max);
          sy += sh + BAND_GAP;
        });
      } else {
        drawTiles(gr.tiles, gx, fy + ch, gw, fh - ch, max);
      }
      gx += gw + GUTTER;
    });
  } else if (n.tiles && n.tiles.length) {
    drawTiles(n.tiles, fx, fy, fw, fh, Math.max(...n.tiles.map(t => t.value)));
  }
};

/* ============================================================
   FLOOR — a git repository, seen from above.

   Drawn as a machine floor rather than a container: single wall and a hatched
   margin. The cells inside are their own nodes so each one can be read.

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
  plate(g, n.x, n.y, n.w - 0.5, n.h - 0.5, { fill: "url(#pHl)", stroke: ink, sw: 0.6, so: 0.28 });
  const top = titlebar(g, n, n.repo, n.right);

  /* No command rail. It used to run along the bottom of every floor listing
     fetch / convert / build / publish — which is the same four words as the
     four cells stacked above it. One of them had to go, and the cells are the
     ones carrying the figures. */
  return top;
};

/* ============================================================
   CELL — one module inside a repo floor.

   state:"live"      implemented AND exercised against the real bucket
   state:"ready"     implemented, never run
   state:"stub"      a function that raises, with its gating reason
   state:"proposed"  implemented AND exercised, but not on main yet

   THE THIRD STATE IS NEW AND IT EARNED ITS PLACE. For as long as this map had
   two, "written" and "has run" were the same mark, because on the first reads
   every step that was written had run and every step that had not was a stub.
   That stopped being true when zsb-silver's fetch was written against a
   release that now exists: a real implementation, pinned to a real object,
   with nothing on this map able to show whether anybody has run it. Drawing
   it live would claim bytes moved; drawing it as a stub would claim a
   function that raises. It is neither.

   The lamp carries the distinction and the plate carries the other half:

     plate solid             ->  merged, on main
     plate dashed            ->  not on main
     plate dashed + hatched  ->  raises
     lamp hollow             ->  has not moved bytes
     lamp filled             ->  has

   So a ready cell is a solid box with a hollow lamp, which reads as "built,
   not yet lit" — which is exactly what it is.

   THE FOURTH STATE, LIKEWISE, EARNED ITS PLACE. ChemFish's acquire is written,
   is exercised, and has moved 38 GB into silver — and is not on main; it is a
   pull request. Drawing it live would claim the repo contains it. Drawing it
   ready would claim nobody has run it, when it is the reason a whole prefix
   exists. Drawing it as a stub would claim it raises.

   The two marks already carry exactly this: the plate says what the code IS,
   the lamp says whether bytes MOVED. Those are independent, and "proposed" is
   simply the combination the map had not needed yet — dashed plate, no hatch,
   filled lamp. Unmerged, and it ran.
   ============================================================ */
DRAW.cell = (g, n) => {
  const ink = inkOf(n), stub = n.state === "stub";
  const proposed = n.state === "proposed";
  /* filled for anything that has actually moved bytes, which now includes a
     step that did so from a branch */
  const live = n.state === "live" || proposed;
  plate(g, n.x, n.y, n.w, n.h, {
    fill: stub ? "var(--bg)" : ink, fo: stub ? 0.55 : 0.16,
    stroke: ink, sw: 1.1, so: stub ? 0.55 : 0.95,
    dash: stub || proposed ? "5 3" : "none"
  });
  if (stub) plate(g, n.x, n.y, n.w, n.h, { fill: "url(#pX)", stroke: "none" });
  label(g, n.x, n.y - (n.note ? lineH(10) / 2 : 0), n.cellName || n.name,
    { size: 10, fill: "var(--fg)", ls: 0.04 });
  if (n.note) label(g, n.x, n.y + lineH(8.4) / 2 + 0.16, n.note,
    { size: 8.4, fill: stub ? "var(--drop)" : "var(--fg2)" });
  /* the lamp: filled only when the step has actually run against the bucket */
  const [lx, ly] = P(n.x + n.w / 2 - 0.45, n.y - n.h / 2 + 0.45);
  add(g, "circle", {
    cx: lx, cy: ly, r: 6,
    fill: live ? "var(--signal)" : "none",
    stroke: stub ? "var(--drop)" : "var(--signal)", "stroke-width": 1.6
  });
};

/* ============================================================
   BAND — a bounding group around the cells that share an ingest kind.

   The floor used to stack five cells with nothing saying that four of them are
   one pipeline and the fifth is a different one. They are not variations on a
   theme: fetch/convert/build/publish run on a Parse delivery a human put in
   Fort Knox, and acquire runs on a dataset someone else published to the open
   internet. Same repo, same tier, incompatible provenance — and the map drew
   them as five siblings.

   The band carries the distinction structurally instead of asking the reader to
   infer it from a note. Its label runs vertically up the left margin because
   that is the only space a floor has spare: the cells are 19 wide inside a 22
   floor, and a horizontal header would have meant moving every cell and every
   wire that lands on one.
   ============================================================ */
DRAW.band = (g, n) => {
  plate(g, n.x, n.y, n.w, n.h, {
    fill: n.ink, fo: 0.05, stroke: n.ink, sw: 1.0, so: 0.5, dash: "3 2.5"
  });
  /* the label reads bottom-to-top up the left margin, the way a spine does */
  const [lx, ly] = P(n.x - n.w / 2 + 0.55, n.y);
  const t = add(g, "text", {
    x: lx, y: ly, fill: n.ink, "font-size": 8.8, "letter-spacing": 0.5,
    "font-weight": 700,
    "text-anchor": "middle", "dominant-baseline": "central",
    transform: `rotate(-90 ${lx} ${ly})`, opacity: 1
  });
  t.textContent = n.bandName;
};

/* ============================================================
   SPINE — zsb-medallion, the shared contract, running down beside the
   transform column.

   A rail rather than a station, because that is what the package is: not a
   step in the flow, but the thing every transform imports its vocabulary
   from. It touches no bucket and moves no bytes, so it gets no door and no
   treemap — just a bar, the names it exports stacked down it, and one tap
   reaching left into each repo it serves.

   n.taps: y positions of the repos to tap, in grid units
   ============================================================ */
DRAW.spine = (g, n) => {
  const ink = inkOf(n);
  plate(g, n.x, n.y, n.w, n.h, { fill: ink, fo: 0.11, stroke: ink, sw: 1.5, so: 0.9 });
  plate(g, n.x, n.y, n.w - 0.2, n.h - 0.2, { fill: "none", stroke: ink, sw: 0.6, so: 0.3 });

  /* The title sits in a bar across the TOP of the rail, horizontal like every
     other title on the map. A rail this narrow invites a rotated label, and a
     rotated label is the one thing a plan view has no excuse for: there is no
     foreshortened axis here for it to lie along. */
  const y0 = n.y - n.h / 2, BH = 3.4;
  plate(g, n.x, y0 + BH / 2, n.w, BH, { fill: ink, fo: 0.16, stroke: ink, sw: 1, so: 0.5 });
  label(g, n.x, y0 + BH / 2 - lineH(9.6) / 2, "zsb-", { size: 9.6, fill: ink, ls: 0.06 });
  label(g, n.x, y0 + BH / 2 + lineH(9.6) / 2, "medallion", { size: 9.6, fill: ink, ls: 0.06 });

  /* the exported names, stacked down the rail — the actual contract */
  if (n.exports) {
    const top = y0 + BH + 0.6, span = (n.h - BH - 1.2) / n.exports.length;
    n.exports.forEach((e, i) => {
      const cy = top + span * (i + 0.5);
      plate(g, n.x, cy, n.w - 1.2, Math.min(span - 0.7, 2.8),
        { fill: "var(--bg)", fo: 0.62, stroke: ink, sw: 0.7, so: 0.5 });
      /* 9.6px, i.e. NOT fine-tier: eight chips down a 57-unit rail have room
         for their captions at any zoom, and without them the contract reads as
         an empty tube rather than as the list of names it is. */
      label(g, n.x, cy, e, { size: 9.6, fill: "var(--fg)" });
    });
  }

  /* Tap stubs reaching LEFT out of the rail into each transform repo.
     A tap is {y, pin} — the version of the contract that repo actually pins,
     which is not the same answer for all three of them. The rail is at
     v0.5.0; zsb-bronze has moved to it and the other two have not. That used
     to be a sentence in the reader; it is drawn here instead, because "the
     three consumers of one contract are not on the same version of it" is a
     fact about the wiring and belongs on the wiring. A tap whose pin is
     behind the rail is stroked in the drop colour. */
  (n.taps || []).forEach(t => {
    const tap = typeof t === "number" ? { y: t } : t;
    const ty = tap.y, behind = tap.pin && n.right && tap.pin !== n.right;
    const tint = behind ? "var(--drop)" : ink;
    const x0 = n.x - n.w / 2, x1 = x0 - (n.tapLen || 3);
    add(g, "path", {
      d: path([[x0, ty], [x1, ty]]),
      stroke: tint, "stroke-width": 1.2, "stroke-opacity": behind ? 0.75 : 0.5,
      "stroke-dasharray": "3 3", fill: "none"
    });
    const [cx, cy] = P(x1, ty);
    add(g, "circle", { cx, cy, r: 2.8, fill: "var(--bg)", stroke: tint, "stroke-width": 1.1 });
    label(g, (x0 + x1) / 2, ty - 0.75, "imports", { size: 8, fill: "var(--fg3)" });
    if (tap.pin) label(g, (x0 + x1) / 2, ty + 0.75, tap.pin,
      { size: 8, fill: behind ? "var(--drop)" : "var(--fg3)" });
  });
};

/* ============================================================
   BAY — a place a thing is meant to be, and is not.

   The one shape on this map that draws an absence. Cross-hatched in the drop
   colour, dashed wall, and it names the key that would be there.
   ============================================================ */
/* A bay is a room on a conduit: a set of object keys the architecture says
   will exist at a place. It has two states and they are drawn as opposites,
   because the whole point of putting it on the map is that a reader can see
   which one it is in without reading a word.

   EMPTY: dashed, hatched, in --drop. Specified and not built.
   FILLED: solid, in --signal, each key with its size. Built.

   The bay for minifin/v1/ was drawn empty for as long as this page has
   existed and is now filled. Keep both states: the next release prefix starts
   empty too, and a map that can only draw the good news is not a plan. */
DRAW.bay = (g, n) => {
  const on = !!n.filled, tone = on ? "var(--signal)" : "var(--drop)";
  plate(g, n.x, n.y, n.w, n.h, { fill: "var(--bg)", fo: on ? 0.9 : 0.5,
    stroke: tone, sw: 1.3, so: on ? 1 : 0.8, dash: on ? null : "6 4" });
  if (!on) plate(g, n.x, n.y, n.w, n.h, { fill: "url(#pX)", stroke: "none" });
  const rows = (n.lines || []).length;
  const top = n.y - (lineH(9.6) + rows * lineH(9)) / 2;
  label(g, n.x, top + lineH(9.6) / 2, n.headline,
    { size: 9.6, fill: tone, ls: 0.05, upper: true });
  (n.lines || []).forEach((L, i) =>
    label(g, n.x, top + lineH(9.6) + (i + 0.5) * lineH(9), L, { size: 9, fill: "var(--fg2)" }));
};

