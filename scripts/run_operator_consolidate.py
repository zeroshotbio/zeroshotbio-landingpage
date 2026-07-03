#!/usr/bin/env python3
"""Run the REDESIGNED Meta-Reasoner operator (fine-then-consolidate) against the
FROZEN 250-leaf fixture. Read-only over leaf labels; the ONLY LLM calls are cheap
operator meta-calls (~$0.01 each) via the local dev server /api/meta_reasoner
(op:"consolidate"). Propose-only — nothing here mutates the fixture.

Outputs: per-compartment merge/set_aside decisions, a global flag_missing audit,
and the proposed final node set per schema layer (250 leaves → N nodes).
"""
import json, os, time, urllib.request, base64, collections

BASE = "http://localhost:3111"
AUTH = base64.b64encode(b":danio_lover").decode()
MODEL = "gpt-5.4"
FIXTURE = "/data/zeroshotbio-landingpage/daniotype_data/meta_reasoner_replay/full_250.json"
FIXTURE_RUNID = "20260702-113218-fbfd1c"
WORKER = "http://127.0.0.1:5008"
WORKER_TOKEN = os.environ.get("AUTOPILOT_API_TOKEN", "")
PRICE = {"gpt-5.4": (2.5, 15.0), "gpt-5.5": (5.0, 30.0)}

def post(payload, timeout=140):
    data = json.dumps(payload).encode()
    r = urllib.request.Request(BASE + "/api/meta_reasoner", data=data, method="POST",
        headers={"content-type": "application/json", "authorization": "Basic " + AUTH})
    return json.loads(urllib.request.urlopen(r, timeout=timeout).read().decode())

def cost_of(u):
    pin, pout = PRICE.get((u or {}).get("model", MODEL), (2.5, 15.0))
    return ((u or {}).get("in") or 0)/1e6*pin + ((u or {}).get("out") or 0)/1e6*pout

def main():
    a = json.load(open(FIXTURE))
    labels = {str(l["id"]): l["finalLabel"] for l in a["leaves"]}
    comps = sorted(a["compartments"], key=lambda c: c["index"])
    sizes = {str(c["index"]): len(c["leafIds"]) for c in comps}
    ledger = {"totalLeaves": len(a["leaves"]), "totalCompartments": len(comps), "compartmentSizes": sizes}

    stamp = time.strftime("%Y%m%d-%H%M%S")
    outdir = f"/data/scratch/kasperov_operator_consolidate_{stamp}"
    os.makedirs(outdir, exist_ok=True)

    spend = 0.0; per_comp = []; leak_any = []
    print(f"[init] fixture {FIXTURE_RUNID} | {ledger['totalLeaves']} leaves / {ledger['totalCompartments']} compartments", flush=True)

    # ---- per-compartment merge / set_aside ----
    for c in comps:
        ci = c["index"]
        label_set = [{"leaf_id": str(i), "label": labels[str(i)]} for i in c["leafIds"]]
        r = post({"op": "consolidate", "scope": "compartment", "compartment": ci, "labelSet": label_set, "ledger": ledger, "model": MODEL})
        if not r.get("ok"):
            print(f"  C{ci}: FAILED {r.get('error')} {r.get('detail','')}", flush=True)
            per_comp.append({"compartment": ci, "error": r.get("error")}); continue
        spend += cost_of(r.get("usage"))
        out = r["output"]; inp = r["input"]
        # GT-blind: key-scan the exact input
        blob = json.dumps(inp).lower().replace("_", "")
        leak = [f for f in ("gtcontrol","gtallcell","gttissue","groundtruth","controlvote","verdict") if f in blob]
        leak_any += leak
        merges = out.get("merges", []); aside = out.get("set_aside", [])
        # coverage check
        covered = [m for grp in merges for m in grp.get("member_leaf_ids", [])] + [s["leaf_id"] for s in aside]
        exp = set(str(i) for i in c["leafIds"]); got = collections.Counter(covered)
        missed = exp - set(got); dup3 = [x for x, n in got.items() if n > 1]; extra = set(got) - exp
        per_comp.append({"compartment": ci, "n_leaves": len(exp), "reasoning": r.get("reasoning"),
                         "merges": merges, "set_aside": aside, "gt_blind": r["guardrails"]["gtBlind"],
                         "gt_leak": leak or "clean", "input_keys": list(inp.keys()),
                         "coverage": {"missed": sorted(missed), "duplicated": dup3, "extra": sorted(extra)},
                         "usage": r.get("usage")})
        print(f"  C{ci}: {len(merges)} merges + {len(aside)} set_aside = {len(merges)+len(aside)} nodes (from {len(exp)} leaves)"
              f"  cover:{'ok' if not (missed or dup3 or extra) else f'miss{len(missed)}/dup{len(dup3)}/extra{len(extra)}'}"
              f"  gt_blind={r['guardrails']['gtBlind']} leak={leak or 'clean'}", flush=True)

    # ---- global flag_missing audit over the whole labelled set ----
    all_labels = [{"leaf_id": str(l["id"]), "label": l["finalLabel"]} for l in a["leaves"]]
    rg = post({"op": "consolidate", "scope": "global", "labelSet": all_labels, "ledger": ledger, "model": MODEL})
    flag_missing = None
    if rg.get("ok"):
        spend += cost_of(rg.get("usage"))
        flag_missing = rg["output"].get("flag_missing")
        gblob = json.dumps(rg["input"]).lower().replace("_", "")
        leak_any += [f for f in ("gtcontrol","gtallcell","gttissue","groundtruth","controlvote","verdict") if f in gblob]
        print(f"  GLOBAL flag_missing: {len((flag_missing or {}).get('expected_still_missing',[]))} tissues | gt_blind={rg['guardrails']['gtBlind']}", flush=True)
    else:
        print(f"  GLOBAL flag_missing FAILED: {rg.get('error')}", flush=True)

    # ---- aggregate the proposed FINAL node set ----
    ok_comps = [p for p in per_comp if "error" not in p]
    nodes = []  # (tier, label, kind)
    for p in ok_comps:
        for m in p["merges"]: nodes.append((m.get("tier", "cell_type_broad"), m.get("node_label"), "merge", len(m.get("member_leaf_ids", []))))
        for s in p["set_aside"]: nodes.append((s.get("tier", "cell_type_broad"), labels.get(s["leaf_id"], "?"), "set_aside", 1))
    TIER_ORDER = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
    tier_counts = collections.Counter(n[0] for n in nodes)
    total_nodes = len(nodes)
    merged_leaves = sum(n[3] for n in nodes if n[2] == "merge")
    aside_leaves = sum(1 for n in nodes if n[2] == "set_aside")

    summary = {
        "fixture_runId": FIXTURE_RUNID, "dataset": a["dataset"], "model": MODEL,
        "before": {"leaves": ledger["totalLeaves"], "compartments": ledger["totalCompartments"]},
        "after": {"total_nodes": total_nodes, "n_merge_nodes": sum(1 for n in nodes if n[2]=="merge"),
                  "n_set_aside_nodes": aside_leaves, "leaves_in_merges": merged_leaves,
                  "nodes_per_tier": {t: tier_counts.get(t, 0) for t in TIER_ORDER}},
        "flag_missing": flag_missing,
        "meta_cost_usd": round(spend, 4), "gt_leak_overall": sorted(set(leak_any)) or "clean",
        "compartments": per_comp,
    }
    json.dump(summary, open(os.path.join(outdir, "operator_proposal.json"), "w"), indent=1)

    # ---- persist to EBS (propose-only proposal record; same path as decisions) ----
    try:
        run_obj = {"datasetId": a["datasetId"], "dataset": a["dataset"], "model": MODEL,
                   "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "note": f"🧭 Meta-Reasoner operator proposal (fine-then-consolidate) over fixture {FIXTURE_RUNID}: {ledger['totalLeaves']} leaves → {total_nodes} nodes",
                   "source": "meta_reasoner_operator_proposal", "fixtureRunId": FIXTURE_RUNID,
                   "operatorProposal": summary, "judgements": [], "hasJudgement": False,
                   "clusters": [{"id": l["id"], "label": l["label"], "finalLabel": l["finalLabel"], "validated": False} for l in a["leaves"]]}
        req = urllib.request.Request(f"{WORKER}/runs", data=json.dumps(run_obj).encode(), method="POST",
              headers={"content-type": "application/json", "x-api-token": WORKER_TOKEN})
        rid = json.loads(urllib.request.urlopen(req, timeout=30).read().decode()).get("runId")
        summary["ebs_runId"] = rid; json.dump(summary, open(os.path.join(outdir, "operator_proposal.json"), "w"), indent=1)
        print(f"[ebs] persisted proposal runId={rid}", flush=True)
    except Exception as e:
        print(f"[ebs] persist FAILED: {e} (proposal on disk at {outdir})", flush=True)

    print(f"\n[done] {ledger['totalLeaves']} leaves → {total_nodes} nodes | per-tier {dict(tier_counts)} | meta-cost ${spend:.4f} | leak {sorted(set(leak_any)) or 'clean'}")
    print(f"[out] {outdir}/operator_proposal.json")

if __name__ == "__main__":
    main()
