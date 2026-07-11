#!/data/.venv/bin/python
"""Phase 4 — score Arm B vs Arm C on MiniFin against Patrick's expert GT.

Patrick hand-labelled 86.7% of MiniFin cells (27 sets); collapsed to a cluster-level
answer key (daniotype_data/minifin/patrick_cluster_gt.json). We reuse the PRODUCTION
arm flow (minifin_menu_exposed_harness.run_leaf) so the eval tests exactly what ships:

  Arm B: menu-exposed reasoner (packet off).
  Arm C: + ontology evidence packet (packet on).

Both produce a cell_type_broad (zlabel panel) via the ZFA menu bind. We crosswalk that
AND Patrick's label to a coarse LINEAGE group (the granularity both can reach and where
the treatment should help), then score exact-lineage match, paired per cluster (McNemar).

GOVERNANCE: Patrick's labels are EVALUATION ONLY — they never feed the packet/menu
(the packet is GT-blind, grounded in ZFIN/literature). Eval only; saves no viewer run.
"""
import os, sys, json, collections, random
sys.path.insert(0, "/data/zeroshotbio-landingpage/scripts")
import minifin_menu_exposed_harness as H
import app  # noqa: E402  (imported via H's sys.path)

GT = json.load(open("/data/zeroshotbio-landingpage/daniotype_data/minifin/patrick_cluster_gt.json"))
CLUSTERS = {str(c["id"]): c for c in H.CLUSTERS}
MIN_PURITY = float(os.environ.get("EVAL_MIN_PURITY", "0.5"))
MIN_N = int(os.environ.get("EVAL_MIN_N", "20"))
EVAL_ALL = os.environ.get("EVAL_ALL") == "1"
N = int(os.environ.get("EVAL_N", "10"))
SEED = int(os.environ.get("EVAL_SEED", "11"))

# ---- crosswalk to coarse LINEAGE groups -----------------------------------
def _norm(s):
    return (s or "").strip()

PATRICK_COARSE = {
    "CNS": "neural", "Midbrain (Optic Tectum)": "neural", "MHB": "neural",
    "Forebrain (Telencephalon)": "neural", "Spinal Cord": "neural", "Floor Plate": "neural",
    "Schwann Cell Precursors": "glia",
    "Muscle": "muscle", "Fast-Twitch Muscle": "muscle", "Slow-Twitch Muscle": "muscle",
    "Possible bipotent myoblast (myhc1+ and myl1+)": "muscle",
    "Cardiomyocytes": "cardiac",
    "Basal Epidermis": "epidermis", "Superficial Epidermis": "epidermis", "Goblet Cells": "epidermis",
    "Melanocytes": "pigment", "Erythrocytes": "blood",
    "Macrophages": "immune", "Neutrophils": "immune",
    "Vascular Endothelial Cells": "endothelium", "Notochord": "notochord",
    "Ionocytes": "ionocyte", "Liver": "liver", "Kidney/Pronephros": "kidney",
    "Lens": "eye", "Anterior Lens Epithelium": "eye", "Lens Fiber Cells": "eye",
}
PANEL_COARSE = {
    "neural": "neural", "glia": "glia", "neural_crest": "neural", "lateral_line": "neural",
    "olfactory": "olfactory", "pineal": "neural", "eye": "eye", "otic": "otic",
    "epidermis": "epidermis", "ionocyte": "ionocyte", "pigment": "pigment",
    "muscle": "muscle", "cardiac": "cardiac", "mural": "endothelium", "endothelium": "endothelium",
    "blood_erythroid": "blood", "immune_myeloid": "immune", "blood_lymphoid": "immune",
    "pronephros": "kidney", "mesenchyme": "mesenchyme", "cartilage": "cartilage", "osteoblast": "bone",
    "notochord": "notochord", "fin": "fin", "endoderm_gut": "gut", "liver": "liver",
    "pancreas": "gut", "intestine": "gut", "germline": "germline", "pituitary": "endocrine",
    "interrenal": "endocrine",
}

def gt_coarse(cid):
    return PATRICK_COARSE.get(_norm(GT[cid]["label"]))

def pred_coarse(binding):
    b = (binding.get("cell_type_broad") or "").strip().lower().replace(" ", "_")
    # binding may echo the panel name verbatim, or a close variant; match on the panel token
    for panel, coarse in PANEL_COARSE.items():
        if panel in b:
            return coarse
    return None

# ---- pick clusters --------------------------------------------------------
usable = [cid for cid in CLUSTERS if cid in GT and GT[cid]["n"] >= MIN_N and GT[cid]["purity"] >= MIN_PURITY
          and gt_coarse(cid) is not None]
if EVAL_ALL:
    SAMPLE = sorted(usable, key=lambda x: int(x))
else:
    # diverse: one highest-purity representative per coarse group, then fill by purity
    by_group = collections.defaultdict(list)
    for cid in usable:
        by_group[gt_coarse(cid)].append(cid)
    reps = [max(v, key=lambda c: GT[c]["purity"]) for v in by_group.values()]
    rest = [c for c in usable if c not in reps]
    random.Random(SEED).shuffle(rest)
    SAMPLE = sorted((reps + rest)[:N], key=lambda x: int(x))
print(f"[plan] usable GT clusters={len(usable)} | evaluating {len(SAMPLE)}: {SAMPLE}")
print(f"[groups] { {gt_coarse(c): GT[c]['label'] for c in SAMPLE} }")

if not os.environ.get("AUTOPILOT_API_TOKEN"):
    print("[FATAL] source service env first"); sys.exit(2)

# ---- run both arms, paired, score coarse lineage --------------------------
usage = {}
rows = []
win = {"B": 0, "C": 0, "both": 0, "neither": 0}
hits = {"B": 0, "C": 0}
for i, cid in enumerate(SAMPLE):
    cl = H._cl_of(CLUSTERS[cid]); g = gt_coarse(cid)
    r = {}
    for arm, packet in (("B", False), ("C", True)):
        dn, _c, binding, _t = H.run_leaf(cl, packet, usage)
        pc = pred_coarse(binding)
        r[arm] = {"denovo": dn, "broad": binding.get("cell_type_broad"), "coarse": pc, "hit": pc == g}
        if r[arm]["hit"]:
            hits[arm] += 1
    bC, cC = r["B"]["hit"], r["C"]["hit"]
    win["both" if bC and cC else "neither" if not bC and not cC else "B" if bC else "C"] += 1
    rows.append({"cid": cid, "gt": GT[cid]["label"], "gt_coarse": g, "B": r["B"], "C": r["C"]})
    cum = app._est_cost(usage)[0]
    print(f"[{i+1}/{len(SAMPLE)}] c{cid} GT={g}({GT[cid]['label']}) | B={r['B']['coarse']}{'✓' if bC else '✗'} | C={r['C']['coarse']}{'✓' if cC else '✗'} | ${cum:.2f}", flush=True)

n = len(rows)
print(f"\n=== MiniFin × Patrick GT — coarse LINEAGE accuracy (N={n}, paired) ===")
print(f"  Arm B (no packet): {hits['B']}/{n} = {100*hits['B']/n:.0f}%")
print(f"  Arm C (packet):    {hits['C']}/{n} = {100*hits['C']/n:.0f}%")
print(f"  paired: both✓ {win['both']} | C-only✓ {win['C']} | B-only✓ {win['B']} | neither {win['neither']}")
print(f"  McNemar discordant: C-wins {win['C']} vs B-wins {win['B']}  (need more N for significance)")
out = f"/tmp/minifin_patrick_eval.json"
json.dump({"n": n, "hits": hits, "win": win, "rows": rows, "usd": app._est_cost(usage)[0]}, open(out, "w"), indent=1)
print(f"[saved] {out} | spend ${app._est_cost(usage)[0]:.2f}")
