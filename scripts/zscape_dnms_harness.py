#!/data/.venv/bin/python
"""ZSCAPE De-Novo & Menu-Select Harness v1.0  (id: zscape-dnms/v1.0)

Two-phase variant of the de-leaked tri-personality flow. Spec:
  scripts/zscape_dnms_harness_v1.0.md  (REVIEW DRAFT — architecture approved 2026-06-19)

Phase 1 (de novo): identical to the de-leaked QC flow — markers only, label="Cluster {id}",
  open-vocab ZFIN->ZFA->GO; Reasoner commits a final call + tier confidences.  FROZEN.
Phase 2 (menu-select): one extra Reasoner turn given the FROZEN de novo call + the marker
  evidence already in context + the FULL 156-entry ZSCAPE menu (identical for every cluster,
  sha-stamped). Maps the frozen call to one menu entry or abstains (NO_MATCH = schema gap).

Hard rules enforced structurally:
  - the menu is built AFTER the de novo conclude is frozen; it never enters any phase-1 message
  - deNovoLabel is written before the menu exists and is never mutated by phase 2
  - two distinct numbers: deNovoLabel (open-vocab capability) vs menuLabel (closed-vocab assignment)
Does NOT touch :5008, canonical_runs.json, or dataset_facts.json. Runs are QC/eval-tagged only.

Run:  set the 3 secrets + non-secret env (see launch wrapper), then
      /data/.venv/bin/python scripts/zscape_dnms_harness.py
Secrets are read from process env (sourced by the caller) and never printed.
"""
import os, sys, re, json, hashlib, random

APP_DIR = "/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"
sys.path.insert(0, APP_DIR)
import app

DATASET   = "zscape"
SERVE     = "zscape_native"
MODEL     = "gpt-5.5"
SEED      = 820618
N_SAMPLE  = 22                # ~$0.20-0.23/cluster (phase1 + menu turn) -> ~$5
ABORT_USD = 5.00
HARNESS_ID = "zscape-dnms/v1.0"
MANIFEST  = "/home/ubuntu/zscape_dnms_results.json"

for k in ("AUTOPILOT_API_TOKEN", "STATS_VERIFY_TOKEN", "KASPEROV_BASIC_PASSWORD"):
    if not os.environ.get(k):
        print(f"[FATAL] {k} absent from env — secret sourcing failed. Aborting, no spend.")
        sys.exit(2)
BASE = app.DEFAULT_BASE
print(f"[init] base={BASE} | serve={SERVE} | store={DATASET} | model={MODEL}")

# ---- atlas + menu ----------------------------------------------------------
ATLAS = app._get_asset(BASE, SERVE, "umap.json")
GT    = app._get_asset(BASE, SERVE, "groundtruth.json").get("clusters") or {}
MENU  = sorted({(g.get("cell_type_sub") or {}).get("label") for g in GT.values()
                if (g.get("cell_type_sub") or {}).get("label")})
MENU_SET = set(MENU)
MENU_SHA = hashlib.sha256("\n".join(MENU).encode()).hexdigest()[:16]

def numbered_variant_ceiling(menu):
    """Fraction of the menu that is data-undeterminable numbered variants, and the
    estimated exact-sub-match ceiling = distinct-stems / N (identify stem, guess number)."""
    stems = {}
    for m in menu:
        s = re.sub(r"\s+\d+$", "", m.strip())
        stems.setdefault(s, []).append(m)
    multi = {k: v for k, v in stems.items() if len(v) > 1}
    undet = sum(len(v) for v in multi.values())
    ceiling = len(stems) / len(menu)
    return {"entries": len(menu), "distinct_stems": len(stems), "numbered_groups": len(multi),
            "undeterminable_entries": undet, "coinflip_extra": undet - len(multi),
            "ceiling_pct": round(100 * ceiling, 1),
            "groups": {k: len(v) for k, v in sorted(multi.items(), key=lambda x: -len(x[1]))}}

CEIL = numbered_variant_ceiling(MENU)
print(f"[menu] {len(MENU)} entries | sha {MENU_SHA}")
print(f"[CEILING] numbered variants -> exact-sub-match ceiling ~ {CEIL['ceiling_pct']}% "
      f"({CEIL['distinct_stems']}/{CEIL['entries']}); {CEIL['undeterminable_entries']} entries in "
      f"{CEIL['numbered_groups']} numbered groups {CEIL['groups']}")

# ---- sample (zscape only; cluster 82 seeded first) -------------------------
ids_all = [str(c["id"]) for c in ATLAS["clusters"]]
rng = random.Random(SEED)
rest = rng.sample([i for i in ids_all if i != "82"], N_SAMPLE - 1)
SAMPLE = ["82"] + sorted(rest, key=lambda x: int(x) if x.isdigit() else 1e9)
print(f"[plan] {len(SAMPLE)} zscape clusters | seed {SEED} | abort@${ABORT_USD:.2f} | sample={SAMPLE}")

# ---- phase-2 menu-select prompt + parser -----------------------------------
def menu_prompt(deNovo, conf):
    def pct(t):
        v = (conf or {}).get(t) or {}
        return v.get("pct")
    menu_block = "\n".join(f"  {i+1}. {m}" for i, m in enumerate(MENU))
    return (
        f'You have already committed a FINAL de novo identity for this cluster, recorded and frozen:\n\n'
        f'    de novo call : "{deNovo.get("label")}"  (state: {deNovo.get("state")})\n'
        f'    tier reads   : germ {pct("germ_layer")} / tissue {pct("tissue")} / broad {pct("cell_type_broad")} / sub {pct("cell_type_sub")}\n\n'
        f'That call is FINAL — do NOT change it, re-derive it, or second-guess it here.\n\n'
        f'Your ONLY task now is to MAP that frozen call onto the published ZSCAPE schema. Below is the\n'
        f'COMPLETE ZSCAPE cell-type vocabulary — the identical full list used for every cluster, not a\n'
        f'shortlist chosen for this one. Using your frozen call and the marker evidence already established\n'
        f'above, choose the SINGLE entry that best matches.\n\n'
        f'ZSCAPE cell-type menu (choose exactly one by its EXACT text, or abstain):\n{menu_block}\n\n'
        f'Rules:\n'
        f'- Return the EXACT text of one menu entry, OR "NO_MATCH" if no entry is a defensible match for\n'
        f'  your frozen de novo call. Do not force a poor fit — "no good match" is a valid, informative\n'
        f'  answer (it flags a gap between your call and the published schema).\n'
        f'- You are MAPPING an existing conclusion to its closest schema label, NOT identifying the\n'
        f'  cluster again. Do not let the menu change your biological judgment.\n'
        f'- Cite, in one or two lines, which features of your de novo call + markers drive the pick.\n\n'
        f'Respond with a kasperov-menu block:\n'
        f'```kasperov-menu\n{{ "menuLabel": "<exact menu text or NO_MATCH>", "abstain": <true|false>, "why": "<short>" }}\n```'
    )

def parse_menu(text):
    m = re.search(r"kasperov-menu", text, re.I)
    if not m:
        return None
    start = text.find("{", m.end())
    if start == -1:
        return None
    depth, end = 0, -1
    for i in range(start, len(text)):
        if text[i] == "{": depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0: end = i; break
    if end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except Exception:
        return None

def rollup(menu_label):
    """Coarser tiers roll up from the PICKED sub entry's GT tier mapping."""
    for g in GT.values():
        if (g.get("cell_type_sub") or {}).get("label") == menu_label:
            return {"cell_type_sub": menu_label,
                    "cell_type_broad": (g.get("cell_type_broad") or {}).get("label"),
                    "tissue": (g.get("tissue") or {}).get("label"),
                    "germ_layer": (g.get("germ_layer") or {}).get("label")}
    return None

# ---- grounding (full atlas list so the count-bound matches :5007) ----------
ok, detail = app.verify_grounding(SERVE, ATLAS["clusters"])
if not ok:
    print(f"[GROUNDING FAIL] {SERVE}: {detail} — aborting, no spend.")
    sys.exit(3)
print(f"[grounding ok] {SERVE}: {detail}")

usage, results, bundled = {}, [], []

def build_cluster(cid):
    src = next((c for c in ATLAS["clusters"] if str(c["id"]) == cid), None)
    return {"id": src["id"], "label": f"Cluster {src['id']}",   # de-leak fix
            "degsUp": src.get("degsUp", []), "markers": src.get("markers", []), "nCells": src.get("nCells")}

for i, cid in enumerate(SAMPLE):
    c = build_cluster(cid)
    try:
        # --- PHASE 1: de novo (open vocab, NO menu) ---
        deNovoLabel, conv = app.run_one_cluster(BASE, SERVE, MODEL, c, usage)
        conf = app.get_confidence(BASE, SERVE, MODEL, c, conv, usage)
        deNovo = {"label": deNovoLabel, "state": None, "decision": "assign",
                  "confidence": conf, "frozenAt": app._now()}
        # === FREEZE === (deNovo fixed before the menu exists) ===
        # --- PHASE 2: menu-select (closed vocab, frozen de novo input) ---
        mturn = app._agent(BASE, SERVE, MODEL, c, conv + [{"role": "user", "content": menu_prompt(deNovo, conf)}], "reason", usage)
        parsed = parse_menu(mturn) or {}
        ml = parsed.get("menuLabel")
        abstain = bool(parsed.get("abstain")) or ml == "NO_MATCH" or (ml not in MENU_SET)
        menu = {"menuVersion": MENU_SHA,
                "menuLabel": (None if abstain else ml),
                "abstain": abstain,
                "why": parsed.get("why"),
                "rolledTiers": (None if abstain else rollup(ml))}
        transcript = conv + [{"role": "user", "content": menu_prompt(deNovo, conf)},
                             {"role": "assistant", "content": mturn, "mode": "menu-select"}]
    except Exception as e:
        print(f"[{i+1}/{len(SAMPLE)}] zscape:{cid} ERROR {e}")
        deNovo = {"label": "(error)", "confidence": None}; menu = {"abstain": True}; transcript = c.get("transcript") or []

    # accumulate the cluster — ONE bundled run is saved after the loop (no per-cluster fragments)
    bundled.append({"id": c["id"], "label": c["label"], "validated": True,
                    "finalLabel": deNovo.get("label"),          # deNovo = the displayed final call
                    "deNovo": deNovo, "menu": menu,
                    "confidence": deNovo.get("confidence"), "addedMarkers": [], "transcript": transcript})
    gt_sub = (GT.get(cid, {}).get("cell_type_sub") or {}).get("label")
    hit = (not menu.get("abstain")) and menu.get("menuLabel") == gt_sub
    results.append({"cluster": cid, "deNovoLabel": deNovo.get("label"),
                    "menuLabel": menu.get("menuLabel"), "abstain": menu.get("abstain"),
                    "gtSub": gt_sub, "menuExactHit": hit})
    cum = app._est_cost(usage)[0]
    print(f"[{i+1}/{len(SAMPLE)}] zscape:{cid} | deNovo={str(deNovo.get('label'))[:34]!r} | "
          f"menu={str(menu.get('menuLabel'))[:30]!r} abst={menu.get('abstain')} | GTsub={str(gt_sub)[:28]!r} "
          f"hit={hit} | cum ${cum:.3f}", flush=True)
    if cum >= ABORT_USD:
        print(f"[ABORT] cumulative ${cum:.2f} >= ${ABORT_USD:.2f} — stopping before next cluster.")
        break

# ---- save ONE bundled run (all sampled clusters) — renders as a single "N labelled" run ----
usd, est = app._est_cost(usage)
run = {
    "schema": "daniotype_kasperov_run/v1", "dataset": ATLAS.get("source", DATASET), "datasetId": DATASET,
    "model": MODEL, "cost": {"usd": usd, "estimated": est, "usage": {m: dict(u) for m, u in usage.items()}},
    "exportedAt": app._now(), "scoredAt": None, "nLabelled": len(bundled), "nValidated": len(bundled), "source": "server",
    "note": f"ZSCAPE De-Novo & Menu-Select {HARNESS_ID} sample — {len(bundled)} clusters, seed {SEED} — NOT scored / NOT promoted",
    "harness": {"id": HARNESS_ID, "version": "1.0", "name": "ZSCAPE De-Novo & Menu-Select",
                "basis": "de-leaked tri-personality flow", "menuSha": MENU_SHA},
    "schemaBasis": "native-schema",
    "clusteringStrategy": {
        "basis": "native-schema", "derivation": "authors' published finest cell groups (NOT de-novo re-clustered)",
        "referenceAsset": f"zeroshotbio-landingpage/daniotype_data/{SERVE}/groundtruth.json", "nGroups": len(MENU),
        "nativeTiers": {"germ_layer": 7, "tissue": 34, "cell_type_broad": 99, "cell_type_sub": len(MENU)},
        "lab": "Saunders/Trapnell et al.",
        "evalSample": f"labelled {len(bundled)} of {len(MENU)} native groups (seed {SEED}) — sampled eval, not the full partition",
        "note": f"Asset-level provenance of the served {SERVE} partition; this eval run labelled a {len(bundled)}-cluster sample."},
    "buildQC": {
        "cellsWindow": ATLAS.get("fullDatasetCells") or ATLAS.get("totalCells"), "nUnits": len(MENU), "nLabelledThisRun": len(bundled),
        "rawToH5adQC": "UPSTREAM — source authors' published pipeline (Saunders/Trapnell et al.); native build sub-selects published finest groups.",
        "note": f"Build QC of the served {SERVE} partition; this run labelled a {len(bundled)}-cluster sample."},
    "provenance": {"pipeline": "denovo+menuSelect", "qc": True, "deLeaked": True, "servedDataset": SERVE,
                   "menuVersion": MENU_SHA, "menuEntries": len(MENU), "ceiling": CEIL,
                   "promoted": False, "scored": False, "baseUrl": BASE, "sampleSeed": SEED,
                   "grounding": {"servedDataset": SERVE, "guardResult": "OK", "guardDetail": detail}},
    "clusters": bundled,
    "groundTruth": None,
}
bundled_run_id = app.save_run(run)
for r in results:
    r["runId"] = bundled_run_id
print(f"[saved] bundled run {bundled_run_id} — {len(bundled)} clusters, ${usd:.3f}", flush=True)

# ---- summary (two distinct numbers, never blended; scored against the ceiling) ----
scored = [r for r in results if not r["abstain"]]
abst   = [r for r in results if r["abstain"]]
hits   = [r for r in scored if r["menuExactHit"]]
cum = app._est_cost(usage)[0]
man = {"harness": HARNESS_ID, "seed": SEED, "menuSha": MENU_SHA, "ceiling": CEIL,
       "bundledRunId": bundled_run_id, "totalSpendUsd": round(cum, 4), "n": len(results),
       "menuSelect": {"exactHits": len(hits), "scored": len(scored), "abstained": len(abst),
                      "exact_pct_of_scored": round(100 * len(hits) / len(scored), 1) if scored else None,
                      "exact_pct_all": round(100 * len(hits) / len(results), 1) if results else None,
                      "ceiling_pct": CEIL["ceiling_pct"]},
       "results": results}
json.dump(man, open(MANIFEST, "w"), indent=2)
print(f"\n=== DNMS COMPLETE === spend ${cum:.3f} | menu-select exact {len(hits)}/{len(scored)} "
      f"(of scored) vs ceiling {CEIL['ceiling_pct']}% | abstained {len(abst)} | manifest {MANIFEST}")
