"""Generate the SILVER reader panel from a live listing of the warehouse."""
import collections, pathlib

SRC='/tmp/claude-1001/-data/1a934452-8c41-4975-b302-6d9d32c09db2/scratchpad/silver.tsv'
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
# A manifest in zsb-bronze names these bytes. All eighteen sit on unmerged branches — the
# four originals and the fourteen opened 2026-09-09 — which is the same state the first four
# were in when this marker was introduced, so they read the same way. The three without one
# are the three that are not single-cell transcriptomes, which is not a coincidence: a custody
# module for imaging or anatomy would be the first of its kind.
PINNED={'chemfish/','zscape/','zebrahub/','daniocell/','platt/','zmap/','wagner/','raj/',
        'linnaeus/','trunk30hpf/','micdropseq/','zesta/','farrell/','zcl2/','celloracle/','zcl1/',
        'farnsworth/','zfin/'}
OURS={'megafin/','minifin/','megafin-1/'}
def custody(name):
    if name in OURS: return ''
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

# ---- chemfish/
# Two releases of the same six URLs. The origin overwrites in place and announces nothing, so the
# release folders are the only thing keeping the March 2025 package from having been destroyed by
# the September 2026 one. The panel shows both because choosing between them is the reader's job.
#
# Paper/ sits at the dataset root, not inside a release: one publication describing work present in
# both. Its contents are listed rather than summarised, because "Paper/" alone does not tell you
# whether it holds one preprint or a folder of them, and the answer changes if a revision lands.
n,s=agg('chemfish/')
b=[row('README.md',get('chemfish/README.md')[0][0],'ok',
       'which release to use, and why neither contains the other')]
_,ps=agg('chemfish/Paper/')
b.append(row('Paper/',ps,'ok','one preprint, covering work in both releases'))
for sz,k in sorted(get('chemfish/Paper/'),key=lambda r:-r[0]):
    leaf=k.split('/')[-1]
    b.append(row(leaf,sz,'ok',
                 'bioRxiv 2025-04-03 — 38 pages; predates the 2026-09 genetic arm'
                 if leaf.endswith('.pdf') else 'what the preprint does and does not cover',2))
for rel,label in (('2025_03_release','the authors’ March 2025 publication — superseded upstream, recoverable only here'),
                  ('2026_09_release','the September 2026 publication — what the six URLs serve today')):
    _,rs=agg(f'chemfish/{rel}/')
    b.append(row(f'{rel}/',rs,'ok',label))
    rn,rr=agg(f'chemfish/{rel}/RDS_Data/')
    b.append(row('RDS_Data/',rr,'ok',
                 f'{rn} objects — 6 data files + SHA256SUMS computed here, not published upstream',2))
    for _,k in sorted(get(f'chemfish/{rel}/RDS_Data/'),key=lambda r:-r[0])[:2]:
        sz=[x for x,y in rows if y==k][0]
        b.append(row(k.split('/')[-1],sz,'ok',
                     'sealed BPCells cds tarball' if k.endswith('.tar') else 'author result table',3))
    pp=get(f'chemfish/{rel}/Paper/')
    if pp:
        b.append(row('Paper/',sum(x for x,_ in pp),'del',
                     'superseded by chemfish/Paper/ — awaiting delete, the instance role has no s3:DeleteObject',2))
    b.append(row('README.md',get(f'chemfish/{rel}/README.md')[0][0],'ok',
                 'provenance, what changed, and the do-not-re-fetch warning',2))
B['chemfish/']=block('chemfish/','#7FB5A8',n,s,''.join(b))

# ---- zscape/
# In the warehouse with no module in any repo - not written, not proposed. The three arms are the
# authors' own split and the folder is the accession rather than a date, because GEO gives a stable
# identifier where ChemFish gives none. The merged, deduplicated object is deliberately absent: it
# filters, merges and dedupes, which is three opinions past what this tier holds.
n,s=agg('zscape/')
b=[row('README.md',get('zscape/README.md')[0][0],'ok',
       'which arm to use, and why the merged object is not here')]
pn,ps=agg('zscape/Paper/')
b.append(row('Paper/',ps,'ok',f'{pn} objects - the paper and its supplementary workbook'))
_,gs=agg('zscape/GSE202639/')
b.append(row('GSE202639/',gs,'ok','the complete GEO release, 18 files, held verbatim'))
for arm,note in (('reference','wild-type series + merged-in injection controls'),
                 ('zperturb_full','the perturbation atlas - 804 embryos, 98 conditions'),
                 ('zperturb_pilot','the pilot that preceded the full run')):
    an,asz=agg(f'zscape/GSE202639/{arm}/')
    b.append(row(f'{arm}/',asz,'ok',f'{an} files - {note}',2))
B['zscape/']=block('zscape/','#6E93B8',n,s,''.join(b))

# ---- zebrahub/
# Reshaped 2026-09-08. The release now sits under the Figshare article id AND its version - the
# first prefix here whose name carries a version its origin actually declares - and it holds the
# .h5ad.zip archives the origin serves rather than the payloads a retired downloader unzipped.
# That is what lets MD5SUMS.authors exist: Figshare publishes a checksum per file, so this is the
# only prefix in the bucket that can prove its bytes are the ones the authors uploaded.
#
# timepoints/ and zebrahub_base.h5ad are the 2026-07-27 upload and stay grey. Right bytes, wrong
# shape: one is renamed, none is what the origin serves, and the 15 hpf packaging duplicate sits
# among them unmarked. Deleting a released object is a human console act, so they are described.
n,s_=agg('zebrahub/')
b=[row('README.md',get('zebrahub/README.md')[0][0],'ok',
       'which object is canonical, and what predates the convention')]
pn,ps=agg('zebrahub/Paper/')
b.append(row('Paper/',ps,'ok',f'{pn} objects - the paper, five videos, both tables, six related methods'))
cn,cs=agg('zebrahub/code/')
b.append(row('code/',cs,'ok',f'{cn} objects - the authors own source snapshots, new in this dataset'))
rn,rs=agg('zebrahub/20510367/v1/')
b.append(row('20510367/v1/',rs,'ok',f'{rn} objects - the complete Figshare article, held as .zip'))
b.append(row('MD5SUMS.authors',get('zebrahub/20510367/v1/MD5SUMS.authors')[0][0],'ok',
             'the origin attesting to its own bytes - the only one in this bucket',2))
b.append(row('zf_atlas_full_v1_release.h5ad.zip',
             get('zebrahub/20510367/v1/zf_atlas_full_v1_release.h5ad.zip')[0][0],'ok',
             'the canonical object - 120,444 cells, no concatenation needed',2))
b.append(row('zf_atlas_15hpf_v1_release.h5ad.zip',
             get('zebrahub/20510367/v1/zf_atlas_15hpf_v1_release.h5ad.zip')[0][0],'ok',
             'held, NOT usable - a packaging duplicate of 14 hpf; the exclusion is recorded',2))
tn,ts=agg('zebrahub/timepoints/')
b.append(row('timepoints/',ts,'leg',f'{tn} extracted payloads from 2026-07-27 - right bytes, pre-convention shape'))
b.append(row('zebrahub_base.h5ad',get('zebrahub/zebrahub_base.h5ad')[0][0],'leg',
             'our name for zf_atlas_full_v1_release.h5ad - this tier does not rename'))
B['zebrahub/']=block('zebrahub/','#6FA8E8',n,s_,''.join(b))

# ---- daniocell/
# The first dataset here with more than one origin, and the folders say so: an accession from GEO, a
# date from a portal that publishes nothing else, and a code prefix whose version lives in the
# filename because only one of its two archives has one. Paper/ holds the article - which the
# instance-side record said for months was unobtainable, under a filename that never said what it
# was. All rows are in place; nothing here predates the convention.
n,s_=agg('daniocell/')
b=[row('README.md',get('daniocell/README.md')[0][0],'ok',
       'three origins, and which object is canonical in each')]
pn,ps=agg('daniocell/Paper/')
b.append(row('Paper/',ps,'ok',f'{pn} objects - the article and its nine supplementary files'))
b.append(row('mmc9.pdf',get('daniocell/Paper/mmc9.pdf')[0][0],'ok',
             'Cell Press Document S2 - the full 55-page article, found not fetched',2))
cn,cs=agg('daniocell/code/')
b.append(row('code/',cs,'ok',f'{cn} objects - Zenodo v1.01 (md5-attested) + GitHub main'))
gn,gs=agg('daniocell/GSE223922/')
b.append(row('GSE223922/',gs,'ok',f'{gn} objects - the GEO release; the matrix is log-normalized, not raw'))
rn,rs=agg('daniocell/portal/')
b.append(row('portal/2024_08_release/',rs,'ok',
             f'{rn} objects - the Seurat object, the ZFA-backed cluster table, the loader'))
b.append(row('cluster_annotations.csv',get('daniocell/portal/2024_08_release/cluster_annotations.csv')[0][0],'ok',
             '521 clusters, ZFA ids on 358 - in no other origin',2))
B['daniocell/']=block('daniocell/','#C4708A',n,s_,''.join(b))

# ---- micdropseq/
# The completest GEO release in the bucket: 111 of 111 supplementary files. An earlier pass held
# nine - the two Seurat objects - and called the other hundred a documented gap. The raw per-pool
# matrices are what make re-calling cells possible at all, which is the whole reason this warehouse
# keeps three MiniFin releases, so "the objects are enough" was the wrong call.
n,s_=agg('micdropseq/')
b=[row('README.md',get('micdropseq/README.md')[0][0],'ok','two experiments, and why their objects differ')]
pn,ps=agg('micdropseq/Paper/')
b.append(row('Paper/',ps,'ok',f'{pn} objects - the article, ten supplements, the preprint'))
cn,cs=agg('micdropseq/code/')
b.append(row('code/',cs,'ok',f'{cn} objects - Zenodo v1.0.2 (md5-attested) + GitHub'))
gn,gs=agg('micdropseq/GSE315445/')
b.append(row('GSE315445/',gs,'ok',f'{gn} objects - the COMPLETE GEO release, all 111 files'))
b.append(row('..._micdrop_50_gene.rds',get('micdropseq/GSE315445/GSE315445_micdrop_50_gene.rds')[0][0],'ok',
             'flagship, 226,492 cells, Seurat v4.1.3 - CRISPR assay carries per-cell guide',2))
b.append(row('..._x1..x16_raw_matrix.mtx.gz',
             sum(sz for sz,k in get('micdropseq/GSE315445/') if '_raw_matrix' in k),'ok',
             'every droplet incl. empties - the input to any re-call of cells',2))
b.append(row('..._family.soft.txt',get('micdropseq/GSE315445/GSE315445_family.soft.txt')[0][0],'del',
             'our decompression, not GEO\'s - uploaded before the release was completed',2))
B['micdropseq/']=block('micdropseq/','#B5A04A',n,s_,''.join(b))

# ---- platt/
# The only prefix here whose origin vouches for EVERY byte: served from S3, and an S3 ETag is an md5
# for a single-part object and a reproducible multipart hash for the two tarballs. Six of six agree.
n,s_=agg('platt/')
b=[row('README.md',get('platt/README.md')[0][0],'ok','why the folder is a build version, and what BPCells means here')]
vn,vs=agg('platt/v2.2.1/')
b.append(row('v2.2.1/',vs,'ok',f'{vn} objects - the version is inside the artifacts, not on the page'))
b.append(row('reference_cds.tar',get('platt/v2.2.1/reference_cds.tar')[0][0],'ok',
             'the reference atlas - BPCells-backed Monocle3 cds',2))
b.append(row('LMX1B_projected_cds.tar',get('platt/v2.2.1/LMX1B_projected_cds.tar')[0][0],'ok',
             'lmx1ba/lmx1bb projected into that reference',2))
b.append(row('combined_state_graphs.rds',get('platt/v2.2.1/combined_state_graphs.rds')[0][0],'ok',
             '3,226 B - the inferred state graph. The claim, not the evidence',2))
b.append(row('ETAGS.origin',get('platt/v2.2.1/ETAGS.origin')[0][0],'ok',
             "the origin's own etags - 6 of 6 reproduce from these bytes",2))
B['platt/']=block('platt/','#6FAE72',n,s_,''.join(b))

# ---- zesta/
# The spatial modality. Both halves arrived in one directory because CNGB nests the accession under
# a platform directory also called stomics; splitting on the string rather than the position put all
# thirteen in the spatial folder. Caught before upload, and written into the prefix's own README.
n,s_=agg('zesta/')
b=[row('README.md',get('zesta/README.md')[0][0],'ok','six stages, two modalities, and how to tell them apart')]
an,asz=agg('zesta/STDS0000057/')
b.append(row('STDS0000057/',asz,'ok',f'{an} objects - the complete STOmics study release'))
tn,ts=agg('zesta/STDS0000057/stomics/')
b.append(row('stomics/',ts,'ok',f'{tn} Stereo-seq objects - observations are spatial bins',2))
cn2,cs2=agg('zesta/STDS0000057/scrna/')
b.append(row('scrna/',cs2,'ok',f'{cn2} dissociated objects, same six stages 3-24 hpf',2))
B['zesta/']=block('zesta/','#4FA8BC',n,s_,''.join(b))

# ---- wagner/
# The only dataset in the corpus carrying transcriptome and PHYSICAL lineage in the same cells.
# Everything else infers lineage from expression; TracerSeq measured it.
n,s_=agg('wagner/')
b=[row('README.md',get('wagner/README.md')[0][0],'ok','the time course, TracerSeq, and the CRISPR arms')]
gn2,gs2=agg('wagner/GSE112294/')
b.append(row('GSE112294/',gs2,'ok',f'{gn2} objects - the complete GEO release'))
b.append(row('GSE112294_RAW.tar',get('wagner/GSE112294/GSE112294_RAW.tar')[0][0],'ok',
             '59 members: 7 stages, 5 TracerSeq libraries, chd vs tyr',2))
B['wagner/']=block('wagner/','#8A7FC4',n,s_,''.join(b))

# ---- the eight prefixes uploaded 2026-09-09. Each is one origin folder plus a README,
# so they are built from a table rather than eight near-identical hand-written blocks;
# hand-writing them was how the earlier ones drifted from the bucket in the first place.
SIMPLE=[
 ("zmap/","#BF6C69","h5ad/","harmonized meta-atlas — many studies in one coordinate system",
   [("ZMAP_251209_processed.h5ad","the integration itself: embeddings, graphs, harmonized labels"),
    ("ZMAP_260103_symphony.h5ad","a Symphony reference — map new query data against all of it")]),
 ("keller/","#97BF69","bdml/","nuclear positions, divisions and tracks — the physical embryo",
   [("zebrafish_in_toto_wt_bdml3.0.zip","whole embryo, wild type"),
    ("SHA256SUMS.published","SSBD's own digests — 7 of 7 agree with these bytes")]),
 ("raj/","#BF69A6","GSE158142/","brain development + scGESTALT lineage recording",
   [("GSE158142_RAW.tar","213 members"),
    ("GSE158142_URD_hypoND.rds.gz","the authors' own URD trajectory")]),
 ("linnaeus/","#69BF8D","GSE106121/","scRNA + Cas9 genetic scars, lineage and type in one cell",
   [("GSE106121_RAW.tar","45 members"),
    ("GSE106121_A5_scars_compared.csv.gz","which scars recur across animals, and which are one-offs")]),
 ("zfap/","#9469BF","volumes/","segmented 3D embryo volumes, five stages — anatomy, not expression",
   [("24hrs.tif.gz","the stage most of the atlases here overlap"),
    ("48hrs.tif.gz","fetched over a cert issued to another hostname; see the README")]),
 ("trunk30hpf/","#6974BF","GSE152982/","one tissue, one stage, inside the 24-48 hpf window",
   [("GSE152982_RAW.tar","3 members — barcodes, features, matrix")]),
 ("farrell/","#B6BF69","GSE106587/","the URD reference — and the corpus's oldest open gap, closed",
   [("GSE106587_RAW.tar","6 members: wild-type and MZoep at 6 somites")]),
 ("tomoseq/","#7DBF69","GSE104057/","sectioned hearts — spatial at organ scale",
   [("GSE104057_RAW.tar","3 members — 2 dpf wild-type hearts")]),
]
for name,acc,sub,head,rows_ in SIMPLE:
    n,s_=agg(name)
    b=[row('README.md',get(name+'README.md')[0][0],'ok',head)]
    sn,ss=agg(name+sub)
    b.append(row(sub,ss,'ok',f'{sn} objects'))
    for leaf,note in rows_:
        hit=get(name+sub+leaf)
        if hit: b.append(row(leaf,hit[0][0],'ok',note,2))
    B[name]=block(name,acc,n,s_,''.join(b))

# ---- the three that landed 2026-09-09, each with more than one origin folder, so they
# take a table of their own rather than the single-subdir one above.
MULTI=[
 ("zcl2/","#BF7E69","the widest time span here — 24 hpf to 22 months, 1,088,106 cells",
   [("figshare_20363190/","the authors' objects; canonical + five pre-QC per-stage"),
    ("GSE178150/","24 hpf, 72 hpf, 3 mo — 106 samples"),
    ("GSE198571/","21 d, 22 mo — 93 samples"),
    ("analysis/","ours: the annotation reconciliation, 5,426 rows short"),
    ("code/","the authors' downstream code")],
   [("figshare_20363190/MD5SUMS.figshare","figshare's own digests — 7 of 7 agree")]),
 ("celloracle/","#69BFBC","five TF crispants and a mutant — and NO cell-type labels exist",
   [("GSE145298/","30 of the series' 31 samples; the 31st is mouse"),
    ("Paper/","the article, supplements, figures"),
    ("code/","the CellOracle package as released")],
   [("GSE145298/GSE145298_family.soft.gz","the series record, describing all 31")]),
 ("zcl1/","#D9B98A","17 adult tissues plus 24 and 72 hpf — anatomy, not time",
   [("GSE130487/","59 Microwell-seq DGE matrices"),
    ("Paper/","the article and five workbooks, none of which names the accession")],
   [("GSE130487/GSE130487_RAW.tar","620,059 barcodes pre-QC; the paper reports >250,000 cells")]),
 ("farnsworth/","#C4B04A","44,020 cells at 1, 2 and 5 dpf under 220 named clusters",
   [("zebrafish-dev/","the UCSC Cell Browser release — the paper deposits raw reads only"),
    ("Paper/","the rendered article; PMC serves its PDF only to browsers")],
   [("zebrafish-dev/exprMatrix.tsv.gz","32,520 genes x 44,020 cells; the origin's own md5 agrees"),
    ("zebrafish-dev/meta.tsv","Cluster holds the NAMES, ClusterNames holds the numbers")]),
 ("zfin/","#4A4ABF","the vocabulary the rest gets read against — not an experiment",
   [("2026-09-08/","ZFA + ZFS ontologies, 243,055 wild-type expression records"),
    ("2026-09-09/","185,366 records across ALL genotypes, plus the ZFA synonyms"),
    ("2026-02-02/","human and mouse orthologs — an older snapshot, kept as its own")],
   [("2026-09-08/wildtype-expression_fish.txt","gene x structure x stage, from decades of published in-situ")]),
]
for name,acc,head,subs,leaves in MULTI:
    n,s_=agg(name)
    b=[row('README.md',get(name+'README.md')[0][0],'ok',head)]
    for sub,note in subs:
        sn,ss=agg(name+sub)
        b.append(row(sub,ss,'ok',f'{sn} objects - {note}'))
    for leaf,note in leaves:
        hit=get(name+leaf)
        if hit: b.append(row(leaf.split('/')[-1],hit[0][0],'ok',note,2))
    B[name]=block(name,acc,n,s_,''.join(b))

# ---- megafin-1/
n,s=agg('megafin-1/')
g=collections.Counter(); c=collections.Counter()
for sz,k in get('megafin-1/'):
    p='/'.join(k.split('/')[:3]); g[p]+=sz; c[p]+=1
b=[row('characterization/',s,'leg',
        f'{n} objects — already archived to bronze 2026-08-29, byte-identical, zero size disagreements')]
for p,sz in g.most_common(4):
    b.append(row(p.split('/')[-1],sz,'leg',f'{c[p]} obj',2))
B['megafin-1/']=block('megafin-1/','#6E8CA0',n,s,''.join(b),legacy=True)

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


# ---- assemble: two sections, ours first, and inside each the order a reader wants
# rather than the order the bytes happen to fall in. The map draws the same split as
# two columns; this is the same distinction in the same words, so a reader crossing
# between them is not asked to work out that they are the same idea.
def sec(t, note):
    return (f'<div class=\\"fksec\\"><b>{esc(t)}</b><span>{esc(note)}</span></div>')

out.append(sec("Parse (Our Data)",
               "produced here from a Parse delivery; a disagreement with the source is our bug"))
for k in ('minifin/','megafin/','megafin-1/'):
    out.append(B[k])
out.append(sec("Acquired (Open Source) \u00b7 scRNA-seq",
               "taken verbatim from a public origin; a disagreement is their revision, not ours. "
               "\u00b7 pinned means a manifest in zsb-bronze names these bytes; NO RECORD means nothing does"))
for k in ('chemfish/','zmap/','micdropseq/','platt/','zscape/','zebrahub/','zcl2/',
          'daniocell/','celloracle/','wagner/','raj/','linnaeus/','trunk30hpf/','zcl1/',
          'farrell/','farnsworth/'):
    out.append(B[k])

# The three modalities that are not single-cell transcriptomes. Together they are 7.1% of
# the bucket, which is why the map floors their bands and marks them "~": a truthful band
# for anatomy alone would be a tenth of a grid unit.
out.append(sec("Acquired \u00b7 Imaging / physical tracking",
               "no transcriptome at all \u2014 light-sheet imaging tracked to per-nucleus positions, "
               "divisions and lineage links. Nothing in the single-cell toolchain opens it"))
out.append(B['keller/'])
out.append(sec("Acquired \u00b7 Spatial transcriptomics",
               "where a transcript is, measured rather than inferred. zesta/ is mixed \u2014 it carries a "
               "dissociated scRNA half too; tomoseq/ is RNA-seq but NOT single-cell, one observation "
               "per cryosection"))
for k in ('zesta/','tomoseq/'):
    out.append(B[k])
out.append(sec("Acquired \u00b7 Anatomy volumes",
               "segmented 3D embryo volumes as image stacks. No sequencing of any kind \u2014 the frame "
               "a cell-type label gets placed against"))
out.append(B['zfap/'])

# The curation layer, not a study. It is the only prefix here whose origin has no version at
# all, so its releases are named for the day they were taken and every row is marked superseded
# on purpose — the file at zfin.org today is a different file by construction.
out.append(sec("Acquired \u00b7 Reference tables",
               "no cells and no images \u2014 the ZFA anatomy ontology, the ZFS stage ontology and "
               "243,055 curated expression records. What a cluster label gets checked against"))
out.append(B['zfin/'])

style=open('/tmp/claude-1001/-data/1a934452-8c41-4975-b302-6d9d32c09db2/scratchpad/panel_style.txt').read()
panel=style+''.join(out)
pathlib.Path('/tmp/claude-1001/-data/1a934452-8c41-4975-b302-6d9d32c09db2/scratchpad/silver_panel.txt').write_text(panel)
print("panel chars:",len(panel))
print("blocks:",len(out)-1,"| total accounted:",f"{TOT:,}")
