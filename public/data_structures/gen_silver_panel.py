"""Generate the SILVER reader panel from a live listing of the warehouse.

Usage: python3 gen_silver_panel.py <scratch-dir>. The dir holds silver.tsv (size<TAB>key, from
aws s3 ls --recursive) and panel_style.txt (the <style> block the SILVER panel opens with), and
receives silver_panel.txt. Scratchpads are per-session and get cleaned up, so the dir is an
argument rather than a path baked in: the last one baked in was gone by the next read.
"""
import collections, pathlib, sys

SP=sys.argv[1]
SRC=f'{SP}/silver.tsv'
rows=[l.rstrip("\n").split("\t") for l in open(SRC) if l.strip()]
rows=[(int(a),b) for a,b in rows]
TOT=sum(sz for sz,_ in rows)
gib=lambda b: b/1024**3
def esc(t): return t.replace('\\','\\\\').replace('"','\\"')
# Three states, not four kinds. The dataset accents on the block borders are what tells you WHICH
# dataset you are looking at; a second colour system inside each tree was competing with them and
# winning. What a row inside a tree needs to say is only whether it is where it should be.
KINDS=[
 ("ok",  "In place — where the convention says it belongs"),
 ("del", "Pending deletion — superseded; the delete has not been made"),
 ("leg", "Legacy — retained and readable, not what to build on"),
]

def row(path,size,kind,note,depth=1):
    pad='\u2502   '*(depth-1)+('\u251c\u2500\u2500 ' if depth>1 else '')
    return (f'<div class=\\"fk {kind} d{depth}\\">'
            f'<span class=\\"p\\">{esc(pad+path)}</span><span class=\\"n\\">{gib(size):,.2f}</span>'
            f'<span class=\\"t\\" title=\\"{esc(note)}\\">{esc(note)}</span></div>')

# Which prefixes have a manifest in zsb-bronze pinning their bytes. Four do, on four
# unmerged branches; the rest are bytes in a bucket with their custody written down
# nowhere. It is the one thing a reader deciding what to work on next needs, so it is
# on the header rather than three paragraphs into the panel.
# A manifest in zsb-bronze names these bytes. All nineteen sit on unmerged branches — the
# four originals and the fifteen opened 2026-09-09 — which is the same state the first four
# were in when this marker was introduced, so they read the same way. The three still without
# one are keller/, zfap/ and tomoseq/.
PINNED={'chemfish/','zscape/','zebrahub/','daniocell/','platt/','zmap/','wagner/','raj/',
        'linnaeus/','trunk30hpf/','micdropseq/','zesta/','farrell/','zcl2/','celloracle/','zcl1/',
        'farnsworth/','zfin/','itec/'}
OURS={'megafin/','minifin/'}
# Converted here from an open-source release by zsb-silver's intake (2026-09-17 on). Their custody
# is the intake's own source pins against s3://zsb-open-source, not a zsb-bronze manifest.
INTAKE={'chemfish/','zscape/'}
def custody(name):
    if name in OURS: return ''
    if name in INTAKE: return ' · from zsb-open-source'
    return ' · pinned' if name in PINNED else ' · NO RECORD'

def block(name,acc,objs,size,body,legacy=False):
    # a wholly-legacy dataset wears the dashed rule its tile wears on the map,
    # rather than an accent that would read as a live dataset in both places
    cls='fkds leg' if legacy else 'fkds'
    return (f'<div class=\\"{cls}\\" style=\\"--acc:{acc}\\"><h5>{name}<s>{objs:,} obj · {gib(size):,.2f} GiB '
            f'· {100*size/TOT:.1f}%{custody(name)}</s></h5><div class=\\"fkw\\">'
            f'<div class=\\"fk fkh\\"><span>path</span><span class=\\"n\\">GiB</span><span>note</span></div>'
            f'{body}</div></div>')

def get(pref): return [(s,k) for s,k in rows if k.startswith(pref)]
def agg(pref):
    e=get(pref); return len(e), sum(s for s,_ in e)

out=[]
B={}
# legend
leg=''.join(f'<b><i class=\\"sw {k}\\"></i>{esc(t)}</b>' for k,t in KINDS)
out.append(f'<div class=\\"fkl\\">{leg}</div>')

# ---- megafin/
n,s=agg('megafin/')
b=[row('CHANGELOG.md',get('megafin/CHANGELOG.md')[0][0],'ok','the ledger, rewritten last on every publish')]
for v,recipe,cells in (('v1','parse-settings','1,340,518'),('v2','ambient-profile','1,409,574')):
    vn,vs=agg(f'megafin/{v}/')
    b.append(row(f'{v}/',vs,'ok',f'{recipe} — {cells} called cells'))
    for sz,k in sorted(get(f'megafin/{v}/'),key=lambda r:-r[0]):
        leaf=k.split('/')[-1]
        b.append(row(leaf,sz,'ok','the release artifact' if leaf.endswith('.h5ad')
                     else 'what the policy was and what it produced',2))
B['megafin/']=block('megafin/','#C08552',n,s,''.join(b))

# ---- the acquired datasets are not here any more. All 23 were copied key for key to
# s3://zsb-open-source on 2026-09-10 and silver's copies were deleted in the console on
# 2026-09-11; their blocks are drawn by gen_open_source_panel.py now. Their hand-written
# blocks from this file are in git history (last in fa9034e7).

# ---- megafin-1/ is not here any more. characterization/ (61 objects, 5.00 GiB) was deleted
# in the console on 2026-09-13, the same day as its bronze archive copy. Its block is in git
# history (last in acd200fb).

# ---- minifin/
n,s=agg('minifin/')
b=[row('CHANGELOG.md',get('minifin/CHANGELOG.md')[0][0],'ok','the ledger')]
for v,recipe,cells in (('v1','parse-settings','94,864'),('v2','barcode-ranks','94,089'),
                       ('v3','ambient-profile','106,022')):
    vn,vs=agg(f'minifin/{v}/')
    b.append(row(f'{v}/',vs,'ok',f'{recipe} — {cells} called cells'))
    for sz,k in sorted(get(f'minifin/{v}/'),key=lambda r:-r[0]):
        leaf=k.split('/')[-1]
        b.append(row(leaf,sz,'ok','the release artifact' if leaf.endswith('.h5ad')
                     else 'what the policy was and what it produced',2))
flat=[(sz,k) for sz,k in get('minifin/') if '/' not in k[len('minifin/'):] and not k.endswith('CHANGELOG.md')]
b.append(row('(six flat keys)',sum(sz for sz,_ in flat),'leg',
             f'{len(flat)} objects — rebuild h5ads, a disposition parquet, and .provenance.json sidecars'))
B['minifin/']=block('minifin/','#9C7BA0',n,s,''.join(b))

# ---- chemfish/ and zscape/: the intake. zsb-silver converts an open-source release verbatim out of
# s3://zsb-open-source into one h5ad and publishes it here, so these are ours in the sense that
# matters for silver - a disagreement with the source is our bug - while the bytes they came from
# stay in the OPEN vault.
for name,acc,v,what in (('chemfish/','#7FB5A8','v1','1,782,510 cells — the authors\u2019 2026-09 release, as published'),
                        ('zscape/','#6E93B8','v1','3,317,314 cells — GSE202639, both main arms joined')):
    n,s=agg(name)
    b=[row('CHANGELOG.md',get(name+'CHANGELOG.md')[0][0],'ok','the ledger')]
    vn,vs=agg(f'{name}{v}/')
    b.append(row(f'{v}/',vs,'ok',what))
    for sz,k in sorted(get(f'{name}{v}/'),key=lambda r:-r[0]):
        leaf=k.split('/')[-1]
        b.append(row(leaf,sz,'ok','the release artifact' if leaf.endswith('.h5ad')
                     else 'what was read and how the read was proven',2))
    B[name]=block(name,acc,n,s,''.join(b))

# ---- assemble: ours, then a pointer to where the acquired datasets went, and inside each the order a reader wants
# rather than the order the bytes happen to fall in. The map draws the same split as
# two columns; this is the same distinction in the same words, so a reader crossing
# between them is not asked to work out that they are the same idea.
def sec(t, note):
    return (f'<div class=\\"fksec\\"><b>{esc(t)}</b><span>{esc(note)}</span></div>')

out.append(sec("Parse (Our Data)",
               "produced here from a Parse delivery; a disagreement with the source is our bug"))
for k in ('minifin/','megafin/'):
    out.append(B[k])
out.append(sec("Open Source, converted here",
               "zsb-silver's intake read the authors' release out of s3://zsb-open-source and wrote it "
               "here as one h5ad, nothing called or filtered; the source bytes stay in the OPEN vault"))
for k in ('zscape/','chemfish/'):
    out.append(B[k])
out.append(sec("Acquired (Open Source) \u00b7 moved out",
               "every dataset somebody else published lives in s3://zsb-open-source, the OPEN vault in "
               "the left lane: 23 copied here key for key 2026-09-10 and deleted from silver 2026-09-11, "
               "and 3 more (Replogle, Nadig, X-Atlas/Orion) uploaded straight there 2026-09-11. Nothing "
               "here is a copy of theirs; the two above are conversions this account made"))

style=open(f'{SP}/panel_style.txt').read()
panel=style+''.join(out)
pathlib.Path(f'{SP}/silver_panel.txt').write_text(panel)
print("panel chars:",len(panel))
print("blocks:",len(out)-1,"| total accounted:",f"{TOT:,}")
