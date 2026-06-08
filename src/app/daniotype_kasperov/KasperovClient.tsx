"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
const PAPER = "#f6f4f2";
const INK = "#2b2b2b";
const ACCENT = "#0e7490";
const STORAGE_KEY = "daniotype_kasperov_v3";
const RESULTS_KEY = "daniotype_kasperov_results"; // full run history: transcripts + markers + confidence
const DATA_URL = "/daniotype_kasperov/minifin_umap.json";

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Marker = { g: string; l2fc?: number; p1?: number; p2?: number; note?: string; via?: AgentMode; dir?: "up" | "down" };
interface Cluster {
  id: string;
  label: string;
  nCells: number;
  color: string;
  cx: number;
  cy: number;
  degsUp: string[];
  markers: Marker[];
  markersDown: Marker[];
  points: Pt[];
  bounds: { minx: number; maxx: number; miny: number; maxy: number };
}

interface AtlasMeta {
  source: string;
  totalCells: number;
  nClusters: number;
}

function paletteColor(i: number, n: number) {
  const h = Math.round((i * 360) / n + (i % 2 ? 180 / n : 0)) % 360;
  const s = 60 + (i % 3) * 9;
  const l = 46 + (i % 2) * 9;
  return `hsl(${h} ${s}% ${l}%)`;
}

// confidence % → a subtle red→amber→green heat tint for the world-map cards.
function confColor(pct: number): { bg: string; fg: string } {
  const p = Math.max(0, Math.min(100, pct));
  const h = (p / 100) * 130; // 0% = red, 100% = green
  return { bg: `hsl(${h} 72% 92%)`, fg: `hsl(${h} 55% 27%)` };
}

// ---------------------------------------------------------------------------
// Load + shape the real MiniFin atlas asset
// ---------------------------------------------------------------------------
function useAtlas() {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [meta, setMeta] = useState<AtlasMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`asset ${r.status}`);
        return r.json();
      })
      .then((d: any) => {
        if (!alive) return;
        const n = d.clusters.length;
        const cs: Cluster[] = d.clusters.map((c: any, i: number) => ({
          id: c.id,
          label: c.label,
          nCells: c.nCells,
          color: paletteColor(i, n),
          cx: c.cx,
          cy: c.cy,
          degsUp: c.degsUp ?? [],
          markers: c.markers ?? [],
          markersDown: c.markersDown ?? [],
          points: [],
          bounds: { minx: Infinity, maxx: -Infinity, miny: Infinity, maxy: -Infinity },
        }));
        for (const [x, y, ci] of d.points as [number, number, number][]) {
          const c = cs[ci];
          if (!c) continue;
          c.points.push({ x, y });
          if (x < c.bounds.minx) c.bounds.minx = x;
          if (x > c.bounds.maxx) c.bounds.maxx = x;
          if (y < c.bounds.miny) c.bounds.miny = y;
          if (y > c.bounds.maxy) c.bounds.maxy = y;
        }
        setClusters(cs);
        setMeta({ source: d.source, totalCells: d.totalCells, nClusters: n });
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  return { clusters, meta, error };
}

// ---------------------------------------------------------------------------
// UMAP canvas — global (world map / HUD) and zoom (focused cluster)
// ---------------------------------------------------------------------------
function UmapCanvas({
  clusters,
  mode,
  colored,
  activeId,
  validated,
  width,
  height,
  onPick,
  showFocus,
}: {
  clusters: Cluster[];
  mode: "global" | "zoom";
  colored: boolean;
  activeId: string | null;
  validated: Set<string>;
  width: number;
  height: number;
  onPick?: (id: string) => void;
  showFocus?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const active = clusters.find((c) => c.id === activeId) || null;

  const transform = useMemo(() => {
    const pad = 16;
    let minx: number, maxx: number, miny: number, maxy: number;
    if (mode === "zoom" && active) {
      const ext = Math.max(active.bounds.maxx - active.bounds.minx, active.bounds.maxy - active.bounds.miny) * 0.7 + 1;
      minx = active.cx - ext;
      maxx = active.cx + ext;
      miny = active.cy - ext;
      maxy = active.cy + ext;
    } else {
      minx = Infinity;
      maxx = -Infinity;
      miny = Infinity;
      maxy = -Infinity;
      clusters.forEach((c) => {
        minx = Math.min(minx, c.bounds.minx);
        maxx = Math.max(maxx, c.bounds.maxx);
        miny = Math.min(miny, c.bounds.miny);
        maxy = Math.max(maxy, c.bounds.maxy);
      });
    }
    const scale = Math.min((width - 2 * pad) / (maxx - minx), (height - 2 * pad) / (maxy - miny));
    const ox = pad + (width - 2 * pad - (maxx - minx) * scale) / 2;
    const oy = pad + (height - 2 * pad - (maxy - miny) * scale) / 2;
    const toC = (x: number, y: number) => ({ cx: ox + (x - minx) * scale, cy: height - (oy + (y - miny) * scale) });
    return { scale, toC };
  }, [clusters, mode, active, width, height]);

  useEffect(() => {
    const cnv = ref.current;
    if (!cnv) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    cnv.width = width * dpr;
    cnv.height = height * dpr;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const baseR = mode === "zoom" ? 2.4 : width < 260 ? 1.0 : 1.5;
    clusters.forEach((c) => {
      const isActive = c.id === activeId;
      let fill: string;
      if (mode === "zoom") fill = isActive ? c.color : "#e3ded7";
      else fill = colored ? c.color : "#cbc5be";
      ctx.globalAlpha = mode === "zoom" ? (isActive ? 0.95 : 0.35) : colored ? 0.82 : 0.5;
      ctx.fillStyle = fill;
      const r = isActive && mode === "zoom" ? baseR + 0.6 : baseR;
      c.points.forEach((p) => {
        const { cx, cy } = transform.toC(p.x, p.y);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;

    if (mode === "global" && colored) {
      clusters.forEach((c) => {
        if (!validated.has(c.id)) return;
        const { cx, cy } = transform.toC(c.cx, c.cy);
        ctx.beginPath();
        ctx.arc(cx, cy, width < 260 ? 5 : 7, 0, Math.PI * 2);
        ctx.fillStyle = "#15803d";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx - 1, cy + 2.4);
        ctx.lineTo(cx + 3, cy - 2.4);
        ctx.stroke();
      });
    }

    if (showFocus && active) {
      const a = transform.toC(active.bounds.minx, active.bounds.maxy);
      const b = transform.toC(active.bounds.maxx, active.bounds.miny);
      const x = Math.min(a.cx, b.cx) - 3;
      const y = Math.min(a.cy, b.cy) - 3;
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, Math.abs(b.cx - a.cx) + 6, Math.abs(b.cy - a.cy) + 6);
    }
  }, [clusters, mode, colored, activeId, validated, width, height, transform, showFocus, active]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onPick || mode !== "global" || !colored) return;
    const rect = ref.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let bestId = "";
    let bestD = Infinity;
    clusters.forEach((c) => {
      const { cx, cy } = transform.toC(c.cx, c.cy);
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestD) {
        bestD = d;
        bestId = c.id;
      }
    });
    if (bestId && bestD < 45) onPick(bestId);
  }

  return (
    <canvas
      ref={ref}
      onClick={handleClick}
      style={{ width, height, display: "block", cursor: onPick && mode === "global" && colored ? "pointer" : "default", borderRadius: 10 }}
    />
  );
}

// ---------------------------------------------------------------------------
type Stage = "intro" | "map" | "personas" | "cluster";

export default function KasperovClient() {
  const { clusters, meta, error } = useAtlas();
  const [stage, setStage] = useState<Stage>("intro");
  const [revealed, setRevealed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState(0); // bumping this signals ClusterStage to run auto-pilot
  const [personasSeen, setPersonasSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // chat state lives HERE (not in ClusterStage) so it survives map↔cluster
  // navigation — ClusterStage unmounts when you return to the map.
  const [transcripts, setTranscripts] = useState<Record<string, ChatMsg[]>>({});
  const [augmented, setAugmented] = useState<Record<string, Marker[]>>({});
  const [confidence, setConfidence] = useState<Record<string, { pct: number; why: string }>>({});
  const [incorporated, setIncorporated] = useState<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  // restore the full run on first load → revisiting any cluster shows its record
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESULTS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.transcripts) setTranscripts(p.transcripts);
        if (p.augmented) setAugmented(p.augmented);
        if (p.confidence) setConfidence(p.confidence);
      }
    } catch {}
    hydratedRef.current = true;
  }, []);
  // persist (debounced); on quota overflow, fall back to markers+confidence only
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(RESULTS_KEY, JSON.stringify({ transcripts, augmented, confidence }));
      } catch {
        try {
          localStorage.setItem(RESULTS_KEY, JSON.stringify({ augmented, confidence }));
        } catch {}
      }
    }, 800);
    return () => clearTimeout(id);
  }, [transcripts, augmented, confidence]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.validated)) setValidated(new Set(p.validated));
        if (p.labels && typeof p.labels === "object") setLabels(p.labels);
        // personasSeen is intentionally NOT persisted — the primer shows once per
        // page load (reliably present each visit, not nagging within a session).
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ validated: Array.from(validated), labels }));
    } catch {}
  }, [validated, labels, loaded]);

  function setLabel(id: string, label: string) {
    setLabels((l) => ({ ...l, [id]: label }));
  }

  // download the full run — transcripts + evidence + markers + confidence + labels
  function exportResults() {
    const out = {
      exportedAt: new Date().toISOString(),
      dataset: "MiniFin",
      clusters: (clusters ?? []).map((c) => ({
        id: c.id,
        label: c.label,
        validated: validated.has(c.id),
        finalLabel: labels[c.id] ?? null,
        confidence: confidence[c.id] ?? null,
        addedMarkers: augmented[c.id] ?? [],
        transcript: transcripts[c.id] ?? [],
      })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daniotype_kasperov_results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function startAutopilot() {
    if (!clusters) return;
    // "done" == has a cell-type label (NOT merely validated — a cluster can be
    // validated by hand without a label). Land on the first unlabelled cluster.
    const first = clusters.find((c) => !labels[c.id]) ?? clusters[0];
    setActiveId(first.id);
    setStage("cluster");
    setAutoStart((n) => n + 1);
  }

  function resetRun() {
    if (typeof window !== "undefined" && !window.confirm("Clear all validations, cell-type labels, and the saved run history? This can't be undone.")) return;
    setValidated(new Set());
    setLabels({});
    setTranscripts({});
    setAugmented({});
    setConfidence({});
    setIncorporated(new Set());
    try {
      localStorage.removeItem(RESULTS_KEY);
    } catch {}
  }

  // pick a cluster → show the personalities primer once, then the chat
  function openCluster(id: string) {
    setActiveId(id);
    setStage(personasSeen ? "cluster" : "personas");
  }

  function markValidated(id: string, yes: boolean) {
    setValidated((prev) => {
      const next = new Set(prev);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (stage === "intro") return <Intro onStart={() => setStage("map")} meta={meta} />;

  if (!clusters) {
    return (
      <Centered>
        {error ? `Failed to load the atlas: ${error}` : "Loading the MiniFin atlas…"}
      </Centered>
    );
  }

  if (stage === "map")
    return (
      <MapStage
        clusters={clusters}
        meta={meta}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        validated={validated}
        onPick={openCluster}
        onAuto={startAutopilot}
        onExport={exportResults}
        onReset={resetRun}
        labels={labels}
        confidence={confidence}
      />
    );

  const active = clusters.find((c) => c.id === activeId)!;

  if (stage === "personas")
    return (
      <Personas
        onContinue={() => {
          setPersonasSeen(true);
          setStage("cluster");
        }}
      />
    );
  return (
    <ClusterStage
      clusters={clusters}
      active={active}
      validated={validated}
      onBack={() => setStage("map")}
      onValidate={markValidated}
      goToCluster={setActiveId}
      autoStart={autoStart}
      labels={labels}
      onLabel={setLabel}
      transcripts={transcripts}
      setTranscripts={setTranscripts}
      augmented={augmented}
      setAugmented={setAugmented}
      confidence={confidence}
      setConfidence={setConfidence}
      incorporated={incorporated}
      setIncorporated={setIncorporated}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: "#777", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Intro({ onStart, meta }: { onStart: () => void; meta: AtlasMeta | null }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 720, padding: "84px 28px" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>daniotype · kasperov</div>
        <h1 style={{ fontSize: 42, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.08 }}>Label the atlas, together</h1>
        <p style={{ fontSize: 18, color: "#555", lineHeight: 1.6, marginTop: 14 }}>
          Kasparov&apos;s wager: the strongest systems are human–AI hybrids. You fly over the real MiniFin
          single-cell atlas{meta ? ` (${meta.totalCells.toLocaleString()} cells, ${meta.nClusters} Leiden clusters)` : ""}, drop into any
          cluster, and a research agent pulls grounded evidence from the canonical zebrafish resources (ZFIN, ZFA, GO)
          for that cluster&apos;s top markers — showing its reasoning and searches live. You decide whether its read is
          on track: accept it, or dig deeper in chat.
        </p>
        <button onClick={onStart} style={{ marginTop: 28, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "15px 30px", fontSize: 18, fontWeight: 600, cursor: "pointer" }}>
          Begin the descent →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalities primer (shown once before the chat) + pixel-art icons
// ---------------------------------------------------------------------------
function PixelIcon({ rows, color, size = 80 }: { rows: string[]; color: string; size?: number }) {
  const n = rows.length;
  const cells: React.ReactNode[] = [];
  rows.forEach((row, y) =>
    row.split("").forEach((ch, x) => {
      if (ch === ".") return;
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={ch === "o" ? "#2b2b2b" : color} />);
    })
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }}>
      {cells}
    </svg>
  );
}

// 12×12 pixel glyphs
const PIX_RESEARCHER = [
  ".xxxx.......",
  "x....x......",
  "x....x......",
  "x....x......",
  ".xxxx.......",
  ".....xx.....",
  "......xx....",
  ".......xx...",
  "........xx..",
  ".........xx.",
  "..........x.",
  "............",
];
const PIX_ARCHIVIST = [
  "............",
  "...xxxx.....",
  "..xxxxxxxxx.",
  ".xxxxxxxxxxx",
  ".x.........x",
  ".x..oooo...x",
  ".x.........x",
  ".x..oooo...x",
  ".x.........x",
  ".x..oooo...x",
  ".xxxxxxxxxxx",
  "............",
];
const PIX_REASONER = [
  "....xxx.....",
  "...x...x....",
  "..x..o..x...",
  "..x.ooo.x...",
  "..x..o..x...",
  "...x.o.x....",
  "...x.o.x....",
  "....xxx.....",
  "....x.x.....",
  ".....x......",
  "....ooo.....",
  "....ooo.....",
];

function Personas({ onContinue }: { onContinue: () => void }) {
  const cards = [
    { mode: "reason" as AgentMode, pix: PIX_REASONER, blurb: "Your partner. Synthesises everything, judges when you're done, and offers one-click prompts to send the other two." },
    { mode: "research" as AgentMode, pix: PIX_RESEARCHER, blurb: "Searches ZFIN, ZFA & GO for grounded, cited evidence." },
    { mode: "archivist" as AgentMode, pix: PIX_ARCHIVIST, blurb: "Pulls raw MiniFin values — stats, specificity, p-values, co-expression." },
  ];
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 880, padding: "60px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#999", fontWeight: 600 }}>Your three specialists</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "8px 0 4px" }}>One GPT-5-Mini, three personalities</h1>
        <p style={{ fontSize: 15, color: "#666", maxWidth: 700, margin: "0 auto 26px", lineHeight: 1.55 }}>
          Each specialist has its own input line below the chat — ask any of them directly, any time. Lean on the{" "}
          <strong style={{ color: THEME.reason.color }}>Reasoner</strong> as your partner: it reads the evidence, judges when you&apos;re
          done, and offers one-click prompts to send the <strong style={{ color: THEME.research.color }}>Researcher</strong> and{" "}
          <strong style={{ color: THEME.archivist.color }}>Archivist</strong>.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {cards.map(({ mode, pix, blurb }) => {
            const th = THEME[mode];
            return (
              <div key={mode} style={{ flex: "1 1 240px", maxWidth: 260, background: th.bg, border: `1px solid ${th.color}44`, borderTop: `3px solid ${th.color}`, borderRadius: 12, padding: "20px 18px" }}>
                <PixelIcon rows={pix} color={th.color} />
                <div style={{ fontSize: 17, fontWeight: 700, color: th.color, marginTop: 8 }}>{th.name}</div>
                <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, marginTop: 6 }}>{blurb}</div>
              </div>
            );
          })}
        </div>
        <button
          onClick={onContinue}
          style={{ marginTop: 30, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px 30px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
        >
          Enter the cluster →
        </button>
      </div>
    </div>
  );
}

const PIX_BY_MODE: Record<AgentMode, string[]> = { reason: PIX_REASONER, research: PIX_RESEARCHER, archivist: PIX_ARCHIVIST };

// one labelled, colour-coded personality input line (gated until unlocked)
function AskLine({
  mode,
  value,
  setValue,
  onSend,
  enabled,
  locked,
}: {
  mode: AgentMode;
  value: string;
  setValue: (s: string) => void;
  onSend: () => void;
  enabled: boolean;
  locked: boolean;
}) {
  const th = THEME[mode];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: locked ? 0.55 : 1 }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} title={th.name}>
        <PixelIcon rows={PIX_BY_MODE[mode]} color={locked ? "#b0a99f" : th.color} size={22} />
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && enabled && onSend()}
        placeholder={locked ? `${th.name} — unlocks when the Reasoner calls for it` : `Ask the ${th.name}…`}
        disabled={!enabled}
        style={{
          flex: 1,
          padding: "8px 10px",
          border: `1px solid ${locked ? "#d8d3cd" : th.color + "66"}`,
          borderLeft: `3px solid ${locked ? "#cfcac4" : th.color}`,
          borderRadius: 8,
          fontSize: 13,
          fontFamily: "inherit",
          background: enabled ? "#fff" : "#f3f0ec",
        }}
      />
      <button
        onClick={onSend}
        disabled={!enabled || !value.trim()}
        title={locked ? "Locked" : `Send to the ${th.name}`}
        style={{
          flexShrink: 0,
          background: enabled && value.trim() ? th.color : "#fff",
          color: enabled && value.trim() ? "#fff" : "#bbb",
          border: `1px solid ${enabled && value.trim() ? th.color : "#d8d3cd"}`,
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: enabled && value.trim() ? "pointer" : "default",
        }}
      >
        {locked ? "🔒" : "→"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function MapStage({
  clusters,
  meta,
  revealed,
  onReveal,
  validated,
  onPick,
  onAuto,
  onExport,
  onReset,
  labels = {},
  confidence = {},
}: {
  clusters: Cluster[];
  meta: AtlasMeta | null;
  revealed: boolean;
  onReveal: () => void;
  validated: Set<string>;
  onPick: (id: string) => void;
  onAuto: () => void;
  onExport: () => void;
  onReset: () => void;
  labels?: Record<string, string>;
  confidence?: Record<string, { pct: number; why: string }>;
}) {
  const labelled = clusters.filter((c) => labels[c.id]);
  const unlabelled = clusters.filter((c) => !labels[c.id]);
  const trim15 = (s: string) => {
    const w = s.trim().split(/\s+/);
    return w.length > 15 ? w.slice(0, 15).join(" ") + "…" : s.trim();
  };
  const [size, setSize] = useState({ w: 760, h: 560 });
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function fit() {
      const w = Math.min(860, (wrap.current?.clientWidth ?? 800) - 8);
      setSize({ w, h: Math.round(w * 0.74) });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 60px", textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>World map · MiniFin atlas</div>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 2px" }}>{revealed ? "Choose a cluster to investigate" : "The whole dataset"}</h2>
        <p style={{ color: "#666", fontSize: 15, marginTop: 0, marginBottom: 18 }}>
          {revealed
            ? `${clusters.length} Leiden clusters · ${validated.size} validated. Click a cluster on the map or pick one below.`
            : `${meta ? meta.totalCells.toLocaleString() : ""} cells, one point each — real UMAP. Reveal the Leiden clustering to start.`}
        </p>

        <div ref={wrap} style={{ display: "inline-block", background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 14, padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <UmapCanvas clusters={clusters} mode="global" colored={revealed} activeId={null} validated={validated} width={size.w} height={size.h} onPick={onPick} />
        </div>

        <div style={{ marginTop: 20 }}>
          {!revealed ? (
            <button onClick={onReveal} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "13px 26px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              View Leiden clusters →
            </button>
          ) : (
            <>
              {/* run-itself controls */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  onClick={onAuto}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: THEME.reason.color, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                >
                  🤖 Activate AutoPilot Cluster Labeller →
                </button>
                <button onClick={onExport} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14 }}>⬇ Export results (JSON)</button>
                {(labelled.length > 0 || validated.size > 0) && (
                  <button onClick={onReset} style={{ ...btnGhost, padding: "12px 18px", fontSize: 14, color: "#b91c1c", borderColor: "#e7c3c3" }}>↺ Reset run</button>
                )}
              </div>
              <p style={{ color: "#999", fontSize: 12.5, margin: "0 auto 14px", maxWidth: 560 }}>
                Auto-pilot drives the Reasoner across every un-labelled cluster — dispatching the Researcher &amp; Archivist,
                adding evidence, and accepting an identity when settled. Watch it go; stop anytime. (Uses OpenAI credits.)
              </p>

              {/* single cluster grid — cell type + confidence (heat-tinted) + ✓ validated */}
              <div style={{ marginTop: 8, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#999", fontWeight: 600 }}>
                    Run summary · {labelled.length}/{clusters.length} labelled · {validated.size} validated
                  </div>
                  <div style={{ fontSize: 11.5, color: "#aaa" }}>✓ = validated · % = confidence (red→green)</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 6 }}>
                  {clusters.map((c) => {
                    const conf = confidence[c.id]?.pct;
                    const isVal = validated.has(c.id);
                    const hasLabel = !!labels[c.id];
                    const heat = typeof conf === "number" ? confColor(conf) : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => onPick(c.id)}
                        title={
                          hasLabel
                            ? `${c.label}: ${labels[c.id]}${typeof conf === "number" ? ` · ${conf.toFixed(0)}% confidence` : ""}`
                            : `${c.label} — not yet labelled`
                        }
                        style={{ display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", background: isVal ? "#f6fdf8" : "#fffdfb", border: `1px solid ${isVal ? "#bfe3cc" : "#e5e1dc"}`, borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: INK, minWidth: 0 }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color, flexShrink: 0, marginTop: 5 }} />
                        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <strong style={{ fontSize: 12.5 }}>{c.label}</strong>
                            {isVal && <span style={{ color: "#15803d", fontWeight: 800, fontSize: 12 }}>✓</span>}
                          </span>{" "}
                          {hasLabel ? (
                            <span style={{ fontSize: 12, color: "#666" }}>— {trim15(labels[c.id])}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#b3ada5", fontStyle: "italic" }}>— not yet labelled</span>
                          )}
                        </span>
                        {typeof conf === "number" && heat && (
                          <span style={{ flexShrink: 0, marginTop: 2, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: heat.fg, background: heat.bg, border: `1px solid ${heat.fg}22`, borderRadius: 99, padding: "2px 7px" }}>
                            {conf.toFixed(0)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* surface the gap — clusters that completed the run without a cell-type label */}
              {labelled.length > 0 && unlabelled.length > 0 && (
                <div style={{ marginTop: 14, textAlign: "left", fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px" }}>
                  {unlabelled.length} of {clusters.length} clusters not yet labelled: {unlabelled.map((c) => c.label.replace("Cluster ", "C")).join(", ")}. Run &ldquo;Activate AutoPilot Cluster Labeller&rdquo; — it auto-skips the {labelled.length} already labelled and finishes only these.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
type AgentMode = "research" | "archivist" | "reason";
type ChatMsg = { role: "user" | "assistant"; content: string; mode?: AgentMode };

// per-personality theming for badges, router cards, and loading views
// Global personality colour code: green = Researcher, yellow = Archivist, blue = Reasoner.
const THEME: Record<AgentMode, { name: string; icon: string; color: string; bg: string; trace: string; verb: string; blurb: string }> = {
  research: { name: "Researcher", icon: "🔬", color: "#15803d", bg: "#f0fdf4", trace: "Research log", verb: "Searching ZFIN · ZFA · GO…", blurb: "ZFIN / ZFA / GO literature" },
  archivist: { name: "Archivist", icon: "🗄", color: "#a16207", bg: "#fef9c3", trace: "Archive search", verb: "Pulling records from the MiniFin stacks…", blurb: "raw MiniFin records" },
  reason: { name: "Reasoner", icon: "🧠", color: "#2563eb", bg: "#eff6ff", trace: "Reasoning", verb: "Reasoning across what's known…", blurb: "generalist synthesis" },
};
const MODES: AgentMode[] = ["research", "archivist", "reason"];

// extract the hidden ```kasperov-markers``` block: returns display text + parsed markers
// Extract a hidden control block by keyword. Robust to the model emitting it
// EITHER fenced ( ```kasperov-x\n[...]\n``` ) OR bare ( kasperov-x [...] ) — it
// locates the keyword, bracket-matches the following JSON array, and removes the
// whole thing (plus any surrounding fence) from the visible text.
function extractTagged(content: string, keyword: string): { json: string | null; clean: string } {
  const kw = new RegExp("(?:```)?\\s*" + keyword + "\\s*", "i");
  const m = content.match(kw);
  if (!m || m.index === undefined) return { json: null, clean: content };
  const afterKw = m.index + m[0].length;
  const ai = content.indexOf("[", afterKw);
  const oi = content.indexOf("{", afterKw);
  let start = -1;
  let open = "[";
  if (ai !== -1 && (oi === -1 || ai < oi)) { start = ai; open = "["; }
  else if (oi !== -1) { start = oi; open = "{"; }
  if (start === -1) return { json: null, clean: content };
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    const c = content[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return { json: null, clean: content };
  let after = end + 1;
  const tail = content.slice(after).match(/^\s*```/); // consume a trailing fence if present
  if (tail) after += tail[0].length;
  const json = content.slice(start, end + 1);
  const clean = (content.slice(0, m.index) + content.slice(after)).trim();
  return { json, clean };
}

// the Reasoner's final call for a cluster (settled identity) — drives auto-accept.
function splitConclude(content: string): { clean: string; conclude: { label: string; confidence?: number; done: boolean } | null } {
  const { json, clean } = extractTagged(content, "kasperov-conclude");
  if (!json) return { clean: content, conclude: null };
  try {
    const o = JSON.parse(json);
    if (o && typeof o.label === "string") return { clean, conclude: { label: String(o.label), confidence: typeof o.confidence === "number" ? o.confidence : undefined, done: o.done !== false } };
  } catch {}
  return { clean, conclude: null };
}

// heuristic: a specialist deferred / is asking the curator to choose instead of
// just doing the work → surface a one-click "just run it" button.
function looksStuck(content: string): boolean {
  const t = content.trim();
  return (
    /\b(would you (prefer|like)|which would you|do you want me to|shall i|let me know which|prefer\b[\s\S]{0,40}\(a\)|\(a\)[\s\S]{0,120}\(b\)|don'?t have access to those results|i have the .*ready)\b/i.test(t) ||
    /\?\s*$/.test(t)
  );
}

// a streamed reply that came back as a request error / empty body — auto-pilot
// uses this to decide whether to retry the call.
function streamFailed(content: string): boolean {
  return /_Request failed:|_Error:|_\(no response\)_/.test(content ?? "");
}

function splitMarkerBlock(content: string): { clean: string; markers: Marker[] } {
  const { json, clean } = extractTagged(content, "kasperov-markers");
  if (!json) return { clean: content, markers: [] };
  let markers: Marker[] = [];
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr))
      markers = arr
        .filter((x) => x && typeof x.g === "string")
        .map((x) => ({ g: x.g, l2fc: x.l2fc ?? undefined, p1: x.p1 ?? undefined, p2: x.p2 ?? undefined, note: x.note ?? undefined }));
  } catch {}
  return { clean, markers };
}

// a prompt the Reasoner crafted for another personality, surfaced as a send button.
function splitDispatch(content: string): { clean: string; dispatches: { to: AgentMode; prompt: string }[] } {
  const { json, clean } = extractTagged(content, "kasperov-dispatch");
  if (!json) return { clean: content, dispatches: [] };
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    return { clean, dispatches: [] };
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const dispatches = arr
    .filter((x) => x && typeof x.prompt === "string")
    .map((x) => ({ to: (x.to === "archivist" ? "archivist" : "research") as AgentMode, prompt: String(x.prompt) }))
    .filter((d) => {
      const k = `${d.to}:${d.prompt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 2); // never flood the chat with dispatch buttons
  return { clean, dispatches };
}

// the Reasoner moving an "also-discussed" gene up into the UP/DOWN marker list.
function splitPromote(content: string): { clean: string; promotes: { gene: string; dir: "up" | "down"; note?: string }[] } {
  const { json, clean } = extractTagged(content, "kasperov-promote");
  if (!json) return { clean: content, promotes: [] };
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    return { clean, promotes: [] };
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const promotes = arr
    .filter((x) => x && typeof x.gene === "string" && (x.dir === "up" || x.dir === "down"))
    .map((x) => ({ gene: String(x.gene), dir: x.dir as "up" | "down", note: x.note ? String(x.note) : undefined }))
    .slice(0, 6);
  return { clean, promotes };
}

function defaultPrompt(c: Cluster): string {
  const upList = c.degsUp.slice(0, 8).join(", ");
  return (
    `${c.label}'s top up-regulated markers are: ${upList || "(none)"}. ` +
    `Using ZFIN curated expression, ZFA anatomy, and GO, identify the most likely zebrafish cell type ` +
    `(with state if the markers support it), grounding each claim in a cited record. If the evidence is ambiguous, say so.`
  );
}

// pure marker merge (gene-keyed; classifies up/down by log2FC) — shared by the
// manual "Add to Top Markers" button and the auto-pilot.
function mergeMarkers(cur: Marker[], add: Marker[], via: AgentMode): Marker[] {
  const byGene = new Map(cur.map((m) => [m.g.toLowerCase(), m]));
  add.forEach((m) => {
    const merged: Marker = { ...byGene.get(m.g.toLowerCase()), ...m, via };
    merged.dir = merged.dir ?? (merged.l2fc != null ? (merged.l2fc >= 1 ? "up" : merged.l2fc <= -1 ? "down" : undefined) : undefined);
    byGene.set(m.g.toLowerCase(), merged);
  });
  return Array.from(byGene.values());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTO_REASON_PROMPT =
  "Summarize what we've established for this cluster. If the Researcher and Archivist are exhausted and you're satisfied with the cell-type identity, conclude with a kasperov-conclude block. Otherwise dispatch the single most useful next query to the Researcher or Archivist (kasperov-dispatch).";
const AUTO_NUDGE_PROMPT =
  "Decide now — do not ask me. Either conclude with a kasperov-conclude block (if the specialists are exhausted and the identity is settled) or dispatch the next query with a kasperov-dispatch block.";
const AUTO_MAX_ROUNDS = 4;

function ClusterStage({
  clusters,
  active,
  validated,
  onBack,
  onValidate,
  goToCluster,
  autoStart,
  labels,
  onLabel,
  transcripts,
  setTranscripts,
  augmented,
  setAugmented,
  confidence,
  setConfidence,
  incorporated,
  setIncorporated,
}: {
  clusters: Cluster[];
  active: Cluster;
  validated: Set<string>;
  onBack: () => void;
  onValidate: (id: string, yes: boolean) => void;
  goToCluster: (id: string) => void;
  autoStart: number;
  labels: Record<string, string>;
  onLabel: (id: string, label: string) => void;
  transcripts: Record<string, ChatMsg[]>;
  setTranscripts: React.Dispatch<React.SetStateAction<Record<string, ChatMsg[]>>>;
  augmented: Record<string, Marker[]>;
  setAugmented: React.Dispatch<React.SetStateAction<Record<string, Marker[]>>>;
  confidence: Record<string, { pct: number; why: string }>;
  setConfidence: React.Dispatch<React.SetStateAction<Record<string, { pct: number; why: string }>>>;
  incorporated: Set<string>;
  setIncorporated: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt(active));
  const [inReason, setInReason] = useState("");
  const [inRes, setInRes] = useState("");
  const [inArch, setInArch] = useState("");
  const [zoomW, setZoomW] = useState(560);
  const [panelW, setPanelW] = useState(470); // resizable GPT-5-Mini panel
  const leftRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  // drag the splitter to trade space between the focused-cluster view and the panel
  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(window.innerWidth - ev.clientX, 320), window.innerWidth - 360);
      setPanelW(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // live streaming buffers
  const [streaming, setStreaming] = useState(false);
  const [sStatus, setStatus] = useState("");
  const [sThinking, setThinking] = useState("");
  const [sText, setText] = useState("");
  const [showThinking, setShowThinking] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds since run started
  const [sMode, setSMode] = useState<AgentMode>("research");
  const [routing, setRouting] = useState(false); // ~1s "choosing a specialist" phase
  const [routed, setRouted] = useState(false); // chosen mode known
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // markers added to the Top Markers panel from chat, per cluster (state in parent)
  const [flash, setFlash] = useState(false);
  // auto-pilot run state
  const [auto, setAuto] = useState<{ running: boolean; current: string | null; done: number; total: number }>({ running: false, current: null, done: 0, total: 0 });
  const autoAbort = useRef(false);
  // live mirror of `labels` so the running loop can skip clusters that got labelled
  // mid-sweep (a prior pass) without rebuilding its closure. "done" is keyed off
  // labels, not `validated` — a cluster can be validated by hand without a label.
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  // what the last auto-pilot run skipped (already labelled) / couldn't finish (errored after retry)
  const [autoReport, setAutoReport] = useState<{ already: number; failed: string[] } | null>(null);

  function addedText(list: Marker[]): string {
    return list.map((m) => `${m.g}${m.l2fc != null ? ` log2FC ${m.l2fc}` : ""}${m.note ? ` — ${m.note}` : ""} [${m.dir ?? "?"}, via ${m.via}]`).join("; ");
  }

  function incorporate(msgKey: string, markers: Marker[], via: AgentMode) {
    const next = mergeMarkers(augmented[active.id] ?? [], markers, via);
    setAugmented((a) => ({ ...a, [active.id]: next }));
    setIncorporated((s) => new Set(s).add(msgKey));
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    refreshConfidence(transcripts[active.id] ?? [], active.id, addedText(next));
  }

  // Reasoner lifting an "also-discussed" gene into the up/down marker list
  function promote(gene: string, dir: "up" | "down", note: string | undefined, via: AgentMode) {
    const cur = augmented[active.id] ?? [];
    const byGene = new Map(cur.map((m) => [m.g.toLowerCase(), m]));
    const ex = byGene.get(gene.toLowerCase());
    byGene.set(gene.toLowerCase(), { ...(ex ?? { g: gene }), g: ex?.g ?? gene, dir, note: note ?? ex?.note, via: via ?? ex?.via ?? "reason" });
    const next = Array.from(byGene.values());
    setAugmented((a) => ({ ...a, [active.id]: next }));
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    refreshConfidence(transcripts[active.id] ?? [], active.id, addedText(next));
  }

  // live confidence box (appears once there's a conversation to assess) — state in parent
  async function refreshConfidence(msgs: ChatMsg[], clusterId: string, added?: string) {
    if (!msgs.some((m) => m.role === "assistant")) return;
    try {
      const r = await fetch("/api/kasperov_confidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cluster: { id: clusterId, label: active.label }, messages: msgs, addedMarkers: added ?? addedText(augmented[clusterId] ?? []) }),
      });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d.pct === "number") setConfidence((c) => ({ ...c, [clusterId]: { pct: d.pct, why: d.why || "" } }));
    } catch {}
  }

  const msgs = transcripts[active.id] ?? [];
  const started = msgs.length > 0 || streaming;

  useEffect(() => {
    setPrompt(defaultPrompt(active));
    setInReason("");
    setInRes("");
    setInArch("");
    setStatus("");
    setThinking("");
    setText("");
    setStreaming(false);
    setRouting(false);
    setRouted(false);
  }, [active.id]);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    function fit() {
      const el = leftRef.current;
      setZoomW(Math.max(280, (el?.clientWidth ?? 560) - 24));
      if (el) setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [panelW]);

  // start with chat + focused-cluster splitting the screen 50/50
  useEffect(() => {
    setPanelW(Math.round(window.innerWidth / 2));
  }, []);

  // floating panels — geometry lifted here so Top Markers / Confidence can
  // auto-grow to fit content and push the others down (until the user drags one)
  const GAP = 12;
  const [pb, setPb] = useState<{ wm: Box; mk: Box; cf: Box } | null>(null);
  const manualRef = useRef(false);
  useEffect(() => {
    if (pb || containerSize.w < 60 || containerSize.h < 60) return;
    setPb({
      wm: { x: 14, y: 14, w: 226, h: 184 },
      mk: { x: 14, y: 210, w: 250, h: 238 },
      cf: { x: 14, y: 462, w: 252, h: 120 },
    });
  }, [containerSize, pb]);

  function reflowBoxes(b: { wm: Box; mk: Box; cf: Box }) {
    const x = b.wm.x;
    const mk = { ...b.mk, x, y: b.wm.y + b.wm.h + GAP };
    const cf = { ...b.cf, x, y: mk.y + mk.h + GAP };
    return { ...b, mk, cf };
  }
  const moveBox = useCallback((k: "wm" | "mk" | "cf", x: number, y: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], x, y } } : p));
  }, []);
  const resizeBox = useCallback((k: "wm" | "mk" | "cf", w: number, h: number) => {
    manualRef.current = true;
    setPb((p) => (p ? { ...p, [k]: { ...p[k], w, h } } : p));
  }, []);
  const measureBox = useCallback((k: "mk" | "cf", h: number) => {
    setPb((p) => {
      if (!p || Math.abs(p[k].h - h) < 1) return p;
      const u = { ...p, [k]: { ...p[k], h } };
      return manualRef.current ? u : reflowBoxes(u);
    });
    // reflowBoxes is pure + GAP constant; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top Markers & Confidence also grow WIDER as they gather content (until the
  // user drags a panel, which switches everything to manual layout)
  useEffect(() => {
    if (manualRef.current) return;
    const added = augmented[active.id] ?? [];
    const why = confidence[active.id]?.why ?? "";
    const longestNote = added.reduce((mx, m) => Math.max(mx, m.note?.length ?? 0), 0);
    const mkW = Math.min(380, Math.max(250, 250 + (longestNote > 38 ? 105 : longestNote > 0 ? 45 : 0) + (added.length > 3 ? 25 : 0)));
    const cfW = Math.min(380, Math.max(250, 250 + Math.floor(why.length / 5)));
    setPb((p) => {
      if (!p || (p.mk.w === mkW && p.cf.w === cfW)) return p;
      const u = { ...p, mk: { ...p.mk, w: mkW }, cf: { ...p.cf, w: cfW } };
      return manualRef.current ? u : reflowBoxes(u);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [augmented, confidence, active.id]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sText, sThinking, streaming]);

  async function streamAgent(cl: Cluster, nextMsgs: ChatMsg[], forceMode?: AgentMode, fast = false, timeoutMs?: number): Promise<ChatMsg[]> {
    setTranscripts((t) => ({ ...t, [cl.id]: nextMsgs }));
    setStreaming(true);
    setRouting(!fast);
    setRouted(false);
    setStatus("");
    setThinking("");
    setText("");
    // elapsed-time bar, counts up toward the 60s ceiling
    setElapsed(0);
    const startedAt = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Math.min(60, (Date.now() - startedAt) / 1000)), 250);
    let acc = "";
    let mode: AgentMode = forceMode ?? "research";
    // hard timeout so a hung request can't stall the whole auto-pilot sweep
    const ctrl = new AbortController();
    const killTimer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch("/api/kasperov_agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cluster: { id: cl.id, label: cl.label, degsUp: cl.degsUp, markers: cl.markers, nCells: cl.nCells },
          messages: nextMsgs,
          ...(forceMode ? { mode: forceMode } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let evt: any;
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.t === "mode") {
            mode = evt.v === "archivist" ? "archivist" : evt.v === "reason" ? "reason" : "research";
            setSMode(mode);
            setRouted(true);
            // hold the selection screen ~2s — it's a feature, let it breathe (skip in auto)
            if (fast) setRouting(false);
            else {
              const wait = Math.max(0, 2000 - (Date.now() - startedAt));
              setTimeout(() => setRouting(false), wait);
            }
          } else if (evt.t === "status") setStatus(evt.v);
          else if (evt.t === "thinking") setThinking((p) => p + evt.v);
          else if (evt.t === "text") {
            acc += evt.v;
            setText(acc);
          } else if (evt.t === "error") {
            acc += `\n\n_Error: ${evt.v}_`;
            setText(acc);
          }
        }
      }
    } catch (e: any) {
      acc += `\n\n_Request failed: ${String(e?.message ?? e)}_`;
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (killTimer) clearTimeout(killTimer);
      setStreaming(false);
      setRouting(false);
      setStatus("");
      setText("");
      setThinking("");
    }
    const finalMsgs: ChatMsg[] = [...nextMsgs, { role: "assistant", content: acc || "_(no response)_", mode }];
    setTranscripts((t) => ({ ...t, [cl.id]: finalMsgs }));
    refreshConfidence(finalMsgs, cl.id);
    return finalMsgs;
  }

  function runResearch() {
    if (streaming) return;
    streamAgent(active, [{ role: "user", content: prompt }]);
  }
  // send a message forced to a specific personality (via the labelled input line or a button)
  function ask(mode: AgentMode, text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    streamAgent(active, [...msgs, { role: "user", content: t }], mode);
  }

  // ---- AUTO-PILOT: drive the whole loop across every cluster --------------
  // pull any kasperov-markers out of a message and add them to Top Markers
  function autoAddMarkers(cl: Cluster, content: string, via: AgentMode, running: Marker[]): Marker[] {
    const mk = splitMarkerBlock(content).markers;
    if (!mk.length) return running;
    const next = mergeMarkers(running, mk, via);
    setAugmented((a) => ({ ...a, [cl.id]: next }));
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    refreshConfidence(transcripts[cl.id] ?? [], cl.id, addedText(next));
    return next;
  }

  // auto-pilot stream with one retry + a hard timeout, so a hung or failed request
  // can't stall the sweep. Throws if it STILL fails — runAutopilot records the
  // cluster as "couldn't finish" and moves on instead of hanging on it.
  async function autoStream(cl: Cluster, msgs: ChatMsg[], mode: AgentMode): Promise<ChatMsg[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (autoAbort.current) throw new Error("aborted");
      const conv = await streamAgent(cl, msgs, mode, true, 90_000);
      const last = conv[conv.length - 1]?.content ?? "";
      if (!streamFailed(last)) return conv;
      if (attempt === 0) await sleep(1200); // brief backoff, then one retry
    }
    throw new Error("stream failed after retry");
  }

  async function runOneCluster(cl: Cluster) {
    let added: Marker[] = augmented[cl.id] ?? [];
    // 1) identity pass (Researcher)
    let conv = await autoStream(cl, [{ role: "user", content: defaultPrompt(cl) }], "research");
    added = autoAddMarkers(cl, conv[conv.length - 1].content, "research", added);
    // 2) Reasoner-orchestrated rounds
    for (let round = 0; round < AUTO_MAX_ROUNDS; round++) {
      if (autoAbort.current) return;
      conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_REASON_PROMPT }], "reason");
      let rc = conv[conv.length - 1].content;
      added = autoAddMarkers(cl, rc, "reason", added);
      let concl = splitConclude(rc).conclude;
      let dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      if (!concl && dispatches.length === 0) {
        // neither concluded nor dispatched → nudge once
        conv = await autoStream(cl, [...conv, { role: "user", content: AUTO_NUDGE_PROMPT }], "reason");
        rc = conv[conv.length - 1].content;
        added = autoAddMarkers(cl, rc, "reason", added);
        concl = splitConclude(rc).conclude;
        dispatches = splitDispatch(splitMarkerBlock(splitConclude(rc).clean).clean).dispatches;
      }
      if (concl?.done) {
        onLabel(cl.id, concl.label);
        onValidate(cl.id, true);
        return;
      }
      for (const d of dispatches) {
        if (autoAbort.current) return;
        conv = await autoStream(cl, [...conv, { role: "user", content: d.prompt }], d.to);
        added = autoAddMarkers(cl, conv[conv.length - 1].content, d.to, added);
      }
    }
    // ran out of rounds — accept best-effort so the loop keeps moving
    onValidate(cl.id, true);
    if (!labels[cl.id]) onLabel(cl.id, "(unresolved — review)");
  }

  async function runAutopilot() {
    if (auto.running) return;
    autoAbort.current = false;
    setAutoReport(null);
    // auto-detect & skip clusters that already have a cell-type label (= done).
    // NB: keyed off labels, not `validated` — a cluster can be validated by hand
    // without a label, and those still need the labeller to run.
    const alreadyLabelled = clusters.filter((c) => labels[c.id]).length;
    const queue = clusters.filter((c) => !labels[c.id]);
    const failed: string[] = [];
    setAuto({ running: true, current: null, done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      if (autoAbort.current) break;
      const c = queue[i];
      // skip if it got labelled since the queue was built (a prior pass)
      if (labelsRef.current[c.id]) {
        setAuto((a) => ({ ...a, done: i + 1 }));
        continue;
      }
      setAuto((a) => ({ ...a, current: c.id, done: i }));
      goToCluster(c.id);
      await sleep(80); // let the per-cluster reset effect settle before streaming
      try {
        await runOneCluster(c);
      } catch {
        failed.push(c.id); // errored after retry — record it and keep going
      }
    }
    setAuto((a) => ({ ...a, running: false, current: null, done: a.total }));
    if (!autoAbort.current) {
      setAutoReport({ already: alreadyLabelled, failed });
      if (failed.length) console.warn("[auto-pilot] could not finish clusters:", failed.join(", "));
    }
  }
  function stopAutopilot() {
    autoAbort.current = true;
    setAuto((a) => ({ ...a, running: false }));
  }

  // kick off when the map's "go through each cluster" button bumps autoStart
  const autoStartedRef = useRef(0);
  useEffect(() => {
    if (autoStart > 0 && autoStart !== autoStartedRef.current) {
      autoStartedRef.current = autoStart;
      runAutopilot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const isValidated = validated.has(active.id);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: PAPER, color: INK }}>
      <style>{`
        @keyframes kpulse{0%,100%{opacity:.45}50%{opacity:1}}
        @keyframes kscan{0%,100%{transform:translateY(0) scale(1);box-shadow:0 0 0 0 rgba(14,116,144,0)}50%{transform:translateY(-3px) scale(1.03);box-shadow:0 6px 16px rgba(0,0,0,.10)}}
        @keyframes kflash{0%{box-shadow:0 0 0 0 rgba(67,56,202,.5)}100%{box-shadow:0 0 0 14px rgba(67,56,202,0)}}
        @keyframes kpop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
      `}</style>

      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderBottom: "1px solid #e5e1dc", background: "#fffdfb" }}>
        <button onClick={onBack} style={btnGhost}>← World map</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: active.color }} />
          <strong style={{ fontSize: 16 }}>{active.label}</strong>
        </div>
        <span style={{ fontSize: 13, color: "#888" }}>{active.nCells.toLocaleString()} cells</span>
        {labels[active.id] && <span style={{ fontSize: 12.5, color: THEME.reason.color, fontWeight: 600, background: THEME.reason.bg, padding: "2px 8px", borderRadius: 99 }}>{labels[active.id]}</span>}
        {auto.running && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: THEME.reason.color, background: THEME.reason.bg, padding: "4px 10px", borderRadius: 99 }}>
            <span style={{ animation: "kpulse 1s infinite" }}>🤖</span> Auto-pilot · cluster {auto.done + 1}/{auto.total}
            <button onClick={stopAutopilot} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>■ Stop</button>
          </span>
        )}
        {!auto.running && autoReport && (autoReport.failed.length > 0 || autoReport.already > 0) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: autoReport.failed.length ? "#b91c1c" : "#15803d", background: autoReport.failed.length ? "#fef2f2" : "#f0fdf4", padding: "4px 10px", borderRadius: 99 }}>
            {autoReport.already > 0 && <span>skipped {autoReport.already} already-labelled</span>}
            {autoReport.failed.length > 0 && (
              <>
                <span>
                  {autoReport.already > 0 ? "· " : ""}
                  {autoReport.failed.length} couldn&apos;t finish: {autoReport.failed.map((id) => clusters.find((c) => c.id === id)?.label.replace("Cluster ", "C") ?? id).join(", ")}
                </span>
                <button onClick={() => { setAutoReport(null); runAutopilot(); }} style={{ background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Retry these</button>
              </>
            )}
            <button onClick={() => setAutoReport(null)} title="Dismiss" style={{ background: "transparent", border: "none", color: "#999", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </span>
        )}
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>{validated.size}/{clusters.length} validated</div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT — zoom map + HUD */}
        <div ref={leftRef} style={{ flex: "1.25 1 0", position: "relative", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #fffefc, #f1ede8)" }}>
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#bbb", textTransform: "uppercase", letterSpacing: 1, pointerEvents: "none" }}>Focused cluster</div>
          <UmapCanvas clusters={clusters} mode="zoom" colored activeId={active.id} validated={validated} width={zoomW} height={Math.round(zoomW * 0.8)} />

          {pb && (
            <>
              {/* world map — draggable + resizable */}
              <DraggablePanel title="WORLD MAP" accent="#999" box={pb.wm} minW={150} minH={120} onMove={(x, y) => moveBox("wm", x, y)} onResize={(w, h) => resizeBox("wm", w, h)}>
                {(w, h) => <UmapCanvas clusters={clusters} mode="global" colored activeId={active.id} validated={validated} width={w} height={h} showFocus />}
              </DraggablePanel>

              {/* top markers — auto-grows to fit content, pushing the others down */}
              <DraggablePanel
                title={`TOP MARKERS${(augmented[active.id] ?? []).length ? ` · +${(augmented[active.id] ?? []).length} from chat` : ""}`}
                accent="#8a847b"
                box={pb.mk}
                minW={190}
                flash={flash}
                autoFitHeight
                onMove={(x, y) => moveBox("mk", x, y)}
                onResize={(w, h) => resizeBox("mk", w, h)}
                onMeasure={(h) => measureBox("mk", h)}
              >
                {() => <MarkersContent cluster={active} added={augmented[active.id] ?? []} />}
              </DraggablePanel>

              {/* live confidence — auto-grows to fit its rationale */}
              {confidence[active.id] && (
                <DraggablePanel
                  title="CONFIDENCE"
                  accent="#8a847b"
                  box={pb.cf}
                  minW={180}
                  autoFitHeight
                  onMove={(x, y) => moveBox("cf", x, y)}
                  onResize={(w, h) => resizeBox("cf", w, h)}
                  onMeasure={(h) => measureBox("cf", h)}
                >
                  {() => <ConfidenceContent pct={confidence[active.id].pct} why={confidence[active.id].why} />}
                </DraggablePanel>
              )}
            </>
          )}
        </div>

        {/* draggable splitter */}
        <div
          onMouseDown={startDrag}
          title="Drag to resize"
          style={{ width: 7, flexShrink: 0, cursor: "col-resize", background: "#e5e1dc", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ width: 2, height: 34, borderRadius: 2, background: "#bdb6ae" }} />
        </div>

        {/* RIGHT — GPT-5-Mini research panel (resizable) */}
        <aside style={{ width: panelW, flexShrink: 0, background: "#fffdfb", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid #f0ece7" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#555", fontWeight: 600 }}>GPT-5-Mini</div>
            <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>Searches ZFIN · ZFA · GO for this cluster&apos;s markers. You judge the result.</div>
          </div>

          <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {msgs.length === 0 && !streaming && (
              <div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Pre-filled from the cluster&apos;s top DEGs — edit if you like, then run it.</div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", minHeight: 130, padding: 10, border: "1px solid #d8d3cd", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", background: "#fff" }} />
                <button onClick={runResearch} style={{ ...btnPrimary, background: THEME.research.color, width: "100%", marginTop: 10 }}>▶ Run research agent</button>
              </div>
            )}

            {msgs.map((m, i) => {
              const mk = m.role === "assistant" ? splitMarkerBlock(m.content) : { clean: m.content, markers: [] as Marker[] };
              const dp = m.role === "assistant" ? splitDispatch(mk.clean) : { clean: mk.clean, dispatches: [] as { to: AgentMode; prompt: string }[] };
              const pr = m.role === "assistant" ? splitPromote(dp.clean) : { clean: dp.clean, promotes: [] as { gene: string; dir: "up" | "down"; note?: string }[] };
              const cc = m.role === "assistant" ? splitConclude(pr.clean) : { clean: pr.clean, conclude: null as null | { label: string; confidence?: number; done: boolean } };
              const parsed = { clean: cc.clean, markers: mk.markers };
              const key = `${active.id}:${i}`;
              const canAdd = parsed.markers.length > 0 && !incorporated.has(key);
              const isLast = m.role === "assistant" && i === msgs.length - 1 && !streaming;
              const actions =
                m.role === "assistant" ? (
                  <>
                    {cc.conclude && (
                      <button
                        onClick={() => {
                          onLabel(active.id, cc.conclude!.label);
                          onValidate(active.id, true);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: validated.has(active.id) ? "#15803d" : "#fff", border: `1px solid #15803d`, color: validated.has(active.id) ? "#fff" : "#15803d", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        {validated.has(active.id) ? "✓ Accepted" : "✓ Accept identity"}: {cc.conclude.label}
                      </button>
                    )}
                    {canAdd && (
                      <button
                        onClick={() => incorporate(key, parsed.markers, m.mode ?? "research")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${THEME[m.mode ?? "research"].color}66`, color: THEME[m.mode ?? "research"].color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        ➕ Add {parsed.markers.length} {THEME[m.mode ?? "research"].name} insight{parsed.markers.length === 1 ? "" : "s"} to Top Markers →
                      </button>
                    )}
                    {parsed.markers.length > 0 && incorporated.has(key) && (
                      <span style={{ fontSize: 11.5, color: "#888", fontWeight: 600, alignSelf: "center" }}>✓ added to Top Markers</span>
                    )}
                    {pr.promotes.map((p, pi) => (
                      <button
                        key={`pr${pi}`}
                        onClick={() => promote(p.gene, p.dir, p.note, m.mode ?? "reason")}
                        title={p.note}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid #8a847b`, color: "#555", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        {p.dir === "up" ? "▲" : "▼"} Promote {p.gene} to {p.dir.toUpperCase()}-regulated →
                      </button>
                    ))}
                    {dp.dispatches.map((d, di) => (
                      <button
                        key={di}
                        onClick={() => streamAgent(active, [...msgs, { role: "user", content: d.prompt }], d.to)}
                        disabled={streaming}
                        title={d.prompt}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${THEME[d.to].color}66`, color: THEME[d.to].color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: streaming ? "default" : "pointer", opacity: streaming ? 0.5 : 1 }}
                      >
                        {THEME[d.to].icon} ▶ Send to the {THEME[d.to].name} →
                      </button>
                    ))}
                    {/* safety net: a specialist that defers / asks you to choose gets a one-click "just do it" */}
                    {isLast && m.mode !== "reason" && looksStuck(parsed.clean) && (
                      <button
                        onClick={() => ask(m.mode ?? "archivist", "Yes — go ahead and run the query now and return the full result for everything I asked. Don't ask me to choose or summarise; just fetch and report it all.")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME[m.mode ?? "archivist"].color, border: `1px solid ${THEME[m.mode ?? "archivist"].color}`, color: "#fff", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        ▶ Yes — just run it and show everything →
                      </button>
                    )}
                    {/* always offer to hand back to the Reasoner for the next step */}
                    {isLast && m.mode !== "reason" && (
                      <button
                        onClick={() => ask("reason", "Summarize what we've established for this cluster so far, then suggest the next steps — or tell me if we're done.")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.reason.bg, border: `1px solid ${THEME.reason.color}66`, color: THEME.reason.color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        🧠 Ask Reasoner to Summarize and Suggest Next Steps →
                      </button>
                    )}
                  </>
                ) : undefined;
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: m.role === "user" ? "#999" : THEME[m.mode ?? "research"].color, fontWeight: 600, marginBottom: 3 }}>
                    {m.role === "user" ? "You asked" : `GPT-5-Mini${m.mode ? ` · ${THEME[m.mode].name}` : ""}`}
                  </div>
                  {m.role === "user" ? (
                    <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5, border: "1px solid #e2ded8", borderLeft: "3px solid #b0a99f", borderRadius: 8, background: "#faf8f6", padding: "8px 10px" }}>{m.content}</div>
                  ) : (
                    <AgentMessage content={parsed.clean} mode={m.mode} actions={actions} />
                  )}
                </div>
              );
            })}

            {/* router: three specialists, ~1s to decide, then the chosen one lights up */}
            {streaming && routing && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12.5, color: "#888", marginBottom: 10, animation: "kpulse 1.4s ease-in-out infinite" }}>
                  {routed ? `→ Routing to the ${THEME[sMode].name}…` : "Choosing the right specialist…"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MODES.map((mk, idx) => {
                    const th = THEME[mk];
                    const isChosen = routed && mk === sMode;
                    const dim = routed && mk !== sMode;
                    return (
                      <div
                        key={mk}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "12px 6px",
                          borderRadius: 10,
                          border: `1.5px solid ${isChosen ? th.color : "#e5e1dc"}`,
                          background: isChosen ? th.bg : "#fffdfb",
                          opacity: dim ? 0.4 : 1,
                          transform: isChosen ? "scale(1.04)" : "scale(1)",
                          transition: "all .35s ease",
                          animation: routed ? "none" : `kscan 1.1s ease-in-out ${idx * 0.18}s infinite`,
                        }}
                      >
                        <div style={{ fontSize: 22 }}>{th.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isChosen ? th.color : "#555", marginTop: 2 }}>{th.name}</div>
                        <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{th.blurb}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* working view — themed per chosen personality */}
            {streaming && !routing && (
              <div style={{ marginTop: 4, animation: "kpop .3s ease" }}>
                {/* personality banner */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: THEME[sMode].color, background: THEME[sMode].bg, border: `1px solid ${THEME[sMode].color}33`, borderRadius: 99, padding: "3px 10px", marginBottom: 8 }}>
                  <span>{THEME[sMode].icon}</span> {THEME[sMode].name} at work
                </div>
                {/* elapsed-time bar in the personality's colour */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ position: "relative", flex: 1, height: 5, background: "#ece8e3", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${(elapsed / 60) * 100}%`, height: "100%", background: THEME[sMode].color, borderRadius: 99, transition: "width .25s linear" }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#999", fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>{elapsed.toFixed(0)}s / 60s</span>
                </div>
                {/* live status — themed verb */}
                <div style={{ fontSize: 12.5, color: THEME[sMode].color, marginBottom: 8, animation: "kpulse 1.6s ease-in-out infinite" }}>
                  {THEME[sMode].icon} {sStatus || THEME[sMode].verb}
                </div>
                {/* reasoning trace — themed header/colour per personality */}
                {sThinking && (
                  <div style={{ marginBottom: 10, border: `1px solid ${THEME[sMode].color}33`, borderRadius: 8, background: THEME[sMode].bg }}>
                    <button onClick={() => setShowThinking((s) => !s)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "7px 10px", fontSize: 11, color: THEME[sMode].color, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", fontWeight: 700 }}>
                      {showThinking ? "▾" : "▸"} {THEME[sMode].trace}
                    </button>
                    {showThinking && (
                      <div style={{ maxHeight: 180, overflowY: "auto", padding: "0 10px 8px", fontSize: 11.5, color: "#888", lineHeight: 1.45 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={traceMD}>{sThinking}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
                {/* streamed answer (marker block stripped during streaming) */}
                {sText ? <AgentMessage content={splitConclude(splitPromote(splitDispatch(splitMarkerBlock(sText).clean).clean).clean).clean} mode={sMode} /> : !sThinking && <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>{THEME[sMode].verb}</div>}
              </div>
            )}
          </div>

          {/* footer: three personality input lines + judge */}
          {started && (
            <div style={{ borderTop: "1px solid #f0ece7", padding: "10px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 9 }}>
                <AskLine mode="reason" value={inReason} setValue={setInReason} onSend={() => { ask("reason", inReason); setInReason(""); }} enabled={!streaming && !auto.running} locked={false} />
                <AskLine mode="research" value={inRes} setValue={setInRes} onSend={() => { ask("research", inRes); setInRes(""); }} enabled={!streaming && !auto.running} locked={false} />
                <AskLine mode="archivist" value={inArch} setValue={setInArch} onSend={() => { ask("archivist", inArch); setInArch(""); }} enabled={!streaming && !auto.running} locked={false} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onValidate(active.id, !isValidated)}
                  style={{ flex: 1, padding: "11px", borderRadius: 8, border: `1.5px solid ${isValidated ? "#444" : "#bdb6ae"}`, background: isValidated ? "#444" : "#fffdfb", color: isValidated ? "#fff" : "#555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  {isValidated ? "✓ Identity validated" : "✓ Accept this identity"}
                </button>
                <button onClick={onBack} style={btnGhost}>Next →</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence-source classification (colours the rounded evidence boxes)
// ---------------------------------------------------------------------------
type SourceKey = "ZFIN" | "ZFA" | "GO" | "NCBI" | "UniProt";
function classifyHref(href: string): SourceKey | null {
  const h = href.toLowerCase();
  if (h.includes("zfin.org")) return "ZFIN";
  if (h.includes("/zfa") || h.includes("ols") && h.includes("zfa")) return "ZFA";
  if (h.includes("quickgo") || h.includes("geneontology") || h.includes("amigo")) return "GO";
  if (h.includes("uniprot")) return "UniProt";
  if (h.includes("ncbi.nlm.nih.gov")) return "NCBI";
  if (h.includes("ebi.ac.uk")) return "ZFA"; // OLS default → anatomy
  return null;
}
// pull the first href + any leading **SOURCE** token from a hast li node
function liSource(node: any): SourceKey | null {
  let href: string | null = null;
  const walk = (n: any) => {
    if (!n || href) return;
    if (n.tagName === "a" && n.properties?.href) href = String(n.properties.href);
    (n.children ?? []).forEach(walk);
  };
  (node?.children ?? []).forEach(walk);
  if (href) {
    const k = classifyHref(href);
    if (k) return k;
  }
  // fall back to a leading bold source word
  const txt = JSON.stringify(node ?? {});
  const m = txt.match(/\b(ZFIN|ZFA|GO|NCBI|UniProt)\b/);
  return (m?.[1] as SourceKey) ?? null;
}

// ---------------------------------------------------------------------------
const mdH: React.CSSProperties = { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, color: ACCENT, margin: "12px 0 6px", paddingTop: 8, borderTop: "1px solid #f0ece7" };
const baseMD = {
  h1: (p: any) => <div style={mdH}>{p.children}</div>,
  h2: (p: any) => <div style={mdH}>{p.children}</div>,
  h3: (p: any) => <div style={mdH}>{p.children}</div>,
  p: (p: any) => <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{p.children}</p>,
  ul: (p: any) => <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>{p.children}</ul>,
  ol: (p: any) => <ol style={{ margin: "0 0 8px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>{p.children}</ol>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#1f2937" }}>{p.children}</strong>,
  a: (p: any) => (
    <a href={p.href} target="_blank" rel="noreferrer" style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2 }}>{p.children}</a>
  ),
  blockquote: (p: any) => (
    <blockquote style={{ margin: "0 0 8px", padding: "4px 10px", borderLeft: `3px solid #e5e1dc`, color: "#777", background: "#faf8f6" }}>{p.children}</blockquote>
  ),
  code: (p: any) => <code style={{ background: "#f0eeec", padding: "1px 5px", borderRadius: 4, fontSize: 12.5 }}>{p.children}</code>,
  table: (p: any) => (
    <div style={{ border: "1px solid #d8d3cd", borderRadius: 8, overflow: "hidden", margin: "0 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{p.children}</table>
    </div>
  ),
  th: (p: any) => <th style={{ textAlign: "left", padding: "5px 8px", background: "#f3f0ec", borderBottom: "1px solid #e5e1dc", fontWeight: 700, color: "#555" }}>{p.children}</th>,
  td: (p: any) => <td style={{ padding: "5px 8px", borderBottom: "1px solid #f3f0ec" }}>{p.children}</td>,
};
// Markdown components for a personality. Every colour in an agent message is the
// PERSONALITY colour (headings, links, evidence); plain text stays neutral.
function mdFor(mode: AgentMode) {
  const th = THEME[mode];
  const heading = (p: any) => <div style={{ ...mdH, color: th.color }}>{p.children}</div>;
  const base: any = {
    ...baseMD,
    h1: heading,
    h2: heading,
    h3: heading,
    a: (p: any) => (
      <a href={p.href} target="_blank" rel="noreferrer" style={{ color: th.color, textDecoration: "underline", textUnderlineOffset: 2 }}>
        {p.children}
      </a>
    ),
  };
  if (mode !== "research") return base; // archivist tables / reasoner prose render plain
  return {
    ...base,
    // each evidence item: a small source chip + plain text — no boxed section
    li: (p: any) => {
      const src = liSource(p.node);
      if (!src) return <li style={{ lineHeight: 1.45, listStyle: "disc", marginLeft: 18 }}>{p.children}</li>;
      return (
        <li style={{ listStyle: "none", display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.45, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: th.color, border: `1px solid ${th.color}55`, borderRadius: 4, padding: "0 4px", marginTop: 2, whiteSpace: "nowrap" }}>{src}</span>
          <span>{p.children}</span>
        </li>
      );
    },
  };
}

// Compact, grey, markdown-rendered reasoning trace.
const traceMD = {
  p: (p: any) => <p style={{ margin: "0 0 5px", lineHeight: 1.45 }}>{p.children}</p>,
  h1: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h2: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  h3: (p: any) => <div style={{ fontWeight: 700, color: "#666", margin: "6px 0 3px" }}>{p.children}</div>,
  strong: (p: any) => <strong style={{ fontWeight: 700, color: "#555" }}>{p.children}</strong>,
  ul: (p: any) => <ul style={{ margin: "0 0 5px", paddingLeft: 16 }}>{p.children}</ul>,
  li: (p: any) => <li style={{ marginBottom: 2 }}>{p.children}</li>,
  a: (p: any) => <a href={p.href} target="_blank" rel="noreferrer" style={{ color: "#888" }}>{p.children}</a>,
  code: (p: any) => <code style={{ background: "#eee", padding: "0 3px", borderRadius: 3 }}>{p.children}</code>,
};

function AgentMessage({ content, mode = "research", actions }: { content: string; mode?: AgentMode; actions?: React.ReactNode }) {
  const m = content.match(/\*\*Verdict:\*\*\s*(.+)$/im);
  const verdict = m ? m[1].trim() : null;
  const body = (m ? content.slice(0, m.index) : content).trim();
  // confidence level is shown greyscale — colour encodes personality only
  const confLabel = verdict ? (/high/i.test(verdict) ? "high" : /med/i.test(verdict) ? "medium" : /low/i.test(verdict) ? "low" : null) : null;
  const verdictName = verdict ? verdict.replace(/—?\s*confidence\s+\w+\.?$/i, "").trim() : "";
  const th = THEME[mode];
  const badge = { label: `${th.name} · ${th.blurb}`, icon: th.icon, color: th.color, bg: th.bg };
  const isArchivist = mode === "archivist";
  return (
    <div
      style={{
        fontSize: 13.5,
        color: INK,
        // every personality's response sits in its own colour-bordered section
        border: `1px solid ${badge.color}33`,
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 8,
        background: "#fffdfb",
        padding: "8px 10px",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: badge.color, background: badge.bg, border: `1px solid ${badge.color}33`, borderRadius: 99, padding: "2px 9px", marginBottom: 8 }}>
        <span>{badge.icon}</span> {badge.label}
      </div>
      {isArchivist && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontStyle: "italic" }}>
          Values under “Raw facts” are read directly from the MiniFin dataset; anything under “Read” is GPT-5-Mini&apos;s inference.
        </div>
      )}
      {body && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdFor(mode)}>
          {body}
        </ReactMarkdown>
      )}
      {verdict && (
        <div style={{ marginTop: 8, border: `1px solid ${badge.color}`, borderLeft: `3px solid ${badge.color}`, borderRadius: 10, background: "#fffdfb", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: badge.color, fontWeight: 700 }}>Verdict</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2b2b2b", flex: 1 }}>{verdictName || verdict}</span>
            {confLabel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", background: "#ece8e3", padding: "2px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {confLabel}
              </span>
            )}
          </div>
        </div>
      )}
      {actions && <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focused-cluster markers panel — HUD aesthetic matching the world map
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// A floating panel that can be dragged (by its header) and resized (corner).
// children may be a render-prop receiving the inner content (w,h).
// ---------------------------------------------------------------------------
let zTop = 20; // shared stacking counter — last interacted panel sits on top

function DraggablePanel({
  title,
  accent,
  box,
  minW = 160,
  minH = 90,
  flash = false,
  autoFitHeight = false,
  onMove,
  onResize,
  onMeasure,
  children,
}: {
  title: string;
  accent: string;
  box: Box;
  minW?: number;
  minH?: number;
  flash?: boolean;
  autoFitHeight?: boolean;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMeasure?: (h: number) => void;
  children: (w: number, h: number) => React.ReactNode;
}) {
  const [z, setZ] = useState(() => ++zTop);
  const raise = () => setZ(++zTop);
  const HEADER = 24;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // auto-fit panels report their rendered height so the parent can reflow
  useEffect(() => {
    if (!autoFitHeight || !onMeasure) return;
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const report = () => onMeasure(el.offsetHeight);
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [autoFitHeight, onMeasure]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    raise();
    const sx = e.clientX, sy = e.clientY, ox = box.x, oy = box.y;
    const move = (ev: MouseEvent) => onMove(Math.max(0, ox + ev.clientX - sx), Math.max(0, oy + ev.clientY - sy));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    raise();
    const sx = e.clientX, sy = e.clientY, ow = box.w, oh = box.h;
    const move = (ev: MouseEvent) => onResize(Math.max(minW, ow + ev.clientX - sx), autoFitHeight ? box.h : Math.max(minH, oh + ev.clientY - sy));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      ref={rootRef}
      onMouseDown={raise}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: autoFitHeight ? "auto" : box.h,
        zIndex: z,
        background: "rgba(255,253,251,0.96)",
        border: `1px solid ${accent}44`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: flash ? "kflash .9s ease-out" : "none",
        transition: "top .2s ease, left .2s ease",
      }}
    >
      <div onMouseDown={startDrag} style={{ height: HEADER, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: accent, userSelect: "none" }}>
        <span style={{ opacity: 0.5 }}>⠿</span> {title}
      </div>
      <div style={{ flex: autoFitHeight ? "0 0 auto" : 1, minHeight: 0, overflow: autoFitHeight ? "visible" : "auto", padding: "0 8px 6px" }}>
        {children(box.w - 16, autoFitHeight ? 0 : box.h - HEADER - 12)}
      </div>
      <div onMouseDown={startResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, cursor: "nwse-resize", color: accent, opacity: 0.5, fontSize: 11, lineHeight: "14px", textAlign: "right" }}>◢</div>
    </div>
  );
}

// one chat-contributed annotation, shown inline beneath its gene's row
function Annot({ m }: { m: Marker }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ marginLeft: 76, marginTop: 1, marginBottom: 3, borderLeft: `2px solid ${th.color}`, paddingLeft: 7, fontSize: 10.5, color: "#666", lineHeight: 1.35 }}>
      <span style={{ fontSize: 8, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 4px", textTransform: "uppercase", marginRight: 5 }}>{th.name}</span>
      {m.note}
    </div>
  );
}

function MarkerRow({ m, max, color }: { m: Marker; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
      <span style={{ width: 70, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
      <div style={{ flex: 1, height: 7, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${(Math.abs(m.l2fc ?? 0) / max) * 100}%`, height: "100%", background: color }} />
      </div>
      <span style={{ width: 48, textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>{m.p1 != null ? `${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}</span>
    </div>
  );
}

// a chat-added gene that has floated into the up/down list as a ✦ row
function AddedRow({ m, max, color }: { m: Marker; max: number; color: string }) {
  const th = THEME[m.via ?? "research"];
  return (
    <div style={{ borderLeft: `2px solid ${th.color}`, paddingLeft: 6, marginLeft: -2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
        <span style={{ width: 66, fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
        <div style={{ flex: 1, height: 7, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          {m.l2fc != null && <div style={{ width: `${(Math.abs(m.l2fc) / max) * 100}%`, height: "100%", background: color }} />}
        </div>
        <span style={{ fontSize: 8, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 3px", textTransform: "uppercase" }}>✦{th.name[0]}</span>
      </div>
      {m.note && <div style={{ fontSize: 10, color: "#777", marginLeft: 8, lineHeight: 1.3 }}>{m.note}</div>}
    </div>
  );
}

function MarkersContent({ cluster, added }: { cluster: Cluster; added: Marker[] }) {
  const top = cluster.markers.slice(0, 8);
  const down = cluster.markersDown.slice(0, 8);
  const baseUp = new Set(top.map((m) => m.g.toLowerCase()));
  const baseDown = new Set(down.map((m) => m.g.toLowerCase()));
  const listed = new Set<string>([...top.map((m) => m.g.toLowerCase()), ...down.map((m) => m.g.toLowerCase())]);
  // annotations attach to base rows; chat genes with a direction float into the lists
  const annByGene = new Map(added.map((m) => [m.g.toLowerCase(), m]));
  const addedUp = added.filter((m) => m.dir === "up" && !baseUp.has(m.g.toLowerCase()));
  const addedDown = added.filter((m) => m.dir === "down" && !baseDown.has(m.g.toLowerCase()));
  const extra = added.filter((m) => !m.dir && !listed.has(m.g.toLowerCase()));
  const maxUp = Math.max(...top.map((m) => m.l2fc ?? 0), ...addedUp.map((m) => Math.abs(m.l2fc ?? 0)), 1);
  const maxDn = Math.max(...down.map((m) => Math.abs(m.l2fc ?? 0)), ...addedDown.map((m) => Math.abs(m.l2fc ?? 0)), 1);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "2px 0 4px" }}>▲ UP-REGULATED</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {top.map((m) => (
          <React.Fragment key={m.g}>
            <MarkerRow m={m} max={maxUp} color="#8a847b" />
            {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} />}
          </React.Fragment>
        ))}
        {addedUp.map((m) => (
          <AddedRow key={m.g} m={m} max={maxUp} color="#8a847b" />
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "9px 0 4px" }}>▼ DOWN-REGULATED</div>
      {down.length || addedDown.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {down.map((m) => (
            <React.Fragment key={m.g}>
              <MarkerRow m={m} max={maxDn} color="#b8b2a8" />
              {annByGene.has(m.g.toLowerCase()) && <Annot m={annByGene.get(m.g.toLowerCase())!} />}
            </React.Fragment>
          ))}
          {addedDown.map((m) => (
            <AddedRow key={m.g} m={m} max={maxDn} color="#b8b2a8" />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: "#aaa", lineHeight: 1.35 }}>none computed</div>
      )}

      {extra.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "9px 0 3px" }}>✦ ALSO DISCUSSED (not yet placed)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {extra.map((m) => {
              const th = THEME[m.via ?? "research"];
              return (
                <div key={m.g} style={{ fontSize: 11, borderLeft: `2px solid ${th.color}`, paddingLeft: 7 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{m.g}</span>
                  {m.l2fc != null && <span style={{ color: "#888" }}> · log2FC {m.l2fc}</span>}
                  {m.note && <span style={{ color: "#666" }}> — {m.note}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// tween a number toward `target` with ease-in-out (accelerate then decelerate)
function useTween(target: number, duration = 1100): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    if (typeof requestAnimationFrame === "undefined" || typeof performance === "undefined") {
      fromRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // easeInOutQuad
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(from + (to - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function ConfidenceContent({ pct, why }: { pct: number; why: string }) {
  // greyscale only — colour is reserved for personalities
  const shown = useTween(pct); // number scrolls smoothly (accel/decel) toward the new value
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "#2b2b2b", fontVariantNumeric: "tabular-nums", minWidth: 86, display: "inline-block" }}>{shown.toFixed(1)}%</span>
        <div style={{ flex: 1, height: 7, background: "#e8e4df", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${shown}%`, height: "100%", background: "#6b6660" }} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.45, marginTop: 6 }}>{why}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const btnPrimary: React.CSSProperties = { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #d8d3cd", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: INK };
