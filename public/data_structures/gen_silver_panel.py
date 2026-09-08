"""Generate the SILVER reader panel from a live listing of the warehouse."""
import collections, pathlib

SRC='/tmp/claude-1001/-usr-bin/03d08ecb-360f-4b56-876f-e00ce749f9b3/scratchpad/silver.tsv'
rows=[l.rstrip("\n").split("\t") for l in open(SRC) if l.strip()]
rows=[(int(a),b) for a,b in rows]
TOT=sum(sz for sz,_ in rows)
gib=lambda b: b/1024**3
def esc(t): return t.replace('\\','\\\\').replace('"','\\"')
def fade(c,a=".13"):
    r,g,b=int(c[1:3],16),int(c[3:5],16),int(c[5:7],16)
    return f'rgba({r},{g},{b},{a})'

KINDS=[
 ("published","#4FCB8A","Published release — written here by zsb-bronze under the version convention"),
 ("acquired", "#6FA8E8","Acquired source — taken verbatim from a public origin, custody in zsb-bronze"),
 ("prerepo",  "#8A8A92","Predates the repos — written by neither, never versioned"),
 ("legacy",   "#B07AA1","Legacy — archived elsewhere or superseded; retained, never published"),
]
COL={k:c for k,c,_ in KINDS}

def row(path,size,kind,note,depth=1):
    c=COL[kind]
    pad='│   '*(depth-1)+('├── ' if depth>1 else '')
    return (f'<div class=\\"fk d{depth}\\" style=\\"border-left-color:{c};background:{fade(c)};color:{c}\\">'
            f'<span class=\\"p\\">{esc(pad+path)}</span><span class=\\"n\\">{gib(size):,.2f}</span>'
            f'<span class=\\"t\\" title=\\"{esc(note)}\\">{esc(note)}</span></div>')

def block(name,acc,objs,size,body):
    return (f'<div class=\\"fkds\\" style=\\"--acc:{acc}\\"><h5>{name}<s>{objs:,} obj · {gib(size):,.2f} GiB '
            f'· {100*size/TOT:.1f}%</s></h5><div class=\\"fkw\\">'
            f'<div class=\\"fk fkh\\"><span>path</span><span class=\\"n\\">GiB</span><span>note</span></div>'
            f'{body}</div></div>')

def get(pref): return [(s,k) for s,k in rows if k.startswith(pref)]
def agg(pref):
    e=get(pref); return len(e), sum(s for s,_ in e)

out=[]
# legend
leg=''.join(f'<b><i style=\\"background:linear-gradient(90deg,{c} 0 50%,{fade(c)} 50%)\\"></i>{esc(t)}</b>'
            for _,c,t in KINDS)
out.append(f'<div class=\\"fkl\\">{leg}</div>')

# ---- megafin/
n,s=agg('megafin/')
b=[row('CHANGELOG.md',get('megafin/CHANGELOG.md')[0][0],'published','the ledger, rewritten last on every publish')]
for v,recipe,cells in (('v1','parse-settings','1,340,518'),('v2','ambient-profile','1,409,574')):
    vn,vs=agg(f'megafin/{v}/')
    b.append(row(f'{v}/',vs,'published',f'{recipe} — {cells} called cells'))
    for sz,k in sorted(get(f'megafin/{v}/'),key=lambda r:-r[0]):
        leaf=k.split('/')[-1]
        b.append(row(leaf,sz,'published','the release artifact' if leaf.endswith('.h5ad')
                     else 'what the policy was and what it produced',2))
out.append(block('megafin/','#C08552',n,s,''.join(b)))

# ---- chemfish/
# Two releases of the same six URLs. The origin overwrites in place and announces nothing, so the
# release folders are the only thing keeping the March 2025 package from having been destroyed by
# the September 2026 one. The panel shows both because choosing between them is the reader's job.
n,s=agg('chemfish/')
b=[row('README.md',get('chemfish/README.md')[0][0],'acquired',
       'which release to use, and why neither contains the other')]
for rel,label in (('2025_03_release','the authors’ March 2025 publication — superseded upstream, recoverable only here'),
                  ('2026_09_release','the September 2026 publication — what the six URLs serve today')):
    _,rs=agg(f'chemfish/{rel}/')
    b.append(row(f'{rel}/',rs,'acquired',label))
    rn,rr=agg(f'chemfish/{rel}/RDS_Data/')
    b.append(row('RDS_Data/',rr,'acquired',
                 f'{rn} objects — 6 data files + SHA256SUMS computed here, not published upstream',2))
    for _,k in sorted(get(f'chemfish/{rel}/RDS_Data/'),key=lambda r:-r[0])[:2]:
        sz=[x for x,y in rows if y==k][0]
        b.append(row(k.split('/')[-1],sz,'acquired',
                     'sealed BPCells cds tarball' if k.endswith('.tar') else 'author result table',3))
    pp=get(f'chemfish/{rel}/Paper/')
    if pp:
        b.append(row('Paper/',sum(x for x,_ in pp),'acquired',
                     'the bioRxiv preprint — supplements were published as data, not documents',2))
    b.append(row('README.md',get(f'chemfish/{rel}/README.md')[0][0],'acquired',
                 'provenance, what changed, and the do-not-re-fetch warning',2))
out.append(block('chemfish/','#7FB5A8',n,s,''.join(b)))

# ---- zebrahub/
n,s=agg('zebrahub/')
tn,ts=agg('zebrahub/timepoints/')
b=[row('zebrahub_base.h5ad',get('zebrahub/zebrahub_base.h5ad')[0][0],'prerepo','the combined atlas'),
   row('timepoints/',ts,'prerepo',f'{tn} per-stage releases, 10 hpf to 10 dpf')]
out.append(block('zebrahub/','#8A8A92',n,s,''.join(b)))

# ---- megafin-1/
n,s=agg('megafin-1/')
g=collections.Counter(); c=collections.Counter()
for sz,k in get('megafin-1/'):
    p='/'.join(k.split('/')[:3]); g[p]+=sz; c[p]+=1
b=[row('characterization/',s,'legacy',
        f'{n} objects — already archived to bronze 2026-08-29, byte-identical, zero size disagreements')]
for p,sz in g.most_common(4):
    b.append(row(p.split('/')[-1],sz,'legacy',f'{c[p]} obj',2))
out.append(block('megafin-1/','#6E8CA0',n,s,''.join(b)))

# ---- minifin/
n,s=agg('minifin/')
b=[row('CHANGELOG.md',get('minifin/CHANGELOG.md')[0][0],'published','the ledger')]
for v,recipe,cells in (('v1','parse-settings','94,864'),('v2','barcode-ranks','94,089'),
                       ('v3','ambient-profile','106,022')):
    vn,vs=agg(f'minifin/{v}/')
    b.append(row(f'{v}/',vs,'published',f'{recipe} — {cells} called cells'))
    for sz,k in sorted(get(f'minifin/{v}/'),key=lambda r:-r[0]):
        leaf=k.split('/')[-1]
        b.append(row(leaf,sz,'published','the release artifact' if leaf.endswith('.h5ad')
                     else 'what the policy was and what it produced',2))
flat=[(sz,k) for sz,k in get('minifin/') if '/' not in k[len('minifin/'):] and not k.endswith('CHANGELOG.md')]
b.append(row('(six flat keys)',sum(sz for sz,_ in flat),'legacy',
             f'{len(flat)} objects — rebuild h5ads, a disposition parquet, and .provenance.json sidecars'))
out.append(block('minifin/','#9C7BA0',n,s,''.join(b)))

style=open('/tmp/claude-1001/-usr-bin/03d08ecb-360f-4b56-876f-e00ce749f9b3/scratchpad/panel_style.txt').read()
panel=style+''.join(out)
pathlib.Path('/tmp/claude-1001/-usr-bin/03d08ecb-360f-4b56-876f-e00ce749f9b3/scratchpad/silver_panel.txt').write_text(panel)
print("panel chars:",len(panel))
print("blocks:",len(out)-1,"| total accounted:",f"{TOT:,}")
