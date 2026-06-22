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
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import Body, FastAPI, Header, HTTPException
from pydantic import BaseModel

TOKEN = os.environ.get("AUTOPILOT_API_TOKEN", "")
DEFAULT_BASE = os.environ.get("AUTOPILOT_BASE_URL", "https://www.zeroshot.bio").rstrip("/")
# Misalignment guard: before a run grounds on :5007 for a dataset, assert the service serves
# THAT dataset (not another's) — count bound + each sampled cluster's own top marker enriched in
# that cluster. Catches the ba32de failure mode (ChemFish served MiniFin's 54-cluster stats).
STATS_VERIFY_URL = os.environ.get("STATS_VERIFY_URL", "http://127.0.0.1:5007").rstrip("/")
STATS_VERIFY_TOKEN = os.environ.get("STATS_VERIFY_TOKEN", "")
# The wizard's Next routes are Basic-Auth gated; this worker authenticates with the
# same shared password (KASPEROV_BASIC_PASSWORD) so its server-to-server calls pass.
import base64 as _b64
_BASIC_PW = os.environ.get("KASPEROV_BASIC_PASSWORD", "")
_BASIC_AUTH = ("Basic " + _b64.b64encode(("autopilot:" + _BASIC_PW).encode()).decode()) if _BASIC_PW else ""
def _hdrs(extra=None):
    h = dict(extra or {})
    if _BASIC_AUTH:
        h["Authorization"] = _BASIC_AUTH
    return h
# completed runs are stored on the EC2 EBS volume (no S3 needed for the POC)
RUNS_DIR = os.environ.get("AUTOPILOT_RUNS_DIR", "/data/daniotype_runs")
_index_lock = threading.Lock()
AUTO_MAX_ROUNDS = 4
SCORE_TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
TIER_LABELS = {"germ_layer": "Germ layer", "tissue": "Tissue", "cell_type_broad": "Cell type — broad", "cell_type_sub": "Cell type — sub"}


# --- driver-scoring helpers (benchmark scores the kasperov-conclude label, NOT the
# confidence side-channel; abstention is credited at the tier reached) ----------
def _norm_tier(s):
    s = (s or "").lower().strip()
    if "germ" in s: return 0
    if "tissue" in s: return 1
    if "broad" in s: return 2
    if "sub" in s: return 3
    if "cell type" in s or "cell_type" in s: return 2  # bare "cell type" -> broad
    return None


def _parse_driver(final_label):
    """The kasperov-conclude label that gets persisted as the assignment ->
    (identity, reached_idx, kind). reached_idx 0..3 = deepest tier the driver stands
    behind; -1 = incomplete. kind = assign | abstain | unresolved. Pure string parse;
    does NOT touch the reasoning loop."""
    fl = (final_label or "").strip()
    m = re.search(r"\(abstain(?:ed)?\s*[·:\-]\s*([^)]+)\)", fl, re.I)
    if m:
        idx = _norm_tier(m.group(1))
        return fl[:m.start()].strip(), (idx if idx is not None else 1), "abstain"
    if not fl or "unresolved" in fl.lower():
        return "", -1, "unresolved"
    return fl, 3, "assign"


def _attempted(reached_idx, kind, tier_idx):
    return False if kind == "unresolved" else tier_idx <= reached_idx
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


# --- disk-backed run store (EBS volume) ------------------------------------
def _safe(s):
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", str(s or "unknown"))


def _ds_dir(dataset):
    d = os.path.join(RUNS_DIR, _safe(dataset))
    os.makedirs(d, exist_ok=True)
    return d


def _meta_from(run, run_id):
    cost = run.get("cost") or {}
    return {
        "runId": run_id,
        "dataset": run.get("dataset", run.get("datasetId")),
        "datasetId": run.get("datasetId"),
        "model": run.get("model", "?"),
        "costUsd": float(cost.get("usd", 0) or 0),
        "costEstimated": bool(cost.get("estimated")),
        "exportedAt": run.get("exportedAt"),
        "harness": run.get("harness"),
        "scoredAt": run.get("scoredAt"),
        "nLabelled": int(run.get("nLabelled", 0) or 0),
        "nValidated": int(run.get("nValidated", 0) or 0),
        "hasGroundTruth": bool(run.get("groundTruth")),
        "source": run.get("source", "server"),
        "note": run.get("note") or None,  # free-text "what's special about this run"
    }


def save_run(run):
    dataset = run.get("datasetId") or "unknown"
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    d = _ds_dir(dataset)
    with open(os.path.join(d, run_id + ".json"), "w") as f:
        json.dump(run, f)
    idx_path = os.path.join(d, "_index.json")
    with _index_lock:
        try:
            idx = json.load(open(idx_path)) if os.path.exists(idx_path) else []
        except Exception:
            idx = []
        idx.insert(0, _meta_from(run, run_id))
        json.dump(idx[:500], open(idx_path, "w"))
    return run_id


def _archive_category(reason):
    """Classify a free-text archivedReason into a viewer badge category.
    Contamination MUST win over everything else (a quarantined run must never
    read as evidence). Mirrors classifyArchiveReason() in completeness.ts."""
    r = (reason or "").strip().lower()
    if not r:
        return "other"
    if re.search(r"contaminat|quarantin|leak|poison|corrupt|invalid|tainted", r):
        return "quarantined"
    if re.search(r"supersed|parked|revert|replaced|preserved|stale|deprecat|superseding", r):
        return "superseded"
    return "other"


def _read_index(path):
    try:
        return json.load(open(path)) if os.path.exists(path) else []
    except Exception:
        return []


def list_runs(dataset, include_archived=False):
    d = _ds_dir(dataset)
    runs = list(_read_index(os.path.join(d, "_index.json")))
    if include_archived:
        for e in _read_index(os.path.join(d, "_archive.json")):
            e = dict(e)
            e["archived"] = True
            e["archiveCategory"] = _archive_category(e.get("archivedReason"))
            runs.append(e)
    return runs


def get_run(dataset, run_id):
    p = os.path.join(_ds_dir(dataset), _safe(run_id) + ".json")
    if not os.path.exists(p):
        return None
    return json.load(open(p))


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


# Byte-for-byte the browser's AUTO_REASON_PROMPT (KasperovClient.tsx) — archivist-aware.
AUTO_REASON_PROMPT = (
    "You have TWO independent Researcher reads of this cluster above (a default read and an alternative-hypothesis read) "
    "AND the Archivist's raw ground-truth stats for the top markers. Reconcile the literature reads AGAINST the raw numbers: "
    "where they agree, that's strong; where they disagree, resolve it with the Archivist's stats (which marker is actually the "
    "most enriched / most specific?). If a discussed gene's DEG score still matters and the Archivist hasn't reported it, dispatch "
    "the Archivist for it. If the specialists are exhausted, the raw stats are confirmed, and the (identity, state) is settled, "
    "conclude with a kasperov-conclude block — citing markers that are actually in THIS cluster's marker list; if you cannot ground "
    "a specific cell type, set decision \"abstain\" and name the deepest tier you can defend. Otherwise dispatch the single most "
    "useful next query (kasperov-dispatch), preferring the Archivist when raw numbers are still missing."
)
AUTO_NUDGE_PROMPT = (
    "Decide now — do not ask me. Either conclude with a kasperov-conclude block (assign if the identity is grounded in this cluster's "
    "markers, or abstain at the deepest defensible tier if not) or dispatch the next query with a kasperov-dispatch block."
)


# === v2 harness rewrite — Step 1: GT-blind per-leaf context assembly =========
# CONTEXT_FIELDS is the ONLY set of cluster keys the roles may see: pipeline-derived
# markers / size / compartment / distinctiveness. GT-derived keys (label, tissue,
# cell_type*, germ_layer, frac, purity, recall, F1, flag) are excluded STRUCTURALLY —
# assemble_leaf_context() projects the cluster onto CONTEXT_FIELDS and never reads any
# other key, so a leak cannot occur by construction (not a conditional blank).
CONTEXT_FIELDS = ("id", "nCells", "compartment", "base_rate",
                  "n_enriched_markers", "low_n", "degsUp", "markers", "markersDown")
_GT_KEYS = {"label", "tissue", "cell_type", "cell_type_broad", "cell_type_sub",
            "germ_layer", "frac", "purity", "recall", "F1", "flag", "name", "annotation", "gt"}
DATASET_STAGE = {"zscape_v2": "48 hpf"}


def assemble_leaf_context(cluster, dataset_id):
    """Build the role-facing, GT-blind context text for one v2 leaf.

    Reads ONLY the whitelisted pipeline fields (markers, size, parent compartment,
    within-compartment distinctiveness, low-n flag) plus the dataset developmental
    stage. It never touches label/tissue/cell_type/germ_layer or any GT field —
    the projection `s` below is the structural leak wall (id stays as the neutral
    display name "Cluster {id}"; it is not a GT label)."""
    s = {k: cluster.get(k) for k in CONTEXT_FIELDS}          # <- structural leak wall
    assert not (set(s) & _GT_KEYS), "leak wall breached: GT key entered context projection"
    stage = DATASET_STAGE.get(dataset_id, "unknown stage")
    up = s.get("degsUp") or []
    mk = s.get("markers") or []
    dn = s.get("markersDown") or []

    def _tbl(rows):
        return "; ".join(
            f"{m.get('g')} (log2FC {m.get('l2fc')}, %in {m.get('p1')}, %out {m.get('p2')})"
            for m in rows
        ) or "(none)"

    lines = [
        f"Cluster {s['id']} — de-novo recursive leaf, ZSCAPE {stage}.",
        f"Size: {s['nCells']} cells. Parent compartment: {s['compartment']}. "
        f"Fraction within that compartment (base rate): {s['base_rate']}.",
        f"Within-compartment distinctiveness — n_enriched_markers "
        f"(genes with log2FC>=1 & %in>=0.25 vs rest of compartment): {s['n_enriched_markers']}."
        + ("  [LOW-N: <30 cells — statistics are unreliable; weak evidence to name.]"
           if s.get("low_n") else ""),
        f"Top up-regulated markers: {', '.join(up) if up else '(none)'}.",
        f"Up-marker stats: {_tbl(mk)}.",
        f"Top down-regulated markers: {_tbl(dn)}.",
    ]
    return "\n".join(lines)


# === v2 harness rewrite — Step 2: Reasoner distinctiveness gate ==============
# Distinctiveness gates BEFORE identity. The gate reads only GT-blind context fields
# (n_enriched_markers, low_n) to decide how DEEP to commit; identity is then resolved
# only at the committed depth. Low distinctiveness is positive evidence to abstain
# shallow — not a failure.
GATE_CONT_THRESH = 15          # n_enriched_markers <= this => low-distinctiveness / continuum
_TIER_WORD = {"cell_type": "cell type", "tissue": "tissue", "germ_layer": "germ layer"}


def _route_depth(cluster):
    """GT-blind routing: (commit_depth, abstain_reason|None). low_n takes precedence
    over distinctiveness (a 6-cell sliver with strong markers is still untrustworthy)."""
    if cluster.get("low_n"):
        return "tissue", "n_limited"
    if (cluster.get("n_enriched_markers") or 0) <= GATE_CONT_THRESH:
        return "tissue", "continuum"
    return "cell_type", None


def _gate_prompt(ctx, tier_word, reason):
    pre = (
        "You are the Reasoner in a ground-truth-BLIND zebrafish cell-type labeller. "
        "Below is one single-cell cluster's GT-blind context (markers + within-compartment "
        "distinctiveness + size). Distinctiveness has ALREADY gated the commit depth to "
        f"{tier_word.upper()} — do not go deeper.\n"
    )
    if reason == "continuum":
        pre += ("This cluster has near-zero within-compartment distinctiveness (n_enriched_markers≈0): "
                "it sits on a continuum with its compartment neighbours, so a shallow call is CORRECT, not a failure.\n")
    elif reason == "n_limited":
        pre += ("This cluster has <30 cells: its fine statistics are untrustworthy. Do NOT make a fine call "
                "no matter how strong the markers look — commit only at the gated depth.\n")
    return (pre +
            f"From the MARKERS ONLY, infer the single most defensible zebrafish identity at EXACTLY the "
            f"{tier_word} level (no deeper). Reply with ONLY JSON: "
            f'{{"identity":"<name at {tier_word} level>"}}.\n\n' + ctx)


def _parse_identity(text):
    m = re.search(r'\{[^{}]*"identity"\s*:\s*"([^"]+)"[^{}]*\}', text or "", re.S)
    if m:
        return m.group(1).strip()
    return (text or "").strip().splitlines()[-1].strip() if text else ""


def reason_gate(cluster, dataset_id, llm):
    """Focused Reasoner step: assembled-context in -> {commit_depth, abstain_reason,
    driver_string, identity}. `llm(prompt)->(text, usage)` is injected. Driver is emitted
    in the exact form _parse_driver expects (assign = bare identity; abstain = '<id> (abstain · <tier>)')."""
    ctx = assemble_leaf_context(cluster, dataset_id)
    depth, reason = _route_depth(cluster)
    tier_word = _TIER_WORD[depth]
    text, usage = llm(_gate_prompt(ctx, tier_word, reason))
    identity = _parse_identity(text)
    driver = identity if reason is None else f"{identity} (abstain · {tier_word})"
    return {"commit_depth": depth, "abstain_reason": reason,
            "identity": identity, "driver_string": driver, "usage": usage}


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


# --- dispatch parsing (mirrors extractTagged + splitDispatch in KasperovClient.tsx) ---
def _extract_tagged(text, keyword):
    m = re.search(r"(?:```)?\s*" + re.escape(keyword) + r"\s*", text, re.I)
    if not m:
        return None
    after = m.end()
    ai = text.find("[", after)
    oi = text.find("{", after)
    if ai != -1 and (oi == -1 or ai < oi):
        start, open_, close = ai, "[", "]"
    elif oi != -1:
        start, open_, close = oi, "{", "}"
    else:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == open_:
            depth += 1
        elif text[i] == close:
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except Exception:
                    return None
    return None


def parse_dispatch(text):
    raw = _extract_tagged(text, "kasperov-dispatch")
    if raw is None:
        return []
    arr = raw if isinstance(raw, list) else [raw]
    seen, out = set(), []
    for x in arr:
        if not isinstance(x, dict) or not isinstance(x.get("prompt"), str):
            continue
        to = "archivist" if x.get("to") == "archivist" else "research"
        k = to + ":" + x["prompt"]
        if k in seen:
            continue
        seen.add(k)
        out.append({"to": to, "prompt": x["prompt"]})
        if len(out) >= 2:  # never flood (matches client .slice(0,2))
            break
    return out


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
    with requests.post(f"{base}/api/kasperov_agent", json=body, headers=_hdrs(), stream=True, timeout=305) as r:
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


def get_confidence(base, dataset_id, model, cluster, conv, usage):
    """Per-tier characterization (germ_layer/tissue/broad/sub: prediction+pct)."""
    try:
        r = requests.post(
            f"{base}/api/kasperov_confidence",
            json={"dataset": dataset_id, "model": model, "cluster": {"id": cluster["id"], "label": cluster["label"]}, "messages": conv},
            headers=_hdrs(),
            timeout=130,
        )
        if not r.ok:
            return None
        d = r.json()
        u = d.get("usage")
        if u:
            mu = usage.setdefault(u.get("model", model), {"in": 0, "out": 0})
            mu["in"] += u.get("in", 0) or 0
            mu["out"] += u.get("out", 0) or 0
        t = d.get("tiers")
        if t and t.get("germ_layer"):
            return {**t, "why": d.get("why", "")}
    except Exception:
        pass
    return None


def run_one_cluster(base, dataset_id, model, cluster, usage):
    # FULL pipeline — byte-for-byte the browser runOneCluster: K=2 independent Researcher
    # proposers, then a one-shot ARCHIVIST verification pass (raw DEG stats), then the
    # Reasoner-orchestrated rounds that adjudicate AND execute kasperov-dispatch follow-ups.
    p1 = _agent(base, dataset_id, model, cluster, [{"role": "user", "content": default_prompt(cluster)}], "research", usage)
    p2 = _agent(base, dataset_id, model, cluster, [{"role": "user", "content": second_opinion_prompt(cluster)}], "research", usage)
    # Archivist verification pass — pull this cluster's raw numbers for the top markers
    top = ", ".join((cluster.get("degsUp") or [])[:6]) or ", ".join((m.get("g") or "") for m in (cluster.get("markers") or [])[:6])
    arch_prompt = (
        f"Pull this cluster's raw DEG stats for its top markers ({top}): exact log2FC, %in/out, "
        "BH-adjusted p-value, and cross-cluster specificity. Return the full per-gene table so we can "
        "confirm which are the strongest, most specific markers."
    )
    arch = _agent(base, dataset_id, model, cluster, [{"role": "user", "content": arch_prompt}], "archivist", usage)
    conv = [
        {"role": "user", "content": default_prompt(cluster)},
        {"role": "assistant", "content": p1},
        {"role": "user", "content": "Independent second read (alternative-hypothesis pass) for the same cluster:"},
        {"role": "assistant", "content": p2},
        {"role": "user", "content": "Archivist raw-data verification of the top markers (ground-truth stats):"},
        {"role": "assistant", "content": arch},
    ]
    for _ in range(AUTO_MAX_ROUNDS):
        conv = conv + [{"role": "user", "content": AUTO_REASON_PROMPT}]
        rc = _agent(base, dataset_id, model, cluster, conv, "reason", usage)
        conv = conv + [{"role": "assistant", "content": rc}]
        concl = parse_conclude(rc)
        dispatches = parse_dispatch(rc)
        if not concl and not dispatches:
            conv = conv + [{"role": "user", "content": AUTO_NUDGE_PROMPT}]
            rc = _agent(base, dataset_id, model, cluster, conv, "reason", usage)
            conv = conv + [{"role": "assistant", "content": rc}]
            concl = parse_conclude(rc)
            dispatches = parse_dispatch(rc)
        if concl and concl.get("done", True):
            return enforce_cite(concl, cluster), conv
        for d in dispatches:  # execute the Reasoner's follow-up queries (Archivist / Researcher)
            rc2 = _agent(base, dataset_id, model, cluster, conv + [{"role": "user", "content": d["prompt"]}], d["to"], usage)
            conv = conv + [{"role": "user", "content": d["prompt"]}, {"role": "assistant", "content": rc2}]
    return "(unresolved — review)", conv


def score_clusters(base, dataset_id, model, labelled, gt, usage):
    # DRIVER-SCORING: judge the kasperov-conclude identity (the label actually persisted
    # as the cluster's assignment) at each tier — NOT the confidence side-channel. The
    # single driver identity is sent for every tier; the LLM judge decides equivalence at
    # each tier's granularity. Abstention is credited at the tier reached: tiers finer than
    # the driver's stand are NOT-ATTEMPTED (dropped from the denominator, never a miss).
    verdicts = {}
    drv = {}  # id -> (identity, reached_idx, kind)
    items = []
    for c in labelled:
        rec = (gt or {}).get(c["id"], {})
        ident, reached, kind = _parse_driver(c.get("finalLabel"))
        drv[c["id"]] = (ident, reached, kind)
        pred = ident or (c.get("finalLabel") or "")
        items.append({
            "id": c["id"], "ourLabel": c.get("finalLabel"), "markers": c.get("degsUp", []),
            "predictions": {k: pred for k in SCORE_TIERS},  # the one driver identity, judged per tier
            "gt": {k: (rec.get(k) or {}).get("label") for k in SCORE_TIERS},
        })
    for i in range(0, len(items), 10):
        batch = items[i : i + 10]
        try:
            r = requests.post(f"{base}/api/kasperov_score", json={"dataset": dataset_id, "model": model, "items": batch}, headers=_hdrs(), timeout=305)
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

    def _ref(cid, k):
        return ((gt or {}).get(cid, {}).get(k) or {}).get("label")

    def _frac(cid, k):
        return float(((gt or {}).get(cid, {}).get(k) or {}).get("frac") or 0)

    # per-tier aggregate, abstention-credited denominators
    agg = []
    for ti, k in enumerate(SCORE_TIERS):
        matched = total = 0
        for c in labelled:
            v = verdicts.get(c["id"]); _, reached, kind = drv[c["id"]]
            if not v or not _ref(c["id"], k) or not _attempted(reached, kind, ti):
                continue
            total += 1
            if v.get(k, {}).get("match"):
                matched += 1
        agg.append({"key": k, "label": TIER_LABELS[k], "matched": matched, "total": total, "pct": (100 * matched / total) if total else 0})

    # purity-stratified cell_type_sub (attempted-sub only); headline = high-purity
    hi = lo = hin = lon = 0; wnum = wden = 0.0
    for c in labelled:
        v = verdicts.get(c["id"]); _, reached, kind = drv[c["id"]]
        if not v or not _attempted(reached, kind, 3) or not _ref(c["id"], "cell_type_sub"):
            continue
        f = _frac(c["id"], "cell_type_sub")
        m = 1 if v.get("cell_type_sub", {}).get("match") else 0
        wnum += m * f; wden += f
        if f >= 0.5: hin += 1; hi += m
        else: lon += 1; lo += m
    sub_strat = {
        "headline": "high_purity",
        "high": {"matched": hi, "total": hin, "pct": (100 * hi / hin) if hin else 0},
        "low": {"matched": lo, "total": lon, "pct": (100 * lo / lon) if lon else 0},
        "raw": {"matched": hi + lo, "total": hin + lon, "pct": (100 * (hi + lo) / (hin + lon)) if (hin + lon) else 0},
        "weighted_pct": (100 * wnum / wden) if wden else 0,
    }

    # abstention precision: among abstained clusters, fraction whose FORCED sub-call would
    # have failed (driver identity judged at sub = miss), vs the same on assigned clusters.
    def _forced_fail(kindsel):
        fail = tot = 0
        for c in labelled:
            v = verdicts.get(c["id"]); _, _, kind = drv[c["id"]]
            if kind != kindsel or not v or not _ref(c["id"], "cell_type_sub"):
                continue
            tot += 1
            if not v.get("cell_type_sub", {}).get("match"):
                fail += 1
        return {"fail": fail, "total": tot, "pct": (100 * fail / tot) if tot else 0}

    abstention = {
        "n_assign": sum(1 for c in labelled if drv[c["id"]][2] == "assign"),
        "n_abstain": sum(1 for c in labelled if drv[c["id"]][2] == "abstain"),
        "n_unresolved": sum(1 for c in labelled if drv[c["id"]][2] == "unresolved"),
        "abstained_forced_sub_fail": _forced_fail("abstain"),
        "assigned_forced_sub_fail": _forced_fail("assign"),
    }
    return verdicts, agg, sub_strat, abstention


# Wizard data is served from the auth-gated asset route (moved out of public/).
def data_url(ds):
    return f"/api/kasperov_asset/{ds}/umap.json"


def gt_url(ds):
    # datasets without published labels (no groundtruth.json)
    if ds in ("minifin", "megafin"):
        return None
    return f"/api/kasperov_asset/{ds}/groundtruth.json"


# Atlas/GT assets are normally fetched from the deployed asset route, but
# daniotype_data exceeded Vercel's 250MB function-bundle cap so the newest
# datasets 404 there. When AUTOPILOT_ASSET_DIR is set, read these JSON assets
# from the local filesystem (this box has daniotype_data/ on disk) and fall
# back to the deployed asset route otherwise.
ASSET_DIR = os.environ.get("AUTOPILOT_ASSET_DIR", "")


def _get_asset(base, ds, fname):
    if ASSET_DIR:
        p = os.path.join(ASSET_DIR, ds, fname)
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    return requests.get(f"{base}/api/kasperov_asset/{ds}/{fname}", headers=_hdrs(), timeout=60).json()


def verify_grounding(dataset_id, clusters):
    """Assert :5007 serves THIS dataset before we trust it (misalignment guard). Returns
    (ok, detail). Checks: (a) each of a few sampled clusters has its OWN top asset-marker
    enriched in that cluster on :5007 — a swapped dataset (e.g. minifin-for-chemfish) fails
    this; (b) cluster-count bound — an id one past the atlas max must NOT exist on :5007."""
    if not STATS_VERIFY_TOKEN:
        return (False, "grounding guard not configured (STATS_VERIFY_TOKEN unset) — refusing to run blind")
    hdr = {"x-api-token": STATS_VERIFY_TOKEN, "content-type": "application/json"}
    def pv(cid, gene):
        r = requests.post(f"{STATS_VERIFY_URL}/query", headers=hdr,
                          json={"dataset": dataset_id, "cluster": str(cid), "kind": "pvalues", "genes": [gene]}, timeout=60)
        return r.status_code, (r.json() if r.headers.get("content-type", "").startswith("application/json") else {})
    n = len(clusters)
    idxs = sorted(set([0, n // 2, n - 1]))
    fails = []
    for i in idxs:
        c = clusters[i]; gene = (c.get("degsUp") or [None])[0]
        if not gene:
            continue
        try:
            code, d = pv(c["id"], gene)
            if code != 200:
                fails.append(f"c{c['id']} HTTP {code}"); continue
            res = (d.get("result") or [{}])[0]
            l2 = res.get("log2FC"); p = res.get("padj"); nC = c.get("nCells") or 0
            # Alignment is shown by strong enrichment DIRECTION: a swapped dataset's "own" marker
            # lands near 0/negative (e.g. the ba32de minifin-for-chemfish artifact: log2FC=-0.669),
            # never log2FC>=1.0. padj significance is unreliable for tiny units (n<50 underpowered),
            # so require it only where there is power; below that, trust direction alone.
            enriched = bool(res.get("found")) and l2 is not None and l2 >= 1.0
            sig_ok = (p is not None and p <= 0.05) or nC < 50
            if not (enriched and sig_ok):
                fails.append(f"c{c['id']} (n={nC}) own top marker {gene} NOT enriched on :5007 (log2FC={l2}, padj={p}) — wrong dataset?")
        except Exception as e:
            fails.append(f"c{c['id']} probe error {str(e)[:50]}")
    # count bound: integer cluster ids 0..max → id max+1 must not exist
    try:
        ids = sorted(int(c["id"]) for c in clusters if str(c["id"]).isdigit())
        if ids:
            anchor = (clusters[0].get("degsUp") or ["pcna"])[0]
            code, d = pv(max(ids) + 1, anchor)
            if code == 200 and (d.get("nCells") or 0) > 0:
                fails.append(f"count mismatch: :5007 returned a cluster {max(ids)+1} beyond the atlas's {len(ids)} units")
    except Exception:
        pass
    if fails:
        return (False, "; ".join(fails))
    return (True, f"verified: {len(idxs)} sampled clusters' own markers enriched on :5007, count bounded to {n} units")


def _active_harness():
    """Stamp the run with the active harness (version + config commit) for provenance."""
    try:
        reg = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "src", "app", "daniotype_kasperov", "harness_registry.json")))
        h = next((x for x in reg.get("harnesses", []) if x.get("id") == reg.get("active")), None)
        if h:
            return {"id": h["id"], "version": h["version"], "name": h.get("name"), "gitCommit": h.get("gitCommit"), "stampedAt": h.get("stampedAt")}
    except Exception:
        pass
    return None


def _run(run_id, store_id, serve_id, model, base):
    # serve_id = the partition we LABEL (assets / :5007 grounding / agent calls, e.g. daniocell_native);
    # store_id = where the finished run is SAVED + listed (e.g. daniocell). They differ only when a run
    # is served from a sibling partition; otherwise store_id == serve_id (the default).
    dataset_id = serve_id
    st = RUNS[run_id]
    usage = {}
    try:
        st.update(phase="loading", message="loading atlas")
        atlas = _get_asset(base, dataset_id, "umap.json")
        clusters = [{"id": c["id"], "label": c["label"], "degsUp": c.get("degsUp", []),
                     "markers": c.get("markers", []), "nCells": c.get("nCells")} for c in atlas["clusters"]]
        gt = None
        gu = gt_url(dataset_id)
        if gu:
            try:
                gt = _get_asset(base, dataset_id, "groundtruth.json").get("clusters")
            except Exception:
                gt = None

        # Misalignment guard — verify :5007 serves THIS dataset before grounding/spending.
        st.update(phase="verifying", message="grounding guard")
        ok, detail = verify_grounding(dataset_id, clusters)
        if not ok:
            st.update(phase="error", error=f"GROUNDING GUARD FAILED ({dataset_id}): {detail}")
            return
        st.update(message=f"grounding ok — {detail}")

        st.update(phase="labelling", total=len(clusters), done=0)
        for i, c in enumerate(clusters):
            if st.get("abort"):
                st.update(phase="aborted")
                return
            st.update(current=c["id"], done=i)
            try:
                label, conv = run_one_cluster(base, dataset_id, model, c, usage)
                c["confidence"] = get_confidence(base, dataset_id, model, c, conv, usage)
                c["transcript"] = conv  # FULL per-cluster conversation (proposers/archivist/reason/dispatch)
            except Exception as e:  # noqa: BLE001
                label = "(error — skipped)"
                c["confidence"] = None
                c["transcript"] = c.get("transcript") or []
                st.setdefault("errors", []).append(f"{c['id']}: {e}")
            c["finalLabel"] = label
        st.update(done=len(clusters))

        labelled = [c for c in clusters if c.get("finalLabel") and "error" not in c["finalLabel"]]
        verdicts, agg, sub_strat, abstention, scored_at = {}, [], None, None, None
        if gt:
            st.update(phase="scoring")
            verdicts, agg, sub_strat, abstention = score_clusters(base, dataset_id, model, labelled, gt, usage)
            scored_at = _now()

        st.update(phase="saving")
        usd, est = _est_cost(usage)
        run_json = {
            "schema": "daniotype_kasperov_run/v1",
            "dataset": atlas.get("source", store_id),
            "datasetId": store_id,
            "model": model,
            "cost": {"usd": usd, "estimated": est, "usage": usage},
            "exportedAt": _now(),
            "scoredAt": scored_at,
            "nLabelled": len(labelled),
            "nValidated": len(labelled),
            "source": "server",
            "note": st.get("note") or None,  # optional free-text note attached after kickoff
            "harness": _active_harness(),  # which harness (judge/config version + commit) produced this run
            # run settings/parameters for future reproducibility ("what went into this run")
            "provenance": {
                "pipeline": "full-unified",  # K=2 Researcher proposers -> Archivist verification pass -> Reasoner rounds w/ dispatch
                "proposers": 2,
                "autoMaxRounds": AUTO_MAX_ROUNDS,
                "archivistPass": True,
                "dispatch": True,
                "citeDiscipline": True,
                "reasoningEffort": "low",
                "scoring": "driver/v2",  # driver-object scored, abstention-credited, high-purity sub headline
                "model": model,
                "atlasSource": atlas.get("source"),  # encodes the clustering recipe/partition
                "nClusters": len(clusters),
                # PROOF this run grounded on the RIGHT dataset's :5007 stats (the misalignment guard's pass record)
                "groundingGuard": {"verified": True, "detail": detail, "statsService": STATS_VERIFY_URL},
                "servedDataset": serve_id,  # partition actually labelled (may differ from datasetId/store)
                "baseUrl": base,
                "startedAt": st.get("startedAt"),
            },
            "clusters": [
                {"id": c["id"], "label": c["label"], "validated": True, "finalLabel": c.get("finalLabel"),
                 "confidence": c.get("confidence"), "addedMarkers": [], "transcript": c.get("transcript") or []}
                for c in clusters
            ],
            "groundTruth": ({"scoredAt": scored_at, "aggregate": agg, "verdicts": verdicts,
                             "subStratified": sub_strat, "abstention": abstention, "scoring": "driver/v2"} if gt else None),
        }
        if serve_id != store_id:
            # served from a sibling partition (e.g. daniocell_native) but stored under store_id;
            # stamp native-schema so the read-only viewer resolves GT against the served partition.
            run_json["schemaBasis"] = "native-schema"
        rid = save_run(run_json)
        st.update(phase="done", saved=True, runSaved=rid, cost=usd)
    except Exception as e:  # noqa: BLE001
        st.update(phase="error", error=str(e)[:300])


class StartReq(BaseModel):
    datasetId: str
    serveDataset: Optional[str] = None  # partition to LABEL (assets/grounding/agent); defaults to datasetId.
    model: str = "gpt-5.5"  # pinned benchmark model (held constant across datasets)
    baseUrl: Optional[str] = None
    note: Optional[str] = None  # optional; usually set post-kickoff via /note


@app.get("/health")
def health():
    return {"ok": True, "active": sum(1 for r in RUNS.values() if r.get("phase") in ("labelling", "scoring", "saving", "loading"))}


# --- run store (browser save / Load Previous Run go through these) ----------
@app.post("/runs")
def runs_save(run: dict = Body(...), x_api_token: str = Header(default="")):
    _auth(x_api_token)
    if not run.get("datasetId") or not isinstance(run.get("clusters"), list):
        raise HTTPException(status_code=400, detail="bad run")
    return {"ok": True, "runId": save_run(run)}


@app.get("/runs")
def runs_list(dataset: str, include: str = "", x_api_token: str = Header(default="")):
    _auth(x_api_token)
    return {"runs": list_runs(dataset, include_archived=(include == "archived"))}


@app.get("/runs/all")
def runs_all(include: str = "", x_api_token: str = Header(default="")):
    """Cross-dataset run list: merge every dataset dir's index (+ archive when
    include=archived). Skips the gifs/ asset folder."""
    _auth(x_api_token)
    inc = include == "archived"
    out = []
    if os.path.isdir(RUNS_DIR):
        for name in sorted(os.listdir(RUNS_DIR)):
            if name == "gifs" or not os.path.isdir(os.path.join(RUNS_DIR, name)):
                continue
            out.extend(list_runs(name, include_archived=inc))
    return {"runs": out}


@app.get("/runs/{dataset}/{run_id}")
def runs_get(dataset: str, run_id: str, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    r = get_run(dataset, run_id)
    if r is None:
        raise HTTPException(status_code=404, detail="no run")
    return r


@app.post("/start")
def start(req: StartReq, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    run_id = uuid.uuid4().hex[:12]
    serve_id = req.serveDataset or req.datasetId
    RUNS[run_id] = {"runId": run_id, "datasetId": req.datasetId, "serveDataset": serve_id, "model": req.model, "phase": "queued", "done": 0, "total": 0, "startedAt": _now(), "note": req.note or None}
    base = (req.baseUrl or DEFAULT_BASE).rstrip("/")
    threading.Thread(target=_run, args=(run_id, req.datasetId, serve_id, req.model, base), daemon=True).start()
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


# --- free-text run note ("what's special about this run") ----------------------
def _set_saved_note(dataset, run_id, note):
    """Write a note onto a SAVED run: both the <run_id>.json file and its _index entry."""
    d = _ds_dir(dataset)
    p = os.path.join(d, _safe(run_id) + ".json")
    if not os.path.exists(p):
        return False
    run = json.load(open(p))
    run["note"] = note or None
    json.dump(run, open(p, "w"))
    idxp = os.path.join(d, "_index.json")
    with _index_lock:
        try:
            idx = json.load(open(idxp)) if os.path.exists(idxp) else []
        except Exception:
            idx = []
        for e in idx:
            if e.get("runId") == run_id:
                e["note"] = note or None
        json.dump(idx, open(idxp, "w"))
    return True


class NoteReq(BaseModel):
    runId: str
    note: Optional[str] = None
    dataset: Optional[str] = None  # required to edit a SAVED run (in-flight uses RUNS)


@app.post("/note")
def set_note(req: NoteReq, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    note = (req.note or "").strip()[:2000] or None
    out = {"ok": True, "inflight": False, "saved": False}
    if req.runId in RUNS:  # in-flight run (server kickoff -> note popup); persisted at save_run
        RUNS[req.runId]["note"] = note
        out["inflight"] = True
        sid = RUNS[req.runId].get("runSaved")  # if it already finished, patch the saved copy too
        if sid:
            out["saved"] = _set_saved_note(RUNS[req.runId].get("datasetId"), sid, note)
    elif req.dataset:  # editing an already-saved run from the list
        out["saved"] = _set_saved_note(req.dataset, req.runId, note)
        if not out["saved"]:
            raise HTTPException(status_code=404, detail="no such saved run")
    else:
        raise HTTPException(status_code=400, detail="provide dataset for a saved run")
    return out


# --- timelapse GIF capture (headless browser films the in-browser AutoPilot) ---
_HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURE_SCRIPT = os.path.join(_HERE, "capture_gif.py")
CAPTURE_PY = os.environ.get("CAPTURE_PYTHON", "/data/.venv/bin/python")
GIFS_DIR = os.path.join(RUNS_DIR, "gifs")


class CaptureReq(BaseModel):
    datasetId: str
    model: str = "gpt-5.5"  # pinned benchmark model
    baseUrl: Optional[str] = None


@app.post("/capture")
def capture_start(req: CaptureReq, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    cid = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    out = os.path.join(GIFS_DIR, cid)
    os.makedirs(out, exist_ok=True)
    base = (req.baseUrl or DEFAULT_BASE).rstrip("/")
    args = [CAPTURE_PY, CAPTURE_SCRIPT, "--dataset", req.datasetId, "--model", req.model, "--base", base, "--out", out, "--max-hours", "16"]
    logf = open(os.path.join(out, "capture.log"), "ab")
    # detached, daemon-like child so it survives this request and keeps filming
    subprocess.Popen(args, stdout=logf, stderr=logf, cwd=_HERE, start_new_session=True)
    with open(os.path.join(out, "status.json"), "w") as f:
        json.dump({"phase": "spawned", "t": int(time.time())}, f)
    return {"captureId": cid, "outDir": out, "gif": os.path.join(out, "timelapse.gif")}


@app.get("/capture/{cid}")
def capture_status(cid: str, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    p = os.path.join(GIFS_DIR, cid, "status.json")
    if not os.path.exists(p):
        raise HTTPException(status_code=404, detail="unknown capture")
    try:
        with open(p) as f:
            st = json.load(f)
    except Exception:
        st = {"phase": "unknown"}
    st["captureId"] = cid
    st["outDir"] = os.path.join(GIFS_DIR, cid)
    return st
