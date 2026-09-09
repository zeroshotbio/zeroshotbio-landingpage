#!/usr/bin/env python3
"""Write the provenance record for /fate_map_24_48 — Plate II.

Provenance only. No analysis, no new integration. Every row states what a source
is, when it covers, what kind of evidence it is, what this page uses from it
today, and where its publication lives.

Two rules govern the content:

  1. A figure is either read from an artefact at build time (the `live` block) or
     it is a reviewed constant with a `from` field naming where it was checked.
     Nothing is recalled from memory.
  2. `status` is honest about wiring. Only Platt and ZSCAPE feed the page today.
     Everything else is HELD — acquired, verified, in silver, and not yet wired.
     Drawing them identically would be the page claiming an integration it has
     not done.

Run:  python3 scripts/build_fate_map_24_48_sources.py
"""

from __future__ import annotations

import json
import pathlib
import sys

WEB = pathlib.Path(__file__).resolve().parent.parent / "public" / "fate_map_24_48"

# Bands, top to bottom. The order is what a source CONTRIBUTES to a fate map,
# from the most inferred at the top to the most directly observed at the bottom,
# because that is the axis the page exists to keep visible.
BANDS = [
    ("transitions", "Inferred transitions", "the arrows themselves"),
    ("abundance", "Abundance and timing", "how much of a state exists, and when"),
    ("vocabulary", "Harmonised vocabulary", "what to call a state across studies"),
    ("states", "Transcriptomic states", "independent atlases of the same window"),
    ("spatial", "Spatial transcriptomics", "where a transcript is, measured"),
    ("anatomy", "Anatomy and ontology", "the frame a label is placed against"),
    ("lineage", "Observed lineage and tracking", "a cell actually followed"),
]

# hpf windows. `hi_open` means the source continues past the axis.
SOURCES = [
    dict(key="platt", name="Platt", band="transitions", status="wired",
         modality="scRNA-seq (sci-RNA-seq3) + inferred state graph",
         window=[18, 96], evidence="inferred",
         scale="1,220,178 cells · 186 states · 173 edges",
         uses="Every arrow on Plate I, and its literature verdict. The state names are "
              "this release's. The abundance model is its control arm.",
         cite="Trapnell lab, University of Washington — reference v2.2.1. Cited on the "
              "project site as Duran et al., with no DOI given.",
         href="https://cole-trapnell-lab.github.io/lmx1b/",
         silver="platt/v2.2.1/",
         frm="silver platt/README.md; counts read from the CDS this pass"),

    dict(key="zscape", name="ZSCAPE", band="abundance", status="wired",
         modality="scRNA-seq, 1,860 individually barcoded embryos, 34 gene targets",
         window=[18, 96], evidence="observed",
         scale="3,231,733 cells · 2,374,633 in the window",
         uses="The crosswalk in every state's panel, joined on shared cell barcodes, and "
              "the developmental-time distribution. 89.1% of Platt's cells are ZSCAPE cells.",
         cite="Saunders, Srivatsan, Duran, Dorrity, Ewing, Linbo, Shendure, Raible, Moens, "
              "Kimelman & Trapnell. Embryo-scale reverse genetics at single-cell resolution. "
              "Nature 623 (2023).",
         href="https://doi.org/10.1038/s41586-023-06720-2",
         silver="zscape/", frm="silver zscape/README.md; counts read from the h5ad this pass"),

    dict(key="zmap", name="ZMAP", band="vocabulary", status="wired",
         modality="harmonised meta-atlas of eight published studies",
         window=[3, 120], evidence="inferred",
         scale="754,386 cells · 292,969 in the window · 8 studies",
         uses="The ZMAP block in every state panel: an independent identity call, matched by "
              "expression profile because ZMAP shares NO cells with Platt, plus a predicted "
              "developmental age carried from its own time_id. On germ layer the two routes "
              "agree for 160 of 185 graph states. It contains neither ZSCAPE nor Platt, which "
              "is exactly what makes it an independent check rather than an echo.",
         cite="Wagner lab, UCSF — Zebrafish Multi-study Atlas Project.",
         href="https://wagnerlabucsf.github.io/zmap/",
         silver="zmap/", frm="silver zmap/README.md; obs columns read this pass"),

    dict(key="daniocell", name="DanioCell", band="states", status="held",
         modality="scRNA-seq, 62 stages",
         window=[3, 120], evidence="observed",
         scale="489,686 cells · 149,105 in the window at 2-hour spacing",
         uses="Nothing yet. Second independent 2-hour series across the window, and the "
              "only source carrying state persistence (how long a state lasts).",
         cite="Sur, Wang, Capar, Margolin, Prochaska & Farrell. Single-cell analysis of "
              "shared signatures and transcriptional diversity during zebrafish development. "
              "Developmental Cell 58, 3028–3047.e12 (2023).",
         href="https://doi.org/10.1016/j.devcel.2023.11.001",
         silver="daniocell/", frm="silver daniocell/README.md; obs read this pass"),

    dict(key="zebrahub", name="Zebrahub", band="states", status="held",
         modality="scRNA-seq, single-embryo resolution, plus light-sheet tracking",
         window=[10, 120], hi_open=True, evidence="observed",
         scale="120,444 cells · 12,914 at 24 hpf and 15,483 at 2 dpf",
         uses="Nothing yet. Independent validation at both endpoints, and the only "
              "transcriptomic source already carrying ZFA ontology ids — 154 of them.",
         cite="Lange et al. — Royer lab, CZ Biohub. A multimodal zebrafish developmental "
              "atlas reveals the state-transition dynamics of late-vertebrate pluripotent "
              "axial progenitors. Cell (2024).",
         href="https://doi.org/10.1016/j.cell.2024.09.047",
         silver="zebrahub/", frm="silver zebrahub/README.md; obs read this pass"),

    dict(key="farnsworth", name="Farnsworth", band="states", status="held",
         modality="scRNA-seq, 10x v2",
         window=[24, 120], evidence="observed",
         scale="44,020 cells · 220 annotated clusters",
         uses="Nothing yet. Covers both endpoints, and its Table S2 carries a germ layer → "
              "tissue → cell type → subtype hierarchy for all 221 clusters.",
         cite="Farnsworth, Saunders & Miller. A single-cell transcriptome atlas for "
              "zebrafish development. Developmental Biology 459(2), 100–108 (2020).",
         href="https://doi.org/10.1016/j.ydbio.2019.11.008",
         silver="farnsworth/", frm="silver farnsworth/README.md; UCSC release read this pass"),

    dict(key="zesta", name="ZESTA", band="spatial", status="held",
         modality="Stereo-seq sections + matched dissociated scRNA",
         window=[3, 24], evidence="observed",
         scale="72,175 spatial bins at 24 hpf · 6 stages",
         uses="Nothing yet. The only spatial transcriptomics in the corpus — and it stops "
              "at 24 hpf. There is no 48 hpf spatial half to pair it with.",
         cite="Liu, Li, Li, Lin, Zhao, Liu et al. Spatiotemporal mapping of gene expression "
              "landscapes and developmental trajectories during zebrafish embryogenesis. "
              "Developmental Cell (2022).",
         href="https://doi.org/10.1016/j.devcel.2022.04.009",
         silver="zesta/STDS0000057/", frm="silver zesta/README.md; h5ads read this pass"),

    dict(key="tomoseq", name="Tomo-seq", band="spatial", status="held",
         modality="cryosection RNA-seq — spatial, but NOT single-cell",
         window=[48, 48], evidence="observed",
         scale="3 hearts, ~40 sections each, at 2 dpf",
         uses="Nothing yet. The only spatial evidence at 48 hpf, and it is one organ.",
         cite="Burkhard & Bakkers. Spatially resolved RNA-sequencing of the embryonic heart "
              "identifies a role for Wnt/β-catenin signaling in autonomic control of heart "
              "rate. eLife (2018). GEO GSE104057.",
         href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE104057",
         silver="tomoseq/GSE104057/", frm="silver tomoseq/README.md; tar read this pass"),

    dict(key="zfap", name="ZFAP", band="anatomy", status="held",
         modality="segmented 3D anatomy volumes, TIFF stacks",
         window=[24, 120], evidence="observed",
         scale="5 stages · 24 and 48 hpf both present",
         uses="Nothing yet. The geometric frame — and the only source covering both "
              "endpoints of the window in three dimensions.",
         cite="Zebrafish Anatomy Portal, Monash University.",
         href="https://www.zfap.org/",
         silver="zfap/volumes/", frm="silver zfap/README.md"),

    dict(key="zfin", name="ZFIN", band="anatomy", status="held",
         modality="ontology and curated literature records — no cells, no images",
         window=[0, 120], hi_open=True, evidence="curated",
         scale="3,113 ZFA terms · 2,578 overlap the window · 243,055 WT expression records",
         uses="Nothing yet, but it defines the window: the four ZFS stages Prim-5, Prim-15, "
              "Prim-25 and High-pec ARE 24–48 hpf. It is the vocabulary every other layer "
              "would be reconciled against.",
         cite="Zebrafish Information Network, University of Oregon.",
         href="https://zfin.org/downloads",
         silver="zfin/", frm="silver zfin/README.md; stage_ontology.txt read this pass"),

    dict(key="wagner", name="Wagner + TracerSeq", band="lineage", status="held",
         modality="scRNA-seq with clonal lineage barcodes",
         window=[4, 24], evidence="observed",
         scale="~92,000 cells · 7 timepoints, ending at 24 hpf",
         uses="Nothing yet. Real clonal lineage, in the same cells as the transcriptome — "
              "and it stops exactly where this window starts.",
         cite="Wagner, Weinreb, Collins, Briggs, Megason & Klein. Single-cell mapping of "
              "gene expression landscapes and lineage in the zebrafish embryo. Science "
              "(2018). PMID 29700229. GEO GSE112294.",
         href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE112294",
         silver="wagner/GSE112294/", frm="silver wagner/README.md; tar read this pass"),

    dict(key="linnaeus", name="LINNAEUS", band="lineage", status="outside",
         modality="scRNA-seq with CRISPR/Cas9 genetic scars",
         window=None, evidence="observed",
         scale="45 archive members · larval and adult organs",
         uses="Nothing, and probably nothing here. Its libraries are organ codes from "
              "larval and adult regeneration; the stage needs confirming before anyone "
              "counts it as covering this window.",
         cite="Spanjaard, Hu, Mitic, Olivares-Chauvet, Janjuha, Ninov & Junker. Simultaneous "
              "lineage tracing and cell type identification using CRISPR/Cas9 induced "
              "genetic scars. Nature Biotechnology (2018). PMID 29644996. GEO GSE106121.",
         href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE106121",
         silver="linnaeus/GSE106121/", frm="silver linnaeus/README.md; tar listing this pass"),

    dict(key="itec", name="ITEC", band="lineage", status="unregistered",
         modality="nuclear XYZ positions and parent→child links from light-sheet tracking",
         window=None, evidence="observed",
         scale="18,497,012 detections · 18,447,520 links · 1,000 frames",
         uses="Nothing yet, and it cannot be joined on time: the release carries FRAMES and "
              "no frame-to-hpf registration. It is the only source in the corpus that "
              "observes a division at all, which makes the missing registration the single "
              "most valuable thing to recover.",
         cite="Wang, Zhang, Chi & Yu. Evaluation results of ITEC. Mendeley Data V1 (2025).",
         href="https://doi.org/10.17632/tg55phtk4r.1",
         silver="itec/mendeley_tg55phtk4r_v1/", frm="the archive itself, read this pass"),

    dict(key="keller", name="Keller", band="lineage", status="held",
         modality="light-sheet nuclear positions and tracks — no transcriptome",
         window=[0, 24], evidence="observed",
         scale="7 BDML archives · 9.11 GiB",
         uses="Nothing yet. The physical embryo through the first day; like Wagner, it ends "
              "where this window begins.",
         cite="Keller, Schmidt, Wittbrodt & Stelzer. Reconstruction of zebrafish early "
              "embryonic development by scanned light sheet microscopy. Science 322, "
              "1065–1069 (2008). PMID 18845710. SSBD ssbd-repos-000005.",
         href="https://ssbd.riken.jp/repository/ssbd-repos-000005/",
         silver="keller/bdml/", frm="silver keller/README.md; the BDML XML read this pass"),
]


def main() -> None:
    """Write sources.json beside the page.

    Raises:
        SystemExit: If a source names a band that does not exist, or the page's
            own meta.json is missing.
    """
    meta_path = WEB / "meta.json"
    if not meta_path.exists():
        sys.exit(f"missing {meta_path} — run build_fate_map_24_48.py first")
    meta = json.loads(meta_path.read_text())

    keys = {b[0] for b in BANDS}
    for s in SOURCES:
        if s["band"] not in keys:
            sys.exit(f"{s['key']}: unknown band {s['band']!r}")

    # The two live figures on the plate, read rather than typed.
    live = {
        "graph_states": meta["counts"]["states"],
        "graph_edges": meta["counts"]["edges"],
    }
    enrich = WEB / "enrich.json"
    if enrich.exists():
        e = json.loads(enrich.read_text())
        live["enriched_states"] = len(e)
        live["crosswalked_states"] = sum(
            1 for v in e.values() if v["zscape"]["shared_cells"] > 0)

    doc = {
        "axis": {"lo": 0, "hi": 120, "window": [24, 48],
                 "ticks": [0, 24, 48, 72, 96, 120]},
        "bands": [{"key": k, "label": la, "note": n} for k, la, n in BANDS],
        "sources": SOURCES,
        "live": live,
        "status_legend": {
            "wired": "feeds the page today",
            "held": "acquired and verified, not yet wired in",
            "outside": "held, but its window is probably not this one",
            "unregistered": "held, but cannot be placed on this axis at all",
        },
    }
    (WEB / "sources.json").write_text(json.dumps(doc, indent=1))
    n_wired = sum(1 for s in SOURCES if s["status"] == "wired")
    print(f"  {len(SOURCES)} sources across {len(BANDS)} bands · {n_wired} wired, "
          f"{len(SOURCES) - n_wired} held")
    print(f"  live figures: {live}")
    print(f"  wrote {WEB/'sources.json'} ({(WEB/'sources.json').stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
