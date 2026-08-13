#!/usr/bin/env python
"""
verify_zscape_merge.py — independent verification of the canonical ZSCAPE merge.

STATUS: NEW RECONSTRUCTION, written 2026-08-13. This is *not* the historical build
script — no build script for `zscape_perturb_reference_merged_dedubled.h5ad` exists
anywhere on this instance, and the two source objects (`zscape_reference_full.h5ad`,
`zscape_perturb_full.h5ad`) are no longer on disk either. See
`../README.md` §2 "How the canonical object was built" for where the merge logic came
from and how far each step is independently verifiable.

What this script does:
  * measures every headline figure directly from the canonical H5AD;
  * checks the documented source -> filter -> deduplicate -> merge arithmetic for
    internal consistency, including the one step that IS independently checkable
    (filtered_reference - duplicated_controls == the realised ctrl-uninj population);
  * reproduces the object-level caveats recorded in the README.

It reads the H5AD through h5py at the group level and never loads X, so it is cheap
(~1 minute) and cannot modify anything.

Usage:  python verify_zscape_merge.py [path/to/zscape_perturb_reference_merged_dedubled.h5ad]
Exit code 0 = every assertion held.
"""
import sys, h5py, numpy as np

CANON = '/data/datasets/zebrafish/ZSCAPE/zscape_perturb_reference_merged_dedubled.h5ad'

# ---- documented figures (see ../README.md §2). Source A/B totals are operator-supplied;
# ---- everything under "final" is measured here.
DOC = dict(
    ref_source=1_241_018, ref_filtered_out=85_130, ref_filtered=1_155_888,
    prt_source=2_687_135, prt_filtered_out=451,    prt_filtered=2_686_684,
    filtered_sum=3_842_572, dup_controls=610_839,  merged=3_231_733,
    genes=32_031,
    controls=1_146_884, perturbed=2_084_849,
    ctrl={'ctrl-uninj':545_049,'ctrl-inj':362_755,'ctrl-hgfa':116_548,
          'ctrl-noto':49_172,'ctrl-met':38_406,'ctrl-mafba':34_954},
    single=1_397_173, double=328_363, stable=359_313,
)

SINGLE = ['cdx4','egr2b','epha4a','foxd3','foxi1','hand2','hgfa','hoxb1a','mafba','met',
          'noto','phox2a','smo','tbx1','tbx16','tbxta','tfap2a','zc4h2']
DOUBLE = ['cdx4-cdx1a','tbx16-msgn1','tbx16-tbx16l','tfap2a-foxd3','wnt3a-wnt8']
STABLE = ['hgfa-mut','mafba-mut','met-mut','noto-mut','tbx16-mut']
CTRLS  = ['ctrl-uninj','ctrl-inj','ctrl-hgfa','ctrl-noto','ctrl-met','ctrl-mafba']

fails = []
def check(label, got, want):
    ok = (got == want)
    print(f'  {"PASS" if ok else "FAIL"}  {label:52s} got={got:,}  want={want:,}')
    if not ok: fails.append(label)
    return ok

def strs(ds):
    a = ds[:]
    return np.array([x.decode() if isinstance(x, bytes) else str(x) for x in a])

def catcol(f, grp, k):
    """-> (categories, codes). Works for categorical and plain string/numeric columns."""
    g = f[grp][k]
    if isinstance(g, h5py.Group) and 'categories' in g:
        return strs(g['categories']), g['codes'][:]
    d = g[:]
    v = strs(g) if d.dtype.kind in 'OSU' else d
    u, inv = np.unique(v, return_inverse=True)
    return u.astype(str), inv

def values(f, grp, k):
    g = f[grp][k]
    if isinstance(g, h5py.Group) and 'categories' in g:
        c = strs(g['categories']); cd = g['codes'][:]
        return np.where(cd < 0, '<NA>', c[np.clip(cd, 0, None)])
    d = g[:]
    return strs(g) if d.dtype.kind in 'OSU' else d

def is_categorical(f, grp, k):
    g = f[grp][k]
    return isinstance(g, h5py.Group) and 'categories' in g


def main(path=CANON):
    print(f'ZSCAPE canonical merge verification\nobject: {path}\n')
    with h5py.File(path, 'r') as f:
        oi = f['obs'].attrs.get('_index', 'index'); oi = oi.decode() if isinstance(oi, bytes) else oi
        vi = f['var'].attrs.get('_index', 'index'); vi = vi.decode() if isinstance(vi, bytes) else vi
        n_obs = f['obs'][oi].shape[0]
        n_var = f['var'][vi].shape[0]

        print('== 1. dimensions ==')
        check('cells', n_obs, DOC['merged'])
        check('genes', n_var, DOC['genes'])
        xs = tuple(int(v) for v in f['X'].attrs['shape'])
        check('X shape rows', xs[0], DOC['merged'])
        check('X shape cols', xs[1], DOC['genes'])

        gtC, gtI = catcol(f, 'obs', 'gene_target')
        exC, exI = catcol(f, 'obs', 'expt')
        counts = {g: int((gtI == j).sum()) for j, g in enumerate(gtC)}

        print('\n== 2. final control composition ==')
        for g in CTRLS:
            check(f'gene_target == {g}', counts.get(g, 0), DOC['ctrl'][g])
        tot_ctrl = sum(counts.get(g, 0) for g in CTRLS)
        check('controls total', tot_ctrl, DOC['controls'])

        print('\n== 3. final perturbed composition ==')
        s1 = sum(counts.get(g, 0) for g in SINGLE)
        s2 = sum(counts.get(g, 0) for g in DOUBLE)
        s3 = sum(counts.get(g, 0) for g in STABLE)
        check('single-gene crispants (18 labels)', s1, DOC['single'])
        check('double-gene crispants (5 labels)', s2, DOC['double'])
        check('stable null mutants (5 labels)',   s3, DOC['stable'])
        check('perturbed total', s1 + s2 + s3, DOC['perturbed'])
        check('controls + perturbed == cells', tot_ctrl + s1 + s2 + s3, n_obs)
        check('gene_target levels', len(gtC), 34)
        check('labels accounted for', len(CTRLS) + len(SINGLE) + len(DOUBLE) + len(STABLE), len(gtC))

        print('\n== 4. source -> filter -> dedup -> merge arithmetic ==')
        check('ref_source - ref_filtered_out', DOC['ref_source'] - DOC['ref_filtered_out'], DOC['ref_filtered'])
        check('prt_source - prt_filtered_out', DOC['prt_source'] - DOC['prt_filtered_out'], DOC['prt_filtered'])
        check('filtered sum', DOC['ref_filtered'] + DOC['prt_filtered'], DOC['filtered_sum'])
        check('filtered sum - dup controls', DOC['filtered_sum'] - DOC['dup_controls'], DOC['merged'])

        # The independently checkable identity: after removing the duplicated controls the
        # reference atlas contributes exactly its uninjected population, and the perturbation
        # atlas contributes its entire filtered self.
        ref_unique = DOC['ref_filtered'] - DOC['dup_controls']
        check('filtered_ref - dup_controls == realised ctrl-uninj', ref_unique, counts.get('ctrl-uninj', 0))
        prt_expt = 'expt3'
        if prt_expt in list(exC):
            n_prt = int((exI == list(exC).index(prt_expt)).sum())
            check(f'{prt_expt} (perturbation atlas) == prt_filtered', n_prt, DOC['prt_filtered'])
            check('ctrl-uninj + expt3 == cells', counts.get('ctrl-uninj', 0) + n_prt, n_obs)

        # Decomposition of the 610,839 duplicated cells. Five of the six components are
        # measurable here; the sixth (the reference atlas's own tbx16-mut population) is
        # source-supplied, because the merged object retains the perturbation atlas's
        # 16,475 tbx16-mut cells and the reference atlas's duplicate 9,004 were dropped.
        p3 = exI == list(exC).index('expt3')
        shared = {g: int(((gtI == list(gtC).index(g)) & p3).sum())
                  for g in ['ctrl-inj', 'ctrl-hgfa', 'ctrl-noto', 'ctrl-met', 'ctrl-mafba']}
        for g, n in shared.items():
            print(f'         expt3 {g:12s} {n:,}  (measured)')
        REF_TBX16MUT = 9_004
        print(f'         ref  tbx16-mut    {REF_TBX16MUT:,}  (source A, not measurable post-dedup)')
        print(f'         [merged retains {int(((gtI == list(gtC).index("tbx16-mut")) & p3).sum()):,} '
              f'tbx16-mut from source B]')
        check('expt3 ctrl-* + source-A tbx16-mut == dup_controls',
              sum(shared.values()) + REF_TBX16MUT, DOC['dup_controls'])
        check('filtered_ref - realised ctrl-uninj == dup_controls  [independent]',
              DOC['ref_filtered'] - counts.get('ctrl-uninj', 0), DOC['dup_controls'])

        print('\n== 5. experiment identity ==')
        emC, emI = catcol(f, 'obs', 'embryo')
        prefix = np.array([s.split('.')[0] for s in emC])
        tpC, tpI = catcol(f, 'obs', 'timepoint')
        for j, x in enumerate(exC):
            m = exI == j
            eu = np.unique(emI[m])
            pres = sorted(set(prefix[eu]))
            tps = sorted(tpC[np.unique(tpI[m])], key=float)
            tgs = sorted(gtC[np.unique(gtI[m])])
            print(f'  {x}: cells={int(m.sum()):>9,}  embryos={len(eu):>5}  alias={pres}')
            print(f'          timepoints={tps}')
            print(f'          gene_targets={len(tgs)}' + ('' if len(tgs) > 3 else f' {tgs}'))
        check('expt levels', len(exC), 5)

        print('\n== 6. embryo count ==')
        n_emb = len(np.unique(emI))
        print(f'  measured obs["embryo"].nunique() = {n_emb:,}')
        check('embryos', n_emb, 1860)
        # is `embryo` alone a valid key, or does it need (expt, embryo)?
        pairs = len(set(zip(exI.tolist(), emI.tolist())))
        check('(expt, embryo) pairs == embryo levels  [embryo alone is a valid key]', pairs, n_emb)
        # do any embryo labels carry no cells / blanks?
        blanks = [e for e in emC if e.strip() == '' or e.lower() in ('nan', 'na', 'none')]
        check('blank embryo levels', len(blanks), 0)
        check('unused embryo levels', len(emC) - n_emb, 0)

        print('\n== 7. object-level caveats ==')
        numeric_looking = ['timepoint', 'temp', 'n.umi', 'num_genes_expressed',
                           'perc_mitochondrial_umis', 'hash_umis', 'mean_nn_time',
                           'Size_Factor', 'top_to_second_best_ratio', 'log.n.umi']
        cat_flags = {c: is_categorical(f, 'obs', c) for c in numeric_looking if c in f['obs']}
        print(f'  numeric-looking obs fields stored as categorical: '
              f'{[c for c, v in cat_flags.items() if v]}')
        check('obs["timepoint"] is categorical (needs explicit numeric cast)',
              int(cat_flags.get('timepoint', False)), 1)

        check('obs["dataset_source"] absent', int('dataset_source' not in f['obs']), 1)

        def numeric(k):
            """obs columns are stored as categorical strings; '<NA>' -> NaN."""
            v = values(f, 'obs', k)
            if v.dtype.kind in 'OSU':
                v = np.where(np.isin(v, ['<NA>', 'nan', 'NaN', 'NA', 'None', '']), 'nan', v)
                return v.astype(float)
            return v.astype(float)

        sf = numeric('Size_Factor')
        nu = numeric('n.umi')
        r = sf / np.where(nu == 0, np.nan, nu)
        print(f'  Size_Factor: min={np.nanmin(sf):.4f} max={np.nanmax(sf):.4f} '
              f'mean={np.nanmean(sf):.4f} median={np.nanmedian(sf):.4f}')
        print(f'  Size_Factor / n.umi: cv={np.nanstd(r)/np.nanmean(r):.6f} '
              f'(0 => exactly proportional to library size)')
        prop = np.nanstd(r) / np.nanmean(r) < 1e-9
        print(f'  {"PASS" if not prop else "NOTE"}  Size_Factor is '
              f'{"NOT" if not prop else ""} a plain library-size scaling')

        tsr = numeric('top_to_second_best_ratio')
        n_inf = int(np.isinf(tsr).sum())
        print(f'  top_to_second_best_ratio: n_inf={n_inf:,} '
              f'finite_max={np.nanmax(tsr[np.isfinite(tsr)]):.3f}')
        check('top_to_second_best_ratio contains infinities', int(n_inf > 0), 1)

        mnt = numeric('mean_nn_time')
        n_nan = int(np.isnan(mnt).sum())
        print(f'  mean_nn_time: n_missing={n_nan:,} ({100*n_nan/n_obs:.4f}%)')
        check('mean_nn_time has a small number of missing values',
              int(0 < n_nan < 0.01 * n_obs), 1)

        print('\n== 8. PNS-related labels ==')
        # NB: no label literally contains the string "PNS". The PNS population is
        # identified by tissue == "Peripheral Nervous System".
        tC, tI = catcol(f, 'obs', 'tissue')
        sC, sI = catcol(f, 'obs', 'cell_type_sub')
        bC, bI = catcol(f, 'obs', 'cell_type_broad')
        m = tI == list(tC).index('Peripheral Nervous System')
        n_pns = int(m.sum())
        sub = sorted(set(sC[sI[m]]))
        brd = sorted(set(bC[bI[m]]))
        print(f'  tissue == "Peripheral Nervous System": {n_pns:,} cells ({100*n_pns/n_obs:.3f}%)')
        for s in sub:
            print(f'    - {s:52s} {int((m & (sI == list(sC).index(s))).sum()):>7,}')
        check('PNS cell_type_sub labels', len(sub), 9)
        print(f'  ...collapsing to only {len(brd)} cell_type_broad labels: {brd}')
        check('PNS cell_type_broad labels', len(brd), 2)

    print('\n' + '=' * 72)
    if fails:
        print(f'{len(fails)} CHECK(S) FAILED:')
        for x in fails:
            print(f'  - {x}')
        return 1
    print('ALL CHECKS PASSED')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else CANON))
