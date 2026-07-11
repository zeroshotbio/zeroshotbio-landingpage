#!/data/.venv/bin/python
"""Build the MiniFin label menu using Darien's ZFA structural-bucket scheme.

Adopts darien_ZFA.md: 6 principal buckets (anatomical_system, anatomical_system_subtype,
organ, multi_tissue_structure, tissue, cell) + named secondary buckets (organism_substance
e.g. blood, embryonic_structure, anatomical_cluster/group, organism_subdivision,
anatomical_space, acellular_structure, ...) instead of a single "Other". CARO xrefs are
kept as historical alignment metadata only (CARO is deprecated in favour of Uberon).

germ_layer / tissue / lineage tiers come from zlabel panels.yaml; the fine cell-type
vocabulary is the ZFA anatomy ontology grounded to ZFIN wildtype expression, each term
assigned one exclusive structural bucket. Writes the asset to daniotype_data/minifin and
the schema_menu page copy.
"""
import yaml, json, collections, hashlib, re

ZL = "/data/scratch/zlabel"
OBO = f"{ZL}/data/ontologies/zfa.obo"
EXPR = f"{ZL}/data/ontologies/zfin_wildtype_expression.txt"
PANELS = f"{ZL}/src/zlabel/panels.yaml"
OUT = ["/data/zeroshotbio-landingpage/daniotype_data/minifin/label_menu_zfa.json",
       "/data/zeroshotbio-landingpage/src/app/schema_menu/menu.json"]

# ---- parse ZFA ------------------------------------------------------------
terms = {}; cur = None
for line in open(OBO):
    line = line.rstrip("\n")
    if line == "[Term]": cur = {"is_a": [], "part_of": [], "obs": False}; continue
    if line.startswith("[") and line != "[Term]": cur = None; continue
    if cur is None: continue
    if line.startswith("id: "): cur["id"] = line[4:].strip(); terms[cur["id"]] = cur
    elif line.startswith("name: "): cur["name"] = line[6:].strip()
    elif line.startswith("is_a: "): cur["is_a"].append(line[6:].split("!")[0].strip())
    elif line.startswith("relationship: part_of "): cur["part_of"].append(line[22:].split("!")[0].strip())
    elif line.startswith("is_obsolete: true"): cur["obs"] = True
nm = lambda i: terms.get(i, {}).get("name", i)

def anc(i):
    s = {i}; st = [i]
    while st:
        x = st.pop()
        for p in terms.get(x, {}).get("is_a", []):
            if p not in s: s.add(p); st.append(p)
    return s

def dist(i):
    d = {i: 0}; q = collections.deque([i])
    while q:
        x = q.popleft()
        for p in terms.get(x, {}).get("is_a", []):
            if p not in d: d[p] = d[x] + 1; q.append(p)
    return d

# ---- Darien's bucket classifier (validated 18/18 vs darien_ZFA.md) --------
SYS = "ZFA:0001439"
PRINC = [("organ", {"ZFA:0000496", "ZFA:0001492"}), ("multi_tissue_structure", {"ZFA:0001488"}),
         ("tissue", {"ZFA:0001477"}), ("cell", {"ZFA:0009000"})]
SECOND = {"ZFA:0001478": "anatomical_cluster", "ZFA:0001512": "anatomical_group",
          "ZFA:0001308": "organism_subdivision", "ZFA:0000292": "organism_subdivision",
          "ZFA:0001643": "anatomical_space", "ZFA:0001487": "organism_substance",
          "ZFA:0000382": "acellular_structure", "ZFA:0001105": "embryonic_structure",
          "ZFA:0000020": "extraembryonic_structure", "ZFA:0001689": "anatomical_line",
          "ZFA:0005594": "anatomical_surface", "ZFA:0001094": "whole_organism"}
OVERRIDE = {"ZFA:0005954": "anatomical_group", "ZFA:0005955": "anatomical_group"}
_cache = {}

def bucket(i):
    if i in _cache: return _cache[i]
    if i in OVERRIDE: return _cache.setdefault(i, OVERRIDE[i])
    a = anc(i)
    if i == SYS or SYS in terms.get(i, {}).get("is_a", []): r = "anatomical_system"
    elif SYS in a: r = "anatomical_system_subtype"
    else:
        r = None
        for name, roots in PRINC:
            if a & roots: r = name; break
        if r is None:
            dm = dist(i); hits = [(dm[x], x) for x in SECOND if x in a]
            r = SECOND[min(hits)[1]] if hits else "other_unclassified_anatomical_entity"
    _cache[i] = r; return r

# bucket display metadata — principal first (coarse -> fine), then secondary
BUCKET_META = [
    ("anatomical_system", "Anatomical system", "ZFA:0001439", "CARO:0000011", True),
    ("anatomical_system_subtype", "System subtype", "ZFA:0001439*", "—", True),
    ("organ", "Organ", "ZFA:0000496 / ZFA:0001492", "CARO:0000024", True),
    ("multi_tissue_structure", "Multi-tissue structure", "ZFA:0001488", "CARO:0000055", True),
    ("tissue", "Portion of tissue", "ZFA:0001477", "CARO:0000043", True),
    ("cell", "Cell", "ZFA:0009000", "CARO:0000013", True),
    ("organism_substance", "Organism substance", "ZFA:0001487", "—", False),
    ("embryonic_structure", "Embryonic structure", "ZFA:0001105", "—", False),
    ("extraembryonic_structure", "Extraembryonic structure", "ZFA:0000020", "—", False),
    ("anatomical_cluster", "Anatomical cluster", "ZFA:0001478", "—", False),
    ("anatomical_group", "Anatomical group", "ZFA:0001512", "CARO:0000054", False),
    ("organism_subdivision", "Organism subdivision", "ZFA:0001308", "—", False),
    ("anatomical_space", "Anatomical space", "ZFA:0001643", "—", False),
    ("acellular_structure", "Acellular structure", "ZFA:0000382", "—", False),
    ("anatomical_line", "Anatomical line", "ZFA:0001689", "—", False),
    ("anatomical_surface", "Anatomical surface", "ZFA:0005594", "—", False),
    ("whole_organism", "Whole organism", "ZFA:0001094", "—", False),
    ("other_unclassified_anatomical_entity", "Unclassified", "—", "—", False),
]
BUCKET_ORDER = [b[0] for b in BUCKET_META]

# ---- grounding + descent --------------------------------------------------
attested = set(re.findall(r"ZFA:[0-9]{7}", open(EXPR).read()))
kids = collections.defaultdict(set)
for i, t in terms.items():
    for p in t["is_a"] + t["part_of"]: kids[p].add(i)

def desc(a):
    s = set(); st = [a]
    while st:
        x = st.pop()
        for c in kids.get(x, ()):
            if c not in s and "name" in terms.get(c, {}): s.add(c); st.append(c)
    return s

# ---- build ----------------------------------------------------------------
P = yaml.safe_load(open(PANELS))
t2g = {p["tissue"]: p["germ_layer"] for p in P.values() if p.get("kind") == "identity"}
asset = {"schema": "minifin_label_menu/zfa_v3", "stage": "48 hpf (MiniFin)",
         "classifier": "darien_ZFA.md structural buckets (CARO xrefs historical only)",
         "source": {"panels": "zlabel/src/zlabel/panels.yaml@" + open(f"{ZL}/.git/refs/heads/main").read().strip()[:8],
                    "zfa": "zfa.obo releases/2026-06-02", "grounding": "zfin_wildtype_expression (attested only)"},
         "bucket_order": BUCKET_ORDER,
         "bucket_meta": {b[0]: {"display": b[1], "zfa_root": b[2], "caro": b[3], "principal": b[4]} for b in BUCKET_META},
         "tiers": {"germ_layer": [], "tissue": [], "cell_type_broad": []},
         "tissue_germ": t2g, "panels": {}, "state_panels": []}
germ, tis, broad = [], [], []
for pn, p in P.items():
    if p.get("kind") == "state":
        asset["state_panels"].append({"panel": pn, "markers": p.get("markers", [])}); continue
    anchors = p.get("ontology_anchor") or []
    sub = set()
    for x in anchors: sub |= desc(x)
    sub = {s for s in sub if s in attested}
    for x in anchors:
        if x in terms: sub.add(x)
    by = collections.defaultdict(list)
    for s in sub: by[bucket(s)].append({"zfa": s, "name": nm(s)})
    for b in by: by[b] = sorted(by[b], key=lambda z: z["name"])
    asset["panels"][pn] = {"germ_layer": p["germ_layer"], "tissue": p["tissue"], "lineage": p["lineage"],
                           "anchors": [{"zfa": x, "name": nm(x), "bucket": bucket(x)} for x in anchors],
                           "markers": p.get("markers", []),
                           "sub_by_bucket": {b: by[b] for b in BUCKET_ORDER if by[b]}, "n_sub": len(sub)}
    germ.append(p["germ_layer"]); tis.append(p["tissue"]); broad.append(pn)
asset["tiers"]["germ_layer"] = sorted(set(germ))
asset["tiers"]["tissue"] = sorted(set(tis))
asset["tiers"]["cell_type_broad"] = broad
asset["menu_sha"] = hashlib.sha256(json.dumps(asset["panels"], sort_keys=True).encode()).hexdigest()[:16]
for o in OUT:
    json.dump(asset, open(o, "w"), indent=1)

gt = collections.Counter()
for v in asset["panels"].values():
    for b, ts in v["sub_by_bucket"].items(): gt[b] += len(ts)
print("built menu sha", asset["menu_sha"])
print("grounded terms per bucket:")
for b in BUCKET_ORDER:
    if gt[b]: print(f"  {b:38} {gt[b]}")
print("total grounded:", sum(gt.values()))
