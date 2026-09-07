/* /dev_tree — a 0–48 hpf zebrafish developmental tidy tree.
 *
 * WHAT THE PICTURE CLAIMS, AND WHAT IT DOES NOT
 *   Parent -> child edges are ANNOTATION CONTAINMENT out of the DanioCell
 *   cluster-annotation table: tissue.subsets -> tissue -> identity.super.
 *   They are NOT cell lineage. DanioCell has no lineage tracing; a cell in
 *   the `notochord` tip is not asserted to descend from anything else drawn
 *   here. Where ZFA does record a lineage relation (`develops_from`) it is
 *   shown in the hover card, marked as ontology lineage, and never used to
 *   position anything.
 *
 * COLOUR
 *   Fill = the node's ZFA structural kind. Four hues for the four rungs of
 *   ZFA's structural ladder; ink for the two classes off that ladder. The
 *   set was picked by running the palette validator over both surfaces on the
 *   ALL-PAIRS list — see the token block in index.html for the numbers and
 *   the conditions the two WARNs come with. Mark SHAPE repeats the kind, so
 *   nothing is ever identified by colour alone; keep it that way.
 *
 * LAYOUT
 *   y is a tidy (Reingold-Tilford-style) layout over the tips; x is TIME, in
 *   hpf, on a 0–48 domain. The root sits at 0 hpf, out on its own, because
 *   DanioCell's first sample is at 3 and pretending otherwise would put the
 *   root on top of the whole blastula column.
 *
 * No build step, no dependencies. Data: /dev_tree/tree.json (built by
 * scripts/build_dev_tree.py).
 */
(function () {
  'use strict';

  var ROW = 16;           // vertical pitch per tip
  var GAP = 14;           // extra gap between top-level programs
  var PAD_T = 16, PAD_B = 30;
  var LGUT = 116;         // left gutter — the twenty programme names live here
  var PLOT_L = LGUT + 10; // left edge of the time axis
  var PLOT_W_MIN = 1120;  // the time axis never squeezes below this; past it, pan
  var GUTTER = 300;       // right column the tip labels are aligned in
  var MARK_MIN = 2.8, MARK_MAX = 8.5;
  var ELBOW_R = 5;        // corner radius on the branch elbows

  // ZFA structural kind -> mark shape + colour class. Shape repeats what the
  // hue says: that is the secondary encoding the palette's CVD/contrast WARNs
  // are conditional on, and it is also what makes the chart survive greyscale
  // print and forced-colors. Order here is the legend order.
  var KINDS = [
    ['cell', 'circle', 'k-cell', 'ZFA is_a* cell'],
    ['tissue', 'square', 'k-tissue', 'ZFA is_a* portion of tissue'],
    ['multi-tissue structure', 'diamond', 'k-multi', 'ZFA is_a* multi-tissue structure'],
    ['organ', 'pentagon', 'k-organ', 'ZFA is_a* organ'],
    ['embryonic structure', 'triangle', 'k-embryo', 'ZFA files it as existing only during development — off the structural ladder'],
    [null, 'hollow', 'k-none', 'no ZFA term on this node']
  ];

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(node, s) { node.textContent = s; return node; }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var data = null, root = null, nodes = [], hot = null;
  var svg = document.getElementById('tree');
  var axis = document.getElementById('axis');
  var scroll = document.getElementById('scroll');
  var axisWrap = document.querySelector('.axis-wrap');
  var tip = document.getElementById('tip');

  // ---------------------------------------------------------------- shapes
  function markPath(shape, x, y, r) {
    switch (shape) {
      case 'square':
        return 'M' + (x - r) + ',' + (y - r) + 'h' + 2 * r + 'v' + 2 * r + 'h' + -2 * r + 'Z';
      case 'diamond':
        return 'M' + x + ',' + (y - r * 1.3) + 'L' + (x + r * 1.3) + ',' + y +
               'L' + x + ',' + (y + r * 1.3) + 'L' + (x - r * 1.3) + ',' + y + 'Z';
      case 'triangle':
        return 'M' + x + ',' + (y - r * 1.35) + 'L' + (x + r * 1.25) + ',' + (y + r * 0.88) +
               'L' + (x - r * 1.25) + ',' + (y + r * 0.88) + 'Z';
      case 'pentagon': {
        var pts = [];
        for (var i = 0; i < 5; i++) {
          var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
          pts.push((x + Math.cos(a) * r * 1.25).toFixed(2) + ',' + (y + Math.sin(a) * r * 1.25).toFixed(2));
        }
        return 'M' + pts.join('L') + 'Z';
      }
      default: {
        var rr = shape === 'hollow' ? r * 0.78 : r;
        return 'M' + (x - rr) + ',' + y + 'a' + rr + ',' + rr + ' 0 1,0 ' + 2 * rr + ',0' +
               'a' + rr + ',' + rr + ' 0 1,0 ' + -2 * rr + ',0Z';
      }
    }
  }
  function kindOf(n) {
    var k = n.zfa_id ? (n.zfa_kind || null) : null;
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i][0] === k) return KINDS[i];
    return KINDS[KINDS.length - 1];
  }

  // Rounded elbow: down (or up) the parent's riser, a small arc at the corner,
  // then across to the child. Degenerate cases — a child on its parent's own
  // row, or directly below it — fall back to the plain corner.
  function elbow(px, py, cx, cy) {
    var dy = cy - py, dx = cx - px;
    if (Math.abs(dy) < 0.5) return 'M' + px + ',' + py + 'H' + cx;
    if (Math.abs(dx) < 0.5) return 'M' + px + ',' + py + 'V' + cy;
    var r = Math.min(ELBOW_R, Math.abs(dy) / 2, Math.abs(dx));
    var sy = dy > 0 ? 1 : -1;
    return 'M' + px + ',' + py +
           'V' + (cy - sy * r) +
           'Q' + px + ',' + cy + ' ' + (px + r) + ',' + cy +
           'H' + cx;
  }

  // ---------------------------------------------------------------- layout
  function layout() {
    nodes = [];
    var slot = 0;

    function place(node, depth, parent) {
      node._depth = depth;
      node._parent = parent;
      var kids = node.children;
      if (!kids.length) {
        node._y = PAD_T + slot * ROW;
        slot += 1;
      } else {
        for (var i = 0; i < kids.length; i++) {
          if (depth === 0 && i > 0) slot += GAP / ROW;   // breath between programs
          place(kids[i], depth + 1, node);
        }
        node._y = (kids[0]._y + kids[kids.length - 1]._y) / 2;
      }
      nodes.push(node);
    }
    place(root, 0, null);

    var height = PAD_T + slot * ROW + PAD_B;
    // Fill the window when there is room, and hold a readable minimum when
    // there is not. The tree is tall (144 tips) long before it is wide, so
    // most panning is vertical and the tip column stays close to hand.
    var PLOT_W = Math.max(PLOT_W_MIN, scroll.clientWidth - PLOT_L - GUTTER - 22);
    var width = PLOT_L + PLOT_W + GUTTER;

    // The domain starts at 0 even though the data starts at 3: the root
    // belongs at 0 hpf, and the empty 0–3 gap is itself a finding worth
    // showing rather than a margin to trim away.
    var lo = 0, hi = data.meta.window_hpf[1];
    function xTime(hpf) { return PLOT_L + (hpf - lo) / (hi - lo) * PLOT_W; }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n._x = n._depth === 0 ? xTime(0) : xTime(n.onset);
      n._x2 = Math.max(n._x + 1, xTime(n.offset));
      n._r = Math.min(MARK_MAX, MARK_MIN + Math.sqrt(n.cells) / 32);
    }
    return { width: width, height: height, xTime: xTime, lo: lo, hi: hi,
             tipX: PLOT_L + PLOT_W + 16 };
  }

  // ---------------------------------------------------------------- render
  var TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 36, 42, 48];

  function render() {
    var L = layout();
    svg.setAttribute('width', L.width);
    svg.setAttribute('height', L.height);
    svg.setAttribute('viewBox', '0 0 ' + L.width + ' ' + L.height);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var gGrid = el('g', null, svg);
    var gEdge = el('g', null, svg);
    var gBar = el('g', null, svg);
    var gMark = el('g', null, svg);
    var gLbl = el('g', null, svg);
    var gHit = el('g', null, svg);

    // the 0–3 hpf band holds no data at all; say so rather than leave a margin
    el('rect', { x: L.xTime(0), y: 0, width: L.xTime(3) - L.xTime(0), height: L.height,
                 'class': 'nodata' }, gGrid);
    el('line', { x1: L.xTime(3), y1: 0, x2: L.xTime(3), y2: L.height, 'class': 'bandline' }, gGrid);
    TICKS.forEach(function (t) {
      el('line', { x1: L.xTime(t), y1: 0, x2: L.xTime(t), y2: L.height, 'class': 'gridline' }, gGrid);
    });
    data.meta.periods.forEach(function (p) {
      if (p.begin <= L.lo || p.begin >= L.hi) return;
      el('line', { x1: L.xTime(p.begin), y1: 0, x2: L.xTime(p.begin), y2: L.height, 'class': 'bandline' }, gGrid);
    });

    nodes.forEach(function (n) {
      var p = n._parent;
      if (p) el('path', { d: elbow(p._x, p._y, n._x, n._y), 'class': 'edge', 'data-id': n._id }, gEdge);

      var leaf = !n.children.length;
      if (leaf && n._x2 > n._x + 1) {
        el('rect', { x: n._x, y: n._y - 1.5, width: n._x2 - n._x, height: 3, rx: 1.5,
                     'class': 'durbar', 'data-id': n._id }, gBar);
        // Almost every tip is CUT by the window rather than ended by
        // development (130 of 144), so "continues" is the near-constant case
        // and marking it would be ink without information. The rare,
        // informative case is the opposite one — a population genuinely gone
        // from the atlas before the window closes — so that is what gets a
        // mark. The headline ratio is stated once, in the legend.
        if (!n.continues) {
          el('line', { x1: n._x2 + 2.5, y1: n._y - 4, x2: n._x2 + 2.5, y2: n._y + 4,
                       'class': 'stop', 'data-id': n._id }, gBar);
        }
      }

      var kind = kindOf(n);
      el('path', { d: markPath(kind[1], n._x, n._y, n._r),
                   'class': 'mark ' + kind[2], 'data-id': n._id }, gMark);

      var t;
      if (leaf) {
        // every tip label aligned in one column, with a leader — no collisions
        var bx = n._x2 + (n.continues ? 0 : 6) + n._r + 3;
        el('line', { x1: bx, y1: n._y, x2: L.tipX - 3, y2: n._y, 'class': 'leader', 'data-id': n._id }, gBar);
        var tipText = n.name;
        t = el('text', { x: L.tipX, y: n._y, 'class': 'lbl' + (n._depth === 1 ? ' prog' : ''),
                         'data-id': n._id }, gLbl);
        txt(t, tipText);
        txt(el('text', { x: L.tipX + measure(tipText, n._depth === 1 ? 11.5 : 10) + 8, y: n._y,
                         'class': 'lbl sub', 'data-id': n._id }, gLbl), fmt(n.cells));
      } else {
        // Depth 0–1 (the root and the twenty programmes) are the spine of the
        // picture and get the fixed left gutter, where nothing can collide
        // with them. Deeper internal labels take the space left of their own
        // mark — space guaranteed free of marks and bars, because onset is
        // monotone down the tree, so no descendant can sit left of its parent.
        var deep = n._depth > 1;
        var lw = measure(n.name, deep ? 10 : 11.5);
        var fitsLeft = !deep || n._x - n._r - 5 - lw > PLOT_L - LGUT;
        t = el('text', {
          x: deep ? (fitsLeft ? n._x - n._r - 5 : n._x + n._r + 5) : LGUT,
          y: n._y,
          'text-anchor': (deep && !fitsLeft) ? 'start' : 'end',
          'class': 'lbl ' + (n._depth <= 1 ? 'prog' : 'tis'), 'data-id': n._id
        }, gLbl);
        txt(t, n.name);
      }

      var hy = Math.max(7, ROW - 2);
      var hx = leaf ? Math.max(0, n._x - 9)
                    : (n._depth <= 1 ? 0 : Math.max(0, n._x - measure(n.name) - 14));
      el('rect', { x: hx, y: n._y - hy / 2,
                   width: (leaf ? (L.tipX + GUTTER - 16) - hx : Math.max(30, n._x + 26 - hx)),
                   height: hy, 'class': 'hit', 'data-id': n._id }, gHit);
    });

    renderAxis(L);
    applyHot();
  }

  var _canvas;
  function measure(s, px) {
    if (!_canvas) _canvas = document.createElement('canvas').getContext('2d');
    _canvas.font = (px || 10) + 'px ui-monospace, monospace';
    return _canvas.measureText(s).width;
  }

  function renderAxis(L) {
    axis.setAttribute('width', L.width);
    axis.setAttribute('viewBox', '0 0 ' + L.width + ' 46');
    while (axis.firstChild) axis.removeChild(axis.firstChild);

    el('rect', { x: L.xTime(0), y: 4, width: L.xTime(3) - L.xTime(0), height: 13,
                 'class': 'nodata' }, axis);
    data.meta.periods.forEach(function (p) {
      var a = Math.max(L.lo, p.begin), b = Math.min(L.hi, p.end);
      if (b <= a) return;
      var x1 = L.xTime(a), x2 = L.xTime(b);
      el('rect', { x: x1, y: 4, width: x2 - x1, height: 13, 'class': 'band' }, axis);
      el('line', { x1: x1, y1: 4, x2: x1, y2: 17, 'class': 'bandline' }, axis);
      // Only name a band that can hold its own name plus a gap — otherwise
      // Blastula runs straight into the no-data label beside it.
      if (x2 - x1 > measure(p.name.toUpperCase(), 9) * 1.1 + 12) {
        txt(el('text', { x: (x1 + x2) / 2, y: 14, 'class': 'axlbl', 'text-anchor': 'middle' }, axis), p.name);
      }
    });
    TICKS.forEach(function (h) {
      var x = L.xTime(h);
      el('line', { x1: x, y1: 22, x2: x, y2: 27, stroke: 'currentColor', opacity: .35 }, axis);
      txt(el('text', { x: x, y: 37, 'class': 'axnum', 'text-anchor': 'middle' }, axis), h);
    });
    txt(el('text', { x: L.tipX, y: 37, 'class': 'axlbl' }, axis), 'hpf  ·  first appearance → last');
  }

  // ---------------------------------------------------------------- hover
  function ancestry(n) {
    var out = {}, cur = n;
    while (cur) { out[cur._id] = true; cur = cur._parent; }
    return out;
  }
  function applyHot() {
    var chain = hot ? ancestry(hot) : {};
    ['edge', 'durbar', 'leader', 'mark', 'lbl', 'stop'].forEach(function (cls) {
      var list = svg.querySelectorAll('.' + cls);
      for (var i = 0; i < list.length; i++) {
        list[i].classList.toggle('hot', !!(hot && chain[list[i].getAttribute('data-id')]));
      }
    });
  }

  var LEVEL_WORD = {
    root: 'all cells in window',
    program: 'tissue program · DanioCell tissue.subsets',
    tissue: 'tissue · DanioCell tissue',
    identity: 'cell identity · DanioCell identity.super'
  };

  function card(n) {
    var parts = [], cur = n;
    while (cur) { parts.unshift(esc(cur.name)); cur = cur._parent; }
    var kind = kindOf(n);
    var h = '<div class="t-name">' + esc(n.name) + '</div>' +
            '<div class="t-path">' + parts.join(' › ') + '</div>' +
            '<div class="t-row"><span class="t-k">' + LEVEL_WORD[n.level] + '</span></div>' +
            '<div class="t-row"><b>' + fmt(n.cells) + '</b> cells <span class="t-k">(' +
            (100 * n.cells / root.cells).toFixed(1) + '% of window)</span></div>' +
            '<div class="t-row">first <b>' + n.first + '</b> · peak <b>' + n.peak +
            '</b> · last <b>' + n.last + '</b> hpf</div>';
    if (n.continues) {
      h += '<div class="t-row t-k">cut by the ' + data.meta.window_hpf[1] + ' hpf window — ' +
           fmt(n.after) + ' more cells beyond it</div>';
    } else if (!n.children.length) {
      h += '<div class="t-row t-k">gone from the atlas before ' + data.meta.window_hpf[1] + ' hpf</div>';
    }

    h += '<div class="t-sect">';
    if (n.zfa_id) {
      h += '<div class="t-row"><b>' + esc(n.zfa_name || n.zfa_id) + '</b> ' +
           '<span class="t-k">' + n.zfa_id + '</span></div>' +
           '<div class="t-row t-k">' + (kind[0] || 'unbucketed') + '</div>';
      if (n.zfa_develops_from && n.zfa_develops_from.length) {
        h += '<div class="t-row t-k" style="margin-top:3px">ZFA develops_from — ontology lineage, ' +
             'not measured here and not used to build this tree:</div>' +
             '<div class="t-lin">' + n.zfa_develops_from.map(function (p) {
               return esc(p.name || p.id) + ' <span class="t-k">' + p.id + '</span>';
             }).join('<br>') + '</div>';
      }
    } else {
      h += '<div class="t-row t-k">No single ZFA term covers ' +
           (100 * data.meta.zfa_dominance) + '% of this node’s annotated cells, ' +
           'so none is claimed. Hover a child for its term.</div>';
    }
    h += '</div>';

    if (n.clusters && n.clusters.length) {
      h += '<div class="t-sect t-cl">' + n.clusters.length + ' DanioCell cluster' +
           (n.clusters.length > 1 ? 's' : '') + ': ' +
           n.clusters.slice(0, 6).map(function (c) {
             return esc(c.clust) + (c.sub ? ' (' + esc(c.sub) + ')' : '');
           }).join(', ') + (n.clusters.length > 6 ? ', …' : '') + '</div>';
    }
    return h;
  }

  function moveTip(ev) {
    var pad = 14, w = tip.offsetWidth, ht = tip.offsetHeight;
    var x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 6) x = ev.clientX - pad - w;
    if (y + ht > window.innerHeight - 6) y = Math.max(6, ev.clientY - pad - ht);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  // ---------------------------------------------------------------- events
  var byId = {};
  function nodeAt(ev) {
    var t = ev.target;
    var id = t && t.getAttribute ? t.getAttribute('data-id') : null;
    return id ? byId[id] : null;
  }

  svg.addEventListener('mousemove', function (ev) {
    if (drag.on) return;
    var n = nodeAt(ev);
    if (n !== hot) {
      hot = n;
      applyHot();
      if (n) { tip.innerHTML = card(n); tip.style.display = 'block'; }
      else tip.style.display = 'none';
    }
    if (hot) moveTip(ev);
  });
  function clearHot() {
    if (!hot) return;
    hot = null; applyHot(); tip.style.display = 'none';
  }
  svg.addEventListener('mouseleave', clearHot);

  // drag to pan — plain scroll offsets, so wheel, trackpad and the scrollbars
  // keep working exactly as they did
  var drag = { on: false, x: 0, y: 0, sl: 0, st: 0, moved: 0 };
  scroll.addEventListener('mousedown', function (ev) {
    if (ev.button !== 0) return;
    drag.on = true; drag.moved = 0;
    drag.x = ev.clientX; drag.y = ev.clientY;
    drag.sl = scroll.scrollLeft; drag.st = scroll.scrollTop;
    scroll.classList.add('dragging');
    clearHot();
    ev.preventDefault();
  });
  window.addEventListener('mousemove', function (ev) {
    if (!drag.on) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    scroll.scrollLeft = drag.sl - dx;
    scroll.scrollTop = drag.st - dy;
  });
  window.addEventListener('mouseup', function () {
    if (!drag.on) return;
    drag.on = false;
    scroll.classList.remove('dragging');
  });
  scroll.addEventListener('scroll', function () { axisWrap.scrollLeft = scroll.scrollLeft; });

  document.getElementById('btn-theme').onclick = function (e) {
    document.body.classList.toggle('light');
    e.currentTarget.textContent = document.body.classList.contains('light') ? 'dark' : 'light';
  };

  // ---------------------------------------------------------------- legend
  function legend() {
    var box = document.getElementById('legend');
    var present = {}, endCount = 0;
    (function rec(n) {
      present[kindOf(n)[0]] = true;
      if (!n.children.length && !n.continues) endCount++;
      n.children.forEach(rec);
    })(root);

    var h = '<span style="color:var(--fg2)">ZFA structural kind</span>';
    KINDS.forEach(function (k) {
      if (!(k[0] in present)) return;   // never legend a class the data lacks
      h += '<span class="li" title="' + esc(k[3]) + '"><svg width="17" height="17">' +
           '<path d="' + markPath(k[1], 8.5, 8.5, 4.6) + '" class="mark ' + k[2] + '"/>' +
           '</svg>' + (k[0] || 'no term') + '</span>';
    });
    h += '<span class="li" style="margin-left:6px"><svg width="30" height="10">' +
         '<rect x="0" y="3.5" width="28" height="3" rx="1.5" fill="var(--bar)" opacity=".5"/></svg>' +
         'span of stages a tip is seen in</span>';
    h += '<span class="li"><svg width="30" height="10">' +
         '<rect x="0" y="3.5" width="20" height="3" rx="1.5" fill="var(--bar)" opacity=".5"/>' +
         '<line x1="23" y1="1" x2="23" y2="9" class="stop"/></svg>' +
         'gone from the atlas before ' + data.meta.window_hpf[1] + ' hpf (' + endCount + ' of ' +
         data.meta.leaves + ' tips; the other ' + (data.meta.leaves - endCount) +
         ' are cut by the window, not ended)</span>';
    h += '<span class="li"><svg width="20" height="12">' +
         '<circle cx="4" cy="6" r="2.4" fill="var(--fg2)"/>' +
         '<circle cx="14" cy="6" r="5.4" fill="var(--fg2)"/></svg>mark area ∝ cells</span>';
    h += '<span class="li"><svg width="22" height="12">' +
         '<rect x="0" y="0" width="20" height="12" fill="var(--grid)" opacity=".06"/>' +
         '<line x1="20" y1="0" x2="20" y2="12" class="bandline"/></svg>' +
         '0–' + data.meta.observed_hpf[0] + ' hpf: DanioCell has no cells at all</span>';
    box.innerHTML = h;
  }

  // ---------------------------------------------------------------- boot
  fetch('/dev_tree/tree.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d; root = d.tree;
    var i = 0;
    (function rec(n) { n._id = 'n' + (i++); byId[n._id] = n; n.children.forEach(rec); })(root);

    document.getElementById('hdr-sub').textContent =
      fmt(root.cells) + ' cells · ' + d.meta.leaves + ' tips · DanioCell ' +
      d.meta.observed_hpf[0] + '–' + d.meta.observed_hpf[1] + ' hpf';
    document.getElementById('f-cells').textContent = fmt(root.cells);
    document.getElementById('f-nodes').textContent = d.meta.nodes + ' (' + d.meta.leaves + ' tips)';
    document.getElementById('f-window').textContent =
      d.meta.observed_hpf[0] + '–' + d.meta.observed_hpf[1] + ' hpf of the 0–' +
      d.meta.window_hpf[1] + ' hpf window';

    legend();
    render();
  }).catch(function (err) {
    document.getElementById('hdr-sub').textContent = 'failed to load /dev_tree/tree.json — ' + err;
  });
})();
