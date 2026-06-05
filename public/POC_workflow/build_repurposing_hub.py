#!/usr/bin/env python3
# Build a compact repurposing_hub.json from the Broad Drug Repurposing Hub (release 2020-03-24).
# Deterministic, offline. RDKit-canonical standard InChIKeys both sides; ECFP4 nearest measured neighbors.
import json, sys
from rdkit import Chem
from rdkit.Chem import AllChem, DataStructs
from rdkit import RDLogger
RDLogger.DisableLog("rdApp.*")

HUB_DIR = "/tmp/hub"
DRUGS_JSON = "/data/zeroshotbio-landingpage/public/POC_workflow/drugs.json"
OUT = "/data/zeroshotbio-landingpage/public/POC_workflow/repurposing_hub.json"
FILE_DATE = "2020-03-24"
TOPK = 5

def read_tsv(path):
    rows, header = [], None
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("!"):
                continue
            parts = line.rstrip("\n").split("\t")
            if header is None:
                header = parts; continue
            rows.append(parts)
    return header, rows

# --- 1. samples: pert_iname -> smiles/inchikey/cid (first valid SMILES per drug) ---
sh, srows = read_tsv(f"{HUB_DIR}/samples.txt")
si = {c: i for i, c in enumerate(sh)}
samp = {}
for r in srows:
    if len(r) <= si["smiles"]:
        continue
    name = r[si["pert_iname"]].strip()
    smi = r[si["smiles"]].strip()
    if not name or not smi or name in samp:
        continue
    samp[name] = {"smiles": smi,
                  "cid": (r[si["pubchem_cid"]].strip() if si["pubchem_cid"] < len(r) else "")}

# --- 2. drugs: pert_iname -> moa/target/phase ---
dh, drows = read_tsv(f"{HUB_DIR}/drugs.txt")
di = {c: i for i, c in enumerate(dh)}
ann = {}
for r in drows:
    name = r[di["pert_iname"]].strip()
    ann[name] = {
        "moa": (r[di["moa"]].strip() if di["moa"] < len(r) else ""),
        "target": (r[di["target"]].strip() if di["target"] < len(r) else ""),
        "phase": (r[di["clinical_phase"]].strip() if di["clinical_phase"] < len(r) else ""),
    }

def fp(smi):
    m = Chem.MolFromSmiles(smi)
    if m is None:
        return None, None, None
    try:
        ik = Chem.MolToInchiKey(m)
    except Exception:
        ik = None
    if not ik:
        return None, None, None
    return m, ik, AllChem.GetMorganFingerprintAsBitVect(m, 2, nBits=2048)

# --- 3. measured atlas reference (the 94) ---
data = json.load(open(DRUGS_JSON))
measured = [x for x in data["drugs"] if not x.get("is_guest")]
ref = []          # [(id, fp, chem2d, moa_fine, display_name)]
measured_index = {}  # inchikey -> atlas id
for x in measured:
    m, ik, bv = fp(x["step1_structure"]["smiles"])
    if bv is None:
        continue
    ref.append((x["id"], bv, x["step3_embedding"]["chem2d"], x["moa_fine"], x["display_name"]))
    measured_index[ik] = x["id"]
print(f"measured fingerprinted: {len(ref)}/{len(measured)}; unique InChIKeys: {len(measured_index)}", file=sys.stderr)

# --- 4. build hub drugs ---
out_drugs = []
n_parse_fail = 0
n_overlap = 0
names = sorted(samp.keys())  # deterministic order
for name in names:
    smi = samp[name]["smiles"]
    m, ik, bv = fp(smi)
    if bv is None:
        n_parse_fail += 1
        continue
    can = Chem.MolToSmiles(m)
    a = ann.get(name, {})
    sims = [(rid, DataStructs.TanimotoSimilarity(bv, rbv), chem2d) for (rid, rbv, chem2d, _, _) in ref]
    sims.sort(key=lambda t: t[1], reverse=True)
    top = sims[:TOPK]
    nn = [{"id": rid, "sim": round(s, 3)} for (rid, s, _) in top]
    # chemistry placement = similarity-weighted centroid of the top neighbors' chem2d (no phenotype invented)
    wsum = sum(max(s, 1e-6) for (_, s, _) in top) or 1.0
    cx = sum(c[0] * max(s, 1e-6) for (_, s, c) in top) / wsum
    cy = sum(c[1] * max(s, 1e-6) for (_, s, c) in top) / wsum
    measured_id = measured_index.get(ik)
    if measured_id:
        n_overlap += 1
    out_drugs.append({
        "name": name,
        "smiles": can,
        "inchikey": ik,
        "moa": a.get("moa", ""),
        "target": a.get("target", ""),
        "phase": a.get("phase", ""),
        "measured": bool(measured_id),
        "atlas_id": measured_id,
        "nn": nn,
        "chem2d": [round(cx, 3), round(cy, 3)],
    })

meta = {
    "source": "Broad Drug Repurposing Hub",
    "url": "https://repo-hub.broadinstitute.org/repurposing (downloaded via CLUE S3 mirror)",
    "file_date": FILE_DATE,
    "fingerprint": "ECFP4 (Morgan radius 2, 2048 bits), Tanimoto",
    "n_hub_drugs": len(out_drugs),
    "n_parse_fail": n_parse_fail,
    "n_measured_overlap": n_overlap,
    "topk_neighbors": TOPK,
    "note": "Illustrative POC. Neighbors/placement are chemistry-only (ECFP); no measured phenotype is implied for unmeasured drugs.",
}
json.dump({"meta": meta, "measured_index": measured_index, "drugs": out_drugs},
          open(OUT, "w"), separators=(",", ":"))
print(json.dumps(meta, indent=2))
import os
print("bytes:", os.path.getsize(OUT))
