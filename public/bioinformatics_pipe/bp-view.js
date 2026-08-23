/* ============================================================
   bp-view.js — assembly and interaction.
   Canvases, the loop, the index, the reader, the column borders.
   Load order: pop -> draw -> tiles -> data -> view
   ============================================================ */
(function () {
"use strict";

const aside  = document.getElementById("aside");
const strip  = document.getElementById("strip");
const track  = document.getElementById("track");
const stage  = document.getElementById("stage");
const reader = document.getElementById("reader");
const readEl = document.getElementById("read");

let picked = null, motion = true, theme = "dark";
const REDUCED = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

/* 6.4-second loop, per the brief. Every tile's beats are fractions of it, so
   changing this number retimes the whole page coherently. */
const LOOP_MS = 6400;
let t0 = performance.now();

/* ============================================================
   THE TILES

   One canvas each, sized square from its wrapper and drawn at
   devicePixelRatio. The backing store is resized only when it actually
   changes — reallocating a canvas every frame is the classic way to make a
   smooth animation stutter, and it is invisible until you profile it.
   ============================================================ */
const CARDS = [];

STAGES.forEach((st, i) => {
  const step = document.createElement("div");
  step.className = "step";

  const card = document.createElement("button");
  card.className = "card";
  card.dataset.id = st.id;
  card.setAttribute("aria-label", st.key + " " + st.name);

  const wrap = document.createElement("div");
  wrap.className = "tilewrap";
  const cv = document.createElement("canvas");
  wrap.appendChild(cv);

  const meta = document.createElement("div");
  meta.className = "meta";
  const S = STATE_TEXT[st.state];
  meta.innerHTML =
    `<div class="k">${esc(st.key)}</div>` +
    `<h3>${esc(st.name)}</h3>` +
    `<span class="badge ${S.tone}">${esc(S.label)}</span>` +
    `<div class="sb">${esc(st.sub)}</div>` +
    `<div class="fig" data-fig></div>`;

  card.appendChild(wrap); card.appendChild(meta);
  step.appendChild(card);
  track.appendChild(step);

  card.onclick = () => select(st);

  CARDS.push({ st, cv, wrap, ctx: cv.getContext("2d"), card,
               fig: meta.querySelector("[data-fig]"), visible: true, w: 0, h: 0 });

  /* the conduit to the next step, carrying what this one removed */
  const lost = SIM.lost[st.id === "knee" ? "knee" : st.id === "mito" ? "mito"
             : st.id === "complexity" ? "complexity" : st.id === "doublet" ? "doublet" : null];
  if (i < STAGES.length - 1) {
    const link = document.createElement("div");
    link.className = "link";
    const nextLost = STAGES[i + 1].id;
    const drop = SIM.lost[nextLost];
    link.innerHTML = `<i></i>` + (drop !== undefined
      ? `<span class="drop">− ${fmtInt(toReal(drop))}</span><span>barcodes</span>`
      : `<span>↓</span>`) + `<i></i>`;
    track.appendChild(link);
  }
});

/* the running figures under each tile — real where real, modelled where not */
function figures() {
  const survivors = { raw: SIM.barcodes.length, knee: SIM.s1.length, mito: SIM.s2.length,
                      complexity: SIM.s3.length, doublet: SIM.s4.length, filtered: SIM.s4.length };
  CARDS.forEach(({ st, fig }) => {
    const n = survivors[st.id];
    if (st.id === "raw") {
      fig.innerHTML = `in <b>${fmtInt(REAL.barcodes)}</b> · out <b>${fmtInt(REAL.barcodes)}</b> · nothing cut`;
    } else if (st.id === "knee") {
      fig.innerHTML = `real cell call <b>${fmtInt(REAL.called)}</b> · ` +
        `<span class="modelled">this method finds 94,338</span>`;
    } else {
      fig.innerHTML = `out <b>${fmtInt(toReal(n))}</b> · ` +
        `<span class="modelled">modelled</span>`;
    }
  });
}
figures();

/* Offscreen tiles do not draw. Six simultaneous particle fields is more work
   than any of them is worth when four are scrolled away. */
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      const c = CARDS.find(k => k.wrap === e.target);
      if (c) c.visible = e.isIntersecting;
    });
  }, { root: stage, rootMargin: "180px 0px" });
  CARDS.forEach(c => io.observe(c.wrap));
}

function sizeCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = c.wrap.getBoundingClientRect();
  const S = Math.max(1, Math.round(Math.min(r.width, r.height)));
  const W = Math.round(S * dpr);
  if (c.w === W) return S;
  c.cv.width = W; c.cv.height = W;
  c.w = W;
  return S;
}

function drawTile(c, t) {
  const S = sizeCanvas(c);
  const dpr = c.w / S;
  const ctx = c.ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = PAL[theme];
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, S, S);
  const cc = tileCtx(ctx, S, theme);
  TILES[c.st.tile](cc, t);
}

/* ============================================================
   THE LOOP
   One rAF for the whole page. Tiles never start their own — a per-tile loop
   is six clocks that drift apart, and the sequence stops being a sequence.
   ============================================================ */
function frame(now) {
  const t = REDUCED || !motion
    ? 0.995                                   /* hold the final frame */
    : ((now - t0) % LOOP_MS) / LOOP_MS;
  for (const c of CARDS) if (c.visible) drawTile(c, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ============================================================
   THE READER — same contract as /data_structures: one paragraph, capped at
   a hundred words, then the figures. The long-form justification lives in
   bp-data.js's header comment, not here.
   ============================================================ */
function esc(s) { return String(s).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch])); }

function inspect(st) {
  if (!st) return overview();
  const S = STATE_TEXT[st.state], H = [];
  H.push(`<div class="eyebrow">${esc(st.group)}</div>`);
  H.push(`<div class="title">${esc(st.name)}</div>`);
  H.push(`<div class="sub">${esc(st.sub)}</div>`);
  H.push(`<div class="thr" style="border-color:var(--${S.tone});color:var(--${S.tone})">${esc(S.label)}</div>`);
  H.push(`<p>${st.brief}</p>`);
  H.push(`<h4>${st.real ? "Read from the artifacts" : "What is known"}</h4>`);
  st.kv.forEach(([k, v]) => H.push(`<dl class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></dl>`));
  readEl.innerHTML = H.join("");
  readEl.scrollTop = 0;
}

function overview() {
  readEl.innerHTML =
    `<div class="eyebrow">${esc(OVERVIEW.eyebrow)}</div>` +
    `<div class="title big">${esc(OVERVIEW.title)}</div>` +
    `<div class="sub">${esc(OVERVIEW.sub)}</div>` +
    `<div class="thr">the steel thread</div>` +
    `<p>${OVERVIEW.brief}</p>` +
    `<h4>How to read it</h4><p>${OVERVIEW.how}</p>` +
    `<h4>Real and modelled</h4><p>${OVERVIEW.state}</p>` +
    `<h4>${esc(OMITTED.name)}</h4><p>${OMITTED.brief}</p>` +
    `<p class="note">Click any tile for its own entry. Repo state verified 2026-08-23 against zsb-bronze 0414ac4 and zsb-silver b4253a2.</p>`;
  readEl.scrollTop = 0;
}

function select(st) {
  picked = st;
  inspect(st);
  CARDS.forEach(c => c.card.classList.toggle("on", c.st === st));
  [...aside.querySelectorAll(".row"), ...strip.querySelectorAll(".chip")]
    .forEach(r => r.classList.toggle("on", r.dataset.id === (st ? st.id : "")));
  if (st) {
    const c = CARDS.find(k => k.st === st);
    if (c) c.card.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" });
  }
  if (window.matchMedia("(max-width:900px)").matches) {
    reader.classList.toggle("open", !!st);
    strip.classList.toggle("mini", !!st);
  }
}

/* ============================================================
   THE INDEX
   ============================================================ */
(function index() {
  let g = null;
  STAGES.forEach(st => {
    if (st.group !== g) {
      g = st.group;
      const h = document.createElement("div");
      h.className = "grp" + (st.groupMark ? " mark" : "");
      h.textContent = g; aside.appendChild(h);
    }
    const S = STATE_TEXT[st.state];
    const b = document.createElement("button");
    b.className = "row"; b.dataset.id = st.id;
    b.innerHTML = `<span class="key">${esc(st.key)}</span>` +
                  `<span class="nm">${esc(st.name)}</span>` +
                  `<span class="st ${S.tone}"></span>`;
    b.onclick = () => select(st);
    aside.appendChild(b);

    const c = document.createElement("button");
    c.className = "chip"; c.dataset.id = st.id;
    c.innerHTML = `<span class="k">${esc(st.key)}</span><span class="n">${esc(st.name)}</span>`;
    c.onclick = () => select(st);
    strip.appendChild(c);
  });
})();

/* ============================================================
   CONTROLS
   ============================================================ */
const bMot = document.getElementById("btnMotion");
bMot.onclick = () => {
  motion = !motion;
  bMot.textContent = motion ? "Pause motion" : "Resume motion";
  bMot.setAttribute("aria-pressed", String(!motion));
};
if (REDUCED) { motion = false; bMot.textContent = "Resume motion"; bMot.setAttribute("aria-pressed", "true"); }

document.getElementById("btnRestart").onclick = () => { t0 = performance.now(); };

const bTheme = document.getElementById("btnTheme");
bTheme.onclick = () => {
  document.body.classList.toggle("light");
  theme = document.body.classList.contains("light") ? "light" : "dark";
  bTheme.textContent = theme === "light" ? "Dark" : "Light";
};

document.getElementById("sheetClose").onclick = () => select(null);

addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const i = picked ? STAGES.indexOf(picked) : -1;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); select(STAGES[Math.min(STAGES.length - 1, i + 1)]); }
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); select(STAGES[Math.max(0, i <= 0 ? 0 : i - 1)]); }
  else if (e.key === "Escape") select(null);
});

/* ============================================================
   THE COLUMN BORDERS
   Lifted whole from /data_structures, same contract: drag to resize, click to
   collapse to the edge, click again to restore at the width it had.
   ============================================================ */
const MOVED = 4;
[["gripL", aside,  "--aside-w",  238, 1],
 ["gripR", reader, "--reader-w", 360, -1]].forEach(
  ([id, panel, varName, def, dir]) => {
    const grip = document.getElementById(id);
    let w = def, wOpen = def, drag = false, moved = false, x0 = 0, w0 = 0;
    const setW = v => { w = v; document.documentElement.style.setProperty(varName, v + "px"); };
    const shut = () => {
      if (w > 8) wOpen = w;
      grip.classList.add("shut"); panel.style.display = "none"; setW(0);
    };
    const open = () => {
      grip.classList.remove("shut"); panel.style.display = "";
      setW(wOpen < 56 ? def : wOpen);
    };
    grip.addEventListener("pointerdown", e => {
      drag = true; moved = false; x0 = e.clientX; w0 = w;
      grip.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grip.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.abs(e.clientX - x0) > MOVED) moved = true;
      if (!moved || grip.classList.contains("shut")) return;
      setW(Math.max(0, Math.min(640, w0 + (e.clientX - x0) * dir)));
    });
    ["pointerup", "pointercancel"].forEach(k => grip.addEventListener(k, () => {
      if (!drag) return;
      drag = false;
      if (!moved) return grip.classList.contains("shut") ? open() : shut();
      if (w < 56) shut(); else wOpen = w;
    }));
    grip.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      grip.classList.contains("shut") ? open() : shut();
    });
    grip.querySelector("span").textContent = dir > 0 ? "›" : "‹";
  });

/* ============================================================
   GO
   ============================================================ */
overview();

})();
