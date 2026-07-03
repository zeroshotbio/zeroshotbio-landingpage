#!/usr/bin/env python3
"""Step-5 scoring: run the ~66 merged nodes (from the frozen operator proposal)
through the EXISTING fuzzy judge (/api/kasperov_score), each node scored at its
OWN operator-assigned tier, with per-node purity as a diagnostic (not a gate).

Thin adapter only — the judge already accepts (ourLabel, gt) pairs and scores by
biological meaning with roll-up. We build one item per node: ourLabel = the node's
identity; gt = the cell-weighted plurality GT of its member leaves at each tier.
Read the verdict at the node's own tier. GT is scoring-only.
"""
import json, glob, os, collections, urllib.request, base64, time

BASE = "http://localhost:3111"
AUTH = base64.b64encode(b":danio_lover").decode()
MODEL = "gpt-5.4"
GT = json.load(open("/data/zeroshotbio-landingpage/daniotype_data/zscape_recursive/groundtruth.json"))["clusters"]
FULL = json.load(open("/data/zeroshotbio-landingpage/daniotype_data/meta_reasoner_replay/full_250.json"))
LEAF_LABEL = {str(l["id"]): l["finalLabel"] for l in FULL["leaves"]}
TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
prop = json.load(open(sorted(glob.glob("/data/scratch/kasperov_operator_consolidate_*"), key=os.path.getmtime)[-1] + "/operator_proposal.json"))

def gt_entry(lid, t):
    e = GT.get(str(lid), {}).get(t)
    return (e["label"], e.get("n", 0)) if e else (None, 0)

def plurality_gt(leaf_ids, t):
    cw = collections.Counter()
    for i in leaf_ids:
        lab, n = gt_entry(i, t)
        if lab: cw[lab] += n
    if not cw: return None
    return cw.most_common(1)[0][0]

def purity(leaf_ids, t):
    cw = collections.Counter()
    for i in leaf_ids:
        lab, n = gt_entry(i, t); cw[lab] += n
    tot = sum(cw.values()); top = max(cw.values()) if cw else 0
    return (top / tot) if tot else 0.0

# ---- build one judge item per node ----
nodes = []  # {node_id, identity, tier, leaf_ids, purity}
for p in prop["compartments"]:
    ci = p["compartment"]
    for j, m in enumerate(p.get("merges", [])):
        nodes.append({"node_id": f"C{ci}-m{j}", "identity": m["node_label"], "tier": m["tier"],
                      "leaf_ids": [str(x) for x in m["member_leaf_ids"]], "kind": "merge"})
    for j, s in enumerate(p.get("set_aside", [])):
        lid = str(s["leaf_id"])
        nodes.append({"node_id": f"C{ci}-a{j}", "identity": s.get("node_label") or LEAF_LABEL.get(lid, "?"),
                      "tier": s["tier"], "leaf_ids": [lid], "kind": "set_aside"})

for n in nodes:
    n["purity"] = purity(n["leaf_ids"], n["tier"])
    n["gt"] = {t: plurality_gt(n["leaf_ids"], t) for t in TIERS}

print(f"[init] {len(nodes)} nodes to score through the fuzzy judge (batches of 14)", flush=True)

def score_batch(batch):
    items = [{"id": n["node_id"], "ourLabel": n["identity"], "gt": n["gt"]} for n in batch]
    body = json.dumps({"items": items, "model": MODEL}).encode()
    r = urllib.request.Request(BASE + "/api/kasperov_score", data=body, method="POST",
        headers={"content-type": "application/json", "authorization": "Basic " + AUTH})
    return json.loads(urllib.request.urlopen(r, timeout=300).read().decode())

verdicts = {}; usage_in = usage_out = 0
for k in range(0, len(nodes), 14):
    batch = nodes[k:k+14]
    d = score_batch(batch)
    for res in d.get("results", []):
        verdicts[res["id"]] = res
    u = d.get("usage", {}); usage_in += u.get("in", 0); usage_out += u.get("out", 0)
    print(f"  scored {min(k+14,len(nodes))}/{len(nodes)}", flush=True)

# gpt-5.4 pricing
cost = usage_in/1e6*2.5 + usage_out/1e6*15.0

# ---- assemble the scored table (verdict at each node's OWN tier) ----
rows = []
agree_by_tier = collections.defaultdict(lambda: [0, 0])
for n in nodes:
    v = verdicts.get(n["node_id"], {})
    tv = v.get(n["tier"], {})
    match = bool(tv.get("match"))
    agree_by_tier[n["tier"]][0] += int(match); agree_by_tier[n["tier"]][1] += 1
    rows.append({"node_id": n["node_id"], "kind": n["kind"], "identity": n["identity"], "tier": n["tier"],
                 "n_leaves": len(n["leaf_ids"]), "gt_at_tier": n["gt"][n["tier"]],
                 "agree": match, "note": tv.get("note", ""), "purity": round(n["purity"], 3)})

out = {"fixture_runId": prop["fixture_runId"], "model": MODEL, "n_nodes": len(nodes),
       "meta_cost_usd": round(cost, 4), "agree_by_tier": {t: {"agree": a[0], "total": a[1]} for t, a in agree_by_tier.items()},
       "overall_agree": sum(a[0] for a in agree_by_tier.values()), "rows": rows}
outdir = os.path.dirname(sorted(glob.glob("/data/scratch/kasperov_operator_consolidate_*"), key=os.path.getmtime)[-1] + "/x")
json.dump(out, open(os.path.join(outdir, "scored_nodes.json"), "w"), indent=1)
print(f"[done] scored {len(nodes)} nodes | overall agree {out['overall_agree']}/{len(nodes)} | judge cost ${cost:.4f}")
print(f"[out] {os.path.join(outdir,'scored_nodes.json')}")
