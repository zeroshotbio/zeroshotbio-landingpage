#!/usr/bin/env python3
"""Offline ZSCAPE calibration + purity audit over saved run JSONs. READ-ONLY.

No model calls, no service, no re-run — pure analysis of the persisted scorecards:
  /data/daniotype_runs/zscape/*.json         (per-cluster confidence pct + per-tier verdict)
  daniotype_data/zscape/groundtruth.json     (per-cluster majority label + purity `frac`)

Produces:
  1. Reliability curve per tier — pooled across runs AND per run — with bin counts + ECE.
  2. Purity-stratified sub accuracy (frac>=0.5 vs <0.5) + purity-weighted accuracy.
  3. Abstention preview — purity + forced-sub-match for abstain/unresolved clusters.
"""
import json, glob, os
from collections import defaultdict

RUN_DIR = "/data/daniotype_runs/zscape"
GT_PATH = "/data/zeroshotbio-landingpage/daniotype_data/zscape/groundtruth.json"
TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
gt = json.load(open(GT_PATH))["clusters"]


def frac(cid, tier):
    return ((gt.get(cid) or {}).get(tier) or {}).get("frac")


def load_run(path):
    d = json.load(open(path))
    g = d.get("groundTruth") or {}
    verd = g.get("verdicts") or {}
    cls = d.get("clusters") or []
    # per-cluster: (tier -> (conf_pct, pred, match)), finalLabel
    rows = []
    for c in cls:
        cf = c.get("confidence") or {}
        v = verd.get(c["id"]) or {}
        rows.append({
            "id": c["id"], "finalLabel": c.get("finalLabel") or "",
            "tiers": {t: {"pct": (cf.get(t) or {}).get("pct"),
                          "pred": (cf.get(t) or {}).get("prediction"),
                          "match": (v.get(t) or {}).get("match")} for t in TIERS},
            "has_conf": bool(cf),
        })
    return {"name": os.path.basename(path)[:21], "source": d.get("source", "?"),
            "model": d.get("model"), "rows": rows, "agg": g.get("aggregate")}


def reliability(pairs, nbins=10):
    """pairs: list[(pct, match01)]. Returns bins + ECE."""
    bins = defaultdict(list)
    for p, m in pairs:
        b = min(nbins - 1, int(p // (100 / nbins)))
        bins[b].append((p, m))
    n = len(pairs); ece = 0.0; out = []
    for b in range(nbins):
        bp = bins.get(b, [])
        if not bp:
            continue
        conf = sum(p for p, _ in bp) / len(bp)
        acc = 100 * sum(m for _, m in bp) / len(bp)
        ece += (len(bp) / n) * abs(acc - conf)
        out.append((b * (100 // nbins), (b + 1) * (100 // nbins), len(bp), acc, conf))
    return out, ece


runs = [load_run(p) for p in sorted(glob.glob(f"{RUN_DIR}/2026*.json"))]
print("RUNS:")
for r in runs:
    withc = sum(1 for x in r["rows"] if x["has_conf"])
    print(f"  {r['name']:<22} src={r['source']:<8} model={r['model']:<8} "
          f"clusters={len(r['rows'])} with_confidence={withc}")
    if withc == 0:
        print("     ^ NO confidence vectors -> its scorecard scored the REASONING finalLabel (fallback), not the confidence side-channel")

print("\n" + "=" * 78)
print("1) RELIABILITY per tier  (pooled across runs that carry confidence, + per-run)")
print("=" * 78)
# pooled
for t in TIERS:
    pairs = []
    for r in runs:
        for x in r["rows"]:
            tt = x["tiers"][t]
            if tt["pct"] is not None and tt["match"] is not None and x["has_conf"]:
                pairs.append((tt["pct"], 1 if tt["match"] else 0))
    if not pairs:
        continue
    out, ece = reliability(pairs)
    mc = sum(p for p, _ in pairs) / len(pairs); ac = 100 * sum(m for _, m in pairs) / len(pairs)
    print(f"\n[POOLED] {t}: n={len(pairs)}  mean_conf={mc:.1f}  acc={ac:.1f}  gap={mc-ac:+.1f}  ECE={ece:.1f}")
    for lo, hi, n, acc, conf in out:
        print(f"    [{lo:>3}-{hi:>3}) n={n:<3} acc={acc:5.1f}%  conf={conf:5.1f}%")

print("\n--- per-run ECE (germ/tissue/broad/sub) ---")
for r in runs:
    if not any(x["has_conf"] for x in r["rows"]):
        print(f"  {r['name']:<22} (no confidence vectors — skipped)"); continue
    eces = []
    for t in TIERS:
        pairs = [(x["tiers"][t]["pct"], 1 if x["tiers"][t]["match"] else 0)
                 for x in r["rows"] if x["has_conf"] and x["tiers"][t]["pct"] is not None and x["tiers"][t]["match"] is not None]
        eces.append(reliability(pairs)[1] if pairs else float("nan"))
    print(f"  {r['name']:<22} src={r['source']:<8} " + "  ".join(f"{t.split('_')[0][:5]}={e:4.1f}" for t, e in zip(TIERS, eces)))

print("\n" + "=" * 78)
print("2) PURITY-STRATIFIED cell_type_sub ACCURACY  (using stored frac)")
print("=" * 78)
for r in runs:
    hi = []; lo = []; wnum = 0.0; wden = 0.0
    for x in r["rows"]:
        m = x["tiers"]["cell_type_sub"]["match"]
        if m is None:
            continue
        f = frac(x["id"], "cell_type_sub")
        if f is None:
            continue
        (hi if f >= 0.5 else lo).append(1 if m else 0)
        wnum += (1 if m else 0) * f; wden += f
    def acc(a): return f"{100*sum(a)/len(a):.1f}% ({sum(a)}/{len(a)})" if a else "n/a"
    head = (sum(hi) / len(hi) * 100) if hi else float("nan")
    raw = ((sum(hi) + sum(lo)) / (len(hi) + len(lo)) * 100) if (hi or lo) else float("nan")
    print(f"\n  {r['name']} (src={r['source']}):")
    print(f"    high-purity (frac>=0.5): {acc(hi)}   <- de-confounded 'real' sub accuracy")
    print(f"    low-purity  (frac<0.5):  {acc(lo)}")
    print(f"    unweighted all:          {raw:.1f}%      purity-weighted: {100*wnum/wden:.1f}%" if wden else "")
    print(f"    headline (agg sub) was:  {[a for a in (r['agg'] or []) if a['key']=='cell_type_sub'] or 'n/a'}")
    if hi and not (raw != raw):
        print(f"    => purity-noise gap (high-purity − unweighted): {head-raw:+.1f} pts")

print("\n" + "=" * 78)
print("3) ABSTENTION PREVIEW  (do abstentions cluster on low-purity/ambiguous cases?)")
print("=" * 78)
import statistics as st
for r in runs:
    abst = [x for x in r["rows"] if any(w in x["finalLabel"].lower() for w in ("abstain", "unresolved"))]
    nonab = [x for x in r["rows"] if x not in abst]
    if not abst:
        print(f"\n  {r['name']}: no abstain/unresolved finalLabels"); continue
    def subfrac(x): return frac(x["id"], "cell_type_sub")
    af = [subfrac(x) for x in abst if subfrac(x) is not None]
    nf = [subfrac(x) for x in nonab if subfrac(x) is not None]
    am = [1 if x["tiers"]["cell_type_sub"]["match"] else 0 for x in abst if x["tiers"]["cell_type_sub"]["match"] is not None]
    print(f"\n  {r['name']}: {len(abst)} abstain/unresolved clusters")
    print(f"    mean sub-purity  abstained={st.mean(af):.2f}  vs  non-abstained={st.mean(nf):.2f}" if af and nf else "")
    print(f"    forced sub-prediction matched on abstained clusters: {sum(am)}/{len(am)}" if am else "")
    for x in abst:
        sf = subfrac(x); m = x["tiers"]["cell_type_sub"]["match"]
        print(f"      id={x['id']:<5} sub_purity={sf if sf is not None else '?':<5} forced_sub_match={m}  finalLabel={x['finalLabel'][:55]!r}")
