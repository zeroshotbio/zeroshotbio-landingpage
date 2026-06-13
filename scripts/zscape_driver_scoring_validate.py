#!/usr/bin/env python3
"""Offline validation of the driver-scoring + abstention-crediting + purity fix. READ-ONLY.

Pure transform over the SAVED ZSCAPE run JSONs — no model calls. Re-aggregates the
already-judged per-tier verdicts under the NEW rules and reports BEFORE/AFTER so the
logic can be sanity-checked before any paid run.

NEW rules (mirror what app.py score_clusters / client runScoring will do):
  - Score the DRIVER object (the kasperov-conclude finalLabel), judged at each tier.
    (On run 20260609-032442 the saved predictions WERE the finalLabel for every tier —
     i.e. its saved verdicts are already driver-identity verdicts, so re-aggregating it
     is a faithful preview of the live change.)
  - Credit abstention at the tier reached: "X (abstained · tissue)" => attempted germ_layer
    + tissue only; cell_type_broad/sub are NOT-ATTEMPTED (excluded from the denominator,
    never scored as a miss). "(unresolved — review)" => incomplete (attempted nothing).
  - Headline sub metric = high-purity (frac>=0.5) accuracy; raw / purity-weighted / low
    reported alongside.
  - Abstention precision = among abstained clusters, fraction whose forced sub-call WOULD
    have failed (driver identity judged at sub = miss); compared to non-abstained.

These functions are the reference spec for the staged app.py / KasperovClient changes.
"""
import json, glob, os, re, statistics as st

RUN_DIR = "/data/daniotype_runs/zscape"
GT_PATH = "/data/zeroshotbio-landingpage/daniotype_data/zscape/groundtruth.json"
TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
gt = json.load(open(GT_PATH))["clusters"]


def norm_tier(s):
    s = (s or "").lower().strip()
    if "germ" in s: return 0
    if "tissue" in s: return 1
    if "broad" in s: return 2
    if "sub" in s: return 3
    if "cell type" in s or "cell_type" in s: return 2  # bare "cell type" -> broad
    return None


def parse_driver(final_label):
    """-> (identity, reached_idx, kind). reached_idx: 0..3 attempted<=, -1 incomplete."""
    fl = (final_label or "").strip()
    m = re.search(r"\(abstain(?:ed)?\s*[·:\-]\s*([^)]+)\)", fl, re.I)
    if m:
        idx = norm_tier(m.group(1))
        return fl[:m.start()].strip(), (idx if idx is not None else 1), "abstain"
    if not fl or "unresolved" in fl.lower():
        return "", -1, "unresolved"
    return fl, 3, "assign"


def attempted(reached_idx, kind, tier_idx):
    if kind == "unresolved":
        return False
    return tier_idx <= reached_idx


def frac(cid, tier):
    return ((gt.get(cid) or {}).get(tier) or {}).get("frac")


def load_run(path):
    d = json.load(open(path))
    g = d.get("groundTruth") or {}
    verd = g.get("verdicts") or {}
    rows = []
    for c in d.get("clusters", []):
        cf = c.get("confidence") or {}
        v = verd.get(c["id"]) or {}
        ident, reached, kind = parse_driver(c.get("finalLabel"))
        rows.append({
            "id": c["id"], "finalLabel": c.get("finalLabel") or "", "kind": kind, "reached": reached,
            "match": {t: (v.get(t) or {}).get("match") for t in TIERS},   # saved judge verdicts
            "conf_sub": (cf.get("cell_type_sub") or {}).get("pct"),
        })
    return {"name": os.path.basename(path)[:21], "source": d.get("source"), "rows": rows,
            "has_conf": sum(1 for c in d.get("clusters", []) if c.get("confidence"))}


def aggregate(rows):
    res = {}
    # BEFORE: every tier attempted, miss if wrong (current behaviour)
    for t in TIERS:
        pairs = [r["match"][t] for r in rows if r["match"][t] is not None]
        res.setdefault("before", {})[t] = (sum(1 for m in pairs if m), len(pairs))
    # AFTER: abstention-credited denominators
    for ti, t in enumerate(TIERS):
        att = [r for r in rows if attempted(r["reached"], r["kind"], ti) and r["match"][t] is not None]
        res.setdefault("after", {})[t] = (sum(1 for r in att if r["match"][t]), len(att))
    # purity-stratified sub (only attempted-sub clusters)
    sub_att = [r for r in rows if attempted(r["reached"], r["kind"], 3) and r["match"]["cell_type_sub"] is not None]
    hi = [r for r in sub_att if (frac(r["id"], "cell_type_sub") or 0) >= 0.5]
    lo = [r for r in sub_att if (frac(r["id"], "cell_type_sub") or 0) < 0.5]
    wnum = sum((1 if r["match"]["cell_type_sub"] else 0) * (frac(r["id"], "cell_type_sub") or 0) for r in sub_att)
    wden = sum((frac(r["id"], "cell_type_sub") or 0) for r in sub_att)
    res["sub_strat"] = {
        "high": (sum(1 for r in hi if r["match"]["cell_type_sub"]), len(hi)),
        "low": (sum(1 for r in lo if r["match"]["cell_type_sub"]), len(lo)),
        "raw": (sum(1 for r in sub_att if r["match"]["cell_type_sub"]), len(sub_att)),
        "weighted": (wnum / wden * 100) if wden else None,
    }
    # abstention precision: forced sub-call would-fail among abstained vs non-abstained
    ab = [r for r in rows if r["kind"] == "abstain" and r["match"]["cell_type_sub"] is not None]
    nab = [r for r in rows if r["kind"] == "assign" and r["match"]["cell_type_sub"] is not None]
    res["abst"] = {
        "n_abstain": sum(1 for r in rows if r["kind"] == "abstain"),
        "n_unresolved": sum(1 for r in rows if r["kind"] == "unresolved"),
        "n_assign": sum(1 for r in rows if r["kind"] == "assign"),
        "forced_fail_abstain": (sum(1 for r in ab if not r["match"]["cell_type_sub"]), len(ab)),
        "forced_fail_assign": (sum(1 for r in nab if not r["match"]["cell_type_sub"]), len(nab)),
    }
    return res


def pct(t):
    n, d = t
    return f"{100*n/d:5.1f}% ({n}/{d})" if d else "   n/a"


for path in sorted(glob.glob(f"{RUN_DIR}/2026*.json")):
    r = load_run(path)
    a = aggregate(r["rows"])
    note = "DRIVER-scored (0/2 confidence -> predictions were finalLabel)" if r["has_conf"] < 3 else "side-channel-scored (confidence verdicts; abstention re-agg shown for illustration)"
    print("=" * 80)
    print(f"{r['name']}  src={r['source']}  with_confidence={r['has_conf']}  [{note}]")
    print("-" * 80)
    print(f"  kinds: assign={a['abst']['n_assign']}  abstain={a['abst']['n_abstain']}  unresolved={a['abst']['n_unresolved']}")
    print(f"  {'tier':<16}{'BEFORE (all-tiers)':<22}{'AFTER (abstention-credited)':<26}")
    for t in TIERS:
        print(f"  {t:<16}{pct(a['before'][t]):<22}{pct(a['after'][t]):<26}")
    s = a["sub_strat"]
    print(f"  sub stratified:  high-purity {pct(s['high'])}   low {pct(s['low'])}   raw {pct(s['raw'])}   "
          f"weighted {s['weighted']:.1f}%" if s["weighted"] is not None else "")
    ab = a["abst"]
    print(f"  abstention precision: forced-sub WOULD-FAIL  abstained {pct(ab['forced_fail_abstain'])}   "
          f"vs assigned {pct(ab['forced_fail_assign'])}")
print("=" * 80)
print("HEADLINE: compare BEFORE vs AFTER 'cell_type_sub', and high-purity sub, on the")
print("driver-scored run 20260609-032442 — that's the apples-to-apples preview.")
