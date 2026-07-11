#!/data/.venv/bin/python
"""Phase 4 — scored A/B eval of the ontology packet on GT datasets.

For each sampled leaf of a ground-truth dataset (daniocell/chemfish/zscape_native),
run BOTH arms on the SAME leaf (paired) and bind to the dataset's PUBLISHED menu, then
score each tier against ground truth:

  Arm B (control): Researcher -> Reasoner de-novo -> published-menu bind.
  Arm C (treatment): + ontology evidence packet injected into research + de-novo
    reasoning, + bounded Archivist dispatch loop.

Scoped run first (small N) to validate the pipeline, then scale. Prints a per-tier
scorecard and a paired per-leaf table. Does not save a viewer run (eval only).
"""
import os, sys, re, json, random, collections
APP_DIR = "/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"
sys.path.insert(0, APP_DIR)
import app

DATASET = os.environ.get("EVAL_DATASET", "daniocell")
MODEL   = os.environ.get("EVAL_MODEL", "gpt-5.4")
SEED    = int(os.environ.get("EVAL_SEED", "7"))
N       = int(os.environ.get("EVAL_N", "6"))
ABORT   = float(os.environ.get("EVAL_ABORT_USD", "8.0"))
DDIR    = f"/data/zeroshotbio-landingpage/daniotype_data/{DATASET}"
TIERS   = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
if not os.environ.get("AUTOPILOT_API_TOKEN"):
    print("[FATAL] source service env first"); sys.exit(2)
BASE = app.DEFAULT_BASE

ATLAS = json.load(open(f"{DDIR}/umap.json"))
GT = json.load(open(f"{DDIR}/groundtruth.json"))["clusters"]
PACKETS = {str(p["id"]): p for p in json.load(open(f"{DDIR}/ontology_packets.json"))["packets"]}
CLUSTERS = {str(c["id"]): c for c in ATLAS["clusters"]}
# published menu = distinct GT labels per tier
MENU = {t: sorted({(g.get(t) or {}).get("label") for g in GT.values() if (g.get(t) or {}).get("label")}) for t in TIERS}
print(f"[init] {DATASET} | {len(GT)} GT clusters | menu sizes { {t: len(MENU[t]) for t in TIERS} }")

gt_ids = [cid for cid in CLUSTERS if cid in GT]
SAMPLE = sorted(random.Random(SEED).sample(gt_ids, min(N, len(gt_ids))), key=lambda x: int(x) if x.isdigit() else 1e9)
print(f"[plan] N={len(SAMPLE)} seed={SEED} arms=[B,C] sample={SAMPLE}")

DENOVO_PROMPT = (
    "You have the Researcher's read above. Trust the precomputed differential markers. Your DEFAULT action is "
    "to CONCLUDE with a kasperov-conclude block (identity + 4-tier germ/tissue/broad/sub stack), abstaining at "
    "the deepest defensible tier if you cannot ground a specific type. Only dispatch (kasperov-dispatch) if a "
    "single specific Archivist query would actually change the call.")

def up_down(c):
    up = list(c.get("degsUp") or [])[:8]
    down = list(c.get("markersDown") or [])[:6]
    return [g for g in up if g], [g for g in down if g]

def researcher_prompt(c, packet):
    up, down = up_down(c); up_s = ", ".join(up); down_s = ", ".join(down) or "(none)"
    focus = ""
    if packet:
        probes = []
        for d in (PACKETS.get(str(c["id"])) or {}).get("discriminators", [])[:2]:
            probes += d.get("absent_probe", [])[:4]
        if probes:
            focus = f" ALSO research these ontology-flagged DISCRIMINATING markers: {', '.join(dict.fromkeys(probes))}."
    return (f"Cluster {c['id']}'s top UP markers: {up_s}. Depleted (DOWN) markers: {down_s}. For EACH marker return "
            f"cited evidence from ZFIN in-vivo expression, the ZFA term (ontology_lookup), and GO.{focus} "
            "Evidence only — no identity call.")

def packet_brief(cid):
    p = PACKETS.get(str(cid))
    if not p: return ""
    call, conf = p["call"], p["confidence"]
    L = ["=== ONTOLOGY EVIDENCE PACKET (deterministic zlabel/ZFA — a PRIOR, NOT a verdict) ==="]
    L.append("- Grounded call: ABSTAINED (ood=%s); decide from markers." % call["ood"] if call["abstained"]
             else f"- Grounded call: {call['bucket']} → {call['zfa_name']} (earned depth {call['depth']}, {call['ood']}); confidence {conf['tier']} ({conf['score']}).")
    if p["candidates"]:
        L.append("- Top candidate lineages (Δ behind leader): " + ", ".join(f"{c['bucket']} (Δ{c['margin_to_top']})" for c in p["candidates"][:3]))
    for d in p["discriminators"][:2]:
        L.append(f"- Discriminators for {d['bucket']}: PRESENT [{', '.join(d['present_specific'][:5]) or '—'}]; ABSENT probe [{', '.join(d['absent_probe'][:5]) or '—'}]")
    if p["expression_evidence"]:
        L.append("- ZFIN grounding: " + "; ".join(f"{e['symbol']}→{e['name']}" for e in p["expression_evidence"][:5]))
    L.append("USE THIS: adjudicate top candidates via the discriminators (probe ABSENT targets if it would change the call); "
             "conclude at the deepest supported tier. You MAY OVERTURN the grounded call if a discriminator contradicts it.")
    return "\n".join(L) + "\n\n"

def menu_prompt(denovo):
    blocks = "\n".join(f"{t}: [ {' | '.join(MENU[t])} ]" for t in TIERS)
    return (f'=== MENU-EXPOSED PHASE — {denovo} ===\nYour DE-NOVO call is LOCKED: "{denovo}". Do NOT revise it.\n\n'
            f'Below is the published {DATASET.upper()} label MENU — the ONLY labels ground truth uses at each tier:\n{blocks}\n\n'
            'Fit your de-novo call to the SINGLE closest existing menu option at EACH tier. Declare under a '
            '"**Menu-aware binning**" heading as four lines — "- <tier>: <menu option> (<confidence>%)". '
            'Pick ONLY from the menu. Then end with "### ✅ CLUSTER COMPLETE".')

def parse_binding(text):
    out = {}
    for t in TIERS:
        m = re.search(rf"{t}\s*[:\-]\s*(.+?)\s*(?:\(\d+%?\)|$)", text, re.I | re.M)
        out[t] = m.group(1).strip().strip("*` ") if m else None
    return out

def denovo_label(rc):
    c = app.parse_conclude(rc) or {}
    return c.get("identity") or "(unresolved)"

def run_arm(c, packet, usage):
    cl = {"id": c["id"], "label": c.get("label", f"Cluster {c['id']}"), "degsUp": c.get("degsUp", []),
          "markers": c.get("markers", []), "nCells": c.get("nCells")}
    rp = researcher_prompt(cl, packet)
    conv = [{"role": "user", "content": rp},
            {"role": "assistant", "content": app._agent(BASE, DATASET, MODEL, cl, [{"role": "user", "content": rp}], "research", usage)}]
    du = (packet_brief(cl["id"]) if packet else "") + DENOVO_PROMPT
    conv.append({"role": "user", "content": du})
    rd = app._agent(BASE, DATASET, MODEL, cl, conv, "reason", usage); conv.append({"role": "assistant", "content": rd})
    MODE = {"archivist": "archivist", "researcher": "research", "research": "research", "reason": "reason"}
    for _ in range(2):
        if app.parse_conclude(rd): break
        disp = app.parse_dispatch(rd)
        if not disp: break
        for d in disp[:2]:
            ans = app._agent(BASE, DATASET, MODEL, cl, conv + [{"role": "user", "content": d["prompt"]}], MODE.get(d.get("to"), "archivist"), usage)
            conv += [{"role": "user", "content": d["prompt"]}, {"role": "assistant", "content": ans}]
        conv.append({"role": "user", "content": "CONCLUDE now with a kasperov-conclude block; do not dispatch again."})
        rd = app._agent(BASE, DATASET, MODEL, cl, conv, "reason", usage); conv.append({"role": "assistant", "content": rd})
    dn = denovo_label(rd)
    rm = app._agent(BASE, DATASET, MODEL, cl, conv + [{"role": "user", "content": menu_prompt(dn)}], "reason", usage)
    return {"denovo": dn, "binding": parse_binding(rm)}

usage = {}
rows = []
score = {arm: {t: 0 for t in TIERS} for arm in ("B", "C")}
for i, cid in enumerate(SAMPLE):
    c = CLUSTERS[cid]; g = GT[cid]
    gtv = {t: (g.get(t) or {}).get("label") for t in TIERS}
    res = {}
    for arm, packet in (("B", False), ("C", True)):
        r = run_arm(c, packet, usage)
        for t in TIERS:
            if r["binding"].get(t) and r["binding"][t] == gtv[t]:
                score[arm][t] += 1
        res[arm] = r
    rows.append({"cid": cid, "gt": gtv, "B": res["B"], "C": res["C"]})
    cum = app._est_cost(usage)[0]
    bh = sum(1 for t in TIERS if res["B"]["binding"].get(t) == gtv[t]); ch = sum(1 for t in TIERS if res["C"]["binding"].get(t) == gtv[t])
    print(f"[{i+1}/{len(SAMPLE)}] {cid} GTsub={gtv['cell_type_sub']!r} | B {bh}/4 ({res['B']['denovo'][:24]!r}) | C {ch}/4 ({res['C']['denovo'][:24]!r}) | ${cum:.2f}", flush=True)
    if cum >= ABORT: print("[ABORT]"); break

n = len(rows)
print(f"\n=== SCORECARD  {DATASET}  N={n}  (exact tier match vs GT) ===")
print(f"{'tier':18} {'Arm B':>8} {'Arm C':>8}")
for t in TIERS:
    print(f"{t:18} {score['B'][t]:>4}/{n:<3} {score['C'][t]:>4}/{n:<3}")
for arm in ("B", "C"):
    tot = sum(score[arm].values())
    print(f"  Arm {arm} total tier-hits: {tot}/{n*4}")
out = f"/tmp/ab_eval_{DATASET}.json"
json.dump({"dataset": DATASET, "n": n, "seed": SEED, "score": score, "rows": rows, "usd": app._est_cost(usage)[0]}, open(out, "w"), indent=1)
print(f"[saved] {out} | spend ${app._est_cost(usage)[0]:.2f}")
