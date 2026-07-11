#!/data/.venv/bin/python
"""MiniFin menu-exposed-chat harness (CARO/ZFA-native menu)  — id: menu-exposed-chat-caro/minifin-v1

Brings MiniFin in line with the ZSCAPE / DanioCell / ChemFish golden runs: the clean
3-personality flow  Researcher (evidence) -> Reasoner (de-novo 4-tier conclusion) ->
Reasoner (menu-exposed binning).  MiniFin has no published GT menu, so Phase-2 uses OUR
native menu derived from zlabel's panels.yaml (germ_layer / tissue / cell_type_broad) +
the ZFA ontology grounded to ZFIN expression (cell_type_sub), on the CARO structural
ladder (Anatomical system > Compound organ > Multi-tissue structure > Portion of tissue >
Cell).  The Reasoner names cell_type_sub at the DEEPEST CARO rung the evidence supports.

Same _agent transport as the golden harness (POST {base}/api/kasperov_agent).  Saves ONE
bundled run with datasetId="minifin" so it lands in MiniFin's "View Completed Runs".

Env (sourced from the daniotype_autopilot service unit): AUTOPILOT_API_TOKEN,
AUTOPILOT_BASE_URL, AUTOPILOT_RUNS_DIR, KASPEROV_BASIC_PASSWORD.
"""
import os, sys, re, json, random

APP_DIR = "/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"
sys.path.insert(0, APP_DIR)
import app

DATASET   = "minifin"
MODEL     = os.environ.get("MINIFIN_MODEL", "gpt-5.4")
SEED      = int(os.environ.get("MINIFIN_SEED", "48"))
N_SAMPLE  = int(os.environ.get("MINIFIN_N", "4"))
ABORT_USD = float(os.environ.get("MINIFIN_ABORT_USD", "4.00"))
HARNESS   = {"id": "menu-exposed-chat-zfa", "version": "minifin-zfa-v2",
             "name": "3-personality menu-exposed chat (ZFA structural-bucket menu)",
             "basis": "menu-exposed-chat (zscape-port) + zlabel panels + Darien ZFA buckets"}
ASSET_DIR = "/data/zeroshotbio-landingpage/daniotype_data/minifin"
MENU_PATH = os.path.join(ASSET_DIR, "label_menu_zfa.json")
UMAP_PATH = os.path.join(ASSET_DIR, "umap.json")
MANIFEST  = os.environ.get("MINIFIN_MANIFEST", "/tmp/minifin_menu_exposed_results.json")

BASE = app.DEFAULT_BASE
if not os.environ.get("AUTOPILOT_API_TOKEN"):
    print("[FATAL] AUTOPILOT_API_TOKEN absent — source the service env first. No spend."); sys.exit(2)

MENU = json.load(open(MENU_PATH))
ATLAS = json.load(open(UMAP_PATH))
CLUSTERS = ATLAS["clusters"]
print(f"[init] base={BASE} model={MODEL} | menu sha {MENU['menu_sha']} | {len(CLUSTERS)} minifin clusters")

# ---- sample ---------------------------------------------------------------
rng = random.Random(SEED)
ids = [str(c["id"]) for c in CLUSTERS]
SAMPLE = sorted(rng.sample(ids, min(N_SAMPLE, len(ids))), key=lambda x: int(x) if x.isdigit() else 1e9)
print(f"[plan] N={len(SAMPLE)} seed={SEED} abort@${ABORT_USD:.2f} sample={SAMPLE}")

# ---- helpers --------------------------------------------------------------
def up_down(c):
    up = list(c.get("degsUp") or [])[:8]
    if not up:
        up = [(m.get("g") or "") for m in (c.get("markers") or [])[:8]]
    down = list(c.get("markersDown") or [])[:6]
    return [g for g in up if g], [g for g in down if g]

def researcher_prompt(c):
    up, down = up_down(c)
    up_s = ", ".join(up); down_s = ", ".join(down) if down else "(none informative)"
    return (
        f"Cluster {c['id']}'s top UP markers: {up_s}. Depleted (DOWN) markers: {down_s}. "
        "For EACH marker — every UP marker AND the informative DOWN ones — return cited evidence from "
        "ALL THREE sources: ZFIN in-vivo expression, the ZFA anatomy term (use the ontology_lookup tool "
        "for ZFA — do not rely on web search for it), and the GO molecular function/process. Link every "
        "record so all three source pills show per marker. A depleted (DOWN) marker is real evidence "
        "AGAINST a tissue — research it too. Evidence only — no identity call (that is the Reasoner's job)."
    )

DENOVO_PROMPT = (
    "You have the Researcher's read above. IMPORTANT: this cluster's differential markers + their stats "
    "are ALREADY PRECOMPUTED and given to you — trust them. Your DEFAULT action is to CONCLUDE. Do NOT "
    "routinely dispatch the Archivist to double-check precomputed numbers — only dispatch it if a SPECIFIC "
    "raw stat is genuinely in doubt AND would change your call. When the identity + 4-tier stack are settled "
    "— which for a clear marker set is NOW — conclude with a kasperov-conclude block, citing markers that "
    "are actually in THIS cluster's marker list (abstain at the deepest defensible tier if you cannot ground "
    "a specific type). Only dispatch (kasperov-dispatch) if a single specific query would actually change the call."
)

def score_panels(c, k=3):
    """Winning zlabel panels by marker overlap (coarse prior) — picks which grounded sub-menus to expose."""
    up = set(g.lower() for g in (c.get("degsUp") or [])) | set((m.get("g") or "").lower() for m in (c.get("markers") or []))
    scored = []
    for pn, p in MENU["panels"].items():
        ov = up & set(g.lower() for g in p.get("markers", []))
        if ov:
            scored.append((len(ov), pn, sorted(ov)))
    scored.sort(reverse=True)
    return scored[:k]

def sub_menu_block(panels):
    out = []
    for _, pn, ov in panels:
        p = MENU["panels"][pn]
        out.append(f"### {pn}  (germ={p['germ_layer']}, tissue={p['tissue']}; marker overlap: {', '.join(ov)})")
        for b in MENU["bucket_order"]:
            terms = p["sub_by_bucket"].get(b)
            if not terms:
                continue
            disp = MENU["bucket_meta"][b]["display"]
            names = ", ".join(f"{t['name']}" for t in terms[:40])
            out.append(f"  {disp}: {names}")
    return "\n".join(out)

def menu_prompt(c, denovo_label):
    germ = " | ".join(MENU["tiers"]["germ_layer"])
    tissue = " | ".join(MENU["tiers"]["tissue"])
    broad = " | ".join(MENU["tiers"]["cell_type_broad"])
    panels = score_panels(c)
    subs = sub_menu_block(panels) or "(no panel marker overlap — choose the closest broad panel and abstain at cell_type_sub)"
    principal = [MENU["bucket_meta"][b]["display"] for b in MENU["bucket_order"] if MENU["bucket_meta"][b]["principal"]]
    ladder = " > ".join(principal)
    return (
        f'=== MENU-EXPOSED PHASE — {denovo_label} ===\n'
        f'Your DE-NOVO call is now LOCKED: "{denovo_label}". Do NOT revise, re-derive, or second-guess it here.\n\n'
        f'This is MiniFin — OUR OWN dataset (48 hpf). Its label menu is native: germ_layer / tissue / '
        f'cell_type_broad come from the zlabel panel schema; cell_type_sub is the ZFA anatomy ontology '
        f'grounded to ZFIN wildtype expression, each term assigned one exclusive ZFA structural bucket. '
        f'Bin your locked call onto it.\n\n'
        f'germ_layer: [ {germ} ]\n'
        f'tissue: [ {tissue} ]\n'
        f'cell_type_broad (zlabel panels): [ {broad} ]\n\n'
        f'cell_type_sub — ZFA structural ladder (principal buckets, coarse → fine): {ladder}. '
        f'A few named SECONDARY buckets also exist for non-principal anatomy (e.g. Organism substance = blood, '
        f'Embryonic structure, Organism subdivision).\n'
        f'DEPTH IS EARNED: name cell_type_sub at the DEEPEST bucket the marker evidence supports, and abstain '
        f'deeper when the markers do not converge. First confirm the cell_type_broad panel; then state the '
        f'deepest structural bucket the evidence supports; then pick the SINGLE closest ZFA term from that panel\'s '
        f'grounded sub-menu in that bucket, or NO_MATCH if none fits.\n\n'
        f'Grounded ZFA sub-menus (by bucket) for the panels closest to your call:\n{subs}\n\n'
        f'Declare under a "**Menu-aware binning**" heading as five short lines:\n'
        f'- germ_layer: <menu option> (<confidence>%)\n'
        f'- tissue: <menu option> (<confidence>%)\n'
        f'- cell_type_broad: <panel> (<confidence>%)\n'
        f'- zfa_bucket: <Anatomical system|System subtype|Organ|Multi-tissue structure|Portion of tissue|Cell|secondary bucket>\n'
        f'- cell_type_sub: <exact ZFA term name> (<confidence>%)   [or NO_MATCH]\n\n'
        f'Pick ONLY from the menu; never invent a label. Then REFLECT briefly on any divergence '
        f'(menu-vocabulary artifact vs real uncertainty). FINALLY end with a clear '
        f'"### ✅ CLUSTER COMPLETE — {denovo_label}" block restating BOTH the de-novo and menu-exposed answers.'
    )

def denovo_label_of(rc):
    concl = app.parse_conclude(rc) or {}
    lbl = concl.get("identity")
    if lbl:
        return lbl, concl
    m = re.search(r"cell type \(sub\).*?[—:-]\s*(.+)", rc, re.I)
    return (m.group(1).strip() if m else "(unresolved)"), concl

# ---- run ------------------------------------------------------------------
usage, bundled, results = {}, [], []
for i, cid in enumerate(SAMPLE):
    c = next(x for x in CLUSTERS if str(x["id"]) == cid)
    cl = {"id": c["id"], "label": c.get("label", f"Cluster {c['id']}"),
          "degsUp": c.get("degsUp", []), "markers": c.get("markers", []), "nCells": c.get("nCells")}
    try:
        rp = researcher_prompt(cl)
        rsearch = app._agent(BASE, DATASET, MODEL, cl, [{"role": "user", "content": rp}], "research", usage)
        conv = [{"role": "user", "content": rp}, {"role": "assistant", "content": rsearch}]
        rdenovo = app._agent(BASE, DATASET, MODEL, cl, conv + [{"role": "user", "content": DENOVO_PROMPT}], "reason", usage)
        conv += [{"role": "user", "content": DENOVO_PROMPT}, {"role": "assistant", "content": rdenovo}]
        denovo, concl = denovo_label_of(rdenovo)
        mp = menu_prompt(cl, denovo)
        rmenu = app._agent(BASE, DATASET, MODEL, cl, conv + [{"role": "user", "content": mp}], "reason", usage)
        transcript = [
            {"role": "user", "content": rp, "mode": "research"},
            {"role": "assistant", "content": rsearch, "mode": "research"},
            {"role": "user", "content": DENOVO_PROMPT, "mode": "reason"},
            {"role": "assistant", "content": rdenovo, "mode": "reason"},
            {"role": "user", "content": mp, "mode": "reason", "phase": "menu-exposed"},
            {"role": "assistant", "content": rmenu, "mode": "reason", "phase": "menu-exposed"},
        ]
    except Exception as e:
        print(f"[{i+1}/{len(SAMPLE)}] minifin:{cid} ERROR {e}")
        denovo, concl, transcript = "(error)", {}, []
    bundled.append({"id": cl["id"], "label": cl["label"], "finalLabel": denovo, "validated": True,
                    "nCells": cl["nCells"], "degsUp": cl["degsUp"], "markers": cl["markers"],
                    "markersDown": c.get("markersDown"), "deNovo": concl, "transcript": transcript})
    results.append({"cluster": cid, "finalLabel": denovo})
    cum = app._est_cost(usage)[0]
    print(f"[{i+1}/{len(SAMPLE)}] minifin:{cid} | deNovo={str(denovo)[:48]!r} | cum ${cum:.3f}", flush=True)
    if cum >= ABORT_USD:
        print(f"[ABORT] cum ${cum:.2f} >= ${ABORT_USD:.2f}"); break

usd, est = app._est_cost(usage)
run = {
    "schema": "daniotype_kasperov_run/v1", "dataset": ATLAS.get("source", DATASET), "datasetId": DATASET,
    "model": MODEL, "cost": {"usd": usd, "estimated": est, "usage": {m: dict(u) for m, u in usage.items()}},
    "exportedAt": app._now(), "scoredAt": None, "nLabelled": len(bundled), "nValidated": len(bundled), "source": "server",
    "note": f"MiniFin menu-exposed-chat SMOKE TEST (CARO/ZFA-native menu) — {len(bundled)} leaves, seed {SEED} — NOT scored",
    "harness": {**HARNESS, "menuSha": MENU["menu_sha"], "stampedAt": app._now()[:10]},
    "provenance": {"pipeline": "researcher->reasoner-denovo->menu-exposed(CARO)", "menuVersion": MENU["menu_sha"],
                   "menuSource": "zlabel/panels.yaml + ZFA(zfin-grounded)", "promoted": False, "scored": False,
                   "baseUrl": BASE, "sampleSeed": SEED, "smokeTest": True},
    "clusters": bundled, "groundTruth": None,
}
run_id = app.save_run(run)
json.dump({"runId": run_id, "results": results, "spendUsd": round(usd, 4), "menuSha": MENU["menu_sha"]},
          open(MANIFEST, "w"), indent=2)
print(f"[saved] run {run_id} -> {app.RUNS_DIR}/{DATASET}/ | ${usd:.3f} | manifest {MANIFEST}")
print(f"=== SMOKE COMPLETE === {len(bundled)} leaves | run {run_id} | inspect in MiniFin 'View Completed Runs'")
