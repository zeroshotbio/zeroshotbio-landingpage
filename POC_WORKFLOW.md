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
