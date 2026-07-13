"""Resident graph-judge scorer (:5011). Warm-loads Qwen3-0.6B + ZFA graph + CL
indexes; POST /graph_score returns the burst-23 finalJudge_graph block for a run's
pred+GT rows. Scorer is VERBATIM from bakeoff/build_graph_blocks.py (scheme b + CL
bridge, THR 0.78, widened-subsumption NOT applied) so the live path reproduces the
already-written golden-run blocks exactly. Bound 127.0.0.1 (on-box callers only).
"""
import collections, json, os, re, time, types
import numpy as np
os.environ.setdefault("HF_HUB_OFFLINE","1"); os.environ.setdefault("TOKENIZERS_PARALLELISM","false")
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

Z="/data/scratch/zlabel"; CL_OBO=f"{Z}/data/ontologies/cl-basic.obo"; THR=0.78; SCORED_TAG="live-service"
TOKEN=os.environ.get("GRAPHJUDGE_TOKEN","")
_SYN=re.compile(r'"([^"]+)"')
CELL=re.compile(r"(cyte|blast|phore|neuron|glia|myocyte|keratinocyte|fibroblast|macrophage|melano|erythro|neutrophil|myoblast|chondro|podocyte|ionocyte|enterocyte|\bcell\b|photoreceptor|interneuron|hepatocyte)",re.I)

_gj=types.ModuleType("gj"); _gj.__file__=f"{Z}/graph_judge_poc.py"
exec(compile(open(_gj.__file__).read().replace("if __name__","if False and __name__"),_gj.__file__,"exec"),_gj.__dict__)
_b6=types.ModuleType("b6"); _b6.__file__=f"{Z}/resolver_burst6.py"
exec(compile(open(_b6.__file__).read().replace("if __name__","if False and __name__"),_b6.__file__,"exec"),_b6.__dict__)

print("[graphjudge] loading ontology + CL substrate…", flush=True); _t0=time.time()
zfa=_gj.load_zfa(_gj.OBO_PATH); G,dag=_gj.build_views(zfa); idx=_gj.build_resolver_index(zfa); up=_b6.build_up_dag(zfa)
id2name={n:d.get("name") for n,d in zfa.nodes(data=True)}
ZN,ZI=[],[]
for n,d in zfa.nodes(data=True):
    if d.get("name"): ZN.append(d["name"]); ZI.append(n)
_cl2z=collections.defaultdict(list)
for n,d in zfa.nodes(data=True):
    xr=d.get("xref") or []; xr=[xr] if isinstance(xr,str) else xr
    for x in xr:
        if str(x).startswith("CL:"): _cl2z[str(x)].append(n)
CLEAN={c:v[0] for c,v in _cl2z.items() if len(v)==1}
import obonet
_cl=obonet.read_obo(CL_OBO); CT,CG=[],[]
for c in CLEAN:
    if c in _cl:
        for f in [_cl.nodes[c].get("name")]+[m.group(1) for s in (_cl.nodes[c].get("synonym") or []) if (m:=_SYN.search(s))]:
            if f: CT.append(f.lower()); CG.append(c)
print("[graphjudge] loading Qwen3-0.6B…", flush=True)
from sentence_transformers import SentenceTransformer
model=SentenceTransformer("Qwen/Qwen3-Embedding-0.6B",device="cuda",trust_remote_code=True)
def _E(t): return model.encode(t,normalize_embeddings=True,batch_size=128,show_progress_bar=False,convert_to_numpy=True).astype(np.float32)
ZMAT=_E(ZN); CLMAT=_E(CT); _WARM=round(time.time()-_t0,1)
print(f"[graphjudge] warm in {_WARM}s | {len(ZN)} ZFA names, {len(set(CG))} CL terms", flush=True)

# ---- VERBATIM scorer (bakeoff/build_graph_blocks.py) ----
def resolve(term):
    if not isinstance(term,str) or not term.strip(): return None,"none",None
    gen=_b6.BASE_GENERIC|_b6.V6_EXTRA_GENERIC
    for c in _b6.normalize(term,gen):
        if c in idx: return idx[c],"string",None
    v=_E([term])[0]; j=int(np.argmax(ZMAT@v)); ec=float((ZMAT@v)[j]); best=(ZI[j],id2name.get(ZI[j]),ec,"embed")
    if CELL.search(term):
        k=int(np.argmax(CLMAT@v)); cc=float((CLMAT@v)[k]); c=CG[k]
        if c in CLEAN and cc>best[2]: best=(CLEAN[c],id2name.get(CLEAN[c]),cc,"cl_bridge")
    if best[2]<THR: return None,"none",round(best[2],3)
    if any(g in term.lower() for g in _b6.GUARD_WORDS) and not any(m in (best[1] or "").lower() for m in _b6.DEV_MARKERS):
        return None,"guard",round(best[2],3)
    return best[0],best[3],round(best[2],3)
def _bucket(s):
    if s["distance"]==0: return "exact"
    if s["subsumption"]=="specific": return "specific"
    if s["subsumption"]=="coarse": return "coarse"
    return "near_miss" if (isinstance(s["distance"],(int,float)) and s["distance"]<=1.5) else "error"
def score_row(pred,gt,tier,rid):
    rp,pv_,pc=resolve(pred); rg,gv,gc=resolve(gt)
    row={"id":rid,"identity":pred,"tier":tier,"gt":gt,
         "pred_zfa":rp,"pred_zfa_name":id2name.get(rp),"pred_via":pv_,
         "gt_zfa":rg,"gt_zfa_name":id2name.get(rg),"gt_via":gv}
    if not gt or not str(gt).strip():
        row.update(route="not_scored",score=None,subsumption=None,distance=None,path_edge_types=[]); return row,"not_scored"
    if rp and rg:
        s=_gj.score(rp,rg,G,dag)
        row.update(route="graph",score=round(s["score"],4),subsumption=s["subsumption"],
                   distance=s["distance"],path_edge_types=s["path_edge_types"]); return row,"graph"
    row.update(route="llm_fallback",score=None,subsumption=None,distance=None,path_edge_types=[]); return row,"llm_fallback"
def build_block(rows_scored, join):
    rows=[r for r,_ in rows_scored]; cats=collections.Counter(c for _,c in rows_scored); n=len(rows_scored)
    gr=[r for r,c in rows_scored if c=="graph"]
    bk=collections.Counter(_bucket({"distance":r["distance"],"subsumption":r["subsumption"]}) for r in gr)
    mean=round(sum(r["score"] for r in gr)/len(gr),4) if gr else None
    return {"judge":"fuzzy graph judge (ZFA scheme-b + Qwen resolver + CL bridge)","scored":SCORED_TAG,
            "embedder":"Qwen3-Embedding-0.6B","threshold":THR,
            "scheme":"b (part_of=0.5,is_a=1.0; 1/(1+d_w)); widened-subsumption NOT applied","join":join,"rows":rows,
            "coverage":{"n":n,"graph":cats["graph"],"fallback":cats["llm_fallback"],"not_scored":cats["not_scored"],
                        "graph_pct":round(100*cats["graph"]/n) if n else 0,"fallback_pct":round(100*cats["llm_fallback"]/n) if n else 0,
                        "not_scored_pct":round(100*cats["not_scored"]/n) if n else 0},
            "aggregate":{"mean_score_graph_routed":mean,"buckets":dict(bk)}}

app=FastAPI(title="graphjudge")
class Row(BaseModel):
    id: Any; pred: Optional[str]=None; identity: Optional[str]=None; gt: Optional[str]=None; tier: Optional[str]=None
class ScoreReq(BaseModel):
    rows: list[Row]; join: Optional[str]=None
def _auth(tok):
    if TOKEN and tok!=TOKEN: raise HTTPException(401,"bad token")

@app.get("/health")
def health():
    return {"status":"ok","embedder":"Qwen3-Embedding-0.6B","threshold":THR,"n_zfa":len(ZN),"n_cl":len(set(CG)),"warm_s":_WARM}

@app.post("/graph_score")
def graph_score(req: ScoreReq, x_api_token: str = Header(default="")):
    _auth(x_api_token)
    scored=[]
    for r in req.rows:
        pred = r.pred if r.pred is not None else r.identity
        try: scored.append(score_row(pred, r.gt, r.tier, r.id))
        except Exception as e:
            scored.append(({"id":r.id,"identity":pred,"tier":r.tier,"gt":r.gt,"route":"llm_fallback","score":None,
                            "subsumption":None,"distance":None,"path_edge_types":[],"error":str(e)[:120]},"llm_fallback"))
    return {"block": build_block(scored, req.join or "live /graph_score")}
