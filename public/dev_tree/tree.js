/* /dev_tree — a 0–24 hpf zebrafish developmental tidy tree.
 *
 * WHAT THE PICTURE CLAIMS, AND WHAT IT DOES NOT
 *   Parent -> child edges are ANNOTATION CONTAINMENT out of the DanioCell
 *   cluster-annotation table: tissue.subsets -> tissue -> identity.super.
 *   They are NOT cell lineage. DanioCell has no lineage tracing; a cell in
 *   the `notochord` leaf is not asserted to descend from anything else drawn
 *   here. Where ZFA does record a lineage relation (`develops_from`) it is
 *   shown in the detail panel, marked as ontology lineage, and never used to
 *   position anything.
 *
 * COLOUR
 *   One hue. See the token block in index.html — this is an emphasis chart:
 *   neutral ink everywhere, --accent reserved for the branch under the
 *   pointer. ZFA structural kind is drawn as MARK SHAPE, not hue, so it keeps
 *   working under CVD and in greyscale. Do not add a hue per tissue.
 *
 * No build step, no dependencies. Data: /dev_tree/tree.json (built by
 * scripts/build_dev_tree.py).
 */
(function () {
  'use strict';

  var ROW = 15;           // vertical pitch per leaf
  var GAP = 12;           // extra gap between top-level programs
  var PAD_T = 14, PAD_B = 26;
  var LGUT = 112;         // left gutter — the twenty programme names live here
  var PLOT_L = LGUT + 10; // left edge of the time axis
  var GUTTER = 268;       // right column the tip labels are aligned in
  var MARK_MIN = 2.6, MARK_MAX = 8;

  // ZFA structural kind -> mark shape. Shape, not colour: this is the
  // secondary encoding that lets the kind survive colour-blindness and print.
  var SHAPES = [
    ['cell', 'circle', 'ZFA is_a* cell'],
    ['tissue', 'square', 'ZFA is_a* portion of tissue'],
    ['multi-tissue structure', 'diamond', 'ZFA is_a* multi-tissue structure'],
    ['organ', 'pentagon', 'ZFA is_a* organ'],
    ['anatomical system', 'triangle', 'ZFA is_a* anatomical system'],
    [null, 'hollow', 'no ZFA term on this node']
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

  var data = null, root = null, nodes = [], mode = 'time', hot = null, pinned = null;
  var svg = document.getElementById('tree');
  var axis = document.getElementById('axis');
  var scroll = document.getElementById('scroll');

  // ---------------------------------------------------------------- shapes
  function markPath(shape, x, y, r) {
    switch (shape) {
      case 'square':
        return 'M' + (x - r) + ',' + (y - r) + 'h' + 2 * r + 'v' + 2 * r + 'h' + -2 * r + 'Z';
      case 'diamond':
        return 'M' + x + ',' + (y - r * 1.25) + 'L' + (x + r * 1.25) + ',' + y +
               'L' + x + ',' + (y + r * 1.25) + 'L' + (x - r * 1.25) + ',' + y + 'Z';
      case 'triangle':
        return 'M' + x + ',' + (y - r * 1.3) + 'L' + (x + r * 1.2) + ',' + (y + r * 0.85) +
               'L' + (x - r * 1.2) + ',' + (y + r * 0.85) + 'Z';
      case 'pentagon': {
        var pts = [];
        for (var i = 0; i < 5; i++) {
          var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
          pts.push((x + Math.cos(a) * r * 1.2).toFixed(2) + ',' + (y + Math.sin(a) * r * 1.2).toFixed(2));
        }
        return 'M' + pts.join('L') + 'Z';
      }
      default: {
        var rr = shape === 'hollow' ? r * 0.72 : r;
        return 'M' + (x - rr) + ',' + y + 'a' + rr + ',' + rr + ' 0 1,0 ' + 2 * rr + ',0' +
               'a' + rr + ',' + rr + ' 0 1,0 ' + -2 * rr + ',0Z';
      }
    }
  }
  function shapeFor(kind) {
    for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i][0] === kind) return SHAPES[i][1];
    return 'hollow';
  }

  // ---------------------------------------------------------------- layout
  function walk(node, fn, depth, parent) {
    depth = depth || 0;
    fn(node, depth, parent);
    var kids = node.collapsed ? [] : node.children;
    for (var i = 0; i < kids.length; i++) walk(kids[i], fn, depth + 1, node);
  }

  function layout() {
    nodes = [];
    var slot = 0, maxDepth = 0;

    function place(node, depth, parent) {
      node._depth = depth;
      node._parent = parent;
      maxDepth = Math.max(maxDepth, depth);
      var kids = node.collapsed ? [] : node.children;
      if (!kids.length) {
        node._y = PAD_T + slot * ROW;
        slot += 1;
      } else {
        for (var i = 0; i < kids.length; i++) {
          // a visible breath between top-level programs, nothing else
          if (depth === 0 && i > 0) slot += GAP / ROW;
          place(kids[i], depth + 1, node);
        }
        node._y = (kids[0]._y + kids[kids.length - 1]._y) / 2;
      }
      nodes.push(node);
    }
    place(root, 0, null);

    var height = PAD_T + slot * ROW + PAD_B;
    var avail = Math.max(560, scroll.clientWidth - GUTTER - PLOT_L - 14);
    var w = PLOT_L + avail + GUTTER;

    var lo = data.meta.observed_hpf[0], hi = data.meta.observed_hpf[1];
    function xTime(hpf) { return PLOT_L + (hpf - lo) / (hi - lo) * avail; }
    function xDepth(d) { return PLOT_L + (maxDepth ? d / maxDepth : 0) * avail; }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n._x = mode === 'time' ? xTime(n.onset) : xDepth(n._depth);
      n._x2 = mode === 'time' ? Math.max(n._x + 1, xTime(n.offset)) : n._x;
      n._r = Math.min(MARK_MAX, MARK_MIN + Math.sqrt(n.cells) / 26);
    }
    return { width: w, height: height, avail: avail, xTime: xTime, lo: lo, hi: hi, tipX: PLOT_L + avail + 14 };
  }

  // ---------------------------------------------------------------- render
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

    // vertical time rules, so a node's hpf is readable without the header
    if (mode === 'time') {
      TICKS.forEach(function (t) {
        if (t < L.lo || t > L.hi) return;
        el('line', { x1: L.xTime(t), y1: 0, x2: L.xTime(t), y2: L.height, 'class': 'gridline' }, gGrid);
      });
      data.meta.periods.forEach(function (p) {
        if (p.begin <= L.lo || p.begin >= L.hi) return;
        el('line', { x1: L.xTime(p.begin), y1: 0, x2: L.xTime(p.begin), y2: L.height, 'class': 'bandline' }, gGrid);
      });
    }

    nodes.forEach(function (n) {
      var p = n._parent;
      if (p) {
        // classic cladogram elbow: riser at the parent's x, then across.
        // In time mode a zero-length horizontal is meaningful — it says the
        // child is first seen at the same sampled stage as its parent.
        el('path', { d: 'M' + p._x + ',' + p._y + 'V' + n._y + 'H' + n._x, 'class': 'edge', 'data-id': n._id }, gEdge);
      }
      var leaf = n.collapsed || !n.children.length;
      if (mode === 'time' && leaf && n._x2 > n._x + 1) {
        el('rect', {
          x: n._x, y: n._y - 1.5, width: n._x2 - n._x, height: 3, rx: 1.5,
          'class': 'durbar', 'data-id': n._id
        }, gBar);
        // Almost every tip is CUT by the 24 hpf window rather than ended by
        // development (86 of 96), so "continues" is the near-constant case and
        // marking it would be ink without information. The rare, informative
        // case is the opposite one — a population that is genuinely gone from
        // the atlas before 24 hpf — so that is what gets a mark: a stop cap.
        // The headline ratio is stated once, in the legend.
        if (!n.continues) {
          el('line', {
            x1: n._x2 + 2.5, y1: n._y - 4, x2: n._x2 + 2.5, y2: n._y + 4,
            'class': 'cont', 'data-id': n._id
          }, gBar);
        }
      }
      var shape = shapeFor(n.zfa_kind || null);
      var cls = 'mark' + (n.zfa_id ? ' filled' : '');
      el('path', { d: markPath(shape, n._x, n._y, n._r), 'class': cls, 'data-id': n._id }, gMark);

      // a collapsed parent wears a ring, so a hidden subtree is never silent
      if (n.collapsed && n.children.length) {
        el('path', { d: markPath('circle', n._x, n._y, n._r + 3), 'class': 'ring',
                     'data-id': n._id }, gMark);
      }

      var t;
      if (leaf) {
        // every tip label aligned in one column, with a leader — no collisions
        var bx = (mode === 'time' ? n._x2 + (n.continues ? 0 : 6) : n._x) + n._r + 3;
        el('line', { x1: bx, y1: n._y, x2: L.tipX - 3, y2: n._y, 'class': 'leader', 'data-id': n._id }, gBar);
        var tipText = n.name + (n.collapsed && n.children.length ? '  (+' + n.children.length + ')' : '');
        t = el('text', { x: L.tipX, y: n._y, 'class': 'lbl' + (n._depth === 1 ? ' prog' : ''), 'data-id': n._id }, gLbl);
        txt(t, tipText);
        var sub = el('text', {
          x: L.tipX + measure(tipText, n._depth === 1 ? 11 : 10) + 8,
          y: n._y, 'class': 'lbl sub', 'data-id': n._id
        }, gLbl);
        txt(sub, fmt(n.cells));
      } else {
        // Internal labels go on the node's OWN row, right-aligned into the
        // space to its left. That space is guaranteed free of marks and bars:
        // onset is monotone down the tree (a parent's onset is the min over
        // its subtree), so no descendant can ever sit to the left of it. Only
        // ancestor edges cross there, and the halo handles those. Where a node
        // is too close to the left edge to fit, the label flips right.
        // Depth 0-1 (the root and the twenty programmes) are the spine of the
        // picture and get the fixed left gutter, where nothing can collide with
        // them. Deeper internal labels take the space left of their own mark.
        var deep = n._depth > 1;
        var lw = measure(n.name, deep ? 10 : 11);
        var fitsLeft = !deep || n._x - n._r - 5 - lw > PLOT_L - LGUT;
        t = el('text', {
          x: deep ? (fitsLeft ? n._x - n._r - 5 : n._x + n._r + 5) : LGUT,
          y: n._y,
          'text-anchor': (deep && !fitsLeft) ? 'start' : 'end',
          'class': 'lbl ' + (n._depth <= 1 ? 'prog' : 'tis'), 'data-id': n._id
        }, gLbl);
        txt(t, n.name);
      }

      var hy = Math.max(6, ROW - 2);
      var hx = leaf ? Math.max(0, n._x - 9) : (n._depth <= 1 ? 0 : Math.max(0, n._x - measure(n.name) - 14));
      el('rect', {
        x: hx, y: n._y - hy / 2,
        width: (leaf ? (L.tipX + 240) - hx : Math.max(28, n._x + 24 - hx)),
        height: hy, 'class': 'hit', 'data-id': n._id
      }, gHit);
    });

    renderAxis(L);
    applyHot();
  }

  var _canvas;
  function measure(s, px) {
    if (!_canvas) { _canvas = document.createElement('canvas').getContext('2d'); }
    _canvas.font = (px || 10) + 'px ui-monospace, monospace';
    return _canvas.measureText(s).width;
  }

  var TICKS = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 21, 24];

  function renderAxis(L) {
    axis.setAttribute('width', L.width);
    axis.setAttribute('viewBox', '0 0 ' + L.width + ' 46');
    while (axis.firstChild) axis.removeChild(axis.firstChild);
    if (mode !== 'time') {
      var m = el('text', { x: PLOT_L, y: 28, 'class': 'axlbl' }, axis);
      txt(m, 'x = hierarchy depth  ·  root → program → tissue → identity');
      return;
    }
    data.meta.periods.forEach(function (p) {
      var a = Math.max(L.lo, p.begin), b = Math.min(L.hi, p.end);
      if (b <= a) return;
      var x1 = L.xTime(a), x2 = L.xTime(b);
      el('rect', { x: x1, y: 4, width: x2 - x1, height: 13, 'class': 'band' }, axis);
      el('line', { x1: x1, y1: 4, x2: x1, y2: 17, 'class': 'bandline' }, axis);
      if (x2 - x1 > 58) {
        var t = el('text', { x: (x1 + x2) / 2, y: 14, 'class': 'axlbl', 'text-anchor': 'middle' }, axis);
        txt(t, p.name);
      }
    });
    TICKS.forEach(function (h) {
      if (h < L.lo || h > L.hi) return;
      var x = L.xTime(h);
      el('line', { x1: x, y1: 22, x2: x, y2: 27, stroke: 'currentColor', opacity: .35 }, axis);
      var t = el('text', { x: x, y: 37, 'class': 'axnum', 'text-anchor': 'middle' }, axis);
      txt(t, h);
    });
    var lab = el('text', { x: L.tipX, y: 37, 'class': 'axlbl' }, axis);
    txt(lab, 'hpf  ·  first appearance → last');
  }

  // ---------------------------------------------------------------- hover
  function ancestry(n) {
    var out = {}, cur = n;
    while (cur) { out[cur._id] = true; cur = cur._parent; }
    return out;
  }
  function applyHot() {
    var target = hot || pinned;
    var chain = target ? ancestry(target) : {};
    ['edge', 'durbar', 'leader', 'mark', 'ring', 'lbl', 'cont'].forEach(function (cls) {
      var list = svg.querySelectorAll('.' + cls);
      for (var i = 0; i < list.length; i++) {
        var id = list[i].getAttribute('data-id');
        list[i].classList.toggle('hot', !!(target && chain[id]));
      }
    });
  }

  function pathOf(n) {
    var parts = [], cur = n;
    while (cur) { parts.unshift(cur.name); cur = cur._parent; }
    return parts.join('  ›  ');
  }

  var LEVEL_WORD = {
    root: 'all cells in window',
    program: 'tissue program (DanioCell tissue.subsets)',
    tissue: 'tissue (DanioCell tissue)',
    identity: 'cell identity (DanioCell identity.super)'
  };

  function sparkline(stages) {
    var w = 300, h = 42, lo = 3, hi = 24;
    var max = 0;
    stages.forEach(function (s) { max = Math.max(max, s[1]); });
    var s = '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
    stages.forEach(function (st) {
      var x = 4 + (st[0] - lo) / (hi - lo) * (w - 30);
      var bh = Math.max(1, (st[1] / max) * (h - 14));
      s += '<rect x="' + (x - 2.5) + '" y="' + (h - 10 - bh) + '" width="5" height="' + bh + '" rx="2"/>';
    });
    s += '<text class="sax" x="4" y="' + (h - 1) + '">3</text>';
    s += '<text class="sax" x="' + (w - 32) + '" y="' + (h - 1) + '">24 hpf</text>';
    return s + '</svg>';
  }

  function detail(n) {
    document.getElementById('d-name').textContent = n.name;
    document.getElementById('d-path').textContent = pathOf(n);
    var h = '';
    h += '<dl class="kv">';
    h += '<dt>level</dt><dd>' + (LEVEL_WORD[n.level] || n.level) + '</dd>';
    h += '<dt>cells</dt><dd>' + fmt(n.cells) + '  <span class="zfa-id">(' +
         (100 * n.cells / data.tree.cells).toFixed(1) + '% of window)</span></dd>';
    h += '<dt>first seen</dt><dd>' + n.first + ' hpf</dd>';
    h += '<dt>peak stage</dt><dd>' + n.peak + ' hpf</dd>';
    h += '<dt>last seen</dt><dd>' + n.last + ' hpf' +
         (n.continues ? ' <span class="zfa-id">(window edge — ' + fmt(n.after) +
                        ' more cells past 24 hpf)</span>' : '') + '</dd>';
    h += '<dt>bar span</dt><dd>' + n.onset + '–' + n.offset + ' hpf <span class="zfa-id">(2–98% of cells)</span></dd>';
    if (n.children.length) h += '<dt>children</dt><dd>' + n.children.length + '</dd>';
    h += '</dl>';

    h += '<div class="sect"><h2>cells per stage</h2><div style="padding:0 8px">' +
         sparkline(n.stages) + '</div></div>';

    if (n.zfa_id) {
      h += '<div class="sect"><h2>ZFA annotation</h2>';
      h += '<dl class="kv"><dt>term</dt><dd>' + (n.zfa_name || '—') +
           '<br><span class="zfa-id">' + n.zfa_id + '</span></dd>';
      if (n.zfa_kind) h += '<dt>structure</dt><dd><span class="pill">' + n.zfa_kind + '</span></dd>';
      if (n.zfa_is_a && n.zfa_is_a.length) {
        h += '<dt>is_a</dt><dd>' + n.zfa_is_a.map(function (p) {
          return (p.name || p.id) + ' <span class="zfa-id">' + p.id + '</span>';
        }).join('<br>') + '</dd>';
      }
      h += '</dl>';
      if (n.zfa_develops_from && n.zfa_develops_from.length) {
        h += '<div class="note" style="padding-bottom:2px">ZFA <b>develops_from</b> — ontology lineage, ' +
             'not measured here and not used to build this tree:</div>';
        h += '<div class="lineage">' + n.zfa_develops_from.map(function (p) {
          return (p.name || p.id) + ' <span class="zfa-id">' + p.id + '</span>';
        }).join('<br>') + '</div>';
      }
      if (n.zfa_all && n.zfa_all.length > 1) {
        h += '<div class="note">Other ZFA terms carried by clusters under this node: ' +
             n.zfa_all.slice(1).map(function (p) { return (p.name || p.id); }).join(', ') + '.</div>';
      }
    } else {
      h += '<div class="sect"><h2>ZFA annotation</h2><div class="note">No single ZFA term covers ' +
           (100 * data.meta.zfa_dominance) + '% of this node’s annotated cells, so none is claimed here. ' +
           'Open a child for its term.</div></div>';
    }

    if (n.clusters && n.clusters.length) {
      h += '<div class="sect"><h2>DanioCell clusters (' + n.clusters.length + ')</h2>';
      h += '<table class="cl"><tr><th>cluster</th><th>identity.sub</th><th class="n">cells</th></tr>';
      n.clusters.forEach(function (c) {
        h += '<tr><td>' + c.clust + '</td><td class="zfa-id">' + (c.sub || '—') +
             '</td><td class="n">' + fmt(c.cells) + (c.after ? ' ›' : '') + '</td></tr>';
      });
      h += '</table><div class="note">Counts are inside the 0–24 hpf window only. ' +
           'A <b>›</b> marks a cluster that keeps going past 24 hpf — most do, and ' +
           'the window, not development, is what ends its bar.</div></div>';
    }
    if (n.children.length) {
      h += '<div class="note" style="border-top:1px solid var(--rule);padding-top:8px">' +
           'Click the mark to ' + (n.collapsed ? 'expand' : 'collapse') + ' this branch.</div>';
    }
    document.getElementById('d-body').innerHTML = h;
  }

  // ---------------------------------------------------------------- legend
  function legend() {
    var box = document.getElementById('legend');
    var endCount = 0;
    (function rec(n) {
      if (!n.children.length && !n.continues) endCount++;
      n.children.forEach(rec);
    })(root);
    var h = '<span style="color:var(--fg2)">mark shape = ZFA structural kind</span>';
    SHAPES.forEach(function (s) {
      var d = markPath(s[1], 9, 9, 4.5);
      h += '<span class="li" title="' + s[2] + '"><svg width="18" height="18">' +
           '<path d="' + d + '" fill="' + (s[0] ? 'var(--fg2)' : 'none') +
           '" stroke="var(--fg2)" stroke-width="1.3"/></svg>' + (s[0] || 'no term') + '</span>';
    });
    h += '<span class="li" style="margin-left:8px"><svg width="30" height="10">' +
         '<rect x="0" y="3" width="28" height="4" rx="2" fill="var(--bar)" opacity=".55"/></svg>' +
         'span of stages a tip is seen in</span>';
    h += '<span class="li"><svg width="30" height="10">' +
         '<rect x="0" y="3" width="20" height="3" rx="1.5" fill="var(--bar)" opacity=".55"/>' +
         '<line x1="23" y1="1" x2="23" y2="9" stroke="var(--fg3)" stroke-width="1.3"/></svg>' +
         'gone from the atlas before 24 hpf (' + endCount + ' of ' + data.meta.leaves + ' tips; ' +
         'the other ' + (data.meta.leaves - endCount) + ' are cut by the window, not ended)</span>';
    h += '<span class="li"><svg width="18" height="10">' +
         '<circle cx="5" cy="5" r="2.6" fill="var(--fg2)"/><circle cx="14" cy="5" r="6" fill="var(--fg2)"/>' +
         '</svg>mark area ∝ cells</span>';
    box.innerHTML = h;
  }

  // ---------------------------------------------------------------- events
  function idOf(ev) {
    var t = ev.target;
    return t && t.getAttribute ? t.getAttribute('data-id') : null;
  }
  var byId = {};

  svg.addEventListener('mousemove', function (ev) {
    var id = idOf(ev);
    var n = id ? byId[id] : null;
    if (n !== hot) { hot = n; applyHot(); if (n) detail(n); }
  });
  svg.addEventListener('mouseleave', function () {
    hot = null; applyHot(); if (pinned) detail(pinned);
  });
  svg.addEventListener('click', function (ev) {
    var id = idOf(ev); if (!id) return;
    var n = byId[id]; if (!n) return;
    pinned = n;
    if (n.children.length) { n.collapsed = !n.collapsed; render(); }
    detail(n);
  });

  function setMode(m) {
    mode = m;
    document.getElementById('btn-time').setAttribute('aria-pressed', String(m === 'time'));
    document.getElementById('btn-tidy').setAttribute('aria-pressed', String(m === 'depth'));
    render();
  }
  document.getElementById('btn-time').onclick = function () { setMode('time'); };
  document.getElementById('btn-tidy').onclick = function () { setMode('depth'); };
  document.getElementById('btn-expand').onclick = function () {
    walkAll(function (n) { n.collapsed = false; }); render();
  };
  document.getElementById('btn-collapse').onclick = function () {
    walkAll(function (n) { n.collapsed = (n.level === 'tissue' || n.level === 'program') && n.children.length > 0; });
    render();
  };
  document.getElementById('btn-theme').onclick = function (e) {
    document.body.classList.toggle('light');
    e.currentTarget.textContent = document.body.classList.contains('light') ? 'dark' : 'light';
  };
  function walkAll(fn) { (function rec(n) { fn(n); n.children.forEach(rec); })(root); }

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });

  // ---------------------------------------------------------------- boot
  fetch('/dev_tree/tree.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d; root = d.tree;
    var i = 0;
    (function rec(n) { n._id = 'n' + (i++); n.collapsed = false; byId[n._id] = n; n.children.forEach(rec); })(root);

    document.getElementById('hdr-sub').textContent =
      fmt(root.cells) + ' cells · ' + d.meta.leaves + ' tips · DanioCell ' +
      d.meta.observed_hpf[0] + '–' + d.meta.observed_hpf[1] + ' hpf';
    document.getElementById('f-cells').textContent = fmt(root.cells);
    document.getElementById('f-nodes').textContent = d.meta.nodes + ' (' + d.meta.leaves + ' tips)';
    document.getElementById('f-window').textContent =
      d.meta.observed_hpf[0] + '–' + d.meta.observed_hpf[1] + ' hpf of the 0–24 hpf window';

    legend();
    render();
    pinned = root; detail(root);
  }).catch(function (err) {
    document.getElementById('d-path').textContent = 'Failed to load /dev_tree/tree.json — ' + err;
  });
})();
