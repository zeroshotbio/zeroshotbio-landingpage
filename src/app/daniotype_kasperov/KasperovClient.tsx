"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
const PAPER = "#f6f4f2";
const INK = "#2b2b2b";
const ACCENT = "#0e7490";
const STORAGE_KEY = "daniotype_kasperov_v3";
const DATA_URL = "/daniotype_kasperov/minifin_umap.json";

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Marker = { g: string; l2fc?: number; p1?: number; p2?: number; note?: string; via?: AgentMode };
interface Cluster {
  id: string;
  label: string;
  nCells: number;
  color: string;
  cx: number;
  cy: number;
  degsUp: string[];
  markers: Marker[];
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
      ctx.strokeStyle = ACCENT;
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
type Stage = "intro" | "map" | "cluster";

export default function KasperovClient() {
  const { clusters, meta, error } = useAtlas();
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
        onPick={(id) => {
          setActiveId(id);
          setStage("cluster");
        }}
      />
    );

  const active = clusters.find((c) => c.id === activeId)!;
  return (
    <ClusterStage clusters={clusters} active={active} validated={validated} onBack={() => setStage("map")} onValidate={markValidated} />
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
function MapStage({
  clusters,
  meta,
  revealed,
  onReveal,
  validated,
  onPick,
}: {
  clusters: Cluster[];
  meta: AtlasMeta | null;
  revealed: boolean;
  onReveal: () => void;
  validated: Set<string>;
  onPick: (id: string) => void;
}) {
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxHeight: 150, overflowY: "auto", padding: 4 }}>
              {clusters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffdfb", border: `1px solid ${validated.has(c.id) ? "#15803d" : "#e5e1dc"}`, borderRadius: 99, padding: "5px 10px", fontSize: 12.5, cursor: "pointer", color: INK }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color }} />
                  {c.label}
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
function splitMarkerBlock(content: string): { clean: string; markers: Marker[] } {
  const re = /```kasperov-markers\s*([\s\S]*?)```/i;
  const m = content.match(re);
  if (!m) return { clean: content, markers: [] };
  let markers: Marker[] = [];
  try {
    const arr = JSON.parse(m[1].trim());
    if (Array.isArray(arr))
      markers = arr
        .filter((x) => x && typeof x.g === "string")
        .map((x) => ({ g: x.g, l2fc: x.l2fc ?? undefined, p1: x.p1 ?? undefined, p2: x.p2 ?? undefined, note: x.note ?? undefined }));
  } catch {}
  return { clean: content.replace(re, "").trim(), markers };
}

function defaultPrompt(c: Cluster): string {
  const upList = c.degsUp.slice(0, 8).join(", ");
  return (
    `${c.label}'s top up-regulated markers are: ${upList || "(none)"}. ` +
    `Using ZFIN curated expression, ZFA anatomy, and GO, identify the most likely zebrafish cell type ` +
    `(with state if the markers support it), grounding each claim in a cited record. If the evidence is ambiguous, say so.`
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
  const [transcripts, setTranscripts] = useState<Record<string, ChatMsg[]>>({});
  const [prompt, setPrompt] = useState(defaultPrompt(active));
  const [input, setInput] = useState("");
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

  // markers added to the Top Markers panel from chat, per cluster
  const [augmented, setAugmented] = useState<Record<string, Marker[]>>({});
  const [incorporated, setIncorporated] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(false);

  function incorporate(msgKey: string, markers: Marker[], via: AgentMode) {
    setAugmented((a) => {
      const cur = a[active.id] ?? [];
      const byGene = new Map(cur.map((m) => [m.g, m]));
      markers.forEach((m) => byGene.set(m.g, { ...byGene.get(m.g), ...m, via }));
      return { ...a, [active.id]: Array.from(byGene.values()) };
    });
    setIncorporated((s) => new Set(s).add(msgKey));
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  }

  // live confidence box (appears once there's a conversation to assess)
  const [confidence, setConfidence] = useState<Record<string, { pct: number; why: string }>>({});
  async function refreshConfidence(msgs: ChatMsg[], clusterId: string) {
    if (!msgs.some((m) => m.role === "assistant")) return;
    try {
      const r = await fetch("/api/kasperov_confidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cluster: { id: clusterId, label: active.label }, messages: msgs }),
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
    setInput("");
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

  // place the floating panels once we know the container size (then they're draggable)
  const [placed, setPlaced] = useState(false);
  const placementsRef = useRef<{ wm: Box; mk: Box; cf: Box } | null>(null);
  useEffect(() => {
    if (placed || containerSize.w < 60 || containerSize.h < 60) return;
    const W = containerSize.w, H = containerSize.h;
    placementsRef.current = {
      wm: { x: 14, y: Math.max(40, H - 200), w: 226, h: 184 },
      mk: { x: Math.max(14, W - 256), y: Math.max(40, H - 252), w: 242, h: 238 },
      cf: { x: Math.max(14, W - 264), y: 14, w: 250, h: 122 },
    };
    setPlaced(true);
  }, [containerSize, placed]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, sText, sThinking, streaming]);

  async function streamAgent(nextMsgs: ChatMsg[]) {
    setTranscripts((t) => ({ ...t, [active.id]: nextMsgs }));
    setStreaming(true);
    setRouting(true);
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
    let mode: AgentMode = "research";
    try {
      const res = await fetch("/api/kasperov_agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cluster: { id: active.id, label: active.label, degsUp: active.degsUp, markers: active.markers, nCells: active.nCells },
          messages: nextMsgs,
        }),
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
            // hold the selection screen ~2s — it's a feature, let it breathe
            const wait = Math.max(0, 2000 - (Date.now() - startedAt));
            setTimeout(() => setRouting(false), wait);
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
      const finalMsgs: ChatMsg[] = [...nextMsgs, { role: "assistant", content: acc || "_(no response)_", mode }];
      setTranscripts((t) => ({ ...t, [active.id]: finalMsgs }));
      setStreaming(false);
      setRouting(false);
      setStatus("");
      setText("");
      setThinking("");
      refreshConfidence(finalMsgs, active.id);
    }
  }

  function runResearch() {
    if (streaming) return;
    streamAgent([{ role: "user", content: prompt }]);
  }
  function sendChat() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    streamAgent([...msgs, { role: "user", content: text }]);
  }

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
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>{validated.size}/{clusters.length} validated</div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT — zoom map + HUD */}
        <div ref={leftRef} style={{ flex: "1.25 1 0", position: "relative", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #fffefc, #f1ede8)" }}>
          <div style={{ position: "absolute", top: 16, left: 18, fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Focused cluster</div>
          <UmapCanvas clusters={clusters} mode="zoom" colored activeId={active.id} validated={validated} width={zoomW} height={Math.round(zoomW * 0.8)} />

          {placed && placementsRef.current && (
            <>
              {/* world map — draggable + resizable */}
              <DraggablePanel title="WORLD MAP" accent="#999" initial={placementsRef.current.wm} minW={150} minH={120}>
                {(w, h) => <UmapCanvas clusters={clusters} mode="global" colored activeId={active.id} validated={validated} width={w} height={h} showFocus />}
              </DraggablePanel>

              {/* top markers — draggable + resizable; grows in content as chat adds insight */}
              <DraggablePanel title={`TOP MARKERS${(augmented[active.id] ?? []).length ? ` · +${(augmented[active.id] ?? []).length} from chat` : ""}`} accent="#15803d" initial={placementsRef.current.mk} minW={190} minH={140} flash={flash}>
                {() => <MarkersContent cluster={active} added={augmented[active.id] ?? []} />}
              </DraggablePanel>

              {/* live confidence — only once the chat gives us reason to score it */}
              {confidence[active.id] && (
                <DraggablePanel title="CONFIDENCE" accent="#0e7490" initial={placementsRef.current.cf} minW={180} minH={96}>
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
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>GPT-5-Mini</div>
            <div style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>Searches ZFIN · ZFA · GO for this cluster&apos;s markers. You judge the result.</div>
          </div>

          <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {msgs.length === 0 && !streaming && (
              <div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>Pre-filled from the cluster&apos;s top DEGs — edit if you like, then run it.</div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", minHeight: 130, padding: 10, border: "1px solid #d8d3cd", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", background: "#fff" }} />
                <button onClick={runResearch} style={{ ...btnPrimary, width: "100%", marginTop: 10 }}>▶ Run research agent</button>
              </div>
            )}

            {msgs.map((m, i) => {
              const parsed = m.role === "assistant" ? splitMarkerBlock(m.content) : { clean: m.content, markers: [] };
              const key = `${active.id}:${i}`;
              const canAdd = parsed.markers.length > 0 && !incorporated.has(key);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: m.role === "user" ? "#999" : ACCENT, fontWeight: 600, marginBottom: 3 }}>
                    {m.role === "user" ? "You asked" : "GPT-5-Mini"}
                  </div>
                  {m.role === "user" ? (
                    <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5 }}>{m.content}</div>
                  ) : (
                    <>
                      <AgentMessage content={parsed.clean} mode={m.mode} />
                      {canAdd && (
                        <button
                          onClick={() => incorporate(key, parsed.markers, m.mode ?? "research")}
                          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, background: THEME[m.mode ?? "research"].bg, border: `1px solid ${THEME[m.mode ?? "research"].color}55`, color: THEME[m.mode ?? "research"].color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                        >
                          ➕ Add {parsed.markers.length} {THEME[m.mode ?? "research"].name} insight{parsed.markers.length === 1 ? "" : "s"} to Top Markers →
                        </button>
                      )}
                      {parsed.markers.length > 0 && incorporated.has(key) && (
                        <div style={{ marginTop: 6, fontSize: 11.5, color: "#15803d", fontWeight: 600 }}>✓ added to Top Markers</div>
                      )}
                    </>
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
                    <div style={{ width: `${(elapsed / 60) * 100}%`, height: "100%", background: elapsed > 50 ? "#b45309" : THEME[sMode].color, borderRadius: 99, transition: "width .25s linear" }} />
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
                      <div style={{ maxHeight: 170, overflowY: "auto", padding: "0 10px 8px", fontSize: 12, color: "#666", lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" }}>{sThinking}</div>
                    )}
                  </div>
                )}
                {/* streamed answer (marker block stripped during streaming) */}
                {sText ? <AgentMessage content={splitMarkerBlock(sText).clean} mode={sMode} /> : !sThinking && <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>{THEME[sMode].verb}</div>}
              </div>
            )}
          </div>

          {/* footer: chat + judge */}
          {started && (
            <div style={{ borderTop: "1px solid #f0ece7", padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder={streaming ? "Agent is working…" : "Ask the agent to dig deeper…"}
                  disabled={streaming}
                  style={{ flex: 1, padding: "9px 11px", border: "1px solid #d8d3cd", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: streaming ? "#f3f0ec" : "#fff" }}
                />
                <button onClick={sendChat} disabled={streaming} style={{ ...btnGhost, opacity: streaming ? 0.5 : 1 }}>Send</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onValidate(active.id, !isValidated)}
                  style={{ flex: 1, padding: "11px", borderRadius: 8, border: `1.5px solid #15803d`, background: isValidated ? "#15803d" : "#fffdfb", color: isValidated ? "#fff" : "#15803d", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
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
const SOURCE_STYLE: Record<SourceKey, { color: string; bg: string }> = {
  ZFIN: { color: "#2563eb", bg: "#eff6ff" },
  ZFA: { color: "#7c3aed", bg: "#f5f3ff" },
  GO: { color: "#15803d", bg: "#f0fdf4" },
  NCBI: { color: "#0e7490", bg: "#ecfeff" },
  UniProt: { color: "#ea580c", bg: "#fff7ed" },
};
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
// research mode: bullets become source-coloured rounded boxes
const researchMD = {
  ...baseMD,
  li: (p: any) => {
    const src = liSource(p.node);
    if (!src) return <li style={{ lineHeight: 1.45, listStyle: "disc", marginLeft: 18 }}>{p.children}</li>;
    const st = SOURCE_STYLE[src];
    return (
      <li style={{ listStyle: "none", display: "flex", gap: 8, alignItems: "flex-start", background: st.bg, border: `1px solid ${st.color}33`, borderLeft: `3px solid ${st.color}`, borderRadius: 8, padding: "6px 9px", lineHeight: 1.4 }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: st.color, background: "#fff", border: `1px solid ${st.color}55`, borderRadius: 5, padding: "1px 5px", marginTop: 1, whiteSpace: "nowrap" }}>{src}</span>
        <span>{p.children}</span>
      </li>
    );
  },
};
const archivistMD = { ...baseMD, li: (p: any) => <li style={{ lineHeight: 1.45, listStyle: "disc", marginLeft: 18 }}>{p.children}</li> };

function AgentMessage({ content, mode = "research" }: { content: string; mode?: AgentMode }) {
  const m = content.match(/\*\*Verdict:\*\*\s*(.+)$/im);
  const verdict = m ? m[1].trim() : null;
  const body = (m ? content.slice(0, m.index) : content).trim();
  const conf = verdict
    ? /high/i.test(verdict)
      ? { label: "high", color: "#15803d", bg: "#dcfce7" }
      : /med/i.test(verdict)
      ? { label: "medium", color: "#b45309", bg: "#fef3c7" }
      : /low/i.test(verdict)
      ? { label: "low", color: "#b91c1c", bg: "#fee2e2" }
      : null
    : null;
  const verdictName = verdict ? verdict.replace(/—?\s*confidence\s+\w+\.?$/i, "").trim() : "";
  const th = THEME[mode];
  const badge = { label: `${th.name} · ${th.blurb}`, icon: th.icon, color: th.color, bg: th.bg };
  const isArchivist = mode === "archivist";
  return (
    <div
      style={{
        fontSize: 13.5,
        color: INK,
        ...(isArchivist
          ? { border: `1px solid ${badge.color}33`, borderLeft: `3px solid ${badge.color}`, borderRadius: 8, background: "#fbfbff", padding: "8px 10px" }
          : {}),
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
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={isArchivist ? archivistMD : researchMD}>
          {body}
        </ReactMarkdown>
      )}
      {verdict && (
        <div style={{ marginTop: 8, border: `1px solid ${conf?.color ?? ACCENT}`, borderRadius: 10, background: "#fffdfb", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "#999", fontWeight: 700 }}>Verdict</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", flex: 1 }}>{verdictName || verdict}</span>
            {conf && (
              <span style={{ fontSize: 11, fontWeight: 700, color: conf.color, background: conf.bg, padding: "2px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {conf.label}
              </span>
            )}
          </div>
        </div>
      )}
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
function DraggablePanel({
  title,
  accent,
  initial,
  minW = 160,
  minH = 90,
  flash = false,
  children,
}: {
  title: string;
  accent: string;
  initial: Box;
  minW?: number;
  minH?: number;
  flash?: boolean;
  children: (w: number, h: number) => React.ReactNode;
}) {
  const [box, setBox] = useState<Box>(initial);
  const HEADER = 24;

  function onDrag(e: React.MouseEvent) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const o = { ...box };
    const move = (ev: MouseEvent) => setBox((b) => ({ ...b, x: Math.max(0, o.x + ev.clientX - sx), y: Math.max(0, o.y + ev.clientY - sy) }));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
  function onResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const o = { ...box };
    const move = (ev: MouseEvent) => setBox((b) => ({ ...b, w: Math.max(minW, o.w + ev.clientX - sx), h: Math.max(minH, o.h + ev.clientY - sy) }));
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
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        background: "rgba(255,253,251,0.96)",
        border: `1px solid ${accent}44`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: flash ? "kflash .9s ease-out" : "none",
      }}
    >
      <div onMouseDown={onDrag} style={{ height: HEADER, flexShrink: 0, cursor: "move", display: "flex", alignItems: "center", gap: 6, padding: "0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: accent, userSelect: "none" }}>
        <span style={{ opacity: 0.5 }}>⠿</span> {title}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 8px 6px" }}>{children(box.w - 16, box.h - HEADER - 12)}</div>
      <div onMouseDown={onResize} title="Resize" style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, cursor: "nwse-resize", color: accent, opacity: 0.5, fontSize: 11, lineHeight: "14px", textAlign: "right" }}>◢</div>
    </div>
  );
}

function MarkersContent({ cluster, added }: { cluster: Cluster; added: Marker[] }) {
  const top = cluster.markers.slice(0, 8);
  const maxFc = Math.max(...top.map((m) => m.l2fc ?? 0), 1);
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", margin: "2px 0 4px" }}>▲ UP-REGULATED</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {top.map((m) => (
          <div key={m.g} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
            <span style={{ width: 70, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.g}>{m.g}</span>
            <div style={{ flex: 1, height: 7, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${((m.l2fc ?? 0) / maxFc) * 100}%`, height: "100%", background: "#15803d" }} />
            </div>
            <span style={{ width: 48, textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>{m.p1 != null ? `${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}</span>
          </div>
        ))}
      </div>

      {added.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#555", margin: "9px 0 3px" }}>✦ ADDED FROM CHAT</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {added.map((m) => {
              const th = THEME[m.via ?? "research"];
              return (
                <div key={m.g} style={{ fontSize: 11.5, borderLeft: `3px solid ${th.color}`, background: th.bg, borderRadius: 5, padding: "4px 7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{m.g}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: th.color, border: `1px solid ${th.color}66`, borderRadius: 4, padding: "0 4px", textTransform: "uppercase" }}>{th.name}</span>
                  </div>
                  {(m.l2fc != null || m.p1 != null) && (
                    <div style={{ color: "#888", fontVariantNumeric: "tabular-nums" }}>
                      {m.l2fc != null ? `log2FC ${m.l2fc}` : ""}{m.p1 != null ? `${m.l2fc != null ? " · " : ""}${(m.p1 * 100).toFixed(0)}/${((m.p2 ?? 0) * 100).toFixed(0)}%` : ""}
                    </div>
                  )}
                  {m.note && <div style={{ color: "#555", lineHeight: 1.35 }}>{m.note}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: "#b45309", margin: "9px 0 2px" }}>▼ DOWN-REGULATED</div>
      <div style={{ fontSize: 10.5, color: "#aaa", lineHeight: 1.35 }}>Not in the split-pipe export — computable from the h5ad on request.</div>
    </div>
  );
}

function ConfidenceContent({ pct, why }: { pct: number; why: string }) {
  const color = pct >= 75 ? "#15803d" : pct >= 50 ? "#b45309" : "#b91c1c";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        <div style={{ flex: 1, height: 7, background: "#ece8e3", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s ease" }} />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.45, marginTop: 6 }}>{why}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const btnPrimary: React.CSSProperties = { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #d8d3cd", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: INK };
