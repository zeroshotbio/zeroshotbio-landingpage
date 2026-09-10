"""Generate the OPEN SOURCE reader panel AND its treemap groups from a live listing of the bucket.

Usage: python3 gen_open_source_panel.py <scratch-dir>

The dir holds open_source.tsv (size<TAB>key, from `aws s3 ls --recursive s3://zsb-open-source/`)
and panel_style.txt (the <style> block the SILVER panel opens with), and receives
open_source_panel.txt and open_source_groups.txt.

Unlike silver's, this panel's tiles are generated too. Silver's tiles are hand-maintained literals
and that is where the page has drifted from the bucket every time; this bucket is being filled a
batch at a time, so a literal would be wrong after every batch. Each dataset takes its accent and
its modality band from the SILVER node's tiles in ds-data.js - the same dataset keeps the same
colour in both vaults, and a prefix that is new to the map falls into "Other" rather than vanishing.

Rows are a generic two-level tree - the dataset root, its folders, and their folders - so a dataset
needs no block written for it here. NOTES only improves the wording of folders already known.
"""
import collections, json, pathlib, re, sys

SP = pathlib.Path(sys.argv[1])
DS = pathlib.Path(__file__).resolve().parent
rows = [(int(a), b) for a, b in (l.rstrip("\n").split("\t", 1) for l in open(SP / "open_source.tsv") if l.strip())]
TOT = sum(s for s, _ in rows) or 1
gib = lambda b: b / 1024**3
def esc(t): return t.replace("\\", "\\\\").replace('"', '\\"')

# Objects that are in the bucket but should not be: the exclusions the move declared, which one
# filter bug let through. Shown, marked, never hidden - a delete is a human console act.
STRAY = re.compile(r"^(chemfish/2025_03_release/Paper/|micdropseq/GSE315445/GSE315445_family[.]soft[.]txt$"
                   r"|zebrahub/timepoints/|zebrahub/zebrahub_base[.]h5ad$)")

# Better wording for folders already known; anything else reads "N objects".
NOTES = {
    "chemfish/Paper/": "one preprint, covering work in both releases",
    "chemfish/2025_03_release/": "the March 2025 publication - superseded upstream, recoverable only here",
    "chemfish/2026_09_release/": "the September 2026 publication - what the six URLs serve today",
    "chemfish/2025_03_release/RDS_Data/": "6 artifacts + SHA256SUMS computed at acquisition",
    "chemfish/2026_09_release/RDS_Data/": "6 artifacts + SHA256SUMS computed at acquisition",
    "zscape/Paper/": "the paper and its supplementary workbook",
    "zscape/GSE202639/": "the complete GEO release, 18 files, held verbatim",
    "zscape/GSE202639/reference/": "wild-type series + merged-in injection controls",
    "zscape/GSE202639/zperturb_full/": "the perturbation atlas - 804 embryos, 98 conditions",
    "zscape/GSE202639/zperturb_pilot/": "the pilot that preceded the full run",
}
README_NOTE = "provenance, the per-file SHA-256 table, how it was acquired, how to verify"

# ---- accents and bands, read from the SILVER node so both vaults colour a dataset the same way
src = (DS / "ds-data.js").read_text()
silver = src[src.index('{id:"SILVER"'):src.index('{id:"SREPO"')]
BAND, ACC, ORDER = {}, {}, []
for m in re.finditer(r'\{label:"([^"]+)", tiles:\[(.*?)\]\}', silver, re.S):
    band = m.group(1)
    if band not in ORDER: ORDER.append(band)
    for t in re.finditer(r'key:"([^"]+)"[^}]*?accent:"(#[0-9A-Fa-f]{6})"', m.group(2)):
        BAND[t.group(1)], ACC[t.group(1)] = band, t.group(2)

def top(k): return "human/" + k.split("/")[1] + "/" if k.startswith("human/") else k.split("/")[0] + "/"
by = collections.defaultdict(list)
for s, k in rows: by[top(k)].append((s, k))
agg = {p: (len(v), sum(s for s, _ in v)) for p, v in by.items()}

def row(path, size, kind, note, depth=1):
    pad = "│   " * (depth - 1) + ("├── " if depth > 1 else "")
    return (f'<div class=\\"fk {kind} d{depth}\\">'
            f'<span class=\\"p\\">{esc(pad + path)}</span><span class=\\"n\\">{gib(size):,.2f}</span>'
            f'<span class=\\"t\\" title=\\"{esc(note)}\\">{esc(note)}</span></div>')

def folders(prefix, items):
    """Immediate child folders of prefix -> (objects, bytes, any-stray)."""
    out = collections.OrderedDict()
    for s, k in sorted(items, key=lambda r: r[1]):
        rest = k[len(prefix):]
        if "/" in rest:
            f = prefix + rest.split("/", 1)[0] + "/"
            n, b, st = out.get(f, (0, 0, False))
            out[f] = (n + 1, b + s, st or bool(STRAY.search(k)))
    return out

def block(p):
    n, size = agg[p]
    items = by[p]
    has_readme = any(k == p + "README.md" for _, k in items)
    tag = " · custody in README" if has_readme else " · NO README"
    b = []
    if has_readme:
        b.append(row("README.md", next(s for s, k in items if k == p + "README.md"), "ok", README_NOTE))
    for f, (fn, fb, fst) in folders(p, items).items():
        whole_stray = all(STRAY.search(k) for _, k in items if k.startswith(f))
        kind = "del" if whole_stray else "ok"
        note = ("stray copy - excluded from the move, landed through a filter bug since fixed; "
                "awaiting delete in the console") if whole_stray else NOTES.get(f, f"{fn} objects")
        b.append(row(f[len(p):], fb, kind, note))
        for g, (gn, gb, gst) in folders(f, [(s, k) for s, k in items if k.startswith(f)]).items():
            gk = "del" if all(STRAY.search(k) for _, k in items if k.startswith(g)) else "ok"
            gnote = ("stray copy - awaiting delete in the console" if gk == "del"
                     else NOTES.get(g, f"{gn} objects"))
            b.append(row(g[len(f):], gb, gk, gnote, 2))
    for s, k in items:
        rest = k[len(p):]
        if "/" not in rest and rest != "README.md":
            b.append(row(rest, s, "del" if STRAY.search(k) else "ok", "at the dataset root"))
    acc = ACC.get(p, "#8A8A8A")
    return (f'<div class=\\"fkds\\" style=\\"--acc:{acc}\\"><h5>{p}<s>{n:,} obj · {gib(size):,.2f} GiB '
            f'· {100 * size / TOT:.1f}%{tag}</s></h5><div class=\\"fkw\\">'
            f'<div class=\\"fk fkh\\"><span>path</span><span class=\\"n\\">GiB</span><span>note</span></div>'
            f'{"".join(b)}</div></div>')

def sec(t, note): return f'<div class=\\"fksec\\"><b>{esc(t)}</b><span>{esc(note)}</span></div>'

out = []
kinds = [("ok", "In place — key-identical to where silver held it, confirmed by size and CRC64"),
         ("del", "Stray — should not be here; the delete has not been made")]
out.append('<div class=\\"fkl\\">' + "".join(f'<b><i class=\\"sw {k}\\"></i>{esc(t)}</b>' for k, t in kinds) + "</div>")
out.append(sec("s3://zsb-open-source",
               "every dataset somebody else published, held as its origin released it. Nothing here is "
               "ours. Keys are identical to silver's, and each dataset's root README.md is the custody "
               "record: provenance, a per-file SHA-256 table, how it was acquired, and how to verify it"))
bands = collections.OrderedDict((b, []) for b in ORDER + ["Other"])
for p in sorted(agg, key=lambda x: -agg[x][1]):
    bands[BAND.get(p, "Other")].append(p)
for band, ps in bands.items():
    if not ps: continue
    out.append(sec(f"Acquired · {band}", f"{len(ps)} dataset{'s' if len(ps) != 1 else ''}"))
    out.extend(block(p) for p in ps)

# What has not moved yet, so the reader can see the migration is partial rather than infer it.
acquired = [k for k in BAND if k not in ("megafin/", "minifin/", "megafin-1/")]
waiting = [k for k in acquired if k not in agg]
if waiting:
    out.append(sec(f"Not moved yet · {len(waiting)} of {len(acquired)}",
                   "still only in silver: " + ", ".join(sorted(waiting))))

style = (SP / "panel_style.txt").read_text()
(SP / "open_source_panel.txt").write_text(style + "".join(out))

groups = []
for band, ps in bands.items():
    if ps:
        tiles = ", ".join(f'{{key:"{p}", value:{agg[p][1]}, objs:{agg[p][0]}, accent:"{ACC.get(p, "#8A8A8A")}"}}' for p in ps)
        groups.append(f'{{label:"{band}", tiles:[{tiles}]}}')
(SP / "open_source_groups.txt").write_text(f'[{{label:"Acquired (Open Source)", sub:[{", ".join(groups)}]}}]')
json.dump({"objects": len(rows), "bytes": TOT, "gib": round(gib(TOT), 2), "datasets": len(agg),
           "waiting": len(waiting)}, open(SP / "open_source_figures.json", "w"))
print(f"{len(rows)} obj · {gib(TOT):,.2f} GiB · {len(agg)} datasets · {len(waiting)} not moved yet")

# --splice: write groups, right and panel into the OPEN node of ds-data.js, and nothing else. The
# node is found by its id and bounded by the next node, so BRONZE's and SILVER's identical-looking
# panel strings cannot be hit by mistake.
if "--splice" in sys.argv:
    path = DS / "ds-data.js"
    s = path.read_text()
    a = s.index('{id:"OPEN"'); z = s.index('{id:"', a + 1)
    node = s[a:z]
    node = re.sub(r'\n groups:\[.*?\],\n', lambda m: f'\n groups:{(SP / "open_source_groups.txt").read_text()},\n', node, count=1, flags=re.S)
    node = re.sub(r'right:"[^"]*"', f'right:"{len(rows):,} obj · {gib(TOT):,.2f} GiB"', node, count=1)
    node = re.sub(r'\n panel:"(?:[^"\\]|\\.)*",\n', lambda m: f'\n panel:"{(SP / "open_source_panel.txt").read_text()}",\n', node, count=1)
    path.write_text(s[:a] + node + s[z:])
    print("spliced into the OPEN node of", path)
