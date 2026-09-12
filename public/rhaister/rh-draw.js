/* Exact SVG furniture shared by the three /rhaister figures. */
'use strict';

window.RHD = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    paper: '#f4efe4',
    paperHi: '#fbf8f0',
    ink: '#25211b',
    ink2: '#5e574c',
    ink3: '#8c8271',
    rule: '#cbbfa9',
    light: '#ded5c4',
    madder: '#973820',
    ochre: '#b27b25',
    teal: '#286f69',
    blue: '#4f627b',
  };
  const serif = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
  const sans = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif';

  function el(name, attrs = {}, parent = null) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) node.setAttribute(key, String(value));
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  function svg(container, width, height, label = '') {
    container.replaceChildren();
    const out = el('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      preserveAspectRatio: 'xMidYMid meet',
      'aria-hidden': 'true',
      focusable: 'false',
    });
    if (label) el('title', {}, out).textContent = label;
    container.appendChild(out);
    return out;
  }

  function group(parent, attrs = {}) {
    return el('g', attrs, parent);
  }

  function line(parent, x1, y1, x2, y2, attrs = {}) {
    return el('line', { x1, y1, x2, y2, stroke: C.ink, 'stroke-width': 1, ...attrs }, parent);
  }

  function rect(parent, x, y, width, height, attrs = {}) {
    return el('rect', { x, y, width, height, fill: 'none', ...attrs }, parent);
  }

  function circle(parent, cx, cy, r, attrs = {}) {
    return el('circle', { cx, cy, r, ...attrs }, parent);
  }

  function path(parent, d, attrs = {}) {
    return el('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 1, ...attrs }, parent);
  }

  function text(parent, x, y, value, attrs = {}) {
    const node = el('text', {
      x,
      y,
      fill: C.ink,
      'font-family': serif,
      'font-size': 13,
      ...attrs,
    }, parent);
    node.textContent = value;
    return node;
  }

  function multiline(parent, x, y, lines, attrs = {}, leading = 16) {
    const node = text(parent, x, y, '', attrs);
    lines.forEach((value, index) => {
      const span = el('tspan', { x, dy: index ? leading : 0 }, node);
      span.textContent = value;
    });
    return node;
  }

  function scale(domainMin, domainMax, rangeMin, rangeMax) {
    const span = domainMax - domainMin || 1;
    return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
  }

  function polylinePath(points) {
    return points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(' ');
  }

  function areaPath(top, bottom) {
    if (!top.length) return '';
    const forward = polylinePath(top);
    const reverse = bottom.slice().reverse().map((point) => `L${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(' ');
    return `${forward} ${reverse} Z`;
  }

  function caps(parent, x, y, value, attrs = {}) {
    return text(parent, x, y, value.toUpperCase(), {
      'font-family': sans,
      'font-size': 9,
      'letter-spacing': 1.4,
      fill: C.ink3,
      ...attrs,
    });
  }

  function arrow(parent, x1, y1, x2, y2, color = C.ink3) {
    line(parent, x1, y1, x2, y2, { stroke: color, 'stroke-width': 1.2 });
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 7;
    const a = [
      [x2, y2],
      [x2 - size * Math.cos(angle - 0.48), y2 - size * Math.sin(angle - 0.48)],
      [x2 - size * Math.cos(angle + 0.48), y2 - size * Math.sin(angle + 0.48)],
    ];
    path(parent, `M${a[0][0]},${a[0][1]} L${a[1][0]},${a[1][1]} L${a[2][0]},${a[2][1]} Z`, {
      fill: color,
      stroke: 'none',
    });
  }

  function fmt(value, digits = 3) {
    return Number(value).toFixed(digits).replace(/^0\./, '.').replace(/^-0\./, '−.');
  }

  return {
    C,
    serif,
    sans,
    el,
    svg,
    group,
    line,
    rect,
    circle,
    path,
    text,
    multiline,
    scale,
    polylinePath,
    areaPath,
    caps,
    arrow,
    fmt,
  };
})();
