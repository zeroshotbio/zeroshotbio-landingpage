/* /compass — the code panes.
 *
 * Every plate gets a "show the code" control. Opening it puts a notebook beside the plate: the raw
 * files, then each step as a verbatim excerpt of the code that ran (file, lines, commit), then Out
 * cells read from the committed results. code.json is written by scripts/build_compass_code.py,
 * which refuses to write it if any Out value disagrees with what the plate prints. Nothing here
 * computes anything; it only lays the notebook out.
 *
 * Loaded after cp-main.js. If code.json is missing the page draws exactly as before.
 */
'use strict';

const NB = { doc: null, open: new Set() };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* A small tokenizer: comments, strings, numbers, keywords. Tokens are escaped one by one. */
const KW = {
  py: new Set('def class return for in if elif else while import from as with lambda not and or is None True False try except raise yield continue break pass global del assert'.split(' ')),
  js: new Set('function const let var return for of in if else while new true false null undefined typeof'.split(' ')),
};
function highlight(src, lang) {
  const re = lang === 'py'
    ? /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfu]{0,2}"(?:\\.|[^"\\\n])*"|[rbfu]{0,2}'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const [t, com, str, num, word] = m;
    if (com) out += `<span class="c">${esc(t)}</span>`;
    else if (str) out += `<span class="s">${esc(t)}</span>`;
    else if (num) out += `<span class="n">${esc(t)}</span>`;
    else if (word && KW[lang].has(word)) out += `<span class="k">${esc(t)}</span>`;
    else out += esc(t);
    last = m.index + t.length;
  }
  return out + esc(src.slice(last));
}

function srcLabel(c) {
  const S = NB.doc.sources[c.src], commit = (c.commit || S.commit).slice(0, 7);
  const where = `${esc(c.path)} &nbsp;·&nbsp; lines ${c.start}–${c.end} &nbsp;·&nbsp; ${esc(S.label)} @ ${commit}`;
  if (S.public && S.url) {
    const href = S.url.replace('{path}', c.path).replace('{start}', c.start).replace('{end}', c.end);
    return `<a href="${esc(href)}" target="_blank" rel="noopener">${where}</a>`;
  }
  return where;
}

function renderCell(c, n) {
  if (c.t === 'md') return `<div class="nb-md">${c.text}</div>`;
  if (c.t === 'code') {
    const lines = highlight(c.code, c.lang).split('\n');
    const body = lines.map((l, i) => `<span class="ln">${c.start + i}</span>${l || ' '}`).join('\n');
    return `<div class="nb-cell"><div class="nb-gut">In [${n.i++}]</div><div class="nb-body">` +
      `<div class="nb-file">${srcLabel(c)}</div><pre class="nb-code"><code>${body}</code></pre>` +
      (c.note ? `<div class="nb-note">${c.note}</div>` : '') + `</div></div>`;
  }
  if (c.t === 'out') {
    const head = c.head.some((h) => h) ? `<tr>${c.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>` : '';
    const rows = c.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
    return `<div class="nb-cell out"><div class="nb-gut">Out [${n.i - 1}]</div><div class="nb-body">` +
      `<div class="nb-scroll"><table class="nb-out">${head}${rows}</table></div>` +
      `<div class="nb-check">${esc(c.check)}</div>` + (c.note ? `<div class="nb-note">${esc(c.note)}</div>` : '') + `</div></div>`;
  }
  if (c.t === 'prov') {
    const size = (b) => (!b ? '' : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} kB`);
    const rows = c.rows.map((r) => {
      const sha = r.sha256 ? `sha256 <span title="${esc(r.sha256)}">${esc(r.sha256.slice(0, 16))}…</span>${r.sha_kind === 'manifest' ? ' (of the file manifest)' : ''}`
        : 'sha256 not recorded by the reproduction';
      const s3 = r.s3_match ? ` · <span class="nb-ok">matches our S3 mirror's SHA256SUMS</span>` : (r.s3 ? ` · ${esc(r.s3)}` : '');
      return `<li><b>${esc(r.name)}</b><div class="nb-prov-meta">${[size(r.bytes), sha].filter(Boolean).join(' · ')}${s3}</div>` +
        `<div class="nb-note">${esc(r.origin)}</div></li>`;
    }).join('');
    return `<div class="nb-cell prov"><div class="nb-gut">data</div><div class="nb-body"><ul class="nb-prov-list">${rows}</ul></div></div>`;
  }
  if (c.t === 'chain') {
    const ch = NB.doc.chains[c.id];
    const inner = ch.cells.map((x) => renderCell(x, n)).join('');
    return `<details class="nb-chain"><summary><span class="nb-chain-t">${esc(ch.title)}</span>` +
      `<span class="nb-chain-s">${esc(ch.sub)} · ${ch.cells.filter((x) => x.t === 'code').length} excerpts</span></summary>${inner}</details>`;
  }
  return '';
}

function renderPane(pid) {
  const P = NB.doc.plates[pid], n = { i: 1 }, S = NB.doc.sources;
  const cells = P.cells.map((c) => renderCell(c, n)).join('');
  return `<div class="nb-head"><div class="nb-eyebrow">the code behind this plate</div>` +
    `<p class="nb-lede">${esc(P.lede)}</p>` +
    `<p class="nb-prov">Code is quoted verbatim from <b>${esc(S.repro.label)}</b> @ ${S.repro.commit.slice(0, 7)} (${esc(S.repro.note)}) and ` +
    `the authors' <a href="https://github.com/rohitsinghlab/compass/tree/${S.compass.commit}" target="_blank" rel="noopener">compass</a> @ ` +
    `${S.compass.commit.slice(0, 7)}. Out cells are read from the results committed with that code; the build refuses to publish ` +
    `a pane whose numbers disagree with the plate (${NB.doc.checks.n} values checked, ${esc(NB.doc.built)}).</p></div>` + cells;
}

function togglePane(fig, pid, btn) {
  let grid = fig.querySelector(':scope > .plate-grid');
  if (!grid) {                                  // first open: wrap the plate's body so the notebook can sit beside it
    grid = document.createElement('div'); grid.className = 'plate-grid';
    const body = document.createElement('div'); body.className = 'plate-body';
    [...fig.children].filter((el) => !el.classList.contains('plate-head')).forEach((el) => body.appendChild(el));
    const aside = document.createElement('aside'); aside.className = 'nb'; aside.setAttribute('aria-label', 'code behind this plate');
    aside.innerHTML = renderPane(pid);
    grid.append(body, aside); fig.appendChild(grid);
  }
  const open = !fig.classList.contains('code-open');
  fig.classList.toggle('code-open', open);
  btn.setAttribute('aria-pressed', open ? 'true' : 'false');
  btn.textContent = open ? 'hide the code' : 'show the code';
  if (open) NB.open.add(pid); else NB.open.delete(pid);
  requestAnimationFrame(() => redrawAll());      // the plate's column changed width
}

(async function nbBoot() {
  try {
    const r = await fetch('/compass/code.json', { cache: 'no-store' });
    if (!r.ok) return;
    NB.doc = await r.json();
  } catch (e) { console.warn('code panes unavailable', e); return; }
  const wait = () => new Promise((res) => { const t = setInterval(() => { if (!document.getElementById('stage').hidden) { clearInterval(t); res(); } }, 60); });
  await wait();
  Object.keys(NB.doc.plates).forEach((pid) => {
    const fig = document.getElementById(pid); if (!fig) return;
    const head = fig.querySelector('.plate-head'); if (!head) return;
    const btn = document.createElement('button'); btn.className = 'nb-toggle'; btn.type = 'button';
    btn.textContent = 'show the code'; btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => togglePane(fig, pid, btn);
    head.appendChild(btn);
  });
})();
