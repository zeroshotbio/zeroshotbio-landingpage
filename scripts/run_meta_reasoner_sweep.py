#!/usr/bin/env python3
"""Unattended headless sweep: the trimmed 3-call labeller + the REAL Phase-2
meta-reasoner firing at each compartment boundary. Replays the client's exact
runOneCluster sequence against a LOCAL Next dev server (/api/kasperov_agent) and
fires /api/meta_reasoner at each boundary. Emit-and-log only — no queue steering.

HARD BUDGET (non-negotiable):
  - total ceiling across ALL calls (labeller + meta)
  - at >= STOP spent, do NOT start another compartment (clean boundary stop)
  - never start a compartment we can't plausibly finish within the ceiling
  - runaway guard: repeated timeouts / absurd token counts → stop

Usage:
  python run_meta_reasoner_sweep.py [--smoke] [--max-comps N] [--limit-per-comp N]
"""
import json, os, re, sys, time, argparse, urllib.request, urllib.error, base64

BASE   = "http://localhost:3111"
AUTH   = base64.b64encode(b":danio_lover").decode()   # HTTP Basic (blank user)
MODEL  = "gpt-5.4"                                      # matches the validated trimmed run
DATASET_SERVE = "zscape_recursive"   # labeller partition (kasperov_agent + archivist stats)
DATASET_ID    = "zscape_recursive"   # how the run is stored/replayed (matches Phase-2 replay asset)
MENU_DATASET  = "zscape"             # GT vocabulary id for the menu-exposed binning (kasperov_fit)
ASSET  = "/data/zeroshotbio-landingpage/daniotype_data/zscape_recursive/umap.json"
WORKER = "http://127.0.0.1:5008"                        # EBS persist
WORKER_TOKEN = os.environ.get("AUTOPILOT_API_TOKEN", "")

BUDGET_HARD = 25.00
BUDGET_STOP = 22.00
PLAUSIBLE_LEAF = 0.40      # conservative per-leaf cost for the pre-compartment affordability check
PER_CALL_TIMEOUT = 240     # s; a call beyond this is a failure
RUNAWAY_TOKENS = 250_000   # single-call token count that means something is wrong
MAX_CONSEC_FAILS = 3       # consecutive leaf failures → systemic problem → stop
PRICE = {  # USD per 1M tokens (from models.ts)
    "gpt-5.4": (2.5, 15.0), "gpt-5.5": (5.0, 30.0), "gpt-5": (1.25, 10.0),
    "gpt-5-mini": (0.25, 2.0), "gpt-5.4-mini": (0.75, 4.5), "gpt-5.4-nano": (0.2, 1.25),
}

# ---- exact client prompt builders (copied verbatim from KasperovClient.tsx) ----
def default_prompt(c):
    up = ", ".join((c.get("degsUp") or [])[:5]) or "(none)"
    down = ", ".join(m["g"] for m in (c.get("markersDown") or [])[:3])
    s = f"{c['label']}'s top UP markers: {up}. "
    if down: s += f"Depleted (DOWN): {down}. "
    s += ("Return cited evidence (ZFIN / ZFA / GO) for what tissue or cell type these markers indicate. "
          "BE FAST AND EFFICIENT — you are strictly time-budgeted (~30s): at MOST one targeted search per marker, "
          "skip ZFA/GO lookups for any marker ZFIN already resolves, and STOP as soon as the tissue picture is clear. "
          "Do NOT exhaustively search every resource for every gene, and do not research markers beyond the ones listed. "
          "Evidence only — no identity call (that is the Reasoner's job).")
    return s

AUTO_REASON_PROMPT = ("You have the Researcher's read above. IMPORTANT: this cluster's differential markers + their stats are ALREADY PRECOMPUTED and given to you — trust them. Your DEFAULT action is to CONCLUDE. Do NOT routinely dispatch the Archivist to double-check precomputed numbers — only dispatch it if a SPECIFIC raw stat is genuinely in doubt AND would change your call. When the identity + 4-tier stack are settled — which for a clear marker set is NOW — conclude with a kasperov-conclude block, citing markers that are actually in THIS cluster's marker list (abstain at the deepest defensible tier if you cannot ground a specific type). Only dispatch (kasperov-dispatch) if a single specific query would actually change the call.")
AUTO_NUDGE_PROMPT = ("Decide now — do not ask me. Prefer to conclude with a kasperov-conclude block (assign if grounded in this cluster's markers, or abstain at the deepest defensible tier). Only dispatch if a specific query would change the call.")

def bin_prompt(label, menu_block):
    return (f"=== MENU-EXPOSED PHASE — {label} ===\n"
            f'Your DE-NOVO call is now LOCKED: "{label}". From here you are in the MENU-EXPOSED phase — do NOT revise the de-novo answer.\n\n'
            f"Below is the published ZSCAPE label MENU — the ONLY labels the ground truth uses at each tier:\n{menu_block}\n\n"
            "Fit your de-novo call to the SINGLE closest existing menu option at EACH tier (germ layer → tissue → cell type broad → cell type sub), each with its own confidence (0-100). Pick ONLY from the menu; never invent a label. "
            'Declare it under a "**Menu-aware binning**" heading as four short lines — "<tier>: <menu option> (<confidence>%)". '
            "Then REFLECT on any divergence (menu-vocabulary artifact vs real uncertainty). "
            f'FINALLY, end with a clear "### ✅ CLUSTER COMPLETE — {label}" block restating BOTH de-novo and menu-exposed answers.')

# ---- conclude parsing (mirrors splitConclude / formatConcludeLabel) ----
def extract_conclude(text):
    m = re.search(r"```+\s*kasperov-conclude\s*([\s\S]*?)```+", text) or re.search(r"kasperov-conclude\s*(\{[\s\S]*?\})", text)
    if not m: return None
    try: o = json.loads(m.group(1).strip())
    except Exception: return None
    if not isinstance(o, dict): return None
    if isinstance(o.get("identity"), str):
        ident = o["identity"].strip()
        state = o.get("state") if isinstance(o.get("state"), str) and o["state"].strip().lower() != "none" and o["state"].strip() else None
        decision = "abstain" if o.get("decision") == "abstain" else "assign"
        tier = o.get("tier") if isinstance(o.get("tier"), str) else "tier"
        label = f"{ident or 'unresolved'} (abstained · {tier})" if decision == "abstain" else (f"{ident} · {state}" if state else ident)
        return {"label": label, "decision": decision, "done": o.get("done") is not False}
    if isinstance(o.get("label"), str):
        return {"label": o["label"], "decision": "assign", "done": o.get("done") is not False}
    return None

# ---- HTTP ----
def _req(path, payload, timeout, stream=False):
    data = json.dumps(payload).encode()
    r = urllib.request.Request(BASE + path, data=data, method="POST",
        headers={"content-type": "application/json", "authorization": "Basic " + AUTH})
    return urllib.request.urlopen(r, timeout=timeout)

def stream_agent(cluster, messages, mode):
    """POST /api/kasperov_agent, consume SSE, return (text, thinking, statuses, usage, elapsed).
    One retry on transient failure (empty text or exception) for overnight resilience."""
    payload = {"dataset": DATASET_SERVE, "model": MODEL,
               "cluster": {k: cluster.get(k) for k in ("id", "label", "degsUp", "markers", "markersDown", "nCells")},
               "messages": messages, "mode": mode}
    last_err = None
    for attempt in range(2):
        t0 = time.time()
        txt, think, statuses, usage = "", "", [], {"model": MODEL, "in": 0, "out": 0}
        try:
            resp = _req("/api/kasperov_agent", payload, PER_CALL_TIMEOUT)
            buf = ""
            for raw in resp:
                buf += raw.decode("utf-8", "ignore")
                while "\n\n" in buf:
                    part, buf = buf.split("\n\n", 1)
                    line = next((l for l in part.split("\n") if l.startswith("data:")), None)
                    if not line: continue
                    try: evt = json.loads(line[5:].strip())
                    except Exception: continue
                    t = evt.get("t")
                    if t == "text": txt += evt.get("v", "")
                    elif t == "thinking": think += evt.get("v", "")
                    elif t == "status":
                        v = evt.get("v"); statuses.append(v if isinstance(v, str) else json.dumps(v))
                    elif t == "usage":
                        u = evt.get("v", {}); usage = {"model": u.get("model", MODEL), "in": u.get("in", 0), "out": u.get("out", 0)}
            if txt.strip():
                return txt, think, statuses, usage, round(time.time() - t0, 1)
            last_err = "empty response"
        except Exception as e:
            last_err = str(e)
        if attempt == 0: time.sleep(3)
    raise RuntimeError(f"stream_agent failed after retry: {last_err}")

def call_meta(ledger, prior_attempts):
    resp = _req("/api/meta_reasoner", {"ledger": ledger, "priorDescentAttempts": prior_attempts, "model": MODEL}, 150)
    return json.loads(resp.read().decode())

def cost_of(usage):
    pin, pout = PRICE.get(usage.get("model", MODEL), (2.5, 15.0))
    return (usage.get("in", 0) / 1e6) * pin + (usage.get("out", 0) / 1e6) * pout

def fetch_menu_block():
    try:
        r = urllib.request.Request(f"{BASE}/api/kasperov_fit?dataset={MENU_DATASET}", headers={"authorization": "Basic " + AUTH})
        d = json.loads(urllib.request.urlopen(r, timeout=30).read().decode())
        bins = d.get("bins") or {}
    except Exception as e:
        print(f"[warn] menu fetch failed: {e}", flush=True); return ""
    tiers = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"]
    return "\n".join(f"{k}: [ {' | '.join(bins[k])} ]" for k in tiers if isinstance(bins.get(k), list) and bins[k])

# ---- ledger (same shape as brain.ledgerFromLive; predictedLabels = labeller output) ----
def build_ledger(comp_order, done_labels, just_finished, next_comp):
    comps = []
    for ci, leaves in comp_order:
        labelled = [done_labels[str(l["id"])] for l in leaves if str(l["id"]) in done_labels]
        status = "done" if ci <= just_finished else ("next" if ci == next_comp else "pending")
        comps.append({"index": ci, "status": status, "total": len(leaves),
                      "labelled": len(labelled),
                      "abstained": sum(1 for x in labelled if "abstain" in x.lower()),
                      "avgConf": None,
                      "predictedLabels": labelled if status == "done" else []})
    return {"justFinishedCompartment": just_finished, "nextCompartment": next_comp,
            "compartments": comps, "confidenceBuckets": []}

# ================================ main ================================
def main():
    global BUDGET_HARD, BUDGET_STOP
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--max-comps", type=int, default=0)
    ap.add_argument("--limit-per-comp", type=int, default=0)
    ap.add_argument("--outdir", default="")
    ap.add_argument("--budget-hard", type=float, default=BUDGET_HARD)
    ap.add_argument("--budget-stop", type=float, default=BUDGET_STOP)
    args = ap.parse_args()
    BUDGET_HARD, BUDGET_STOP = args.budget_hard, args.budget_stop
    if args.smoke:
        args.max_comps = args.max_comps or 2
        args.limit_per_comp = args.limit_per_comp or 2

    stamp = time.strftime("%Y%m%d-%H%M%S")
    outdir = args.outdir or f"/data/scratch/kasperov_prov_run_META_{'SMOKE_' if args.smoke else ''}{stamp}"
    os.makedirs(outdir, exist_ok=True)
    ev_path = os.path.join(outdir, "events.jsonl")
    open(ev_path, "w").close()
    print(f"[init] outdir={outdir}  model={MODEL}  smoke={args.smoke}  budget stop/hard=${BUDGET_STOP}/${BUDGET_HARD}", flush=True)

    asset = json.load(open(ASSET))
    clusters = asset["clusters"]
    order = sorted(range(len(clusters)), key=lambda i: (clusters[i]["compartmentIndex"], i))
    comp_map = {}
    for i in order:
        comp_map.setdefault(clusters[i]["compartmentIndex"], []).append(clusters[i])
    comp_indices = sorted(comp_map)
    if args.limit_per_comp:
        for ci in comp_indices: comp_map[ci] = comp_map[ci][:args.limit_per_comp]
    if args.max_comps:
        comp_indices = comp_indices[:args.max_comps]
    comp_order = [(ci, comp_map[ci]) for ci in comp_indices]

    menu_block = fetch_menu_block()
    print(f"[init] compartments={comp_indices}  menu_tiers={'yes' if menu_block else 'NO'}", flush=True)

    spend = 0.0; calls = 0; by_mode = {}; tin = tout = 0
    done_labels = {}; leaves_out = []; boundaries = []; meta_decisions = []
    recent_leaf_costs = []; consec_fails = 0; stop_reason = None
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def log_event(rec):
        with open(ev_path, "a") as f: f.write(json.dumps(rec) + "\n")

    def save_run(finished=False):
        run = {"model": MODEL, "dataset": DATASET_ID, "started": started,
               "finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) if finished else None,
               "calls": calls, "cost_usd": round(spend, 4), "tokens_in": tin, "tokens_out": tout,
               "by_mode": by_mode, "leaves": leaves_out, "boundaries": boundaries,
               "metaDecisions": meta_decisions, "stop_reason": stop_reason,
               "compartments": [{"index": ci, "leafIds": [l["id"] for l in ls]} for ci, ls in comp_order]}
        json.dump(run, open(os.path.join(outdir, "run.json"), "w"), indent=1)

    def run_leaf(cl, ci):
        nonlocal spend, calls, tin, tout, consec_fails
        lid = str(cl["id"]); leaf_cost = 0.0; steps = []
        t_leaf = time.time()
        def do(mode, messages, step):
            nonlocal spend, calls, tin, tout, leaf_cost
            txt, think, statuses, usage, el = stream_agent(cl, messages, mode)
            c = cost_of(usage); spend += c; leaf_cost += c; calls += 1
            by_mode[mode] = by_mode.get(mode, 0) + 1
            tin += usage.get("in", 0); tout += usage.get("out", 0)
            log_event({"leaf": lid, "step": step, "mode": mode, "request_last_user": messages[-1]["content"],
                       "response": txt, "thinking": think, "statuses": statuses,
                       "usage": usage, "cost_usd": round(c, 5), "elapsed_s": el,
                       "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
            steps.append({"step": step, "mode": mode, "elapsed_s": el, "usage": usage, "cost": round(c, 5)})
            if el >= PER_CALL_TIMEOUT - 1 or usage.get("in", 0) + usage.get("out", 0) > RUNAWAY_TOKENS:
                raise RuntimeError(f"runaway call: {el}s, {usage.get('in',0)+usage.get('out',0)} tok")
            return txt
        # 1) Researcher
        dp = default_prompt(cl)
        p1 = do("research", [{"role": "user", "content": dp}], "research#1")
        conv = [{"role": "user", "content": dp}, {"role": "assistant", "content": p1}]
        # 2) Reasoner r0 (+ up to one nudge) → conclude
        concl = None
        for rnd, prompt in enumerate([AUTO_REASON_PROMPT, AUTO_NUDGE_PROMPT]):
            rc = do("reason", conv + [{"role": "user", "content": prompt}], "reason#r0" if rnd == 0 else "reason#nudge")
            conv += [{"role": "user", "content": prompt}, {"role": "assistant", "content": rc}]
            concl = extract_conclude(rc)
            if concl and concl.get("done"): break
        label = concl["label"] if concl else "(unresolved — review)"
        # 3) menu-exposed binning
        if menu_block:
            do("reason", conv + [{"role": "user", "content": bin_prompt(label, menu_block)}], "reason#binning")
        done_labels[lid] = label
        lc = round(leaf_cost, 4); recent_leaf_costs.append(lc)
        leaves_out.append({"id": lid, "label": cl["label"], "compartmentIndex": ci, "nCells": cl.get("nCells"),
                           "final_label": label, "concluded": bool(concl), "did_archivist": False,
                           "n_reason_rounds": sum(1 for s in steps if s["mode"] == "reason"),
                           "cost_usd": lc, "elapsed_s": round(time.time() - t_leaf, 1), "steps": steps})
        consec_fails = 0
        print(f"    leaf {lid} (C{ci}) → {label[:60]!r}  ${lc:.3f}  {round(time.time()-t_leaf)}s  | total ${spend:.2f}", flush=True)

    def fire_boundary(just_finished, next_comp):
        nonlocal spend, tin, tout
        prior = {}
        for m in meta_decisions:
            if m["boundary_after_compartmentIndex"] < just_finished and m["action"] == "descend" and m["target"]:
                k = m["target"].strip().lower(); prior[k] = prior.get(k, 0) + 1
        ledger = build_ledger(comp_order, done_labels, just_finished, next_comp)
        try:
            r = call_meta(ledger, prior)
        except Exception as e:
            print(f"  [boundary C{just_finished}→{next_comp}] meta call FAILED: {e}", flush=True)
            boundaries.append({"at_boundary_after_compartmentIndex": just_finished, "next_compartmentIndex": next_comp, "meta_error": str(e)})
            return
        u = r.get("usage") or {}
        mc = cost_of({"model": u.get("model", MODEL), "in": u.get("in") or 0, "out": u.get("out") or 0})
        spend += mc; tin += u.get("in") or 0; tout += u.get("out") or 0
        d = r.get("decision") or {}; g = r.get("guardrails") or {}
        # GT-BLIND verification on the exact input the brain received
        inp = r.get("input") or {}
        blob = json.dumps(inp).lower()
        gt_hit = [f for f in ("gt_control", "gtcontrol", "gt_allcell", "gtallcell", "gt_tissue", "gttissue", "groundtruth", "controlvote") if f in blob.replace("_", "")]
        rec = {"boundary_after_compartmentIndex": just_finished, "next_compartmentIndex": next_comp,
               "action": d.get("action"), "target": d.get("target"), "rationale": d.get("rationale"),
               "expected_still_missing": d.get("expected_still_missing"),
               "cap_applied": bool(g.get("capApplied")), "gt_blind": bool(g.get("gtBlind")),
               "gt_leak_check": gt_hit or "clean", "reasoning": r.get("reasoning"),
               "usage": u, "cost_usd": round(mc, 5), "model": u.get("model", MODEL)}
        meta_decisions.append(rec)
        # per-compartment ledger summary for the boundary record (Phase-1 shape)
        per = {str(c["index"]): {"total": c["total"], "labelled": c["labelled"], "abstained": c["abstained"]}
               for c in ledger["compartments"] if c["status"] == "done"}
        boundaries.append({"at_boundary_after_compartmentIndex": just_finished, "next_compartmentIndex": next_comp,
                           "per_compartment": per, "leaves_labelled": sum(p["labelled"] for p in per.values()),
                           "leaves_abstained": sum(p["abstained"] for p in per.values()),
                           "cost_so_far_usd": round(spend, 4), "calls_so_far": calls,
                           "decision": {"action": d.get("action"), "target": d.get("target")},
                           "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        json.dump(inp, open(os.path.join(outdir, f"brain_input_C{just_finished}.json"), "w"), indent=1)
        print(f"  [boundary C{just_finished}→{next_comp}] {d.get('action')} · {str(d.get('target'))[:40]!r}  gt_blind={g.get('gtBlind')} leak={gt_hit or 'clean'}  ${mc:.4f}", flush=True)
        save_run()

    # ---- sweep ----
    for idx, (ci, leaves) in enumerate(comp_order):
        next_comp = comp_order[idx + 1][0] if idx + 1 < len(comp_order) else (ci + 1)
        # pre-compartment budget gate (clean-boundary stop). Rule 2: at >=STOP,
        # don't start another compartment. Affordability: only start a compartment
        # we can plausibly FINISH within the ceiling, estimated at recent AVG cost
        # (so a big compartment isn't refused by a worst-case floor). The per-leaf
        # hard guard below (max/hot floor) is the last-resort ceiling.
        avg_recent = (sum(recent_leaf_costs) / len(recent_leaf_costs)) if recent_leaf_costs else 0.25
        if spend >= BUDGET_STOP:
            stop_reason = f"budget stop: ${spend:.2f} >= ${BUDGET_STOP} at boundary before C{ci}"; print(f"[STOP] {stop_reason}", flush=True); break
        if spend + len(leaves) * avg_recent > BUDGET_HARD:
            stop_reason = f"affordability: cannot finish C{ci} ({len(leaves)} leaves × ~${avg_recent:.2f} avg) within ${BUDGET_HARD} (spent ${spend:.2f})"; print(f"[STOP] {stop_reason}", flush=True); break
        print(f"[compartment {ci}] {len(leaves)} leaves  (spent ${spend:.2f})", flush=True)
        for cl in leaves:
            # hard per-leaf safety: never start a leaf that could cross the ceiling
            if spend + max(PLAUSIBLE_LEAF, (max(recent_leaf_costs[-5:]) if recent_leaf_costs else PLAUSIBLE_LEAF)) > BUDGET_HARD:
                stop_reason = f"hard ceiling guard mid-C{ci}: spent ${spend:.2f}, next leaf could cross ${BUDGET_HARD}"; print(f"[STOP] {stop_reason}", flush=True); break
            try:
                run_leaf(cl, ci)
            except Exception as e:
                consec_fails += 1
                print(f"    leaf {cl['id']} FAILED ({consec_fails}/{MAX_CONSEC_FAILS}): {e}", flush=True)
                log_event({"leaf": str(cl["id"]), "step": "error", "error": str(e), "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
                if consec_fails >= MAX_CONSEC_FAILS:
                    stop_reason = f"runaway/systemic: {consec_fails} consecutive leaf failures"; print(f"[STOP] {stop_reason}", flush=True); break
            save_run()
        # fire the meta-reasoner at the boundary of the just-finished compartment
        fire_boundary(ci, next_comp)
        if stop_reason: break

    if not stop_reason: stop_reason = "completed all requested compartments"
    save_run(finished=True)
    print(f"[done] {stop_reason} | spent ${spend:.4f} | leaves {len(leaves_out)} | boundaries {len(boundaries)} | calls {calls}", flush=True)

    # persist to EBS (worker /runs) so /meta_reasoner + RunViewer can read it back
    try:
        run_obj = {"datasetId": DATASET_ID, "dataset": DATASET_ID, "model": MODEL,
                   "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "note": f"🧠 headless meta-reasoner sweep — {len(leaves_out)} leaves, {len(meta_decisions)} decisions ({'SMOKE' if args.smoke else 'full'})",
                   "source": "meta_reasoner_headless", "judgementMode": False, "judgements": [],
                   "metaDecisions": meta_decisions, "hasJudgement": False,
                   "clusters": [{"id": l["id"], "label": l["label"], "finalLabel": l["final_label"], "validated": True} for l in leaves_out]}
        data = json.dumps(run_obj).encode()
        req = urllib.request.Request(f"{WORKER}/runs", data=data, method="POST",
              headers={"content-type": "application/json", "x-api-token": WORKER_TOKEN})
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        print(f"[ebs] persisted runId={resp.get('runId')}", flush=True)
        json.dump({"runId": resp.get("runId"), "outdir": outdir}, open(os.path.join(outdir, "_ebs.json"), "w"))
    except Exception as e:
        print(f"[ebs] persist FAILED: {e} (provenance is on disk at {outdir})", flush=True)

if __name__ == "__main__":
    main()
