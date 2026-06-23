# Zeroshot Bio — Web App

*Next.js 15 · React 18 · Tailwind CSS · D3 · Flask · OpenAI gpt-5 series · Vercel*

---

## What's in this repo

Two things, and they share one codebase:

| Route | What it is | Stack |
|---|---|---|
| `/` | **The Zeroshot Bio landing page** — `zeroshot.bio` | Next.js + Tailwind |
| `/daniotype_kasperov` | **DanioType Auto Pilot Cell Type Labeller** — `zeroshot.bio/daniotype_kasperov` | Next.js (native) + OpenAI gpt-5 series + a live single-cell stats backend |

Everything else — the older ZSCAPE chat, the MiniFin annotation wizard, the gene
explorer, cross-species / perturbation viz, the dataroom — is retired and lives
under `src/archive/` (or unwired routes). It is not part of the active product
and is intentionally undocumented here.

---

## 1 · The landing page

`https://www.zeroshot.bio`

A Next.js + Tailwind marketing site (`src/app/page.tsx`, shared styling in
`src/app/globals.css`). Static, fast, dark-mode aware. Deploys automatically to
Vercel on every push to `main`. Nothing here calls a backend — it's the public
front door, and the DanioType labeller is the one live tool it links into.

---

## 2 · DanioType Auto Pilot Cell Type Labeller

`https://www.zeroshot.bio/daniotype_kasperov` · *(internally "daniotype · kasperov")*

A "video-game"-feel wizard that **names whole-organism zebrafish single-cell
clusters, one cluster at a time, across multiple atlases** — and, where the
source atlas ships published labels, **scores its own de-novo calls against that
ground truth at every ontology tier.** A human plays referee (Kasparov's
human–AI-hybrid thesis): a small panel of GPT "personalities" pulls grounded,
tool-verified evidence for a cluster, you watch them work — including the live
single-cell statistics they query — and you accept, relabel, or dig deeper. It
can also **run the whole loop itself** (auto-pilot, in-browser or persistently on
a server). Built natively in Next.js (`src/app/daniotype_kasperov/`), not an
iframe bundle.

### The goal: a four-tier call with calibrated confidence

A cluster is never reduced to one label. The objective is to characterize it at
**four nested ontology tiers** — `germ_layer → tissue → cell_type_broad →
cell_type_sub` — each with a prediction **and** a calibrated confidence %.
`/api/kasperov_confidence` reads the chat + the evidence promoted into Top
Markers and returns `{tiers:{…:{prediction, confidence_pct}}, why}`; confidence
is naturally highest at the coarse germ-layer tier and lowest at the fine
sub-type tier. That readout is the live **TIER CONFIDENCE** HUD, the per-cluster
columns on the world map, and what the ground-truth comparison grades. "Done" =
those confidences are driven up and the Reasoner concludes.

### The flow

**Choose a dataset** → **Choose a model** → intro → **world map** (reveal the
de-novo clustering) → click a cluster → **three-pane cluster screen**. From the
world map you can also **🤖 Activate AutoPilot** (in-browser) or **☁ Run AutoPilot
on server (persistent)**, and once clusters are labelled, **🎯 Compare to ground
truth** inline.

### Datasets

Each dataset is a self-contained asset family under
`public/daniotype_kasperov/`, picked by a `datasetId`; every dataset's run
persists under its own `localStorage` keys so runs never collide. Cluster facts
live in `src/app/daniotype_kasperov/dataset_facts.json`.

| Dataset | Cells (sampled) | Clusters | Ground truth | Platform |
|---|---|---|---|---|
| **ZSCAPE** | 250k of the 3,231,733-cell Saunders atlas | 55 de-novo | ✓ (germ_layer / tissue / broad / sub) | sci-RNA-seq3 |
| **ChemFish** | 250k | 78 de-novo | ✓ `cell_type` | — |
| **DanioCell** | 191,832 | 77 | ✓ | — |
| **MegaFin** (Lawson) | 537,959 | 84 | — | 10x |
| **MegaFin** (Parse) | 540,946 | 77 | — | Parse Evercode |
| **MiniFin** | 94,616 (48 hpf) | 54 Leiden | — | Parse Evercode |

For a **sampled** dataset (ZSCAPE) the cells are a *uniform random cross-section
of the full atlas spanning every condition* (perturbed + control alike — not a
biological subset), drawn so de-novo clustering stays interactive. We **re-cluster
from scratch with the authors' labels held out**, so they can serve as a blind
benchmark.

The clustering is computed per dataset by `scripts/build_zscape_asset.py` (and
siblings): de-novo Leiden, then **silhouette-gated recursive sub-Leiden** — a
coarse cluster (≥4,000 cells) is split further only when the split clears a mean
silhouette floor and every sub-cluster keeps a minimum size, so each leaf is
geometrically well-separated and never over-fragmented. Published labels are
computed per cluster (majority + purity at each tier) and written to a **separate
`groundtruth.json` that is never sent to the agent**, so the labeller can't peek.

### Setup screens — dataset, then model

**Choose a model.** One card per selectable OpenAI model (the gpt-5 series —
`gpt-5-mini` through `gpt-5.5`), each with a tier badge, a one-line strength
summary, and the **projected full-run cost** for that dataset's cluster count
(≈21k tokens/cluster × exact per-1M rate × clusters; rates in
`src/app/daniotype_kasperov/models.ts`). The chosen model drives every
personality, the confidence model, and the scorer, and rides through the saved
run JSON.

### Three-pane cluster screen

One shared layout, identical for every dataset:

- **LEFT — focused cluster + floating HUD.** The cluster's UMAP with three
  draggable, resizable windows: **World Map** (whole atlas + focus box), **Top
  Markers** (top up/down markers with log2FC bars + %in/%out; a gene the Reasoner
  *promotes* floats up into the list), and **TIER CONFIDENCE** (four-tier
  prediction + tweened confidence bars).
- **CENTER — the chat** (Researcher / Archivist / Reasoner).
- **RIGHT — the live activity pane**, a theatrical-but-real "what the agent is
  doing now" view, including the actual single-cell stats it queries.

Colour means exactly one thing in the chat — **which personality is speaking**
(🟢 Researcher / 🟡 Archivist / 🔵 Reasoner); everything else is greyscale.

### The autopilot reasoning harness (v2)

The autopilot loop lives in the Flask backend
`backend/daniotype_autopilot_api/app.py` (the persistent EC2 runner; the
in-browser path mirrors the same prompts). Each leaf is worked **ground-truth-blind**
through a Researcher → Reasoner → Archivist loop, then a disciplined conclusion:

1. **GT-blind context assembly** (`assemble_leaf_context`). The leaf's marker
   tables are formatted with no access to published labels. A **trap-library
   briefing** (`trap_warnings`, 7 ZSCAPE-mined failure shapes — pigment/RPE,
   collagen-rod, collagen→generic-mesenchyme, pan-neuronal, cdh17-promiscuous,
   lens-metabolic, hypothesis-lock-in) is appended as *advisory* DOUBLE-CHECK
   notes that fire only on an entry-shape match — never as bans.

2. **Stage-aware Researcher** (`research_identity`) proposes a candidate identity
   *at the developmental stage of the data* (absent ADULT markers don't lower
   confidence at 48 hpf), returning a structured evidence package.

3. **Agentic Reasoner + Archivist** (`reason_with_archivist`). The Reasoner
   treats the Researcher's candidate as a **hypothesis to test, not a prior to
   confirm**, and may call the **Archivist** — a GT-blind raw-stats tool over the
   **live `:5007` single-cell service** — mid-reasoning: `probe_markers`,
   `coexpress`, `specificity_ranked`, `across`. A **convention-aware symbol
   resolver** bridges Parse's dropped/added zebrafish paralog suffixes and
   ENSDARG↔symbol so probes actually resolve. It concludes under five rules:
   - **R1 Discriminating-marker dominance** — a marker specific to one candidate
     (and absent in the rival) decides; markers *shared* across rivals vote for
     neither.
   - **R2 Hypothesis-not-default** — a contradicting discriminator overturns the
     standing hypothesis rather than being hedged in.
   - **R3 Structural-program collision flag** — collagen / melanin / generic
     mesenchyme are shared programs; when a leaf's *dominant* markers ARE such a
     program the call goes provisional and a discriminator **panel** is probed.
     Includes first-class **cross-lineage panels**: eye-RPE-vs-neural-crest
     melanophore (melanin is shared — dispatch rx1/otx2/tfec vs sox10/mitfa) and
     notochord-vs-hypochord (col8a1a is shared — dispatch tbxta/ngs/col8a1a/
     angpt1/npr3).
   - **R4 Positive-anchor floor** — an ASSIGN must cite at least one *present,
     specific-positive* marker for that identity; otherwise reject or abstain at
     the deepest defensible tier.
   - **R5 Scorecard hygiene** — a probed-and-absent marker can only *rule out* a
     rival; it may never be listed as support for the chosen call.

4. **Within-run ledger (the snowball loop).** As leaves are labelled, each
   confident ASSIGN (R4-anchored) accrues a GT-blind ledger entry
   `{compartment, label, decided_by, leaf}`. `run_with_ledger` orchestrates a
   canonical, reproducible order (compartments in parallel, sequential within a
   compartment, each compartment feeding its own ledger forward). The ledger
   slice is injected into later leaves' briefings as a **soft by-elimination
   prior** — strong discriminating evidence overrides it and conflicts are
   flagged. Entries are normalized to a cell-type **stem** (the model's invented
   `<gene>-positive` / stage / `-derived` qualifiers are dropped) and same-stem
   entries are merged, so the prior stays sharp instead of accumulating
   near-duplicates. The leak wall is intact: entries come only from the system's
   own calls, never from ground truth.

5. **Audit trail.** The full reasoning trace per leaf (Researcher package,
   Archivist probes + verdicts, Reasoner rounds, final scorecard) is persisted
   into the saved run record, so every call is reproducible and inspectable.

### Scoring against ground truth

On GT datasets the per-cluster list and the comparison are **one merged table**.
Each row shows our label, an overall confidence badge, and one column per tier
with **our prediction + that tier's confidence %**. Pressing **🎯 Compare to
ground truth** (enabled once every cluster is labelled) fills each tier with **✓**
(match) or **✗ + the corrected published label in subtle red**.
`/api/kasperov_score` is a **semantic judge** (synonym / ontology / lineage
equivalence, plus credit for lineage roll-up and superset/multi-name calls — not
exact-string matching), and the conclude identity is **driver-scored** at each
native tier (finer-than-driver tiers are *not-attempted*, never counted as a
miss). Abstention is a first-class outcome. Four depth-stratified agreement bars
show the gradient — agreement falls as the tier gets finer.

The judge is itself a reasoning model and **not bit-deterministic**: ~10% of
borderline per-unit verdicts flip on identical re-scores (~±2–3 pt aggregate). A
version-to-version delta only counts as real if it **exceeds that ±~3 pt band** —
preferably by re-scoring both versions in one paired pass. The active harness
config + benchmark scores are stamped in
`src/app/daniotype_kasperov/harness_registry.json`.

### Cost & model tracking

Every route returns OpenAI token usage; the client tallies tokens **per model**
and computes exact USD (`estimateCost`). Both the *projected* full-run cost (in
the model picker) and the *realized* cost are exact for every selectable model,
and both ride into the saved run.

### One combined run — export, import, and the server store

A run is one object (`schema: "daniotype_kasperov_run/v1"`): per-cluster
`{finalLabel, validated, confidence (four-tier), addedMarkers, transcript}` +
`groundTruth` (aggregate + per-cluster verdicts) + metadata `{model, cost+usage,
exportedAt, scoredAt, nLabelled}`.

- **⬇ Export results (JSON) + save to server** downloads it *and* saves to the
  server store (warns first if a GT dataset hasn't been scored).
- **☁ Load Previous Run…** lists server-saved runs (*model · #labelled · scored ·
  date · ~$cost*) and reloads any one for cross-model compare.
- **⬆ Import results (JSON)** re-hydrates a downloaded run.
- Storage is **EC2 EBS disk** via the worker (`/api/kasperov_runs` proxies to
  it) — no S3 bucket. Per-dataset `localStorage` keeps an in-progress run across
  reloads.

### Endpoints

| Route | Purpose |
|---|---|
| `/api/kasperov_agent` (SSE) | three-personality agent + per-dataset Archivist tool loop |
| `/api/kasperov_confidence` | four-tier characterization + per-tier confidence |
| `/api/kasperov_score` | per-tier ground-truth agreement (semantic judge) |
| `/api/kasperov_proxy` | embeds the Researcher's cited page (frame-stripped, scroll-highlighted) |
| `/api/kasperov_runs` | run store proxy (save / list / load → EC2 EBS) |
| `/api/kasperov_autopilot` | start / status / abort proxy for the EC2 persistent runner |
| `https://zscape.zeroshot.bio/minifin/` | **live single-cell stats / co-expression / p-values** (`:5007`, token-gated) — the Archivist's data source |
| `https://zscape.zeroshot.bio/autopilot/` | EC2 worker: persistent auto-pilot + run store |

### Operational notes

- **Time limits.** On **Vercel Pro** the LLM routes are `maxDuration = 300`
  (agent/score) / `120` (confidence), so heavy models (gpt-5.4 / 5.5) finish in
  the wizard, auto-pilot, and the server runner. On **Hobby** every function is
  capped at 60s — prefer gpt-5-mini / gpt-5 there and run heavy models via the
  persistent server auto-pilot. On a timeout the agent names the model rather
  than going blank.
- **Persistence (POC).** Per dataset: validated + labels under
  `daniotype_kasperov_v3:<id>`; the full run under
  `daniotype_kasperov_results:<id>` (debounced, quota-fallback to
  markers+confidence); selected model under `daniotype_kasperov_model`. The
  server store is the durable, cross-device copy.

### Reproduce the data assets

```bash
# ZSCAPE (de-novo cluster + markers + held-out ground truth, one script)
/data/.venv/bin/python scripts/build_zscape_asset.py     # umap.json + archivist/ + groundtruth.json
```

Per-dataset assets land under `public/daniotype_kasperov/datasets/<id>/`
(`umap.json`, `archivist/`, `groundtruth.json`) plus a server-side
`<id>_archivist.json` next to the agent route. The build does the de-novo Leiden
+ silhouette-gated sub-clustering and writes the held-out `groundtruth.json` the
scorecard scores against. The Archivist's *live* stats come from the `:5007`
service, not these baked files.

---

## Repo layout

```
zeroshotbio-landingpage/
├── src/app/
│   ├── page.tsx                          landing page (zeroshot.bio)
│   ├── layout.tsx · globals.css · DarkModeButton.tsx
│   ├── daniotype_kasperov/               the labeller (native Next.js)
│   │   ├── KasperovClient.tsx            the wizard UI + flow
│   │   ├── models.ts                     selectable models + exact pricing
│   │   ├── dataset_facts.json            per-dataset cells/clusters/GT facts
│   │   ├── harness_registry.json         active harness config + benchmark scores
│   │   └── components/                   RunViewer, Scorecard, HUD panels, …
│   └── api/
│       ├── kasperov_agent/               three-personality SSE agent
│       ├── kasperov_confidence/          four-tier confidence
│       ├── kasperov_score/               semantic GT judge
│       ├── kasperov_proxy/               cited-page embed
│       ├── kasperov_runs/                run store proxy → EC2 EBS
│       └── kasperov_autopilot/           persistent runner proxy
├── backend/
│   └── daniotype_autopilot_api/
│       └── app.py                        the v2 autopilot harness (Researcher/Reasoner/Archivist)
├── scripts/                              build_zscape_asset.py + per-dataset asset builders
├── public/daniotype_kasperov/            per-dataset umap/archivist/groundtruth assets
├── src/archive/                          retired experiments (not in the active app)
├── tailwind.config.ts · next.config.js
```

---

## Running locally

**Front-end (landing page + labeller UI):**
```bash
npm install
npm run dev          # http://localhost:3000  → / and /daniotype_kasperov
```

The labeller's LLM routes need `OPENAI_API_KEY` in the environment; the Archivist
and run store reach the live EC2 services over HTTPS (token-gated), so a local
dev server talks to the same `:5007` stats backend and EBS run store as
production.

**Backend (autopilot harness — only for server-side auto-pilot):**
```bash
cd backend/daniotype_autopilot_api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
OPENAI_API_KEY=sk-... python app.py        # the persistent EC2 runner
```

---

## Infrastructure

- **Vercel** — hosts the Next.js front-end (landing page + labeller); deploys
  automatically on push to `main`.
- **EC2** — hosts the live `:5007` single-cell stats service (the Archivist's
  data source, behind Nginx + SSL at `zscape.zeroshot.bio/minifin/`) and the
  persistent auto-pilot runner + EBS run store (`/autopilot/`).
- **OpenAI** — the gpt-5 series drives every personality, the confidence model,
  and the semantic scorer.

Environment variables needed in Vercel:
```
OPENAI_API_KEY
KASPEROV_OPENAI_MODEL        # fallback default model
KASPEROV_BASIC_PASSWORD      # Basic-Auth gate on /daniotype_kasperov + /api/kasperov_*
```
