"use client";

// Cell Type Tinder 🔥 — two-rung, tier-resolved label-pair binning.
// Blinding: two neutral cards (label_A / label_B); which is prediction vs ground truth is never
// shown and the machine verdict is never loaded. All raters bin the SAME set independently.
// Per pair, the expert rates TWO rungs: TISSUE (upper semicircle) and CELL TYPE (lower
// semicircle), each a 5-point clean-match→clean-non-match scale plus an explicit "unsure".
// Swipe the card up into a tissue bin / down into a cell-type bin (nearest lights up), or tap.
// When both rungs are set, a confirmation flashes and it advances. Verdicts persist to DynamoDB
// after every change AND mirror to localStorage (offline/navigate-safe). Legacy single-scale
// verdicts are preserved (carried through, exported as legacy_bucket) and resurface for re-rating.

import { useCallback, useEffect, useRef, useState } from "react";

type Ladder = { germ_layer: string; tissue: string; cell_type: string };
type Pair = {
  pair_id: string; label_A: string; label_B: string; tier: string; tissue_area: string;
  A_ladder?: Ladder; B_ladder?: Ladder; // full germ→tissue→cell-type ladder per side (blinded)
};
type Rating = 1 | 2 | 3 | 4 | 5 | "unsure";
type Verdict = {
  tissue?: Rating | null;
  celltype?: Rating | null;
  bucket?: number | "unsure"; // legacy single-scale, preserved
  legacy_bucket?: number | "unsure";
  note?: string;
  ts: number;
};
type VerdictMap = Record<string, Verdict>;

const RATERS = ["Patrick", "Harsha", "Steven"];
const TOTAL = 334;
const BINS: { value: 1 | 2 | 3 | 4 | 5; short: string; emoji: string; color: string }[] = [
  { value: 1, short: "Same", emoji: "💚", color: "#16a34a" },
  { value: 2, short: "Basically", emoji: "🙂", color: "#65a30d" },
  { value: 3, short: "Partial", emoji: "🤔", color: "#ca8a04" },
  { value: 4, short: "Barely", emoji: "😬", color: "#ea580c" },
  { value: 5, short: "Different", emoji: "❌", color: "#dc2626" },
];
// Circular arena geometry. Bins sit on a circle around the central card (which renders
// UNDERNEATH them). Tissue = top semicircle, cell type = bottom; in each, DIFFERENT is on the
// left and SAME on the right. Bins are placed at i=0..4 (i=0 leftmost = value 5 "different").
const BINW = 58, BINH = 58;
type Geo = { cx: number; cy: number; r: number; cardw: number };
function binPos(rung: "tissue" | "celltype", i: number, g: Geo) {
  const aDeg = rung === "tissue" ? 160 - 35 * i : 200 + 35 * i; // top arc 160→20, bottom 200→340
  const a = (aDeg * Math.PI) / 180;
  return { left: g.cx + g.r * Math.cos(a) - BINW / 2, top: g.cy - g.r * Math.sin(a) - BINH / 2 };
}
const binOf = (v: Rating | null | undefined) =>
  typeof v === "number" ? BINS.find((b) => b.value === v) : undefined;
const ratingLabel = (v: Rating | null | undefined) =>
  v == null ? "—" : v === "unsure" ? "unsure" : binOf(v)?.short || String(v);
const TIER_LABEL: Record<string, string> = {
  germ_layer: "germ layer", tissue: "tissue",
  cell_type_broad: "cell type — broad", cell_type_sub: "cell type — fine",
};

// ---- pixel-art characters (medieval: wizard / swordsman / archer) ----
// Each is a distinct 10-wide grid + its own palette (letters mean different things per char).
type Char = { grid: string[]; pal: Record<string, string> };
const CHARACTERS: Record<string, Char> = {
  // WIZARD — pointy hat + star, white beard, blue robe, staff with a gold orb
  Patrick: {
    grid: [
      "....Y.....",
      "...PPP....",
      "..PPPPP...",
      ".PPPPPPP..",
      "PPPPPPPPP.",
      "...SSSS..O",
      "...SEES..T",
      "..WWWWWW.T",
      "..RRRRRRRT",
      ".RRRRRRR.T",
      ".R.RR.RR.T",
      ".RR..RR..T",
    ],
    pal: { P: "#7c3aed", S: "#fcd9b6", E: "#1f2937", W: "#e5e7eb", R: "#2563eb", Y: "#fbbf24", O: "#fbbf24", T: "#92400e" },
  },
  // SWORDSMAN — steel helmet + visor slit, plate armor, sword on the right
  Harsha: {
    grid: [
      "..MMMMMM..",
      ".MMMMMMMM.",
      ".MMMMMMMM.",
      ".M.MMMM.M.",
      ".DDDDDDDD.",
      ".MMMMMMMM.",
      "..MMMMMM.W",
      "..AAAAAAGW",
      ".AAAAAAAHW",
      ".A.AAAA..W",
      ".AA..AA..W",
      ".AA..AA...",
    ],
    pal: { M: "#94a3b8", D: "#1f2937", A: "#475569", W: "#e5e7eb", G: "#fbbf24", H: "#92400e" },
  },
  // ARCHER — green hood, bow + string on the right, brown tunic
  Steven: {
    grid: [
      "..GGGG....",
      ".GGGGGG.B.",
      ".GGSSGG.Bb",
      ".GSEESG.Bb",
      ".GSSSSG.Bb",
      "..GGGG..Bb",
      "..TTTT..Bb",
      ".TTTTTT.Bb",
      ".T.TT.T.Bb",
      ".TTTTTT.B.",
      ".TT..TT...",
      ".TT..TT...",
    ],
    pal: { G: "#15803d", S: "#fcd9b6", E: "#1f2937", T: "#a16207", B: "#7c3a0e", b: "#cbd5e1" },
  },
};
function PixelAvatar({ name, px = 7 }: { name: string; px?: number }) {
  const c = CHARACTERS[name] || CHARACTERS.Patrick;
  const rects: React.ReactNode[] = [];
  c.grid.forEach((row, y) =>
    row.split("").forEach((ch, x) => {
      if (ch === ".") return;
      rects.push(<rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={c.pal[ch] || "#000"} />);
    })
  );
  const w = Math.max(...c.grid.map((r) => r.length));
  return (
    <svg width={w * px} height={c.grid.length * px} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      {rects}
    </svg>
  );
}

const lsKey = (rater: string) => `tinder_verdicts_${rater.toLowerCase()}`;
const isComplete = (v?: Verdict) => !!v && v.tissue != null && v.celltype != null;

export default function TinderClient() {
  const [rater, setRater] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [idx, setIdx] = useState(0);
  const [tissue, setTissue] = useState<Rating | null>(null);
  const [celltype, setCelltype] = useState<Rating | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [progressAll, setProgressAll] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [armed, setArmed] = useState<{ rung: "tissue" | "celltype"; val: Rating } | null>(null);
  const [flash, setFlash] = useState<{ tissue: Rating; celltype: Rating } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const tissueRefs = useRef<(HTMLDivElement | null)[]>([]);
  const celltypeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pairsRef = useRef<Pair[]>([]);
  // Arena sizes to the available width so the bins spread to the edges (less center scrunch).
  const arenaWrapRef = useRef<HTMLDivElement>(null);
  const [arenaW, setArenaW] = useState(340);
  useEffect(() => {
    const measure = () => {
      if (arenaWrapRef.current) setArenaW(Math.max(280, Math.min(460, arenaWrapRef.current.clientWidth)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rater]);

  useEffect(() => {
    fetch("/cell_type_tinder/pairs.json").then((r) => r.json()).then((p: Pair[]) => setPairs(p)).catch(() => {});
  }, []);
  useEffect(() => { pairsRef.current = pairs; }, [pairs]);

  useEffect(() => {
    if (rater) return;
    fetch("/api/cell_type_tinder?action=progress")
      .then((r) => r.json())
      .then((j) => {
        const out: Record<string, number> = {};
        for (const u of Object.keys(j?.progress || {})) out[u] = j.progress[u].n_decided || 0;
        setProgressAll(out);
      })
      .catch(() => {});
  }, [rater]);

  const persist = useCallback(async (next: VerdictMap, who?: string) => {
    const name = who || rater;
    if (!name) return;
    if (typeof window !== "undefined") localStorage.setItem(lsKey(name), JSON.stringify(next));
    setSaveState("saving");
    try {
      const r = await fetch("/api/cell_type_tinder", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: name.toLowerCase(), verdicts: next }),
      });
      setSaveState(r.ok ? "saved" : "error");
    } catch { setSaveState("error"); }
  }, [rater]);

  const pickRater = useCallback(async (name: string) => {
    setRater(name);
    if (typeof window !== "undefined") localStorage.setItem("tinder_last_rater", name);
    let server: VerdictMap = {};
    try {
      const r = await fetch(`/api/cell_type_tinder?user=${name.toLowerCase()}`);
      server = (await r.json())?.verdicts || {};
    } catch {}
    let local: VerdictMap = {};
    try { local = JSON.parse(localStorage.getItem(lsKey(name)) || "{}"); } catch {}
    const merged: VerdictMap = { ...server };
    let localExtra = false;
    for (const [pid, v] of Object.entries(local)) {
      if (!merged[pid] || (v?.ts || 0) > (merged[pid].ts || 0)) { merged[pid] = v; if (!server[pid]) localExtra = true; }
    }
    setVerdicts(merged);
    const first = (pairsRef.current || []).findIndex((p) => !isComplete(merged[p.pair_id]));
    setIdx(first < 0 ? (pairsRef.current?.length || 0) : first);
    if (localExtra) void persist(merged, name);
  }, [persist]);

  useEffect(() => {
    const last = typeof window !== "undefined" ? localStorage.getItem("tinder_last_rater") : null;
    if (last && RATERS.includes(last) && pairsRef.current.length) pickRater(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.length]);

  const cur = pairs[idx];
  const decided = Object.values(verdicts).filter(isComplete).length;
  const total = pairs.length || TOTAL;
  const done = idx >= total && total > 0;

  // load existing ratings for the current pair (resume / back / re-rate)
  useEffect(() => {
    const v = cur ? verdicts[cur.pair_id] : undefined;
    setTissue((v?.tissue as Rating) ?? null);
    setCelltype((v?.celltype as Rating) ?? null);
    setDrag(null); setArmed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, cur?.pair_id]);

  // write current pair's verdict (partial allowed; advances + flashes when BOTH rungs set)
  const writeRung = useCallback((rung: "tissue" | "celltype", val: Rating) => {
    if (!cur || flash) return;
    const nt = rung === "tissue" ? val : tissue;
    const nc = rung === "celltype" ? val : celltype;
    if (rung === "tissue") setTissue(val); else setCelltype(val);
    const old = verdicts[cur.pair_id];
    const entry: Verdict = {
      tissue: nt ?? undefined,
      celltype: nc ?? undefined,
      ts: Date.now(),
      ...(old?.bucket != null ? { legacy_bucket: old.bucket } : old?.legacy_bucket != null ? { legacy_bucket: old.legacy_bucket } : {}),
    };
    const next = { ...verdicts, [cur.pair_id]: entry };
    setVerdicts(next);
    void persist(next);
    setDrag(null); setArmed(null);
    if (nt != null && nc != null) {
      setFlash({ tissue: nt, celltype: nc });
      window.setTimeout(() => { setFlash(null); setIdx((i) => i + 1); }, 1300);
    }
  }, [cur, flash, tissue, celltype, verdicts, persist]);

  const goBack = useCallback(() => {
    if (flash) return;
    setIdx((i) => Math.max(0, i - 1));
  }, [flash]);

  // Rungs are answered in order: TISSUE first, then CELL TYPE.
  const activeRung: "tissue" | "celltype" = tissue == null ? "tissue" : "celltype";

  // ---- drag the card toward the ACTIVE rung's bins; nearest arms ----
  const nearest = (x: number, y: number, refs: (HTMLDivElement | null)[]): Rating | null => {
    let best: Rating | null = null, bestD = Infinity;
    refs.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      // refs are stored by position index i (0 = leftmost); Arc renders value (5 - i) there,
      // so the value at ref index i is (5 - i). (Was BINS[i].value, which mirrored the arc.)
      if (d < bestD) { bestD = d; best = (5 - i) as Rating; }
    });
    return best;
  };
  const onDown = (x: number, y: number, el: HTMLElement, pid: number) => {
    if (flash) return;
    startRef.current = { x, y };
    try { el.setPointerCapture(pid); } catch {}
  };
  const onMove = (x: number, y: number) => {
    if (!startRef.current) return;
    const dx = x - startRef.current.x, dy = y - startRef.current.y;
    setDrag({ dx, dy });
    if (Math.hypot(dx, dy) < 30) { setArmed(null); return; }
    const refs = activeRung === "tissue" ? tissueRefs.current : celltypeRefs.current;
    const v = nearest(x, y, refs);
    setArmed(v ? { rung: activeRung, val: v } : null);
  };
  const onUp = () => {
    if (!startRef.current) return;
    startRef.current = null;
    if (armed) writeRung(armed.rung, armed.val);
    else { setDrag(null); setArmed(null); }
  };

  // ---------------- LANDING ----------------
  if (!rater) {
    return (
      <Shell>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Cell Type Tinder <span>🔥</span></h1>
          <p style={{ color: "#64748b", marginTop: 6 }}>Now double the judgement: tissue ↑ &amp; cell type ↓ 💕</p>
        </div>
        <p style={{ color: "#475569", textAlign: "center", margin: "10px 0 22px", fontSize: 14 }}>Who&apos;s judging today?</p>
        {RATERS.map((n) => {
          const pct = Math.round(((progressAll[n.toLowerCase()] || 0) / TOTAL) * 100);
          return (
            <button key={n} onClick={() => pickRater(n)} style={charCard}>
              <PixelAvatar name={n} />
              <div style={{ flex: 1, textAlign: "left", marginLeft: 14 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: "#0f172a" }}>{n}</div>
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 6, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: 10, width: `${pct}%`, background: pct === 100 ? "#16a34a" : "#0ea5e9", borderRadius: 6, transition: "width .4s" }} />
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  {progressAll[n.toLowerCase()] || 0} / {TOTAL} fully rated{pct === 100 ? " · done! 🎉" : ""}
                </div>
              </div>
              <span style={{ fontSize: 22, marginLeft: 8 }}>›</span>
            </button>
          );
        })}
      </Shell>
    );
  }

  if (total === 0) return <Shell><p style={{ color: "#475569" }}>Loading pairs… 💘</p></Shell>;

  // ---------------- DONE ----------------
  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56 }}>🎉💕🔥</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>It&apos;s a match, {rater}!</h2>
          <p style={{ color: "#475569", margin: "12px 0 24px" }}>You fully rated {decided} / {total} pairs (tissue + cell type). All saved.</p>
        </div>
        <button onClick={() => setIdx(0)} style={secondaryBtn}>Review from the start</button>
        <a href="/api/cell_type_tinder?action=export" style={{ ...secondaryBtn, display: "block", textDecoration: "none", textAlign: "center" }}>⬇️ Export all verdicts (CSV)</a>
        <button onClick={() => { localStorage.removeItem("tinder_last_rater"); setRater(null); }} style={ghostBtn}>Switch rater</button>
      </Shell>
    );
  }

  const tilt = drag ? Math.max(-12, Math.min(12, drag.dx / 12)) : 0;
  // Geometry from the measured width: bins ride a circle near the edge; card is wide & centered.
  const AW = arenaW;
  const geo: Geo = { cx: AW / 2, cy: AW / 2, r: AW / 2 - BINW / 2 - 6, cardw: Math.min(AW * 0.6, 260) };

  return (
    <Shell>
      {/* top bar: Go Back (prev pair) + your character (tap to switch rater) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={goBack} disabled={idx === 0} style={backBtn(idx === 0)}>‹ Go Back</button>
        <button onClick={() => setRater(null)} title="switch rater" style={charChip}>
          <PixelAvatar name={rater} px={4} />
          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{rater}</span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>⇄</span>
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        <span><b style={{ color: "#0f172a" }}>{idx + 1}</b> / {total} · {decided} done</span>
        <span style={{ color: saveState === "error" ? "#dc2626" : "#16a34a" }}>
          {saveState === "saving" ? "saving…" : saveState === "error" ? "⚠ retry" : "✓ saved"}
        </span>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 6 }}>
        <div style={{ height: 6, width: `${(decided / total) * 100}%`, background: "#0ea5e9", borderRadius: 3, transition: "width .3s" }} />
      </div>

      {/* TISSUE header (bright while it's this rung's turn) */}
      <RungHeader title="TISSUE" active={activeRung === "tissue"} done={tissue != null} value={tissue}
        color="#0ea5e9" onUnsure={() => writeRung("tissue", "unsure")} onReopen={() => setTissue(null)} />

      {/* CIRCULAR ARENA: bins around a central card; card renders UNDERNEATH the bins */}
      <div ref={arenaWrapRef} style={{ width: "100%" }}>
       <div style={{ position: "relative", width: AW, height: AW, margin: "2px auto" }}>
        {/* central card (zIndex 1, under the bins); auto-height so long labels never clip */}
        {!flash && (
          <div
            onPointerDown={(e) => onDown(e.clientX, e.clientY, e.currentTarget, e.pointerId)}
            onPointerMove={(e) => onMove(e.clientX, e.clientY)}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute", left: geo.cx, top: geo.cy, width: geo.cardw,
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, boxShadow: "0 10px 30px rgba(2,8,23,.10)",
              padding: "14px", transform: `translate(calc(-50% + ${drag?.dx ?? 0}px), calc(-50% + ${drag?.dy ?? 0}px)) rotate(${tilt}deg)`,
              transition: drag ? "none" : "transform .2s cubic-bezier(.2,.8,.3,1)",
              touchAction: "none", userSelect: "none", cursor: "grab", zIndex: 1,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
              <LadderCard ladder={cur.A_ladder} fallback={cur.label_A} />
              <div style={{ display: "flex", alignItems: "center", color: "#e11d48", fontWeight: 800, fontSize: 13 }}>vs</div>
              <LadderCard ladder={cur.B_ladder} fallback={cur.label_B} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <Chip label="Tissue" value={tissue} />
              <Chip label="Cell" value={celltype} />
            </div>
          </div>
        )}
        {/* confirmation flash overlay (above the bins) */}
        {flash && (
          <div style={{ position: "absolute", left: geo.cx, top: geo.cy, width: geo.cardw, transform: "translate(-50%,-50%)", zIndex: 6 }}>
            <FlashCard tissue={flash.tissue} celltype={flash.celltype} />
          </div>
        )}
        {/* bins (zIndex 3, above the card) */}
        <Arc rung="tissue" refs={tissueRefs} armed={armed} active={activeRung === "tissue"} geo={geo} onPick={(v) => writeRung("tissue", v)} />
        <Arc rung="celltype" refs={celltypeRefs} armed={armed} active={activeRung === "celltype"} geo={geo} onPick={(v) => writeRung("celltype", v)} />
       </div>
      </div>

      {/* CELL TYPE header (greyed until tissue is done, then bright) */}
      <RungHeader title="CELL TYPE" active={activeRung === "celltype"} done={celltype != null} value={celltype}
        color="#a855f7" onUnsure={() => writeRung("celltype", "unsure")} onReopen={() => setCelltype(null)} />

      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
        ⬅ different · same ➡ — drag the card into a bin, or tap. tissue first, then cell type.
      </div>
    </Shell>
  );
}

// 5 bins on the arena circle for one rung. Greyed + non-interactive until it's this rung's turn.
function Arc({ rung, refs, armed, active, geo, onPick }: {
  rung: "tissue" | "celltype";
  refs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  armed: { rung: "tissue" | "celltype"; val: Rating } | null;
  active: boolean;
  geo: Geo;
  onPick: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <>
      {BINS.map((b, i) => {
        const val = (5 - i) as 1 | 2 | 3 | 4 | 5;   // i=0 leftmost = 5 "different"; i=4 rightmost = 1 "same"
        const bin = BINS.find((x) => x.value === val)!;
        const pos = binPos(rung, i, geo);
        const isArmed = active && armed?.rung === rung && armed.val === val;
        const col = active ? bin.color : "#cbd5e1";
        return (
          <div
            key={val}
            ref={(el) => { refs.current[i] = el; }}
            onClick={active ? () => onPick(val) : undefined}
            style={{
              position: "absolute", left: pos.left, top: pos.top, width: BINW, height: BINH,
              transform: `scale(${isArmed ? 1.28 : 1})`, transition: "transform .12s, box-shadow .12s, opacity .2s",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              textAlign: "center", cursor: active ? "pointer" : "default", pointerEvents: active ? "auto" : "none",
              opacity: active ? 1 : 0.4,
              background: isArmed ? col : "#fff", color: isArmed ? "#fff" : col,
              border: `2px solid ${col}`, borderRadius: 12,
              boxShadow: isArmed ? `0 0 0 4px ${col}44, 0 8px 18px ${col}66` : "0 2px 5px rgba(2,8,23,.06)",
              fontWeight: 700, zIndex: isArmed ? 4 : 3,
            }}
          >
            <div style={{ fontSize: 14 }}>{bin.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{val}</div>
            <div style={{ fontSize: 8, lineHeight: 1 }}>{bin.short}</div>
          </div>
        );
      })}
    </>
  );
}

// Rung label + unsure button. Bright when it's this rung's turn; greyed otherwise.
// Tapping a DONE rung's label re-opens it for correction.
function RungHeader({ title, active, done, value, color, onUnsure, onReopen }: {
  title: string; active: boolean; done: boolean; value: Rating | null; color: string;
  onUnsure: () => void; onReopen: () => void;
}) {
  const b = binOf(value);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0",
      padding: "6px 12px", borderRadius: 12, transition: "all .2s",
      background: active ? `${color}1a` : "transparent",
      border: active ? `2px solid ${color}` : "2px solid transparent",
      opacity: active ? 1 : 0.5,
    }}>
      <div onClick={done && !active ? onReopen : undefined}
        style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: active ? color : "#94a3b8", cursor: done && !active ? "pointer" : "default" }}>
        {title}
        {done && <span style={{ marginLeft: 8, fontSize: 12, color: "#16a34a" }}>
          ✓ {value === "unsure" ? "unsure" : `${value} ${b?.short}`}
        </span>}
        {done && !active && <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8" }}>✎ edit</span>}
        {active && !done && <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b", fontWeight: 600 }}>← your turn</span>}
      </div>
      <button onClick={active ? onUnsure : undefined} disabled={!active} style={{
        ...unsureBtn, cursor: active ? "pointer" : "default", opacity: active ? 1 : 0.5,
        ...(value === "unsure" ? { background: "#475569", color: "#fff", borderStyle: "solid" } : {}),
      }}>🤷 unsure</button>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: Rating | null }) {
  const b = binOf(value);
  const set = value != null;
  const bg = value === "unsure" ? "#475569" : b ? b.color : "#e2e8f0";
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
      background: set ? bg : "#f1f5f9", color: set ? "#fff" : "#94a3b8",
      border: set ? "none" : "1px dashed #cbd5e1",
    }}>
      {label}: {set ? (value === "unsure" ? "unsure" : `${value} ${b?.short}`) : "—"}
    </div>
  );
}

function FlashCard({ tissue, celltype }: { tissue: Rating; celltype: Rating }) {
  const tb = binOf(tissue), cb = binOf(celltype);
  return (
    <div style={{
      position: "relative", minHeight: 150, borderRadius: 18, background: "#0f172a", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 10px 40px rgba(2,8,23,.5)", animation: "tinderPop .25s ease", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {["💕", "✨", "🔥", "💖", "⭐"].map((e, i) => (
          <span key={i} style={{ position: "absolute", left: `${12 + i * 18}%`, top: "20%", fontSize: 20, animation: `tinderFloat 1.1s ease ${i * 0.07}s forwards` }}>{e}</span>
        ))}
      </div>
      <div style={{ fontSize: 30 }}>✅</div>
      <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
        <RungResult title="Tissue" rating={tissue} color={tb?.color} />
        <RungResult title="Cell type" rating={celltype} color={cb?.color} />
      </div>
      <style>{`
        @keyframes tinderPop { from { transform: scale(.85); opacity:.4 } to { transform: scale(1); opacity:1 } }
        @keyframes tinderFloat { from { transform: translateY(0); opacity:1 } to { transform: translateY(-60px); opacity:0 } }
      `}</style>
    </div>
  );
}
function RungResult({ title, rating, color }: { title: string; rating: Rating; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "#94a3b8" }}>
        {rating === "unsure" ? "🤷" : rating}
      </div>
      <div style={{ fontSize: 11 }}>{rating === "unsure" ? "unsure" : binOf(rating)?.short}</div>
    </div>
  );
}

// One identity shown as a germ layer → tissue → cell-type ladder (cell type emphasized).
// Falls back to a bare cell-type string if a pair predates ladder enrichment.
function LadderCard({ ladder, fallback }: { ladder?: Ladder; fallback: string }) {
  const l = ladder || { germ_layer: "", tissue: "", cell_type: fallback };
  const Rung = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div style={{ padding: strong ? "6px 8px" : "3px 8px", borderTop: strong ? "1px solid #e2e8f0" : "none" }}>
      <div style={{ fontSize: 8, letterSpacing: 0.5, color: "#94a3b8", textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontSize: strong ? 15 : 12, fontWeight: strong ? 700 : 500, color: strong ? "#0f172a" : "#475569", lineHeight: 1.15 }}>
        {v || "—"}
      </div>
    </div>
  );
  return (
    <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 12, overflow: "hidden", textAlign: "center" }}>
      <Rung k="germ layer" v={l.germ_layer} />
      <Rung k="tissue" v={l.tissue} />
      <Rung k="cell type" v={l.cell_type} strong />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#fff5f7 0%,#f8fafc 40%)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "18px 14px 44px", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        {children}
      </div>
    </div>
  );
}

const charCard: React.CSSProperties = {
  display: "flex", alignItems: "center", width: "100%", padding: "14px 16px", marginBottom: 14,
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, cursor: "pointer", boxShadow: "0 4px 14px rgba(2,8,23,.06)",
};
const secondaryBtn: React.CSSProperties = {
  width: "100%", padding: "14px", marginBottom: 10, fontSize: 16, fontWeight: 600,
  background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = { background: "none", border: "none", color: "#64748b", fontSize: 15, cursor: "pointer", padding: 8, width: "100%" };
const backBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#f1f5f9" : "#0f172a", color: disabled ? "#cbd5e1" : "#fff",
  border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
});
const unsureBtn: React.CSSProperties = {
  background: "#fff", color: "#475569", border: "2px dashed #94a3b8", borderRadius: 999,
  padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .12s",
};
const charChip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 999, padding: "4px 12px 4px 6px", cursor: "pointer", boxShadow: "0 2px 6px rgba(2,8,23,.06)",
};
