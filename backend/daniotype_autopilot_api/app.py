"""daniotype_kasperov persistent auto-pilot worker.

Runs the AutoPilot Cluster Labeller server-side so it survives the browser
closing. It drives the SAME labelling loop the client does, but headlessly: for
each cluster it calls the DEPLOYED Vercel endpoints (/api/kasperov_agent and
/api/kasperov_score), so all secrets (OpenAI, AWS) stay on Vercel — this box
holds none. When the run finishes it POSTs the combined run JSON to
/api/kasperov_runs, which lands it in "Load Previous Run".

Run:  uvicorn app:app --host 127.0.0.1 --port 5008
Auth: every request must carry  x-api-token: $AUTOPILOT_API_TOKEN
Env:  AUTOPILOT_BASE_URL (default https://www.zeroshot.bio) — the deployed app.
"""
import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

TOKEN = os.environ.get("AUTOPILOT_API_TOKEN", "")
DEFAULT_BASE = os.environ.get("AUTOPILOT_BASE_URL", "https://www.zeroshot.bio").rstrip("/")
AUTO_MAX_ROUNDS = 4
SCORE_TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
PRICES = {"gpt-5-mini": (0.25, 2.0), "gpt-5": (1.25, 10.0)}

app = FastAPI(title="daniotype-autopilot")
RUNS: dict = {}  # runId -> status dict


def _auth(tok):
    if not TOKEN or tok != TOKEN:
        raise HTTPException(status_code=401, detail="bad token")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _price(model):
    if model in PRICES:
        return PRICES[model], False
    if "nano" in model:
        return (0.05, 0.4), True
    if "mini" in model:
        return (0.25, 2.0), True
    return (1.25, 10.0), True


def _est_cost(usage):
    usd, est = 0.0, False
    for m, u in usage.items():
        (pin, pout), e = _price(m)
        usd += u.get("in", 0) / 1e6 * pin + u.get("out", 0) / 1e6 * pout
        est = est or e
    return round(usd, 4), est


# --- prompts (ported from KasperovClient.tsx) ------------------------------
def default_prompt(c):
    up = ", ".join((c.get("degsUp") or [])[:8])
    return (
        f"{c['label']}'s top up-regulated markers are: {up or '(none)'}. "
        "Using ZFIN curated expression, ZFA anatomy, and GO, identify the most likely zebrafish cell type "
        "(with state if the markers support it), grounding each claim in a cited record. If the evidence is ambiguous, say so."
    )


def second_opinion_prompt(c):
    up = ", ".join((c.get("degsUp") or [])[:8])
    return (
        f"Independent second opinion for {c['label']}. Its top up-regulated markers are: {up or '(none)'}. "
        "Assume NO prior conclusion. Name at least one ALTERNATIVE cell-type hypothesis besides the most obvious one and weigh them "
        "against each other using ZFIN curated expression, ZFA anatomy, and GO, citing a record for each claim. "
        "If the markers are ambiguous between identities, say which and why, and which tier (germ layer / tissue / cell type) is the deepest you can defend."
    )


AUTO_REASON_PROMPT = (
    "You have TWO independent Researcher reads of this cluster above (a default read and an alternative-hypothesis read). "
    "Reconcile them: where they agree, that's strong; where they disagree, resolve it with the evidence. If the specialists are "
    "exhausted and the (identity, state) is settled, conclude with a kasperov-conclude block — citing markers that are actually in "
    "THIS cluster's marker list; if you cannot ground a specific cell type, set decision \"abstain\" and name the deepest tier you can defend. "
    "Otherwise dispatch the single most useful next query (kasperov-dispatch)."
)
AUTO_NUDGE_PROMPT = (
    "Decide now — do not ask me. Either conclude with a kasperov-conclude block (assign if the identity is grounded in this cluster's "
    "markers, or abstain at the deepest defensible tier if not) or dispatch the next query with a kasperov-dispatch block."
)


# --- conclude parsing + cite-discipline (ported) ---------------------------
def parse_conclude(text):
    m = re.search(r"(?:```)?\s*kasperov-conclude\s*", text, re.I)
    if not m:
        return None
    start = text.find("{", m.end())
    if start == -1:
        return None
    depth, end = 0, -1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return None
    try:
        o = json.loads(text[start : end + 1])
    except Exception:
        return None
    if not isinstance(o, dict):
        return None
    if isinstance(o.get("identity"), str):
        return o
    if isinstance(o.get("label"), str):  # legacy
        return {"identity": o["label"], "decision": "assign", "done": o.get("done", True), "cited_markers": []}
    return None


def format_label(c):
    ident = (c.get("identity") or "").strip()
    if c.get("decision") == "abstain":
        return f"{ident or 'unresolved'} (abstained · {c.get('tier', 'tier')})"
    state = c.get("state")
    if state and str(state).lower() != "none":
        return f"{ident} · {state}"
    return ident


def enforce_cite(concl, cluster):
    universe = {str(g).lower() for g in (cluster.get("degsUp") or [])}
    cited = [g for g in (concl.get("cited_markers") or []) if str(g).lower() in universe]
    if concl.get("decision") == "assign" and not cited:
        concl = {**concl, "decision": "abstain"}
    return format_label(concl)


# --- the deployed Vercel endpoints -----------------------------------------
def _agent(base, dataset_id, model, cluster, messages, mode, usage):
    body = {
        "dataset": dataset_id,
        "model": model,
        "cluster": {"id": cluster["id"], "label": cluster["label"], "degsUp": cluster.get("degsUp", []),
                    "markers": cluster.get("markers", []), "nCells": cluster.get("nCells")},
        "messages": messages,
        "mode": mode,
    }
    text = ""
    with requests.post(f"{base}/api/kasperov_agent", json=body, stream=True, timeout=120) as r:
        r.raise_for_status()
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            try:
                evt = json.loads(raw[5:].strip())
            except Exception:
                continue
            t = evt.get("t")
            if t == "text":
                text += evt.get("v", "")
            elif t == "usage":
                v = evt.get("v", {})
                mu = usage.setdefault(v.get("model", model), {"in": 0, "out": 0})
                mu["in"] += v.get("in", 0) or 0
                mu["out"] += v.get("out", 0) or 0
    return text


def run_one_cluster(base, dataset_id, model, cluster, usage):
    p1 = _agent(base, dataset_id, model, cluster, [{"role": "user", "content": default_prompt(cluster)}], "research", usage)
    p2 = _agent(base, dataset_id, model, cluster, [{"role": "user", "content": second_opinion_prompt(cluster)}], "research", usage)
    conv = [
        {"role": "user", "content": default_prompt(cluster)},
        {"role": "assistant", "content": p1},
        {"role": "user", "content": "Independent second read (alternative-hypothesis pass) for the same cluster:"},
        {"role": "assistant", "content": p2},
    ]
    for _ in range(AUTO_MAX_ROUNDS):
        conv = conv + [{"role": "user", "content": AUTO_REASON_PROMPT}]
        rc = _agent(base, dataset_id, model, cluster, conv, "reason", usage)
        conv = conv + [{"role": "assistant", "content": rc}]
        concl = parse_conclude(rc)
        if not concl:
            conv = conv + [{"role": "user", "content": AUTO_NUDGE_PROMPT}]
            rc = _agent(base, dataset_id, model, cluster, conv, "reason", usage)
            conv = conv + [{"role": "assistant", "content": rc}]
            concl = parse_conclude(rc)
        if concl and concl.get("done", True):
            return enforce_cite(concl, cluster), conv
    return "(unresolved — review)", conv


def score_clusters(base, dataset_id, model, labelled, gt, usage):
    verdicts = {}
    items = []
    for c in labelled:
        rec = (gt or {}).get(c["id"], {})
        items.append({
            "id": c["id"], "ourLabel": c["finalLabel"], "markers": c.get("degsUp", []),
            "gt": {k: (rec.get(k) or {}).get("label") for k in SCORE_TIERS},
        })
    for i in range(0, len(items), 10):
        batch = items[i : i + 10]
        try:
            r = requests.post(f"{base}/api/kasperov_score", json={"dataset": dataset_id, "model": model, "items": batch}, timeout=120)
            r.raise_for_status()
            d = r.json()
            u = d.get("usage")
            if u:
                mu = usage.setdefault(u.get("model", model), {"in": 0, "out": 0})
                mu["in"] += u.get("in", 0) or 0
                mu["out"] += u.get("out", 0) or 0
            for res in d.get("results", []):
                if res.get("id"):
                    verdicts[res["id"]] = res
        except Exception:
            pass
    # per-tier aggregate
    agg = []
    for k in SCORE_TIERS:
        matched = total = 0
        for c in labelled:
            v = verdicts.get(c["id"])
            ref = ((gt or {}).get(c["id"], {}).get(k) or {}).get("label")
            if not v or not ref:
                continue
            total += 1
            if v.get(k, {}).get("match"):
                matched += 1
        label = {"germ_layer": "Germ layer", "tissue": "Tissue", "cell_type_broad": "Cell type — broad", "cell_type_sub": "Cell type — sub"}[k]
        agg.append({"key": k, "label": label, "matched": matched, "total": total, "pct": (100 * matched / total) if total else 0})
    return verdicts, agg


DATA_URL = {
    "minifin": "/daniotype_kasperov/minifin_umap.json",
}
GT_URL = {}


def data_url(ds):
    return DATA_URL.get(ds, f"/daniotype_kasperov/datasets/{ds}/umap.json")


def gt_url(ds):
    if ds == "minifin":
        return None
    return f"/daniotype_kasperov/datasets/{ds}/groundtruth.json"


def _run(run_id, dataset_id, model, base):
    st = RUNS[run_id]
    usage = {}
    try:
        st.update(phase="loading", message="loading atlas")
        atlas = requests.get(f"{base}{data_url(dataset_id)}", timeout=60).json()
        clusters = [{"id": c["id"], "label": c["label"], "degsUp": c.get("degsUp", []),
                     "markers": c.get("markers", []), "nCells": c.get("nCells")} for c in atlas["clusters"]]
        gt = None
        gu = gt_url(dataset_id)
        if gu:
            try:
                gt = requests.get(f"{base}{gu}", timeout=60).json().get("clusters")
            except Exception:
                gt = None

        st.update(phase="labelling", total=len(clusters), done=0)
        for i, c in enumerate(clusters):
            if st.get("abort"):
                st.update(phase="aborted")
                return
            st.update(current=c["id"], done=i)
            try:
                label, _conv = run_one_cluster(base, dataset_id, model, c, usage)
            except Exception as e:  # noqa: BLE001
                label = "(error — skipped)"
                st.setdefault("errors", []).append(f"{c['id']}: {e}")
            c["finalLabel"] = label
        st.update(done=len(clusters))

        labelled = [c for c in clusters if c.get("finalLabel") and "error" not in c["finalLabel"]]
        verdicts, agg, scored_at = {}, [], None
        if gt:
            st.update(phase="scoring")
            verdicts, agg = score_clusters(base, dataset_id, model, labelled, gt, usage)
            scored_at = _now()

        st.update(phase="saving")
        usd, est = _est_cost(usage)
        run_json = {
            "schema": "daniotype_kasperov_run/v1",
            "dataset": atlas.get("source", dataset_id),
            "datasetId": dataset_id,
            "model": model,
            "cost": {"usd": usd, "estimated": est, "usage": usage},
            "exportedAt": _now(),
            "scoredAt": scored_at,
            "nLabelled": len(labelled),
            "nValidated": len(labelled),
            "source": "server",
            "clusters": [
                {"id": c["id"], "label": c["label"], "validated": True, "finalLabel": c.get("finalLabel"),
                 "confidence": None, "addedMarkers": [], "transcript": []}
                for c in clusters
            ],
            "groundTruth": ({"scoredAt": scored_at, "aggregate": agg, "verdicts": verdicts} if gt else None),
        }
        save = requests.post(f"{base}/api/kasperov_runs", json=run_json, timeout=60)
        st.update(phase="done", saved=save.ok, runSaved=(save.json().get("runId") if save.ok else None), cost=usd)
    except Exception as e:  # noqa: BLE001
        st.update(phase="error", error=str(e)[:300])


class StartReq(BaseModel):
    datasetId: str
    model: str = "gpt-5-mini"
    baseUrl: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True, "active": sum(1 for r in RUNS.values() if r.get("phase") in ("labelling", "scoring", "saving", "loading"))}


@app.post("/start")
def start(req: StartReq, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    run_id = uuid.uuid4().hex[:12]
    RUNS[run_id] = {"runId": run_id, "datasetId": req.datasetId, "model": req.model, "phase": "queued", "done": 0, "total": 0, "startedAt": _now()}
    base = (req.baseUrl or DEFAULT_BASE).rstrip("/")
    threading.Thread(target=_run, args=(run_id, req.datasetId, req.model, base), daemon=True).start()
    return {"runId": run_id}


@app.get("/status/{run_id}")
def status(run_id: str, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    st = RUNS.get(run_id)
    if not st:
        raise HTTPException(status_code=404, detail="unknown run")
    return st


@app.post("/abort/{run_id}")
def abort(run_id: str, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    if run_id in RUNS:
        RUNS[run_id]["abort"] = True
    return {"ok": True}
