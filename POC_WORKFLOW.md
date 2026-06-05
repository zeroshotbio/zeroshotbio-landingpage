# POC_workflow — Mode-1 compound-insight wizard (scaffold + plan)

**Phase:** recon + scaffold + data-plan only. No wizard logic, no data wired in, nothing deployed.
**Created:** 2026-06-04. **Branch:** `poc-workflow-scaffold` (local only — never pushed).

## Scope
A 6-step wizard at route **`/POC_workflow`** that walks a viewer through one demo compound's
predicted profile, built from a static per-drug JSON. It reuses the Tahoe-100M analysis artifacts in
`/data/drug_dev/tahoe_embedding/` as the data layer. This phase delivers only: the route + a
placeholder screen (6 step stubs + a persistent honesty label), a proposed demo-drug set, and a
proposed JSON schema — all for sign-off before any building.

## Locked constraints
- **Do NOT deploy / push.** The site auto-deploys to the live domain via **Vercel on push to `main`**.
  Work stays on a local branch; the reviewer promotes it. Never `git push` from here.
- **Honesty label is persistent and in from the start:** *"Proof-of-concept on a public cell-line
  reference, Tahoe-100M, standing in for the zebrafish atlas."* Shown at top and bottom of the page.
- **Datasets/artifacts are read-only** (`/data/drug_dev/tahoe_embedding/`, `/data/datasets/...`).
- This phase = scaffold + plan: **no wizard steps, no data export, no model runs.**
- Demo set is a small curated subset (~16 drugs) — not the full 375 reference.

## Site stack (for matching)
Next.js 15 (App Router, `src/app/<route>/page.tsx`) · React 18 · TypeScript · Tailwind 3
(custom gray scale + `teal-color`, dark-mode class strategy) · Roboto Slab (root layout) · cream
background (`#f6f4f2`). Precedent wizard: `src/app/minifin_annotation_wizard` (iframes a static
bundle in `/public`). The POC scaffold is a **native React page** (Tailwind), consistent with the stack.

## Reusable data artifacts (read-only)
| Artifact | Path | Per-drug fields |
|---|---|---|
| Chem view | `tahoe_embedding/chem/chem_view.parquet` (377) | SMILES ✓(377), MoA-fine ✓, MoA-broad, targets ✓(262), 10 descriptors, ECFP-2048, pubchem_cid |
| Phenotype signatures | `tahoe_embedding/scrna/pseudobulk_mean_lfc.npz` | mean log2FC per gene (375 covered × 54,286 tested), n_cell_lines (≤50), dose 5.0 µM, control DMSO |
| Drug metadata | `tahoe_embedding/data/drug_metadata.parquet` (379) | drug, canonical_smiles, moa-fine, moa-broad, targets, pubchem_cid |
| Similarity matrices | `tahoe_embedding/scores/sim_{chem_tanimoto,chem_descriptor,pheno_hvg,pheno_pca}.npy` | 375×375; order = chem ∩ pheno-covered in chem_view order → nearest-neighbor lists + distances |
| Retrieval/validation | `scores/validation_summary.json`, `fusion_supervised_*` | per-view MoA/target retrieval baselines (chem→MoA 0.51) |

**Per-drug field availability (all present for the 375-drug reference):** SMILES ✓ · phenotype
signature ✓ · nearest-neighbor list ✓ (from sim matrices) · shared MoA/target ✓ (drug_metadata) ·
distance/confidence ✓ (1 − similarity to nearest reference).

## Proposed demo set (~16, span MoA, recognizable, full 50 cell-lines, clean) — for sign-off
Bortezomib (Proteasome), Ixazomib (Proteasome — same-MoA neighbor demo), Trametinib (MEK),
Dabrafenib (RAF — MAPK pathway-neighbor demo), Lapatinib (EGFR/ERBB), Paclitaxel (Microtubule),
Palbociclib (CDK), Rapamycin (MTOR), Dexamethasone (Glucocorticoid agonist), 5-Fluorouracil
(DNA synth/repair), Bicalutamide (AR antagonist), Bexarotene (Retinoid/RXR), Panobinostat (HDAC),
Decitabine (DNMT), Capivasertib (PI3K/AKT), Crizotinib (Multi-TK). *(Two intentional neighbor pairs
— proteasome and MAPK — to demonstrate the neighbor/mechanism steps.)*

## Proposed JSON schema (one record per drug — NOT yet generated)
```jsonc
// manifest: { dataset:"Tahoe-100M", n_reference_drugs:375, dose_uM:5.0,
//             control:"within-cell-line DMSO", honesty_label:"…", layout_basis:"…", drugs:[ … ] }
{
  "id": "Bortezomib", "display_name": "Bortezomib", "pubchem_cid": 387447,
  "moa_fine": "Proteasome inhibitor", "moa_broad": "inhibitor/antagonist", "targets": ["PSMB5"],

  "step1_structure":   { "smiles": "…", "source": "PubChem canonical (RDKit)" },
  "step2_fingerprint": { "n_cell_lines": 50, "n_genes_tested": 54286, "dose_uM": 5.0,
                         "top_up":   [{ "gene":"…","lfc":2.3 }],
                         "top_down": [{ "gene":"…","lfc":-2.1 }] },
  "step3_embedding":   { "coords2d": [x, y],
                         "neighbors": [{ "id":"Ixazomib","similarity":0.94,"rank":1 }] },
  "step4_mechanism":   { "neighbor_overlap": [{ "id":"Ixazomib","shared_moa":true,
                         "shared_targets":["PSMB5"] }] },
  "step5_reliability": { "nn_similarity": 0.94, "nn_distance": 0.06,
                         "horizon_band": "in-domain|near-edge|out-of-domain",
                         "metric": "ECFP Tanimoto to nearest reference",
                         "basis": "375-drug Tahoe reference" },
  "step6_report":      { "headline": "…", "mechanism_text": "…", "confidence_text": "…",
                         "caveat": "Proof-of-concept on a public cell-line reference (Tahoe-100M)…" }
}
```
Report text fields (step6) and the 2D layout (`coords2d`) are produced later — out of scope now.

## Scaffold — how to run locally
- Route file: `src/app/POC_workflow/page.tsx` (native React server component; placeholder).
- Node was not on the box; installed user-space nvm + Node 24, ran `npm install` (node_modules is
  gitignored). Verified: `npm run dev` → **http://localhost:3000/POC_workflow** returns HTTP 200 with
  all 6 step stubs + the honesty label rendered.
- To run: `source ~/.nvm/nvm.sh && cd /data/zeroshotbio-landingpage && npm run dev`.

## Status
**GREEN** — stack mapped, artifacts confirmed complete per-drug, demo set + schema proposed, scaffold
builds and renders locally on an isolated branch. Awaiting sign-off on demo set + schema before
building step logic and generating the JSON.

---

## Build status — Steps 1–6 (2026-06-04)
Full 6-step wizard wired to `public/POC_workflow/{drugs.json,constellation.json}`. Renders approved
JSON only (no new modeling). Production build clean (`next build` exit 0); `/POC_workflow` static,
5.2 kB. Dev: `source ~/.nvm/nvm.sh && npm run dev` → http://localhost:3000/POC_workflow.

**Quick-Start default = Panobinostat** — the one genuine *in-domain + nearest-neighbor-shares-MoA*
case (NN Belinostat, both HDAC inhibitors, shared target HDAC6).

Joint table (reliability band × NN shares MoA) across the 16:
- in-domain: Bortezomib, Dabrafenib, Paclitaxel, Rapamycin, **Panobinostat✓MoA**
- near-edge: Dexamethasone, 5-Fluorouracil, Crizotinib
- out-of-domain: Ixazomib, **Trametinib✓MoA**, Lapatinib, Palbociclib, Bicalutamide, Bexarotene, Decitabine, Capivasertib
- Only Panobinostat is in-domain *and* MoA-matching; Trametinib is MoA-matching but out-of-domain.
  (Honest: phenotype is a weak mechanism predictor — most NNs don't share MoA, shown as-is.)

Steps: 1 Submit compound · 2 Wet-lab exposure (conceptual + reveal) · 3 Response fingerprint
(up/down bars, cell-line labeled) · 4 Atlas projection (375-pt MoA-colored constellation, query ◆ +
neighbor links, low-variance-projection note) · 5 Contextualized results (neighbor table + tertile
reliability gauge) · 6 Atlas report (deterministic card + client-side .txt download). Honesty banner
top+bottom; step nav + chips. Local branch `poc-workflow-scaffold`, nothing committed/pushed/deployed.

---

## Build status — v2 (MoA-bridge, deployed to preview surface)
Enriched data layer + interactive UI. **The through-line is now MoA as the explicit bridge**: every
neighbor is reframed as a *characterized anchor* whose mechanism ports to the query, and the wizard
shows **two routes** to that mechanism — chemistry-predicted vs phenotype-neighbor — and whether they
agree. Production build clean (`next build` exit 0); `/POC_workflow` static, ~7.9 kB.

Data layer (generated read-only from Tahoe artifacts by `tahoe_embedding/scores/gen_poc_json_v2.py`):
- (a) **chemistry-space 2D projection** (PCA over standardized RDKit descriptors) alongside the
  phenotype PCA — drives the Step-4 regime toggle. Both regimes precomputed; **no live UMAP/recompute**.
- (b) **per-drug shared up/down genes** vs its nearest phenotype neighbor ("why it resembles").
- (c) **chemistry-route nearest neighbor + its MoA** (the second route; ECFP Tanimoto). Self-aliases
  (salts/solvates/stereoisomers of the same parent) are excluded so neighbors are distinct drugs.
- (d) **top-k mechanism consensus** for both routes.
- (e) the full **reference NN-distance distribution** (375 values) for a richer reliability histogram.

Demo-set MoA recovery (honest, shown as-is): **chemistry route 13/16**, **phenotype route 2/16**,
routes agree 2/16 — i.e. chemistry→MoA is strong, phenotype→MoA is weak; the wizard does not hide it.

UI changes: **Step 4** → interactive scatter (pan/zoom/hover/click) with a phenotype↔chemistry
**regime toggle**, color-by-MoA overlay + legend, query ◆ and the active route's neighbor links, and an
honest per-regime "2D is illustrative" caption. **Step 5** → two-route panel with agreement badges,
"why it resembles" gene-overlap chips, per-route top-k consensus, and an NN-distance **histogram** with
the query marked against the tertile bands. **Step 6** report gains a deterministic two-route synthesis.
Honesty banner (top+bottom), cell-line (NOT tissue) labeling, and deterministic report text retained.

Deployed POC-only on top of the v1 commit (no unrelated site files touched). Surface:
**https://zeroshot.bio/POC_workflow** (Vercel auto-deploy). Quick-Start default = Panobinostat.

---

## Build status — v3 (Step-3 response fingerprint, expanded to 4 views)
Researched the canonical ways people read a differential / perturbation response (volcano, heatmap,
GSEA/pathway, ranked-waterfall; MA also common but needs baseline expression we don't store). Step 3
is now a **four-view tabbed fingerprint**, all precomputed by `tahoe_embedding/scores/gen_poc_json_v3.py`:
1. **Volcano** — x = mean log₂FC, y = **cell-line support** (n of N lines). We only kept per-(drug,gene)
   sum+count (mean = S/C), so no per-replicate p-values exist; support is an *honest robustness
   stand-in*, labeled as such. Shows the full cloud incl. high-effect/low-support flukes.
2. **Waterfall** — every detected gene ranked by log₂FC (S-curve) with strong-mover counts; the named
   markers are **robust** genes only (support ≥ 30% of lines), so 1-cell-line flukes don't headline.
3. **Heatmap** — the query's signature genes × related drugs (self + phenotype neighbors + chemistry
   anchor), mean log₂FC, diverging color. Ties the fingerprint to the Step 4–5 MoA bridge.
4. **Pathways** — canonical transcriptional-program signature scores (mean log₂FC of detected marker
   genes; illustrative marker sets, not formal GSEA/FDR). Lights up correctly: Trametinib→MAPK
   feedback −2.6 (SPRY/DUSP/ETV), Bortezomib→proteostasis/heat-shock +2.0 (HSPA/CRYAB),
   Palbociclib→cell-cycle −0.8, Dexamethasone→glucocorticoid +1.3.

Labeled-gene views (bars→now robust top-up/down with support) use support-filtered genes; the volcano
still shows all. Build clean (`next build` exit 0); `/POC_workflow` static ~10 kB; drugs.json ~1.05 MB
(volcano clouds; gzips small). Honest labeling retained throughout.

---

## Build status — v4 (zebrafish organs, atlas neighbor-effects, 3D protein–molecule)
Generated by `tahoe_embedding/scores/gen_poc_json_v4.py`. drugs.json ~1.28 MB; `/POC_workflow` ~12 kB.
- **Step 3 reworked** per feedback: dropped Waterfall + Heatmap. Kept **Volcano**. **Expanded Pathways
  to 23 programs** (scrollable, click to expand member genes). Added a **Zebrafish organ-systems view**:
  a lateral zebrafish whose 9 organ systems light by *inferred* involvement (gray→amber→red), with a
  ranked organ list + drivers. Honestly framed as a stand-in — involvement is inferred from the
  molecular programs via a curated pathway→organ-system map (`PATHWAY_ORGAN`), not measured; in
  production this is read from real whole-organism zebrafish single-cell data.
- **Step 4 atlas gained a “What we infer the subject does — from its neighbors” section**: each nearest
  neighbor is a characterized compound shown with its top organ involvement + programs; their consensus
  is rendered as the subject's **assumed effect** (a lit zebrafish + consensus program chips). Makes the
  atlas premise — *the subject is assumed to behave like its characterized neighbors* — visual.
- **3D protein–molecule viewer** (Step 1): 2D and 3D shown **side-by-side** (no toggle). Fully
  **self-hosted — no third-party runtime dependency**: `3Dmol-min.js` is vendored at
  `public/POC_workflow/lib/`, and the 10 target structures are vendored at `public/POC_workflow/pdb/`
  (5LF3 trimmed to the 6 bortezomib-bearing catalytic chains, 8.5 MB→1.6 MB). Every drug has a
  precomputed RDKit ETKDG **3D conformer**; 10/16 also have a **verified target-complex** (RCSB-checked
  PDB + ligand code), e.g. rapamycin at the FKBP12–mTOR interface (1FAP/RAP), bortezomib in the 20S
  proteasome (5LF3/BO2), lapatinib–EGFR (1XKK/FMM), paclitaxel–β-tubulin (1JFF/TA1). Ligand highlighted
  magenta, protein as spectrum cartoon; drag/zoom. Honest labels (conformer geometry illustrative;
  complexes are real experimental structures).
- Pathways light up correctly per MoA (Trametinib→MAPK-feedback, Bortezomib→proteostasis, etc.); organ
  inference yields a distinct per-drug pattern. Build clean (`next build` exit 0).

---

## Build status — v5 (MegaFin 94-compound atlas + intro paths + novel/interpolation)
Whole demo switched off Tahoe-375 onto the **94-compound MegaFin zebrafish atlas**. New generator
`tahoe_embedding/scores/gen_megafin_json.py` (+ `fetch_megafin_smiles.py` → `megafin_smiles.json`).
- **Chemistry is REAL** (RDKit from PubChem SMILES, fetched via the 2025 `SMILES`/`ConnectivitySMILES`
  property names): 2D depiction, 3D conformer, 10 descriptors, ECFP-Tanimoto neighbors, descriptor PCA.
- **Phenotype is SYNTHESIZED per drug-class** (`CLASS_PROGRAMS`: 24 classes → signed weights over the
  23 programs) + deterministic per-drug noise → programs, gene-level volcano, pheno PCA, pheno-neighbors,
  organs, reliability, neighbor-effects. Honestly labeled illustrative/placeholder pending real MegaFin
  scRNA. Emergent: phenotype clusters by class (74/94), chemistry sometimes diverges (40/94) → two-route
  panel stays interesting (reframed as agreement→confidence; old 0.51/0.095 stats dropped).
- **Intro screen** before Step 1: choose **Known compound** (94-atlas dropdown grouped by 24 classes) or
  **Novel molecule** (paste SMILES, or "🎲 generate within the interpolation space" → drops a candidate
  in a dense manifold region with interpolation-confidence % + neighbor lines; "Use candidate" runs the
  workflow on the local consensus, anchor exemplar shown, flagged "interpolated candidate, not measured").
- Quick-Start = Sorafenib. Honesty banner reframed to MegaFin/illustrative. Step 2 reworded for
  zebrafish/known-vs-novel. 10/94 target complexes vendored (Paclitaxel 1JFF, Palbociclib 5L2I, Rapamycin
  1FAP, Dexamethasone 1M2Z, Bicalutamide 1Z95, Celecoxib 3LN1, Sorafenib 1UWH, Vorinostat 1T69, Olaparib
  5DS3, Abiraterone 3RUK); 5 now-unused Tahoe-drug PDBs removed. drugs.json ~4.8 MB (gzips ~1 MB).

---

## Build status — v6 (refinements: known=literature-guest, logo/home, Step2 animation, narrative)
- **Reframed "Known compound"**: it's a real, literature-backed drug *not* in the measured 94. Added 12
  curated **guests** (Imatinib, Gefitinib, Erlotinib, Doxorubicin, Methotrexate, Tamoxifen, Warfarin,
  Sildenafil, Omeprazole, Morphine, Diclofenac, Trametinib) — real chem from PubChem, **interpolated**
  into the atlas (chem-Tanimoto-weighted mean of nearest-94 program vectors, projected onto the fitted
  chem/pheno PCA), each with an **agentic-research dossier** (target/indication/MoA/findings/zebrafish,
  illustrative). Known Step 1 lists guests + shows the 🔎 dossier panel. Novel path unchanged (94-only
  interpolation). drugs.json now 106 records (94 atlas + 12 guests), ~5.6 MB. Quick-Start = Doxorubicin.
- **Logo/home button** (`/images/zeroshot_bio_gritty.png`) top-left of every screen → back to the intro.
- **Steps bar** forced to one row (short labels + `flex-nowrap` + overflow-x scroll).
- **Step 2 animation**: a looping Rube-Goldberg SVG (dose→zebrafish→incubate→dissociate→scRNA-seq→data,
  travelling marble + SMIL) with an explainer that this is where a real zebrafish exposure run kicks off.
- **Step 3** now defaults to the **Zebrafish organs** view (first tab).
- **Expanded "What we infer" section**: generator emits an 8–9-sentence deterministic **narrative**
  (per-organ + per-pathway interpretation, confidence, dossier note) rendered as a "Reading the
  inference" panel — the interpretation layer the user flagged as most valuable.

---

## Build status — v7 (Step 2 split-flap .h5ad, Step 3 organ detail + pathway diagrams, Step 4 confidence field)
- **Step 2 redesigned**: a canvas **split-flap `.h5ad` board** (100×100 cells×genes) that resolves over
  ~5 s (deterministic per-drug, diagonal lock wave), with "that's what an scRNA-seq run would have been
  producing · ≈1 month from submission", a "view mock pseudo-results" button that resolves the board into
  an expression **heatmap**, then "Next → fingerprint section". Old Rube-Goldberg removed.
- **Step 3 Zebrafish**: each organ row is now **clickable** → developer-relevant detail (what high
  involvement means + how we'd confirm it in zebrafish + why it lit up).
- **Step 3 Pathways**: **pathway diagrams** below the bars — per top-3 program, a hub→member-gene diagram
  (induced ▲ red / repressed ▼ blue from the signature). **Volcano tab removed** (and volcano dropped from
  the generator → drugs.json ~4.5 MB).
- **Step 4**: an **interpolation-confidence heat field** (atlas-density KDE rendered to a canvas →
  `<image>`) behind the manifold — warm where dense (confident interpolation), cool in gaps; pans/zooms
  with the plot, on/off toggle + legend.
- **Guest fix**: literature guests now seed phenotype from a **mechanism-based program profile**
  (`GUEST_PROGRAMS`, since the agentic step tells us the mechanism) instead of blind chemistry-nearest —
  so Doxorubicin reads as p53/DNA-damage (phenoNN Rucaparib), not steroid. Chemistry route stays real
  (honestly shows chemistry≠mechanism). Quick-Start guest = Doxorubicin.

---

## Build status — v8 (self-contained 3D viewer + cinematic Step 2)
- **3D viewer rewritten with NO external library** (3Dmol.js dropped; vendored lib removed). A
  self-contained renderer parses the embedded MOL/V2000 conformer (and the local PDB → Cα backbone
  trace + ligand) and draws **ball-and-stick on a 2D canvas** with its own rotation math (auto-spin +
  drag). Molecule/Target-complex toggle kept; PDBs still served locally. Can't fail to load — no WebGL.
- **Step 2 is now a cinematic** (single canvas, stage machine): zebrafish + the drug's real conformer
  side-by-side with an obvious "Dose → run exposure" button → drug shrinks and strikes the fish → fish
  **atomizes** into particles → a **sequencer** box shakes then fades → a 4×4 `.h5ad` corner (cells/genes
  labelled) **zooms out** through ~100×100 toward **32,000 × 32,000** with split-flap digit-flipping and
  a "processing & sequencing in progress" + growing size counter → **resolves into a heatmap** → Next.

---

## Build status — v9 (dark-mode light switch)
☀️/🌙 toggle in the header (persisted to localStorage). Reuses the site's existing global `.dark`
bg/border overrides (by putting `dark` on the page `<main>`), and adds a **POC-scoped** stylesheet under
`.poc-dark` (text grays + accent-panel tints + keep the 2D RDKit depiction on white + invert the logo) so
it does NOT touch globals.css or any other page. POC files only (PocClient.tsx).
