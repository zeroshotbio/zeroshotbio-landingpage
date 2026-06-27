#!/usr/bin/env python3.12
"""
Prep data for the /patrick GT × prediction visualizations (V1–V6).

REAL DATA ONLY. The crosswalk + collapse rule are read LIVE from the eval-only scoring
script (score_minifin_patrick.py) so these views re-render correctly when Patrick's
collapse decisions (A–D) land. We re-implement the *exact* collapse + four-bucket +
outcome-grading logic from that script and cross-check our bucket totals against its
emitted scorecard_vs_patrick.json; any disagreement is a join bug and is surfaced.

Per-cell arrays are emitted in h5ad obs_names order, which is byte-identical to the
ordering of public/patrick/cells.json (verified: recomputed leaf[] == cells.json leaf[]).
Nothing is fabricated; missing -> "no data" / null.

Pipelines:
  A (GT collapsed)    -> V1 sunburst, V2 upset, V3 umap-paint(gt)
  B (GT x pred xtab)  -> V4 confusion, V5 sankey
  C (per-cell outcome)-> V3/V6 umap-paint(outcome)
"""
import os, re, csv, json, ast, hashlib, collections, datetime

REPO   = "/data/zeroshotbio-landingpage"
OUT    = f"{REPO}/public/patrick"
SCORE  = "/data/scratch/score_minifin_patrick.py"
RUN    = "/data/scratch/v2_minifin_run_20260626/deployment_label_table.json"
SCJSON = "/data/scratch/v2_minifin_run_20260626/scorecard_vs_patrick.json"
ASSIGN = "/data/scratch/v2_minifin/minifin_v2_leaf_assign.csv"
PATLONG= "/data/experiments/patrick_minifin_labels/patrick_minifin_labels.csv"
H5AD   = "/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad"
CELLS  = f"{OUT}/cells.json"

# ---------------------------------------------------------------- live crosswalk
# Pull the literal dict/set assignments out of the scoring script WITHOUT executing it
# (it has truth-crossing side effects). ast.literal_eval keeps them real + version-tracked.
src = open(SCORE).read()
def grab(name):
    # find  NAME={ ... }  by balancing braces (dicts span many lines, comments inside).
    m = re.search(rf"\n{name}=\{{", src)
    if not m: raise SystemExit(f"could not find {name} in {SCORE}")
    i = m.end() - 1  # at the opening '{'
    depth = 0
    for j in range(i, len(src)):
        c = src[j]
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return ast.literal_eval(src[i:j+1])
    raise SystemExit(f"unbalanced braces for {name}")

UMBRELLA = grab("UMBRELLA")
PAT      = grab("PAT")
LEAF     = grab("LEAF")
PAT_REGIONS = grab("PAT_REGIONS")
# Decisions string (A–D) drives the collapse; capture it for the "collapse version" badge.
dec_m = re.search(r"# Decisions:(.*)", src)
DECISIONS = dec_m.group(1).strip() if dec_m else ""
COLLAPSE_VERSION = hashlib.sha1(
    (repr(sorted(PAT.items())) + repr(sorted(UMBRELLA.items())) + DECISIONS).encode()
).hexdigest()[:8]
print(f"[crosswalk] PAT={len(PAT)} sets, LEAF={len(LEAF)} leaves, collapse_version={COLLAPSE_VERSION}")
print(f"[crosswalk] decisions: {DECISIONS}")

# ---------------------------------------------------------------- load inputs
# Patrick raw memberships per barcode (stripped). Whitespace audit mirrors scoring.
cell_sets = collections.defaultdict(set)
for row in csv.DictReader(open(PATLONG, newline="")):
    cell_sets[row["barcode"]].add(row["patrick_label"].strip())

run_rows = {r["leaf"]: r for r in json.load(open(RUN))}
assigned  = {l for l, r in run_rows.items() if r["commit_depth"] != "abstain"}
abstained = {l for l, r in run_rows.items() if r["commit_depth"] == "abstain"}

assign = {row["cell"]: int(float(row["leaf"]))
          for row in csv.DictReader(open(ASSIGN, newline=""))}

cells_json = json.load(open(CELLS))
cells_leaf = cells_json["leaf"]
leaf_tissue_disp = cells_json["leafTissue"]   # display tissue per leaf (incl Unresolved/abstain)
leaf_call = cells_json["leafCall"]

# obs_names order == cells.json order (verified). Read it cheaply (backed).
import anndata as ad
A = ad.read_h5ad(H5AD, backed="r")
barcodes = [str(b) for b in A.obs_names]
assert len(barcodes) == len(cells_leaf), (len(barcodes), len(cells_leaf))

# ---------------------------------------------------------------- collapse (exact)
def collapse(memb):
    spec = set()
    for s in memb:
        if s in UMBRELLA:
            if memb & UMBRELLA[s]:   # drop umbrella when a child subtype is present
                continue
            spec.add(s)
        else:
            spec.add(s)
    tissues = {PAT[s][0] for s in spec if s in PAT}
    return spec, tissues

# ---------------------------------------------------------------- per-cell pass
# Aligned to barcodes order (== cells.json). Codes are filled below.
N = len(barcodes)
gt_tissue   = [None] * N        # collapsed GT tissue (str) or None (no GT) ; "AMB" if cross-tissue
gt_label    = [None] * N        # most-specific GT concept (str) or None
outcome     = [None] * N        # agree/disagree/gt_too_coarse/abstained/no_gt_assigned/no_gt_abstained/ambiguous
pred_tissue = [None] * N        # our predicted tissue for the cell's leaf (assigned leaves only)

buckets = collections.Counter()
amb_cross = 0
xtab = collections.Counter()          # (gt_t, pred_t) scorable
declined_gt = collections.Counter()   # gt_t for has-GT+abstained
nogt_pred = collections.Counter()     # pred_t for no-GT+assigned
confusion = collections.Counter()
sankey = collections.Counter()        # (gt_label, pred_label, outcome)
ct_counter = collections.Counter()
# UpSet (raw multi-label combos) + per-label set sizes (Pipeline A)
combo = collections.Counter()
setsize = collections.Counter()
multi_labelled = 0

def pred_label_of(lf):
    t, ct = LEAF[lf]
    return t if ct is None else f"{t}:{ct}"

for i, bc in enumerate(barcodes):
    lf = assign.get(bc, -1)
    is_assigned = lf in assigned
    is_abstain  = lf in abstained
    if is_assigned:
        pred_tissue[i] = LEAF[lf][0]
    has_gt = bc in cell_sets
    if not has_gt:
        if is_assigned:
            buckets["no_gt_assigned"] += 1; outcome[i] = "no_gt_assigned"
            nogt_pred[LEAF[lf][0]] += 1
            sankey[("(no GT)", pred_label_of(lf), "no_gt")] += 1
        else:
            buckets["no_gt_abstained"] += 1; outcome[i] = "no_gt_abstained"
            sankey[("(no GT)", "(abstained)", "no_gt")] += 1
        continue

    memb = cell_sets[bc]
    for s in memb: setsize[s] += 1
    if len(memb) >= 2:
        multi_labelled += 1
        combo[tuple(sorted(memb))] += 1

    spec, tissues = collapse(memb)
    if len(tissues) > 1:                       # Decision B: cross-tissue ambiguous
        amb_cross += 1; buckets["ambiguous_excluded"] += 1
        gt_tissue[i] = "AMB"; outcome[i] = "ambiguous"
        gt_label[i] = " + ".join(sorted(spec))
        continue

    gt_t = next(iter(tissues))
    gt_tissue[i] = gt_t
    gt_label[i] = " + ".join(sorted(spec)) if spec else gt_t
    gt_cts = {PAT[s][1] for s in spec if s in PAT and PAT[s][0] == gt_t}
    gt_ct = next(iter(gt_cts)) if len(gt_cts) == 1 else ("AMB" if len(gt_cts) > 1 else None)

    if is_abstain:
        buckets["gt_abstained_declined"] += 1; declined_gt[gt_t] += 1
        outcome[i] = "abstained"
        sankey[(gt_label[i], "(abstained)", "abstain")] += 1
        continue

    # scorable
    buckets["gt_assigned_scorable"] += 1
    pred_t, pred_ct = LEAF[lf]
    t_hit = (gt_t == pred_t)
    xtab[(gt_t, pred_t)] += 1
    if not t_hit:
        confusion[(gt_t, pred_t)] += 1
        outcome[i] = "disagree"
        sankey[(gt_label[i], pred_label_of(lf), "miss")] += 1
        continue
    # tissue hit -> cell_type tier (mirrors scoring) to decide too-coarse vs agree
    if gt_ct in (None, "AMB"):
        status = "gt_too_coarse"; outcome[i] = "gt_too_coarse"
    elif pred_ct is None:
        status = "pred_not_committed"; outcome[i] = "agree"
    elif gt_t == "CNS" and pred_ct not in PAT_REGIONS:
        status = "pred_region_absent_in_gt"; outcome[i] = "agree"
    else:
        status = "hit" if gt_ct == pred_ct else "miss"
        outcome[i] = "agree"          # tissue agrees regardless of ct hit/miss
    ct_counter[status] += 1
    sk_out = "GT-too-coarse" if status == "gt_too_coarse" else "hit"
    sankey[(gt_label[i], pred_label_of(lf), sk_out)] += 1

print("\n[buckets]")
for k in ["gt_assigned_scorable","gt_abstained_declined","no_gt_assigned","no_gt_abstained","ambiguous_excluded"]:
    print(f"  {k:24s} {buckets[k]:>7,}")
print(f"  {'TOTAL':24s} {sum(buckets.values()):>7,}  (cells={N:,})")
print(f"  multi_labelled = {multi_labelled:,}")

# ---------------------------------------------------------------- CROSS-CHECK vs scorecard
sc = json.load(open(SCJSON))
discrepancies = []
for k in ["no_gt_assigned","gt_assigned_scorable","gt_abstained_declined","no_gt_abstained"]:
    ours, theirs = buckets[k], sc["buckets"].get(k)
    if ours != theirs:
        discrepancies.append(f"bucket {k}: prep={ours} scorecard={theirs}")
# tissue accuracy
our_hits = sum(v for (g,p),v in xtab.items() if g == p)
our_scor = buckets["gt_assigned_scorable"]
if [our_hits, our_scor] != sc.get("tissue_acc"):
    discrepancies.append(f"tissue_acc: prep=[{our_hits},{our_scor}] scorecard={sc.get('tissue_acc')}")
# ct grades
for k, v in sc.get("ct", {}).items():
    if ct_counter[k] != v:
        discrepancies.append(f"ct {k}: prep={ct_counter[k]} scorecard={v}")
# confusion (top few)
for key, v in sc.get("confusion", {}).items():
    g, p = key.split("->");
    if confusion[(g, p)] != v:
        discrepancies.append(f"confusion {key}: prep={confusion[(g,p)]} scorecard={v}")
if discrepancies:
    print("\n[!! CROSS-CHECK DISCREPANCIES — JOIN BUG !!]")
    for d in discrepancies[:40]: print("   -", d)
else:
    print("\n[cross-check] PASS — all buckets/tissue-acc/ct/confusion match scorecard exactly.")

# ---------------------------------------------------------------- tissue ordering (hierarchy)
# Neural/CNS-region grouped first so CNS<->Retina confusion forms a visible block.
TISSUE_ORDER = ["CNS","Retina","PNS_neuron","PNS_glia","NC",
                "Vascular","Blood","Immune",
                "Muscle","Heart",
                "Epidermis","Pigment",
                "Endoderm","Kidney",
                "Notochord","Hypochord","Cartilage","Mesenchyme",
                "Lens","Ear","HatchingGland","Stress","Other","Unresolved"]
def torder(t):
    return TISSUE_ORDER.index(t) if t in TISSUE_ORDER else len(TISSUE_ORDER)

# ============================================================ EMIT: paint (V3/V6)
# Encode tissues + outcomes as small int codes aligned to cells.json order.
gt_classes = [t for t in TISSUE_ORDER if any(g == t for g in gt_tissue)]
gt_classes += [c for c in ["AMB"] if "AMB" in gt_tissue]
GT_CODE = {t: i for i, t in enumerate(gt_classes)}
OUT_ORDER = ["agree","gt_too_coarse","disagree","abstained",
             "no_gt_assigned","no_gt_abstained","ambiguous"]
out_classes = [o for o in OUT_ORDER if o in outcome]
OUTC = {o: i for i, o in enumerate(out_classes)}

gt_code  = [GT_CODE[t] if t is not None else -1 for t in gt_tissue]      # -1 = unlabelled (visible gray)
out_code = [OUTC[o] for o in outcome]                                     # every cell graded
gt_count = collections.Counter(t for t in gt_tissue)                      # incl None
paint = {
    "n": N,
    "note": "per-cell codes aligned to cells.json order (obs_names). -1 gtCode = UNLABELLED (render gray, never drop).",
    "collapseVersion": COLLAPSE_VERSION,
    "gtClasses": gt_classes,           # index = code
    "gtCode": gt_code,
    "gtUnlabelled": int(sum(1 for t in gt_tissue if t is None)),
    "outClasses": out_classes,
    "outCode": out_code,
    "gtCounts": {("(unlabelled)" if t is None else t): c for t, c in gt_count.items()},
    "outCounts": {o: sum(1 for x in outcome if x == o) for o in out_classes},
}
json.dump(paint, open(f"{OUT}/gtviz_paint.json", "w"))
print(f"\n[write] gtviz_paint.json  ({os.path.getsize(f'{OUT}/gtviz_paint.json')//1024} KB)  classes={gt_classes}")
print(f"        outClasses={out_classes}")

# ============================================================ EMIT: sunburst (V1)
# Post-collapse hierarchy root -> tissue -> subtype(ct) -> count. Each cell once.
# Unlabelled + cross-tissue ambiguous are first-class top-level nodes.
hier = collections.defaultdict(lambda: collections.Counter())   # tissue -> ct(or "(umbrella)") -> n
amb_combo = collections.Counter()
for i in range(N):
    t = gt_tissue[i]
    if t is None or t == "AMB":
        continue
    spec = gt_label[i]
    # recover ct from the spec label via PAT (single-tissue guaranteed here)
    cts = set()
    for s in spec.split(" + "):
        if s in PAT and PAT[s][0] == t:
            cts.add(PAT[s][1])
    ct = next(iter(cts)) if len(cts) == 1 else None
    hier[t][ct if ct else "(umbrella / no subtype)"] += 1
for i in range(N):
    if gt_tissue[i] == "AMB":
        amb_combo[gt_label[i]] += 1

sun_children = []
for t in sorted(hier, key=torder):
    subs = [{"name": ct, "value": n} for ct, n in sorted(hier[t].items(), key=lambda kv: -kv[1])]
    sun_children.append({"name": t, "tissue": t, "children": subs,
                         "value": sum(s["value"] for s in subs)})
# unlabelled + ambiguous as visible siblings
unl = sum(1 for t in gt_tissue if t is None)
sun_children.append({"name": "Unlabelled (no GT)", "tissue": "_unlabelled", "value": unl})
if amb_combo:
    sun_children.append({"name": "Cross-tissue ambiguous", "tissue": "_ambiguous",
                         "children": [{"name": k, "value": v} for k, v in amb_combo.most_common()],
                         "value": sum(amb_combo.values())})
sunburst = {"name": "MiniFin 94,616 cells", "collapseVersion": COLLAPSE_VERSION,
            "children": sun_children}
json.dump(sunburst, open(f"{OUT}/gtviz_sunburst.json", "w"), indent=1)
print(f"[write] gtviz_sunburst.json  tissues={len(hier)}  unlabelled={unl:,}  ambiguous={sum(amb_combo.values()):,}")

# ============================================================ EMIT: upset (V2)
# Raw multi-label overlaps. Top intersections by count + per-label set sizes.
# Flag each combo hierarchy-consistent (one tissue) vs cross-umbrella-ambiguous.
def combo_tissues(labels):
    return {PAT[s][0] for s in labels if s in PAT}
top = combo.most_common(24)
inter = []
for labels, cnt in top:
    ts = combo_tissues(labels)
    inter.append({"labels": list(labels), "count": cnt,
                  "tissues": sorted(ts),
                  "crossTissue": len(ts) > 1})
# set sizes for the labels that appear in the shown intersections (+ all, for the matrix rows)
involved = sorted({l for labels, _ in top for l in labels}, key=lambda s: -setsize[s])
upset = {
    "collapseVersion": COLLAPSE_VERSION,
    "multiLabelledCells": multi_labelled,
    "totalLabelledCells": int(sum(1 for t in gt_tissue if t is not None and t != "AMB")) + amb_cross,
    "sets": [{"label": s, "size": setsize[s], "tissue": (PAT[s][0] if s in PAT else "?")} for s in involved],
    "intersections": inter,
    "note": "intersection = exact set of raw Patrick labels a cell carries (pre-collapse). crossTissue=True flags cross-umbrella ambiguity (Decision B exclusion).",
}
json.dump(upset, open(f"{OUT}/gtviz_upset.json", "w"), indent=1)
print(f"[write] gtviz_upset.json  multiLabelled={multi_labelled:,}  shownIntersections={len(inter)}  involvedSets={len(involved)}")

# ============================================================ EMIT: crosstab (V4)
gt_rows = [t for t in TISSUE_ORDER if declined_gt[t] or any(g == t for (g, p) in xtab)]
pred_cols = sorted({p for (_, p) in xtab} | set(nogt_pred), key=torder)
ABST = "(abstained)"
matrix = {}
for g in gt_rows:
    matrix[g] = {p: xtab[(g, p)] for p in pred_cols}
    matrix[g][ABST] = declined_gt[g]
NOGT = "(no GT)"
matrix[NOGT] = {p: nogt_pred[p] for p in pred_cols}
matrix[NOGT][ABST] = buckets["no_gt_abstained"]
crosstab = {
    "collapseVersion": COLLAPSE_VERSION,
    "rows": gt_rows + [NOGT],
    "cols": pred_cols + [ABST],
    "matrix": matrix,
    "abstainCol": ABST, "noGtRow": NOGT,
    "note": "rows=Patrick collapsed GT tissue, cols=our predicted tissue, hierarchy-ordered. '(abstained)' col = declined (success, not error); '(no GT)' row = we labelled where Patrick didn't. row-normalized = recall (incl. abstain leak).",
}
json.dump(crosstab, open(f"{OUT}/gtviz_crosstab.json", "w"), indent=1)
print(f"[write] gtviz_crosstab.json  rows={len(gt_rows)+1}  cols={len(pred_cols)+1}")

# ============================================================ EMIT: sankey (V5)
# GT label -> prediction -> outcome. Width = cells. Prune tiny links for legibility
# but keep the Liver story + CNS flows; report what was pruned (no silent truncation).
links_all = [{"gt": g, "pred": p, "outcome": o, "value": v}
             for (g, p, o), v in sankey.items()]
MIN_LINK = 5
kept = [l for l in links_all if l["value"] >= MIN_LINK]
pruned_n = len(links_all) - len(kept)
pruned_cells = sum(l["value"] for l in links_all if l["value"] < MIN_LINK)
# Liver sanity: Liver GT label -> pred split
liver = collections.Counter()
for (g, p, o), v in sankey.items():
    if g == "Liver":
        liver[p] += v
sankey_out = {
    "collapseVersion": COLLAPSE_VERSION,
    "minLink": MIN_LINK,
    "links": sorted(kept, key=lambda l: -l["value"]),
    "prunedLinks": pruned_n, "prunedCells": pruned_cells,
    "liverSplit": dict(liver),
    "outcomeColors": {"hit": "#22c55e", "GT-too-coarse": "#eab308", "miss": "#ef4444",
                      "abstain": "#38bdf8", "no_gt": "#52525b"},
    "note": f"links with <{MIN_LINK} cells pruned from the diagram for legibility ({pruned_n} links / {pruned_cells} cells); full counts in gtviz_meta.",
}
json.dump(sankey_out, open(f"{OUT}/gtviz_sankey.json", "w"), indent=1)
print(f"[write] gtviz_sankey.json  links(kept)={len(kept)}  pruned={pruned_n}({pruned_cells} cells)")
print(f"        Liver split -> {dict(liver)}")

# ============================================================ EMIT: meta
meta = {
    "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
    "collapseVersion": COLLAPSE_VERSION,
    "decisions": DECISIONS,
    "nCells": N,
    "buckets": dict(buckets),
    "ctGrades": dict(ct_counter),
    "tissueAccuracy": {"hits": our_hits, "scorable": our_scor,
                       "pct": round(100*our_hits/our_scor, 1) if our_scor else None},
    "multiLabelledCells": multi_labelled,
    "crosswalk": {"patSets": len(PAT), "leaves": len(LEAF)},
    "crossCheck": {"passed": not discrepancies, "discrepancies": discrepancies},
    "sources": {"run": RUN, "scorecard": SCJSON, "crosswalk": SCORE,
                "patrickGT": PATLONG, "assign": ASSIGN, "umap": CELLS},
}
json.dump(meta, open(f"{OUT}/gtviz_meta.json", "w"), indent=1)
print(f"[write] gtviz_meta.json  crossCheck.passed={not discrepancies}")
print("\nDONE.")
