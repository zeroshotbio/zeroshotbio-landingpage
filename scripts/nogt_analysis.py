import os, sys, json, requests, collections
import anndata as ad, pandas as pd
sys.path.insert(0,"/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api")
RUNDIR="/data/scratch/bench/nogt_run"
# SECRETS FROM ENV (previously an inline token + a temp-file read). The inline-token
# version must NEVER be the one promoted to scripts/ — that keeps the token out of git history.
T=os.environ["KASPEROV_API_TOKEN"]
BASE="https://www.zeroshot.bio"
import base64 as _b64
PW=os.environ["KASPEROV_BASIC_PASSWORD"]
BAUTH="Basic "+_b64.b64encode(("autopilot:"+PW).encode()).decode()
HJ={"x-api-token":T,"content-type":"application/json"}
# SINGLE SOURCE OF TRUTH for dataset -> canonical run id (no parallel dict, no sidecar).
_CANON=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"canonical_runs.json")))
def load(ds):
    recs=[json.loads(l) for l in open(f"{RUNDIR}/{ds}.jsonl")]
    return {str(r["id"]):r for r in recs}
def pv(ds,cid,genes):
    r=requests.post("http://127.0.0.1:5007/query",headers=HJ,
        json={"dataset":ds,"cluster":str(cid),"kind":"pvalues","genes":genes},timeout=60)
    return {x["g"]:x for x in (r.json().get("result") or []) if x.get("g")}

def scorecard(ds):
    R=load(ds); n=len(R)
    assigned=[r for r in R.values() if (r["conclude"].get("decision")=="assign")]
    abst=[r for r in R.values() if r["conclude"].get("decision")!="assign"]
    # tier depth: how deep the driver tier reached
    tierdepth=collections.Counter(r["conclude"].get("tier","?") for r in assigned)
    # grounding strength: fraction of cited markers enriched on :5007 (log2FC>=1 & padj<0.05)
    tot_cited=enr=0; per=[]
    for r in assigned:
        cm=[m for m in (r["conclude"].get("cited_markers") or [])][:8]
        if not cm: continue
        d=pv(ds,r["id"],cm); ok=sum(1 for m in cm if d.get(m) and (d[m].get("log2FC") or 0)>=1 and (d[m].get("padj") if d[m].get("padj") is not None else 1)<=0.05)
        tot_cited+=len(cm); enr+=ok; per.append({"id":r["id"],"n":r["nCells"],"cited":len(cm),"enriched":ok,"label":r["finalLabel"]})
    # abstention profile (sizes)
    abprof=sorted([{"id":r["id"],"n":r["nCells"],"identity":r["conclude"].get("identity"),"reason":(r["conclude"].get("state") or "")[:60]} for r in abst],key=lambda x:x["n"])
    return {"dataset":ds,
            "runId":_CANON[ds],                    # NATIVE binding: stamped from the committed canonical map
            "runIdBinding":"canonical_runs.json",  # provenance of the binding (not 'verified-by-label-match')
            "units":n,"coverage":{"assigned":len(assigned),"abstained":len(abst),"assign_pct":round(100*len(assigned)/n,1)},
            "grounding":{"cited_total":tot_cited,"enriched":enr,"enriched_pct":round(100*enr/tot_cited,1) if tot_cited else None,"per_cluster":per},
            "tier_depth":dict(tierdepth),"abstention_profile":abprof}

def minifin_consistency():
    R=load("minifin")
    a=ad.read_h5ad("/data/experiments/tox_toy_2_minifin/minifin_annotated.h5ad",backed='r')
    lab=pd.read_csv("/data/scratch/bench/minifin_leiden_labels.csv").set_index("cell_id")["leiden_1.0"]
    prior=pd.DataFrame({"cl":a.obs["cluster_label"].astype(str).values,"ti":a.obs["tissue"].astype(str).values},index=[str(x) for x in a.obs_names])
    prior["leiden"]=lab.reindex(prior.index).values
    maj={}
    for lc,g in prior.dropna(subset=["leiden"]).groupby("leiden"):
        maj[str(int(lc))]={"cluster_label":g["cl"].mode().iloc[0],"tissue":g["ti"].mode().iloc[0],
                           "purity":round(100*g["cl"].value_counts().iloc[0]/len(g),0)}
    # semantic judge: prior as gt, labeler identity as prediction
    items=[]
    for cid,r in R.items():
        p=maj.get(cid);
        if not p: continue
        ident=r["conclude"].get("identity") or r["finalLabel"]
        items.append({"id":cid,"ourLabel":ident,"markers":[],
                      "predictions":{"tissue":ident,"cell_type_broad":ident},
                      "gt":{"tissue":p["tissue"],"cell_type_broad":p["cluster_label"]}})
    res={}
    for i in range(0,len(items),10):
        b=items[i:i+10]
        d=requests.post(f"{BASE}/api/kasperov_score",json={"dataset":"minifin","model":"gpt-5.5","items":b},
            headers={"Authorization":BAUTH,"content-type":"application/json"},timeout=305).json()
        for x in d.get("results",[]): res[str(x["id"])]=x
    rows=[]; agree_broad=agree_ti=nb=nt=0
    for it in items:
        v=res.get(it["id"],{}); mb=v.get("cell_type_broad",{}).get("match"); mt=v.get("tissue",{}).get("match")
        if mb is not None: nb+=1; agree_broad+=1 if mb else 0
        if mt is not None: nt+=1; agree_ti+=1 if mt else 0
        rows.append({"id":it["id"],"labeler":it["ourLabel"],"prior_celltype":it["gt"]["cell_type_broad"],
                     "prior_tissue":it["gt"]["tissue"],"purity":maj[it["id"]]["purity"],"agree_celltype":mb,"agree_tissue":mt})
    return {"n":len(items),"agreement_celltype_pct":round(100*agree_broad/nb,1) if nb else None,
            "agreement_tissue_pct":round(100*agree_ti/nt,1) if nt else None,
            "disagreements":[r for r in rows if r["agree_celltype"] is False],"all":rows}

def megafin_spotcheck():
    R=load("megafin"); recs=sorted(R.values(),key=lambda r:r["nCells"])
    n=len(recs); idx=sorted(set([0,n//8,n//4,3*n//8,n//2,5*n//8,3*n//4,7*n//8,n-2,n-1]))
    out=[]
    for i in idx:
        r=recs[i]; cm=(r["conclude"].get("cited_markers") or [])[:6]
        d=pv("megafin",r["id"],cm) if cm else {}
        out.append({"id":r["id"],"n":r["nCells"],"label":r["finalLabel"],"decision":r["conclude"].get("decision"),
                    "cited_markers":[{"g":m,"log2FC":round(d[m]["log2FC"],2) if d.get(m) and d[m].get("log2FC") is not None else None} for m in cm]})
    return out

out={}
for ds in ["megafin","minifin","megafin_parse"]:
    if os.path.exists(f"{RUNDIR}/{ds}.jsonl"): out[ds]=scorecard(ds)
if os.path.exists(f"{RUNDIR}/minifin.jsonl"): out["minifin_consistency"]=minifin_consistency()
if os.path.exists(f"{RUNDIR}/megafin.jsonl"): out["megafin_spotcheck"]=megafin_spotcheck()
json.dump(out,open(f"{RUNDIR}/ANALYSIS.json","w"),indent=1)
print("wrote ANALYSIS.json")
for ds in ["megafin","minifin","megafin_parse"]:
    s=out.get(ds);
    if s: print(f"\n{ds}: {s['units']}u | assign {s['coverage']['assign_pct']}% ({s['coverage']['abstained']} abst) | grounding {s['grounding']['enriched_pct']}% cited enriched | tiers {s['tier_depth']}")
mc=out.get("minifin_consistency")
if mc: print(f"\nminifin consistency: celltype {mc['agreement_celltype_pct']}% | tissue {mc['agreement_tissue_pct']}% (n={mc['n']}, {len(mc['disagreements'])} disagree)")
