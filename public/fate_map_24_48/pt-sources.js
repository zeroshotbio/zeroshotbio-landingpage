/* pt-sources.js — Plate II, the provenance stack.
 *
 * Fourteen sources on one developmental-time axis, banded by what each
 * contributes to a fate map: inferred transitions at the top, directly observed
 * lineage at the bottom, everything else between. Reading it top to bottom is
 * reading from the most interpreted evidence to the least.
 *
 * The plate exists to make two things unmissable without a word of prose:
 *
 *   1. TWO of the fourteen bars are filled. Only Platt and ZSCAPE feed the page.
 *      Everything else is held, verified and unwired, and is drawn as an open
 *      bar so it cannot be mistaken for an integration that has happened.
 *
 *   2. The 24-48 hpf band is crowded with transcriptomes and EMPTY of tracking.
 *      Both lineage bars that carry real observed divisions stop at 24 hpf, at
 *      the left edge of the shaded window, and the third cannot be placed on the
 *      axis at all. That gap is the argument of the whole page, and here it is
 *      a shape rather than a sentence.
 *
 * SVG rather than canvas, unlike Plate I: fourteen rows is not a data mass, and
 * every row carries a citation that should be a real link and reachable by
 * keyboard. Furniture only is allowed a wobble; no bar is nudged.
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#2b2219', INK2 = '#5f5344', INK3 = '#8b7d69';
  const RULE = '#c3b6a0', RULE2 = '#d9cfbb', DEEP = '#eae2d2', SELECT = '#8f2d16';

  const svgEl = (t, attrs) => {
    const n = document.createElementNS(NS, t);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const htmlEl = (t, cls, txt) => {
    const n = document.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  const LABEL_W = 188;     /* left gutter for source names          */
  const RIGHT_W = 128;     /* right gutter for the status word      */
  const ROW_H = 27;
  const BAND_PAD = 20;     /* space above a band heading            */
  const TOP = 34;          /* room for the axis                     */

  function draw(host, doc, onPick) {
    const W = host.clientWidth || 1100;
    const plotL = LABEL_W, plotR = W - RIGHT_W;
    const A = doc.axis;
    const x = (h) => plotL + ((h - A.lo) / (A.hi - A.lo)) * (plotR - plotL);

    /* lay the rows out first so the height is known before anything is drawn */
    const rows = [];
    let y = TOP;
    doc.bands.forEach((b) => {
      const mine = doc.sources.filter((s) => s.band === b.key);
      if (!mine.length) return;
      y += BAND_PAD;
      const bandTop = y;
      y += 15;
      mine.forEach((s) => { rows.push({ s, y }); y += ROW_H; });
      b._top = bandTop; b._bot = y - ROW_H + 12; b._n = mine.length;
    });
    const H = y + 16;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`, width: '100%', height: H,
      role: 'group', 'aria-label': 'Provenance of the fate map, by source',
    });

    /* -- the window, drawn first so everything sits on top of it ---------- */
    svg.appendChild(svgEl('rect', {
      x: x(A.window[0]), y: TOP - 16, width: x(A.window[1]) - x(A.window[0]),
      height: H - TOP + 4, fill: DEEP,
    }));
    [A.window[0], A.window[1]].forEach((h) => {
      svg.appendChild(svgEl('line', {
        x1: x(h), x2: x(h), y1: TOP - 16, y2: H - 12,
        stroke: RULE, 'stroke-width': 0.8,
      }));
    });

    /* -- axis, pinned to the top of the plate ----------------------------- */
    A.ticks.forEach((t) => {
      svg.appendChild(svgEl('line', {
        x1: x(t), x2: x(t), y1: TOP - 22, y2: TOP - 17, stroke: INK3, 'stroke-width': 0.8,
      }));
      const lab = svgEl('text', {
        x: x(t), y: TOP - 26, 'text-anchor': 'middle', 'font-size': 9.5,
        'font-family': 'ui-sans-serif, system-ui, sans-serif', fill: INK3,
        'letter-spacing': '0.08em',
      });
      lab.textContent = t;
      svg.appendChild(lab);
    });
    /* The unit sits at the LEFT of the axis row. It was at the right end and
     * collided with the 120 tick, which is at plotR exactly by construction. */
    const unit = svgEl('text', {
      x: 0, y: TOP - 26, 'font-size': 9.5,
      'font-family': 'ui-sans-serif, system-ui, sans-serif', fill: INK3,
      'letter-spacing': '0.18em',
    });
    unit.textContent = 'HOURS POST-FERTILISATION';
    svg.appendChild(unit);
    const winLab = svgEl('text', {
      x: (x(A.window[0]) + x(A.window[1])) / 2, y: TOP - 4, 'text-anchor': 'middle',
      'font-size': 10, 'font-family': 'ui-sans-serif, system-ui, sans-serif',
      fill: INK2, 'letter-spacing': '0.2em',
    });
    winLab.textContent = 'THE WINDOW';
    svg.appendChild(winLab);

    /* -- band headings ---------------------------------------------------- */
    doc.bands.forEach((b) => {
      if (!b._n) return;
      svg.appendChild(svgEl('line', {
        x1: 0, x2: plotR, y1: b._top + 2.5, y2: b._top + 2.5,
        stroke: RULE2, 'stroke-width': 0.6,
      }));
      const t = svgEl('text', {
        x: 0, y: b._top - 4, 'font-size': 9.5,
        'font-family': 'ui-sans-serif, system-ui, sans-serif', fill: INK3,
        'letter-spacing': '0.22em',
      });
      t.textContent = b.label.toUpperCase();
      svg.appendChild(t);
      const n = svgEl('text', {
        x: plotR, y: b._top - 4, 'text-anchor': 'end', 'font-size': 11,
        'font-family': 'Iowan Old Style, Palatino, Georgia, serif',
        'font-style': 'italic', fill: INK3,
      });
      n.textContent = b.note;
      svg.appendChild(n);
    });

    /* -- one row per source ----------------------------------------------- */
    const hit = [];
    rows.forEach(({ s, y: ry }) => {
      const g = svgEl('g', { class: 'src-row', tabindex: '0', role: 'button',
                             'aria-label': s.name + ' — ' + s.modality });
      const mid = ry + 8;
      const wired = s.status === 'wired';

      const nm = svgEl('text', {
        x: 0, y: mid + 4, 'font-size': 14.5,
        'font-family': 'Iowan Old Style, Palatino, Georgia, serif',
        fill: wired ? INK : INK2,
      });
      nm.textContent = s.name;
      g.appendChild(nm);

      if (s.window) {
        const x0 = x(Math.max(A.lo, s.window[0]));
        const x1 = s.hi_open ? plotR : x(Math.min(A.hi, s.window[1]));
        const w = Math.max(3, x1 - x0);
        /* A bar is FILLED only when the source feeds the page. Held sources get
         * the outline: the same extent, none of the authority. */
        g.appendChild(svgEl('rect', {
          x: x0, y: mid - 5.5, width: w, height: 11,
          fill: wired ? INK : 'none',
          stroke: wired ? 'none' : RULE,
          'stroke-width': 1, 'stroke-dasharray': wired ? '' : '3 2.5',
        }));
        if (s.hi_open) {
          const ar = svgEl('path', {
            d: `M${plotR + 3} ${mid - 4} L${plotR + 9} ${mid} L${plotR + 3} ${mid + 4}`,
            fill: 'none', stroke: wired ? INK : RULE, 'stroke-width': 1,
          });
          g.appendChild(ar);
        }
        if (s.window[0] === s.window[1]) {
          /* A single timepoint. The bar has no length to carry, so it gets a
           * stem and a ring — a bare 3px dot on a 1,100px axis reads as dust. */
          g.appendChild(svgEl('line', { x1: x0, x2: x0, y1: mid - 7, y2: mid + 7,
                                        stroke: RULE, 'stroke-width': 1 }));
          g.appendChild(svgEl('circle', { cx: x0, cy: mid, r: 4.2,
                                          fill: wired ? INK : '#f3ede1',
                                          stroke: wired ? INK : INK3, 'stroke-width': 1.2 }));
        }
      } else {
        /* No window on this axis. Say so in the plot area rather than leaving
         * the row blank, which would read as missing rather than unplaceable. */
        const t = svgEl('text', {
          x: plotL + 4, y: mid + 4, 'font-size': 12,
          'font-family': 'Iowan Old Style, Palatino, Georgia, serif',
          'font-style': 'italic', fill: SELECT,
        });
        t.textContent = s.status === 'unregistered'
          ? 'frames only — no registration to hours'
          : 'stage not established for this window';
        g.appendChild(t);
      }

      const st = svgEl('text', {
        x: W - 6, y: mid + 3.5, 'text-anchor': 'end', 'font-size': 9,
        'font-family': 'ui-sans-serif, system-ui, sans-serif',
        fill: wired ? INK : INK3, 'letter-spacing': '0.16em',
      });
      st.textContent = wired ? 'WIRED IN' : 'HELD';
      g.appendChild(st);

      /* an invisible band makes the whole row clickable, not just its marks */
      const pad = svgEl('rect', { x: 0, y: ry - 3, width: W, height: ROW_H - 2,
                                  fill: 'transparent', class: 'src-hit' });
      g.appendChild(pad);
      g.addEventListener('click', () => onPick(s.key));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(s.key); }
      });
      svg.appendChild(g);
      hit.push({ key: s.key, g });
    });

    host.innerHTML = '';
    host.appendChild(svg);
    return {
      highlight(key) {
        hit.forEach((h) => h.g.classList.toggle('on', h.key === key));
      },
    };
  }

  /* The card under the plate. One source at a time, because fourteen citations
   * printed at once is a bibliography, not a figure. */
  function card(host, s, bands) {
    const b = bands.find((x) => x.key === s.band);
    host.innerHTML = '';
    const head = htmlEl('div', 'sc-head');
    head.append(htmlEl('h3', null, s.name),
                htmlEl('span', 'sc-status ' + s.status,
                       s.status === 'wired' ? 'wired in' : s.status));
    host.appendChild(head);
    host.appendChild(htmlEl('div', 'sc-band', b ? b.label : ''));

    const dl = htmlEl('dl', 'sc-dl');
    const add = (k, v) => { dl.append(htmlEl('dt', null, k), htmlEl('dd', null, v)); };
    add('Modality', s.modality);
    add('Developmental window',
        s.window
          ? (s.window[0] === s.window[1]
              ? s.window[0] + ' hpf'
              : `${s.window[0]}–${s.window[1]}${s.hi_open ? '+' : ''} hpf`)
          : 'not placeable on this axis');
    add('Scale', s.scale);
    const ev = htmlEl('dd');
    ev.append(htmlEl('span', 'prov ' + (s.evidence === 'observed' ? 'obs' : 'model'),
                     s.evidence === 'observed' ? 'observed'
                       : s.evidence === 'curated' ? 'curated' : 'inferred'),
              document.createTextNode(' ' + (
                s.evidence === 'observed'
                  ? 'counts or positions of things that exist'
                  : s.evidence === 'curated'
                    ? 'assembled by human curators from published literature'
                    : 'produced by a model over the observations')));
    dl.append(htmlEl('dt', null, 'Evidence'), ev);
    add('What this page uses', s.uses);
    host.appendChild(dl);

    const foot = htmlEl('div', 'sc-cite');
    foot.appendChild(document.createTextNode(s.cite + ' '));
    const a = document.createElement('a');
    a.href = s.href; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = s.href.replace(/^https?:\/\//, '').slice(0, 52);
    foot.appendChild(a);
    host.appendChild(foot);
    host.appendChild(htmlEl('div', 'sc-silver',
      `silver: ${s.silver} · figures checked against ${s.frm}`));
  }

  global.PTSources = { draw, card };
})(window);
