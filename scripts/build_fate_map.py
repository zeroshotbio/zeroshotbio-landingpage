#!/usr/bin/env python3
"""Build the /fate_map dataset: a 5.5 -> 11.3 hpf zebrafish cell-fate map
derived from the ITEC whole-embryo lineage reconstruction (Wang et al. 2026).

WHAT THE EDGES MEAN — and why this differs from /dev_tree:
  These parent/child edges ARE LINEAGE. Every edge is one nucleus tracked to
  the next imaging frame in a 3D time-lapse, or a division. This is the one
  page on the site that may legitimately say "descends from". /dev_tree's
  edges are annotation containment and say nothing of the kind; do not let
  the two pages borrow each other's language.

  What is NOT lineage-derived is the TERRITORY a cell is assigned at the end.
  The authors hand-segmented eyes / brain / somites / tail bud at their final
  frame, but those labels are NOT in the public deposit. Every territory on
  this page is therefore a GEOMETRIC region of the embryo that this script
  defines, not an organ call, and the page must keep saying so.

THE TRAP THAT MATTERS MOST — CSV row order is NOT ID order:
  In ITEC-FISH2-1000-Spot.csv the row index equals the spot ID only up to ID
  13,817,671 (partway through frame 807). After that the file is out of order:
  4.68 million rows carry an ID that is not their row number, and the last 194
  rows carry IDs from the middle of the space. The Link.csv columns are IDs.

  Index the position/frame arrays by ROW and the lineage silently rots from
  frame 807 on: parents land on the wrong cell in the right frame, so ~99% of
  links appear to jump ~660 px — chance distance between two random cells in
  this embryo — and the whole second half of the movie looks corrupt. It is
  not. Scatter rows into ID-indexed arrays first (`arr[ids] = rows`) and every
  one of the 18,447,520 links is a clean +1 frame step with a median
  displacement of 2.7 px, well inside params_FISH2's own max_dist of 50.

  So: ALWAYS index by ID. load() prints how many rows are out of place and
  refuses to continue if the max_dist check starts failing wholesale.

Inputs (read-only, downloaded — not in the repo, ~1.2 GB):
  {RAW}/ITEC-FISH2-1000-Spot.csv   ID, Spot frame, X, Y, Z   (18,497,012 rows)
  {RAW}/ITEC-FISH2-1000-Link.csv   Source ID, Target ID      (18,447,520 rows)
  {RAW}/params_FISH2.csv           z_resolution 7, max_dist 50
  Source: Mendeley "Evaluation results of ITEC", doi 10.17632/tg55phtk4r.1
  Paper:  doi 10.64898/2026.03.12.711203 (CC-BY)
  Fetch:  python3 scripts/build_fate_map.py --fetch

Outputs (public/fate_map/):
  meta.json    stages, territories, counts, every caveat the page prints
  founders.bin founder table at 5.5 hpf
  flow.bin     the pruned lineage forest as time-sampled polylines
  final.bin    every cell at 11.3 hpf, for the bud-stage plate
  first.bin    every cell at 5.5 hpf, for the blastula plate
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np

RAW = Path("/data/scratch/fate_map/raw")
OUT = Path(__file__).resolve().parent.parent / "public" / "fate_map"

SPOT_CSV = RAW / "ITEC-FISH2-1000-Spot.csv"
LINK_CSV = RAW / "ITEC-FISH2-1000-Link.csv"

MENDELEY = "tg55phtk4r"          # "Evaluation results of ITEC"
ROW_ID_SPLIT = 13_817_671        # first ID whose row number is not its ID — see docstring
FRAME_MAX = 1000                 # the whole released movie; all of it is sound
MAX_DIST = 50.0                  # params_FISH2 max_dist; a longer link is impossible
Z_RATIO = 7.0                    # params_FISH2 z_resolution: z spacing / xy spacing

# Fig. 5A pins frame 0 -> 5.5 hpf and frame 1000 -> 11.3 hpf, and every other
# anchor the paper gives (200->6.7, 240->6.9, 400->7.8, 480->8.3, 600->9.0,
# 720->9.7) falls on the same straight line to within 0.02 h, so the mapping is
# linear at 5.8 h / 1000 frames = 20.88 s per frame.
HPF0, HPF1000 = 5.5, 11.3
def hpf(frame): return HPF0 + frame * (HPF1000 - HPF0) / 1000.0

STEP = 8                         # sample the flow every 8 frames (~2.8 min)

# Kimmel et al. 1995 staging at 28.5 C. Only those inside the window.
STAGES = [
    (5.25, "50% epiboly", "blastoderm margin reaches the equator"),
    (6.00, "shield",      "the dorsal organiser becomes visible"),
    (8.00, "75% epiboly", ""),
    (9.00, "90% epiboly", ""),
    (10.00, "bud",        "epiboly complete; the tail bud appears"),
]

# Territories at FRAME_MAX. GEOMETRIC regions of the fitted sphere, named for
# WHERE THEY ARE, never for what they become. The classical correspondence is
# carried in `classical` and is a pointer for the reader, not a claim: nothing
# here is an organ call, and no cell-type annotation was used to draw any of it.
TERRITORIES = [
    # key,            lon_max, lat_lo, lat_hi, label,                     classical
    ("axial_ant",        30,    15,  65, "anterior axial",   "prospective head and anterior neural plate"),
    ("axial_trunk",      30,    65, 110, "trunk axial",      "prospective notochord and trunk"),
    ("axial_post",       30,   110, 160, "posterior axial",  "prospective tail bud"),
    ("paraxial",         70,    15, 160, "paraxial",         "flanking the midline; prospective somites"),
    ("lateroventral",   181,    15, 160, "lateral-ventral",  "non-axial; ventral mesoderm and ectoderm"),
    ("animal",          181,     0,  15, "animal pole",      ""),
    ("vegetal",         181,   160, 181, "vegetal pole",     ""),
]


def fetch() -> None:
    """Download the two CSVs + params from Mendeley into RAW."""
    import urllib.request
    RAW.mkdir(parents=True, exist_ok=True)
    api = f"https://data.mendeley.com/public-api/datasets/{MENDELEY}"
    meta = json.loads(urllib.request.urlopen(api, timeout=120).read())
    want = {"ITEC-FISH2-1000-Spot.csv", "ITEC-FISH2-1000-Link.csv", "params_FISH2.csv"}
    seen = set()
    for f in meta["files"]:
        n = f["filename"]
        if n not in want or n in seen:
            continue
        seen.add(n)
        dest = RAW / n
        if dest.exists() and dest.stat().st_size == f["size"]:
            print(f"  have {n}")
            continue
        print(f"  get  {n} ({f['size']/1e6:.0f} MB)")
        urllib.request.urlretrieve(f["content_details"]["download_url"], dest)
    missing = want - seen
    if missing:
        sys.exit(f"not found in dataset {MENDELEY}: {missing}")


def load():
    """Spot and link tables, indexed by spot ID (never by CSV row).

    Everything downstream indexes by ID, because Link.csv speaks IDs. See the
    module docstring: getting this wrong does not raise, it quietly rewires the
    second half of the movie.
    """
    import pandas as pd
    print("reading spots ...", flush=True)
    sp = pd.read_csv(SPOT_CSV, dtype={"ID": np.float64, "Spot frame": np.int32,
                                      "X": np.float32, "Y": np.float32, "Z": np.float32})
    ids = sp["ID"].to_numpy().astype(np.int64)
    n = len(ids)
    if len(np.unique(ids)) != n or ids.min() != 0 or ids.max() != n - 1:
        sys.exit("spot IDs are not a permutation of 0..N-1 — schema changed")
    rows_out_of_place = int((ids != np.arange(n)).sum())
    print(f"  {n:,} spots; {rows_out_of_place:,} rows are not at their own ID "
          f"(first at ID {ROW_ID_SPLIT:,}) — scattering by ID")

    frame = np.empty(n, np.int32)
    frame[ids] = sp["Spot frame"].to_numpy()
    xyz = np.empty((n, 3), np.float64)
    xyz[ids] = sp[["X", "Y", "Z"]].to_numpy()
    xyz[:, 2] *= Z_RATIO                       # make z isotropic with xy
    if not (np.diff(frame) >= 0).all():
        sys.exit("frames are not sorted in ID order — the block offsets assume they are")

    starts = np.searchsorted(frame, np.arange(FRAME_MAX + 2))
    n = int(starts[FRAME_MAX + 1])
    frame, xyz = frame[:n], xyz[:n]

    print("reading links ...", flush=True)
    lk = pd.read_csv(LINK_CSV, dtype=np.float64)
    src = lk["Source ID"].to_numpy().astype(np.int64)
    tgt = lk["Target ID"].to_numpy().astype(np.int64)
    keep = (src < n) & (tgt < n)
    src, tgt = src[keep], tgt[keep]

    step = frame[tgt] - frame[src]
    dist = np.linalg.norm(xyz[src] - xyz[tgt], axis=1)
    good = (step >= 1) & (step <= 2)            # ITEC may bridge one missed frame
    near = dist <= MAX_DIST                     # the tracker's own ceiling
    drop = int((~(good & near)).sum())
    print(f"  links in window {len(src):,}; step==+1 for "
          f"{float((step == 1).mean())*100:.3f}%; median displacement "
          f"{np.median(dist):.2f} px; dropping {drop:,} ({drop/len(src)*100:.4f}%) "
          f"over max_dist or spanning >2 frames")
    if drop / len(src) > 0.01:
        sys.exit("too many links rejected — are the arrays indexed by ID? see docstring")
    src, tgt = src[good & near], tgt[good & near]
    return frame, xyz, starts, src, tgt, n


def geometry(xyz, starts):
    """Fit the yolk sphere, the animal-vegetal axis and the dorsal meridian.

    The blastoderm is a shell on a sphere of near-constant radius, so latitude
    from the animal pole is the epiboly coordinate and longitude about that
    axis is the dorsoventral one. Both are read out of the data; nothing here
    is a hand-placed landmark.
    """
    def fit(P):
        A = np.hstack([2 * P, np.ones((len(P), 1))])
        sol, *_ = np.linalg.lstsq(A, (P ** 2).sum(1), rcond=None)
        c = sol[:3]
        return c, float(np.sqrt(sol[3] + c @ c))

    centres, radii = [], []
    for f in range(0, FRAME_MAX + 1, 50):
        c, r = fit(xyz[starts[f]:starts[f + 1]])
        centres.append(c); radii.append(r)
    centre = np.mean(centres, axis=0)
    radius = float(np.mean(radii))

    # Animal pole: at 5.5 hpf the blastoderm is a cap on the animal half, so
    # the frame-0 centroid points at it.
    axis = xyz[starts[0]:starts[1]].mean(0) - centre
    axis /= np.linalg.norm(axis)
    u = np.cross(axis, [0, 0, 1.0]); u /= np.linalg.norm(u)
    v = np.cross(axis, u)

    def to_sph(P, dorsal=0.0):
        q = P - centre
        r = np.linalg.norm(q, axis=1)
        nrm = q / r[:, None]
        lat = np.degrees(np.arccos(np.clip(nrm @ axis, -1, 1)))
        lon = (np.degrees(np.arctan2(nrm @ v, nrm @ u)) - dorsal + 180) % 360 - 180
        return lat, lon, r

    # Dorsal meridian: convergent extension piles cells onto it, so at the last
    # frame the mid-latitude longitude histogram has one clear mode. Take its
    # circular mean rather than the argmax bin so the answer is not bin-aligned.
    lat, lon, _ = to_sph(xyz[starts[FRAME_MAX]:starts[FRAME_MAX + 1]])
    mid = (lat > 30) & (lat < 140)
    th = np.radians(lon[mid])
    h, edges = np.histogram(lon[mid], bins=72, range=(-180, 180))
    peak = np.radians((edges[np.argmax(h)] + edges[np.argmax(h) + 1]) / 2)
    near = np.abs((th - peak + np.pi) % (2 * np.pi) - np.pi) < np.radians(40)
    dorsal = float(np.degrees(np.arctan2(np.sin(th[near]).mean(), np.cos(th[near]).mean())))
    contrast = float(h.max() / max(h.mean(), 1e-9))
    print(f"  sphere centre {np.round(centre,1)} r={radius:.0f}; "
          f"dorsal meridian {dorsal:+.1f} deg (peak {contrast:.2f}x mean)")
    return centre, radius, axis, u, v, dorsal, to_sph


def territory_of(lat, lon):
    """Vectorised territory index; first matching rule wins."""
    out = np.full(len(lat), -1, np.int8)
    al = np.abs(lon)
    for i, (_k, lon_max, lat_lo, lat_hi, _lab, _cl) in enumerate(TERRITORIES):
        m = (out < 0) & (al <= lon_max) & (lat >= lat_lo) & (lat < lat_hi)
        out[m] = i
    out[out < 0] = len(TERRITORIES) - 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="download the source CSVs first")
    args = ap.parse_args()
    if args.fetch:
        fetch()
    for p in (SPOT_CSV, LINK_CSV):
        if not p.exists():
            sys.exit(f"missing {p} — run with --fetch")

    frame, xyz, starts, src, tgt, N = load()
    centre, radius, axis, u, v, dorsal, to_sph = geometry(xyz, starts)
    lat, lon, rad = to_sph(xyz, dorsal)

    # ---- lineage forest -------------------------------------------------
    parent = np.full(N, -1, np.int64)
    parent[tgt] = src
    if not (src < tgt).all():
        sys.exit("a parent has a higher ID than its child — frame sorting broke")

    # founder = the frame-0 ancestor, or -1 if the track starts mid-movie.
    # Parents always precede children in ID, so one forward sweep suffices.
    founder = np.full(N, -1, np.int64)
    n0 = int(starts[1])
    founder[:n0] = np.arange(n0)
    for f in range(1, FRAME_MAX + 1):
        a, b = int(starts[f]), int(starts[f + 1])
        p = parent[a:b]
        m = p >= 0
        r = np.full(b - a, -1, np.int64)
        r[m] = founder[p[m]]
        founder[a:b] = r

    last = np.arange(int(starts[FRAME_MAX]), int(starts[FRAME_MAX + 1]))
    tips = last[founder[last] >= 0]
    fid = founder[tips]
    print(f"  cells at frame {FRAME_MAX}: {len(last):,}; "
          f"traced to a 5.5 hpf founder: {len(tips):,} ({len(tips)/len(last)*100:.1f}%)")

    # prune to the spots that lie on a path from a founder to a surviving tip
    keep = np.zeros(N, bool)
    cur = tips.copy()
    while len(cur):
        keep[cur] = True
        p = parent[cur]
        p = p[p >= 0]
        cur = np.unique(p[~keep[p]])
    print(f"  spots on surviving lineages: {int(keep.sum()):,}")

    # child count within the pruned forest -> branch points
    kids = np.zeros(N, np.int8)
    m = (parent >= 0) & keep
    np.add.at(kids, parent[m], 1)
    branch = np.flatnonzero((kids == 2) & keep)
    fdrs = np.unique(fid)
    print(f"  founders with descendants: {len(fdrs):,} of {n0:,} "
          f"({len(fdrs)/n0*100:.1f}%); branch points: {len(branch):,}")

    # ---- territories ----------------------------------------------------
    terr_tip = territory_of(lat[tips], lon[tips])
    nT = len(TERRITORIES)
    # per founder: descendant count and territory histogram
    order = np.argsort(fid, kind="stable")
    fid_s, terr_s = fid[order], terr_tip[order]
    uniq, counts = np.unique(fid_s, return_counts=True)
    hist = np.zeros((len(uniq), nT), np.int32)
    np.add.at(hist, (np.searchsorted(uniq, fid_s), terr_s), 1)
    dom = hist.argmax(1).astype(np.int8)
    purity = hist.max(1) / counts

    print("  territory occupancy at the last frame:")
    for i, (k, *_rest) in enumerate(TERRITORIES):
        n_all = int((territory_of(lat[last], lon[last]) == i).sum())
        print(f"    {k:14s} all cells {n_all:6,}   traced {int((terr_tip==i).sum()):6,}")
    print(f"  founder fate purity: median {np.median(purity):.2f}, "
          f"single-territory {float((purity==1).mean())*100:.0f}%")

    # ---- flow: pruned forest as time-sampled polylines ------------------
    # A segment is an unbranched run. It begins at a founder or just after a
    # division and ends at the next division or at a tip. Segments carry their
    # parent segment so the page can walk a lineage without the full graph.
    node = np.zeros(N, bool)
    node[fdrs] = True
    node[branch] = True
    node[tips] = True

    grid = np.arange(0, FRAME_MAX + 1, STEP)
    NG = len(grid)

    # child0/child1 within the pruned forest, vectorised: sort children by
    # parent, then take the first two of each parent's run.
    child0 = np.full(N, -1, np.int64)
    child1 = np.full(N, -1, np.int64)
    ch = np.flatnonzero((parent >= 0) & keep)
    pp = parent[ch]
    o = np.argsort(pp, kind="stable")
    ch_s, pp_s = ch[o], pp[o]
    newgrp = np.empty(len(pp_s), bool)
    newgrp[0] = True
    newgrp[1:] = pp_s[1:] != pp_s[:-1]
    gstart = np.flatnonzero(newgrp)
    rank = np.arange(len(pp_s)) - np.repeat(gstart, np.diff(np.append(gstart, len(pp_s))))
    child0[pp_s[rank == 0]] = ch_s[rank == 0]
    child1[pp_s[rank == 1]] = ch_s[rank == 1]

    # Walk each unbranched run and resample it onto the global frame grid by
    # linear interpolation. Interpolating rather than selecting matters: a run
    # may bridge a skipped frame (ITEC links up to two frames apart), so grid
    # frames are not guaranteed to be present in the run and a plain mask would
    # silently shorten the segment and slide it in time.
    seg_head, seg_parent, seg_g0, seg_len = [], [], [], []
    s_lat, s_lon = [], []
    stack = [(int(f), -1) for f in fdrs]
    while stack:
        head, pseg = stack.pop()
        path = [head]
        cur = head
        while True:
            nxt = child0[cur]
            if nxt < 0:
                break
            path.append(int(nxt))
            if node[nxt]:
                break
            cur = nxt
        arr = np.array(path, np.int64)
        fr_p = frame[arr].astype(np.float64)
        g_lo = int(np.ceil(fr_p[0] / STEP))
        g_hi = int(np.floor(fr_p[-1] / STEP))
        if g_hi < g_lo:                       # run shorter than one sample step
            g_lo = g_hi = int(min(NG - 1, round(fr_p[0] / STEP)))
        gs = np.arange(g_lo, min(g_hi, NG - 1) + 1)
        at = gs * STEP
        seg_head.append(head)
        seg_parent.append(pseg)
        seg_g0.append(int(gs[0]))
        seg_len.append(len(gs))
        s_lat.append(np.interp(at, fr_p, lat[arr]).astype(np.float32))
        # longitude is circular: interpolate the unwrapped angle, then re-wrap
        s_lon.append(((np.interp(at, fr_p, np.degrees(np.unwrap(np.radians(lon[arr]))))
                       + 180) % 360 - 180).astype(np.float32))
        end = int(arr[-1])
        sid = len(seg_head) - 1
        if end != head and kids[end] == 2:
            stack.append((int(child0[end]), sid))
            stack.append((int(child1[end]), sid))

    lat_all = np.concatenate(s_lat)
    lon_all = np.concatenate(s_lon)
    seg_len = np.array(seg_len, np.int32)
    seg_off = np.concatenate([[0], np.cumsum(seg_len)[:-1]]).astype(np.uint32)
    print(f"  segments {len(seg_len):,}; samples {len(lat_all):,} "
          f"({len(lat_all)*4/1e6:.2f} MB as 2x int16)")

    # founder index per segment, so a click can colour a whole lineage
    seg_founder = np.searchsorted(uniq, founder[np.array(seg_head, np.int64)]).astype(np.int32)

    OUT.mkdir(parents=True, exist_ok=True)

    def i16(a, scale=100.0):
        return np.clip(np.round(np.asarray(a) * scale), -32768, 32767).astype("<i2")

    with open(OUT / "flow.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"FMFL", 1, len(seg_len), len(lat_all)))
        fh.write(seg_off.astype("<u4").tobytes())
        fh.write(seg_len.astype("<u2").tobytes())
        fh.write(np.array(seg_g0, "<u2").tobytes())
        fh.write(np.array(seg_parent, "<i4").tobytes())
        fh.write(seg_founder.astype("<i4").tobytes())
        fh.write(i16(lat_all).tobytes())
        fh.write(i16(lon_all).tobytes())

    # Field order in every binary is WIDEST ELEMENT FIRST, and every header is
    # padded to 16 bytes. A typed-array view must start on a multiple of its
    # element size, so a 1-byte column placed before a 2-byte one throws in the
    # browser for odd n — which is exactly what an odd founder count did.
    with open(OUT / "founders.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"FMFD", 1, len(uniq), nT))
        fh.write(i16(lat[uniq]).tobytes())
        fh.write(i16(lon[uniq]).tobytes())
        fh.write(counts.astype("<u2").tobytes())
        fh.write(i16(purity, 10000.0).tobytes())
        fh.write(hist.astype("<u2").tobytes())
        fh.write(dom.astype("<i1").tobytes())

    # every cell at 5.5 hpf, carrying its founder index (-1 = no traced
    # descendants). The blastula plate stipples all of them and tints the
    # traced ones, so the reader sees how much of the sheet the map covers.
    first = np.arange(n0)
    fpos = np.searchsorted(uniq, first)
    is_f = (fpos < len(uniq)) & (uniq[np.minimum(fpos, len(uniq) - 1)] == first)
    f_index = np.where(is_f, fpos, -1).astype(np.int32)
    with open(OUT / "first.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"FMFR", 1, n0, 0))
        fh.write(f_index.astype("<i4").tobytes())
        fh.write(i16(lat[first]).tobytes())
        fh.write(i16(lon[first]).tobytes())

    terr_last = territory_of(lat[last], lon[last])
    traced_mask = np.isin(last, tips)
    with open(OUT / "final.bin", "wb") as fh:
        fh.write(struct.pack("<4sIII", b"FMFN", 1, len(last), 0))
        fh.write(i16(lat[last]).tobytes())
        fh.write(i16(lon[last]).tobytes())
        fh.write(terr_last.astype("<i1").tobytes())
        fh.write(traced_mask.astype("<u1").tobytes())

    meta = {
        "generated_by": "scripts/build_fate_map.py",
        "source": {
            "paper": "Wang et al., High-Fidelity Long-term Whole-embryo Lineage and Fate "
                     "Reconstruction by Iterative Tracking with Error Correction",
            "doi": "10.64898/2026.03.12.711203",
            "preprint": "bioRxiv 2026-03-16, CC-BY",
            "data_doi": "10.17632/tg55phtk4r.1",
            "data_name": "Evaluation results of ITEC (Mendeley)",
            "files": ["ITEC-FISH2-1000-Spot.csv", "ITEC-FISH2-1000-Link.csv", "params_FISH2.csv"],
            "code": "https://github.com/yu-lab-vt/ITEC",
            "dataset": "FISH2 — the 1001-frame whole-embryo reconstruction",
        },
        "window": {
            "frame_min": 0, "frame_max": FRAME_MAX, "step": STEP,
            "hpf_min": round(hpf(0), 3), "hpf_max": round(hpf(FRAME_MAX), 3),
            "seconds_per_frame": round((HPF1000 - HPF0) * 3600 / 1000, 2),
            "grid": [round(hpf(int(f)), 4) for f in grid],
        },
        "integrity": {
            "released_frames": 1001,
            "used_frames": FRAME_MAX + 1,
            "note": "The whole released movie is used. Every one of the 18,447,520 links "
                    "is a single-frame step with a median displacement of 2.7 px, inside "
                    "ITEC's own max_dist of 50 px. The one hazard is that CSV row order "
                    "stops matching spot ID at ID 13,817,671; arrays must be scattered by "
                    "ID before use or the second half of the movie is silently rewired.",
        },
        "geometry": {
            "centre": [round(float(c), 2) for c in centre],
            "radius": round(radius, 2),
            "animal_axis": [round(float(a), 4) for a in axis],
            "dorsal_meridian_deg": round(dorsal, 2),
            "z_ratio": Z_RATIO,
            "note": "The blastoderm is a shell on a near-constant-radius sphere. Latitude "
                    "from the animal pole is the epiboly coordinate; longitude about that "
                    "axis is dorsoventral. Both are fitted from the cell cloud — no "
                    "landmark was placed by hand.",
        },
        "counts": {
            "spots_released": 18_497_012,
            "spots_in_window": int(N),
            "links_in_window": int(len(src)),
            "cells_first_frame": int(n0),
            "cells_last_frame": int(len(last)),
            "traced_to_founder": int(len(tips)),
            "traced_fraction": round(len(tips) / len(last), 4),
            "founders_with_descendants": int(len(fdrs)),
            "branch_points": int(len(branch)),
            "segments": int(len(seg_len)),
            "samples": int(len(lat_all)),
        },
        "stages": [{"hpf": h, "name": n, "note": d} for h, n, d in STAGES
                   if hpf(0) - 0.3 <= h <= hpf(FRAME_MAX) + 0.2],
        "territories": [{"key": k, "label": lab, "classical": cl,
                         "lon_max": lm, "lat_lo": lo, "lat_hi": hi,
                         "cells": int((terr_last == i).sum()),
                         "traced": int((terr_tip == i).sum())}
                        for i, (k, lm, lo, hi, lab, cl) in enumerate(TERRITORIES)],
        "caveats": [
            "The paper's >99.7% accuracy is per linkage between adjacent frames. Over "
            "600 frames it reports ~50% of complete lineages error-free, so a single "
            "long path is likelier than not to contain an error even where the "
            "aggregate picture is sound.",
            f"Only {len(tips)/len(last)*100:.0f}% of cells at the last frame trace back "
            "to a founder; the rest sit on tracks that begin mid-movie. Absence of a "
            "lineage is a tracking outcome, not a biological one.",
            "One imaged embryo. Nothing here is a population statistic.",
        ],
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    for p in ("meta.json", "founders.bin", "flow.bin", "final.bin", "first.bin"):
        print(f"  wrote {p}  {(OUT/p).stat().st_size/1e6:.2f} MB")


if __name__ == "__main__":
    main()
