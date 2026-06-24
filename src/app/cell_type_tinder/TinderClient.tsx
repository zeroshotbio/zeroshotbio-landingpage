"use client";

// Cell Type Tinder 🔥 — mobile-first label-pair binning.
// Blinding: two neutral cards (label_A / label_B); which is prediction vs ground truth is never
// shown and the machine verdict is never loaded. All raters bin the SAME set independently.
// Interaction: drag the card down into a semicircle of 5 bins — the nearest bin lights up; on
// release it flashes a confirmation, then advances. Verdicts persist to DynamoDB after every
// call AND mirror to localStorage, so nothing is lost on navigate-away / refresh / offline.

import { useCallback, useEffect, useRef, useState } from "react";

type Pair = { pair_id: string; label_A: string; label_B: string; tier: string; tissue_area: string };
type Bucket = 1 | 2 | 3 | 4 | 5 | "unsure";
type Verdict = { bucket: Bucket; note?: string; ts: number };
type VerdictMap = Record<string, Verdict>;

const RATERS = ["Patrick", "Harsha", "Steven"];
const TOTAL = 334;
const BINS: { value: 1 | 2 | 3 | 4 | 5; label: string; short: string; emoji: string; color: string }[] = [
  { value: 1, label: "Exactly the same", short: "Exact", emoji: "💚", color: "#16a34a" },
  { value: 2, label: "Basically the same", short: "Basically", emoji: "🙂", color: "#65a30d" },
  { value: 3, label: "Partially related", short: "Partial", emoji: "🤔", color: "#ca8a04" },
  { value: 4, label: "Barely related", short: "Barely", emoji: "😬", color: "#ea580c" },
  { value: 5, label: "Totally different", short: "Different", emoji: "❌", color: "#dc2626" },
];
const binByValue = (v: Bucket) => BINS.find((b) => b.value === v);
const TIER_LABEL: Record<string, string> = {
  germ_layer: "germ layer", tissue: "tissue",
  cell_type_broad: "cell type — broad", cell_type_sub: "cell type — fine",
};

// ---- pixel-art characters (shared silhouette, per-rater palette) ----
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

export default function TinderClient() {
  const [rater, setRater] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [progressAll, setProgressAll] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [armed, setArmed] = useState<Bucket | null>(null);
  const [flash, setFlash] = useState<Bucket | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const binRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unsureRef = useRef<HTMLDivElement | null>(null);
  const pairsRef = useRef<Pair[]>([]);

  // load pairs once (already shuffled in the file)
  useEffect(() => {
    fetch("/cell_type_tinder/pairs.json").then((r) => r.json()).then((p: Pair[]) => setPairs(p)).catch(() => {});
  }, []);
  useEffect(() => { pairsRef.current = pairs; }, [pairs]);

  // landing: fetch everyone's progress for the loading bars
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

  // remember last rater so a break/navigate-away auto-resumes
  useEffect(() => {
    const last = typeof window !== "undefined" ? localStorage.getItem("tinder_last_rater") : null;
    if (last && RATERS.includes(last) && pairsRef.current.length) pickRater(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.length]);

  const pickRater = useCallback(async (name: string) => {
    setRater(name);
    if (typeof window !== "undefined") localStorage.setItem("tinder_last_rater", name);
    let server: VerdictMap = {};
    try {
      const r = await fetch(`/api/cell_type_tinder?user=${name.toLowerCase()}`);
      server = (await r.json())?.verdicts || {};
    } catch {}
    // merge with any local backup (prefer the newer verdict per pair) so offline calls survive
    let local: VerdictMap = {};
    try { local = JSON.parse(localStorage.getItem(lsKey(name)) || "{}"); } catch {}
    const merged: VerdictMap = { ...server };
    let localExtra = false;
    for (const [pid, v] of Object.entries(local)) {
      if (!merged[pid] || (v?.ts || 0) > (merged[pid].ts || 0)) { merged[pid] = v; if (!server[pid]) localExtra = true; }
    }
    setVerdicts(merged);
    const first = (pairsRef.current || []).findIndex((p) => !merged[p.pair_id]);
    setIdx(first < 0 ? (pairsRef.current?.length || 0) : first);
    if (localExtra) void persist(merged, name); // re-sync recovered local verdicts
  }, []);

  const persist = useCallback(async (next: VerdictMap, who?: string) => {
    const name = who || rater;
    if (!name) return;
    if (typeof window !== "undefined") localStorage.setItem(lsKey(name), JSON.stringify(next)); // backup first
    setSaveState("saving");
    try {
      const r = await fetch("/api/cell_type_tinder", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: name.toLowerCase(), verdicts: next }),
      });
      setSaveState(r.ok ? "saved" : "error");
    } catch { setSaveState("error"); }
  }, [rater]);

  const cur = pairs[idx];
  const decided = Object.keys(verdicts).length;
  const total = pairs.length || TOTAL;
  const done = idx >= total && total > 0;

  const commit = useCallback((bucket: Bucket) => {
    if (!cur || flash) return;
    const next = { ...verdicts, [cur.pair_id]: { bucket, note: note.trim() || undefined, ts: Date.now() } };
    setVerdicts(next);
    setDrag(null); setArmed(null);
    setFlash(bucket);
    void persist(next);
    window.setTimeout(() => { setFlash(null); setNote(""); setIdx((i) => i + 1); }, 1400);
  }, [cur, verdicts, note, persist, flash]);

  const goBack = useCallback(() => {
    if (flash) return;
    setIdx((i) => Math.max(0, i - 1)); setNote(""); setDrag(null); setArmed(null);
  }, [flash]);

  // ---- drag the card into the arc; nearest bin arms; release commits ----
  const nearestBin = (x: number, y: number, dy: number): Bucket | null => {
    if (dy < -55) return "unsure";          // strong up-swipe = unsure
    if (dy < 45) return null;               // must pull down toward the arc
    let best: Bucket | null = null, bestD = Infinity;
    binRefs.current.forEach((el, i) => {
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
    setArmed(nearestBin(x, y, dy));
  };
  const onUp = () => {
    if (!startRef.current) return;
    startRef.current = null;
    if (armed !== null) commit(armed);
    else { setDrag(null); setArmed(null); }
  };

  // keyboard: 1-5 / u
  useEffect(() => {
    if (!rater || done) return;
    const h = (e: KeyboardEvent) => {
      if (flash) return;
      if (e.key >= "1" && e.key <= "5") commit(Number(e.key) as Bucket);
      else if (e.key.toLowerCase() === "u") commit("unsure");
      else if (e.key === "Backspace") goBack();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rater, done, flash, commit, goBack]);

  // ---------------- LANDING ----------------
  if (!rater) {
    return (
      <Shell>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Cell Type Tinder <span>🔥</span></h1>
          <p style={{ color: "#64748b", marginTop: 6 }}>Swipe right… left… down. It&apos;s complicated. 💕</p>
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
                  {progressAll[n.toLowerCase()] || 0} / {TOTAL} binned{pct === 100 ? " · done! 🎉" : ""}
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
          <p style={{ color: "#475569", margin: "12px 0 24px" }}>You binned {decided} / {total} pairs. All saved.</p>
        </div>
        <button onClick={() => setIdx(0)} style={secondaryBtn}>Review from the start</button>
        <a href="/api/cell_type_tinder?action=export" style={{ ...secondaryBtn, display: "block", textDecoration: "none", textAlign: "center" }}>⬇️ Export all verdicts (CSV)</a>
        <button onClick={() => { localStorage.removeItem("tinder_last_rater"); setRater(null); }} style={ghostBtn}>Switch rater</button>
      </Shell>
    );
  }

  const prev = verdicts[cur.pair_id];
  const tilt = drag ? Math.max(-14, Math.min(14, drag.dx / 10)) : 0;
  const armedBin = typeof armed === "number" ? binByValue(armed) : null;

  return (
    <Shell>
      {/* top bar: obvious BACK top-left + progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={goBack} disabled={idx === 0} style={backBtn(idx === 0)}>‹ Back</button>
        <div style={{ fontSize: 13, color: "#64748b", textAlign: "right" }}>
          <div><b style={{ color: "#0f172a" }}>{idx + 1}</b> / {total}</div>
          <div style={{ color: saveState === "error" ? "#dc2626" : "#16a34a" }}>
            {saveState === "saving" ? "saving…" : saveState === "error" ? "⚠ retry" : "✓ saved"}
          </div>
        </div>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 6 }}>
        <div style={{ height: 6, width: `${(decided / total) * 100}%`, background: "#0ea5e9", borderRadius: 3, transition: "width .3s" }} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        as {rater} · drag the card into a bin 👇
      </div>

      {/* CARD */}
      <div style={{ position: "relative", height: 188 }}>
        {flash ? (
          <FlashCard bucket={flash} />
        ) : (
          <div
            onPointerDown={(e) => onDown(e.clientX, e.clientY, e.currentTarget, e.pointerId)}
            onPointerMove={(e) => onMove(e.clientX, e.clientY)}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "absolute", inset: 0, background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 18, boxShadow: "0 10px 30px rgba(2,8,23,.10)", padding: "18px 16px",
              transform: `translate(${drag?.dx ?? 0}px, ${drag?.dy ?? 0}px) rotate(${tilt}deg)`,
              transition: drag ? "none" : "transform .2s cubic-bezier(.2,.8,.3,1)",
              touchAction: "none", userSelect: "none", cursor: "grab", zIndex: 5,
            }}
          >
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>
              {TIER_LABEL[cur.tier] || cur.tier} · {cur.tissue_area || "—"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <LabelCard text={cur.label_A} />
              <div style={{ textAlign: "center", color: "#e11d48", fontWeight: 800, fontSize: 13 }}>💕 vs 💔</div>
              <LabelCard text={cur.label_B} />
            </div>
            {prev && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#0ea5e9", marginTop: 8 }}>
                previously: {typeof prev.bucket === "number" ? binByValue(prev.bucket)?.short : "unsure"} (re-bin to change)
              </div>
            )}
          </div>
        )}
      </div>

      {/* up-swipe target hint */}
      <div ref={unsureRef} style={{ textAlign: "center", margin: "10px 0 2px" }}>
        <button onClick={() => commit("unsure")} style={{
          ...unsureBtn, ...(armed === "unsure" ? { background: "#475569", color: "#fff", transform: "scale(1.06)" } : {}),
        }}>🤷 Unsure / genuinely ambiguous</button>
      </div>

      {/* SEMICIRCLE OF BINS */}
      <div style={{ position: "relative", height: 168, marginTop: 6 }}>
        {BINS.map((b, i) => {
          // lower semicircle: angle 180°→0° in 45° steps, y downward
          const ang = (180 - i * 45) * (Math.PI / 180);
          const R = 46; // percent-ish radius driver
          const cx = 50 + Math.cos(ang) * 42;       // % of width
          const cy = Math.sin(ang) * R + 8;          // px-ish down (scaled below)
          const isArmed = armed === b.value;
          return (
            <div
              key={b.value}
              ref={(el) => { binRefs.current[i] = el; }}
              onClick={() => commit(b.value)}
              style={{
                position: "absolute", left: `${cx}%`, top: cy + 8, transform: `translate(-50%,0) scale(${isArmed ? 1.18 : 1})`,
                width: 92, marginLeft: -46, textAlign: "center", cursor: "pointer",
                transition: "transform .12s ease, box-shadow .12s ease",
                background: isArmed ? b.color : "#fff",
                color: isArmed ? "#fff" : b.color,
                border: `2px solid ${b.color}`, borderRadius: 12, padding: "8px 4px",
                boxShadow: isArmed ? `0 0 0 4px ${b.color}33, 0 8px 20px ${b.color}55` : "0 2px 6px rgba(2,8,23,.06)",
                fontWeight: 700, fontSize: 12, zIndex: isArmed ? 4 : 2,
              }}
            >
              <div style={{ fontSize: 18 }}>{b.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{b.value}</div>
              <div style={{ fontSize: 10, lineHeight: 1.1 }}>{b.short}</div>
            </div>
          );
        })}
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional note…"
        style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 15 }} />
      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
        drag into a bin · swipe up = unsure · or tap · keys 1–5 / u · ⌫ back
      </div>
    </Shell>
  );
}

function FlashCard({ bucket }: { bucket: Bucket }) {
  const b = typeof bucket === "number" ? binByValue(bucket) : null;
  const color = b ? b.color : "#475569";
  const emoji = b ? b.emoji : "🤷";
  const label = b ? b.label : "Unsure";
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: 18, background: color, color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: `0 10px 40px ${color}88`, animation: "tinderPop .25s ease", zIndex: 6, overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {["💕", "✨", "🔥", "💖", "⭐"].map((e, i) => (
          <span key={i} style={{
            position: "absolute", left: `${12 + i * 18}%`, top: "20%", fontSize: 22,
            animation: `tinderFloat 1.2s ease ${i * 0.08}s forwards`,
          }}>{e}</span>
        ))}
      </div>
      <div style={{ fontSize: 46 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{label}</div>
      {typeof bucket === "number" && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>bucket {bucket}</div>}
      <style>{`
        @keyframes tinderPop { from { transform: scale(.8); opacity: .4 } to { transform: scale(1); opacity: 1 } }
        @keyframes tinderFloat { from { transform: translateY(0); opacity: 1 } to { transform: translateY(-70px); opacity: 0 } }
      `}</style>
    </div>
  );
}

function LabelCard({ text }: { text: string }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "14px 12px", textAlign: "center", fontSize: 19, fontWeight: 600, color: "#0f172a" }}>
      {text}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#fff5f7 0%,#f8fafc 40%)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "20px 16px 48px", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        {children}
      </div>
    </div>
  );
}

const charCard: React.CSSProperties = {
  display: "flex", alignItems: "center", width: "100%", padding: "14px 16px", marginBottom: 14,
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, cursor: "pointer",
  boxShadow: "0 4px 14px rgba(2,8,23,.06)",
};
const secondaryBtn: React.CSSProperties = {
  width: "100%", padding: "14px", marginBottom: 10, fontSize: 16, fontWeight: 600,
  background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = { background: "none", border: "none", color: "#64748b", fontSize: 15, cursor: "pointer", padding: 8, width: "100%" };
const backBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#f1f5f9" : "#0f172a", color: disabled ? "#cbd5e1" : "#fff",
  border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 15, fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
});
const unsureBtn: React.CSSProperties = {
  background: "#fff", color: "#475569", border: "2px dashed #94a3b8", borderRadius: 999,
  padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .12s",
};
