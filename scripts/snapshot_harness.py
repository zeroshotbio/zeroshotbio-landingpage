#!/usr/bin/env python3
"""Snapshot the CURRENT harness configuration + its verification scores into
src/app/daniotype_kasperov/harness_registry.json. The harness = the
proposer->archivist->reasoner->conclude loop + grounding rules. Scores are READ
from dataset_facts.json (the native-benchmark numbers) — never hand-typed. Run
this to mint a new harness version whenever the config changes."""
import json, os, hashlib, subprocess, datetime
ROOT=os.path.join(os.path.dirname(__file__),"..")
DK=os.path.join(ROOT,"src","app","daniotype_kasperov")
def sh(*a): return subprocess.check_output(a,cwd=ROOT).decode().strip()
def sha(p):
    try: return hashlib.sha256(open(os.path.join(ROOT,p),"rb").read()).hexdigest()[:16]
    except Exception: return None
CONFIG_FILES=["src/app/api/kasperov_agent/route.ts","src/app/api/kasperov_confidence/route.ts",
              "src/app/api/kasperov_score/route.ts","backend/daniotype_autopilot_api/app.py"]
facts=json.load(open(os.path.join(DK,"dataset_facts.json")))
def gt_block(ds):
    sc=facts[ds].get("scorecard") or {}
    return {"dataset":ds,"platform":facts[ds].get("platform"),"platform_class":sc.get("platform_class"),
            "tiers":sc.get("tiers"),"strata":sc.get("strata"),"abstention":sc.get("abstention")}
def nogt_block(ds):
    ng=facts[ds].get("noGtScorecard") or {}
    b={"dataset":ds,"coverage":ng.get("coverage"),"grounding_pct":ng.get("grounding_pct"),"tier_depth":ng.get("tier_depth")}
    if ng.get("consistency"): b["consistency"]={"headlinePct":ng["consistency"]["headlinePct"],"adjudication":ng["consistency"]["adjudication"]}
    if ng.get("processingConsistency"): b["processingConsistency"]={"headlinePct":ng["processingConsistency"]["headlinePct"],"cellWeightedPct":ng["processingConsistency"]["cellWeightedPct"],"adjudication":ng["processingConsistency"]["adjudication"]}
    return b
# run provenance: the validated runs registered in /data/daniotype_runs (top run per dataset)
RUNS="/data/daniotype_runs"; prov=[]; total=0.0
for ds in ["zscape","chemfish","daniocell","megafin","megafin_parse","minifin"]:
    ip=f"{RUNS}/{ds}/_index.json"
    if not os.path.exists(ip): continue
    idx=json.load(open(ip))
    if idx:
        e=idx[0]; prov.append({"dataset":ds,"runId":e["runId"],"nLabelled":e.get("nLabelled"),"costUsd":e.get("costUsd")})
        total+=e.get("costUsd") or 0
entry={
 "id":"v1.0","name":"native-validated","version":"1.0",
 "stampedAt":datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
 "gitCommit":sh("git","rev-parse","--short","HEAD"),"model":"gpt-5.5",
 "summary":"Three-personality loop — two Researcher proposers → Archivist (:5007 live stats) → Reasoner → conclude. Cite-only-confirmed-positives + assign-at-the-depth-the-evidence-supports. Grounding guard verifies :5007 alignment by enrichment direction (log2FC≥1; significance required only at n≥50). Fail-loud dataset routing (no silent fallback). Open-vocabulary where no published labels exist.",
 "design":[
   "Driver-scoring: the conclude identity is judged at each native tier; finer-than-driver tiers are not-attempted, never a miss.",
   "Abstention is a first-class outcome — declines only under-powered or technical-artifact clusters, never reliable ones.",
   "Semantic judge (synonym/ontology/lineage equivalence), not exact-string matching.",
   "Misalignment guard + count-bound before any spend; halt-no-spend on failure.",
 ],
 "configFiles":[{"path":p,"sha256_16":sha(p)} for p in CONFIG_FILES],
 "verification":{
   "benchmark":"967-unit native-schema benchmark (each dataset's own finest native cell groups), size-stratified ≥100/≥30/all, LLM semantic judge.",
   "gt":[gt_block(ds) for ds in ["zscape","chemfish","daniocell"]],
   "noGt":[nogt_block(ds) for ds in ["megafin","megafin_parse","minifin"]],
   "provenance":{"runs":prov,"totalCostUsd":round(total,2)},
 },
}
REG=os.path.join(DK,"harness_registry.json")
existing=json.load(open(REG)) if os.path.exists(REG) else {"active":None,"harnesses":[]}
# replace same-id entry or prepend
existing["harnesses"]=[h for h in existing["harnesses"] if h["id"]!=entry["id"]]
existing["harnesses"].insert(0,entry); existing["active"]=entry["id"]
json.dump(existing,open(REG,"w"),indent=1)
print("wrote",REG)
print(f"  harness {entry['id']} '{entry['name']}' stamped {entry['stampedAt']} commit {entry['gitCommit']}")
print(f"  GT verified: {[ (g['dataset'], [t['pct'] for t in g['tiers']]) for g in entry['verification']['gt'] ]}")
print(f"  provenance runs: {len(prov)} | total ${entry['verification']['provenance']['totalCostUsd']}")
