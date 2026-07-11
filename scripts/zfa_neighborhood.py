#!/usr/bin/env python
"""OnClass-style ZFA neighborhood adapter (cached, importable).

Borrows OnClass's clusDCA (is_a graph + text-augmented edges -> random-walk-with-restart
-> centered SVD, DC component dropped) to embed every ZFA anatomy node so graph-neighbors
and semantically-similar types sit close. A cluster is placed training-free (GT-blind):
its markers -> their specific ZFIN-grounded ZFA terms -> IDF-weighted mean node vector.
neighborhood() returns the nearest identity-bearing nodes (cell / tissue / multi-tissue /
organ) with a cosine "trust" score. Adapter-side only — zlabel core is untouched.

Build is cached to data/zfa_embed_cache.npz (~1 MB); rebuilt on demand.
"""
import os, json, collections
import numpy as np

ZL = "/data/scratch/zlabel"
OBO = f"{ZL}/data/ontologies/zfa.obo"
EXPR = f"{ZL}/data/ontologies/zfin_wildtype_expression.txt"
CACHE = f"{ZL}/data/zfa_embed_cache.npz"
META = f"{ZL}/data/zfa_embed_meta.json"
D, RESTARTS, TEXT_SIM = 100, [0.5, 0.6, 0.7, 0.8], 0.5
# identity-bearing tiers eligible to be a neighbor (Darien's principal buckets, minus system)
CAND_ROOTS = {"ZFA:0009000": "cell", "ZFA:0001477": "tissue",
              "ZFA:0001488": "multi_tissue_structure", "ZFA:0000496": "organ", "ZFA:0001492": "organ"}

_S = {}  # module state


def _parse():
    terms = {}; cur = None
    for line in open(OBO):
        line = line.rstrip("\n")
        if line == "[Term]": cur = {"is_a": [], "obs": False, "def": ""}; continue
        if line.startswith("[") and line != "[Term]": cur = None; continue
        if cur is None: continue
        if line.startswith("id: "): cur["id"] = line[4:].strip(); terms[cur["id"]] = cur
        elif line.startswith("name: "): cur["name"] = line[6:].strip()
        elif line.startswith("def: "): cur["def"] = line[5:].strip().strip('"')
        elif line.startswith("is_a: "): cur["is_a"].append(line[6:].split("!")[0].strip())
        elif line.startswith("is_obsolete: true"): cur["obs"] = True
    return terms


def _build():
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    terms = _parse()
    nodes = [i for i, t in terms.items() if not t.get("obs") and "name" in t]
    idx = {i: k for k, i in enumerate(nodes)}; n = len(nodes)

    def anc(i):
        s = {i}; st = [i]
        while st:
            x = st.pop()
            for p in terms.get(x, {}).get("is_a", []):
                if p not in s: s.add(p); st.append(p)
        return s

    # candidate bucket: nearest CARE root among CAND_ROOTS by is_a distance
    def cand_bucket(i):
        seen = {i: 0}; q = collections.deque([i]); hit = {}
        while q:
            x = q.popleft()
            if x in CAND_ROOTS: hit.setdefault(CAND_ROOTS[x], seen[x])
            for p in terms.get(x, {}).get("is_a", []):
                if p not in seen: seen[p] = seen[x] + 1; q.append(p)
        if not hit: return ""
        # most specific among ties (cell < tissue < mts < organ order of specificity)
        order = ["cell", "tissue", "multi_tissue_structure", "organ"]
        d = min(hit.values())
        return sorted([b for b in hit if hit[b] == d], key=lambda b: order.index(b) if b in order else 9)[0]

    bucket = [cand_bucket(i) for i in nodes]

    A = np.zeros((n, n), dtype=np.float32)
    for i in nodes:
        for p in terms[i]["is_a"]:
            if p in idx: A[idx[i], idx[p]] = 1.0; A[idx[p], idx[i]] = 1.0
    docs = [f"{terms[i]['name']}. {terms[i].get('def','')}" for i in nodes]
    tf = TfidfVectorizer(stop_words="english", max_features=8000).fit_transform(docs)
    sims = cosine_similarity(tf, dense_output=False).tocoo()
    for r, c, v in zip(sims.row, sims.col, sims.data):
        if r != c and v >= TEXT_SIM: A[r, c] = max(A[r, c], float(v))
    deg = A.sum(1, keepdims=True); deg[deg == 0] = 1
    T = A / deg; I = np.eye(n, dtype=np.float32)
    Q = sum(c * np.linalg.inv(I - (1 - c) * T) for c in RESTARTS) / len(RESTARTS)
    Qs = np.log(Q + 1.0 / n); Qs -= Qs.mean(0, keepdims=True)
    U, Sg, _ = np.linalg.svd(Qs, full_matrices=False)
    EMB = (U[:, 1:D + 1] * np.sqrt(Sg[1:D + 1])).astype(np.float32)
    EMB /= (np.linalg.norm(EMB, axis=1, keepdims=True) + 1e-9)

    gene2zfa = collections.defaultdict(set); dfq = collections.Counter()
    for line in open(EXPR):
        f = line.rstrip("\n").split("\t")
        if len(f) > 3 and f[3].startswith("ZFA:") and f[3] in idx:
            gene2zfa[f[1].lower()].add(f[3])
    for g, zs in gene2zfa.items():
        for z in zs: dfq[z] += 1
    idf = {z: float(np.log(len(gene2zfa) / (1 + dfq[z]))) for z in dfq}

    np.savez_compressed(CACHE, EMB=EMB)
    json.dump({"nodes": nodes, "names": [terms[i]["name"] for i in nodes], "bucket": bucket,
               "gene2zfa": {g: sorted(z) for g, z in gene2zfa.items()}, "idf": idf}, open(META, "w"))
    return EMB, nodes, [terms[i]["name"] for i in nodes], bucket, gene2zfa, idf


def load(rebuild=False):
    if _S: return _S
    if rebuild or not (os.path.exists(CACHE) and os.path.exists(META)):
        EMB, nodes, names, bucket, g2z, idf = _build()
    else:
        EMB = np.load(CACHE)["EMB"]
        m = json.load(open(META))
        nodes, names, bucket = m["nodes"], m["names"], m["bucket"]
        g2z = {g: set(z) for g, z in m["gene2zfa"].items()}; idf = m["idf"]
    idx = {i: k for k, i in enumerate(nodes)}
    # candidates = identity-bearing nodes, minus abstract structural containers (junk neighbors)
    STOP = {"compound organ", "solid compound organ", "cavitated compound organ", "simple organ",
            "compound organ component", "multi-tissue structure", "portion of tissue",
            "anatomical structure", "anatomical cluster", "anatomical group", "organ", "tissue",
            "duct", "epithelium", "organism subdivision", "anatomical system"}
    cand = np.array([k for k, b in enumerate(bucket)
                     if b and names[k].lower() not in STOP and nodes[k] not in CAND_ROOTS])
    _S.update(EMB=EMB, nodes=nodes, names=names, bucket=bucket, idx=idx, g2z=g2z, idf=idf, cand=cand)
    return _S


def place(markers):
    S = load(); vecs = []; ws = []
    for g in markers:
        for z in S["g2z"].get(g.lower(), ()):
            if z in S["idx"] and S["idf"].get(z, 0) > 0:
                vecs.append(S["EMB"][S["idx"][z]]); ws.append(S["idf"][z])
    if not vecs: return None
    v = np.average(np.array(vecs), axis=0, weights=np.array(ws))
    return (v / (np.linalg.norm(v) + 1e-9)).astype(np.float32)


def neighborhood(markers, k=8):
    """Nearest identity-bearing ZFA nodes for a cluster's markers: the local map.
    Returns [{zfa, name, bucket, cos}], cos in [-1,1] as the guilt-by-association trust."""
    S = load(); v = place(markers)
    if v is None: return []
    cand = S["cand"]; sims = S["EMB"][cand] @ v
    top = cand[np.argsort(-sims)[:k]]
    return [{"zfa": S["nodes"][j], "name": S["names"][j], "bucket": S["bucket"][j],
             "cos": round(float(S["EMB"][j] @ v), 3)} for j in top]


if __name__ == "__main__":
    import sys
    load(rebuild="--rebuild" in sys.argv)
    umap = {str(c["id"]): c for c in json.load(open("/data/zeroshotbio-landingpage/daniotype_data/minifin/umap.json"))["clusters"]}
    GT = json.load(open("/data/zeroshotbio-landingpage/daniotype_data/minifin/patrick_cluster_gt.json"))
    print("=== neighborhood (cell + tissue + organ candidates) vs Patrick GT ===")
    for cid in ["2", "36", "40", "39", "30", "31", "35", "26", "13", "1", "24", "43"]:
        nb = neighborhood(umap[cid].get("degsUp", [])[:25], 6)
        gt = GT.get(cid, {}).get("label", "?")
        print(f"  c{cid} [{gt}]: " + " | ".join(f"{x['name']}·{x['bucket'][:4]}({x['cos']})" for x in nb))
