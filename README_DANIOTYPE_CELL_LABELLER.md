# DanioType · Kasperov — Cell-Type Labelling Workflow

The canonical guide to the human-in-the-loop zebrafish cell-type labelling tool that lives at
**`/daniotype_kasperov`** (production: `https://www.zeroshot.bio/daniotype_kasperov`, Basic-Auth gated).

Named for Kasparov's thesis that the strongest systems are human–AI hybrids: a three-personality
agent serves grounded, cited evidence for every single-cell cluster, and a human curator (or the
auto-pilot) walks the atlas cluster by cluster, accepting / relabelling / abstaining on each call.

> **Scope.** This README is dedicated to the cell-labeller. For the wider site see the root
> `README.md`. For the worker, see `backend/daniotype_autopilot_api/README.md`. For the clustering
> methodology writeup see `src/app/daniotype_kasperov/CLUSTERING_REPORT.md`.

---

## 1. The two workflows

The landing page is a grid of **dataset cards**. Each *ready* card offers two paths:

| Button | Path | What it does |
|---|---|---|
| **＋ New Run** | the wizard | Run a fresh labelling job from scratch, cluster by cluster. |
| **▤ View Completed Runs** | the read-only viewer | Browse every run ever saved for that dataset and inspect one in detail. |

These are wired **in-page** (no separate routes) off the single client component; a `stage` state
machine drives the wizard and `viewRunsFor` / `viewingRun` drive the viewer.

### New Run — three numbered steps

1. **Clustering** — the de-novo clustering is presented "fresh": the UMAP starts grey, a
   **"Good to proceed — apply this clustering →"** button colours the clusters in, and the
   *How the clustering is decided* panel shows the recipe, the Leiden **resolution sweep** (res →
   clusters → coherence → min-size, chosen row ★) or the silhouette-gating criteria, and a
   "Chosen: res X → N clusters" glance banner. Then **Choose a model →**.
2. **Model & Harness** — one page to pick **both** the model (with a projected full-run cost) and
   the **harness** (the labelling loop + grounding rules). Below the pickers, an expandable panel
   shows the three personalities' **full system prompts**, the loop schematic, and the judge. Then
   **Proceed to 3. Cell Labelling →**.
3. **Cell Labelling** — the chat interface. Launch the **AutoPilot** (local or persistent server
   run), watch it label each cluster, and on ground-truth datasets press **Compare to … ground
   truth**. The per-cluster Daniotype-vs-GT breakdown renders below. **Save** lives at the very
   bottom, gated on a completeness checklist (every cluster labelled + tier confidence on every
   cluster + GT comparison run on GT datasets).

> A New Run is **naked**: picking a dataset pre-loads nothing — no cached run, no carried
> model/harness, no previous labels. Every step starts empty.

### View Completed Runs — read-only viewer

`▤ View Completed Runs` opens a per-dataset list (model · #labelled · scored · harness · date ·
cost · note). Archived runs are off by default behind a **"Show archived"** toggle, badged by
reason (**quarantined** / **superseded** / **other**). Click a run → a strictly read-only viewer
with **three tabs mirroring the steps**:

1. **Clustering** — the atlas map + the full clustering provenance.
2. **Model & Harness** — model, harness (version/name/commit/stamp), provenance, and the same
   personalities/loop/judge panel.
3. **Cell Labelling** — the **exact** per-cluster Daniotype-vs-GT breakdown (the Scorecard in
   `readOnly` mode); **click any cluster row → its full saved chat history**, then ← Back.

No editing / streaming / autopilot is reachable from the viewer.

---

## 2. The three personalities, the loop, and the judge

A single model is prompted in three modes (the **harness**). The active harness is **v1.1**
(`native-validated · roll-up/superset judge`); the registry is `harness_registry.json`.

- **🔬 Researcher** — restricted web search over ZFIN / ZFA / GO; grounds the call in cited
  records. Two run as independent proposers.
- **🗄 Archivist** — answers only from the dataset's raw numbers, fetched **live** from the
  `:5007` stats service (log₂FC, %-expressing, specificity, BH p-values, co-expression). No
  fabrication: every number comes from a tool call made that turn.
- **🧠 Reasoner** — the driver: synthesises, dispatches the other two, and **concludes** (or
  **abstains**) at the deepest ontology tier the evidence supports.

**The loop:** `① Researcher×2 → ② Archivist → ③ Reasoner → ✓ conclude/abstain`, repeating until
the evidence converges. A **grounding guard** verifies the `:5007` service is serving *this*
dataset (by marker-enrichment direction) before any spend — the fix for the historical `ba32de`
contamination where ChemFish was served MiniFin stats.

**The judge** (ground-truth scoring) is a separate channel: a semantic LLM judge (synonym /
ontology / lineage equivalence, **not** string match), driver-scored at each native tier with
abstention credited at the reached tier. It is non-deterministic (~±2–3 pt aggregate band), so a
version delta must exceed that band to count as real.

The actual full system prompts live in `personas.ts` (copied verbatim from
`src/app/api/kasperov_agent/route.ts`) and are surfaced on the Model & Harness step/tab.

---

## 3. Datasets

Registered in `KasperovClient.tsx` (`DATASETS`); per-dataset facts in `dataset_facts.json`.

| id | name | GT? | tiers | notes |
|---|---|---|---|---|
| `zscape` | ZSCAPE Classic | ✅ | 4 (germ/tissue/broad/sub) | Saunders et al.; in-paradigm benchmark |
| `chemfish` | ChemFish | ✅ | 2 (tissue/sub) | Barkan et al.; in-paradigm |
| `daniocell` | DanioCell | ✅ | 2 (tissue/broad) | Sur et al. (Farrell/NICHD); **independent** cross-platform |
| `minifin` | MiniFin | — | — | in-house Parse Evercode reference |
| `megafin_parse` | Parse MegaFin Part 1 | — | — | Parse pipeline build |
| `megafin` | Manual MegaFin Part 1 | — | — | Lawson `.h5ad` build |
| `zscape_v2` | ZSCAPE V2 | — | — | stub (`status: "soon"`) |

GT datasets hold the authors' published labels out and score our de-novo names against them.
The "native tiers" map (`Scorecard.tsx → NATIVE_TIERS_BY_DATASET`) sets how many tiers each
GT dataset scores (4 for ZSCAPE, 2 for ChemFish/DanioCell).

---

## 4. Architecture

```
Browser (Next.js client, Basic-Auth gated)
  └─ /daniotype_kasperov  ── KasperovClient.tsx (wizard) + components/RunViewer.tsx (viewer)
        │
        ├─ /api/kasperov_agent       → OpenAI Responses API (the 3 personalities)
        ├─ /api/kasperov_confidence  → per-tier confidence scoring
        ├─ /api/kasperov_score       → the ground-truth judge
        ├─ /api/kasperov_proxy       → cited-page iframe proxy
        ├─ /api/kasperov_runs        → run store (list/get/save)  ┐ proxy to the worker
        ├─ /api/kasperov_runs/all    → cross-dataset run list      ┘ (KASPEROV_AUTOPILOT_URL)
        └─ /api/kasperov_autopilot   → start/poll a persistent server run
                                          │
                EC2 worker (FastAPI, 127.0.0.1:5008, systemd) ── backend/daniotype_autopilot_api/app.py
                  ├─ drives the SAME loop headlessly (calls the deployed /api endpoints — all
                  │  secrets stay on Vercel; the box holds none)
                  ├─ run store on the EBS volume:  /data/daniotype_runs/<datasetId>/
                  └─ grounds on the :5007 stats service (minifin_query)
```

- **Frontend** auto-deploys to production on push to **`main`** (Vercel). Non-`main` branches get
  preview URLs. The whole `/daniotype_kasperov` route + `/api/kasperov_*` are behind **HTTP Basic
  Auth** (`KASPEROV_BASIC_PASSWORD`, `src/middleware.ts`) — any username, password-checked.
- **Worker** is a systemd service (`daniotype_autopilot.service`, `/data/.venv/bin/uvicorn
  app:app --port 5008`). It is **not** auto-deployed by a git push — code changes to `app.py` go
  live only on `sudo systemctl restart daniotype_autopilot`.
- **Env that must be set** (Vercel + worker): `KASPEROV_AUTOPILOT_URL`, `KASPEROV_AUTOPILOT_TOKEN`,
  `KASPEROV_BASIC_PASSWORD`, `OPENAI_API_KEY`. Wizard assets (`umap.json`, `groundtruth.json`,
  archivist extracts) are served statically by nginx from `daniotype_data/` (CORS-enabled), not
  bundled into the Vercel function.

---

## 5. The run store

On-box at **`/data/daniotype_runs/<datasetId>/`** (EBS, *outside* the repo). Per dataset:

- `<runId>.json` — the full saved run (self-contained: clusters + labels + confidence + transcripts
  + cost + groundTruth scores). `runId = YYYYMMDD-HHMMSS-<hex6>`.
- `_index.json` — active-run metadata, newest first (what the list endpoint returns).
- `_archive.json` — parked runs, each with an `archivedReason`.

The worker's `list_runs(dataset, include_archived=False)` returns `_index` by default; with
`?include=archived` it merges in `_archive`, tagging each with `archived:true` and a derived
**`archiveCategory`** (`quarantined` | `superseded` | `other`) via a classifier that mirrors
`completeness.ts` (contamination always wins).

### Completeness profiles

Runs differ in what they captured (some have full transcripts, some none; some have confidence,
GT, harness, provenance, notes; some don't). **`completeness.ts → computeCompletenessProfile(run,
context?)`** is a pure function (no I/O) that turns a run JSON into a capability descriptor
(`hasTranscripts` + coverage, `hasConfidence`, `scored`, `hasHarness`, `hasProvenance`,
`hasMarkers`, `hasClusteringStrategy`, `hasNote`, archive category, …). It drives the viewer's
progressive disclosure — a panel renders only when its data exists, else "not recorded in this
run".

> **Correctness rule:** `hasClusteringStrategy` is true **only** when the run JSON itself
> structurally snapshotted its strategy — never back-filled from live `dataset_facts.json`. A
> strategy the run may not have used is worse than a blank.

Tests: `completeness.test.ts` (run with `node --test src/app/daniotype_kasperov/completeness.test.ts`).
Distribution report over the whole store: `node scripts/completeness_report.ts` (read-only).

---

## 6. Run JSON schema (`daniotype_kasperov_run/v1`)

```jsonc
{
  "schema": "daniotype_kasperov_run/v1",
  "dataset": "ZSCAPE … (free-text recipe name)",
  "datasetId": "zscape",
  "model": "gpt-5.5",
  "cost": { "usd": 9.87, "estimated": true, "usage": { "<model>": { "in": 0, "out": 0 } } },
  "exportedAt": "…", "scoredAt": "…",
  "nLabelled": 55, "nValidated": 55,
  "note": "…", "source": "server" | "browser",
  "harness": { "id": "v1.1", "version": "1.1", "name": "…", "gitCommit": "…", "stampedAt": "…" },
  "provenance": { … pipeline/config … },         // present on newer server runs
  "clusters": [
    { "id": "0", "label": "Cluster 0", "validated": true,
      "finalLabel": "periderm · mature",
      "confidence": { "germ_layer": { "prediction": "ectoderm", "pct": 96.2 }, "tissue": {…}, "cell_type_broad": {…}, "cell_type_sub": {…}, "why": "…" },
      "addedMarkers": [ { "g": "krt4", "l2fc": 4.1, "via": "research", "dir": "up", "notes": [...] } ],
      "transcript": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…", "mode": "research", "thinking": "…" } ] }
  ],
  "groundTruth": {                                 // GT datasets only
    "scoredAt": "…", "scoring": "driver/v2",
    "aggregate": [ { "key": "germ_layer", "label": "Germ layer", "matched": 146, "total": 156, "pct": 93.6 }, … ],
    "verdicts": { "<id>": { "germ_layer": { "match": true, "note": "" }, … } },
    "subStratified": {…}, "abstention": {…}
  }
}
```

Promoted runs additionally carry `schemaBasis` / `basisNote` / `promotedFrom` / `promotedAt`, and
GT cards point at their evidentiary run via `dataset_facts.json → <ds>.scorecard.evidentiaryRunId`.

---

## 7. File map (`src/app/daniotype_kasperov/`)

| File | Role |
|---|---|
| `page.tsx` | thin server wrapper → `KasperovClient` |
| `KasperovClient.tsx` | the wizard: dataset picker, stage machine, MapStage, ModelHarnessPicker, ClusterStage (chat), run list modal, save flow |
| `components/RunViewer.tsx` | the read-only "View Completed Runs" viewer (3 tabs) |
| `components/UmapCanvas.tsx` | UMAP scatter renderer |
| `components/ChatMessage.tsx` | per-personality chat bubble + markdown + reasoning-trace dropdown |
| `components/MarkersPanel.tsx` | Top Markers panel (UP/DOWN bars + snowballed notes) |
| `components/ConfidencePanel.tsx` | four-tier confidence HUD (tweened) |
| `components/Scorecard.tsx` | GT scorecard + the per-cluster Daniotype-vs-GT breakdown (`readOnly` for the viewer) |
| `components/ClusteringProvenance.tsx` | "how the clustering is decided" panel (sweep / criteria) |
| `components/HarnessDetail.tsx` | personalities (full prompts) + loop diagram + judge |
| `components/{ImportButton,Typewriter}.tsx` | small shared bits |
| `types.ts` | shared data shapes (Cluster, Marker, ClusterConf, RunScore, DatasetDef, …) |
| `theme.ts` | design tokens + `THEME` (the 3 personality colours) + button styles |
| `useAtlas.ts` / `useTween.ts` | atlas loader hook / number-tween hook |
| `models.ts` | model registry + cost projection |
| `personas.ts` | the three full system prompts (display) |
| `dataset_facts.json` | per-dataset clustering facts + scorecards |
| `harness_registry.json` | versioned harness definitions + verification history |
| `completeness.ts` / `completeness.test.ts` | run capability profiler + tests |

Backend: `backend/daniotype_autopilot_api/app.py` (worker). Report: `scripts/completeness_report.ts`.

---

## 8. Develop & verify

```bash
# from the repo root
npx tsc --noEmit                                              # typecheck (excludes scripts/ + *.test.ts)
node --test src/app/daniotype_kasperov/completeness.test.ts  # profiler tests (Node 24 strips TS)
npx next build                                                # production build
node scripts/completeness_report.ts                          # read-only run-store distribution report
```

The `completeness.ts` profiler runs in Node directly (Node 24 type-stripping); the app itself
targets es5 via the Next/TS config (`scripts/` and `*.test.ts` are excluded from the app
typecheck).

---

## 9. Known caveats / open threads

- **Native-vs-de-novo assets.** Three GT cards cite *archived-then-promoted* native-schema runs
  (`zscape/c4d306`, `chemfish/e4aafa`, `daniocell/b39045`) whose clustering (e.g. 156 clusters)
  differs from the currently-registered **de-novo** atlas (e.g. 55). In the viewer, those runs'
  breakdown shows correct Daniotype predictions + ✓/✗ matches (from the saved score) but the GT
  **label strings** may read "—" (the live atlas lacks native cluster ids). Runs made on the
  current atlas render fully. Resolving this means repointing the cards to de-novo runs or
  rebuilding the native atlas assets.
- **Quarantined runs.** `chemfish/ba32de` and `daniocell/de91d5` are contaminated (served the
  wrong dataset's stats) and stay in `_archive`, badged **quarantined** — never mixed with
  evidence.
- **Worker restarts.** `?include=archived` / `/runs/all` (and any `app.py` change) require a
  `sudo systemctl restart daniotype_autopilot`; a git push alone does not update the worker.
- **Judge variance.** Re-scoring the same run can swing ~±2–3 pt; compare versions in one paired
  judge pass, not across stored numbers.

---

*Production: `https://www.zeroshot.bio/daniotype_kasperov` (Basic-Auth gated). Deploys from `main`.*
