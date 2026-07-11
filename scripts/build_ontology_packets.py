#!/usr/bin/env python
"""Phase 1 — ontology evidence-packet engine (MiniFin).

Runs zlabel's deterministic engine (support-weighted ZFA convergence + panel prior +
ZFIN grounding + stage) over each MiniFin cluster's markers and assembles the evidence
packet the LLM reasoner will consume:

  - call: grounded ZFA term + full descent path + earned depth (CellO: settle at an
    internal node, never force a leaf).
  - confidence: calibrated score + components (coherence/margin/grounding/stage) — the
    abstention gate (popV: high score => trust, low => route to reasoner).
  - candidates: near-tie panel buckets with margin_to_top (the contested set).
  - discriminators: for the top-2 candidates, the markers that separate their lineages,
    split into present-in-cluster vs absent probe-targets (OnClass guilt-by-association:
    lineage-specific markers settle the call).
  - convergent_genes + expression_evidence + ood flag.

GT-blind: panels are curated from ZFIN/literature, never atlas markers. Writes
daniotype_data/minifin/ontology_packets.json.
"""
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zlabel import Labeler
from zlabel.panels import load_panels
import zfa_neighborhood as NB  # OnClass-style neighborhood adapter (cached embedding)

DATASET = os.environ.get("PACKET_DATASET", "minifin")
DDIR = f"/data/zeroshotbio-landingpage/daniotype_data/{DATASET}"
UMAP = os.environ.get("PACKET_UMAP", f"{DDIR}/umap.json")
OUT = os.environ.get("PACKET_OUT", f"{DDIR}/ontology_packets.json")
STAGE = float(os.environ.get("PACKET_STAGE", "48.0"))
TOPN_MARKERS = 25

lab = Labeler(stage_hpf=STAGE)
PANELS = {p.bucket: p for p in lab._panels}


def discriminators(top_buckets, cluster_markers):
    """For the top-2 candidate buckets, split each one's canonical panel markers into
    present-in-cluster vs absent (probe targets), and flag markers shared by both
    (non-discriminating). Gives the reasoner the exact discriminating questions."""
    present = set(m.lower() for m in cluster_markers)
    out = []
    names = [b for b, _ in top_buckets][:2]
    shared = set()
    if len(names) == 2:
        a, b = PANELS.get(names[0]), PANELS.get(names[1])
        if a and b:
            shared = set(x.lower() for x in a.markers) & set(x.lower() for x in b.markers)
    for b, score in top_buckets[:2]:
        p = PANELS.get(b)
        if not p:
            continue
        mk = [m.lower() for m in p.markers]
        out.append({
            "bucket": b,
            "present_specific": [m for m in mk if m in present and m not in shared],
            "absent_probe": [m for m in mk if m not in present and m not in shared],
            "shared_nondiscriminating": sorted(m for m in mk if m in shared),
        })
    return out


def packet(cluster):
    markers = list(cluster.get("degsUp") or [])[:TOPN_MARKERS]
    L = lab.label(markers)
    T = lab.trace(markers)
    # ranked panel contenders (identity buckets) by adjusted score
    contenders = sorted(
        [(bs.bucket, bs.adjusted_score) for bs in T.panel_scores if bs.kind == "identity" and bs.adjusted_score > 0],
        key=lambda x: -x[1],
    )
    top = contenders[:4]
    top_margin = (top[0][1] - top[1][1]) if len(top) >= 2 else (top[0][1] if top else 0.0)
    # fine ZFA-term votes that passed the convergence gate (support-weighted candidates)
    fine = [
        {"zfa": tv.zfa_id, "name": tv.zfa_name, "genes": list(tv.genes), "n": tv.gene_count,
         "ic": round(tv.information_content, 3), "depth": tv.ancestor_depth}
        for tv in T.term_votes if tv.passed_convergence
    ]
    fine.sort(key=lambda t: (-t["n"], -t["ic"]))
    return {
        "id": cluster["id"], "label": cluster.get("label"), "nCells": cluster.get("nCells"),
        "markers_in": markers,
        "call": {"bucket": L.bucket, "zfa_id": L.zfa_id, "zfa_name": (L.levels[-1] if L.levels else None),
                 "path": list(L.levels), "depth": L.depth, "abstained": L.abstained, "ood": L.ood,
                 "ambiguity": L.ambiguity_flag},
        "confidence": {"tier": (str(L.confidence) if L.confidence else None), "score": L.confidence_score,
                       "components": {k: round(v, 3) for k, v in (L.confidence_components or {}).items()},
                       "margin": round(L.margin, 3)},
        "candidates": [{"bucket": b, "germ_layer": PANELS[b].germ_layer if b in PANELS else None,
                        "score": round(s, 3), "margin_to_top": round(top[0][1] - s, 3)} for b, s in top],
        "top_margin": round(top_margin, 3),
        "discriminators": discriminators(top, markers),
        "convergent_genes": list(L.convergent_genes),
        "expression_evidence": [{"symbol": e.symbol, "zfa": e.zfa_id, "name": e.zfa_name} for e in L.expression_evidence[:8]],
        "fine_terms": fine[:8],
        # OnClass-style local map: nearest identity-bearing ZFA nodes + cosine trust (guilt-by-association)
        "neighborhood": NB.neighborhood(markers, k=8),
    }


umap = json.load(open(UMAP))
packets = [packet(c) for c in umap["clusters"]]
json.dump({"stage_hpf": STAGE, "source": "zlabel Labeler + trace", "n": len(packets), "packets": packets},
          open(OUT, "w"), indent=1)

# ---- landscape summary ----
ab = sum(1 for p in packets if p["call"]["abstained"])
depths = collections.Counter(p["call"]["depth"] for p in packets if not p["call"]["abstained"])
tiers = collections.Counter((p["confidence"]["tier"] or "abstain") for p in packets)
near = [p for p in packets if p["top_margin"] and p["top_margin"] < 0.03 and not p["call"]["abstained"]]
ood = collections.Counter(p["call"]["ood"] for p in packets)
print(f"wrote {OUT} — {len(packets)} packets")
print(f"abstained: {ab}/{len(packets)} | ood: {dict(ood)}")
print(f"confidence tiers: {dict(tiers)}")
print(f"earned-depth distribution (assigned): {dict(sorted(depths.items()))}")
print(f"near-tie candidates (top_margin<0.03): {len(near)} clusters -> {[p['id'] for p in near][:15]}")
print("\nexamples:")
for cid in ['8', '20', '35', '45']:
    p = next(x for x in packets if str(x['id']) == cid)
    c = p['call']; d = p['discriminators']
    print(f"  c{cid}: {c['bucket']} d{c['depth']} conf={p['confidence']['tier']} ood={c['ood']} | cands={[(x['bucket'],x['margin_to_top']) for x in p['candidates'][:2]]}")
    if d:
        print(f"       discrim[{d[0]['bucket']}] present={d[0]['present_specific'][:4]} probe={d[0]['absent_probe'][:4]}")
