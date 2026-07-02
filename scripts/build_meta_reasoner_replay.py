#!/usr/bin/env python3
"""Convert a headless kasperov provenance run (run.json + events.jsonl) into a
single replay asset for the /meta_reasoner page.

The replay page steps through each leaf's recorded chat steps (Researcher +
Reasoner + menu-binning) and pauses at each compartment boundary. It never calls
an LLM — it replays exactly what happened, with a judgement note box at each step.

Source : /data/scratch/kasperov_prov_run_TRIMMED/{run.json,events.jsonl}
Output : daniotype_data/meta_reasoner_replay/trimmed_37.json
         (nginx-served at https://zscape.zeroshot.bio/daniotype_data/...)
"""
import json, os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "/data/scratch/kasperov_prov_run_TRIMMED"
OUT = sys.argv[2] if len(sys.argv) > 2 else (
    os.path.join(os.path.dirname(__file__), "..", "daniotype_data",
                 "meta_reasoner_replay", "trimmed_37.json"))

run = json.load(open(os.path.join(SRC, "run.json")))

# index events by (leaf, step) — events.jsonl carries the actual chat content
events = {}
with open(os.path.join(SRC, "events.jsonl")) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        e = json.loads(line)
        events[(str(e.get("leaf")), e.get("step"))] = e

# canonical step order per leaf (matches the recorded 3-call loop)
STEP_ORDER = ["research#1", "reason#r0", "reason#binning"]
STEP_TITLE = {
    "research#1":     "Researcher · evidence",
    "reason#r0":      "Reasoner · de-novo conclusion",
    "reason#binning": "Reasoner · menu-exposed binning",
}

def mode_of(step):
    return "research" if step.startswith("research") else "reason"

leaves_out = []
for L in run["leaves"]:
    lid = str(L["id"])
    steps_out = []
    for step_name in STEP_ORDER:
        ev = events.get((lid, step_name))
        if not ev:
            continue
        steps_out.append({
            "step":       step_name,
            "title":      STEP_TITLE.get(step_name, step_name),
            "mode":       mode_of(step_name),
            # menu-exposed pass deliberately shows the published GT menu AFTER the
            # de-novo call is locked — flag it so the judge never confuses it with
            # the blind identity reasoning.
            "menuExposed": step_name == "reason#binning",
            "request":    ev.get("request_last_user") or "",
            "response":   ev.get("response") or "",
            "thinking":   ev.get("thinking") or "",
            "statuses":   ev.get("statuses") or [],
            "elapsed_s":  ev.get("elapsed_s"),
            "usage":      ev.get("usage") or {},
            "cost_usd":   ev.get("cost_usd", ev.get("cost")),
        })
    leaves_out.append({
        "id":               lid,
        "label":            L.get("label") or f"Cluster {lid}",
        "compartmentIndex": L.get("compartmentIndex"),
        "nCells":           L.get("nCells"),
        "finalLabel":       L.get("final_label"),
        "concluded":        L.get("concluded"),
        "did_archivist":    L.get("did_archivist"),
        "n_reason_rounds":  L.get("n_reason_rounds"),
        "cost_usd":         L.get("cost_usd"),
        "elapsed_s":        L.get("elapsed_s"),
        "steps":            steps_out,
    })

# compartment roster (ordered, 1-based) — leaf ids in sweep order
comps = {}
for L in leaves_out:
    ci = L["compartmentIndex"]
    comps.setdefault(ci, []).append(L["id"])
compartments = [
    {"index": ci, "label": f"Compartment {ci}", "leafIds": comps[ci]}
    for ci in sorted(comps)
]

asset = {
    "schema":       "daniotype_kasperov_meta_reasoner_replay/v1",
    "source":       "kasperov_prov_run_TRIMMED",
    "dataset":      run.get("dataset"),
    "datasetId":    run.get("dataset"),
    "model":        run.get("model"),
    "started":      run.get("started"),
    "finished":     run.get("finished"),
    "calls":        run.get("calls"),
    "cost_usd":     run.get("cost_usd"),
    "by_mode":      run.get("by_mode"),
    "compartments": compartments,
    "boundaries":   run.get("boundaries") or [],
    # recorded Phase-2 meta-reasoner decisions (reasoning + structured decision +
    # guardrail state), keyed by the boundary's just-finished compartmentIndex.
    # Empty for Phase-1-only runs (no brain).
    "metaDecisions": run.get("metaDecisions") or [],
    "leaves":       leaves_out,
}

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(asset, f, separators=(",", ":"))

# --- report ---
n_leaves = len(leaves_out)
n_steps = sum(len(l["steps"]) for l in leaves_out)
missing = [(l["id"], s) for l in leaves_out for s in STEP_ORDER
           if s not in {st["step"] for st in l["steps"]}]
print(f"wrote {os.path.abspath(OUT)}")
print(f"  size: {os.path.getsize(OUT)/1024:.0f} KB")
print(f"  leaves: {n_leaves} | steps: {n_steps} | boundaries: {len(asset['boundaries'])}")
print(f"  compartments: {[(c['index'], len(c['leafIds'])) for c in compartments]}")
if missing:
    print(f"  WARNING missing steps: {missing}")
else:
    print("  every leaf has all 3 steps ✓")
