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

type Pair = { pair_id: string; label_A: string; label_B: string; tier: string; tissue_area: string };
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
const binOf = (v: Rating | null | undefined) =>
  typeof v === "number" ? BINS.find((b) => b.value === v) : undefined;
const ratingLabel = (v: Rating | null | undefined) =>
  v == null ? "—" : v === "unsure" ? "unsure" : binOf(v)?.short || String(v);
const TIER_LABEL: Record<string, string> = {
  germ_layer: "germ layer", tissue: "tissue",
  cell_type_broad: "cell type — broad", cell_type_sub: "cell type — fine",
};

// ---- pixel-art characters ----
const FACE = [
  "..HHHHHH..", ".HHHHHHHH.", ".HHHHHHHH.", ".HSSSSSSH.", ".SSSSSSSS.",
  ".SeSSSSeS.", ".SSSSSSSS.", ".SSmmmmSS.", ".SSSSSSSS.", "..aaaaaa..", ".aaaaaaaa.",
];
const PALETTES: Record<string, Record<string, string>> = {
  Patrick: { H: "#2563eb", S: "#fcd9b6", e: "#1f2937", m: "#b91c1c", a: "#0d9488" },
  Harsha: { H: "#7c3aed", S: "#e8b98f", e: "#1f2937", m: "#b91c1c", a: "#ea580c" },
  Steven: { H: "#15803d", S: "#fcd9b6", e: "#1f2937", m: "#b91c1c", a: "#ca8a04" },
};
function PixelAvatar({ name, px = 7 }: { name: string; px?: number }) {
  const pal = PALETTES[name] || PALETTES.Patrick;
  const rects: React.ReactNode[] = [];
  FACE.forEach((row, y) =>
    row.split("").forEach((ch, x) => {
      if (ch === ".") return;
      rects.push(<rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={pal[ch] || "#000"} />);
    })
  );
  return (
    <svg width={10 * px} height={11 * px} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
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
  const [note, setNote] = useState("");
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
    setNote(v?.note || "");
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
      note: note.trim() || undefined,
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
  }, [cur, flash, tissue, celltype, note, verdicts, persist]);

  const goBack = useCallback(() => {
    if (flash) return;
    setIdx((i) => Math.max(0, i - 1));
  }, [flash]);

  // ---- drag: up arms TISSUE (upper arc), down arms CELL TYPE (lower arc) ----
  const nearest = (x: number, y: number, refs: (HTMLDivElement | null)[]): Rating | null => {
    let best: Rating | null = null, bestD = Infinity;
    refs.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = BINS[i].value; }
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
    if (dy < -35) { const v = nearest(x, y, tissueRefs.current); setArmed(v ? { rung: "tissue", val: v } : null); }
    else if (dy > 35) { const v = nearest(x, y, celltypeRefs.current); setArmed(v ? { rung: "celltype", val: v } : null); }
    else setArmed(null);
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

  return (
    <Shell>
      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={goBack} disabled={idx === 0} style={backBtn(idx === 0)}>‹ Back</button>
        <div style={{ fontSize: 13, color: "#64748b", textAlign: "right" }}>
          <div><b style={{ color: "#0f172a" }}>{idx + 1}</b> / {total} · {decided} done</div>
          <div style={{ color: saveState === "error" ? "#dc2626" : "#16a34a" }}>
            {saveState === "saving" ? "saving…" : saveState === "error" ? "⚠ retry" : "✓ saved"}
          </div>
        </div>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 8 }}>
        <div style={{ height: 6, width: `${(decided / total) * 100}%`, background: "#0ea5e9", borderRadius: 3, transition: "width .3s" }} />
      </div>

      {/* TISSUE rung label + unsure */}
      <RungHeader title="TISSUE" hint="swipe ↑" value={tissue} onUnsure={() => writeRung("tissue", "unsure")} armed={armed?.rung === "tissue"} />

      {/* upper semicircle (tissue) */}
      <Arc which="tissue" refs={tissueRefs} armed={armed} upper onPick={(v) => writeRung("tissue", v)} />

      {/* CENTER CARD */}
      <div style={{ position: "relative", height: 168 }}>
        {flash ? (
          <FlashCard tissue={flash.tissue} celltype={flash.celltype} />
        ) : (
          <div
            onPointerDown={(e) => onDown(e.clientX, e.clientY, e.currentTarget, e.pointerId)}
            onPointerMove={(e) => onMove(e.clientX, e.clientY)}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute", inset: 0, background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 18, boxShadow: "0 10px 30px rgba(2,8,23,.10)", padding: "14px 14px",
              transform: `translate(${drag?.dx ?? 0}px, ${drag?.dy ?? 0}px) rotate(${tilt}deg)`,
              transition: drag ? "none" : "transform .2s cubic-bezier(.2,.8,.3,1)",
              touchAction: "none", userSelect: "none", cursor: "grab", zIndex: 5,
            }}
          >
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>
              {TIER_LABEL[cur.tier] || cur.tier} · {cur.tissue_area || "—"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <LabelCard text={cur.label_A} />
              <div style={{ textAlign: "center", color: "#e11d48", fontWeight: 800, fontSize: 12 }}>💕 vs 💔</div>
              <LabelCard text={cur.label_B} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <Chip label="Tissue" value={tissue} />
              <Chip label="Cell type" value={celltype} />
            </div>
          </div>
        )}
      </div>

      {/* lower semicircle (cell type) */}
      <Arc which="celltype" refs={celltypeRefs} armed={armed} onPick={(v) => writeRung("celltype", v)} />

      {/* CELL TYPE rung label + unsure */}
      <RungHeader title="CELL TYPE" hint="swipe ↓" value={celltype} onUnsure={() => writeRung("celltype", "unsure")} armed={armed?.rung === "celltype"} />

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional note…"
        style={{ width: "100%", marginTop: 10, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 15 }} />
      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
        swipe ↑ tissue · ↓ cell type · or tap a bin · both rungs → next
      </div>
    </Shell>
  );
}

// 5-bin semicircle. upper=true => arc above the card (∩, ends near card); else below (∪).
function Arc({ which, refs, armed, upper, onPick }: {
  which: "tissue" | "celltype";
  refs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  armed: { rung: "tissue" | "celltype"; val: Rating } | null;
  upper?: boolean;
  onPick: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const H = 120, R = 96;
  return (
    <div style={{ position: "relative", height: H, margin: upper ? "2px 0 4px" : "4px 0 2px" }}>
      {BINS.map((b, i) => {
        const ang = (180 - i * 45) * (Math.PI / 180);
        const cx = 50 + Math.cos(ang) * 40;          // % width
        const s = Math.sin(ang) * R;                  // px from the diameter edge
        const top = upper ? H - s - 52 : s + 4;       // upper: cap near top; lower: cup near bottom
        const isArmed = armed?.rung === which && armed.val === b.value;
        return (
          <div
            key={b.value}
            ref={(el) => { refs.current[i] = el; }}
            onClick={() => onPick(b.value)}
            style={{
              position: "absolute", left: `${cx}%`, top, marginLeft: -32, width: 64,
              transform: `scale(${isArmed ? 1.22 : 1})`, transition: "transform .12s, box-shadow .12s",
              textAlign: "center", cursor: "pointer",
              background: isArmed ? b.color : "#fff", color: isArmed ? "#fff" : b.color,
              border: `2px solid ${b.color}`, borderRadius: 12, padding: "6px 2px",
              boxShadow: isArmed ? `0 0 0 4px ${b.color}33, 0 8px 18px ${b.color}55` : "0 2px 5px rgba(2,8,23,.06)",
              fontWeight: 700, zIndex: isArmed ? 4 : 2,
            }}
          >
            <div style={{ fontSize: 15 }}>{b.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{b.value}</div>
            <div style={{ fontSize: 9, lineHeight: 1 }}>{b.short}</div>
          </div>
        );
      })}
    </div>
  );
}

function RungHeader({ title, hint, value, onUnsure, armed }: {
  title: string; hint: string; value: Rating | null; onUnsure: () => void; armed?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: armed ? "#0ea5e9" : "#334155" }}>
        {title} <span style={{ color: "#94a3b8", fontWeight: 600 }}>{hint}</span>
      </div>
      <button onClick={onUnsure} style={{
        ...unsureBtn, ...(value === "unsure" ? { background: "#475569", color: "#fff", borderStyle: "solid" } : {}),
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
      position: "absolute", inset: 0, borderRadius: 18, background: "#0f172a", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 10px 40px rgba(2,8,23,.5)", animation: "tinderPop .25s ease", zIndex: 6, overflow: "hidden",
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

function LabelCard({ text }: { text: string }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "11px 12px", textAlign: "center", fontSize: 17, fontWeight: 600, color: "#0f172a" }}>
      {text}
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
