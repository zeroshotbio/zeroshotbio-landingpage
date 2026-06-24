"use client";

// Cell Type Tinder — mobile-first one-pair-per-screen binning.
// Blinding: the two labels are shown as neutral cards (label_A / label_B); which is the
// model prediction vs ground truth is never revealed, and the machine's verdict is never loaded.
// Both raters bin the SAME full set independently. Every verdict POSTs the full verdicts map
// (resume-safe; no merge races) to DynamoDB.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pair = {
  pair_id: string;
  label_A: string;
  label_B: string;
  tier: string;
  tissue_area: string;
};
type Bucket = 1 | 2 | 3 | 4 | 5 | "unsure";
type Verdict = { bucket: Bucket; note?: string; ts: number };
type VerdictMap = Record<string, Verdict>;

const RATERS = ["Patrick", "Harsha"];
const BUCKETS: { value: Bucket; label: string; color: string }[] = [
  { value: 1, label: "Exactly the same", color: "#16a34a" },
  { value: 2, label: "Basically the same", color: "#65a30d" },
  { value: 3, label: "Partially related", color: "#ca8a04" },
  { value: 4, label: "Barely related", color: "#ea580c" },
  { value: 5, label: "Totally different", color: "#dc2626" },
];
const TIER_LABEL: Record<string, string> = {
  germ_layer: "germ layer",
  tissue: "tissue",
  cell_type_broad: "cell type — broad",
  cell_type_sub: "cell type — fine",
};

export default function TinderClient() {
  const [rater, setRater] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Load pairs once (already shuffled in the file; both raters see the same order).
  useEffect(() => {
    fetch("/cell_type_tinder/pairs.json")
      .then((r) => r.json())
      .then((p: Pair[]) => setPairs(p))
      .catch(() => setPairs([]));
  }, []);

  // On rater select: load their saved verdicts, resume at first un-binned pair.
  const pickRater = useCallback(
    async (name: string) => {
      setRater(name);
      setLoading(true);
      try {
        const r = await fetch(`/api/cell_type_tinder?user=${name.toLowerCase()}`);
        const j = await r.json();
        const v: VerdictMap = j?.verdicts || {};
        setVerdicts(v);
        const firstUndone = (pairsRef.current || []).findIndex((p) => !v[p.pair_id]);
        setIdx(firstUndone < 0 ? (pairsRef.current?.length || 0) : firstUndone);
      } catch {
        setVerdicts({});
        setIdx(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );
  // keep a ref to pairs so pickRater can read them without being re-created
  const pairsRef = useRef<Pair[]>([]);
  useEffect(() => {
    pairsRef.current = pairs;
  }, [pairs]);

  const cur = pairs[idx];
  const decided = Object.keys(verdicts).length;
  const total = pairs.length;
  const done = idx >= total && total > 0;

  const persist = useCallback(
    async (next: VerdictMap) => {
      if (!rater) return;
      setSaveState("saving");
      try {
        const r = await fetch("/api/cell_type_tinder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user: rater.toLowerCase(), verdicts: next }),
        });
        setSaveState(r.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [rater]
  );

  const submit = useCallback(
    (bucket: Bucket) => {
      if (!cur) return;
      const next = {
        ...verdicts,
        [cur.pair_id]: { bucket, note: note.trim() || undefined, ts: Date.now() },
      };
      setVerdicts(next);
      setNote("");
      setDrag(null);
      setIdx((i) => i + 1);
      void persist(next); // persist after EVERY verdict
    },
    [cur, verdicts, note, persist]
  );

  const goBack = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    setNote("");
    setDrag(null);
  }, []);

  // Swipe: horizontal drag distance maps to bucket 1..5 on release; vertical-up = unsure.
  const onStart = (x: number, y: number) => (startRef.current = { x, y });
  const onMove = (x: number, y: number) => {
    if (!startRef.current) return;
    setDrag({ dx: x - startRef.current.x, dy: y - startRef.current.y });
  };
  const onEnd = () => {
    if (!startRef.current || !drag) {
      startRef.current = null;
      return;
    }
    const { dx, dy } = drag;
    startRef.current = null;
    if (dy < -90 && Math.abs(dy) > Math.abs(dx)) {
      submit("unsure");
      return;
    }
    if (Math.abs(dx) < 60) {
      setDrag(null);
      return;
    }
    // map drag position across the screen width to one of 5 buckets
    const w = typeof window !== "undefined" ? window.innerWidth : 360;
    const frac = Math.min(1, Math.max(0, (dx + w / 2) / w));
    const b = (Math.min(4, Math.max(0, Math.round(frac * 4))) + 1) as 1 | 2 | 3 | 4 | 5;
    submit(b);
  };

  // keyboard 1-5 + u (desktop convenience)
  useEffect(() => {
    if (!rater || done) return;
    const h = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "5") submit(Number(e.key) as Bucket);
      else if (e.key.toLowerCase() === "u") submit("unsure");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rater, done, submit]);

  // ---------- rater select ----------
  if (!rater) {
    return (
      <Shell>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Cell Type Tinder</h1>
        <p style={{ color: "#475569", marginBottom: 24 }}>
          Bin each label pair: how close are the two cell-type labels? Who are you?
        </p>
        {RATERS.map((n) => (
          <button key={n} onClick={() => pickRater(n)} style={primaryBtn}>
            {n}
          </button>
        ))}
      </Shell>
    );
  }

  if (loading || total === 0) {
    return (
      <Shell>
        <p style={{ color: "#475569" }}>Loading pairs…</p>
      </Shell>
    );
  }

  // ---------- done ----------
  if (done) {
    return (
      <Shell>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>All done, {rater}! 🎉</h2>
        <p style={{ color: "#475569", margin: "12px 0 24px" }}>
          You binned {decided} / {total} pairs. Verdicts are saved.
        </p>
        <button onClick={() => setIdx(0)} style={secondaryBtn}>
          Review from the start
        </button>
        <a href="/api/cell_type_tinder?action=export" style={{ ...secondaryBtn, display: "block", textDecoration: "none", textAlign: "center" }}>
          Export all verdicts (CSV)
        </a>
        <button onClick={() => setRater(null)} style={ghostBtn}>
          Switch rater
        </button>
      </Shell>
    );
  }

  const prev = verdicts[cur.pair_id];
  const tilt = drag ? Math.max(-12, Math.min(12, drag.dx / 12)) : 0;

  return (
    <Shell>
      {/* header / progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setRater(null)} style={ghostSmall}>{rater} ▾</button>
        <div style={{ fontSize: 14, color: "#64748b" }}>
          {idx + 1} / {total} · {decided} binned ·{" "}
          <span style={{ color: saveState === "error" ? "#dc2626" : "#16a34a" }}>
            {saveState === "saving" ? "saving…" : saveState === "error" ? "save failed" : "saved"}
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 18 }}>
        <div style={{ height: 6, width: `${(decided / total) * 100}%`, background: "#0ea5e9", borderRadius: 3 }} />
      </div>

      {/* swipe card */}
      <div
        onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX, e.clientY)}
        onMouseMove={(e) => startRef.current && onMove(e.clientX, e.clientY)}
        onMouseUp={onEnd}
        onMouseLeave={() => { startRef.current = null; setDrag(null); }}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          boxShadow: "0 8px 30px rgba(2,8,23,.08)",
          padding: "26px 18px",
          transform: `translateX(${drag?.dx ?? 0}px) rotate(${tilt}deg)`,
          transition: drag ? "none" : "transform .18s ease",
          touchAction: "pan-y",
          userSelect: "none",
        }}
      >
        <div style={{ textAlign: "center", fontSize: 12, letterSpacing: 1, color: "#94a3b8", textTransform: "uppercase" }}>
          {TIER_LABEL[cur.tier] || cur.tier} · {cur.tissue_area || "—"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "20px 0" }}>
          <LabelCard text={cur.label_A} />
          <div style={{ textAlign: "center", color: "#cbd5e1", fontWeight: 700 }}>vs</div>
          <LabelCard text={cur.label_B} />
        </div>
        {prev && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#0ea5e9" }}>
            previously: {typeof prev.bucket === "number" ? BUCKETS[prev.bucket - 1].label : "unsure"}
          </div>
        )}
      </div>

      {/* bucket buttons */}
      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {BUCKETS.map((b) => (
          <button
            key={b.value}
            onClick={() => submit(b.value)}
            style={{
              ...bucketBtn,
              borderColor: b.color,
              color: b.color,
            }}
          >
            <span style={{ fontWeight: 800, marginRight: 8 }}>{b.value}</span> {b.label}
          </button>
        ))}
        <button onClick={() => submit("unsure")} style={{ ...bucketBtn, borderColor: "#94a3b8", color: "#475569", borderStyle: "dashed" }}>
          🤷 Unsure / genuinely ambiguous
        </button>
      </div>

      {/* optional note */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="optional note…"
        style={{ width: "100%", marginTop: 12, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 15 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button onClick={goBack} disabled={idx === 0} style={ghostBtn}>← back</button>
        <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>
          swipe →/← to bin, ↑ for unsure · keys 1-5 / u
        </span>
      </div>
    </Shell>
  );
}

function LabelCard({ text }: { text: string }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "16px 14px", textAlign: "center", fontSize: 20, fontWeight: 600, color: "#0f172a", minHeight: 28 }}>
      {text}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "24px 16px 48px", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        {children}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "block", width: "100%", padding: "16px", marginBottom: 12, fontSize: 18, fontWeight: 700,
  background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  width: "100%", padding: "14px", marginBottom: 10, fontSize: 16, fontWeight: 600,
  background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "none", border: "none", color: "#64748b", fontSize: 15, cursor: "pointer", padding: 8,
};
const ghostSmall: React.CSSProperties = { ...ghostBtn, fontWeight: 700, color: "#0f172a", padding: 0 };
const bucketBtn: React.CSSProperties = {
  width: "100%", padding: "15px 14px", fontSize: 16, fontWeight: 600, textAlign: "left",
  background: "#fff", border: "2px solid", borderRadius: 12, cursor: "pointer",
};
