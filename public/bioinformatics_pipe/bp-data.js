/* ============================================================
   bp-data.js — what this page ASSERTS.
   Owned by the on-instance. Every fact here was read from the repos and the
   live buckets, not from a README summary.

   WHAT THIS PAGE IS
   One leg of the MiniFin steel thread, drawn at the resolution the map at
   /data_structures cannot show: the six culls between the unfiltered DGE that
   comes out of split-pipe and the filtered matrix that goes into
   normalisation.

   THE DISTINCTION THIS PAGE LIVES OR DIES ON
   Two kinds of number appear on it, and they are never allowed to look alike:

     REAL      read from the artifacts. 2,743,021 barcodes. 32,520 genes.
               94,616 called cells. These came out of code that ran.
     MODELLED  computed at load time from a seeded simulation, in bp-pop.js.
               Every threshold on tiles 02-06 is one of these. They are
               labelled "modelled" on the tile itself, in the reader, and in
               the ledger.

   The reason the distinction matters is the state of the pipeline. Of the
   four culls drawn here, ONE has run against the real data. The other three
   are a docstring that raises NotImplementedError. A page that showed a
   mitochondrial cutoff without saying it was invented would be claiming a
   result nobody has produced.

   Verified 2026-08-23 against zsb-bronze 0414ac4 and zsb-silver b4253a2:
     - zsb-bronze contains NO mito, complexity or doublet code. The only
       "mitochondrial" string in the tree is a sample name in a test fixture.
     - zsb-silver's build_gold() is a docstring and a raise. It names "QC and
       doublet filtering"; it does not name mito% or complexity by any name.
     - zsb-bronze DOES implement barcode_ranks(), a real port of the
       DropletUtils knee search. It is not the shipping policy.

   Load order: pop -> draw -> tiles -> data -> view
   ============================================================ */

/* real figures, from the artifacts */
const REAL = {
  barcodes: 2743021,
  genes: 32520,
  called: 94616,
  nnzUnfiltered: 279000000,
  nnzCalled: 193544653,
  replicates: 48,
  samples: 43
};

/* state, and it is the argument of the page:
     run      code exists and has run against the real data
     alt      code exists, has run, but is not the shipping policy
     unbuilt  named in a docstring that raises
     absent   not written anywhere, under any name
     none     the artifact does not exist */
const STAGES = [
  {
    id: "raw", key: "01", name: "Raw field", group: "① In",
    tile: "raw", state: "run",
    sub: "unfiltered DGE · split-pipe output · zsb-bronze process convert",
    big: "2,743,021 barcodes",
    brief: `The matrix as split-pipe hands it over: <mark>2,743,021 barcodes by 32,520 genes</mark>, about 279 million non-zero entries, streamed to an h5ad in 100,000-cell blocks so it never has to be held whole. Nothing is culled here. The tile exists to make one ratio physical before anything is cut — 96.6% of these barcodes are empty droplets and ambient transcript, and the real cells are the sparse constellation inside the haze. The floor of 10 transcripts is not a choice made here; split-pipe already dropped everything below it.`,
    kv: [["Source", "zsb-bronze · process convert"], ["Shape", "2,743,021 × 32,520"],
         ["Non-zeros", "~279 million"], ["Peak memory", "~150 MB"],
         ["Drawn", "14,000 dots · 1 dot ≈ 196 barcodes"], ["State", "implemented and exercised"]],
    real: true
  },
  {
    id: "knee", key: "02", name: "The knee", group: "② The four culls",
    tile: "knee", state: "alt", groupMark: true,
    sub: "rank curve · steepest descent · the only cull with code that has run",
    big: "transcript cutoff",
    brief: `Rank every barcode by transcript count, take the curve into log-log, and cut at the point of steepest descent. <mark>This is the one cull on the page whose method exists in code</mark> — zsb-bronze's <mark>barcode_ranks</mark>, a real port of the DropletUtils search. It is not what ships. The canonical policy reads Parse's own recorded per-slice thresholds and reproduces the delivered barcode set exactly: 94,616 cells, jaccard 1.0000. The knee search, given no threshold at all, independently finds 94,338 — 278 short, jaccard 0.9827. Close enough to be a real check, different enough to matter.`,
    kv: [["Implemented in", "zsb-bronze · cells.py"], ["Policy that ships", "parse-cutoffs — 94,616, jaccard 1.0000"],
         ["This method finds", "94,338 — jaccard 0.9827"], ["Third policy", "parse-settings — 94,876, jaccard 0.9940"],
         ["Cutoff on the tile", "modelled — the real one is per-slice"], ["State", "code exists, has run, not canonical"]],
    real: false
  },
  {
    id: "mito", key: "03", name: "Mito %", group: "② The four culls",
    tile: "mito", state: "absent",
    sub: "median + 3 MAD · not implemented in any repo",
    big: "cutoff %",
    brief: `A cell leaking its cytoplasm keeps its mitochondria longest, so a high mitochondrial read fraction is the signature of one that was dying before it was fixed. The cut is <mark>median + 3 × MAD</mark> over the survivors, not a round number — the arithmetic is on the tile because it is short enough to check by eye. <mark>No repo implements this.</mark> zsb-bronze has no mitochondrial code at all; zsb-silver's build_gold names "QC" and raises. The threshold shown is computed from the simulation and is there to show the shape of the decision, not its answer.`,
    kv: [["Implemented in", "nowhere"], ["Named in", "build_gold docstring, as \"QC\""],
         ["Method drawn", "median + 3 × MAD, robust"], ["Cutoff", "modelled"],
         ["Blocks on", "Gold v1 QC sign-off"], ["State", "not written, under any name"]],
    real: false
  },
  {
    id: "complexity", key: "04", name: "Complexity", group: "② The four culls",
    tile: "complexity", state: "absent",
    sub: "genes against transcripts · both tails, opposite reasons",
    big: "robust band",
    brief: `Genes against transcripts, log-log, with a least-squares cubic through the cloud and a band opened to a robust residual sigma. <mark>Both tails go, for opposite reasons</mark>, which is the whole point of the tile: above the band are under-amplified cells, unusually many distinct genes per transcript; below it are over-amplified ones, the same transcripts read again and again. Reading this filter as one-sided is the common mistake, so the two annotations sit diagonally opposed. Not implemented anywhere, and unlike the mito cut it is not even named in the docstring that raises.`,
    kv: [["Implemented in", "nowhere"], ["Named in", "no repo, under any name"],
         ["Method drawn", "cubic fit + robust residual sigma"], ["Band", "modelled"],
         ["Above the band", "under-amplified"], ["Below the band", "over-amplified"]],
    real: false
  },
  {
    id: "doublet", key: "05", name: "Doublets", group: "② The four culls",
    tile: "doublet", state: "unbuilt",
    sub: "scDblFinder shape · the reference is manufactured from the data",
    big: "flagged %",
    brief: `Two cells in one barcode. They are found by <mark>manufacturing the reference</mark>: take pairs of real cells from different neighbourhoods, add them together, and score every real cell by how many of its nearest neighbours are one of those synthetics. A doublet lands between two clusters, where no singlet lives. The left panel shows that manufacture, because it is the part nobody pictures. This over-calls, badly, for cells sitting between adjacent neighbourhoods — and the expected rate is technology-dependent. Parse combinatorial barcoding is not droplet capture, and the droplet collision formula does not transfer.`,
    kv: [["Implemented in", "nowhere"], ["Named in", "build_gold docstring — \"doublet filtering\""],
         ["Method drawn", "kNN against synthetic doublets"], ["Threshold", "median + 3 × MAD on scores"],
         ["Rate", "modelled — over-calls by roughly 2×"], ["Caution", "rate is technology-dependent"]],
    real: false
  },
  {
    id: "filtered", key: "06", name: "Filtered DGE", group: "③ Out",
    tile: "filtered", state: "none", groupMark: true,
    sub: "the gold matrix · does not exist",
    big: "cells retained",
    brief: `What the four culls would leave: a cell-by-gene matrix with raw counts preserved in <mark>layers['counts']</mark> and every parameter, seed and cell-count transition stamped into <mark>.uns</mark>. The ghosts behind it are everything removed, kept visible so the attrition stays legible. <mark>This artifact does not exist.</mark> build_gold raises on every call, nothing has ever been written to the gold bucket, and the bucket itself refuses both ListBucket and HeadBucket from here. The retained count is modelled. It is also not the end — this matrix is the input to normalisation.`,
    kv: [["Artifact", "does not exist"], ["Would be written by", "zsb-silver · publish_gold — also raises"],
         ["Gold bucket", "AccessDenied · HeadBucket 403"], ["Cells retained", "modelled"],
         ["Preserves", "layers['counts'] before .X changes"], ["Feeds", "normalisation, then HVGs and embeddings"]],
    real: false
  }
];

/* what is deliberately NOT here, which is itself a claim */
const OMITTED = {
  name: "No ambient-RNA correction",
  brief: `There is no soup-correction tile, and the absence is the argument. Ambient RNA is a droplet problem: it is free transcript floating in the emulsion, partitioned into every droplet alongside whatever cell is there. <mark>Parse barcodes inside the fixed cell and washes between rounds</mark>, so the free transcript is washed away rather than captured with the cell. Importing SoupX or CellBender here would be borrowing a correction for a failure mode this chemistry does not have. If a gap seems to open between the knee and the mito filter, that gap is the claim.`
};

const OVERVIEW = {
  eyebrow: "Zeroshot · the bioinformatics pipe",
  title: "Unfiltered → Filtered",
  sub: "six tiles · four culls · one of them has code that has run",

  brief: `Every worked example here is <mark>MiniFin 100k</mark>, the same steel thread the medallion map at <a href="/data_structures">/data_structures</a> follows — one 94,616-cell zebrafish chemical-perturbation dataset, carried end to end. This page is one leg of it at higher resolution: what happens between the unfiltered matrix split-pipe produces and the filtered matrix normalisation expects. Six tiles, four of them culls. The same barcode keeps the same position in all six, so a dot that dies at the knee is the dot that was drifting in the raw field.`,

  how: `<mark>Green survives, brown is leaving, gold is the threshold.</mark> Nothing else gets colour. Each cull has its own gesture and the difference means something: barcodes below the knee rain downward, dying cells rise off the top, under-amplified cells thin out while over-amplified ones swell and burst, and doublets pull apart into the two cells they always were. Every threshold on every tile is computed from the simulated population at load time — none is a literal. Reseed and they all move.`,

  state: `Two kinds of number, never allowed to look alike. <mark>Real</mark>: 2,743,021 barcodes, 32,520 genes, 94,616 called cells — these came out of code that ran. <mark>Modelled</mark>: every threshold on tiles 02 to 06. Of the four culls drawn, one has a method in code and it is not the one that ships; the mito and complexity filters are not written anywhere; doublet filtering is a docstring that raises. The filtered matrix at the end does not exist, and the bucket it would live in cannot be read from here.`
};

/* the state vocabulary, and what each one is allowed to claim */
const STATE_TEXT = {
  run:     { label: "has run",            tone: "keep" },
  alt:     { label: "code exists · not canonical", tone: "keep" },
  unbuilt: { label: "docstring · raises", tone: "cull" },
  absent:  { label: "not written",        tone: "cull" },
  none:    { label: "does not exist",     tone: "cull" }
};
