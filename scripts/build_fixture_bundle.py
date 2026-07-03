#!/usr/bin/env python3
"""Bundle the frozen fixture into ONE run object for the 5-step RunViewer:
leaf chat transcripts (step 3) + operatorProposal (step 4) + scoredNodes (step 5).
Read-only over the fixture; persists a NEW derived run to EBS (does not touch the
original). No LLM calls.
"""
import json, glob, os, urllib.request, time

REPLAY = json.load(open("/data/zeroshotbio-landingpage/daniotype_data/meta_reasoner_replay/full_250.json"))
OPDIR = sorted(glob.glob("/data/scratch/kasperov_operator_consolidate_*"), key=os.path.getmtime)[-1]
PROP = json.load(open(os.path.join(OPDIR, "operator_proposal.json")))
SCORED = json.load(open(os.path.join(OPDIR, "scored_nodes.json")))
WORKER = "http://127.0.0.1:5008"
TOKEN = os.environ.get("AUTOPILOT_API_TOKEN", "")

# leaf.steps -> RunViewer transcript [{role,content,mode,thinking}]
def transcript(leaf):
    out = []
    for s in leaf.get("steps", []):
        if s.get("request"): out.append({"role": "user", "content": s["request"]})
        out.append({"role": "assistant", "content": s.get("response", ""), "mode": s.get("mode", "reason"), "thinking": s.get("thinking", "")})
    return out

clusters = [{
    "id": l["id"], "label": l["label"], "finalLabel": l["finalLabel"], "validated": True,
    "transcript": transcript(l),
} for l in REPLAY["leaves"]]

run = {
    "schema": "daniotype_kasperov_run/v1",
    "datasetId": "zscape_recursive", "dataset": "zscape_recursive", "model": REPLAY.get("model", "gpt-5.4"),
    "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "note": f"5-step fixture bundle — {len(clusters)} fine leaves → {SCORED['n_nodes']} merged nodes (operator proposal + fuzzy-judge scores)",
    "source": "meta_reasoner_fixture_bundle", "fixtureRunId": PROP["fixture_runId"],
    "operatorProposal": PROP, "scoredNodes": SCORED,
    "clusters": clusters,
}
os.makedirs("/data/scratch/fixture_bundle", exist_ok=True)
json.dump(run, open("/data/scratch/fixture_bundle/run.json", "w"))
print(f"built bundle: {len(clusters)} clusters w/ transcripts | operatorProposal {len(PROP['compartments'])} comps | scoredNodes {SCORED['n_nodes']}")

req = urllib.request.Request(f"{WORKER}/runs", data=json.dumps(run).encode(), method="POST",
      headers={"content-type": "application/json", "x-api-token": TOKEN})
rid = json.loads(urllib.request.urlopen(req, timeout=60).read().decode()).get("runId")
print(f"[ebs] persisted runId={rid} (dataset zscape_recursive)")
json.dump({"runId": rid}, open("/data/scratch/fixture_bundle/_ebs.json", "w"))
