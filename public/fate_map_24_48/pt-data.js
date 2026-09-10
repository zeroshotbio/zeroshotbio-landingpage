/* pt-data.js — load graph.json and meta.json, and lay the graph out once.
 *
 * The build script (scripts/build_fate_map_24_48.py) does everything that needs
 * R or the source files; this does everything that needs to know how wide the
 * plate is. The split is deliberate: no figure on this page is ever computed
 * from a number typed into the HTML, and nothing here re-reads a source.
 *
 * Layout. x is DEPTH IN THE GRAPH, not time. That guarantees every arrow points
 * rightward, which is what keeps 173 of them readable without a force
 * simulation, and it keeps the structural claim (what connects to what) visually
 * separate from the timing claim (when a state is abundant), which is carried on
 * the node instead. Conflating the two would be the easiest way to make this
 * page say something it cannot support.
 */
(function (global) {
  'use strict';

  const BASE = '/fate_map_24_48/';

  async function getJSON(path) {
    const r = await fetch(BASE + path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(path + ' — HTTP ' + r.status);
    return r.json();
  }

  /* Order a component's nodes into depth columns, then pack the columns
   * vertically. Within a column, children sit near the mean row of their
   * parents: a cheap barycentre pass, run twice, which removes most crossings
   * and costs nothing at this size. */
  function orderComponent(nodes, edges, ids) {
    const set = new Set(ids);
    const cols = new Map();
    ids.forEach((i) => {
      const d = nodes[i].depth;
      if (!cols.has(d)) cols.set(d, []);
      cols.get(d).push(i);
    });
    const depths = [...cols.keys()].sort((a, b) => a - b);
    const parents = new Map();
    ids.forEach((i) => parents.set(i, []));
    edges.forEach((e) => {
      if (set.has(e.s) && set.has(e.t)) parents.get(e.t).push(e.s);
    });

    const row = new Map();
    depths.forEach((d) => cols.get(d).forEach((i, k) => row.set(i, k)));
    for (let pass = 0; pass < 2; pass++) {
      depths.forEach((d) => {
        const col = cols.get(d);
        col.sort((a, b) => {
          const pa = parents.get(a), pb = parents.get(b);
          const ma = pa.length ? pa.reduce((s, p) => s + row.get(p), 0) / pa.length : row.get(a);
          const mb = pb.length ? pb.reduce((s, p) => s + row.get(p), 0) / pb.length : row.get(b);
          return ma - mb || nodes[a].name.localeCompare(nodes[b].name);
        });
        col.forEach((i, k) => row.set(i, k));
      });
    }
    return { depths, cols, height: Math.max(...depths.map((d) => cols.get(d).length)) };
  }

  /* Place every component in one coordinate system.
   *
   * Two layouts were built and rendered before this one, and both failed in the
   * same way — by leaving most of the paper empty (PLATE_STYLE.md §5.6: every
   * real fault was invisible in the code and obvious in a screenshot).
   *
   *   one tall stack      content 1330 x 2110, aspect 0.63 — a ribbon down the
   *                       left, two thirds of the plate blank
   *   three super-columns content 4562 x  708, aspect 6.44 — a band across the
   *                       top, and the same blank paper below it
   *
   * The cause is that this graph is 26 pieces of wildly different shape: the
   * largest is eight depths wide, and half of them are one or two. Reserving the
   * full depth grid for every piece wastes exactly the space the small ones do
   * not use. So components are SHELVED instead — laid left to right at their own
   * width until the shelf is full, then a new shelf — which packs to roughly the
   * plate's own aspect and keeps the row pitch large enough to click.
   *
   * The cost is that depth no longer lines up across components, so there is no
   * global depth axis. x is still depth WITHIN a component, every arrow still
   * points rightward, and the exact depth of any state is one click away in the
   * panel. An axis that only lined up inside each little box would be furniture
   * pretending to be a scale.
   */
  function layout(graph) {
    const { nodes, edges } = graph;
    const byComp = new Map();
    nodes.forEach((n) => {
      if (!byComp.has(n.comp)) byComp.set(n.comp, []);
      byComp.get(n.comp).push(n.i);
    });

    const COL_W = 190;    /* depth column pitch, CSS px at zoom 1 */
    const ROW_H = 22;     /* row pitch inside a component          */
    const GX = 120;       /* gutter between components on a shelf  */
    const GY = 34;        /* gutter between shelves                */
    const SHELF = 9 * COL_W;

    const comps = [...byComp.keys()].map((c) => {
      const ids = byComp.get(c);
      const ord = orderComponent(nodes, edges, ids);
      let tallest = 0;
      ord.depths.forEach((d) => { tallest = Math.max(tallest, ord.cols.get(d).length); });
      const width = Math.max(...ids.map((i) => nodes[i].depth)) * COL_W;
      return { c, ids, ord, tallest, width, n: ids.length };
    }).sort((a, b) => b.tallest - a.tallest || b.n - a.n || a.c - b.c);

    let x = 0, y = 0, shelfH = 0;
    const bands = [];
    comps.forEach((cm) => {
      if (x > 0 && x + cm.width > SHELF) { y += shelfH + GY; x = 0; shelfH = 0; }
      cm.ord.depths.forEach((d) => {
        cm.ord.cols.get(d).forEach((i, k) => {
          nodes[i].x = x + d * COL_W;
          nodes[i].y = y + k * ROW_H;
        });
      });
      bands.push({ comp: cm.c, x0: x, x1: x + cm.width,
                   y0: y, y1: y + (cm.tallest - 1) * ROW_H, n: cm.n });
      x += cm.width + GX;
      shelfH = Math.max(shelfH, (cm.tallest - 1) * ROW_H);
    });

    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    graph.bands = bands;
    graph.extent = {
      x0: Math.min(...xs), x1: Math.max(...xs),
      y0: Math.min(...ys), y1: Math.max(...ys),
    };
    graph.colW = COL_W;
    graph.maxDepth = Math.max(...nodes.map((n) => n.depth));

    /* Adjacency, built once. The panel needs parents and children by name and
     * the renderer needs them by index; both read this. */
    graph.parents = nodes.map(() => []);
    graph.children = nodes.map(() => []);
    edges.forEach((e, k) => {
      graph.children[e.s].push({ n: e.t, e: k });
      graph.parents[e.t].push({ n: e.s, e: k });
    });
    return graph;
  }

  async function load() {
    const [graph, meta] = await Promise.all([getJSON('graph.json'), getJSON('meta.json')]);
    /* The enrichment is a separate pass with a heavy prerequisite (the 1.2M-cell
     * CDS). The page draws without it, so a missing or stale enrich.json degrades
     * to the first-pass panel rather than failing the plate. */
    let enrich = null;
    try { enrich = await getJSON('enrich.json'); } catch (err) { console.warn('no enrich.json:', err.message); }
    let sources = null;
    try { sources = await getJSON('sources.json'); } catch (err) { console.warn('no sources.json:', err.message); }
    let zmap = null;
    try { zmap = await getJSON('zmap.json'); } catch (err) { console.warn('no zmap.json:', err.message); }

    /* Plate III's three files. The 6.4 MiB binary is the only large asset on the
     * page; if it or its companions are missing the plate is skipped and the
     * rest of the page is unaffected. */
    let embed = null;
    try {
      const [em, st, cb] = await Promise.all([
        getJSON('embed_meta.json'), getJSON('states.json'),
        fetch(BASE + 'cells.bin', { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('cells.bin — HTTP ' + r.status);
          return r.arrayBuffer();
        }),
      ]);
      embed = { meta: em, states: st, cells: window.PTEmbed.decode(cb) };
      if (embed.cells.n !== em.n_cells) throw new Error('cells.bin disagrees with embed_meta.json');
    } catch (err) { console.warn('no embedding:', err.message); embed = null; }
    let perturb = null;
    try { perturb = await getJSON('perturb.json'); } catch (err) { console.warn('no perturb.json:', err.message); }

    /* Cross-check the two files against each other rather than trusting either.
     * A half-deployed asset set should fail loudly, not draw something
     * plausible — see PLATE_STYLE.md §4. */
    if (graph.nodes.length !== meta.counts.states || graph.edges.length !== meta.counts.edges) {
      throw new Error('graph.json disagrees with meta.json — a stale file is cached');
    }
    return { graph: layout(graph), meta, enrich, sources, zmap, embed, perturb };
  }

  global.PT = { load, BASE };
})(window);
