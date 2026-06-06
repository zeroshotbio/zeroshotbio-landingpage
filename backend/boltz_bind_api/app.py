#!/usr/bin/env python3
"""Boltz-2 binding-plausibility API for the target-aware POC submission.

Async by design: Boltz takes minutes on the GPU, so a synchronous request would time out.
  POST /api/bind        {smiles, gene}            -> {job_id, status}
  GET  /api/bind/<id>                              -> {status, result?}
  GET  /api/bind?smiles=..&gene=..                 -> cached result if present, else 404
  GET  /health                                     -> {ok}

The GPU is single, so jobs run one-at-a-time behind a lock. Results cache by
(canonical_smiles, gene) so a repeat submission is instant.

Binding is computed against the ZEBRAFISH ORTHOLOG (user-confirmed). The response carries an
explicit disclaimer: binding plausibility != phenotypic effect.

Run (python3.12, needs boltz+torch+cuda):  python app.py --port 5005
"""
import os, sys, json, hashlib, threading, argparse, traceback
from collections import OrderedDict
from flask import Flask, request, jsonify
from flask_cors import CORS

# import the validated binding harness
sys.path.insert(0, "/data/drug_dev/tahoe_embedding/scores/target_aware")
import boltz_bind as BB
from rdkit import Chem
from rdkit import RDLogger; RDLogger.DisableLog("rdApp.*")

RUN_ROOT = "/data/drug_dev/tahoe_embedding/scores/target_aware/boltz_runs/api"
CACHE_FILE = os.path.join(RUN_ROOT, "_cache.json")
SAMPLES = int(os.environ.get("BIND_SAMPLES", "3"))
os.makedirs(RUN_ROOT, exist_ok=True)

app = Flask(__name__)
CORS(app)  # frontend lives on www.zeroshot.bio; API on zscape.zeroshot.bio (cross-origin)

_gpu_lock = threading.Lock()
_jobs = {}            # job_id -> {status, result, error}
_jobs_lock = threading.Lock()
_disk_cache = json.load(open(CACHE_FILE)) if os.path.exists(CACHE_FILE) else {}

def canon(smiles):
    m = Chem.MolFromSmiles(smiles)
    return Chem.MolToSmiles(m) if m else smiles.strip()

def key(smiles, gene):
    return hashlib.sha1(f"{canon(smiles)}||{gene.upper()}".encode()).hexdigest()[:16]

def _worker(job_id, smiles, gene):
    try:
        with _jobs_lock:
            _jobs[job_id]["status"] = "running"
        with _gpu_lock:  # serialize GPU access
            out_dir = os.path.join(RUN_ROOT, job_id)
            result = BB.run(smiles, gene, SAMPLES, out_dir)
        with _jobs_lock:
            _jobs[job_id].update(status="done" if result.get("ok") else "error", result=result)
        if result.get("ok"):
            _disk_cache[key(smiles, gene)] = result
            json.dump(_disk_cache, open(CACHE_FILE, "w"))
    except Exception:
        with _jobs_lock:
            _jobs[job_id].update(status="error", error=traceback.format_exc()[-1500:])

@app.route("/health")
def health():
    return jsonify(ok=True, samples=SAMPLES, cached=len(_disk_cache))

@app.route("/api/bind", methods=["POST", "GET"])
def bind():
    if request.method == "GET":
        smiles = request.args.get("smiles", ""); gene = request.args.get("gene", "")
        hit = _disk_cache.get(key(smiles, gene))
        return (jsonify(status="done", result=hit) if hit
                else (jsonify(status="miss"), 404))
    body = request.get_json(force=True, silent=True) or {}
    smiles, gene = body.get("smiles", "").strip(), body.get("gene", "").strip()
    if not smiles or not gene:
        return jsonify(error="smiles and gene are required"), 400
    if not Chem.MolFromSmiles(smiles):
        return jsonify(error="invalid SMILES"), 400
    k = key(smiles, gene)
    if k in _disk_cache:                       # instant cache hit
        return jsonify(job_id=k, status="done", result=_disk_cache[k])
    with _jobs_lock:
        if k in _jobs and _jobs[k]["status"] in ("queued", "running"):
            return jsonify(job_id=k, status=_jobs[k]["status"])
        _jobs[k] = {"status": "queued", "result": None, "error": None}
    threading.Thread(target=_worker, args=(k, smiles, gene), daemon=True).start()
    return jsonify(job_id=k, status="queued")

@app.route("/api/bind/<job_id>")
def bind_status(job_id):
    with _jobs_lock:
        j = _jobs.get(job_id)
    if not j:
        hit = next((v for kk, v in _disk_cache.items() if kk == job_id), None)
        return (jsonify(status="done", result=hit) if hit else (jsonify(status="unknown"), 404))
    return jsonify(status=j["status"], result=j.get("result"), error=j.get("error"))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5005)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    print(f"boltz-bind API on {a.host}:{a.port}  (samples={SAMPLES}, cached={len(_disk_cache)})")
    app.run(host=a.host, port=a.port, threaded=True)
