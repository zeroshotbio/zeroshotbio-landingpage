#!/usr/bin/env python3
"""Snapshot the CURRENT harness configuration + its verification scores into
src/app/daniotype_kasperov/harness_registry.json. The harness = the
proposer->archivist->reasoner->conclude loop + grounding rules. Scores are READ
from dataset_facts.json (precise, not rounded; never hand-typed). Run this to
mint a new harness version whenever the BEHAVIORAL config changes.

The config fingerprint hashes only BEHAVIORAL source — the three prompt/judge
routes whole, and the worker's behavioral functions by name (not the whole
worker file, so run-store plumbing edits don't spuriously bump the hash).

IMPORTANT (documented in the registry): the hash pins CONFIGURATION only.
Identical hash does NOT guarantee identical behavior — the model (a floating
provider alias) and the :5007 grounding data are external dependencies. And the
semantic judge is stochastic (~±2-3pt aggregate band), so a version delta must
exceed that band to count as a real improvement, not judge noise."""
import json, os, re, hashlib, subprocess, datetime
ROOT=os.path.join(os.path.dirname(__file__),"..")
DK=os.path.join(ROOT,"src","app","daniotype_kasperov")
def sh(*a): return subprocess.check_output(a,cwd=ROOT).decode().strip()
def h16(s): return hashlib.sha256(s.encode() if isinstance(s,str) else s).hexdigest()[:16]
def file_hash(p):
    try: return h16(open(os.path.join(ROOT,p),"rb").read())
    except Exception: return None
def func_hash(path, names):
    """Hash specific top-level python functions by name (def col 0 .. next def col 0)."""
    try: src=open(os.path.join(ROOT,path)).read()
    except Exception: return None
    out=[]
    for n in names:
        m=re.search(rf"(?m)^def {re.escape(n)}\b.*?(?=^def |\Z)", src, re.S)
        if m: out.append(m.group(0))
    return h16("".join(out)) if out else None

# BEHAVIORAL config fingerprint (not run-store plumbing)
CONFIG=[
 {"path":"src/app/api/kasperov_agent/route.ts","scope":"whole","sha256_16":file_hash("src/app/api/kasperov_agent/route.ts")},
 {"path":"src/app/api/kasperov_confidence/route.ts","scope":"whole","sha256_16":file_hash("src/app/api/kasperov_confidence/route.ts")},
 {"path":"src/app/api/kasperov_score/route.ts","scope":"whole","sha256_16":file_hash("src/app/api/kasperov_score/route.ts")},
 {"path":"backend/daniotype_autopilot_api/app.py","scope":"functions: verify_grounding, run_one_cluster, get_confidence",
  "sha256_16":func_hash("backend/daniotype_autopilot_api/app.py",["verify_grounding","run_one_cluster","get_confidence"])},
]

facts=json.load(open(os.path.join(DK,"dataset_facts.json")))
def gt_block(ds):
    sc=facts[ds].get("scorecard") or {}
    return {"dataset":ds,"platform":facts[ds].get("platform"),"platform_class":sc.get("platform_class"),
            "tiers":sc.get("tiers"),"strata":sc.get("strata"),"abstention":sc.get("abstention")}  # precise pcts
def nogt_block(ds):
    ng=facts[ds].get("noGtScorecard") or {}
    b={"dataset":ds,"coverage":ng.get("coverage"),"grounding_pct":ng.get("grounding_pct"),"tier_depth":ng.get("tier_depth")}
    if ng.get("consistency"): b["consistency"]={"headlinePct":ng["consistency"]["headlinePct"],"adjudication":ng["consistency"]["adjudication"]}
    if ng.get("processingConsistency"): b["processingConsistency"]={"headlinePct":ng["processingConsistency"]["headlinePct"],"cellWeightedPct":ng["processingConsistency"]["cellWeightedPct"],"adjudication":ng["processingConsistency"]["adjudication"]}
    return b
# run provenance: validated runs registered in /data/daniotype_runs (top run per dataset)
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
 "configFingerprint":CONFIG,
 # The hash pins CONFIG only; these are NOT captured by it and can change behavior.
 "externalDependencies":{
   "model":{"id":"gpt-5.5","kind":"floating provider alias","note":"may drift when the provider updates the model — pin to a dated snapshot id when one is available for a fully reproducible run."},
   "groundingData":{"service":":5007 (minifin_query)","note":"per-dataset DEGs / p-values served live; the config hash does NOT capture this data, only the rules that query it."},
   "caveat":"Config-reproducible only: an identical configFingerprint does not guarantee identical labels, because the model and grounding data are external to the hash.",
 },
 # Why the score channel needs care before comparing versions.
 "scoreChannel":{
   "judge":"gpt-5.5 /v1/responses, reasoning effort low — a reasoning model (temperature is not a reliable determinism knob).",
   "deterministic":False,
   "observedVariance":"~10% of borderline per-unit verdicts flip across identical re-scores; ~±2-3pt aggregate swing (e.g. MiniFin consistency moved 72→74 / 51.9→53.7 on re-run with the config unchanged).",
   "comparisonRule":"A version-to-version score delta must EXCEED the ±~3pt judge band to count as a real improvement, not noise. Preferred: re-score BOTH versions in one paired judge pass rather than comparing stored numbers across passes.",
   "verdictProvenance":["/data/scratch/bench/native_run/<ds>.jsonl (GT per-unit verdicts)","/data/scratch/bench/nogt_run/*.json (no-GT readouts + consistency)"],
   "scoresArePrecise":True,
 },
 "verification":{
   "benchmark":"967-unit native-schema benchmark (each dataset's own finest native cell groups), size-stratified ≥100/≥30/all, LLM semantic judge.",
   "gt":[gt_block(ds) for ds in ["zscape","chemfish","daniocell"]],
   "noGt":[nogt_block(ds) for ds in ["megafin","megafin_parse","minifin"]],
   "provenance":{"runs":prov,"totalCostUsd":round(total,2)},
 },
}
REG=os.path.join(DK,"harness_registry.json")
existing=json.load(open(REG)) if os.path.exists(REG) else {"active":None,"harnesses":[]}
existing["harnesses"]=[h for h in existing["harnesses"] if h["id"]!=entry["id"]]
existing["harnesses"].insert(0,entry); existing["active"]=entry["id"]
json.dump(existing,open(REG,"w"),indent=1)
print("wrote",REG)
print(f"  harness {entry['id']} '{entry['name']}' stamped {entry['stampedAt']} commit {entry['gitCommit']}")
print(f"  config hashes: {[c['sha256_16'] for c in CONFIG]}")
print(f"  GT (precise): {[ (g['dataset'], [t['pct'] for t in g['tiers']]) for g in entry['verification']['gt'] ]}")
print(f"  scoreChannel.deterministic={entry['scoreChannel']['deterministic']} | provenance {len(prov)} runs ${entry['verification']['provenance']['totalCostUsd']}")
