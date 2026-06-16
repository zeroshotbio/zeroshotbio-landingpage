"use client";
// Scorecard — the ground-truth / no-GT results view for a finished run (accuracy
// by tier, by cluster size, abstention precision, per-cluster verdict table).
// Extracted verbatim from KasperovClient.tsx; the heaviest presentational unit,
// shared with the Phase 2 read-only run viewer. Props-only (parent owns score
// state via score/setScore).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type Cluster, type ClusterConf, type DatasetDef, type RunScore, type ClusterVerdict, type TierVerdict, type GroundTruth, type GTTier, type TierAgg, type TierPred, type PctCount, type SubStrat, type FailCount, type AbstentionStat, CONF_TIERS, overallConf } from "../types";
import { ACCENT, PAPER, INK, confColor, btnGhost } from "../theme";
import { ImportButton } from "./ImportButton";

const SCORE_TIERS: { key: keyof Omit<ClusterVerdict, "id">; gtKey: string; label: string }[] = [
  { key: "germ_layer", gtKey: "germ_layer", label: "Germ layer" },
  { key: "tissue", gtKey: "tissue", label: "Tissue" },
  { key: "cell_type_broad", gtKey: "cell_type_broad", label: "Cell type — broad" },
  { key: "cell_type_sub", gtKey: "cell_type_sub", label: "Cell type — sub" },
];
// Tiers NATIVE to each dataset's own published schema (verified from each groundtruth.json
// provenance). ChemFish ships only tissue + cell_type — germ_layer & cell_type_broad are
// projections, so they are NOT shown in the per-cluster comparison. Used as the reliable
// source even if the deployed groundtruth.json lacks a provenance.native_tiers field.
const NATIVE_TIERS_BY_DATASET: Record<string, string[]> = {
  zscape: ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"],
  chemfish: ["tissue", "cell_type_sub"],
  daniocell: ["tissue", "cell_type_broad"],
};

// --- driver-scoring: parse the kasperov-conclude label that's actually persisted as the
// assignment (NOT the confidence side-channel). Abstention credited at the tier reached.
// Mirrors _parse_driver/_attempted in backend/daniotype_autopilot_api/app.py.
function normTierIdx(s: string): number | null {
  const x = (s || "").toLowerCase().trim();
  if (x.includes("germ")) return 0;
  if (x.includes("tissue")) return 1;
  if (x.includes("broad")) return 2;
  if (x.includes("sub")) return 3;
  if (x.includes("cell type") || x.includes("cell_type")) return 2;
  return null;
}
function parseDriverLabel(finalLabel: string): { identity: string; reached: number; kind: "assign" | "abstain" | "unresolved" } {
  const fl = (finalLabel || "").trim();
  const m = fl.match(/\(abstain(?:ed)?\s*[·:-]\s*([^)]+)\)/i);
  if (m && m.index != null) {
    const idx = normTierIdx(m[1]);
    return { identity: fl.slice(0, m.index).trim(), reached: idx == null ? 1 : idx, kind: "abstain" };
  }
  if (!fl || fl.toLowerCase().includes("unresolved")) return { identity: "", reached: -1, kind: "unresolved" };
  return { identity: fl, reached: 3, kind: "assign" };
}
function attemptedTier(reached: number, kind: string, tierIdx: number): boolean {
  return kind === "unresolved" ? false : tierIdx <= reached;
}

function ScorecardEmbedWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "left" }}>{children}</div>;
}
function ScorecardPageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 70px" }}>{children}</div>
    </div>
  );
}

export function Scorecard({
  dataset,
  clusters,
  labels,
  confidence,
  validated,
  onPick,
  model,
  addUsage,
  score,
  setScore,
  onImport,
  embedded,
  onBack,
}: {
  dataset: DatasetDef;
  clusters: Cluster[];
  labels: Record<string, string>;
  confidence: Record<string, ClusterConf>;
  validated?: Set<string>;
  onPick?: (id: string) => void;
  model: string;
  addUsage: (model: string, inT: number, outT: number) => void;
  score: RunScore;
  setScore: React.Dispatch<React.SetStateAction<RunScore>>;
  onImport: (data: unknown) => void;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const labelled = useMemo(() => clusters.filter((c) => labels[c.id]), [clusters, labels]);
  const fingerprint = useMemo(() => JSON.stringify(labelled.map((c) => [c.id, labels[c.id]]).sort()), [labelled, labels]);
  const verdicts = score.verdicts; // controlled by the parent (so export sees it)

  const [gt, setGt] = useState<GroundTruth | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "scoring" | "done" | "error">("loading");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState("");
  const allLabelled = clusters.length > 0 && clusters.every((c) => labels[c.id]);

  const gtTiersFor = useCallback(
    (id: string) => {
      const rec = gt?.clusters?.[id] ?? {};
      return {
        germ_layer: rec.germ_layer?.label ?? null,
        tissue: rec.tissue?.label ?? null,
        cell_type_broad: rec.cell_type_broad?.label ?? null,
        cell_type_sub: rec.cell_type_sub?.label ?? null,
      };
    },
    [gt]
  );

  const subFracFor = useCallback((id: string) => gt?.clusters?.[id]?.cell_type_sub?.frac ?? 0, [gt]);

  // tiers that are NATIVE to this dataset's own schema (e.g. ChemFish = tissue + cell_type;
  // germ_layer / cell_type_broad are projections, not native). The per-cluster comparison
  // chart shows only these, so it reflects the dataset's real label scheme.
  const nativeTiers = useMemo(() => {
    const prov: any = (gt as any)?.provenance;
    const keys: string[] | null =
      NATIVE_TIERS_BY_DATASET[dataset.id] ||
      (Array.isArray(prov?.native_tiers) ? prov.native_tiers
        : prov?.native_tier_columns ? Object.keys(prov.native_tier_columns) : null);
    return SCORE_TIERS.filter((t) =>
      keys ? keys.includes(t.gtKey) : labelled.some((c) => !!gtTiersFor(c.id)[t.gtKey as keyof ReturnType<typeof gtTiersFor>])
    );
  }, [gt, labelled, gtTiersFor, dataset.id]);
  const nativeKeys = nativeTiers.map((t) => t.gtKey);
  const tierColLabel = (t: { gtKey: string; label: string }) =>
    t.gtKey === "cell_type_sub" ? (nativeKeys.includes("cell_type_broad") ? "Cell type (sub)" : "Cell type")
    : t.gtKey === "cell_type_broad" ? "Cell type (broad)"
    : t.label;
  const nativeTierKeys = new Set(nativeTiers.map((t) => t.key as string));
  const firstColW = nativeTiers.length <= 2 ? 30 : 22;
  const tierColW = nativeTiers.length ? (100 - firstColW) / nativeTiers.length : 50;

  // DRIVER-SCORING aggregate: per-tier agreement over clusters that have a verdict + a
  // reference label AND that attempted the tier (abstention is credited at the tier
  // reached — finer tiers are not-attempted, never counted as a miss). Only the dataset's
  // NATIVE tiers are aggregated, so a saved/exported run never records projected-tier
  // scores (e.g. ChemFish germ_layer / cell_type_broad are projections, not native).
  const computeAgg = useCallback(
    (verds: Record<string, ClusterVerdict>): TierAgg[] =>
      SCORE_TIERS
        .map((t, ti) => ({ t, ti }))
        .filter(({ t }) => nativeTiers.some((n) => n.key === t.key))
        .map(({ t, ti }) => {
          let matched = 0;
          let total = 0;
          for (const c of labelled) {
            const v = verds[c.id];
            const ref = gtTiersFor(c.id)[t.gtKey as keyof ReturnType<typeof gtTiersFor>];
            const drv = parseDriverLabel(labels[c.id] || "");
            if (!v || !ref || !attemptedTier(drv.reached, drv.kind, ti)) continue;
            total++;
            if (v[t.key].match) matched++;
          }
          return { key: t.key, label: t.label, matched, total, pct: total ? (100 * matched) / total : 0 };
        }),
    [labelled, gtTiersFor, labels, nativeTiers]
  );

  // purity-stratified sub (headline = high-purity frac>=0.5) + abstention precision
  const computeExtras = useCallback(
    (verds: Record<string, ClusterVerdict>): { subStrat: SubStrat; abstention: AbstentionStat } => {
      let hi = 0, hin = 0, lo = 0, lon = 0, wnum = 0, wden = 0;
      for (const c of labelled) {
        const v = verds[c.id];
        const drv = parseDriverLabel(labels[c.id] || "");
        if (!v || !attemptedTier(drv.reached, drv.kind, 3) || !gtTiersFor(c.id).cell_type_sub) continue;
        const f = subFracFor(c.id);
        const m = v.cell_type_sub.match ? 1 : 0;
        wnum += m * f; wden += f;
        if (f >= 0.5) { hin++; hi += m; } else { lon++; lo += m; }
      }
      const pc = (mt: number, tt: number): PctCount => ({ matched: mt, total: tt, pct: tt ? (100 * mt) / tt : 0 });
      const subStrat: SubStrat = { headline: "high_purity", high: pc(hi, hin), low: pc(lo, lon), raw: pc(hi + lo, hin + lon), weighted_pct: wden ? (100 * wnum) / wden : 0 };
      const forcedFail = (kindsel: string): FailCount => {
        let fail = 0, tot = 0;
        for (const c of labelled) {
          const v = verds[c.id];
          const drv = parseDriverLabel(labels[c.id] || "");
          if (drv.kind !== kindsel || !v || !gtTiersFor(c.id).cell_type_sub) continue;
          tot++;
          if (!v.cell_type_sub.match) fail++;
        }
        return { fail, total: tot, pct: tot ? (100 * fail) / tot : 0 };
      };
      const kindOf = (id: string) => parseDriverLabel(labels[id] || "").kind;
      const abstention: AbstentionStat = {
        n_assign: labelled.filter((c) => kindOf(c.id) === "assign").length,
        n_abstain: labelled.filter((c) => kindOf(c.id) === "abstain").length,
        n_unresolved: labelled.filter((c) => kindOf(c.id) === "unresolved").length,
        abstained_forced_sub_fail: forcedFail("abstain"),
        assigned_forced_sub_fail: forcedFail("assign"),
      };
      return { subStrat, abstention };
    },
    [labelled, gtTiersFor, labels, subFracFor]
  );

  // load ground truth; decide whether the stored score already covers this label set
  useEffect(() => {
    if (!dataset.groundTruthUrl) {
      setErr("This dataset has no published ground truth.");
      setStatus("error");
      return;
    }
    let alive = true;
    const decide = () => {
      const need = labelled.some((c) => !score.verdicts[c.id]);
      // "idle" = structure shown but un-filled; the user presses the button to fill it
      setStatus(score.scoredAt && !need ? "done" : "idle");
    };
    if (gt) {
      decide();
      return;
    }
    fetch(dataset.groundTruthUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`ground truth ${r.status}`);
        return r.json();
      })
      .then((d: GroundTruth) => {
        if (!alive) return;
        setGt(d);
        decide();
      })
      .catch((e) => alive && (setErr(String(e?.message ?? e)), setStatus("error")));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset.groundTruthUrl, fingerprint]);

  // score clusters (default: only those missing a verdict; full=true re-scores all)
  const runScoring = useCallback(
    async (full?: boolean) => {
      if (!gt) return;
      setStatus("scoring");
      setErr("");
      const targets = full ? labelled : labelled.filter((c) => !score.verdicts[c.id]);
      const toScore = targets.length ? targets : labelled;
      const items = toScore.map((c) => {
        // DRIVER-SCORING: judge the persisted kasperov-conclude identity at every tier,
        // not the confidence side-channel. (Abstention crediting happens in aggregation.)
        const drv = parseDriverLabel(labels[c.id] || "");
        const pred = drv.identity || labels[c.id] || "";
        const predictions = { germ_layer: pred, tissue: pred, cell_type_broad: pred, cell_type_sub: pred };
        return { id: c.id, ourLabel: labels[c.id], predictions, markers: c.degsUp, gt: gtTiersFor(c.id) };
      });
      const BATCH = 10;
      const batches: (typeof items)[] = [];
      for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
      setProgress({ done: 0, total: items.length });
      const acc: Record<string, ClusterVerdict> = { ...score.verdicts };
      let failed = 0;
      let doneN = 0;
      let next = 0;
      async function worker() {
        while (next < batches.length) {
          const b = batches[next++];
          try {
            const r = await fetch("/api/kasperov_score", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ dataset: dataset.id, model, items: b }),
            });
            if (!r.ok) throw new Error(`score ${r.status}`);
            const d = await r.json();
            if (d.usage) addUsage(d.usage.model ?? model, d.usage.in ?? 0, d.usage.out ?? 0);
            for (const res of d.results ?? []) if (res?.id) (acc[res.id] = res), doneN++;
          } catch {
            failed += b.length;
          }
          setScore((s) => ({ ...s, verdicts: { ...acc } }));
          setProgress({ done: doneN + failed, total: items.length });
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
      const extras = computeExtras(acc);
      setScore({ verdicts: acc, scoredAt: new Date().toISOString(), agg: computeAgg(acc), subStrat: extras.subStrat, abstention: extras.abstention });
      setStatus("done");
    },
    [gt, labelled, labels, gtTiersFor, computeAgg, computeExtras, dataset.id, model, addUsage, score.verdicts, setScore]
  );

  const agg = computeAgg(verdicts);
  const scoredCount = labelled.filter((c) => verdicts[c.id]).length;

  const Wrapper = embedded ? ScorecardEmbedWrap : ScorecardPageWrap;

  return (
    <Wrapper>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          {!embedded && onBack && <button onClick={onBack} style={btnGhost}>← World map</button>}
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT, fontWeight: 600 }}>{dataset.name} · ground-truth scorecard</div>
          {/* Import is only for the standalone scorecard; the embedded (new-run) view manages a fresh run only. */}
          {!embedded && <ImportButton onImport={onImport} label="⬆ Import run (JSON)" style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 13 }} />}
        </div>
        <h2 style={{ fontSize: embedded ? 22 : 26, fontWeight: 700, margin: "4px 0 2px" }}>Our de-novo labels vs the published atlas</h2>
        <p style={{ color: "#666", fontSize: 14.5, margin: "0 0 18px", lineHeight: 1.5 }}>
          An LLM judge scores each of our {scoredCount}/{labelled.length} labelled clusters against the authors&apos; published labels at every ontology tier — by
          biological meaning, not string match. Agreement should fall as the tier gets finer; that gradient is the honest read on how deep our calls actually resolve.
        </p>

        {status === "error" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
            {err || "Scoring failed."}
          </div>
        )}

        {(status === "scoring" || status === "loading") && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#555", fontSize: 14, marginBottom: 16 }}>
            <span style={{ animation: "kpulse 1s infinite" }}>🎯</span>
            {status === "loading" ? "Loading ground truth…" : `Scoring clusters… ${progress.done}/${progress.total}`}
          </div>
        )}

        {/* tier agreement bars — shown un-filled (—) until the comparison is run */}
        {status !== "loading" && status !== "error" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 8 }}>
            {agg.filter((t) => nativeTierKeys.has(t.key)).map((t) => {
              const heat = confColor(t.pct);
              return (
                <div key={t.key} style={{ background: "#fffdfb", border: "1px solid #e5e1dc", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#888", fontWeight: 700 }}>{tierColLabel({ gtKey: t.key, label: t.label })}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 8px" }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: heat.fg, fontVariantNumeric: "tabular-nums" }}>{t.total ? t.pct.toFixed(0) : "—"}{t.total ? "%" : ""}</span>
                    <span style={{ fontSize: 12.5, color: "#999" }}>{t.matched}/{t.total} agree</span>
                  </div>
                  <div style={{ height: 8, background: "#eee7df", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${t.pct}%`, height: "100%", background: heat.fg }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* driver-scoring extras: purity-stratified sub headline + abstention precision */}
        {status === "done" && score.subStrat && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, margin: "4px 0 8px" }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#15803d", fontWeight: 700 }}>Sub-type — headline (high-purity)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 4px" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>{score.subStrat.high.total ? score.subStrat.high.pct.toFixed(0) : "—"}{score.subStrat.high.total ? "%" : ""}</span>
                <span style={{ fontSize: 12.5, color: "#666" }}>{score.subStrat.high.matched}/{score.subStrat.high.total} on pure clusters (frac≥0.5)</span>
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>raw {score.subStrat.raw.pct.toFixed(0)}% ({score.subStrat.raw.matched}/{score.subStrat.raw.total}) · weighted {score.subStrat.weighted_pct.toFixed(0)}% · low-purity {score.subStrat.low.total ? score.subStrat.low.pct.toFixed(0) + "%" : "—"} ({score.subStrat.low.matched}/{score.subStrat.low.total})</div>
            </div>
            {score.abstention && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#a16207", fontWeight: 700 }}>Abstention precision</div>
                <div style={{ fontSize: 13.5, color: "#444", margin: "6px 0 4px", lineHeight: 1.5 }}>
                  Forced sub-call would-fail: <b style={{ color: "#a16207" }}>{score.abstention.abstained_forced_sub_fail.total ? score.abstention.abstained_forced_sub_fail.pct.toFixed(0) + "%" : "—"}</b> on abstained ({score.abstention.abstained_forced_sub_fail.fail}/{score.abstention.abstained_forced_sub_fail.total}) vs {score.abstention.assigned_forced_sub_fail.total ? score.abstention.assigned_forced_sub_fail.pct.toFixed(0) + "%" : "—"} on assigned. A higher abstained rate means abstention declines precisely where a forced call fails.
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>assign {score.abstention.n_assign} · abstain {score.abstention.n_abstain} · unresolved {score.abstention.n_unresolved}</div>
              </div>
            )}
          </div>
        )}

        {/* the trigger — fills the comparison in once all clusters are labelled */}
        <div style={{ display: "flex", gap: 12, margin: "14px 0 18px", alignItems: "center", flexWrap: "wrap" }}>
          {(status === "idle" || status === "scoring") && (
            <button
              onClick={() => runScoring(true)}
              disabled={!allLabelled || status === "scoring"}
              title={allLabelled ? "" : "Label every cluster first"}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: allLabelled && status !== "scoring" ? "#15803d" : "#cdd5cf", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, cursor: allLabelled && status !== "scoring" ? "pointer" : "default" }}
            >
              🎯 {status === "scoring" ? `Comparing… ${progress.done}/${progress.total}` : `Compare to ${dataset.name} ground truth`}
            </button>
          )}
          {status === "done" && <button onClick={() => runScoring(true)} style={{ ...btnGhost, fontSize: 13.5 }}>↻ Re-run comparison</button>}
          {status === "idle" && !allLabelled && (
            <span style={{ fontSize: 12.5, color: "#92400e" }}>Label all {clusters.length} clusters to enable the comparison.</span>
          )}
          <span style={{ fontSize: 12, color: "#aaa" }}>
            Reference: {dataset.name} published labels{gt?.clusteredCells ? ` · ${gt.clusteredCells.toLocaleString()} cells clustered` : ""} · model {model}. Numeric sub-type suffixes (e.g. &ldquo;periderm 10&rdquo;) are matched on the biological stem.
          </span>
        </div>

        {/* per-cluster detail — the full set of clusters with their tier cells (un-filled until scored) */}
        {clusters.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #e5e1dc", borderRadius: 12, background: "#fffdfb" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, tableLayout: "fixed" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", background: "#faf7f3" }}>
                  <th style={{ padding: "7px 10px", fontWeight: 700, width: `${firstColW}%` }}>Cluster</th>
                  {nativeTiers.map((t) => (
                    <th key={t.key} style={{ padding: "7px 9px", fontWeight: 700, width: `${tierColW}%` }}>{tierColLabel(t)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clusters.map((c, i) => {
                  const v = verdicts[c.id];
                  const drv = parseDriverLabel(labels[c.id] || "");
                  const refs = gtTiersFor(c.id);
                  const cc = confidence[c.id];
                  const hasLabel = !!labels[c.id];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onPick?.(c.id)}
                      title={hasLabel ? `${c.label}: ${labels[c.id]} — click to open` : `${c.label} — not yet labelled`}
                      style={{ borderTop: "1px solid #eee7df", opacity: hasLabel ? 1 : 0.6, cursor: onPick ? "pointer" : "default" }}
                    >
                      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 99, background: c.color, flexShrink: 0 }} />
                          <strong>Cluster {i + 1}</strong>
                        </div>
                      </td>
                      {nativeTiers.map((t) => {
                        const ti = SCORE_TIERS.findIndex((s) => s.key === t.key);
                        const ref = refs[t.gtKey as keyof typeof refs];
                        const tv = v ? v[t.key] : null;
                        // driver-scoring: a tier finer than our concluded depth is "not attempted" = abstained at this depth.
                        const attempted = attemptedTier(drv.reached, drv.kind, ti);
                        const scored = !!tv;
                        const matched = scored && !!tv!.match && attempted;   // green
                        const wrong = scored && attempted && !tv!.match;      // red
                        const abstained = scored && !attempted;               // yellow
                        // what Daniotype predicted for THIS tier (per-tier read), falling back to the concluded call
                        const tp = cc ? (cc[t.key as keyof Omit<ClusterConf, "why">] as TierPred | undefined) : undefined;
                        const pred = (tp?.prediction && tp.prediction.trim()) ? tp.prediction.trim() : (drv.identity || labels[c.id] || "");
                        const box = matched ? { bg: "#f0fdf4", bd: "#bbf7d0" }
                          : wrong ? { bg: "#fef2f2", bd: "#fecaca" }
                          : abstained ? { bg: "#fefce8", bd: "#fde68a" }
                          : { bg: "transparent", bd: "transparent" };
                        return (
                          <td key={t.key} style={{ padding: "5px 6px", verticalAlign: "top" }} title={tv?.note || ""}>
                            <div style={{ background: box.bg, border: `1px solid ${box.bd}`, borderRadius: 8, padding: "6px 8px", wordBreak: "break-word", minHeight: 34 }}>
                              {/* Daniotype prediction + per-tier confidence */}
                              <div style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
                                {matched && <span style={{ color: "#15803d", fontWeight: 800, flexShrink: 0 }} title="matches the reference">✓</span>}
                                {abstained && <span style={{ color: "#a16207", fontWeight: 800, flexShrink: 0, fontSize: 10.5 }} title="abstained at this tier">⊘</span>}
                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "#a59f96", flexShrink: 0 }}>Daniotype</span>
                                {tp && typeof tp.pct === "number" && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8a847c", flexShrink: 0 }}>{tp.pct.toFixed(0)}%</span>}
                              </div>
                              <div style={{ color: hasLabel ? "#2b2b2b" : "#cbc5be", fontWeight: 600, marginTop: 1 }}>{hasLabel ? (pred || "—") : "·"}</div>
                              {/* the dataset's own (native) ground-truth label */}
                              <div style={{ fontSize: 10.5, color: "#6b655d", marginTop: 4, borderTop: "1px solid #00000010", paddingTop: 3 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "#a59f96" }}>{dataset.name} GT</span>
                                <div style={{ marginTop: 1 }}>{ref || "—"}</div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Wrapper>
  );
}
