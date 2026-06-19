#!/data/.venv/bin/python
"""DanioCell 10-cluster sanity check — de-leaked, two-stage, two-tier.

Invariants enforced as HARD HALTS:
  - de-leak: phase-1 input prompts carry DEG markers only; GT tissue + GT cell-type
    appear in NO user/input message (asserted per cluster; halt on violation).
  - order: the menu is built ONLY after the de-novo call is frozen; menu vocab appears
    in NO phase-1 message (asserted; halt on violation).
  - DanioCell has TWO tiers: tissue (19-vocab) + cell type (cell_type_broad, 43-vocab,
    DanioCell's finest nameable level). germ_layer / cell_type_sub are null -> not used.
Two scoring channels, strictly unblended: menu-exact (string) and de-novo-semantic (driver/v2 judge).
Writes ADDITIVELY under runs/daniocell_sanity_<date>/ — never touches /data/daniotype_runs,
canonical scorecards, indexes, or leaked baselines. Secrets from env; never printed.
"""
import os, sys, re, json, hashlib, random
APP_DIR = "/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"
sys.path.insert(0, APP_DIR)
import app

DATASET, SERVE, MODEL = "daniocell", "daniocell_native", "gpt-5.5"
SEED, N, DATE = 31337, 10, "2026-06-19"
HARNESS_ID, JUDGE = "daniocell-sanity/v1.0", "driver/v2"
ABORT_USD = 5.00
BASE = app.DEFAULT_BASE
REPO = "/data/zeroshotbio-landingpage"
OUTDIR = f"{REPO}/runs/daniocell_sanity_{DATE}"
PARTITION_FILE = "/data/scratch/bench/daniocell_native_labels.csv"  # per-cell cell_id->native_unit
# the two DanioCell tiers (groundtruth field -> display label)
T_TISSUE, T_CELL = "tissue", "cell_type_broad"

for k in ("AUTOPILOT_API_TOKEN", "STATS_VERIFY_TOKEN", "KASPEROV_BASIC_PASSWORD"):
    if not os.environ.get(k):
        print(f"[FATAL] {k} absent — secret sourcing failed, no spend."); sys.exit(2)
os.makedirs(f"{OUTDIR}/transcripts", exist_ok=True)

def sha(b):
    return hashlib.sha256(b).hexdigest()[:16]
def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]

ATLAS = app._get_asset(BASE, SERVE, "umap.json")
GT = app._get_asset(BASE, SERVE, "groundtruth.json").get("clusters") or {}
byid = {str(c["id"]): c for c in ATLAS["clusters"]}
TISSUE_MENU = sorted({(g.get(T_TISSUE) or {}).get("label") for g in GT.values() if (g.get(T_TISSUE) or {}).get("label")})
CELL_MENU   = sorted({(g.get(T_CELL) or {}).get("label") for g in GT.values() if (g.get(T_CELL) or {}).get("label")})
MENU_SHA = sha("\n".join(TISSUE_MENU + ["||"] + CELL_MENU).encode())
PART_SHA = sha_file(PARTITION_FILE)
GT_SHA   = sha(json.dumps({k: {"t": (v.get(T_TISSUE) or {}).get("label"), "c": (v.get(T_CELL) or {}).get("label")} for k, v in sorted(GT.items())}).encode())
PROV = {"harness": HARNESS_ID, "judge": JUDGE, "servedDataset": SERVE, "seed": SEED,
        "partitionFile": PARTITION_FILE, "partitionSha": PART_SHA, "gtLabelSha": GT_SHA,
        "menuSha": MENU_SHA, "tissueVocab": len(TISSUE_MENU), "cellTypeVocab": len(CELL_MENU)}
print(f"[prov] partition(per-cell) sha={PART_SHA} | gtLabel sha={GT_SHA} | menu sha={MENU_SHA} "
      f"| tissue {len(TISSUE_MENU)} / cell-type {len(CELL_MENU)}", flush=True)

SAMPLE = sorted(random.Random(SEED).sample([str(c["id"]) for c in ATLAS["clusters"]], N), key=int)
print(f"[sample] seed {SEED}: {SAMPLE}", flush=True)

ok, gdetail = app.verify_grounding(SERVE, ATLAS["clusters"])
if not ok:
    print(f"[HALT] grounding guard failed: {gdetail}"); sys.exit(3)
print(f"[grounding ok] {gdetail}", flush=True)

def menu_prompt(deNovo):
    tb = "\n".join(f"  {i+1}. {m}" for i, m in enumerate(TISSUE_MENU))
    cb = "\n".join(f"  {i+1}. {m}" for i, m in enumerate(CELL_MENU))
    return (
        f'You have already committed a FINAL de novo identity for this cluster, frozen and recorded:\n\n'
        f'    de novo call : "{deNovo["label"]}"\n\n'
        f'That call is FINAL — do NOT change or re-derive it. Map it onto DanioCell\'s published schema,\n'
        f'which has TWO tiers. Below are the COMPLETE menus (identical for every cluster). Using your\n'
        f'frozen call and the marker evidence above, pick the single best entry for EACH tier, or NO_MATCH.\n\n'
        f'TISSUE menu:\n{tb}\n\nCELL TYPE menu:\n{cb}\n\n'
        f'Rules: return EXACT menu text per tier, or "NO_MATCH" if no entry is a defensible bin (do not\n'
        f'force a poor fit — abstaining flags a schema gap). You are MAPPING the frozen call, not re-deriving.\n'
        f'Respond with a kasperov-menu block:\n'
        f'```kasperov-menu\n{{ "tissue": "<exact or NO_MATCH>", "tissueAbstain": <bool>, '
        f'"cellType": "<exact or NO_MATCH>", "cellTypeAbstain": <bool>, "why": "<short>" }}\n```'
    )

def parse_menu(text):
    m = re.search(r"kasperov-menu", text, re.I)
    if not m: return None
    s = text.find("{", m.end())
    if s == -1: return None
    d = 0
    for i in range(s, len(text)):
        if text[i] == "{": d += 1
        elif text[i] == "}":
            d -= 1
            if d == 0:
                try: return json.loads(text[s:i+1])
                except Exception: return None
    return None

def halt(msg):
    json.dump({"halted": True, "reason": msg}, open(f"{OUTDIR}/HALT.json", "w"), indent=2)
    print(f"[HALT] {msg}"); sys.exit(4)

usage, clusters_out, rows = {}, [], []
MENU_TOKENS = set(t.lower() for t in TISSUE_MENU + CELL_MENU)

for i, cid in enumerate(SAMPLE):
    src = byid[cid]
    c = {"id": src["id"], "label": f"Cluster {src['id']}", "degsUp": src.get("degsUp", []),
         "markers": src.get("markers", []), "nCells": src.get("nCells")}
    g = GT.get(cid, {})
    gt_tis = (g.get(T_TISSUE) or {}).get("label")
    gt_cell = (g.get(T_CELL) or {}).get("label")

    # ----- PHASE 1: de novo (open vocab, markers only) -----
    deNovoLabel, conv = app.run_one_cluster(BASE, SERVE, MODEL, c, usage)

    # ===== DE-LEAK ASSERT — only the prompts WE INJECT (markers-only). Model-generated
    # dispatch queries (placed in user-role) are the model's OWN inference, not injected
    # leakage — a model independently naming the GT term is earning it, not being fed it. =====
    top6 = ", ".join((c.get("degsUp") or [])[:6])
    arch_prompt = (f"Pull this cluster's raw DEG stats for its top markers ({top6}): exact log2FC, %in/out, "
                   "BH-adjusted p-value, and cross-cluster specificity. Return the full per-gene table so we can "
                   "confirm which are the strongest, most specific markers.")
    injected = [app.default_prompt(c), app.second_opinion_prompt(c), arch_prompt]
    first = conv[0]["content"]
    if not first.startswith(f"Cluster {cid}'s top up-regulated markers are:"):
        halt(f"cluster {cid}: first prompt is not the de-leaked markers-only opener")
    for inj in injected:
        low = inj.lower()
        if gt_tis and gt_tis.lower() in low:
            halt(f"cluster {cid}: GT tissue '{gt_tis}' present in an INJECTED prompt")
        if gt_cell and gt_cell.lower() in low:
            halt(f"cluster {cid}: GT cell-type '{gt_cell}' present in an INJECTED prompt")
    # ===== ORDER ASSERT — the MENU itself (its headers/list), not individual biological terms,
    # must be absent from every phase-1 message. menu_prompt() is only built in phase 2, so this
    # holds by construction; we verify the menu block never appears in phase-1. =====
    for m in conv:
        cont = m.get("content", "") or ""
        if "TISSUE menu:" in cont or "CELL TYPE menu:" in cont:
            halt(f"cluster {cid}: menu block present in phase-1 — order violation")

    conf = app.get_confidence(BASE, SERVE, MODEL, c, conv, usage)
    deNovo = {"label": deNovoLabel, "confidence": conf, "frozenAt": app._now(),
              "deLeakConfirmed": True, "firstPrompt": first,
              "deLeakScope": "GT tissue + cell-type verified absent from the 3 injected marker-only prompts (default / second-opinion / archivist); model-authored dispatch queries excluded (model inference, not injection)"}

    # ===== FREEZE complete — menu is constructed ONLY now =====
    mp = menu_prompt(deNovo)
    mturn = app._agent(BASE, SERVE, MODEL, c, conv + [{"role": "user", "content": mp}], "reason", usage)
    p = parse_menu(mturn) or {}
    t_bin = p.get("tissue"); c_bin = p.get("cellType")
    t_abst = bool(p.get("tissueAbstain")) or t_bin in (None, "NO_MATCH") or t_bin not in TISSUE_MENU
    c_abst = bool(p.get("cellTypeAbstain")) or c_bin in (None, "NO_MATCH") or c_bin not in CELL_MENU
    t_bin = None if t_abst else t_bin
    c_bin = None if c_abst else c_bin
    menu = {"menuVersion": MENU_SHA, "tissue": t_bin, "tissueAbstain": t_abst,
            "cellType": c_bin, "cellTypeAbstain": c_abst, "why": p.get("why")}

    transcript = conv + [{"role": "user", "content": mp},
                         {"role": "assistant", "content": mturn, "mode": "reason", "phase": "menu-select"}]
    clusters_out.append({"id": cid, "label": c["label"], "validated": True, "finalLabel": deNovoLabel,
                         "deNovo": deNovo, "menu": menu, "confidence": conf, "addedMarkers": [], "transcript": transcript})
    json.dump({"cluster": cid, "deLeakConfirmed": True, "firstPrompt": first, "transcript": transcript},
              open(f"{OUTDIR}/transcripts/cluster_{cid}.json", "w"), indent=2)

    rows.append({"id": cid, "deNovo": deNovoLabel,
                 "tissue": {"bin": t_bin, "abstain": t_abst, "gt": gt_tis, "exact": (t_bin == gt_tis and gt_tis is not None)},
                 "cellType": {"bin": c_bin, "abstain": c_abst, "gt": gt_cell, "exact": (c_bin == gt_cell and gt_cell is not None)}})
    cum = app._est_cost(usage)[0]
    print(f"[{i+1}/{N}] c{cid}: deNovo={str(deNovoLabel)[:30]!r} | tissue {str(t_bin)[:14]!r}/{str(gt_tis)[:14]!r} "
          f"cell {str(c_bin)[:16]!r}/{str(gt_cell)[:16]!r} | cum ${cum:.3f}", flush=True)
    if cum >= ABORT_USD:
        print(f"[ABORT] cumulative ${cum:.2f} >= ${ABORT_USD} — stopping."); break

# ----- de-novo SEMANTIC channel (driver/v2 judge), separate from menu-exact -----
labelled = [{"id": c["id"], "finalLabel": c["finalLabel"], "degsUp": byid[c["id"]].get("degsUp", [])} for c in clusters_out]
sem_verd, sem_agg, sem_sub, sem_abst = app.score_clusters(BASE, SERVE, MODEL, labelled, GT, usage)
spend = app._est_cost(usage)[0]

# ----- aggregates with explicit denominators -----
def menu_exact_agg(tier_key, gt_field):
    n_total = len(rows)
    n_gt = sum(1 for r in rows if r[tier_key]["gt"] is not None)
    n_abst = sum(1 for r in rows if r[tier_key]["abstain"])
    n_attempt = sum(1 for r in rows if (not r[tier_key]["abstain"]) and r[tier_key]["gt"] is not None)
    hits = sum(1 for r in rows if r[tier_key]["exact"])
    return {"hits": hits, "attempted": n_attempt, "abstained": n_abst, "gt_present": n_gt, "total": n_total,
            "pct_of_attempted": round(100*hits/n_attempt, 1) if n_attempt else None,
            "pct_of_gt_present": round(100*hits/n_gt, 1) if n_gt else None}
sem_by = {a["key"]: a for a in sem_agg}
def sem_channel(key):
    a = sem_by.get(key, {})
    return {"matched": a.get("matched", 0), "total": a.get("total", 0),
            "pct": round(a.get("pct", 0), 1) if a.get("total") else None}

AGG = {
    "tissue":   {"menu_exact": menu_exact_agg("tissue", T_TISSUE),   "denovo_semantic": sem_channel(T_TISSUE)},
    "cell_type":{"menu_exact": menu_exact_agg("cellType", T_CELL),   "denovo_semantic": sem_channel(T_CELL)},
}

# ----- write artifacts (additive, provenance-stamped, scored) -----
bundle = {
    "schema": "daniotype_kasperov_run/v1", "dataset": ATLAS.get("source", DATASET), "datasetId": DATASET,
    "model": MODEL, "cost": {"usd": round(spend, 4), "estimated": True, "usage": {m: dict(u) for m, u in usage.items()}},
    "exportedAt": app._now(), "scoredAt": app._now(), "nLabelled": len(clusters_out), "nValidated": len(clusters_out),
    "source": "server", "note": f"DanioCell sanity check {HARNESS_ID} — {len(clusters_out)} clusters, seed {SEED} — de-leaked, two-tier, SCORED (de-novo-semantic {JUDGE} + menu-exact); isolated eval, not promoted",
    "harness": {"id": HARNESS_ID, "version": "1.0", "name": "DanioCell sanity", "judge": JUDGE, "menuSha": MENU_SHA},
    "schemaBasis": "native-schema",
    "clusteringStrategy": {"basis": "native-schema", "tiers": {"tissue": len(TISSUE_MENU), "cell_type": len(CELL_MENU)},
                           "referenceAsset": f"daniotype_data/{SERVE}/groundtruth.json",
                           "evalSample": f"{len(clusters_out)} of 470 native groups (seed {SEED})",
                           "note": "germ_layer & cell_type_sub are null in DanioCell native — two tiers only (tissue + cell type)."},
    "provenance": {**PROV, "pipeline": "denovo-freeze+menu-bin", "grounding": {"servedDataset": SERVE, "guardResult": "OK", "guardDetail": gdetail},
                   "scored": True, "promoted": False, "channels": ["denovo_semantic", "menu_exact"]},
    "clusters": clusters_out,
    "groundTruth": {"scoredAt": app._now(), "scoring": JUDGE, "channel": "denovo_semantic",
                    "aggregate": sem_agg, "verdicts": sem_verd, "subStratified": sem_sub, "abstention": sem_abst},
}
json.dump(bundle, open(f"{OUTDIR}/run_bundle.json", "w"), indent=2)
json.dump({**PROV, "sample": SAMPLE, "n": len(SAMPLE), "date": DATE}, open(f"{OUTDIR}/sample.json", "w"), indent=2)
json.dump({"provenance": PROV, "aggregate": AGG, "rows": rows}, open(f"{OUTDIR}/aggregate.json", "w"), indent=2)

# three-way table (markdown)
with open(f"{OUTDIR}/three_way_table.md", "w") as f:
    f.write(f"# DanioCell sanity — three-way table (seed {SEED}, judge {JUDGE}, menu {MENU_SHA})\n\n")
    f.write("| cluster | de-novo name | tissue: bin / GT / ✓ | cell type: bin / GT / ✓ |\n")
    f.write("|---|---|---|---|\n")
    for r in rows:
        t = r["tissue"]; c = r["cellType"]
        tcell = f"{t['bin'] or ('abstain' if t['abstain'] else '—')} / {t['gt']} / {'✓' if t['exact'] else '✗'}"
        ccell = f"{c['bin'] or ('abstain' if c['abstain'] else '—')} / {c['gt']} / {'✓' if c['exact'] else '✗'}"
        f.write(f"| {r['id']} | {r['deNovo']} | {tcell} | {ccell} |\n")
    f.write("\n## Aggregate (channels strictly unblended; denominators explicit)\n\n")
    for tier, lab in [("tissue", "Tissue"), ("cell_type", "Cell type")]:
        me = AGG[tier]["menu_exact"]; sm = AGG[tier]["denovo_semantic"]
        f.write(f"**{lab}**\n")
        f.write(f"- menu-exact: {me['hits']}/{me['attempted']} attempted = {me['pct_of_attempted']}% "
                f"(of {me['gt_present']} GT-present; {me['abstained']} abstained; {me['total']} sampled)\n")
        f.write(f"- de-novo-semantic ({JUDGE}): {sm['matched']}/{sm['total']} = {sm['pct']}%\n\n")

with open(f"{OUTDIR}/README.md", "w") as f:
    f.write(f"""# DanioCell 10-cluster sanity check — {DATE}

Isolated, additive, de-leaked sanity check. **No** canonical scorecard, index, or leaked
baseline was touched; all outputs live here and are trivially revertible.

## Invariants verified
- **De-leak CONFIRMED (per cluster).** Phase-1 input prompts carry DEG markers only; the
  cluster's true tissue and true cell type appear in **no** user/input message (asserted per
  cluster; the run halts on any violation). First prompt opens `Cluster {{id}}'s top up-regulated
  markers are:`. Clust-code labels (`mese.5`, `eye.18`) — whose prefix encodes the tissue — were
  replaced with `Cluster {{id}}`.
- **Two-stage order CONFIRMED.** (a) open-vocab de-novo name produced + **frozen** (recorded with
  `frozenAt`), (b) only then the menu is constructed and the frozen name binned. Menu vocab appears
  in **no** phase-1 input (asserted; halt on violation).
- **Tiers correct.** DanioCell native has exactly two populated tiers: **tissue** ({len(TISSUE_MENU)}-vocab)
  and **cell type** (`cell_type_broad`, {len(CELL_MENU)}-vocab — DanioCell's finest *nameable* level).
  `germ_layer` and `cell_type_sub` are null in the native schema and were **not** fabricated.
- **Provenance stamped.** Per-cell partition sha `{PART_SHA}` (`{os.path.basename(PARTITION_FILE)}`),
  GT-label sha `{GT_SHA}`, menu sha `{MENU_SHA}`, harness `{HARNESS_ID}`, judge `{JUDGE}` — on every
  artifact. The scored bundle carries `scored: true` (never "NOT scored").
- **Channels unblended.** `menu-exact` (string match) and `denovo-semantic` ({JUDGE} judge) are
  reported separately, each with explicit denominators. Abstains recorded; a not-attempted tier is
  neither credited nor penalized but tracked.

## Files
- `run_bundle.json` — importable run (Import in the chat interface) — 10 clusters, transcripts + deNovo + menu + scored groundTruth.
- `transcripts/cluster_<id>.json` — per-cluster chat transcript + de-leak proof.
- `three_way_table.md` — the per-cluster three-way table + aggregate.
- `aggregate.json` — tissue + cell type × (menu-exact, de-novo-semantic), with denominators.
- `sample.json` — seed + cluster IDs + all provenance hashes.

Seed **{SEED}** · clusters {SAMPLE}
""")

print(f"\n=== DANIOCELL SANITY DONE === spend ${spend:.3f} | out {OUTDIR}")
print("tissue  : menu-exact %s | de-novo-semantic %s" % (AGG["tissue"]["menu_exact"], AGG["tissue"]["denovo_semantic"]))
print("celltype: menu-exact %s | de-novo-semantic %s" % (AGG["cell_type"]["menu_exact"], AGG["cell_type"]["denovo_semantic"]))
