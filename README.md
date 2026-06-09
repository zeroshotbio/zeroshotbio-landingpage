# Zeroshot Bio — Web App

*Next.js 15 · React 18 · Tailwind CSS · D3 · Flask · Jina v3 Ridge · Claude Sonnet 4.6 · Vercel*

---

## What's in this repo

The Zeroshot Bio web app: a marketing landing page plus a small family of
single-cell tools — the **ZSCAPE chat**, the **MiniFin annotation wizard**, and
the **DanioType Auto Pilot Cell Type Labeller**.

| Route | What it is | Stack |
|---|---|---|
| `/` | Marketing landing page | Next.js + Tailwind |
| `/zscape_chat` | ZSCAPE perturbation chat | Next.js front-end → Flask backend |
| `/minifin_annotation_wizard` | Expert wizard for reviewing MiniFin single-cell clusters | Next.js shell → self-contained static bundle + DynamoDB state |
| `/daniotype_kasperov` | DanioType Auto Pilot Cell Type Labeller — multi-dataset AI cluster-naming wizard + ground-truth scorecard | Next.js + OpenAI `gpt-5-mini` (SSE) |

Older experiments (gene explorer, cross-species / perturbation viz, point
clouds, dataroom, design language) live under `src/archive/` and are not wired
into the active app.

---

## MiniFin annotation wizard

`https://www.zeroshot.bio/minifin_annotation_wizard`

A per-reviewer wizard for hand-annotating MiniFin single-cell clusters. The
Next.js route (`src/app/minifin_annotation_wizard/page.tsx`) is a thin shell
that iframes a **self-contained static bundle** in
`public/minifin_annotation_wizard/`. All the cluster data, UMAP coordinates,
DEG stats, and Claude-drafted annotations are baked into the HTML at build
time, so the wizard runs entirely client-side except for saving/loading state.

**Dataset:** MiniFin — 94,616 cells (Parse Evercode, 48 hpf), 103 raw Leiden
clusters at resolution 4.0, of which 54 are "supported". Perturbations: DMSO,
Dapagliflozin, Orlistat, Sorafenib.

**What a reviewer does, per cluster:**

- Reads a marker-led screen with top markers and DEG statistics.
- Inspects the cluster on the UMAP (cluster overlay, focus mode, expression
  threshold slider) and a sunburst of the reference label hierarchy.
- Searches any gene and opens a per-gene UMAP expression modal.
- Sees the per-cluster drug / perturbation composition.
- Reads a **Claude-drafted annotation** (literature drafter, `claude-sonnet-4-6`)
  pre-generated for each cluster, then captures a decision: accept / reject /
  relabel / merge / abstain, with a confidence and notes.
- Clusters are organized into tiers — captured (6), mixed (8), begging (37),
  over-labeled (3) — and a Jump-to picker plus a Final Annotation Map track
  progress.

**State persistence** — `src/app/api/minifin_annotation/route.ts`

Each reviewer's decisions are saved to the existing
`zeroshot_dataroom_visitor_tracking` DynamoDB table under
`id = "minifin_annot::<user>"` (no new table provisioned). Allowed reviewers
are a fixed allow-list (`patrick`, `darien`, `steven`, `creighton`, `harsha`).

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/minifin_annotation?user=<u>` | that reviewer's saved state |
| `GET` | `/api/minifin_annotation?action=progress` | `{n_decided, updated_at}` for all reviewers |
| `POST` | `/api/minifin_annotation` | persist `{ user, state }` |

**Bundle assets** (`public/minifin_annotation_wizard/`):

| File | Size | Contents |
|---|---|---|
| `wizard.html` | ~2.9 MB | self-contained wizard UI + embedded cluster `DATA` and drafts |
| `gene_index.json` | ~575 KB | gene → offset index, cell→cluster map, supported cluster ids |
| `gene_expression.bin` | ~12 MB | packed per-gene expression (3,000 cells × 4,000 genes) |
| `cluster_stats.bin` | ~432 KB | per-gene per-cluster summary stats |

---

## DanioType Auto Pilot Cell Type Labeller

`https://www.zeroshot.bio/daniotype_kasperov` · *(internally "daniotype · kasperov")*

A "video-game"-feel wizard for naming whole-organism zebrafish single-cell
clusters, cluster by cluster, across multiple atlases. A human plays referee
(Kasparov's human–AI-hybrid thesis): a panel of GPT personalities pulls grounded,
tool-verified evidence for a cluster; you watch them work — including the actual
research pages they read — and accept, relabel, or dig deeper. It can also **run
the whole loop itself** (auto-pilot, in-browser or persistently on a server), and
— where the source atlas ships published cell-type labels — **score its de-novo
calls against that ground truth** at every ontology tier. Built natively in
Next.js (`src/app/daniotype_kasperov/`), not an iframe bundle.

The labelling philosophy is borrowed from the standalone `daniotype` descent
(Darien's CTO project): de-novo, evidence-grounded naming under **cite-discipline**,
an `(identity, state)` call at the **ontology tier the evidence supports**,
**require-evidence-to-name → abstain/roll-up**, and **multi-proposer consensus** —
all wrapped in a three-personality chat UX.

### The goal: a four-tier characterization with calibrated confidence

A cluster isn't reduced to one label. The objective of working a cluster is to
characterize it confidently at **four nested ontology tiers** —
`germ_layer → tissue → cell_type_broad → cell_type_sub` — each with a prediction
**and** a calibrated confidence %. `/api/kasperov_confidence` reads the chat +
the evidence added to Top Markers and returns `{tiers:{…:{prediction,
confidence_pct}}, why}`; confidence is generally highest at the coarse germ-layer
tier and lowest at the fine sub-type tier. That four-tier readout is the live
**TIER CONFIDENCE** HUD panel, the per-cluster columns on the world map, and what
the ground-truth comparison grades. "Done" = those confidences are driven up and
the Reasoner concludes.

### The flow

**Choose a dataset** → **Choose a model** → intro → **world map** (reveal the
de-novo clustering) → click a cluster → **three-personality primer** (once per
page load) → the **three-pane cluster screen**. From the world map you can also
**🤖 Activate AutoPilot Cluster Labeller** (in-browser) or **☁ Run AutoPilot on
server (persistent)**, and once clusters are labelled, **🎯 Compare to ground
truth** inline.

### Setup screens — dataset, then model

Two pickers, styled alike, before the map:

**Choose a dataset.** Each dataset is a self-contained asset family under
`public/daniotype_kasperov/`, selected by a `datasetId`; every dataset's run
persists under its own `localStorage` keys so runs never collide. A "✓ ground
truth" badge marks datasets with published labels.

| Dataset | Cells | Clusters | Ground truth | Status |
|---|---|---|---|---|
| **MiniFin** | 94,616 (Parse Evercode, 48 hpf) | 47 Leiden | — | ready |
| **ZSCAPE** | 250k de-novo sample of the 3,231,733-cell Saunders atlas | 55 de-novo | germ_layer / tissue / cell_type_broad / cell_type_sub | ready |
| **ChemFish** | 2.1M (Barkan et al.) | — | `cell_type` (~348) | soon (needs clustering) |
| **MegaFin** | 2.1M (Parse Evercode) | — | — (kNN-projected only) | soon (not sequenced) |

**Choose a model.** One card per selectable OpenAI model (the gpt-5 series:
`gpt-5-mini`, `gpt-5`, `gpt-5.1`, `gpt-5.2`, `gpt-5.4-nano`, `gpt-5.4-mini`,
`gpt-5.4`, `gpt-5.5` — no "pro" tiers), each with a tier badge, a one-line
strength summary, and the **projected full-run cost** for that dataset's cluster
count. Pricing is exact (confirmed OpenAI per-1M-token rates in
`src/app/daniotype_kasperov/models.ts`). The chosen model drives every
personality, the confidence model, and the scorer, and is recorded in the saved
run JSON — it rides through the entire workflow. The world map shows it read-only
("Model gpt-5.4 · change", where *change* re-opens this screen).

### World map

The pre-reveal screen shows the raw UMAP; **"View clusters"** colours the
de-novo clustering. For a **sampled** dataset (ZSCAPE) the header explains that
the 250,000 cells are a *representative random sample of the full 3.2M-cell
atlas* (all conditions, perturbed + control — not a biological subset), drawn so
de-novo clustering stays interactive, and that **we re-cluster from scratch with
the authors' labels held out** so they can serve as a benchmark. A run-info bar
shows the model and the projected full-run cost; "spent so far" appears only once
the run has labelled clusters.

The clustering itself is computed by `scripts/build_zscape_asset.py` (per
dataset): de-novo Leiden on the subsample, then **silhouette-gated recursive
sub-Leiden** (a coarse cluster is split only when the split clears a silhouette
floor + min-leaf size — the daniotype "sub-cluster large clusters" mechanic).
Published labels are computed per cluster (majority + purity at each tier) and
written to a **separate `groundtruth.json` that is never sent to the agent**, so
the labeller can't peek.

**On ground-truth datasets the per-cluster list and the comparison are merged
into one table.** Each row is clickable (opens the cluster) and shows the colour
dot, our label, a ✓ if validated, an overall confidence badge, and one column per
tier. Each tier cell shows **our prediction + that tier's confidence %** as you
work the cluster; the tiers stay un-filled (`·`) for the ✓/✗ until you press
**🎯 Compare to ground truth** (enabled once every cluster is labelled), which
fills in **✓** (match) or **✗ + the corrected published label in subtle red**
(miss). MiniFin (no ground truth) keeps a simpler card grid as its navigator.

### Three-pane cluster screen

The cluster view is three vertical columns (one shared layout, so it's identical
for every dataset):

- **LEFT — focused cluster + floating HUD.** The cluster's UMAP with three
  draggable, resizable, auto-reflowing windows over it: **World Map** (whole atlas
  with a focus box), **Top Markers** (top up- and computed down-regulated markers
  with log2FC bars + %in/%out; chat-contributed evidence attaches inline, and a
  gene the Reasoner *promotes* floats up into the UP/DOWN list), and **TIER
  CONFIDENCE** (the four-tier prediction + smoothly-tweened confidence bars,
  framed "drive every tier's confidence up").
- **CENTER — the chat** (Researcher / Archivist / Reasoner; see below).
- **RIGHT — the live activity pane.** A theatrical-but-real "what the agent is
  doing now" view (see *Live activity pane*).

### Three personalities — Reasoner-orchestrated

`/api/kasperov_agent` (SSE) is backed by the **OpenAI Responses API** with the
selected model (`OPENAI_API_KEY` in Vercel env; `KASPEROV_OPENAI_MODEL` is the
fallback default). Colour means exactly one thing in the chat — **which
personality is speaking** (🟢 **Researcher** / 🟡 **Archivist** / 🔵 **Reasoner**);
everything else is greyscale.

- **Reasoner** — your main partner. Generalist synthesis, no tools; reconciles
  the evidence, judges when you're *done*, hands the other two ready-to-send
  prompts, and emits the settled `(identity, state, tier)` conclusion.
- **Researcher** — web search restricted to ZFIN / ZFA (EBI OLS) / GO / NCBI /
  UniProt; cites records (`**gene** — finding [record]`), which the live activity
  pane then loads.
- **Archivist** — answers **only** from the dataset via the `query_minifin` tool;
  never web.

**Reasoner-led, but everything is reachable.** The footer has three
always-available, labelled, colour-coded input lines — *Ask the Reasoner /
Researcher / Archivist* — and the line you type into **forces** that personality.
Routing (`classifyMode`), in order: an explicit `Researcher:` / `Archivist:` /
`Reasoner:` prefix forces that one → a prompt-crafting request goes to the
Reasoner → the auto first identity pass is the Researcher → strong intent verbs →
keyword cues.

**Hidden control blocks** (parsed whether fenced or bare, then stripped from the
visible text and turned into buttons):

- ` kasperov-markers ` → "➕ Add N insights to Top Markers".
- ` kasperov-dispatch ` → "▶ Send to the Researcher/Archivist".
- ` kasperov-promote ` → "▲/▼ Promote X to UP/DOWN-regulated".
- ` kasperov-conclude ` → `{identity, tier, state, cited_markers, decision,
  confidence, done}` (legacy flat `{label,…}` still parses) → the Reasoner's
  settled call; surfaces "✓ Accept identity" or, when cite-discipline downgrades
  it, "⤴ Accept (abstain/roll-up)".

### Daniotype mechanics (label quality)

Folded into the three-personality loop so the calls are defensible:

- **`identity × state × tier` conclude** — not a flat label; `state ∈ {progenitor,
  cycling, quiescent, mature, stress, none}` applies only at the cell-type tier.
- **Require-evidence-to-name, enforced** (`enforceCiteDiscipline`, client) —
  `cited_markers` must be genes that are actually this cluster's DEGs (or promoted
  into the panel); a confident "assign" with no grounded marker is **downgraded to
  an abstention that rolls up to the deepest defensible tier**.
- **K = 2 consensus in auto-pilot** — each cluster gets two *independent*
  Researcher proposers (a default read + an alternative-hypothesis read from a
  fresh context), and the Reasoner adjudicates before concluding.
- The Reasoner self-identifies generically (no hard-coded model name); the chosen
  model name shows in the UI and the saved JSON.

### Live activity pane (the right column)

A real "what the agent is reading right now" view, not a mock:

- **Researcher → the actual cited page.** It parses the latest Research Log for
  `(gene, url)` pairs and loads the page (preferring ZFIN / Wikipedia, which
  render well) in a sandboxed iframe via **`/api/kasperov_proxy`**, which fetches
  the page server-side, strips frame-blocking + CSP, injects a `<base>` so the
  site's own CSS/images load, and injects a script that **scrolls to and
  highlights the gene**. The iframe is sandboxed *without* `allow-same-origin`, so
  the proxied page can render and run its own scripts but cannot touch our origin
  (host-allowlisted: zfin.org, ebi.ac.uk, geneontology.org, ncbi, uniprot,
  wikipedia). Before any citation, it **pre-loads a real page for the cluster's
  top marker** (a zebrafish-scoped Wikipedia search) so the pane is never empty.
  ZFIN gene pages render fully; AmiGO blocks bots and EBI-OLS is a SPA, so those
  may be sparse — noted in the pane.
- **Archivist → a faux file-explorer** over the dataset (folders opening, files
  parsed) with a terminal showing the **real** per-gene `log2FC` / `pct_in` /
  `pct_out` from the cluster's markers.
- **Reasoner → a synthesis view**. A red "live" dot pulses while streaming, and
  the real status line sits at the bottom.

### The Archivist's `query_minifin` tool — kinds & data sources

The Archivist tool is **per-dataset**: the agent route picks the archivist
extract + static-asset base from the request's `datasetId`.

| Kind | Returns | Backed by |
|---|---|---|
| `gene` / `genes` | one-vs-rest log2FC + %in/%out | static per-cluster profile |
| `top` | top-N up/down markers | static profile |
| `search` | substring gene match | static profile |
| `across` | one gene's mean + %expr in **every** cluster + specificity rank | static gene × cluster matrix |
| `specificity` | cross-cluster specificity for a gene **list** | static matrix |
| `pvalues` | BH-adjusted one-vs-rest p-values | **live MiniFin microservice** |
| `coexpress` | cell-level fraction co-expressing **all** listed genes | **live MiniFin microservice** |
| `fullstats` | log2FC + %in/out + **p-value + mean** for a list in one call | matrix + service merged |

Static files: `public/daniotype_kasperov/archivist/` (MiniFin, 24,252 genes × 47
clusters) and `public/daniotype_kasperov/datasets/<id>/archivist/` (ZSCAPE,
16,718 genes × 55). The live p-value / co-expression microservice
(`backend/minifin_query_api/`, behind `https://zscape.zeroshot.bio/minifin/`) is
**MiniFin-only**; other datasets degrade to the static archivist gracefully.

> **Security posture:** the raw `.h5ad` is NEVER served — it lives only on the
> EC2 box, read solely by the microservice, which returns aggregated answers. The
> static CDN files are derived stats. The live endpoint is token-gated over HTTPS.

### Auto-pilot — in-browser

**🤖 "Activate AutoPilot Cluster Labeller"** drives the loop with no human in the
seat. Per **un-labelled** cluster it runs **two independent Researcher proposers**
→ asks the Reasoner to reconcile + decide → fires `kasperov-dispatch` follow-ups
→ auto-adds `kasperov-markers` → enforces require-evidence on the conclusion →
records the label and advances (bounded to `AUTO_MAX_ROUNDS` = 4 Reasoner rounds).
Each stream has a hard timeout + one retry; a cluster that still errors is
recorded and surfaced in a post-run banner with **↻ Retry these**. "Done" is keyed
off **having a label** (not merely being validated), so the sweep auto-skips
already-labelled clusters and resumes cleanly. Auto-pilot fires **only** from the
world-map button (a plain cluster click never triggers it).

### Persistent server auto-pilot — on the EC2 box

**☁ "Run AutoPilot on server (persistent)"** runs the *same* loop on the EC2 box
(`backend/daniotype_autopilot_api/`, FastAPI on `:5008`, behind
`https://zscape.zeroshot.bio/autopilot/`), so it **survives the browser closing**.
The worker holds no secrets — it drives the loop by calling the deployed
`/api/kasperov_agent` and `/api/kasperov_score`, also calls
`/api/kasperov_confidence` per cluster to fill the four-tier characterization,
then writes the combined run JSON to its **EBS volume** (`/data/daniotype_runs`,
no S3). The in-app button proxies start/status through `/api/kasperov_autopilot`;
a completed run lands in **Load Previous Run** tagged `☁ server`. Activation steps
(systemd + nginx + the two Vercel env vars) are in the worker's `README.md`.

### Ground-truth scorecard — per-tier

For a dataset with published labels, **🎯 Compare to ground truth** grades **our
per-tier prediction against the reference at that tier** via
`/api/kasperov_score` (an LLM judge, strict `json_schema`): synonyms / ontology /
lineage equivalence accepted, numeric sub-suffixes ignored (`periderm 10` →
`periderm`), each tier judged on its own. The merged table fills with ✓/✗ +
red corrections, and four depth-stratified agreement bars (germ layer → tissue →
broad → sub) show the gradient — agreement should fall as the tier gets finer.
Scoring batches across clusters with concurrency; results are controlled state so
they ride into the export.

### Cost & model tracking

The routes return OpenAI token usage; the client tallies tokens **per model** and
computes exact USD (`estimateCost`). The model picker shows a **projected**
full-run cost (≈21k tokens/cluster × price × clusters), tweened as you compare
models. Both projected and realized costs are exact for every selectable model.

### One combined run — export, import, and the server store

A run is one object (`schema: "daniotype_kasperov_run/v1"`): per-cluster
`{finalLabel, validated, confidence (four-tier), addedMarkers, transcript}` +
`groundTruth` (aggregate + per-cluster verdicts) + metadata `{model, cost+usage,
exportedAt, scoredAt, nLabelled}`.

- **⬇ Export results (JSON) + save to server** downloads it and **also saves it to
  the server store**. If the dataset has ground truth and you haven't scored yet,
  it warns first so saved runs are complete.
- **☁ Load Previous Run…** lists server-saved runs (*model · #labelled · scored ·
  date · ~$cost*) and reloads any one for compare/contrast across models.
- **⬆ Import results (JSON)** re-hydrates a downloaded run.
- Storage is **EC2 EBS disk** via the worker (`/api/kasperov_runs` proxies to it);
  no S3 bucket. Per-dataset `localStorage` keeps an in-progress run across reloads.

### Endpoints

| Route | Purpose |
|---|---|
| `/api/kasperov_agent` (SSE) | the three-personality agent + per-dataset archivist tool loop |
| `/api/kasperov_confidence` | four-tier characterization + per-tier confidence |
| `/api/kasperov_score` | per-tier ground-truth agreement (semantic judge) |
| `/api/kasperov_proxy` | embeds the Researcher's cited page (frame-stripped, base-injected, scroll-highlighted) |
| `/api/kasperov_runs` | run store proxy (save / list / load → EC2 EBS) |
| `/api/kasperov_autopilot` | start/status/abort proxy for the EC2 persistent runner |
| `https://zscape.zeroshot.bio/minifin/` | live MiniFin p-values / co-expression (token-gated) |
| `https://zscape.zeroshot.bio/autopilot/` | EC2 worker: persistent auto-pilot + run store |

### Operational notes

- **Time limits.** On **Vercel Pro** the LLM routes are `maxDuration = 300`
  (agent/score) / `120` (confidence), so heavy reasoning models (gpt-5.4 / 5.5)
  finish in the interactive wizard, auto-pilot (285s client timeout), and the
  server runner (305s worker timeout). On **Hobby** every function is capped at
  60s regardless, so prefer gpt-5-mini / gpt-5 there and run heavy models via the
  persistent server auto-pilot. On a timeout the agent emits a clear message
  naming the model rather than a blank.
- **Persistence (POC).** Per dataset: validated + labels under
  `daniotype_kasperov_v3:<id>`; the full run (transcripts + markers + four-tier
  confidence + usage + scores) under `daniotype_kasperov_results:<id>` (debounced,
  quota-fallback to markers+confidence); selected model under
  `daniotype_kasperov_model`. The server store is the durable, cross-device copy.

### Reproduce the data assets

```bash
# MiniFin (the original 94.6k atlas)
/data/.venv/bin/python scripts/extract_minifin_umap.py        # public UMAP + markers
/data/.venv/bin/python scripts/compute_minifin_archivist.py   # per-cluster profiles + gene_matrix

# ZSCAPE (de-novo cluster + markers + held-out ground truth, one script)
/data/.venv/bin/python scripts/build_zscape_asset.py          # umap.json + archivist/ + groundtruth.json
```

Per-dataset assets land under `public/daniotype_kasperov/datasets/<id>/`
(`umap.json`, `archivist/`, `groundtruth.json`) plus a server-side
`<id>_archivist.json` next to the agent route. `build_zscape_asset.py` does the
de-novo Leiden + silhouette-gated sub-clustering and writes the held-out
`groundtruth.json` the scorecard scores against.

---

## ZSCAPE chat

`/zscape_chat` — a single-page chat interface for querying the effects of
zebrafish gene knockouts across 10 developmental phenotype categories.

**Two query modes:**

- **Known KO lookup** — 25 experimentally verified knockouts with ground-truth
  influence scores (GT v3.2). Returns scores, LOKO Pearson validation, and a
  Claude-generated interpretation.
- **Novel gene prediction** — any gene not in the ground-truth set. Embeds a
  description of the gene using `jinaai/jina-embeddings-v3`, runs a pre-trained
  Ridge regression across 151 zebrafish cell types, and streams results through
  Claude for narrative.

**Where each piece of output comes from:**

| Output element | Source |
|---|---|
| Influence scores (known KOs) | Ground Truth v3.2 |
| Influence scores (novel genes) | Jina Ridge model |
| Nearest KO match | Jina Ridge (embedding similarity) |
| Gene description, interpretation, confidence | Claude Sonnet 4.6 |

---

## Repo layout

```
zeroshotbio-landingpage/
├── src/app/
│   ├── page.tsx                       landing page
│   ├── layout.tsx
│   ├── globals.css                    shared CSS (Roboto Slab, custom utilities)
│   ├── DarkModeButton.tsx
│   ├── zscape_chat/
│   │   └── page.tsx                   ZSCAPE chat UI (React, all CSS inlined)
│   ├── minifin_annotation_wizard/
│   │   └── page.tsx                   iframe shell for the wizard bundle
│   └── api/
│       ├── minifin_annotation/        DynamoDB reviewer-state API
│       ├── visitors/                  DynamoDB visit logger
│       ├── orthologs/                 gene ortholog lookup
│       ├── orthologs_subset/          5k ortholog subset
│       └── alliance_full/             Alliance genome data proxy
├── src/archive/                       retired experiments (not in active app)
├── backend/
│   └── zscape_chat_api/
│       ├── app.py                     Flask SSE backend
│       └── requirements.txt
├── public/
│   ├── minifin_annotation_wizard/     wizard.html + gene/cluster .bin assets
│   ├── data/                          ortholog + alliance JSON/parquet
│   └── images/
├── tailwind.config.ts
└── next.config.js
```

---

## Running locally

**Front-end (Next.js):**
```bash
npm install
npm run dev          # http://localhost:3000
```

Both `/minifin_annotation_wizard` and `/` run from the Next.js dev server. The
wizard reads/writes reviewer state through `/api/minifin_annotation`, so it
needs the AWS env vars below to persist (it still renders read-only without
them).

**Backend (Flask — only needed for ZSCAPE chat):**
```bash
cd backend/zscape_chat_api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-... python app.py --port 5002
```

The backend loads at startup (~5s):
- Jina v3 cell-type embeddings (151 × 512)
- Jina v3 KO phenotype embeddings (28 × 512)
- Ground truth complement scores (3,747 KO × cell-type entries)
- Trains FullRidge on concatenated `[KO_emb | CT_emb] → 10 scores`

On first novel-gene request it lazy-loads `jina-embeddings-v3` (~200 MB, cached
to `~/.cache/huggingface/`). Data files are read from `ZSCAPE_V4_ROOT`
(default: `/data/ZSCAPE_complements_v4`).

---

## Building off the wizard

To adapt the MiniFin wizard for a different dataset or reviewer workflow:

- The UI and embedded `DATA` live in `public/minifin_annotation_wizard/wizard.html`
  — it's a single self-contained file (no build step) that you can open
  directly in a browser. Search for `const DATA =` to find the cluster payload
  and `drafter` block.
- Regenerating the `.bin` / `gene_index.json` assets and the embedded `DATA` is
  done by an upstream pipeline outside this repo (see the MiniFin project at
  `/data`); this repo only hosts the rendered bundle.
- To add reviewers, edit the `USERS` allow-list in
  `src/app/api/minifin_annotation/route.ts`.
- To repoint state storage, change `TABLE_NAME` / `idFor()` in the same file.

---

## Infrastructure

- **Vercel** — hosts the Next.js front-end; deploys automatically on push to `main`
- **EC2** — hosts the Flask ZSCAPE backend behind Nginx + SSL
- **DynamoDB** — `zeroshot_dataroom_visitor_tracking` table backs both visit
  logging and MiniFin reviewer state

Environment variables needed in Vercel:
```
ANTHROPIC_API_KEY
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```
