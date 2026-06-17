#!/usr/bin/env python3
"""Provenance back-fill for the six canonical daniotype labeling runs (WRITE PASS).

Reconstructs four blocks — clusteringStrategy / provenance(grounding + evidenceRefs) /
source / buildQC — for each canonical run, from on-box sidecar artifacts. Every back-filled
field carries `backfilled:true`, a single run-wide `backfillAt`, and `backfillSources` /
`evidenceRefs` entries with the FULL sha256 of the artifact each value came from.

Governing principle: RECONSTRUCTED, NOT ASSERTED. Grounding cleanliness is attested ONLY by
external artifacts (guard RUN_STATUS, transcript denominators, the 5007 sweep, distinctness),
never by a run vouching for itself — the trap that burned the quarantined pair.

Honest gaps are preserved, never fabricated:
  * model snapshot -> "unrecoverable" (floating gpt-5.5 alias; pin is a forward-runs-only fix)
  * harness stamp left UNTOUCHED; the commit/registry facts are recorded as notes, not fixes
  * addedMarkers NOT extracted -> hasMarkers stays false
  * minifin buildQC NOT emitted (no data-QC artifact exists; the "build log" is a Next build)
  * native buildQC partial/upstream; megafin_parse guard recorded as the softer "corroborated"

megafin 3a15a2 clusteringStrategy is emitted WITH a machine-legible top-level `nonStandard:true`
plus the full C67->C61 merge provenance and the manual-override / gate notes.

Scope guards: only the six canonical run JSONs are written. _archive, dataset_facts, the
quarantined runs, harness stamps, and all services are left untouched. _index files are backed
up (precaution) but NOT modified — they already carry source:"server".

Idempotent: refuses to write a run that already has provenance.backfilled == true.

Run-JSON mutations live on /data/daniotype_runs (outside the repo); this script is committed
for auditability. Usage:  python3 scripts/backfill_canonical_provenance.py
"""
import os, sys, json, hashlib, re
from datetime import datetime, timezone

DATA = "/data"
BENCH = f"{DATA}/scratch/bench"
DD = f"{DATA}/zeroshotbio-landingpage/daniotype_data"
FACTS_PATH = f"{DATA}/zeroshotbio-landingpage/src/app/daniotype_kasperov/dataset_facts.json"
RUNSTORE = f"{DATA}/daniotype_runs"

# ---- source-artifact integrity registry (path -> expected sha256_16 from the dry-run) ------
ARTIFACTS = {
    f"{DATA}/zeroshotbio-landingpage/src/app/daniotype_kasperov/dataset_facts.json": "028d0ea7e6094ce5",
    f"{DD}/zscape_native/groundtruth.json": "64f1e3a74efa53e1",
    f"{DD}/chemfish_native/groundtruth.json": "749da59ccbd8e881",
    f"{DD}/daniocell_native/groundtruth.json": "8610125c16bb05aa",
    f"{BENCH}/zscape_native_BUILD.json": "0f1933c3629e33c3",
    f"{BENCH}/chemfish_native_BUILD.json": "b1db4414bcad8d1c",
    f"{BENCH}/daniocell_native_BUILD.json": "dfdc7a31fde3d4e0",
    f"{BENCH}/native_run/RUN_STATUS.json": "49ed6f332c3fbf04",
    f"{BENCH}/native_run/zscape_native.jsonl": "72dbe0e56858b4c9",
    f"{BENCH}/native_run/chemfish_native.jsonl": "e6f0be0456741211",
    f"{BENCH}/native_run/daniocell_native.jsonl": "827837edd38ea65a",
    f"{BENCH}/native_5007_sweep.json": "c5d08c3698a67246",
    f"{BENCH}/native_run.log": "dcb1bbc39b7debd3",
    f"{BENCH}/nogt_run/RUN_STATUS.json": "44cf77e25fcddaa0",
    f"{BENCH}/nogt_run/minifin.jsonl": "ade69037f1a9703b",
    f"{BENCH}/nogt_run/megafin.jsonl": "fa618326992fda7b",
    f"{BENCH}/nogt_run/megafin_parse.jsonl": "efa315afda29109f",
    f"{BENCH}/nogt_run/megafin_parse_distinctness.json": "3b908a8d24d6a51a",
    f"{BENCH}/nogt_run.log": "1587b1e5f2622546",
    f"{BENCH}/parse_run.log": "906111e8a8021ee7",
    f"{BENCH}/megafin_rebuild_build.log": "7b756fa3f7fc36be",
    f"{BENCH}/characterization/parse_qc_config.csv": "5b35af1863855156",
    f"{BENCH}/megafin1_processing_settings.txt": "d81fe849d61eec92",
}

RUNS = {
    "zscape":        f"{RUNSTORE}/zscape/20260615-211010-c4d306.json",
    "chemfish":      f"{RUNSTORE}/chemfish/20260615-211010-e4aafa.json",
    "daniocell":     f"{RUNSTORE}/daniocell/20260615-211010-b39045.json",
    "minifin":       f"{RUNSTORE}/minifin/20260615-042324-472be7.json",
    "megafin":       f"{RUNSTORE}/megafin/20260615-042324-3a15a2.json",
    "megafin_parse": f"{RUNSTORE}/megafin_parse/20260615-043737-1afa19.json",
}
NATIVE = {"zscape", "chemfish", "daniocell"}

# sampled enrichment captured during the round-2 live :5007 verification (audit), recorded as
# documented constants — they corroborate, they are not the sole basis (the guard + sweep are).
LIVE = "live :5007 enrichment verification (audit round 2)"
SAMPLED = {
    "zscape":   [("82","ptprfa",2.87,"1.03e-209"),("102","krt4",3.278,"0.0"),("75","mmp17a",4.148,"2.18e-183")],
    "chemfish": [("248","pou6f2",4.665,"2.25e-220"),("255","stm",4.861,"5.01e-191"),("303","krt4",4.719,"0.0")],
    "daniocell":[("248","gsc",2.491,"8.46e-06"),("247","scinla",5.862,"1.94e-11"),
                 ("358","txn",0.0,"1.0","non-specific degsUp[0]; cluster grounded on its other enriched markers")],
    "megafin":  [("0","pax5",4.313,"0.0"),("42","si:dkey-65b12.6",7.196,"3.4e-251"),
                 ("83","gadd45gb.1",3.472,"0.207","noisy stress/technical cluster — enriched but non-significant; tripped the guard")],
}
HARNESS_NOTE_NATIVE = ("Harness stamp left untouched: v1.1 commit dc6eff4e. DOCUMENTED GAP — "
                       "harness_registry active commit is 87005893 (this stamp predates the registry "
                       "entry by ~33 min). Recorded as fact, not corrected.")
HARNESS_NOTE_DENOVO = ("Harness stamp left untouched: v1.0 commit f5278022 — REGISTRY-MATCHED for v1.0. "
                       "Registry active is v1.1; this run rides v1.0.")

# --------------------------------------------------------------------------------------------
def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def rel(path):
    return path[len(DATA) + 1:] if path.startswith(DATA + "/") else path

def src(path, role):
    return {"path": rel(path), "sha256": sha256(path), "role": role}

def jsonl(path):
    return [json.loads(l) for l in open(path) if l.strip()]

def abstain_rate(recs):
    n = len(recs)
    ab = sum(1 for r in recs if "abstain" in (r.get("finalLabel") or "").lower())
    return round(ab / n, 4) if n else 0.0

def denom_hits(path, n):
    txt = open(path).read()
    correct = len(re.findall(r'/%d\b' % n, txt))
    contam = len(re.findall(r'/54\b', txt))
    return {"correct": "/%d present (%d hits)" % (n, correct),
            "contaminant": "/54 absent (%d hits)" % contam}

def enrich_list(ds):
    out = []
    for t in SAMPLED.get(ds, []):
        e = {"cluster": t[0], "gene": t[1], "log2FC": t[2], "padj": t[3], "via": LIVE}
        if len(t) > 4:
            e["note"] = t[4]
        out.append(e)
    return out

# ---- pre-flight integrity gate -------------------------------------------------------------
def preflight():
    print("== PRE-FLIGHT: re-hashing source artifacts ==")
    bad = []
    for path, want16 in ARTIFACTS.items():
        if not os.path.exists(path):
            bad.append(f"MISSING {rel(path)}"); continue
        got16 = sha256(path)[:16]
        ok = got16 == want16
        print(f"  [{'ok' if ok else 'DRIFT'}] {got16}  {rel(path)}")
        if not ok:
            bad.append(f"DRIFT {rel(path)} expected {want16} got {got16}")
    if bad:
        print("\nHALT — source artifacts drifted since the dry-run; refusing to stamp a stale hash:")
        for b in bad:
            print("   " + b)
        sys.exit(1)
    print("  all artifacts match the dry-run registry.\n")

# ---- block builders ------------------------------------------------------------------------
def native_blocks(ds, facts, stamp):
    build = json.load(open(f"{BENCH}/{ds}_native_BUILD.json"))
    gt = f"{DD}/{ds}_native/groundtruth.json"
    rs = json.load(open(f"{BENCH}/native_run/RUN_STATUS.json"))[f"{ds}_native"]
    jp = f"{BENCH}/native_run/{ds}_native.jsonl"
    recs = jsonl(jp)
    n = build["units"]
    lab = {"zscape": "Saunders/Trapnell et al.", "chemfish": "Barkan et al.", "daniocell": "Sur et al. (Farrell/NICHD)"}[ds]

    clustering = {
        "backfilled": True, "backfillAt": stamp, "basis": "native-schema",
        "derivation": "authors' published finest cell groups (NOT de-novo re-clustered)",
        "referenceAsset": rel(gt), "nGroups": n, "nativeTiers": build["native_tiers"], "lab": lab,
        "note": "De-novo sweep deliberately NOT stamped — different basis than these native groups (round-1 audit).",
        "backfillSources": [src(gt, "native id-space + tier labels"),
                            src(f"{BENCH}/{ds}_native_BUILD.json", "unit + tier cardinality")],
    }
    provenance = {
        "backfilled": True, "backfillAt": stamp,
        "pipeline": "native-schema benchmark (run_native_benchmark.py)", "source": "server",
        "modelSnapshot": "unrecoverable",
        "harnessNote": HARNESS_NOTE_NATIVE,
        "grounding": {
            "servedDataset": f"{ds}_native", "guardResult": rs["guard"],
            "guardDetail": f"verify_grounding pre-spend: 3 sampled clusters' own top markers enriched on :5007, count bounded to {rs['total']} units",
            "abstentionRate": abstain_rate(recs),
            "denominatorCheck": denom_hits(jp, n),
            "sampledEnrichment": enrich_list(ds),
            "sweepEvidence": "native_5007_sweep.json — failures were small-cluster HTTP-400s named to the correct dataset; none for this dataset's larger units",
            "scanNote": "NOT targeted by the 2026-06-15 20:16 contamination scan (run entered the store 21:10, after the scan); cleanliness rests on the pre-spend guard + sweep, not the scan.",
            "selfAttestationWarning": "Cleanliness is asserted ONLY by the artifacts in evidenceRefs — never by this run (the quarantined-pair lesson).",
        },
        "evidenceRefs": [
            src(f"{BENCH}/native_run/RUN_STATUS.json", "pre-spend guard verdict"),
            src(jp, "per-cluster transcripts + denominators"),
            src(f"{BENCH}/native_5007_sweep.json", "967-unit served-dataset sweep"),
            src(f"{BENCH}/native_run.log", "guard OK log line"),
        ],
    }
    build_qc = {
        "backfilled": True, "backfillAt": stamp,
        "cellsWindow": build["cells_window"], "nUnits": n, "sizeStrata": build["size_strata"],
        "rawToH5adQC": ("UPSTREAM — the source authors' published pipeline (%s); min-genes/mito/doublet/seed "
                        "not reconstructable from our sidecars (native build only sub-selects published finest groups)." % lab),
        "backfillSources": [src(f"{BENCH}/{ds}_native_BUILD.json", "window + strata + units")],
    }
    return {"source": "server", "clusteringStrategy": clustering, "provenance": provenance, "buildQC": build_qc}

def denovo_clustering(ds, facts, stamp):
    f = facts[ds]
    chosen = next((row for row in (f.get("sweep") or []) if row.get("chosen")), None)
    base = {
        "backfilled": True, "backfillAt": stamp, "basis": "de-novo",
        "recipe": f.get("recipe"), "selectionRule": f.get("selectionRule"),
        "chosenRes": f.get("chosenRes"), "nClusters": f.get("clusters"), "sweep": f.get("sweep"),
        "backfillSources": [src(FACTS_PATH, "recipe + sweep + selectionRule")],
    }
    if chosen:
        base["minClusterSize"] = chosen.get("minSize")
    return base, chosen, f

def denovo_blocks(ds, facts, stamp):
    clustering, chosen, f = denovo_clustering(ds, facts, stamp)

    if ds == "minifin":
        rs = json.load(open(f"{BENCH}/nogt_run/RUN_STATUS.json"))["minifin"]
        jp = f"{BENCH}/nogt_run/minifin.jsonl"; recs = jsonl(jp)
        clustering["gate"] = f"PASS — run nClusters={f['clusters']} + ids 0–{f['clusters']-1} contiguous == chosen sweep row (res {f['chosenRes']})"
        grounding = {
            "servedDataset": "minifin", "guardResult": rs["guard"],
            "guardDetail": f"verify_grounding pre-spend OK, bounded {rs['total']} units (RUN_STATUS asset=minifin)",
            "abstentionRate": abstain_rate(recs),
            "denominatorCheck": {"correct": "/54 present (%d hits) — its own" % len(re.findall(r'/54\b', open(jp).read())),
                                 "contaminant": "n/a — minifin IS the :5007 baseline"},
            "scanNote": "minifin is the contamination baseline (cannot be served the wrong dataset by being itself).",
            "selfAttestationWarning": "Asserted only by the artifacts in evidenceRefs.",
        }
        evid = [src(f"{BENCH}/nogt_run/RUN_STATUS.json", "guard verdict"),
                src(jp, "transcripts + /54 denominators")]
        build_qc = None  # UNRECOVERABLE — no data-QC artifact (minifin_build.log is a Next build)

    elif ds == "megafin":
        rs = json.load(open(f"{BENCH}/nogt_run/RUN_STATUS.json"))["megafin"]
        jp = f"{BENCH}/nogt_run/megafin.jsonl"; recs = jsonl(jp)
        # merge + non-standard selection provenance (gate soft-fail, emitted with full notes)
        clustering["nonStandard"] = True
        clustering["embedding"] = ("carried Harmony(sample) [Parse/Trailmaker]; standard HVG->PCA->Harmony "
                                   "re-embed TESTED and REJECTED (coherence 0.47–0.67 -> megafin_rebuild_v2 res5.0/210)")
        clustering["rawSweepClusters"] = (chosen or {}).get("clusters")
        clustering["merged"] = f.get("merged")
        clustering["selectionNote"] = ("NON-STANDARD: no resolution met the 0.95 coherence gate (max 0.938 at res 2.0); "
                                       "res 2.0 chosen MANUALLY. Build-log auto-pick selected res 4.0 (128 clusters) — overridden.")
        clustering["gate"] = (f"SOFT-FAIL: run nClusters={f['clusters']} != chosen raw sweep row {(chosen or {}).get('clusters')}; "
                              "reconciles only via the documented C67->C61 merge; auto-pick(4.0) != final(2.0).")
        clustering["backfillSources"].append(src(f"{BENCH}/megafin_rebuild_build.log", "build log: auto-pick res + cell counts"))
        bl = open(f"{BENCH}/megafin_rebuild_build.log").read()
        cells = re.search(r"cells\s+(\d+)\s*->\s*(\d+)\s+after doublet drop", bl)
        canon = re.search(r"canonical:\s*([\d/]+\s*\([\d.]+%\))", bl)
        log_line = next((ln for ln in open(f"{BENCH}/nogt_run.log") if "c83" in ln and "HALT" in ln), "")
        grounding = {
            "servedDataset": "megafin", "servedAsset": "megafin_rebuild",
            "guardResult": "OK (after pre-spend HALT + fixed relaunch)",
            "guardDetail": ("Initial attempt HALTED: c83 gadd45gb.1 log2FC 3.472 but padj 0.207 (non-significant) -> guard "
                            "flagged 'wrong dataset?'. Re-ran with fixed guard -> OK, bounded %s units. Raw log: %s"
                            % (rs["total"], log_line.strip())),
            "abstentionRate": abstain_rate(recs),
            "denominatorCheck": denom_hits(jp, f["clusters"]),
            "sampledEnrichment": enrich_list("megafin"),
            "scanNote": "Pre-spend guard halted once then passed; served its own /%s." % f["clusters"],
            "selfAttestationWarning": "Asserted only by the artifacts in evidenceRefs.",
        }
        evid = [src(f"{BENCH}/nogt_run/RUN_STATUS.json", "guard verdict (asset=megafin_rebuild)"),
                src(jp, "transcripts + /%s denominators" % f["clusters"]),
                src(f"{BENCH}/nogt_run.log", "GUARD FAIL(c83) -> relaunch -> OK")]
        build_qc = {
            "backfilled": True, "backfillAt": stamp,
            "nCellsIn": int(cells.group(1)) if cells else None,
            "nCellsOut": int(cells.group(2)) if cells else None,
            "doubletDropped": (int(cells.group(1)) - int(cells.group(2))) if cells else None,
            "embedding": "carried Harmony(sample) [Parse/Trailmaker]",
            "canonicalGenes": canon.group(1) if canon else None,
            "rawToH5adQC": "min-genes/mito/seed not in build log; cell counts + doublet step present.",
            "caveat": "Same build log's AUTO-pick chose res 4.0->128; the run uses res 2.0 (manual). QC cell counts still valid.",
            "backfillSources": [src(f"{BENCH}/megafin_rebuild_build.log", "cell counts + embedding")],
        }

    else:  # megafin_parse
        jp = f"{BENCH}/nogt_run/megafin_parse.jsonl"; recs = jsonl(jp)
        dist = json.load(open(f"{BENCH}/nogt_run/megafin_parse_distinctness.json"))
        clustering["gate"] = f"PASS — run nClusters={f['clusters']} + ids 0–{f['clusters']-1} contiguous == chosen sweep row (res {f['chosenRes']})"
        d_p, d_m, d_mi = dist["megafin_parse"], dist["megafin"], dist["minifin"]
        grounding = {
            "servedDataset": "megafin_parse",
            "guardResult": "OK (logged in parse_run.log, NOT a retained RUN_STATUS.json sidecar)",
            "guardDetail": "verify_grounding True — 3 sampled clusters' markers enriched, bounded 77 units; Parse-specific distinctness guard OK.",
            "abstentionRate": abstain_rate(recs),
            "denominatorCheck": denom_hits(jp, f["clusters"]),
            "distinctness": {"gene": d_p["gene"], "cluster": d_p["cluster"],
                             "megafin_parse": d_p["log2FC"], "megafin": d_m["log2FC"], "minifin": d_mi["log2FC"],
                             "note": "same-id cluster is distinct across all three datasets -> :5007 served parse's own stats."},
            "scanNote": "Guard ran pre-spend (parse_run.log) but no structured RUN_STATUS entry was retained; distinctness sidecar corroborates — recorded as the softer 'corroborated' status, honestly.",
            "selfAttestationWarning": "Asserted only by the artifacts in evidenceRefs.",
        }
        evid = [src(f"{BENCH}/parse_run.log", "verify_grounding + distinctness probe"),
                src(jp, "transcripts + /%s denominators" % f["clusters"]),
                src(f"{BENCH}/nogt_run/megafin_parse_distinctness.json", "cross-dataset distinctness")]
        build_qc = {
            "backfilled": True, "backfillAt": stamp,
            "source": "Parse Trailmaker per-sample settings", "granularity": "per-sample (93 samples) — NOT a single global cutoff",
            "params": "minCellSize (per-sample UMI knee), mito maxFraction, doublet probabilityThreshold, classifier FDR",
            "backfillSources": [src(f"{BENCH}/characterization/parse_qc_config.csv", "decoded per-sample QC table"),
                                src(f"{BENCH}/megafin1_processing_settings.txt", "raw Parse settings")],
        }

    provenance = {
        "backfilled": True, "backfillAt": stamp,
        "pipeline": "no-GT benchmark (run_nogt_benchmark.py / parse pass)", "source": "server",
        "modelSnapshot": "unrecoverable", "harnessNote": HARNESS_NOTE_DENOVO,
        "grounding": grounding, "evidenceRefs": evid,
    }
    out = {"clusteringStrategy": clustering, "provenance": provenance}
    if build_qc is not None:
        out["buildQC"] = build_qc
    else:
        out["_buildQC_note"] = "minifin RAW->h5ad QC UNRECOVERABLE — no data-QC artifact on-box (minifin_build.log is a Next.js build log). Not emitted; forward-capture only."
    return out

# ---- apply ---------------------------------------------------------------------------------
def main():
    preflight()
    now = datetime.now(timezone.utc)
    stamp = now.isoformat()
    bak_suffix = now.strftime("%Y%m%d-%H%M%S")
    facts = json.load(open(FACTS_PATH))

    # backup the six run JSONs + the six _index.json (precaution; _index not modified)
    print("== BACKUP ==")
    for ds, path in RUNS.items():
        bak = f"{path}.{bak_suffix}.bak"
        with open(path, "rb") as a, open(bak, "wb") as b:
            b.write(a.read())
        idx = os.path.join(os.path.dirname(path), "_index.json")
        ibak = f"{idx}.{bak_suffix}.bak"
        with open(idx, "rb") as a, open(ibak, "wb") as b:
            b.write(a.read())
        print(f"  {rel(bak)}")
        print(f"  {rel(ibak)}")
    print()

    print("== APPLY ==")
    for ds, path in RUNS.items():
        run = json.load(open(path))
        if isinstance(run.get("provenance"), dict) and run["provenance"].get("backfilled"):
            print(f"  SKIP {ds}: already back-filled (provenance.backfilled==true)"); continue
        blocks = native_blocks(ds, facts, stamp) if ds in NATIVE else denovo_blocks(ds, facts, stamp)
        run.update(blocks)
        tmp = path + ".tmp"
        with open(tmp, "w") as fo:
            json.dump(run, fo, ensure_ascii=False, indent=1)
        os.replace(tmp, path)
        # parse-check
        json.load(open(path))
        cs = run.get("clusteringStrategy")
        print(f"  WROTE {ds}: +clusteringStrategy({'nonStandard' if (cs or {}).get('nonStandard') else cs.get('basis') if cs else 'NONE'}) "
              f"+provenance +source={run.get('source')} +buildQC={'yes' if 'buildQC' in run else 'NOT-EMITTED'}")
    print("\nDONE.")

if __name__ == "__main__":
    main()
