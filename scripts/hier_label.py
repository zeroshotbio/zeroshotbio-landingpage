#!/data/.venv/bin/python
"""Hierarchical pilot — STEP 2: two-level de-novo -> menu labelling of the re-embedded sub-clusters.

Per sub-cluster: (1) open-vocab de-novo call (markers only, frozen); (2a) bin to a DanioCell tissue
(19-menu); (2b) bin to a fine cell type from THAT tissue's children (conditional menu) or NO_MATCH
(escape-hatch = escalation). A wrong tissue pick draws fine from the wrong candidate set -> cascade
(the propagation diagnostic). Two channels unblended: menu-exact (string) + de-novo-semantic (driver/v2).
Reports candidate-set size beside every menu-exact score; splits QC-GT (doublets/mixed signature) out as
junk-recognition; tracks escalation rate (glial = probe). Kill condition vs the flat sanity baseline.
Additive under runs/daniocell_hier_<date>/. De-leak/order asserts scoped to injected prompts. Secrets from env.
"""
import os, sys, re, json, hashlib
APP_DIR="/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api"; sys.path.insert(0,APP_DIR)
import app

DATE="2026-06-20"; MODEL="gpt-5.5"; SERVE="daniocell_native"; STORE="daniocell"
BASE=app.DEFAULT_BASE; HARNESS_ID="daniocell-hier/v1.0"; JUDGE="driver/v2"; ABORT_USD=25.00
OUT=f"/data/zeroshotbio-landingpage/runs/daniocell_hier_{DATE}"
REEMBED=f"{OUT}/reembed"; TISSUES=["eye","muscle","glial"]
JUNK={"likely doublets","mixed signature"}
# flat baseline (daniocell sanity, driver/v2): tissue 8/10=80%, cell 7/9=77.8%; menu-exact tissue 60%, cell 55.6%
BASELINE={"denovo_tissue":80.0,"denovo_cell":77.8,"menu_tissue":60.0,"menu_cell":55.6,"costPerCell":None}
for k in ("AUTOPILOT_API_TOKEN","STATS_VERIFY_TOKEN","KASPEROV_BASIC_PASSWORD"):
    if not os.environ.get(k): print(f"[FATAL] {k} absent"); sys.exit(2)

TISSUE_MENU=sorted({(g.get('tissue') or {}).get('label') for g in app._get_asset(BASE,SERVE,'groundtruth.json')['clusters'].values() if (g.get('tissue') or {}).get('label')})
FINE_BY_TISSUE=json.load(open('/home/ubuntu/hier_fine_menus.json'))
PART_SHA="4ce6087667d38f57"; GTLABEL_SHA="2278d043c64f7adf"
MENU_SHA=hashlib.sha256(json.dumps({'tissue':TISSUE_MENU,'fine':FINE_BY_TISSUE},sort_keys=True).encode()).hexdigest()[:16]
print(f"[prov] tissue-menu {len(TISSUE_MENU)} | fine menus {len(FINE_BY_TISSUE)} tissues | menuSha {MENU_SHA} | gtLabel {GTLABEL_SHA}",flush=True)

def parse_menu(t):
    m=re.search(r"kasperov-menu",t,re.I)
    if not m: return None
    s=t.find("{",m.end())
    if s==-1: return None
    d=0
    for i in range(s,len(t)):
        if t[i]=="{":d+=1
        elif t[i]=="}":
            d-=1
            if d==0:
                try:return json.loads(t[s:i+1])
                except:return None
    return None

def tissue_prompt(dn):
    mb="\n".join(f"  {i+1}. {m}" for i,m in enumerate(TISSUE_MENU))
    return (f'Your FINAL frozen de novo call for this cluster: "{dn}". Do not change it. Map it to ONE DanioCell '
            f'tissue (level 1):\n{mb}\nReturn EXACT tissue text or "NO_MATCH".\n'
            f'```kasperov-menu\n{{ "tissue":"<exact or NO_MATCH>", "why":"<short>" }}\n```')
def fine_prompt(dn,tis,children):
    mb="\n".join(f"  {i+1}. {m}" for i,m in enumerate(children))
    return (f'Frozen de novo call: "{dn}". You placed it in tissue "{tis}". Now pick the single best CELL TYPE '
            f'within {tis} (level 2):\n{mb}\nReturn EXACT text, or "NO_MATCH" if none fits (valid — flags a gap/escalation). '
            f'You are MAPPING the frozen call, not re-deriving.\n'
            f'```kasperov-menu\n{{ "cellType":"<exact or NO_MATCH>", "abstain":<bool>, "why":"<short>" }}\n```')

def halt(m): json.dump({"halted":True,"reason":m},open(f"{OUT}/HALT.json","w")); print(f"[HALT] {m}"); sys.exit(4)

usage,clusters_out,rows=({},[],[])
for tis in TISSUES:
    sa=json.load(open(f"{REEMBED}/{tis}_subatlas.json"))
    for sc in sa["subclusters"]:
        cid=sc["id"]; seq=len(rows)  # NEUTRAL sequential prompt label — tissue is tracked in data, never in the prompt id (eye.s0 would leak "eye")
        c={"id":cid,"label":f"Cluster {seq}","degsUp":sc["degsUp"],"markers":[],"nCells":sc["nCells"]}
        gt_tis=sc["gtTissue"]; gt_fine=sc["gtFine"]
        # DE-LEAK assert BEFORE any spend — on the markers-only prompts we inject (neutral label).
        # Word-boundary match: a leak = the GT name as a whole word/phrase, not a substring of a gene symbol.
        for s in [app.default_prompt(c).lower(), app.second_opinion_prompt(c).lower()]:
            if gt_tis and re.search(r"\b"+re.escape(gt_tis.lower())+r"\b", s): halt(f"{cid}(seq{seq}): tissue '{gt_tis}' in injected prompt")
            if gt_fine and re.search(r"\b"+re.escape(gt_fine.lower())+r"\b", s): halt(f"{cid}(seq{seq}): fine '{gt_fine}' in injected prompt")
        # PHASE 1 de novo
        dn,conv=app.run_one_cluster(BASE,SERVE,MODEL,c,usage)
        if not conv[0]["content"].startswith(f"Cluster {seq}'s top up-regulated markers are:"): halt(f"{cid}: opener mismatch")
        conf=app.get_confidence(BASE,SERVE,MODEL,c,conv,usage)
        # PHASE 2a tissue
        t1=app._agent(BASE,SERVE,MODEL,c,conv+[{"role":"user","content":tissue_prompt(dn)}],"reason",usage)
        p1=parse_menu(t1) or {}; tbin=p1.get("tissue"); tbin=tbin if tbin in TISSUE_MENU else None
        # PHASE 2b conditional fine
        children=FINE_BY_TISSUE.get(tbin or gt_tis, [])
        t2=app._agent(BASE,SERVE,MODEL,c,conv+[{"role":"user","content":fine_prompt(dn,tbin or "(unmapped)",children)}],"reason",usage)
        p2=parse_menu(t2) or {}; fbin=p2.get("cellType")
        escalate = (fbin in (None,"NO_MATCH")) or (fbin not in children)
        fbin=None if escalate else fbin
        candset=len(children)
        transcript=conv+[{"role":"user","content":tissue_prompt(dn)},{"role":"assistant","content":t1,"mode":"reason","phase":"tissue-bin"},
                         {"role":"user","content":fine_prompt(dn,tbin or "?",children)},{"role":"assistant","content":t2,"mode":"reason","phase":"fine-bin"}]
        clusters_out.append({"id":cid,"label":c["label"],"validated":True,"finalLabel":dn,
            "deNovo":{"label":dn,"confidence":conf,"frozenAt":app._now(),"deLeakConfirmed":True},
            "menu":{"tissue":tbin,"cellType":fbin,"escalate":escalate,"candidateSetSize":candset,"why":p2.get("why")},
            "confidence":conf,"addedMarkers":[],"transcript":transcript})
        rows.append({"id":cid,"tissue":tis,"deNovo":dn,"tbin":tbin,"fbin":fbin,"escalate":escalate,
            "gtTissue":gt_tis,"gtFine":gt_fine,"junk":gt_fine in JUNK,"candset":candset,
            "tHit":tbin==gt_tis,"fHit":bool(gt_fine and fbin==gt_fine and gt_fine not in JUNK)})
        cum=app._est_cost(usage)[0]
        print(f"[{len(rows)}] {cid}: dn={str(dn)[:24]!r} t={str(tbin)[:10]!r}/{gt_tis} f={str(fbin)[:18]!r}/{str(gt_fine)[:18]!r} esc={escalate} cum ${cum:.2f}",flush=True)
        if cum>=ABORT_USD: print(f"[ABORT] ${cum:.2f}"); break
    else: continue
    break

# de-novo-semantic (driver/v2): judge frozen de-novo vs GT tissue + fine
labelled=[{"id":c["id"],"finalLabel":c["finalLabel"],"degsUp":[]} for c in clusters_out]
_rowby={r["id"]:r for r in rows}
GT={c["id"]:{"tissue":{"label":_rowby[c["id"]]["gtTissue"]},
            "cell_type_sub":{"label":_rowby[c["id"]]["gtFine"]}} for c in clusters_out}
sem_v,sem_agg,_,_=app.score_clusters(BASE,SERVE,MODEL,labelled,GT,usage)
spend=app._est_cost(usage)[0]
sem={a["key"]:a for a in sem_agg}

def per_tissue_agg(t):
    rs=[r for r in rows if r["tissue"]==t]; nonjunk=[r for r in rs if not r["junk"] and r["gtFine"]]; junk=[r for r in rs if r["junk"]]
    return {"n":len(rs),"candidateSetSize":len(FINE_BY_TISSUE[t]),
            "menu_tissue":f"{sum(r['tHit'] for r in rs)}/{len(rs)}",
            "menu_cell":f"{sum(r['fHit'] for r in nonjunk)}/{len(nonjunk)}" if nonjunk else "0/0",
            "escalationRate":round(100*sum(r['escalate'] for r in rs)/max(1,len(rs)),1),
            "junk_n":len(junk),"junk_recognized":sum(1 for r in junk if r["escalate"] or (r["fbin"] in JUNK))}
AGG={t:per_tissue_agg(t) for t in set(r["tissue"] for r in rows)}
overall_menu_tissue=round(100*sum(r["tHit"] for r in rows)/max(1,len(rows)),1)
nonjunk=[r for r in rows if not r["junk"] and r["gtFine"]]
overall_menu_cell=round(100*sum(r["fHit"] for r in nonjunk)/max(1,len(nonjunk)),1)
dnt=sem.get("tissue",{}); dnc=sem.get("cell_type_sub",{})
_satlas={t:{s["id"]:s["nCells"] for s in json.load(open(f"{REEMBED}/{t}_subatlas.json"))["subclusters"]} for t in TISSUES}
cells_labelled=sum(_satlas[r["tissue"]].get(r["id"],0) for r in rows)
costPerCell=round(spend/max(1,cells_labelled),6)
kill={"hier_menu_tissue":overall_menu_tissue,"hier_menu_cell":overall_menu_cell,
      "hier_denovo_tissue":round(dnt.get("pct",0),1),"hier_denovo_cell":round(dnc.get("pct",0),1),
      "baseline":BASELINE,"beatsFlat_tier":(overall_menu_cell>BASELINE["menu_cell"] or round(dnc.get('pct',0),1)>BASELINE["denovo_cell"]),
      "costPerLabelledCell":costPerCell}

man={"harness":HARNESS_ID,"date":DATE,"seed_note":"sub-clusters from per-tissue re-embed (silhouette-gated, res 0.2-1.0)",
     "provenance":{"partitionSha":PART_SHA,"gtLabelSha":GTLABEL_SHA,"menuSha":MENU_SHA,"judge":JUDGE,
                   "servedDataset":SERVE,"storedAs":STORE,"reembedNote":"no Harmony (no batch covariate); HVG->PCA->Leiden"},
     "totalSpendUsd":round(spend,4),"nSubclusters":len(rows),"cellsLabelled":cells_labelled,
     "perTissue":AGG,"overall":{"menu_tissue":overall_menu_tissue,"menu_cell":overall_menu_cell,
        "denovo_tissue":round(dnt.get('pct',0),1),"denovo_cell":round(dnc.get('pct',0),1)},
     "killCondition":kill,"rows":rows}
os.makedirs(OUT,exist_ok=True)
json.dump(man,open(f"{OUT}/aggregate.json","w"),indent=1)
bundle={"schema":"daniotype_kasperov_run/v1","dataset":"DanioCell — hierarchical pilot (per-tissue re-embed)","datasetId":STORE,
    "model":MODEL,"cost":{"usd":round(spend,4),"estimated":True,"usage":{m:dict(u) for m,u in usage.items()}},
    "exportedAt":app._now(),"scoredAt":app._now(),"nLabelled":len(clusters_out),"nValidated":len(clusters_out),"source":"server",
    "note":f"DanioCell HIERARCHICAL pilot {HARNESS_ID} — eye/muscle/glial, two-level de-novo->menu, SCORED ({JUDGE}); isolated eval, not promoted",
    "harness":{"id":HARNESS_ID,"version":"1.0","name":"DanioCell hierarchical","judge":JUDGE,"menuSha":MENU_SHA},
    "schemaBasis":"native-schema","provenance":{"hierarchical":True,"partitionSha":PART_SHA,"gtLabelSha":GTLABEL_SHA,"scored":True,"promoted":False},
    "clusters":clusters_out,"groundTruth":{"scoredAt":app._now(),"scoring":JUDGE,"aggregate":sem_agg,"verdicts":sem_v}}
json.dump(bundle,open(f"{OUT}/run_bundle.json","w"),indent=1)
print(f"\n=== HIER PILOT DONE === spend ${spend:.2f} | sub-clusters {len(rows)} | menu tissue {overall_menu_tissue}% cell {overall_menu_cell}% | "
      f"denovo tissue {round(dnt.get('pct',0),1)}% cell {round(dnc.get('pct',0),1)}% | beats flat: {kill['beatsFlat_tier']} | $/cell {costPerCell}")
for t,a in AGG.items(): print(f"  {t}: menu tissue {a['menu_tissue']} cell {a['menu_cell']} (candset {a['candidateSetSize']}) escal {a['escalationRate']}% junk {a['junk_recognized']}/{a['junk_n']}")
