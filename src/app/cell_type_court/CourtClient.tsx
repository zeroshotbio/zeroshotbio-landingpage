"use client";

// Cell Type Court ⚖️ — successor to Cell Type Tinder.
// The old Tinder captured ONE binary judgment per card. Court separates the TWO expert
// judgments that diagnose different failures, so we can fix the right thing:
//
//   ①  PLACEMENT (resolver check) — "the labeller said X; we filed it under the standard term Y.
//       Same cell type, biologically?"  Yes / Close-ish / No (+ optional "what should it be").
//       Certifies whether our resolver landed a messy label on the right ontology node.
//
//   ②  CLOSENESS (score check) — for cards whose placement is ALREADY confirmed right, show two
//       correctly-placed labels and ask, in plain biology, "how close are these two?"
//       Same thing / Near neighbor / Unrelated.  Certifies whether our distance score is fair,
//       independent of placement.
//
// HARD RULE: the expert never sees a number — no cosine, no "0.667", no "is this score correct".
// They judge labels and biological relationships; we translate their call into whether our number
// was right. Every term always carries its plain-English gloss so they judge biology, not jargon.
//
// FRONT-END SHELL: no backend, no pipeline coupling, no model calls. Cards are read from
// /cell_type_court/cards.json (schema below); verdicts are held in localStorage and exportable as
// JSON/CSV. The real cards and a persistence sink are a later handoff.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---- card schema (the ONLY contract with the pipeline) -------------------------------------
type QType = "placement" | "scoring";
type Card = {
  cluster_id: string;
  dataset: string;
  pred_label: string;
  pred_gloss: string;
  matched_term: string;
  matched_gloss: string;
  question_type: QType;
  gt_label?: string;   // scoring cards only
  gt_gloss?: string;   // scoring cards only
};

type PlacementAns = "same" | "close" | "no";
type ScoringAns = "same" | "near" | "unrelated";
type Verdict = {
  question_type: QType;
  answer: PlacementAns | ScoringAns | "abstain";
  correction?: string; // placement only — expert's "what should it have been"
  ts: number;
};
type VerdictMap = Record<string, Verdict>;

const cardKey = (c: Card) => `${c.dataset}::${c.cluster_id}::${c.question_type}`;
const RATERS = ["Patrick", "Harsha", "Steven", "Creighton", "Darien"];
const lsKey = (r: string) => `court_verdicts_${r.toLowerCase()}`;

// Docket palettes — kept visually distinct so the expert always knows which of the two jobs
// they're doing on any given card.
const DOCKET = {
  placement: { tag: "① PLACEMENT", color: "#6366f1", tint: "#eef2ff",
    q: "Did we file this label under the right cell type?" },
  scoring: { tag: "② CLOSENESS", color: "#0d9488", tint: "#ecfdf5",
    q: "How close are these two cell types, biologically?" },
} as const;

const PLACEMENT_OPTS: { key: PlacementAns; k: string; emoji: string; label: string; color: string }[] = [
  { key: "same", k: "1", emoji: "✅", label: "Yes — same cell type", color: "#16a34a" },
  { key: "close", k: "2", emoji: "🟡", label: "Close-ish — related but not it", color: "#ca8a04" },
  { key: "no", k: "3", emoji: "❌", label: "No — wrong cell type", color: "#dc2626" },
];
const SCORING_OPTS: { key: ScoringAns; k: string; emoji: string; label: string; color: string }[] = [
  { key: "same", k: "1", emoji: "💚", label: "Same thing", color: "#16a34a" },
  { key: "near", k: "2", emoji: "🟡", label: "Near neighbor", color: "#ca8a04" },
  { key: "unrelated", k: "3", emoji: "❌", label: "Unrelated", color: "#dc2626" },
];

// ---- pixel-art characters (reused from Cell Type Tinder for a familiar feel) ---------------
type CharDef = { grid: string[]; pal: Record<string, string> };
const CHARACTERS: Record<string, CharDef> = {
  Patrick: { grid: ["....Y.....","...PPP....","..PPPPP...",".PPPPPPP..","PPPPPPPPP.","...SSSS..O","...SEES..T","..WWWWWW.T","..RRRRRRRT",".RRRRRRR.T",".R.RR.RR.T",".RR..RR..T"],
    pal: { P: "#7c3aed", S: "#fcd9b6", E: "#1f2937", W: "#e5e7eb", R: "#2563eb", Y: "#fbbf24", O: "#fbbf24", T: "#92400e" } },
  Harsha: { grid: ["..MMMMMM..",".MMMMMMMM.",".MMMMMMMM.",".M.MMMM.M.",".DDDDDDDD.",".MMMMMMMM.","..MMMMMM.W","..AAAAAAGW",".AAAAAAAHW",".A.AAAA..W",".AA..AA..W",".AA..AA..."],
    pal: { M: "#94a3b8", D: "#1f2937", A: "#475569", W: "#e5e7eb", G: "#fbbf24", H: "#92400e" } },
  Steven: { grid: ["..GGGG....",".GGGGGG.B.",".GGSSGG.Bb",".GSEESG.Bb",".GSSSSG.Bb","..GGGG..Bb","..TTTT..Bb",".TTTTTT.Bb",".T.TT.T.Bb",".TTTTTT.B.",".TT..TT...",".TT..TT..."],
    pal: { G: "#15803d", S: "#fcd9b6", E: "#1f2937", T: "#a16207", B: "#7c3a0e", b: "#cbd5e1" } },
  Creighton: { grid: ["..Y.Y.Y...","..YYYYY...","..YgYgY...","...SSSS...","...SEES...","...SSSS...","..CCCCCC..","..RRRRRR.O",".RRRRRRR.T",".R.RR.R.RT",".RR..RR..T",".RR..RR..."],
    pal: { Y: "#fbbf24", g: "#dc2626", S: "#fcd9b6", E: "#1f2937", C: "#f1f5f9", R: "#b91c1c", O: "#fbbf24", T: "#a16207" } },
  Darien: { grid: ["h........h",".h......h.",".hMMMMMMh.","..MMMMMM..","..MMMMMM..","...SSSS...","...SEES...","...SbbS...","..FFFFFF.X",".FFFFFFFXX",".F.FF.F.TX",".FF..FF.T."],
    pal: { h: "#9ca3af", M: "#6b7280", S: "#fcd9b6", E: "#1f2937", b: "#92400e", F: "#78350f", X: "#cbd5e1", T: "#a16207" } },
};
function PixelAvatar({ name, px = 7 }: { name: string; px?: number }) {
  const c = CHARACTERS[name] || CHARACTERS.Patrick;
  const rects: React.ReactNode[] = [];
  c.grid.forEach((row, y) => row.split("").forEach((ch, x) => {
    if (ch === ".") return;
    rects.push(<rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={c.pal[ch] || "#000"} />);
  }));
  const w = Math.max(...c.grid.map((r) => r.length));
  return (
    <svg width={w * px} height={c.grid.length * px} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      {rects}
    </svg>
  );
}

export default function CourtClient() {
  const [rater, setRater] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [idx, setIdx] = useState(0);
  const [correction, setCorrection] = useState("");
  const [flash, setFlash] = useState(false);
  const cardsRef = useRef<Card[]>([]);

  useEffect(() => {
    fetch("/cell_type_court/cards.json").then((r) => r.json()).then((c: Card[]) => setCards(c)).catch(() => {});
  }, []);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  const persist = useCallback((next: VerdictMap, who?: string) => {
    const name = who || rater;
    if (!name || typeof window === "undefined") return;
    localStorage.setItem(lsKey(name), JSON.stringify(next));
  }, [rater]);

  const pickRater = useCallback((name: string, fromSelection = false) => {
    setRater(name);
    setShowIntro(fromSelection);
    if (typeof window !== "undefined") localStorage.setItem("court_last_rater", name);
    let local: VerdictMap = {};
    try { local = JSON.parse(localStorage.getItem(lsKey(name)) || "{}"); } catch {}
    setVerdicts(local);
    const first = (cardsRef.current || []).findIndex((c) => !local[cardKey(c)]);
    setIdx(first < 0 ? (cardsRef.current?.length || 0) : first);
  }, []);

  useEffect(() => {
    const last = typeof window !== "undefined" ? localStorage.getItem("court_last_rater") : null;
    if (last && RATERS.includes(last) && cardsRef.current.length) pickRater(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  const cur = cards[idx];
  const total = cards.length;
  const decided = useMemo(() => cards.filter((c) => verdicts[cardKey(c)]).length, [cards, verdicts]);
  const done = total > 0 && idx >= total;

  // load any existing correction text when moving to a card (resume / back / re-judge)
  useEffect(() => {
    const v = cur ? verdicts[cardKey(cur)] : undefined;
    setCorrection(v?.correction || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, cur ? cardKey(cur) : ""]);

  const record = useCallback((answer: Verdict["answer"]) => {
    if (!cur || flash) return;
    const entry: Verdict = {
      question_type: cur.question_type, answer, ts: Date.now(),
      ...(cur.question_type === "placement" && correction.trim() ? { correction: correction.trim() } : {}),
    };
    const next = { ...verdicts, [cardKey(cur)]: entry };
    setVerdicts(next);
    persist(next);
    setFlash(true);
    window.setTimeout(() => { setFlash(false); setIdx((i) => i + 1); }, 650);
  }, [cur, flash, correction, verdicts, persist]);

  const goBack = useCallback(() => { if (!flash) setIdx((i) => Math.max(0, i - 1)); }, [flash]);

  // keyboard: 1/2/3 pick, S/0/space skip, ← back
  useEffect(() => {
    if (!rater || showIntro || done || !cur) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return; // don't steal keys while typing a correction
      const opts = cur.question_type === "placement" ? PLACEMENT_OPTS : SCORING_OPTS;
      if (e.key === "1") record(opts[0].key);
      else if (e.key === "2") record(opts[1].key);
      else if (e.key === "3") record(opts[2].key);
      else if (e.key === "0" || e.key.toLowerCase() === "s" || e.key === " ") { e.preventDefault(); record("abstain"); }
      else if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rater, showIntro, done, cur, record, goBack]);

  // ---------------- LANDING (rater select) ----------------
  if (!rater) {
    return (
      <Shell>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Cell Type Court <span>⚖️</span></h1>
          <p style={{ color: "#64748b", marginTop: 6 }}>Two verdicts, one bench: placement ① &amp; closeness ②</p>
        </div>
        <p style={{ color: "#475569", textAlign: "center", margin: "10px 0 22px", fontSize: 14 }}>Who&apos;s on the bench today?</p>
        {RATERS.map((n) => (
          <button key={n} onClick={() => pickRater(n, true)} style={charCard}>
            <PixelAvatar name={n} />
            <div style={{ flex: 1, textAlign: "left", marginLeft: 14 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#0f172a" }}>{n}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>tap to start / resume</div>
            </div>
            <span style={{ fontSize: 22, marginLeft: 8 }}>›</span>
          </button>
        ))}
      </Shell>
    );
  }

  if (total === 0) return <Shell><p style={{ color: "#475569" }}>Loading cards… ⚖️</p></Shell>;

  if (showIntro) return <IntroScreen rater={rater} onStart={() => setShowIntro(false)} onBack={() => { setRater(null); setShowIntro(false); }} />;

  // ---------------- DONE ----------------
  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56 }}>⚖️🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Court adjourned, {rater}!</h2>
          <p style={{ color: "#475569", margin: "12px 0 24px" }}>You judged {decided} / {total} cards. All saved locally.</p>
        </div>
        <button onClick={() => downloadJSON(rater, cards, verdicts)} style={{ ...primaryBtn, marginBottom: 10 }}>⬇️ Export verdicts (JSON)</button>
        <button onClick={() => downloadCSV(rater, cards, verdicts)} style={secondaryBtn}>⬇️ Export verdicts (CSV)</button>
        <button onClick={() => setIdx(0)} style={secondaryBtn}>Review from the start</button>
        <button onClick={() => { localStorage.removeItem("court_last_rater"); setRater(null); }} style={ghostBtn}>Switch judge</button>
      </Shell>
    );
  }

  const d = DOCKET[cur.question_type];
  const existing = verdicts[cardKey(cur)];

  return (
    <Shell>
      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={goBack} disabled={idx === 0} style={backBtn(idx === 0)}>‹ Back</button>
        <button onClick={() => setRater(null)} title="switch judge" style={charChip}>
          <PixelAvatar name={rater} px={4} />
          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{rater}</span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>⇄</span>
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        <span>card <b style={{ color: "#0f172a" }}>{idx + 1}</b> of {total} · {decided} judged</span>
        {existing && <span style={{ color: "#16a34a" }}>✓ answered — editing</span>}
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: 12 }}>
        <div style={{ height: 6, width: `${(decided / total) * 100}%`, background: d.color, borderRadius: 3, transition: "width .3s" }} />
      </div>

      {/* docket banner — which of the two jobs this card is */}
      <div style={{ background: d.tint, border: `1px solid ${d.color}33`, borderRadius: 12, padding: "8px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: d.color }}>{d.tag}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{d.q}</div>
      </div>

      {/* provenance — visible but unobtrusive */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Prov k="dataset" v={cur.dataset} />
        <Prov k="cluster" v={cur.cluster_id} />
      </div>

      {flash ? (
        <FlashCard color={d.color} />
      ) : cur.question_type === "placement" ? (
        <PlacementBody card={cur} correction={correction} setCorrection={setCorrection} onPick={record} />
      ) : (
        <ScoringBody card={cur} onPick={record} />
      )}

      {/* abstention — records "not sure", never forces a call */}
      {!flash && (
        <button onClick={() => record("abstain")} style={{ ...unsureBtn, width: "100%", marginTop: 12,
          ...(existing?.answer === "abstain" ? { background: "#475569", color: "#fff", borderStyle: "solid" } : {}) }}>
          🤷 Not sure — skip <span style={{ opacity: 0.6, fontWeight: 600 }}>(S)</span>
        </button>
      )}
    </Shell>
  );
}

// ---------------- PLACEMENT screen (resolver check) ----------------
function PlacementBody({ card, correction, setCorrection, onPick }: {
  card: Card; correction: string; setCorrection: (s: string) => void; onPick: (a: PlacementAns) => void;
}) {
  return (
    <>
      <TermCard tag="THE LABELLER SAID" tagColor="#6366f1" term={card.pred_label} gloss={card.pred_gloss} />
      <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700, margin: "6px 0" }}>
        …we filed it under ↓
      </div>
      <TermCard tag="STANDARD TERM WE MATCHED IT TO" tagColor="#0f172a" term={card.matched_term} gloss={card.matched_gloss} strong />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {PLACEMENT_OPTS.map((o) => <OptButton key={o.key} o={o} onClick={() => onPick(o.key)} />)}
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>What should it have been? <span style={{ fontWeight: 500, color: "#94a3b8" }}>(optional)</span></label>
        <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={2}
          placeholder="e.g. crista support cell — an inner-ear supporting cell, not a cortical neuron"
          style={{ width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 13, borderRadius: 10, border: "1px solid #e2e8f0",
            resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
    </>
  );
}

// ---------------- CLOSENESS screen (score check) ----------------
// Both labels are ALREADY placement-confirmed upstream. Shown as neutral A/B cards (which side is
// the model's prediction is de-emphasized) so the expert judges the biological relationship, not
// "was the model right". No number is ever shown.
function ScoringBody({ card, onPick }: { card: Card; onPick: (a: ScoringAns) => void }) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        <TermCard tag="LABEL A" tagColor="#0d9488" term={card.pred_label} gloss={card.pred_gloss} strong flex />
        <div style={{ display: "flex", alignItems: "center", color: "#0d9488", fontWeight: 800, fontSize: 13 }}>vs</div>
        <TermCard tag="LABEL B" tagColor="#0d9488" term={card.gt_label || card.matched_term} gloss={card.gt_gloss || card.matched_gloss} strong flex />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {SCORING_OPTS.map((o) => <OptButton key={o.key} o={o} onClick={() => onPick(o.key)} />)}
      </div>
    </>
  );
}

function OptButton({ o, onClick }: { o: { k: string; emoji: string; label: string; color: string }; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 14px", textAlign: "left",
      background: "#fff", border: `2px solid ${o.color}`, borderRadius: 12, cursor: "pointer",
      fontSize: 15, fontWeight: 700, color: "#0f172a", boxShadow: "0 2px 6px rgba(2,8,23,.05)",
    }}>
      <span style={{ fontSize: 20 }}>{o.emoji}</span>
      <span style={{ flex: 1 }}>{o.label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: o.color, border: `1px solid ${o.color}55`, borderRadius: 6, padding: "1px 7px" }}>{o.k}</span>
    </button>
  );
}

// One term shown as name + plain-English gloss. The gloss is the point: the expert judges biology.
function TermCard({ tag, tagColor, term, gloss, strong, flex }: {
  tag: string; tagColor: string; term: string; gloss: string; strong?: boolean; flex?: boolean;
}) {
  return (
    <div style={{ flex: flex ? 1 : undefined, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px", marginBottom: flex ? 0 : 2 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: tagColor, textTransform: "uppercase" }}>{tag}</div>
      <div style={{ fontSize: strong ? 17 : 15, fontWeight: 800, color: "#0f172a", marginTop: 3, lineHeight: 1.2, overflowWrap: "anywhere" }}>{term}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.35, fontStyle: "italic", overflowWrap: "anywhere" }}>{gloss}</div>
    </div>
  );
}

function Prov({ k, v }: { k: string; v: string }) {
  return (
    <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 999, padding: "2px 9px" }}>
      <span style={{ color: "#94a3b8" }}>{k}</span> <b style={{ color: "#0f172a" }}>{v}</b>
    </span>
  );
}

function FlashCard({ color }: { color: string }) {
  return (
    <div style={{ minHeight: 140, borderRadius: 16, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 40, boxShadow: "0 10px 30px rgba(2,8,23,.25)", animation: "courtPop .2s ease" }}>
      ✅
      <style>{`@keyframes courtPop { from { transform: scale(.85); opacity:.5 } to { transform: scale(1); opacity:1 } }`}</style>
    </div>
  );
}

function IntroScreen({ rater, onStart, onBack }: { rater: string; onStart: () => void; onBack: () => void }) {
  const block = (d: { tag: string; color: string; tint: string; q: string }, body: string) => (
    <div style={{ background: d.tint, border: `1px solid ${d.color}33`, borderRadius: 14, padding: "12px 14px", textAlign: "left" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: d.color }}>{d.tag}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "3px 0 5px" }}>{d.q}</div>
      <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button onClick={onBack} style={backBtn(false)}>‹ Back</button>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PixelAvatar name={rater} px={4} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{rater}</span>
        </span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", margin: "6px 0 4px" }}>Two verdicts, never a number ⚖️</h2>
      <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, textAlign: "center", margin: "0 0 14px" }}>
        Each card asks you <b>one</b> of two questions. The banner tells you which. You judge the
        <b> biology</b> — every term comes with a plain-English gloss. We do the arithmetic.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {block(DOCKET.placement, "The labeller produced a messy label; we snapped it to a standard ontology term. You certify whether that snap landed on the right cell type. Wrong here means our resolver misfiled it — a different bug than a bad score.")}
        {block(DOCKET.scoring, "Two already-correctly-placed labels. You say how close they are in plain biology — same thing, near neighbor, or unrelated. This certifies whether our distance score is fair, independent of placement.")}
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "12px 0 0" }}>
        Keys: <b>1 · 2 · 3</b> to answer · <b>S</b> to skip · <b>←</b> back
      </p>
      <button onClick={onStart} style={{ ...primaryBtn, marginTop: 14 }}>Take the bench →</button>
    </Shell>
  );
}

// ---- export helpers (local only; no backend) ------------------------------------------------
function rows(cards: Card[], v: VerdictMap) {
  return cards.filter((c) => v[cardKey(c)]).map((c) => ({
    dataset: c.dataset, cluster_id: c.cluster_id, question_type: c.question_type,
    pred_label: c.pred_label, matched_term: c.matched_term, gt_label: c.gt_label || "",
    answer: v[cardKey(c)].answer, correction: v[cardKey(c)].correction || "", ts: v[cardKey(c)].ts,
  }));
}
function download(name: string, mime: string, data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function downloadJSON(rater: string, cards: Card[], v: VerdictMap) {
  download(`court_${rater.toLowerCase()}.json`, "application/json", JSON.stringify({ rater, verdicts: rows(cards, v) }, null, 2));
}
function downloadCSV(rater: string, cards: Card[], v: VerdictMap) {
  const rs = rows(cards, v);
  const cols = ["dataset", "cluster_id", "question_type", "pred_label", "matched_term", "gt_label", "answer", "correction", "ts"];
  const esc = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const csv = [["rater", ...cols].join(","), ...rs.map((r) => [rater, ...cols.map((c) => esc((r as Record<string, unknown>)[c]))].join(","))].join("\n");
  download(`court_${rater.toLowerCase()}.csv`, "text/csv", csv);
}

// ---- shared chrome (matches Cell Type Tinder) ----------------------------------------------
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#eef4ff 0%,#f8fafc 40%)", display: "flex", justifyContent: "center" }}>
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
const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "14px", fontSize: 17, fontWeight: 800, color: "#fff",
  background: "#6366f1", border: "none", borderRadius: 12, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  width: "100%", padding: "13px", marginBottom: 10, fontSize: 15, fontWeight: 600,
  background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = { background: "none", border: "none", color: "#64748b", fontSize: 15, cursor: "pointer", padding: 8, width: "100%" };
const backBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#f1f5f9" : "#0f172a", color: disabled ? "#cbd5e1" : "#fff",
  border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
});
const unsureBtn: React.CSSProperties = {
  background: "#fff", color: "#475569", border: "2px dashed #94a3b8", borderRadius: 999,
  padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const charChip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e2e8f0",
  borderRadius: 999, padding: "4px 12px 4px 6px", cursor: "pointer", boxShadow: "0 2px 6px rgba(2,8,23,.06)",
};
