"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ATLAS, type AtlasNode } from "./atlas";

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const PAPER = "#f6f4f2";
const INK = "#2b2b2b";
const ACCENT = "#0e7490";
const STORAGE_KEY = "daniotype_kasperov_v2";

// ---------------------------------------------------------------------------
// Derive the flat list of clusters (the leaves of the spine tree) + a stable
// synthetic UMAP layout grouped into germ-layer lobes. Sample geometry — swaps
// for real run coords later; the shapes are what matter for the POC.
// ---------------------------------------------------------------------------
type Pt = { x: number; y: number };
interface Cluster {
  id: string;
  name: string;
  state: string | null;
  germ: string; // ecto | meso | endo
  color: string;
  proposed: string;
  nCells: number;
  degsUp: string[];
  degsDown: string[];
  points: Pt[];
  cx: number;
  cy: number; // centroid (data coords)
  bounds: { minx: number; maxx: number; miny: number; maxy: number };
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd: () => number) {
  // Box–Muller
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function hashId(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LOBES: Record<string, Pt> = {
  ecto: { x: -3.4, y: 1.7 },
  meso: { x: 3.4, y: 1.7 },
  endo: { x: 0, y: -3.1 },
};
const GERM_COLORS: Record<string, string[]> = {
  ecto: ["#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#38bdf8"],
  meso: ["#b91c1c", "#dc2626", "#ea580c", "#f59e0b", "#d97706"],
  endo: ["#15803d", "#16a34a", "#65a30d", "#84cc16", "#4d7c0f"],
};

function buildClusters(): Cluster[] {
  const parents = new Set(ATLAS.map((n) => n.parent).filter(Boolean) as string[]);
  const leaves = ATLAS.filter((n) => !parents.has(n.id));
  // group by germ layer (first id segment)
  const byGerm: Record<string, AtlasNode[]> = {};
  leaves.forEach((n) => {
    const g = n.id.split(".")[0];
    (byGerm[g] ??= []).push(n);
  });

  const clusters: Cluster[] = [];
  Object.entries(byGerm).forEach(([germ, nodes]) => {
    const lobe = LOBES[germ] ?? { x: 0, y: 0 };
    const colors = GERM_COLORS[germ] ?? ["#666"];
    const k = nodes.length;
    nodes.forEach((n, gi) => {
      const ang = (gi / Math.max(k, 1)) * Math.PI * 2 + hashId(n.id) / 4294967296;
      const rad = k === 1 ? 0 : 1.5;
      const cx = lobe.x + Math.cos(ang) * rad;
      const cy = lobe.y + Math.sin(ang) * rad;
      const rnd = mulberry32(hashId(n.id));
      const nPts = Math.max(55, Math.min(240, Math.round(Math.sqrt(n.n_cells) * 2.4)));
      const sd = 0.5;
      const points: Pt[] = [];
      let minx = Infinity,
        maxx = -Infinity,
        miny = Infinity,
        maxy = -Infinity;
      for (let i = 0; i < nPts; i++) {
        const x = cx + gauss(rnd) * sd;
        const y = cy + gauss(rnd) * sd;
        points.push({ x, y });
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
      clusters.push({
        id: n.id,
        name: n.decision.name,
        state: n.decision.state,
        germ,
        color: colors[gi % colors.length],
        proposed: n.decision.name + (n.decision.state ? ` (${n.decision.state})` : ""),
        nCells: n.n_cells,
        degsUp: n.markers.filter((m) => m.direction === "up").map((m) => m.gene),
        degsDown: n.markers.filter((m) => m.direction === "down").map((m) => m.gene),
        points,
        cx,
        cy,
        bounds: { minx, maxx, miny, maxy },
      });
    });
  });
  return clusters;
}

// ---------------------------------------------------------------------------
// UMAP canvas — global (HUD / world map) and zoom (focused cluster) modes.
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

  // Transform from data coords → canvas px (CSS units).
  const transform = useMemo(() => {
    const pad = 18;
    let minx: number, maxx: number, miny: number, maxy: number;
    if (mode === "zoom" && active) {
      const ext = Math.max(active.bounds.maxx - active.bounds.minx, active.bounds.maxy - active.bounds.miny) * 0.75 + 0.6;
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
    const sx = (width - 2 * pad) / (maxx - minx);
    const sy = (height - 2 * pad) / (maxy - miny);
    const scale = Math.min(sx, sy);
    const ox = pad + (width - 2 * pad - (maxx - minx) * scale) / 2;
    const oy = pad + (height - 2 * pad - (maxy - miny) * scale) / 2;
    const toC = (x: number, y: number) => ({
      cx: ox + (x - minx) * scale,
      cy: height - (oy + (y - miny) * scale), // invert y
    });
    return { scale, toC, minx, maxx, miny, maxy };
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

    const r = mode === "zoom" ? 2.6 : 1.6;
    clusters.forEach((c) => {
      const isActive = c.id === activeId;
      let fill = "#d6d0c9";
      if (mode === "zoom") fill = isActive ? c.color : "#e2ddd6";
      else fill = colored ? c.color : "#cbc5be";
      ctx.globalAlpha = mode === "zoom" ? (isActive ? 0.95 : 0.4) : colored ? 0.85 : 0.55;
      c.points.forEach((p) => {
        const { cx, cy } = transform.toC(p.x, p.y);
        ctx.beginPath();
        ctx.arc(cx, cy, isActive && mode === "zoom" ? r + 0.6 : r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;

    // validated checkmarks (global, colored)
    if (mode === "global" && colored) {
      clusters.forEach((c) => {
        if (!validated.has(c.id)) return;
        const { cx, cy } = transform.toC(c.cx, c.cy);
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#15803d";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx - 1, cy + 2.5);
        ctx.lineTo(cx + 3.2, cy - 2.5);
        ctx.stroke();
      });
    }

    // focus rectangle on HUD
    if (showFocus && active) {
      const a = transform.toC(active.bounds.minx, active.bounds.maxy);
      const b = transform.toC(active.bounds.maxx, active.bounds.miny);
      const x = Math.min(a.cx, b.cx) - 4;
      const y = Math.min(a.cy, b.cy) - 4;
      const w = Math.abs(b.cx - a.cx) + 8;
      const h = Math.abs(b.cy - a.cy) + 8;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
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
    if (bestId && bestD < 55) onPick(bestId);
  }

  return (
    <canvas
      ref={ref}
      onClick={handleClick}
      style={{
        width,
        height,
        display: "block",
        cursor: onPick && mode === "global" && colored ? "pointer" : "default",
        borderRadius: 10,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Top-level wizard
// ---------------------------------------------------------------------------
type Stage = "intro" | "map" | "cluster";

export default function KasperovClient() {
  const clusters = useMemo(buildClusters, []);
  const [stage, setStage] = useState<Stage>("intro");
  const [revealed, setRevealed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.validated)) setValidated(new Set(p.validated));
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ validated: Array.from(validated) }));
    } catch {}
  }, [validated, loaded]);

  function openCluster(id: string) {
    setActiveId(id);
    setStage("cluster");
  }
  function markValidated(id: string, yes: boolean) {
    setValidated((prev) => {
      const next = new Set(prev);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (stage === "intro") return <Intro onStart={() => setStage("map")} />;

  if (stage === "map")
    return (
      <MapStage
        clusters={clusters}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        validated={validated}
        onPick={openCluster}
      />
    );

  const active = clusters.find((c) => c.id === activeId)!;
  return (
    <ClusterStage
      clusters={clusters}
      active={active}
      validated={validated}
      onBack={() => setStage("map")}
      onValidate={markValidated}
    />
  );
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 720, padding: "84px 28px" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>
          daniotype · kasperov
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 700, margin: "10px 0 6px", lineHeight: 1.08 }}>
          Label the atlas, together
        </h1>
        <p style={{ fontSize: 18, color: "#555", lineHeight: 1.6, marginTop: 14 }}>
          Kasparov&apos;s wager: the strongest systems are human–AI hybrids. Here you fly over the whole MiniFin
          single-cell atlas, drop into any cluster, and a research agent pulls grounded evidence from the
          canonical zebrafish resources (ZFIN, ZFA, GO) for the cluster&apos;s top markers. You decide whether its
          read is on track — accept it, or dig deeper in chat.
        </p>
        <button
          onClick={onStart}
          style={{
            marginTop: 28,
            background: ACCENT,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "15px 30px",
            fontSize: 18,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Begin the descent →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map stage — global UMAP → reveal Leiden clusters → click in
// ---------------------------------------------------------------------------
function MapStage({
  clusters,
  revealed,
  onReveal,
  validated,
  onPick,
}: {
  clusters: Cluster[];
  revealed: boolean;
  onReveal: () => void;
  validated: Set<string>;
  onPick: (id: string) => void;
}) {
  const [size, setSize] = useState({ w: 720, h: 560 });
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function fit() {
      const w = Math.min(820, (wrap.current?.clientWidth ?? 760) - 8);
      setSize({ w, h: Math.round(w * 0.74) });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px 60px", textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>
          World map · MiniFin atlas
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 2px" }}>
          {revealed ? "Choose a cluster to investigate" : "The whole dataset"}
        </h2>
        <p style={{ color: "#666", fontSize: 15, marginTop: 0, marginBottom: 18 }}>
          {revealed
            ? `${clusters.length} Leiden clusters · ${validated.size} validated. Click any cluster to begin.`
            : "Every cell, one point. Reveal the Leiden clustering to start labelling."}
        </p>

        <div
          ref={wrap}
          style={{
            display: "inline-block",
            background: "#fffdfb",
            border: "1px solid #e5e1dc",
            borderRadius: 14,
            padding: 10,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <UmapCanvas
            clusters={clusters}
            mode="global"
            colored={revealed}
            activeId={null}
            validated={validated}
            width={size.w}
            height={size.h}
            onPick={onPick}
          />
        </div>

        <div style={{ marginTop: 20 }}>
          {!revealed ? (
            <button
              onClick={onReveal}
              style={{
                background: ACCENT,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "13px 26px",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Leiden clusters →
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {clusters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: "#fffdfb",
                    border: `1px solid ${validated.has(c.id) ? "#15803d" : "#e5e1dc"}`,
                    borderRadius: 99,
                    padding: "6px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    color: INK,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: c.color }} />
                  {c.name}
                  {validated.has(c.id) && <span style={{ color: "#15803d", fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cluster stage — zoomed map (left) + HUD world map (bottom-left) + agent (right)
// ---------------------------------------------------------------------------
type ChatMsg = { role: "user" | "assistant"; content: string };

function defaultPrompt(c: Cluster): string {
  const upList = c.degsUp.slice(0, 6).join(", ");
  const downList = c.degsDown.slice(0, 3).join(", ");
  return (
    `This cluster's top up-regulated markers are ${upList || "(none)"}` +
    (downList ? `, and notably absent: ${downList}` : "") +
    `. Using ZFIN curated expression, ZFA anatomy, and GO, identify the most likely zebrafish cell type ` +
    `(with state if supported), grounding each claim in a cited record. The pipeline tentatively calls it ` +
    `"${c.proposed}" — verify or refute that.`
  );
}

function ClusterStage({
  clusters,
  active,
  validated,
  onBack,
  onValidate,
}: {
  clusters: Cluster[];
  active: Cluster;
  validated: Set<string>;
  onBack: () => void;
  onValidate: (id: string, yes: boolean) => void;
}) {
  // agent transcript per cluster, kept in memory for the session
  const [transcripts, setTranscripts] = useState<Record<string, ChatMsg[]>>({});
  const [prompt, setPrompt] = useState(defaultPrompt(active));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoomW, setZoomW] = useState(560);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const msgs = transcripts[active.id] ?? [];
  const started = msgs.length > 0;

  useEffect(() => {
    setPrompt(defaultPrompt(active));
    setInput("");
  }, [active.id]);

  useEffect(() => {
    function fit() {
      setZoomW(Math.max(360, (leftRef.current?.clientWidth ?? 560) - 24));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, loading]);

  async function callAgent(nextMsgs: ChatMsg[]) {
    setLoading(true);
    setTranscripts((t) => ({ ...t, [active.id]: nextMsgs }));
    try {
      const r = await fetch("/api/kasperov_agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clusterId: active.id, messages: nextMsgs }),
      });
      const data = await r.json();
      const reply: string = data?.reply ?? "_(the agent returned no text)_";
      setTranscripts((t) => ({ ...t, [active.id]: [...nextMsgs, { role: "assistant", content: reply }] }));
    } catch (e: any) {
      setTranscripts((t) => ({
        ...t,
        [active.id]: [...nextMsgs, { role: "assistant", content: `_Request failed: ${String(e?.message ?? e)}_` }],
      }));
    } finally {
      setLoading(false);
    }
  }

  function runResearch() {
    if (loading) return;
    callAgent([{ role: "user", content: prompt }]);
  }
  function sendChat() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    callAgent([...msgs, { role: "user", content: text }]);
  }

  const isValidated = validated.has(active.id);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: PAPER, color: INK }}>
      {/* slim top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 18px",
          borderBottom: "1px solid #e5e1dc",
          background: "#fffdfb",
        }}
      >
        <button onClick={onBack} style={btnGhost}>
          ← World map
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: active.color }} />
          <strong style={{ fontSize: 16 }}>{active.name}</strong>
          {active.state && <span style={{ color: "#b45309" }}>· {active.state}</span>}
        </div>
        <span style={{ fontSize: 13, color: "#888" }}>{active.nCells.toLocaleString()} cells</span>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>
          {validated.size}/{clusters.length} validated
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT — zoomed cluster map + HUD world map overlay */}
        <div
          ref={leftRef}
          style={{
            flex: "1.25 1 0",
            position: "relative",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 50% 40%, #fffefc, #f1ede8)",
          }}
        >
          <div style={{ position: "absolute", top: 16, left: 18, fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>
            Focused cluster
          </div>
          <UmapCanvas
            clusters={clusters}
            mode="zoom"
            colored
            activeId={active.id}
            validated={validated}
            width={zoomW}
            height={Math.round(zoomW * 0.8)}
          />
          {/* HUD world map */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(255,253,251,0.92)",
              border: "1px solid #e5e1dc",
              borderRadius: 10,
              padding: 6,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: 10, color: "#999", textAlign: "center", marginBottom: 2, letterSpacing: 0.5 }}>
              WORLD MAP
            </div>
            <UmapCanvas
              clusters={clusters}
              mode="global"
              colored
              activeId={active.id}
              validated={validated}
              width={200}
              height={150}
              showFocus
            />
          </div>
        </div>

        {/* RIGHT — research agent */}
        <aside
          style={{
            width: 460,
            flexShrink: 0,
            borderLeft: "1px solid #e5e1dc",
            background: "#fffdfb",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid #f0ece7" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>
              Research agent
            </div>
            <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>
              Searches ZFIN · ZFA · GO for this cluster&apos;s markers. You judge the result.
            </div>
          </div>

          {/* thread */}
          <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {!started && (
              <div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>
                  Pre-filled prompt from the cluster&apos;s top DEGs — edit if you like, then run it.
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 140,
                    padding: 10,
                    border: "1px solid #d8d3cd",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                    resize: "vertical",
                    background: "#fff",
                  }}
                />
                <button
                  onClick={runResearch}
                  disabled={loading}
                  style={{ ...btnPrimary, width: "100%", marginTop: 10, opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Researching…" : "▶ Run research agent"}
                </button>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: m.role === "user" ? "#999" : ACCENT,
                    fontWeight: 600,
                    marginBottom: 3,
                  }}
                >
                  {m.role === "user" ? "You asked" : "Agent"}
                </div>
                {m.role === "user" ? (
                  <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5 }}>{m.content}</div>
                ) : (
                  <div className="kasperov-md" style={{ fontSize: 13.5, color: INK, lineHeight: 1.55 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {loading && started && (
              <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>Agent is searching the literature…</div>
            )}
          </div>

          {/* judge + chat footer */}
          {started && (
            <div style={{ borderTop: "1px solid #f0ece7", padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Ask the agent to dig deeper…"
                  style={{
                    flex: 1,
                    padding: "9px 11px",
                    border: "1px solid #d8d3cd",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    background: "#fff",
                  }}
                />
                <button onClick={sendChat} disabled={loading} style={{ ...btnGhost, opacity: loading ? 0.5 : 1 }}>
                  Send
                </button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    onValidate(active.id, !isValidated);
                  }}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 8,
                    border: `1.5px solid #15803d`,
                    background: isValidated ? "#15803d" : "#fffdfb",
                    color: isValidated ? "#fff" : "#15803d",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {isValidated ? "✓ Identity validated" : "✓ Accept this identity"}
                </button>
                <button onClick={onBack} style={btnGhost}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const btnPrimary: React.CSSProperties = {
  background: ACCENT,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #d8d3cd",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  color: INK,
};
