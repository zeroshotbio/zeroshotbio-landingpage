#!/usr/bin/env python
"""
verify_lawson_v4_3_2.py — confirm the locally-held Lawson GTF is V4.3.2, and reproduce
DanioCell's gene-universe reconstruction against it.

Written 2026-08-13, when `/data/scratch/bench/ref/V4.3.2.ensembl_names.gtf` was discovered
undocumented on a scratch path and promoted to
`/data/datasets/zebrafish/references/lawson_v4_3_2/`.

Why this script exists: `DanioCell_SOURCES.md` used to state that we hold only Lawson v4.3 and
that v4.3.2 was unobtainable, and attributed a 2,006-name residual to the v4.3 -> v4.3.2 version
delta. Both claims were wrong. This script is the standing check:

  * the four DanioCell reconstruction statistics land exactly on V4.3.2 and NOT on v4.3
    (36,109 unique symbols / 242 `.N` matches / 32 case-only / 2,006 residual);
  * the 2,006 residual PERSISTS against v4.3.2, so it is not a version artifact;
  * v4.3 -> v4.3.2 differs only in seqname convention and 293 gene_name values, with an
    identical gene-ID set, identical coordinates and no rows added or removed.

Read-only. ~2 min (it parses two ~150 MB GTFs).
Exit code 0 = every assertion held.
"""
import sys, gzip, re, hashlib

V432 = '/data/datasets/zebrafish/references/lawson_v4_3_2/V4.3.2.ensembl_names.gtf'
V43  = '/data/datasets/zebrafish/references/lawson_v4_3/v4_3.gtf'
DC   = '/data/datasets/zebrafish/DanioCell/GSE223922_Sur2023_counts_rows_genes.txt.gz'

SHA_V432 = '32b8e1f3e5b56432c1b438b12304b9c56998d8f88fab6f5313a60d989aa72fcf'
MD5_V432 = 'd06e54aeeb6fac95cc605bece45e1478'   # matches s3://zeroshot-megafin-2m-part1/reference/REFERENCE_MANIFEST.txt

EXPECT = dict(genes=36_351, symbols=36_109, suffix=242, case=32, residual=2_006,
              renames=293, mt_renames=6, xloc=174, mt_models=37)

fails = []
def check(label, got, want):
    ok = got == want
    g = f'{got:,}' if isinstance(got, int) else got
    w = f'{want:,}' if isinstance(want, int) else want
    print(f'  {"PASS" if ok else "FAIL"}  {label:56s} got={g}  want={w}')
    if not ok: fails.append(label)


def parse_genes(path):
    """-> {gene_id: (gene_name, seqname, start, end, strand, source)}"""
    op = gzip.open if path.endswith('.gz') else open
    out = {}
    with op(path, 'rt') as fh:
        for line in fh:
            if line[0] == '#': continue
            f = line.split('\t')
            if len(f) < 9 or f[2] != 'gene': continue
            gid = re.search(r'gene_id "([^"]+)"', f[8])
            if not gid: continue
            gn = re.search(r'gene_name "([^"]+)"', f[8])
            out[gid.group(1)] = (gn.group(1) if gn else None, f[0], int(f[3]), int(f[4]), f[6], f[1])
    return out


def digests(path):
    s, m = hashlib.sha256(), hashlib.md5()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 22), b''):
            s.update(blk); m.update(blk)
    return s.hexdigest(), m.hexdigest()


def norm(seq):
    """chr1 -> 1 ; chrM -> MT ; chrUn_KN149789v1 -> KN149789.1"""
    if not seq.startswith('chr'): return seq
    s = seq[3:]
    if s == 'M': return 'MT'
    m = re.match(r'^Un_(K[NZ]\d+)v(\d+)$', s)
    return f'{m.group(1)}.{m.group(2)}' if m else s


def main():
    print('Lawson V4.3.2 verification\n')

    print('== 1. file identity ==')
    sha, md5 = digests(V432)
    check('sha256', sha, SHA_V432)
    check('md5 (matches the S3 REFERENCE_MANIFEST entry)', md5, MD5_V432)

    b = parse_genes(V432)
    a = parse_genes(V43)
    check('V4.3.2 gene records', len(b), EXPECT['genes'])
    check('v4.3 gene records',   len(a), EXPECT['genes'])

    print('\n== 2. V4.3.2 vs v4.3 ==')
    check('gene-ID sets identical', int(set(a) == set(b)), 1)
    check('genes only in v4.3',   len(set(a) - set(b)), 0)
    check('genes only in V4.3.2', len(set(b) - set(a)), 0)
    sh = set(a) & set(b)
    coord = [k for k in sh
             if (norm(a[k][1]), a[k][2], a[k][3], a[k][4]) != (norm(b[k][1]), b[k][2], b[k][3], b[k][4])]
    check('coordinate diffs after seqname normalisation', len(coord), 0)
    from collections import Counter
    src_a = sorted(Counter(x[5] for x in a.values()).items())
    src_b = sorted(Counter(x[5] for x in b.values()).items())
    check('source-column mix identical', int(src_a == src_b), 1)
    print(f'         source mix: {src_b}')

    renames = [k for k in sh if a[k][0] != b[k][0]]
    mt_ren  = [k for k in renames if b[k][1] == 'MT']
    xloc    = [k for k in renames if (a[k][0] or '').startswith('XLOC_')]
    check('gene_name differences', len(renames), EXPECT['renames'])
    check('  of which MT convention renames', len(mt_ren), EXPECT['mt_renames'])
    check('  of which XLOC_ placeholders resolved', len(xloc), EXPECT['xloc'])
    print(f"         MT renames: {[(a[k][0], b[k][0]) for k in sorted(mt_ren, key=lambda k: b[k][0])]}")

    print('\n== 3. seqname convention + MT models ==')
    mt_b = sum(1 for v in b.values() if v[1] == 'MT')
    mt_a = sum(1 for v in a.values() if v[1] == 'chrM')
    check('V4.3.2 gene models on seqname "MT"',   mt_b, EXPECT['mt_models'])
    check('v4.3   gene models on seqname "chrM"', mt_a, EXPECT['mt_models'])
    check('v4.3 gene models on seqname "MT" (0 => STAR would drop the mitochondrion)',
          sum(1 for v in a.values() if v[1] == 'MT'), 0)

    print('\n== 4. DanioCell reconstruction — the identity test ==')
    dc = [l.strip().strip('"') for l in gzip.open(DC, 'rt') if l.strip()]
    print(f'  DanioCell released feature names: {len(dc):,}')
    results = {}
    for lab, g in (('v4.3', a), ('V4.3.2', b)):
        names = {x[0] for x in g.values() if x[0]}
        lower = {n.lower() for n in names}
        direct = suffix = case = 0
        resid = []
        for n in dc:
            if n in names:
                direct += 1; continue
            m = re.match(r'^(.*)\.(\d+)$', n)              # Cell Ranger make.unique suffixing
            if m and m.group(1) in names:
                suffix += 1; continue
            if n.lower() in lower:
                case += 1; continue
            resid.append(n)
        results[lab] = dict(symbols=len(names), direct=direct, suffix=suffix,
                            case=case, residual=len(resid), resid=resid)
        print(f'    {lab:7s} symbols={len(names):,}  direct={direct:,}  '
              f'.N={suffix}  case={case}  residual={len(resid):,}')

    r = results['V4.3.2']
    check('V4.3.2 unique gene_names', r['symbols'], EXPECT['symbols'])
    check('V4.3.2 Cell Ranger .N matches', r['suffix'], EXPECT['suffix'])
    check('V4.3.2 case-only matches', r['case'], EXPECT['case'])
    check('V4.3.2 unexplained residual', r['residual'], EXPECT['residual'])
    # and the discriminating half: v4.3 must NOT reproduce them
    v = results['v4.3']
    check('v4.3 does NOT reproduce the symbol count', int(v['symbols'] != EXPECT['symbols']), 1)
    check('v4.3 does NOT reproduce the .N count',     int(v['suffix']  != EXPECT['suffix']), 1)
    check('v4.3 does NOT reproduce the residual',     int(v['residual'] != EXPECT['residual']), 1)
    print(f"         upgrading v4.3 -> V4.3.2 resolves {v['residual'] - r['residual']} names, "
          f"leaving {r['residual']:,}")

    print('\n== 5. what the 2,006 residual actually is ==')
    up  = [n for n in r['resid'] if n.isupper()]
    oth = [n for n in r['resid'] if not n.isupper()]
    check('residual that is ALL-UPPERCASE', len(up), 1_997)
    print(f'         eg uppercase: {up[:8]}')
    print(f'         the other {len(oth)}: {sorted(oth)}')
    print('         => NOT a Lawson version artifact; it persists against v4.3.2.')

    print('\n' + '=' * 74)
    if fails:
        print(f'{len(fails)} CHECK(S) FAILED:')
        for x in fails: print(f'  - {x}')
        return 1
    print('ALL CHECKS PASSED')
    return 0


if __name__ == '__main__':
    sys.exit(main())
