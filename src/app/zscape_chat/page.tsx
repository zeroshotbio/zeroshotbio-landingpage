"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";

const ENDPOINT =
  process.env.NEXT_PUBLIC_ZSCAPE_ENDPOINT ?? "http://localhost:5002";

// ── constants ──────────────────────────────────────────────────────────────────

const CATS = [
  "notochord", "somitic muscle", "NMp stalling", "neural crest",
  "cranial ganglia", "hindbrain seg.", "Hh / floor plate",
  "cardiac / LPM", "pharyngeal arch", "posterior axis",
];
const SW = ["", "weak", "moderate", "strong"];
// teal fill: 0=empty 1=dim 2=mid 3=bright
const BT = ["rgba(0,0,0,0.06)", "#b8ddd3", "#1D9E75", "#0d5c3f"];
// amber fill
const BA = ["rgba(0,0,0,0.06)", "#fde4b0", "#D4870D", "#9a5f0a"];

// ── ground truth ──────────────────────────────────────────────────────────────

const GT: Record<string, number[]> = {
  "tbxta":         [3,2,0,0,0,0,0,0,0,3],
  "noto":          [3,1,0,0,0,0,0,0,0,2],
  "foxa2;foxa3":   [3,0,0,0,0,0,0,0,0,1],
  "tbx16":         [0,3,3,0,0,0,0,0,0,2],
  "tbx16;msgn1":   [0,3,3,0,0,0,0,0,0,3],
  "tbx16;tbx16l":  [0,3,3,0,0,0,0,0,0,2],
  "msgn1":         [0,2,2,0,0,0,0,0,0,0],
  "wnt3a;wnt8a":   [0,2,0,0,0,0,0,0,0,2],
  "cdx4":          [0,0,0,0,0,0,0,0,0,2],
  "cdx4;cdx1a":    [0,0,0,0,0,2,0,0,0,3],
  "smo":           [0,3,0,1,0,0,3,0,0,0],
  "hand2":         [0,0,0,0,0,0,0,3,2,0],
  "tbx1":          [0,0,0,0,0,0,0,0,3,0],
  "foxd3":         [0,0,0,2,2,0,0,0,2,0],
  "tfap2a":        [0,0,0,2,2,0,0,0,2,0],
  "tfap2a;foxd3":  [0,0,0,3,3,0,0,0,3,0],
  "egr2b":         [0,0,0,0,0,3,0,0,0,0],
  "mafba":         [0,0,0,0,0,2,0,0,0,0],
  "hoxb1a":        [0,0,0,0,0,3,0,0,0,0],
  "epha4a":        [0,0,0,0,0,2,0,0,0,0],
  "zc4h2":         [0,0,0,0,0,0,0,0,0,0],
  "phox2a":        [0,0,0,0,2,0,0,0,0,0],
  "foxi1":         [0,0,0,0,3,0,0,0,0,0],
  "met":           [0,2,0,0,0,0,0,1,0,0],
  "hgfa":          [0,1,0,0,0,0,0,0,0,0],
};

const KD: Record<string, string> = {
  "tbxta":         "T-box TF, master notochord and posterior mesoderm regulator (brachyury / no tail)",
  "noto":          "Homeodomain TF, notochord maintenance and floor plate induction",
  "foxa2;foxa3":   "Forkhead TFs, axial mesoderm and notochord specification",
  "tbx16":         "T-box TF, paraxial mesoderm differentiation from NMps (spadetail)",
  "tbx16;msgn1":   "Cooperative NMp differentiation regulators — strong muscle loss + progenitor stalling",
  "tbx16;tbx16l":  "Paralogous T-box TFs with redundant somitogenesis control",
  "msgn1":         "bHLH TF, presomitic mesoderm differentiation from NMps",
  "wnt3a;wnt8a":   "Wnt ligands maintaining the NMp tail bud zone",
  "cdx4":          "Caudal-type homeodomain TF, posterior axis and HOX patterning",
  "cdx4;cdx1a":    "Paralogous Cdx TFs — strong posterior truncation and hindbrain HOX disruption",
  "smo":           "Smoothened, obligate Hedgehog signal transducer — canonical slow muscle and floor plate",
  "hand2":         "bHLH TF, ventricular cardiomyocyte specification (hands off mutant)",
  "tbx1":          "T-box TF, pharyngeal arch and outflow tract development (DiGeorge / van gogh)",
  "foxd3":         "Forkhead TF, neural crest progenitor maintenance and survival",
  "tfap2a":        "AP-2 TF, neural crest specification and differentiation",
  "tfap2a;foxd3":  "Combined loss — nearly all neural crest derivatives absent",
  "egr2b":         "Zinc-finger TF, master r3/r5 rhombomere identity regulator (krox20)",
  "mafba":         "Large Maf bZIP TF, r5/r6 rhombomere identity (valentino)",
  "hoxb1a":        "Homeodomain TF, r4 identity and r4-derived neuron specification",
  "epha4a":        "Eph receptor tyrosine kinase, rhombomere boundary cell sorting",
  "zc4h2":         "Zinc finger protein, spinal motor neuron and ventral interneuron development",
  "phox2a":        "Paired homeodomain TF, epibranchial cranial ganglion differentiation",
  "foxi1":         "Forkhead TF, otic placode and all four cranial ganglia classes",
  "met":           "HGF receptor tyrosine kinase, fast muscle progenitor dispersal and liver development",
  "hgfa":          "HGF activator serine protease, cleaves pro-HGF to activate Met signaling",
};

const GT_FLAT = Object.entries(GT).map(([k, v]) => `${k}: [${v}]`).join("\n");
const KD_FLAT = Object.entries(KD).map(([k, v]) => `${k}: ${v}`).join("\n");

const SYS_MAIN = `You are a zebrafish developmental biologist assistant for the ZSCAPE perturbation database.

GROUND TRUTH (verified v3.2):
${GT_FLAT}

KO descriptions:
${KD_FLAT}

RULES:
1. Known KO query → 2-3 sentence biological commentary only. Scores are shown visually — do NOT list them.
2. Unknown KO / explicit prediction → respond ONLY with JSON:
{"mode":"prediction","gene":"<name>","gene_description":"<one sentence molecular function>","nearest_ko":"<most similar GT KO>","nearest_ko_reason":"<one sentence>","similarity":<0-1>,"confidence":<1-5>,"confidence_reason":"<one sentence>","scores":[n,n,n,n,n,n,n,n,n,n],"commentary":"<2-3 sentences>"}
Confidence: 5=well-studied zebrafish gene, 4=high, 3=moderate, 2=low, 1=no zebrafish data.
3. Ranking/comparison/general → plain prose, 2-4 sentences, no markdown.`;

const SYS_RIDGE_META = `You are a zebrafish developmental biologist assistant.
The Ridge model has already predicted influence scores for this gene. Your job is to provide biological interpretation ONLY.
Respond ONLY with JSON — no other text:
{"gene_description":"<one sentence molecular function>","nearest_ko_reason":"<one sentence why the provided nearest KO makes biological sense>","confidence":<1-5>,"confidence_reason":"<one sentence>","commentary":"<2-3 sentence biological interpretation of the predicted scores>"}
Confidence guide: 5=well-studied zebrafish gene with clear pathway, 4=high, 3=moderate, 2=poorly characterised, 1=no zebrafish data.`;

// ── types ─────────────────────────────────────────────────────────────────────

interface KoCardData {
  type: "ko";
  ko: string;
  commentary?: string;
}
interface PredCardData {
  type: "pred";
  gene: string;
  gene_description: string;
  scores: number[];
  nearest_ko: string;
  nearest_ko_reason: string;
  confidence: number;
  confidence_reason: string;
  commentary: string;
  source: "ridge" | "llm";
}
interface RankCardData {
  type: "rank";
  catIndex: number;
  commentary?: string;
}
interface CmpCardData {
  type: "cmp";
  k1: string;
  k2: string;
  commentary?: string;
}
interface TextData {
  type: "text";
  text: string;
  badge?: string;
}
type BotData = KoCardData | PredCardData | RankCardData | CmpCardData | TextData;

interface Message {
  id: number;
  role: "user" | "bot";
  content?: string;   // user message text
  data?: BotData;
  loading?: boolean;
}

let _nextId = 0;
function nextId() { return ++_nextId; }

// ── helpers ───────────────────────────────────────────────────────────────────

function tryJSON(t: string): Record<string, unknown> | null {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function dko(q: string): string | null {
  for (const k of Object.keys(GT)) if (q.includes(k)) return k;
  const al: Record<string, string> = {
    "no tail": "tbxta", "ntl": "tbxta", "spadetail": "tbx16",
    "hands off": "hand2", "valentino": "mafba", "krox20": "egr2b",
    "smoothened": "smo", "van gogh": "tbx1",
  };
  for (const [a, k] of Object.entries(al)) if (q.includes(a)) return k;
  return null;
}

function dcat(q: string): number {
  const m: [string, number][] = [
    ["notochord", 0], ["muscle", 1], ["nmp", 2], ["progenitor stall", 2],
    ["neural crest", 3], ["ganglia", 4], ["cranial", 4], ["hindbrain", 5],
    ["rhombomere", 5], ["hedgehog", 6], ["floor plate", 6], ["cardiac", 7],
    ["heart", 7], ["pharyngeal", 8], ["arch", 8], ["posterior", 9], ["tail", 9],
  ];
  for (const [n, i] of m) if (q.includes(n)) return i;
  return -1;
}

function extractPredictGene(q: string): string | null {
  const m = q.match(/\bpredict\b\s+([a-z0-9]+(?:[;][a-z0-9]+)?)/i);
  return m ? m[1].toLowerCase() : null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function llmCall(
  messages: { role: string; content: string }[],
  system?: string,
): Promise<string> {
  const res = await fetch(`${ENDPOINT}/api/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system: system ?? SYS_MAIN, max_tokens: 700 }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return (d.content?.[0]?.text ?? "") as string;
}

interface PredictResult {
  source: "ridge" | "llm_fallback";
  scores: number[];
  nearest_ko: string;
  nearest_sim: number;
  gene_description: string;
  error?: string;
}

async function ridgePredict(gene: string): Promise<PredictResult> {
  const res = await fetch(`${ENDPOINT}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gene }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? res.statusText);
  return d as PredictResult;
}

// ── sub-components ────────────────────────────────────────────────────────────

const THINKING_STEPS = [
  "thinking…",
  "querying Jina Ridge…",
  "asking Claude Sonnet 4.6…",
  "almost ready…",
];

function ThinkingIndicator() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % THINKING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, []);
  return <span className="zs-thinking">{THINKING_STEPS[idx]}</span>;
}

function ScoreGrid({ scores, amber }: { scores: number[]; amber: boolean }) {
  const B = amber ? BA : BT;
  const ac = amber ? "on-a" : "on-t";
  return (
    <div className="zs-sgrid">
      {scores.map((v, i) => (
        <div key={i} className={`zs-srow ${v > 0 ? ac : ""}`}>
          <span className="zs-scat">{CATS[i]}</span>
          <div className="zs-sbg">
            <div
              className="zs-sfill"
              style={{ width: `${Math.round((v / 3) * 100)}%`, background: B[v] }}
            />
          </div>
          <span className="zs-snum">{v}</span>
          <span className="zs-sword">{v > 0 ? SW[v] : ""}</span>
        </div>
      ))}
    </div>
  );
}

function ConfPips({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <div className="zs-conf-pips">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`zs-pip ${i < n ? "zs-pip-on" : "zs-pip-off"}`} />
      ))}
      <span className="zs-conf-num">{n}/{max}</span>
    </div>
  );
}

function KoCard({ data }: { data: KoCardData }) {
  return (
    <div>
      <span className="zs-badge zs-badge-truth">ground truth v3.2</span>
      <div className="zs-ko-head zs-ko-head-teal">{data.ko}</div>
      <div className="zs-ko-sub">{KD[data.ko] ?? ""}</div>
      <ScoreGrid scores={GT[data.ko]} amber={false} />
      {data.commentary && (
        <div className="zs-commentary">
          <span className="zs-commentary-src-line">
            interpretation&nbsp;·&nbsp;<span className="zs-src-tag zs-src-claude">Claude Sonnet 4.6</span>
          </span>
          {data.commentary}
        </div>
      )}
    </div>
  );
}

function PredCard({ data }: { data: PredCardData }) {
  const isRidge = data.source === "ridge";
  return (
    <div className="zs-pred-wrap">
      <span className="zs-badge zs-badge-pred">
        {isRidge ? "jina ridge prediction" : "llm estimate"}
      </span>
      <div className="zs-ko-head zs-ko-head-amber">{data.gene}</div>
      <div className="zs-ko-sub">{data.gene_description}</div>
      <div className="zs-scores-lbl" style={{marginTop:"2px",marginBottom:"8px",fontSize:"8px",opacity:0.7}}>
        gene description&nbsp;<span className="zs-src-tag zs-src-claude">Claude Sonnet 4.6</span>
      </div>
      <div className="zs-scores-lbl">
        {isRidge ? "predicted scores" : "estimated scores"}
        <span className={`zs-src-tag ${isRidge ? "zs-src-ridge" : "zs-src-claude"}`}>
          {isRidge ? "Jina Ridge" : "Claude Sonnet 4.6"}
        </span>
      </div>
      <ScoreGrid scores={data.scores} amber={true} />
      <div className="zs-pred-meta">
        <div className="zs-pmrow">
          <span className="zs-pmlabel">nearest KO</span>
          <span className="zs-pmval">
            <strong>{data.nearest_ko}</strong>
            {data.nearest_ko_reason ? ` — ${data.nearest_ko_reason}` : ""}
          </span>
          <span className={`zs-src-tag ${isRidge ? "zs-src-ridge" : "zs-src-claude"}`} style={{marginLeft:"auto",alignSelf:"flex-start",flexShrink:0}}>
            {isRidge ? "ridge" : "claude"}
          </span>
        </div>
        <div className="zs-pmrow">
          <span className="zs-pmlabel">confidence</span>
          <span className="zs-pmval">
            <ConfPips n={data.confidence} />
            {data.confidence_reason && (
              <span className="zs-conf-reason">{data.confidence_reason}</span>
            )}
          </span>
          <span className="zs-src-tag zs-src-claude" style={{marginLeft:"auto",alignSelf:"flex-start",flexShrink:0}}>claude</span>
        </div>
        <div className="zs-pmrow">
          <span className="zs-pmlabel">interpretation</span>
          <span className="zs-pmval">{data.commentary}</span>
          <span className="zs-src-tag zs-src-claude" style={{marginLeft:"auto",alignSelf:"flex-start",flexShrink:0}}>claude</span>
        </div>
      </div>
    </div>
  );
}

function RankCard({ data }: { data: RankCardData }) {
  const ranked = Object.entries(GT)
    .map(([k, v]) => ({ k, s: v[data.catIndex] }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return (
    <div>
      <span className="zs-badge zs-badge-truth">ground truth v3.2</span>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--zs-text2)" }}>
        Ranked by <strong style={{ color: "var(--zs-text)" }}>{CATS[data.catIndex]}</strong>:
      </div>
      <div className="zs-rank-list">
        {ranked.map(({ k, s }) => (
          <div key={k} className="zs-rrow">
            <span className="zs-rko">{k}</span>
            <div className="zs-rbg">
              <div className="zs-rfill" style={{ width: `${Math.round((s / 3) * 100)}%` }} />
            </div>
            <span className="zs-rnum">{s}</span>
            <span className="zs-rsword">{SW[s]}</span>
          </div>
        ))}
      </div>
      {data.commentary && <div className="zs-commentary">{data.commentary}</div>}
    </div>
  );
}

function CmpCard({ data }: { data: CmpCardData }) {
  return (
    <div>
      <span className="zs-badge zs-badge-truth">ground truth v3.2</span>
      <div className="zs-cmp-grid">
        <div>
          <div className="zs-cmp-head">{data.k1}</div>
          <ScoreGrid scores={GT[data.k1]} amber={false} />
        </div>
        <div>
          <div className="zs-cmp-head">{data.k2}</div>
          <ScoreGrid scores={GT[data.k2]} amber={false} />
        </div>
      </div>
      {data.commentary && <div className="zs-commentary">{data.commentary}</div>}
    </div>
  );
}

function BotBubble({ data, loading }: { data?: BotData; loading?: boolean }) {
  if (loading) {
    return (
      <div className="zs-bubble zs-bubble-bot">
        <ThinkingIndicator />
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="zs-bubble zs-bubble-bot">
      {data.type === "ko"   && <KoCard   data={data} />}
      {data.type === "pred" && <PredCard data={data} />}
      {data.type === "rank" && <RankCard data={data} />}
      {data.type === "cmp"  && <CmpCard  data={data} />}
      {data.type === "text" && (
        <>
          {data.badge && <span className="zs-badge zs-badge-llm">{data.badge}</span>}
          <p className="zs-text-body">{data.text}</p>
        </>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function ZscapeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [sugsVisible, setSugsVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const llmHist = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    setInput("");
    setSugsVisible(false);
    setBusy(true);

    const uid = nextId();
    const bid = nextId();
    llmHist.current.push({ role: "user", content: q });

    setMessages((prev) => [
      ...prev,
      { id: uid, role: "user",  content: q },
      { id: bid, role: "bot",   loading: true },
    ]);

    const update = (data: BotData) =>
      setMessages((prev) =>
        prev.map((m) => m.id === bid ? { ...m, data, loading: false } : m)
      );

    const lo = q.toLowerCase().replace(/[?!]/g, "");
    const ko = dko(lo);
    const ci = dcat(lo);

    try {
      // ── rank ──────────────────────────────────────────────────────────────
      if ((lo.includes("which") || lo.includes("rank") || lo.includes("most affect")) && ci >= 0) {
        const rankData: RankCardData = { type: "rank", catIndex: ci };
        update(rankData);
        const t = await llmCall([{ role: "user", content: q }]);
        llmHist.current.push({ role: "assistant", content: t });
        update({ ...rankData, commentary: t });
        return;
      }

      // ── compare ──────────────────────────────────────────────────────────
      const pts = lo.split(/\bvs\b|\band\b|\bcompare\b/);
      if (pts.length >= 2) {
        const k1 = dko(pts[0]), k2 = dko(pts[1]);
        if (k1 && k2 && GT[k1] && GT[k2]) {
          const cmpData: CmpCardData = { type: "cmp", k1, k2 };
          update(cmpData);
          const t = await llmCall([{ role: "user", content: q }]);
          llmHist.current.push({ role: "assistant", content: t });
          update({ ...cmpData, commentary: t });
          return;
        }
      }

      // ── known KO ─────────────────────────────────────────────────────────
      if (ko && GT[ko]) {
        const koData: KoCardData = { type: "ko", ko };
        update(koData);
        const t = await llmCall([
          { role: "user", content: `Briefly interpret the perturbation profile of ${ko} in zebrafish.` },
        ]);
        llmHist.current.push({ role: "assistant", content: t });
        update({ ...koData, commentary: t });
        return;
      }

      // ── prediction ───────────────────────────────────────────────────────
      const predGene = extractPredictGene(lo);
      if (predGene) {
        try {
          const ridge = await ridgePredict(predGene);
          const ridgeCtx =
            `Gene: ${predGene}\n` +
            `Phenotype description used for embedding: ${ridge.gene_description || predGene}\n` +
            `Ridge predicted scores: [${ridge.scores}] (categories: notochord, somitic_muscle, ` +
            `nmp_stalling, neural_crest, cranial_ganglia, hindbrain_seg, hedgehog_floor_plate, ` +
            `cardiac_lpm, pharyngeal_arch, posterior_axis — scale 0-3)\n` +
            `Nearest training KO: ${ridge.nearest_ko} (cosine similarity: ${ridge.nearest_sim})`;
          const t    = await llmCall([{ role: "user", content: ridgeCtx }], SYS_RIDGE_META);
          const meta = tryJSON(t) ?? {};
          llmHist.current.push({ role: "assistant", content: t });
          update({
            type:              "pred",
            gene:              predGene,
            gene_description:  (meta.gene_description as string) || ridge.gene_description || "",
            scores:            ridge.scores,
            nearest_ko:        ridge.nearest_ko,
            nearest_ko_reason: (meta.nearest_ko_reason as string) || "",
            confidence:        (meta.confidence as number)        || 3,
            confidence_reason: (meta.confidence_reason as string) || "",
            commentary:        (meta.commentary as string)        || "",
            source:            ridge.source === "ridge" ? "ridge" : "llm",
          });
        } catch {
          // Ridge unavailable — fall through to LLM prediction
          const t = await llmCall(llmHist.current);
          const j = tryJSON(t);
          llmHist.current.push({ role: "assistant", content: t });
          if (j && j.mode === "prediction") {
            update({
              type:              "pred",
              gene:              (j.gene as string)              || predGene,
              gene_description:  (j.gene_description as string)  || "",
              scores:            (j.scores as number[])          || Array(10).fill(0),
              nearest_ko:        (j.nearest_ko as string)        || "",
              nearest_ko_reason: (j.nearest_ko_reason as string) || "",
              confidence:        (j.confidence as number)        || 3,
              confidence_reason: (j.confidence_reason as string) || "",
              commentary:        (j.commentary as string)        || "",
              source:            "llm",
            });
          } else {
            update({ type: "text", text: t, badge: "llm — claude-sonnet-4-6" });
          }
        }
        return;
      }

      // ── general LLM ───────────────────────────────────────────────────────
      const t = await llmCall(llmHist.current);
      llmHist.current.push({ role: "assistant", content: t });
      const j = tryJSON(t);
      if (j && j.mode === "prediction") {
        update({
          type:              "pred",
          gene:              (j.gene as string)              || "",
          gene_description:  (j.gene_description as string)  || "",
          scores:            (j.scores as number[])          || Array(10).fill(0),
          nearest_ko:        (j.nearest_ko as string)        || "",
          nearest_ko_reason: (j.nearest_ko_reason as string) || "",
          confidence:        (j.confidence as number)        || 3,
          confidence_reason: (j.confidence_reason as string) || "",
          commentary:        (j.commentary as string)        || "",
          source:            "llm",
        });
      } else {
        update({ type: "text", text: t, badge: "llm — claude-sonnet-4-6" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      update({ type: "text", text: `Error: ${msg}` });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
      if (llmHist.current.length > 24) {
        llmHist.current = llmHist.current.slice(-24);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(input); }
  }
  function fill(t: string) {
    setInput(t); inputRef.current?.focus();
  }

  const CHIPS_KNOWN: { ko: string; group: string }[] = [
    { ko: "tbxta",        group: "axial"  },
    { ko: "noto",         group: "axial"  },
    { ko: "tbx16",        group: "somito" },
    { ko: "tbx16;msgn1",  group: "somito" },
    { ko: "wnt3a;wnt8a",  group: "somito" },
    { ko: "cdx4;cdx1a",   group: "post"   },
    { ko: "smo",          group: "hh"     },
    { ko: "hand2",        group: "lpm"    },
    { ko: "tbx1",         group: "lpm"    },
    { ko: "tfap2a;foxd3", group: "nc"     },
    { ko: "egr2b",        group: "hb"     },
    { ko: "mafba",        group: "hb"     },
    { ko: "foxi1",        group: "pns"    },
    { ko: "phox2a",       group: "pns"    },
    { ko: "met",          group: "gf"     },
  ];
  const CHIPS_PRED = ["shh", "gata4", "sox9a", "cdx2", "pax2a"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Roboto+Slab:wght@300;400;500&display=swap');
        :root {
          --zs-bg:      #f6f4f2;
          --zs-surf:    #ede9e5;
          --zs-surf2:   #e2ddd9;
          --zs-border:  rgba(0,0,0,0.09);
          --zs-border2: rgba(0,0,0,0.16);
          --zs-text:    #2b2b2b;
          --zs-text2:   #626262;
          --zs-text3:   #888888;
          --zs-teal:        #1D9E75;
          --zs-teal-dim:    #d0ece4;
          --zs-teal-bright: #0d5c3f;
          --zs-amber:        #BA7517;
          --zs-amber-dim:    #fef0d8;
          --zs-amber-mid:    #9a5f0a;
          --zs-amber-bright: #7a4a06;
          --zs-mono: 'IBM Plex Mono', monospace;
          --zs-sans: 'Roboto Slab', serif;
        }

        .zs-wrap        { display:flex; flex-direction:column; height:100vh; background:var(--zs-bg); color:var(--zs-text); font-family:var(--zs-sans); font-size:14px; font-weight:300; overflow:hidden; }
        .zs-header      { padding:12px 18px; border-bottom:1px solid var(--zs-border); display:flex; align-items:center; gap:12px; flex-shrink:0; }
        .zs-logo        { font-family:var(--zs-mono); font-size:13px; font-weight:500; color:var(--zs-teal-bright); letter-spacing:0.08em; }
        .zs-logo-sep    { color:var(--zs-text3); margin:0 3px; }
        .zs-header-sub  { font-size:11px; color:var(--zs-text3); font-family:var(--zs-mono); }
        .zs-key-badge   { font-size:10px; font-family:var(--zs-mono); padding:3px 10px; background:var(--zs-teal-dim); color:var(--zs-teal-bright); margin-left:auto; border:1px solid rgba(13,92,63,0.2); border-radius:5px; }
        .zs-sidebar-toggle { background:none; border:1px solid var(--zs-border2); cursor:pointer; font-family:var(--zs-mono); font-size:11px; color:var(--zs-text3); padding:3px 8px; line-height:1; transition:color 0.15s,border-color 0.15s; flex-shrink:0; border-radius:5px; }
        .zs-sidebar-toggle:hover { color:var(--zs-text); border-color:var(--zs-teal); }
        .zs-main        { flex:1; display:flex; overflow:hidden; }

        .zs-sidebar          { width:147px; border-right:1px solid var(--zs-border); padding:14px 10px; display:flex; flex-direction:column; gap:14px; flex-shrink:0; overflow:hidden; transition:width 0.25s ease,padding 0.25s ease,border-color 0.25s ease; }
        .zs-sidebar-collapsed{ width:0; padding-left:0; padding-right:0; border-right-color:transparent; }
        .zs-sidebar-inner    { overflow-y:auto; display:flex; flex-direction:column; gap:14px; min-width:127px; }
        .zs-sl-label    { font-size:9px; font-family:var(--zs-mono); letter-spacing:0.1em; color:var(--zs-text3); text-transform:uppercase; margin-bottom:5px; }
        .zs-chip        { font-family:var(--zs-mono); font-size:11px; padding:4px 8px; border:0.5px solid var(--zs-border); color:var(--zs-text2); cursor:pointer; display:block; width:100%; text-align:left; background:none; margin-bottom:2px; transition:background 0.1s,color 0.1s; border-radius:4px; }
        .zs-chip:hover  { background:var(--zs-surf2); color:var(--zs-text); border-color:var(--zs-border2); }
        .zs-g-axial     { border-left:2px solid #1D9E75; }
        .zs-g-somito    { border-left:2px solid #0d7a56; }
        .zs-g-post      { border-left:2px solid #0F6E56; }
        .zs-g-hh        { border-left:2px solid #7B75CC; }
        .zs-g-lpm       { border-left:2px solid #6A63C8; }
        .zs-g-nc        { border-left:2px solid #534AB7; }
        .zs-g-hb        { border-left:2px solid #D07050; }
        .zs-g-pns       { border-left:2px solid #C04820; }
        .zs-g-gf        { border-left:2px solid #888; }
        .zs-g-pred      { border-left:2px solid var(--zs-amber); }

        .zs-chat        { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .zs-msgs        { flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:18px; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,0.15) transparent; }
        .zs-msgs::-webkit-scrollbar { width:4px; }
        .zs-msgs::-webkit-scrollbar-track { background:transparent; }
        .zs-msgs::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.15); border-radius:4px; }
        .zs-msgs::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.25); }
        .zs-msg-user    { display:flex; justify-content:flex-end; }
        .zs-msg-bot     { display:flex; justify-content:flex-start; }
        .zs-bubble-user { max-width:560px; padding:10px 14px; font-size:13px; background:var(--zs-surf2); border:1px solid var(--zs-border2); color:var(--zs-text); line-height:1.6; border-radius:10px; }
        .zs-bubble      { max-width:640px; padding:13px 16px; font-size:13px; background:var(--zs-surf); border:1px solid var(--zs-border); color:var(--zs-text); line-height:1.6; border-radius:10px; }
        .zs-bubble-bot  { }
        @keyframes zs-thinking-pulse{0%,100%{opacity:0.45}50%{opacity:1}}
        .zs-thinking    { color:var(--zs-text3); font-style:italic; font-family:var(--zs-mono); font-size:12px; animation:zs-thinking-pulse 1.8s ease-in-out infinite; }

        .zs-badge       { font-family:var(--zs-mono); font-size:9px; letter-spacing:0.07em; padding:2px 6px; display:inline-block; margin-bottom:9px; text-transform:uppercase; border-radius:4px; }
        .zs-badge-truth { background:var(--zs-teal-dim); color:var(--zs-teal-bright); }
        .zs-badge-pred  { background:var(--zs-amber-dim); color:var(--zs-amber-bright); }
        .zs-badge-llm   { background:var(--zs-surf); color:var(--zs-text3); border:1px solid var(--zs-border2); }

        .zs-ko-head        { font-family:var(--zs-mono); font-size:14px; font-weight:500; margin-bottom:2px; }
        .zs-ko-head-teal   { color:var(--zs-teal-bright); }
        .zs-ko-head-amber  { color:var(--zs-amber-bright); }
        .zs-ko-sub         { font-family:var(--zs-sans); font-size:11px; font-style:italic; color:var(--zs-text2); margin-bottom:12px; }

        .zs-sgrid   { display:flex; flex-direction:column; gap:5px; margin-top:4px; }
        .zs-srow    { display:flex; align-items:center; gap:8px; }
        .zs-scat    { width:118px; color:var(--zs-text3); flex-shrink:0; font-family:var(--zs-mono); font-size:10px; }
        .zs-sbg     { flex:1; height:5px; background:rgba(0,0,0,0.08); overflow:hidden; border-radius:2px; }
        .zs-sfill   { height:100%; border-radius:2px; }
        .zs-snum    { width:14px; text-align:right; font-family:var(--zs-mono); font-size:11px; color:var(--zs-text3); }
        .zs-sword   { width:68px; font-family:var(--zs-sans); font-size:10px; font-weight:300; color:var(--zs-text3); }
        .on-t .zs-scat, .on-t .zs-sword { color:var(--zs-text2); }
        .on-t .zs-snum  { color:var(--zs-teal-bright); }
        .on-a .zs-scat  { color:var(--zs-text2); }
        .on-a .zs-snum  { color:var(--zs-amber-bright); }
        .on-a .zs-sword { color:var(--zs-amber); }

        .zs-pred-wrap   { border:1px solid rgba(186,117,23,0.3); padding:14px; background:var(--zs-amber-dim); border-radius:10px; }
        .zs-pred-meta   { margin-top:12px; padding-top:10px; border-top:1px solid rgba(186,117,23,0.2); display:flex; flex-direction:column; gap:7px; }
        .zs-pmrow       { display:flex; gap:8px; align-items:flex-start; }
        .zs-pmlabel     { font-family:var(--zs-mono); font-size:9px; letter-spacing:0.06em; color:var(--zs-amber-mid); min-width:90px; flex-shrink:0; text-transform:uppercase; padding-top:2px; }
        .zs-pmval       { font-family:var(--zs-sans); font-size:11px; color:var(--zs-text2); line-height:1.5; font-weight:300; }
        .zs-pmval strong{ color:var(--zs-amber-bright); font-weight:500; }
        .zs-conf-pips   { display:flex; gap:3px; align-items:center; }
        .zs-pip         { width:9px; height:9px; border-radius:2px; }
        .zs-pip-on      { background:var(--zs-amber); }
        .zs-pip-off     { background:rgba(186,117,23,0.2); }
        .zs-conf-num    { font-family:var(--zs-mono); font-size:10px; color:var(--zs-amber-bright); margin-left:4px; }
        .zs-conf-reason { font-size:11px; margin-top:3px; display:block; font-weight:300; }

        .zs-commentary  { margin-top:11px; padding-top:11px; border-top:1px solid rgba(0,0,0,0.07); font-family:var(--zs-sans); font-size:12px; font-weight:300; color:var(--zs-text2); line-height:1.65; }
        .zs-text-body   { font-size:13px; line-height:1.65; color:var(--zs-text2); font-weight:300; margin-top:4px; }

        .zs-cmp-grid  { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:8px; }
        .zs-cmp-head  { font-family:var(--zs-mono); font-size:12px; font-weight:500; color:var(--zs-teal-bright); margin-bottom:7px; }

        .zs-rank-list { display:flex; flex-direction:column; gap:5px; margin-top:7px; }
        .zs-rrow      { display:flex; align-items:center; gap:8px; }
        .zs-rko       { font-family:var(--zs-mono); color:var(--zs-teal-bright); min-width:122px; font-size:11px; }
        .zs-rbg       { flex:1; height:4px; background:rgba(0,0,0,0.08); overflow:hidden; border-radius:2px; }
        .zs-rfill     { height:100%; background:var(--zs-teal); border-radius:2px; }
        .zs-rnum      { font-family:var(--zs-mono); font-size:11px; color:var(--zs-text2); min-width:16px; }
        .zs-rsword    { font-family:var(--zs-sans); font-size:10px; font-weight:300; color:var(--zs-text3); }

        .zs-input-area  { padding:12px 24px 16px; border-top:1px solid var(--zs-border); display:flex; flex-direction:column; gap:9px; flex-shrink:0; }
        .zs-sugs        { display:flex; flex-wrap:wrap; gap:6px; }
        .zs-sug         { font-size:11px; font-family:var(--zs-mono); padding:4px 10px; border:1px solid var(--zs-border2); color:var(--zs-text3); cursor:pointer; background:none; transition:color 0.15s,border-color 0.15s; border-radius:5px; }
        .zs-sug:hover   { color:var(--zs-text); border-color:var(--zs-teal); }
        .zs-irow        { display:flex; gap:8px; }
        .zs-irow input  { flex:1; background:#fff; border:1px solid var(--zs-border2); color:var(--zs-text); font-family:var(--zs-sans); font-size:13px; font-weight:300; padding:9px 14px; outline:none; transition:border-color 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.05); border-radius:8px; }
        .zs-irow input:focus { border-color:var(--zs-teal); }
        .zs-irow input::placeholder { color:var(--zs-text3); }
        .zs-send-btn    { background:#ddf0e8; border:1px solid rgba(29,158,117,0.35); color:#0d5c3f; font-family:var(--zs-mono); font-size:12px; font-weight:500; padding:9px 18px; cursor:pointer; letter-spacing:0.04em; transition:background 0.15s,border-color 0.15s; flex-shrink:0; border-radius:8px; }
        .zs-send-btn:hover    { background:#c6e6d6; border-color:rgba(29,158,117,0.6); }
        .zs-send-btn:disabled { background:#edf7f2; color:#9ec9b5; border-color:rgba(29,158,117,0.15); cursor:default; }
        /* ── source attribution ── */
        .zs-src-tag   { font-family:var(--zs-mono); font-size:8px; padding:1px 5px; border-radius:3px; text-transform:uppercase; letter-spacing:0.04em; display:inline-block; margin-left:3px; vertical-align:middle; font-weight:400; }
        .zs-src-ridge { background:rgba(90,80,185,0.1); color:#5a52c0; }
        .zs-src-claude{ background:rgba(186,117,23,0.12); color:var(--zs-amber-mid); }
        .zs-src-gt    { background:var(--zs-teal-dim); color:var(--zs-teal-bright); }
        .zs-scores-lbl{ font-family:var(--zs-mono); font-size:9px; color:var(--zs-text3); letter-spacing:0.06em; text-transform:uppercase; margin-top:10px; margin-bottom:5px; display:flex; align-items:center; gap:0; }
        .zs-commentary-src-line { display:flex; align-items:center; gap:4px; font-family:var(--zs-mono); font-size:8px; color:var(--zs-text3); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:6px; opacity:0.8; }
      `}</style>

      <div className="zs-wrap">
        {/* header */}
        <header className="zs-header">
          <button
            className="zs-sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title="Toggle sidebar"
          >☰</button>
          <div>
            <span className="zs-logo">
              ZSCAPE<span className="zs-logo-sep">/</span>chat
            </span>
            <span className="zs-header-sub">
              {" "}perturbation influence predictor · 25 KOs · 10 categories
            </span>
          </div>
          <span className="zs-key-badge">LLM: CLAUDE-SONNET-4-6</span>
        </header>

        <div className="zs-main">
          {/* sidebar */}
          <div className={`zs-sidebar${sidebarCollapsed ? " zs-sidebar-collapsed" : ""}`}>
            <div className="zs-sidebar-inner">
            <div>
              <div className="zs-sl-label">Known KOs</div>
              {CHIPS_KNOWN.map(({ ko, group }) => (
                <button
                  key={ko}
                  className={`zs-chip zs-g-${group}`}
                  onClick={() => {
                    setSugsVisible(false);
                    handleSubmit(`Tell me about ${ko}`);
                  }}
                >
                  {ko}
                </button>
              ))}
            </div>
            <div>
              <div className="zs-sl-label">Predict unknown</div>
              {CHIPS_PRED.map((gene) => (
                <button
                  key={gene}
                  className="zs-chip zs-g-pred"
                  onClick={() => fill(`Predict ${gene} knockout effects`)}
                >
                  {gene}
                </button>
              ))}
            </div>
            </div>
          </div>

          {/* chat */}
          <div className="zs-chat">
            <div className="zs-msgs">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="zs-msg-user">
                    <div className="zs-bubble-user">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="zs-msg-bot">
                    <BotBubble data={m.data} loading={m.loading} />
                  </div>
                )
              )}
              <div ref={bottomRef} />
            </div>

            <div className="zs-input-area">
              {sugsVisible && (
                <div className="zs-sugs">
                  {[
                    ["hand2 × cardiomyocyte", "What does hand2 do in cardiomyocytes?"],
                    ["rank hindbrain KOs",    "Which KOs most affect the hindbrain?"],
                    ["compare foxd3 vs tfap2a","Compare foxd3 and tfap2a"],
                    ["predict shh KO",        "Predict shh knockout effects"],
                    ["predict gata4 KO",      "Predict gata4 knockout"],
                  ].map(([label, q]) => (
                    <button key={label} className="zs-sug" onClick={() => fill(q)}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="zs-irow">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Look up effect of any known KO or ask to predict the effect of any gene KO…"
                  disabled={busy}
                />
                <button
                  className="zs-send-btn"
                  onClick={() => handleSubmit(input)}
                  disabled={busy || !input.trim()}
                >
                  {busy ? "···" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
